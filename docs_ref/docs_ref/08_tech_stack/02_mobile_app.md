# 02 모바일 앱 스택

> **대상**: insadesk 직원 앱(app_front) — React Native CLI bare 기반 iOS · Android 앱
> **작성일**: 2026-08-03
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영. **앱 스택 자체는 불변**이고 백엔드를 가리키는 표기만 고친다 — 경로 back/ → **backend/** 1곳 · 정적 분석 행의 대조 대상에서 백엔드 제외(백엔드는 ESLint 축이 아니다) · 검증 스크립트 3종 문장의 대조 대상을 웹의 dev·build와 **백엔드의 Gradle 태스크 축**으로 정정
> **개정일**: 2026-08-19 — app_front 착수 실측 반영. 내비게이션 row를 네이티브 스택 + **드로어**(@react-navigation/drawer 7.13)로 정정하고 하단 탭 미채택을 명시 · 보안 저장소를 expo-secure-store → **자체 TurboModule InsadeskSecureStore**로 교체(RN 0.86 미지원으로 expo-secure-store 보류 · react-native-keychain 미채택 유지) · 실시간 수신을 react-native-sse 1.2 **채택 확정**으로 승격하고 전송 추상화·폴백 계약 기재 · 신규 row 6종 등재(폰트 Noto Sans KR · 환경 주입 · 폼 · 아이콘 · API 모킹 · 모듈 경로 별칭) · 검증 스크립트 3종 note 신설
> **개정일**: 2026-08-08 — v1 범위 정합과 라이브러리 실측 반영. 푸시 전달·표시 행과 푸시 알림 절을 v1 범위 밖 부정형으로 대체 · 보안 저장소를 react-native-keychain → **expo-secure-store**로 교체(배포본에 New Architecture 구현 부재) · date-fns-tz → **@date-fns/tz** 교체 · NativeWind 토큰 축 공유 서술 정정 · TypeScript 7.0 → **6.x** · ESLint 축 명시 · react-native-safe-area-context 등재 · 명세서 PDF 수신 절 신설 · 버전 드리프트 갱신
> **원천**: docs_ref2/features.md(앱 JWT 인증 · 전자서명 교부 · GPS 체크인) · 확정 결정 D-03(api.{domain} 직접 호출) · v1 범위 정본 [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) · 2026-08-08 시점 각 패키지 최신 안정판 실측 · 2026-08-19 app_front 착수 실측(드로어 채택 · 보안 저장소 자체 모듈 · SSE 추상화 · 앱 폰트 · 환경 주입)

app_front는 직원(STAFF)이 쓰는 단일 앱이다. 출퇴근 체크인 · 근태 조회 · 수정 요청 · 휴가 신청 · 급여 이력 · 명세서 열람 · 근로계약 전자서명 · 알림을 담는다. 관리자 업무는 앱에 두지 않는다 — 사업장 운영은 관리자 웹(web_front)의 몫이다.

앱은 Vercel을 경유하지 않고 api.{domain}을 직접 호출한다(D-03). 인증 축은 웹(세션 쿠키)과 달리 **JWT(access + refresh)**이다.

## 모바일 스택

| 항목 | 버전 | 내용 |
|------|------|------|
| 프레임워크 | **React Native 0.86**(0.86.2, CLI bare) | New Architecture 기준. 네이티브 프로젝트를 저장소에 두고 직접 빌드한다 |
| 런타임 라이브러리 | **React 19.2**(19.2.8) | React Native 0.86이 요구하는 버전 축 |
| 언어 | **TypeScript 6.x**(strict) | TypeScript 7.0을 v1 기준선으로 삼지 않는다 — typescript-eslint의 peer 범위가 6.1.0 미만이라 타입 인지 정적 분석이 끊긴다. 정확 패치 버전은 **구현 착수 시점 최신 안정판 고정** |
| 정적 분석 | **ESLint 9**(@react-native/eslint-config 축) | 앱 저장소만 ESLint 9다 — React Native 공식 eslint-config의 peer가 8·9만 허용한다. **web_front의 ESLint 10**과 축이 갈리는 것을 그대로 인정한다. 백엔드는 ESLint 축이 아니다(D-21) |
| Expo | **관리 워크플로 미채택** | 아래 절에 근거를 둔다. 개별 Expo Modules 패키지를 bare 프로젝트에 설치하는 것은 별개다 |
| 내비게이션 | **react-navigation 7**(native 7.3.16 · **drawer 7.13** · native-stack 7.18) | **네이티브 스택 + 좌상단 햄버거 드로어**다. **하단 탭을 채택하지 않는다** — 상시 이동 항목이 8개라 5탭에 담기지 않고, 사업장 전환·문서·개인정보처럼 진입 빈도가 낮은 항목까지 상시 노출하면 탭이 좁아진다. 드로어 구조의 정본은 [../07_screen/01_standards.md](../07_screen/01_standards.md) §4-2다. 드로어는 gesture-handler 3 · reanimated 4(+react-native-worklets)를 전제한다. 딥링크로 알림 → 대상 화면 진입을 처리한다 |
| 화면 여백 | **react-native-safe-area-context 5**(5.8.1) | 노치·홈 인디케이터 영역 계산. React Native 템플릿 기본 포함 축을 그대로 승계한다 |
| 스타일링 | **NativeWind 4**(4.2.6) | Tailwind 유틸리티 문법을 앱에서 쓴다. **웹과 토큰 정의를 공유하지 않는다** — 안정판 NativeWind는 Tailwind 3 설정 축이고 웹은 Tailwind 4 CSS-first 축이라 설정 형식 자체가 다르다. v1은 **토큰 정의를 두 벌 유지**하고 값이 갈리지 않도록 디자인 토큰 표를 단일 출처로 둔다. NativeWind 5가 안정화되면 통합을 재평가한다 |
| 서버 상태 | **TanStack Query 5**(@tanstack/react-query 5.101.4) | 웹과 같은 라이브러리·같은 쿼리 키 규약(첫 세그먼트 workplace_id)을 쓴다 |
| 스키마 검증 | **Zod 4.4**(4.4.3) | 신청 폼 입력 검증과 API 응답 경계 검증 |
| API 타입 | **openapi-typescript 7.13**(7.13.0) | backend/의 OpenAPI 문서에서 생성한 타입을 app_front 저장소로 받는다 |
| 보안 저장소 | **자체 TurboModule InsadeskSecureStore**(2026-08-19 채택 확정 — 구현 레인 진행 중) | JWT access·refresh 토큰을 iOS Keychain(SecItem · 기기 한정 최초 잠금 해제 후 접근) · Android AndroidKeyStore 키로 봉인한 전용 저장소에 둔다. **expo-secure-store는 보류**다 — install-expo-modules가 React Native 0.86을 아직 지원하지 않아 bare 프로젝트에 Expo Modules 런타임을 들일 수 없다. 지원이 붙으면 재평가한다. **react-native-keychain은 계속 미채택**이다 — npm 배포본에 TurboModule 구현이 없어 제거 예정인 레거시 호환 계층 위에서만 동작하고, 최종 배포가 2025-03에 멈춰 있다. 앱 코드는 파사드 하나만 보며 네이티브 모듈이 없으면 **개발 한정 메모리 대역**으로 떨어진다 — AsyncStorage에 토큰을 두지 않는다 |
| 위치 | **@react-native-community/geolocation**(3.4.0) | 체크인·체크아웃 시점의 단발 측위 전용. TurboModule 구현은 갖췄으나 **2024-09 이후 무릴리스이며 미병합 수정이 쌓여 있다**. 착수 시 실기기 검증을 선행하고 expo-location 병행 평가를 함께 수행한다 — 근태 체크인은 법정 기록의 입구라 방치 패키지 단독 의존을 확정 사항으로 두지 않는다 |
| 전자서명 | **react-native-svg**(15.15.5) + **react-native-gesture-handler 3**(3.1.0) + **react-native-view-shot 5**(5.1.1) | 서명 캔버스를 자체 구현한다. gesture-handler는 3.0에서 훅 기반 API로 파괴적 변경이 있었으므로 2.x 예제를 그대로 옮기지 않는다 |
| 실시간 수신 | **react-native-sse 1.2**(2026-08-19 채택 확정 — 구현 레인 진행 중) | React Native에는 EventSource 내장이 없고, 앱은 헤더로 JWT를 실어야 하므로 헤더 지정이 가능한 폴리필을 쓴다. 순수 JavaScript 구현이라 New Architecture 영향은 없다. **전송을 추상화 계층 뒤에 둔다** — 화면과 훅은 알림 스트림 인터페이스만 보고 실 전송과 mock 틱 전송을 갈아 끼운다. 릴리스 정체 위험은 이 경계와 **폴백**(포그라운드 주기 재조회)으로 흡수하므로 교체가 화면 계약을 건드리지 않는다 |
| 파일 수신 | **react-native-blob-util** | 명세서 PDF를 1회용 토큰으로 인앱 수신한다. 아래 절에 계약을 둔다. 버전은 **구현 착수 시점 최신 안정판 고정** · 착수 시 유지보수 상태를 재확인한다 |
| 날짜·시간대 | **date-fns 4**(4.4.0) + **@date-fns/tz**(1.5.0) | 웹과 동일한 KST 환산 규약을 쓴다. date-fns-tz를 쓰지 않는다(릴리스 정체 · date-fns 4의 시간대 축 이관) |
| 푸시 알림 | **v1 범위 밖** | 아래 절에 근거를 둔다 |
| 오프라인 기록 | **미채택** | 아래 절에 근거를 둔다 |
| 로컬 데이터베이스 | **미채택** | 오프라인 기록을 두지 않으므로 SQLite·WatermelonDB 계열 로컬 저장소가 필요 없다. 서버 상태 캐시는 TanStack Query 메모리 캐시로 충분하다 |
| 생체 인증 | **미채택** | v1의 재인증은 비밀번호 재확인 단일 경로다. 생체 인증을 재인증 수단으로 인정하지 않는다 |
| 폰트 | **Noto Sans KR 400 · 500 · 700 번들**(2026-08-19 채택 확정 — 구현 레인 진행 중) | 서체 파일을 앱에 직접 담는다(SIL Open Font License · 한글·기본 라틴·문장부호·원화 기호로 서브셋). **웹의 IBM Plex Sans KR과 같은 서체가 아니다** — 앱은 3단 가중치면 충분하고 서브셋 후 번들 증가를 최소화하는 쪽을 택한다. iOS는 앱 번들 폰트 목록에 등록하고 Android는 res/font 가중치 XML을 기동 시 가중치 폰트로 등록한다. **React Native 0.86의 Text는 전역 기본 폰트를 갖지 못하므로** 공용 Text 아톰이 폰트를 강제한다 |
| 환경 주입 | **무의존 생성 스크립트**(2026-08-19 채택 확정 — 구현 레인 진행 중) | 환경 파일을 병합해 타입이 붙은 상수 모듈을 생성하고 앱은 그 모듈만 읽는다. 런타임 환경변수 라이브러리를 두지 않는다 — 네이티브 양쪽 빌드 설정을 함께 물어야 하는 축을 하나 줄인다. 예시 파일만 저장소에 두고 실제 환경 파일과 생성물은 커밋하지 않는다. **시크릿을 앱 번들에 넣지 않는다** — 클라이언트 번들은 해체 가능하므로 서버 자격 증명의 보관처가 아니다 |
| 폼 | **react-hook-form 7.85** + **@hookform/resolvers 5.7** | Zod 스키마를 리졸버로 연결해 인증·신청 폼의 입력 검증 축을 하나로 둔다 |
| 아이콘 | **lucide-react-native 1.31** | react-native-svg 위에서 도는 아이콘 세트다. 드로어 항목 아이콘과 상태 아이콘이 여기서 나온다 |
| API 모킹 | **msw 2.15**(개발 의존성) | 서버 착수 전 화면을 실 계약으로 돌리는 mock 축이다. Hermes에 없는 스트림·텍스트 인코딩·URL 폴리필(web-streams-polyfill · fast-text-encoding · react-native-url-polyfill)을 mock 적재보다 먼저 올린다. **실 API 전환 시 폴더째 걷어내는 경계**로 둔다 |
| 모듈 경로 별칭 | **babel-plugin-module-resolver 5**(개발 의존성) | 절대 경로 별칭을 Metro 해석과 TypeScript 경로 설정에 같은 값으로 둔다 |
| 앱 내 결제 | **미채택** | 구독 등급 조정은 플랫폼 관리자 수동 처리다. 앱에 결제 표면을 두지 않는다 |
| 인앱 웹뷰 | **미채택** | 약관·개인정보 처리방침 열람은 외부 브라우저로 연다. 웹뷰를 두면 앱 번들과 보안 표면이 함께 늘어난다 |

**검증 스크립트 3종은 web_front와 이름을 공유한다** — npm run typecheck · npm run lint · npm run test다. 실행 축만 React Native CLI라 npm run start · npm run ios · npm run android로 갈리며 web_front의 dev·build와 이름이 다르다. **backend는 npm 축이 아니라 Gradle 태스크 축이므로 스크립트 이름을 공유하지 않는다** — 세 표면을 한 벌로 묶는 것은 스크립트 이름이 아니라 CI 워크플로의 단계 이름이다(정본 [05_tooling_devops.md](./05_tooling_devops.md)).

## Expo 관리 워크플로를 채택하지 않는 근거

| 항목 | 내용 |
|------|------|
| 결정 | React Native **CLI bare**를 쓴다. Expo 관리 워크플로(managed · dev client 포함)를 채택하지 않는다 |
| 근거 | 위치 측위 · 보안 저장소 · 서명 캔버스 캡처는 전부 네이티브 계층 설정을 직접 만져야 한다. 관리 워크플로를 얹으면 이 설정들이 config 플러그인 계층을 한 겹 거치게 되고, 라이브러리가 플러그인을 제공하지 않는 순간 결국 prebuild로 bare 프로젝트를 열어야 한다 |
| Expo Modules 개별 설치는 별개다 — **v1에는 들이지 않는다** | 필요한 패키지만 bare 프로젝트에 개별 설치하는 것은 관리 워크플로 도입이 아니므로 원칙적으로 가능하다. 다만 **설치 도구가 React Native 0.86을 아직 지원하지 않아** v1은 Expo Modules 런타임을 들이지 않고, 보안 저장소를 자체 TurboModule로 구현한다. 지원이 붙으면 의존 하나를 늘리는 대가와 함께 재평가한다 |
| 대가 | iOS·Android 네이티브 프로젝트를 저장소에 두고 직접 유지한다. React Native 업그레이드 시 네이티브 파일 병합 작업이 따른다 |

## 인증·세션

| 항목 | 내용 |
|------|------|
| 토큰 | access + refresh **2종**. 발급·갱신·폐기 계약의 정본은 [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md) |
| 저장 위치 | 자체 TurboModule InsadeskSecureStore(iOS Keychain · Android AndroidKeyStore). AsyncStorage·MMKV 등 평문 저장소에 토큰을 두지 않는다 — MMKV는 빠르지만 암호화 키 자체의 보관처를 해결해 주지 않아 대체재가 아니다. 네이티브 모듈이 없는 환경(테스트·초기 개발)에서는 파사드가 메모리 대역으로 떨어지며 **이 대역을 실기기 배포 경로에 두지 않는다** |
| 전송 | Authorization 헤더. 앱은 쿠키를 쓰지 않는다 |
| 폐기 | 로그아웃·정지·강제 만료는 서버가 Redis 블랙리스트로 처리한다([04_data_infra.md](./04_data_infra.md)) |
| 갱신 | access 만료 시 refresh로 1회 갱신하고, 갱신 실패는 즉시 로그인 화면으로 되돌린다. 동시 다발 401에서 갱신 요청이 중복되지 않도록 갱신을 단일 큐로 직렬화한다 |

## 위치·지오펜스

| 항목 | 내용 |
|------|------|
| 사용 시점 | 출근 체크인 · 퇴근 체크아웃 **2시점**의 단발 측위뿐이다. 근무 중 추적을 하지 않는다 |
| 권한 | 앱 사용 중 위치 권한만 요청한다. **항상 허용(백그라운드) 권한을 요청하지 않는다** |
| 근거 | 상시 추적은 개인위치정보 처리 범위를 넓혀 별도 동의·이용 사실 확인자료 부담을 키우고, 스토어 심사에서 백그라운드 위치의 필요성 소명을 요구받는다. 체크인 판정에 필요한 것은 그 순간의 좌표 하나뿐이다 |
| 지오펜스 판정 | **서버가 판정한다.** 앱은 좌표와 정확도를 보내고, 사업장 반경 내외 판정과 허용/차단은 서버가 내린다. 클라이언트 판정은 우회 가능하다 |
| 동의 선행 | 개인위치정보 수집·이용 동의(PRV-01)가 없으면 측위 자체를 시작하지 않는다. 동의·확인자료 계약의 정본은 [../10_security/05_location_privacy.md](../10_security/05_location_privacy.md) |
| 위치 조작 대응 | 모의 위치 탐지·기기 바인딩은 v1에 두지 않는다 |
| 측위 라이브러리 단서 | 채택 라이브러리가 방치 상태이므로 **착수 시 실기기 검증 통과를 채택 조건으로 둔다.** 미통과 시 대안(expo-location)으로 교체하며, 교체해도 단발 측위 · 서버 판정 계약은 바뀌지 않는다 |

## 푸시 알림을 v1에 두지 않는다

- 푸시 알림(NTF-02)은 **v1.1 이월**이다. v1의 알림 배달은 인앱 단일 채널이며 앱은 SSE 구독으로 인앱 알림을 수신한다.
- 따라서 **푸시 전달·표시 라이브러리를 v1 스택에 두지 않는다** — FCM 클라이언트(@react-native-firebase 계열)와 로컬 알림 표시 라이브러리를 의존성에 넣지 않고, 기기 토큰 등록·해제 경로도 만들지 않는다. 저장 구조를 미리 만들지 않는 결정의 정본은 [../05_database/13_notification.md](../05_database/13_notification.md)다.
- 도입 시점에는 전달 축(@react-native-firebase)과 표시 축(로컬 알림 라이브러리)을 **그 시점의 유지보수 상태 기준으로 다시 평가**한다 — 오랫동안 표준이던 표시 라이브러리가 2026-04에 아카이브됐고 후속 포크의 존속성이 아직 검증되지 않았다.
- 알림 본문에 금액·주민번호·계좌를 넣지 않는 규칙은 채널과 무관하게 적용된다([../10_security/04_pii_protection.md](../10_security/04_pii_protection.md)).

## 명세서 PDF 수신

앱은 인앱 PDF 뷰어를 두지 않는다. 명세서 본문은 네이티브 표로 그리고(APP-PAYSLIP), PDF는 내려받기 대상일 뿐이다.

| 항목 | 내용 |
|------|------|
| 수신 | 서버가 발급한 **1회용 다운로드 토큰 URL을 앱이 직접 HTTP로 수신**한다. 외부 브라우저로 URL을 넘기지 않는다 — 넘기면 인증 컨텍스트가 끊기고 토큰이 앱 밖에 남는다 |
| 저장 | 앱 캐시 디렉터리에 저장한다. 사용자 문서 영역에 영구 보관하지 않는다 |
| 열람·공유 | OS 기본 뷰어 또는 공유 시트로 넘긴다. 앱 안에서 렌더하지 않는다 |
| 구현 | react-native-blob-util로 스트림 수신·파일 저장을 처리한다 |
| 정리 | 앱 종료·로그아웃 시 캐시 파일을 지운다. 기기에 명세서 파일이 누적되지 않게 한다 |

다운로드 토큰 발급·검증 계약의 정본은 [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)이고 화면 계약은 [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md)다.

## 전자서명

| 항목 | 내용 |
|------|------|
| 대상 | 근로계약 전자서명(HRM-07) |
| 구현 | react-native-gesture-handler로 궤적을 받아 react-native-svg 패스로 그리고, react-native-view-shot으로 이미지를 캡처해 서버에 업로드한다 |
| 웹뷰 기반 라이브러리 미채택 | 웹뷰 캔버스 방식은 서명 데이터를 base64 문자열로 브리지 왕복시키고 앱에 웹뷰 런타임을 통째로 들인다 |
| 서명 검증 | 서명 이미지 자체는 증빙 자료다. 계약 체결의 법적 효력 요건(교부·보존)은 서버가 관리한다 — 정본은 [../03_requirements/04_hr.md](../03_requirements/04_hr.md) |

## 오프라인 기록을 두지 않는다

- 앱은 **온라인 전제**로 동작한다. 네트워크가 없으면 체크인·신청을 큐에 쌓지 않고 그 자리에서 실패로 표시한다.
- 오프라인 근태 기록(ATT-14)은 v1 범위가 아니다.
- 근거는 판정 시점의 일관성이다. 오프라인 큐를 두면 체크인 시각이 기록 시각과 갈라지고, 지오펜스·지각 판정·마감 잠금이 어느 시각을 기준으로 하는지가 요청마다 달라진다.
- 데이터 모델에는 멱등키(client_event_id)가 이미 있어 재시도 중복은 서버가 흡수한다 — 확장 지점 표기의 정본은 [../05_database/04_attendance.md](../05_database/04_attendance.md)다.

## 관련 문서

- 기술 선정 사유 → [06_decisions_rationale.md](./06_decisions_rationale.md)
- 백엔드 계층 → [03_backend.md](./03_backend.md)
- 빌드·테스트·배포 → [05_tooling_devops.md](./05_tooling_devops.md)
- 인증·세션 정본 → [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md)
- 실시간·파일 파이프라인 정본 → [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)
- 위치정보 보호 정본 → [../10_security/05_location_privacy.md](../10_security/05_location_privacy.md)
- 알림 범위 정본 → [../02_features/10_notification.md](../02_features/10_notification.md)
- 직원 앱 화면 명세 → [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md)
