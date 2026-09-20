# 추적성 매트릭스 — 기능 ↔ REQ ↔ 화면 ↔ API ↔ 테이블 (17_traceability)

> **대상**: insadesk v1 — 기능 **98** · REQ **281** · 화면 **55** · API 표면 **267** · 테이블 61의 5축 전수 대조표
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **D-23 채택 4기능 · 일괄 처리 · 내보내기 반영** — 기능 94 → **98**(AUT-05 · ATT-10 · DSH-03 · DSH-06) · REQ 274 → **281**(REQ-AUT-26 · WRK-37 · ATT-21 · ATT-22 · LEV-14 · PAY-36 · SYS-17) · API 표면 258 → **267**(03_auth #17 · 04_workplace #35 · #36 · 06_attendance #28 · #29 · 07_leave #16 · #17 · 08_payroll #30 · 14_system #36). §1 개괄 · §2의 AUT · WRK · ATT · LEV · PAY · SYS 절과 전체 검산 · §4 · §5 대조 축 · §6 교차 정합을 같은 변경 단위에서 다시 셌다. **DSH 행은 소유 도메인 절에 둔다**(DSH-06 → WRK 절 · DSH-03 → PAY 절) — DSH-06의 REQ는 사업장 축 REQ-WRK-37과 시스템 콘솔 축 REQ-SYS-17 둘이며 **§2에서는 DSH-06 한 행에 함께 적어 WRK 절이 센다**(SYS 절 REQ 수는 SYS 기능 7행의 16이다). **ATT-10은 자체 표면이 없다** — 기존 조회 표면 넷의 조합이며 그 표면들은 이미 소유 문서에서 계수됐다. 화면 표면 없는 기능 2 → **3**(DSH-06 (전역))
> **개정일**: 2026-09-12 — **PAY-07(급여 미리보기)의 핵심 테이블 열을 입력 축으로 정정한다** — payroll_runs · payroll_employee_results · payroll_validation_results 를 적고 있었으나 정본이 「**payroll_runs 행을 만들지 않는다** · payroll_validation_results 에 적재되지도 않는다」다([../06_api/08_payroll.md](../06_api/08_payroll.md) #8). **문서가 요구사항 위반을 지시하던 자리**이며, 미리보기는 저장하지 않는 표면이므로 열은 **읽는 입력**(payroll_terms · attendance_daily_summaries · workplace_employee_count_snapshots · statutory_rates · income_tax_table_entries)이다. **표면 수 · 기능 94 · REQ 총수 · 화면 55 · 테이블 61은 전건 불변**
> **개정일**: 2026-09-10 — 핵심 테이블 열 정합 — **HRM-03에 compliance_tasks**(입사 확정이 4대보험 취득 과제를 연다 — [../06_api/05_hr.md](../06_api/05_hr.md) #11 · 종전 미결 해소) · **HRM-04에 severance_assessments** · **PAY-08에 compliance_tasks**(원천세 과제)를 더한다. **표면이 늘지 않았으므로 API 표면 258 · 기능 94 · REQ 총수 · 화면 55는 전건 불변**이다. 함께 **HRM 검산의 표면 수 35 → 36을 정정**한다 — 2026-08-20에 05_hr #36이 신설되고 HRM-07 행에 등재됐는데 **검산식만 그대로 남아 있었다**(열거는 이미 36을 세고 있었다)
> **개정일**: 2026-09-10 — 인용 갱신 — 에러 코드 119 → **120종**(workplace.mgmt_no_required/422 신설 — 신고자료의 빈 관리번호 계열. 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)). **16네임스페이스는 불변**이다 — 발생 표면은 TAX 이지만 부재한 값이 사업장의 것이라 workplace 가 갖는다 · 담당 95 → **96**
> **개정일**: 2026-09-10 — 파생 집계 정합 — **API 표면 256 → 258**(REST 228 → **230**). [../06_api/14_system.md](../06_api/14_system.md)가 표면 2건을 채번해 그 문서 표면 33 → **35**다(**#34** 정기작업 재실행 · **#35** 약관 문서 단건 전문). §1 대조 축 · §2의 SYS-11 행 · §5 검산 · §6 교차 정합 축을 같은 변경 단위에서 다시 셌다. **#34는 기능ID를 갖지 않는 첫 표면**이라 §2의 대조 축 밖이며 **새 기능 없이 표면만 등재하는 표를 SYS 절 말미에 신설**했다(§6 검증 행에도 그 사실을 적었다) — 정기작업은 94기능 집계 밖인 서버 실행 항목이고(정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)) 표를 채우려 기능ID를 채번하면 **기능 94가 움직인다**. 화면 자리는 **SYS-RATES 운영 절**이라 화면 55도 불변이다. **기능 94 · REQ 274 · 화면 55 · 테이블 61 · 에러 코드 · enum 33/132는 전건 불변**
> **개정일**: 2026-09-10 — 파생 집계 정합 — **화면 54 → 55본**(ADM 30 → **31**). 관리자 웹 홈 대시보드 **ADM-HOME 신설**(정본 [../07_screen/README.md](../07_screen/README.md))이며 **기능ID를 소유하지 않아** §2의 8행 화면 열에 표시 수식어로만 더해진다 — WRK-14 · ATT-07 · ATT-08 · LEV-03 · PAY-08 · TAX-11 · NTF-01 · SUB-05. 대상 메타 · §1 대조 축 · §5 대조 축 · §6 교차 정합 축 둘을 같은 변경 단위에서 다시 셌다. **홈은 조회 전용이고 전부 기존 표면을 읽으므로 API 표면 256은 불변**이며 **기능 94 · REQ 274 · 테이블 61 · 에러 코드 119 · enum 33/132도 전건 불변**이다
> **개정일**: 2026-09-09 — 파생 집계 정합 — **API 표면 255 → 256**(REST 227 → **228**). [../06_api/11_compliance.md](../06_api/11_compliance.md)의 기한 과제 전이가 **PATCH 하나에서 POST 둘**로 갈려 그 문서 표면 13 → **14**다(#9 폐지·결번 · #14 완료 · #15 면제). §1 대조 축 · §2의 TAX-11·CMP-04 행 · §5 검산 · §6 교차 정합 축·검증 절차를 같은 변경 단위에서 다시 셌다. **표면 계수의 축이 행 수이지 최대 번호가 아님**을 §6 검증 행에 명시했다 — 결번이 생긴 첫 문서라 그 구분이 처음 실제로 필요해졌다. **기능 94 · REQ 274 · 화면 54 · 테이블 61 · 에러 코드 119 · enum 33/132는 전건 불변**
> **개정일**: 2026-09-07 — 테이블 축 정합 — **V0711**(idempotency_records 신설)로 테이블 60 → **61종**이며 §1 대조 축 · §2 도입 문장 · §5 대조 축 · §6 교차 정합 축의 인용을 함께 다시 셌다. **신설 테이블은 기능ID에 귀속되지 않는 횡단 원장**이라 §2의 어느 기능 행에도 등장하지 않으며 scheduled_job_runs와 같은 형태의 **횡단 귀속**으로 등재한다(다만 scheduled_job_runs는 WRK-04에 참조로 등재돼 §2에 등장한다). §2 등장 판정을 **60종 등장 · 횡단 귀속 1종 미등장**으로 재서술했다. **기능 94 · REQ 274 · 화면 54 · API 표면 255 · 에러 코드 119 · enum 33/132는 전건 불변**
> **개정일**: 2026-09-06 — 파생 집계 정합 — 2026-08-21 개정이 놓친 에러 코드 인용 3자리를 118 → **119종**으로(§5 뿌리 분석의 현재 값 · §6 대조 축의 에러 코드 행 · 관련 문서 링크 설명). **§5의 1~4번 해소 이력 행은 그 시점의 기록이므로 고치지 않는다** — 이력을 현재 값으로 덮으면 무엇이 언제 어긋났는지 추적할 수 없다. 매핑·표면 255·화면 54·테이블 60 집계는 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21) 반영 — 저장소 경로 표기 back/ → **backend/**. **추적성 매핑·집계는 불변**
> **개정일**: 2026-08-21 — 에러 코드 118 → **119종** 인용 갱신(workplace.business_unit_overlap/409 신설 — 담당 94 → **95**)
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정 반영(2차 · 04_workplace 응답 필드 2종과 03_auth 동의 출처 표기 정정을 리드 승인 아래 포함) — API 표면 253 → **255**(05_hr 35 → **36** 본인 계약 상세 #36 · 09_payslip 18 → **19** 본인 미열람 명세서 수 #19) · HRM-07 · HRM-09 · SLP-03 행의 API 열 갱신 · 검산식 4곳 재계수 · **HRM-09 화면 열 확장**(APP-ATTENDANCE · APP-LEAVE 본인 증빙 — 정본 [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md)를 먼저 고치고 파생 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)와 본 표를 뒤이어 정렬) · **CMP-07 집행 표면 열거에 05_hr #36 추가** · §5 미해소 3건 등재 후 **전건(7 · 8 · 9) 해소** — 9번은 03_auth #8 요약 열거 보충으로 닫혔다
> **개정일**: 2026-08-09 — 전역 수치 정합 — §5 대조 축의 테이블 행 58 → **60**(대상 메타·§6은 이미 60이었고 그 행만 잔재였다)
> **개정일**: 2026-08-08 — LEV-03 행 API 열에 07_leave #3(대기 목록 조회) 추가해 API 정본의 추적성 절과 일치시킴
> **개정일**: 2026-08-03 — 정본 갱신 반영: API 표면 246 → **253**(06_attendance 25 → **27** · 11_compliance 11 → **13** · 14_system 30 → **33**) · PAY-08 기능명 **급여 확정**으로 개명 · 화면 열 18행 재대조((배치) 병기 확대 · 근태 대리 작성/승인 축 이동) · §5 종전 등재 4건 전건 해소 확인 후 신규 2건 등재
> **원천**: [../02_features/README.md](../02_features/README.md)(기능 98 채번 정본) · 본 폴더 01~16(REQ 281 정본) · [../07_screen/02_traceability.md](../07_screen/02_traceability.md)(기능 → 화면 매핑 정본) · [../07_screen/README.md](../07_screen/README.md)(화면 55본 인벤토리) · [../06_api/README.md](../06_api/README.md)와 도메인 13본의 추적성 절(API 표면) · [../05_database/README.md](../05_database/README.md)(테이블 58 이름 집합)

> **이 문서의 지위**: **본 매트릭스는 각 정본에서 파생한 전수 대조표다. 어긋나면 각 정본이 우선하며 이 표를 근거로 정본을 바꾸지 않는다.** 기능ID는 02_features, REQ는 본 폴더 도메인 파일의 기능 단위 H2 구성, 화면 코드는 07_screen, API 표면은 06_api, 테이블명은 05_database가 각각 정본이다.

§2에서 기능 98개를 전수 매핑하며 **미매핑이 0**임을 보장한다. 미매핑·불일치가 생기면 여기서 먼저 드러나야 하므로 발견분을 지우지 않고 §5에 등재한다. 기능·REQ·화면·API·테이블을 추가·변경·삭제하면 같은 변경 단위에서 본 문서를 다시 센다([../CLAUDE.md](../CLAUDE.md) 추적성 동시 갱신).

---

## 고정 기준

수치의 정본은 [../README.md](../README.md) 고정 기준 표이며, REQ 총수만 [README.md](./README.md)가 정본이다. 아래는 본 문서가 대조에 쓰는 값과 그 검산식이다.

| 축 | 값 | 정본 | 검산 |
|------|----|------|------|
| 기능 | **98** | [../02_features/README.md](../02_features/README.md) | AUT 10 + WRK 13 + HRM 11 + ATT 12 + LEV 5 + PAY 13 + SLP 7 + TAX 3 + CMP 5 + NTF 3 + SUB 5 + SYS 7 + PRV 2 + DSH 2 = **98** |
| REQ | **281** | [README.md](./README.md) | 도메인 231 + GLB 20 + NFR 16 + TEC 14 = **281**. 도메인 231 = AUT 26 + WRK 37 + HRM 28 + ATT 22 + LEV 14 + PAY 36 + SLP 16 + TAX 5 + CMP 10 + NTF 6 + SUB 9 + SYS 17 + PRV 5 |
| 화면 | **55본** | [../07_screen/README.md](../07_screen/README.md) | PUB 7 + APP 10 + ADM **31** + SYS 7 = **55** |
| API 표면 | **267** | [../06_api/README.md](../06_api/README.md) | REST 238 + SSE 1 + 다운로드 7 + 서버 내부 21 = **267**. 문서별 검산: 17 + 36 + 36 + 29 + 17 + 30 + 19 + 12 + 14 + 7 + 7 + 36 + 7 = **267** |
| 테이블 | **61종** | [../05_database/README.md](../05_database/README.md) | 7 + 9 + 9 + 6 + 6 + 6 + 3 + 2 + 2 + 2 + 4 + 1 + 4 = **61** |
| 에러 코드 | **120종 · 16네임스페이스** | [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) | 담당 **96** + ATT·LEV·PAY 24 = **120**(폐기 2종 제외) |
| enum | **33종 · 값 132** | [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) | legacy 승계 23 + 신설 10 = **33** |
| 인수 기준 | **AC-01~15** | [16_acceptance_criteria.md](./16_acceptance_criteria.md) | 원천 골든 케이스 G-01~G-15와 1대 1 = **15** |

**기능ID의 결번은 v1 범위 제외를 뜻하는 의도된 공백**이며 REQ에는 결번이 없다 — 접두사 16종 전부가 01부터 연속 채번이다(대조 방법은 §6).

---

## 1. 도메인별 추적성 개괄

**이 절은 도메인 단위 개괄이며 화면·테이블 열은 전수 열거가 아니다.** 각 도메인의 주 무대와 핵심 저장소를 한눈에 보이는 것이 목적이며, **기능 단위 전수 정본은 §2**다. 구현 대상 화면·테이블을 판단할 때는 이 절이 아니라 §2를 본다. 두 열거를 합집합으로 맞추지 않는 이유는 같은 사실의 정본을 둘로 만들지 않기 위해서다.

| 도메인 | 기능ID 범위 | REQ 범위 | 주 화면 | 핵심 테이블 |
|--------|------------|----------|---------|-------------|
| AUT 인증·계정 | AUT-01~10 (10) | REQ-AUT-01~26 | PUB-SIGNUP · PUB-LOGIN · PUB-PASSWORD-RESET · ADM-ACCOUNT · APP-SETTINGS | users · profiles · account_status_events · security_events · password_reset_tokens |
| WRK 사업장·멤버·온보딩 | WRK-01~11 · 14 · 16 (13) · DSH-06 | REQ-WRK-01~37 | ADM-WORKPLACE-CREATE · ADM-WORKPLACE-SELECT · ADM-WORKPLACE-SETTINGS · ADM-MEMBERS · ADM-IMPORT · APP-INVITE | workplaces · workplace_members · workplace_invitations · workplace_change_logs · membership_role_events · business_verification_logs · business_units · import_jobs |
| HRM 인사 | HRM-01~07 · 09 · 11 · 14 · 16 (11) | REQ-HRM-01~28 | ADM-EMPLOYEE-LIST · ADM-EMPLOYEE-DETAIL · ADM-EMPLOYEE-RESIGN · ADM-CONTRACTS · ADM-DOCUMENTS · APP-CONTRACT | employees · employee_personal_infos · employment_terms · employee_insurance_infos · employee_insurance_histories · contract_templates · contracts · contract_signatures · documents |
| ATT 근태 | ATT-01~10 · 12 · 13 (12) | REQ-ATT-01~22 | APP-CHECKIN · APP-ATTENDANCE · ADM-ATTENDANCE · ADM-HOME · ADM-ATTENDANCE-APPROVAL · ADM-ATTENDANCE-CLOSING · ADM-SCHEDULE | attendance_records · attendance_breaks · attendance_daily_summaries · attendance_change_requests · attendance_period_closings · work_schedules |
| LEV 휴가·연차 | LEV-01~04 · 06 (5) | REQ-LEV-01~14 | APP-LEAVE · ADM-LEAVE-APPROVAL · ADM-LEAVE-BALANCE | leave_types · leave_grants · leave_requests · leave_transactions · leave_balances |
| PAY 급여 | PAY-01~11 · 13 · 19 (13) · DSH-03 | REQ-PAY-01~36 | ADM-HOME · ADM-PAYROLL-TERMS · ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · ADM-PAYROLL-LEDGER · ADM-SEVERANCE · APP-PAYROLL-HISTORY | pay_items · payroll_terms · payroll_runs · payroll_employee_results · payroll_employee_result_items · payroll_validation_results · severance_assessments |
| SLP 명세서 | SLP-01~07 (7) | REQ-SLP-01~16 | ADM-PAYSLIP · APP-PAYSLIP · APP-NOTIFICATION | payslips · payslip_deliveries · batch_jobs · documents |
| TAX 세무·4대보험 신고 | TAX-01 · 02 · 11 (3) | REQ-TAX-01~05 | ADM-TAX-FILING · ADM-TAX-SEPARATION · ADM-DEADLINE-CALENDAR | compliance_tasks · employee_insurance_infos · payroll_employee_results |
| CMP 법정 준수 | CMP-01 · 02 · 04 · 07 · 08 (5) | REQ-CMP-01~10 | ADM-EMPLOYEE-COUNT · ADM-BUSINESS-UNIT · ADM-RETENTION · SYS-POLICY | workplace_employee_count_snapshots · employee_count_snapshot_days · compliance_tasks · business_units · documents |
| NTF 알림 | NTF-01 · 03 · 04 (3) | REQ-NTF-01~06 | APP-NOTIFICATION | notifications · notification_types |
| SUB 구독 | SUB-01~05 (5) | REQ-SUB-01~09 | ADM-SUBSCRIPTION · SYS-SUBSCRIPTIONS · PUB-PRICING | plans · subscriptions |
| SYS 시스템 관리 | SYS-01 · 03 · 04 · 05 · 07 · 08 · 11 (7) · DSH-06(시스템 축) | REQ-SYS-01~17 | SYS-WORKPLACES · SYS-USERS · SYS-SUBSCRIPTIONS · SYS-RATES · SYS-AUDIT · SYS-TERMS | system_admins · audit_logs · statutory_rates · income_tax_table_entries · terms_documents · export_jobs |
| PRV 개인정보·위치정보 | PRV-01 · 02 (2) | REQ-PRV-01~05 | APP-PRIVACY · PUB-CONSENT · PUB-LEGAL | location_usage_records · user_consents · terms_documents |

횡단 REQ 50건은 특정 기능에 귀속되지 않는다 — REQ-GLB 20(전 도메인 계산·저장·인가 불변식) · REQ-NFR 16(성능·접근성·렌더링·안정성) · REQ-TEC 14(배포·환경·정기작업·시크릿·마이그레이션)이며 귀속 판정은 §4가 정본이다.

---

## 2. 기능 98 전수 매핑 (미매핑 0)

화면 코드 열은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)의 값을 그대로 인용하며 (서버)·(전역)·(배치)·(진입점) 등 병기 표기도 그 문서와 일치시킨다. REQ 열은 각 도메인 파일에서 그 기능의 H2 아래 등재된 REQ ID 전부다. API 문서 열은 문서 이름 어간 + 표면 지역 번호(#N)이며 정본은 각 06_api 도메인 문서의 추적성 절이다. 핵심 테이블 열은 05_database 이름 집합 **61종**에서만 고른다.

### AUT 인증·계정 (10)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| AUT-01 회원가입 | REQ-AUT-01·02·03·04·05 | PUB-SIGNUP · PUB-LANDING(진입점) · PUB-PRICING(진입점) | 03_auth #1 | users · profiles · user_consents · terms_documents |
| AUT-02 로그인 | REQ-AUT-08·09·10 | PUB-LOGIN · PUB-LANDING(진입점) | 03_auth #3 | users · profiles · security_events |
| AUT-03 세션 관리 | REQ-AUT-11·12·13 | PUB-LOGIN(복귀 경로 보존) · APP-SETTINGS(로그아웃) · (전역) | 03_auth #4 · #5 · #6 · #7 · #16(서버) | users · profiles |
| AUT-04 아이디 중복 확인 | REQ-AUT-06·07 | PUB-SIGNUP | 03_auth #2 | users |
| AUT-05 프로필 관리 | REQ-AUT-26 | ADM-ACCOUNT | 03_auth #17 | profiles · security_events |
| AUT-06 비밀번호 변경 | REQ-AUT-14·25 | ADM-ACCOUNT · APP-SETTINGS | 03_auth #9 · #10 | users · security_events |
| AUT-07 비밀번호 재설정 | REQ-AUT-15·16 | PUB-PASSWORD-RESET | 03_auth #11 · #12 | password_reset_tokens · users · security_events |
| AUT-08 계정 상태 머신 | REQ-AUT-17·18·19 | SYS-USERS(제재 실행) · PUB-LOGIN(차단 발현) · ADM-ACCOUNT · APP-SETTINGS · (배치) | 03_auth #7 · #15(배치) | users · account_status_events |
| AUT-09 계정 삭제(탈퇴) | REQ-AUT-20·21·22 | ADM-ACCOUNT · APP-SETTINGS | 03_auth #13 · #14 | users · account_status_events · **workplace_members** · workplaces |
| AUT-10 진입 컨텍스트 분기 | REQ-AUT-23·24 | PUB-LOGIN · ADM-WORKPLACE-SELECT · PUB-SIGNUP(진입 분기) · PUB-CONSENT(연계) | 03_auth #8 | workplace_members · system_admins |

검산: 기능 **10행**(결번 없음) · REQ 5 + 3 + 3 + 2 + 1 + 2 + 2 + 3 + 3 + 2 = **26** · API 표면 #1~#17 전수 등장 = **17**([../06_api/03_auth.md](../06_api/03_auth.md)) · 화면 표면 없는 기능 **0**.

### WRK 사업장·멤버·온보딩 (13 · DSH 1)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| WRK-01 사업장 등록 | REQ-WRK-01·02·03·06 | ADM-WORKPLACE-CREATE · ADM-WORKPLACE-SELECT(진입점) | 04_workplace #1 | workplaces · business_units · workplace_members |
| WRK-02 사업자 진위/상태 검증 | REQ-WRK-04·05·07 | ADM-WORKPLACE-CREATE · (서버) | 04_workplace #2 | business_verification_logs · workplaces |
| WRK-03 사업장 정보 관리 | REQ-WRK-09·10·11 | ADM-WORKPLACE-SETTINGS | 04_workplace #3 · #4 · #5 · #6 | workplaces · workplace_change_logs |
| WRK-04 직원 초대 | REQ-WRK-12·13·14 | ADM-MEMBERS · (배치) | 04_workplace #9 · #10 · #11 · #12 · #33(배치) | workplace_invitations · workplace_members · **scheduled_job_runs**(만료 배치 이력) |
| WRK-05 초대 수락/거절 | REQ-WRK-15·16·17·18 | APP-INVITE · ADM-WORKPLACE-SELECT(대기 표시) · (배치) | 04_workplace #13 · #14 · #15 · #16 · #33(배치) | workplace_invitations · workplace_members · employees |
| WRK-06 사업장 선택/전환 | REQ-WRK-19·20 | ADM-WORKPLACE-SELECT · APP-SETTINGS · ADM-ACCOUNT(진입점) | 04_workplace #17 · #18 | workplace_members · workplaces |
| WRK-07 멤버 역할 관리 | REQ-WRK-21·22·23 | ADM-MEMBERS | 04_workplace #21 · #22 | workplace_members · membership_role_events |
| WRK-08 멤버 목록·검색 | REQ-WRK-24·25 | ADM-MEMBERS | 04_workplace #19 · #20 | workplace_members · employees |
| WRK-09 멤버 제외 | REQ-WRK-26·27·28 | ADM-MEMBERS | 04_workplace #23 · #24 | workplace_members · membership_role_events |
| WRK-10 사업장 폐쇄 | REQ-WRK-36 | ADM-WORKPLACE-SETTINGS | 04_workplace #25 · #26 | workplaces · workplace_change_logs |
| WRK-11 사업장 등록 한도 | REQ-WRK-29·30·31 | ADM-WORKPLACE-CREATE · ADM-WORKPLACE-SELECT(표시) · ADM-SUBSCRIPTION(표시) | 04_workplace #1(게이팅 실행 지점) · 13_subscription #3(사용량 조회 — 번호 출처는 [../06_api/README.md](../06_api/README.md) 기능 커버리지 표) | plans · subscriptions · workplaces |
| WRK-14 사업장 검증 상태 관리 | REQ-WRK-08 | ADM-WORKPLACE-SETTINGS · ADM-WORKPLACE-CREATE(검증 대기 생성) · ADM-HOME(경고) · (서버) | 04_workplace #7 · #8 · #34(서버) | workplaces · business_verification_logs |
| WRK-16 데이터 온보딩·일괄 임포트 | REQ-WRK-32·33·34·35 | ADM-IMPORT | 04_workplace #27 · #28 · #29 · #30 · #31 · #32 | import_jobs · employees · employment_terms |
| DSH-06 리포트 내보내기 | REQ-WRK-37 · REQ-SYS-17(시스템 콘솔 축 — 소유 파일 13_system) | **(전역)** — 관리자 웹 · 시스템 웹 목록 화면의 표 상단 공통 조작 | 04_workplace #35 · #36 · 14_system #36 | audit_logs |

검산: 기능 **14행**(WRK 13 · DSH-06 — WRK-12 · 13 · 15는 v1.1 이월 결번) · REQ 4 + 3 + 3 + 3 + 4 + 2 + 3 + 2 + 3 + 1 + 3 + 1 + 4 + 2 = **38**(DSH-06 행이 REQ-SYS-17을 함께 센다) · API 표면 #1~#36 전수 등장 = **36**([../06_api/04_workplace.md](../06_api/04_workplace.md)) · 화면 표면 없는 기능 **1**(DSH-06 — 전 목록 화면 공통 조작이라 (전역)).

### HRM 인사 (11)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| HRM-01 직원 인적사항 | REQ-HRM-01·02·03·04·05 | ADM-EMPLOYEE-DETAIL · APP-SETTINGS(본인 조회·변경 요청) | 05_hr #1 · #2 · #3 · #4 · #5 · #6 · #7 | employees · employee_personal_infos · notifications |
| HRM-02 고용형태/근로조건 | REQ-HRM-06·07·08 | ADM-EMPLOYEE-DETAIL | 05_hr #8 · #9 · #10 | employment_terms · employees |
| HRM-03 입사 처리 | REQ-HRM-09·10·11 | ADM-EMPLOYEE-LIST | 05_hr #2 · #11 | employees · workplace_members · **compliance_tasks** |
| HRM-04 퇴사 처리 | REQ-HRM-12·13·14·15 | ADM-EMPLOYEE-RESIGN | 05_hr #12 · #13 · #35(서버) | employees · workplace_members · compliance_tasks · **severance_assessments** |
| HRM-05 4대보험 정보 | REQ-HRM-16·17·18 | ADM-EMPLOYEE-DETAIL | 05_hr #14 · #15 · #16 · #17 | employee_insurance_infos · employee_insurance_histories |
| HRM-06 근로계약서 작성 | REQ-HRM-19·20 | ADM-CONTRACTS · APP-CONTRACT(수신) | 05_hr #18 · #19 · #20 · #21 · #22 · #23 | contract_templates · contracts |
| HRM-07 근로계약 전자서명 | REQ-HRM-21·22 | APP-CONTRACT · ADM-CONTRACTS(현황) | 05_hr #24 · #25 · #26 · #30 · #36 | contract_signatures · contracts · documents |
| HRM-09 직원 문서함 | REQ-HRM-23·24 | ADM-DOCUMENTS · APP-CONTRACT(본인 공개 문서) · APP-ATTENDANCE(본인 증빙) · APP-LEAVE(본인 증빙) | 05_hr #27(본인 증빙 축 포함) · #28 · #29 · #30 | documents |
| HRM-11 근로자명부 | REQ-HRM-25 | ADM-EMPLOYEE-LIST | 05_hr #31 · #32 · #30 | employees · employment_terms |
| HRM-14 연소자 고용 관리 | REQ-HRM-26·27 | ADM-EMPLOYEE-DETAIL · ADM-SCHEDULE(배치 차단) | 05_hr #33 | employees · employee_personal_infos · work_schedules |
| HRM-16 근로자 아닌 자 구분 | REQ-HRM-28 | ADM-EMPLOYEE-DETAIL | 05_hr #34 | employees |

검산: 기능 **11행**(HRM-08 · 10 · 12 · 13 · 15는 v1.1 이월 결번) · REQ 5 + 3 + 3 + 4 + 3 + 2 + 2 + 2 + 1 + 2 + 1 = **28** · API 표면 #1~#36 전수 등장 = **36**([../06_api/05_hr.md](../06_api/05_hr.md) · #30은 세 기능이 공유하는 단일 스트리밍 종점) · 화면 표면 없는 기능 **0**.

### ATT 근태 (12)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| ATT-01 출근/퇴근 체크인 | REQ-ATT-01·02·05 | APP-CHECKIN | 06_attendance #1 · #2 · #3 · #4 · #5 · #6 | attendance_records · location_usage_records |
| ATT-02 지오펜스 검증 | REQ-ATT-03·04 | APP-CHECKIN · ADM-ATTENDANCE(예외 승인) · (서버) | 06_attendance #1 · #2(서버 재검증 단계) · #5 · #6(판정 결과 마무리) | workplaces · attendance_records |
| ATT-03 휴게시간 기록 | REQ-ATT-06 | APP-CHECKIN · APP-ATTENDANCE(표시) · ADM-ATTENDANCE(표시) | 06_attendance #7 · #8 | attendance_breaks |
| ATT-04 지각/조퇴/결근 판정 | REQ-ATT-09 | APP-ATTENDANCE(판정 표시) · ADM-ATTENDANCE · APP-CHECKIN(결과 표시) · (서버) · (배치) | 06_attendance #9 · #10 · #27(배치) | attendance_daily_summaries · work_schedules |
| ATT-05 연장/야간/휴일 집계 | REQ-ATT-10·11·12·13·14 | APP-ATTENDANCE(집계 표시) · ADM-ATTENDANCE · (서버) · (배치) | 06_attendance #9 · #10 · #27(배치) | attendance_daily_summaries · statutory_rates · workplace_employee_count_snapshots |
| ATT-06 근태 수정 요청 | REQ-ATT-16 | APP-ATTENDANCE · ADM-ATTENDANCE(대리 제출) · ADM-ATTENDANCE-APPROVAL(대기 목록) · APP-CHECKIN(진입점) | 06_attendance #11 · #12 · #13 | attendance_change_requests |
| ATT-07 근태 승인 | REQ-ATT-17·21 | ADM-ATTENDANCE-APPROVAL · ADM-ATTENDANCE(대리 승인) · ADM-HOME(대기 표시) | 06_attendance #14 · #15 · #28 · #29 | attendance_change_requests · attendance_records · attendance_daily_summaries |
| ATT-08 근태 마감 | REQ-ATT-18·19·20 | ADM-ATTENDANCE-CLOSING · APP-ATTENDANCE(표시) · ADM-HOME(상태 표시) | 06_attendance #16 · #17 · #18 · #19 · #20 | attendance_period_closings · attendance_daily_summaries |
| ATT-09 근무 스케줄 | REQ-ATT-08 | ADM-SCHEDULE | 06_attendance #21 · #22 · #23 · #24 | work_schedules |
| ATT-10 실시간 근태 현황 | REQ-ATT-22 | ADM-HOME | 06_attendance #4 · #21 · 07_leave #3 · 05_hr #1(조합 — 자체 표면 없음) | attendance_records · work_schedules · leave_requests · employees |
| ATT-12 휴게시간 준수 검증 | REQ-ATT-07 | ADM-ATTENDANCE-CLOSING · ADM-ATTENDANCE(위반 표시) · APP-CHECKIN(안내) · APP-ATTENDANCE(표시) · (서버) | 06_attendance #25 | attendance_breaks · attendance_daily_summaries |
| ATT-13 근로시간 한도 경고 | REQ-ATT-15 | ADM-SCHEDULE · ADM-ATTENDANCE(경고) · (서버) | 06_attendance #26 | attendance_daily_summaries · statutory_rates |

검산: 기능 **12행**(ATT-11 · 14 · 15는 v1.1 이월 결번) · REQ 3 + 2 + 1 + 1 + 5 + 1 + 2 + 3 + 1 + 1 + 1 + 1 = **22** · API 표면 #1~#29 전수 등장 = **29**([../06_api/06_attendance.md](../06_api/06_attendance.md)) · 화면 표면 없는 기능 **0**.

**신설 표면 #5·#6은 ATT-01·ATT-02에 귀속된다** — 정확도 저하로 PENDING 저장된 체크인 레코드를 사람이 승인·반려해 마무리하는 경로이며, 지오펜스 판정 자체를 클라이언트가 요청하는 표면이 아니다. 이에 따라 종전 #5 이후 번호가 2씩 밀렸고 일 롤업 배치는 #25 → **#27**로 이동했다. **근태 대리 작성·승인 축은 ATT-01에서 ATT-06·ATT-07로 옮겨졌다** — 대리 제출은 수정 요청, 대리 승인은 승인 기능의 표면이다.

### LEV 휴가·연차 (5)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| LEV-01 연차 자동 산정 | REQ-LEV-01·02·03·04·05·06·07 | ADM-LEAVE-BALANCE · **ADM-EMPLOYEE-DETAIL(보호 기간 등록)** · APP-LEAVE(결과 표시·미적용 표시) · (배치) | 07_leave #10 · #11 · #12 · #14(배치) | leave_grants · leave_transactions · leave_balances · **employee_protected_periods** · workplace_employee_count_snapshots |
| LEV-02 휴가 신청 | REQ-LEV-08·09 | APP-LEAVE · ADM-LEAVE-APPROVAL(대기 목록) | 07_leave #1 · #2 · #3 · #4 · #5 | leave_requests · leave_types · leave_transactions |
| LEV-03 휴가 승인 | REQ-LEV-10·14 | ADM-LEAVE-APPROVAL · APP-LEAVE(결과 표시) · ADM-HOME(대기 표시) | 07_leave #3 · #5 · #6 · #7 · #16 · #17 | leave_requests · leave_transactions · attendance_daily_summaries |
| LEV-04 잔여 연차 조회 | REQ-LEV-06 · REQ-LEV-01(참조 — 소유 절은 LEV-01) | APP-LEAVE · ADM-LEAVE-BALANCE | 07_leave #8 · #9 · #11 | leave_balances · leave_transactions |
| LEV-06 급여 연동 | REQ-LEV-11·12·13 | ADM-LEAVE-BALANCE(표시) · ADM-PAYROLL-PREVIEW(표시) · ADM-PAYROLL-RUN(표시) · (서버) | 07_leave #13 · #15(서버) | leave_transactions · leave_balances · statutory_rates |

검산: 기능 **5행**(LEV-05 · 07 · 08은 v1.1 이월 결번) · REQ 7 + 2 + 2 + 0 + 3 = **14** · API 표면 #1~#17 전수 등장 = **17**([../06_api/07_leave.md](../06_api/07_leave.md)) · 화면 표면 없는 기능 **0**.

**employee_protected_periods(테이블 59)의 화면 귀속은 ADM-EMPLOYEE-DETAIL이다.** v1에 전용 화면을 신설하지 않으며 근거는 셋이다 — ① 등록 단위가 **직원 1명의 인사 이벤트**(출산전후휴가·육아휴직·산재 휴업)이고 직원 상세가 이미 휴직·보험·근로조건 같은 직원 단위 속성의 등록 표면이다 ② ADM-LEAVE-BALANCE는 **산정 결과를 보는 화면**이지 산정 입력을 넣는 화면이 아니다 ③ 연소자·임신 보호가 이미 ADM-EMPLOYEE-DETAIL에 귀속돼 있어(HRM-14) **보호 대상 속성의 입력 지점이 한 화면으로 모인다**. 소비 축은 두 곳이며 각각 결과만 표시한다 — 연차 산정(LEV-01)과 배치 차단(ATT-09 · ADM-SCHEDULE).

**scheduled_job_runs(테이블 60)는 기능ID에 귀속되지 않는 횡단 원장이다.** 정기작업 8건은 기능ID를 갖지 않는 서버 실행 항목이므로(정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)) 이 테이블의 계약처는 **REQ-NFR-16 · REQ-TEC-09**이며, §2의 기능 행에는 만료 배치 이력을 남기는 WRK-04에만 참조로 등재한다. 화면 표면은 두지 않는다 — v1에 배치 모니터링 화면이 없고 조회 축은 플랫폼 감사 권한이다. **이는 미매핑이 아니라 횡단 귀속**이며 §5 판정에 포함하지 않는다.

**idempotency_records(테이블 61)도 기능ID에 귀속되지 않는 횡단 원장이며, scheduled_job_runs와 달리 §2의 어느 행에도 참조로 등재하지 않는다.** 멱등키는 특정 기능이 아니라 **전 표면이 공유하는 요청 계약**이라 계약처가 **REQ-GLB-14**이고 계약 정본은 [../06_api/01_conventions.md](../06_api/01_conventions.md) 멱등 절이다. **한 기능 행에 참조로 붙이지 않는 이유는 대상이 열 곳이기 때문이다** — 하나에만 붙이면 나머지 아홉이 빠진 것처럼 보이고, 열 행에 모두 붙이면 그 열이 기능별 핵심 테이블이 아니라 횡단 계약의 목록이 된다. 화면 표면도 두지 않는다 — 사용자가 보는 것은 재시도의 결과이지 기록 자체가 아니다. **이는 미매핑이 아니라 횡단 귀속**이며 §5 판정에 포함하지 않는다.

**LEV-04는 자기 절에서 REQ를 채번하지 않는다** — 원장을 읽는 조회 기능이라 계약이 REQ-LEV-06(요약·원장 재계산 일치)과 REQ-LEV-01(미적용 403·판정 불가 422 구분)에 이미 있고, 중복 정본을 만들지 않기 위해 참조로만 잇는다([06_leave.md](./06_leave.md) LEV-04 절). 이는 미매핑이 아니라 **참조 등재**다.

### PAY 급여 (13 · DSH 1)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| PAY-01 급여 기준 설정 | REQ-PAY-01·04·05·07·08 | ADM-PAYROLL-TERMS | 08_payroll #1 · #2 · #3 · #4 · #5 · #6 · #7 | pay_items · payroll_terms |
| PAY-02 근태 연동 계산 | REQ-PAY-06·10·11·12·13·14 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) | 08_payroll #9 · #10 · #12 | payroll_runs · payroll_employee_results · attendance_daily_summaries · attendance_period_closings |
| PAY-03 법정수당 계산 | REQ-PAY-15·16·17·18·19·20 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) | 08_payroll #9 · #10 · #13 · #14 | payroll_employee_result_items · statutory_rates · workplace_employee_count_snapshots |
| PAY-04 4대보험 공제 | REQ-PAY-21·22·23 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) | 08_payroll #9 · #10 · #14 | payroll_employee_result_items · statutory_rates · employee_insurance_infos |
| PAY-05 소득세 공제 | REQ-PAY-24·25 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) | 08_payroll #9 · #10 · #14 | payroll_employee_result_items · income_tax_table_entries |
| PAY-06 최저임금 검증 | REQ-PAY-26 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN | 08_payroll #15 | payroll_validation_results · statutory_rates |
| PAY-07 급여 미리보기 | REQ-PAY-30 | ADM-PAYROLL-PREVIEW | 08_payroll #8 | payroll_terms · attendance_daily_summaries · workplace_employee_count_snapshots · statutory_rates · income_tax_table_entries |
| PAY-08 급여 확정 | REQ-PAY-27·28·29 | ADM-PAYROLL-RUN · ADM-HOME(상태 표시) | 08_payroll #11 · #12 · #16 · #17 · #18 · #19 | payroll_runs · payroll_employee_results · payroll_validation_results · **compliance_tasks** |
| PAY-09 급여대장(임금대장) | REQ-PAY-31 | ADM-PAYROLL-LEDGER | 08_payroll #20 · #21 · #22 | payroll_runs · payroll_employee_result_items · documents |
| PAY-10 급여 이력 | REQ-PAY-32 | ADM-PAYROLL-LEDGER · APP-PAYROLL-HISTORY | 08_payroll #23 · #24 | payroll_employee_results · employees |
| PAY-11 퇴직금 — 판정·개산액·기한 경보 | REQ-PAY-09·33·34 | ADM-SEVERANCE | 08_payroll #25 · #26 | severance_assessments · payroll_employee_results · compliance_tasks |
| PAY-13 비과세·과세 구분 관리 | REQ-PAY-02·03 | ADM-PAYROLL-TERMS | 08_payroll #1 · #27 | pay_items · statutory_rates |
| PAY-19 금품청산 기한 관리 | REQ-PAY-35 | ADM-SEVERANCE · ADM-DEADLINE-CALENDAR(표시) · (배치) | 08_payroll #28 · #29(배치 · 참조) | compliance_tasks · severance_assessments |
| DSH-03 인건비 추이 | REQ-PAY-36 | ADM-HOME | 08_payroll #30 | payroll_runs · payroll_employee_results |

검산: 기능 **14행**(PAY 13 · DSH-03 — PAY-12는 영구 제외 · PAY-14~18은 v1.1 이월 결번) · REQ 5 + 6 + 6 + 3 + 2 + 1 + 1 + 3 + 1 + 1 + 3 + 2 + 1 + 1 = **36** · API 표면 #1~#30 전수 등장 = **30**([../06_api/08_payroll.md](../06_api/08_payroll.md) · #29는 [../06_api/10_tax.md](../06_api/10_tax.md) #12 소유의 참조 등재) · 화면 표면 없는 기능 **0**.

### SLP 명세서 (7)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| SLP-01 명세서 자동 생성 | REQ-SLP-01·02·03 | ADM-PAYSLIP · APP-PAYSLIP(상태 표시) · (서버) · (배치) | 09_payslip #1(서버) · #2 · #4 · #18(배치) | payslips · documents · payroll_runs |
| SLP-02 법정 필수항목 | REQ-SLP-04·05·06 | ADM-PAYSLIP · APP-PAYSLIP(표시) · (서버) | 09_payslip #5 | payslips · payroll_employee_result_items · documents |
| SLP-03 명세서 교부/열람 | REQ-SLP-07·08·09 | APP-PAYSLIP · ADM-PAYSLIP · APP-PAYROLL-HISTORY(진입점) | 09_payslip #3 · #9 · #13 · #14 · #15 · #16 · #19 | payslip_deliveries · payslips · employees |
| SLP-04 명세서 보관 | REQ-SLP-10 | ADM-PAYSLIP · (서버) | 09_payslip #10 | documents · payslips |
| SLP-05 일괄 발행 | REQ-SLP-11·12 | ADM-PAYSLIP · (배치) | 09_payslip #2 · #6 · #7 · #8 · #18(배치) | batch_jobs · payslips |
| SLP-06 발행 알림 | REQ-SLP-13·14 | APP-NOTIFICATION(수신 표면) · (서버) | 09_payslip #17(서버) | notifications · payslips |
| SLP-07 명세서 재발급/정정 | REQ-SLP-15·16 | ADM-PAYSLIP · APP-PAYSLIP(본인 재발급) | 09_payslip #11 · #12 · #15 | payslips · payslip_deliveries · documents |

검산: 기능 **7행**(결번 없음) · REQ 3 + 3 + 3 + 1 + 2 + 2 + 2 = **16** · API 표면 #1~#18 전수 등장 = **18**([../06_api/09_payslip.md](../06_api/09_payslip.md)) · 화면 표면 없는 기능 **0**.

### TAX 세무·4대보험 신고 (3)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| TAX-01 4대보험 취득·상실 신고자료 | REQ-TAX-01 | ADM-TAX-FILING | 10_tax #1 · #2 · #3 · #4 · #9 | employee_insurance_infos · employees · documents |
| TAX-02 이직확인서 | REQ-TAX-02 | ADM-TAX-SEPARATION · (배치) | 10_tax #5 · #6 · #7 · #8 · #9 · #12(배치) | employees · payroll_employee_results · documents |
| TAX-11 신고 기한 캘린더·알림 | REQ-TAX-03·04·05 | ADM-DEADLINE-CALENDAR · ADM-HOME(경고) · (배치) | 10_tax #10 · #11 · #12(배치) · 과제 조회·전이는 11_compliance #8 · #14 · #15 참조 | compliance_tasks · notifications · statutory_rates |

검산: 기능 **3행**(TAX-03~10은 v1.1 이후 이월 결번) · REQ 1 + 1 + 3 = **5** · API 표면 #1~#12 전수 등장 = **12**([../06_api/10_tax.md](../06_api/10_tax.md) · #9는 두 기능이 공유하는 단일 스트리밍 종점) · 화면 표면 없는 기능 **0**.

**기한 과제 표면 3종(11_compliance #8 · #14 · #15)은 표면 실체를 CMP-04가 소유하고 TAX-11이 참조로 공유한다** — TAX 문서의 표면 수 12에는 넣지 않는다(중복 계상 방지).

### CMP 법정 준수 (5)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| CMP-01 상시근로자 수 산정 | REQ-CMP-01·02·03·04·05·06·07 | ADM-EMPLOYEE-COUNT · (배치) | 11_compliance #1 · #2 · #3 · #4 · #12(배치) | workplace_employee_count_snapshots · employee_count_snapshot_days · employees |
| CMP-02 규모별 적용 정책 버전 관리 | REQ-CMP-09 | SYS-POLICY | 11_compliance #5(사업장 소비 조회) · 14_system #27 · #28 · #29(변경 축) | statutory_rates |
| CMP-04 법정 서류 보존 관리 | REQ-CMP-10 | ADM-RETENTION | 11_compliance #6 · #7 · #8 · #14 · #15 | contracts · payroll_runs · employees · payslips(보존 원장 4곳) · documents(파일 실체) · compliance_tasks |
| CMP-07 퇴사자 본인 법정문서 열람 | REQ-SLP-09 · REQ-HRM-15(참조 — 소유 절은 SLP-03 · HRM-04) | APP-PAYSLIP · APP-PAYROLL-HISTORY · APP-CONTRACT · ADM-ACCOUNT(고지) | 11_compliance #13(서버) · 집행은 09_payslip #13~#16 · 05_hr #24~#26 · **#36** · 08_payroll #24 | employees · payslips · documents |
| CMP-08 사업 단위 판정(합산 범위) | REQ-CMP-08 | ADM-BUSINESS-UNIT · ADM-WORKPLACE-CREATE(고지) · PUB-PRICING(고지) | 11_compliance #10 · #11 | business_units · workplaces |

검산: 기능 **5행**(CMP-03 · 05 · 06은 v1.1 이후 이월 결번) · REQ 7 + 1 + 1 + 0 + 1 = **10** · API 표면 #1~#13 전수 등장 = **13**([../06_api/11_compliance.md](../06_api/11_compliance.md)) · 화면 표면 없는 기능 **0**.

**신설 표면 #8·#9는 기한 과제 조회·전이이며 CMP-04가 소유한다** — TAX-11이 같은 표면을 참조로 공유한다(§2 TAX 절). 이에 따라 사업 단위 판정은 #8·#9 → **#10·#11**, 본인 소유권 인가 술어는 #11 → **#13**, 스냅샷 재산정 배치는 #10 → **#12**로 밀렸다. **CMP-02의 변경 축 3표면(14_system #27~#29)은 14_system 문서가 소유하므로 CMP 표면 수 13에 넣지 않는다.**

**CMP-07은 자기 절에서 REQ를 채번하지 않는다** — 새 자원이 아니라 **인가 판정의 축을 바꾸는 계약**이라 집행 지점이 명세서·인사 도메인에 있고, 요구사항은 REQ-SLP-09(본인 소유권 인가)와 REQ-HRM-15(퇴사 후 열람권 유지)에만 둔다([10_compliance.md](./10_compliance.md) CMP-07 절). 이는 미매핑이 아니라 **참조 등재**다.

### NTF 알림 (3)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| NTF-01 인앱 알림 배달 | REQ-NTF-01·02 | APP-NOTIFICATION · ADM-HOME(표시) · (전역) · (배치) | 12_notification #1 · #7(서버) | notifications · notification_types |
| NTF-03 알림 목록·읽음 | REQ-NTF-03·04 | APP-NOTIFICATION | 12_notification #2 · #3 · #4 · #5 | notifications |
| NTF-04 알림 타입 | REQ-NTF-05·06 | **(서버)** · APP-NOTIFICATION(소비) | 12_notification #6 · #7(서버 · 타입 검증) | notification_types |

검산: 기능 **3행**(NTF-02 · 05 · 06은 v1.1 이후 이월 결번) · REQ 2 + 2 + 2 = **6** · API 표면 #1~#7 전수 등장 = **7**([../06_api/12_notification.md](../06_api/12_notification.md)) · 화면 표면 없는 기능 **1**(NTF-04 — 서버 고정 카탈로그이며 관리 화면을 v1에 두지 않는다).

### SUB 구독 (5)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| SUB-01 요금제 정의 | REQ-SUB-01·02 | SYS-SUBSCRIPTIONS · PUB-PRICING · PUB-LANDING(진입점) | 13_subscription #1(조회) · 14_system(정의·변경) | plans |
| SUB-02 구독 등급(계정) | REQ-SUB-03·04 | ADM-SUBSCRIPTION · SYS-SUBSCRIPTIONS(관리자 측) | 13_subscription #2 · #3 | subscriptions · plans |
| SUB-03 사업장 등록 게이팅 | REQ-SUB-05 | ADM-WORKPLACE-CREATE · ADM-SUBSCRIPTION(표시) · (서버) | 13_subscription #3 · #5(서버) | subscriptions · workplaces |
| SUB-04 이용 한도 | REQ-SUB-06·07 | ADM-MEMBERS · ADM-SUBSCRIPTION(표시) · APP-INVITE(연계) · (서버) | 13_subscription #3 · #4 · #6(서버) | subscriptions · workplace_members |
| SUB-05 구독 상태 점검 | REQ-SUB-08·09 | ADM-SUBSCRIPTION · ADM-HOME(경고) · (배치) | 13_subscription #2 · #7(배치) | subscriptions · notifications |

검산: 기능 **5행**(SUB-06 · 07은 영구 제외) · REQ 2 + 2 + 1 + 2 + 2 = **9** · API 표면 #1~#7 전수 등장 = **7**([../06_api/13_subscription.md](../06_api/13_subscription.md)) · 화면 표면 없는 기능 **0**.

### SYS 시스템 관리 (7)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| SYS-01 플랫폼 RBAC | REQ-SYS-01·02·03 | **(전역)** — 시스템 웹 7화면 전체의 접근 게이트 | 14_system #1 · #2 | system_admins · audit_logs |
| SYS-03 사업장 관리 | REQ-SYS-04·05 | SYS-WORKPLACES | 14_system #3 · #4 · #5 · #6 · #7 | workplaces · audit_logs |
| SYS-04 사용자 관리 | REQ-SYS-06·07 | SYS-USERS | 14_system #8 · #9 · #10 · #11 · #12 · #13 | users · profiles · password_reset_tokens · security_events · account_status_events · audit_logs |
| SYS-05 구독/요금제 관리 | REQ-SYS-08·09 | SYS-SUBSCRIPTIONS | 14_system #14 · #15 · #16 · #17 · #18 | plans · subscriptions · audit_logs |
| SYS-07 감사 로그 | REQ-SYS-10·11 | SYS-AUDIT | 14_system #19 · #20 · #21 · #22 | audit_logs · export_jobs |
| SYS-08 기준값 관리 | REQ-SYS-12·13·14 | SYS-RATES | 14_system #23 · #24 · #25 · #26 | statutory_rates · income_tax_table_entries |
| SYS-11 약관/개인정보/위치정보 문서 관리 | REQ-SYS-15·16 | SYS-TERMS · PUB-LEGAL(공개 게시) · PUB-CONSENT(연계) · APP-PRIVACY(진입점·연계) · PUB-LANDING(진입점) | 14_system #30 · #31 · #32 · #33 · **#35** | terms_documents · user_consents |

검산: 기능 **7행**(SYS-02 · 06 · 09는 v1.1 이월 결번 · SYS-10은 영구 제외) · REQ 3 + 2 + 2 + 2 + 2 + 3 + 2 = **16** · API 표면 #1~#36 중 **34 등장**([../06_api/14_system.md](../06_api/14_system.md) · 이 중 #27~#29는 SYS 기능이 아니라 **CMP-02의 변경 축**이며 §2 CMP 절에 등재된다 · **#36은 DSH-06 행**(WRK 절)에 등재되고 #34는 기능 없는 표면이다) · 화면 표면 없는 기능 **1**(SYS-01 — 시스템 웹 7화면 전체의 접근 게이트라 특정 화면에 귀속되지 않는다).

**#34(정기작업 재실행)는 기능 없이 표면만 등재한다.** 정기작업은 **기능ID를 갖지 않는 서버 실행 항목**이라 기능 집계 밖이고(정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)) 그 운영 트리거도 같은 축이다 — §2는 기능을 축으로 삼는 표이므로 **기능이 없는 표면은 이 표에 행을 갖지 않는다.** 표를 채우려고 기능ID를 채번하면 **기능 수가 움직인다.**

| 표면 | 계층 | 기능 | 화면 | 정본 |
|------|------|------|------|------|
| 14_system #34 정기작업 재실행 | REST | **없음**(정기작업은 기능ID를 갖지 않는다) | SYS-RATES 운영 절 | [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) · 표면 계약은 [../06_api/14_system.md](../06_api/14_system.md) |

**이 표는 §2를 대체하지 않는다** — 기능 축이 닿지 않는 표면을 여기 한 줄로 등재해 **표면 계수와 기능 대조가 갈리는 자리를 드러내 두는 것**이 목적이고, 기능이 없는 표면이 늘면 여기 행을 더한다.

**신설 표면 #27·#28·#29는 규모별 적용 정책(size-policies) 변경 축이다** — 소비 조회는 사업장 도메인(11_compliance #5)이, 변경은 플랫폼 운영이 갖는 분리 구조이며 기능 귀속은 CMP-02다. 이에 따라 약관 문서 관리는 #27~#30 → **#30~#33**으로 밀렸다.

### PRV 개인정보·위치정보 (2)

| 기능ID | REQ | 화면 코드 | API 문서 | 핵심 테이블 |
|--------|-----|-----------|----------|-------------|
| PRV-01 위치정보 이용·제공 사실 확인자료 | REQ-PRV-04·05 | APP-PRIVACY(본인 조회) · (서버) | 15_privacy #1(서버) · #2 · #3(서버) | location_usage_records · attendance_records · audit_logs |
| PRV-02 동의 이력 관리 | REQ-PRV-01·02·03 | PUB-CONSENT · APP-PRIVACY · PUB-SIGNUP · PUB-LEGAL(대조) · PUB-LOGIN(연계) · APP-SETTINGS(진입점) · **ADM-ACCOUNT(동의 내역)** | 15_privacy #4 · #5 · #6 · #7 | user_consents · terms_documents |

검산: 기능 **2행**(PRV-03 · 04 · 05는 v1.1 이월 결번) · REQ 2 + 3 = **5** · API 표면 #1~#7 전수 등장 = **7**([../06_api/15_privacy.md](../06_api/15_privacy.md)) · 화면 표면 없는 기능 **0**.

### §2 전체 검산

기능 행 수: 10 + 14 + 11 + 12 + 5 + 14 + 7 + 3 + 5 + 3 + 5 + 7 + 2 = **98** — 미매핑 0 · 정본에 없는 유령 ID 0.
자기 절 등재 REQ 수: 26 + 38 + 28 + 22 + 14 + 36 + 16 + 5 + 10 + 6 + 9 + 16 + 5 = **231**(도메인 REQ 전량 — WRK 절 38은 DSH-06 행의 REQ-SYS-17을 포함한다).
API 표면 수: 17 + 36 + 36 + 29 + 17 + 30 + 19 + 12 + 14 + 7 + 7 + 36 + 7 = **267** — 06_api 고정 기준과 일치한다.
화면 표면이 없는 기능은 **3건**(NTF-04 (서버) · SYS-01 (전역) · DSH-06 (전역))이며 95 + 3 = **98**로 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)의 집계와 일치한다. 세 건은 규격 정본이 따로 있으므로 미매핑이 아니다.
(배치)를 병기한 기능은 **14건**이다 — AUT-08 · WRK-04 · WRK-05 · ATT-04 · ATT-05 · LEV-01 · PAY-19 · SLP-01 · SLP-05 · TAX-02 · TAX-11 · CMP-01 · NTF-01 · SUB-05이며 14건 모두 화면 표면을 함께 갖는다. 정기작업 실체는 **8건**이고 한 작업이 여러 기능에 걸리므로 병기 기능 수가 작업 수보다 많다(정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)).

---

## 3. 인수 기준 ↔ REQ ↔ 기능

AC는 15항목이며 정본은 [16_acceptance_criteria.md](./16_acceptance_criteria.md)다. 근거 REQ 열은 그 문서의 검증 방법 표에서 그대로 인용하고, 관련 기능 열은 §2의 REQ 귀속을 역방향으로 푼 값이다. 근거 REQ가 REQ-GLB뿐인 항목은 특정 기능이 아니라 전 계산 경로에 걸린다.

| AC | 근거 REQ | 관련 기능 |
|----|----------|-----------|
| AC-01 5인 이상 월급제 · 연장 + 야간 중복 | REQ-ATT-10·11·12 · REQ-PAY-19 · REQ-GLB-10 | ATT-05 · PAY-03 · (횡단 GLB — 결과 값 동결) |
| AC-02 5인 이상 · 휴일 10시간(야간 2시간 포함) | REQ-ATT-12 · REQ-PAY-18·19 | ATT-05 · PAY-03 |
| AC-03 5인 미만 · 동일 근태 | REQ-PAY-20 · REQ-ATT-13 · REQ-LEV-01 · REQ-SLP-05 | PAY-03 · ATT-05 · LEV-01 · SLP-02 |
| AC-04 주휴수당 발생·미발생 | REQ-PAY-15 · REQ-LEV-11 | PAY-03 · LEV-06 |
| AC-05 4대보험 보험별 base 분리 | REQ-PAY-02·03·22 · REQ-GLB-10 | PAY-13 · PAY-04 · (횡단 GLB) |
| AC-06 보험별 가입 제외 판정 | REQ-PAY-21·22 · REQ-HRM-16·17 | PAY-04 · HRM-05 |
| AC-07 간이세액표 지급일 경계 | REQ-PAY-05·24 · REQ-SYS-12·13 · REQ-GLB-08 | PAY-01 · PAY-05 · SYS-08 · (횡단 GLB — 기준값 선택 단위) |
| AC-08 상시근로자 제2항 보정 | REQ-CMP-01·02·04·05 · REQ-GLB-02 | CMP-01 · (횡단 GLB — 규모 분기 단일 기준) |
| AC-09 단수 처리 — 항목별 1회 반올림 | REQ-GLB-03·04·05 · REQ-PAY-13 | PAY-02 · (횡단 GLB — 단수 처리 정본) |
| AC-10 최저임금 경계 | REQ-PAY-26 · REQ-GLB-17 · REQ-SLP-05 | PAY-06 · SLP-02 · (횡단 GLB) |
| AC-11 계산 결정론 | REQ-GLB-01·02·06 | **(횡단 GLB 전용)** — 계산 기능 PAY-02·03·04·05·06 전체에 적용된다 |
| AC-12 기준값 정정 후 과거 확정 불변 | REQ-GLB-10 · REQ-SYS-13 · REQ-SLP-02 | SYS-08 · SLP-01 · (횡단 GLB — 결과 값 동결) |
| AC-13 월 중 근로조건 변경 | REQ-PAY-13 · REQ-HRM-06 · REQ-GLB-03 | PAY-02 · HRM-02 · (횡단 GLB) |
| AC-14 연차 비례 산정(단시간) | REQ-LEV-05·06 · REQ-CMP-06 | LEV-01 · CMP-01 |
| AC-15 휴게 미달 마감 차단 | REQ-ATT-07·18 · REQ-PAY-06 | ATT-12 · ATT-08 · PAY-02 |

검산: AC-01 ~ AC-15 = **15항목** · 근거 REQ에 등장하는 ID 전부가 정본 281 안에 실재한다(존재 대조 결과 미존재 0). 등장 접두사는 GLB · ATT · LEV · PAY · SLP · HRM · CMP · SYS **8종**이며, AC가 계산 정확성과 법정 의무에 집중된 결과 AUT · WRK · NTF · SUB · TAX · PRV 6종은 AC 근거에 등장하지 않는다 — 이는 누락이 아니라 인수 기준의 범위 선택이며 그 축의 검증은 [15_nonfunctional.md](./15_nonfunctional.md)와 각 도메인 REQ의 참·거짓 판정 단위가 담당한다.

---

## 4. REQ 커버리지 역방향

281 REQ 전부의 귀속을 반대 방향에서 확인한다. **도메인 REQ 231건은 전부 기능 H2 아래 등재**되고, **횡단 50건(GLB 20 · NFR 16 · TEC 14)은 특정 기능이 아니라 전 도메인·전 표면에 걸린다.**

| 접두사 | REQ 수 | 귀속 |
|--------|:------:|------|
| GLB | 20 | **횡단** — 전 도메인 계산·저장·인가 불변식. 소유 파일 [01_global_rules.md](./01_global_rules.md), 발현은 §2의 전 기능 |
| AUT | 26 | 기능 10본 — AUT-01 5 · AUT-02 3 · AUT-03 3 · AUT-04 2 · AUT-05 1 · AUT-06 2 · AUT-07 2 · AUT-08 3 · AUT-09 3 · AUT-10 2. 검산 5+3+3+2+1+2+2+3+3+2 = **26** |
| WRK | 37 | 기능 13본 + DSH-06 — 01: 4 · 02: 3 · 03: 3 · 04: 3 · 05: 4 · 06: 2 · 07: 3 · 08: 2 · 09: 3 · 10: 1 · 11: 3 · 14: 1 · 16: 4 · DSH-06: 1. 검산 = **37** |
| HRM | 28 | 기능 11본 — 01: 5 · 02: 3 · 03: 3 · 04: 4 · 05: 3 · 06: 2 · 07: 2 · 09: 2 · 11: 1 · 14: 2 · 16: 1. 검산 = **28** |
| ATT | 22 | 기능 12본 — 01: 3 · 02: 2 · 03: 1 · 04: 1 · 05: 5 · 06: 1 · 07: 2 · 08: 3 · 09: 1 · 10: 1 · 12: 1 · 13: 1. 검산 = **22** |
| LEV | 14 | 기능 4본 — 01: 7 · 02: 2 · 03: 2 · 06: 3. 검산 = **14**. LEV-04는 REQ-LEV-06·01을 참조 등재로 쓴다 |
| PAY | 36 | 기능 13본 + DSH-03 — 01: 5 · 02: 6 · 03: 6 · 04: 3 · 05: 2 · 06: 1 · 07: 1 · 08: 3 · 09: 1 · 10: 1 · 11: 3 · 13: 2 · 19: 1 · DSH-03: 1. 검산 = **36** |
| SLP | 16 | 기능 7본 — 01: 3 · 02: 3 · 03: 3 · 04: 1 · 05: 2 · 06: 2 · 07: 2. 검산 = **16**. REQ-SLP-09는 CMP-07의 인가 근거로도 참조된다 |
| TAX | 5 | 기능 3본 — 01: 1 · 02: 1 · 11: 3. 검산 = **5** |
| CMP | 10 | 기능 4본 — 01: 7 · 02: 1 · 04: 1 · 08: 1. 검산 = **10**. CMP-07은 REQ-SLP-09·REQ-HRM-15를 참조 등재로 쓴다 |
| NTF | 6 | 기능 3본 — 01: 2 · 03: 2 · 04: 2. 검산 = **6** |
| SUB | 9 | 기능 5본 — 01: 2 · 02: 2 · 03: 1 · 04: 2 · 05: 2. 검산 = **9** |
| SYS | 17 | 기능 7본 + DSH-06(시스템 콘솔 축) — 01: 3 · 03: 2 · 04: 2 · 05: 2 · 07: 2 · 08: 3 · 11: 2 · DSH-06: 1. 검산 = **17** |
| PRV | 5 | 기능 2본 — 01: 2 · 02: 3. 검산 = **5** |
| NFR | 16 | **횡단** — 성능·상태 표시·모바일·접근성·렌더링/SEO·안정성. 소유 파일 [15_nonfunctional.md](./15_nonfunctional.md), 발현은 전 화면 **55**본 |
| TEC | 14 | **횡단** — 배포·환경변수·정기작업 8건·시크릿·마이그레이션 운영. 소유 파일 [15_nonfunctional.md](./15_nonfunctional.md), 발현은 backend/ · web_front/ · app_front/ 운영 경로 |

도메인 귀속 검산: 26 + 37 + 28 + 22 + 14 + 36 + 16 + 5 + 10 + 6 + 9 + 17 + 5 = **231**. 횡단 검산: 20 + 16 + 14 = **50**. 총계: 231 + 50 = **281**.

**기능에도 횡단에도 귀속되지 않는 고아 REQ는 0건이다.** 판정 방법은 다음 셋이다 — ① 도메인 파일 13본의 요구사항 표 행을 전수 추출해 각 행이 어느 H2 아래 있는지 확인한 결과 기능 H2가 아닌 절(관련 테이블 · 관련 화면 · 에러 코드 · 미확인) 아래의 REQ 행이 **0건**이다 ② 접두사별 추출 행 수와 고유 ID 수가 전 16접두사에서 같아 **중복 등재 0건**이다 ③ 접두사별 최대 번호가 고유 ID 수와 같아 **결번 0건**이다. 세 조건이 동시에 성립하므로 정의된 281 ID 집합과 귀속된 281 ID 집합이 일치한다.

역으로 **자기 절에서 REQ를 채번하지 않는 기능은 2건**(LEV-04 · CMP-07)이며 둘 다 다른 절이 소유한 REQ를 참조 등재로 잇는다. 이는 중복 등재 금지 규약([README.md](./README.md) 형식 규약)의 정상 결과이며 미매핑이 아니다.

---

## 5. 어긋남 등재

대조 축 6종(기능 **98** · REQ **281** · 화면 **55** · API 표면 **267** · 테이블 61 · enum 33)에서 **집합·수치 불일치는 0건**이고, **미해소 등재는 0건**이다 — 7 · 8 · 9번 전건을 2026-08-20에 해소했다. 발견 기록은 지우지 않고 해소 상태와 함께 남긴다.

- **1~4번은 에러 코드 종수 인용 어긋남**이며 **4건 전부 해소됐다**(2026-08-03).
- **5~6번은 2026-08-03 표면 재대조에서 새로 발견한 파생 집계 드리프트**이며, 발견 직후 **2건 모두 해소됐다**(2026-08-03). 둘 다 정본 본문이 바뀐 뒤 같은 문서 안의 요약·집계 문장이 따라가지 않은 경우다.

| # | 축 | 불일치 내용 | 우선 정본 | 조치 |
|:-:|------|------------|-----------|------|
| 1 | 에러 코드 종수 | [README.md](./README.md) 고정 기준 표의 에러 코드 행이 **105종**으로 남아 있었다 | [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) — **118종 · 16네임스페이스** | **해소** — 117로 갱신 완료. 파생 고지 문단도 정렬 완료 서술로 교체했다 |
| 2 | 에러 코드 종수 | [../10_security/README.md](../10_security/README.md) 고정 기준 표가 **105종**을 인용했다 | 〃 | **해소** — 117로 갱신 완료 |
| 3 | 에러 코드 종수 | [../10_security/01_authn_authz.md](../10_security/01_authn_authz.md) 본문의 전수 정본 인용이 **105종**이었다 | 〃 | **해소** — 117로 갱신 완료 |
| 4 | 갱신 예고 문구의 대상 목록 | [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)와 [../06_api/02_errors.md](../06_api/02_errors.md)의 주석이 "[../README.md](../README.md) 고정 기준과 [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)가 105를 인용한다"고 적었으나 **두 문서는 이미 117로 정렬됐다** | [../README.md](../README.md) · [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)의 현재 값 | **해소** — 두 주석 모두 "인용처가 117로 정렬 완료" 사실 서술로 교체했다 |

| 5 | 정기작업 표면 번호 | [../06_api/README.md](../06_api/README.md) 서버 내부 종점 절이 rollupAttendanceDaily를 **06_attendance #25**로 적는다. 그러나 정본 [../06_api/06_attendance.md](../06_api/06_attendance.md)에서 그 배치는 **#27**이고 **#25는 ATT-12 휴게시간 준수 검증(REST)**이다 | [../06_api/06_attendance.md](../06_api/06_attendance.md) 표면 요약 표 | **해소** — README 서버 내부 종점 절의 #25를 **#27**로 정정 완료. 신설 표면 #5·#6이 들어오며 뒤 번호가 2씩 밀렸는데 README의 배치 인용이 따라가지 않았던 것이다 |
| 6 | 배치 병기 기능 수 | [../07_screen/02_traceability.md](../07_screen/02_traceability.md)가 "**(배치) 병기 기능은 3건**이다 — LEV-01 · CMP-01 · SUB-05"로 단언한다. 그러나 같은 문서 본문 표에서 (배치)를 병기한 기능은 **14건**이다(AUT-08 · WRK-04 · WRK-05 · ATT-04 · ATT-05 · LEV-01 · PAY-19 · SLP-01 · SLP-05 · TAX-02 · TAX-11 · CMP-01 · NTF-01 · SUB-05) | 같은 문서의 도메인별 본문 표 | **해소** — 요약 문장을 **14건**과 접두사별 검산식으로 갱신 완료. §2 전체 검산 절의 실측 14건과 일치한다 |
| 7 | 기능 → 화면 매핑 | HRM-09 직원 문서함에 **본인(STAFF) 증빙 업로드 축**이 생겼다([../06_api/05_hr.md](../06_api/05_hr.md) #27 · 2026-08-20). 실제 제출 화면은 APP-ATTENDANCE(근태 수정 요청)와 APP-LEAVE(휴가 신청)인데 두 화면의 담은 기능ID에 HRM-09가 없고, [../07_screen/02_traceability.md](../07_screen/02_traceability.md)의 HRM-09 행에도 없다 | [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md)의 담은 기능ID(화면 측 근거) | **해소**(2026-08-20 · 리드 승인) — 정본 → 파생 순서로 처리했다. 05_app_employee의 APP-ATTENDANCE · APP-LEAVE 담은 기능ID에 HRM-09(본인 증빙)를 추가하고, 07_screen/02의 HRM-09 행·실행 수식어(14 → **15종**)·화면별 수(6 → **7** · 4 → **5**)·소계(41 → **43**)·총계(169 → **171**)를 같은 변경 단위에서 다시 셌으며, 본 문서 화면 열도 정렬했다 |
| 8 | CMP-07 집행 표면 열거 | 퇴사자 본인 법정문서 열람의 집행 표면 열거가 [../06_api/11_compliance.md](../06_api/11_compliance.md) #13과 [../06_api/README.md](../06_api/README.md) 기능 커버리지 표에서 **05_hr #24~#26**으로 굳어 있다. 2026-08-20 신설된 [../06_api/05_hr.md](../06_api/05_hr.md) #36(본인 계약 상세)도 같은 인가 축(본인 소유권)의 집행 지점이라 열거에 들어가야 한다 | [../06_api/11_compliance.md](../06_api/11_compliance.md) #13(CMP-07 소유 문서) | **해소**(2026-08-20 · 리드 승인) — 열거처 3자리(11_compliance #13 표와 추적성 절 · 06_api README 기능 커버리지 표 · 본 문서 §2 CMP-07 행)를 한 변경 단위에서 함께 고쳤다. 표면 수 검산에는 영향이 없다(#36은 05_hr 소유로 이미 계수됨) |
| 9 | 소속 사업장 요약의 필드 열거 | 소속 사업장 요약의 정본은 [../06_api/04_workplace.md](../06_api/04_workplace.md) #17이고 2026-08-20에 **employeeId**가 등재됐다. 같은 요약을 싣는 [../06_api/03_auth.md](../06_api/03_auth.md) #8(진입 컨텍스트)의 workplaces 배열 열거와 JSON 예시는 **employeeId뿐 아니라 그 이전부터 selectable도 빠져 있다** | [../06_api/04_workplace.md](../06_api/04_workplace.md) #17(요약 정본) | **해소(2026-08-20)** — [../06_api/03_auth.md](../06_api/03_auth.md) #8의 workplaces 열거·JSON 예시에 selectable과 employeeId를 한 변경 단위로 채우고 요약 열거의 정본이 #17임을 명시했다. 표면 수 검산에는 영향이 없다 |

**5번은 2026-08-08 감사 반영분이다** — attendance.assignment_forbidden 신설로 전수가 117 → **118**이 됐고, 인용처 7본(README 고정 기준 · 03_requirements README · 06_api README · 06_api/02 미러 · 09_glossary README · 04_id_conventions · 10_security README)을 같은 변경 단위에서 정렬했다.

**1~4번은 같은 뿌리**다 — 원천 카탈로그 절의 행 수 105(담당 94 + 교차 참조 9 + 폐기 2)와 유효 코드 전수(2026-08-03 시점 117 · 2026-08-08 118 · 현재 **119**)는 산출 범위가 다른 값인데, 정본이 그 값을 확정한 뒤 인용처 갱신이 일부 자리에서 멈췄다. **두 값을 섞어 쓰지 않는다** — 세는 기준을 밝히지 않고 105를 쓰면 구현자가 12종을 계약에서 빠뜨린다.

**7~9번은 방향이 반대인 등재다** — 1~6번이 정본을 고친 뒤 파생이 뒤따르지 않은 경우라면, 7~9번은 **API 정본이 먼저 움직였고 다른 정본이 아직 움직이지 않은** 경우다. 파생 표가 두 정본 중 한쪽만 반영하면 그 순간 다른 쪽과 어긋나므로 **정본이 정렬될 때까지 파생을 앞세우지 않는다**. 7번은 화면 정본(07_screen/05)을 먼저 고치고 파생 2본을 뒤이어 고치는 순서로, 8번은 열거처 4자리를 한 변경 단위로, 9번은 요약 정본(04_workplace #17)에 맞춰 03_auth #8의 열거·예시를 보충하는 방식으로 **전건 해소했다**.

**5~6번도 같은 뿌리**다 — 본문(표면 표 · 도메인 표)은 갱신됐는데 **같은 문서 안의 파생 요약**이 뒤따르지 않았다. 파생 집계는 정본을 고친 같은 변경 단위에서 다시 세야 한다([../CLAUDE.md](../CLAUDE.md)). 본 문서는 파생 표이므로 여기서 두 정본을 고치지 않고 등재만 한다.

대조 축별 결과는 아래와 같다. 불일치가 0인 축도 검사 범위를 남긴다.

| 대조 축 | 검사 범위 | 결과 |
|---------|----------|------|
| 기능 98 | 02_features 도메인 13본 · 03_requirements 도메인 13본의 H2 · 07_screen/02_traceability · 06_api 도메인 13본의 추적성 절에서 기능ID 집합을 각각 추출해 4자 대조(DSH 행은 소유 도메인 파일에서) | 4집합 모두 98개로 동일 · 차집합 **0** · 기능명 문자열도 03_requirements H2와 07_screen/02_traceability 사이 **전 행 일치** |
| REQ 281 | 도메인 13본 + 01_global_rules + 15_nonfunctional의 요구사항 표 행 전수 추출 | 281건 · 중복 **0** · 결번 **0** · 고아 **0** |
| 화면 **55** | 07_screen/README 인벤토리 표의 코드 집합과 07_screen/02_traceability 본문 코드 집합 대조 | 양쪽 **55**개 · 차집합 **0**(양방향) |
| API 표면 **267** | 06_api 도메인 13본의 표면 요약 표 행 수 직접 계수 후 README 집계와 대조 · 각 문서 추적성 절의 표면 번호 합집합이 그 문서 표면 수와 같은지 확인 | 17 + 36 + 36 + 29 + 17 + 30 + 19 + 12 + 14 + 7 + 7 + 36 + 7 = 267 · README 값과 **일치** · 합집합 누락 **0** · **11_compliance는 14행에 번호 1~15이며 #9가 결번이다** — 행 수와 최대 번호가 갈리는 첫 자리이므로 **계수 축은 행 수**임을 여기 적어 둔다 · **14_system #34는 기능ID를 갖지 않아 §2에 대응 행이 없다** — 표면 계수에는 들어가고 기능 대조 축에서는 빠지는 첫 자리다 · README 서버 내부 종점 절의 배치 번호 불일치 1건은 §5-5로 등재·해소 완료 |
| 테이블 61 | 05_database 도메인 13본의 테이블 목록 절 이름과 README 이름 집합 대조 · §2 핵심 테이블 열이 그 집합 밖 이름을 쓰는지 확인 | 13본 합계 **61** · README 집합과 **일치** · §2에서 **60종 등장**(횡단 귀속 idempotency_records **1종만 미등장** — §2 말미 등재) · 집합 밖 이름 **0** |
| enum 33 | 09_glossary/03_enums_state_machines 전수 표와 05_database/07_constraints_integrity 미러의 종수 대조 | 33종 · 값 132 · 상태 머신 9종 — **일치** |

---

## 6. 교차 정합 축

본 문서는 REQ 정본의 관점에서 작성됐다. 각 축이 어긋날 때 어느 문서를 따르는지와, 그 축을 무엇으로 판정하는지를 고정한다.

| 축 | 정본 | 일치 기준 | 대조 결과 |
|------|------|-----------|-----------|
| 기능 채번 | [../02_features/README.md](../02_features/README.md) | §2의 기능ID가 정본 98개와 집합으로 일치하고 기능명·우선순위가 문자 그대로 같다 | **98행 · 미매핑 0 · 유령 0 · 기능명 불일치 0** |
| REQ 채번 | [README.md](./README.md)와 본 폴더 01~15 | 접두사 16종이 01부터 연속이며 결번·중복이 없다 | **281 · 결번 0 · 중복 0 · 고아 0** |
| 기능 → 화면 | [../07_screen/02_traceability.md](../07_screen/02_traceability.md) | §2의 화면 코드 열이 정본의 화면 열과 전 행 일치하고 (서버)·(전역)·(배치) 표기도 같다 | **98행 일치 · 화면 표면 없는 기능 3(NTF-04 · SYS-01 · DSH-06)으로 정본과 동일** |
| 화면 채번 | [../07_screen/README.md](../07_screen/README.md) | §2에 등장하는 화면 코드가 인벤토리 **55**본 안에서만 나온다 | **55/55 등장 · 인벤토리 밖 코드 0** |
| 기능 → API 표면 | [../06_api/README.md](../06_api/README.md)와 도메인 13본의 추적성 절 | §2의 API 문서 열이 각 문서 추적성 절의 표면 번호와 일치하고, 도메인별 합집합이 그 문서의 표면 수와 같다 | **267 표면 중 266 등장 · 누락 0**(참조 등재 = 08_payroll #29는 10_tax #12 소유 · 11_compliance #8·#14·#15는 TAX-11이 공유 · 14_system #27~#29는 CMP-02 귀속 · 14_system #36은 DSH-06 행). 나머지 **1은 14_system #34**이며 **기능ID를 갖지 않는 표면**이라 이 축의 대조 대상이 아니다 — 정기작업이 기능 집계 밖이기 때문이고, 누락이 아니라 **축이 닿지 않는 자리**다 |
| 에러 코드 | [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) | 도메인 파일의 에러 코드 절이 정본 120종의 부분집합이며 종수 인용이 정본과 같다 | **120종 · 16네임스페이스. 인용 불일치 4건 등재(§5)** |
| 테이블 | [../05_database/README.md](../05_database/README.md) | §1·§2의 테이블 열이 이름 집합 61종 안에서만 나오고 **횡단 귀속 1종을 뺀 60종**을 빠짐없이 인용한다 | **60/60 등장 · 횡단 귀속 미등장 1 · 집합 밖 이름 0** |
| enum · 상태 머신 | [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) | 본 폴더가 전이표를 재정의하지 않고 참조만 한다 | **33종 · 값 132 · 상태 머신 9종 — 재정의 0** |
| AC ↔ REQ | [16_acceptance_criteria.md](./16_acceptance_criteria.md) | §3의 AC-01~15가 근거 REQ와 연결되고 그 REQ가 정본에 실재한다 | **AC 15종 전부 등장 · 미존재 REQ 0** |

기능 · REQ · 화면 · API 표면 · 테이블 · 에러 코드를 추가·변경·삭제하면 같은 변경 단위에서 본 문서와 [../07_screen/02_traceability.md](../07_screen/02_traceability.md) · [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)를 함께 갱신한다. **파생 집계는 정본을 고친 같은 변경 단위에서 다시 센다** — 규약 정본은 [../CLAUDE.md](../CLAUDE.md)다. 본 문서군은 to-be 설계 정본이므로 테스트 앵커 축은 두지 않으며, 구현 착수 후 as-built로 승격할 때 검증 증적 축을 추가한다.

---

## 관련 문서

- [README.md](./README.md) — 요구사항 폴더 목차 · 접두사별 REQ 수 · 형식 규약
- [16_acceptance_criteria.md](./16_acceptance_criteria.md) — AC-01~15 수용 조건과 검증 방법
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB 20 전역 불변식
- [15_nonfunctional.md](./15_nonfunctional.md) — REQ-NFR 16 · REQ-TEC 14 횡단 요구사항
- [../02_features/README.md](../02_features/README.md) — 기능 98 채번 정본
- [../07_screen/02_traceability.md](../07_screen/02_traceability.md) — 기능 → 화면 매핑 정본
- [../07_screen/README.md](../07_screen/README.md) — 화면 55본 인벤토리
- [../06_api/README.md](../06_api/README.md) — API 표면 **267** 집계와 도메인별 분포
- [../05_database/README.md](../05_database/README.md) — 테이블 61종 이름 집합
- [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) — 에러 코드 120종 채번 정본
- [../CLAUDE.md](../CLAUDE.md) — 추적성 동시 갱신 규약
