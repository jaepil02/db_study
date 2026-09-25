# 022 — SW-03 쿼리 캐시 on/off: 반복 조회 흡수와 신규 범위 비용 (S4 · 티어 M · 모드 B 배경)

> 실험: EXP-08 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T09:07:40Z ~ 09:43:40Z(반복 3 × 팔 2 · 팔마다 반복 조회 40초 + 신규 범위 40초)

티어 M 이력(s4-hist-m — 설비 4 × 태그 50 · 1초 원시 6일 · 롤업은 MV)을 복원하고, 모드 B 배경 적재(10,000 pps) 아래에서 같은 조회 부하를 SW-03 on · off로 준다. 창 ①은 이력 안 고정 범위 10개를 돌려 가며 묻는 반복 조회(히트 경로), 창 ②는 요청마다 다른 분 경계의 1일 범위(미스 경로)다. AC-39의 합격선은 조회 p95와 ClickHouse 쿼리 실행 수가 on/off 쌍으로 기록되는 것이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 3e8a46d(api 이미지 db_study-api:3e8a46d 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | M(설비 50 × 태그 200 · 10,000 pps) |
| 스위치 | SW-03=on/off(on RedisTimeseriesCache · off NoopTimeseriesCache) · SW-04 · 05 on — off 팔은 조합 제약 #1로 SW-04 · 05가 combo_1_query_cache_off 표지와 함께 NoopRebuildLock(S4 검수 M1 반영)으로 주입된다 · 그 외 기본값 · 6팔의 health switches를 대조해 SW-03 value · impl과 SW-05 impl(제약 #1 결과)만 다름을 확인했다 |
| 프로세스 구성 | api 역할(조회 · 포트 3000) + worker 컨테이너(APP_ROLE worker · 적재) + datagen 모드 B(배경 · node dist/mode-b.js --tier M --mix mixed --seed 42 --duration 115) — S4 판정 14 |
| 조회 부하 | k6 1.8.1 컨테이너(cpuset 11-12) · 고정 도착률 20/초 · 태그 1 · 2 · 201 · 202 · 집계 avg · max · 1일 범위(해상도 1m 자동 선택) · 워밍업 10초(반복 조회) |
| 관측 스택 · CPU 배치 | off · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen · k6 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음 · 없음 |
| 초기 상태 · 기준선 | 팔마다 스냅샷 s4-hist-m 복원(앵커 1789805880 ~ 1790324280 · scripts/lab/s4/hist-seed.sh) · 기준선 240초 |
| 팔 순서 | 반복마다 on → off |
| 반복 · 편차 | 3회 · 판정 지표는 서버 p50(버킷 보간) · 클라이언트 p50 · ClickHouse 쿼리 수 · 최대 편차 9.4%(off 반복 조회 서버 p50) |
| 스크립트 | scripts/lab/s4/query-rep.sh <출력> exp08 <반복> <팔> · k6-query.js(MODE repeat · fresh) · scripts/lab/s2/hist-diff.py · 원시 docs/measurements/raw/022-switch-sw03-query-cache.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원          api · worker 제거 → task restore NAME=s4-hist-m
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          worker(적재) → api(APP_ROLE api · REDIS_QUERY_CACHE on 또는 off) → health 보관
   배경         모드 B 115초(자식 프로세스 · 같은 호출 안에서 거둔다)
④ 워밍업        k6 반복 조회 10초 → /metrics 캡처 m0
⑤ 창 ①          k6 반복 조회 40초 → m1
   창 ②          k6 신규 범위 40초 → m2
⑥ 정지          모드 B 끝 → consumer_lag 기록 → api · worker 정상 종료
   판독         창마다 http_request_duration_seconds{route=/api/v1/timeseries/query · code 200} 버킷 차 · tsq_source_queries_total 차 · tsq_cache_requests_total 차 · k6 요약
```

## 결과

값의 순서는 반복 1 · 2 · 3이다. 서버 분위수는 버킷 보간 추정 · 클라이언트는 k6 정확 분위수다.

| 팔 | 창 | 요청 | 서버 p50(ms) | 서버 p95(ms · 참고) | k6 p50(ms) | k6 p95(ms) | ClickHouse 쿼리 | 히트 |
|------|------|------|------|------|------|------|------|------|
| on | 반복 | 801 · 800 · 801 | 8.31 · 7.88 · 8.35 | 14.00 · 13.65 · 14.02 | 8.46 · 8.06 · 8.65 | 11.98 · 11.69 · 11.99 | **0 · 0 · 0** | 801 · 800 · 801 |
| off | 반복 | 801 · 801 · 801 | 18.23 · 18.21 · 19.92 | 27.82 · 27.82 · 28.98 | 19.03 · 19.03 · 20.12 | 21.33 · 21.26 · 21.88 | **801 · 801 · 801** | 0 · 0 · 0 |
| on | 신규 | 801 · 801 · 800 | 24.72 · 24.49 · 24.68 | 29.48 · 29.45 · 29.48 | 23.29 · 22.44 · 22.98 | 25.18 · 24.90 · 25.08 | 800 · 800 · 799 | 1 · 1 · 1 |
| off | 신규 | 801 · 801 · 801 | 18.17 · 18.01 · 19.57 | 27.64 · 27.12 · 28.90 | 19.10 · 18.85 · 19.84 | 21.17 · 21.08 · 21.78 | 801 · 801 · 801 | 0 · 0 · 0 |

- **AC-39 기록 성립 — 반복 조회 중앙값 기준 on은 서버 p50 8.31 ms · k6 p95 11.98 ms · ClickHouse 쿼리 0, off는 18.23 ms · 21.33 ms · 801이다.** on의 반복 조회는 워밍업이 채운 키 10개만 읽어 원천을 한 번도 부르지 않는다.
- **신규 범위(미스 경로)는 on이 off보다 느리다 — 서버 p50 24.68 대 18.17 ms · k6 p95 25.08 대 21.17 ms.** on의 미스는 캐시 조회(미스) · 락 획득 · 원천 · SET · 락 해제를 거치고, off는 원천만 부른다. 차 약 5~6 ms가 캐시 계층의 미스 비용이다.
- on 신규 창의 히트 1은 k6 신규 범위 식(VU · 반복으로 흩은 분 오프셋)의 충돌 한 건이다.
- 배경 모드 B는 6팔 모두 발행 1,150,000 포인트 · 실패 0 · 늦은 틱 0 · 끝 consumer_lag 0이다.

## 해석

- **캐시의 이득은 히트율에 곱해진다.** 히트 경로는 원천 경로보다 서버 p50 약 10 ms 빠르고(8.3 대 18.2), 미스 경로는 약 6 ms 느리다(24.7 대 18.2). 히트율을 h라 하면 on의 기대 지연은 8.3h + 24.7(1 − h)로 off 18.2보다 작아지는 h는 약 0.4 이상이다 — 이 부하 · 범위 · 태그 수에서의 손익분기다. 원본 예상치(250 ms → 15 ms)는 이 이력 크기(1m 롤업 · 태그 4개 · 1일)에서는 원천 자체가 18 ms라 재현되지 않는다.
- **ClickHouse 부하 흡수는 구조적이다.** 반복 조회 창에서 on은 원천 쿼리 0, off는 요청 수와 같은 801이다 — AC-39의 쿼리 실행 수 축은 편차가 없는 구조값이다.
- 한계 — 이력은 설비 4 × 태그 50의 1일 범위뿐이다. 90일 · 1h 해상도처럼 원천이 무거운 범위는 이 기록이 보지 않았다.

## 폐기 · 예외

- 폐기한 반복 없음. 판정 지표 최대 편차 9.4% < 20%.
- **서버 p95는 참고로 내린다.** 히스토그램 계열은 p50으로 판정한다(10_observability/04 S2 판정) — p95는 25~30 ms 칸 안의 보간이다.
- **팔 순서를 교대하지 않았다(on → off).** 팔마다 스냅샷을 복원하므로 캐시 · 파트 상태가 다음 팔에 넘어가지 않는다.
- **기준선 240초** — 기록 016 · 021과 같은 사유.

## 정본 반영

- 01_overview/05 S4 합격 판정 ① · 03_requirements/14 AC-39의 S4 근거로 인용한다.
- 02_features/13 SW-03 예상 행 — "on의 히트 경로 p95 · 쿼리 수가 off보다 작다"를 실측 확인(기록 022)으로 올리고, 미스 경로가 on에서 느린 사실(캐시 계층 미스 비용 약 6 ms)을 함께 적는다.
- 06_pipeline/06 — 손익분기 히트율(이 부하에서 약 0.4)을 관측 사실로 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "022",
  "exp": ["EXP-08"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T09:07:40.000Z", "end": "2026-09-25T09:43:40.000Z" },
  "run": { "commitHash": "3e8a46d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": ["on", "off"], "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "generatorWorkerUtilizationMax": 0.0035, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device50-tag200-10000pps", "modeBMix": "mixed", "appRoles": ["api", "worker"], "snapshot": "s4-hist-m", "historyAnchor": [1789805880, 1790324280], "queryRate": 20, "queryTags": [1, 2, 201, 202], "queryAggregations": ["avg", "max"], "rangeDays": 1, "windowS": 40, "warmupS": 10, "armOrder": "on-then-off", "offArmLockImpl": "NoopRebuildLock", "k6": "grafana/k6:1.8.1", "baselineS": 240, "image": "db_study-api:3e8a46d", "clickhouseVersion": "26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0.094, "threshold": 0.2 },
  "results": [
    { "metric": "repeat_server_p50_ms", "arm": "on", "unit": "ms", "values": [8.31, 7.88, 8.35], "median": 8.31 },
    { "metric": "repeat_server_p50_ms", "arm": "off", "unit": "ms", "values": [18.23, 18.21, 19.92], "median": 18.23 },
    { "metric": "repeat_client_p95_ms", "arm": "on", "unit": "ms", "values": [11.98, 11.69, 11.99], "median": 11.98 },
    { "metric": "repeat_client_p95_ms", "arm": "off", "unit": "ms", "values": [21.33, 21.26, 21.88], "median": 21.33 },
    { "metric": "repeat_source_queries", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "repeat_source_queries", "arm": "off", "unit": "count", "values": [801, 801, 801], "median": 801 },
    { "metric": "fresh_server_p50_ms", "arm": "on", "unit": "ms", "values": [24.72, 24.49, 24.68], "median": 24.68 },
    { "metric": "fresh_server_p50_ms", "arm": "off", "unit": "ms", "values": [18.17, 18.01, 19.57], "median": 18.17 },
    { "metric": "fresh_client_p95_ms", "arm": "on", "unit": "ms", "values": [25.18, 24.9, 25.08], "median": 25.08 },
    { "metric": "fresh_client_p95_ms", "arm": "off", "unit": "ms", "values": [21.17, 21.08, 21.78], "median": 21.17 },
    { "metric": "fresh_source_queries", "arm": "on", "unit": "count", "values": [800, 800, 799], "median": 800 },
    { "metric": "fresh_source_queries", "arm": "off", "unit": "count", "values": [801, 801, 801], "median": 801 },
    { "metric": "repeat_hit_rate", "arm": "on", "unit": "ratio", "values": [1.0, 1.0, 1.0], "median": 1.0 },
    { "metric": "repeat_hit_rate", "arm": "off", "unit": "ratio", "values": [0, 0, 0], "median": 0 }
  ]
}
```
