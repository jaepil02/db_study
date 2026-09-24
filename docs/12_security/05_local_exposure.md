# 로컬 노출 (05_local_exposure)

> **대상**: 로컬 전용 구성의 노출 경계 — 호스트 포트 전수와 바인드 · 저장소 포트를 여는 이유와 안전장치 · 웹 개발 서버의 바인드 · PlcSim 루프백 · WSL2 mirrored 네트워킹의 함의 · 127.0.0.1 바인드가 막는 것과 못 막는 것 · 노출 검증 절차
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 현행 측정 머신 redis 호스트 포트 6380 반영
> **원천**: 원본 architecture.md §2 · §3(커밋 ff66a37) · 원본 tech_stack.md §10.4(커밋 ff66a37) · 원본 implementation_plan.md §2.5(커밋 ff66a37) · D-02 · ADR-18 · REQ-GLB-18 · 19 · REQ-TEC-01 · 02 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §네트워크와 호스트 포트 · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §WSL2 mirrored 네트워킹 · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../README.md](../README.md) 고정 기준 호스트 포트

db_study는 배포하지 않는다(D-02). **노출 경계는 하나다 — 호스트 포트를 127.0.0.1에만 바인드한다**(ADR-18 · REQ-TEC-02 · REQ-GLB-19). 이 문서는 그 경계가 어디까지 막고 어디서 끝나는지를 적는다. 바인드 규칙 자체의 정본은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)이고 포트 값의 정본은 [../README.md](../README.md) 고정 기준이다.

**127.0.0.1 바인드는 LAN을 막고 같은 머신은 막지 않는다.** 같은 머신의 브라우저 · 프로세스 · 파일에 대한 방어는 [01_authn_authz.md](./01_authn_authz.md) · [02_secrets_config.md](./02_secrets_config.md) · [03_api_surface_defense.md](./03_api_surface_defense.md)가 맡는다. 이 경계 하나를 근거로 안쪽 방어를 생략하지 않는다 — 외부에서 도달할 수 없다는 사실은 인가 검사나 입력 검증을 생략할 이유가 되지 않는다(전역 불변식 로컬 전용).

## 호스트 포트 전수

고정 기준의 호스트 포트를 노출 관점으로 다시 적는다. 사용자 열의 "앱"은 애플리케이션 코드, "사람"은 학습자의 도구다.

| 서비스 | 호스트 주소 | 사용자 | 인증 | 여는 이유 | 바인드 강제 자리 |
|------|------|------|------|------|------|
| 웹(Next.js 개발 서버) | 127.0.0.1:3001 | 브라우저 | 앱 로그인(S7) | 화면 | **개발 서버 기동 인자** — Compose 밖(§웹 개발 서버의 바인드) |
| api | 127.0.0.1:3000 | 브라우저 직결 · BFF · k6 · Prometheus | 토큰(S7) · 공개 2 | REST · WebSocket · /metrics | Compose ports |
| postgres | 127.0.0.1:5432 | 앱 · 사람(psql · DBeaver) | 비밀번호 · DB 역할 | 학습용 직접 조회 | Compose ports |
| clickhouse HTTP | 127.0.0.1:8123 | 앱 · 사람 | 비밀번호 | 앱의 유일한 ClickHouse 포트 | Compose ports |
| clickhouse 네이티브 | 127.0.0.1:9000 | 사람(clickhouse-client · clickhouse-benchmark) | 비밀번호 | CLI · 벤치마크 | Compose ports |
| clickhouse 메트릭 | 127.0.0.1:9363 | Prometheus · 사람 | 없음 | 내장 메트릭 엔드포인트 | Compose ports |
| redis | 127.0.0.1:6379(현행 측정 머신 127.0.0.1:6380 — 호스트 redis-server 충돌) | 앱 · 사람(redis-cli) | 비밀번호 | 학습용 직접 조회 | Compose ports |
| prometheus(프로파일) | 127.0.0.1:9090 | 사람 · Grafana | 없음 | 메트릭 저장 · 조회 | Compose ports |
| grafana(프로파일) | 127.0.0.1:3002 | 사람 | 관리자 비밀번호 | 대시보드 | Compose ports |

- 검산: 호스트 포트 = 웹 1 + api 1 + postgres 1 + clickhouse 3 + redis 1 + 프로파일 2 = **9** — 고정 기준 호스트 포트와 같다 · 인증 없음 2(9363 · 9090)
- **PlcSim 5020~5119는 이 표에 없다** — publish하지 않는다(§PlcSim 루프백).
- **인증 없는 두 포트는 읽기 전용 메트릭이다.** 9363은 ClickHouse 내부 지표, 9090은 스크레이프한 시계열이다 — 업무 데이터 · 비밀이 없다는 점에서 /metrics 공개 판정([04_threat_model.md](./04_threat_model.md) §공개 표면)과 같은 근거를 쓴다.
- 비밀번호 판정의 정본은 [02_secrets_config.md](./02_secrets_config.md) §비밀 목록이다.

## 저장소 포트를 여는 이유와 안전장치

**원본은 이 판단을 뒤집었다.** 공개 호스트 구성에서는 저장소 포트를 호스트에 여는 것이 금지였고, 로컬 전용으로 바꾸며 열기로 했다(원본 architecture.md §3 · 원본 tech_stack.md §10.4). 여는 이유는 학습이다 — psql · clickhouse-client · redis-cli · DBeaver로 직접 붙어 상태를 보는 것이 이 시스템의 학습 방식이다.

| 안전장치 | 막는 것 | 근거 | 이 장치가 없으면 |
|------|------|------|------|
| 127.0.0.1 바인드 | LAN의 다른 기기 | ADR-18 · REQ-TEC-02 | 0.0.0.0 바인드는 같은 네트워크의 기기에 DB를 그대로 여는 것과 같다 |
| 저장소 비밀번호 | 같은 머신의 다른 OS 사용자 · .env를 모르는 프로세스 | [02_secrets_config.md](./02_secrets_config.md) 판정 | 루프백에 닿는 모든 프로세스가 저장소 전권을 가진다 |
| DB 역할 권한 | 앱 계정의 DDL · 감사 행 수정 · 물리 삭제 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 앱 자격 증명 하나가 스키마 전체다 |
| 앱 포트와 사람 포트의 분리 | 커넥션 해석의 혼동 | 원본 architecture.md §3 ClickHouse 포트 용도 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) | 사람의 CLI 접속이 앱 커넥션 수에 섞여 측정 해석이 틀린다 |
| 호스트 쪽 포트만 변경 | 충돌 해소 중의 구성 파손 | 원본 architecture.md §3 · 원본 tech_stack.md §10.4 | 컨테이너 내부 포트를 바꾸면 Dictionary 소스 · api 접속 설정이 전부 어긋난다 |

- 검산: 안전장치 = **5**
- **B형 — 저장소 포트가 호스트에 열려 있는 것은 설정 누락이 아니다.** 결론 — 학습 도구를 붙이기 위해 연 것이다. 반대 시나리오 — 포트를 닫고 컨테이너 안 CLI만 쓰면 DBeaver를 붙일 수 없고 확인마다 컨테이너 진입이 되어 관찰 비용이 커진다(ADR-18 버린 대안 ③). 파생 지침 — 열린 포트의 방어는 바인드 주소와 비밀번호 둘로 하고, 하나에 전부를 걸지 않는다.
- **웹은 저장소에 직접 붙지 않는다**(원본 architecture.md §2 경계 표). 웹이 DB에 붙는 경로가 생기면 인가 검사를 우회하는 두 번째 방어 지점이 생긴다 — 저장소 포트가 열려 있다는 사실이 웹의 직접 접속을 허용하는 근거가 되지 않는다.
- **Docker의 publish는 호스트 방화벽 규칙보다 앞선다.** 0.0.0.0으로 publish하면 호스트 방화벽 설정과 무관하게 포트가 열릴 수 있다 — 방화벽을 안전장치로 세지 않고 publish 주소만 센다(공식 참조 재확인 대기 · [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)).

## 웹 개발 서버의 바인드

웹은 컨테이너가 아니라 호스트 프로세스다(REQ-TEC-01). 그래서 **Compose의 publish 규칙이 웹에 닿지 않는다.**

| 관점 | 내용 |
|------|------|
| 고정 기준 | 웹 3001도 127.0.0.1 바인드다([../README.md](../README.md) 호스트 포트 · REQ-TEC-02) |
| 강제 자리 | Compose ports가 아니라 **개발 서버의 기동 인자**(호스트 이름) |
| 기본값의 위험 | Next.js 개발 서버의 기본 호스트 이름은 모든 인터페이스다(공식 참조 재확인 대기) — 인자 없이 띄우면 3001이 LAN에 열린다 |
| 열리면 | LAN 기기가 웹 화면과 BFF Route Handler에 닿고, BFF의 서버 fetch는 127.0.0.1:3000으로 가므로 **BFF가 LAN과 api 사이의 중계가 된다** — api의 127.0.0.1 바인드가 BFF 경유 표면에 대해 무력해진다 |
| 판정 | 웹 개발 서버 기동 명령에 호스트 이름 127.0.0.1을 명시한다 — W7 반영 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §기동 · 정지 명령 ④ · 인자는 웹 패키지 개발 스크립트에 박는다 |

- 검산: 관점 = **5**
- **A형 — "모든 포트가 127.0.0.1인데 LAN에서 로그인 화면이 열린다"는 바인드 규칙 위반이 아니라 규칙이 닿지 않는 자리다.** 통념은 고정 기준 표가 바인드를 강제한다는 것이다. 부정 — 표는 계약이고, 강제는 Compose ports가 하는데 웹은 Compose 밖이다. 진짜 축은 **강제 주체**다. 대체 경로 — 기동 명령이 호스트 이름을 싣고 §노출 검증 절차가 3001의 수신 주소를 확인한다.
- 브라우저의 접속 주소는 여전히 http://localhost:3001이다 — CORS 허용 오리진은 접속 URL의 문자열로 판정되므로 바인드 주소를 127.0.0.1로 적어도 오리진은 바뀌지 않는다.

## PlcSim 루프백

| 항목 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 포트 | 5020~5119 — **컨테이너 내부 루프백 전용** · publish하지 않는다 | 원본 architecture.md §3 · REQ-TEC-02 · ADR-18 | 시뮬레이터가 호스트 · LAN의 Modbus 클라이언트에 노출된다 |
| 접속 주체 | 같은 api 컨테이너의 Collector가 localhost로 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) | 해당 없음 |
| 프로토콜 인증 | 없다 — Modbus TCP에는 인증 계층이 없다 | [../11_glossary/01_domain_terms.md](../11_glossary/01_domain_terms.md) | 포트가 열리면 누구든 레지스터를 읽고 쓰기 기능 코드로 값을 바꾼다 |
| 생성 데이터 표지 | 설비 접속 대상이 루프백이면 Collector가 SIMULATED(9)를 단다 | REQ-GLB-18 | 표지가 없으면 시뮬레이션 값과 실데이터가 섞인 뒤 구분할 방법이 없다 |

- 검산: 항목 = **4**
- **publish하지 않는 것이 이 포트의 유일한 방어다(B형).** 결론 — Modbus는 인증이 없어 도달 가능성이 곧 제어권이다. 반대 시나리오 — 디버깅 편의로 5020을 publish하면 같은 머신의 어느 프로세스든 시뮬레이터 레지스터를 바꿔 수집값을 조작하고, 그 값은 SIMULATED 표지를 달고 정상 경로로 적재된다 — 측정 무결성이 조용히 깨진다. 파생 지침 — 시뮬레이터 확인은 컨테이너 안에서 한다.
- 실제 PLC 장비 연결은 현행 범위가 아니다(원본 architecture.md §2 — 현장은 현재 미연결).

## WSL2 mirrored의 함의

원본 실측 환경은 Windows WSL2 · networkingMode=mirrored다(원본 implementation_plan.md §2.5). 환경 쪽 영향의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §WSL2 mirrored 네트워킹이고, 이 표는 **보안 쪽 함의의 정본**이다.

| 항목 | 영향 | 보안 함의 |
|------|------|------|
| Windows 브라우저 → WSL2 서비스 | localhost:3001 · localhost:3000으로 포트 포워딩 없이 직결 | 포워딩 규칙을 두지 않으므로 포워딩이 0.0.0.0으로 열리는 사고가 없다 |
| 127.0.0.1 바인드의 안전성 | **유지** — mirrored는 루프백을 호스트와 공유할 뿐 LAN에 노출하지 않는다 | 원본 설계의 바인드 전제(원본 tech_stack.md §10.4)가 그대로 유효하다 |
| CORS 오리진 | 변화 없음 — http://localhost:3001 하나 | 오리진 설정을 환경마다 바꿀 필요가 없다 |
| 측정 | 루프백 경로가 한 단계 짧아 E2E 지연이 NAT 모드보다 낙관적이다 | 보안 함의 없음 — 측정 한계 정본 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |
| **같은 머신의 범위** | 루프백 공유 | **"같은 머신"이 Windows 호스트의 프로세스 전부로 넓어진다** — Windows 쪽 앱 · 브라우저 확장 · 다른 개발 도구가 127.0.0.1의 저장소 포트에 닿는다 |

- 검산: 항목 = 원본 4 + 신설 1(같은 머신의 범위) = **5**
- **mirrored는 노출을 줄이지 않고 옮긴다.** LAN 노출은 그대로 0이지만, 루프백 안쪽의 이웃이 WSL2 VM의 프로세스에서 Windows 호스트의 프로세스 전부로 늘어난다 — 저장소 비밀번호([02_secrets_config.md](./02_secrets_config.md))가 바인드 주소만으로 부족한 이유 하나가 이것이다.
- NAT 모드로 되돌리면 Windows 브라우저가 WSL2 서비스에 닿기 위해 포워딩이 필요해지고, 포워딩 설정이 수신 주소를 넓게 잡으면 LAN에 열린다 — mirrored 유지가 노출 쪽에서도 유리하다.

## 127.0.0.1 바인드가 막는 것과 못 막는 것

REQ-GLB-19의 강제 주체는 Compose 포트 표기이고 잔여는 이 문서가 받는다([../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) 강제 주체 표). 형식은 한계 등재다.

| 항목 | 강제 주체 | 막는 것과 못 막는 것 | 잔여가 어디에 담기는가 |
|------|------|------|------|
| LAN 기기의 저장소 · api 접속 | Compose ports의 127.0.0.1 접두 | 막는다 — 수신 주소가 루프백뿐이다 | 해당 없음 — 닫힘 |
| LAN 기기의 웹 접속 | 개발 서버 기동 인자 | 인자가 있으면 막는다 · 인자가 빠지면 못 막는다 — Compose 밖이다 | §웹 개발 서버의 바인드 |
| 같은 머신 프로세스의 포트 접속 | 없음 — 바인드는 같은 머신을 구분하지 않는다 | 못 막는다 — 저장소는 비밀번호, api는 토큰(S7)이 막는다 | [02_secrets_config.md](./02_secrets_config.md) · [03_api_surface_defense.md](./03_api_surface_defense.md) |
| 같은 머신 브라우저 페이지의 요청 | 없음 — 바인드는 요청 출처를 모른다 | 못 막는다 — CORS · SameSite · Origin 검증이 막는다 | [03_api_surface_defense.md](./03_api_surface_defense.md) |
| DNS 재바인딩 페이지 | 없음 — 바인드는 Host를 모른다 | 못 막는다 — 브라우저가 127.0.0.1로 요청을 보낸다 · api는 Host 대조(REQ-AUT-13)가 막고 9090 · 9363은 남는다 | [04_threat_model.md](./04_threat_model.md) §통제가 생긴 위협 |
| 컨테이너 사이 접속 | 없음 — 기본 브리지 하나 · 서비스명 DNS | 해당 없음 — 바인드는 호스트 publish만 다룬다 · 컨테이너끼리는 비밀번호가 가른다 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |

- 검산: 항목 = **6** · 바인드가 막는 것 1 · 조건부 1 · 못 막는 것 4
- **네트워크 분리를 두지 않은 이유는 분리할 대상이 없어서다.** 이중 네트워크는 공인 IP 호스트를 전제한 구성이다([../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)) — 로컬에서는 컨테이너 넷이 서로를 부르는 관계라 네트워크를 갈라도 막을 경로가 없다.

## 노출 검증 절차

바인드는 문서가 아니라 **수신 주소**로 확인한다. 기동 직후와 Compose · 기동 명령을 바꾼 뒤마다 한다.

```plain
① Compose publish 확인     docker compose ps — PORTS 열이 전부 127.0.0.1: 접두인지
② 호스트 수신 주소 확인     수신 소켓 목록 조회 — 3001 · 3000 · 5432 · 8123 · 9000 · 9363 · 6379(현행 머신 6380)(· 9090 · 3002)의 수신 주소가 127.0.0.1인지
③ PlcSim 비공개 확인       호스트 수신 목록에 5020~5119가 없는지
④ LAN 쪽 확인             같은 네트워크의 다른 기기에서 호스트 IP의 위 포트로 접속 → 전부 실패
⑤ 저장소 인증 확인         비밀번호 없이 psql · redis-cli · clickhouse-client 접속 → 전부 거절
```

- **②가 웹을 잡는 유일한 단계다.** ①은 Compose 안만 본다 — 웹 개발 서버의 수신 주소는 ②에서만 드러난다.
- **④는 mirrored 환경에서도 한다.** mirrored가 LAN 노출을 만들지 않는다는 전제(원본 implementation_plan.md §2.5)를 실제 기기로 한 번 확인해 두면 이후 WSL 설정 변경 때 비교 기준이 된다.
- 검증 결과는 착수 체크리스트의 환경 항목과 함께 기록한다 — 검증 명령의 정확한 모양은 플랫폼마다 달라 계약으로만 적는다.

## 원본 대조

| 원본 자리 | 사실 | 이 문서의 자리 |
|------|------|------|
| architecture §2 시스템 컨텍스트 그림 · 사용자 문단 | 웹 localhost:3001 · api 127.0.0.1:3000 · PlcSim 루프백 · 원격 접속자 없음 | §호스트 포트 전수 · §PlcSim 루프백 |
| architecture §2 경계 표 웹 → DB 행 | 금지 | §저장소 포트를 여는 이유와 안전장치 |
| architecture §3 서비스 표 · 호스트 포트 | 서비스별 127.0.0.1 포트 | §호스트 포트 전수 |
| architecture §3 PlcSim 문단 | 5020~5119는 컨테이너 내부 루프백 · ports에 기재하지 않음 · 기본 브리지 · 서비스명 DNS | §PlcSim 루프백 · §막는 것과 못 막는 것 컨테이너 사이 행 |
| architecture §3 바인드 문단 | 저장소 포트를 여는 판단의 전환 · 127.0.0.1이 안전장치 · 호스트 쪽 포트만 변경 | §저장소 포트를 여는 이유와 안전장치 |
| architecture §3 ClickHouse 포트 용도 문단 | 앱은 8123만 · 9000은 CLI · 9363은 메트릭 | §호스트 포트 전수 · 안전장치 표 |
| tech_stack §10.4 포트 표 | 서비스 6행 · 주소 · 용도 | §호스트 포트 전수 |
| tech_stack §10.4 불릿 3 | 127.0.0.1 접두 · 저장소 포트 이유 · 호스트 쪽 포트만 | §저장소 포트를 여는 이유와 안전장치 |
| tech_stack §10.4 프로토콜 행 | http · ws · TLS 없음 | 도입 단락 · [04_threat_model.md](./04_threat_model.md) §범위와 전제 |
| implementation_plan §2.5 표 4행 | 포워딩 없는 직결 · 바인드 안전성 유지 · CORS 변화 없음 · 측정 낙관 | §WSL2 mirrored의 함의 |

- 검산: 원본 행 = **10** · 누락 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 웹 패키지 개발 스크립트의 인자 모양 | 기동 명령 계약만 반영(W7) — 스크립트 문구는 구현 착수 시 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) |
| Next.js 개발 서버 기본 호스트 이름 | 공식 참조 재확인 대기 | [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) |
| Docker publish와 호스트 방화벽의 관계 | 공식 참조 재확인 대기 | 상동 |
| mirrored 모드의 Windows 방화벽 · 수신 규칙 | 공식 참조 재확인 대기 — 현행 판정은 원본 §2.5의 "LAN 비노출" | 상동 · WSL 네트워킹 행 |
| 노출 검증 결과 기록 자리 | 착수 체크리스트와 함께 — 형식 미설계 | [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) |

## 관련 문서

- [README.md](./README.md) — 폴더 고정 기준(노출 · 오리진)
- [02_secrets_config.md](./02_secrets_config.md) — 저장소 비밀번호 판정
- [03_api_surface_defense.md](./03_api_surface_defense.md) — 경계 안쪽의 표면 방어
- [04_threat_model.md](./04_threat_model.md) — DNS 재바인딩 · 통제 없는 위협
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 바인드 규칙 · 네트워크 정본
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-18
- [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) — mirrored 환경 영향 · 기동 명령
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — REQ-GLB-19 강제 주체 표
