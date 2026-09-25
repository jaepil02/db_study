#!/usr/bin/env bash
# 모드 B 수집 + k6 조회 러너 — EXP-22 Baseline(exp22) · EXP-38 관측 간섭(exp38 · 팔 off|on) · EXP-07 SW-02 M 재측정(exp07 · 팔 on|off)
# 구성: api(APP_ROLE api — 조회 · OBS 저장소 수집) + worker(적재) + datagen 컨테이너(모드 B M 10,000 pps · 호출을 넘어 산다 · 고정 지속)
# 판정 창(05_load_scenarios §판정 창): 부하 도달 뒤 정상 상태 구간만 — 워밍업(load)과 종료 전이(stop)를 뺀다.
# 창이 10분을 넘는 실험(Baseline 10분)은 window를 여러 번 부른다 — 조회 정확 분위수는 창들의 k6 원시를 합쳐 낸다(_rec.py).
#   exp22  창 2 × 300초 · k6-mix(최신값 20 · 시계열 5 · 마스터 1 /s)
#   exp38  창 1 × 180초 · k6-mix · 팔 on이면 기준선 뒤 관측 프로파일(prometheus · grafana) 기동 — 관측 조건만 바꾼다
#   exp07  창 1 × 60초 · k6-latest(도착률 100/s · 설비 1 고정 — S2와 같은 요청 모양) · 팔 = SW-02(REDIS_LATEST_CACHE)
# 사용:
#   modeb-mix.sh start   <exp22|exp38|exp07> <반복> <팔 — exp22: base · exp38: off|on · exp07: on|off>   ~6.5분
#   modeb-mix.sh load    <exp> <반복> <팔> [워밍업 초=60]                  생성기 기동(창 수 × 창 + 워밍업 + 여유 SLACK=180초) · 워밍업 표본 ~1.3분
#   modeb-mix.sh window  <exp> <반복> <팔>                                 판정 창 하나(창 초는 실험 기본 · WIN으로 덮어쓰기)
#   modeb-mix.sh stop    <exp> <반복> <팔>                                 생성기 종료 대기 → 소진 → E2E · 무손실 판독 → 정지
#   modeb-mix.sh collect <exp> <반복> <팔> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|load|window|stop|collect}
EXP=${2:?exp22|exp38|exp07}
REP=${3:?반복}
ARM=${4:?팔}
case "$EXP" in
  exp22) NWIN=2; DEF_WIN=300; SCRIPT=k6-mix.js ;;
  exp38) NWIN=1; DEF_WIN=180; SCRIPT=k6-mix.js ;;
  exp07) NWIN=1; DEF_WIN=60; SCRIPT=k6-latest.js ;;
  *) echo "exp22 · exp38 · exp07" >&2; exit 1 ;;
esac
WIN=${WIN:-$DEF_WIN}
K6_ARGS=(-e RATE_LATEST="${RATE_LATEST:-20}" -e RATE_TS="${RATE_TS:-5}" -e RATE_MASTER="${RATE_MASTER:-1}")
[ "$EXP" != exp07 ] || K6_ARGS=(-e RATE="${RATE:-100}" -e DEVICE="${DEVICE:-1}" -e ROTATE="${ROTATE:-0}")

redis_info_json() { # INFO stats · memory · commandstats 일부 → JSON(관측 명령 비율 판독용)
  docker exec db_study-redis-1 redis-cli INFO all 2>/dev/null | tr -d '\r' | python3 -c '
import json, sys
out = {}
for ln in sys.stdin:
    ln = ln.strip()
    if ":" not in ln or ln.startswith("#"):
        continue
    k, v = ln.split(":", 1)
    if k in ("total_commands_processed", "instantaneous_ops_per_sec", "used_memory", "keyspace_hits", "keyspace_misses"):
        out[k] = float(v)
    elif k.startswith("cmdstat_"):
        out[k] = float(dict(x.split("=") for x in v.split(",")).get("calls", 0))
print(json.dumps(out))'
}

case "$CMD" in
start)
  case "$EXP:$ARM" in exp22:base|exp38:off|exp38:on|exp07:on|exp07:off) ;; *) echo "팔이 실험과 맞지 않는다" >&2; exit 1 ;; esac
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M
  [ "$EXP" != exp07 ] || export REDIS_LATEST_CACHE=$ARM
  env_save
  kv_set k6Script "$SCRIPT"; kv_set k6Rates "${K6_ARGS[*]}"
  echo "── $EXP rep $REP 팔 $ARM · 복원 $SNAP_M · 기준선 ${BASE_S}초"
  rep_head "$SNAP_M" b
  if [ "$EXP" = exp38 ] && [ "$ARM" = on ]; then
    $COMPOSE --profile observability up -d prometheus grafana >/dev/null
    kv_set observability on
    sleep 10
    # Grafana는 관리자 비밀번호(.env)가 비면 기동을 거부한다 — 그 경우 prometheus만 켜진 조건으로 기록된다
    kv_set observabilityMembers "$(docker ps --filter name=db_study-prometheus-1 --filter name=db_study-grafana-1 --format '{{.Names}}' | tr '\n' ' ')"
  else
    $COMPOSE --profile observability stop prometheus grafana >/dev/null 2>&1 || true
    kv_set observability off
  fi
  ;;
load)
  WARM=${5:-60}
  rep_resume "$EXP" "$REP" "$ARM"
  SLACK=${SLACK:-180}
  DUR=$(( WARM + NWIN * WIN + SLACK ))
  kv_set nwin "$NWIN"; kv_set win "$WIN"; kv_set warmS "$WARM"
  echo "── $EXP rep $REP 팔 $ARM · 모드 B M 10,000 pps ${DUR}초(워밍업 ${WARM} + 창 ${NWIN}×${WIN} + 여유 ${SLACK}) — 창을 여유 안에 이어 부른다"
  dg_bg_start main M 10000 "$DUR"
  mkdir -p "$ST/warm"
  sample_run "$WARM" "$ST/warm/samples" "$ST/warm/stats"
  dg_bg_running || { echo "생성기가 워밍업 중 끝났다: $(docker logs "$DG_NAME" 2>&1 | tail -3)" >&2; exit 1; }
  # 조회 경로 워밍업(JIT · 커넥션) 10초 — 판정 창 밖
  k6_start "$SCRIPT" warm/k6 -e DURATION=10s "${K6_ARGS[@]}"
  k6_wait warm
  tail -1 "$ST/warm/samples"
  ;;
window)
  rep_resume "$EXP" "$REP" "$ARM"
  dg_bg_running || { echo "생성기가 돌지 않는다 — load부터(또는 창을 너무 늦게 불렀다)" >&2; exit 1; }
  # 창이 끝나기 전에 생성기가 끝나면 창 끝이 종료 전이를 섞는다 — 남은 부하 시간 ≥ 창 + 20초일 때만 연다
  LEFT=$(( ( $(kv_get dg.main.launchMs) / 1000 + $(kv_get dg.main.durationS) ) - $(date +%s) ))
  [ "$LEFT" -ge $(( WIN + 20 )) ] || { echo "남은 부하 ${LEFT}초 < 창 ${WIN} + 20초 — 이 반복은 창을 더 열 수 없다(SLACK을 늘려 다시)" >&2; exit 1; }
  step_dir_new w
  N=$(basename "$SD" | cut -c1-2)
  meta_set n "$N"; meta_set winS "$WIN"
  snap_all "$SD/m0"; redis_info_json > "$SD/redis0.json"
  chq "SYSTEM FLUSH LOGS" >/dev/null
  meta_set winStartMs "$(ms_now)"
  K6_RAW=1 k6_start "$SCRIPT" "steps/$(basename "$SD")/q" -e DURATION="${WIN}s" "${K6_ARGS[@]}"
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  k6_wait q
  meta_set winEndMs "$(ms_now)"
  snap_all "$SD/m1"; redis_info_json > "$SD/redis1.json"
  chq "SYSTEM FLUSH LOGS" >/dev/null
  T0=$(meta_get winStartMs "$SD"); T1=$(meta_get winEndMs "$SD")
  # ClickHouse 쿼리 로그 — 앱(HTTP 인터페이스) 쿼리 중 system 표를 읽는 쿼리(관측 수집) 비율 · 최신값 점조회 수(EXP-07)
  chq "SELECT toJSONString(tuple(count(), countIf(arrayExists(t -> startsWith(t, 'system.'), tables)), countIf(query LIKE '%argMax(value, ts) AS last_value%')))
         FROM system.query_log WHERE type = 'QueryFinish' AND interface = 2
          AND event_time_microseconds >= fromUnixTimestamp64Milli(toInt64($T0)) AND event_time_microseconds < fromUnixTimestamp64Milli(toInt64($T1))" > "$SD/chq.json"
  python3 -c "import json; print(json.load(open('$SD/chq.json'))[2])" > "$SD/chPointQueries"
  if [ "$(kv_get observability)" = on ]; then
    curl -s --max-time 5 "http://127.0.0.1:9090/api/v1/query" --data-urlencode "query=avg_over_time(scrape_duration_seconds[${WIN}s])" > "$SD/scrape.json" || true
  fi
  python3 - "$SD" <<'PY'
import gzip, json, sys
d = sys.argv[1]
v = []
with gzip.open(f'{d}/q.jsonl.gz', 'rt') as f:
    for ln in f:
        if '"http_req_duration"' in ln and '"Point"' in ln:
            v.append(json.loads(ln)['data']['value'])
v.sort()
q = lambda p: v[min(len(v) - 1, int(p * len(v)))] if v else None
print(json.dumps({'window': d.rsplit('/', 1)[-1], 'requests': len(v), 'p50Ms': q(0.5), 'p95Ms': q(0.95), 'chq': json.load(open(f'{d}/chq.json'))}))
PY
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  dg_bg_collect main 540
  S=$(drain_wait 300)
  kv_set drainS "$S"
  [ "$S" != -1 ] || [ "${FORCE:-0}" = 1 ] || { echo "적체 미소진 — stop을 다시 부르거나 FORCE=1" >&2; exit 1; }
  chq "SYSTEM FLUSH LOGS" >/dev/null
  for sd in "$ST"/steps/*; do
    e2e_json "$(meta_get winStartMs "$sd")" "$(meta_get winEndMs "$sd")" > "$sd/e2e.json"
  done
  rows_between $(( $(kv_get dg.main.launchMs) - 1000 )) "$(kv_get dg.main.exitMs)" > "$ST/rows"
  stats_once > "$ST/load-end"
  stack_down
  if [ "$(kv_get observability)" = on ]; then $COMPOSE --profile observability stop prometheus grafana >/dev/null; fi
  echo "── 정지 · 소진 ${S}초 · 범위 행 $(cat "$ST/rows") · 발행 $(python3 -c "import json; print(json.load(open('$ST/main.modeb'))['result']['publishedPoints'])")"
  ;;
collect)
  OUT=${5:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit mix "$OUT"
  ;;
*) echo "하위 명령: start|load|window|stop|collect" >&2; exit 1 ;;
esac
