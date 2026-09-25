-- 005 — WRK 3 테이블(정본 docs/05_data_stores/01 §ALM · AUT · WRK · FK #13~#15 · work_order.status 4값)
-- audit_log는 추가 전용이다 — 권한 REVOKE는 006. 업무 쓰기 표면은 S4 · S7이다(S3는 스키마만).

-- Up Migration
SET ROLE app_owner;

CREATE TABLE work_order (
  order_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line_id       integer     NOT NULL REFERENCES production_line ON DELETE RESTRICT,
  order_no      text        NOT NULL UNIQUE,
  product_code  text        NOT NULL,
  target_qty    integer     NOT NULL CHECK (target_qty > 0),
  planned_start timestamptz NOT NULL,
  planned_end   timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'PLANNED'
                CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CHECK (planned_end > planned_start)
);

CREATE TABLE production_log (
  log_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    bigint      NOT NULL REFERENCES work_order ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL,
  good_qty    integer     NOT NULL CHECK (good_qty >= 0),
  defect_qty  integer     NOT NULL CHECK (defect_qty >= 0)
);

CREATE TABLE audit_log (
  audit_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      integer REFERENCES user_account ON DELETE RESTRICT,
  acted_at     timestamptz NOT NULL DEFAULT now(),
  action       text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE')),
  target_table text        NOT NULL,
  target_key   text        NOT NULL,
  before_value jsonb,
  after_value  jsonb       NOT NULL
);

RESET ROLE;
