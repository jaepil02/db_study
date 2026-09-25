# ING — 적재·분기 기능 명세

> **대상**: 적재·분기(ING · NestJS ingest 모듈) 기능 목록 · 3계층 분기 실행 · 대조군 동시 적재 · 기능별 경계 · 실패 시 보이는 것 — 기능 ID ING-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S3 구현 반영 — ING-07 컨슈머 이름 ingest-{pid}-{n} → **ingest-{n}**(S2 판정 고정 이름 · 재기동 뒤 자기 PEL을 이어 읽는다)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 생산 카운터 · 대조군 COPY 기전 미설계 → W4 판정(06_pipeline/04) 반영
> **개정일**: 2026-09-24 — W7 검수 반영 — 장애 표 메트릭 stream_length → **redis_stream_length**(정본 10_observability/01) · 미확인 5행 닫힘(대조군 실패 의미론 · 대조군 멱등 · 생산 카운터 · alarm_eval 재시도 · DLQ 재처리) — 기능 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 롤업 객체(tag_1m · tag_1h · tag_1d · MV 3) 도메인 귀속 잠정 ING → **ING 확정**(정본 05_data_stores/04 §도메인 귀속 판정)
> **개정일**: 2026-09-24 — W3 판정 반영 — ING-13 컨슈머 증설의 효과 범위를 ADR-09(단일 flusher)에 맞춰 한정
> **원천**: 원본 architecture.md §5 · §7.1 · §7.2 · §9 · §9.1 · §9.2 · §9.3 · §17(커밋 ff66a37) · 원본 data_flow.md §4 · §4.1 · §4.2 · §4.3 · §8 · §8.2 · §10 · §12.3 · §12.4 · §14.1(커밋 ff66a37) · 원본 tech_stack.md §5.3(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S3 · S6 · §7.1 · §7.2 · §7.3(커밋 ff66a37) · 저장소 루트 docs_plan.md(학습 목표 1 · 2) · D-04 · D-05 · D-12 · [13_switch_matrix.md](./13_switch_matrix.md)

ING는 **Stream에서 배치를 꺼내 저장소에 확정하고, 그 자리에서 데이터를 성격별 목적지로 가르는 도메인**이다. 배치 누적 · 멱등 삽입 · 재시도 · DLQ · PEL 회수로 at-least-once를 지키고(원본 architecture.md §9), 삽입이 확정된 배치를 최신값 · 실시간 팬아웃 · 알람 판정으로 넘긴다. 학습 목표 두 축의 **실행 자리**가 모두 여기 있다 — 목표 ②의 3계층 분기 실행(ING-10)과 목표 ①의 대조군 동시 적재(ING-11)다.

**ING는 외부 표면이 없다.** 입력은 Stream이고 출력은 저장소이며 HTTP 응답을 만드는 자리가 없다. **/api/v1/ingest/bulk는 경로 이름과 달리 ING 표면이 아니다** — 부하 주입(GEN 모드 C)의 표면이다(docs_plan 보정 #11 · [05_datagen.md](./05_datagen.md)). 그래서 [../07_api](../07_api/README.md)에 문서가 없고 에러 네임스페이스도 없으며, 실패는 배치 재시도 상태 전이 · dlq_count · 컨슈머 랙으로 드러난다.

**경계 — 분기의 정책과 기전은 이 문서가 아니다.** 무엇이 어디로 왜 가는지의 정책 정본은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)(W3), 어느 모듈이 어떻게 가르는지의 기전 정본은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4)다. 이 문서는 ING가 분기에서 **어떤 기능을 맡는지와 맡지 않는지**만 고정한다.

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))다.

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **ING-01** | Stream 소비 | 기동 시 컨슈머 그룹 grp:ingest를 만들고(MKSTREAM) XREADGROUP으로 엔트리를 읽는다. 엔트리의 스키마 버전 v를 보고 디코더를 고른다 — 재시작 시점에 구버전 엔트리가 적체돼 있고 역할 분리 뒤에는 두 버전이 공존한다. MessagePack 해제는 piscina 워커에서 한다. SW-01 off면 프로세스 안 큐에서 받는다 | S2 | F-02 | SW-01 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw · 컨슈머 그룹 |
| **ING-02** | 배치 누적과 플러시 | 행 수 · 경과 시간 · 페이로드 크기 세 트리거 중 먼저 도달한 조건에서 플러시한다(현행 참고 — 50,000행 · 1,000 ms · 32 MB · 소유 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)). S2는 시간 트리거만이다. **M 티어에서 행 수 트리거는 도달하지 않고 시간이 지배한다** — 보정 7.1의 읽기 · 삽입 분리(단일 flusher)를 적용한다 | S2 · S3 | F-02 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 — 메모리 버퍼 |
| **ING-03** | ClickHouse 배치 삽입 | 배치를 plc.tag_raw에 HTTP(8123)로 삽입한다(JSONCompactEachRow + 요청 압축). ingested_at은 서버가 채운다 — E2E 지연 = ingested_at − ts의 한쪽 끝이다 | S2 | F-02 | 해당 없음 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| **ING-04** | 멱등 토큰 | 배치 내용에 **결정적인** 토큰(첫 엔트리 ID + 끝 엔트리 ID + 행 수의 해시)을 insert_deduplication_token으로 싣는다. 재시도는 같은 토큰을 쓴다. 무작위 UUID면 재시작 후 같은 배치가 다른 토큰을 받아 중복이 생긴다. 백오프 합계는 서버 중복 제거 윈도우 안에 머문다 | S3 | F-02 | SW-08 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| **ING-05** | 재시도 · 격리 · XACK | XACK은 **삽입 성공 뒤에만** 한다. 실패는 지수 백오프로 재시도하고(현행 참고 — 1 · 2 · 4 · 8 · 16초 · 5회), 소진하면 배치와 오류 사유를 stream:plc:dlq에 넣고 **반드시 XACK한다** — 하지 않으면 PEL에 영구 잔류해 컨슈머 랙이 영원히 0으로 돌아오지 않는다. dlq_count를 올리고 알린다 | S3 | F-02 · F-10 | 해당 없음 | 표면 없음 — 내부 모듈 | Redis stream:plc:dlq |
| **ING-06** | PEL 회수 | 주기 타이머(현행 30초)로 XAUTOCLAIM을 돌려 idle 기준(현행 60초)을 넘긴 엔트리를 인수한다. 재시작은 흔한 원인일 뿐 감지 신호가 아니다 — 같은 프로세스 안 컨슈머 하나가 죽어도 회수가 필요하다(W1 판정) | S3 | F-02 · F-10 | 해당 없음 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 PEL |
| **ING-07** | 다중 컨슈머 | 같은 프로세스 안에서 독립 XREADGROUP 루프 N개(ingest-{n} · n = 1..N 고정 — S2 판정)를 돌린다. 다중화는 프로세스가 아니라 **컨슈머 이름**으로 한다. 컨슈머 간 순서는 보장하지 않으며 시계열이 ts를 자체 보유해 무해하다 — 순서 의존 집계를 도입하는 순간 이 전제가 깨진다 | S3 | F-02 | 해당 없음 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 |
| **ING-08** | 최신값 갱신 · 복원 | 삽입 성공과 XACK 뒤에 파이프라인 하나로 rt:latest:{device_id}(필드 tag_id · 값 "ts,value,quality")를 덮어쓰고 ch:rt:{device_id}에 변경 태그를 발행한다. 기동 시 ClickHouse argMax 쿼리 1회로 rt:latest를 재구성한다 — Redis 사본은 휘발이고 **진실은 ClickHouse**다 | S2 | F-02 · F-03 · F-07 | SW-06 | 표면 없음 — 내부 모듈 | Redis rt:latest · ch:rt |
| **ING-09** | 알람 판정 전달 | 삽입이 확정된 배치의 행 배열을 같은 프로세스 안 **직접 호출**로 ALM 판정(ALM-03)에 넘긴다. **Stream 경계 원칙의 유일한 의도된 예외**다 — 알람은 배치의 후처리이고 재처리 단위가 배치와 같아 별도 큐가 필요 없다(보정 7.3). 예외 근거의 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | S7 | F-06 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 — 호출 |
| **ING-10** | 3계층 분기 실행 | Stream에서 온 배치를 성격별 목적지로 보낸다 — ① 태그 원시값은 ClickHouse tag_raw로만(ING-03) ② 알람 판정은 ALM의 세 쓰기로(ING-09) · 생산 카운터는 기전 미설계 ③ 업무 쓰기는 **Stream에 오지 않는다** — ING는 ③을 받지 않는 것으로 분기에 참여한다. 계층별 쓰기 결과(행 수 · 판정 수)를 계측해 분기 대조표의 원천을 만든다. **기전 상세는 W4 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) 몫이다** | S3(①) · S7(②) | F-02 · F-06 | 해당 없음 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw · 호출(ALM) |
| **ING-11** | 대조군 동시 적재 | SW-09 on에서 **같은 배치**를 PostgreSQL plc_tag_raw_control에도 삽입한다. 따로 적재하면 행 집합이 달라 두 저장소의 쿼리 결과 자체를 대조할 수 없다. **기본은 off**다 — on이 기본이면 모든 삽입 처리량 수치에 대조군 비용이 섞인다. 설계 정본은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md), 동시 적재 기전은 W4 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) 몫이다 | S3 | F-02 | SW-09 | 표면 없음 — 내부 모듈 | PostgreSQL plc_tag_raw_control |
| **ING-12** | 롤업 캐스케이드 발동 | tag_raw 삽입이 mv_tag_1m → mv_tag_1h → mv_tag_1d를 연쇄 발동해 별도 배치 잡 없이 롤업을 완성한다. MV는 삽입 블록만 보고 원자성이 없어 MV 삽입 실패를 무시하지 않도록 설정하고 불일치 구간을 재계산한다. 롤업 객체는 ING 소유다(W3 확정 — [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md)) | S3 | F-08 | 해당 없음 | 표면 없음 — 내부 모듈 | ClickHouse tag_1m · tag_1h · tag_1d · MV 3 |
| **ING-13** | 백프레셔 대응 · 적체 소진 | ClickHouse가 멈추면 XACK을 보류해 엔트리를 PEL에 둔다. **주의** 단계에서 컨슈머 동시성을 자동으로 늘리고(ADR-09 단일 flusher 뒤에는 읽기 · 디코딩 병목에만 효과가 있고 삽입 병목에는 효과가 없다), 복구 뒤에는 소진 모드로 배치를 키워(현행 참고 — 100,000행) 적체를 빼낸다. 소진 시간이 복구 목표의 판정 지표다 | S6 | F-10 | 해당 없음 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |

- 검산: ING-01~13 = **13**. 단계별(첫 도입 기준) S2 4(ING-01 · 02 · 03 · 08) + S3 7(ING-04 · 05 · 06 · 07 · 10 · 11 · 12) + S6 1(ING-13) + S7 1(ING-09) = **13**
- 표면 없음 13 = ING-01~13 전부. ING는 [12_permission_matrix.md](./12_permission_matrix.md)에서 "내부"로 센다.
- 스위치가 교체하는 기능: ING-01(SW-01) · ING-04(SW-08) · ING-08(SW-06) · ING-11(SW-09) = **4**. 정본은 [13_switch_matrix.md](./13_switch_matrix.md)다.

## 3계층 분기에서 ING가 맡는 것

분기는 "전부 큐를 태운다"가 아니라 "성격을 보고 경로를 고른다"다(전역 불변식). ING는 Stream 뒤에 있으므로 ①과 ②만 실행하고, ③에는 **받지 않는 것으로** 참여한다.

| 계층 | 데이터 | ING가 하는 일 | ING가 하지 않는 일 | 목적지 |
|------|------|------|------|------|
| ① | 태그 원시값 | 배치를 tag_raw에 확정하고 롤업을 발동한다(ING-03 · 12) · 최신값 사본을 갱신한다(ING-08) | 원시값을 PostgreSQL에 싣지 않는다 — 대조군은 SW-09 on의 **실험 계측물**이지 분기 목적지가 아니다(ING-11) | ClickHouse 전용 · Redis는 휘발 사본 |
| ② | 알람 판정 | 확정된 배치를 판정에 넘긴다(ING-09) | 세 저장소 쓰기를 직접 하지 않는다 — 핫 상태 · 판정 전수 · 확정 이벤트는 ALM이 쓴다 | Redis alarm:state · ClickHouse alarm_eval · PostgreSQL alarm_event |
| ② | 생산 카운터 | **판정 완료(W4)** — 카운터 표본은 ① 경로 그대로 · 파생 사실 판정기는 목적지 테이블이 없어 두지 않는다 | WRK의 production_log(업무 CRUD)를 대신 쓰지 않는다 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §생산 카운터 기전 판정 |
| ③ | 회원 · 작업지시 · 감사 | 없음 — Stream에 들어오지 않는다 | 업무 쓰기를 소비하지 않는다. 받으면 read-your-writes와 트랜잭션 보장이 깨진다 | PostgreSQL 전용(API 직접) |

- **"ING가 ③을 처리하지 않는 것"도 분기의 결과다.** 업무 CRUD 부하 중 stream:plc:raw 유입량이 CRUD와 무관하게 움직이는 것이 S7 합격 판정의 한 줄이다([../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)).
- **② 세 쓰기는 dual-write가 아니다.** 같은 사실의 사본이 아니라 각자 다른 질문(다음 판정 · 임계값 적절성 · 확인 이력)에 답한다 — 부분 실패의 진실은 alarm_event다([09_alarms.md](./09_alarms.md)).

## 스위치가 교체하는 것

| 스위치 | 교체 대상 기능 | off일 때 이 도메인에서 일어나는 일 |
|------|------|------|
| SW-01 REDIS_STREAM_BUFFER | ING-01 소스 | Stream 대신 프로세스 안 큐에서 받는다. PEL이 없으므로 ING-05 · 06의 at-least-once가 사라진다 — ClickHouse 중단 시 유실이 난다(실험 산출물) |
| SW-06 REDIS_PUBSUB_FANOUT | ING-08 발행 | ch:rt 발행 대신 WebSocket 게이트웨이를 직접 부른다. rt:latest 갱신은 그대로다 |
| SW-08 INGEST_IDEMPOTENCY | ING-04 | 토큰을 싣지 않는다 — 재시도가 중복 행을 만든다(실험 산출물) |
| SW-09 CONTROL_TABLE_ENABLED | ING-11 | 기본 off — 대조군에 싣지 않는다. on이 실험 조건이다 |

- SW-02 REDIS_LATEST_CACHE는 ING-08을 바꾸지 않는다 — 읽기 쪽만 교체한다(판정 정본 [13_switch_matrix.md](./13_switch_matrix.md)).

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| ING-01~13 | 비즈니스 로직을 하지 않는다 · 외부 요청을 받지 않는다 | 제어 평면 도메인 |
| ING-02 · 03 | 트리거 · 백오프 · 윈도우 값을 소유하지 않는다 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| ING-05 | DLQ 엔트리를 자동 재처리하지 않는다 | §미확인 · 미설계 등재 |
| ING-08 | 최신값 조회에 응답하지 않는다 | RLT-01 · 02 |
| ING-09 | 알람 조건을 평가하지 않는다 | ALM-03 |
| ING-10 | 분기 정책을 정하지 않는다 · 분기 기전을 서술하지 않는다 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)(W3) · [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |
| ING-11 | 대조 쿼리를 실행하지 않는다 · 모드 D 구간의 대조군을 채우지 않는다 | 실험 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) · GEN-10 |
| ING-12 | MV · 롤업 DDL과 백필 절차를 소유하지 않는다 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) · GEN-08 |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| COL | COL → ING | Stream 경계 | stream:plc:raw |
| GEN | GEN → ING | Stream 경계 | 모드 B · C. 모드 D는 ING를 우회한다 |
| ALM | ING → ALM | 직접 호출(유일한 예외) | ING-09 |
| RLT | ING → RLT | Pub/Sub · 저장소 경유 | ch:rt · rt:latest |
| TSQ | ING → TSQ | 저장소 경유 | tag_raw · 롤업 |
| OBS | ING → OBS | 계측 | consumer_lag(가장 중요한 단일 지표) · rows_inserted · insert_duration · batch_size · dlq_count |

## 실패 시 보이는 것

ING는 에러 코드를 내지 않는다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) "에러 코드가 아닌 것"). 아래는 전부 상태 전이 · 메트릭이다. 배치 재시도 상태 머신의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)다.

| 상황 | 드러나는 형태 | 지표 | 기능 |
|------|------|------|------|
| ClickHouse 삽입 실패 | 재시도대기 → 삽입시도(같은 토큰) | insert 실패 수 · 재시도 수 | ING-05 |
| 재시도 소진 | 격리 — DLQ 복사 후 XACK · 알림 | dlq_count | ING-05 |
| ClickHouse 중단 | XACK 보류 → 스트림 적체 → 백프레셔 단계 상승 · **최신값도 함께 정지** | consumer_lag · redis_stream_length | ING-08 · 13 |
| 컨슈머 하나의 예외 | 모듈 재시도 루프 재기동 · 다른 컨슈머가 PEL 회수 | consumer_lag 급증 후 회복 | ING-06 |
| api 재기동 | 미소비 엔트리와 PEL은 AOF로 보존 · 재기동 후 회수 | consumer_lag | ING-06 |
| MV 삽입 실패 | 원시는 확정 · 롤업만 빈다 — 해당 구간 재계산 | 원시 count 대 롤업 countMerge | ING-12 |
| 대조군 삽입 실패(SW-09 on) | **미확인** — §미확인 · 미설계 등재 | 두 저장소 행 수 대조 | ING-11 |

- **B형 — 격리에서 XACK를 하는 것은 데이터를 버리는 것이 아니다.** 배치는 DLQ에 사본으로 남는다. XACK를 생략하면 PEL에 영구히 남아 이후 모든 랙 알림이 거짓이 된다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.1 배치 트리거 산술 모순 · 다중 컨슈머와 배치 정책의 상호 무효화 | ING-02에 읽기 · 삽입 분리(A안)를 적용하고 S3에서 B · C안과 파트 생성률 · E2E 지연을 비교 측정한다 | ADR [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 보정 7.2 ClickHouse 중단 시 최신값 정지 | ING-08의 현행 소유를 유지하되 **교체 가능한 포트**로 두고 S6에서 Collector 갱신안과 대시보드 생존을 비교해 결정한다. 결정 전에는 정지를 문서에 명시하고 UI에 STALE로 드러낸다 | ADR · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 보정 7.3 알람 상태 조회가 수집 상한을 만든다 | ING-09가 행이 아니라 **배치**를 넘긴다 — 판정 쪽이 배치 단위 상태 조회를 할 수 있게 한다 | [09_alarms.md](./09_alarms.md) · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| 보정 7.5 TTL 강제 수단 | stream · rt 계열은 봉인 계열 래퍼로만 쓴다 — 실패를 삼키지 않는다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 대조군 삽입 실패의 의미론 | 닫힘 — 대조군 COPY는 ClickHouse 삽입 성공 뒤 1회 · XACK는 대조군 성패와 무관 · 실패 배치는 대조군 0행 + 실패 기록으로 무효 구간 표시 — [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) |
| 대조군 쪽 멱등 수단 | 닫힘 — 재시도 루프 밖 1회라 재시도 중복은 없고 크래시 재전달 중복은 막지 않고 구간 count로 검출(한계 등재 #5) — [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) | 상동 |
| 생산 카운터의 분기 기전 | 닫힘 — 카운터 표본은 ① 경로 그대로 · 파생 판정기는 목적지 없이 두지 않는다(도입 조건 4) — [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |
| alarm_eval 삽입의 재시도 · DLQ | 닫힘 — 재시도는 원시 배치와 같은 정책 · 소진 시 DLQ로 격리하지 않고 무효 구간 기록 — [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| DLQ 재처리 경로 | 닫힘 — 사람이 거는 운영 절차 · 원 토큰으로 tag_raw에 직접 삽입 · stream:plc:raw 재발행 없음 — [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md)(W4) |
| 롤업 객체의 도메인 귀속 | **W3 확정 — ING** | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) §도메인 귀속 판정 |

## 관련 문서

- [../03_requirements/07_ingest.md](../03_requirements/07_ingest.md) — REQ-ING 동작 계약
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — F-02 배치 적재 기전
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 3계층 분기 기전 정본
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 분기 정책 정본
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계 정본
- [09_alarms.md](./09_alarms.md) — 판정 전달의 받는 쪽
- [13_switch_matrix.md](./13_switch_matrix.md) — SW-01 · SW-06 · SW-08 · SW-09 정본
