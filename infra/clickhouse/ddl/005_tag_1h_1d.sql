-- 005 — tag_1h · tag_1d(정본 docs/05_data_stores/04_clickhouse_rollup.md §tag_1h · tag_1d · 상위 MV) — 구조는 tag_1m과 같다(MV 제약 #6)
CREATE TABLE IF NOT EXISTS plc.tag_1h AS plc.tag_1m
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (device_id, tag_id, bucket)
TTL bucket + INTERVAL 730 DAY DELETE
SETTINGS ttl_only_drop_parts = 1,
         non_replicated_deduplication_window = 1000;

CREATE TABLE IF NOT EXISTS plc.tag_1d AS plc.tag_1m
ENGINE = AggregatingMergeTree
PARTITION BY toYear(bucket)
ORDER BY (device_id, tag_id, bucket)
SETTINGS non_replicated_deduplication_window = 1000;
