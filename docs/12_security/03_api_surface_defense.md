# API 표면 방어 (03_api_surface_defense)

> **대상**: api 표면 43개를 위협 관점에서 다시 읽는 리뷰 — 방어 지점 전수 · CORS 단일 오리진 · auth 표면 CORS 제외 판정 리뷰 · BFF 인증 경로의 출처 검사 · **레이트 리밋 등급(class 값 집합)과 한도 관계식(정본)** · 로그인 시도 제한 판정 · 조회 범위 강제 · **내보내기 범위 상한(정본)** · ClickHouse 파라미터 바인딩 · WebSocket Origin 검증과 종료 코드 8종 리뷰 · 보안 헤더 · 응답 비노출
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — Host 대조 거절 응답 모양 판정 — common.validation_failed/400(header.host · enum) · WS는 업그레이드 전 400
> **원천**: 원본 architecture.md §2 · §11.2 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.4(커밋 ff66a37) · REQ-AUT-04 · 07 · 11 · 12 · 13 · 14 · 16 · REQ-GLB-19 · REQ-TSQ-01 · 03 · 04 · 15 · 17 · REQ-ALM-13 · REQ-GEN-08 · 09 · 15 · REQ-RLT-09 · REQ-OBS-10 · ADR-02 · [../07_api/01_conventions.md](../07_api/01_conventions.md) · [../07_api/03_auth.md](../07_api/03_auth.md) · [../07_api/05_timeseries.md](../07_api/05_timeseries.md) · [../07_api/06_realtime.md](../07_api/06_realtime.md) · [../07_api/09_datagen.md](../07_api/09_datagen.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md) · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) rl 계열 · docs_plan.md 웨이브 인계 W3 05_data_stores/05 행 · W6 10_observability 행 · W7 12_security 행

**방어 지점은 NestJS 한 곳이다.** 프록시 · 로드 밸런서가 없으므로 CORS · 보안 헤더 · 레이트 리밋 · Origin 검증 · 입력 검증이 전부 api 코드 안에서 일어난다(원본 architecture.md §11.2 · §18). 앞단에 무언가를 끼워 넣었다가 걷어낼 일이 없다는 뜻이고, 동시에 이 계층이 빠지면 대신 막을 곳이 없다는 뜻이다.

**로컬 전용이라는 사실이 이 문서의 방어를 생략할 이유가 되지 않는다**(전역 불변식 로컬 전용 · REQ-GLB-19). 네트워크 경계는 127.0.0.1 바인드가 맡지만([05_local_exposure.md](./05_local_exposure.md)) 같은 머신의 브라우저 페이지 · 스크립트 · 부하 도구는 경계 안에 있다. 이 문서의 방어는 그 경계 안쪽을 향한다.

이 문서가 **정본으로 갖는 것은 둘이다** — 레이트 리밋 등급 이름 · 한도, 내보내기 범위 상한. 헤더 모양 · 봉투 · 표면 번호의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)이고 여기서는 인용만 한다.

## 방어 지점 전수

| 방어 | 대상 표면 | 시작 단계 | 강제 자리 | 근거 | 빠지면 |
|------|------|------|------|------|------|
| CORS 단일 오리진 | 브라우저 직결 표면 | S2 | api 전역 CORS 설정 | REQ-AUT-12 | 같은 머신 브라우저의 임의 페이지가 응답을 읽는다 |
| 액세스 토큰 검증 · 역할 대조 | 인증 표면 전부 | S7 | Guard | REQ-AUT-07 · 09 · [01_authn_authz.md](./01_authn_authz.md) | 무인증 기간이 끝나지 않는다 |
| 레이트 리밋 | 인증 REST 표면(계수 대상 37) | S7 | Guard 뒤 계수기 | REQ-AUT-11 | 한 사용자 · 한 스크립트가 ClickHouse 대량 스캔을 반복한다 |
| WebSocket Origin 검증 | /ws/realtime | S2 — §Origin 검증 | 게이트웨이 핸드셰이크 | REQ-AUT-13 · REQ-RLT-09 | CORS가 막는 오리진이 실시간 프레임을 받는다 |
| 보안 헤더 | 모든 HTTP 응답 | S7 | helmet 계열 플러그인 | REQ-AUT-13 | 응답 형식 추측(MIME 스니핑) · 참조 URL 누출 |
| Host 헤더 대조 | api 전 HTTP 요청 · WebSocket 핸드셰이크 | S2 | api 전역 | REQ-AUT-13 · [../07_api/01_conventions.md](../07_api/01_conventions.md) | DNS 재바인딩 페이지가 브라우저에게 같은 오리진으로 보여 CORS 없이 응답을 읽는다 |
| 스키마 검증 | REST 전부 | 표면이 생기는 단계 | 공유 스키마 검증 파이프 | REQ-GLB-19 · [../07_api/01_conventions.md](../07_api/01_conventions.md) §요청 검증 | 정수 배열에 문자열이 섞여 쿼리 조립 단계까지 간다 |
| 파라미터 바인딩 | ClickHouse · PostgreSQL을 읽고 쓰는 표면 | 표면이 생기는 단계 | 조회 모듈 · 쿼리 조립 | REQ-GLB-24 · 원본 architecture.md §18 | 요청 값이 SQL 문장이 된다 |
| 조회 범위 강제 | 시계열 · 판정 이력 · 목록 · 내보내기 | 상동 | 도메인 서비스 | REQ-TSQ-01 · 03 · 04 · REQ-ALM-13 · §내보내기 범위 상한 | 범위 하나가 ClickHouse를 메모리 한계로 몬다 |
| 응답 비노출 | REST 전부 · 공개 표면 | 상동 | 에러 필터 · health · metrics 조립 | REQ-OBS-10 · [../07_api/01_conventions.md](../07_api/01_conventions.md) §에러 봉투 | 스택 · SQL · 접속 문자열이 응답으로 나간다 |

- 검산: 방어 = **10** · S2 시작 3(CORS · WebSocket Origin · Host) + S7 시작 3(토큰 · 레이트 리밋 · 보안 헤더) + 표면 생성 단계 4 = **10**
- **인증 이전(S2~S6)에 살아 있는 방어는 일곱이다** — CORS · WebSocket Origin · Host 대조 · 스키마 검증 · 파라미터 바인딩 · 조회 범위 강제 · 응답 비노출. 신원을 묻는 방어가 하나도 없는 기간이며 그 잔여는 [04_threat_model.md](./04_threat_model.md) §무인증 기간이 받는다.

## CORS

| 항목 | 값 | 근거 | 어기면 |
|------|------|------|------|
| 허용 오리진 | http://localhost:3001 **하나** · 와일드카드 금지 | REQ-AUT-12 · 원본 architecture.md §11.2 · §18 · 원본 tech_stack.md §10.4 | 와일드카드면 같은 머신 브라우저의 어느 페이지든 응답을 읽는다 |
| 대상 표면 | 브라우저 직결 표면만 — 06_realtime · 05_timeseries · 07_alarms #6 | [../07_api/01_conventions.md](../07_api/01_conventions.md) §BFF 경유와 직결 | BFF 경유 표면에 허용 헤더를 붙이면 직결을 금지한 표면이 브라우저 JS에서 열린다 |
| 자격 증명 허용 | **내지 않는다(판정)** — 직결 요청은 쿠키가 아니라 Bearer 헤더로 신원을 싣는다 | REQ-AUT-04 · [../07_api/01_conventions.md](../07_api/01_conventions.md) 액세스 토큰 행 | 허용하면 api 오리진 쿠키가 생기는 순간 CSRF 방어가 필요해진다 |
| 허용 요청 헤더 | Authorization · Content-Type | 상동 | 헤더를 넓게 열면 사전 요청이 막아야 할 요청 모양이 통과한다 |
| 노출 응답 헤더 | RateLimit-Limit · RateLimit-Remaining · RateLimit-Reset · Retry-After · Content-Disposition | [../07_api/01_conventions.md](../07_api/01_conventions.md) §레이트 리밋 헤더 · §캐시 헤더 | 노출하지 않으면 화면이 Retry-After를 읽지 못해 429 카운트다운이 멈춘다 |
| 적용 시작 | S2 | REQ-AUT-12 | S7까지 미루면 S2 웹 화면의 직결 호출이 막힌다 |

- 검산: 항목 = **6**
- **localhost:3001과 3000은 포트가 다르므로 오리진이 다르다** — 로컬이어도 CORS가 필요하다(원본 tech_stack.md §10.4). 반면 SameSite는 포트를 보지 않아 same-site다 — 둘의 비대칭이 §BFF 인증 경로의 출처 검사를 부른다.
- **CORS는 응답 읽기를 막을 뿐 요청 발송을 막지 않는다.** 사전 요청이 필요 없는 단순 요청(GET · 폼 POST)은 서버에 도달해 부수효과를 낸다. 부수효과를 막는 것은 인증(S7) · 스키마 검증(JSON 본문만 통과)이다.

### auth 표면 CORS 제외 판정 리뷰

인계 "auth 표면의 CORS 제외 판정 리뷰"([../07_api/03_auth.md](../07_api/03_auth.md))를 닫는다. **판정 — 유지한다. auth 표면 3종은 CORS 응답 헤더를 내지 않는다.**

| 시나리오 | 요청 주체 | 결과 | 판정 근거 |
|------|------|------|------|
| 정상 로그인 | BFF 서버 fetch | 성공 — 서버 간 요청은 CORS 대상이 아니다 | 정상 경로가 막히지 않는다 |
| 웹(3001) JS가 login 직결 | 브라우저 | JSON 본문이라 사전 요청이 먼저 가고 허용 헤더가 없어 **본 요청이 나가지 않는다** | 리프레시 토큰이 JS에 닿는 경로가 원천 차단된다(REQ-AUT-04) |
| 다른 오리진 페이지가 login 직결 | 브라우저 | 상동 | 상동 |
| 다른 오리진 페이지가 폼 POST로 login | 브라우저 단순 요청 | 서버에 도달하지만 JSON이 아닌 본문은 common.validation_failed/400 · 응답은 읽지 못한다 | 스키마 검증이 두 번째 벽이다 |
| 같은 머신 스크립트가 login 직결 | 브라우저 밖 | CORS와 무관하게 성립한다 — 자격 증명이 있으면 로그인된다 | CORS는 브라우저 방어다 — §로그인 시도 제한 판정 |

- 검산: 시나리오 = **5**
- **CORS 제외는 방어를 빼는 것이 아니라 더하는 것이다(B형).** 결론 — auth 표면에 허용 헤더가 없다는 사실이 "브라우저 JS는 리프레시 토큰을 받을 수 없다"를 서버 쪽에서 강제한다. 반대 시나리오 — 편의상 허용 오리진을 auth에도 붙이면, 웹의 한 화면이 BFF를 건너뛰고 login을 직결로 부르는 순간 리프레시 토큰이 JS 메모리에 들어오고 XSS 한 번에 14일짜리 토큰이 샌다. 파생 지침 — auth 경로를 CORS 허용 목록에 넣는 변경은 REQ-AUT-04 위반으로 거절한다.

### BFF 인증 경로의 출처 검사

**리뷰 판정 — BFF의 인증 Route Handler(로그인 · 갱신 · 로그아웃 대행)는 요청의 Origin 헤더를 http://localhost:3001과 대조하고 다르면 거절한다.**

| 관점 | 내용 |
|------|------|
| 막는 것 | 같은 머신의 다른 로컬 웹 앱(localhost의 임의 포트 · same-site)이 BFF 인증 경로로 보내는 요청 — SameSite=Lax는 이 요청에 리프레시 쿠키를 싣는다([01_authn_authz.md](./01_authn_authz.md) §쿠키 속성) |
| 막지 않으면 | 갱신은 응답을 읽지 못해 토큰이 새지 않지만 **로그아웃은 실행된다** — 다른 로컬 앱이 학습자를 임의로 로그아웃시킨다 |
| 비용 | 헤더 문자열 비교 1회 · 정상 경로(웹 3001의 요청)는 항상 통과 |
| 반영 자리 | REQ-AUT-13 ② · [../07_api/03_auth.md](../07_api/03_auth.md) 공통 규약 경로 행 — W7 반영 |

- 검산: 관점 = **4**
- 인터넷의 다른 사이트는 cross-site라 Lax가 이미 쿠키를 싣지 않는다 — 이 검사가 추가로 막는 것은 localhost의 다른 포트뿐이다.

## 레이트 리밋 등급 (정본)

인계 "레이트 리밋 등급 4의 이름 · 한도"와 "rl 키에 엔드포인트 자리가 없어 원본 §18 엔드포인트별 제한과 충돌"을 닫는다. **이 표가 class 값 집합의 정본이다** — [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) aut_ratelimit_rejected_total의 class 레이블 값도 이 표를 따른다.

| class | 묶음 | 표면 | 계수 표면 수 | 한도 현행 참고 | 한도 관계(1계층) |
|------|------|------|:-:|------|------|
| **general** | 일반 | 아래 셋을 뺀 계수 대상 전부 — 04_master #1~#17 · 06_realtime #1 · #2 · 07_alarms #1~#5 · 08_work_orders #1~#9 | 33 | 미정 | ≥ bulk_read 한도 · ≥ 재연결 동기화 폭(§관계식 R3) |
| **bulk_read** | 대량 조회 | 05_timeseries #1 · 07_alarms #6 | 2 | 미정 | ≥ export 한도 · ≤ general 한도 |
| **export** | 내보내기 | 05_timeseries #2 | 1 | 미정 | ≤ bulk_read 한도 |
| **bulk_ingest** | 부하 주입 | 09_datagen #1 | 1 | 미정 | **≥ 실험 부하의 분당 요청 수**(§관계식 R2) |

- 검산: class = **4** · 계수 표면 = 33 + 2 + 1 + 1 = **37** · 계수 밖 표면 = 03_auth 3 + 10_metrics 2 + 11_websocket 1 = **6** · 37 + 6 = **43** = API 표면 총수([../07_api/README.md](../07_api/README.md))
- **엔드포인트별 제한은 class 단위 판정으로 해소한다 — 키 패턴을 바꾸지 않는다.** 원본 "사용자별 + 엔드포인트별"(원본 architecture.md §18)의 목적은 "timeseries/query와 export에 엄격히"였고, 그 목적은 표면을 묶은 class로 충족된다. 키는 이미 rl:{class}:{user_id}:{unix_minute}다(W3 판정 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). 엔드포인트 경로를 키에 넣으면 경로 파라미터마다 키가 생겨 한도가 식별자 단위로 쪼개진다 — 설비 100개를 한 번씩 부르면 한도가 100배가 된다.
- **class 값은 소문자 · 밑줄 문자열이다.** 키 · 메트릭 레이블 · 로그에 같은 문자열이 그대로 들어간다 — 표시 이름(일반 · 대량 조회 · 내보내기 · 부하 주입)은 문서와 화면에만 쓴다.
- **한도 값을 정하지 않은 것은 누락이 아니다.** 원본은 값이 없고(원본 architecture.md §11.2 "분당 요청 수" · §18 "엄격히"), 값은 관계식의 오른쪽 항(실험 부하 · 구독 상한)이 정해져야 정할 수 있다. 값은 2계층 조정값이며 소유는 이 문서다 — **관계식이 값보다 먼저 고정된다.**

### 한도 관계식

값이 바뀌어도 아래 관계는 바꾸지 않는다. 관계를 깨는 값은 기동 설정 검사에서 거부한다.

| # | 관계 | 오른쪽 항의 소유 | 깨지면 |
|:-:|------|------|------|
| R1 | export ≤ bulk_read ≤ general | 이 문서 | "엄격히"(원본 §18)가 뒤집혀 대량 스캔 표면이 일반 표면보다 많이 불린다 |
| R2 | bulk_ingest ≥ 모드 C 실험 부하의 분당 요청 수 — 분당 요청 수 = 목표 행/초 × 60 ÷ 요청당 행 수 | 목표 행/초 — 용량 티어([../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)) · 요청당 엔트리 상한 — [../07_api/09_datagen.md](../07_api/09_datagen.md) | **429가 datagen.stream_full보다 먼저 와 HTTP 경유 수집 상한 측정(EXP-37)이 레이트 리밋 측정이 된다 — 측정 무효** |
| R3 | general ≥ 사용자당 동시 연결 수 × 연결당 구독 설비 상한 + 화면 첫 로드 호출 수 | 구독 설비 상한 — [../07_api/11_websocket.md](../07_api/11_websocket.md) | api 재기동 뒤 재연결 동기화가 구독 설비 수만큼 06_realtime #1을 몰아 불러 **정상 사용자가 429로 대시보드를 못 채운다** |
| R4 | 측정 중인 class의 한도 ≥ 그 실험의 k6 분당 요청 수 | 실험 조건 — [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) | S7 이후 부하 실험(EXP-36 · 37)의 지연 분포가 429 거절을 섞어 짧아진다 |

- 검산: 관계 = **4**
- **R2 · R4의 검증은 측정 기록의 유효 조건이다.** 실험 구간의 aut_ratelimit_rejected_total{class} 증가가 0이 아니면 그 기록은 무효다 — 설계된 거절(stream_full)과 방어 거절(429)을 가를 방법이 이 계수뿐이다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) 조건 칸).
- **R3은 두 조정값을 같은 변경 단위에 묶는다.** 구독 설비 상한(11_websocket 소유)을 올리면 general 한도를 함께 다시 계산한다([../07_api/06_realtime.md](../07_api/06_realtime.md) 미설계 등재 "재연결 폭주와 일반 등급 한도의 관계"를 이 관계로 닫는다).
- **S5 모드 C 측정에는 계수가 없다**(무인증 · REQ-GEN-15). R2는 S7 이후 기록에만 걸린다 — S5 수치와 S7 수치는 같은 조건이 아니다.

### 계수 기전 리뷰

| 항목 | 계약 | 근거 | 잔여 |
|------|------|------|------|
| 계수 단위 | 사용자 · 토큰 기준 · **IP 기준이 아니다** | REQ-AUT-11 · 원본 architecture.md §11.2 | 모든 요청이 127.0.0.1에서 오므로 IP 기준은 전원을 한 사용자로 센다 |
| 창 | 분 단위 고정 창 — 키가 unix_minute를 담는다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | **창 경계 양쪽에서 한도의 2배까지 60초 안에 통과한다** — 고정 창의 성질이다 |
| 키 TTL | 창의 첫 INCR 때 · 현행 참고 90초 | 상동 | 해당 없음 |
| Redis 불가 | 세지 않고 통과 · aut_ratelimit_bypassed_total 계수 | REQ-AUT-14 | 통과 중에는 한도가 없다 |
| 메모리 압박 | rl 키는 volatile-lru 후보 — 축출되면 0부터 다시 센다 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) | 압박 중 한도가 느슨해진다 · 거절 계수의 급감으로만 보인다 |
| 계정 공유 | 학습자 계정이 하나다(REQ-AUT-17) — k6와 브라우저가 한 계수를 나눈다 | [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) | 측정 중 같은 class를 부르는 화면을 열면 R4가 조용히 깨진다 |

- 검산: 항목 = **6**
- **고정 창의 2배 통과는 받아들인다(B형).** 결론 — 한도는 분당 평균을 묶을 뿐 60초 구간의 최대를 묶지 않는다. 반대 시나리오 — 이동 창으로 바꾸면 요청마다 정렬 집합 쓰기가 생겨 계수 비용이 INCR 한 번에서 여러 명령으로 늘고, 키 모양 정본을 바꿔야 한다. 파생 지침 — 한도 값을 정할 때 "60초 안에 2배까지"를 전제로 R1~R4의 오른쪽 항과 비교한다.
- 헤더 규약(RateLimit-* · Retry-After · 헤더 없음 = 계수 안 됨)의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md) §레이트 리밋 헤더다.

## 로그인 시도 제한 판정

인계 "로그인 시도 제한"([../07_api/03_auth.md](../07_api/03_auth.md) · [../07_api/01_conventions.md](../07_api/01_conventions.md))을 닫는다. 로그인은 user_id가 없어 계수 대상이 아니다. **판정 — 로그인 시도 제한을 두지 않는다. 새 계수 키도 만들지 않는다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① IP 기준 | 요청 주소별 시도 계수 | 모든 요청이 127.0.0.1이라 한 번의 대입이 **학습자 본인까지 막는다** — BFF 경유라 주소가 전부 같다 | 버림 |
| ② 이메일 기준 | 입력한 email별 시도 계수 | 없는 이메일도 세야 계정 존재가 새지 않는다 — 입력마다 키가 생겨 캐시 예산을 대입 속도로 잠식한다 · 있는 계정만 세면 429와 401의 차이로 계정 존재가 샌다(REQ-AUT-02가 막은 정보) | 버림 |
| ③ 전역 기준 | 로그인 전체 분당 계수 | 대입 중에는 학습자도 로그인하지 못한다 — 방어가 곧 서비스 거부다 | 버림 |
| ④ **두지 않는다** | 대입 속도는 해시 비용이 묶는다 | 같은 머신 프로세스의 대입이 시도당 해시 시간만큼만 느려진다 | **채택** — 잔여 등재 |

- 검산: 안 = **4**
- **로그인을 대입할 수 있는 위치는 같은 머신뿐이고, 그 위치에서는 더 가까운 문이 열려 있다.** api 3000에 닿는 프로세스는 저장소 포트에도 닿는다 — 로그인 제한이 막는 대상은 저장소 비밀번호([02_secrets_config.md](./02_secrets_config.md))와 같은 머신 접근이 이미 가르는 쪽이다. 대입의 속도 상한은 Argon2id 비용이다([01_authn_authz.md](./01_authn_authz.md) §비밀번호 저장).
- 대입 흔적은 http_requests_total의 로그인 경로 401 계수로 본다 — 로그인 표면의 401은 auth.invalid_credentials 하나뿐이라 새 계수를 두지 않는다([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)).
- 재론 조건 — 원격 접속이 현행 범위가 되는 순간 이 판정은 무효다(D-02).

## 조회 범위 강제

ClickHouse를 사용자로부터 지키는 장치들이다. 각 값의 정본은 도메인 문서이고 이 표는 방어 관점에서 모은다.

| 장치 | 표면 | 초과 시 | 값 · 소유 | 방어하는 것 |
|------|------|------|------|------|
| 태그 배열 상한 | 05_timeseries #1 · #2 | timeseries.too_many_tags/400 | 현행 참고 50 · [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 태그 수에 비례하는 스캔 |
| 자동 해상도 | 05_timeseries #1 | 거절 없이 테이블 선택 | 경계 1계층 · REQ-TSQ-03 | 긴 범위의 원시 스캔 |
| 최대 포인트 상향 | 05_timeseries #1 | 거절 없이 한 단계 상향 | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) · REQ-TSQ-04 | 응답 크기 · 이벤트 루프 점유 |
| 발생 시각 범위 필수 | 07_alarms 목록 | 기본 범위 적용 | [../07_api/07_alarms.md](../07_api/07_alarms.md) · REQ-ALM-13 | 전 파티션 스캔 |
| 페이지 상한 | 키셋 페이지 표면 5 | 상한으로 자름 | 현행 참고 200 · [../07_api/01_conventions.md](../07_api/01_conventions.md) | 한 응답의 행 수 |
| 요청당 엔트리 상한 | 09_datagen #1 | common.validation_failed/400 | 미정 · [../07_api/09_datagen.md](../07_api/09_datagen.md) | 요청 하나의 XADD 수 · 적체 검사 우회 폭 |
| **내보내기 범위 상한** | 05_timeseries #2 | common.validation_failed/400 reason range | **이 문서 정본** — §내보내기 범위 상한 | 원시 전체 스캔 · 브라우저 메모리 |

- 검산: 장치 = **7**
- **조회는 거절하지 않고 보정하는데 내보내기는 거절한다(A형).** 통념은 두 표면이 같은 규칙을 쓴다는 것이다. 부정 — 조회는 해상도를 올려 같은 범위를 싸게 답할 수 있지만 내보내기는 정의상 원시라 올릴 해상도가 없다(REQ-TSQ-15). 진짜 축은 **보정 수단의 유무**다. 대체 경로 — 긴 범위 원시가 필요하면 범위를 나눠 여러 번 내보낸다.

### 내보내기 범위 상한

인계 "내보내기 범위 상한"([../07_api/05_timeseries.md](../07_api/05_timeseries.md) · [../02_features/07_timeseries.md](../02_features/07_timeseries.md))을 닫는다. **이 표가 내보내기 범위 상한의 정본이다.**

| 항목 | 계약 |
|------|------|
| 판정량 | 요청의 to − from(스냅 전 요청값) |
| 현행 참고 | **1일** — 2계층 조정값 · 소유 이 문서 |
| 하한 조건 | REQ-TSQ-15의 검증 사례(1일 원시 내보내기)가 상한 안에 든다 — 상한을 1일 아래로 내리면 요구사항 검증 자체가 400이 된다 |
| 상한 조건 | 원시 보존 기간 이하(현행 7일 · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)) — 넘는 범위는 앞부분이 이미 지워져 빈 구간을 스캔한다 |
| 초과 시 | common.validation_failed/400 · details.fields reason range — 새 코드를 만들지 않는다 |
| 금지된 대체 동작 | 범위를 조용히 잘라 앞부분만 내보내는 것 · 해상도를 올려 내보내는 것 |
| 등급 | export class — 범위 상한과 한도가 함께 한 사용자의 분당 원시 스캔 총량을 묶는다 |

- 검산: 항목 = **7**
- **범위 상한은 브라우저도 지킨다.** 내보내기는 Authorization 헤더를 실은 fetch로 받는다([../07_api/05_timeseries.md](../07_api/05_timeseries.md)) — 링크 다운로드가 아니라 스크립트가 응답을 받아 파일로 저장한다. 범위가 무한하면 태그 50 · 원시 해상도에서 한 응답이 브라우저 탭 메모리를 넘는다.
- 조용히 자르지 않는 이유 — 잘린 파일은 형식상 완전해 보여 분석 도구가 1일치를 7일치로 믿는다(REQ-TSQ-01이 태그 절단을 거절하는 이유와 같다).

## ClickHouse 파라미터 바인딩

원본은 "ClickHouse 쿼리는 반드시 파라미터 바인딩 · 태그 ID 배열은 정수 검증 후 사용"이라 적었다(원본 architecture.md §18). W7에 이 계약을 **REQ-GLB-24**로 채번했다([../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)) — 이 절은 그 계약을 방어 관점에서 풀어 적는다.

| 규칙 | 적용 | 어기면 |
|------|------|------|
| 요청 값은 전부 바인딩 파라미터로 — 문자열 연결로 SQL을 만들지 않는다 | 조회 · 내보내기 · 판정 이력 · 최신값 복원 · PostgreSQL 업무 CRUD(REQ-GLB-24) | 요청 값이 SQL 문장이 된다 |
| 태그 ID 배열은 스키마 검증에서 정수 배열로 확정한 뒤 바인딩한다 | 05_timeseries #1 · #2 · 07_alarms #6 | 문자열이 섞인 배열이 바인딩 단계에서 형 변환 오류로 500이 된다 — 400이어야 할 것이 결함으로 기록된다 |
| 테이블 · 해상도는 **고정 대응표에서 고른다** — 요청 문자열을 테이블 이름으로 쓰지 않는다 | 해상도 → tag_raw · tag_1m · tag_1h · tag_1d | 식별자는 바인딩할 수 없다 — interval 값이 그대로 FROM 절에 들어가면 임의 테이블을 읽는다 |
| 집계 함수는 허용 5종 대응표에서 고른다 | aggregations | 요청 문자열이 함수 이름이 된다 |
| FORMAT 절은 csv · parquet 대응표에서 고른다 | 05_timeseries #2 | 요청 문자열이 출력 형식 지시가 된다 |

- 검산: 규칙 = **5**
- **바인딩으로 막을 수 없는 자리(식별자 · 함수 · 형식)는 대응표가 막는다.** 요청은 열거 값만 싣고, 서버가 그 값을 고정 문자열로 바꾼다 — 대응표 밖 값은 스키마 검증이 이미 400으로 끝냈다.
- **/metrics의 느린 쿼리 문형은 이 규칙의 부산물이다.** 값이 바인딩 자리로 빠져 있어 문형에 드러나지 않는다(REQ-OBS-10) — 바인딩을 어기는 코드가 하나라도 있으면 공개 표면에 요청 값이 실린다.

## WebSocket

Origin 검증과 종료 코드 8종을 방어 관점에서 다시 읽는다. 종료 코드의 정본은 [../07_api/11_websocket.md](../07_api/11_websocket.md)다.

### Origin 검증

| 관점 | 내용 |
|------|------|
| 규칙 | 핸드셰이크 Origin을 CORS 허용 목록과 **같은 목록**으로 검증 · 밖이면 업그레이드 뒤 4403 |
| 막는 것 | 다른 오리진 페이지의 브라우저 WebSocket — 브라우저는 Origin을 위조하지 못한다 |
| 막지 못하는 것 | **브라우저 밖 클라이언트** — Origin 헤더를 임의로 싣는다 · 신원 경계는 첫 메시지 인증이다 |
| 적용 시점 | **S2부터** — 인증(②③)만 S7이다([../07_api/11_websocket.md](../07_api/11_websocket.md) 연결 단계) |
| 리뷰 판정 | Origin 검증을 CORS와 같은 S2부터 적용한다 — W7 반영(REQ-AUT-13 ① · REQ-RLT-09 · 07_api/11) |

- 검산: 관점 = **5**
- **Origin 검증 없는 WebSocket은 CORS보다 넓게 열린다(A형).** 통념은 무인증 기간에도 CORS가 다른 오리진을 막는다는 것이다. 부정 — CORS는 HTTP 응답에만 걸리고 WebSocket 핸드셰이크에는 걸리지 않는다. 같은 머신 브라우저의 아무 페이지나 ws://localhost:3000/ws/realtime에 붙어 subscribe를 보내면 실시간 프레임을 받는다. 진짜 축은 **Origin 검증의 적용 시점**이다. 대체 경로 — Origin 검증은 토큰이 필요 없어 S2부터 건다 — CORS를 S2부터 거는 근거(REQ-AUT-12)와 같다(W7 반영). 남는 것은 Origin을 위조하는 브라우저 밖 클라이언트이고, 그 방어는 S7의 첫 메시지 인증이다.

### 종료 코드 8종 리뷰

인계 "WS 종료 코드 8종 리뷰"를 닫는다. **판정 — 8종을 유지한다. 새 코드를 제안하지 않는다.**

| 코드 | 방어 관점 | 판정 |
|:--:|------|------|
| 1000 | 정상 종료 — 방어와 무관 | 유지 |
| 1001 | 재기동 — 재연결 폭주의 시작점 · 백오프 상한이 흩는다 · R3이 한도 쪽을 받는다 | 유지 |
| 4400 | 형식 위반 · URL 쿼리 구독 거절 — 인증 전 구독 창을 닫는 장치 | 유지 — 재연결하지 않아 형식 공격이 재시도 루프가 되지 않는다 |
| 4401 | 인증 대기 초과 · 토큰 불량 · 만료 — 무인증 소켓의 수명 상한 | 유지 — 대기 시간 값이 미정인 동안 무인증 소켓 수명이 열려 있다(잔여) |
| 4403 | Origin 밖 · 역할 0 — 갱신으로 풀리지 않는 거절 | 유지 — 4401과 합치면 Origin 불일치에도 갱신 루프를 돈다 |
| 4408 | pong 미수신 — 죽은 연결 정리 | 유지 |
| 4413 | 느린 소비자 — 한 브라우저가 게이트웨이 메모리를 잡는 것을 끊는다 | 유지 — 송신 대기량 한도가 이 코드의 방어 값이다 |
| 4503 | Redis 불가 — 업스트림 실패를 원인과 함께 알린다 | 유지 |

- 검산: 코드 = **8** · 유지 8 · 신설 제안 0
- **8종이 다루지 않는 위협은 연결 수다.** 사용자당 · 전체 동시 연결 상한이 없어 한 스크립트가 인증 대기 시간 안에 소켓을 계속 연다 — 상한을 두면 초과를 알릴 종료 코드가 필요하지만, 상한 자체가 3계층 미확인(연결 수 상한 · [../07_api/11_websocket.md](../07_api/11_websocket.md))이라 코드를 먼저 만들지 않는다. 잔여로 등재한다([04_threat_model.md](./04_threat_model.md)).
- 레이트 리밋은 WebSocket 메시지를 세지 않는다 — 계수 단위는 REST 요청이다. subscribe 폭주는 연결당 구독 설비 상한(subscribed.rejected reason limit)이 묶는다.

## 보안 헤더와 응답 비노출

| 항목 | 값 | 근거 | 어기면 |
|------|------|------|------|
| X-Content-Type-Options | nosniff | REQ-AUT-13 · 원본 tech_stack.md §10.4 | 브라우저가 JSON · CSV를 다른 형식으로 추측해 실행한다 |
| Referrer-Policy | 부여 — 값은 플러그인 기본 | 상동 | 다른 사이트로 가는 요청에 api 경로 · 쿼리가 실린다 |
| HSTS | **끈다** | 상동 · TLS 없음 | 브라우저가 localhost를 https로 고정해 웹 접속이 끊긴다 |
| 에러 봉투 | 스택 · SQL · 접속 문자열 없음 · 500은 code 없이 message만 | [../07_api/01_conventions.md](../07_api/01_conventions.md) §에러 봉투 | 오류 한 번이 스키마 · 쿼리 구조 · 자격 증명을 드러낸다 |
| 공개 표면 본문 | 업무 데이터 · 비밀 없음 | REQ-OBS-10 | 공개 판정의 근거(호출 주체가 기계 · 업무 데이터 없음)가 무효가 된다 |
| 계정 존재 | 비활성 · 없는 계정도 invalid_credentials · 같은 본문 · 같은 대조 시간 | REQ-AUT-02 | 응답만으로 계정 목록을 센다 |

- 검산: 항목 = **6**
- 헤더 플러그인의 부 버전 · 기본 헤더 집합은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 버전 고정표 · [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)에서 착수 시 확인한다.

## 원본 대조

| 원본 자리 | 사실 | 이 문서의 자리 |
|------|------|------|
| architecture §2 경계 표 직결 행 | 고빈도 실시간 데이터는 BFF를 경유하지 않는다 | §CORS 대상 표면 · 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) |
| architecture §2 경계 표 웹 → DB 행 | 금지 — 인가 검사를 우회하는 경로를 만들지 않는다 | §방어 지점 전수(방어 지점이 api 하나인 전제) · [05_local_exposure.md](./05_local_exposure.md) |
| architecture §11.2 도입 문단 | 프록시 · 로드 밸런서 없음 — NestJS가 직접 처리 | 도입 단락 |
| architecture §11.2 CORS 행 | localhost:3001 하나 · 포트가 다르면 오리진이 다르다 · 와일드카드 금지 | §CORS |
| architecture §11.2 레이트 리밋 행 | 사용자 · 토큰 기준 분당 · Redis INCR · IP 기준 무의미 | §레이트 리밋 등급 · §계수 기전 리뷰 |
| architecture §11.2 WebSocket Origin 행 | CORS 허용 목록과 같은 규칙 | §Origin 검증 |
| architecture §11.2 보안 헤더 행 | X-Content-Type-Options · Referrer-Policy · HSTS 비활성 | §보안 헤더와 응답 비노출 |
| architecture §18 애플리케이션 계층 방어 행 | 전부 NestJS · 방어 지점이 코드 한 곳 | 도입 단락 · §방어 지점 전수 |
| architecture §18 CORS 행 | 하나만 허용 · 와일드카드 금지 | §CORS |
| architecture §18 레이트 리밋 행 | 사용자별 + 엔드포인트별 · query와 export에 엄격히 | §레이트 리밋 등급(class 판정) · R1 |
| architecture §18 SQL 인젝션 행 | 파라미터 바인딩 · 태그 ID 정수 검증 | §ClickHouse 파라미터 바인딩 |
| tech_stack §10.4 프로토콜 · CORS · 쿠키 표 | CORS · 보안 헤더 · 레이트 리밋 · Origin 검증 행 | 상동 각 절 · 쿠키 · 토큰 행은 [01_authn_authz.md](./01_authn_authz.md) |
| tech_stack §10.4 마지막 문단 | CORS · 헤더 · 리밋 · Origin 전부 NestJS · 대신할 계층 없음 | 도입 단락 |

- 검산: 원본 행 = **13** · 누락 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| class별 한도 값 4 | 2계층 미정 — 관계식 R1~R4 고정 · 오른쪽 항 확정 뒤 이 문서에서 정한다 | 이 문서 · 오른쪽 항 [../07_api/09_datagen.md](../07_api/09_datagen.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md) · EXP-37 |
| WebSocket 연결 수 상한 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../07_api/11_websocket.md](../07_api/11_websocket.md) · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) |
| 한도 기동 검사(관계식 위반 거부) | 계약만 — 검사 자리 미설계 | 구현 착수 시 |
| Host 대조 거절의 응답 모양 | 닫힘(최종 검수 판정) — 새 코드 없이 common.validation_failed/400 · fields [path header.host · reason enum(허용값 밖)] · WebSocket 핸드셰이크는 업그레이드 전에 같은 HTTP 400으로 거절한다(정상 클라이언트는 도달하지 않는 경로라 종료 코드로 원인을 알릴 대상이 없다) | [../07_api/01_conventions.md](../07_api/01_conventions.md) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |

## 관련 문서

- [01_authn_authz.md](./01_authn_authz.md) — 토큰 · 쿠키 · 인가 · 첫 메시지 인증
- [02_secrets_config.md](./02_secrets_config.md) — 부하 주입 게이트 · 비밀 비노출
- [04_threat_model.md](./04_threat_model.md) — 이 문서 판정이 반영되기 전의 잔여
- [05_local_exposure.md](./05_local_exposure.md) — 경계 밖 노출
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — BFF 배정 · 헤더 · 봉투 · 한도 등급 묶음
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — 종료 코드 정본
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 부하 주입 등급 조건
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — rl 키 모양
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — aut_ratelimit 계수
