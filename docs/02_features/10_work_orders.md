# WRK — 업무 데이터 기능 명세

> **대상**: 업무 데이터(WRK · NestJS work-orders 모듈) 기능 목록 · 감사 로그의 소유와 쓰기 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID WRK-NN 채번 정본
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §5 · §6 · §11 · §18(커밋 ff66a37) · 원본 data_flow.md §7 · §7.1 · §7.2(커밋 ff66a37) · 원본 tech_stack.md §5.1(커밋 ff66a37) · 원본 implementation_plan.md §5 S7(커밋 ff66a37) · D-04 · D-11 · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) 트랜잭션 공유 경계 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 미설계 enum

WRK는 **분기 ③계층 — 경로를 고르지 않는 분기 — 의 시연 자리**다. 작업지시 · 생산 실적 · 감사 로그는 API에서 PostgreSQL로 곧장 가고 Redis Stream을 타지 않는다. 업무 쓰기를 비동기 at-least-once 경로에 올리면 커밋 응답 직후의 재조회가 아직 적재되지 않은 값을 보고, 재시도가 트랜잭션 경계 밖에서 중복을 만든다(D-04). 분기가 "전부 큐를 태운다"가 아니라 "성격을 보고 경로를 고른다"라는 명제의 **반례 쪽**이 이 도메인이다.

**후순위(S7)지만 생략 불가다(D-11).** 원본은 작업지시 · 실적 · 감사 CRUD의 Redis 학습 가치를 "없음"으로 보고 생략을 허용했다(원본 implementation_plan.md §5 S7). 그러나 ③이 비면 분기가 "Stream 뒤의 라우팅 테이블"로 오해되고, 감사 로그가 빠지면 업무 쓰기와 감사 쓰기를 한 트랜잭션에 묶는 경계를 시연할 대상이 사라진다. 그래서 S7에서 **시연 최소분**을 반드시 만든다.

**audit_log는 WRK가 소유하고 여러 도메인이 쓴다.** 마스터 변경(MST)은 자기 트랜잭션 안에서 audit_log에 before · after를 쓴다 — 소유와 쓰기가 갈린 테이블이다. 이 분리는 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)의 한계 등재가 받는다(W3).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 W5 몫).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **WRK-01** | 작업지시 관리 | 라인에 배정된 작업지시(order_no · product_code · target_qty · planned_start · planned_end · status)를 조회 · 등록 · 수정한다. order_no는 유일하다. 조회는 캐시(현행 60초)를 거치고 쓰기는 커밋 뒤에 캐시를 삭제한다. BFF를 거친다 — 웹 오리진 하나로 요청이 모여 쿠키 · CORS가 단순해진다 | S7 | F-05 | 해당 없음 | 07_api/08_work_orders | PostgreSQL work_order · Redis cache 계열 |
| **WRK-02** | 작업지시 상태 관리 | 작업지시의 status를 바꾼다. (line_id, status) 인덱스가 먼저 있다는 것은 status가 조회 조건으로 쓰인다는 뜻이다. **status 값 집합은 미설계다** — 값이 확정되면 상태 머신과 전이 위반 코드가 뒤따른다 | S7 | F-05 | 해당 없음 | 07_api/08_work_orders | PostgreSQL work_order |
| **WRK-03** | 생산 실적 기록 | 작업지시별 실적(recorded_at · good_qty · defect_qty)을 기록하고 조회한다. **사람이 API로 입력하는 업무 데이터**다 — Stream에서 오는 ②계층의 생산 카운터와 다른 데이터다(§생산 실적과 생산 카운터) | S7 | F-05 | 해당 없음 | 07_api/08_work_orders | PostgreSQL production_log |
| **WRK-04** | 감사 로그 기록 | 업무 데이터 변경마다 행위자 · 시각 · 동작 · 대상 테이블 · before · after(jsonb)를 **변경과 같은 트랜잭션에서** audit_log에 쓴다. 쓰는 주체는 변경을 일으킨 도메인(MST · WRK)이고 테이블 소유는 WRK다. 트랜잭션을 가르면 변경은 커밋됐는데 감사가 빠지는 창이 생긴다 | S7(MST 쓰기는 S4) | F-05 | 해당 없음 | 표면 없음 — 쓰기 표면의 트랜잭션 안 단계 | PostgreSQL audit_log |
| **WRK-05** | 감사 로그 조회 | 관리자가 변경 이력(audit_log · 태그 변경은 tag_master_history)을 조회한다. **원본 API 표에 이 조회 표면이 없다** — 관리 화면의 "변경 이력 확인"(W1 [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md))이 요구한다 | S7 | F-05 | 해당 없음 | 07_api/08_work_orders(W5 신설 판정) | PostgreSQL audit_log(읽기) |

- 검산: WRK-01~05 = **5**. 단계 S7 5 = **5**(WRK-04의 MST 쓰기 경로만 S4에 먼저 생긴다 — MST-04)
- 표면 있음 4(WRK-01 · 02 · 03 · 05) + 표면 없음 1(WRK-04) = **5**. WRK-03 · 05의 표면은 원본 API 표(원본 architecture.md §11 — work-orders 하나)에 따로 없어 W5가 배치를 정한다.
- **WRK는 스위치가 없다.** ③계층은 Redis 역할이 캐시뿐이고, 그 캐시 on/off는 학습 목표의 비교 대상이 아니다.

## 감사 로그 — 소유와 쓰기

| 쓰는 도메인 | 쓰는 시점 | 트랜잭션 | 대상 | 근거 |
|------|------|------|------|------|
| MST | 태그 · 설비 등 마스터 변경 | 마스터 변경과 같은 트랜잭션 | before · after | 원본 data_flow.md §7 시퀀스(UPDATE tag_master → INSERT audit_log → COMMIT) |
| WRK | 작업지시 · 실적 변경 | 업무 변경과 같은 트랜잭션 | before · after | "업무 데이터 변경은 AUDIT_LOG에 before/after 기록"(원본 architecture.md §18) |
| ALM | 규칙 변경 | **미확인** | 미확인 | 알람 규칙이 감사 대상인지 원본에 없다 — [09_alarms.md](./09_alarms.md) |

- 검산: 쓰는 도메인 후보 = MST · WRK · ALM(미확인) = **3**
- **소유와 쓰기가 갈린 결과로 아무 계층도 강제하지 않는 것이 있다** — 새 쓰기 표면이 감사 기록을 빠뜨려도 DB 제약은 막지 못한다. 이것이 한계 등재 대상이다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) W3).
- 감사 로그는 캐시 무효화 체인의 대상이 아니다 — 체인은 커밋 뒤의 **사본**을 지우고, 감사는 커밋 **안**의 원본이다.

## 생산 실적과 생산 카운터

같은 "생산 수량"이 두 계층에 나타난다. 둘을 섞으면 ③의 반례와 ②의 핵심이 함께 흐려진다.

| 항목 | WRK-03 생산 실적 | 분기 ②계층 생산 카운터 |
|------|------|------|
| 원천 | 사람이 API로 입력 | 설비 태그(COUNTER 프로파일 등)가 Stream으로 |
| 경로 | API → PostgreSQL(Stream 비경유) | Stream → Ingest → 성격 판정 |
| 목적지 | PostgreSQL production_log | **미설계** — 원본에 기전이 없다 |
| 계층 | ③ 업무 CRUD | ② 알람 판정 · 생산 카운터 |
| 확정 자리 | 이 문서 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |

- **WRK-03이 생산 카운터를 대신 쓰지 않는다.** 둘을 한 테이블로 합치면 스트림 유래 값이 업무 트랜잭션 경로에 섞여 ③의 "Stream을 타지 않는다"가 거짓이 된다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| WRK-01~03 | Stream에 발행하지 않는다 · Stream에서 받지 않는다 | 해당 없음 — ③계층의 정의 |
| WRK-02 | 상태 값을 정하지 않는다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| WRK-03 | 설비 카운터 값으로 실적을 자동 채우지 않는다 | §생산 실적과 생산 카운터 |
| WRK-04 | 다른 도메인의 변경을 대신 기록하지 않는다 — 변경을 일으킨 도메인이 자기 트랜잭션에서 쓴다 | MST-04 · 05 · 06 |
| WRK-05 | 시계열 변경을 보여 주지 않는다 — 시계열은 불변이라 변경 이력이 없다 | 해당 없음 |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| MST | MST → WRK | 트랜잭션 공유 | 마스터 변경이 audit_log에 쓴다. 작업지시는 production_line을 참조한다 |
| AUT | AUT → WRK | 인가 | 쓰기는 관리자 · 감사 조회는 관리자([12_permission_matrix.md](./12_permission_matrix.md)) · 감사 행위자는 user_account |
| ING | 없음 | 해당 없음 | **의존이 없는 것이 설계다** — ③은 Stream과 무관하다 |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| order_no 중복 | 쓰기 거절 | common.duplicate_key/409 | WRK-01 |
| 없는 작업지시 | 거절 | common.not_found/404 | WRK-01 · 02 · 03 |
| 형식 위반 | 거절 | common.validation_failed/400 | WRK-01 · 03 |
| 작업지시 상태 전이 위반 | **채번 보류** — 값 집합 자체가 미설계 | 11_glossary/02 채번 보류 | WRK-02 |
| 감사 쓰기 실패 | 변경 전체가 롤백된다 — 같은 트랜잭션이다 | common.postgres_unavailable/503(접속 불가일 때) | WRK-04 |
| PostgreSQL 접속 불가 | 업무 CRUD만 실패 · 시계열 조회는 계속 | common.postgres_unavailable/503 | WRK-01~05 |

- **B형 — 감사 쓰기가 실패하면 업무 변경도 실패한다.** 불편해 보이지만 반대 설계(감사를 트랜잭션 밖 비동기로)는 변경이 커밋되고 감사가 빠지는 창을 만든다. 로컬 학습 시스템이어도 감사 로그는 장식이 아니다([../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md)).

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| D-11 — 원본 S7 생략 허용 뒤집음 | WRK-01~05를 S7 시연 최소분으로 두고 생략 선택지를 없앴다 | [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) |
| 보정 7.4 무효화 체인 확장 | WRK-01 쓰기 뒤 캐시 삭제는 MST-08과 같은 순서(커밋 뒤 삭제)를 따른다 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 보정 7.1~7.3 · 7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| work_order.status 값 · 전이 | 미설계(W1 등재) | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) · 전이 위반 코드 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |
| 생산 실적 · 감사 조회 표면 | 원본 API 표에 work-orders 하나뿐이다 | [../07_api/08_work_orders.md](../07_api/08_work_orders.md)(W5) |
| 생산 카운터와 production_log의 구분 기전 | W1 인계 미설계 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |
| audit_log 소유와 다중 쓰기 | 한계 등재 대상 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)(W3) |
| 작업지시 캐시 키 모양 | TTL만 있다(원본 architecture.md §11 — 60초) | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)(W3) |

## 관련 문서

- [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) — REQ-WRK 동작 계약
- [../07_api/08_work_orders.md](../07_api/08_work_orders.md) — 작업지시 · 실적 표면
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — F-05 기전
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — ③계층 분기 정책
- [02_master.md](./02_master.md) — 감사 로그를 쓰는 마스터 변경
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-11
