# 스위치 매트릭스 — 역할 스위치 SW-NN

> **대상**: 역할 스위치 11종의 채번 · 환경변수 · 기본값 · off · on 동작 · 측정 대상 · 교체되는 포트 · 관련 기능 · 흐름 · 원본 예상치 · 실험 자리 · 조합 제약 — SW-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — **SW-11 LATEST_VALUE_WRITER 신설**(사용자 결정 D-13) · 스위치 10 → **11** · SW-02 포트 LatestValuePort → **LatestValueReadPort** 개명(W3 04/02 확정) · 포트 이름 잠정 · SW-10 off 경고 강화 미확인 행을 닫는다(ADR-24 — 무동작)
> **원천**: 원본 implementation_plan.md §3.1 · §3.2 · §4 · §4.1 · §4.2 · §4.3 · §5 · §8(커밋 ff66a37) · 원본 data_flow.md §3.3 · §5 · §6 · §9.1 · §11.1(커밋 ff66a37) · 원본 architecture.md §4 · §9 · §17(커밋 ff66a37) · 저장소 루트 docs_plan.md(두 목표를 관통하는 축 — 역할 스위치 SW-NN · 보정 #2 · #14) · D-05 · D-06 · D-08 · D-10 · [README.md](./README.md) 스위치 목록 순서

이 문서는 **SW-NN의 채번 정본**이다. 스위치는 기능이 아니라 기능의 구현을 바꿔 끼우는 **실험 손잡이**다 — 같은 코드에서 Redis의 각 역할(과 대조군 · 데드밴드 · 최신값 갱신 주체)을 끄고 켜서 그 기여분을 분리한다(D-06). 스위치가 없으면 나중에 끼운 캐시의 전후 비교에 "코드가 달라져서"가 붙어 Redis 기여분을 분리할 수 없고, 처음부터 켠 캐시는 캐시가 없을 때의 고통을 영영 보여 주지 않는다(원본 implementation_plan.md §3.1).

**스위치는 런타임 분기가 아니라 DI로 주입되는 구현체다.** 포트 인터페이스 하나에 구현 둘을 두고 모듈 초기화 때 고른다. 조회 경로 안에 if를 흩뿌리면 분기 자체가 측정 대상 코드에 섞여 비교가 오염되고, 스위치가 늘수록 경로가 조합 폭발한다(원본 implementation_plan.md §4.3). 그래서 **전환은 재기동이 필요하고** 화면은 상태를 표시할 뿐이다(docs_plan 보정 #14). 제약의 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)다.

**스위치 없는 실험 · 실험 없는 스위치를 두지 않는다.** 스위치를 더하거나 바꾸면 이 문서 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md)를 같은 변경 단위에서 고친다([../CLAUDE.md](../CLAUDE.md)).

## 스위치 정본 표

SW-01~SW-10의 순서는 [README.md](./README.md) 고정 기준의 목록 순서 그대로다. **SW-11은 사용자 결정(D-13 · 2026-09-24)으로 말미에 채번했다.** 번호는 식별자이지 순서가 아니다 — 새 스위치는 SW-12부터 말미 채번한다.

| ID | 환경변수 | 분류 | 기본값 | off 동작 | on 동작 | 도입 단계 |
|------|------|------|------|------|------|------|
| **SW-01** | REDIS_STREAM_BUFFER | Redis 역할 — 백프레셔 | on | Collector가 Ingest를 프로세스 안 큐로 직접 부른다 · **실험 전용 · 부팅 경고** | XADD → XREADGROUP(Stream 경계) | S2(경계) · S6(off 실험) |
| **SW-02** | REDIS_LATEST_CACHE | Redis 역할 — 캐시 | on | 최신값 API가 ClickHouse argMax 점조회로 응답한다 | rt:latest HGETALL | S2 |
| **SW-03** | REDIS_QUERY_CACHE | Redis 역할 — 캐시 | on | 매 요청 ClickHouse 집계(항상 미스) | cache-aside | S2 |
| **SW-04** | CACHE_KEY_TIME_SNAP | Redis 역할 — 캐시 | on | now()를 그대로 캐시 키에 넣는다 | 시간 범위를 버킷 경계로 내린다 | S4 |
| **SW-05** | CACHE_STAMPEDE_LOCK | Redis 역할 — 캐시 | on | 미스 시 동시 요청 전원이 원천을 부른다 | SET NX 락 + 대기 · 재조회 | S4 |
| **SW-06** | REDIS_PUBSUB_FANOUT | Redis 역할 — 팬아웃 | on | 발행자가 WebSocket 게이트웨이를 직접 부른다 | PUBLISH · SUBSCRIBE | S4 |
| **SW-07** | WS_THROTTLE_MS | Redis 역할 — 팬아웃 | on(100 ms) | 0 — 병합 없이 매 갱신 전송 | 창 안 같은 태그의 최종값만 전송 | S4 |
| **SW-08** | INGEST_IDEMPOTENCY | Redis 역할 — 멱등 | on | 중복 제거 토큰을 싣지 않는다 | insert_deduplication_token 전달 | S3 |
| **SW-09** | CONTROL_TABLE_ENABLED | Redis 역할 — 대조군 | **off** | PostgreSQL 대조군에 싣지 않는다 | 같은 배치를 plc_tag_raw_control에도 삽입 | S3(적재) · S5(측정) |
| **SW-10** | COLLECTOR_DEADBAND | 수집 | **off** | 데드밴드 비활성 — 변화량과 무관하게 전부 발행 | 태그별 tag_master.deadband 적용 | S3 |
| **SW-11** | LATEST_VALUE_WRITER | Redis 역할 — 최신값 결합 | **ingest** | ingest — Ingest가 ClickHouse 삽입 성공 · XACK 뒤에 rt:latest를 덮어쓴다(ING-08) | collector — Collector가 XADD와 같은 파이프라인으로 rt:latest를 덮어쓴다 | S3(ingest 잠정) · S6(비교) |

- 도입 단계의 정본은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) §스위치 도입 시점이다 — 이 열은 인용이며 이 문서는 단계를 다시 세지 않는다.
- **SW-09가 "Redis 역할"로 분류되는 것은 docs_plan 스위치 표의 분류를 승계한 것이다.** 대조군 동시 적재는 Redis 기능이 아니지만 Stream 뒤 적재 경로의 한 갈래로 Redis 역할 9에 센다. 분류 축을 바꾸면 루트 README 고정 기준의 검산식이 함께 바뀐다.
- SW-10 기본값의 원본 표기는 "0"이다(원본 implementation_plan.md §4.1) — 데드밴드 0 = 비활성 = off와 같다.
- **SW-11은 켜고 끄는 스위치가 아니라 구현 선택 스위치다.** off · on 열에 두 값(ingest · collector)을 적는다. 원본 보정 7.2가 "S6 실측으로 결정"한 최신값 갱신 주체를 스위치로 노출해, ClickHouse 중단 중 대시보드가 살아 있는지의 비교가 스위치 상태로 기록되게 한다(ADR-10 · D-13). S6 결정 뒤에도 스위치는 남긴다 — 결합도 비교가 학습 목표 ②의 실험이기 때문이다.

## 측정 · 교체 표

| ID | 측정 대상 | 교체되는 포트(구현 둘) | 관련 기능 | 관련 흐름 | 예상 차이(원본 예상치 — 확정 아님) | 실험 자리 |
|------|------|------|------|------|------|------|
| SW-01 | 백프레셔 흡수력 · 유실 | PointBufferPort — RedisStreamBuffer · InProcessQueueBuffer | COL-07 · ING-01 | F-01 · F-02 · F-10 | off — ClickHouse 중단 시 폴링 주기 붕괴 + 유실 · on — 무손실 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — W6 채번 |
| SW-02 | 점조회 비용 | LatestValueReadPort — RedisLatestValueReader · ClickHouseLatestValueReader | RLT-01 · RLT-02 | F-03 | 30~150 ms → 0.3~1 ms | 상동 — W6 채번 |
| SW-03 | 반복 조회 흡수 | TimeseriesCachePort — RedisTimeseriesCache · NoopTimeseriesCache | TSQ-04 | F-04 | 히트 시 250 ms → 15 ms | 상동 — W6 채번 |
| SW-04 | 키 파편화 | CacheKeyNormalizerPort — TimeSnapKeyNormalizer · RawTimeKeyNormalizer | TSQ-03 | F-04 | 히트율 약 0% → 80% 이상 | 상동 — W6 채번 |
| SW-05 | 스탬피드 | RebuildLockPort — RedisRebuildLock · NoopRebuildLock | TSQ-05 | F-04 | 동시 100요청 시 ClickHouse 쿼리 100회 → 1회 | 상동 — W6 채번 |
| SW-06 | 팬아웃 경계 비용 | RealtimeFanoutPort — RedisPubSubFanout · DirectGatewayFanout | ING-08 · ALM-06 · RLT-05 · RLT-08 | F-06 · F-07 | 루프백 1홉(1 ms 미만) 대 확장 가능성 | 상동 — W6 채번 |
| SW-07 | 프레임 폭증 | FrameThrottlePort — WindowMergeThrottle · PassthroughThrottle | RLT-06 | F-07 | 초당 5,000 → 10 프레임(태그 500 · 10 Hz) | 상동 — W6 채번 |
| SW-08 | 재시도 중복 | BatchTokenPort — DeterministicBatchToken · NoBatchToken | ING-04 | F-02 | off — 재시도 시 중복 행 발생 · on — 미발생 | 상동 — W6 채번 |
| SW-09 | 목표 ①의 실행 — 쿼리별 역전 지점 · 비교 축 6 | ControlTableSinkPort — PostgresControlSink · NoopControlSink | ING-11 · GEN-10 | F-02 · F-09 | 원본 예상치 없음 — 역전 지점이 산출물이다 | 상동 — **EXP-01~EXP-05 대조군 예약 대역**([../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)) |
| SW-10 | 전송량 · ClickHouse 행 수 · 압축률 | DeadbandFilterPort — TagDeadbandFilter · PassthroughFilter | COL-06 | F-01 | 프로파일별 전송률 3~100%(원본 data_flow.md §3.3) | 상동 — W6 채번 |
| SW-11 | ClickHouse 중단 중 최신값 갱신 지속 · 적재 경로와 최신값의 결합도 | LatestValueWritePort — IngestLatestValueWriter · CollectorLatestValueWriter | ING-08 · COL-07 | F-02 · F-03 · F-10 | 원본 예상치 없음 — ingest는 ClickHouse 중단 동안 최신값이 멈추고 collector는 계속 갱신된다는 구조적 차이만 있다(원본 implementation_plan.md §7.2) | 상동 — W6 채번 |

- **포트 이름의 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)다(W3 확정).** SW-02는 쓰기 포트(SW-11)와 가르기 위해 LatestValueReadPort로 개명됐다. 이 표는 "포트 하나에 구현 둘"이라는 모양과 교체 대상 기능을 고정한다.
- **예상 차이는 전부 3계층 미확인이다** — 4요소가 없는 원본 예상치이며 목표가 아니다. 확정은 해당 실험의 실측 결과로만 한다([../CLAUDE.md](../CLAUDE.md) 수치 3계층).
- 스위치 상태는 전부 OBS-06이 노출한다([11_metrics.md](./11_metrics.md)).

### 검산

- 분류: 백프레셔 1(SW-01) + 캐시 4(SW-02 · 03 · 04 · 05) + 팬아웃 2(SW-06 · 07) + 멱등 1(SW-08) + 대조군 1(SW-09) + 수집 1(SW-10) + 최신값 결합 1(SW-11) = **11** — Redis 역할 1 + 4 + 2 + 1 + 1 + 1 = **10** · 수집 **1**
- 기본값: on 8(SW-01~08) + off 2(SW-09 · 10) + 구현 선택 1(SW-11 = ingest) = **11**
- 값 형식: 켜고 끄는 불리언 9 + 밀리초 1(SW-07 — 0이 off) + 구현 선택 1(SW-11) = **11**
- 관련 흐름 참여(중복 허용): F-01 2(SW-01 · 10) + F-02 4(SW-01 · 08 · 09 · 11) + F-03 2(SW-02 · 11) + F-04 3 + F-06 1 + F-07 2 + F-09 1 + F-10 2(SW-01 · 11) = **17**. 스위치가 걸린 흐름 8 · 걸리지 않는 흐름 F-05 · F-08 — 10 − 8 = **2**(업무 CRUD의 무효화 체인과 롤업은 정합성 계약이라 스위치를 두지 않는다)

## 공통 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| DI 구현체 | 포트 하나에 구현 둘 · 모듈 초기화 때 환경변수로 고른다 | 분기가 측정 대상 코드에 섞이고 스위치 수만큼 경로가 조합 폭발한다 |
| 전환 = 재기동 | 화면 · API로 바꾸지 않는다. 환경변수를 바꾸고 api 컨테이너를 재기동한다 | 런타임 토글을 만들면 결국 경로 안 if로 돌아간다(D-06 버린 대안 ④) |
| 상태 노출 | 11종 전부를 /api/v1/health 응답과 /metrics 레이블로 노출한다(OBS-06) | 기록자가 환경변수를 손으로 옮겨 적다 틀린다 — 스위치 상태는 측정 기록 4요소의 하나다(D-10) |
| 기록 병기 | 모든 측정 수치에 11종의 상태를 적는다. 바꾼 것만 명시하고 나머지는 "기본값"으로 적을 수 있다 | 같은 조건이라 믿은 두 측정의 조건이 다르다 — SW-10이 빠지면 행 수가 다른 두 측정이 같은 실험으로 묶인다(D-08) |
| 같은 커밋의 계측 | 스위치와 그 on/off 차이를 재는 계측을 같은 커밋에서 만든다 | 계측 없는 스위치는 장식이다 |
| SW-01 off 부팅 경고 | off로 기동하면 경고를 남기고 상태로 노출한다 | off가 정상 경로로 오인되어 유실이 기본 동작이 된다 |

- 검산: 공통 규칙 = **6**

## SW-01 off는 원칙을 증명하는 경로다

**결론**: SW-01 off는 설계서 제1원칙("수집과 적재 사이에는 반드시 Stream — 같은 프로세스 안이어도 예외가 아니다")을 정면으로 어긴다. 그래서 **실험 전용 · 기본 on · 정상 경로 아님**으로 못박고 부팅 시 경고를 띄운다(원본 implementation_plan.md §4.1). **반대 시나리오**: off를 정상 구성으로 쓰면 ClickHouse 삽입 지연이 Modbus 폴링 주기로 곧장 역류하고, PEL이 없어 재시작 시 미처리 배치가 사라지며, 스풀(COL-09)도 발동하지 않는다 — XADD 자체가 없기 때문이다. **파생 지침**: off 측정은 S6의 "off + ClickHouse 중단" 실험 기록에만 남기고 기본값을 바꾸지 않는다. 경고는 설정 오류가 아니라 경로의 등급 표시다.

- 이 스위치의 목적은 원칙을 우회하는 것이 아니라 **원칙이 왜 원칙인지를 유실 수치로 증명하는 것**이다.

## 조합 제약

스위치는 서로 독립이 아니다. 아래 조합은 측정이 성립하지 않거나 두 학습 축을 섞는다. 실험 조건 분리의 강제는 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)가 한다.

| # | 조합 | 제약 | 이유 |
|------|------|------|------|
| 1 | SW-03 off + SW-04 · SW-05 on/off 비교 | 측정하지 않는다 | 캐시가 없으면 키도 락도 쓰이지 않아 차이가 0이다 |
| 2 | SW-01 off + 주입 모드 B · C | **조합 금지 — SW-01 off 실험은 모드 A로만 한다** | 모드 B · C는 Stream이 있다는 전제의 주입이라 Stream 경계를 끈 구성에서 경로가 정의되지 않는다 |
| 3 | SW-01 off + SW-08 멱등 측정 | 멱등 수치를 이 조합으로 재지 않는다 | 결정적 토큰의 재료가 Stream 엔트리 ID 범위인데 off에서는 엔트리 ID가 없다 |
| 4 | SW-09 on + 목표 ② 처리량 측정 | 섞지 않는다 | 모든 삽입 처리량에 대조군 적재 비용이 섞인다 — SW-09가 기본 off인 이유다 |
| 5 | SW-10 on + 성능 측정 | 섞지 않는다 — 성능은 off로 잰다 | 데드밴드는 원본 파형을 잃고 전송량을 바꿔 처리량 수치가 의미를 잃는다(원본 data_flow.md §3.3) |
| 6 | SW-06 off + api 다중 인스턴스(확장 2단계) | 조합 금지 | 직접 호출은 같은 프로세스의 게이트웨이에만 닿아 다른 인스턴스의 소켓이 값을 받지 못한다 |
| 7 | SW-11 비교 + SW-02 off | 측정하지 않는다 — SW-11 비교는 SW-02 on으로 한다 | SW-02 off면 최신값 API가 rt:latest를 읽지 않아 갱신 주체를 바꿔도 조회 결과에 차이가 드러나지 않는다 |

- 검산: 조합 제약 = **7**
- **두 학습 축의 비교 방향은 반대다** — 목표 ①은 데이터를 고정하고 저장소를 바꾸며(SW-09), 목표 ②는 저장소를 고정하고 역할을 바꾼다(SW-01~08). 제약 #4가 두 축을 가르는 자리다([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)).

## 스위치별 판정

원본이 off의 범위를 적지 않아 이 문서가 고정한 것이다.

| 스위치 | 판정 | 근거 | 버린 해석의 실패 |
|------|------|------|------|
| SW-02 | **읽기 포트만 교체한다** — off에서도 Ingest의 rt:latest 갱신과 ch:rt 발행은 그대로다 | 측정 대상이 "점조회 비용"이다(원본 implementation_plan.md §4.1) | 갱신까지 끄면 WebSocket 경로(F-07)와 Redis 메모리가 함께 바뀌어 on/off 차이가 점조회 비용 하나로 설명되지 않는다 |
| SW-06 | **대상 채널은 WebSocket 팬아웃 채널(ch:rt · ch:alarm)이다.** ch:cacheinv는 대상이 아니다 | off 동작이 "WS 게이트웨이를 직접 호출"이다 — ch:cacheinv의 구독자는 게이트웨이가 아니라 다른 api 인스턴스다 | ch:cacheinv까지 끄면 무효화 체인(MST-08)이 스위치 상태에 따라 달라져 정합성 계약에 스위치가 생긴다 |
| SW-01 | off 실험은 **모드 A 전용**이다 · off에서는 스풀 경로가 없다 | 조합 제약 #2 · §SW-01 off는 원칙을 증명하는 경로다 | 모드 B로 off를 재면 Stream이 없는 구성에 Stream 직결 주입을 거는 모순이 생긴다 |
| SW-10 | 기본 **off**다 | 원본 기본값 0 · 성능 측정은 데드밴드 0이 규칙이다(원본 data_flow.md §3.3) | on을 기본으로 두면 모든 처리량 · 행 수 · 압축률 수치에 데드밴드가 섞인다 |

## 스위치 추가 · 변경 절차

| 변경 | 같은 변경 단위에서 고치는 곳 | 어기면 |
|------|------|------|
| 스위치 신설 | 이 문서 두 표와 §검산 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(실험) · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md)(상태 표시) · 교체 대상 기능의 도메인 파일 · 루트 README 고정 기준(리드) | 실험 없는 스위치 · 기록되지 않는 조건이 생긴다 |
| 기본값만 변경 | 이 문서 정본 표 · 기본값 검산 · 실험 카탈로그의 기준 조건 | 이전 측정 기록의 "기본값" 표기가 다른 조건을 가리킨다 — 스위치 수는 불변이다 |
| off 동작의 의미 변경 | 개명이 아니라 **폐지 + 신설**이다([../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)) | 의미가 바뀐 SW-NN을 같은 번호로 두면 전후 측정 기록이 같은 스위치로 묶여 비교된다 |
| 폐지 | 정본 표에 폐지 행으로 남긴다 · 번호 재사용 금지 | 옛 기록의 SW-NN이 다른 스위치를 가리킨다 |

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 스위치 상태 레이블 이름 | 미정 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |
| 스위치별 실험 EXP 번호(SW-09 제외) | W6 채번 — 스위치마다 최소 1개 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(W6) |
| SW-09 on에서 대조군 삽입 실패의 의미론 · 대조군 멱등 수단 | **신규 미확인** — [06_ingest.md](./06_ingest.md) §미확인 · 미설계 등재 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) |
| SW-01 off에서의 배치 토큰 재료 | **신규 미확인** — 조합 제약 #3 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4) |
| 예상 차이 전 행 | 미확인 — 확정 전 임의 값 고정 금지 | 각 실험의 실측 결과 |

## 관련 문서

- [README.md](./README.md) — 스위치 11종 목록 · DI 제약(축약)
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-06 스위치 1급 요구사항 · D-08 SW-10 유지
- [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) — 스위치 도입 시점
- [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) — 스위치 = DI 포트 제약 정본
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 스위치별 실험
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 4요소 병기 · 실험 조건 분리
- [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) — 스위치 상태 표시
- [11_metrics.md](./11_metrics.md) — 스위치 상태 노출(OBS-06)
