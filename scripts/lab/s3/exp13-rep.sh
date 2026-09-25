#!/usr/bin/env bash
# EXP-13(switch-sw08-idempotency · 기록 016) 반복 1회 — SW-08 off/on · 모드 B · 결함 주입 크래시
# ① 복원 ③ 기준선 ② api 기동(worker · 적재만 · INGEST_LAB_FAULT=crash-after-insert:N — 1회 발동 · 표지 /app/spool/lab-fault-fired)
# → 모드 B 발행(datagen 컨테이너 · cpuset 11-12) → n번째 배치 삽입 성공 뒤 XACK 전 exit 137 → 재시작 정책이 다시 띄운다 → 자기 PEL 재읽기
# ⑦ 랙 0 대기 → 정상 종료 → s3-verify(AC-02 중복 조합 · AC-01) · query_log(재시도 · 중복 제거 블록)
# 사용: scripts/lab/s3/exp13-rep.sh <출력 JSON 줄 파일> <off|on> <반복 번호> [발행 초=30] [크래시 배치=5] [기준선 초=300]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
SW=${2:?off · on}
REP=${3:?반복 번호}
DUR=${4:-30}
NTH=${5:-5}
BASE=${6:-300}
require_clean
export CAPACITY_TIER=S INGEST_IDEMPOTENCY=$SW INGEST_LAB_FAULT=crash-after-insert:$NTH
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp13.XXXX")
trap 'rm -rf "$TMP"' EXIT
echo "── rep $REP · SW-08 $SW · 복원 s3-empty-s"
restore_snap s3-empty-s
baseline "$BASE" "$TMP/baseline"
APP_ROLE=worker api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health0"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier S --mix mixed --seed 42 --duration "$DUR" 2>/dev/null | tail -1 > "$TMP/modeb"
T=$(date +%s); until [ $(( $(date +%s) - T )) -ge 5 ]; do sleep 1; done
until [ "$(metric consumer_lag)" = 0 ] || [ $(( $(date +%s) - T )) -ge 180 ]; do sleep 2; done
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
RESTARTS=$(docker inspect db_study-api-1 --format '{{.RestartCount}}')
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health1"
curl -s http://127.0.0.1:3000/metrics | grep -E '^(ing_insert_retries_total|rows_inserted|dlq_count)' > "$TMP/metrics" || true
api_stop
docker logs db_study-api-1 2>&1 | grep -E '"event":"lab_fault"|PEL 회수' > "$TMP/log" || true
chq "SYSTEM FLUSH LOGS"
chq "SELECT count(), sum(ProfileEvents['DuplicatedInsertedBlocks']), sum(written_rows) FROM system.query_log
     WHERE type = 'QueryFinish' AND query_kind = 'Insert' AND has(tables, 'plc.tag_raw')
       AND event_time >= parseDateTimeBestEffort('$WS') AND event_time <= parseDateTimeBestEffort('$WE') + INTERVAL 5 SECOND" > "$TMP/qlog"
verify --phase stopped --window-start "$WS" --window-end "$WE" > "$TMP/verify" || { cat "$TMP/verify" >&2; echo "랙이 0이 아니다" >&2; exit 1; }
python3 - "$TMP" "$REP" "$SW" "$RESTARTS" "$WS" "$WE" >> "$OUT" <<'PY'
import json, sys
d, rep, sw, restarts, ws, we = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4]), sys.argv[5], sys.argv[6]
rd = lambda n: open(f'{d}/{n}').read()
q = rd('qlog').split()
print(json.dumps({
  'rep': rep, 'sw08': sw, 'window': [ws, we], 'restarts': restarts,
  'health0': json.loads(rd('health0')), 'switchesAfter': json.loads(rd('health1'))['switches']['SW-08'],
  'modeB': json.loads(rd('modeb')), 'metrics': rd('metrics').strip().splitlines(), 'log': rd('log').strip().splitlines(),
  'queryLog': {'inserts': int(q[0]), 'dedupBlocks': int(q[1]), 'writtenRows': int(q[2])},
  'verify': json.loads(rd('verify')), 'baseline': rd('baseline').strip().splitlines(),
}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys; d=json.load(sys.stdin); v=d['verify']
print(json.dumps({'rep':d['rep'],'sw08':d['sw08'],'restarts':d['restarts'],'ac02':v['ac02'],'ac01':v['ac01'],'qlog':d['queryLog'],'after':d['switchesAfter']['warning']}, ensure_ascii=False))"
