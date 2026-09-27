-- 008 — biz_command_log 업무 명령 멱등 원장(정본 docs/05_data_stores/01_postgresql_schema.md §biz_command_log 설계 · 02 §가드 트리거와 DB 권한 · 09 008)
-- 초기 대역(001~007)에 끼우지 않고 말미에 둔다 — 기존 볼륨에 migrate를 다시 돌리면 이 순번만 적용된다. 업무 테이블을 참조하지 않는다(FK 없음 · actor 포함).
-- APPLIED 행은 업무 트랜잭션 안에서 · REJECTED · EXPIRED 행은 별도 트랜잭션에서 명령 워커가 쓴다(06_pipeline/07 §업무 명령 경로).

-- Up Migration
SET ROLE app_owner;

CREATE TABLE biz_command_log (
  log_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cmd_id       uuid        NOT NULL UNIQUE,
  kind         text        NOT NULL,
  status       text        NOT NULL CHECK (status IN ('APPLIED', 'REJECTED', 'EXPIRED')),
  result       jsonb       NOT NULL,
  actor        bigint,
  requested_at timestamptz NOT NULL,
  applied_at   timestamptz NOT NULL DEFAULT now()
);

-- 추가 전용 — 판정은 바뀌지 않는다. 001의 기본 권한(SELECT · INSERT · UPDATE)에서 UPDATE를 뺀다(audit_log · tag_master_history와 같은 권한 관례)
REVOKE UPDATE, DELETE, TRUNCATE ON biz_command_log FROM app_rw;

RESET ROLE;
