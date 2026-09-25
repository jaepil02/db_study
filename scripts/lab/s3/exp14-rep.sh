#!/usr/bin/env bash
# EXP-14(switch-sw10-deadband · 기록 017) — 한 프로파일의 SW-10 off · on 두 팔(반복 1회분) · 모드 A 전용(조합 제약 #8)
# 팔마다: ① 복원 s3-deadband-s(seed --deadband 0.1) ② api 기동(all · GEN_PROFILE=프로파일 · COLLECTOR_DEADBAND=팔) ④ 워밍업
# ⑤ 판정 창 WIN초 ⑥ 정상 종료(방출 누계 로그) ⑦ s3-verify(AC-01 — 생략분은 발행 전에 빠져 Stream 포인트 = 행 수) · 파트 압축 크기
# 기준선은 반복마다 한 번(첫 프로파일에서만 BASE>0) — 한 호출이 10분 안에 끝나도록 프로파일 단위로 나눈다.
# 사용: scripts/lab/s3/exp14-rep.sh <출력 JSON 줄 파일> <프로파일> <반복 번호> [창 초=60] [워밍업 초=10] [기준선 초=0]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
PROFILE=${2:?신호 프로파일}
REP=${3:?반복 번호}
WIN=${4:-60}
WARM=${5:-10}
BASE=${6:-0}
require_clean
export CAPACITY_TIER=S GEN_PROFILE=$PROFILE
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp14.XXXX")
trap 'rm -rf "$TMP"' EXIT
if [ "$BASE" -gt 0 ]; then restore_snap s3-deadband-s; baseline "$BASE" "$TMP/baseline"; else : > "$TMP/baseline"; fi
for SW in off on; do
  echo "── rep $REP · $PROFILE · SW-10 $SW"
  restore_snap s3-deadband-s
  COLLECTOR_DEADBAND=$SW APP_ROLE=all api_up
  curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health-$SW"
  T=$(date +%s); until [ $(( $(date +%s) - T )) -ge "$WARM" ]; do sleep 1; done
  WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  T=$(date +%s); until [ $(( $(date +%s) - T )) -ge "$WIN" ]; do sleep 1; done
  WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  curl -s http://127.0.0.1:3000/metrics | awk '$1 ~ /^(points_emitted|col_deadband_skipped_total)\{/ {split($1,a,"{"); s[a[1]]+=$2} END {for (k in s) print k, s[k]}' > "$TMP/metrics-$SW"
  api_stop
  EMITTED=$(docker logs db_study-api-1 2>&1 | sed -n 's/.*수집 정지 — points_emitted 누계 \([0-9]*\).*/\1/p' | tail -1)
  verify --phase stopped --window-start "$WS" --window-end "$WE" > "$TMP/verify-$SW" || { cat "$TMP/verify-$SW" >&2; echo "랙이 0이 아니다" >&2; exit 1; }
  chq "SELECT sum(rows), sum(data_compressed_bytes), sum(data_uncompressed_bytes), count() FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active" > "$TMP/parts-$SW"
  chq "SELECT sum(column_data_compressed_bytes), sum(column_data_uncompressed_bytes) FROM system.parts_columns WHERE database = 'plc' AND table = 'tag_raw' AND active AND column = 'value'" > "$TMP/value-$SW"
  echo "{\"emittedAtStop\": ${EMITTED:-null}, \"window\": [\"$WS\", \"$WE\"]}" > "$TMP/stop-$SW"
done
python3 - "$TMP" "$REP" "$PROFILE" >> "$OUT" <<'PY'
import json, sys
d, rep, prof = sys.argv[1], int(sys.argv[2]), sys.argv[3]
rd = lambda n: open(f'{d}/{n}').read()
arms = {}
for sw in ('off', 'on'):
    m = dict(l.split() for l in rd(f'metrics-{sw}').strip().splitlines())
    p = rd(f'parts-{sw}').split(); v = rd(f'value-{sw}').split()
    st = json.loads(rd(f'stop-{sw}'))
    arms[sw] = {
      'window': st['window'], 'emittedAtStop': st['emittedAtStop'],
      'skippedAtWindowEnd': float(m.get('col_deadband_skipped_total', 0)), 'emittedAtWindowEnd': float(m.get('points_emitted', 0)),
      'health': json.loads(rd(f'health-{sw}'))['switches']['SW-10'],
      'rows': int(p[0]), 'compressedBytes': int(p[1]), 'uncompressedBytes': int(p[2]), 'parts': int(p[3]),
      'ratio': int(p[2]) / int(p[1]) if int(p[1]) else None,
      'valueCompressed': int(v[0]), 'valueUncompressed': int(v[1]),
      'verify': json.loads(rd(f'verify-{sw}')),
    }
print(json.dumps({'rep': rep, 'profile': prof, 'arms': arms, 'baseline': rd('baseline').strip().splitlines()}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys; d=json.load(sys.stdin)
for sw,a in d['arms'].items():
  v=a['verify']['ac01']
  print(d['rep'], d['profile'], sw, 'emit', a['emittedAtStop'], 'skip', a['skippedAtWindowEnd'], 'rows', a['rows'], 'ratio', round(a['ratio'] or 0,2), 'diff', v['diff'])"
