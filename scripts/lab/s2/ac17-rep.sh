#!/usr/bin/env bash
# AC-17 반복 1회 — EXP-29(regression-stage-s2)의 육안 판정을 커밋 트리 이미지로 3회 재는 러너(기록 014)
# ① 복원(s2-empty-slice) ③ 기준선(api 없이 저장소 유휴 · 현행 참고 5분) ② api 기동(APP_ROLE all · 모드 A) → 워밍업
# → 웹 기동(호스트 next start · 127.0.0.1:3001) → 헤드리스 대조 두 촬영(ac17-capture.cjs) → 웹 · api 정지 ⑧ 다음 반복이 복원
# 웹은 호스트 프로세스라 이 명령 안에서 띄우고 같은 명령 안에서 끝낸다(백그라운드로 남기지 않는다).
# 사용: scripts/lab/s2/ac17-rep.sh <출력 JSON 줄 파일> <스크린샷 디렉터리> <반복 번호> [워밍업 초=20] [기준선 초=300]
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUT=${1:?출력 파일}
SHOTS=${2:?스크린샷 디렉터리}
REP=${3:?반복 번호}
WARM=${4:-20}
BASE=${5:-300}
DIRTY=$(git status --porcelain -- apps packages infra/postgres/migrations infra/clickhouse/ddl package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore | grep -v 'apps/web/test/\|apps/web/package.json' || true)
if [ -n "$DIRTY" ]; then echo "이미지 · 웹에 들어갈 변경이 커밋되지 않았다:" >&2; echo "$DIRTY" >&2; exit 1; fi
HASH=$(git rev-parse --short HEAD)
: "${PLAYWRIGHT_CORE:?PLAYWRIGHT_CORE — playwright-core 경로}"
export COMMIT_HASH=$HASH CAPACITY_TIER=S
COMPOSE="docker compose --env-file .env -f infra/compose/compose.yml -f infra/compose/compose.load.yml"
docker image inspect "db_study-api:$HASH" >/dev/null
mkdir -p "$SHOTS"
TMP=$(mktemp -d)
WPID=""
cleanup() {
  if [ -n "$WPID" ]; then pkill -P "$WPID" 2>/dev/null || true; kill "$WPID" 2>/dev/null || true; fi
  lsof -ti tcp:3001 | xargs kill 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "── rep $REP · 복원 s2-empty-slice"
$COMPOSE rm -sf api >/dev/null 2>&1 || true
task restore NAME=s2-empty-slice >/dev/null
echo "── 기준선 ${BASE}초"
sleep "$BASE"
APP_ROLE=all $COMPOSE up -d --no-deps --force-recreate api >/dev/null
for _ in $(seq 1 90); do curl -sf -o /dev/null http://127.0.0.1:3000/api/v1/health && break; sleep 1; done
curl -s http://127.0.0.1:3000/api/v1/health > "$TMP/health"
sleep "$WARM"
echo "── 웹 기동 · 촬영"
(cd apps/web && exec pnpm start) > "$TMP/web.log" 2>&1 &
WPID=$!
for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:3001/realtime/1 && break; sleep 1; done
set +e
node scripts/lab/s2/ac17-capture.cjs "$SHOTS" "014-rep$REP" > "$TMP/capture"
RC=$?
set -e
$COMPOSE stop -t 60 api >/dev/null
python3 - "$TMP" "$REP" "$RC" >> "$OUT" <<'PY'
import json, sys
d, rep, rc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
print(json.dumps({'rep': rep, 'health': json.load(open(f'{d}/health')), 'capture': json.loads(open(f'{d}/capture').read().strip().splitlines()[-1]), 'exit': rc}, ensure_ascii=False))
PY
tail -1 "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); c=d['capture']; print(f\"rep={d['rep']} pass={c['pass']} checks={c['checks']} updated={c['updated']} canvas={c['canvas']} errors={len(c['errors'])}\")"
