# 도메인 용어 사전 (01_domain_terms)

> **대상**: db_study 문서군이 쓰는 산업 프로토콜 · 수집 · 시계열 저장 · Redis 스트림 · 조회 캐시 · 흐름 제어 · 실행 환경 · 실험 용어 — 용어 정의 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S3 구현 반영 — 컨슈머 이름 ingest-{pid}-{n} → **ingest-{n}**(정본 04_id_conventions)
> **개정일**: 2026-09-24 — W7 검수 반영 — MAXLEN 트리밍 · 백프레셔 행의 길이 기준 → **적체 기준**(ADR-21) · 캐시 스탬피드 락 키 lock:rebuild:{key} → **lock:rebuild:q:{sha1}**(정본 05_data_stores/05) — 용어 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 컨슈머 랙 정의를 lag + pending으로(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §5.3 · §6 · §7 · §10.1 · §10.3(커밋 ff66a37) · 원본 data_flow.md §3 · §3.1 · §3.3 · §4 · §4.2 · §4.3 · §6 · §7.2 · §9 · §10 · §12(커밋 ff66a37) · 원본 architecture.md §7 · §8 · §9 · §10 · §12(커밋 ff66a37)

용어마다 **정의 · 이 시스템에서의 쓰임 · 혼동하기 쉬운 인접 용어 · 정본**을 적는다. 정의는 일반 뜻이고, 쓰임은 이 시스템이 그 용어로 가리키는 구체 대상이다. 둘이 다르면 쓰임이 우선한다 — 예컨대 이 시스템의 "PLC"는 실장비가 아니라 PlcSim 모듈이 흉내 내는 Modbus 서버다.

수치는 싣지 않는다. 용어가 수치를 품을 때는 1계층 구조값만 적고, 2계층 조정값은 소유처 링크로, 3계층 미확인은 적지 않는다. enum 값 목록은 [03_enums_state_machines.md](./03_enums_state_machines.md), 시각 · 단위는 [05_units_and_time.md](./05_units_and_time.md)가 정본이다.

## 1. 산업 프로토콜

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| PLC | 설비를 제어하는 산업용 컨트롤러. 측정값을 레지스터에 둔다 | 실장비가 없다. **PlcSim 모듈**이 설비 1대 = 포트 1개로 Modbus TCP 서버를 흉내 낸다 | 설비(device) — 마스터의 관리 단위이고 PLC는 통신 상대다 | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) |
| Modbus TCP | 레지스터를 요청 · 응답으로 읽고 쓰는 산업 프로토콜의 TCP 변형 | Collector(클라이언트)가 PlcSim(서버)에 컨테이너 내부 루프백으로 접속한다. **같은 프로세스여도 Modbus 계층을 생략하지 않는다** — 모드 A의 E2E 측정 대상이다 | Modbus RTU(시리얼) — 쓰지 않는다 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 유닛 ID | 한 Modbus 연결 뒤의 장치를 가르는 번호 | modbus_config.unit_id. 설비 1대 = 포트 1개라 연결당 장치가 하나다 | device_id — 마스터 기본키 · 유닛 ID는 프로토콜 주소 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| Function Code(FC) | 요청의 종류. FC01 Coil · FC02 Discrete Input · FC03 Holding Register · FC04 Input Register 읽기 | tag_master.function_code에 1~4로 저장한다. 수집은 읽기만 한다 | 품질 코드 — 결과의 신뢰도 · FC는 요청 종류 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 레지스터 | 16비트 워드 한 칸. Holding은 읽기/쓰기 · Input은 읽기 전용 | 태그 하나가 1~4 워드를 차지한다. tag_master.address가 시작 주소(0 기반) | Coil · Discrete Input — 비트 단위 영역 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 워드 순서 | 32비트 이상 값을 여러 워드에 나눠 실을 때의 워드 · 바이트 배치(ABCD · CDAB · BADC · DCBA) | tag_master.word_order. **틀려도 예외가 나지 않고 엉뚱한 값으로 풀린다** | 엔디안 — 바이트 순서만 · 워드 순서는 워드 배치까지 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| FC03 요청당 125 레지스터 | Holding Register 읽기 한 요청의 최대 개수(프로토콜 제약 · 1계층) | 태그 주소가 흩어지면 요청 수가 폭증한다. 레지스터 블록 병합의 상한이다 | modbus_config.max_regs_per_request — 설비별 설정값이며 이 상한을 넘을 수 없다 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 태그 | 측정 지점 하나. 레지스터 주소 · 타입 · 스케일을 가진 논리 이름 | tag_master 행 하나 = tag_id 하나. tag_id는 영구 보존 · 재사용 금지이고 스케일을 바꾸면 새로 발급한다 | 레지스터 — 물리 칸 · 태그는 해석 규칙을 붙인 논리 단위 | [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) |
| 스캔 주기 | 한 태그를 폴링하는 간격 | tag_master.scan_rate_ms. STALE 판정의 기준 주기이기도 하다 | 배치 플러시 주기 — 적재 쪽 주기 | [05_units_and_time.md](./05_units_and_time.md) |
| 스캔 그룹 | 같은 스캔 주기의 태그 묶음. 그룹마다 폴링 루프가 하나다 | 설비당 1커넥션 위에서 그룹별 루프가 돈다. 타임아웃 시 그 그룹의 그 주기를 건너뛴다 | 컨슈머 그룹 — Redis 소비 쪽 개념 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 스캔 사이클 | 한 스캔 그룹의 폴링 1회와 그 산출 | **Stream 엔트리 하나 = 스캔 사이클 하나**다. 포인트 단위가 아니다 | 배치 — 여러 엔트리를 모은 적재 단위 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| 레지스터 블록 병합 | 연속 주소의 태그를 한 요청으로 묶는 최적화(register block coalescing) | 수집 모듈의 핵심 최적화 지점. 병합이 없으면 태그 1개당 요청 1회가 된다 | 배치 적재 — 적재 쪽 묶음 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 갭 허용 병합 | 사이의 안 쓰는 레지스터를 일정 개수까지 함께 읽어 블록을 더 크게 만드는 병합 | 불필요한 레지스터를 읽는 낭비로 요청 수를 줄인다. 허용 갭 크기는 2계층 조정값 | 단순 연속 병합 — 빈 주소가 있으면 블록을 끊는다 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |

## 2. 수집 · 정규화

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| 디코딩 | 워드 배열을 타입 값으로 바꾸는 단계 | 워드 순서 적용 → 타입 변환 순서로 한다 | 공학 단위 변환 — 디코딩 뒤 단계 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 공학 단위 변환 | 원시값을 사람이 읽는 물리량으로 바꾸는 선형 변환 | eng = raw × scale + offset_value. 범위 판정 · 데드밴드는 변환 후 값으로 한다 | 단위 부착 — 조회 시 Dictionary가 unit 문자열을 붙이는 것 | [05_units_and_time.md](./05_units_and_time.md) |
| 품질 판정 | 값마다 신뢰도 코드를 매기는 단계 | 범위 밖 → BAD_RANGE · 예외 응답 → BAD_COMM · 타임아웃 → BAD_TIMEOUT(행 없음) · 생성기 산출 → SIMULATED | 알람 판정 — 품질이 아니라 조건 위반을 본다 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 데드밴드 | 직전 전송값 대비 변화량이 임계보다 작으면 전송을 생략하는 필터 | tag_master.deadband(공학 단위 절대값). **원본 파형을 잃으므로** 성능 측정은 데드밴드 0으로 하고 효과는 별도 실험으로 잰다. SW-10이 켜고 끈다 | 다운샘플링 — 조회 시 줄이는 것 · 데드밴드는 저장 전에 버린다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| 결측 | 기대한 시점의 행이 없는 것 | 타임아웃 · 재빌드 중단 · DROPOUT 프로파일이 만든다. 재빌드 결측은 장애가 아니라 정상 동작으로 기록한다 | STALE — 조회 시점의 판정 · 결측은 저장된 사실 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) |
| scan_seq | 스캔 사이클 일련번호 | Stream 필드 s → tag_raw.scan_seq. 사이클 누락 탐지에 쓴다 | 엔트리 ID — Redis가 붙이는 번호 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| 스풀 | XADD가 막힐 때 로컬 디스크에 프레임을 쌓아 두는 임시 저장 | Collector가 spooldata 볼륨의 /app/spool에 길이 접두 + MessagePack 프레임 파일로 쓴다. Stream 엔트리와 같은 포맷이라 복구 때 변환 없이 재발행한다 | DLQ — 적재 실패 배치의 격리처 · 스풀은 발행 전 버퍼 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) |

## 3. 시계열 저장 (ClickHouse)

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| 시계열 | 시각이 붙은 측정값의 연속 | 태그 원시값 · 판정 전수. **추가 전용 · 갱신 없음 · 범위 집계**라는 성격이 ClickHouse 전용 분기의 근거다 | 이벤트 — 알람 확정 이벤트는 상태가 갱신되므로 PostgreSQL로 간다 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |
| 롱 포맷 | 한 행 = (시각 · 태그 · 값) 하나인 배치 | tag_raw의 형태. 태그가 늘어도 스키마가 바뀌지 않는다 | 와이드 포맷 — 한 행에 태그마다 컬럼 · 태그 추가가 스키마 변경이 된다 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| MergeTree | 삽입마다 정렬된 불변 조각을 만들고 뒤에서 합치는 ClickHouse 엔진 계열 | tag_raw · alarm_eval은 MergeTree · 롤업은 AggregatingMergeTree | ReplacingMergeTree — 쓰지 않는다. 중복 제거는 삽입 토큰으로 한다 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| 파트 | INSERT 한 번이 만드는 불변 데이터 조각 | 배치가 작으면 파트가 폭증해 too many parts로 삽입이 막힌다 — 배치 크기의 존재 이유다 | 파티션 — 파트를 묶는 논리 구획 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 머지 | 작은 파트를 큰 파트로 합치는 백그라운드 작업 | 머지가 밀리면 삽입 지연이 오르고 백프레셔가 시작된다 | 롤업 — 해상도를 낮추는 집계 · 머지는 같은 해상도의 재배치 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 파티션 | PARTITION BY 식으로 나눈 구획. 삭제 · 보존의 단위 | tag_raw는 일자 파티션이라 TTL 삭제가 파티션 DROP으로 즉시 끝난다. 행 단위 DELETE는 비동기 mutation이라 비싸다 | 파트 — 파티션 안의 물리 조각 | [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |
| 정렬 키 | ORDER BY — 파트 안의 행 순서이자 희소 인덱스 | tag_raw는 (device_id, tag_id, ts). 바꾸려면 새 테이블 + 이관이 필요하다 | 기본키(PostgreSQL) — 유일성 강제 · 정렬 키는 유일성을 강제하지 않는다 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| 코덱 | 컬럼별 압축 방식 | ts는 Delta + ZSTD · value는 Gorilla + ZSTD. 신호 프로파일 × 코덱이 압축률 실험의 축이다 | 압축률 — 코덱의 결과 · 3계층 미확인 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| MV | Materialized View — 원천 테이블에 삽입되는 블록을 받아 타깃 테이블에 쓰는 트리거 | mv_tag_1m · mv_tag_1h · mv_tag_1d. **삽입 블록만 보고 기존 데이터는 보지 않는다** | 일반 뷰 — 조회 시 계산 · MV는 삽입 시 계산 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |
| 롤업 | 원시를 시간 버킷으로 미리 집계해 둔 저해상도 테이블 | tag_1m · tag_1h · tag_1d. 원시를 짧게 보존해도 장기 분석이 되는 근거다 | 다운샘플링 — 응답 포인트를 줄이는 조회 시 처리 | [../06_pipeline/09_rollup.md](../06_pipeline/09_rollup.md) |
| 롤업 캐스케이드 | MV의 타깃에 또 MV가 붙어 삽입이 연쇄되는 구조 | 원시 → 분 → 시 → 일을 별도 배치 잡 없이 삽입 시점에 완성한다. 체이닝은 3단계까지 | 배치 잡 롤업 — 쓰지 않는다 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |
| -State · -Merge 조합자 | 집계의 중간 상태를 저장(-State)하고 조회 때 합치는(-Merge) 함수 접미 | 롤업 컬럼은 상태를 저장하므로 **조회 시 반드시 -Merge로 읽는다**. 상태를 합치는 순서가 달라 avg의 최하위 비트가 달라질 수 있다 | 최종값 — 롤업 컬럼에는 최종값이 없다 | [05_units_and_time.md](./05_units_and_time.md) |
| Dictionary | 외부 원천을 메모리에 올려 키 조회로 붙이는 ClickHouse 객체 | dict_tag가 PostgreSQL tag_master를 주기 적재해 태그명 · 단위를 dictGet으로 붙인다. 시계열에는 tag_id만 저장한다 | 조인 — 매 조회마다 PostgreSQL을 읽지 않는다 | [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) |
| 백필 | 과거 시각의 데이터를 나중에 대량으로 채우는 것 | 모드 D. MV를 분리하고 INSERT SELECT로 롤업을 직접 채운 뒤 다시 붙인다 | 재처리 — Stream 안 엔트리를 다시 읽는 것 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |
| 중복 제거 토큰 | 같은 토큰의 INSERT를 한 번만 반영하게 하는 삽입 설정 | 배치 내용에 **결정적**인 해시(엔트리 ID 범위 + 행 수). 무작위 UUID면 재시작 후 같은 배치가 다른 토큰을 받아 중복된다 | 멱등 키(HTTP) — 요청 단위 · 토큰은 배치 단위 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 중복 제거 윈도우 | 서버가 토큰을 기억하는 최근 파트 수 | 재시도 백오프 합계가 이 윈도우 안에 머물러야 중복이 막힌다(2계층) | TTL — 시간 기준 · 윈도우는 파트 개수 기준 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |

## 4. Redis · Stream

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| Stream | 추가 전용 로그 자료구조. 엔트리마다 ID가 붙는다 | stream:plc:raw가 수집과 적재 사이의 **비동기 경계**다. 같은 프로세스여도 이 경계를 둔다 | 큐 — 소비하면 사라짐 · Stream은 XACK 뒤에도 트리밍 전까지 남는다 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 엔트리 · 엔트리 ID | Stream의 항목 하나와 그 단조 증가 ID | 엔트리 하나 = 스캔 사이클 하나. 엔트리 ID 범위가 중복 제거 토큰의 재료다 | scan_seq — 수집 쪽 번호 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| 컨슈머 그룹 | 한 Stream을 여러 컨슈머가 나눠 읽게 하는 이름 붙은 소비 상태 | grp:ingest. 엔트리는 그룹 안 한 컨슈머에게만 간다. **컨슈머 간 순서는 보장하지 않는다** | Pub/Sub 구독 — 전원에게 복제 · 그룹은 분배 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 컨슈머 | 그룹 안의 개별 소비자 이름 | 같은 프로세스 안의 독립 루프 ingest-{n}(n = 1..N 고정). 다중화는 프로세스가 아니라 이름으로 한다 | 워커 스레드 — 디코딩 CPU 작업을 받는 piscina 워커 | [04_id_conventions.md](./04_id_conventions.md) |
| PEL | Pending Entries List — 전달됐으나 XACK되지 않은 엔트리 목록 | 삽입 성공 전까지 엔트리가 여기 머문다. at-least-once의 근거이자 컨슈머 랙의 원천 | DLQ — 포기한 배치의 격리처 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| XACK | 엔트리 처리 완료를 알려 PEL에서 빼는 명령 | **ClickHouse 삽입 성공 뒤에만** 한다. DLQ로 옮긴 배치도 반드시 한다 | 삭제 — XACK는 엔트리를 지우지 않는다 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| XAUTOCLAIM | 일정 시간 idle인 PEL 엔트리를 다른 컨슈머로 넘기는 명령 | 주기 타이머로 돌려 죽은 컨슈머 이름에 남은 PEL을 회수한다. idle 기준은 2계층 | XCLAIM — 엔트리를 하나씩 지정 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 컨슈머 랙 | 그룹이 아직 처리하지 못한 양 = 그룹 lag(미배달) + pending(미확인) — XLEN이 아니다 | consumer_lag. 백프레셔 판정량(ADR-21)과 같은 양이며 정상 단계의 계측 지표이고, XACK 누락이 있으면 영원히 0이 되지 않는다 | 스트림 길이 — 트리밍 전 전체 엔트리 수 · 랙은 미처리분 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| DLQ | Dead Letter Queue — 재시도를 소진한 배치의 격리처 | stream:plc:dlq에 배치와 오류 사유를 넣는다. dlq_count가 늘면 알린다 | 스풀 — 발행 실패의 임시 버퍼 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| MAXLEN 트리밍 | XADD 때 길이 상한을 넘는 오래된 엔트리를 잘라내는 것 | **최후 안전장치**다. 오류 없이 조용히 버리므로 미소비 엔트리가 잘리면 stream_trimmed_unacked로 결함 계측한다. 1차 백프레셔 신호는 적체 검사가 만든다 | 축출 — 메모리 정책이 키를 지우는 것 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 봉인 계열 · 캐시 계열 | TTL 금지 키 접두(stream · rt · alarm)와 TTL 필수 키 접두(cache · lock · rl · sess · auth) | 단일 인스턴스에서 **접두 하나가 생존 정책의 경계**다. 실패 전략도 정반대 — 봉인은 명시적 실패, 캐시는 조용한 degrade | 영속 · 휘발 — 봉인은 "축출되지 않는다"이지 "영속"이 아니다. rt:latest는 봉인 계열이면서 ClickHouse에서 재구성하는 휘발 사본이다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| volatile-lru | TTL 있는 키만 LRU로 축출하는 메모리 정책 | TTL 없는 봉인 계열은 축출 후보가 아니다. TTL 키가 다 밀린 뒤에는 쓰기가 OOM으로 실패한다 | allkeys-lru — Stream까지 조용히 지운다 · 쓰지 않는다 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| AOF | Append Only File — 쓰기 명령 로그 영속화 | 재기동 시 미소비 Stream 엔트리와 PEL을 보존하는 목적이다 | 스냅샷(task snapshot) — 실험 롤백용 볼륨 묶음 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| Pub/Sub | 채널 구독자 전원에게 메시지를 보내는 fire-and-forget 방송 | ch:rt:{device_id} · ch:alarm · ch:cacheinv. 구독자가 없으면 사라지므로 **저장 경로로 쓰지 않는다** | Stream — 보존 · 재처리 가능 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 최신값 Hash | 설비별 태그 최신값을 담는 Hash | rt:latest:{device_id} — field tag_id · 값 "ts,value,quality". **휘발 사본이며 진실은 ClickHouse다** | 조회 캐시 — TTL로 만료 · 최신값은 덮어쓰기 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |

## 5. 조회 · 캐시

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| cache-aside | 조회가 캐시를 먼저 보고 미스면 원천을 읽어 채우는 패턴 | 시계열 조회 · 마스터 · 권한 · 알람 규칙 캐시 | write-through — 쓰는 쪽이 캐시를 갱신 · 최신값 Hash만 이 방식이다 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| 캐시 무효화 | 원천 변경 후 캐시를 지우는 것 | **커밋 후 DEL**이 규칙이다. 커밋 전에 지우면 사이에 옛 값이 다시 채워져 영구히 남는다. 갱신이 아니라 삭제한다 | TTL 만료 — 시간이 지우는 것 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 해상도 자동 선택 | 조회 범위 길이로 원시 · 1m · 1h · 1d 테이블을 서버가 고르는 것 | 편의가 아니라 **보호 장치**다. 없으면 긴 범위의 원시 조회가 ClickHouse를 메모리 한계로 죽인다 | 다운샘플링 — 선택 뒤 남은 포인트를 줄이는 것 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| 시간 스냅 | 캐시 키의 from · to를 버킷 경계로 내림하는 정규화 | 없으면 초 단위 now()로 매 요청이 다른 키가 된다. SW-04가 켜고 끈다 | 버킷 — 롤업 집계 단위 | [05_units_and_time.md](./05_units_and_time.md) |
| 캐시 스탬피드 | 같은 키가 동시에 미스 나 원천에 같은 무거운 쿼리가 몰리는 현상 | lock:rebuild:q:{sha1} SET NX로 한 요청만 원천을 읽고 나머지는 대기 후 재조회한다. SW-05가 켜고 끈다 | 썬더링 허드 — 같은 현상의 다른 이름 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| single-flight | 같은 작업을 동시에 하나만 실행하게 하는 락 사용법 | 캐시 재구성 · 최신값 복원 · 롤업 잡에 쓴다. 해제는 **소유자 검증 Lua**로 한다 — 단순 DEL은 만료 후 남의 락을 지운다 | 분산 트랜잭션 — 쓰지 않는다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 지터 | TTL 등 시간값에 더하는 무작위 가산 | 동시 만료를 흩어 스탬피드를 막는다(2계층) | 백오프 — 재시도 간격 증가 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| 다운샘플링 · LTTB | 응답 포인트를 화면 폭에 맞게 줄이는 것 · 형태와 스파이크를 보존하는 삼각형 면적 기반 방법 | 롤업이 1차, API의 LTTB가 2차로 줄인다. 단순 n번째 추출은 스파이크를 잃어 쓰지 않는다 | 롤업 — 저장 단계의 축소 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| 스로틀링 | 짧은 창 안의 갱신을 병합해 한 번만 보내는 것 | WebSocket 푸시는 창 안 같은 태그의 중간값을 버리고 최종값만 보낸다. SW-07이 창 크기를 정한다 | 레이트 리밋 — 요청을 거절 · 스로틀링은 병합 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |

## 6. 흐름 제어 · 장애

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| 백프레셔 | 하류가 느릴 때 상류에 감속 · 거절 신호를 거꾸로 보내는 것 | 미확인 적체(그룹 lag + pending — XLEN이 아니다 · ADR-21)로 5단계를 가른다. **버퍼가 차면 조용히 버리지 않고 실패시키고 계측한다** | 스로틀링 — 표시 빈도 조절 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| degrade | 의존 요소 실패 시 기능을 낮춰 계속 서비스하는 것 | 캐시 계열 Redis 실패는 짧은 타임아웃 뒤 DB로 우회한다 | 명시적 실패 — 봉인 계열은 반대로 실패시킨다 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 명시적 실패 | 오류를 숨기지 않고 호출자에게 돌려 상위 대응을 발동하는 것 | 봉인 계열 쓰기 실패 → 스풀 전환 · Redis 접속 불가 시 최신값 503 | 조용한 유실 — MAXLEN 트리밍 · allkeys 축출 | [02_error_codes.md](./02_error_codes.md) |
| at-least-once | 최소 한 번 전달 — 중복은 허용하고 유실은 막는 보장 | XACK를 삽입 성공 뒤로 미뤄 얻는다. 중복은 중복 제거 토큰이 막아 exactly-once에 준하는 효과가 난다 | exactly-once — 전송 계층이 보장하지 않는다 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 멱등 | 같은 작업을 여러 번 해도 결과가 한 번과 같은 성질 | 배치 삽입의 멱등은 결정적 토큰이 만든다. SW-08을 끄면 재시도 중복을 재현한다 | 순서 보장 — 멱등과 무관하다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| E2E 지연 | 측정 시각부터 조회 가능 시각까지의 전체 지연 | ingested_at − ts 하나로 잰다 | Stream 대기 지연 — 한 구간 · 엔트리 단위 | [05_units_and_time.md](./05_units_and_time.md) |
| 목적이 다른 세 쓰기 | 한 판정 결과를 성격이 다른 세 저장소에 각자 쓰는 것 | 알람의 PostgreSQL(확정 이벤트) · ClickHouse(판정 전수) · Redis(핫 상태). 부분 실패 시 진실은 alarm_event다 | dual-write · CDC — 같은 데이터의 복제 · 이것은 복제가 아니다 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |

## 7. 실행 환경 · 웹

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| BFF | Backend For Frontend — 웹 전용 서버 계층 | Next.js Route Handler. 로그인 · 토큰 갱신(httpOnly 리프레시 쿠키) · 저빈도 조회 · 작업지시 CRUD만 거친다 | 직결 경로 — 최신값 · 시계열 · WebSocket은 BFF를 거치지 않고 api로 바로 간다 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 직결 경로 | 브라우저가 api 포트에 바로 요청하는 경로 | 고빈도 · 대용량 요청. 오리진은 CORS 허용 목록, 신원은 Bearer 액세스 토큰으로 검증한다 | 프록시 — 두지 않는다 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| APP_ROLE | 한 이미지에서 기동할 모듈 범위를 고르는 환경변수 | 기본 all. 역할 분리(확장 로드맵 1단계)는 코드 변경 없이 이 값만 바꾼다 | 역할 스위치 SW-NN — Redis 역할을 끄고 켜는 실험 손잡이 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 볼륨 | 컨테이너 밖에 유지되는 저장 영역 | named volume 4 — pgdata · chdata · redisdata · spooldata. bind mount는 Docker Desktop 파일 공유 계층을 타 DB 랜덤 I/O가 느려져 쓰지 않는다 | bind mount — 호스트 경로 직접 연결 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| 스냅샷 · 복원 | 실험 전 볼륨을 통째로 묶고 되돌리는 절차 | task snapshot · task restore. 없으면 같은 조건의 재측정이 불가능하다 | AOF — 저장소 자체의 영속화 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 메모리 프로파일 | Docker 할당 메모리 기준의 컨테이너 상한 묶음 | 부하 실험 · 개발 2종. 성능 수치는 부하 실험 프로파일에서만 기록한다 | 용량 티어 — 데이터 양의 축 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| 용량 티어 | 부하 · 데이터 규모 단계 | S · M · M+ · L. 측정 기록 4요소의 하나 | 메모리 프로파일 — 자원의 축 | [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) |

## 8. 실험

| 용어 | 정의 | 이 시스템에서의 쓰임 | 혼동하기 쉬운 인접 용어 | 정본 |
|------|------|------------------|-------------------|------|
| 역할 스위치 | Redis의 역할 하나(또는 데드밴드)를 끄고 켜는 실험 손잡이 | SW-NN. 환경변수 + DI 초기화 선택이라 **런타임 토글이 아니다** — 바꾸려면 재기동한다 | 기능 플래그 — 런타임 전환 · 쓰지 않는다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| 대조군 | ClickHouse와 같은 데이터 · 같은 쿼리를 PostgreSQL에 두는 비교 대상 | plc_tag_raw_control. **중복 저장이 아니라 실험 계측물**이며 SW-09 off가 기본이다 | 백업 · 복제 — 대조군은 운영 데이터가 아니다 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| 주입 모드 | 생성 데이터를 어느 계층에 넣는가(A~D) | 한 번에 하나의 계층만 부하를 준다 | 신호 프로파일 — 값의 모양 · 주입 모드는 경로 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 신호 프로파일 | 생성기가 값을 만드는 규칙(8종) | 압축률 실험의 축. 생성 데이터는 SIMULATED로 표지한다 | 부하 시나리오 — 시간에 따른 부하 모양 | [03_enums_state_machines.md](./03_enums_state_machines.md) |
| pps | points per second — 초당 포인트 수 | 수집 · 적재 부하의 단위. 포인트 하나 = tag_raw 행 하나 | rps — 초당 HTTP 요청 수 · 모드 C에서만 둘이 함께 쓰인다 | [05_units_and_time.md](./05_units_and_time.md) |
| 부하 시나리오 | k6로 주입하는 부하의 시간 모양 | Baseline · Ramp-up · Spike · Soak · Breakpoint + k6 밖의 장애 주입 | 주입 모드 — 경로의 축 | [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) |

## 표기 규칙

| 규칙 | 내용 | 이유 |
|------|------|------|
| 제품 · 자료구조 고유명 | Stream · Pub/Sub · Hash · Dictionary · MV는 영문 대문자 시작으로 쓴다 | "스트림"과 "stream:plc:raw 키"를 문장에서 가를 수 있게 한다 |
| 개념 용어 | 컨슈머 그룹 · 컨슈머 랙 · 백프레셔 · 데드밴드는 한글 음차로 쓴다 | 명령(XACK · XAUTOCLAIM)과 개념이 한 문장에 섞일 때 명령만 영문으로 남는다 |
| 명령 · 설정 이름 | XADD · XACK · XAUTOCLAIM · MAXLEN · volatile-lru는 원문 그대로 평문 | 인라인 백틱을 쓰지 않으므로 원문 표기 자체가 식별 표지다 |
| "큐" | Redis Stream을 "큐"라고 부르지 않는다 | 큐는 소비하면 사라진다는 통념을 불러 XACK 뒤 잔존 · 트리밍 · 재처리 서술을 틀리게 읽힌다 |
| "캐시" | 최신값 Hash를 "캐시"라고 부르지 않는다 | 캐시 계열(TTL 필수 · degrade)과 봉인 계열(TTL 금지 · 명시적 실패)의 정반대 정책이 이름에서 섞인다 |
| "동기화" | 알람의 세 쓰기를 "동기화"라고 부르지 않는다 | 동기화는 같은 데이터를 맞춘다는 뜻이라 CDC 도입 제안의 근거로 오독된다 |
| 흐름 ID | F-NN만 쓴다 | 원본 표기 대응은 [04_id_conventions.md](./04_id_conventions.md) |

## 관련 문서

- [03_enums_state_machines.md](./03_enums_state_machines.md) — 품질 코드 · 신호 프로파일 · 상태 머신 값
- [05_units_and_time.md](./05_units_and_time.md) — 시각 · 단위 · 부동소수 비교
- [04_id_conventions.md](./04_id_conventions.md) — 키 · 컨슈머 · 흐름 ID 규약
- [02_error_codes.md](./02_error_codes.md) — 명시적 실패가 내는 코드
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 3계층 분기 정책
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 봉인 계열 · 캐시 계열 키 전수
