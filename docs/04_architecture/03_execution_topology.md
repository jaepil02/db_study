# 실행 토폴로지

> **대상**: 로컬 실행 구성 — Compose 서비스 4 · healthcheck · 기동 순서 · 네트워크 · 호스트 포트 · named volume 4 · 메모리 프로파일 2 + 조건부 중간 · CPU 가중 · **cpuset 배치(정본)** · 스냅샷과 복원 · 재빌드 · 재시작 영향 · 조정값 소유처
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S2 구현 반영 — 기동 순서 교정 — 스키마 · 시드 ⑥ → **③(api 기동 앞 · api 이미지 일회성 컨테이너)** · api 기동 ③ → ④ · 기동 복원 ④ → ⑤ · api healthy ⑤ → ⑥
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146) — piscina 워커 수 규칙 신설: 워커 수는 그 프로세스의 CPU 집합 크기를 넘기지 않는다(datagen 11-12 워커 4는 워커 2와 같은 처리량 · 사용률 0.72)
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — Compose 서비스 표 clickhouse 이미지 ClickHouse 25.8 → **26.8**
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — cpuset 배치를 현행 측정 머신(macOS Docker Desktop VM · vCPU 14)으로 재설계(사용자 결정) — api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · 부하 도구 11-12(컨테이너 · cpuset) · 관측 13 · 대조 실험 배치 5-7 · 8-10 신설 · WSL2 20스레드 배치는 이전 배치로 보존 · 미확인 등재에 S0 postgres healthcheck 계정(migrate 전 관리자) 추가
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — cpuset 표에 APP_ROLE=datagen 행(잠정 16-17 공유) · EXP 번호(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — api 정확 버전 링크 02_backend → **03_data_infra 버전 고정표** · 미확인 2행(관측 구성원 · 중간 프로파일)을 닫는다
> **원천**: 원본 architecture.md §3 · §13 · §17 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.1~§10.5 · §12(커밋 ff66a37) · 원본 implementation_plan.md §2 · §2.2~§2.5 · §8 · §9(커밋 ff66a37) · 원본 data_flow.md §11.3 · §12.4(커밋 ff66a37) · D-02 · D-10 · ADR-05 · ADR-18 · ADR-20 · ADR-22 · [../README.md](../README.md) 고정 기준(실행 구성 · 호스트 포트 · 실험 축) · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-TEC-01~15

실행 단위는 **Docker Compose 컨테이너 4개(api 1 + postgres · clickhouse · redis) + 호스트 프로세스 웹**이다(루트 README 고정 기준). 관측 스택은 observability 프로파일로만 뜬다. 이 문서는 그 구성이 **같은 초기 상태에서 반복 측정 가능하도록** 묶이는 방식을 고정한다 — 기동 순서 · 자원 상한 · CPU 배치 · 스냅샷이 전부 "두 측정이 같은 조건이었다"를 보장하는 장치다(D-10).

**조정값의 소유처가 셋으로 갈린다.** 메모리 상한은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)(REQ-TEC-07), Redis maxmemory · MAXLEN은 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md), 백프레셔 임계는 [06_backpressure_failure.md](./06_backpressure_failure.md)가 갖는다. **CPU 가중과 cpuset 배치는 이 문서가 정본이다**(REQ-TEC-13). 아래 표의 값은 소유처를 밝힌 현행 참고이며 여기서 바꾸지 않는다.

## Compose 서비스

| 서비스 | 이미지 | 재시작 정책 | healthcheck | depends_on | 역할 |
|------|------|------|------|------|------|
| api | 로컬 빌드(Node LTS 멀티스테이지 · 정확 버전 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §버전 고정표) | unless-stopped | /api/v1/health 왕복(무인증) | postgres · clickhouse · redis 전부 service_healthy | NestJS 단일 프로세스 — 모듈 11 · APP_ROLE 기본 all |
| postgres | PostgreSQL 18 공식 alpine 이미지 | unless-stopped | pg_isready(애플리케이션 계정 · DB) | 없음 | OLTP — 업무 14 · 대조군 1 |
| clickhouse | ClickHouse 26.8 공식 서버 이미지 | unless-stopped | HTTP ping(8123) | 없음 | OLAP — 원시 · 롤업 · 판정 전수 |
| redis | Redis 8 공식 alpine 이미지 | unless-stopped | redis-cli ping | 없음 | Stream · 최신값 · 알람 상태 · 캐시 · 세션 · Pub/Sub |

- 검산: 서비스 = **4** — healthcheck 4 · depends_on을 갖는 서비스 1(api)
- **모든 이미지는 태그를 명시하고 latest를 쓰지 않는다**(REQ-TEC-04). 버전이 흔들리면 같은 커밋 해시의 두 측정이 다른 엔진 버전에서 돈다.
- **api의 healthcheck가 무인증인 이유 — 인증을 걸면 기동이 순환한다.** health는 토큰 발급 경로가 뜨기 전에 불린다. 공개 표면 판정의 정본은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)다.

## 기동 순서

컨테이너가 떴다는 사실과 접속을 받을 준비가 됐다는 사실은 다르다. 기동은 아래 순서로만 진행된다.

```plain
① 저장소 3 기동          postgres · clickhouse · redis — 각자 healthcheck 반복
② 저장소 healthy 대기    Compose가 depends_on service_healthy 조건을 확인한다
③ 스키마 · 시드          api 이미지 일회성 컨테이너 — migrate(순번 마이그레이션 + DDL 순번) → seed(빈 볼륨일 때만)
④ api 기동              APP_ROLE에 따라 모듈 초기화 · 스위치 포트 주입 · 부팅 경고(SW-01 off) · Collector 기동 로드
⑤ Ingest 기동 복원       컨슈머 그룹 보장 · rt:latest를 ClickHouse argMax 1회로 재구성
⑥ api healthy           /api/v1/health가 세 저장소 왕복을 통과
⑦ 웹 기동               호스트에서 Next.js 개발 서버(3001)
⑧ 관측(선택)             observability 프로파일 기동
```

- **①② 없이 api가 먼저 뜨면 불필요한 스풀 파일이 생긴다.** 커넥션 오류로 재시작 루프를 도는 사이 Collector가 XADD 실패를 백프레셔로 읽고 스풀로 전환한다 — 기동 직후 spool_bytes 0이 이 순서의 검증 지표다(REQ-TEC-03).
- **④의 복원은 키가 없을 때만 의미가 있다.** rt:latest는 TTL이 없어 Redis 재시작 뒤에도 AOF로 남는다. Redis까지 초기화된 경우에만 ClickHouse argMax가 재구성한다(원본 data_flow.md §12.4). 복원 주체는 보정 7.2 결정에 묶인다 — [06_backpressure_failure.md](./06_backpressure_failure.md) · ADR-10.
- **스키마 · 시드는 api 기동 앞이다(S2 as-built · 순서 교정).** api 기동 로드(COL-01)와 기동 복원(⑤)이 tag_master · tag_raw를 읽는다 — 스키마보다 api가 먼저 뜨면 로드 재시도와 복원 실패로 기동해 첫 창의 결측이 기동 순서에서 생긴다. migrate · seed는 같은 api 이미지의 일회성 컨테이너가 돌아 스키마 소유권은 그대로 api다(task up — [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) §Taskfile 작업).
- **S0 합격 판정이 ①②다.** 저장소 3개 healthy와 메모리 상한 적용 확인이 코드 없는 첫 단계의 판정이다([../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)).

## 네트워크와 호스트 포트

| 항목 | 규칙 | 이유 | 어기면 |
|------|------|------|------|
| 네트워크 | Docker 기본 브리지 1개 · 서비스명 DNS(postgres · clickhouse · redis) | 이중 네트워크 분리는 공인 IP 호스트를 전제한 구성이다 | 해당 없음 — 로컬에서 분리할 대상이 없다 |
| 호스트 publish | 전부 **127.0.0.1 바인드**(값은 루트 README 고정 기준 호스트 포트) | psql · clickhouse-client · redis-cli · DBeaver 직접 접속이 학습에 필요하다 — 바인드 주소가 그 안전장치다(ADR-18) | 0.0.0.0 바인드는 같은 네트워크의 기기에 DB를 그대로 연다 |
| PlcSim 5020~5119 | **publish하지 않는다** — 컨테이너 루프백 전용 | Collector가 같은 컨테이너에서 localhost로 접속한다 | 포트를 열면 시뮬레이터가 호스트 · LAN의 Modbus 클라이언트에 노출된다 |
| 포트 충돌 | **호스트 쪽 포트만** 바꾼다 · 컨테이너 내부 포트와 서비스명 유지 | 컨테이너 간 접속 설정은 내부 포트와 서비스명에 묶여 있다 | 내부 포트를 바꾸면 Dictionary 소스 · api 접속 설정이 전부 어긋난다 |
| ClickHouse 포트 용도 | 앱은 8123만 · 9000은 CLI · 벤치마크 · 9363은 내장 메트릭 | 앱 포트와 사람 포트를 가른다 | 커넥션 수를 해석할 때 사람과 앱을 가를 수 없다 |

- 검산: 규칙 = **5**
- WSL2 mirrored 네트워킹에서도 127.0.0.1 바인드는 LAN에 노출되지 않는다 — mirrored는 루프백을 호스트와 공유할 뿐이다. 함의의 정본은 [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md)다.

## named volume

| 볼륨 | 마운트 | 담는 것 | 백업 방식 | 잃으면 |
|------|------|------|------|------|
| pgdata | postgres 데이터 디렉터리 | 업무 테이블 · 대조군 · WAL | 스냅샷 + 덤프(스키마 · 시드 보존) | 마스터 · 계정 · 작업지시 · 알람 이벤트 전부 |
| chdata | clickhouse 데이터 디렉터리 | 파트 · 머지 · 롤업 | 스냅샷만 — 원시는 생성기로 재생성 | 실험 데이터셋 — 시드 고정 생성기로 다시 만든다 |
| redisdata | redis 데이터 디렉터리 | AOF(fsync everysec) | 백업하지 않는다 — 스냅샷에는 포함 | 미소비 Stream 엔트리 · PEL · 알람 상태. 최신값은 ClickHouse에서 재구성 |
| spooldata | api의 /app/spool | 백프레셔 스풀 프레임(.msgpack.spool · 길이 접두) | 스냅샷에 포함 | 위험 단계 동안 쌓인 미발행 포인트 — **복구 불가 유실** |

- 검산: named volume = **4**
- **호스트 디렉터리를 마운트하지 않는다.** macOS · Windows Docker Desktop의 bind mount는 파일 공유 계층을 거쳐 DB 랜덤 I/O가 느려진다 — 디스크 계층 수치가 측정 대상이 아닌 계층을 재게 된다(REQ-TEC-06 · ADR-18). 부작용으로 호스트에서 스풀을 직접 볼 수 없어 컨테이너 안에서 확인한다.
- **AOF의 목적은 백업이 아니라 재기동 시 미소비 Stream 엔트리 보존이다.** 전체 롤백은 스냅샷이 대신한다.

## 메모리 프로파일

기준은 **Docker에 할당한 메모리**다 — 머신 RAM이 전부 Docker로 가지 않는다. OS · 브라우저 · IDE · 호스트 웹 · k6가 바깥에서 따로 먹는다. 프로파일은 부하 실험 · 개발 2개이고 중간 프로파일은 조건부 대안이다(루트 README 고정 기준 실험 축).

| 컨테이너 | 부하 실험(Docker 12 GB) | 개발(Docker 8 GB) | 중간 — 조건부(Docker 10 GB) | 내부 설정의 소유처 |
|------|------|------|------|------|
| clickhouse | 5.0 GB | 3.0 GB | 4.0 GB | 서버 메모리 비율 — [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| postgres | 2.0 GB | 1.5 GB | 1.5 GB | 공유 버퍼 등 — [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| redis | 2.5 GB | 1.5 GB | 2.0 GB | maxmemory · MAXLEN — [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| api | 2.0 GB | 1.5 GB | 2.0 GB | V8 힙 상한 · 스레드 풀 · piscina 워커 수 — 이 문서 §CPU 가중과 워커 |
| 합계 | 11.5 GB | 7.5 GB | 9.5 GB | 상한 값의 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |

- 검산: 부하 실험 5.0 + 2.0 + 2.5 + 2.0 = **11.5** · 개발 3.0 + 1.5 + 1.5 + 1.5 = **7.5** · 중간 4.0 + 1.5 + 2.0 + 2.0 = **9.5**(원본 산정 · 현행 참고)
- **메모리 상한은 Compose 리소스 제한으로 반드시 고정한다.** 상한이 없으면 ClickHouse가 페이지 캐시를 점유하다 PostgreSQL OOM을 유발한다(REQ-TEC-07).
- **api의 V8 힙 상한을 컨테이너 상한보다 낮게 둔다**(현행 참고 1536 MB) — OOM Killer가 프로세스를 죽이기 전에 Node가 GC 압박과 이벤트 루프 지연으로 먼저 신호를 낸다.

### 프로파일별 쓰임

| 프로파일 | 채택 조건 | 쓰임 | 금지 |
|------|------|------|------|
| 부하 실험 | WSL2 VM 메모리를 Docker 12 GB가 들어가게 조정했을 때 — 기본값 | 성능 측정 전용 · 용량 티어 M 이상 | 해당 없음 |
| 개발 | 항상 가능 | 파이프라인 연결 확인 · 용량 티어 S 전용 | **성능 수치를 REQ-NFR과 비교하지 않는다** |
| 중간 | WSL2 메모리 조정이 불가능할 때만 | 부하 실험 대체 | 성능 수치를 원본 목표와 비교하지 않는다 — maxmemory 여유가 작아 **축출 연쇄가 기본 구성에서 자연 발생한다** |

- 검산: 프로파일 = 2 + 조건부 1 = **3**
- **B형 — 중간 프로파일에서 캐시 히트율이 낮게 나오는 것은 설계 결함이 아니다.** 그 프로파일은 Stream 예산과 캐시 예산의 합이 maxmemory에 거의 닿아 volatile-lru가 캐시 계열부터 밀어낸다. 이 수치를 목표와 비교하면 히트율 미달이 결함으로 오독된다 — 대신 축출 연쇄를 인위 조작 없이 관찰하는 자리로 쓴다(원본 implementation_plan.md §2.3).
- 백프레셔 임계는 프로파일마다 MAXLEN에 비례해 다르다 — 정본 [06_backpressure_failure.md](./06_backpressure_failure.md) §프로파일별 임계.

### 대조 실험 자원 조건

대조 실험(SW-09 on · EXP-01~05 대조군 예약 대역)은 프로파일 위에 **자원 조건을 덧씌운다.** 조건의 정본은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)이며 이 표는 실행 구성 쪽에서 지킬 규칙만 적는다.

| 조건 | 규칙 | 이 조건 없이 재면 |
|------|------|------|
| CPU 동일화 | clickhouse와 postgres의 CPU 집합 크기를 같게 둔다 — §cpuset 배치의 비대칭(clickhouse 4 · postgres 2)을 대조 실험에 쓰지 않는다 · 값은 §대조 실험 배치 | 역전 지점이 저장 방식이 아니라 CPU 3배 차이를 잰다 |
| 메모리 동일화 | 두 컨테이너의 메모리 상한을 같게 둔다 — 부하 실험 프로파일의 비대칭(5.0 GB · 2.0 GB)을 쓰지 않는다 | 캐시 적중 차이가 쿼리 시간 차이로 둔갑한다 |
| PostgreSQL 커밋 동기화 끔 | synchronous_commit off를 표준 조건으로 한다 | 삽입 처리량 비교가 WAL fsync 대기를 재어 ClickHouse의 비동기 파트 기록과 조건이 달라진다 |
| 기록 | 동일화한 값과 조건을 측정 기록 조건 칸에 적는다 | 대조 수치와 일반 부하 수치가 같은 프로파일 이름 아래 섞인다 |

- 검산: 조건 = **4**
- **B형 — 대조 실험이 부하 실험 프로파일을 그대로 쓰지 않는 것은 조건 위반이 아니다.** 부하 실험 프로파일은 목표 ②(ClickHouse에 최대 몫)를 위해 비대칭으로 짰다. 그 비대칭으로 목표 ①을 재면 **자원 차이를 저장 방식의 차이로 기록한다.** 동일화 값 자체는 대조 정본이 정한다.

## CPU 가중과 워커

CPU 가중은 절대량이 아니라 **상대 배분**이라 두 프로파일이 같다. 이 문서가 정본이다.

| 컨테이너 | CPU 가중 | 이유 | 이 값이 부족해지는 신호 |
|------|------|------|------|
| clickhouse | 2.0 | 병렬 스캔 · 머지 | 머지 큐 적체 · 활성 파트 증가 |
| postgres | 1.0 | 업무 부하가 낮다 · 대조군 적재는 SW-09 on에서만 | 대조군 실험 중 삽입 지연 |
| redis | 0.5 | 단일 스레드 명령 처리 | ops/s 포화 |
| api | 1.5 | 수집 · 적재 · 조회 · 워커 풀을 한 프로세스가 떠안는다 — CPU 경합이 곧 조회 p95다 | 수집 pps에 비례한 조회 p95 악화 — **역할 분리 진입 근거** |

- 검산: 가중 합 2.0 + 1.0 + 0.5 + 1.5 = **5.0**
- **piscina 워커 수는 그 프로세스의 CPU 집합 크기를 넘기지 않는다(S1 실측).** datagen 위치(11-12 · vCPU 2)의 워커 4는 워커 2와 같은 처리량에 사용률만 0.72로 떨어졌다(기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값) — 넘친 워커는 처리량 없이 문맥 교환만 더한다.
- api 내부 조정값(현행 참고): 스레드 풀 8 · piscina 워커 부하 실험 2 · 개발 1. 워커 수는 격리 대상([02_module_boundaries.md](./02_module_boundaries.md) §worker_threads 격리 대상)의 처리량으로 정하며 생성기 단독 처리량 실측(S1)에서 워커 1 · 2 · 4를 비교한다.

## cpuset 배치

**현행 측정 머신은 macOS의 Docker Desktop VM(vCPU 14)이다**(2026-09-24 사용자 결정 — 머신 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §현행 측정 머신). 원본이 "로컬에서 지킬 수 없다"고 한 부하 생성기 격리를 **CPU 집합 분리로 부분 복원**한다. 이 표가 배치의 정본이다(REQ-TEC-13). 원본 실측 머신(WSL2 20스레드)의 배치는 아래 §이전 배치에 이력으로 남긴다.

| 대상 | CPU 집합(vCPU) | 근거 |
|------|------|------|
| api · redis | 0-4 | 지연 민감 · 단일 스레드 성능이 중요하다 · api가 수집 · 적재 · 조회 · 워커 풀을 한 프로세스로 떠안는다 |
| clickhouse | 5-8 | 병렬 스캔 · 머지 |
| postgres | 9-10 | 부하가 낮다 |
| k6 · 저장소 네이티브 벤치마크 도구(컨테이너) | 11-12 | **측정 대상과 CPU 집합이 겹치지 않는다** · macOS에는 taskset이 없고 호스트 프로세스는 VM 밖이라 cpuset이 닿지 않는다 — **부하 도구는 컨테이너로 띄워 cpuset으로 고정한다** |
| APP_ROLE=datagen 프로세스(생성기 모드 B · D) | 11-12(k6와 공유 · **잠정**) | 측정 대상 집합(0-10)과 겹치지 않게 부하 생성기 집합을 나눠 쓴다 — 두 생성기의 CPU 합으로 포화를 판정한다([../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) §생성기 위치) |
| 관측 스택(observability 프로파일) | 13 | 측정 대상 밖 |

- 검산: 5 + 4 + 2 + 2 + 1 = **14** = VM vCPU 수 · 겹치는 집합 0 — datagen 행은 k6 집합을 공유하므로 새 집합을 더하지 않는다(부하 생성기끼리의 공유 · 측정 대상과는 겹치지 않는다)
- **Next.js 개발 서버 · 브라우저 · IDE는 이 표 밖이다.** 호스트 macOS 프로세스라 VM의 vCPU 번호로 고정할 수 없다 — VM이 호스트 코어 14개를 전부 받으므로 호스트 프로세스는 하이퍼바이저 수준에서 VM과 경합한다. 부하 실험 중에는 호스트에서 무거운 작업을 띄우지 않고, 그 사실을 기록 조건 칸에 적는다.
- **완전한 격리가 아니다 — 잔여 둘.** ① Docker Desktop VM은 성능 코어 · 효율 코어 구분을 노출하지 않아 vCPU 번호가 어느 물리 코어인지 매 실행 달라질 수 있다(macOS 스케줄러가 VM 스레드를 배치한다). ② 메모리 대역폭과 캐시는 공유된다. 그래서 **같은 실험 3회 중앙값이 선택이 아니라 필수 규칙이다**(D-10 · REQ-TEC-11).
- 이 배치는 vCPU 14 VM에 종속된다. 머신 · VM CPU 수가 바뀌면 이 표를 다시 짜고 측정 기록의 조건 칸에 배치를 적는다 — 다른 배치의 기록끼리 비교하지 않는다.

### 대조 실험 배치

§대조 실험 자원 조건의 CPU 동일화를 이 배치에서 푸는 값이다. clickhouse · postgres 두 집합(5-10, 6개)을 반씩 나눈다.

| 대상 | CPU 집합 | 일반 배치와의 차이 |
|------|------|------|
| clickhouse | 5-7 | 4 → 3 |
| postgres | 8-10 | 2 → 3 |

- 검산: 3 + 3 = **6** = 일반 배치 4 + 2 · 나머지 집합(api · redis · 부하 도구 · 관측)은 그대로

### 이전 배치 — 원본 실측 머신(WSL2 20스레드)

원본 실측 머신 기준의 W3 배치다. 그 머신으로 돌아가면 이 표를 다시 쓴다.

| 대상 | CPU 집합 |
|------|------|
| api · redis | 0-7 |
| clickhouse | 8-13 |
| postgres | 14-15 |
| k6(호스트 프로세스 · taskset) · datagen 프로세스 | 16-17 |
| Next.js 개발 서버 · 관측 스택 | 18-19 |

- 검산: 8 + 6 + 2 + 2 + 2 = **20**

## 스냅샷과 복원

부하 실험은 같은 초기 상태에서 반복해야 비교가 성립한다. TTL과 머지가 진행된 데이터 위에 다시 부하를 걸면 직전 실험의 파트 · 캐시 상태가 결과에 섞인다(REQ-GLB-23 · REQ-TEC-08).

```plain
① task snapshot     컨테이너 정지 → 볼륨 4개를 볼륨별 아카이브로 snapshots/에 묶는다
② 실험 준비          컨테이너 기동 → 캐시 계열 키(cache · lock) 삭제 · 봉인 계열 유지 → 유휴 기준선 관측
③ 부하 주입          주입 모드 하나 · k6 컨테이너 cpuset · 관측 스택 on/off 기록
④ 회복 관측          랙 소진 · 파트 병합 완료까지
⑤ 정합성 검증        생성 수 대 행 수 · 중복 0
⑥ 기록              4요소(커밋 · 프로파일 · 티어 · 스위치) + 조건 칸
⑦ task restore      컨테이너 정지 → 볼륨 비우기 → 아카이브 역전개 → 재기동
```

- **볼륨을 지우는 정지 명령은 스냅샷 뒤에만 쓴다.** 데이터를 전부 지우는 명령이 실험 편의로 쓰이면 기준 데이터셋이 사라진다.
- **②에서 봉인 계열을 지우지 않는다.** Stream 엔트리와 최신값을 지우면 미소비 엔트리가 유실되고 최신값 복원 경로가 실험 조건에 섞인다. 절차 세부의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)다.
- 백업 정책 — PostgreSQL은 덤프로 스키마 · 시드를 보존하고, ClickHouse 원시 데이터와 Redis는 백업하지 않는다(생성기 재생성 · 버퍼 재생 · 최신값 재구성).

## 재빌드 · 재시작 영향

| 사건 | 멈추는 것 | 남는 것 | 결측 구간 | 규칙 |
|------|------|------|------|------|
| api 재빌드(compose up --build) | 수집 · 적재 · 알람 판정 · 조회 API · PlcSim 동시 | Stream 미소비 엔트리 · PEL(AOF) · rt:latest | 수십 초 — 시뮬레이션에서는 정상 동작 | **부하 실험 중 재빌드하지 않는다** · 실험 밖 결측은 재빌드 흔적으로 기록(REQ-TEC-15) |
| api 크래시 | 상동 | 상동 | 재기동 시간만큼 | 재시작 정책이 자동 재기동 · XAUTOCLAIM이 이전 컨슈머 PEL 회수 |
| redis 재시작 | Stream · 캐시 · 최신값 · Pub/Sub | AOF의 Stream · 봉인 키 | Collector 스풀 전환 동안 없음(스풀이 받는다) | 조회는 degrade · 최신값 503 — [06_backpressure_failure.md](./06_backpressure_failure.md) |
| clickhouse 재시작 | 삽입 · 시계열 조회 | Stream 적체 · PEL | 없음 — XACK 보류로 보존 | **최신값이 함께 정지한다**(ADR-10) |
| postgres 재시작 | 업무 CRUD · 알람 확정 | Dictionary의 마지막 값 | 없음 | 시계열 조회는 계속된다 |
| 역할 분리 뒤 collector 재시작 | 수집 · PlcSim | 나머지 역할 전부 | 재시작 시간만큼 | 조회 · 적재는 계속된다 — 분리의 효과를 재는 자리 |

- 검산: 사건 = **6**
- **실장비라면 재빌드 결측이 진짜 유실이다.** 시뮬레이션에서는 PlcSim도 함께 멈춰 생성 자체가 없지만, 실장비는 PLC가 계속 돌고 Collector만 멈춘다(원본 data_flow.md §12.4). 재빌드 흔적을 결함과 가르는 기록 칸이 이 차이를 보존한다.

## 조정값 소유처

| 조정값 | 이 문서의 서술 | 정본 |
|------|------|------|
| 컨테이너 메모리 상한 · 프로파일 채택 조건 | 현행 참고 · 프로파일 쓰임 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| Redis maxmemory · MAXLEN · 축출 정책 | 인용 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| 백프레셔 임계 | 인용 | [06_backpressure_failure.md](./06_backpressure_failure.md) |
| CPU 가중 · cpuset 배치 · piscina 워커 수 | **정본** | 이 문서 |
| 편차 폐기 기준 · 실험 절차 | 인용 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 이미지 · 런타임 정확 버전 | 인용 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |

- 검산: 조정값 행 = **6** — 이 문서 정본 1행 · 인용 5행

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| observability 프로파일 구성원(prometheus · grafana · alertmanager · tempo) | **W6 판정** — 구성원 prometheus · grafana 2 · alertmanager 채택하지 않음(수신처 없음 · D-02) · tempo 현 범위 밖 · 조건부 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| 재기동 시간 · 결측 구간 길이 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지 | EXP-28 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 역할 분리 시 컨테이너별 메모리 · CPU 배분 | 미설계 — 원본은 all 기준으로만 산정했다 | [08_scaling_roadmap.md](./08_scaling_roadmap.md) 1단계 진입 시 |
| postgres healthcheck의 계정 | S0 구현(2026-09-24) — 애플리케이션 계정 app_rw는 migrate가 만들므로 그 전에는 관리자 계정으로 확인한다 · migrate 도입 때 애플리케이션 계정으로 바꾼다 | [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) |
| 중간 프로파일의 정식 채택 | **W6 판정** — 정식 프로파일로 올리지 않는다 · 조건부 대안 유지 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |

## 관련 문서

- [01_system_architecture.md](./01_system_architecture.md) — 컨테이너 4 · 경계별 프로토콜
- [02_module_boundaries.md](./02_module_boundaries.md) — APP_ROLE 배정 · worker_threads 격리 대상
- [06_backpressure_failure.md](./06_backpressure_failure.md) — 프로파일별 백프레셔 임계 · 장애 시나리오
- [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) — WSL2 · 메모리 상한 정본
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — maxmemory · MAXLEN 정본
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 스냅샷 · 3회 중앙값 · 기록 형식
- [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) — 127.0.0.1 바인드 · mirrored 네트워킹
