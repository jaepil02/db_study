# 019 — 롤업 정합성(AC-05)과 1분 롤업 p95 순위 오차 분포 (S3 · 티어 S · 모드 B · 적재 정지 후)

> 실험: EXP-31 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T05:11:25Z ~ 05:32:13Z(반복 3회 · 반복마다 발행 240초 + 랙 0 대기)

티어 S 부하(설비 5 × 태그 50 · 250 pps)를 모드 B로 240초 적재하고 적재를 멈춘 뒤, 세 해상도(tag_1m · tag_1h · tag_1d)의 버킷마다 원시 집계와 롤업 -Merge 집계를 대조한다. count · min · max · last는 정확 일치, avg는 버킷마다 원시에서 계산한 Float64 합산 오차 상계 2 · γ(n) · S / n 안이어야 한다(03_requirements/14 §롤업 정합성 허용 오차 판정). p95는 TDigest 근사라 판정에서 빼고, 1분 버킷마다 롤업 p95 값의 원시 안 순위(값 이하 행 수 ÷ n)와 0.95의 차를 분포로 기록한다 — 03_requirements/14 미확인 등재 "p95 원시 대 롤업의 근사 허용 범위"의 확정 수단이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 250 pps) |
| 스위치 | 전부 기본값(전수는 기계 판독 블록) — 3회 모두 health switches가 같다 |
| 배치 안 | A(컨슈머 3 · 창 1초 · 행 트리거 R 50,000 · 크기 트리거 P 32 MB) — 스위치 아님 |
| 주입 모드 · 시드 · 혼합 | B(datagen 컨테이너가 Stream에 직접 XADD · node dist/mode-b.js --tier S --mix mixed --seed 42 --duration 240) · 42 · mixed |
| api 역할 | APP_ROLE=worker(적재만 — Collector 없음) |
| 롤업 p95 | tag_1m의 p95 상태는 quantilesTDigest 상태이고, 대조는 quantilesTDigestMerge(0.95)로 읽는다(롤업 DDL) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 모드 B 워커 사용률 0.04% 안팎(발행 결과 workerUtilization) · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 반복마다 스냅샷 s3-empty-s 복원 · 기준선 240초(api 없이 저장소 유휴 · docker stats) — 현행 참고 5분보다 짧다(§폐기 · 예외) |
| 반복 · 편차 | 3회 · AC-05는 구조 판정이라 편차 폐기를 적용하지 않는다(repeat.deviation 0) · p95 순위 오차는 분포 기록(§폐기 · 예외) |
| 스크립트 | scripts/lab/s3/exp31-rep.sh <출력> <반복> [발행 초] [기준선 초] · apps/api/src/lab/s3-verify.ts(--phase stopped --p95) · 원시 docs/measurements/raw/019-rollup-consistency.jsonl |

반복 한 번의 절차는 아래 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s3-empty-s
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=worker → health 보관
④ 발행          모드 B 240초(엔트리 1,200 · 포인트 60,000)
⑥ 회복          consumer_lag 0까지 대기 → api 정상 종료(적재 정지)
⑦ 정합          s3-verify --p95 — AC-01 · AC-02 · AC-05(세 해상도) · EXP-31 순위 오차 요약
```

- **순위 오차 e = (원시 값 중 롤업 p95 이하인 개수 ÷ n) − 0.95다.** 1분 버킷 하나(태그 하나 · 분 하나)마다 하나씩 나온다. 원시에는 1,250버킷의 최솟값 · 중앙값(quantileExact) · 최댓값 · |e| ≤ 0.01인 버킷 수만 있고 버킷별 값은 없다.
- **e는 연속값이 아니다.** 버킷 행 수가 n이면 순위가 1/n 격자에서만 움직인다 — 꽉 찬 1분(n = 60)의 격자 간격은 0.0167이고, e가 0인 점은 57/60 하나뿐이다. |e| ≤ 0.01은 꽉 찬 버킷에서는 "정확히 57번째 값"과 같은 뜻이다.
- **1,250버킷 = 태그 250 × 분 5이다.** 발행 240초가 분 경계를 넘으므로 태그마다 5개 중 창 시작 · 끝의 분은 점이 60개보다 적은 부분 분이다.

## 결과

| 반복 | 판정 창(UTC) | 발행 · tag_raw · 차 | 정지 뒤 lag · pending | AC-02 중복 조합 | tag_1m 버킷(원시 · 롤업) | tag_1h | tag_1d | 누락 · 초과 | count 불일치 | min · max · last 불일치 | avg 상계 초과 | 판정 |
|------|------|------|------|------|------|------|------|------|------|------|------|------|
| 1 | 05:11:25 ~ 05:15:31 | 60,000 · 60,000 · **0** | 0 · 0 | **0** | 1,250 · 1,250 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** | 성립 |
| 2 | 05:19:48 ~ 05:23:54 | 60,000 · 60,000 · **0** | 0 · 0 | **0** | 1,250 · 1,250 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** | 성립 |
| 3 | 05:28:07 ~ 05:32:13 | 60,000 · 60,000 · **0** | 0 · 0 | **0** | 1,250 · 1,250 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** | 성립 |

- **AC-05 성립 3/3 — 세 해상도 1,750버킷(1,250 + 250 + 250 = **1,750**) 전부 count · min · max · last가 정확히 같고 avg가 상계 안이다.** 불일치 · 초과 수는 세 해상도의 합이다(해상도마다 0).
- AC-01(차 0) · AC-02(중복 조합 0)도 3회 성립 — 대조가 같은 행 집합 위에서 이뤄졌다.

| 반복 | avg 차 ÷ 상계 최댓값 tag_1m | tag_1h | tag_1d |
|------|------|------|------|
| 1 | 0.0626 | 0.0039 | 0.0039 |
| 2 | 0.0290 | 0.0051 | 0.0051 |
| 3 | 0.1755 | 0.0044 | 0.0073 |

- 비가 1 미만이면 상계 안이다. 가장 가까이 간 버킷도 상계의 17.6%(반복 3 · tag_1m)다.

| 반복 | 버킷 | e 최솟값(순위) | e 중앙값(순위) | e 최댓값(순위) | abs(e) ≤ 0.01 버킷 · 비율 |
|------|------|------|------|------|------|
| 1 | 1,250 | −0.0241(25/27) | +0.0130(26/27) | +0.0500(1) | 244 · 19.5% |
| 2 | 1,250 | −0.0500(9/10) | +0.0100(24/25) | +0.0500(1) | 213 · 17.0% |
| 3 | 1,250 | −0.0611(8/9) | +0.0108(49/51) | +0.0500(1) | 275 · 22.0% |

- 순위 칸은 e + 0.95를 분모 60 이하의 분수로 되돌린 값이다 — 분모가 27 · 25 · 51 · 10 · 9인 값은 부분 분 버킷의 격자점이다.
- **e 최댓값 +0.05는 상한이다.** 순위가 1(롤업 p95 ≥ 버킷 최댓값)이면 e = 1 − 0.95 = 0.05이고 그보다 클 수 없다 — 세 반복 모두 이 상한에 닿은 버킷이 있다.
- 참고 — E2E(기록 SQL 정확 분위수 · 판정에 쓰지 않는다) p50 1,015~1,016 ms · p95 1,021 ms · p99 1,023~1,024 ms. 기준선 clickhouse CPU 4.09 · 4.09 · 4.47% · 메모리 659.1~704.5 MiB.

## 해석

- **count · min · max · last 정확 일치는 MV 체인이 행을 잃거나 두 번 세지 않았다는 뜻이다.** 멱등 토큰이 롤업에도 같은 중복 제거 윈도우를 주고(06_pipeline/03 · ADR-14 보강), tag_1h · tag_1d가 체이닝 롤업이어도 원시 전체와 같은 값이 나온다.
- **avg 차는 상계보다 한 자릿수 이상 작다.** tag_1m 최대 비 0.03~0.18 · tag_1h · 1d 0.004~0.007이다. 상계는 최악의 합산 순서를 덮는 식이라 실제 차는 그보다 훨씬 작다 — 상계를 고정 상대 오차로 바꾸지 않은 판정(03_requirements/14)이 거짓 불일치 없이 성립한다.
- **롤업 p95는 참 순위 근처에 있고 위쪽으로 치우친다.** 세 반복의 e 범위가 −0.061 ~ +0.050이고 중앙값이 +0.010 ~ +0.013으로 양수다. 꽉 찬 버킷의 격자점은 0(57/60)과 +0.0167(58/60)인데 중앙값이 그 사이의 부분 분 버킷 값(26/27 · 24/25 · 49/51)으로 뽑혔다 — 버킷의 절반 안팎이 57번째 이하, 나머지가 58번째 이상에 떨어진다고 읽힌다. 이 해석은 요약 통계에서 거꾸로 푼 것이고 버킷별 분포는 원시에 없다.
- **1분 60점에서 순위 오차 ±0.05는 약 ±3순위다.** 1/60 = 0.0167이므로 +0.05는 참 95번째(57/60)보다 3순위 위(60/60 = 최댓값)다. 최솟값 −0.061(8/9)은 점이 9개인 부분 분 버킷이며, 부분 분에서는 격자가 거칠어 한 순위 차가 e를 크게 움직인다.
- **abs(e) ≤ 0.01 비율 17~22%는 TDigest 정밀도가 아니라 격자 폭을 잰다.** 꽉 찬 버킷에서 이 조건은 "정확히 57/60"과 같아 격자 간격 0.0167보다 좁은 창이다. 순위 오차 기준을 정본에 올리려면 창을 격자 폭 이상(예 ± 1순위)으로 잡거나 꽉 찬 버킷만 따로 세야 한다(§정본 반영).
- 한계 — 신호는 mixed 혼합 한 가지다. 순위를 "값 이하 개수"로 세므로 동률이 많은 신호(값이 몇 가지로 몰리는 BINARY · STEP 류)가 섞여 있으면 e가 +쪽으로 밀린다 — 양의 중앙값 중 얼마가 TDigest 치우침이고 얼마가 동률 효과인지는 신호별 분해가 원시에 없어 가르지 않았다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음.
- **p95 순위 오차는 분포 기록이며 편차 폐기를 걸지 않았다.** AC-05 문구가 p95를 "판정에서 제외하고 기록"으로 두고, 이 기록의 판정은 AC-05 구조 판정이다. 참고로 반복 사이 편차는 e 중앙값 27.5%((0.01296 − 0.01000) ÷ 0.01078) · abs(e) ≤ 0.01 버킷 수 25.4%((275 − 213) ÷ 244)로 20%를 넘는다 — 두 값은 격자점 사이에서 어느 부분 분 버킷이 뽑히느냐로 움직이는 양자화 값이라, 판정 지표로 쓰면 신호가 아니라 격자를 잰다. 이 두 값을 정본의 순위 오차 기준으로 올리지 않는다.
- **원시에 버킷별 값이 없다.** 러너가 1,250버킷의 요약 네 값만 남겨 꽉 찬 버킷과 부분 분 버킷을 가를 수 없다. 재측정 때는 n = 60 버킷만의 순위 분포(57 · 58 · 59 · 60번째 등 순위별 버킷 수)를 수집한다.
- **기준선이 현행 참고 5분보다 짧다.** 도구 호출 한 번이 10분을 넘지 않게 240초로 줄였다. 발행도 러너 기본값 300초에서 240초로 줄였다. 기준선은 유휴 바닥을 보는 칸이고 AC-05 판정 값에 닿지 않는다.
- **모드 B 발행 결과의 run.memoryLimitMb가 null이다.** datagen 컨테이너의 health 복사값이며 기계 판독 블록 run은 api health에서 옮겼다. SW-10 impl이 null인 것은 APP_ROLE=worker라 Collector 모듈이 없기 때문이다(value는 off).
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. exp31-rep.sh의 fdc7849 대비 차이는 파일 모드 100644 → 100755뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 01_overview/05 S3 합격 판정 ④ AC-05 — 기록 015(세 팔 9회)와 함께 이 기록(세 해상도 · 적재 정지 후 · 240초 적재)을 인용한다.
- 03_requirements/14 미확인 등재 "p95 원시 대 롤업의 근사 허용 범위" — 이 기록은 분포(1분 · mixed · e 범위 −0.061 ~ +0.050 · 상한 +0.05에 닿는 버킷 존재)만 올리고 **기준은 미확인으로 남긴다.** 기준 확정 조건은 꽉 찬 버킷 순위 분포의 재측정이다(§폐기 · 예외).
- 10_observability/06 EXP-31 행 — 판정 지표 열의 순위 오차 분포를 "꽉 찬 버킷(n = 60)의 순위별 버킷 수"로 좁히는 문구 보정을 제안한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "019",
  "exp": ["EXP-31"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T05:11:25.000Z", "end": "2026-09-25T05:32:13.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S3", "tierConfig": "device5-tag50-250pps", "modeBMix": "mixed", "publishS": 240, "appRole": "worker", "batchPlan": "A", "consumers": 3, "snapshot": "s3-empty-s", "rollupP95": "quantilesTDigest state · quantilesTDigestMerge(0.95)", "rankErrorBucket": "tag_1m (includes partial minutes)", "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "baselineS": 240 },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "ac01_diff", "arm": "AC-05", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_buckets_total", "arm": "AC-05", "unit": "buckets", "values": [1750, 1750, 1750], "median": 1750 },
    { "metric": "ac05_count_mismatch", "arm": "AC-05", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_select_mismatch", "arm": "AC-05", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_avg_over_bound", "arm": "AC-05", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_missing_extra", "arm": "AC-05", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "avg_diff_over_bound_max_1m", "arm": "AC-05", "unit": "ratio", "values": [0.0626, 0.029, 0.1755], "median": 0.0626 },
    { "metric": "avg_diff_over_bound_max_1h", "arm": "AC-05", "unit": "ratio", "values": [0.0039, 0.0051, 0.0044], "median": 0.0044 },
    { "metric": "avg_diff_over_bound_max_1d", "arm": "AC-05", "unit": "ratio", "values": [0.0039, 0.0051, 0.0073], "median": 0.0051 },
    { "metric": "p95_rank_error_min", "arm": "EXP-31-record", "unit": "rank", "values": [-0.0241, -0.05, -0.0611], "median": -0.05 },
    { "metric": "p95_rank_error_median", "arm": "EXP-31-record", "unit": "rank", "values": [0.013, 0.01, 0.0108], "median": 0.0108 },
    { "metric": "p95_rank_error_max", "arm": "EXP-31-record", "unit": "rank", "values": [0.05, 0.05, 0.05], "median": 0.05 },
    { "metric": "p95_rank_within_001_buckets", "arm": "EXP-31-record", "unit": "buckets", "values": [244, 213, 275], "median": 244 }
  ]
}
```
