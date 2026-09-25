# 018 — DLQ 격리: 해독 불가 엔트리와 재시도 소진 배치의 격리 · XACK · 정상분 무손실 (S3 · 티어 S · 모드 B)

> 실험: EXP-19 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T04:53:50Z ~ 05:07:05Z(반복 3회 · 반복마다 발행 90초 + 랙 0 대기)

티어 S 부하(설비 5 × 태그 50 · 250 pps)를 모드 B로 90초 발행하면서 해독 불가 엔트리를 50엔트리마다 하나씩 섞는다. 발행 시작 15초 뒤 ClickHouse 컨테이너를 45초 동안 멈춰 삽입이 백오프 합계(31초)보다 오래 실패하게 만든다. 해독 불가 엔트리는 재시도 없이 즉시, 삽입이 계속 실패한 배치의 엔트리는 재시도 소진 뒤 DLQ로 옮겨지고 XACK되어야 한다 — PEL 잔류 0 · dlq_count 증가 · 정상분 AC-01 식 차 0이 AC-12의 합격선이다. 알림 발동은 관측 스택을 켠 실행에서만 판정하며(AC-12 문구) 이 기록은 관측 스택 off라 판정하지 않는다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 250 pps) |
| 스위치 | 전부 기본값(전수는 기계 판독 블록) — 3회 모두 health switches가 같다 |
| 배치 안 | A(컨슈머 3 · 창 1초 · 행 트리거 R 50,000 · 크기 트리거 P 32 MB) — 스위치 아님 |
| 주입 모드 · 시드 · 혼합 | B(datagen 컨테이너가 Stream에 직접 XADD · node dist/mode-b.js --tier S --mix mixed --seed 42 --duration 90 --undecodable-every 50) · 42 · mixed |
| 결함 | ① 해독 불가 페이로드 — 50엔트리마다 1개(발행 결과 undecodableInjected 9) ② 삽입 실패 — 발행 시작 15초 뒤 clickhouse 컨테이너 docker stop -t 0 → 45초 뒤 docker start |
| api 역할 | APP_ROLE=worker(적재만 — Collector 없음) |
| 재시도 · 백오프 | 현행 참고 1 · 2 · 4 · 8 · 16초 = 합계 31초(06_pipeline/03 소유 · 2계층) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 모드 B 워커 사용률 0.06% 안팎(발행 결과 workerUtilization) · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 반복마다 스냅샷 s3-empty-s 복원 · 기준선 240초(api 없이 저장소 유휴 · docker stats) — 현행 참고 5분보다 짧다(§폐기 · 예외) |
| 반복 · 편차 | 3회 · 판정 지표가 구조 판정(격리 · PEL 0 · 차 0)이라 편차 폐기를 적용하지 않는다(repeat.deviation 0) |
| 스크립트 | scripts/lab/s3/exp19-rep.sh <출력> <반복> [발행 초=90] [해독 불가 간격=50] [정지 시작 초=15] [정지 초=45] [기준선 초] · apps/api/src/lab/s3-verify.ts(--phase stopped) · 원시 docs/measurements/raw/018-failure-dlq.jsonl |

반복 한 번의 절차는 아래 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s3-empty-s
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=worker → health 보관
④ 발행          모드 B 90초(엔트리 450 · 포인트 22,500 + 해독 불가 9) — 창 시작 시각 기록
   정지         발행 시작 15초 뒤 clickhouse docker stop -t 0 → 45초 뒤 docker start
⑥ 회복          consumer_lag 0까지 대기 → 창 끝 · /metrics(dlq_count 사유별 · 재시도 · 정지 누계 · rows_inserted)
⑦ 정합          api 정상 종료 → s3-verify(DLQ 사유별 · 소진 격리 포인트 · diffAfterDlq · PEL · AC-02)
```

- **정상분 AC-01 식은 소진 격리분을 뺀 차다.** diffAfterDlq = Stream 디코딩 포인트 − tag_raw − 소진 격리 포인트. 해독 불가 엔트리는 디코딩 포인트에 들지 않으므로 식에 이미 빠져 있다.
- **stop을 쓰고 pause를 쓰지 않는다.** pause는 연결이 대기 상태로 남아 한 시도가 요청 타임아웃(10초)만큼 늘어질 뿐 연결 거부가 나지 않아, 45초 정지로도 소진에 이르지 못했다(통합 확인 · §폐기 · 예외).

## 결과

| 반복 | 판정 창(UTC) | clickhouse 정지 → 재기동 | 발행 엔트리 · 포인트 · 해독 불가 | Stream 엔트리 | 정지 뒤 lag · pending | DLQ 해독 불가 · 소진 | 소진 격리 포인트 | tag_raw | 차 · 격리 뺀 차 | AC-02 중복 조합 | 판정 |
|------|------|------|------|------|------|------|------|------|------|------|------|
| 1 | 04:53:50 ~ 04:55:25 | 04:54:06 → 04:54:51 | 450 · 22,500 · 9 | 459 | 0 · **0** | **9** · **5** | 250 | 22,250 | 250 · **0** | **0** | 성립 |
| 2 | 04:59:41 ~ 05:01:17 | 04:59:56 → 05:00:41 | 450 · 22,500 · 9 | 459 | 0 · **0** | **9** · **5** | 250 | 22,250 | 250 · **0** | **0** | 성립 |
| 3 | 05:05:30 ~ 05:07:05 | 05:05:46 → 05:06:31 | 450 · 22,500 · 9 | 459 | 0 · **0** | **9** · **5** | 250 | 22,250 | 250 · **0** | **0** | 성립 |

- **AC-12 성립 3/3(알림 제외).** 해독 불가 9엔트리와 소진 5엔트리가 사유별로 DLQ에 들어갔고(DLQ 엔트리 9 + 5 = **14**), 정지 뒤 PEL 잔류가 0이며, 격리분을 뺀 정상분의 차가 0이다.
- Stream 엔트리 459 = 발행 450 + 해독 불가 9. 해독 불가 9 = 450 ÷ 50.
- 소진 격리 포인트 250 = 소진 엔트리 5 × 태그 50 — 한 창(초당 엔트리 5)의 배치 하나다. tag_raw 22,250 = 22,500 − 250.

| 반복 | dlq_count 해독 불가 · 소진 | ing_insert_retries_total | 컨슈머 정지 누계 | rows_inserted | 발행 최대 적체 | AC-05 불일치 합 · AC-07 불일치 |
|------|------|------|------|------|------|------|
| 1 | 9 · 5 | 9 | 45.42초 | 22,250 | 237 | 0 · 0 |
| 2 | 9 · 5 | 9 | 45.42초 | 22,250 | 237 | 0 · 0 |
| 3 | 9 · 5 | 9 | 45.38초 | 22,250 | 237 | 0 · 0 |

- dlq_count(메트릭)가 반복마다 s3-verify의 DLQ 사유별 엔트리 수와 같다 — 계측과 실제 Stream이 같은 수를 센다.
- 컨슈머 정지 누계(ing_consumer_paused_seconds_total)가 clickhouse 정지 45초와 같은 크기다 — 삽입이 실패하는 동안 컨슈머가 읽기를 멈췄다.
- 참고 — E2E(기록 SQL 정확 분위수 · 판정에 쓰지 않는다) p50 2,849~2,949 ms · p95 42,193~42,255 ms · p99 46,139~46,190 ms. 창 안에 45초 정지가 들어 있어 E2E 기록으로 인용하지 않는다.
- 기준선 — clickhouse CPU 3.88 · 4.13 · 4.13% · 메모리 708.8~715.2 MiB · postgres 약 52.6 MiB · redis 약 11.5 MiB.

## 해석

- **두 격리 경로가 서로 다른 시점에 돈다.** 해독 불가 엔트리는 디코딩 단계에서 바로 DLQ로 가고 삽입 경로에 닿지 않는다 — ClickHouse가 멈춘 동안에도 격리되는 몫이다. 소진 엔트리는 같은 토큰의 재시도가 백오프 합계 31초를 다 쓴 배치의 원 엔트리이며, 격리 단위가 배치가 아니라 원 엔트리 5개다(06_pipeline/03 §재시도 · 격리 · DLQ).
- **재시도 9와 정지 45초가 백오프 산술과 맞는다.** 첫 실패 배치는 재시도 5회(1 + 2 + 4 + 8 + 16 = 31초) 뒤 소진되고, 다음 배치는 재시도 4회(1 + 2 + 4 + 8 = 15초)째에 ClickHouse가 돌아와 성공하면 합 5 + 4 = **9** · 31 + 15 = 46초로 정지 45초를 덮는다. 원시에 배치별 재시도 분해는 없어 이 분해는 산술 대조다. flusher가 재시도 동안 다음 배치를 삽입하지 않으므로 소진은 배치 하나에 그친다.
- **소진 배치가 하나뿐이라 정상분이 무손실이다.** 소진되지 않은 배치는 전부 PEL에 남아 ClickHouse 복귀 뒤 삽입됐고(중복 조합 0 — 재시도가 같은 토큰을 쓴다), 격리된 250포인트를 뺀 차가 0이다. 소진분은 DLQ에 원 엔트리로 남아 재처리 대상이다(재처리는 S6 · 06_pipeline/11).
- **AC-05가 소진 뒤에도 성립한다.** 소진 배치는 원시에도 롤업에도 쓰이지 않았고, 재시도 성공 배치는 같은 토큰으로 원시와 롤업에 한 번씩 들어갔다 — 세 해상도 불일치 합 0.
- 한계 — 정지 길이 45초 · 정지 시작 15초 한 점이다. 정지가 더 길면 소진 배치 수가 늘고, 백프레셔 단계 전이(ADR-21)와 스풀 경로가 함께 돈다 — 그 경계는 S6(AC-11)이 잰다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음.
- **알림 발동은 판정하지 않았다.** 관측 스택 off 실행이다 — AC-12 문구대로 알림은 observability 프로파일 기동 시에만 판정하며, 그 판정은 관측 스택을 켠 별도 실행(S6)의 몫이다.
- **pause 방식의 통합 실행은 소진에 이르지 못해 이 기록의 반복이 아니다.** docker pause로 45초 멈춘 통합 확인에서는 연결이 대기해 한 시도가 요청 타임아웃 10초만큼 늘어질 뿐 연결 거부가 나지 않았고, 재시도가 백오프 합계를 다 쓰기 전에 ClickHouse가 돌아왔다. 러너를 docker stop -t 0으로 바꾼 뒤의 실행만 원시에 있다.
- **기준선이 현행 참고 5분보다 짧다.** 도구 호출 한 번이 10분을 넘지 않게 240초로 줄였다. 기준선은 유휴 바닥을 보는 칸이고 이 기록의 판정은 구조 판정이라 판정 값에 닿지 않는다.
- **모드 B 발행 결과의 run.memoryLimitMb가 null이다.** datagen 컨테이너의 health 복사값이며 기계 판독 블록 run은 api health에서 옮겼다. SW-10 impl이 null인 것은 APP_ROLE=worker라 Collector 모듈이 없기 때문이다(value는 off).
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. exp19-rep.sh의 fdc7849 대비 차이는 파일 모드 100644 → 100755뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 03_requirements/14 AC-12 — S3 성립 근거(알림 제외)로 기록 018을 인용한다. 알림 판정은 S6 관측 스택 실행으로 남긴다.
- 10_observability/06 EXP-19 "확정되는 미확인" 열의 DLQ MAXLEN 프로파일별 값은 이 기록으로 정하지 않는다 — DLQ 엔트리 14는 MAXLEN 근거가 되기에 너무 작다.
- 06_pipeline/03 §재시도 · 격리 · DLQ — "해독 불가는 즉시 · 삽입 실패는 재시도 소진 뒤 · 원 엔트리 단위 격리"가 실측으로 확인됐음을 기록 018로 인용한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "018",
  "exp": ["EXP-19"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T04:53:50.000Z", "end": "2026-09-25T05:07:05.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S3", "tierConfig": "device5-tag50-250pps", "modeBMix": "mixed", "publishS": 90, "undecodableEvery": 50, "appRole": "worker", "fault": "clickhouse docker stop -t 0 at +15s for 45s", "backoffS": [1, 2, 4, 8, 16], "batchPlan": "A", "consumers": 3, "snapshot": "s3-empty-s", "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "baselineS": 240, "alertJudged": false },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "dlq_undecodable_entries", "arm": "AC-12", "unit": "entries", "values": [9, 9, 9], "median": 9 },
    { "metric": "dlq_retry_exhausted_entries", "arm": "AC-12", "unit": "entries", "values": [5, 5, 5], "median": 5 },
    { "metric": "dlq_exhausted_points", "arm": "AC-12", "unit": "points", "values": [250, 250, 250], "median": 250 },
    { "metric": "pel_pending_after_stop", "arm": "AC-12", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_diff_after_dlq", "arm": "AC-12", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac02_duplicate_combos", "arm": "AC-12", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "insert_retries", "arm": "AC-12", "unit": "count", "values": [9, 9, 9], "median": 9 },
    { "metric": "consumer_paused_s", "arm": "AC-12", "unit": "s", "values": [45.42, 45.419, 45.381], "median": 45.419 },
    { "metric": "clickhouse_stopped_s", "arm": "AC-12", "unit": "s", "values": [45, 45, 45], "median": 45 },
    { "metric": "ac12_pass", "arm": "AC-12", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "e2e_p50_ms", "arm": "reference", "unit": "ms", "values": [2850, 2949, 2849], "median": 2850 },
    { "metric": "e2e_p99_ms", "arm": "reference", "unit": "ms", "values": [46145, 46190, 46139], "median": 46145 }
  ]
}
```
