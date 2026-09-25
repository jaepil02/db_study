-- 008 — dict_tag(정본 docs/05_data_stores/03_clickhouse_schema.md §dict_tag · ADR-16) — 비활성 태그 포함 적재 · 키 UInt64
-- 접속은 named collection pg_dict(infra/clickhouse/config.d/named_collections.xml) — 비밀번호를 DDL에 쓰지 않는다(12_security/02)
CREATE DICTIONARY IF NOT EXISTS plc.dict_tag
(
    tag_id     UInt64,
    device_id  UInt32,
    tag_code   String,
    tag_name   String,
    unit       String,
    range_min  Nullable(Float64),
    range_max  Nullable(Float64),
    is_active  UInt8
)
PRIMARY KEY tag_id
SOURCE(POSTGRESQL(
    NAME pg_dict
    query 'SELECT tag_id, device_id, tag_code, tag_name, unit, range_min, range_max, is_active::int FROM tag_master'
))
LAYOUT(HASHED())
LIFETIME(MIN 300 MAX 600);
