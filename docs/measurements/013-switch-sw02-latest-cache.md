# 013 — SW-02 최신값 조회 on/off: 최신값 API 지연 · ClickHouse 점조회 수 · 대기 소진 수 (S2 수직 슬라이스)

> 실험: EXP-07 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T16:54:25Z ~ 17:30:42Z(반복 3 × 팔 2 · 팔마다 워밍업 10초 뒤 60초 창)

S2 수직 슬라이스(설비 1 · 태그 8 · SINE · 모드 A)에서 최신값 API(GET /api/v1/realtime/devices/1/tags)에 k6 고정 도착률 100 req/s를 걸고 SW-02만 on(Redis rt:latest HGETALL — RedisLatestValueReader) · off(ClickHouse 최근 창 argMax — ClickHouseLatestValueReader)로 바꿔 잰다. 반복 한 번은 on 팔 · off 팔 한 쌍이고, 팔마다 스냅샷을 복원한다. AC-18(SW-02 첫 비교)은 두 수치를 4요소와 함께 기록하는 것이 합격선이며 목표 대비 판정이 아니다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | d32b09a(health run.commitHash) — api 이미지 db_study-api:d32b09a는 정식 빌드가 아니다(§폐기 · 예외) |
| 이미지 · dist 컴파일 | 이미지 ID sha256:d61fe9c2afef38348435a017b379b4097bec93d6edbed1686e89f847f6ce4c40 · dist는 호스트 Node 22.23.3(nvm · .nvmrc)으로 컴파일 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(수직 슬라이스 — 설비 1 · 태그 8 부분 구성) |
| 스위치 | SW-02=off/on · 그 외 기본값 · SW-10 off · SW-11 ingest(전수는 기계 판독 블록) — 6팔 전부의 health switches를 대조해 SW-02 value · impl만 다르고 나머지 10종이 같음을 확인했다 |
| 주입 모드 · 시드 · 신호 프로파일 | A(api 안 레지스터 갱신 → Collector 폴링) · 42 · SINE |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음(기록 010과 같은 사유 — 모드 A 생성기는 api 프로세스 안) · 표준(api 0-4) |
| 조회 부하 | k6 grafana/k6:1.8.1 컨테이너 · cpuset 11-12 · compose 네트워크 안 http://api:3000(Host 대조 허용 이름) · constant-arrival-rate 100 req/s(도착률은 2계층 미정 — 이 기록의 조건 값) · 응답 본문 버림 |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 | 팔마다 스냅샷 s2-empty-slice 복원(시드 뒤 적재 행 0) |
| 팔 한 번의 구간 | 기준선 300초(api 정지 · 저장소 유휴 · docker stats) → api 기동(REDIS_LATEST_CACHE=on 또는 off · APP_ROLE=all) → 적재 누적 30초 → k6 전 consumer_lag 5회 관측 → k6 워밍업 10초 → 판정 창 60초(메트릭 캡처 두 점) → 회복 관측 |
| 팔 순서 | 반복 1 on → off · 반복 2 off → on · 반복 3 on → off(교대 — 순서 효과를 한쪽 팔에 몰지 않는다) |
| 반복 · 편차 | 3회 · 판정 지표 최대 편차 2.3%(서버 p50 on · 기준 20%) |
| 스크립트 | scripts/lab/s2/exp07.sh <출력> <반복> <팔>(인자 기본값 — 100 · 60 · 10 · 30 · 300) · scripts/lab/s2/k6-latest.js · scripts/lab/s2/hist-diff.py — 러너는 커밋 d32b09a 대비 미커밋 수정 판(회복 판정을 consumer_lag 0 → k6 전 수준 이하로 바꾼 판)으로 돌았다 |

- **판정 지표 네 종은 원천이 다르다.** 서버 p50 · p95는 http_request_duration_seconds(route 최신값 · code 200)의 캡처 두 점 차에 버킷 선형 보간을 한 추정이다. k6 p50 · p95는 클라이언트 정확 분위수다. ClickHouse 점조회 수는 system.query_log의 QueryFinish 중 argMax(value, ts) AS last_value를 담은 쿼리를 판정 창 시각으로 센 값이다. 대기 소진 수는 rlt_latest_lock_wait_exhausted_total 캡처 두 점의 차다.
- **회복은 lag 0이 아니라 k6 전 수준 이하로 판정한다.** 수집이 계속 돌아 pending이 창 하나만큼 늘 있다 — 6팔 전부 k6 전 consumer_lag 1 · k6 정지 뒤 1초 안에 1 이하로 돌아왔다.

반복별 판정 창과 부하 달성은 아래와 같다.

| 반복 | 팔 | 판정 창(UTC) | k6 요청 | 실패율 | 누락 반복 | 서버 히스토그램 표본 |
|------|------|------|------|------|------|------|
| 1 | on | 16:54:25 ~ 16:55:26 | 6,001 | 0 | 0 | 6,001 |
| 1 | off | 17:01:28 ~ 17:02:29 | 6,001 | 0 | 0 | 6,001 |
| 2 | off | 17:08:32 ~ 17:09:32 | 6,000 | 0 | 0 | 6,000 |
| 2 | on | 17:15:35 ~ 17:16:36 | 6,001 | 0 | 0 | 6,001 |
| 3 | on | 17:22:38 ~ 17:23:38 | 6,001 | 0 | 0 | 6,001 |
| 3 | off | 17:29:41 ~ 17:30:42 | 6,001 | 0 | 0 | 6,001 |

- **생성기 포화 판정 ②를 통과했다.** 6팔 전부 k6 누락 반복(dropped iterations) 0 · 요청 수가 100 req/s × 60초와 같다(10_observability/05 §생성기 포화 판정). 서버 히스토그램 표본 수가 k6 요청 수와 같아 두 원천이 같은 요청 집합을 센다.
- 기준선(api 정지 · 저장소 유휴) — ClickHouse CPU 3.03~3.40% · 메모리 703~782 MiB · PostgreSQL 약 47 MiB · Redis 약 11 MiB. 팔 사이에 바닥이 벌어지지 않았다.

## 결과

값의 순서는 반복 1 · 2 · 3이다(실행 순서가 아니다). 비 = off 중앙값 ÷ on 중앙값.

- **비는 원시 중앙값(raw/013-switch-sw02-latest-cache.jsonl의 반올림 전 값)으로 계산했다.** 표의 소수 셋째 자리 값으로 나누면 k6 p50은 5.259 ÷ 1.518 = 3.46배다 — 원시 5.259292 ÷ 1.517542 = 3.466이 3.47배로 반올림된 것이다. 나머지 셋은 두 기준에서 같다.

| 지표 | off 3회 | off 중앙값 | on 3회 | on 중앙값 | 비 | 편차 off · on |
|------|------|------|------|------|------|------|
| 서버 p50(ms · 버킷 보간) | 5.526 · 5.475 · 5.412 | **5.475** | 1.445 · 1.473 · 1.479 | **1.473** | 3.72배 | 2.1% · 2.3% |
| 서버 p95(ms · 버킷 보간) | 7.761 · 7.754 · 7.754 | **7.754** | 2.878 · 2.879 · 2.883 | **2.879** | 2.69배 | 0.1% · 0.2% |
| k6 p50(ms) | 5.262 · 5.259 · 5.232 | **5.259** | 1.518 · 1.514 · 1.540 | **1.518** | 3.47배 | 0.6% · 1.7% |
| k6 p95(ms) | 6.493 · 6.519 · 6.496 | **6.496** | 2.292 · 2.304 · 2.345 | **2.304** | 2.82배 | 0.4% · 2.3% |
| ClickHouse 점조회 수(창 60초) | 6,007 · 6,000 · 6,001 | **6,001** | 0 · 0 · 0 | **0** | 해당 없음 | 0.1% · 0% |
| 대기 소진 수(창 60초) | 0 · 0 · 0 | **0** | 0 · 0 · 0 | **0** | 해당 없음 | 0% · 0% |

- 검산: 판정 지표 6 × 팔 2 = results **12**행 · 최대 편차 2.3%(서버 p50 on) ≤ 기준 20% — status valid
- **값이 전부 0인 지표의 편차는 0으로 둔다.** (최대 − 최소) ÷ 중앙값이 0 ÷ 0이지만 세 값이 같아 흔들림이 없다 — 기계 판독 블록 repeat.deviation은 정의되는 지표의 최대값이다.
- 참고(판정 지표 아님) — k6 p99 중앙값 off 7.182 ms · on 3.899 ms.
- **버킷 보간 분위수 규칙 적용(10_observability/04 §반복과 폐기 · 기록 011 · 012 관측 뒤 정한 S2 규칙 — 이 기록 작성 뒤 적용).** 서버 p50 · p95는 양 팔 모두 한 버킷 안의 보간값이다(on 1~3 ms · off 5~8 ms) — 특히 on 팔 서버 p95(2.878 · 2.879 · 2.883)는 칸 안 보간이 만든 값이라 규칙상 참고다. 서버 값은 비와 방향만 인용하고(카탈로그 EXP-07 판정 지표 열) 판정은 k6 정확 분위수 · ClickHouse 점조회 수 · 대기 소진 수로 한다. 결과 status는 이 지표들로 그대로 valid다 — 서버 행을 빼고 센 최대 편차는 k6 p95 on의 2.3%(원시 (2.344792 − 2.292125) ÷ 2.304209 = 0.0229)다. 기계 판독 블록 results · repeat는 작성 시 값 그대로 둔다.

## 해석

- **SW-02 off는 on보다 p50 약 3.5배 · p95 약 2.8배 느리다(k6 기준).** 절대 차는 p50 3.74 ms · p95 4.19 ms이며 이것이 슬라이스 조건에서 요청 하나가 ClickHouse argMax 한 번에 쓰는 왕복 비용이다. 서버 히스토그램의 비(3.72배 · 2.69배)도 같은 방향 · 같은 크기다. 카탈로그 가설 "off의 p95가 on보다 크다"는 성립한다.
- **off의 ClickHouse 점조회 수는 요청 수와 같다 — 요청마다 argMax 1회.** 반복 2 · 3은 6,000 = 6,000 · 6,001 = 6,001로 정확히 같다. 반복 1의 6,007(요청 6,001 · 차 6)은 query_log event_time이 초 해상도라 창 양 끝 초를 포함해 세는 데서 온 것으로 추정한다 — 창 시작 초에 끝난 워밍업 k6 요청이 섞인다(검증하지 않았다). 기동 복원 argMax는 창 밖(기동 직후)이라 세지 않는다. on은 0 — Redis 경로가 ClickHouse를 한 번도 부르지 않았다.
- **대기 소진 0은 복원 락 경로를 타지 않았다는 뜻이다.** on 팔은 Ingest가 rt:latest를 늘 채워 두어(SW-11 ingest) 키 부재 → 락 → 대기 경로가 한 번도 열리지 않았다. off 팔은 Redis를 읽지 않으므로 락 경로 자체가 없다. 따라서 이 기록은 락 실패 대기(50 ms × 3회)의 **소진 수 0**만 주고, 대기 횟수 · 시간이 적절한지는 재지 않았다 — 키 부재를 만드는 실험(Redis 정지 · 축출)이 따로 잰다.
- **원본 예상치와 크게 다르다 — off 30~150 ms 대 실측 p95 6.5 ms · on 0.3~1 ms 대 실측 p95 2.3 ms.** off가 낮은 이유는 슬라이스의 행 수다. 팔마다 빈 스냅샷에서 시작해 판정 창까지 약 1~2분 적재했으므로 창 10분 argMax가 읽는 tag_raw는 태그 8 × 1 Hz × 수십~백수십 초 = 수백~천여 행 · 작은 파트 몇 개다(행 수를 따로 재지 않았다 — 적재 속도에서 추정). 원본 예상치는 M 티어급 행 누적 위의 argMax를 가정한다. on이 높은 이유는 원본 0.3~1 ms가 Redis 명령 자체의 시간이고, 여기서 잰 값은 NestJS 핸들러 전체(서버) 또는 Docker 브리지 왕복 포함(k6)이기 때문이다.
- **서버 p95와 k6 p95가 어긋나는 이유는 버킷 해상도다.** on 팔의 p50 · p95는 둘 다 버킷 1~3 ms 한 칸 안에 있다. 선형 보간은 칸 안 표본이 고르게 퍼졌다고 가정하므로, 표본이 1 ms 쪽에 몰린 실제 분포에서 p95를 칸 위쪽(2.88 ms)으로 끌어올린다 — k6 정확 p95는 2.30 ms다. 같은 이유로 on 서버 p95의 세 값이 거의 같다(2.878 · 2.879 · 2.883) — 분포가 안정했다는 증거가 아니라 한 칸 안 보간의 결과다. off 팔의 p50 · p95도 버킷 5~8 ms 한 칸 안이며, 서버 p50(5.48 ms)이 k6 p50(5.26 ms)보다 큰 것도 보간 오차다 — 서버 구간은 핸들러만이라 원래 k6보다 짧아야 한다. **이 기록의 절대값은 k6 값을 인용하고, 서버 값은 비와 방향만 인용한다.**
- 한계 — 10_observability/07 §측정 도구의 한계 등재 #1(히스토그램 분위수 보간 — k6 정확 분위수 병기로 완화) · §로컬 한계 "네트워크 지연"(루프백 · Docker 브리지라 k6 값이 낙관적) · "부하 생성기 격리"(k6는 11-12로 분리했지만 모드 A 생성기는 api 집합 안). 슬라이스는 행 수가 작아 off의 argMax 비용을 과소 측정한다 — M 티어 재측정(EXP-07 S5 · 모드 B)이 따로 있고, 두 기록의 수치를 한 비교로 묶지 않는다(04_architecture/07 S2 수직 슬라이스 규칙).

## 폐기 · 예외

- 폐기한 반복 없음 · 창에서 뺀 구간은 적재 누적 30초 · k6 워밍업 10초 · 회복 관측이다.
- **회복 판정은 프로토콜 ⑥(주입 정지 → 랙 0)이 아니라 k6 정지 뒤 k6 전 수준 이하다** — 모드 A 주입이 계속되는 조회 실험이라 pending이 창 하나만큼 늘 있다(프로토콜 예외).
- **api 이미지는 정식 빌드가 아니다.** Docker Desktop 레지스트리 프록시가 불통(기반 이미지 메타데이터 무한 대기 · Docker Desktop 재시작 뒤에도 같음)이라 d32b09a 이미지를 빌드하지 못했다. db_study-api:d32b09a는 db_study-api:fe64472 이미지 위에 d32b09a 깨끗한 트리에서 호스트 컴파일한 dist를 덮어쓰고 ENV COMMIT_HASH=d32b09a를 준 이미지다. fe64472 → d32b09a 변경은 collector 두 파일뿐이고 의존성은 같다 — health run.commitHash는 d32b09a를 보고한다. 기계 판독 블록 conditions.image에 fe64472+d32b09a-dist로 적는다.
- **ClickHouse 점조회 수 반복 1 off의 차 6은 폐기 사유가 아니다.** 편차 0.1%이고 원인이 창 경계 세기 방식(추정)이라 요청마다 1회라는 판정을 바꾸지 않는다.

## 정본 반영

반영은 리드가 한다. 아래는 이 기록을 쓸 때의 계획이다.

- docs/03_requirements/13_nonfunctional.md REQ-NFR-07 — SW-02 on/off 각각의 최신값 조회 p50 · p95(k6 값 인용 · 서버 버킷 추정 병기 · 기록 013 · d32b09a · 부하 실험 · S 부분 구성 · SW-02 on/off). 원본 목표 10 ms · 원본 예상치 칸은 지우지 않는다.
- docs/06_pipeline/05_realtime_read.md 미확인 표 "락 실패 대기 시간 · 횟수" 행 — 대기 소진 수 0(슬라이스 100 req/s · on/off 전 반복).
- docs/03_requirements/14_acceptance_criteria.md AC-18 — 두 수치가 4요소와 함께 기록됨(기록 013).

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "013",
  "exp": ["EXP-07"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T16:54:25.000Z", "end": "2026-09-24T17:30:42.000Z" },
  "run": { "commitHash": "d32b09a", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": ["on", "off"], "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "k6Cpuset": "11-12", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S2", "slice": "device1-tag8", "arrivalRate": 100, "windowS": 60, "warmupS": 10, "baselineS": 300, "image": "fe64472+d32b09a-dist", "imageId": "sha256:d61fe9c2afef38348435a017b379b4097bec93d6edbed1686e89f847f6ce4c40", "distCompiledWith": "node 22.23.3" },
  "repeat": { "runs": 3, "deviation": 0.0232, "threshold": 0.2 },
  "results": [
    { "metric": "server_p50", "arm": "on", "unit": "ms", "values": [1.445, 1.473, 1.479], "median": 1.473 },
    { "metric": "server_p50", "arm": "off", "unit": "ms", "values": [5.526, 5.475, 5.412], "median": 5.475 },
    { "metric": "server_p95", "arm": "on", "unit": "ms", "values": [2.878, 2.879, 2.883], "median": 2.879 },
    { "metric": "server_p95", "arm": "off", "unit": "ms", "values": [7.761, 7.754, 7.754], "median": 7.754 },
    { "metric": "k6_p50", "arm": "on", "unit": "ms", "values": [1.518, 1.514, 1.540], "median": 1.518 },
    { "metric": "k6_p50", "arm": "off", "unit": "ms", "values": [5.262, 5.259, 5.232], "median": 5.259 },
    { "metric": "k6_p95", "arm": "on", "unit": "ms", "values": [2.292, 2.304, 2.345], "median": 2.304 },
    { "metric": "k6_p95", "arm": "off", "unit": "ms", "values": [6.493, 6.519, 6.496], "median": 6.496 },
    { "metric": "clickhouse_point_queries", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "clickhouse_point_queries", "arm": "off", "unit": "count", "values": [6007, 6000, 6001], "median": 6001 },
    { "metric": "lock_wait_exhausted", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "lock_wait_exhausted", "arm": "off", "unit": "count", "values": [0, 0, 0], "median": 0 }
  ]
}
```
