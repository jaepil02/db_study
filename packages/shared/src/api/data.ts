// 센서 데이터 현황 · 지우기 계약(D-16 결정 5) — 표면 정본 docs/07_api(센서 데이터 지우기 절)
// 지우는 것은 쌓인 센서 데이터뿐이다 — 설비 · 태그 · 업무 기록 · 실행 결과(run_result)는 남긴다.
// 실행 중(runs 진행) · 설비 가동 중이면 409 data.purge_blocked — 지우는 동안 새 데이터가 들어오면 행 수가 맞지 않는다.
import { z } from 'zod';

const storeSize = z.strictObject({
  rows: z.number().int().nonnegative(),
  /** 디스크 크기(바이트) — 압축 뒤 실제 크기(CH system.parts bytes_on_disk · PG pg_total_relation_size) */
  bytes: z.number().int().nonnegative(),
});

/** #GET /api/v1/data/sensor/stats — ⑤ 머리 · 지우기 확인 창이 읽는다 */
export const SensorDataStats = z.strictObject({
  at: z.iso.datetime(),
  /** ClickHouse tag_raw(원본) */
  clickhouse: storeSize,
  /** PostgreSQL plc_tag_raw_control(비교 사본) */
  postgres: storeSize,
  /** Redis stream:plc:raw 길이 · rt:latest 설비 키 수 */
  redis: z.strictObject({
    streamLength: z.number().int().nonnegative(),
    latestKeys: z.number().int().nonnegative(),
  }),
  /** 직접 비교 넣기가 마지막으로 채운 과거 시각 구간 — 없으면 null */
  compareRange: z.strictObject({ start: z.iso.datetime(), end: z.iso.datetime() }).nullable(),
  /** 그 구간 안 행 수(두 저장소) — 위 clickhouse.rows는 가동 데이터까지 든 원본 전체라 비교 양은 이것으로 보인다 · 구간이 없으면 null */
  compareRows: z
    .strictObject({ clickhouse: z.number().int().nonnegative(), postgres: z.number().int().nonnegative() })
    .nullable(),
});
export type SensorDataStatsBody = z.infer<typeof SensorDataStats>;

const purged = z.strictObject({
  /** 지운 행 수(지우기 직전에 센 값) */
  rows: z.number().int().nonnegative(),
  elapsedMs: z.number().nonnegative(),
});

/** #POST /api/v1/data/sensor/purge 응답 */
export const SensorPurgeResult = z.strictObject({
  at: z.iso.datetime(),
  clickhouse: purged,
  postgres: purged,
  /** Redis — 대기줄 엔트리(stream:plc:raw · stream:plc:dlq) · 지운 키(rt:latest · 조회 사본) */
  redis: z.strictObject({
    streamEntries: z.number().int().nonnegative(),
    keys: z.number().int().nonnegative(),
    elapsedMs: z.number().nonnegative(),
  }),
});
export type SensorPurgeResultBody = z.infer<typeof SensorPurgeResult>;

/** data.purge_blocked의 details.reason */
/** run_in_progress 실행 진행 중 · plant_running 설비 가동 중(원하는 상태 또는 아직 도는 수집기) · stream_backlog 대기줄에 아직 처리 안 된 센서 데이터가 남음(잠시 뒤 다시) */
export const PURGE_BLOCK_REASONS = ['run_in_progress', 'plant_running', 'stream_backlog'] as const;
export type PurgeBlockReason = (typeof PURGE_BLOCK_REASONS)[number];
