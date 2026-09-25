-- 004 — tag_1m 분 롤업(정본 docs/05_data_stores/04_clickhouse_rollup.md §tag_1m) — 윈도우는 종속 MV 중복 제거 설정과 한 쌍(ADR-14 보강)
CREATE TABLE IF NOT EXISTS plc.tag_1m
(
    bucket    DateTime('Asia/Seoul') CODEC(Delta(4), ZSTD(1)),
    device_id UInt32,
    tag_id    UInt32,
    cnt       AggregateFunction(count),
    avg_v     AggregateFunction(avg, Float64),
    min_v     AggregateFunction(min, Float64),
    max_v     AggregateFunction(max, Float64),
    last_v    AggregateFunction(argMax, Float64, DateTime64(3, 'Asia/Seoul')),
    p95_v     AggregateFunction(quantilesTDigest(0.95), Float64),
    bad_cnt   AggregateFunction(countIf, UInt8)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (device_id, tag_id, bucket)
TTL bucket + INTERVAL 90 DAY DELETE
SETTINGS ttl_only_drop_parts = 1,
         non_replicated_deduplication_window = 1000;
