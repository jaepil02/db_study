# 모듈 경계

> **대상**: api 프로세스 안 모듈 사이의 경계 — Stream 경계 원칙과 근거 4 · **업무 명령 경계(stream:biz:cmd · 워커 적용)** · 경계 예외(현행 없음 — D-16) · APP_ROLE 4값과 모듈 배정 · worker_threads 격리 대상 · **스위치 = DI 포트 확정 표(포트 · 구현 이름 정본)** · 리포지터리 구조 · **라이브 실행 RunControlModule(GEN)의 역할 배치**
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — **D-16 설비 가동 · HMI 개요 · 직접 비교 · SW-09 gated**(사용자 결정 2026-10-11 · ADR-28 · ADR-29) — APP_ROLE 표 api 행에 설비 가동 · HMI 개요 표면(plant 모듈 — RLT) · 직접 비교 · 센서 데이터(runs 모듈 — GEN) · collector 행에 **설비 가동 적용**(PlantRuntime — 공통 기능 · 도메인 셈 밖) · 판정 표 4 → **5**행(설비 가동 적용 — collector) · 스위치 확정 표 SW-09 행 잠정 명칭 대비 칸에 gated · **gated는 ADR-08의 기록된 예외** 불릿 · RunControlModule 포트 없음 불릿에 compare · 리포지터리 구조 modules 줄에 plant · runs · biz 자리 — 포트 · 구현 이름 불변
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지 · 도메인 11 → 8) — 모듈 11 → **8** · 경계 유형 5 → **4**(직접 호출 예외 삭제 · ADR-11 폐지) · §경계 예외 — 알람 판정 직접 호출 → **§경계 예외(현행 없음 · 새 예외가 답할 질문 4)** · Pub/Sub ch:alarm · ALM → RLT 삭제 · 명령 스트림 자기 간선 3 → **1**(MST) · APP_ROLE 5 → **4**(datagen 역할 삭제 — 코드 APP_ROLES all · api · worker · collector) · api · worker 행 AUT · ALM · WRK · 모드 C 수신 삭제 · 기능 단위 배정 도메인 3 → **2** · 판정 행 6 → **4** · SW-06 · SW-12 주입받는 모듈 alarms · work-orders · auth 삭제 · 리포지터리 구조 모듈 · loadtest · Taskfile 작업 갱신 · 경계 변경 절차의 실험 콘솔 → 각주 툴팁
> **개정일**: 2026-10-05 — 웹 · api 호스트 포트 이동(같은 머신의 다른 프로젝트가 호스트 3000 · 3001을 점유 · 사용자 결정 2026-10-05) — 웹 3001 → **13001** · api 호스트 3000 → **13000**(컨테이너 3000 · 서비스명 그대로) · CORS 허용 오리진 http://localhost:3001 → **http://localhost:13001** — 오리진 수 · 바인드 규칙 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — APP_ROLE api 행에 **GEN 라이브 실행(RunControlModule — 09_datagen #2~#5 · 실행 주체)** · 판정 행 5 → **6**(GEN 라이브 실행 → api · all) · Stream 경계 간선에 라이브 흐름 실행 · 명령 스트림 경계 간선에 GEN → MST(04_domain_map 간선 21 → 22와 같게) · RunControlModule은 포트 없음(스위치 아님) 불릿 — APP_ROLE 값 · GEN 역할 수 · 스위치 · 포트 · 구현 수 불변
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-H5) — SW-12 BizWritePort 사용 모듈 master · alarms · work-orders · auth → **master · alarms · work-orders(업무 쓰기 표면 — auth의 로그인 · 토큰은 대상 아님)** — 스위치 · 포트 · 구현 수 불변
> **개정일**: 2026-09-28 — 리드 정정(d-biz-b 대조) — 명령 스트림 경계 · worker 명령 적용의 도메인에서 AUT 제외(로그인 · 토큰은 업무 쓰기 아님 · 지침 §10) — 04_domain_map 자기 간선 3과 일치 · "반영 대기" 문구 해소
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27 · ADR-26) — 경계 유형 표에 **명령 스트림 경계**(stream:biz:cmd · grp:biz-writer · ch:bizreply) — 유형 4 → **5** · APP_ROLE worker에 업무 명령 적용 · 확정 표 **SW-12 BizWritePort · StreamBizWriter(stream · 기본) · DirectBizWriter(direct)** 신설 — 스위치 11 → **12** · 포트 11 → **12** · 구현 22 → **24**
> **개정일**: 2026-09-24 — S0 반영 — 리포지터리 구조에 scripts/ · .githooks/ 자리 추가 · Taskfile 행에 docs:lint
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 스위치 상태 레이블 · 이벤트 루프 메트릭 이름(정본 10_observability/01 · 06)
> **원천**: 원본 architecture.md §1 · §4 · §8.2 · §9(커밋 ff66a37) · 원본 tech_stack.md §1 · §3.1 · §3.3 · §3.4 · §5.3 · §11(커밋 ff66a37) · 원본 data_flow.md §4.2 · §8 · §9 · §15(커밋 ff66a37) · 원본 implementation_plan.md §4.3 · §6 · §7.2 · §7.3 · §7.5(커밋 ff66a37) · D-06 · ADR-06 · ADR-07 · ADR-08 · ADR-10 · ADR-11 · ADR-22 · ADR-25 · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)

8개 모듈은 api 컨테이너 **한 프로세스** 안에 산다. 그런데도 모듈 사이는 호출 스택이 아니라 Redis Stream · Pub/Sub · Modbus 소켓으로 잇는다. 이 경계가 확장 로드맵 1단계(APP_ROLE 역할 분리)를 **코드 변경 없이 기동 값만 바꾸는 일**로 만든다 — 경계를 미리 지불해 둔 값이 거기서 회수된다(원본 architecture.md §19).

이 문서는 경계의 **원칙 · 예외 · 배정 · 격리 · 교체 지점** 다섯을 고정한다. 특히 두 인계를 여기서 닫는다 — ① SIM · OBS의 APP_ROLE 배정(원본 미지정) ② 스위치 전종의 포트 · 구현 이름(02_features/13의 잠정 명칭 → **이 문서가 정본**).

## Stream 경계 원칙

**수집과 적재 사이에는 반드시 Redis Stream을 둔다. 같은 프로세스 안이어도 예외가 아니다**(ADR-06 · REQ-GLB-03). Collector가 Ingest의 메서드를 부르면 코드는 한 줄로 끝난다. 런타임이 둘이던 시절의 명분("언어 간 결합도 0")은 사라졌지만 경계를 유지하는 근거 넷이 남는다.

| # | 근거 | 경계가 주는 것 | 직접 호출로 바꾸면 | 이 근거를 재는 자리 |
|------|------|------|------|------|
| ① | 백프레셔 흡수 | 수집 속도와 적재 속도가 분리된다 | ClickHouse 삽입 지연이 Modbus 폴링 주기로 곧장 역류한다 — 폴링 주기가 삽입 지연을 따라 늘어난다 | SW-01 off + ClickHouse 중단(S6) — poll_duration 대 scan_rate |
| ② | at-least-once 재시도 · DLQ | PEL과 XAUTOCLAIM이 미처리 엔트리를 보존 · 회수한다 | 재시도가 메모리 안의 임시 상태가 되어 프로세스가 죽으면 함께 사라진다 | api 재기동 후 XPENDING 보존 · 생성 수 대 행 수 |
| ③ | 이벤트 루프 격리 | 폴링 루프와 배치 삽입이 각자의 주기로 돈다 | 한 호출 스택을 공유해 한쪽의 지연이 다른 쪽의 스케줄링을 밀어낸다 | nodejs_eventloop_lag_p95_seconds 대 수집 부하 |
| ④ | 재처리 · 역할 분리 대비 | APP_ROLE로 모듈을 떼어도 호출부가 그대로다 | 역할 분리 순간 호출부를 전부 다시 써야 한다 | 확장 1단계 진입 시 코드 diff 0 |

- 검산: 근거 = **4**
- **loopback 1홉이 이 넷의 대가다.** 대가는 XADD 왕복 하나이고 지연 예산의 한 구간으로 잰다 — [05_latency_budget.md](./05_latency_budget.md).
- 같은 원리가 팬아웃에도 적용된다. Ingest의 발행과 WebSocket 게이트웨이는 같은 프로세스에 있어도 Pub/Sub(ch:rt)을 지난다 — 경계를 없애면 api 다중 인스턴스(확장 2단계)에서 팬아웃 코드를 새로 써야 한다(ADR-07).

### 경계 유형과 매체

| 경계 유형 | 매체 | 간선 | 이 문서가 강제하는 것 |
|------|------|------|------|
| Stream 경계 | stream:plc:raw · 컨슈머 그룹 | COL → ING · GEN(라이브 흐름 실행의 모드 B 발행) → ING | 발행자는 Stream 페이로드 계약(스키마 버전 v) 하나로만 결합한다 |
| Pub/Sub 경계 | ch:rt · ch:cacheinv | ING → RLT · MST → 다른 api 인스턴스 | 발행자는 구독자를 모른다 |
| Modbus 경계 | 루프백 TCP 소켓 | SIM → COL | 같은 프로세스여도 소켓을 지난다 |
| 명령 스트림 경계 | stream:biz:cmd · 컨슈머 그룹 grp:biz-writer(소비자 1) · 결과 biz:result · ch:bizreply | 업무 쓰기 표면(MST) → 명령 적용 워커 · GEN 라이브 흐름 실행 → MST(시연 명령 master.device.patch — BizWritePort 프로세스 안 호출) | 표면은 명령 봉투(cmdId · kind · payload · actor · requestedAt) 하나로만 결합하고 결과를 기다린다 · 수집 스트림과 키 · 그룹을 공유하지 않는다(ADR-26 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로) |

- 경계 유형 전수 · 간선 검산의 정본은 [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) §경계 유형이다. 이 표는 데이터가 모듈을 건너는 네 유형만 다시 적고(명령 스트림 경계는 04_domain_map의 자기 간선 1 — MST + 도메인 사이 1 — GEN → MST) 저장소 경유 · 트랜잭션 공유 · 시뮬레이션 결합은 다루지 않는다. 옛 직접 호출(예외) 유형은 알람 판정과 함께 D-16으로 사라졌다(§경계 예외).

## 경계 예외

**지금 Stream 경계 원칙의 의도된 예외는 없다**(REQ-GLB-04). 유일한 예외였던 알람 판정 직접 호출(ING → ALM — 삽입이 확정된 배치의 행을 프로세스 안 호출로 판정에 넘기던 것 · ADR-11)은 알람 기능과 함께 D-16(사용자 결정 2026-10-11)으로 사라졌다. 옛 근거 표 원문은 커밋 28c0cc9에 있다.

| 옛 예외가 쓴 근거 | 새 예외가 같은 무게로 답해야 하는 질문 |
|------|------|
| 입력이 삽입 확정 배치의 행이다 | 호출 입력이 확정된 사실인가 — 확정 전 값을 넘기면 받는 쪽이 되돌릴 수 없는 판단을 한다 |
| 재처리 단위가 배치와 같다 | 실패의 재처리 단위가 호출하는 쪽과 같은가 — 다르면 한쪽만 재처리되는 창이 생긴다 |
| 역할 분리 뒤에도 같은 컨테이너에 남는다 | APP_ROLE로 떼어도 호출이 프로세스 경계를 건너지 않는가 |
| 상태가 이미 Redis에 있다 | 역할을 나눠도 상태를 공유하는가 — 프로세스 메모리 상태면 분리 순간 갈라진다 |

- 검산: 질문 = **4**
- **예외를 새로 두려면 이 네 질문의 답을 이 문서에 먼저 적는다.** 예외가 늘 때마다 APP_ROLE 분리의 "코드 변경 없음"이 거짓이 된다 — 같은 변경 단위에서 ADR 신설 · REQ-GLB-04의 기대값 · 도메인 지도 경계 유형을 함께 고친다(§경계 변경 절차).

## APP_ROLE 배정

APP_ROLE은 한 이미지에서 기동할 모듈 범위를 고르는 환경변수다. 값은 all(기본) · api · worker · collector 넷이다(루트 README 고정 기준 기동 역할). 옛 datagen 역할은 그 기능(모드 B 독립 발행 · 모드 C 발신 · 모드 D 백필 · 단독 처리량 실측)이 측정 도구와 함께 D-16으로 지워져 없앴다. **기동은 all이 기본이며 역할 분리는 확장 로드맵 1단계의 실측 진입 조건으로만 한다**(ADR-22 · REQ-GLB-22).

| APP_ROLE | 기동하는 모듈 · 기능 | 이 역할만의 이유 |
|------|------|------|
| all | 8모듈 전부 | 기본값 — 컨테이너 4 구성 |
| api | MST · TSQ · RLT(**설비 가동 · HMI 개요 표면 — plant 모듈 · 06_realtime #3~#5**) · GEN(**라이브 실행 RunControlModule** — 09_datagen #2~#8 · 흐름 시연 · 직접 비교 · 센서 데이터 · 실행 주체) · OBS | 사람이 부르는 HTTP · WebSocket 표면이 전부 여기 있다 |
| worker | ING · **업무 명령 적용(grp:biz-writer — MST의 쓰기 서비스 호출)** · OBS | 명령 적용은 표면과 명령 스트림으로만 이어져 api와 떨어져도 호출부가 그대로다 |
| collector | COL · **SIM** · **GEN(모드 A 레지스터 갱신)** · **설비 가동 적용(PlantRuntime — 셋을 켜고 끈다)** · OBS | PlcSim이 루프백에만 바인드하고 모드 A 갱신이 프로세스 안 호출이라 셋이 한 프로세스여야 한다 · 그 셋을 켜고 끄는 적용도 같은 프로세스여야 한다 |

- 검산: APP_ROLE 값 = **4** · all을 뺀 역할 3 · 옛 datagen 역할은 D-16 삭제
- **업무 명령 적용은 도메인이 아니라 공통 명령 기전의 기능이다(ADR-26).** worker 역할이 이 기능을 켜면 그 안에서 MST의 쓰기 서비스(트랜잭션 · 원장 · 무효화 체인)를 부른다 — 쓰기 서비스의 소유는 각 모듈 그대로이고, api 역할의 같은 모듈은 검증 · XADD · 결과 대기만 한다. SW-12 direct면 api 역할이 쓰기 서비스를 직접 부른다. 아래 도메인 배정 셈은 이 공통 기능을 빼고 센다.
- **설비 가동 적용도 공통 기능으로 센다(D-16).** RLT-10 표면(api)은 Redis 키 ctl:plant:power만 쓰고, collector 역할의 적용(PlantRuntime)이 1초마다 그 키를 읽어 SIM 포트 · 모드 A 틱 · 폴링을 켜고 끈다 — 표면과 적용이 Redis 키로만 이어져 역할을 나눠도 호출부가 그대로다. 상태 읽기 · 쓰기(PlantPowerModule)는 전 역할에 싣는다(지우기의 가동 중 409 판정이 어느 역할에서든 같은 키를 읽는다).
- **모듈이 아니라 기능 단위로 배정되는 도메인이 둘이다** — GEN(라이브 실행 api · 모드 A collector) · OBS(전 역할). 검산: GEN 2역할 + OBS 3역할 · 나머지 6도메인은 역할 하나. 모듈 하나를 여러 역할에서 기동하되 역할마다 켜는 기능이 다르다 — 기능 선택은 APP_ROLE을 읽는 모듈 초기화가 하고 경로 안 분기로 하지 않는다(ADR-08과 같은 원리).

### SIM · OBS · GEN 모드 A 판정

원본은 SIM · OBS에 역할을 주지 않았다(원본 architecture.md §4 확장 방식 열). 인계 두 건과 그 파생 제약을 아래로 닫는다(ADR-22).

| 대상 | 판정 | 근거 | 버린 안과 실패 |
|------|------|------|------|
| SIM | **collector 역할**에 배정한다 | PlcSim 포트 5020~5119는 컨테이너 루프백 전용이다. Collector가 다른 컨테이너로 가면 소켓이 닿지 않는다(REQ-SIM-11) | ① SIM을 다른 역할에 배정 — collector 컨테이너의 루프백에 PlcSim이 없어 모드 A 폴링 전부가 연결 거부된다. ② SIM 전용 역할 신설 — 루프백 제약을 풀려면 포트를 브리지에 열어야 하고 그 순간 "publish하지 않는다"가 컨테이너 간 노출로 바뀐다 |
| GEN 모드 A | **collector 역할**에서 기동한다 | 모드 A의 레지스터 Buffer 갱신은 프로세스 안 호출이다(GEN → SIM 시뮬레이션 결합) | 모드 A를 다른 역할에 두면 Buffer가 다른 프로세스에 있어 갱신이 닿지 않는다 — 모드 A만 끊기고 흐름 시연은 동작해 **결함이 늦게 드러난다** |
| GEN 라이브 실행(RunControlModule) | **api 역할**(all 포함)에서 기동한다 · 실행 상태는 그 인스턴스 메모리 | 시작 · 조회 · 중단 표면을 받는 프로세스가 실행을 들고 있어야 중단이 같은 메모리의 취소 수단(query_id · 연결 · 발행 루프)에 닿는다 | ① 다른 역할에 두면 표면(api)과 실행 사이에 중단 · 진행 조회를 나르는 새 제어 채널이 필요하다 — 경계 유형이 하나 는다. ② worker에 두면 flow 실행의 발행 부하가 같은 프로세스의 ING 소진과 이벤트 루프를 다퉈 흐름도가 실행 자신의 간섭을 보인다 |
| 설비 가동 적용(PlantRuntime) | **collector 역할**(all 포함)에서 기동한다 · 기동 때 키를 지워 기동 기본값부터 시작한다 | 켜고 끄는 대상(SIM 포트 · 모드 A 틱 · 폴링)이 collector 프로세스 안에 있다 — 프로세스 안 시작 · 정지 호출이다 | ① api 역할에 두면 SIM · COL이 없는 프로세스가 켜고 끌 대상을 못 찾아 키만 바뀌고 공장은 그대로다 ② 표면에서 직접 시작 · 정지를 부르면 역할 분리 뒤 프로세스 경계를 건너는 제어 채널이 필요하다 — 키 하나로 따르게 하면 채널이 Redis 하나로 끝난다(ADR-29) |
| OBS | **전 역할에서 기동한다.** 역할마다 자기 /metrics · /api/v1/health를 낸다. 저장소 통계 수집(Redis INFO · pg_stat · system.*)은 **api 역할 한 곳에서만** 한다 | 계측은 모듈이 자기 카운터를 등록하는 방식이라 카운터가 있는 프로세스마다 창구가 있어야 한다. 저장소 통계는 프로세스와 무관한 값이다 | ① OBS를 api에만 — worker · collector의 컨슈머 랙 · 폴링 지연 카운터가 창구를 잃어 분리 직후 파이프라인이 계측 공백이 된다. ② 저장소 통계를 역할마다 수집 — 같은 값을 세 번 조회해 pg_stat_statements · system.query_log에 관측 쿼리가 세 배로 섞인다 |

- 검산: 판정 행 = **5** · 옛 GEN 모드 B · D · 실측 · 모드 C 수신 행은 D-16 삭제 · 설비 가동 적용 행은 D-16 신설
- **라이브 실행이 api 역할에 부하를 싣는 것은 설계된 동작이다(B형).** 결론 — flow 발행은 api 프로세스에서 돈다. 반대 시나리오 — 생성기 CPU를 대상과 가르려고 실행을 다른 역할에 두면 ①의 제어 채널이 생기는데, 라이브 실행은 측정이 아니라 시연이라 CPU 분리가 지킬 측정값이 없다. 파생 지침 — 생성은 worker_threads에서 한다(§worker_threads 격리 대상).
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
| SW-06 | RealtimeFanoutPort | RedisPubSubFanout | DirectGatewayFanout | ingest | 유지 |
| SW-07 | FrameThrottlePort | WindowMergeThrottle | PassthroughThrottle | realtime | 유지 |
| SW-08 | BatchTokenPort | DeterministicBatchToken | NoBatchToken | ingest | 유지 |
| SW-09 | ControlTableSinkPort | PostgresControlSink | NoopControlSink | ingest | 유지 — gated(기본 · D-16)도 on 구현을 주입하고 게이트 판정으로 감싼다 |
| SW-10 | DeadbandFilterPort | TagDeadbandFilter | PassthroughFilter | collector | 유지 |
| **SW-11** | **LatestValueWritePort** | **IngestLatestValueWriter**(값 ingest · 기본) | **CollectorLatestValueWriter**(값 collector) | ingest · collector | **신설** — 스위치 아닌 교체 포트에서 이동 |
| **SW-12** | **BizWritePort** | **StreamBizWriter**(값 stream · 기본 — XADD · 결과 대기 · 202) | **DirectBizWriter**(값 direct — 쓰기 서비스 직접 호출 · 옛 경로) | master(업무 쓰기 표면) | **신설**(사용자 결정 2026-09-27 · ADR-26 · EXP-46) |

- 검산: 스위치 12 = 유지 9 + 개명 1(SW-02) + 신설 2(SW-11 · SW-12) = **12** · 포트 **12** · 구현 12 × 2 = **24**
- **SW-12의 두 구현은 같은 쓰기 서비스 · 같은 무효화 체인을 부른다.** 달라지는 것은 적용 주체(워커 대 api)와 그 사이의 명령 스트림 · 원장 · 결과 키뿐이라 표면 응답이 같다 — 차이가 지연 · 가용성 · 멱등으로만 드러나야 경로의 비용을 잴 수 있다(그 실험 EXP-46은 측정 도구 삭제로 폐지(D-16)). 포트를 표면 컨트롤러 뒤에 두어 경로 안 if를 두지 않는다(ADR-08).
- **SW-11은 on/off가 아니라 갱신 주체 값(ingest · collector)을 고른다.** on 구현 열에 기본값 쪽을, off 구현 열에 대안 쪽을 적었다. 분류는 "Redis 역할 — 최신값 결합"이며 채번 · 기본값의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)다. ADR-10의 S6 비교가 스위치 상태로 측정 기록에 남는다.
- **SW-02를 개명한 이유 — 최신값에는 포트가 둘 생긴다.** 보정 7.2의 갱신 주체를 교체 가능하게 두려면 쓰기 쪽 포트가 필요한데(ADR-10), 읽기 포트가 LatestValuePort라는 이름을 가지면 두 포트의 이름이 겹쳐 "SW-02 off가 갱신도 끄는가"라는 오독이 생긴다. SW-02는 **읽기 포트만 교체한다**(02_features/13 §스위치별 판정) — 이름이 그 판정을 싣는다.
- **B형 — SW-09 gated는 "스위치는 런타임 분기가 아니다"(ADR-08)의 기록된 예외다.** 결론 — gated는 주입된 같은 COPY 구현(PostgresControlSink) 앞에서 배치마다 Redis 게이트를 보고 싣거나 건너뛴다 — 경로 안 판정이 하나 생긴다. 반대 시나리오 — 예외를 두지 않으면 직접 비교가 돌 때마다 SW-09를 on으로 바꾸고 api를 재기동해야 하고, 그 사이 설비 가동 데이터가 늘 PostgreSQL에 실려 비교 사본이 구간 밖으로 자란다. 파생 지침 — 판정은 sink 장식(게이트 판정 + 같은 구현) 한 자리에만 두고 측정 대상 코드(ClickHouse 삽입 · COPY 자체)에 if를 흩뿌리지 않는다 · health · obs_switch_info의 impl은 PostgresControlSink 그대로이고 value가 gated를 말한다 · 게이트를 켜는 주체는 직접 비교 실행 하나다([09_decision_records.md](./09_decision_records.md) ADR-28).
- **SW-07만 값이 밀리초다.** WindowMergeThrottle은 창 크기(0 초과)를 주입받고, 0이면 PassthroughThrottle을 주입한다 — 창 0의 WindowMergeThrottle을 만들지 않는다. 창 0을 병합 구현으로 돌리면 "병합 없음"과 "병합하되 창이 0"이 계측에서 갈리지 않는다.
- **SW-06의 대상 채널은 ch:rt 하나다.** ch:cacheinv는 DirectGatewayFanout으로 바뀌지 않는다 — 구독자가 게이트웨이가 아니라 다른 api 인스턴스다.
- 노출 값: OBS가 health · /metrics에 내는 스위치 상태는 **기동 시 실제로 주입된 구현**을 기준으로 한다(REQ-OBS-11). 레이블 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다 — obs_switch_info(switch · env · value · impl)(W6).

### 스위치가 아닌 교체 포트

아래 포트는 **스위치 번호가 없다.** 스위치는 실험 손잡이이고, 아래는 두 번째 구현을 해당 확장 단계에서만 만드는 구조 추상화다.

| 포트 | 구현 | 선택 방식 | 결정 | 상태 |
|------|------|------|------|------|
| PointSourcePort | RedisStreamSource(현행) | 단일 구현 | ADR-04 | Kafka 전환(확장 4단계) 대비 추상화 — 두 번째 구현은 그 단계에서만 만든다 |

- 검산: 스위치 아닌 교체 포트 = **1**(PointSourcePort) — LatestValueWritePort는 SW-11로 채번되어 확정 표로 옮겼다
- **RunControlModule은 포트가 없다 — 스위치가 아니다.** 라이브 실행(flow · compare)은 실험 손잡이가 아니라 시연이라 교체 구현을 두지 않고 스위치 번호도 받지 않는다. flow 실행의 업무 명령은 기존 SW-12 BizWritePort를 프로세스 안에서 부를 뿐이다 — 주입된 구현을 따르므로 stream이면 명령 스트림 · 워커를 지나고 direct면 api가 직접 적용한다.
- **키 계열별 래퍼 3종(CacheKeyClient · DurableKeyClient · FanoutPublisher)은 포트가 아니다.** 스위치로 바꾸지 않는 강제 수단이며 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다(ADR-13).

## 리포지터리 구조

원본의 모노레포 제안(원본 tech_stack.md §11 · 원본 implementation_plan.md §6)을 따르되 문서 자리를 docs/ 12폴더와 docs/measurements로 바꾼다. 코드는 아직 없다 — 아래는 구현이 앉을 자리의 계약이다.

```plain
db_study/
├── apps/
│   ├── web/                    ← Next.js · 호스트 프로세스(13001)
│   └── api/src/
│       ├── modules/            ← 도메인 8 + 같은 도메인의 기능 디렉터리
│       │   ├── master · timeseries · realtime · plant                         ← 제어 평면 3(plant = RLT 설비 가동 · HMI 개요)
│       │   ├── collector · plc-sim · ingest · datagen · runs                  ← 데이터 평면 4(runs = GEN 라이브 실행 · 직접 비교)
│       │   ├── biz                                                            ← 업무 명령 기전(도메인 밖 공통 경로)
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
├── snapshots/                  ← 덤프(Git 제외)
├── docs/                       ← 설계 정본 12폴더(docs/README.md 문서 지도)
│   └── measurements/           ← 실측 기록 — 번호 없는 예외 폴더(D-09)
├── scripts/                    ← 문서군 린트 · 저장소 보조 스크립트(도구 파일 자리 정본 09_tech_stack/05)
├── .githooks/                  ← pre-commit 품질 게이트
└── Taskfile                    ← migrate · seed · up · api-build · test-surface · docs:lint
```

- **원본 레이아웃의 docs 행이 바뀌었다.** 원본은 docs/ 아래(또는 루트)에 설계서 4본을 두었다. 현행은 docs/ 12폴더가 설계 정본이고 루트 4본은 W7에서 삭제된다(D-03) · docs/measurements는 설계 정본이 아니다(D-09).
- **common/ports가 스위치의 물리적 자리다.** 포트 인터페이스가 모듈 안에 흩어지면 스위치 목록과 코드의 대응을 한 곳에서 셀 수 없다.
- 모듈 디렉터리 이름은 도메인 ↔ 모듈 1:1 매핑을 따른다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)). 도구 · 버전 · 파일 이름 규칙의 정본은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)다.

## 경계 변경 절차

| 변경 | 먼저 고칠 자리 | 같은 변경 단위에서 함께 | 어기면 |
|------|------|------|------|
| 직접 호출 예외 추가 | 이 문서 §경계 예외에 근거 4행 상당 | ADR 신설 · REQ-GLB-04의 기대값 · 도메인 지도 경계 유형 | 역할 분리 때 끊기는 호출을 사전에 셀 수 없다 |
| 스위치 신설 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 채번 | 이 문서 확정 표 · 실험 카탈로그 · 화면 각주 툴팁(08_screen/08) | 포트 없는 스위치 또는 번호 없는 포트가 생긴다 |
| 포트 · 구현 개명 | 이 문서 확정 표 | 02_features/13 측정 · 교체 표 인용 | 정본과 인용이 다른 이름을 말한다 |
| APP_ROLE 배정 변경 | 이 문서 §APP_ROLE 배정 | 도메인 지도 APP_ROLE 열 · ADR-22 | 루프백 · 프로세스 안 결합이 역할 경계에서 끊긴다 |
| worker_threads 대상 추가 | 이 문서 §worker_threads 격리 대상 | 지연 예산의 측정 지점 | 격리 대상이 코드에만 있어 이벤트 루프 지연의 원인을 추적할 수 없다 |

- 검산: 변경 유형 = **5**

## 관련 문서

- [01_system_architecture.md](./01_system_architecture.md) — 아키텍처 불변식 표
- [09_decision_records.md](./09_decision_records.md) — ADR-06 · ADR-07 · ADR-08 · ADR-10 · ADR-11(폐지 — D-16) · ADR-22 · ADR-25
- [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) — 도메인 ↔ 모듈 · 경계 유형 · 간선 검산
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-NN 채번 정본
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — REQ-GLB-03 · 04 · 20 · 21
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 키 계열별 래퍼
