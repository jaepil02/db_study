# 024 — SW-05 스탬피드 락 on/off: 캐시 비운 뒤 같은 조회 동시 50건의 원천 실행 수 (S4 · 티어 M · 모드 B 배경)

> 실험: EXP-10 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T10:31:00Z ~ 11:05:20Z(반복 3 × 팔 2)

EXP-10 절차 세 단계를 한 팔 안에서 돈다. ① 캐시 미스 단건을 순차 20회(요청마다 다른 범위) 불러 재구성 시간 분포를 잰다. ② 대기 총량(50 ms × 3 = 150 ms)이 재구성 p95 이상인지 검산한다(S4 판정 8). ③ cache:q를 비운 뒤 같은 범위를 k6 VU 50개가 동시에 한 번씩 부르고, ClickHouse가 그 조회를 몇 번 실행했는지 센다. AC-25의 합격선은 두 조건의 동일 쿼리 실행 수 기록과 on < off다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 35e8b8d(api 이미지 db_study-api:35e8b8d 정식 빌드 · health run.commitHash) — 3e8a46d 대비 차이는 러너(scripts/lab/s4/stampede-rep.sh) 한 파일이며 이미지 경로의 코드는 같다 |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | M(설비 50 × 태그 200 · 10,000 pps) |
| 스위치 | SW-05=on/off(on RedisRebuildLock · off NoopRebuildLock) · SW-03 · 04 on(제약 #1) · 그 외 기본값 · 6팔의 health switches 대조로 SW-05 value · impl만 다름을 확인했다 |
| 프로세스 구성 | api 역할 + worker 컨테이너 + datagen 모드 B 배경 120초(S4 판정 14) |
| 조회 | 태그 1 · 2 · 201 · 202 · 집계 avg · max · 1일 범위(해상도 1m) · ① 범위는 반복 번호로 흩은 분 경계 20개 · ③ 범위는 앵커 + 3일 + 반복 번호 시간(①과 겹치지 않음) |
| 락 조정값 | 만료 5,000 ms · 대기 50 ms × 3 · 소진 시 락 없이 원천 + NX 쓰기(06_pipeline/06 현행 참고) |
| 동시 요청 | k6 1.8.1 per-vu-iterations · VU 50 × 1회 |
| 관측 스택 · CPU 배치 | off · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음 · 없음 |
| 초기 상태 · 기준선 | 팔마다 s4-hist-m 복원 · 기준선 240초 |
| 팔 순서 | 반복마다 on → off |
| 반복 · 편차 | 3회 · 판정 지표(카탈로그 — 동일 쿼리 실행 수 · 대기 소진 수 · 재구성 시간 p95) · 실행 수 · 소진 수는 구조값이라 편차 0 · 재구성 클라이언트 정확 p95 편차 최대 10.5%(on) |
| 스크립트 | scripts/lab/s4/stampede-rep.sh <출력> <반복> <팔> [N=50] [SEQ=20] · k6-query.js(MODE burst) · 원시 docs/measurements/raw/024-switch-sw05-stampede-lock.jsonl · 러너 결함 실행 1줄 raw/024-switch-sw05-stampede-lock-discarded.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원 · 기준선 · 기동   s4-hist-m → 240초 → worker · api(CACHE_STAMPEDE_LOCK on 또는 off) → 모드 B 120초 시작 → 10초
② 재구성 분포            순차 미스 20회(python urllib · 요청마다 다른 범위) — 클라이언트 시간 · tsq_rebuild_duration_seconds 버킷 차
③ 비움                   cache:q 전부 삭제(SCAN · DEL) → 초 경계 두 번 넘김 → 창 시작 T0
④ 동시 N                 k6 VU 50 × 1회 · 같은 범위 → 창 끝 T1 → /metrics
⑤ 판독                   tsq_source_queries_total 차 · tsq_rebuild_lock_wait_exhausted_total 차 · system.query_log(T0 ~ T1 + 1초 · normalized_query_hash별 실행 수)
```

## 결과

값의 순서는 반복 1 · 2 · 3이다(칸 안의 N회는 반복 번호).

| 팔 | 원천 실행 수(메트릭) | query_log 같은 해시 실행 수 | 대기 소진 | k6 p50 · p95(ms) | 실패 |
|------|------|------|------|------|------|
| on | **1 · 1 · 1** | 1 · 1 · 1 | 0 · 0 · 0 | 1회 251.1 · 252.2 2회 181.4 · 271.0 3회 184.5 · 272.8 | 0 |
| off | **50 · 50 · 50** | 50 · 50 · 50 | 0 · 0 · 0 | 1회 446.2 · 496.8 2회 471.5 · 521.8 3회 451.3 · 501.7 | 0 |

- **AC-25 성립 — on은 동시 50건에 원천 1회 · off는 50회다(3회 모두).** 메트릭과 query_log(시계열 조회 SELECT의 정규화 해시 하나)가 같은 값을 준다. 원본 예상치 100 → 1은 이 N(50)에서 50 → 1로 재현됐다.
- on의 나머지 49건은 50 ms 대기 첫 재조회에서 히트해 대기 소진이 0이다.
- on의 k6 지연(p50 약 180~250 ms)이 단건 재구성(약 30 ms)보다 큰 것은 VU 50개의 동시 연결 수립과 대기 재조회 한 번(50 ms)이 겹친 값이다. off는 원천 50건이 ClickHouse에서 겹쳐 약 450 ms다.

| 팔 | 재구성 클라이언트 p50 · p95 · 최대(ms · 정확) | 서버 버킷 p50 · p95(ms · 참고) | 20회 전부 미스 | 대기 총량 150 ms ≥ p95 |
|------|------|------|------|------|
| on | 1회 29.6 · 36.1 · 82.8 2회 28.3 · 32.5 · 61.6 3회 29.1 · 34.4 · 79.6 | 1회 13.5 · 20 2회 13.6 · 20 3회 13.6 · 30 | 예 | 성립 |
| off | 1회 29.0 · 36.1 · 82.9 2회 29.5 · 36.7 · 84.8 3회 27.4 · 35.7 · 58.3 | 1회 13.8 · 30 2회 14.5 · 30 3회 13.6 · 20 | 예 | 성립 |

- **판정 8의 관계(대기 총량 ≥ 재구성 p95)가 성립한다 — 재구성 클라이언트 p95 32.5~36.7 ms < 150 ms.** 현행 참고 대기 값(50 ms × 3)을 조정하지 않는다. 첫 재조회(50 ms)에서 이미 재구성이 끝나 대기 소진이 한 번도 없었다.
- 서버 버킷 p95(20 · 30 ms)는 버킷 경계 값이라 참고로만 둔다 — tsq_rebuild_duration_seconds 버킷이 이 구간에서 10 ms 간격이다.

## 해석

- **락은 동시 미스를 하나의 원천 실행으로 모은다.** off는 요청 수만큼 같은 GROUP BY가 ClickHouse에서 동시에 돌고, 그 경합이 요청마다 약 450 ms를 만든다. on은 원천 1회 + 49건의 짧은 대기다 — 만료가 몰리는 순간 원천 부하가 N배로 튀지 않는다.
- **대기 값이 관계를 넉넉히 만족하는 것은 이 이력이 가볍기 때문이다.** 재구성 30 ms대는 1m 롤업 · 태그 4개 · 1일 범위의 값이다. 재구성이 150 ms를 넘는 무거운 범위에서는 소진 경로(락 없이 원천 + NX)가 열려 on도 원천 실행이 1보다 커진다 — 이 기록은 그 구간을 보지 않았다.
- 한계 — N은 50 하나다. 소진 경로의 동작은 단위 테스트(timeseries-s4)로만 확인했다.

## 폐기 · 예외

- 폐기한 반복 없음. 원천 실행 수는 구조값이라 편차 0 · 재구성 클라이언트 p95 편차 최대 10.5%.
- **동시 50건의 k6 지연은 판정 지표 밖이라 참고로 둔다.** on p50이 251.1 · 181.4 · 184.5 ms로 편차 37.8%다 — 카탈로그 EXP-10 판정 지표(실행 수 · 소진 수 · 재구성 p95)에 없고, VU 50개의 연결 수립 시점에 따라 흔들리는 값이다. 편차 폐기와 정본 인용에 쓰지 않는다.
- **러너 결함으로 버린 실행 1건** — 첫 반복 1 on(커밋 3e8a46d 이미지)은 query_log 창이 ① 순차 20회와 겹쳐 같은 해시 실행 수를 21로 셌다(메트릭 원천 실행 수는 1로 정상). 창을 초 경계 두 번 뒤에 열도록 러너를 고쳐 35e8b8d로 커밋했고, 그 뒤 6팔을 모두 새로 돌렸다. 버린 줄은 raw/024-switch-sw05-stampede-lock-discarded.jsonl에 남긴다.
- query_log에 같은 창의 다른 해시 1개(실행 2회)가 잡힌다 — 시계열 조회 SELECT가 아니다(on 반복 2에서는 없음). 판정은 조회 SELECT 해시로만 한다.
- **팔 순서 on → off · 기준선 240초** — 기록 022와 같은 사유.

## 정본 반영

- 01_overview/05 S4 합격 판정 ③ · 03_requirements/14 AC-25의 S4 근거로 인용한다.
- 06_pipeline/06 스탬피드 대기 값 — 판정 8의 관계 검산 결과(재구성 p95 약 36 ms < 150 ms · 소진 0)를 적고 현행 참고 값을 유지한다.
- 02_features/13 SW-05 예상 행 — "100 → 1"을 실측 50 → 1(기록 024)로 올린다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "024",
  "exp": ["EXP-10"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T10:31:00.000Z", "end": "2026-09-25T11:05:20.000Z" },
  "run": { "commitHash": "35e8b8d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": ["on", "off"], "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device50-tag200-10000pps", "modeBMix": "mixed", "appRoles": ["api", "worker"], "snapshot": "s4-hist-m", "burstN": 50, "sequentialMisses": 20, "lockTtlMs": 5000, "waitMs": 50, "waitTries": 3, "queryTags": [1, 2, 201, 202], "rangeDays": 1, "armOrder": "on-then-off", "k6": "grafana/k6:1.8.1", "baselineS": 240, "image": "db_study-api:35e8b8d", "clickhouseVersion": "26.8.10.6", "discardedRuns": 1 },
  "repeat": { "runs": 3, "deviation": 0.105, "threshold": 0.2 },
  "results": [
    { "metric": "burst_source_queries", "arm": "on", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "burst_source_queries", "arm": "off", "unit": "count", "values": [50, 50, 50], "median": 50 },
    { "metric": "burst_query_log_same_hash", "arm": "on", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "burst_query_log_same_hash", "arm": "off", "unit": "count", "values": [50, 50, 50], "median": 50 },
    { "metric": "lock_wait_exhausted", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "burst_client_p50_ms", "arm": "on", "unit": "ms", "values": [251.1, 181.4, 184.5], "median": 184.5 },
    { "metric": "burst_client_p50_ms", "arm": "off", "unit": "ms", "values": [446.2, 471.5, 451.3], "median": 451.3 },
    { "metric": "rebuild_client_p50_ms", "arm": "on", "unit": "ms", "values": [29.6, 28.3, 29.1], "median": 29.1 },
    { "metric": "rebuild_client_p95_ms", "arm": "on", "unit": "ms", "values": [36.1, 32.5, 34.4], "median": 34.4 },
    { "metric": "rebuild_client_p50_ms", "arm": "off", "unit": "ms", "values": [29.0, 29.5, 27.4], "median": 29.0 },
    { "metric": "rebuild_client_p95_ms", "arm": "off", "unit": "ms", "values": [36.1, 36.7, 35.7], "median": 36.1 },
    { "metric": "wait_relation_holds", "arm": "on", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac25_pass", "arm": "on-vs-off", "unit": "bool", "values": [1, 1, 1], "median": 1 }
  ]
}
```
