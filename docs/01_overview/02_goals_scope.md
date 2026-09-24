# 목표와 범위

> **대상**: 전원 — db_study가 무엇을 만들고 무엇을 만들지 않는가, 그리고 만들지 않는 것이 측정에 남기는 한계
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — SW-11 LATEST_VALUE_WRITER 신설 반영(D-13 · 사용자 확정) — 스위치 10 → **11**
> **원천**: 원본 tech_stack.md §1 · §3.4 · §10.6 · §13(커밋 ff66a37) · 원본 architecture.md §2 · §17 · §18 · §19(커밋 ff66a37) · 원본 implementation_plan.md §2(커밋 ff66a37) · [06_design_decisions.md](./06_design_decisions.md) D-01 · D-02 · D-11 · [../README.md](../README.md) 고정 기준 · 전역 불변식

db_study의 범위는 **학습 목표 2축(D-01)을 측정으로 닫는 데 필요한 것**으로 정해진다. 기능이 많아서 들어오는 것도, 현실적이어서 들어오는 것도 없다 — 두 축 중 하나의 비교 수치를 만드는 데 기여하거나, 그 비교가 성립하기 위한 전제(수집 경로 · 계측 · 롤백)이거나, 로컬이어도 생략하면 안 되는 방어선이면 In이다.

**제외는 공짜가 아니다.** 로컬 단일 머신(D-02)이라는 선택은 부하 생성기 격리 · 수평 확장 효과 · 실제 망 지연 같은 측정을 불가능하게 만든다. 이 문서는 그 한계를 누락이 아니라 **기록된 상태**로 남기고, 잔여가 어느 문서에 담기는지 가리킨다.

## 범위 판정 기준

새 항목이 범위에 드는지는 아래 순서로 판정한다. 먼저 걸리는 질문이 판정을 끝낸다.

```plain
새 항목
├─ 학습 목표 ① 또는 ②의 비교 수치를 만드는가 ─────────────── 예 → In
├─ 그 비교가 성립하기 위한 전제인가(수집 경로 · 계측 · 롤백) ── 예 → In
├─ 로컬이어도 생략하면 안 되는 방어선인가(인가 · 검증 · 감사) ── 예 → In
├─ 실측 진입 조건이 붙은 확장인가 ────────────────────────── 예 → 조건부
├─ 머신 하나로 검증할 수 있는가 ───────────────────────────── 아니오 → Out
└─ 그 밖 ──────────────────────────────────────────────────────── Out(비목표)
```

- **"있으면 좋은 기능"은 판정 트리 어디에도 걸리지 않는다.** 서비스 완성도는 판정 질문이 아니다 — 그래서 상용 MES/SCADA 수준 기능은 구현 비용과 무관하게 Out이다.
- **검증할 수 없는 확장은 조건부가 아니라 Out이다.** 진입 조건이 영영 충족될 수 없는 단계를 조건부로 남기면 로드맵이 장식이 된다(원본 architecture.md §19).
- **방어선 질문은 로컬 전용보다 먼저 온다.** 외부에서 도달할 수 없다는 사실이 인가 검사나 입력 검증을 생략할 이유가 되지 않는다(전역 불변식 "로컬 전용").

## In 범위

| 영역 | 포함하는 것 | 판정 근거 | 정본 |
|------|------|------|------|
| 도메인 기능 | 11도메인의 기능 전수 — NestJS 모듈과 1:1 | 수집 · 적재 · 조회 · 알람 · 업무 CRUD가 분기 3계층의 실제 원천이다 | [04_domain_map.md](./04_domain_map.md) · [../02_features/README.md](../02_features/README.md) |
| 저장소 | PostgreSQL 18 · ClickHouse 25.8 · Redis 8(단일 인스턴스) + **PostgreSQL 대조군 테이블** | 목표 ①의 비교 상대와 목표 ②의 세 목적지 | [../05_data_stores/README.md](../05_data_stores/README.md) · D-05 |
| 3계층 분기 | 원시값 · 알람과 실적 · 업무 CRUD의 목적지 판정과 기전 | 목표 ②의 대상 그 자체 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) · D-04 |
| 데이터 흐름 | F-01~F-10(수집부터 백프레셔와 장애까지) | 분기가 일어나는 경로와 degrade 경로 | [../06_pipeline/01_flow_inventory.md](../06_pipeline/01_flow_inventory.md) |
| 역할 스위치 | SW-01~SW-11과 그 계측 | 두 축의 공통 손잡이 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · D-06 |
| 테스트 데이터 | 신호 프로파일 · 주입 모드 A~D · 시드 고정 · 백필 · 품질 코드 SIMULATED | 실장비가 없으므로 **생성기의 품질이 곧 실험의 품질**이다 | [../02_features/05_datagen.md](../02_features/05_datagen.md) |
| 부하 · 장애 실험 | k6 부하 시나리오 · 장애 주입 · 실험 기록 | 병목과 축출 연쇄를 재현한다 | [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 화면 | 실시간 대시보드 · 트렌드 분석 · 알람 콘솔 · 관리 화면군 · 실험 콘솔 | 측정 결과와 분기 결과를 사람이 보는 자리 | [../08_screen/README.md](../08_screen/README.md) |
| 관측 | /metrics 단일 노출 · 저장소 메트릭 수집 · 선택 기동 observability 프로파일 | 계측 없는 스위치는 장식이다 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 실행 구성 | Docker Compose 컨테이너 4개 + 호스트 웹 · 127.0.0.1 바인드 · named volume · 스냅샷과 복원 | 같은 초기 상태에서 반복해야 비교가 성립한다 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) · D-02 |
| 애플리케이션 방어선 | 인증 · 역할 기반 인가 · CORS 단일 오리진 · 레이트 리밋 · WebSocket Origin 검증 · 파라미터 바인딩 · 감사 로그 | 앞단 프록시가 없어 **이 계층을 대신할 곳이 없다** | [../12_security/README.md](../12_security/README.md) |

## 조건부 범위

설계는 하되 **실측이 진입 조건을 충족할 때만** 실행하는 항목이다. 진입 조건 없이 앞당기지 않는다 — 추측으로 단계를 앞당기면 무엇이 병목이었는지 배울 수 없다(원본 tech_stack.md §1 설계 원칙 4).

| 항목 | 진입 조건(원본 서술) | 실행 전까지의 상태 | 정본 |
|------|------|------|------|
| 확장 1단계 — APP_ROLE 역할 분리 | api 이벤트 루프 지연이 임계를 넘거나 수집량 상승에 비례해 조회 p95가 악화됨 | 코드는 분리 가능하게 쓰되(Stream 경계) 기동은 all | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |
| 확장 2단계 — api 다중 인스턴스 · PgBouncer | api 역할 컨테이너 CPU 사용률이 임계에서 지속 | ch:cacheinv 채널만 존재 · 구독자 1 | 상동 |
| 확장 3단계 — Redis 인스턴스 분리 | 캐시 히트율이 스트림 길이와 역상관을 보이며 임계 아래로 내려감 | 키 접두로 생존 정책을 가르는 단일 인스턴스 | 상동 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| 확장 4단계 — Kafka 전환 | Redis 메모리로 보존 기간을 감당할 수 없거나 재처리 요구 발생 | Ingest 소스 인터페이스만 추상화 | 상동 |
| Python 데이터 평면 분리 | 생성기 처리량 미달 · 시뮬레이터 기능 부족 · Arrow 직삽입 필요 중 하나가 실측됨(원본 tech_stack.md §3.4) | 데이터 계약을 Stream 페이로드 하나로 고정 | [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) |
| 중간 메모리 프로파일 | WSL2 메모리 상향이 불가능할 때(원본 implementation_plan.md §2.3) | 부하 실험 프로파일을 쓴다 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| E2E 분산 추적 | 부하 측정 단계의 선택 항목 | observability 프로파일 구성원 판정에 따른다 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |

- 진입 조건의 임계 수치는 원본이 적었지만 4 vCPU급 가정의 값이라 **이 머신에서는 미확인**이다. 임계의 정본은 [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md)가 갖는다.

## Out 범위 · 비목표

| 항목 | 판정 | 근거 | 되살아나는 조건 |
|------|------|------|------|
| 상용 MES/SCADA 수준의 기능 완성도 | 비목표 | 기능 완성도는 범위 판정 질문이 아니다(원본 tech_stack.md §1) | 없음 — 학습 시스템의 성격이 바뀌어야 한다 |
| 고가용성 · 이중화 | 비목표 | api 단일 실패점은 **알고 받는 대가**이며 역할 분리의 진입 근거로 쓴다(원본 architecture.md §17) | 없음 — 머신 하나로 검증할 수 없다 |
| 배포 · 공개 호스트 | Out | 로컬 전용 전환(D-02) | 없음 |
| 원격 접속 | Out | 사용자는 모두 같은 머신의 브라우저로 localhost:3001에 접속한다(원본 architecture.md §2) | 없음 |
| TLS · HSTS | Out | http · ws만 쓴다. 쿠키 Secure를 끄고 httpOnly는 유지한다 | 배포가 생길 때만 — 현재 없음 |
| 클러스터(ClickHouse 샤딩 · 복제 · PostgreSQL 읽기 복제본) | Out | 로드맵에서 **삭제된 단계**다. 검증할 수 없는 단계는 장식이다(원본 architecture.md §19) | 없음 |
| 실장비 연결 | Out(현 시점) | 실 PLC 접속 불가 → 시뮬레이터와 생성기로 대체(원본 tech_stack.md §1) | 실장비 접속이 가능해질 때 — 수집 모듈 접속 대상만 바뀐다 |
| OPC UA 등 Modbus 외 프로토콜 | Out | 현장 요구는 Modbus다(원본 tech_stack.md §13) | 수집 모듈 어댑터 추가로 대응 |
| Kubernetes · 오케스트레이션 | Out | 단일 머신에 과잉 | 없음 |
| 관리형 DB 서비스 | Out | 파라미터 튜닝 제약 — DB 내부 동작 학습이 목적이다 | 없음 |
| 로드 밸런서 | Out | 확장 2단계도 각 인스턴스에 직접 접속해 Pub/Sub 전파만 확인한다 | 없음 |
| 관측 스택 상시 기동 | Out | 측정 대상과 같은 CPU를 쓴다 — 선택 프로파일로만 띄운다 | 없음 |
| 실데이터와 생성 데이터의 혼합 | Out | 섞인 뒤에는 구분할 방법이 없다(전역 불변식 "생성 데이터 구분") | 실장비 연결 시 별도 판정 |

## 비목표로 오해되는 In 항목

로컬 전용 · 학습용이라는 성격 때문에 빠져도 된다고 오해되기 쉬운 것들이다. 전부 In이다.

| 오해 | 실제 | 빠지면 생기는 실패 |
|------|------|------|
| 로컬이니 인가 검사는 생략해도 된다 | In — 역할 기반 인가를 엔드포인트마다 검사한다 | 인가를 우회하는 경로가 생기고, 확장 2단계에서 인스턴스가 늘 때 방어선을 새로 써야 한다 |
| 로컬이니 레이트 리밋이 필요 없다 | In — 사용자 · 토큰 기준(IP 기준은 무의미) | 모든 요청이 127.0.0.1에서 오므로 IP 기준 제한은 전원을 한 사용자로 본다 |
| 학습용이니 감사 로그는 장식이다 | In — 업무 데이터 변경의 before · after | ③계층의 트랜잭션 경계(업무 쓰기와 감사 쓰기를 한 트랜잭션에)를 시연할 대상이 사라진다 |
| 업무 CRUD는 Redis 학습 가치가 없으니 생략한다 | In(후순위) — 시연 최소분 필수(D-11) | ③계층이 비어 "경로를 고르지 않는 분기"의 반례가 사라진다 |
| 백업이 없으니 롤백도 없다 | In — 스냅샷과 복원 | 같은 초기 상태에서 반복할 수 없어 on/off 비교가 성립하지 않는다 |
| 부하 주입 표면은 테스트 코드다 | In — /api/v1/ingest/bulk(기본 비활성) | 주입 모드 C(HTTP 계층 포함 수집 상한)를 잴 수 없다 |

## 로컬 전용이 뒤집은 설계 판단

D-02는 범위를 줄이기만 한 것이 아니라 공개 호스트 전제의 판단 몇 개를 **반대로** 바꿨다. 바뀐 판단을 옛 전제로 되돌리면 학습 수단이 사라지거나 불필요한 계층이 측정에 섞인다.

| 판단 | 공개 호스트 전제 | 로컬 전용에서 | 바뀐 근거(원본) |
|------|------|------|------|
| 저장소 포트의 호스트 공개 | 금지 | **127.0.0.1에 공개** — psql · clickhouse-client · redis-cli로 직접 붙는다 | 저장소 상태를 손으로 확인하는 것이 학습 수단이다(원본 tech_stack.md §10.4) |
| Docker 네트워크 | 이중 네트워크 분리 | 기본 브리지 1개 · 서비스명 DNS | 이중 분리는 공인 IP 호스트 전제라 로컬에서 의미가 없다(원본 tech_stack.md §10.1) |
| 쿠키 Secure · HSTS | 켠다 | 끈다 — httpOnly는 유지한다 | TLS가 없다. localhost 포트가 달라도 same-site라 SameSite=Lax가 그대로 동작한다 |
| 레이트 리밋 기준 | IP | 사용자 · 토큰 | 모든 요청이 127.0.0.1에서 온다 |
| 백업 | 원격 보관 | PostgreSQL pg_dump만 로컬 snapshots에 · ClickHouse와 Redis는 백업하지 않는다 | 시계열은 생성기로 재생성하고 Redis는 재생 가능한 버퍼와 휘발 캐시다(원본 architecture.md §18) |
| CI | 필수 | 선택 — pre-commit 품질 게이트가 같은 명령을 돈다 | 배포가 없다(원본 tech_stack.md §11) |
| 웹 실행 | 컨테이너 | 호스트 프로세스 | HMR이 컨테이너 안에서 느리고 불안정하다(원본 architecture.md §3) |

## 제외가 만드는 한계와 잔여

제외한 것이 측정에서 무엇을 막고 무엇을 못 막는지 등재한다. **"아무도 책임지지 않는다"를 누락이 아니라 기록된 상태로 만든다.**

| 항목 | 만든 제외 | 막는 것과 못 막는 것 | 잔여가 담기는 곳 |
|------|------|------|------|
| 부하 생성기 격리 | 다중 머신(D-02) | cpuset 분리로 CPU 집합 겹침은 막는다. **메모리 대역폭 · L3 캐시 공유와 코어 종류(P · E) 비보장은 못 막는다** | [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) · 3회 중앙값 규칙(D-10) |
| 관측 스택 격리 | 다중 머신 | 선택 프로파일로 기본 기동에서 뺀다. 켠 동안의 CPU 공유는 못 막는다 — 그 수치는 상대 비교용이다 | 상동 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 실제 망 지연 | 원격 접속 · 다중 머신 | 없음 — 전 구간이 루프백 · Docker 브리지다. E2E 지연은 **낙관적으로** 나오고 mirrored 모드에서 한 단계 더 짧다 | [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |
| 수평 확장 효과 | 클러스터 · 다중 머신 | 인스턴스를 늘려도 같은 CPU를 나눈다. 확장 실험의 목표는 처리량이 아니라 **동작 검증**(팬아웃 · 랙 회수)이다 | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |
| 가용성 | 고가용성 | 없음 — api 중단은 조회와 수집을 함께 멈추고, 재빌드마다 결측 구간이 생긴다. 결측은 장애가 아니라 재빌드 흔적으로 기록한다 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 실장비 특성 | 실장비 연결 | 시뮬레이터로 지연 · 오류를 주입한다. **실 PLC의 응답 지터 · 통신 노이즈 · 워드 순서 혼재는 재현하지 못한다** | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) · 품질 코드 SIMULATED |
| 디스크 IOPS | 관리형 · 클라우드 스토리지 | 로컬 NVMe는 IOPS를 프로비저닝할 수 없다 — 디스크를 상수로 두고 배치 · 머지 설정만 변수로 둔다 | [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |
| 메모리 총량 | 다중 머신 | 머신 RAM이 고정이다. 상위 용량 티어는 머신 사양에 종속된다 | [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| 네트워크 경계 방어 | 배포 · TLS | 127.0.0.1 바인드가 LAN 노출을 막는다. **같은 머신의 다른 프로세스는 못 막는다** | [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) · [../12_security/04_threat_model.md](../12_security/04_threat_model.md) |
| 성능 목표치의 비교 가능성 | 원본 가정 머신(4 vCPU · 32 GB) | 원본 목표치를 그대로 합격선으로 쓰지 않는다. 이 머신의 첫 실행이 기준선이다 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) |

## 범위 경계에 걸친 항목

| 항목 | 판정 | 이유 |
|------|------|------|
| /api/v1/ingest/bulk | In — **기본 비활성** · 환경변수로만 켠다 | 부하 주입 모드 C의 표면이다. 소유는 GEN이다(docs_plan 보정 #11) |
| SW-01 off(Stream 경계 우회) | In — **실험 전용** · 기본 on · 부팅 경고 | 원칙을 우회하는 경로가 아니라 원칙을 증명하는 경로다 |
| 대조군 plc_tag_raw_control | In — 기본 off | 중복 저장이 아니라 실험 계측물이다(D-05) |
| 확장 로드맵의 단계 설계 | 설계는 In · 실행은 조건부 | 1단계가 가장 싸도록 경계를 미리 지불해 둔다 |
| 알람 규칙 관리 화면 | In | 규칙 변경 → 캐시 즉시 무효화 경로가 목표 ②의 캐시 역할과 만난다 |
| 생산 카운터의 분기 | In — 기전 미설계 | 분기 ②계층의 데이터다. 원본에 기전이 없어 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4)가 확정한다 |
| 외부 알림 채널(메일 · 메신저) | Out — 원본에 없음 | 알림 규칙은 관측 스택 내부 판정까지만 서술된다 |
| 문서군 린트의 Taskfile 편입 | 코드 착수 항목 | 문서군 산출물은 코드가 아니다(docs_plan 보정 #9) · [05_priorities_roadmap.md](./05_priorities_roadmap.md) |

## 범위 변경 절차

| 변경 | 같은 변경 단위에서 고치는 곳 | 어기면 |
|------|------|------|
| In 항목 추가 | 이 문서 In 표 · 해당 폴더 정본 · 새 데이터 종류라면 분기 정책 표에 행 먼저 | 목적지를 정하지 않은 데이터가 스키마에 올라간다 |
| Out → In 승격 | 이 문서 · 승격 근거가 된 결정(D-NN 신설 또는 상태 줄) | 비목표였던 이유가 사라진 채 범위만 넓어진다 |
| 조건부 → 실행 | 진입 조건을 충족한 실측 기록 · [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) | 추측으로 단계를 앞당겨 무엇이 병목이었는지 배울 수 없게 된다 |
| 한계 해소 | 이 문서 한계 표 · 10_observability/07 | 해소된 한계가 계속 해석의 폭을 좁힌다 |

## 관련 문서

- [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) — 범위를 정하는 기준인 학습 목표 2축
- [06_design_decisions.md](./06_design_decisions.md) — D-02 로컬 전용 · D-11 업무 축 생략 불가
- [05_priorities_roadmap.md](./05_priorities_roadmap.md) — In 항목을 어느 단계에서 만드는가
- [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) — 조건부 범위의 진입 조건 정본
- [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) — 제외가 만든 측정 한계의 정본
- [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) — 로컬 전용의 노출 경계
