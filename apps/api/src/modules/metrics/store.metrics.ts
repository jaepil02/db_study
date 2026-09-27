// 저장소 계열(OBS-02 · S5) · 관측 자체 계열 — 이름 정본 docs/10_observability/01_metrics_catalog.md §저장소 · §E2E · 관측 자체
// 저장소 통계는 수집 주기(15초)마다 모아 두고 스크레이프는 마지막 값만 낸다(REQ-OBS-03 · 07_api/10 #2).
// 저장소 쪽 누적값(xact_commit · evicted_keys · InsertedRows 등)은 counter로 내되 값은 서버 누적값을 그대로 옮긴다(mirrorCounter) —
// 앱이 따로 세면 api 재기동과 서버 재기동이 서로 다른 0점을 만든다. 서버 쪽 리셋은 Prometheus counter 리셋 규칙이 흡수한다.
// redis_prefix_memory_bytes · redis_prefix_sampled_keys는 OBS-03(S6)이라 여기에 없다.
import { Counter, Gauge, Histogram } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';

const reg = [appRegistry];

export type StoreName = 'redis' | 'postgres' | 'clickhouse';

type Clearable = { reset(): void; remove(...a: never[]): void; labelNames?: readonly string[] };

/**
 * 계열을 비운다 — prom-client는 레이블 없는 계열을 reset() 뒤에도 0으로 낸다. 0은 "값 0"으로 읽혀
 * (예: ch_disk_free_bytes 0 → 디스크 잔여 알림) 비움과 다르다 — 기본 시계열까지 지운다(remove()).
 */
export function clearMetric(...ms: Clearable[]): void {
  for (const m of ms) {
    m.reset();
    // 레이블 있는 계열은 reset()으로 이미 비었다 — remove()는 레이블 없는 계열의 기본 시계열만 지운다
    if ((m.labelNames ?? []).length === 0) (m.remove as () => void).call(m);
  }
}

/** 서버 누적값을 counter에 옮긴다 — 수집 한 번에 레이블 집합 전체를 다시 쓴다(사라진 레이블은 빈다) */
export function mirrorCounter<L extends string>(
  c: Counter<L>,
  entries: ReadonlyArray<readonly [Partial<Record<L, string>>, number]>,
): void {
  clearMetric(c);
  for (const [labels, v] of entries) {
    if (Number.isFinite(v) && v >= 0) c.inc(labels, v);
  }
}

/** 게이지 한 계열을 레이블 집합째 다시 쓴다 — 이번 수집에 없는 레이블은 남기지 않는다 */
export function replaceGauge<L extends string>(
  g: Gauge<L>,
  entries: ReadonlyArray<readonly [Partial<Record<L, string>>, number]>,
): void {
  clearMetric(g);
  for (const [labels, v] of entries) {
    if (Number.isFinite(v)) g.set(labels, v);
  }
}

// ── Redis 9행 · 11이름(카탈로그 11행에서 OBS-03 표본 2행 제외) ──
export const redisMetrics = {
  usedMemory: new Gauge({
    name: 'redis_used_memory_bytes',
    help: '사용 메모리(INFO used_memory)',
    registers: reg,
  }),
  maxMemory: new Gauge({
    name: 'redis_maxmemory_bytes',
    help: '메모리 상한(INFO maxmemory)',
    registers: reg,
  }),
  fragmentation: new Gauge({
    name: 'redis_mem_fragmentation_ratio',
    help: '단편화(INFO mem_fragmentation_ratio) — 컨테이너 상한 여유',
    registers: reg,
  }),
  evicted: new Counter({
    name: 'redis_evicted_keys_total',
    help: '축출 수(INFO evicted_keys)',
    registers: reg,
  }),
  hits: new Counter({
    name: 'redis_keyspace_hits_total',
    help: '인스턴스 전체 적중(INFO keyspace_hits) — 히트율 판정에 쓰지 않는다',
    registers: reg,
  }),
  misses: new Counter({
    name: 'redis_keyspace_misses_total',
    help: '인스턴스 전체 부적중(INFO keyspace_misses) — 히트율 판정에 쓰지 않는다',
    registers: reg,
  }),
  opsPerSec: new Gauge({
    name: 'redis_ops_per_sec',
    help: '명령 처리율(INFO instantaneous_ops_per_sec)',
    registers: reg,
  }),
  clientOutputBuffer: new Gauge({
    name: 'redis_client_output_buffer_bytes',
    help: '일반 · Pub/Sub 클라이언트 버퍼 합(INFO mem_clients_normal) — 한도 접근 감시',
    registers: reg,
  }),
  streamLength: new Gauge({
    name: 'redis_stream_length',
    help: 'XLEN — 메모리 양 · 트리밍 감시 전용 · 적체 판정 금지',
    labelNames: ['stream'] as const,
    registers: reg,
  }),
  entriesAdded: new Counter({
    name: 'redis_stream_entries_added_total',
    help: '누적 XADD 수(XINFO STREAM entries-added)',
    labelNames: ['stream'] as const,
    registers: reg,
  }),
  // 앱이 센다(서버 누적값이 없다) — 수집 실패에도 비우지 않는다(검출 사건은 지워지면 안 된다)
  trimmedUnacked: new Counter({
    name: 'stream_trimmed_unacked',
    help: '미확인(PEL · 미배달) 엔트리가 트리밍으로 잘린 수 — 0이어야 한다',
    registers: reg,
  }),
};

// ── PostgreSQL 8행 · 9이름 ──
export const pgMetrics = {
  xactCommit: new Counter({
    name: 'pg_xact_commit_total',
    help: '커밋 수(pg_stat_database.xact_commit) — TPS',
    registers: reg,
  }),
  connections: new Gauge({
    name: 'pg_connections',
    help: '상태별 연결 수(pg_stat_activity.state)',
    labelNames: ['state'] as const,
    registers: reg,
  }),
  bufferHitRatio: new Gauge({
    name: 'pg_buffer_hit_ratio',
    help: '버퍼 적중률 blks_hit ÷ (blks_hit + blks_read) — 통계 리셋 이후 누적',
    registers: reg,
  }),
  lockWaits: new Gauge({ name: 'pg_lock_waits', help: '대기 중인 락(pg_locks NOT granted)', registers: reg }),
  statementTopMean: new Gauge({
    name: 'pg_statement_top_mean_seconds',
    help: '평균 시간 상위 10 문형(pg_stat_statements) — 문형 텍스트는 싣지 않는다',
    labelNames: ['rank', 'queryid'] as const,
    registers: reg,
  }),
  liveTuples: new Gauge({
    name: 'pg_table_live_tuples',
    help: '살아 있는 행(pg_stat_user_tables.n_live_tup · 통계 추정치 · 파티션은 부모로 합산) — 행당 바이트의 분모',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  deadTuples: new Gauge({
    name: 'pg_table_dead_tuples',
    help: '데드 튜플(pg_stat_user_tables · 파티션은 부모로 합산)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  autovacuum: new Counter({
    name: 'pg_autovacuum_total',
    help: 'autovacuum 실행(pg_stat_user_tables.autovacuum_count · 파티션은 부모로 합산)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  relationSize: new Gauge({
    name: 'pg_relation_size_bytes',
    help: '테이블(pg_table_size) · 인덱스(pg_indexes_size) 크기 — 파티션은 부모로 합산',
    labelNames: ['table', 'kind'] as const,
    registers: reg,
  }),
  walBytes: new Counter({ name: 'pg_wal_bytes_total', help: 'WAL 누적 바이트(pg_stat_wal)', registers: reg }),
};

// ── ClickHouse 9행 · 11이름 ──
export const chMetrics = {
  insertedRows: new Counter({
    name: 'ch_inserted_rows_total',
    help: '서버가 받은 삽입 행(system.events InsertedRows)',
    registers: reg,
  }),
  activeParts: new Gauge({
    name: 'ch_active_parts',
    help: '활성 파트 수(system.parts active)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  newParts: new Counter({
    name: 'ch_new_parts_total',
    help: '새 파트 생성(system.part_log NewPart · api 기동 시각 이후 누적)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  mergesRunning: new Gauge({
    name: 'ch_merges_running',
    help: '진행 중 머지(system.metrics Merge)',
    registers: reg,
  }),
  mergeWrittenBytes: new Counter({
    name: 'ch_merge_written_bytes_total',
    help: '머지가 다시 쓴 바이트(system.part_log MergeParts size_in_bytes · api 기동 시각 이후 누적)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  partsBytesOnDisk: new Gauge({
    name: 'ch_parts_bytes_on_disk',
    help: '활성 파트 디스크 크기(system.parts bytes_on_disk)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  partsRows: new Gauge({
    name: 'ch_parts_rows',
    help: '활성 파트 행 수 합(system.parts rows · active) — 행당 바이트의 분모',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  partsUncompressed: new Gauge({
    name: 'ch_parts_uncompressed_bytes',
    help: '활성 파트 비압축 크기(system.parts data_uncompressed_bytes)',
    labelNames: ['table'] as const,
    registers: reg,
  }),
  queryP95: new Gauge({
    name: 'ch_query_duration_p95_seconds',
    help: '직전 수집 창의 쿼리 p95(system.query_log QueryFinish · 관측 쿼리 제외)',
    registers: reg,
  }),
  memoryTracking: new Gauge({
    name: 'ch_memory_tracking_bytes',
    help: '서버 메모리 추적 값(system.metrics MemoryTracking)',
    registers: reg,
  }),
  diskFree: new Gauge({
    name: 'ch_disk_free_bytes',
    help: '데이터 디스크 여유(system.disks default free_space)',
    registers: reg,
  }),
  diskTotal: new Gauge({
    name: 'ch_disk_total_bytes',
    help: '데이터 디스크 전체(system.disks default total_space)',
    registers: reg,
  }),
};

// ── 관측 자체 ──
export const obsCollectMetrics = {
  errors: new Counter({
    name: 'obs_collect_errors_total',
    help: '저장소 통계 수집 실패 — 그 계열만 빈다',
    labelNames: ['store'] as const,
    registers: reg,
  }),
  duration: new Histogram({
    name: 'obs_collect_duration_seconds',
    help: '수집 한 번의 시간 — 관측 부하',
    labelNames: ['store'] as const,
    buckets: [0.001, 0.003, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: reg,
  }),
  lastSuccess: new Gauge({
    name: 'obs_collect_last_success_timestamp_seconds',
    help: '마지막 성공 수집 시각(epoch 초) — 그 저장소의 모든 계열이 성공한 수집',
    labelNames: ['store'] as const,
    registers: reg,
  }),
};

export const obsMetricsResponseBytes = new Gauge({
  name: 'obs_metrics_response_bytes',
  help: '직전 /metrics 응답 크기 — 카디널리티 감시',
  registers: reg,
});

// 첫 성공 수집 전에는 비어 있어야 한다 — 수집하지 않는 역할(worker · collector)도 0을 내지 않는다
clearMetric(
  ...Object.values(redisMetrics),
  ...Object.values(pgMetrics),
  ...Object.values(chMetrics),
  obsMetricsResponseBytes,
);
