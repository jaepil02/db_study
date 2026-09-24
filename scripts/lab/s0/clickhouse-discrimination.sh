#!/usr/bin/env bash
# EXP-32 S0 저장소 판별 — docs/10_observability/06_experiment_catalog.md (기록 slug s0-store-discrimination)
# 판별 1 — MV 실패 · 같은 토큰 재시도에서 원시와 롤업이 어떻게 되는가(docs/06_pipeline/09_rollup.md ⓐ · ⓑ · ⓒ)
#   조건 C0 — 보강 전 계약: deduplicate_blocks_in_dependent_materialized_views 0 · 롤업 3테이블 중복 제거 윈도우 0
#             (현행 DDL · 프로파일을 ALTER · URL 설정으로 되돌려 재현한다)
#   조건 C1 — 현행 계약(ADR-14 보강): 프로파일의 같은 설정 1 · 롤업 DDL의 윈도우 1000 — 덮어쓰기 없이 그대로 쓴다
#   시나리오 S1 적재 측 거절 — tag_1m parts_to_throw_insert를 1로 낮춰 too many parts(INSERT 시작 시 1회 검사)
#   시나리오 S2 변환 중 예외 — 실습 전용 게이트 MV(mv_s0_gate)가 throwIf로 실패 · MV 실행 순서는 고정되지 않는다
#   시나리오 S3 성공 뒤 재시도 — 응답 유실(타임아웃)을 가정해 성공한 배치를 같은 토큰으로 다시 보낸다
#   쌍의 한쪽만 둔 조건(S3만) — CD: 설정 1 · 롤업 윈도우 0 · CW: 설정 0 · 롤업 윈도우 1000
#   백필 재실행 BF — 롤업을 비우고(mutation) 원시에서 tag_1m으로 INSERT SELECT를 두 번 한다(경로 B ④ · ⑤의 재실행)
#   async_insert 충돌 — 설정 1인 프로파일에서 async_insert 1 삽입이 거부되는가
#   중복 제거 여부는 query_log의 ProfileEvents DuplicatedInsertedBlocks로 센다(요약 헤더 written_rows는 쓰지 않는다)
# 판별 2 — 여러 블록으로 쪼개진 INSERT의 행이 같은 ingested_at을 받는가(09_rollup §롤업 공백 재계산 경로 A)
#   블록 수는 system.part_log의 NewPart 수(query_id별)로 센다 — 활성 파트 수는 백그라운드 머지로 줄어 쓸 수 없다
# 전제: 빈 볼륨(task restore NAME=s0-empty 직후). 사용: clickhouse-discrimination.sh <반복 번호>
source "$(dirname "$0")/_lib.sh"
REP=${1:?반복 번호}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cf "$(dirname "$0")/clickhouse-ddl.sql"
NOWMS=$(( $(date +%s) * 1000 ))

gen_rows() { # $1=device $2=tags $3=seconds $4=start_ms → JSONCompactEachRow [ts, device_id, tag_id, value, quality, scan_seq]
  python3 - "$@" <<'PY'
import sys, math
dev, tags, secs, start = map(int, sys.argv[1:5])
out = sys.stdout
for s in range(secs):
    ts = start + s * 1000
    for t in range(1, tags + 1):
        out.write('[%d,%d,%d,%.6f,9,%d]\n' % (ts, dev, t, 50 + 10 * math.sin(2 * math.pi * s / 60 + t), s))
PY
}
Q_INS="query=INSERT%20INTO%20plc.tag_raw%20(ts%2C%20device_id%2C%20tag_id%2C%20value%2C%20quality%2C%20scan_seq)%20FORMAT%20JSONCompactEachRow"
cnt_raw() { cq "SELECT count() FROM plc.tag_raw WHERE device_id = $1"; }
cnt_roll() { cq "SELECT countMerge(cnt) FROM plc.$1 WHERE device_id = $2"; }
dup_blocks() { cq "SYSTEM FLUSH LOGS" >/dev/null; cq "SELECT sum(ProfileEvents['DuplicatedInsertedBlocks']) FROM system.query_log WHERE query_id = '$1' AND type = 'QueryFinish'"; }
snap() { echo "raw=$(cnt_raw $1) m1=$(cnt_roll tag_1m $1) h1=$(cnt_roll tag_1h $1) d1=$(cnt_roll tag_1d $1)"; }

gate_on() { # 게이트 MV — tag_raw에 MV를 하나 더 붙인다(S2 동안만 · 실습 전용). 실행 순서가 고정되지 않아 tag_1m이 게이트보다 먼저 쓰일 수도 있다
  cq "CREATE TABLE plc.s0_gate (on UInt8) ENGINE = Memory"
  cq "CREATE TABLE plc.s0_gate_sink (x UInt8) ENGINE = Null"
  cq "CREATE MATERIALIZED VIEW plc.mv_s0_gate TO plc.s0_gate_sink AS SELECT toUInt8(throwIf((SELECT count() FROM plc.s0_gate) > 0, 's0 gate')) AS x FROM plc.tag_raw"
}
gate_off() { cq "DROP VIEW plc.mv_s0_gate"; cq "DROP TABLE plc.s0_gate_sink"; cq "DROP TABLE plc.s0_gate"; }
set_window() { for t in tag_1m tag_1h tag_1d; do cq "ALTER TABLE plc.$t MODIFY SETTING non_replicated_deduplication_window = $1"; done; }
wr_of() { echo "$1" | sed -n 's/.*written_rows=\([0-9a-z]*\).*/\1/p'; }

step "워밍업 — tag_1m 현재 월 파티션에 파트 하나(설비 900)"
gen_rows 900 8 60 $(( NOWMS - 3600000 )) > "$TMP/warm.json"
http_insert "$Q_INS&insert_deduplication_token=warm-r$REP" "$TMP/warm.json" | cut -c1-12

run_case() { # $1=조건 $2=시나리오 $3=설비
  local COND=$1 SC=$2 DEV=$3 TOK="exp32-r$REP-$1-$2" DMQ=""
  case $COND in C0|CW) DMQ="&deduplicate_blocks_in_dependent_materialized_views=0" ;; esac
  gen_rows $DEV 8 60 $(( NOWMS - 1800000 )) > "$TMP/b.json"
  local N; N=$(wc -l < "$TMP/b.json" | tr -d ' ')
  local URL="$Q_INS&insert_deduplication_token=$TOK$DMQ"
  step "$COND · $SC · 설비 $DEV · 행 $N"
  case $SC in
    S1) cq "ALTER TABLE plc.tag_1m MODIFY SETTING parts_to_delay_insert = 1, parts_to_throw_insert = 1" ;;
    S2) gate_on; cq "INSERT INTO plc.s0_gate VALUES (1)" ;;
  esac
  local R1; R1=$(http_insert "$URL&query_id=$TOK-a1" "$TMP/b.json"); echo "시도 1: ${R1:0:160}"
  local A1; A1=$(snap $DEV); echo "시도 1 뒤: $A1"
  case $SC in
    S1) cq "ALTER TABLE plc.tag_1m RESET SETTING parts_to_delay_insert, parts_to_throw_insert" ;;
    S2) cq "TRUNCATE TABLE plc.s0_gate" ;;
  esac
  local R2; R2=$(http_insert "$URL&query_id=$TOK-a2" "$TMP/b.json"); echo "시도 2: ${R2:0:160}"
  if [ "$SC" = S2 ]; then gate_off; fi
  local A2; A2=$(snap $DEV)
  local V; if [ "$A2" = "raw=$N m1=$N h1=$N d1=$N" ]; then V=exact; elif echo "$A2" | grep -q "=$(( N * 2 ))"; then V=double; else V=other; fi
  echo "RESULT rep=$REP cond=$COND sc=$SC rows=$N http1=$(echo "$R1" | cut -d' ' -f1) written1=$(wr_of "$R1") after1=[$A1] written2=$(wr_of "$R2") dup_blocks2=$(dup_blocks "$TOK-a2") after2=[$A2] verdict=$V"
}

# 조건 C0 — 보강 전 계약으로 되돌린다(설정 0 · 롤업 윈도우 0)
set_window 0
run_case C0 S1 $(( 1000 + REP * 10 + 0 ))
run_case C0 S2 $(( 1000 + REP * 10 + 1 ))
run_case C0 S3 $(( 1000 + REP * 10 + 2 ))
# 쌍의 한쪽만 — CD 설정 1 · 윈도우 0 / CW 설정 0 · 윈도우 1000
run_case CD S3 $(( 1000 + REP * 10 + 3 ))
set_window 1000
run_case CW S3 $(( 1000 + REP * 10 + 4 ))
# 조건 C1 — 현행 계약(DDL 윈도우 1000 · 프로파일 설정 1)
c "SELECT getSetting('deduplicate_blocks_in_dependent_materialized_views') AS dedup_mv_profile"
run_case C1 S1 $(( 1000 + REP * 10 + 5 ))
run_case C1 S2 $(( 1000 + REP * 10 + 6 ))
run_case C1 S3 $(( 1000 + REP * 10 + 7 ))

step "백필 재실행 BF — C1에서 롤업을 비우고 원시에서 tag_1m으로 다시 넣는다(경로 B ④ · ⑤) · 같은 내용 두 번째 삽입이 윈도우에 걸리는가"
DEV=$(( 3000 + REP * 10 )); gen_rows $DEV 8 60 $(( NOWMS - 1800000 )) > "$TMP/bf.json"
http_insert "$Q_INS&insert_deduplication_token=exp32-r$REP-bf" "$TMP/bf.json" >/dev/null
BF_SQL="INSERT INTO plc.tag_1m SELECT toStartOfMinute(ts) AS bucket, device_id, tag_id, countState(), avgState(value), minState(value), maxState(value), argMaxState(value, ts), quantilesTDigestState(0.95)(value), countIfState(quality IN (2, 4)) FROM plc.tag_raw WHERE device_id = $DEV GROUP BY bucket, device_id, tag_id ORDER BY bucket, tag_id"
clear_roll() { for t in tag_1m tag_1h tag_1d; do cq "ALTER TABLE plc.$t DELETE WHERE device_id = $DEV SETTINGS mutations_sync = 2"; done; }
clear_roll; cq "$BF_SQL"; B1=$(snap $DEV)
clear_roll; cq "$BF_SQL"; B2=$(snap $DEV)
clear_roll; cq "$BF_SQL SETTINGS insert_deduplicate = 0"; B3=$(snap $DEV)
echo "RESULT rep=$REP backfill first=[$B1] rerun_same=[$B2] rerun_insert_deduplicate0=[$B3]"

step "async_insert 충돌 — 프로파일 설정 1에서 async_insert 1 삽입"
DEV=$(( 3000 + REP * 10 + 1 )); gen_rows $DEV 8 10 $(( NOWMS - 1800000 )) > "$TMP/as.json"
RA=$(http_insert "$Q_INS&async_insert=1&wait_for_async_insert=1" "$TMP/as.json"); echo "$RA" | cut -c1-300
RB=$(http_insert "$Q_INS&async_insert=1&wait_for_async_insert=1&deduplicate_blocks_in_dependent_materialized_views=0" "$TMP/as.json")
echo "RESULT rep=$REP async_insert dedup_mv1=$(echo "$RA" | cut -d' ' -f1) dedup_mv0=$(echo "$RB" | cut -d' ' -f1) raw=$(cnt_raw $DEV)"

step "부수 확인 — 정수 ts(epoch ms)가 그대로 해석됐는가 · 토큰 없는 같은 내용 재전송이 중복 제거되는가"
c "SELECT min(ts) AS min_ts, toUnixTimestamp64Milli(min(ts)) = $(( NOWMS - 1800000 )) AS epoch_ms_ok FROM plc.tag_raw WHERE device_id = $(( 1000 + REP * 10 ))"
echo "RESULT rep=$REP epoch_ms_ok=$(cq "SELECT toUnixTimestamp64Milli(min(ts)) = $(( NOWMS - 1800000 )) FROM plc.tag_raw WHERE device_id = $(( 1000 + REP * 10 ))") partitions=$(cq "SELECT groupUniqArray(partition) FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active")"
DEV=$(( 1000 + REP * 10 + 9 )); gen_rows $DEV 8 60 $(( NOWMS - 1800000 )) > "$TMP/n.json"
http_insert "$Q_INS" "$TMP/n.json" >/dev/null; http_insert "$Q_INS" "$TMP/n.json" >/dev/null
echo "RESULT rep=$REP notoken_resend rows=480 raw=$(cnt_raw $DEV)"

step "판별 2 — 분할 INSERT의 ingested_at 고유값 수 · 블록 수 = part_log NewPart(query_id별)"
newparts() { cq "SYSTEM FLUSH LOGS"; cq "SELECT count() FROM system.part_log WHERE event_type = 'NewPart' AND database = 'plc' AND table = 'tag_raw' AND query_id = '$1'"; }
split_result() { # $1=이름 $2=설비 $3=query_id
  cq "SYSTEM FLUSH LOGS" >/dev/null
  echo "RESULT rep=$REP split=$1 rows=$(cnt_raw $2) blocks=$(newparts $3) uniq_ingested_at=$(cq "SELECT uniqExact(ingested_at) FROM plc.tag_raw WHERE device_id = $2")"
}
# ① HTTP 50,000행 · 블록 8192 · 스쿼시 끔(블록 7개 강제)
DEV=$(( 2000 + REP * 10 )); QID="exp32-r$REP-http-8192"
gen_rows $DEV 8 6250 $(( NOWMS - 7200000 )) > "$TMP/s1.json"
http_insert "$Q_INS&query_id=$QID&max_insert_block_size=8192&min_insert_block_size_rows=0&min_insert_block_size_bytes=0" "$TMP/s1.json" >/dev/null
split_result http_8192_nosquash $DEV $QID
# ② HTTP 50,000행 · 서버 기본(블록 8192로 파싱해도 스쿼시가 한 블록으로 묶는가)
DEV=$(( 2000 + REP * 10 + 1 )); QID="exp32-r$REP-http-8192-squash"
gen_rows $DEV 8 6250 $(( NOWMS - 7200000 )) > "$TMP/s2.json"
http_insert "$Q_INS&query_id=$QID&max_insert_block_size=8192" "$TMP/s2.json" >/dev/null
split_result http_8192_squash $DEV $QID
# ③ HTTP 1,500,000행 · 서버 기본 블록(1,048,576 초과 — 자연 분할)
DEV=$(( 2000 + REP * 10 + 2 )); QID="exp32-r$REP-http-default"
gen_rows $DEV 500 3000 $(( NOWMS - 3600000 )) > "$TMP/s3.json"
http_insert "$Q_INS&query_id=$QID" "$TMP/s3.json" >/dev/null
split_result http_default_1_5m $DEV $QID
# ④ INSERT SELECT 50,000행 · 블록 8192 · 스쿼시 끔
DEV=$(( 2000 + REP * 10 + 3 )); QID="exp32-r$REP-insert-select"
docker exec "$CH" clickhouse-client --query_id "$QID" -q "INSERT INTO plc.tag_raw (ts, device_id, tag_id, value, quality, scan_seq)
    SELECT toDateTime64(now() - INTERVAL 2 HOUR, 3, 'Asia/Seoul') + toIntervalSecond(intDiv(number, 8)), $DEV, 1 + number % 8, number, 9, intDiv(number, 8)
    FROM numbers(50000) SETTINGS max_block_size = 8192, max_insert_block_size = 8192, min_insert_block_size_rows = 0, min_insert_block_size_bytes = 0"
split_result insert_select_8192 $DEV $QID

step "첫 파트 · 압축 전후 바이트(판별 1 · 2 적재 뒤 tag_raw 활성 파트)"
c "SELECT name, rows, data_uncompressed_bytes AS raw, data_compressed_bytes AS stored, round(data_uncompressed_bytes / data_compressed_bytes, 2) AS ratio
   FROM system.parts WHERE database = 'plc' AND table = 'tag_raw' AND active ORDER BY min_block_number LIMIT 3"
