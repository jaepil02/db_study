-- 003 — AUT 3 테이블(컬럼 정본 docs/05_data_stores/01_postgresql_schema.md §테이블 명세 — ALM · AUT · WRK)
-- FK #7 tag_master_history.changed_by → user_account를 여기서 붙인다(002가 넘긴 것 · 02_postgresql_constraints §FK 전수)
-- 계정 · 역할 시드는 인증 단계(S7)다 — S3는 스키마만 둔다.

-- Up Migration
SET ROLE app_owner;

CREATE TABLE user_account (
  user_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE role (
  role_id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_code text NOT NULL UNIQUE CHECK (role_code IN ('OPERATOR', 'ENGINEER', 'ADMIN'))
);

CREATE TABLE user_role (
  user_id integer  NOT NULL REFERENCES user_account ON DELETE RESTRICT,
  role_id smallint NOT NULL REFERENCES role ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE tag_master_history
  ADD CONSTRAINT tag_master_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES user_account ON DELETE RESTRICT;

RESET ROLE;
