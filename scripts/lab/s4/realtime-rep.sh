#!/usr/bin/env bash
# EXP-11(SW-06 · 기록 025) · EXP-12(SW-07 · 기록 026) 반복 1회의 팔 하나 — 티어 M · s3-empty-m · APP_ROLE all + 모드 A(판정 13)
# EXP-11: 고정 연결(k6 10개 · 설비 5개씩) + 프레임 수집기 1 · 창 동안 rlt_fanout_delivery_seconds{channel} 버킷 차 p50 · p95(발행 → 게이트웨이 도착)
# EXP-12: k6 연결 계단(STEPS) · 계단 끝마다 ws_frames_sent_total{rt} 차 ÷ 연결 ÷ 초 · nodejs_eventloop_lag_p95_seconds · 4413 절단 수
# 사용: scripts/lab/s4/realtime-rep.sh <출력 JSON 줄 파일> <exp11|exp12> <반복 번호> <팔 — exp11 on|off · exp12 100|0> [창 초=60] [기준선 초=240]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
EXP=${2:?exp11 · exp12}
REP=${3:?반복 번호}
ARM=${4:?팔}
WIN=${5:-60}
BASE=${6:-240}
require_clean
export CAPACITY_TIER=M
case "$EXP" in
  exp11) export REDIS_PUBSUB_FANOUT=$ARM ;;
  exp12) export WS_THROTTLE_MS=$ARM ;;
  *) echo "exp11 · exp12" >&2; exit 1 ;;
esac
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/rt.XXXX")
trap 'rm -rf "$TMP"' EXIT
echo "── $EXP rep $REP · 팔 $ARM · 복원 s3-empty-m"
restore_snap s3-empty-m
baseline "$BASE" "$TMP/baseline"
APP_ROLE=all api_up
curl -s http://127.0.0.1:13000/api/v1/health > "$TMP/health"
sleep 20
if [ "$EXP" = exp11 ]; then
  HOLD=$(( WIN + 10 ))
  docker run --rm --network db_study_default --cpuset-cpus 11-12 -v "$PWD/scripts/lab/s4":/s:ro -v "$TMP":/out \
    -e STAGES="10:3,10:$(( WIN + 5 ))" -e HOLD="$HOLD" -e DEVICES=5 -e NDEV=50 "$K6_IMAGE" run -q --summary-export /out/k6.json /s/k6-ws.js >/dev/null 2>"$TMP/k6.err" &
  K6=$!
  sleep 5
  snap_metrics "$TMP/m0"
  node scripts/lab/s4/ws-capture.cjs "$WIN" > "$TMP/cap"
  snap_metrics "$TMP/m1"
  wait "$K6" || true
  python3 scripts/lab/s2/hist-diff.py "$TMP/m0" "$TMP/m1" rlt_fanout_delivery_seconds > "$TMP/h"
  : > "$TMP/steps"
else
  STEP=${WIN}
  docker run --rm --network db_study_default --cpuset-cpus 11-12 -v "$PWD/scripts/lab/s4":/s:ro -v "$TMP":/out \
    -e STAGES="10:5,10:$STEP,50:5,50:$STEP,100:5,100:$STEP" -e HOLD=$(( STEP * 3 + 20 )) -e DEVICES=5 -e NDEV=50 "$K6_IMAGE" run -q --summary-export /out/k6.json /s/k6-ws.js >/dev/null 2>"$TMP/k6.err" &
  K6=$!
  : > "$TMP/steps"
  for c in 10 50 100; do
    sleep 5
    snap_metrics "$TMP/s$c-a"
    T=$(date +%s); until [ $(( $(date +%s) - T )) -ge "$STEP" ]; do sleep 1; done
    snap_metrics "$TMP/s$c-b"
    printf '%s %s %s %s %s\n' "$c" "$(mdelta "$TMP/s$c-a" "$TMP/s$c-b" 'ws_frames_sent_total{channel="rt"}')" \
      "$(awk '$1=="ws_connections" {print $2}' "$TMP/s$c-b")" "$(awk '$1=="nodejs_eventloop_lag_p95_seconds" {print $2}' "$TMP/s$c-b")" \
      "$(mdelta "$TMP/s$c-a" "$TMP/s$c-b" 'rlt_throttle_merged_total')" >> "$TMP/steps"
  done
  wait "$K6" || true
  cp "$TMP/s10-a" "$TMP/m0"; cp "$TMP/s100-b" "$TMP/m1"
  echo '{}' > "$TMP/h"; echo 'null' > "$TMP/cap"
fi
C4413=$(mdelta "$TMP/m0" "$TMP/m1" 'ws_closes_total{close_code="4413"}')
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-api-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/load"
api_stop
python3 - "$TMP" "$EXP" "$REP" "$ARM" "$WIN" "$C4413" >> "$OUT" <<'PY'
import json, sys
d, exp, rep, arm, win, c4413 = sys.argv[1:7]
rd = lambda n: open(f'{d}/{n}').read().strip()
k6 = json.load(open(f'{d}/k6.json'))['metrics']
steps = []
for ln in rd('steps').splitlines():
    c, fr, conns, el, merged = ln.split()
    steps.append({'targetConns': int(c), 'framesRt': float(fr), 'wsConnections': float(conns), 'framesPerConnPerSec': float(fr) / max(1.0, float(conns)) / int(win), 'eventLoopP95s': float(el), 'throttleMerged': float(merged)})
print(json.dumps({'exp': exp, 'rep': int(rep), 'arm': arm, 'windowS': int(win), 'closes4413': float(c4413),
  'delivery': json.loads(rd('h')), 'capture': json.loads(rd('cap')), 'steps': steps,
  'k6': {'frames': k6.get('ws_rt_frames', {}).get('count'), 'closed4413': k6.get('ws_closed_4413', {}).get('count', 0), 'sessions': k6.get('ws_sessions', {}).get('count')},
  'health': json.loads(rd('health')), 'baseline': rd('baseline').splitlines(), 'load': rd('load').splitlines()}, ensure_ascii=False))
PY
echo "── $EXP rep $REP · 팔 $ARM 완료"
