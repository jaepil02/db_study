# ALM — 알람 기능 명세

> **대상**: 알람(ALM · NestJS alarms 모듈) 기능 목록 · 목적이 다른 세 쓰기 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID ALM-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W2 요구사항 판정 반영 — ACK 허용 조건(state ACTIVE · acked_at NULL) · alarms.ack_not_allowed/409 · 규칙 변경과 확인은 감사 대상(REQ-WRK-07)
> **원천**: 원본 data_flow.md §8 · §8.1 · §8.2 · §6.3 · §15 · §17(커밋 ff66a37) · 원본 architecture.md §4 · §5 · §6 · §7.3 · §8.1 · §8.2 · §10.1 · §11(커밋 ff66a37) · 원본 implementation_plan.md §5 S7 · §7.3(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #20 · D-04 · D-11 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2

ALM은 **분기 ②계층이 실제로 실행되는 자리**다. 한 스트림에서 나온 판정 한 건이 성격에 따라 Redis alarm:state(다음 판정에 필요한 핫 상태) · ClickHouse alarm_eval(갱신하지 않는 판정 전수) · PostgreSQL alarm_event(확인 · 해제로 갱신되는 확정 이벤트)로 동시에 흩어진다(원본 data_flow.md §8.2). 이것은 dual-write가 아니라 **목적이 다른 세 쓰기**이며, 학습 목표 ②의 핵심 계층을 한 자리에서 보여 주는 도메인이다(D-04).

**알람은 후순위(S7)이지만 생략하지 않는다.** 원본은 S7 전체를 생략 가능으로 두었으나, 알람이 빠지면 학습의 핵심인 ②계층이 한 번도 실행되지 않는다 — 그래서 알람 판정은 학습 목표 ② 합격 판정의 선행 조건이다(D-11). 평면은 제어지만 판정은 **Ingest 배치의 후처리로 데이터 경로에서 돈다** — 판정의 처리량 상한이 수집 경로의 상한이 되는 이유다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 W5 몫).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **ALM-01** | 알람 규칙 관리 | 태그별 규칙(조건 종류 · 임계값 · debounce_ms · 심각도 · enabled)을 조회 · 등록 · 수정 · 비활성화한다. 변경을 커밋하면 cache:alarmrules를 **즉시 삭제**한다 — 삭제하지 않으면 바뀐 임계값이 캐시 TTL만큼 판정에 반영되지 않는다. 쓰기 주체는 엔지니어 역할이다([12_permission_matrix.md](./12_permission_matrix.md)). 조건 종류 · 심각도의 저장 값은 미설계다 | S7 | F-05 | 해당 없음 | 07_api/07_alarms | PostgreSQL alarm_rule · Redis cache:alarmrules |
| **ALM-02** | 규칙 캐시 | 활성 규칙 목록을 cache:alarmrules에 둔다(현행 300초 + 변경 시 즉시 삭제). 미스면 PostgreSQL에서 읽어 채운다. 판정마다 PostgreSQL을 읽지 않으려는 캐시다 | S7 | F-06 | 해당 없음 | 표면 없음 — ALM-03의 내부 단계 | Redis cache:alarmrules |
| **ALM-03** | 디바운스 판정 | Ingest가 넘긴 배치의 행마다 규칙 조건(초과 · 미만 · 범위 이탈 · 변화율)을 평가하고 상태 머신(NORMAL · PENDING · ACTIVE · CLEARING · ACKED)을 alarm:state:{rule_id}에 갱신한다. **BAD 계열(2 · 4)은 판정에서 빼고 SIMULATED(9)는 판정한다** — 이 시스템의 데이터는 전부 생성 데이터라 9를 빼면 알람이 한 건도 나지 않는다. 상태 조회는 **배치 단위로 관련 규칙만 한 번에** 한다(보정 7.3) | S7 | F-06 | 해당 없음 | 표면 없음 — ING-09가 호출 | Redis alarm:state |
| **ALM-04** | 이벤트 확정 | PENDING → ACTIVE에서 alarm_event에 행을 열고(state ACTIVE) event_id를 alarm:state에 둔다. 해제가 디바운스를 지나 확정되면 행을 닫는다(state CLEARED · cleared_at). **PostgreSQL 쓰기가 실패하면 alarm:state를 PENDING으로 되돌리고 다음 판정 주기에 다시 시도한다** — 진실은 alarm_event다 | S7 | F-06 | 해당 없음 | 표면 없음 — ALM-03의 후속 | PostgreSQL alarm_event(월 파티션) |
| **ALM-05** | 판정 전수 기록 | 매 판정 결과(시각 · 규칙 · 태그 · 값 · 위반 여부 · 심각도)를 alarm_eval에 쌓는다. 재시도 · DLQ는 Ingest 배치와 같은 정책이다. **끝내 실패해도 알람 발생 · 해제 · 통지는 정상 동작**하고 임계값 튜닝용 분석 데이터만 빈다 | S7 | F-06 | 해당 없음 | 표면 없음 — ALM-03의 후속 | ClickHouse alarm_eval |
| **ALM-06** | 발생 · 해제 발행 | 이벤트가 열리거나 닫히면 ch:alarm에 발행한다. WebSocket 게이트웨이가 받아 브로드캐스트한다(RLT-08). SW-06 off면 게이트웨이를 직접 부른다 | S7 | F-06 · F-07 | SW-06 | 표면 없음 — RLT-08이 전달 | Redis ch:alarm |
| **ALM-07** | 알람 이벤트 조회 | 확정 이벤트 목록을 돌려준다(캐시 현행 30초). "열린 알람"은 state = ACTIVE 하나로, "미확인 알람"은 acked_at IS NULL 하나로 조회된다 — 생애 축과 확인 축을 가른 결과다(W1 판정) | S7 | F-06 | 해당 없음 | 07_api/07_alarms | PostgreSQL alarm_event(읽기) |
| **ALM-08** | 알람 확인 | 운영자가 열린 이벤트를 확인하면 acked_by · acked_at을 채우고 이벤트 목록 캐시를 무효화한다. 확인은 생애 값이 아니라 컬럼이 기록한다. 확인은 **행이 state = ACTIVE이고 acked_at이 NULL일 때만** 허용한다 — CLEARING 중인 열린 행은 확인되고 CLEARED · 이미 확인된 행은 alarms.ack_not_allowed/409로 거절한다(REQ-ALM-14). 확인이 alarm:state를 ACKED로 바꾸는 주체는 미확인이다 | S7 | F-06 | 해당 없음 | 07_api/07_alarms | PostgreSQL alarm_event |
| **ALM-09** | 판정 이력 분석 | 엔지니어가 alarm_eval 판정 전수를 범위로 읽어 임계값 튜닝 · 오탐을 분석한다. 극값을 보존하는 min · max 쌍 차트를 쓴다(원본 data_flow.md §6.3). **원본 API 표에 이 조회 표면이 없다** | S7 | F-06 | 해당 없음 | 07_api/07_alarms(W5 신설 판정) | ClickHouse alarm_eval(읽기) |

- 검산: ALM-01~09 = **9**. 단계 S7 9 = **9**(D-11 — 후순위 · 생략 불가)
- 표면 있음 4(ALM-01 · 07 · 08 · 09) + 표면 없음 5(ALM-02 · 03 · 04 · 05 · 06) = **9**. ALM-01 · 09의 표면은 원본 API 표(원본 architecture.md §11)에 없어 W5가 신설 여부를 정한다.

## 목적이 다른 세 쓰기

판정 한 건이 흩어지는 세 저장소다. 정책 정본은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md), 기전 정본은 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)다.

| 저장소 | 기능 | 쓰는 것 | 답하는 질문 | 성격 | 이 쓰기가 실패하면 |
|------|------|------|------|------|------|
| Redis alarm:state | ALM-03 | 상태 · 최초 위반 시각 · 연속 위반 횟수 · event_id | 다음 판정은 무엇인가 | 매 포인트 읽고 쓰는 핫 상태 — DB 왕복 불가 | 판정이 멈춘다 — 봉인 계열이라 명시적 실패 |
| ClickHouse alarm_eval | ALM-05 | 매 판정의 위반 여부 | 이 임계값은 적절했는가 | 고빈도 · 갱신 없음 · 대량 스캔 | 분석 데이터만 빈다 — 알람 기능은 정상 |
| PostgreSQL alarm_event | ALM-04 · 08 | 열림 · 닫힘 · 확인 | 누가 언제 확인했는가 | 상태 갱신이 필요 — ClickHouse는 UPDATE에 부적합 | 알람이 확정되지 않은 것으로 본다 — alarm:state를 되돌려 재시도 |

- 검산: 세 쓰기 = Redis 1 + ClickHouse 1 + PostgreSQL 1 = **3**
- **세 저장소의 건수가 같기를 기대하지 않는다.** alarm_eval은 판정 전수 · alarm_event는 확정 이벤트 · alarm:state는 규칙당 하나다 — 같으면 오히려 설계가 틀린 것이다(분기 대조표의 판정 기준 [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)).
- **"CDC로 두 DB를 맞추자"는 제안이 나오면 이 표가 반론이다.** CDC는 같은 사실의 사본을 맞추는 도구이고, 세 쓰기는 애초에 같은 사실이 아니다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| ALM-01 | 임계값을 자동 조정하지 않는다 — 분석은 ALM-09, 결정은 사람이다 | 엔지니어 역할 |
| ALM-03 | Stream을 소비하지 않는다 — Ingest가 배치를 넘긴다 | ING-09 |
| ALM-03 | 태그 원시값을 저장하지 않는다 | ING-03 |
| ALM-04 | 알람 상태 머신의 모든 상태를 PostgreSQL에 남기지 않는다 — PENDING은 흔적을 남기지 않는다 | alarm:state · alarm_eval |
| ALM-06 | WebSocket 소켓을 관리하지 않는다 | RLT-05 · 08 |
| ALM-08 | 해제를 대신하지 않는다 — 확인은 해제가 아니다 | ALM-04(해소 판정) |
| ALM-01~09 | 외부 알림 채널(메일 · 메신저)로 보내지 않는다 — 원본에 없다 | Out 범위 [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| ING | ING → ALM | 직접 호출(유일한 예외) | 삽입이 확정된 배치 단위 호출. 재처리 단위가 배치와 같아 별도 큐가 없다 |
| RLT | ALM → RLT | Pub/Sub | ch:alarm |
| MST | MST → ALM | 저장소 경유 | 규칙이 tag_id를 참조한다 |
| AUT | AUT → ALM | 인가 | 규칙 쓰기는 엔지니어 · 확인은 운영자([12_permission_matrix.md](./12_permission_matrix.md)) |
| WRK | 해당 없음 | 해당 없음 | 규칙 변경 · 확인은 audit_log 감사 대상이다(같은 트랜잭션 · 기준 [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) REQ-WRK-07) |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 없는 이벤트 확인 | 거절 | common.not_found/404 | ALM-08 |
| CLEARED · 이미 확인된 이벤트 확인 | **alarms.ack_not_allowed/409** — CLEARING 중인 열린 행은 허용 | [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) REQ-ALM-14 | ALM-08 |
| 규칙 형식 위반 | 거절 | common.validation_failed/400 | ALM-01 |
| 역할 밖 쓰기(S7 이후) | 거절 | auth.forbidden/403 | ALM-01 · 08 |
| PostgreSQL 접속 불가 | 규칙 쓰기 · 이벤트 조회 · 확인 실패 · **판정은 PENDING에 머물며 재시도** | common.postgres_unavailable/503 · PostgreSQL 이벤트 기록 지연 | ALM-01 · 04 · 07 · 08 |
| alarm_eval 삽입 실패 | 코드 없음 — 재시도 후 DLQ · 알람 기능 정상 | dlq_count | ALM-05 |
| 배치당 판정이 느림 | 수집 경로 전체의 상한이 된다 | 초당 판정 건수 · 판정 지연 | ALM-03 |

- **B형 — 판정 한 건에 Redis 왕복을 행마다 하지 않는다.** 원본 시퀀스대로 행당 조회를 하면 배치당 수만 번 왕복이 생겨 수집 처리량의 상한이 알람 판정이 된다(원본 implementation_plan.md §7.3). 배치 단위 조회가 느려 보이지 않는 이유는 상한을 없앴기 때문이다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.3 알람 상태 조회가 수집 상한을 만든다 | ALM-03은 배치 단위로 관련 규칙만 한 번에 조회한다(또는 판정 전체를 스크립트 1회로). 상태 보관은 Redis Hash를 유지한다 — 프로세스 메모리로 옮기면 역할 분리 때 두 워커가 같은 규칙을 평가하며 경합한다. 판정 구간 지연 예산은 신설 대상이다 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) |
| 직접 호출 예외의 근거 — 보정 7.3 | ING-09 · ALM-03 경계가 유일한 의도된 예외다 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 상태 머신 5상태와 alarm_event.state 2값의 대응 — docs_plan 보정 #20 | ALM-04 · 07 · 08이 W1 판정(생애 축 · 확인 축 분리 · CLEARING 디바운스)을 따른다 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 보정 7.5 TTL 강제 수단 | alarm:state는 봉인 계열(TTL 금지) · cache:alarmrules는 캐시 계열(TTL 필수) — 같은 모듈이 두 래퍼를 모두 쓴다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.1 · 7.2 · 7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| condition_type · severity 값 | 조건 종류 넷 · smallint 심각도 | 미설계(W1 등재) | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 확인이 alarm:state를 ACKED로 바꾸는 주체 | 확인은 API가 PostgreSQL에 쓴다 | 미확인(W1 등재) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 담당자 배정 | "확인 · 해제 · 담당자 배정 등 상태 갱신이 필요"(원본 data_flow.md §8.2) | **신규 불일치** — alarm_event에 담당자 컬럼이 없다(원본 architecture.md §6). 기능을 두지 않았다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 규칙 관리 · 판정 이력 분석 표면 | API 표에 알람은 이벤트 목록 · 확인 둘뿐이다 | **신규 — 표면 미설계** | [../07_api/07_alarms.md](../07_api/07_alarms.md)(W5) |
| 판정 구간 지연 예산 | 원본 지연 예산표에 알람 판정 구간이 없다(보정 7.3) | 미확인 — 확정 전 임의 값 고정 금지 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md)(W3) |
| 규칙 변경의 감사 기록 | 업무 데이터 변경은 감사 대상이다(원본 architecture.md §18) | **W2 판정 완료** — 규칙 변경 · 확인은 대상 · 판정 경로의 시스템 쓰기는 대상 아님 | [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) |

## 관련 문서

- [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) — REQ-ALM 동작 계약
- [../07_api/07_alarms.md](../07_api/07_alarms.md) — 이벤트 · 확인 · 규칙 표면
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — F-06 판정 기전
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — ②계층 분기 정책
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 알람 상태 머신 · alarm_event.state 대응
- [06_ingest.md](./06_ingest.md) — 판정 전달(ING-09)
- [08_realtime.md](./08_realtime.md) — 알람 푸시(RLT-08)
