# 002 — S0 구조 판정 회귀: 저장소 3개 healthy · 메모리 상한 적용

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T09:33:01Z ~ 09:33:30Z(반복 3회)

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 2318618 + 작업 트리 — Compose · 저장소 설정은 커밋 2318618 그대로이며 이 기록의 커밋은 스크립트 · 문서만 더한다 |
| 프로파일 · 상한 | 개발(compose.yml + compose.dev.yml) — clickhouse 3.0 GB · postgres 1.5 GB · redis 1.5 GB(정본 09_tech_stack/04 §컨테이너 메모리 상한) |
| 용량 티어 | 해당 없음 — 저장소만 |
| 스위치 | 해당 없음 — api 부재(S0) · 블록은 null — 구조 사실 판별 기록(04_experiment_protocol §기록 상태와 정정) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 해당 없음 · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | 해당 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| Docker VM | vCPU 14 · 메모리 약 7.75 GB(부하 실험 프로파일은 쓸 수 없다 — 09_tech_stack/04 §현행 측정 머신) |
| 반복 | 3회 — 매회 compose down(볼륨 유지) → up -d → healthy 대기 → 대조 |
| 판정 | AC-14(3개 healthy) · AC-15(한도 = 프로파일 상한) — 구조 판정 · 3회 전부 성립이 합격 |

## 결과

| 반복 | healthy | 기동 → healthy(초) | postgres 한도 | clickhouse 한도 | redis 한도 | redis maxmemory |
|------|------|------|------|------|------|------|
| 1 | 3/3 | 6 | 1610612736 | 3221225472 | 1610612736 | 1073741824 |
| 2 | 3/3 | 6 | 1610612736 | 3221225472 | 1610612736 | 1073741824 |
| 3 | 3/3 | 6 | 1610612736 | 3221225472 | 1610612736 | 1073741824 |

| 대조 수단 | postgres | clickhouse | redis |
|------|------|------|------|
| docker inspect HostConfig.Memory | 1.5 GiB | 3.0 GiB | 1.5 GiB |
| docker stats LIMIT | 1.5GiB | 3GiB | 1.5GiB |
| 컨테이너 안 cgroup memory.max | 1610612736 | 3221225472 | 1610612736 |
| cpuset · CPU 가중 | 9-10 · 1024 | 5-8 · 2048 | 0-4 · 512 |

- AC-14 성립 3/3 · AC-15 성립 3/3 — 세 대조 수단이 모두 프로파일 상한과 같다.
- 기동 시간 6초는 참고값이다(분포 판정 대상 아님 · 개발 프로파일).

## 해석

- **S0 합격 판정이 성립한다.** 저장소 3개 healthy와 메모리 상한 적용이 재기동 세 번 모두 같은 값으로 재현됐다.
- cgroup memory.max가 Compose 한도와 같다 — api가 생기면 health run.memoryLimitMb가 같은 자리에서 읽는다(07_api/10). 이 기록이 그 대조의 기준값이다.
- 한계 — 개발 프로파일이다. 부하 실험 프로파일(Docker 12 GB)은 Docker VM 메모리 상향 전이라 재지 못했다.

## 폐기 · 예외

- 없음.

## 정본 반영

- 없음 — 구조 판정 회귀는 AC 성립을 기록할 뿐 미확인 행을 닫지 않는다. S0 완료 사실은 docs/README.md 현재 상태와 01_overview/05 착수 체크리스트가 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "002",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T09:33:01.000Z", "end": "2026-09-24T09:33:30.000Z" },
  "run": { "commitHash": "2318618+worktree", "memoryProfile": "dev", "memoryLimitMb": 3072, "capacityTier": null },
  "switches": {
    "SW-01": null, "SW-02": null, "SW-03": null, "SW-04": null, "SW-05": null, "SW-06": null,
    "SW-07": null, "SW-08": null, "SW-09": null, "SW-10": null, "SW-11": null
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard", "seed": null, "generatorCpuMax": null, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S0", "recordKind": "structural-discrimination" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "stores_healthy", "arm": "AC-14", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "memory_limit_match", "arm": "AC-15", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "startup_to_healthy", "arm": "dev", "unit": "s", "values": [6, 6, 6], "median": 6 }
  ]
}
```
