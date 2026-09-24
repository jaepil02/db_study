# 인증 · 인가 방어선 (01_authn_authz)

> **대상**: 인증 · 인가를 위협 관점에서 다시 읽는 리뷰 — **토큰 수명 정본** · 액세스 토큰 서명 · 리프레시 불투명 토큰(Redis 저장 · 즉시 폐기 · 회전 판정) · 쿠키 속성 · 비밀번호 저장(해시 알고리즘 정본) · 역할 기반 인가 · WebSocket 첫 메시지 인증 · sess 접두 판정 · 인증 잔여 등재
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §2 · §11.2 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.4(커밋 ff66a37) · REQ-AUT-01~17 · REQ-GLB-08 · 09 · 19 · REQ-RLT-09 · D-07 · ADR-02 · [../02_features/01_auth.md](../02_features/01_auth.md) AUT-01~07 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../07_api/03_auth.md](../07_api/03_auth.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md) · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · docs_plan.md 웨이브 인계 W7 12_security 행

이 문서는 인증 · 인가를 **새로 설계하지 않는다.** 기능은 [../02_features/01_auth.md](../02_features/01_auth.md), 동작 계약은 [../03_requirements/02_auth.md](../03_requirements/02_auth.md), 표면은 [../07_api/03_auth.md](../07_api/03_auth.md)가 이미 고정했다. 이 문서가 **정본으로 갖는 것은 셋뿐이다** — 토큰 수명 값 · 비밀번호 해시 알고리즘 · 리프레시 토큰의 저장 모양 판정. 나머지는 정본을 위협 관점에서 다시 읽어 판정과 잔여를 남긴다.

**방어선은 api 한 곳에 모인다.** 앞단 프록시가 없으므로 토큰 검증 · 역할 대조 · 폐기가 전부 NestJS Guard와 AUT 모듈의 일이다(원본 architecture.md §18). 대신할 계층이 없다는 것은 이 계층의 누락이 곧 무방비라는 뜻이다.

**인증은 S7에 붙는다**(D-07). S2~S6의 표면은 무인증이며 이 문서의 계약은 S7부터 적용된다. 무인증 기간의 노출은 결함이 아니라 순서의 결과이고, 그 잔여는 [04_threat_model.md](./04_threat_model.md)가 받는다.

## 토큰 경로와 검사 지점

로그인부터 실시간 연결까지 토큰이 지나는 자리와 각 자리의 검사를 세로로 적는다. 우측이 검사 주체다.

```plain
① 로그인       브라우저 → BFF → api 03_auth #1        password_hash 대조(적응형) · 리프레시 저장 · 쿠키는 BFF가 심는다
② 직결 요청    브라우저 → api                          Bearer 서명 · 만료(AUT-04) → cache:perm 역할 대조(AUT-05)
③ 만료         api → auth.token_expired/401            BFF가 쿠키로 03_auth #2 → 원요청 1회
④ 로그아웃     BFF → api 03_auth #3                     auth:refresh DEL · BFF가 쿠키 삭제
⑤ WebSocket    핸드셰이크 Origin → 첫 메시지 auth         토큰 서명 · 만료 · 역할 0 판정 → 4401 · 4403
⑥ 연장         연결 안 auth 재전송                       만료 전 연장 · 만료 뒤 4401
```

- **리프레시 토큰이 브라우저 JS에 닿는 자리는 없다.** ①④는 BFF 서버 fetch이고 api는 리프레시를 본문으로만 주고받는다([../07_api/03_auth.md](../07_api/03_auth.md)). 브라우저가 가진 것은 httpOnly 쿠키와 메모리의 액세스 토큰 둘이다.
- **역할은 토큰 안에 없다(§액세스 토큰).** ②의 역할 대조는 매 요청 cache:perm:{user_id} 또는 PostgreSQL에서 한다 — 토큰에 역할을 넣으면 회수가 액세스 수명만큼 늦는다.
- **⑤의 Origin 검사는 브라우저만 막는다.** 브라우저가 아닌 클라이언트는 Origin 헤더를 임의로 싣는다 — 신원 경계는 첫 메시지 인증이다([03_api_surface_defense.md](./03_api_surface_defense.md) §WebSocket).

## 토큰 수명 (정본)

**이 표가 토큰 수명의 정본이다**([README.md](./README.md) 고정 기준 · REQ-AUT-03 · 04가 이 문서를 가리킨다). 수명은 2계층 조정값이라 다른 문서는 값을 박지 않고 조회 계약으로 인용한다.

| 토큰 | 형식 | 수명 현행 참고 | 기준 시점 | 저장 자리 | 폐기 수단 | 금지된 대체 동작 |
|------|------|------|------|------|------|------|
| 액세스 | JWT(서명 · 무상태) | 15분 | 발급 시점 exp | 브라우저 메모리 · Authorization 헤더 | 없음 — 수명 만료 | 쿠키 · 쿼리 · localStorage 보관 |
| 리프레시 | 불투명 무작위 문자열 | 14일 | **발급 시점 — 갱신이 늘리지 않는다** | httpOnly 쿠키 · Redis auth:refresh:{refresh_token_id} TTL | 로그아웃 DEL · TTL 만료 · 축출 | 갱신 때 TTL 재설정(슬라이딩) · TTL 없는 저장 |
| WebSocket 인증 | 액세스 토큰 재사용 | 액세스와 같다 | auth_ok의 expiresAt | 연결 상태 | 만료 뒤 4401 종료 | 연결 수립 시점 1회 검증으로 영구 유지 |

- 검산: 토큰 행 = **3** · 독립 수명 2(액세스 · 리프레시) + 재사용 1(WebSocket)
- **수명 사이의 관계는 1계층이다** — 값은 바꿀 수 있어도 아래 관계는 바꾸지 않는다. ① 액세스 수명 < 리프레시 수명 — 거꾸로면 갱신 경로가 쓰이지 않아 리프레시 폐기가 무의미해진다. ② 액세스 수명 = 로그아웃 뒤 남는 창의 상한 — 폐기 목록을 두지 않는 설계(REQ-AUT-06)의 대가이므로 액세스 수명을 늘리는 변경은 이 창을 함께 늘린다. ③ WebSocket 연장 주기 < 액세스 수명 — 연장 없이 만료가 지나면 4401이다([../07_api/11_websocket.md](../07_api/11_websocket.md)).
- **B형 — 리프레시 수명을 갱신이 늘리지 않는 것은 불편이 아니라 상한이다.** 결론 — 로그인 한 번이 만드는 세션의 최대 길이는 리프레시 수명이다. 반대 시나리오 — 갱신마다 TTL을 다시 걸면 15분마다 갱신하는 열린 탭 하나가 리프레시 토큰을 **무기한** 살려, 탈취된 쿠키 사본도 무기한 유효하다. 파생 지침 — 캐시 계열 래퍼의 TTL 쓰기는 발급 시 1회뿐이고 갱신 경로는 TTL을 읽기만 한다.
- 수명 값을 바꾸면 [../07_api/03_auth.md](../07_api/03_auth.md) 응답 예시의 만료 시각 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) TTL 계약 행의 현행 참고를 같은 변경 단위에서 고친다.

## 액세스 토큰

| 항목 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 서명 방식 | **대칭 HMAC 서명 하나** — 서명 주체와 검증 주체가 api 한 프로세스다 | ADR-02 · 원본 architecture.md §11.2 | 비대칭 서명 — 공개키를 나눠 줄 검증자가 없어 키 쌍 관리만 늘어난다 |
| 알고리즘 결정 자리 | **검증 쪽 설정이 고정한다** — 토큰 헤더의 알고리즘 필드를 따르지 않는다 | 외부 표준 RFC 7519 · 이 문서 판정 | 헤더를 따르면 알고리즘 none 토큰이나 다른 알고리즘으로 위조한 토큰이 검증을 통과한다 |
| 클레임 | 사용자 식별자 · 발급 시각 · 만료 시각만 — **역할을 넣지 않는다** | REQ-AUT-09 · 10 · [../07_api/03_auth.md](../07_api/03_auth.md) user.roles 표시 전용 | 역할을 넣으면 역할 회수가 cache:perm 즉시 삭제(REQ-AUT-10)로 끝나지 않고 액세스 수명만큼 산다 |
| 서명 키 | 비밀 — 길이 · 주입 · 회전은 [02_secrets_config.md](./02_secrets_config.md) | REQ-TEC-14 | 키가 커밋되면 저장소 사본을 가진 누구나 임의 사용자 토큰을 만든다 |
| 키 교체의 효과 | 교체 즉시 발급된 액세스 토큰 전부가 auth.unauthenticated/401 — 리프레시 토큰은 유효하지만 unauthenticated는 갱신 경로를 타지 않아 화면은 로그인으로 간다 | REQ-AUT-07 · [../07_api/01_conventions.md](../07_api/01_conventions.md) 서명 불량 행 | 해당 없음 — 리프레시는 불투명 토큰이라 키 교체와 무관하다 |
| 만료 · 서명 불량의 구분 | 만료 auth.token_expired/401 · 형식 · 서명 불량 auth.unauthenticated/401 | REQ-AUT-07 | 하나로 묶으면 서명 불량에도 갱신 루프를 돈다 |

- 검산: 항목 = **6**
- **키 교체가 재로그인을 부르는 것은 결함이 아니다(B형).** 결론 — 서명 불량은 갱신하지 않는다는 규칙(REQ-AUT-07)이 키 교체에도 그대로 걸린다. 반대 시나리오 — 키 교체를 만료처럼 갱신으로 흡수하려고 unauthenticated에도 갱신을 허용하면, 위조 토큰을 든 요청마다 BFF가 리프레시를 부르는 갱신 루프가 생긴다. 파생 지침 — 키 교체는 드문 사건으로 두고 교체 뒤 한 번의 재로그인을 받아들인다(§인증 · 인가 잔여).

## 리프레시 토큰

| 항목 | 판정 | 근거 | 어기면 |
|------|------|------|------|
| 생성 | 암호학적 난수 256비트 이상 · 불투명 문자열 | REQ-AUT-01 · 이 문서 판정 | 추측 가능한 토큰은 Redis 키 공간을 대입해 유효 토큰을 찾게 한다 |
| 키의 식별자 | **refresh_token_id = 토큰의 암호학적 요약값** — 토큰 원문을 키 이름에 쓰지 않는다 | 이 문서 판정 · 키 모양 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | 원문이 키 이름이면 redis-cli SCAN 한 번 · redisdata 스냅샷 tgz · AOF 파일이 곧 유효 리프레시 토큰 목록이다 |
| 값 | user_id | REQ-AUT-03 | 해당 없음 |
| TTL | 발급 시 1회 · 리프레시 수명 | REQ-AUT-03 · §토큰 수명 | TTL 없는 키는 축출도 만료도 되지 않아 폐기하지 않은 토큰이 영구 유효하다 |
| 회전 | **도입하지 않는다(판정)** | §회전 판정 | 해당 없음 |
| Redis 불가 | 로그인 · 갱신 · 로그아웃 거절 — auth.token_store_unavailable/503 | REQ-AUT-14 | 통과시키면 저장되지 않은 토큰이 발급되어 폐기가 불가능하다 |
| 축출 | 캐시 계열이라 volatile-lru 후보 — 축출되면 auth.refresh_invalid/401 · 재로그인 | REQ-AUT-05 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) | 해당 없음 — 축출 실험 중 정상 관측값 |

- 검산: 항목 = **7**
- **요약값 키는 키 모양을 바꾸지 않는다.** 키 패턴 auth:refresh:{refresh_token_id}는 그대로이고 식별자 자리에 무엇이 들어가는지만 정한다 — 봉인 표 칸 · 접두 수 · 키 패턴 수는 변하지 않는다. 조회는 받은 토큰을 같은 방식으로 요약해 키를 만든다.
- **B형 — Redis를 읽을 수 있는 쪽이 리프레시 토큰을 얻지 못하는 것은 과잉 방어가 아니다.** 결론 — 저장소 포트는 학습을 위해 127.0.0.1에 열려 있다([05_local_exposure.md](./05_local_exposure.md)). 반대 시나리오 — 원문 키면 저장소 수동 실습 중 화면에 뜬 키 목록 · 공유한 스냅샷 · 실험 기록에 붙인 redis-cli 출력이 전부 14일짜리 로그인 권한이다. 파생 지침 — 키 이름 · 값 어디에도 토큰 원문을 두지 않는다.

### 회전 판정

인계 "리프레시 토큰 회전 · 재사용 탐지"([../07_api/03_auth.md](../07_api/03_auth.md) 미설계 등재)를 닫는다. **판정 — 회전하지 않는다. 갱신은 같은 리프레시 토큰으로 새 액세스 토큰만 준다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 회전 없음 | 리프레시 토큰은 발급부터 만료 · 폐기까지 하나 | 탈취된 쿠키 사본이 리프레시 수명 동안 유효하다 — 막는 것은 로그아웃 DEL뿐이다 | **채택** — 잔여 등재 |
| ② 회전만 | 갱신마다 새 토큰 발급 · 옛 키 DEL | 탭 둘이 같은 순간 만료를 맞아 BFF가 갱신을 두 번 부르면 둘째가 이미 지워진 키를 받아 **정상 사용자가 로그아웃된다** | 버림 |
| ③ 회전 + 재사용 탐지 | 토큰 계보를 저장하고 옛 토큰 재사용 시 계보 전체 폐기 | 계보를 담을 새 키 계열이 필요하다 — 새 접두는 키 공간 정본에서만 늘리고 봉인 여부부터 정해야 한다 · ②의 경합이 탐지로 오판되어 로그아웃이 더 넓어진다 | 버림 |

- 검산: 안 = **3**
- **회전이 막는 위협은 쿠키 사본의 장기 사용인데, 사본을 얻는 경로가 이 시스템에서는 같은 머신 접근뿐이다.** 쿠키는 httpOnly라 페이지 스크립트가 읽지 못하고, TLS가 없는 구간은 루프백뿐이다. 같은 머신 접근이 있으면 저장소 포트와 .env가 더 가까운 자산이다([04_threat_model.md](./04_threat_model.md)) — 회전은 가장 먼 문 하나를 잠근다.
- 재론 조건 — 원격 접속이 현행 범위가 되는 순간(확장 로드맵 밖 · D-02) 이 판정은 무효다.

## 쿠키 속성

리프레시 쿠키는 BFF(웹 오리진 3001)가 심고 읽는다. api 오리진(3000)은 쿠키를 심지 않는다([../07_api/03_auth.md](../07_api/03_auth.md)).

| 속성 | 값 | 근거 | 어기면 |
|------|------|------|------|
| HttpOnly | on | REQ-AUT-04 · 원본 architecture.md §11.2 | 페이지 스크립트 한 줄(XSS)이 14일짜리 토큰을 읽는다 |
| SameSite | Lax | 원본 architecture.md §11.2 · 원본 tech_stack.md §10.4 | None이면 다른 사이트의 요청에도 쿠키가 실린다 |
| Secure | off — 로컬 http | 상동 | on이면 http://localhost에서 쿠키 저장을 거부하는 브라우저에서 로그인이 조용히 실패한다 |
| Path | BFF 인증 Route Handler 경로로 좁힌다 | 이 문서 판정 | 넓으면 웹의 모든 요청(페이지 · 정적 자산 · 개발 서버 요청)에 리프레시 토큰이 실려 개발 서버 로그 · 미들웨어가 토큰을 보는 자리가 는다 |
| 수명 | 리프레시 수명과 같다 | §토큰 수명 | 쿠키가 더 길면 만료된 토큰을 들고 refresh_invalid를 반복한다 |

- 검산: 속성 = **5**
- **A형 — "SameSite=Lax라 CSRF가 막힌다"는 localhost에서 절반만 참이다.** 통념은 다른 사이트의 요청에 쿠키가 실리지 않는다는 것이다. 부정 — SameSite는 포트를 보지 않으므로 localhost:3001과 localhost:3000이 same-site인 것처럼(원본 architecture.md §11.2) **같은 머신의 다른 로컬 웹 앱(localhost의 임의 포트)도 same-site다** — 그 페이지가 BFF 인증 경로로 보내는 POST에는 쿠키가 실린다. 진짜 축은 **요청 출처(Origin)**다. 대체 경로 — BFF 인증 Route Handler의 Origin 대조([03_api_surface_defense.md](./03_api_surface_defense.md) §BFF 인증 경로의 출처 검사). 인터넷의 다른 사이트는 여전히 cross-site라 Lax가 막는다.
- 응답 본문을 읽지 못해도 부작용은 남는다 — 갱신은 토큰을 내주지 않지만(CORS 없음) 로그아웃은 실행된다.

## 비밀번호 저장

인계 "password_hash 알고리즘"([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) 미설계 등재)을 닫는다. **판정 — Argon2id다.**

| 항목 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 알고리즘 | **Argon2id** | REQ-AUT-01 적응형 해시 · 외부 표준 OWASP Password Storage Cheat Sheet의 첫 순위 · RFC 9106 | 빠른 범용 해시(SHA 계열) — 볼륨 스냅샷의 password_hash가 GPU 대입 한 번에 풀린다 · bcrypt — 메모리 비용 인자가 없어 병렬 대입 비용을 올리는 축이 하나 적고 입력 길이 상한이 있다 |
| 저장 모양 | 알고리즘 · 파라미터 · 솔트 · 요약값을 담은 자기 기술 문자열 하나 — 컬럼 password_hash(text) | PHC 문자열 형식 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) | 파라미터를 코드에만 두면 비용을 올린 뒤 옛 해시를 검증할 수 없다 |
| 솔트 | 행마다 무작위 | 알고리즘 규약 | 공통 솔트면 같은 비밀번호가 같은 해시가 된다 |
| 비용 파라미터 | 2계층 조정값 — 소유 이 문서 · 현행 미정 · **외부 표준의 최소 구성 아래로 내리지 않는다** | 로그인 p50은 3계층 미확인([../07_api/03_auth.md](../07_api/03_auth.md)) | 로그인이 느리다고 최소 구성 아래로 내리면 스냅샷 유출의 대입 비용이 그만큼 준다 |
| 없는 계정 · 비활성 계정 | 고정 더미 해시로 대조를 끝까지 수행 | REQ-AUT-02 | 대조를 생략하면 응답 시간으로 계정 존재가 샌다 |
| 기록 금지 | 원문 · 해시를 로그 · 응답 · 감사 로그에 남기지 않는다 | REQ-AUT-01 | 로그 파일 공유가 비밀번호 사본 공유가 된다 |

- 검산: 항목 = **6**
- **비용 파라미터는 로그인 지연을 정하는 값이라 S7에서 함께 잰다.** 파라미터를 올리면 로그인 p50과 api 메모리(해시 한 번이 메모리 비용만큼 쓴다)가 함께 오른다. 로그인 동시성이 높지 않은 학습 시스템이라 메모리 비용이 api 컨테이너 상한을 위협할 일은 없지만, 값은 측정 기록과 함께 정한다(§미확인 · 미설계 등재).
- 라이브러리 이름 · 버전의 정본은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 버전 고정표다 — 이 문서는 알고리즘과 저장 모양만 정한다.

## 역할 기반 인가

역할 값 · 역할 × 표면 대응의 정본은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)다. 이 표는 그 판정이 **어디서 강제되고 무엇이 우회할 수 없는가**를 적는다.

| 검사 | 강제 자리 | 근거 | 우회 시도 | 결과 |
|------|------|------|------|------|
| 역할 대조 | 엔드포인트마다 NestJS Guard · 합집합 판정 | REQ-AUT-09 · 원본 architecture.md §18 | 화면이 user.roles로 숨긴 버튼을 딥링크 · 수동 호출로 부른다 | auth.forbidden/403 — 화면 표시는 인가가 아니다 |
| 권한 사본 | cache:perm:{user_id} · 역할 변경 커밋 뒤 즉시 DEL | REQ-AUT-10 | 회수 직후 같은 토큰으로 호출 | 403 — 토큰에 역할이 없어 사본 삭제로 끝난다 |
| 역할 0 사용자 | 갱신 · 로그아웃만 · WebSocket 4403 | REQ-AUT-09 · [../07_api/11_websocket.md](../07_api/11_websocket.md) | 조회 표면 호출 | 403 |
| 권한 판정 불가 | 사본 없고 PostgreSQL 불가 → common.postgres_unavailable/503 | REQ-AUT-15 | 판정 실패를 허용으로 처리 | 금지 — 판정 불가를 통과로 두면 저장소 장애가 권한 우회가 된다 |
| 쓰기 주체 | 쓰기 하나에 역할 하나 · 감사 행에 user_id | 권한 매트릭스 원칙 · REQ-WRK-07 | 두 역할에 같은 쓰기를 연다 | 감사 행위자로 책임 축을 읽을 수 없다 |
| 계정 · 역할 생성 | 표면 없음 — 시드로만 | REQ-AUT-17 | 역할 부여 표면 요청 | 경로가 없다 — 역할 변경은 psql 수동 조작뿐이다(§인증 · 인가 잔여) |

- 검산: 검사 = **6**
- **인가 실패는 닫힌 쪽으로 떨어진다(fail-closed) — 레이트 리밋과 반대다.** 레이트 리밋은 Redis 불가에서 통과시키지만(REQ-AUT-14) 역할 판정은 원천(PostgreSQL)까지 막히면 거절한다. 레이트 리밋은 자원 보호 장치이고 역할 판정은 신원 경계이기 때문이다([../03_requirements/02_auth.md](../03_requirements/02_auth.md) §Redis 장애 시 거동 판정).
- **공개 표면 둘(health · metrics)은 인가 밖이다** — 근거는 도달 가능성이 아니라 호출 주체가 기계이고 응답에 업무 데이터가 없다는 것이다(REQ-OBS-10). 잔여는 [04_threat_model.md](./04_threat_model.md).

## WebSocket 첫 메시지 인증

| 항목 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 토큰 전달 | 핸드셰이크 뒤 첫 메시지 auth — URL 쿼리로 받지 않는다 | REQ-AUT-08 · REQ-RLT-09 · 원본 architecture.md §11.2 | URL 토큰은 접근 로그 · 브라우저 기록에 남아 로그 파일이 토큰 사본이 된다 |
| 인증 전 상태 | subscribe를 받지 않는다 — 인증 전 subscribe는 4401 | [../07_api/11_websocket.md](../07_api/11_websocket.md) §구독 방식 판정 | 인증 전에 ch:rt가 구독돼 무인증 소켓이 프레임을 받는다 |
| 인증 대기 시간 | 2계층 · 소유 [../07_api/11_websocket.md](../07_api/11_websocket.md) · 현행 미정 | 상동 | 무인증 소켓이 대기 시간만큼 열린 채 남는다 — §인증 · 인가 잔여 |
| 연장 | 만료 전 auth 재전송 · 만료 뒤 4401 | 상동 | 연결 수립 때 1회만 보면 만료된 토큰으로 프레임을 계속 받는다 |
| 역할 | 인증 성공 시 역할 0이면 4403 | 상동 | 역할 없는 사용자가 알람 브로드캐스트를 받는다 |

- 검산: 항목 = **5**
- 종료 코드 8종의 방어 관점 리뷰는 [03_api_surface_defense.md](./03_api_surface_defense.md) §WebSocket에 둔다 — 이 표는 인증 단계만 다룬다.

## sess 접두 판정

인계 "sess:{session_id} 키 계열은 예약만 되어 있고 소비 기능이 없다"를 닫는다. W3는 키 패턴을 폐지하고 접두만 예약했다([../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) §인계 판정 #2). **판정 — 예약을 유지하고 한계로 등재한다.**

| 관점 | 판정 | 근거 |
|------|------|------|
| 공격 표면 | 없다 — 키가 없고 읽는 기능이 없다 | 활성 키 패턴 0 · 래퍼만 정해져 있다 |
| 예약을 유지하는 이유 | 세션 키가 다시 생길 때 캐시 계열(TTL 필수 · CacheKeyClient)이 **처음부터** 강제된다 | REQ-GLB-08 · 전역 불변식 TTL 우선순위 |
| 다시 생길 수 있는 자리 | BFF 서버 쪽 세션 상태(로그인 응답 user를 서버에 두는 경우 — [../07_api/03_auth.md](../07_api/03_auth.md) §원본에 없는 표면 판정 me 행) | 상동 |
| 예약이 못 막는 것 | 세션 키를 만든 기능이 **로그아웃 · 리프레시 폐기와 세션 삭제를 묶지 않는 것** — 키 계열 정책은 TTL만 강제하고 폐기 연동은 강제하지 않는다 | 한계 — §인증 · 인가 잔여 |
| 접두 삭제 | 하지 않는다 — 루트 고정 기준 Redis 영역 접두 수가 바뀌는 리드 변경이다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |

- 검산: 관점 = **5**
- **sess 키를 들이는 변경은 이 문서를 먼저 고친다.** 세션 키가 생기면 인증 상태가 셋(액세스 · 리프레시 · 세션)이 되고, 로그아웃이 셋을 모두 지우는지가 새 폐기 계약이 된다.

## 인증 · 인가 잔여

어느 계층도 강제하지 않는 것이다. 위협 모델 전체의 잔여 목록은 [04_threat_model.md](./04_threat_model.md) §잔여 위험 등재가 갖고, 이 표는 인증 · 인가에서 생긴 행만 먼저 적는다.

| 항목 | 강제 주체 | 막는 것과 못 막는 것 | 잔여가 어디에 담기는가 |
|------|------|------|------|
| Redis 불가 중 로그아웃한 토큰의 부활 | BFF 쿠키 삭제 | 정상 브라우저 경로는 막는다 · 쿠키 사본을 가진 쪽은 Redis 복구 뒤 TTL이 남은 동안 다시 갱신한다 — 로그아웃 DEL이 503으로 실패했기 때문이다 | 이 표 · [../03_requirements/02_auth.md](../03_requirements/02_auth.md) §Redis 장애 시 거동 판정 |
| 로그아웃 뒤 액세스 토큰 | 없음 — 무상태 설계 | 리프레시는 막는다 · 발급된 액세스 토큰은 수명 동안 유효하다 | 이 표 · REQ-AUT-06 |
| 리프레시 쿠키 사본의 장기 사용 | 로그아웃 DEL · 수명 | 로그아웃한 토큰은 막는다 · 로그아웃하지 않은 사본은 리프레시 수명 동안 유효하다 — 회전 없음 판정의 대가 | §회전 판정 |
| 서명 키 교체 직후 첫 요청 | 없음 | 옛 토큰은 전부 거절된다 · 거절이 unauthenticated라 갱신 경로를 타지 않고 로그인 화면으로 간다 | 이 표 |
| 무인증 WebSocket 소켓 | 인증 대기 시간 | 대기 시간 뒤에는 4401로 닫는다 · 대기 시간 안의 소켓 수는 세지 않는다 — 연결 수 상한이 없다 | [03_api_surface_defense.md](./03_api_surface_defense.md) §WebSocket |
| 역할 변경 경로 | 없음 — 표면 없음 | 앱으로 역할을 바꿀 수 없다 · psql 수동 UPDATE는 cache:perm을 지우지 않아 TTL(현행 참고 300초) 동안 옛 권한이 산다 | 이 표 · REQ-AUT-10 |
| 세션 키 폐기 연동 | 없음 — 예약 접두 | 세션 키가 없으니 지금은 대상이 없다 · 생기는 순간 로그아웃과 세션 삭제의 연동을 강제할 주체가 없다 | §sess 접두 판정 |

- 검산: 잔여 = **7**
- **psql 수동 역할 변경이 즉시 반영되지 않는 것(B형)** — 결론: 표면이 없는 쓰기는 무효화 체인을 타지 않는다. 반대 시나리오 — 학습자가 psql로 역할을 지운 뒤 바로 호출해 200을 받고 인가 결함으로 신고한다. 파생 지침 — 수동 변경 뒤에는 redis-cli로 cache:perm:{user_id}를 지우거나 TTL을 기다린다.

## 원본 대조

원본 절의 인증 · 인가 사실이 이 문서의 어디로 왔는지다. 이관 누락 대조의 근거다.

| 원본 자리 | 사실 | 이 문서의 자리 |
|------|------|------|
| architecture §2 경계 표 BFF 행 | httpOnly 리프레시 쿠키를 서버에서만 다루는 것이 BFF 경로의 가장 중요한 이유 | §토큰 경로와 검사 지점 · §쿠키 속성 |
| architecture §11.2 액세스 토큰 행 | JWT · 15분 · Authorization 헤더 | §토큰 수명 · §액세스 토큰 |
| architecture §11.2 리프레시 토큰 행 | 불투명 · 14일 · httpOnly 쿠키 · Redis 저장 · 즉시 폐기 | §토큰 수명 · §리프레시 토큰 |
| architecture §11.2 쿠키 SameSite 행 | 포트가 달라도 same-site · Lax 동작 | §쿠키 속성(A형 보강) |
| architecture §11.2 쿠키 Secure 행 | 로컬 http에서 끔 · httpOnly 유지 | §쿠키 속성 |
| architecture §11.2 WebSocket 인증 행 | 쿼리 파라미터가 아닌 첫 메시지 | §WebSocket 첫 메시지 인증 |
| architecture §18 인증 행 | JWT 15분 · 리프레시 Redis 저장 · 즉시 폐기 | §토큰 수명 |
| architecture §18 인가 행 | 역할 기반 · Guard로 엔드포인트별 검사 | §역할 기반 인가 |
| architecture §18 감사 행 | 업무 데이터 변경은 감사 로그에 before · after | §역할 기반 인가 쓰기 주체 행 · 정본 REQ-WRK-07 · [04_threat_model.md](./04_threat_model.md) |
| tech_stack §10.4 인증 토큰 행 | 변경 없음 — 액세스 15분 Bearer · 리프레시 14일 쿠키 + Redis | §토큰 수명 |

- 검산: 원본 행 = **10** · 누락 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| Argon2id 비용 파라미터 값 | 2계층 미정 — 외부 표준 최소 구성 이상 · S7 로그인 p50 기록과 같은 변경 단위 | 이 문서 · 로그인 p50은 3계층 미확인(EXP 미채번 — 필요해지면 EXP-40부터) [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 해시 라이브러리 · 버전 | 미고정 — 알고리즘만 이 문서 판정 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 버전 고정표 |
| 리프레시 요약값의 함수 | 미설계 — 암호학적 요약 함수 하나로 고정한다는 계약만 | 이 문서 · 구현 착수 시 |
| 쿠키 이름 · BFF 인증 경로 | 미설계 — Path를 좁힌다는 계약만 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) |
| WebSocket 인증 대기 시간 | 2계층 미정 | [../07_api/11_websocket.md](../07_api/11_websocket.md) |
| 로그인 · 갱신 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [README.md](./README.md) — 폴더 고정 기준 · 토큰 수명 정본 위치
- [02_secrets_config.md](./02_secrets_config.md) — 토큰 서명 키 · 학습자 비밀번호 주입
- [03_api_surface_defense.md](./03_api_surface_defense.md) — CORS · Origin · 레이트 리밋 · WebSocket 종료 코드 리뷰
- [04_threat_model.md](./04_threat_model.md) — 전체 잔여 위험 등재
- [../02_features/01_auth.md](../02_features/01_auth.md) — AUT-01~07 기능 정본
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 표면 정본
- [../03_requirements/02_auth.md](../03_requirements/02_auth.md) — REQ-AUT 계약
- [../07_api/03_auth.md](../07_api/03_auth.md) — login · refresh · logout 표면
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — auth · sess 접두 · 봉인 표
