# AUT — 인증·인가 기능 명세

> **대상**: 인증·인가(AUT · NestJS auth 모듈) 기능 목록 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID AUT-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — "표면 번호는 W5 몫" → 각 API 문서가 채번(W5 완료)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(계정 · 역할 부여 경로 — 시드 전용) — 기능 수 불변
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — AUT-07 Origin 검증 S7 → **S2** · Host 헤더 허용 목록 추가 · 레이트 리밋 class 값 집합 · 토큰 수명 소유 닫힘 — 기능 수 불변(정본 12_security/01 · 03)
> **개정일**: 2026-09-24 — W3 판정 반영 — 권한 캐시 키 미정 → **cache:perm:{user_id}** · sess:{session_id} → **패턴 폐지 · sess 접두 예약** · 레이트 리밋 키 → **rl:{class}:{user_id}:{unix_minute}**(정본 05_data_stores/05)
> **개정일**: 2026-09-24 — W2 요구사항 판정 반영 — Redis 불가 시 거동 · 비활성 계정 로그인의 채번 보류를 판정 결과(token_store_unavailable/503 · invalid_credentials 재사용)로 닫는다
> **원천**: 원본 architecture.md §2 · §6 · §8.2 · §10.1 · §11 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §5 · §7.2 · §9(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · S7 · §7.5(커밋 ff66a37) · D-07 · D-11 · [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) auth 네임스페이스

AUT는 **신원을 확인하고 표면마다 역할을 대조하는 도메인**이다. 로그인 · 토큰 갱신 · 로그아웃 세 표면을 소유하고, 나머지 전 표면에는 Guard로 끼어든다. 앞단 프록시가 없으므로 CORS · 레이트 리밋 · WebSocket Origin 검증도 전부 이 모듈이 수행한다 — 이 계층을 대신할 곳이 없다(원본 architecture.md §11.2 · §18).

**인증은 학습 순서상 S7에 온다**(원본 implementation_plan.md §5 S2 "인증 없음" · D-07). S2~S6의 모든 표면은 무인증이며 127.0.0.1 바인드 안에 있다. 이것은 결함이 아니라 순서의 결과이고, S7에서 인가를 붙이면 인증 비용이 요청 경로에 더해지므로 **S7 전후의 조회 p95는 같은 스위치 상태라도 다른 조건**이다 — 측정 기록의 커밋 해시가 둘을 가른다. 역할 값과 역할 × 기능 대응의 정본은 [12_permission_matrix.md](./12_permission_matrix.md)이며 이 문서는 인가의 **기전**만 고정한다.

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 각 API 문서의 표면 요약 표가 채번한다).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **AUT-01** | 로그인 | 자격 증명을 user_account(email · password_hash)로 검증하고 JWT 액세스 토큰과 불투명 리프레시 토큰을 발급한다. 리프레시 토큰은 auth:refresh:{refresh_token_id}에 저장해 서버가 즉시 폐기할 수 있게 하고, 브라우저에는 **httpOnly 쿠키로만** 둔다. 그래서 로그인은 반드시 BFF(Next.js Route Handler)를 거친다 — 브라우저 직결이면 리프레시 토큰을 JS가 받아야 해 쿠키 은닉이 무너진다. 수명(현행 액세스 15분 · 리프레시 14일)은 2계층 조정값이며 소유처는 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | S7 | F-05 | 해당 없음 | 07_api/03_auth | PostgreSQL user_account · user_role · Redis auth:refresh |
| **AUT-02** | 토큰 갱신 | BFF가 쿠키의 리프레시 토큰을 새 액세스 토큰으로 교환해 Authorization 헤더에 실어 원요청을 1회 다시 보낸다. 리프레시 키가 없으면 재로그인이다 — 폐기 · 수명 경과 외에 **메모리 압박 축출**도 원인이 된다(auth 계열은 TTL을 가진 캐시 계열이라 volatile-lru 후보다) | S7 | F-05 | 해당 없음 | 07_api/03_auth | Redis auth:refresh |
| **AUT-03** | 로그아웃 | auth:refresh 키를 즉시 삭제해 리프레시 토큰을 폐기한다. 액세스 토큰은 무상태 JWT라 수명 만료까지 유효하다 — 즉시 무효화가 필요한 쪽을 리프레시로 몰아 Redis에 둔 이유다 | S7 | F-05 | 해당 없음 | 07_api/03_auth | Redis auth:refresh |
| **AUT-04** | 신원 확인 | 인증이 필요한 전 REST 표면에서 Authorization 헤더의 JWT 형식 · 서명 · 만료를 검증한다. WebSocket은 핸드셰이크 뒤 **첫 메시지**로 받은 토큰을 검증한다 — 쿼리 파라미터로 받으면 토큰이 URL · 로그에 남는다. 만료와 서명 불량을 다른 코드로 가른다(만료는 갱신 1회로 복구되고 서명 불량은 복구되지 않는다) | S7 | F-03 · F-04 · F-05 · F-07 | 해당 없음 | 인증 필요 전 표면 · 07_api/11_websocket | 없음 — 무상태 검증 |
| **AUT-05** | 역할 기반 인가 | 엔드포인트마다 NestJS Guard가 사용자의 역할 집합(user_role — 다대다)을 표면 권한과 대조한다. 권한은 합집합으로 판정한다. 사용자 권한 사본은 cache-aside(현행 300초)이며 **권한 변경 시 즉시 삭제**한다 — 삭제하지 않으면 회수한 권한이 TTL만큼 살아 있다. 권한 캐시 키는 cache:perm:{user_id}다(W3 확정) | S7 | F-03 · F-04 · F-05 · F-06 · F-07 · F-09 | 해당 없음 | 인가 대상 전 표면 | PostgreSQL role · user_role · Redis cache 계열(권한 사본) |
| **AUT-06** | 레이트 리밋 | 사용자 · 토큰 기준 분당 요청 수를 rl:{class}:{user_id}:{unix_minute} INCR로 센다(class = 한도 등급 · W3). **IP 기준이 아니다** — 모든 요청이 127.0.0.1에서 오므로 IP 기준은 전원을 한 사용자로 센다. timeseries/query와 export에 더 엄격히 건다(원본 architecture.md §18). 한도 값은 2계층 조정값이며 소유처는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | S7 | F-03 · F-04 · F-05 | 해당 없음 | 인증 필요 전 REST 표면 | Redis rl |
| **AUT-07** | 요청 출처 방어 | CORS 허용 오리진을 http://localhost:3001 **하나**로 두고 와일드카드를 금지한다. WebSocket 핸드셰이크의 Origin 헤더를 같은 목록으로 검증한다. 보안 헤더를 부여하되 HSTS는 TLS 전제라 끈다. Host 헤더를 허용 목록(localhost · 127.0.0.1)과 대조한다 — DNS 재바인딩 방어. **CORS · WebSocket Origin 검증 · Host 대조는 S2부터 필요하다** — 웹(3001)이 api(3000)를 직결 호출하는 순간 오리진이 다르고, 세 검사 모두 토큰이 필요 없다. 보안 헤더와 BFF 인증 경로의 Origin 대조는 S7에 붙인다(정본 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) | S2(CORS · Origin · Host) · S7 | F-03 · F-04 · F-07 | 해당 없음 | 전 REST 표면 · 07_api/11_websocket | 없음 |

- 검산: AUT-01 · 02 · 03 · 04 · 05 · 06 · 07 = **7**. 단계별 S7 6(AUT-01~06) + S2 시작 1(AUT-07) = **7**
- **AUT는 스위치가 없다.** 인증 · 인가는 Redis 역할의 on/off 비교 대상이 아니라 방어선이다 — 방어선에 스위치를 달면 끈 상태가 측정 조건으로 정상화된다.
- 표면 셋(login · refresh · logout)만 AUT 소유이고, AUT-04~07은 **다른 도메인 표면에 끼어드는 횡단 기능**이다. 끼어드는 표면의 목록은 [12_permission_matrix.md](./12_permission_matrix.md)가 행으로 센다.

## 토큰 경로

로그인 · 갱신은 BFF를 거치고 그 뒤의 고빈도 요청은 직결한다. 경로 기준의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)다.

```plain
① 로그인        브라우저 → BFF → api(AUT-01)        리프레시는 httpOnly 쿠키 · 액세스는 브라우저 메모리
② 직결 요청      브라우저 → api(AUT-04 · 05 · 06)     Bearer 액세스 토큰 · CORS 허용 오리진 1개
③ 만료          api → auth.token_expired/401        클라이언트가 BFF에 갱신을 요청
④ 갱신          BFF → api(AUT-02)                   쿠키의 리프레시로 새 액세스 발급 → 원요청 1회 재시도
⑤ WebSocket     브라우저 → api 핸드셰이크(Origin 검증) → 첫 메시지 토큰(AUT-04)
```

- **BFF가 남는 가장 중요한 이유가 ①과 ④다.** 리프레시 토큰을 브라우저 JS에 노출하지 않으려면 쿠키를 서버에서만 읽어야 하고, 그 서버가 Route Handler다.
- **localhost:3001과 localhost:3000은 포트가 달라도 same-site다.** SameSite=Lax가 그대로 동작하고, 로컬 http라 Secure만 끄고 httpOnly는 유지한다(원본 architecture.md §11.2).
- **③은 조용한 1회 재시도로 끝나야 한다.** 만료를 서명 불량과 같은 코드로 내면 클라이언트가 재로그인으로 떨어진다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| AUT-01 | 계정 생성 · 역할 부여 표면을 두지 않는다 — 원본 API 표(원본 architecture.md §11)에 사용자 관리 표면이 없다 | 시드 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md)(W3) · §미확인 · 미설계 등재 |
| AUT-02 | 액세스 토큰을 쿠키에 두지 않는다 | 브라우저 메모리 — 직결 요청의 Bearer |
| AUT-03 | 발급된 액세스 토큰을 폐기하지 않는다 — 무상태라 폐기 목록이 없다 | 수명 만료 |
| AUT-04 | 역할 판단을 하지 않는다 — 신원만 확인한다 | AUT-05 |
| AUT-05 | 표면별 권한 값을 정의하지 않는다 · **스위치 전환 권한을 다루지 않는다**(스위치는 환경변수 + 재기동) | [12_permission_matrix.md](./12_permission_matrix.md) · [13_switch_matrix.md](./13_switch_matrix.md) |
| AUT-06 | IP 기준 제한을 하지 않는다 · 한도 값을 소유하지 않는다 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| AUT-07 | 네트워크 경계를 방어하지 않는다 — LAN 노출은 127.0.0.1 바인드가 막는다 | [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| MST · TSQ · RLT · ALM · WRK · GEN | AUT → 대상 | 인가(Guard) | 각 표면의 요청 전에 AUT-04 · 05 · 06이 끼어든다. GEN의 부하 주입 표면은 환경변수 게이트가 먼저 걸린다([05_datagen.md](./05_datagen.md) GEN-07) |
| OBS | 없음 | 해당 없음 | /api/v1/health · /metrics는 무인증 표면으로 판정했다([12_permission_matrix.md](./12_permission_matrix.md) §GEN · OBS 표면 인가) |
| COL · SIM · ING | 없음 | 해당 없음 | 외부 표면이 없어 Guard가 끼어들 자리가 없다 |
| 저장소 | AUT → PostgreSQL · Redis | 저장소 경유 | 계정 · 역할은 PostgreSQL, 리프레시 · 레이트 리밋 · 권한 사본은 Redis 캐시 계열 |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 자격 증명 불일치 | 로그인 거절 | auth.invalid_credentials/401 | AUT-01 |
| 헤더 없음 · 서명 불량 | 요청 거절 — 갱신해도 복구되지 않는다 | auth.unauthenticated/401 | AUT-04 |
| 액세스 토큰 만료 | BFF 갱신 후 원요청 1회 재시도 | auth.token_expired/401 | AUT-04 · 02 |
| 리프레시 키 없음 | 재로그인 — **축출 실험 중에는 정상 관측값** | auth.refresh_invalid/401 | AUT-02 |
| 역할이 표면 권한 밖 | 요청 중단 | auth.forbidden/403 | AUT-05 |
| 분당 한도 초과 | 다음 분 창까지 대기 | common.rate_limited/429 | AUT-06 |
| 요청 형식 위반 | 요청 수정 | common.validation_failed/400 | AUT-01 |
| PostgreSQL 접속 불가 중 로그인 | 백오프 후 재요청 | common.postgres_unavailable/503 | AUT-01 |
| Redis 접속 불가 중 로그인 · 갱신 · 레이트 리밋 | 로그인 · 갱신 · 로그아웃은 **auth.token_store_unavailable/503** · 레이트 리밋은 세지 않고 통과(계측) | 11_glossary/02 · [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-14 | AUT-01 · 02 · 06 |
| 비활성 계정(is_active false) 로그인 | **auth.invalid_credentials/401 재사용** — 계정 존재를 드러내지 않는다 | [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-02 | AUT-01 |
| WebSocket 첫 메시지 인증 실패 · Origin 불일치 | HTTP 응답이 아니라 **연결 종료** | 종료 코드 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) | AUT-04 · 07 |
| CORS 거절 | 브라우저가 응답을 막는다 — 서버 코드가 도달하지 않는다 | 브라우저 콘솔 | AUT-07 |

- **B형 — 사용자가 로그아웃되는 것이 Stream 적체의 증상일 수 있다.** Stream이 메모리를 잠식하면 volatile-lru가 TTL 키부터 밀어내고 auth:refresh도 그 후보다. 반대로 Stream MAXLEN을 maxmemory보다 먼저 걸리게 산정하지 않았다면 수집 폭주가 전원을 로그아웃시킨다 — 그래서 MAXLEN 산정의 정본([../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md))이 세션 예산을 먼저 떼어 둔다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 리프레시 토큰 키 개명(rt: → auth:refresh:) — 원본 architecture.md §8.2 | AUT-01~03이 auth:refresh:{refresh_token_id}만 쓴다. 최신값 계열 rt:(TTL 금지)와 접두를 공유하지 않는다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.5 TTL 강제 수단 — 원본 implementation_plan.md §7.5 | auth · rl 계열 쓰기는 TTL 필수 래퍼(캐시 계열)로만 한다. 캐시 계열 호출 실패 시 레이트 리밋은 degrade(통과 · 계측)하고 인증 저장소 쓰기는 거절한다(REQ-AUT-14) | 상동 · [../03_requirements/02_auth.md](../03_requirements/02_auth.md) |
| 보정 7.1~7.4 | 해당 없음 — 수집 · 적재 · 알람 · 무효화 체인 항목이다 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 계정 · 역할 부여 경로 | user_account · role · user_role 테이블(원본 architecture.md §6) | 닫힘 — 시드로만 만든다 · 계정 생성 · 역할 부여 표면은 두지 않는다(07_api/03 §원본에 없는 표면) · 비밀번호는 SEED_USER_PASSWORD 주입 — [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) | [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md)(W3) · 표면 신설 여부 [../07_api/03_auth.md](../07_api/03_auth.md)(W5) |
| sess:{session_id} 키의 소비 기능 | 키 계열 표에 세션 JSON · TTL 1800초가 있다(원본 architecture.md §8.2) | **W3 판정 — 키 패턴 폐지 · sess 접두 예약.** 인증은 JWT + 리프레시 키로 닫혀 세션 키를 읽는 기능이 없다. 접두는 캐시 계열 정책으로 남겨 세션 키가 다시 생길 때 정책이 이미 정해져 있게 한다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 레이트 리밋의 엔드포인트 차원 | "사용자별 + 엔드포인트별"(원본 architecture.md §18) · 키는 rl:{user_id}:{unix_minute}(원본 architecture.md §8.2) | **W3 판정** — 키를 rl:{class}:{user_id}:{unix_minute}로 바꿔 한도 등급 자리를 둔다. **W7 닫힘** — class 값 general · bulk_read · export · bulk_ingest · 한도는 관계식 고정 · 값 2계층 미정 | 상동 · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| 권한 캐시 키 모양 | cache-aside 300초 · 변경 시 즉시 DEL(원본 architecture.md §10.1) | **W3 확정** — cache:perm:{user_id} | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| Redis 불가 시 로그인 · 갱신 · 레이트 리밋 | 세 기능의 상태가 Redis에 있다 | **W2 판정 완료** — 인증 저장소 쓰기 거절 · 레이트 리밋 통과 | [../03_requirements/02_auth.md](../03_requirements/02_auth.md) |

## 관련 문서

- [12_permission_matrix.md](./12_permission_matrix.md) — role_code 값 · 역할 × 기능 권한
- [../03_requirements/02_auth.md](../03_requirements/02_auth.md) — REQ-AUT 동작 계약
- [../07_api/03_auth.md](../07_api/03_auth.md) — login · refresh · logout 표면
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — BFF 경유와 직결의 기준
- [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) — 인증 · 인가 방어선 리뷰
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — auth · common 코드 정본
- [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) — 페르소나와 요청 경로
