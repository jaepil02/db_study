-- 003 — alarm_eval 판정 전수(정본 docs/05_data_stores/03_clickhouse_schema.md §alarm_eval) — 쓰기는 알람 판정(S7)이 한다 · S3는 객체만 둔다
CREATE TABLE IF NOT EXISTS plc.alarm_eval
(
    ts        DateTime64(3, 'Asia/Seoul') CODEC(Delta(8), ZSTD(1)),
    rule_id   UInt32,
    tag_id    UInt32,
    value     Float64                     CODEC(Gorilla, ZSTD(1)),
    breached  UInt8,
    severity  UInt8
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (rule_id, ts)
TTL toDateTime(ts) + INTERVAL 30 DAY DELETE
SETTINGS non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1;
