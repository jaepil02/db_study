#!/usr/bin/env bash
# EXP-37 S5 — 모드 C 수집 상한(k6 bulk · 무인증 · S7 기록과 비교하지 않는다) · M 계단 · 503 별도 계수 · 요청당 엔트리 수 = 조건(팔)
# 구성: api(APP_ROLE api · DATAGEN_BULK_ENABLED=true — 기동 경고 1줄) + worker(적재) · k6(cpuset 11-12) · 조회 부하 없음(모드 C 실험은 k6 조회를 끈다)
# 계단 = 전환 60초 + 판정 창 180초(S5 판정 5와 같은 폭) · pps는 M 시드 위 태그 10,000 × 초당 시점(정수 ms 주기 — 10k · 20k · 50k · 100k · 200k …)
# 판정 지표(06_experiment_catalog EXP-37): 수락 pps 상한 · 503 거절 수 · 오류율(설계 거절 제외) — 생성기 판정 ②는 k6 dropped_iterations 0 · ③은 k6 컨테이너 CPU
# 무손실: k6가 센 수락 행(202 acceptedRows + 503 부분 수용) 대 tag_raw 범위 행 — 범위 = [k6 기동 − 격자 후퇴(SHIFT) − 1초, 종료]
# 사용:
#   exp37-bulk.sh start   <반복> <요청당 엔트리 E>             복원 · 기준선 · 기동 · 게이트 확인 ~6.5분
#   exp37-bulk.sh step    <반복> <E> <pps> [전환=60] [창=180]  ~4.3분
#   exp37-bulk.sh drain   <반복> <E> [상한=480]
#   exp37-bulk.sh stop    <반복> <E>                            소진 → 계단별 E2E · 무손실 → 정지
#   exp37-bulk.sh collect <반복> <E> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|step|drain|stop|collect}
REP=${2:?반복}
E=${3:?요청당 엔트리}
EXP=exp37
ARM="e$E"
ROUTE=/api/v1/ingest/bulk

case "$CMD" in
start)
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M DATAGEN_BULK_ENABLED=true
  env_save
  kv_set entries "$E"
  echo "── $EXP rep $REP 요청당 엔트리 $E · 복원 $SNAP_M · 기준선 ${BASE_S}초"
  rep_head "$SNAP_M" b
  # 게이트 확인 — 빈 본문은 400(라우트 있음) · 404면 게이트가 꺼진 기동
  C=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{}' "http://127.0.0.1:3000$ROUTE")
  [ "$C" = 400 ] || { echo "bulk 표면 확인 실패(HTTP $C) — DATAGEN_BULK_ENABLED=true 기동인가" >&2; exit 1; }
  docker logs db_study-api-1 2>&1 | grep -m1 -i 'DATAGEN_BULK_ENABLED' > "$ST/gate-warning" || true
  ;;
step)
  PPS=${4:?pps}; TRANS=${5:-60}; WIN=${6:-180}
  rep_resume "$EXP" "$REP" "$ARM"
  SHIFT_S=$(python3 -c "import math; hz=$PPS/10000; print(math.ceil($E/50/hz))")
  step_dir_new "$PPS"
  meta_set label "$PPS"; meta_set tier M; meta_set pps "$PPS"; meta_set entries "$E"; meta_set transS "$TRANS"; meta_set winS "$WIN"; meta_set shiftS "$SHIFT_S"
  # 앞 계단 ts 범위와 겹치지 않게 — k6 격자는 기동 시각보다 SHIFT초 뒤로 물린다
  sleep $(( SHIFT_S + 2 ))
  echo "── $EXP rep $REP 계단 $PPS pps · 엔트리 $E/요청 · 전환 ${TRANS}초 + 창 ${WIN}초"
  meta_set launchMs "$(ms_now)"
  k6_start k6-bulk.js "steps/$(basename "$SD")/k6" -e PPS="$PPS" -e ENTRIES="$E" -e DURATION="$(( TRANS + WIN ))s"
  sample_run "$TRANS" "$SD/trans.samples" "$SD/stats"
  snap_all "$SD/m0"; meta_set winStartMs "$(ms_now)"
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  snap_all "$SD/m1"; meta_set winEndMs "$(ms_now)"
  k6_wait k6 || true
  meta_set exitMs "$(ms_now)"
  python3 - "$SD/k6.json" "$SD/meta" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))['metrics']
g = lambda n: (m.get(n) or {}).get('count', 0)
with open(sys.argv[2], 'a') as f:
    f.write(f"acceptedRows={g('bulk_accepted_rows')}\n")
print(json.dumps({'202': g('bulk_202'), '503': g('bulk_503'), '4xx': g('bulk_4xx'), 'other': g('bulk_other'),
                  'acceptedRows': g('bulk_accepted_rows'), 'sentRows': g('bulk_sent_rows'), 'dropped': g('dropped_iterations'),
                  'bodyBytesMax': (m.get('bulk_body_bytes') or {}).get('max')}, ensure_ascii=False))
PY
  python3 "$S5_LOAD/_rec.py" step-summary "$SD"
  ;;
drain)
  rep_resume "$EXP" "$REP" "$ARM"
  echo "소진 $(drain_wait "${4:-480}")초(-1 = 상한 초과)"
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  S=$(drain_wait 300)
  [ "$S" != -1 ] || [ "${FORCE:-0}" = 1 ] || { echo "적체 미소진 — drain 또는 FORCE=1" >&2; exit 1; }
  kv_set drainS "$S"
  chq "SYSTEM FLUSH LOGS" >/dev/null
  for sd in "$ST"/steps/*; do
    e2e_json "$(meta_get winStartMs "$sd")" "$(meta_get winEndMs "$sd")" > "$sd/e2e.json"
    rows_between $(( $(meta_get launchMs "$sd") - $(meta_get shiftS "$sd") * 1000 - 1000 )) "$(meta_get exitMs "$sd")" > "$sd/rows"
  done
  stats_once > "$ST/load-end"
  stack_down
  printf '{"segment":1,"tier":"M","snapshot":"%s","drainS":%s,"drained":%s,"tagRawTotal":%s}\n' "$(kv_get snapshot)" "$S" "$([ "$S" = -1 ] && echo false || echo true)" "$(rows_total)" > "$ST/segment-1.json"
  ;;
collect)
  OUT=${4:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit bulk "$OUT"
  ;;
*) echo "하위 명령: start|step|drain|stop|collect" >&2; exit 1 ;;
esac
