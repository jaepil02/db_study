# S3 실측 러너 공용 — 실험 프로토콜 정본 docs/10_observability/04_experiment_protocol.md(① 복원 ③ 기준선 ② 기동 ⑤ 판정 창 ⑥ 회복 ⑦ 정합)
# 비밀은 .env → Compose 치환으로만 흐른다 — 이 스크립트는 비밀을 읽지 않는다. 백그라운드로 두지 않는다(긴 대기는 포그라운드 상한 루프).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
COMPOSE="docker compose --env-file .env -f infra/compose/compose.yml -f infra/compose/compose.load.yml"

# 이미지에 들어갈 경로가 커밋과 같아야 기록의 커밋 해시가 실행 코드를 가리킨다
require_clean() {
  local dirty
  dirty=$(git status --porcelain -- apps/api packages package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore infra/postgres infra/clickhouse)
  if [ -n "$dirty" ]; then echo "이미지 · 설정에 들어갈 변경이 커밋되지 않았다:" >&2; echo "$dirty" >&2; exit 1; fi
  HASH=$(git rev-parse --short HEAD)
  export COMMIT_HASH=$HASH
  docker image inspect "db_study-api:$HASH" >/dev/null 2>&1 || $COMPOSE build -q api
}

wait_api() {
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null http://127.0.0.1:3000/api/v1/health; then return 0; fi
    sleep 1
  done
  echo "api health 90초 초과" >&2; exit 1
}

wait_ch() {
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null http://127.0.0.1:8123/ping; then return 0; fi
    sleep 2
  done
  echo "clickhouse ping 120초 초과" >&2; exit 1
}

# ① 복원 — api 컨테이너를 먼저 지워 restore의 start가 직전 설정의 api를 다시 띄우지 않게 한다
restore_snap() {
  $COMPOSE rm -sf api >/dev/null 2>&1 || true
  task restore NAME="$1" >/dev/null
  wait_ch
}

# ③ 기준선 — api 없이 저장소 유휴 · docker stats 1회를 파일로
baseline() { # $1=초 $2=출력 파일
  sleep "$1"
  docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-postgres-1 db_study-clickhouse-1 db_study-redis-1 > "$2"
}

# ② 기동 — 환경변수 덮어쓰기는 호출자가 앞에 붙인다(예: APP_ROLE=worker api_up)
api_up() {
  $COMPOSE up -d --no-deps --force-recreate api >/dev/null
  wait_api
}

# ⑥ 수집 · 적재 정지 — 정상 종료(Collector 정지 → Ingest 드레인 · XACK)
api_stop() { $COMPOSE stop -t 90 api >/dev/null; }

metric() { curl -s http://127.0.0.1:3000/metrics | awk -v n="$1" '$1==n {print $2}'; }

# AC-19 표본 — 판정 창 동안 1초마다 그룹 lag · pending을 적는다(포그라운드 · 창 길이만큼)
sample_lag() { # $1=초 $2=출력 파일
  : > "$2"
  for _ in $(seq 1 "$1"); do
    printf '%s %s %s\n' "$(date +%s)" "$(metric ing_group_lag)" "$(metric ing_group_pending)" >> "$2"
    sleep 1
  done
}

verify() { # s3-verify 인자 그대로 — 정지 상태에서
  $COMPOSE run --rm --no-deps api node dist/lab/s3-verify.js "$@"
}

chq() { docker exec db_study-clickhouse-1 clickhouse-client -q "$1"; }
