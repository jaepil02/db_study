# ID·표기 규약 (04_id_conventions)

> **대상**: docs/ 전 문서와 구현 저장소(backend/ · web_front/ · app_front/)가 공유하는 식별자 형식·채번 규칙의 정본
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **기능 접두사 13 → 14종**(DSH — 도메인 파일 없이 데이터 소유 도메인 파일에 행으로 등재 · D-23) · 접두사별 v1 기능 수 AUT 9 → **10** · ATT 11 → **12** · DSH **2** · 검산 94 → **98**(정본 [../02_features/README.md](../02_features/README.md)). 결번 규칙의 예시가 v1로 들어온 AUT-05를 가리키고 있어 HRM-10으로 바꾼다. **DSH 요구사항 ID는 그 행을 담은 요구사항 파일의 접두사로 채번한다**를 등재한다
> **개정일**: 2026-09-10 — 인용 갱신 — 에러 코드 119 → **120종**(workplace.mgmt_no_required/422 신설 — 신고자료의 빈 관리번호 계열. 채번 정본 [02_error_codes.md](./02_error_codes.md)). **16네임스페이스는 불변**이다 — 발생 표면은 TAX 이지만 부재한 값이 사업장의 것이라 workplace 가 갖는다
> **개정일**: 2026-09-07 — 멱등키 항목을 **축 둘의 인용**으로 바꾼다(V0711) — 종전 표기는 사업장 축만 담아 **사업장 스코프가 없는 표면이 키를 걸 자리를 표현하지 못했다**. 형식의 정본을 **REQ-GLB-14**로 넘기고 여기서 다시 정의하지 않는다 — 같은 사실의 정본을 둘로 만들지 않는다. 나머지 ID 규약은 전건 불변
> **개정일**: 2026-09-06 — 파생 집계 정합 — 에러 코드 채번 정본 인용 118 → **119종**(2026-08-21 workplace.business_unit_overlap/409 신설 — 정본 [02_error_codes.md](./02_error_codes.md)). 16네임스페이스 · 폐기 2종 제외 규약은 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — 저장소 폴더 back/ → **backend/** · 마이그레이션 파일 경로 back/db/migration/ → 저장소 루트 **db_migration/**. 파일명 규약 V{NNNN}\_\_{name}.sql은 불변
> **개정일**: 2026-08-08 — 화면 표면 매핑을 산출물 축으로 재표기(라우트 그룹 표기 제거 · 프리렌더 정적과 SPA 구분) · 라우트 표기 형식 규약 추가
> **원천**: docs_ref2/features_p0.md(기능ID 채번) · docs_ref2/requirements_p0.md(REQ·에러 규약) · docs_ref2/schema_p0.md(테이블·마이그레이션) · [../README.md](../README.md) ID·표기 규약

모든 식별자의 형식과 채번 정본을 한 곳에 고정한다. 다른 문서는 여기 정의를 다시 쓰지 않고 링크한다. 새 ID는 각 채번 정본 문서에서만 만든다.

## ID 형식 요약

| 종류 | 형식 | 예 | 채번 정본 |
|------|------|-----|----------|
| 기능 ID | {도메인}-NN | AUT-01 · PAY-08 | [../02_features](../02_features/README.md) 각 도메인 파일 |
| 요구사항 ID | REQ-{도메인}-NN | REQ-GLB-01 · REQ-PAY-27 | [../03_requirements](../03_requirements/README.md) 각 파일 |
| 화면 코드 | {표면}-{의미} | APP-CHECKIN · ADM-PAYROLL-RUN | [../07_screen/README.md](../07_screen/README.md) |
| 에러 코드 | {domain}.{snake_case} + HTTP 상태 | payroll.missing_reference_value/422 | [02_error_codes.md](./02_error_codes.md) |
| 기술결정 | ADR-NN | ADR-01 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) |
| 제품결정 | D-NN | D-01 | [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) |
| 인수기준 | AC-NN | AC-01 | [../03_requirements/16_acceptance_criteria.md](../03_requirements/16_acceptance_criteria.md) |
| 테이블·컬럼 | snake_case | payroll_runs · employees.user_id | [../05_database](../05_database/README.md) |
| enum 타입·값 | 타입 = snake_case · 값 = SCREAMING_SNAKE | workplace_status = PENDING_VERIFICATION | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 마이그레이션 | V{NNNN}__{name}.sql (4자리 · 언더스코어 2개) | V0060__payroll.sql | [../05_database/10_migrations_seed.md](../05_database/10_migrations_seed.md) |

## 결번 규칙

접두사별 01부터 연속 채번하는 것이 원칙이나, **기능 ID의 결번은 오류가 아니라 v1 범위 제외를 뜻하는 의도된 공백**이다. 원천(docs_ref2/features.md)이 전 기능 138개를 채번했고 본 문서군은 그중 v1 기능만 등재하므로(기능 수의 정본 [../02_features/README.md](../02_features/README.md)), 예를 들어 HRM-10(인사 변경 이력 — v1.1 이월)은 02_features에 없다. **이월 기능이 v1로 들어오면 원래 번호로 등재한다** — AUT-05 · ATT-10 · DSH-03 · DSH-06이 그 예다(D-23). 규칙은 세 가지다.

- 결번·폐지 ID는 **재사용하지 않는다**. 이월 기능이 v1.1에 들어올 때 원래 번호를 그대로 쓴다.
- v1 제외 기능ID의 유일한 등재처는 [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) Out 범위 표다. 다른 문서는 부정형 언급만 한다.
- REQ · 화면 코드 · AC · ADR · D는 본 문서군에서 새로 채번하므로 **결번 없이 연속**이다.

## 기능 접두사 14종

| # | 도메인 | 접두사 | v1 기능 수 |
|---|--------|--------|-----------|
| 1 | 인증·계정 | AUT | 10 |
| 2 | 사업장·멤버 | WRK | 13 |
| 3 | 인사 | HRM | 11 |
| 4 | 근태 | ATT | 12 |
| 5 | 휴가·연차 | LEV | 5 |
| 6 | 급여 | PAY | 13 |
| 7 | 명세서 | SLP | 7 |
| 8 | 세무·4대보험 신고 | TAX | 3 |
| 9 | 법정 준수 | CMP | 5 |
| 10 | 알림 | NTF | 3 |
| 11 | 구독 | SUB | 5 |
| 12 | 시스템 관리 | SYS | 7 |
| 13 | 개인정보·위치정보 | PRV | 2 |
| — | 운영 요약 — **도메인 파일이 없다**(데이터를 소유한 도메인 파일에 행으로 등재 · D-23) | DSH | 2 |

검산: 10 + 13 + 11 + 12 + 5 + 13 + 7 + 3 + 5 + 3 + 5 + 7 + 2 + 2 = **98**.

- **접두사는 14종이고 문서 도메인은 13이다.** DSH는 도메인을 세우지 않는다 — DSH-03은 [../02_features/06_payroll.md](../02_features/06_payroll.md), DSH-06은 [../02_features/02_workplace.md](../02_features/02_workplace.md)에 행으로 있다. **DSH 기능의 요구사항 ID는 그 행을 담은 요구사항 파일의 접두사로 채번한다** — 요구사항 파일도 도메인 단위이고 접두사별 연속 채번(결번 없음)이 파일 단위로 성립해야 하기 때문이다.

## 요구사항 ID (REQ-*)

- 도메인 접두사는 기능 접두사와 같다. 횡단 전용 접두사 3종 — **REQ-GLB**(전역 규칙) · **REQ-NFR**(비기능 — 성능·접근성·렌더링/SEO) · **REQ-TEC**(기술·운영).
- REQ의 우선순위는 그 REQ가 속한 기능의 우선순위를 승계한다. 어긋나면 02_features가 정본이다.
- 에러 코드·상태 머신은 REQ 본문이 참조만 하고 채번·정의는 각 정본([02_error_codes.md](./02_error_codes.md) · [03_enums_state_machines.md](./03_enums_state_machines.md))에 둔다.

## 화면 코드

- 형식은 {표면}-{의미}다. 끝 토큰은 순번이 아니라 **의미형**이다(APP-CHECKIN이지 APP-01이 아니다).
- 표면 접두사 4종:

| 접두사 | 표면 | 저장소 |
|--------|------|--------|
| PUB | 공개 웹(미인증 — 랜딩·요금제·약관·인증 화면) | web_front — 랜딩·요금제는 **빌드 프리렌더 정적**, 약관·인증 4본은 **SPA**(D-20) |
| APP | 직원 앱 | app_front |
| ADM | 관리자 웹(사업장 운영) | web_front SPA |
| SYS | 시스템 웹(플랫폼 관리) | web_front SPA |

- **표면은 산출물 축이지 라우트 폴더 규약이 아니다.** web_front는 단일 앱이며 산출물은 프리렌더 정적 HTML과 SPA 번들 둘뿐이다 — 표면을 라우트 그룹으로 표기하지 않는다(D-20).
- 화면 문서의 라우트 표기는 **{산출물} {경로}** 형식으로 통일한다 — web_front 정적 /pricing · web_front SPA /system/audit-logs. 정본은 [../07_screen/README.md](../07_screen/README.md)다.
- 화면 코드는 논리 단위이며 물리 라우트와 1:1이 아니다. 라우트 없는 오버레이·모달도 독립 기능군을 담으면 화면 코드를 가진다.
- 화면 내 요소(H3 블록)는 화면 코드를 갖지 않는다 — 화면 수 집계는 H2 블록만 센다.

## 에러 코드

- 형식은 {domain}.{snake_case}이며 HTTP 상태와 함께 표기한다. **네임스페이스는 소문자**다(기능 접두사의 대문자와 표기 축이 다르다).
- 채번 정본은 [02_error_codes.md](./02_error_codes.md) **120종 · 16네임스페이스**이며, [../06_api/02_errors.md](../06_api/02_errors.md)는 미러다. 미러에서 신설·개명·폐기하지 않는다. 폐기 2종은 전수에서 제외하고 재사용을 금지한다.
- 403(적용 대상 아님 — 정상 상태)과 422(전제 미충족 — 조치 가능)를 구분한다. 상세는 REQ-GLB-19.

## 테이블·컬럼·DB 객체

- 테이블·컬럼·enum 타입·함수·트리거·인덱스·제약은 snake_case 평문으로 표기한다(백틱 금지).
- 테이블에는 **전역 테이블 번호**(1~58)를 부여한다 — 05_database 도메인 파일의 테이블 목록 표와 명세 H3 제목이 공유한다. 신설 테이블은 기존 번호를 밀지 않고 맨 뒤 번호를 받는다.
- RLS 헬퍼·트리거 함수 등 DB 객체의 정본은 [../05_database/09_functions_triggers.md](../05_database/09_functions_triggers.md)다.

## 마이그레이션

- db_migration/V{NNNN}__{name}.sql — 저장소 루트 · V + 4자리 번호 + 언더스코어 2개 + snake_case 이름.
- 번호 구간 배치(0001 extensions ~ 07xx integrity)의 정본은 [../05_database/10_migrations_seed.md](../05_database/10_migrations_seed.md)다.

## 기타 식별자

| 종류 | 형식 | 비고 |
|------|------|------|
| 멱등키 | **축이 둘이다** — 요청 축(idempotency_records)과 도메인 자연 중복 방지 축(각 도메인 테이블). 형식의 정본은 **REQ-GLB-14**([../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md))이며 여기서 다시 정의하지 않는다 | Idempotency-Key 필수 **10표면**의 계약은 [../06_api/01_conventions.md](../06_api/01_conventions.md) 멱등 절 · 테이블 명세는 [../05_database/17_infra.md](../05_database/17_infra.md) |
| 정기작업 이름 | camelCase 동사구 | expireInvitations · rollupAttendanceDaily — 정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) |
| 기준값 카테고리 | SCREAMING_SNAKE | MIN_WAGE · TAX_TABLE · ROUNDING_POLICY — 정본 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.3 |
| 요금제 등급 | 대문자 | FREE · PRO · ULTRA |
| 역할 값 | 대문자 | OWNER · MANAGER · STAFF / VIEWER · SUPPORT · ADMIN · SUPER_ADMIN |

## 관련 문서

- 전역 고정 기준·표기 규약 → [../README.md](../README.md)
- 작성·검수 지침 → [../CLAUDE.md](../CLAUDE.md)
- 에러 코드 전수 정본 → [02_error_codes.md](./02_error_codes.md)
- enum·상태 머신 정본 → [03_enums_state_machines.md](./03_enums_state_machines.md)
