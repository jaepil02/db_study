# REQ-WRK — 업무 데이터 요구사항

> **대상**: 업무 데이터(WRK)의 동작 계약 — ③계층 비경유(Stream 미사용 · read-your-writes) · 작업지시 CRUD와 유일 제약 · 조회 캐시와 커밋 뒤 삭제 · 작업지시 상태 전이의 구조 · 생산 실적과 생산 카운터의 분리 · **감사 대상 기준과 감사 쓰기 트랜잭션** · 감사 로그 조회 · S7 시연 최소분 — REQ-WRK-NN 채번 정본
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §5 · §6 · §10.1 · §11 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §7 · §7.1 · §7.2(커밋 ff66a37) · 원본 implementation_plan.md §5 S7 · §7.4(커밋 ff66a37) · D-04 · D-11 · [../02_features/10_work_orders.md](../02_features/10_work_orders.md) WRK-01~05 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) WRK · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 미설계 enum work_order.status · 저장소 루트 docs_plan.md 웨이브 인계 W3 05_data_stores 행(audit_log 소유 WRK vs MST 트랜잭션 쓰기)

이 문서는 **경로를 고르지 않는 분기(③계층)가 지킬 계약**과 **audit_log의 계약**을 고정한다. 기능의 존재와 경계는 [../02_features/10_work_orders.md](../02_features/10_work_orders.md)가, F-05 기전은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)가 갖는다. 작업지시 · 생산 실적 · 감사는 API에서 PostgreSQL로 곧장 가고 Redis Stream을 타지 않는다 — 업무 쓰기를 비동기 at-least-once 경로에 올리면 커밋 응답 직후의 재조회가 아직 적재되지 않은 값을 보고, 재시도가 트랜잭션 경계 밖에서 중복을 만든다(D-04).

**후순위(S7)지만 생략 불가다(D-11).** ③이 비면 분기가 "Stream 뒤의 라우팅 테이블"로 오해되고, 감사가 빠지면 업무 쓰기와 감사 쓰기를 한 트랜잭션에 묶는 경계를 시연할 대상이 사라진다. 그래서 이 문서는 S7의 **시연 최소분**을 요구로 고정한다.

**audit_log는 WRK가 소유하고 여러 도메인이 쓴다.** 마스터 변경(MST)과 알람 규칙 · 확인(ALM)은 자기 트랜잭션 안에서 audit_log에 쓴다. 그래서 **감사 대상의 기준**은 소유자인 이 문서가 정하고 각 도메인은 그 기준을 적용한다. **work_order.status의 값 집합은 미설계다(W3)** — 이 문서는 값을 만들지 않고 전이 요구를 구조로만 적는다.

## 요구사항 — 업무 CRUD

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-WRK-01** | 작업지시 · 생산 실적 · 감사의 쓰기는 API가 PostgreSQL 트랜잭션으로 **동기 커밋한 뒤 응답한다.** Redis Stream에 발행하지 않고 Stream에서 받지 않는다. 쓰기 응답 직후의 같은 대상 조회는 새 값을 본다 | D-04 · 원본 architecture.md §5 · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) ③ 비경유 확인 · WRK-01~04 | Stream에 올리면 커밋 응답 직후의 재조회가 아직 적재되지 않은 값을 보고, 재시도가 트랜잭션 밖에서 작업지시를 두 번 만든다 | CRUD 부하 중 stream:plc:raw 유입량이 CRUD 유무와 무관 · 쓰기 응답 직후 GET → 새 값 | WRK-01 · WRK-02 · WRK-03 · WRK-04 | F-05 | 해당 없음 |
| **REQ-WRK-02** | 작업지시는 조회 · 등록 · 수정하며 order_no가 이미 있으면 거절한다. 참조하는 라인이 마스터에 없거나 형식이 어긋나면 거절하고, 경로의 작업지시가 없으면 404다 | 원본 architecture.md §6(order_no UK · line_id FK) · WRK-01 | 유일 검사를 애플리케이션 조회로만 하면 동시 등록 두 건이 모두 통과해 같은 order_no가 둘이 된다 — 판정은 DB 유일 제약 위반을 코드로 옮기는 것이다 | 같은 order_no 동시 등록 2건 → 1건 201 · 1건 409 · 없는 라인 → 400 · 없는 id → 404 | WRK-01 | F-05 | common.duplicate_key/409 · common.validation_failed/400 · common.not_found/404 |
| **REQ-WRK-03** | 작업지시 조회는 cache-aside를 거치고 TTL이 붙는다. 쓰기는 **커밋된 뒤에** 해당 캐시를 삭제한다 — 새 값으로 덮어쓰지 않는다. 캐시 계열 실패는 PostgreSQL 직행으로 degrade한다. BFF · 브라우저 캐시를 두면 마스터와 같은 무효화 체인 ④ · ⑤단을 적용한다 | 원본 data_flow.md §7.1 · 원본 architecture.md §11 · 원본 implementation_plan.md §7.4 · WRK-01 · [../02_features/02_master.md](../02_features/02_master.md) MST-08 | 커밋 전에 지우면 그 사이 다른 요청이 옛 값을 읽어 캐시를 다시 채우고 커밋 뒤에도 낡은 값이 남는다 · 덮어쓰면 동시 갱신에서 쓰기 순서가 뒤집혀 낡은 값이 최종값이 된다 | 수정 직후 조회 → 새 값 · 롤백된 수정 → 캐시 불변 · redis 정지 중 조회 → 200 | WRK-01 | F-05 | 해당 없음 |
| **REQ-WRK-04** | 작업지시 status 변경은 **허용 전이 표에 있는 쌍만** 허용하고, 현재 상태 확인과 쓰기를 하나의 조건부 갱신으로 묶는다. status는 일반 수정 표면으로 우회해 바꾸지 않는다. 값 집합과 허용 전이 표는 W3가 확정하며 확정 전 구현이 값을 만들지 않는다 — 구조는 §작업지시 상태 전이의 구조 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 미설계 enum · 원본 architecture.md §6((line_id, status) 인덱스) · WRK-02 | 확인과 쓰기를 가르면 동시에 들어온 두 전이가 같은 이전 상태를 보고 둘 다 성공해 표 밖 전이가 생긴다 · 일반 수정으로 우회하면 전이 규칙이 표면 하나에서만 지켜진다 | (값 확정 뒤) 표 밖 전이 요청 → 거절 · 같은 이전 상태에서 서로 다른 전이 동시 2건 → 1건만 성공 · 일반 수정 본문의 status → 무시 또는 거절 | WRK-02 | F-05 | work_orders.invalid_status_transition/409 |
| **REQ-WRK-05** | 생산 실적은 작업지시를 참조해 recorded_at · good_qty · defect_qty를 기록 · 조회한다. **사람이 API로 입력하는 업무 데이터**이며 Stream 유래 생산 카운터로 자동 채우지 않고 한 테이블로 합치지 않는다 | [../02_features/10_work_orders.md](../02_features/10_work_orders.md) §생산 실적과 생산 카운터 · 원본 architecture.md §6 · WRK-03 | 카운터를 production_log에 섞으면 스트림 유래 값이 업무 트랜잭션 경로에 들어와 ③의 "Stream을 타지 않는다"가 거짓이 되고 ②의 생산 카운터 분기가 흐려진다 | 실적 기록 → production_log 1행 · 수집 부하 중 production_log 행 증가 0 | WRK-03 | F-05 | common.validation_failed/400 · common.not_found/404 |
| **REQ-WRK-06** | PostgreSQL 접속 불가 시 업무 CRUD는 503으로 실패한다. **쓰기를 Stream · 큐 · 로컬 파일에 보관했다가 나중에 재생하지 않는다.** 시계열 조회는 계속 동작한다 | 원본 architecture.md §17 · 원본 data_flow.md §12.2 · WRK-01~05 | 보관 후 재생하면 사용자는 성공 응답을 받았는데 PostgreSQL에는 없는 쓰기가 생겨 read-your-writes가 깨지고 재생 순서가 원래 순서와 달라진다 | postgres 정지 → 작업지시 쓰기 503 · 재기동 뒤 자동 생성된 행 0 · 같은 구간 시계열 조회 200 | WRK-01 · WRK-02 · WRK-03 · WRK-05 | F-05 · F-10 | common.postgres_unavailable/503 |

- 검산: 이 표의 REQ = REQ-WRK-01~06 = **6**
- **REQ-WRK-06은 B형이다.** 결론 — 업무 쓰기는 PostgreSQL이 없으면 실패한다. 반대 시나리오 — 수집처럼 스풀에 담아 두면 응답은 성공인데 저장은 나중이라 ③계층이 비동기 경로로 바뀐다. 파생 지침 — 스풀 · 재발행은 봉인 계열 데이터(수집)의 전략이며 업무 쓰기에 이식하지 않는다.

## 요구사항 — 감사 · 인가 · 시연 최소분

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-WRK-07** | **사람이 인증된 쓰기 표면으로 일으킨 PostgreSQL 업무 테이블 변경**은 감사 대상이다. 시스템 쓰기(판정 경로 · 적재 · 대조군)와 PostgreSQL 밖의 쓰기는 대상이 아니다 — 판정 §감사 대상 기준 | 원본 architecture.md §18 · 이 문서 판정 · WRK-04 | 기준 없이 도메인마다 대상을 고르면 같은 성격의 변경이 한 도메인에서는 기록되고 다른 도메인에서는 빠져, 변경 이력 화면이 "기록이 없다"와 "변경이 없다"를 가를 수 없다 | 쓰기 표면별 변경 1건씩 → 대상 표면의 audit_log 행 1 · 비대상 쓰기의 행 0 | WRK-04 | F-05 | 해당 없음 |
| **REQ-WRK-08** | 감사 행(행위자 · 시각 · 동작 · 대상 테이블 · before · after)은 **변경과 같은 트랜잭션에서** 변경을 일으킨 도메인이 쓴다. 감사 쓰기가 실패하면 변경 전체가 롤백된다 | 원본 data_flow.md §7 · 원본 architecture.md §18 · WRK-04 · [../02_features/02_master.md](../02_features/02_master.md) MST-04 | 트랜잭션을 가르면 변경은 커밋됐는데 감사가 빠지는 창이 생긴다 · WRK가 다른 도메인의 변경을 대신 기록하면 트랜잭션 경계가 모듈 경계를 넘는다 | audit_log 쓰기 강제 실패 → 업무 행 변화 0 · 정상 변경 → 업무 행과 audit_log 행의 트랜잭션 ID(xmin) 일치 | WRK-04 | F-05 | common.postgres_unavailable/503 |
| **REQ-WRK-09** | audit_log에는 수정 · 삭제 표면을 두지 않고 캐시 무효화 체인의 대상으로 삼지 않는다. 보존은 파티션 · 보존 정책으로만 줄인다 | WRK-04 · WRK-05 · [../02_features/10_work_orders.md](../02_features/10_work_orders.md) §감사 로그 — 소유와 쓰기 | 감사 행을 고칠 수 있으면 감사가 변경의 증거가 아니게 된다 · 무효화 체인은 커밋 뒤의 사본을 지우는 것인데 감사는 커밋 안의 원본이다 | 감사 수정 · 삭제 경로 부재 확인 | WRK-04 · WRK-05 | F-05 | 해당 없음 |
| **REQ-WRK-10** | 감사 로그 조회는 audit_log와 태그 변경 이력(tag_master_history)을 시각 범위 조건으로 돌려준다. S7 이후 ADMIN에게만 연다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) WRK-05 · 원본 architecture.md §12 · WRK-05 | before · after 원문에는 다른 역할이 볼 이유가 없는 업무 값이 담긴다 · 범위 조건이 없으면 감사 테이블 전부를 훑는다 | ADMIN → 200 · OPERATOR · ENGINEER → 403 · 조회 실행 계획의 범위 조건 확인 | WRK-05 | F-05 | auth.forbidden/403 |
| **REQ-WRK-11** | S7 이후 작업지시 · 실적 쓰기와 상태 변경은 ADMIN만, 조회는 역할이 1개 이상인 인증 사용자 전원에게 연다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) WRK · D-07 | 쓰기 주체가 둘이면 감사 로그의 행위자로 변경 책임 축을 읽을 수 없다 | 역할별 토큰으로 등록 · 상태 변경 · 조회 → ADMIN만 쓰기 허용 | WRK-01 · WRK-02 · WRK-03 | F-05 | auth.forbidden/403 |
| **REQ-WRK-12** | S7에서 **시연 최소분**을 반드시 만든다 — 작업지시 등록 · 상태 변경 · 실적 기록 · 감사 기록 · 감사 조회의 경로가 각각 1개 이상 끝까지 동작한다. 생략 선택지를 두지 않는다 | D-11 · 원본 implementation_plan.md §5 S7 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) S7 합격 판정 ③ | ③이 비면 "성격이 경로를 고른다"는 명제의 반례 쪽이 비어 학습 목표 ②의 분기 대조가 절반만 남는다 | S7 인수 기준의 ③ 비경유 확인 통과([14_acceptance_criteria.md](./14_acceptance_criteria.md)) | WRK-01~05 | F-05 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-WRK-07~12 = **6** · 문서 전체 REQ = 6 + 6 = **12**(REQ-WRK-01~12 · 결번 없음)

## 쓰기 한 건의 순서

REQ-WRK-01 · 03 · 08이 걸리는 순서다. 기전 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다.

```plain
① 검증 · 인가            형식 · 유일 · 역할          REQ-WRK-02 · 11
② BEGIN
③ 업무 행 변경           작업지시 · 실적 · 상태       REQ-WRK-02 · 04 · 05
④ audit_log INSERT      같은 트랜잭션               REQ-WRK-08
⑤ COMMIT                실패 시 ③ · ④ 함께 롤백
⑥ 캐시 삭제              커밋 뒤에만 · 삭제          REQ-WRK-03
⑦ 응답                  커밋 뒤 · 재조회는 새 값     REQ-WRK-01
```

- **⑤ 앞에 Stream이 없다.** ③계층의 정의가 이 체인에 Redis Stream 단계가 없다는 것 자체다 — Redis는 ⑥의 캐시로만 개입한다.
- **④는 ③과 분리되지 않는다.** 감사를 트랜잭션 밖 비동기로 옮기면 ⑤ 뒤에 감사가 실패하는 창이 생긴다(REQ-WRK-08).
- **⑥이 실패해도 ⑦은 성공이다.** 캐시 계열 실패는 degrade이고, 남은 사본은 TTL로 사라진다 — 쓰기를 되돌릴 이유가 되지 않는다.

## 감사 대상 기준

REQ-WRK-07의 판정이다. 기준 하나로 도메인별 적용이 갈린다. 적용 결과의 정본은 각 도메인 요구 파일이며 아래 표는 기준이 어떻게 읽히는지의 대조다.

| 쓰기의 성격 | 예 | 감사 | 이유 |
|------|------|------|------|
| 사람 · 인증된 쓰기 표면 · PostgreSQL 업무 테이블 | 작업지시 · 실적 · 상태 변경 · 마스터 변경 · 알람 규칙 변경 · 알람 확인 | **대상** | 변경 책임의 축이 사람이다 — 행위자 칸이 곧 책임이다 |
| 시스템 · 데이터 경로 · PostgreSQL | 알람 이벤트 열기 · 닫기 · 대조군 적재 | 비대상 | 행위자가 사람이 아니고 빈도가 수집 부하에 묶인다 — 감사가 데이터 평면의 처리량을 먹는다 |
| PostgreSQL 밖 | ClickHouse 적재 · Redis 캐시 · 세션 · 리프레시 토큰 | 비대상 | 업무 테이블이 아니다 · 시계열은 불변 사실이라 변경 이력이 없다 |

- 검산: 성격 분류 = 대상 1 + 비대상 2 = **3**
- **판정: 알람 규칙 변경과 알람 확인은 대상이다** — 적용 판정의 자리는 [10_alarms.md](./10_alarms.md) §감사 대상 판정이다. 마스터 변경의 감사는 원본 data_flow.md §7 시퀀스가 이미 요구하며 계약 정본은 [03_master.md](./03_master.md)다.
- **소유와 쓰기가 갈린 결과로 아무 계층도 강제하지 않는 것이 있다** — 새 쓰기 표면이 감사를 빠뜨려도 DB 제약은 막지 못한다. 이 잔여는 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)(W3)의 한계 등재가 받는다.

## 작업지시 상태 전이의 구조

값이 없는 상태에서 고정할 수 있는 것과 없는 것을 가른다. 값 · 전이 표가 확정되면 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)에 상태 머신이 더해지고 이 표의 오른쪽 열이 채워진다.

| 요소 | 이 문서가 고정하는 것 | W3 이후가 고정하는 것 | 확정 자리 |
|------|------|------|------|
| 값 집합 | 값을 만들지 않는다 | status 값 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| 허용 전이 | 표 밖 전이는 거절한다 | 허용 쌍 전수 · 초기 상태 · 종결 상태 | 상동 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 경합 | 확인과 쓰기를 한 조건부 갱신으로 묶는다 | 해당 없음 | 이 문서 |
| 우회 금지 | 일반 수정 표면으로 status를 바꾸지 않는다 | 일반 수정 본문의 status를 무시할지 거절할지 | [../07_api/08_work_orders.md](../07_api/08_work_orders.md)(W5) |
| 위반 응답 | 409 · work_orders.invalid_status_transition/409 | 해당 없음 — 채번 완료 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(리드) |
| 감사 | 상태 변경은 감사 대상 | 해당 없음 | 이 문서 REQ-WRK-07 |

- 검산: 요소 = 값 · 전이 · 경합 · 우회 · 위반 응답 · 감사 = **6**
- **(line_id, status) 인덱스가 먼저 있다는 것은 status가 조회 조건이라는 뜻이다**(원본 architecture.md §6). 값이 확정되기 전에 구현이 임시 값으로 행을 쌓으면 인덱스가 그 임시 값으로 채워져 확정 뒤 이관이 필요하다.

## 조회 계약 — 2계층 조정값

| 조정값 | 읽는 자리 · 키 모양 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 · 소유처 |
|------|------|------|------|------|------|
| 작업지시 조회 캐시 TTL | 작업지시 캐시 키(모양 미정) | 캐시 쓰기 시 | TTL 없는 쓰기 · 쓰기 뒤 삭제 생략 | 기동 거부 | 60초 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 캐시 호출 타임아웃 | 캐시 계열 래퍼 | 호출마다 | 예외 전파 | 래퍼 기본 동작 | 50 ms · 상동 |
| PostgreSQL 커넥션 풀 크기 | api in-process 풀 | 기동 시 | 요청마다 새 커넥션 | 기동 거부 | 20 · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| audit_log 보존 | 파티션 · 보존 정책 | 정책 적용 시 | 행 단위 삭제 표면 | 삭제하지 않음 | 미정 · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |

- 검산: 조정값 = 캐시 TTL · 타임아웃 · 풀 · 보존 = **4**

## 실패 시 응답 전수

| 상황 | 응답 | 코드 또는 지표 | 요구 |
|------|------|------|------|
| order_no 중복 | 409 | common.duplicate_key/409 | REQ-WRK-02 |
| 없는 작업지시 · 라인 | 404 · 400 | common.not_found/404 · common.validation_failed/400 | REQ-WRK-02 · 05 |
| 형식 위반 | 400 | common.validation_failed/400 | REQ-WRK-02 · 05 |
| 상태 전이 위반 | 409 | work_orders.invalid_status_transition/409 | REQ-WRK-04 |
| 감사 쓰기 실패 | 변경 전체 롤백 | common.postgres_unavailable/503(접속 불가일 때) | REQ-WRK-08 |
| PostgreSQL 접속 불가 | 503 · 시계열 조회는 계속 | common.postgres_unavailable/503 | REQ-WRK-06 |
| 역할 밖 쓰기 · 감사 조회(S7 이후) | 403 | auth.forbidden/403 | REQ-WRK-10 · 11 |
| 캐시 계열 실패 | 200 · 느려짐 | 캐시 히트율 | REQ-WRK-03 |

- 검산: 상황 = **8** · 코드를 내는 행 7 + 코드 없는 행 1 = **8**

## 기능 → REQ 대응 검산

[../02_features/10_work_orders.md](../02_features/10_work_orders.md)의 기능 5개 전부가 적어도 하나의 REQ에 대응한다.

| 기능 ID | 기능명 | 대응 REQ |
|------|------|------|
| WRK-01 | 작업지시 관리 | REQ-WRK-01 · 02 · 03 · 06 · 11 · 12 |
| WRK-02 | 작업지시 상태 관리 | REQ-WRK-01 · 04 · 06 · 11 · 12 |
| WRK-03 | 생산 실적 기록 | REQ-WRK-01 · 05 · 06 · 11 · 12 |
| WRK-04 | 감사 로그 기록 | REQ-WRK-01 · 07 · 08 · 09 · 12 |
| WRK-05 | 감사 로그 조회 | REQ-WRK-06 · 09 · 10 · 12 |

- 검산: 기능 5 중 대응 REQ 있음 5 · 누락 0 = **5** · 기능에 대응하지 않는 REQ 0(유령 0). REQ 총수를 세는 자리는 §요구사항 — 감사 · 인가 · 시연 최소분의 검산 하나다

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| D-11 — 원본 S7 생략 허용 뒤집음 | REQ-WRK-12 — 시연 최소분 필수 | [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) |
| 보정 7.4 무효화 체인 확장 | REQ-WRK-03 — 커밋 뒤 삭제 · BFF · 브라우저 캐시를 두면 ④ · ⑤단 적용 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 웨이브 인계 — audit_log 소유 WRK vs MST 트랜잭션 쓰기 | REQ-WRK-07 · 08 — 기준은 소유자가 · 쓰기는 변경을 일으킨 도메인이 · 잔여는 한계 등재 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| 보정 7.1~7.3 · 7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| work_order.status 값 · 허용 전이 | text 컬럼 · (line_id, status) 인덱스 | 미설계(W1 등재) | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 상태 전이 위반 에러 코드 | 이 문서가 409 · work_orders 네임스페이스로 판정 | **채번 완료** — work_orders.invalid_status_transition/409 · 조건이 허용 전이 표에 대해 정의되므로 값 집합과 무관하게 성립한다 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(리드) |
| **S4~S6 무인증 기간의 감사 행위자** | 마스터 쓰기는 S4부터 audit_log에 쓰는데 인증은 S7이다 · audit_log.user_id는 user_account 참조다 | **신규 미확인** — 행위자 없는 감사 행을 허용할지 시드 계정으로 채울지 원본에 없다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md)(W3) |
| 업무 CRUD p95 | 원본 목표 100 ms 이하(4 vCPU 가정) · 지연 예산 80 ms | 미확인 — 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) |
| 생산 실적 · 감사 조회 표면 | 원본 API 표에 work-orders 하나뿐이다 | 표면 미설계 | [../07_api/08_work_orders.md](../07_api/08_work_orders.md)(W5) |
| 생산 카운터와 production_log의 구분 기전 | 원본에 기전이 없다 | 미설계 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) |
| 작업지시 캐시 키 모양 · BFF 캐시 여부 | TTL 60초만 있다 | 미설계 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)(W3) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)(W4) |

## 관련 문서

- [../02_features/10_work_orders.md](../02_features/10_work_orders.md) — WRK 기능 목록 · 감사 로그 소유
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — F-05 기전 · 무효화 체인
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — ③계층 분기 정책
- [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) — audit_log 한계 등재
- [03_master.md](./03_master.md) — 마스터 변경의 감사 쓰기
- [10_alarms.md](./10_alarms.md) — 알람 규칙 · 확인 감사 적용
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — ③ 비경유 확인 인수 기준
