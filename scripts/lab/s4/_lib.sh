# S4 실측 러너 공용 — S3 공용(복원 · 기준선 · 기동 · 정지 · metric · chq)을 그대로 쓰고 S4 조각을 더한다.
# 실험 규칙 정본 docs/10_observability/04_experiment_protocol.md · 호출당 반복 1회(10분 상한) · 백그라운드 없음(자식 프로세스는 같은 호출 안에서 거둔다)
source "$(dirname "${BASH_SOURCE[0]}")/../s3/_lib.sh"
K6_IMAGE=grafana/k6:1.8.1
HIST_SNAP=s4-hist-m
ANCHOR_START=$(sed -n 's/^anchor_start_epoch=//p' "snapshots/$HIST_SNAP/seed.txt" 2>/dev/null || true)
ANCHOR_END=$(sed -n 's/^anchor_end_epoch=//p' "snapshots/$HIST_SNAP/seed.txt" 2>/dev/null || true)

k6run() { # $1=스크립트 $2=요약 파일(절대 경로 디렉터리 TMP 안) 나머지=-e 인자
  local script=$1 out=$2; shift 2
  docker run --rm --network db_study_default --cpuset-cpus 11-12 -v "$PWD/scripts/lab/s4":/s:ro -v "$TMP":/out \
    "$@" "$K6_IMAGE" run -q --summary-export "/out/$out" "/s/$script" >/dev/null 2>"$TMP/$out.err" || { cat "$TMP/$out.err" >&2; return 1; }
}

# 적재 전용 프로세스(APP_ROLE worker) — api 컨테이너와 같은 이미지 · 포트를 열지 않는다(run) · 호출 끝에 worker_stop으로 거둔다
worker_start() {
  $COMPOSE run -d --no-deps --name db_study-worker-lab -e APP_ROLE=worker api >/dev/null
}
worker_stop() { docker stop -t 90 db_study-worker-lab >/dev/null 2>&1 || true; docker rm -f db_study-worker-lab >/dev/null 2>&1 || true; }

# cache:q 비우기 — KEYS 금지 · SCAN으로만
flush_query_cache() {
  docker exec db_study-redis-1 sh -c "redis-cli --scan --pattern 'cache:q:*' | xargs -r redis-cli DEL" >/dev/null
}

snap_metrics() { curl -s http://127.0.0.1:13000/metrics > "$1"; }
mdelta() { # $1 $2 파일 · $3 계열(레이블 포함 접두)
  python3 - "$1" "$2" "$3" <<'PY'
import sys
def s(p, pre):
    t = 0.0
    for ln in open(p):
        if ln.startswith(pre) and not ln.startswith('#'):
            t += float(ln.rsplit(' ', 1)[1])
    return t
print(s(sys.argv[2], sys.argv[3]) - s(sys.argv[1], sys.argv[3]))
PY
}

# 웹(Next.js 운영 빌드 · 호스트 127.0.0.1:13001) — 러너 호출 안에서 띄우고 같은 호출에서 거둔다. 빌드는 커밋 뒤 한 번(pnpm --filter @db-study/web build)
PLAYWRIGHT_CORE=${PLAYWRIGHT_CORE:-$HOME/.npm/_npx/705bc6b22212b352/node_modules/playwright-core}
export PLAYWRIGHT_CORE
web_start() {
  web_stop
  (cd apps/web && exec pnpm start > "$TMP/web.log" 2>&1) &
  for _ in $(seq 1 30); do curl -sf -o /dev/null http://localhost:13001/realtime && return 0; sleep 1; done
  echo "web 기동 30초 초과" >&2; exit 1
}
# next start는 next-server로 이름을 바꿔 돈다 — 명령줄 패턴이 아니라 13001을 듣는 프로세스를 끈다
web_stop() {
  local pids
  pids=$(lsof -tiTCP:13001 -sTCP:LISTEN 2>/dev/null || true)
  [ -z "$pids" ] || kill $pids 2>/dev/null || true
}
