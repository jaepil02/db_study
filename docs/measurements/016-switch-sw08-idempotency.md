# 016 — SW-08 적재 멱등 on/off: XACK 전 크래시 재전달의 중복 행 (S3 · 티어 S · 모드 B)

> 실험: EXP-13 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T03:03:47Z ~ 03:28:35Z(반복 3 × 팔 2 · 팔마다 발행 30초 + 랙 0 대기)

티어 S 부하(설비 5 × 태그 50 · 250 pps)를 모드 B로 Stream에 발행하고, 적재만 하는 api(APP_ROLE=worker)가 5번째 배치를 삽입에 성공한 뒤 XACK 전에 스스로 끝나게 한다(INGEST_LAB_FAULT=crash-after-insert:5 · exit 137). 재시작 정책이 api를 다시 띄우면 컨슈머가 자기 PEL을 다시 읽어 이미 삽입된 배치를 한 번 더 삽입한다. SW-08만 off(토큰 없음 · 서버 중복 제거 끔) · on(결정적 배치 토큰)으로 바꿔 그 재삽입이 tag_raw에 중복 행을 남기는지 잰다. AC-20의 합격선은 off 중복 1건 이상 · on 0건이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 250 pps) |
| 스위치 | SW-08=off/on(off NoBatchToken · on DeterministicBatchToken) · SW-01 on(조합 제약 #3) · 그 외 기본값(전수는 기계 판독 블록) — 6팔 전부의 health switches를 대조해 SW-08 value · impl만 다름을 확인했다 |
| 배치 안 | A(컨슈머 3 · 창 1초 · 행 트리거 R 50,000 · 크기 트리거 P 32 MB) — INGEST_BATCH_PLAN 기본값 · 스위치 아님 |
| 주입 모드 · 시드 · 혼합 | B(datagen 컨테이너가 Stream에 직접 XADD · node dist/mode-b.js --tier S --mix mixed --seed 42 --duration 30) · 42 · mixed |
| api 역할 · 결함 주입 | APP_ROLE=worker(적재만 — Collector 없음) · INGEST_LAB_FAULT=crash-after-insert:5(1회 발동 · 표지 /app/spool/lab-fault-fired) — 기동 health의 SW-08 warning lab_fault_crash_after_insert · 재기동 뒤 lab_fault_already_fired |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 모드 B 워커 사용률 0.07~0.08%(발행 결과 workerUtilization) · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 팔마다 스냅샷 s3-empty-s 복원(fdc7849 이미지로 빈 볼륨에서 migrate + seed) · 기준선 240초(api 없이 저장소 유휴 · docker stats) — 현행 참고 5분보다 짧다(§폐기 · 예외) |
| 팔 순서 | 반복마다 off → on(교대하지 않았다 — §폐기 · 예외) |
| 반복 · 편차 | 3회 · 판정 지표가 구조 판정(중복 조합 수 ≥ 1 · = 0)이라 편차 폐기를 적용하지 않는다(repeat.deviation 0) |
| 스크립트 | scripts/lab/s3/exp13-rep.sh <출력> <off · on> <반복> [발행 초=30] [크래시 배치=5] [기준선 초] · apps/api/src/lab/s3-verify.ts(--phase stopped) · 원시 docs/measurements/raw/016-switch-sw08-idempotency.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s3-empty-s
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=worker · INGEST_IDEMPOTENCY=off 또는 on · INGEST_LAB_FAULT=crash-after-insert:5 → health 보관
④ 발행          모드 B 30초(엔트리 150 · 포인트 7,500) — 창 시작 시각 기록
   크래시       5번째 배치 삽입 성공 → XACK 전 exit 137 → 재시작 정책이 api 재기동 → 컨슈머마다 PEL 회수(재전달)
⑥ 회복          발행 끝 5초 뒤부터 consumer_lag 0까지 대기(상한 180초) — 창 끝 시각 · 재시작 수 · health 보관
⑦ 정합          api 정상 종료 → query_log(삽입 수 · DuplicatedInsertedBlocks) → s3-verify(AC-02 중복 조합 · AC-01)
```

- **AC-02 식은 tag_id + ts 조합별 행 수가 2 이상인 조합의 수다.** extraRows는 그 조합들의 (행 수 − 1) 합이다.
- **모드 B의 AC-01 분모는 발행 포인트다.** Collector가 없어 points_emitted가 없다 — Stream 디코딩 포인트 합(= 발행 포인트)과 tag_raw count()를 맞추며, 중복이 있으면 차가 음수로 나온다.
- query_log는 판정 창(창 끝 + 5초) 안 QueryFinish · Insert · plc.tag_raw 대상 쿼리를 센다. writtenRows는 MV가 롤업에 쓴 행을 포함한다.

## 결과

값의 순서는 반복 1 · 2 · 3이다.

| 반복 | 팔 | 판정 창(UTC) | 재시작 | PEL 회수 엔트리(컨슈머별) | 발행 엔트리 · 포인트 | tag_raw | AC-01 차 | AC-02 중복 조합 · 추가 행 | 삽입 쿼리 · 중복 제거 블록 | 판정 |
|------|------|------|------|------|------|------|------|------|------|------|
| 1 | off | 03:03:47 ~ 03:04:22 | 1 | 6 · 2 · 2 = 10 | 150 · 7,500 | 7,750 | −250 | **250** · 250 | 31 · 0 | 성립 |
| 1 | on | 03:08:38 ~ 03:09:14 | 1 | 2 · 2 · 6 = 10 | 150 · 7,500 | 7,500 | **0** | **0** · 0 | 31 · 8 | 성립 |
| 2 | off | 03:13:30 ~ 03:14:05 | 1 | 4 · 4 · 2 = 10 | 150 · 7,500 | 7,750 | −250 | **250** · 250 | 31 · 0 | 성립 |
| 2 | on | 03:18:18 ~ 03:18:54 | 1 | 2 · 2 · 6 = 10 | 150 · 7,500 | 7,500 | **0** | **0** · 0 | 31 · 8 | 성립 |
| 3 | off | 03:23:10 ~ 03:23:46 | 1 | 4 · 4 · 2 = 10 | 150 · 7,500 | 7,750 | −250 | **250** · 250 | 31 · 0 | 성립 |
| 3 | on | 03:27:59 ~ 03:28:35 | 1 | 2 · 6 · 2 = 10 | 150 · 7,500 | 7,500 | **0** | **0** · 0 | 31 · 8 | 성립 |

- **AC-20 성립 3/3 — off는 반복마다 중복 조합 250(≥ 1) · on은 0이다.** on 팔은 재전달 구간을 포함해 AC-02(0건)도 성립한다.
- PEL 회수 엔트리는 로그의 컨슈머별 줄을 이름 순서(ingest-1 · 2 · 3)로 옮겼다. 컨슈머 사이 배분은 반복마다 다르고 합은 늘 10이다.
- 삽입 쿼리 31 = 창 30(발행 30초 · 창 1초) + 재삽입 1. writtenRows는 6팔 모두 31,000 = 31 × 1,000이다.

| 반복 | 팔 | rows_inserted(재기동 뒤) | ing_insert_retries_total | DLQ | AC-05 불일치 합 | AC-07 불일치 | 정지 뒤 lag · pending |
|------|------|------|------|------|------|------|------|
| 1 | off | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |
| 1 | on | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |
| 2 | off | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |
| 2 | on | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |
| 3 | off | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |
| 3 | on | 6,500 | 0 | 0 | 0 | 0 | 0 · 0 |

- rows_inserted는 프로세스 누적이라 크래시로 0이 된 뒤의 값이다 — 크래시 전 5배치 × 250 = 1,250행이 빠지고 재삽입 250행이 들어간다. off 7,750 − 1,250 = **6,500** · on 7,500 − 1,250 + 250 = **6,500**. on의 재삽입 250행은 클라이언트가 보낸 행이고 서버가 중복 제거로 버렸다.
- **AC-05가 off 팔에서도 불일치 0이다.** 중복 행이 원시와 롤업에 똑같이 들어가 두 쪽 count가 같이 늘기 때문이다 — AC-05는 원시 대 롤업 정합이지 무중복 판정이 아니다.
- 참고 — E2E(기록 SQL 정확 분위수 · 판정에 쓰지 않는다) p50 1,017~1,018 ms · off p99 1,624~1,665 ms · on p99 1,423~1,497 ms. 창 안 행에 크래시 · 재기동 구간이 들어 있어 E2E 기록으로 인용하지 않는다.

## 해석

- **XACK 전 크래시는 배치 하나를 정확히 한 번 더 삽입한다.** 회수된 엔트리 10 = 창 2개 × 초당 엔트리 5다 — 삽입은 됐으나 XACK되지 않은 5번째 배치(엔트리 5 · 250행)와 아직 창 버퍼에 있던 다음 창(엔트리 5)이다. 앞쪽 5개만 이미 삽입됐으므로 off의 추가 행이 250 = 엔트리 5 × 태그 50이고, 중복 조합 수와 추가 행이 같은 것은 조합마다 정확히 2행이라는 뜻이다.
- **on의 멱등은 토큰이 같은 재삽입을 서버가 버린 결과다.** 결정적 토큰(첫 엔트리 ID · 끝 엔트리 ID · 행 수의 sha1)은 창 정렬 배치에서 재전달에도 같은 값이 되고(06_pipeline/03 §토큰 재료 판정), on 팔만 query_log DuplicatedInsertedBlocks가 8이다. 8의 분해(원시 블록 · 롤업 대상 블록)는 불명이다 — 기록 004 · 통합 단계 off 결함 실행과 같은 값이다. AC-05 불일치 0이 롤업도 두 배가 되지 않았음을 보인다.
- **off가 중복을 만든 것은 SW-08 off 구현을 고친 뒤다(통합 단계 결함).** ClickHouse 26.8에서는 deduplicate_insert(기본 enable)가 insert_deduplicate를 대체한다. 처음 구현은 off를 insert_deduplicate 0으로만 두었고, 서버가 이 값을 무시해 토큰 없는 같은 블록도 중복 제거했다. 그래서 off에서도 중복이 0이었다(query_log DuplicatedInsertedBlocks 8). deduplicate_insert 'disable'로 고친 뒤 off 중복 250 · on 0이 나왔고, 이 수정은 커밋 fdc7849에 들어 있다(apps/api/src/modules/ingest/batch-token.port.ts). 06_pipeline/03 개정일 줄이 같은 사실을 갖는다.
- **재시도 수 지표는 이 재전달을 세지 않는다.** ing_insert_retries_total은 프로세스 안 재시도(같은 토큰 · 지수 백오프)만 세며 6팔 전부 0이다 — 크래시 재전달은 PEL 회수 로그(엔트리 10)로만 보인다. 카탈로그 수집 항목 "재시도 수"는 이 기록에서 PEL 회수 엔트리 수로 채운다.
- 한계 — 결함 주입은 크래시 한 점(5번째 배치 · 1회)이다. 재시도 백오프 중 크래시 · 컨슈머 재배분(XAUTOCLAIM) 경로의 멱등은 이 기록이 보지 않았다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음.
- **팔 순서를 교대하지 않았다.** 반복마다 off → on 순서다. 판정 지표가 구조값(중복 조합 수)이고 팔마다 스냅샷을 복원하므로 순서 효과가 판정에 닿지 않는다고 보고 그대로 둔다 — 분포 지표(E2E)는 참고로만 적었다.
- **기준선이 현행 참고 5분보다 짧다.** 도구 호출 한 번이 10분을 넘지 않게 240초로 줄였다. 기준선은 유휴 바닥을 보는 칸이고 이 기록의 판정은 구조 판정이라 판정 값에 닿지 않는다.
- **모드 B 발행 결과의 run.memoryLimitMb가 null이다.** datagen 컨테이너의 health 복사값이며 api의 4요소(health0 · 2048 MB)와는 별개다. 기계 판독 블록 run은 api health에서 옮겼다.
- **SW-10 impl이 null이다.** APP_ROLE=worker라 Collector 모듈이 없어 데드밴드 구현이 올라오지 않는다. value는 off로 기본값이다.
- **통합 단계의 무효 실행** — deduplicate_insert 결함을 찾기 전의 EXP-13 실행(off 중복 0 · DuplicatedInsertedBlocks 8)은 코드가 fdc7849 이전이라 이 기록의 반복이 아니며 원시에 없다.
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. exp13-rep.sh의 fdc7849 대비 차이는 파일 모드 100644 → 100755뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 01_overview/05 S3 합격 판정 ③ AC-20이 이 기록을 인용한다.
- 03_requirements/14 AC-20 · AC-02(재시도 유발 구간 포함)의 S3 성립 근거로 인용한다.
- 10_observability/06 EXP-13 수집 항목 문구 보정 제안 — "재시도 수"를 프로세스 안 재시도(ing_insert_retries_total)와 재전달(PEL 회수 엔트리)로 가르고, "쓰인 행 수 0 배치 수"는 query_log written_rows로 셀 수 없음(중복 제거된 재삽입도 written_rows에 잡힌다 · MV 쓰기 포함)을 적는다. 러너는 중복 제거 여부를 DuplicatedInsertedBlocks로 센다.
- 02_features/13 SW-08 예상 행 — "off는 재전달 중복이 생기고 on은 0"을 실측 확인(기록 016 · fdc7849 · 부하 실험 · S · SW-08 off/on · 모드 B)으로 올린다.
- 06_pipeline/03 미확인 등재의 "SW-08 off의 재시도 중복 재현 수단" 행은 이미 닫힘(S3 판정)이다 — 그 행의 "실측은 EXP-13"을 기록 016 인용으로 바꾼다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "016",
  "exp": ["EXP-13"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T03:03:47.000Z", "end": "2026-09-25T03:28:35.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": ["off", "on"], "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "generatorWorkerUtilizationMax": 0.0008, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S3", "tierConfig": "device5-tag50-250pps", "modeBMix": "mixed", "publishS": 30, "appRole": "worker", "labFault": "crash-after-insert:5", "batchPlan": "A", "consumers": 3, "snapshot": "s3-empty-s", "armOrder": "off-then-on", "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "sw08OffSetting": "deduplicate_insert=disable", "baselineS": 240 },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "ac02_duplicate_combos", "arm": "off", "unit": "count", "values": [250, 250, 250], "median": 250 },
    { "metric": "ac02_duplicate_combos", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac02_extra_rows", "arm": "off", "unit": "rows", "values": [250, 250, 250], "median": 250 },
    { "metric": "ac02_extra_rows", "arm": "on", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_diff", "arm": "off", "unit": "rows", "values": [-250, -250, -250], "median": -250 },
    { "metric": "ac01_diff", "arm": "on", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "pel_reclaimed_entries", "arm": "off", "unit": "entries", "values": [10, 10, 10], "median": 10 },
    { "metric": "pel_reclaimed_entries", "arm": "on", "unit": "entries", "values": [10, 10, 10], "median": 10 },
    { "metric": "insert_retries", "arm": "off", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "insert_retries", "arm": "on", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "insert_queries", "arm": "off", "unit": "count", "values": [31, 31, 31], "median": 31 },
    { "metric": "insert_queries", "arm": "on", "unit": "count", "values": [31, 31, 31], "median": 31 },
    { "metric": "dedup_blocks", "arm": "off", "unit": "blocks", "values": [0, 0, 0], "median": 0 },
    { "metric": "dedup_blocks", "arm": "on", "unit": "blocks", "values": [8, 8, 8], "median": 8 },
    { "metric": "ac20_pass", "arm": "off", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac20_pass", "arm": "on", "unit": "bool", "values": [1, 1, 1], "median": 1 }
  ]
}
```
