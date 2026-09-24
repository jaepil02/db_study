# 009 — Stream 엔트리 인코딩 크기: 태그/설비 500(L 구성) · 신호 프로파일별 바이트 (EXP-39의 S1 몫)

> 실험: EXP-39 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T13:21:56Z ~ 2026-09-24T13:24:01Z(티어 S · M · L 한 묶음으로 실행 · 이 기록은 L 조건 6회)

EXP-39(Redis 메모리 실측)의 S1 몫은 카탈로그가 정한 대로 **인코딩**이다 — 계약 v1 엔트리 하나가 MessagePack으로 몇 바이트인가. Redis 안의 계열별 점유 · 표본 대 전수 · DLQ 엔트리 크기는 같은 실험의 S5 몫이며 이 기록에 없다. 티어마다 기록을 나눈다 — 한 기록이 여러 티어를 담으면 4요소의 티어 칸이 하나로 정해지지 않는다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 019e54d(api 이미지 db_study-api:019e54d) |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(cgroup) |
| 용량 티어 | L — 설비당 태그 500(04_architecture/07) · 설정 로더 CAPACITY_TIER가 생성 규모와 기록 칸의 한 원천 |
| 스위치 | 전부 기본값(기계 판독 블록 전수) — 인코딩 경로에 개입하지 않는다 |
| 주입 모드 · 시드 | 없음(단독 실행 경로) · 42 |
| 신호 프로파일 | 혼합(STEP 40 · SINE 40 · RANDOM_WALK 20) · RANDOM_WALK 단독(값 인코딩이 가장 큰 구성) |
| 인코딩 | 계약 v1 · msgpackr 1.12.1 · map 8필드 · 표준 배열 · t0 · s는 int64 정수 · va는 정수면 int · 실수면 float64(06_pipeline/12 §와이어 표현) · 생성 모드라 dt 전부 0 · q 전부 9 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 최대 1.98코어 · datagen 위치 cpuset 11-12 · 워커 2 |
| 창 | 워밍업 1초 · 창 5초 — 크기 측정이라 짧은 창으로 충분하다(3회 편차 0.00%) |
| 압축 · swap · 네트워킹 · SIM 계획 | 해당 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 스크립트 | scripts/lab/s1/gen-bench.sh <출력> datagen L <mixed · RANDOM_WALK> 2 3 5 1 |

## 결과

| 태그/설비 | 신호 프로파일 | 엔트리당 바이트 3회 | 중앙값 | 포인트당 바이트 |
|------|------|------|------|------|
| 500(L) | 혼합 | 5,455 · 5,455 · 5,455 | **5,455** | 10.91 |
| 500(L) | RANDOM_WALK | 7,051 · 7,051 · 7,051 | **7,051** | 14.10 |

## 해석

- **포인트당 바이트는 구성으로 정해지고 태그 수와 거의 무관하다** — 혼합 약 11 B · RANDOM_WALK 약 14 B. 태그 수가 적을수록 고정 머리(v · d · s · t0 · 필드 이름 · 수십 바이트)의 몫이 커진다. 티어 전체의 비교는 기록 007 · 008 · 009를 함께 본다.
- **값의 와이어 표현이 차이를 만든다.** 정수로 떨어지는 STEP 값은 1~3바이트 int로, 실수는 float64 9바이트로 실린다 — 혼합 구성의 크기는 이 동작에 기대는 값이다.
- **Redis 안 점유는 이 값 + Stream 노드 · 리스트팩 오버헤드다** — S5에서 부하 없는 전수 1회와 표본으로 잰다.
- 한계 — 생성 모드 엔트리(dt 전부 0 · q 전부 9)다. Collector 엔트리(모드 A)는 dt · 품질이 섞여 몇 바이트 달라질 수 있다.

## 폐기 · 예외

- 없음. 커밋 410a146에서 같은 측정을 세 티어 한 기록으로 먼저 돌렸으나(미커밋 · 기록 번호 미부여) 티어 칸을 정할 수 없어 버렸다 — 값은 이 기록과 같았다.

## 정본 반영

- docs/05_data_stores/06_redis_memory.md · docs/06_pipeline/12_data_contract.md — 미확인 "엔트리 실제 크기 · 태그당 바이트"의 인코딩 부분(Redis 오버헤드는 S5 미확인 유지)

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "009",
  "exp": [
    "EXP-39"
  ],
  "status": "valid",
  "supersedes": null,
  "window": {
    "start": "2026-09-24T13:21:56.000Z",
    "end": "2026-09-24T13:24:01.000Z"
  },
  "run": {
    "commitHash": "019e54d",
    "memoryProfile": "load",
    "memoryLimitMb": 2048,
    "capacityTier": "L"
  },
  "switches": {
    "SW-01": "on",
    "SW-02": "on",
    "SW-03": "on",
    "SW-04": "on",
    "SW-05": "on",
    "SW-06": "on",
    "SW-07": 100,
    "SW-08": "on",
    "SW-09": "off",
    "SW-10": "off",
    "SW-11": "ingest"
  },
  "conditions": {
    "injectionMode": null,
    "observability": "off",
    "cpuset": "datagen 11-12",
    "seed": 42,
    "generatorCpuMax": 1.98,
    "compression": null,
    "swapUsed": false,
    "wslNetworking": null,
    "simFaultPlan": null,
    "encoding": "msgpackr 1.12.1 map · 표준 배열 · va 정수는 int · 실수는 float64",
    "window": "워밍업 1초 · 창 5초",
    "s1Part": "encoding-only",
    "script": "scripts/lab/s1/gen-bench.sh <출력> datagen L <mixed|RANDOM_WALK> 2 3 5 1"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.0,
    "threshold": 0.2
  },
  "results": [
    {
      "metric": "entry_bytes",
      "arm": "tags500-mixed",
      "unit": "bytes",
      "values": [
        5455,
        5455,
        5455
      ],
      "median": 5455
    },
    {
      "metric": "entry_bytes",
      "arm": "tags500-random_walk",
      "unit": "bytes",
      "values": [
        7051,
        7051,
        7051
      ],
      "median": 7051
    }
  ]
}
```
