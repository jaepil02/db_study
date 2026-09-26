// 역방향 대조 저장소 접속 · 계기 — pg(커넥션 풀) · @clickhouse/client(HTTP 8123) 직접 · api 비경유(공정성 규칙 3)
// PostgreSQL 실험 세션은 synchronous_commit off(공정성 규칙 5 — EXP-44 on 팔만 예외) · search_path로 대상 스키마를 고른다.
// 물리 비용 계기 — ClickHouse system.part_log · parts(patch 파트) · mutations · events / PostgreSQL pg_stat_wal · pg_stat_user_tables.
// 서버 시간 — ClickHouse query_log(log_comment로 이 실행의 문장만) · PostgreSQL pg_stat_statements(문장 원문으로 호출 · 실행 시간 증분).
import { type ClickHouseClient, ClickHouseLogLevel, createClient } from '@clickhouse/client';
import { Client, Pool, type PoolClient } from 'pg';

export const OLTP_REQUEST_TIMEOUT_MS = 10 * 60_000;
export const PG_APP_NAME = 'db_study-oltp-lab';
/**
 * 유휴 소켓 · 커넥션 유지 시간 — 두 저장소 같은 값(N3 · 공정성 규칙 1). pg 풀 idleTimeoutMillis 기본 10초에 맞춰
 * @clickhouse/client keep_alive.idle_socket_ttl(기본 2500 ms)을 늘린다 — 예열한 소켓이 먼저 닫혀 CH만 접속 비용을 다시 내지 않게.
 */
export const IDLE_KEEP_MS = 10_000;
export const KEEP_ALIVE_DETAIL = { chIdleSocketTtlMs: IDLE_KEEP_MS, pgIdleTimeoutMs: IDLE_KEEP_MS } as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 고해상도 클라이언트 시각(ms) */
export const now = (): number => performance.now();

export interface ChOpts {
  url: string;
  database: string;
  maxConnections: number;
}

export function oltpChClient(o: ChOpts): ClickHouseClient {
  const u = new URL(o.url);
  return createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: o.database,
    // 같은 머신 · 컨테이너 망 — 압축은 도구 CPU만 먹는다
    compression: { request: false, response: false },
    request_timeout: OLTP_REQUEST_TIMEOUT_MS,
    max_open_connections: o.maxConnections,
    keep_alive: { enabled: true, idle_socket_ttl: IDLE_KEEP_MS },
    // 판별 · 제약 실험은 거절을 결과로 받는다 — 클라이언트 오류 로그를 끄고 예외로만 받는다(stderr가 원시를 덮지 않게)
    log: { level: ClickHouseLogLevel.OFF },
    // 채움 · 삽입은 ts를 epoch ms 정수로 보낸다 — 서버 프로파일 값에 기대지 않고 쿼리에 명시한다(05_data_stores/03 §시각 컬럼)
    // 긴 요청(10^6 채움 · 머지 대기)이 유휴 소켓으로 끊기지 않게 진행 헤더(mode-d와 같은 클라이언트 권고)
    clickhouse_settings: {
      input_format_read_datetime_number_as_raw_value: 1,
      send_progress_in_http_headers: 1,
      http_headers_progress_interval_ms: '60000',
    } as Record<string, number | string>,
  });
}

export interface PgOpts {
  url: string;
  schema: string;
  synchronousCommit: 'on' | 'off';
  max: number;
}

function pgStartupOptions(o: Pick<PgOpts, 'schema' | 'synchronousCommit'>): string {
  // 스모크 스키마는 public을 뒤에 둔다 — pg_stat_statements 뷰가 public에 있다
  const path = o.schema === 'public' ? 'public' : `${o.schema},public`;
  return `-c search_path=${path} -c synchronous_commit=${o.synchronousCommit}`;
}

export function oltpPgPool(o: PgOpts): Pool {
  return new Pool({
    connectionString: o.url,
    application_name: PG_APP_NAME,
    options: pgStartupOptions(o),
    max: o.max,
    idleTimeoutMillis: IDLE_KEEP_MS,
  });
}

export async function oltpPgClient(o: Omit<PgOpts, 'max'>): Promise<Client> {
  const c = new Client({
    connectionString: o.url,
    application_name: PG_APP_NAME,
    options: pgStartupOptions(o),
  });
  await c.connect();
  return c;
}

/** 풀에서 커넥션 c개를 미리 잡아 둔다 — 첫 요청의 접속 비용이 분포에 섞이지 않게(웜) */
export async function pgWarmPool(pool: Pool, c: number): Promise<void> {
  const held: PoolClient[] = [];
  for (let i = 0; i < c; i++) held.push(await pool.connect());
  for (const h of held) h.release();
}

/** ClickHouse 소켓 c개를 미리 연다(동시 SELECT 1) — 첫 요청의 접속 비용이 분포에 섞이지 않게(pgWarmPool과 대칭) */
export async function chWarm(ch: ClickHouseClient, c: number): Promise<void> {
  await Promise.all(
    Array.from({ length: c }, () =>
      ch.query({ query: 'SELECT 1', format: 'JSONEachRow' }).then((r) => r.json()),
    ),
  );
}

/**
 * 경량 UPDATE 쓰기 · patch 판독 설정 — 서버 기본값에 기대지 않고 문장에 명시한다(05_data_stores/10 §ClickHouse 변형의 설정 ·
 * 리드 판정 M2). 쓴 값은 detail에 · 문장이 받은 값은 query_log Settings(detail.server.settingsUsed)에 남는다.
 */
export const LWU_WRITE_SETTINGS = { enable_lightweight_update: 1 } as const;
export const PATCH_READ_SETTINGS = { apply_patch_parts: 1 } as const;

export async function chRows<T>(
  ch: ClickHouseClient,
  query: string,
  params: Record<string, unknown> = {},
  settings: Record<string, unknown> = {},
): Promise<T[]> {
  const rs = await ch.query({
    query,
    format: 'JSONEachRow',
    query_params: params,
    clickhouse_settings: settings as Record<string, string | number>,
  });
  return (await rs.json()) as T[];
}

export async function chScalar(
  ch: ClickHouseClient,
  query: string,
  params: Record<string, unknown> = {},
): Promise<string> {
  const rows = await chRows<Record<string, unknown>>(ch, query, params);
  const first = rows[0];
  return first ? String(Object.values(first)[0]) : '';
}

/** 서버 현재 시각(마이크로초 문자열) — part_log · query_log 창의 시작 */
export function chNow(ch: ClickHouseClient): Promise<string> {
  return chScalar(ch, "SELECT toString(now64(6, 'UTC')) AS t");
}

export async function chFlushLogs(ch: ClickHouseClient): Promise<void> {
  await ch.command({ query: 'SYSTEM FLUSH LOGS' });
}

export interface ChPhys {
  activeParts: number;
  patchParts: number;
  rows: number;
  bytesOnDisk: number;
  mutations: number;
  mutationsPending: number;
  partLog: Record<string, { n: number; bytes: number; uncompressed: number; rows: number }>;
  events: Record<string, number>;
}

export const CH_EVENTS = [
  'DelayedInserts',
  'RejectedInserts',
  'DuplicatedInsertedBlocks',
  'AsyncInsertQuery',
  'InsertedRows',
  'MergedRows',
  'MergedUncompressedBytes',
] as const;

/** 테이블 하나의 물리 상태 · t0 이후 part_log · mutations(SYSTEM FLUSH LOGS 뒤) */
export async function chPhys(ch: ClickHouseClient, db: string, table: string, t0: string): Promise<ChPhys> {
  await chFlushLogs(ch);
  const p = { db, t: table, t0 };
  const [parts] = await chRows<{ a: string; pp: string; r: string; b: string }>(
    ch,
    `SELECT countIf(NOT startsWith(name, 'patch-')) AS a, countIf(startsWith(name, 'patch-')) AS pp,
            sum(rows) AS r, sum(bytes_on_disk) AS b
       FROM system.parts WHERE database = {db:String} AND table = {t:String} AND active`,
    p,
  );
  const [mut] = await chRows<{ n: string; pend: string }>(
    ch,
    `SELECT count() AS n, countIf(NOT is_done) AS pend FROM system.mutations
      WHERE database = {db:String} AND table = {t:String} AND create_time >= toDateTime64({t0:String}, 6, 'UTC') - INTERVAL 1 SECOND`,
    p,
  );
  const log = await chRows<{ e: string; n: string; b: string; u: string; r: string }>(
    ch,
    `SELECT toString(event_type) AS e, count() AS n, sum(size_in_bytes) AS b, sum(bytes_uncompressed) AS u, sum(rows) AS r
       FROM system.part_log
      WHERE database = {db:String} AND table = {t:String}
        AND event_time_microseconds >= toDateTime64({t0:String}, 6, 'UTC')
      GROUP BY e`,
    p,
  );
  const ev = await chRows<{ event: string; value: string }>(
    ch,
    'SELECT event, value FROM system.events WHERE event IN ({names:Array(String)})',
    { names: CH_EVENTS },
  );
  return {
    activeParts: Number(parts?.a ?? 0),
    patchParts: Number(parts?.pp ?? 0),
    rows: Number(parts?.r ?? 0),
    bytesOnDisk: Number(parts?.b ?? 0),
    mutations: Number(mut?.n ?? 0),
    mutationsPending: Number(mut?.pend ?? 0),
    partLog: Object.fromEntries(
      log.map((x) => [
        x.e,
        { n: Number(x.n), bytes: Number(x.b), uncompressed: Number(x.u), rows: Number(x.r) },
      ]),
    ),
    events: Object.fromEntries(CH_EVENTS.map((e) => [e, Number(ev.find((x) => x.event === e)?.value ?? 0)])),
  };
}

export function eventDelta(a: ChPhys, b: ChPhys): Record<string, number> {
  return Object.fromEntries(CH_EVENTS.map((e) => [e, (b.events[e] ?? 0) - (a.events[e] ?? 0)]));
}

export interface ChServerTime {
  queries: number;
  p50Ms: number | null;
  p95Ms: number | null;
  meanMs: number | null;
  readRowsMean: number | null;
  readBytesMean: number | null;
  exceptions: number;
  /** 이 실행 문장이 실제로 받은 설정(query_log Settings — 서버 기본에서 바뀐 것만 · async insert는 QueryFinish에 비어 QueryStart 행에서) · 기본값은 conditions의 system.settings */
  settingsUsed: Record<string, string> | null;
}

/** 이 실행의 문장(log_comment)만 — 서버 시간은 query_start ~ event_time 마이크로초(query_duration_ms는 ms 정수라 점조회에 거칠다) */
export async function chServerTime(ch: ClickHouseClient, comment: string, t0: string): Promise<ChServerTime> {
  await chFlushLogs(ch);
  const [r] = await chRows<Record<string, string | number | null>>(
    ch,
    `SELECT countIf(type = 'QueryFinish') AS q,
            quantileExactIf(0.5)(dateDiff('microsecond', query_start_time_microseconds, event_time_microseconds) / 1000, type = 'QueryFinish') AS p50,
            quantileExactIf(0.95)(dateDiff('microsecond', query_start_time_microseconds, event_time_microseconds) / 1000, type = 'QueryFinish') AS p95,
            avgIf(dateDiff('microsecond', query_start_time_microseconds, event_time_microseconds) / 1000, type = 'QueryFinish') AS mean,
            avgIf(read_rows, type = 'QueryFinish') AS rr, avgIf(read_bytes, type = 'QueryFinish') AS rb,
            countIf(type IN ('ExceptionBeforeStart', 'ExceptionWhileProcessing')) AS ex,
            anyIf(Settings, length(mapKeys(Settings)) > 0) AS st
       FROM system.query_log
      WHERE event_date >= toDate(toDateTime64({t0:String}, 6, 'UTC')) - 1
        AND event_time_microseconds >= toDateTime64({t0:String}, 6, 'UTC')
        AND log_comment = {c:String}`,
    { c: comment, t0 },
  );
  const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
  const q = Number(r?.q ?? 0);
  return {
    queries: q,
    p50Ms: q ? num(r?.p50) : null,
    p95Ms: q ? num(r?.p95) : null,
    meanMs: q && num(r?.mean) !== null ? Math.round((num(r?.mean) as number) * 1000) / 1000 : null,
    readRowsMean: q ? num(r?.rr) : null,
    readBytesMean: q ? num(r?.rb) : null,
    exceptions: Number(r?.ex ?? 0),
    settingsUsed: q ? ((r?.st as unknown as Record<string, string>) ?? null) : null,
  };
}

/**
 * 변형 · 판별이 기록할 ClickHouse 설정(서버 기본값 — 공정성 규칙 6) — 경량 UPDATE(Beta)의 켜짐 · 판독 쪽 patch 적용 ·
 * 동시 UPDATE 일관성 · async insert 플러시 시점 · 중복 제거 토큰. 값을 바꾸지 않고 읽기만 한다(W1 검수 판정).
 */
export const CH_RECORDED_SETTINGS = [
  'mutations_sync',
  'apply_mutations_on_fly',
  'enable_lightweight_update',
  'allow_experimental_lightweight_update',
  'apply_patch_parts',
  'update_parallel_mode',
  'async_insert',
  'wait_for_async_insert',
  'wait_for_async_insert_timeout',
  'async_insert_busy_timeout_ms',
  'async_insert_busy_timeout_max_ms',
  'async_insert_busy_timeout_min_ms',
  'async_insert_use_adaptive_busy_timeout',
  'async_insert_busy_timeout_increase_rate',
  'async_insert_busy_timeout_decrease_rate',
  'async_insert_max_data_size',
  'async_insert_max_query_number',
  'async_insert_poll_timeout_ms',
  'async_insert_deduplicate',
  'insert_deduplicate',
  'insert_deduplication_token',
  'max_threads',
  'use_query_condition_cache',
  'use_uncompressed_cache',
] as const;

export interface PgPhys {
  walBytes: number;
  walRecords: number;
  walFpi: number;
  nTupIns: number;
  nTupUpd: number;
  nTupHotUpd: number;
  nDeadTup: number;
  nLiveTup: number;
  autovacuumCount: number;
  autoanalyzeCount: number;
}

type Queryable = Pick<Client, 'query'>;

/**
 * pg_stat_* 는 백엔드가 유휴가 될 때 최대 1초 간격으로 공유 통계에 흘린다 — 쓰기 세션이 끝난 뒤
 * PG_STATS_SETTLE_MS를 기다리고 스냅샷을 비운 다음 읽는다(쓰기 세션은 끝에 pg_stat_force_next_flush를 부른다).
 */
export const PG_STATS_SETTLE_MS = 1_200;

export async function pgPhys(c: Queryable, table: string): Promise<PgPhys> {
  await c.query('SELECT pg_stat_clear_snapshot()');
  const r = await c.query<Record<string, string>>(
    `SELECT w.wal_bytes, w.wal_records, w.wal_fpi,
            s.n_tup_ins, s.n_tup_upd, s.n_tup_hot_upd, s.n_dead_tup, s.n_live_tup, s.autovacuum_count, s.autoanalyze_count
       FROM pg_stat_wal w, pg_stat_user_tables s
      WHERE s.relid = to_regclass($1)`,
    [table],
  );
  const x = r.rows[0];
  if (!x) throw new Error(`pg_stat_user_tables에 ${table}이 없다(search_path 확인)`);
  return {
    walBytes: Number(x.wal_bytes),
    walRecords: Number(x.wal_records),
    walFpi: Number(x.wal_fpi),
    nTupIns: Number(x.n_tup_ins),
    nTupUpd: Number(x.n_tup_upd),
    nTupHotUpd: Number(x.n_tup_hot_upd),
    nDeadTup: Number(x.n_dead_tup),
    nLiveTup: Number(x.n_live_tup),
    autovacuumCount: Number(x.autovacuum_count),
    autoanalyzeCount: Number(x.autoanalyze_count),
  };
}

export function pgPhysDelta(a: PgPhys, b: PgPhys): PgPhys {
  const out = {} as PgPhys;
  for (const k of Object.keys(a) as (keyof PgPhys)[]) out[k] = b[k] - a[k];
  return out;
}

export interface PgStmtStat {
  calls: number;
  totalMs: number;
}

/** pg_stat_statements — 문장 원문(전부 $n 매개변수라 정규화 뒤에도 같다)으로 합친 호출 수 · 실행 시간 */
export async function pgStmtStat(c: Queryable, sql: string): Promise<PgStmtStat> {
  const r = await c.query<{ calls: string | null; t: string | null }>(
    'SELECT sum(calls)::bigint AS calls, sum(total_exec_time) AS t FROM pg_stat_statements WHERE query = $1',
    [sql],
  );
  return { calls: Number(r.rows[0]?.calls ?? 0), totalMs: Number(r.rows[0]?.t ?? 0) };
}

export function pgStmtMean(a: PgStmtStat, b: PgStmtStat): { calls: number; meanMs: number | null } {
  const calls = b.calls - a.calls;
  return { calls, meanMs: calls > 0 ? Math.round(((b.totalMs - a.totalMs) / calls) * 1000) / 1000 : null };
}

/** 쓰기 세션이 끝에 부른다 — 이 백엔드의 대기 통계를 다음 유휴에 흘리게 한다 */
export async function pgForceFlush(c: Queryable): Promise<void> {
  await c.query('SELECT pg_stat_force_next_flush()');
}
