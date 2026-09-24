-- S0 실습 전용 ClickHouse DDL — S2 · S3의 migrate 순번 파일(infra/clickhouse/ddl/)을 대신하지 않는다
-- 원문: docs/05_data_stores/03_clickhouse_schema.md · 04_clickhouse_rollup.md (설계 계약 그대로 — 문서의 sql 펜스에서 옮긴다)
-- 적용 순서: docs/05_data_stores/09_migrations_seed.md — DB → tag_raw → tag_1m → tag_1h · tag_1d → mv_tag_1d → mv_tag_1h → mv_tag_1m(연쇄 입구를 마지막에 연다)

CREATE DATABASE IF NOT EXISTS plc;

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

CREATE MATERIALIZED VIEW IF NOT EXISTS plc.mv_tag_1d TO plc.tag_1d AS
SELECT toStartOfDay(bucket, 'Asia/Seoul') AS bucket, device_id, tag_id,
       countMergeState(cnt) AS cnt, avgMergeState(avg_v) AS avg_v,
       minMergeState(min_v) AS min_v, maxMergeState(max_v) AS max_v,
       argMaxMergeState(last_v) AS last_v,
       quantilesTDigestMergeState(0.95)(p95_v) AS p95_v,
       countIfMergeState(bad_cnt) AS bad_cnt
FROM plc.tag_1h
GROUP BY bucket, device_id, tag_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS plc.mv_tag_1h TO plc.tag_1h AS
SELECT toStartOfHour(bucket) AS bucket, device_id, tag_id,
       countMergeState(cnt) AS cnt, avgMergeState(avg_v) AS avg_v,
       minMergeState(min_v) AS min_v, maxMergeState(max_v) AS max_v,
       argMaxMergeState(last_v) AS last_v,
       quantilesTDigestMergeState(0.95)(p95_v) AS p95_v,
       countIfMergeState(bad_cnt) AS bad_cnt
FROM plc.tag_1m
GROUP BY bucket, device_id, tag_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS plc.mv_tag_1m TO plc.tag_1m AS
SELECT
    toStartOfMinute(ts)                AS bucket,
    device_id,
    tag_id,
    countState()                       AS cnt,
    avgState(value)                    AS avg_v,
    minState(value)                    AS min_v,
    maxState(value)                    AS max_v,
    argMaxState(value, ts)             AS last_v,
    quantilesTDigestState(0.95)(value) AS p95_v,
    countIfState(quality IN (2, 4))    AS bad_cnt
FROM plc.tag_raw
GROUP BY bucket, device_id, tag_id;
