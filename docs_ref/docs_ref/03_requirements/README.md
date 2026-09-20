# 03_requirements — 요구사항 정본

> **대상**: insadesk v1(P0 94기능)의 동작 계약 — 전역 규칙 · 도메인별 요구사항(REQ) · 비기능 · 인수 기준 · 추적성 · 공식 참고
> **작성일**: 2026-08-03
> **개정일**: 2026-09-10 — 인용 갱신 — 에러 코드 119 → **120종**(workplace.mgmt_no_required/422 신설 — 신고자료의 빈 관리번호 계열. 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)). **16네임스페이스는 불변**이다 — 발생 표면은 TAX 이지만 부재한 값이 사업장의 것이라 workplace 가 갖는다 · 파생 고지의 workplace 21 → **22**
> **개정일**: 2026-09-07 — 인용 갱신 — **V0711**(idempotency_records 신설)로 테이블 60 → **61종** · RLS 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46** · **DELETE 4는 불변**) · 유일성 강제 59 → **60** · PK 60 → **61**. 정본 [../05_database/README.md](../05_database/README.md). 나머지 수치는 전건 불변
> **개정일**: 2026-09-16 — **D-23 채택 4기능과 일괄 처리 요구사항 7건 신설**(REQ 274 → **281**) — REQ-AUT-26(프로필 관리) · REQ-WRK-37(목록 내보내기) · REQ-ATT-21(수정 요청 일괄 승인·반려) · REQ-ATT-22(실시간 근태 현황) · REQ-LEV-14(휴가 일괄 승인·반려) · REQ-PAY-36(인건비 추이) · REQ-SYS-17(시스템 목록 내보내기). **DSH 기능의 REQ는 그 행을 담은 파일의 접두사로 채번한다**(정본 [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)) — 기능을 데이터 소유 도메인 파일에 행으로 둔 것과 같은 축이다
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21) 반영 — 저장소 경로 표기 back/ → **backend/** 및 루트 db_migration/ 등재. **REQ 총수·구성은 불변**
> **개정일**: 2026-08-21 — 에러 코드 118 → **119종** 인용 갱신(workplace.business_unit_overlap/409 신설 — 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) · 파생 고지의 workplace 20 → **21**)
> **개정일**: 2026-08-09 — 전역 수치 정합 — 테이블 58 → **60종** 인용 갱신(3단계 누락분)
> **원천**: docs_ref2/requirements_p0.md(REQ 244 · 에러 코드 카탈로그 · 상태 머신 · 골든 케이스) · docs_ref2/features_p0.md(기능ID·우선순위) · docs_ref2/features.md(우선순위·법령 출처 부록) · docs_ref2/schema_p0.md(테이블) · [../README.md](../README.md) 고정 기준

[../02_features](../02_features/README.md)가 **무엇을 만드는가**의 목록이라면 본 폴더는 **그 기능이 성립하려면 시스템이 무엇을 검증·저장·차단·자동 처리하는가**의 계약이다. 각 요구사항은 구현 후 **실제 API 호출·실브라우저 조작과 DB 행 대조로 참·거짓을 가릴 수 있는 단위**로 쓴다.

**전역 규칙([01_global_rules.md](./01_global_rules.md))을 개별 도메인보다 먼저 읽는다.** 단수 처리·나눗셈 규칙·기준값 조회 단위·결과 동결은 전 도메인 계산의 전제이며, 이를 모르고 개별 도메인만 구현하면 금액이 틀린다. 그다음은 마감 경로 순서다 — 사업장·멤버(WRK) → 인사(HRM) → 근태(ATT) → 급여(PAY) → 명세서(SLP) → 신고(TAX).

본 문서군은 **to-be 설계 정본**이다. 근거는 실측이 아니라 원천 문서(docs_ref2/)와 확정 결정(D-NN)이며, 확인되지 않은 기준값은 확정 값처럼 쓰지 않고 미확인 상태로 등재한다.

## 파일 목차

| 파일 | 내용 | REQ 영역 |
|------|------|----------|
| [01_global_rules.md](./01_global_rules.md) | 전역 규칙 — 계산 결정론·부동소수점 금지·단수 처리 정본·나눗셈 전수·기준값 카탈로그 조회 계약·결과 동결·시간 경계·멱등성·동시성·보존·에러 규약 | REQ-GLB |
| [02_auth.md](./02_auth.md) | 회원가입·로그인·세션·비밀번호·계정 상태·탈퇴·진입 컨텍스트·재인증 | REQ-AUT |
| [03_workplace.md](./03_workplace.md) | 사업장 등록·진위확인·검증 상태·정보 관리·초대·수락·역할·멤버·제외·등록 한도·데이터 임포트·폐쇄 | REQ-WRK |
| [04_hr.md](./04_hr.md) | 인적사항·민감정보 암호화·근로조건·입퇴사·4대보험 정보·근로계약·전자서명·문서함·근로자명부·연소자·근로자 아닌 자 | REQ-HRM |
| [05_attendance.md](./05_attendance.md) | 체크인·지오펜스·휴게·휴게 준수·스케줄·지각/결근 판정·8버킷 분해·연장/야간/휴일·한도 경고·수정 요청·승인·마감 | REQ-ATT |
| [06_leave.md](./06_leave.md) | 연차 발생 산식·출근율·비례 산정·원장 3단·휴가 신청·예약 차감·승인·급여 연동·연차미사용수당 | REQ-LEV |
| [07_payroll.md](./07_payroll.md) | 급여 항목·비과세·보험별 base·급여 기준·계산 입력·통상임금·기본급·법정수당·5인 분기·4대보험·소득세·최저임금·확정·정정·대장·퇴직금·금품청산 | REQ-PAY |
| [08_payslip.md](./08_payslip.md) | 생성 트리거·PDF 스냅샷·법정 기재사항·계산방법 표기·전자교부·열람 통제·본인 소유권 인가·보존·일괄 발행·알림·재발급·정정본 | REQ-SLP |
| [09_tax.md](./09_tax.md) | 4대보험 취득·상실 신고자료 · 이직확인서 · 신고 기한 캘린더 · 기한 감지 배치 · v1 미지원 범위 고지 | REQ-TAX |
| [10_compliance.md](./10_compliance.md) | 상시근로자 산정 제1항·제2항 보정·시계열·스냅샷·차단·사업 단위 판정·규모 정책 버전·법정 보존 | REQ-CMP |
| [11_notification.md](./11_notification.md) | 알림 스키마·격리·실시간 배달·목록·읽음·타입 카탈로그·필수 알림 | REQ-NTF |
| [12_subscription.md](./12_subscription.md) | 요금제 스키마·시드·계정 구독·사용량·사업장 한도·직원 한도·초과 상태·만료 점검 | REQ-SUB |
| [13_system.md](./13_system.md) | 플랫폼 RBAC·권한 화이트리스트·사업장/사용자 운영·요금제 조정·감사 로그·기준값 관리·약관 문서 | REQ-SYS |
| [14_privacy.md](./14_privacy.md) | 위치정보 별도 동의·동의 이력·철회·이용 제공 사실 확인자료 자동 기록·조회·파기 | REQ-PRV |
| [15_nonfunctional.md](./15_nonfunctional.md) | 성능·접근성·렌더링/SEO·안정성 / 배포·환경·정기작업·시크릿·마이그레이션 운영 | REQ-NFR · REQ-TEC |
| [16_acceptance_criteria.md](./16_acceptance_criteria.md) | 인수 기준 — Given/When/Then + 부정 확인 · 검증 방법 · 대응 REQ · 검증 순서 | AC-01~15 |
| [17_traceability.md](./17_traceability.md) | 기능ID ↔ REQ ↔ 화면 ↔ API ↔ 테이블 전수 매핑(미매핑 0 보장) | 전 도메인 |
| [18_official_references.md](./18_official_references.md) | 법령·행정해석·공공 API·판례 공식 출처(**외부 URL이 허용되는 유일한 문서**) | 공식 참고 |

파일 번호 15~18은 횡단 문서다 — 도메인 파일은 02~14로 끝나고 그 뒤 번호를 도메인에 다시 쓰지 않는다. **파일 번호 19 이상은 쓰지 않는다.**

## 고정 기준

수치의 정본은 [../README.md](../README.md) 고정 기준 표다. 본 폴더는 그 값을 동일하게 인용하며, **REQ 총수만 본 README가 정본**이다. 어긋나면 각 요구사항 파일의 ID 열을 다시 세어 본 README를 고치고 [../README.md](../README.md)를 뒤따라 갱신한다.

| 항목 | 기준 | 정본 |
|------|------|------|
| v1 기능 | **94개**(AUT 9 · WRK 13 · HRM 11 · ATT 11 · LEV 5 · PAY 13 · SLP 7 · TAX 3 · CMP 5 · NTF 3 · SUB 5 · SYS 7 · PRV 2) | [../02_features/README.md](../02_features/README.md) |
| REQ 총수 | **281개** — 원천 이식분 **244** + 신설 횡단분 **30**([15_nonfunctional.md](./15_nonfunctional.md)의 REQ-NFR 16 · REQ-TEC 14) + **D-23 신설분 7**(아래 접두사별 표의 증분). 검산: 244 + 30 + 7 = **281** | 본 README |
| 인수 기준 | **AC-01~15**(골든 케이스 15건 승계) | [16_acceptance_criteria.md](./16_acceptance_criteria.md) |
| 에러 코드 | **120종 · 16네임스페이스** — 채번·전수 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)다. 도메인 파일의 에러 코드 절은 **해당 도메인 분만** 등재하는 인용이며 신설·개명·폐기를 하지 않는다 | 09_glossary |
| enum · 상태 머신 | 계정·멤버십·초대·사업장·근로계약·명세서·구독·임포트·직원 재직 **9종**. 본 폴더는 전이 조건·차단 조건만 REQ 설명에 담고 전이표를 재정의하지 않는다 | [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) |
| 테이블 | **61종** | [../05_database/README.md](../05_database/README.md) |
| 우선순위 | P0 · P1 · P2 — REQ는 소속 기능의 우선순위를 승계한다 | [../02_features](../02_features/README.md) |

## 접두사별 REQ 수

| 접두사 | 수 | 파일 | 접두사 | 수 | 파일 |
|--------|:--:|------|--------|:--:|------|
| GLB | 20 | 01_global_rules.md | SLP | 16 | 08_payslip.md |
| AUT | 26 | 02_auth.md | TAX | 5 | 09_tax.md |
| WRK | 37 | 03_workplace.md | CMP | 10 | 10_compliance.md |
| HRM | 28 | 04_hr.md | NTF | 6 | 11_notification.md |
| ATT | 22 | 05_attendance.md | SUB | 9 | 12_subscription.md |
| LEV | 14 | 06_leave.md | SYS | 17 | 13_system.md |
| PAY | 36 | 07_payroll.md | PRV | 5 | 14_privacy.md |
| NFR | 16 | 15_nonfunctional.md | TEC | 14 | 15_nonfunctional.md |

도메인 파일 검산: 20 + 26 + 37 + 28 + 22 + 14 + 36 + 16 + 5 + 10 + 6 + 9 + 17 + 5 = **251** — 원천 이식분 244에 D-23 신설분 7(AUT 1 · WRK 1 · ATT 2 · LEV 1 · PAY 1 · SYS 1)이 더해진 값이다.
신설 횡단분 검산: 16 + 14 = **30**. 총계 검산: 251 + 30 = **281**.

도메인 REQ 소계 **224**(AUT 25 · WRK 36 · HRM 28 · ATT 20 · LEV 13 · PAY 35 · SLP 16 · TAX 5 · CMP 10 · NTF 6 · SUB 9 · SYS 16 · PRV 5) + 횡단 **20**(GLB) = 244. 원천 docs_ref2/requirements_p0.md의 구성 표(GLB 20 · AUT+WRK+HRM 89 · ATT+LEV+PAY 68 · SLP+TAX+CMP 31 · NTF+SUB+SYS+PRV 36 = 244)와 **일치한다** — 도메인 파일로 재배치하며 유실·중복이 없다. **REQ-NFR·REQ-TEC 30건은 원천에 없던 신설분**이며 근거는 확정 결정 D-NN과 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)의 ADR이다.

접두사별로 01부터 연속 채번하며 **결번이 없다**. 기능ID의 결번(v1 범위 제외)과 달리 REQ는 원천의 연번을 그대로 승계한다.

> **파생 고지 — 에러 코드 종수의 산정 기준.** 본 폴더 도메인 파일의 에러 코드 절을 합치면 고유 코드가 **120종**이다(common 7 · auth 15 · workplace **22** · invitation 3 · import 3 · hr 13 · attendance 8 · leave 6 · payroll 10 · payslip 10 · notification 4 · device_token 1 · subscription 5 · system 7 · export 4 · privacy 2). 원천 카탈로그 절의 표 행 수 105(자체 담당 94 + 교차 참조 9 + 폐기 2)와 다른 이유는, 원천이 교차 참조로만 9건을 실었던 attendance·leave·payroll 코드가 REQ 본문 기준으로 23건이기 때문이다. 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)가 **유효 코드 전수 120종**을 확정했고, [../README.md](../README.md) 고정 기준과 본 표도 120으로 정렬돼 있다(2026-08-21 — workplace.business_unit_overlap 신설 반영).

## 형식 규약

| 항목 | 규약 |
|------|------|
| 요구사항 ID | REQ-{접두사}-NN. 전역은 REQ-GLB · 비기능은 REQ-NFR · 기술운영은 REQ-TEC. 새 ID는 소유 파일에서만 채번한다 |
| 기능 추적 | 도메인 파일의 H2 제목이 곧 기능 하나다 — **H2 = {기능ID} {기능명}  {우선순위}** 형식이며 기능명·우선순위를 [../02_features](../02_features/README.md)와 문자 그대로 일치시킨다 |
| 표 컬럼 | 요구사항ID · 요구사항명 · 설명 · 접근 권한 · 우선순위 (5열 고정) |
| 접근 권한 | 미인증 / 본인 / STAFF / MANAGER / OWNER / 플랫폼({역할}) / 서버 / 시스템 중에서 고르고, 여럿이면 가운뎃점으로 잇는다. 값 정의는 아래 접근 권한 표기 절이 정본이다 |
| 설명 밀도 | 입력 필드·검증 규칙, 산식, 저장 테이블·컬럼, 에러 코드와 HTTP 상태, 상태 전이·차단 조건, 동시성·멱등 처리, 엣지 케이스를 한 셀에 압축 서술한다. **참·거짓을 가릴 수 있는 단위**로 쓰고 "잘 동작한다" 같은 서술을 쓰지 않는다 |
| 중복 등재 금지 | 한 REQ가 여러 기능에 걸치면 **주 기능 아래 한 번만** 등재하고 다른 기능 절에서는 참조 문구로만 가리킨다 |
| 파일 말미 3절 | 도메인 파일은 관련 테이블 · 관련 화면 · 에러 코드 세 절로 끝내고 그 뒤에 관련 문서 절을 둔다 |
| 에러 규약 | {domain}.{snake_case} + HTTP 상태. 403(적용 대상 아님 — 정상 상태)과 422(전제 미충족 — 조치 가능)를 구분한다(REQ-GLB-19) |
| 상태 머신 | 전이표·다이어그램을 본 폴더에서 재정의하지 않고 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)를 참조한다. 전이 조건·차단 조건 같은 **행위 계약은 REQ 설명 셀에 유지**한다 |
| 링크 | 상대경로·인벤토리 확정 파일명만 쓴다. 저장소 경로(backend/ · web_front/ · app_front/ · db_migration/)는 평문 표기다. **외부 URL은 [18_official_references.md](./18_official_references.md)에만** 두고 라벨 붙인 링크로 적는다(맨 URL 금지) |
| 식별자 표기 | **인라인 백틱을 쓰지 않는다** — 평문 또는 굵게. 여러 줄 펜스 블록만 허용한다 |
| 시제 | "~한다" 평서체 현재형. 설계 계약이므로 구현 완료를 전제한 서술을 쓰지 않고, v1 제외 기능은 부정형으로만 언급한다 |

## 접근 권한 표기

도메인 요구사항 표(02~14)의 접근 권한 열은 아래 값만 쓴다. 사업장 RBAC는 OWNER ⊃ MANAGER ⊃ STAFF 누적이고 플랫폼 RBAC는 이와 완전 별개다. **예외는 [01_global_rules.md](./01_global_rules.md) 하나**다 — 전역 규칙은 특정 역할이 아니라 적용 범위를 갖는 규칙이므로 그 열에 원천의 적용 값(서버 · 전 도메인)을 그대로 싣는다.

| 표기 | 의미 |
|------|------|
| 미인증 | 세션·토큰 없이 접근하는 공개 경로 — **경로 축 6종**(회원가입 · 로그인 · **가입 동의**(재동의 게이트 — 컨텍스트 발급 전 미인증 진입) · 아이디 중복 확인 · 비밀번호 재설정 · 약관/개인정보/위치정보 문서 조회), 정본은 [02_auth.md](./02_auth.md) REQ-AUT-12다 |
| 본인 | 요청자 본인 소유 자원. **명세서·근로계약·급여이력은 멤버십이 아니라 본인 소유권(employees.user_id = 요청자)으로 판정**하므로 퇴사·폐쇄 후에도 유지된다 |
| STAFF | 사업장 멤버 전원(STAFF 이상 — MANAGER·OWNER 포함). 조회 범위는 본인 데이터와 공개 최소 정보로 제한된다 |
| MANAGER | 사업장 운영 권한(MANAGER 이상 — OWNER 포함). 근태·급여·인사·명세서·신고 운영 |
| OWNER | 사업장 소유자 전용. 역할 변경 · 임포트 확정 · 급여 VOID/정정 · 명세서 정정본 · 사업장 폐쇄 · 구독/한도 |
| 플랫폼({역할}) | 플랫폼 RBAC — 플랫폼(VIEWER) · 플랫폼(SUPPORT) · 플랫폼(ADMIN) · 플랫폼(SUPER_ADMIN). **사업장 OWNER라도 플랫폼 권한은 별개**다 |
| 서버 | 요청 처리 중 서버가 강제·검증·산출하는 계약. 클라이언트 판정은 UX 보조이며 서버 판정이 최종이다 |
| 시스템 | 사용자 요청 없이 실행되는 처리 — 정기작업 8건 · DB 제약·트리거 · 자동 상태 전이 · 자동 기록 |

## 우선순위 정의

| 코드 | 의미 | 대표 범위 |
|------|------|----------|
| P0 | 기반 — 없으면 뒤 단계가 전부 허공이 된다 | 기준값·규모 정책·상시근로자 산정 · 인증·가입·세션 · 사업장 등록·초대·전환 · 구독 한도 · 동의 이력 · 위치정보 확인자료 · 알림 배달 |
| P1 | 마감 경로 — 근태에서 명세서까지의 본 흐름과 퇴사 경로 | 인사·근로조건·입퇴사·4대보험 정보 · 근태 전 과정 · 급여 전 과정 · 명세서 발행·교부 · 신고자료·기한 캘린더 · 감사·기준값 운영 |
| P2 | 보완 — 없어도 첫 마감 주기는 돌지만 실사용에서 곧 필요해진다 | 근무 스케줄 · 근로계약 작성·전자서명 · 문서함 · 연차 전 과정 · 명세서 재발급/정정 · 사업장 폐쇄 |

REQ의 우선순위는 그 REQ가 속한 기능의 우선순위를 승계한다. 기능 우선순위와 REQ 우선순위가 어긋나면 [../02_features](../02_features/README.md)가 정본이다. 우선순위 정의의 정본은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)다.

## 추적성 동시 갱신

요구사항을 추가·변경·삭제하면 같은 변경 단위에서 아래를 갱신하고, **개수를 쓰는 자리는 그 자리에서 다시 센다**.

- [17_traceability.md](./17_traceability.md) — 기능ID ↔ REQ ↔ 화면 ↔ API ↔ 테이블 전수 매핑(미매핑 0 보장)
- [../07_screen/02_traceability.md](../07_screen/02_traceability.md) — 기능ID → 화면 코드. 도메인 파일의 관련 화면 절이 참조하는 정본이다
- [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) — 에러 코드 정본. 신설·개명·폐기는 여기서만 하고 [../06_api/02_errors.md](../06_api/02_errors.md) 미러를 뒤따라 갱신한다
- 본 README의 접두사별 REQ 수·검산식과 [../README.md](../README.md) 고정 기준

## 관련 문서

- [../02_features/README.md](../02_features/README.md) — 기능 94 채번 정본
- [../05_database/README.md](../05_database/README.md) — 테이블 61종·제약·RLS 정본
- [../06_api/README.md](../06_api/README.md) — REST 표면·에러 응답 규격
- [../07_screen/README.md](../07_screen/README.md) — 화면 코드 채번 정본
- [../09_glossary/README.md](../09_glossary/README.md) — 용어·에러 코드·enum/상태 머신·ID 규약·단위/시간
- [../10_security/README.md](../10_security/README.md) — 인증/인가·RLS 격리·PII·위치정보·위협모델
- [../CLAUDE.md](../CLAUDE.md) — 작성·검수 지침
