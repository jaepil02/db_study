-- 009 — 업무 대조 테이블 3(DDL 정본 docs/05_data_stores/03_clickhouse_schema.md §업무 대조 테이블 · 실험 정본 05_data_stores/10 §역방향 대조)
-- 계측물이다 — 앱은 읽지도 쓰지도 않는다. 쓰는 주체는 도구 컨테이너의 역방향 실행기(dist/oltp-lab.js · EXP-40~44)뿐이다.
-- UNIQUE · FK는 옮기지 않는다(없는 기능 · 공정성 규칙 7) · CHECK만 CONSTRAINT로 둔다. 파티션 키 · TTL 없음(업무 규모 10^6행 안).
-- 중복 제거 윈도우를 두지 않는다(non_replicated_deduplication_window 기본 0) — EXP-43 ⓓ 재삽입이 삽입 중복 제거로 버려지지 않게.
-- 그래뉼 256 변형은 여기 없다 — 실행기가 EXP-41 실행 범위에서만 plc 밖 실험 DB에 만들고 지운다(05_data_stores/10 §그래뉼 변형 판정 ②).

-- 경량 UPDATE(EXP-40 ③ · EXP-42 · EXP-43 UPDATE 경로)의 요구 조건 — 블록 번호 · 오프셋 컬럼은 이 테이블에만 켠다
CREATE TABLE IF NOT EXISTS plc.work_order_control
(
    order_id      UInt64,
    line_id       UInt32,
    order_no      String,
    product_code  String,
    target_qty    Int32,
    planned_start DateTime64(3, 'UTC'),
    planned_end   DateTime64(3, 'UTC'),
    status        LowCardinality(String),
    CONSTRAINT c_target_qty CHECK target_qty > 0,
    CONSTRAINT c_planned    CHECK planned_end > planned_start,
    CONSTRAINT c_status     CHECK status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
)
ENGINE = MergeTree
ORDER BY order_id
SETTINGS index_granularity = 8192,
         enable_block_number_column = 1,
         enable_block_offset_column = 1;

-- 새 버전 삽입이 갱신 수단(EXP-40 ④) — 버전이 없으면 같은 정렬 키 행 중 무엇이 남을지가 삽입 순서에 달린다
CREATE TABLE IF NOT EXISTS plc.work_order_control_rmt
(
    order_id      UInt64,
    line_id       UInt32,
    order_no      String,
    product_code  String,
    target_qty    Int32,
    planned_start DateTime64(3, 'UTC'),
    planned_end   DateTime64(3, 'UTC'),
    status        LowCardinality(String),
    version       UInt64,
    CONSTRAINT c_target_qty CHECK target_qty > 0,
    CONSTRAINT c_planned    CHECK planned_end > planned_start,
    CONSTRAINT c_status     CHECK status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
)
ENGINE = ReplacingMergeTree(version)
ORDER BY order_id
SETTINGS index_granularity = 8192;

-- 갱신하지 않는다(추가만) — log_id는 실행기가 발급한다(ClickHouse에 시퀀스가 없다)
CREATE TABLE IF NOT EXISTS plc.production_log_control
(
    log_id      UInt64,
    order_id    UInt64,
    recorded_at DateTime64(3, 'UTC'),
    good_qty    Int32,
    defect_qty  Int32,
    CONSTRAINT c_good   CHECK good_qty >= 0,
    CONSTRAINT c_defect CHECK defect_qty >= 0
)
ENGINE = MergeTree
ORDER BY (order_id, log_id);
