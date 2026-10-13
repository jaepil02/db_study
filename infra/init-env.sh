#!/usr/bin/env bash
# .env.example(비밀 없는 견본)을 쓰고, .env가 없으면 비밀을 난수로 채운 .env를 만든다.
# 이름의 정본: docs/09_tech_stack/04_local_environment.md §환경변수 · 절차: docs/12_security/02_secrets_config.md
# 기존 .env는 절대 덮어쓰지 않는다 — 저장소 볼륨이 이미 그 비밀번호로 초기화돼 있기 때문이다.
set -euo pipefail
cd "$(dirname "$0")/.."

cat > .env.example <<'EOF'
# db_study 환경변수 견본 — 이름의 정본은 docs/09_tech_stack/04_local_environment.md §환경변수
# 이 파일에는 비밀 값을 두지 않는다. infra/init-env.sh가 이 견본으로 .env를 만든다(.env는 커밋하지 않는다).

# ── 비밀 7 — 저장소 6종은 난수, Grafana 비밀번호는 사람이 정한다(로그인 · 계정은 D-16에서 삭제 — 서명 키 · 학습자 비밀번호 없음)
POSTGRES_ADMIN_PASSWORD=CHANGE_ME
APP_OWNER_PASSWORD=CHANGE_ME
APP_RW_PASSWORD=CHANGE_ME
CH_READER_PASSWORD=CHANGE_ME
CLICKHOUSE_PASSWORD=CHANGE_ME
REDIS_PASSWORD=CHANGE_ME
GRAFANA_ADMIN_PASSWORD=CHANGE_ME

# ── 저장소 접속 — 서비스명 DNS 기반 · 비밀번호 자리는 비밀 변수를 참조한다
POSTGRES_URL=postgres://app_rw:${APP_RW_PASSWORD}@postgres:5432/plc
CLICKHOUSE_URL=http://app:${CLICKHOUSE_PASSWORD}@clickhouse:8123/plc
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ── 기동 역할
APP_ROLE=all

# ── 역할 스위치 — 기본값 정본 docs/02_features/13_switch_matrix.md
REDIS_STREAM_BUFFER=on
REDIS_LATEST_CACHE=on
REDIS_QUERY_CACHE=on
CACHE_KEY_TIME_SNAP=on
CACHE_STAMPEDE_LOCK=on
REDIS_PUBSUB_FANOUT=on
WS_THROTTLE_MS=100
INGEST_IDEMPOTENCY=on
CONTROL_TABLE_ENABLED=gated
COLLECTOR_DEADBAND=off
LATEST_VALUE_WRITER=ingest

# ── 측정 조건 — MEMORY_PROFILE · WORKER_POOL_SIZE · NODE_OPTIONS · UV_THREADPOOL_SIZE는 프로파일 덮어쓰기 파일이 준다
CAPACITY_TIER=
SIM_FAULT_PLAN=
# COMMIT_HASH는 이미지 빌드 인자로만 준다 — 손으로 적지 않는다

# ── 웹(호스트 Next.js)
API_BASE_URL=http://127.0.0.1:13000
NEXT_PUBLIC_API_BASE_URL=http://localhost:13000
EOF
echo "wrote .env.example"

if [ -e .env ]; then
  echo ".env already exists — left untouched"
  exit 0
fi

umask 077
gen() { openssl rand -hex "$1"; }
sed \
  -e "s/^POSTGRES_ADMIN_PASSWORD=CHANGE_ME$/POSTGRES_ADMIN_PASSWORD=$(gen 24)/" \
  -e "s/^APP_OWNER_PASSWORD=CHANGE_ME$/APP_OWNER_PASSWORD=$(gen 24)/" \
  -e "s/^APP_RW_PASSWORD=CHANGE_ME$/APP_RW_PASSWORD=$(gen 24)/" \
  -e "s/^CH_READER_PASSWORD=CHANGE_ME$/CH_READER_PASSWORD=$(gen 24)/" \
  -e "s/^CLICKHOUSE_PASSWORD=CHANGE_ME$/CLICKHOUSE_PASSWORD=$(gen 24)/" \
  -e "s/^REDIS_PASSWORD=CHANGE_ME$/REDIS_PASSWORD=$(gen 24)/" \
  -e "s/^GRAFANA_ADMIN_PASSWORD=CHANGE_ME$/GRAFANA_ADMIN_PASSWORD=/" \
  -e "1s/.*/# db_study 실제 환경변수 — 비밀 포함 · 커밋 금지/" \
  .env.example > .env
echo "wrote .env (storage secrets generated · GRAFANA_ADMIN_PASSWORD left empty for you to set)"
