#!/usr/bin/env bash
# S0 실습 ② — ClickHouse tag_raw DDL · 수동 삽입 · 파트와 압축률 확인
# DDL 정본: docs/05_data_stores/03_clickhouse_schema.md · 04_clickhouse_rollup.md (clickhouse-ddl.sql이 그대로 옮긴 것)
# 수치는 감 확인용이다 — 압축률은 3계층 미확인(REQ-NFR-14)이며 개발 프로파일 · 합성 신호라 정본에 올리지 않는다.
source "$(dirname "$0")/_lib.sh"

step "1. DDL 적용(순서: DB → 테이블 → MV 위에서 아래로)"
cf "$(dirname "$0")/clickhouse-ddl.sql"
c "SELECT name, engine FROM system.tables WHERE database = 'plc' ORDER BY name"

step "2. 수동 삽입 — 설비 1: SINE 8태그 × 36000초 · 설비 2: RANDOM_WALK 8태그 × 36000초(quality 9 SIMULATED)"
# 파트 하나가 Wide 문턱(min_bytes_for_wide_part 기본 10 MB)을 넘어야 컬럼별 바이트가 잡힌다 — 작은 파트는 Compact다
BASE="toDateTime64(toStartOfDay(now(), 'Asia/Seoul'), 3, 'Asia/Seoul')"   # 오늘 KST 0시 — 한 파티션 안
c "INSERT INTO plc.tag_raw (ts, device_id, tag_id, value, quality, scan_seq)
   SELECT $BASE + toIntervalSecond(intDiv(number, 8)), 1, 1 + number % 8,
          50 + 10 * sin(2 * pi() * intDiv(number, 8) / 60 + number % 8), 9, intDiv(number, 8)
   FROM numbers(288000)"
c "INSERT INTO plc.tag_raw (ts, device_id, tag_id, value, quality, scan_seq)
   SELECT $BASE + toIntervalSecond(sec), 2, tag,
          50 + sum((cityHash64(sec, tag) % 1000) / 1000 - 0.5) OVER (PARTITION BY tag ORDER BY sec ROWS UNBOUNDED PRECEDING), 9, sec
   FROM (SELECT intDiv(number, 8) AS sec, 1 + number % 8 AS tag FROM numbers(288000))"

step "3. 파트 — 삽입 한 번이 파트 하나(파티션 = KST 날짜)"
c "SELECT table, name, part_type, rows, formatReadableSize(data_uncompressed_bytes) AS raw, formatReadableSize(data_compressed_bytes) AS stored,
          round(data_uncompressed_bytes / data_compressed_bytes, 2) AS ratio, round(bytes_on_disk / rows, 2) AS bytes_per_row
   FROM system.parts WHERE database = 'plc' AND active ORDER BY table, name"

step "4. 컬럼별 압축 — Wide 파트만 컬럼별 바이트를 갖는다(파트 1 = 설비 1 SINE · 파트 2 = 설비 2 RANDOM_WALK)"
c "SELECT name AS part, column, column_data_uncompressed_bytes AS raw, column_data_compressed_bytes AS stored,
          round(column_data_uncompressed_bytes / column_data_compressed_bytes, 1) AS ratio
   FROM system.parts_columns WHERE database = 'plc' AND table = 'tag_raw' AND active ORDER BY part, column"

step "5. 롤업 연쇄 — 원시 count = countMerge(tag_1m) = countMerge(tag_1h) = countMerge(tag_1d)"
c "SELECT (SELECT count() FROM plc.tag_raw) AS raw,
          (SELECT countMerge(cnt) FROM plc.tag_1m) AS m1, (SELECT countMerge(cnt) FROM plc.tag_1h) AS h1, (SELECT countMerge(cnt) FROM plc.tag_1d) AS d1"
c "SELECT device_id, round(avg(value), 6) AS raw_avg, (SELECT round(avgMerge(avg_v), 6) FROM plc.tag_1m WHERE device_id = t.device_id) AS m1_avg
   FROM plc.tag_raw t GROUP BY device_id ORDER BY device_id"

step "6. 머지 — OPTIMIZE FINAL 전후의 활성 파트 수"
c "SELECT table, count() AS parts FROM system.parts WHERE database = 'plc' AND active GROUP BY table ORDER BY table"
c "OPTIMIZE TABLE plc.tag_raw FINAL"
c "SELECT table, count() AS parts, sum(rows) AS rows, round(sum(data_uncompressed_bytes) / sum(data_compressed_bytes), 2) AS ratio FROM system.parts WHERE database = 'plc' AND active GROUP BY table ORDER BY table"
