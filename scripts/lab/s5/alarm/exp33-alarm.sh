#!/usr/bin/env bash
# EXP-33 알람 분기 · 부분 실패 러너(alarm-branch-partial-failure) — S7 ① 판정기의 세 저장소 분기 · 디바운스 · 부분 실패 격리 · 판정 구간 · ACK 반영 지연
# 정본: docs/10_observability/06_experiment_catalog.md EXP-33(부하 · M · 기본값 · 모드 B(SPIKE 프로파일) · 판정 지표 · AC-09 · AC-35 · AC-36)
#       docs/06_pipeline/08_alarm.md(① 인계 ~ ⑧ 전수 · 전이 8 · 부분 실패 6 · 배치 halt · ⑧ 깊이 1 큐 · 규칙 시드 금지 — 규칙은 쓰기 표면으로)
#       docs/10_observability/02_instrumentation.md §구간 기록(alarm_eval_gap) · §확인(ACK) 신호 부재의 계측(EXP-33 두 브라우저)
#       docs/10_observability/04_experiment_protocol.md · 05_load_scenarios.md(모드 B · 장애 주입 = 호스트 셸 · 볼륨 삭제 금지)
# 구성: api(APP_ROLE api — 알람 표면 · WebSocket) + worker(APP_ROLE worker — 적재 · 판정기) + datagen 컨테이너(모드 B · --mix SPIKE · M 10,000 pps)
#       저장소 자원 = 부하 실험 프로파일(S5 공용 대조) · 스냅샷 기본 s7a-seed-m(규칙 0 · 학습자 계정 시드)
# 한 반복(= 호출 여러 번 · 각 540초 미만):
#   start    <반복>                 ~6.5분  ① 복원 · 기준선(BASE_S=300) · 기동 · 전제 대조(규칙 0 · 상태 키 0 · SW-06 on · 확인 행위자)
#   load     <반복> [지속 초=1500]  ~3분    ④ 모드 B 기동(호출을 넘어 산다 — 지속으로 스스로 끝남) · 규칙 계획 · 기저 대조 · 규칙 POST · 예열
#   window   <반복> [창 초=300]     ~5.5분  ⑤ 정상 상태 판정 창 — 판정 처리량 · 판정 구간 · 인계 대기 · 세 저장소 대조(창 ts 범위)
#   ack      <반복>                 ≤7분    두 브라우저 ACK 반영 지연(web 13001 — 떠 있지 않으면 이 호출 안에서 띄우고 거둔다)
#   fault-pg <반복> [정지 초=60]    ~3분    AC-36 ① PostgreSQL 정지 중 위반 지속(탐침 규칙) → 복구 뒤 확정 1 · 정지 중 발행 0
#                                           (정지 중 = [정지 완료, docker start 호출] · 복구 뒤 = [docker start 호출, 끝])
#   fault-ch <반복> [보류 초=60] [회복 초=45] ~2.5분 AC-36 ② alarm_eval 삽입 강제 실패 → 발생 · 해제 · 발행 정상 · 무효 구간 계수
#   stop     <반복> [상한 초=180]   ≤8.5분   ⑥ 생성기 종료 대기 · 소진 · 마감 판독(세 저장소 · 상태 · 전수) · 정지(아직 돌면 1 — 다시 부른다)
#   collect  <반복> <출력 jsonl>             원시 한 줄
#   table    <원시 jsonl> <출력 jsonl>       반복 줄들 → 구조(3회 전부) · 분포(중앙값 · 편차 p50) 한 줄(저장소 접속 없음)
#   reset    <반복>
# 비밀: .env를 읽지 않는다 — Redis 접속은 api 컨테이너의 REDIS_URL을 값 출력 없이 환경으로 넘긴다(docker exec -e 이름만).
source "$(dirname "$0")/../_lib.sh"
export PYTHONDONTWRITEBYTECODE=1
CMD=${1:?start|load|window|ack|fault-pg|fault-ch|stop|collect|table|reset}
EXP=exp33
ARM=alarm
A33=scripts/lab/s5/alarm
SNAP_EXP33=${SNAP_EXP33:-s7a-seed-m}
PG_NAME=db_study-postgres-1
RD_NAME=db_study-redis-1
API_NAME=db_study-api-1
HOLD_TABLE=alarm_eval_exp33_hold
API=http://127.0.0.1:13000
PW_CORE=${PW_CORE:-/private/tmp/claude-501/-Users-jaepil-project-db-study/4afbce1e-3577-4b7c-851b-7586945819ff/scratchpad/node_modules/playwright-core}
CHROME=${CHROME:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell}

pgq() { docker exec -u postgres "$PG_NAME" psql -d plc -XAtq -v ON_ERROR_STOP=1 -F , -c "$1"; }
redis_url() { docker exec "$API_NAME" printenv REDIS_URL; }
RURL=''
# 컨테이너 안 redis-cli 접속 인자 — REDIS_URL(redis://[사용자]:비밀번호@호스트[:포트][/db])을 컨테이너 안에서 풀어 비밀번호는
# REDISCLI_AUTH 환경변수로만 준다(redis-cli 명령줄 · 컨테이너 ps에 비밀이 남지 않는다) · 퍼센트 인코딩된 자격이면 -u로 되돌아간다
RC_PRE='u=${REDIS_URL#*://}
case "$u" in *@*) cred=${u%%@*}; hp=${u#*@} ;; *) cred=; hp=$u ;; esac
db=; case "$hp" in */*) db=${hp#*/}; hp=${hp%%/*} ;; esac
case "$hp" in *:*) host=${hp%%:*}; port=${hp##*:} ;; *) host=$hp; port=6379 ;; esac
case "$cred" in
  *%*) CONN="-u $REDIS_URL" ;;
  *) CONN="-h $host -p $port"
     case "$cred" in *:*) ru=${cred%%:*}; pw=${cred#*:} ;; *) ru=; pw=$cred ;; esac
     [ -n "$pw" ] && export REDISCLI_AUTH="$pw"
     [ -n "$ru" ] && CONN="$CONN --user $ru"
     [ -n "$db" ] && CONN="$CONN -n $db" ;;
esac
'
rcli() { # redis-cli 인자 그대로 — URL은 환경으로만 넘긴다(명령줄 · 화면에 남기지 않는다)
  [ -n "$RURL" ] || RURL=$(redis_url)
  REDIS_URL=$RURL docker exec -i -e REDIS_URL "$RD_NAME" sh -c "$RC_PRE"'exec redis-cli --no-auth-warning $CONN "$@"' _ "$@"
}
state_keys() { rcli --scan --pattern 'alarm:state:*' | grep -c . || true; }
states_dump() { # $1=출력 나머지=규칙 ID
  local out=$1; shift
  [ -n "$RURL" ] || RURL=$(redis_url)
  REDIS_URL=$RURL IDS="$*" docker exec -e REDIS_URL -e IDS "$RD_NAME" sh -c \
    "$RC_PRE"'for id in $IDS; do echo "== $id"; redis-cli --no-auth-warning $CONN HGETALL "alarm:state:$id"; done' > "$out"
}
apiq() { curl -s --max-time 10 -H 'content-type: application/json' "$@"; }
rule_ids() { python3 -c 'import json,sys; print(" ".join(str(r["ruleId"]) for r in json.load(open(sys.argv[1])) if not sys.argv[2:] or r["tier"] in sys.argv[2:]))' "$ST/rules.json" "$@"; }
events_csv() { # 이 반복 규칙의 alarm_event — event_id, rule_id, occurred_ms, cleared_ms, acked_ms, state
  pgq "SELECT event_id, rule_id, (extract(epoch FROM occurred_at) * 1000)::bigint, coalesce(((extract(epoch FROM cleared_at) * 1000)::bigint)::text, ''),
       coalesce(((extract(epoch FROM acked_at) * 1000)::bigint)::text, ''), state FROM alarm_event WHERE rule_id IN ($1) ORDER BY event_id"
}
eval_tsv() { # $1=규칙 목록(쉼표) $2=시작 ms $3=끝 ms — rule_id · ts ms · breached
  chq "SELECT rule_id, toUnixTimestamp64Milli(ts), breached FROM plc.alarm_eval WHERE rule_id IN ($1)
       AND ts >= fromUnixTimestamp64Milli(toInt64($2)) AND ts < fromUnixTimestamp64Milli(toInt64($3)) ORDER BY rule_id, ts FORMAT TSV"
}
require_floor() { # 판정 하한을 EVAL_FLOOR에 — 핫픽스 전 코드로 load한 상태(kv 없음)는 이어 쓰지 않는다(검수 r-exp33b 조건)
  EVAL_FLOOR=$(kv_get evalFloorMs)
  [ -n "$EVAL_FLOOR" ] || { echo "evalFloorMs 없음 — 핫픽스 전 load 상태다 · 이 반복은 reset · start부터" >&2; exit 1; }
}
judged_rules() { # $1=규칙 목록 — 이 반복 규칙 중 판정된 수(판정 하한 evalFloorMs = POST 시작 − 60초 뒤 행만 — 스냅샷에 남은 옛 행을 세지 않는다)
  chq "SELECT uniqExact(rule_id) FROM plc.alarm_eval WHERE rule_id IN ($1) AND ts >= fromUnixTimestamp64Milli(toInt64($EVAL_FLOOR))"
}
# ch:alarm 구독(포그라운드 자식 · 호출 안에서 거둔다) — 줄 = 수신 epoch ms + 프레임 JSON. 컨테이너 안 redis-cli는 timeout으로 스스로 끝난다
SUB_PID=''
sub_start() { # $1=출력 $2=상한 초
  [ -n "$RURL" ] || RURL=$(redis_url)
  REDIS_URL=$RURL docker exec -e REDIS_URL "$RD_NAME" sh -c "$RC_PRE"'exec timeout '"$2"' redis-cli --no-auth-warning $CONN SUBSCRIBE ch:alarm' 2>"$1.err" \
    | python3 "$A33/_alarm.py" stamp > "$1" &
  SUB_PID=$!
  sleep 1
}
sub_stop() {
  # 컨테이너 안 구독 프로세스를 먼저 끝낸다(docker exec 클라이언트만 죽이면 안쪽이 남는다) — api · worker의 구독은 node라 이 패턴에 걸리지 않는다
  docker exec "$RD_NAME" pkill -f 'redis-cli.*SUBSCRIBE ch:alarm' >/dev/null 2>&1 || true
  if [ -n "$SUB_PID" ]; then wait "$SUB_PID" 2>/dev/null || true; SUB_PID=''; fi
}
# alarm_eval 보류가 남으면 되돌린다 — 호출이 어떻게 끝나든(_s5_cleanup 뒤에 붙인다)
ch_restore() {
  if [ "$(chq "SELECT count() FROM system.tables WHERE database = 'plc' AND name = '$HOLD_TABLE'" 2>/dev/null || echo 0)" = 1 ]; then
    chq "RENAME TABLE plc.$HOLD_TABLE TO plc.alarm_eval" >/dev/null && echo "alarm_eval 보류를 되돌렸다" >&2
  fi
}
_exp33_cleanup() {
  sub_stop
  # errexit 아래 트랩 — 줄마다 || true(앞 줄 실패가 뒤 정리를 건너뛰지 않게)
  if [ "${CH_HELD:-0}" = 1 ]; then ch_restore || true; fi
  if [ "${PG_STOPPED:-0}" = 1 ]; then docker start "$PG_NAME" >/dev/null 2>&1 || true; fi
  if [ -n "${ACK_MARK:-}" ]; then pkill -f "exp33-ack-marker=$ACK_MARK" 2>/dev/null || true; fi
  if [ "${WEB_OURS:-0}" = 1 ]; then web_stop || true; fi
  _s5_cleanup || true
}
trap _exp33_cleanup EXIT
trap '_exp33_cleanup; exit 130' INT TERM
web_stop() { local p; p=$(lsof -tiTCP:13001 -sTCP:LISTEN 2>/dev/null || true); [ -z "$p" ] || kill $p 2>/dev/null || true; }
sw_of() { python3 -c 'import json,sys; s=(json.load(open(sys.argv[1])).get("switches") or {}).get(sys.argv[2]); print(s.get("value") if isinstance(s, dict) else s)' "$1" "$2" 2>/dev/null || true; }
pg_ready() { docker exec -u postgres "$PG_NAME" pg_isready -q -d plc >/dev/null 2>&1; }
wcap() { wdump > "$1.worker"; }

# 모드 B 생성기(호출을 넘어 산다 · SPIKE 프로파일) — _lib dg_bg_start는 --mix mixed 고정이라 여기서 같은 모양으로 띄운다
dg33_start() { # $1=지속 초
  docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
  kv_set dg.launchMs "$(ms_now)"
  CAPACITY_TIER=M $COMPOSE --profile datagen run -d --no-deps --name "$DG_NAME" datagen \
    node dist/mode-b.js --tier M --mix "$(py_param mix)" --seed "$(py_param seed)" --duration "$1" --pps "$(py_param pps)" >/dev/null
  kv_set dg.durationS "$1"
}
# 이어지는 하위 명령의 머리 — 앞 호출이 비정상으로 끝나 남긴 주입(alarm_eval 보류 · PostgreSQL 정지)을 먼저 되돌린다
exp33_resume() { # $1=반복
  rep_resume "$EXP" "$1" "$ARM"
  ch_restore
  if [ "$(docker inspect -f '{{.State.Running}}' "$PG_NAME" 2>/dev/null || true)" != true ]; then
    echo "경고: PostgreSQL이 멈춰 있었다 — 기동한다(앞 호출의 fault-pg가 비정상 종료)" >&2
    docker start "$PG_NAME" >/dev/null
    for _ in $(seq 1 60); do pg_ready && break; sleep 1; done
    pg_ready || { echo "PostgreSQL 60초 안에 준비되지 않았다" >&2; exit 1; }
    kv_append pgRestartedByResume "$(ms_now)"
  fi
}
py_param() { python3 -c 'import json,sys; print(json.loads(open(sys.argv[1]).read())[sys.argv[2]])' "$ST/kv/params" "$1"; }

case "$CMD" in
start)
  REP=${2:?반복 번호}
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  if [ -d "$ST/kv" ] && [ "$(cat "$ST/kv/open" 2>/dev/null || true)" = 1 ]; then echo "열린 반복이 있다 — stop 또는 reset 먼저" >&2; exit 1; fi
  PLAN=${INGEST_BATCH_PLAN:-A}
  [ "$PLAN" = A ] || { echo "EXP-33은 배치 안 A(현행 기본 · 플러시 주기 1초)만 — INGEST_BATCH_PLAN을 지운다" >&2; exit 1; }
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M INGEST_BATCH_PLAN=A
  env_save
  # 계획 조정값 — 환경변수로 바꿀 수 있고 kv에 고정한다(반복끼리 같아야 table이 기록을 만든다)
  python3 - "$ST/kv/params" <<'PY'
import json, os, sys
sys.path.insert(0, 'scripts/lab/s5/alarm')
import _alarm
p = dict(_alarm.DEFAULTS)
for k, v in list(p.items()):
    e = os.environ.get('EXP33_' + k)
    if e is not None:
        p[k] = type(v)(e) if not isinstance(v, str) else e
p.update({'winS': int(os.environ.get('EXP33_winS', 300)), 'ackTrials': int(os.environ.get('EXP33_ackTrials', 3)),
          'ackTimeoutS': int(os.environ.get('EXP33_ackTimeoutS', 90))})
open(sys.argv[1], 'w').write(json.dumps(p))
PY
  kv_set open 1
  echo "── $EXP rep $REP · 복원 $SNAP_EXP33 · 기준선 ${BASE_S}초 · 계획 $(cat "$ST/kv/params")"
  rep_head "$SNAP_EXP33" b
  docker exec "$WK_NAME" wget -qO- http://127.0.0.1:3000/api/v1/health > "$ST/health-worker.json" 2>/dev/null || true
  # 전제 — SW-06 on(ch:alarm 구독으로 발행을 관찰한다) · 규칙 0(시드 금지 판정) · 상태 키 0 · 확인 행위자 환경변수(값은 학습자 계정 — 비밀 아님)
  for f in "$ST/health.json" "$ST/health-worker.json"; do
    if [ "$(sw_of "$f" SW-06)" != on ]; then echo "SW-06이 on이 아니다($f) — ch:alarm 발행을 관찰할 수 없다" >&2; stack_down; kv_set open 0; exit 1; fi
  done
  RB=$(pgq "SELECT count(*) FROM alarm_rule"); printf '%s' "$RB" > "$ST/rules-before"
  KB=$(state_keys)
  EB=$(pgq "SELECT count(*) FROM alarm_event")
  # 기준선 계수 — 마감 대조는 차로 한다(감사 행 · 판정 전수 행 · 이벤트)
  #   (대상 rule_id의 옛 alarm_eval 행은 규칙 ID가 정해지는 load가 센다 — kv preexistingEvalRows)
  printf '{"auditRuleInserts": %s, "alarmEvents": %s}\n' \
    "$(pgq "SELECT count(*) FROM audit_log WHERE target_table = 'alarm_rule' AND action = 'INSERT'")" "$EB" > "$ST/baseline-counts.json"
  ACTOR=$(docker exec "$API_NAME" printenv ALARM_ACK_ACTOR_EMAIL 2>/dev/null || true)
  kv_set ackActor "$ACTOR"
  if [ "$RB" != 0 ] || [ "$KB" != 0 ] || [ "$EB" != 0 ]; then
    echo "스냅샷이 빈 알람 상태가 아니다 — 규칙 $RB · 상태 키 $KB · 이벤트 $EB(규칙은 시드하지 않는다 · 06_pipeline/08 §규칙 시드)" >&2
    stack_down; kv_set open 0; exit 1
  fi
  if [ "$ACTOR" != learner@localhost ]; then echo "경고: api ALARM_ACK_ACTOR_EMAIL이 learner@localhost가 아니다('$ACTOR') — ack가 401로 끝난다" >&2; fi
  echo "── 기동 완료 — 규칙 0 · 상태 키 0 · 이벤트 0 · SW-06 on · load <반복>으로 부하와 규칙을 건다"
  ;;
load)
  REP=${2:?반복 번호}
  DUR=${3:-1500}
  exp33_resume "$REP"
  [ "$(kv_get open)" = 1 ] || { echo "열린 반복이 없다 — start 먼저" >&2; exit 1; }
  [ ! -f "$ST/rules.json" ] || { echo "이미 규칙을 걸었다 — 새 반복은 reset · start부터" >&2; exit 1; }
  echo "── $EXP rep $REP 모드 B($(py_param mix) · $(py_param pps) pps · ${DUR}초 — 호출을 넘어 산다)"
  dg33_start "$DUR"
  # 적재가 도는지 — worker rows_inserted 증가
  for _ in $(seq 1 30); do
    r=$(wdump | awk '$1=="rows_inserted"{print $2; exit}')
    [ -n "$r" ] && python3 -c "import sys; sys.exit(0 if float('$r') > 0 else 1)" && break
    sleep 1
  done
  # 규칙 계획 — 태그 집합(활성 · M 시드) → SPIKE 기저 → 2계층 + 탐침
  pgq "SELECT t.tag_id FROM tag_master t JOIN device d ON d.device_id = t.device_id WHERE t.is_active AND d.is_active ORDER BY t.tag_id" > "$ST/tags.txt"
  python3 "$A33/_alarm.py" plan "$ST/tags.txt" "$ST/plan.json" "$(cat "$ST/kv/params")"
  sleep 20
  # 생성식 대조 — 생성기는 결정적이다: 최근 30초 계획 태그의 행마다 복제값(_alarm.spike_value · k = floor(ts ÷ 1000))과 |차| ≤ 1e-6
  #   어긋나면 임계가 분포 밖에 놓인다 — 생성기를 멈추고 끝낸다(규칙을 걸지 않는다)
  TAGS=$(python3 -c 'import json,sys; print(",".join(str(r["tagId"]) for r in json.load(open(sys.argv[1]))))' "$ST/plan.json")
  chq "SELECT tag_id, toUnixTimestamp64Milli(ts), value FROM plc.tag_raw WHERE tag_id IN ($TAGS) AND ts >= now64(3) - INTERVAL 30 SECOND ORDER BY tag_id, ts FORMAT TSV" > "$ST/plan-rows.tsv"
  if ! python3 "$A33/_alarm.py" check-plan "$ST/plan.json" "$ST/plan-rows.tsv" "$(py_param seed)" > "$ST/plan-check.json"; then
    echo "생성식 대조 실패 — $(head -c 800 "$ST/plan-check.json") · 생성기를 멈춘다" >&2
    docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
    kv_set dg.stoppedByPlanCheck "$(ms_now)"
    exit 1
  fi
  # 규칙은 쓰기 표면으로만(POST · 감사 · 무효화 체인 ②) — 탐침(P)은 fault-pg가 건다
  python3 - "$ST/plan.json" > "$ST/rules.req" <<'PY'
import json, sys
for r in json.load(open(sys.argv[1])):
    if r['tier'] != 'P':
        print(r['tier'], json.dumps({k: r[k] for k in ('tagId', 'conditionType', 'threshold', 'debounceMs', 'severity')}))
PY
  : > "$ST/rules.resp"
  kv_set rulesPostStartMs "$(ms_now)"
  # 판정 셈 하한 — alarm_eval.ts는 판정한 배치의 데이터 시각이라 POST 직후 첫 판정 행이 POST 시각보다 앞선다(rep 1 실측 −663 ms)
  #   스냅샷에 남은 옛 행은 복원 전 과거(일 단위)라 60초 여유를 둬도 섞이지 않는다
  kv_set evalFloorMs "$(( $(kv_get rulesPostStartMs) - 60000 ))"
  while read -r tier body; do
    resp=$(apiq -w '\n%{http_code}' -X POST "$API/api/v1/alarms/rules" -d "$body")
    code=$(printf '%s' "$resp" | tail -1)
    [ "$code" = 201 ] || { echo "규칙 POST $code — $(printf '%s' "$resp" | head -1)" >&2; exit 1; }
    printf '%s %s %s\n' "$tier" "$(ms_now)" "$(printf '%s' "$resp" | head -1)" >> "$ST/rules.resp"
  done < "$ST/rules.req"
  python3 - "$ST/plan.json" "$ST/rules.resp" "$ST/rules.json" <<'PY'
import json, sys
plan = {r['tagId']: r for r in json.load(open(sys.argv[1]))}
out = []
for ln in open(sys.argv[2]):
    tier, ms, body = ln.split(' ', 2)
    o = json.loads(body)
    out.append({**plan[o['tagId']], 'ruleId': o['ruleId'], 'createdMs': int(ms)})
json.dump(out, open(sys.argv[3], 'w'))
PY
  N=$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$ST/rules.json")
  require_floor
  # 대상 rule_id의 판정 하한 전 alarm_eval 행 — 0이 아니면 경고(원시에 남고 판정 셈은 하한 뒤 행만 읽는다)
  PRE=$(chq "SELECT count() FROM plc.alarm_eval WHERE rule_id IN ($(rule_ids | tr ' ' ,)) AND ts < fromUnixTimestamp64Milli(toInt64($EVAL_FLOOR))")
  kv_set preexistingEvalRows "$PRE"
  [ "$PRE" = 0 ] || echo "경고: 대상 rule_id의 판정 하한(POST − 60초) 전 alarm_eval 행 ${PRE}개 — 셈에서 뺀다" >&2
  kv_set rulesCreatedMs "$(ms_now)"
  # 판정 시작 — 상태 키 수 = 규칙 수(판정된 규칙마다 1)까지 · 상한 60초
  K=0
  for _ in $(seq 1 60); do K=$(state_keys); [ "$K" -ge "$N" ] && break; sleep 1; done
  # 하한 여유의 실측 근거 — 대상 규칙 첫 판정 행 ts − POST 시작(음수면 POST 앞 데이터 시각 · rep 1 실측 −663 ms)
  kv_set evalLeadMs "$(chq "SELECT toInt64(minOrNull(toUnixTimestamp64Milli(ts))) - $(kv_get rulesPostStartMs) FROM plc.alarm_eval WHERE rule_id IN ($(rule_ids | tr ' ' ,)) AND ts >= fromUnixTimestamp64Milli(toInt64($EVAL_FLOOR))")"
  echo "── 규칙 ${N}개 POST · 상태 키 $K · 예열 ${WARM_S:-60}초"
  sleep "${WARM_S:-60}"
  echo "── 예열 끝 — window <반복>"
  ;;
window)
  REP=${2:?반복 번호}
  exp33_resume "$REP"
  [ -f "$ST/rules.json" ] || { echo "규칙이 없다 — load 먼저" >&2; exit 1; }
  require_floor
  WIN=${3:-$(py_param winS)}
  SD="$ST/window"; rm -rf "$SD"; mkdir -p "$SD"
  meta_set winS "$WIN"
  meta_set winStartMs "$(ms_now)"; snap_all "$SD/m0"
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  meta_set winEndMs "$(ms_now)"; snap_all "$SD/m1"
  state_keys > "$SD/keys"
  states_dump "$SD/states" $(rule_ids)
  # ⑧ 전수는 판정 뒤 비동기(깊이 1 큐) — 창 끝 행이 들어오도록 잠깐 기다린 뒤 창 ts 범위로 읽는다 · 위반 시작점을 보려고 60초 앞당겨 뽑는다
  sleep 8
  W0=$(meta_get winStartMs "$SD"); W1=$(meta_get winEndMs "$SD")
  IDS=$(rule_ids | tr ' ' ,)
  P0=$EVAL_FLOOR
  E0=$(( W0 - 60000 )); [ "$E0" -ge "$P0" ] || E0=$P0
  eval_tsv "$IDS" "$E0" "$W1" > "$SD/eval.tsv"
  judged_rules "$IDS" > "$SD/judged-rules"
  events_csv "$IDS" > "$SD/events.csv"
  python3 "$A33/_alarm.py" warm-print "$ST"
  ;;
ack)
  REP=${2:?반복 번호}
  exp33_resume "$REP"
  [ -f "$ST/rules.json" ] || { echo "규칙이 없다 — load 먼저" >&2; exit 1; }
  [ -e "$PW_CORE/package.json" ] || { echo "playwright-core 없음: $PW_CORE" >&2; exit 1; }
  [ -x "$CHROME" ] || { echo "브라우저 없음: $CHROME" >&2; exit 1; }
  SD="$ST/ack"; rm -rf "$SD"; mkdir -p "$SD"
  meta_set webBuild "$(cat apps/web/.next/BUILD_ID 2>/dev/null || echo none)"
  meta_set webDirty "$([ -n "$(git status --porcelain -- apps/web)" ] && echo true || echo false)"
  kv_set webBuild "$(cat apps/web/.next/BUILD_ID 2>/dev/null || echo none)"
  WEB_OURS=0
  if [ -z "$(lsof -tiTCP:13001 -sTCP:LISTEN 2>/dev/null || true)" ]; then
    [ -f apps/web/.next/BUILD_ID ] || { echo "web 빌드가 없다(apps/web/.next) — 리드가 빌드한다" >&2; exit 1; }
    WEB_LOG="$(pwd)/$SD/web.log"
    (cd apps/web && exec pnpm start > "$WEB_LOG" 2>&1) &
    WEB_OURS=1
    for _ in $(seq 1 30); do curl -sf -o /dev/null http://localhost:13001/alarms && break; sleep 1; done
    curl -sf -o /dev/null http://localhost:13001/alarms || { echo "web 기동 30초 초과" >&2; exit 1; }
  fi
  meta_set webStartedByRunner "$WEB_OURS"
  adump > "$SD/m0.api"
  ACK_MARK="exp33-$REP-$$"
  TRIALS=$(py_param ackTrials); TO=$(py_param ackTimeoutS)
  LIMIT=$(( TRIALS * (TO + 25) + 60 ))
  [ "$LIMIT" -le 420 ] || LIMIT=420
  echo "── $EXP rep $REP ACK 두 브라우저 — 시도 $TRIALS · 시도당 대기 상한 ${TO}초 · 전체 상한 ${LIMIT}초"
  PW_CORE=$PW_CORE CHROME=$CHROME ACK_MARK=$ACK_MARK RULES=$(rule_ids B | tr ' ' ,) TRIALS=$TRIALS TIMEOUT_S=$TO LIMIT_S=$LIMIT \
    node "$A33/ack-two-browsers.cjs" "$SD/ack.json" > "$SD/node.log" 2>&1 &
  NODE_PID=$!
  # 감시 — 상한 + 20초 안에 끝나지 않으면 죽이고 표지 인자로 브라우저를 거둔다(종료가 멈춘 사례)
  for _ in $(seq 1 $(( LIMIT + 20 ))); do kill -0 "$NODE_PID" 2>/dev/null || break; sleep 1; done
  kill -9 "$NODE_PID" 2>/dev/null || true
  wait "$NODE_PID" 2>/dev/null || true
  pkill -f "exp33-ack-marker=$ACK_MARK" 2>/dev/null || true
  adump > "$SD/m1.api"
  [ "$WEB_OURS" = 1 ] && web_stop && WEB_OURS=0
  python3 - "$ST" <<'PY'
import json, sys
sys.path.insert(0, 'scripts/lab/s5/alarm')
import _alarm
v = _alarm.ack_view(sys.argv[1]) or {}
print(json.dumps({k: v.get(k) for k in ('accepted', 'rejected', 'displayed', 'delayMedianMs', 'delayMaxMs', 'selfMedianMs', 'framesB', 'listFetchesB', 'acksMetric', 'error')}, ensure_ascii=False))
for t in v.get('trials') or []:
    print(json.dumps({k: t.get(k) for k in ('eventId', 'status', 'delayMs', 'boundMs', 'withinBound', 'reason')}, ensure_ascii=False))
PY
  ;;
fault-pg)
  REP=${2:?반복 번호}
  STOP_S=${3:-60}
  exp33_resume "$REP"
  [ -f "$ST/rules.json" ] || { echo "규칙이 없다 — load 먼저" >&2; exit 1; }
  if python3 -c 'import json,sys; sys.exit(0 if any(r["tier"]=="P" for r in json.load(open(sys.argv[1]))) else 1)' "$ST/rules.json"; then
    echo "탐침 규칙이 이미 있다 — 이 반복의 fault-pg는 끝났다" >&2; exit 1
  fi
  SD="$ST/fault-pg"; rm -rf "$SD"; mkdir -p "$SD"
  meta_set stopS "$STOP_S"
  sub_start "$SD/frames" $(( STOP_S + 200 ))
  wcap "$SD/m0"
  # 탐침(P) — 상시 위반 · 디바운스 30초: 판정이 시작돼 PENDING이 된 뒤(규칙 캐시가 채워진 뒤) 정지하면 확정 시점이 정지 중에 온다
  BODY=$(python3 -c 'import json,sys; r=[x for x in json.load(open(sys.argv[1])) if x["tier"]=="P"][0]; print(json.dumps({k: r[k] for k in ("tagId","conditionType","threshold","debounceMs","severity")}))' "$ST/plan.json")
  meta_set createMs "$(ms_now)"
  resp=$(apiq -w '\n%{http_code}' -X POST "$API/api/v1/alarms/rules" -d "$BODY")
  [ "$(printf '%s' "$resp" | tail -1)" = 201 ] || { echo "탐침 규칙 POST 실패 — $resp" >&2; exit 1; }
  PID_RULE=$(printf '%s' "$resp" | head -1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["ruleId"])')
  meta_set probeRuleId "$PID_RULE"
  python3 - "$ST/plan.json" "$ST/rules.json" "$PID_RULE" "$(meta_get createMs "$SD")" <<'PY'
import json, sys
plan = [x for x in json.load(open(sys.argv[1])) if x['tier'] == 'P'][0]
rules = json.load(open(sys.argv[2]))
rules.append({**plan, 'ruleId': int(sys.argv[3]), 'createdMs': int(sys.argv[4])})
json.dump(rules, open(sys.argv[2], 'w'))
PY
  ok=0
  for _ in $(seq 1 20); do
    [ "$(rcli HGET "alarm:state:$PID_RULE" state 2>/dev/null)" = PENDING ] && { ok=1; break; }
    sleep 1
  done
  [ "$ok" = 1 ] || { echo "탐침이 20초 안에 PENDING이 되지 않았다" >&2; exit 1; }
  meta_set pendingMs "$(ms_now)"
  states_dump "$SD/probe-state" "$PID_RULE"
  meta_set cacheTtlS "$(rcli TTL cache:alarmrules)"
  # 규칙 캐시가 정지 중에 만료되면 규칙 조회가 PostgreSQL로 가 배치 자체를 판정하지 않는다 — 탐침의 확정 시도가 없어 다른 경로를 잰다
  if [ "$(meta_get cacheTtlS "$SD")" -lt $(( STOP_S + 30 )) ]; then echo "규칙 캐시 TTL $(meta_get cacheTtlS "$SD")초 < 정지 ${STOP_S}초 + 30 — 정지를 줄인다" >&2; exit 1; fi
  echo "── $EXP rep $REP PostgreSQL 정지 ${STOP_S}초(탐침 규칙 $PID_RULE PENDING · 규칙 캐시 TTL $(meta_get cacheTtlS "$SD")초)"
  meta_set stopMs "$(ms_now)"
  PG_STOPPED=1
  docker stop -t 30 "$PG_NAME" >/dev/null
  meta_set stoppedMs "$(ms_now)"
  sleep "$STOP_S"
  wcap "$SD/mstop"
  meta_set startMs "$(ms_now)"
  docker start "$PG_NAME" >/dev/null
  for _ in $(seq 1 60); do pg_ready && break; sleep 1; done
  pg_ready || { echo "PostgreSQL 60초 안에 준비되지 않았다" >&2; exit 1; }
  PG_STOPPED=0
  meta_set readyMs "$(ms_now)"
  # 복구 뒤 확정 1 — 탐침 이벤트가 나타날 때까지(상한 60초) · 그 뒤 발행 프레임을 받을 여유 5초
  for _ in $(seq 1 60); do
    n=$(pgq "SELECT count(*) FROM alarm_event WHERE rule_id = $PID_RULE" 2>/dev/null || echo 0)
    [ "$n" -ge 1 ] && { meta_set confirmMs "$(ms_now)"; break; }
    sleep 1
  done
  sleep 5
  meta_set endMs "$(ms_now)"
  wcap "$SD/m1"
  sub_stop
  events_csv "$PID_RULE" > "$SD/probe-events.csv"
  meta_set workerRunning "$(docker inspect -f '{{.State.Running}}' "$WK_NAME" 2>/dev/null || echo false)"
  python3 - "$ST" <<'PY'
import json, sys
sys.path.insert(0, 'scripts/lab/s5/alarm')
import _alarm
v = _alarm.faultpg_view(sys.argv[1], _alarm.load_rules(sys.argv[1])) or {}
print(json.dumps({k: v.get(k) for k in ('holds', 'probeRuleId', 'dueInsideOutage', 'pendingBeforeStop', 'probeEvents', 'probeOccurredAfterStop',
                  'framesDuringStop', 'probeOpenedFramesAfter', 'pgWriteFailuresDuringStop', 'confirmAfterReadyMs', 'workerRunning', 'restartDetected')}, ensure_ascii=False))
PY
  ;;
fault-ch)
  REP=${2:?반복 번호}
  HOLD_S=${3:-60}
  REC_S=${4:-45}
  exp33_resume "$REP"
  [ -f "$ST/rules.json" ] || { echo "규칙이 없다 — load 먼저" >&2; exit 1; }
  [ "$(chq "SELECT count() FROM system.tables WHERE database = 'plc' AND name = '$HOLD_TABLE'")" = 0 ] || { echo "plc.${HOLD_TABLE}이 이미 있다 — 앞 호출의 보류가 남았다(ch_restore 대상)" >&2; exit 1; }
  SD="$ST/fault-ch"; rm -rf "$SD"; mkdir -p "$SD"
  meta_set mode rename; meta_set holdS "$HOLD_S"; meta_set recoverS "$REC_S"
  sub_start "$SD/frames" $(( HOLD_S + REC_S + 60 ))
  wcap "$SD/m0"
  # alarm_eval 삽입 강제 실패 — 테이블 이름을 잠시 옮겨 판정 전수 INSERT만 실패시킨다(tag_raw · 알람 확정은 그대로 · 볼륨 · 행 무손)
  echo "── $EXP rep $REP alarm_eval 보류 ${HOLD_S}초(RENAME) · 회복 관찰 ${REC_S}초"
  meta_set holdMs "$(ms_now)"
  CH_HELD=1
  chq "RENAME TABLE plc.alarm_eval TO plc.$HOLD_TABLE"
  sleep "$HOLD_S"
  wcap "$SD/mmid"
  chq "RENAME TABLE plc.$HOLD_TABLE TO plc.alarm_eval"
  CH_HELD=0
  meta_set releaseMs "$(ms_now)"
  meta_set restored "$([ "$(chq "SELECT count() FROM system.tables WHERE database = 'plc' AND name = 'alarm_eval'")" = 1 ] && echo 1 || echo 0)"
  sleep "$REC_S"
  meta_set endMs "$(ms_now)"
  wcap "$SD/m1"
  sub_stop
  H0=$(meta_get holdMs "$SD"); H1=$(meta_get releaseMs "$SD")
  IDS=$(rule_ids | tr ' ' ,)
  meta_set pgOpenedInHold "$(pgq "SELECT count(*) FROM alarm_event WHERE rule_id IN ($IDS) AND occurred_at >= to_timestamp($H0 / 1000.0) AND occurred_at < to_timestamp($H1 / 1000.0)")"
  meta_set pgClosedInHold "$(pgq "SELECT count(*) FROM alarm_event WHERE rule_id IN ($IDS) AND cleared_at >= to_timestamp($H0 / 1000.0) AND cleared_at < to_timestamp($H1 / 1000.0)")"
  # 무효 구간 구조화 로그(alarm_eval_gap) — 계수와 1:1이어야 한다(02_instrumentation §구간 기록)
  docker logs --since "$(python3 -c 'import sys,datetime; print(datetime.datetime.fromtimestamp(int(sys.argv[1])/1000 - 2, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))' "$H0")" "$WK_NAME" 2>&1 \
    | grep alarm_eval_gap > "$SD/gap.log" || true
  python3 - "$ST" <<'PY'
import json, sys
sys.path.insert(0, 'scripts/lab/s5/alarm')
import _alarm
v = _alarm.faultch_view(sys.argv[1]) or {}
h = v.get('metricsHold') or {}
a = v.get('metricsAll') or {}
print(json.dumps({'holds': v.get('holds'), 'restored': v.get('restored'), 'gapLog': v.get('gapLog'), 'gapBatches': a.get('gapBatches'),
                  'gapRows': a.get('gapRows'), 'opened': h.get('opened'), 'closed': h.get('closed'), 'frames': v.get('framesDuringHold'),
                  'dlq': h.get('dlq'), 'rowsInserted': h.get('rowsInserted'), 'evalRowsAfter': (v.get('metricsAfter') or {}).get('evalRowsInserted')}, ensure_ascii=False))
PY
  ;;
stop)
  REP=${2:?반복 번호}
  CAP=${3:-180}
  exp33_resume "$REP"
  [ "$(kv_get open)" = 1 ] || { echo "열린 반복이 없다" >&2; exit 1; }
  ch_restore
  # ⑥ 생성기 종료 — 지속으로 스스로 끝난다(모드 B는 신호로 결과 줄을 남기지 않는다) · 상한을 넘기면 1(다시 부른다)
  t0=$(date +%s)
  while [ "$(docker inspect -f '{{.State.Running}}' "$DG_NAME" 2>/dev/null || true)" = true ]; do
    if [ $(( $(date +%s) - t0 )) -ge "$CAP" ]; then echo "생성기가 아직 돈다(상한 ${CAP}초) — stop을 다시 부른다" >&2; exit 1; fi
    sleep 2
  done
  if [ ! -s "$ST/modeb.json" ]; then
    docker logs "$DG_NAME" 2>/dev/null | grep '^{' | tail -1 > "$ST/modeb.json" || true
    docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
  fi
  S=$(drain_wait 120)
  kv_set drainS "$S"
  sleep 8
  require_floor
  SD="$ST/final"; rm -rf "$SD"; mkdir -p "$SD"
  IDS=$(rule_ids | tr ' ' ,)
  state_keys > "$SD/keys"
  states_dump "$SD/states" $(rule_ids)
  judged_rules "$IDS" > "$SD/judged-rules"
  events_csv "$IDS" > "$SD/events.csv"
  C0=$EVAL_FLOOR
  eval_tsv "$IDS" "$C0" "$(( $(ms_now) + 60000 ))" > "$SD/eval.tsv"
  pgq "SELECT count(*) FROM audit_log WHERE target_table = 'alarm_rule' AND action = 'INSERT'" > "$SD/audit-rule-inserts"
  docker logs "$WK_NAME" 2>&1 | grep alarm_eval_gap > "$SD/gap.log" || true
  wcap "$SD/m-end"
  stats_once > "$ST/load-end"
  stack_down
  kv_set open 0
  echo "── 정지 · 소진 ${S}초 · 상태 키 $(cat "$SD/keys") · 판정된 규칙 $(cat "$SD/judged-rules") · 이벤트 $(grep -c . "$SD/events.csv" || true) · 감사 규칙 INSERT $(cat "$SD/audit-rule-inserts")"
  ;;
collect)
  REP=${2:?반복 번호}
  OUT=${3:?출력 jsonl}
  exp33_resume "$REP"
  [ "$(kv_get open)" != 1 ] || { echo "열린 반복이 있다 — stop 먼저" >&2; exit 1; }
  python3 "$A33/_alarm.py" rec "$ST" "$OUT"
  ;;
table)
  IN=${2:?원시 jsonl}
  OUT=${3:?출력 jsonl}
  python3 "$A33/_alarm.py" table "$IN" "$OUT"
  ;;
reset)
  REP=${2:?반복 번호}
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  rm -rf "$ST"; echo "삭제: $ST"
  ;;
*) echo "하위 명령: start|load|window|ack|fault-pg|fault-ch|stop|collect|table|reset" >&2; exit 1 ;;
esac
