# 023 — SW-04 키 시간 스냅 on/off: 상대 범위 반복의 히트율 추이 (S4 · 티어 M · 모드 B 배경)

> 실험: EXP-09 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T09:46:00Z ~ 10:21:50Z(반복 3 × 팔 2 · 팔마다 상대 범위 반복 80초를 10초 조각 8개로)

now 기준 상대 범위(from = now − 24시간 · to = now − 10분)를 같은 조건으로 반복해 묻는다. SW-04 on은 범위를 버킷 경계로 내려 같은 분 안의 요청을 한 키로 모으고, off는 요청 시각 그대로라 매 요청이 다른 키가 된다. SW-03은 on으로 고정한다(조합 제약 #1). AC-23의 합격선은 히트율 기록(원본 목표 80% 미확인), AC-24는 off 히트율이 0에 수렴하는 추이의 기록이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 3e8a46d(api 이미지 db_study-api:3e8a46d 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | M(설비 50 × 태그 200 · 10,000 pps) |
| 스위치 | SW-04=on/off(on TimeSnapKeyNormalizer · off RawTimeKeyNormalizer) · SW-03 on(제약 #1) · SW-05 on · 그 외 기본값 · 6팔의 health switches 대조로 SW-04 value · impl만 다름을 확인했다 |
| 프로세스 구성 | api 역할 + worker 컨테이너 + datagen 모드 B 배경(S4 판정 14) — 기록 022와 같다 |
| 조회 부하 | k6 1.8.1 · 고정 도착률 20/초 · 태그 1 · 2 · 201 · 202 · 집계 avg · max · 범위 now − 24시간 ~ now − 10분(해상도 1m 자동 선택) · 워밍업 10초(같은 상대 범위) |
| 범위 선택 근거 | 끝을 now − 10분에 둔다 — 끝이 최근 5분 안이면 판정 트리가 캐시하지 않아(06_pipeline/06 · S4 검수 L4) SW-04와 무관하게 히트율 0이 된다 |
| 관측 스택 · CPU 배치 | off · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음 · 없음 |
| 초기 상태 · 기준선 | 팔마다 s4-hist-m 복원 · 기준선 240초 |
| 팔 순서 | 반복마다 on → off |
| 반복 · 편차 | 3회 · 판정 지표 히트율(최종 누적) 편차 0.1% · 서버 p50 편차 3.6% |
| 스크립트 | scripts/lab/s4/query-rep.sh <출력> exp09 <반복> <팔> · k6-query.js(MODE relative) · 원시 docs/measurements/raw/023-switch-sw04-time-snap.jsonl |

절차는 기록 022와 같고 판정 창만 다르다 — 워밍업 뒤 캡처 m0, 이후 10초 k6 실행을 8번 이어 돌리며 조각마다 /metrics를 캡처해 m0 대비 tsq_cache_requests_total{hit} 누적 ÷ 전체 누적을 적는다.

## 결과

누적 히트율의 조각 1~8 추이다(조각 = 10초).

| 반복 | 팔 | 조각 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 | 최종 히트 · 요청 | ClickHouse 쿼리 | 서버 p50 · p95(ms) |
|------|------|------|------|------|------|
| 1 | on | 1.000 · 1.000 · 1.000 · 1.000 · 0.999 · 0.999 · 0.999 · 0.999 | 1,606 · 1,607 | 1 | 8.00 · 13.81 |
| 1 | off | 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 | 0 · 1,607 | 1,607 | 24.62 · 29.47 |
| 2 | on | 0.995 · 0.998 · 0.998 · 0.999 · 0.999 · 0.999 · 0.999 · 0.999 | 1,606 · 1,608 | 2 | 8.13 · 13.95 |
| 2 | off | 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 | 0 · 1,608 | 1,608 | 24.46 · 29.45 |
| 3 | on | 1.000 · 1.000 · 0.998 · 0.999 · 0.999 · 0.999 · 0.999 · 0.999 | 1,606 · 1,608 | 2 | 7.85 · 13.53 |
| 3 | off | 0 · 0 · 0 · 0 · 0 · 0 · 0 · 0 | 0 · 1,606 | 1,606 | 24.62 · 29.47 |

- **AC-24 성립 — off 히트율은 3회 모두 조각 1부터 0이다.** 요청마다 초 단위 now()가 키에 들어가 같은 키가 두 번 오지 않는다.
- **AC-23 기록 — on 최종 누적 히트율 0.999(3회 중앙값) · 원본 목표 80%는 미확인 목표이고 이 값이 기록이다.** 미스는 분 경계를 넘을 때마다 1건(80초 창에서 1~2건)이다 — 스냅이 분 버킷이라 키가 분마다 한 번 바뀐다.
- on의 서버 p50(약 8 ms)은 기록 022의 히트 경로와 같고, off(약 24.6 ms)는 022의 on 미스 경로와 같다 — SW-03 on 상태의 미스라 캐시 계층 미스 비용이 포함된다.

## 해석

- **SW-04 off는 캐시를 켠 채 캐시를 무력화한다.** SW-03 on · SW-04 off 구성은 모든 요청이 미스 경로(캐시 조회 · 락 · 원천 · SET)를 타 원천만 부르는 SW-03 off(기록 022 · 18.2 ms)보다 느리다 — 파편화된 키는 쓰이지 않을 사본만 Redis에 쌓는다(TTL 동안).
- **히트율의 상한은 버킷 폭 ÷ 요청 간격으로 정해진다.** 분 버킷 · 20/초면 분당 1,200 요청 중 1건만 미스라 이론 상한 약 0.9992다. 관측 0.999는 이 상한에 붙어 있다.
- 한계 — 범위 길이는 1일(1m) 하나다. 7일 초과(1h)나 90일 초과(1d) 상대 범위는 버킷이 커져 히트율이 더 높을 것이나 이 기록이 재지 않았다.

## 폐기 · 예외

- 폐기한 반복 없음. 판정 지표(히트율 · 조회 p50) 최대 편차 3.6%.
- **on의 ClickHouse 쿼리 1 · 2 · 2는 판정 지표 밖이다.** 창이 분 경계를 몇 번 넘었는가로 정해지는 작은 정수라 편차(50%)를 폐기에 쓰지 않는다 — 카탈로그 EXP-09 판정 지표는 히트율 추이 · 조회 p95다.
- **팔 순서 on → off · 기준선 240초** — 기록 022와 같은 사유.

## 정본 반영

- 01_overview/05 S4 합격 판정 ① · ② · 03_requirements/14 AC-23 · AC-24의 S4 근거로 인용한다.
- 02_features/13 SW-04 예상 행 — "off 히트율 0 수렴 · on 목표 이상"을 실측(기록 023)으로 올린다 · on 0.999는 이 부하 · 범위의 기록값이며 13_nonfunctional 목표 확정 전까지 목표로 인용하지 않는다.
- 06_pipeline/06 — 끝이 최근 5분 안인 상대 범위는 SW-04와 무관하게 캐시되지 않는다는 판정 트리의 결과(S4 검수 L4)를 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "023",
  "exp": ["EXP-09"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T09:46:00.000Z", "end": "2026-09-25T10:21:50.000Z" },
  "run": { "commitHash": "3e8a46d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": ["on", "off"], "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device50-tag200-10000pps", "modeBMix": "mixed", "appRoles": ["api", "worker"], "snapshot": "s4-hist-m", "queryRate": 20, "queryTags": [1, 2, 201, 202], "relativeRange": { "fromAgoS": 86400, "toAgoS": 600 }, "sliceS": 10, "slices": 8, "warmupS": 10, "armOrder": "on-then-off", "k6": "grafana/k6:1.8.1", "baselineS": 240, "image": "db_study-api:3e8a46d", "clickhouseVersion": "26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0.036, "threshold": 0.2 },
  "results": [
    { "metric": "hit_rate_final", "arm": "on", "unit": "ratio", "values": [0.9994, 0.9988, 0.9988], "median": 0.9988 },
    { "metric": "hit_rate_final", "arm": "off", "unit": "ratio", "values": [0, 0, 0], "median": 0 },
    { "metric": "hit_rate_slice1", "arm": "on", "unit": "ratio", "values": [1.0, 0.995, 1.0], "median": 1.0 },
    { "metric": "hit_rate_slice1", "arm": "off", "unit": "ratio", "values": [0, 0, 0], "median": 0 },
    { "metric": "source_queries", "arm": "on", "unit": "count", "values": [1, 2, 2], "median": 2 },
    { "metric": "source_queries", "arm": "off", "unit": "count", "values": [1607, 1608, 1606], "median": 1607 },
    { "metric": "server_p50_ms", "arm": "on", "unit": "ms", "values": [8.0, 8.13, 7.85], "median": 8.0 },
    { "metric": "server_p50_ms", "arm": "off", "unit": "ms", "values": [24.62, 24.46, 24.62], "median": 24.62 },
    { "metric": "ac24_pass", "arm": "off", "unit": "bool", "values": [1, 1, 1], "median": 1 }
  ]
}
```
