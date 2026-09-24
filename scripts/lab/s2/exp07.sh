#!/usr/bin/env bash
# EXP-07(switch-sw02-latest-cache) 반복 1회의 팔 하나 — 복원 → ③ 기준선(api 없이 · 현행 참고 5분) → 기동 → 적재 누적 → k6 워밍업
# → ⑤ 판정 창 → ⑥ 회복(k6 정지 뒤 consumer_lag 0 관측 · 30초 안에 안 오면 불성립). 한 번에 팔 하나(10분 안).
# k6: 컨테이너 grafana/k6(버전 고정) · cpuset 11-12 · compose 네트워크 안에서 http://api:3000(Host 대조 허용 이름).
# 서버 p50 · p95 = http_request_duration_seconds 캡처 두 점의 차(버킷 보간) · k6 클라이언트 분위수 병기 · ClickHouse 점조회 수 = query_log.
# 사용: scripts/lab/s2/exp07.sh <출력 JSON 줄 파일> <반복 번호> <팔 on|off> [도착률=100] [창 초=60] [워밍업 초=10] [누적 초=30] [기준선 초=300]
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
ARMS=${3:?팔 on 또는 off}
RATE=${4:-100}
WIN=${5:-60}
WARM=${6:-10}
ACC=${7:-30}
BASE=${8:-300}
K6_IMAGE=grafana/k6:1.8.1
SNAP=s2-empty-slice
DIRTY=$(git status --porcelain -- apps packages infra/postgres/migrations infra/clickhouse/ddl package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore)
if [ -n "$DIRTY" ]; then echo "이미지에 들어갈 변경이 커밋되지 않았다" >&2; exit 1; fi
HASH=$(git rev-parse --short HEAD)
export COMMIT_HASH=$HASH CAPACITY_TIER=S
COMPOSE="docker compose --env-file .env -f infra/compose/compose.yml -f infra/compose/compose.load.yml"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
ROUTE='/api/v1/realtime/devices/:id/tags'

wait_api() {
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null http://127.0.0.1:3000/api/v1/health; then return 0; fi
    sleep 1
  done
  echo "api health 90초 초과" >&2; exit 1
}
k6run() { # $1=지속 $2=요약 파일 이름
  docker run --rm --network db_study_default --cpuset-cpus 11-12 -v "$PWD/scripts/lab/s2":/s:ro -v "$TMP":/out \
    -e RATE="$RATE" -e DURATION="$1" "$K6_IMAGE" run -q --summary-export "/out/$2" /s/k6-latest.js >/dev/null
}
chq() { docker exec db_study-clickhouse-1 clickhouse-client -q "$1"; }

for arm in $ARMS; do
  echo "── rep $REP · SW-02=$arm · 복원 $SNAP"
  $COMPOSE rm -sf api >/dev/null 2>&1 || true
  task restore NAME="$SNAP" >/dev/null
  echo "  기준선 ${BASE}초(api 정지 · 저장소 유휴)"
  sleep "$BASE"
  docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-postgres-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/baseline-$arm"
  REDIS_LATEST_CACHE=$arm APP_ROLE=all $COMPOSE up -d --no-deps --force-recreate api >/dev/null
  wait_api
  curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health-$arm"
  sleep "$ACC"
  k6run "${WARM}s" "warm-$arm.json"
  curl -s http://127.0.0.1:3000/metrics > "$TMP/a-$arm"
  chq "SYSTEM FLUSH LOGS"
  T0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  k6run "${WIN}s" "k6-$arm.json"
  T1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  curl -s http://127.0.0.1:3000/metrics > "$TMP/b-$arm"
  RECOVER=-1
  for i in $(seq 1 30); do
    lag=$(curl -s http://127.0.0.1:3000/metrics | awk '$1=="consumer_lag" {print $2}')
    if [ "${lag:-x}" = 0 ]; then RECOVER=$i; break; fi
    sleep 1
  done
  if [ "$RECOVER" -lt 0 ]; then echo "회복 불성립 — consumer_lag가 30초 안에 0이 되지 않았다" >&2; exit 1; fi
  chq "SYSTEM FLUSH LOGS"
  PQ=$(chq "SELECT count() FROM system.query_log WHERE type = 'QueryFinish' AND event_time >= parseDateTimeBestEffort('$T0') AND event_time <= parseDateTimeBestEffort('$T1') AND query LIKE '%argMax(value, ts) AS last_value%' AND query NOT LIKE '%system.query_log%'")
  python3 scripts/lab/s2/hist-diff.py "$TMP/a-$arm" "$TMP/b-$arm" http_request_duration_seconds --label route="$ROUTE" code=200 > "$TMP/h-$arm"
  EXH=$(python3 - "$TMP/a-$arm" "$TMP/b-$arm" <<'PY'
import sys
def v(p):
    for ln in open(p):
        if ln.startswith('rlt_latest_lock_wait_exhausted_total '):
            return float(ln.split()[1])
    return 0.0
print(v(sys.argv[2]) - v(sys.argv[1]))
PY
)
  python3 - "$TMP" "$arm" "$REP" "$RATE" "$WIN" "$WARM" "$ACC" "$T0" "$T1" "$PQ" "$EXH" "$BASE" "$RECOVER" >> "$OUT" <<'PY'
import json, sys
d, arm, rep, rate, win, warm, acc, t0, t1, pq, exh, base, rec = sys.argv[1:14]
k6 = json.load(open(f'{d}/k6-{arm}.json'))['metrics']
dur = k6['http_req_duration']
print(json.dumps({
    'rep': int(rep), 'arm': arm, 'rate': int(rate), 'windowS': int(win), 'warmupS': int(warm), 'accumulateS': int(acc),
    'window': {'start': t0, 'end': t1},
    'health': json.load(open(f'{d}/health-{arm}')),
    'server': json.load(open(f'{d}/h-{arm}'))[0],
    'k6': {'medMs': dur.get('med'), 'p95Ms': dur.get('p(95)'), 'p99Ms': dur.get('p(99)'),
           'reqs': k6['http_reqs'].get('count'), 'failedRate': k6['http_req_failed'].get('value'),
           'dropped': k6.get('dropped_iterations', {}).get('count', 0)},
    'clickhousePointQueries': int(pq), 'lockWaitExhausted': float(exh),
    'baselineS': int(base), 'baseline': open(f'{d}/baseline-{arm}').read().strip().splitlines(), 'recoverS': int(rec),
}, ensure_ascii=False))
PY
  tail -1 "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d['server']; k=d['k6']
print(f\"  SW-02={d['arm']} impl={d['health']['switches']['SW-02']['impl']} server n={s['count']:.0f} p50={s['p50S']} p95={s['p95S']} | k6 med={k['medMs']:.3f} p95={k['p95Ms']:.3f} reqs={k['reqs']} failed={k['failedRate']} dropped={k['dropped']} | CH 점조회={d['clickhousePointQueries']} 소진={d['lockWaitExhausted']}\")
"
done
