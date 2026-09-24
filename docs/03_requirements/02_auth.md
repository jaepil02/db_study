# REQ-AUT — 인증·인가 요구사항

> **대상**: 인증·인가(AUT · NestJS auth 모듈)의 동작 계약 — 로그인 · 토큰 수명과 보관 · 갱신 · 폐기 · 신원 확인 · 역할 인가 · 레이트 리밋 · 요청 출처 방어 · 저장소 장애 시 거동 — REQ-AUT-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W3 판정 반영 — 레이트 리밋 키 rl:{user_id}:{unix_minute} → **rl:{class}:{user_id}:{unix_minute}**(엔드포인트 차원 = 한도 등급) · 권한 캐시 키 미정 → **cache:perm:{user_id}** · sess:{session_id} → **패턴 폐지 · sess 접두 예약**(정본 05_data_stores/05)
> **원천**: 원본 architecture.md §2 · §6 · §8 · §8.2 · §10.1 · §11 · §11.2 · §17 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.4(커밋 ff66a37) · 원본 implementation_plan.md §5 S7 · §7.5(커밋 ff66a37) · D-02 · D-07 · [../02_features/01_auth.md](../02_features/01_auth.md) AUT-01~07 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) auth · common 네임스페이스 · [01_global_rules.md](./01_global_rules.md) REQ-GLB-08 · 09 · 19

이 문서는 AUT 기능 7개가 **어떻게 동작하고 어떻게 실패하는가**를 고정한다. 기능의 존재와 경계는 [../02_features/01_auth.md](../02_features/01_auth.md), 역할 값과 역할 × 기능 대응은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md), 토큰 수명 · 한도 값의 정본은 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)가 갖는다. 여기서는 수명과 한도를 **값이 아니라 조회 계약**으로만 쓴다.

**인증은 S7에 온다**(D-07). S2~S6의 표면은 무인증이며 127.0.0.1 바인드 안에 있다. 이 문서의 요구 중 REQ-AUT-12(CORS)만 S2부터 적용되고 나머지는 S7에 적용된다 — 적용 시점이 다른 두 수치를 같은 조건으로 비교하지 않는 계약은 REQ-AUT-16이 갖는다.

**AUT의 상태 셋 중 둘이 Redis 캐시 계열에 있다**(auth:refresh · rl). 캐시 계열의 실패 전략은 degrade(REQ-GLB-09)지만 **auth:refresh에는 우회할 원천 DB가 없다.** 이 비대칭이 웨이브 인계 "Redis 중단 시 로그인 · 갱신 · 레이트 리밋"을 판정하는 축이며 §Redis 장애 시 거동 판정이 닫는다.

## 요구사항 — 로그인과 토큰

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-AUT-01** | 로그인은 email과 password_hash(적응형 해시)를 대조하고, 성공하면 JWT 액세스 토큰과 불투명 리프레시 토큰을 발급한다. 불일치는 auth.invalid_credentials/401이다. 비밀번호 원문 · 해시를 로그 · 응답 · 감사 로그에 남기지 않는다 | 원본 architecture.md §6 user_account · §11 · §11.2 | 해시 없이 저장하면 로컬 볼륨 스냅샷(tgz)이 곧 비밀번호 사본이 된다. 로그에 원문이 남으면 스냅샷 · 로그 파일 공유로 새어 나간다 | 잘못된 비밀번호 로그인 주입 → 401 · 코드 조회 · 로그 파일에서 입력 비밀번호 문자열 grep 0건 | AUT-01 | F-05 | auth.invalid_credentials/401 · common.validation_failed/400 |
| **REQ-AUT-02** | **비활성 계정(user_account.is_active false)의 로그인은 auth.invalid_credentials/401로 거절한다** — 자격 불일치와 같은 코드 · 같은 응답 본문이다. 비밀번호가 맞든 틀리든 해시 대조를 끝까지 수행해 두 경로의 응답 시간을 가르지 않는다 | 원본 architecture.md §6 is_active · 웨이브 인계(비활성 계정은 invalid_credentials 재사용) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) HTTP 상태 규약 | 별도 코드를 주면 이메일을 바꿔 가며 로그인해 **어느 계정이 존재하고 비활성인지**를 응답만으로 셀 수 있다. 해시 대조를 생략하고 먼저 거절하면 응답 시간 차이로 같은 정보가 샌다 | 비활성 계정 · 없는 계정 · 틀린 비밀번호 세 경우의 응답 코드 · 본문 · p50 지연 대조 | AUT-01 | F-05 | auth.invalid_credentials/401 |
| **REQ-AUT-03** | 리프레시 토큰은 auth:refresh:{refresh_token_id}에 사용자 ID를 값으로 저장하고 TTL을 **반드시** 단다 — TTL은 캐시 계열 래퍼의 필수 파라미터로만 설정한다. 수명은 2계층 조정값이며 조회 계약은 "발급 시점 기준 · 소유 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md)"(현행 참고 14일). rt: 접두를 쓰지 않는다 | 원본 architecture.md §8.2 · 원본 implementation_plan.md §7.5 · REQ-GLB-08 | TTL 없는 리프레시 키는 축출되지 않고 영원히 남아 폐기하지 않은 토큰이 무기한 유효하다. rt: 접두를 빌리면 TTL 금지 계열 아래 TTL 키가 생겨 어느 래퍼 규칙도 적용되지 않는다 | 로그인 직후 TTL auth:refresh:{id} 조회(양수) · 캐시 래퍼 밖에서 auth: 접두 SET 호출이 없는지 코드 검색 | AUT-01 | F-05 | 해당 없음 |
| **REQ-AUT-04** | 리프레시 토큰은 브라우저에 **httpOnly 쿠키로만** 두고 로그인 · 갱신은 BFF(Next.js Route Handler)를 거친다. 쿠키는 SameSite=Lax · Secure off(로컬 http) · httpOnly 유지다. 액세스 토큰은 쿠키에 두지 않고 브라우저 메모리에서 Authorization 헤더로만 보낸다. 수명은 2계층 조정값(현행 참고 15분 · 소유 상동) | 원본 architecture.md §2 BFF 경로 · §11.2 | 브라우저가 로그인 응답을 직접 받으면 리프레시 토큰을 JS가 읽어야 해 쿠키 은닉이 무너진다. 액세스 토큰을 쿠키에 두면 직결 요청마다 CSRF 방어가 필요해진다 | 브라우저 개발 도구에서 document.cookie에 리프레시 토큰이 보이지 않는지 · 직결 요청에 쿠키 대신 Bearer 헤더만 있는지 확인 | AUT-01 · AUT-02 | F-05 | 해당 없음 |
| **REQ-AUT-05** | 갱신은 BFF가 쿠키의 리프레시 토큰으로 새 액세스 토큰을 받아 원요청을 **1회만** 다시 보낸다. 키가 없으면(폐기 · 수명 경과 · 메모리 압박 축출) auth.refresh_invalid/401이고 클라이언트는 재로그인한다 | 원본 architecture.md §11.2 · [../02_features/01_auth.md](../02_features/01_auth.md) 토큰 경로 | 재시도를 1회로 막지 않으면 서명 불량 토큰이 갱신 루프를 돈다. 축출 원인을 모르면 maxmemory 하향 실험 중의 로그아웃을 결함으로 신고한다 | 액세스 만료 후 요청 → 갱신 1회 → 원요청 성공 · maxmemory 하향 실험에서 refresh_invalid 발생과 evicted_keys 증가의 동시 관측 | AUT-02 | F-05 | auth.refresh_invalid/401 |
| **REQ-AUT-06** | 로그아웃은 auth:refresh 키를 즉시 삭제한다. 액세스 토큰은 무상태 JWT라 수명 만료까지 유효하며 폐기 목록을 두지 않는다 — 즉시 무효화가 필요한 쪽을 리프레시로 몰았다 | 원본 architecture.md §8.2 · §11 · §18 | 로그아웃 후 키가 남으면 탈취된 쿠키로 계속 갱신된다. 액세스 폐기 목록을 두면 모든 요청이 Redis 조회를 타 무상태 검증의 이점이 사라진다 | 로그아웃 후 EXISTS auth:refresh:{id} 0 · 같은 쿠키로 갱신 → refresh_invalid | AUT-03 | F-05 | auth.refresh_invalid/401 |

- **B형 — 사용자가 로그아웃되는 것은 Stream 적체의 증상일 수 있다.** auth 계열은 TTL을 가진 캐시 계열이라 volatile-lru의 축출 후보다. 그래서 MAXLEN 산정의 정본 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)이 세션 예산을 Stream보다 먼저 떼어 둔다 — 정상 구성에서 refresh_invalid가 축출로 나면 산정이 틀린 것이다.

## 요구사항 — 신원 확인과 인가

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-AUT-07** | 인증이 필요한 전 REST 표면은 Authorization 헤더의 JWT 형식 · 서명 · 만료를 검증한다. 헤더 없음 · 형식 · 서명 불량은 auth.unauthenticated/401, 만료는 auth.token_expired/401로 **가른다** | 원본 architecture.md §11.2 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) auth | 만료를 서명 불량과 같은 코드로 내면 클라이언트가 조용한 갱신 대신 재로그인으로 떨어진다. 반대로 묶으면 서명 불량에도 갱신 루프를 돈다 | 헤더 없음 · 변조 토큰 · 만료 토큰 세 경우 주입 후 코드 대조 | AUT-04 | F-03 · F-04 · F-05 | auth.unauthenticated/401 · auth.token_expired/401 |
| **REQ-AUT-08** | WebSocket은 핸드셰이크 뒤 **첫 메시지**로 받은 토큰을 검증한다. 쿼리 파라미터로 토큰을 받지 않는다. 실패는 HTTP 응답이 아니라 연결 종료이며 종료 코드의 정본은 [../07_api/11_websocket.md](../07_api/11_websocket.md) | 원본 architecture.md §11.2 WebSocket 인증 | 쿼리 파라미터 토큰은 URL · 접근 로그에 남아 로그 파일이 곧 토큰 사본이 된다 | 쿼리 파라미터 토큰으로 연결 시 인증 미성립 · 첫 메시지 토큰 누락 시 연결 종료 확인 · 접근 로그 grep | AUT-04 | F-07 | 해당 없음 — 연결 종료 |
| **REQ-AUT-09** | 엔드포인트마다 Guard가 사용자의 역할 집합(user_role 다대다)을 표면 권한과 대조하고 **합집합**으로 판정한다. 역할 × 표면 대응은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)만 따른다. 역할이 0개인 인증 사용자는 갱신 · 로그아웃만 부른다. 권한 밖이면 auth.forbidden/403 | 원본 architecture.md §6 role · user_role · §18 · 권한 매트릭스 판정 | 누적 계층으로 판정하면 ADMIN이 판정 전수를 보지 않고 임계값을 바꿀 수 있어 튜닝 루프가 끊긴다. 표면별 권한을 코드에 하드코딩하면 매트릭스와 구현이 두 정본이 된다 | 매트릭스의 거부 셀 전수를 역할별 계정으로 호출해 403 대조 · 역할 0개 계정으로 조회 표면 호출 → 403 | AUT-05 | F-03 · F-04 · F-05 · F-06 | auth.forbidden/403 |
| **REQ-AUT-10** | 사용자 권한 사본은 cache-aside로 캐시 계열 키에 두고 **권한 변경 시 즉시 삭제**한다. 키는 cache:perm:{user_id}이고 TTL은 2계층 조정값(현행 참고 300초 · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). 캐시 미스 · Redis 불가면 PostgreSQL role · user_role에서 읽는다 | 원본 architecture.md §10.1 · REQ-GLB-09 | 즉시 삭제하지 않으면 회수한 권한이 TTL만큼 살아 있다. Redis 불가 시 권한 판정을 실패시키면 캐시 장애가 전 표면 장애가 된다 | 역할 회수 직후 같은 토큰으로 권한 밖 표면 호출 → 403 · Redis 중단 중 권한 판정이 PostgreSQL로 성립하는지 확인 | AUT-05 | F-05 | auth.forbidden/403 |

## 요구사항 — 레이트 리밋과 요청 출처 방어

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-AUT-11** | 레이트 리밋은 사용자 · 토큰 기준 분당 요청 수를 rl:{class}:{user_id}:{unix_minute} INCR로 세고 키에 TTL을 단다 — class는 한도 등급(엔드포인트 묶음)이다. **IP 기준으로 세지 않는다.** 한도 초과는 common.rate_limited/429다. 한도 값은 2계층 조정값이며 소유 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md). timeseries/query · export에 더 엄격한 한도는 class 자리로 표현한다 — class 값 집합과 등급별 한도는 같은 소유처가 정한다 | 원본 architecture.md §8.2 · §11.2 · §18 | IP 기준이면 모든 요청이 127.0.0.1에서 오므로 **전원을 한 사용자로 세어** 한 사용자의 폭주가 모두를 막는다. TTL 없는 rl 키는 분마다 쌓여 캐시 예산을 잠식한다 | 두 계정으로 동시에 한도 직전까지 요청해 서로 영향이 없는지 · rl 키 TTL 양수 조회 · 한도 초과 요청 → 429 | AUT-06 | F-03 · F-04 · F-05 | common.rate_limited/429 |
| **REQ-AUT-12** | CORS 허용 오리진은 http://localhost:3001 **하나**이며 와일드카드를 금지한다. S2부터 적용한다 — 웹(3001)이 api(3000)를 직결하는 순간 오리진이 다르다 | 원본 architecture.md §11.2 · §18 · 원본 tech_stack.md §10.4 | 와일드카드를 쓰면 같은 머신 브라우저의 임의 페이지가 로그인된 사용자 권한으로 api를 부른다. S7까지 미루면 S2 수직 슬라이스의 웹 1페이지가 직결 호출에서 막힌다 | 다른 Origin 헤더로 사전 요청 → 허용 헤더 없음 확인 · S2 웹 화면의 직결 호출 성공 | AUT-07 | F-03 · F-04 · F-07 | 해당 없음 — 브라우저 차단 |
| **REQ-AUT-13** | WebSocket 핸드셰이크의 Origin을 CORS 허용 목록과 같은 목록으로 검증한다. 보안 헤더(X-Content-Type-Options · Referrer-Policy 등)를 부여하되 HSTS는 끈다. 앞단 프록시가 없으므로 이 방어는 전부 api가 수행한다 | 원본 architecture.md §11.2 · §18 · 원본 tech_stack.md §10.4 | Origin을 검증하지 않으면 CORS가 막는 오리진이 WebSocket으로는 실시간 데이터를 받는다. 로컬 http에서 HSTS를 켜면 브라우저가 localhost를 https로 고정해 웹 접속이 끊긴다 | 허용 밖 Origin으로 WebSocket 연결 → 종료 · 응답 헤더 조회(HSTS 없음 · 나머지 있음) | AUT-07 | F-07 | 해당 없음 — 연결 종료 |

## 요구사항 — 저장소 장애 · 적용 범위

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-AUT-14** | Redis에 접속할 수 없으면 ① 로그인 · 갱신 · 로그아웃은 **거절**하고 ② 레이트 리밋은 **세지 않고 통과(degrade)**하며 그 요청 수를 계측하고 ③ 액세스 토큰 검증(무상태)과 권한 판정(PostgreSQL 우회)은 계속한다. ①의 코드는 auth.token_store_unavailable/503이다. 로그아웃이 거절돼도 BFF는 쿠키를 지운다 | 원본 architecture.md §8 실패 전략 · §17 Redis 중단 · REQ-GLB-09 · 웨이브 인계 판정 | 로그인을 통과시키면 저장되지 않은 리프레시 토큰이 발급되어 폐기가 불가능하다. 레이트 리밋을 fail-closed로 두면 Redis 중단이 **시계열 조회까지 전부 막아** "조회 API는 캐시를 우회해 DB 직접 조회"(원본 §17)가 거짓이 된다. 갱신 실패를 refresh_invalid로 내면 클라이언트가 재로그인으로 가고 로그인도 실패해 원인을 오판한다 | docker stop redis 3분 — 로그인 · 갱신 거절 코드 · 시계열 조회 200 · 레이트 리밋 통과 계수 증가를 동시에 조회 | AUT-01 · AUT-02 · AUT-03 · AUT-06 | F-05 · F-10 | auth.token_store_unavailable/503 |
| **REQ-AUT-15** | PostgreSQL에 접속할 수 없으면 로그인은 common.postgres_unavailable/503으로 거절한다. 이미 발급된 액세스 토큰의 검증은 계속하며, 권한 캐시가 비어 있는 사용자의 인가는 같은 코드로 거절한다 | 원본 architecture.md §17 PostgreSQL 중단 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) common | 자격 증명 불일치 코드로 내면 사용자가 비밀번호를 의심해 입력을 바꾸며 재시도한다 | docker stop postgres — 로그인 503 · 권한 캐시가 있는 사용자의 시계열 조회 200 확인 | AUT-01 · AUT-05 | F-05 · F-10 | common.postgres_unavailable/503 |
| **REQ-AUT-16** | 인가는 S7부터 적용한다. S2~S6 표면은 무인증이지만 127.0.0.1 바인드 안에 있다. S7 전후의 조회 · 부하 주입(모드 C) 수치는 같은 스위치 상태여도 **다른 조건**이며 커밋 해시로 가르고 서로 비교하지 않는다. 무인증 표면은 /api/v1/health · /metrics 둘이고, /api/v1/ingest/bulk는 게이트가 켜진 뒤 인증을 요구한다 | D-07 · 원본 implementation_plan.md §5 S7 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · REQ-GLB-19 | S7 전후 수치를 한 표에 섞으면 인증 비용이 캐시 효과처럼 읽힌다. health에 인증을 걸면 Compose healthcheck가 로그인을 요구해 기동 순서가 순환한다 | 측정 기록의 커밋 해시 대조 · S7 커밋에서 무인증 호출 시 health · metrics 200, 그 밖의 표면 401 | AUT-04 · AUT-05 | F-03 · F-04 · F-09 | auth.unauthenticated/401 |
| **REQ-AUT-17** | 계정 생성 · 역할 부여 표면을 두지 않는다. 계정과 역할은 시드로만 만들며 학습자 계정 하나에 세 역할을 모두 부여한다 | 원본 architecture.md §11 API 표 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) 역할 정의 | 원본에 없는 사용자 관리 표면을 만들면 그 표면의 권한 주체가 정해지지 않은 채 열린다 | API 표면 목록에 users · roles 쓰기 경로가 없는지 조회 · 시드 후 user_role 3행 확인 | AUT-01 · AUT-05 | F-05 | 해당 없음 |

## Redis 장애 시 거동 판정

웨이브 인계 "Redis 중단 시 로그인 · 갱신 · 레이트 리밋 — 거절인지 우회인지"의 판정이다. 판정 축은 하나다 — **우회할 원천이 있는가.**

```plain
Redis 접속 불가
├─ 캐시 사본이 있는 상태인가
│  ├─ 권한 사본(cache 계열)        원천 PostgreSQL 있음   → 우회           REQ-AUT-10
│  └─ 레이트 리밋 카운터(rl)        원천 없음 · 방어 계측   → 통과 + 계측     REQ-AUT-14 ②
├─ 원본이 Redis에만 있는 상태인가
│  └─ 리프레시 토큰(auth:refresh)   원천 없음 · 폐기 근거   → 거절           REQ-AUT-14 ①
└─ Redis를 쓰지 않는 검사인가
   └─ 액세스 토큰 검증(JWT)          무상태                → 계속           REQ-AUT-07
```

- **레이트 리밋과 리프레시 토큰은 둘 다 원천이 없는데 결론이 반대다.** 리프레시 토큰은 없으면 폐기를 보장할 수 없어 발급 자체가 결함이 되지만, 레이트 리밋 카운터는 없어도 요청 하나하나의 정당성은 인증 · 인가가 이미 판정했다. 레이트 리밋은 자원 보호 장치이지 신원 경계가 아니므로 통과시키고 그 양을 센다.
- **거절 코드를 따로 둔 이유(auth.token_store_unavailable/503)** — 기존 코드는 대응이 다르다. refresh_invalid는 "다시 로그인"이고, postgres_unavailable은 원인 저장소가 다르며, realtime.latest_unavailable은 realtime 표면 소유다. 대응은 "백오프 후 재시도"라 503이다.
- **잔여 — Redis 불가 중 로그아웃한 토큰은 TTL이 끝나기 전 Redis가 복구되면 다시 유효하다.** BFF가 쿠키를 지우므로 정상 브라우저 경로는 닫히지만 쿠키 사본을 가진 쪽은 막지 못한다 → [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) 등재 대상.

## 기능 → REQ 대응

[../02_features/01_auth.md](../02_features/01_auth.md) 기능 목록의 AUT 기능 전부가 하나 이상의 REQ-AUT에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| AUT-01 | 로그인 | REQ-AUT-01 · 02 · 03 · 04 · 14 · 15 · 17 | 7 |
| AUT-02 | 토큰 갱신 | REQ-AUT-04 · 05 · 14 | 3 |
| AUT-03 | 로그아웃 | REQ-AUT-06 · 14 | 2 |
| AUT-04 | 신원 확인 | REQ-AUT-07 · 08 · 16 | 3 |
| AUT-05 | 역할 기반 인가 | REQ-AUT-09 · 10 · 15 · 16 · 17 | 5 |
| AUT-06 | 레이트 리밋 | REQ-AUT-11 · 14 | 2 |
| AUT-07 | 요청 출처 방어 | REQ-AUT-12 · 13 | 2 |

### 검산

- 기능 = AUT-01~07 = **7** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 7 + 3 + 2 + 3 + 5 + 2 + 2 = **24**
- REQ-AUT 채번 = 01~17 = **17** · 기능에 대응하지 않는 REQ **0**

## 에러 코드

[../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드 중 이 문서가 인용하는 것이다.

| 코드 | 발생 REQ | 클라이언트 대응 |
|------|------|------|
| auth.invalid_credentials/401 | REQ-AUT-01 · 02 | 입력을 고쳐 다시 로그인 |
| auth.unauthenticated/401 | REQ-AUT-07 · 16 | 로그인 |
| auth.token_expired/401 | REQ-AUT-07 | BFF 갱신 후 원요청 1회 재시도 |
| auth.refresh_invalid/401 | REQ-AUT-05 · 06 | 다시 로그인 |
| auth.forbidden/403 | REQ-AUT-09 · 10 | 요청 중단 |
| common.rate_limited/429 | REQ-AUT-11 | 다음 분 창까지 대기 |
| common.validation_failed/400 | REQ-AUT-01 | 요청 수정 |
| common.postgres_unavailable/503 | REQ-AUT-15 | 백오프 후 재요청 |
| auth.token_store_unavailable/503 | REQ-AUT-14 | 백오프 후 재요청 — 재로그인하지 않는다 |

- 검산: 유효 코드 인용 = auth 6 + common 3 = **9**행 · 채번 대기 **0**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 레이트 리밋의 엔드포인트 차원 | **W3 판정** — 키 rl:{class}:{user_id}:{unix_minute}로 한도 등급 자리를 둔다. class 값 집합 · 등급별 한도는 미정 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)(W7) |
| 권한 캐시 키 모양 | **W3 확정** — cache:perm:{user_id} | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| sess:{session_id} 소비 기능 | **W3 판정** — 키 패턴 폐지 · sess 접두는 캐시 계열 예약으로 유지(세션 키가 다시 생길 때 정책이 이미 정해져 있게) | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| WebSocket 인증 실패 · Origin 불일치 종료 코드 | 미정 | [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5) |
| Redis 불가 중 레이트 리밋 통과 계수의 메트릭 이름 | **신규 미확인** — REQ-AUT-14 ②가 요구한다 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |
| 토큰 수명 · 한도 값 | 2계층 조정값 — 현행 액세스 15분 · 리프레시 14일(원본 architecture.md §11.2) | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |

## 관련 문서

- [../02_features/01_auth.md](../02_features/01_auth.md) — AUT 기능 목록 · 토큰 경로
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 기능 판정 정본
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-08 키 계열 · REQ-GLB-09 실패 전략 · REQ-GLB-19 로컬 전용
- [../07_api/03_auth.md](../07_api/03_auth.md) — login · refresh · logout 표면
- [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) — 인증 · 인가 방어선 리뷰
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — auth · common 코드 정본
