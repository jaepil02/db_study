# 003 — S0 구조 판정 회귀(부하 실험 프로파일): 저장소 3개 healthy · 메모리 상한 적용

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T10:37:54Z ~ 10:38:24Z(반복 3회)

기록 002(개발 프로파일)와 같은 판정을 Docker VM 메모리 상향(약 7.75 → 15.6 GB · 착수 체크리스트 1) 뒤 기본 프로파일인 부하 실험 프로파일로 다시 잰다. 002를 정정하지 않는다 — 조건(프로파일)이 다른 별개 기록이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 268c124 — Compose · 저장소 설정은 이 커밋 그대로 |
| 프로파일 · 상한 | 부하 실험(compose.yml + compose.load.yml) — clickhouse 5.0 GB · postgres 2.0 GB · redis 2.5 GB(정본 09_tech_stack/04 §컨테이너 메모리 상한) |
| 용량 티어 | 해당 없음 — 저장소만 |
| 스위치 | 해당 없음 — api 부재(S0) · 블록은 null — 구조 사실 판별 기록(04_experiment_protocol §기록 상태와 정정) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 해당 없음 · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | 해당 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| Docker VM | vCPU 14 · 메모리 16,747,274,240 바이트(약 15.6 GB) |
| 반복 | 3회 — 매회 compose down(볼륨 유지) → up -d → healthy 대기 → 대조 |
| 판정 | AC-14(3개 healthy) · AC-15(한도 = 프로파일 상한) — 구조 판정 · 3회 전부 성립이 합격 |

## 결과

| 반복 | healthy | 기동 → healthy(초) | postgres 한도 | clickhouse 한도 | redis 한도 |
|------|------|------|------|------|------|
| 1 | 3/3 | 6 | 2147483648 | 5368709120 | 2684354560 |
| 2 | 3/3 | 5 | 2147483648 | 5368709120 | 2684354560 |
| 3 | 3/3 | 6 | 2147483648 | 5368709120 | 2684354560 |

| 대조 수단 | postgres | clickhouse | redis |
|------|------|------|------|
| docker inspect HostConfig.Memory | 2.0 GiB | 5.0 GiB | 2.5 GiB |
| docker stats LIMIT | 2GiB | 5GiB | 2.5GiB |
| 컨테이너 안 cgroup memory.max | 2147483648 | 5368709120 | 2684354560 |
| 컨테이너 안 파생 설정 | shared_buffers 512MB | 서버 메모리 비율 0.8 | maxmemory 2147483648 |
| cpuset | 9-10 | 5-8 | 0-4 |

- AC-14 성립 3/3 · AC-15 성립 3/3 — 세 대조 수단과 파생 설정이 모두 부하 실험 프로파일 표와 같다.

## 해석

- **부하 실험 프로파일이 이 머신에서 쓸 수 있게 됐다.** 상한 합 9.5 GB(api 2.0 GB는 S1 이후) + 여유가 VM 15.6 GB 안에 들어간다. 이 기록 이후 저장소는 부하 실험 프로파일로 둔다.
- 한계 — 저장소만의 구조 판정이다. api가 생기면 health run.memoryLimitMb 대조가 이 값을 기준으로 한다.

## 폐기 · 예외

- 없음.

## 정본 반영

- 없음 — AC 성립 기록이다. 머신 값은 09_tech_stack/04 §현행 측정 머신과 01_overview/05 착수 체크리스트가 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "003",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T10:37:54.000Z", "end": "2026-09-24T10:38:24.000Z" },
  "run": { "commitHash": "268c124", "memoryProfile": "load", "memoryLimitMb": 5120, "capacityTier": null },
  "switches": {
    "SW-01": null, "SW-02": null, "SW-03": null, "SW-04": null, "SW-05": null, "SW-06": null,
    "SW-07": null, "SW-08": null, "SW-09": null, "SW-10": null, "SW-11": null
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard", "seed": null, "generatorCpuMax": null, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S0", "recordKind": "structural-discrimination", "dockerVmMemoryBytes": 16747274240 },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "stores_healthy", "arm": "AC-14", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "memory_limit_match", "arm": "AC-15", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "startup_to_healthy", "arm": "load", "unit": "s", "values": [6, 5, 6], "median": 6 }
  ]
}
```
