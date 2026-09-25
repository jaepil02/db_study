-- 004 — ALM 2 테이블 · alarm_event 월 파티션(정본 docs/05_data_stores/01 §ALM · 02 §alarm_event 월 파티션 · FK #8~#10 · 결합 CHECK)
-- 파티션 키 occurred_at(측정 시각) · PK(event_id, occurred_at) · 경계 Asia/Seoul 월 1일(DB 기본 timezone) · 기본 파티션 둔다.
-- pg_partman(확장은 migrate 관리자 단계가 만든다 · schema partman) — 미리 만들기 도구 기본값 · 보존 2년 뒤 분리(DETACH · 08_retention_lifecycle #9).

-- Up Migration
SET ROLE app_owner;

CREATE TABLE alarm_rule (
  rule_id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tag_id         integer  NOT NULL REFERENCES tag_master ON DELETE RESTRICT,
  condition_type text     NOT NULL CHECK (condition_type IN ('GT', 'LT', 'OUT_OF_RANGE', 'RATE_OF_CHANGE')),
  threshold      numeric  NOT NULL,
  threshold_low  numeric,
  debounce_ms    integer  NOT NULL CHECK (debounce_ms >= 0),
  severity       smallint NOT NULL CHECK (severity BETWEEN 1 AND 3),
  enabled        boolean  NOT NULL DEFAULT true,
  CHECK ((threshold_low IS NOT NULL) = (condition_type = 'OUT_OF_RANGE')),
  CHECK (threshold_low IS NULL OR threshold_low < threshold)
);

CREATE TABLE alarm_event (
  event_id      bigint GENERATED ALWAYS AS IDENTITY,
  rule_id       integer          NOT NULL REFERENCES alarm_rule ON DELETE RESTRICT,
  occurred_at   timestamptz      NOT NULL,
  cleared_at    timestamptz,
  trigger_value double precision NOT NULL,
  state         text             NOT NULL CHECK (state IN ('ACTIVE', 'CLEARED')),
  acked_by      integer REFERENCES user_account ON DELETE RESTRICT,
  acked_at      timestamptz,
  PRIMARY KEY (event_id, occurred_at),
  CHECK ((acked_by IS NULL) = (acked_at IS NULL)),
  CHECK ((state = 'CLEARED') = (cleared_at IS NOT NULL)),
  CHECK (cleared_at IS NULL OR cleared_at >= occurred_at)
) PARTITION BY RANGE (occurred_at);

SELECT partman.create_parent(
  p_parent_table => 'public.alarm_event',
  p_control      => 'occurred_at',
  p_interval     => '1 month'
);
UPDATE partman.part_config
   SET retention = '2 years', retention_keep_table = true
 WHERE parent_table = 'public.alarm_event';

RESET ROLE;
