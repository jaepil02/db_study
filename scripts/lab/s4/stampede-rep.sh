#!/usr/bin/env bash
# EXP-10(SW-05 · 기록 024) 반복 1회의 팔 하나 — 티어 M · s4-hist-m · api 역할 + worker + 모드 B 배경(판정 14) · SW-03 · 04 on(제약 #1)
# ① 재구성 시간 — 캐시 미스 단건을 순차 SEQ회(요청마다 다른 범위) · tsq_rebuild_duration_seconds 버킷 차 p50 · p95 + 클라이언트 시간
# ② 관계 검산 — 대기 총량(50 ms × 3 = 150 ms) ≥ 재구성 p95 인가(판정 8)
# ③ cache:q 비움 → 같은 범위 동시 N(k6 per-vu-iterations) · 원천 쿼리 수(tsq_source_queries_total 차 · query_log 정규화 해시별) · 대기 소진 수
# 사용: scripts/lab/s4/stampede-rep.sh <출력 JSON 줄 파일> <반복 번호> <팔 on|off> [N=50] [SEQ=20] [기준선 초=240]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
ARM=${3:?on · off}
N=${4:-50}
SEQ=${5:-20}
BASE=${6:-240}
require_clean
export CAPACITY_TIER=M CACHE_STAMPEDE_LOCK=$ARM
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/stp.XXXX")
trap 'worker_stop; rm -rf "$TMP"' EXIT
echo "── exp10 rep $REP · 팔 $ARM · 복원 $HIST_SNAP"
worker_stop
restore_snap "$HIST_SNAP"
baseline "$BASE" "$TMP/baseline"
worker_start
APP_ROLE=api api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier M --mix mixed --seed 42 --duration 120 2>/dev/null | tail -1 > "$TMP/modeb" &
DG=$!
sleep 10
# ① 순차 미스 — 반복마다 다른 범위(분 경계 · 1일) — 반복 번호로 흩어 복원 뒤 첫 조회가 되게
snap_metrics "$TMP/a0"
python3 - "$ANCHOR_START" "$SEQ" "$REP" > "$TMP/seq" <<'PY'
import json, sys, time, urllib.request
a0, n, rep = int(sys.argv[1]) * 1000, int(sys.argv[2]), int(sys.argv[3])
iso = lambda ms: time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(ms / 1000 + 9 * 3600)) + '.000+09:00'
out = []
for i in range(n):
    f = a0 + 43_200_000 + (rep * 997 + i * 131) % 5000 * 60_000
    body = json.dumps({'tagIds': [1, 2, 201, 202], 'from': iso(f), 'to': iso(f + 86_400_000), 'aggregations': ['avg', 'max']}).encode()
    t = time.perf_counter()
    r = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:3000/api/v1/timeseries/query', body, {'content-type': 'application/json'}))
    j = json.load(r)
    out.append({'ms': (time.perf_counter() - t) * 1000, 'cached': j['meta']['cached'], 'points': j['meta']['pointCount']})
print(json.dumps(out))
PY
snap_metrics "$TMP/a1"
# ③ 동시 N — 비운 뒤 같은 범위(①과 겹치지 않는 범위)
FROM_MS=$(( (ANCHOR_START + 3 * 86400 + REP * 3600) * 1000 ))
TO_MS=$(( FROM_MS + 86400000 ))
flush_query_cache
chq "SYSTEM FLUSH LOGS"
T0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
k6run k6-query.js burst.json -e MODE=burst -e N="$N" -e FROM_MS="$FROM_MS" -e TO_MS="$TO_MS"
T1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
snap_metrics "$TMP/a2"
wait "$DG" || true
api_stop
worker_stop
chq "SYSTEM FLUSH LOGS"
# 원천 쿼리(태그 결과 조회) — 사전 조회(dictGet)는 빼고 normalized_query_hash별 실행 수
chq "SELECT toJSONString(groupArray(tuple(h, c))) FROM (SELECT normalized_query_hash AS h, count() AS c FROM system.query_log
     WHERE type = 'QueryFinish' AND event_time >= parseDateTimeBestEffort('$T0') - 1 AND event_time <= parseDateTimeBestEffort('$T1') + 1
       AND query LIKE '%FROM plc.tag_%' AND query NOT LIKE '%dictGet%' AND query NOT LIKE '%system.%' GROUP BY h)" > "$TMP/qlog"
python3 scripts/lab/s2/hist-diff.py "$TMP/a0" "$TMP/a1" tsq_rebuild_duration_seconds > "$TMP/rb"
printf '%s %s %s\n' "$(mdelta "$TMP/a1" "$TMP/a2" tsq_source_queries_total)" "$(mdelta "$TMP/a1" "$TMP/a2" tsq_rebuild_lock_wait_exhausted_total)" "$(mdelta "$TMP/a1" "$TMP/a2" 'tsq_cache_requests_total{result="hit"}')" > "$TMP/burst"
python3 - "$TMP" "$REP" "$ARM" "$N" >> "$OUT" <<'PY'
import json, sys
d, rep, arm, n = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
rd = lambda x: open(f'{d}/{x}').read().strip()
seq = json.loads(rd('seq'))
ms = sorted(x['ms'] for x in seq)
q = lambda p: ms[min(len(ms) - 1, int(round(p * (len(ms) - 1))))]
src, exh, hit = map(float, rd('burst').split())
k6 = json.load(open(f'{d}/burst.json'))['metrics']
qlog = json.loads(rd('qlog') or '[]')
print(json.dumps({'exp': 'exp10', 'rep': rep, 'arm': arm, 'n': n,
  'rebuild': {'server': json.loads(rd('rb')), 'clientMsExact': {'p50': q(0.5), 'p95': q(0.95), 'max': ms[-1]}, 'allMiss': all(not x['cached'] for x in seq), 'seq': len(seq)},
  'relation': {'waitTotalMs': 150, 'holds': q(0.95) <= 150},
  'burst': {'sourceQueries': src, 'exhausted': exh, 'hits': hit, 'queryLogByHash': qlog, 'queryLogMax': max([c for _, c in qlog], default=0),
            'k6': {'p50': k6['http_req_duration'].get('med'), 'p95': k6['http_req_duration'].get('p(95)'), 'count': k6['http_reqs']['count'], 'fails': k6.get('checks', {}).get('fails')}},
  'health': json.loads(rd('health')), 'modeB': json.loads(rd('modeb') or 'null'), 'baseline': rd('baseline').splitlines()}, ensure_ascii=False))
PY
echo "── exp10 rep $REP · 팔 $ARM 완료"
