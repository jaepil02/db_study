# 모듈 경계

> **대상**: api 프로세스 안 모듈 사이의 경계 — Stream 경계 원칙과 근거 4 · 경계 예외(알람 직접 호출)의 근거 · APP_ROLE 5값과 모듈 배정 · worker_threads 격리 대상 · **스위치 = DI 포트 확정 표(포트 · 구현 이름 정본)** · 리포지터리 구조
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §1 · §4 · §8.2 · §9(커밋 ff66a37) · 원본 tech_stack.md §1 · §3.1 · §3.3 · §3.4 · §5.3 · §11(커밋 ff66a37) · 원본 data_flow.md §4.2 · §8 · §9 · §15(커밋 ff66a37) · 원본 implementation_plan.md §4.3 · §6 · §7.2 · §7.3 · §7.5(커밋 ff66a37) · D-06 · ADR-06 · ADR-07 · ADR-08 · ADR-10 · ADR-11 · ADR-22 · ADR-25 · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)

11개 모듈은 api 컨테이너 **한 프로세스** 안에 산다. 그런데도 모듈 사이는 호출 스택이 아니라 Redis Stream · Pub/Sub · Modbus 소켓으로 잇는다. 이 경계가 확장 로드맵 1단계(APP_ROLE 역할 분리)를 **코드 변경 없이 기동 값만 바꾸는 일**로 만든다 — 경계를 미리 지불해 둔 값이 거기서 회수된다(원본 architecture.md §19).

이 문서는 경계의 **원칙 · 예외 · 배정 · 격리 · 교체 지점** 다섯을 고정한다. 특히 두 인계를 여기서 닫는다 — ① SIM · OBS의 APP_ROLE 배정(원본 미지정) ② 스위치 전종의 포트 · 구현 이름(02_features/13의 잠정 명칭 → **이 문서가 정본**).

## Stream 경계 원칙

**수집과 적재 사이에는 반드시 Redis Stream을 둔다. 같은 프로세스 안이어도 예외가 아니다**(ADR-06 · REQ-GLB-03). Collector가 Ingest의 메서드를 부르면 코드는 한 줄로 끝난다. 런타임이 둘이던 시절의 명분("언어 간 결합도 0")은 사라졌지만 경계를 유지하는 근거 넷이 남는다.

| # | 근거 | 경계가 주는 것 | 직접 호출로 바꾸면 | 이 근거를 재는 자리 |
|------|------|------|------|------|
| ① | 백프레셔 흡수 | 수집 속도와 적재 속도가 분리된다 | ClickHouse 삽입 지연이 Modbus 폴링 주기로 곧장 역류한다 — 폴링 주기가 삽입 지연을 따라 늘어난다 | SW-01 off + ClickHouse 중단(S6) — poll_duration 대 scan_rate |
| ② | at-least-once 재시도 · DLQ | PEL과 XAUTOCLAIM이 미처리 엔트리를 보존 · 회수한다 | 재시도가 메모리 안의 임시 상태가 되어 프로세스가 죽으면 함께 사라진다 | api 재기동 후 XPENDING 보존 · 생성 수 대 행 수 |
| ③ | 이벤트 루프 격리 | 폴링 루프와 배치 삽입이 각자의 주기로 돈다 | 한 호출 스택을 공유해 한쪽의 지연이 다른 쪽의 스케줄링을 밀어낸다 | nodejs_eventloop_lag 대 수집 부하 |
| ④ | 재처리 · 역할 분리 대비 | APP_ROLE로 모듈을 떼어도 호출부가 그대로다 | 역할 분리 순간 호출부를 전부 다시 써야 한다 | 확장 1단계 진입 시 코드 diff 0 |

- 검산: 근거 = **4**
- **loopback 1홉이 이 넷의 대가다.** 대가는 XADD 왕복 하나이고 지연 예산의 한 구간으로 잰다 — [05_latency_budget.md](./05_latency_budget.md).
- 같은 원리가 팬아웃에도 적용된다. Ingest · Alarm의 발행과 WebSocket 게이트웨이는 같은 프로세스에 있어도 Pub/Sub(ch:rt · ch:alarm)을 지난다 — 경계를 없애면 api 다중 인스턴스(확장 2단계)에서 팬아웃 코드를 새로 써야 한다(ADR-07).

### 경계 유형과 매체

| 경계 유형 | 매체 | 간선 | 이 문서가 강제하는 것 |
|------|------|------|------|
| Stream 경계 | stream:plc:raw · 컨슈머 그룹 | COL → ING · GEN(모드 B · C) → ING | 발행자는 Stream 페이로드 계약(스키마 버전 v) 하나로만 결합한다 |
| Pub/Sub 경계 | ch:rt · ch:alarm · ch:cacheinv | ING → RLT · ALM → RLT · MST → 다른 api 인스턴스 | 발행자는 구독자를 모른다 |
| Modbus 경계 | 루프백 TCP 소켓 | SIM → COL | 같은 프로세스여도 소켓을 지난다 |
| 직접 호출(예외) | 프로세스 안 호출 | ING → ALM | §경계 예외 — 알람 판정 직접 호출 |

- 경계 유형 전수 · 간선 검산의 정본은 [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) §경계 유형이다. 이 표는 데이터가 모듈을 건너는 네 유형만 다시 적고 저장소 경유 · 트랜잭션 공유 · 인가 · 시뮬레이션 결합은 다루지 않는다.

## 경계 예외 — 알람 판정 직접 호출

**Ingest는 삽입이 확정된 배치의 행 배열을 같은 프로세스 안 직접 호출로 Alarm 판정에 넘긴다. 이것이 Stream 경계 원칙의 유일한 의도된 예외다**(ADR-11 · REQ-GLB-04). 원본은 이 호출을 적었지만 근거를 적지 않았고(원본 implementation_plan.md §7.3), 근거 없는 예외는 "같은 프로세스 안이어도 예외가 아니다"를 사례별 판단으로 퇴화시킨다.

| 근거 | 내용 | 이 근거가 무너지는 조건 |
|------|------|------|
| 판정은 배치의 후처리다 | 판정 입력은 **삽입이 확정된 배치의 행**이다. 삽입 전 행을 판정하면 확정되지 않은 값으로 알람이 선다 | 판정이 삽입 전 행을 입력으로 받게 바뀌면 |
| 재처리 단위가 배치와 같다 | 판정이 실패해도 배치의 XACK · 재시도 단위와 어긋나지 않는다 — 판정용 큐를 따로 두면 재처리 단위가 둘이 되어 한쪽만 재처리되는 창이 생긴다 | 판정 재시도를 배치와 다른 단위로 하게 되면 |
| 역할 분리 뒤에도 같은 컨테이너에 남는다 | 판정은 ingest와 함께 worker 역할에 배정된다(§APP_ROLE 배정) — 분리해도 호출이 프로세스 경계를 건너지 않는다 | ALM 판정을 ingest와 다른 역할로 떼어내면 |
| 상태는 이미 Redis에 있다 | 핫 상태 alarm:state는 Redis Hash라 역할 분리 시 두 워커가 같은 규칙을 평가해도 상태를 공유한다 — 프로세스 메모리 캐시로 옮기지 않는다 | 판정 상태를 프로세스 메모리로 옮기면 |

- 검산: 근거 = **4**
- **예외의 대가는 처리량 상한이다.** 판정이 수집 경로에서 돌아 행당 상태 조회 왕복이 곧 수집 상한이 된다. 그래서 상태 조회는 배치당 관련 rule_id만 파이프라인 1회로 줄인다(ADR-11). 판정 구간의 지연 예산은 신설 · 미확인이다 — [05_latency_budget.md](./05_latency_budget.md).
- **예외를 하나 더 두려면 이 표의 네 근거에 상당하는 근거를 이 문서에 먼저 적는다.** 예외가 늘 때마다 APP_ROLE 분리의 "코드 변경 없음"이 거짓이 된다.

## APP_ROLE 배정

APP_ROLE은 한 이미지에서 기동할 모듈 범위를 고르는 환경변수다. 값은 all(기본) · api · worker · collector · datagen 다섯이다(루트 README 고정 기준 기동 역할). **기동은 all이 기본이며 역할 분리는 확장 로드맵 1단계의 실측 진입 조건으로만 한다**(ADR-22 · REQ-GLB-22).

| APP_ROLE | 기동하는 모듈 · 기능 | 이 역할만의 이유 |
|------|------|------|
| all | 11모듈 전부 | 기본값 — 컨테이너 4 구성 |
| api | AUT · MST · TSQ · RLT · WRK · ALM(규칙 · 조회 · 확인 표면) · GEN(모드 C 수신 표면 /api/v1/ingest/bulk) · OBS | 사람과 k6가 부르는 HTTP · WebSocket 표면이 전부 여기 있다 |
| worker | ING · ALM(디바운스 판정 · 세 쓰기 · ch:alarm 발행) · OBS | 판정이 ingest 배치의 후처리라 직접 호출이 프로세스를 건너지 않는다 |
| collector | COL · **SIM** · **GEN(모드 A 레지스터 갱신)** · OBS | PlcSim이 루프백에만 바인드하고 모드 A 갱신이 프로세스 안 호출이라 셋이 한 프로세스여야 한다 |
| datagen | GEN(모드 B 발행 · 모드 C 발신 · 모드 D 백필 · 대조군 동일 행 백필 · 단독 처리량 실측) · OBS | 생성기가 대상과 CPU를 다투지 않게 떼어내는 자리(원본 tech_stack.md §3.4) |

- 검산: APP_ROLE 값 = **5** · all을 뺀 역할 4
- **모듈이 아니라 기능 단위로 배정되는 도메인이 셋이다** — ALM(표면 api · 판정 worker) · GEN(모드 C 수신 api · 모드 A collector · 나머지 datagen) · OBS(전 역할). 검산: ALM 2역할 + GEN 3역할 + OBS 4역할 · 나머지 8도메인은 역할 하나. 모듈 하나를 여러 역할에서 기동하되 역할마다 켜는 기능이 다르다 — 기능 선택은 APP_ROLE을 읽는 모듈 초기화가 하고 경로 안 분기로 하지 않는다(ADR-08과 같은 원리).

### SIM · OBS · GEN 모드 A 판정

원본은 SIM · OBS에 역할을 주지 않았다(원본 architecture.md §4 확장 방식 열). 인계 두 건과 그 파생 제약을 아래로 닫는다(ADR-22).

| 대상 | 판정 | 근거 | 버린 안과 실패 |
|------|------|------|------|
| SIM | **collector 역할**에 배정한다 | PlcSim 포트 5020~5119는 컨테이너 루프백 전용이다. Collector가 다른 컨테이너로 가면 소켓이 닿지 않는다(REQ-SIM-11) | ① SIM을 datagen에 배정 — collector 컨테이너의 루프백에 PlcSim이 없어 모드 A 폴링 전부가 연결 거부된다. ② SIM 전용 역할 신설 — 루프백 제약을 풀려면 포트를 브리지에 열어야 하고 그 순간 "publish하지 않는다"가 컨테이너 간 노출로 바뀐다 |
| GEN 모드 A | **collector 역할**에서 기동한다 | 모드 A의 레지스터 Buffer 갱신은 프로세스 안 호출이다(GEN → SIM 시뮬레이션 결합) | 모드 A를 datagen에 두면 Buffer가 다른 프로세스에 있어 갱신이 닿지 않는다 — 모드 A만 끊기고 B · C · D는 동작해 **결함이 늦게 드러난다** |
| GEN 모드 B · D · 실측 | **datagen 역할**에서 기동한다 | 생성기 CPU를 대상과 가르는 것이 분리 목적이다 | collector에 두면 생성기와 폴링 루프가 같은 이벤트 루프를 다퉈 모드 A 지연이 생성 부하에 오염된다 |
| GEN 모드 C 수신 | **api 역할**에 둔다 · 발신 생성기는 datagen | /api/v1/ingest/bulk는 HTTP 표면이다 — 측정 대상이 HTTP 계층 비용이다 | 수신을 datagen에 두면 HTTP 표면이 api 밖에 생겨 인가 · 레이트 리밋 방어 지점이 둘이 된다 |
| OBS | **전 역할에서 기동한다.** 역할마다 자기 /metrics · /api/v1/health를 낸다. 저장소 통계 수집(Redis INFO · pg_stat · system.*)은 **api 역할 한 곳에서만** 한다 | 계측은 모듈이 자기 카운터를 등록하는 방식이라 카운터가 있는 프로세스마다 창구가 있어야 한다. 저장소 통계는 프로세스와 무관한 값이다 | ① OBS를 api에만 — worker · collector의 컨슈머 랙 · 폴링 지연 카운터가 창구를 잃어 분리 직후 파이프라인이 계측 공백이 된다. ② 저장소 통계를 역할마다 수집 — 같은 값을 세 번 조회해 pg_stat_statements · system.query_log에 관측 쿼리가 세 배로 섞인다 |

- 검산: 판정 행 = **5**
- **B형 — 분리 뒤 /metrics가 여러 개인 것은 "창구는 /metrics 하나"(ADR-20)의 위반이 아니다.** 그 원칙은 exporter 컨테이너를 따로 두지 않는다는 뜻이며 창구는 **프로세스당 하나**다. 반대로 창구를 한 프로세스로 모으려고 역할 간 메트릭 중계를 만들면 계측 경로가 새 경계가 되어 계측 자체가 측정 대상을 바꾼다. all 기동에서는 창구가 여전히 하나다.
- **역할 분리 시 PlcSim도 함께 멈추고 함께 뜬다.** collector 컨테이너 재기동은 SIM까지 재기동해 결측 구간을 남긴다 — 시뮬레이션 환경에서는 장애가 아니라 정상 동작이다(원본 data_flow.md §12.4).

## worker_threads 격리 대상

CPU 바운드 작업은 piscina worker_threads 풀에서 돈다(ADR-25 · REQ-GLB-20). 기준은 하나다 — **입력 크기에 비례해 동기 CPU 시간이 늘어나는 작업**은 이벤트 루프 밖으로 보낸다.

| 작업 | 모듈 | 격리 여부 | 이유 | 이벤트 루프에 두면 |
|------|------|------|------|------|
| 신호 벡터 생성(TypedArray) | GEN | 격리 | 태그 N × 시점 M에 비례 | 모드 A 폴링 · 조회 API가 생성 주기마다 멈춘다 |
| 대량 MessagePack 인코딩 | GEN · COL | 격리(대량일 때) | 페이로드 크기에 비례 | 스캔 사이클 인코딩이 XADD 타이밍을 민다 |
| MessagePack 해제 · 행 전개 | ING | 격리 | 배치 엔트리 수에 비례 | 소비 루프와 API 요청이 같은 스택을 다툰다 |
| LTTB 다운샘플 | TSQ | 격리 | 반환 포인트 수에 비례 | 큰 조회 하나가 최신값 조회 p95를 끌어올린다 |
| gzip 압축 · 해제(조회 캐시) | TSQ | 격리 | 응답 크기에 비례 | 캐시 히트인데 느린 응답이 생긴다 |
| Modbus 요청 · 응답 | COL · SIM | **격리하지 않는다** | IO 바운드 — 소켓 대기 | 해당 없음 — 워커로 보내면 스레드 간 복사가 이득보다 크다 |
| Redis · ClickHouse · PostgreSQL 왕복 | 전 모듈 | **격리하지 않는다** | IO 바운드 | 해당 없음 |

- 검산: 격리 5 + 비격리 2 = **7**
- 워커 수 · 스레드 풀 크기는 2계층 조정값이다(현행 참고 — 부하 실험 프로파일 piscina 2 · 개발 1 · 소유 [03_execution_topology.md](./03_execution_topology.md)).
- **격리해도 CPU는 같은 컨테이너 몫이다.** 워커는 이벤트 루프를 비울 뿐 api 컨테이너의 CPU 가중을 늘리지 않는다 — CPU 경합이 조회 p95에 나타나는 시점이 역할 분리의 실측 근거다(원본 architecture.md §13).

## 스위치 = DI 포트

**스위치는 런타임 분기가 아니라 DI로 주입되는 구현체다.** 포트 인터페이스 하나에 구현 둘을 두고 모듈 초기화 때 환경변수로 고른다(ADR-08 · D-06). 조회 경로 안에 if를 흩뿌리면 분기 자체가 측정 대상 코드에 섞여 비교가 오염되고, 스위치가 늘수록 경로가 조합 폭발한다(원본 implementation_plan.md §4.3). 전환은 환경변수 변경과 api 재기동뿐이다.

### 포트 · 구현 이름 확정 표

02_features/13의 잠정 명칭을 이 표가 확정한다. **이 표가 포트 · 구현 이름의 정본이다.** 채번 · 기본값 · off 동작의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)이며 이 표는 다시 세지 않는다.

| 스위치 | 포트 | on 구현 | off 구현 | 주입받는 모듈 | 잠정 명칭 대비 |
|------|------|------|------|------|------|
| SW-01 | PointBufferPort | RedisStreamBuffer | InProcessQueueBuffer | collector · datagen | 유지 |
| SW-02 | **LatestValueReadPort** | **RedisLatestValueReader** | **ClickHouseLatestValueReader** | realtime | **개명** — 잠정 LatestValuePort · RedisLatestValue · ClickHouseLatestValue |
| SW-03 | TimeseriesCachePort | RedisTimeseriesCache | NoopTimeseriesCache | timeseries | 유지(원본 명칭) |
| SW-04 | CacheKeyNormalizerPort | TimeSnapKeyNormalizer | RawTimeKeyNormalizer | timeseries | 유지 |
| SW-05 | RebuildLockPort | RedisRebuildLock | NoopRebuildLock | timeseries | 유지 |
| SW-06 | RealtimeFanoutPort | RedisPubSubFanout | DirectGatewayFanout | ingest · alarms | 유지 |
| SW-07 | FrameThrottlePort | WindowMergeThrottle | PassthroughThrottle | realtime | 유지 |
| SW-08 | BatchTokenPort | DeterministicBatchToken | NoBatchToken | ingest | 유지 |
| SW-09 | ControlTableSinkPort | PostgresControlSink | NoopControlSink | ingest | 유지 |
| SW-10 | DeadbandFilterPort | TagDeadbandFilter | PassthroughFilter | collector | 유지 |
| **SW-11** | **LatestValueWritePort** | **IngestLatestValueWriter**(값 ingest · 기본) | **CollectorLatestValueWriter**(값 collector) | ingest · collector | **신설** — 스위치 아닌 교체 포트에서 이동 |

- 검산: 스위치 11 = 유지 9 + 개명 1(SW-02) + 신설 1(SW-11) = **11** · 포트 **11** · 구현 11 × 2 = **22**
- **SW-11은 on/off가 아니라 갱신 주체 값(ingest · collector)을 고른다.** on 구현 열에 기본값 쪽을, off 구현 열에 대안 쪽을 적었다. 분류는 "Redis 역할 — 최신값 결합"이며 채번 · 기본값의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)다. ADR-10의 S6 비교가 스위치 상태로 측정 기록에 남는다.
- **SW-02를 개명한 이유 — 최신값에는 포트가 둘 생긴다.** 보정 7.2의 갱신 주체를 교체 가능하게 두려면 쓰기 쪽 포트가 필요한데(ADR-10), 읽기 포트가 LatestValuePort라는 이름을 가지면 두 포트의 이름이 겹쳐 "SW-02 off가 갱신도 끄는가"라는 오독이 생긴다. SW-02는 **읽기 포트만 교체한다**(02_features/13 §스위치별 판정) — 이름이 그 판정을 싣는다.
- **SW-07만 값이 밀리초다.** WindowMergeThrottle은 창 크기(0 초과)를 주입받고, 0이면 PassthroughThrottle을 주입한다 — 창 0의 WindowMergeThrottle을 만들지 않는다. 창 0을 병합 구현으로 돌리면 "병합 없음"과 "병합하되 창이 0"이 계측에서 갈리지 않는다.
- **SW-06의 대상 채널은 ch:rt · ch:alarm뿐이다.** ch:cacheinv는 DirectGatewayFanout으로 바뀌지 않는다 — 구독자가 게이트웨이가 아니라 다른 api 인스턴스다.
- 노출 값: OBS가 health · /metrics에 내는 스위치 상태는 **기동 시 실제로 주입된 구현**을 기준으로 한다(REQ-OBS-11). 레이블 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6)가 정한다.

### 스위치가 아닌 교체 포트

아래 포트는 **스위치 번호가 없다.** 스위치는 실험 손잡이이고, 아래는 두 번째 구현을 해당 확장 단계에서만 만드는 구조 추상화다.

| 포트 | 구현 | 선택 방식 | 결정 | 상태 |
|------|------|------|------|------|
| PointSourcePort | RedisStreamSource(현행) | 단일 구현 | ADR-04 | Kafka 전환(확장 4단계) 대비 추상화 — 두 번째 구현은 그 단계에서만 만든다 |

- 검산: 스위치 아닌 교체 포트 = **1**(PointSourcePort) — LatestValueWritePort는 SW-11로 채번되어 확정 표로 옮겼다
- **키 계열별 래퍼 3종(CacheKeyClient · DurableKeyClient · FanoutPublisher)은 포트가 아니다.** 스위치로 바꾸지 않는 강제 수단이며 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다(ADR-13).

## 리포지터리 구조

원본의 모노레포 제안(원본 tech_stack.md §11 · 원본 implementation_plan.md §6)을 따르되 문서 자리를 docs/ 12폴더와 docs/measurements로 바꾼다. 코드는 아직 없다 — 아래는 구현이 앉을 자리의 계약이다.

```plain
db_study/
├── apps/
│   ├── web/                    ← Next.js · 호스트 프로세스(3001)
│   └── api/src/
│       ├── modules/            ← NestJS 모듈 11 = 도메인 11
│       │   ├── auth · master · work-orders · alarms · timeseries · realtime   ← 제어 평면 6
│       │   ├── collector · plc-sim · ingest · datagen                         ← 데이터 평면 4
│       │   └── metrics                                                        ← 관측 1
│       └── common/
│           ├── redis/          ← 키 계열별 래퍼 — TTL 강제(ADR-13)
│           └── ports/          ← 스위치 포트 + 스위치 아닌 교체 포트(§스위치 = DI 포트)
├── packages/shared/            ← zod 스키마 · API 타입 · Stream 페이로드 계약(ADR-01)
├── infra/
│   ├── compose/                ← Compose 정의 + observability 프로파일
│   ├── clickhouse/             ← DDL 순번 파일 · 설정 · Dictionary 정의
│   ├── postgres/               ← 초기화 SQL · 설정
│   ├── redis/                  ← 설정(volatile-lru)
│   └── observability/          ← 스크레이프 설정 · 대시보드
├── loadtest/                   ← k6 시나리오
├── snapshots/                  ← 볼륨 아카이브 · 덤프(Git 제외)
├── docs/                       ← 설계 정본 12폴더(docs/README.md 문서 지도)
│   └── measurements/           ← 실측 기록 — 번호 없는 예외 폴더(D-09)
└── Taskfile                    ← migrate · seed · snapshot · restore · bench
```

- **원본 레이아웃의 docs 행이 바뀌었다.** 원본은 docs/ 아래(또는 루트)에 설계서 4본을 두었다. 현행은 docs/ 12폴더가 설계 정본이고 루트 4본은 W7에서 삭제된다(D-03) · docs/measurements는 설계 정본이 아니다(D-09).
- **common/ports가 스위치의 물리적 자리다.** 포트 인터페이스가 모듈 안에 흩어지면 스위치 목록과 코드의 대응을 한 곳에서 셀 수 없다.
- 모듈 디렉터리 이름은 도메인 ↔ 모듈 1:1 매핑을 따른다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)). 도구 · 버전 · 파일 이름 규칙의 정본은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)다.

## 경계 변경 절차

| 변경 | 먼저 고칠 자리 | 같은 변경 단위에서 함께 | 어기면 |
|------|------|------|------|
| 직접 호출 예외 추가 | 이 문서 §경계 예외에 근거 4행 상당 | ADR 신설 · REQ-GLB-04의 기대값 · 도메인 지도 경계 유형 | 역할 분리 때 끊기는 호출을 사전에 셀 수 없다 |
| 스위치 신설 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 채번 | 이 문서 확정 표 · 실험 카탈로그 · 실험 콘솔 | 포트 없는 스위치 또는 번호 없는 포트가 생긴다 |
| 포트 · 구현 개명 | 이 문서 확정 표 | 02_features/13 측정 · 교체 표 인용 | 정본과 인용이 다른 이름을 말한다 |
| APP_ROLE 배정 변경 | 이 문서 §APP_ROLE 배정 | 도메인 지도 APP_ROLE 열 · ADR-22 | 루프백 · 프로세스 안 결합이 역할 경계에서 끊긴다 |
| worker_threads 대상 추가 | 이 문서 §worker_threads 격리 대상 | 지연 예산의 측정 지점 | 격리 대상이 코드에만 있어 이벤트 루프 지연의 원인을 추적할 수 없다 |

- 검산: 변경 유형 = **5**

## 관련 문서

- [01_system_architecture.md](./01_system_architecture.md) — 아키텍처 불변식 표
- [09_decision_records.md](./09_decision_records.md) — ADR-06 · ADR-07 · ADR-08 · ADR-10 · ADR-11 · ADR-22 · ADR-25
- [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) — 도메인 ↔ 모듈 · 경계 유형 · 간선 검산
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-NN 채번 정본
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — REQ-GLB-03 · 04 · 20 · 21
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — 알람 판정 기전
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 키 계열별 래퍼
