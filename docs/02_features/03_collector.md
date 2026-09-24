# COL — 수집 기능 명세

> **대상**: 수집(COL · NestJS collector 모듈) 기능 목록 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 · 모드 A의 SIMULATED 표지 판정 — 기능 ID COL-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W4 판정 반영 — COL-01 기동 로드 원천 cache:tagmeta → **PostgreSQL**(캐시는 워밍 대상) · 실행 중 마스터 변경 ch:cacheinv 반영 · COL-09 위험 판정량 길이 → **미확인 적체** · 미확인 5행 W4 판정 반영 — 기능 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 백프레셔 판정량 XLEN → 그룹 적체(ADR-21) · COL-08의 SW-10 off 상호작용은 무동작으로 닫힘(ADR-24)
> **원천**: 원본 tech_stack.md §3.4 · §6 · §7(커밋 ff66a37) · 원본 data_flow.md §3 · §3.1 · §3.2 · §3.3 · §12.1 · §14.1 · §17(커밋 ff66a37) · 원본 architecture.md §3 · §4 · §9 · §9.3 · §17(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S3 · S6 · §7.2 · §7.5(커밋 ff66a37) · D-08 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 품질 코드 · [13_switch_matrix.md](./13_switch_matrix.md) SW-01 · SW-10

COL은 **PLC 레지스터를 정규화된 포인트로 바꿔 Stream 입구에 놓는 도메인**이다. 설비마다 Modbus 연결을 하나씩 열고, 스캔 그룹별로 폴링하고, 레지스터를 디코딩 · 품질 판정 · 데드밴드 필터를 거쳐 스캔 사이클 하나를 Stream 엔트리 하나로 발행한다(원본 data_flow.md §3). DB에 직접 쓰지 않고 Ingest를 직접 부르지 않는다 — 수집과 적재 사이에는 반드시 Stream이 있다(전역 불변식 "비동기 경계").

**COL은 외부 표면이 없다.** 호출 주체가 내부(기동 · 폴링 타이머)이고 HTTP 응답을 만드는 자리가 없으므로 [../07_api](../07_api/README.md)에 문서가 없고 에러 네임스페이스도 없다. 실패는 에러 코드가 아니라 **품질 코드 · 메트릭 · 스풀 전환**으로 드러난다. 이 공백은 누락이 아니라 설계 진술이다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) 폴더별 도메인 공백).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))다.

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **COL-01** | 수집 정의 로드 | 기동 시 **PostgreSQL에서** 활성 태그 목록과 설비별 접속 설정(modbus_config)을 읽어 설비 × 스캔 주기로 스캔 그룹을 만들고 cache:tagmeta:{tag_id}를 워밍한다 — 태그별 키는 설비의 태그를 열거할 수 없어 기동 로드의 원천이 되지 못한다(W4 판정). 폴링 중에는 메모리 사본을 쓰고 매 포인트마다 PostgreSQL을 읽지 않는다. 실행 중 마스터 변경은 ch:cacheinv 신호로 해당 설비만 다음 사이클 경계에 다시 읽는다 | S2 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | Redis cache:tagmeta · PostgreSQL tag_master · modbus_config(읽기) |
| **COL-02** | 스캔 그룹 폴링 | 설비당 Modbus 연결 1개 위에서 스캔 그룹마다 폴링 루프를 돌린다. 응답 타임아웃(설비별 timeout_ms)이면 그 그룹은 그 주기를 건너뛴다. **ts는 Collector가 폴링 시점에 찍는다** — Modbus 응답에는 시각이 없다. S2는 루프 1 · FC03 요청 1이다 | S2 · S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음(PlcSim 소켓) |
| **COL-03** | 레지스터 블록 병합 | 연속 주소 태그를 한 요청으로 묶고, 사이의 안 쓰는 레지스터를 일정 개수까지 함께 읽는 **갭 허용 병합**으로 요청 수를 더 줄인다. 상한은 FC03 요청당 125 레지스터(1계층 프로토콜 제약)이고 허용 갭 크기는 2계층 조정값이다. 병합이 없으면 태그 1개당 요청 1회가 되어 폴링 주기를 넘긴다 | S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 |
| **COL-04** | 디코딩 · 공학 단위 변환 | 워드 순서 적용 → 타입 변환 → eng = raw × scale + offset_value 순서로 값을 만든다. S2는 FLOAT32 · ABCD만, S3에서 data_type 7종 · word_order 4종 전부. **word_order가 틀려도 예외가 나지 않는다** — 엉뚱한 유한값으로 풀리고 범위 판정(COL-05)에서만 드러난다 | S2 · S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 |
| **COL-05** | 품질 판정 | 값마다 품질 코드를 단다 — 범위 밖 BAD_RANGE(4) · Modbus 예외 응답 BAD_COMM(2) · 타임아웃 BAD_TIMEOUT(3 — **행을 만들지 않는다**) · 시뮬레이션 설비의 정상 값 SIMULATED(9) · 실설비의 정상 값 GOOD(0). 시뮬레이션 설비 판정과 코드 우선순위는 §모드 A의 SIMULATED 표지 판정이 고정한다. S2는 GOOD · SIMULATED만 | S2 · S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 |
| **COL-06** | 데드밴드 필터 | 직전 전송값 대비 변화량이 tag_master.deadband(공학 단위 절대값)보다 작으면 전송을 생략한다. **원본 파형을 잃으므로 성능 측정은 데드밴드 비활성으로 하고 효과는 별도 실험으로 잰다** — 두 조건을 섞으면 처리량 수치가 의미를 잃는다(원본 data_flow.md §3.3). SW-10이 켜고 끈다 | S3 | F-01 | SW-10 | 표면 없음 — 내부 모듈 | 없음 |
| **COL-07** | 인코딩 · Stream 발행 | 스캔 사이클 하나를 MessagePack 컬럼 배열 엔트리 하나(스키마 버전 v · 설비 d · 시퀀스 s · 기준 시각 t0 · 태그 tg · 오프셋 dt · 값 va · 품질 q)로 만들어 stream:plc:raw에 XADD한다. 같은 파이프라인에 컨슈머 그룹 적체(lag + pending) 조회를 실어 매 사이클 확인한다 — 이것이 백프레셔 1차 신호의 원천이다. **XLEN은 판정량이 아니다**(확인된 엔트리가 MAXLEN까지 남는 충전량 — ADR-21). SW-01 off면 Stream 대신 Ingest를 프로세스 안에서 직접 부른다(실험 전용) | S2 | F-01 · F-02 | SW-01 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |
| **COL-08** | 발행량 감축 | 백프레셔 **경고** 단계에서 데드밴드를 임시로 강화해 발행량을 줄이고 deadband_boost_active를 켠다. 임계는 2계층 조정값이며 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) | S6 | F-10 | SW-10(상호작용 미확인) | 표면 없음 — 내부 모듈 | 없음 |
| **COL-09** | 스풀 전환과 재발행 | 백프레셔 **위험** 단계(미확인 적체 > 위험 임계 — XLEN이 아니다)이거나 XADD가 실패하면(OOM · 연결 끊김) spooldata 볼륨의 /app/spool에 길이 접두 + MessagePack 프레임을 쌓고 spool_active를 켠다. 복구 단계에서 프레임을 앞에서부터 순차 재발행한다. Stream 엔트리와 포맷이 같아 재발행에 변환 코드가 없다 | S6 | F-10 | 해당 없음 | 표면 없음 — 내부 모듈 | spooldata 볼륨(저장소 밖) · Redis stream:plc:raw |

- 검산: COL-01~09 = **9**. 단계별(첫 도입 기준) S2 5(COL-01 · 02 · 04 · 05 · 07) + S3 2(COL-03 · 06) + S6 2(COL-08 · 09) = **9**
- 표면 없음 9 = COL-01~09 전부. COL은 [12_permission_matrix.md](./12_permission_matrix.md)에서 "내부"로 센다.

## 모드 A의 SIMULATED 표지 판정

**판정: 시뮬레이션 설비는 설비의 접속 대상으로 가른다.** Collector는 modbus_config.host가 컨테이너 루프백이면 그 설비를 시뮬레이션 설비로 보고, 그 설비의 정상 값에 SIMULATED(9)를 단다. 웨이브 인계 "모드 A에서 SIMULATED(9)를 붙이는 방법(레지스터에 품질 필드 없음)"을 이 절이 닫는다. 생성 모드 B · C · D의 표지는 생성기가 직접 싣는다([05_datagen.md](./05_datagen.md) GEN-02).

근거는 원본의 배치 사실 둘이다 — PlcSim은 컨테이너 내부 루프백(127.0.0.1:5020~5119)에만 바인드하고 publish하지 않는다(원본 architecture.md §3 · 원본 tech_stack.md §6). 실장비는 LAN 너머에 있어 api 컨테이너의 루프백일 수 없다. 따라서 **루프백 접속 대상 = 시뮬레이터**가 구조로 참이다.

| 안 | 내용 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 접속 대상 판정 | modbus_config.host가 루프백이면 9 | PlcSim을 별도 프로세스(pymodbus)로 떼면 host가 서비스명이 되어 규칙이 깨진다 — 조건부 경로(원본 tech_stack.md §3.4)라 그 시점에 재판정한다 | **채택** |
| ② 전역 환경변수 | Collector 전체에 "지금은 시뮬레이션" 표지 | 실장비 하나가 붙는 순간 한 프로세스 안에 실설비와 시뮬레이션 설비가 섞여 **한쪽 전부가 틀린 표지**를 받는다 | 버림 |
| ③ 설비 마스터 컬럼 신설 | device에 시뮬레이션 여부 컬럼 | 사람이 잘못 설정하면 실데이터가 9로 저장된다. 스키마 변경이 필요하고 접속 대상이라는 이미 있는 사실과 이중 정본이 된다 | 버림 |
| ④ 레지스터에 품질 워드 | 생성기가 품질 워드를 레지스터에 실음 | 시뮬레이터의 레지스터 맵이 실장비와 달라진다 — 실장비로 바꿀 때 디코딩 경로를 고쳐야 해 "접속 주소만 바뀐다"(원본 data_flow.md §3)가 거짓이 된다 | 버림 |

품질 컬럼이 하나라 한 행이 건강 코드와 출처 코드를 동시에 가질 수 없다. 시뮬레이션 설비의 행은 아래 순서로 코드를 고른다.

| 상황(시뮬레이션 설비) | 저장 코드 | 이유 |
|------|------|------|
| Modbus 예외 응답(PlcSim 오류 주입) | BAD_COMM(2) | 품질 코드 전파 검증(원본 data_flow.md §17)과 알람 판정 제외가 이 코드로 성립한다 |
| 범위 밖 값 | BAD_RANGE(4) | 상동 — 9를 달면 범위 밖 값이 알람 판정에 들어간다 |
| 응답 타임아웃(PlcSim 지연 주입) | 행 없음(3) | 결측으로 처리한다 |
| 정상 값 | **SIMULATED(9)** | 출처 표지 |

- **건강 코드(2 · 4)가 출처 코드(9)보다 앞선다.** 이 순서가 전역 불변식 "생성 데이터 구분"을 깨지 않는 이유는 출처가 **설비 단위 규칙**이라서다 — 2 · 4가 달린 행도 device_id → modbus_config.host로 출처를 복원할 수 있다.
- **잔여 — 설비의 접속 대상이 나중에 실장비로 바뀌면 복원이 틀린다.** modbus_config는 이력을 남기지 않는다. 실장비 연결은 현 범위 밖(Out)이며, 되살아날 때 이 행이 경보가 된다.
- **확정 전에는 모드 A 산출이 GOOD(0)으로 저장된다**는 W1 등재([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md))는 이 판정으로 닫힌다 — 리드 반영 대상이다.

## 스위치가 교체하는 것

| 스위치 | 교체 대상 기능 | off일 때 | 이 도메인이 지키는 조건 |
|------|------|------|------|
| SW-01 REDIS_STREAM_BUFFER | COL-07 발행 | Collector가 Ingest를 프로세스 안 큐로 직접 부른다 · **부팅 경고** | 실험 전용이다. ClickHouse 중단과 겹치면 폴링 주기 붕괴와 유실이 난다 — 그것이 실험의 산출물이다 |
| SW-10 COLLECTOR_DEADBAND | COL-06 필터 | 데드밴드 비활성 — 변화량과 무관하게 전부 발행 | 기본이 off다. 성능 측정은 off, 데드밴드 효과는 on으로 따로 잰다 |

- 채번 · 포트 · 예상 차이의 정본은 [13_switch_matrix.md](./13_switch_matrix.md)다. 이 표는 수집 쪽 효과만 적는다.
- **SW-01 off의 스풀 경로는 없다.** Stream이 없으면 XADD 실패도 없어 COL-09가 발동하지 않는다 — ClickHouse 중단의 압력이 곧장 폴링 루프로 역류한다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| COL-01 | 마스터 변경을 실행 중에 다시 읽지 않는다 | §미확인 · 미설계 등재 — 원본에 재적재 신호 없음 |
| COL-02 | 레지스터 값을 만들지 않는다 | SIM-02 · GEN-05 |
| COL-04 | 레지스터에 쓰지 않는다 — 읽기만 한다 | 해당 없음 |
| COL-05 | STALE(5)을 쓰지 않는다 — 조회 시점 판정이다 · UNCERTAIN(1)을 부여할 보간 단계가 없다 | RLT-03 · §미확인 · 미설계 등재 |
| COL-07 | ClickHouse에 쓰지 않는다 · Ingest를 부르지 않는다(SW-01 off 제외) | ING-01 · ING-03 |
| COL-07 | 최신값 Hash를 갱신하지 않는다 — 현행 소유는 Ingest다 | ING-08 · 보정 7.2 |
| COL-09 | 스풀 파일을 분석하지 않는다 — 순차 재생 전용이다 | 해당 없음 |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| SIM | SIM → COL | Modbus 경계 | 루프백 TCP 소켓. 같은 프로세스여도 Modbus 구간을 생략하지 않는다 — 생략하면 모드 A E2E 지연에서 Modbus 계층이 빠진다 |
| ING | COL → ING | Stream 경계 | stream:plc:raw. SW-01 off만 예외 |
| MST | MST → COL | 저장소 경유 | 태그 정의 · 접속 설정 · 시뮬레이션 설비 판정의 원천 |
| GEN | GEN → SIM → COL | 간접 | 모드 A의 값은 GEN이 SIM 레지스터에 넣은 것이다 |
| OBS | COL → OBS | 계측 | points_emitted · poll_duration · 타임아웃율 · spool_active · spool_bytes · deadband_boost_active를 노출한다 |

- **SIM은 COL과 같은 컨테이너에 있어야 한다.** PlcSim이 루프백에만 바인드하므로 APP_ROLE로 collector를 떼어내면 SIM도 함께 가야 한다 — SIM의 APP_ROLE 배정([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) W3)의 제약이다.

## 실패 시 보이는 것

COL은 에러 코드를 내지 않는다. 아래는 전부 품질 코드 · 메트릭 · 상태 전이다.

| 상황 | 드러나는 형태 | 지표 | 기능 |
|------|------|------|------|
| Modbus 응답 타임아웃 | 그 그룹의 그 주기를 건너뛴다 · 행 없음 | 타임아웃율 | COL-02 · 05 |
| Modbus 예외 응답 | BAD_COMM(2)으로 저장 · 알람 판정 제외 | 품질 코드 분포 | COL-05 |
| 범위 밖 값(워드 순서 오류 포함) | BAD_RANGE(4)로 저장 | 상동 | COL-04 · 05 |
| 폴링 소요가 스캔 주기를 넘김 | 주기 초과 — F-01의 1차 병목 | poll_duration > scan_rate | COL-02 · 03 |
| 경고 단계 도달 | 데드밴드 임시 강화 | deadband_boost_active | COL-08 |
| 위험 단계 도달 · XADD 실패 | 스풀 전환 — **명시적 백프레셔** | spool_active · spool_bytes | COL-09 |
| 복구 단계 | 스풀 순차 재발행 | spool_drain_rate | COL-09 |
| 폴링 루프 예외 | 루프만 재기동 · 그동안 수집 포인트 0 · 조회에서 STALE | points_emitted | COL-02 |
| 검사를 우회한 발행자로 MAXLEN 트리밍 | 오류 없는 조용한 유실 — **결함으로 계측** | stream_trimmed_unacked | COL-07 |

- **B형 — 스풀 전환은 장애가 아니라 설계된 백프레셔다.** Stream이 차는데 발행을 계속하면 MAXLEN 트리밍이 미소비 엔트리를 조용히 자른다. 스풀이 켜진 동안의 수치는 결함이 아니라 흡수량이며, 조용한 유실은 stream_trimmed_unacked 하나로만 센다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.2 최신값 갱신 주체 — 원본 implementation_plan.md §7.2 | 현행 소유는 Ingest(ING-08)다. B안(Collector가 XADD 파이프라인에 HSET을 함께 보냄)은 S6 실측으로 결정하며, 결정 전에도 **교체 가능한 포트 구조**를 둔다 | ADR [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 보정 7.5 TTL 강제 수단 | stream:plc:raw 발행은 봉인 계열 래퍼로만 한다 — TTL 명령을 노출하지 않고 **실패를 그대로 던져** COL-09를 발동시킨다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| W1 인계 — 모드 A SIMULATED 표지 | §모드 A의 SIMULATED 표지 판정으로 닫았다 | 이 문서 |
| 보정 7.1 · 7.3 · 7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 모드 A ts 채취 시점(요청 직전 · 응답 직후) | **W4 판정** — 요청 블록 송신 직전 · t0 = 사이클 첫 요청 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| BAD_TIMEOUT "기록"의 자리(원본 architecture.md §17) | **W4 판정** — 메트릭만(타임아웃 계수 · 왕복 히스토그램의 타임아웃 칸) · 행 · 최신값 갱신 없음 | 상동 |
| FLOAT64 4워드 순서 · 레지스터 비트 BOOL | **W4 판정** — 두 축 조합(하위 워드 먼저 = 4워드 완전 역순) · 레지스터 비트 BOOL 미지원 | 상동 |
| UNCERTAIN(1) 부여 주체 | **W4 판정** — 부여 주체 없음 유지 · 보간 단계 신설 시 재판정 | 상동 |
| SW-10 off와 경고 단계 데드밴드 강화(COL-08)의 관계 | **W3 판정 완료 — 무동작**(ADR-24). 강화는 태그 설정값 × 계수이므로 데드밴드가 꺼진 구성에서는 강화할 값이 없다. 경고 단계의 반응이 비는 것은 결함이 아니라 성능 측정을 데드밴드 0으로 하는 규칙의 결과다 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 실행 중 마스터 변경의 반영 | **W4 판정** — ch:cacheinv 구독 · 해당 설비만 다음 사이클 경계 재로드 · Redis 재연결 시 전체 대조 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 갭 허용 크기 · 타임아웃 · 재시도 값 | 2계층 조정값 — 원본 현행 갭 최대 20 레지스터 · 타임아웃 3초 | 상동 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |

## 관련 문서

- [../03_requirements/04_collector.md](../03_requirements/04_collector.md) — REQ-COL 동작 계약
- [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) — F-01 기전
- [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) — F-10 스풀 · 재발행
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — Stream 엔트리 · 스풀 프레임 계약
- [04_plc_sim.md](./04_plc_sim.md) — Modbus 경계 반대편
- [05_datagen.md](./05_datagen.md) — 생성 모드의 SIMULATED 표지
- [13_switch_matrix.md](./13_switch_matrix.md) — SW-01 · SW-10 정본
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 품질 코드 · Modbus 매핑 enum
