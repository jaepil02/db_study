# 프론트엔드 스택

> **대상**: 웹(Next.js App Router · 호스트 프로세스)의 구성 선택 — BFF 역할과 경로 분담 · 차트(uPlot 주력 · ECharts 보조) · TanStack Query 설정값(staleTime · gcTime) · Zustand 실시간 스토어 · 네이티브 WebSocket 래퍼 · Tailwind CSS · shadcn/ui · 폼 · zod 공유 · **화면 조정값 현행값(링 버퍼 창 · 트렌드 창 · 콘솔 폴링 주기 · BFF revalidate)**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §2 · §4 · §4.1 · §4.2 · §4.3 · §10.1 · §10.4(커밋 ff66a37) · 원본 data_flow.md §7.2(커밋 ff66a37) · ADR-02 · ADR-07 · ADR-12 · 웨이브 인계 W6 10_observability/04 행(staleTime · gcTime · 링 버퍼 창 · 트렌드 창 · 콘솔 폴링 주기 현행값) · [../08_screen/01_standards.md](../08_screen/01_standards.md) §갱신 주기와 캐시 층 정렬(관계식) · [../08_screen/03_realtime_dashboard.md](../08_screen/03_realtime_dashboard.md) · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)

웹은 **컨테이너가 아니라 호스트 프로세스**로 도는 Next.js다(루트 README 고정 기준 실행 구성). 선택의 결정은 ADR-02이고, 이 문서는 그 결정 아래의 **라이브러리 구성과 설정값**을 갖는다. 라이브러리 버전은 적지 않는다 — 정본은 [03_data_infra.md](./03_data_infra.md) §버전 고정표다.

**이 문서는 화면 조정값의 현행값을 갖고 관계식은 갖지 않는다.** staleTime이 따라야 할 관계식은 [../08_screen/01_standards.md](../08_screen/01_standards.md) §갱신 주기와 캐시 층 정렬이, 서버 층 TTL은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)가 갖는다. 아래 설정값은 전부 그 관계식에서 **파생**한 2계층 조정값이다 — 서버 층 TTL이 바뀌면 이 문서의 값이 같은 변경 단위에서 다시 파생된다.

**Next.js를 고른 결정적 이유는 SSR이 아니라 Route Handler를 BFF로 쓸 수 있다는 것이다**(원본 tech_stack.md §4.1). 차트는 어차피 클라이언트 컴포넌트라 SSR 이점이 제한적이고, 로컬 개발 서버도 Node 서버라 BFF 근거는 그대로 선다.

## 구성 선택

| 영역 | 선택 | 선택 근거 | 버린 것 — 실패 | 근거 상세 |
|------|------|------|------|------|
| 프레임워크 | Next.js App Router | Route Handler가 BFF — 리프레시 토큰을 서버에서만 다룬다 | React + Vite SPA — 서버 측 코드가 없어 httpOnly 쿠키의 리프레시를 브라우저 JS가 다루게 된다 | [06_decisions_rationale.md](./06_decisions_rationale.md) §프론트엔드 |
| 차트 주력 | uPlot | 초경량 Canvas · 시계열 특화 · 10만 점을 부드럽게 | Recharts — SVG DOM 노드가 1만 점부터 폭증 | 상동 |
| 차트 보조 | Apache ECharts | dataZoom · 브러시 · 분포 차트(비교 화면) | Chart.js — 10만 점에서 버벅임 · 범용 차트 둘을 두면 렌더러가 셋 | 상동 |
| 서버 상태 | TanStack Query | staleTime · gcTime으로 브라우저 층을 Redis TTL과 정렬해 2단 캐시 실험을 한다 | 직접 fetch + 상태 — 브라우저 층의 수명이 코드마다 달라 층별 기여를 가를 수 없다 | 상동 |
| 클라이언트 상태 | Zustand | 실시간 태그 값 스토어 · 링 버퍼를 구독자 밖에서 갱신 | Redux — 초당 10프레임마다 액션 · 리듀서를 거쳐 보일러플레이트와 복사가 는다 | 상동 |
| 실시간 채널 | 네이티브 WebSocket + 재연결 래퍼 | 프레임 오버헤드 최소 · 서버 게이트웨이와 같은 프로토콜 | Socket.IO — 자체 프로토콜 오버헤드가 고빈도 푸시에 붙는다 | 상동 |
| 스타일 | Tailwind CSS + shadcn/ui | 대시보드 레이아웃 · 컴포넌트 소스를 저장소에 둔다 | 디자인 토큰 문서 · 별도 컴포넌트 라이브러리 — 학습 대상이 아닌 층이 는다 | 이 문서 |
| 폼 · 검증 | React Hook Form + zod | zod 스키마를 NestJS DTO와 공유 | 폼 전용 검증 규칙 — 서버와 규칙이 두 벌이 된다 | 이 문서 §zod 공유 |

- 검산: 영역 = **8**
- 선택의 결정은 ADR-02(BFF) 하나이고 나머지는 결정이 아니라 구성이다 — 채택하지 않은 기술의 실패 시나리오 전수는 [06_decisions_rationale.md](./06_decisions_rationale.md)가 갖는다.

## BFF 역할과 경로 분담

ADR-02의 결정을 라이브러리 경계로 옮긴 표다. 경로별 전수의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)와 각 화면 명세다.

| 경로 | 무엇이 지나는가 | 서버 측 캐시 | 이유 | 이 경로를 바꾸면 |
|------|------|------|------|------|
| 브라우저 → BFF → api | 로그인 · 토큰 갱신 · 로그아웃 | 없음 | 리프레시 토큰(httpOnly 쿠키)을 브라우저 JS가 보지 않는다 | 리프레시 토큰이 JS에 노출된다 — BFF를 두는 가장 큰 이유가 사라진다 |
| 브라우저 → BFF → api | 저빈도 업무 조회(사이트 · 라인 · 설비 · 태그 목록) | 서버 fetch 캐시 revalidate · 태그 무효화(ADR-12 ⑤) | 요청 오리진을 하나로 모으고 저빈도 응답을 짧게 흡수 | 무효화 체인 ⑤단이 걸릴 자리가 없다 |
| 브라우저 → BFF → api | 업무 조회 중 Redis 캐시가 있는 것(알람 규칙 · 이벤트 · 작업지시) | **no-store** | 서버 층이 Redis 하나여야 staleTime 관계식이 성립한다 | BFF 캐시와 Redis가 겹쳐 옛 값의 창이 두 층의 합이 된다 |
| 브라우저 → BFF(파일 읽기) | EXP-COMPARE 비교 값 — docs/measurements 읽기 | 없음 | api 표면이 없다(07_api/10 판정) | 해당 없음 — 기록 파일이 원천이다 |
| 브라우저 → api 직결 | 최신값 · 시계열 조회 · WebSocket | 없음 | 고빈도 요청에 중계 1홉을 더할 이유가 없다 | 초당 수 회 요청마다 Node 개발 서버 1홉이 더해져 측정 대상 밖 지연이 섞인다 |

- 검산: 경로 = **5** — BFF 경유 4 · 직결 1
- **직결 경로의 보호는 CORS 허용 오리진 하나 · Bearer 액세스 토큰 · WebSocket Origin 검증이다**(ADR-02). 두 주소의 환경변수 이름 정본은 [04_local_environment.md](./04_local_environment.md) §환경변수다.
- **BFF는 api 메트릭 텍스트를 해석한다.** 화면용 요약 JSON 표면을 두지 않는 판정(07_api/10)에 따라 /metrics 텍스트를 BFF Route Handler가 읽어 요약한다 — 해석 결과의 모양은 [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md)의 판정이고, 텍스트 파서 라이브러리 선택은 §미확인 · 미설계 등재에 둔다.

## TanStack Query 설정값

[../08_screen/01_standards.md](../08_screen/01_standards.md)의 관계식 **"staleTime = 그 응답을 낸 가장 가까운 서버 층의 수명 하한"**에서 파생한 현행값이다. 지터가 있는 서버 층은 하한(TTL × 0.8)에 맞춘다. 서버 층 수명은 소유처의 현행 참고를 옮긴 것이다.

| 쿼리 | 가장 가까운 서버 층 · 수명(현행 참고) | 파생식 | **staleTime 현행값** | 새 값을 얻는 수단 |
|------|------|------|------|------|
| 설비 · 단일 태그 최신값 | 없음 — rt:latest는 봉인 계열 | 0 | **0** | 진입 · 재연결 1회 · WS 프레임 |
| 시계열 — 완전 과거 | Redis cache:q · 300초 ±20% | 300 × 0.8 | **240초** | 수동 재조회 |
| 시계열 — 현재 버킷 포함 | Redis cache:q · 30초 ±20% | 30 × 0.8 | **24초** | 수동 · 따라가기 |
| 시계열 — 최근 구간 | 없음 — 캐시하지 않는다 | 0 | **0** | 최신값 · WS로 유도 |
| 사이트 · 라인 · 설비 · 태그 목록 | BFF 서버 fetch 캐시 · revalidate 30초 | revalidate 창 | **30초** | 체인 ⑥ 신호 · 자기 쓰기 성공 |
| 알람 규칙 | Redis cache:alarmrules · 300초 ±20% | 300 × 0.8 | **240초** | 체인 ⑥ 신호 · 자기 쓰기 성공 |
| 알람 이벤트 | Redis cache:alarmevents · 30초 · 지터 없음 | TTL | **30초** | ch:alarm 푸시 · 자기 ACK 성공 |
| 작업지시 · 실적 | Redis cache:workorders · 60초 · 지터 없음 | TTL | **60초** | 자기 쓰기 성공 · 수동 |
| 감사 로그 · health · metrics | 없음 | 0 | **0** | 수동 · 화면별 폴링 |

- 검산: 표 행 9 — 관계식 표의 쿼리 12(08_screen/01)를 staleTime 값이 같은 것끼리 묶었다(최신값 2 → 1 · 감사 · health · metrics 3 → 1) · 12 − 1 − 2 = **9**
- **값은 관계식의 산출이지 선택이 아니다.** 서버 층 TTL이 바뀌면 여기를 손으로 고치지 않고 파생식을 다시 계산한다. 서버 TTL과 staleTime이 따로 바뀌면 2단 캐시 실험에서 브라우저 층과 서버 층의 기여를 가를 수 없다(08_screen/01).
- **staleTime 0은 "매번 요청"이 아니다.** 0은 화면이 다시 마운트되거나 창에 포커스가 돌아올 때 재조회 대상이 된다는 뜻이고, 주기 재조회는 따로 켜야 돈다 — 최신값은 주기 재조회를 켜지 않는다(08_screen/01). 기본 재조회 트리거(창 포커스 · 재연결)의 동작은 공식 참조 — [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)(W7)로 착수 시 재확인한다.

### gcTime

| 쿼리 계열 | **gcTime 현행값** | 근거 | 길게 두면 |
|------|------|------|------|
| 시계열(세 계열 전부) | **60초** | 응답이 수백 KB이고 사용자별이다 — 탭 전환으로 1분 안에 돌아오는 경우만 재사용한다 | 범위 조회 횟수에 비례해 탭 메모리가 는다 — 1시간 분석 세션이면 조회 수백 건분이 남는다 |
| 그 밖의 쿼리 | 라이브러리 기본값 | 응답이 작다 · 재진입 시 즉시 그리는 이득이 메모리보다 크다 | 해당 없음 |

- 검산: 계열 = **2**
- **gcTime은 staleTime과 다른 축이다.** staleTime은 "언제 옛 값인가", gcTime은 "화면을 떠난 뒤 언제 버리는가"다. 시계열의 gcTime 60초가 staleTime 240초보다 짧은 것은 모순이 아니다 — 화면을 떠난 시계열 응답은 신선해도 버린다.
- 라이브러리 기본값의 수치는 버전에 따라 다를 수 있어 여기 적지 않는다 — 공식 참조로 확인한다.

## 실시간 스토어와 WebSocket 래퍼

| 구성 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 태그별 링 버퍼 | Zustand 스토어 안 태그별 고정 길이 버퍼(시각 · 값 두 열 · 타입 배열) · uPlot에는 버퍼 참조를 넘긴다 | 프레임마다 배열을 새로 만들지 않는다(08_screen/01) | 초당 10프레임에서 GC가 트렌드를 끊는다 |
| 이어 붙이기 | 같은 태그는 ts 오름차순만 · 마지막 ts 이하 프레임 값은 버린다 | 08_screen/01 §차트 표준 | 재연결 동기화 값과 늦은 프레임이 섞여 선이 뒤로 꺾인다 |
| 재연결 래퍼 | 끊김 시 지수 백오프 재연결 · 재연결 직후 최신값 1회 동기화 · master 계열 쿼리 1회 무효화 | 07_api/11 · 08_screen/01 §무효화 신호 수신 | 끊긴 동안 놓친 값 · 무효화 신호가 staleTime 창만큼 화면에 남는다 |
| 구독 | subscribe · unsubscribe 메시지 · 화면 이탈 시 해제 | 07_api/11 | 떠난 화면의 태그 프레임이 계속 와 스로틀 창 안 병합 비용만 는다 |
| 무효화 신호 | cacheinv 메시지의 키를 받은 대로 쿼리 키 무효화 · 병합하지 않는다 | ADR-12 ⑥ · 08_screen/01 | 병합하면 키가 빠진다 |

- 검산: 구성 = **5**
- 재연결 백오프 시작 · 상한 · ping 주기의 값은 [../07_api/11_websocket.md](../07_api/11_websocket.md)가 소유한다 — 이 문서는 래퍼가 그 값을 쓴다는 것만 적는다.

## 화면 조정값 현행값

화면 명세가 계약을 갖고 이 문서가 현행값을 갖는다(웨이브 인계 W6 10_observability/04 행). 원본에 값이 없는 항목은 **W6 초기값**이며 표시한 단계의 합격 기록으로 고정한다.

| 조정값 | 계약 · 소유(08_screen) | 파생 · 근거 | **현행값** | 고정 단계 |
|------|------|------|------|------|
| 트렌드 창 길이 | 실시간 트렌드가 그리는 과거 폭 — [../08_screen/03_realtime_dashboard.md](../08_screen/03_realtime_dashboard.md) | 초 단위 추세를 사람이 읽는 폭 · 롤업 분 버킷 여러 개가 보이는 폭 | **5분** | S2 |
| 링 버퍼 창(태그당 슬롯 수) | 고정 길이 버퍼 — [../08_screen/01_standards.md](../08_screen/01_standards.md) | 트렌드 창 ÷ SW-07 스로틀 창(현행 참고 100 ms) = 300초 ÷ 0.1초 | **3,000** | S2 |
| 트렌드 최대 태그 수 | 한 차트에 겹치는 태그 수 — 08_screen/03 | 원본 S2 범위 태그 8(원본 implementation_plan.md §5 S2) | **8** | S2 |
| 콘솔 폴링 주기(health · metrics) | "Prometheus 스크레이프 주기보다 짧지 않게" — [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) | 스크레이프 · MetricsModule 수집 주기 15초([03_data_infra.md](./03_data_infra.md) §구성원 설정) | **15초** | S2 |
| BFF revalidate 창 | 저빈도 목록 흡수 — [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) | 원본 값(원본 tech_stack.md §4.1) | **30초** | 원본 값 |

- 검산: 조정값 = **5**
- **링 버퍼 슬롯 수는 트렌드 창과 스로틀 창에서 파생된다.** SW-07을 off(스로틀 0)로 켠 실험에서는 태그당 초당 프레임이 설비 스캔 주기만큼 늘어 3,000슬롯이 5분보다 짧은 창을 담는다 — 버퍼 길이를 바꾸지 않고 창이 줄어드는 것을 기록 조건에 적는다. 버퍼를 스위치 상태에 따라 늘리면 스위치가 화면 메모리까지 바꿔 on/off 비교가 오염된다.
- **메모리 산술** — 태그 8 × 슬롯 3,000 × 두 열 × 8바이트 = 384 KB. 트렌드 창을 늘려도 탭 메모리는 선형이며 제약은 메모리가 아니라 uPlot이 매 프레임 다시 그리는 점 수다.
- **콘솔 폴링은 정밀 측정 세션에서 멈춘다.** health 폴링마다 세 저장소 왕복이 끼어 p95 꼬리가 폴링 주기에 맞춰 튄다(08_screen/07 B형). 15초는 탐색 세션의 값이다.
- **B형 — 콘솔 수치가 Grafana보다 늦게 바뀌는 것은 결함이 아니다.** 결론 — 콘솔은 스크레이프 주기보다 짧게 폴링하지 않는다. 반대 시나리오 — 1초로 줄이면 콘솔 하나가 Prometheus의 15배 관측 부하가 되어 측정 대상 머신에 관측 도구보다 큰 부하를 얹는다. 파생 지침 — 초 단위 추이가 필요하면 콘솔이 아니라 /metrics 직접 덤프를 쓴다.

## zod 공유와 타입

| 공유 대상 | 위치 | 쓰는 자리 | 공유하지 않으면 |
|------|------|------|------|
| API 요청 · 응답 스키마 | packages/shared | 웹 폼 검증 · BFF · api DTO | 서버 검증과 폼 검증이 두 벌이 되어 한쪽만 고친 필드가 400으로 돌아온다 |
| WebSocket 메시지 스키마 | packages/shared | 웹 래퍼 · api 게이트웨이 | 프레임 모양이 바뀌면 브라우저가 조용히 버린다 |
| Stream 페이로드 계약 | packages/shared | api 모듈 간 | 웹은 쓰지 않는다 — 계약 정본 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| 에러 코드 문자열 | packages/shared | 웹 에러 표시 · api 예외 필터 | 화면이 모르는 코드가 일반 오류로 뭉개진다 — 코드 정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |

- 검산: 공유 대상 = **4**
- **스키마 원천은 zod 하나다.** OpenAPI 코드젠을 거치지 않는다 — 같은 TypeScript라 타입을 그대로 가져온다(원본 tech_stack.md §3.2 · ADR-01).

## 스타일과 화면 규격

| 항목 | 규칙 | 근거 |
|------|------|------|
| 스타일 체계 | Tailwind CSS 설정의 테마 값 한 자리 | 화면 명세의 레이아웃 펜스는 와이어프레임이고 픽셀 · 색 · 간격은 이 구성 선택을 따른다(08_screen/01) |
| 컴포넌트 | shadcn/ui 소스를 웹 패키지에 복사해 소유 | 컴포넌트 라이브러리 버전 갱신이 화면을 조용히 바꾸지 않는다 |
| 차트 색 | 품질 코드 표현(끊김 · 표지 · 범례)은 08_screen/01 §차트 표준 | 색 선택은 구현이 정한다 · 의미 규칙만 계약 |
| 시각 표시 | Asia/Seoul 표시 · 저장 epoch | 정본 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) |

- 검산: 항목 = **4**
- **디자인 토큰 문서를 두지 않는다.** 이 시스템의 화면은 측정을 보이는 도구이고, 토큰 체계는 학습 목표 두 축 어디에도 걸리지 않는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 트렌드 창 · 링 버퍼 · 최대 태그 · 콘솔 폴링 현행값 | W6 초기값 — S2 합격 기록으로 고정 | 이 문서 · 계약은 08_screen/01 · 03 · 07 |
| BFF의 Prometheus 텍스트 파서 선택 | 미설계 — 라이브러리 또는 직접 구현 | 코드 착수 시 · 이 문서와 [03_data_infra.md](./03_data_infra.md) §버전 고정표 |
| TanStack Query 기본 재조회 트리거 · gcTime 기본값 | 공식 참조 재확인 대기 | [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)(W7) |
| 화면 반영 지연 · 신호 도달 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-29(AC-06) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [../08_screen/01_standards.md](../08_screen/01_standards.md) — staleTime 관계식 · 차트 표준 · 무효화 신호
- [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) — 콘솔 폴링 계약 · BFF 메트릭 해석
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — WebSocket 메시지 · 재연결 값
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-02 · ADR-12
- [03_data_infra.md](./03_data_infra.md) — 버전 고정표
- [04_local_environment.md](./04_local_environment.md) — 웹 환경변수
- [06_decisions_rationale.md](./06_decisions_rationale.md) — 프론트엔드 선정 근거
