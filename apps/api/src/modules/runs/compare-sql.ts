// 직접 비교 SQL — 두 저장소에 같은 뜻의 질의(정본 docs/07_api/09_datagen.md)
// ClickHouse는 파라미터 바인딩({name:Type})으로 · PostgreSQL은 $n으로 넘긴다(REQ-GLB-24 — 문자열 연결로 값을 넣지 않는다).
// 예외: ClickHouse ALTER(파티션 · 변이) 문은 코드가 만든 정수 시각 · 'YYYYMMDD' 파티션 ID만 검사 뒤 넣는다(chMs · chPartitionId).
// 비교 사본은 TimescaleDB hypertable이다(ADR-32 · 마이그레이션 009) — 넣은 구간의 칸(chunk)은 크기를 재기 전에 열 압축하고,
// 시간 묶음은 TimescaleDB의 time_bucket으로 쓴다.

const CH_RANGE = 'ts >= fromUnixTimestamp64Milli({s:Int64}) AND ts < fromUnixTimestamp64Milli({e:Int64})';

// ── ② 조회 대결 — 원천 N행 집계(사용자 결정 2026-10-12 · 원천 행 수 10단계)
// 원천 N행 = 구간 시작부터 (시각 · 설비 · 태그) 순으로 N번째 행(자른 자리 t · d · g)까지 — "자른 시각 앞의 행 전부 + 자른 시각에서
// 설비 · 태그 순으로 (d, g)까지"를 UNION ALL로 잇는다. 같은 뜻의 OR 한 줄(ts < t OR (d, g) 비교)은 PostgreSQL에서 압축 칸의 벡터 필터를
// 타지 못하고 계획기가 직렬 집계를 골라, 5천만 행에서 UNION ALL(병렬 작업자 · 1.1초)의 두 배(2.2초)가 걸렸다(2026-10-12 실측 —
// ClickHouse는 두 모양이 같은 수준). 두 저장소가 같은 모양 · 같은 자른 자리를 쓴다.
// 결과는 칸(설비 · 태그 · 1시간)마다 행 수 · 평균 · 값 체크섬(floor(value × 1000)의 정수 합 — ③ 정합성과 같은 규칙)이라
// 행 수 합으로 원천이 정확히 N행인지, 칸마다 두 저장소를 맞춰 정합성을 본다. 1시간 칸 시작은 epoch(UTC) — 두 저장소가 같은 경계다.

export interface SizeAggSql {
  clickhouse: string;
  postgres: string;
}

export const SIZE_AGG_SQL: SizeAggSql = {
  // 별칭(h · n · v · s)을 열 이름과 다르게 둔다 — ClickHouse는 별칭이 WHERE · 다른 집계 안의 같은 이름을 가린다
  clickhouse: `SELECT device_id, tag_id, toUnixTimestamp(toStartOfHour(ts)) AS h, count() AS n, avg(value) AS v,
       sum(toInt64(floor(value * 1000))) AS s
  FROM (
    SELECT device_id, tag_id, ts, value FROM plc.tag_raw
     WHERE ts >= fromUnixTimestamp64Milli({s:Int64}) AND ts < fromUnixTimestamp64Milli({t:Int64})
    UNION ALL
    SELECT device_id, tag_id, ts, value FROM plc.tag_raw
     WHERE ts = fromUnixTimestamp64Milli({t:Int64}) AND (device_id, tag_id) <= ({d:UInt32}, {g:UInt32})
  )
 GROUP BY device_id, tag_id, h ORDER BY device_id, tag_id, h`,
  postgres: `SELECT device_id, tag_id, time_bucket('1 hour', ts) AS h, count(*) AS n, avg(value) AS v,
       sum(floor(value * 1000)::bigint) AS s
  FROM (
    SELECT device_id, tag_id, ts, value FROM plc_tag_raw_control WHERE ts >= $1 AND ts < $2
    UNION ALL
    SELECT device_id, tag_id, ts, value FROM plc_tag_raw_control WHERE ts = $2 AND (device_id, tag_id) <= ($3, $4)
  ) x
 GROUP BY device_id, tag_id, h ORDER BY device_id, tag_id, h`,
};

/**
 * 단계마다 N번째 행이 든 초와 그 앞 초까지의 누적 행 수(ClickHouse 안에서 계산 · 측정 밖 준비) — 단계 하나에 한 줄.
 * 초별 행 수를 누적해(윈도 함수) 앞 초까지 누적 < N ≤ 그 초까지 누적인 초를 고른다(compare-query cutSeconds와 같은 규칙).
 * 초별 행 수를 api로 가져오지 않는다 — 10억 넣기면 약 433만 초라 그대로 받으면 api 메모리를 위협한다. 원천이 N보다 적으면 그 단계 줄이 없다.
 */
export const CH_SECOND_CUTS = `SELECT t AS target, sec, before FROM (
   SELECT sec, n, sum(n) OVER (ORDER BY sec ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS before FROM (
     SELECT intDiv(toUnixTimestamp64Milli(ts), 1000) * 1000 AS sec, count() AS n
       FROM plc.tag_raw WHERE ${CH_RANGE} GROUP BY sec
   )
 ) ARRAY JOIN {targets:Array(UInt64)} AS t
 WHERE before < t AND before + n >= t ORDER BY t`;

/** 초 하나의 원천 행 — (시각 · 설비 · 태그) 순(자른 자리를 고른다 · 카드 라인이면 231행) */
export const CH_SECOND_ROWS = `SELECT toUnixTimestamp64Milli(ts) AS t, device_id AS d, tag_id AS g
  FROM plc.tag_raw WHERE ${CH_RANGE} ORDER BY ts, device_id, tag_id`;

// ── 행 수 · 크기(구간)

/** 구간 행 수 — 파티션별 구간 안 · 전체(크기를 구간 몫으로 나눌 때 쓴다) */
export const CH_PARTITION_ROWS = `SELECT _partition_id AS p, countIf(${CH_RANGE}) AS in_range, count() AS total
  FROM plc.tag_raw WHERE _partition_id IN {ids:Array(String)} GROUP BY p`;

export const CH_PARTITION_BYTES = `SELECT partition_id AS p, sum(bytes_on_disk) AS bytes FROM system.parts
 WHERE database = 'plc' AND table = 'tag_raw' AND active AND partition_id IN {ids:Array(String)}
 GROUP BY p`;

/** ts의 UTC 날 — hypertable 칸(1일 · 경계 UTC 자정)과 같은 날이다 */
export const PG_PARTITION_ROWS = `SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYYMMDD') AS p,
       count(*) FILTER (WHERE ts >= $1 AND ts < $2) AS in_range, count(*) AS total
  FROM plc_tag_raw_control WHERE ts >= $3 AND ts < $4 GROUP BY p`;

/**
 * 날(UTC 'YYYYMMDD')별 칸 크기 — chunks_detailed_size는 압축된 칸이면 압축 데이터까지 센다.
 * pg_inherits로 칸 표만 더하면 압축 뒤 거의 0이 된다(압축 데이터는 칸 표가 아니라 따로 둔 압축 표에 있다).
 */
export const PG_CHUNK_BYTES = `SELECT to_char(c.range_start AT TIME ZONE 'UTC', 'YYYYMMDD') AS p, s.total_bytes AS bytes
  FROM timescaledb_information.chunks c
  JOIN chunks_detailed_size('plc_tag_raw_control') s ON s.chunk_schema = c.chunk_schema AND s.chunk_name = c.chunk_name
 WHERE c.hypertable_schema = 'public' AND c.hypertable_name = 'plc_tag_raw_control'
   AND to_char(c.range_start AT TIME ZONE 'UTC', 'YYYYMMDD') = ANY($1::text[])`;

/** 구간 행 수(ClickHouse — 파티션 · 열 하나만 읽는다) */
export const CH_RANGE_ROWS = `SELECT count() AS n FROM plc.tag_raw WHERE ${CH_RANGE}`;

/** 구간 안 행이 하나라도 있는가 — 조회 대결의 사전 확인(전체를 세지 않는다) */
export const CH_HAS_ROWS = `SELECT count() AS n FROM (SELECT 1 FROM plc.tag_raw WHERE ${CH_RANGE} LIMIT 1)`;
export const PG_HAS_ROWS =
  'SELECT EXISTS (SELECT 1 FROM plc_tag_raw_control WHERE ts >= $1 AND ts < $2) AS has';

// ── ③ 데이터 정합성 — 구간을 한 번 훑어 묶음(설비 · 태그 · 1시간)마다 행 수 · 값 합계 · 최소 · 최대 · 행 지문 합
// 네 기준(행 수 · 값 합계 · 묶음 집계 · 행 지문)이 이 결과 하나에서 나온다 — 행 수 · 합계 · 지문은 묶음 값의 정수 합이라 더하는 순서와 무관하다.
// 값 합계는 round(value × 1000)의 정수 합 — 부동소수를 그대로 더하면 같은 데이터라도 두 DB의 끝자리가 갈린다
//   (5억 행 실측 2026-10-13: sum(value) PG …576.16 · CH …576.12). 두 DB의 실수 반올림은 같은 규칙(짝수 쪽 — 62.5 → 62 · 63.5 → 64)이라
//   같은 값이면 같은 정수가 된다(같은 5억 행의 반올림 경계값 34만 건에서도 합이 같았다).
// 최소 · 최대는 64비트 모양(16자리 hex)으로 맞춘다 — 글자로 바꾸면 표기 규칙이 DB마다 다를 수 있다.
// 행 지문 = 6열의 원래 바이트(빅엔디언 — PostgreSQL *send 함수)를 이어 붙인 MD5의 앞 8바이트(부호 있는 64비트).
//   ClickHouse는 같은 바이트를 hex → unhex로 만든다(reinterpretAsString은 끝의 0바이트를 떼어 길이가 달라진다) ·
//   시각은 2000-01-01부터의 마이크로초(timestamptz_send) · 글자로 이어 붙이는 것보다 PostgreSQL에서 약 30% 빠르다(하루치 5.4 → 3.8초 실측).
//   묶음 합은 넘치지 않게 더한다(ClickHouse Int128 · PostgreSQL numeric) — ClickHouse sum(Int64)은 조용히 넘친다.
// 묶음 시작은 epoch 초(1시간 배수 · UTC) — 두 저장소가 같은 경계를 쓴다.

const CH_ROW_FINGERPRINT = `reinterpretAsInt64(reverse(substring(MD5(concat(
         unhex(leftPad(hex(toUInt32(device_id)), 8, '0')),
         unhex(leftPad(hex(toUInt32(tag_id)), 8, '0')),
         unhex(leftPad(hex(toInt64(toUnixTimestamp64Micro(ts) - 946684800000000)), 16, '0')),
         unhex(leftPad(hex(reinterpretAsUInt64(value)), 16, '0')),
         unhex(leftPad(hex(toUInt16(quality)), 4, '0')),
         unhex(leftPad(hex(scan_seq), 16, '0')))), 1, 8)))`;

// 별칭(d · g · hr · n · s · lo · hi · f)을 열 이름과 다르게 둔다 — ClickHouse는 별칭이 다른 집계 안의 같은 이름을 가린다
export const CH_CONSISTENCY_GROUPS = `SELECT device_id AS d, tag_id AS g, toUnixTimestamp(toStartOfHour(ts)) AS hr, count() AS n,
       sum(toInt64(round(value * 1000))) AS s,
       lower(leftPad(hex(reinterpretAsUInt64(min(value))), 16, '0')) AS lo,
       lower(leftPad(hex(reinterpretAsUInt64(max(value))), 16, '0')) AS hi,
       toString(sum(toInt128(${CH_ROW_FINGERPRINT}))) AS f
  FROM plc.tag_raw WHERE ${CH_RANGE}
 GROUP BY d, g, hr`;

export const PG_CONSISTENCY_GROUPS = `SELECT device_id AS d, tag_id AS g, extract(epoch FROM time_bucket('1 hour', ts))::bigint AS hr,
       count(*) AS n, sum(round(value * 1000)::bigint) AS s,
       encode(float8send(min(value)), 'hex') AS lo, encode(float8send(max(value)), 'hex') AS hi,
       sum(('x' || left(md5(int4send(device_id) || int4send(tag_id) || timestamptz_send(ts) || float8send(value)
         || int2send(quality) || int8send(scan_seq)), 16))::bit(64)::bigint) AS f
  FROM plc_tag_raw_control WHERE ts >= $1 AND ts < $2
 GROUP BY 1, 2, 3`;

// ── 압축 · 정리(PostgreSQL은 app_owner SECURITY DEFINER 함수 — 마이그레이션 007 · 009)
// 칸은 넣을 때 스스로 생긴다(hypertable) — 미리 만들 함수가 없다.

/** 구간이 걸친 칸 중 아직 압축하지 않은 것을 열 압축 · 압축한 칸 수 */
export const PG_COMPRESS_RANGE = 'SELECT control_compress_range($1, $2) AS compressed';
/** 넣는 도중 다 들어간 날 칸만 압축 — 통계를 다시 모으지 않는다(칸이 수십 개면 ANALYZE가 매번 표 전체를 돈다 · 마이그레이션 011) */
export const PG_COMPRESS_DAYS = 'SELECT control_compress_days($1, $2) AS compressed';
export const PG_CLEAR_RANGE = 'SELECT control_clear_range($1, $2)';
export const PG_PURGE = 'SELECT control_purge()';

/** 카드 라인 활성 설비 · 태그(시드) — 생성기 · 조회 대결의 대상 · 정합성이 다른 묶음의 이름을 붙인다 */
export const PG_CARD_TAGS = `SELECT d.device_id, d.device_code, t.tag_id, t.tag_code
  FROM tag_master t JOIN device d ON d.device_id = t.device_id
 WHERE t.is_active AND d.is_active AND d.device_code ~ '^L[1-3]-[A-Z]{3}$'
 ORDER BY d.device_id, t.tag_id`;

/** ALTER 문에 넣는 시각 — 안전 정수만 */
export function chMs(ms: number): string {
  if (!Number.isSafeInteger(ms)) throw new Error(`시각이 정수 ms가 아니다 — ${ms}`);
  return `fromUnixTimestamp64Milli(toInt64(${ms}))`;
}

/** ALTER 문에 넣는 파티션 ID — 'YYYYMMDD'만 */
export function chPartitionId(id: string): string {
  if (!/^\d{8}$/.test(id)) throw new Error(`파티션 ID 모양이 아니다 — ${id}`);
  return `'${id}'`;
}

/** 원본 구간 비우기 — 통째로 든 날은 DROP PARTITION · 걸친 날은 그 파티션 안 구간만 동기 변이 */
export function chClearRawStatements(
  range: { start: number; end: number },
  wholeDays: readonly string[],
  touchedDays: readonly string[],
): string[] {
  const out = wholeDays.map((id) => `ALTER TABLE plc.tag_raw DROP PARTITION ID ${chPartitionId(id)}`);
  for (const id of touchedDays) {
    if (wholeDays.includes(id)) continue;
    out.push(
      `ALTER TABLE plc.tag_raw DELETE IN PARTITION ID ${chPartitionId(id)} WHERE ts >= ${chMs(range.start)} AND ts < ${chMs(range.end)} SETTINGS mutations_sync = 1`,
    );
  }
  return out;
}

/**
 * 롤업 구간 비우기 — 분 · 시간은 버킷이 구간에 걸치면 · 일은 그 KST 날 버킷 통째로(롤업은 날 단위 합이라 구간만 덜어 낼 수 없다).
 * 같은 날의 다른 데이터(가동 · 다른 시험 창)의 일 롤업도 함께 사라진다 — 원본은 남는다.
 */
export function chClearRollupStatements(range: { start: number; end: number }): string[] {
  const s = Math.floor(range.start / 1000);
  const e = Math.ceil(range.end / 1000);
  return [
    `ALTER TABLE plc.tag_1m DELETE WHERE bucket >= toStartOfMinute(toDateTime(${s})) AND bucket < toDateTime(${e}) SETTINGS mutations_sync = 1`,
    `ALTER TABLE plc.tag_1h DELETE WHERE bucket >= toStartOfHour(toDateTime(${s})) AND bucket < toDateTime(${e}) SETTINGS mutations_sync = 1`,
    `ALTER TABLE plc.tag_1d DELETE WHERE bucket >= toStartOfDay(toDateTime(${s}), 'Asia/Seoul') AND bucket < toDateTime(${e}) SETTINGS mutations_sync = 1`,
  ];
}

/** 크기를 재기 전 병합 — 넣은 직후의 작은 파트(배치 하나 = 파트 하나)가 아니라 자리 잡은 크기를 잰다 */
export function chOptimizeStatement(id: string): string {
  return `OPTIMIZE TABLE plc.tag_raw PARTITION ID ${chPartitionId(id)} FINAL`;
}

/** 센서 데이터 지우기 — 원본 · 요약 넷(MV는 그대로 · 설비 · 태그 사전은 PostgreSQL에 있다) */
export const CH_PURGE_TABLES = ['tag_raw', 'tag_1m', 'tag_1h', 'tag_1d'] as const;
export const CH_TOTAL_ROWS = 'SELECT count() AS n FROM plc.tag_raw';
export const CH_TOTAL_BYTES = `SELECT sum(bytes_on_disk) AS bytes FROM system.parts
 WHERE database = 'plc' AND table = 'tag_raw' AND active`;
export const PG_TOTAL_ROWS = 'SELECT count(*) AS n FROM plc_tag_raw_control';
/** 전체 크기 — 칸 · 압축 데이터 · 목차를 다 센다 */
export const PG_TOTAL_BYTES = `SELECT coalesce(hypertable_size('plc_tag_raw_control'), 0) AS bytes`;
/** 행 수 추정 — 압축된 칸까지 센다(통계가 아직 없으면 0) */
export const PG_ESTIMATE_ROWS = `SELECT approximate_row_count('plc_tag_raw_control') AS n`;
