# SIM — 시뮬레이션 기능 명세

> **대상**: 시뮬레이션(SIM · NestJS plc-sim 모듈) 기능 목록 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID SIM-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 3행 닫힘(주입 제어 수단 · FC01 · FC02 · SIM APP_ROLE) — 기능 수 불변
> **원천**: 원본 tech_stack.md §3.3 · §3.4 · §6 · §7(커밋 ff66a37) · 원본 architecture.md §3 · §4 · §15 · §17(커밋 ff66a37) · 원본 data_flow.md §3 · §11 · §12.4 · §17(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · S3 · S6(커밋 ff66a37) · D-02 · [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) 제외가 만드는 한계

SIM은 **실 PLC 대신 Modbus TCP 서버로 응답하는 도메인**이다. 설비 1대에 포트 1개를 열고, 레지스터 Buffer를 응답하며, 지연과 오류를 주입해 수집 경로의 실패를 재현한다(원본 tech_stack.md §6). 값을 만들지 않는다 — 값은 생성기(GEN 모드 A)가 레지스터에 넣는다.

**SIM은 외부 표면이 없다.** 포트는 컨테이너 내부 루프백에만 바인드하고 publish하지 않으므로 호스트에서도 닿지 않으며, [../07_api](../07_api/README.md)에 문서가 없고 에러 네임스페이스도 없다. **소유 테이블도 없다** — 레지스터는 메모리 Buffer다. 두 공백 모두 설계 진술이다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)).

**같은 프로세스여도 Modbus 구간을 생략하지 않는다.** Collector가 실제 소켓으로 접속하므로 요청 인코딩 · 레지스터 블록 병합 · 응답 디코딩까지 모드 A의 E2E 지연에 들어간다. 실장비가 연결되면 Collector의 접속 대상 주소만 바뀐다(원본 data_flow.md §3).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))다.

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **SIM-01** | 설비당 Modbus TCP 서버 | 설비 1대마다 Modbus TCP 서버를 포트 하나에 띄운다. 대역은 컨테이너 루프백 127.0.0.1:5020~5119이며 Compose ports에 싣지 않는다. S2는 포트 1개(5020)다 | S2 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 — 메모리 |
| **SIM-02** | 레지스터 응답 | holding · input 레지스터 Buffer로 읽기 요청에 응답한다. S2는 FC03만, S3에서 FC04까지. 응답은 16비트 빅엔디안 워드 배열이다(원본 data_flow.md §14.1) | S2 · S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| **SIM-03** | 레지스터 런타임 갱신 | 생성기(GEN-05)가 신호 프로파일로 만든 값을 Buffer에 주기적으로 반영한다. **수집 이전의 모사 구간**이라 Stream 경계 규칙의 대상이 아니다 — 진짜 경계는 뒤의 Modbus 소켓이다 | S2 | F-01 · F-09 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| **SIM-04** | 지연 주입 | 응답을 늦춰 Collector의 타임아웃을 재현한다. Collector는 그 스캔 그룹의 그 주기를 건너뛰고 행을 만들지 않는다(BAD_TIMEOUT). Modbus 타임아웃 장애 시나리오의 재현 수단이다(원본 architecture.md §17) | S3 · S6 | F-01 · F-10 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 |
| **SIM-05** | 오류 주입 | Modbus 예외 응답을 돌려준다. Collector가 BAD_COMM(2)으로 저장하고 알람 판정에서 뺀다. 품질 코드 전파 검증("PlcSim에 오류 주입 후 조회 → 해당 품질 코드로 저장", 원본 data_flow.md §17)의 입력이다 | S3 | F-01 | 해당 없음 | 표면 없음 — 내부 모듈 | 없음 |

- 검산: SIM-01~05 = **5**. 단계별(첫 도입 기준) S2 3(SIM-01 · 02 · 03) + S3 2(SIM-04 · 05) = **5**
- 표면 없음 5 = SIM-01~05 전부. SIM은 [12_permission_matrix.md](./12_permission_matrix.md)에서 "내부"로 센다.

## 포트 대역과 용량 티어

포트 대역은 1계층 구조값이다. 설비 수 상한을 정하므로 용량 티어와 맞물린다(티어 정본 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)).

| 항목 | 값 | 근거 |
|------|------|------|
| 포트 대역 | 5020~5119 · 검산: 5119 − 5020 + 1 = **100** | 원본 architecture.md §3 |
| 설비당 포트 | 1 | 설비 1대 = 연결 1개 = 유닛 1개 — 다중 유닛 ID를 쓰지 않는다 |
| 대역이 담는 최대 설비 | 100 = 티어 L의 설비 수(원본 architecture.md §15) | 대역을 줄이면 L 티어 Breakpoint 실험을 모드 A로 돌릴 수 없다 |
| 바인드 | 127.0.0.1(컨테이너 내부) | 호스트 포트를 하나도 쓰지 않으면서 Modbus 계층 포함 E2E를 잰다 |

- **L 티어를 모드 A로 채우면 Modbus가 먼저 막힌다.** 모드 A는 DB 상한을 잴 수 없다(원본 data_flow.md §11.1) — 대역이 L을 담는 것과 L을 모드 A로 재는 것은 다르다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| SIM-01 | 컨테이너 밖으로 포트를 열지 않는다 | 해당 없음 — 설계상 금지 |
| SIM-02 | 품질 필드를 싣지 않는다 — Modbus 레지스터에는 품질이 없다 | 시뮬레이션 표지는 COL-05(접속 대상 판정) |
| SIM-03 | **값을 생성하지 않는다** — 데이터 생성 로직이 없다 | GEN-01 · GEN-05 |
| SIM-04 · 05 | 주입을 스스로 결정하지 않는다 — 주입 조건은 실험이 정한다 | §미확인 · 미설계 등재(주입 제어 수단) |
| SIM-01~05 | 실 PLC의 응답 지터 · 통신 노이즈 · 워드 순서 혼재를 재현하지 않는다 | 제외 한계 — [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) |
| SIM-01~05 | 구현 교차 검증 도구(diagslave · ModbusPal)를 기능으로 두지 않는다 — 응답 대조용 보조 도구다 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| GEN | GEN → SIM | 시뮬레이션 결합 | 프로세스 안 Buffer 갱신. 수집 이전 구간이라 경계 규칙 밖이다 |
| COL | SIM → COL | Modbus 경계 | 루프백 TCP 소켓 |
| MST | MST → SIM | 간접 | modbus_config.port가 SIM 포트를 가리킨다. 레지스터 주소 배치는 tag_master.address가 정한다 |

- **SIM은 COL · GEN(모드 A)과 한 컨테이너에 있어야 한다.** 루프백 바인드라 COL이 다른 컨테이너로 가면 닿지 않고, Buffer 갱신이 프로세스 안 호출이라 GEN이 다른 컨테이너로 가면 모드 A가 끊긴다. SIM의 APP_ROLE 배정([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) W3)이 받아야 할 제약이다.

## 실패 시 보이는 것

SIM은 에러 코드를 내지 않는다. SIM의 실패는 Collector 쪽 품질 코드와 메트릭으로 보인다.

| 상황 | 드러나는 형태 | 지표 | 기능 |
|------|------|------|------|
| 지연 주입 | 해당 그룹 그 주기 결측 · 다음 주기 자동 복구 | Collector 타임아웃율 | SIM-04 |
| 오류 주입 | BAD_COMM(2) 행 | 품질 코드 분포 | SIM-05 |
| api 컨테이너 재기동 · 재빌드 | PlcSim도 함께 멈춰 **수십 초 결측 구간** — 장애가 아니라 정상 동작 | 결측 구간 길이 | SIM-01 |
| SIM 서버 기동 실패(포트 충돌 등) | Collector 연결 실패 → 폴링 결측 → 조회에서 STALE | points_emitted | SIM-01 |

- **B형 — 재빌드 결측을 장애로 기록하지 않는다.** 실장비라면 PLC는 계속 돌고 Collector만 멈추므로 그 구간이 진짜 유실이지만, 여기서는 값의 원천까지 함께 멈춘다(원본 data_flow.md §12.4). 부하 실험 중에는 재빌드하지 않고, 실험 밖 결측은 재빌드 흔적으로 적는다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.1~7.5 | 해당 없음 — SIM은 보정 5건의 대상이 아니다 | 해당 없음 |
| Python 시뮬레이터 분리 조건 — 원본 tech_stack.md §3.4 | 다중 유닛 ID · 예외 응답 · 지연 주입을 jsmodbus로 표현하지 못하면 PlcSim만 pymodbus 프로세스로 뗀다. **그 순간 COL의 SIMULATED 판정(루프백 규칙)을 재판정한다** | [03_collector.md](./03_collector.md) · [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 지연 · 오류 주입의 제어 수단 | "지연 · 오류 주입"이 책임으로 적혀 있다(원본 architecture.md §4) | 닫힘 — 기동 시 읽는 주입 계획 SIM_FAULT_PLAN · 실행 중 제어 표면 없음 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4) · 표면이 필요하면 [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| Coil · Discrete Input(FC01 · FC02) 응답 | 태그 마스터가 FC01 · FC02를 허용한다 · SIM 책임은 holding · input 레지스터뿐이다(원본 tech_stack.md §6) | 닫힘 — FC01 · FC02 시드 금지 유지 · 해제 조건 4 — [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4) |
| SIM의 APP_ROLE | 원본이 배정하지 않았다 | 닫힘 — ADR-22(SIM · GEN 모드 A는 collector와 동거) — [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)(W3) |

## 관련 문서

- [../03_requirements/05_plc_sim.md](../03_requirements/05_plc_sim.md) — REQ-SIM 동작 계약
- [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) — F-01 수집 기전
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — 모드 A 주입
- [03_collector.md](./03_collector.md) — Modbus 경계의 클라이언트 · SIMULATED 판정
- [05_datagen.md](./05_datagen.md) — 레지스터 값의 원천
- [../11_glossary/01_domain_terms.md](../11_glossary/01_domain_terms.md) — PLC · Modbus 용어
