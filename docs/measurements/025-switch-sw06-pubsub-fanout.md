# 025 — SW-06 Pub/Sub 팬아웃 on/off: 발행 → 게이트웨이 도착 지연과 프레임 내용 (S4 · 티어 M · 모드 A · api 인스턴스 1)

> 실험: EXP-11 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T11:05:30Z ~ 11:45:04Z(반복 3 × 팔 2 · 팔마다 고정 연결 창 60초)

같은 발행 부하(티어 M 모드 A · 설비 50이 초마다 적재 창을 거쳐 최신값을 발행)에서 SW-06만 바꾼다. on은 적재 경로가 ch:rt:{device_id}로 PUBLISH하고 게이트웨이가 구독해 받는다. off는 같은 프로세스의 게이트웨이를 직접 부른다(DirectGatewayFanout · APP_ROLE all만 · 제약 #6). 발행 시각 도장과 게이트웨이 도착 시각의 차를 rlt_fanout_delivery_seconds{channel}로 재고, 수신 프레임의 모양을 두 팔에서 대조한다. AC-40의 합격선은 지연의 on/off 쌍 기록과 프레임 내용 동일이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 35e8b8d(api 이미지 db_study-api:35e8b8d 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | M(설비 50 × 태그 200 · 10,000 pps) |
| 스위치 | SW-06=on/off(on RedisPubSubFanout · off DirectGatewayFanout · warning 없음) · SW-07 100 · 그 외 기본값 · 6팔의 health switches 대조로 SW-06 value · impl만 다름을 확인했다 |
| 주입 모드 · 역할 | A(SIM + Collector) · APP_ROLE all · api 인스턴스 1 — **카탈로그 조건 칸의 모드 B가 아니다(S4 판정 13)**: off가 all에서만 성립하고 all은 모드 A를 함께 띄워 모드 B를 겹치면 주입 모드가 둘이 된다 · 두 팔이 같은 모드 A 부하라 비교는 성립 |
| 연결 | k6 1.8.1 ws 연결 10개(설비 5개씩 · VU 번호로 흩음) + 프레임 수집기 1개(node · 설비 1~5 구독) |
| 관측 스택 · CPU 배치 | off · 표준(k6 11-12 · 수집기는 호스트 프로세스) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음 · 없음 |
| 초기 상태 · 기준선 | 팔마다 s3-empty-m 복원 · 기준선 240초 · 기동 뒤 20초 대기 |
| 팔 순서 | 반복마다 on → off |
| 반복 · 편차 | 3회 · 판정 지표 도착 지연 평균(합 ÷ 수 · 정확) 편차 on 5.6% · off 14.3% |
| 스크립트 | scripts/lab/s4/realtime-rep.sh <출력> exp11 <반복> <팔> · k6-ws.js · ws-capture.cjs · 원시 docs/measurements/raw/025-switch-sw06-pubsub-fanout.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원 · 기준선 · 기동   s3-empty-m → 240초 → api(APP_ROLE all · REDIS_PUBSUB_FANOUT on 또는 off) → 20초
② 연결                   k6 ws 10개(자식 · 같은 호출 안에서 거둔다) → 5초 → /metrics m0
③ 창                     수집기 60초(rt 프레임 요약) → /metrics m1
④ 판독                   rlt_fanout_delivery_seconds{channel pubsub 또는 direct} m0 → m1 버킷 차 · 수집기 요약 · ws_closes_total{4413}
```

- **도착 지연은 발행 → 게이트웨이 도착이다.** 발행자가 (설비 · 튜플 최대 ts · 튜플 수) 키로 도장을 찍고 게이트웨이가 같은 키로 찾아 뺀다 — 스로틀 창 대기와 소켓 송신은 들어가지 않는다. 역할이 나뉘면 도장을 못 찾아 재지 않는다(한 프로세스 전용 계측).
- **프레임 내용 대조는 모양 대조다.** 값과 ts는 시각이 달라 두 팔이 같을 수 없다 — 설비 집합 · 설비별 태그 집합 크기 · 튜플 길이 · 태그별 ts 역행 수를 대조한다.

## 결과

값의 순서는 반복 1 · 2 · 3이다.

| 팔 | 도착 수 | 평균(µs · 정확) | p50 · p95 · p99(µs · 버킷 보간 · 참고) | 수집기 프레임(60초) | 설비 · 태그 · 튜플 길이 | ts 역행 | 4413 |
|------|------|------|------|------|------|------|------|
| on | 3,000 · 3,000 · 3,000 | **333.7 · 352.8 · 336.3** | 1회 340 · 533 · 2,297 2회 345 · 704 · 3,171 3회 337 · 574 · 2,409 | 62 · 65 · 61 | 1~5 · 200 · 4 | 0 | 0 |
| off | 2,986 · 3,044 · 3,000 | **1.9 · 2.1 · 2.2** | 1회 50 · 95 · 99 2회 50 · 95 · 99 3회 50 · 95 · 99 | 90 · 62 · 62 | 1~5 · 200 · 4 | 0 | 0 |

- **AC-40 기록 성립 — 도착 지연 평균 on 336.3 µs · off 2.1 µs(3회 중앙값) · 프레임 모양 동일(설비 1~5 · 설비마다 태그 200 · 튜플 길이 4 · 역행 0) 3/3.**
- **off의 분위수는 버킷이 해상도를 못 준다.** rlt_fanout_delivery_seconds의 첫 칸이 100 µs라 off 도착은 전부 첫 칸에 들고 p50 50 · p95 95 µs는 칸 안 선형 보간이 만든 값이다. 판정은 합 ÷ 수(평균)로 한다.
- on의 p99(2.3~3.2 ms)는 Redis 왕복이 가끔 밀린 꼬리다. off는 같은 호출 스택 안이라 꼬리가 없다.
- 수집기 프레임 수는 창 100 ms 스로틀 아래에서 60초에 61~65가 기본이다. 반복 1 off의 90은 한 번만 나왔다(§폐기 · 예외).

## 해석

- **팬아웃 경계의 비용은 Redis 왕복 한 번 — 약 0.33 ms다.** 원본 예상치(1 ms 미만)와 같은 자릿수이며, 발행 → 화면 지연(수집기 수신 − ts p50 약 1.1초 · 적재 창 1초가 지배)에 비하면 0.03% 수준이다.
- **off가 싸다고 off를 쓰지 않는다.** Direct는 적재와 게이트웨이가 한 프로세스일 때만 성립한다 — api를 두 개 띄우거나 역할을 나누면 다른 인스턴스의 연결에 값이 가지 않는다(제약 #6). 이 기록은 경계 비용의 크기를 잰 것이지 off의 운영 채택 근거가 아니다.
- 한계 — 연결 11개 · 설비 5개 구독이다. 구독자 수가 많을 때 Redis 출력 버퍼와 게이트웨이 부하는 EXP-12 · S5가 본다.

## 폐기 · 예외

- 폐기한 반복 없음. 판정 지표 최대 편차 14.3%(off 평균 1.9 ~ 2.2 µs — 절대 차 0.3 µs).
- **반복 1 off 수집기 프레임 90은 재현되지 않았다(반복 2 · 3은 62).** 튜플 수 57,200은 다른 반복(59,000~60,000)과 같은 크기라 프레임이 쪼개져 온 것으로 보이며 원인은 미확인이다. 프레임 수는 판정 지표가 아니다.
- **반복 2의 두 팔은 호출 둘로 나뉘었다.** on과 off를 한 호출에 넣어 10분을 넘겨 도구가 호출을 중단했다 — on 줄은 완결된 뒤였고(원시에 있음), 끊긴 off는 줄이 없으며 다음 호출에서 단독으로 다시 돌렸다. 끊긴 실행은 팔 사이에 복원이 있어 다음 팔에 상태를 남기지 않는다.
- **판정 창 끝 시각은 원시 파일 수정 시각(11:45:04Z)이다** — 러너 줄에 벽시계 시각 필드가 없다. 시작은 기록 024 끝(11:05:20Z) 직후다.
- **팔 순서 on → off · 기준선 240초** — 기록 022와 같은 사유.

## 정본 반영

- 01_overview/05 S4 · 03_requirements/14 AC-40의 S4 근거로 인용한다.
- 02_features/13 SW-06 예상 행 — "지연 차는 루프백 1홉(1 ms 미만)"을 실측 약 0.33 ms(기록 025)로 올린다.
- 10_observability/01 rlt_fanout_delivery_seconds — 첫 칸 100 µs가 Direct 경로를 가르지 못한다는 사실과 합 ÷ 수 판정을 적는다(버킷 추가는 S5 판정 거리).
- 10_observability/06 EXP-11 조건 칸 — 모드 B → all + 모드 A(판정 13)를 반영한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "025",
  "exp": ["EXP-11"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T11:05:30.000Z", "end": "2026-09-25T11:45:04.000Z" },
  "run": { "commitHash": "35e8b8d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": ["on", "off"],
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device50-tag200-10000pps", "signalProfile": "SINE", "appRole": "all", "apiInstances": 1, "catalogModeDeviation": "mode A instead of B (S4 judgment 13)", "snapshot": "s3-empty-m", "wsConnections": 10, "devicesPerConnection": 5, "captureDevices": [1, 2, 3, 4, 5], "windowS": 60, "armOrder": "on-then-off", "k6": "grafana/k6:1.8.1", "baselineS": 240, "image": "db_study-api:35e8b8d", "clickhouseVersion": "26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0.143, "threshold": 0.2 },
  "results": [
    { "metric": "delivery_mean_us", "arm": "on", "unit": "us", "values": [333.7, 352.8, 336.3], "median": 336.3 },
    { "metric": "delivery_mean_us", "arm": "off", "unit": "us", "values": [1.9, 2.1, 2.2], "median": 2.1 },
    { "metric": "delivery_count", "arm": "on", "unit": "count", "values": [3000, 3000, 3000], "median": 3000 },
    { "metric": "delivery_count", "arm": "off", "unit": "count", "values": [2986, 3044, 3000], "median": 3000 },
    { "metric": "frame_shape_equal", "arm": "on-vs-off", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ts_backwards", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ts_backwards", "arm": "off", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "closes_4413", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "closes_4413", "arm": "off", "unit": "count", "values": [0, 0, 0], "median": 0 }
  ]
}
```
