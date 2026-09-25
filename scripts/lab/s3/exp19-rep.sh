#!/usr/bin/env bash
# EXP-19(failure-dlq · 기록 018) 반복 1회 — 모드 B · 해독 불가 혼합 + 재시도 소진 유발(ClickHouse 컨테이너 정지 > 백오프 합계 31초)
# ① 복원 ③ 기준선 ② api 기동(worker) → 모드 B 발행(--undecodable-every N) → 발행 시작 T초 뒤 clickhouse 정지(STOP초) → 재기동
# ⑦ 랙 0 대기 → 정상 종료 → s3-verify(AC-01 · DLQ 사유별 · 소진 격리 포인트 · diffAfterDlq · PEL)
# docker pause가 아니라 stop을 쓴다 — pause는 연결이 대기해 요청 타임아웃(10초)만큼 한 시도가 늘어질 뿐 연결 거부가 나지 않아 소진에 이르지 못한다(통합 확인).
# 사용: scripts/lab/s3/exp19-rep.sh <출력 JSON 줄 파일> <반복 번호> [발행 초=90] [해독 불가 간격=50] [정지 시작 초=15] [정지 초=45] [기준선 초=300]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
DUR=${3:-90}
EVERY=${4:-50}
AT=${5:-15}
STOP=${6:-45}
BASE=${7:-300}
require_clean
export CAPACITY_TIER=S
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/exp19.XXXX")
trap 'docker start db_study-clickhouse-1 >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
echo "── rep $REP · 복원 s3-empty-s"
restore_snap s3-empty-s
baseline "$BASE" "$TMP/baseline"
APP_ROLE=worker api_up
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
WS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
# 발행은 이 명령 안에서 끝나는 자식 프로세스다 — 아래 wait로 거둔다(백그라운드로 남기지 않는다)
$COMPOSE --profile datagen run --rm --no-deps datagen node dist/mode-b.js --tier S --mix mixed --seed 42 --duration "$DUR" --undecodable-every "$EVERY" 2>/dev/null | tail -1 > "$TMP/modeb" &
DG=$!
T=$(date +%s); until [ $(( $(date +%s) - T )) -ge "$AT" ]; do sleep 1; done
docker stop -t 0 db_study-clickhouse-1 >/dev/null; S0=$(date -u +%Y-%m-%dT%H:%M:%S.000Z); P=$(date +%s)
until [ $(( $(date +%s) - P )) -ge "$STOP" ]; do sleep 1; done
docker start db_study-clickhouse-1 >/dev/null; S1=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
wait "$DG"
T=$(date +%s); until [ $(( $(date +%s) - T )) -ge 5 ]; do sleep 1; done
until [ "$(metric consumer_lag)" = 0 ] || [ $(( $(date +%s) - T )) -ge 180 ]; do sleep 2; done
WE=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -s http://127.0.0.1:3000/metrics | grep -E '^(dlq_count|ing_insert_retries_total|rows_inserted|ing_consumer_paused_seconds_total|consumer_lag)' > "$TMP/metrics" || true
api_stop
verify --phase stopped --window-start "$WS" --window-end "$WE" > "$TMP/verify" || { cat "$TMP/verify" >&2; echo "랙이 0이 아니다" >&2; exit 1; }
python3 - "$TMP" "$REP" "$WS" "$WE" "$S0" "$S1" >> "$OUT" <<'PY'
import json, sys
d, rep, ws, we, s0, s1 = sys.argv[1], int(sys.argv[2]), *sys.argv[3:]
rd = lambda n: open(f'{d}/{n}').read()
print(json.dumps({
  'rep': rep, 'window': [ws, we], 'clickhouseStopped': [s0, s1],
  'health': json.loads(rd('health')), 'modeB': json.loads(rd('modeb')),
  'metrics': rd('metrics').strip().splitlines(), 'verify': json.loads(rd('verify')),
  'baseline': rd('baseline').strip().splitlines(),
}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "
import json,sys; d=json.load(sys.stdin); v=d['verify']
print(json.dumps({'rep':d['rep'],'group':v['group'],'ac01':v['ac01'],'ac02':v['ac02'],'metrics':d['metrics']}, ensure_ascii=False))"
