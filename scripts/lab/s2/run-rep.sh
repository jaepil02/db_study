#!/usr/bin/env bash
# S2 반복 1회 — EXP-29(regression-stage-s2 · AC-01 · 04 · 07) · EXP-30(latency-budget-s2) 공용
# ① 복원 ③ 기준선(api 없이 저장소 유휴 · 현행 참고 5분 — 10_observability/04) ② api 기동(APP_ROLE all · 모드 A) ④ 워밍업
# ⑤ 판정 창(메트릭 캡처 두 점) → AC-04(api가 떠 있을 때) ⑥ 수집 정지 = api 정상 종료(Collector 정지 → Ingest 드레인 · XACK)
#   — 다시 띄우지 않는다: 재기동의 기동 복원이 AC-07을 복원값끼리의 비교로 만든다 ⑦ 정합(랙 0이 아니면 반복 불성립 · exit 1) ⑧ 다음 반복이 복원
# 사용: scripts/lab/s2/run-rep.sh <출력 JSON 줄 파일> <스냅샷> <티어 S> <반복 번호> [창 초=150] [워밍업 초=20] [기준선 초=300]
# 한 번이 10분을 넘지 않게 창을 고른다 — 백그라운드로 돌리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUT=${1:?출력 파일}
SNAP=${2:?스냅샷 이름}
TIER=${3:?티어}
REP=${4:?반복 번호}
WIN=${5:-150}
WARM=${6:-20}
BASE=${7:-300}
DIRTY=$(git status --porcelain -- apps packages infra/postgres/migrations infra/clickhouse/ddl package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore)
if [ -n "$DIRTY" ]; then echo "이미지에 들어갈 변경이 커밋되지 않았다 — 기록의 커밋 해시가 실행 코드를 가리키지 않는다" >&2; exit 1; fi
HASH=$(git rev-parse --short HEAD)
export COMMIT_HASH=$HASH CAPACITY_TIER=$TIER
COMPOSE="docker compose --env-file .env -f infra/compose/compose.yml -f infra/compose/compose.load.yml"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

wait_api() { # health 200까지(도커 healthcheck 주기를 기다리지 않는다)
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null http://127.0.0.1:3000/api/v1/health; then return 0; fi
    sleep 1
  done
  echo "api health 90초 초과" >&2; exit 1
}
metric() { curl -s http://127.0.0.1:3000/metrics | awk -v n="$1" '$1==n {print $2}'; }

echo "── rep $REP · 복원 $SNAP"
# api 컨테이너를 먼저 지운다 — restore의 start가 직전 설정(역할 · 스위치)의 api를 다시 띄우지 않게
$COMPOSE rm -sf api >/dev/null 2>&1 || true
task restore NAME="$SNAP" >/dev/null
docker image inspect "db_study-api:$HASH" >/dev/null 2>&1 || $COMPOSE build -q api
echo "── 기준선 ${BASE}초(api 정지 · 저장소 유휴)"
sleep "$BASE"
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-postgres-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/baseline"
echo "── api 기동(all · 모드 A)"
APP_ROLE=all $COMPOSE up -d --no-deps --force-recreate api >/dev/null
wait_api
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
sleep "$WARM"
curl -s http://127.0.0.1:3000/metrics > "$TMP/m0"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
echo "── 판정 창 ${WIN}초 시작 $WS"
sleep "$WIN"
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -s http://127.0.0.1:3000/metrics > "$TMP/m1"
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-api-1 db_study-postgres-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/load"
echo "── AC-04(api 기동 중)"
$COMPOSE run --rm --no-deps api node dist/lab/s2-verify.js --phase running > "$TMP/running"
echo "── 수집 정지(api 정상 종료 · 드레인) · 창 끝 $WE"
$COMPOSE stop -t 60 api >/dev/null
EMITTED=$(docker logs db_study-api-1 2>&1 | sed -n 's/.*수집 정지 — points_emitted 누계 \([0-9]*\).*/\1/p' | tail -1)
if [ -z "$EMITTED" ]; then echo "정지 로그에 points_emitted 누계가 없다 — 드레인이 끝나지 않았다" >&2; exit 1; fi
echo "── 정합(정지 상태)"
if ! $COMPOSE run --rm --no-deps api node dist/lab/s2-verify.js --phase stopped --window-start "$WS" --window-end "$WE" > "$TMP/verify"; then
  cat "$TMP/verify" >&2; echo "반복 $REP 불성립 — 랙이 0이 아니다" >&2; exit 1
fi
python3 scripts/lab/s2/hist-diff.py "$TMP/m0" "$TMP/m1" col_modbus_rtt_seconds poll_duration ing_stream_residence_seconds ing_decode_seconds ing_fanin_wait_seconds insert_duration > "$TMP/hist"
python3 - "$TMP" "$REP" "$SNAP" "$EMITTED" >> "$OUT" <<'PY'
import json, sys
d, rep, snap, emitted = sys.argv[1], int(sys.argv[2]), sys.argv[3], float(sys.argv[4])
rd = lambda n: open(f'{d}/{n}').read()
print(json.dumps({
    'rep': rep, 'snapshot': snap,
    'health': json.loads(rd('health')),
    'pointsEmittedAtStop': emitted,
    'running': json.loads(rd('running')),
    'verify': json.loads(rd('verify')),
    'segments': json.loads(rd('hist')),
    'baseline': rd('baseline').strip().splitlines(),
    'load': rd('load').strip().splitlines(),
}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin); v=d['verify']; a=v['ac01']; s=v['ac07']; e=v.get('e2e',{})
print(f\"rep={d['rep']} lag={v['group']} AC-01 emitted={d['pointsEmittedAtStop']} stream={a['streamPoints']} tag_raw={a['tagRawRows']} diff={a['diff']} undecodable={a['undecodable']} | AC-07 compared={s['compared']} mismatched={s['mismatched']} missing={s['missingInRedis']} | AC-04 {d['running'].get('ac04')} | E2E p50={e.get('p50Ms')} p95={e.get('p95Ms')} p99={e.get('p99Ms')} rows={e.get('rows')}\")
for h in d['segments']: print(f\"  {h['metric']:30} n={h['count']:.0f} p50={h['p50S']} p95={h['p95S']}\")
"
