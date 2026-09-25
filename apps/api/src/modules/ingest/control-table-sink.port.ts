// SW-09 CONTROL_TABLE_ENABLED — ControlTableSinkPort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// 기전 정본 docs/06_pipeline/04_routing.md §대조군 동시 적재 기전 · 저장소 계약 docs/05_data_stores/10_olap_vs_rdb_control.md §SW-09 동시 적재
// ② ClickHouse 삽입 성공 뒤 ③ COPY 1회(재시도 루프 밖) → ④ XACK(③의 성패와 무관) → ⑤ 최신값.
// 입력은 ②에 보낸 것과 같은 행 배열 · 전용 커넥션 1(업무 풀 밖 · 끊기면 그 배치 실패 · 다음 배치가 새로 연다) · 재시도 없음.
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
  /** 한 번만 시도한다 · 던지지 않는다 — 실패는 계수 + 구간 로그로 남기고 XACK는 계속된다(REQ-ING-15) */
  copy(rows: readonly TagRawRow[], info: ControlBatchInfo): Promise<void>;
  close(): Promise<void>;
}

export class NoopControlSink implements ControlTableSinkPort {
  readonly implName = 'NoopControlSink' as const;
  async copy(): Promise<void> {}
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

export class PostgresControlSink implements ControlTableSinkPort {
  readonly implName = 'PostgresControlSink' as const;
  private client: Client | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly log: ControlSinkLog,
    private readonly timeoutMs: number,
  ) {}

  async copy(rows: readonly TagRawRow[], info: ControlBatchInfo): Promise<void> {
    if (rows.length === 0) return;
    const t0 = performance.now();
    let timer: NodeJS.Timeout | undefined;
    const attempt = this.copyOnce(rows);
    try {
      await Promise.race([
        attempt,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`COPY 타임아웃 ${this.timeoutMs} ms`)), this.timeoutMs);
        }),
      ]);
      m.controlCopyRows.inc(rows.length);
      m.controlCopySeconds.observe((performance.now() - t0) / 1000);
    } catch (e) {
      attempt.catch(() => {}); // 타임아웃 뒤 늦게 끝나는 시도의 거절을 삼킨다 — 커넥션은 아래에서 버린다
      this.discard();
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
          error: (e as Error).message,
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** COPY 한 문장 = 암묵 트랜잭션 하나 — 실패하면 그 배치는 대조군에 0행(롤백)이다 */
  private async copyOnce(rows: readonly TagRawRow[]): Promise<void> {
    const c = await this.connection();
    const sink = c.query(copyFrom(CONTROL_COPY_SQL));
    await pipeline(Readable.from(copyChunks(rows)), sink);
  }

  private async connection(): Promise<Client> {
    if (this.client) return this.client;
    const c = new Client({
      connectionString: this.connectionString,
      application_name: 'db_study-control-copy',
      connectionTimeoutMillis: this.timeoutMs,
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
