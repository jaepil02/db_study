# ALM — 알람 표면 (07_alarms)

> **대상**: ALM 도메인 REST 표면 — 알람 이벤트 목록 · 확인(ACK) · 알람 규칙 조회와 쓰기 · 판정 이력(alarm_eval) 분석 · **알람 목록 범위 기본값 판정** · 원본에 없는 표면 판정(규칙 CRUD · alarm_eval 분석)
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 확인 실시간 전파 행의 리드 판정 대기 표기 → W6 판정(전파 신호 없음) · 분석 무효 구간 해설을 W6 판정(계수 + 구조화 로그 · 응답 표지 없음)으로 갱신
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 무효 구간 자리 · ACK 부재 계측 W6 판정(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — #6 ClickHouse 불가 채번 대기 → **alarms.eval_store_unavailable/503** · 미확인 2행 행선지를 06_pipeline/08 등재로 갱신 — 표면 수 불변
> **원천**: 원본 architecture.md §6 · §7.3 · §11 · §18(커밋 ff66a37) · 원본 data_flow.md §6.3 · §8 · §8.1 · §8.2(커밋 ff66a37) · REQ-ALM-01~04 · 13~19 · REQ-WRK-07 · ADR-11 · ADR-12 · [../02_features/09_alarms.md](../02_features/09_alarms.md) ALM-01 · 07 · 08 · 09 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2 · alarm_event.state 대응 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 인덱스 · docs_plan.md 웨이브 인계 W5 07_api 행(알람 목록 범위 기본값 · 원본에 없는 표면)

알람의 세 쓰기 중 **표면으로 드러나는 것은 PostgreSQL alarm_event와 ClickHouse alarm_eval 둘이다.** 핫 상태 alarm:state는 판정기 하나만 쓰고 읽으며 어떤 표면도 노출하지 않는다 — 확인(ACK)조차 Redis를 쓰지 않는다(W4 판정 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §ACK와 alarm:state). 이벤트 목록은 "누가 언제 확인했는가"에, 판정 이력 분석은 "이 임계값은 적절했는가"에 답한다.

원본 API 표에는 이벤트 목록과 확인 둘뿐이다(원본 architecture.md §11). 규칙 관리(ALM-01)와 판정 이력 분석(ALM-09)은 기능과 권한 매트릭스가 요구하므로 **신설**한다. 판정 · 확정 · 발행(ALM-02~06)은 표면이 없는 내부 단계다.

**생애 축과 확인 축은 다른 필드다**(W1 판정). "열린 알람"은 state = ACTIVE, "미확인 알람"은 acked_at IS NULL — 목록 표면의 필터도 이 두 축을 따로 받는다. 상태 머신의 ACKED는 저장 값이 아니므로 필터 값이 아니다.

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | #1~#5 BFF 경유(no-store) · #6 직결 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 인가 | 이벤트 · 규칙 조회 전원 · 확인 OPERATOR만 · 규칙 쓰기 ENGINEER만 · 판정 이력 분석 ENGINEER만 | REQ-ALM-17 · 18 · 권한 매트릭스 ALM |
| 감사 | 규칙 등록 · 수정 · 확인은 같은 트랜잭션에서 audit_log · 판정 경로의 시스템 쓰기는 감사하지 않는다 | REQ-ALM-03 · 15 · REQ-WRK-07 |
| 삭제 | 규칙 · 이벤트 모두 DELETE 표면이 없다 — 규칙을 끄는 수단은 enabled false | REQ-ALM-01 |
| 실시간 | 열림 · 닫힘은 ch:alarm → WebSocket 푸시가 맡고 목록은 캐시 TTL만큼 늦다 | REQ-ALM-13 · [11_websocket.md](./11_websocket.md) |
| PostgreSQL 불가 | #1~#5 common.postgres_unavailable/503 · 판정은 PENDING에 머물며 재시도 | REQ-ALM-19 |
| 단계 | 전 표면 S7 — 생략 선택지 없음 | REQ-ALM-20 · D-11 |

- 검산: 항목 = **7**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/alarms/events | ALM-07 | 전원 | cache:alarmevents · BFF no-store | common.validation_failed/400 · common.postgres_unavailable/503 | ALM-CONSOLE | 원본 |
| 2 | POST | /api/v1/alarms/events/{id}/ack | ALM-08 | OPERATOR | 없음 | common.not_found/404 · alarms.ack_not_allowed/409 · common.postgres_unavailable/503 | ALM-CONSOLE | 원본 |
| 3 | GET | /api/v1/alarms/rules | ALM-01 | 전원 | 없음 · BFF no-store | common.validation_failed/400 · common.postgres_unavailable/503 | ALM-RULES | 신설 |
| 4 | POST | /api/v1/alarms/rules | ALM-01 | ENGINEER | 없음 | common.validation_failed/400 · common.postgres_unavailable/503 | ALM-RULES | 신설 |
| 5 | PATCH | /api/v1/alarms/rules/{id} | ALM-01 | ENGINEER | 없음 | common.validation_failed/400 · common.not_found/404 · common.postgres_unavailable/503 | ALM-RULES | 신설 |
| 6 | GET | /api/v1/alarms/evaluations | ALM-09 | ENGINEER | 없음 — 캐시하지 않는다 | common.validation_failed/400 · alarms.eval_store_unavailable/503 | ALM-RULES | 신설 |

- 검산: 표면 = REST **6** · 원본 2(#1 · #2) + 신설 4(#3~#6) = **6** · 조회 3(#1 · 3 · 6) + 쓰기 3 = **6**
- 표면 있는 기능 4(ALM-01 · 07 · 08 · 09) — ALM-01이 세 표면(#3~#5)에 앉는다.
- **#6의 ClickHouse 불가는 alarms.eval_store_unavailable/503이다(W5 채번).** timeseries.clickhouse_unavailable은 TSQ 표면 소유라 빌려 쓰지 않는다 — 네임스페이스는 표면 소유 도메인을 따른다.
- **규칙 목록(#3)이 cache:alarmrules를 읽지 않는 이유** — 그 키는 판정기용 **활성 규칙만** 담는다. 관리 화면은 비활성 규칙도 보여야 하므로 PostgreSQL을 직접 읽는다. 같은 키를 두 용도로 쓰면 비활성 규칙이 판정에 섞이거나 화면에서 사라진다.

## #1 GET /api/v1/alarms/events

### 요청

| 파라미터 | 규칙 | 기본값 |
|------|------|------|
| state | ACTIVE · CLEARED — 생애 축 | 없음 — 둘 다 |
| acked | true · false — 확인 축(acked_at IS NOT NULL · IS NULL) | 없음 — 둘 다 |
| from · to | 오프셋 포함 ISO 8601 · occurred_at 범위 · from < to | §알람 목록 범위 기본값 판정 |
| ruleId · tagId · severity | 정수 필터 · severity 1~3 | 없음 |
| limit · cursor | 키셋 페이지 — [01_conventions.md](./01_conventions.md) §페이지네이션 | limit 50 |

- 검산: 파라미터 행 = **5**
- 정렬은 occurred_at 내림차순 · event_id 내림차순 고정이다. 인덱스 #2 · #4 · #5(규칙별 · 열린 · 미확인 부분 인덱스)가 이 정렬을 받는다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)).

### 알람 목록 범위 기본값 판정

인계 "알람 목록 범위 기본값"을 닫는다. REQ-ALM-13은 쿼리가 발생 시각 범위를 조건으로 실행되기를 요구하고 기본값은 이 문서에 넘겼다. **판정 — 필터에 따라 기본 범위가 둘로 갈린다.**

| 필터 | from 생략 시 | to 생략 시 | 이유 |
|------|------|------|------|
| state=ACTIVE 또는 acked=false 포함 | **보존 창 시작** — 가장 오래된 유지 파티션의 시작(보존 현행 참고 2년 · 정본 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)) | 현재 | 열린 · 미확인 알람은 나이와 무관하게 다 보여야 한다 |
| 그 밖(이력) | to − **7일**(2계층 · 현행 참고 · 소유 이 문서) | 현재 | 월 파티션 가지치기 — 최근 이력이 화면의 기본 질문이다 |

- 검산: 필터 행 = **2**
- **B형 — 열린 알람 목록에 기본 7일을 걸면 오래 열린 알람이 사라진다.** 결론 — 열린 · 미확인 필터는 기본 범위를 보존 창 전체로 넓힌다. 반대 시나리오 — 열흘 전 비활성화된 태그의 열린 알람(시스템이 닫지 않는다 — [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §비활성 태그 규칙)이 기본 목록에서 빠져 누구도 확인하지 않는다. 파생 지침 — 범위가 넓어도 비용이 작은 이유는 부분 인덱스(state = 'ACTIVE' · acked_at IS NULL)가 파티션마다 열린 · 미확인 행만 담기 때문이다. 범위 조건은 여전히 쿼리에 실린다 — 요구가 말한 "범위를 조건으로 실행"을 지킨다.
- 범위 상한은 두지 않는다 — 키셋 페이지가 한 요청의 스캔을 limit으로 묶는다.

### 응답

| 필드 | 뜻 | 원천 |
|------|------|------|
| eventId · ruleId | 식별자 | alarm_event |
| tagId · tagCode · tagName · **tagIsActive** | 규칙이 가리키는 태그 — tagIsActive false면 판정이 멈춘 열린 알람이다 | alarm_rule → tag_master 조인 |
| conditionType · severity | 규칙 속성 — 현재 값 | alarm_rule |
| occurredAt · clearedAt | 확정 · 해제를 일으킨 판정 행의 ts — 벽시계가 아니다 · clearedAt null = 열림 | alarm_event |
| triggerValue | 확정 판정 행의 값 | alarm_event |
| state | ACTIVE · CLEARED | alarm_event |
| ackedBy · ackedAt | 확인자 user_id · 확인 시각 — null = 미확인 | alarm_event |

- 검산: 필드 행 = **7**
- **tagIsActive를 싣는 이유** — 비활성 태그의 열린 이벤트는 해소를 관측할 수 없어 사람이 확인하기 전까지 열려 있다. 목록이 이 사실을 보여야 운영자가 "멈춘 알람"과 "진행 중인 알람"을 가른다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §비활성 태그 규칙 잔여).
- 규칙 속성은 **현재 값**이다 — 이벤트 당시 임계값은 audit_log의 규칙 변경 이력으로 본다([08_work_orders.md](./08_work_orders.md) #8).
- 캐시는 cache:alarmevents Hash(필드 = 정규화 목록 쿼리 SHA-1 · 첫 채움 기준 만료 현행 참고 30초) — 확인 커밋 뒤 키 하나를 지운다. 발생 · 해제는 이 TTL만큼 늦게 목록에 반영된다(REQ-ALM-13).

## #2 POST /api/v1/alarms/events/{id}/ack

| 항목 | 계약 |
|------|------|
| 요청 | 경로 id(event_id) · 본문 없음 |
| 응답 200 | 이벤트 객체(#1 항목 모양) — ackedBy · ackedAt 채움 |
| 처리 | 한 트랜잭션 — 조건부 갱신 1회(event_id = id · state = 'ACTIVE' · acked_at IS NULL → acked_by = 요청자 · acked_at = 현재) + audit_log(UPDATE) · 커밋 뒤 cache:alarmevents DEL |
| 허용 | 행 state ACTIVE · acked_at null — **CLEARING 중인 열린 행 포함** |
| 실패 | 없는 id → 404 common.not_found · CLEARED 행 · 이미 확인된 행 → 409 alarms.ack_not_allowed · OPERATOR 밖 → 403 |
| Redis | alarm:state를 쓰지 않는다 — 판정기가 해소 첫 감지 때 acked_at을 읽어 ACKED 경로(디바운스 없는 닫기)를 실행한다 |
| 관련 REQ | REQ-ALM-14 · 15 · 16 · 18 · 19 |
| 흐름 | F-06 · F-05 |

- **B형 — 두 번째 확인이 409인 것은 멱등 위반이 아니다.** 결론 — 조건부 갱신이라 먼저 확인한 사람의 acked_by를 덮어쓰지 않는다. 반대 시나리오 — 재확인을 200으로 덮어쓰면 "누가 먼저 현장을 봤는가"가 마지막 클릭한 사람으로 바뀐다. 파생 지침 — 클라이언트는 409에 목록을 다시 읽고 같은 요청을 재시도하지 않는다.
- **확인과 해제가 경합해도 CLEARED 행에 확인이 붙지 않는다.** 판정과 쓰기를 한 조건부 갱신으로 묶었기 때문이다 — 해제가 먼저 커밋되면 이 갱신은 0행이 되어 409다(REQ-ALM-14).
- event_id만으로 찾으므로 월 파티션 각각의 PK 인덱스를 한 번씩 본다(PK가 (event_id, occurred_at)) — 파티션 수가 보존 2년의 월 수로 묶여 비용이 작다.
- **확인은 푸시하지 않는다.** ch:alarm은 열림 · 닫힘만 싣는다(ALM-06) — 다른 운영자 화면의 확인 표시는 목록 TTL만큼 늦다(§미확인 · 미설계 등재).

## #3 · #4 · #5 알람 규칙

| 항목 | #3 GET /api/v1/alarms/rules | #4 POST /api/v1/alarms/rules | #5 PATCH /api/v1/alarms/rules/{id} |
|------|------|------|------|
| 요청 | tagId · enabled(선택 필터) | tagId · conditionType · threshold · thresholdLow · debounceMs · severity · enabled(기본 true) | threshold · thresholdLow · debounceMs · severity · enabled 중 일부 |
| 응답 | items — 규칙 객체 · 페이지 없음 | 201 규칙 객체 | 200 규칙 객체 |
| 검증 | 해당 없음 | conditionType 4값 · severity 1~3 · OUT_OF_RANGE만 thresholdLow 필수 · 그 밖 thresholdLow null · thresholdLow < threshold · debounceMs 0 이상 · **tagId가 활성 태그** | 상동 · 불변 필드 거절 |
| 불변 | 해당 없음 | 해당 없음 | ruleId · tagId · conditionType |
| 체인 | 해당 없음 | ② DEL cache:alarmrules · ③ ch:cacheinv · ⑤ no-store · ⑥ | 상동 |
| 감사 | 해당 없음 | audit_log INSERT | audit_log UPDATE(before · after) |
| 관련 REQ | REQ-ALM-18 | REQ-ALM-01 · 02 · 03 · 04 · 18 | 상동 |

- 규칙 객체 필드: ruleId · tagId · conditionType · threshold · thresholdLow · debounceMs · severity · enabled = **8**
- **tagId · conditionType을 불변으로 둔 이유** — 과거 alarm_event · alarm_eval 행은 rule_id로 규칙을 가리킨다. 규칙이 다른 태그나 다른 조건 종류로 바뀌면 같은 rule_id의 판정 전수가 비교할 수 없는 두 조건을 섞는다 — 임계값 튜닝(ALM-09)의 근거가 무너진다. 조건을 바꾸려면 새 규칙을 등록하고 옛 규칙을 끈다.
- **비활성 태그를 가리키는 규칙 등록을 거절한다(판정 · 400 reference).** 판정기는 대상 태그가 비활성인 규칙을 활성으로 보지 않는다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) 규칙 조회) — 등록되자마자 영원히 판정되지 않는 규칙이 생긴다.
- **규칙을 꺼도 열린 이벤트는 닫히지 않는다.** 판정이 멈춰 해소를 관측하지 못한다 — 비활성 태그와 같은 잔여이며 사람의 확인만 가능하다.
- 커밋 전에 cache:alarmrules를 지우지 않는다 — 그 사이 판정이 옛 규칙으로 캐시를 다시 채워 TTL까지 낡은 임계값으로 판정한다(REQ-ALM-02).

## #6 GET /api/v1/alarms/evaluations

| 항목 | 계약 |
|------|------|
| 요청 | ruleId 또는 tagId(정확히 하나) · from · to(필수 · 오프셋 포함 ISO 8601) · maxPoints(선택 · 기본 현행 참고 2000 · [05_timeseries.md](./05_timeseries.md)와 같은 값) |
| 버킷 | 범위 길이로 [05_timeseries.md](./05_timeseries.md)와 같은 경계 — 1시간 이하 원시 판정 행 · 7일까지 1분 · 그 초과 1시간 · 버킷 수가 maxPoints를 넘으면 한 단계 상향 |
| 응답 200 | meta(interval · from · to · columns · pointCount · rule — 현재 규칙 객체) + series[](ruleId · tagId · points) |
| points 열 | [ts, min, max, breachCount, evalCount] — ts는 버킷 시작 epoch ms · min · max는 판정한 값의 극값 · breachCount는 위반 판정 수 |
| 원천 | ClickHouse alarm_eval 범위 스캔 — 롤업이 없어 매 요청 집계한다 · 보존 현행 참고 30일 밖 구간은 빈 points |
| 실패 | 형식 · 둘 다 또는 둘 다 없음 → 400 · ENGINEER 밖 → 403 · 대량 조회 등급 초과 → 429 · ClickHouse 불가 · 타임아웃 → 503 alarms.eval_store_unavailable |
| 관련 REQ | REQ-ALM-17 |
| 흐름 | F-06 · F-04 |

- **평균을 내지 않고 min · max 쌍만 낸다.** 평균은 임계값 근처의 순간 초과를 지운다 — 오탐 분석의 근거가 사라진다(REQ-ALM-17 · 원본 data_flow.md §6.3).
- **캐시하지 않는 이유** — 분석은 엔지니어가 범위를 바꿔 가며 드물게 부르고, 키 공간에 판정 이력 사본 키가 없다. 대신 대량 조회 등급 한도가 반복 스캔을 묶는다.
- **meta.rule은 현재 규칙이다.** 차트에 겹쳐 그리는 임계선이 과거 구간에서는 그 시점의 임계값이 아닐 수 있다 — 변경 시점은 audit_log에서 읽는다.
- **분석 무효 구간을 싣지 못한다.** 판정 전수 삽입이 재시도를 소진하면 그 ts 범위가 분석 무효 구간이 되지만([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)) 그 기록 자리는 계수 alm_eval_gap_* + 구조화 로그 이벤트로 판정됐고(W6 — [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md)) 응답에는 표지를 싣지 않는다 — 응답만으로는 빈 버킷이 "판정 없음"인지 "기록 실패"인지 가를 수 없고, 실험 기록이 로그에서 무효 구간을 옮겨 적는다(§미확인 · 미설계 등재).

## 원본에 없는 표면 판정

| 후보 | 판정 | 기능 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 규칙 조회 · 등록 · 수정 | **신설** #3 · #4 · #5 | ALM-01 · 권한 매트릭스 ALM-01 쓰기 ENGINEER | 시드로만 두면 임계값 튜닝 루프(분석 → 수정)가 마이그레이션 작업이 된다 |
| 판정 이력 분석 | **신설** #6 | ALM-09 · 권한 매트릭스 대량 스캔 읽기 예외 | [05_timeseries.md](./05_timeseries.md) #1로 흡수하면 tag_raw와 alarm_eval이 한 요청 스키마에 섞여 판정 필드(breached)가 시계열 표면에 새어 나온다 |
| 규칙 삭제 | **두지 않는다** | REQ-ALM-01 | 과거 이벤트가 참조를 잃어 어느 임계값이 이벤트를 만들었는지 복원할 수 없다 |
| 이벤트 강제 해제(사람이 닫기) | **두지 않는다** | 기능 없음 — 확인은 해제가 아니다(ALM-08 경계) | 사람이 닫으면 판정기의 alarm:state와 PostgreSQL 행이 어긋나 진실이 둘이 된다 |
| 담당자 배정 | **두지 않는다** | W3 판정 — 담당자 컬럼 없음 | 해당 없음 |
| 알람 상태(alarm:state) 조회 | **두지 않는다** | 판정기 단독 소유 · 표면 없음 | 핫 상태를 표면에 열면 판정 중간 상태(PENDING)가 확정 이벤트처럼 읽힌다 |

- 검산: 후보 = **6** · 신설 2행(표면 4) + 두지 않음 4행 = **6**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 분석 무효 구간의 기록 자리 | **W6 판정** — 테이블 · 키 · 레이블을 버리고 계수 alm_eval_gap_* + 구조화 로그 이벤트 alarm_eval_gap · #6 응답에는 무효 구간 표지를 싣지 않는다 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) §구간 기록 |
| 확인의 실시간 전파 | 확인은 ch:alarm에 싣지 않는다 — 다른 화면은 목록 TTL(현행 참고 30초)만큼 늦다 · 전파 신호를 두지 않는다(W6 판정) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) §확인(ACK) 신호 부재의 계측(W6 판정 — alm_acks_total + 구조 관계 상한 · 전파 신호 없음) |
| 이력 기본 범위 7일 | 2계층 현행 참고 — 소유 이 문서 | 이 문서 · S7 |
| 목록 · 확인 p95 | 3계층 미확인 — 원본 목표 CRUD 100 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 페이지네이션 · 봉투 · 한도 등급
- [02_errors.md](./02_errors.md) — alarms 네임스페이스 미러
- [11_websocket.md](./11_websocket.md) — 알람 열림 · 닫힘 푸시
- [../02_features/09_alarms.md](../02_features/09_alarms.md) — ALM-01~09 기능 정본
- [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) — REQ-ALM 계약
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — 판정 · ACK 기전
- [../08_screen/05_alarm_console.md](../08_screen/05_alarm_console.md) — ALM-CONSOLE · ALM-RULES 화면
