# 06_api / 08 급여 (PAY)

> **대상**: PAY 도메인 REST 표면 — 급여 항목 카탈로그와 비과세 · 급여 기준 이력과 통상시급 · 미리보기 · 계산 실행과 재계산 · 법정수당과 4대보험과 소득세 결과 · 최저임금 검증 · 확정과 무효화와 정정본 · 임금대장 · 급여 이력 · **인건비 추이(DSH-03)** · 퇴직금 판정과 개산액 · 금품청산 기한
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **표면 29 → 30**(REST 27 → **28**) — **DSH-03 인건비 추이**(D-23 · 영구 제외 해제)의 **#30 GET /v1/workplaces/{workplaceId}/payroll/labor-cost-trend**를 말미에 채번한다(범위 조회 · 36개월 · MANAGER). 모집단은 CONFIRMED 실행(정정 체인 원본은 VOIDED라 정정본만) · REGULAR + IMPORT 합산 · 사업주 부담분이 하나라도 비면 부담분과 인건비는 null(0 대체 금지) · 확정 급여가 없는 달은 항목 없음. 페이지네이션 범위 조회 2 → **3** · 추적성 **14행**. 에러 코드 신설 0
> **개정일**: 2026-09-12 — 감사 정정 넷. ① **#16 선점검이 점검 항목을 응답에 담는다**(`checks` 배열 5항목 전건 · `blockers[].check`) — 문서가 #16을 「집합의 정본」으로 못 박았는데 **응답에 항목이 없어 화면이 #15의 checkType 8축을 묶어 목록을 스스로 만들었고**, 그래서 정본이 정한 집합(다섯)과 화면이 그리는 집합(여덟)이 갈렸다(2026-09-11 실측). 함께 **blockers.reason 값 집합에 정본이 없다는 미결을 닫는다** — 축은 둘이며 `check`(점검 항목 5종 · 모든 사유가 갖는다)와 `checkType`(검증 8축 · 검증 결과 행에서 온 사유만)이다. ② **#16 confirmable이 역할을 반영한다** — 자기포함 런의 MANAGER 조회에 `confirmable: true · requiresOwner: true`가 함께 나갔고 **화면이 따로 잠가 사고가 나지 않았을 뿐**이라, 계약이 화면의 추가 판정에 의존하던 자리다. ③ **#16·#17이 급여월 축으로 중복 확정을 막는다** — 가드가 원본만 보아(`supersedes_id IS NULL`) **정정본이 선 급여월에 새 원본 실행이 서서 함께 확정됐다**(급여 이력·명세서가 직원당 2건). 유일성의 축은 급여월이고 원본·정정본을 통틀어 1건이다. ④ **#21 내보내기에 사유를 필수로 두고 `document.download_sensitive` 감사를 붙인다** — 산출물이 민감 분류인데 사유도 감사도 없었고, 같은 분류인 명세서 관리자 다운로드(09_payslip #11)와 근로자명부는 둘 다 요구한다(REQ-NFR-15). 함께 **#11~#14 예시의 기본급 `rule` 값 모양을 실형에 맞춘다**(토큰 + 산식 문안 — 다른 라인이 전부 법조문 문안이라 토큰만으로는 계산기초를 설명하지 못한다). **표면 수 29 · 번호 · 권한 · 에러 코드는 전건 불변** — 응답 필드 추가와 사유 필수화는 v1 안의 변경이다
> **개정일**: 2026-09-10 — **#28의 어긋남을 닫고 DUE_SOON 임계의 정본을 잇는다** — 매퍼 파생식(COMPLETED · OVERDUE · UPCOMING)을 걷고 열린 과제만 날짜로 내며 파생·필터는 서비스가 DueStateCalc로 한다 · 임계일수는 기준값 due_soon_window(3일 · 사용자 확정 2026-09-10 · 정본 [11_compliance.md](./11_compliance.md))에서 읽고 없으면 422. 와이어 변화 둘 — status에 DUE_SOON이 처음 실리고 COMPLETED는 실리지 않는다. **표면 수 · 번호 · 에러 코드 종수 전건 불변**
> **개정일**: 2026-09-10 — **#9 · #10의 근태 미마감 차단이 실행 단위임을 명시한다** — 정본이 셋(#9 · #10 · #17)에 같은 차단을 규정하는데 **구현이 #9에서만 직원별 사유로 모아 실행을 CALCULATED로 세웠다**(2026-09-10 웹 실측 — 250명 전원 미마감인데 실행이 대상 0명 · 총액 0원으로 서서 목록에서 계산이 끝난 실행과 구분되지 않았다). ① **미마감 요청은 payroll_runs 행을 남기지 않는다** ② **판정 순서**(대상 상태 → 근태 마감 → 실행 확보 → 직원별 차단)를 대조표에 등재한다 — 확정본 재계산은 근태가 풀려 있어도 payroll.already_confirmed/409다 ③ **결과가 0건이면 CALCULATED로 전이하지 않는다**(DRAFT로 남는다) ④ **ATTENDANCE_CLOSING 축은 검증 결과에 통과 행으로만 남고** 계산 후 마감이 풀린 경우는 #16이 실시간 판정으로 낸다. **표면 수 29 · 번호 · 권한 · 에러 코드는 전건 불변** — 같은 코드를 같은 조건에 내되 판정 자리를 옮긴다
> **개정일**: 2026-09-10 — **#11 실행 목록의 허용 정렬 축을 등재하고 넷을 넓힌다**(payPeriod · payDate에 **status · totalNet · employeeCount · confirmedAt**) — 목록 열이 여섯인데 정렬 축이 둘이라 **나머지 열의 머리를 누르면 common.validation_failed/400**이었다. 함께 **status 정렬이 상태 진행 순서**임과 **NULLS LAST를 양방향에 건다**는 것을 적는다(널 허용이 totalNet · confirmedAt 둘이고, 확정 시각 내림차순의 첫 쪽이 미확정 실행으로 덮이면 그 정렬이 답하려던 질문이 사라진다). **표면 수 29 · 번호 · 권한 · 에러 코드는 전건 불변** — 정렬 축은 선택 파라미터의 허용 목록이라 표면을 늘리지 않는다
> **개정일**: 2026-09-10 — **#28 금품청산 목록의 응답 계약을 등재한다** — 종전이 산문 한 줄("퇴사자별 퇴직일+14일 마감시계와 체크리스트")뿐이라 **웹이 필드명과 값 집합을 추측했고 실제로 어긋났다**. 예시 JSON 한 블록 + 필드 표(taskId · employeeId · employeeName · resignationDate · dueDate · **remainingDays 정수 · 음수면 경과** · status · checklist[item · settled · note])와 함께 ① **status는 과제 상태가 아니라 dueState 3값**(UPCOMING · DUE_SOON · OVERDUE)이고 **목록은 열린 과제만 담는다** ② **완료·면제 전이는 이 표면이 아니라 [11_compliance.md](./11_compliance.md) #14 · #15** ③ **체크리스트 키가 층마다 다르다**(저장 done · 응답 settled — 이 자리가 실제로 어긋나 전 항목이 미완료로 보였다) ④ **쪽 나눔 없는 items 봉투**임을 등재한다. 함께 **서버가 아직 dueState를 내지 않는 것을 어긋남으로 등재**한다(매퍼가 COMPLETED · OVERDUE · UPCOMING을 내고 DUE_SOON 분기가 없으며 WAIVED가 걸러지지 않는다 — **정본은 계약이고 어긋난 쪽은 구현**이다). **표면 수 · 번호 · 권한 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-10 — **#17 확정의 원천세 과제 부수효과를 계약으로 채운다** — 신고 단위 축이 **귀속월이 아니라 지급월**임(익월 지급 사업장의 7월 귀속분은 8월분 신고)과 멱등 축(월별 = 지급월 · 반기 = 그 지급월이 드는 반기 — **반기인데 월을 축으로 쓰면 한 신고에 여섯 행이 생긴다**) · **정정 재확정이 행을 늘리지 않음** · **employee_id 널이 이 유형뿐임**을 등재하고, **기한 기준값 부재를 실패 목록과 에러 표에 등재**한다(payroll.missing_reference_value/422 · **details = [{category, key}]**). 함께 severance_assessments 행에 **퇴사 확정 트랜잭션도 같은 행을 만든다**는 것과 그쪽의 부재 처분이 **차단이 아니라 사유 표기**임을 잇는다. **표면 수 · 번호 · 권한 · 에러 코드 종수는 전건 불변**
> **개정일**: 2026-09-10 — 정합 둘. ① **#15 검사 축 checkType 7 → 8종** — NONTAX_ELIGIBILITY(WARN 전용)를 [../05_database/06_payroll.md](../05_database/06_payroll.md)가 2026-09-09에 채번했는데 이 미러가 따라오지 않았다. ② **#16 선점검 예시의 blockers 축을 실형에 맞춘다** — 항목은 code · checkType · employeeId · message · detail이며 예시가 쓰던 reason · period · shortfall · baseDate는 어느 계약에도 없던 이름이다. **차단의 상세(미달 금액 · 기준값 · 산입 목록)는 #15 검증 결과가 갖고 선점검은 "무엇이 막는가"만 답한다** — detail은 비어 있는 것이 정상이다. requiresOwner · warnings도 예시에 등재한다(자기포함 확정의 OWNER 전용 판정 · acknowledgedWarnings의 대상). **표면 수 · 번호 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-10 — #7 통상시급 산출의 **월액 응답에 반올림 키를 잇는다**(**ordinary_monthly_wage 올림 1원** · 채번 정본 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.1 · §1.2 #18). **소수가 생기는 것은 divisor를 곱하는 시급제·일급제뿐**이라 그 전에는 키 없이도 정수로 떨어졌고, **월액이 금액 문자열이라 소수부를 담을 자리가 없다는 것이 드러나지 않았다.** **표면 · 입력 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-09 — **정지·폐쇄 사업장의 급여 쓰기 차단을 계약으로 등재**한다(workplace.closed/409 · #9 · #10 · #17 · #18 · #19). **네 층 어디에서도 막히지 않던 자리**이며(서비스 · 선점검 · 정책 · 가드), 막히지 않으면 **REQ-WRK-08이 정지 알림을 필수로 두는 근거("사업장이 멈추면 근태·급여가 함께 멈춘다")가 거짓이 된다.** **코드를 신설하지 않고 인용한다** — 정의가 이미 "SUSPENDED·CLOSED 사업장의 업무 진입"이라 급여 쓰기가 그 안에 들며, **정지와 폐쇄를 가르지도 않는다**(헬퍼가 둘을 같은 축으로 판정하고 사업주의 조치도 같다). **에러 코드 119종 · 표면 수 29 · 번호는 전건 불변**
> **개정일**: 2026-09-09 — #5 · #6에 **고정수당·비과세 항목 코드의 카탈로그 대조를 계약으로 등재**한다(활성 실재 · 비과세 코드 일치 2축). 고정수당이 jsonb 배열 원소라 **FK를 걸 수 없고 조인이 문자열 비교**이므로, 이 대조가 없으면 결과 라인이 아무 것도 가리키지 않거나 연 한도 누계가 다른 항목으로 집계된다. 강제 위치의 정본은 [../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md) 한계 등재이며 **서비스 단독·DB 백스톱 없음**이다. **막는 것은 쓰기 시점까지**이고 확정 후 카탈로그 개명은 결과 라인 동결 미결이 담는다 — **두 축을 한 사실로 읽지 않는다.** **표면 수 29 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-09-09 — 임금대장 생성 문서의 **민감 분류를 명시**한다 — employee_id 없는 사업장 단위 산출물이라 전 직원 임금이 한 파일에 모이고, **마스킹 대상은 주민번호 하나뿐**이라 임금은 평문으로 남는다. 판정 기준의 정본은 [../05_database/03_hr.md](../05_database/03_hr.md)이고 근로자명부와 같은 분류다. **표면 수 29 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-09-08 — **blockers.reason의 값 집합에 정본이 없음을 미결로 등재**한다 — 예시 셋 · 점검 항목 다섯 · 화면 차단 넷으로 **세 집합이 갈리고 예시가 전수인지 판정할 근거가 없다.** **근태의 마감 차단 사유 6종은 닫힌 집합으로 규정돼 있어**(REQ-ATT-18) **같은 봉투를 쓰는 두 표면이 다른 규율을 갖는 상태**다. 값 집합을 여기서 채번하지 않고 등재만 한다. 표면 수·계약은 전건 불변
> **개정일**: 2026-09-08 — #16 점검 항목 행이 **집합의 정본임을 명시**하고 **여기 없는 항목을 응답에 담지 않는다**를 더한다 — 같은 다섯을 화면 문서가 다시 세고 있어 한쪽만 고쳐질 수 있는 형태였고(화면 쪽 열거를 걷어 이 문서를 가리키게 했다), 실제로 구현이 **문서에 없는 항목 하나를 응답에 만들었다.** 항목 수·표면 번호·계약은 전건 불변
> **개정일**: 2026-09-08 — **급여는 8버킷을 다시 분해하지 않는다**를 금지 서술로 등재한다. 연동 표가 버킷을 "받는다"고만 적어 **데이터의 출처는 말하되 다시 계산하지 말라고는 말하지 않던** 자리이며, 실측에서 **두 구현이 같은 근태에 다른 버킷을 냈다.** 근거를 함께 적었다 — **성능이 아니라 갈림** · **미리보기 경로에도 적용**(마감은 동결일 뿐이다) · **계산 계층 일반의 규칙으로 올리지 않는다**(급여는 통상시급을 여러 항목에서 다시 쓴다) · **분해는 순수 함수 계층이라 ArchUnit도 트리거도 걸리지 않아 금지 서술이 유일한 강제 지점**이다. 표면 수 · 번호 · 배수 표는 전건 불변
> **개정일**: 2026-08-09 — 커버리지 감사 반영 — 항목 라인 응답을 **실근로 라인 + 가산 라인 분리**로 정정(premiumRate = 가산 배수 · 5인 미만은 가산 라인 미생성) · 무급공제를 **공제 라인**으로 명시하고 grossPay·지급 확정액 축 분리 · 세액표 버전 선택 축을 **직원별 지급일**로 정정 · 세액표 조회 축 명칭을 월 급여액으로 통일 · 재계산 시 항목 라인·검증 결과 교체 명시
> **개정일**: 2026-08-08 — 간이세액표 조회를 2축 + 자녀 수 후처리 차감으로 정정 · 장기요양보험료 산식을 단일 문장으로 통일 · 급여 항목에 minWageIncluded·nontaxCode, 급여 기준에 monthlyIncludesWeeklyHoliday 추가 · 근로조건·보험 정보 부재의 차단 코드 명시 · 미리보기 경고의 유일 출처를 응답 warnings로 고정 · 확정 부수효과에 원천세 과제 생성 등재
> **개정일**: 2026-08-03 — 보육수당 자녀 1인당 · divisor 209 · 재포함 3계열 · 장기요양 base · 산입범위 전액 산입 확정 반영(5곳)
> **원천**: [../03_requirements/07_payroll.md](../03_requirements/07_payroll.md)(REQ-PAY-01~35 · 버킷별 지급배수 · 보험별 base) · [../02_features/06_payroll.md](../02_features/06_payroll.md)(PAY 13기능 · **DSH-03** · D-23) · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)(§1.1~§1.4) · [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md)(8버킷) · 확정 결정 D-16 · D-17

급여 계산은 **서버 전용 · 룰 기반 · 결정론**이다. 그래서 이 도메인의 표면은 셋으로 나뉜다 — **입력을 채우는 표면**(#1~#7 · #27) · **계산하고 검증하는 표면**(#8~#15) · **확정하고 되돌리는 표면**(#16~#19)이다. 계산 자체를 요청 본문으로 조종하는 파라미터는 어디에도 없다.

**클라이언트가 계산한 값을 받지 않는다**([01_conventions.md](./01_conventions.md)). 근로시간 · 통상시급 · 수당 · 공제액 · 실수령액은 전부 서버 산출값이며 요청 본문에 그런 필드를 두지 않는다. 금액은 JSON 문자열로 직렬화한다 — bigint를 number로 실으면 정밀도가 조용히 깨진다(REQ-GLB-02).

**확정은 값을 결과에 동결한다**(D-17). 기준값 행 식별자와 실제 값 · 상시근로자 스냅샷 · 규모 정책 버전 · 통상임금 규칙 버전이 결과에 박히므로, 기준값을 나중에 정정해도 과거 확정 결과는 변하지 않는다. **확정 결과를 덮어쓰는 표면은 없다** — 정정은 무효화(#18) 후 정정본 생성(#19) 체인으로만 한다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 관리 표면은 /v1/workplaces/{workplaceId}/…, 본인 급여 이력은 /v1/me/payroll-history다 |
| 권한 축 | STAFF(본인 급여 이력만) · MANAGER(기준 설정 · 계산 · 확정 · 대장 · 퇴직금) · **OWNER 전용 3갈래**(무효화 · 정정본 생성 · **자기포함 런의 확정**) |
| 자기거래 통제 | 본인이 대상자로 포함된 급여의 확정은 **OWNER만 할 수 있다**. #16이 selfIncluded를 미리 알리고 #17이 역할을 강제하며, MANAGER 시도는 auth.workplace_forbidden/403이다. 자기포함 사실은 결과에 **동결**하고 감사 로그에 남긴다(REQ-GLB-16 · REQ-PAY-27) |
| 멱등 | 확정(#17)과 정정본 생성(#19) **2표면**이 Idempotency-Key 필수다. 원본 급여의 **(workplace_id, pay_period, source)** 고유 제약이 2차 방어다 |
| 잠금 | ① 같은 (workplace_id, pay_period)의 동시 확정을 직렬화한다 ② **확정 진행 중에는 해당 기간의 근태·인사·휴가 수정을 잠근다**(REQ-GLB-15) |
| 금액 직렬화 | 금액·비율·환산시급은 **JSON 문자열**이다. 시간은 정수 분이다 |
| 반올림 | 항목별 최종 금액에서 **1회만** 적용한다. 항목 합계를 다시 반올림하지 않는다(§1.1) |
| 차단과 경고 | 계산 실행(#9)은 차단하고 **미리보기(#8)는 같은 조건을 경고로만 표시**한다. 미리보기 결과는 잠금·명세서·임금대장에 쓰지 않는다 |
| 검증 대기 | 사업장이 PENDING_VERIFICATION이면 **확정만** 막는다 — workplace.verification_pending/409. 계산·미리보기는 열려 있다 |
| 페이지네이션 | 오프셋 3표면(#4 · #11 · #13) · 범위 조회 **3표면**(#23 · #24 · **#30**). 급여 이력과 인건비 추이는 월 단위 범위라 스스로 상한(36개월)을 갖는다 |
| 감사 | 확정 · 무효화 · 정정 · 최저임금 미달 강행 확정 · 기준값 적용 예외는 **사유 필수 감사 대상**이다(REQ-GLB-17) |
| 상태 전이 | DRAFT → CALCULATED → CONFIRMED · CALCULATED → CALCULATED(재계산) · CONFIRMED → VOIDED(+ 정정본 신규). **CONFIRMED는 CALCULATED로 되돌리지 않는다** |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | GET /v1/workplaces/{workplaceId}/pay-items | MANAGER | — | PAY-01 · PAY-13 |
| 2 | REST | POST /v1/workplaces/{workplaceId}/pay-items | MANAGER | — | PAY-01 |
| 3 | REST | PATCH /v1/workplaces/{workplaceId}/pay-items/{payItemId} | MANAGER | — | PAY-01 |
| 4 | REST | GET /v1/workplaces/{workplaceId}/employees/{employeeId}/payroll-terms | MANAGER | 오프셋 | PAY-01 |
| 5 | REST | POST /v1/workplaces/{workplaceId}/employees/{employeeId}/payroll-terms | MANAGER | — | PAY-01 |
| 6 | REST | PATCH /v1/workplaces/{workplaceId}/employees/{employeeId}/payroll-terms/{termId} | MANAGER | — | PAY-01 |
| 7 | REST | GET /v1/workplaces/{workplaceId}/employees/{employeeId}/ordinary-wage | MANAGER | — | PAY-01 |
| 8 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/preview | MANAGER | — | PAY-07 |
| 9 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs | MANAGER | — | PAY-02 · PAY-03 · PAY-04 · PAY-05 |
| 10 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/recalculate | MANAGER | — | PAY-02 · PAY-03 · PAY-04 · PAY-05 |
| 11 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs | MANAGER | 오프셋 | PAY-08 |
| 12 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId} | MANAGER | — | PAY-02 · PAY-08 |
| 13 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/employees | MANAGER | 오프셋 | PAY-03 |
| 14 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/employees/{employeeId} | MANAGER | — | PAY-03 · PAY-04 · PAY-05 |
| 15 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/validations | MANAGER | — | PAY-06 |
| 16 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/confirm-preflight | MANAGER | — | PAY-08 |
| 17 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/confirm | MANAGER(자기포함은 OWNER) · 멱등 | — | PAY-08 |
| 18 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/void | OWNER | — | PAY-08 |
| 19 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/corrections | OWNER · 멱등 | — | PAY-08 |
| 20 | REST | GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/wage-ledger | MANAGER | — | PAY-09 |
| 21 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/wage-ledger/export-token | MANAGER | — | PAY-09 |
| 22 | 다운로드 | GET /v1/payroll/wage-ledgers/download/{token} | 토큰 소유자 | — | PAY-09 |
| 23 | REST | GET /v1/workplaces/{workplaceId}/payroll/history | MANAGER | 범위 조회 | PAY-10 |
| 24 | REST | GET /v1/me/payroll-history | 본인 | 범위 조회 | PAY-10 |
| 25 | REST | GET /v1/workplaces/{workplaceId}/employees/{employeeId}/severance | MANAGER | — | PAY-11 |
| 26 | REST | POST /v1/workplaces/{workplaceId}/employees/{employeeId}/severance/assess | MANAGER | — | PAY-11 |
| 27 | REST | GET /v1/workplaces/{workplaceId}/pay-items/nontax-limits | MANAGER | — | PAY-13 |
| 28 | REST | GET /v1/workplaces/{workplaceId}/payroll/wage-settlements | MANAGER | — | PAY-19 |
| 29 | 서버 내부 | 정기작업 checkComplianceDeadlines(매일 08:30 KST) — **참조**(소유 [10_tax.md](./10_tax.md)) | 시스템 | — | PAY-19 |
| 30 | REST | GET /v1/workplaces/{workplaceId}/payroll/labor-cost-trend | MANAGER | 범위 조회 | DSH-03 |

- 30행 = REST **28** · 다운로드 **1** · 서버 내부 **1**이다. **#30은 말미 채번이다** — 흐름상 자리는 급여 이력(#23) 옆이지만 번호를 밀지 않는다. 서버 내부 1행은 다른 문서 소유 표면의 참조다.
- **일용직(DAILY) 급여 계산은 v1 범위 밖**이다. #9는 고용형태가 DAILY인 직원을 계산 대상에서 제외하고 사유를 결과에 담는다 — 일용 분리과세·소액부징수를 구현하지 않은 채 상용 로직으로 계산하면 세액이 틀린다.

## 상세

### 1·2·3·27. 급여 항목 카탈로그·비과세 한도 (PAY-01 · PAY-13)

```json
{
  "code": "MEAL_ALLOWANCE",
  "name": "식대",
  "type": "EARNING",
  "calcMethod": "FIXED",
  "taxable": false,
  "includeInOrdinaryWage": true,
  "minWageIncluded": false,
  "nontaxCode": "…",
  "nontaxLimit": "200000",
  "sortOrder": 30
}
```

| 항목 | 규칙 |
|------|------|
| 네 축 분리 | **taxable(소득세 과세) · includeInOrdinaryWage(통상임금 산입) · minWageIncluded(최저임금 산입) · 4대보험 보수 포함 여부는 서로 다른 축**이다. 하나의 불리언으로 겸용하지 않는다(REQ-PAY-01) |
| 필드 집합 | #2 요청과 #1 · #3 응답은 code · name · type · calcMethod · taxable · includeInOrdinaryWage · **minWageIncluded** · **nontaxCode** · nontaxLimit · sortOrder를 갖는다. minWageIncluded는 MIN_WAGE_SCOPE 기준값과 함께 최저임금 산입을 판정하고, nontaxCode는 NONTAX_LIMIT·INSURANCE_WAGE_BASE_SCOPE 조회 키라 **비과세 항목에는 필수**다 |
| calcMethod | FIXED · RATE · FORMULA · STATUTORY. STATUTORY 항목은 사업장이 값을 정하지 않고 기준값과 산식이 결정한다 |
| 비과세 한도 | 사업장 nontaxLimit은 **공식 월 한도 이하만 허용**한다. 초과 설정은 common.validation_failed/400이며 공식 한도는 #27이 준다 |
| 과세 전환 | **한도 초과분은 과세로 전환**해 소득세 과세표준과 4대보험 보수(보험별 규칙에 따라)에 반영한다. 과세 전환액 = max(0, 지급액 − 공식 한도) |
| 정렬 | 항목 라인 순서는 (sortOrder, code) 고정이다. 정수 연산이라 순서가 값을 바꾸지 않더라도 명세서·임금대장 출력과 인수 기준 비교에 영향을 준다(REQ-GLB-06) |
| #27 응답 | 비과세 항목코드별 **공식 월 한도**(NONTAX_LIMIT 기준값)와 사업장 설정값, 그리고 기준값 부재 여부 |

- **보육수당 비과세 한도는 2026-01-01 지급분부터 자녀 1인당 월 20만원이다**(소득세법 §12(3) 머목 개정 — 종전 근로자 1인당 · 확인 완료, REQ-PAY-02). 기준값에 적용 단위·시행일 축을 두며, #27은 기준값 미등록 항목을 값 없이 표기하고 계산은 payroll.missing_reference_value/422로 차단된다.
- 항목 삭제 표면을 두지 않는다 — 확정 결과가 항목을 참조하므로 비활성화만 허용한다(#3).

### 4·5·6·7. 급여 기준 이력·통상시급 (PAY-01)

| 항목 | 4. 이력 조회 | 5. 등록 | 6. 수정 | 7. 통상시급 산출 |
|------|-------------|--------|--------|-----------------|
| 입력 | 오프셋 | payType · baseWage · 고정수당 · 비과세 항목 · **payDay** · **payDayMonth**(SAME_MONTH · NEXT_MONTH) · **monthlyIncludesWeeklyHoliday** · effectiveFrom/To | 부분 갱신(미래 구간 한정) | baseDate |
| 검증 | — | 기간 겹침 → **payroll.payroll_terms_overlap/409** · **지급일 2축 필수**(payDay · payDayMonth) · **고정수당·비과세 항목의 코드 대조**(아래) | 위와 동일 | — |
| 응답 | 이력 목록 | 생성 자원 | 갱신 자원 | 통상임금 월액 · **divisor** · 통상시급 · 적용 ORDINARY_WAGE_RULE 버전 |

- **지급일이 없으면 간이세액표 버전을 결정할 수 없어 소득세 계산이 성립하지 않는다**(REQ-PAY-05). **지급일은 두 축이다 — 날짜(payDay)와 달(payDayMonth)**이며 둘 다 필수다.
- **두 축의 부재는 층이 다르고 코드도 다르다**(2026-09-09 정밀화). **요청 본문에 없으면 형식이므로 common.validation_failed/400**(Bean Validation)이고, **저장된 급여 기준 행에 값이 없어 계산이 성립하지 않으면 전제 미충족이므로 payroll.missing_payroll_terms/422**다. 판정 3층이 그대로 적용되는 자리이며, **이전 서술이 둘을 422 하나로 적어 표면 검증과 계산 차단을 같은 코드로 읽게 했다** — 403과 422를 가르는 것과 같은 축이다(REQ-GLB-19). 지급일이 영업일이 아니면 **직전 영업일**로, 지정일이 그 달에 없으면 **말일**로 서버가 **플랫폼 단일 규칙**으로 보정한다(REQ-PAY-04 — 사업장 선택지가 아니다). 간이세액표 버전은 보정된 실제 지급일 기준이며, **payDay가 직원별 급여 기준 필드이므로 그 축도 직원별**이다 — 같은 실행 안에서 지급일이 다른 직원이 섞이면 세액표 버전도 갈린다.
- **고정수당·비과세 항목의 코드를 항목 카탈로그와 대조한다**(#5 · #6). 두 축이다 — ① 코드가 **활성 카탈로그에 실재하는지** ② 비과세 항목이면 **선언한 비과세 코드가 카탈로그의 값과 같은지**. 어긋나면 common.validation_failed/400이다.
- **이 대조가 필요한 이유는 조인에 FK가 없다는 것이다.** 고정수당은 jsonb 배열 원소라 참조 무결성을 데이터베이스가 걸 수 없고, 결과 라인의 항목 코드는 카탈로그 행을 참조하는 것이 아니라 **문자열이 같은지를 볼 뿐**이다. 카탈로그에 없는 코드로 급여 기준이 서면 **결과 라인이 아무 것도 가리키지 않고**, 비과세 코드가 갈리면 **연 한도 누계가 다른 항목으로 집계된다** — 둘 다 컴파일도 제약도 잡지 못한다.
- **막는 것은 쓰기 시점까지다.** 확정된 뒤 카탈로그의 코드가 개명되는 경로는 이 대조가 막지 못하며, 그 잔여는 **결과 라인이 비과세 코드를 동결하지 않는다는 미결**이 담는다([../05_database/06_payroll.md](../05_database/06_payroll.md) 결과 라인 절). **두 축을 한 사실로 읽지 않는다** — 대조가 붙었다고 동결이 해결된 것이 아니다.
- **payDayMonth가 없으면 세액표 버전이 한 달 어긋난다.** 소득세 원천징수는 **지급할 때**를 기준으로 하고 간이세액표도 **지급하는 달**의 표를 쓰는데, 숫자만 받으면 서버가 귀속월로 가정할 수밖에 없다 — **익월 지급 사업장은 전건이 한 달 전 표로 계산된다.** 화면도 "10일"이 아니라 **"익월 10일"처럼 한 문장으로 고르게 한다** — 숫자만 고르는 입력은 사용자가 어느 달을 뜻했는지 화면에서 확인할 방법이 없다.
- **지급 시기는 사업장 사정이라 플랫폼이 단일값으로 정할 수 없다.** 영업일 보정과 말일 보정은 플랫폼 단일 규칙인데(REQ-PAY-04) **이것은 규칙이 아니라 사실**이라 축이 다르다 — 보정 정책 컬럼을 지운 근거를 이 축에 적용하지 않는다([../05_database/06_payroll.md](../05_database/06_payroll.md)).
- **보정 순서는 달을 먼저 정하고 날짜를 보정한다** — 귀속월에 payDayMonth를 적용해 지급월을 정하고, 그 달에서 payDay를 영업일·말일 규칙으로 보정한다. 순서를 뒤집으면 말일 보정이 잘못된 달의 달력을 본다.
- **monthlyIncludesWeeklyHoliday는 월급제의 주휴 포함 여부를 명시하는 필수 축이다**(REQ-PAY-15). **true면 주휴수당 라인을 산출하되 추가 지급을 0으로 두고** 결과에 미발생 사유 대신 '월급 포함'을 남긴다. **false면 (주 소정근로시간 ÷ 40) × 8 × 통상시급을 earning_item 올림 1원으로 별도 지급**하며, 그 라인은 **최저임금 산입 · 통상임금 비산입**이다. 추정하지 않는 이유는 관행이 갈려 이중 지급이나 누락이 되기 때문이다.
- 통상시급 = (include_in_ordinary_wage 항목의 월액 합) ÷ divisor이고 divisor = (주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12다. 반올림은 **ordinary_hourly_wage 올림 1원**이며 **적용 divisor를 응답과 결과에 함께 보존**해야 재현 가능하다(§1.2 나눗셈 1·2).
- **응답의 통상임금 월액도 금액 문자열이라 ordinary_monthly_wage 올림 1원이 걸린다**(§1.2 #18). 월급제는 입력 항목의 정수 합이라 소수부가 없고, **시급제·일급제만 divisor를 곱하는 경로에서 소수가 생긴다.** **월액은 표시·동결용이고 통상시급은 이 올림값이 아니라 정확값에서 유도**하므로 두 값을 응답에서 서로 나눠 검산하면 1원까지 맞지 않을 수 있다 — 재현 축은 월액이 아니라 **divisor와 적용 규칙 버전**이다.
- **통상임금의 고정성 요건은 적용하지 않는다** — 2024-12-19 대법원 전원합의체 판결로 폐기되어 재직조건부·근무일수조건부 정기상여도 포함될 수 있다. 판결이 **장래효**이므로 판단 규칙을 ORDINARY_WAGE_RULE 기준값 버전으로 관리하고 **결과에 동결**한다(REQ-PAY-07).
- **보험별 보수 포함 매핑(INSURANCE_WAGE_BASE_SCOPE)과 통상임금 규칙 버전(ORDINARY_WAGE_RULE)을 조회하는 사업장 스코프 표면은 두지 않는다.** #27은 비과세 한도만 주며, 관리자는 **#7 통상시급 산출 응답과 #12 · #14의 동결 값**으로 어느 규칙 버전이 적용됐는지 확인한다 — 기준값 원문 조회는 플랫폼 표면이라 사업장 화면이 직접 호출하지 않는다.
- **주 40시간의 월 환산 기준시간은 고시 공인 209로 확정**됐고 그 외는 산식 소수를 쓴다(확인 완료 · REQ-PAY-08). 기준값으로 관리하며 값이 없으면 #7이 산출하지 않고 부재를 응답에 드러낸다.

### 8. POST /v1/workplaces/{workplaceId}/payroll-runs/preview — 급여 미리보기 (PAY-07)

| 항목 | 내용 |
|------|------|
| 입력 | payPeriod(YYYY-MM) · employeeIds(선택) |
| 처리 | 마감 전후 어느 시점에서도 직원별 예상 지급·공제·실수령을 산출한다. **확정이 아니다** |
| 차단 전환 | **#9의 차단 조건을 전부 경고로 표시**한다 — 미마감 근태 · 누락 보험 정보 · 기준값 누락 · 스냅샷 미확정 |
| 응답 | 직원별 요약 + warnings 배열 + **전월 대비 변동·이상치** |
| 경고 출처 | **미리보기 경고의 유일한 출처는 이 표면의 응답 warnings 배열**이다. payroll_runs 행이 없어 실행 스코프 검증 조회(#15)를 부를 수 없고 payroll_validation_results에 적재되지도 않는다 |
| 저장 | payroll_runs 행을 만들지 않는다. **미리보기 결과는 잠금·명세서·임금대장에 사용하지 않는다** |
| 실패 | 경고로 전환되지 않는 것은 요청 형식 오류뿐이다 — common.validation_failed/400 |

- 미리보기가 차단하지 않는 근거는 용도다. 관리자는 **마감 전에** 대략의 인건비를 보고 근태를 조정하는데, 그 시점에는 정의상 근태가 미마감이라 차단하면 표면 자체가 쓸모없어진다(REQ-PAY-30).
- 응답에 estimated=true를 명시해 화면이 확정값과 섞어 보여 주지 않게 한다.

### 9·10. 급여 실행 생성·재계산 (PAY-02 · PAY-03 · PAY-04 · PAY-05)

```plain
① 입력 수집        LOCKED 근태 마감 + 승인 휴가 + 근로조건 + 보험 정보
                  + 상시근로자 스냅샷 + 기준값 버전 + 지급일
② 차단 판정        근태 미마감           → payroll.attendance_not_closed/409  **실행 단위 · 실행을 만들기 전**
                  급여 기준·지급일 없음  → payroll.missing_payroll_terms/422   직원별
                  근로조건·보험 정보 없음 → payroll.missing_payroll_terms/422(흡수 — 전용 코드를 두지 않는다)
                  기준값 누락·확인자 미기입 → payroll.missing_reference_value/422 직원별
                  스냅샷 없음            → payroll.employee_count_snapshot_required/422 직원별
③ 통상임금 산출     include_in_ordinary_wage 합 ÷ divisor · 올림 1원 · divisor 보존
④ 기본급 산출       월급제 = 월 고정액(부분월은 월급 × 재직 역일수 ÷ 해당월 역일수)
                  시급제 = raw 실근로분 환산 시간 × 시급
                  일급제 = 근무일수 × 일급           전부 earning_item 올림 1원
⑤ 법정수당 산출     8버킷 × 지급배수 표 · 주휴수당 · 연차미사용수당
⑥ 무급 공제        결근 = 결근일수 × 1일 통상임금 · 지각조퇴 = (지각분 + 조퇴분) ÷ 60 × 통상시급
                  unpaid_deduction 절사 1원
⑦ 비과세·과세 전환   항목별 공식 한도 초과분을 과세로 전환
⑧ 4대보험 공제      보험별 base 각각 산출 → 근로자 부담 요율 → **보험 항목별로 10원 절사**
⑨ 소득세·지방소득세  간이세액표 세액 조회(**직원별 지급일 기준 버전** · 월 급여액 구간 + 부양가족 수 2축)
                  → 8~20세 자녀 수별 세액 차감 → 하한 0 → 원천징수 선택비율 → 10원 절사
                  → 지방소득세 = 소득세 × 10%
⑩ 최저임금 검증     월 산입 임금(**무급공제 반영 전**) ÷ 월 환산 기준시간(divisor 동일 산식) · **반올림 금지** → 기준값과 비교
⑪ 결과 저장        payroll_runs(CALCULATED) · payroll_employee_results · 항목 라인 · 검증 결과
                  **재계산이면 기존 항목 라인과 검증 결과를 지우고 다시 넣는다**(미확정 실행 한정)
                  **결과가 0건이면 CALCULATED로 전이하지 않는다** — DRAFT로 남고 차단 사유만 실행에 남는다
```

| 항목 | 9. 실행 생성 | 10. 재계산 |
|------|-------------|-----------|
| 입력 | payPeriod · employeeIds(선택) | employeeIds(선택) |
| 대상 상태 | 새 실행을 만든다(DRAFT → CALCULATED) | **CALCULATED만** 재계산한다. CONFIRMED는 거부한다 |
| 중복 | 같은 pay_period에 CALCULATED 실행이 있으면 그것을 반환하고 새로 만들지 않는다 | — |
| 제외 | 고용형태 DAILY · worker_type이 EMPLOYEE가 아닌 대상은 계산에서 제외하고 사유를 담는다 | 위와 동일 |
| 실패 | ②의 4종 | ②의 4종 · payroll.already_confirmed/409 |
| 판정 순서 | **①대상 상태 → ②근태 마감(실행 단위) → ③실행 확보 → ④직원별 차단** | 위와 동일 — 확정본 재계산은 근태가 풀려 있어도 payroll.already_confirmed/409다 |

- **중간 단계에서 반올림하지 않는다.** 원시 분 집계 → 단가 × 시간 곱 → **항목 최종 금액에서 1회 반올림** → 항목 합계 순서이며 항목 합계를 다시 반올림하지 않는다(§1.1).
- **월 중 근로조건이 바뀌면 기간을 분할해 각각 산출한 뒤 합산한다.** 분할 구간별로 반올림하지 않고 항목 단위 최종 금액에서 1회만 반올림한다(REQ-PAY-13).
- **지각·조퇴를 결근으로 환산해 공제하지 않는다**(REQ-PAY-14).
- 계산은 데이터베이스·시각·난수에 접근하지 않는 순수 함수 계층에서 수행한다 — 구조로 결정론을 강제하는 장치이며 파이프라인의 정본은 [../04_architecture/06_payroll_engine.md](../04_architecture/06_payroll_engine.md)다.
- **근태 미마감은 실행 단위 판정이고 실행을 만들기 전에 끝난다.** 마감은 (사업장, 급여월) 하나에 걸려 일부 직원만 마감에서 빠지는 경로가 없으므로 직원별 사유로 모으지 않는다 — 모으면 같은 사실이 대상 수만큼 복제되고, **전원이 같은 사유로 막혔는데 실행은 CALCULATED · 대상 0명 · 총액 0원으로 서서** 목록에서 계산이 끝난 실행과 구분되지 않는다(2026-09-10 실측 — 250명 전원 미마감이 그 형태였다). **미마감 요청은 payroll_runs 행을 남기지 않는다.**
- **같은 규정을 #9와 #10이 다르게 집행하지 않는다.** 위 실측 시점에 #9는 직원별 사유로 모아 실행을 세웠고 #10은 즉시 409였다 — 정본은 셋(#9 · #10 · #17)에 같은 차단을 규정하므로 집행도 하나다.
- **결과가 0건이면 CALCULATED로 전이하지 않는다.** 직원별 차단(급여 기준 · 기준값 · 스냅샷)으로 결과가 한 건도 서지 않으면 실행은 DRAFT로 남고 차단 사유만 검증 결과로 남는다. **결과가 0건인 실행을 계산본으로 세우면 「계산이 차단되는 것이 정상 동작」이라는 규약이 화면에서 거짓이 된다** — 사용자는 무엇을 채워야 하는지가 아니라 급여가 0원이라는 사실을 본다. 대상이 애초에 0명인 실행(전원 제외·직원 없음)은 차단이 아니므로 이 규칙에 들지 않는다.
- **ATTENDANCE_CLOSING 검사 축은 검증 결과에 통과 행으로만 남는다.** 미마감이면 실행 자체가 서지 않아 그 실행에 BLOCK 행을 넣을 자리가 없고, **계산 후에 마감이 풀린 경우는 #16 선점검이 실시간 판정으로 낸다**(blockers의 employeeId 널 항목이 그것이다). 나머지 차단 3종은 직원별이라 그대로 검증 결과 행으로 남는다.

### 11·12·13·14. 실행 목록·헤더·직원별 결과·항목 라인 (PAY-02 · PAY-03 · PAY-04 · PAY-05 · PAY-08)

```json
{
  "employeeId": "…",
  "payDate": "2026-09-10",
  "ordinaryHourlyWage": "12450",
  "ordinaryWageMonthly": "2602050",
  "divisor": "209",
  "dailyContractualMinutes": 480,
  "premiumEligible": true,
  "employeeCountSnapshotId": "…",
  "buckets": { "regular": 9600, "overtime": 300 },
  "earnings": [
    { "code": "BASE", "name": "기본급", "amount": "2400000", "basisMinutes": 9600, "unitPrice": null, "premiumRate": null, "minWageIncluded": true, "includeInOrdinaryWage": true, "rule": "MONTHLY_FIXED — 월 고정액" },
    { "code": "OT_WORK", "name": "연장근로 실근로분", "amount": "62250", "basisMinutes": 300, "unitPrice": "12450", "premiumRate": null, "minWageIncluded": false, "includeInOrdinaryWage": false, "rule": "LB-56-OT-WORK" },
    { "code": "OT_PREMIUM", "name": "연장근로 가산", "amount": "31125", "basisMinutes": 300, "unitPrice": "12450", "premiumRate": "0.5", "minWageIncluded": false, "includeInOrdinaryWage": false, "rule": "LB-56-OT", "statutoryRateId": "…" }
  ],
  "deductions": [
    { "code": "ABSENCE", "name": "결근 공제", "amount": "99600", "basisMinutes": 480, "unitPrice": "12450", "rule": "UNPAID_ABSENCE", "roundingKey": "unpaid_deduction" },
    { "code": "NP", "name": "국민연금", "amount": "108000", "base": "2400000", "rate": "0.045", "statutoryRateId": "…", "limitRateId": "…", "limitApplied": "NONE", "roundingKey": "social_insurance" }
  ],
  "grossPay": "2493375",
  "paidAmount": "2393775",
  "incomeTaxInput": { "monthlyWage": "2393775", "dependentCount": 2, "childCount8To20": 1, "taxTableVersion": "…", "withholdingRate": "100" },
  "netPay": "2285775"
}
```

- **가산 라인은 실근로 라인과 분리한다.** premiumRate는 **가산 배수**(할증분)이며 실근로분 1.0을 포함하지 않는다 — 위 예시에서 연장 300분의 총 지급은 실근로 62,250 + 가산 31,125 = 93,375원이다. **5인 미만 사업장은 premiumRate를 0으로 채우는 것이 아니라 가산 라인 자체가 응답에 없다**(REQ-PAY-20).
- **무급공제는 지급 라인의 음수가 아니라 공제 라인이다.** 그래서 grossPay(지급 총액 = 지급 라인 합)와 **paidAmount(지급 확정액 = 지급 총액 − 무급공제)** 가 다른 값이며, 소득세 과세 축과 4대보험 base의 입력은 paidAmount다(REQ-PAY-14).
- **최저임금 환산의 분자는 반대로 무급공제 반영 전**이므로 minWageIncluded가 켜진 지급 라인의 합을 쓴다 — 분모가 소정근로시간이라 분자도 결근을 반영하지 않아야 축이 맞는다(REQ-PAY-26).
- 위 예시의 deductions는 두 라인으로 줄인 것이며 netPay는 표시된 라인만 반영한 값이다 — 2,493,375 − 207,600 = 2,285,775.
- **payDate는 직원별 확정 지급일**이고 **간이세액표 버전 선택 축**이다. 실행 헤더의 지급일은 목록·대장 표기용 대표값이며 조회 축이 아니다(REQ-PAY-04 · REQ-PAY-24).
- incomeTaxInput의 **monthlyWage는 비과세와 학자금을 제외한 월 급여액**이며 소득공제 후 과세표준이 아니다 — 간이세액표의 구간 축이 그 개념이기 때문이다.
- **#11의 허용 정렬 축은 목록 열과 같다.** 열이 화면에 있는데 정렬 축이 없으면 그 열의 머리를 누른 요청이 common.validation_failed/400으로 돌아온다 — 화면은 그것을 고장으로 보여 줄 수밖에 없다. 목록 밖 필드는 그대로 400이다.
- **status 정렬은 알파벳이 아니라 상태 진행 순서**(DRAFT → CALCULATED → CONFIRMED → VOIDED)다. 열이 명명 enum이라 데이터베이스가 선언 순서로 비교한다.
- **값이 없는 행은 어느 방향이든 아래다**(NULLS LAST). totalNet · confirmedAt이 널 허용인데, 확정 시각 내림차순의 첫 쪽이 미확정 실행으로 덮이면 그 정렬이 답하려던 질문("가장 최근에 확정한 것")이 사라진다.

| 항목 | 11. 목록 | 12. 헤더 | 13. 직원별 목록 | 14. 항목 라인 상세 |
|------|---------|---------|----------------|------------------|
| 입력 | payPeriod · status · 오프셋 | — | 오프셋 | — |
| 허용 정렬 | payPeriod(기본 · desc) · payDate · status · totalNet · employeeCount · confirmedAt | — | 고정(employeeName · employeeId 오름차순) | — |
| 응답 | 기간 · 상태 · 대상 인원 · 총 지급·공제 요약 · supersedes 관계 | 위 + **동결된 규모 정책 버전 · 통상임금 규칙 버전 · 반올림 규칙 버전** | 직원별 총 지급·공제·실수령 요약 | 위 예시 전체 |
| 동결 확인 | — | 확정본은 동결 값이, 계산본은 현재 조회값이 담긴다. 어느 쪽인지 frozen 불리언이 드러낸다 | — | 각 라인에 **적용 기준값 행 ID와 실제 값**이 박힌다 |

**버킷별 지급배수**(통상시급 기준)는 계산의 핵심 표이며 정본은 [../03_requirements/07_payroll.md](../03_requirements/07_payroll.md)다. 버킷 정의의 정본은 [06_attendance.md](./06_attendance.md)다.

**급여는 8버킷을 받아 쓰고 다시 분해하지 않는다.** 배수를 곱할 대상은 근태가 이미 분해해 일 집계에 저장한 버킷 값이며, 급여가 원본 근태에서 버킷을 **다시 계산하지 않는다.**

- **성능이 아니라 갈림이 근거다.** 같은 분해를 두 모듈이 각자 구현하면 **두 구현이 같은 근태에 다른 버킷을 낸다** — 2026-09-08 실측이 그 상태였고, 남아 있는 갈림 축이 둘이다(연소자 한도가 급여에 하드코딩 · 월 경계 주가 부분 데이터로 계산). **금지만 적고 이유를 두면 다음 사람이 "성능 때문인가" 하고 우회한다.**
- **미리보기 경로에도 같은 축이 적용된다.** 마감 전에도 일 집계 행은 존재하고 **마감은 그것을 동결할 뿐**이라, 미리보기가 재분해의 근거가 되지 않는다 — 확정과 미리보기가 다른 경로로 버킷을 만들면 **미리보기가 보여 준 금액과 확정 금액이 갈린다.**
- **이 계약은 근태와 급여 사이의 것이고 계산 계층 일반의 규칙이 아니다.** "계산 계층은 다른 계산 계층의 출력을 다시 계산하지 않는다"로 일반화하면 참이 아니다 — **급여는 통상시급을 여러 항목에서 다시 쓴다.** 여기서 막는 것은 **같은 입력을 두 모듈이 각자 분해하는 것**이다.
- **강제 지점을 둘 수 있는 층이 문서뿐이다.** 분해는 순수 함수 계층의 일이라 ArchUnit도 트리거도 걸리지 않는다 — **금지 서술이 유일한 강제 지점**이므로 여기 둔다.

| 버킷 | 실근로분 | 가산(5인 이상) | 총 배수 | 월급제 추가 지급 | 5인 미만 총 배수 | 5인 미만 월급제 추가 |
|------|---------|---------------|--------|-----------------|-----------------|-------------------|
| 1 소정 | 1.0 | — | 1.0 | **0**(기본급 포함) | 1.0 | **0** |
| 2 야간(소정 시간대) | 1.0 | 0.5 야간 | **1.5** | **0.5** | 1.0 | **0** |
| 3 연장 | 1.0 | 0.5 연장 | **1.5** | **1.5** | 1.0 | **1.0** |
| 4 연장야간 | 1.0 | 0.5 연장 + 0.5 야간 | **2.0** | **2.0** | 1.0 | **1.0** |
| 5 휴일(8시간 이내) | 1.0 | 0.5 휴일 | **1.5** | **1.5** | 1.0 | **1.0** |
| 6 휴일야간(8시간 이내) | 1.0 | 0.5 휴일 + 0.5 야간 | **2.0** | **2.0** | 1.0 | **1.0** |
| 7 휴일연장(8시간 초과) | 1.0 | 1.0 휴일 | **2.0** | **2.0** | 1.0 | **1.0** |
| 8 휴일연장야간(8시간 초과) | 1.0 | 1.0 휴일 + 0.5 야간 | **2.5** | **2.5** | 1.0 | **1.0** |

- **총 배수는 응답 라인 하나에 담기지 않는다.** 실근로분 1.0은 실근로 라인이, 할증분은 가산 라인이 담고 premiumRate에는 **할증분만** 들어간다 — 총 배수를 premiumRate로 실으면 5인 미만에서 0이 실근로분까지 지워 임금체불이 된다.
- **버킷 7·8에 연장 가산 0.5를 추가하지 않는다.** 휴일근로시간은 주 40시간 산정에 포함되지 않으므로 휴일 8시간 초과분의 총 배수는 2.5가 아니라 **2.0**이다(REQ-PAY-18). 가장 흔한 오구현 지점이다.
- **5인 미만은 가산 라인을 만들지 않고 실근로 라인 1.0배는 반드시 지급한다.** 연장·휴일 근로를 무급 처리하면 임금체불이다(REQ-PAY-20). 주휴수당·최저임금·4대보험·소득세·명세서·임금대장은 **규모 무관 적용**한다.
- 주휴수당 = (주 소정근로시간 ÷ 40) × 8 × 통상시급이며 주 40시간 이상은 8시간 상한이다. 발생 요건은 **주 소정 15시간 이상 + 그 주 개근**이고 미발생 시 사유를 결과에 명시한다.

**보험별 과세표준 base는 각각 산출한다.** "비과세 = 4대보험 보수에서도 제외"라는 단일 규칙은 오구현이다(REQ-PAY-03).

| 보험 | base | 비과세 처리 | 근로자 공제 |
|------|------|-----------|-----------|
| 국민연금 | 기준소득월액 | 소득세법상 비과세 제외와 **일치** | 공제 |
| 건강보험 · 장기요양 | 보수월액 | **일부 비과세 항목을 보수에 다시 포함** — 소득세법 §12(3) **차목·파목·거목** 3계열 한정(확인 완료 · 실무 핵심은 국외근로 비과세분) | 공제 |
| 고용보험 | 당월 실제 지급 보수 | 일치 | 공제 |
| 산재보험 | 당월 실제 지급 보수 | 일치 | **미공제** — 전액 사업주 부담 |

- **하나의 과세표준 값을 4개 보험에 공용하면 건강보험료가 틀린다.** 그래서 #14의 각 공제 라인이 자기 base를 따로 담는다.
- **장기요양보험료 = 원단위 절사를 마친 월 건강보험료 × (장기요양보험료율 ÷ 건강보험료율)이며 10원 미만 절사**한다(REQ-PAY-23). LTC_RATE 기준값은 **소득(보수월액) 대비 고시 요율**이지 건강보험료에 곱하는 배수가 아니므로, 건강보험료를 base로 쓸 때 건강보험료율로 나누는 환산이 반드시 들어간다.
- 소득세는 **직원별 지급일 기준** 간이세액표 버전을 쓴다. **조회 키는 월 급여액(비과세·학자금 제외) 구간 + 공제대상 부양가족 수 2축**이고 **8~20세 자녀 수는 조회 축이 아니라 조회 후 차감 축**이다. 적용 순서는 **표 세액 조회 → 자녀 수별 세액 차감 → 하한 0 → 원천징수 선택비율(80%·100%·120% · 미선택 시 100%) → 10원 절사**이며 **입력값 전체를 결과에 동결**한다.
- 지방소득세 = 소득세 × 10%이며 10원 절사다. 소득세가 0이면 지방소득세도 0이다.

### 15. GET /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/validations — 최저임금·기준값 검증 (PAY-06)

| 항목 | 내용 |
|------|------|
| 응답 | 직원별 검증 결과 — severity(BLOCK · WARN) · checkType · code · 미달 금액 · 적용 기준값 · **산입/제외 항목 목록** |
| 검사 축 | checkType **8종** — MIN_WAGE · TAX_TABLE · INSURANCE · REFERENCE_VALUE · SNAPSHOT · **ATTENDANCE_CLOSING** · **PAYROLL_TERMS** · **NONTAX_ELIGIBILITY**(WARN 전용 — 차단 코드 대응 없음 · 채번 정본 [../05_database/06_payroll.md](../05_database/06_payroll.md)). 계산 차단 코드 4종이 전부 이 축으로 표현되어야 확정 선점검(#16)이 "무엇을 채우면 진행되는가"를 답할 수 있다 |
| 누적 없음 | **재계산(#10)은 해당 실행의 검증 결과를 지우고 다시 넣는다.** (실행, 직원, checkType)이 유일하므로 해소된 BLOCK이 남아 확정을 영구 차단하는 일이 없다 |
| 최저임금 산식 | 환산시급 = **월 산입 임금(무급공제 반영 전) ÷ 월 환산 기준시간**((주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12 — divisor와 같은 산식 · 산식 정본 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.2 #6). **반올림을 금지한다** — 절사하면 미달을 과다 경고하고 **절상하면 실제 미달을 놓친다** |
| 산입범위 | **세법상 과세/비과세와 별개 축**이다. 현물·소정근로 외 임금·법령상 미산입 항목을 제외하며 매핑은 MIN_WAGE_SCOPE 기준값이 갖는다 |
| 수습 감액 | **3요건을 모두 충족할 때만** 적용한다 — ① 1년 이상의 기간을 정한 근로계약 ② 수습 시작일부터 3개월 이내 ③ 한국표준직업분류 대분류 9(단순노무)가 **아닐 것**. 미충족이면 감액 없이 전액으로 검증한다 |
| 미달 처리 | **payroll.below_minimum_wage/422**로 확정을 차단하거나 관리자 명시 확인을 요구한다. **단순 경고로 흘리지 않는다** |
| 명세서 노출 | 미달 금액·기준값·산입 목록은 관리자 화면에만 표시하고 **명세서에는 내부 경고를 노출하지 않는다** |
| 적용 범위 | **규모 무관 적용**이다 |

- **최저임금 산입범위는 확정됐다 — 2024-01-01부터 정기상여금·현금성 복리후생비 전액 산입**(확인 완료 · REQ-PAY-26). 미산입 유지는 가산임금·비정기 상여·현물 복리후생이며, 기준값이 없으면 검증을 수행하지 않고 payroll.missing_reference_value/422로 차단한다.

### 16·17·18·19. 확정 선점검·확정·무효화·정정본 (PAY-08)

```json
{
  "confirmable": false,
  "selfIncluded": true,
  "requiresOwner": true,
  "checks": [
    { "check": "ATTENDANCE_CLOSING", "passed": false, "blockerCount": 1 },
    { "check": "CALCULATION_COMPLETE", "passed": true, "blockerCount": 0 },
    { "check": "VALIDATION_CLEAR", "passed": true, "blockerCount": 0 },
    { "check": "EMPLOYEE_COUNT_SNAPSHOT", "passed": false, "blockerCount": 1 },
    { "check": "EMPLOYEE_NET_PAY", "passed": false, "blockerCount": 1 }
  ],
  "blockers": [
    { "code": "payroll.attendance_not_closed", "check": "ATTENDANCE_CLOSING", "checkType": "ATTENDANCE_CLOSING", "employeeId": null, "message": "근태가 마감되지 않았습니다.", "detail": {} },
    { "code": "payroll.below_minimum_wage", "check": "EMPLOYEE_NET_PAY", "checkType": "MIN_WAGE", "employeeId": "…", "message": "최저임금에 미달합니다.", "detail": {} },
    { "code": "payroll.employee_count_snapshot_required", "check": "EMPLOYEE_COUNT_SNAPSHOT", "checkType": "SNAPSHOT", "employeeId": "…", "message": "상시근로자 스냅샷이 없습니다.", "detail": {} }
  ],
  "warnings": [],
  "summary": { "employeeCount": 12, "totalEarnings": "28430000", "totalDeductions": "3120450", "totalNetPay": "25309550" }
}
```

| 항목 | 16. 선점검 | 17. 확정 | 18. 무효화 | 19. 정정본 생성 |
|------|-----------|---------|-----------|----------------|
| 권한 | MANAGER | MANAGER · **멱등키 필수**(자기포함이면 **OWNER 전용**) | **OWNER** | **OWNER · 멱등키 필수** |
| 입력 | — | acknowledgedWarnings | reason(필수) | reason(필수) · 정정 대상 범위 |
| 점검 항목 | **집합의 정본이고 응답 필드 `checks`가 그것을 싣는다** — ATTENDANCE_CLOSING(근태 마감) · CALCULATION_COMPLETE(계산 완료) · VALIDATION_CLEAR(검증 무오류) · EMPLOYEE_COUNT_SNAPSHOT(상시근로자 스냅샷) · EMPLOYEE_NET_PAY(직원별 실지급액) **다섯**이며 **항상 전건**(통과 항목 포함) 순서까지 고정으로 온다. 화면은 이것을 표시할 뿐 다시 세지 않는다. **여기 없는 항목을 응답에 담지 않는다** | 위 전부 + 검증 대기 사업장 차단(VALIDATION_CLEAR 항목에 접힌다) | 대상이 CONFIRMED일 것 | 원본이 VOIDED일 것 |
| 처리 | 읽기 전용 | 기간 잠금 → 값 동결 → CONFIRMED 전이 → **명세서 생성 큐 등록**([09_payslip.md](./09_payslip.md)) → **원천세 과제 생성**(WITHHOLDING_FILING) | CONFIRMED → VOIDED · 원본 보존 · 관련 명세서 생성 중단 | supersedes_id로 연결된 새 실행 생성 → 재계산 → 차액 저장 |
| 실패 | — | payroll.already_confirmed/409 · payroll.confirmation_conflict/409 · workplace.verification_pending/409 · payroll.below_minimum_wage/422 · **auth.workplace_forbidden/403**(자기포함 런의 MANAGER 확정 시도) · **payroll.missing_reference_value/422**(원천세 기한 기준값 부재 — details에 (category, key) 배열) | **payroll.void_forbidden/403**(MANAGER 시도) | payroll.void_forbidden/403 · payroll.confirmation_conflict/409 |

**해소 — 차단 사유의 축을 둘로 갈라 각각 닫는다**(2026-09-12 · 종전 미결 「blockers.reason의 값 집합에 정본이 없다」). 세 집합이 갈렸던 것은 **한 필드에 두 질문을 담으려 했기 때문**이다 — "무엇을 점검했는가"와 "검증이 어느 기준값에서 걸렸는가"는 다른 축이고, 앞의 축에는 계산 완료·직원별 실지급액처럼 **검증 결과 행이 없는 항목**이 있어 뒤의 축으로 표현되지 않는다.

| 필드 | 축 | 값 집합 | 언제 있는가 |
|------|----|---------|------------|
| `checks[].check` | 점검 항목 — 무엇을 점검했는가 | **다섯으로 닫힌다**(위 점검 항목 행) | 선점검 응답에 **항상 전건** |
| `blockers[].check` | 그 사유가 속한 점검 항목 | 같은 다섯 | 선점검의 **모든 사유**가 갖는다 |
| `blockers[].checkType` | 검증 축 — 어느 기준값에서 걸렸는가 | #15의 **8종** | 검증 결과 행에서 온 사유만. 실행 상태·결과 부재는 비어 있고 그 자리를 `check`가 답한다 |
| `blockers[].code` | 에러 코드 | 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) | 전건 |

- **근태의 6종 형태를 그대로 따르지 않는다** — 그쪽은 차단 사유가 전부 같은 축(마감 점검 항목)이라 한 집합으로 닫히지만, 확정 선점검은 상태 전이·검증·결과 존재·권한이 섞이는 자리다. **닫는 방법이 다른 것이지 열어 두는 것이 아니다.**
- **화면의 차단 안내 넷은 부분집합이 아니라 `checks` 전건을 그리는 것으로 바뀐다** — 갈림의 원인이 화면이 스스로 세던 것이었으므로, 세지 않게 하는 것이 닫는 방법이다(화면 정본 [../07_screen/08_admin_payroll_payslip.md](../07_screen/08_admin_payroll_payslip.md) 화면 146).
- **`confirmable`은 미해결 항목 부재와 역할 허용의 논리곱이다.** 자기포함 런(`requiresOwner`)을 MANAGER가 조회하면 점검 항목이 전건 통과여도 `false`다 — 역할은 점검 항목이 아니라 권한 축이라 `checks`에는 나타나지 않고 `requiresOwner`가 그것을 말한다. **역할을 빼고 판정하면 `confirmable`만 보는 소비처에서 자기포함 확정이 열린다**(2026-09-11 실측 — 화면이 따로 잠가 사고가 나지 않았을 뿐이다).
- **같은 급여월에 유효한 확정본은 1건이다** — 원본·정정본을 통틀어 본다. #16이 그 사실을 CALCULATION_COMPLETE 항목의 차단(`payroll.already_confirmed`)으로 내고 #9·#10의 실행 확보 단계가 같은 판정을 한다. **`supersedes_id`를 술어에 두면 정정본이 유일성 판정에서 빠져** 정정본이 선 급여월에 새 원본 실행이 서고 함께 확정된다(2026-09-11 실측 — 급여 이력이 직원당 2행 · 명세서가 직원당 2건 · 정정 체인에 노드 셋). **정정은 #18 무효화 후 #19 정정본 발행으로만 한다.**

- **확정 시 동결하는 값**은 §1.4가 정본이며 최소한 다음을 포함한다 — 적용 기준값 행 ID와 실제 값 · 보험별 적용 보수월액 · 통상시급과 통상임금 월액과 **divisor** · 평균임금과 3개월 산정 근거 · **상시근로자 스냅샷 ID와 경계 판정 결과** · 규모 정책 버전 · 통상임금 규칙 버전 · 간이세액표 입력값 전체 · 각 수당 라인의 기준시간과 단가와 가산율과 적용 법칙 · 지원사업 적용 여부 필드 · 반올림 규칙 버전이다.
- **자기포함 런은 OWNER만 확정한다.** 확정 실행자가 그 실행의 대상자에 포함되면(selfIncluded) **요청자가 OWNER 역할이어야 하며 MANAGER 시도는 auth.workplace_forbidden/403**이다. 확정 성공 시 **자기포함 플래그를 결과에 동결**하고 실행자·사유와 함께 감사 로그에 남긴다(REQ-PAY-27).
- 확인 체크로 대체하는 경로를 두지 않는다 — 자기거래를 본인 동의로 통과시키면 통제가 성립하지 않는다. #16이 selfIncluded를 미리 알려 MANAGER가 OWNER에게 확정을 넘기도록 유도한다.
- **CONFIRMED는 CALCULATED로 되돌리지 않는다.** #18은 VOIDED로만 보내고 원본을 삭제하지 않으며, #19가 supersedes_id로 연결된 새 실행을 만들어 원본과 정정본의 관계·사유·**차액**을 저장한다(REQ-PAY-29).
- **원천징수이행상황신고 과제(WITHHOLDING_FILING)는 #17 확정 트랜잭션의 부수효과로 생성된다**(REQ-TAX-03). due_date는 사업장의 반기납부 설정으로 파생하며 **월별 납부는 지급일의 익월 10일 · 반기납부 특례는 7월 10일과 1월 10일**이다. 캘린더 표기와 감지는 [10_tax.md](./10_tax.md) #10 · #12가 담당한다.
- **신고 단위의 축은 지급월이지 귀속월이 아니다.** 익월 지급 사업장은 7월 귀속분을 8월에 지급하고 **그 신고는 8월분**이다 — 기산이 pay_date이므로 축도 그것을 따른다([../05_database/12_compliance.md](../05_database/12_compliance.md) 기한 파생 표). 멱등 축은 **월별 납부면 지급월 · 반기 특례면 그 지급월이 드는 반기**다 — **반기인데 월을 축으로 쓰면 한 신고에 여섯 행이 생긴다.**
- **정정 재확정이 행을 늘리지 않는다.** 같은 신고 단위의 두 번째 확정은 같은 멱등키를 내므로 이미 열린 과제가 그대로 돌아온다 — 신고 의무는 실행 횟수가 아니라 신고 단위에 걸린다.
- **직원 축이 없는 유일한 과제 유형이다.** employee_id는 널이며 그 널을 허용하는 CHECK가 이 유형 하나에만 열려 있다([../05_database/12_compliance.md](../05_database/12_compliance.md)).
- **기한 기준값이 없으면 확정을 막는다** → **payroll.missing_reference_value/422**이며 details가 누락 키를 [{category, key}]로 낸다(category = FILING_DEADLINE · key = withholding:monthly 또는 withholding:semi_annual). **여기만 차단인 이유는 원천세 과제가 확정과 같은 사건이기 때문**이다 — 퇴사·입사의 부수효과는 갈래가 여럿이라 하나를 미처리로 남기고 완주하지만, 확정은 **과제를 만들지 못하면 그 확정에 대응하는 신고 의무가 어디에도 남지 않는다.** 임의 기본 기한을 세우지 않는다는 계약은 양쪽 모두 같다.
- **원본 VOID 시점에 PENDING·FAILED 상태인 명세서는 생성을 중단**하고 FAILED(사유 = 원본 VOID)로 고정한다([09_payslip.md](./09_payslip.md)).
- 최저임금 미달 강행 확정은 사유·행위자를 감사 기록한다.

### 20·21·22. 임금대장 조회·내보내기 토큰·다운로드 (PAY-09)

| 항목 | 20. 조회 | 21. 내보내기 토큰 | 22. 스트리밍 다운로드 |
|------|---------|------------------|---------------------|
| 권한 | MANAGER | MANAGER | 토큰 소유자 |
| 입력 | employeeIds(선택) · 필터 조건 | format(PDF · XLSX) · **reason(필수 · 최대 500자)** | — |
| 응답 | 법정 기재사항을 담은 행 배열 | token · expiresAt · documentId | attachment 스트리밍 |
| 기록 | — | 생성자 · 생성시각 · **필터 조건**을 documents에 남기고 **`document.download_sensitive` 감사에 사유를 함께 기록**한다 | 다운로드 이력 기록 후 스트리밍 |

법정 기재사항(근로기준법 §48① · 시행령 §27)은 **성명 · 근로자 식별정보(주민번호는 마스킹 또는 사번 대체) · 고용 연월일 · 종사하는 업무 · 임금 및 가족수당의 계산기초 사항 · 근로일수 · 근로시간수 · 연장·야간·휴일 근로 시간수 · 기본급과 항목별 금액 · 공제 항목별 금액**이다.

- **5인 미만은 근로시간수와 연장·야간·휴일 근로 시간수 기재를 생략할 수 있다**(규모 분기). 응답은 해당 열을 비우고 생략 근거를 함께 담는다.
- **주민번호 원문을 대장에 싣지 않는다.** 마스킹 값 또는 사번으로 대체한다.
- **사유가 필수다** → 없으면 **common.validation_failed/400**이며 `details.reason`이 그 자리를 가리킨다. **요구 여부는 표면 계약이 아니라 문서 분류가 정한다** — 산출물이 민감 분류이므로 `document.download_sensitive` 감사가 붙고 그 액션의 사유를 데이터베이스 가드가 강제한다(사유 없이 기록에 닿으면 400이 아니라 500이 나간다). 같은 분류인 명세서 관리자 다운로드([09_payslip.md](./09_payslip.md) #11)와 근로자명부([05_hr.md](./05_hr.md) #31 · #32)가 같은 규율이며, **요구하지 않던 동안 전 직원의 임금이 사유 없이 반출되고 감사에 한 줄도 남지 않았다**(2026-09-11 실측 · REQ-NFR-15이 내보내기 다운로드를 감사 대상으로 둔다).
- **재인증은 요구하지 않는다** — 그 요건은 문서함 경로([05_hr.md](./05_hr.md) #29)가 **복호 열람**에 거는 것이고 이 표면은 이미 확정된 결과의 동결값을 모아 내보내므로 복호 대상이 없다. 민감 문서 4요건 중 **사유 · 감사 · 1회용 토큰 셋**이 이 표면의 몫이다.
- **감사 대상은 생성된 문서다** — `target_type = document` · `target_id = documentId`이며 문서함 경로와 같은 축이라 감사 조회가 두 경로를 한 축으로 본다.
- **생성 문서는 민감 분류(is_sensitive = true)다.** employee_id가 없는 사업장 단위 산출물이라 **전 직원의 임금이 한 파일에 모이고**, 판정 기준이 "그 파일 하나가 열리면 타인의 임금이 드러나는가"이므로 그 기준에 걸린다(정본 [../05_database/03_hr.md](../05_database/03_hr.md) 판정 절). **마스킹이 그것을 대신하지 못한다** — 마스킹 대상은 주민번호 하나이고 임금은 평문으로 남는다. 근로자명부([05_hr.md](./05_hr.md) #31 · #32)와 **같은 분류**이며, 둘이 같은 성질인데 분류가 갈려 있으면 어느 쪽이 옳은지 표면만 보고는 알 수 없다.
- 보존은 **마지막 기입일 기산 3년**이며 생성 문서의 retention_until에 반영한다(REQ-GLB-18).

### 23·24. 급여 이력 조회 (PAY-10)

| 항목 | 23. 사업장 이력 | 24. 본인 이력 |
|------|----------------|--------------|
| 권한 | MANAGER | 본인 |
| 입력 | from · to(YYYY-MM) · employeeId(선택) | from · to(YYYY-MM) |
| 응답 | 월별 직원별 지급·공제 요약 | 월별 본인 결과 요약 + 명세서 링크 |
| 인가 축 | 멤버십 | **본인 소유권** — employees.user_id = 요청자. workplace_members의 존재·상태를 요구하지 않는다 |
| 보존 | 법정 보존기간 이상 **읽기 전용**으로 유지한다. 탈퇴·사업장 폐쇄와 무관하다 | 위와 동일 |

- **퇴사자 본인은 멤버십이 아니라 본인 소유권으로 인가한다**(REQ-SLP-09 · CMP-07). 그래서 #24는 사업장 스코프 경로가 아니라 /v1/me 경로에 둔다 — 사업장 경로에 두면 가드가 멤버십을 먼저 보고 퇴사 순간 막는다.
- 범위 조회이며 기간 상한은 36개월이다.

### 25·26. 퇴직금 판정·개산액 (PAY-11)

| 항목 | 25. 조회 | 26. 판정 실행 |
|------|---------|--------------|
| 입력 | asOf(선택) | resignationDate · reason |
| 대상 판정 | **계속근로 1년 이상 + 4주 평균 주 15시간 이상**(근로자퇴직급여보장법 §4①). **5인 미만을 포함한 전 사업장 의무**다 | 위와 동일 |
| 평균임금 | 평균임금(일액) = **퇴직일 이전 3개월(역일)**의 임금총액 ÷ 그 기간의 총일수. **중간 몫을 반올림하지 않는다.** **1일 통상임금이 그보다 크면 그것을 평균임금으로 본다**(하한 — **비교 축은 둘 다 일액**이다) | 위와 동일 |
| 개산액 | 퇴직금 ≈ **하한 적용 후 일액** × 30 × (재직일수 ÷ 365). 최종액 earning_item 올림 1원 | 위와 동일 |
| 응답 | eligible · 사유 · 평균임금 · 개산액 · **estimated=true** · 지급 기한(퇴직 후 14일) | 저장된 판정 결과 |
| 실패 | — | **payroll.severance_source_missing/409**(산정에 필요한 확정 급여 부재) |

- **산정 창은 「퇴직일 이전 3개월(역일)」이다** — 완결 급여월 3개가 아니라 **퇴직일에서 달력으로 거슬러 잡는 3개월**이며 분모는 그 구간의 역일수라 **89~92일로 달라진다**(REQ-PAY-09). **기산점이 퇴직일 당일인지 전날인지만 확인이 남았고** 그 하루가 분모를 바꾸므로, **재현 근거가 창의 시작·끝을 함께 동결한다**([../05_database/12_compliance.md](../05_database/12_compliance.md) calc_basis).
- **개산액의 피승수는 평균임금이 아니라 하한 적용 후 일액이다.** 산식을 "평균임금(일액) × 30"으로만 적으면 하한이 적용된 경우와 적용되지 않은 경우가 같은 문장으로 읽혀 **하한이 산식 밖의 부수 규칙처럼 보인다** — 저장 축이 applied_daily_wage인 것이 그 사실을 드러낸다.

- **v1 범위는 대상 판정 + 개산액 + 기한 경보까지**다. 정밀 평균임금 산정(상여 안분 등)은 범위 밖이므로 **개산임을 결과에 명시하고 사업주 확인을 요구한다**(D-10).
- 비대상이면 사유를 명시한다 — 계속근로 1년 미만인지 4주 평균 15시간 미만인지가 갈린다.
- 데이터 모델은 퇴직금 전용이 아니라 **퇴직급여(퇴직금 · DB · DC) 추상**으로 잡는다.

### 28·29. 금품청산 기한 (PAY-19)

| 항목 | 28. 기한 목록 | 29. checkComplianceDeadlines (배치 · 참조) |
|------|--------------|-------------------------------------------|
| 권한 | MANAGER | 시스템 |
| 입력 | status(dueState 3값 중 하나 · 선택) · from · to(기한 범위 · 선택) | — |
| 응답·동작 | 퇴사자별 **퇴직일 + 14일** 마감시계와 미지급 항목 체크리스트(**임금 · 퇴직금 · 연차미사용수당**) | 기한 임박·경과를 감지해 경보한다. 소유 문서는 [10_tax.md](./10_tax.md)다 |
| 근거 | 근로기준법 §36·§109. **소상공인이 가장 자주 어기는 조항**이다 | 실행 시각이 아니라 **기준일 파라미터**로 동작해 재실행 시 같은 결과를 낸다 |

```json
{
  "items": [
    {
      "taskId": "…",
      "employeeId": "…",
      "employeeName": "김민수",
      "resignationDate": "2026-08-10",
      "dueDate": "2026-08-24",
      "remainingDays": 3,
      "status": "DUE_SOON",
      "checklist": [
        { "item": "WAGE", "settled": false, "note": null },
        { "item": "SEVERANCE", "settled": true, "note": null },
        { "item": "UNUSED_LEAVE_ALLOWANCE", "settled": false, "note": null }
      ]
    }
  ]
}
```

| 필드 | 타입 | 내용 |
|------|------|------|
| items | 배열 | **쪽 나눔이 없다.** 한 사업장의 열린 청산 시계는 퇴사자 수만큼이라 쪽을 나눌 규모가 아니고, 목록 봉투(page · range)를 두지 않는 대신 **자원 객체를 감싼 items 하나**만 낸다 |
| taskId | uuid | compliance_tasks 행 식별자. **완료·면제 전이가 이 id를 받는다** |
| employeeId · employeeName | uuid · 문자열 | 대상자. 이름은 employees에서 조인한 표시값이다 |
| resignationDate | date | 퇴직일 — 14일 시계의 기산이다 |
| dueDate | date | 법정 기한(퇴직일 + 14일 · 근기법 §36) |
| remainingDays | JSON number(정수) | 기준일에서 dueDate까지의 일수. **음수면 경과한 일수**이며 화면이 "3일 남음"과 "2일 지남"을 같은 값으로 쓴다 |
| status | 문자열 | **dueState 3값 — UPCOMING · DUE_SOON · OVERDUE**. 아래 절이 이 축을 규정한다 |
| checklist[].item | 문자열 | **WAGE · SEVERANCE · UNUSED_LEAVE_ALLOWANCE 3값**이며 값의 정본은 [../05_database/12_compliance.md](../05_database/12_compliance.md)다 |
| checklist[].settled | boolean | 그 항목을 청산했는가. **원장 jsonb의 키는 done이고 이 응답의 키는 settled다** — 아래 각주 |
| checklist[].note | 문자열 · null | 항목별 비고. 쓰는 쪽이 담지 않으면 null이다 |

**status는 과제 상태가 아니라 14일 시계의 위치다.** 원장 상태(OPEN · COMPLETED · WAIVED)는 "이행했는가"이고 이 열은 "기한까지 얼마 남았는가"라 **축이 다르다** — 한 열에 섞으면 완료된 과제와 임박한 과제가 같은 축으로 정렬되고, 배치가 상태를 쓰게 되는 순간 재실행 결정성이 깨진다([../05_database/12_compliance.md](../05_database/12_compliance.md)). 축과 3값의 정본은 [11_compliance.md](./11_compliance.md) #8이며 이 표면은 **같은 원장을 금품청산 축으로 다시 보여 줄 뿐** 값 집합을 따로 정하지 않는다.

- **이 목록은 열린 과제만 담는다.** COMPLETED·WAIVED는 dueState를 갖지 않으므로 실릴 자리가 없다 — 종단 상태에 남은 일수를 붙이면 목록이 끝난 일을 미이행 건과 같은 축으로 정렬하고 화면이 그것에 경보를 단다.
- **완료·면제는 이 표면의 축이 아니다.** 전이는 compliance_tasks의 표면이 소유한다 — [11_compliance.md](./11_compliance.md) **#14(완료) · #15(면제)**이며 이 문서는 조회만 한다. **만드는 곳과 읽는 곳과 닫는 곳이 각각 갈리는 것이 설계다.**
- **DUE_SOON의 임계일수는 기준값이 정한다** — FILING_DEADLINE의 due_soon_window(제품 파라미터 · **3일** · 사용자 확정 2026-09-10)이며 정본은 [11_compliance.md](./11_compliance.md) dueState 절이다. 서버는 그 행을 읽고 없으면 payroll.missing_reference_value/422로 목록을 차단한다 — 화면이 잠정값을 따로 갖지 않는다. (2026-09-09 등재분 「정본이 아직 없다」는 이날 닫혔다.)
- **체크리스트 키가 층마다 다르다 — 저장은 done · 응답은 settled다.** 원장 jsonb의 키 정본은 [11_compliance.md](./11_compliance.md) #8의 { item, done }이고 이 표면이 그것을 읽어 settled로 바꿔 낸다. **같은 열을 두 모듈이 다른 키로 읽으면 한쪽은 언제나 거짓으로 떨어지는데 예외도 로그도 남지 않는다** — 실제로 이 자리가 원장의 done을 settled로 읽어 **전 항목 미완료로 보이던** 형태였고(2026-09-10 실측·수정) **양쪽 시험이 각자 초록인 채로 남아** 대조하지 않으면 드러나지 않았다. 층을 넘길 때 키를 바꾸는 자리는 여기 하나뿐이며 그 사실을 적어 둔다.

**어긋남 이력 — 서버가 dueState를 내지 않던 자리**(2026-09-10 실측 · 같은 날 해소). 읽기 축 매퍼의 status 파생식이 **COMPLETED · OVERDUE · UPCOMING 3값**을 내고 있어 위 계약과 셋이 갈렸다 — ① DUE_SOON을 내는 분기가 없어 임박이 영원히 오지 않았고 ② 원장 상태 COMPLETED가 이 열에 섞였으며 ③ WAIVED가 걸러지지 않았다. 원장 상태와 기한 파생을 한 열에 담지 않는다는 계약이 이미 [11_compliance.md](./11_compliance.md) #8과 [../05_database/12_compliance.md](../05_database/12_compliance.md)에 있었고 이 표면만 그 축을 따로 만든 자리였다. **해소 형태** — 매퍼는 날짜와 열린 과제(OPEN)만 내고, 파생과 status 필터는 서비스가 DueStateCalc(임계는 위 기준값)로 한다. SQL에 파생식을 두면 임계가 기준값에서 읽히지 않는다.

### 30. GET /v1/workplaces/{workplaceId}/payroll/labor-cost-trend — 인건비 추이 (DSH-03)

| 항목 | 30. 인건비 추이 |
|------|---------------|
| 권한 | MANAGER |
| 입력 | from · to(YYYY-MM · 포함) — **최대 36개월**. 밖 · 역순은 common.validation_failed/400이고 형식 위반은 common.invalid_format/400이다 |
| 응답 | 범위 봉투 — items[payPeriod · runCount · employeeCount · totalGross · employerInsuranceTotal · laborCost] · range(from = 첫 급여월 1일 · to = 마지막 급여월 말일) |
| 모집단 | **확정(CONFIRMED) 실행뿐**이다 · source REGULAR와 IMPORT를 **합산**한다 |
| 금액 | 전부 **서버 합산값**이고 원 단위 JSON 문자열이다. laborCost = totalGross + employerInsuranceTotal |

- **정정 체인의 원본은 세지 않는다** — 정정본을 만들면 원본이 무효(VOIDED)로 전이하므로 확정 모집단에 정정본만 남는다(#18 · #19). 계산 중(DRAFT · CALCULATED)인 실행도 판단의 근거가 아니라 세지 않는다.
- **사업주 부담 보험료가 하나라도 비어 있는 달은 employerInsuranceTotal과 laborCost가 null이다** — 합계는 비어 있는 행을 건너뛰므로 그대로 더하면 그 직원의 부담분이 0원으로 계상돼 **인건비가 과소 표시된다.** totalGross는 그 달에도 싣는다(비어 있는 것은 부담분뿐이다).
- **확정 급여가 없는 달은 항목이 없다.** 0원 항목으로 채우면 "급여가 없었다"와 "아직 확정 전이다"가 같은 모양이 된다 — 빈 달의 표시는 화면의 몫이다. 항목은 급여월 오름차순이다.
- **employeeCount는 그 달 결과가 있는 직원 수**이고 한 직원이 REGULAR와 IMPORT 두 실행에 걸쳐도 한 명이다. runCount는 확정 실행 수다.
- **합계는 서버가 정수로 낸다**(원 단위 · 정확 변환). 화면은 막대 폭을 금액 문자열의 정수 비율로 그리고 금액을 부동소수점으로 다시 계산하지 않는다. 금액 열에 평균 집계를 걸지 않는다.
- **분포 · 예측 · 사업장 간 비교를 두지 않는다** — 확정 결과의 월별 요약 한 장이다(기능 정본 [../02_features/06_payroll.md](../02_features/06_payroll.md)).

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| payroll.missing_reference_value | 422 | 귀속기간·지급일에 필요한 기준값 누락 또는 확인자 미기입. **#17은 원천세 기한 기준값(FILING_DEADLINE) 부재**이며 **details가 누락 키를 [{category, key}] 배열로 내며 없는 키를 전부 담는다**(정본 [01_conventions.md](./01_conventions.md) details 허용 7항) | #7 · #9 · #10 · #15 · **#17** · #26 |
| payroll.missing_payroll_terms | 422 | 급여 기준 부재 또는 지급일 미설정. **근로조건·보험 적용정보 부재도 이 코드로 흡수**한다 | #5 · #9 · #10 |
| payroll.payroll_terms_overlap | 409 | 급여 기준 유효기간 겹침 | #5 · #6 |
| payroll.attendance_not_closed | 409 | 근태 미마감 상태의 계산·확정 시도. **미리보기에는 적용하지 않는다** | #9 · #10 · #17 |
| payroll.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재. 사업장 검증 대기 차단과는 **별개 사유**다 | #9 · #10 · #17 |
| payroll.below_minimum_wage | 422 | 최저임금 미달 — 확정 차단 또는 관리자 명시 확인 요구 | #15 · #17 |
| payroll.already_confirmed | 409 | 동일 **(workplace_id, pay_period, source)** 급여 중복 확정 — **원본·정정본을 통틀어** 급여월에 유효한 확정본은 1건이다. `supersedes_id`를 술어에 두면 정정본이 판정에서 빠진다 | #9 · #10 · #16 · #17 |
| payroll.confirmation_conflict | 409 | 확정·**정정본 발행** 멱등키 충돌. 두 표면이 같은 멱등키 공간을 쓴다 | #17 · #19 |
| payroll.void_forbidden | 403 | 원본 VOID·정정본 발행 권한 없음 — MANAGER 시도, **OWNER 전용**이다 | #18 · #19 |
| payroll.severance_source_missing | 409 | 퇴직금·이직확인서 산정에 필요한 확정 급여 부재 | #25 · #26 |
| workplace.verification_pending | 409 | 검증 대기 사업장의 급여 확정 시도 | #17 |
| workplace.closed | 409 | **정지·폐쇄 사업장의 급여 쓰기 시도** — 실행 생성 · 재계산 · 확정 · 무효화 · 정정본이다. **신설이 아니라 인용**이며 정의는 이미 "SUSPENDED·CLOSED 사업장에서 … 업무 진입 시도"다 | #9 · #10 · #17 · #18 · #19 |
| payslip.download_token_expired | 410 | 임금대장 다운로드 토큰 만료·재사용 | #22 |
| common.not_found | 404 | 급여 실행·직원 결과·기준 이력 부재 또는 존재 은닉 | #6 · #12 · #14 · #17~#22 · #25 |
| common.conflict | 409 | 도메인 전용 코드가 없는 상태 충돌 — 항목 비활성화 대상 부재 등 | #3 · #18 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 · 비과세 한도가 공식 한도 초과 · 범위 조회 기간 상한 초과 | 전 REST 표면 · #2 · #3 · #23 · #24 |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 · **자기포함 급여 실행을 MANAGER가 확정 시도** | 전 사업장 스코프 표면 · #17 |

- **payroll 10종 전량이 이 표에 있다.**
- 정의처가 다른 코드는 발생만 한다 — workplace.verification_pending은 [04_workplace.md](./04_workplace.md), payslip.download_token_expired는 [09_payslip.md](./09_payslip.md)가 정의한다.

- **정지·폐쇄 차단에 코드를 신설하지 않는다.** workplace.closed의 정의가 이미 **SUSPENDED·CLOSED 사업장의 업무 진입**을 담고 있어 급여 쓰기가 그 안에 든다 — **도메인 전용 코드가 없는 상태 충돌이라 common으로 폴백하는 자리가 아니라, 이미 있는 사업장 코드가 정확히 그 사유를 가리키는 자리**다. 에러 코드 전수는 불변이다.
- **정지와 폐쇄를 두 코드로 가르지 않는다.** 헬퍼 is_workplace_writable이 둘을 같은 축으로 판정하고(status IN ('ACTIVE','PENDING_VERIFICATION')만 참), **사업주가 할 수 있는 조치도 같다 — 사업장이 다시 열려야 한다.** 조치가 같은 두 사유에 코드를 나누면 변별력 없이 표만 늘어난다. 어느 상태였는지는 응답 message가 담는다.
- **workplace.unavailable과 축이 다르다.** 그쪽은 **컨텍스트 전환** 시도(REQ-WRK-20)이고 이쪽은 전환을 마친 사업장에서의 **쓰기**다 — 같은 두 상태를 보지만 막는 지점이 다르다.
- **검증 대기(PENDING_VERIFICATION)는 이 코드가 아니다.** 그 상태는 쓰기 가능이고 **급여 확정·명세서 발행만** workplace.verification_pending으로 막는다 — 두 코드가 겹치지 않는 이유이며, 세 상태가 각각 다른 축으로 판정된다.
- **이 차단이 없으면 REQ-WRK-08의 전제가 거짓이 된다** — 그 요구사항이 정지 알림을 필수로 두는 근거가 "사업장이 멈추면 근태·급여가 함께 멈춘다"인데, 급여가 멈추지 않으면 알림만 가고 실제로는 계속 돌아간다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| pay_items | #1 SELECT · #2 INSERT · #3 UPDATE · #9 SELECT | 급여 항목 카탈로그 — type · calc_method · taxable · include_in_ordinary_wage · nontax_limit · sort_order |
| payroll_terms | #4 SELECT · #5 INSERT · #6 UPDATE · #9 SELECT | 직원별 급여 기준 이력 — base_wage · pay_type · **지급일** · effective 겹침 차단 |
| payroll_runs | #9 · #19 INSERT · #11 · #12 · **#30** SELECT · #10 · #17 · #18 UPDATE | 급여 실행 헤더 — pay_period · status · supersedes_id · 멱등키 · 규모 정책·통상임금 규칙·반올림 규칙 버전 동결 |
| payroll_employee_results | #9 · #10 INSERT·UPDATE · #13 · #14 · #23 · #24 · **#30** SELECT | 직원별 결과 — 통상시급 · **divisor** · 평균임금 · 스냅샷 ID · 간이세액표 입력값 · **계산 입력 스냅샷 · 임금대장 법정 기재 4종** 동결 |
| payroll_employee_result_items | #9 INSERT · **#10 DELETE·INSERT** · #14 · #20 SELECT | 항목 라인 — 기준시간 · 단가 · **가산 배수** · 적용 법칙 · **적용 기준값 행 ID와 값**(주·보조) · 보험별 base · **3축 산입 여부** 동결 |
| payroll_validation_results | #9 INSERT · **#10 DELETE·INSERT** · #15 · #16 SELECT | 검증 결과 — 최저임금 미달 · 기준값 누락 · 스냅샷 부재 · **근태 미마감 · 급여 기준 부재** 등 차단·경고 사유 |
| severance_assessments | #26 INSERT · #25 SELECT | 퇴직금 판정 · 개산액 · 기한. **퇴사 확정 트랜잭션도 같은 행을 만든다**([05_hr.md](./05_hr.md) #35) — 그쪽은 확정 급여 부재를 차단이 아니라 **사유 표기**로 다룬다 |
| compliance_tasks | #17 INSERT · #28 SELECT | 금품청산 14일 등 기한 과제. 퇴사 축의 생성 지점은 퇴사 연동 트리거([05_hr.md](./05_hr.md) #35) · 입사 축은 입사 확정([05_hr.md](./05_hr.md) #11)이고 **원천세 축(WITHHOLDING_FILING)의 생성 지점은 #17 확정 트랜잭션**이다. **원천세만 employee_id가 널인 사업장 단위 행**이다 |
| statutory_rates · income_tax_table_entries | #7 · #9 · #10 · #15 · #26 · #27 SELECT | 요율 · 상하한 · 간이세액표 · 비과세 한도 · 가산율 · 반올림 규칙 · SIZE_POLICY 조회 |
| attendance_daily_summaries · attendance_period_closings | #8 · #9 · #10 SELECT | 계산 입력 — LOCKED 마감된 8버킷과 raw 실근로분. **급여는 이 버킷을 받아 쓰고 다시 분해하지 않는다**(아래) |
| leave_requests · leave_transactions | #9 · #10 SELECT | 승인 휴가의 유급/무급 반영과 연차미사용수당 산출 입력 |
| employment_terms · employee_insurance_infos | #7 · #9 · #10 SELECT | 근로조건과 보험 적용정보 — 없으면 **payroll.missing_payroll_terms/422**로 계산을 차단한다 |
| employees | #9 · #13 · #20 · #25 SELECT | 부양가족 수 · 8~20세 자녀 수 · worker_type · 고용형태 |
| workplace_employee_count_snapshots | #9 · #10 · #16 · #17 SELECT | 5인 분기 판정 근거. 없으면 계산·확정을 차단한다 |
| documents | #21 INSERT · #22 SELECT | 임금대장 산출물의 실체·파일 해시·보존기한 |
| payslips | #17 · #18 트리거 | 확정 시 생성 큐 등록 · VOID 시 생성 중단. 계약의 정본은 [09_payslip.md](./09_payslip.md)다 |
| audit_logs | #17 · #18 · #19 INSERT | 확정 · 무효화 · 정정 · 최저임금 강행 확정의 사유 필수 감사 |
| notifications | #17 INSERT | payroll_confirmed |

## 추적성

기능명·우선순위의 정본은 [../02_features/06_payroll.md](../02_features/06_payroll.md)다.

| 기능ID | 표면 |
|--------|------|
| PAY-01 급여 기준 설정 | #1 · #2 · #3 · #4 · #5 · #6 · #7 |
| PAY-02 근태 연동 계산 | #9 · #10 · #12 |
| PAY-03 법정수당 계산 | #9 · #10 · #13 · #14 |
| PAY-04 4대보험 공제 | #9 · #10 · #14 |
| PAY-05 소득세 공제 | #9 · #10 · #14 |
| PAY-06 최저임금 검증 | #15 |
| PAY-07 급여 미리보기 | #8 |
| PAY-08 급여 확정 | #11 · #12 · #16 · #17 · #18 · #19 |
| PAY-09 급여대장(임금대장) | #20 · #21 · #22 |
| PAY-10 급여 이력 | #23 · #24 |
| PAY-11 퇴직금 — 판정·개산액·기한 경보 | #25 · #26 |
| PAY-13 비과세·과세 구분 관리 | #1 · #27 |
| PAY-19 금품청산 기한 관리 | #28 · #29(배치 · 참조) |
| **DSH-03 인건비 추이** | **#30** |

**PAY 13기능과 DSH-03 전수를 담았다**(위 표 14행 — 기능 행의 정본 [../02_features/06_payroll.md](../02_features/06_payroll.md)). 계산 3기능(PAY-03 · PAY-04 · PAY-05)은 독립 실행 표면을 갖지 않는다 — 하나의 계산 파이프라인이 세 결과를 함께 산출하므로 실행은 #9 · #10이고 조회만 갈린다.

## 관련 문서

- 전역 규약·금액 직렬화·멱등·상태코드 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/06_payroll.md](../02_features/06_payroll.md) · 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 요구사항 정본 → [../03_requirements/07_payroll.md](../03_requirements/07_payroll.md) · 반올림·나눗셈·기준값·동결 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 8버킷 정의·마감 입력 → [06_attendance.md](./06_attendance.md) · 휴가 연동 → [07_leave.md](./07_leave.md) · 확정 후 명세서 → [09_payslip.md](./09_payslip.md) · 퇴사 연동 신고 → [10_tax.md](./10_tax.md) · 스냅샷과 규모 정책 → [11_compliance.md](./11_compliance.md)
- 급여 엔진 결정론 파이프라인 → [../04_architecture/06_payroll_engine.md](../04_architecture/06_payroll_engine.md)
- 테이블 명세 → [../05_database/06_payroll.md](../05_database/06_payroll.md)
- 확정 의사결정(D-16 · D-17) → [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
