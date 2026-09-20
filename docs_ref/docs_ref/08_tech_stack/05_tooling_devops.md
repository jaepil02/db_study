# 05 툴링·DevOps

> **대상**: insadesk 저장소 구성 · 코드 품질 · 테스트 · 타입 생성 · CI/CD · 환경변수 · 로컬 개발 환경
> **작성일**: 2026-08-03
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 전면 개정. 패키지 관리 절을 **표면별 축 분기**(backend = Gradle · web_front와 app_front = npm)로 재작성 · 코드 품질 절의 TypeScript · ESLint · typescript-eslint · Prettier 행을 **web_front · app_front 전용**으로 한정하고 backend 축(컴파일러 옵션 · ArchUnit · 컴파일 시점 정적 분석 · 포매터) 신설 · 정적 분석 규칙의 Prisma 우회 차단 → **RLS 우회 차단**(판정 축만 Java로 이동 · 검산 **4** 유지) · 테스트 절 backend를 Vitest → **JUnit 5 + AssertJ + Testcontainers**(ADR-29) · 스크립트 이름 5종 공유 규약을 **Gradle 태스크 축 분기**로 재작성 · OpenAPI 파이프라인 ① 단계를 springdoc 산출로 · CI/CD 게이트를 **의존성 해석 → 컴파일 → 정적 분석 → 테스트**로(ADR-20 개정) · 마이그레이션 실행 단계를 애플리케이션 프로세스 밖 선행 단계로(ADR-27) · 경로 back/ → **backend/**
> **개정일**: 2026-08-19 — 스크립트 이름 행에 app_front 예외 1문장 추가(dev·build 대신 React Native CLI 축 · 검증 3종만 공유)
> **개정일**: 2026-08-08 — 웹 전환(D-20 · ADR-24)과 실측 검증 반영. TypeScript 7.0 → **6.0.x** · ESLint를 표면별로 분기(웹·백 10 / 앱 9) · 버전 고정 정책의 프레임워크 축 갱신 · 시크릿 노출 차단 규칙의 접두를 NEXT_PUBLIC → **VITE_**로 · web_front 빌드 명령 명시 · 저장소 실측과의 불일치 각주 신설
> **원천**: docs_ref2/requirements_p0.md(REQ-GLB-01 결정론 재현 검증 · 골든 케이스) · docs_ref2/schema_p0.md(역직렬화 스모크 테스트) · 확정 결정 **D-21**(백엔드 스택 전환) · D-20(웹 프론트엔드 전환 · Vercel 1프로젝트) · D-03(서브도메인) · D-06(저장소 3분할) · 기술결정 **ADR-29**(테스트 러너) · ADR-09 · 10 · 18 · 20 개정분 · 2026-08-08 시점 각 도구 최신 안정판 실측(웹·앱 축)

개발·검증·배포 도구 구성을 고정한다. 저장소는 backend/ · web_front/ · app_front/ **3개**이며(D-06) **패키지 관리 축이 표면별로 갈린다** — backend/는 Gradle 단일 프로젝트이고, web_front/ · app_front/ 는 각각 별도 package.json과 별도 package-lock.json을 가진 독립 npm 패키지다.

## 패키지 관리

| 항목 | 내용 |
|------|------|
| 패키지 매니저 | **표면별로 갈린다.** backend/는 **Gradle**(구현 착수 시점 최신 안정판 고정)이고 web_front/ · app_front/ 는 **npm 11**(Node.js 24 LTS 동봉)이다. npm 축은 package-lock.json을 커밋하고 로컬 설치는 npm install · CI와 배포는 **npm ci**로 락 파일 그대로 재현한다. Gradle 축은 **래퍼로 빌드 도구 버전을 고정**하고 **의존성 잠금 파일을 커밋**해 같은 재현성을 만든다. 별도 패키지 매니저를 설치하지 않으므로 corepack 버전 고정 축이 없다 |
| 저장소 구성 | backend/ · web_front/ · app_front/ **3개 독립 패키지**다(D-06). npm workspaces로 묶지 않는다 — **런타임이 갈려 하나로 묶을 여지 자체가 사라졌고**, 호이스팅 문제는 이제 웹과 앱 둘 사이에서만 성립한다(ADR-09 개정). 스키마 정본 db_migration/이 저장소 루트에 있으나 빌드·배포 단위가 아니라 **네 번째 패키지가 아니다**(ADR-27) |
| 근거 | 백엔드가 JVM 축이라 프런트 두 표면과 같은 패키지 매니저에 얹을 방법이 없고, 억지로 맞추려면 빌드를 감싸는 얇은 스크립트 계층을 하나 더 유지하게 된다. 웹·앱 쪽에서 npm은 Node.js 동봉이라 별도 설치·버전 관리(corepack) 축이 없고 CI·온보딩이 한 단계 줄어든다. workspaces로 묶으면 공유 코드를 담을 네 번째 패키지 폴더가 생겨 확정된 3폴더 구조가 깨지고, 루트로 호이스팅된 공용 node_modules가 표면의 의존성 경계를 흐리며 React Native Metro의 루트 해석 특례까지 함께 관리해야 한다. 계약 공유는 OpenAPI 타입 생성으로 대체한다. 채번·논증 정본은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) |
| 스크립트 이름 | **web_front/ 와 app_front/ 는 npm 스크립트 이름을 공유하고 backend/ 는 Gradle 태스크 축으로 갈린다.** npm 축의 이름은 npm run dev · npm run build · npm run lint · npm run typecheck · npm run test **5종**이며, **app_front만 dev·build 대신 React Native CLI 축(npm run start · npm run ios · npm run android)을 쓰고 검증 3종(lint · typecheck · test)만 공유한다**. backend/ 에는 dev·build·typecheck에 대응하는 npm 스크립트가 없다 — 실행·빌드·컴파일이 전부 Gradle 태스크이고, 검증 3종의 자리는 **컴파일 · 정적 분석 · 테스트 태스크**가 대신한다. **한 벌로 유지하는 것은 스크립트 이름이 아니라 CI 워크플로의 단계 이름**이다(ADR-29 파급) |
| 버전 고정 | 프레임워크 축(Vite · React Router · React · React Native · **Spring Boot**)은 정확 버전이다. 백엔드의 나머지 라이브러리는 **Spring Boot 관리 버전**을 따르고 관리 대상 밖만 명시 고정하며, 프런트의 그 외 의존성은 캐럿 범위다 |
| 사설 레지스트리 | 쓰지 않는다. 전 의존성이 공개 레지스트리(npm 레지스트리 · Maven Central) 패키지다 |

**저장소 실측과의 불일치는 전환 첫 커밋에서 정리한다.** backend/는 전환 이전 스캐폴드 상태이고, web_front/ · app_front/ 도 스크립트 5종·타입스크립트·정적 분석 버전이 본 문서 선언과 다르다. 문서가 정본이고 저장소가 따라오는 방향이며, 착수 첫 작업으로 선언 의존성을 실제 설치해 타입 매핑 스모크 테스트와 RLS 격리 테스트를 먼저 돌린다 — 본 폴더의 실측 표기는 패키지 버전 대조까지만 유효하고 동작 검증을 뜻하지 않는다.

## 코드 품질

| 항목 | 적용 표면 | 버전 | 내용 |
|------|----------|------|------|
| **컴파일러 옵션** | backend | Java 25 | 경고를 빌드 실패로 올린다 — 미검사 변환·폐기 예정 API 경고를 남긴 채 통과시키지 않는다. 미리보기 기능을 켜지 않는다 |
| **구조 검사** | backend | ArchUnit(구현 착수 시점 최신 안정판 고정) | 모듈 경계 · 4계층 · 주입 우회 · 읽기 축 쓰기 구문을 검사한다([03_backend.md](./03_backend.md)) |
| **컴파일 시점 정적 분석** | backend | 구현 착수 시점 최신 안정판 고정 | 부동소수점 유입과 시각·난수 접근을 컴파일 단계에서 판정한다. 도구 하나를 골라 규칙을 추가하는 방식으로 두고 검사기를 여럿 겹치지 않는다 |
| **코드 포매터** | backend | 구현 착수 시점 최신 안정판 고정 | 포매팅 단일화. 검증 태스크에 걸어 형식 논쟁을 리뷰에서 없앤다 |
| **TypeScript** | web_front · app_front | 6.0(6.0.x) | strict 모드. noUncheckedIndexedAccess를 켜고 any 사용을 금지 규칙으로 다룬다. **7.0을 채택하지 않는다** — 타입 인지 정적 분석의 지원 범위 밖이다. **7.1 출시 후 재평가**한다. **backend는 TypeScript 축이 아니다** |
| **ESLint** | web_front · app_front | web_front **10.8**(10.8.1) · app_front **9** | flat config 단일 형식이다. 앱만 9인 이유는 React Native 공식 eslint-config의 허용 범위가 8·9뿐이기 때문이며, 축이 갈리는 것을 그대로 인정한다 |
| **typescript-eslint** | web_front · app_front | 8.66 | 타입 인지 규칙(부동소수점·비동기 규칙)의 실행 축이다. 이 패키지의 지원 범위가 TypeScript 메이저 선택을 구속한다 |
| **Prettier** | web_front · app_front | 구현 착수 시점 최신 안정판 고정 | 포매팅 단일화. 포매팅 규칙을 ESLint와 겹치게 두지 않는다 |

프로젝트 고유 정적 분석 규칙 **4종**을 둔다. 검산: 부동소수점 차단 1 + 시각 의존 차단 1 + RLS 우회 차단 1 + 시크릿 노출 차단 1 = **4**.

| 항목 | 내용 |
|------|------|
| 부동소수점 차단 | backend 축이다. 금액·비율 경로에서 float · double 사용과 **부동소수점에서 십진 타입을 만드는 호출**을 막는다(REQ-GLB-02). **금액 열에 대한 평균 집계도 같은 규칙으로 막는다** — 합계는 정수로 오지만 평균은 부동소수점으로 내려와 타입 선언 검사로는 잡히지 않는다 |
| 시각 의존 차단 | backend 축이다. 급여 계산 계층에서 현재 시각·난수 접근을 막는다(REQ-GLB-01). 기준 시각은 항상 인자로 주입한다 |
| RLS 우회 차단 | backend 축이다. **주입 프록시 밖에서 연결 · 영속성 컨텍스트 · SQL 세션을 직접 얻는 것**을 막는다(ADR-28). 트랜잭션 밖 쿼리와 읽기 축 매퍼의 삽입·수정·삭제 구문도 같은 축에서 막는다(ADR-26) |
| 시크릿 노출 차단 | web_front 축이다. **VITE_ 접두**가 없는 환경변수 참조를 클라이언트 코드에 두지 못하게 한다(ADR-18 개정) |

집행 도구는 표면에 따라 갈린다 — **backend의 3종은 ArchUnit과 컴파일 시점 정적 분석**이, **web_front의 1종은 ESLint 규칙**이 판정한다. 규칙 구성은 4종 그대로이고 옮긴 것은 판정 축뿐이다(ADR-18 개정).

## 테스트

| 항목 | 러너 | 내용 |
|------|------|------|
| backend/ | **JUnit 5 + AssertJ**(구현 착수 시점 최신 안정판 고정) | 급여 계산 단위 테스트 · 골든 케이스 · 서비스 계층 · 아키텍처 테스트. 통합 테스트는 **Testcontainers로 띄운 실제 PostgreSQL 18**에 붙는다(ADR-29) |
| web_front/ | **Vitest 4.1**(4.1.10) + React Testing Library | 컴포넌트·훅 단위 테스트. 렌더 결과가 아니라 사용자가 보는 텍스트·역할로 단언한다. **Vitest UI 서버를 네트워크에 노출하지 않는다** |
| app_front/ | **Jest** + React Native Testing Library | React Native preset과 Metro 트랜스폼이 Jest에 묶여 있어 여기만 Jest를 유지한다. 버전은 **구현 착수 시점 최신 안정판 고정** |
| e2e(웹) | **Playwright 1.62**(1.62.1) | 핵심 흐름 — 가입·초대 수락·체크인 대체 경로·급여 확정·명세서 발행 |
| e2e(앱) | 미채택 | 앱 e2e를 v1에 두지 않는다. 앱 검증은 단위 테스트와 수동 회귀로 한다 |

**러너가 셋으로 갈린 것을 그대로 인정한다.** 백엔드가 다른 언어가 되면서 러너를 하나로 맞출 대상 자체가 사라졌고, 각 표면이 자기 생태계의 표준을 따르는 편이 유지 비용이 낮다(ADR-29). **관례 통일은 러너가 아니라 CI 단계 이름과 게이트 구성이 담당한다.** RLS 격리 테스트는 정책·강제 옵션·롤 분리가 검증 대상이라 **실제 데이터베이스에서만 성립**하므로 인메모리 데이터베이스로 대체하지 않으며, 컨테이너 기동 비용 때문에 **골든 케이스는 데이터베이스를 거치지 않는 단위 테스트로 남긴다**.

**backend/ 저장소는 전환 이전 스캐폴드 상태다.** 문서 선언이 정본이며 프로젝트 재구성은 전환 첫 커밋의 작업 항목이다 — 저장소 실측을 근거로 문서를 되돌리지 않는다.

### 급여 골든 케이스 전략

| 항목 | 내용 |
|------|------|
| 위치 | backend/의 급여 계산 순수 함수 계층을 직접 호출한다. HTTP·데이터베이스를 거치지 않는다 |
| 입력 | 마감 근태 · 기준값 행 · 귀속 기준일 · 지급일을 고정 픽스처로 둔다. 실행 시각에 의존하는 입력을 두지 않는다 |
| 기대값 | 항목별 금액과 합계를 **정수(원)로 명시**한다. 근사 비교(허용 오차)를 쓰지 않는다 — 오차를 허용하는 순간 부동소수점 회귀를 잡지 못한다 |
| 재현성 회귀 | 동일 입력을 반복 계산해 결과가 완전히 동일한지 검증한다(REQ-GLB-01) |
| 타입 매핑 회귀 | 기동 시 스모크 테스트가 **실제 반환값의 자바 타입**을 단언한다 — 금액이 long인지, 비율이 BigDecimal인지, date가 LocalDate인지, 시간대를 끌고 들어오는 구형 날짜·시각 타입이 어느 경로에도 없는지다. 드라이버 설정값을 검증 대상으로 삼지 않는다([03_backend.md](./03_backend.md)) |
| 기준값 누락 | 필요한 기준값이 없을 때 계산이 **차단되는지**를 부정 케이스로 검증한다. 기본값 대체가 일어나지 않음을 확인하는 것이 목적이다 |
| 정본 | 케이스 목록과 기대값의 정본은 [../03_requirements/16_acceptance_criteria.md](../03_requirements/16_acceptance_criteria.md)다 |

### RLS 격리 테스트

- **컨테이너로 띄운 실제 PostgreSQL 18**에 붙는다. 공용 개발 데이터베이스에 붙이지 않는다 — 테스트가 서로의 데이터를 보고 실행 순서에 결과가 의존하면 격리 테스트가 격리되지 않은 환경에서 도는 셈이 된다(ADR-29).
- 사업장 A의 자격으로 사업장 B의 행을 조회·수정·삭제할 수 없음을 테이블 단위로 검증한다.
- 서비스 계층 검증을 우회한 직접 쿼리에서도 차단되는지 확인한다 — 이것이 2단 방어의 2단째가 실제로 동작하는지를 보는 유일한 방법이다.
- 퇴사·사업장 폐쇄 후에도 본인 소유 명세서·근로계약 열람이 유지되는지 검증한다(CMP-07).

## OpenAPI 타입 생성

```plain
① backend/ 문서 생성 태스크(springdoc-openapi · 버전 3.1.0 명시) → openapi.json 산출
② openapi-typescript 7.13 실행
③ web_front/src/lib/api/schema.d.ts · app_front/src/lib/api/schema.d.ts 갱신
④ CI가 재생성 후 diff를 검사 — 차이가 있으면 실패
```

- ①은 **Gradle 태스크의 파일 산출물**이다. 실행 중인 애플리케이션에서 문서를 받아오는 경로만 두면 CI가 매번 애플리케이션을 기동해야 한다.
- 생성 결과를 각 클라이언트 저장소에 커밋한다. 클라이언트가 빌드 시점에 backend/를 필요로 하지 않게 하기 위해서다.
- ④가 없으면 서버 계약이 바뀌어도 클라이언트 타입이 그대로 남아 컴파일이 통과한다. 계약 드리프트를 CI에서만 잡을 수 있다.
- **검증 애노테이션이 곧 문서 스키마이므로** 선언과 생성물이 갈리지 않게 할 책임은 DTO 한 곳에 있다(ADR-10 개정). 생성물을 손으로 수정하지 않는다.

## CI/CD

| 항목 | 내용 |
|------|------|
| 공통 | GitHub Actions(`.github/workflows/gate.yml`). 푸시·풀 리퀘스트에서 품질 게이트를 돌린다. **게이트의 단계 이름은 표면 공통으로 두고 실행 내용만 표면별로 갈린다** — 러너와 빌드 도구가 셋이어도 워크플로 구성은 한 벌로 읽힌다 |
| backend | 게이트는 **의존성 해석 → 컴파일 → 정적 분석 → 테스트**다(ADR-20 개정). 통과 후 Actions가 컨테이너 이미지를 빌드해 레지스트리에 푸시하고, EC2에서 이미지를 받아 Compose를 재기동한다 |
| web_front | 게이트는 설치(npm ci) → 타입 검사 → 정적 분석 → 테스트이고, 그 뒤에 **계약·산출물 게이트**가 한 단계 더 선다 — 화면 인벤토리 대조(check:docs) · OpenAPI 스냅샷 대조(check:api --offline) · 빌드 · 공개 번들 격리(check:bundle --strict)다. **e2e 는 이 워크플로에 두지 않는다** — 실 backend 를 전제하므로 러너에서 성립하지 않는다. 배포는 Vercel Git 연동이 담당하며(빌드 명령 react-router build) Actions는 배포 명령을 갖지 않는다 |
| app_front | 게이트는 설치(npm ci) → 타입 검사 → 정적 분석 → 단위 테스트까지다. 스토어 배포 자동화(Fastlane 계열)는 v1에 두지 않는다 |
| 마이그레이션 | **애플리케이션 프로세스 밖의 선행 스키마 적용 단계**가 수행한다(ADR-27). 자체 러너를 두지 않고 표준 도구의 적용 단계 하나만 두며, **적용 실패로 애플리케이션이 뜨지 않는 것이 곧 배포 중단**이다(ADR-20 개정). 적용이 기동보다 앞서는 순서는 그대로다 |

배포 순서·롤백·무중단 여부의 정본은 [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)다.

## 환경변수

| 항목 | 위치 | 내용 |
|------|------|------|
| backend(운영) | EC2 호스트의 환경 파일 | Compose가 컨테이너에 주입한다. 저장소에 커밋하지 않으며 설정 파일에 시크릿을 담지 않는다 |
| backend(로컬) | backend/.env | backend/.env.example을 템플릿으로 둔다. 예시 파일에는 키 이름만 담고 값을 담지 않는다 |
| web_front | Vercel 대시보드 | **VITE_ 접두 변수만 클라이언트 번들에 들어간다**(ADR-18 개정). 서버 시크릿을 web_front에 두지 않는다 |
| app_front | 빌드 시 주입 | 앱 번들은 리버스 엔지니어링이 가능하다. **앱에는 시크릿을 넣지 않는다** — API 기본 URL처럼 노출돼도 무해한 값만 둔다 |

- backend는 **설정 속성 바인딩 + Bean Validation**으로 기동 시 검증해 필수 값 누락이면 부팅을 실패시킨다. 개별 주입 지점에서 값을 흩어 읽지 않는다. 런타임에 처음 발견되는 설정 오류를 만들지 않는다.
- 시크릿 종류·회전 주기·보관 위치의 정본은 [../10_security/03_secrets_keys.md](../10_security/03_secrets_keys.md)다.

## 로컬 개발

| 항목 | 내용 |
|------|------|
| 인프라 | docker compose로 postgres · redis를 띄운다. 운영과 같은 메이저 버전을 쓴다 |
| backend | 로컬 **JDK 25**에서 Gradle 실행 태스크로 띄우고 컨테이너 데이터베이스에 접속한다. **스키마는 기동 시 Flyway가 맞추므로 별도 마이그레이션 명령이 없다**(ADR-27). 기준값 시드는 기동 경로 밖의 명시적 실행이다 |
| web_front | npm run dev로 개발 서버를 띄우고 로컬 backend/를 API 기본 URL로 지정한다. **개발 서버를 네트워크에 노출하는 실행 옵션을 쓰지 않는다** — 파일 시스템 접근 계열 취약점의 성립 조건이 네트워크 노출이다 |
| app_front | npm run ios · npm run android로 시뮬레이터·에뮬레이터에서 실행한다. 위치 측위는 실기기 확인이 필요하다 |
| 시드 데이터 | 기준값 시드는 **확인된 값만** 넣는다. 미확인 기준값(간이세액표 실데이터 등)을 임의로 채워 넣지 않는다 — 계산이 차단되는 것이 정상 동작이다 |
| 실데이터 | 운영 데이터를 로컬에 내려받지 않는다. 주민번호·계좌가 담긴 데이터를 개발 환경에 두지 않는다 |

## 관련 문서

- 기술 선정 사유 → [06_decisions_rationale.md](./06_decisions_rationale.md)
- 백엔드 계층 → [03_backend.md](./03_backend.md)
- 데이터·인프라 계층 → [04_data_infra.md](./04_data_infra.md)
- 배포 토폴로지 정본 → [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)
- 인수 기준·골든 케이스 정본 → [../03_requirements/16_acceptance_criteria.md](../03_requirements/16_acceptance_criteria.md)
- 마이그레이션·시드 정본 → [../05_database/10_migrations_seed.md](../05_database/10_migrations_seed.md)
- 시크릿·키 관리 정본 → [../10_security/03_secrets_keys.md](../10_security/03_secrets_keys.md)
