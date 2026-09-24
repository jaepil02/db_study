-- 002 — MST 6 테이블 · 결합 CHECK(컬럼 정본 docs/05_data_stores/01_postgresql_schema.md §테이블 명세 — MST · §tag_master_history 설계)
-- FK · UNIQUE · 결합 CHECK 정본 docs/05_data_stores/02_postgresql_constraints.md — ON DELETE는 전부 RESTRICT(물리 삭제 표면 없음)
-- tag_master_history.changed_by → user_account FK(#7)는 AUT 테이블이 생기는 003에서 붙인다(FK 방향상 AUT가 뒤다)
-- 가드 트리거 · 추가 전용 REVOKE · 인덱스는 006 대역이다.

-- Up Migration
SET ROLE app_owner;

CREATE TABLE site (
  site_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_code text NOT NULL UNIQUE,
  site_name text NOT NULL,
  timezone  text NOT NULL DEFAULT 'Asia/Seoul' CHECK (timezone = 'Asia/Seoul')
);

CREATE TABLE production_line (
  line_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_id   integer NOT NULL REFERENCES site ON DELETE RESTRICT,
  line_code text NOT NULL,
  line_name text NOT NULL,
  UNIQUE (site_id, line_code)
);

CREATE TABLE device (
  device_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line_id     integer NOT NULL REFERENCES production_line ON DELETE RESTRICT,
  device_code text NOT NULL UNIQUE,
  device_name text NOT NULL,
  vendor      text,
  model       text,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE modbus_config (
  device_id            integer PRIMARY KEY REFERENCES device ON DELETE RESTRICT,
  host                 inet NOT NULL,
  port                 integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  unit_id              smallint NOT NULL CHECK (unit_id BETWEEN 0 AND 247),
  timeout_ms           integer NOT NULL CHECK (timeout_ms > 0),
  retry_count          smallint NOT NULL CHECK (retry_count >= 0),
  max_regs_per_request smallint NOT NULL CHECK (max_regs_per_request BETWEEN 1 AND 125)
);

CREATE TABLE tag_master (
  tag_id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id     integer NOT NULL REFERENCES device ON DELETE RESTRICT,
  tag_code      text NOT NULL UNIQUE,
  tag_name      text NOT NULL,
  function_code smallint NOT NULL CHECK (function_code IN (1, 2, 3, 4)),
  address       integer NOT NULL CHECK (address BETWEEN 0 AND 65535),
  data_type     text NOT NULL CHECK (data_type IN ('UINT16', 'INT16', 'UINT32', 'INT32', 'FLOAT32', 'FLOAT64', 'BOOL')),
  word_order    text CHECK (word_order IN ('ABCD', 'CDAB', 'BADC', 'DCBA')),
  scale         numeric NOT NULL DEFAULT 1,
  offset_value  numeric NOT NULL DEFAULT 0,
  unit          text NOT NULL DEFAULT '',
  deadband      numeric NOT NULL DEFAULT 0 CHECK (deadband >= 0),
  scan_rate_ms  integer NOT NULL CHECK (scan_rate_ms > 0),
  range_min     numeric,
  range_max     numeric,
  is_active     boolean NOT NULL DEFAULT true,
  CHECK ((word_order IS NULL) = (data_type IN ('UINT16', 'INT16', 'BOOL'))),
  CHECK ((data_type = 'BOOL') = (function_code IN (1, 2))),
  CHECK (range_min IS NULL OR range_max IS NULL OR range_min < range_max)
);

CREATE TABLE tag_master_history (
  history_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  old_tag_id       integer NOT NULL REFERENCES tag_master ON DELETE RESTRICT,
  new_tag_id       integer NOT NULL UNIQUE REFERENCES tag_master ON DELETE RESTRICT,
  old_scale        numeric NOT NULL,
  old_offset_value numeric NOT NULL,
  new_scale        numeric NOT NULL,
  new_offset_value numeric NOT NULL,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       integer,
  reason           text,
  CHECK (old_tag_id <> new_tag_id)
);

-- Dictionary 소스 계정은 tag_master SELECT만(REQ-MST-11) — dict_tag는 S3에 생기지만 권한은 테이블과 함께 둔다
GRANT SELECT ON tag_master TO ch_reader;

RESET ROLE;
