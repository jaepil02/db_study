#!/usr/bin/env bash
# S0 실습 ③ — PostgreSQL 쿼리 통계 확장 확인(docs/01_overview/05_priorities_roadmap.md S0)
# 확장 · 설정의 정본: docs/09_tech_stack/03_data_infra.md · docs/05_data_stores/01_postgresql_schema.md §튜닝 파라미터
source "$(dirname "$0")/_lib.sh"

step "1. 선적재 · 설정 확인"
p "SELECT name, setting FROM pg_settings WHERE lower(name) IN ('shared_preload_libraries','pg_stat_statements.track','auto_explain.log_min_duration','shared_buffers','effective_cache_size','wal_compression','checkpoint_timeout','random_page_cost','timezone','max_connections') ORDER BY lower(name)"

step "2. pg_partman 가용 여부 — 공식 alpine 이미지에 없다는 기재(03_data_infra) 확인"
p "SELECT name, default_version FROM pg_available_extensions WHERE name IN ('pg_stat_statements','pg_partman','pg_trgm') ORDER BY name"

step "3. 확장 생성(마이그레이션 001이 할 일을 손으로 한 번) · 통계 초기화"
p "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
p "SELECT pg_stat_statements_reset() IS NOT NULL AS reset"

step "4. 쿼리 몇 개 — 상수만 다른 쿼리는 한 행으로 정규화된다"
p "CREATE TEMP TABLE t AS SELECT g AS id, g % 7 AS k FROM generate_series(1, 100000) g; SELECT count(*) FROM t WHERE k = 1; SELECT count(*) FROM t WHERE k = 2; SELECT count(*) FROM t WHERE k = 3"
for k in 1 2 3; do docker exec "$PG" psql -U postgres -d plc -XAtc "SELECT count(*) FROM generate_series(1, 50000) g WHERE g % 7 = $k" >/dev/null; done

step "5. pg_stat_statements 상위 — calls · 평균 시간 · 정규화된 쿼리 텍스트"
p "SELECT calls, round(mean_exec_time::numeric, 3) AS mean_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 80) AS query FROM pg_stat_statements WHERE query NOT ILIKE '%pg_stat_statements%' ORDER BY calls DESC, mean_exec_time DESC LIMIT 6"

step "6. 정리 — 확장은 볼륨 복원(task restore NAME=s0-empty)으로 되돌린다"
