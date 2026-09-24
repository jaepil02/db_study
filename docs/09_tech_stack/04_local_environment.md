# 로컬 실행 환경

> **대상**: 로컬 머신 1대의 요구사항 · 원본 실측 환경(WSL2 · 20스레드 · 가용 RAM) · WSL2 메모리 조정 · **컨테이너 메모리 상한(정본)** · 메모리 프로파일 2 + 조건부 중간 · 대조 실험 메모리 조건 · networkingMode=mirrored · **환경변수 목록(정본)** · 기동 · 정지 · 스냅샷 명령 · 아카이브 위치 · 착수 전 조정
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — Docker VM 메모리 상향 반영 — 약 7.75 → **15.6 GB**(사용자 상향) · 부하 실험 프로파일 사용 가능 · S0 회귀 부하 실험 프로파일 재확인(기록 003)
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 현행 측정 머신(macOS · Docker Desktop VM vCPU 14) 절 신설 · 머신 요구사항 CPU · 플랫폼 행 갱신 · 접속 문자열 로컬 값 판정(PostgreSQL DB plc · 관리자 postgres · ClickHouse 계정 app)
> **개정일**: 2026-09-24 — W7 검수 반영 — 원본 가정 칸 머신 RAM · 디스크 → **원본 요구 사양 32 GB · 200 GB**(금지어 명사형 제거 · 뜻 보존) · 미확인 표 웨이브 표지 (W7) 제거
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 비밀 환경변수 **9** 등재(비밀 하나 = 변수 하나) · 환경변수 25 → **34** · 접속 문자열 비밀번호 자리는 변수 치환 · 웹 개발 서버 호스트 이름 **127.0.0.1** 명시(정본 12_security/02 · 05)
> **원천**: 원본 tech_stack.md §10.1 · §10.2 · §10.3 · §10.5(커밋 ff66a37) · 원본 implementation_plan.md §2 · §2.1~§2.5 · §9(커밋 ff66a37) · 원본 architecture.md §3 · §13(커밋 ff66a37) · D-02 · D-10 · ADR-08 · ADR-18 · ADR-22 · REQ-TEC-01 · 04 · 07 · 08 · 13 · 14 · 웨이브 인계 W6 09_tech_stack 행(DATAGEN_BULK_ENABLED 등재 · health run 환경변수 이름 · 컨테이너 메모리 상한) · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) · [../07_api/10_metrics.md](../07_api/10_metrics.md) run 필드 · [../07_api/09_datagen.md](../07_api/09_datagen.md) 게이트 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)

실행 단위의 모양(컨테이너 4 · 기동 순서 · 볼륨 4 · CPU 가중 · cpuset)은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)가 갖는다. 이 문서는 그 구성이 올라가는 **머신과 그 머신 위의 조정값** — 컨테이너 메모리 상한 · 프로파일 채택 조건 · 환경변수 이름 · 기동 명령 — 을 갖는다. **컨테이너 메모리 상한과 환경변수 목록은 이 문서가 정본이다**(REQ-TEC-07 · 07_api/10 · 07_api/09가 이 문서를 가리킨다).

**원본 설계서와 실측 머신은 병목의 방향이 반대다.** 원본은 CPU 부족(4 vCPU급) · 메모리 여유(32 GB)를 전제로 썼고, 원본이 2026-09-20에 잰 실측 머신은 CPU 과잉(20스레드) · 메모리 부족(가용 15 GB)이다(원본 implementation_plan.md §2.1). 그래서 원본이 걱정한 CPU 경합 상당수가 덜 일어나고 **Redis maxmemory와 ClickHouse 메모리 상한이 먼저 걸린다** — 학습 목표 ②(Redis 중간 계층의 성격별 분기)에는 오히려 유리한 쪽이다.

**실측값은 착수 시점에 다시 잰다.** 아래 머신 값은 원본 실측의 인용이며 설계 수치의 정본이 아니다([../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 착수 체크리스트).

## 머신 요구사항

기준은 **Docker에 할당한 메모리**다. 머신 RAM이 전부 Docker로 가지 않는다 — OS · 브라우저 · IDE · 호스트 웹 개발 서버 · k6가 바깥에서 따로 먹는다(원본 tech_stack.md §10.2).

| 항목 | 부하 실험 프로파일 | 개발 프로파일 | 근거 | 미달이면 |
|------|------|------|------|------|
| Docker 할당 메모리 | 12 GB | 8 GB | 컨테이너 상한 합 + VM 여유 0.5 GB | 상한 합이 VM에 들어가지 않아 VM 안 OOM이 컨테이너를 무작위로 죽인다 |
| 머신 RAM | 32 GB | 16 GB | Docker 할당 + 호스트 몫 | 호스트 브라우저 · IDE가 스왑을 일으켜 측정 머신 전체가 느려진다 |
| 디스크 여유 | 용량 티어별 정상 상태 디스크 이상 | 티어 S | 정본 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) | 파트 머지가 공간 부족으로 멈추고 삽입이 too many parts로 거절된다 |
| CPU | 원본 전제 4 vCPU급 · 원본 실측 20스레드 · **현행 Docker VM vCPU 14** | 상동 | cpuset 배치는 현행 측정 머신 전제(04_architecture/03) | VM vCPU 수가 바뀌면 cpuset 배치를 다시 짜고 기록 조건 칸에 적는다 |
| 실행 플랫폼 | macOS · Linux · Windows WSL2 | 상동 | 원본 전제는 macOS · Linux · 원본 실측은 WSL2 · **현행 측정 머신은 macOS**(§현행 측정 머신) | 해당 없음 — WSL2 차이는 §WSL2 mirrored 네트워킹이 다룬다 |

- 검산: 요구 항목 = **5**
- **개발 프로파일은 성능 측정을 하지 않는다.** 목적은 파이프라인 연결 확인이고 용량 티어 S 전용이다(REQ-TEC-07).

## 현행 측정 머신

2026-09-24에 측정 머신을 이 macOS 머신으로 정했다(사용자 결정 — cpuset 배치 재설계 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §cpuset 배치). 아래 §원본 실측 환경은 원본이 잰 WSL2 머신의 기록으로 남긴다.

| 항목 | 현행 값(2026-09-24 확인) | 설계 요구 | 영향 | 조치 |
|------|------|------|------|------|
| 플랫폼 | macOS · Docker Desktop(엔진 29.5) | 해당 없음 | 컨테이너는 Linux VM 안에서 돈다 · 호스트 프로세스(웹 · 브라우저 · IDE)는 VM 밖 | cpuset은 VM vCPU 번호다 — 호스트 프로세스는 고정할 수 없다 |
| 머신 CPU · RAM | 14코어 · 48 GB | 부하 실험 32 GB 이상 | 충분 | 없음 |
| Docker VM vCPU | 14 | cpuset 배치의 전제 | 배치 합 14 | 없음 |
| **Docker VM 메모리 할당** | 약 7.75 → **15.6 GB**(2026-09-24 사용자 상향) | 부하 실험 12 GB · 개발 8 GB(§머신 요구사항) | 부하 실험 프로파일이 들어간다 — 상한 합 11.5 + 여유 0.5 · 저장소는 부하 실험 프로파일로 둔다(S0 회귀 재확인 · docs/measurements 기록 003) | 없음 — 상향 완료 |
| 부하 도구 CPU 고정 | macOS에 taskset 없음 | k6 · 벤치마크 도구를 측정 대상과 다른 CPU 집합에 | 호스트 프로세스로 띄우면 격리가 사라진다 | **k6 · 네이티브 벤치마크는 컨테이너로 띄워 cpuset 11-12에 고정한다** |
| 레지스트리 자격 증명 | Docker Desktop 자격 증명 도우미가 응답하지 않아 이미지 풀이 멈춘 이력 | 해당 없음 | 공개 이미지 풀 불가 | 공개 이미지는 익명 풀로 받는다 · 도우미 문제는 Docker Desktop 쪽에서 푼다 |

- 검산: 항목 = **6**
- **메모리 할당이 이 머신의 첫 병목이었다 — 상향으로 풀렸다(2026-09-24).** 원본 실측 머신(가용 15 GB)과 방향이 같았다 — 머신 RAM은 충분한데 Docker VM 할당이 설계 요구보다 작았다. 상향 전 기록(002)은 개발 프로파일 수치이며 REQ-NFR과 비교하지 않는다.

## 원본 실측 환경

원본이 2026-09-20에 이 머신에서 잰 값이다(원본 implementation_plan.md §2.1). **착수 시점에 다시 잰다.**

| 항목 | 원본 설계서 가정 | 원본 실측 | 영향 | 착수 전 조치 |
|------|------|------|------|------|
| CPU | 4 vCPU급 | 20스레드(P 6코어 + E 8코어) | CPU는 과잉 · 병목이 CPU가 아니다 | cpuset 배치 계획(04_architecture/03) |
| 머신 RAM | 원본 요구 사양 32 GB | 31 GB(Windows 호스트) | 충분 | 없음 |
| **가용 RAM(WSL2 VM)** | 32 GB 전제 | **15 GB**(WSL2 기본 할당 = 호스트의 50%) | **부하 실험 프로파일(Docker 12 GB)을 쓸 수 없다** | §WSL2 메모리 조정 |
| 디스크 | 원본 요구 사양 200 GB(M 티어) | 936 GB 여유 | M+ 티어까지 가능 | 착수 시 재확인 |
| 실행 플랫폼 | macOS · Linux | WSL2 · networkingMode=mirrored | 루프백 공유 · 포트 포워딩 불요 | §WSL2 mirrored 네트워킹 |
| 호스트 Node | 버전 고정표의 LTS 고정 | 호스트 v24.20.0(고정표와 다른 메이저) | 컨테이너와 런타임 메이저가 다르다 | 호스트를 버전 고정표의 LTS로 고정([03_data_infra.md](./03_data_infra.md) §버전 고정표) |
| pnpm | 필수 | 미설치 | 워크스페이스 구성 불가 | 패키지 관리자 필드로 버전 고정([05_tooling_devops.md](./05_tooling_devops.md)) |
| Docker 데몬 | 기동 | 미기동 | S0 불가 | 데몬 기동 확인 |

- 검산: 항목 = **8**
- **가장 중요한 행은 가용 RAM이다.** 15 GB VM에서 Docker 12 GB + 웹 개발 서버 1.5 GB + k6 0.5 GB + Linux 1 GB = 15 GB로 여유가 0이다 — 부하 실험 프로파일을 올리면 VM 안에서 무엇이든 먼저 죽는다.
- **WSL2는 P코어 · E코어 구분을 노출하지 않는다.** 균일한 10코어 × 2스레드로 보고되어 cpuset 번호가 어느 물리 코어인지 매 실행 달라질 수 있다 — 3회 중앙값이 필수 규칙인 이유다(D-10 · REQ-TEC-11).

## WSL2 메모리 조정

착수 전 1순위다(원본 implementation_plan.md §2.2). 사용자 폴더의 WSL 설정 파일에 메모리 지시자가 없어 기본값(호스트의 50%)이 걸려 있다. 아래로 바꾼 뒤 WSL을 완전히 종료하고 다시 들어간다.

```plain
[wsl2]
networkingMode=mirrored
memory=20GB
processors=20
swap=8GB
```

- **이 조정으로 부하 실험 프로파일을 재산정 없이 쓴다.** 용량 티어 · Redis maxmemory · MAXLEN · 백프레셔 임계가 원본 산정 그대로 유효해진다.
- **swap은 성능 측정의 안전망이지 예산이 아니다.** 부하 실험 중 swap 사용량이 0이 아니면 그 측정은 메모리 상한이 아니라 디스크 페이징을 잰다 — 기록 조건 칸에 swap 사용 여부를 적는다.
- 적용 확인은 VM 안에서 가용 메모리를 보는 것이다. 설정 파일 문법 · 지시자 이름은 공식 참조 — [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)(W7 등재)로 착수 시 재확인한다.

| 대상 | 할당 | 산정 | 넘치면 |
|------|------|------|------|
| Windows 호스트 | 11 GB | OS 4 + 브라우저 3~4 + IDE 1~2 · 브라우저는 Windows에서 띄운다 | 호스트 스왑이 WSL2 VM의 메모리 회수를 부른다 |
| WSL2 VM | 20 GB | Docker 12 + 웹 개발 서버 1.5 + k6 0.5 + Linux 1 = 15 · 여유 5 | VM 안 OOM |

- 검산: 11 + 20 = **31** = 호스트 RAM · VM 내부 12 + 1.5 + 0.5 + 1 = **15** · 20 − 15 = 여유 **5**

## 컨테이너 메모리 상한 (정본)

**이 표가 컨테이너 메모리 상한의 정본이다**(REQ-TEC-07). [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §메모리 프로파일 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)의 상한 값은 이 표의 인용이다. 컨테이너 안의 설정(ClickHouse 메모리 비율 · shared_buffers · maxmemory · V8 힙 상한)은 각 소유처가 이 상한에서 파생한다.

| 컨테이너 | 부하 실험(Docker 12 GB) | 개발(Docker 8 GB) | 중간 — 조건부(Docker 10 GB) | 상한에서 파생되는 설정 · 소유처 |
|------|------|------|------|------|
| clickhouse | 5.0 GB | 3.0 GB | 4.0 GB | 서버 메모리 비율 — [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| postgres | 2.0 GB | 1.5 GB | 1.5 GB | shared_buffers · effective_cache_size — [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| redis | 2.5 GB | 1.5 GB | 2.0 GB | maxmemory · MAXLEN — [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| api | 2.0 GB | 1.5 GB | 2.0 GB | V8 힙 상한 · piscina 워커 수 — [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| 합계 | 11.5 GB | 7.5 GB | 9.5 GB | VM 여유 각 0.5 GB |

- 검산: 부하 실험 5.0 + 2.0 + 2.5 + 2.0 = **11.5** · 개발 3.0 + 1.5 + 1.5 + 1.5 = **7.5** · 중간 4.0 + 1.5 + 2.0 + 2.0 = **9.5** · 각 할당 − 합계 = 12 − 11.5 = 8 − 7.5 = 10 − 9.5 = **0.5**
- **상한은 Compose 리소스 제한으로 고정한다 — 오버커밋 없음.** 상한이 없으면 ClickHouse가 페이지 캐시를 점유하다 PostgreSQL OOM을 유발한다(원본 architecture.md §13).
- **상한은 2계층 조정값이다.** 조회 계약 — ① 합계 + 0.5 GB ≤ Docker 할당 ② 컨테이너 안 설정(비율 · 버퍼 · maxmemory · 힙)이 상한보다 작다 ③ 프로파일 이름과 실제 상한이 health run.memoryLimitMb로 대조된다. 금지된 대체 동작 — 상한 없이 컨테이너 안 설정만으로 메모리를 제한하는 것(ClickHouse 비율은 페이지 캐시를 막지 못한다).
- **B형 — health의 memoryLimitMb가 프로파일 표와 다르면 기록을 인용하지 않는다.** 결론 — 프로파일 이름은 주입값이고 memoryLimitMb는 cgroup에서 읽은 실제 상한이다(07_api/10). 반대 시나리오 — 프로파일 환경변수만 load로 두고 Compose 파일을 개발 프로파일로 띄우면 기록은 "부하 실험"인데 실제는 1.5 GB로 돈다. 파생 지침 — 기록 전에 두 값을 대조하고 다르면 기동을 다시 한다.

### 프로파일 채택 조건

| 프로파일 | 채택 조건 | 성능 수치 비교 | 부수 효과 |
|------|------|------|------|
| 부하 실험 | WSL2 VM에 Docker 12 GB가 들어갈 때 — **기본값** | REQ-NFR과 비교한다 | 해당 없음 |
| 개발 | 항상 가능 | **비교하지 않는다** — 연결 확인 전용 | Stream MAXLEN · 스풀 임계가 작아 백프레셔가 일찍 걸린다(05_data_stores/06) |
| 중간 | WSL2 메모리 조정이 **불가능할 때만** | 원본 목표와 비교하지 않는다 | maxmemory 여유가 작아 **volatile-lru 축출 연쇄가 기본 구성에서 자연 발생한다** |

- 검산: 프로파일 = 2 + 조건부 1 = **3**
- **판정 — 중간 프로파일은 정식 프로파일로 올리지 않는다.** 원본 판단(원본 implementation_plan.md §2.3)을 승계한다 — WSL2 설정을 20 GB로 올려 부하 실험 프로파일을 쓰고, 중간은 조정이 불가능할 때의 조건부 대안으로만 둔다. 채택하는 순간 루트 README 고정 기준(메모리 프로파일 2)과 이 표를 같은 변경 단위에서 고친다.
- **중간 프로파일의 축출 연쇄는 결함이 아니라 관찰 기회다.** 원본이 "maxmemory를 1.6 GB로 낮춰 강제 유발하는 실험"이라 한 현상이 인위 조작 없이 나타난다. 다만 그 수치를 목표와 비교하면 히트율 미달이 결함으로 오독된다.

### 대조 실험 메모리 조건

[../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)가 대조 실험에 **두 컨테이너의 메모리 상한을 같게 둔 조건**을 요구한다. 이 표는 그 조건을 부하 실험 프로파일 위에 덧씌우는 값이다. 프로파일 수에 세지 않는다 — 부하 실험 프로파일의 변형이며 기록 조건 칸에 적는다.

| 컨테이너 | 부하 실험 | 대조 조건 | 파생 설정 |
|------|------|------|------|
| clickhouse | 5.0 GB | **3.5 GB** | 서버 메모리 비율 그대로 — 절대값이 비율만큼 준다 |
| postgres | 2.0 GB | **3.5 GB** | shared_buffers · effective_cache_size를 산정 규칙(05_data_stores/01)으로 다시 산다 |
| redis | 2.5 GB | 2.5 GB | 변경 없음 |
| api | 2.0 GB | 2.0 GB | 변경 없음 |
| 합계 | 11.5 GB | 11.5 GB | Docker 12 GB 안 |

- 검산: 3.5 + 3.5 + 2.5 + 2.0 = **11.5** · 부하 실험의 clickhouse + postgres 5.0 + 2.0 = 7.0을 둘로 나눈 값 3.5
- **값은 W6 초기 판정이다** — 대조 정본(05_data_stores/10)이 동일화 값을 정하면 그 값으로 이 표를 고친다. CPU 집합 동일화는 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §대조 실험 자원 조건이 갖는다.
- **대조 조건으로 잰 수치를 목표 ②의 적재 실험과 섞지 않는다.** ClickHouse 몫이 5.0 → 3.5 GB로 줄어 적재 · 머지 수치가 부하 실험 프로파일과 다른 조건이 된다.

## WSL2 mirrored 네트워킹

원본 implementation_plan.md §2.5의 영향이다. 보안 쪽 함의의 정본은 [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md)다.

| 항목 | 영향 | 규칙 |
|------|------|------|
| Windows 브라우저 → WSL2 서비스 | localhost:3001 · localhost:3000으로 포트 포워딩 없이 직결 | NAT 모드의 포워딩 설정을 두지 않는다 |
| 127.0.0.1 바인드의 안전성 | 유지 — mirrored는 루프백을 호스트와 공유할 뿐 LAN에 노출하지 않는다 | 바인드 주소 규칙 그대로(ADR-18) |
| CORS 오리진 | 변화 없음 — http://localhost:3001 하나 | 해당 없음 |
| 측정 | 루프백 경로가 한 단계 짧아 E2E 지연이 NAT 모드보다 낙관적이다 | 기록 조건 칸에 네트워킹 모드를 적는다 · 측정 한계 정본 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |

- 검산: 항목 = **4**

## 환경변수 (정본)

**이 표가 환경변수 이름의 정본이다.** 07_api/10(run 필드) · 07_api/09(게이트) · 08_screen/07(재기동 명령)이 이 문서를 가리킨다. 스위치 11종의 이름 · 기본값 · 값 형식의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)이고 여기서는 계열로만 센다. 비밀(접속 자격 증명 · 토큰 서명 키)의 취급은 [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)(W7)가 갖는다.

| 계열 | 이름 | 값 | 기본 | 읽는 시점 | 읽는 자리 · 노출 | 잘못 주면 |
|------|------|------|------|------|------|------|
| 기동 역할 | **APP_ROLE** | all · api · worker · collector · datagen | all | 기동 시 1회 | 모듈 초기화 범위(ADR-22) | 허용값 밖이면 기동 거부 — 조용히 all로 돌면 역할 분리 실험이 분리 없이 기록된다 |
| 역할 스위치 | SW-01~SW-11의 11개 | 정본 02_features/13 | 정본 02_features/13 | 기동 시 1회 | DI 포트 구현 선택(ADR-08) · health switches · /metrics 레이블 | 허용값 밖이면 기본 구현이 주입되고 health가 실제 구현을 보여 준다(07_api/10 A형) |
| 부하 주입 게이트 | **DATAGEN_BULK_ENABLED** | true · false | false | 기동 시 1회 | 모드 C 표면 라우트 존재 여부(07_api/09) · 스위치 목록에 넣지 않는다 | true로 둔 채 잊으면 부하 주입 표면이 상시 열린다 — 레이트 리밋 등급의 방어만 남는다 |
| 측정 조건 | **MEMORY_PROFILE** | load · dev · mid | 없음(null) | 기동 시 1회 | health run.memoryProfile | 없으면 null — 그 기록은 4요소가 빠져 인용할 수 없다 |
| 측정 조건 | **CAPACITY_TIER** | S · M · M+ · L | 없음(null) | 기동 시 1회 | health run.capacityTier | 상동 |
| 측정 조건 | **COMMIT_HASH** | 빌드된 커밋 해시 | 없음(null) | 이미지 빌드 인자 → 컨테이너 환경변수 | health run.commitHash | 빌드 인자를 빼면 null — 손으로 적는 순간 커밋과 이미지가 어긋날 수 있다 |
| Node 런타임 | NODE_OPTIONS | V8 힙 상한 인자 | 프로파일 파일이 준다 | 프로세스 시작 | V8 | 컨테이너 상한 이상이면 OOM Killer가 GC 신호보다 먼저 온다(04_architecture/03) |
| Node 런타임 | UV_THREADPOOL_SIZE | 정수 | 프로파일 파일이 준다 | 프로세스 시작 | libuv 스레드 풀 | 해당 없음 — 현행 참고 값의 소유는 04_architecture/03 |
| 워커 풀 | **WORKER_POOL_SIZE** | 정수 1 이상 | 프로파일 파일이 준다 | 기동 시 1회 | piscina 풀 크기(ADR-25) | 워커 수가 기록에 없으면 S1 워커 1 · 2 · 4 비교가 섞인다 |
| SIM 주입 계획 | **SIM_FAULT_PLAN** | 주입 계획 파일 경로 | 없음 — 주입 없음 | 기동 시 1회 | SIM 지연 · 오류 주입(06_pipeline/10) · 형식 [05_tooling_devops.md](./05_tooling_devops.md) | 파일이 형식 검증에 실패하면 기동 거부 — 일부만 적용되면 계획과 실제 주입이 어긋난다 |
| 저장소 접속 | **POSTGRES_URL · CLICKHOUSE_URL · REDIS_URL** | 서비스명 DNS 기반 접속 문자열 — **비밀번호 자리는 아래 비밀 변수를 Compose 변수 치환으로 참조한다** | .env.example의 로컬 값(호스트 · 포트 · DB 이름 · 계정 이름) · 비밀번호 자리는 치환식 | 기동 시 1회 | 각 클라이언트 | 자격 증명이 들어 있어 .env를 커밋하지 않는다(REQ-TEC-14) · 비밀번호를 문자열에 직접 적으면 같은 비밀이 두 변수에 나뉘어 바꿀 때 한쪽이 남는다 |
| 비밀 | **JWT_SIGNING_KEY · POSTGRES_ADMIN_PASSWORD · APP_OWNER_PASSWORD · APP_RW_PASSWORD · CH_READER_PASSWORD · CLICKHOUSE_PASSWORD · REDIS_PASSWORD · SEED_USER_PASSWORD · GRAFANA_ADMIN_PASSWORD** | 비밀 값 — 비밀 목록 정본 [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)의 9종과 1:1 | 없음 — .env.example에는 자리표시만 | 기동 시 1회(migrate · seed는 실행 시 1회) | 서명 키 api · 관리자 비밀번호 postgres 이미지 초기화 · app_owner migrate · app_rw 접속 문자열 치환과 migrate 역할 생성 · ch_reader ClickHouse 설정 파일과 migrate · ClickHouse · Redis 비밀번호 이미지 초기화와 접속 문자열 치환 · 학습자 seed · Grafana 이미지 | 비었거나 자리표시와 같으면 **기동 거부** — 허용하면 모든 환경이 같은 서명 키 · 같은 저장소 비밀번호로 돈다 · 서명 키는 256비트 무작위 미만이면 거부 · 공개 접두(NEXT_PUBLIC_) 이름을 쓰지 않는다 |
| 웹 | **API_BASE_URL · NEXT_PUBLIC_API_BASE_URL** | BFF 서버 측 · 브라우저 직결 api 주소 | http://127.0.0.1:3000 · http://localhost:3000 | 웹 기동 시 | BFF fetch · 브라우저 직결(ADR-02) | 브라우저 쪽을 BFF 주소로 두면 고빈도 요청이 1홉 늘어난다 |

- 검산: 표 행 = **13** · 이름 수 = 1 + 11 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 3 + 9 + 2 = **34** — 스위치 11 + 스위치 밖 23(APP_ROLE · DATAGEN_BULK_ENABLED · MEMORY_PROFILE · CAPACITY_TIER · COMMIT_HASH · NODE_OPTIONS · UV_THREADPOOL_SIZE · WORKER_POOL_SIZE · SIM_FAULT_PLAN · POSTGRES_URL · CLICKHOUSE_URL · REDIS_URL · 비밀 9 · API_BASE_URL · NEXT_PUBLIC_API_BASE_URL) = **34**
- **이 표에서 이름을 새로 정한 것은 이 문서의 판정이다** — MEMORY_PROFILE · CAPACITY_TIER · COMMIT_HASH(health run 주입 · 인계 W5 07_api 행) · WORKER_POOL_SIZE · SIM_FAULT_PLAN · 접속 3 · 웹 2. 원본 이름은 APP_ROLE · NODE_OPTIONS · UV_THREADPOOL_SIZE이고, DATAGEN_BULK_ENABLED는 07_api/09가, 비밀 9는 W7 보안 리뷰([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md))가 판정했다.
- **접속 문자열의 로컬 값(판정 2026-09-24)** — PostgreSQL DB 이름 plc(ClickHouse 데이터베이스 plc와 같은 이름) · PostgreSQL 관리자 계정은 이미지 기본 postgres · ClickHouse 계정 이름 app. 셋 다 비밀이 아닌 설계 값이다([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) §비밀이 아닌 것).
- **비밀 하나 = 변수 하나다.** migrate는 app_owner 비밀번호를 치환한 접속으로 돌고(api는 이 값을 읽지 않는다 — 런타임이 DDL 권한을 갖지 않게), 역할을 만들 때 APP_RW_PASSWORD · CH_READER_PASSWORD를 읽는다. 저장소 이미지의 초기화 변수 이름은 이미지가 정하므로 Compose 파일이 이 이름을 이미지 변수로 옮긴다.
- **환경변수는 전부 기동 시 1회만 읽는다.** 전환은 환경변수 변경과 재기동뿐이다(D-06 · ADR-08). 실행 중에 다시 읽는 변수를 하나라도 두면 "재기동 없이 바뀌는 조건"이 생겨 기록의 조건 칸이 실제 실행과 어긋난다.
- **MEMORY_PROFILE의 값은 프로파일 Compose 파일이 함께 준다.** 사람이 따로 적지 않는다 — 상한과 이름이 한 파일에서 나와야 둘이 어긋나지 않는다(§기동 · 정지 명령).
- **memoryLimitMb는 환경변수가 아니다.** cgroup의 실제 상한을 읽는다(07_api/10) — 환경변수로 받으면 프로파일 이름과 같은 출처가 되어 대조가 무의미하다.
- 대조 실험 · 관측 프로파일 on/off · 생성기 CPU는 환경변수가 아니라 **기록 조건 칸**에 적는다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)).

## 기동 · 정지 명령

작업 정의(Taskfile)의 정본은 [05_tooling_devops.md](./05_tooling_devops.md)이고, 기동 순서의 정본은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)다. 여기는 사람이 치는 명령의 순서다. 셸 명령은 plain으로 적는다.

```plain
① 프로파일 기동     docker compose -f compose.yml -f compose.load.yml up -d      ← 개발은 compose.dev.yml · 중간은 compose.mid.yml
② 상태 확인         docker compose ps                                              ← 4개 모두 healthy
③ 스키마 · 시드     task migrate → task seed                                        ← 빈 볼륨일 때만
④ 웹               pnpm dev(웹 패키지 · 호스트 이름 127.0.0.1 · 3001)                 ← 호스트 이름 인자 필수
⑤ 확인             curl 127.0.0.1:3000/api/v1/health                               ← run 4필드 · switches 11 확인
⑥ 관측(선택)        docker compose --profile observability up -d
⑦ 스위치 전환       .env 수정 → docker compose up -d api                           ← api만 재생성 · 저장소 유지
⑧ 정지             docker compose down                                             ← 볼륨 유지
```

- **프로파일은 Compose 덮어쓰기 파일 하나로 고른다.** 파일 하나가 컨테이너 상한 · 컨테이너 안 설정 포함 파일 · MEMORY_PROFILE · WORKER_POOL_SIZE · NODE_OPTIONS를 함께 준다 — 값이 파일 셋에 흩어지면 프로파일 전환이 한 값을 빠뜨린다.
- **④의 호스트 이름 인자가 웹 3001의 127.0.0.1 바인드를 강제하는 유일한 자리다.** 웹은 Compose 밖의 호스트 프로세스라 ports 규칙이 닿지 않는다 — 인자 없이 띄우면 개발 서버가 모든 인터페이스에 뜰 수 있고, LAN 기기가 BFF를 거쳐 127.0.0.1:3000의 api에 닿는다([../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) §웹 개발 서버의 바인드). 인자는 웹 패키지의 개발 스크립트에 박아 사람이 매번 치지 않게 한다.
- **⑦은 api만 재생성한다.** 저장소까지 재시작하면 Redis AOF 재생 · ClickHouse 파트 적재가 스위치 전환 측정에 섞인다. 전환 절차의 화면 쪽 안내는 [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md)다.
- **볼륨을 지우는 정지 명령(down -v)은 task snapshot 뒤에만 쓴다**(REQ-TEC-08). 데이터를 전부 지우므로 실험 편의로 쓰면 기준 데이터셋이 사라진다.
- 덮어쓰기 파일 이름은 설계 계약이며 파일 이름 형식은 구현이 정한다.

## 스냅샷 · 아카이브 위치

| 대상 | 위치 | 형식 | Git | 소유 · 근거 |
|------|------|------|------|------|
| 볼륨 스냅샷 | snapshots/ 아래 볼륨별 아카이브 | 볼륨 하나당 압축 tar 하나 | 제외 | task snapshot · restore([05_tooling_devops.md](./05_tooling_devops.md)) · REQ-TEC-08 |
| PostgreSQL 덤프 | snapshots/ 아래 | 덤프 도구의 사용자 지정 형식 | 제외 | 스키마 · 시드 보존(원본 tech_stack.md §10.3) |
| **분리된 alarm_event 파티션** | **snapshots/archive/alarm_event/** | **파티션 하나당 덤프 파일 하나 · 파일 이름 = 파티션 이름(월)** | 제외 | 이 문서 판정 · 보존 정본 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |
| 측정 기록 | docs/measurements/ | 기록 템플릿 | **포함** | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |

- 검산: 대상 = **4** · Git 제외 3 · 포함 1
- **인계 "분리된 alarm_event 파티션의 아카이브 위치 · 형식"을 닫는다.** 파티션 단위 파일로 두는 이유 — 달 하나를 되살릴 때 전체 덤프를 풀지 않는다. snapshots/ 아래에 두는 이유 — 스냅샷과 같은 Git 제외 규칙 · 같은 디스크 예산을 쓴다.
- **아카이브는 볼륨 밖이다.** 볼륨 스냅샷을 복원해도 아카이브는 되돌아가지 않는다 — 복원 뒤 분리 이전 상태로 돌아간 DB와 이미 만든 아카이브 파일이 같은 달을 두 번 가질 수 있다. 되살리기 전에 대상 달의 파티션이 DB에 있는지 확인한다.

## 착수 전 조정

[../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 착수 체크리스트 중 환경 항목의 실행 기준이다. 도구 항목(pnpm · 버전 재확인)은 [05_tooling_devops.md](./05_tooling_devops.md) · [03_data_infra.md](./03_data_infra.md)가 갖는다.

| 체크리스트 | 이 문서의 확인 기준 | 불합격이면 |
|------|------|------|
| 1 WSL2 메모리 상향 | VM 가용 메모리 ≥ 20 GB · swap 8 GB | 중간 프로파일로 가고 채택 사실을 기록 조건에 적는다 |
| 2 Docker 데몬 | 데몬 정보 조회 성공 | S0 불가 |
| 4 Node 고정 | 호스트 Node 메이저 = api 기반 이미지 메이저 | 호스트 테스트와 컨테이너 실행의 런타임이 갈린다 |
| 5 디스크 여유 | 목표 용량 티어의 정상 상태 디스크 이상 | 목표 티어를 낮춘다 |
| 6 CPU 토폴로지 | 논리 CPU 20 · cpuset 배치가 20에 맞음 | 배치를 다시 짠다(04_architecture/03) |

- 검산: 환경 항목 = **5**(체크리스트 1 · 2 · 4 · 5 · 6)

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 착수 시점 머신 실측값 | 원본 2026-09-20 실측 인용 — 착수 시 재측정 | 이 문서 · 착수 체크리스트 |
| 대조 조건 메모리 3.5 GB · 3.5 GB | W6 초기 판정 — 대조 정본과 정합 필요 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| 역할 분리 시 컨테이너별 상한 | 미설계 — 원본은 all 기준으로만 산정 | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) 1단계 진입 시 |
| WSL 설정 지시자 · Compose 리소스 제한 문법 | 공식 참조 재확인 대기 | [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) |
| 비밀 환경변수(토큰 서명 키 등)의 이름 | **W7 닫힘** — 비밀 9 등재 · 이 문서 §환경변수 | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) |

## 관련 문서

- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 컨테이너 · 기동 순서 · CPU 가중 · cpuset 정본
- [03_data_infra.md](./03_data_infra.md) — 이미지 · 설정 파일 · 버전 고정표
- [05_tooling_devops.md](./05_tooling_devops.md) — Taskfile 작업 정의 · 주입 계획 형식
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 환경변수 정본
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health run 필드
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — DATAGEN_BULK_ENABLED 게이트
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — maxmemory · MAXLEN
- [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) — 127.0.0.1 바인드 · mirrored
