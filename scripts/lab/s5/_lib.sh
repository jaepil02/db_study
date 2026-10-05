# shellcheck shell=bash
# S5 실측 러너 공용 — S4 공용(복원 · 기준선 · 기동 · 정지 · metric · k6 · worker · snap_metrics · mdelta)을 그대로 쓰고 S5 조각을 더한다.
# 실험 규칙 정본 docs/10_observability/04_experiment_protocol.md · 부하 모양 정본 05_load_scenarios.md · 인터페이스 .omc/s5-interfaces.md
# 호출 한 번 = 반복 1개의 한 단계(10분 미만). 한 반복이 10분을 넘으면 하위 명령(start · step · window · sample · stop · collect)으로 쪼개고
# 단계 사이 상태는 상태 디렉터리($ST)에 파일로 남긴다. 자식 프로세스(모드 B · k6 · 표본 루프)는 같은 호출 안에서 거둔다.
# 호출을 넘어 사는 것은 Docker 컨테이너뿐이다 — api · worker(하위 명령 stop이 거둔다) · 장시간 부하 컨테이너(Baseline · Spike 회복 · Soak — 고정 지속으로 스스로 끝나고 stop이 거둔다) · Soak 표본 컨테이너.
# 비밀을 읽지 않는다 — .env는 Compose 치환으로만 흐른다(s3/_lib.sh와 같다). 백그라운드 셸 작업을 호출 밖에 남기지 않는다.
source "$(dirname "${BASH_SOURCE[0]}")/../s4/_lib.sh"

S5_LOAD=scripts/lab/s5/load
STATE_ROOT=${S5_STATE_ROOT:-.omc/lab/s5}
DG_NAME=db_study-datagen-lab
K6_NAME=db_study-k6-lab
WK_NAME=db_study-worker-lab
SOAK_NAME=db_study-soak-sampler

# 스냅샷 이름 — 티어 시드 모양 · scan_rate별(판정 6). 없는 것은 prep_seed_snap으로 만든다(리드가 한 번).
SNAP_BASE=${SNAP_BASE:-s3-base}
SNAP_S=${SNAP_S:-s3-empty-s}
SNAP_M=${SNAP_M:-s3-empty-m}
SNAP_L=${SNAP_L:-s5-empty-l}

# 백프레셔 임계 — 표본의 단계 판독은 모드 B 출력 options.thresholds(발행자가 실제로 쓴 값 · MAXLEN × 0.1 · 0.5 · 0.9)로 한다(_rec.py)

iso_now() { date -u +%Y-%m-%dT%H:%M:%S.000Z; }
ms_now() { python3 -c 'import time; print(int(time.time()*1000))'; }

# ── 상태 디렉터리 — <exp>-r<rep>-<arm> · start가 새로 만들고 나머지 하위 명령은 이어 쓴다
state_new() { # $1=exp $2=rep $3=arm
  ST="$STATE_ROOT/$1-r$2-$3"
  case "$ST" in "$STATE_ROOT"/*) ;; *) echo "상태 경로 이상: $ST" >&2; exit 1 ;; esac
  rm -rf "$ST"; mkdir -p "$ST/kv"
  kv_set exp "$1"; kv_set rep "$2"; kv_set arm "$3"; kv_set createdAt "$(iso_now)"
}
state_open() {
  ST="$STATE_ROOT/$1-r$2-$3"
  [ -d "$ST/kv" ] || { echo "상태 없음: $ST — start부터" >&2; exit 1; }
}
kv_set() { printf '%s' "$2" > "$ST/kv/$1"; }
kv_get() { cat "$ST/kv/$1" 2>/dev/null || true; }
kv_append() { printf '%s\n' "$2" >> "$ST/kv/$1"; }

# ── 커밋 해시 — start는 require_clean(깨끗한 트리 · 이미지 빌드)으로 정하고 kv에 박는다 · 뒤 하위 명령은 같은 해시를 다시 쓴다
commit_from_state() {
  COMMIT_HASH=$(kv_get commit)
  [ -n "$COMMIT_HASH" ] || { echo "상태에 커밋 해시가 없다" >&2; exit 1; }
  # 반복 도중 문서 커밋은 허용한다 — 이미지에 들어가는 경로(s3 require_clean과 같은 목록)가 start 커밋과 같아야 한다
  if [ "$(git rev-parse --short HEAD)" != "$COMMIT_HASH" ] && ! git diff --quiet "$COMMIT_HASH" HEAD -- apps/api packages package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore infra/postgres infra/clickhouse; then
    echo "이미지 경로가 start 커밋($COMMIT_HASH) 뒤 바뀌었다 — 반복 안에서 코드를 바꾸지 않는다" >&2; exit 1
  fi
  if [ -n "$(git status --porcelain -- apps/api packages package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore infra/postgres infra/clickhouse)" ]; then
    echo "이미지 경로에 커밋되지 않은 변경이 있다" >&2; exit 1
  fi
  export COMMIT_HASH
}
begin_rep() { # $1=exp $2=rep $3=arm — 새 반복의 상태 · 커밋
  state_new "$1" "$2" "$3"
  require_clean
  kv_set commit "$HASH"
}
# 이어지는 하위 명령 — 상태 · 커밋 · 조건 환경변수 · 적재 계측 원천을 되살린다
rep_resume() { # $1=exp $2=rep $3=arm
  state_open "$1" "$2" "$3"
  commit_from_state
  env_load
  LAG_SRC=$(kv_get lagSrc); LAG_SRC=${LAG_SRC:-worker}
}
# 계단 디렉터리 — steps/NN-이름표 · 번호는 있는 계단 수 + 1
step_dir_new() { # $1=이름표
  local n
  mkdir -p "$ST/steps"
  n=$(find "$ST/steps" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  SD="$ST/steps/$(printf '%02d' $(( n + 1 )))-$1"
  mkdir -p "$SD"
}
meta_set() { printf '%s=%s\n' "$1" "$2" >> "$SD/meta"; }
meta_get() { sed -n "s/^$1=//p" "$2/meta" | tail -1; }

# ── 조건 환경변수 — 하위 명령 사이에 같은 값을 쓰도록 kv에 박고 다시 export 한다
ENV_KEYS="CAPACITY_TIER REDIS_STREAM_BUFFER REDIS_LATEST_CACHE REDIS_QUERY_CACHE CACHE_KEY_TIME_SNAP CACHE_STAMPEDE_LOCK REDIS_PUBSUB_FANOUT WS_THROTTLE_MS INGEST_IDEMPOTENCY CONTROL_TABLE_ENABLED COLLECTOR_DEADBAND LATEST_VALUE_WRITER INGEST_BATCH_PLAN DATAGEN_BULK_ENABLED GEN_PROFILE"
env_save() {
  local k
  : > "$ST/env"
  for k in $ENV_KEYS; do
    if [ -n "${!k:-}" ]; then printf '%s=%s\n' "$k" "${!k}" >> "$ST/env"; fi
  done
}
env_load() {
  local line
  [ -f "$ST/env" ] || return 0
  while IFS= read -r line; do [ -n "$line" ] && export "${line?}"; done < "$ST/env"
}

# ── 기동 구성 두 가지
# 모드 B · C: api(APP_ROLE api — 조회 · 모드 C 표면 · OBS 저장소 수집) + worker(APP_ROLE worker — 적재) — S4 판정 14와 같은 구성
#   APP_ROLE all은 모드 A(SIM · Collector)를 함께 띄워 주입 모드가 둘이 된다(S4 판정 13).
# 모드 A: APP_ROLE all 하나(모드 A는 collector와 동거 필수 — ADR-22)
LAG_SRC=worker
stack_up_b() {
  worker_stop
  worker_start
  APP_ROLE=api api_up
  for _ in $(seq 1 60); do
    if docker exec "$WK_NAME" wget -qO /dev/null http://127.0.0.1:3000/api/v1/health 2>/dev/null; then LAG_SRC=worker; return 0; fi
    sleep 1
  done
  echo "worker health 60초 초과" >&2; exit 1
}
stack_up_a() { APP_ROLE=all api_up; LAG_SRC=api; }
stack_down() { # api 정상 종료(드레인) → worker 정상 종료
  api_stop
  worker_stop
}

# ── 메트릭 캡처 — api는 호스트 13000 · worker는 컨테이너 안에서(포트를 열지 않는다 · Host 대조 허용 이름 127.0.0.1)
wdump() { docker exec "$WK_NAME" wget -qO- http://127.0.0.1:3000/metrics 2>/dev/null || true; }
adump() { curl -s --max-time 5 http://127.0.0.1:13000/metrics || true; }
lagdump() { if [ "$LAG_SRC" = worker ]; then wdump; else adump; fi; }
snap_all() { # $1=접두 → 접두.api · 접두.worker(모드 B · C)
  adump > "$1.api"
  if [ "$LAG_SRC" = worker ]; then wdump > "$1.worker"; fi
}
mval() { awk -v n="$2" '$1==n {print $2; exit}' "$1"; }

# docker stats 한 줄 묶음 — 떠 있는 것만(없는 이름을 주면 명령 전체가 실패한다)
STATS_SET="db_study-api-1 $WK_NAME $DG_NAME $K6_NAME db_study-clickhouse-1 db_study-redis-1 db_study-postgres-1 db_study-prometheus-1 db_study-grafana-1"
stats_once() { # 한 줄 = epoch 이름 CPU% 메모리
  local up=() c t
  for c in $STATS_SET; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || true)" = true ]; then up+=("$c"); fi
  done
  [ "${#up[@]}" -gt 0 ] || return 0
  t=$(date +%s)
  docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' "${up[@]}" 2>/dev/null | sed "s/^/$t /" || true
}

# ── 1초 표본(포그라운드) — 판정 창 동안 consumer_lag 성분 · 적재 프로세스 메모리 · 10초마다 docker stats
# 줄: epoch consumer_lag ing_group_lag ing_group_pending heap_used rss eventloop_p95   (값이 없으면 -) — 적재 프로세스(모드 B · C worker · 모드 A api)
sample_run() { # $1=초 $2=표본 파일(추가) $3=stats 파일(추가) [$4=stats 간격 초=10]
  local end=$(( $(date +%s) + $1 )) every=${4:-10} next_stats=0 now m
  while :; do
    now=$(date +%s)
    [ "$now" -lt "$end" ] || break
    m=$(lagdump)
    printf '%s %s\n' "$now" "$(printf '%s\n' "$m" | awk '
      $1=="consumer_lag"{a=$2} $1=="ing_group_lag"{b=$2} $1=="ing_group_pending"{c=$2}
      $1=="nodejs_heap_size_used_bytes"{d=$2} $1=="process_resident_memory_bytes"{e=$2} $1=="nodejs_eventloop_lag_p95_seconds"{f=$2}
      END{printf "%s %s %s %s %s %s", (a==""?"-":a), (b==""?"-":b), (c==""?"-":c), (d==""?"-":d), (e==""?"-":e), (f==""?"-":f)}')" >> "$2"
    if [ "$now" -ge "$next_stats" ]; then stats_once >> "$3"; next_stats=$(( now + every )); fi
    now=$(date +%s)
    [ "$now" -ge "$end" ] || sleep 1
  done
}

# 적체 소진 대기 — consumer_lag ≤ 바닥(기본 0)까지 · 상한 초 · 걸린 초를 출력(상한 초과면 -1)
drain_wait() { # $1=상한 초 [$2=바닥=0]
  local t0 lag floor=${2:-0}
  t0=$(date +%s)
  while :; do
    lag=$(lagdump | awk '$1=="consumer_lag"{print $2; exit}')
    if [ -n "$lag" ] && python3 -c "import sys; sys.exit(0 if float('$lag') <= float('$floor') else 1)"; then echo $(( $(date +%s) - t0 )); return 0; fi
    if [ $(( $(date +%s) - t0 )) -ge "$1" ]; then echo -1; return 0; fi
    sleep 2
  done
}

# ── 모드 B 생성기(datagen 프로파일 컨테이너 · cpuset 11-12 · dist/mode-b.js) — 티어 = 시드 모양 · pps는 --pps
# 포그라운드 자식: dg_start → (표본) → dg_wait. 출력 JSON 한 줄은 $1 파일
dg_start() { # $1=출력 파일 $2=티어 $3=pps $4=초 [나머지=mode-b 인자]
  local out=$1 tier=$2 pps=$3 dur=$4; shift 4
  docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
  kv_set "dg.$(basename "$out").launchMs" "$(ms_now)"
  CAPACITY_TIER=$tier $COMPOSE --profile datagen run --rm --no-deps --name "$DG_NAME" datagen \
    node dist/mode-b.js --tier "$tier" --mix mixed --seed 42 --duration "$dur" --pps "$pps" "$@" > "$out.raw" 2> "$out.err" &
  DG_PID=$!
  DG_FG=1
}
dg_wait() { # $1=출력 파일 — 자식을 거두고 JSON 줄만 남긴다
  wait "$DG_PID" || true
  DG_FG=0
  kv_set "dg.$(basename "$1").exitMs" "$(ms_now)"
  grep '^{' "$1.raw" | tail -1 > "$1" || true
  if [ ! -s "$1" ]; then echo "모드 B 출력 없음 — $1.err:" >&2; cat "$1.err" >&2; return 1; fi
}
# 호출을 넘어 사는 생성기(Baseline · Spike 회복 · Soak) — --duration으로 스스로 끝난다 · dg_bg_collect가 출력을 거두고 컨테이너를 지운다
dg_bg_start() { # $1=이름표 $2=티어 $3=pps $4=초
  docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
  kv_set "dg.$1.launchMs" "$(ms_now)"
  CAPACITY_TIER=$2 $COMPOSE --profile datagen run -d --no-deps --name "$DG_NAME" datagen \
    node dist/mode-b.js --tier "$2" --mix mixed --seed 42 --duration "$4" --pps "$3" >/dev/null
  kv_set "dg.$1.durationS" "$4"
}
dg_bg_running() { [ "$(docker inspect -f '{{.State.Running}}' "$DG_NAME" 2>/dev/null || true)" = true ]; }
dg_bg_collect() { # $1=이름표 $2=상한 초 — 끝날 때까지 기다리고 JSON 줄을 $ST/$1.modeb로(상한 초과면 1)
  local t0; t0=$(date +%s)
  while dg_bg_running; do
    if [ $(( $(date +%s) - t0 )) -ge "$2" ]; then echo "생성기가 아직 돈다(상한 $2초) — 다시 부른다" >&2; return 1; fi
    sleep 2
  done
  docker logs "$DG_NAME" 2>/dev/null | grep '^{' | tail -1 > "$ST/$1.modeb" || true
  kv_set "dg.$1.exitMs" "$(docker inspect -f '{{.State.FinishedAt}}' "$DG_NAME" 2>/dev/null | python3 -c 'import sys,datetime; s=sys.stdin.read().strip()[:26].rstrip("Z"); print(int(datetime.datetime.fromisoformat(s).replace(tzinfo=datetime.timezone.utc).timestamp()*1000)) if s else print("")')"
  docker rm -f "$DG_NAME" >/dev/null 2>&1 || true
  [ -s "$ST/$1.modeb" ] || { echo "모드 B 출력 없음($1)" >&2; return 1; }
}

# ── k6(컨테이너 · cpuset 11-12 · 버전 고정 grafana/k6:1.8.1 · 대상 http://api:3000) — 스크립트 디렉터리 scripts/lab/s5/load
# 포그라운드 자식: k6_start → (표본) → k6_wait. 요약은 $ST/<이름>.json · 원시(선택)는 $ST/<이름>.jsonl.gz
k6_start() { # $1=스크립트 $2=이름 [나머지=docker -e 인자] — K6_RAW=1이면 http_req_duration 원시를 남긴다
  local script=$1 name=$2; shift 2
  local raw=()
  if [ "${K6_RAW:-0}" = 1 ]; then raw=(--out "json=/out/$name.jsonl.gz" --system-tags "scenario,status,name"); fi
  docker rm -f "$K6_NAME" >/dev/null 2>&1 || true
  docker run --rm --name "$K6_NAME" --network db_study_default --cpuset-cpus 11-12 -v "$PWD/$S5_LOAD":/s:ro -v "$PWD/$ST":/out \
    "$@" "$K6_IMAGE" run -q --summary-export "/out/$name.json" "${raw[@]}" "/s/$script" > "$ST/$name.stdout" 2> "$ST/$name.err" &
  K6_PID=$!
  K6_FG=1
}
k6_wait() {
  local rc=0
  wait "$K6_PID" || rc=$?
  K6_FG=0
  [ "$rc" -eq 0 ] || { echo "k6 비정상 종료 — $ST/$1.err" >&2; tail -5 "$ST/$1.err" >&2; return 1; }
}

# ── ClickHouse 판독(서버 컨테이너 안 clickhouse-client · 비밀 없음)
# 판정 창 E2E — ts ∈ [s, e) · quantilesExact(정확 분위수 · 판정 절대값) · 창이 이미 적재된 뒤(소진 뒤)에 부른다
e2e_json() { # $1=시작 ms $2=끝 ms
  chq "SELECT toJSONString(tuple(quantilesExact(0.5, 0.95, 0.99)(dateDiff('millisecond', ts, ingested_at)), count()))
         FROM plc.tag_raw WHERE ts >= fromUnixTimestamp64Milli(toInt64($1)) AND ts < fromUnixTimestamp64Milli(toInt64($2))"
}
rows_between() { # $1=시작 ms $2=끝 ms(포함)
  chq "SELECT count() FROM plc.tag_raw WHERE ts >= fromUnixTimestamp64Milli(toInt64($1)) AND ts <= fromUnixTimestamp64Milli(toInt64($2))"
}
rows_total() { chq "SELECT count() FROM plc.tag_raw"; }
# AC-02 — 선택(DUPCHECK=1) · 큰 표에서는 무겁다
dup_json() { chq "SELECT toJSONString(tuple(count(), sum(c - 1))) FROM (SELECT tag_id, ts, count() AS c FROM plc.tag_raw GROUP BY tag_id, ts HAVING c > 1)"; }
parts_json() { # 활성 파트 · 디스크 · 비압축(tag_raw)
  chq "SELECT toJSONString(tuple(count(), sum(bytes_on_disk), sum(data_uncompressed_bytes), sum(rows))) FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active"
}

# ── 티어 시드 스냅샷 준비(리드가 한 번 · 부하 측정 호출이 아니다) — 빈 기반 스냅샷 복원 → seed → snapshot
# 예: prep_seed_snap s5-empty-l --tier L · prep_seed_snap s5-m-sr100 --tier M --scan-rate 100
prep_seed_snap() { # $1=스냅샷 이름 나머지=seed 인자
  local name=$1; shift
  [ ! -e "snapshots/$name" ] || { echo "이미 있다: snapshots/$name" >&2; return 0; }
  require_clean
  restore_snap "$SNAP_BASE"
  # seed는 학습자 계정 비밀번호(SEED_USER_PASSWORD)를 요구한다 — 이 스크립트는 .env를 읽지 않으므로 task seed(dotenv 로드 ·
  # -e SEED_USER_PASSWORD)로 넘긴다. --env-file은 Compose 파일 치환일 뿐 run -e의 값 원천이 되지 않는다(환경에 값이 있어야 한다)
  task seed -- "$@"
  task snapshot NAME="$name" >/dev/null
  echo "$*" > "snapshots/$name/seed.txt"
  echo "스냅샷 $name 준비 완료 — seed $*"
}

# 모드 B 계단의 티어 · pps 대응(판정 5 · 6) — 시드 모양이 티어를 정한다: S(250 태그) · M · M+(M 시드) · L(태그 50,000)
# M 시드 위 pps ÷ 10,000 = 초당 시점 수(1,000의 약수) — 10k·20k·40k·50k·80k·100k·200k … · L 시드는 500k(10)
tier_for_pps() {
  case "$1" in
    250) echo S ;;
    100000|200000) echo M+ ;;
    500000) echo L ;;
    *) echo M ;;
  esac
}
snap_for_tier() {
  case "$1" in
    S) echo "$SNAP_S" ;;
    L) echo "$SNAP_L" ;;
    *) echo "$SNAP_M" ;;
  esac
}
tags_for_tier() { case "$1" in S) echo 250 ;; L) echo 50000 ;; *) echo 10000 ;; esac; }

# 로그 중점 계단 — 두 pps의 기하 평균에 가장 가까운(로그 거리) 유효 pps · 유효 = 태그 수 × 1,000의 약수 · 두 끝 사이에 없으면 빈 출력
log_mid_pps() { # $1 $2 $3=태그 수
  python3 - "$1" "$2" "$3" <<'PY'
import math, sys
a, b, tags = sorted(map(int, sys.argv[1:3])) + [int(sys.argv[3])]
mid = math.sqrt(a * b)
cands = [tags * d for d in range(1, 1001) if 1000 % d == 0 and a < tags * d < b]
print(min(cands, key=lambda p: abs(math.log(p / mid))) if cands else '')
PY
}

# ── 반복 머리 공통 — 복원 · 기준선(api 없이 · 저장소 유휴 docker stats) · 기동 · health
store_resources_check() {
  # 저장소 자원 조건 — 복원은 컨테이너 설정을 그대로 두므로 격자(CONTROL=1)의 대조 조건이 남아 있을 수 있다(검수 #6)
  # 부하 실험 프로파일 배치(clickhouse 5-8 · 5 GB · postgres 9-10 · 2 GB — 04_architecture/03 · 09_tech_stack/04)가 아니면 거부한다
  local chres pgres
  chres=$(docker inspect -f '{{.HostConfig.CpusetCpus}}/{{.HostConfig.Memory}}' db_study-clickhouse-1)
  pgres=$(docker inspect -f '{{.HostConfig.CpusetCpus}}/{{.HostConfig.Memory}}' db_study-postgres-1)
  kv_set storeResources "clickhouse=$chres postgres=$pgres"
  if [ "$chres" != "5-8/5368709120" ] || [ "$pgres" != "9-10/2147483648" ]; then
    echo "저장소 자원 조건이 부하 실험 프로파일이 아니다(clickhouse $chres · postgres $pgres) — 격자의 대조 조건이 남았다면 task up으로 다시 만든다" >&2
    exit 1
  fi
}

BASE_S=${BASE_S:-300}
rep_head() { # $1=스냅샷 $2=구성 a|b
  # 앞 호출이 남긴 러너 컨테이너를 먼저 거둔다 — 저장소를 멈추는 복원 중에 적재 · 발행이 붙어 있지 않게
  worker_stop
  docker rm -f "$DG_NAME" "$K6_NAME" >/dev/null 2>&1 || true
  # Soak 컨테이너(k6 soak · 표본)가 남아 있으면 다음 실험의 api에 붙는다 — 경고하고 거둔다(검수 #2)
  local c
  for c in db_study-k6-soak "$SOAK_NAME"; do
    if docker inspect "$c" >/dev/null 2>&1; then echo "경고: 앞 실험의 ${c}가 남아 있었다 — 거둔다" >&2; docker rm -f "$c" >/dev/null 2>&1 || true; fi
  done
  restore_snap "$1"
  kv_set snapshot "$1"
  store_resources_check
  kv_set baselineStart "$(iso_now)"
  baseline "$BASE_S" "$ST/baseline"
  kv_set baselineEnd "$(iso_now)"
  if [ "$2" = a ]; then stack_up_a; else stack_up_b; fi
  kv_set lagSrc "$LAG_SRC"
  curl -s http://127.0.0.1:13000/api/v1/health > "$ST/health.json"
}

# 원시 줄 조립 — scripts/lab/s5/load/_rec.py <종류> <상태> <출력 jsonl>
emit() { python3 "$S5_LOAD/_rec.py" "$1" "$ST" "$2"; }

# ── 호출이 비정상으로 끝나도 포그라운드 자식을 남기지 않는다(검수 #1) — set -e 실패 · 호출 시간 한도 · 인터럽트
# 호출을 넘어 사는 컨테이너(dg_bg_* · Soak · api · worker)는 건드리지 않는다 — 그것은 하위 명령 stop이 거둔다.
DG_FG=0
K6_FG=0
_s5_cleanup() {
  local jp
  jp=$(jobs -p)
  if [ "${DG_FG:-0}" = 1 ]; then docker rm -f "$DG_NAME" >/dev/null 2>&1 || true; fi
  if [ "${K6_FG:-0}" = 1 ]; then docker rm -f "$K6_NAME" >/dev/null 2>&1 || true; fi
  # shellcheck disable=SC2086
  [ -z "$jp" ] || kill $jp 2>/dev/null || true
}
trap _s5_cleanup EXIT
trap '_s5_cleanup; exit 130' INT TERM
