# REQ-SIM — 시뮬레이션 요구사항

> **대상**: 시뮬레이션(SIM · NestJS plc-sim 모듈)의 동작 계약 — 설비당 Modbus TCP 서버 · 포트 대역 · 레지스터 응답 · 레지스터 갱신 경계 · 지연 · 오류 주입 · 배치 제약 · 결측 해석 — REQ-SIM-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — FC01 · FC02 응답 영역 미확인 행 닫힘(시드 금지 유지 · 해제 조건 4)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(주입 제어 수단 · SIM APP_ROLE) — REQ 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §3.4 · §6 · §7 · §10.1(커밋 ff66a37) · 원본 architecture.md §3 · §4 · §15 · §17(커밋 ff66a37) · 원본 data_flow.md §3 · §11.1 · §12.4 · §14.1 · §17(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · S3 · S6(커밋 ff66a37) · D-02 · [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) SIM-01~05 · [01_global_rules.md](./01_global_rules.md) REQ-GLB-03 · 16 · 19

이 문서는 SIM 기능 5개의 동작 계약을 고정한다. SIM은 실 PLC 대신 Modbus TCP 서버로 응답하고, 값을 만들지 않으며(값은 GEN 모드 A가 넣는다), 지연과 오류를 주입해 수집 경로의 실패를 재현한다.

**SIM에는 외부 표면도 소유 테이블도 없다.** 포트는 컨테이너 내부 루프백에만 있고 레지스터는 메모리 Buffer다. 그래서 SIM의 요구가 깨질 때 드러나는 자리는 SIM 자신이 아니라 **Modbus 경계 반대편의 Collector 지표와 품질 코드**다 — 이 문서의 검증 방법 열은 대부분 [04_collector.md](./04_collector.md)의 지표를 읽는다. 에러 코드 열은 전부 "해당 없음"이다.

**SIM은 측정 도구이면서 측정 대상 경로의 일부다.** Modbus 구간을 생략하지 않으므로 SIM의 응답 지연은 모드 A E2E에 그대로 들어간다. 이 이중성이 요구의 축이다 — 실장비와 다르게 동작해야 하는 곳(결측 해석 · 주입)과 실장비처럼 동작해야 하는 곳(프로토콜 · 소켓)을 가른다.

## 요구사항 — 서버와 포트

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-SIM-01** | 설비 1대마다 Modbus TCP 서버를 포트 하나에 띄운다. 포트는 컨테이너 내부 127.0.0.1:5020~5119이며 Compose ports에 싣지 않는다. 설비당 연결 1 · 유닛 1이며 다중 유닛 ID를 쓰지 않는다. S2는 포트 1개(5020)다 | 원본 architecture.md §3 · 원본 tech_stack.md §6 · §10.1 · REQ-GLB-19 | publish하면 호스트 포트 100개가 열려 같은 머신의 다른 프로세스가 레지스터를 읽고 쓴다. 0.0.0.0에 바인드하면 같은 네트워크의 기기가 시뮬레이터에 붙는다 | 호스트에서 127.0.0.1:5020 접속 실패 · 컨테이너 안에서 접속 성공 · Compose 포트 표기에 5020~5119 부재 | SIM-01 | F-01 | 해당 없음 |
| **REQ-SIM-02** | 포트 대역은 1계층 구조값이다 — 5119 − 5020 + 1 = **100** = 용량 티어 L의 설비 수. 대역을 줄이지 않는다. 대역이 L을 담는다는 것이 L을 모드 A로 잴 수 있다는 뜻은 아니다 — 모드 A에서는 Modbus가 DB보다 먼저 막힌다 | 원본 architecture.md §3 · §15 · 원본 data_flow.md §11.1 | 대역을 줄이면 L 티어 Breakpoint 실험을 모드 A로 시작조차 할 수 없다. 대역만 보고 모드 A로 DB 상한을 재면 Modbus 병목을 DB 한계로 오독한다 | 대역 크기 = 티어 L 설비 수 대조 · L 티어 모드 A 실행 시 poll_duration과 insert_duration 중 먼저 포화되는 쪽 기록 | SIM-01 | F-01 · F-09 | 해당 없음 |
| **REQ-SIM-03** | 서버 기동 실패(포트 충돌 등)는 SIM 스스로 오류 코드를 내지 않는다. 드러나는 자리는 Collector의 연결 실패 → 폴링 결측 → 조회 STALE이다. 기동 실패한 포트 수를 기동 로그와 메트릭으로 남긴다 | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) 실패 시 보이는 것 · REQ-GLB-16 | 기동 실패를 기록하지 않으면 특정 설비의 결측이 Modbus 타임아웃 · 루프 예외 · 기동 실패 중 무엇인지 가를 수 없다 | 이미 쓰는 포트를 점유한 채 기동 → 기동 실패 계수 증가 · 해당 설비 points_emitted 0 | SIM-01 | F-01 | 해당 없음 — Collector points_emitted |

## 요구사항 — 레지스터 응답과 갱신

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-SIM-04** | holding · input 레지스터 Buffer로 읽기 요청에 응답한다. S2는 FC03, S3에서 FC04까지다. 응답은 16비트 빅엔디안 워드 배열이며 **품질 필드를 싣지 않는다** — Modbus 레지스터에는 품질이 없다 | 원본 tech_stack.md §6 · 원본 data_flow.md §14.1 | 품질 워드를 레지스터에 실으면 시뮬레이터 레지스터 맵이 실장비와 달라져, 실장비로 바꿀 때 "접속 주소만 바뀐다"(원본 data_flow.md §3)가 거짓이 된다 | 기지값을 Buffer에 넣고 FC03 · FC04 응답 워드 대조 · 응답 길이 = 요청 레지스터 수 | SIM-02 | F-01 | 해당 없음 |
| **REQ-SIM-05** | Coil · Discrete Input(FC01 · FC02) 응답은 미확인이다. 확정 전에는 태그 마스터에 FC01 · FC02 태그를 시드하지 않는다 | 원본 tech_stack.md §6 SIM 책임 · 원본 architecture.md §6 tag_master.function_code | 확정 전 FC01 태그를 시드하면 SIM에 응답 영역이 없어 그 태그 전부가 BAD_COMM 또는 결측이 되어 품질 코드 전파 검증을 오염시킨다 | 시드 tag_master의 function_code 분포 조회(01 · 02 부재) | SIM-02 | F-01 | 해당 없음 |
| **REQ-SIM-06** | SIM은 값을 만들지 않는다. 레지스터 Buffer 갱신은 GEN-05(모드 A)가 프로세스 안 호출로 한다. 이 갱신은 **수집 이전의 모사 구간**이라 Stream 경계 규칙(REQ-GLB-03)의 대상이 아니다 — 진짜 경계는 그 뒤의 Modbus 소켓이다 | 원본 architecture.md §4 PlcSimModule 하지 않는 일 · [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) | SIM에 생성 로직을 넣으면 신호 프로파일 · 시드가 두 곳에 생겨 같은 시드가 다른 값을 낸다. Buffer 갱신을 Stream 경계 위반으로 읽고 큐를 끼우면 모사 구간에 측정 대상이 아닌 지연이 더해진다 | SIM 모듈의 의존에 신호 생성기 부재 · 같은 시드 2회 실행의 레지스터 값 대조 | SIM-03 | F-01 · F-09 | 해당 없음 |
| **REQ-SIM-07** | **같은 프로세스여도 Modbus 구간을 생략하지 않는다.** Collector는 실제 TCP 소켓으로 SIM에 접속하고 요청 인코딩 · 블록 병합 · 응답 디코딩을 모두 거친다 | 원본 data_flow.md §3 · 원본 architecture.md §9 | 프로세스 안에서 Buffer를 직접 읽으면 모드 A E2E에서 Modbus 계층이 빠져 "진짜 E2E와 Modbus 병목"(모드 A의 측정 대상)을 잴 수 없다 | Collector 연결 수 = 설비 수 · Modbus 왕복 히스토그램에 표본 존재 | SIM-01 · SIM-02 | F-01 | 해당 없음 — Modbus 왕복 히스토그램 |

## 요구사항 — 지연 · 오류 주입

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-SIM-08** | 지연 주입은 응답을 늦춰 Collector 타임아웃을 재현한다. 결과는 해당 스캔 그룹의 그 주기 결측(행 없음)이고, 주입을 풀면 다음 주기에 자동 복구한다 | 원본 architecture.md §17 Modbus 타임아웃 · 원본 tech_stack.md §6 | 지연이 timeout_ms를 넘지 않으면 타임아웃이 아니라 poll_duration 증가만 관측되어 "Modbus 타임아웃" 시나리오가 재현되지 않는다 | 지연을 timeout_ms 초과로 주입 → Collector 타임아웃율 증가 · 해당 구간 행 없음 · 해제 후 다음 주기 행 재개 | SIM-04 | F-01 · F-10 | 해당 없음 — Collector 타임아웃율 |
| **REQ-SIM-09** | 오류 주입은 Modbus 예외 응답을 돌려준다. Collector는 그 값을 BAD_COMM(2)으로 저장하고 알람 판정에서 뺀다 | 원본 data_flow.md §17 품질 코드 전파 · 원본 tech_stack.md §6 | 예외 응답 대신 연결을 끊으면 BAD_COMM이 아니라 타임아웃 · 재연결로 드러나 품질 코드 전파 검증이 성립하지 않는다 | 오류 주입 → tag_raw quality 2 행 존재 · 같은 구간 alarm_eval에 해당 태그 판정 부재 | SIM-05 | F-01 · F-06 | 해당 없음 — 품질 코드 분포 |
| **REQ-SIM-10** | 주입의 대상(설비 · 레지스터 범위) · 종류 · 기간은 SIM이 스스로 정하지 않고 실험이 정하며, 측정 기록에 주입 조건을 적는다. 제어 수단(환경변수 · 실행 중 제어)은 미설계다 | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) 기능별 경계 · REQ-GLB-17 | SIM이 무작위로 주입하면 같은 실험의 3회 실행이 서로 다른 장애를 겪어 중앙값이 무의미해진다. 주입 조건이 기록에 없으면 결측 구간을 장애로 오독한다 | 측정 기록의 주입 조건 칸 존재 · 주입 없는 기동에서 BAD_COMM · 타임아웃 0 | SIM-04 · SIM-05 | F-01 · F-10 | 해당 없음 |

## 요구사항 — 배치 제약과 결측 해석

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-SIM-11** | SIM은 COL · GEN(모드 A)과 같은 컨테이너 · 같은 프로세스에 있다. APP_ROLE로 역할을 나눌 때 SIM은 collector 역할과 함께 간다 | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) 의존 도메인 · 원본 architecture.md §3 루프백 바인드 | 루프백 바인드라 COL이 다른 컨테이너로 가면 닿지 않고, Buffer 갱신이 프로세스 안 호출이라 GEN이 다른 컨테이너로 가면 모드 A가 끊긴다 | APP_ROLE=collector 기동 시 SIM 포트 기동 확인 · APP_ROLE=datagen 단독 기동에서 모드 A 불가 확인 | SIM-01 · SIM-03 | F-01 · F-09 | 해당 없음 |
| **REQ-SIM-12** | api 컨테이너 재기동 · 재빌드로 생긴 결측 구간은 장애로 기록하지 않는다 — 값의 원천(SIM)까지 함께 멈췄기 때문이다. 부하 실험 중에는 재빌드하지 않고, 실험 밖 결측은 재빌드 흔적으로 기록하며 결측 구간 길이를 잰다 | 원본 data_flow.md §12.4 · 원본 architecture.md §17 api 컨테이너 중단 | 재빌드 결측을 유실로 세면 무손실 판정(생성 수 = 행 수)이 매 재빌드마다 거짓 실패한다. 실장비라면 그 구간이 진짜 유실이라는 차이를 잊으면 실장비 연결 뒤 같은 결측을 정상으로 넘긴다 | 재빌드 전후 tag_raw 결측 구간 길이 측정 · 측정 기록의 재빌드 여부 칸 | SIM-01 | F-01 · F-10 | 해당 없음 — 결측 구간 길이 |

- **B형 — 재빌드 결측은 이 환경에서만 정상이다.** 판정 근거는 "원천까지 함께 멈췄다"이지 "시뮬레이션이라 괜찮다"가 아니다. 실장비가 붙어 SIM이 원천이 아니게 되는 순간 REQ-SIM-12는 무효이며, 그때부터 재기동 결측은 유실로 센다.

## 실장비 대비 차이 등재

SIM이 의도적으로 재현하지 않는 것과 재현하는 것을 가른다. 제외의 정본은 [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md)다.

| 항목 | SIM | 실장비 | 측정에 미치는 영향 |
|------|------|------|------|
| 프로토콜 · 소켓 | 실제 Modbus TCP | 상동 | 없음 — REQ-SIM-07이 같게 만든다 |
| 네트워크 | 컨테이너 루프백 | LAN | E2E가 낙관적으로 나온다 — 망 지연은 따로 가산해 해석 |
| 응답 지터 · 통신 노이즈 | 재현하지 않음(주입 시만) | 상시 | 타임아웃율 기준선이 0에 가깝다 |
| 워드 순서 혼재 | 태그 설정대로만 | 벤더별 혼재 | 디코딩 오류 빈도가 실장비보다 낮다 |
| 재기동 결측 | 원천도 멈춤 — 정상 | 원천은 계속 — 유실 | REQ-SIM-12의 판정 경계 |

- 검산: 차이 등재 = **5**행 · 측정 영향 없음 **1**(프로토콜 · 소켓)

## 기능 → REQ 대응

[../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) 기능 목록의 SIM 기능 전부가 하나 이상의 REQ-SIM에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| SIM-01 | 설비당 Modbus TCP 서버 | REQ-SIM-01 · 02 · 03 · 07 · 11 · 12 | 6 |
| SIM-02 | 레지스터 응답 | REQ-SIM-04 · 05 · 07 | 3 |
| SIM-03 | 레지스터 런타임 갱신 | REQ-SIM-06 · 11 | 2 |
| SIM-04 | 지연 주입 | REQ-SIM-08 · 10 | 2 |
| SIM-05 | 오류 주입 | REQ-SIM-09 · 10 | 2 |

### 검산

- 기능 = SIM-01~05 = **5** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 6 + 3 + 2 + 2 + 2 = **15**
- REQ-SIM 채번 = 01~12 = **12** · 기능에 대응하지 않는 REQ **0**
- 에러 코드를 인용하는 REQ **0** — 전부 Collector 지표 · 품질 코드 · 기동 로그로 관측된다

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 지연 · 오류 주입의 제어 수단 | 닫힘 — 기동 시 읽는 주입 계획 SIM_FAULT_PLAN · 실행 중 제어 표면 없음 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4) · 표면이 필요하면 [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| FC01 · FC02 응답 영역 | 닫힘 — 시드 금지 유지(SIM은 비트 영역을 응답하지 않는다) · 해제 조건 4개를 같은 변경 단위에서 충족할 때만 연다 — [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) §BOOL 판정 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| SIM의 APP_ROLE 배정 | 닫힘 — ADR-22(SIM · GEN 모드 A는 collector와 동거) — [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)(W3) |
| 기동 실패 포트 계수의 메트릭 이름 | **W6 판정** — sim_listen_failed_ports · 적용 중 주입 sim_fault_injection_active | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| Python 시뮬레이터 분리 시 SIMULATED 판정 | 분리하면 host가 서비스명이 되어 루프백 규칙이 깨진다(원본 tech_stack.md §3.4 조건부 경로) | [../02_features/03_collector.md](../02_features/03_collector.md) 재판정 · [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) |
| 신호 생성 → 레지스터 반영 지연 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지. 원본 목표(4 vCPU 가정) p95 2 ms | [13_nonfunctional.md](./13_nonfunctional.md) REQ-NFR-04 |

## 관련 문서

- [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) — SIM 기능 목록 · 포트 대역과 용량 티어
- [04_collector.md](./04_collector.md) — Modbus 경계 반대편 · SIM 실패가 관측되는 지표
- [06_datagen.md](./06_datagen.md) — 레지스터 값의 원천(모드 A)
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-03 비동기 경계 · REQ-GLB-19 로컬 전용
- [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) — F-01 수집 기전
- [../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) — 제외가 만드는 한계
