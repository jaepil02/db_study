#!/usr/bin/env bash
# AC-13 TTL 삭제 반복 1회 — 기록 015의 한 팔. 모드 D(GEN-08)는 S5라 보존 밖 ts의 행을 스크립트가 tag_raw에 직접 넣는다(계획 판정 2).
# ① 복원 ② 보존(7일) 밖 10일 전 ts 행 삽입 ③ 그 일자 파티션의 active 파트가 system.parts에서 사라질 때까지 5초 간격 관찰(상한 600초)
# ④ system.part_log의 병합 사유(TTLDropMerge) · system.mutations 0건 확인. api는 띄우지 않는다 — 다른 적재가 파티션에 섞이지 않게.
# 사용: scripts/lab/s3/ac13-ttl.sh <출력 JSON 줄 파일> <스냅샷> <반복 번호> [행 수=10000]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
SNAP=${2:?스냅샷}
REP=${3:?반복 번호}
ROWS=${4:-10000}
echo "── rep $REP · 복원 $SNAP"
restore_snap "$SNAP"
MUT0=$(chq "SELECT count() FROM system.mutations WHERE database = 'plc'")
T0=$(date +%s)
chq "INSERT INTO plc.tag_raw (ts, device_id, tag_id, value, quality, scan_seq)
     SELECT now64(3) - INTERVAL 10 DAY + number / 100, 1, 1 + number % 8, number, 0, number FROM numbers($ROWS)"
PART=$(chq "SELECT toYYYYMMDD(now() - INTERVAL 10 DAY)")
INSERTED=$(chq "SELECT sum(rows) FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND partition = '$PART' AND active")
echo "── 파티션 $PART · 삽입 $INSERTED 행 · 관찰"
ROWS_ZERO_AT=""; GONE_AT=""
for _ in $(seq 1 120); do
  R=$(chq "SELECT count(), sum(rows) FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND partition = '$PART' AND active")
  N=${R%%$'\t'*}; S=${R##*$'\t'}
  if [ -z "$ROWS_ZERO_AT" ] && [ "$S" = 0 ]; then ROWS_ZERO_AT=$(( $(date +%s) - T0 )); fi
  if [ "$N" = 0 ]; then GONE_AT=$(( $(date +%s) - T0 )); break; fi
  sleep 5
done
REASONS=$(chq "SELECT groupUniqArray(toString(merge_reason)) FROM system.part_log WHERE database = 'plc' AND table = 'tag_raw' AND partition_id = '$PART' AND event_type = 'MergeParts'")
MUT1=$(chq "SELECT count() FROM system.mutations WHERE database = 'plc'")
printf '{"rep":%s,"snapshot":"%s","partition":"%s","inserted":%s,"rowsZeroAfterS":%s,"partitionGoneAfterS":%s,"mergeReasons":%s,"mutationsBefore":%s,"mutationsAfter":%s}\n' \
  "$REP" "$SNAP" "$PART" "${INSERTED:-0}" "${ROWS_ZERO_AT:-null}" "${GONE_AT:-null}" "$(echo "$REASONS" | tr "'" '"')" "$MUT0" "$MUT1" | tee -a "$OUT"
[ -n "$GONE_AT" ] && [ "$MUT1" = "$MUT0" ] && [ "$MUT1" = 0 ]
