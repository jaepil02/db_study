# API 공통 규약 (01_conventions)

> **대상**: db_study api 컨테이너 표면 전체에 걸리는 규약 — 경로 버전 · 표면 계층 · BFF 경유와 직결의 배정(ADR-02 정본) · 인증 헤더 · 요청 검증 · 성공 본문 · **에러 봉투** · 시각 직렬화(points 시각 형식 판정) · 수치 직렬화 · 페이지네이션 · 멱등 · 캐시 헤더 · 레이트 리밋 헤더 · 응답 필드 변경 규칙 · 표면 번호 규약 · 표면 요약 표 어휘
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §11 · §11.1 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §7.2 · §14.1 5단계 · §14.2(커밋 ff66a37) · ADR-02 · ADR-12 · REQ-GLB-02 · 19 · REQ-AUT-04 · 07 · 11 · 12 · REQ-TSQ-02 · 05 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 5단계 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · docs_plan.md 웨이브 인계 W5 07_api/01 행

이 문서는 도메인 문서 8본과 WebSocket 문서가 **다시 적지 않는 공통 계약**이다. 도메인 문서는 여기서 벗어나는 예외만 적고, 예외가 없으면 이 문서를 가리킨다. 에러 코드의 집합 · 조건 · HTTP 상태는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)가 정본이고, 이 문서는 그 코드를 **담는 모양**(봉투 · 헤더)만 갖는다.

**BFF 경유와 직결의 배정은 이 문서가 정본이다**(ADR-02 파급). 원본은 요청 종류 여섯 줄로 기준을 세웠고(원본 data_flow.md §7.2), 이 문서는 그 기준을 표면 번호 단위로 내려 적는다. 새 표면을 만들면 이 배정 표에 행이 먼저 생긴다.

**인증은 S7에 붙는다**(D-07 · REQ-AUT-16). S2~S6의 표면은 무인증이며 이 문서의 인증 · 인가 · 레이트 리밋 절은 S7부터 적용된다. 나머지 절(경로 · 검증 · 봉투 · 직렬화)은 표면이 처음 생기는 단계부터 적용된다.

## 표면 계층과 경로

| 계층 | 방식 | 경로 모양 | 본문 | 인증 실패 표현 | 해당 표면 |
|------|------|------|------|------|------|
| REST | HTTP 요청 · 응답 | /api/v1/{도메인 자원} | JSON 객체 | 에러 봉투 + 401 | 도메인 문서 8본의 JSON 표면 |
| 다운로드 스트림 | HTTP 청크 전송 | /api/v1/timeseries/export | CSV · Parquet 바이트 — ClickHouse FORMAT 중계 | 응답 시작 전 에러 봉투 | [05_timeseries.md](./05_timeseries.md) #2 |
| 메트릭 텍스트 | HTTP 응답 | **/metrics — 버전 경로 밖** | Prometheus 텍스트 형식 | 해당 없음 — 공개 | [10_metrics.md](./10_metrics.md) #2 |
| WebSocket | 장기 연결 · JSON 텍스트 프레임 | /ws/realtime | 메시지 봉투(type 필드) | **HTTP 코드가 아니라 종료 코드** | [11_websocket.md](./11_websocket.md) #1 |

- 검산: 계층 = REST · 다운로드 스트림 · 메트릭 텍스트 · WebSocket = **4**
- **버전은 경로 접두 /api/v1 하나로만 표현한다.** 헤더 버전 · 쿼리 버전을 두지 않는다 — 버전이 두 자리에 있으면 BFF 서버 fetch 캐시 · 레이트 리밋 계수가 버전을 모른 채 같은 키로 묶인다. v2는 응답 필드 삭제 · 의미 변경이 생길 때만 연다(§응답 필드 변경 규칙).
- **/metrics가 /api/v1 밖에 있는 것은 결함이 아니다.** 스크레이프 주체(Prometheus · 직접 덤프)의 관례 경로이고, 버전 규칙(필드 삭제 시 v2)이 텍스트 형식 메트릭에는 적용되지 않는다 — 메트릭 이름 변경 규칙은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 갖는다.
- 자원 이름은 복수형 · 하이픈(work-orders · audit-logs · modbus-config는 설비 1:1이라 단수)이고, 경로 식별자는 정수 ID다. 동작이 자원 수정으로 표현되지 않는 전이(비활성화 · 새 태그 발급 · 확인 · 상태 전이)는 **자원 아래 동사 하위 경로 + POST**로 둔다.

## BFF 경유와 직결

원본 기준(원본 data_flow.md §7.2)은 **빈도와 쿠키** 둘이다 — 쿠키가 필요한 요청과 저빈도 조회 · 쓰기는 BFF(Next.js Route Handler), 고빈도 조회와 장기 연결은 브라우저 직결이다(ADR-02). 표면 번호의 정본은 각 도메인 문서다.

| 요청 묶음 | 경로 | BFF 서버 fetch 캐시 | 표면 | 이 배정의 이유 | 반대로 두면 |
|------|------|------|------|------|------|
| 로그인 · 갱신 · 로그아웃 | 브라우저 → BFF → api | 없음 | 03_auth #1~#3 | httpOnly 리프레시 쿠키를 서버에서만 다룬다 — **BFF가 남는 가장 중요한 이유** | 브라우저 JS가 리프레시 토큰을 받아 XSS 한 번에 장기 토큰이 샌다 |
| 마스터 조회 · 쓰기 | 브라우저 → BFF → api | 조회 revalidate · 쓰기 성공 시 무효화(체인 ⑤단) | 04_master #1~#17 | 저빈도 · 사용자 공통 — BFF가 한 번 더 흡수한다 | 쓰기가 BFF를 우회하면 BFF 캐시가 쓰기를 몰라 revalidate 창만큼 옛 목록을 낸다 |
| 작업지시 · 실적 · 감사 조회 | 브라우저 → BFF → api | **no-store** | 08_work_orders #1~#9 | ③계층 read-your-writes | 상태 전이 직후 목록이 옛 상태면 전이 요청이 두 번 온다 |
| 알람 이벤트 · 확인 · 규칙 | 브라우저 → BFF → api | no-store | 07_alarms #1~#5 | 저빈도 — 실시간 표시는 WebSocket 알람 푸시가 맡는다 | 확인 직후 목록이 revalidate 창만큼 미확인으로 남는다 |
| 최신값 조회 | 브라우저 → api 직결 | 해당 없음 | 06_realtime #1 · #2 | 초당 수 회 — 고빈도에 1홉을 더할 이유가 없다 | 최신값 p95가 api가 아니라 BFF 이벤트 루프에 묶인다 |
| 시계열 조회 · 내보내기 · 판정 이력 분석 | 브라우저 → api 직결 | 해당 없음 | 05_timeseries #1 · #2 · 07_alarms #6 | 응답이 크고(수백 KB) 사용자별이라 중계 · 캐시 이득이 없다 | BFF 힙이 대용량 응답을 한 번 더 들고 내보내기 스트림이 두 번 복사된다 |
| WebSocket | 브라우저 → api 직결 | 해당 없음 | 11_websocket #1 | 장기 연결을 BFF가 중계할 이유가 없다 | 연결 수만큼 BFF에 소켓이 쌓여 개발 서버 재시작이 모든 실시간 연결을 끊는다 |
| 헬스 · 메트릭(화면) | 브라우저 → BFF → api | 없음 | 10_metrics #1 · #2 | 실험 콘솔이 저빈도로 읽고 메트릭 텍스트 해석을 서버에서 한다 | 브라우저가 텍스트 형식 전체를 받아 파싱한다 |
| 기계 호출 | Compose · Prometheus · k6 → api | 해당 없음 | 10_metrics #1 · #2 · 09_datagen #1 | 호출 주체가 브라우저가 아니다 | 해당 없음 |

- 검산: 요청 묶음 = **9** · BFF 5 + 직결 3 + 기계 1 = **9**
- **auth 표면 3종은 CORS 응답 헤더를 내지 않는다(판정).** CORS 허용 오리진 http://localhost:3001은 직결 표면에만 붙는다. 브라우저 JS가 login을 직결로 부르면 응답을 읽지 못해 리프레시 토큰이 JS에 닿지 않는다 — BFF 서버 fetch는 CORS 대상이 아니므로 정상 경로는 막히지 않는다. 판정 근거는 REQ-AUT-04, 방어 리뷰는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)다.
- **BFF는 무효화 체인의 ⑤단이다**(ADR-12). BFF를 거치지 않은 쓰기는 ⑤가 빠져 revalidate 창만큼 옛 목록이 남는다 — 마스터 쓰기를 직결로 두지 않는 이유다. 체인 번호 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다.

## 인증 헤더와 출처 방어

| 항목 | 규칙 | 근거 | 어기면 |
|------|------|------|------|
| 액세스 토큰 | Authorization: Bearer {JWT} 헤더 하나 — 쿠키 · 쿼리 파라미터로 받지 않는다 | 원본 architecture.md §11.2 · REQ-AUT-04 | 쿠키로 받으면 직결 요청마다 CSRF 방어가 필요해진다 · 쿼리는 접근 로그에 토큰이 남는다 |
| 토큰의 자리 | 브라우저 메모리 · BFF 경유 요청은 브라우저가 같은 헤더를 BFF에 싣고 BFF가 그대로 api에 싣는다 | ADR-02 | BFF가 매 요청 리프레시로 새 토큰을 받으면 auth:refresh 읽기가 요청 수만큼 는다 |
| 만료 처리 | auth.token_expired/401 → BFF가 쿠키 리프레시로 갱신(03_auth #2) → 원요청 1회 재시도 | REQ-AUT-05 | 두 번 이상 재시도하면 서명 불량 토큰이 갱신 루프를 돈다 |
| 서명 불량 · 헤더 없음 | auth.unauthenticated/401 — 갱신하지 않는다 | REQ-AUT-07 | 만료와 같은 코드면 클라이언트가 서명 불량에도 갱신을 시도한다 |
| 역할 판정 | 역할 집합의 합집합으로 표면 권한을 대조 · 권한 밖 auth.forbidden/403 | REQ-AUT-09 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) | 표면별 권한을 코드에 하드코딩하면 매트릭스와 구현이 두 정본이 된다 |
| CORS | 허용 오리진 http://localhost:3001 하나 · 와일드카드 금지 · **S2부터** | REQ-AUT-12 | S7까지 미루면 S2 웹 화면의 직결 호출이 막힌다 |
| 보안 헤더 | X-Content-Type-Options · Referrer-Policy 등 부여 · **HSTS 끔** · S7부터 | REQ-AUT-13 | 로컬 http에서 HSTS를 켜면 브라우저가 localhost를 https로 고정해 웹 접속이 끊긴다 |

- 검산: 항목 = **7**
- **인가 단계도 503을 낼 수 있다.** 권한 사본(cache:perm:{user_id})이 없고 PostgreSQL이 멈추면 역할 판정을 할 수 없어 common.postgres_unavailable/503이다(REQ-AUT-15) — 시계열 · 최신값 표면도 예외가 아니다. 권한 사본이 있는 사용자는 PostgreSQL 중단 중에도 조회를 계속한다.
- **공개 표면은 둘이다** — 10_metrics #1 · #2(REQ-OBS-10). 09_datagen #1은 공개가 아니라 게이트 + 인증이다. 판정 정본은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가다.

## 요청 검증과 성공 본문

| 항목 | 규칙 | 어기면 |
|------|------|------|
| 스키마 검증 | 모든 REST 표면이 경로 · 쿼리 · 본문을 공유 스키마(packages/shared)로 검증한다 — 위반은 common.validation_failed/400 | 로컬이라 검증을 생략하면 태그 ID 배열에 문자열이 섞여 ClickHouse 파라미터 바인딩에 도달한다(REQ-GLB-19) |
| 모르는 필드 | 요청 본문의 **모르는 필드는 거절한다**(400) | 오타 필드(isActve)를 무시하면 클라이언트는 비활성화가 됐다고 믿는다 |
| 불변 필드 | 경로 식별자 · 소속(deviceId · lineId · tagId 등 도메인 문서가 불변이라 적은 필드)이 수정 본문에 오면 400 | 조용히 무시하면 이동이 된 줄 안다 |
| 대상 없음 | 경로 식별자 · 조회 필터가 가리키는 대상이 없으면 common.not_found/404 · **쓰기 본문이 참조하는 대상**이 없으면 common.validation_failed/400(reason reference) | 본문 참조를 404로 내면 클라이언트가 경로의 자원이 없다고 읽는다(REQ-WRK-02 · REQ-ALM-04) |
| 성공 본문 | **항상 JSON 객체** — 최상위 배열을 내지 않는다. 목록은 items 배열 + meta 객체 | 최상위 배열은 필드를 더할 자리가 없어 meta를 붙이는 순간 v2가 된다 |
| 생성 응답 | 201 + 생성된 자원 전체. 부하 주입만 202(버퍼에 넣었을 뿐 저장이 아니다) | 200으로 내면 생성과 멱등 재요청을 가를 수 없다 |
| 본문 없는 성공 | 204 — 로그아웃 | 해당 없음 |

- 검산: 항목 = **7**
- **필드 이름은 camelCase다.** 저장 컬럼(snake_case)과 이름이 다른 것이 정상이며 대응은 도메인 문서의 응답 예시가 보인다 — 원본 응답 스키마(meta.pointCount · series[].tagId)가 camelCase다(원본 data_flow.md §14.1).

## 에러 봉투

REST 표면의 모든 실패는 아래 봉투 하나로 낸다. **예외는 셋이다** — 헬스의 503은 봉투 대신 정상 본문과 같은 모양을 내고(REQ-OBS-09), 다운로드 스트림 도중의 중단은 봉투를 낼 수 없고(상태 줄이 이미 나갔다), WebSocket은 종료 코드로 낸다.

본문 모양이다.

```json
{
  "error": {
    "code": "timeseries.too_many_tags",
    "message": "tagIds는 50개 이하여야 한다",
    "details": { "limit": 50, "received": 64 }
  }
}
```

- **클라이언트는 code로만 분기한다.** message는 사람이 읽는 설명이며 문구가 바뀌어도 계약 위반이 아니다 — message로 분기하면 문구 수정이 화면 동작을 바꾼다.
- **HTTP 상태는 code가 정한다.** 한 code는 한 상태만 가진다 — 대응표의 정본은 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) HTTP 상태 규약이다.
- details는 선택이며 code별 모양은 아래 표만 쓴다. 표에 없는 code는 details를 싣지 않는다.

| code | details 필드 | 뜻 |
|------|------|------|
| common.validation_failed | fields — (path · reason) 배열 · reason은 required · type · enum · range · format · unknown · immutable · reference 중 하나 | 어느 필드가 왜 거절됐는지 — 화면이 입력 칸에 표시한다 |
| timeseries.too_many_tags | limit · received | 나눌 묶음 크기 |
| common.rate_limited | retryAfterSeconds | Retry-After 헤더와 같은 값 |
| datagen.stream_full | acceptedEntries | 거절 전에 이미 XADD된 엔트리 수 — 0이 아니면 부분 수용 |
| work_orders.invalid_status_transition | currentStatus | 다시 읽지 않고도 허용 전이를 고를 수 있게 |

- 검산: details를 싣는 code = **5**
- **500은 봉투를 싣되 code를 두지 않는다**(error.code 없음 · message만). 설계된 실패가 아니라 결함이다 — 코드를 주면 결함이 정의된 동작으로 문서화된다(정본 HTTP 상태 규약).
- 봉투에 스택 · SQL · 접속 문자열을 싣지 않는다(REQ-OBS-10과 같은 기준 — [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)).

## 시각 직렬화 — points 시각 형식 판정

인계 "API 응답 points의 시각 형식"을 닫는다. **판정 — 측정 시각은 epoch ms 정수, 업무 시각은 UTC ISO 8601 문자열이다. 필드 이름이 형식을 정한다.**

| 자리 | 형식 | 예 | 이유 |
|------|------|------|------|
| 측정 시각 — ts 필드 · points 첫 열 · WebSocket 값 배열 · 판정 이력 버킷 | **epoch ms 정수** | 1757400000123 | 저장 사슬(Stream t0 + dt · rt:latest · DateTime64(3))이 전부 epoch ms다 — 변환 없이 내리고 uPlot 열 배열로 바로 옮긴다 |
| 업무 시각 — 이름이 At으로 끝나는 필드 · plannedStart · plannedEnd | **ISO 8601 · UTC · 밀리초 · Z** | 2026-09-24T01:23:45.123Z | 사람이 로그 · 응답을 읽을 때 순간을 그대로 알 수 있고, 오프셋이 고정이라 파서가 하나다 |
| 요청 시각 파라미터 — from · to · recordedAt · plannedStart · plannedEnd | **오프셋 포함 ISO 8601만** · 오프셋 값은 자유 | 2026-09-24T10:00:00+09:00 | 원본 요청 스키마가 ISO 8601이다(원본 architecture.md §11.1) · 오프셋 없는 값은 400(REQ-GLB-02) |

- 검산: 자리 = **3**
- **A형 — "화면이 KST인데 응답이 UTC라 9시간 틀렸다"는 버그가 아니다.** 통념은 서버가 표시 시간대로 내려야 한다는 것이다. 부정 — 서버가 KST 문자열로 내리고 브라우저가 로컬 시간대를 다시 적용하면 9시간이 두 번 더해진다. 진짜 축은 **변환을 표시 시점에 한 번만 한다**는 것이다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 표시 시간대). 대체 경로 — 화면은 epoch ms와 Z 문자열을 둘 다 Asia/Seoul로 한 번 변환해 표시한다.
- **points 시각을 ISO 문자열로 두지 않은 이유** — 2,000포인트 × 태그 수만큼 24바이트 문자열이 붙어 배열의 배열로 줄인 응답 크기(원본 예상치 약 1/3)가 다시 커지고, 브라우저가 포인트마다 날짜 파싱을 한다. 버킷 시각(DateTime · 초 정밀도)도 × 1000 한 epoch ms로 낸다.
- **epoch 초를 쓰지 않는다.** 원시 해상도는 ms이고, 초 단위로 내리면 같은 초 안의 원시 두 행이 같은 x를 가져 차트가 수직선을 그린다.

## 수치 직렬화

| 값 | JSON 형식 | 규칙 | 어기면 |
|------|------|------|------|
| 측정값(value · 집계값) | 수 | Float64를 왕복 가능한 최단 10진 표기로 · 문자열로 감싸지 않는다 | 문자열이면 uPlot 열 배열로 옮길 때 포인트마다 변환한다 |
| NaN · 무한대 | 나오지 않는다 | 발행 전 BAD_RANGE로 판정되어 적재되지 않는다([../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 3단계) | JSON에 NaN 리터럴이 없어 응답 전체가 파싱 실패한다 |
| 집계 결측 | null | 버킷에 행이 없으면 그 버킷은 **행이 없다** — null은 요청한 집계가 그 해상도에 없을 때만 | 0으로 채우면 결측이 값 0으로 그려진다 |
| 식별자 · 수량 | 정수 | bigint 컬럼(event_id · order_id · audit_id)도 수 — IDENTITY가 2^53에 닿지 않는다 | 해당 없음 |
| 마스터 numeric(scale · offset_value · threshold · deadband · range) | 수 | Float64로 표현한다 — 측정값이 Float64라 변환식 계수에 그보다 높은 정밀도가 무의미하다 | 문자열 10진이면 화면이 계산 전에 파싱을 한 번 더 한다 |
| 품질 코드 | 정수 | 0 · 1 · 2 · 4 · 5 · 9 — 3은 행이 없어 나오지 않는다 | 이름 문자열이면 저장값과 응답값의 대응이 두 개가 된다 |

- 검산: 값 = **6**
- 품질 코드 이름 · 뜻의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)다. 응답의 5(STALE)는 저장값이 아니라 응답 직전 판정이다([06_realtime.md](./06_realtime.md)).

## 페이지네이션

목록이 커지는 표면만 페이지를 나눈다. **오프셋 페이지를 쓰지 않고 키셋 커서만 쓴다.**

| 항목 | 규칙 | 현행 참고 · 소유 |
|------|------|------|
| 요청 | limit(선택) · cursor(선택 · 앞 응답의 meta.nextCursor 그대로) | limit 기본 50 · 상한 200 — 2계층 · 소유 이 문서 |
| 응답 | items + meta.nextCursor(마지막이면 null) · meta.limit | 해당 없음 |
| 정렬 | 표면마다 고정(도메인 문서가 적는다) — 정렬 파라미터를 받지 않는다 | 해당 없음 |
| 커서 | 마지막 행의 정렬 키(시각 + ID)를 담은 불투명 문자열 — 클라이언트가 만들지 않는다 | 해당 없음 |
| 전체 건수 | **내지 않는다** | 해당 없음 |
| 대상 표면 | 07_alarms #1 · 08_work_orders #1 · #6 · #8 · #9 | 해당 없음 |

- 검산: 항목 = **6** · 대상 표면 = **5**
- **오프셋을 버린 이유** — alarm_event는 월 파티션이고 깊은 오프셋은 앞 페이지 행을 전부 읽고 버린다. 키셋은 (시각, ID) 인덱스에서 바로 이어 읽는다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 인덱스). 전체 건수를 내지 않는 이유도 같다 — count(*)가 범위 안 파티션 전부를 훑는다.
- 마스터 목록(사이트 · 라인 · 설비 · 태그)은 페이지를 나누지 않는다. 태그 목록은 설비 필터가 필수라 한 응답이 설비 하나의 태그 수로 묶인다([04_master.md](./04_master.md)).

## 멱등

Idempotency-Key 헤더를 두지 않는다 — 키를 담을 Redis 키 계열이 키 공간 정본에 없고([../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)), 새 접두는 그 문서에서만 늘린다. 쓰기 표면의 중복 방어는 아래 셋 중 하나다.

| 수단 | 표면 | 같은 요청을 두 번 보내면 |
|------|------|------|
| 자연 유일 제약 | 사이트 · 라인 · 설비 · 태그 등록(코드 UNIQUE) · 작업지시 등록(order_no) · 새 태그 발급(newTagCode) | 둘째가 common.duplicate_key/409 — 클라이언트는 목록을 다시 읽는다 |
| 조건부 갱신 | 알람 확인 · 작업지시 상태 전이 · 실적 기록(상태 조건) | 둘째가 409 — 조건이 이미 바뀌었다 |
| 결과 동일(자연 멱등) | PATCH 수정 · PUT 접속 설정 · 비활성화 · 로그아웃 | 같은 결과 · 감사 행은 실제로 바뀐 경우에만 |
| **수단 없음** | **실적 기록의 같은 값 이중 제출 · 부하 주입** | 행이 두 번 생긴다 — 잔여 등재 |

- 검산: 수단 = **4** · 수단 없음 표면 = 08_work_orders #7 · 09_datagen #1 = **2**
- **부하 주입의 이중 제출은 막지 않는 것이 설계다.** 재시도로 생긴 중복 엔트리는 엔트리 ID가 달라 배치 토큰도 달라진다 — 부하 도구는 재시도하지 않는다(REQ-GEN-09). 실적 이중 제출의 잔여는 [08_work_orders.md](./08_work_orders.md) §미확인 · 미설계 등재에 둔다.

## 캐시 헤더

| 응답 | 헤더 | 이유 |
|------|------|------|
| 모든 REST · 다운로드 · 메트릭 응답 | Cache-Control: no-store | 신선도는 서버 쪽 층(Redis 사본 · BFF 서버 fetch 캐시)과 브라우저 쿼리 캐시(staleTime)가 갖는다 — 브라우저 HTTP 캐시가 한 층 더 끼면 무효화 체인 6단 밖의 층이 생긴다 |
| ETag · Last-Modified | **내지 않는다** | 조건부 요청이 성립하려면 모든 사본 층이 같은 검증자를 알아야 하는데 체인은 삭제로 무효화한다 |
| 다운로드 | Content-Disposition: attachment · Content-Type(text/csv · application/vnd.apache.parquet) | 브라우저가 화면이 아니라 파일로 받는다 |

- 검산: 응답 행 = **3**
- 서버 쪽 캐시 여부는 응답의 meta가 말한다 — 시계열 meta.cached(원본 data_flow.md §14.1). 캐시 계층별 TTL의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)이고 표면 요약 표의 캐시 열은 그 키를 인용만 한다.

## 레이트 리밋 헤더

계수 기전은 rl:{class}:{user_id}:{unix_minute} INCR이고(REQ-AUT-11) **IP 기준이 아니다.** 한도 값 · class 값 집합의 소유는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)다.

| 헤더 | 싣는 응답 | 값 |
|------|------|------|
| RateLimit-Limit | 계수된 응답 전부 | 그 class의 분당 한도 |
| RateLimit-Remaining | 상동 | 이번 분 창의 남은 수 |
| RateLimit-Reset | 상동 | 다음 분 창까지 남은 초 |
| Retry-After | 429만 | 다음 분 창까지 남은 초 — details.retryAfterSeconds와 같다 |

- 검산: 헤더 = **4**
- **헤더가 없으면 계수되지 않은 것이다.** 공개 표면 · S2~S6 무인증 표면 · Redis 불가로 통과(degrade)한 요청은 RateLimit-* 헤더를 싣지 않는다 — 통과 수는 계측으로만 센다(REQ-AUT-14). 헤더를 0으로 채우면 부하 도구가 한도 소진으로 오독한다.
- 로그인은 user_id가 없어 계수 대상이 아니다. 로그인 시도 제한의 필요 여부는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)가 판정한다.

### 한도 등급이 갈리는 표면 묶음

class 값의 이름은 소유처가 정한다. 이 표는 **같은 한도로 묶이면 안 되는 표면**만 가른다.

| 묶음 | 표면 | 가르는 이유 |
|------|------|------|
| 일반 | 아래 셋을 뺀 인증 표면 전부 | 해당 없음 |
| 대량 조회 | 05_timeseries #1 · 07_alarms #6 | 원본 "timeseries/query에 엄격히"(원본 architecture.md §18) · 대량 스캔 읽기 예외(권한 매트릭스) |
| 내보내기 | 05_timeseries #2 | 원본 "export에 엄격히" — 조회보다 한 요청의 스캔이 크다 |
| 부하 주입 | 09_datagen #1 | **한도가 부하 목표보다 낮으면 429가 stream_full보다 먼저 와 HTTP 경유 수집 상한 측정이 레이트 리밋 측정이 된다** — 이 묶음의 한도는 실험 부하 위에 둔다 |

- 검산: 묶음 = **4**

## 응답 필드 변경 규칙

원본 계약 변경표(원본 data_flow.md §14.2)의 API 두 줄을 표면 전체로 넓힌다.

| 변경 | 허용 | 절차 | 어기면 |
|------|------|------|------|
| 응답 필드 추가 | 허용 | v1 유지 · 클라이언트는 모르는 필드를 무시한다 | 해당 없음 |
| 응답 필드 삭제 · 이름 변경 · 의미 변경 | 주의 | /api/v2 경로 신설 → 화면 이전 → v1 폐기 | 기존 화면이 빈 칸을 그린다 |
| enum 값 추가(응답) | 주의 | 클라이언트가 모르는 값을 표시 가능한 기본값으로 처리하는지 먼저 확인 | 모르는 품질 코드 · 상태에서 화면이 멈춘다 |
| 요청 선택 필드 추가 | 허용 | 기본값이 기존 동작과 같아야 한다 | 기본값이 다르면 같은 요청의 결과가 바뀐다 |
| 요청 필수 필드 추가 · 허용값 축소 | 주의 | v2 | 기존 요청이 400이 된다 |
| 에러 code 신설 · 개명 | 정본 먼저 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 채번 → [02_errors.md](./02_errors.md) 미러 → 도메인 문서 | 표면 문서가 존재하지 않는 코드를 인용한다 |
| points 열 구성 | 주의 | 열 순서는 요청 aggregations 순서 · 열 이름은 meta.columns — 열을 끼워 넣지 않는다 | 위치로 읽는 차트가 다른 값을 그린다 |

- 검산: 변경 유형 = 원본 2 + 신설 5 = **7**

## 표면 번호와 요약 표 어휘

| 규칙 | 내용 |
|------|------|
| 형식 | {문서} #N — 문서 지역 번호(05_timeseries #3). 자릿수 없음 |
| 채번 자리 | 각 도메인 문서의 **표면 요약 표 행**이 유일한 채번 자리다 |
| 순서 | 번호는 식별자이지 순서가 아니다 — 새 표면은 말미에 채번하고 재배치하지 않는다 · 폐지 번호는 결번으로 남긴다 |
| 세는 기준 | 표면 수 = 요약 표의 유효 행 수(최대 번호가 아니다) · 총수의 정본은 [README.md](./README.md) 도메인별 표면 수 표 |
| 인용 | 다른 문서는 "메서드 + 경로" 또는 "{문서} #N"으로 인용한다 — 경로가 바뀌면 번호는 그대로다 |

- 검산: 규칙 = **5**

요약 표의 열은 아래 닫힌 어휘로만 채운다. 빈 칸을 두지 않는다.

| 열 | 어휘 | 뜻 |
|------|------|------|
| 역할 | 공개 · 게이트 · 리프레시 쿠키 · 전원 · OPERATOR · ENGINEER · ADMIN | 전원 = 역할이 1개 이상인 인증 사용자 · 리프레시 쿠키 = 액세스 토큰 Guard 밖(역할 0 사용자 포함) · 판정 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 캐시 | Redis 키 패턴 + BFF 표기 · 없음 | 키 · TTL의 정본은 키 공간 문서다 — 이 열은 인용만 한다 |
| 에러 코드 | 코드/HTTP 나열 · **인증 표면 공통 4종은 적지 않는다** | 공통 4종 = auth.unauthenticated/401 · auth.token_expired/401 · auth.forbidden/403 · common.rate_limited/429(S7부터 인증 표면 전부) |
| 호출 화면 | [../08_screen/README.md](../08_screen/README.md) 선점 화면 코드 · 전 화면 · 없음 — {기계 주체} | 전 화면 = 선점 화면 코드 전부 |
| 원본 여부 | 원본 · 신설 | 원본 = 원본 architecture.md §11 API 표의 행 · 신설 = 02_features 기능 근거로 W5가 판정 |

- 검산: 열 어휘 = **5** · 역할 어휘 7 · 공통 에러 4
- **역할 열의 "전원"에도 auth.forbidden/403이 난다.** 역할이 0개인 인증 사용자는 갱신 · 로그아웃만 부른다(REQ-AUT-09) — 그래서 forbidden을 공통 4종에 넣었다.

## 하지 말 것

- 에러 코드를 이 폴더에서 만들지 않는다 — 정본은 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)다. 필요한 코드는 제안으로만 적는다.
- 응답에 저장값과 다른 시각 형식을 섞지 않는다 — 필드 이름이 형식을 정한다.
- 캐시 실패 · 스탬피드 대기 소진 · 해상도 상향을 에러로 내지 않는다(에러 코드가 아닌 것 — 정본 표).
- 스위치를 바꾸는 표면을 만들지 않는다 — 전환은 환경변수와 재기동이다(D-06 · REQ-OBS-12).
- 계정 생성 · 역할 부여 표면을 만들지 않는다(REQ-AUT-17).

## 관련 문서

- [02_errors.md](./02_errors.md) — 에러 코드 미러 · 표면별 발생 위치
- [11_websocket.md](./11_websocket.md) — 종료 코드 · 메시지 봉투
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 에러 코드 정본
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — 5단계 API 응답 계약
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 6단 · BFF 캐시
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-02 · ADR-12
- [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) — CORS · 레이트 리밋 한도
