-- 001 — 확장 · DB 역할 · DB 기본 timezone(대역 정본 docs/05_data_stores/09_migrations_seed.md §PostgreSQL 마이그레이션)
-- 새 기준선(D-16 · 2026-10-11) — 남는 객체만 담아 001부터 다시 썼다. 빈 볼륨에서 001~005가 한 번에 끝난다.
-- 관리자 계정으로 돈다(확장 생성 · ALTER DATABASE는 슈퍼유저 권한). 002부터는 app_owner로 돈다 — 런타임(app_rw)은 DDL 권한을 갖지 않는다.
-- 역할 셋은 DB 접속 계정이다(로그인 기능이 아니다) — 비밀번호는 이 파일에 쓰지 않고 migrate 명령이 환경변수에서 읽어 매 실행 맞춘다(12_security/02).
-- pg_partman 확장은 migrate 관리자 단계가 schema partman에 만든다(파생 이미지 infra/postgres/Dockerfile).

-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN CREATE ROLE app_owner LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN CREATE ROLE app_rw LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ch_reader') THEN CREATE ROLE ch_reader LOGIN; END IF;
END
$$;

-- 처리 시간대 UTC(ADR-27) — 일 파티션 경계(UTC 자정)를 create_parent가 세션 timezone으로 계산한다.
-- 새 세션부터 듣는다 — 002~ app_owner 세션(별도 연결)이 UTC로 돈다. 달력 의미 경계(KST 하루)는 ClickHouse mv_tag_1d가 따로 정한다.
ALTER DATABASE plc SET timezone TO 'UTC';

GRANT CONNECT ON DATABASE plc TO app_owner, app_rw, ch_reader;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
GRANT USAGE ON SCHEMA public TO app_rw, ch_reader;

-- app_rw: SELECT · INSERT · UPDATE만 — DELETE를 주지 않아 물리 삭제 표면이 권한에서 없다(05_data_stores/02 §가드 트리거와 DB 권한)
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- 이력 테이블은 관리자 실행에서 먼저 생긴다 — 002부터 app_owner가 이어서 기록한다
GRANT SELECT, INSERT, UPDATE, DELETE ON pgmigrations TO app_owner;
GRANT USAGE, SELECT ON SEQUENCE pgmigrations_id_seq TO app_owner;
