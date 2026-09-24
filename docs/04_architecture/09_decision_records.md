# 기술 결정 기록 (ADR)

> **대상**: db_study의 기술 결정 — ADR-01~25 · 결정 색인 · 분류 검산 · 상태 · 원본 보정 5건 대응 · D-NN과의 경계 — ADR-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S0 실측 반영(EXP-32 · 기록 001 · 사용자 결정) — ADR-14에 상태 항목 신설(보강 — 롤업 3테이블 윈도우 + 종속 MV 중복 제거 설정 한 쌍) — 결정 원문 보존 · ADR 수 · 상태 분류 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — ADR 파급 줄의 후속 판정 대상 표기 3곳을 판정 결과로 갱신(ADR-16 · 20 · 23 — 결정 본문 불변)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — ADR-18 버린 대안 ② 문구 정정 — "인증 없는 DB 포트" → **비밀번호 한 겹만 남은 DB 포트**(세 저장소 모두 비밀번호 필수) — ADR 수 · 상태 불변(정본 12_security/02 · 05)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 후속 판정 등재 W6 결과 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — ADR-09 파급 산술 보정 — M · M+ 모두 초당 1회 → **M 초당 1회 · M+ 초당 2회 · L 초당 10회**(현행 R 50,000) · M+ 배치 100,000행 → **50,000행** — ADR 수 · 상태 불변
> **원천**: 원본 tech_stack.md §1 · §2 · §3 · §4.1 · §5 · §10 · §13(커밋 ff66a37) · 원본 architecture.md §1 · §3 · §4 · §6 · §7.1 · §7.4 · §8 · §9 · §12 · §14 · §17 · §19(커밋 ff66a37) · 원본 data_flow.md §4 · §7 · §8 · §9 · §12.1(커밋 ff66a37) · 원본 implementation_plan.md §2.3 · §4.3 · §7(커밋 ff66a37) · D-01~D-12([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) · [README.md](./README.md) ADR 선점표 · docs_plan 학습 목표 1 · 웨이브 인계 W3 행

이 문서가 **ADR 채번의 유일 정본**이다. 다른 문서는 번호로 인용만 하고 여기서 내린 결정을 다시 논증하지 않는다. 각 ADR은 **맥락 · 결정 · 버린 대안 · 파급** 네 항목으로 고정하고, 결정이 잠정이거나 대체되면 그 앞에 **상태** 항목을 하나 더 둔다. **버린 대안은 각각 구체적 실패로 끝난다** — "성능이 나쁘다"가 아니라 "무엇이 어떤 순간에 깨지는가"까지 쓴다.

채번 규칙은 셋이다.

- **ADR-01~21은 W3 착수 전 리드가 선점한 번호와 주제 그대로다**([README.md](./README.md) ADR 선점표). 제목은 다듬을 수 있지만 번호와 주제는 바꾸지 않는다. **ADR-22~25는 W3가 말미에 채번한 신설 결정이다.**
- **대체된 결정은 원문을 보존한다.** 새 결정을 말미 번호로 채번하고 원 번호에 상태(대체됨 → ADR-NN)를 단다 — 무엇이 살아남고 무엇이 죽었는지를 상태 항목이 가른다. 결번을 만들지 않고 폐지 번호를 재사용하지 않는다.
- **번호는 등재 순서이고 배치는 번호순이다.** 주제 분류는 §분류가 한다.

**ADR 총수 25건**(ADR-01~25 · 결번 없음)이며 세는 자리는 §결정 색인 하나다. **D와 ADR의 경계** — 무엇을 배우고 어디까지 만들고 어떤 순서로 재는가는 D-NN([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)), 그것을 어떤 구조 · 설정으로 강제하는가는 ADR이다.

## 결정 색인

| ADR | 결정 | 분류 | 상태 | 출처 | 주 인용처 |
|------|------|------|------|------|------|
| **ADR-01** | 백엔드 NestJS 단일 런타임 — Python 데이터 평면 미채택 | 런타임 · 표면 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 09_tech_stack/06 |
| **ADR-02** | 프론트엔드 Next.js + Route Handler BFF — 고빈도는 api 직결 | 런타임 · 표면 | 현행 | 선점 | [01_system_architecture.md](./01_system_architecture.md) · 07_api/01 |
| **ADR-03** | 시계열 엔진 ClickHouse — TimescaleDB · InfluxDB 미채택 | 저장소 | 현행 | 선점 | [04_storage_split.md](./04_storage_split.md) · 05_data_stores/03 |
| **ADR-04** | 수집 버퍼 Redis Streams — Kafka · RabbitMQ 보류 | 적재 · 백프레셔 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-05** | Redis 단일 인스턴스 · volatile-lru — TTL 유무로 축출 대상 구분 | 저장소 | 현행 | 선점 | 05_data_stores/05 · 06 |
| **ADR-06** | 모듈 경계는 Redis Stream — 같은 프로세스여도 예외 없음 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) |
| **ADR-07** | 실시간 팬아웃은 Redis Pub/Sub 경계 유지 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 06_pipeline/05 |
| **ADR-08** | 역할 스위치는 DI 포트 · 구현 둘 — 런타임 분기 금지 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 02_features/13 |
| **ADR-09** | 배치 적재 읽기 · 삽입 분리 — 단일 flusher fan-in(보정 7.1) | 적재 · 백프레셔 | 현행 | 선점 | 06_pipeline/03 · [05_latency_budget.md](./05_latency_budget.md) |
| **ADR-10** | 최신값 갱신 주체 — 잠정 Ingest + 교체 가능한 포트 · 최종은 S6 실측(보정 7.2) | 모듈 경계 · 구조 | **잠정** | 선점 | [06_backpressure_failure.md](./06_backpressure_failure.md) · 06_pipeline/05 |
| **ADR-11** | 알람 판정은 배치 단위 상태 조회 · Ingest 직접 호출은 유일한 경계 예외(보정 7.3) | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 06_pipeline/08 |
| **ADR-12** | 캐시 무효화 체인 6단 — BFF · 브라우저 포함(보정 7.4) | 정합성 강제 | 현행 | 선점 | 06_pipeline/07 |
| **ADR-13** | TTL 강제는 린트가 아니라 키 계열별 래퍼(보정 7.5) | 정합성 강제 | 현행 | 선점 | 05_data_stores/05 |
| **ADR-14** | 적재 멱등은 insert_deduplication_token — ReplacingMergeTree 미채택 | 적재 · 백프레셔 | 현행 | 선점 | 05_data_stores/03 · 05_data_stores/04 · 06_pipeline/03 |
| **ADR-15** | tag_raw 롱 포맷 · 일자 파티션 · 정렬 키(device_id · tag_id · ts) | 저장소 | 현행 | 선점 | 05_data_stores/03 |
| **ADR-16** | 마스터 연동은 ClickHouse Dictionary(PostgreSQL 소스) — 두 DB를 트랜잭션으로 묶지 않는다 | 저장소 | 현행 | 선점 | 05_data_stores/07 |
| **ADR-17** | PostgreSQL 대조군 동형 테이블 · SW-09 동시 적재 | 저장소 | 현행 | 선점 | 05_data_stores/10 · 06_pipeline/04 |
| **ADR-18** | named volume · 호스트 포트 127.0.0.1 바인드 | 실행 환경 · 관측 | 현행 | 선점 | [03_execution_topology.md](./03_execution_topology.md) · 12_security/05 |
| **ADR-19** | PostgreSQL 커넥션은 api in-process 풀 — PgBouncer 유예 | 저장소 | 현행 | 선점 | 05_data_stores/02 · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-20** | 관측 스택은 선택 프로파일 — 스크레이프 창구는 /metrics 하나 | 실행 환경 · 관측 | 현행 | 선점 | 10_observability/01 · 09_tech_stack/03 |
| **ADR-21** | 백프레셔 1차 신호는 애플리케이션의 적체 검사 — MAXLEN을 maxmemory보다 먼저 건다 | 적재 · 백프레셔 | 현행 | 선점 | [06_backpressure_failure.md](./06_backpressure_failure.md) · 05_data_stores/06 |
| **ADR-22** | APP_ROLE 역할 배정 — SIM · GEN 모드 A는 collector와 동거 · OBS는 전 역할 · 분리는 실측 뒤 | 모듈 경계 · 구조 | 현행 | **W3 신설** | [02_module_boundaries.md](./02_module_boundaries.md) · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-23** | 백프레셔 하강 히스테리시스 — 상승 즉시 · 하강 지연 · 위험은 주의 임계까지 스풀 유지 | 적재 · 백프레셔 | 현행 | **W3 신설** | [06_backpressure_failure.md](./06_backpressure_failure.md) · 11_glossary/03 |
| **ADR-24** | SW-10 off면 경고 단계 데드밴드 강화는 무동작 — 스위치가 백프레셔 반응보다 우선 | 적재 · 백프레셔 | 현행 | **W3 신설** | [06_backpressure_failure.md](./06_backpressure_failure.md) · 02_features/03 |
| **ADR-25** | CPU 바운드 작업은 piscina worker_threads로 격리 | 모듈 경계 · 구조 | 현행 | **W3 신설** | [02_module_boundaries.md](./02_module_boundaries.md) · [05_latency_budget.md](./05_latency_budget.md) |

### 검산

- 출처별: 선점 21(ADR-01~21) + W3 신설 4(ADR-22~25) = **25**
- 상태별: 현행 24 + 잠정 1(ADR-10) + 대체됨 0 = **25**
- 선점표 대비 제목 조정 1건 — ADR-21의 "XLEN 검사"를 "적체 검사"로 다듬었다. 주제(1차 신호는 애플리케이션 검사 · MAXLEN을 maxmemory보다 먼저)는 그대로이며, 판정량이 원시 XLEN이 아니라는 결정이 제목에 실린다. 나머지 20건은 선점 주제 그대로다.

## 분류

| 분류 | ADR | 수 | 이 분류가 강제하는 것 |
|------|------|------|------|
| 런타임 · 표면 | 01 · 02 | 2 | 무엇으로 실행하고 사용자가 어디로 들어오는가 |
| 저장소 | 03 · 05 · 15 · 16 · 17 · 19 | 6 | 어느 엔진 · 어떤 모양 · 어떤 설정으로 담는가 |
| 적재 · 백프레셔 | 04 · 09 · 14 · 21 · 23 · 24 | 6 | 수집에서 저장까지 무엇이 넘치지 않고 겹치지 않게 하는가 |
| 모듈 경계 · 구조 | 06 · 07 · 08 · 10 · 11 · 22 · 25 | 7 | 한 프로세스 안 모듈이 무엇으로 이어지고 어떻게 떼어지는가 |
| 정합성 강제 | 12 · 13 | 2 | 규칙이 코드 구조로 지켜지게 하는 수단 |
| 실행 환경 · 관측 | 18 · 20 | 2 | 로컬 한 대에서의 배치와 계측 창구 |

- 검산: 2 + 6 + 6 + 7 + 2 + 2 = **25** — 분류가 둘인 ADR 0

## 원본 보정 5건 대응

원본 implementation_plan.md §7의 보정 5건은 전부 ADR로 결정을 고정하고 각 정본에 반영한다(docs_plan 실행 계획 보정 #5).

| 보정 | 원본 문제 | ADR | 결정 요지 | 반영 정본 |
|------|------|------|------|------|
| 7.1 | 컨슈머 다중화와 배치 크기가 서로를 무효화 | ADR-09 | 단일 flusher fan-in · B · C는 S3 비교 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 7.2 | ClickHouse 중단 시 최신값 정지 | ADR-10 | 잠정 A + 교체 포트(SW-11) · S6 실측 | [06_backpressure_failure.md](./06_backpressure_failure.md) · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 7.3 | 알람 행당 상태 조회 · 근거 없는 경계 예외 | ADR-11 | 배치당 조회 · 예외 근거 명시 | [02_module_boundaries.md](./02_module_boundaries.md) · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| 7.4 | 무효화 체인에서 BFF · 브라우저 누락 | ADR-12 | 6단 체인 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 7.5 | TTL 린트 강제의 실행 수단 부재 | ADR-13 | 키 계열별 래퍼 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |

- 검산: 보정 = **5** · 대응 ADR 5 · 대응 없는 보정 0

## ADR-01 — 백엔드 NestJS 단일 런타임

- **맥락**: 백엔드는 성격이 다른 두 덩어리다 — 제어 평면(REST · WebSocket · 인증 · CRUD)은 타입 공유와 IO 동시성을, 데이터 평면(Modbus 폴링 · 배치 적재 · 데이터 생성)은 Modbus 라이브러리 성숙도 · 수치 벡터화 · 배열 직렬화를 요구한다. 로컬 Docker 메모리 예산은 8~12 GB이고 그 안에서 ClickHouse에 최대한을 주는 것이 목적이다(원본 tech_stack.md §3).
- **결정**: 백엔드 전체를 **NestJS 단일 애플리케이션**으로 두고 데이터 평면을 모듈로 흡수한다. 2축 구분은 런타임이 아니라 **모듈 경계**(Redis Stream)로 남는다. 프론트엔드 · API DTO · Stream 페이로드 스키마를 공유 패키지의 스키마 하나로 정의한다. 감수 비용(단일 스레드 CPU 한계 · Modbus 서버 시뮬레이터 직접 구현 · numpy 부재 · Arrow 직삽입 부재)은 워커 격리(ADR-25) · TypedArray · 배치 크기로 완화한다.
- **버린 대안**: ① **Python 데이터 평면 분리**(pymodbus · numpy · clickhouse-connect) — 런타임 컨테이너가 하나 늘어 그 몫만큼 ClickHouse 메모리가 줄고, 페이로드 계약이 두 언어에 두 벌 정의되어 한쪽 필드가 바뀔 때 다른 쪽 디코더가 적체 엔트리를 DLQ로 쏟는다. ② **데이터 평면을 처음부터 별도 컨테이너로** — 이벤트 루프 지연이 실측되기 전에 나눠 역할 분리의 효과를 잴 기준선이 사라진다. ③ **모듈 간 gRPC** — 한 프로세스 안에 직렬화 계층이 생겨 측정 대상 아닌 비용이 E2E에 섞인다.
- **파급**: 되돌리는 조건은 셋으로 닫혀 있다(생성기 3배 미달 · 시뮬레이터 기능 부족 · Arrow 직삽입 필요) — [08_scaling_roadmap.md](./08_scaling_roadmap.md) §로드맵 밖 조건부 분리 · 근거 [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md). 모듈 결합은 데이터 계약으로만 한다(REQ-GLB-21). 어느 경우에도 제어 평면은 NestJS에 남는다.

## ADR-02 — 프론트엔드 Next.js + Route Handler BFF · 고빈도는 api 직결

- **맥락**: 리프레시 토큰을 httpOnly 쿠키로 브라우저 JS에서 숨겨야 하고, 동시에 최신값 폴링 · 시계열 조회 · WebSocket은 초당 수 회 이상 호출된다(원본 tech_stack.md §4.1 · 원본 data_flow.md §7.2).
- **결정**: Next.js를 **호스트 프로세스**로 띄우고 Route Handler를 BFF로 쓴다 — 로그인 · 토큰 갱신 · 저빈도 업무 조회는 BFF 경유, **고빈도 실시간 데이터는 브라우저가 api에 직결**한다. 직결 경로는 CORS 허용 오리진 하나 · Bearer 액세스 토큰 · WebSocket Origin 검증으로 보호한다.
- **버린 대안**: ① **React + Vite SPA** — 서버 측 코드가 없어 리프레시 토큰을 받을 자리가 브라우저뿐이고, httpOnly 쿠키를 액세스 토큰으로 교환할 주체가 사라진다. ② **전 요청 BFF 경유** — 고빈도 요청마다 1홉과 Next.js 서버 이벤트 루프 하나를 더 다퉈 최신값 p95가 api가 아니라 BFF에 묶인다. ③ **WebSocket BFF 중계** — 장기 연결 수만큼 BFF에 소켓이 쌓여 개발 서버 재시작이 모든 실시간 연결을 끊는다. ④ **웹 컨테이너화** — HMR이 느리고 불안정해 개발 루프가 멈춘다.
- **파급**: 요청 종류별 BFF · 직결 배정의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md). BFF 서버 fetch 캐시가 무효화 체인에 들어간다(ADR-12). localhost:3001과 3000은 포트가 달라 CORS가 필요하지만 same-site라 SameSite=Lax가 동작한다 — [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md).

## ADR-03 — 시계열 엔진 ClickHouse

- **맥락**: PLC 태그 데이터는 초당 수천~수십만 포인트 · 추가 전용 · 시간 범위 집계다. 학습 목표 ①은 "시계열을 RDB가 아니라 컬럼형으로 다루는 이유를 측정으로 안다"다(D-01).
- **결정**: 시계열을 **ClickHouse**에 싣는다 — MergeTree · 코덱 · AggregatingMergeTree + MV 롤업 캐스케이드 · Dictionary를 쓴다. 앱은 HTTP 8123만 쓴다. 비교 상대는 PostgreSQL 대조군이다(ADR-17).
- **버린 대안**: ① **TimescaleDB** — PostgreSQL 확장이라 대조가 "PostgreSQL 대 PostgreSQL 확장"이 되어 행 기반 RDB가 어디서 꺾이는지라는 질문(D-05)이 사라지고, 이종 DB 분리 운용을 배울 자리가 없다. ② **InfluxDB** — SQL 전이성이 낮아 대조군과 **같은 쿼리 5종**을 두 저장소에 돌릴 수 없고, 쿼리 언어 차이가 역전 지점에 섞인다. ③ **PostgreSQL 단독** — 그것이 대조군 자체다. 원본 예상치(삽입 · 압축)로 이미 역전이 예상되는 쪽을 주 저장소로 두면 목표 ②의 파이프라인이 목표 ①의 실험 대상에 묶인다.
- **파급**: UPDATE가 비동기 mutation이라 상태 갱신이 필요한 데이터를 싣지 않는다 — 알람 확정 이벤트가 PostgreSQL로 가는 근거([04_storage_split.md](./04_storage_split.md)). 스키마 · 코덱 · 설정의 정본은 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md).

## ADR-04 — 수집 버퍼 Redis Streams

- **맥락**: 수집 속도와 적재 속도를 떼는 버퍼가 필요하고, 재시도 · 회수 · 컨슈머 다중화가 있어야 한다. Redis는 이미 캐시 · 팬아웃 역할로 들어와 있다(원본 tech_stack.md §5.3).
- **결정**: **Redis Streams + 컨슈머 그룹**을 수집 버퍼로 쓴다. 엔트리는 포인트가 아니라 **스캔 사이클 단위**(설비 × 사이클 1엔트리 · MessagePack 컬럼 배열)다. 적재 소스는 포트(PointSourcePort)로 추상화해 전환 경로를 열어 둔다.
- **버린 대안**: ① **Kafka** — 브로커 컨테이너(+ 메타데이터 관리)가 로컬 메모리 예산을 먹어 측정 대상인 ClickHouse 몫이 남지 않는다. ② **RabbitMQ** — 소비 후 삭제라 트림 범위 안의 재처리 창이 없고, 버퍼 · 캐시 · 팬아웃이 두 미들웨어로 갈라져 "Redis 중간 계층"이라는 학습 대상이 흐려진다. ③ **프로세스 안 큐** — 재시작 시 미처리분이 전부 사라진다 — 그것이 SW-01 off의 실험 경로이며 정상 경로가 아니다. ④ **포인트 단위 엔트리** — 엔트리마다 필드 이름을 반복 저장해 원본 산정 약 9배의 메모리를 먹고 10만 pps에서 수 분 만에 고갈된다.
- **파급**: 재처리는 트림 범위 안에서만 된다 — 확인된 엔트리가 MAXLEN까지 남는 이유이며, 그래서 백프레셔 판정량이 XLEN이 아니다(ADR-21). Kafka 전환은 확장 4단계다([08_scaling_roadmap.md](./08_scaling_roadmap.md)).

## ADR-05 — Redis 단일 인스턴스 · volatile-lru

- **맥락**: Redis가 성격이 반대인 두 데이터를 담는다 — 사라지면 복구가 불가능한 것(Stream · 최신값 · 알람 상태)과 사라져도 원천으로 우회되는 것(캐시 · 세션 · 락 · 레이트 리밋). 메모리 예산은 한정돼 있다(원본 architecture.md §8).
- **결정**: **단일 인스턴스 · maxmemory-policy volatile-lru · AOF on**. TTL이 없는 키는 축출 후보가 아니고 TTL이 있는 키만 LRU로 밀려난다 — **키 접두 하나가 생존 정책의 경계**다(봉인 계열 stream · rt · alarm은 TTL 금지 · 캐시 계열 cache · lock · rl · sess · auth는 TTL 필수). 캐시가 다 밀려나도 부족하면 쓰기가 OOM으로 실패하고 그것이 위험 단계로 간다.
- **버린 대안**: ① **두 인스턴스(stream noeviction · cache allkeys-lru)** — 컨테이너가 늘어 메모리 예산을 잠식하고, **스트림이 캐시를 밀어내는 축출 연쇄를 한 인스턴스 안에서 볼 기회가 사라진다** — 그것이 학습 정점이다. ② **allkeys-lru** — TTL 없는 Stream 엔트리 · 알람 상태가 조용히 축출된다. ③ **noeviction** — 캐시 키가 maxmemory를 채우면 XADD가 OOM으로 실패해 **캐시 팽창이 곧 수집 스풀로 번진다** — 캐시 때문에 수집이 멈춘다.
- **파급**: 인스턴스가 강제하던 구분을 코드가 지킨다 — 키 계열별 래퍼(ADR-13) · 실패 전략 이원화(REQ-GLB-09). 분리는 확장 3단계이며 진입 조건은 캐시 히트율과 Stream 점유 메모리의 역상관이다([08_scaling_roadmap.md](./08_scaling_roadmap.md)). 키 · 메모리의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md).

## ADR-06 — 모듈 경계는 Redis Stream

- **맥락**: 런타임이 하나로 합쳐지면서 Collector가 Ingest를 직접 부르면 코드 한 줄로 끝나게 됐다. "언어 간 결합도 0"이라는 옛 명분은 사라졌다(원본 architecture.md §9).
- **결정**: **수집과 적재 사이에는 반드시 Stream을 둔다 — 같은 프로세스 안이어도 예외가 아니다.** 근거는 넷 — ① 백프레셔 흡수 ② at-least-once 재시도 · DLQ ③ 이벤트 루프 격리 ④ 재처리 · 역할 분리 대비. Stream 경계를 건너는 경로는 SW-01 off(실험 전용)와 알람 판정 직접 호출(ADR-11) 둘뿐이다.
- **버린 대안**: ① **직접 호출** — ClickHouse 삽입 지연이 Modbus 폴링 주기로 역류하고, 실패 배치를 다시 읽을 지점이 없어 프로세스가 죽으면 재시도 상태가 함께 사라진다. ② **프로세스 안 이벤트 버스** — 결합은 풀지만 재시작 내구성이 없어 ②가 그대로 깨진다. ③ **역할 분리 때 경계를 도입** — 분리 순간 호출부를 전부 다시 써야 해 "코드 변경 없는 1단계"가 거짓이 되고, 분리 전후 비교에 코드 변경이 섞인다.
- **파급**: loopback 1홉이 대가이며 지연 예산 구간으로 잰다([05_latency_budget.md](./05_latency_budget.md)). 원칙을 증명하는 경로가 SW-01 off 실험이다(모드 A 전용). 원칙의 정본 서술은 [02_module_boundaries.md](./02_module_boundaries.md) · 계약은 REQ-GLB-03 · 04.

## ADR-07 — 실시간 팬아웃은 Redis Pub/Sub 경계 유지

- **맥락**: Ingest · Alarm의 발행자와 WebSocket 게이트웨이가 같은 프로세스에 있어 직접 호출이 더 빠르다(원본 architecture.md §8.2 · 원본 data_flow.md §9).
- **결정**: 실시간 값(ch:rt)과 알람 이벤트(ch:alarm)는 **Pub/Sub을 지난다.** 마스터 무효화 신호(ch:cacheinv)도 같은 채널 계층이다. Pub/Sub은 저장이 아니라 표시 전용이며 저장은 별도 경로(ClickHouse)가 맡는다.
- **버린 대안**: ① **게이트웨이 직접 호출** — api 다중 인스턴스(확장 2단계)에서 다른 인스턴스에 붙은 소켓이 값을 받지 못해 팬아웃 코드를 새로 써야 한다(SW-06 off의 측정 경로가 이것이다). ② **팬아웃도 Stream** — 전달 보장이 필요 없는 표시 데이터에 PEL · XACK · 인스턴스별 컨슈머 그룹을 얹어 메모리와 코드만 늘고, 재연결 공백은 REST 최신값 동기화로 이미 메워진다. ③ **Socket.IO 어댑터** — 고빈도 푸시에 프로토콜 오버헤드가 붙어 스로틀 효과 측정에 라이브러리 비용이 섞인다.
- **파급**: 대가는 loopback 1홉(원본 예상치 1 ms 미만)이다. 느린 구독자는 출력 버퍼 한도로 끊는다 — 한도 값의 소유는 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(W6)다. SW-06의 대상 채널은 ch:rt · ch:alarm뿐이다([02_module_boundaries.md](./02_module_boundaries.md)).

## ADR-08 — 역할 스위치는 DI 포트 · 구현 둘

- **맥락**: 학습 목표를 "구현"이 아니라 "이해"로 삼아 같은 코드에서 Redis 각 역할을 켜고 꺼 기여분을 분리한다(D-06). 스위치가 여럿이라 조합이 생긴다.
- **결정**: 스위치는 **포트 인터페이스 하나에 구현 둘**을 두고 **모듈 초기화 때 환경변수로 고른다.** 경로 안 분기를 두지 않는다. 전환은 환경변수 변경과 재기동뿐이며 화면은 상태를 표시할 뿐이다. 포트 · 구현 이름의 정본은 [02_module_boundaries.md](./02_module_boundaries.md) §포트 · 구현 이름 확정 표(스위치마다 포트 하나 · 구현 둘 — 수는 그 표가 센다).
- **버린 대안**: ① **조회 경로 안 if** — 분기 자체가 측정 대상 코드에 섞여 on/off 비교가 분기 비용까지 재고, 스위치가 늘수록 경로가 조합 폭발한다. ② **런타임 토글(기능 플래그)** — 측정 도중 스위치가 바뀌어 한 실험이 두 조건을 섞고, 토글 가능하게 만들려면 결국 ①로 돌아간다. ③ **빌드 인자로 이미지를 갈라 만들기** — 같은 커밋에서 이미지가 둘이 되어 측정 기록의 커밋 해시가 조건을 식별하지 못한다.
- **파급**: 스위치 상태는 주입된 구현을 기준으로 노출한다(REQ-OBS-11). ADR-10의 갱신 주체 교체 포트도 같은 모양이라 SW-11로 채번했다. SW-02 포트를 LatestValueReadPort로 개명한 이유가 ADR-10의 쓰기 포트와의 충돌이다.

## ADR-09 — 배치 적재 읽기 · 삽입 분리(보정 7.1)

- **맥락**: 원본은 배치 50,000행 · 1초 · 32 MB 셋 중 먼저 도달한 조건에서 플러시하고 컨슈머 3개가 각자 플러시한다. M 티어(10,000 pps)에서 50,000행은 5초가 걸려 **시간 트리거가 항상 먼저** 걸리고, 컨슈머 3개가 각자 초당 1회 플러시해 파트 생성률이 3배가 된다 — 다중화와 배치 정책이 서로를 무효화한다(원본 implementation_plan.md §7.1).
- **결정**: **A안 — 컨슈머 N개는 XREADGROUP과 디코딩만, 디코딩된 행은 단일 flusher로 fan-in해 삽입은 한 곳에서 한다.** XACK은 flusher가 삽입 성공 후 엔트리 ID를 되돌려 수행한다. 배치 토큰도 flusher가 만든다. S3에서 B · C와 파트 생성률 · E2E를 비교하고, 결과가 뒤집으면 이 ADR에 상태 항목을 단다.
- **버린 대안**: ① **현행(컨슈머별 독립 플러시)** — 파트 생성률이 컨슈머 수에 비례해 ClickHouse 권장 상한(테이블당 초당 1회)의 3배가 되고, 백프레셔 주의 단계의 컨슈머 증설이 적체를 줄이는 대신 파트를 늘린다. ② **B안(컨슈머 1 + 시간 트리거 확대)** — 가장 단순하지만 디코딩이 한 루프에 묶이고 Stream 대기가 트리거 확대만큼 늘어 E2E 예산의 지배 구간이 커진다 — S3 비교 대상으로 남는다. ③ **C안(async_insert)** — 서버가 블록을 합치지만 삽입 응답과 디스크 기록 사이가 벌어진다. 대기 없이 쓰면 응답 뒤 XACK한 엔트리가 서버 버퍼 유실로 사라지고, 대기를 켜면 지연이 서버 합치기 주기에 묶인다 — S3 비교 대상으로 남는다.
- **파급**: 삽입 횟수가 컨슈머 수와 무관해진다 — 시간 트리거와 행 트리거 R 중 먼저 걸리는 쪽이 정한다. 현행 R 50,000 기준 M 초당 1회 · 배치 10,000행(시간 트리거) · M+ 초당 2회 · 배치 50,000행 · L 초당 10회(행 트리거) — W4 산술 보정([07_capacity_planning.md](./07_capacity_planning.md) · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) §배치 트리거 산술 보정). Stream 대기가 체류 · 디코딩 · fan-in 대기 셋으로 쪼개진다([05_latency_budget.md](./05_latency_budget.md)). 주의 단계 컨슈머 증설은 삽입 병목에 효과가 없다([06_backpressure_failure.md](./06_backpressure_failure.md)). 기전 정본 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md).

## ADR-10 — 최신값 갱신 주체(보정 7.2)

- **상태**: **잠정(2026-09-24)** — S3 전에 A를 잠정안으로 고정하고 S6 실측으로 최종 결정한다. 최종 결정이 B이면 새 ADR을 말미에 채번하고 이 번호에 "대체됨"을 단다. 대체되어도 **교체 가능한 포트 구조와 "진실은 ClickHouse" 정책은 살아남는다.**
- **맥락**: 최신값 갱신 주체가 Ingest이고 갱신 시점이 ClickHouse 삽입 성공 + XACK 뒤라, ClickHouse가 5분 멈추면 rt 계열 최신값도 5분 멈추고 실시간 대시보드가 멈춘다. 원본 장애 시나리오 표에 이 사실이 없었다(원본 implementation_plan.md §7.2).
- **결정**: **A(Ingest가 삽입 확정 뒤 갱신)를 잠정 채택**하고 쓰기 쪽에 **LatestValueWritePort**(IngestLatestValueWriter · CollectorLatestValueWriter)를 둔다. **구현 선택은 SW-11 LATEST_VALUE_WRITER(기본 ingest)로 노출해 S6 비교를 스위치 상태로 기록한다.** 잠정 기간에도 STALE 표시를 끄지 않고 장애 시나리오 표에 최신값 정지를 명시한다. S6에서 두 구현으로 ClickHouse 중단을 재현해 갱신 공백 · argMax 불일치 건수 · 복구 수렴 시간을 잰다.
- **버린 대안**: ① **B를 지금 확정(Collector가 XADD 파이프라인에 HSET 동봉)** — 기동 복원(argMax 재구성)의 소유자가 정해지지 않았고, 엔트리가 끝내 DLQ로 격리되면 **ClickHouse에 없는 값이 최신값으로 남는다** — "진실은 ClickHouse"와의 관계가 실측 전에 판정되지 않는다. ② **포트 없이 A 고정** — S6 비교를 위해 갱신 코드를 두 번 써야 하고, 비교 전후 코드가 달라 측정에 "코드가 달라져서"가 붙는다. ③ **결정 보류** — S3 진입 조건(보정 7.2 방침이 ADR로 정해짐)이 충족되지 않아 Ingest 심화가 두 방향으로 갈린다.
- **파급**: 구현 선택이 SW-11로 채번되어 S6 비교가 측정 기록 4요소의 스위치 상태로 남는다 — 채번 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · 포트 확정 표 [02_module_boundaries.md](./02_module_boundaries.md). 최종 결정이 나면 SW-11의 기본값 또는 존속을 같은 변경 단위에서 판정한다. 복구 중 옛 스풀 값이 최신값을 덮어쓰는 순서 역전은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4)가 판정한다. 정책 서술 [06_backpressure_failure.md](./06_backpressure_failure.md) §ClickHouse 중단 시 최신값 정지.

## ADR-11 — 알람 판정 배치 단위 조회 · 직접 호출 예외(보정 7.3)

- **맥락**: 원본 알람 시퀀스는 **행마다** alarm:state를 조회한다 — 배치당 수만 행에 행당 Redis 왕복 1회는 곧바로 수집 처리량 상한이다. 판정은 Ingest가 Alarm을 같은 프로세스 안에서 직접 부르는데, 이는 Stream 경계 원칙의 유일한 예외이면서 근거가 적혀 있지 않았다(원본 implementation_plan.md §7.3).
- **결정**: ① 판정은 **배치 단위**다 — 배치에 걸린 rule_id만 모아 상태를 **파이프라인 1회**로 읽는다(판정 전체를 스크립트 1회로 하는 것은 같은 결정의 구현 변형이며 기전 정본이 고른다). 핫 상태는 Redis Hash에 둔다. ② 직접 호출을 **의도된 유일한 예외**로 명시한다 — 판정은 삽입이 확정된 배치의 후처리이고 재처리 단위가 배치와 같아 별도 큐가 필요 없다. ③ 지연 예산에 알람 판정 구간을 신설한다(미확인).
- **버린 대안**: ① **행당 상태 조회(원본)** — 판정 처리량이 Redis 왕복 × 행 수에 묶여 M 티어 이상에서 판정이 수집을 따라가지 못한다. ② **프로세스 메모리 상태 + 비동기 write-back** — 왕복은 없지만 역할 분리 뒤 두 워커가 같은 규칙을 평가하면 서로의 상태를 모른 채 같은 알람을 두 번 확정한다. ③ **알람 전용 Stream** — 판정 재처리 단위가 배치와 어긋나 원시값은 적재됐는데 판정만 DLQ로 가는 창이 생기고, 컨슈머 그룹이 하나 더 늘어 메모리 예산을 먹는다. ④ **근거 없이 예외 유지** — "같은 프로세스 안이어도 예외가 아니다"가 사례별 판단으로 퇴화해 다음 예외를 막을 근거가 없다.
- **파급**: 판정은 ingest와 함께 worker 역할에 배정된다(ADR-22). 판정 구간이 플러시 주기를 넘으면 적체가 판정 쪽에 쌓인다는 구조 관계를 예산이 갖는다([05_latency_budget.md](./05_latency_budget.md)). 예외 근거 정본 [02_module_boundaries.md](./02_module_boundaries.md) · 기전 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · 계약 REQ-GLB-04.

## ADR-12 — 캐시 무효화 체인 6단(보정 7.4)

- **맥락**: 원본 무효화 순서는 커밋 → Redis 삭제 → Pub/Sub → Dictionary 재적재의 4단인데 캐시는 Redis · Dictionary · Next.js 서버 fetch · 브라우저 쿼리 캐시로 더 많다. 원본 검증 항목 "마스터 수정 후 즉시 반영"은 원본 설계대로면 반드시 실패한다(원본 implementation_plan.md §7.4).
- **결정**: 체인을 **6단**으로 둔다 — ① 트랜잭션 커밋 ② Redis 캐시 삭제 ③ ch:cacheinv 발행 ④ Dictionary 즉시 재적재 ⑤ BFF 서버 fetch 캐시 태그 무효화 ⑥ WebSocket 무효화 신호로 브라우저 쿼리 캐시 무효화. ②~⑥은 **커밋 뒤에만** 걸고, 캐시는 새 값으로 덮어쓰지 않고 **삭제**한다.
- **버린 대안**: ① **원본 4단** — BFF 캐시 수명(현행 참고 30초)과 브라우저 staleTime만큼 옛 값이 보여 인수 기준 AC-06이 실패한다. ② **TTL 만료에만 의존** — 태그명 변경이 최대 캐시 수명만큼 늦게 보이고, Dictionary는 재적재 주기(현행 참고 최대 10분)만큼 옛 이름을 붙인다. ③ **캐시 갱신(write-through)** — 동시 갱신 순서가 뒤집히면 낡은 값이 최종으로 남는다. ④ **커밋 전 삭제** — 사이에 끼어든 조회가 옛 값으로 캐시를 다시 채워 커밋 뒤에도 영구히 낡은 값이 남는다.
- **파급**: 기전 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · 계약 REQ-MST-09 · 판정 AC-06. ch:cacheinv는 SW-06의 대상이 아니다 — 스위치 상태에 따라 정합성 계약이 달라지지 않게 한다.

## ADR-13 — TTL 강제는 키 계열별 래퍼(보정 7.5)

- **맥락**: 원본은 키 계열별 TTL 규칙을 "린트 규칙으로 강제한다"고 두 번 적었지만 린터로는 "cache 접두 키에 SET할 때 TTL 인자가 있는가"를 검사할 수 없다. 단일 인스턴스에서는 키 접두 하나가 생존 정책의 경계다(원본 implementation_plan.md §7.5).
- **결정**: 강제 수단은 **타입과 래퍼 3종**이다 — **CacheKeyClient**(cache · sess · lock · rl · auth)는 모든 쓰기가 TTL을 필수 인자로 받고 짧은 타임아웃 후 예외를 삼킨다. TTL 지터는 **cache 접두의 단건 키에만** 적용한다(동시 만료 스탬피드가 생기는 자리가 거기뿐이다). **DurableKeyClient**(stream · rt · alarm)는 TTL 계열 명령을 **노출하지 않고** 실패를 그대로 던진다. **FanoutPublisher**(ch 채널)는 발행만 노출한다. 래퍼 경계 · 지터 범위 판정의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다.
- **버린 대안**: ① **린트 규칙** — 키 문자열과 명령 인자의 관계를 정적 규칙으로 잡을 수 없어 규칙이 문장으로만 남고 반드시 새어 나간다. ② **코드 리뷰 관례** — 봉인 키에 TTL 하나가 붙는 순간 그 키가 축출 후보가 되는데, 메모리 압박이 오기 전까지 아무 증상이 없어 리뷰로 발견되지 않는다. ③ **사후 감시(키 이벤트 알림)** — 위반을 알아챌 때는 이미 Stream 엔트리나 알람 상태가 사라진 뒤다.
- **파급**: "같은 Redis 안에서 키 계열에 따라 실패 전략이 정반대"가 코드 구조로 표현된다(REQ-GLB-08 · 09). 래퍼를 우회한 원시 호출 · redis-cli 수동 조작은 막지 못한다 — 잔여는 봉인 표와 한계 등재가 받는다. 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md).

## ADR-14 — 적재 멱등은 insert_deduplication_token

- **상태**: 현행 — **S0 실측으로 보강(2026-09-24 · EXP-32 · 기록 001 · 사용자 결정).** 결정 원문(결정적 토큰 + tag_raw 윈도우)은 그대로 산다. ClickHouse 25.8은 원시가 토큰으로 중복 제거돼도 종속 MV를 다시 돌려, 원문만으로는 응답이 유실된 성공 배치의 재시도가 롤업 3테이블을 두 배로 센다(3회 모두). 그래서 **롤업 3테이블에도 같은 윈도우를 두고 삽입 설정 deduplicate_blocks_in_dependent_materialized_views를 켜는 한 쌍**을 결정에 더한다 — 둘 중 하나만 둔 두 조건(설정만 · 윈도우만)도 이중 계수가 3회 모두 남았다(실측). **잔여** — 재계산 · 백필처럼 비운 롤업에 같은 내용을 다시 넣는 삽입은 윈도우에 걸려 오류 없이 버려지므로 insert_deduplicate 0으로 한다(실측) · MV 실행 순서가 뒤바뀐 부분 실패는 보강 아래에서 미측정이다. 정본 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §서버 설정 계약 · [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md).
- **맥락**: at-least-once라 컨슈머가 삽입 직후 · XACK 직전에 죽으면 같은 배치를 다시 읽는다(원본 architecture.md §7.1 · 원본 data_flow.md §4.3).
- **결정**: 배치마다 **내용에 결정적인 토큰**(첫 엔트리 ID + 끝 엔트리 ID + 행 수의 해시)을 insert_deduplication_token으로 싣고, tag_raw에 비복제 중복 제거 윈도우를 둔다. 재시도는 첫 시도와 같은 토큰을 쓰고 백오프 합계는 윈도우 안에 머문다. SW-08 off가 토큰을 빼는 실험 경로다.
- **버린 대안**: ① **ReplacingMergeTree** — 중복이 머지 시점에야 사라져 머지 전 조회가 중복을 보고, 정확한 결과에 FINAL을 붙이면 조회마다 비용이 붙는다 — 롤업 MV는 삽입 블록을 보므로 중복이 롤업에 그대로 들어간다. ② **무작위 UUID 토큰** — 재시작 뒤 같은 배치가 다른 토큰을 받아 중복 행이 생긴다. ③ **토큰 없음** — 재시도 중복이 avg · count 롤업을 조용히 부풀려 역전 지점과 압축률 측정까지 오염된다.
- **파급**: 토큰 재료가 엔트리 ID 범위라 SW-01 off(엔트리 ID 없음)에서는 멱등을 재지 않는다. ADR-09로 토큰은 fan-in 배치에서 flusher가 만든다 — fan-in 배치의 토큰 재료는 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4). 대조군 쪽 멱등 수단은 이 결정의 범위 밖이다(ADR-17).

## ADR-15 — tag_raw 롱 포맷 · 일자 파티션 · 정렬 키

- **맥락**: 설비마다 태그 구성이 다르고 태그 추가가 잦다. 실제 조회는 "특정 설비의 특정 태그를 시간 범위로"다. 보존은 파티션 단위로 끊는다(원본 architecture.md §7.1).
- **결정**: tag_raw는 **태그당 1행 롱 포맷**, **일자 파티션**(ts 기준), **정렬 키 (device_id · tag_id · ts)**, 시각은 Delta + ZSTD · 값은 Gorilla + ZSTD 코덱이다. 보존은 파티션 DROP으로 끊는다.
- **버린 대안**: ① **와이드 포맷(설비당 태그 컬럼)** — 태그 추가가 스키마 변경이 되고 설비마다 컬럼 집합이 달라 테이블이 설비 수만큼 갈라진다. ② **월 파티션** — 파티션이 커져 7일 보존을 파티션 DROP으로 끊을 수 없고 행 단위 DELETE(비동기 mutation)로 떨어진다. ③ **시간 파티션** — 파티션 수가 폭증해 파트 수 한도에 먼저 닿는다. ④ **ts 선두 정렬 키** — 한 태그의 시간 범위 조회가 전 태그를 스캔하고, 같은 태그 값이 인접하지 않아 Gorilla · Delta 압축이 무너진다.
- **파급**: 정렬 키 선두의 저카디널리티 컬럼이 압축률 · 스킵 효율의 전제다 — 대조군 plc_tag_raw_control이 같은 모양을 따라야 비교가 성립한다(ADR-17). 스키마 정본 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · 보존 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md).

## ADR-16 — 마스터 연동은 Dictionary · 두 DB를 묶지 않는다

- **맥락**: 시계열 조회 결과에 태그명 · 단위를 붙여야 하는데 태그 마스터는 PostgreSQL이 소유한다(원본 architecture.md §7.4 · §12).
- **결정**: ClickHouse **Dictionary(PostgreSQL 소스 · 전용 읽기 계정 · 메모리 상주 레이아웃)**로 조회 시점에 메타를 붙인다. 태그 마스터 커밋 뒤에 즉시 재적재를 호출한다(ADR-12 ④). **두 DB를 트랜잭션으로 묶지 않는다** — 시계열은 불변 사실로 두고 tag_id는 영구 보존 · 재사용 금지 · 스케일 변경은 새 tag_id 발급이다.
- **버린 대안**: ① **태그명을 tag_raw에 저장** — 행마다 문자열이 붙어 저장량이 늘고, 태그명 변경이 과거 행 수정(비동기 mutation)이 된다. ② **API가 조회 뒤 PostgreSQL과 조인** — 조회마다 PostgreSQL 왕복이 붙고, ClickHouse가 직접 직렬화해 흘려보내는 내보내기 스트림에는 끼어들 자리가 없다. ③ **두 DB 분산 트랜잭션** — PostgreSQL 장애가 시계열 적재를 막고, ClickHouse에 롤백 의미론이 없어 반쯤 반영된 상태가 남는다.
- **파급**: PostgreSQL이 멈춰도 시계열 조회는 Dictionary의 마지막 값으로 계속된다. 비활성 태그를 소스에서 거르면 과거 행의 태그명이 사라지는 문제는 [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md)가 판정했다 — dict_tag는 비활성 태그도 싣고 is_active를 속성으로 둔다(W3). 계약 REQ-GLB-14.

## ADR-17 — PostgreSQL 대조군 동형 테이블 · SW-09 동시 적재

- **맥락**: 학습 목표 ①을 측정으로 알려면 같은 데이터 · 같은 쿼리를 행 기반 RDB와 컬럼형에 동시에 돌려야 한다(D-05 · D-12).
- **결정**: PostgreSQL에 tag_raw와 **동형인 plc_tag_raw_control**(일자 파티션 · BRIN)을 두고, SW-09 on에서 Ingest가 **같은 배치를 양쪽에 삽입**한다. 기본 off다. 대조군 삽입 실패는 XACK를 막지 않고 실패 구간을 대조 실험에서 무효로 표시한다.
- **버린 대안**: ① **대조군 전용 생성기로 PostgreSQL에만 주입** — 두 저장소의 행 집합이 달라 같은 쿼리의 결과를 대조할 수 없다. ② **대조군 전용 컨슈머 그룹** — 두 그룹이 다른 속도로 소비해 측정 시점마다 두 저장소의 행 수가 어긋나고, 그룹 하나가 늘어 Stream 메모리 · 적체 판정이 흔들린다. ③ **ClickHouse → PostgreSQL 복제** — 복제 지연이 행 수 일치를 깨고, 복제 부하가 ClickHouse 쪽 측정에 섞인다. ④ **대조군 실패 시 XACK 보류** — 계측물의 실패가 분기 목적지(ClickHouse)의 경로를 멈춘다.
- **파급**: 대조군은 중복 저장이 아니라 계측물이다([04_storage_split.md](./04_storage_split.md)). 대조 실험은 두 저장소 행 수 정확 일치 구간에서만 한다. **삽입 의미론(05_data_stores/10 판정)** — ClickHouse 삽입 성공 뒤 배치당 COPY 1회(트랜잭션 1) · 실패해도 재시도하지 않는다 · XACK 전 크래시의 재전달 중복은 구간 count 대조로 검출한다 · 실패 · 중복 구간은 대조 무효로 표시한다(REQ-ING-15). 적재는 업무 풀과 분리된 전용 커넥션 1개로 한다(ADR-19). 대조 실험의 자원 동일화 조건은 [03_execution_topology.md](./03_execution_topology.md) §대조 실험 자원 조건. 설계 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md).

## ADR-18 — named volume · 127.0.0.1 바인드

- **맥락**: 로컬에서 psql · clickhouse-client · redis-cli로 저장소를 직접 만지는 것이 학습에 필요하고, Docker Desktop의 호스트 디렉터리 마운트는 파일 공유 계층을 거친다(원본 architecture.md §3 · 원본 tech_stack.md §10.3 · §10.4).
- **결정**: 볼륨은 **named volume 4개**(pgdata · chdata · redisdata · spooldata)이고 호스트 디렉터리를 마운트하지 않는다. 호스트 publish는 **전부 127.0.0.1에 바인드**하고 PlcSim 포트는 publish하지 않는다.
- **버린 대안**: ① **bind mount** — DB 랜덤 I/O가 파일 공유 계층을 지나 느려져 디스크 계층 수치가 측정 대상이 아닌 계층을 잰다. ② **0.0.0.0 바인드** — 같은 네트워크의 기기에 DB 포트가 그대로 열린다. 세 저장소 모두 비밀번호를 요구하지만([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)) 방어가 비밀번호 한 겹만 남아 LAN의 어느 기기든 대입 · 인증 우회 결함의 표적이 된다. ③ **저장소 포트 비공개(컨테이너 안 CLI만)** — 학습 도구(DBeaver 등)를 붙일 수 없고, 매 확인이 컨테이너 진입이 되어 관찰 비용이 커진다.
- **파급**: 호스트에서 스풀 파일을 직접 볼 수 없어 컨테이너 안에서 확인한다. 127.0.0.1 바인드는 LAN 노출만 막고 같은 머신의 다른 프로세스는 막지 않는다 — 잔여 [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md). 정본 [03_execution_topology.md](./03_execution_topology.md).

## ADR-19 — PostgreSQL 커넥션은 api in-process 풀

- **맥락**: PostgreSQL에 붙는 주체는 api 프로세스 하나 · Dictionary 소스 · 사람의 CLI뿐이다(원본 architecture.md §6 · 원본 tech_stack.md §5.1).
- **결정**: api 프로세스의 **in-process 풀**로 커넥션을 관리하고 별도 풀러를 두지 않는다. 풀 크기 · max_connections는 2계층 조정값이다(현행 참고 풀 20 · 100 · 소유 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)). **PgBouncer는 api 다중 인스턴스(확장 2단계)에서 도입한다.** 대조군 적재(SW-09)는 업무 풀과 분리된 **전용 커넥션 1개**를 쓴다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 판정) — 대량 COPY가 업무 풀 커넥션을 붙잡아 CRUD 지연에 섞이지 않게 한다.
- **버린 대안**: ① **지금 PgBouncer 도입** — 컨테이너 하나가 메모리를 먹고, 트랜잭션 풀링 모드에서는 세션 상태 · prepared statement 제약을 얻는데 막을 커넥션 폭발 조건이 없다. ② **모듈마다 풀** — 한 프로세스 안에 풀이 여럿 생겨 커넥션 상한을 모듈 수만큼 나눠 설정해야 하고, 한 모듈의 풀 고갈이 다른 모듈에 보이지 않는다.
- **파급**: 웹은 DB에 직접 붙지 않는다(경계 금지 — [01_system_architecture.md](./01_system_architecture.md)). 확장 2단계 진입 시 커넥션 주체가 여럿이 되는 순간 이 결정을 재판정한다([08_scaling_roadmap.md](./08_scaling_roadmap.md)).

## ADR-20 — 관측 스택은 선택 프로파일 · 창구는 /metrics 하나

- **맥락**: 측정 대상과 측정 도구가 같은 머신의 CPU를 나눠 쓴다. 저장소마다 exporter 컨테이너를 두면 메모리 예산을 먹는다(원본 architecture.md §14 · 원본 tech_stack.md §9).
- **결정**: 관측 스택은 **observability 프로파일**로만 띄운다. 앱 · 파이프라인 · 세 저장소 메트릭을 OBS 모듈이 모아 **/metrics 하나**로 노출한다(프로세스당 창구 하나 — 역할 분리 뒤에는 역할마다 하나, ADR-22). 정밀 측정 세션은 프로파일을 끄고 /metrics를 직접 덤프한다.
- **버린 대안**: ① **저장소별 exporter 컨테이너** — 컨테이너가 셋 늘어 ClickHouse 몫이 줄고, 창구가 넷이 되어 한 실험의 수치를 한 시점으로 모을 수 없다. ② **관측 스택 상시 기동** — 프로파일이 측정 대상과 CPU를 다퉈 정밀 측정 수치의 절대값이 흔들린다. ③ **ClickHouse 내장 메트릭 엔드포인트 직접 스크레이프** — 가능하지만 창구가 둘이 되어 대시보드가 두 출처를 합쳐야 한다.
- **파급**: 프로파일을 켠 탐색 수치는 상대 비교용이다. 프로파일 구성원(보정 #17)은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 판정했다 — prometheus · grafana 2(W6) · 메트릭 전수 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md).

## ADR-21 — 백프레셔 1차 신호는 애플리케이션의 적체 검사

- **맥락**: 버퍼가 차면 조용히 버리지 말고 실패시켜야 한다. Redis에는 두 한계가 있다 — MAXLEN 트리밍(오류 없이 오래된 엔트리를 버린다)과 maxmemory(캐시를 축출하고 결국 OOM). 원본은 1차 신호를 "Collector의 XLEN 검사"로 적었다(원본 architecture.md §9.3 · 원본 data_flow.md §12.1).
- **결정**: ① **1차 신호는 발행자(Collector · 모드 B · 모드 C)가 발행 전에 하는 적체 검사**다. ② **판정량은 원시 XLEN이 아니라 컨슈머 그룹의 미확인 적체(그룹 lag + pending)**다 — 확인된 엔트리는 MAXLEN까지 남아 XLEN은 정상 운전에서도 상한으로 차오른다. ③ 걸리는 순서는 **위험 임계 < MAXLEN < maxmemory**다 — MAXLEN × 엔트리 크기 + 캐시 예산이 maxmemory 안에 들게 산정해 Stream이 세션 · 토큰을 밀어내지 않게 한다. ④ MAXLEN 트리밍은 검사를 우회한 발행자를 막는 최후 안전장치이며 미소비분이 잘리면 결함으로 계측한다.
- **버린 대안**: ① **XLEN으로 단계 판정(원본 문구)** — 정상 운전에서 발행 누적이 MAXLEN × 90%에 닿는 순간(M 티어 원본 산정 약 한 시간) 적체 없이 위험 단계에 들어가 스풀로 전환하고, 이후 모든 수집이 스풀을 거친다. ② **Redis OOM을 1차 신호로** — Stream이 캐시 · 세션 예산을 다 먹은 뒤에야 신호가 와서 그 전에 사용자가 로그아웃된다. ③ **MAXLEN 트리밍에 맡김** — 오류 없이 미소비 엔트리가 잘려 유실을 인지하지 못한 채 틀린 처리량 수치를 얻는다. ④ **발행자 일부만 검사** — 검사하지 않는 발행자가 곧 우회 발행자가 되어 트리밍이 그 몫을 조용히 자른다.
- **파급**: 임계는 MAXLEN 비율로 정의한다([06_backpressure_failure.md](./06_backpressure_failure.md) §프로파일별 임계). Stream 점유 메모리가 적체가 아니라 충전량을 따르므로 **축출 연쇄 실험과 확장 3단계 진입 조건의 해석이 바뀐다** — [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) 반영 대상. 컨슈머 랙 산출식의 정본 판정은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)이며 W6이 이 결정의 판정량과 같은 양(그룹 lag + pending)으로 닫았다. Kafka 전환(확장 4단계) 때 재판정한다.

## ADR-22 — APP_ROLE 역할 배정

- **맥락**: APP_ROLE 5값(all · api · worker · collector · datagen)으로 역할을 나누는 것이 확장 1단계인데, 원본은 SIM · OBS의 역할을 정하지 않았다. PlcSim은 컨테이너 루프백에만 바인드하고 모드 A의 레지스터 갱신은 프로세스 안 호출이다(원본 architecture.md §3 · §4 · 웨이브 인계 W3 행).
- **결정**: ① **SIM과 GEN 모드 A는 collector 역할**과 한 프로세스에 둔다. ② GEN 모드 B · D · 실측은 datagen, 모드 C 수신 표면은 api, ALM은 표면 api · 판정 worker로 **기능 단위 배정**한다. ③ **OBS는 전 역할에서 기동**해 역할마다 자기 /metrics · health를 내고, 저장소 통계 수집은 api 역할 한 곳에서만 한다. ④ **기동 기본은 all이며 분리는 실측 진입 조건으로만 한다.**
- **버린 대안**: ① **SIM을 datagen에** — collector 컨테이너 루프백에 PlcSim이 없어 모드 A 폴링이 전부 연결 거부된다. ② **SIM 전용 역할** — 루프백 제약을 풀려고 포트를 브리지에 열면 "publish하지 않는다"가 컨테이너 간 노출로 바뀐다. ③ **GEN 전체를 datagen에** — 모드 A만 끊기고 B · C · D는 동작해 결함이 늦게 드러난다. ④ **OBS를 api에만** — 분리 직후 worker · collector의 컨슈머 랙 · 폴링 지연 카운터가 창구를 잃어 파이프라인이 계측 공백이 된다. ⑤ **저장소 통계를 역할마다 수집** — 같은 통계를 세 번 조회해 저장소 쿼리 로그에 관측 쿼리가 세 배로 섞인다.
- **파급**: 역할 분리 커밋의 코드 diff가 0이어야 한다는 검증이 이 배정 위에 선다([08_scaling_roadmap.md](./08_scaling_roadmap.md)). PlcSim을 별도 프로세스로 떼는 조건부 분리 때 모드 A SIMULATED 판정을 재판정한다. 배정표 정본 [02_module_boundaries.md](./02_module_boundaries.md) · 도메인 지도 APP_ROLE 열이 이 결정을 인용한다.

## ADR-23 — 백프레셔 하강 히스테리시스

- **맥락**: 원본은 상승 조건과 위험 → 복구 조건만 적었다. 하강을 적체 대역 그대로 따르면 임계 근처에서 단계가 진동한다(웨이브 인계 W3 행 · 11_glossary/03 미확인).
- **결정**: ① **상승은 매 검사에서 즉시** — XADD 실패 · 위험 임계 초과는 어느 단계에서든 위험. ② **주의 · 경고의 하강은 "현재 단계 진입 임계 − 폭" 미만이 유지 시간 동안 연속될 때 한 단계씩.** ③ **위험은 적체가 주의 임계 밑으로 내려갈 때까지 스풀을 유지**하고 그때 복구로 간다. ④ **복구 중 적체가 주의 임계 이상이면 재발행만 멈추고 복구를 유지**하며, 새 수집분은 Stream에 직접 발행한다. 폭 · 유지 시간은 MAXLEN 비율의 2계층 조정값이며 원본 값이 없어 S6에서 정한다.
- **버린 대안**: ① **대칭 대역(히스테리시스 없음)** — 임계 근처에서 컨슈머 증설 · 데드밴드 강화가 켜졌다 꺼져 행 수가 요동하고, 위험 임계 근처에서 스풀과 Stream이 번갈아 엔트리를 받아 재발행 순서가 뒤섞인다. ② **시간 쿨다운만** — 적체가 0이 돼도 쿨다운 동안 위험 반응이 남아 스풀이 불필요하게 커지고, 쿨다운 직후 재진입하면 진동이 그대로다. ③ **복구 중 새 수집분도 스풀로** — 수집 속도 ≥ 재발행 속도인 동안 스풀이 영영 비지 않아 복구가 끝나지 않는다. ④ **복구 중 재진입을 주의 단계로** — 재발행이 만든 적체가 외부 적체로 계측되어 주의 단계 반응이 재발행과 겹친다.
- **파급**: 복구 중 새 값과 옛 스풀 값이 섞여 적재되는 것은 순서 무관성이 허용하지만 rt 계열 최신값 덮어쓰기 순서 역전은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)가 판정했다 — rt:latest 조건부 쓰기(새 ts ≥ 저장 ts · W4). 상태 머신 3의 하강 전이 잠정 표기를 이 결정으로 확정했다 — [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 반영 완료. 정본 [06_backpressure_failure.md](./06_backpressure_failure.md).

## ADR-24 — SW-10 off면 경고 단계 강화는 무동작

- **맥락**: 경고 단계의 반응은 "Collector가 데드밴드를 임시 강화해 발행량 감축"인데, 데드밴드 스위치 SW-10의 기본은 off(데드밴드 0)다. 데드밴드가 꺼진 상태에서 "강화"의 뜻이 원본에 없다(웨이브 인계 W3 행 · COL-08).
- **결정**: **데드밴드 강화는 SW-10 on에서만 동작한다.** SW-10 off면 경고 단계의 발행량 감축은 무동작이고 deadband_boost_active는 0에 머물며 단계 진입만 계측한다. 강화는 태그별 설정값에 **계수를 곱하는** 형태다(가산 아님 · 설정 0인 태그는 강화돼도 0).
- **버린 대안**: ① **경고 단계 동안 태그 설정값 적용(스위치 무시)** — 측정 기록의 스위치 상태는 off인데 행이 걸러져 **같은 조건이라 믿은 두 측정의 행 수가 다르다**(D-08의 실패가 백프레셔 도달 여부에 따라 조용히 생긴다). 무손실 판정도 거짓 유실을 낸다. ② **전역 기본 데드밴드** — 공학 단위가 다른 태그에 한 값을 적용해 어떤 태그는 무의미하고 어떤 태그는 전부 차단된다. ③ **가산 강화** — 같은 문제가 설정값이 있는 태그에서도 생긴다.
- **파급**: 개발 · 측정 기본 구성에서 경고 단계 반응이 비지만 위험 단계 스풀이 최종 방어라 유실이 없다. S6에서 경고 반응을 보려면 SW-10 on으로 따로 실행하고 무손실 판정에서 데드밴드 생략분을 뺀다 — 생략분 메트릭은 col_deadband_skipped_total([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)). COL-08 · 02_features/13 미확인 행을 닫는다 — 리드 반영.

## ADR-25 — CPU 바운드 작업은 piscina worker_threads로 격리

- **맥락**: 한 프로세스가 조회 API · 수집 · 적재 · 판정 · 생성을 떠안고, 디코딩 · MessagePack · LTTB · gzip이 API 요청과 같은 이벤트 루프를 다툰다(원본 tech_stack.md §3.3 · 원본 data_flow.md §15).
- **결정**: **입력 크기에 비례해 동기 CPU 시간이 느는 작업**(신호 벡터 생성 · 대량 인코딩 · 해제 · LTTB · gzip)을 piscina worker_threads 풀에서 실행한다. IO 바운드(Modbus · 저장소 왕복)는 격리하지 않는다. 이벤트 루프 지연을 1급 메트릭으로 계측하고 그 실측이 역할 분리 진입 조건이다. 워커 수는 2계층 조정값(소유 [03_execution_topology.md](./03_execution_topology.md)).
- **버린 대안**: ① **이벤트 루프 인라인** — 큰 조회 하나 · 생성 주기 하나가 루프를 막아 수집 pps에 비례해 조회 p95가 악화된다. ② **자식 프로세스** — 대량 배열이 프로세스 경계에서 직렬화 · 복제되어 복사 비용과 메모리 이중 점유가 이득을 넘는다. ③ **처음부터 별도 컨테이너** — 역할 분리를 실측 전에 앞당겨 기준선을 잃는다(ADR-22). ④ **네이티브 애드온** — 툴체인이 늘어 "이미지 1개 · 툴체인 1개"(ADR-01)가 깨진다.
- **파급**: 격리 대상 목록의 정본은 [02_module_boundaries.md](./02_module_boundaries.md) §worker_threads 격리 대상. 워커도 같은 컨테이너 CPU를 쓰므로 격리가 CPU 경합을 없애지는 않는다 — 경합이 조회 p95에 나타나는 시점이 역할 분리의 실측 근거다(REQ-GLB-20).

## ADR과 전역 계약

전역 계약 REQ-GLB가 "무엇이 참이어야 하는가"라면 ADR은 "무엇으로 그것을 참으로 만드는가"다. 계약을 강제하는 ADR만 적는다.

| REQ-GLB | 계약 요지 | 강제하는 ADR |
|------|------|------|
| 03 · 04 | Stream 경계 · 경계 횡단 경로 둘 | ADR-06 · ADR-11 |
| 05 · 06 | XACK 규칙 · 결정적 토큰 | ADR-09 · ADR-14 |
| 08 · 09 | 키 접두 생존 정책 · 실패 전략 이원화 | ADR-05 · ADR-13 |
| 10 | 백프레셔 명시화 | ADR-21 · ADR-23 |
| 11 · 12 · 13 | 저장소 책임 · 분기 · 세 쓰기 | ADR-03 · ADR-11 · ADR-17 |
| 14 | 두 DB를 묶지 않는다 | ADR-16 |
| 16 | 계측 우선 | ADR-08 · ADR-20 |
| 19 | 127.0.0.1 바인드 | ADR-18 |
| 20 | CPU 바운드 격리 | ADR-25 |
| 21 | 데이터 계약 결합 | ADR-01 · ADR-04 |
| 22 | 실측 후 분리 | ADR-22 |

- 검산: 걸린 REQ-GLB = 03 · 04 · 05 · 06 · 08 · 09 · 10 · 11 · 12 · 13 · 14 · 16 · 19 · 20 · 21 · 22 = **16** · 표 행 **11**
- 이 표에 없는 ADR(02 · 07 · 10 · 12 · 15 · 19 · 24)은 전역 계약이 아니라 도메인 계약(REQ-AUT · REQ-RLT · REQ-MST · REQ-ING · REQ-COL 등)이나 구조 전용 불변식을 강제한다 — 검산 25 − 18(표에 나온 ADR: 01 · 03 · 04 · 05 · 06 · 08 · 09 · 11 · 13 · 14 · 16 · 17 · 18 · 20 · 21 · 22 · 23 · 25) = **7**

## 후속 판정 등재

ADR이 결정을 내렸지만 값이나 인접 판정이 남은 자리다.

| ADR | 남은 것 | 확정 자리 |
|------|------|------|
| ADR-09 | B · C안 비교 결과 · fan-in 배치 토큰 재료 | S3 실측 · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4) |
| ADR-10 | 최종안 · 확정 뒤 SW-11 기본값 · 존속 | S6 실측 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)(리드) |
| ADR-11 | 판정을 flusher와 같은 흐름에서 기다리는가 · 판정 구간 예산 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) · 실측 |
| ADR-17 | 대조 실험 자원 동일화 값 · 구간 count 대조 절차 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 메모리 3.5 · 3.5 GB · 구간 count 대조는 격자 단계 ②(W6 닫힘) |
| ADR-21 | 컨슈머 랙 산출식 · Stream 점유 메모리 해석 | **W6 닫힘** — lag + pending · 점유 메모리 = redis_prefix_memory_bytes · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)(W3) |
| ADR-23 · ADR-24 | 히스테리시스 폭 · 유지 시간 · 강화 계수 | S6 실측 · [06_backpressure_failure.md](./06_backpressure_failure.md) |

- 검산: 등재 행 = **6**

## D와 ADR의 경계

D-NN이 방향을 정하고 ADR이 그 방향을 구조로 강제한다. 아래는 D에서 파생된 ADR의 대응이다 — 같은 결정을 양쪽에 채번하지 않는다.

| D | 방향(제품 · 학습) | 파생 ADR(구조 · 설정) |
|------|------|------|
| D-01 · D-04 | 학습 목표 2축 · 3계층 분기 | ADR-03 · ADR-11 · ADR-16 |
| D-02 | 로컬 전용 | ADR-18 · ADR-20 · ADR-22 |
| D-05 · D-12 | 대조군 도입 · S3 적재 · S5 측정 | ADR-17 |
| D-06 | 스위치 1급 요구사항 | ADR-08 · ADR-10(SW-11) |
| D-08 | SW-10 유지 | ADR-24 |
| D-10 | 4요소 · 3회 중앙값 | ADR-18(재현 가능한 볼륨) · ADR-20(정밀 세션) |

- 검산: 대응 행 = **6** · D 없이 선 ADR(원본 기술 선정 · 보정) = 01 · 02 · 04 · 05 · 06 · 07 · 09 · 12 · 13 · 14 · 15 · 19 · 21 · 23 · 25 = **15** — 표에 나온 ADR(중복 제거) 03 · 08 · 10 · 11 · 16 · 17 · 18 · 20 · 22 · 24 = **10** · 15 + 10 = **25**
- **판정 기준은 하나다** — 무엇을 배우고 어디까지 만들고 어떤 순서로 재는가를 바꾸면 D, 그것을 어떤 구조 · 설정으로 강제하는가를 바꾸면 ADR이다. 애매하면 ADR로 보내고 D는 방향만 링크한다([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) §D와 ADR의 경계).

## 개정 규칙

| 상황 | 규칙 | 어기면 |
|------|------|------|
| 결정을 뒤집을 때 | 새 ADR을 말미에 채번하고 원 번호에 상태(대체됨 → ADR-NN)를 단다 · 원문 보존 | 왜 한 번 그렇게 갔다가 되돌렸는지가 사라진다 |
| 잠정 결정이 확정될 때(ADR-10) | 같은 결정이면 상태를 현행으로 바꾸고 날짜를 적는다 · 다른 결정이면 대체 | 잠정 표기가 남아 확정된 결정을 재론하게 된다 |
| S3 비교 결과가 ADR-09를 뒤집을 때 | 대체 절차 · 비교 기록을 근거로 인용 | 실측이 결정을 조용히 고쳐 as-built와 결정이 어긋난다 |
| 수단만 바뀔 때 | 원 번호 본문을 고치고 개정 사실을 적는다 · 결정과 버린 대안 유지 | 수단 변경이 결정 대체로 오독된다 |
| 다른 문서가 결정을 서술할 때 | 번호를 링크하고 결론만 적는다 · 버린 대안의 논쟁을 옮기지 않는다 | 같은 논쟁이 흩어져 한쪽만 개정된다 |

- 검산: 규칙 = **5**

## 관련 문서

- [README.md](./README.md) — ADR 선점표 · 폴더 목차
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-NN 채번 정본 · D와 ADR의 경계
- [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) — 기술 선정 근거 · 버전
- [02_module_boundaries.md](./02_module_boundaries.md) — 경계 · 배정 · 포트 확정 표
- [06_backpressure_failure.md](./06_backpressure_failure.md) — ADR-10 · ADR-21 · ADR-23 · ADR-24의 정책 서술
- [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) — 말미 채번 · 결번 보존 규약
