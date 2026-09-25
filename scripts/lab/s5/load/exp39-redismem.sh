#!/usr/bin/env bash
# EXP-39 S5 — Redis 메모리 실측 · 엔트리당 바이트(Redis 안 크기 — 노드 · 리스트팩 오버헤드 포함) · 태그 수 비례 확인
# 팔: M(설비당 태그 200 · M 시드 · 10,000 pps) · L(설비당 태그 500 — "태그 500 구성" · L 시드 · 50,000 pps = 초당 시점 1)
#   태그 500 구성 = L 티어 시드 모양(06_backpressure_failure · 06_redis_memory: 엔트리 7 KB는 설비당 태그 500 기준)
# 판정 지표(06_experiment_catalog EXP-39): 엔트리당 바이트 · 계열별 점유(부하 없는 전수 1회) · DLQ 엔트리 크기
#   ① MEMORY USAGE stream:plc:raw SAMPLES 0 ÷ XLEN(Stream 한 키의 전수) ② used_memory 증가 ÷ 추가 엔트리(다른 키가 섞인 상계)
#   ③ 인코딩 페이로드 표본(엔트리 필드 p 길이 · XRANGE 앞 500) ④ 접두별 전수(SCAN + MEMORY USAGE SAMPLES 0 · 부하 정지 뒤 1회)
#   DLQ — UNDECODABLE_EVERY=N이면 모드 B가 정상 N개마다 해독 불가 엔트리를 더 끼운다(EXP-19와 같은 수단) → DLQ 엔트리 MEMORY USAGE
#   표본 추정(redis_prefix_* · OBS-03)은 S6 범위라 이 기록에 없다 — "표본 대 전수"의 표본 쪽은 S6에서 채운다
# 구성: api(APP_ROLE api) + worker + datagen(모드 B) · Stream MAXLEN 200,000(부하 실험) — 지속 × 초당 엔트리가 MAXLEN 아래여야 한다
# 사용:
#   exp39-redismem.sh start   <반복> <M|L>              복원 · 기준선 · 기동 ~6.5분
#   exp39-redismem.sh run     <반복> <팔> [지속 초=60]   발행 → 소진 → 판독 → 정지 ~3분
#   exp39-redismem.sh collect <반복> <팔> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|run|collect}
REP=${2:?반복}
ARM=${3:?M|L}
EXP=exp39
case "$ARM" in
  M) PPS=10000; TPD=200 ;;
  L) PPS=50000; TPD=500 ;;
  *) echo "팔은 M · L" >&2; exit 1 ;;
esac

redis_mem_json() { # used_memory · XLEN · 스트림 MEMORY USAGE 전수
  python3 - "$(docker exec db_study-redis-1 redis-cli INFO memory | tr -d '\r' | awk -F: '$1=="used_memory"{print $2}')" \
    "$(docker exec db_study-redis-1 redis-cli XLEN stream:plc:raw)" \
    "$(docker exec db_study-redis-1 redis-cli MEMORY USAGE stream:plc:raw SAMPLES 0)" <<'PY'
import json, sys
u, x, m = sys.argv[1:4]
f = lambda v: float(v) if v.strip() not in ('', '(nil)') else None
print(json.dumps({'used_memory': f(u), 'xlen': f(x), 'streamUsage': f(m)}))
PY
}
LUA_PAYLOAD="local r=redis.call('XRANGE',KEYS[1],'-','+','COUNT',ARGV[1]) local n,s=0,0 for _,e in ipairs(r) do local f=e[2] for i=1,#f,2 do if f[i]=='p' then s=s+#f[i+1] n=n+1 end end end return {n,s}"
LUA_SCAN="local cur='0' local agg={} local order={} repeat local r=redis.call('SCAN',cur,'COUNT',1000) cur=r[1] for _,k in ipairs(r[2]) do local p=string.match(k,'^([^:]+:[^:]+)') or string.match(k,'^([^:]+)') or k local m=redis.call('MEMORY','USAGE',k,'SAMPLES','0') or 0 if not agg[p] then agg[p]={0,0} table.insert(order,p) end agg[p][1]=agg[p][1]+1 agg[p][2]=agg[p][2]+m end until cur=='0' local out={} for _,p in ipairs(order) do table.insert(out,p) table.insert(out,agg[p][1]) table.insert(out,agg[p][2]) end return out"
lua_json() { # redis-cli 평면 출력 → JSON 배열(숫자는 수로)
  docker exec db_study-redis-1 redis-cli EVAL "$1" "$2" "${@:3}" | python3 -c '
import json, sys
v = [ln.rstrip("\n") for ln in sys.stdin if ln.strip() != ""]
print(json.dumps([int(x) if x.lstrip("-").isdigit() else x for x in v]))'
}

case "$CMD" in
start)
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=$ARM
  env_save
  kv_set tagsPerDevice "$TPD"
  echo "── $EXP rep $REP 팔 $ARM(설비당 태그 $TPD) · 복원 $(snap_for_tier "$ARM") · 기준선 ${BASE_S}초"
  rep_head "$(snap_for_tier "$ARM")" b
  ;;
run)
  DUR=${4:-60}
  rep_resume "$EXP" "$REP" "$ARM"
  UE=${UNDECODABLE_EVERY:-0}
  kv_set undecodableEvery "$UE"
  EPS=$(( PPS / TPD ))
  [ $(( EPS * DUR )) -lt 180000 ] || { echo "지속 × 초당 엔트리가 위험 임계(180,000)를 넘는다" >&2; exit 1; }
  redis_mem_json > "$ST/redis0.json"
  EXTRA=(); [ "$UE" = 0 ] || EXTRA=(--undecodable-every "$UE")
  echo "── $EXP rep $REP 팔 $ARM · 모드 B $PPS pps ${DUR}초(초당 엔트리 $EPS)"
  mkdir -p "$ST/steps"
  dg_start "$ST/main.modeb" "$ARM" "$PPS" "$DUR" "${EXTRA[@]}"
  kv_set dg.main.launchMs "$(kv_get dg.main.modeb.launchMs)"
  sample_run "$DUR" "$ST/samples" "$ST/stats"
  dg_wait "$ST/main.modeb"
  kv_set dg.main.exitMs "$(kv_get dg.main.modeb.exitMs)"
  S=$(drain_wait 180)
  kv_set drainS "$S"
  redis_mem_json > "$ST/redis1.json"
  lua_json "$LUA_PAYLOAD" 1 stream:plc:raw 500 > "$ST/payload.json"
  printf '[%s,%s]\n' "$(docker exec db_study-redis-1 redis-cli XLEN stream:plc:dlq)" \
    "$(docker exec db_study-redis-1 redis-cli MEMORY USAGE stream:plc:dlq SAMPLES 0 | sed 's/^$/0/;s/(nil)/0/')" > "$ST/dlq.json"
  # 부하 없는 전수 1회 — 생성기 정지 · 적체 소진 뒤 · 조회 부하 없음
  lua_json "$LUA_SCAN" 0 > "$ST/scan.json"
  stats_once > "$ST/load-end"
  stack_down
  python3 - "$ST" <<'PY'
import json, sys
d = sys.argv[1]
r0, r1 = json.load(open(f'{d}/redis0.json')), json.load(open(f'{d}/redis1.json'))
p = json.load(open(f'{d}/payload.json'))
print(json.dumps({'xlen': r1['xlen'], 'streamUsage': r1['streamUsage'], 'bytesPerEntry': (r1['streamUsage'] or 0) / r1['xlen'] if r1['xlen'] else None,
                  'usedDeltaPerEntry': (r1['used_memory'] - r0['used_memory']) / (r1['xlen'] - (r0['xlen'] or 0)) if r1['xlen'] else None,
                  'payloadPerEntry': p[1] / p[0] if p and p[0] else None, 'dlq': json.load(open(f'{d}/dlq.json'))}, ensure_ascii=False))
PY
  ;;
collect)
  OUT=${4:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit redismem "$OUT"
  ;;
*) echo "하위 명령: start|run|collect" >&2; exit 1 ;;
esac
