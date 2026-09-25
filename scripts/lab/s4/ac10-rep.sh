#!/usr/bin/env bash
# S4 반복 1회 — EXP-29(기록 021) AC-10 호출 — 서버 소켓 종료(api 정지 DOWN초 → 기동) 뒤 재연결 백오프 · REST 1건 · 값 = rt:latest
# 구조 판정이라 기준선 창을 두지 않는다(기록 조건 칸에 명시) · 복원 s3-empty-s · api all · 모드 A · 웹 운영 빌드 · 헤드리스 Chromium
# 사용: scripts/lab/s4/ac10-rep.sh <출력 JSON 줄 파일> <반복 번호> [DOWN초=75]
source "$(dirname "$0")/_lib.sh"
OUT=${1:?출력 파일}
REP=${2:?반복 번호}
DOWN=${3:-75}
require_clean
export CAPACITY_TIER=S
TMP=$(mktemp -d "${CLAUDE_JOB_DIR:-/tmp}/ac10.XXXX")
trap 'web_stop; rm -rf "$TMP"' EXIT
restore_snap s3-empty-s
APP_ROLE=all api_up
web_start
sleep 10
node scripts/lab/s4/ac10-capture.cjs "$DOWN" > "$TMP/ac10"
wait_api
web_stop
api_stop
python3 -c "import json,sys; d=json.load(open('$TMP/ac10')); d['rep']=$REP; print(json.dumps(d, ensure_ascii=False))" >> "$OUT"
tail -1 "$OUT"
