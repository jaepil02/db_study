-- 001 — 확장 · DB 역할 · DB 기본 timezone(대역 정본 docs/05_data_stores/09_migrations_seed.md §PostgreSQL 마이그레이션)
-- 관리자 계정으로 돈다(확장 생성은 슈퍼유저 권한). 002부터는 app_owner로 돈다 — 런타임(app_rw)은 DDL 권한을 갖지 않는다.
-- 비밀번호는 이 파일에 쓰지 않는다 — migrate 명령이 환경변수에서 읽어 매 실행 ALTER ROLE로 맞춘다(12_security/02).
-- pg_partman은 공식 이미지에 없어 004(alarm_event 월 파티션) 착수 때 파생 이미지와 함께 만든다(09_tech_stack/03 미확인 등재).

-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN CREATE ROLE app_owner LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN CREATE ROLE app_rw LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ch_reader') THEN CREATE ROLE ch_reader LOGIN; END IF;
END
$$;

-- 달력 경계 시간대는 시스템 단일 값 — 월 파티션 경계 계산이 세션 시간대를 따른다(05_data_stores/01 §튜닝 파라미터)
ALTER DATABASE plc SET timezone TO 'Asia/Seoul';

GRANT CONNECT ON DATABASE plc TO app_owner, app_rw, ch_reader;
GRANT USAGE, CREATE ON SCHEMA public TO app_owner;
GRANT USAGE ON SCHEMA public TO app_rw, ch_reader;

-- app_rw: SELECT · INSERT · UPDATE만 — DELETE를 주지 않아 물리 삭제 표면이 권한에서 없다(05_data_stores/02 §가드 트리거와 DB 권한)
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- 이력 테이블은 관리자 실행에서 먼저 생긴다 — 002부터 app_owner가 이어서 기록한다
GRANT SELECT, INSERT, UPDATE, DELETE ON pgmigrations TO app_owner;
GRANT USAGE, SELECT ON SEQUENCE pgmigrations_id_seq TO app_owner;
