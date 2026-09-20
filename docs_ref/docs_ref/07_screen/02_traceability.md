# 추적성 매트릭스 — 기능ID → 화면코드 (02_traceability)

> **대상**: 13도메인 98기능(DSH 행 2 포함) → 화면 코드 전수 매핑(미매핑 0)과 화면별 담은 기능 수 파생 집계
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — 구현이 앞선 표시 수식어 3건을 등재한다 — **SLP-03 → ADM-HOME(상태 표시)**(마감 진행 보드의 명세서 교부 단계 — 화면 정본 [06_admin_workplace_hr.md](./06_admin_workplace_hr.md)가 이미 담고 있었으나 이 표에 없었다) · **ATT-07 · LEV-03 → ADM-WORKPLACE-SELECT(대기 표시)**(사업장 카드의 처리 대기 건수 — 홈의 같은 건수가 대기 표시로 세이는 것과 같은 축). **수식어 36종 불변**. 담은 기능 수 ADM-HOME 10 → **11** · ADM-WORKPLACE-SELECT 5 → **7** · 04 소계 32 → **34** · 06 소계 35 → **36** · 총계 182 → **185** · 기능 98 · 화면 55 불변
> **개정일**: 2026-09-16 — **D-23 채택 4기능 매핑** — AUT-05 → ADM-ACCOUNT(주 표면) · ATT-10 → ADM-HOME(주 표면 — 오늘 출근 보드) · DSH-03 → ADM-HOME(주 표면 — 인건비 추이) · DSH-06 → **(전역)**(관리자 웹·시스템 웹 목록 화면 공통 표 조작). (전역) 정의에 **전 목록 화면 공통 표 조작**을 더한다 — 목록 화면 약 30본에 같은 수식어를 붙이면 담은 기능 수가 조작 하나로 일제히 움직여 집계가 의미를 잃는다. **수식어 36종은 불변**(주 표면이라 수식어가 없다). 기능 94 → **98** · 화면 표면 있는 기능 92 → **95** · 없는 기능 2 → **3**((서버) 1 · (전역) 2) · 담은 기능 수 ADM-ACCOUNT 5 → **6** · ADM-HOME 8 → **10** · 04 소계 31 → **32** · 06 소계 33 → **35** · 총계 179 → **182** · 화면 55 불변
> **개정일**: 2026-09-10 — **ADM-HOME 신설** 반영(정본 [README.md](./README.md) — 화면 54 → **55본** · ADM 30 → **31**). 홈은 **기능ID를 소유하지 않으므로 8기능 행에 표시 수식어로만 붙는다** — ATT-07(대기 표시) · LEV-03(대기 표시) · ATT-08(상태 표시) · PAY-08(상태 표시) · TAX-11(경고) · WRK-14(경고) · SUB-05(경고) · NTF-01(표시)이며 **전부 기존 폐집합 안이라 수식어 36종은 불변**이다. 화면별 담은 기능 수 ADM-HOME **8** · 06_admin_workplace_hr 소계 25 → **33**(화면 9 → **10**) · 총계 171 → **179** · 화면 수 검산 54 → **55**를 같은 변경 단위에서 다시 셌다. **기능 94 · 화면 표면 있는 기능 92 · 없는 기능 2 · (배치) 병기 14는 전건 불변**
> **개정일**: 2026-08-20 — 정본([05_app_employee.md](./05_app_employee.md)) 갱신 반영 — HRM-09 행에 **APP-ATTENDANCE(본인 증빙) · APP-LEAVE(본인 증빙)** 추가 · 실행 수식어 **(본인 증빙)** 신설(14 → **15종** · 전체 35 → **36종**) · 화면별 담은 기능 수 APP-ATTENDANCE 6 → **7** · APP-LEAVE 4 → **5** · 05_app_employee 소계 41 → **43** · 총계 169 → **171**
> **개정일**: 2026-08-03 — 재검증 표면을 WRK-14로 단일 귀속(WRK-02 행에서 ADM-WORKPLACE-SETTINGS 제거 — 담은 기능 수 170 → **169**) · 수식어 정합 4행(ATT-13 · PAY-19 · SUB-02 · SYS-11) · 주 표면 복수 허용 조건 명문화
> **원천**: [../02_features/README.md](../02_features/README.md)(98기능 채번 정본) · [README.md](./README.md)(화면 인벤토리 55본) · [01_standards.md](./01_standards.md)(접근권한·템플릿 규약) · 03~10 도메인 화면 명세의 담은 기능ID

> **이 문서의 지위**: **파생 표**다. 기능 측 정본은 [../02_features](../02_features/README.md)이고 화면 측 근거는 각 도메인 파일(03~10)의 담은 기능ID다. 세 쪽이 어긋나면 **02_features(기능)와 03~10(화면)이 우선**하며 이 표를 근거로 기능·화면을 바꾸지 않는다.

**보장 조건**: 98개 기능ID 전부가 ≥ 1개 화면코드 또는 (서버)·(전역)·(배치)에 매핑된다(미매핑 0건).

**집계**: 화면 표면이 있는 기능 **95**개, 화면 표면이 없는 기능 **3**개((서버) 1 · (전역) 2). 95 + 3 = **98**.

---

## 표기

### 표기 값

| 표기 | 뜻 | 집계 |
|------|-----|:----:|
| 화면코드 | 그 화면에 사용자가 보거나 조작하는 표면이 있다 | 센다 |
| 화면코드({수식어}) | 표면이 있되 그 화면이 담당하는 축을 괄호로 좁힌다. 수식어는 아래 2부류만 쓴다 | 센다 |
| **(서버)** | 전용 화면 없는 서버·데이터베이스 계층 처리·구현 규약. 화면은 결과만 소비한다 | 세지 않는다 |
| **(전역)** | 특정 화면에 귀속되지 않고 전 인증 화면의 셸·게이트로 적용되거나, **전 목록 화면에 공통으로 붙는 표 조작**(DSH-06 내보내기)이다 | 세지 않는다 |
| **(배치)** | **정기작업이 이 기능의 실행 일부를 수행한다.** 아래 (배치) 표기 기준 참조 | 세지 않는다 |
| **(소비)** | 그 화면이 규약·카탈로그를 소비하지만 자체 표면은 아니다 | 세지 않는다 |

### 수식어 2부류

수식어는 **실행 수식어**와 **표시 수식어** 둘뿐이다. **둘 다 그 화면에 표면이 있다는 뜻이므로 화면별 담은 기능 수 집계에 넣는다** — 세지 않는 것은 (서버)·(전역)·(배치)·(소비) 넷뿐이다. 아래 목록 밖의 수식어를 새로 만들지 않는다.

| 부류 | 뜻 | 허용 수식어 |
|------|-----|------------|
| **실행 수식어** | 그 화면이 기능 실행의 일부를 직접 수행한다. 어느 축을 맡는지를 좁혀 적는다 | (제재 실행) · (재검증) · (검증 대기 생성) · (대리 제출) · (대리 승인) · (예외 승인) · (배치 차단) · (진입 분기) · (복귀 경로 보존) · (로그아웃) · (본인 재발급) · (변경 요청) · (관리자 측) · (공개 게시) · **(본인 증빙)** — **15종** |
| **표시 수식어** | 그 화면이 기능의 결과·사실을 보이거나 다른 화면으로 보낸다. 실행은 다른 화면이 한다 | (진입점) · (표시) · (결과 표시) · (판정 표시) · (집계 표시) · (상태 표시) · (위반 표시) · (미적용 표시) · (차단 발현) · (대기 표시) · (대기 목록) · (본인 조회) · (본인 공개 문서) · (현황) · (경고) · (안내) · (고지) · (수신) · (수신 표면) · (대조) · (연계) — **21종** |

- 검산: 실행 **15** + 표시 21 = **36종**이며 이 밖의 수식어를 새로 만들지 않는다.
- **(본인 증빙)은 2026-08-20 신설분**이다. 직원이 자기 증빙 파일을 올리는 축이며 업로드 표면은 [../06_api/05_hr.md](../06_api/05_hr.md) #27의 본인 축이다. 기존 14종 중 맞는 것이 없어 새로 세웠고 **같은 변경 단위에서 검산식을 다시 셌다** — (변경 요청)은 HRM-01의 인적사항 변경 축이고 (본인 재발급)은 SLP-07의 명세서 축이라 둘 다 이 자리에 쓸 수 없다.
- **한 화면이 같은 기능의 두 축을 맡으면 수식어를 가운뎃점으로 잇는다** — 예: APP-LEAVE의 LEV-01(결과 표시·미적용 표시) · APP-PRIVACY의 SYS-11(진입점·연계) · APP-SETTINGS의 HRM-01(본인 조회·변경 요청).
- 수식어 없는 화면코드는 그 화면이 **기능의 주 표면**(기능을 완결 실행하는 표면)이라는 뜻이다. 주 표면은 하나인 것이 원칙이나, **같은 기능을 복수 화면이 각자 완결 실행하는 경우**(직원 앱·관리자 웹처럼 표면이 갈리는 경우 · 미리보기와 확정처럼 정책만 다른 대칭 쌍 — §ADM 집계의 대칭 선언 참조)에는 복수를 허용한다. 그 밖의 화면은 수식어를 단다.

### (배치) 표기 기준

**(배치)는 정기작업이 그 기능의 실행 일부를 수행함을 뜻하며 화면코드와 반드시 병기한다.** 단독으로 쓰지 않는다 — **v1에는 정기작업만으로 완결되어 화면이 결과조차 소비하지 않는 기능이 없다.** 대상은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) 작업 목록의 관련 기능 열에 등장하는 **14기능**이며 그 밖의 기능에는 붙이지 않는다.

| 정기작업 | 관련 기능 |
|----------|----------|
| expireInvitations | WRK-04 · WRK-05 |
| autoUnsuspendAccounts | AUT-08 |
| checkSubscriptionExpiry | SUB-05 · NTF-01 |
| rollupAttendanceDaily | ATT-04 · ATT-05 |
| accrueAndExpireLeave | LEV-01 |
| recomputeEmployeeCountSnapshot | CMP-01 |
| checkComplianceDeadlines | PAY-19 · TAX-02 · TAX-11 |
| retryPayslipAndPush | SLP-01 · SLP-05 |

검산: 2 + 1 + 2 + 2 + 1 + 1 + 3 + 2 = **14기능**(중복 없음).

**화면코드는 55본**이다 — PUB 7 · APP 10 · ADM **31** · SYS 7이며 정본은 [README.md](./README.md)다. 비라우트 화면 코드는 v1에 없다.

**도메인별 기능 수**: AUT 10 · WRK 13 · HRM 11 · ATT 12 · LEV 5 · PAY 13 · SLP 7 · TAX 3 · CMP 5 · NTF 3 · SUB 5 · SYS 7 · PRV 2 · DSH 2 = **98**. DSH 2행은 02 · 06 절에 소속 도메인 파일을 따라 놓인다.

---

## 01. 인증·계정 (AUT 10)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| AUT-01 | 회원가입 | PUB-SIGNUP · PUB-LANDING(진입점) · PUB-PRICING(진입점) |
| AUT-02 | 로그인 | PUB-LOGIN · PUB-LANDING(진입점) |
| AUT-03 | 세션 관리 | PUB-LOGIN(복귀 경로 보존) · APP-SETTINGS(로그아웃) · (전역) |
| AUT-04 | 아이디 중복 확인 | PUB-SIGNUP |
| AUT-05 | 프로필 관리 | ADM-ACCOUNT |
| AUT-06 | 비밀번호 변경 | ADM-ACCOUNT · APP-SETTINGS |
| AUT-08 | 계정 상태 머신 | SYS-USERS(제재 실행) · PUB-LOGIN(차단 발현) · ADM-ACCOUNT · APP-SETTINGS · (배치) |
| AUT-07 | 비밀번호 재설정 | PUB-PASSWORD-RESET |
| AUT-09 | 계정 삭제(탈퇴) | ADM-ACCOUNT · APP-SETTINGS |
| AUT-10 | 진입 컨텍스트 분기 | PUB-LOGIN · ADM-WORKPLACE-SELECT · PUB-SIGNUP(진입 분기) · PUB-CONSENT(연계) |

**AUT-05는 결번**이다 — 프로필 관리는 v1.1 이월이므로 이름·연락처 변경 화면을 만들지 않는다.

---

## 02. 사업장·멤버·온보딩 (WRK 13 · DSH 1)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| WRK-01 | 사업장 등록 | ADM-WORKPLACE-CREATE · ADM-WORKPLACE-SELECT(진입점) |
| WRK-02 | 사업자 진위/상태 검증 | ADM-WORKPLACE-CREATE · (서버) |
| WRK-03 | 사업장 정보 관리 | ADM-WORKPLACE-SETTINGS |
| WRK-04 | 직원 초대 | ADM-MEMBERS · (배치) |
| WRK-05 | 초대 수락/거절 | APP-INVITE · ADM-WORKPLACE-SELECT(대기 표시) · (배치) |
| WRK-06 | 사업장 선택/전환 | ADM-WORKPLACE-SELECT · APP-SETTINGS · ADM-ACCOUNT(진입점) |
| WRK-07 | 멤버 역할 관리 | ADM-MEMBERS |
| WRK-08 | 멤버 목록·검색 | ADM-MEMBERS |
| WRK-09 | 멤버 제외 | ADM-MEMBERS |
| WRK-10 | 사업장 폐쇄 | ADM-WORKPLACE-SETTINGS |
| WRK-11 | 사업장 등록 한도 | ADM-WORKPLACE-CREATE · ADM-WORKPLACE-SELECT(표시) · ADM-SUBSCRIPTION(표시) |
| WRK-14 | 사업장 검증 상태 관리 | ADM-WORKPLACE-SETTINGS · ADM-WORKPLACE-CREATE(검증 대기 생성) · ADM-HOME(경고) · (서버) |
| WRK-16 | 데이터 온보딩·일괄 임포트 | ADM-IMPORT |
| DSH-06 | 리포트 내보내기 | **(전역)** — 관리자 웹 · 시스템 웹 목록 화면의 표 상단 공통 조작 |

**WRK-12 · WRK-13 · WRK-15는 결번**이다 — 업종 프리셋 · ADVISOR 초대 · 다중 근무지가 v1.1 이월이므로 **ADVISOR 전용 화면과 다중 근무지 편집 화면을 만들지 않는다**.

---

## 03. 인사 (HRM 11)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| HRM-01 | 직원 인적사항 | ADM-EMPLOYEE-DETAIL · APP-SETTINGS(본인 조회·변경 요청) |
| HRM-02 | 고용형태/근로조건 | ADM-EMPLOYEE-DETAIL |
| HRM-03 | 입사 처리 | ADM-EMPLOYEE-LIST |
| HRM-04 | 퇴사 처리 | ADM-EMPLOYEE-RESIGN |
| HRM-05 | 4대보험 정보 | ADM-EMPLOYEE-DETAIL |
| HRM-06 | 근로계약서 작성 | ADM-CONTRACTS · APP-CONTRACT(수신) |
| HRM-07 | 근로계약 전자서명 | APP-CONTRACT · ADM-CONTRACTS(현황) |
| HRM-09 | 직원 문서함 | ADM-DOCUMENTS · APP-CONTRACT(본인 공개 문서) · APP-ATTENDANCE(본인 증빙) · APP-LEAVE(본인 증빙) |
| HRM-11 | 근로자명부 | ADM-EMPLOYEE-LIST |
| HRM-14 | 연소자 고용 관리 | ADM-EMPLOYEE-DETAIL · ADM-SCHEDULE(배치 차단) |
| HRM-16 | 근로자 아닌 자 구분 | ADM-EMPLOYEE-DETAIL |

**HRM-08 · 10 · 12 · 13 · 15는 결번**이며 v1.1 이월이다.

---

## 04. 근태 (ATT 12)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| ATT-01 | 출근/퇴근 체크인 | APP-CHECKIN |
| ATT-02 | 지오펜스 검증 | APP-CHECKIN · ADM-ATTENDANCE(예외 승인) · (서버) |
| ATT-03 | 휴게시간 기록 | APP-CHECKIN · APP-ATTENDANCE(표시) · ADM-ATTENDANCE(표시) |
| ATT-04 | 지각/조퇴/결근 판정 | APP-ATTENDANCE(판정 표시) · ADM-ATTENDANCE · APP-CHECKIN(결과 표시) · (서버) · (배치) |
| ATT-05 | 연장/야간/휴일 집계 | APP-ATTENDANCE(집계 표시) · ADM-ATTENDANCE · (서버) · (배치) |
| ATT-06 | 근태 수정 요청 | APP-ATTENDANCE · ADM-ATTENDANCE(대리 제출) · ADM-ATTENDANCE-APPROVAL(대기 목록) · APP-CHECKIN(진입점) |
| ATT-07 | 근태 승인 | ADM-ATTENDANCE-APPROVAL · ADM-ATTENDANCE(대리 승인) · ADM-HOME(대기 표시) · ADM-WORKPLACE-SELECT(대기 표시) |
| ATT-08 | 근태 마감 | ADM-ATTENDANCE-CLOSING · APP-ATTENDANCE(표시) · ADM-HOME(상태 표시) |
| ATT-09 | 근무 스케줄 | ADM-SCHEDULE |
| ATT-10 | 실시간 근태 현황 | ADM-HOME |
| ATT-12 | 휴게시간 준수 검증 | ADM-ATTENDANCE-CLOSING · ADM-ATTENDANCE(위반 표시) · APP-CHECKIN(안내) · APP-ATTENDANCE(표시) · (서버) |
| ATT-13 | 근로시간 한도 경고 | ADM-SCHEDULE · ADM-ATTENDANCE(경고) · (서버) |

**ATT-10 · 11 · 14 · 15는 결번**이다 — 실시간 현황 · QR·키오스크 체크인 · 오프라인 기록 · 위치 조작 방지가 v1.1 이월이므로 **체크인 경로는 앱 GPS 단일 경로**이고 오프라인 큐잉 화면을 만들지 않는다.

---

## 05. 휴가·연차 (LEV 5)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| LEV-01 | 연차 자동 산정 | ADM-LEAVE-BALANCE · **ADM-EMPLOYEE-DETAIL(보호 기간 등록)** · APP-LEAVE(결과 표시·미적용 표시) · (배치) |
| LEV-02 | 휴가 신청 | APP-LEAVE · ADM-LEAVE-APPROVAL(대기 목록) |
| LEV-03 | 휴가 승인 | ADM-LEAVE-APPROVAL · APP-LEAVE(결과 표시) · ADM-HOME(대기 표시) · ADM-WORKPLACE-SELECT(대기 표시) |
| LEV-04 | 잔여 연차 조회 | APP-LEAVE · ADM-LEAVE-BALANCE |
| LEV-06 | 급여 연동 | ADM-LEAVE-BALANCE(표시) · ADM-PAYROLL-PREVIEW(표시) · ADM-PAYROLL-RUN(표시) · (서버) |

**LEV-05 · 07 · 08은 결번**이다 — 휴가 유형 관리 · 연차 사용촉진 · 법정휴가 유형 시드가 v1.1 이월이므로 **사업장 약정 휴가 유형 편집 화면과 사용촉진 화면을 만들지 않는다**.

---

## 06. 급여 (PAY 13 · DSH 1)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| PAY-01 | 급여 기준 설정 | ADM-PAYROLL-TERMS |
| PAY-02 | 근태 연동 계산 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) |
| PAY-03 | 법정수당 계산 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) |
| PAY-04 | 4대보험 공제 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) |
| PAY-05 | 소득세 공제 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN · (서버) |
| PAY-06 | 최저임금 검증 | ADM-PAYROLL-PREVIEW · ADM-PAYROLL-RUN |
| PAY-07 | 급여 미리보기 | ADM-PAYROLL-PREVIEW |
| PAY-08 | 급여 확정 | ADM-PAYROLL-RUN · ADM-HOME(상태 표시) |
| PAY-09 | 급여대장(임금대장) | ADM-PAYROLL-LEDGER |
| PAY-10 | 급여 이력 | ADM-PAYROLL-LEDGER · APP-PAYROLL-HISTORY |
| PAY-11 | 퇴직금 — 판정·개산액·기한 경보 | ADM-SEVERANCE |
| PAY-13 | 비과세·과세 구분 관리 | ADM-PAYROLL-TERMS |
| PAY-19 | 금품청산 기한 관리 | ADM-SEVERANCE · ADM-DEADLINE-CALENDAR(표시) · (배치) |
| DSH-03 | 인건비 추이 | ADM-HOME |

**PAY-12는 영구 제외**(신고 직접 전송)이고 **PAY-14~18은 결번**이다 — 포괄임금 · 일용직 급여 · 이체 자료 · 공제·가불 · 지급일 정기성 검증이 v1.1 이월이므로 해당 화면을 만들지 않는다.

---

## 07. 명세서 (SLP 7)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| SLP-01 | 명세서 자동 생성 | ADM-PAYSLIP · APP-PAYSLIP(상태 표시) · (서버) · (배치) |
| SLP-02 | 법정 필수항목 | ADM-PAYSLIP · APP-PAYSLIP(표시) · (서버) |
| SLP-03 | 명세서 교부/열람 | APP-PAYSLIP · ADM-PAYSLIP · APP-PAYROLL-HISTORY(진입점) · ADM-HOME(상태 표시) |
| SLP-04 | 명세서 보관 | ADM-PAYSLIP · (서버) |
| SLP-05 | 일괄 발행 | ADM-PAYSLIP · (배치) |
| SLP-06 | 발행 알림 | APP-NOTIFICATION(수신 표면) · (서버) |
| SLP-07 | 명세서 재발급/정정 | ADM-PAYSLIP · APP-PAYSLIP(본인 재발급) |

결번은 없다.

---

## 08. 세무·4대보험 신고 (TAX 3)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| TAX-01 | 4대보험 취득·상실 신고자료 | ADM-TAX-FILING |
| TAX-02 | 이직확인서 | ADM-TAX-SEPARATION · (배치) |
| TAX-11 | 신고 기한 캘린더·알림 | ADM-DEADLINE-CALENDAR · ADM-HOME(경고) · (배치) |

**TAX-03~10은 결번**이다 — 원천징수이행상황신고서 · 지급명세서 · 연말정산 · 중도퇴사자 정산 · 원천징수영수증 · 보수총액 신고 · 일용근로내용 확인신고서 · 두루누리 판정이 v1.1 이후 이월이므로 해당 화면을 만들지 않고 **미지원 고지만 ADM-DEADLINE-CALENDAR에 둔다**.

---

## 09. 법정 준수 (CMP 5)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| CMP-01 | 상시근로자 수 산정 | ADM-EMPLOYEE-COUNT · (배치) |
| CMP-02 | 규모별 적용 정책 버전 관리 | SYS-POLICY |
| CMP-04 | 법정 서류 보존 관리 | ADM-RETENTION |
| CMP-07 | 퇴사자 본인 법정문서 열람 | APP-PAYSLIP · APP-PAYROLL-HISTORY · APP-CONTRACT · ADM-ACCOUNT(고지) |
| CMP-08 | 사업 단위 판정(합산 범위) | ADM-BUSINESS-UNIT · ADM-WORKPLACE-CREATE(고지) · PUB-PRICING(고지) |

**CMP-03 · 05 · 06은 결번**이며 v1.1 이후 이월이다. **CMP-07은 화면코드를 새로 만들지 않고 기존 앱 화면 3본의 접근권한 축으로 성립한다** — 멤버십이 끝난 뒤에도 본인 소유권만으로 열리는 성질을 화면 코드로 분리하면 같은 화면이 둘로 갈라진다.

---

## 10. 알림 (NTF 3)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| NTF-01 | 인앱 알림 배달 | APP-NOTIFICATION · ADM-HOME(표시) · (전역) · (배치) |
| NTF-03 | 알림 목록·읽음 | APP-NOTIFICATION |
| NTF-04 | 알림 타입 | **(서버)** · APP-NOTIFICATION(소비) |

**NTF-02 · 05 · 06은 결번**이다 — 푸시 · 알림 삭제 · 알림 설정이 v1.1 이후 이월이므로 **수신 설정 화면과 삭제 액션을 두지 않는다**. **관리자 웹에는 독립 알림함 화면을 두지 않으며** 헤더 알림 벨 오버레이가 같은 목록을 제공한다(규격 정본 [01_standards.md](./01_standards.md) §4-1).

---

## 11. 구독 (SUB 5)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| SUB-01 | 요금제 정의 | SYS-SUBSCRIPTIONS · PUB-PRICING · PUB-LANDING(진입점) |
| SUB-02 | 구독 등급(계정) | ADM-SUBSCRIPTION · SYS-SUBSCRIPTIONS(관리자 측) |
| SUB-03 | 사업장 등록 게이팅 | ADM-WORKPLACE-CREATE · ADM-SUBSCRIPTION(표시) · (서버) |
| SUB-04 | 이용 한도 | ADM-MEMBERS · ADM-SUBSCRIPTION(표시) · APP-INVITE(연계) · (서버) |
| SUB-05 | 구독 상태 점검 | ADM-SUBSCRIPTION · ADM-HOME(경고) · (배치) |

**SUB-06 · 07은 영구 제외**다 — 업그레이드 요청 워크플로와 결제 연동이 없으므로 **결제 화면을 만들지 않고** 등급 조정은 SYS-SUBSCRIPTIONS의 수동 처리로만 한다.

---

## 12. 시스템 관리 (SYS 7)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| SYS-01 | 플랫폼 RBAC | **(전역)** — 시스템 웹 7화면 전체의 접근 게이트 |
| SYS-03 | 사업장 관리 | SYS-WORKPLACES |
| SYS-04 | 사용자 관리 | SYS-USERS |
| SYS-05 | 구독/요금제 관리 | SYS-SUBSCRIPTIONS |
| SYS-07 | 감사 로그 | SYS-AUDIT |
| SYS-08 | 기준값 관리 | SYS-RATES |
| SYS-11 | 약관/개인정보/위치정보 문서 관리 | SYS-TERMS · PUB-LEGAL(공개 게시) · PUB-CONSENT(연계) · APP-PRIVACY(진입점·연계) · PUB-LANDING(진입점) |

**SYS-02 · 06 · 09는 결번**이고 **SYS-10은 영구 제외**다 — 역할 임명 화면 · 사업자 인증 모니터링 · 공지 관리 · 분석 통계 화면을 만들지 않는다.

---

## 13. 개인정보·위치정보 (PRV 2)

| 기능ID | 기능명 | 화면코드 |
|--------|--------|----------|
| PRV-01 | 위치정보 이용·제공 사실 확인자료 | APP-PRIVACY(본인 조회) · (서버) |
| PRV-02 | 동의 이력 관리 | PUB-CONSENT · APP-PRIVACY · PUB-SIGNUP · PUB-LEGAL(대조) · PUB-LOGIN(연계) · APP-SETTINGS(진입점) · **ADM-ACCOUNT(동의 내역)** |

**PRV-03 · 04 · 05는 결번**이다 — 정보주체 권리행사 · 데이터 반출·파기 · 유출 대응이 v1.1 이월이므로 해당 화면을 만들지 않고 담당자 지정과 수동 처리 절차로 대응한다.

**PRV-01은 자동 기록 자체가 (서버) 전용이고 화면은 정보주체 본인 조회 경로만 담는다** — 위치정보법 §16②이 기록·보존을 의무로 두고, 정보주체가 자기 기록을 확인할 수 있어야 그 의무가 실질적으로 작동한다.

---

## 화면 표면이 없는 기능 3건

| 기능ID | 기능명 | 구분 | 사유 |
|--------|--------|:----:|------|
| **NTF-04** | 알림 타입 | **(서버)** | 서버 고정 카탈로그이며 관리 화면을 v1에 두지 않는다. 미정의·비활성 타입 생성을 서버가 거부하고 클라이언트는 알 수 없는 타입을 안전한 기본 UI로 표시할 뿐이라, 알림함(APP-NOTIFICATION)은 카탈로그를 소비하되 편집 표면을 갖지 않는다 |
| **SYS-01** | 플랫폼 RBAC | **(전역)** | 시스템 웹 7화면 전체의 접근 게이트이며 특정 화면에 귀속되지 않는다. **v1은 역할 임명 화면을 두지 않으므로**(SYS-02 이월) 부여·회수 표면도 없고, 초기 SUPER_ADMIN은 시드가 아니라 서버 기동 시 환경변수 1회성 부트스트랩으로 만든다(정본 ../05_database/10_migrations_seed.md) |
| **DSH-06** | 리포트 내보내기 | **(전역)** | 특정 화면의 기능이 아니라 **관리자 웹 · 시스템 웹의 모든 목록 표에 같은 형태로 붙는 조작**이다. 화면마다 수식어로 붙이면 담은 기능 수가 조작 하나로 일제히 움직여 화면별 집계가 의미를 잃는다. 규격 정본은 [01_standards.md](./01_standards.md) §3(표 상단 줄)이다 |

**세 건 모두 규격 정본이 있으므로 미매핑이 아니다** — DSH-06은 [../02_features/02_workplace.md](../02_features/02_workplace.md)와 [01_standards.md](./01_standards.md) §3, NTF-04는 [../02_features/10_notification.md](../02_features/10_notification.md)와 [../03_requirements/11_notification.md](../03_requirements/11_notification.md), SYS-01은 [01_standards.md](./01_standards.md) §1과 [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)가 계약을 갖는다.

**(배치) 병기 기능은 14건**이다 — AUT-08 · WRK-04 · WRK-05 · ATT-04 · ATT-05 · LEV-01 · PAY-19 · SLP-01 · SLP-05 · TAX-02 · TAX-11 · CMP-01 · NTF-01 · SUB-05. 검산: 1 + 2 + 2 + 1 + 1 + 2 + 2 + 1 + 1 + 1 = **14**(AUT 1 · WRK 2 · ATT 2 · LEV 1 · PAY 1 · SLP 2 · TAX 2 · CMP 1 · NTF 1 · SUB 1). 전부 화면 표면을 함께 갖는 병기이며, 정기작업 실체 8건과는 축이 다르다(한 작업이 여러 기능에 걸친다). 정기작업 정본은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)다.

---

## 화면별 담은 기능 수 (파생 집계)

각 도메인 파일의 담은 기능ID 항목을 화면 기준으로 다시 센 값이다. **(진입점)·(고지)·(안내)·(표시)·(연계)·(수신) 병기분은 포함하고, (서버)·(전역)·(배치)·(소비) 표기는 세지 않는다.**

| 화면코드 | 수 | 화면코드 | 수 | 화면코드 | 수 |
|----------|:--:|----------|:--:|----------|:--:|
| PUB-LANDING | 4 | ADM-WORKPLACE-SETTINGS | 3 | ADM-PAYROLL-TERMS | 2 |
| PUB-PRICING | 3 | ADM-MEMBERS | 5 | ADM-PAYROLL-PREVIEW | 7 |
| PUB-LEGAL | 2 | ADM-IMPORT | 1 | ADM-PAYROLL-RUN | 7 |
| PUB-SIGNUP | 4 | ADM-EMPLOYEE-LIST | 2 | ADM-PAYROLL-LEDGER | 2 |
| PUB-LOGIN | 5 | ADM-EMPLOYEE-DETAIL | 5 | ADM-PAYSLIP | 6 |
| PUB-PASSWORD-RESET | 1 | ADM-EMPLOYEE-RESIGN | 1 | ADM-SEVERANCE | 2 |
| PUB-CONSENT | 3 | ADM-CONTRACTS | 2 | ADM-TAX-FILING | 1 |
| APP-INVITE | 2 | ADM-DOCUMENTS | 1 | ADM-TAX-SEPARATION | 1 |
| APP-CHECKIN | 6 | ADM-SUBSCRIPTION | 5 | ADM-DEADLINE-CALENDAR | 2 |
| APP-ATTENDANCE | 7 | ADM-SCHEDULE | 3 | ADM-EMPLOYEE-COUNT | 1 |
| APP-LEAVE | 5 | ADM-ATTENDANCE | 8 | ADM-BUSINESS-UNIT | 1 |
| APP-PAYROLL-HISTORY | 3 | ADM-ATTENDANCE-APPROVAL | 2 | ADM-RETENTION | 1 |
| APP-PAYSLIP | 5 | ADM-ATTENDANCE-CLOSING | 2 | SYS-WORKPLACES | 1 |
| APP-CONTRACT | 4 | ADM-LEAVE-APPROVAL | 2 | SYS-USERS | 2 |
| APP-NOTIFICATION | 3 | ADM-LEAVE-BALANCE | 3 | SYS-SUBSCRIPTIONS | 3 |
| APP-SETTINGS | 7 | ADM-WORKPLACE-SELECT | **7** | SYS-RATES | 1 |
| APP-PRIVACY | 3 | ADM-WORKPLACE-CREATE | 6 | SYS-POLICY | 1 |
| — | — | ADM-ACCOUNT | 6 | SYS-AUDIT | 1 |
| — | — | **ADM-HOME** | **11** | SYS-TERMS | 1 |

**파일별 소계와 검산**

| 파일 | 화면 수 | 담은 기능 수 소계 |
|------|:------:|:----------------:|
| [03_public.md](./03_public.md) | 3 | 4 + 3 + 2 = **9** |
| [04_auth_onboarding.md](./04_auth_onboarding.md) | 8 | 4 + 5 + 1 + 3 + 2 + **7** + 6 + 6 = **34** |
| [05_app_employee.md](./05_app_employee.md) | 9 | 6 + **7** + **5** + 3 + 5 + 4 + 3 + 7 + 3 = **43** |
| [06_admin_workplace_hr.md](./06_admin_workplace_hr.md) | **10** | **11** + 3 + 5 + 1 + 2 + 5 + 1 + 2 + 1 + 5 = **36** |
| [07_admin_attendance_leave.md](./07_admin_attendance_leave.md) | 6 | 3 + 8 + 2 + 2 + 2 + 3 = **20** |
| [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md) | 6 | 2 + 7 + 7 + 2 + 6 + 2 = **26** |
| [09_admin_tax_compliance.md](./09_admin_tax_compliance.md) | 6 | 1 + 1 + 2 + 1 + 1 + 1 = **7** |
| [10_system_console.md](./10_system_console.md) | 7 | 1 + 2 + 3 + 1 + 1 + 1 + 1 = **10** |

화면 수 검산: 3 + 8 + 9 + **10** + 6 + 6 + 6 + 7 = **55**.
담은 기능 수 검산: 9 + 34 + 43 + 36 + 20 + 26 + 7 + 10 = **185**.

> **이중 계수 주의**: 위 **185**는 **화면 기준 중복 집계**이며 기능 기준 유일 집계(98)와 다르다. 한 기능이 여러 화면에 표면을 가지면 각 화면에서 함께 세기 때문에 화면 기준 집계가 기능 수를 넘는다. **두 수치를 섞어 쓰지 않는다.**

- **ADM-HOME 11이 가장 크고 ADM-ATTENDANCE 8 · APP-ATTENDANCE 7 · APP-SETTINGS 7 · ADM-PAYROLL-PREVIEW 7 · ADM-PAYROLL-RUN 7이 뒤를 잇는다.** **ADM-HOME의 11은 다른 큰 화면들과 성질이 다르다** — 아홉은 표시 수식어라 실행을 각 기능의 주 표면에 넘기고, 주 표면으로 담는 것은 **조회 전용 2기능(ATT-10 오늘 출근 · DSH-03 인건비 추이)** 뿐이다. 담은 기능 수가 큰 것이 그 화면의 무게를 뜻하지 않는 자리다. ADM-ATTENDANCE는 근태 도메인의 관측 축(ATT-02~05 · 12 · 13)에 대리 보정 2기능(ATT-06 · ATT-07)이 얹히고, APP-SETTINGS는 여러 도메인의 본인 축이 한 화면에 모이며, 뒤의 둘은 급여 계산 6기능(PAY-02~06 · LEV-06)이 미리보기와 확정 양쪽에 같은 형태로 나타난다.
- **ADM-PAYROLL-PREVIEW와 ADM-PAYROLL-RUN이 같은 6기능을 공유하는 것은 중복이 아니라 대칭**이다 — 두 화면의 차이는 담는 기능이 아니라 차단 정책이며, 미리보기는 차단 조건을 경고로 강등하고 확정은 같은 조건을 차단으로 막는다(정본 [08_admin_payroll_payslip.md](./08_admin_payroll_payslip.md)).
- **ADM-IMPORT 1 · ADM-EMPLOYEE-RESIGN 1 · ADM-DOCUMENTS 1 · ADM-TAX-FILING 1 · ADM-TAX-SEPARATION 1 · ADM-EMPLOYEE-COUNT 1 · ADM-BUSINESS-UNIT 1 · ADM-RETENTION 1 · SYS-WORKPLACES 1 · SYS-RATES 1 · SYS-POLICY 1 · SYS-AUDIT 1 · SYS-TERMS 1 · PUB-PASSWORD-RESET 1이 가장 작다** — 14본이 단일 기능 전용 화면이다. 기능 하나가 그 자체로 완결된 작업 단위라 다른 기능과 묶을 축이 없다.
- **PUB-LANDING 4는 전부 (진입점)** 이며 자체 소유 기능이 없다. 화면 기준 집계에는 들어가지만 기능 기준 유일 집계에서는 각 기능의 소유 화면이 정본이다.

---

## 관련 문서

- 화면 인벤토리 55본 → [README.md](./README.md)
- 화면 공통 표준·템플릿 → [01_standards.md](./01_standards.md)
- 기능 채번 정본 → [../02_features/README.md](../02_features/README.md)
- 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 기능 ↔ REQ ↔ 화면 ↔ API ↔ 테이블 전수 추적성 → [../03_requirements/17_traceability.md](../03_requirements/17_traceability.md)
- 범위(In/Out) 정본 → [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md)
