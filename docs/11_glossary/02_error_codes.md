# 에러 코드 사전 (02_error_codes)

> **대상**: db_study api 컨테이너의 REST 표면이 반환하는 에러 코드 전수 — 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — common.validation_failed 발생 조건에 Host 헤더 허용 목록 위반 추가(코드 수 불변)
> **개정일**: 2026-09-24 — W7 검수 반영 — README ID 규약 예시와의 충돌 서술 → **W1에 고쳤다**로 갱신 — 코드 수 불변
> **개정일**: 2026-09-24 — W5 표면 판정 반영 — 에러 코드 19 → **22종**(master.reissue_source_inactive/409 · alarms.eval_store_unavailable/503 · work_orders.production_log_not_allowed/409 신설) · common.duplicate_key 대상 · common.postgres_unavailable 인가 단계 표면 · invalid_status_transition fromStatus 경합 조건 보강
> **개정일**: 2026-09-24 — W4 판정 반영 — datagen.stream_full 조건 스트림 길이 → **미확인 적체**(ADR-21) · common.postgres_unavailable 표면에 최신값 단일 태그 추가 · common.rate_limited 키 표기 rl:{class}:{user_id}:{unix_minute} — 코드 수 불변
> **개정일**: 2026-09-24 — W2 요구사항 판정으로 채번 보류 8건을 닫는다 — 에러 코드 14 → **19종**(auth.token_store_unavailable/503 · master.scale_change_forbidden/409 · timeseries.clickhouse_unavailable/503 · alarms.ack_not_allowed/409 · work_orders.invalid_status_transition/409 신설) · 코드 보유 네임스페이스 5 → **8** · 재사용 1 · 코드 없음 2
> **원천**: 원본 architecture.md §9.3 · §11 · §11.1 · §11.2 · §17(커밋 ff66a37) · 원본 data_flow.md §5 · §7.2 · §12.1 · §12.2(커밋 ff66a37) · 원본 architecture.md §6 ERD 유일 제약 · docs_plan.md 실행 계획 보정 #11 · #12 · [04_id_conventions.md](./04_id_conventions.md) 에러 코드 형식

에러는 **{domain}.{snake_case} 코드 + HTTP 상태**로 반환하며 문서에서는 {domain}.{snake_case}/{HTTP}로 적는다. 본 문서는 문서군 전체에서 에러 코드를 **새로 만들 수 있는 유일한 자리**다. [../07_api/02_errors.md](../07_api/02_errors.md)는 미러이며 코드를 신설 · 개명 · 폐기하지 않는다 — 미러가 정본보다 먼저 바뀌면 W5 표면 문서가 존재하지 않는 코드를 인용하게 된다.

**원본에서 실패가 확인되는 것만 채번한다.** 원본 설계서가 실패 조건 · 응답 상태 · 거절 동작을 적은 자리만 코드가 되고, 원본이 적지 않은 실패 후보는 "채번 보류" 절에 등재해 W2 · W5가 요구사항과 표면을 확정할 때 이 문서에서 채번한다. 응답 봉투(본문 구조 · 헤더)의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)이고, 이 문서는 코드 · 상태 · 발생 조건 · 클라이언트 대응만 갖는다.

## 정본 선언

| 축 | 정본 | 성격 |
|----|------|------|
| 코드 채번 · 형식 · HTTP 상태 배정 | 본 문서 | 유일 등재처. 신설 · 개명 · 폐기는 여기서만 한다 |
| 표면별 노출 · 응답 봉투 | [../07_api/02_errors.md](../07_api/02_errors.md) · [../07_api/01_conventions.md](../07_api/01_conventions.md) | 미러 · 규약. 코드 집합은 본 문서를 넘지 않는다 |
| 도메인별 발생 조건의 요구사항 | [../03_requirements](../03_requirements/README.md) 도메인 파일 | REQ가 코드를 인용한다. REQ가 새 실패를 정의하면 본 문서에 먼저 채번한다 |
| 알람 · 배치 상태 전이 | [03_enums_state_machines.md](./03_enums_state_machines.md) | 전이 위반이 코드를 내면 이 문서의 코드를 인용한다 |

## HTTP 상태 규약

상태는 **클라이언트가 할 일**로 고른다. 같은 원인이라도 클라이언트 대응이 다르면 코드를 가르고, 대응이 같으면 원인이 달라도 한 코드로 묶는다.

| HTTP | 뜻 | 클라이언트 대응 축 | 재시도 |
|:----:|----|------------------|:------:|
| 400 | 요청 형식이 계약을 어긴다 | 요청을 고친다 | 금지 |
| 401 | 신원을 확인할 수 없다 | 토큰을 갱신하거나 다시 로그인한다 | 갱신 후 1회 |
| 403 | 신원은 확인됐으나 역할이 표면 권한 밖이다 | 요청을 멈춘다. 역할 부여는 관리자 몫이다 | 금지 |
| 404 | 대상이 없거나 표면이 꺼져 있다 | 대상 · 설정을 확인한다 | 금지 |
| 409 | 현재 저장 상태와 충돌한다 | 다른 값으로 다시 요청한다 | 같은 값으로 금지 |
| 429 | 사용자 · 토큰 기준 요청 한도를 넘었다 | 다음 창까지 기다린다 | 창 경과 후 |
| 503 | 의존 저장소가 응답할 수 없거나 버퍼가 위험 단계다 | 백오프 후 다시 요청한다 | 백오프 |

- **5xx 중 503만 코드로 채번한다.** 500은 설계된 실패가 아니라 결함이므로 코드를 주지 않는다 — 500에 코드를 붙이면 결함이 "정의된 동작"으로 문서화되어 수정 동기가 사라진다.
- **400과 422를 가르지 않는다.** 원본에 형식 오류와 의미 오류를 다르게 다루는 자리가 없고, 클라이언트 대응(요청 수정)이 같다. 의미 검증 실패가 다른 대응을 요구하는 사례가 나오면 그때 422를 도입한다.

## 네임스페이스 배정 규칙

네임스페이스는 **표면을 소유한 도메인 모듈명**이다(모듈명의 하이픈은 밑줄로 바꾼다). 도메인과 무관하게 전역 파이프 · 필터 · 저장소 공통 경로에서 나는 실패는 common이 갖는다.

| 네임스페이스 | 도메인 | 발생 표면 | 범위 |
|-------------|--------|----------|------|
| common | 횡단 | 전 REST 표면 | 요청 검증 · 대상 없음 · 유일 제약 충돌 · 레이트 리밋 · PostgreSQL 접속 불가 |
| auth | AUT | [../07_api/03_auth.md](../07_api/03_auth.md) + 전 표면의 인증 가드 | 자격 증명 · 액세스 토큰 · 리프레시 토큰 · 역할 권한 |
| master | MST | [../07_api/04_master.md](../07_api/04_master.md) | 현재 채번 없음 |
| timeseries | TSQ | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 조회 요청 상한 |
| realtime | RLT | [../07_api/06_realtime.md](../07_api/06_realtime.md) | 최신값 저장소 접속 불가 |
| alarms | ALM | [../07_api/07_alarms.md](../07_api/07_alarms.md) | 현재 채번 없음 |
| work_orders | WRK | [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 현재 채번 없음 |
| datagen | GEN | [../07_api/09_datagen.md](../07_api/09_datagen.md) | 부하 주입 표면의 백프레셔 거절 · 비활성 |
| metrics | OBS | [../07_api/10_metrics.md](../07_api/10_metrics.md) | 현재 채번 없음 |

- **COL · SIM · ING은 네임스페이스를 두지 않는다.** 세 도메인은 외부 표면이 없는 내부 모듈이라 HTTP 응답을 만드는 자리가 없다. 내부 모듈의 실패는 에러 코드가 아니라 **메트릭과 상태 전이**로 드러난다 — ING의 삽입 실패는 재시도대기 → 격리(DLQ) 전이와 dlq_count로, COL의 XADD 실패는 스풀 전환과 spool_active로 계측한다. 코드를 주면 응답으로 나갈 곳이 없는 코드가 생겨 미러와 추적성 표에 유령 행이 된다.
- **/api/v1/ingest/bulk의 에러는 datagen 네임스페이스다.** URL 경로에 ingest가 들어 있지만 이 표면은 부하 주입 표면이라 GEN이 소유한다(docs_plan.md 실행 계획 보정 #11). 거절을 판정하는 것도 ING 소비 루프가 아니라 표면이 XADD 전에 하는 미확인 적체 검사(그룹 lag + pending — XLEN이 아니다 · ADR-21)다. [../README.md](../README.md) ID 규약 표의 예시도 datagen.stream_full/503이다(W0 골격판의 ingest.stream_full/503을 W1에 고쳤다) — ingest를 네임스페이스로 쓰면 "ING은 표면 없음"과 "ING 네임스페이스 코드가 응답으로 나간다"가 동시에 참이 되어 도메인 공백 진술이 깨진다.
- **네임스페이스 정의와 코드 보유를 가른다.** 표면 있는 도메인 8은 코드가 0이어도 네임스페이스를 가진다 — 첫 코드를 채번할 때 이름을 새로 정하지 않도록 자리를 먼저 고정한다.

## 에러 코드 전수

### common — 횡단

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| common.validation_failed | 400 | 요청 본문 · 쿼리 · Host 헤더가 계약을 어긴다(Host는 허용 목록 밖 — path header.host · reason enum · 12_security/03) — 타입 불일치 · 필수 누락 · 허용값 밖(interval이 raw · 1m · 1h · 1d가 아님 · aggregations가 5종 밖 · from · to가 ISO 8601이 아님). 원본 architecture.md §11.1 | 전 REST 표면 | 요청을 고친다. 같은 요청의 재시도 금지 |
| common.not_found | 404 | 경로의 식별자가 가리키는 대상이 마스터에 없다(설비 · 태그 · 알람 이벤트 · 작업지시). **rt:latest 키가 비어 있는 것은 여기가 아니다** — 설비가 마스터에 있으면 ClickHouse 복원 경로를 탄다(원본 data_flow.md §5) | [../07_api/04_master.md](../07_api/04_master.md) · [../07_api/06_realtime.md](../07_api/06_realtime.md) · [../07_api/07_alarms.md](../07_api/07_alarms.md) · [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 식별자를 확인한다 |
| common.duplicate_key | 409 | 유일 제약 컬럼에 이미 있는 값을 쓴다 — tag_master.tag_code · work_order.order_no(원본 architecture.md §6 ERD의 UK) · site.site_code · production_line(site_id, line_code) · device.device_code(05_data_stores/02 UNIQUE) | [../07_api/04_master.md](../07_api/04_master.md) · [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 다른 값으로 다시 요청한다 |
| common.rate_limited | 429 | 사용자 · 토큰 기준 분당 요청 수가 한도를 넘었다. 판정 키는 rl:{class}:{user_id}:{unix_minute} INCR이며(키 모양 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)) **IP 기준이 아니다** — 모든 요청이 127.0.0.1에서 오므로 IP 기준은 전원을 한 사용자로 센다(원본 architecture.md §11.2). 한도 값은 2계층 조정값이며 소유처는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 전 REST 표면 | 다음 분 창까지 기다린다 |
| common.postgres_unavailable | 503 | PostgreSQL에 접속할 수 없어 업무 읽기 · 쓰기가 실패한다. 시계열 조회는 영향을 받지 않는다 — Dictionary가 마지막 적재 값을 유지한다(원본 architecture.md §17). 최신값 단일 태그 조회는 태그 → 설비 해석(cache:tagmeta 미스)이 PostgreSQL에 막히면 이 코드다 — 설비 전체 조회는 값을 내고 메타만 비운다(W4 판정 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)) | 업무 CRUD 표면 · 로그인 · 인가 단계(권한 캐시 미스 — 인증 표면 전부 · REQ-AUT-15) · 최신값 단일 태그([../07_api/06_realtime.md](../07_api/06_realtime.md)) | 백오프 후 다시 요청한다 |

### auth — 인증 · 인가

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| auth.invalid_credentials | 401 | 로그인 자격 증명이 일치하지 않는다 | [../07_api/03_auth.md](../07_api/03_auth.md) | 입력을 고쳐 다시 로그인한다 |
| auth.unauthenticated | 401 | Authorization 헤더가 없거나 액세스 토큰(JWT)의 형식 · 서명이 틀렸다 | 인증이 필요한 전 표면 | 로그인한다 |
| auth.token_expired | 401 | 액세스 토큰의 수명이 지났다(현행 15분 — 원본 architecture.md §11.2) | 인증이 필요한 전 표면 | BFF를 거쳐 리프레시로 새 액세스 토큰을 받고 원요청을 1회 다시 보낸다 |
| auth.refresh_invalid | 401 | 리프레시 토큰이 auth:refresh:{refresh_token_id}에 없다 — 로그아웃으로 폐기 · 수명(현행 14일) 경과 · **메모리 압박으로 축출**. auth 계열은 TTL을 가진 캐시 계열이라 volatile-lru의 축출 후보다 | [../07_api/03_auth.md](../07_api/03_auth.md) | 다시 로그인한다 |
| **auth.token_store_unavailable** | 503 | Redis에 접속할 수 없어 로그인 · 토큰 갱신 · 로그아웃이 리프레시 토큰 저장소에 닿지 못한다. **레이트 리밋은 이 코드를 내지 않는다** — 세지 않고 통과시키며 통과 수를 계측한다(REQ-AUT-14) | [../07_api/03_auth.md](../07_api/03_auth.md) | 백오프 후 다시 요청한다. 재로그인하지 않는다 — refresh_invalid와 대응이 달라 가른다 |
| auth.forbidden | 403 | 인증은 됐으나 역할이 표면 권한 밖이다(원본 data_flow.md §6의 권한 검사). 역할 × 표면 대응의 정본은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) | 권한 검사가 있는 전 표면 | 요청을 멈춘다 |

- **token_expired와 unauthenticated를 가르는 이유는 대응이 다르기 때문이다.** 만료는 조용한 갱신 1회로 복구되고, 서명 불량은 갱신해도 복구되지 않는다. 하나로 묶으면 클라이언트가 서명 불량에도 갱신 루프를 돈다.
- **refresh_invalid의 세 번째 원인은 반직관적이다.** Stream이 적체돼 Redis 메모리가 압박받으면 사용자가 로그아웃된다. 이것이 Stream MAXLEN이 maxmemory보다 먼저 걸리도록 산정한 이유이며(원본 data_flow.md §12.1), maxmemory를 낮춘 축출 실험 중에는 이 코드가 정상 관측값이다.

### master — 마스터 데이터

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **master.scale_change_forbidden** | 409 | 기존 태그의 scale · offset_value를 바꾸는 PATCH다. 스케일 변경은 새 tag_id 발급이므로 기존 행 수정으로 받지 않는다(원본 architecture.md §12 · REQ-MST-07) | [../07_api/04_master.md](../07_api/04_master.md) | 새 태그 발급 동작으로 다시 요청한다 |
| **master.reissue_source_inactive** | 409 | 새 태그 발급(reissue)의 원본 태그가 이미 비활성이다 — 비활성 태그에서 다시 발급하면 계보가 갈라진다(W5 판정 · [../07_api/04_master.md](../07_api/04_master.md) #7) | [../07_api/04_master.md](../07_api/04_master.md) | 현재 활성 후속 태그에서 발급한다 |

### timeseries — 시계열 조회

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **timeseries.clickhouse_unavailable** | 503 | 캐시 미스 조회 또는 내보내기 응답 시작 전에 ClickHouse 접속 불가 · 타임아웃이다. **캐시 히트는 200이고, 대조군 PostgreSQL이나 Redis 최신값으로 우회하지 않는다**(REQ-TSQ-16) | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 백오프 후 다시 요청한다 |
| timeseries.too_many_tags | 400 | 조회 요청 tagIds 배열 길이가 상한을 넘었다(현행 50 — 원본 architecture.md §11.1) | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 태그를 상한 이하 묶음으로 나눠 여러 번 요청한다 |

- **common.validation_failed와 따로 두는 이유는 대응이 "고친다"가 아니라 "나눈다"이기 때문이다.** 같은 코드로 묶으면 클라이언트가 형식 오류로 읽고 요청을 포기한다.

### realtime — 최신값

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| realtime.latest_unavailable | 503 | Redis에 접속할 수 없다. **키가 비어 있는 것과 다르다** — 키만 비면 ClickHouse 복원으로 200을 낸다(원본 data_flow.md §5 · §12.2 · 원본 architecture.md §17) | [../07_api/06_realtime.md](../07_api/06_realtime.md) | 백오프 후 다시 요청한다. 대신 시계열 조회 표면을 호출하지 않는다 |

- **B형 — 최신값 API는 Redis가 죽으면 ClickHouse로 우회하지 않고 실패한다.** 우회하면 대시보드의 초당 수백 회 점조회가 전부 ClickHouse로 쏟아져, 대량 스캔용 엔진이 점조회로 과부하에 걸리고 적재 삽입까지 밀린다. 따라서 이 503은 결함이 아니라 적재 경로를 지키는 차단기이며, 클라이언트도 같은 이유로 시계열 조회로 대체 호출하지 않는다.

### alarms — 알람

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **alarms.ack_not_allowed** | 409 | 확인 대상 행이 state CLEARED이거나 acked_at이 이미 채워져 있다. 두 경우는 대응이 같아 한 코드로 묶는다. CLEARING 중인 열린 행은 확인할 수 있다(REQ-ALM-14) | [../07_api/07_alarms.md](../07_api/07_alarms.md) | 목록을 다시 읽는다. 같은 요청의 재시도 금지 |
| **alarms.eval_store_unavailable** | 503 | 판정 전수 분석 조회(alarm_eval) 중 ClickHouse 접속 불가 · 타임아웃이다. **timeseries.clickhouse_unavailable을 빌려 쓰지 않는다** — 네임스페이스는 표면 소유 도메인을 따른다(W5 판정 · [../07_api/07_alarms.md](../07_api/07_alarms.md) #6) | [../07_api/07_alarms.md](../07_api/07_alarms.md) | 백오프 후 다시 요청한다 |

### work_orders — 작업지시

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **work_orders.invalid_status_transition** | 409 | 현재 status에서 허용 전이 표 밖의 status로 바꾸려 한다(REQ-WRK-04). 조건은 전이 표에 대해 정의되므로 status 값 집합(W3 확정)과 무관하게 코드가 성립한다. 요청의 fromStatus가 현재 status와 다를 때(동시 전이 경합)도 이 코드다 | [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 현재 상태를 다시 읽고 허용 전이로 요청한다 |
| **work_orders.production_log_not_allowed** | 409 | 작업지시가 IN_PROGRESS가 아닐 때 생산 실적을 기록하려 한다(W5 판정 · [../07_api/08_work_orders.md](../07_api/08_work_orders.md) #7) | [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 작업지시 상태를 확인하고 진행 중인 지시에만 기록한다 |

### datagen — 부하 주입

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| datagen.stream_full | 503 | stream:plc:raw의 미확인 적체(컨슈머 그룹 lag + pending — XLEN이 아니다 · ADR-21)가 백프레셔 **위험** 단계 임계를 넘었다. Collector가 스풀로 전환하는 것과 같은 임계다(원본 architecture.md §9.3 · 원본 data_flow.md §12.1). 임계 값은 2계층 조정값이며 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) | [../07_api/09_datagen.md](../07_api/09_datagen.md) | 거절 수를 측정값으로 센다. 재시도 루프로 덮지 않는다 |
| datagen.bulk_disabled | 404 | 부하 주입 표면이 비활성이다. 기본값이 비활성이고 환경변수로만 켠다(원본 architecture.md §11) | [../07_api/09_datagen.md](../07_api/09_datagen.md) | 환경변수를 켜고 재기동한다 |

- **stream_full은 k6 입장에서 실패가 아니라 관측 대상이다.** 모드 C 부하 실험에서 이 코드의 발생률이 곧 HTTP 경유 수집 상한의 신호이며, 재시도로 덮으면 백프레셔가 흡수한 양과 거절한 양을 가를 수 없다.
- **bulk_disabled가 403 · 503이 아니라 404인 이유** — 403은 역할 권한 축이라 역할을 바꾸면 풀린다는 오해를 주고, 503은 "잠시 뒤 재시도"를 뜻해 부하 도구가 꺼진 표면에 재시도 폭주를 건다. 꺼진 표면은 재기동 전까지 존재하지 않는 것과 같으므로 404다. common.not_found와 가르는 이유는 대응(설정 변경)이 다르기 때문이다.

## 종수 산정 기준

**전수는 22종 · 네임스페이스 9(정의) · 8(코드 보유)**다. 세는 자리는 이 절 하나이며 다른 절은 이 수를 다시 세지 않는다.

| 산출 축 | 내역 | 합 |
|--------|------|:--:|
| 네임스페이스별 | common 5 · auth 6 · master 2 · timeseries 2 · realtime 1 · alarms 2 · work_orders 2 · datagen 2 · metrics 0 | 5 + 6 + 2 + 2 + 1 + 2 + 2 + 2 = **22** |
| HTTP 상태별 | 400 2(validation_failed · too_many_tags) · 401 4 · 403 1 · 404 2(not_found · bulk_disabled) · 409 6(duplicate_key · scale_change_forbidden · reissue_source_inactive · ack_not_allowed · invalid_status_transition · production_log_not_allowed) · 429 1 · 503 6(postgres_unavailable · token_store_unavailable · clickhouse_unavailable · latest_unavailable · eval_store_unavailable · stream_full) | 2 + 4 + 1 + 2 + 6 + 1 + 6 = **22** |
| 네임스페이스 정의 | 표면 있는 도메인 8(auth · master · timeseries · realtime · alarms · work_orders · datagen · metrics) + common 1 | 8 + 1 = **9** |
| 코드 보유 네임스페이스 | common · auth · master · timeseries · realtime · alarms · work_orders · datagen — metrics만 0 | **8** |

- **세는 대상은 유효 코드뿐이다.** 폐기 코드는 생기면 별도 절에 폐지 행으로 두고 전수에서 빼며, 채번 보류 후보는 코드가 아니므로 세지 않는다.
- 두 축의 합이 같아야 한다. 한쪽만 고치면 이 표에서 즉시 어긋난다 — 코드를 신설하면 네임스페이스 열과 HTTP 열을 같은 변경 단위에서 고친다.
- 이 수치는 [../README.md](../README.md) 고정 기준과 [README.md](./README.md) 고정 기준(축약)에 행으로 올린다(리드 소유).

## 에러 코드가 아닌 것

실패처럼 보이지만 코드를 주지 않는 동작이다. 코드를 주면 정상 동작이 오류로 계측된다.

| 동작 | 왜 코드가 아닌가 | 드러나는 자리 |
|------|----------------|-------------|
| 조회 캐시 계열의 Redis 실패 | 짧은 타임아웃 후 DB로 우회하는 degrade가 설계 동작이다. 응답은 200이고 지연만 늘어난다 | 캐시 히트율 · API 지연 메트릭 |
| maxPoints 초과 · 긴 범위의 원시 해상도 요청 | 서버가 해상도를 올리거나 LTTB로 줄인다. 거절이 아니라 보정이다(원본 architecture.md §11.1) | 응답 meta.interval · meta.downsampled |
| 캐시 스탬피드 락 획득 실패 | 대기 후 캐시를 다시 읽는다. 요청자는 실패를 보지 않는다 | 락 대기 메트릭 |
| 삽입 실패 → 재시도 → DLQ | 내부 모듈(ING)의 상태 전이다. 응답으로 나갈 곳이 없다 | 배치 재시도 상태 · dlq_count |
| Collector XADD 실패 → 스풀 | 내부 모듈(COL)의 백프레셔 전환이다 | spool_active · spool_bytes |
| MAXLEN 트리밍으로 미소비 엔트리 유실 | 오류를 내지 않는 조용한 유실이라 코드로 잡을 수 없다. **결함으로 계측**한다 | stream_trimmed_unacked |
| CORS 거절 | 브라우저가 응답을 막는 것이며 서버 코드가 도달하지 않는다 | 브라우저 콘솔 |
| WebSocket 인증 · Origin 거절 | HTTP 응답 봉투가 아니라 연결 종료로 표현한다. 종료 코드의 정본은 [../07_api/11_websocket.md](../07_api/11_websocket.md) | 연결 종료 |
| 설계 밖 예외(500) | 결함이다. 코드를 주지 않는다 | 로그 · 에러율 메트릭 |

## 채번 보류의 처리 결과

W1이 원본에 실패 동작이 없어 보류한 후보 8건은 W2 요구사항이 전부 판정했다. **보류 중인 후보는 없다.** 새 후보가 생기면 이 절에 행을 더하고 결정 자리를 적는다.

| 후보 | 판정 | 결과 | 근거 |
|------|------|------|------|
| ClickHouse 접속 불가 시 시계열 조회 | 캐시 미스 거절 | **timeseries.clickhouse_unavailable/503 신설** | [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) REQ-TSQ-16 |
| Redis 접속 불가 시 로그인 · 리프레시 · 레이트 리밋 | 인증 저장소 쓰기는 거절 · 레이트 리밋은 통과 | **auth.token_store_unavailable/503 신설** | [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-14 |
| 알람 ACK 불가 상태 | CLEARED · 이미 확인됨은 거절 · CLEARING은 허용 | **alarms.ack_not_allowed/409 신설** | [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) REQ-ALM-14 |
| 태그 스케일 변경 PATCH | 거절 · 새 태그 발급은 별도 동작 | **master.scale_change_forbidden/409 신설** | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-07 |
| 비활성 계정 로그인 | 계정 존재 노출 방지 | auth.invalid_credentials 재사용 · 신설 없음 | [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-02 |
| 비활성 태그 조회 · 수정 | 200 + is_active false · 404는 마스터에 없는 식별자만 | 코드 없음 | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-08 |
| 헬스체크 실패 | 503 + 저장소별 상태 본문 · 에러 봉투를 쓰지 않는다 | 코드 없음 | [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) REQ-OBS-09 |
| 작업지시 상태 전이 위반 | 허용 전이 표 밖 거절 | **work_orders.invalid_status_transition/409 신설** | [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) REQ-WRK-04 |

검산: 신설 5 + 재사용 1 + 코드 없음 2 = **8**

W5 표면 판정이 낳은 실패 3건은 보류를 거치지 않고 표면 확정과 같은 변경 단위에서 채번했다 — master.reissue_source_inactive/409 · alarms.eval_store_unavailable/503 · work_orders.production_log_not_allowed/409.

## 관련 문서

- [../07_api/02_errors.md](../07_api/02_errors.md) — 미러
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — 응답 봉투 · 헤더 규약
- [04_id_conventions.md](./04_id_conventions.md) — 에러 코드 형식 · 도메인 접두와 네임스페이스 파생
- [03_enums_state_machines.md](./03_enums_state_machines.md) — 상태 전이와 전이 위반
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계 · 장애 시나리오
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 표면 권한
