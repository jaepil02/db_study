# 001 — S0 저장소 판별: 같은 토큰 재시도와 종속 MV · 분할 INSERT의 ingested_at

> 실험: EXP-32 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T10:09:54Z ~ 10:11:08Z(반복 3회 · 반복마다 task restore NAME=s0-empty)

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 2318618 + 작업 트리 — 실행한 스크립트 · 설정 · DDL은 이 기록을 담은 커밋에 들어 있다 |
| 프로파일 · 상한 | 개발(compose.dev.yml) · clickhouse 3072 MB · postgres 1536 MB · redis 1536 MB(cgroup memory.max 대조) |
| 용량 티어 | 해당 없음 — 판별 실험 · 수동 CLI |
| 스위치 | 해당 없음 — api 부재(S0). 기계 판독 블록의 switches는 null이며 BFF 규칙 4로 "4요소 누락"에 세어진다 — 구조 사실 판별 기록이다(04_experiment_protocol §기록 상태와 정정) |
| 주입 모드 · 시드 | 없음(HTTP 8123 JSONCompactEachRow 수동 삽입 · 합성 SINE) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 해당 없음 · 표준(clickhouse 5-8 · postgres 9-10 · redis 0-4) |
| 압축 · swap · 네트워킹 · SIM 계획 | 요청 압축 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 엔진 | ClickHouse 25.8.33.6 · 서버 timezone Asia/Seoul |
| 반복 · 편차 | 3회 — 구조 판정(3회 전부 성립이 합격 · 편차 폐기 미적용) |
| 스크립트 | scripts/lab/s0/clickhouse-discrimination.sh <반복> · DDL scripts/lab/s0/clickhouse-ddl.sql(문서 sql 펜스 그대로) |

조건과 시나리오를 교차했다. 두 설정의 쌍을 둘 다 없음 · 한쪽만 · 둘 다로 나눴다.

| 기호 | 종속 MV 중복 제거 설정 | 롤업 3테이블 윈도우 | 뜻 |
|------|------|------|------|
| C0 | 0 | 0 | 보강 전 계약 — tag_raw만 윈도우 1000 |
| CD | 1 | 0 | 설정만 |
| CW | 0 | 1000 | 윈도우만 |
| C1 | 1(프로파일) | 1000(DDL) | 보강 후 계약(ADR-14 보강) — 덮어쓰기 없음 |

| 시나리오 | 뜻 |
|------|------|
| S1 적재 측 거절 | tag_1m parts_to_throw_insert 1로 too many parts — 검사는 INSERT 시작 때 1회다 |
| S2 변환 중 예외 | S2 동안만 붙이는 실습 전용 게이트 MV(mv_s0_gate)가 throwIf로 실패 — tag_raw의 MV 실행 순서는 고정되지 않는다 |
| S3 성공 뒤 재시도 | 응답 유실(타임아웃)을 가정해 성공한 배치를 같은 토큰으로 다시 보낸다 |
| BF 백필 재실행 | C1에서 롤업 3테이블을 mutation으로 비우고 원시에서 tag_1m으로 INSERT SELECT(토큰 없음) — 같은 일을 두 번 반복 |

## 결과

한 배치 = 설비 1 · 태그 8 · 60초 = 480행. 값은 raw · 1m · 1h · 1d의 count다.

| 조건 · 시나리오 | 시도 1 | 시도 1 뒤 | 재시도 중복 블록 | 재시도 뒤 | 판정(3회) |
|------|------|------|------|------|------|
| C0 · S1 | 500 TOO_MANY_PARTS | 0 · 0 · 0 · 0 | 0 | 480 · 480 · 480 · 480 | 정확 3/3 — ⓒ(원시도 기록되지 않음) |
| C0 · S2 | 500 게이트 예외 | 480 · 0 · 0 · 0 (2회) · 480 · 480 · 0 · 0 (1회) | 1 | 480 · 480 · 480 · 480 (2회) · 480 · **960** · 480 · 480 (1회) | **ⓑ** — 빠진 롤업은 메워진다 · 먼저 성공한 MV는 두 배(1/3) |
| C0 · S3 | 200 | 480 · 480 · 480 · 480 | 1 | 480 · **960 · 960 · 960** | **이중 계수 3/3** |
| CD · S3 | 200 | 480 · 480 · 480 · 480 | 1 | 480 · **960 · 960 · 960** | **이중 계수 3/3** |
| CW · S3 | 200 | 480 · 480 · 480 · 480 | 1 | 480 · **960 · 960 · 960** | **이중 계수 3/3** |
| C1 · S1 | 500 TOO_MANY_PARTS | 0 · 0 · 0 · 0 | 0 | 480 · 480 · 480 · 480 | 정확 3/3 |
| C1 · S2 | 500 게이트 예외 | 480 · 0 · 0 · 0 (3회) | 1 | 480 · 480 · 480 · 480 | 정확 3/3 — 게이트가 3회 모두 먼저 돌았다 |
| C1 · S3 | 200 | 480 · 480 · 480 · 480 | 4 | 480 · 480 · 480 · 480 | 정확 3/3 |

| 백필 재실행(C1) | tag_1m count(3회) |
|------|------|
| 첫 백필 | 480 · 480 · 480 |
| 비운 뒤 같은 내용 두 번째 백필 | **0 · 0 · 0** — 오류 없이 버려진다 |
| 비운 뒤 insert_deduplicate 0으로 백필 | 480 · 480 · 480 |

| 분할 INSERT(ingested_at) | 행 | 블록 수(part_log NewPart) | ingested_at 고유값(3회) |
|------|------|------|------|
| HTTP · max_insert_block_size 8192 · 스쿼시 끔 | 50,000 | 7 | 1 |
| HTTP · max_insert_block_size 8192 · 스쿼시 기본 | 50,000 | 1 | 1 |
| HTTP · 서버 기본 블록 | 1,500,000 | 2 | 1 |
| INSERT SELECT · 블록 8192 · 스쿼시 끔 | 50,000 | 7 | 1 |

| 부수 관찰 | 값(3회 동일) |
|------|------|
| 정수 ts(epoch ms)를 JSONCompactEachRow로 보낼 때 해석 | epoch ms 그대로(toUnixTimestamp64Milli 일치) |
| 토큰 없이 같은 내용을 두 번 보냄 | raw 960 — 중복 제거되지 않는다(ingested_at DEFAULT가 달라 블록 해시가 다르다) |
| S3 응답 요약의 written_rows | 첫 시도 512 · 재시도 512 — 원시가 중복 제거돼도 값이 줄지 않는다(C0 · CD · CW · C1 전부) |
| 설정 1인 프로파일에서 async_insert 1 삽입 | 500 Code 344(종속 MV 중복 제거와 async insert 동시 사용 불가) · 설정 0으로 내리면 200 |
| 첫 파트(머지 뒤 · 1,605,840행) 압축 전후 바이트 | 65,839,440 → 872,616(비 75.5) — 합성 SINE · 개발 프로파일 · 인용 불가 |

## 해석

- **판별 ⓐ · ⓑ의 답은 ⓑ다.** 25.8.33.6은 원시가 토큰으로 중복 제거돼도 종속 MV에 블록을 다시 보낸다. 원시만 기록되고 롤업이 빠진 경우(C0 · S2 2회)는 재시도로 메워진다. 설계가 걱정한 "오류 없는 공백(ⓐ)"은 일어나지 않았다.
- **ⓑ는 대가가 따른다 — 이미 성공한 MV도 다시 돈다.** 보강 전 계약(C0)에서 응답만 유실된 성공 배치를 재시도하면 원시는 480이고 세 롤업은 960이다(3/3). 부분 실패에서 한 MV가 먼저 성공했다면 그 롤업만 두 배가 된다(C0 · S2의 1회 — 1m 960 · 1h · 1d 480). at-least-once 재전달(XACK 전 크래시 · 타임아웃)이 롤업을 조용히 부풀리고 롤업 사이도 어긋난다.
- **쌍의 한쪽만으로는 막지 못한다.** 설정만 켠 CD도, 윈도우만 둔 CW도 S3에서 3/3 이중 계수였다. 두 조건을 **한 쌍으로** 둔 C1만 S1 · S2 · S3 전부 정확했다. 사용자가 C1 채택을 결정했다(2026-09-24).
- **C1의 잔여 두 가지.** ① C1 · S2는 3회 모두 게이트가 먼저 돌아, MV 순서가 뒤집힌 부분 실패는 C1에서 재지 못했다(미측정). ② **윈도우가 백필 재실행을 오류 없이 버린다.** 롤업 테이블에는 ingested_at 같은 매번 다른 컬럼이 없어, 비운 뒤 같은 내용을 다시 넣는 백필 · 경로 B 재계산은 윈도우의 내용 해시에 걸려 0행이 된다(3/3). 재계산 삽입은 insert_deduplicate 0으로 해야 한다.
- **적재 측 거절(S1)은 원시도 남기지 않는다.** too many parts는 INSERT 시작 때 대상 테이블 전부를 검사해 거절하므로 부분 기록이 생기지 않는다. 같은 이유로 "둘째 블록만 거절"은 이 수단으로 만들 수 없었다.
- **ingested_at은 블록이 아니라 INSERT 문 하나에 한 값이다.** 7블록으로 쪼갠 INSERT도 고유값이 1이었다. 경로 A가 가를 수 있는 단위는 블록이 아니라 INSERT 문(배치)이다. 스쿼시가 기본값이면 배치 상한(백만 행 미만)의 HTTP 삽입은 애초에 한 블록이다.
- **written_rows는 중복 제거 계측이 될 수 없다.** 재시도 요약은 첫 시도와 같은 값이다. 중복 제거 계측은 ProfileEvents DuplicatedInsertedBlocks로 한다.
- 한계 — 한 엔진 버전 · 비복제 MergeTree · 단일 노드에서의 판별이다. 엔진 부 버전을 올리면 이 기록을 다시 돌린다 — 종속 MV의 중복 제거 동작은 버전마다 바뀌어 왔다.

## 폐기 · 예외

- 폐기한 반복 없음. C0 · S2는 MV 실행 순서가 반복마다 달라 판정이 갈렸다(2회 정확 · 1회 부분 이중 계수). 이는 흔들림이 아니라 순서가 고정되지 않는다는 구조 사실이므로 그대로 적는다.
- 판정 창 이전의 사전 시험(시나리오 설계 · 실패 수단 탐색)은 기록 수치에서 뺐다. "다중 블록 · 둘째 블록만 거절" 시도는 S1 수단으로 재현되지 않아 시나리오에서 뺐다.

## 정본 반영

- docs/05_data_stores/03_clickhouse_schema.md — 미확인 "MV 재실행" 행 닫힘 · 중복 제거 계약의 종속 MV 행 · B형의 written_rows 계측 정정 · 서버 설정 계약에 종속 MV 중복 제거 행 신설
- docs/05_data_stores/04_clickhouse_rollup.md — 롤업 3테이블 DDL에 윈도우 · MV 제약 #8 · 백필 절차의 insert_deduplicate 0
- docs/06_pipeline/09_rollup.md · 03_ingest_batch.md — ⓐ · ⓑ 판별 결과 · 경로 A의 ingested_at 단위 · 재계산 삽입의 insert_deduplicate 0
- docs/04_architecture/09_decision_records.md — ADR-14 상태 항목(보강)
- docs/09_tech_stack/03_data_infra.md — 사용자 프로파일 설정 트리

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "001",
  "exp": ["EXP-32"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T10:09:54.000Z", "end": "2026-09-24T10:11:08.000Z" },
  "run": { "commitHash": "2318618+worktree", "memoryProfile": "dev", "memoryLimitMb": 3072, "capacityTier": null },
  "switches": {
    "SW-01": null, "SW-02": null, "SW-03": null, "SW-04": null, "SW-05": null, "SW-06": null,
    "SW-07": null, "SW-08": null, "SW-09": null, "SW-10": null, "SW-11": null
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard", "seed": null, "generatorCpuMax": null, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "engine": "clickhouse 25.8.33.6", "insertPath": "http JSONCompactEachRow", "recordKind": "structural-discrimination" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S1", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S2", "unit": "x", "values": [1, 2, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "CD-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "CW-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S1", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S2", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S3", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "raw_rows_after_failed_attempt", "arm": "S1", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "raw_rows_after_failed_attempt", "arm": "S2", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "backfill_rerun_1m_rows", "arm": "C1-dedup-default", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "backfill_rerun_1m_rows", "arm": "C1-insert_deduplicate-0", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "ingested_at_distinct_values", "arm": "http-7-blocks", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "ingested_at_distinct_values", "arm": "http-default-2-blocks", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "ingested_at_distinct_values", "arm": "insert-select-7-blocks", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "raw_rows_notoken_resend", "arm": "notoken", "unit": "rows", "values": [960, 960, 960], "median": 960 },
    { "metric": "retry_written_rows", "arm": "S3-all-conditions", "unit": "rows", "values": [512, 512, 512], "median": 512 }
  ]
}
```
