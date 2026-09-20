# 06_api / 07 휴가·연차 (LEV)

> **대상**: LEV 도메인 REST 표면 — 연차 발생과 원장 3단 구조 · 잔여 연차 조회 · 휴가 유형 · 신청과 예약 차감 · 승인과 반려 · **일괄 승인·반려** · 취소 · 관리자 재계산 · 연차미사용수당과 급여 연동
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **#3 신청 목록 항목에 사유 · 증빙 유무 · 신청자 잔여/예약(연차 차감 유형), #8 잔여 연차 목록에 입사일을 더한다.** 사용률 · 다음 발생 예정은 싣지 않는다 — 사용률은 전역 규칙이 전수 열거한 나눗셈 밖이고 발생 예정은 산정 규칙을 표면으로 여는 일이다. 표면 수 · 권한 불변
> **개정일**: 2026-09-16 — **#3 휴가 신청 목록 · #8 잔여 연차 목록에 q(직원명 부분 일치)를 더한다.** 길이 상한 · ESCAPE 규약은 [01_conventions.md](./01_conventions.md)가 정본이다. **표면 신설 없음 · 필터 필드 1종씩 추가**
> **개정일**: 2026-09-16 — **표면 15 → 17**(REST 13 → **15**) — 휴가 신청 **일괄 승인 #16 · 일괄 반려 #17**을 말미에 채번한다(웹의 행별 루프를 서버 한 번으로 · 멱등 필수 — 이 도메인의 첫 멱등 표면이다). 본문은 단건과 이름 · 규칙까지 같다(승인 comment 선택 · 반려 reason 필수). 행마다 단건 #6 · #7을 지나 각자 한 트랜잭션이고 부분 실패는 200의 행 결과다. 에러 코드 · action 코드 신설 0
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행에 **#6 · #7을 등재**하고 action 코드를 병기한다(누락 보정 — 계약 확장이 아니다). leave_request.approve · reject는 **원본 개방 목록부터 있던 코드**이고 #6 · #7이 각각 그 유일한 발생 표면인데 이 표가 두 표면을 적지 않았다. **넷 다 사유 필수가 아님**도 함께 표시했다(표기 규약 [01_conventions.md](./01_conventions.md)). **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-08-08 — 연차미사용수당 응답에 소멸(EXPIRE) 미정산분을 분리 표기하고 미사용 일수의 구성을 명문화 · 표면 이중 등재 설명에 대기 목록 조회 사례 추가
> **원천**: [../03_requirements/06_leave.md](../03_requirements/06_leave.md)(REQ-LEV-01~13) · [../02_features/05_leave.md](../02_features/05_leave.md)(LEV 5기능) · [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md)(REQ-CMP-06 스냅샷 차단) · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)(§1.2 나눗셈 8·9·10)

법정 연차유급휴가는 **5인 이상 사업장에만 적용된다**(근로기준법 §60). 그래서 이 도메인의 모든 조회 표면은 두 상태를 엄격히 구분해 응답한다 — **미적용**(5인 미만 · leave.not_applicable/403 · 정상 상태)과 **판정 불가**(스냅샷 없음 · leave.employee_count_snapshot_required/422 · 조치 가능)다. 이 둘을 하나로 뭉치면 사용자는 "우리 사업장은 연차가 없는 곳인가"와 "산정을 돌리면 되는가"를 구분할 수 없다.

**원장이 진실 원천이다.** 발생 · 원장(append-only) · 요약 잔액 3계층이며 요약은 언제든 원장에서 재계산할 수 있어야 한다. 조회 표면(#8 · #9)은 요약과 원장이 어긋나면 경고를 함께 반환하고 관리자 재계산 액션(#12)을 안내한다.

**신청 시점에 예약 차감을 건다**(#2). 확정 차감이 아니며 반려·취소 시 복원한다 — 예약 차감이 없으면 동시 신청 두 건이 같은 잔액을 보고 통과해 음수가 된다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 관리 표면은 /v1/workplaces/{workplaceId}/leave/…, 본인 잔액은 /v1/me/leave/balance다 |
| 권한 축 | STAFF(본인 신청 · 본인 취소 · 본인 잔액) · MANAGER(전원 조회 · 승인 · 반려 · 재계산). **본인 신청의 본인 승인은 차단**한다 |
| 5인 분기 | 적용 여부의 유일한 근거는 상시근로자 스냅샷이다. 미적용은 403, 스냅샷 부재는 422이며 **둘을 섞지 않는다** |
| 멱등 | **일괄 승인·반려(#16 · #17) 2표면**이 Idempotency-Key 필수다. 중복 신청은 기간 중복 검사가, 원장 중복 기록은 (발생 단위, 트랜잭션 유형, 참조) 제약이 막는다 |
| 잠금 | **연차 원장 동시 차감은 잔액 행 잠금으로 직렬화**한다(REQ-GLB-15). 예약 차감(#2)과 확정 기록(#6)이 같은 잠금을 공유한다 |
| 차감 순서 | **FIFO** — 먼저 발생한 단위부터 차감한다. 발생일이 같으면 발생 단위 id 오름차순으로 고정해 결정성을 보장한다 |
| 반올림 | 연차 일수는 leave_days 규칙(**0.1일 올림**)을 적용하고 응답에는 문자열로 싣는다. 출근율 80% 판정은 반올림 없이 정수 비교다 |
| 페이지네이션 | 오프셋 **4표면**(#3 · #8 · #10 · #11). 모집단이 사업장 인원 또는 직원별 이력이라 총 건수가 화면 요건이다 |
| 마감 연동 | 마감된 근태·급여 기간에 대한 신청·변경은 차단하거나 무급 전환을 안내한다 |
| v1 경계 | **연차 사용촉진 · 회계연도 일괄 산정 · 시간 단위 신청 · 사용자 정의 휴가 유형을 v1에 두지 않는다.** 관련 파라미터를 받는 표면이 없다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | GET /v1/workplaces/{workplaceId}/leave/types | STAFF | — | LEV-02 |
| 2 | REST | POST /v1/workplaces/{workplaceId}/leave/requests | STAFF | — | LEV-02 |
| 3 | REST | GET /v1/workplaces/{workplaceId}/leave/requests | STAFF · MANAGER | 오프셋 | LEV-02 · LEV-03 |
| 4 | REST | GET /v1/workplaces/{workplaceId}/leave/requests/{requestId} | STAFF · MANAGER | — | LEV-02 |
| 5 | REST | POST /v1/workplaces/{workplaceId}/leave/requests/{requestId}/cancel | 본인 · MANAGER | — | LEV-02 · LEV-03 |
| 6 | REST | POST /v1/workplaces/{workplaceId}/leave/requests/{requestId}/approve | MANAGER | — | LEV-03 |
| 7 | REST | POST /v1/workplaces/{workplaceId}/leave/requests/{requestId}/reject | MANAGER | — | LEV-03 |
| 8 | REST | GET /v1/workplaces/{workplaceId}/leave/balances | MANAGER | 오프셋 | LEV-04 |
| 9 | REST | GET /v1/me/leave/balance | 본인 | — | LEV-04 |
| 10 | REST | GET /v1/workplaces/{workplaceId}/leave/grants | STAFF · MANAGER | 오프셋 | LEV-01 |
| 11 | REST | GET /v1/workplaces/{workplaceId}/leave/ledger | STAFF · MANAGER | 오프셋 | LEV-01 · LEV-04 |
| 12 | REST | POST /v1/workplaces/{workplaceId}/leave/recompute | MANAGER | — | LEV-01 |
| 13 | REST | GET /v1/workplaces/{workplaceId}/leave/unused-compensation | MANAGER | — | LEV-06 |
| 14 | 서버 내부 | 정기작업 accrueAndExpireLeave(매일 00:40 KST) | 시스템 | — | LEV-01 |
| 15 | 서버 내부 | 급여 연동 — 유급/무급 휴가일 전달 | 시스템 | — | LEV-06 |
| 16 | REST | POST /v1/workplaces/{workplaceId}/leave/requests/bulk-approve | MANAGER · 멱등 | — | LEV-03 |
| 17 | REST | POST /v1/workplaces/{workplaceId}/leave/requests/bulk-reject | MANAGER · 멱등 | — | LEV-03 |

- 17행 = REST **15** · 서버 내부 **2**다. SSE·다운로드 표면은 없다.
- **#16 · #17은 말미 채번이다** — 흐름상 자리는 단건 승인·반려(#6 · #7) 옆이지만 번호를 밀지 않는다.
- STAFF와 MANAGER가 함께 쓰는 조회 표면(#3 · #4 · #10 · #11)은 **응답 범위가 역할로 갈린다** — STAFF는 본인 행만 받는다.

## 상세

### 1·2. 휴가 유형 조회·신청 (LEV-02)

```json
{
  "leaveTypeCode": "ANNUAL",
  "startDate": "2026-09-14",
  "endDate": "2026-09-15",
  "dayUnit": "FULL",
  "reason": "개인 사유",
  "evidenceDocumentId": null
}
```

```plain
① 유형·단위 검증           leaveTypeCode ∈ 시드 4종(연차 · 반차 · 병가 · 무급)
                          dayUnit ∈ FULL(1일) · HALF(0.5일 반차)
                          **시간 단위 신청은 v1 범위 밖**이라 값 집합에 없다
② 날짜 순서 검증           endDate < startDate → common.validation_failed/400
③ 5인 분기 판정            연차 유형일 때만 본다
                          스냅샷 없음 → leave.employee_count_snapshot_required/422
                          5인 미만    → leave.not_applicable/403
④ 기간 중복 검증           동일 직원의 기존 PENDING·APPROVED 휴가와 겹침 → leave.request_overlap/409
⑤ 마감 기간 검증           마감된 근태·급여 기간 → leave.period_closed/409 또는 무급 전환 안내
⑥ 잔액 행 잠금 → 예약 차감  FIFO로 필요 일수를 예약한다
                          부족 → leave.insufficient_balance/422 (details에 필요·보유 일수)
⑦ leave_requests INSERT(PENDING) · MANAGER에게 leave_requested 알림
```

- **예약 차감은 확정 차감이 아니다**(REQ-LEV-09). 원장에는 예약 상태로 기록하고 승인(#6) 시 USE로 확정하며 반려·취소 시 복원한다.
- #1은 사업장에 시드된 유형 세트를 돌려준다. **v1은 사용자 정의 유형을 두지 않으므로 유형 생성·수정 표면이 없다.**
- 무급 휴가와 병가는 ③의 5인 분기를 타지 않는다 — 법정 연차가 아니기 때문이다.

### 3·4·5. 신청 목록·상세·취소 (LEV-02 · LEV-03)

| 항목 | 3. 목록 | 4. 상세 | 5. 취소 |
|------|--------|--------|--------|
| 입력 | status · leaveTypeCode · employeeId · 기간 · **q**(직원명 부분 일치) · 오프셋 | — | reason(MANAGER 취소 시 필수) |
| 권한 | STAFF는 본인 요청만 · MANAGER는 전원 | 위와 동일 | **본인은 PENDING만** · MANAGER는 PENDING과 APPROVED |
| 응답 | 유형 · 기간 · 일수 · 상태 · 신청 시각 · 승인자 | 위 + 사유 · 증빙 · 원장 참조 | 204 |
| 전이 | — | — | PENDING → CANCELLED(예약 복원) · APPROVED → CANCELLED(확정 차감 복원) |
| 차단 | — | — | 마감 충돌 시 leave.period_closed/409 |

- APPROVED 취소는 **마감 미충돌과 차감 복원이 함께 가능할 때만** MANAGER가 수행한다(REQ-LEV-10). 마감된 기간의 휴가를 되돌리면 확정 급여의 입력이 사후에 바뀐다.
- 취소는 원장에 RESTORE 행을 쌓는다. **기존 USE 행을 지우지 않는다** — 원장은 append-only다.
- **#3 목록 항목은 사유(reason) · 증빙 유무(hasEvidence)와, 연차를 차감하는 유형이면 신청자의 사용 가능 잔여(balanceAvailableDays) · 예약 일수(balanceReservedDays)를 함께 싣는다** — 목록에서 승인 판단을 하려는 값이다. 잔액은 한 쪽의 신청자를 한 번에 읽고(파생 열 규약), 차감하지 않는 유형이거나 잔액 행이 없으면 비운다.

### 6·7. 휴가 승인·반려 (LEV-03)

| 항목 | 6. 승인 | 7. 반려 |
|------|--------|--------|
| 권한 | MANAGER | MANAGER |
| 입력 | comment(선택) | reason(필수) |
| 선행 판정 | ① **본인 신청의 본인 승인 차단** → leave.self_approval_forbidden/403 ② 마감 기간 충돌 → leave.period_closed/409 | ①만 적용한다 |
| 처리 | 잔액 행 잠금 → 예약 차감을 원장에 USE로 **확정 기록** → 근태 일자에 휴가 상태 반영(ON_LEAVE) → 급여 연동 전달(#15) → 요청 APPROVED 전이 → 알림 | 예약 차감 복원(RESTORE) → 요청 REJECTED 전이 → 알림 |
| 원자성 | 원장 확정 · 근태 반영 · 상태 전이가 **한 트랜잭션**이다 | 복원과 전이가 한 트랜잭션이다 |

- **승인된 휴가일은 결근으로 판정하지 않는다**(REQ-ATT-09). 근태 반영이 승인 트랜잭션 안에 있는 이유가 그것이며, 나뉘면 승인은 됐는데 그날이 결근으로 남는 구간이 생긴다.
- 유급 휴가일은 **주휴 개근 판정에서도 결근으로 보지 않는다**([08_payroll.md](./08_payroll.md)).

### 8·9. 잔여 연차 조회 (LEV-04)

```json
{
  "employeeId": "…",
  "applicability": "APPLICABLE",
  "asOf": "2026-08-03",
  "grantedDays": "15.0",
  "usedDays": "3.5",
  "reservedDays": "1.0",
  "remainingDays": "10.5",
  "expiringSoon": [ { "grantId": "…", "days": "2.0", "expiresOn": "2026-12-31" } ],
  "ledgerMismatch": false
}
```

| applicability | 의미 | 응답 |
|--------------|------|------|
| APPLICABLE | 5인 이상 · 스냅샷 존재 | 위 예시 그대로 |
| NOT_APPLICABLE | 5인 미만 — **정상 상태** | 잔액 필드 대신 미적용 사유를 담고 **leave.not_applicable/403**으로 응답한다 |
| UNDETERMINED | 기준일 스냅샷 부재 — **조치 가능** | **leave.employee_count_snapshot_required/422**로 응답하고 산정 실행 경로를 안내한다 |

- **ledgerMismatch가 참이면 요약과 원장이 어긋난 상태**다. 조회는 성공하되 경고를 반환하고 관리자 재계산(#12) 액션을 함께 준다(REQ-LEV-06).
- #8은 사업장 전원, #9는 본인 하나다. STAFF는 #9만 쓴다. #8의 목록 조회는 **q**(직원명 부분 일치) · asOf(선택) · 오프셋을 받는다.
- reservedDays가 예약 차감분이다. **remainingDays = grantedDays − usedDays − reservedDays**이며 이 식이 화면에 노출되는 유일한 계산이고 값은 전부 서버 산출이다.
- **#8 목록 항목은 입사일(hireDate)을 함께 싣는다** — 연차 발생의 기산일이라 1년 경계를 목록에서 본다.

### 10·11·12. 발생 이력·원장·재계산 (LEV-01 · LEV-04)

| 항목 | 10. 발생 이력 | 11. 원장 | 12. 재계산 |
|------|--------------|---------|-----------|
| 입력 | employeeId · 기간 · 오프셋 | employeeId · txType · 기간 · 오프셋 | employeeId(선택 · 생략 시 전원) · reason(필수) |
| 응답 | 발생일 · 만료일 · 발생 일수 · **산정 근거**(적용 규칙 · 계속근로연수 · 출근율 · 비례 산정 입력) | txType ∈ GRANT · USE · RESTORE · EXPIRE · ADJUST와 참조 · 일수 · 시각 · 행위자 | 재계산 결과 요약과 변경 건수 |
| 권한 | STAFF는 본인 · MANAGER는 전원 | 위와 동일 | MANAGER |
| 처리 | 읽기 전용 | 읽기 전용 · append-only | **원장에서 요약 잔액을 다시 계산**한다. 원장 자체를 고치지 않는다 |

연차 발생 산식(REQ-LEV-02)은 넷으로 갈리며 #10의 산정 근거가 어느 갈래인지 드러낸다.

```plain
기산일 = hire_date
├─ 입사 1년 미만            1개월 개근당 1일 · 최대 11일
├─ 1년간 출근율 80% 이상     15일
├─ 1년 이상 · 출근율 80% 미만  1개월 개근당 1일
└─ 3년 이상 계속근로         15 + floor((계속근로연수 − 1) ÷ 2) · 한도 25일
```

- **출근율 80% 판정은 반올림하지 않는다** — 출근일수 × 5 ≥ 소정근로일수 × 4 정수 비교다(REQ-LEV-03).
- **출근 간주 기간 5종**이 소정근로일수와 출근일수 양쪽에 포함된다 — 업무상 부상·질병 휴업 · 출산전후휴가 등 · 육아휴직 · **육아기 근로시간 단축분** · **임신기 근로시간 단축분**이다. 뒤 둘은 **2025-10-23 이후 기간에만 적용**하므로 #10의 산정 근거에 적용 기간 분기를 함께 담는다.
- 단시간근로자 비례 산정은 시간 = 통상 연차일수 × (단시간 주 소정 ÷ 통상 주 소정) × 8 → 일수 = 시간 ÷ 1일 소정근로시간이며 **중간 몫을 반올림하지 않고 최종 일수만 0.1일 올림**한다. 초단시간(주 15시간 미만)은 제외한다.
- **적재 이벤트는 ADJUST(source=IMPORT)로 남겨 자동 산정분과 구분한다.** 업로드 경로는 [04_workplace.md](./04_workplace.md)의 임포트 표면이며, 적재 없이 잔액이 0부터 시작하면 연차 계산이 처음부터 틀린다(REQ-LEV-07).
- #12는 **요약만** 다시 만든다. 원장이 진실 원천이므로 원장을 고치는 표면을 두지 않는다.

### 13. GET /v1/workplaces/{workplaceId}/leave/unused-compensation — 연차미사용수당 산출 (LEV-06)

| 항목 | 내용 |
|------|------|
| 입력 | employeeId(선택) · asOf 또는 settlementDate |
| 산식 | **연차미사용수당 = 미사용 일수 × 1일 통상임금**이며 1일 통상임금 = 통상시급 × 1일 소정근로시간이다. 반올림은 earning_item 올림 1원이다 |
| 미사용 일수 | **정산 기준일 잔여 + 촉진 미이행으로 소멸(EXPIRE)된 발생분 중 보상 미정산분**이다(REQ-LEV-12). 잔여만 세면 소멸분 보상이 통째로 빠져 임금 미지급이 된다 |
| 응답 | **미사용 일수를 두 항으로 분리 표기**한다 — remainingDays(기준일 잔여) · expiredUnsettledDays(소멸 미정산분) · 그 합인 compensableDays. 여기에 통상시급 · 1일 소정근로시간 · 산출 금액(문자열) · **촉진 미지원 표기**를 함께 담는다 |
| 5인 미만 | **법정 미발생 기간은 산출하지 않는다.** 해당 구간을 응답에서 제외하고 사유를 담는다 |
| 촉진 표기 | **v1은 연차 사용촉진을 지원하지 않으므로 보상 의무 면제를 적용할 수 없다.** 미사용 연차는 항상 보상 대상으로 계산하고 촉진 미지원 사실을 결과에 표기한다(REQ-LEV-12) |
| 소비처 | 퇴사 정산과 급여 항목 라인이며 확정 계산의 정본은 [08_payroll.md](./08_payroll.md)다. **이 표면은 조회 전용이고 확정하지 않는다** |

### 14·15. 서버 내부 종점 2종 (LEV-01 · LEV-06)

| 항목 | 14. accrueAndExpireLeave (배치) | 15. 급여 연동 전달 (서버) |
|------|--------------------------------|--------------------------|
| 실행 | 매일 00:40 KST · 분산락 · 멱등 · 기준일 파라미터 | #6 승인 트랜잭션과 급여 계산 진입 시점의 동기 처리 |
| 동작 | 입사일 기준 발생 조건을 판정해 원장에 GRANT 행을 쌓고, 만료일이 지난 미사용 잔량을 EXPIRE 행으로 소멸시킨다 | 승인된 **유급 휴가는 근로일·유급일 계산에 포함**하고 **무급 휴가와 결근은 공제 후보로 전달**한다 |
| 순서 | **recomputeEmployeeCountSnapshot(02:20) 이후가 아니라 이전 시각(00:40)에 놓인다** — 5인 미만 기간은 산정하지 않고 스냅샷이 없으면 발생을 차단하므로, 전일 기준 스냅샷을 읽어 판정하고 당일 스냅샷을 기다리지 않는다 | 급여 계산은 마감된 근태와 승인 휴가를 함께 읽는다 |
| 요약 갱신 | **요약 잔액은 원장에서 재계산한다.** 요약만 고치는 경로를 두지 않는다 | — |
| 표면 없음 근거 | 사용자가 요청할 일이 아니다. 관리자의 정정 요구는 #12가 받는다 | 값의 전달이지 사용자 행위가 아니다. 공제 확정은 급여 표면이 한다 |
| v1 경계 | **연차 사용촉진 판정은 v1에 없다.** 촉진 관련 상태를 만들지 않는다 | 무급 공제 산식의 정본은 [08_payroll.md](./08_payroll.md)다 |

### 16·17. 휴가 신청 일괄 승인·반려 (LEV-03)

| 항목 | 16. 일괄 승인 | 17. 일괄 반려 |
|------|-------------|-------------|
| 권한 | MANAGER · **멱등** | MANAGER · **멱등** |
| 입력 | requestIds(1~200 · 중복 불가) · comment(**선택** — 단건 #6과 같은 이름 · 같은 규칙) | requestIds(1~200 · 중복 불가) · reason(**필수** — 단건 #7과 같다) |
| 행 처리 | **#6과 같은 계약** — 본인 승인 차단 · 마감 기간 · 잔액 행 잠금 · 원장 USE 확정 · 근태 반영 · 감사 · 알림 | **#7과 같은 계약** — 본인 승인 차단 · 예약 복원 · 감사 · 알림 |
| 응답 | 200 · total · succeeded · failed · results[requestId · outcome(SUCCEEDED · FAILED) · code · message] — 요청 순서 | 상동 |
| 실패(요청 전체) | common.validation_failed/400 · auth.workplace_forbidden/403 · 멱등 키 충돌 common.conflict/409 | 상동 |

- **계약의 정본은 근태 일괄([06_attendance.md](./06_attendance.md) #28 · #29)과 같은 축이다** — 행마다 독립 트랜잭션 · 부분 실패는 200의 행 결과 · 행 code는 단건이 냈을 코드 그대로 · 인가는 요청 전체 1회 + 행마다 재판정 · 멱등 필수 · 분류되지 않은 실패는 code를 비운다.
- **한 트랜잭션으로 묶지 않는다** — 묶으면 한 행의 실패(마감 기간 · 본인 승인)가 앞선 성공 행의 원장 USE 확정과 근태 반영까지 되돌린다.
- **본문 필드는 단건과 이름까지 같다.** 승인은 comment, 반려는 reason이다 — 일괄과 단건이 다른 이름을 쓰면 클라이언트가 같은 값을 두 이름으로 들고 있어야 한다. 한 값이 모든 행에 같이 남는다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| leave.not_applicable | 403 | 5인 미만 기간의 법정 연차 미적용 — **정상 상태**이며 조치 대상이 아니다 | #2 · #8 · #9 · #10 · #13 |
| leave.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재로 적용 여부 판정 불가 — **조치 가능** | #2 · #8 · #9 · #10 · #12 · #13 |
| leave.request_overlap | 409 | 동일 직원의 휴가 기간 중복 신청 | #2 |
| leave.insufficient_balance | 422 | 예약 차감 시점 잔액 부족 — details에 필요·보유 일수를 담는다 | #2 |
| leave.period_closed | 409 | 마감된 근태·급여 기간에 대한 신청·변경·승인·취소 | #2 · #5 · #6 · #16(행 결과) |
| leave.self_approval_forbidden | 403 | 본인 신청의 본인 승인 시도 | #6 · #7 · #16 · #17(행 결과) |
| common.not_found | 404 | 휴가 신청·발생 단위 부재 또는 존재 은닉 | #4 · #5 · #6 · #7 |
| common.conflict | 409 | 이미 응답된 신청의 재승인·재반려 등 도메인 전용 코드가 없는 상태 충돌 · **같은 멱등키 + 다른 본문** | #5 · #6 · #7 · #16 · #17 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 · 날짜 순서 역전 | 전 REST 표면 |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 | 전 사업장 스코프 표면 |

- **leave 6종 전량이 이 표에 있다.**
- **403(미적용)과 422(전제 미충족)의 구분이 이 도메인의 핵심 규약**이다(REQ-GLB-19). 하나로 뭉치면 사용자가 "우리는 대상이 아니다"와 "산정을 돌리면 된다"를 구분할 수 없다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| leave_types | #1 SELECT | 휴가 유형 시드 세트 — 연차 · 반차 · 병가 · 무급. **v1은 사용자 정의 유형을 두지 않는다** |
| leave_grants | #10 SELECT · #14 INSERT | 발생 단위 — 발생일 · 만료일 · 발생 일수 · 산정 근거 |
| leave_requests | #2 INSERT · #3 · #4 SELECT · #5 · #6 · #7 · #16 · #17 UPDATE | 휴가 신청 — 유형 · 기간 · 사유 · 증빙 · 상태 |
| leave_transactions | #2 · #5 · #6 · #7 · #14 · #16 · #17 INSERT · #11 SELECT | 연차 원장 — **append-only** · GRANT · USE · RESTORE · EXPIRE · ADJUST · FIFO 차감 |
| leave_balances | #2 · #6 · #7 · #16 · #17 잠금·UPDATE · #8 · #9 SELECT · #12 재계산 | 요약 잔액 — 역정규화. **원장에서 재계산 가능해야 한다** |
| attendance_daily_summaries | #6 · #16 UPDATE · #10 SELECT | 승인 휴가일의 ON_LEAVE 반영 대상이자 출근율·개근 판정의 입력(마감된 근태 결과) |
| workplace_employee_count_snapshots | #2 · #8 · #9 · #10 · #13 · #14 SELECT | 5인 분기 판정 근거. 없으면 발생을 차단한다 |
| employment_terms | #10 · #13 SELECT | 단시간 비례 산정과 1일 소정근로시간의 입력 |
| statutory_rates | #10 · #13 SELECT | HOLIDAY_CALENDAR · ROUNDING_POLICY(leave_days) 조회 |
| payroll_employee_results | #13 SELECT | 통상시급 조회 — 확정 결과에 동결된 값을 쓴다 |
| notifications | #2 · #6 · #7 · #16 · #17 INSERT | leave_requested · leave_approved · leave_rejected |
| audit_logs | #5(MANAGER 취소) · **#6** · **#7** · #12 · #16 · #17 INSERT | 승인 **leave_request.approve**(#6 · **#16은 성공 행마다**) · 반려 **leave_request.reject**(#7 · **#17은 성공 행마다**) · MANAGER 승인 취소(#5)와 연차 재계산(#12)의 기록. **넷 다 사유 필수가 아니다** — 사유 필수 액션 전수는 [../05_database/15_system.md](../05_database/15_system.md)가 정본이고 휴가 축은 그 목록에 없다. action 코드의 채번 정본도 같은 문서이며 **여기서 신설하지 않는다**(표기 규약 [01_conventions.md](./01_conventions.md) 연동 테이블의 코드 표기) |

## 추적성

기능명·우선순위의 정본은 [../02_features/05_leave.md](../02_features/05_leave.md)다.

| 기능ID | 표면 |
|--------|------|
| LEV-01 연차 자동 산정 | #10 · #11 · #12 · #14(배치) |
| LEV-02 휴가 신청 | #1 · #2 · #3 · #4 · #5 |
| LEV-03 휴가 승인 | #3(대기 목록 조회) · #5 · #6 · #7 · **#16 · #17**(일괄) |
| LEV-04 잔여 연차 조회 | #8 · #9 · #11 |
| LEV-06 급여 연동 | #13 · #15(서버) |

**LEV 5기능 전수를 담았다**(위 표 5행). 세 표면이 두 기능에 걸쳐 등재된다 — **#3**은 신청자의 목록 조회와 승인자의 대기 목록 조회 두 축을 함께 지므로 LEV-02와 LEV-03 양쪽에, **#5**는 신청자 취소와 관리자 취소 두 축을 함께 지므로 LEV-02와 LEV-03 양쪽에, **#11**은 발생 이력과 잔액 검증 양쪽에 쓰이므로 LEV-01과 LEV-04 양쪽에 등재한다.

## 관련 문서

- 전역 규약·오프셋 페이지네이션·금액과 일수 직렬화 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/05_leave.md](../02_features/05_leave.md) · 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 요구사항 정본 → [../03_requirements/06_leave.md](../03_requirements/06_leave.md) · 나눗셈 8·9·10 지점 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 출근율 입력·휴가일 결근 미판정 → [06_attendance.md](./06_attendance.md) · 무급 공제·연차미사용수당 확정 → [08_payroll.md](./08_payroll.md) · 스냅샷 → [11_compliance.md](./11_compliance.md) · 기초값 적재 → [04_workplace.md](./04_workplace.md)
- 테이블 명세 → [../05_database/05_leave.md](../05_database/05_leave.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
