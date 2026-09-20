# REQ-WRK — 사업장·멤버·온보딩 요구사항

> **대상**: 사업장 등록 · 사업자 진위/상태 검증 · 검증 상태 머신 · 정보 관리 · 초대와 수락 · 컨텍스트 전환 · 역할 관리 · 멤버 목록/제외 · 등록 한도 · 데이터 임포트 · 사업장 폐쇄
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **REQ-WRK-25의 "길이 제한·이스케이프"를 수치로 일반화**한다 — 이 요구가 목록 검색의 유일한 정본이었는데 값이 없어 표면마다 각자 정했고(초대·멤버 40자, 나머지는 무제한·무이스케이프), 실제로 검색어의 `%`·`_`가 임의 문자로 해석되는 결함이 7곳에서 났다. **길이 상한 50 · 메타문자(`\`·`%`·`_`) 이스케이프**를 이 요구의 본문으로 확정하고 [../06_api/01_conventions.md](../06_api/01_conventions.md)가 전 도메인에 인용하는 정본으로 삼는다. **REQ 채번·건수·역할·대상 필드는 전건 불변**
> **개정일**: 2026-09-10 — 에러 절에 **workplace.mgmt_no_required/422**를 등재한다(채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) 119 → **120종** · workplace 21 → **22**). 신고자료 표면에서 나되 **부재한 값이 사업장의 것이라 workplace 네임스페이스**다. 함께 **검산식이 26에서 멈춰 있던 것을 바로잡는다** — 2026-08-21 의 business_unit_overlap 등재가 표에는 닿고 **검산식에는 닿지 않아** workplace 20 으로 남아 있었다(실측 21). 검산 workplace **22** + invitation 3 + import 3 = **28종**
> **개정일**: 2026-09-10 — **REQ-WRK-09의 수정 대상에 보험 계열별 사업장관리번호 3을 등재**한다(insurance_mgmt_no 고용·산재 · pension_mgmt_no 국민연금 · health_mgmt_no 건강보험). **세 열은 REQ-HRM-17 · REQ-TAX-01이 참조하고 [../05_database/02_workplace.md](../05_database/02_workplace.md)가 정의하는데 어느 표면이 받는지가 어디에도 없었다** — 컬럼과 읽기만 있고 쓰기 경로가 없어 신고자료가 채울 수 없는 값을 요구하고 있었다. 표면은 **기존 #4 정보 수정**이고 권한은 **MANAGER**이며, 함께 **REQ-WRK-11의 기록 대상에 이 셋을 잇는다.** **REQ 채번·건수 · 불변 3필드 · 에러 코드 27종은 전건 불변**이다 — 새 REQ 를 만들지 않고 기존 행의 대상이 늘어난다
> **개정일**: 2026-08-21 — 에러 코드 절에 workplace.business_unit_overlap/409 등재(채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) 2026-08-21 신설의 도메인 반영 — workplace 20 → **21종**)
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 대표 연락처 저장 축(workplaces.contact_phone) 명시 · 불변 3필드의 재검증 정정 경로 확정 · 대표 사업장 유일성 강제 축 등재 · invitation_type 저장 요구 철회(v1 단일 유형) · MANAGER 초대 제한과 SUSPENDED 수락 차단의 DB 강제 축 등재 · 임포트 한도 판정 축 정정(활성 멤버 → **활성 직원**)
> **개정일**: 2026-08-08 — 폐쇄 트랜잭션에 OWNER 멤버십 종료 전이 등재(탈퇴 교착 해소) · 초대 수락 생성분의 입사 미확정 계약(hire_date NULL) 참조 추가
> **개정일**: 2026-08-03 — PENDING_VERIFICATION 자동 정지 기한 **14일** 확정(사용자 확정 2026-08-03)
> **원천**: docs_ref2/requirements_p0.md WRK 절(REQ-WRK-01~36) · docs_ref2/features_p0.md(WRK 13기능) · docs_ref2/schema_p0.md workplace·infra 테이블 · docs_ref2/features.md WRK-01 국세청 게이트 판정

사업장(workplaces)은 **테넌트 경계**다. 모든 업무 테이블이 workplace_id 스코프이며 서비스 레이어 1차 검증 + PostgreSQL RLS 2차 심층방어로 행 단위 격리를 강제한다([../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)).

**국세청 진위확인 게이트는 법이 요구한 것이 아니라 제품이 선택한 신뢰 장치**다. 그래서 게이트를 유지하되 세 구멍을 막는다 — 개업 준비 중(사업자등록 신청 전) · 국세청 API 장애 · 휴업 사업장이다. 앞의 둘은 PENDING_VERIFICATION 상태로 받아 근태·인사 입력을 허용하고 급여 확정·명세서 발행만 차단하며, 휴업은 경고 후 등록을 허용한다(휴업 중에도 근로관계·휴업수당·퇴직금 의무가 존속한다). **폐업만 신규 등록을 차단**한다.

**사업장당 ACTIVE OWNER는 항상 정확히 1명**이고, 한도는 OWNER 측 두 축(소유 사업장 수 · 사업장당 활성 멤버 수)에만 적용된다. 상태 전이 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)이며 본 문서는 전이의 조건·차단·부수효과를 계약한다. 전역 계약은 [01_global_rules.md](./01_global_rules.md)를 전제한다.

## WRK-01 사업장 등록  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-01 | 등록 입력·검증 | 필드는 **business_no**(10자리 · 형식과 체크섬) · **company_name**(1~100자) · **owner_name** · **open_date** · **address** · **industry** · **biz_type** · **site_label**(사업장 식별명·지점명) · 근무지 좌표(lat · lng) · **geofence_radius_m**(50~500 · 기본 100) · **location_accuracy_limit_m**이다. 서버 검증이 최종 판정이다 | 본인 | P0 |
| REQ-WRK-02 | 등록 전 한도·상태 선검사 | 등록 트랜잭션 진입 전 ① 등록자 계정이 ACTIVE인지 ② 소유 사업장 수 < max_owned_workplaces(REQ-SUB-05)인지 검사한다. 한도 초과는 **subscription.workplace_limit_exceeded/402**와 함께 현재 사용량·필요 등급·업그레이드 경로를 반환한다. **권한 부족(auth.workplace_forbidden/403)과 한도 초과(402)를 분리**한다 | 서버 | P0 |
| REQ-WRK-03 | 생성 트랜잭션·시드 | 진위확인 통과 후 단일 트랜잭션에서 workplaces를 생성하고 등록자를 workplace_members(role = OWNER · status = ACTIVE)로 저장한다. 함께 시드하는 것은 기본 근무정책 · 알림 설정 · 휴가 유형 · 급여 기준 초안이다. **진위 미통과 입력으로는 사업장이 생성되지 않는다** | 서버 | P0 |
| REQ-WRK-06 | 복수 사업장 등록 허용·중복 판정 | **동일 business_no로 복수 사업장 등록을 허용한다**(부가가치세법 §8 사업자단위과세·종사업장 제도). 차단은 **(business_no, site_label) 완전 중복**뿐이며 **workplace.duplicate_site/409**를 반환한다. 동일 business_no 사업장은 그룹으로 연결하고 1개를 site_role = PRIMARY로 지정한다 — **그룹당 PRIMARY 2개 이상은 부분 UNIQUE (business_no) WHERE site_role = 'PRIMARY'가 막고, 0개는 등록 트랜잭션이 그룹 최초 사업장을 PRIMARY로 세팅해 막는다**. v1 기본은 tax_unit_type = GENERAL(개별과세)이며 사업자단위과세는 v1에 두지 않는다. 복수 등록 시 **상시근로자 합산 판정(REQ-CMP-08)을 요구한다는 안내**를 노출한다 | 서버 | P0 |

## WRK-02 사업자 진위/상태 검증  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-04 | 사업자 진위확인 | 서버가 국세청 진위확인 API에 사업자번호 · 대표자명 · 개업일(· 상호)을 전송해 일치 여부를 판정한다. **API 키는 서버 비밀로만 보관**하고 클라이언트에 노출하지 않는다. 불일치는 **workplace.business_invalid/422** | 서버 | P0 |
| REQ-WRK-05 | 상태조회·휴업/폐업 분리 | 상태조회 API로 계속사업자·휴업·폐업 여부와 과세유형·폐업일자를 조회해 business_verification_logs(요청 요약 · 응답 요약 · 검증 시각 · result ∈ MATCH·MISMATCH·SUSPENDED·CLOSED·ERROR · latency)에 기록한다. **폐업만 신규 등록을 차단**(workplace.business_invalid/422)하고 **휴업은 경고 후 등록을 허용**한다 — 휴업 중에도 근로관계·휴업수당·퇴직금 의무가 존속하기 때문이다. 원문 민감 데이터는 최소 보관한다 | 서버 | P0 |
| REQ-WRK-07 | API 장애·캐싱 | 동일 입력의 성공 결과는 정책 기간 동안 캐시할 수 있다. API 장애·timeout·호출량 초과는 **workplace.business_api_unavailable/503**을 반환하되, **외부 API 가용성에 법정 의무 이행이 종속되지 않도록** 사용자에게 PENDING_VERIFICATION 생성 경로(REQ-WRK-08)를 제시한다 | 서버 | P0 |

## WRK-03 사업장 정보 관리  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-09 | 기본 정보 수정·불변 필드 | 상호·주소·업종·**대표 연락처(workplaces.contact_phone)**·기본 근무시간(attendance_policy)·**보험 계열별 사업장관리번호 3**(insurance_mgmt_no 고용·산재 · pension_mgmt_no 국민연금 · health_mgmt_no 건강보험)을 수정한다. **관리번호 3은 신고자료의 사업장 축 입력**(REQ-HRM-17 · REQ-TAX-01)이며 **직원 행에 복제하지 않는다.** **세 계열을 한 필드로 합치지 않는다** — 합치면 신고서 4종 중 일부가 틀린 번호로 나간다. **서버가 자릿수·체크 규칙을 판정하지 않는다** — 계열별 번호 형식의 확인된 근거가 없고 **틀린 규칙은 정당한 번호를 거부해 신고를 막는다.** 검증은 일반 형식까지이고 **부재는 이 표면이 막지 않는다** — 차단은 값을 쓰는 신고자료 표면이 한다(REQ-TAX-01). **business_no · owner_name · open_date는 재검증(REQ-WRK-04) 없이 변경할 수 없다** — 변경 시도는 **workplace.immutable_field/422**. 이 세 필드가 사업장 아이덴티티 앵커다. **재검증을 거친 정정은 허용하며 성립 조건은 둘이다** — 서버 재검증 함수의 전용 트랜잭션 컨텍스트와 **같은 트랜잭션에 기록된 result = MATCH 검증 로그**다. 둘 중 하나만으로는 열리지 않는다(GUC 단독은 미검증 변경을, 로그 단독은 과거 로그 재활용을 허용한다) | MANAGER | P0 |
| REQ-WRK-10 | 지오펜스 설정 | workplaces에 기준 좌표(lat · lng) · geofence_radius_m(50~500) · location_accuracy_limit_m을 저장한다. **반경 변경은 변경 시각 이후 체크인부터 적용**하며 과거 판정을 소급하지 않는다. v1은 사업장당 단일 근무지이며 다중 근무지는 v1에 두지 않는다 | MANAGER | P0 |
| REQ-WRK-11 | 정보 변경 이력 | 지오펜스·주소·상태·근무정책·**보험 계열별 관리번호** 변경은 workplace_change_logs에 전후값·유효시작일·변경자를 기록한다. **기록 대상이 늘어도 감사 action 코드는 workplace.update 하나다** — 무엇이 바뀌었는지는 field 와 전후값이 담으므로 **"어느 열을 고쳤는가"마다 코드를 만들지 않는다.** 열람 권한을 두 축으로 나눈다 — **STAFF 이상은 현재 유효한 근무지 좌표·지오펜스 반경·근무정책만** 읽는다(출퇴근 판정에 필요하므로 막으면 체크인 자체가 성립하지 않는다). **MANAGER 이상은 변경 이력 전체**(전후값 · 유효시작일 · 변경자)를 읽고 변경을 수행한다. **STAFF에게 변경 이력과 변경자를 노출하지 않는다** — 두 축의 물리적 분리는 테이블 경계로 강제한다. STAFF는 workplaces 행의 **현재값**을 읽고, workplace_change_logs의 SELECT는 **사업장 관리자 전용**이다 | STAFF(좌표·근무정책 조회) · MANAGER(관리·변경 이력) · 시스템 | P0 |

## WRK-04 직원 초대  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-12 | 초대 생성·권한 | username 또는 휴대폰번호로 역할(STAFF·MANAGER) · 고용 시작 예정일 · 메시지를 지정해 초대한다. **MANAGER는 STAFF만 초대할 수 있고**(MANAGER·OWNER 초대 불가) **OWNER는 MANAGER·STAFF를 초대**할 수 있다. 역할 초대 권한 위반은 **workplace.invite_role_forbidden/403**이며, 서비스 판정과 함께 **초대 INSERT 가드가 role = MANAGER를 OWNER에게만 허용**한다 — 관리자 축 정책은 OWNER와 MANAGER를 구분하지 못하므로 이 가드가 없으면 MANAGER가 관리자를 스스로 증식시킨다 | MANAGER | P0 |
| REQ-WRK-13 | 초대 저장·발송·멱등 | workplace_invitations(workplace_id · target_username 또는 target_phone · role · token_hash · status · expires_at 기본 7일 · invited_by)에 저장한다. **초대 유형 컬럼(invitation_type)을 두지 않는다** — v1의 유형은 멤버 초대 하나뿐이라 값이 단일인 컬럼이 되며, ADVISOR 초대(WRK-13 이월) 도입 시 되살린다. **토큰은 해시로만 저장**한다. 가입자에게는 인앱 알림, 미가입자에게는 공유 코드로 발송한다. **동일 사업장·동일 대상의 PENDING 초대는 중복 생성하지 않는다**(멱등). 이미 ACTIVE 멤버이면 **workplace.already_member/409** | 서버 | P0 |
| REQ-WRK-14 | 초대 재발송·취소·한도 이중검증 | **만료(EXPIRED)·거절(REJECTED) 초대를 재발송하면 새 토큰을 생성하고 직전 토큰을 즉시 무효화**한다 — 직전 토큰으로는 수락할 수 없다(invitation.invalid_token/422). 초대자는 PENDING 초대를 CANCELLED로 취소할 수 있다. **인원 한도는 발송 시점과 수락 시점 양쪽에서 재검증**한다 — 대기 중 다른 초대가 수락되어 한도가 찰 수 있기 때문이다. 발송 시점 초과는 **subscription.staff_limit_exceeded/402** | MANAGER | P0 |

## WRK-05 초대 수락/거절  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-15 | 초대 조회 | 로그인 사용자는 본인에게 온 PENDING 초대(사업장명 · 역할 · 초대자 · 만료시각)를 조회한다. **타인 초대는 2차 방어로 차단**하며 행 존재 자체를 노출하지 않는다. **본인 대상 판정 축은 둘이다** — target_username = 본인 username 또는 target_phone = 본인 프로필 phone이며, 미가입 상태로 받은 초대가 가입 후 이어지려면 두 축이 모두 필요하다 | 본인 | P0 |
| REQ-WRK-16 | 수락 처리·한도 재검증·동시성 | 유효 토큰 수락 시 단일 트랜잭션에서 ① **활성 멤버 한도 재검증**(REQ-SUB-06) ② workplace_members를 ACTIVE로 생성하거나 LEFT 멤버십을 재활성화 ③ **employees 초안 생성**(hire_date NULL = 입사 미확정 — 계약은 REQ-HRM-01) ④ 초대를 ACCEPTED로 전이 ⑤ OWNER·MANAGER에게 알림을 수행한다. **동시 수락 경합은 사업장 행 잠금으로 직렬화**해 한도 우회를 막는다. **다섯 단계는 전부 수락자 본인 세션으로 실행되며 수락자는 관리자가 아니다** — 멤버십 생성·재활성화와 직원 초안 생성이 관리자 축 정책에 막히지 않도록 서버 함수의 수락 컨텍스트가 그 경로를 여는 유일한 축이다. 만료 토큰은 **invitation.expired/410**, 무효 토큰·공유코드는 **invitation.invalid_token/422**. 미가입 공유 코드는 **1회용**이며 수락 시 초대 대상 phone·username 일치 검증을 필수로 하고 불일치는 거부한다 — v1은 관리자 최종 승인 우회 경로를 제공하지 않는다 | 본인 · 서버 | P0 |
| REQ-WRK-17 | 재초대 수락 제한 | 기존 멤버십 이력이 **LEFT(자발적 이탈)인 경우에만 ACTIVE로 재활성화**한다. **REMOVED(강제 제외)·SUSPENDED 이력자의 재초대 수락은 차단**한다 — **workplace.member_state_conflict/409**. 차단 근거는 열거가 아니라 **기본 거부**다 — 멤버십 전이 가드는 허용 표에 없는 전이를 전부 거부하므로 SUSPENDED가 v1 미사용 예약값이라는 사실이 차단 근거를 대신하지 않는다. 차단된 대상은 관리자가 사유를 확인한 뒤 별도 처리한다 | 본인 · 서버 | P0 |
| REQ-WRK-18 | 거절·취소·만료 | 대상자는 REJECTED로, 초대자는 CANCELLED로 전이한다. **종단 상태(ACCEPTED·REJECTED·CANCELLED·EXPIRED)에 도달한 초대에 다시 응답·취소를 시도하면 invitation.already_responded/409**다 — 대상자의 재수락·재거절뿐 아니라 **초대자가 이미 응답된 초대를 취소하려는 경우와 재발송 대신 같은 행을 되살리려는 경우**도 같은 코드로 막는다. 재발송은 기존 행을 되돌리지 않고 **새 행 생성 + 직전 토큰 무효화**로만 한다(REQ-WRK-14). 만료 초대는 정기작업 **expireInvitations**(30분 주기)가 EXPIRED로 전이하며, 이 배치는 초대자도 대상자도 아니므로 **서버 전용 전이 축**을 별도로 갖는다. **사업장이 SUSPENDED·CLOSED이면 수락을 차단**한다 — **workplace.closed/409**. **차단 축은 폐쇄 읽기 전용 가드가 아니라 사업장 쓰기 가능 판정(is_workplace_writable)이다** — 읽기 전용 가드는 CLOSED만 보므로 그것만으로는 SUSPENDED 사업장의 수락이 통과한다. 모든 전이는 알림을 발송한다 | 본인 · MANAGER(취소·재발송) · 시스템 | P0 |

## WRK-06 사업장 선택/전환  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-19 | 소속 목록 | 본인의 ACTIVE 멤버십 사업장 목록(사업장명 · 역할 · 사업장 상태 · 마지막 선택 시각)을 조회한다. 현재 앱에서 진입 권한이 없는 사업장은 비활성 상태로 표시한다 | 본인 | P0 |
| REQ-WRK-20 | 컨텍스트 전환·재검증 | 사업장 선택 시 클라이언트는 활성 workplace_id를 저장하고 이후 모든 업무 요청에 포함한다. **서버는 매 요청 멤버십·역할을 재검증**하며 불일치는 **auth.workplace_forbidden/403**이다. 전환 차단 대상은 SUSPENDED·CLOSED 사업장(**workplace.unavailable/409**) · LEFT와 REMOVED 멤버십 · STAFF의 관리자 웹 접근이다. 마지막 활성 사업장이 무효면 선택 화면으로 되돌린다. **클라이언트 캐시는 workplace_id + 역할 단위로 격리**해 전환 시 타 사업장 데이터가 잔존하지 않게 한다 | 본인 · 시스템 | P0 |

## WRK-07 멤버 역할 관리  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-21 | 역할 변경 | **OWNER만** MANAGER와 STAFF를 서로 변경한다. MANAGER는 역할 변경 권한이 없다. **OWNER 권한 부여·회수는 양도 경로로만** 가능하며 v1에 양도를 두지 않으므로 역할 직접 변경으로 OWNER를 만들 수 없다. 위반은 **workplace.role_change_forbidden/403**, 대상 멤버십 부재는 **workplace.member_not_found/404** | OWNER | P1 |
| REQ-WRK-22 | OWNER 단일성 불변식 | **사업장당 ACTIVE OWNER는 항상 정확히 1명**이다. 차단 대상은 ① 마지막 OWNER 강등 ② MANAGER의 OWNER·MANAGER 역할 변경 ③ **본인 권한을 스스로 제거해 OWNER가 0명이 되는 행위**다. 위반은 **workplace.owner_singleton/409**(불변식 위반) 또는 **workplace.last_owner/409**(마지막 OWNER 제외 시도)이며 서비스 레이어와 DB 제약 양쪽에서 강제한다 | 시스템 | P1 |
| REQ-WRK-23 | 역할 감사·캐시 무효화 | 역할 변경은 membership_role_events에 전후 역할·처리자·사유를 기록하고 대상자에게 알린다(role_changed). 변경 즉시 대상자 세션의 권한 캐시를 무효화한다. **역할 회수 후에도 그 사람이 만든 근태·급여 데이터는 유지되고 감사 로그에 행위자로 남는다** | 시스템 | P1 |

## WRK-08 멤버 목록·검색  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-24 | 멤버 목록·연계 | MANAGER 이상은 멤버 전체(이름 · 역할 · 멤버 상태 · 입사일 · 고용형태 · 재직 상태 · 연락처 일부)를 페이지네이션 조회한다. 멤버십은 인사 레코드(REQ-HRM-01)·근로조건(REQ-HRM-06)과 1:1 연계된다. STAFF는 공개 최소 정보만 조회한다 — **멤버십 행 자체의 조회 축은 관리자와 본인으로 한정하고, 동료 공개정보는 이름·아바타·역할만 반환하는 조회 함수가 담당한다**. 멤버십 행에는 제외 사유·이탈 시각·초대자가 실려 있어 행을 그대로 열면 최소 정보 원칙이 무너진다 | STAFF | P0 |
| REQ-WRK-25 | 검색·필터·마스킹 | 이름 · username · 연락처 뒤 4자리 · 역할 · 멤버 상태 · 재직 상태로 검색한다(입력 trim · **길이 상한 50자** · 메타문자(`\`·`%`·`_`) 이스케이프 — 전 도메인 목록 검색 q의 공통 계약이며 정본은 [../06_api/01_conventions.md](../06_api/01_conventions.md)다). **목록 응답에 급여·주민번호·계좌·상세 주소를 포함하지 않는다.** 민감 인사정보는 REQ-HRM-04 권한 검사를 통과해야 조회 가능하다 | MANAGER | P0 |

## WRK-09 멤버 제외  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-26 | 제외 권한·사유 | **OWNER는 MANAGER·STAFF를, MANAGER는 STAFF만** 제외할 수 있다. **OWNER 본인은 제외할 수 없다.** 제외 사유와 적용일 입력을 필수로 하며, **REMOVED 전이 시 두 값의 NOT NULL을 CHECK가 강제한다** — 사유 없는 강제 제외는 재초대 차단의 근거를 남기지 않는다 | MANAGER | P1 |
| REQ-WRK-27 | 제외 선행조건 | 아래에 해당하면 제외를 차단하고 선행 조치를 요구한다 — ① **마지막 OWNER**는 양도 선행이 필요하나 v1에 양도가 없으므로 폐쇄 경로로 안내한다(**workplace.last_owner/409**) ② **급여 확정 진행 중인 대상자**는 마감 취소 또는 완료 선행(**workplace.payroll_in_progress/409**) ③ **진행 중 승인의 필수 승인자**는 승인자 재배정 선행(**workplace.pending_approver/409**). 제외로 사업장 필수 인원(최소 1명)이 미달하면 **workplace.employee_required/409**. **네 조건은 여러 테이블에 걸친 판정이라 서비스 레이어가 단독으로 강제한다** — 멤버십 전이 가드는 ACTIVE → REMOVED 자체를 막지 않으므로, 이 조건들은 DB 제약으로 표현되지 않는 항목으로 등재해 어느 층도 맡지 않는 상태를 남기지 않는다 | MANAGER · 시스템 | P1 |
| REQ-WRK-28 | 퇴사 연동·데이터 보존 | 직원 퇴사에 따른 제외는 퇴사 처리(REQ-HRM-12)와 연동해 퇴사일·4대보험 상실·정산을 트리거한다. 멤버십은 **본인 이탈은 LEFT, 강제 제외는 REMOVED**로 전이하고 업무 접근을 차단한다. **제외 후에도 근태·급여·명세서·근로계약은 법정 보존**하며 **본인은 보존기간 내 계속 열람**한다(REQ-SLP-09) | 서버 | P1 |

## WRK-10 사업장 폐쇄  P2

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-36 | 사업장 폐쇄 | OWNER는 아래를 모두 충족해야 사업장을 CLOSED로 전이할 수 있다 — ① **진행 중 급여 확정 없음** ② **미발행 명세서 없음** ③ **미처리 승인 없음**(미충족 시 **workplace.close_blocked/409**와 미충족 항목 상세) ④ **법정 보존 안내 확인**(누락 시 **workplace.retention_ack_required/422**) ⑤ **비밀번호 재인증**(REQ-AUT-25). CLOSED는 **신규 업무 생성 차단 + 읽기 전용** 전환이며 **법정 보존 데이터는 유지**한다. **폐쇄 트랜잭션은 사업장 상태 전이와 같은 단위에서 OWNER 멤버십을 종료 상태로 전이시킨다** — 이 전이를 폐쇄에 포함하지 않으면 OWNER 멤버십이 CLOSED 사업장에 ACTIVE로 남아 이후 탈퇴(REQ-AUT-20·21)가 OWNER 단일성 가드와 폐쇄 읽기전용 가드에 막히고, 폐쇄가 해소하려던 "OWNER는 탈퇴할 수 없다" 교착이 그대로 남는다. 남은 멤버십(STAFF·MANAGER)의 처리는 각자의 탈퇴·제외 경로가 담당한다. **전이를 서술로만 두지 않고 두 장치로 강제한다** — 폐쇄 서버 함수가 트랜잭션 안에서만 켜는 **전용 컨텍스트**(읽기 전용 가드의 멤버십 종료 예외를 판정하는 유일한 축)와, 트랜잭션 종료 시점에 **CLOSED 사업장의 잔존 ACTIVE 멤버십을 거부하는 지연 가드**(workplace.close_blocked/409)다. 컨텍스트가 없으면 예외를 판정할 수 없고, 가드가 없으면 멤버십을 남긴 채 폐쇄가 성립해 교착이 되살아난다. 플랫폼 관리자의 강제 폐쇄(REQ-SYS-05)와는 **별개 경로**이나 멤버십 종료는 두 경로에 공통이므로 **강제 폐쇄 실행자가 사업장 멤버가 아니어도 그 전이가 성립해야 한다** | OWNER | P2 |

> 원천 문서는 폐쇄 경로의 v1 채택 여부를 미해결로 남겼다 — 폐쇄가 없으면 REQ-AUT-20 때문에 **OWNER가 영구히 탈퇴할 수 없는 데드락**이 되기 때문이다. docs_ref2/features_p0.md가 **폐쇄만 v1 채택 · 양도는 v1 제외**로 확정하며 이 경계는 해소됐다. 양도 대비 코드 workplace.transfer_invalid는 발생 지점 없이 예약만 한다.

## WRK-11 사업장 등록 한도  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-29 | 등록 수 게이팅·동시성 | 사업장 등록은 소유 사업장 수 < max_owned_workplaces를 서버에서 강제한다. **동시 다중 생성 요청은 사용자 행 잠금으로 직렬화**해 한도 우회를 방지한다. 초과는 subscription.workplace_limit_exceeded/402 | 서버 | P0 |
| REQ-WRK-30 | 직원 소속 무제한 | STAFF·MANAGER로서의 타 사업장 소속은 **본인 구독과 무관하게 무료·무제한**이다. 구독 한도는 OWNER 측 두 축에만 적용된다 — ① 소유 사업장 수(max_owned_workplaces) ② 사업장당 활성 멤버 수(max_staff_per_workplace ≤ 30). **동일 사업자번호라도 별도 사업장으로 등록하면 각각 한도 1개를 소진**한다 | 시스템 | P0 |
| REQ-WRK-31 | 한도 변경 반영 | 구독 변경·사업장 폐쇄 시 등록 가능 수를 즉시 재계산한다. **등급 강등으로 기존 사용량이 초과되어도 기존 ACTIVE 사업장을 자동 폐쇄하지 않고 신규 등록만 차단**한다(REQ-SUB-07) | 시스템 | P0 |

## WRK-14 사업장 검증 상태 관리  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-08 | 검증 상태 머신·PENDING 제약 | 사업장 상태는 PENDING_VERIFICATION · ACTIVE · SUSPENDED · CLOSED다. **PENDING_VERIFICATION은 ① 국세청 API 장애 ② 개업 준비 중(사업자등록 신청 전)** 두 경우에 생성한다. PENDING에서는 **근태·인사 입력을 허용하되 급여 확정·명세서 발행을 차단**한다 — **workplace.verification_pending/409**. **차단 축은 사업장 쓰기 가능 판정이 아니다** — 그 판정은 PENDING을 쓰기 가능으로 보아 근태·인사를 열어야 하므로, 급여 확정과 명세서 발행의 전이 판정이 사업장 상태를 직접 보고 막는다. 이 축을 서비스 레이어에만 두면 미검증 사업자 명의로 확정 임금대장이 생성될 수 있다. **14일**(정책값 — 사용자 확정 2026-08-03, 기준값으로 시드) 내 미검증이면 자동으로 SUSPENDED로 전이하고 **OWNER에게 인앱 필수 알림(타입 workplace_suspended)을 보낸다** — 사업장이 멈추면 근태·급여가 함께 멈추므로 배치 실패 같은 운영 통보와 달리 **사용자 대면 통보가 필수**다(REQ-NTF-05). 검증 성공 시 PENDING_VERIFICATION → ACTIVE로 전이한다 | 서버 · 시스템 | P1 |

## WRK-16 데이터 온보딩·일괄 임포트  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-32 | 임포트 업로드·행 검증·미리보기 | CSV·Excel 템플릿으로 직원 인적사항·고용형태·근로조건·입사일을 업로드한다. import_jobs(workplace_id · import_type ∈ EMPLOYEES·OPENING_BALANCE · status · total_count · success_count · fail_count · error_report · created_by)에 작업을 기록한다. 서버가 **행별 검증**을 수행하고 검증 결과·오류 행·한도 초과 경고를 포함한 **미리보기**를 반환한다. **이 단계에서는 어떤 데이터도 커밋하지 않는다.** 행 검증 실패는 **import.validation_failed/422**로 행 번호·필드·사유를 포함한다 | MANAGER | P1 |
| REQ-WRK-33 | 임포트 확정·부분 실패 리포트 | 미리보기를 검토하고 확정하면 **검증 통과 행만 커밋**한다(미리보기 단계에서는 전체 롤백이 가능하다). **확정은 OWNER 전용 액션**이다. **부분 실패 시 실패 행을 건너뛰고 통과 행을 커밋한 뒤 실패 상세 리포트를 제공**한다. 행 단위 부분 실패는 오류가 아니라 **200 + PARTIALLY_COMMITTED**로 끝나며, **확정 트랜잭션이 원자 단계에서 실패해 커밋분 자체가 무효화된 경우만 import.rollback_required/409**(재실행 필요)다. **민감정보(주민번호·계좌)는 임포트 즉시 암호화**한다(REQ-HRM-03). 모든 임포트는 감사 로그를 남긴다 | OWNER | P1 |
| REQ-WRK-34 | 과거 이력 기초값 적재 | 전환 시점 이전의 **근태·급여·연차 잔액 기초값**을 적재한다. **이미 사용한 연차를 적재할 경로가 없으면 잔액이 0부터 시작해 연차 계산이 처음부터 틀린다**(REQ-LEV-07). 적재 데이터는 source = IMPORT로 표시하고 급여 계산·연차 산정의 **기산 기준으로만** 사용하며 **명세서 자동 생성 대상에서 제외**한다 | MANAGER | P1 |
| REQ-WRK-35 | 임포트 중복·한도 검출 | 중복을 두 종류로 **분리 검출**한다 — ① **업로드 파일 내 행간 중복**(동일 username·주민번호를 복호화 없이 blind-index로 판정)은 **import.duplicate_employee/409** ② **기존 DB 등록 직원과의 중복**은 **hr.duplicate_active_employee/409** 또는 **hr.resident_no_duplicate/409**(REQ-HRM-11 재사용)다. 임포트 직전 **활성 직원 수 + 커밋 예정 행 수**를 재검증하고 초과는 **subscription.staff_limit_exceeded/402**로 차단한다 — **판정 축은 활성 멤버 수가 아니다.** 임포트가 만드는 것은 employees이지 workplace_members가 아니므로 멤버 수로 재면 적재량이 한도에 잡히지 않는다. 멤버십 인원 가드는 이 경로에서 발동하지 않으므로 강제는 확정 트랜잭션의 서버 판정 단독이다 | MANAGER · 시스템 | P1 |

## DSH-06 리포트 내보내기  P2

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-WRK-37 | 목록 공통 엑셀 내보내기 | 관리자 웹의 목록 표를 **화면에 걸린 검색 · 필터 · 정렬 · 표시 열 그대로** XLSX로 내려받는다. 발급(POST /v1/workplaces/{workplaceId}/list-exports)은 **그 목록 조회 표면의 권한을 그대로** 판정하고 조건을 1회용 토큰에 봉인한다. 파일은 다운로드(GET /v1/list-exports/download/{token}) 순간 **서버가 만들고 저장하지 않는다.** 열은 목록이 선언한 화이트리스트 안에서만 고르며 **주민등록번호는 원문도 마스킹 값도 싣지 않는다.** **민감 목록**(개인 식별 · 연락 · 임금 · 신고 정보가 한 파일에 모이는 목록)은 **사유 필수**이고 list.export_sensitive로, 그 밖은 list.export로 **다운로드 시점에** 감사에 남긴다. 멱등키를 요구하지 않는다. 등재된 시스템 콘솔 목록을 이 표면에서 요청하면 **export.forbidden/403**, 토큰의 없음 · 만료 · 재사용 · 소유자 불일치는 **export.expired/410**, 파일 작성 실패는 **export.failed/500**이다. 임금대장 · 근로자명부 · 신고자료 전용 내보내기를 **대체하지 않는다.** 계약 정본은 [../06_api/04_workplace.md](../06_api/04_workplace.md) #35 · #36이고, 시스템 콘솔 목록 축은 [13_system.md](./13_system.md) REQ-SYS-17이다 | MANAGER 이상(목록의 조회 권한) | P2 |

## 미확인 — 확인 전 시드 금지

**목록과 건수의 정본은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 미확인 절**이며, 아래는 이 도메인에 걸리는 항목의 상세다.

| 항목 | 내용 | 영향 |
|------|------|------|
| PENDING_VERIFICATION 자동 정지 기한 | **14일로 확정됐다**(사용자 확정 2026-08-03 — [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) #12). 기준값(REQ-SYS-12) 정책값으로 시드하며, 값 변경은 기준값 개정으로만 한다 | 확정 전 임의 기한 시드를 금지하던 항목 — 해소됨 |
| 임포트 확정 권한 | 원천 features.md의 OWNER 전용 액션 표는 임포트 확정을 OWNER 전용으로 지정하고 legacy 요구사항은 OWNER·MANAGER를 허용했다. 본 문서는 **업로드·미리보기 = MANAGER 이상 · 확정 = OWNER 전용**으로 정리했으며 노무·운영 확인이 필요하다(REQ-WRK-32·33) | 확정 권한이 넓어지면 임포트 커밋의 책임 소재가 흐려진다 |

## 관련 테이블

| 테이블 | 역할 |
|--------|------|
| workplaces | 테넌트 루트 — business_no · site_label · status · 좌표 · geofence_radius_m · tax_unit_type · site_role · **contact_phone**(REQ-WRK-09) |
| business_units | 사업자단위과세·종사업장 그룹 연결 — v1 기본은 GENERAL이며 확장 지점으로만 둔다(REQ-WRK-06) |
| workplace_members | 멤버십 — role(OWNER·MANAGER·STAFF) · status(ACTIVE·LEFT·REMOVED) · OWNER 단일성 제약(REQ-WRK-22) |
| workplace_invitations | 초대 — token_hash · status · expires_at(REQ-WRK-13). **초대 유형 컬럼을 두지 않는다** |
| workplace_change_logs | 사업장 정보 변경 이력 — 전후값·유효시작일·변경자. **조회는 사업장 관리자 전용**(REQ-WRK-11) |
| membership_role_events | 역할 변경 이력 — 전후 역할·처리자·사유(REQ-WRK-23) |
| business_verification_logs | 진위·상태 조회 이력 — result · latency · 응답 요약(REQ-WRK-05) |
| import_jobs | 임포트 작업 — import_type · status · 건수 · error_report(REQ-WRK-32·33) |
| employees | 초대 수락·임포트가 생성하는 인사 레코드(REQ-WRK-16 · REQ-HRM-01) |
| plans · subscriptions | 등록 한도·인원 한도 조회 대상(REQ-WRK-29·30 · REQ-SUB-05·06) |

## 관련 화면

| 화면 코드 | 화면명 |
|-----------|--------|
| APP-INVITE | 초대 수락·거절 |
| APP-SETTINGS | 내 정보·설정 |
| ADM-WORKPLACE-SELECT | 사업장 선택·진입 분기 |
| ADM-WORKPLACE-CREATE | 사업장 등록 |
| ADM-ACCOUNT | 계정 설정 |
| ADM-WORKPLACE-SETTINGS | 사업장 설정·검증 상태 |
| ADM-MEMBERS | 멤버·역할·초대 관리 |
| ADM-IMPORT | 데이터 온보딩·일괄 임포트 |
| ADM-SUBSCRIPTION | 구독·이용 한도 |

검산: 9본 — APP 2 · ADM 7. 진위확인 호출(REQ-WRK-04·05)과 검증 대기 자동 정지(REQ-WRK-08)는 화면 없는 (서버) 축을 함께 갖는다.

기능→화면 전수 매핑 정본은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)다.

## 에러 코드

| 에러 코드 | HTTP | 발생 조건 |
|-----------|:--:|----------|
| workplace.business_invalid | 422 | 진위확인 불일치 또는 **폐업** 사업자 — 휴업은 경고 후 허용(REQ-WRK-04 · REQ-WRK-05) |
| workplace.business_api_unavailable | 503 | 국세청 API 장애·timeout·호출량 초과(REQ-WRK-07) |
| workplace.duplicate_site | 409 | 동일 (business_no, site_label) 완전 중복(REQ-WRK-06) |
| workplace.verification_pending | 409 | PENDING_VERIFICATION 상태에서 급여 확정·명세서 발행 시도(REQ-WRK-08 · REQ-SLP-01) |
| workplace.immutable_field | 422 | business_no·owner_name·open_date 등 보호 필드 변경 시도(REQ-WRK-09) |
| workplace.already_member | 409 | 초대 대상이 이미 ACTIVE 멤버(REQ-WRK-13) |
| workplace.invite_role_forbidden | 403 | 역할 초대 권한 위반 — MANAGER가 MANAGER·OWNER 초대(REQ-WRK-12) |
| workplace.closed | 409 | SUSPENDED·CLOSED 사업장에서 초대 수락·업무 진입 시도(REQ-WRK-18) |
| workplace.unavailable | 409 | SUSPENDED·CLOSED 사업장으로 컨텍스트 전환 시도(REQ-WRK-20) |
| workplace.role_change_forbidden | 403 | 역할 변경 권한·경로 위반(REQ-WRK-21) |
| workplace.owner_singleton | 409 | ACTIVE OWNER 1명 불변식 위반 — 0명 또는 2명 이상(REQ-WRK-22) |
| workplace.last_owner | 409 | 마지막 OWNER 강등·제외 시도(REQ-WRK-22 · REQ-WRK-27) |
| workplace.payroll_in_progress | 409 | 급여 확정 진행 중인 대상자 제외 차단(REQ-WRK-27) |
| workplace.pending_approver | 409 | 미처리 승인의 필수 승인자 제외 차단(REQ-WRK-27) |
| workplace.member_not_found | 404 | 역할변경 등 대상 멤버십 부재(REQ-WRK-21) |
| workplace.member_state_conflict | 409 | REMOVED·SUSPENDED 이력 멤버십의 재초대 수락 차단 — LEFT만 재활성화 허용(REQ-WRK-17) |
| workplace.employee_required | 409 | 멤버 제외로 사업장 필수 직원(최소 1명) 미달(REQ-WRK-27) |
| workplace.close_blocked | 409 | 폐쇄 전 미완 급여·미발행 명세서·미처리 승인 존재(REQ-WRK-36) |
| workplace.retention_ack_required | 422 | 폐쇄 시 법정 보존 안내 미확인(REQ-WRK-36) |
| workplace.transfer_invalid | 422 | 양도 대상·상태·한도 검증 실패 — **v1 발생 지점 없음(양도 미구현 · 코드만 예약)** |
| workplace.business_unit_overlap | 409 | 같은 소유자·명칭의 사업 단위 선언 유효기간 겹침(business_units EXCLUDE) — 주로 동시 선언 경합에서 발생(REQ-CMP-10) |
| **workplace.mgmt_no_required** | 422 | 신고자료 생성 시 **대상 보험 계열의 사업장관리번호가 비어 있음** — 비어 있는 계열을 details로 반환하고 해소 자리는 사업장 정보 수정이다(REQ-TAX-01 · REQ-WRK-09) |
| invitation.expired | 410 | 만료(EXPIRED) 토큰으로 수락 시도(REQ-WRK-16) |
| invitation.invalid_token | 422 | 초대 토큰·공유코드 무효 — 재발송으로 무효화된 직전 토큰 포함(REQ-WRK-14 · REQ-WRK-16) |
| invitation.already_responded | 409 | 이미 응답한 초대의 재수락·재거절·재발송·취소 시도(REQ-WRK-18) |
| import.validation_failed | 422 | 행 단위 검증 오류 — 행 번호·필드·사유 포함(REQ-WRK-32) |
| import.duplicate_employee | 409 | **업로드 파일 내 행간 중복**(동일 username·주민번호) 전용(REQ-WRK-35) |
| import.rollback_required | 409 | 확정 트랜잭션이 원자 단계에서 실패해 커밋분이 무효화된 경우 — 재실행 필요. 행 단위 부분 실패는 200 + PARTIALLY_COMMITTED(REQ-WRK-33) |

검산: workplace **22** + invitation 3 + import 3 = **28종**. 사업장·초대 흐름에서 함께 발생하는 subscription.workplace_limit_exceeded/402 · subscription.staff_limit_exceeded/402의 정의처는 [12_subscription.md](./12_subscription.md), 인사 중복 코드의 정의처는 [04_hr.md](./04_hr.md)다. **REQ-WRK-37(목록 공통 내보내기)이 내는 export.forbidden/403 · export.expired/410 · export.failed/500은 새 코드가 아니다** — [09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)에 REQ-SYS-11(시스템 감사 로그 내보내기) 축으로 이미 채번돼 있고, export.forbidden은 "v1 발생 지점 없음"이던 예약 코드가 이 표면에서 **첫 발생**한다. 정의처가 그 문서라 이 표의 검산에 넣지 않는다.

## 관련 문서

- [../02_features/02_workplace.md](../02_features/02_workplace.md) — WRK 13기능 명세 정본
- [01_global_rules.md](./01_global_rules.md) — 멱등성·동시성·감사·보존 전역 계약
- [02_auth.md](./02_auth.md) — 진입 컨텍스트 분기·탈퇴 차단 조건
- [04_hr.md](./04_hr.md) — 인사 레코드·근로조건·퇴사 연동
- [10_compliance.md](./10_compliance.md) — 복수 사업장의 상시근로자 합산 판정(REQ-CMP-08)
- [12_subscription.md](./12_subscription.md) — 등록 한도·인원 한도 정의처
- [../05_database/02_workplace.md](../05_database/02_workplace.md) — 사업장·멤버 테이블 명세
- [../06_api/04_workplace.md](../06_api/04_workplace.md) — 사업장 API 표면
