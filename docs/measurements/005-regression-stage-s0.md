# 005 — S0 구조 판정 회귀(ClickHouse 26.8 · 부하 실험 프로파일): 저장소 3개 healthy · 메모리 상한 적용

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T10:49:48Z ~ 10:50:12Z(반복 3회)

ClickHouse 26.8.10.6 전환 · 프로파일 설정 추가(input_format_read_datetime_number_as_raw_value) 뒤의 최종 구성으로 기록 003과 같은 판정을 다시 잰다. 003을 정정하지 않는다 — 엔진 버전이 다른 별개 기록이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 229b490 + 작업 트리 — 이미지 태그 · 프로파일 설정 변경은 이 기록을 담은 커밋에 들어 있다 |
| 프로파일 · 상한 | 부하 실험 — clickhouse 5.0 GB · postgres 2.0 GB · redis 2.5 GB |
| 엔진 | ClickHouse 26.8.10.6 · PostgreSQL 18.6 · Redis 8.10.2 |
| 용량 티어 · 스위치 | 해당 없음 — api 부재(S0) · 구조 사실 판별 기록 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 해당 없음 · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | 해당 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 | 3회 — 매회 compose down(볼륨 유지) → up -d → healthy 대기 → 대조 |
| 판정 | AC-14 · AC-15 — 구조 판정 · 3회 전부 성립이 합격 |

## 결과

| 반복 | healthy | 기동 → healthy(초) | ClickHouse 버전 | 프로파일 raw_value 설정 | postgres 한도 · cgroup | clickhouse 한도 · cgroup | redis 한도 · cgroup |
|------|------|------|------|------|------|------|------|
| 1 | 3/3 | 6 | 26.8.10.6 | true | 2147483648 · 2147483648 | 5368709120 · 5368709120 | 2684354560 · 2684354560 |
| 2 | 3/3 | 6 | 26.8.10.6 | true | 상동 | 상동 | 상동 |
| 3 | 3/3 | 6 | 26.8.10.6 | true | 상동 | 상동 | 상동 |

- AC-14 성립 3/3 · AC-15 성립 3/3.

## 해석

- **26.8 전환 뒤에도 S0 합격 판정이 성립한다.** 서버 설정 파일은 그대로 기동했고, 병합 풀 파생 설정 3을 빼면 26.8도 25.8처럼 기동을 거부한다(exit 36 — 판정 창 밖 임시 컨테이너 확인).
- 서버 오류 로그의 경고는 IPv6 리슨 실패(Docker 네트워크에 IPv6 없음)와 커널 지연 계측 · jemalloc 안내뿐이며 IPv4 리슨은 정상이다.

## 폐기 · 예외

- 없음.

## 정본 반영

- 없음 — AC 성립 기록이다. 전환 사실은 09_tech_stack/03 버전 고정표가 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "005",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T10:49:48.000Z", "end": "2026-09-24T10:50:12.000Z" },
  "run": { "commitHash": "229b490+worktree", "memoryProfile": "load", "memoryLimitMb": 5120, "capacityTier": null },
  "switches": {
    "SW-01": null, "SW-02": null, "SW-03": null, "SW-04": null, "SW-05": null, "SW-06": null,
    "SW-07": null, "SW-08": null, "SW-09": null, "SW-10": null, "SW-11": null
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard", "seed": null, "generatorCpuMax": null, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S0", "recordKind": "structural-discrimination", "engine": "clickhouse 26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "stores_healthy", "arm": "AC-14", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "memory_limit_match", "arm": "AC-15", "unit": "count", "values": [3, 3, 3], "median": 3 },
    { "metric": "startup_to_healthy", "arm": "load", "unit": "s", "values": [6, 6, 6], "median": 6 }
  ]
}
```
