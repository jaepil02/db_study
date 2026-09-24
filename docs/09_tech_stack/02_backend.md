# 백엔드 스택

> **대상**: api 컨테이너의 런타임 구성 — NestJS + Fastify 어댑터 · 단일 런타임(ADR-01) · 모듈 11과 라이브러리 배정 · 데이터 평면 라이브러리(@clickhouse/client · ioredis · pg · modbus-serial · jsmodbus · msgpackr · piscina · prom-client)의 역할과 사용 제약 · piscina 워커 풀(ADR-25) · 스위치 11종의 환경변수와 DI 주입(ADR-08) · 스위치 밖 환경변수의 백엔드 쪽 읽기 규칙 · 요청 압축 · 보안 헤더
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 비밀 환경변수 이름 · 해시 알고리즘 · 레이트 리밋 등급 미설계 3항목 닫힘(정본 12_security/01 · 02 · 03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 실험 자리 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §2 · §3 · §3.1 · §3.3 · §5.2 · §5.3 · §6 · §9 · §10.4 · §12(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §4.3(커밋 ff66a37) · ADR-01 · ADR-04 · ADR-08 · ADR-13 · ADR-19 · ADR-22 · ADR-25 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)(스위치 이름 정본) · [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)(포트 · 구현 이름 정본) · [04_local_environment.md](./04_local_environment.md)(환경변수 정본)

백엔드는 **NestJS 단일 애플리케이션 하나**다 — 제어 평면 6 · 데이터 평면 4 · 관측 1의 11모듈이 api 컨테이너 한 프로세스에 산다(ADR-01 · 루트 README 고정 기준 도메인). 2축 구분은 런타임이 아니라 모듈 경계(Redis Stream)로 남는다. 결정과 버린 대안은 ADR-01이 갖고, 비교 표 · 감수 비용 · 전환 조건의 근거 상세는 [06_decisions_rationale.md](./06_decisions_rationale.md)가 갖는다.

이 문서는 **라이브러리를 어느 모듈이 어떤 제약으로 쓰는가**를 고정한다. 버전은 적지 않는다 — Node 런타임을 포함한 정확 버전의 정본은 [03_data_infra.md](./03_data_infra.md) §버전 고정표다([../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) Compose 서비스 표의 api 행이 가리키는 "정확 버전"도 그 표다).

**라이브러리 선택은 학습 목표의 계측 가능성에 종속된다.** 드라이버 · 직렬화 · 워커 풀은 성능 실험의 측정 대상 경로에 앉는다. 그래서 각 라이브러리 행은 "무엇을 하느냐"가 아니라 **"어떻게 쓰면 측정이 오염되는가"**로 끝난다.

## 런타임과 HTTP 계층

| 구성 | 선택 | 제약 | 어기면 |
|------|------|------|------|
| 런타임 | Node LTS(단일 메이저 · 호스트와 동일) | zstd 요청 압축을 쓰려면 고정표의 부 버전 하한을 지킨다 | 호스트 테스트와 컨테이너가 다른 런타임에서 돌아 재현성이 깨진다(REQ-TEC-04) |
| 프레임워크 | NestJS — 모듈 · DI | 모듈 = 도메인 1:1([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)) · 스위치는 DI 주입(ADR-08) | 모듈 경계가 도메인과 어긋나면 APP_ROLE 배정이 기능 단위로 쪼개진다 |
| HTTP 어댑터 | Fastify 어댑터 | 기본 Express 어댑터를 쓰지 않는다 | 원본 비교의 HTTP 처리량 근거(원본 예상치)가 전제를 잃는다 — 제어 평면 오버헤드가 커져 조회 p95에 프레임워크 비용이 섞인다 |
| WebSocket | Nest 게이트웨이 + 네이티브 ws 어댑터 | Socket.IO 어댑터를 쓰지 않는다(ADR-02 파급 · 원본 tech_stack.md §13) | 자체 프로토콜 프레임이 고빈도 푸시마다 붙는다 |
| 보안 헤더 | Fastify용 helmet 계열 플러그인 · HSTS만 끔 | TLS가 없으므로 HSTS를 켜지 않는다(원본 tech_stack.md §10.4) | HSTS를 켜면 브라우저가 localhost를 https로 올려 개발 서버가 닿지 않는다 |
| 레이트 리밋 | Redis rl 키 · 사용자 · 토큰 기준 · Lua 원자 증가 | IP 기준 제한 금지 — 모든 요청이 127.0.0.1에서 온다 | IP 기준이면 모든 사용자가 한 버킷을 나눠 k6 부하가 사람의 요청을 429로 만든다 |

- 검산: 구성 = **6**
- CORS · 보안 헤더 · 레이트 리밋 · Origin 검증은 전부 NestJS가 처리한다 — 앞단 프록시가 없어 대신할 계층이 없다(원본 tech_stack.md §10.4). 등급 이름 · 한도의 정본은 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)(W7)다.

## 모듈과 라이브러리 배정

모듈 11의 이름과 평면은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §리포지터리 구조가 정본이다. 이 표는 모듈마다 **측정 경로에 앉는 라이브러리**만 적는다.

| 모듈 | 평면 | 저장소 클라이언트 | 프로토콜 · 직렬화 | 워커 풀 | APP_ROLE(ADR-22) |
|------|------|------|------|------|------|
| auth | 제어 | pg · ioredis(auth · sess · rl 래퍼) | 해당 없음 | 없음 | api |
| master | 제어 | pg · ioredis(cache 래퍼 · ch 발행) | 해당 없음 | 없음 | api |
| work-orders | 제어 | pg · ioredis(cache 래퍼) | 해당 없음 | 없음 | api |
| alarms | 제어 | pg · @clickhouse/client · ioredis(alarm 래퍼) | 해당 없음 | 없음 | api · worker |
| timeseries | 제어 | @clickhouse/client · ioredis(cache · lock 래퍼) | gzip(조회 캐시) | LTTB · gzip | api |
| realtime | 제어 | ioredis(rt 래퍼 · ch 구독) · @clickhouse/client(SW-02 off) | WebSocket 프레임 | 없음 | api |
| collector | 데이터 | ioredis(stream · rt 래퍼) | modbus-serial · msgpackr | 대량 인코딩 | collector |
| plc-sim | 데이터 | 없음 | jsmodbus 서버 | 없음 | collector |
| ingest | 데이터 | ioredis(stream · rt 래퍼) · @clickhouse/client · pg + pg-copy-streams(SW-09) | msgpackr 해제 | 해제 · 행 전개 | worker |
| datagen | 데이터 | ioredis(stream 래퍼) · @clickhouse/client(모드 D) | msgpackr | 신호 벡터 생성 · 인코딩 | datagen · collector · api |
| metrics | 관측 | 세 저장소 통계 조회(api 역할 한 곳) | prom-client 텍스트 | 없음 | 전 역할 |

- 검산: 모듈 = 제어 6 + 데이터 4 + 관측 1 = **11**
- **ioredis는 모듈이 직접 부르지 않는다 — 키 계열별 래퍼 3종만 부른다**(ADR-13). 표의 괄호가 그 래퍼가 여는 접두다. 래퍼 경계의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다.
- **worker 풀 열의 격리 대상 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §worker_threads 격리 대상이다.** 이 표는 인용이다.
- APP_ROLE 열이 여럿인 모듈(alarms · datagen · metrics)은 역할마다 켜는 기능이 다르다 — 기능 선택은 모듈 초기화가 한다.

## 데이터 평면 라이브러리

원본 tech_stack.md §2 · §12의 "Node 데이터 평면 라이브러리" 7종 + 원본 고정표의 pg + 원본 미기재 1종(pg-copy-streams)이다. 버전은 [03_data_infra.md](./03_data_infra.md) §버전 고정표에 있다.

| 라이브러리 | 역할 | 사용 제약 | 제약을 어기면 — 측정 오염 |
|------|------|------|------|
| @clickhouse/client | ClickHouse HTTP 클라이언트(8123 전용) | 삽입 형식 JSONCompactEachRow + 요청 압축 · 배치마다 insert_deduplication_token(SW-08) · 네이티브 9000을 쓰지 않는다 | 행 단위 삽입이면 파트가 폭증해 파트 수 실험이 배치 정책이 아니라 호출 방식을 잰다 |
| ioredis | Streams · Pub/Sub · Lua · 파이프라인 | 구독 전용 연결을 명령 연결과 가른다 · 블로킹 XREADGROUP은 컨슈머마다 전용 연결 | 블로킹 읽기와 명령이 한 연결을 쓰면 캐시 조회가 XREADGROUP 블록 시간만큼 줄을 선다 |
| pg | in-process 풀(ADR-19) | 업무 풀과 대조군 전용 커넥션 1개를 가른다 · 풀 크기는 05_data_stores/02 소유 | 대조군 COPY가 업무 풀을 잡아 CRUD p95에 대조 실험이 섞인다 |
| pg-copy-streams | 대조군 COPY(SW-09 on) | 대조군 전용 커넥션에서만 · 원본 미기재 신설 | 행 단위 INSERT로 대신하면 대조군 삽입 축이 COPY가 아니라 INSERT 비용을 재 ClickHouse 배치 삽입과 조건이 달라진다 |
| modbus-serial | Modbus TCP 클라이언트(Collector) | 설비당 커넥션 1 · FC03 요청당 125 레지스터 상한 · 연속 주소 블록 병합 | 블록 병합 없이 태그마다 요청하면 요청 수가 태그 수만큼 늘어 Modbus 구간 지연이 주소 배치를 잰다 |
| jsmodbus | Modbus TCP 서버 시뮬레이터(PlcSim) | 설비 1 = 루프백 포트 1(5020~5119) · 레지스터 Buffer를 런타임 갱신 | 포트를 publish하면 시뮬레이터가 루프백 밖에 노출된다(ADR-18) |
| msgpackr | Stream 페이로드 직렬화 | 스캔 사이클 단위 컬럼 배열(ADR-04) · 스키마 버전 필드 v · 대량이면 워커에서 | JSON으로 대신하면 페이로드가 커져 MAXLEN × 엔트리 크기 산정(05_data_stores/06)이 깨진다 |
| piscina | worker_threads 풀(ADR-25) | §워커 풀 | §워커 풀 |
| prom-client | /metrics 텍스트 노출 | 기본 메트릭(이벤트 루프 지연 · 힙 · GC) 켬 · 스크레이프가 저장소를 조회하지 않는다(07_api/10) | 스크레이프마다 저장소를 조회하면 관측 프로파일 on/off가 저장소 부하를 바꾼다 |

- 검산: 라이브러리 = 원본 7(@clickhouse/client · ioredis · modbus-serial · jsmodbus · msgpackr · piscina · prom-client) + pg + pg-copy-streams = **9**
- **pg는 원본 고정표의 "pg + Prisma" 행에서 pg만 남은 것이다.** Prisma는 마이그레이션 도구 판정에서 채택하지 않았다([05_tooling_devops.md](./05_tooling_devops.md) §마이그레이션 도구 판정). 쿼리 계층은 pg 풀 하나다 — ORM 쿼리 빌더가 업무 CRUD p95에 들어가면 대조 · 목표 ② 측정의 PostgreSQL 쪽 비용에 ORM 비용이 섞인다.
- **Modbus 두 라이브러리는 서로를 검증하지 않는다.** 같은 언어 · 같은 프로세스라 해석 오류가 양쪽에 같게 들어갈 수 있다 — 교차 검증은 언어 무관 보조 시뮬레이터(diagslave · ModbusPal)로 한다(원본 tech_stack.md §6 · [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md)). 보조 도구는 기능이 아니며 버전 고정 대상도 아니다.

### 요청 압축

| 경로 | 압축 | 조건 | 미지원 · 실패 시 |
|------|------|------|------|
| Ingest → ClickHouse 삽입 | zstd 요청 압축 · 대안 gzip | 런타임 부 버전 하한 · 클라이언트의 zstd 지원(미확인) | gzip — 둘 중 무엇을 썼는지 기록 조건 칸에 적는다 |
| 조회 캐시 값(cache:q) | gzip | 워커 풀에서 압축 · 해제(ADR-25) | 해당 없음 |

- 검산: 경로 = **2**
- **B형 — 압축 방식이 바뀌면 삽입 처리량 실험은 다른 조건이다.** 결론 — zstd와 gzip은 CPU 비용 · 압축률이 달라 같은 배치 크기에서 삽입 처리량이 다르게 나온다. 반대 시나리오 — 클라이언트가 zstd를 지원하지 않아 조용히 gzip으로 돌면 "zstd 기준"으로 적은 기록이 gzip 수치가 된다. 파생 지침 — 압축 방식은 기동 시 확정해 로그와 기록 조건에 남기고, 원본의 "Arrow · Parquet 직삽입 부재"의 손실은 배치 크기로 흡수한다(ADR-01 감수 비용).

## 워커 풀

ADR-25의 결정 아래 piscina 풀의 운용 규칙이다. **워커 수의 값은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)가 소유한다**(현행 참고 부하 실험 2 · 개발 1). 주입 환경변수 이름은 [04_local_environment.md](./04_local_environment.md) §환경변수다.

| 규칙 | 내용 | 근거 | 어기면 |
|------|------|------|------|
| 풀 하나 | 프로세스당 piscina 풀 1개를 모듈이 공유 | 워커 수가 곧 CPU 바운드 동시성의 상한 | 모듈마다 풀을 만들면 워커 수 합이 프로파일 값을 넘어 이벤트 루프와 CPU를 다툰다 |
| 격리 기준 | 입력 크기에 비례해 동기 CPU 시간이 느는 작업만 | ADR-25 | IO 바운드를 워커로 보내면 스레드 간 복사가 이득보다 크다 |
| 전달 형식 | 대량 배열은 전송 가능 버퍼로 넘긴다 | 복사 대신 소유권 이전 | 구조화 복제가 배열을 복사해 워커 이득이 사라지고 메모리가 이중 점유된다 |
| 계측 | 대기열 길이 · 작업 시간 · 이벤트 루프 지연을 /metrics로 | 이벤트 루프 지연이 역할 분리 진입 조건(ADR-25) | 워커 포화와 루프 지연을 가를 수 없다 — 역할 분리 판단 근거가 사라진다 |
| 워커 수 비교 | S1에서 워커 1 · 2 · 4를 비교(GEN-09) | 04_architecture/03 | 워커 수가 기록에 없으면 생성기 처리량 기준선이 워커 수와 섞인다 |

- 검산: 규칙 = **5**
- **워커도 같은 컨테이너 CPU를 쓴다.** 격리는 이벤트 루프를 지킬 뿐 CPU 경합을 없애지 않는다 — 경합이 조회 p95에 나타나는 시점이 역할 분리의 실측 근거다(ADR-25 파급).

## 스위치 환경변수와 DI 주입

스위치 11종의 이름 · 기본값 · 값 형식은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)가 정본이고, 포트 · 구현 이름은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §포트 · 구현 이름 확정 표가 정본이다. 이 표는 두 정본을 **백엔드가 환경변수를 읽어 구현을 주입하는 순서**로 묶은 인용이다.

| 스위치 | 환경변수(02_features/13) | 포트(04_architecture/02) | 주입받는 모듈 |
|------|------|------|------|
| SW-01 | REDIS_STREAM_BUFFER | PointBufferPort | collector · datagen |
| SW-02 | REDIS_LATEST_CACHE | LatestValueReadPort | realtime |
| SW-03 | REDIS_QUERY_CACHE | TimeseriesCachePort | timeseries |
| SW-04 | CACHE_KEY_TIME_SNAP | CacheKeyNormalizerPort | timeseries |
| SW-05 | CACHE_STAMPEDE_LOCK | RebuildLockPort | timeseries |
| SW-06 | REDIS_PUBSUB_FANOUT | RealtimeFanoutPort | ingest · alarms |
| SW-07 | WS_THROTTLE_MS | FrameThrottlePort | realtime |
| SW-08 | INGEST_IDEMPOTENCY | BatchTokenPort | ingest |
| SW-09 | CONTROL_TABLE_ENABLED | ControlTableSinkPort | ingest |
| SW-10 | COLLECTOR_DEADBAND | DeadbandFilterPort | collector |
| SW-11 | LATEST_VALUE_WRITER | LatestValueWritePort | ingest · collector |

- 검산: 스위치 행 수는 정본(02_features/13)을 다시 세지 않는다 — 이 표는 정본의 행을 하나씩 옮긴 인용이며 정본에 행이 늘면 이 표도 같은 변경 단위에서 는다
- 주입 절차는 아래 순서다.

```plain
① 환경변수 읽기        기동 시 1회 · 허용값 검증(불리언 · 밀리초 · ingest/collector)
② 구현 선택            포트마다 구현 둘 중 하나 — SW-07은 0이면 통과 구현 · 0 초과면 병합 구현에 창 크기 주입
③ 경고                 SW-01 off면 부팅 경고를 로그와 상태에 남긴다
④ 상태 확정            주입된 구현 이름을 OBS가 읽을 수 있는 자리에 등록
⑤ 노출                 health switches · /metrics 레이블은 ④에서 거꾸로 읽는다 — 환경변수 문자열을 옮기지 않는다
```

- **②에 경로 안 분기가 없다.** 선택은 모듈 초기화에서 한 번만 한다 — 조회 경로에 if를 두면 분기 자체가 측정 대상 코드에 섞인다(ADR-08).
- **허용값 밖 값은 기본 구현으로 주입된다.** 그리고 ⑤가 실제 구현을 보여 준다 — 환경변수와 health가 다르게 보이는 것은 버그가 아니라 오타의 표지다(07_api/10 A형). 스위치가 아닌 환경변수(APP_ROLE 등)는 허용값 밖이면 기동을 거부한다 — 규칙의 정본은 [04_local_environment.md](./04_local_environment.md) §환경변수다.
- **④ · ⑤가 같은 커밋에 있어야 한다.** 스위치와 그 계측을 같은 커밋에서 만든다(02_features/13 공통 규칙) — 계측 없는 스위치는 장식이다.

## 스위치 밖 환경변수의 백엔드 읽기

환경변수 이름 · 값 · 기본의 정본은 [04_local_environment.md](./04_local_environment.md) §환경변수다. 이 표는 백엔드가 그 값으로 **무엇을 결정하는가**만 적는다.

| 계열 | 백엔드가 결정하는 것 | 결정 시점 | 노출 |
|------|------|------|------|
| 기동 역할 | 초기화할 모듈 · 기능 범위(ADR-22) | 부트스트랩 | health · 로그 |
| 부하 주입 게이트 | 모드 C 라우트 등록 여부 — 꺼지면 라우트 자체가 없다 | 라우트 등록 | 스위치 목록에 넣지 않는다(07_api/09) |
| 측정 조건 3 | health run 필드 값 — 모르면 null | 부트스트랩 | health run(07_api/10) |
| 워커 풀 크기 | piscina 풀 크기 | 부트스트랩 | /metrics |
| SIM 주입 계획 | 계획 파일 검증 · 적용 일정 | 부트스트랩 | health · 메트릭(06_pipeline/10) |
| 저장소 접속 | 세 클라이언트의 접속 대상 | 부트스트랩 | 노출하지 않는다 — 비밀 |

- 검산: 계열 = **6**
- **라우트가 없는 것과 403은 다르다.** 게이트가 꺼진 모드 C 표면은 404다 — 403은 역할을 바꾸면 풀린다는 오해를 부른다(07_api/09).
- memoryLimitMb는 환경변수가 아니라 cgroup에서 읽는다 — 이 표에 없다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| @clickhouse/client의 zstd 요청 압축 지원 | 신규 미확인 — 원본은 "zstd 또는 gzip"(런타임 하한은 버전 고정표) | 착수 시 공식 참조 · [03_data_infra.md](./03_data_infra.md) |
| HTTP 처리량 비교(Fastify 대 대안) | 원본 예상치만 — 미확인 · 확정 전 임의 값 고정 금지 | [06_decisions_rationale.md](./06_decisions_rationale.md) · **W6 미채번** — 프레임워크 교체 비교는 실험 카탈로그 밖 · 이 스택의 HTTP 상한은 EXP-22 · EXP-37 |
| 워커 수별 생성기 처리량 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | S1 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 비밀 환경변수 이름 · 비밀번호 해시 알고리즘 | **W7 닫힘** — 비밀 9 이름은 [04_local_environment.md](./04_local_environment.md) §환경변수 · 알고리즘 Argon2id(라이브러리 행은 [03_data_infra.md](./03_data_infra.md) 버전 고정표) | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) · [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) |
| 레이트 리밋 등급 이름 · 한도 | **W7 닫힘** — class general · bulk_read · export · bulk_ingest · 한도는 관계식 고정 · 값 2계층 미정 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |

## 관련 문서

- [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) — 모듈 경계 · APP_ROLE · 워커 격리 대상 · 포트 이름 정본
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 정본
- [04_local_environment.md](./04_local_environment.md) — 환경변수 정본
- [03_data_infra.md](./03_data_infra.md) — 버전 고정표
- [06_decisions_rationale.md](./06_decisions_rationale.md) — NestJS 선정 근거 · 감수 비용 · 전환 조건
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-01 · ADR-08 · ADR-25
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health switches · run
