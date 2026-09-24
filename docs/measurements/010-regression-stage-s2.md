# 010 — S2 구조 판정 회귀(수직 슬라이스 · 부하 실험 프로파일): 무손실 · 시간대 · 최신값 AC 성립

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T15:14:16Z ~ 15:40:13Z(반복 3회)

S2 수직 슬라이스(설비 1 · 태그 8 · SINE · 모드 A)를 커밋 fe64472의 이미지로 띄워 AC-01 · AC-04 · AC-07을 반복마다 다시 판정한다. AC-17은 육안 판정 1회만 있고 반복 3회 대상이 아니다(§폐기 · 예외). 반복별 판정 창은 결과 표 아래에 적는다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fe64472(api 이미지 db_study-api:fe64472 · health run.commitHash) — 러너가 이미지에 들어갈 경로의 미커밋 변경을 거부한다 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(수직 슬라이스 — 설비 1 · 태그 8 부분 구성 · 04_architecture/07) |
| 스위치 | 전부 기본값(health switches — 전수는 기계 판독 블록) · SW-10 off · SW-11 ingest |
| 주입 모드 · 시드 · 신호 프로파일 | A(api 안 레지스터 갱신 → Collector 폴링) · 42 · SINE |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음(아래 불릿) · 표준(api 0-4) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 | 반복마다 스냅샷 s2-empty-slice 복원(시드 뒤 적재 행 0) |
| 기준선 · 워밍업 · 판정 창 | 300초(api 정지 · 저장소 유휴 · docker stats) · 20초 · 150초(메트릭 캡처 두 점) |
| 반복 · 편차 | 3회 · 구조 판정이라 편차 폐기를 적용하지 않는다(repeat.deviation 0) |
| 스크립트 | scripts/lab/s2/run-rep.sh <출력> s2-empty-slice S <반복> · apps/api/src/lab/s2-verify.ts(--phase running · stopped) |

- **생성기 CPU를 따로 재지 않았다.** 모드 A의 생성기는 api 프로세스 안에서 레지스터를 초당 8개 갱신할 뿐이라 별도 프로세스가 없다 — 판정 창 끝의 api 컨테이너 CPU(1.69% · 1.53% · 1.51%)가 생성기 몫의 상한이다. 기계 판독 블록 conditions.generatorCpuMax는 null이다.

반복 한 번의 절차는 아래 순서다. 흐름 쪽 8단계와 대응하며, ⑥ 뒤에 api를 다시 띄우지 않는다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s2-empty-slice
③ 기준선        300초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=all로 api 기동 → health 200 → health 응답 보관(run · switches)
④ 워밍업        20초
⑤ 판정 창       /metrics 캡처 m0 → 150초 → m1 · docker stats 1회
   AC-04        api 기동 중 — tag_raw 최신 행 하나의 epoch를 시계열 API · 최신값 API의 ts와 대조
⑥ 수집 정지     api 정상 종료(Collector 정지 → Ingest 드레인 · XACK) · 정지 로그의 points_emitted 누계
⑦ 정합          정지 상태 — 그룹 lag · pending 0 확인(아니면 반복 불성립 · exit 1) → AC-01 · AC-07 · E2E 기록 SQL
```

- **AC-04만 api가 떠 있을 때 잰다.** 시계열 · 최신값 API 응답이 판정 대상이기 때문이다 — 나머지 둘은 적재 중 행이 없어야 판정된다.
- **⑦은 api를 다시 띄우지 않는다.** 재기동의 기동 복원(argMax → rt:latest)이 AC-07을 복원값끼리의 비교로 만든다 — 정지 직전 Ingest가 쓴 rt:latest를 그대로 대조한다.
- **AC-01은 세 수를 맞춘다.** Stream 전 엔트리를 디코딩한 포인트 합 · points_emitted 정지 누계 · tag_raw count() — 모드 A의 분모는 points_emitted다(10_observability/01 §파생 지표).

## 결과

| 반복 | 정지 뒤 lag · pending | points_emitted | Stream 엔트리 · 포인트 | tag_raw | 차 | 해독 불가 | AC-07 비교 · 불일치 · 누락 | AC-04 차 ms(시계열 · 최신값) |
|------|------|------|------|------|------|------|------|------|
| 1 | 0 · 0 | 1,392 | 174 · 1,392 | 1,392 | **0** | 0 | 8 · **0** · 0 | **0** · **0** |
| 2 | 0 · 0 | 1,392 | 174 · 1,392 | 1,392 | **0** | 0 | 8 · **0** · 0 | **0** · **0** |
| 3 | 0 · 0 | 1,392 | 174 · 1,392 | 1,392 | **0** | 0 | 8 · **0** · 0 | **0** · **0** |

- **AC-01 성립 3/3 · AC-04(API 쪽) 성립 3/3 · AC-07 성립 3/3.** 반복마다 points_emitted = Stream 디코딩 포인트 합 = tag_raw count()이고, XLEN(174)이 XRANGE로 센 엔트리 수와 같다. 설비별 대조(설비 1)도 1,392 · 1,392로 같다.
- AC-04 대조 행: 반복 1 epoch 1790263007615(2026-09-25 00:16:47.615 KST) · 반복 2 1790263498083(00:24:58.083) · 반복 3 1790264414323(00:40:14.323) — 세 반복 모두 시계열 API · 최신값 API가 같은 밀리초를 돌려준다.
- AC-07은 전 태그 8개의 ts · value · quality를 대조했다 — 불일치 표본은 비어 있다.

| 반복 | 판정 창(UTC) | 창 안 tag_raw 행 |
|------|------|------|
| 1 | 2026-09-24T15:14:16Z ~ 15:16:46Z | 1,200 |
| 2 | 2026-09-24T15:22:26Z ~ 15:24:56Z | 1,200 |
| 3 | 2026-09-24T15:37:43Z ~ 15:40:13Z | 1,200 |

- 창 안 행 1,200 = 150초 × 태그 8 × 1 Hz — 판정 창에 폴링 누락이 없다.

참고 — E2E 기록 SQL(quantilesExact(ingested_at − ts) · 판정 창 고정)과 구간 히스토그램(판정 창 m1 − m0 · 버킷 보간 분위수)이다. 판정에 쓰지 않는다 — **AC-03 기록은 EXP-30(기록 012)이다.**

| 반복 | E2E p50 | E2E p95 | E2E p99 | 행 |
|------|------|------|------|------|
| 1 | 857 ms | 908 ms | 918 ms | 1,200 |
| 2 | 1,009 ms | 1,013 ms | 1,015 ms | 1,200 |
| 3 | 1,009 ms | 1,013 ms | 1,014 ms | 1,200 |

| 구간 지표 | 반복 1 p50 · p95 · 평균(ms) | 반복 2 p50 · p95 · 평균(ms) | 반복 3 p50 · p95 · 평균(ms) | 관측 수 |
|------|------|------|------|------|
| col_modbus_rtt_seconds | 1.59 · 2.91 · 1.13 | 1.71 · 2.89 · 1.13 | 1.74 · 2.89 · 1.12 | 150 · 150 · 150 |
| poll_duration | 3.11 · 4.93 · 3.01 | 3.71 · 4.94 · 3.23 | 3.82 · 4.94 · 3.30 | 150 · 150 · 150 |
| ing_stream_residence_seconds | 0.53 · 0.99 · 0.60 | 0.67 · 1.00 · 0.79 | 0.68 · 0.99 · 0.81 | 150 · 150 · 150 |
| ing_decode_seconds | 0.74 · 1.50 · 0.97 | 0.74 · 2.00 · 0.98 | 0.76 · 2.00 · 1.03 | 150 · 150 · 150 |
| ing_fanin_wait_seconds | 825.00 · 982.50 · 812.27 | 944.94 · 1,438.52 · 1,000.02 | 941.67 · 1,437.50 · 999.96 | 150 · 150 · 150 |
| insert_duration | 10.84 · 14.63 · 10.49 | 10.48 · 14.55 · 9.73 | 10.79 · 14.58 · 9.75 | 150 · 150 · 150 |

| 반복 | 기준선(api 정지) clickhouse · redis · postgres CPU | 판정 창 끝 api CPU · 메모리 | 판정 창 끝 clickhouse CPU · 메모리 |
|------|------|------|------|
| 1 | 6.01% · 1.41% · 0.00% | 1.69% · 95.46 MiB | 3.27% · 772.7 MiB |
| 2 | 2.96% · 0.29% · 0.00% | 1.53% · 96.25 MiB | 8.57% · 795.4 MiB |
| 3 | 3.22% · 0.25% · 0.00% | 1.51% · 101.9 MiB | 5.65% · 759.9 MiB |

- 자원 값은 docker stats 순간 표본 1회씩이다 — 추세가 아니라 바닥의 크기만 보인다.

## 해석

- **S2 슬라이스에서 무손실 · 시간대(API 쪽) · 최신값 정확성이 3회 모두 성립한다.** 차 0 · 오차 0 ms · 불일치 0이 반복마다 같고, 구조 판정이라 3회 전부 성립이 합격이다(10_observability/04 §구조 판정과 분포 판정).
- **수집 중 대조를 하지 않는 이유가 이 기록에 나타난다.** AC-04 시점(api 기동 중)의 그룹 상태는 세 반복 모두 lag 0 · pending 1이다 — 판정 창 동안 엔트리 하나가 fan-in 대기 중이라 그 순간 대조하면 적재 중 행이 차로 잡힌다. 정지 뒤에는 pending 0이 되어 대조가 성립한다.
- **E2E p50이 반복 1(857 ms)과 반복 2 · 3(1,009 ms)에서 다르다.** 폴링 1 Hz와 창 W 1,000 ms가 같은 주기라 엔트리가 창 안의 같은 위상에 떨어지고, 그 위상은 기동마다 달라진다 — 지배 구간은 fan-in 대기(6c)이며 구간 표에서 반복 1의 ing_fanin_wait_seconds 평균 812 ms가 반복 2 · 3(1,000 ms)보다 짧은 것과 방향이 같다. 나머지 구간(폴링 · Stream 체류 · 디코딩 · INSERT)은 p50 합이 반복마다 20 ms 이하다. EXP-29는 구조 판정이라 이 차이에 편차 폐기를 적용하지 않는다. 위상 고정은 d32b09a(기록 012)다.
- **판정 창 행 수 1,200은 폴링 표본 누락이 없다는 교차 확인이다.** 초당 8포인트 × 150초이고, 전 기간 1,392 = 엔트리 174 × 태그 8(엔트리 하나가 폴링 한 번)이다.
- 한계 — 구간 분위수는 히스토그램 보간값이다(07_measurement_limits 한계 #1): col_modbus_rtt_seconds의 p50(1.59 ms)이 평균(1.13 ms)보다 큰 것은 버킷 보간 탓이며 분포의 모양이 아니다. E2E는 기록 SQL의 정확 분위수이고(한계 #2), 같은 머신 시계 위에서만 성립한다(한계 #6).

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음 · 창에서 뺀 구간은 워밍업 20초와 정지 전이(판정 창 끝 → 정상 종료)다.
- **AC-17은 육안 판정 1회 · 커밋 전 트리라 반복 3회 판정에 넣지 않는다.** 2026-09-24 23:53 KST 통합 기동(커밋 fe64472 이전 작업 트리 · 슬라이스)에서 헤드리스 Chromium으로 http://localhost:3001/realtime/1을 10초 간격 2회 촬영했다 — 8태그 sin 파형이 그려지고, 최신값 표 태그 1이 23.676(23:53:18 KST) → 24.973(23:53:28 KST)으로 갱신됐으며, 페이지 오류 0 · WebSocket 1 프레임/초였다. 판정 대상 커밋과 트리가 달라 4요소를 갖춘 성립으로 세지 않는다.
- **AC-04의 웹 표시 쪽(Asia/Seoul 변환 1회)은 이 기록이 판정하지 않았다.** 러너는 API 응답 ts만 저장 epoch와 대조한다 — 위 AC-17 관찰의 KST 표시는 epoch 대조 없이 읽은 값이다.

## 정본 반영

- 없음 — 구조 판정 성립 기록이다. S2 합격(01_overview/05)은 리드가 문서 커밋에서 이 기록을 인용한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "010",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T15:14:16.000Z", "end": "2026-09-24T15:40:13.000Z" },
  "run": { "commitHash": "fe64472", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S2", "slice": "device1-tag8", "signalProfile": "SINE", "snapshot": "s2-empty-slice", "baselineS": 300, "warmupS": 20, "windowS": 150 },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "lag_after_stop", "arm": "AC-01", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "pending_after_stop", "arm": "AC-01", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "points_emitted", "arm": "AC-01", "unit": "points", "values": [1392, 1392, 1392], "median": 1392 },
    { "metric": "ac01_stream_points", "arm": "AC-01", "unit": "points", "values": [1392, 1392, 1392], "median": 1392 },
    { "metric": "ac01_tag_raw_rows", "arm": "AC-01", "unit": "rows", "values": [1392, 1392, 1392], "median": 1392 },
    { "metric": "ac01_diff", "arm": "AC-01", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_undecodable", "arm": "AC-01", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac07_compared", "arm": "AC-07", "unit": "tags", "values": [8, 8, 8], "median": 8 },
    { "metric": "ac07_mismatched", "arm": "AC-07", "unit": "tags", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac07_missing_in_redis", "arm": "AC-07", "unit": "tags", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "AC-04-timeseries", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "AC-04-latest", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "e2e_p50_ms", "arm": "reference", "unit": "ms", "values": [857, 1009, 1009], "median": 1009 },
    { "metric": "e2e_p95_ms", "arm": "reference", "unit": "ms", "values": [908, 1013, 1013], "median": 1013 },
    { "metric": "e2e_p99_ms", "arm": "reference", "unit": "ms", "values": [918, 1015, 1014], "median": 1014 }
  ]
}
```
