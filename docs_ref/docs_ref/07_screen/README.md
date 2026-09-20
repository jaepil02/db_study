# 07_screen — 화면 명세

> **대상**: insadesk v1 화면 55본의 인벤토리 — 화면 코드·화면명·라우트/표면·소속 파일
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **D-23 · D-24 반영**. 화면 55 · 화면 코드는 불변이다 — 채택 4기능은 기존 화면에 담는다(AUT-05 → ADM-ACCOUNT · ATT-10 · DSH-03 → ADM-HOME · DSH-06 → 목록 화면 공통 조작). **ADM-HOME이 기능을 소유하지 않는다는 서술과 "통계·추이·차트를 두지 않는다" 서술을 개정**한다(확정 급여의 월별 인건비 요약 막대 하나만 연다 — 분포·예측·비교는 여전히 두지 않는다). 실시간 근태 현황판 부정 서술을 ADM-HOME 오늘 출근 보드로 대체. 뷰포트 기준에 1024(콘텐츠 영역 무스크롤 경계 — D-24) 등재. 기능 인용 94 → **98**
> **개정일**: 2026-09-10 — **ADM-HOME 신설**로 화면 54 → **55본**(ADM 30 → **31**). 관리자 웹의 로그인 후 도착지이자 사이드바 첫 항목인 홈 대시보드이며 소속 파일은 [06_admin_workplace_hr.md](./06_admin_workplace_hr.md)다(9 → **10본**). **새 기능ID를 채번하지 않는다** — 기존 8기능(ATT-07 · LEV-03 · ATT-08 · PAY-08 · TAX-11 · WRK-14 · SUB-05 · NTF-01)에 표시 수식어로만 붙는다(정본 [02_traceability.md](./02_traceability.md)). 본 문서에서 54를 세던 자리 일곱을 같은 변경 단위에서 다시 셌다 — 대상 문장 · 파일별 화면 수 검산 · 인벤토리 제목 · 인벤토리 행 · 표면별 집계와 웹 산출물 축(44 → **45**) · 우선순위 분포(P0 21 → **22**) · 고정 기준
> **개정일**: 2026-08-19 — 직원 앱 내비게이션 as-built 정본화(01_standards §4-2). 인벤토리 APP 10본의 라우트 열을 탭 표기 → **드로어 섹션 + as-built 라우트명**(Checkin · Attendance · Leave · PayrollHistory · PayslipDetail · Documents · ContractDetail · Notifications · Settings · Privacy)으로 치환하고 APP-CHECKIN 화면명의 (홈 탭) → **(홈)** 정정 · 표면별 집계 APP 행의 5탭 9본 → **드로어 5섹션 8항목 + 스택 하위 1본** 표기 교체(화면 수 10 불변) · 비라우트 화면 코드 기준의 탭 어휘를 드로어·앱바 축으로 정정
> **개정일**: 2026-08-08 — 웹 전환 반영: 라우트 표기를 라우트 그룹에서 산출물 축(web_front 정적 · web_front SPA)으로 전수 치환 · 미인증 인증 4본의 SPA 귀속 명시 · 표면별 집계 표 열 이름 정정(D-20)
> **원천**: [../02_features](../02_features/README.md) 98기능 · [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md) 최소 역할 · [../03_requirements](../03_requirements/README.md) 입력·검증·차단 계약 · 확정 결정 D-20(웹 프론트엔드 전환 · ADR-24) · D-02(공개 페이지 + SEO)

본 폴더는 **화면 코드({표면}-{의미})의 채번 정본**이다. 요구사항·API·추적성 문서는 여기서 채번한 코드를 참조만 하고 새로 만들지 않는다. 아래 화면 인벤토리 표가 채번 정본이며, 개별 화면의 13필드 명세는 소속 파일이 갖는다.

화면은 **표면 4종**에 걸쳐 있다 — 공개 페이지(PUB) · 직원 앱(APP) · 관리자 웹(ADM) · 시스템 웹(SYS)다. 웹 화면은 **단일 Vite 앱 하나의 산출물 축 2종**으로 갈린다(D-20) — 랜딩·요금제 2본은 빌드 시점 프리렌더 정적 HTML(web_front 정적)이고 **나머지 웹 전 경로는 SPA로 서빙**한다(web_front SPA). 직원 앱은 React Native 드로어 + 네이티브 스택 구조다(01_standards §4-2). 라우트 열은 웹은 산출물 + 경로를, 앱은 논리 경로(드로어 섹션 · 스택)와 as-built 라우트명을 적는다. **라우트 그룹은 쓰지 않는다** — 서버 렌더 계층도 미들웨어 계층도 없으므로 폴더 규약이 표면 경계를 만들지 않는다.

**화면 코드는 논리 단위이며 물리 라우트와 1:1이 아니다.** 미인증 인증 화면 4본(PUB-SIGNUP · PUB-LOGIN · PUB-PASSWORD-RESET · PUB-CONSENT)은 웹과 앱 양쪽에 물리 표면을 갖지만 담는 기능군이 같으므로 **하나의 화면 코드**를 쓰고 표면을 병기한다. **웹에서 이 4본은 프리렌더 대상이 아니라 SPA 축에 속한다**(D-20) — 로그인 성공 직후 세션 쿠키로 보호 라우트에 진입하는 흐름이 한 산출물·한 오리진 안에서 끝나야 복귀 대상 전달과 오픈 리다이렉트 차단이 한 곳에 모인다. PUB 접두는 표면이 아니라 **미인증 진입이라는 인증 상태**를 뜻하는 논리 단위이며, 화면 코드·표면 병기(웹 + 앱)는 전환 후에도 불변이다. 반대로 계정 설정처럼 웹과 앱의 담는 기능이 갈리는 화면은 코드를 나눈다(ADM-ACCOUNT · APP-SETTINGS).

## 파일 목차

| 파일 | 담는 화면 |
|------|----------|
| [01_standards.md](./01_standards.md) | 공통 표준 — 접근권한 규약 · 13필드 템플릿 · 공통 패턴 · 내비게이션 · UI/UX 품질 기준(화면 없음) |
| [02_traceability.md](./02_traceability.md) | 기능ID → 화면 코드 전수 매핑과 파생 집계(화면 없음) |
| [03_public.md](./03_public.md) | PUB-LANDING · PUB-PRICING · PUB-LEGAL |
| [04_auth_onboarding.md](./04_auth_onboarding.md) | PUB-SIGNUP · PUB-LOGIN · PUB-PASSWORD-RESET · PUB-CONSENT · APP-INVITE · ADM-WORKPLACE-SELECT · ADM-WORKPLACE-CREATE · ADM-ACCOUNT |
| [05_app_employee.md](./05_app_employee.md) | APP-CHECKIN · APP-ATTENDANCE · APP-LEAVE · APP-PAYROLL-HISTORY · APP-PAYSLIP · APP-CONTRACT · APP-NOTIFICATION · APP-SETTINGS · APP-PRIVACY |
| [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) | ADM-HOME · ADM-WORKPLACE-SETTINGS · ADM-MEMBERS · ADM-IMPORT · ADM-EMPLOYEE-LIST · ADM-EMPLOYEE-DETAIL · ADM-EMPLOYEE-RESIGN · ADM-CONTRACTS · ADM-DOCUMENTS · ADM-SUBSCRIPTION |
| [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) | ADM-SCHEDULE · ADM-ATTENDANCE · ADM-ATTENDANCE-APPROVAL · ADM-ATTENDANCE-CLOSING · ADM-LEAVE-APPROVAL · ADM-LEAVE-BALANCE |
| [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) | ADM-PAYROLL-TERMS · ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · ADM-PAYROLL-LEDGER · ADM-PAYSLIP · ADM-SEVERANCE |
| [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) | ADM-TAX-FILING · ADM-TAX-SEPARATION · ADM-DEADLINE-CALENDAR · ADM-EMPLOYEE-COUNT · ADM-BUSINESS-UNIT · ADM-RETENTION |
| [10_system_console.md](./10_system_console.md) | SYS-WORKPLACES · SYS-USERS · SYS-SUBSCRIPTIONS · SYS-RATES · SYS-POLICY · SYS-AUDIT · SYS-TERMS |

파일별 화면 수 검산: 3 + 8 + 9 + **10** + 6 + 6 + 6 + 7 = **55**. 표준·추적성 2본은 화면 블록을 갖지 않는다. 본 인덱스까지 합해 **11파일**이며 파일 번호 11 이상은 쓰지 않는다.

## 화면 인벤토리 (55본 — 채번 정본)

| # | 화면코드 | 화면명 | 라우트/표면 | 소속 파일 |
|:--:|----------|--------|-------------|----------|
| 1 | **PUB-LANDING** | 서비스 소개 랜딩 | web_front 정적 / | [03_public.md](./03_public.md) |
| 2 | **PUB-PRICING** | 요금제 안내 | web_front 정적 /pricing | [03_public.md](./03_public.md) |
| 3 | **PUB-LEGAL** | 약관·개인정보·위치정보 문서 | web_front SPA /legal/[type] — CSR | [03_public.md](./03_public.md) |
| 4 | **PUB-SIGNUP** | 회원가입 | web_front SPA /signup · app_front 인증 스택 SignUp | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 5 | **PUB-LOGIN** | 로그인 | web_front SPA /login · app_front 인증 스택 SignIn | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 6 | **PUB-PASSWORD-RESET** | 비밀번호 재설정 | web_front SPA /password-reset · /password-reset/[token] · app_front 인증 스택 PasswordReset | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 7 | **PUB-CONSENT** | 약관·개인정보·위치정보 동의 | web_front SPA /consent · app_front 인증 스택 Consent | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 8 | **APP-INVITE** | 초대 수락·거절 | app_front 인증 스택 InviteAccept | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 9 | **APP-CHECKIN** | 출퇴근 체크인(홈) | app_front 드로어 홈 > Checkin — 드로어 초기 화면 | [05_app_employee.md](./05_app_employee.md) |
| 10 | **APP-ATTENDANCE** | 내 근태 내역 | app_front 드로어 근무 > Attendance | [05_app_employee.md](./05_app_employee.md) |
| 11 | **APP-LEAVE** | 휴가 신청·잔여 연차 | app_front 드로어 근무 > Leave | [05_app_employee.md](./05_app_employee.md) |
| 12 | **APP-PAYROLL-HISTORY** | 내 급여 이력 | app_front 드로어 급여 > PayrollHistory | [05_app_employee.md](./05_app_employee.md) |
| 13 | **APP-PAYSLIP** | 내 명세서 열람 | app_front 스택 PayslipDetail — 급여 화면 위 | [05_app_employee.md](./05_app_employee.md) |
| 14 | **APP-CONTRACT** | 내 문서 — 근로계약·서류 | app_front 드로어 내 정보 > Documents · 상세는 스택 ContractDetail | [05_app_employee.md](./05_app_employee.md) |
| 15 | **APP-NOTIFICATION** | 알림함 | app_front 드로어 알림 > Notifications | [05_app_employee.md](./05_app_employee.md) |
| 16 | **APP-SETTINGS** | 내 정보·설정 | app_front 드로어 내 정보 > Settings | [05_app_employee.md](./05_app_employee.md) |
| 17 | **APP-PRIVACY** | 개인정보·위치정보 관리 | app_front 드로어 내 정보 > Privacy | [05_app_employee.md](./05_app_employee.md) |
| 18 | **ADM-WORKPLACE-SELECT** | 사업장 선택·진입 분기 | web_front SPA /workplaces | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 19 | **ADM-WORKPLACE-CREATE** | 사업장 등록 | web_front SPA /workplaces/new | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 20 | **ADM-ACCOUNT** | 계정 설정 | web_front SPA /account | [04_auth_onboarding.md](./04_auth_onboarding.md) |
| 21 | **ADM-HOME** | 관리자 홈 — 오늘 할 일·마감·기한 | web_front SPA /home | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 22 | **ADM-WORKPLACE-SETTINGS** | 사업장 설정·검증 상태 | web_front SPA /settings/workplace | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 23 | **ADM-MEMBERS** | 멤버·역할·초대 관리 | web_front SPA /members | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 24 | **ADM-IMPORT** | 데이터 온보딩·일괄 임포트 | web_front SPA /import | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 25 | **ADM-EMPLOYEE-LIST** | 직원 목록·입사 처리 | web_front SPA /employees | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 26 | **ADM-EMPLOYEE-DETAIL** | 직원 상세 — 인적사항·근로조건·보험 | web_front SPA /employees/[id] | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 27 | **ADM-EMPLOYEE-RESIGN** | 퇴사 처리 | web_front SPA /employees/[id]/resignation | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 28 | **ADM-CONTRACTS** | 근로계약 작성·발송·서명 현황 | web_front SPA /contracts | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 29 | **ADM-DOCUMENTS** | 직원 문서함 | web_front SPA /documents | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 30 | **ADM-SUBSCRIPTION** | 구독·이용 한도 | web_front SPA /settings/subscription | [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) |
| 31 | **ADM-SCHEDULE** | 근무 스케줄 편성 | web_front SPA /attendance/schedules | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 32 | **ADM-ATTENDANCE** | 근태 현황 | web_front SPA /attendance | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 33 | **ADM-ATTENDANCE-APPROVAL** | 근태 수정 요청 승인 | web_front SPA /attendance/approvals | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 34 | **ADM-ATTENDANCE-CLOSING** | 근태 마감 | web_front SPA /attendance/closing | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 35 | **ADM-LEAVE-APPROVAL** | 휴가 승인 | web_front SPA /leave/approvals | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 36 | **ADM-LEAVE-BALANCE** | 연차 현황·원장 | web_front SPA /leave/balances | [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) |
| 37 | **ADM-PAYROLL-TERMS** | 급여 기준 설정 | web_front SPA /payroll/terms | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 38 | **ADM-PAYROLL-PREVIEW** | 급여 미리보기 | web_front SPA /payroll/preview | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 39 | **ADM-PAYROLL-RUN** | 급여 실행·확정 | web_front SPA /payroll/runs · /payroll/runs/[id] | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 40 | **ADM-PAYROLL-LEDGER** | 급여대장·급여 이력 | web_front SPA /payroll/ledger | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 41 | **ADM-PAYSLIP** | 명세서 발행·교부 현황 | web_front SPA /payslips | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 42 | **ADM-SEVERANCE** | 퇴직 정산·금품청산 | web_front SPA /payroll/severance | [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) |
| 43 | **ADM-TAX-FILING** | 4대보험 취득·상실 신고자료 | web_front SPA /tax/insurance-reports | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 44 | **ADM-TAX-SEPARATION** | 이직확인서 | web_front SPA /tax/separation-certificates | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 45 | **ADM-DEADLINE-CALENDAR** | 신고 기한 캘린더 | web_front SPA /tax/deadlines | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 46 | **ADM-EMPLOYEE-COUNT** | 상시근로자 산정 현황 | web_front SPA /compliance/employee-count | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 47 | **ADM-BUSINESS-UNIT** | 사업 단위 판정 | web_front SPA /compliance/business-unit | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 48 | **ADM-RETENTION** | 법정 서류 보존 관리 | web_front SPA /compliance/retention | [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) |
| 49 | **SYS-WORKPLACES** | 사업장 관리 | web_front SPA /system/workplaces | [10_system_console.md](./10_system_console.md) |
| 50 | **SYS-USERS** | 사용자 관리 | web_front SPA /system/users | [10_system_console.md](./10_system_console.md) |
| 51 | **SYS-SUBSCRIPTIONS** | 구독·요금제 관리 | web_front SPA /system/subscriptions | [10_system_console.md](./10_system_console.md) |
| 52 | **SYS-RATES** | 기준값 관리 | web_front SPA /system/rates | [10_system_console.md](./10_system_console.md) |
| 53 | **SYS-POLICY** | 규모별 적용 정책 관리 | web_front SPA /system/size-policies | [10_system_console.md](./10_system_console.md) |
| 54 | **SYS-AUDIT** | 감사 로그 | web_front SPA /system/audit-logs | [10_system_console.md](./10_system_console.md) |
| 55 | **SYS-TERMS** | 약관·개인정보·위치정보 문서 관리 | web_front SPA /system/terms | [10_system_console.md](./10_system_console.md) |

## 표면별 집계

| 표면 | 접두사 | 화면 수 | 저장소·산출물 |
|------|--------|:------:|--------------|
| 공개 페이지 | PUB | 7 | web_front — 랜딩·요금제 2본은 프리렌더 정적, 법정 문서 1본과 인증 4본은 SPA. 인증 4본은 app_front 인증 스택과 공용이다 |
| 직원 앱 | APP | 10 | app_front — 인증 스택 1본 + 드로어 5섹션 8항목(홈 · 근무 · 급여 · 알림 · 내 정보) + 스택 하위 1본(APP-PAYSLIP) 9본 |
| 관리자 웹 | ADM | 31 | web_front SPA |
| 시스템 웹 | SYS | 7 | web_front SPA |

검산: 7 + 10 + **31** + 7 = **55**. 웹 산출물 축 검산: 프리렌더 정적 2 + SPA **43**(PUB 5 + ADM **31** + SYS 7) = **45**이며 나머지 10본은 app_front 단독이다(인증 4본은 웹·앱 양쪽 표면을 가지므로 웹 축에 5본으로 이미 세어져 있다).

- **PUB 7본 중 3본만 순수 공개 콘텐츠**다(PUB-LANDING · PUB-PRICING · PUB-LEGAL — D-02의 산출물). 나머지 4본은 미인증 상태에서 시작하는 인증 흐름이며 웹과 앱이 같은 기능군을 담는다.
- **순수 공개 3본 안에서도 렌더링 축이 갈린다** — 랜딩·요금제는 검색 노출이 필요해 프리렌더하고, 법정 문서는 활성 버전 즉시 반영이 우선이라 프리렌더하지 않는다(D-20 · 정본 [../04_architecture/05_rendering_seo.md](../04_architecture/05_rendering_seo.md)).
- **ADM 31본이 전체의 절반을 넘는 것은 사업장 운영이 제품의 본체이기 때문**이다 — 98기능 중 최소 역할이 MANAGER인 기능이 51개다([../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md) §4).
- **ADM-HOME은 조회 전용 2기능의 주 표면이자 9기능의 진입 표면**이다 — ATT-10 오늘 출근 보드와 DSH-03 인건비 추이를 직접 보이고(D-23), 나머지 9기능은 대기·상태를 모아 그 화면으로 보낸다. 홈은 **실행을 하지 않는다** — 승인·마감·확정은 각 기능의 주 표면이 한다. DSH는 여전히 도메인이 아니며 채택 DSH 기능은 데이터 소유 도메인 파일의 행이다([../02_features/README.md](../02_features/README.md)).
- **APP 10본은 STAFF 9기능과 본인 소유권 열람(CMP-07)·알림(NTF)·동의(PRV)를 담는다.** 승인·확정·인사 수정 표면은 앱에 두지 않는다.
- 우선순위 분포는 P0 **22** · P1 28 · P2 5이며 **22** + 28 + 5 = **55**다. 화면 우선순위는 그 화면이 담는 기능의 **최고 우선순위**를 따르므로, P2 기능만 담는 화면 5본(APP-LEAVE · ADM-CONTRACTS · ADM-DOCUMENTS · ADM-LEAVE-APPROVAL · ADM-LEAVE-BALANCE)만 P2다.

## 비라우트 화면 코드 부여 기준

**모달·오버레이·시트에 화면 코드를 부여하지 않는 것이 원칙**이다. 화면 코드는 라우트 또는 앱 드로어·스택의 목적지에만 붙이고, 그 안에서 열리는 오버레이는 소속 화면 명세의 H3 요소 블록으로 기술한다.

| 판정 | 처리 |
|------|------|
| 독립 라우트·드로어 항목·스택 목적지 | 화면 코드를 부여한다 |
| 소속 화면 안에서 열리는 모달·시트·오버레이 | 코드를 부여하지 않고 H3 요소 블록으로 쓴다. **앱의 내비게이션 드로어는 화면 안 오버레이가 아니라 셸 요소**라 이 판정 대상이 아니다 |
| 화면 안 인라인 확인 줄·단계 전환 | 요소로도 세지 않고 소속 화면의 화면 기능 표에 액션으로 적는다 |
| 전 화면 공통 셸 요소(사이드바 · 내비게이션 드로어 · 상단 앱바 · 알림 벨 · 토스트) | [01_standards.md](./01_standards.md) §3·§4가 규격 정본이며 개별 화면이 다시 쓰지 않는다 |

**v1에는 화면 코드를 가진 비라우트 화면이 없다.** 되돌릴 수 없는 작업(급여 확정 · 근태 마감 · 사업장 폐쇄 · 명세서 발행·정정)의 확인 단계는 전부 소속 화면의 2단 확인 + 재인증 요소이며 별도 코드를 만들지 않는다 — 코드를 주면 추적성 표에서 확정 기능이 두 화면으로 갈라져 어느 쪽이 계약의 소유자인지 흐려진다.

## 고정 기준

전 문서 공통 수치의 정본은 [../README.md](../README.md) 고정 기준 표다. 아래는 본 폴더가 정본인 값과 인용 값을 구분한 것이며, 어긋나면 지목된 정본이 우선한다.

| 항목 | 기준 | 본 폴더의 지위 |
|------|------|---------------|
| 화면 수 | **55본**. **세는 기준은 화면 명세 H2 블록 수이며 화면 내 요소 H3는 세지 않는다** | **정본** |
| 화면 코드 | {표면}-{의미}. 끝 토큰은 순번이 아니라 의미형이다 | **정본**(위 인벤토리 표) |
| 표면 4종 | 공개 페이지(PUB) · 직원 앱(APP) · 관리자 웹(ADM) · 시스템 웹(SYS) | 인용 — 정본은 [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md) |
| 기능 수 | 98개. 화면 매핑 미매핑 0 | 인용 — 정본은 [../02_features/README.md](../02_features/README.md) |
| 접근권한 값 | 비인증 / 본인 / STAFF / MANAGER / OWNER / 플랫폼({역할}) | **정본**([01_standards.md](./01_standards.md) §1) |
| 사업장 역할 | OWNER ⊃ MANAGER ⊃ STAFF 누적 3종. ADVISOR는 v1에 두지 않는다 | 인용 — 정본은 [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md) |
| 플랫폼 역할 | VIEWER(1) · SUPPORT(2) · ADMIN(3) · SUPER_ADMIN(4) | 인용 |
| 우선순위 | P0 **22** · P1 28 · P2 5. 화면 우선순위는 담은 기능의 최고 우선순위를 따른다 | **정본**(화면별 값) |
| 뷰포트 | 웹 1920 · 1440 · 1024 · 768 · 390. **1024 이상은 콘텐츠 영역 무스크롤**(D-24). 앱은 안전 영역 기준 | **정본**([01_standards.md](./01_standards.md) §5) |
| 화면 코드 없는 요소 | 모달·시트·드로어·인라인 확인. 코드를 부여하지 않는다 | **정본**(본 문서 비라우트 절) |

## v1에 두지 않는 화면

아래는 원천 문서가 언급하지만 **v1 화면으로 만들지 않는다**. 다른 문서도 현행 화면처럼 인용하지 않는다.

- **DSH 전용 화면을 두지 않는다** — DSH는 문서 도메인이 아니며 채택된 2기능(D-23)은 기존 화면에 담는다: DSH-03 인건비 추이는 **ADM-HOME의 카드 하나**, DSH-06 리포트 내보내기는 **목록 화면 공통 표 조작**이다. 홈에 두는 추이는 **확정 급여의 월별 요약 막대 하나뿐이고 분포 · 예측 · 사업장 간 비교 같은 통계 표면을 두지 않는다**(DSH-04 근태 통계 · SYS-10 분석 통계는 영구 제외 유지). 홈에 그 밖의 새 기능ID가 필요해지면 홈에 넣지 않고 기능 채번 정본에서 먼저 채택을 정한다.
- **ADVISOR 전용 조회 화면을 두지 않는다**(WRK-13 이월) — 외부 세무사·노무사에게 읽기 전용 표면을 여는 경로가 v1에 없다.
- **푸시 알림 수신 설정 화면을 두지 않는다**(NTF-02 · NTF-06 이월) — v1은 인앱 알림 단일 채널이고 타입별 수신 on/off 표면이 없다.
- **플랫폼 역할 임명·회수 화면을 두지 않는다**(SYS-02 이월) — 초기 SUPER_ADMIN은 시드가 아니라 서버 기동 시 환경변수 1회성 부트스트랩으로 만들고(정본 05_database/10_migrations_seed.md) 이후 부여·회수는 운영 절차로 처리한다.
- **플랫폼 공지 관리 화면(SYS-09) · 분석 통계 화면(SYS-10)을 두지 않는다.**
- **관리자 웹에 독립 알림함 화면을 두지 않는다** — 관리자의 업무 진입점은 승인 대기 목록(ADM-ATTENDANCE-APPROVAL · ADM-LEAVE-APPROVAL)이고 알림은 셸의 보조 채널이므로, 헤더 알림 벨 오버레이로만 제공한다(규격 정본 [01_standards.md](./01_standards.md) §4).
- **QR·키오스크 체크인 화면(ATT-11) · 오프라인 기록 화면(ATT-14)을 두지 않는다** — v1의 체크인 경로는 앱 GPS 단일 경로다. **실시간 근태 현황(ATT-10)은 독립 현황판 화면이 아니라 ADM-HOME의 오늘 출근 보드로 담는다**(D-23).

## 추적성

화면을 추가·변경·삭제하면 같은 변경 단위에서 아래를 함께 갱신한다.

- [02_traceability.md](./02_traceability.md) — 기능 → 화면 매핑과 화면별 담은 기능 수 파생 집계
- [../03_requirements/17_traceability.md](../03_requirements/17_traceability.md) — 기능 ↔ REQ ↔ 화면 ↔ API ↔ 테이블 전수 매핑
- 본 README의 화면 인벤토리 표 · 표면별 집계 · 파일별 화면 수 검산

## 관련 문서

- 화면 공통 표준·템플릿·품질 기준 → [01_standards.md](./01_standards.md)
- 기능 → 화면 추적성 → [02_traceability.md](./02_traceability.md)
- 기능 채번 정본 → [../02_features/README.md](../02_features/README.md)
- 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 요구사항 정본 → [../03_requirements/README.md](../03_requirements/README.md)
- API 표면 정본 → [../06_api/README.md](../06_api/README.md)
- 렌더링·SEO 정본 → [../04_architecture/05_rendering_seo.md](../04_architecture/05_rendering_seo.md)
- ID 채번 상세 → [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)
