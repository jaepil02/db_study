# AUT — 인증 표면 (03_auth)

> **대상**: AUT 도메인이 소유하는 REST 표면 — 로그인 · 토큰 갱신 · 로그아웃의 요청 · 응답 · 실패 · 경로 계약 · 계정 · 역할 관리 표면의 부재 판정
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — BFF 인증 Route Handler **Origin 대조** 추가 · 미설계 3행(회전 · 로그인 시도 제한 · CORS 제외) 닫힘 — 표면 수 불변(정본 12_security/01 · 03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 실험 자리 W6 결과 반영(정본 10_observability/01 · 06)
> **원천**: 원본 architecture.md §11 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §7.2(커밋 ff66a37) · REQ-AUT-01~06 · 14 · 15 · 16 · 17 · D-07 · ADR-02 · [../02_features/01_auth.md](../02_features/01_auth.md) AUT-01~03 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 인증 흐름 · [01_conventions.md](./01_conventions.md)

AUT는 **표면 셋만 소유하고 나머지 전 표면에 끼어드는 도메인**이다. 신원 확인 · 역할 대조 · 레이트 리밋 · 출처 방어(AUT-04~07)는 표면이 아니라 횡단 검사이며, 그 헤더 · 응답 규약은 [01_conventions.md](./01_conventions.md) §인증 헤더와 출처 방어가 갖는다. 이 문서는 토큰을 **발급 · 교환 · 폐기**하는 세 표면만 적는다.

**세 표면의 호출 주체는 브라우저가 아니라 BFF다.** 리프레시 토큰은 httpOnly 쿠키로만 브라우저에 있고(REQ-AUT-04), 그 쿠키를 읽고 쓰는 자리는 Next.js Route Handler뿐이다. 그래서 api는 리프레시 토큰을 **본문으로** 주고받고, 쿠키를 심고 지우는 일은 BFF가 한다 — api(3000)가 쿠키를 심으면 웹 오리진(3001)의 Route Handler가 아니라 api 오리진 쿠키가 되어 BFF가 읽을 수 없다.

**인증은 S7에 붙는다**(D-07). S2~S6에는 이 문서의 표면이 없고, 다른 표면은 무인증으로 동작한다.

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 브라우저 → BFF → api만 — 직결 호출은 CORS 응답 헤더가 없어 브라우저가 응답을 읽지 못한다 · **BFF 인증 Route Handler는 Origin 헤더가 http://localhost:3001이 아니면 거절한다** — SameSite는 포트를 보지 않아 localhost의 다른 웹 앱 요청에도 리프레시 쿠키가 실린다 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 · REQ-AUT-04 · REQ-AUT-13 · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) §BFF 인증 경로의 출처 검사 |
| 리프레시 토큰 전달 | api ↔ BFF는 본문 refreshToken · BFF ↔ 브라우저는 httpOnly 쿠키(SameSite=Lax · Secure off · httpOnly on) | 원본 architecture.md §11.2 |
| 액세스 토큰 | JWT · 본문 accessToken으로 발급 · 브라우저 메모리에 두고 Authorization 헤더로만 보낸다 | REQ-AUT-04 |
| 수명 | 액세스 현행 참고 15분 · 리프레시 현행 참고 14일 — 2계층 · 소유 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | REQ-AUT-03 · 04 |
| 리프레시 저장 | auth:refresh:{refresh_token_id} — 값 user_id · TTL 필수(캐시 계열 래퍼) | REQ-AUT-03 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 레이트 리밋 | 로그인은 user_id가 없어 계수 대상이 아니다 · 갱신 · 로그아웃도 액세스 토큰 Guard 밖이라 계수하지 않는다 | [01_conventions.md](./01_conventions.md) §레이트 리밋 헤더 |
| 감사 | 세 표면은 PostgreSQL 업무 테이블을 바꾸지 않아 audit_log 대상이 아니다 | REQ-WRK-07 |

- 검산: 항목 = **7**
- **리프레시 토큰을 회전하지 않는다.** 갱신은 같은 리프레시 토큰으로 새 액세스 토큰만 준다 — 원본 · 요구사항에 회전 계약이 없다(원본 architecture.md §11.2). **W7 판정 — 회전하지 않는다**(정본 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) §회전 판정 — 회전은 탭 둘의 동시 갱신에서 정상 사용자를 로그아웃시킨다).

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | POST | /api/v1/auth/login | AUT-01 | 공개 | 없음 | auth.invalid_credentials/401 · common.validation_failed/400 · common.postgres_unavailable/503 · auth.token_store_unavailable/503 | AUTH-LOGIN | 원본 |
| 2 | POST | /api/v1/auth/refresh | AUT-02 | 리프레시 쿠키 | 없음 | auth.refresh_invalid/401 · common.validation_failed/400 · auth.token_store_unavailable/503 | 전 화면 | 원본 |
| 3 | POST | /api/v1/auth/logout | AUT-03 | 리프레시 쿠키 | 없음 | common.validation_failed/400 · auth.token_store_unavailable/503 | 전 화면 | 원본 |

- 검산: 표면 = REST **3** · 원본 3 + 신설 0 = **3**
- 역할 열 "리프레시 쿠키"는 액세스 토큰 Guard 밖이라는 뜻이다 — 역할이 0개인 사용자도 부른다(권한 매트릭스 §역할 정의). 그래서 공통 4종 중 auth.unauthenticated · token_expired · forbidden · rate_limited가 이 셋에는 나지 않는다.
- #2 · #3의 호출 화면 "전 화면"은 BFF가 어느 화면의 요청에서든 만료 갱신 · 로그아웃을 대행한다는 뜻이다.

## 표면 계약

### #1 POST /api/v1/auth/login

| 항목 | 계약 |
|------|------|
| 요청 | email(문자열 · 소문자 정규화 후 대조) · password(문자열) — 둘 다 필수 |
| 응답 200 | accessToken · accessExpiresAt · refreshToken · refreshExpiresAt · user(userId · email · roles) |
| 처리 | ① user_account 조회 ② password_hash 대조 — **계정이 없거나 비활성이어도 대조를 끝까지 수행** ③ JWT 발급 ④ auth:refresh:{id} 저장(TTL) ⑤ 응답. ④가 실패하면 ③의 토큰을 버리고 503 |
| 실패 | 자격 불일치 · 비활성 계정 · 없는 계정 → 모두 auth.invalid_credentials/401(같은 본문) · PostgreSQL 불가 → common.postgres_unavailable/503 · Redis 불가 → auth.token_store_unavailable/503 · 형식 위반 → common.validation_failed/400 |
| BFF 동작 | refreshToken을 쿠키로 심고 **브라우저 응답 본문에서 refreshToken을 뺀다** · accessToken · user만 브라우저로 |
| 관련 REQ | REQ-AUT-01 · 02 · 03 · 04 · 14 · 15 · 17 |
| 흐름 | F-05 |

- 검산: 실패 형태 = invalid_credentials · postgres_unavailable · token_store_unavailable · validation_failed = **4**
- **B형 — 비활성 계정에 invalid_credentials를 내는 것은 오류 메시지 누락이 아니다.** 별도 코드를 주면 이메일을 바꿔 가며 어느 계정이 존재하고 비활성인지를 응답만으로 셀 수 있다. 해시 대조를 생략해 먼저 거절해도 응답 시간 차이로 같은 정보가 샌다(REQ-AUT-02).
- **Redis 불가에서 로그인을 통과시키지 않는다.** 저장되지 않은 리프레시 토큰이 발급되면 로그아웃으로 폐기할 방법이 없다(REQ-AUT-14).

로그인 응답 예시다(api → BFF).

```json
{
  "accessToken": "eyJhbGciOi...",
  "accessExpiresAt": "2026-09-24T01:15:00.000Z",
  "refreshToken": "rft_4f9c2e...",
  "refreshExpiresAt": "2026-10-08T01:00:00.000Z",
  "user": { "userId": 1, "email": "learner@localhost", "roles": ["OPERATOR", "ENGINEER", "ADMIN"] }
}
```

- **user.roles는 표시용이다.** 인가 판정은 매 요청 Guard가 cache:perm:{user_id} 또는 PostgreSQL에서 다시 한다 — 화면이 roles로 버튼을 숨겨도 표면은 따로 막는다.
- 시각 필드는 이름이 At으로 끝나 UTC ISO 8601이다([01_conventions.md](./01_conventions.md) §시각 직렬화).

### #2 POST /api/v1/auth/refresh

| 항목 | 계약 |
|------|------|
| 요청 | refreshToken(BFF가 쿠키에서 꺼내 본문으로) |
| 응답 200 | accessToken · accessExpiresAt — 리프레시 토큰은 그대로(회전 없음) |
| 처리 | auth:refresh:{id} 조회 → user_id 확인 → 새 JWT. 계정 비활성 · 역할 회수는 여기서 막지 않고 다음 요청의 Guard가 판정한다 |
| 실패 | 키 없음(로그아웃 폐기 · 수명 경과 · **메모리 압박 축출**) → auth.refresh_invalid/401 · Redis 불가 → auth.token_store_unavailable/503 |
| BFF 동작 | 원요청의 auth.token_expired/401을 받았을 때만 부르고 **원요청을 1회만** 다시 보낸다 · refresh_invalid면 쿠키를 지우고 로그인 화면으로 |
| 관련 REQ | REQ-AUT-04 · 05 · 14 |
| 흐름 | F-05 |

- **refresh_invalid와 token_store_unavailable을 가르는 이유는 대응이 반대이기 때문이다.** 앞은 재로그인, 뒤는 백오프다. Redis 중단을 refresh_invalid로 내면 클라이언트가 재로그인으로 가고 로그인도 503이라 원인을 비밀번호로 오판한다(REQ-AUT-14).
- **축출 실험 중의 refresh_invalid는 정상 관측값이다.** auth 계열은 TTL을 가진 캐시 계열이라 volatile-lru의 후보다 — maxmemory 하향 실험에서 evicted_keys 증가와 함께 관측되면 결함이 아니다(REQ-AUT-05).

### #3 POST /api/v1/auth/logout

| 항목 | 계약 |
|------|------|
| 요청 | refreshToken |
| 응답 204 | 본문 없음 — 키가 이미 없어도 204(자연 멱등) |
| 처리 | auth:refresh:{id} DEL. 발급된 액세스 토큰은 수명 만료까지 유효하다 — 폐기 목록을 두지 않는다 |
| 실패 | Redis 불가 → auth.token_store_unavailable/503 — **BFF는 이 경우에도 쿠키를 지운다** |
| 관련 REQ | REQ-AUT-06 · 14 |
| 흐름 | F-05 |

- **로그아웃 뒤에도 액세스 토큰이 남는 것은 결함이 아니다.** 즉시 무효화가 필요한 쪽을 리프레시로 몰아 Redis에 두었다 — 액세스 폐기 목록을 두면 모든 요청이 Redis 조회를 타 무상태 검증의 이점이 사라진다(REQ-AUT-06). 남는 창의 상한은 액세스 수명이다.
- 키가 없어도 204인 이유 — 404를 내면 BFF가 쿠키를 지우지 않는 분기가 생기고, 이미 로그아웃된 탭의 재시도가 오류로 보인다.

## 원본에 없는 표면 판정

| 후보 표면 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 계정 생성 · 역할 부여 · 비밀번호 변경 | **두지 않는다** — 시드로만 만든다 | REQ-AUT-17 · 원본 API 표에 사용자 관리 행이 없다 · 기능 목록(AUT-01~07)에 없다 | 권한 주체가 정해지지 않은 쓰기 표면이 열린다 — 역할 부여를 누가 하는지 매트릭스에 행이 없다 |
| 내 정보 조회(me) | 두지 않는다 — 로그인 응답의 user가 대신한다 | 기능 근거 없음 | 역할 표시가 필요하면 로그인 응답을 BFF 세션 상태로 둔다 — 새 표면은 인가 판정 한 자리를 더 만든다 |
| 세션 목록 · 전체 로그아웃 | 두지 않는다 | sess 접두는 예약이고 활성 키 패턴이 없다(W3 판정) | 리프레시 키를 사용자별로 찾으려면 KEYS가 필요하다 — 금지다 |

- 검산: 후보 = **3** · 신설 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 리프레시 토큰 회전 · 재사용 탐지 | **닫힘(W7)** — 회전하지 않는다 · 잔여(쿠키 사본의 수명 내 유효)는 보안 리뷰가 등재 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) |
| 로그인 시도 제한 | **닫힘(W7)** — 두지 않는다 · 대입 속도는 비밀번호 해시 비용이 묶는다 · 잔여 등재 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| auth 표면의 CORS 제외 판정 | **닫힘(W7)** — 판정 유지 · BFF 인증 경로 Origin 대조를 더했다 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| 로그인 · 갱신 p50 · 해시 비용 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · **W6 미채번**(카탈로그 39에 없다 · 필요해지면 EXP-40부터) | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 인증 헤더 · BFF 배정 · 에러 봉투
- [02_errors.md](./02_errors.md) — auth 네임스페이스 미러
- [../02_features/01_auth.md](../02_features/01_auth.md) — AUT-01~07 기능 정본
- [../03_requirements/02_auth.md](../03_requirements/02_auth.md) — REQ-AUT 계약
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 표면
- [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) — 수명 · 해시 · 방어선 리뷰
- [../08_screen/06_master_admin.md](../08_screen/06_master_admin.md) — AUTH-LOGIN 화면
