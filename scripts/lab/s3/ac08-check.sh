#!/usr/bin/env bash
# AC-08 품질 전파 판정 — exp29-rep.sh quality 팔이 정지 뒤 부른다(SIM 계획 infra/sim-plans/ac08-quality.json + seed --range)
# 설비 id ↔ 포트: 티어 S 시드는 device_id n = 포트 5019 + n(5021 = 설비 2 예외 · 5022 = 설비 3 지연)
# 판정: ① 설비 2 품질 2 행이 있고 그 ts 폭이 예외 창(60초)에 맞다 ② 설비 3의 최대 ts 공백이 지연 창(60초)을 덮는다 · 품질 3 행 0
#       ③ 범위 밖 값(range_min · range_max 밖)은 품질 4 · 범위 안 루프백 값은 9 — 예외 행(2)은 값 자리 0이라 범위 판정에서 뺀다
# 사용: scripts/lab/s3/ac08-check.sh <api 기동 시각 ISO>
source "$(dirname "$0")/_lib.sh"
T0=${1:?api 기동 시각}
pgq() { docker exec -u postgres db_study-postgres-1 psql -d plc -Atc "$1"; }
RANGE=$(pgq "SELECT min(range_min) || ',' || max(range_max) FROM tag_master")
MIN=${RANGE%,*}; MAX=${RANGE#*,}
Q() { chq "$1" | tr -d '\n'; }
DIST=$(Q "SELECT toJSONString(CAST(groupArray((toString(quality), c)) AS Map(String, UInt64))) FROM (SELECT quality, count() c FROM plc.tag_raw GROUP BY quality ORDER BY quality)")
EXC=$(Q "SELECT toJSONString(tuple(count(), dateDiff('millisecond', min(ts), max(ts)) / 1000, toString(min(ts)), toString(max(ts)), uniq(device_id), max(abs(value)))) FROM plc.tag_raw WHERE quality = 2")
GAP=$(Q "SELECT toJSONString(tuple(arrayMax(arrayDifference(arraySort(groupUniqArray(toUnixTimestamp64Milli(ts))))) / 1000, 0)) FROM plc.tag_raw WHERE device_id = 3")
GAP_OTHERS=$(Q "SELECT max(g) / 1000 FROM (SELECT device_id, arrayMax(arrayDifference(arraySort(groupUniqArray(toUnixTimestamp64Milli(ts))))) AS g FROM plc.tag_raw WHERE device_id != 3 GROUP BY device_id)")
RANGE_OK=$(Q "SELECT toJSONString(tuple(countIf(quality = 4 AND value >= $MIN AND value <= $MAX), countIf(quality = 9 AND (value < $MIN OR value > $MAX)), countIf(quality = 4), countIf(quality = 9))) FROM plc.tag_raw")
python3 - "$T0" "$MIN" "$MAX" "$DIST" "$EXC" "$GAP" "$GAP_OTHERS" "$RANGE_OK" <<'PY'
import json, sys
t0, mn, mx, dist, exc, gap, gapo, rng = sys.argv[1:]
dist = json.loads(dist); exc = json.loads(exc); gap = json.loads(gap); rng = json.loads(rng)
out = {
  'startedAt': t0, 'range': [float(mn), float(mx)], 'qualityDist': dist,
  'exception': {'rows': exc[0], 'spanS': exc[1], 'from': exc[2], 'to': exc[3], 'devices': exc[4], 'maxAbsValue': exc[5]},
  'timeout': {'device3MaxGapS': gap[0], 'otherDevicesMaxGapS': float(gapo or 0)},
  'range4': {'q4InRange': rng[0], 'q9OutOfRange': rng[1], 'q4': rng[2], 'q9': rng[3]},
}
ok = (int(exc[0]) > 0 and int(exc[4]) == 1 and 50 <= float(exc[1]) <= 70
      and float(gap[0]) >= 55 and float(gapo or 0) < 5
      and '3' not in dist and int(rng[0]) == 0 and int(rng[1]) == 0 and int(rng[2]) > 0)
out['pass'] = ok
print(json.dumps(out, ensure_ascii=False))
PY
