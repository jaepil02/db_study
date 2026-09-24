# db_study 설계 문서군 (docs)

> **대상**: db_study 설계 정본 — PLC 대용량 시계열과 업무 데이터를 Redis 중간 계층에서 갈라 ClickHouse와 PostgreSQL에 나눠 싣는 로컬 학습 시스템의 개요 · 기능 · 요구사항 · 아키텍처 · 저장소 · 파이프라인 · API · 화면 · 기술스택 · 관측 · 용어 · 보안
> **작성일**: 2026-09-23
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 호스트 포트 행에 현행 측정 머신의 redis 호스트 포트 6380 등재(충돌 시 호스트 쪽만 변경 규칙)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 도메인 공백 행에 08_screen 주 화면 없음 4(COL · SIM · ING · GEN) 추가 · 현재 상태에 남은 미결의 세 부류 명시(문서 판정 대기 0)
> **개정일**: 2026-09-24 — W7 검수 반영 — 현재 상태 절을 완성 상태로 재작성(122본 · 원본 4본 삭제 · 추적은 커밋 ff66a37) · 기술 · 관측 · 보안 파생 수치 행 신설(정본 링크) · REQ 228 → **229**(GLB 24) · 웹 3001 바인드 강제 수단
> **성격**: to-be 설계 정본이다. 구현 착수 전 상태이며, 구현과 측정이 진행되면 각 문서를 as-built로 승격하고 미확인 수치를 EXP-NN 실측 결과로 갱신한다
> **원천**: 원본 tech_stack.md · architecture.md · data_flow.md · implementation_plan.md(커밋 ff66a37 — W7에서 삭제) · 구축 계획 docs_plan.md(저장소 루트) · 형식 규율 docs_ref/docs_ref(조직 원리만 이식 · 내용 무관)

db_study는 배포하지 않는 **로컬 전용 학습 시스템**이다. 목적은 서비스 운영이 아니라 폴리글랏 퍼시스턴스 구조의 부하·성능 특성을 **측정해서** 아는 것이다. 본 문서군은 그 설계를 목적별 12폴더로 나눠 담는 단일 정본이며, 폴더 하나가 질문 하나와 채번 정본 하나를 소유한다.

학습 목표는 두 축으로 확정됐다. **① 시계열을 RDB가 아니라 컬럼형으로 다루는 이유를 측정으로 안다**(PostgreSQL 대조군과 ClickHouse의 동일 쿼리 비교). **② Redis 중간 계층에서 데이터 성격에 따라 목적지가 갈리는 것을 경험한다**(3계층 분기). 두 축의 정본은 [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md)이고, 두 축을 관통하는 실험 손잡이가 역할 스위치 SW-NN이다.

스택은 Next.js 웹(호스트 프로세스) · NestJS 단일 애플리케이션(api 컨테이너 — 제어 평면 + 데이터 평면 모듈) · PostgreSQL 18 · ClickHouse 25.8 · Redis 8(단일 인스턴스)이며 Docker Compose 컨테이너 4개로 기동한다. 정확한 버전의 정본은 [09_tech_stack](./09_tech_stack/README.md)이다.

## 현재 상태

- **문서군 122본 완성(2026-09-24)** — 웨이브 W0~W7로 구축했다. W0 골격 · W1 용어 · 개요 · W2 기능 · 요구사항 · W3 아키텍처 · 저장소 · W4 흐름 · W5 API · 화면 · W6 기술 스택 · 관측 · W7 보안 · 추적성 · 공식 참조 · 전수 검수. 웨이브 분담 · 착수 전 보정 결정 · 인계 이력은 저장소 루트 docs_plan.md가 갖는다.
- **원본 설계서 4본(architecture.md · data_flow.md · tech_stack.md · implementation_plan.md)은 W7 마감 커밋에서 삭제했다.** 전 문서의 원천 줄은 원본 절을 커밋 ff66a37 기준으로 적으므로 삭제 뒤에도 git으로 추적된다.
- **문서 판정으로 닫을 미결은 0이다(최종 정밀 검수).** 각 문서의 미확인 · 미설계 등재에 남은 행은 세 부류뿐이다 — ① 실측으로만 닫히는 3계층 미확인(EXP-NN 연결) ② 코드 착수 때 정하는 구현 세부 ③ 확장 로드맵 단계 진입 때 정하는 배분. 행선지가 문서 웨이브이거나 리드 판정 대기인 행은 없다.
- 모든 성능 수치는 실측 전이다 — 3계층 미확인은 [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md)의 EXP-NN 실측으로만 확정한다. 공식 참조 URL은 등재만 됐고 대조는 착수 체크리스트 7번이 한다.

## 문서 지도

★는 학습 목표 직결 문서다. 채번 열은 그 폴더가 소유하는 ID 한 종류이며, 12_security는 리뷰 폴더라 아무것도 채번하지 않는다.

| 폴더 | 질문 | 채번 | 핵심 문서 |
|------|------|------|----------|
| [01_overview](./01_overview/README.md) | 왜 만드는가 · 무엇을 배우려는가 | D-NN | ★ [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) |
| [02_features](./02_features/README.md) | 무슨 기능이 있는가 | 기능 ID · SW-NN | ★ [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| [03_requirements](./03_requirements/README.md) | 어떤 계약으로 동작하는가 | REQ · AC | ★ [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md) |
| [04_architecture](./04_architecture/README.md) | 어떤 구조로 계약을 강제하는가 | ADR-NN | ★★ [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) |
| [05_data_stores](./05_data_stores/README.md) | 데이터가 어디에 어떤 모양으로 앉는가 | 테이블 · Redis 키 | ★★ [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) |
| [06_pipeline](./06_pipeline/README.md) | 데이터가 어떻게 흐르고 갈라지는가 | F-NN | ★★ [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) |
| [07_api](./07_api/README.md) | 바깥에서 어떻게 부르는가 | API 표면 번호 | [07_api/01_conventions.md](./07_api/01_conventions.md) |
| [08_screen](./08_screen/README.md) | 사람이 무엇을 보는가 | 화면 코드 | ★ [08_screen/07_experiment_console.md](./08_screen/07_experiment_console.md) |
| [09_tech_stack](./09_tech_stack/README.md) | 무엇을 어느 버전으로 쓰는가 | 버전 문자열 | [09_tech_stack/06_decisions_rationale.md](./09_tech_stack/06_decisions_rationale.md) |
| [10_observability](./10_observability/README.md) | 무엇을 어떻게 재는가 | EXP-NN | ★★ [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| [11_glossary](./11_glossary/README.md) | 이 낱말이 무슨 뜻인가 | 에러 코드 · enum · ID 규약 | ★ [11_glossary/05_units_and_time.md](./11_glossary/05_units_and_time.md) |
| [12_security](./12_security/README.md) | 위협 관점에서 다시 읽으면 | 없음 | [12_security/05_local_exposure.md](./12_security/05_local_exposure.md) |

**docs/measurements/는 문서 지도 밖의 예외 폴더다.** 설계 정본이 아니라 실측 기록(EXP-NN 실행 결과)을 쌓는 자리이며, 번호가 없고 공통 골격 검사와 파일 수 집계에서 제외한다. 기록 형식의 정본은 [10_observability/04_experiment_protocol.md](./10_observability/04_experiment_protocol.md)다.

## 읽는 순서

목적에 따라 세 경로 중 하나를 탄다.

| 경로 | 순서 | 이 경로로 답하는 질문 |
|------|------|----------------------|
| 학습 목표 ① — 왜 ClickHouse인가 | [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) → [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) → [05_data_stores/03_clickhouse_schema.md](./05_data_stores/03_clickhouse_schema.md) → [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) | PostgreSQL 대조군과 몇 행에서 역전되는가 |
| 학습 목표 ② — Redis에서 무엇이 어디로 갈리는가 | [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) → [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) → [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) → [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) → [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) | 같은 스트림의 데이터가 왜 세 저장소로 갈리는가 |
| 전체 설계 | 01_overview → 02_features → 03_requirements(전역 규칙 먼저) → 04_architecture → 05_data_stores → 06_pipeline → 07_api → 08_screen → 10_observability → 09_tech_stack · 11_glossary · 12_security | 무엇을 · 어떤 계약으로 · 어떤 구조로 만드는가 |

막히면 [11_glossary](./11_glossary/README.md)(용어 · 에러 · enum · ID · 단위와 시각)를 먼저 본다.

## 고정 기준 (전 문서 공통 — 수치의 단일 정본)

모든 문서는 아래 수치를 동일하게 인용한다. 수치가 바뀌면 정본을 고친 같은 변경 단위에서 본 표와 파생 집계를 함께 갱신한다.

| 항목 | 기준 |
|------|------|
| 문서 폴더 | **12개** + 예외 폴더 docs/measurements 1(번호 없음 · 설계 정본 아님) |
| 문서 파일 | **122** — 루트 2(README · CLAUDE) + 폴더 120. 폴더별(README 포함) 01 **7** · 02 **14** · 03 **17** · 04 **10** · 05 **12** · 06 **13** · 07 **12** · 08 **8** · 09 **7** · 10 **8** · 11 **6** · 12 **6**. 검산: 7 + 14 + 17 + 10 + 12 + 13 + 12 + 8 + 7 + 8 + 6 + 6 = **120** · 120 + 2 = **122**. 파일명 정본은 각 폴더 README의 파일 목차다 |
| 도메인 | **11개** — AUT · MST · COL · SIM · GEN · ING · TSQ · RLT · ALM · WRK · OBS. NestJS 모듈과 1:1이다. 평면별 제어 6(AUT · MST · TSQ · RLT · ALM · WRK) · 데이터 4(COL · SIM · GEN · ING) · 관측 1(OBS). 검산: 6 + 4 + 1 = **11**. 정본 [01_overview/04_domain_map.md](./01_overview/04_domain_map.md) |
| 도메인 공백 | **도메인이 특정 폴더에서 비는 것은 설계 진술이다.** 세는 기준은 **소유**다(읽기·쓰기 참여가 아니다). 07_api 표면 없음 **3** — COL · SIM · ING(내부 모듈 — 부하 주입 표면 /api/v1/ingest/bulk는 GEN 소유). 05_data_stores 소유 테이블 없음 **6** — COL · SIM · GEN · TSQ · RLT · OBS(GEN은 모드 D로 tag_raw에 쓰지만 소유하지 않는다 · 롤업 객체는 ING 귀속 — W3 확정). 06_pipeline 흐름 불참 **1** — OBS. 08_screen 주 화면 없음 **4** — COL · SIM · ING · GEN(GEN 산출은 EXP-CONSOLE 카드에 간접 표시될 뿐이다). 매트릭스 정본 [01_overview/04_domain_map.md](./01_overview/04_domain_map.md) · 각 폴더 README가 공백을 명시한다 |
| 학습 목표 | **2축** — ① 컬럼형 vs RDB(측정) ② Redis 중간 계층의 성격별 분기. 정본 [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) |
| 분기 계층 | **3계층** — ① 태그 원시값 → ClickHouse 전용 ② 알람 판정 · 생산 카운터 → 확정 이벤트 PostgreSQL · 판정 전수 ClickHouse · 핫 상태 Redis Hash로 갈라짐 ③ 회원 · 작업지시 · 감사 → PostgreSQL 전용(Redis는 캐시 · Stream을 타지 않음). 정책 정본 [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) · 기전 정본 [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) |
| 데이터 흐름 | **10종** — F-01~F-10(수집 · 배치 적재 · 최신값 조회 · 시계열 조회 · 업무 CRUD · 알람 판정 · 실시간 푸시 · 롤업 · 테스트 데이터 주입 · 백프레셔와 장애). 정본 [06_pipeline/01_flow_inventory.md](./06_pipeline/01_flow_inventory.md) |
| 역할 스위치 | **11종** — SW-01~SW-11. Redis 역할 10(백프레셔 1 · 캐시 4 · 팬아웃 2 · 멱등 1 · 대조군 1 · 최신값 결합 1) + 수집 1(데드밴드). 검산: 1 + 4 + 2 + 1 + 1 + 1 + 1 = **11**. 기본값 on 8 · off 2(SW-09 · SW-10) · 구현 선택 1(SW-11 = ingest). 조합 제약 **9**. 정본 [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| 실행 구성 | Docker Compose 컨테이너 **4개** — 애플리케이션 1(api) + 저장소 3(postgres · clickhouse · redis). 웹은 **컨테이너가 아니라** 호스트 프로세스다. 관측 스택은 선택 기동 observability 프로파일이며 구성원 **2**(prometheus · grafana — 정본 [09_tech_stack/03_data_infra.md](./09_tech_stack/03_data_infra.md)) |
| 기동 역할 | APP_ROLE — all(기본) · api · worker · collector · datagen. 역할 분리는 확장 로드맵 1단계이며 코드 변경이 없다 |
| 호스트 포트 | 전부 **127.0.0.1 바인드** — 웹 3001 · api 3000 · postgres 5432 · clickhouse 8123 · 9000 · 9363 · redis 6379(현행 측정 머신은 호스트 redis-server와 충돌해 **호스트 쪽만 6380** — 컨테이너 내부 6379 · 서비스명 유지) · (프로파일) prometheus 9090 · grafana 3002. PlcSim 5020~5119는 컨테이너 내부 루프백 전용이라 publish하지 않는다. **웹 3001은 Compose 밖이다** — 바인드는 개발 서버 기동 인자로 강제한다(정본 [12_security/05_local_exposure.md](./12_security/05_local_exposure.md)) |
| PostgreSQL 테이블 | 업무 **14** + 대조군 **1** = **15**. 업무 14 = site · production_line · device · modbus_config · tag_master · tag_master_history · alarm_rule · alarm_event · user_account · role · user_role · work_order · production_log · audit_log. 대조군 = plc_tag_raw_control(SW-09). **세는 기준은 부모 테이블**이다 — 도구 관리 테이블(마이그레이션 이력 · pg_partman 설정)과 자식 파티션은 세지 않는다. FK 15 · UNIQUE 8 · 결합 CHECK 8 · 인덱스 9(정본 [05_data_stores/02_postgresql_constraints.md](./05_data_stores/02_postgresql_constraints.md)). 정본 [05_data_stores/01_postgresql_schema.md](./05_data_stores/01_postgresql_schema.md) · [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) |
| ClickHouse 객체 | 테이블 **5**(tag_raw · tag_1m · tag_1h · tag_1d · alarm_eval) · MV **3**(mv_tag_1m · mv_tag_1h · mv_tag_1d) · Dictionary **1**(dict_tag). 정본 [05_data_stores/03_clickhouse_schema.md](./05_data_stores/03_clickhouse_schema.md) · [05_data_stores/04_clickhouse_rollup.md](./05_data_stores/04_clickhouse_rollup.md) |
| Redis 영역 접두 | **9** — 봉인 계열(TTL 금지) 3 stream · rt · alarm + 캐시 계열(TTL 필수) 5 cache · lock · rl · sess · auth + Pub/Sub 채널 1 ch. 검산: 3 + 5 + 1 = **9**. sess는 활성 키 패턴 없이 **예약**이다(세션 키가 다시 생길 때 캐시 계열 정책이 이미 정해져 있게). 활성 키 패턴 **18**(봉인 4 + 캐시 11 + 채널 3) · 봉인 표 통제 칸 **26**. 단일 인스턴스 · volatile-lru. 키 패턴 전수와 봉인 표의 정본은 [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) |
| 열거 집합 | 품질 코드 **7**(0 GOOD · 1 UNCERTAIN · 2 BAD_COMM · 3 BAD_TIMEOUT · 4 BAD_RANGE · 5 STALE · 9 SIMULATED) · 신호 프로파일 **8**(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) · 알람 상태 **5**(NORMAL · PENDING · ACTIVE · CLEARING · ACKED) · 백프레셔 단계 **5**(정상 · 주의 · 경고 · 위험 · 복구). 정본 [11_glossary/03_enums_state_machines.md](./11_glossary/03_enums_state_machines.md) |
| 실험 축 | 주입 모드 **4**(A Modbus 경유 · B Stream 직결 · C HTTP · D ClickHouse 직접) · 조회 해상도 **4**(raw · 1m · 1h · 1d) · 용량 티어 **4**(S · M · M+ · L) · 메모리 프로파일 **2**(부하 실험 · 개발 — 중간 프로파일은 조건부 대안) · 부하 시나리오 **5**(Baseline · Ramp-up · Spike · Soak · Breakpoint) + 장애 주입 **1**(k6 밖) |
| 조정값 | TTL · 배치 크기 · 플러시 주기 · 보존일 · MAXLEN · 백프레셔 임계는 **2계층 조정값**이다 — 본문에 값을 박지 않고 조회 계약(키 모양 · 기준 시점 · 금지된 대체 동작)으로 서술하며 현행 값은 소유처를 밝혀 참고로 적는다. 보존의 정본 [05_data_stores/08_retention_lifecycle.md](./05_data_stores/08_retention_lifecycle.md) · 백프레셔 임계의 정본 [04_architecture/06_backpressure_failure.md](./04_architecture/06_backpressure_failure.md) |
| 성능 수치 | 실측 전 성능 수치는 **3계층 미확인**이다 — "미확인 — 확정 전 임의 값 고정 금지"로 등재하고 생략하지 않는다. 확정은 EXP-NN 실측 결과로만 한다. 목표치의 정본 [03_requirements/13_nonfunctional.md](./03_requirements/13_nonfunctional.md) |
| 에러 코드 | **22종** — 네임스페이스 정의 **9**(표면 도메인 8 + common 1) · 코드 보유 **8**(common 5 · auth 6 · master 2 · timeseries 2 · realtime 1 · alarms 2 · work_orders 2 · datagen 2 — metrics만 0). 검산: 5 + 6 + 2 + 2 + 1 + 2 + 2 + 2 = **22**. 네임스페이스는 URL 경로가 아니라 **표면을 소유한 도메인**을 따른다. 채번 정본 [11_glossary/02_error_codes.md](./11_glossary/02_error_codes.md) · 미러 [07_api/02_errors.md](./07_api/02_errors.md) |
| 제품·학습 결정 | **13** — D-01~D-13(결번 없음). 확정 주체: 사용자 5 + 원본 4 + 리드 판정 1 + W1 판정 후 사용자 확정 2 + W3 요청 사용자 확정 1 = **13**. 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) |
| 기능 ID | **91** — AUT 7 · MST 9 · COL 9 · SIM 5 · GEN 10 · ING 13 · TSQ 9 · RLT 9 · ALM 9 · WRK 5 · OBS 6. 검산: 7 + 9 + 9 + 5 + 10 + 13 + 9 + 9 + 9 + 5 + 6 = **91**. 정본 [02_features](./02_features/README.md) 도메인 파일 11본 · 세는 자리는 [02_features/12_permission_matrix.md](./02_features/12_permission_matrix.md) §검산 |
| 역할 | **3** — OPERATOR · ENGINEER · ADMIN. 누적 관계가 아니며 다중 역할은 합집합으로 판정한다. 실험 수행자는 역할이 아니다(머신 접근). 정본 [02_features/12_permission_matrix.md](./02_features/12_permission_matrix.md) |
| 요구사항 · 인수 기준 | REQ **229** — GLB 24 · AUT 17 · MST 15 · COL 16 · SIM 12 · GEN 15 · ING 18 · TSQ 17 · RLT 18 · ALM 20 · WRK 12 · OBS 12 · NFR 18 · TEC 15. 검산: 24 + 17 + 15 + 16 + 12 + 15 + 18 + 17 + 18 + 20 + 12 + 12 + 18 + 15 = **229**. AC **45**(흐름 검증 13 + 단계 판정 25 + 학습 목표 산출 7). 정본 [03_requirements](./03_requirements/README.md) 각 파일 · [03_requirements/14_acceptance_criteria.md](./03_requirements/14_acceptance_criteria.md) |
| 기술 결정 | **25** — ADR-01~ADR-25(선점 21 + W3 신설 4 · 결번 없음) · 상태 현행 24 · 잠정 1(ADR-10). 정본 [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) |
| API 표면 | **43** — REST JSON 40 + 다운로드 스트림 1 + 메트릭 텍스트 1 + WebSocket 1. 문서별 03_auth 3 · 04_master 17 · 05_timeseries 2 · 06_realtime 2 · 07_alarms 6 · 08_work_orders 9 · 09_datagen 1 · 10_metrics 2 · 11_websocket 1. 검산: 3 + 17 + 2 + 2 + 6 + 9 + 1 + 2 + 1 = **43** · 원본 21 + 신설 22. 세는 기준은 도메인 문서의 표면 요약 표 행 수다(최대 번호가 아니다). 정본 [07_api/README.md](./07_api/README.md) |
| 화면 | **10** — AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE. 검산: AUTH 1 + DSH 1 + ANL 1 + ALM 2 + ADM 3 + EXP 2 = **10**. 정본 [08_screen/README.md](./08_screen/README.md) |
| 실험 | **39** — EXP-01~39(결번 없음). 대조군 5(EXP-01~05) + 스위치 10 + 장애 재현 5 + 생성기 1 + 부하 시나리오 5 + 확장 진입 2 + 흐름·구조·기반 11. 검산: 5 + 10 + 5 + 1 + 5 + 2 + 11 = **39**. 신설은 EXP-40부터 말미 채번. 정본 [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| 기술 · 관측 · 보안 파생 수치 | 메트릭 이름 **136**(정본 [10_observability/01_metrics_catalog.md](./10_observability/01_metrics_catalog.md)) · 알림 규칙 14 · 대시보드 6(정본 [10_observability/03_dashboards_alerts.md](./10_observability/03_dashboards_alerts.md)) · 환경변수 **34**(스위치 11 + 스위치 밖 23 · 정본 [09_tech_stack/04_local_environment.md](./09_tech_stack/04_local_environment.md)) · 버전 고정표 **36**행(정본 [09_tech_stack/03_data_infra.md](./09_tech_stack/03_data_infra.md)) · 공식 참조 **68**(정본 [03_requirements/16_official_references.md](./03_requirements/16_official_references.md)) · 위협 × 통제 **26** · 잔여 17(정본 [12_security/04_threat_model.md](./12_security/04_threat_model.md)) |
| 스택 표기 | **Next.js · NestJS · PostgreSQL 18 · ClickHouse 25.8 · Redis 8 · Docker Compose**로 통일한다. 정확 버전은 09_tech_stack에만 적는다 |
| 단위와 시각 | ts = 측정 시각(모드 A는 Collector 폴링 시점 · 생성 모드는 생성기 시점) · ingested_at = 적재 시각 · 저장은 epoch 기준 · 표시 시점에만 Asia/Seoul로 변환 · 측정값 Float64. 정본 [11_glossary/05_units_and_time.md](./11_glossary/05_units_and_time.md) |

## ID·표기 규약

| 종류 | 형식 | 예 | 채번 정본 |
|------|------|-----|----------|
| 기능 ID | {도메인}-NN | ING-03 | [02_features](./02_features/README.md) 각 도메인 파일 |
| 요구사항 | REQ-{도메인}-NN (전역 REQ-GLB · 비기능 REQ-NFR · 기술운영 REQ-TEC) | REQ-GLB-01 | [03_requirements](./03_requirements/README.md) 각 파일 |
| 인수 기준 | AC-NN | AC-01 | [03_requirements/14_acceptance_criteria.md](./03_requirements/14_acceptance_criteria.md) |
| 기술 결정 | ADR-NN | ADR-01 | [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) |
| 제품·학습 결정 | D-NN | D-01 | [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) |
| **데이터 흐름** | **F-NN** | F-01 | [06_pipeline/01_flow_inventory.md](./06_pipeline/01_flow_inventory.md) |
| **역할 스위치** | **SW-NN** | SW-01 | [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| **실험** | **EXP-NN** | EXP-01 | [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| 화면 코드 | {표면}-{의미} | DSH-REALTIME | [08_screen/README.md](./08_screen/README.md) |
| 에러 코드 | {domain}.{snake_case} + HTTP 상태 | datagen.stream_full/503 | [11_glossary/02_error_codes.md](./11_glossary/02_error_codes.md) — [07_api/02_errors.md](./07_api/02_errors.md)는 미러 |
| API 표면 | {문서} #N (문서 지역 번호) | 05_timeseries #3 | 각 [07_api](./07_api/README.md) 도메인 파일 |
| 테이블 · 컬럼 | snake_case | tag_raw · tag_master.tag_id | [05_data_stores](./05_data_stores/README.md) |
| Redis 키 | 영역:용도:식별자 | rt:latest:{device_id} | [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) |
| 메트릭 | 정본 문서가 정한 이름 규약 | consumer_lag | [10_observability/01_metrics_catalog.md](./10_observability/01_metrics_catalog.md) |

F-NN · SW-NN · EXP-NN 셋이 이 프로젝트 고유 축이다. 원본의 흐름 표기 F1~F10은 F-01~F-10으로 통일하며 대응은 [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)가 적는다. **번호는 식별자이지 순서가 아니다** — 새 ID는 말미에 채번하고, 재배치하지 않으며, 폐지 번호는 결번으로 영구 보존한다. 상세 규약의 정본은 [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)다.

## 전역 불변식

전 도메인이 전제하는 규칙이다. 상세 계약의 정본은 [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md)(REQ-GLB-01~24)다.

| 항목 | 규칙 |
|------|------|
| 시각 의미론 | ts는 측정 시각이고 ingested_at은 적재 시각이다. **둘을 서로 대체하지 않는다** — E2E 지연(ingested_at − ts)은 두 컬럼의 차로만 계산된다. 저장은 epoch 기준이며 ClickHouse 컬럼의 시간대 속성은 표시·파싱 규칙일 뿐 저장값을 바꾸지 않는다 |
| 비동기 경계 | 수집과 적재 사이에는 반드시 Redis Stream을 둔다. **같은 프로세스 안이어도 예외가 아니다.** 경계를 우회하는 경로는 실험 전용 SW-01 off뿐이며 기본 on · 부팅 경고를 동반한다 |
| at-least-once | XACK은 ClickHouse 삽입이 성공한 뒤에만 한다. 재시도를 소진한 배치는 DLQ로 옮기고 **반드시 XACK한다** — 하지 않으면 PEL에 영구 잔류해 컨슈머 랙 지표가 오염된다 |
| 멱등 | 배치 토큰은 배치 내용에 대해 **결정적**이어야 한다(엔트리 ID 범위 + 행 수의 해시). 무작위 UUID를 쓰면 재시작 후 같은 배치가 다른 토큰을 받아 중복이 생긴다. 재시도 간격은 ClickHouse 중복 제거 윈도우 안에 머문다 |
| 순서 무관성 | 컨슈머 간 순서는 보장하지 않는다. 시계열이 ts를 자체 보유하므로 무해하다 — **순서 의존 집계를 도입하는 순간 이 전제가 깨진다.** 잔여의 기록 자리는 [05_data_stores/02_postgresql_constraints.md](./05_data_stores/02_postgresql_constraints.md)의 한계 등재다 |
| TTL 우선순위 | 단일 Redis 인스턴스에서 **키 접두 하나가 곧 데이터 생존 정책의 경계**다. 봉인 계열(stream · rt · alarm)은 TTL을 붙이지 않고, 캐시 계열(cache · lock · rl · sess · auth)은 TTL 없이 만들지 않는다. 강제 수단은 린트가 아니라 키 계열별 래퍼다 |
| 실패 전략 이원화 | 같은 인스턴스 안에서도 키 계열에 따라 실패 전략이 **정반대**다 — 캐시 계열은 짧은 타임아웃 후 조용히 degrade해 DB로 우회하고, 봉인 계열은 명시적으로 실패시켜 백프레셔를 발동한다 |
| 백프레셔 명시화 | 버퍼가 차면 조용히 버리지 않고 실패시키고 계측한다. MAXLEN 트리밍은 검사를 우회한 발행자를 막는 최후 안전장치이며, 미소비 엔트리가 잘리면 결함으로 계측한다 |
| 저장소 책임 단일화 | 업무 데이터는 PostgreSQL, 시계열은 ClickHouse다. 중복 저장의 유일한 예외는 태그 최신값(Redis 휘발 사본 · ClickHouse가 진실)이다. **대조군 plc_tag_raw_control은 중복 저장이 아니라 실험 계측물**이며 SW-09 off가 기본이다 |
| 분기는 성격 판정 | 분기는 "전부 큐를 태운다"가 아니라 "성격을 보고 경로를 고른다"이다. **경로를 고르지 않는 것도 분기의 결과다** — 업무 쓰기는 Stream을 타지 않는다(read-your-writes · 트랜잭션 보장) |
| 목적이 다른 세 쓰기 | 알람의 PostgreSQL · ClickHouse · Redis 쓰기는 dual-write가 아니라 **목적이 다른 세 개의 쓰기**다. 부분 실패 시 진실은 PostgreSQL alarm_event다 |
| 불변 사실 기록 | 두 DB를 트랜잭션으로 묶지 않는다. 시계열은 불변 사실로 두고 해석 메타는 조회 시점에 붙인다. tag_id는 영구 보존 · 재사용 금지이고, 스케일 변경은 새 tag_id 발급이다 |
| 부동소수점 | 측정값은 Float64다. 원시 집계와 롤업 집계의 대조는 **오차 허용 비교**로만 한다 — 동등 비교는 병합 순서에 따라 거짓 불일치를 낸다 |
| 계측 우선 | 새 컴포넌트는 메트릭 노출과 함께 추가한다. 계측 없는 스위치는 장식이다 |
| 측정 기록 | 모든 수치에 **커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태**를 병기한다. 같은 실험 3회 실행의 중앙값을 쓰고 편차가 기준을 넘으면 폐기한다(기준 정본 [10_observability/04_experiment_protocol.md](./10_observability/04_experiment_protocol.md)) |
| 생성 데이터 구분 | 생성기가 만든 값은 품질 코드 SIMULATED(9)를 단다. 실데이터와 섞인 뒤에는 구분할 방법이 없다 |
| 로컬 전용 | 호스트 포트는 127.0.0.1에만 바인드한다. **외부에서 도달할 수 없다는 사실이 인가 검사나 입력 검증을 생략할 이유는 되지 않는다** |

## 문서 작성 규약

- 폴더 인덱스는 README.md, 세부 파일은 NN_snake_case.md 번호 접두다(05_data_stores/erd.md만 번호 없음).
- 전 문서 공통 골격 — H1 → blockquote 메타(대상 · 작성일 · 개정일 누적 · 원천) → 도입 단락 → H2 섹션 → 마지막 H2는 관련 문서.
- **인라인 백틱을 쓰지 않는다.** 펜스는 plain · json · mermaid · sql 4종만 쓴다.
- 문체는 한국어 "~한다" 평서체 현재형이다. 열거 구분자는 가운뎃점( · )이다. 절 참조는 §1.1 형식이다.
- 개수를 쓰면 그 자리에서 항목을 세어 검산식을 남긴다.
- 링크는 상대경로·실존 파일만 쓰고 라벨은 대상 경로 그대로다. 코드 경로는 평문이다. 외부 URL은 [03_requirements/16_official_references.md](./03_requirements/16_official_references.md)에만 둔다.
- 작성·수정·검수 절차의 정본은 [CLAUDE.md](./CLAUDE.md)다. 기계 검사는 .omc/docs_lint.py가 수행한다(git 추적 밖 로컬 도구).

## 관련 문서

- 작성·검수 지침 → [CLAUDE.md](./CLAUDE.md)
- 학습 목표 정본 → [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md)
- 전역 규칙 정본 → [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md)
- ID 채번 상세 정본 → [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)
