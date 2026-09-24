#!/usr/bin/env bash
# 생성기 단독 실행 경로 측정 — EXP-21(단독 처리량 · slug gen-standalone-throughput) · EXP-39 S1 몫(엔트리 인코딩 크기)
# 수집 경로 없이 생성 + MessagePack 인코딩(GEN-09). 커밋 해시로 빌드한 api 이미지를 api 메모리 상한(부하 실험 2 GB)으로 띄운다.
# CPU 위치: api 0-4 · datagen 11-12(04_architecture/03 §cpuset 배치).
# 사용: scripts/lab/s1/gen-bench.sh <출력 파일(JSON 줄 · 이어 쓴다)> <위치 api|datagen> <티어 S|M|M+|L> <구성 mixed|all|프로파일>
#                                   <워커 목록 "1 2 4"> [반복=3] [측정 초=30] [워밍업 초=5]
# 한 번의 실행이 10분을 넘지 않게 나눠 부른다 — 백그라운드로 돌리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../../.."
OUT=${1:?출력 파일}
PLACE=${2:?위치 api 또는 datagen}
TIER=${3:?티어}
MIX=${4:?구성}
WORKERS=${5:?워커 목록}
REPS=${6:-3}
DUR=${7:-30}
WARM=${8:-5}
case $PLACE in
  api) CPUS=0-4 ;;
  datagen) CPUS=11-12 ;;
  *) echo "위치 $PLACE — api 또는 datagen" >&2; exit 1 ;;
esac
# 이미지에 들어가는 것 전부가 커밋돼 있어야 기록의 커밋 해시가 실행 코드를 가리킨다(미추적 파일 포함)
DIRTY=$(git status --porcelain -- apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .dockerignore)
if [ -n "$DIRTY" ]; then
  echo "이미지에 들어갈 변경이 커밋되지 않았다:" >&2
  echo "$DIRTY" >&2
  exit 1
fi
HASH=$(git rev-parse --short HEAD)
IMAGE="db_study-api:$HASH"
docker build -q -f apps/api/Dockerfile --build-arg COMMIT_HASH="$HASH" -t "$IMAGE" . >/dev/null
for w in $WORKERS; do
  for r in $(seq 1 "$REPS"); do
    line=$(docker run --rm --cpuset-cpus "$CPUS" --memory 2g \
      -e APP_ROLE=datagen -e WORKER_POOL_SIZE="$w" -e MEMORY_PROFILE=load -e CAPACITY_TIER="$TIER" \
      "$IMAGE" node dist/bench.js --mix "$MIX" --seed 42 --warmup "$WARM" --duration "$DUR")
    printf '%s\n' "$line" | python3 -c "import json,sys; d=json.load(sys.stdin); d['place']='$PLACE'; d['cpuset']='$CPUS'; d['rep']=$r; d['script']='gen-bench.sh'; print(json.dumps(d))" >> "$OUT"
    tail -1 "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['result']; print(f\"{d['place']:8} cpuset={d['cpuset']:6} tier={d['run']['capacityTier']} mix={d['options']['mix']} workers={d['workers']} rep={d['rep']} pps={r['pointsPerSecond']:,.0f} util={r['workerUtilization']:.3f} cpu={r['processCpuCores']:.2f} B/entry={r['bytesPerEntry']:.0f}\")"
  done
done
