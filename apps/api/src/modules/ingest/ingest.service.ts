// F-02 적재 — 기전 정본 docs/06_pipeline/03_ingest_batch.md(ADR-09: 읽기와 삽입을 가른다)
// ① 기동: XGROUP CREATE MKSTREAM · rt:latest 기동 복원 · 회수 타이머 ② 소비: 컨슈머 N XREADGROUP ③ 디코딩: piscina 워커 · 해독 불가 즉시 격리
// ④ fan-in: 창 버퍼 ⑤ 배치 확정: 창 정렬 · R · P 분할 · 결정적 토큰 ⑥ 삽입 ⑦ 실패: 같은 토큰 백오프 → DLQ → XACK
// ⑧ 성공 후속: 대조군 COPY(SW-09) → XACK → 최신값(SW-11) ⑨ 회수: XAUTOCLAIM 주기 타이머 → ④
// S3 범위(ING-02 · 04 · 05 · 06 · 07 · 11 · 12): 배치 안 A · B · C · SW-08 · SW-09 · SW-11(ingest) · 결함 주입.
// 범위 밖: 소진 모드 · 백프레셔 단계 반응(ING-13 · S6) · 판정 인계(ING-09 · S7).
// 중복 제거로 무시된 성공(ing_dedup_ignored_batches_total)은 세지 않는다 — 판별 수단은 쿼리 로그 ProfileEvents DuplicatedInsertedBlocks이고
// (05_data_stores/03 §중복 제거 B형) insert 응답 요약 헤더(X-ClickHouse-Summary)는 read · written 행 · 바이트 · 경과 시간만 싣는다.
// written_rows는 중복 제거된 재시도에서도 첫 시도와 같아(S0 기록 001) 판별에 못 쓴다 — 삽입 경로에서 쿼리 로그를 읽지 않는다(S3 판정).
import { STREAM_DLQ } from '@db-study/shared';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { RedisConnections } from '../../common/redis/connections';
import { type DlqItem, DurableKeyClient, type StreamRecord } from '../../common/redis/durable-key-client';
import type { DecodeResult } from '../../common/workers/tasks';
import { WorkerPool } from '../../common/workers/worker-pool';
import { type AppConfig, INGEST_BATCH_PLANS, type IngestBatchParams } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { BATCH_TOKEN_PORT, type BatchTokenPort } from './batch-token.port';
import { CONTROL_TABLE_SINK_PORT, type ControlTableSinkPort } from './control-table-sink.port';
import { Flusher } from './flusher';
import { ingestMetrics as m } from './ingest.metrics';
import { createLabFault } from './lab-fault';
import { LATEST_VALUE_WRITE_PORT, type LatestValueWritePort } from './latest-value-write.port';
import {
  type BatchEntry,
  idMsOf,
  type Piece,
  TAG_RAW_COLUMNS,
  WINDOW_GRACE_MS,
  WindowBuffer,
} from './window-buffer';

export const STREAM_RAW = 'stream:plc:raw';
export const GROUP_INGEST = 'grp:ingest';
/**
 * 컨슈머 이름 ingest-1..N 고정(리드 판정 — ING-07의 ingest-{pid}-{n} 대신). 재기동 뒤 같은 이름이 자기 PEL을 ID 0부터 먼저 읽어 회수한다.
 * pid를 넣으면 컨테이너를 다시 만들 때마다 이름이 바뀌어 이전 이름의 PEL이 XAUTOCLAIM(idle 60초) 전까지 남는다.
 */
export function consumerNames(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `ingest-${i + 1}`);
}
/** 종료 드레인 상한 — 컨테이너 정지 유예(compose stop -t)보다 작게 */
const SHUTDOWN_DRAIN_MS = 5000;
/** XREADGROUP COUNT 현행 참고 100(06_pipeline/03 §소진 모드 표의 정상 열) */
export const READ_COUNT = 100;
/** BLOCK — 저부하 창 닫힘(ⓑ)이 늦지 않게 창 폭보다 짧게 둔다(S2 판정 · 조정값 아님) */
const READ_BLOCK_MS = 200;
/** 회수 주기 현행 참고 30초 · idle 기준 현행 참고 60초(값 정본 06_pipeline/03 §회수 — XAUTOCLAIM 주기 · ING-06) */
export const RECLAIM_INTERVAL_MS = 30_000;
export const RECLAIM_MIN_IDLE_MS = 60_000;
/** XAUTOCLAIM COUNT — 정본에 값이 없다 · S3 판정: 읽기 COUNT와 같은 100(한 쪽의 디코딩 · 창 버퍼 부담이 읽기 한 번과 같다) */
const RECLAIM_COUNT = 100;
/** stream:plc:dlq MAXLEN ~ — 값 정본 05_data_stores/06_redis_memory.md §maxmemory 산정(DLQ MAXLEN 10000 · 세 프로파일 같음) */
export const DLQ_MAXLEN = 10_000;
/** consumer_lag 갱신 주기 — S2 판정 1초(스크레이프 때 저장소를 조회하지 않는다 · 07_api/10 #2) */
const LAG_POLL_MS = 1000;
/** 기동 복원 창 — 빈 키 복원과 같은 값 · 현행 참고 10분(소유 06_pipeline/05 §기동 복원과 복원 창) */
export const RESTORE_WINDOW_MINUTES = 10;
/** 컨슈머 루프 예외 뒤 재기동 간격 — 모듈 재시도 루프(구성 요소 표 · S3 판정 1초) */
const CONSUMER_RESTART_MS = 1000;

/**
 * flusher 보유 상한(06_pipeline/03 §행 수 상한과 flusher 메모리) — 자리별 최대 배치 수.
 * 합계 4 × R × 행당 메모리가 flusher 메모리 상한이다. 판정 인계 슬롯 · 판정 중은 판정기(ALM · S7)가 들어올 때 센다 —
 * S3에서 컨슈머 정지 조건은 창 버퍼(조립 중 · 닫혀 대기) + 삽입 중 = 2칸이다(S2는 조립 중을 세지 않았다 · 06_pipeline/03 미확인 등재).
 */
export const FLUSHER_HOLD_SLOTS = { windowBuffer: 1, inserting: 1, handoffSlot: 1, judging: 1 } as const;
export const FLUSHER_ACTIVE_SLOTS = FLUSHER_HOLD_SLOTS.windowBuffer + FLUSHER_HOLD_SLOTS.inserting;

/**
 * 창 버퍼 칸의 배치 셈 — 닫혀 대기 조각 수 + 조립 중 행 ÷ R(내림). 조립 중이 R에 못 미치면 0칸이다:
 * 확정 접두는 창이 닫히기 전에도 조각으로 나가므로(창 버퍼 §takePieces) 조립 중은 대개 조각 하나 미만이다.
 */
export function heldBatches(
  queued: number,
  assemblingRows: number,
  maxRows: number,
  inserting: number,
): number {
  return queued + Math.floor(assemblingRows / maxRows) + inserting;
}

interface ConsumerLoop {
  name: string;
  conn: Redis | null;
  /** 기동 시 자기 PEL부터 다시 읽는다(ID 0) — null이면 새 엔트리만 */
  pendingCursor: string | null;
  alive: boolean;
  loop: Promise<void> | null;
}

@Injectable()
export class IngestService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly log = new Logger('IngestService');
  private readonly params: IngestBatchParams;
  private readonly consumers: ConsumerLoop[];
  private readonly buffer: WindowBuffer;
  private readonly flusher: Flusher;
  private readonly queue: Piece[] = [];
  /** 프로세스가 쥔 엔트리 ID(창 버퍼 · 대기 · 삽입 중) — 회수 · PEL 재읽기가 같은 엔트리를 두 번 인계하지 않게 한다 */
  private readonly held = new Set<string>();
  private running = false;
  private stopping = false;
  /** 종료 중 남은 창을 큐에 다 넣었다 — flusher는 큐가 빌 때까지 돌고 끝난다 */
  private drained = false;
  private flushLoop: Promise<void> | null = null;
  private flushing = 0;
  private wakeFlusher: (() => void) | null = null;
  private lagTimer: NodeJS.Timeout | null = null;
  private reclaimTimer: NodeJS.Timeout | null = null;
  private reclaiming: Promise<void> | null = null;
  private reclaimTurn = 0;
  private lastLag = 0;
  private pausedSince: number | null = null;

  constructor(
    @Inject(APP_CONFIG) cfg: AppConfig,
    private readonly conns: RedisConnections,
    private readonly durable: DurableKeyClient,
    private readonly ch: ClickHouse,
    private readonly workers: WorkerPool,
    @Inject(BATCH_TOKEN_PORT) tokens: BatchTokenPort,
    @Inject(CONTROL_TABLE_SINK_PORT) private readonly control: ControlTableSinkPort,
    @Inject(LATEST_VALUE_WRITE_PORT) latest: LatestValueWritePort,
  ) {
    this.params = INGEST_BATCH_PLANS[cfg.ingestBatchPlan];
    const names = consumerNames(this.params.consumers);
    this.consumers = names.map((name) => ({
      name,
      conn: null,
      pendingCursor: '0',
      alive: false,
      loop: null,
    }));
    this.buffer = new WindowBuffer({
      windowMs: this.params.windowMs,
      graceMs: WINDOW_GRACE_MS,
      limits: { maxRows: this.params.maxRows, maxBytes: this.params.maxPayloadBytes },
      consumers: names,
    });
    this.flusher = new Flusher({
      insert: async (rows, settings) => {
        await this.ch.client.insert({
          table: 'tag_raw',
          values: rows,
          format: 'JSONCompactEachRow',
          columns: [...TAG_RAW_COLUMNS] as [string, ...string[]],
          clickhouse_settings: settings,
        });
      },
      tokens,
      asyncInsert: this.params.asyncInsert,
      control,
      ack: async (ids) => {
        await this.durable.ack(STREAM_RAW, GROUP_INGEST, ids);
      },
      dlq: (items) => this.durable.appendDlq(STREAM_DLQ, items, DLQ_MAXLEN),
      latest,
      labFault: createLabFault(cfg.ingestLabFault),
      sleep,
      stopping: () => this.stopping,
      log: { warn: (s) => this.log.warn(s), error: (s) => this.log.error(s) },
    });
  }

  async onApplicationBootstrap() {
    await this.conns.ready();
    await this.durable.ensureGroup(STREAM_RAW, GROUP_INGEST);
    await this.restoreLatest();
    this.running = true;
    for (const c of this.consumers) {
      c.conn = this.conns.blockingConnection(`${c.name}-consumer`);
      c.alive = true;
      c.loop = this.runConsumer(c);
    }
    this.flushLoop = this.flush();
    this.lagTimer = setInterval(() => void this.pollLag(), LAG_POLL_MS);
    this.reclaimTimer = setInterval(() => void this.reclaim(), RECLAIM_INTERVAL_MS);
    const p = this.params;
    this.log.log(
      `컨슈머 ${this.consumers.map((c) => c.name).join(' · ')} 기동 — ${STREAM_RAW} · ${GROUP_INGEST} · ` +
        `배치 안 ${p.plan}(W ${p.windowMs} ms · R ${p.maxRows} · P ${p.maxPayloadBytes} B · async_insert ${p.asyncInsert ? 1 : 0})`,
    );
  }

  /**
   * 종료: 읽기 · 회수를 멈추고 남은 창을 전부 닫아 삽입 · XACK까지 끝낸다 — 받은 엔트리를 PEL에 남기지 않는다.
   * Nest 종료 순서는 onModuleDestroy → beforeApplicationShutdown → onApplicationShutdown이다 — 드레인은 가운데서 하고
   * 저장소 연결 · 워커 풀은 마지막(onApplicationShutdown)에 닫힌다. 수집(Collector)은 onModuleDestroy에서 먼저 멈춘다.
   */
  async beforeApplicationShutdown() {
    this.running = false;
    this.stopping = true;
    if (this.lagTimer) clearInterval(this.lagTimer);
    if (this.reclaimTimer) clearInterval(this.reclaimTimer);
    await this.reclaiming;
    await Promise.all(this.consumers.map((c) => c.loop));
    // 마지막 읽기 뒤에 XADD된 엔트리까지 받는다 — 수집은 이미 멈췄으므로 빈 응답이 나올 때까지 읽으면 lag가 0이 된다
    // (상한 SHUTDOWN_DRAIN_MS — 다른 프로세스가 계속 발행하는 구성에서 종료가 끝나지 않는 것을 막는다)
    const first = this.consumers[0];
    const until = Date.now() + SHUTDOWN_DRAIN_MS;
    while (first && Date.now() < until) {
      const n = await this.step(first, 1);
      if (n === 0) break;
    }
    this.enqueue(this.buffer.drainPieces());
    this.drained = true;
    this.wakeFlusher?.();
    await this.flushLoop;
    this.updatePause(false);
    await this.control.close();
  }

  /** 창 버퍼 칸 + 삽입 중이 차면 컨슈머 · 회수가 읽기를 멈춘다 — 적체를 프로세스 메모리가 아니라 Stream(lag)에 둔다 */
  private full(): boolean {
    const n = heldBatches(this.queue.length, this.buffer.assemblingRows, this.params.maxRows, this.flushing);
    const isFull = n >= FLUSHER_ACTIVE_SLOTS;
    this.updatePause(isFull);
    return isFull;
  }

  /** 정지 시간은 벽시계로 한 번만 센다 — 컨슈머 N이 함께 멈춰도 N배로 세지 않는다 */
  private updatePause(isFull: boolean): void {
    const now = performance.now();
    if (isFull && this.pausedSince === null) this.pausedSince = now;
    else if (!isFull && this.pausedSince !== null) {
      m.consumerPaused.inc((now - this.pausedSince) / 1000);
      this.pausedSince = null;
    }
  }

  /** ② ③ ④ — 컨슈머 하나의 루프. 삽입을 모른다 · 예외는 모듈 재시도 루프로 재기동 */
  private async runConsumer(c: ConsumerLoop): Promise<void> {
    while (this.running) {
      try {
        // PEL 재읽기 중인 컨슈머는 보유 상한에서도 멈추지 않는다 — 대기로 두면 하한이 전체 최댓값이 되어
        // 남은 옛 PEL 엔트리보다 먼저 옛 창이 닫히고, 재전달 조각의 경계 · 토큰이 크래시 전과 달라진다(검수 D1).
        // PEL은 이미 배달된 엔트리라 크기가 유계다(이전 프로세스의 in-flight 분량).
        if (this.full() && c.pendingCursor === null) {
          // 대기 — 쥔 엔트리가 없으니 따라잡은 것으로 본다(창 닫힘 ⓐ) · 확정 접두를 내보내 flusher가 비면 풀린다
          this.buffer.setIdle(c.name, true);
          this.collect();
          await sleep(20);
          continue;
        }
        this.buffer.setIdle(c.name, false);
        await this.step(c, READ_BLOCK_MS);
      } catch (e) {
        c.alive = false;
        this.log.error(
          `컨슈머 ${c.name} 예외 — ${(e as Error).message} · ${CONSUMER_RESTART_MS} ms 뒤 재기동`,
        );
        await sleep(CONSUMER_RESTART_MS);
        c.alive = true;
      }
    }
    this.buffer.setIdle(c.name, true);
  }

  /** 읽기 한 번 — 받은 엔트리 수(PEL 끝 · 읽기 실패는 -1) */
  private async step(c: ConsumerLoop, blockMs: number): Promise<number> {
    let records: StreamRecord[] = [];
    const readStartAt = Date.now();
    const late = this.buffer.lateEntries;
    const fromPel = c.pendingCursor !== null;
    try {
      records = await this.durable.readGroup(
        c.conn as Redis,
        STREAM_RAW,
        GROUP_INGEST,
        c.name,
        READ_COUNT,
        blockMs,
        c.pendingCursor ?? '>',
      );
    } catch (e) {
      this.log.warn(`XREADGROUP 실패(${c.name}) — ${(e as Error).message} · 재시도`);
      await sleep(500);
      return -1;
    }
    if (fromPel) {
      if (records.length === 0) {
        c.pendingCursor = null;
        return -1;
      }
      c.pendingCursor = records[records.length - 1]?.id ?? null;
      this.log.warn(
        `PEL 회수(${c.name}) — 이전 종료가 남긴 미확인 엔트리 ${records.length}건을 다시 처리한다`,
      );
    }
    const receivedAt = Date.now();
    if (records.length > 0) {
      for (const r of records) m.residence.observe(Math.max(0, receivedAt - idMsOf(r.id)) / 1000);
      await this.handOff(
        records,
        receivedAt,
        (e) => this.buffer.add(e, c.name),
        (idMs) => this.buffer.advance(idMs, c.name),
      );
    }
    // COUNT 미만의 '>' 응답 = 읽기가 서버에 닿은 순간의 꼬리까지 가져갔다 — 인계 뒤에 표시한다(ⓑ의 시계 = 읽기 시작 시각)
    if (!fromPel && records.length < READ_COUNT) this.buffer.markDrained(c.name, readStartAt);
    if (this.buffer.lateEntries > late)
      this.log.warn(`닫힌 창 뒤 도착 엔트리 누계 ${this.buffer.lateEntries} — 다음 창으로 넘겼다`);
    this.collect();
    return records.length;
  }

  /** ③ 디코딩 · ④ 인계 — 해독 불가는 즉시 DLQ(토큰 없음) → XACK. 이미 쥔 엔트리(회수 · PEL 재읽기 중복)는 건너뛴다 */
  private async handOff(
    records: StreamRecord[],
    receivedAt: number,
    add: (e: BatchEntry) => void,
    advance: (idMs: number) => void,
  ): Promise<void> {
    const fresh = records.filter((r) => !this.held.has(r.id));
    for (const r of records) if (this.held.has(r.id)) advance(idMsOf(r.id));
    if (fresh.length === 0) return;
    const decoded = await this.workers.run<DecodeResult>({ payloads: fresh.map((r) => r.payload) }, 'decode');
    const decodedAt = Date.now();
    m.decode.observe((decodedAt - receivedAt) / 1000);
    const undecodable: DlqItem[] = [];
    fresh.forEach((r, i) => {
      const idMs = idMsOf(r.id);
      const d = decoded.entries[i];
      if (d?.ok) {
        if (d.negativeDt > 0) m.negativeDt.inc(d.negativeDt);
        this.held.add(r.id);
        add({ id: r.id, idMs, decodedAt, entry: d, payload: r.payload });
      } else {
        advance(idMs);
        undecodable.push({ payload: r.payload, originId: r.id, reason: 'undecodable', batchToken: null });
        this.log.error(`해독 불가 엔트리 ${r.id} — ${d && !d.ok ? d.reason : 'unknown'} · DLQ로 격리한다`);
      }
    });
    if (undecodable.length > 0) await this.quarantineUndecodable(undecodable);
  }

  /** 해독 불가 — 재시도하지 않고 즉시 격리 · 그 엔트리만 XACK(06_pipeline/03 §재시도 · 격리 · DLQ) */
  private async quarantineUndecodable(items: DlqItem[]): Promise<void> {
    try {
      await this.durable.appendDlq(STREAM_DLQ, items, DLQ_MAXLEN);
    } catch (e) {
      this.log.error(
        `DLQ 쓰기 실패 — ${(e as Error).message} · 해독 불가 ${items.length}건을 PEL에 남긴다(회수가 다시 시도)`,
      );
      return;
    }
    try {
      await this.durable.ack(
        STREAM_RAW,
        GROUP_INGEST,
        items.map((i) => i.originId),
      );
      m.dlqCount.inc({ reason: 'undecodable' }, items.length);
    } catch (e) {
      this.log.error(`XACK 실패(해독 불가) — ${(e as Error).message} · DLQ 사본은 남았다`);
    }
  }

  /** ⑤ 확정된 조각을 flusher 큐로 */
  private collect(): void {
    this.enqueue(this.buffer.takePieces());
  }

  private enqueue(pieces: Piece[]): void {
    if (pieces.length === 0) return;
    this.queue.push(...pieces);
    this.wakeFlusher?.();
  }

  /**
   * ⑨ 회수 — 주기 타이머(재시작 감지가 아니다 · W1 판정). 인수자는 살아 있는 컨슈머 하나를 주기마다 순번으로 고른다.
   * 인수분은 일반 인계와 같이 창 버퍼로 가고, 회수 창은 회수 커서가 창 끝을 지나야 닫힌다.
   */
  private reclaim(): Promise<void> {
    if (this.reclaiming || !this.running) return this.reclaiming ?? Promise.resolve();
    this.reclaiming = this.reclaimScan().finally(() => {
      this.reclaiming = null;
    });
    return this.reclaiming;
  }

  private async reclaimScan(): Promise<void> {
    const alive = this.consumers.filter((c) => c.alive);
    if (alive.length === 0) return;
    const claimer = alive[this.reclaimTurn++ % alive.length] as ConsumerLoop;
    let cursor = '0-0';
    let claimed = 0;
    this.buffer.setReclaimCursor(0);
    try {
      do {
        while (this.running && this.full()) await sleep(20);
        if (!this.running) break;
        const r = await this.durable.autoClaim(
          STREAM_RAW,
          GROUP_INGEST,
          claimer.name,
          RECLAIM_MIN_IDLE_MS,
          cursor,
          RECLAIM_COUNT,
        );
        if (r.deleted.length > 0) {
          this.log.error(
            `회수 — PEL에 있으나 Stream에서 이미 지워진 엔트리 ${r.deleted.length}건(미확인분 트리밍)`,
          );
        }
        const fresh = r.records.filter((x) => !this.held.has(x.id));
        if (fresh.length > 0) {
          await this.handOff(
            fresh,
            Date.now(),
            (e) => this.buffer.addRecovered(e),
            () => {},
          );
          m.xautoclaimClaimed.inc(fresh.length);
          claimed += fresh.length;
        }
        cursor = r.next;
        this.buffer.setReclaimCursor(cursor === '0-0' ? null : idMsOf(cursor));
        this.collect();
      } while (cursor !== '0-0');
    } catch (e) {
      // 커서는 그대로 둔다 — 회수 창은 다음 스캔의 커서가 창 끝을 지날 때 닫힌다
      this.log.warn(`XAUTOCLAIM 실패 — ${(e as Error).message} · 다음 주기에 다시`);
    }
    if (!this.running && cursor !== '0-0') {
      // 종료로 스캔이 끊겼다 — 일부만 회수된 창을 닫지 않고 PEL에 남긴다(재기동 뒤 인수자가 자기 PEL을 다시 읽는다)
      for (const id of this.buffer.discardRecovered()) this.held.delete(id);
    }
    if (claimed > 0)
      this.log.warn(`회수(${claimer.name}) — idle ${RECLAIM_MIN_IDLE_MS} ms 초과 PEL ${claimed}건 인수`);
  }

  /** ⑥~⑧ — 단일 flusher: 조각 순서대로 삽입 · 재시도 · 격리 · 대조군 · XACK · 최신값 */
  private async flush(): Promise<void> {
    while (!this.drained || this.queue.length > 0) {
      const piece = this.queue.shift();
      if (!piece) {
        await new Promise<void>((r) => {
          this.wakeFlusher = r;
          setTimeout(r, 200);
        });
        continue;
      }
      this.flushing = 1;
      const startAt = Date.now();
      for (const e of piece.entries) m.fanin.observe(Math.max(0, startAt - e.decodedAt) / 1000);
      try {
        await this.flusher.process(piece);
      } catch (e) {
        // 최신값 등 후속 단계의 예기치 않은 예외 — 조각을 잃지 않는다(XACK 전이면 PEL에 남는다)
        this.log.error(`flusher 예외 — ${(e as Error).message}`);
      } finally {
        // 어떤 결말이든 프로세스는 이 엔트리를 더 쥐지 않는다 — XACK되지 않은 것은 회수가 다시 가져간다
        for (const e of piece.entries) this.held.delete(e.id);
        this.flushing = 0;
      }
    }
  }

  /** 기동 복원 — 최근 창 argMax 1회 · 조건부 쓰기라 보존된 새 값을 덮지 않는다(06_pipeline/05 §기동 복원과 복원 창) */
  private async restoreLatest(): Promise<void> {
    try {
      const rs = await this.ch.client.query({
        query: `SELECT device_id, tag_id, toUnixTimestamp64Milli(max(ts)) AS ts_ms,
                       argMax(value, ts) AS last_value, argMax(quality, ts) AS last_quality
                  FROM plc.tag_raw
                 WHERE ts >= now64(3) - INTERVAL {minutes:UInt32} MINUTE
                 GROUP BY device_id, tag_id`,
        query_params: { minutes: RESTORE_WINDOW_MINUTES },
        format: 'JSONEachRow',
      });
      const rows = await rs.json<{
        device_id: number;
        tag_id: number;
        ts_ms: string;
        last_value: number;
        last_quality: number;
      }>();
      const byDevice = new Map<number, [number, number, number, number][]>();
      for (const r of rows) {
        const list = byDevice.get(Number(r.device_id)) ?? [];
        list.push([Number(r.tag_id), Number(r.ts_ms), Number(r.last_value), Number(r.last_quality)]);
        byDevice.set(Number(r.device_id), list);
      }
      for (const [d, tuples] of byDevice) await this.durable.writeLatestIfNewer(d, tuples);
      this.log.log(
        `기동 복원 — 설비 ${byDevice.size} · 태그 ${rows.length}(최근 ${RESTORE_WINDOW_MINUTES}분)`,
      );
    } catch (e) {
      // 복원 실패는 기동을 막지 않는다 — 다음 적재가 최신값을 채운다
      this.log.warn(`기동 복원 실패 — ${(e as Error).message}`);
    }
  }

  /** consumer_lag = lag + pending(01_metrics §컨슈머 랙 판정) · lag가 비면 직전 값 유지 + unknown 1 */
  private async pollLag(): Promise<void> {
    try {
      const b = await this.durable.groupBacklog(STREAM_RAW, GROUP_INGEST);
      if (!b) return;
      m.groupPending.set(b.pending);
      if (b.lag === null) {
        m.lagUnknown.set(1);
        m.consumerLag.set(this.lastLag);
        return;
      }
      m.lagUnknown.set(0);
      m.groupLag.set(b.lag);
      this.lastLag = b.lag + b.pending;
      m.consumerLag.set(this.lastLag);
    } catch {
      // Redis 불가 — 게이지는 마지막 값을 유지한다
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
