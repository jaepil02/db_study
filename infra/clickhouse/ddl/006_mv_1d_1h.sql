-- 006 — 상위 MV 둘(위에서 아래로 — 연쇄 입구 mv_tag_1m은 007이 마지막에 연다 · 09_migrations_seed §저장소 간 적용 순서 ⑥)
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
