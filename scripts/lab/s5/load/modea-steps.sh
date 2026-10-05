#!/usr/bin/env bash
# 모드 A 계단 러너 — EXP-23 Ramp-up 모드 A(exp23a) · EXP-27 확장 진입 판정(exp27 · 고정 k6 조회) · EXP-30 지연 예산 모드 A(exp30a · M 계단 하나)
# 구성: APP_ROLE all 하나(SIM · 모드 A · Collector · Ingest · 조회 — 모드 A는 collector와 동거 필수 · ADR-22)
# 계단(S5 판정 6): S → M 1 Hz → 2 Hz → 5 Hz → M+ 10 Hz · scan_rate는 시드 옵션(--scan-rate)이라 계단마다 그 시드 스냅샷을 복원하고 재기동한다.
#   계단 키  스냅샷(기본)           CAPACITY_TIER  scan_rate_ms
#   S        s3-empty-s             S              1000
#   M        s3-empty-m             M              1000
#   M2       s5-m-sr500             M              500   (M 시드 · 초당 20,000 포인트)
#   M5       s5-m-sr200             M              200   (M 시드 · 초당 50,000 포인트)
#   M+       s5-m-sr100             M+             100   (M 시드 + 100 — 인터페이스 §시드 옵션)
# 계단 하나 = 복원 → 기동 → 전환 60초 → 판정 창 180초(exp27은 창 동안 k6 조회 혼합 고정 도착률 · exp30a는 ws 연결 10 — 발행 → 수신 계측의 구독자) → 정상 종료(드레인) → s3-verify(무손실 · E2E)
# 모드 A 무손실(S2 판정)은 정지 뒤 Stream 전 엔트리 디코딩 포인트 − tag_raw 행이다 — 계단마다 빈 Stream에서 시작하므로 트리밍(entries-added ≠ XLEN)이 없을 때 성립
# 사용:
#   modea-steps.sh prep     <M2|M5|M+>                              시드 스냅샷 준비(없을 때만 · 리드가 한 번)
#   modea-steps.sh baseline <exp23a|exp27|exp30a> <반복>            새 반복 · 기준선(저장소 유휴 BASE_S=300 · api 없음)  ~6분
#   modea-steps.sh step     <exp> <반복> <S|M|M2|M5|M+> [전환=60] [창=180]   ~7.5분(M+는 verify가 길다 — 창을 줄이지 말고 VERIFY_P95 끄기)
#   modea-steps.sh collect  <exp> <반복> <출력 jsonl>
source "$(dirname "$0")/../_lib.sh"
CMD=${1:?prep|baseline|step|collect}
ARM=steps

step_conf() { # 계단 키 → 스냅샷 · 티어 · scan_rate
  case "$1" in
    S) echo "$SNAP_S S 1000" ;;
    M) echo "$SNAP_M M 1000" ;;
    M2) echo "${SNAP_M2:-s5-m-sr500} M 500" ;;
    M5) echo "${SNAP_M5:-s5-m-sr200} M 200" ;;
    M+) echo "${SNAP_MPLUS:-s5-m-sr100} M+ 100" ;;
    *) echo "계단 키 S · M · M2 · M5 · M+" >&2; exit 1 ;;
  esac
}

case "$CMD" in
prep)
  KEY=${2:?M2|M5|M+}
  read -r SNAP _ SR <<< "$(step_conf "$KEY")"
  prep_seed_snap "$SNAP" --tier M --scan-rate "$SR"
  ;;
baseline)
  EXP=${2:?exp}; REP=${3:?반복}
  begin_rep "$EXP" "$REP" "$ARM"
  env_save
  echo "── $EXP rep $REP 기준선 ${BASE_S}초(복원 $SNAP_M · api 없음)"
  restore_snap "$SNAP_M"
  store_resources_check
  kv_set baselineStart "$(iso_now)"
  baseline "$BASE_S" "$ST/baseline"
  kv_set baselineEnd "$(iso_now)"
  kv_set lagSrc api
  ;;
step)
  EXP=${2:?exp}; REP=${3:?반복}; KEY=${4:?S|M|M2|M5|M+}
  TRANS=${5:-60}; WIN=${6:-180}
  rep_resume "$EXP" "$REP" "$ARM"
  read -r SNAP TIER SR <<< "$(step_conf "$KEY")"
  [ -e "snapshots/$SNAP" ] || { echo "스냅샷 없음: $SNAP — modea-steps.sh prep $KEY" >&2; exit 1; }
  export CAPACITY_TIER=$TIER
  step_dir_new "$KEY"
  meta_set label "$KEY"; meta_set tier "$TIER"; meta_set scanRateMs "$SR"; meta_set snapshot "$SNAP"; meta_set transS "$TRANS"; meta_set winS "$WIN"
  meta_set pps $(( $(tags_for_tier "$TIER") * 1000 / SR ))
  echo "── $EXP rep $REP 계단 $KEY(티어 $TIER · scan ${SR} ms) · 복원 $SNAP"
  restore_snap "$SNAP"
  store_resources_check
  stack_up_a
  curl -s http://127.0.0.1:13000/api/v1/health > "$SD/health.json"
  [ -s "$ST/health.json" ] || cp "$SD/health.json" "$ST/health.json"
  meta_set launchMs "$(ms_now)"
  sample_run "$TRANS" "$SD/trans.samples" "$SD/stats"
  snap_all "$SD/m0"; meta_set winStartMs "$(ms_now)"; WS=$(iso_now)
  if [ "$EXP" = exp27 ]; then
    kv_set k6Script k6-mix.js; kv_set k6Rates "latest=${RATE_LATEST:-20} ts=${RATE_TS:-5} master=${RATE_MASTER:-1}"
    K6_RAW=1 k6_start k6-mix.js "steps/$(basename "$SD")/q" -e DURATION="${WIN}s" \
      -e RATE_LATEST="${RATE_LATEST:-20}" -e RATE_TS="${RATE_TS:-5}" -e RATE_MASTER="${RATE_MASTER:-1}"
  fi
  if [ "$EXP" = exp30a ]; then
    # 발행 → 수신(EXP-30) — 게이트웨이가 발행을 받으려면 구독자가 있어야 한다 · S4 k6-ws.js와 같은 방식으로 ws 10개를 창 동안 붙인다
    k6_start k6-ws.js "steps/$(basename "$SD")/ws" -e STAGES="10:3,10:$WIN" -e HOLD=$(( WIN + 5 )) -e DEVICES=5 -e NDEV=50
  fi
  sample_run "$WIN" "$SD/win.samples" "$SD/stats"
  if [ "$EXP" = exp27 ]; then k6_wait q; fi
  if [ "$EXP" = exp30a ]; then k6_wait ws || true; fi
  snap_all "$SD/m1"; meta_set winEndMs "$(ms_now)"; WE=$(iso_now)
  api_stop
  meta_set exitMs "$(ms_now)"
  docker exec db_study-redis-1 redis-cli XINFO STREAM stream:plc:raw 2>/dev/null \
    | awk 'p{print; exit} $0=="entries-added"{p=1}' > "$SD/.added" || true
  printf '{"entriesAdded":%s,"length":%s}\n' "$(cat "$SD/.added" 2>/dev/null || echo null)" \
    "$(docker exec db_study-redis-1 redis-cli XLEN stream:plc:raw 2>/dev/null || echo null)" > "$SD/xinfo.json"
  verify --phase stopped --window-start "$WS" --window-end "$WE" > "$SD/verify.json" || echo "verify: 랙이 0이 아니다(verify.json lagZero)" >&2
  python3 - "$SD" <<'PY'
import json, sys
d = sys.argv[1]
v = json.load(open(f'{d}/verify.json'))
print(json.dumps({'lagZero': v.get('lagZero'), 'ac01diff': v.get('ac01', {}).get('diff'), 'e2e': v.get('e2e'), 'xinfo': json.load(open(f'{d}/xinfo.json'))}, ensure_ascii=False))
PY
  ;;
collect)
  EXP=${2:?exp}; REP=${3:?반복}; OUT=${4:?출력 jsonl}
  rep_resume "$EXP" "$REP" "$ARM"
  emit modea-steps "$OUT"
  ;;
*) echo "하위 명령: prep|baseline|step|collect" >&2; exit 1 ;;
esac
