-- 008 — run_result 직접 비교 실행 결과 보관(D-16 · 정본 docs/05_data_stores/01_postgresql_schema.md §run_result 설계)
-- 실행 상태는 api 메모리(진행 1 + 마지막 1)라 재기동이면 사라진다 — ⑤ 패널이 마지막 결과를 계속 보여 주려면
-- 종결된 compare 실행을 여기 남긴다. GET /api/v1/runs/latest?type=compare가 부분(part)별 가장 최근 종결 1건을 읽는다.
-- 센서 데이터 지우기는 이 테이블을 지우지 않는다(남기는 것 — 설비 · 태그 · 업무 · 실행 결과).

-- Up Migration
SET ROLE app_owner;

CREATE TABLE run_result (
  run_id      uuid        PRIMARY KEY,
  type        text        NOT NULL CHECK (type IN ('compare')),
  part        text        NOT NULL CHECK (part IN ('ingest', 'query', 'integrity')),
  params      jsonb       NOT NULL,
  status      text        NOT NULL CHECK (status IN ('completed', 'stopped', 'failed')),
  result      jsonb,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NOT NULL,
  commit_hash text,
  switches    jsonb       NOT NULL,
  plant_on    boolean     NOT NULL,
  CHECK (ended_at >= started_at)
);

CREATE INDEX run_result_latest_idx ON run_result (type, part, ended_at DESC);

-- 추가 전용 — 결과는 바뀌지 않는다. 001의 기본 권한(SELECT · INSERT · UPDATE)에서 UPDATE를 뺀다(biz_command_log와 같은 권한 관례)
REVOKE UPDATE, DELETE, TRUNCATE ON run_result FROM app_rw;

RESET ROLE;
