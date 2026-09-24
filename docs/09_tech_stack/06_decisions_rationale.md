# 기술 선정 근거

> **대상**: 기술 선정의 근거 상세 — 원본 비교 표 흡수(NestJS 대 Python · Next.js 대 React + Vite · 차트 라이브러리 · 시계열 저장소 · 수집 버퍼) · 단일 런타임의 감수 비용과 완화책 · 전환 조건 · **채택하지 않은 기술과 버린 대안의 실패 시나리오**(원본 §13 전 행 + W6 판정분) · ADR과의 경계
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — 전환 조건 ①의 판정값 미확인 → **약 590만 pps(워커 1) · 전환하지 않음**
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 표 웨이브 표지 (W7) 제거
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 실험 자리 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §1 · §3.1 · §3.2 · §3.3 · §3.4 · §4.1 · §4.2 · §5.2 · §5.3 · §13(커밋 ff66a37) · 원본 implementation_plan.md §2.3(커밋 ff66a37) · ADR-01 · ADR-02 · ADR-03 · ADR-04 · ADR-05 · ADR-19 · ADR-20 · D-01 · D-02 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) · [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) · [03_data_infra.md](./03_data_infra.md) §observability 프로파일 구성원 판정 · [05_tooling_devops.md](./05_tooling_devops.md) §마이그레이션 도구 판정

**결정은 ADR이 갖고, 이 문서는 근거를 갖는다.** ADR은 맥락 · 결정 · 버린 대안 · 파급 4항목으로 결론만 고정한다([../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)). 이 문서는 그 결론에 이른 **비교 표와 실패 시나리오 전수**를 갖는다 — 결정을 다시 논증하지 않고, 각 절의 첫 줄에 결정 자리를 링크한다. 이식 패턴 "버린 대안의 실패 시나리오"의 공동 소유처다([../CLAUDE.md](../CLAUDE.md) 이식 패턴 3종).

**원본 비교 표의 수치는 전부 원본 예상치다.** 처리량 · 압축률 · RPS는 원본 설계서가 통상치로 적은 값이며 4요소(커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태)가 없다. **3계층 미확인 — 확정 전 임의 값 고정 금지**이며 선정의 근거로는 **대소 관계만** 쓴다. 이 시스템에서 잰 값이 원본 예상치를 뒤집으면 해당 ADR의 개정 규칙을 따른다.

**선정 기준은 두 학습 목표와 로컬 메모리 예산이다**(D-01 · D-02). 모든 비교는 ① 컬럼형 대 RDB를 측정으로 아는가 ② Redis 중간 계층의 성격별 분기를 경험하는가 ③ Docker 12 GB 안에서 ClickHouse 몫을 최대로 남기는가 — 셋 중 하나로 판정이 닫힌다.

## ADR과의 경계

| 주제 | 결정 자리(ADR) | 이 문서가 갖는 것 | 이 문서가 갖지 않는 것 |
|------|------|------|------|
| 백엔드 런타임 | ADR-01 | NestJS 대 Python 비교 · 감수 비용 · 전환 조건 | 결정 문장 · 파급 |
| 프론트엔드 · BFF | ADR-02 | Next.js 대 React + Vite · 차트 비교 | 경로 분담의 계약(07_api/01 · [01_frontend.md](./01_frontend.md)) |
| 시계열 엔진 | ADR-03 | 시계열 저장소 후보 비교 | 스키마 · 코덱(05_data_stores/03) |
| 수집 버퍼 | ADR-04 | Redis Streams 대 Kafka · RabbitMQ | 엔트리 단위 · 소스 포트(ADR-04) |
| Redis 단일 인스턴스 | ADR-05 | 인스턴스 분리 유예의 실패 시나리오 | 키 계열 · 축출 정책(05_data_stores/05 · 06) |
| 커넥션 풀 | ADR-19 | PgBouncer 유예의 실패 시나리오 | 풀 크기(05_data_stores/02) |
| 관측 스택 | ADR-20 | 상시 기동 · alertmanager · tempo의 실패 시나리오 | 구성원 판정([03_data_infra.md](./03_data_infra.md)) |
| 도구 선택 | ADR 아님 — 이 폴더 판정 | 마이그레이션 도구 · 주입 계획 형식의 버린 대안 | 작업 정의([05_tooling_devops.md](./05_tooling_devops.md)) |

- 검산: 주제 = **8** — ADR 7 + ADR 아님 1
- **도구 선택은 ADR로 올리지 않는다.** 되돌려도 스키마 · 경계 · 측정 조건이 바뀌지 않는 선택이기 때문이다 — 되돌리는 순간 측정 조건이 바뀌는 선택이 생기면 ADR로 올린다([../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) §D와 ADR의 경계와 같은 기준).

## 백엔드 — NestJS 단일 런타임

결정은 ADR-01이다. 원본 tech_stack.md §3.1 · §3.2 · §3.3의 비교와 근거를 흡수한다.

### 두 축의 요구

| 축 | 요구 | NestJS 단일에서의 대응 | 대응이 실패하는 지점 |
|------|------|------|------|
| 제어 평면(REST · WebSocket · 인증 · CRUD) | 타입 안전성 · 프론트와 계약 공유 · IO 바운드 동시성 | Fastify 어댑터 · DI · 모듈 · 이벤트 루프 | CPU 바운드 작업이 같은 루프에 들어오는 순간 — 워커 격리(ADR-25)가 막는다 |
| 데이터 평면(Modbus 폴링 · 배치 적재 · 생성) | Modbus 라이브러리 성숙도 · 수치 벡터화 · 배열 직렬화 | 라이브러리 2개 조합 · 워커 + TypedArray · msgpackr · Stream 경계 | 생성기 처리량이 목표 3배에 못 미치는 순간 — §전환 조건 |

- 검산: 축 = **2** — 런타임을 합쳐도 이 구분은 모듈 경계로 남는다(ADR-01)

### NestJS 대 Python 비교

원본 비교 9행이다. 수치 칸은 원본 예상치다.

| 평가 항목 | NestJS | Python(FastAPI · asyncio) | 우위 | 이 행이 결정에 미친 영향 |
|------|------|------|------|------|
| 프론트와 타입 공유 | 같은 TypeScript · zod 스키마 공유 | OpenAPI 코드젠 경유 | NestJS | **결정적** — 스키마 원천이 하나라 계약 불일치 버그가 구조적으로 사라진다 |
| HTTP 처리량(단순 JSON) | 원본 예상치 3~5만 RPS(Fastify) | 원본 예상치 1~2만 RPS | NestJS | 보조 — 로컬 부하는 이 상한에 닿기 전에 저장소가 먼저 포화한다 |
| 구조 · DI · 모듈화 | 프레임워크가 강제 | 컨벤션 의존 | NestJS | 스위치 = DI 포트(ADR-08)의 물리적 전제 |
| Modbus 라이브러리 | 클라이언트 · 서버 라이브러리 2개 조합 | pymodbus 하나에 서버 시뮬레이터 내장 | Python | **감수** — §감수 비용 |
| 테스트 데이터 생성 | 루프 기반 · CPU 부담 | numpy 벡터 연산 | Python | **감수** — §감수 비용 |
| ClickHouse 드라이버 | 공식 클라이언트 · HTTP 전용 | 공식 드라이버 · Arrow · Parquet 직삽입 | Python | **감수** — §감수 비용 |
| CPU 바운드 병렬성 | worker_threads | GIL · free-threaded 빌드 실험 가능 | 무승부 | **감수** — §감수 비용 |
| 학습 곡선 | 데코레이터 · DI | 낮음 | Python | 무시 — 프론트엔드가 이미 TypeScript라 실질 추가 비용이 아니다 |
| 컨테이너 이미지 크기 | 원본 예상치 150~250 MB | 원본 예상치 120~200 MB | 무승부 | 무시 — 메모리 예산의 결정 요인은 이미지가 아니라 런타임 개수다 |

- 검산: 항목 = **9** — NestJS 우위 3 + Python 우위 4 + 무승부 2 = **9** · 감수 목록 = Python 우위 중 데이터 평면 3 + 무승부 1 = **4**
- **결정을 가른 것은 비교 표가 아니라 메모리 예산이다.** 표만 보면 데이터 평면은 Python이 낫다. 그러나 런타임을 하나 더 띄우면 컨테이너가 늘어 그만큼 ClickHouse 몫이 준다(원본 tech_stack.md §3.3 근거 1) — 학습 목표 ①을 재는 엔진이 예산에서 밀린다.
- **HTTP 처리량 수치는 3계층 미확인이다** — 미확인 · 확정 전 임의 값 고정 금지. 확정 자리 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 프레임워크 교체 비교는 미채번 · 이 스택의 상한은 EXP-22 · EXP-37.

### 감수 비용과 완화책

| 감수 비용 | 완화책 | 완화가 실패하는 신호 | 실패하면 |
|------|------|------|------|
| Node 단일 스레드 이벤트 루프의 CPU 한계 | CPU 바운드 작업을 piscina 워커로 격리(ADR-25) · 이벤트 루프 지연 1급 메트릭 | 수집 pps에 비례한 조회 p95 악화 · 루프 지연 상승 | 역할 분리(확장 1단계) — 코드 변경 없이 APP_ROLE로 |
| Modbus 서버 시뮬레이터 부재 | jsmodbus 서버로 직접 구현 · 레지스터 Buffer 런타임 갱신 | 다중 유닛 ID · 예외 응답 · 지연 주입을 표현하지 못함 | §전환 조건 ② — PlcSim만 분리 |
| numpy 부재 | 타입 배열 벡터 생성 + 워커 병렬 · **S1에서 생성기 처리량 먼저 실측** | 목표 부하의 3배 미달 | §전환 조건 ① — 생성기만 분리 |
| Arrow · Parquet 직삽입 부재 | JSONCompactEachRow + 요청 압축 · 배치 크기로 손실 흡수 | 삽입이 ClickHouse 상한에 못 미침이 실측 | §전환 조건 ③ — Ingest만 분리 |

- 검산: 감수 비용 = **4** — §NestJS 대 Python 비교의 감수 목록 4와 1:1
- **B형 — 감수 비용이 실측으로 드러나는 것은 결정의 실패가 아니다.** 결론 — 단일 런타임은 되돌릴 수 있는 결정으로 설계됐다(원본 tech_stack.md §3.3 근거 4). 반대 시나리오 — 감수 비용을 "없는 것"으로 두면 S1에서 생성기가 미달할 때 측정 전체가 무의미해지는데 대체 경로가 준비되어 있지 않다. 파생 지침 — 완화책마다 실패 신호를 계측하고, 신호가 뜨면 §전환 조건으로 간다.

### 전환 조건

데이터 계약이 Redis Stream 페이로드 하나로 고정되어 있어 역방향 전환 비용이 낮다. **어느 경우에도 제어 평면은 NestJS에 남는다.** 전환 경로의 로드맵 쪽 정본은 [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) §로드맵 밖 조건부 분리다.

| # | 조건 | 판정 근거 | 분리 대상 | 절차 | 재판정이 필요한 것 |
|------|------|------|------|------|------|
| ① | 생성기가 목표 pps의 3배를 내지 못함 | S1 생성기 단독 처리량(GEN-09) | 생성기 | Python 생성기가 같은 Stream에 발행(모드 B) | 생성기 CPU 기록 · SIMULATED 표기 유지 |
| ② | jsmodbus 시뮬레이터 기능 부족 | 다중 유닛 ID · 예외 응답 · 지연 주입을 실험 항목으로 표현 못 함 | PlcSim | pymodbus 프로세스로 분리 · Collector는 접속 주소만 변경 | **COL의 SIMULATED 판정(루프백 규칙)** — 분리하면 host가 서비스명이 된다(02_features/03) |
| ③ | 적재가 Arrow 직삽입을 요구 | JSONCompactEachRow 삽입이 ClickHouse 상한에 못 미침이 실측 | Ingest | 같은 컨슈머 그룹을 소비하는 Python 워커 | 배치 토큰 결정성 · XACK 규칙(ADR-09 · ADR-14) |

- 검산: 조건 = **3** — ADR-01 파급의 "되돌리는 조건 셋"과 같은 집합
- **조건이 닫혀 있다.** 셋 밖의 이유(취향 · 생태계)로 분리하지 않는다 — 분리는 메모리 예산을 다시 잠식한다.

## 프론트엔드 — Next.js와 차트

결정은 ADR-02다. 원본 tech_stack.md §4.1 · §4.2를 흡수한다.

### Next.js 대 React + Vite

| 항목 | Next.js App Router | React + Vite | 판정에 쓴 축 |
|------|------|------|------|
| 서버 런타임 | Node 서버로 동작 · 서버 측 코드 가능 | 정적 SPA · 서버 측 코드 없음 | **결정적** — BFF의 전제 |
| BFF 계층 | Route Handler로 리프레시 토큰 은닉 · 오리진 통합 | 없음 — 브라우저가 api 직접 호출 | **결정적** |
| SSR · RSC | 지원 | 없음 | 무시 — 차트는 클라이언트 컴포넌트 |
| 실시간 대시보드 적합성 | SSR 이점 제한적 | 동등 | 무시 |
| 개발 서버 속도 | 보통 | 매우 빠름 | 감수 — 호스트 프로세스라 HMR은 충분 |
| 번들 크기 | 상대적으로 큼 | 작음 | 감수 — 로컬 전용 |
| 학습 가치 | RSC · 캐싱 계층 이해 | 낮음 | 보조 — 2단 캐시 실험(BFF 캐시 층) |

- 검산: 항목 = **7** — 결정적 2 · 무시 2 · 감수 2 · 보조 1
- **BFF를 두는 이유 셋의 순위** — ① 리프레시 토큰을 서버에서만 다룬다(가장 중요) ② 요청 오리진이 하나로 모인다 ③ 저빈도 조회를 짧게 흡수한다(원본 tech_stack.md §4.1). ①이 없으면 Vite가 이긴다.

### 차트 라이브러리

| 라이브러리 | 1만 점 | 10만 점 | 렌더러 | 판정 | 버린 이유 — 실패 |
|------|------|------|------|------|------|
| Recharts | 무난 | 사실상 불가 | SVG | 채택하지 않음 | 점마다 DOM 노드가 생겨 1만 점부터 레이아웃 계산이 프레임을 끊는다 |
| Chart.js | 양호 | 버벅임 | Canvas | 채택하지 않음 | 범용 차트라 10만 점 트렌드에서 끊기고, ECharts와 같이 두면 렌더러 계열이 둘이 된다 |
| Apache ECharts | 양호 | large 모드로 가능 | Canvas | **보조** | 해당 없음 — dataZoom · 브러시 · 분포 차트 |
| uPlot | 즉시 | 부드러움 | Canvas(초경량) | **주력** | 해당 없음 — 시계열 특화 |

- 검산: 후보 = **4** · 채택 2 + 채택하지 않음 2 = **4**
- 성능 칸은 원본의 정성 평가이며 이 시스템의 측정이 아니다.
- **uPlot은 두 번째 방어선이다.** 첫 방어선은 서버 다운샘플(롤업 · LTTB)이다 — 서버가 줄여 보낸 점을 브라우저가 다시 줄이지 않는다([../08_screen/01_standards.md](../08_screen/01_standards.md) §차트 표준).

## 시계열 저장소 — ClickHouse

결정은 ADR-03이다. 원본 tech_stack.md §5.2의 후보 비교다. 수치 칸은 원본 예상치다.

| 항목 | ClickHouse | TimescaleDB | InfluxDB 3 | PostgreSQL 단독 |
|------|------|------|------|------|
| 단일 노드 삽입 처리량 | 원본 예상치 100만+ rows/s | 원본 예상치 10만~50만 rows/s | 원본 예상치 수십만 rows/s | 원본 예상치 1만~5만 rows/s |
| 압축률 | 원본 예상치 10~30배 | 원본 예상치 5~15배 | 원본 예상치 10~20배 | 원본 예상치 1~3배 |
| 대규모 범위 집계 | 최상 | 중상 | 상 | 하 |
| SQL | 방언(표준 근접) | 완전 PostgreSQL 호환 | SQL + InfluxQL | 표준 |
| UPDATE · DELETE | 비동기 mutation — 사실상 비권장 | 완전 지원 | 제한적 | 완전 지원 |
| 사전 집계 | MV + AggregatingMergeTree | 연속 집계 | 다운샘플링 태스크 | 수동 |
| 운영 복잡도 | 중 | 낮음(PG 확장) | 중 | 낮음 |
| 학습 가치 | 컬럼형 · 머지트리 · 코덱 · MV 전반 | PG 심화 | 시계열 DB 특화 | 낮음 |
| 판정 | **채택** | 채택하지 않음 | 채택하지 않음 | **대조군으로만**(ADR-17) |

- 검산: 후보 = **4** · 비교 항목 = **8** · 판정 행 1
- **PostgreSQL 단독은 버린 것이 아니라 대조군으로 남았다.** 목표 ①은 "왜 RDB가 아니라 컬럼형인가"를 측정으로 아는 것이라, 버린 후보 하나를 같은 데이터로 돌려야 답이 나온다(D-05 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)).
- **삽입 처리량의 헤드룸이 판정에 들어간 이유** — 이 시스템은 삽입 한계에 닿는 지점을 재려 한다. 헤드룸이 좁은 엔진이면 한계가 엔진에서 먼저 와 Redis 백프레셔 · 스풀 경로(목표 ②)를 관찰하기 전에 실험이 끝난다.
- 처리량 · 압축률은 3계층 미확인이다 — 확정 자리 [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(EXP-21 · 35 · 22).

## 수집 버퍼 — Redis Streams

결정은 ADR-04다. 같은 프로세스 안에서도 Stream을 경유하는 근거 넷은 ADR-06이 갖는다. 원본 tech_stack.md §5.3의 브로커 비교다.

| 항목 | Redis Streams | Kafka | RabbitMQ |
|------|------|------|------|
| 도입 비용 | 이미 캐시로 쓰므로 0 | 별도 클러스터 + 메타데이터 계층 | 중 |
| 단일 노드 처리량 | 원본 예상치 수십만 msg/s | 원본 예상치 수백만 msg/s | 원본 예상치 수만 msg/s |
| 보존 | 메모리 · MAXLEN 트리밍 | 디스크 · 장기 보존 | 소비 후 삭제 |
| 재처리 | 트림 범위 안에서만 | 오프셋 자유 이동 | 어렵다 |
| ClickHouse 네이티브 연동 | 없음 — 워커 필요 | Kafka 엔진 내장 | RabbitMQ 엔진 내장 |
| 로컬 단일 머신 적합성 | 높음 | 낮음 — 메모리 과다 | 중 |
| 판정 | **채택** | 보류 — 확장 마지막 단계 | 채택하지 않음 |

- 검산: 후보 = **3** · 비교 항목 = **6** · 판정 행 1
- **Redis Streams를 고른 결정적 축은 메모리 예산과 목표 ②다.** "Redis를 서버와 DB 사이에 끼운다"가 요구 그 자체이고, 12 GB 예산에 Kafka까지 올리면 ClickHouse 몫이 남지 않는다.
- **Kafka 전환 경로는 열려 있다.** 적재 소스를 포트(PointSourcePort)로 추상화해 두 번째 구현은 그 단계에서만 만든다([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §스위치가 아닌 교체 포트).

## 채택하지 않은 기술과 버린 대안의 실패 시나리오

원본 tech_stack.md §13의 전 행과, W6이 이 폴더에서 판정하며 버린 대안을 한 표로 둔다. **각 행은 구체적 실패로 끝난다** — "과하다 · 적합하지 않다"가 아니라 무엇이 어떤 순간에 깨지는가다. 되살리는 조건이 없는 행은 "없음"으로 닫는다.

| 기술 | 판정 | 출처 | 실패 시나리오 — 채택했다면 | 되살리는 조건 | 결정 자리 |
|------|------|------|------|------|------|
| Python 데이터 평면(pymodbus · numpy) | 채택하지 않음 | 원본 §13 | 런타임 컨테이너가 하나 늘어 그만큼 ClickHouse 메모리가 준다 · 페이로드 계약이 두 언어에 두 벌 정의되어 한쪽 필드가 바뀔 때 다른 쪽 디코더가 적체 엔트리를 DLQ로 쏟는다 | §전환 조건 3종 | ADR-01 |
| PgBouncer | 유예 | 원본 §13 | 접속 주체가 api 프로세스 하나라 풀러가 할 일이 없고, 트랜잭션 풀링 모드는 prepared statement를 막아 in-process 풀의 이점을 없앤다 | api 다중 인스턴스(확장 2단계) | ADR-19 |
| Redis 인스턴스 2개 분리 | 유예 | 원본 §13 | 컨테이너가 늘어 메모리 예산을 잠식하고, 스트림 적체가 캐시를 밀어내는 현상 — 한 인스턴스에서만 관찰되는 학습 포인트 — 이 구조적으로 사라진다 | 그 현상이 실측된 뒤(확장 3단계) | ADR-05 |
| 관측 스택 상시 기동 | 채택하지 않음 | 원본 §13 | Prometheus · Grafana가 측정 대상과 같은 CPU를 쓰고, 켠 채 얻은 수치와 끈 채 얻은 수치가 같은 기록 형식 아래 섞인다 | 없음 — 선택 프로파일 유지 | ADR-20 |
| Kafka | 보류 | 원본 §13 | 12 GB 예산에서 브로커 메모리가 ClickHouse 몫을 잠식하고, Kafka 엔진이 워커를 없애 Stream 뒤 3계층 분기의 기전(목표 ②)이 엔진 안으로 숨는다 | 확장 로드맵 마지막 단계의 전환 실험 | ADR-04 |
| TimescaleDB | 채택하지 않음 | 원본 §13 | PostgreSQL 하나만 배우게 되어 이종 DB 분리 운용이라는 학습 목표와 어긋난다 — 대조군과 시계열 엔진이 같은 엔진이라 목표 ①의 비교가 확장 유무의 비교로 바뀐다 | 없음 | ADR-03 |
| InfluxDB | 채택하지 않음 | 원본 §13 | SQL 학습 전이성이 낮고 집계 성능이 ClickHouse보다 열위라, 대조 쿼리 5종을 두 방언으로 따로 써야 한다 | 없음 | ADR-03 |
| 관리형 DB 서비스 | 채택하지 않음 | 원본 §13 | 파라미터 튜닝이 막혀 머지 풀 · 메모리 비율 실험을 할 수 없고, 로컬 전용(D-02)을 어겨 원격 접속이 실행 구성에 들어온다 | 없음 — 로컬 전용 | D-02 |
| Kubernetes | 채택하지 않음 | 원본 §13 | 단일 머신에 오케스트레이션 계층이 들어와 제어 평면 자체가 메모리 · CPU를 먹고, 측정 대상 밖 구성요소가 재시작 · 스케줄링으로 결측을 만든다 | 없음 — 로컬 전용 | D-02 |
| gRPC 모듈 간 통신 | 불필요 | 원본 §13 | 한 프로세스 안에 직렬화 계층이 생겨 측정 대상 아닌 비용이 E2E 지연에 섞인다 · 모듈 경계는 Stream이라 RPC 자체가 없다 | 없음 | ADR-01 · ADR-06 |
| Socket.IO | 채택하지 않음 | 원본 §13 | 자체 프로토콜 프레임이 고빈도 푸시마다 붙어 스로틀(SW-07) on/off의 프레임 수 비교에 라이브러리 오버헤드가 섞인다 | 없음 | ADR-02 |
| Recharts | 보조 용도만 → 채택하지 않음 | 원본 §13 | 10만 점 시계열에서 SVG DOM이 폭증해 트렌드가 멈춘다 · 소형 KPI 카드용으로 두면 렌더러 계열이 셋이 된다 | 없음 | [../08_screen/01_standards.md](../08_screen/01_standards.md) §차트 표준 |
| OPC UA | 범위 외 | 원본 §13 | 현장 요구가 Modbus이고, 두 번째 프로토콜이 들어오면 모드 A의 E2E 지연이 어느 프로토콜 계층을 쟀는지 기록이 갈린다 | 확장 시 수집 모듈 어댑터 추가 | 확장 로드맵 밖 |
| alertmanager | 채택하지 않음 | **W6 판정**(보정 #17) | 알림 라우팅만 하는데 로컬 전용이라 수신처가 없다 — 외부 통보 채널을 두는 순간 D-02를 어기고, 두지 않으면 메모리만 먹는 빈 구성요소다 | 없음 — 규칙 평가 · 발화 표시는 Prometheus · Grafana | [03_data_infra.md](./03_data_infra.md) · ADR-20 |
| tempo(분산 추적) | 현 범위 밖 · 조건부 | **W6 판정**(보정 #17) | 추적 SDK가 api 프로세스에 계측 비용을 더해 측정 대상이 측정 도구를 품는다 · E2E 지연은 두 시각 컬럼의 차로 이미 SQL 한 줄에 잰다 | SQL · 메트릭 구간 분해 불가가 실측될 때 | [03_data_infra.md](./03_data_infra.md) |
| Prisma(Migrate · 쿼리 계층) | 채택하지 않음 | **W6 판정** | 스키마 원천이 zod와 Prisma 모델 둘이 되고, pg_partman이 런타임에 만든 자식 파티션을 드리프트로 보고 DB 초기화를 제안해 받아들이면 볼륨 데이터가 사라진다 · ORM 쿼리 비용이 업무 CRUD p95에 섞인다 | 없음 | [05_tooling_devops.md](./05_tooling_devops.md) |
| Valkey 대체 | 현 범위에서 대체하지 않음 | **W6 판정**(원본 고정표 비고 "대체 가능") | 엔진이 바뀐 것이라 대체 전후 수치를 한 실험으로 묶을 수 없고, 축출 · Stream 동작 차이가 목표 ② 결과에 섞인다 | 별도 실험으로 엔진 차이를 재는 경우만 | [03_data_infra.md](./03_data_infra.md) |
| Express 어댑터 | 채택하지 않음 | **W6 판정** | 프레임워크 오버헤드가 커져 조회 p95에 HTTP 계층 비용이 섞이고, 원본 비교의 HTTP 처리량 근거가 전제를 잃는다 | 없음 | [02_backend.md](./02_backend.md) |
| YAML 주입 계획 | 채택하지 않음 | **W6 판정** | 들여쓰기 한 칸 차이가 항목을 다른 부모로 옮겨도 파싱이 성공해 계획과 실제 주입이 조용히 어긋난다 · 파서 의존성이 는다 | 없음 | [05_tooling_devops.md](./05_tooling_devops.md) |

- 검산: 행 = 원본 §13 13(Python · PgBouncer · Redis 2개 · 관측 상시 · Kafka · TimescaleDB · InfluxDB · 관리형 DB · Kubernetes · gRPC · Socket.IO · Recharts · OPC UA) + W6 판정 6(alertmanager · tempo · Prisma · Valkey · Express 어댑터 · YAML) = **19**
- 판정별: 채택하지 않음 13(원본 8 · W6 5) + 유예 2 + 보류 1 + 불필요 1 + 범위 외 1 + 현 범위 밖 · 조건부 1(tempo) = **19** — Valkey는 "현 범위에서 대체하지 않음"으로 채택하지 않음에 센다
- **Recharts의 판정을 원본에서 바꿨다.** 원본은 "보조 용도만(소형 KPI 카드)"이었고 08_screen/01이 채택 라이브러리를 uPlot · ECharts 둘로 닫았다 — 이 표는 화면 표준의 판정을 따른다.
- **유예 · 보류는 되살리는 조건이 있고, 채택하지 않음은 대부분 없다.** 되살리는 조건이 "없음"인 행을 되살리려면 학습 목표나 로컬 전용(D-02)이 먼저 바뀌어야 한다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 비교 표의 처리량 · 압축률 · RPS | 원본 예상치 — 3계층 미확인 · 확정 전 임의 값 고정 금지 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(EXP-21 · 22 · 35 · 37) · REQ-NFR |
| 생성기 처리량(전환 조건 ①의 판정값) | **닫힘(S1 실측 · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값)** — 워커 1 약 590만 pps로 M 티어 3배(3만)의 약 197배 · 전환 조건 ① 발동하지 않음 | [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-09 |
| Prisma 드리프트 동작 | 버린 대안의 실패 근거 — 공식 참조로 재확인 | [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) |
| Kafka 전환 실험 | 확장 로드맵 마지막 단계 | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |

## 관련 문서

- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR 결정 · 버린 대안 요약
- [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) — 확장 단계 · 조건부 분리
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-NN · D와 ADR의 경계
- [01_frontend.md](./01_frontend.md) — 프론트엔드 구성
- [02_backend.md](./02_backend.md) — 백엔드 구성
- [03_data_infra.md](./03_data_infra.md) — 관측 프로파일 판정 · 버전 고정표
- [05_tooling_devops.md](./05_tooling_devops.md) — 도구 판정
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — PostgreSQL 대조군
