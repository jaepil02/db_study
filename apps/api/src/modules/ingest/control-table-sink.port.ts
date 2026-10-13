// SW-09 CONTROL_TABLE_ENABLED — ControlTableSinkPort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// 기전 정본 docs/06_pipeline/04_routing.md §대조군 동시 적재 기전 · 저장소 계약 docs/05_data_stores/10_olap_vs_rdb_control.md §SW-09 동시 적재
// ② ClickHouse 삽입 성공 뒤 ③ COPY(삽입 재시도 루프 밖) → ④ XACK(③의 성패와 무관) → ⑤ 최신값.
// 입력은 ②에 보낸 것과 같은 행 배열 · 전용 커넥션 1(업무 풀 밖 · 끊기면 다음 시도가 새로 연다).
// 다시 보내기(사용자 결정 2026-10-12 — 5억 넣기에서 COPY 시간 초과로 두 배치 99,988행이 PostgreSQL에서 빠졌다):
// 첫 시도가 결과를 모르는 실패(시간 초과 · 연결 오류)면 같은 배치를 새 커넥션으로 다시 보낸다. 시간 초과는 기다리기를 그만둔 것이라
// 앞 시도가 서버에서 들어갔을 수 있다(그때 7번 중 5번) — 다시 보낸 COPY가 기본 키 충돌(23505)이면 배치의 키가 모두 있는지 세어
// 다 있으면 "이미 들어감"으로 친다. COPY는 한 문장 = 한 트랜잭션이라 두 시도 중 하나만 배치를 넣는다(앞 시도가 아직 돌면 같은 키의
// 잠금을 기다렸다가 그 결과대로 충돌하거나 들어간다). 데이터 규칙 위반(22 · 23 계열)은 다시 보내도 같으니 바로 실패다.
// SW-09 값 3(D-16): off NoopControlSink · on 배치마다 COPY · gated 같은 PostgresControlSink를 Redis 게이트(cache:dual:active)가
// 있을 때만 부른다 — 직접 비교 실행(runs compare)이 게이트를 켜 둔 동안만 PostgreSQL이 센서 사본을 받는다.
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { ingestMetrics as m } from './ingest.metrics';
import type { TagRawRow } from './window-buffer';

export const CONTROL_TABLE_SINK_PORT = Symbol('ControlTableSinkPort');

/**
 * COPY 타임아웃 — 관계 계약 "COPY 타임아웃 + ClickHouse 삽입 p95 < 창 폭 W"(10_observability/06 §대조 실험 조정값 · 04_routing).
 * COPY가 flusher 안 XACK 전에 돌므로 관계 밖 값이면 동시 적재 중 fan-in 대기가 COPY만큼 늘어 목표 ② 수치에 섞인다.
 * S3 판정: 창 폭의 절반 — 나머지 절반을 삽입 p95의 몫으로 둔다(배치 안 A · C 500 ms · B 2,500 ms). 넘으면 실패로 센다.
 */
export function controlCopyTimeoutMs(windowMs: number): number {
  return Math.floor(windowMs / 2);
}

/** 대조군 COPY 대상 — 열 이름으로 싣는다(DDL 선언 순서는 정렬 여백 0 배치라 tag_raw와 다르다 · ingested_at은 DEFAULT) */
export const CONTROL_COPY_SQL =
  'COPY plc_tag_raw_control (ts, device_id, tag_id, value, quality, scan_seq) FROM STDIN';

export interface ControlBatchInfo {
  /** 실패 기록의 토큰 — SW-08 off면 null */
  token: string | null;
}

export interface ControlTableSinkPort {
  readonly implName: 'PostgresControlSink' | 'NoopControlSink';
  /**
   * 결과를 모르는 실패만 다시 보낸다(CONTROL_COPY_RETRY) · 던지지 않는다 — 실패는 계수 + 구간 로그로 남기고 false(흐름 요약 controlCopy.ok) · XACK는 계속된다(REQ-ING-15).
   * null은 싣지 않았다는 뜻이다(gated에서 게이트가 닫힘) — 흐름 요약은 실제로 COPY한 배치에만 controlCopy를 싣는다.
   */
  copy(rows: readonly TagRawRow[], info: ControlBatchInfo): Promise<boolean | null>;
  close(): Promise<void>;
}

export class NoopControlSink implements ControlTableSinkPort {
  readonly implName = 'NoopControlSink' as const;
  async copy(): Promise<boolean> {
    return true;
  }
  async close(): Promise<void> {}
}

/** COPY 텍스트 형식 한 줄 — ts는 epoch ms를 UTC ISO로(timestamptz가 ms를 정확히 담는다) */
export function copyLine(r: TagRawRow): string {
  return `${new Date(r[0]).toISOString()}\t${r[1]}\t${r[2]}\t${r[3]}\t${r[4]}\t${r[5]}\n`;
}

/** 스트림 조각 크기 — 행마다 write하면 50,000행 배치가 50,000번 쓰기가 된다(S3 판정 · 조정값 아님) */
const COPY_CHUNK_ROWS = 1000;

function* copyChunks(rows: readonly TagRawRow[]): Generator<string> {
  for (let i = 0; i < rows.length; i += COPY_CHUNK_ROWS) {
    let s = '';
    for (let j = i; j < Math.min(i + COPY_CHUNK_ROWS, rows.length); j++) s += copyLine(rows[j] as TagRawRow);
    yield s;
  }
}

export interface ControlSinkLog {
  error(msg: string): void;
  warn(msg: string): void;
}

/** 다시 보내기 — 횟수 · 한 번의 제한 시간(앞 시도의 잠금을 기다릴 수 있어 첫 시도보다 길다) */
export interface ControlCopyRetry {
  attempts: number;
  timeoutMs: number;
}
export const CONTROL_COPY_RETRY: ControlCopyRetry = { attempts: 2, timeoutMs: 10_000 };

/** 배치의 키가 대조군에 몇 개 있는가 — ts 범위로 칸을 좁힌다(지난 칸 · 압축 칸을 훑지 않게) */
export const CONTROL_PRESENT_SQL = `SELECT count(*)::int AS n FROM plc_tag_raw_control c
  JOIN unnest($1::int[], $2::int[], $3::timestamptz[]) AS k(d, t, ts)
    ON c.device_id = k.d AND c.tag_id = k.t AND c.ts = k.ts
 WHERE c.ts >= $4 AND c.ts <= $5`;

const sqlState = (e: unknown): string | null => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
};
/** 데이터 규칙 위반(값 22 · 무결성 23) — 다시 보내도 같다 */
const isDataError = (e: unknown): boolean => /^2[23]/.test(sqlState(e) ?? '');
const isUniqueViolation = (e: unknown): boolean => sqlState(e) === '23505';
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export class PostgresControlSink implements ControlTableSinkPort {
  readonly implName = 'PostgresControlSink' as const;
  private client: Client | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly log: ControlSinkLog,
    private readonly timeoutMs: number,
    private readonly retry: ControlCopyRetry = CONTROL_COPY_RETRY,
  ) {}

  async copy(rows: readonly TagRawRow[], info: ControlBatchInfo): Promise<boolean> {
    if (rows.length === 0) return true;
    const t0 = performance.now();
    let last: unknown;
    try {
      await this.within(this.copyOnce(rows), this.timeoutMs);
      return this.copied(rows, t0);
    } catch (e) {
      last = e;
      this.discard();
    }
    // 결과를 모르는 실패만 다시 보낸다 — 데이터 규칙 위반은 다시 보내도 같다
    for (let i = 1; i <= this.retry.attempts && !isDataError(last); i++) {
      m.controlCopyRetries.inc();
      this.log.warn(
        JSON.stringify({
          event: 'control_copy_retry',
          attempt: i,
          rows: rows.length,
          token: info.token,
          error: messageOf(last),
        }),
      );
      try {
        await this.within(this.copyOnce(rows), this.retry.timeoutMs);
        return this.copied(rows, t0);
      } catch (e) {
        last = e;
        if (isUniqueViolation(e)) {
          // 앞 시도가 실제로는 들어갔다 — 배치의 키가 모두 있으면 이미 들어간 것 · 일부만 있으면 다시 보내도 안 된다
          try {
            const n = await this.within(this.countPresent(rows), this.retry.timeoutMs);
            if (n === rows.length) return this.copied(rows, t0);
            last = new Error(`기본 키 충돌 — 배치 ${rows.length}행 중 ${n}행만 대조군에 있다`);
          } catch (e2) {
            last = e2;
            this.discard();
          }
          break;
        }
        this.discard();
      }
    }
    return this.failed(rows, info, last);
  }

  /** 제한 시간 안에 끝나지 않으면 거절 — 늦게 끝나는 시도의 거절은 삼킨다(커넥션은 부르는 쪽이 버린다) */
  private async within<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`COPY 타임아웃 ${ms} ms`)), ms);
        }),
      ]);
    } catch (e) {
      work.catch(() => {});
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private copied(rows: readonly TagRawRow[], t0: number): true {
    m.controlCopyRows.inc(rows.length);
    m.controlCopySeconds.observe((performance.now() - t0) / 1000);
    return true;
  }

  private failed(rows: readonly TagRawRow[], info: ControlBatchInfo, e: unknown): false {
    m.controlCopyFailures.inc();
    let tsMin = Number.POSITIVE_INFINITY;
    let tsMax = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      if (r[0] < tsMin) tsMin = r[0];
      if (r[0] > tsMax) tsMax = r[0];
    }
    // 무효 구간의 원천 — 구간은 메트릭 레이블이 아니라 구조화 로그다(10_observability/01 §적재 불릿)
    this.log.error(
      JSON.stringify({
        event: 'control_copy_failed',
        ts_min: tsMin,
        ts_max: tsMax,
        rows: rows.length,
        token: info.token,
        error: messageOf(e),
      }),
    );
    return false;
  }

  /** COPY 한 문장 = 암묵 트랜잭션 하나 — 실패하면 그 배치는 대조군에 0행(롤백)이다 */
  protected async copyOnce(rows: readonly TagRawRow[]): Promise<void> {
    const c = await this.connection();
    const sink = c.query(copyFrom(CONTROL_COPY_SQL));
    await pipeline(Readable.from(copyChunks(rows)), sink);
  }

  /** 배치의 (설비 · 태그 · 시각) 키 중 대조군에 있는 수 */
  protected async countPresent(rows: readonly TagRawRow[]): Promise<number> {
    const c = await this.connection();
    let tsMin = Number.POSITIVE_INFINITY;
    let tsMax = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      if (r[0] < tsMin) tsMin = r[0];
      if (r[0] > tsMax) tsMax = r[0];
    }
    const rs = await c.query<{ n: number }>(CONTROL_PRESENT_SQL, [
      rows.map((r) => r[1]),
      rows.map((r) => r[2]),
      rows.map((r) => new Date(r[0]).toISOString()),
      new Date(tsMin),
      new Date(tsMax),
    ]);
    return Number(rs.rows[0]?.n ?? 0);
  }

  private async connection(): Promise<Client> {
    if (this.client) return this.client;
    const c = new Client({
      connectionString: this.connectionString,
      application_name: 'db_study-control-copy',
      connectionTimeoutMillis: this.timeoutMs,
      // 세션 synchronous_commit off(10_olap_vs_rdb_control §측정 조건 내구성) · 기동 인자라 배치마다 왕복이 없다
      options: '-c synchronous_commit=off',
    });
    c.on('error', (e) => {
      this.log.warn(`대조군 전용 커넥션 오류 — ${e.message} · 다음 배치가 새로 연다`);
      if (this.client === c) this.discard();
    });
    this.client = c;
    try {
      await c.connect();
    } catch (e) {
      this.discard();
      throw e;
    }
    return c;
  }

  private discard(): void {
    const c = this.client;
    this.client = null;
    c?.end().catch(() => {});
  }

  async close(): Promise<void> {
    const c = this.client;
    this.client = null;
    await c?.end().catch(() => {});
  }
}

/** 게이트 원천 — CacheKeyClient.getDualGate(failed는 degrade로 있는지 모른다) */
export interface DualGateSource {
  getDualGate(): Promise<{ value: string | null; failed: boolean }>;
}

/** 게이트 읽기 캐시 — 배치마다 Redis를 읽지 않는다(500 ms 안의 배치는 직전 판정을 쓴다) */
export const DUAL_GATE_CACHE_MS = 500;
/**
 * 읽기가 잇따라 실패할 때 직전 "열림"을 믿는 상한 — 게이트 TTL(10초)과 같다.
 * 최대 속도 넣기 중에는 Redis 응답이 캐시 래퍼 타임아웃(50 ms)을 넘을 수 있다 — 한 번 실패를 "닫힘"으로 읽으면
 * 그 배치들이 PostgreSQL에서 빠져 행 수 대조가 어긋난다. 상한을 넘으면 닫힘으로 본다(실행이 죽었으면 게이트도 TTL로 사라졌다).
 */
export const DUAL_GATE_STALE_MS = 10_000;

/** 게이트 판정 — 캐시 ≤ DUAL_GATE_CACHE_MS · 동시 호출은 읽기 하나를 나눠 쓴다 */
export class DualGateReader {
  private open = false;
  private checkedAt = Number.NEGATIVE_INFINITY;
  private confirmedAt = Number.NEGATIVE_INFINITY;
  private pending: Promise<boolean> | null = null;

  constructor(
    private readonly src: DualGateSource,
    private readonly now: () => number = () => performance.now(),
  ) {}

  isOpen(): Promise<boolean> {
    if (this.now() - this.checkedAt < DUAL_GATE_CACHE_MS) return Promise.resolve(this.open);
    this.pending ??= this.refresh().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async refresh(): Promise<boolean> {
    let r: { value: string | null; failed: boolean };
    try {
      r = await this.src.getDualGate();
    } catch {
      r = { value: null, failed: true };
    }
    const t = this.now();
    this.checkedAt = t;
    if (!r.failed) {
      this.open = r.value !== null;
      this.confirmedAt = t;
    } else if (t - this.confirmedAt > DUAL_GATE_STALE_MS) {
      this.open = false;
    }
    return this.open;
  }
}

/** SW-09 gated — 같은 PostgresControlSink를 게이트가 열렸을 때만 부른다(주입 구현 이름은 PostgresControlSink · 02_features/13) */
export class GatedControlSink implements ControlTableSinkPort {
  readonly implName = 'PostgresControlSink' as const;

  constructor(
    private readonly inner: ControlTableSinkPort,
    private readonly gate: { isOpen(): Promise<boolean> },
  ) {}

  async copy(rows: readonly TagRawRow[], info: ControlBatchInfo): Promise<boolean | null> {
    if (!(await this.gate.isOpen())) return null;
    return this.inner.copy(rows, info);
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
