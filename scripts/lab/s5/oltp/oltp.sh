#!/usr/bin/env bash
# EXP-40~44 역방향 대조 러너(업무 워크로드를 ClickHouse에 · oltp-control-*) — 하위 명령 하나 = 실행기 호출 하나(10분 미만)
# 정본: docs/05_data_stores/10_olap_vs_rdb_control.md §역방향 대조 — 업무 워크로드 · docs/10_observability/06_experiment_catalog.md EXP-40~44
# 전제: 대조 자원 조건(task up CONTROL=1 — clickhouse 5-7 · 3.5 GB · postgres 8-10 · 3.5 GB) · api 유휴 · 주입 없음 · 관측 프로파일 off
#       · 스위치 기본값(SW-09 off) · migrate(009 업무 대조 테이블) · 빈 업무 테이블(work_order 0행 · 빈 볼륨 IDENTITY 1부터)
# 측정: oltp-lab 서비스(api 이미지 dist/oltp-lab.js · CPU 11-12 · 앱 비경유) · 원시 OLTP_DIR(기본 snapshots/lab-s5-oltp)/oltp.jsonl · state.json
#
# 사용: scripts/lab/s5/oltp/oltp.sh <하위 명령> [인자]
#   init [--seed 42] [--in-progress 0.5]   자원 조건 · 서버 버전 · 설정 · 판별 대상 4(probe — plc 밖 탐침 DB)를 원시에
#   fill <규모>                             10000 · 100000 · 1000000 — 두 저장소 같은 행(채운 뒤 집합 md5 대조)
#   settle <규모> [최대 초=240]             PostgreSQL VACUUM ANALYZE · ClickHouse 활성 파트 수렴
#   snapshot <규모> [이름]                  (리드) 실험 DB 부재 확인 → task snapshot — 재기동은 사람이
#   reset <규모> clickhouse|all             clickhouse: 대조 테이블 다시 채우기 + 수렴 · all: 채움 스냅샷 복원(리드) + settle
#   run <exp40..44> <변형> <규모> <반복 0|1|2> [--concurrency c] [--rate r] [실행기 2계층 인자 …]
#   collect                                 원시 → oltp-summary.json(reverse 행 · 3회 중앙값 · 편차 · 구조 지표 3회 전부)
#   status
# shellcheck source=../../s3/_lib.sh
source "$(dirname "$0")/../../s3/_lib.sh"
OCOMPOSE="$COMPOSE -f infra/compose/compose.control.yml"
export OCOMPOSE
case "${1:-}" in
  # 실행기는 커밋과 같은 이미지(db_study-api:HASH)에서 돈다 — status · collect는 저장소 · 이미지를 쓰지 않는다
  init|fill|settle|reset|run) require_clean ;;
  *) : ;;
esac
exec python3 scripts/lab/s5/oltp/oltp.py "$@"
