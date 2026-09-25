#!/usr/bin/env bash
# S3 반복 1회 — EXP-29(regression-stage-s3 · 기록 015) · 팔 default · control · quality
# ① 복원 ③ 기준선(api 없이 저장소 유휴) ② api 기동(all · 모드 A) ④ 워밍업 ⑤ 판정 창(1초 lag 표본 = AC-19) → AC-04(기동 중)
# ⑥ 수집 정지 = api 정상 종료(드레인 · XACK) ⑦ 정합(s3-verify — AC-01 · 02 · 05 · 07 · 19 정지 뒤 0 · 21) ⑧ 다음 반복이 복원
# 팔: default — 기본 스위치 · control — SW-09 on(AC-21) · quality — SIM 주입 계획 + 범위 밖 시드(AC-08 · 판정은 ac08-check.sh)
# 사용: scripts/lab/s3/exp29-rep.sh <출력 JSON 줄 파일> <팔> <스냅샷> <반복 번호> [창 초=180] [워밍업 초=20] [기준선 초=300]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
ARM=${2:?팔 default · control · quality}
SNAP=${3:?스냅샷}
REP=${4:?반복 번호}
WIN=${5:-180}
WARM=${6:-20}
BASE=${7:-300}
require_clean
export CAPACITY_TIER=S
EXTRA=()
case "$ARM" in
  default) ;;
  control) export CONTROL_TABLE_ENABLED=on; EXTRA=(--control) ;;
  quality) export SIM_FAULT_PLAN=/app/sim-plans/ac08-quality.json ;;
  *) echo "팔은 default · control · quality" >&2; exit 1 ;;
esac
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp29.XXXX")
trap 'rm -rf "$TMP"' EXIT

echo "── rep $REP · 팔 $ARM · 복원 $SNAP"
restore_snap "$SNAP"
echo "── 기준선 ${BASE}초"
baseline "$BASE" "$TMP/baseline"
APP_ROLE=all api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
T0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
sleep "$WARM"
curl -s http://127.0.0.1:3000/metrics > "$TMP/m0"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "── 판정 창 ${WIN}초 시작 $WS(1초 lag 표본)"
sample_lag "$WIN" "$TMP/lag"
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -s http://127.0.0.1:3000/metrics > "$TMP/m1"
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-api-1 db_study-postgres-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/load"
$COMPOSE run --rm --no-deps api node dist/lab/s2-verify.js --phase running > "$TMP/running"
echo "── 수집 정지 · 창 끝 $WE"
api_stop
EMITTED=$(docker logs db_study-api-1 2>&1 | sed -n 's/.*수집 정지 — points_emitted 누계 \([0-9]*\).*/\1/p' | tail -1)
if [ -z "$EMITTED" ]; then echo "정지 로그에 points_emitted 누계가 없다 — 드레인이 끝나지 않았다" >&2; exit 1; fi
echo "── 정합(정지 상태)"
if ! verify --phase stopped "${EXTRA[@]}" --window-start "$WS" --window-end "$WE" > "$TMP/verify"; then
  cat "$TMP/verify" >&2; echo "반복 $REP 불성립 — 랙이 0이 아니다" >&2; exit 1
fi
if [ "$ARM" = quality ]; then scripts/lab/s3/ac08-check.sh "$T0" > "$TMP/ac08"; else echo null > "$TMP/ac08"; fi
python3 scripts/lab/s2/hist-diff.py "$TMP/m0" "$TMP/m1" col_modbus_rtt_seconds poll_duration ing_stream_residence_seconds ing_decode_seconds ing_fanin_wait_seconds insert_duration > "$TMP/hist"
python3 - "$TMP" "$REP" "$ARM" "$SNAP" "$EMITTED" "$WS" "$WE" >> "$OUT" <<'PY'
import json, sys
d, rep, arm, snap, emitted, ws, we = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], float(sys.argv[5]), sys.argv[6], sys.argv[7]
rd = lambda n: open(f'{d}/{n}').read()
lag = [l.split() for l in rd('lag').strip().splitlines()]
num = lambda v: float(v) if v not in ('', None) else None
lags = [num(r[1]) for r in lag if len(r) > 1]
pend = [num(r[2]) for r in lag if len(r) > 2]
print(json.dumps({
    'rep': rep, 'arm': arm, 'snapshot': snap, 'window': [ws, we],
    'health': json.loads(rd('health')),
    'pointsEmittedAtStop': emitted,
    'ac19': {'samples': len(lag), 'lagMax': max([x for x in lags if x is not None], default=None),
             'lagNonZero': sum(1 for x in lags if x), 'pendingMax': max([x for x in pend if x is not None], default=None),
             'missing': sum(1 for x in lags if x is None)},
    'running': json.loads(rd('running')),
    'verify': json.loads(rd('verify')),
    'ac08': json.loads(rd('ac08')),
    'segments': json.loads(rd('hist')),
    'baseline': rd('baseline').strip().splitlines(),
    'load': rd('load').strip().splitlines(),
}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin); v=d['verify']
print(json.dumps({'rep':d['rep'],'arm':d['arm'],'emitted':d['pointsEmittedAtStop'],'ac19':d['ac19'],'ac04':d['running'].get('ac04'),'ac08':d['ac08'],
 'verify':{k:v[k] for k in v if k not in ('e2e',)}}, ensure_ascii=False)[:3000])
"
