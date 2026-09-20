# insadesk 설계 문서군 (docs)

> **대상**: insadesk 재구축 v1 설계 정본 — 개요·기능·요구사항·아키텍처·데이터베이스·API·화면·기술스택·용어·보안
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **API 표면 258 → 267**(REST 230 → **238** · 다운로드 6 → **7**) — 목록 내보내기 발급·다운로드 3(04_workplace #35 · #36 · 14_system #36) · 프로필 수정 1(03_auth #17) · 근태·휴가 일괄 승인·반려 4(06_attendance #28 · #29 · 07_leave #16 · #17) · 인건비 추이 1(08_payroll #30). 정본 [06_api/README.md](./06_api/README.md). 요구사항 274 → **281**(정본 [03_requirements/README.md](./03_requirements/README.md)). **에러 코드 120 · 테이블 61 · enum 33/132 · RLS 173 · 화면 55는 불변**이다 — 보안 이벤트 종류와 감사 액션은 text CHECK · 가드 배열 · ALTER POLICY라 수치 축이 움직이지 않는다(V0739 · V0740)
> **개정일**: 2026-09-16 — **v1 범위 94 → 98기능**(D-23 — AUT-05 프로필 관리 · ATT-10 실시간 근태 현황 · DSH-03 인건비 추이 · DSH-06 리포트 내보내기 채택 · 정본 [02_features/README.md](./02_features/README.md) · [01_overview/02_goals_scope.md](./01_overview/02_goals_scope.md)) · 제품결정 D 22 → **24건**(D-23 범위 확장 · D-24 콘텐츠 영역 뷰포트 고정). **DSH는 문서 도메인이 아니다** — 데이터를 소유한 도메인 파일에 행으로 등재해 문서 도메인 13을 유지한다. API 표면 · 화면 · 테이블 수의 변동은 각 정본 개정 단위에서 따로 적는다
> **개정일**: 2026-09-10 — 인용 갱신 — 에러 코드 119 → **120종**(workplace.mgmt_no_required/422 신설 — 신고자료의 빈 관리번호 계열. 채번 정본 [09_glossary/02_error_codes.md](./09_glossary/02_error_codes.md)). **16네임스페이스는 불변**이다 — 발생 표면은 TAX 이지만 부재한 값이 사업장의 것이라 workplace 가 갖는다
> **개정일**: 2026-09-10 — **API 표면 256 → 258**(REST 228 → **230**) — [06_api/14_system.md](./06_api/14_system.md)가 표면 2건을 채번했다(그 문서 표면 33 → **35**). **#34 POST /v1/system/jobs/{job}/rerun**(정기작업 재실행)과 **#35 GET /v1/system/terms-documents/{termsDocumentId}**(약관 문서 단건 전문)이며 **에러 코드도 권한 키도 신설하지 않는다** — 락 경합은 common.conflict/409 · 문서 부재는 common.not_found/404 · 권한은 settings:update 다. 감사 action 코드 **scheduled_job.rerun** 1종을 채번했다(정본 [05_database/15_system.md](./05_database/15_system.md) · 그 밖의 축 6 → **7** · 전수 57 → **58**). **#34는 기능ID를 신설하지 않는다** — 정기작업이 94기능 집계 밖이라 표면 표의 기능 열이 정본 [02_features/15_scheduled_jobs.md](./02_features/15_scheduled_jobs.md)를 가리키고 **화면 자리는 SYS-RATES 운영 절**이므로 **기능 94 · 화면 55는 불변**이다. **화면 55 · 테이블 61 · 정책 173 · enum 33/132 · 정기작업 8 · D 22 · ADR 29는 전건 불변**
> **개정일**: 2026-09-10 — **디자인 토큰 표 정본 신설**([08_tech_stack/07_design_tokens.md](./08_tech_stack/07_design_tokens.md)) — 08_tech_stack/02·06이 "값의 출처는 디자인 토큰 표 하나"로 참조만 하고 실체가 없던 상태를 닫는다. 원시 41색 · 시맨틱 54쌍(라이트/다크) · 대비 검산 45쌍 · 타이포 7단 · 표 밀도 3단 · 대응표. 문서 지도 08 행 갱신. **화면 55 · 기능 94 · API 표면 256 · 테이블 61 · 정책 173 · D 22 · ADR 29는 전건 불변**
> **개정일**: 2026-09-10 — **화면 54 → 55본**(ADM 30 → **31**) — 관리자 웹 홈 대시보드 **ADM-HOME 신설**(정본 [07_screen/README.md](./07_screen/README.md) 인벤토리 #21 · 소속 파일 07_screen/06_admin_workplace_hr.md). **새 기능ID를 채번하지 않는다** — 기존 8기능에 표시 수식어로만 붙으므로 **기능 94는 불변**이고 조회 표면도 전부 기존 것이라 **API 표면 256도 불변**이다. 함께 **제품결정 D 21 → 22건**(D-22 탭 워크스페이스 채택 — 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md)). **테이블 61 · 정책 173 · enum 33/132 · 에러 코드 119 · 정기작업 8 · ADR 29는 전건 불변**
> **개정일**: 2026-09-10 — 인용 갱신 — 시스템 콘솔 **#10 보조 비밀번호 재설정의 대행 방식 확정**(복구 이메일 대리 등록 — 표면 정본 [06_api/14_system.md](./06_api/14_system.md))으로 서버 함수 **issue_assisted_password_reset**이 신설돼 헬퍼 42 → **43종** · DB 함수 103 → **104**(트리거 61 불변) · 실측 pg_proc 104 → **105**. 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md) 헬퍼 #44. **정책 173 · 테이블 61 · enum 33/132 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-09 — **API 표면 255 → 256**(REST 227 → **228**) — [06_api/11_compliance.md](./06_api/11_compliance.md)의 기한 과제 전이가 **PATCH 하나에서 POST 둘**로 갈렸다(#9 폐지·결번 · **#14 /complete** · **#15 /waive**). **문서 안의 내부 모순을 없앤 것**이며 근거는 [06_api/01_conventions.md](./06_api/01_conventions.md)의 두 문장이다 — 상태 전이는 전부 POST이고 PATCH { status }로 전이하지 않는다. 갈린 이유는 **전이마다 요구 입력이 다르다**는 것이다(면제만 사유 필수). 고정 기준 표에 **API 표면 행을 신설**한다 — 이 수치를 루트 CLAUDE.md가 인용하는데 본 표에 자리가 없어 **인용처는 있고 정본 행이 없는 상태**였다. **테이블 61 · PK 61 · 정책 173 · enum 33/132 · 기능 94 · 화면 54 · 에러 코드 119 · 정기작업 8은 전건 불변**
> **개정일**: 2026-09-09 — 인용 갱신 — **V0726**(시스템 콘솔 제재 표면의 서버 함수 3종 — 계정 정지·해제 · 최근 급여 확정 시각)으로 DB 함수 100 → **103**(헬퍼 39 → **42** · 트리거 61 불변) · 실측 pg_proc 101 → **104**. **V0727**은 #26 workplace_members_select에 서버 배치 축을 결합한 ALTER POLICY라 수치를 바꾸지 않되 **읽기 축의 넷째 종류(산출물 수신자 열거)**를 드러냈다. 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md) #41~#43 · 읽기 축 절. **테이블 61 · PK 61 · 유일성 60 · 정책 173 · enum 33/132 · 기능 94 · 화면 54 · 에러 코드 119는 전건 불변**
> **개정일**: 2026-09-08 — 인용 갱신 — **V0720**이 attendance_breaks에 DELETE 정책을 신설해 RLS 정책 172 → **173** · DELETE 정책 4 → **5**. 술어가 **is_auto인 행만 · 서버 컨텍스트에서만**이라 직원이 기록한 휴게는 지워지지 않는다. 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md) #173. **테이블 61 · PK 61 · 유일성 60 · DB 함수 100 · enum 33/132 · 기능 94 · API 표면 255 · 화면 54 · 에러 코드 119는 전건 불변**
> **개정일**: 2026-09-07 — 인용 갱신 — **V0716**으로 DB 함수 99 → **100**(헬퍼 38 → **39** · 트리거 61 불변). 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md) #40. **테이블 61 · 정책 172 · PK 61 · 유일성 60 · enum 33/132 · 기능 94 · API 표면 255 · 화면 54 · 에러 코드 119는 전건 불변**
> **성격**: to-be 설계 정본이다. 구현 착수 전 상태이며, 구현이 진행되면 각 문서를 as-built(구현 정합)로 승격·실측 갱신한다
> **개정일**: 2026-09-07 — **V0711 · V0712** 적용 반영 — 테이블 60 → **61종**(idempotency_records 신설 — 멱등키 계약의 저장 자리. 정본 [05_database/README.md](./05_database/README.md)) · RLS 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46** · **DELETE 4는 불변**) · 유일성 강제 59 → **60**(부분 UNIQUE 27 → **28**) · PK 60 → **61**. **기능 94 · API 표면 255 · enum 33/132 · 화면 54 · 에러 코드 119 · 정기작업 8 · DB 함수 99 · 가드 55 · EXCLUDE 10은 전건 불변** — V0712는 GRANT · 함수 본문 교체 · ALTER POLICY라 수치를 바꾸지 않는다
> **개정일**: 2026-09-07 — 인용 갱신 — 헬퍼 37 → **38종**(사업장 폐쇄 서버 함수 신설 — 보정 V0710. 정본 [05_database/08_rls_policies.md](05_database/08_rls_policies.md)) · DB 함수 98 → **99**. 격리 분류 수치 · 정책 169 · 위협·통제 항목은 전건 불변
> **개정일**: 2026-09-07 — 인증 쓰기 축 서버 함수 신설(보정 **V0709**) 반영 — 헬퍼 32 → **37종** · DB 함수 93 → **98**(신설 6 create_user_credentials · update_user_password · consume_password_reset · issue_password_reset · mark_user_deleted · expired_suspension_user_ids, 폐기 1 request_password_reset. 검산 32 + 6 − 1 = **37**). 실측 pg_proc 94 → **99**(내부 술어 1종 포함). 휘발성 축 5 → **10종**(상태를 바꾸는 9 + 시각 의존 조회 1). 정본 [05_database/08_rls_policies.md](05_database/08_rls_policies.md)
> **개정일**: 2026-09-06 — 실측 정합(로컬 PostgreSQL 18에 db_migration V0001~V0707 전량 적용 후 카탈로그 대조) — DB 함수 92 → **93**(헬퍼 31 → **32** — 보정 V0704·V0706의 append_audit_log 등재. 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md) #32). 테이블 60 · 정책 169 · enum 33/132 · 가드 55 · 유일성 59 · EXCLUDE 10 · PK 60은 **실측 전건 일치**로 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환 반영(스택 표기·마이그레이션 경로·06_api 표면 설명을 Java · Spring Boot 축으로 재작성) · 결정 총수 D 20 → **21** · ADR 24 → **29**(유효 21 → **23**) · 마이그레이션 경로 back/db/migration/ → **db_migration/** · 저장소 폴더 back/ → **backend/**
> **개정일**: 2026-08-21 — 에러 코드 118 → **119종**(workplace.business_unit_overlap/409 신설 — 채번 정본 [09_glossary/02_error_codes.md](./09_glossary/02_error_codes.md))
> **개정일**: 2026-08-20 — 구현 검증 보정 반영 — DB 함수 88 → **92**(헬퍼 27 → **31** — 인증 서버 함수 4종 신설 V0702. 정본 [05_database/08_rls_policies.md](./05_database/08_rls_policies.md))
> **개정일**: 2026-08-08 — 웹 프론트엔드 스택 전환 반영(스택 표기·클라이언트 표면 행을 React · Vite · React Router 축으로 재작성) · 결정 총수 D 19 → **20** · ADR 23 → **24** · v1 범위 산식을 Out 범위 정본 검산과 일치하게 정정
> **원천**: docs_ref2/features.md(전 기능 138) · docs_ref2/features_p0.md(v1 필수 94) · docs_ref2/requirements_p0.md(REQ 244 · 에러 코드 카탈로그 — 유효 117종으로 확정 · 상태 머신) · docs_ref2/schema_p0.md(테이블 58 · enum 32) · 확정 결정 D-01~D-24([01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md))

insadesk는 소상공인(상시 근로자 1~30인)이 노무사·세무사 없이 **근태 → 급여 자동계산 → 명세서 교부 → 법정 신고 자료**까지 직접 마감하도록 돕는 SaaS다. 본 문서군은 재구축 v1의 설계를 목적별 10폴더로 나눠 담는 **단일 정본**이며, 범위는 원천 문서 docs_ref2/features_p0.md가 선정한 **v1 필수 94기능**에 운영 요약·편의 4기능(D-23)을 더한 **98기능**이다.

스택은 React Native 직원 앱(app_front/) · React · Vite · React Router 웹(web_front/, Vercel 배포 — 공개 페이지는 빌드 시점 프리렌더 · 나머지는 단일 페이지 앱) · **Java · Spring Boot 백엔드 + PostgreSQL 18**(backend/, AWS EC2 Docker 배포)이다. 스키마 정본은 루트 db_migration/의 raw SQL이며 적용은 Flyway가 한다(D-21 · ADR-27). 정확한 버전·구성의 정본은 [08_tech_stack](./08_tech_stack/README.md)이다.

## 현재 상태

- 설계 문서군 v1(P0) 범위 작성 완료 기준으로 유지한다(2026-08-03 착수).
- backend/ · web_front/ · app_front/ 는 본 문서군을 정본으로 삼는다 — 문서가 정본이고 저장소가 따라오는 방향이다.
- 웹 프론트엔드 스택 전환은 2026-08-08에 확정됐고(D-20 · ADR-24) 문서 개정을 같은 날 완료했다. 이력·잔여 착수 단서는 [01_overview/05_priorities_roadmap.md](./01_overview/05_priorities_roadmap.md)가 정본이다.
- **백엔드 스택 전환은 2026-09-06에 확정됐다**(D-21 · ADR-25~29) — NestJS · Node.js · Prisma 축을 **Java 25 · Spring Boot 4.1.1 · Spring Data JPA + MyBatis**로 대체하고, 스키마 정본을 루트 db_migration/으로 옮겨 Flyway가 적용한다. 문서 개정을 같은 날 완료했다.
- 잔여 작업·이월(v1.1) 항목의 정본은 [01_overview/05_priorities_roadmap.md](./01_overview/05_priorities_roadmap.md)다.

## 문서 지도

| 폴더 | 내용 | 핵심 독자 |
|------|------|----------|
| [01_overview](./01_overview/README.md) | 제품 요약 · 목표/범위 · 페르소나/역할 · 도메인 지도 · 우선순위/로드맵 · 확정 의사결정(D-NN) | 전원 |
| [02_features](./02_features/README.md) | 도메인별 기능 명세 98개 — **기능ID 채번 정본** · 권한 매트릭스 · 정기작업 | 기획 · 개발 |
| [03_requirements](./03_requirements/README.md) | 요구사항 정본(REQ) — 전역 규칙 · 도메인별 계약 · 비기능 · 인수기준(AC) · 추적성 | 개발 · QA |
| [04_architecture](./04_architecture/README.md) | 시스템 구조 · 인증/세션 · 멀티테넌시/RLS · 렌더링/SEO · 급여 엔진 · 배포 · **ADR 채번 정본** | 개발 |
| [05_database](./05_database/README.md) | 테이블 61종 명세 · ERD · 제약 · RLS · 함수·트리거 · 마이그레이션 | 개발 · DBA |
| [06_api](./06_api/README.md) | Spring REST 표면 명세 — 규약 · 에러(미러) · 도메인별 엔드포인트 | 개발 |
| [07_screen](./07_screen/README.md) | 화면 명세 — **화면 코드 채번 정본** · 표준 · 추적성 · 표면별(공개·앱·관리자·시스템) 화면 | 기획 · 디자인 · 개발 |
| [08_tech_stack](./08_tech_stack/README.md) | 기술 스택과 버전 · 선정 근거 · **디자인 토큰 값 정본**([08_tech_stack/07_design_tokens.md](./08_tech_stack/07_design_tokens.md) — 웹·앱·PDF 세 소비처 공유) | 개발 · 디자인 |
| [09_glossary](./09_glossary/README.md) | 도메인 용어 · **에러 코드 채번 정본** · enum/상태 머신 · **ID 규약 정본** · 단위/시간 | 전원 |
| [10_security](./10_security/README.md) | 인증/인가 · RLS 격리 · 시크릿 · PII 보호 · 위치정보 · 위협모델 · 플랫폼 RBAC | 개발 · 보안 |

## 읽는 순서 (권장)

1. **맥락 잡기** — [01_overview](./01_overview/README.md)에서 제품·범위·역할·확정 결정을 읽는다.
2. **무엇을 만드는가** — [02_features](./02_features/README.md) → [03_requirements](./03_requirements/README.md) 순서로 기능과 동작 계약을 읽는다. 전역 규칙([03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md))을 개별 도메인보다 먼저 읽는다.
3. **어떻게 만드는가** — [04_architecture](./04_architecture/README.md) → [05_database](./05_database/README.md) → [06_api](./06_api/README.md) → [07_screen](./07_screen/README.md).
4. **막히면** — [09_glossary](./09_glossary/README.md)(용어·에러·enum·ID) · [08_tech_stack](./08_tech_stack/README.md) · [10_security](./10_security/README.md).

## 고정 기준 (전 문서 공통 — 수치의 단일 정본)

모든 문서는 아래 수치를 동일하게 인용한다. 수치가 바뀌면 정본을 고친 같은 변경 단위에서 본 표와 파생 집계를 함께 갱신한다.

| 항목 | 기준 |
|------|------|
| 문서 도메인 | **13개** — AUT · WRK · HRM · ATT · LEV · PAY · SLP · TAX · CMP · NTF · SUB · SYS · PRV |
| v1 범위 | **98기능**. 세는 기준은 02_features 도메인 파일의 기능 목록 표 행 수다(DSH 행 포함). 원천은 docs_ref2/features_p0.md — 원천이 검토한 전체 집합 **145**는 원천 선정 당시 94 + v1.1 이월 44 + 영구 제외 7이었고, D-23이 이월 3 · 영구 제외 1을 v1로 옮겨 **98 + 41 + 6 = 145**다. 검산 정본은 [01_overview/02_goals_scope.md](./01_overview/02_goals_scope.md) Out 범위 표이며 결번 산정은 [02_features/README.md](./02_features/README.md)가 정본이다 |
| 도메인별 기능 수 | AUT 10 · WRK 13 · HRM 11 · ATT 12 · LEV 5 · PAY 13 · SLP 7 · TAX 3 · CMP 5 · NTF 3 · SUB 5 · SYS 7 · PRV 2 · DSH 2(도메인 아님 — 02_workplace · 06_payroll 파일의 행). 검산: 10 + 13 + 11 + 12 + 5 + 13 + 7 + 3 + 5 + 3 + 5 + 7 + 2 + 2 = **98** |
| 기능ID 결번 | 결번은 v1 범위 제외(이월·영구 제외)를 뜻한다. 결번·폐지 ID는 재사용하지 않는다 |
| 요구사항(REQ) | 원천 244건을 도메인 파일로 재배치하고 신설분(REQ-NFR · REQ-TEC)을 더한다. **총수 정본은 [03_requirements/README.md](./03_requirements/README.md)** |
| 에러 코드 | **120종 · 16네임스페이스** — 채번 정본은 [09_glossary/02_error_codes.md](./09_glossary/02_error_codes.md), [06_api/02_errors.md](./06_api/02_errors.md)는 미러. 세는 기준은 "v1 서버가 발생시킬 수 있는 유효 코드"이며 폐기 2종은 제외한다(원천 카탈로그 절의 행 수 105와 다른 이유는 정본 문서의 종수 산정 기준 절 참조) |
| 화면 수 | **55본** — PUB 7 · APP 10 · ADM **31** · SYS 7. 검산: 7 + 10 + **31** + 7 = **55**. 정본은 [07_screen/README.md](./07_screen/README.md)의 화면 인벤토리이며, 세는 기준은 화면 명세 H2 블록 수(화면 내 요소 H3 제외) |
| API 표면 | **267**(REST 238 · SSE 1 · 다운로드 7 · 서버 내부 21) — 정본은 [06_api/README.md](./06_api/README.md)의 도메인별 표면 수 표이며, 세는 기준은 **도메인 문서 13본의 표면 요약 표 행 수**다(최대 번호가 아니다 — 폐지 번호는 결번으로 남는다) |
| 테이블 · enum | 테이블 **61종** · enum **33종 · 값 132** — 정본은 [05_database/README.md](./05_database/README.md). 검산: 도메인 7 + 9 + 9 + 6 + 6 + 6 + 3 + 2 + 2 + 2 + 4 + 1 + 4 = **61** · legacy 승계 23 + 신설 10 = **33** |
| DB 강제 구조 | RLS 정책 **173**(SELECT 61 · INSERT 61 · UPDATE 46 · DELETE 5) · DB 함수 **104**(헬퍼 43 + 트리거 61) · 가드 트리거 **55** · 유일성 강제 **60**(UNIQUE 32 + 부분 28) · EXCLUDE **10** · PK **61** — 정본은 [05_database/README.md](./05_database/README.md) 고정 기준 표 |
| 마이그레이션 | **db_migration/V{NNNN}__{name}.sql**(저장소 루트) — 적용은 Flyway이고 배치 정본은 [05_database/10_migrations_seed.md](./05_database/10_migrations_seed.md)다. provisioning/ · seed/ 하위는 Flyway 관리 밖이다 |
| 클라이언트 표면 | **3표면 + 공개 웹** — 직원 앱(app_front, React Native) · 관리자 웹 + 시스템 웹 + 공개 페이지(web_front 단일 산출물 — 공개 페이지 프리렌더 + 단일 페이지 앱, D-20). Vercel 프로젝트 1개 · 웹 오리진 1개다 |
| 사업장 역할 | OWNER ⊃ MANAGER ⊃ STAFF(누적). **ADVISOR는 v1 제외**(WRK-13 이월) |
| 플랫폼 역할 | VIEWER(1) · SUPPORT(2) · ADMIN(3) · SUPER_ADMIN(4) — 사업장 RBAC와 완전 별개 |
| 요금제 | FREE(사업장 1 · 인원 5) · PRO(3 · 15) · ULTRA(5 · 30) |
| 정기작업 | v1 필수 **8건** — 정본은 [02_features/15_scheduled_jobs.md](./02_features/15_scheduled_jobs.md) |
| 결정·인수기준 | 제품결정 D **24건**(D-01~24 · 결번 없음) · 기술결정 ADR **29건**(ADR-01~29 · 결번 없음 · 대체 6건을 뺀 **유효 23건**. 검산: 29 − 6 = 23) · 인수기준 AC **15건** — 정본은 각 채번 문서([01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) · [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) · [03_requirements/16_acceptance_criteria.md](./03_requirements/16_acceptance_criteria.md)) |
| 우선순위 | P0 · P1 · P2 — 98기능 안에서의 구현 순위다(v1 채택 여부와 다른 축). 정의는 [01_overview/05_priorities_roadmap.md](./01_overview/05_priorities_roadmap.md) |
| 단위 | 금액 = bigint 원(KRW) · 기간 = integer 분 · 시각 = timestamptz(UTC 저장 · KST 표시) · 일 경계 = KST |
| 스택 표기 | **React · Vite · React Router · Spring Boot · PostgreSQL 18 · React Native**로 통일한다. 정확 버전 정본은 [08_tech_stack](./08_tech_stack/README.md). Next.js를 현행 스택으로 서술하지 않고(D-20) NestJS · Prisma · Node 런타임도 백엔드 계약으로 서술하지 않는다(D-21) |

## ID·표기 규약

| 종류 | 형식 | 예 | 채번 정본 |
|------|------|-----|----------|
| 기능 ID | {도메인}-NN | AUT-01 · PAY-08 | [02_features](./02_features/README.md) 각 도메인 파일 |
| 요구사항 ID | REQ-{도메인}-NN (전역 REQ-GLB · 비기능 REQ-NFR · 기술운영 REQ-TEC) | REQ-GLB-01 | [03_requirements](./03_requirements/README.md) 각 파일 |
| 화면 코드 | {표면}-{의미} (표면 = PUB · APP · ADM · SYS) | APP-CHECKIN · ADM-PAYROLL-RUN | [07_screen/README.md](./07_screen/README.md) |
| 에러 코드 | {domain}.{snake_case} + HTTP 상태 | payroll.missing_reference_value/422 | [09_glossary/02_error_codes.md](./09_glossary/02_error_codes.md) |
| 기술결정 | ADR-NN | ADR-01 | [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) |
| 제품결정 | D-NN | D-01 | [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) |
| 인수기준 | AC-NN | AC-01 | [03_requirements/16_acceptance_criteria.md](./03_requirements/16_acceptance_criteria.md) |
| 테이블·컬럼 | snake_case | payroll_runs · employees.user_id | [05_database](./05_database/README.md) |
| 마이그레이션 | V{NNNN}__{name}.sql | V0060__payroll.sql | [05_database/10_migrations_seed.md](./05_database/10_migrations_seed.md) |

새 ID는 각 정본 문서에서만 채번한다. 접두사별 01부터 연속 채번하되, **기능ID의 결번은 v1 범위 제외를 뜻하는 의도된 공백**이며 결번·폐지 ID를 재사용하지 않는다. 상세 규약은 [09_glossary/04_id_conventions.md](./09_glossary/04_id_conventions.md)가 정본이다.

## 전역 불변식

전 도메인 계산·설계의 전제다. 상세 계약의 정본은 [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md)(REQ-GLB)다.

| 항목 | 규칙 |
|------|------|
| 멀티테넌트 격리 | 모든 업무 테이블은 workplace_id 스코프다. 서비스 레이어 1차 검증 + PostgreSQL RLS 2차 심층방어의 **2단 방어**로 행 단위 격리를 강제한다. 클라이언트 가드는 보조다 |
| 본인 소유권 인가 | 명세서·급여 결과·근로계약은 멤버십이 아니라 **본인 소유권**으로 인가한다 — 퇴사·사업장 폐쇄 후에도 보존기간 내 본인 열람이 끊기지 않는다(CMP-07) |
| 규모 분기 단일 기준 | 5인·10인 분기의 유일한 근거는 **CMP-01 상시근로자 스냅샷**이다. 규모는 사업장의 고정 속성이 아니라 기준일의 함수다 |
| 규모별 적용 = 화이트리스트 | 근로기준법 시행령 별표 1은 5인 미만에 **적용되는** 조문만 열거한다. 목록에 없으면 미적용이며, 분기는 조문 단위 정책값(CMP-02)으로 관리한다 |
| 계산 결정론 | 급여 계산은 서버 전용 · 룰 기반이다. 동일 입력 = 동일 결과. AI 추론 · 실행 시각 의존 · 부동소수점 누적을 금지한다 |
| 부동소수점 금지 | 금액은 정수(원) · 시간은 정수(분) · 비율은 고정소수점 십진만 쓴다. **IEEE754 부동소수점(float · double · JavaScript number) 연산을 금지한다** |
| 단수 처리 | 항목별 **최종 금액에서 1회만** 적용한다. 지급 = 올림 · 무급공제 = 절사 · 법정공제 = 10원 미만 절사. 최저임금 환산액은 반올림하지 않는다 |
| 기준값 선택 단위 | 연도가 아니라 **귀속 기준일**이다. 간이세액표는 지급일, 국민연금 상하한은 7월 경계다. 요율·세액표·한도는 기준값 테이블(effective date)에서만 조회한다 |
| 기준값 누락 차단 | 필요한 기준값이 하나라도 없으면 계산을 차단한다. 임의 기본값·직전 연도 값 대체를 금지한다 |
| 결과 값 동결 | 확정 시 기준값 행 ID + 실제 값 · 상시근로자 스냅샷 · 정책/규칙 버전을 결과에 **동결 저장**한다. 이력 조회만으로는 재현이 깨진다 |
| 확정 불변·정정 체인 | 확정 결과는 덮어쓰지 않는다. 정정은 원본 VOID → supersedes 연결 정정본 신규 생성으로만 한다 |
| 멱등성·동시성 | 확정·발행·배치·외부 호출은 멱등키로 중복 부수효과를 막고, 경합은 트랜잭션 잠금으로 차단한다 — 멱등성은 경합을 막지 못한다 |
| 권한 분리 | 본인 요청 본인 승인을 차단한다. 본인이 대상자로 포함된 급여의 확정은 **OWNER 전용**이다 — 자기포함 표시 + MANAGER 실행 차단(auth.workplace_forbidden/403) + 감사 기록을 모두 수행한다 |
| 법정 보존 | 유형별 기산일이 다르다 — 근로계약서 = 종료일+3년 · 임금대장 = 마지막 기입일+3년 · 근로자명부 = 퇴직일+3년 · 명세서 = 지급일+3년. 재직 중 만료를 금지한다 |
| 민감정보 | 주민번호·계좌는 AES-GCM 암호화 + HMAC blind-index + 화면 마스킹. 평문 열람은 재인증 + 사유 + 감사 + 서버 1회성 응답이다 |
| 위치정보 | 개인위치정보는 별도 동의가 선행한다. 이용·제공 사실 확인자료를 자동 기록·보존한다(PRV-01) |
| 에러 규약 | {domain}.{snake_case} + HTTP 상태. 403(적용 대상 아님)과 422(전제 미충족)를 구분한다 |
| 책임 한계 | 계산 결과는 참고자료이며 신고·납부의 최종 책임은 사업주에게 있음을 고지한다. 가사사용인·동거친족 사업의 적용 제외를 온보딩에서 고지한다 |

## 문서 작성 규약

- 폴더 인덱스는 README.md, 세부 파일은 NN_snake_case.md 번호 접두다.
- 전 문서 공통 골격 — H1 → blockquote 메타(대상 · 작성일 · 개정일 누적 · 원천) → 도입 단락 → H2 섹션 → 마지막 H2는 관련 문서.
- **인라인 백틱을 쓰지 않는다.** 코드·식별자·경로·테이블/컬럼명은 평문 또는 굵게 표기하고, 여러 줄 펜스 코드 블록만 허용한다.
- 문체는 한국어 "~한다" 평서체 현재형이다. 열거 구분자는 가운뎃점( · )이다.
- 개수를 쓰면 그 자리에서 항목을 세어 검산식을 남긴다.
- 링크는 상대경로·실존 파일만 쓴다. 저장소 코드 경로(backend/ · web_front/ · app_front/ · db_migration/)는 평문으로 표기한다. 외부 URL은 [03_requirements/18_official_references.md](./03_requirements/18_official_references.md)에만 둔다.
- 작성·수정·검수 절차의 정본은 [CLAUDE.md](./CLAUDE.md)다.

## 관련 문서

- 작성·검수 지침 → [CLAUDE.md](./CLAUDE.md)
- 확정 의사결정 정본 → [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md)
- 잔여 작업·로드맵 정본 → [01_overview/05_priorities_roadmap.md](./01_overview/05_priorities_roadmap.md)
- ID 채번 상세 정본 → [09_glossary/04_id_conventions.md](./09_glossary/04_id_conventions.md)
