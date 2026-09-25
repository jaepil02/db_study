# 026 — SW-07 WebSocket 스로틀 창 100 ms/0: 연결 계단의 연결당 프레임과 이벤트 루프 (S4 · 티어 M · 모드 A)

> 실험: EXP-12 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T11:45:10Z ~ 12:28:37Z(반복 3 × 팔 2 · 팔마다 연결 계단 10 → 50 → 100 · 계단 45초)

같은 갱신 부하(티어 M 모드 A)에서 SW-07만 바꾼다. 100은 WindowMergeThrottle(연결마다 100 ms 창 안 같은 태그는 ts 최대 하나 · 창 끝에 rt 프레임 1회), 0은 PassthroughThrottle(받은 대로 즉시)이다. k6 ws 연결을 10 · 50 · 100개 계단으로 올리고 계단마다 연결당 초당 프레임 · 이벤트 루프 지연 p95 · 4413 절단 수를 잰다. AC-41의 합격선은 연결당 초당 프레임과 nodejs_eventloop_lag_p95_seconds의 쌍 기록이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 35e8b8d(api 이미지 db_study-api:35e8b8d 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | M(설비 50 × 태그 200 · 10,000 pps) |
| 스위치 | SW-07=100/0(100 WindowMergeThrottle · 0 PassthroughThrottle) · 그 외 기본값 · 6팔의 health switches 대조로 SW-07 value · impl만 다름을 확인했다 |
| 주입 모드 · 역할 | A · APP_ROLE all(기록 025와 같은 구성 — S4 판정 13) |
| 연결 계단 | k6 1.8.1 ramping-vus 10(5초 램프 + 45초) → 50(5 + 45) → 100(5 + 45) · 연결마다 설비 5개 구독(VU 번호로 흩음 · 설비 50 전체에 고르게) |
| 관측 스택 · CPU 배치 | off · 표준(k6 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음 · 없음 |
| 초기 상태 · 기준선 | 팔마다 s3-empty-m 복원 · 기준선 240초 · 기동 뒤 20초 |
| 팔 순서 | 반복마다 100 → 0 |
| 반복 · 편차 | 3회 · 판정 지표 연결당 초당 프레임 편차 100 팔 4.0% · 0 팔 0.3% · 이벤트 루프 p95 편차 최대 7.3%(100 팔 · 연결 50) |
| 스크립트 | scripts/lab/s4/realtime-rep.sh <출력> exp12 <반복> <팔> 45 · k6-ws.js · 원시 docs/measurements/raw/026-switch-sw07-ws-throttle.jsonl |

계단마다 램프 5초를 건너뛴 뒤 /metrics를 캡처하고, 45초 뒤 다시 캡처해 두 점의 차로 판독한다.

```plain
계단 c(10 · 50 · 100)   5초 대기 → 캡처 a → 45초 → 캡처 b
                        연결당 초당 프레임 = ws_frames_sent_total{rt} 차 ÷ ws_connections(b) ÷ 45
                        이벤트 루프 p95  = nodejs_eventloop_lag_p95_seconds(b · 순간값)
                        병합 수          = rlt_throttle_merged_total 차
팔 전체                 4413 = ws_closes_total{close_code 4413} 차 · k6 ws_closed_4413
```

## 결과

값의 순서는 반복 1 · 2 · 3이다.

| 팔 | 연결 | 연결당 초당 프레임 | 이벤트 루프 p95(ms) | 병합 | 4413 |
|------|------|------|------|------|------|
| 100 | 10 | 1.044 · 1.049 · 1.036 | 14.90 · 14.96 · 15.20 | 0 | 0 |
| 100 | 50 | 1.029 · 1.044 · 1.051 | 15.49 · 15.20 · 14.38 | 0 | 0 |
| 100 | 100 | 1.053 · 1.011 · 1.051 | 15.29 · 15.07 · 15.16 | 0 | 0 |
| 0 | 10 | 5.000 · 5.000 · 5.000 | 15.05 · 14.91 · 15.12 | 0 | 0 |
| 0 | 50 | 5.000 · 5.000 · 5.000 | 14.76 · 14.97 · 14.98 | 0 | 0 |
| 0 | 100 | 5.000 · 5.000 · 4.984 | 14.34 · 15.00 · 14.97 | 0 | 0 |

- **AC-41 기록 성립 — 연결 100에서 연결당 초당 프레임 100 팔 1.051 · 0 팔 5.000 · 이벤트 루프 p95 100 팔 15.16 ms · 0 팔 14.97 ms(3회 중앙값).** 두 팔 모두 4413 절단 0.
- **창 0에서 연결당 프레임은 구독 설비 수(5)를 그대로 따라간다.** 적재가 1초 창마다 설비별로 한 번 발행하므로 0은 설비 5개 × 초당 1회 = 5 프레임이다. 100은 같은 초의 발행 다섯이 한 창에 모여 약 1 프레임이 된다.
- **병합 수가 0이다.** 한 창 안에 같은 태그 갱신이 두 번 오지 않는다 — 태그 주기 1초 > 창 100 ms라 스로틀은 설비 사이를 한 프레임으로 묶을 뿐 값을 버리지 않는다.
- 이벤트 루프 p95 약 15 ms는 두 팔 · 세 계단에서 같다 — 계측 정밀도(eventLoopMonitoringPrecision 10 ms)의 바닥에 붙은 값이다.

## 해석

- **이 부하에서 스로틀은 프레임 수를 5분의 1로 줄이지만 서버 비용 차는 보이지 않는다.** 연결 100 × 5 프레임/초 = 초당 500 송신은 이벤트 루프를 움직이지 못한다. 원본 예상치(초당 5,000 → 10)의 "폭증"은 태그 주기가 창보다 짧은 구성(100 ms 주기 · 티어 L)에서 나오는 현상이고, 티어 M 1초 주기에서는 재현되지 않는다.
- **스로틀의 이득은 화면 쪽이다.** 0 팔은 설비 수만큼 렌더 사건이 생기고 100 팔은 창마다 하나다 — 브라우저 비용은 이 기록이 재지 않았다.
- 한계 — 연결 상한 계단(100)과 태그 주기(1초)가 폭증 조건에 못 미친다. 4413 · 이벤트 루프 상승 · 동시 연결 상한은 S5 부하 계단(연결 수백 · 짧은 주기)에서 다시 잰다(카탈로그 단계 칸 S4 · S5).

## 폐기 · 예외

- 폐기한 반복 없음. 판정 지표 최대 편차 7.3%.
- **이벤트 루프 p95는 순간값이다.** 계단 끝 캡처 한 점의 게이지다 — 창 안 분포가 아니다. 두 팔 차가 계측 정밀도 안이라 차를 해석하지 않는다.
- **판정 창 끝은 원시 파일 수정 시각(12:28:37Z)이다** — 기록 025와 같은 사유.
- **팔 순서 100 → 0 · 기준선 240초** — 기록 022와 같은 사유.

## 정본 반영

- 01_overview/05 S4 · 03_requirements/14 AC-41의 S4 근거로 인용한다.
- 02_features/13 SW-07 예상 행 — 티어 M 1초 주기에서 연결당 초당 5 → 1 프레임 · 이벤트 루프 차 없음(기록 026)을 적고, 폭증 조건(주기 < 창)은 S5로 남긴다.
- 07_api/11 스로틀 병합 — 병합은 설비 사이 프레임 묶음이 주 효과이고 같은 태그 병합은 주기 < 창일 때만 생긴다는 관측을 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "026",
  "exp": ["EXP-12"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T11:45:10.000Z", "end": "2026-09-25T12:28:37.000Z" },
  "run": { "commitHash": "35e8b8d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": [100, 0], "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device50-tag200-10000pps", "signalProfile": "SINE", "appRole": "all", "connectionSteps": [10, 50, 100], "stepS": 45, "rampS": 5, "devicesPerConnection": 5, "armOrder": "100-then-0", "eventLoopPrecisionMs": 10, "k6": "grafana/k6:1.8.1", "baselineS": 240, "image": "db_study-api:35e8b8d", "clickhouseVersion": "26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0.073, "threshold": 0.2 },
  "results": [
    { "metric": "frames_per_conn_per_s_c100", "arm": "100", "unit": "frames/s", "values": [1.053, 1.011, 1.051], "median": 1.051 },
    { "metric": "frames_per_conn_per_s_c100", "arm": "0", "unit": "frames/s", "values": [5.0, 5.0, 4.984], "median": 5.0 },
    { "metric": "frames_per_conn_per_s_c10", "arm": "100", "unit": "frames/s", "values": [1.044, 1.049, 1.036], "median": 1.044 },
    { "metric": "frames_per_conn_per_s_c10", "arm": "0", "unit": "frames/s", "values": [5.0, 5.0, 5.0], "median": 5.0 },
    { "metric": "eventloop_p95_ms_c100", "arm": "100", "unit": "ms", "values": [15.29, 15.07, 15.16], "median": 15.16 },
    { "metric": "eventloop_p95_ms_c100", "arm": "0", "unit": "ms", "values": [14.34, 15.0, 14.97], "median": 14.97 },
    { "metric": "throttle_merged", "arm": "100", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "closes_4413", "arm": "100", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "closes_4413", "arm": "0", "unit": "count", "values": [0, 0, 0], "median": 0 }
  ]
}
```
