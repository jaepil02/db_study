#!/usr/bin/env bash
# EXP-01~05 대조군 역전 지점 격자 러너(control-stage-{k} · 기록 042~046) — 하위 명령 하나 = 호출 하나(10분 미만)
# 정본: docs/05_data_stores/10_olap_vs_rdb_control.md §역전 지점 탐색 설계 단계 절차 ①~⑥ · docs/10_observability/06_experiment_catalog.md EXP-01~05
# 전제: 대조 자원 조건(task up CONTROL=1 — clickhouse 5-7 · 3.5 GB · postgres 8-10 · 3.5 GB) · api 정지 · 빈 tag_raw · 빈 대조군
# 상태 · 원시 출력: GRID_DIR(기본 snapshots/lab-s5-grid)/state.json · grid.jsonl(OUT로 바꾼다)
#
# 사용: scripts/lab/s5/grid/grid.sh <하위 명령> [인자]
#   plan [END_ISO]                         단계 구간 · 조각 · KST 일별 행(저장소 접속 없음)
#   init [--end ISO] [--seed 42] [--mix mixed]   end 고정(기본 지나간 가장 최근 KST 14:00 — 리드 판정 ③) · 자원 조건 · 빈 테이블 확인
#   budget <k>                             단계 k 진입 전 디스크 예산 식 · 적재 시간 예산
#   fill <k> [next|조각번호]               모드 D + GEN-10 한 조각(4단계 3조각 · 5단계 25조각 — FILL_CHUNK_SEC)
#   check <k>                              구간 count 정합(tag_raw = 대조군 = countMerge(tag_1m)) · 구간 밖 0
#   params                                 1단계 check 직후 1회 — Q5 문턱 quantileExact(0.5) · Q1~Q3 device · tag 고정
#   settle <k> [최대 초] [간격 초]         안정화(CH 활성 파트 3표본 불변 · 머지 0 / PG autovacuum 유휴 · 삽입 기준 대기 0 / 체크포인트 경과)
#   axes <k>                               비 쿼리 축 1 · 2 · 3 · 5 · 6(axis 줄)
#   query <k> <clickhouse|postgresql> <-|I1|I2> <반복> <Q1..Q5|Q5x> [cold,warm,explain,capture]
#   match <k> <Q>                          두 저장소 결과 집합 대조(count 정확 · avg 상계식 · Q4 tag_1m 대조)
#   i2-build <k> [예산 초=480]             btree(device_id, tag_id, ts) 파티션별 빌드 — 1~4단계 동기(끝날 때까지 다시 부른다)
#                                          5단계는 비동기 — 첫 파티션을 postgres 컨테이너 안 psql(docker exec -d)로 띄우고 돌아온다(리드 판정 ②)
#   i2-build-poll <k> [최대 대기 초=480] [간격=15]   5단계 — 상태 파일(/tmp/i2build/<파티션>.start·end·rc)을 읽어 ATTACH · 다음 파티션 시작
#   i2-drop <k>
#   status
# shellcheck source=../../s3/_lib.sh
source "$(dirname "$0")/../../s3/_lib.sh"
GCOMPOSE="$COMPOSE -f infra/compose/compose.control.yml"
export GCOMPOSE
case "${1:-}" in
  # 모드 D는 커밋과 같은 이미지(db_study-api:HASH)의 datagen-d 컨테이너(app_owner 비밀이 실리는 모드 D 전용 서비스)에서 돈다 — 다른 하위 명령은 저장소 CLI만 쓴다
  fill) require_clean ;;
  *) : ;;
esac
exec python3 scripts/lab/s5/grid/grid.py "$@"
