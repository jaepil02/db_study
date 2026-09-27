# 042 — 역방향 대조 EXP-42 원자성 · 동시 갱신: 작업지시 완료 단위의 부분 반영 · 같은 주문 동시 완료 × PostgreSQL 트랜잭션 · ClickHouse 경량 UPDATE(update_parallel_mode auto · sync) × 업무 규모 10^4 · 10^5 · 10^6 (S5)

> 실험: EXP-42 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-26T20:20:52.733Z ~ 2026-09-26T23:11:19.326Z(EXP-42 측정 행 at — 호출 끝 시각의 첫 값 ~ 마지막 값) · 실행 2026-09-27 05:14~08:27 KST(역방향 격자 전체 · 원시 첫 행 2026-09-26T20:14:58.921Z ~ 마지막 행 23:27:12.323Z)

업무 데이터를 ClickHouse에 넣으면 무엇이 깨지는지를 재는 역방향 대조의 원자성 축이다(05_data_stores/10 §역방향 대조 — 업무 워크로드 · EXP-42 행). 작업지시 완료 한 건 = 상태 갱신(IN_PROGRESS → COMPLETED) + 실적 1행(+ PostgreSQL은 감사 1행)이다. 두 질문을 같은 입력으로 잰다 — ① 첫 문장 뒤에 프로세스가 죽으면 상태만 바뀐 주문(부분 반영)이 남는가 ② 같은 주문을 두 요청이 동시에 완료하면 실적이 두 번 쌓이는가(경합 위반).

**판정은 건수뿐이고 지연은 비교하지 않는다.** ClickHouse 쪽에는 감사 대조 테이블이 없어 완료 단위의 문장이 하나 적다(05_data_stores/10 EXP-42 불릿). 모든 지표는 구조 지표라 3회 중앙값이 아니라 3회 전부로 판정한다(04_experiment_protocol §구조 판정과 분포 판정).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(실행기 detail.run.commitHash · 러너 git dirty true — 작업 트리에 apps/web · scripts/lab 미커밋 변경이 있었다) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null · memoryLimitSource cgroup max — oltp-lab 서비스에 compose 상한 없음** — api를 내리고 도구 컨테이너 oltp-lab이 두 저장소에 직접 붙는다. 이 null은 상한이 없다는 사실값이라 4요소 충족이다(04_experiment_protocol §조건 칸 — 도구 컨테이너 경로의 memoryLimitMb null 조항 · 2026-09-27) · 대조 저장소 상한 3,584 MB로 채우지 않는다 |
| 용량 티어 | **해당 없음** — 역방향은 용량 티어 축 밖이고 업무 규모 단계(work_order 10^4 · 10^5 · 10^6)가 축이다(05_data_stores/10 §역방향 측정 조건 4요소 행) |
| 저장소 자원(대조 자원 조건) | ClickHouse cpuset 5-7 · 3,584 MiB · 26.8.10.6 · background_pool_size 8 / PostgreSQL cpuset 8-10 · 3,584 MiB · 18.6 · shared_buffers 896MB — 러너 init resourcesBad 없음 |
| 스위치 · 압축 | 전부 기본값 — SW-09=off · SW-10=off(전수는 기계 판독 블록) · 압축 **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861) · 테이블 코덱은 DDL 기본 |
| 주입 모드 · 배경 부하 | 없음 · api 정지 · 관측 프로파일 off |
| 측정 경로 | 도구 컨테이너 oltp-lab(dist/oltp-lab.js) · pg · @clickhouse/client 직접 · 러너 scripts/lab/s5/oltp/oltp.py(하위 명령 하나 = 실행기 호출 하나) |
| 규모 · 시작 상태 | 규모마다 빈 기준 복원 → fill(시드 42 · IN_PROGRESS 비율 0.5 · 세 테이블 (order_id · order_no) md5 일치) → settle → 채움 스냅샷 oltp-s{규모}-19f8861 · PostgreSQL 실행 뒤 reset all · ClickHouse 실행 뒤 reset clickhouse(원시 reset 행 216) |
| 대상 주문 | 반복마다 겹치지 않는 IN_PROGRESS 주문 — 실패 주입 20 · 동시 완료 쌍 20 · 판별 탐침 2(ClickHouse 두 팔은 같은 반복에서 조각을 반으로 나눠 서로 겹치지 않는다) |
| PostgreSQL 완료 단위 | 한 트랜잭션 — 조건부 UPDATE(order_id · status IN_PROGRESS) + production_log INSERT + audit_log INSERT · 갱신 0행이면 ROLLBACK하고 중단 · 세션 synchronous_commit off(공정성 규칙 5 · 서버 기본 on) |
| ClickHouse 완료 단위 | 경량 UPDATE(enable_lightweight_update 1 · 조건 status = 'IN_PROGRESS') + production_log_control INSERT · 되읽기 apply_patch_parts 1 · 다문장 트랜잭션 쓰지 않음(05_data_stores/10 §원리 대응 불릿) |
| ClickHouse 두 팔 | update_parallel_mode **auto**(서버 기본 — detail.updateParallelMode.serverDefault auto) · **sync** — 문장 설정으로 명시(detail.settingsWritten) |
| 실패 주입 | 첫 문장(상태 갱신) 뒤 · 둘째 문장 전 — PostgreSQL은 BEGIN · UPDATE 뒤 COMMIT 없이 커넥션을 끊는다 · ClickHouse는 둘째 문장을 보내지 않는다 |
| 동시 완료 | 쌍마다 같은 주문에 완료 단위 2개를 동시에(커넥션 2) · 쌍끼리는 차례로 |
| 반복 · 편차 | 3회(반복 0 · 1 · 2) · 구조 지표만이라 편차 폐기 미적용 — repeat.deviation 0 · 규모 3 × (PostgreSQL 1 + ClickHouse 2팔) × 3회 = 27호출 전부 rc 0 |
| 원시 | docs/measurements/raw/042-oltp-control-atomic.jsonl(356행 — 앞 230행은 EXP-40~44 공통 init · probe · fill · settle · snapshot · reset · 뒤 126행 = measure 99 + detail 27) · 요약 oltp-summary.json(러너 collect) |

- 검산: 조건 항목 = **16**
- 지표 정의(실행기 oltp-stats.ts atomicCounts) — **부분 반영** = 상태 COMPLETED이고 실적 0행인 주문 · **경합 위반** = 실적 2행 이상인 주문 · 쌍 부분 반영 = 동시 완료 쌍 대상에서 센 부분 반영. 판정 대상은 실패 주입 20 · 쌍 20 주문이다.

## 결과

### 구조 판정 — 3회 전부

값은 반복 0 · 1 · 2다. 세 규모(10^4 · 10^5 · 10^6)가 모두 같은 값이라 한 칸에 적는다 — 규모별 전수는 기계 판독 블록.

| 지표(판독 라벨) | 대상 | PostgreSQL 트랜잭션 | ClickHouse auto | ClickHouse sync |
|------|:--:|------|------|------|
| 부분 반영 partial_apply_count(inject) | 20 | **0 · 0 · 0** | **20 · 20 · 20** | **20 · 20 · 20** |
| 경합 위반 race_violation_count(pairs) | 20 | **0 · 0 · 0** | **20 · 20 · 20** | **20 · 20 · 20** |
| 쌍 부분 반영 pair_partial_apply_count(pairs) | 20 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| 갱신 행 수 응답 update_row_count_reported(probe · bool) | — | 해당 없음(rowCount 응답) | 0 · 0 · 0 | 0 · 0 · 0 |

- 검산: 구조 행 = PostgreSQL 3지표 × 규모 3 + ClickHouse 4지표 × 2팔 × 규모 3 = 9 + 24 = **33** — 33행 전부 3회 같은 값(성립) · 한 번이라도 0이 아닌 행 12(ClickHouse 부분 반영 6 + 경합 위반 6)

### 쌍 결과와 판별 근거(detail)

| 항목 | PostgreSQL | ClickHouse auto · sync |
|------|------|------|
| 쌍 결과 pairOutcomes | 9호출 × 20쌍 전부 completed 1 + skipped 1 | 18호출 × 20쌍 전부 completed 2 |
| 쌍 오류 pairErrors | 0건 | 0건 |
| 실패 주입 첫 문장 갱신 행 수 | injectFirstRowCount 전부 1 | 응답 없음 |
| 쌍 대상 실적 있는 완료 completedWithLog | 20 | 20(주문마다 실적 2행) |
| 갱신 행 수 판별(탐침 — 같은 문장 맞힘 · 다시 보냄) | — | 두 응답 요약 모두 written_rows 0 · result_rows 0 → reported false(호출마다 · init probe도 같음) |

- 검산: 항목 = **5**

## 해석

- **PostgreSQL은 두 질문 모두 저장소가 막는다 — 3규모 × 3회 모두 부분 반영 0 · 경합 위반 0.** 실패 주입에서 첫 UPDATE는 20건 모두 1행을 갱신했지만(injectFirstRowCount 1) COMMIT 없이 커넥션이 끊겨 서버가 열린 트랜잭션을 버렸고, 되읽기에서 상태가 IN_PROGRESS로 남아 부분 반영이 0이다. 동시 완료에서는 조건부 UPDATE가 행을 잠가 뒤 요청이 앞 커밋 뒤 조건(status = IN_PROGRESS)을 다시 보고 0행이 되며, 실행기가 ROLLBACK해 실적을 쓰지 않는다 — 180쌍(9호출 × 20) 전부가 completed 1 + skipped 1이다. 원리 대응 표의 "트랜잭션 — 문장 여럿이 한 커밋 · 조건부 UPDATE가 행을 잠가 두 번째 완료가 0행을 본다"가 관측으로 확인된다.
- **ClickHouse는 두 질문 모두 막지 못한다 — 부분 반영 20/20 · 경합 위반 20/20이 3규모 × 2팔 × 3회 전부.** 문장 단위 원자성뿐이라 첫 문장(경량 UPDATE)이 끝난 순간 상태 변경은 확정되고, 둘째 문장이 오지 않으면 실적 없는 COMPLETED 주문이 남는다. 동시 완료에서는 두 요청이 모두 오류 없이 UPDATE와 INSERT를 마쳐 주문마다 실적이 2행이다.
- **A형 — "update_parallel_mode sync면 경합이 막힐 것"이라고 읽으면 틀린다.** 통념은 sync가 동시 갱신을 직렬화하니 두 번째 완료가 멈춘다는 것이다. 부정 — sync 팔도 auto와 같이 20/20이다. 진짜 축은 **갱신 행 수 응답**이다 — 경량 UPDATE의 응답 요약은 맞힌 문장과 빗나간 문장이 똑같이 written_rows 0이라(reported false) 실행기는 PostgreSQL과 같은 판단 규칙(0행이면 중단)을 적용할 입력이 없고, 두 번째 완료는 조건(status = 'IN_PROGRESS')이 이미 거짓이 된 행에 대해서도 오류 없이 돌아와 INSERT로 넘어간다. 대체 경로 — 업무 완료 단위의 멱등 · 배타를 ClickHouse에 두려면 앱이 잠금 · 앞 조회를 만들어야 하고(공정성 규칙 7이 흉내를 금지한 바로 그것), 그 보장은 저장소가 아니라 앱 코드가 진다.
- **해석 한계 — 두 팔의 경합 위반 수는 실행기 규칙상 같게 나올 수밖에 없다(.omc 기록 규약 EXP-42 행).** 갱신 행 수 응답이 없으므로 실행기는 쌍마다 두 요청을 모두 끝까지 진행하고, 경합 위반 = 쌍 수가 된다. update_parallel_mode auto · sync의 차이가 드러날 수 있는 자리는 pairErrors(문장 오류)와 최종 status뿐인데, 두 팔 모두 pairErrors 0건 · 대상 주문 전부 COMPLETED다. 그래서 이 기록은 "sync가 두 번째 UPDATE를 막지 않았다"가 아니라 **"sync에서도 두 요청 모두 오류 없이 완료 단위를 마쳤다"**까지만 말한다 — sync가 patch 적용 순서를 직렬화했는지는 이 계측으로 가를 수 없다.
- **규모는 결과를 바꾸지 않는다.** 10^4 ~ 10^6에서 33행이 전부 같은 값이다 — 원자성은 데이터 양이 아니라 엔진의 쓰기 단위(트랜잭션 대 문장)가 정하는 구조 사실이라는 원리 대응 표의 질문("부분 반영과 경합을 저장소가 막는가 앱이 막아야 하는가")에 이 격자 안에서 "PostgreSQL은 저장소가 · ClickHouse는 앱이"로 답한다.
- **왜 PostgreSQL이 업무 데이터에 맞는가(목적 ①의 이 축).** 작업지시 완료처럼 여러 행을 한 단위로 바꾸는 쓰기에서 PostgreSQL은 실패 · 경합을 트랜잭션과 행 잠금으로 흡수해 불변식(완료 주문 = 실적 1행)을 3규모 × 3회 × 40주문 전부에서 지켰고, ClickHouse 기본 동작은 같은 입력에서 불변식을 반복마다 40주문 전부 어겼다(부분 반영 20 + 경합 20).

## 폐기 · 예외

- 폐기한 반복 없음 · 호출 27 전부 rc 0 · 불성립 구조 판정 없음(33행 전부 3회 같은 값).
- 구조 지표만이라 편차 폐기를 적용하지 않는다 — repeat.deviation 0은 "분포가 없다"의 표기다(.omc 기록 규약 구조 판정 행).
- PostgreSQL 누적 상태 경고 없음 — PostgreSQL 9호출 전부 detail.pgDirty.dirty false(앞 PostgreSQL 실행 뒤 reset all).
- 러너 git dirty true — 커밋 19f8861 위에 미커밋 변경(apps/web · scripts/lab)이 있었다. 실행기 이미지 · 러너 코드 경로의 변경 여부는 원시에 없다.

## 정본 반영

- 05_data_stores/10 §역방향 대조 EXP 연결 표 EXP-42 "확정되는 미확인"(부분 반영 · 경합 위반의 저장소별 발생) — 이 기록 042(19f8861 · 부하 실험 · 티어 해당 없음 · 스위치 기본값)로 올린다.
- 05_data_stores/10 §미확인 · 미설계 등재의 "ClickHouse UPDATE가 갱신 행 수를 응답으로 돌려주는지" — **돌려주지 않는다(경량 UPDATE · ALTER UPDATE mutations_sync 1 모두 written_rows 0 · 26.8.10.6)**로 닫는다.
- 04_architecture/04_storage_split 업무 데이터 목적지 근거에 "완료 단위 원자성 — PostgreSQL 부분 반영 0 · 경합 0 대 ClickHouse 20 · 20(기록 042)"을 인용할 수 있다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "042",
  "exp": ["EXP-42"],
  "status": "valid",
  "supersedes": null,
  "window": {"start": "2026-09-26T20:20:52.733Z", "end": "2026-09-26T23:11:19.326Z"},
  "run": {"commitHash": "19f8861", "memoryProfile": "load", "memoryLimitMb": null, "capacityTier": "해당 없음", "memoryLimitSource": "cgroup max — oltp-lab 서비스에 compose 상한 없음"},
  "switches": {"SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on", "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"},
  "conditions": {"injectionMode": null, "observability": "off", "cpuset": "control-equalized", "controlMemoryMb": {"clickhouse": 3584, "postgres": 3584}, "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384", "toolContainer": "oltp-lab cpuset 11-12 · api-bypassed · api stopped", "seed": 42, "inProgress": 0.5, "generatorCpuMax": null, "compression": "off", "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861)", "swapUsed": null, "wslNetworking": null, "simFaultPlan": null, "stage": "S5", "scales": [10000, 100000, 1000000], "fillSnapshots": "oltp-s{scale}-19f8861", "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle)", "clickhouseVersion": "26.8.10.6", "clickhouseMaxThreads": 3, "pgVersion": "18.6", "pgServerSynchronousCommit": "on", "pgSharedBuffers": "896MB", "runnerDirty": true, "runner": "scripts/lab/s5/oltp/oltp.sh", "raw": "docs/measurements/raw/042-oltp-control-atomic.jsonl", "pgSessionSynchronousCommit": "off", "inject": 20, "pairs": 20, "updateParallelMode": ["auto", "sync"], "updateParallelModeServerDefault": "auto", "chWriteSettings": {"enable_lightweight_update": 1}, "chReadSettings": {"apply_patch_parts": 1}, "structuralOnly": true, "judgedMetrics": ["partial_apply_count", "race_violation_count", "pair_partial_apply_count", "update_row_count_reported"], "interpretationLimit": "CH UPDATE returns no affected-row count (probe written_rows 0 on hit and miss) -> executor cannot apply PG rule (0 rows -> stop); race_violation = pairs for both arms; arm difference visible only in pairErrors / final status (both empty / COMPLETED)"},
  "repeat": {"runs": 3, "deviation": 0, "threshold": 0.2},
  "results": [],
  "reverse": [
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "inject:upm_auto", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "inject:upm_sync", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "probe:upm_auto", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 2, "rate": null, "read": "probe:upm_sync", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "inject:upm_auto", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "inject:upm_sync", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "probe:upm_auto", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 2, "rate": null, "read": "probe:upm_sync", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "inject:upm_auto", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "inject:upm_sync", "metric": "partial_apply_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs:upm_auto", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs:upm_sync", "metric": "race_violation_count", "unit": "count", "values": [20, 20, 20], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "probe:upm_auto", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 2, "rate": null, "read": "probe:upm_sync", "metric": "update_row_count_reported", "unit": "bool", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 2, "rate": null, "read": "inject", "metric": "partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "race_violation_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 2, "rate": null, "read": "inject", "metric": "partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "race_violation_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 2, "rate": null, "read": "inject", "metric": "partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "pair_partial_apply_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 2, "rate": null, "read": "pairs", "metric": "race_violation_count", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true}
  ]
}
```
