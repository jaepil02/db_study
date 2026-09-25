// 모드 D 저장소 어댑터 — ClickHouse(HTTP 8123 · RowBinary 스트림 삽입) · PostgreSQL 대조군(전용 커넥션 · COPY BINARY · synchronous_commit off)
// 롤업 · MV 정의는 소유하지 않는다 — 분리 · 재연결 · INSERT SELECT 절차만 실행한다(GEN-08 · 05_data_stores/04 §백필 절차).
// 과거 KST 일 파티션 생성 · ⑧ 비우기 · 대조군 정리는 app_owner 권한이다(app_rw는 DDL · DELETE가 없다 — 05_data_stores/02).
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { DAY_MS, type DaySegment, kstDayName, kstDayStart } from './mode-d-options';
import type { ControlStore, RawStore } from './mode-d-runner';

/** 백필 한 INSERT = KST 일 하나 — 파싱 블록을 키워 파트 수를 줄인다(1,048,576 기본 → 4배 · 블록당 약 170 MB) */
export const RAW_INSERT_BLOCK_ROWS = 4_194_304;
/** 일 하나 삽입 · 롤업 조각의 요청 타임아웃 — M+ 하루(86억 행)도 한 요청이다 */
export const MODE_D_REQUEST_TIMEOUT_MS = 6 * 3_600_000;

const RAW_COLUMNS = '(ts, device_id, tag_id, value, quality, scan_seq)';
export const RAW_INSERT_SQL = `INSERT INTO plc.tag_raw ${RAW_COLUMNS} FORMAT RowBinary`;
/** 04_clickhouse_rollup §tag_1m · mv_tag_1m의 SELECT와 같은 식 — 백필 구간만 */
export const ROLLUP_FILL_SQL = `
INSERT INTO plc.tag_1m
SELECT toStartOfMinute(ts) AS bucket, device_id, tag_id,
       countState() AS cnt, avgState(value) AS avg_v, minState(value) AS min_v, maxState(value) AS max_v,
       argMaxState(value, ts) AS last_v, quantilesTDigestState(0.95)(value) AS p95_v,
       countIfState(quality IN (2, 4)) AS bad_cnt
  FROM plc.tag_raw
 WHERE ts >= fromUnixTimestamp64Milli({lo:Int64}, 'Asia/Seoul') AND ts < fromUnixTimestamp64Milli({hi:Int64}, 'Asia/Seoul')
 GROUP BY bucket, device_id, tag_id`;
export const CONTROL_COPY_BINARY_SQL =
  'COPY plc_tag_raw_control (ts, device_id, tag_id, value, quality, scan_seq) FROM STDIN (FORMAT binary)';

export function chClient(clickhouseUrl: string): ClickHouseClient {
  const url = new URL(clickhouseUrl);
  return createClient({
    url: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'plc',
    // 같은 머신 · 컨테이너 망 — 압축은 생성기 CPU만 먹는다(적재 축은 서버 쪽 비용을 잰다)
    compression: { request: false, response: false },
    request_timeout: MODE_D_REQUEST_TIMEOUT_MS,
    // 긴 요청(일 하나 삽입 · 롤업 조각)이 유휴 소켓으로 끊기지 않게 진행 헤더를 보낸다(클라이언트 권고)
    clickhouse_settings: { send_progress_in_http_headers: 1, http_headers_progress_interval_ms: '60000' },
  });
}

export class ClickHouseRawStore implements RawStore {
  constructor(private readonly ch: ClickHouseClient) {}

  private async scalar(query: string, params: Record<string, unknown> = {}): Promise<number> {
    const rs = await this.ch.query({ query, format: 'JSONEachRow', query_params: params });
    const rows = (await rs.json()) as { n: string | number }[];
    return Number(rows[0]?.n ?? 0);
  }

  liveRows(): Promise<number> {
    return this.scalar(
      `SELECT count() AS n FROM plc.tag_raw
        WHERE ts >= now64(3) - INTERVAL 30 SECOND AND ingested_at >= now64(3) - INTERVAL 30 SECOND`,
    );
  }

  async mvAttached(): Promise<boolean> {
    return (
      (await this.scalar(
        `SELECT count() AS n FROM system.tables WHERE database = 'plc' AND name = 'mv_tag_1m'`,
      )) > 0
    );
  }

  async detachMv(): Promise<void> {
    await this.ch.command({ query: 'DETACH TABLE plc.mv_tag_1m' });
  }

  async attachMv(): Promise<void> {
    if (!(await this.mvAttached())) await this.ch.command({ query: 'ATTACH TABLE plc.mv_tag_1m' });
  }

  countRaw(fromMs: number, toMs: number): Promise<number> {
    return this.scalar(
      `SELECT count() AS n FROM plc.tag_raw
        WHERE ts >= fromUnixTimestamp64Milli({lo:Int64}, 'Asia/Seoul') AND ts < fromUnixTimestamp64Milli({hi:Int64}, 'Asia/Seoul')`,
      { lo: fromMs, hi: toMs },
    );
  }

  countRollup(fromMs: number, toMs: number): Promise<number> {
    return this.scalar(
      `SELECT countMerge(cnt) AS n FROM plc.tag_1m
        WHERE bucket >= toDateTime(intDiv({lo:Int64}, 1000), 'Asia/Seoul') AND bucket < toDateTime(intDiv({hi:Int64}, 1000), 'Asia/Seoul')`,
      { lo: fromMs, hi: toMs },
    );
  }

  async insertRaw(rowBinary: AsyncIterable<Uint8Array>): Promise<void> {
    const r = await this.ch.exec({
      query: RAW_INSERT_SQL,
      values: Readable.from(rowBinary, { objectMode: false }),
      // 토큰 없는 백필 — 블록 내용 해시 중복 제거를 끈다(같은 내용 블록이 조용히 0행이 되지 않게 · 04_clickhouse_rollup ④와 같은 이유)
      clickhouse_settings: { insert_deduplicate: 0, max_insert_block_size: String(RAW_INSERT_BLOCK_ROWS) },
    });
    for await (const _ of r.stream) {
      // 응답 본문(비어 있음)을 비워 소켓을 돌려준다
    }
  }

  async fillRollup(fromMs: number, toMs: number): Promise<void> {
    await this.ch.command({
      query: ROLLUP_FILL_SQL,
      query_params: { lo: fromMs, hi: toMs },
      // 04_clickhouse_rollup §백필 절차 ④ — 둘 다 명시한다(버전 · 기본값마다 동작이 다르다)
      clickhouse_settings: { insert_deduplicate: 0, deduplicate_insert_select: 'disable' } as Record<
        string,
        string | number
      >,
    });
  }

  /** tag_raw에 실제로 남은 KST 일 파티션(YYYYMMDD) — 대조군 정리의 기준(06_pipeline/10 §대조군 파티션 정리) */
  async rawDays(): Promise<string[]> {
    const rs = await this.ch.query({
      query: `SELECT DISTINCT partition AS p FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active ORDER BY p`,
      format: 'JSONEachRow',
    });
    return ((await rs.json()) as { p: string }[]).map((r) => String(r.p));
  }
}

/** 대조군 파티션 한 개 — DEFAULT 파티션은 lo · hi가 null */
export interface ControlPartition {
  name: string;
  loMs: number | null;
  hiMs: number | null;
}

export const CONTROL_PARTITIONS_SQL = `
SELECT c.relname AS name,
       (regexp_match(pg_get_expr(c.relpartbound, c.oid), 'FROM \\(''([^'']+)''\\)'))[1]::timestamptz AS lo,
       (regexp_match(pg_get_expr(c.relpartbound, c.oid), 'TO \\(''([^'']+)''\\)'))[1]::timestamptz AS hi
  FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
 WHERE i.inhparent = 'public.plc_tag_raw_control'::regclass
 ORDER BY lo NULLS FIRST`;

function quoteIdent(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

/** app_owner 접속 문자열 — migrate와 같은 방식(POSTGRES_URL의 호스트 · DB + APP_OWNER_PASSWORD) · 비밀은 환경변수에서만 */
export function ownerUrl(postgresUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const pw = env.APP_OWNER_PASSWORD;
  if (!pw || pw === 'CHANGE_ME')
    throw new Error(
      'APP_OWNER_PASSWORD 없음 — 과거 일 파티션 생성 · ⑧ 비우기 · 대조군 정리는 app_owner 권한이다',
    );
  const u = new URL(postgresUrl);
  u.username = 'app_owner';
  u.password = encodeURIComponent(pw);
  return u.toString();
}

export class PostgresControlStore implements ControlStore {
  private rw: Client | null = null;
  private owner: Client | null = null;

  constructor(
    private readonly postgresUrl: string,
    private readonly ownerUrlOf: () => string,
  ) {}

  /** 전용 커넥션(업무 풀 밖 · ADR-19) · 세션 synchronous_commit off(10_olap_vs_rdb_control §측정 조건 내구성) */
  private async rwClient(): Promise<Client> {
    if (this.rw) return this.rw;
    const c = new Client({ connectionString: this.postgresUrl, application_name: 'db_study-mode-d-copy' });
    await c.connect();
    await c.query('SET synchronous_commit = off');
    this.rw = c;
    return c;
  }

  private async ownerClient(): Promise<Client> {
    if (this.owner) return this.owner;
    const c = new Client({ connectionString: this.ownerUrlOf(), application_name: 'db_study-mode-d-owner' });
    await c.connect();
    this.owner = c;
    return c;
  }

  async partitions(): Promise<ControlPartition[]> {
    const r = await (await this.rwClient()).query<{ name: string; lo: Date | null; hi: Date | null }>(
      CONTROL_PARTITIONS_SQL,
    );
    return r.rows.map((x) => ({
      name: x.name,
      loMs: x.lo?.getTime() ?? null,
      hiMs: x.hi?.getTime() ?? null,
    }));
  }

  private async dayPartition(dayStartMs: number): Promise<ControlPartition | undefined> {
    return (await this.partitions()).find((p) => p.loMs === dayStartMs && p.hiMs === dayStartMs + DAY_MS);
  }

  async ensureDayPartitions(dayStarts: readonly number[]): Promise<number[]> {
    const have = await this.partitions();
    const missing = dayStarts.filter((d) => !have.some((p) => p.loMs === d && p.hiMs === d + DAY_MS));
    if (missing.length === 0) return [];
    // pg_partman 5 — 지정 시각이 든 자식 파티션을 만든다(경계는 부모 설정 · 1 day · DB timezone Asia/Seoul 자정)
    await (await this.ownerClient()).query(
      `SELECT partman.create_partition_time('public.plc_tag_raw_control', $1::timestamptz[])`,
      [missing.map((d) => new Date(d).toISOString())],
    );
    const after = await this.partitions();
    const still = missing.filter((d) => !after.some((p) => p.loMs === d && p.hiMs === d + DAY_MS));
    if (still.length > 0)
      throw new Error(`대조군 일 파티션을 만들지 못했다 — ${still.map((d) => kstDayName(d)).join(' · ')}`);
    return missing;
  }

  async countControl(fromMs: number, toMs: number): Promise<number> {
    const r = await (await this.rwClient()).query<{ n: string }>(
      'SELECT count(*)::bigint AS n FROM plc_tag_raw_control WHERE ts >= $1::timestamptz AND ts < $2::timestamptz',
      [new Date(fromMs).toISOString(), new Date(toMs).toISOString()],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async copyDay(copyBinary: AsyncIterable<Uint8Array>): Promise<void> {
    const c = await this.rwClient();
    await c.query('BEGIN');
    try {
      await pipeline(
        Readable.from(copyBinary, { objectMode: false }),
        c.query(copyFrom(CONTROL_COPY_BINARY_SQL)),
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
  }

  async clearSegment(seg: DaySegment): Promise<'truncate' | 'delete'> {
    const o = await this.ownerClient();
    const part = seg.wholeDay ? await this.dayPartition(seg.dayStartMs) : undefined;
    if (part) {
      await o.query(`TRUNCATE ${quoteIdent(part.name)}`);
      return 'truncate';
    }
    // 일의 일부 — 앞 호출이 채운 같은 일의 다른 구간을 지우지 않게 구간만 지운다(수리 경로 · 죽은 튜플은 기록에 밝힌다)
    await o.query('DELETE FROM plc_tag_raw_control WHERE ts >= $1::timestamptz AND ts < $2::timestamptz', [
      new Date(seg.fromMs).toISOString(),
      new Date(seg.toMs).toISOString(),
    ]);
    return 'delete';
  }

  /**
   * 대조군 정리 — tag_raw에 실제로 남은 KST 일 목록 밖의 대조군 일 파티션을 DETACH · DROP(행 DELETE가 아니다).
   * 오늘(KST) 이후 파티션은 pg_partman 선행 생성분이라 남긴다 · DEFAULT 파티션은 건드리지 않는다.
   */
  async prune(rawDays: readonly string[], nowMs: number): Promise<{ day: string; partition: string }[]> {
    const today = kstDayStart(nowMs);
    const keep = new Set(rawDays);
    const victims = (await this.partitions()).filter(
      (p) => p.loMs !== null && p.hiMs === p.loMs + DAY_MS && p.loMs < today && !keep.has(kstDayName(p.loMs)),
    );
    if (victims.length === 0) return [];
    const o = await this.ownerClient();
    const dropped: { day: string; partition: string }[] = [];
    for (const p of victims) {
      await o.query(`ALTER TABLE plc_tag_raw_control DETACH PARTITION ${quoteIdent(p.name)}`);
      await o.query(`DROP TABLE ${quoteIdent(p.name)}`);
      dropped.push({ day: kstDayName(p.loMs as number), partition: p.name });
    }
    return dropped;
  }

  async close(): Promise<void> {
    await this.rw?.end().catch(() => undefined);
    await this.owner?.end().catch(() => undefined);
  }
}
