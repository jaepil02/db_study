#!/usr/bin/env bash
# EXP-25 Soak — M 고정 2시간(S5 판정 5 · 2시간 × 3회) · 모드 B + k6 조회 혼합 · 힙 · 활성 파트 · 디스크 증가율 · 랙 추세(기울기로 판독)
# 판정 창(05_load_scenarios): 전 구간 · 첫 워밍업(SOAK_WARM_S=600초)만 뺀다 — 누수는 절대값이 아니라 기울기다.
# Soak는 M+를 넘지 않는다(디스크 포화가 누수 판정보다 먼저 온다).
# 호출을 넘어 사는 컨테이너 넷(전부 고정 지속이거나 stop이 거둔다 — Claude 백그라운드 실행이 아니라 Docker 서비스다 · S5 판정 7):
#   api · worker · datagen(모드 B M 10,000 pps · SOAK_S + 120초) · k6(조회 혼합 · SOAK_S초) · 표본 컨테이너(60초마다 /metrics 두 곳을 볼륨 파일로)
# 리드는 sample을 10분 미만 포그라운드 호출로 반복하며 진행을 본다(호스트 쪽 docker stats · system.parts · 디스크를 함께 남긴다).
# 사용:
#   exp25-soak.sh start   <반복>                    복원 · 기준선 · 기동 ~6.5분
#   exp25-soak.sh load    <반복>                    생성기 · k6 · 표본 컨테이너 기동(즉시 끝남)
#   exp25-soak.sh sample  <반복> [대기 초=0 · ≤540]  대기(포그라운드) 뒤 호스트 표본 1개 + 진행 출력
#   exp25-soak.sh stop    <반복>                    표본 컨테이너 정지 → k6 · 생성기 종료 대기 → 소진 → 무손실 → 정지(생성기가 아직 돌면 1 — 다시 부른다)
#   exp25-soak.sh collect <반복> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|load|sample|stop|collect}
REP=${2:?반복}
EXP=exp25
ARM=soak
SOAK_S=${SOAK_S:-7200}
K6_SOAK=db_study-k6-soak

host_sample() {
  mkdir -p "$ST/host"
  local t; t=$(date +%s)
  python3 - "$t" "$(stats_once | tr '\n' '|')" "$(parts_json)" \
    "$(chq "SELECT toJSONString(tuple(sum(free_space), sum(total_space))) FROM system.disks")" > "$ST/host/$t.json" <<'PY'
import json, sys
t, st, parts, disks = sys.argv[1:5]
rows = []
for ln in st.split('|'):
    f = ln.split()
    if len(f) >= 3:
        rows.append({'t': int(f[0]), 'name': f[1], 'cpu': float(f[2].rstrip('%')) if f[2].rstrip('%').replace('.', '', 1).isdigit() else None, 'mem': ' '.join(f[3:])})
print(json.dumps({'t': int(t), 'stats': rows, 'parts': json.loads(parts), 'disks': json.loads(disks)}))
PY
}

case "$CMD" in
start)
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M
  env_save
  echo "── $EXP rep $REP · 복원 $SNAP_M · 기준선 ${BASE_S}초"
  rep_head "$SNAP_M" b
  ;;
load)
  rep_resume "$EXP" "$REP" "$ARM"
  [ -z "$(kv_get dg.main.launchMs)" ] || { echo "이미 load를 했다" >&2; exit 1; }
  kv_set soakS "$SOAK_S"; kv_set soakWarmS "${SOAK_WARM_S:-600}"
  kv_set k6Script k6-mix.js; kv_set k6Rates "latest=${RATE_LATEST:-20} ts=${RATE_TS:-5} master=${RATE_MASTER:-1}"
  mkdir -p "$ST/soak"
  dg_bg_start main M 10000 $(( SOAK_S + 120 ))
  docker rm -f "$K6_SOAK" "$SOAK_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$K6_SOAK" --network db_study_default --cpuset-cpus 11-12 -v "$PWD/$S5_LOAD":/s:ro -v "$PWD/$ST":/out \
    -e DURATION="${SOAK_S}s" -e RATE_LATEST="${RATE_LATEST:-20}" -e RATE_TS="${RATE_TS:-5}" -e RATE_MASTER="${RATE_MASTER:-1}" \
    "$K6_IMAGE" run -q --summary-export /out/k6-soak.json /s/k6-mix.js >/dev/null
  # 표본 컨테이너 — api 이미지의 busybox wget · Host 대조 허용 이름 api로 두 프로세스(api · worker)의 /metrics를 60초마다(주석 줄 제외)
  docker run -d --name "$SOAK_NAME" --network db_study_default --cpuset-cpus 13 -u 0 -v "$PWD/$ST/soak":/out --entrypoint sh \
    "db_study-api:$COMMIT_HASH" -c '
      while :; do
        t=$(date +%s)
        wget -qO- --header "Host: api:3000" http://api:3000/metrics 2>/dev/null | grep -v "^#" > /out/.a && mv /out/.a /out/a-$t.prom
        wget -qO- --header "Host: api:3000" http://'"$WK_NAME"':3000/metrics 2>/dev/null | grep -v "^#" > /out/.w && mv /out/.w /out/w-$t.prom
        sleep 60
      done' >/dev/null
  sleep 5
  host_sample
  ls "$ST/soak"
  echo "── Soak 시작 $(iso_now) · ${SOAK_S}초 · sample로 진행을 본다"
  ;;
sample)
  WAIT=${3:-0}
  [ "$WAIT" -le 540 ] || { echo "대기는 540초 이하(호출 10분 미만)" >&2; exit 1; }
  rep_resume "$EXP" "$REP" "$ARM"
  END=$(( $(date +%s) + WAIT ))
  while [ "$(date +%s)" -lt "$END" ]; do sleep 5; done
  host_sample
  L=$(kv_get dg.main.launchMs)
  python3 - "$ST" "$L" "$(dg_bg_running && echo up || echo down)" "$(docker inspect -f '{{.State.Running}}' "$K6_SOAK" 2>/dev/null || echo gone)" \
    "$(docker inspect -f '{{.State.Running}}' "$SOAK_NAME" 2>/dev/null || echo gone)" <<'PY'
import glob, os, sys, time
st, launch, dg, k6, smp = sys.argv[1:6]
files = sorted(glob.glob(f'{st}/soak/w-*.prom'))
last = {}
if files:
    for ln in open(files[-1]):
        f = ln.split()
        if len(f) == 2 and f[0] in ('consumer_lag', 'nodejs_heap_size_used_bytes', 'process_resident_memory_bytes'):
            last[f[0]] = f[1]
el = int(time.time() - int(launch) / 1000)
print(f'경과 {el // 60}분 · 표본 파일 {len(files)} · 생성기 {dg} · k6 {k6} · 표본 컨테이너 {smp} · worker 최신 {last}')
PY
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  docker rm -f "$SOAK_NAME" >/dev/null 2>&1 || true
  T0=$(date +%s)
  while [ "$(docker inspect -f '{{.State.Running}}' "$K6_SOAK" 2>/dev/null || echo false)" = true ]; do
    if [ $(( $(date +%s) - T0 )) -ge 300 ]; then echo "k6가 아직 돈다 — 다시 부른다" >&2; exit 1; fi
    sleep 5
  done
  docker logs "$K6_SOAK" > "$ST/k6-soak.log" 2>&1 || true
  docker rm -f "$K6_SOAK" >/dev/null 2>&1 || true
  dg_bg_collect main 240
  S=$(drain_wait 300)
  kv_set drainS "$S"
  [ "$S" != -1 ] || [ "${FORCE:-0}" = 1 ] || { echo "적체 미소진 — stop을 다시 부르거나 FORCE=1" >&2; exit 1; }
  host_sample
  rows_between $(( $(kv_get dg.main.launchMs) - 1000 )) "$(kv_get dg.main.exitMs)" > "$ST/rows"
  stack_down
  echo "── 정지 · 소진 ${S}초 · 범위 행 $(cat "$ST/rows")"
  ;;
collect)
  OUT=${3:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit soak "$OUT"
  ;;
*) echo "하위 명령: start|load|sample|stop|collect" >&2; exit 1 ;;
esac
