# 계측 지점과 수집 방식

> **대상**: 어디서 · 어느 시각을 · 어떻게 재는가 — 구간별 계측 지점(시작 · 끝 시각) · 수집 방식(prom-client · Redis INFO · XINFO · MEMORY USAGE · pg_stat_* · system.* · 호스트 도구 · 부하 도구 출력 · 판정 SQL) · E2E 지연 SQL(게이지 · 기록) · **Stream 대기 측정 시작점 = 엔트리 ID 시각** · 키 계열별 메모리 샘플링(표본 수) · 트리밍 결함 검출 · **구간 기록의 자리(alarm_eval 무효 구간 · 대조군 실패 · 롤업 의심)** · **확인(ACK) 신호 부재의 계측** · 스위치 · run 노출
> **작성일**: 2026-09-24
> **원천**: 원본 data_flow.md §15 · §16(커밋 ff66a37) · 원본 architecture.md §14(커밋 ff66a37) · 원본 tech_stack.md §9 · §10.6(커밋 ff66a37) · docs_plan.md 웨이브 인계 W6 10/02 행(Stream 대기 시작점) · W6 09 · 10/01 행(alarm_eval 무효 구간 기록 자리 · ACK 신호 부재 계측) · ADR-20 · ADR-21 · ADR-22 · REQ-OBS-03 · 04 · 05 · 11 · REQ-ING-18 · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §측정 지점 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../07_api/07_alarms.md](../07_api/07_alarms.md)

이 문서는 [01_metrics_catalog.md](./01_metrics_catalog.md)의 이름 하나하나가 **어느 코드 지점의 어느 시각 차**인지를 고정한다. 같은 이름이라도 시작 시각이 다르면 다른 양이다 — Stream 대기를 t0부터 재느냐 엔트리 ID 시각부터 재느냐가 튜닝 방향을 뒤집는다(§Stream 대기 측정 시작점).

**계측은 두 갈래다.** 앱 안 카운터 · 히스토그램은 각 도메인이 자기 경로에 두고 OBS는 모으기만 한다(REQ-OBS-02). 저장소 통계는 OBS가 **정해진 주기로 모아 두고** 스크레이프는 마지막 값을 받는다(REQ-OBS-03) — 스크레이프 빈도가 저장소 부하를 바꾸지 않게 하는 분리다. 세 번째로, 메트릭이 될 수 없는 판정(행 수 대조 · 중복 조회 · 역전 지점 쿼리)은 실험 절차의 SQL이 한다.

**모든 시각은 epoch ms · 같은 시계다.** 컨테이너들은 WSL2 VM 하나의 커널 시계를 공유하므로 Redis가 엔트리 ID에 새긴 시각과 api의 수신 시각을 같은 축에서 뺄 수 있다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)). 이 전제는 확장 로드맵에서 머신이 나뉘는 순간 깨진다 — 로컬 전용 범위 안에서만 성립한다.

## 계측 지점

구간 번호는 [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md)의 것이다.

| 구간 | 모듈 · 지점 | 시작 시각 | 끝 시각 | 메트릭 |
|------|------|------|------|------|
| #1 신호 → 레지스터 | GEN 모드 A 워커 | 생성 벡터 완료 | 레지스터 Buffer 쓰기 완료 | gen_register_update_seconds |
| #2 Modbus 왕복 | COL 요청 블록 | 요청 블록 송신 직전(= 행의 ts) | 응답 직후 | col_modbus_rtt_seconds |
| 폴링 사이클 | COL 스캔 그룹 | 사이클 첫 요청 송신 직전(t0) | XADD 응답 | poll_duration |
| 6a Stream 체류 | ING 컨슈머 | **엔트리 ID 밀리초** | XREADGROUP 응답 수신 | ing_stream_residence_seconds |
| 6b 디코딩 | ING 컨슈머 → 워커 | 수신 | 행 배열 완료 | ing_decode_seconds |
| 6c fan-in 대기 | ING flusher | 행 배열 완료(배치 안 최고 · 최저 둘 다 관측) | 플러시 시작 | ing_fanin_wait_seconds |
| #7 삽입 | ING flusher | INSERT 송신 | 응답 수신 | insert_duration |
| E2E | ClickHouse 컬럼 | ts | ingested_at(서버 DEFAULT) | e2e_latency |
| 판정 구간 A1~A6 | ALM 판정기 | 판정 호출 | A4 · A5 · A6 중 마지막 완료 | alm_eval_duration_seconds |
| 인계 대기 | ING flusher | 인계 시도 | 슬롯 확보 | alm_handoff_wait_seconds |
| 발행 → 송신 | RLT 게이트웨이 | 페이로드의 발행 시각 | 소켓 송신 호출 | rlt_fanout_delivery_seconds |
| API 지연 | HTTP 인터셉터 | 요청 수신 | 응답 완료 | http_request_duration_seconds |
| 재구성 | TSQ 캐시 미스 경로 | 원천 쿼리 송신 | 캐시 쓰기 완료 | tsq_rebuild_duration_seconds |
| COPY | ING flusher(SW-09) | COPY 트랜잭션 시작 | 커밋 | ing_control_copy_seconds |

- 검산: 지점 = **14**
- **ts와 t0가 다르다.** ts는 그 태그를 실은 요청 블록의 송신 직전 시각이고 t0는 사이클 첫 요청의 송신 직전 시각이다([../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) §모드 A ts 채취 시점). 한 사이클에 블록이 여럿이면 뒤 블록의 ts > t0다.
- **발행 → 송신은 수신이 아니다.** 브라우저 수신까지는 서버가 볼 수 없다 — SW-06 비교(EXP-11)는 같은 서버 지점에서 재므로 차이는 성립하고, 브라우저 수신 지연은 k6 ws 쪽 기록이 갖는다.

## 수집 방식

| 계열 | 방식 | 주기 | 읽는 것 | 실패 시 |
|------|------|------|------|------|
| 앱 · 파이프라인 · 조회 | prom-client 레지스트리(프로세스 안) | 사건마다 · 스크레이프는 즉시 | 카운터 · 히스토그램 · 게이지 | 해당 없음 — 프로세스 안 |
| 컨슈머 랙 | ING flusher가 XINFO GROUPS | 플러시마다 | lag · pending | 직전 값 · ing_consumer_lag_unknown 1 |
| Redis 서버 | OBS가 INFO(memory · stats · clients) · XLEN · XINFO STREAM | 수집 주기(현행 참고 15초) | 메모리 · 축출 · ops · 출력 버퍼 · 스트림 길이 · 누적 XADD · 첫 엔트리 ID | 그 계열만 비움 · obs_collect_errors_total{store="redis"} |
| Redis 키 계열 | OBS가 표본 추출 + MEMORY USAGE(§키 계열별 메모리 샘플링) | 수집 주기 | 접두별 점유 추정 | 상동 |
| PostgreSQL | OBS가 pg_stat_database · pg_stat_statements · pg_stat_user_tables · pg_locks · pg_stat_wal · 크기 함수 | 수집 주기 | 커밋 · 연결 · 적중 · 락 · 상위 문형 · 데드 튜플 · WAL · 크기 | 그 계열만 비움 |
| ClickHouse | OBS가 system.metrics · system.events · system.parts · system.part_log · system.query_log · system.disks(HTTP 8123) | 수집 주기 | 삽입 행 · 활성 파트 · 새 파트 · 머지 · 크기 · 쿼리 p95 · 디스크 여유 | 그 계열만 비움 |
| E2E | OBS가 tag_raw 주기 쿼리 | 수집 주기 | 창 분위수 · 행 수 | 게이지 비움 · e2e_latency_rows 0 |
| 호스트 · 컨테이너 | 실험 수행자가 docker stats · iostat · k6 프로세스 CPU를 기록 | 실험 중 수동 · 스크립트 | CPU · 메모리 · 디스크 대기 | 기록 칸 공란은 인용 불가 |
| 부하 도구 | k6 결과 요약 · 생성기 지표 | 실행 끝 | 클라이언트 쪽 분위수 · 달성률 · 중단 반복 수 | 해당 없음 |
| 판정 SQL | 실험 절차가 clickhouse-client · psql로 직접 | 판정 시점 1회 | count 대조 · 중복 · 롤업 대조 · 역전 쿼리 | 해당 없음 |

- 검산: 방식 = **10**
- **저장소 통계 수집은 api 역할 한 곳에서만 한다**(ADR-22). 역할 분리 뒤 worker · collector도 각자 /metrics를 내지만 저장소 통계를 다시 모으지 않는다 — 셋이 모으면 저장소 쿼리 로그에 관측 쿼리가 세 배로 섞인다.
- **호스트 · 컨테이너 계열에 exporter를 두지 않는다**(REQ-OBS-01 · ADR-20). 컨테이너 자원은 docker stats, 디스크 대기는 iostat을 실험 기록 칸에 적는다 — 호스트 대시보드가 Prometheus 출처 없이 도는 이유다([03_dashboards_alerts.md](./03_dashboards_alerts.md)).

## E2E 지연 SQL

E2E는 **ingested_at − ts 하나로만** 잰다(REQ-OBS-05 · REQ-GLB-01). 게이지와 기록은 같은 식이지만 쓰임이 달라 두 쿼리를 둔다.

```sql
-- 게이지(OBS-04) — 수집 주기마다 · 근사 분위수 · 최근 창
SELECT
    quantile(0.50)(dateDiff('millisecond', ts, ingested_at)) AS p50_ms,
    quantile(0.95)(dateDiff('millisecond', ts, ingested_at)) AS p95_ms,
    quantile(0.99)(dateDiff('millisecond', ts, ingested_at)) AS p99_ms,
    count() AS rows
FROM plc.tag_raw
WHERE ts > now() - INTERVAL 5 MINUTE;

-- 기록(EXP-30 등) — 판정 창이 끝난 뒤 1회 · 정확 분위수 · 판정 창 고정
SELECT
    quantilesExact(0.50, 0.95, 0.99)(dateDiff('millisecond', ts, ingested_at)) AS q_ms,
    count() AS rows,
    min(ts) AS first_ts,
    max(ts) AS last_ts
FROM plc.tag_raw
WHERE ts >= {window_start} AND ts < {window_end};
```

- **게이지는 근사 분위수다.** quantile은 표본 추출이라 반복마다 값이 흔들린다 — 콘솔 관찰에는 충분하지만 측정 기록의 E2E는 판정 창을 고정한 quantilesExact로 다시 센다. 기록 쿼리는 정밀 세션이 끝난 뒤 돌리므로 측정 대상에 부하를 더하지 않는다.
- **창은 ts로 자른다.** ingested_at으로 자르면 백프레셔로 늦게 들어온 행이 최근 창에 몰려 지연의 원인과 창의 기준이 같은 컬럼이 된다([../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §측정 지점).
- **판정 창 끝 뒤에 적재 완료를 기다린다.** 창 끝 직후에 세면 아직 Stream에 있는 행이 빠져 p99가 낮게 나온다 — 기록 쿼리는 회복(랙 0) 뒤에 돈다.
- 모드 D 백필 행은 ts가 과거라 창 밖이다 — REQ-NFR-03의 제외 규칙이 창 조건으로 성립한다. 스풀 재발행 행은 창 안이며 **그 지연은 실재한다**(스풀에 머문 시간까지 E2E에 든다).

## Stream 대기 측정 시작점

인계 "Stream 대기 측정 시작점 = 엔트리 ID 시각"을 계측 쪽에서 닫는다. 판정 자체는 [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §구간 경계 판정이 내렸고, 이 절은 그 값을 어떻게 얻는지를 고정한다.

| 경로 | 엔트리 ID 시각이 뜻하는 것 | 6a가 재는 것 | 주의 |
|------|------|------|------|
| 모드 A(Collector) | Redis가 Collector의 XADD를 받은 시각 | Stream 안에서 기다린 시간만 — Modbus 왕복 · 디코딩 · 인코딩 제외 | 원본 식(수신 − t0)은 #2~#5를 함께 센다 |
| 모드 B(생성기 직결) | 생성기 XADD 수신 시각 | 상동 | 생성기가 늦게 발행해도 6a는 늘지 않는다 — 그 지연은 E2E에만 든다 |
| 모드 C(HTTP) | api가 bulk 요청을 받아 XADD한 시각 | 상동 | HTTP 처리 시간은 http_request_duration_seconds |
| 스풀 재발행 | **재발행 XADD 시각**(새 ID) | 재발행 뒤 체류만 | 스풀에 머문 시간은 6a가 아니라 E2E에 든다 |
| 회수(XAUTOCLAIM) | 원 엔트리의 ID 시각 | 원 발행부터 회수 · 재배달까지 | 회수분은 6a 분포의 꼬리를 만든다 — 회수 수와 함께 읽는다 |

- 검산: 경로 = **5**
- **계산은 ID 문자열의 밀리초 부분 − api 수신 시각(epoch ms)이다.** 명시적 ID를 주지 않고 자동 ID를 쓴다는 전제다 — 발행자가 ID를 직접 지정하면 이 계측이 무너진다(페이로드 계약 정본 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md)).
- **B형 — 6a가 E2E보다 훨씬 작게 나오는 것은 결함이 아니다.** 결론 — 6a는 Stream 체류만이고 ADR-09 뒤 지배 구간은 6c다. 반대 시나리오 — 원본 식으로 재면 Modbus 지연이 늘어난 실험에서 Stream 대기가 늘어난 것으로 보여 플러시 주기를 줄이는 잘못된 튜닝을 한다. 파생 지침 — E2E 분해는 #2 + 6a + 6b + 6c + #7 + 나머지(인코딩 · XADD · MV)로 읽는다.

## 키 계열별 메모리 샘플링

인계 "메모리 샘플 수"를 닫는다. **키 전수를 훑지 않는다**(REQ-OBS-04) — 단일 스레드 Redis를 수집 동안 점유해 측정하려던 XADD · 조회 지연을 관측이 만든다. 계열마다 키의 모양이 달라 방법이 셋이다.

| 계열 | 키 모양 | 방법 | 표본(현행 참고 · 소유 [01_metrics_catalog.md](./01_metrics_catalog.md)) | 추정 |
|------|------|------|------|------|
| stream(raw · dlq) | 알려진 단일 키 2 | 키마다 MEMORY USAGE(기본 중첩 표본) | 키 2 전부 · 매 주기 | 측정값 그대로 · 정밀 값은 EXP-39가 전 중첩 표본으로 1회 |
| rt · alarm | 마스터가 아는 유한 키(설비 · 규칙 수만큼) | 마스터 목록에서 순환 표본 → MEMORY USAGE | 주기당 10 · 순환 | 표본 평균 × 마스터 키 수 |
| cache · lock · rl · sess · auth | 이름을 모르는 다수 키 | 무작위 키 추출 → 접두 분류 → MEMORY USAGE | 주기당 200 | 접두별 (표본 비율 × 전체 키 수) × 접두별 표본 평균 크기 |

- 검산: 계열 행 = **3** · 덮는 접두 = 2 + 1 + 5 = **8**
- **표본 수를 함께 낸다**(redis_prefix_sampled_keys) — lock · rl처럼 드문 접두는 표본이 0~수 개라 추정이 흔들린다. 표본 0인 주기의 값은 직전 값이 아니라 0이 아닌 "추정 불가"로 두고 대시보드가 점을 비운다.
- **stream과 cache를 같은 주기 · 같은 타임스탬프로 낸다**(REQ-OBS-04). 축출 연쇄의 역상관은 두 곡선의 시각 정렬이 전제다([03_dashboards_alerts.md](./03_dashboards_alerts.md) §축출 연쇄 패널).
- 추정 오차는 3계층 미확인이다. EXP-39가 부하 없는 상태의 전수(SCAN 1회 — 수집 경로 밖)와 대조해 표본 수를 조정하고, 그 전수 SCAN을 수집 코드에 들이지 않는다.

## 트리밍 결함 검출

stream_trimmed_unacked는 발행자가 셀 수 없다 — XADD MAXLEN ~가 조용히 자른다. OBS가 수집 주기마다 아래로 검출한다.

```plain
수집 주기 한 번
├─ XINFO STREAM → 첫 엔트리 ID(F)
├─ XPENDING 요약 → 최소 미확인 ID(P)
│  └─ P < F ──────────── PEL에 있는 엔트리가 잘렸다 · XPENDING P..F 범위 수만큼 증가 · 정확
├─ XINFO GROUPS → 마지막 배달 ID(D)
│  └─ D < F 이고 D 다음 엔트리가 존재했다 ────────── 미배달 엔트리가 잘렸다 · 사건 1 증가
└─ 그 밖 ─────────────────────────────────── 정상 — 확인된 엔트리만 잘렸다
```

- **PEL 쪽은 개수가 정확하고 미배달 쪽은 사건만 센다.** 미배달 구간의 엔트리 수는 잘린 뒤라 셀 수 없다 — 사건이 한 번이라도 나오면 무손실 판정이 이미 깨진 것이므로 개수보다 발생 여부가 판정에 충분하다.
- 정상 운전에서 확인된 엔트리의 트리밍은 결함이 아니다 — XLEN이 MAXLEN에 머무는 것이 정상이다(ADR-21).

## 구간 기록 — alarm_eval 무효 구간 · 대조군 실패 · 롤업 의심

인계 "alarm_eval 무효 구간 기록의 자리"를 닫는다. 세 기록은 모양이 같다 — **어떤 ts 범위의 데이터가 한 저장소에서 비었거나 의심스럽다.**

| 안 | 자리 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 저장 테이블 | PostgreSQL · ClickHouse에 무효 구간 테이블 | 고정 기준 테이블 수(PostgreSQL 15 · ClickHouse 5)가 바뀌고, ClickHouse가 멈춘 원인으로 생긴 구간을 ClickHouse에 쓸 수 없다 | 버림 |
| ② Redis 키 | 새 키 계열 | 봉인 계열 · 캐시 계열 어느 쪽인지 정해야 하고, 캐시면 축출로 기록이 사라지고 봉인이면 무한히 쌓인다 | 버림 |
| ③ 메트릭 레이블 | ts 범위를 레이블로 | 닫힌 레이블 집합이 깨진다(REQ-OBS-06) | 버림 |
| ④ **계수 메트릭 + 구조화 로그 이벤트** | 계수는 /metrics · 구간(ts 최솟값 · 최댓값 · 행 수 · 규칙 수 · 토큰)은 api 로그 한 줄 | 로그를 읽는 표면이 없어 판정 이력 분석 API가 무효 구간을 응답에 싣지 못한다 | **채택** |

- 검산: 안 = **4**

| 기록 | 계수 메트릭 | 로그 이벤트 | 로그 필드 | 쓰는 곳 |
|------|------|------|------|------|
| alarm_eval 무효 구간 | alm_eval_gap_batches_total · alm_eval_gap_rows_total | alarm_eval_gap | ts 최솟값 · 최댓값 · 행 수 · 규칙 수 · 원 배치 토큰 | 판정 분석 실험의 제외 구간(EXP-33) |
| 대조군 COPY 실패 | ing_control_copy_failures_total | control_copy_failed | ts 최솟값 · 최댓값 · 행 수 · 토큰 | 대조 격자 구간 무효(EXP-01~05) |
| 롤업 의심 구간 | ing_rollup_suspect_batches_total | rollup_suspect | 토큰 · ts 최솟값 · 최댓값 · 설비 목록 · 첫 오류 사유 | 정합 대조 우선 대상(EXP-31) |

- 검산: 기록 = **3**
- **B형 — 판정 이력 분석 API가 무효 구간을 모르는 것은 누락이 아니라 판정이다.** 결론 — 무효 구간은 실험 기록이 로그에서 옮겨 적는 조건이다. 반대 시나리오 — API가 알게 하려면 ① · ②의 저장소 변경이 필요하고 그 비용이 "분석 데이터가 빈다"는 원본 허용 결과보다 크다. 파생 지침 — 화면(ALM-CONSOLE 판정 이력)은 evalCount 0 주의 표지로 버티고, 계수가 0이 아닌 기간의 분석은 실험 기록에서만 인용한다. [../07_api/07_alarms.md](../07_api/07_alarms.md) #6 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)의 미설계 행은 이 판정으로 닫힌다(리드 반영).
- 로그 이벤트 이름은 계수 메트릭과 1:1로 둔다 — 계수가 오르면 같은 창의 로그에 같은 수의 이벤트가 있어야 하고, 어긋나면 로그 유실이다.

## 확인(ACK) 신호 부재의 계측

인계 "확인(ACK) 신호 부재의 계측"을 닫는다. ch:alarm은 열림 · 닫힘만 싣고 확인은 싣지 않아, 다른 운영자 화면의 확인 표시는 이벤트 목록 캐시 TTL만큼 늦다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)).

| 무엇을 | 수단 | 메트릭 · 기록 | 판정 |
|------|------|------|------|
| 확인 요청 수 · 거절 | 확인 표면 인터셉터 | alm_acks_total{result} | 분모 — 확인이 없는 기간에는 전파 지연을 잴 대상이 없다 |
| 전파 지연의 상한 | **구조 관계** — 이벤트 목록 캐시 TTL(2계층 · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)) + 화면 폴링 주기 | 메트릭 없음 — 1계층 관계로 기록 | 상한을 넘는 지연이 보이면 결함 |
| 실제 전파 지연 | EXP-33에서 두 브라우저 — 한쪽 확인 시각 · 다른 쪽 표시 시각 | 측정 기록 | 3계층 미확인 |

- 검산: 행 = **3**
- **서버 메트릭으로 전파 지연을 잴 수 없다.** 전파는 다른 탭이 목록을 다시 읽는 사건이고 서버는 그 탭이 언제 화면을 그렸는지 모른다 — 메트릭을 억지로 만들면 목록 조회 수를 전파로 오독한다. 부재는 "ACK는 신호가 없다"는 사실을 alm_acks_total과 구조 관계로 기록하는 것으로 계측한다.

## 스위치 · run 노출

| 노출 | 원천 | 시점 | 메트릭 | 검증 |
|------|------|------|------|------|
| 스위치 11 | DI 컨테이너가 실제 주입한 구현 | 기동 1회 | obs_switch_info · obs_switch_warning | health switches와 값 일치(REQ-OBS-11) |
| 커밋 · 프로파일 · 티어 | 빌드 인자 COMMIT_HASH · 환경변수 MEMORY_PROFILE · CAPACITY_TIER | 기동 1회 | obs_run_info | health run과 일치 |
| 실제 메모리 상한 | cgroup 메모리 상한 파일 | 기동 1회 | obs_run_memory_limit_bytes | docker stats 상한과 일치(AC-15) |

- 검산: 노출 = **3**
- 환경변수 이름의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)다. 값을 모르면 레이블 값을 빈 문자열로 두고 health는 null이다 — 추정값으로 채우지 않는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 수집 주기 · 표본 추출 · E2E 게이지 쿼리가 측정 대상에 더하는 부하 | 3계층 미확인 | EXP-38 |
| 메모리 표본 추정 오차 | 3계층 미확인 | EXP-39 |
| 구조화 로그의 보관 · 조회 수단 | 미설계 — 컨테이너 로그를 실험 수행자가 읽는다 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| 확장 1단계 뒤 역할별 지점 배치 | ADR-22 — 지점은 모듈을 따라간다 | 확장 1단계 진입 시 |

## 관련 문서

- [01_metrics_catalog.md](./01_metrics_catalog.md) — 메트릭 이름 · 조정값
- [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) — 구간 정의 · 경계 판정
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — flusher · fan-in
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — 판정기 · 무효 구간
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — 메모리 측정 계약
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — ts · ingested_at · 시계
- [07_measurement_limits.md](./07_measurement_limits.md) — 관측 간섭
