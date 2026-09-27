#!/usr/bin/env bash
# EXP-35(storage-compression-profiles · 기록 034) — 한 팔 · 한 반복 = 호출 하나
# 조건: 부하 실험 프로파일(대조 자원 조건 아님) · M 행 수(datagen-d CAPACITY_TIER=M → 보고 run.capacityTier M) · SW-10 off · 모드 D(ClickHouse만 · --control off · --rollup on)
#   run.memoryLimitMb는 null 그대로다 — datagen-d에 compose 메모리 상한이 없다(원시 runNotes.memoryLimitSource)
# 팔: mixed · 8 프로파일 개별(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) = 9
# 절차: ① 복원(기본 s7a-seed-m — 티어 M 시드 · tag_raw 0행) ② 모드 D 구간(기본 3600초 · 한 UTC 일 안 — 일 파티션 경계 · ADR-27) ③ OPTIMIZE … FINAL → 파티션당 활성 파트 1 · 머지 0
#       ④ 압축률(행 × 41 B ÷ bytes_on_disk) · 원시 행당 · 롤업(tag_1m) 행당 바이트 · 열별 크기
#   순간값 판정 제외 불릿(06 카탈로그 · 기록 017) 대응 — 파트 1개로 수렴한 뒤에만 잰다
# 사용: scripts/lab/s5/grid/exp35.sh <팔> <반복 번호> [구간 초=3600] [복원 스냅샷=s7a-seed-m]
#   환경변수: END(구간 끝 ISO · 기본 지금의 정시) · SEED(42) · OUT(기본 GRID_DIR/exp35.jsonl)
# shellcheck source=../../s3/_lib.sh
source "$(dirname "$0")/../../s3/_lib.sh"
LCOMPOSE=$COMPOSE
export LCOMPOSE
require_clean
exec python3 scripts/lab/s5/grid/grid.py exp35 "$@"
