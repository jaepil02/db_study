#!/usr/bin/env bash
# EXP-34(ingest-batch-strategies · 기록 020) 반복 1회 — 모드 B · 배치 안 A · B · C(INGEST_BATCH_PLAN — 스위치 아님 · 조건 칸)
# 팔 lag-S: 티어 S · 안 A · 1초 lag 표본(AC-19 — 그룹 lag 0 유지 · pending 유계 · 정지 뒤 0)
# 팔 A · B · C: 티어 M(s3-empty-m · 10,000 pps) · 파트 생성률(system.part_log NewPart) · 활성 파트 · E2E(ingested_at − ts) · lag(AC-22)
# ① 복원 ③ 기준선 ② api 기동(worker · 안) → 모드 B 발행 DUR초(발행과 같은 시간 동안 lag 표본) → 랙 0 → 정상 종료 → s3-verify
# 사용: scripts/lab/s3/exp34-rep.sh <출력 JSON 줄 파일> <lag-S|A|B|C> <반복 번호> [발행 초=120] [기준선 초=300]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
ARM=${2:?lag-S · A · B · C}
REP=${3:?반복 번호}
DUR=${4:-120}
BASE=${5:-300}
require_clean
case "$ARM" in
  lag-S) TIER=S; PLAN=A; SNAP=s3-empty-s ;;
  A|B|C) TIER=M; PLAN=$ARM; SNAP=s3-empty-m ;;
  *) echo "팔은 lag-S · A · B · C" >&2; exit 1 ;;
esac
export CAPACITY_TIER=$TIER INGEST_BATCH_PLAN=$PLAN
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp34.XXXX")
trap 'rm -rf "$TMP"' EXIT
echo "── rep $REP · 팔 $ARM(티어 $TIER · 안 $PLAN) · 복원 $SNAP"
restore_snap "$SNAP"
baseline "$BASE" "$TMP/baseline"
APP_ROLE=worker api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
# 발행(자식 프로세스 · 아래 wait로 거둔다)과 lag 표본을 같은 시간에 돈다
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier "$TIER" --mix mixed --seed 42 --duration "$DUR" 2>/dev/null | tail -1 > "$TMP/modeb" &
DG=$!
sample_lag "$DUR" "$TMP/lag"
wait "$DG"
PUB_END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
T=$(date +%s); until [ $(( $(date +%s) - T )) -ge 5 ]; do sleep 1; done
until [ "$(metric consumer_lag)" = 0 ] || [ $(( $(date +%s) - T )) -ge 180 ]; do sleep 1; done
DRAIN_S=$(( $(date +%s) - T + 5 ))
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' db_study-api-1 db_study-clickhouse-1 db_study-redis-1 > "$TMP/load"
api_stop
chq "SYSTEM FLUSH LOGS"
chq "SELECT toJSONString(tuple(count(), countIf(merge_reason = 'NotAMerge'), sum(rows))) FROM system.part_log
     WHERE database = 'plc' AND table = 'tag_raw' AND event_type = 'NewPart'
       AND event_time >= parseDateTimeBestEffort('$WS') AND event_time <= parseDateTimeBestEffort('$WE')" > "$TMP/parts"
chq "SELECT toJSONString(tuple(count(), countDistinct(partition))) FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active" > "$TMP/active"
chq "SELECT toJSONString(tuple(count(), sum(written_rows), quantileExact(0.5)(query_duration_ms), quantileExact(0.95)(query_duration_ms))) FROM system.query_log
     WHERE type = 'QueryFinish' AND query_kind = 'Insert' AND has(tables, 'plc.tag_raw')
       AND event_time >= parseDateTimeBestEffort('$WS') AND event_time <= parseDateTimeBestEffort('$WE')" > "$TMP/inserts"
verify --phase stopped --window-start "$WS" --window-end "$PUB_END" > "$TMP/verify" || { cat "$TMP/verify" >&2; echo "랙이 0이 아니다" >&2; exit 1; }
python3 - "$TMP" "$REP" "$ARM" "$TIER" "$PLAN" "$DUR" "$WS" "$WE" "$DRAIN_S" >> "$OUT" <<'PY'
import json, sys
d, rep, arm, tier, plan, dur, ws, we, drain = sys.argv[1], int(sys.argv[2]), *sys.argv[3:]
rd = lambda n: open(f'{d}/{n}').read()
num = lambda v: float(v) if v not in ('', None) else None
lag = [l.split() for l in rd('lag').strip().splitlines()]
lags = [num(r[1]) if len(r) > 1 else None for r in lag]; pend = [num(r[2]) if len(r) > 2 else None for r in lag]
parts = json.loads(rd('parts')); act = json.loads(rd('active')); ins = json.loads(rd('inserts'))
print(json.dumps({
  'rep': rep, 'arm': arm, 'tier': tier, 'batchPlan': plan, 'publishS': int(dur), 'window': [ws, we], 'drainS': int(drain),
  'health': json.loads(rd('health')), 'modeB': json.loads(rd('modeb')),
  'lag': {'samples': len(lag), 'lagMax': max([x for x in lags if x is not None], default=None),
          'lagNonZero': sum(1 for x in lags if x), 'pendingMax': max([x for x in pend if x is not None], default=None),
          'series': [[r[0]] + r[1:] for r in lag]},
  'newParts': {'count': parts[0], 'fromInsert': parts[1], 'rows': parts[2], 'perMinute': parts[1] * 60 / int(dur)},
  'activeParts': {'count': act[0], 'partitions': act[1]},
  'inserts': {'count': ins[0], 'rows': ins[1], 'p50Ms': ins[2], 'p95Ms': ins[3]},
  'verify': json.loads(rd('verify')), 'baseline': rd('baseline').strip().splitlines(), 'load': rd('load').strip().splitlines(),
}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys; d=json.load(sys.stdin); v=d['verify']; l=dict(d['lag']); l.pop('series')
print(json.dumps({'rep':d['rep'],'arm':d['arm'],'lag':l,'newParts':d['newParts'],'active':d['activeParts'],'inserts':d['inserts'],'drainS':d['drainS'],'e2e':v.get('e2e'),'ac01':v['ac01']['diff'],'ac02':v['ac02']}, ensure_ascii=False))"
