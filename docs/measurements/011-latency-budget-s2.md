# 011 — S2 지연 예산 분해(티어 S 전 구성 · 부하 실험 프로파일): 폴링 위상 우연으로 E2E 편차 초과 — 폐기

> 실험: EXP-30 · 상태: 폐기 · 정정 대상: 없음 · 판정 창: 2026-09-24T15:46:11Z ~ 15:57:20Z(반복 2회에서 중단)

티어 S 전 구성(설비 5 × 태그 50 · 250 pps)을 커밋 fe64472의 이미지로 띄워 E2E 지연 분위수와 구간 #2 · 6a · 6b · 6c · #7을 반복마다 잰 기록이다. **반복 2회 만에 E2E p50 편차가 폐기 기준 20%를 넘어 중단했고, 세 반복 전부 폐기 규칙에 따라 이 기록의 수치는 인용하지 않는다**(10_observability/04 §반복과 폐기). 조건을 다시 잡은 기록은 012다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fe64472(api 이미지 db_study-api:fe64472 · health run.commitHash) — 러너가 이미지에 들어갈 경로의 미커밋 변경을 거부한다 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 1 Hz · 250 pps · 04_architecture/07) |
| 스위치 | 전부 기본값(health switches — 전수는 기계 판독 블록) · SW-10 off · SW-11 ingest |
| 주입 모드 · 시드 · 신호 프로파일 | A(api 안 레지스터 갱신 → Collector 폴링) · 42 · SINE |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음 — 판정 창 끝 api 컨테이너 CPU 2.53% · 1.83%가 상한 · 표준(api 0-4) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| Collector 폴링 위상 | 고정 없음 — 설비마다 연결 즉시 1 Hz 루프 시작(기동 순간이 위상을 정한다) |
| 초기 상태 | 반복마다 스냅샷 s2-empty-s 복원 |
| 기준선 · 워밍업 · 판정 창 | 300초(api 정지 · 저장소 유휴 · docker stats) · 20초 · 150초(메트릭 캡처 두 점) |
| 반복 · 편차 | 2회(중단) · 판정 지표 최대 편차 43.5%(E2E p50 · 기준 20%) |
| 스크립트 | scripts/lab/s2/run-rep.sh <출력> s2-empty-s S <반복> · scripts/lab/s2/hist-diff.py · apps/api/src/lab/s2-verify.ts(--phase running · stopped) |

반복 한 번의 절차는 기록 010과 같은 러너의 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s2-empty-s
③ 기준선        300초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=all로 api 기동 → health 200 → health 응답 보관(run · switches)
④ 워밍업        20초
⑤ 판정 창       /metrics 캡처 m0 → 150초 → m1 · docker stats 1회
   AC-04        api 기동 중 — tag_raw 최신 행 하나의 epoch를 시계열 API · 최신값 API의 ts와 대조
⑥ 수집 정지     api 정상 종료(Collector 정지 → Ingest 드레인 · XACK) · 정지 로그의 points_emitted 누계
⑦ 정합          정지 상태 — 그룹 lag · pending 0 확인 → AC-01 · AC-07 · E2E 기록 SQL(quantilesExact · 판정 창 고정)
```

- **E2E는 기록 SQL의 정확 분위수다.** 10_observability/02 §E2E 지연 SQL의 기록 쿼리(quantilesExact(0.50, 0.95, 0.99) · ts로 판정 창 고정)를 정지 뒤 1회 돌렸다.
- **구간 값은 히스토그램 차의 버킷 선형 보간 추정이다.** hist-diff.py가 판정 창 m1 − m0 누적 버킷에서 분위수를 보간한다 — 버킷 경계가 해상도다.

## 결과

| 반복 | 판정 창(UTC) | E2E p50 | E2E p95 | E2E p99 | 창 안 행 |
|------|------|------|------|------|------|
| 1 | 2026-09-24T15:46:11Z ~ 15:48:41Z | 1,004 ms | 1,012 ms | 1,014 ms | 37,500 |
| 2 | 2026-09-24T15:54:50Z ~ 15:57:20Z | 645 ms | 713 ms | 729 ms | 37,500 |
| 편차 | — | **43.5%** | 34.7% | 32.7% | — |

- 창 안 행 37,500 = 150초 × 태그 250 × 1 Hz — 두 반복 모두 판정 창에 폴링 누락이 없다.
- 편차는 (최대 − 최소) ÷ 중앙값이며, 두 값의 중앙값은 평균이다(E2E p50 — (1,004 − 645) ÷ 824.5 = 0.4354). 커밋 d32b09a 메시지의 "약 36%"는 최대값(1,004)으로 나눈 값이라 규약 식과 다르다 — 이 기록은 규약 식의 값을 적는다.

| 구간 지표 | 구간 | 반복 1 · 2 p50(ms) | 편차 | 반복 1 · 2 p95(ms · 참고) | 반복 1 · 2 평균(ms) | 관측 수 |
|------|------|------|------|------|------|------|
| col_modbus_rtt_seconds | #2 | 1.24 · 1.43 | 14.0% | 2.99 · 3.69 | 1.32 · 1.38 | 750 · 750 |
| poll_duration | 폴링 사이클(참고) | 2.48 · 2.27 | 8.5% | 5.84 · 5.23 | 2.67 · 2.46 | 750 · 750 |
| ing_stream_residence_seconds | 6a | 0.84 · 0.75 | 11.1% | 2.90 · 2.81 | 1.33 · 1.11 | 750 · 750 |
| ing_decode_seconds | 6b | 0.66 · 0.67 | 0.6% | 1.50 · 2.26 | 0.79 · 0.86 | 471 · 442 |
| ing_fanin_wait_seconds | 6c | 842.17 · 597.73 | **34.0%** | 1,220.15 · 949.52 | 994.54 · 601.30 | 750 · 750 |
| insert_duration | #7 | 10.83 · 11.83 | 8.8% | 14.58 · 14.76 | 10.15 · 11.29 | 150 · 150 |

- 구간 판정 지표는 p50이다 — 판정 기준의 근거는 기록 012 §폐기 · 예외에 적는다. p95 열은 참고다.

| 반복 | 정지 뒤 lag · pending | points_emitted | Stream 엔트리 · 포인트 | tag_raw | 차 | 해독 불가 | AC-07 비교 · 불일치 · 누락 | AC-04 차 ms(시계열 · 최신값) |
|------|------|------|------|------|------|------|------|------|
| 1 | 0 · 0 | 43,300 | 866 · 43,300 | 43,300 | **0** | 0 | 250 · **0** · 0 | **0** · **0** |
| 2 | 0 · 0 | 43,300 | 866 · 43,300 | 43,300 | **0** | 0 | 250 · **0** · 0 | **0** · **0** |

- 설비별 대조(설비 1~5)도 두 반복 모두 Stream 포인트 = tag_raw다(8,700 · 8,650 · 8,650 · 8,650 · 8,650).

| 반복 | 기준선(api 정지) clickhouse · redis · postgres CPU | 판정 창 끝 api CPU · 메모리 | 판정 창 끝 clickhouse CPU · 메모리 |
|------|------|------|------|
| 1 | 3.31% · 0.27% · 0.00% | 2.53% · 118.1 MiB | 6.52% · 841.7 MiB |
| 2 | 3.12% · 0.29% · 0.00% | 1.83% · 116 MiB | 5.22% · 949.1 MiB |

## 해석

- **편차의 원인은 측정 잡음이 아니라 조건이다.** 1 Hz 폴링과 창 W 1,000 ms(엔트리 ID 시각 정렬 · 유예 100 ms — apps/api/src/modules/ingest/window-buffer.ts)가 같은 주기라, 엔트리가 창 안의 어느 위상에 떨어지는지가 기동 순간의 폴링 위상 하나로 정해지고 그 위상은 기동마다 우연이다. 설비 5개가 같은 순간 루프를 시작하므로 다섯 설비가 한 위상에 몰린다.
- **반복 1은 창 시작 직후에, 반복 2는 창 중간에 몰렸다.** 반복 1의 E2E p50 · p95 · p99가 1,004 · 1,012 · 1,014 ms로 좁게 모인 것은 엔트리가 창 경계 직후에 도착해 창 하나 + 유예를 거의 다 기다렸다는 뜻이다. 반복 2(645 · 713 · 729 ms)는 창 중간 근처에 도착했다. 6c 평균(994.54 → 601.30 ms)이 E2E와 같은 방향으로 움직이고, 나머지 구간(#2 · 6a · 6b · #7)의 p50 합은 두 반복 모두 15 ms 이하다 — **E2E 차이는 전부 6c에서 온다.**
- **반복 3을 돌리지 않았다.** 편차 초과는 반복 2에서 확정됐고(세 번째 값이 무엇이든 최대 − 최소는 359 ms 아래로 줄지 않고 중앙값은 1,004 ms를 넘지 않아 편차가 35.8% 아래로 내려가지 않는다 — 커밋 메시지의 "약 36%"가 이 하한이다), 원인이 코드의 위상 조건이라 반복을 늘려도 성립하지 않는다.
- **구조 판정은 두 반복 모두 성립했다.** AC-01(차 0 · 해독 불가 0) · AC-07(250태그 불일치 0) · AC-04 API 쪽(차 0 ms)이 반복마다 같다. 다만 이 기록은 폐기이고 반복이 2회라 **구조 판정의 합격 근거로도 인용하지 않는다** — 구조 판정 3회 성립은 기록 012가 갖는다.
- 한계 — 구간 분위수는 히스토그램 보간값이다(07_measurement_limits 한계 #1). E2E는 기록 SQL의 정확 분위수이고(한계 #2), 같은 머신 시계 위에서만 성립한다(한계 #6).

## 폐기 · 예외

- **폐기 — 두 반복 전부.** 판정 지표 E2E p50(43.5%) · p95(34.7%) · p99(32.7%) · 6c p50(34.0%)이 기준 20%를 넘는다. 규약상 넘는 지표가 하나라도 있으면 전부 폐기다.
- 반복 3은 실행하지 않았다(§해석). repeat.runs는 실제 실행 수 2다.
- **조건을 다시 잡은 조치** — 커밋 d32b09a가 Collector 시작 위상을 벽시계 주기 격자 위의 설비별 오프셋 (i + 0.5) × scan_rate_ms ÷ N으로 고정했다(N = 5 → 100 · 300 · 500 · 700 · 900 ms). 위상이 기동마다 같아지고 설비들의 발행이 창 안에 고르게 퍼진다. 0.5칸은 모드 A 생성기의 격자 갱신 순간을 비킨다. 새 기록은 012다.
- 창에서 뺀 구간은 워밍업 20초와 정지 전이(판정 창 끝 → 정상 종료)다.

## 정본 반영

- 없음 — 폐기 기록이라 정본에 올리지 않는다. 폐기 사유(폴링 1 Hz = 창 W 주기 · 위상 우연)는 기록 012가 조건으로 반영했다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "011",
  "exp": ["EXP-30"],
  "status": "discarded",
  "supersedes": null,
  "window": { "start": "2026-09-24T15:46:11.000Z", "end": "2026-09-24T15:57:20.000Z" },
  "run": { "commitHash": "fe64472", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S2", "tierConfig": "device5-tag50-250pps", "signalProfile": "SINE", "snapshot": "s2-empty-s", "pollPhase": "none", "baselineS": 300, "warmupS": 20, "windowS": 150, "discardReason": "E2E p50 deviation 0.4354 > 0.2 — poll phase at boot decides fan-in wait (poll 1 Hz = window W 1000 ms)" },
  "repeat": { "runs": 2, "deviation": 0.4354, "threshold": 0.2 },
  "results": [
    { "metric": "e2e_p50_ms", "arm": "tier-S", "unit": "ms", "values": [1004, 645], "median": 824.5 },
    { "metric": "e2e_p95_ms", "arm": "tier-S", "unit": "ms", "values": [1012, 713], "median": 862.5 },
    { "metric": "e2e_p99_ms", "arm": "tier-S", "unit": "ms", "values": [1014, 729], "median": 871.5 },
    { "metric": "col_modbus_rtt_p50_ms", "arm": "tier-S", "unit": "ms", "values": [1.24, 1.43], "median": 1.34 },
    { "metric": "ing_stream_residence_p50_ms", "arm": "tier-S", "unit": "ms", "values": [0.84, 0.75], "median": 0.79 },
    { "metric": "ing_decode_p50_ms", "arm": "tier-S", "unit": "ms", "values": [0.66, 0.67], "median": 0.66 },
    { "metric": "ing_fanin_wait_p50_ms", "arm": "tier-S", "unit": "ms", "values": [842.17, 597.73], "median": 719.95 },
    { "metric": "insert_duration_p50_ms", "arm": "tier-S", "unit": "ms", "values": [10.83, 11.83], "median": 11.33 }
  ]
}
```
