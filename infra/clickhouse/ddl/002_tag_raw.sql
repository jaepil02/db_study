-- 002 — 원시 테이블 tag_raw(DDL 정본 docs/05_data_stores/03_clickhouse_schema.md §tag_raw — 원시 테이블)
-- ts는 적재 코드가 epoch ms 정수로 보낸다 · ingested_at은 서버 DEFAULT가 채운다 — E2E = ingested_at − ts(REQ-GLB-01)
CREATE TABLE IF NOT EXISTS plc.tag_raw
(
    ts          DateTime64(3, 'Asia/Seoul')                  CODEC(Delta(8), ZSTD(1)),
    device_id   UInt32                                       CODEC(Delta(4), ZSTD(1)),
    tag_id      UInt32                                       CODEC(Delta(4), ZSTD(1)),
    value       Float64                                      CODEC(Gorilla, ZSTD(1)),
    quality     UInt8                                        CODEC(ZSTD(1)),
    scan_seq    UInt64                                       CODEC(Delta(8), ZSTD(1)),
    ingested_at DateTime64(3, 'Asia/Seoul') DEFAULT now64(3) CODEC(Delta(8), ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (device_id, tag_id, ts)
TTL toDateTime(ts) + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192,
         non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1;
