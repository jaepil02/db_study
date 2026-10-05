#!/usr/bin/env bash
# S4 반복 1회 — EXP-29(regression-stage-s4 · 기록 021) 본 호출 — AC-01 · 02 · 04 · 05 · 07 · 19 회귀(S3 절차 그대로) + AC-06(세 층 · 헤드리스)
# ① 복원(s3-empty-s) ③ 기준선 ② api(all · 모드 A) + 웹 ④ 워밍업 ⑤ 판정 창(1초 lag 표본) — 창 한가운데서 AC-06 한 번 ⑥ 정상 종료 ⑦ s3-verify
# AC-10은 api 정지 · 기동이 AC-01 계수(정지 로그 points_emitted)를 깨므로 별도 호출(ac10-rep.sh)로 잰다.
# 사용: scripts/lab/s4/exp29-rep.sh <출력 JSON 줄 파일> <반복 번호> [창 초=150] [워밍업 초=20] [기준선 초=240]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
WIN=${3:-150}
WARM=${4:-20}
BASE=${5:-240}
require_clean
export CAPACITY_TIER=S
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/e29.XXXX")
trap 'web_stop; rm -rf "$TMP"' EXIT
echo "── rep $REP · 복원 s3-empty-s"
restore_snap s3-empty-s
baseline "$BASE" "$TMP/baseline"
APP_ROLE=all api_up
web_start
curl -s http://127.0.0.1:13000/api/v1/health > "$TMP/health"
sleep "$WARM"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "── 판정 창 ${WIN}초 · AC-06은 창 30초 지점"
( sleep 30; node scripts/lab/s4/ac06-capture.cjs $(( 2 + REP )) "AC06-r$REP-$(date +%s)" > "$TMP/ac06" ) &
AC6=$!
sample_lag "$WIN" "$TMP/lag"
wait "$AC6" || true
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
$COMPOSE run --rm --no-deps api node dist/lab/s2-verify.js --phase running > "$TMP/running"
web_stop
api_stop
EMITTED=$(docker logs db_study-api-1 2>&1 | sed -n 's/.*수집 정지 — points_emitted 누계 \([0-9]*\).*/\1/p' | tail -1)
[ -n "$EMITTED" ] || { echo "정지 로그에 points_emitted 누계가 없다" >&2; exit 1; }
verify --phase stopped --window-start "$WS" --window-end "$WE" > "$TMP/verify" || { cat "$TMP/verify" >&2; echo "정합 불성립" >&2; exit 1; }
python3 - "$TMP" "$REP" "$EMITTED" "$WS" "$WE" >> "$OUT" <<'PY'
import json, sys
d, rep, emitted, ws, we = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), sys.argv[4], sys.argv[5]
rd = lambda n: open(f'{d}/{n}').read().strip()
lag = [l.split() for l in rd('lag').splitlines()]
num = lambda v: float(v) if v not in ('', None) else None
lags = [num(r[1]) for r in lag if len(r) > 1]
pend = [num(r[2]) for r in lag if len(r) > 2]
print(json.dumps({'rep': rep, 'snapshot': 's3-empty-s', 'window': [ws, we], 'health': json.loads(rd('health')),
  'pointsEmittedAtStop': emitted,
  'ac19': {'samples': len(lag), 'lagMax': max([x for x in lags if x is not None], default=None), 'lagNonZero': sum(1 for x in lags if x),
           'pendingMax': max([x for x in pend if x is not None], default=None), 'missing': sum(1 for x in lags if x is None)},
  'running': json.loads(rd('running')), 'verify': json.loads(rd('verify')), 'ac06': json.loads(rd('ac06') or '{}'),
  'baseline': rd('baseline').splitlines()}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps({'rep':d['rep'],'ac06':d['ac06'],'ac19':d['ac19'],'ac04':d['running'].get('ac04'),'verify':{k:v for k,v in d['verify'].items() if k!='e2e'}}, ensure_ascii=False)[:2500])"
