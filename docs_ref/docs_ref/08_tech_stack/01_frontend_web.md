# 01 웹 프론트엔드 스택

> **대상**: insadesk 웹(web_front) — 공개 페이지 · 관리자 웹 · 시스템 웹을 담는 단일 React + Vite 앱
> **작성일**: 2026-08-03
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영. **웹 스택 자체는 불변**이고 백엔드를 가리키는 표기만 고친다 — 경로 back/ → **backend/** 2곳 · 스키마 검증 행의 "백엔드도 같은 라이브러리를 쓴다" 서술을 **백엔드 검증 축은 Bean Validation이며 계약 공유는 OpenAPI 타입 생성이 진다**로 정정
> **개정일**: 2026-08-08 — 웹 프레임워크 전환(D-20 · ADR-24) 반영 전면 재작성. 프레임워크 행을 Vite + React Router로 교체 · 라우트 그룹 구성 표를 산출물 구성 표로 대체 · 미들웨어·RSC 셸·Server Actions 서술 삭제 · TypeScript 7.0 → **6.0** 정정 · date-fns-tz → **@date-fns/tz** 교체 · 이미지 행을 프레임워크 중립 서술로 · Vercel 배포 주의 절 신설. 버전 실측 기준 시점 2026-08-03 → **2026-08-08**
> **개정일**: 2026-08-09 — 웹 프론트 실채택 반영 — **@tanstack/react-table 9** · **motion 13**(motion/react) · **msw 2**(dev 목) 행 신설 · 정적 분석에 **eslint-plugin-react-hooks 7** 등재하고 **React Compiler를 eslint 규칙 전용으로 축소**(빌드 배선 미도입) · UI 컴포넌트 라이브러리 행에 **Radix UI 검토 후 제외** 명시 · **목 데이터 생성기(faker) 미채택** 행 신설 · 차트·전역 상태 미채택의 자체 구현 방침 보강
> **개정일**: 2026-08-27 — TanStack Query 무한 쿼리 + 정확히 200건 단위 누적 조회 계약, @tanstack/react-table 표시 전용 스프레드시트 밀도, page·size 비포함 쿼리 키, 첫 묶음 메타데이터·명시적 초기화·접근성·성능 경계 반영
> **원천**: 확정 결정 D-20(React + Vite 단일 앱 · 공개 페이지 프리렌더) · D-03(서브도메인 직접 호출) · ADR-24(웹 빌드·라우팅 스택 선정) · 2026-08-08 시점 각 패키지 최신 안정판 실측

web_front가 채택하는 기술과 그 경계를 고정한다. 하나의 React + Vite 앱이 공개 페이지 · 관리자 웹 · 시스템 웹을 전부 담고 Vercel 1프로젝트로 배포된다(D-20). 산출물은 하나이며 공개 2본만 빌드 시점에 정적 HTML로 굽고 나머지 전 경로는 SPA로 서빙한다.

**렌더링 모드·메타데이터·sitemap 전략의 정본은 [../04_architecture/05_rendering_seo.md](../04_architecture/05_rendering_seo.md)다.** 본 문서는 그 전략을 실행하는 패키지 구성과 품질 규약만 담는다. 선정 근거는 [06_decisions_rationale.md](./06_decisions_rationale.md)에 두고 채번·논증 정본은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)다.

## 프론트엔드 스택

| 항목 | 버전 | 내용 |
|------|------|------|
| 빌드 도구 | **Vite 8.2**(8.2.1) | Rolldown이 기본 번들러다. **ESM 전용**이며 rollupOptions는 rolldownOptions로 개명됐다. 개발 서버를 네트워크에 노출하지 않는다 — dev 서버 --host 실행을 규약으로 금지한다(파일 시스템 접근 계열 취약점의 성립 조건이 네트워크 노출이다) |
| React 플러그인 | **@vitejs/plugin-react 6.0**(6.0.5) | **React Compiler 빌드 배선(babel-plugin-react-compiler)은 두지 않는다** — 컴파일러 축은 정적 분석 행의 eslint 규칙으로만 적용한다 |
| 라우터 | **React Router 8.3**(8.3.0, framework mode) | ssr:false + prerender 조합으로 공개 페이지 정적 HTML과 SPA를 한 앱에서 만든다(ADR-24). **react 19.2.7 이상 · ESM 전용**을 요구하며 react-router-dom 패키지는 존재하지 않는다. 연 1회 메이저 정책이다 |
| 런타임 라이브러리 | **React 19.2**(19.2.8) · react-dom 동일 축 | React Router 8의 peer 하한(19.2.7)을 충족하는 축이다. React Compiler를 빌드에 배선하지 않으므로 **메모이제이션을 컴파일러에 위임하지 않는다** |
| 언어 | **TypeScript 6.0**(6.0.2, strict) | TypeScript 7.0을 v1 기준선으로 삼지 않는다 — typescript-eslint의 peer 범위가 6.1.0 미만이라 타입 인지 정적 분석이 통째로 끊긴다. **TypeScript 7.1 출시 후 재평가**한다 |
| 스타일링 | **Tailwind CSS 4.3**(4.3.3) + **@tailwindcss/vite 4.3.3** | 1급 Vite 플러그인 경로를 쓰고 PostCSS 파이프라인을 두지 않는다. 디자인 토큰을 CSS 변수로 선언하고 Tailwind 테마에 연결한다. 외부 UI 컴포넌트 라이브러리를 두지 않는다 |
| 폰트 | **IBM Plex Sans KR**(셀프호스팅) | 서브셋 woff2를 빌드 산출물에 포함하고 **런타임 외부 폰트 요청을 만들지 않는다**. 정확 패키지·버전은 **구현 착수 시점 최신 안정판 고정** |
| 아이콘 | **lucide-react 1**(1.30.0) | 아이콘 세트 하나로 통일한다. 0.x를 벗어나 1.x 메이저에 도달한 축이다 |
| 서버 상태 | **TanStack Query 5**(@tanstack/react-query 5.101.4) | 인증 후 업무 데이터의 유일한 조회·변이 경로다. api.{domain} 직접 호출(D-03). 서버 목록은 useInfiniteQuery 기반 공용 훅으로 200건씩 누적한다 |
| 폼 | **react-hook-form 7.85**(7.85.0) | 비제어 입력으로 리렌더를 입력 필드 단위로 가둔다. **7.x 캐럿 범위로 고정한다** — 8.0 베타가 배포 중이라 v1 기간에 메이저가 올라가지 않게 한다 |
| 스키마 검증 | **Zod 4.4**(4.4.3) | 폼 스키마 정의와 API 응답 경계 검증. **web_front · app_front 축이며 백엔드는 Bean Validation 축이다**(D-21 · [03_backend.md](./03_backend.md)) — 두 축의 계약 공유는 같은 라이브러리가 아니라 OpenAPI 타입 생성이 진다 |
| 폼·스키마 연결 | **@hookform/resolvers 5.7**(5.7.1) | Zod 스키마를 react-hook-form 리졸버로 연결한다 |
| 날짜·시간대 | **date-fns 4**(4.4.0) + **@date-fns/tz**(1.5.0) | UTC 저장 · KST 표시 환산의 유일한 수단이다. date-fns-tz를 쓰지 않는다 — 릴리스가 2024-09에 멈췄고 date-fns 4의 시간대 축이 @date-fns/tz로 이관됐다 |
| 실시간 수신 | 브라우저 내장 **EventSource** | SSE 구독에 별도 라이브러리를 두지 않는다. 인증은 Domain=.{domain} 세션 쿠키가 자동 전송된다(D-03) |
| HTTP 호출 | 브라우저 내장 **fetch** | axios 등 HTTP 클라이언트 라이브러리를 채택하지 않는다 — 얇은 래퍼 하나로 자격 증명 포함·에러 정제·재시도 정책을 통일한다 |
| API 타입 | **openapi-typescript 7.13**(7.13.0) | backend/의 OpenAPI 문서에서 요청·응답 타입을 생성한다. 생성 절차는 [05_tooling_devops.md](./05_tooling_devops.md) |
| 표 | **@tanstack/react-table 9**(9.1.2) | 목록 화면의 열 정의·정렬·행 모델을 헤드리스로 잡는다. 마크업과 스프레드시트형 표시 밀도(36px 헤더 · 32px 단일행 · 셀 격자 · sticky 헤더 · 선택적 첫 열 고정)는 자체 DataTable이 갖는다. 셀 편집·복사·수식·행 번호는 범위가 아니다 |
| 애니메이션 | **motion 13**(13.0.0, motion/react) | 드로어·모달·토스트의 진입·이탈 전환에만 쓴다. prefers-reduced-motion을 존중하고 전환을 상태 표시의 유일 수단으로 삼지 않는다 |
| 개발용 목 서버 | **msw 2**(2.15.0, devDependency) | backend/ 계약이 붙기 전 화면을 세우는 개발 전용 목 계층이다. 서비스 워커는 dev 빌드에서만 등록하고 **프로덕션 번들에 넣지 않는다** |
| 정적 분석 | **ESLint 10**(10.8.1) + **typescript-eslint 8.66** + **eslint-plugin-react-hooks 7**(7.1.1) | flat config 단일 형식이다. eslint-config-next 같은 프레임워크 동봉 설정을 쓰지 않는다. **React Compiler는 이 플러그인의 규칙으로만 적용**하고 빌드 배선은 두지 않는다 |
| 테스트 | Vitest · React Testing Library · Playwright | 러너·버전의 정본은 [05_tooling_devops.md](./05_tooling_devops.md)다. Vitest UI 서버를 네트워크에 노출하지 않는다 |
| 전역 클라이언트 상태 | 미채택 | Redux·Zustand 등을 두지 않는다. 서버 상태는 TanStack Query가, 화면 로컬 상태는 React 내장 훅과 Context가 담당한다 |
| 차트 | 미채택 | v1 범위에 대시보드·통계 화면이 없다. 차트 라이브러리를 미리 넣지 않으며 필요한 소형 시각화는 자체 구현한다 |
| UI 컴포넌트 라이브러리 | 미채택 | Tailwind 유틸리티 + 자체 컴포넌트 + lucide-react로 구성한다. **Radix UI는 검토 후 제외**했다 — 접근성 프리미티브를 얻는 대신 스타일 재정의 층이 하나 더 생기고, v1이 쓰는 오버레이가 모달 단일 레이어([../07_screen/01_standards.md](../07_screen/01_standards.md) §3-1)와 드로어·바텀시트로 좁다 |
| 목 데이터 생성기 | 미채택 | **faker는 검토 후 제외**했다 — msw 핸들러가 쓰는 목 데이터는 화면 시나리오에 맞춰 고정값으로 적는다. 난수 생성기는 실행마다 화면이 달라져 리뷰·스크린샷 비교의 기준을 흔든다 |
| 국제화(i18n) | 미채택 | 표시 언어는 ko-KR 단일이다. 통화 원(KRW) · 시간대 KST 고정이라 로케일 분기를 두지 않는다 |
| 서버 실행 계층 | 미채택 | 웹 호스팅 계층에 서버 렌더링·서버 액션·프록시 경로를 두지 않는다. 인증 후 데이터 접근은 api.{domain} 직접 호출이다(D-03 · D-20) |
| Temporal API | 미채택 | ES2026에 편입됐으나 Safari 정식 지원과 Node.js 24 LTS 무플래그 동작이 갖춰지지 않았다. v1은 date-fns 4 + @date-fns/tz를 쓴다 |

## 산출물 구성

빌드는 한 번 돌고 산출물은 하나다. 그 안에서 **프리렌더 정적 HTML 2본**과 **SPA 번들**이 함께 나온다(D-20).

| 구성 | 대상 | 렌더링 축 | 접근 |
|------|------|----------|------|
| 공개 프리렌더 | 랜딩(/) · 요금제(/pricing) | **빌드 시점 프리렌더**(react-router.config의 ssr:false + prerender) + 메타데이터 · 구조화 데이터 · sitemap · robots | 미인증 |
| 법정 문서 | 이용약관 · 개인정보 처리방침 · 위치기반서비스 이용약관 | **SPA 클라이언트 조회(CSR)** — 프리렌더하지 않는다. 활성 버전을 조회 시점에 받아 표시한다 | 미인증 |
| 미인증 인증 화면 | 가입 · 로그인 · 비밀번호 재설정 · 동의 | SPA 클라이언트 렌더 | 미인증 |
| 관리자 웹 | 사업장 운영 — 인사 · 근태 · 휴가 · 급여 · 명세서 · 세무 · 구독 | SPA 클라이언트 렌더 | 사업장 멤버십 |
| 시스템 웹 | 플랫폼 관리 — 사업장 · 사용자 · 요금제 · 기준값 · 감사 로그 | SPA 클라이언트 렌더 | 플랫폼 역할 |

- **법정 문서를 프리렌더 목록에 넣지 않는다.** 넣으면 활성 버전 전환 때마다 재빌드가 필요하고, 재빌드 전까지 화면에 뜬 약관 버전과 동의 이력의 버전이 갈라진다.
- 요금제는 프리렌더 셸을 굽되 금액·한도는 클라이언트 조회로 최신을 보장한다.
- 화면 코드(PUB · ADM · SYS)와 경로의 대응 정본은 [../07_screen/README.md](../07_screen/README.md)다.
- 직원 앱 전용 화면(APP)은 web_front에 두지 않는다.

## 라우트 보호

**서버 미들웨어 계층이 없다.** 웹 호스팅 계층은 정적 파일과 SPA fallback만 배달한다.

| 계층 | 역할 | 신뢰 수준 |
|------|------|----------|
| 클라이언트 라우터 가드 | 미인증 진입 시 로그인 화면으로 돌리고 권한 없는 메뉴를 숨긴다 | **신뢰 계층이 아니다 — UX 보조다.** 번들은 사용자가 조작할 수 있다 |
| 서버 검증 | 세션·JWT 확인, 멤버십·역할·활성 사업장 스코프 판정 | 최종 판정 |
| RLS | 행 단위 격리 2차 방어 | 심층 방어 |

- 가드 계층 재정의의 정본은 [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md) · [../10_security/01_authn_authz.md](../10_security/01_authn_authz.md)다.
- 클라이언트에서 감춘 화면을 접근 통제로 간주하지 않는다. 화면을 감추는 것과 데이터를 막는 것은 다른 층의 일이다.

## 주요 라이브러리 심화

### TanStack Query

| 항목 | 내용 |
|------|------|
| 쿼리 키 | 활성 workplace_id · 역할 · 검색 · 필터 · 정렬을 반드시 포함한다. 무한 목록의 page · size · cursor는 이어읽기 위치이므로 키에서 제외하고 pageParam으로 전달한다. 상세 계약의 정본은 [../04_architecture/04_request_data_flow.md](../04_architecture/04_request_data_flow.md) |
| 무한 목록 | 웹 DataTable은 정확히 200건씩 요청한다. 오프셋은 내부 pageParam 1, 2, …, 커서는 서버 nextCursor를 쓰고 API 분류를 바꾸지 않는다. items만 안정 식별자로 중복 제거해 누적하고 부가 메타데이터는 첫 묶음을 쓴다 |
| 무효화 | 변이 성공 응답을 받은 뒤 일반 조회는 관련 키를 무효화하고, 누적 목록은 쌓인 모든 묶음을 연쇄 재조회하지 않도록 reset해 첫 200건부터 시작한다 |
| 자동 재조회 | 누적 목록은 창 포커스·네트워크 재연결 재조회를 끈다. 검색·필터·정렬·사업장·역할 변경과 “처음부터 새로고침”이 새 체인을 만든다 |
| 낙관적 갱신 | **급여 확정 · 명세서 발행 · 근태 마감 · 승인/반려에는 쓰지 않는다.** 되돌리기 어려운 작업은 서버 확정 후에만 UI에 반영한다 |
| 재시도 | 4xx는 재시도하지 않는다. 인가 실패·전제 미충족을 반복 호출로 덮지 않는다 |
| 에러 표면 | 서버 에러 코드({domain}.{snake_case})를 화면 문안으로 매핑하는 계층을 한 곳에 둔다. 원문 메시지를 그대로 노출하지 않는다 |

### 폼·검증

- 폼 상태는 react-hook-form, 값 계약은 Zod가 담당한다. 두 축을 @hookform/resolvers로 연결해 스키마를 한 번만 정의한다.
- **금액·비율 입력은 문자열로 다룬다.** 화면 입력값을 자바스크립트 수치 타입으로 파싱해 계산하지 않으며, 계산은 전부 서버가 수행한다(REQ-GLB-01 · REQ-GLB-02).
- 클라이언트 검증은 사용성 보조다. 최종 판정은 서버 검증과 데이터베이스 제약이며, 클라이언트에서 통과한 값이 서버에서 거절될 수 있음을 전제로 에러 표시 자리를 항상 둔다.

### 날짜·시간대

- 서버는 timestamptz(UTC)로 주고받고, 화면 표시와 일(日) 경계 판정은 전부 KST(Asia/Seoul)로 환산한다.
- 근무일·급여월·효력일 같은 date 값은 YYYY-MM-DD 문자열로 받아 그대로 다룬다. 문자열을 Date 객체로 파싱하면 UTC 자정으로 해석돼 KST 일자가 하루 밀린다.
- 브라우저 로컬 시간대에 의존하는 표시를 두지 않는다 — 해외 접속자도 KST 기준으로 같은 값을 본다.

### 실시간 수신

- 인앱 알림(NTF-01)은 api.{domain}의 SSE 엔드포인트를 EventSource로 구독한다. **v1의 SSE 표면은 이것 하나다**(ADR-14 — 실시간 근태 현황판은 v1.1 이월).
- EventSource는 커스텀 헤더를 실을 수 없다. 웹은 Domain=.{domain} 세션 쿠키가 자동으로 실려 그대로 동작하며, 이것이 D-03 쿠키 도메인 결정의 실무적 귀결이다.
- 연결 관리·재연결·이벤트 계약의 정본은 [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)다.

## Vercel 배포 규약

배포 토폴로지의 정본은 [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)이며, 여기서는 이 스택이 요구하는 설정만 고정한다.

| 항목 | 내용 |
|------|------|
| 프레임워크 프리셋 | **Vite**로 지정한다. 출력 디렉터리는 React Router framework mode의 클라이언트 빌드 산출 경로다 |
| 빌드 명령 | react-router build. 스크립트 이름 규약의 정본은 [05_tooling_devops.md](./05_tooling_devops.md) |
| SPA 딥링크 | 정적 호스팅은 SPA 딥링크를 기본 처리하지 않는다. **vercel.json에 fallback rewrite를 둔다.** 프리렌더가 있으면 fallback 파일명이 달라지므로 rewrite 대상도 함께 맞춘다 |
| cleanUrls | 켜면 rewrite의 원본·대상에서 확장자를 빼야 한다. 켤지 여부와 rewrite 표기를 같은 변경 단위에서 정한다 |
| 착수 시 실측 단서 | **프리렌더 정적 HTML과 전면 fallback rewrite의 매칭 우선순위는 호스팅 공식 문서에 명시가 없다.** 프리뷰 배포에서 /pricing이 프리렌더 HTML을 반환하는지 실측으로 확인한 뒤 규약을 확정한다 |
| 서버 실행 | 웹 호스팅 계층에 서버 실행 경로를 두지 않는다. 업무 API를 프록시하지 않는다(D-03) |
| 환경변수 | 클라이언트 번들에 들어가는 것은 **VITE_ 접두 변수뿐이다**(ADR-18 개정). 서버 시크릿을 web_front에 두지 않는다 |

## 성능·품질 규약

| 항목 | 내용 |
|------|------|
| 번들 | 관리자 웹·시스템 웹 화면은 라우트 단위 코드 분할을 기본으로 하고, 대형 의존성은 동적 임포트로 초기 번들에서 뺀다. 프리렌더 공개 페이지 번들에 인증 후 화면 코드를 섞지 않는다 |
| 이미지 | **빌드 시 크기를 확정한다** — 정적 임포트로 자산을 참조하고 width · height를 명시해 레이아웃 이동을 만들지 않는다. 반응형이 필요한 자산은 srcset을 명시적으로 구성한다 |
| 폰트 | 셀프호스팅 woff2 + 서브셋 + font-display swap. 런타임에 외부 폰트 네트워크 요청을 만들지 않는다 |
| 목록 | 서버 목록은 페이지 번호 없이 200건 단위로 이어 읽고 전량 로드 경로를 두지 않는다. 자동 센티널과 수동 버튼을 함께 두며 범위 조회·작은 모달 선택 목록·로컬 계산 표는 공용 무한 목록에서 제외한다 |
| 목록 성능 | 첫 200건 표시 2초 이내 · 다음 200건 추가 500ms 이내 · 누적 1,000행에서 200ms 초과 long task 없음이 검증 기준이다. 기준 미달을 이유로 가상화 의존성을 자동 추가하지 않고 별도 결정으로 분리한다 |
| 집계 | 합계·평균은 서버가 계산한 값을 표시한다. 클라이언트에서 행을 받아 합산하지 않는다(REQ-GLB-01 결정론) |
| 상태 4종 | 모든 데이터 화면은 로딩 · 빈 상태 · 오류 · 권한 거부 넷을 갖춘다. 표준 정본은 [../07_screen/01_standards.md](../07_screen/01_standards.md) |
| 민감정보 | 주민번호·계좌 평문을 클라이언트 상태나 캐시에 보관하지 않는다. 서버 1회성 응답을 화면에 표시하고 이탈 시 폐기한다 |
| 접근성 | 최소 대비·키보드 조작·폼 레이블을 규범으로 둔다. 누적 목록은 실제 table 시맨틱·caption·aria-sort를 유지하고, 자동 센티널과 별개인 수동 버튼 및 role=status 상태 메시지를 제공한다. 상세는 [../03_requirements/15_nonfunctional.md](../03_requirements/15_nonfunctional.md) |
| 반응형 | 관리자 웹은 데스크톱 우선이되 태블릿 폭까지 조작 가능해야 한다. 공개 페이지는 모바일 폭을 기준으로 설계한다 |

## 관련 문서

- 기술 선정 사유 → [06_decisions_rationale.md](./06_decisions_rationale.md)
- 백엔드 계층 → [03_backend.md](./03_backend.md)
- 툴링·테스트·타입 생성 → [05_tooling_devops.md](./05_tooling_devops.md)
- 렌더링·SEO 전략 정본 → [../04_architecture/05_rendering_seo.md](../04_architecture/05_rendering_seo.md)
- 요청·데이터 흐름 정본 → [../04_architecture/04_request_data_flow.md](../04_architecture/04_request_data_flow.md)
- 기술결정 ADR 정본 → [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)
- 화면 표준·인벤토리 → [../07_screen/01_standards.md](../07_screen/01_standards.md) · [../07_screen/README.md](../07_screen/README.md)
