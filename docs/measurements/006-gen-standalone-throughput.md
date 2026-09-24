# 006 — 생성기 단독 처리량: 워커 수 · CPU 위치별 생성 + MessagePack 인코딩 pps (S1)

> 실험: EXP-21 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T12:58:41Z ~ 13:09:26Z(조건 6 × 반복 3 · 반복마다 워밍업 5초 뒤 30초 창)

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 410a146(api 이미지 db_study-api:410a146 · 빌드 인자 COMMIT_HASH) |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(cgroup memory.max — 설정 로더 runInfo) |
| 용량 티어 | M(설비 50 × 태그 200 · 1 Hz — 생성은 주기를 따르지 않고 최대 속도) |
| 스위치 | 전부 기본값(설정 로더 출력 · 전수는 기계 판독 블록) — 이 실험의 경로에는 스위치가 개입하지 않는다 |
| 주입 모드 · 시드 | 없음(단독 실행 경로 — XADD 없음) · 42 |
| 신호 프로파일 | 혼합(STEP 40% · SINE 40% · RANDOM_WALK 20% — 06_pipeline/10) |
| 실행 경로 | APP_ROLE=datagen · node dist/bench.js · piscina 워커 1 · 2 · 4 · 창 10시점 × 설비 묶음 10(묶음당 설비 5) |
| CPU 위치 | api 위치 cpuset 0-4(vCPU 5) · datagen 위치 cpuset 11-12(vCPU 2) — 04_architecture/03 §cpuset 배치 |
| 관측 스택 · 생성기 CPU | off · 최대 4.01코어(결과 표의 프로세스 CPU 열 · 기계 판독 블록 conditions.generatorCpuMax) |
| 압축 · swap · 네트워킹 · SIM 계획 | 해당 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop · VM 15.6 GB) · 없음 |
| 저장소 | 부하 실험 프로파일로 떠 있으나 유휴(이 실험은 저장소를 쓰지 않는다) |
| 반복 · 편차 | 3회 · 판정 지표 최대 편차 10.7%(기준 20%) |
| 스크립트 | scripts/lab/s1/gen-bench.sh <출력> api · datagen(커밋 410a146 시점의 인자 — 티어 M · 혼합 · 워커 1 2 4 고정) |

## 결과

| 위치 | 워커 | pps 3회 | 중앙값 pps | 편차 | 워커 사용률 | 프로세스 CPU(코어) | 엔트리당 바이트 | 합격선 대비 |
|------|------|------|------|------|------|------|------|------|
| api 0-4 | 1 | 5,896,557 · 5,894,076 · 6,225,818 | **5,896,557** | 5.6% | 0.964 | 1.02 | 2,189 | 197배 |
| api 0-4 | 2 | 9,671,308 · 10,309,368 · 10,778,807 | **10,309,368** | 10.7% | 0.967 | 2.03 | 2,201 | 344배 |
| api 0-4 | 4 | 20,469,777 · 20,057,728 · 18,414,383 | **20,057,728** | 10.3% | 0.953 | 4.00 | 2,201 | 669배 |
| datagen 11-12 | 1 | 5,853,360 · 6,088,103 · 6,152,079 | **6,088,103** | 4.9% | 0.958 | 1.01 | 2,196 | 203배 |
| datagen 11-12 | 2 | 10,582,166 · 10,359,768 · 10,210,961 | **10,359,768** | 3.6% | 0.957 | 1.95 | 2,201 | 345배 |
| datagen 11-12 | 4 | 10,620,824 · 10,449,575 · 10,434,883 | **10,449,575** | 1.8% | 0.718 | 1.96 | 2,201 | 348배 |

- 합격선 = M 티어 초당 포인트 10,000 × 3 = 30,000 pps(REQ-NFR-17 · AC-16). **모든 조건이 합격선을 넘는다** — 가장 낮은 조건(워커 1)도 약 590만 pps다.
- 엔트리당 바이트 차이(2,189 · 2,196 · 2,201)는 창 경계 잘림에서 온다 — 계측 창에 들어온 엔트리 구성이 조금 다르다. 크기의 정본 실측은 기록 007 · 008 · 009(티어별)다.

## 해석

- **생성기는 병목이 아니다(S1 합격).** 생성기 여유 ①(단독 상한 ≥ 지정 부하 × 3)은 M 티어에서 수백 배로 성립한다. 원본 예상치("20스레드 머신에서 미달 가능성 낮음")와 방향이 같다. 전환 조건 ①(생성기 분리 · Python 생성기)은 발동하지 않는다.
- **처리량은 워커 수에 거의 선형이다 — 단, CPU 집합 안에서만.** api 위치(vCPU 5)에서 워커 1 → 2 → 4가 1.00 → 1.75 → 3.40배이고, 프로세스 CPU가 워커 수만큼 쓰인다(사용률 0.95~0.97). datagen 위치(vCPU 2)의 워커 4는 워커 2와 같은 처리량에 사용률이 0.72로 떨어진다 — **워커 수가 CPU 집합보다 많으면 처리량이 늘지 않고 사용률만 준다.** datagen 위치의 워커 수는 CPU 집합 크기(2)를 넘기지 않는다.
- **생성 CPU 몫의 추정.** 워커 하나가 약 590만 pps를 내므로 M 티어(10,000 pps) 생성은 코어 하나의 약 0.17%, M+(100,000)는 약 1.7%, L(500,000)은 약 8.5%다. 이 추정은 생성 + 인코딩만의 값이며 XADD · 전송은 들어 있지 않다 — 모드 B의 실제 발행 비용은 S5에서 gen_worker_utilization으로 잰다.
- 한계 — 생성은 주기를 따르지 않고 최대 속도로 돌았다(단독 상한의 측정). api 위치 0-4는 실제 구성에서 redis와 CPU 집합을 공유하지만 이 실험 동안 redis는 유휴였다.

## 폐기 · 예외

- 폐기한 반복 없음. 이 기록 전의 첫 실행 묶음(한 명령에 두 위치)은 명령 시간 상한을 넘어 중단했고 그 부분 결과는 버렸다 — 수치에 쓰지 않았다.

## 정본 반영

- **생성기 CPU 포화 임계는 이 기록으로 올리지 않는다.** 카탈로그가 EXP-21에 걸어 둔 확정 대상이지만, 이 측정은 최대 속도 단독 실행이라 달성률이 꺾이는 CPU 사용률을 읽을 수 없다(달성률이 늘 100%). 지정 부하를 계단으로 올리는 S5 모드 B 측정으로 넘긴다(10_observability/05 §생성기 포화 판정).
- docs/03_requirements/13_nonfunctional.md REQ-NFR-17 — 생성기 단독 처리량 실측값(워커별 · 위치별 중앙값)
- docs/09_tech_stack/02_backend.md · docs/06_pipeline/10_datagen_inject.md · docs/09_tech_stack/06_decisions_rationale.md — 미확인 "워커 수별 생성기 처리량" · "생성기 단독 처리량" · 전환 조건 ①의 판정값
- docs/01_overview/05_priorities_roadmap.md — S1 합격

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "006",
  "exp": ["EXP-21"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T12:58:41.000Z", "end": "2026-09-24T13:09:26.000Z" },
  "run": { "commitHash": "410a146", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard(api 0-4 · datagen 11-12)", "seed": 42, "generatorCpuMax": 4.01, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "signalProfile": "mixed(STEP 40 · SINE 40 · RANDOM_WALK 20)", "path": "bench.js APP_ROLE=datagen" },
  "repeat": { "runs": 3, "deviation": 0.1074, "threshold": 0.2 },
  "results": [
    { "metric": "gen_standalone_pps", "arm": "api-0-4-w1", "unit": "points/s", "values": [5896557, 5894076, 6225818], "median": 5896557 },
    { "metric": "gen_standalone_pps", "arm": "api-0-4-w2", "unit": "points/s", "values": [9671308, 10309368, 10778807], "median": 10309368 },
    { "metric": "gen_standalone_pps", "arm": "api-0-4-w4", "unit": "points/s", "values": [20469777, 20057728, 18414383], "median": 20057728 },
    { "metric": "gen_standalone_pps", "arm": "datagen-11-12-w1", "unit": "points/s", "values": [5853360, 6088103, 6152079], "median": 6088103 },
    { "metric": "gen_standalone_pps", "arm": "datagen-11-12-w2", "unit": "points/s", "values": [10582166, 10359768, 10210961], "median": 10359768 },
    { "metric": "gen_standalone_pps", "arm": "datagen-11-12-w4", "unit": "points/s", "values": [10620824, 10449575, 10434883], "median": 10449575 },
    { "metric": "gen_worker_utilization", "arm": "datagen-11-12-w4", "unit": "ratio", "values": [0.719, 0.718, 0.715], "median": 0.718 }
  ]
}
```
