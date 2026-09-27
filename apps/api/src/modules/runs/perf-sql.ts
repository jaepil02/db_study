// perf 라이브 실행의 SQL · 시각 축 — 정본 docs/05_data_stores/10_olap_vs_rdb_control.md §실행 수명 객체 · §라이브 실행의 쿼리 재사용 ·
// docs/06_pipeline/10_datagen_inject.md §성능 비교 실행 — perf(생성 식 · 규모 구간) · 판정 .omc/run-fix-rulings.md M1 · M2
// 생성 식(두 저장소 같은 식 · 정수 산술 · 난수 없음): n 0부터 · sec = n div 10000 · ts = S + sec초 · idx = n mod 10000 ·
// device_id = idx div 200 + 1 · tag_id = idx + 1 · value = ((tag_id × 7 + sec × 13) mod 1000) ÷ 10 · quality 9 · ts 오름차순(ORDER BY n).
// scan_seq는 식에 없다 — 두 저장소 모두 sec(스캔 번호)로 둔다. 시각은 전부 UTC(ADR-27).
// PostgreSQL 객체 DDL은 마이그레이션 010의 함수가 갖는다(런타임 DDL 권한 없음).
// 동일 쿼리 5종은 scripts/lab/s5/grid/grid.py의 CH_SQL · PG_PREPARE 텍스트 그대로(테이블 이름만 run_perf_raw · 시간대 인자 'UTC').

export const PERF_TAGS = 10_000;
export const PERF_FIRST_EXPONENT = 5;
export const PERF_QUERIES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
export type PerfQuery = (typeof PERF_QUERIES)[number];

/** 실행 수명 객체 이름 — 동시 1이라 하나로 고정(부팅 정리가 이름으로 찾는다) · 시험은 it_ 접두 이름을 넘긴다 */
export interface PerfNames {
  /** ClickHouse 테이블 이름(데이터베이스 plc 안) */
  ch: string;
  /** PostgreSQL 부모 테이블 이름(public) */
  pg: string;
}
export const PERF_NAMES: PerfNames = { ch: 'run_perf_raw', pg: 'run_perf_raw' };

const IDENT = /^[a-z_][a-z0-9_]*$/;
function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`식별자 형식 위반 — ${name}`);
  return name;
}

/** 지수 목록 5 … maxExponent */
export function perfExponents(maxExponent: number): number[] {
  const out: number[] = [];
  for (let k = PERF_FIRST_EXPONENT; k <= maxExponent; k++) out.push(k);
  return out;
}

/** 단계 수 = 3 × (maxExponent − 4) + 2 */
export function perfStepCount(maxExponent: number): number {
  return 3 * (maxExponent - 4) + 2;
}

/** 시작 S(epoch 초) = 실행 시작 시각(초 내림) − 10^maxExponent ÷ 10^4초 — 마지막 규모의 끝 = 실행 시작(미래 ts 없음) */
export function perfStartSec(runStartMs: number, maxExponent: number): number {
  return Math.floor(runStartMs / 1000) - 10 ** maxExponent / PERF_TAGS;
}

/** 규모 k의 증가분 행 번호 [lo, hi) — k = 5면 [0, 10^5) · k > 5면 [10^(k−1), 10^k) */
export function scaleRows(k: number): { lo: number; hi: number } {
  return k === PERF_FIRST_EXPONENT ? { lo: 0, hi: 10 ** k } : { lo: 10 ** (k - 1), hi: 10 ** k };
}

/** 규모 k의 증가분 시각 구간 [from, to)(epoch 초) — k = 5면 [S, S + 10) · k > 5면 [S + 10^(k−1) ÷ 10^4, S + 10^k ÷ 10^4) */
export function scaleSeconds(startSec: number, k: number): { from: number; to: number } {
  const r = scaleRows(k);
  return { from: startSec + r.lo / PERF_TAGS, to: startSec + r.hi / PERF_TAGS };
}

/** 규모 k의 데이터 끝 {end}(epoch ms) = S + 10^k ÷ 10^4초 */
export function scaleEndMs(startSec: number, k: number): number {
  return (startSec + 10 ** k / PERF_TAGS) * 1000;
}

/** 'YYYY-MM-DD HH:MM:SS.sss'(UTC) — ClickHouse DateTime64(3, 'UTC') 매개변수 값 */
export function chDateTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

// ── ClickHouse

/** tag_raw와 컬럼 · 코덱 · ENGINE · PARTITION BY · ORDER BY · SETTINGS 동형 — TTL 절만 뺀다 */
export function chCreateSql(n: PerfNames = PERF_NAMES): string {
  return `CREATE TABLE plc.${ident(n.ch)}
(
    ts          DateTime64(3, 'UTC')                  CODEC(Delta(8), ZSTD(1)),
    device_id   UInt32                                CODEC(Delta(4), ZSTD(1)),
    tag_id      UInt32                                CODEC(Delta(4), ZSTD(1)),
    value       Float64                               CODEC(Gorilla, ZSTD(1)),
    quality     UInt8                                 CODEC(ZSTD(1)),
    scan_seq    UInt64                                CODEC(Delta(8), ZSTD(1)),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3) CODEC(Delta(8), ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (device_id, tag_id, ts)
SETTINGS index_granularity = 8192,
         non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1`;
}

/** 규모 증가분 채우기 — 매개변수 {s:Int64}(S) · {lo:UInt64} · {cnt:UInt64}(numbers(lo, cnt)) */
export function chFillSql(n: PerfNames = PERF_NAMES): string {
  return `INSERT INTO plc.${ident(n.ch)} (ts, device_id, tag_id, value, quality, scan_seq)
SELECT toDateTime64({s:Int64} + intDiv(number, 10000), 3, 'UTC') AS ts,
       toUInt32(intDiv(number % 10000, 200) + 1) AS device_id,
       toUInt32(number % 10000 + 1) AS tag_id,
       ((number % 10000 + 1) * 7 + intDiv(number, 10000) * 13) % 1000 / 10 AS value,
       toUInt8(9) AS quality,
       intDiv(number, 10000) AS scan_seq
FROM numbers({lo:UInt64}, {cnt:UInt64})
ORDER BY number`;
}

export function chFillParams(startSec: number, k: number): { s: number; lo: number; cnt: number } {
  const r = scaleRows(k);
  return { s: startSec, lo: r.lo, cnt: r.hi - r.lo };
}

export function chStorageSql(): string {
  return `SELECT toString(sum(bytes_on_disk)) AS b FROM system.parts
WHERE database = 'plc' AND table = {t:String} AND active`;
}

/** 쿼리 매개변수 — (device_id, tag_id) 사전순 첫 쌍 · Q5 문턱 v = quantileExact(0.5)(value)(첫 규모 직후 한 번) */
export function chParamsSql(n: PerfNames = PERF_NAMES): string {
  const t = `plc.${ident(n.ch)}`;
  return `SELECT
  (SELECT device_id FROM ${t} ORDER BY device_id, tag_id LIMIT 1) AS device,
  (SELECT tag_id FROM ${t} ORDER BY device_id, tag_id LIMIT 1) AS tag,
  (SELECT toString(quantileExact(0.5)(value)) FROM ${t}) AS v`;
}

export function chDropSql(n: PerfNames = PERF_NAMES): string {
  return `DROP TABLE IF EXISTS plc.${ident(n.ch)}`;
}

/** 이 실행의 문장만 겨눈다 — query_id 접두 = runId(UUID 형식 검사 뒤 인라인) */
export function chKillSql(runId: string): string {
  if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error(`runId 형식 위반 — ${runId}`);
  return `KILL QUERY WHERE startsWith(query_id, '${runId}') ASYNC`;
}

const END_T = "{end:DateTime64(3, 'UTC')}";

/** §동일 쿼리 5종 ClickHouse 쪽 — 매개변수 {device:UInt32} · {tag:UInt32} · {end} · {v:Float64} */
export function chQuerySql(q: PerfQuery, n: PerfNames = PERF_NAMES): string {
  const t = `plc.${ident(n.ch)}`;
  switch (q) {
    case 'Q1':
      return `SELECT ts, value, quality FROM ${t}
WHERE device_id = {device:UInt32} AND tag_id = {tag:UInt32} AND ts >= ${END_T} - INTERVAL 1 HOUR AND ts < ${END_T}
ORDER BY ts`;
    case 'Q2':
      return `SELECT toStartOfHour(ts) AS b, avg(value), min(value), max(value), count() FROM ${t}
WHERE device_id = {device:UInt32} AND tag_id = {tag:UInt32} AND ts >= ${END_T} - INTERVAL 7 DAY AND ts < ${END_T}
GROUP BY b ORDER BY b`;
    case 'Q3':
      return `SELECT tag_id, avg(value), min(value), max(value), count() FROM ${t}
WHERE device_id = {device:UInt32} AND ts >= ${END_T} - INTERVAL 1 DAY AND ts < ${END_T}
GROUP BY tag_id`;
    case 'Q4':
      return `SELECT toStartOfMinute(ts) AS b, device_id, tag_id,
       count(), avg(value), min(value), max(value), countIf(quality IN (2, 4))
FROM ${t}
WHERE ts >= ${END_T} - INTERVAL 1 HOUR AND ts < ${END_T}
GROUP BY b, device_id, tag_id`;
    case 'Q5':
      return `SELECT count() FROM ${t} WHERE value > {v:Float64}`;
  }
}

// ── PostgreSQL

/**
 * 실행 수명 객체 생성 · 정리 — 런타임(app_rw)은 DDL 권한이 없어 app_owner 소유 SECURITY DEFINER 함수로만 한다(마이그레이션 010).
 * run_perf_create(from, to): 대조군 동형 부모 + [from, to)를 덮는 UTC 일 파티션 + I2(BRIN(ts) + btree(device_id, tag_id, ts)) · 반환 = 파티션 수.
 * 이름은 run_perf_raw 하나로 고정(함수 안) — 동시 1 · 부팅 정리가 이름으로 찾는다.
 */
export const PG_CREATE_CALL = 'SELECT run_perf_create($1::timestamptz, $2::timestamptz) AS parts';
export const PG_DROP_CALL = 'SELECT run_perf_drop()';
export const PG_EXISTS_SQL = "SELECT to_regclass('run_perf_raw') IS NOT NULL AS present";

/** 생성 구간 [S, S + 10^max ÷ 10^4초) — ISO(UTC) */
export function pgCreateArgs(startSec: number, maxExponent: number): [string, string] {
  return [
    new Date(startSec * 1000).toISOString(),
    new Date((startSec + 10 ** maxExponent / PERF_TAGS) * 1000).toISOString(),
  ];
}

/** 규모 증가분 채우기 — $1 S · $2 첫 n · $3 끝 n(포함) */
export function pgFillSql(n: PerfNames = PERF_NAMES): string {
  return `INSERT INTO ${ident(n.pg)} (ts, value, scan_seq, device_id, tag_id, quality)
SELECT to_timestamp($1::bigint + n / 10000),
       (((n % 10000 + 1) * 7 + (n / 10000) * 13) % 1000)::double precision / 10,
       n / 10000,
       (n % 10000) / 200 + 1,
       n % 10000 + 1,
       9
FROM generate_series($2::bigint, $3::bigint) AS n
ORDER BY n`;
}

export function pgFillParams(startSec: number, k: number): [number, number, number] {
  const r = scaleRows(k);
  return [startSec, r.lo, r.hi - 1];
}

export function pgAnalyzeSql(n: PerfNames = PERF_NAMES): string {
  return `ANALYZE ${ident(n.pg)}`;
}

/** 파티션 합(부모 · 파티션 인덱스는 파티션 크기에 든다) */
export function pgStorageSql(): string {
  return `SELECT coalesce(sum(pg_total_relation_size(inhrelid)), 0)::bigint AS b
FROM pg_inherits WHERE inhparent = to_regclass($1)`;
}

/** §동일 쿼리 5종 PostgreSQL 쪽 — grid.py PREPARE 본문과 같다(자리표시 $1 …) */
export function pgQuerySql(q: PerfQuery, n: PerfNames = PERF_NAMES): string {
  const t = ident(n.pg);
  switch (q) {
    case 'Q1':
      return `SELECT ts, value, quality FROM ${t}
WHERE device_id = $1 AND tag_id = $2 AND ts >= $3 - interval '1 hour' AND ts < $3
ORDER BY ts`;
    case 'Q2':
      return `SELECT date_trunc('hour', ts) AS b, avg(value), min(value), max(value), count(*) FROM ${t}
WHERE device_id = $1 AND tag_id = $2 AND ts >= $3 - interval '7 days' AND ts < $3
GROUP BY b ORDER BY b`;
    case 'Q3':
      return `SELECT tag_id, avg(value), min(value), max(value), count(*) FROM ${t}
WHERE device_id = $1 AND ts >= $2 - interval '1 day' AND ts < $2
GROUP BY tag_id`;
    case 'Q4':
      return `SELECT date_trunc('minute', ts) AS b, device_id, tag_id,
       count(*), avg(value), min(value), max(value), count(*) FILTER (WHERE quality IN (2, 4))
FROM ${t}
WHERE ts >= $1 - interval '1 hour' AND ts < $1
GROUP BY b, device_id, tag_id`;
    case 'Q5':
      return `SELECT count(*) FROM ${t} WHERE value > $1`;
  }
}

export interface PerfQueryParams {
  device: number;
  tag: number;
  /** 그 규모의 데이터 끝(epoch ms) */
  endMs: number;
  v: number;
}

/** 쿼리별 매개변수 — ClickHouse 이름 · PostgreSQL 위치(grid.py CH_PARAMS 순서) */
export function queryArgs(
  q: PerfQuery,
  p: PerfQueryParams,
): { ch: Record<string, number | string>; pg: (number | string)[] } {
  const end = { ch: chDateTime(p.endMs), pg: new Date(p.endMs).toISOString() };
  switch (q) {
    case 'Q1':
    case 'Q2':
      return { ch: { device: p.device, tag: p.tag, end: end.ch }, pg: [p.device, p.tag, end.pg] };
    case 'Q3':
      return { ch: { device: p.device, end: end.ch }, pg: [p.device, end.pg] };
    case 'Q4':
      return { ch: { end: end.ch }, pg: [end.pg] };
    case 'Q5':
      return { ch: { v: p.v }, pg: [p.v] };
  }
}
