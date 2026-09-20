# 04_architecture — 시스템 아키텍처

> **대상**: insadesk v1 — 시스템 구조 · 인증/세션 · 멀티테넌시/RLS · 요청 흐름 · 렌더링/SEO · 급여 엔진 · 정기작업 · 배포 · 기술결정(ADR) · 실시간/파일의 설계 정본
> **작성일**: 2026-08-03
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — 고정 기준의 컨테이너 행 nestjs → **backend** · 스택 표기 행 NestJS → **Spring Boot** · **ADR 24건/유효 21 → 29건/유효 23**(검산 29 − 6 = 23) · 파일 목차와 도입의 ADR-01~24 → **ADR-01~29** · 아키텍처 불변식의 세션 컨텍스트 강제 지점을 **DataSource 프록시**축으로 재작성
> **개정일**: 2026-08-19 — 고정 기준의 세션 컨텍스트 변수 3 → **5종** 정정([03_multitenancy_rls.md](./03_multitenancy_rls.md) 정본 동기화)
> **개정일**: 2026-08-08 — 외부 의존을 v1 호출 지점 기준 3 → **2종**(국세청 진위확인 · SMTP)으로 정정(01_system_architecture.md 정본 동시 갱신 · FCM은 이월 부정형)
> **개정일**: 2026-08-08 — 웹 프론트엔드 전환(D-20 · ADR-24) 반영. 고정 기준의 웹 산출물·스택 표기 행 갱신, 라우트 보호 어휘를 클라이언트 가드로 치환, ADR 총수 23 → **24**(유효 21)
> **원천**: 확정 결정 D-01~D-06(D-01·D-04는 **D-20**으로 대체 · D-02는 수단 개정) · **D-20** · **D-21**(D-05는 **D-21**로 대체 · D-06은 표기 개정)([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) · docs_ref2/features.md(전 기능 공통 제약 · 정기작업 · 권한 모델) · docs_ref2/requirements_p0.md(REQ-GLB 전역 규칙 · 상태 머신 · 에러 규약) · docs_ref2/schema_p0.md(RLS 2단 방어 · 타입 매핑 · 마이그레이션 배치)

insadesk의 **전체 시스템 구조와 설계 원칙**을 담는 폴더다. 웹(web_front)은 React + Vite 단일 애플리케이션이며 그 빌드 산출물을 Vercel이 배달하고, API·데이터베이스·캐시(backend — Spring Boot + PostgreSQL 18)는 AWS EC2 단일 인스턴스의 Docker Compose에서 실행되며, 직원 앱(app_front)과 브라우저가 같은 REST 표면을 공유한다. 파일은 서울 리전 S3에 두고 외부 의존은 국세청 사업자 진위확인 API · SMTP(메일) 둘이다 — 푸시(FCM)는 v1에 호출 지점을 두지 않는다(NTF-02 이월).

**단일 웹 앱과 공개 페이지 프리렌더** · **서브도메인 직접 호출과 상위 도메인 쿠키** · **인증 후 클라이언트 조회 단일화** · **서비스 검증 + RLS 2단 방어** · **결정론 급여 계산과 확정 값 동결** · **시각 트리거 정기작업 8건** · **SSE 단방향 실시간** · **기술결정 ADR-01~29**를 하나의 청사진으로 묶는다.

본 폴더는 **to-be 설계 정본**이다. 근거는 실측이 아니라 원천 문서와 확정 결정(D-NN · ADR-NN)이며, 구현이 진행되면 as-built로 승격한다.

---

## 파일 목차

| 파일 | 내용 |
|------|------|
| [01_system_architecture.md](./01_system_architecture.md) | 시스템 조감도 · 컴포넌트 구성 · 계층 책임 · 핵심 설계 원칙 · 횡단 관심사 · 범위 경계 |
| [02_authn_session.md](./02_authn_session.md) | 웹 세션과 앱 토큰의 이중 축 · 로그인 판정 순서 · 진입 판정 · 라우트 보호 · 재인증 · 세션 폐기 · **rate limit 정본** |
| [03_multitenancy_rls.md](./03_multitenancy_rls.md) | 3층 권한 모델 · 2단 방어 · 세션 컨텍스트 주입 계약 · 본인 소유권 인가 · 사업장 전환 격리 · 정책 부재의 설계 |
| [04_request_data_flow.md](./04_request_data_flow.md) | 조회 흐름과 쿼리 키 규약 · 무효화 전략 · 변이 흐름과 낙관적 갱신 금지 목록 · 에러 규격 흐름 · 앱 동일 축 · SSE 수신 |
| [05_rendering_seo.md](./05_rendering_seo.md) | **렌더링 모드 결정 표** · 프리렌더 계약 · SEO 계약 · 성능 예산 · 공개·보호 경로와 라우트 가드 계약 |
| [06_payroll_engine.md](./06_payroll_engine.md) | 계산 파이프라인 8단 · 재현성 계약 · 기준값 조회 계약 · 값 동결 · 확정과 정정 체인 · 골든 케이스 회귀 |
| [07_batch_scheduling.md](./07_batch_scheduling.md) | 정기작업 8건 실행 구조 · 분산락 · 멱등 계약 · 실패 처리 · KST 경계 · v1 미채택 작업의 대체 절차 |
| [08_deployment_topology.md](./08_deployment_topology.md) | 배포 흐름 · EC2 Compose 구성 · 도메인/TLS · 마이그레이션 실행 순서 · 백업과 복구 · 환경 분리 · 모니터링/로그 |
| [09_decision_records.md](./09_decision_records.md) | **기술결정 ADR-01~29**(채번 유일 정본) |
| [10_realtime_files.md](./10_realtime_files.md) | SSE 계약과 Redis 팬아웃 · S3 저장 구조 · 업로드 검증 순서 · 1회용 토큰 다운로드 · 명세서 PDF 파이프라인 |

---

## 고정 기준

**전역 고정 기준의 정본은 [../README.md](../README.md)다.** 본 폴더는 그 값을 동일하게 인용하며, 어긋나면 정본이 우선한다. 아래는 본 폴더가 자주 인용하는 값과 **본 폴더가 정본인 값**을 구분한 표다.

| 항목 | 값 | 정본 |
|------|-----|------|
| 클라이언트 표면 | **3표면 + 공개 웹** — 직원 앱 · 관리자 웹 · 시스템 웹 · 공개 페이지 | [../README.md](../README.md) |
| 웹 산출물 | **단일 Vite SPA + 공개 페이지 프리렌더 2본**(랜딩 · 요금제). 산출물 한 벌 · 배포 프로젝트 1개 · 웹 오리진 1개(D-20) | [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) |
| 컨테이너 | **4종** — nginx · backend · postgres · redis. 검산: 1 + 1 + 1 + 1 = **4** | 본 폴더([08_deployment_topology.md](./08_deployment_topology.md)) |
| 정기작업 | v1 필수 **8건** | [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) |
| 세션 컨텍스트 변수 | **5종** — 현재 사용자 · 시스템 컨텍스트 · 트랜잭션 컨텍스트 3(초대 수락 · 사업장 폐쇄 · 사업자 재검증). 검산: 1 + 1 + 3 = **5** | 본 폴더([03_multitenancy_rls.md](./03_multitenancy_rls.md)) |
| 미인증 공개 경로 | **9종** — 랜딩 · 요금제 · 약관 문서 3 · 로그인 · 회원가입 · 비밀번호 재설정 · 가입 동의 | 본 폴더([05_rendering_seo.md](./05_rendering_seo.md)) |
| rate limit 축 | **7축** — 로그인 실패 · 비밀번호 재설정 · 아이디 중복 확인 · 재인증 · 사업자 진위확인 · 다운로드 토큰 발급 · 인증 후 일반 API | 본 폴더([02_authn_session.md](./02_authn_session.md)) |
| 시간 버킷 | 상호배타 **8버킷** | [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md) |
| 정적 분석 규칙 | 프로젝트 고유 **4종** | [../08_tech_stack/05_tooling_devops.md](../08_tech_stack/05_tooling_devops.md) |
| **ADR** | **29건**(ADR-01~29 · 결번 없음). ADR-01 · 03 · 04는 ADR-24로, **ADR-06 · 07 · 19는 각각 ADR-27 · ADR-28 · ADR-29로** 대체돼 이력으로 남고 **유효 결정은 23건**이다. 검산: 29 − 대체 6 = **23** | 본 폴더([09_decision_records.md](./09_decision_records.md)) |
| 성능 예산 | 공개 페이지 LCP 2.5초 · CLS 0.1 · INP 200밀리초 | 본 폴더([05_rendering_seo.md](./05_rendering_seo.md)) · 수치는 [../03_requirements/15_nonfunctional.md](../03_requirements/15_nonfunctional.md)와 동일 |
| 스택 표기 | React · Vite · React Router · **Spring Boot** · PostgreSQL 18 · React Native. **정확 버전은 재기재하지 않는다** | [../08_tech_stack/README.md](../08_tech_stack/README.md) |

---

## 아키텍처 불변식

설계 의도를 문장으로 두지 않고 **구조가 강제하도록** 만든 지점들이다. 왼쪽이 지켜야 할 사실이고 오른쪽이 그것을 물리적으로 지키는 자리다.

| 불변식 | 강제 지점 |
|--------|-----------|
| 애플리케이션은 판정하고 데이터베이스가 최종 방어한다 | 전 업무 테이블 RLS 활성 + 강제 옵션 · 애플리케이션 롤의 비소유·우회 불가 속성 · 변경 영향 행 수 확인 |
| 세션 컨텍스트를 빠뜨린 쿼리는 데이터를 보지 못한다 | **DataSource 프록시**의 사용자 식별자 트랜잭션 진입 주입 + 트랜잭션 지역 설정 · 모든 업무 쿼리에 트랜잭션 경계 요구 · 프록시 밖 연결·영속성 컨텍스트·SQL 세션 획득 차단(ArchUnit) |
| 클라이언트가 보낸 사업장 식별자는 격리의 근거가 되지 않는다 | 활성 사업장을 세션 변수로 두지 않음 · 매 요청 멤버십·역할 재검증 · 정책이 행의 사업장 열로 평가 |
| 퇴사·폐쇄가 본인 법정문서 열람을 끊지 못한다 | 명세서·근로계약·급여이력의 인가를 멤버십이 아닌 소유권 헬퍼로 평가 |
| 급여 계산은 실행 환경을 볼 수 없다 | 값 객체 입출력의 순수 함수 계층 격리 + 시각·난수 접근 차단 정적 분석 규칙 |
| 확정된 급여와 명세서는 덮어쓸 수 없다 | 확정 결과에 갱신 정책 부재 · 원본 무효화 후 정정본 신규 생성 체인 · 확정 시 값 동결 |
| 기준값이 없으면 금액이 나오지 않는다 | 계산 차단 응답(전제 미충족) · 확인자 미기입 행을 미확인으로 간주 · 시드에 미확인 값 미포함 |
| 파일 링크만으로는 아무것도 열리지 않는다 | 전 버킷 비공개 · 서명 URL의 서버 내부 격리 · 1회용 다운로드 토큰 + 서버 스트리밍 |
| 정기작업은 두 번 돌아도 결과가 같다 | 작업 이름별 분산락 · 멱등키와 부분 유일 제약 · 수렴형 갱신 · 재시도 상한 후 종결 처리 |
| 클라이언트 번들에 서버 시크릿이 없다 | 공개 접두 환경변수만 번들 포함 · 서버 전용 변수 참조 차단 규칙 · 앱에는 시크릿 미포함 |

---

## 관련 문서

- 문서 지도·전역 고정 기준 → [../README.md](../README.md)
- 제품·범위 결정 정본 → [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)
- 요구사항 정본 → [../03_requirements/README.md](../03_requirements/README.md)
- 데이터베이스 정본 → [../05_database/README.md](../05_database/README.md)
- API 정본 → [../06_api/README.md](../06_api/README.md)
- 기술 스택·버전 정본 → [../08_tech_stack/README.md](../08_tech_stack/README.md)
- 용어·에러 코드·ID 규약 → [../09_glossary/README.md](../09_glossary/README.md)
- 보안 정본 → [../10_security/README.md](../10_security/README.md)
