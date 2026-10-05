#!/usr/bin/env bash
# EXP-08(SW-03 · 기록 022) · EXP-09(SW-04 · 기록 023) 반복 1회의 팔 하나 — 티어 M · s4-hist-m · api 역할(조회) + worker(적재) + 모드 B 배경(판정 14)
# ① 복원 ③ 기준선(api 없이) ② worker · api 기동 → 모드 B 발행(자식 · 같은 호출에서 거둔다) → k6 워밍업 → 판정 창 → 정지
# EXP-08: 창 ① 반복 조회(repeat) ② 신규 범위(fresh) — 창마다 서버 p50 · p95(버킷 차) · ClickHouse 쿼리 수 · 히트 · 미스
# EXP-09: 상대 범위 반복(relative) · 10초마다 히트 · 미스 누적을 적어 히트율 추이
# 사용: scripts/lab/s4/query-rep.sh <출력 JSON 줄 파일> <exp08|exp09> <반복 번호> <팔 on|off> [창 초=40] [도착률=20] [기준선 초=240]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
EXP=${2:?exp08 · exp09}
REP=${3:?반복 번호}
ARM=${4:?on · off}
WIN=${5:-40}
RATE=${6:-20}
BASE=${7:-240}
require_clean
export CAPACITY_TIER=M
case "$EXP" in
  exp08) export REDIS_QUERY_CACHE=$ARM ;;
  exp09) export CACHE_KEY_TIME_SNAP=$ARM ;;
  *) echo "exp08 · exp09" >&2; exit 1 ;;
esac
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/qrep.XXXX")
trap 'worker_stop; rm -rf "$TMP"' EXIT
ROUTE='/api/v1/timeseries/query'
echo "── $EXP rep $REP · 팔 $ARM · 복원 $HIST_SNAP"
worker_stop
restore_snap "$HIST_SNAP"
baseline "$BASE" "$TMP/baseline"
worker_start
APP_ROLE=api api_up
curl -s http://127.0.0.1:13000/api/v1/health > "$TMP/health"
DUR=$(( 10 + WIN * 2 + 25 ))
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier M --mix mixed --seed 42 --duration "$DUR" 2>/dev/null | tail -1 > "$TMP/modeb" &
DG=$!
K=(-e ANCHOR_START="$ANCHOR_START" -e ANCHOR_END="$ANCHOR_END" -e RATE="$RATE")
if [ "$EXP" = exp08 ]; then
  k6run k6-query.js warm.json "${K[@]}" -e MODE=repeat -e DURATION=10s
  snap_metrics "$TMP/m0"; chq "SYSTEM FLUSH LOGS"
  k6run k6-query.js repeat.json "${K[@]}" -e MODE=repeat -e DURATION="${WIN}s"
  snap_metrics "$TMP/m1"
  k6run k6-query.js fresh.json "${K[@]}" -e MODE=fresh -e DURATION="${WIN}s"
  snap_metrics "$TMP/m2"
else
  k6run k6-query.js warm.json "${K[@]}" -e MODE=relative -e DURATION=10s
  snap_metrics "$TMP/m0"
  # 상대 범위 반복 2창 분량을 10초 조각으로 — 조각마다 히트 · 미스 누적
  : > "$TMP/trend"
  for i in $(seq 1 $(( WIN * 2 / 10 ))); do
    k6run k6-query.js "rel-$i.json" "${K[@]}" -e MODE=relative -e DURATION=10s
    snap_metrics "$TMP/t$i"
    printf '%s %s %s\n' "$i" "$(mdelta "$TMP/m0" "$TMP/t$i" 'tsq_cache_requests_total{result="hit"}')" "$(mdelta "$TMP/m0" "$TMP/t$i" 'tsq_cache_requests_total')" >> "$TMP/trend"
  done
  cp "$TMP/t$(( WIN * 2 / 10 ))" "$TMP/m1"; cp "$TMP/m1" "$TMP/m2"
fi
wait "$DG" || true
LAG=$(metric consumer_lag)
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-api-1 db_study-worker-lab db_study-clickhouse-1 db_study-redis-1 > "$TMP/load"
api_stop
worker_stop
for p in 1 2; do
  a=$([ $p = 1 ] && echo m0 || echo m1); b=m$p
  python3 scripts/lab/s2/hist-diff.py "$TMP/$a" "$TMP/$b" http_request_duration_seconds --label route="$ROUTE" code=200 > "$TMP/h$p"
  printf '%s %s %s %s\n' "$(mdelta "$TMP/$a" "$TMP/$b" tsq_source_queries_total)" "$(mdelta "$TMP/$a" "$TMP/$b" 'tsq_cache_requests_total{result="hit"}')" "$(mdelta "$TMP/$a" "$TMP/$b" 'tsq_cache_requests_total{result="miss"}')" "$(mdelta "$TMP/$a" "$TMP/$b" 'http_requests_total{route="'$ROUTE'",method="POST",code="200"}')" > "$TMP/c$p"
done
python3 - "$TMP" "$EXP" "$REP" "$ARM" "$WIN" "$RATE" "$LAG" >> "$OUT" <<'PY'
import json, os, sys
d, exp, rep, arm, win, rate, lag = sys.argv[1:8]
rd = lambda n: open(f'{d}/{n}').read().strip()
def k6(n):
    p = f'{d}/{n}'
    if not os.path.exists(p): return None
    m = json.load(open(p))['metrics']
    h = m.get('http_req_duration', {})
    return {'p50': h.get('med'), 'p95': h.get('p(95)'), 'count': m.get('http_reqs', {}).get('count'), 'failRate': m.get('checks', {}).get('fails')}
def cnt(p):
    s, hit, miss, req = map(float, rd(f'c{p}').split())
    return {'sourceQueries': s, 'hit': hit, 'miss': miss, 'requests200': req}
row = {'exp': exp, 'rep': int(rep), 'arm': arm, 'windowS': int(win), 'rate': int(rate), 'consumerLagEnd': lag,
       'health': json.loads(rd('health')), 'modeB': json.loads(rd('modeb') or 'null'),
       'baseline': rd('baseline').splitlines(), 'load': rd('load').splitlines()}
if exp == 'exp08':
    row['repeat'] = {'server': json.loads(rd('h1')), 'k6': k6('repeat.json'), **cnt(1)}
    row['fresh'] = {'server': json.loads(rd('h2')), 'k6': k6('fresh.json'), **cnt(2)}
else:
    tr = [l.split() for l in rd('trend').splitlines()]
    row['trend'] = [{'slice': int(i), 'hitCum': float(h), 'reqCum': float(r)} for i, h, r in tr]
    row['relative'] = {'server': json.loads(rd('h1')), **cnt(1)}
print(json.dumps(row, ensure_ascii=False))
PY
echo "── $EXP rep $REP · 팔 $ARM 완료"
