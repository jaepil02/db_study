#!/usr/bin/env bash
# EXP-45 스트리밍 동시 적재 러너(control-stream-ingest) — 모드 B 계단에서 같은 배치를 받는 두 싱크(ClickHouse 삽입 · PostgreSQL COPY)의 시간을 계단마다 나란히 잰다
# 정본: docs/05_data_stores/10_olap_vs_rdb_control.md §스트리밍 동시 적재 — EXP-45(고정 6 · 지표 6 · 계단 절차 ①~⑥)
#       docs/06_pipeline/04_routing.md §대조군 동시 적재 기전(② 삽입 성공 뒤 ③ COPY 1회 · ④ XACK · 구간 count 대조 절차)
#       docs/10_observability/06_experiment_catalog.md EXP-45 · 04_experiment_protocol.md(streamSteps)
# 조건: 대조 자원 조건(task up CONTROL=1 — clickhouse 5-7 · 3.5 GB · postgres 8-10 · 3.5 GB) · SW-09 on · SW-10 off · 배치 안 A만(현행 기본 · ADR-09)
#       · 모드 B datagen cpuset 11-12 · 인덱스 변형 I1 · 대조군 COPY synchronous_commit off(이미지 커밋의 연결 기동 인자)
#       — start가 배치 안 · 기동 인자 · 자원 · 스위치 · 인덱스를 대조해 어긋나면 멈춘다
#       배치 안 B는 돌지 않는다 — COPY 타임아웃 W ÷ 2 = 2.5초가 버킷 칸 사이에 떨어져 PG p95 > 타임아웃이 보간으로 거짓 판정된다(L3)
# B형: 이 기록은 목표 ② 처리량을 재지 않는다 — 기록 머리에 EXP-45만 인용하고 EXP-23 계단과 겹쳐 그리지 않는다
# 구성: api(APP_ROLE api — OBS 저장소 수집) + worker(적재 · 대조군 COPY) + datagen 컨테이너(모드 B) — modeb-steps.sh와 같은 구성 · 하위 명령 구조
# 한 반복: start(① 복원 · 기준선 · 기동) → step × N(② 전환 ③ 창 앞뒤 캡처 ④ 창 판독 한 줄) → stop(소진 · ⑥ 구간 count · 정지) → collect(원시 한 줄)
#   ⑤ 판정 점(step 출력 passed)을 지난 뒤 한 계단 더 가고 멈춘다 — 리드 판단
# 사용:
#   exp45-control-stream.sh start   <반복>                                   ~6.5분(기준선 BASE_S=300)
#   exp45-control-stream.sh step    <반복> <pps> [전환 초=60] [창 초=180]    ~4.5분 · M 시드 계단만(10k~200k)
#   exp45-control-stream.sh drain   <반복> [상한 초=480]                     적체 소진 대기만
#   exp45-control-stream.sh stop    <반복> [소진 상한 초=300]                소진 → 구간 count → 정지(소진 안 되면 멈추고 1 · FORCE=1이면 그대로 판독)
#   exp45-control-stream.sh collect <반복> <출력 jsonl>
#   exp45-control-stream.sh table   <원시 jsonl> <출력 jsonl>               반복 줄들 → conditions · repeat · streamSteps 한 줄(저장소 접속 없음 · 조건이 반복끼리 다르면 멈춘다)
#   exp45-control-stream.sh reset   <반복>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|step|drain|stop|collect|table|reset}
EXP=exp45
ARM=stream
PG_NAME=db_study-postgres-1
SNAP_EXP45=${SNAP_EXP45:-$SNAP_M}

# 대조 자원 조건 대조 — S5 공용의 부하 실험 프로파일 대조를 이 러너에서만 바꿔 쓴다(rep_head가 부른다)
store_resources_check() {
  local chres pgres
  chres=$(docker inspect -f '{{.HostConfig.CpusetCpus}}/{{.HostConfig.Memory}}' db_study-clickhouse-1)
  pgres=$(docker inspect -f '{{.HostConfig.CpusetCpus}}/{{.HostConfig.Memory}}' "$PG_NAME")
  kv_set storeResources "clickhouse=$chres postgres=$pgres"
  if [ "$chres" != "5-7/3758096384" ] || [ "$pgres" != "8-10/3758096384" ]; then
    echo "저장소 자원 조건이 대조 자원 조건이 아니다(clickhouse $chres · postgres $pgres) — task up CONTROL=1로 다시 만든다" >&2
    exit 1
  fi
}

pgq() { docker exec -u postgres "$PG_NAME" psql -d plc -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
# 창 경계 PostgreSQL 계수 — WAL(pg_stat_wal) · 대조군 잎 파티션 autovacuum · 죽은 · 산 튜플(pg_stat_all_tables)
pg_counters_json() {
  pgq "SELECT json_build_object('walBytes', (SELECT wal_bytes FROM pg_stat_wal), 'walFpi', (SELECT wal_fpi FROM pg_stat_wal),
    'walRecords', (SELECT wal_records FROM pg_stat_wal), 'autovacuum', coalesce(sum(s.autovacuum_count), 0),
    'deadTuples', coalesce(sum(s.n_dead_tup), 0), 'liveTuples', coalesce(sum(s.n_live_tup), 0))
    FROM pg_stat_all_tables s JOIN pg_partition_tree('plc_tag_raw_control') p ON p.relid = s.relid AND p.isleaf"
}
# ts 범위 행 수 — epoch ms 양 끝 포함(rows_between과 같은 범위)
pg_rows_between() { # $1=시작 ms $2=끝 ms
  pgq "SELECT count(*) FROM plc_tag_raw_control WHERE ts >= timestamptz 'epoch' + $1 * interval '1 millisecond'
    AND ts <= timestamptz 'epoch' + $2 * interval '1 millisecond'"
}
# 창 [시작, 끝)의 tag_raw 파트 이벤트 — 새 파트 수 · 바이트 · 머지 수 · 머지 쓰기 · 읽기 바이트(SYSTEM FLUSH LOGS 뒤)
partlog_json() { # $1=시작 ms $2=끝 ms
  chq "SELECT toJSONString(tuple(countIf(event_type = 'NewPart'), sumIf(size_in_bytes, event_type = 'NewPart'),
         countIf(event_type = 'MergeParts'), sumIf(size_in_bytes, event_type = 'MergeParts'), sumIf(read_bytes, event_type = 'MergeParts')))
       FROM system.part_log WHERE database = 'plc' AND table = 'tag_raw'
         AND event_time_microseconds >= fromUnixTimestamp64Milli(toInt64($1)) AND event_time_microseconds < fromUnixTimestamp64Milli(toInt64($2))"
}
# 대조군 COPY 세션 synchronous_commit의 참고 칸 — 역할 · DB 설정과 서버 설정
#   유효 값은 연결 기동 인자(options)가 정하고 기동 인자가 이 셋보다 앞선다 — 유효 값의 원천은 start의 controlCopyOptions(_rec.py exp45_sync_commit)
sync_commit_json() {
  pgq "WITH a AS (SELECT usename, datname FROM pg_stat_activity WHERE application_name = 'db_study-control-copy' LIMIT 1),
    rs AS (SELECT r.rolname, s.setdatabase, substring(c FROM 'synchronous_commit=(.*)') AS v
           FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole, unnest(s.setconfig) c WHERE c LIKE 'synchronous_commit=%')
    SELECT json_build_object('user', (SELECT usename FROM a),
      'server', (SELECT reset_val FROM pg_settings WHERE name = 'synchronous_commit'),
      'roleDb', (SELECT v FROM rs WHERE rolname = (SELECT usename FROM a) AND setdatabase = (SELECT oid FROM pg_database WHERE datname = (SELECT datname FROM a)) LIMIT 1),
      'role', (SELECT v FROM rs WHERE rolname = (SELECT usename FROM a) AND setdatabase = 0 LIMIT 1),
      'db', (SELECT v FROM rs WHERE rolname IS NULL AND setdatabase = (SELECT oid FROM pg_database WHERE datname = (SELECT datname FROM a)) LIMIT 1))"
}
# 창 경계 캡처 — /metrics 원문(api · worker) · PostgreSQL 계수 · ClickHouse 활성 파트
edge_capture() { # $1=0|1
  snap_all "$SD/m$1"
  pg_counters_json > "$SD/pg$1.json"
  parts_json > "$SD/parts$1.json"
}
# health 스위치 값 — health.json switches.<SW>.value
sw_of() { python3 -c 'import json,sys; s=(json.load(open(sys.argv[1])).get("switches") or {}).get(sys.argv[2]); print(s.get("value") if isinstance(s, dict) else s)' "$1" "$2" 2>/dev/null || true; }

case "$CMD" in
start)
  REP=${2:?반복 번호}
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  # 배치 안 A만 — INGEST_BATCH_PLAN을 주지 않으면 A(현행 기본) · 다른 안은 거부한다(L3)
  PLAN=${INGEST_BATCH_PLAN:-A}
  if [ "$PLAN" != A ]; then echo "EXP-45는 배치 안 A만 돈다(INGEST_BATCH_PLAN=$PLAN) — 변수를 지우고 다시 부른다" >&2; exit 1; fi
  if [ -d "$ST/kv" ] && [ "$(cat "$ST/kv/open" 2>/dev/null || true)" = 1 ]; then echo "열린 반복이 있다 — stop 또는 reset 먼저" >&2; exit 1; fi
  begin_rep "$EXP" "$REP" "$ARM"
  # ① 고정 조건 — SW-09 on · SW-10 off · 배치 안 A(창 폭 W 1초 · app-config INGEST_BATCH_PLANS) · M 시드
  export CAPACITY_TIER=M CONTROL_TABLE_ENABLED=on COLLECTOR_DEADBAND=off INGEST_BATCH_PLAN=A
  env_save
  W_MS=1000
  kv_set windowMs "$W_MS"; kv_set copyTimeoutMs $(( W_MS / 2 ))
  # 대조군 COPY 세션의 synchronous_commit — 이미지 커밋의 연결 기동 인자(control-table-sink.port.ts options)가 유효 값이다
  COPY_OPTS=$(git show "$(kv_get commit):apps/api/src/modules/ingest/control-table-sink.port.ts" | grep -o "options: '[^']*'" | head -1 | sed "s/^options: '//; s/'\$//")
  kv_set controlCopyOptions "$COPY_OPTS"
  case " $COPY_OPTS " in
    *" synchronous_commit=off "*) ;;
    *) echo "이미지 커밋 $(kv_get commit)의 대조군 COPY 기동 인자에 synchronous_commit=off가 없다('$COPY_OPTS')" >&2; exit 1 ;;
  esac
  kv_set open 1
  echo "── $EXP rep $REP · 복원 $SNAP_EXP45 · 기준선 ${BASE_S}초 · 배치 안 A · 창 폭 W ${W_MS} ms · COPY 타임아웃 $(( W_MS / 2 )) ms · COPY 기동 인자 '$COPY_OPTS'"
  rep_head "$SNAP_EXP45" b
  docker exec "$WK_NAME" wget -qO- http://127.0.0.1:3000/api/v1/health > "$ST/health-worker.json" 2>/dev/null || true
  for f in "$ST/health.json" "$ST/health-worker.json"; do
    if [ "$(sw_of "$f" SW-09)" != on ] || [ "$(sw_of "$f" SW-10)" != off ]; then
      echo "스위치 조건 불일치($f) — SW-09 $(sw_of "$f" SW-09) · SW-10 $(sw_of "$f" SW-10)(기대 on · off)" >&2
      stack_down; kv_set open 0; exit 1
    fi
  done
  # 인덱스 변형 I1 — btree(I2)가 남아 있으면 COPY마다 btree 삽입이 더해져 다른 실험이 된다
  if [ "$(pgq "SELECT count(*) FROM pg_class WHERE relname LIKE 'plc_tag_raw_control%key_btree'")" != 0 ]; then
    echo "대조군에 btree(I2)가 있다 — I1 스냅샷으로 복원한다" >&2; stack_down; kv_set open 0; exit 1
  fi
  kv_set indexVariant I1
  START_COUNTS=$(printf '{"tagRaw": %s, "control": %s}' "$(rows_total)" "$(pgq 'SELECT count(*) FROM plc_tag_raw_control')")
  kv_set startCounts "$START_COUNTS"
  echo "── 기동 완료 — 시작 행 수 $START_COUNTS · step <pps>로 계단을 건다"
  ;;
step)
  REP=${2:?반복 번호}
  PPS=${3:?pps}
  TRANS=${4:-60}
  WIN=${5:-180}
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" = 1 ] || { echo "열린 반복이 없다 — start 먼저" >&2; exit 1; }
  TIER=$(tier_for_pps "$PPS")
  # M 시드 계단만 — 250(S) · 500k(L)은 시드 모양이 달라 모드 B가 거부한다
  case "$TIER" in M|M+) ;; *) echo "pps $PPS(티어 $TIER)는 M 시드 위에서 돌 수 없다" >&2; exit 1 ;; esac
  step_dir_new "$PPS"
  meta_set label "$PPS"; meta_set tier "$TIER"; meta_set pps "$PPS"; meta_set transS "$TRANS"; meta_set winS "$WIN"
  # 앞 계단 ts 범위와 겹치지 않게 — 모드 B 첫 틱의 ts는 기동 시각 − 1초까지 내려간다
  sleep 2
  echo "── $EXP rep $REP 계단 $PPS pps(티어 $TIER) · 전환 ${TRANS}초 + 창 ${WIN}초"
  dg_start "$SD/modeb.json" "$TIER" "$PPS" $(( TRANS + WIN + 5 ))
  meta_set launchMs "$(kv_get "dg.modeb.json.launchMs")"
  # ② 전환 과도 구간은 버린다(표본만 남긴다) → ③ 창 앞 캡처 → 창 유지 → 창 뒤 캡처
  sample_run "$TRANS" "$SD/trans.samples" "$SD/stats"
  meta_set winStartMs "$(ms_now)"; edge_capture 0
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  meta_set winEndMs "$(ms_now)"; edge_capture 1
  dg_wait "$SD/modeb.json"
  meta_set exitMs "$(kv_get "dg.modeb.json.exitMs")"
  chq "SYSTEM FLUSH LOGS" >/dev/null
  partlog_json "$(meta_get winStartMs "$SD")" "$(meta_get winEndMs "$SD")" > "$SD/partlog.json"
  # synchronous_commit 참고 칸 — 대조군 COPY 세션은 첫 COPY 뒤에야 보인다 · 첫 계단 끝에 한 번 남긴다
  if [ -z "$(kv_get syncCommit)" ] || ! grep -q '"user" : "' "$ST/kv/syncCommit"; then kv_set syncCommit "$(sync_commit_json)"; fi
  # ④ 창 판독 한 줄(기록 아님 — 구간 count는 소진 뒤 stop이 채운다)
  python3 - "$S5_LOAD" "$SD" "$(kv_get windowMs)" "$(kv_get copyTimeoutMs)" <<'PY'
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import _rec
_rec.exp45_step_print(sys.argv[2], float(sys.argv[3]), float(sys.argv[4]))
PY
  ;;
drain)
  REP=${2:?반복 번호}
  rep_resume "$EXP" "$REP" "$ARM"
  S=$(drain_wait "${3:-480}")
  echo "소진 ${S}초(-1 = 상한 초과)"
  ;;
stop)
  REP=${2:?반복 번호}
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" = 1 ] || { echo "열린 반복이 없다" >&2; exit 1; }
  # ③ COPY는 ④ XACK 앞이다 — 랙 0이면 모든 배치의 COPY가 끝났다
  S=$(drain_wait "${3:-300}")
  if [ "$S" = -1 ] && [ "${FORCE:-0}" != 1 ]; then echo "적체가 소진되지 않았다 — drain을 더 부르거나 FORCE=1(미소진으로 기록)" >&2; exit 1; fi
  kv_set drainS "$S"
  # ⑥ 사후 구간 count 대조 — 계단별 ts 범위(기동 − 1초 ~ 종료) · KST 일 단위(04_routing 절차 ①②) · 정확 일치만 합격
  MIN_MS='' MAX_MS=''
  for sd in "$ST"/steps/*/; do
    [ -f "$sd/meta" ] || continue
    sd=${sd%/}
    a=$(( $(meta_get launchMs "$sd") - 1000 )); b=$(meta_get exitMs "$sd")
    printf '{"fromMs": %s, "toMs": %s, "tagRaw": %s, "control": %s}\n' "$a" "$b" "$(rows_between "$a" "$b")" "$(pg_rows_between "$a" "$b")" > "$sd/counts.json"
    if [ -z "$MIN_MS" ] || [ "$a" -lt "$MIN_MS" ]; then MIN_MS=$a; fi
    if [ -z "$MAX_MS" ] || [ "$b" -gt "$MAX_MS" ]; then MAX_MS=$b; fi
  done
  if [ -n "$MIN_MS" ]; then
    DAYS=$(python3 -c 'import sys,datetime as d; z=d.timezone(d.timedelta(hours=9)); a,b=(d.datetime.fromtimestamp(int(x)/1000,z).date() for x in sys.argv[1:3]); print(" ".join(str(a+d.timedelta(days=i)) for i in range((b-a).days+1)))' "$MIN_MS" "$MAX_MS")
    {
      printf '['
      sep=''
      for day in $DAYS; do
        ch=$(chq "SELECT count() FROM plc.tag_raw WHERE toDate(ts, 'Asia/Seoul') = toDate('$day')")
        pg=$(pgq "SELECT count(*) FROM plc_tag_raw_control WHERE ts >= timestamptz '$day 00:00:00+09' AND ts < timestamptz '$day 00:00:00+09' + interval '1 day'")
        printf '%s{"day": "%s", "tagRaw": %s, "control": %s, "match": %s}' "$sep" "$day" "$ch" "$pg" "$([ "$ch" = "$pg" ] && echo true || echo false)"
        sep=', '
      done
      printf ']\n'
    } > "$ST/daily-count.json"
  fi
  # 실패 배치의 ts 범위 — worker 구조화 로그 control_copy_failed(무효 구간의 원천)
  docker logs "$WK_NAME" 2>&1 | grep control_copy_failed > "$ST/copy-failures.log" || true
  stats_once > "$ST/load-end"
  stack_down
  kv_set open 0
  echo "── 정지 · 소진 ${S}초 · KST 일 대조 $(cat "$ST/daily-count.json" 2>/dev/null || echo '[]') · COPY 실패 이벤트 $(wc -l < "$ST/copy-failures.log" | tr -d ' ')건"
  ;;
collect)
  REP=${2:?반복 번호}
  OUT=${3:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" != 1 ] || { echo "열린 반복이 있다 — stop 먼저" >&2; exit 1; }
  emit exp45 "$OUT"
  ;;
table)
  IN=${2:?원시 jsonl}
  OUT=${3:?출력 jsonl}
  python3 "$S5_LOAD/_rec.py" exp45-stream-steps "$IN" "$OUT"
  ;;
reset)
  REP=${2:?반복 번호}
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  rm -rf "$ST"; echo "삭제: $ST"
  ;;
*) echo "하위 명령: start|step|drain|stop|collect|table|reset" >&2; exit 1 ;;
esac
