# WRK — 작업지시 · 실적 · 감사 표면 (08_work_orders)

> **대상**: WRK 도메인 REST 표면 — 작업지시 조회 · 등록 · 수정 · 상태 전이 · 생산 실적 기록과 조회 · 감사 로그 조회 · 태그 새 발급 계보 조회 · **실적 기록 시점의 작업지시 상태 조건 판정** · 일반 수정 본문의 status 처리 판정 · 원본에 없는 표면 판정(생산 실적 · 감사 조회)
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W5 판정 반영 — #7 실적 상태 조건 거절 → **work_orders.production_log_not_allowed/409** · #9 계보 조회 역할 ADMIN → **전원**(리드 판정) · 실적 정정 · 이중 제출 범위 밖 · 한계 등재 — 표면 수 불변
> **원천**: 원본 architecture.md §6 · §11 · §12 · §18(커밋 ff66a37) · 원본 data_flow.md §7 · §7.2(커밋 ff66a37) · REQ-WRK-01~12 · D-04 · D-11 · ADR-12 · [../02_features/10_work_orders.md](../02_features/10_work_orders.md) WRK-01~05 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 4 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) work_order · production_log · audit_log · tag_master_history · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 작업지시 캐시 · docs_plan.md 웨이브 인계 W5 07_api 행(실적 기록 시점의 작업지시 상태 조건 · 원본에 없는 표면)

WRK 표면은 분기 **③계층의 반례 자리**다 — 업무 쓰기는 Stream을 타지 않고 API가 PostgreSQL 트랜잭션으로 동기 커밋한 뒤에 응답한다(D-04 · REQ-WRK-01). 그래서 이 문서의 모든 쓰기는 **응답 직후의 같은 대상 조회가 새 값을 본다**(read-your-writes)는 계약을 지고, BFF 서버 fetch 캐시를 두지 않는다(no-store).

원본 API 표에는 /api/v1/work-orders(GET · POST · PATCH) 한 줄뿐이다(원본 architecture.md §11). 기능 WRK-02(상태 관리) · WRK-03(실적) · WRK-05(감사 조회)는 표면을 요구하고, 관리 화면의 "변경 이력 확인"이 감사 조회를 요구한다. 이 문서는 그 표면을 **기능 근거로 신설**한다. 감사 기록(WRK-04)은 표면이 없다 — 쓰기 표면의 트랜잭션 안 단계다.

**감사 조회 표면의 네임스페이스는 work_orders다.** 경로는 /api/v1/audit-logs지만 표면 소유는 audit_log 테이블을 소유한 WRK다 — 에러 네임스페이스는 URL이 아니라 표면을 소유한 도메인을 따른다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 네임스페이스 배정 규칙).

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 전 표면 BFF 경유 · **no-store** | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 · REQ-WRK-03 |
| 인가 | 작업지시 · 실적 조회 전원 · 쓰기 · 상태 전이 ADMIN · 감사 원문 조회(#8) ADMIN · 계보 조회(#9) 전원 | REQ-WRK-10 · 11 · 권한 매트릭스 WRK-05 |
| 쓰기 | 동기 커밋 뒤 응답 · Stream · 큐 · 로컬 파일에 보관했다 재생하지 않는다 | REQ-WRK-01 · 06 |
| 감사 | 쓰기 하나 = 트랜잭션 하나(변경 + audit_log) · 감사 실패는 변경 전체 롤백 | REQ-WRK-08 |
| 캐시 | cache:workorders Hash(필드 = 정규화 목록 쿼리 SHA-1 · 첫 채움 기준 만료 현행 참고 60초) · 작업지시 · 실적 쓰기 커밋 뒤 키 하나 DEL | REQ-WRK-03 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| PostgreSQL 불가 | common.postgres_unavailable/503 · 시계열 조회는 계속 | REQ-WRK-06 |
| 단계 | 전 표면 S7 — 시연 최소분 · 생략 선택지 없음 | REQ-WRK-12 · D-11 |

- 검산: 항목 = **7**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/work-orders | WRK-01 | 전원 | cache:workorders · BFF no-store | common.validation_failed/400 · common.postgres_unavailable/503 | ADM-WORKORDER | 원본 |
| 2 | POST | /api/v1/work-orders | WRK-01 | ADMIN | 없음 | common.validation_failed/400 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-WORKORDER | 원본 |
| 3 | PATCH | /api/v1/work-orders/{id} | WRK-01 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-WORKORDER | 원본 |
| 4 | GET | /api/v1/work-orders/{id} | WRK-01 · 03 | 전원 | cache:workorders · BFF no-store | common.not_found/404 · common.postgres_unavailable/503 | ADM-WORKORDER | 신설 |
| 5 | POST | /api/v1/work-orders/{id}/status | WRK-02 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · work_orders.invalid_status_transition/409 · common.postgres_unavailable/503 | ADM-WORKORDER | 신설 |
| 6 | GET | /api/v1/work-orders/{id}/production-logs | WRK-03 | 전원 | cache:workorders · BFF no-store | common.validation_failed/400 · common.not_found/404 · common.postgres_unavailable/503 | ADM-WORKORDER | 신설 |
| 7 | POST | /api/v1/work-orders/{id}/production-logs | WRK-03 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · work_orders.production_log_not_allowed/409 · common.postgres_unavailable/503 | ADM-WORKORDER | 신설 |
| 8 | GET | /api/v1/audit-logs | WRK-05 | ADMIN | 없음 · BFF no-store | common.validation_failed/400 · common.postgres_unavailable/503 | ADM-AUDIT | 신설 |
| 9 | GET | /api/v1/audit-logs/tag-reissues | WRK-05 | 전원 | 없음 · BFF no-store | common.validation_failed/400 · common.postgres_unavailable/503 | ADM-AUDIT · ANL-TREND | 신설 |

- 검산: 표면 = REST **9** · 원본 3(#1~#3) + 신설 6(#4~#9) = **9** · 조회 5(#1 · 4 · 6 · 8 · 9) + 쓰기 4 = **9**
- 신설 6의 기능 근거: WRK-01 · 03 1(#4) · WRK-02 1(#5) · WRK-03 2(#6 · 7) · WRK-05 2(#8 · 9) = **6**
- #7의 상태 조건 거절은 work_orders.production_log_not_allowed/409다(W5 채번) — §실적 기록 시점의 작업지시 상태 조건 판정.
- #9의 ANL-TREND 호출은 스케일 변경 전후 태그를 한 트렌드로 잇는 계보 조회다 — 그래서 #9는 감사 원문(#8 · ADMIN)과 달리 **인증 사용자 전원**이 읽는다(리드 판정 · 권한 매트릭스 WRK-05 계보 행). 계보 행에는 before · after 업무 원문이 없고 변환식 쌍 · 사유만 있다.

## 표면 계약 — 작업지시

### #1 · #4 조회

| 항목 | #1 GET /api/v1/work-orders | #4 GET /api/v1/work-orders/{id} |
|------|------|------|
| 요청 | lineId · status(선택 필터) · limit · cursor | 경로 id |
| 응답 | items — 작업지시 객체 · meta.nextCursor | 작업지시 객체 + production(goodQtyTotal · defectQtyTotal · logCount) |
| 정렬 | plannedStart 내림차순 · orderId 내림차순 | 해당 없음 |
| 인덱스 | work_order (line_id, status) | PK |
| 관련 REQ | REQ-WRK-01 · 03 · 11 | REQ-WRK-01 · 05 |

- 작업지시 객체 필드: orderId · lineId · orderNo · productCode · targetQty · plannedStart · plannedEnd · status = **8**
- **#4를 신설한 이유** — work_orders.invalid_status_transition의 클라이언트 대응이 "현재 상태를 다시 읽는다"이다. 목록을 필터로 다시 읽으면 캐시(현행 참고 60초)가 옛 상태를 줄 수 있어 대응이 같은 409를 반복한다 — 단건 조회는 캐시 Hash 필드를 거치더라도 쓰기 커밋 뒤 키가 지워져 새 값을 본다.

### #2 POST /api/v1/work-orders · #3 PATCH /api/v1/work-orders/{id}

| 항목 | #2 등록 | #3 수정 |
|------|------|------|
| 요청 | lineId · orderNo · productCode · targetQty · plannedStart · plannedEnd | orderNo · productCode · targetQty · plannedStart · plannedEnd 중 일부 |
| 응답 | 201 작업지시 객체 — status는 **PLANNED로 시작**(요청으로 받지 않는다) | 200 작업지시 객체 |
| 검증 | lineId가 마스터에 있음(없으면 400 reference) · targetQty 양수 · plannedEnd > plannedStart · 시각 오프셋 포함 | 상동 |
| 불변 | 해당 없음 | orderId · lineId · **status** |
| 실패 | order_no 중복 409 | order_no 중복 409 · 없는 id 404 · status 포함 400(immutable) |
| 체인 | 커밋 뒤 cache:workorders DEL — ③ ④ ⑤ ⑥ 없음(no-store) | 상동 |
| 관련 REQ | REQ-WRK-01 · 02 · 03 · 08 | REQ-WRK-02 · 03 · 04 · 08 |

- **판정 — 일반 수정 본문의 status는 거절한다(400 immutable).** REQ-WRK-04가 "무시할지 거절할지"를 이 문서에 넘겼다. 무시하면 200이 오는데 status는 그대로라 클라이언트가 전이가 됐다고 믿는다 — 상태 전이는 #5 하나로만 한다. 거절이면 우회 시도가 즉시 드러난다.
- **동시 등록의 유일 검사는 DB 제약이 한다.** 애플리케이션 조회로만 검사하면 같은 order_no 두 건이 모두 통과한다 — 제약 위반을 common.duplicate_key/409로 옮긴다(REQ-WRK-02).
- 종결(COMPLETED · CANCELLED) 지시의 필드 수정은 막지 않는다 — 요구사항이 금지하지 않았고 감사 before · after가 흔적을 남긴다(§미확인 · 미설계 등재).

### #5 POST /api/v1/work-orders/{id}/status

| 항목 | 계약 |
|------|------|
| 요청 | fromStatus · toStatus — 둘 다 필수 · 4값(PLANNED · IN_PROGRESS · COMPLETED · CANCELLED) |
| 응답 200 | 작업지시 객체(새 status) |
| 처리 | 한 트랜잭션 — 조건부 갱신 1회(order_id = id · status = fromStatus · (fromStatus, toStatus)가 허용 전이 4쌍) + audit_log(UPDATE) · 커밋 뒤 cache:workorders DEL |
| 실패 | 허용 전이 밖 · fromStatus가 현재와 다름 → 409 work_orders.invalid_status_transition · details.currentStatus · 없는 id → 404 · 값 형식 → 400 |
| 관련 REQ | REQ-WRK-04 · 08 · 11 |
| 흐름 | F-05 |

허용 전이는 넷이다(정본 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 4).

```plain
PLANNED ──→ IN_PROGRESS ──→ COMPLETED
   │              │
   └──→ CANCELLED ←┘
```

- **fromStatus를 필수로 둔 이유(B형)** — 결론: 요청자가 본 상태를 조건으로 싣는다. 반대 시나리오 — toStatus만 받아 "허용 전이의 앞 상태 중 하나"를 조건으로 두면, 같은 PLANNED를 보고 들어온 IN_PROGRESS 요청과 CANCELLED 요청이 순서대로 둘 다 성공한다(IN_PROGRESS → CANCELLED도 허용 전이다). REQ-WRK-04의 검증 "같은 이전 상태에서 서로 다른 전이 동시 2건 → 1건만 성공"이 실패한다. 파생 지침 — 409를 받으면 details.currentStatus로 다시 판단한다.
- **종결에서 나가는 전이는 없다.** 잘못 종결한 지시는 새 작업지시로 등록한다 — 되돌리면 실적이 재개분인지 추가분인지 가를 수 없다.
- fromStatus 불일치도 invalid_status_transition이다 — 정본 발생 조건에 "요청의 fromStatus가 현재 status와 다를 때(동시 전이 경합)"가 W5에서 더해졌다.

## 표면 계약 — 생산 실적

### #6 · #7 실적 조회 · 기록

| 항목 | #6 GET …/production-logs | #7 POST …/production-logs |
|------|------|------|
| 요청 | limit · cursor | recordedAt(오프셋 포함 ISO 8601) · goodQty · defectQty(0 이상 정수) |
| 응답 | items — 실적 객체(logId · orderId · recordedAt · goodQty · defectQty) · meta.nextCursor | 201 실적 객체 |
| 정렬 · 인덱스 | recordedAt 내림차순 · logId 내림차순 · production_log (order_id, recorded_at) | 해당 없음 |
| 상태 조건 | 해당 없음 | **작업지시 status = IN_PROGRESS일 때만** — §판정 |
| 처리 | 해당 없음 | 한 트랜잭션 — 작업지시 행 공유 잠금으로 상태 확인 → INSERT production_log + audit_log · 커밋 뒤 cache:workorders DEL |
| 실패 | 없는 지시 404 | 없는 지시 404 · 형식 400 · 상태 조건 위반 409 work_orders.production_log_not_allowed |
| 관련 REQ | REQ-WRK-05 · 11 | REQ-WRK-01 · 05 · 08 · 11 |

- **실적은 사람이 API로 입력하는 업무 데이터다.** Stream 유래 생산 카운터로 자동 채우지 않고 한 테이블로 합치지 않는다 — 합치면 스트림 유래 값이 업무 트랜잭션 경로에 섞여 ③의 "Stream을 타지 않는다"가 거짓이 된다(REQ-WRK-05).
- **실적 수정 · 삭제 표면은 두지 않는다.** 기능 WRK-03은 기록 · 조회다. 잘못 입력한 실적을 되돌릴 수단이 없는 것은 잔여다 — good_qty CHECK 0 이상이라 음수 보정 행도 쓸 수 없다(§미확인 · 미설계 등재).
- **같은 값의 이중 제출은 두 행이 된다.** 자연 유일 키가 없고 Idempotency-Key를 담을 키 계열이 없다([01_conventions.md](./01_conventions.md) §멱등) — 화면은 제출 버튼을 응답까지 잠근다.

### 실적 기록 시점의 작업지시 상태 조건 판정

인계 "실적 기록 시점의 작업지시 상태 조건"을 닫는다. **판정 — IN_PROGRESS인 지시에만 실적을 기록한다.**

| 안 | 허용 상태 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 상태 무관 | 4값 전부 | PLANNED 지시에 실적이 쌓여 "착수 전 생산"이 기록되고, CANCELLED 지시의 실적이 취소 뒤에도 늘어난다 | 버림 |
| ② IN_PROGRESS · COMPLETED | 생산 중 · 완료 뒤 입력 | COMPLETED가 종결이 아니게 된다 — 완료 뒤에도 합계가 바뀌어 "완료 시점 실적"이 한 값이 아니다 | 버림 |
| ③ **IN_PROGRESS만** | 생산 중 | 완료 전에 실적을 다 입력해야 한다 — 완료 전이가 실적 마감을 겸한다 | **채택** |

- 검산: 안 = **3**
- **종결 상태의 뜻과 맞춘 판정이다.** 상태 머신 4는 종결에서 나가는 전이를 두지 않는다 — 종결 뒤 실적이 바뀌면 종결이 기록을 얼리지 못한다. ③은 "완료 = 실적 확정"을 한 사건으로 묶는다.
- **상태 확인과 삽입을 한 트랜잭션의 행 잠금으로 묶는다.** 확인과 삽입 사이에 완료 전이가 커밋되면 COMPLETED 지시에 실적이 붙는다 — 작업지시 행의 공유 잠금이 상태 전이의 조건부 갱신과 직렬화한다.
- **거절 코드는 work_orders.production_log_not_allowed/409다(W5 채번).** invalid_status_transition은 상태 전이 요청의 코드라 쓰지 않는다 — 실적 기록은 전이가 아니다.

## 표면 계약 — 감사 조회

### #8 GET /api/v1/audit-logs

| 항목 | 계약 |
|------|------|
| 요청 | from · to(acted_at 범위 · 오프셋 포함 ISO 8601) · targetTable · targetKey(둘은 함께) · userId · action(INSERT · UPDATE) · limit · cursor |
| 기본 범위 | from 생략 시 to − 7일 · to 생략 시 현재(2계층 · 현행 참고 · 소유 이 문서) |
| 응답 | items — auditId · userId · actedAt · action · targetTable · targetKey · before · after · meta.nextCursor |
| 정렬 · 인덱스 | actedAt 내림차순 · auditId 내림차순 · 대상 필터면 audit_log (target_table, target_key, acted_at) · 아니면 audit_log (acted_at) |
| before · after | jsonb 원문을 JSON 객체로 그대로 — INSERT의 before는 null |
| userId null | 무인증 기간(S4~S6)의 행위 · 시스템 행위자가 아니다 |
| 관련 REQ | REQ-WRK-07 · 09 · 10 |

- **ADMIN만 여는 이유** — before · after 원문에는 다른 역할이 볼 이유가 없는 업무 값이 담긴다(권한 매트릭스 원문 읽기 예외).
- **범위 조건이 늘 실린다.** audit_log는 무기한 · 비분할이라([../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)) 범위 없는 조회가 테이블 전부를 훑는다. targetTable · targetKey를 함께 받으면 "이 태그의 변경 이력" 한 행 계보를 기본 범위 밖까지 보려면 from을 명시한다.
- 감사 행에 수정 · 삭제 표면이 없다 — 감사를 고칠 수 있으면 변경의 증거가 아니다(REQ-WRK-09).

### #9 GET /api/v1/audit-logs/tag-reissues

| 항목 | 계약 |
|------|------|
| 요청 | tagId(선택 — 이전 · 새 tag_id 어느 쪽이든) · from · to(changed_at 범위 · 기본 #8과 같다) |
| 응답 | items — historyId · oldTagId · newTagId · oldScale · oldOffsetValue · newScale · newOffsetValue · changedAt · changedBy · reason |
| 계보 | tagId를 주면 그 태그에서 시작해 old → new 방향과 new → old 방향으로 이어지는 행을 모두 낸다 |
| 인덱스 | tag_master_history (old_tag_id) · new_tag_id UNIQUE |
| 관련 REQ | REQ-WRK-10 · REQ-MST-07 |

- **이 표면이 WRK에 있는 이유** — tag_master_history를 쓰는 주체는 MST(#7 새 태그 발급)지만 조회는 변경 이력 확인(WRK-05)의 일부다. **인가는 #8과 다르다** — 계보 행은 행위자와 변환식 쌍뿐이라 원문 읽기 예외에 들지 않고, 트렌드 화면(전원)이 전후 구간을 잇는 데 필요하다(리드 판정).
- 계보가 필요한 이유 — 스케일 변경 전후 구간은 tag_id가 달라 트렌드가 두 선으로 끊긴다. 화면이 이 계보로 두 series를 한 축에 잇는다(REQ-MST-07 · 인덱스 #9의 근거).

## 원본에 없는 표면 판정

| 후보 | 판정 | 기능 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 작업지시 단건 조회 | **신설** #4 | WRK-01 · 409 대응 | 목록 캐시가 옛 상태를 줘 409가 반복된다 |
| 상태 전이 | **신설** #5 | WRK-02 · REQ-WRK-04 | PATCH에 status를 두면 전이 규칙이 일반 수정과 한 표면에 섞여 우회가 가능하다 |
| 생산 실적 조회 · 기록 | **신설** #6 · #7 | WRK-03 | 원본 표대로면 실적을 입력할 길이 없어 ③계층 시연 최소분(REQ-WRK-12)이 비어 학습 목표 ②의 반례 쪽이 사라진다 |
| 감사 로그 조회 | **신설** #8 | WRK-05 · 관리 화면 변경 이력 | 감사가 쓰이기만 하고 읽히지 않으면 REQ-WRK-12 "감사 조회 경로"가 실패한다 |
| 태그 새 발급 계보 조회 | **신설** #9 | WRK-05(tag_master_history 포함) | #8의 target_table 필터로 대신하면 old · new 두 tag_id의 변환식 쌍을 한 행으로 읽을 수 없다 |
| 실적 수정 · 삭제 | **두지 않는다** | 기능 없음 | 해당 없음 — 잔여 등재 |
| 작업지시 삭제 | **두지 않는다** | 기능 없음 · 취소는 CANCELLED 전이 | 삭제하면 실적 FK(RESTRICT)가 막거나 실적이 고아가 된다 |
| 감사 수정 · 삭제 | **두지 않는다** | REQ-WRK-09 | 감사가 증거가 아니게 된다 |

- 검산: 후보 = **8** · 신설 5행(표면 6) + 두지 않음 3행 = **8**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 실적 오입력 정정 수단 | **미설계 — 범위 밖**(학습 목표 무관 · D-11은 존재만 요구 · 리드 판정) · 한계 등재 | [../02_features/10_work_orders.md](../02_features/10_work_orders.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| 실적 이중 제출 | 잔여 — 자연 유일 키 · 멱등 키 계열 없음 · 한계 등재(강제 주체 없음) | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| 종결 지시의 필드 수정 | 막지 않는다 — 요구사항에 금지가 없다 · 금지하면 409 코드가 새로 필요하다 | [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) |
| CRUD p95 | 3계층 미확인 — 원본 목표 100 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-09 |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — BFF no-store · 페이지네이션 · 멱등
- [02_errors.md](./02_errors.md) — work_orders · common 미러
- [04_master.md](./04_master.md) — 라인 조회 · 새 태그 발급
- [../02_features/10_work_orders.md](../02_features/10_work_orders.md) — WRK-01~05 기능 정본
- [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) — REQ-WRK 계약
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 상태 머신 4
- [../08_screen/06_master_admin.md](../08_screen/06_master_admin.md) — ADM-WORKORDER · ADM-AUDIT 화면
