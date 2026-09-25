#!/usr/bin/env bash
# S4 판정 1 — 조회 실험(EXP-08 · 09 · 10)용 이력 시드 → 스냅샷 s4-hist-m. 모드 D(GEN-08)는 S5라 러너의 SQL로 채운다.
# 대상: 티어 M(s3-empty-m) 설비 1~4 × 앞 태그 50 = 200 태그 · 1초 원시 6일(원시 TTL 7일 안) · 롤업은 MV가 채운다.
# 값: SINE — 50 + 40·sin(2π(t/600 + k/50)) · 품질 0 · 결정적(같은 앵커면 같은 행)
# 사용: scripts/lab/s4/hist-seed.sh  (앵커 = 실행 시각의 분 내림 − 1분 · snapshots/s4-hist-m/seed.txt에 남긴다)
source "$(dirname "$0")/../s3/_lib.sh"
NAME=s4-hist-m
[ ! -e "snapshots/$NAME" ] || { echo "snapshots/$NAME 이 이미 있다" >&2; exit 1; }
restore_snap s3-empty-m
END=$(( $(date +%s) / 60 * 60 - 60 ))
START=$(( END - 6 * 86400 ))
for dev in 1 2 3 4; do
  base=$(( (dev - 1) * 200 + 1 ))
  for day in 0 1 2 3 4 5; do
    chq "INSERT INTO plc.tag_raw (ts, device_id, tag_id, value, quality, scan_seq)
         SELECT toDateTime64($START + $day * 86400 + intDiv(number, 50), 3, 'Asia/Seoul'), $dev,
                toUInt32($base + number % 50),
                50 + 40 * sin(2 * pi() * (($day * 86400 + intDiv(number, 50)) / 600.0 + (number % 50) / 50.0)),
                0, $day * 86400 + intDiv(number, 50)
         FROM numbers(50 * 86400)"
  done
  echo "설비 $dev 적재"
done
chq "SELECT 'raw', count() FROM plc.tag_raw UNION ALL SELECT '1m', count() FROM plc.tag_1m UNION ALL SELECT '1h', count() FROM plc.tag_1h UNION ALL SELECT '1d', count() FROM plc.tag_1d"
task snapshot NAME="$NAME" >/dev/null
{ echo "anchor_start_epoch=$START"; echo "anchor_end_epoch=$END"; echo "devices=1-4 tags=each device first 50 (1-50 · 201-250 · 401-450 · 601-650)"; echo "profile=SINE 50+40sin(2pi(t/600+k/50)) quality=0 period=1000ms"; } > "snapshots/$NAME/seed.txt"
echo "스냅샷 $NAME · 앵커 $START ~ $END"
