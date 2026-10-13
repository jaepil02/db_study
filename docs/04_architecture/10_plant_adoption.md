# 회사 카드 생산 라인 도입 설계 (10_plant_adoption)

> **대상**: 이 시스템을 회사 카드 생산 라인에 붙일 때의 설계 — 현장 PLC(Modbus TCP) → 수집기(현장망 · 사무망 경계의 게이트웨이) → Redis Stream 버퍼 → ClickHouse(센서) · PostgreSQL(업무) → HMI · 분석 화면의 전체 그림 · 지금 가상인 것과 바꿔 끼울 자리 · 수집기 위치 · Redis 버퍼가 흡수하는 장애와 흡수하지 못하는 장애 · 서버 구성(한 대 · 나눠 두기) · 단계별 도입(① 한 라인 시범 ② 3라인 ③ 보존 · 백업) · 용량 어림식 · 보안 경계(도입 전 해야 할 일)
> **작성일**: 2026-10-11
> **원천**: D-16(사용자 결정 2026-10-11 — 회사 도입 · 카드 생산 라인 3 × 공정 10 = 30대 · HMI 최소 화면 · PLC 통신 Modbus TCP · 모든 데이터 Redis 경유 전제 · 결정 3) · D-02(로컬 전용 실행) · as-built 코드 apps/api/src/modules/collector(collect-definition · request-blocks · poll-cycle · device-poller · collector-metrics) · modules/plc-sim · modules/datagen/mode-a · modules/plant(plant-runtime · plant-overview) · src/db/seed-plan.ts · infra/postgres/migrations/002_master.sql(modbus_config · tag_master) · packages/shared/src/card-line.ts · [06_backpressure_failure.md](./06_backpressure_failure.md) §장애 시나리오 · [08_scaling_roadmap.md](./08_scaling_roadmap.md) · [02_module_boundaries.md](./02_module_boundaries.md) · [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) · [../12_security/04_threat_model.md](../12_security/04_threat_model.md) · [../08_screen/11_hmi_screen.md](../08_screen/11_hmi_screen.md)

이 문서는 **현행 구현이 아니라 도입 결정 뒤의 설계안**이다. db_study의 현행 범위는 로컬 머신 한 대다(D-02) — 이 문서도 배포 · 원격 접속 · TLS · 인증을 지금 있는 것으로 쓰지 않고, 회사 라인에 붙이기 전에 갖춰야 할 **진입 조건**으로만 적는다. 근거는 지금 코드가 이미 가진 경계(Modbus TCP 수집기 · Redis Stream · 역할 분리 APP_ROLE · 키 계열별 실패 전략)와 장애 시나리오 정본([06_backpressure_failure.md](./06_backpressure_failure.md) — 이 문서는 §Redis 버퍼가 흡수하는 것과 못 하는 것에서 도입 관점으로 다시 읽는다)이다.

**바꿔 끼우는 것은 데이터의 출처뿐이다.** 지금 화면에 보이는 카드 라인 30대는 컨테이너 안의 가상 PLC(PlcSim — Modbus TCP 서버)이고, 수집기는 그것을 **실제 PLC와 같은 Modbus TCP 요청으로** 읽는다. 그래서 실제 PLC로 옮길 때 바뀌는 것은 마스터의 접속 정의(modbus_config)와 태그 정의(tag_master)이고, 수집기 → Redis → 적재 → 저장소 → 화면의 경로와 계약(Stream 페이로드 · 분기 · 표면)은 그대로다 — 이것이 "모든 데이터는 Redis를 거친다"(D-16 사용자 전제)가 도입에서 주는 이점이다.

**HMI는 최소 화면이다.** 설비 상태와 보내는 데이터 종류만 보이고 알람 · 원격 조작(설비 쓰기)은 없다(D-16 결정 3 · 범위 정본 [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md)) — 상용 SCADA 수준(알람 관리 · 이력 보고서 · 설비 제어 · 이중화)은 이 설계의 범위 밖이다.

## 전체 그림

현장 PLC에서 화면까지 데이터가 지나는 길이다. 사각 괄호는 이 시스템의 구성 요소 · 화살표 위 글은 프로토콜이다.

```plain
현장망(생산 라인)                       │ 경계                    │ 사무망(서버실)
                                        │                         │
 PLC 30대(라인 3 × 공정 10)  ──Modbus TCP(FC03 · FC04 읽기만)──▶ [수집기 — APP_ROLE collector]
   인쇄 · 합지 · 라미네이팅 · …                                    │ 태그 주기 0.1 · 0.2 · 1초 그룹 폴링
                                        │                         │ 디코드(FLOAT32 · UINT32 · UINT16 · word order) · 스케일
                                        │                         ▼ XADD
                                        │                 [Redis — stream:plc:raw(센서 대기줄)]
                                        │                         │  ← DB가 잠깐 멈춰도 여기에 쌓인다(적체 · 백프레셔)
                                        │                         ▼ XREADGROUP
                                        │                 [적재(Ingest) — APP_ROLE worker]
                                        │                    ├──▶ ClickHouse tag_raw → 요약 1분 · 1시간 · 1일   ← 센서 원본 · 이력
                                        │                    └──▶ Redis rt:latest(지금 값)                    ← HMI 1초
                                        │                 [api — APP_ROLE api] ── 업무 명령 → Redis stream:biz:cmd → PostgreSQL
                                        │                         ▼
                                        │                 [웹 — HMI 설비 현황판 · 분석 화면]
```

- **수집기가 현장망과 사무망 사이의 유일한 다리다.** PLC에 말을 거는 것은 수집기 하나이고, 수집기가 사무망으로 내보내는 것은 Redis 대기줄에 싣는 엔트리뿐이다 — 화면 · api · DB는 PLC에 직접 닿지 않는다(§수집기 위치).
- **수집기는 읽기만 한다.** 수집 정의는 function code 3(holding) · 4(input) 태그만 읽고 1 · 2(코일 · 입력 비트)는 시드부터 거부하며(apps/api/src/modules/collector/collect-definition.ts), 쓰기 요청 코드가 없다 — HMI에 원격 조작이 없는 것(D-16)과 같은 경계다.
- **센서와 업무는 Redis에서 갈라진다.** 센서는 배치로 ClickHouse에, 업무 명령은 명령 스트림으로 PostgreSQL에 간다(분기 정책 정본 [04_storage_split.md](./04_storage_split.md)) — 라인이 늘어도 업무 쓰기가 센서 적재와 같은 DB를 다투지 않는다.

## 지금 가상인 것과 바꿔 끼울 자리

지금 시스템에서 시연을 위해 가상으로 둔 것과, 실제 라인에 붙일 때 그 자리에 들어갈 것이다.

| 지금(가상 · 시연) | 코드 · 데이터 자리 | 실제 라인에서 | 바꾸는 방법 |
|------|------|------|------|
| 가상 PLC 30대(PlcSim — 컨테이너 안 Modbus TCP 서버 · 포트 5020~5049 · 루프백) | modules/plc-sim · seed-plan.ts(SIM_BASE_PORT 5020) | 라인의 실제 PLC 30대 | 띄우지 않는다 — 수집기가 실제 PLC 주소로 접속한다 |
| 가상 PLC 값 생성(모드 A 레지스터 쓰기 — 종류별 신호 · 설비 상태 기계) | modules/datagen/mode-a · signal | PLC 프로그램이 만드는 실제 값 | 띄우지 않는다 |
| 접속 정의(modbus_config — 루프백 주소 · 포트 5020 + 순번) | PostgreSQL modbus_config(host · port · unit_id · timeout_ms · retry_count · max_regs_per_request) | PLC마다 실제 IP · 포트(Modbus TCP 기본 502) · unit id · 타임아웃 · 재시도 | 마스터 표면(설비 등록 · Modbus 설정 — [../07_api/04_master.md](../07_api/04_master.md))으로 등록 · 바꾸면 수집기가 설비 단위로 다시 읽는다 |
| 태그 정의(카드 라인 템플릿 129태그 — 주소 · 형식 · word order · 주기 · 범위 · 단위 · 종류) | packages/shared/src/card-line.ts → 시드 → tag_master | PLC 레지스터 맵 문서의 실제 주소 · 형식 · 스케일 · 오프셋 · 단위 | 마스터 태그 표면으로 등록 · **스케일 변경은 새 tag_id 발급**(시계열 불변 — [../README.md](../README.md) 전역 불변식 불변 사실 기록) |
| 설비 가동 스위치(ctl:plant:power — 켜면 SIM 포트 · 모드 A 틱 · 폴링을 함께 켬 · 수집기 역할이 기동 때 키를 지우고 기동 기본값 SENSOR_AUTOGEN(로컬 Compose off)부터 시작) | modules/plant(plant-runtime) | 실제 PLC는 늘 돈다 — 수집(폴링)만 켜고 끈다 · 수집기를 다시 띄워도 수집이 꺼지면 안 된다 | **미설계** — 지금 스위치는 셋을 함께 켜고 끈다 · 실제 PLC 모드(가상 PLC · 모드 A 없이 폴링만)와 재기동 뒤 상태(지금은 기본값 off로 돌아가 수집이 멈춘다)는 코드 착수 때 정한다 |
| 통신 끊김 시연 계획(SIM_FAULT_PLAN — 로컬 기본 꺼짐) | infra/sim-plans | 실제 통신 장애 | 쓰지 않는다 |
| 직접 비교 실험 · 직접 보내 보기 · 센서 데이터 지우기 | modules/runs · 웹 ⑤ ⑥ · 공용 컨트롤 | 없음 — 시연 · 학습용 | 도입 환경에서는 쓰지 않는다(§보안 경계 — 지우기는 운영 데이터를 지운다) |

- 검산: 바꿔 끼울 자리 = **7**
- **바뀌지 않는 것** — Stream 페이로드 계약 v1 · 분기 정책 · 품질 코드 7 · 적재 멱등 · 롤업 · 표면 계약 · HMI 화면. 수집기가 실제 PLC에서 읽은 값도 같은 디코더 · 같은 품질 판정을 지난다(타임아웃은 BAD_TIMEOUT · 통신 불량은 BAD_COMM — [06_backpressure_failure.md](./06_backpressure_failure.md) §장애 시나리오 #8).
- **생성 데이터 표지를 지운다.** 시뮬레이터가 만든 값은 품질 SIMULATED(9)를 달아 실데이터와 가른다(전역 불변식 — [../README.md](../README.md)) — 실제 PLC 값과 같은 테이블에 섞기 전에 시연 데이터를 지운다(⑤ ⑥ ⑦의 데이터 지우기 또는 볼륨 초기화).

## 수집기 위치

수집기를 어디에 두느냐가 현장망 보안과 장애 범위를 정한다. 지금은 api 컨테이너 안(APP_ROLE all)이지만, 역할은 이미 나뉘어 있어 수집기만 따로 띄울 수 있다(APP_ROLE collector — 정본 [02_module_boundaries.md](./02_module_boundaries.md) · ADR-22).

| 안 | 수집기 자리 | 현장망에 여는 것 | 장애 범위 | 판정 |
|------|------|------|------|------|
| A 서버실에 함께 | api · worker · DB와 같은 서버 | 서버실 → PLC 30대 Modbus TCP(502) | 서버 하나가 멈추면 수집 · 화면 · 저장이 함께 멈춘다 | 시범(① 한 라인)에만 |
| B 경계 게이트웨이 | 현장망과 사무망 사이 전용 머신(APP_ROLE collector) | 게이트웨이 → PLC 502만 · 게이트웨이 → 서버실 Redis 6379만 | 서버실이 멈춰도 게이트웨이는 PLC를 계속 읽는다 — 단 Redis에 싣지 못한 엔트리는 지금 버린다(§Redis 버퍼) | **채택안** |

- 검산: 안 = **2**
- **B를 고르는 이유는 문 하나다.** 현장망으로 들어가는 연결이 게이트웨이 → PLC 하나뿐이면 방화벽 규칙이 한 줄로 닫히고, 사무망 PC나 웹 화면이 PLC에 닿을 길이 없다. A는 서버실 전체가 현장망 PLC 포트에 닿는다.
- **게이트웨이에 남는 일** — 수집 정의(설비 · 태그 · 접속 설정)는 PostgreSQL 마스터에서 읽고 바뀌면 설비 단위로 다시 읽는다. 그래서 게이트웨이는 PostgreSQL 읽기 접속도 필요하다 — B의 "사무망으로 여는 것"은 Redis · PostgreSQL 읽기 둘이다(설계 — 접속 계정은 §보안 경계).
- **Modbus 요청은 묶어서 보낸다.** 같은 function code 안에서 주소 오름차순으로 묶고 요청당 상한은 125 레지스터와 설비별 max_regs_per_request 중 작은 쪽이다(request-blocks.ts) — 실제 PLC가 한 번에 받는 레지스터 수가 작으면 modbus_config의 상한으로 줄인다.

## Redis 버퍼가 흡수하는 것과 못 하는 것

Redis Stream은 수집과 적재 사이의 버퍼다(전역 불변식 비동기 경계). 아래는 장애 시나리오 정본([06_backpressure_failure.md](./06_backpressure_failure.md) §장애 시나리오)을 도입 관점에서 다시 읽은 것이다 — 시스템 반응은 정본 그대로이고 "도입에서 뜻하는 것" 열만 이 문서의 해석이다.

| 장애 | 시스템 반응(정본) | HMI에 보이는 것 | 도입에서 뜻하는 것 |
|------|------|------|------|
| ClickHouse 멈춤 | 적재가 XACK를 보류 → 대기줄 적체 증가 → 백프레셔 단계 상승 | 지금 값 갱신 주체가 적재(SW-11 ingest · 기본)면 지금 값도 멈춰 5초 뒤 30칸이 통신 끊김 · 수집기(SW-11 collector)면 살아 있다 | **흡수한다** — 대기줄 상한(MAXLEN · 백프레셔 임계 — 2계층 조정값)까지 쌓았다가 재기동 뒤 소진한다 · HMI를 살리려면 SW-11을 정한다(§단계별 도입 ①) |
| PostgreSQL 멈춤 | 시계열 조회는 계속 · 업무 CRUD만 실패 | 30칸은 계속 · 설비 · 태그 메타 사본이 없으면 개요가 503 | **센서는 흡수한다** — 업무 명령은 명령 스트림에 쌓이지 않고 실패한다(503 — 같은 키로 다시 보내면 안전) |
| Redis 멈춤 | XADD · XREADGROUP · GET 동시 실패 · 지금 값 503 | 개요를 읽지 못해 "설비 상태를 읽지 못했어요" | **흡수하지 못한다** — 수집기 스풀(COL-09)이 아직 없어 XADD에 실패한 엔트리를 버린다(device-poller · S6 미구현) — 그 동안의 센서 값은 결측이다 |
| 수집기(게이트웨이) 멈춤 | 폴링 루프 재기동 · 결측 구간이 남는다 | 마지막 갱신 5초 뒤 통신 끊김 | 결측 — 재기동까지의 값은 PLC에서 다시 읽을 수 없다(Modbus는 지금 값만 준다) |
| PLC 하나 응답 없음(타임아웃) | 그 스캔 그룹의 그 주기를 건너뛰고 행을 쓰지 않는다(BAD_TIMEOUT) | 그 설비만 통신 끊김 | 다른 설비 · 다른 라인은 영향 없다 |
| api(한 대 구성) 멈춤 | 수집 · 적재 · 조회 · 업무 쓰기 함께 멈춤 | 화면 전체 멈춤 | 한 대 구성의 단일 실패점 — 나눠 두기(§서버 구성)가 이것을 줄인다 |

- 검산: 장애 행 = **6**
- **A형 — "Redis를 거치니 어떤 장애도 흡수한다"가 아니다.** 통념은 버퍼가 있으면 데이터를 잃지 않는다는 것이다. 부정 — 버퍼가 흡수하는 것은 버퍼 **뒤**(ClickHouse · 적재)의 멈춤이고, 버퍼 자신(Redis)이 멈추면 지금 수집기는 엔트리를 버린다. 진짜 축은 **어느 구간이 멈췄는가**다. 대체 경로 — 도입 전 해야 할 일에 수집기 로컬 스풀(COL-09 — 디스크에 잠시 쌓았다가 Redis가 돌아오면 다시 싣기)을 둔다(§보안 경계와 함께 §단계별 도입 ③의 진입 조건).
- **HMI의 통신 끊김은 PLC 고장만 뜻하지 않는다.** 판정은 "설비 태그 지금 값의 마지막 갱신이 5초를 넘었다"이므로(정본 [../08_screen/11_hmi_screen.md](../08_screen/11_hmi_screen.md) §상태 판정 표시) PLC · 수집기 · Redis · (SW-11 ingest면) ClickHouse 중 어디가 멈춰도 같은 칸 색이 된다 — 원인은 화면이 아니라 관측(메트릭 · health)으로 가른다.

## 서버 구성

| 구성 | 배치 | 좋은 점 | 대가 | 쓰는 때 |
|------|------|------|------|------|
| 한 대 | 지금 구성 그대로 — Docker Compose 컨테이너 4(api(APP_ROLE all) · PostgreSQL · ClickHouse · Redis) + 웹 | 설치 · 백업 · 관찰이 한 곳 · 지금 코드 그대로 | 단일 실패점(api가 수집 · 적재 · 조회를 함께 맡는다) · 수집기가 서버실에 있어 현장망을 서버실 전체에 연다(§수집기 위치 A) | ① 한 라인 시범 |
| 나눠 두기 | 경계 게이트웨이(APP_ROLE collector) + 서버실(APP_ROLE api · worker · PostgreSQL · ClickHouse · Redis) + 웹 | 현장망 문이 게이트웨이 하나 · 서버실 재기동 중에도 PLC 읽기는 계속 · 확장 로드맵 1단계(역할 분리)와 같은 모양 | 머신이 늘어 관리 대상이 는다 · Redis가 서버실에 있어 게이트웨이 ↔ Redis 연결이 끊기면 지금은 결측(스풀 전) | ② 3라인 · ③ 운영 |

- 검산: 구성 = **2**
- **나눠 두기는 코드 변경이 없어야 한다.** 역할 분리는 확장 로드맵 1단계이고 그 검증은 "역할 분리 커밋에 코드 diff가 없다"이다([08_scaling_roadmap.md](./08_scaling_roadmap.md) §단계별 교체 대상) — 모듈 경계가 Redis Stream이라(ADR-06) 수집기를 다른 머신으로 옮겨도 페이로드 계약 · 컨슈머 그룹 · 키 계열은 그대로다.
- **서버 사양 · 디스크는 측정 전이다.** 노트북 Docker에서 잰 값(⑤ 직접 비교 — 라이브 · 기록 정본 아님)은 회사 서버 사양을 정하는 근거가 되지 않는다 — §용량 어림의 식에 실제 태그 수와 보존 기간을 넣어 디스크를 정하고, 처리량은 ① 시범에서 잰다(3계층 미확인).

## 단계별 도입

| 단계 | 범위 | 할 일 | 넘어가는 조건 |
|------|------|------|------|
| ① 한 라인 시범 | 라인 1개(설비 10대) · 한 대 구성 | PLC 레지스터 맵으로 설비 · 태그 · 접속 설정 등록 · 시연 데이터 지우기 · 실제 PLC 모드(폴링만) 구현 · 지금 값 갱신 주체(SW-11) 결정 · HMI에서 10칸 상태 · 값 · 단위를 현장 표시와 대조 · 결측 · 통신 끊김 빈도 관찰 | 10대 전부 값이 현장 표시와 맞는다 · 태그별 형식 · word order · 스케일 오류 0 · 하루 이상 연속 수집에서 결측 구간이 설명된다(재기동 · PLC 정지) |
| ② 3라인 | 설비 30대 · 나눠 두기(경계 게이트웨이) | 게이트웨이 분리(APP_ROLE collector) · 방화벽 규칙(게이트웨이 → PLC 502 · 게이트웨이 → Redis · PostgreSQL 읽기) · 처리량 · 적체 · 백프레셔 단계 관찰(관측 프로파일 대시보드) | 30대 연속 수집에서 대기줄 적체가 0으로 돌아온다 · 백프레셔가 정상 단계에 머문다 · 역할 분리에 코드 diff 0 |
| ③ 보존 · 백업 | 운영 | 회사 보존 요구에 맞춰 ClickHouse 원본 TTL(지금 7일)과 요약 보존 · PostgreSQL 마스터 · 명령 원장 백업(pg_dump) · ClickHouse 백업 방식 · 수집기 스풀(COL-09) · §보안 경계의 진입 조건 전부 | 복원 연습 1회 성공(빈 볼륨 → 마이그레이션 → 백업 복원 → 화면) · 보안 경계 표의 할 일 완료 |

- 검산: 단계 = **3**
- **① 시범에서 먼저 정할 결정이 둘이다.** 실제 PLC 모드(지금 설비 가동 스위치가 가상 PLC까지 켜고 끈다 — §지금 가상인 것과 바꿔 끼울 자리)와 SW-11(지금 값을 적재가 쓰면 ClickHouse 멈춤 동안 HMI가 멈춘다 — [06_backpressure_failure.md](./06_backpressure_failure.md) §ClickHouse 중단 시 최신값 정지) — 둘 다 HMI가 현장에서 믿을 만한가를 정한다.
- **보존 기간은 2계층 조정값이다.** ClickHouse 원본 TTL · 요약 보존 · PostgreSQL 비교 사본 보존의 정본은 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)이고, 도입에서는 회사 요구가 값을 정한다.

## 용량 어림

용량은 태그 주기로 행 수를 세고 기록의 행당 바이트를 곱해 어림한다 — ④ PG 하나로 vs 나눠서 화면의 1년치 디스크 계산값과 같은 식이다([../08_screen/09_learn_screens.md](../08_screen/09_learn_screens.md) §LRN-ARCHITECTURE).

```plain
초당 행      = Σ 태그마다(1000 ÷ 주기 ms)
하루 행      = 초당 행 × 86,400
디스크(원본) = 하루 행 × 보존 일수 × 행당 바이트(저장소별 기록 값)
```

- **카드 라인 템플릿의 초당 행은 231이다** — 129태그 = 0.1초 6 + 0.2초 12 + 1초 111 → 6 × 10 + 12 × 5 + 111 × 1 = **231** · 하루 231 × 86,400 = **19,958,400행**(packages/shared/src/card-line.ts 명목값 · 설비 30대 전부 가동일 때).
- **행당 바이트는 기록 값을 쓴다** — 저장소마다 다르고(ClickHouse 압축된 열 · PostgreSQL 표 + 목차) 정본은 측정 기록(docs/measurements)과 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)이다 · 실제 PLC 값은 시뮬레이터 신호와 압축률이 다를 수 있다(3계층 미확인 — ① 시범에서 잰다).
- **실제 레지스터 맵이 나오면 식에 다시 넣는다.** 태그 수 · 주기는 가상 템플릿 값이라 실제 라인 값으로 바꾸면 결과가 바뀐다 — 템플릿 값을 회사 서버 사양으로 인용하지 않는다.

## 보안 경계

지금 시스템은 로컬 머신 한 대에서 127.0.0.1에만 바인드하고 로그인 · 권한이 없다(D-02 · D-16 결정 4 · 정본 [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) · [../12_security/04_threat_model.md](../12_security/04_threat_model.md) §무인증 표면). **이 상태로 회사망에 붙이지 않는다** — 아래는 도입 전 해야 할 일이고 지금 없는 것이다.

| 경계 | 지금 | 도입 전 해야 할 일 | 하지 않으면 |
|------|------|------|------|
| 화면 · api 접근 | 무인증 · 127.0.0.1 바인드 · CORS 허용 출처 · WebSocket Origin 검사 · BFF의 상태 변경 POST Origin 검사(허용 출처 밖 403)만 | 사용자 인증과 역할(보기 · 관리) · 사무망 바인드 · TLS | 사무망의 누구나 설비 가동 · 지우기를 부를 수 있다 |
| 상태를 바꾸는 표면 | 설비 가동 켜고 끄기 · 센서 데이터 지우기 · 직접 비교 · 직접 보내 보기가 전원에게 열림 · 다른 출처 방어는 BFF Origin 검사와 JSON 본문 요구(api)뿐 — 같은 머신의 프로세스가 api를 직접 부르는 것은 막지 못한다 | 도입 환경에서는 끈다 — 지우기는 운영 데이터를 지운다 · 실행은 운영 적재에 부하를 싣는다 · 남겨야 하면 인증 · 역할 뒤에 둔다(계약 — [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) | 인증 없는 요청 하나로 이력이 지워진다 |
| 현장망 | 가상 PLC가 컨테이너 루프백 안에만 있다 | 게이트웨이 → PLC 502만 여는 방화벽 · 수집기는 읽기 function code만(지금 코드 그대로) | 사무망 장비가 PLC에 쓰기 요청을 보낼 길이 생긴다 |
| 저장소 계정 | 로컬 개발 계정 · 저장소 포트 127.0.0.1 | 역할별 계정(수집기는 Redis 쓰기 · PostgreSQL 마스터 읽기만) · 비밀값 관리 · 저장소 포트를 서버실 밖에 열지 않음 | 게이트웨이 하나가 뚫리면 마스터 · 원장까지 쓸 수 있다 |
| 데이터 유실 | 수집기 스풀 없음(Redis 멈춤 = 결측) | 수집기 로컬 스풀(COL-09) | Redis 재기동 동안의 센서 값이 사라진다 |

- 검산: 경계 = **5**
- **B형 — 지금 무인증인 것은 결함이 아니라 범위다.** 결론 — 로그인 · 권한은 D-16 결정 4로 지웠고 표면은 127.0.0.1에만 열린다. 반대 시나리오 — 이 상태 그대로 사무망 바인드만 바꾸면 무인증 상태 변경 표면이 사무망 전체에 열린다. 파생 지침 — 바인드를 바꾸는 변경은 위 표의 인증 · 상태 변경 표면 차단과 같은 변경 단위에서만 한다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 실제 PLC 레지스터 맵(주소 · 형식 · word order · 스케일 · 주기) | 미설계 — 회사 자료로 ① 시범 때 정한다 | 마스터 등록(07_api/04) |
| 실제 PLC 모드(가상 PLC · 모드 A 없이 폴링만 켜고 끄기) | 미설계 — 지금 설비 가동 스위치가 셋을 함께 켜고 끈다 | 코드 착수 때 · [../02_features/README.md](../02_features/README.md) |
| 수집기 스풀(COL-09) | 미구현(S6) — XADD 실패 엔트리를 버린다 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) |
| 회사 서버 사양 · 처리량 · 디스크 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · ① 시범에서 잰다 | §용량 어림 식 |
| 보존 기간 · 백업 방식 | 미설계 — 회사 요구가 정한다 | [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |
| 인증 · TLS · 사무망 바인드 | 현행 범위 밖(D-02 · D-16) — 도입 진입 조건 | [../12_security/04_threat_model.md](../12_security/04_threat_model.md) |

- 검산: 행 = **6**

## 관련 문서

- [README.md](./README.md) — 04_architecture 목차
- [01_system_architecture.md](./01_system_architecture.md) — 조감도 · 경계별 프로토콜
- [02_module_boundaries.md](./02_module_boundaries.md) — APP_ROLE · Stream 경계
- [04_storage_split.md](./04_storage_split.md) — 분기 정책
- [06_backpressure_failure.md](./06_backpressure_failure.md) — 장애 시나리오 · 최신값 정지
- [08_scaling_roadmap.md](./08_scaling_roadmap.md) — 역할 분리 진입 조건
- [../08_screen/11_hmi_screen.md](../08_screen/11_hmi_screen.md) — HMI 설비 현황판
- [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) — 지금의 노출 경계
- [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) — HMI 최소 화면 In · 상용 SCADA Out
