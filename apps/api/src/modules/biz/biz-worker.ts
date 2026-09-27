// 명령 워커 grp:biz-writer — 기전 정본 docs/06_pipeline/07_business_crud.md §업무 명령 경로(적용 단계 ②~⑦ · 멱등 · 재전달 6경우)
// ② lock:biz:writer를 쥔 동안만 소비자 biz-writer-1로 읽는다 — 쥘 때마다 자기 PEL(ID 0)을 먼저 소진한 뒤 > (새 명령이 미확인 명령을 앞지르지 않는다)
// ③ 원장 확인 → ④ 유효 창 → ⑤ 트랜잭션(BizHandlers · 원장 APPLIED 같은 트랜잭션) → ⑥ 체인 ②③(서비스 안 · 반환 전)
// ⑦ 결과 SET → ch:bizreply → XACK → 흐름 요약(표지 있을 때만). XACK가 결과 SET 뒤라 그 사이 크래시는 PEL 재전달 · ③이 막는다.
// PostgreSQL 불가는 재시도하지 않는다 — 결과 키에만 common.postgres_unavailable 503(FAILED · 원장 행 없음) · XACK(REQ-WRK-06).
// 락 키 · 갱신 · 실패 전략 정본 docs/05_data_stores/05_redis_keyspace.md lock:biz:writer 행(획득 실패 · 갱신 실패 = 소비 중단 · 대기).
// 갱신 실패는 둘로 가른다 — 소유자 아님(lost)은 곧바로 소비 중단 · 불확실(타임아웃 · 오류)은 락 유지 · 다음 틱 재시도(마지막 확인 뒤 TTL이 지나면 중단).
// 확인 시각은 락 호출 **전** 시각이다(Redis가 만료를 잡은 시각은 호출 전 ~ 응답 사이 — 전 시각이 가장 이른 만료를 준다).
// 불확실 틱은 다음 틱 전에 TTL이 지날 수 있으면 지금 멈추고, 엔트리 루프도 확인 뒤 TTL이 지났으면 멈춘다(틱이 늦거나 걸려도).
import { randomUUID } from 'node:crypto';
import {
  BIZ_CONSUMER,
  BIZ_ENTRY_FIELD,
  BIZ_GROUP,
  BIZ_KINDS,
  BIZ_LOCK_RENEW_MS,
  BIZ_LOCK_TTL_MS,
  BIZ_RESULT_TTL_S,
  BIZ_STREAM,
  BIZ_WRITER_LOCK,
  BizCommandEnvelope,
  type BizCommandEnvelopeBody,
  type BizResultBody,
} from '@db-study/shared';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { FlowPublisher } from '../../common/flow/flow-publisher';
import { ApiError } from '../../common/http/api-error';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { RedisConnections } from '../../common/redis/connections';
import { DurableKeyClient, type GroupBacklog } from '../../common/redis/durable-key-client';
import { FanoutPublisher } from '../../common/redis/fanout-publisher';
import { obsCollectMetrics } from '../metrics/store.metrics';
import { bizMetrics } from './biz.metrics';
import { BIZ_HANDLERS, type BizApplyTrace, type BizHandlers } from './biz-contracts';
import { bizTraceOf } from './biz-handlers';
import { BizLedger, BizLedgerConflict, type LedgerKey, type LedgerRow } from './biz-ledger';

/** 한 번에 읽는 명령 수 — 처리는 직렬(엔트리 하나 = 명령 하나) */
export const BIZ_READ_COUNT = 10;
/** > 읽기 블록 — 락 상실 · 종료를 이 간격 안에 알아챈다 */
export const BIZ_READ_BLOCK_MS = 1_000;
/** biz_stream_lag 수집 주기(02_instrumentation §업무 명령 랙 — 현행 참고 15초) */
export const BIZ_LAG_POLL_MS = 15_000;
/** 루프 예외 뒤 쉬는 시간 */
const ERROR_BACKOFF_MS = 1_000;

type Log = { log(s: string): void; warn(s: string): void; error(s: string): void };

export interface BizWorkerDeps {
  handlers: BizHandlers;
  ledger: Pick<BizLedger, 'find' | 'record'>;
  results: { set(cmdId: string, json: string, ttlSeconds: number): Promise<boolean> };
  /** 소유자 토큰 — 워커 인스턴스 UUID(05_redis_keyspace lock:biz:writer 값) */
  token: string;
  lock: {
    /** resumed = 값이 이미 내 토큰(앞 획득 · 갱신이 응답만 잃었다) — 이어 쓴다 */
    acquire(token: string, ttlMs: number): Promise<'acquired' | 'resumed' | 'held' | 'failed'>;
    /** lost = 소유자 아님(0) · uncertain = 타임아웃 · 오류(소유 여부 모름) */
    renew(token: string, ttlMs: number): Promise<'renewed' | 'lost' | 'uncertain'>;
    release(token: string): Promise<void>;
  };
  stream: {
    ensureGroup(): Promise<void>;
    /** fromId '0'(또는 PEL 안 ID)이면 자기 PEL · '>'면 새 명령 */
    read(fromId: string, count: number, blockMs: number): Promise<{ id: string; value: string | null }[]>;
    ack(id: string): Promise<void>;
    backlog(): Promise<GroupBacklog | null>;
  };
  reply(cmdId: string): Promise<boolean>;
  flow: Pick<FlowPublisher, 'enabled' | 'publishBiz'>;
  /** epoch ms(requestedAt와 같은 시계) */
  now(): number;
  log: Log;
}

/** 결과 한 건을 낼 때의 관찰값 — 흐름 요약 · 메트릭 */
interface Judgment {
  cmdId: string;
  kind: string;
  result: BizResultBody;
  duplicate: boolean;
  queueWaitMs: number | null;
  trace: BizApplyTrace;
}

const BIZ_KIND_SET: ReadonlySet<string> = new Set(BIZ_KINDS);

const noTrace = (): BizApplyTrace => ({
  txMs: null,
  invalidateMs: null,
  invalidatedKeys: 0,
  cacheinv: false,
});

const PG_DOWN_MESSAGE = 'PostgreSQL에 접속할 수 없다';
const failedResult = (actor: number | null): BizResultBody => ({
  status: 'FAILED',
  actor,
  httpStatus: 503,
  error: { code: 'common.postgres_unavailable', message: PG_DOWN_MESSAGE },
});

const isPgDown = (e: unknown) => e instanceof ApiError && e.code === 'common.postgres_unavailable';
/** XREADGROUP이 그룹 · 스트림이 없다고 답했다(누가 스트림 · 그룹을 지움) — 다음 바퀴에 그룹을 다시 만든다 */
const isNoGroup = (e: unknown) => e instanceof Error && /NOGROUP/i.test(e.message);

/** 흐름 요약 result — ok · 오류 코드 · expired(07_api/11 §흐름 이벤트 biz 행) */
function flowResultOf(r: BizResultBody): string {
  if (r.status === 'APPLIED') return 'ok';
  if (r.status === 'EXPIRED') return 'expired';
  return r.error?.code ?? 'common.postgres_unavailable';
}

/**
 * 명령 워커 본체 — Nest 밖에서도 돈다(단위 테스트는 가짜 deps로 단계 순서를 본다).
 * 소비는 한 루프 · 직렬이고, 락 갱신은 타이머가 한다(갱신 실패면 다음 엔트리부터 소비하지 않는다).
 */
export class BizCommandRunner {
  private token: string | null = null;
  /** 락 소유를 마지막으로 확인한 시각(획득 · 이어 쓰기 · 갱신 성공의 호출 전 시각) — 여기서 TTL이 지나면 소비를 멈춘다 */
  private confirmedAt = 0;
  private pelCursor: string | null = null;
  private groupReady = false;
  private running = false;
  /** stop()이 불렸다 — 읽은 묶음의 남은 명령을 처리하지 않는다 */
  private stopping = false;
  private loop: Promise<void> | null = null;
  private renewTimer: NodeJS.Timeout | null = null;
  private lagTimer: NodeJS.Timeout | null = null;
  private wake: (() => void) | null = null;

  constructor(private readonly d: BizWorkerDeps) {}

  /** 지금 락을 쥐었는가(관찰 · 테스트) */
  get holdsLock(): boolean {
    return this.token !== null;
  }

  start(): void {
    this.running = true;
    this.loop = this.run();
    this.renewTimer = setInterval(() => void this.renewLock(), BIZ_LOCK_RENEW_MS);
    this.lagTimer = setInterval(() => void this.pollLag(), BIZ_LAG_POLL_MS);
  }

  /** 종료 — 처리 중인 명령 하나를 끝내고 멈춘다(읽었지만 처리하지 않은 명령은 PEL에 남아 다음 소유자가 먼저 읽는다) · 락 해제 */
  async stop(): Promise<void> {
    this.running = false;
    this.stopping = true;
    if (this.renewTimer) clearInterval(this.renewTimer);
    if (this.lagTimer) clearInterval(this.lagTimer);
    this.wake?.();
    await this.loop;
    if (this.token) {
      await this.d.lock.release(this.token);
      this.token = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(done, ms);
      function done() {
        clearTimeout(t);
        resolve();
      }
      this.wake = done;
    });
  }

  private async run(): Promise<void> {
    while (this.running) {
      const ms = await this.turn();
      if (ms > 0) await this.sleep(ms);
    }
  }

  /** 한 바퀴와 그 예외 처리 — 다음 바퀴 전에 쉴 시간(ms)을 돌려준다(0이면 곧바로) */
  async turn(): Promise<number> {
    try {
      return (await this.step()) ? 0 : BIZ_LOCK_RENEW_MS;
    } catch (e) {
      // 예외 뒤에는 항상 PEL부터 — > 로 받고 XACK하지 못한 명령(같은 묶음의 남은 명령 포함)은 PEL에만 있고 > 로는 다시 오지 않는다
      this.pelCursor = '0';
      if (isNoGroup(e)) this.groupReady = false;
      this.d.log.warn(`명령 워커 루프 오류 — ${(e as Error).message}`);
      return ERROR_BACKOFF_MS;
    }
  }

  /** 한 바퀴 — 락이 없으면 쥐려 하고(못 쥐면 false · 재시도 주기 대기), 쥐었으면 PEL → > 순으로 한 번 읽어 직렬 처리한다 */
  async step(): Promise<boolean> {
    if (!this.token) {
      const calledAt = this.d.now();
      const r = await this.d.lock.acquire(this.d.token, BIZ_LOCK_TTL_MS);
      if (r !== 'acquired' && r !== 'resumed') return false;
      this.token = this.d.token;
      this.confirmedAt = calledAt;
      // 쥘 때마다 자기 PEL부터 — 앞 소유자(같은 소비자 이름)가 읽고 XACK하지 못한 명령이 새 명령보다 먼저다
      this.pelCursor = '0';
      this.d.log.log(
        `${BIZ_WRITER_LOCK} ${r === 'resumed' ? '이어 쓰기' : '획득'} — ${BIZ_STREAM} · ${BIZ_GROUP} · ${BIZ_CONSUMER} PEL부터 소비`,
      );
    }
    if (!this.groupReady) {
      await this.d.stream.ensureGroup();
      this.groupReady = true;
    }
    const fromPel = this.pelCursor !== null;
    const entries = await this.d.stream.read(this.pelCursor ?? '>', BIZ_READ_COUNT, BIZ_READ_BLOCK_MS);
    if (fromPel) {
      const last = entries[entries.length - 1];
      this.pelCursor = last ? last.id : null;
    }
    for (const e of entries) {
      // 락을 잃었거나 종료 중이면 남은 명령은 PEL에 둔다 — 락 없이 소비하지 않는다
      if (!this.token || this.stopping) break;
      // 갱신 틱이 늦거나 갱신 호출이 걸려도 — 마지막 확인 뒤 TTL이 지났으면 락이 이미 만료됐을 수 있다
      if (this.d.now() - this.confirmedAt >= BIZ_LOCK_TTL_MS) {
        this.token = null;
        this.d.log.warn(
          `${BIZ_WRITER_LOCK} 마지막 확인 뒤 TTL이 지났다 — 남은 명령은 PEL에 두고 재획득을 기다린다`,
        );
        break;
      }
      await this.process(e.id, e.value);
    }
    return true;
  }

  /**
   * 락 갱신 — 토큰이 같을 때만. 소유자 아님(lost)이면 소비를 멈추고 재획득을 기다린다.
   * 불확실(타임아웃 · 오류)이면 락을 쥔 채 소비를 잇고 다음 틱에 다시 갱신한다 — 다음 틱 전에 마지막 확인 뒤 TTL이
   * 지날 수 있으면(now − 확인 + 갱신 주기 ≥ TTL) 락이 그 사이 만료될 수 있으므로 지금 멈춘다(재획득이 GET == 내 토큰이면 이어 쓴다).
   */
  async renewLock(): Promise<void> {
    const token = this.token;
    if (!token) return;
    const calledAt = this.d.now();
    const r = await this.d.lock.renew(token, BIZ_LOCK_TTL_MS);
    if (this.token !== token) return;
    if (r === 'renewed') {
      this.confirmedAt = calledAt;
      return;
    }
    if (r === 'lost') {
      this.token = null;
      this.d.log.warn(`${BIZ_WRITER_LOCK} 갱신 실패(소유자 아님) — 소비를 멈추고 재획득을 기다린다`);
      return;
    }
    if (this.d.now() - this.confirmedAt + BIZ_LOCK_RENEW_MS >= BIZ_LOCK_TTL_MS) {
      this.token = null;
      this.d.log.warn(
        `${BIZ_WRITER_LOCK} 갱신 불확실 — 다음 주기 전에 마지막 확인 뒤 TTL이 지날 수 있다 · 소비를 멈추고 재획득을 기다린다`,
      );
      return;
    }
    this.d.log.warn(
      `${BIZ_WRITER_LOCK} 갱신 불확실(타임아웃 · 오류) — 락을 유지하고 다음 주기에 다시 갱신한다`,
    );
  }

  /** biz_stream_lag = lag + pending — 실패면 직전 값 유지 · obs_collect_errors_total{store=redis} */
  async pollLag(): Promise<void> {
    try {
      const b = await this.d.stream.backlog();
      if (b) bizMetrics.streamLag.set((b.lag ?? 0) + b.pending);
    } catch {
      obsCollectMetrics.errors.inc({ store: 'redis' });
    }
  }

  /** 명령 하나 ②~⑦ */
  async process(id: string, value: string | null): Promise<void> {
    const receivedAt = this.d.now();
    const env = this.decode(id, value);
    if (!env) {
      await this.d.stream.ack(id);
      return;
    }
    if ('rejected' in env) {
      await this.finish(env.rejected, id);
      return;
    }
    const key: LedgerKey = {
      cmdId: env.cmdId,
      kind: env.kind,
      actor: env.actor,
      requestedAt: env.requestedAt,
    };
    const base = {
      cmdId: env.cmdId,
      kind: env.kind,
      queueWaitMs: Math.max(0, receivedAt - env.requestedAt),
    };

    // ③ 멱등 확인 — 원장 행이 멱등의 유일한 근거(결과 키가 아니다)
    let row: LedgerRow | null;
    try {
      row = await this.d.ledger.find(env.cmdId);
    } catch {
      await this.finish({ ...base, result: failedResult(env.actor), duplicate: false, trace: noTrace() }, id);
      return;
    }
    if (row) {
      await this.finish({ ...base, result: row.result, duplicate: true, trace: noTrace() }, id);
      return;
    }

    // ④ 유효 창 — 결과 키 TTL과 같은 값. 사용자가 포기한 쓰기를 한참 뒤 적용하지 않는다
    if (receivedAt > env.requestedAt + BIZ_RESULT_TTL_S * 1000) {
      const expired: BizResultBody = { status: 'EXPIRED', actor: env.actor };
      await this.finish(await this.judge(key, 'EXPIRED', expired, base, noTrace()), id);
      return;
    }

    // ⑤ 트랜잭션(+ ⑥ 체인 ②③이 반환 전에 끝난다) — ⑦(finish)은 try 밖이다: 결과 SET · XACK의 예외를
    // 적용 예외로 잡으면 커밋된 APPLIED 결과를 FAILED로 덮어쓴다(예외는 바퀴로 올라가 PEL부터 다시 읽는다)
    let judged: Judgment;
    try {
      const out = await this.d.handlers.apply(env, { ledger: true });
      const result: BizResultBody = {
        status: 'APPLIED',
        actor: env.actor,
        httpStatus: out.httpStatus,
        body: out.body,
      };
      judged = { ...base, result, duplicate: false, trace: out.trace };
    } catch (e) {
      const trace = bizTraceOf(e);
      if (e instanceof BizLedgerConflict) {
        // 겹친 워커가 같은 cmdId를 먼저 커밋했다 — 롤백됐고 저장된 판정을 낸다
        judged = await this.stored(key, base, trace);
      } else if (e instanceof ApiError && !isPgDown(e)) {
        // 도메인 오류 — 롤백 뒤 별도 트랜잭션으로 REJECTED 행(같은 cmdId는 첫 판정에 고정)
        const rejected: BizResultBody = {
          status: 'REJECTED',
          actor: env.actor,
          httpStatus: e.status,
          error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) },
        };
        judged = await this.judge(key, 'REJECTED', rejected, base, trace);
      } else {
        if (!isPgDown(e))
          this.d.log.error(`명령 적용 결함 ${env.kind} ${env.cmdId} — ${(e as Error).message}`);
        judged = { ...base, result: failedResult(env.actor), duplicate: false, trace };
      }
    }
    await this.finish(judged, id);
  }

  /** 거절 · 만료 판정을 원장에 남긴다 — 충돌이면 저장된 판정 · PostgreSQL 불가면 거절은 결과 키에만 · 만료는 FAILED */
  private async judge(
    key: LedgerKey,
    status: 'REJECTED' | 'EXPIRED',
    result: BizResultBody,
    base: Omit<Judgment, 'result' | 'duplicate' | 'trace'>,
    trace: BizApplyTrace,
  ): Promise<Judgment> {
    try {
      const r = await this.d.ledger.record(key, status, result);
      if (r === 'conflict') return this.stored(key, base, trace);
      return { ...base, result, duplicate: false, trace };
    } catch {
      // 거절 판정은 원장 없이 결과 키에만 — 결과 키가 TTL(300초) 동안 이 첫 판정을 돌려주고, 만료 뒤 같은 키 재요청만
      // 적용을 다시 시도해 판정을 새로 계산한다(원장 행이 없어 이중 적용은 없다) · 만료는 원장 없이 확정하지 않는다
      return status === 'REJECTED'
        ? { ...base, result, duplicate: false, trace }
        : { ...base, result: failedResult(key.actor), duplicate: false, trace };
    }
  }

  /** 원장에 이미 있는 판정 — 재적용 없이 다시 낸다 */
  private async stored(
    key: LedgerKey,
    base: Omit<Judgment, 'result' | 'duplicate' | 'trace'>,
    trace: BizApplyTrace,
  ): Promise<Judgment> {
    try {
      const row = await this.d.ledger.find(key.cmdId);
      if (row) return { ...base, result: row.result, duplicate: true, trace: { ...trace, txMs: null } };
    } catch {
      // 아래 FAILED
    }
    return { ...base, result: failedResult(key.actor), duplicate: false, trace };
  }

  /**
   * 봉투 해독 — cmdId를 읽을 수 없으면 결과를 낼 곳이 없어 XACK만 한다(null).
   * cmdId는 있는데 봉투가 계약을 어기면(모르는 kind 등) REJECTED(validation) — 적용 서비스를 고를 수 없다.
   */
  private decode(id: string, value: string | null): BizCommandEnvelopeBody | { rejected: Judgment } | null {
    let raw: unknown;
    try {
      raw = value === null ? null : JSON.parse(value);
    } catch {
      raw = null;
    }
    const parsed = BizCommandEnvelope.safeParse(raw);
    if (parsed.success) return parsed.data;
    const r = raw as { cmdId?: unknown; kind?: unknown; actor?: unknown } | null;
    const cmd = BizCommandEnvelope.shape.cmdId.safeParse(r?.cmdId);
    if (!cmd.success) {
      this.d.log.warn(`명령 엔트리 ${id} — cmdId를 읽을 수 없어 결과 없이 XACK한다`);
      return null;
    }
    const actor = typeof r?.actor === 'number' && Number.isInteger(r.actor) ? r.actor : null;
    return {
      rejected: {
        cmdId: cmd.data,
        kind: typeof r?.kind === 'string' ? r.kind : 'unknown',
        result: {
          status: 'REJECTED',
          actor,
          httpStatus: 400,
          error: {
            code: 'common.validation_failed',
            message: '명령 봉투가 계약을 어긴다',
            details: { fields: [{ path: 'kind', reason: 'enum' }] },
          },
        },
        duplicate: false,
        queueWaitMs: null,
        trace: noTrace(),
      },
    };
  }

  /** ⑦ 결과 SET → ch:bizreply → XACK → 메트릭 → 흐름 요약(결과 알림 뒤) */
  private async finish(j: Judgment, id: string): Promise<void> {
    const t0 = performance.now();
    // 결과 SET · 알림 실패는 삼킨다(래퍼가 계수) — api는 대기 상한 뒤 202 · 명령 조회는 원장으로 간다
    await this.d.results.set(j.cmdId, JSON.stringify(j.result), BIZ_RESULT_TTL_S);
    await this.d.reply(j.cmdId);
    const replyMs = performance.now() - t0;
    await this.d.stream.ack(id);

    // 닫힌 레이블 집합 — 봉투가 계약을 어긴 kind는 계수하지 않는다(로그 · 흐름 요약에는 남는다)
    if (BIZ_KIND_SET.has(j.kind)) {
      bizMetrics.commands.inc({ kind: j.kind, result: j.result.status.toLowerCase() });
      if (j.duplicate) bizMetrics.duplicates.inc({ kind: j.kind });
      if (j.trace.txMs !== null && !j.duplicate)
        bizMetrics.apply.observe({ kind: j.kind }, j.trace.txMs / 1000);
    }

    if (this.d.flow.enabled()) {
      this.d.flow.publishBiz({
        role: 'biz-writer',
        cmdId: j.cmdId,
        kind: j.kind,
        result: flowResultOf(j.result),
        duplicate: j.duplicate,
        stages: {
          queueWaitMs: j.queueWaitMs,
          txMs: j.duplicate ? null : j.trace.txMs,
          invalidateMs: j.duplicate ? null : j.trace.invalidateMs,
          replyMs,
        },
        invalidatedKeys: j.duplicate ? 0 : j.trace.invalidatedKeys,
        cacheinv: j.duplicate ? false : j.trace.cacheinv,
      });
    }
  }
}

/** Nest 수명 — 워커 역할(worker · all)에서만 뜬다(BizWorkerModule) */
@Injectable()
export class BizWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger('BizWorker');
  private runner: BizCommandRunner | null = null;

  constructor(
    private readonly conns: RedisConnections,
    private readonly cache: CacheKeyClient,
    private readonly durable: DurableKeyClient,
    private readonly fanout: FanoutPublisher,
    private readonly flow: FlowPublisher,
    private readonly ledger: BizLedger,
    @Inject(BIZ_HANDLERS) private readonly handlers: BizHandlers,
  ) {}

  async onApplicationBootstrap() {
    await this.conns.ready();
    const conn = this.conns.blockingConnection(`${BIZ_CONSUMER}-consumer`);
    const instance = randomUUID();
    this.runner = new BizCommandRunner({
      token: instance,
      handlers: this.handlers,
      ledger: this.ledger,
      results: { set: (cmdId, json, ttl) => this.cache.setBizResult(cmdId, json, ttl) },
      lock: {
        acquire: (token, ttl) => this.cache.acquireBizWriterLock(token, ttl),
        renew: (token, ttl) => this.cache.renewBizWriterLock(token, ttl),
        release: (token) => this.cache.releaseBizWriterLock(token),
      },
      stream: {
        // 시작 ID 0 · MKSTREAM — $로 두면 그룹 생성 전에 api가 실은 명령을 영영 읽지 않는다
        ensureGroup: () => this.durable.ensureGroup(BIZ_STREAM, BIZ_GROUP),
        read: (fromId, count, blockMs) =>
          this.durable.readGroupText(
            conn,
            BIZ_STREAM,
            BIZ_GROUP,
            BIZ_CONSUMER,
            BIZ_ENTRY_FIELD,
            count,
            blockMs,
            fromId,
          ),
        ack: async (id) => {
          await this.durable.ack(BIZ_STREAM, BIZ_GROUP, [id]);
        },
        backlog: () => this.durable.groupBacklog(BIZ_STREAM, BIZ_GROUP),
      },
      reply: (cmdId) => this.fanout.publishBizReply(cmdId),
      flow: this.flow,
      now: () => Date.now(),
      log: {
        log: (s) => this.log.log(`${s} · 인스턴스 ${instance}`),
        warn: (s) => this.log.warn(s),
        error: (s) => this.log.error(s),
      },
    });
    this.runner.start();
  }

  async beforeApplicationShutdown() {
    await this.runner?.stop();
  }
}
