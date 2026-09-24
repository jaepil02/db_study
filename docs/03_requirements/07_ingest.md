# REQ-ING — 적재·분기 요구사항

> **대상**: 적재·분기(ING · NestJS ingest 모듈)의 동작 계약 — Stream 소비 · 배치 플러시 · ClickHouse 삽입 · 멱등 · XACK · 재시도 · DLQ · PEL 회수 · 다중 컨슈머 · 최신값 · 알람 전달 · 3계층 분기 실행 · 대조군 동시 적재 · 롤업 발동 · 백프레셔 대응 · 관측 — REQ-ING-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 반영 · 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-ING-18 Stream 대기 시작점 t0 → **엔트리 ID 시각**(04_architecture/05 판정과 통일) — REQ 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 롤업 객체 귀속 잠정 ING → **ING 확정**
> **원천**: 원본 architecture.md §5 · §7.1 · §7.2 · §7.5 · §9 · §9.1 · §9.2 · §9.3 · §14 · §17(커밋 ff66a37) · 원본 data_flow.md §4 · §4.1 · §4.2 · §4.3 · §8.2 · §10.2 · §12.2 · §12.3 · §12.4 · §15 · §17(커밋 ff66a37) · 원본 tech_stack.md §5.3(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S3 · S6 · S7 · §7.1 · §7.2 · §7.3 · §7.5(커밋 ff66a37) · D-04 · D-05 · D-12 · [../02_features/06_ingest.md](../02_features/06_ingest.md) ING-01~13 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · [01_global_rules.md](./01_global_rules.md) REQ-GLB-04~07 · 11 · 12

이 문서는 ING 기능 13개의 동작 계약을 고정한다. ING는 Stream에서 배치를 꺼내 저장소에 확정하고 그 자리에서 데이터를 성격별 목적지로 가른다. 학습 목표 두 축의 **실행 자리**가 모두 여기 있다 — 목표 ②의 3계층 분기 실행(REQ-ING-14)과 목표 ①의 대조군 동시 적재(REQ-ING-15)다.

**ING에는 외부 표면이 없으므로 실패는 에러 코드가 아니라 배치 상태 전이와 메트릭으로 관측된다.** 입력은 Stream이고 출력은 저장소이며 HTTP 응답을 만드는 자리가 없다. /api/v1/ingest/bulk는 경로 이름과 달리 GEN 표면이다([06_datagen.md](./06_datagen.md)). 이 문서의 에러 코드 열은 전부 "해당 없음"이고 관측 지점은 검증 방법 열과 §관측 형태 요약이 갖는다. 상태 전이의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 배치 재시도 상태 머신이다.

**전달 보장의 전역 계약(XACK 순서 · 결정적 토큰 · 순서 무관성)은 [01_global_rules.md](./01_global_rules.md)가 갖는다.** 여기서는 그 계약을 ING가 어떤 순서 · 어떤 단위로 집행하는지와, 전역 규칙이 닿지 않는 두 자리 — 분기 실행과 대조군 — 의 요구 수준을 고정한다.

## 요구사항 — 소비와 배치

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ING-01** | 기동 시 컨슈머 그룹 grp:ingest를 만들고(MKSTREAM) XREADGROUP으로 읽는다. 엔트리의 스키마 버전 v로 디코더를 고른다. **해독할 수 없는 엔트리(모르는 v · 손상 페이로드)는 재시도하지 않고 오류 사유와 함께 DLQ로 격리한 뒤 XACK한다.** SW-01 off면 프로세스 안 큐에서 받는다 | 원본 data_flow.md §4 · §17 DLQ 검증 · REQ-GLB-21 · 04 | 재시작 시점에 구버전 엔트리가 적체돼 있으면 v를 보지 않는 디코더는 그 엔트리를 영원히 실패시킨다. 해독 불가 엔트리를 재시도하면 백오프를 전부 소진하는 동안 **같은 배치의 정상 행까지 묶여** 지연된다 | 잘못된 데이터 주입 → DLQ 엔트리 증가 · dlq_count · XPENDING 0 · 구버전 v 엔트리 적체 후 재기동 → 정상 소진 | ING-01 | F-02 | 해당 없음 — dlq_count |
| **REQ-ING-02** | MessagePack 해제 · 행 배열 전개는 worker_threads 풀에서 한다. 소비 루프의 이벤트 루프에서 대량 디코딩을 하지 않는다 | 원본 architecture.md §4 IngestModule 확장 방식 · REQ-GLB-20 | 이벤트 루프에서 디코딩하면 M 티어에서 조회 API p95가 적재 부하에 비례해 악화된다 | 적재 부하 단계별 nodejs_eventloop_lag_p95_seconds 기록 | ING-01 | F-02 | 해당 없음 — 이벤트 루프 지연 |
| **REQ-ING-03** | 배치는 행 수 · 경과 시간 · 페이로드 크기 세 트리거 중 **먼저 도달한 조건**에서 플러시한다. 값은 2계층 조정값이며 조회 계약은 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) 소유(현행 참고 50,000행 · 1,000 ms · 32 MB). S2는 시간 트리거만이다 | 원본 architecture.md §9.1 · 원본 data_flow.md §4.1 | 시간 트리거가 없으면 저부하에서 행이 무한정 대기한다. 크기 트리거가 없으면 백프레셔 소진 중 배치가 메모리를 넘는다 | 저부하에서 플러시 간격 ≤ 시간 트리거 · 배치 크기 분포(batch_size) 기록 | ING-02 | F-02 | 해당 없음 — batch_size |
| **REQ-ING-04** | 컨슈머 N개는 읽기와 디코딩만 하고 **삽입은 단일 flusher 한 곳**에서 한다(보정 7.1 A안). XACK은 flusher가 삽입 성공 후 엔트리 ID를 되돌려 수행한다. S3에서 B안(컨슈머 1 + 배치 확대) · C안(async_insert)과 파트 생성률 · E2E 지연을 비교 측정해 기록한다 | 원본 implementation_plan.md §7.1 · ADR [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) | 컨슈머마다 독립 플러시하면 M 티어에서 **행 수 트리거는 도달하지 않고** 시간 트리거가 지배해 파트 생성률이 컨슈머 수에 비례한다 — 컨슈머 3개면 초당 3회로 ClickHouse 권장 상한을 넘는다 | 컨슈머 수 1 · 3에서 초당 삽입 횟수 · 활성 파트 수 대조(A안은 컨슈머 수와 무관해야 한다) | ING-02 · ING-07 | F-02 | 해당 없음 — 활성 파트 수 |

## 요구사항 — 삽입 · 멱등 · 확인 · 격리

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ING-05** | 배치를 plc.tag_raw에 HTTP 8123으로 삽입한다(JSONCompactEachRow + 요청 압축). ts는 epoch 숫자로 보내고 **ingested_at은 보내지 않는다** — 서버 DEFAULT가 채운다. 테이블은 항상 데이터베이스로 한정해 쓴다 | 원본 architecture.md §7.1 · 원본 tech_stack.md §5.2 접속 프로토콜 · REQ-GLB-01 · 02 | ingested_at을 적재 코드가 채우면 E2E에서 Stream 대기 · 삽입 구간이 빠진다. 문자열 시각을 보내면 서버 시간대 설정 하나로 전 행이 어긋난다. 한정하지 않은 이름은 default 데이터베이스의 같은 이름 테이블에 오류 없이 들어간다 | 쿼리 로그의 INSERT 컬럼 목록 · 대상 테이블 이름 조회 · ts epoch와 Stream t0 + dt 대조 | ING-03 | F-02 | 해당 없음 — rows_inserted · insert_duration |
| **REQ-ING-06** | 배치 토큰은 첫 엔트리 ID + 끝 엔트리 ID + 행 수의 해시이며 insert_deduplication_token으로 싣는다. 단일 flusher가 여러 컨슈머의 엔트리를 합칠 때도 토큰 재료는 그 배치에 든 엔트리 ID 집합에서 결정적으로 나온다. SW-08 off면 토큰을 싣지 않는다 | REQ-GLB-06 · 원본 data_flow.md §4.3 · 원본 implementation_plan.md §7.1 | 무작위 UUID면 재시작 후 같은 배치가 다른 토큰을 받아 중복이 생긴다. fan-in 배치의 토큰 재료가 도착 순서에 의존하면 재시도 때 엔트리 순서가 바뀌어 **같은 배치가 다른 토큰**을 받는다 | SW-08 on/off에서 삽입 직후 · XACK 직전 강제 종료 주입 → tag_id + ts 중복 행 수(on 0 · off 발생) | ING-04 | F-02 | 해당 없음 — 중복 행 수 |
| **REQ-ING-07** | XACK은 삽입 성공 뒤에만 한다. 확인 뒤에만 최신값 갱신 · 팬아웃 · 알람 전달이 뒤따른다(REQ-ING-11 · 13) | REQ-GLB-05 · 원본 architecture.md §9.2 | 삽입 전에 XACK하면 삽입 실패가 **조용한 유실**이 된다. 확인 전에 최신값을 갱신하면 ClickHouse에 없는 값이 화면에 보여 최신값 = argMax 대조가 깨진다 | ClickHouse 5분 중단 → 중단 중 XPENDING 증가 · 복구 후 생성 수 = 행 수 | ING-05 | F-02 · F-10 | 해당 없음 — consumer_lag |
| **REQ-ING-08** | 삽입 실패는 지수 백오프로 **같은 토큰**을 써 재시도하고 백오프 합계는 중복 제거 윈도우 안에 머문다. 소진하면 배치와 오류 사유를 stream:plc:dlq에 넣고 **반드시 XACK**하며 dlq_count를 올리고 알린다. 백오프 · 횟수는 2계층 조정값(현행 참고 1 · 2 · 4 · 8 · 16초 · 5회 · 소유 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)) | REQ-GLB-05 · 06 · 원본 architecture.md §9.2 | 격리에서 XACK을 생략하면 PEL에 영구 잔류해 **컨슈머 랙이 영원히 0으로 돌아오지 않고** 이후 모든 랙 알림이 거짓이 된다. 재시도가 새 토큰을 쓰면 부분 성공 후 재시도가 중복을 만든다 | 재시도 소진 유도 → DLQ 증가 · XPENDING 0 · dlq_count 알림 · 재시도 전후 토큰 동일 로그 | ING-05 | F-02 · F-10 | 해당 없음 — dlq_count |
| **REQ-ING-09** | 주기 타이머로 XAUTOCLAIM을 돌려 idle 기준을 넘긴 PEL 엔트리를 인수한다. 주기 · idle 기준은 2계층 조정값(현행 참고 30초 · 60초 · 소유 상동). 재시작은 흔한 원인일 뿐 감지 신호가 아니다 | 원본 data_flow.md §4 · §4.2 · W1 판정 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | 재시작 감지로만 회수하면 같은 프로세스 안 **컨슈머 하나의 예외**는 회수되지 않아 그 컨슈머의 PEL이 영구 잔류한다 | 컨슈머 1개에 예외 주입 → 다른 컨슈머가 PEL 인수 · consumer_lag 급증 후 회복 · 회수 시간 측정 | ING-06 | F-02 · F-10 | 해당 없음 — consumer_lag |
| **REQ-ING-10** | 다중화는 프로세스가 아니라 컨슈머 이름(ingest-{pid}-{n})으로 하며 같은 프로세스 안 독립 XREADGROUP 루프다. 컨슈머 간 순서를 보장하지 않으며 **ING 안에 적재 순서에 의존하는 처리를 두지 않는다** | REQ-GLB-07 · 원본 data_flow.md §4.2 | 순서 의존 처리(예: 마지막으로 삽입된 행을 최신값으로)를 넣으면 라운드로빈 배분의 배치 간 역전이 오류 없이 틀린 값을 낸다 | 컨슈머 3개에서 rt:latest 값과 argMax(value, ts) 대조 | ING-07 | F-02 · F-03 | 해당 없음 |

## 요구사항 — 최신값 · 알람 전달 · 분기 · 대조군 · 롤업

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ING-11** | 삽입 성공과 XACK 뒤에 파이프라인 하나로 rt:latest:{device_id}(필드 tag_id · 값 "ts,value,quality")를 덮어쓰고 ch:rt:{device_id}에 변경 태그를 발행한다. 기동 시 ClickHouse argMax 1회로 rt:latest를 재구성한다. 갱신 주체는 **교체 가능한 포트**로 둔다(보정 7.2 — S6 실측으로 결정). SW-06 off면 발행 대신 게이트웨이를 직접 부르고 rt:latest 갱신은 그대로다 | 원본 architecture.md §5 · §9 · 원본 implementation_plan.md §7.2 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-02 · SW-06 판정 · REQ-GLB-11 | 확인 전에 갱신하면 ClickHouse에 없는 값이 최신값이 된다. 포트 없이 Ingest에 박으면 S6에서 Collector 갱신안을 비교할 때 코드를 다시 써 전후 비교가 무효가 된다 | Redis flushall 후 기동 → rt:latest 재구성 · rt:latest 대 argMax 일치 · 기동 로그의 선택 포트 이름 | ING-08 | F-02 · F-03 · F-07 | 해당 없음 |
| **REQ-ING-12** | **ClickHouse가 멈추면 최신값도 함께 멈춘다** — 현행 갱신 주체가 삽입 성공 뒤에 있기 때문이다. 이 정지를 결함으로 숨기지 않고 조회 쪽 STALE 판정이 드러내게 둔다 | 원본 implementation_plan.md §7.2 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-03 | 정지를 문서화하지 않으면 ClickHouse 5분 중단 중 대시보드가 **멈춘 값을 정상으로** 보여 운영자가 장애를 인지하지 못한다 | ClickHouse 중단 중 최신값 조회 quality가 STALE로 바뀌는지 · 복구 후 해제 확인 | ING-08 · ING-13 | F-03 · F-10 | 해당 없음 — STALE 비율 |
| **REQ-ING-13** | 확정된 배치의 행 배열을 **배치 단위로** 같은 프로세스 안 직접 호출로 ALM 판정에 넘긴다 — Stream 경계의 의도된 유일한 예외다(REQ-GLB-04). 행 단위로 넘기지 않는다. 판정 실패가 적재 XACK를 되돌리지 않는다 | 원본 implementation_plan.md §7.3 · 예외 근거 정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | 행 단위로 넘기면 판정 쪽이 행마다 Redis 상태 조회를 해 **수집 경로 처리량의 상한**이 된다. 판정 실패가 XACK를 되돌리면 알람 장애가 시계열 적재를 멈춘다 | 배치 1회당 판정 호출 1회 · 알람 판정에 예외 주입 시 tag_raw 적재 지속 확인 | ING-09 | F-06 | 해당 없음 |
| **REQ-ING-14** | Stream에서 온 배치를 성격별로 가른다 — ① 태그 원시값은 ClickHouse tag_raw로만 ② 알람 판정은 ALM의 세 쓰기로(REQ-ING-13) ③ 업무 쓰기는 **받지 않는다.** 계층별 쓰기 결과(원시 행 수 · 판정 수)를 계측해 분기 대조표의 원천을 만든다. 생산 카운터의 분기는 미설계이며 ING는 확정 전에 production_log를 대신 쓰지 않는다 | D-04 · REQ-GLB-12 · 정책 정본 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) · 기전 정본 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) | 계층별 계수가 없으면 S7의 "같은 스트림의 데이터가 세 저장소로 갈린다"를 수치로 보일 수 없다. ING가 업무 쓰기를 받으면 read-your-writes와 트랜잭션 보장이 깨진다 | S7 부하에서 계층별 계수와 저장소별 count 대조 · 업무 CRUD 부하 중 stream:plc:raw 유입량 불변 | ING-10 | F-02 · F-06 | 해당 없음 — 계층별 쓰기 계수 |
| **REQ-ING-15** | SW-09 on에서 **같은 배치**를 PostgreSQL plc_tag_raw_control에도 삽입한다. 기본은 off다. **대조군 삽입 실패는 XACK를 막지 않는다** — 실패 행 수를 계측하고 그 구간을 대조 실험에서 무효로 표시한다. 대조군 쪽 재시도는 대조군에 중복을 만들지 않는다(멱등 수단은 W3 · W4). 대조 실험은 구간별 두 저장소 행 수 정확 일치를 확인한 뒤에만 수행한다 | D-05 · D-12 · REQ-GLB-11 · 웨이브 인계(SW-09 삽입 실패 의미론) · 설계 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) | 대조군 실패가 XACK를 막으면 **PostgreSQL 지연이 수집 경로의 백프레셔가 되어** 목표 ②의 수치까지 오염된다. 무효 구간 표시 없이 막지도 않으면 행 수가 어긋난 구간에서 역전 지점을 잘못 기록한다 | SW-09 on에서 PostgreSQL 중단 주입 → tag_raw 적재 · XACK 지속 · 대조군 실패 계수 증가 · 무효 구간 기록 · 복구 뒤 구간별 두 저장소 count 대조 | ING-11 | F-02 | 해당 없음 — 대조군 실패 계수 |
| **REQ-ING-16** | tag_raw 삽입이 mv_tag_1m → mv_tag_1h → mv_tag_1d를 연쇄 발동하게 두고 별도 배치 잡을 두지 않는다. MV 삽입 실패를 무시하지 않도록 설정하고, 원시는 확정됐는데 롤업이 빈 구간은 재계산한다. 롤업 정합은 count 정확 일치 · avg 오차 허용 비교로 판정한다 | 원본 architecture.md §7.2 · 원본 data_flow.md §10.2 · REQ-GLB-15 | MV 실패를 무시하면 원시는 있고 롤업은 빈 구간이 **오류 없이** 남아 1시간 이상 범위 조회가 조용히 틀린다 | 구간별 count(tag_raw) = countMerge(tag_1m) · avg 대 avgMerge 오차 허용 대조 | ING-12 | F-08 | 해당 없음 — 원시 · 롤업 count 차 |

- **REQ-ING-15는 목표 ①의 계측물이 목표 ②의 경로를 멈추지 않게 하는 판정이다.** 두 학습 축의 비교 방향은 반대이고([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #4), 계측물의 실패가 분기 목적지의 흐름을 막는 순간 두 축이 한 수치에 섞인다.

## 요구사항 — 백프레셔 대응 · 관측

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ING-17** | ClickHouse가 멈추면 XACK를 보류해 엔트리를 PEL에 둔다. 백프레셔 **주의** 단계에서 컨슈머 동시성을 늘리고, 복구 뒤에는 소진 모드로 배치를 키워(현행 참고 100,000행 · 소유 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)) 적체를 빼낸다. 소진 시간(랙이 0으로 돌아오는 시간)을 계측한다. Redis 중단 중에는 XREADGROUP 실패로 대기한다 | 원본 architecture.md §9.3 · §17 · 원본 data_flow.md §12.2 · §12.3 | 소진 모드가 없으면 복구 후 평상 배치로 적체를 빼느라 소진 시간이 중단 시간보다 길어질 수 있다. 소진 시간을 재지 않으면 S6 판정(원본 목표 — 중단 시간의 30% 이내)을 할 수 없다 | ClickHouse 5분 중단 → 복구 후 무손실 · 무중복 · 소진 시간 기록 | ING-13 | F-10 | 해당 없음 — consumer_lag · stream_length |
| **REQ-ING-18** | ING는 consumer_lag · rows_inserted · insert_duration · batch_size · dlq_count · 계층별 쓰기 계수 · 대조군 실패 계수 · Stream 체류 지연(XREADGROUP 수신 시각 − 엔트리 ID 시각 — t0가 아니다 · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §구간 경계 판정) 히스토그램을 노출한다. 에러 네임스페이스를 두지 않는다 | 원본 architecture.md §14 · 원본 data_flow.md §15 · REQ-GLB-16 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 에러 코드가 아닌 것 | 지표가 빠지면 그 실패는 응답 코드로도 드러나지 않아 관측 불가능하다 — consumer_lag가 없으면 격리 XACK 누락(REQ-ING-08)을 발견할 자리가 없다 | /metrics에서 지표 8종 존재 조회 · 이름 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) 대조 | ING-01~13 | F-02 · F-08 · F-10 | 해당 없음 |

## 관측 형태 요약

ING 요구가 깨질 때 무엇이 보이는지를 모은다. 에러 코드 표를 대신한다.

| 요구 위반 · 사건 | 상태 전이 | 지표 | REQ |
|------|------|------|------|
| 삽입 실패 | 삽입시도 → 재시도대기 → 삽입시도(같은 토큰) | insert 실패 · 재시도 수 | REQ-ING-08 |
| 재시도 소진 · 해독 불가 | → 격리(DLQ 복사 후 XACK) | dlq_count | REQ-ING-01 · 08 |
| 컨슈머 예외 · 재기동 | → 회수(XAUTOCLAIM) → 누적 | consumer_lag 급증 후 회복 | REQ-ING-09 |
| ClickHouse 중단 | XACK 보류 · 백프레셔 단계 상승 · 최신값 정지 | consumer_lag · stream_length · STALE 비율 | REQ-ING-12 · 17 |
| 파트 폭증 | 없음 | 활성 파트 수 · 초당 삽입 횟수 | REQ-ING-04 |
| MV 삽입 실패 | 원시 확정 · 롤업 공백 | 원시 · 롤업 count 차 | REQ-ING-16 |
| 대조군 삽입 실패 | XACK 계속 · 구간 무효 표시 | 대조군 실패 계수 | REQ-ING-15 |

- 검산: 관측 형태 = **7**행 · 에러 코드로 드러나는 행 **0**

## 기능 → REQ 대응

[../02_features/06_ingest.md](../02_features/06_ingest.md) 기능 목록의 ING 기능 전부가 하나 이상의 REQ-ING에 대응하는지 검산한다. REQ-ING-18(관측)은 13기능 전부에 걸리므로 행마다 세지 않고 아래 검산에서 따로 센다.

| 기능 ID | 기능명 | 대응 REQ(REQ-ING-18 제외) | 수 |
|------|------|------|------|
| ING-01 | Stream 소비 | REQ-ING-01 · 02 | 2 |
| ING-02 | 배치 누적과 플러시 | REQ-ING-03 · 04 | 2 |
| ING-03 | ClickHouse 배치 삽입 | REQ-ING-05 | 1 |
| ING-04 | 멱등 토큰 | REQ-ING-06 | 1 |
| ING-05 | 재시도 · 격리 · XACK | REQ-ING-07 · 08 | 2 |
| ING-06 | PEL 회수 | REQ-ING-09 | 1 |
| ING-07 | 다중 컨슈머 | REQ-ING-04 · 10 | 2 |
| ING-08 | 최신값 갱신 · 복원 | REQ-ING-11 · 12 | 2 |
| ING-09 | 알람 판정 전달 | REQ-ING-13 | 1 |
| ING-10 | 3계층 분기 실행 | REQ-ING-14 | 1 |
| ING-11 | 대조군 동시 적재 | REQ-ING-15 | 1 |
| ING-12 | 롤업 캐스케이드 발동 | REQ-ING-16 | 1 |
| ING-13 | 백프레셔 대응 · 적체 소진 | REQ-ING-12 · 17 | 2 |

### 검산

- 기능 = ING-01~13 = **13** · 대응 없는 기능 **0**(REQ-ING-18을 빼고도 0)
- 대응 수 합(REQ-ING-18 제외 · 중복 허용) = 2 + 2 + 1 + 1 + 2 + 1 + 2 + 2 + 1 + 1 + 1 + 1 + 2 = **19** · REQ-ING-18 대응 13 · 총 19 + 13 = **32**
- REQ-ING 채번 = 01~18 = **18** · 기능에 대응하지 않는 REQ **0**

## 스위치가 바꾸는 요구

| 스위치 | 교체되는 요구 | off일 때 | 기본값 |
|------|------|------|------|
| SW-01 REDIS_STREAM_BUFFER | REQ-ING-01 소스 | 프로세스 안 큐 — PEL이 없어 REQ-ING-07~09의 at-least-once가 사라진다(실험 산출물) | on |
| SW-06 REDIS_PUBSUB_FANOUT | REQ-ING-11 발행 | 게이트웨이 직접 호출 · rt:latest 갱신은 그대로 | on |
| SW-08 INGEST_IDEMPOTENCY | REQ-ING-06 | 토큰 미전달 — 재시도가 중복 행을 만든다(실험 산출물) | on |
| SW-09 CONTROL_TABLE_ENABLED | REQ-ING-15 | 대조군에 싣지 않는다 | **off** |

- 검산: ING 요구를 교체하는 스위치 = **4** — 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)
- **SW-01 off에서 REQ-ING-06의 토큰 재료는 미확인이다** — 엔트리 ID가 없다. 이 조합으로 멱등을 재지 않는다(조합 제약 #3).

## 인계 판정

| 인계 항목 | 판정(요구 수준) | 기전 행선지 |
|------|------|------|
| SW-09 대조군 삽입 실패의 의미론 | **XACK를 막지 않는다** · 실패 계수 · 구간 무효 표시 · 대조 실험은 행 수 일치 구간에서만 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) |
| 대조군 쪽 멱등 수단 | 요구는 "대조군 재시도가 중복을 만들지 않는다" — 수단(토큰 테이블 · 유일 제약 등)은 기전 문서가 고른다 | 상동 |

- 검산: 인계 항목 = **2** · 새 코드 채번 제안 **0** — ING는 표면이 없다

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 대조군 멱등 수단 · 무효 구간 표시 형식 | REQ-ING-15가 요구한다 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) |
| 생산 카운터의 분기 기전 | W1 등재 미설계 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |
| alarm_eval 삽입의 재시도 · DLQ | "Ingest 배치와 동일한 정책"뿐 — 같은 DLQ인지 없다 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| DLQ 재처리 경로 | DLQ 이동 · 알림까지만 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md)(W4) |
| fan-in 배치의 토큰 재료 · SW-01 off 토큰 재료 | **신규 미확인** — REQ-ING-06이 결정성만 요구한다 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4) |
| 최신값 덮어쓰기의 순서 역전 | **신규 미확인** — 원본은 "항상 덮어쓰기"(원본 architecture.md §10.1)이고 컨슈머 간 순서는 보장하지 않는다(REQ-GLB-07). 두 컨슈머가 같은 설비의 배치를 역순으로 확인하면 더 오래된 값이 rt:latest에 남을 수 있다 — ts 비교 덮어쓰기 여부가 없다 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4) |
| 롤업 객체의 도메인 귀속 | **W3 확정 — ING** | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |
| 계층별 쓰기 계수 · 대조군 실패 계수의 메트릭 이름 | **W6 판정** — ing_routed_rows_total · ing_control_copy_failures_total | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| Stream 대기 · 삽입 · MV 지연 · 소진 시간 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) REQ-NFR-04 · 16 |

## 관련 문서

- [../02_features/06_ingest.md](../02_features/06_ingest.md) — ING 기능 목록 · 3계층 분기에서 ING가 맡는 것
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-05 · 06 · 07 전달 보장 · REQ-GLB-12 분기
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — F-02 배치 적재 기전 · 조정값 소유
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 분기 · 대조군 동시 적재 기전
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 배치 재시도 상태 머신
