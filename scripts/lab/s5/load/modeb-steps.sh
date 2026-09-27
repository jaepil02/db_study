#!/usr/bin/env bash
# 모드 B 계단 러너 — EXP-23 Ramp-up 모드 B(exp23b) · EXP-26 Breakpoint(exp26) · EXP-30 지연 예산 모드 B(exp30b · M 계단 하나)
# 부하 모양 정본 05_load_scenarios(Ramp-up · Breakpoint · 판정 창 · 생성기 포화 판정) · 조정값 S5 판정 5 · 6:
#   계단 = 전환 60초 + 판정 창 180초 · Ramp-up S 250 → M 10k → 20k → 50k → M+ 100k(꺾인 두 계단 사이 로그 중점 한 번 더)
#   Breakpoint 10k → 20k → 50k → 100k → 200k(M 시드) → 500k(L 시드 · 10분 상한) · 첫 실패 계단 + 한 계단에서 멈춘다(리드 판단 — step 출력의 signals)
# 구성: api(APP_ROLE api) + worker(적재) + datagen 컨테이너(모드 B · cpuset 11-12) — 조회 부하 없음
# 한 반복 = 세그먼트 하나 이상(시드 모양이 다른 계단은 세그먼트를 바꾼다 — S · L은 복원이 다르다):
#   start(복원 · 기준선 · 기동) → step × N → [drain] → stop(소진 · 계단별 E2E · 무손실 판독 · 정지) → (다음 세그먼트 start …) → collect(원시 한 줄)
# 사용:
#   modeb-steps.sh start   <exp23b|exp26|exp30b> <반복> <S|M|L>                   ~6.5분(기준선 BASE_S=300)
#   modeb-steps.sh step    <exp> <반복> <pps> [전환 초=60] [창 초=180]            ~4.3분
#   modeb-steps.sh mid     <exp> <반복> <pps_a> <pps_b>                           로그 중점 pps 출력만(부하 없음)
#   modeb-steps.sh drain   <exp> <반복> [상한 초=480]                             적체 소진 대기만
#   modeb-steps.sh stop    <exp> <반복> [소진 상한 초=300]                        소진 확인 → 판독 → 정지(소진 안 되면 멈추고 1 · FORCE=1이면 그대로 판독)
#   modeb-steps.sh collect <exp> <반복> <출력 jsonl>
#   modeb-steps.sh reset   <exp> <반복>                                           상태 디렉터리 삭제(반복을 처음부터)
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|step|mid|drain|stop|collect|reset}
EXP=${2:?exp23b|exp26|exp30b}
REP=${3:?반복 번호}
case "$EXP" in exp23b|exp26|exp30b) ;; *) echo "exp23b · exp26 · exp30b" >&2; exit 1 ;; esac
ARM=steps

case "$CMD" in
start)
  TIER=${4:?S|M|L}
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  if [ -d "$ST/kv" ]; then
    rep_resume "$EXP" "$REP" "$ARM"
    [ "$(kv_get open)" != 1 ] || { echo "열린 세그먼트가 있다 — stop 먼저" >&2; exit 1; }
    require_clean
    [ "$HASH" = "$(kv_get commit)" ] || { echo "커밋이 반복 첫 세그먼트와 다르다" >&2; exit 1; }
  else
    begin_rep "$EXP" "$REP" "$ARM"
  fi
  export CAPACITY_TIER=$TIER
  env_save
  SEG=$(( $(find "$ST" -maxdepth 1 -name 'segment-*.json' | wc -l | tr -d ' ') + 1 ))
  kv_set seg "$SEG"; kv_set segTier "$TIER"; kv_set open 1
  kv_append segSteps.$SEG ""
  echo "── $EXP rep $REP 세그먼트 $SEG · 티어 $TIER · 복원 $(snap_for_tier "$TIER") · 기준선 ${BASE_S}초"
  rep_head "$(snap_for_tier "$TIER")" b
  # 세그먼트마다 health · 기준선을 따로 둔다 — 원시 줄 머리의 run · switches는 첫 세그먼트 값(세그먼트 값은 segments에)
  cp "$ST/health.json" "$ST/health-seg$SEG.json"; cp "$ST/baseline" "$ST/baseline-seg$SEG"
  [ "$SEG" = 1 ] || { cp "$ST/health-seg1.json" "$ST/health.json"; cp "$ST/baseline-seg1" "$ST/baseline"; }
  echo "── 기동 완료 — step <pps>로 계단을 건다"
  ;;
step)
  PPS=${4:?pps}
  TRANS=${5:-60}
  WIN=${6:-180}
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" = 1 ] || { echo "열린 세그먼트가 없다 — start 먼저" >&2; exit 1; }
  SEGTIER=$(kv_get segTier)
  TIER=$(tier_for_pps "$PPS")
  # L 세그먼트 위의 계단은 시드 모양이 L이다 — 로그 중점 정밀화(예: 250k · 초당 시점 5)도 L 시드 · --pps로 돈다
  [ "$SEGTIER" != L ] || TIER=L
  # 시드 모양 대조 — M+는 M 시드 · 그 밖은 세그먼트 티어와 같아야 한다(모드 B가 tag_master 모양을 대조해 거부한다)
  case "$TIER:$SEGTIER" in
    M+:M|M:M|S:S|L:L) ;;
    *) echo "pps $PPS(티어 $TIER)는 세그먼트 시드 $SEGTIER 위에서 돌 수 없다" >&2; exit 1 ;;
  esac
  step_dir_new "$PPS"
  kv_append "segSteps.$(kv_get seg)" "$SD"
  meta_set label "$PPS"; meta_set tier "$TIER"; meta_set pps "$PPS"; meta_set transS "$TRANS"; meta_set winS "$WIN"
  # 앞 계단 ts 범위와 겹치지 않게 — 모드 B 첫 틱의 ts는 기동 시각 − 1초까지 내려간다
  sleep 2
  echo "── $EXP rep $REP 계단 $PPS pps(티어 $TIER) · 전환 ${TRANS}초 + 창 ${WIN}초"
  dg_start "$SD/modeb.json" "$TIER" "$PPS" $(( TRANS + WIN + 5 ))
  meta_set launchMs "$(kv_get "dg.modeb.json.launchMs")"
  sample_run "$TRANS" "$SD/trans.samples" "$SD/stats"
  snap_all "$SD/m0"; meta_set winStartMs "$(ms_now)"
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  snap_all "$SD/m1"; meta_set winEndMs "$(ms_now)"
  dg_wait "$SD/modeb.json"
  meta_set exitMs "$(kv_get "dg.modeb.json.exitMs")"
  python3 "$S5_LOAD/_rec.py" step-summary "$SD"
  ;;
mid)
  A=${4:?pps_a}
  B=${5:?pps_b}
  rep_resume "$EXP" "$REP" "$ARM"
  M=$(log_mid_pps "$A" "$B" "$(tags_for_tier "$(kv_get segTier)")")
  if [ -z "$M" ]; then echo "두 계단 사이에 유효 pps가 없다(초당 시점 수는 1,000의 약수 정수) — 중점 계단 불가로 기록" >&2; exit 2; fi
  echo "$M"
  ;;
drain)
  rep_resume "$EXP" "$REP" "$ARM"
  S=$(drain_wait "${4:-480}")
  echo "소진 ${S}초(-1 = 상한 초과)"
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" = 1 ] || { echo "열린 세그먼트가 없다" >&2; exit 1; }
  SEG=$(kv_get seg)
  S=$(drain_wait "${4:-300}")
  if [ "$S" = -1 ] && [ "${FORCE:-0}" != 1 ]; then echo "적체가 소진되지 않았다 — drain을 더 부르거나 FORCE=1(미소진으로 기록)" >&2; exit 1; fi
  DRAIN_S=$S
  chq "SYSTEM FLUSH LOGS" >/dev/null
  # 계단별 판독 — E2E(판정 창 ts · quantilesExact) · 무손실(기동 − 1초 ~ 종료 범위 행 수 대 발행 포인트)
  while IFS= read -r sd; do
    [ -n "$sd" ] || continue
    e2e_json "$(meta_get winStartMs "$sd")" "$(meta_get winEndMs "$sd")" > "$sd/e2e.json"
    rows_between $(( $(meta_get launchMs "$sd") - 1000 )) "$(meta_get exitMs "$sd")" > "$sd/rows"
  done < "$ST/kv/segSteps.$SEG"
  DUP=null
  if [ "${DUPCHECK:-0}" = 1 ]; then DUP=$(dup_json); fi
  PARTS=$(parts_json)
  TOTAL=$(rows_total)
  stats_once > "$ST/load-seg$SEG"
  stack_down
  python3 - "$ST" "$SEG" "$(kv_get segTier)" "$(kv_get snapshot)" "$DRAIN_S" "$TOTAL" "$PARTS" "$DUP" "$(iso_now)" > "$ST/segment-$SEG.json" <<'PY'
import json, sys
st, seg, tier, snap, drain, total, parts, dup, end = sys.argv[1:10]
rd = lambda p: open(p).read()
print(json.dumps({'segment': int(seg), 'tier': tier, 'snapshot': snap, 'drainS': int(drain), 'drained': drain != '-1',
                  'tagRawTotal': int(total), 'activeParts': json.loads(parts), 'ac02': json.loads(dup), 'endAt': end,
                  'health': json.loads(rd(f'{st}/health-seg{seg}.json') or 'null'), 'baseline': rd(f'{st}/baseline-seg{seg}').splitlines()},
                 ensure_ascii=False))
PY
  kv_set open 0
  cat "$ST/segment-$SEG.json"
  ;;
collect)
  OUT=${4:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  [ "$(kv_get open)" != 1 ] || { echo "열린 세그먼트가 있다 — stop 먼저" >&2; exit 1; }
  emit modeb-steps "$OUT"
  ;;
reset)
  ST="$STATE_ROOT/$EXP-r$REP-$ARM"
  rm -rf "$ST"; echo "삭제: $ST"
  ;;
*) echo "하위 명령: start|step|mid|drain|stop|collect|reset" >&2; exit 1 ;;
esac
