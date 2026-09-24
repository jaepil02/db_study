# 004 — S0 저장소 판별(ClickHouse 26.8): 같은 토큰 재시도와 종속 MV · 분할 INSERT · 정수 ts 해석

> 실험: EXP-32 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T10:48:07Z ~ 10:49:26Z(반복 3회 · 반복마다 task restore NAME=s0-empty)

ClickHouse를 25.8.33.6에서 26.8.10.6(LTS)으로 전환한 뒤(사용자 결정 2026-09-24 — 25.x 보안 지원 종료) 기록 001과 같은 판별을 다시 돌린다. 001을 정정하지 않는다 — 엔진 버전이 다른 별개 기록이며, 001은 25.8의 사실로 남는다. 현행 계약의 근거는 이 기록이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 229b490 + 작업 트리 — 이미지 태그 · 프로파일 설정 · 스크립트 변경은 이 기록을 담은 커밋에 들어 있다 |
| 프로파일 · 상한 | 부하 실험(compose.load.yml) · clickhouse 5120 MB · postgres 2048 MB · redis 2560 MB |
| 엔진 | ClickHouse 26.8.10.6 · 서버 timezone Asia/Seoul · 프로파일 input_format_read_datetime_number_as_raw_value 1 |
| 용량 티어 · 스위치 | 해당 없음 — api 부재(S0) · 구조 사실 판별 기록(04_experiment_protocol §기록 상태와 정정) |
| 주입 모드 · 시드 | 없음(HTTP 8123 JSONCompactEachRow 수동 삽입 · 합성 SINE) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 해당 없음 · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | 요청 압축 없음 · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회 — 구조 판정(3회 전부 성립이 합격) |
| 스크립트 | scripts/lab/s0/clickhouse-discrimination.sh <반복> — 조건 · 시나리오 기호는 기록 001과 같다(C0 · CD · CW · C1 × S1 · S2 · S3 · BF) |

## 결과

한 배치 = 480행. 값은 raw · 1m · 1h · 1d의 count이며 **3회 모두 같았다.**

| 조건 · 시나리오 | 시도 1 | 시도 1 뒤 | 재시도 중복 블록 | 재시도 뒤 | 판정 |
|------|------|------|------|------|------|
| C0 · S1 | 500 TOO_MANY_PARTS | 480 · 0 · 0 · 0 | 2 | 480 · 480 · 480 · 480 | 정확 — **ⓑ**(원시는 남고 MV만 거절 · 재시도가 메움) |
| C0 · S2 | 500 게이트 예외 | 480 · 480 · 0 · 0 | 2 | 480 · **960** · 480 · 480 | **1m 이중 계수**(mv_tag_1m이 게이트보다 먼저 돈다 — 3/3) |
| C0 · S3 | 200 | 480 · 480 · 480 · 480 | 2 | 480 · **960 · 960 · 960** | **이중 계수** |
| CD · S3 | 200 | 480 · 480 · 480 · 480 | 2 | 480 · **960 · 960 · 960** | **이중 계수** |
| CW · S3 | 200 | 480 · 480 · 480 · 480 | 2 | 480 · **960 · 960 · 960** | **이중 계수** |
| C1 · S1 | 500 TOO_MANY_PARTS | 480 · 0 · 0 · 0 | 2 | 480 · 480 · 480 · 480 | 정확 |
| C1 · S2 | 500 게이트 예외 | 480 · 480 · 0 · 0 | 4 | 480 · 480 · 480 · 480 | 정확 — 먼저 성공한 MV가 있는 부분 실패도 정확 |
| C1 · S3 | 200 | 480 · 480 · 480 · 480 | 8 | 480 · 480 · 480 · 480 | 정확 |

| 기타 판별 | 26.8 결과(3회 동일) | 25.8(기록 001) |
|------|------|------|
| 백필 재실행(비운 뒤 같은 내용 · 토큰 없음) | 480 — 버려지지 않는다 | 0 — 버려졌다 |
| 백필 재실행 · insert_deduplicate 0 | 480 | 480 |
| 토큰 없이 같은 내용 재전송 | raw **480 — 중복 제거된다** | 960 |
| 설정 1 + async_insert 1 삽입 | 200 — 허용 | 500 Code 344 |
| 분할 INSERT의 ingested_at 고유값(블록 7 · 1 · 2 · 7) | 1 · 1 · 1 · 1 | 같다 |
| S3 재시도 요약의 written_rows | 첫 시도 512 · 재시도 512 | 같다 |
| **정수 ts(epoch ms) 해석** — 프로파일 설정 1 | epoch ms 그대로 · 파티션 20260924 | 설정 없이 epoch ms |
| 정수 ts 해석 — 설정 없음(판정 창 밖 사전 실행) | **초로 읽어 9999-12-31로 포화** · 파티션 99991231 · date_time_input_format 값과 무관 | 해당 없음 |
| 첫 파트(머지 뒤 · 1,629,936행) 압축 전후 바이트 | 66,827,376 → 877,532(비 76.2) — 합성 · 인용 불가 | 비 75.5 |

## 해석

- **ADR-14 보강(C1)은 26.8에서도 필요하고 충분하다.** 성공 뒤 재시도는 보강 전(C0) · 한쪽만(CD · CW) 모두 세 롤업을 두 배로 세고 C1만 정확하다(3/3). 25.8과 같은 결론이다.
- **26.8은 원래 걱정한 경우를 실제로 만든다.** 적재 측 거절(too many parts)이 25.8에서는 INSERT 전체를 막았지만 26.8은 원시를 커밋하고 MV만 거절한다 — "원시 성공 · MV 실패"가 부하 중 흔한 원인으로 생긴다. 재시도가 메운다(ⓑ).
- **MV 실행 순서가 26.8에서 고정돼 보인다.** mv_tag_1m이 게이트 MV보다 먼저 돌아 C0의 부분 실패 재시도가 1m만 두 배로 만든다(3/3) — 롤업 사이 불일치. C1에서 정확했으므로 기록 001의 잔여("순서가 뒤바뀐 부분 실패는 보강 아래 미측정")가 닫힌다. 순서 자체는 계약으로 삼지 않는다.
- **토큰 없는 같은 내용이 중복 제거된다.** 26.8은 DEFAULT(ingested_at) 채우기 전의 내용으로 블록을 가르는 것으로 보인다 — SW-08 off(토큰 없음)가 재시도 중복을 **만들지 못한다**. EXP-13(SW-08 비교)의 off 구현은 insert_deduplicate 0을 함께 줘야 한다 — S3 판정 대상으로 넘긴다.
- **정수 ts 해석이 바뀌어 적재 계약이 조용히 깨진다.** 26.8은 JSON의 따옴표 없는 정수를 DateTime64(3)에서도 초로 읽는다 — epoch ms가 9999-12-31로 포화되고 오류가 없다. 프로파일 input_format_read_datetime_number_as_raw_value 1로 계약(epoch ms 정수)을 유지한다. 이 설정이 없던 첫 26.8 실행은 판정 창 밖으로 뺐다.
- **백필 재실행은 26.8에서 버려지지 않았지만 insert_deduplicate 0 절차는 유지한다.** 버전마다 달랐다(001 · 004) — 절차가 버전에 기대지 않게 한다.

## 폐기 · 예외

- 판정 창 밖 사전 실행 1묶음(3회 · 10:43~10:45Z)은 정수 ts가 9999-12-31로 포화된 상태에서 돌아 뺐다. 그 실행의 판정 열은 이 기록과 같았다(count 기반) — 뺀 이유는 시각 컬럼이 오염돼 파티션 · 버킷 조건이 설계와 달랐기 때문이다.

## 정본 반영

- docs/05_data_stores/03_clickhouse_schema.md — 서버 설정 계약에 input_format_read_datetime_number_as_raw_value 신설 · 26.8 판별 결과
- docs/05_data_stores/04_clickhouse_rollup.md · docs/06_pipeline/09_rollup.md · 03_ingest_batch.md — 26.8 결과 · SW-08 off 재현 수단 등재
- docs/04_architecture/09_decision_records.md — ADR-14 상태 항목에 26.8 근거
- docs/09_tech_stack/03_data_infra.md — ClickHouse 26.8.10.6 태그 고정 · LTS 전환

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "004",
  "exp": ["EXP-32"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T10:48:07.000Z", "end": "2026-09-24T10:49:26.000Z" },
  "run": { "commitHash": "229b490+worktree", "memoryProfile": "load", "memoryLimitMb": 5120, "capacityTier": null },
  "switches": {
    "SW-01": null, "SW-02": null, "SW-03": null, "SW-04": null, "SW-05": null, "SW-06": null,
    "SW-07": null, "SW-08": null, "SW-09": null, "SW-10": null, "SW-11": null
  },
  "conditions": { "injectionMode": null, "observability": "off", "cpuset": "standard", "seed": null, "generatorCpuMax": null, "compression": null, "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "engine": "clickhouse 26.8.10.6", "insertPath": "http JSONCompactEachRow", "recordKind": "structural-discrimination" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S1", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S2", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C0-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "CD-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "CW-S3", "unit": "x", "values": [2, 2, 2], "median": 2 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S1", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S2", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "rollup_1m_count_ratio_after_retry", "arm": "C1-S3", "unit": "x", "values": [1, 1, 1], "median": 1 },
    { "metric": "raw_rows_after_failed_attempt", "arm": "S1", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "raw_rows_after_failed_attempt", "arm": "S2", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "backfill_rerun_1m_rows", "arm": "C1-dedup-default", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "raw_rows_notoken_resend", "arm": "notoken", "unit": "rows", "values": [480, 480, 480], "median": 480 },
    { "metric": "ingested_at_distinct_values", "arm": "http-7-blocks", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "epoch_ms_parsed_exact", "arm": "raw_value-1", "unit": "bool", "values": [1, 1, 1], "median": 1 }
  ]
}
```
