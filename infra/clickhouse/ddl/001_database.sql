-- 001 — 데이터베이스(순번 정본 docs/05_data_stores/09_migrations_seed.md §ClickHouse DDL 순번 · 매번 전 파일을 멱등 적용)
-- 새 기준선(D-16 · 2026-10-11) — 남는 객체만 담아 001부터 다시 썼다(알람 판정 전수 · 업무 대조 테이블 삭제).
CREATE DATABASE IF NOT EXISTS plc;
