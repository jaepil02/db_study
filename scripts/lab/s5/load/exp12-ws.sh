#!/usr/bin/env bash
# EXP-12 S5 — SW-07 프레임 폭증 · WebSocket 연결 수백 계단 · 티어 M+ 10 Hz(M 시드 + scan_rate 100) · 팔 SW-07 100 | 0
# 구성: APP_ROLE all + 모드 A(S4 판정 13 — EXP-11과 같은 구성) · k6 ws(cpuset 11-12)
# 판정 지표(06_experiment_catalog EXP-12): 연결당 초당 프레임 · 이벤트 루프 지연 p95 · 4413 절단 수 · 동시 연결 상한
#   계단마다 ws_frames_sent_total{channel="rt"} 차 ÷ ws_connections ÷ 창 초 · nodejs_eventloop_lag_p95_seconds(창 끝) · ws_closes_total{4413} 차
#   동시 연결 상한 — 서버 게이지 ws_connections가 목표 연결을 다 가진 가장 큰 계단 · k6 ws_connect_failed(연결 실패)
# 사용:
#   exp12-ws.sh start   <반복> <100|0>                     복원(M+ 시드) · 기준선 · 기동 ~7분
#   exp12-ws.sh steps   <반복> <팔> "<연결 수 …>" [창 초=60]  계단 여럿 한 번에(Σ(5 + 창) + 여유 ≤ 540초) — 예 "100 200 400"
#   exp12-ws.sh stop    <반복> <팔>
#   exp12-ws.sh collect <반복> <팔> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?start|steps|stop|collect}
REP=${2:?반복}
ARM=${3:?100|0}
EXP=exp12
SNAP_MPLUS=${SNAP_MPLUS:-s5-m-sr100}

case "$CMD" in
start)
  case "$ARM" in 100|0) ;; *) echo "팔은 100 · 0(WS_THROTTLE_MS)" >&2; exit 1 ;; esac
  [ -e "snapshots/$SNAP_MPLUS" ] || { echo "스냅샷 없음: $SNAP_MPLUS — modea-steps.sh prep M+" >&2; exit 1; }
  begin_rep "$EXP" "$REP" "$ARM"
  export CAPACITY_TIER=M+ WS_THROTTLE_MS=$ARM
  env_save
  echo "── $EXP rep $REP 팔 SW-07=$ARM · 복원 $SNAP_MPLUS · 기준선 ${BASE_S}초"
  rep_head "$SNAP_MPLUS" a
  sleep 20
  ;;
steps)
  LIST=${4:?"연결 수 목록"}
  WIN=${5:-60}
  rep_resume "$EXP" "$REP" "$ARM"
  STAGES=""; TOTAL=0
  for c in $LIST; do STAGES="$STAGES${STAGES:+,}$c:5,$c:$WIN"; TOTAL=$(( TOTAL + 5 + WIN )); done
  [ "$TOTAL" -le 520 ] || { echo "계단 합 ${TOTAL}초 — 호출 10분 미만을 넘는다 · 계단을 나눠 부른다" >&2; exit 1; }
  echo "── $EXP rep $REP 팔 $ARM · 계단 $LIST · 창 ${WIN}초"
  K6N="k6-ws-${LIST// /-}"
  k6_start k6-ws.js "$K6N" -e STAGES="$STAGES" -e HOLD=$(( TOTAL + 20 )) -e DEVICES=5 -e NDEV=50
  for c in $LIST; do
    step_dir_new "$c"
    meta_set target "$c"; meta_set winS "$WIN"
    sleep 5
    snap_all "$SD/m0"; meta_set winStartMs "$(ms_now)"
    T=$(date +%s)
    until [ $(( $(date +%s) - T )) -ge "$WIN" ]; do stats_once >> "$SD/stats"; sleep 8; done
    snap_all "$SD/m1"; meta_set winEndMs "$(ms_now)"
    printf '연결 %s · 서버 ws_connections %s · 이벤트 루프 p95 %s\n' "$c" "$(mval "$SD/m1.api" ws_connections)" "$(mval "$SD/m1.api" nodejs_eventloop_lag_p95_seconds)"
  done
  k6_wait "$K6N" || true
  ;;
stop)
  rep_resume "$EXP" "$REP" "$ARM"
  stats_once > "$ST/load-end"
  api_stop
  ;;
collect)
  OUT=${4:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit ws "$OUT"
  ;;
*) echo "하위 명령: start|steps|stop|collect" >&2; exit 1 ;;
esac
