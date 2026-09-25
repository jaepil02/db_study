-- 007 — 연쇄 입구 mv_tag_1m(정본 docs/05_data_stores/04_clickhouse_rollup.md §tag_1m · mv_tag_1m · bad_cnt는 품질 2 · 4만)
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
