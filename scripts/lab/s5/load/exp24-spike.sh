#!/usr/bin/env bash
# EXP-24 Spike — M 10,000 → 10배 100,000 pps 120초 → M · 적체 최대 · 도달 단계 · 복구 시간 · 무손실(S5 판정 5)
# 판정 창(05_load_scenarios): 스파이크 시작 ~ 적체 복귀 전체 — 과도 구간이 측정 대상이라 빼지 않는다.
# 스파이크 지속 120초 < M → 10배의 위험 임계 도달 약 6분(흡수 관찰 · 스풀을 재지 않는다). 적체 복귀는 최대 15분 관찰.
# 구성: api(APP_ROLE api) + worker + datagen 컨테이너(모드 B). 세 국면은 모드 B 실행 셋을 잇는다(국면 사이 2초 — 앞 국면 ts와 겹치지 않게):
#   pre   M 10,000 pps 포그라운드 PRE초
#   spike M+ 100,000 pps 포그라운드 SPIKE초(M 시드 · 초당 시점 10)
#   post  M 10,000 pps 호출을 넘어 사는 컨테이너 RECOVER초(고정 지속 · 복귀 관찰 동안 M 부하 유지)
# 복귀 = consumer_lag가 pre 국면 최대(M 정상 상태의 in-flight 수준) 이하로 처음 돌아온 시각 · 복구 시간 = 복귀 − 스파이크 종료
# 사용:
#   exp24-spike.sh start   <반복>                                          복원 · 기준선 · 기동 ~6.5분
#   exp24-spike.sh spike   <반복> [pre=120] [spike=120] [post 표본=240]     ~8.3분 — 끝에 post 생성기(RECOVER=900초)가 남는다
#   exp24-spike.sh recover <반복> [상한 초=480]                            복귀까지 표본(이미 복귀했으면 즉시 끝) — 필요하면 반복 호출
#   exp24-spike.sh stop    <반복>                                          post 생성기 종료 대기 → 소진 → 국면별 무손실 → 정지
#   exp24-spike.sh collect <반복> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|spike|recover|stop|collect}
REP=${2:?반복}
EXP=exp24
ARM=spike
RECOVER=${RECOVER:-900}

# 복귀 판정 — 표본 파일 $1에서 스파이크 종료 뒤 lag ≤ 바닥인 첫 표본 시각(ms)
recovered_at() { # $1=표본 파일 $2=바닥 $3=스파이크 종료 epoch 초
  awk -v f="$2" -v t0="$3" '$1>=t0 && $2!="-" && $2+0<=f+0 {print $1*1000; exit}' "$1"
}

case "$CMD" in
start)
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M
  env_save
  echo "── $EXP rep $REP · 복원 $SNAP_M · 기준선 ${BASE_S}초"
  rep_head "$SNAP_M" b
  ;;
spike)
  PRE=${3:-120}; SPK=${4:-120}; POST=${5:-240}
  rep_resume "$EXP" "$REP" "$ARM"
  [ ! -d "$ST/phase-spike" ] || { echo "이미 스파이크를 걸었다 — 새 반복은 start부터" >&2; exit 1; }
  mkdir -p "$ST/phase-pre" "$ST/phase-spike" "$ST/phase-post" "$ST/phase-recover"
  echo "── pre M 10,000 pps ${PRE}초"
  SD="$ST/phase-pre"
  dg_start "$SD/modeb.json" M 10000 "$PRE"
  meta_set launchMs "$(kv_get dg.modeb.json.launchMs)"
  sample_run "$PRE" "$SD/samples" "$SD/stats"
  dg_wait "$SD/modeb.json"; meta_set exitMs "$(kv_get dg.modeb.json.exitMs)"
  sleep 2
  echo "── spike M+ 100,000 pps ${SPK}초"
  SD="$ST/phase-spike"
  dg_start "$SD/modeb.json" M+ 100000 "$SPK"
  meta_set launchMs "$(kv_get dg.modeb.json.launchMs)"
  sample_run "$SPK" "$SD/samples" "$SD/stats"
  dg_wait "$SD/modeb.json"; meta_set exitMs "$(kv_get dg.modeb.json.exitMs)"
  sleep 2
  echo "── post M 10,000 pps ${RECOVER}초(컨테이너) · 표본 ${POST}초"
  SD="$ST/phase-post"
  dg_bg_start post M 10000 "$RECOVER"
  meta_set launchMs "$(kv_get dg.post.launchMs)"
  sample_run "$POST" "$SD/samples" "$SD/stats"
  FLOOR=$(awk '$2!="-" && $2+0>m {m=$2+0} END{print m+0}' "$ST/phase-pre/samples")
  kv_set floor "$FLOOR"
  SPK_EXIT=$(( $(meta_get exitMs "$ST/phase-spike") / 1000 ))
  R=$(recovered_at "$SD/samples" "$FLOOR" "$SPK_EXIT")
  kv_set observedUntilMs "$(ms_now)"
  if [ -n "$R" ]; then kv_set recoveredAtMs "$R"; echo "복귀 — 바닥 $FLOOR · 스파이크 종료 뒤 $(( R / 1000 - SPK_EXIT ))초"; else echo "아직 복귀 전(바닥 $FLOOR) — recover를 부른다"; fi
  python3 - "$ST" <<'PY'
import sys
d = sys.argv[1]
for ph in ('pre', 'spike', 'post'):
    v = [float(l.split()[1]) for l in open(f'{d}/phase-{ph}/samples') if l.split()[1] != '-']
    print(ph, 'lag max', max(v) if v else None, 'last', v[-1] if v else None)
PY
  ;;
recover)
  MAX=${3:-480}
  rep_resume "$EXP" "$REP" "$ARM"
  if [ -n "$(kv_get recoveredAtMs)" ]; then echo "이미 복귀: $(kv_get recoveredAtMs)"; exit 0; fi
  FLOOR=$(kv_get floor)
  SPK_EXIT=$(( $(meta_get exitMs "$ST/phase-spike") / 1000 ))
  SD="$ST/phase-recover"
  END=$(( $(date +%s) + MAX ))
  while [ "$(date +%s)" -lt "$END" ]; do
    sample_run 10 "$SD/samples" "$SD/stats"
    R=$(recovered_at "$SD/samples" "$FLOOR" "$SPK_EXIT")
    if [ -n "$R" ]; then kv_set recoveredAtMs "$R"; break; fi
  done
  kv_set observedUntilMs "$(ms_now)"
  if [ -n "$(kv_get recoveredAtMs)" ]; then echo "복귀 — 스파이크 종료 뒤 $(( $(kv_get recoveredAtMs) / 1000 - SPK_EXIT ))초"
  else echo "미복귀 — 관찰 $(( $(date +%s) - SPK_EXIT ))초(15분 상한까지 recover 반복 · 그 뒤 stop)"; fi
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  dg_bg_collect post 540
  S=$(drain_wait 300)
  kv_set drainS "$S"
  [ "$S" != -1 ] || [ "${FORCE:-0}" = 1 ] || { echo "적체 미소진 — stop을 다시 부르거나 FORCE=1" >&2; exit 1; }
  printf 'exitMs=%s\n' "$(kv_get dg.post.exitMs)" >> "$ST/phase-post/meta"
  cp "$ST/post.modeb" "$ST/phase-post/modeb.json"
  for ph in pre spike post; do
    rows_between $(( $(meta_get launchMs "$ST/phase-$ph") - 1000 )) "$(meta_get exitMs "$ST/phase-$ph")" > "$ST/phase-$ph/rows"
  done
  stats_once > "$ST/load-end"
  stack_down
  for ph in pre spike post; do printf '%s 발행 %s · 범위 행 %s\n' "$ph" "$(python3 -c "import json; print(json.load(open('$ST/phase-$ph/modeb.json'))['result']['publishedPoints'])")" "$(cat "$ST/phase-$ph/rows")"; done
  ;;
collect)
  OUT=${3:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit spike "$OUT"
  ;;
*) echo "하위 명령: start|spike|recover|stop|collect" >&2; exit 1 ;;
esac
