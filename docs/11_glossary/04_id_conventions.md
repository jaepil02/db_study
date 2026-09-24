# ID 규약 (04_id_conventions)

> **대상**: db_study 문서군과 구현이 쓰는 모든 식별자의 형식 · 채번 규칙 · 결번 · 예약 대역 · 원본 흐름 표기 대응 — ID 규약 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 식별자 자리 예시 rl:{user_id}:{unix_minute} → **rl:{class}:{user_id}:{unix_minute}**(정본 05_data_stores/05)
> **개정일**: 2026-09-24 — 루트 README ID 규약 표의 API 표면 형식을 {문서} #N으로 맞춘 것을 반영 — 불일치 서술을 정합 서술로 바꾼다
> **원천**: [../README.md](../README.md) ID·표기 규약 표 상세화 · 원본 data_flow.md §1(커밋 ff66a37) 흐름 목록 · 원본 architecture.md §6 · §7 · §8.3(커밋 ff66a37) 테이블 · 키 네이밍 · docs_plan.md 실행 계획 보정 #6 · #22

이 문서는 **식별자를 어떻게 만들고 어떻게 버리는가**를 고정한다. 각 ID의 값 목록은 채번 정본이 갖고, 이 문서는 형식과 수명 규칙만 갖는다. [../README.md](../README.md)의 ID·표기 규약 표는 이 문서의 요약이며 둘이 어긋나면 이 문서가 우선한다.

규칙의 축은 하나다 — **번호는 식별자이지 순서가 아니다.** 순서를 표현하려고 번호를 옮기는 순간 그 번호를 인용한 모든 문서 · 커밋 메시지 · 측정 기록이 조용히 다른 대상을 가리키게 된다.

## ID 형식 전수

| 종류 | 형식 | 예 | 채번 정본 | 자릿수 |
|------|------|-----|----------|--------|
| 기능 ID | {도메인 접두}-NN | ING-03 | [../02_features](../02_features/README.md) 도메인 파일 | 2자리 0 채움 |
| 요구사항 | REQ-{접두}-NN — 도메인 접두 11 + 횡단 GLB · NFR · TEC | REQ-GLB-01 | [../03_requirements](../03_requirements/README.md) 각 파일 | 2자리 |
| 인수 기준 | AC-NN | AC-01 | [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md) | 2자리 |
| 기술 결정 | ADR-NN | ADR-01 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) | 2자리 |
| 제품·학습 결정 | D-NN | D-01 | [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) | 2자리 |
| **데이터 흐름** | **F-NN** | F-01 | [../06_pipeline/01_flow_inventory.md](../06_pipeline/01_flow_inventory.md) | 2자리 |
| **역할 스위치** | **SW-NN** | SW-01 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) | 2자리 |
| **실험** | **EXP-NN** | EXP-01 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) | 2자리 |
| 화면 코드 | {표면}-{의미} — 대문자 · 하이픈 | DSH-REALTIME | [../08_screen/README.md](../08_screen/README.md) | 해당 없음 |
| API 표면 | {문서} #N — 문서 지역 번호 | 05_timeseries #3 | 각 [../07_api](../07_api/README.md) 도메인 파일 | 자릿수 없음 |
| 에러 코드 | {domain}.{snake_case}/{HTTP} | datagen.stream_full/503 | [02_error_codes.md](./02_error_codes.md) | 해당 없음 |
| 테이블 · 컬럼 | snake_case | tag_raw · tag_master.tag_id | [../05_data_stores](../05_data_stores/README.md) | 해당 없음 |
| Redis 키 | 영역:용도:식별자 | rt:latest:{device_id} | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | 해당 없음 |
| 메트릭 | snake_case — 이름 규약의 정본은 메트릭 카탈로그 | consumer_lag | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | 해당 없음 |
| 측정 기록 파일 | docs/measurements/NNN-{slug}.md | 001-control-1h-query.md | 기록 작성자 — 형식 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) | 3자리 |

- **2자리 번호가 99를 넘으면 자릿수를 늘린다.** 기존 ID를 3자리로 다시 쓰지 않는다 — F-01을 F-001로 고치면 앞선 커밋 메시지와 측정 기록의 인용이 grep에서 빠진다.
- **API 표면 번호의 표기는 "{문서} #N"(공백 1칸)이다.** 하이픈을 넣으면 화면 코드({표면}-{의미})와 같은 모양이 되어 grep 한 번으로 둘을 가를 수 없다. [../README.md](../README.md) ID 규약 표도 이 표기로 맞췄다(2026-09-24).
- **식별자 표기는 평문이다.** 인라인 백틱으로 감싸지 않으며, 신설 · 강조할 때만 굵게 쓴다.

## 채번 · 재배치 · 결번 규칙

| 규칙 | 내용 | 어기면 생기는 실패 |
|------|------|------------------|
| 정본 채번 | 새 ID는 위 표의 채번 정본에서만 만든다. 다른 문서는 인용만 한다 | 두 문서가 같은 번호를 서로 다른 대상에 붙여, 추적성 표에서 한 ID가 두 행을 갖는다 |
| 말미 채번 | 새 번호는 현재 최댓값 + 1이다. 빈 번호를 메우지 않는다 | 결번을 메운 번호를 옛 커밋이 폐지 전 의미로 인용하고 있어, 과거 기록이 새 대상을 가리킨다 |
| 재배치 금지 | 의미상 순서가 바뀌어도 번호를 옮기지 않는다. 순서는 표의 행 순서나 별도 열로 표현한다 | F-NN · EXP-NN을 인용한 측정 기록 파일 머리가 전부 틀린다. 측정 기록은 사후에 고치지 않으므로 복구 경로가 없다 |
| 결번 영구 보존 | 폐지한 ID는 정본 표에 **폐지 행으로 남긴다** — 폐지일 · 사유 · 대체 ID | 폐지 행이 없으면 "없는 ID"와 "지운 ID"를 구분할 수 없어 옛 인용이 유령 링크로 읽힌다 |
| 폐지 번호 재사용 금지 | 결번은 어떤 대상에도 다시 주지 않는다. 품질 코드 6~8 결번과 같은 원리다 | 재사용된 번호로 과거 실험을 재현하면 다른 조건으로 측정한 수치를 같은 실험으로 비교하게 된다 |
| 개명 | ID의 이름만 바꾸는 개명은 ID를 유지한다. 의미가 바뀌면 개명이 아니라 폐지 + 신설이다 | 의미가 바뀐 SW-NN을 같은 번호로 두면 전후 측정 기록이 같은 스위치로 묶여 비교된다 |

## 예약 대역

번호 대역 예약은 **아직 쓰지 않은 번호가 특정 뜻에 묶여 있음**을 선언한다. 예약 대역의 번호는 그 뜻 밖으로 채번하지 않는다.

| 대상 | 예약 | 이유 |
|------|------|------|
| 02_features 파일 번호 | **14 이상 사용 금지** | 01~11 도메인 · 12 권한 매트릭스 · 13 스위치 매트릭스로 닫혀 있다. 기능 추가는 도메인 파일 안의 기능 ID로 한다 — 파일을 늘리면 [../03_requirements](../03_requirements/README.md)의 +1 오프셋 대응이 깨진다 |
| 03_requirements 파일 번호 | **17 이상 사용 금지** | 01 전역 · 02~12 도메인 · 13 비기능 · 14 AC · 15 추적성 · 16 공식 참조로 닫혀 있다 |
| 05_data_stores 파일 번호 07~10 | **횡단 문서 예약 대역** | 07 교차 저장소 정합성 · 08 보존 수명주기 · 09 마이그레이션 시드 · 10 대조군. 타 폴더의 인바운드 링크가 이 번호에 고정되므로 재배치하지 않는다 |
| EXP-01~EXP-05 | **PostgreSQL 대조군 실험 예약** | 대조군 동일 쿼리 5종(단일 태그 1시간 · 단일 태그 7일 · 설비 전체 1일 · 분 단위 롤업 재계산 · 전체 스캔 count)의 자리다. 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(설계) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(실행) |
| 품질 코드 6~8 | **결번** | 값 목록과 결번 사유의 정본은 [03_enums_state_machines.md](./03_enums_state_machines.md) |

- **예약 대역은 [../README.md](../README.md)와 [../CLAUDE.md](../CLAUDE.md)의 구조 절이 함께 인용한다.** 대역을 바꾸면 세 문서를 같은 변경 단위에서 고친다.
- 파일명의 정본은 각 폴더 README의 파일 목차다. 린트(.omc/docs_lint.py)의 예정 파일 목록이 같은 목록이며, 목차 밖 파일은 린트가 "계획에 없는 파일"로 막는다.

## 원본 흐름 표기 대응 (F1~F10 → F-01~F-10)

원본 설계서는 흐름을 F1~F10으로 적었다. 문서군은 **F-NN만 쓴다**(docs_plan.md 실행 계획 보정 #6). 아래 표는 원본 표기가 문서군 안에 나타나는 **유일한 자리**다 — 원본 절을 추적할 때만 이 표를 거친다.

| 원본 표기 | 문서군 ID | 흐름 | 원본 절 | 기전 정본 |
|----------|----------|------|--------|----------|
| F1 | **F-01** | PLC 수집 | 원본 data_flow.md §3 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| F2 | **F-02** | 배치 적재 | 원본 data_flow.md §4 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| F3 | **F-03** | 최신값 조회 | 원본 data_flow.md §5 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| F4 | **F-04** | 시계열 이력 조회 | 원본 data_flow.md §6 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| F5 | **F-05** | 업무 데이터 CRUD | 원본 data_flow.md §7 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| F6 | **F-06** | 알람 판정 | 원본 data_flow.md §8 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| F7 | **F-07** | 실시간 푸시 | 원본 data_flow.md §9 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| F8 | **F-08** | 롤업 집계 | 원본 data_flow.md §10 | [../06_pipeline/09_rollup.md](../06_pipeline/09_rollup.md) |
| F9 | **F-09** | 테스트 데이터 주입 | 원본 data_flow.md §11 | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) |
| F10 | **F-10** | 백프레셔와 장애 | 원본 data_flow.md §12 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) |

검산: 원본 표기 10 = 문서군 ID 10(F-01~F-10) · 기전 정본 파일 9(F-03 · F-07이 05_realtime_read 하나를 공유) = **10 대응 · 9 파일**

- **원본 절 번호와 흐름 번호는 2만큼 어긋난다**(F-01 = §3). 원본 §1 흐름 목록 · §2 전체도가 앞에 있기 때문이며, 원천 줄을 쓸 때 흐름 번호로 절을 추정하지 않는다.
- **F-03과 F-07은 한 파일에 산다.** 둘 다 "Redis의 휘발 사본을 읽는다"는 같은 기전이라 묶었다. 파일이 하나라고 흐름 ID를 합치지 않는다 — 지연 목표와 병목 지표가 다르다(원본 data_flow.md §1 · §16).

## 도메인 접두와 파생 이름

도메인 접두 하나가 기능 ID · REQ · 모듈 · 에러 네임스페이스 · API 문서로 파생된다. 파생 규칙을 한 표에 두어 표기 흔들림을 막는다.

| 접두 | NestJS 모듈 | 에러 네임스페이스 | API 문서 | 비고 |
|------|------------|-----------------|---------|------|
| AUT | auth | auth | [../07_api/03_auth.md](../07_api/03_auth.md) | |
| MST | master | master | [../07_api/04_master.md](../07_api/04_master.md) | |
| COL | collector | **없음** | **없음** | 내부 모듈 |
| SIM | plc-sim | **없음** | **없음** | 내부 모듈 · 테이블 없음 |
| GEN | datagen | datagen | [../07_api/09_datagen.md](../07_api/09_datagen.md) | 부하 주입 표면 /api/v1/ingest/bulk 소유 · 테이블 없음 |
| ING | ingest | **없음** | **없음** | 내부 모듈 — URL에 ingest가 있어도 표면 소유자가 아니다 |
| TSQ | timeseries | timeseries | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | |
| RLT | realtime | realtime | [../07_api/06_realtime.md](../07_api/06_realtime.md) | WebSocket은 [../07_api/11_websocket.md](../07_api/11_websocket.md) |
| ALM | alarms | alarms | [../07_api/07_alarms.md](../07_api/07_alarms.md) | |
| WRK | work-orders | work_orders | [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 모듈명 하이픈 → 네임스페이스 밑줄 |
| OBS | metrics | metrics | [../07_api/10_metrics.md](../07_api/10_metrics.md) | /api/v1/health · /metrics 소유 |

검산: 도메인 11 = 네임스페이스 있음 8(AUT · MST · GEN · TSQ · RLT · ALM · WRK · OBS) + 없음 3(COL · SIM · ING) = **11**

- **네임스페이스는 URL 경로가 아니라 표면 소유 도메인을 따른다.** /api/v1/ingest/bulk의 에러가 datagen 네임스페이스인 이유다. 판정 근거는 [02_error_codes.md](./02_error_codes.md)의 네임스페이스 배정 규칙이 갖는다.
- 네임스페이스 없는 도메인이 있다는 것은 누락이 아니라 설계 진술이다. 도메인 전수와 평면 분류의 정본은 [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)다.

## 저장소 식별자

| 대상 | 규칙 | 예 | 근거 · 실패 |
|------|------|-----|-----------|
| PostgreSQL 테이블 | snake_case 단수형 | site · device · tag_master · alarm_event | 원본 architecture.md §6 ERD가 단수형이다. 복수형을 섞으면 ORM 매핑과 SQL이 테이블마다 다른 규칙을 탄다 |
| PostgreSQL 컬럼 | snake_case · 기본키는 {대상}_id · 시각은 _at 또는 planned_ 접두 | tag_id · occurred_at · planned_start | 예약어와 겹치는 이름은 접미로 피한다 — offset이 아니라 offset_value |
| ClickHouse 데이터베이스 | plc 단일 | plc.tag_raw | 객체는 항상 데이터베이스로 한정해 쓴다. 한정하지 않으면 default 데이터베이스에 같은 이름 테이블이 생겨도 오류 없이 다른 곳에 삽입된다 |
| ClickHouse 롤업 테이블 | tag_{해상도} | tag_1m · tag_1h · tag_1d | 해상도 값 1m · 1h · 1d가 조회 요청 interval 값과 같다 — 해상도 선택 로직이 문자열 하나로 테이블을 고른다 |
| ClickHouse MV | mv_{타깃 테이블} | mv_tag_1m | 타깃 이름을 그대로 담아 DETACH 대상을 이름만으로 찾는다(백필 절차) |
| ClickHouse Dictionary | dict_{원천} | dict_tag | |
| 대조군 테이블 | {원형}_control 계열 | plc_tag_raw_control | 대조군임이 이름에서 드러나야 업무 테이블 집계(14)에 섞이지 않는다 |

- 테이블 전수 · 컬럼 명세의 정본은 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md)다. 제약 · 인덱스 이름 규칙은 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)가 정한다.

## Redis 키 · 채널 · 컨슈머 이름

| 대상 | 규칙 | 예 | 근거 · 실패 |
|------|------|-----|-----------|
| 키 | 영역:용도:식별자 — 콜론 계층, 앞이 넓은 범주 | rt:latest:12 · cache:q:{sha1} | 원본 architecture.md §8.3 |
| 영역 접두 | stream · rt · alarm · cache · lock · rl · sess · auth · ch 중 하나 | | **접두 하나가 곧 TTL 정책의 경계다.** 봉인 계열 · 캐시 계열 · 채널 구분과 검산의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 접두 충돌 금지 | 새 용도가 기존 접두의 TTL 정책과 다르면 기존 접두를 빌리지 않는다 | 리프레시 토큰은 rt:가 아니라 auth:refresh: | 원본에서 실제로 rt:{refresh_token_id}가 최신값 계열 rt:와 겹쳐 개명됐다. 빌려 쓰면 TTL 금지 접두 아래에 TTL 키가 생겨 린트 · 래퍼가 어느 쪽 규칙도 적용하지 못한다 |
| 식별자 자리 | 숫자 ID는 그대로 · 해시는 소문자 16진 · 시각은 epoch 정수 | rl:{class}:{user_id}:{unix_minute} | 시각을 문자열 날짜로 넣으면 시간대에 따라 같은 분이 다른 키가 된다 |
| Pub/Sub 채널 | ch: 접두 | ch:rt:{device_id} · ch:alarm · ch:cacheinv | 키가 아니므로 TTL 대상이 아니다 |
| 컨슈머 그룹 | grp:{소비 모듈} | grp:ingest | **키가 아니라 Stream 안의 이름이다** — 영역 접두 집계에 들지 않는다 |
| 컨슈머 | {모듈}-{pid}-{n} | ingest-{pid}-1 | pid가 바뀌면 이전 이름의 PEL이 남는다. XAUTOCLAIM 회수가 이 이름 규칙을 전제한다 |
| 금지 명령 | KEYS 금지 · SCAN + COUNT만 | | 단일 인스턴스에서 KEYS는 Stream 소비까지 멈춘다 |

## 화면 코드 · API 표면 번호 · 에러 코드

| 대상 | 규칙 | 금지 |
|------|------|------|
| 화면 코드 | {표면}-{의미}. 표면 접두는 대문자, 의미는 대문자 영단어 · 하이픈 연결 | 번호형 화면 코드(SCR-01)를 쓰지 않는다 — 화면은 기능 ID와 1:1이 아니라 번호가 두 축을 흉내 내게 된다. 표면 접두 목록의 정본은 [../08_screen/README.md](../08_screen/README.md) |
| API 표면 번호 | 문서 지역 번호 {문서} #N. 인용은 문서 링크 + #N | 전역 일련번호를 쓰지 않는다 — 한 문서에 표면을 더할 때 다른 문서의 번호가 밀린다 |
| 에러 코드 | {domain}.{snake_case}/{HTTP}. domain은 네임스페이스, snake_case는 원인 명사구 | HTTP 상태를 이름에 넣지 않는다(stream_full_503 금지). 같은 원인에 상태만 다른 코드를 두지 않는다 |

## 측정 기록 파일명

| 요소 | 규칙 | 이유 |
|------|------|------|
| 위치 | docs/measurements/ — 번호 없는 예외 폴더 | 설계 정본이 아니므로 공통 골격 검사 · 파일 수 집계에서 빠진다 |
| 이름 | NNN-{slug}.md. NNN은 3자리 일련번호 · slug는 소문자 영문 · 숫자 · 하이픈 | 실행 횟수가 실험 수보다 훨씬 많아 2자리로 닫히지 않는다 |
| 머리 | 첫 머리에 **EXP-NN을 인용**한다 | 파일명에 EXP-NN을 넣지 않는다 — 한 기록이 여러 실험을 함께 잴 수 있고, 실험 재채번이 없으므로 머리 인용으로 충분하다 |
| 불변 | 기록은 사후에 고치지 않는다. 잘못된 기록은 새 번호로 정정 기록을 쓰고 옛 기록을 인용한다 | 측정 수치의 4요소(커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태)가 기록 시점에 고정되어야 재현할 수 있다 |

- 기록 본문 형식의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)다.

## 관련 문서

- [../README.md](../README.md) — ID·표기 규약 요약 · 고정 기준
- [../CLAUDE.md](../CLAUDE.md) — 번호 대역 · 채번 유일성 규칙
- [02_error_codes.md](./02_error_codes.md) — 에러 코드 채번 정본
- [03_enums_state_machines.md](./03_enums_state_machines.md) — 품질 코드 결번 · enum 값
- [../06_pipeline/01_flow_inventory.md](../06_pipeline/01_flow_inventory.md) — F-NN 채번 정본
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — Redis 키 전수 · 봉인 표
