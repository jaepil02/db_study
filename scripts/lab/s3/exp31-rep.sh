#!/usr/bin/env bash
# EXP-31(rollup-consistency · 기록 019) 반복 1회 — 모드 B · 티어 S · 적재 정지 후 버킷 대조(AC-05) · p95 순위 오차 분포
# ① 복원 ③ 기준선 ② api 기동(worker) → 모드 B 발행 DUR초 → 랙 0 → 정상 종료 → s3-verify --p95
# 판정: 세 해상도 버킷 count · min · max · last 정확 · avg 상계식 안(AC-05) · p95는 분포 기록(판정 아님)
# 사용: scripts/lab/s3/exp31-rep.sh <출력 JSON 줄 파일> <반복 번호> [발행 초=300] [기준선 초=300]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
DUR=${3:-300}
BASE=${4:-300}
require_clean
export CAPACITY_TIER=S
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp31.XXXX")
trap 'rm -rf "$TMP"' EXIT
echo "── rep $REP · 복원 s3-empty-s"
restore_snap s3-empty-s
baseline "$BASE" "$TMP/baseline"
APP_ROLE=worker api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier S --mix mixed --seed 42 --duration "$DUR" 2>/dev/null | tail -1 > "$TMP/modeb"
T=$(date +%s); until [ $(( $(date +%s) - T )) -ge 5 ]; do sleep 1; done
until [ "$(metric consumer_lag)" = 0 ] || [ $(( $(date +%s) - T )) -ge 120 ]; do sleep 2; done
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
api_stop
verify --phase stopped --p95 --window-start "$WS" --window-end "$WE" > "$TMP/verify" || { cat "$TMP/verify" >&2; echo "랙이 0이 아니다" >&2; exit 1; }
python3 - "$TMP" "$REP" "$WS" "$WE" >> "$OUT" <<'PY'
import json, sys
d, rep, ws, we = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
rd = lambda n: open(f'{d}/{n}').read()
print(json.dumps({'rep': rep, 'window': [ws, we], 'health': json.loads(rd('health')), 'modeB': json.loads(rd('modeb')),
  'verify': json.loads(rd('verify')), 'baseline': rd('baseline').strip().splitlines()}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys; d=json.load(sys.stdin); v=d['verify']
print(json.dumps({'rep':d['rep'],'ac01':v['ac01'],'ac05':v['ac05'],'exp31':v.get('exp31')}, ensure_ascii=False))"
