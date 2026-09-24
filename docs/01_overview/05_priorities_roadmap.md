# 우선순위와 로드맵

> **대상**: 학습자 · 실험 수행자 · 구현 착수자 — 무엇을 어떤 순서로 만들고, 각 단계에 무엇을 조건으로 들어가 무엇을 보면 끝났다고 판정하는가
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — 체크리스트 7 · S0 합격 불릿에 전환 반영(기록 004 · 005) · 체크리스트 항목의 스택 표기 26.8
> **개정일**: 2026-09-24 — 착수 체크리스트 1 · 7 이행 — Docker VM 7.75 → **15.6 GB**(부하 실험 프로파일 S0 회귀 · 기록 003) · 릴리스 노트 대조 완료(ClickHouse 25.x 보안 지원 종료 등재 · 전환은 사용자 결정 대기)
> **개정일**: 2026-09-24 — S0 완료 반영 — S0 합격(AC-14 · AC-15 3회 성립 · 기록 002 · EXP-32 기록 001) 불릿 신설 · 체크리스트 4 Node 22.23.3 설치 · .nvmrc 22 · 코드 착수 항목 상태(Taskfile S0분 · docs:lint 편입 · 저장소 설정 · 측정 기록 자리)
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 착수 체크리스트 현재 상태를 현행 측정 머신(macOS · Apple M4 Pro)으로 갱신 — Docker 메모리 7.75 GB · 데몬 기동 · pnpm 12.5.1 · 호스트 Node 24.19 · 디스크 236 GB · VM vCPU 14(성능 10 + 효율 4) · 이미지 태그 3종 레지스트리 확인
> **개정일**: 2026-09-24 — W7 검수 반영 — S2 범위에 출처 방어 3종(CORS · WebSocket Origin · Host) — S2부터(W7 보안 판정 · 정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — S3 합격 판정의 랙 문구를 AC-19 보정에 맞춤(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — SW-11 LATEST_VALUE_WRITER 신설 반영(D-13 · 사용자 확정) — 스위치 10 → **11**
> **원천**: 원본 tech_stack.md §3.4 · §14(커밋 ff66a37) · 원본 implementation_plan.md §2 · §3 · §4 · §5 · §7 · §8 · §9(커밋 ff66a37) · 원본 architecture.md §16 · §17(커밋 ff66a37) · 저장소 루트 docs_plan.md(보정 #4 · #9) · [06_design_decisions.md](./06_design_decisions.md) D-06 · D-07 · D-10 · D-11 · D-12

이 문서는 **학습 순서 S0~S7의 정본**이다. 원본 로드맵 Phase 0~5는 시스템을 완성하는 순서이고, S0~S7은 **같은 시스템을 만들면서 두 학습 목표의 비교 수치가 가장 일찍, 가장 깨끗하게 나오는 순서**다(D-07). 두 순서는 같은 산출물을 다른 순서로 만든다.

**합격 판정은 수치를 박지 않고 조건으로 쓴다.** 성능 수치는 실측 전이라 3계층 미확인이고, 원본의 목표치는 4 vCPU급 가정이다. 그래서 판정은 "무엇과 무엇이 같아야 하는가 · 무엇을 on/off로 재어 기록했는가"로 쓰고, 원본 수치는 "원본 목표" 또는 "원본 예상치"로만 곁에 둔다. 목표치의 정본은 [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md), 단계별 인수 기준의 정본은 [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md)다.

## 완성 순서와 학습 순서가 다른 이유

원본 Phase 순서(골격 → 수집 → API와 프론트 → Redis 최적화 → 부하 측정 → 장애와 확장)에서는 **Redis의 흥미로운 성질 대부분이 Phase 3 이후에야 등장한다**(원본 implementation_plan.md §3.1).

| 문제 | 구체적으로 | 해법 |
|------|------|------|
| 비교 기준선이 사라진다 | Phase 3에서 캐시를 나중에 끼우면 그것은 리팩터링이다. 전후 비교에 "코드가 달라져서"가 붙어 Redis 기여분을 분리할 수 없다 | 같은 코드에서 역할을 켜고 끄는 스위치(D-06) |
| 고통을 겪지 못한다 | 처음부터 캐시를 켜면 캐시가 없을 때의 문제를 영영 보지 못한다 | 스위치 off 측정을 합격 판정에 넣는다 |
| 측정이 늦다 | 계층별로 쌓으면 Phase 2 끝까지 아무것도 잴 수 없다 | 태그 1개가 끝까지 흐르는 수직 슬라이스를 S2에 둔다 |
| 경계가 늦게 생긴다 | 스위치를 달 자리(Redis 역할의 경계)가 코드에 없으면 스위치를 달 수 없다 | 경계 → 같은 커밋의 계측 → 기능 두껍게의 순서(원본 implementation_plan.md §3.2) |
| 학습 목표의 실행 자리가 없다 | 원본 로드맵은 학습 목표 2축보다 먼저 쓰여 대조군과 ②계층 분기의 자리가 없었다 | 대조군을 S3 · S5에 편입(D-12) · 업무 축 생략 금지(D-11) |

## 재배열 대응표

| 원본 Phase | 학습 단계 | 이동 | 이유 |
|------|------|------|------|
| 0 로컬 골격 | S0 저장소 수동 실습 + S1 생성기 실측 | **쪼갬** | 코드 전에 redis-cli로 Stream을 손으로 돌리는 단계를 신설한다 — PEL을 눈으로 본 사람과 안 본 사람은 Ingest 디버깅 속도가 다르다 |
| 1 수집 파이프라인 | S2 수직 슬라이스 + S3 파이프라인 심화 | **쪼갬** | 얇게 끝까지 먼저 · 그 다음 두껍게 |
| 2 API와 프론트 | S2 최소분 + S4 | **앞당김** | 수직 슬라이스가 화면 1페이지까지 닿아야 육안 확인이 된다 |
| 3 Redis 최적화 | S2부터 상시 | **해체** | 별도 Phase가 아니라 스위치로 전 구간에 분산한다 |
| 4 부하 · 성능 측정 | S5 | 유지 + **대조군 측정 편입**(D-12) | 용량 단계를 채우는 데이터를 대조군과 공유한다 |
| 5 장애 · 확장 | S6 | 유지 · **범위 조정** | 롤업 MV는 S3으로 앞당겼고, Kafka 전환은 확장 로드맵 4단계(조건부)로 뺐다 |
| 없음 | S7 업무 데이터 축 | **신설 · 후순위 · 생략 불가**(D-11) | 알람은 ②계층의 실행 자리, CRUD 최소분은 ③계층의 시연 자리다 |

- **원본 Phase 3의 합격 판정 "p95 지연 절반 이하"는 S4에 옮기지 않았다.** 절반이라는 비율은 캐시가 들어오기 전 수치가 있어야 성립하는데, 그 역할을 SW-03 on/off 비교가 직접 수행한다. 비율 목표 자체의 정본은 [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md)다.

## 학습 단계 한눈에

각 단계가 끝나면 말할 수 있게 되는 한 문장으로 단계를 요약한다(원본 implementation_plan.md §5.1).

```plain
S0 저장소 수동 실습      PEL이 무엇인지 손으로 안다
S1 생성기 처리량 실측    생성기가 병목이 아님을 수치로 안다
S2 수직 슬라이스 ★      데이터가 끝까지 흐른다 · 비교 기준선이 있다
S3 파이프라인 심화       at-least-once와 멱등성이 실제로 동작한다 · 대조군이 같은 배치를 받는다
S4 조회 경로 · Redis 3중 역할   캐시 히트율을 만드는 조건을 안다
S5 부하 측정            이 시스템이 어디서 꺾이는지 안다 · 두 저장소가 몇 행에서 역전되는지 안다
S6 백프레셔 · 장애 재현 ★  Redis가 왜 이 자리에 있는지 수치로 증명한다
S7 업무 데이터 축        같은 스트림의 데이터가 세 저장소로 갈리는 것을 한 자리에서 본다
```

- **S2가 가장 중요한 단계다.** 이후 모든 작업이 "이 슬라이스를 두껍게"가 되고, 모든 변경에 바꾸기 전 · 바꾼 후 수치를 말할 수 있는 기준선이 생긴다.
- **S6이 학습 정점이다.** 축출 연쇄는 "수집 폭주가 조회 성능 저하로 번진다"는 명제를 한 인스턴스 안에서 눈으로 확인하는 실험이며, 원본이 Redis 인스턴스 분리의 진입 근거로 지목한 바로 그 현상이다.
- **S5 · S7의 둘째 문장은 원본에 없던 것이다.** 목표 ①의 역전 지점(D-12)과 목표 ②의 ②계층 대조(D-11)가 여기서 닫힌다.

## 단계별 범위

| 단계 | 만드는 것 | 의도적으로 미루는 것 | 학습 목표 |
|------|------|------|------|
| S0 | 저장소 컨테이너 3개(healthcheck · cpuset · 메모리 상한) · 저장소 설정 파일 · **코드 없음**. 실습 ① Redis Stream 7개 명령(XADD · XGROUP · XREADGROUP · XPENDING · XACK · XAUTOCLAIM · XINFO) ② ClickHouse tag_raw DDL · 수동 삽입 · 파트와 압축률 확인 ③ PostgreSQL 스키마 · 쿼리 통계 확장 확인 | api 컨테이너 | ② — at-least-once의 실체가 PEL이다 |
| S1 | Stream 페이로드 계약(공유 패키지) · 생성기 모듈 단독 실행 경로 · 워커 수별 처리량 비교 | 수집 경로 전체 | 전제 — 생성기가 병목이면 이후 모든 측정이 무의미하다 |
| S2 | 설비 1 · 태그 8 · 1 Hz · SINE 1종 · 모드 A · 시뮬레이터 포트 1 · 폴링 1루프 · 컨슈머 1 · 시간 트리거 배치 · tag_raw만 · 최소 API 4종 · 웹 1페이지(인증 없음) · 출처 방어 3종(CORS 허용 오리진 · WebSocket Origin 검증 · Host 대조 — AUT-07 · REQ-AUT-12 · 13 · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) · 계측 3종(방출 포인트 · 컨슈머 랙 · E2E 지연) | 인증 · 알람 · 롤업 MV · DLQ · 스풀 · 멱등 토큰 · 다중 컨슈머 · 데드밴드 · 스탬피드 락 | ② 기준선 · ① 원시값 경로 |
| S3 | 멱등 토큰 · 재시도 백오프 · DLQ · XACK 규칙 · XAUTOCLAIM 회수 · 배치 3중 트리거(읽기 · 삽입 분리 보정 반영) · 다중 컨슈머 · 레지스터 블록 병합 · 품질 코드 전체 · 데드밴드 · 롤업 MV 캐스케이드 · dict_tag · **대조군 동시 적재(SW-09)** | 조회 경로 최적화 | ② 버퍼 역할 · ① 대조군 준비 |
| S4 | 캐시 키 정규화 · 스탬피드 방지 · 해상도 자동 선택 · 다운샘플 · WebSocket 스로틀 · Pub/Sub 팬아웃 경계 · 마스터 CRUD와 무효화 체인 · 히트율 계측 | 부하 시나리오 | ② 캐시 · 팬아웃 역할 |
| S5 | k6 시나리오 5종 · 관측 모듈 완성 · observability 프로파일 · 주입 모드는 한 번에 하나 · **용량 단계별 대조 쿼리 5종** | 장애 주입 | ① 역전 지점 · 시스템 변곡점 |
| S6 | 백프레셔 단계 전이 · ClickHouse 중단 · Redis 중단 · **축출 연쇄** · SW-01 off · DLQ 재현 · 최신값 갱신 주체 실측 비교 | 확장 로드맵 단계 실행(조건부) | ② 원칙의 증명 |
| S7 | ① 알람 판정(Redis Hash 상태 머신 · Pub/Sub · 세 저장소 쓰기) ② 인증(액세스 토큰 · 리프레시 TTL 키 · 레이트 리밋) ③ 작업지시 · 실적 · 감사 CRUD **최소분** | 없음 — 이 단계의 ③은 생략하지 않는다 | ② 분기 ②계층 · ③계층 |

- **마스터 데이터는 업무 축의 예외다.** S2에서 최소 형태로, S4에서 완성한다. Collector가 태그 정의 없이 동작할 수 없고, 태그 마스터 변경 → Redis 삭제 → Dictionary 재적재의 무효화 체인이 폴리글랏 연계의 핵심 학습 지점이기 때문이다(원본 implementation_plan.md §5 S7).
- 범위 칸의 기능 목록은 요약이다. 기능 ID는 [../02_features](../02_features/README.md) 각 도메인 파일이 채번한다.

## 스위치 도입 시점

스위치는 그 역할의 경계가 코드에 생기는 단계에서 도입하고, **도입 단계의 합격 판정에 첫 on/off 비교를 넣는다.** 채번 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)다.

| 스위치 | 도입 단계 | 첫 비교 | 근거 |
|------|------|------|------|
| SW-01 REDIS_STREAM_BUFFER | S2(경계 · on) · S6(off 실험) | S6 — off + ClickHouse 중단 | 경계는 S2부터 있지만 off의 의미는 장애 상황에서만 드러난다 |
| SW-02 REDIS_LATEST_CACHE | S2 | S2 합격 판정의 첫 비교 수치 | 원본이 S2에 먼저 둔 두 스위치 중 하나 |
| SW-03 REDIS_QUERY_CACHE | S2 | S4 히트율 판정 | 원본이 S2에 먼저 둔 두 스위치 중 하나 |
| SW-04 CACHE_KEY_TIME_SNAP | S4 | S4 — off 시 히트율 0 수렴 | 키 정규화가 S4에서 생긴다 |
| SW-05 CACHE_STAMPEDE_LOCK | S4 | S4 — 동시 요청 시 ClickHouse 쿼리 실행 횟수 | 스탬피드 방지가 S4에서 생긴다 |
| SW-06 REDIS_PUBSUB_FANOUT | S4 | S4 | 팬아웃 경계가 S4에서 생긴다 |
| SW-07 WS_THROTTLE_MS | S4 | S4 | 스로틀 병합이 S4에서 생긴다 |
| SW-08 INGEST_IDEMPOTENCY | S3 | S3 — 재시도 시 중복 행 발생 · 미발생 | 멱등 토큰이 S3에서 생긴다 |
| SW-09 CONTROL_TABLE_ENABLED | S3(D-12) | S5 — 용량 단계별 대조 쿼리 | 적재 경로가 두꺼워지는 S3에서 같은 배치 경로에 붙인다 |
| SW-10 COLLECTOR_DEADBAND | S3 | S3 — 전송량 · 행 수 | 데드밴드가 S3에서 생긴다 |
| SW-11 LATEST_VALUE_WRITER | S3(ingest 잠정 구현) | S6 — ClickHouse 중단 중 갱신 주체 비교(AC-34) | 갱신 포트가 S3에서 생기고 비교는 장애 재현 단계에서 한다 |

- 검산: 도입 단계별 S2 3(SW-01 · SW-02 · SW-03) + S3 4(SW-08 · SW-09 · SW-10 · SW-11) + S4 4(SW-04 · SW-05 · SW-06 · SW-07) = **11**

## 진입 조건과 합격 판정

| 단계 | 진입 조건 | 합격 판정(조건) | 곁에 두는 원본 수치 |
|------|------|------|------|
| S0 | 착수 체크리스트 완료(§착수 체크리스트) | 저장소 컨테이너 3개 healthy · 컨테이너 통계로 메모리 상한이 실제 적용됨을 확인 | 없음 |
| S1 | S0 합격 | 생성기 단독 처리량 ≥ **M 티어 초당 포인트의 3배** · 워커 수별 수치 기록. 판정보다 **기준선 확보**가 목적이다 | 원본 목표 30,000 pps. 미달 시 원본 tech_stack.md §3.4 전환 조건 발동(datagen 역할 분리 또는 Python 생성기) |
| S2 | S1 합격 | ① 육안 — 브라우저에서 sin 파형이 실시간으로 흐른다 ② 무손실 — 생성 카운트 = tag_raw 행 수 ③ E2E 지연(ingested_at − ts)의 p50 · p95 · p99를 **기록**(판정 아님) ④ SW-02 on/off 각각의 최신값 API p95 기록 | 없음 — 이 단계의 수치는 전부 기준선이다 |
| S3 | S2 합격 · 원본 보정 7.1(배치 트리거)과 7.2(최신값 갱신 주체)의 처리 방침이 ADR로 정해짐 | ① S 티어 부하 무손실 적재 ② 컨슈머 그룹 lag 0 유지 · 정지 뒤 랙 0 복귀(AC-19) ③ SW-08 off에서 재시도 중복 발생 · on에서 미발생 ④ 원시 평균과 1분 롤업 평균이 **오차 허용 비교**로 일치 ⑤ SW-09 on에서 두 저장소의 행 수 일치 ⑥ 배치 트리거 세 안의 파트 생성률 · E2E 지연 비교 기록 | S 티어 250 pps(원본 architecture.md §15 — 1계층 구조값) |
| S4 | S3 합격 | ① 반복 조회 히트율이 목표 이상 ② SW-04 off 시 히트율이 0에 수렴함을 실측 기록 ③ SW-05 off/on에서 동시 요청 시 ClickHouse 쿼리 실행 횟수 비교 기록 | 원본 목표 히트율 80% — 미확인 |
| S5 | S4 합격 · 부하 실험 메모리 프로파일 가용 · 스냅샷 준비 | ① 부하 시나리오 5종 전부 실행 ② 성능이 꺾이는 변곡점 수치화 ③ 성능 목표표의 각 행에 실측값 기입 ④ 대조 쿼리 5종 × 용량 단계의 양 저장소 수치와 쿼리별 역전 지점(또는 역전 없음) 기록 | 원본 성능 목표표(원본 architecture.md §16) — 4 vCPU급 가정 · 미확인 |
| S6 | S5 합격 · 실험마다 스냅샷 | ① 백프레셔 정상 → 주의 → 경고 → 위험 전이와 스풀 전환 재현 ② ClickHouse 중단 후 무손실 · 무중복 복구 ③ Redis 중단 시 스풀 전환 · 조회 degrade · 최신값 503 ④ **축출 연쇄 그래프 기록** ⑤ SW-01 off에서 폴링 주기 붕괴와 유실 기록 ⑥ DLQ 이동과 알림 ⑦ 최신값 갱신 주체 두 안의 ClickHouse 중단 중 대시보드 생존 비교 | 원본 목표 소진 시간 ≤ 중단 시간의 30% — 미확인 |
| S7 | S6 합격 | ① 알람 ②계층 — 같은 구간의 alarm_eval 판정 전수 · alarm_event 확정 · alarm:state가 각자의 목적대로 존재함을 대조 ② 부분 실패 시 alarm_event가 진실로 남음을 확인 ③ 업무 CRUD 부하 중 stream:plc:raw 유입량이 CRUD와 무관함을 확인 ④ 역할 기반 인가 적용 | 없음 |

- **모든 판정 수치에 4요소를 병기하고 3회 중앙값을 쓴다**(D-10). 기록 형식의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)다. 숫자 없는 단계 완료는 인정하지 않는다(원본 tech_stack.md §14).
- **S0 합격(2026-09-24)** — AC-14 · AC-15가 3회 모두 성립했다(docs/measurements 기록 002 · EXP-29). 착수 체크리스트 1(Docker 메모리 상향) · 7(릴리스 노트 대조)이 미완인 채 S0에 들어갔다 — **진입 조건의 예외**였고 같은 날 둘을 이행했다. Docker VM을 15.6 GB로 올려 부하 실험 프로파일에서 AC-14 · AC-15를 다시 3회 확인했고(기록 003), 릴리스 노트 대조에서 ClickHouse 25.x 보안 지원 종료가 드러나 26.8 LTS로 전환하고 S0 판별 · 회귀를 다시 돌렸다(기록 004 · 005 — 26.8의 정수 ts 해석 변경은 프로파일 설정으로 막았다). 저장소 판별 EXP-32(기록 001)는 ADR-14를 보강했다([../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)).
- **S3 진입 조건의 원본 내부 불일치** — 원본 착수 체크리스트는 7.1과 7.2를 S3 이전에 결정하라고 적었고(원본 implementation_plan.md §9), 같은 문서의 7.2 본문은 최신값 갱신 주체를 S6 실측으로 결정한다고 적었다. 이 문서는 둘을 "S3 이전에는 처리 방침(잠정안과 교체 가능한 포트 구조)을 정하고 최종 선택은 S6 실측으로 한다"로 읽는다. 방침의 정본은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)(W3)다.

## 소요

순수 작업 시간 기준의 원본 추정이며 학습 · 문서화 시간은 별도다(원본 implementation_plan.md §5.1). D-11 · D-12가 더한 범위의 소요는 원본 추정에 없다.

| 단계 | 원본 추정 소요 | 원본 누적 | D-11 · D-12로 늘어나는 범위 |
|------|------|------|------|
| S0 | 0.5~1일 | 1일 | 없음 |
| S1 | 0.5~1일 | 2일 | 없음 |
| S2 | 3~5일 | 7일 | 없음 |
| S3 | 4~6일 | 13일 | 대조군 테이블과 동시 적재 경로 |
| S4 | 4~6일 | 19일 | 없음 |
| S5 | 3~5일 | 24일 | 용량 단계별 대조 쿼리 측정 |
| S6 | 3~5일 | 29일 | 없음 |
| S7 | 3~5일 | 34일 | CRUD 생략 선택지 폐지 — 최소분 필수 |

- 추가 범위의 소요는 **미확인**이다. 원본 추정을 늘려 적지 않고 착수 후 실제 소요를 기록한다.

## 착수 체크리스트

S0 시작 전에 끝낼 항목이다(원본 implementation_plan.md §9). 환경 실측값은 원본이 2026-09-20에 이 머신에서 잰 값이며 **착수 시점에 다시 잰다.** 환경의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md), 도구의 정본은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)다.

| 순서 | 항목 | 확인 방법 | 원본 실측(2026-09-20) | 미이행 시 |
|------|------|------|------|------|
| 1 | **Docker 메모리 상향** | 현행 측정 머신(macOS)은 Docker Desktop 설정의 메모리 할당 · WSL2 머신은 WSL 설정 메모리 지시자 → 재시작 → 가용 메모리 확인 | 현행 Docker VM 약 7.75 → **15.6 GB**(2026-09-24 상향 · 부하 실험 프로파일 S0 회귀 기록 003) — 원본 WSL2 머신은 가용 15 GB · 목표 20 GB | 부하 실험 프로파일을 쓸 수 없다 — 중간 프로파일(조건부)로 가고 성능 수치를 원본 목표와 비교할 수 없게 된다 |
| 2 | Docker 데몬 기동 | 데몬 정보 조회 | 기동 확인(Docker Desktop · 엔진 29.5 · 2026-09-24) | S0 불가 |
| 3 | pnpm 설치 | corepack 활성화 | 설치됨(12.5.1) — 버전은 패키지 관리자 필드로 고정한다 | 워크스페이스 구성 불가 |
| 4 | Node 22 LTS 고정 | 호스트 Node 버전 확인 · 버전 관리자로 고정 | 호스트 v24.19.0 → **Node 22.23.3 설치 · 저장소 .nvmrc 22**(2026-09-24 — 전역 기본 24 유지 · 저장소에서 버전 관리자로 전환) | 컨테이너(22)와 호스트의 런타임이 달라 재현성이 깨진다 |
| 5 | 디스크 여유 | 여유 공간 확인 | 236 GB 여유(원본 WSL2 머신 936 GB) — M 티어까지 · M+ 이상은 정상 상태 디스크 재산정 필요 | 상위 용량 티어의 정상 상태 디스크를 확보하지 못한다 |
| 6 | CPU 토폴로지 | 논리 CPU 수 · cpuset 배치 계획 | Apple M4 Pro 14코어(성능 10 + 효율 4) · Docker VM vCPU 14 · VM이 코어 종류를 노출하지 않음 — 배치 재설계 완료(04_architecture/03) | 부하 생성기 격리(cpuset)를 계획할 수 없다 |
| 7 | 버전 재확인 | 공식 릴리스 노트로 PostgreSQL 18 · ClickHouse 26.8 · Redis 8의 최신 안정 태그 확인 후 고정표 갱신 | 릴리스 노트 · 레지스트리 대조 완료(2026-09-24) — 18.6 · 8.10.2는 계열 최신 · 25.8.33.6은 25.x 보안 지원 종료라 **26.8.10.6(LTS)으로 전환**(사용자 결정 · 기록 004 · 005) | 이미지 태그가 흔들리면 성능 실험이 재현되지 않는다 |
| 8 | 보정 항목 방침 | 원본 보정 7.1 · 7.2의 처리 방침 확정(§진입 조건과 합격 판정) | 해당 없음 | 적재 경로 코드를 두 번 쓴다 |

- **6번은 원본 체크리스트에 없던 행이다.** 원본 implementation_plan.md §2.1 · §2.4의 실측과 cpuset 배치를 착수 전 확인 항목으로 올렸다 — cpuset 계획 없이 S5에 들어가면 부하 생성기와 측정 대상의 CPU 집합이 겹친 채로 기준선이 잡힌다.

## 코드 착수 항목

문서군의 산출물은 설계이며 코드가 아니다. 아래는 **코드 착수 시점에 집행할 항목**으로, 문서 작업 중에는 만들지 않는다.

| 항목 | 내용 | 착수 단계 | 근거 · 정본 |
|------|------|------|------|
| Taskfile 기본 작업 | migrate · seed · snapshot · restore · bench | S0(스냅샷 · 복원 — **완료** 2026-09-24) · S3(migrate · seed 확장) | 원본 tech_stack.md §11 · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| **문서군 린트의 Taskfile 편입** | **완료(2026-09-24)** — 로컬 스크립트(.omc/docs_lint.py)를 scripts/docs_lint.py로 옮겨 task docs:lint로 편입하고 .githooks/pre-commit 품질 게이트에 붙였다 | S0 | docs_plan 보정 #9 · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| 저장소 설정 파일 | Compose(healthcheck · cpuset · 메모리 상한 · observability 프로파일) · Redis(volatile-lru) · PostgreSQL · ClickHouse 설정 | S0 — **완료**(커밋 2318618) | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| Stream 페이로드 계약 | 공유 패키지의 스키마 하나가 API DTO이자 Stream 계약 | S1 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| 스위치 포트 | 포트 인터페이스 하나에 구현 둘 · 모듈 초기화 시 선택 · 상태 노출 | S2(SW-01~SW-03)부터 도입 단계별 | D-06 · [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 키 계열별 래퍼 | 캐시 계열은 TTL 필수 파라미터 · 봉인 계열은 TTL 명령 비노출 · 실패 전략 이원화 | S2 | 원본 implementation_plan.md §7.5 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 측정 기록 자리 | docs/measurements 폴더와 기록 템플릿 | S2 첫 기록 전 — **S0에서 먼저 생김**(기록 001 · 002) | D-09 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 대조군 DDL | plc_tag_raw_control(BRIN · 일자 파티션) 마이그레이션 | S3 | D-05 · D-12 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) |

## 미확인 등재

로드맵이 판정에 쓰는 성능 수치와 원본 예상치다. 전부 **미확인 — 확정 전 임의 값 고정 금지**이며 확정은 실험의 실측 결과로만 한다.

| 항목 | 원본 예상치 또는 목표 | 확정 단계 | 확정 자리 |
|------|------|------|------|
| 생성기 단독 처리량 | 20 스레드 머신에서는 미달 가능성이 낮다(원본 서술) | S1 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| E2E 지연 기준선 p50 · p95 · p99 | 원본 목표 p95 1.5초 이하(M 티어) | S2 기준선 · S5 판정 | 상동 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) |
| 최신값 조회 on/off 차이 | off 30~150 ms · on 0.3~1 ms | S2 | 상동 |
| 배치 트리거 세 안의 파트 생성률 | 컨슈머 3개 독립 플러시 시 파트 생성률 3배(원본 산술) | S3 | 상동 · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 반복 조회 히트율 | 원본 목표 80% 이상 · SW-04 off 시 0% 수렴 | S4 | 상동 |
| 스탬피드 쿼리 횟수 | 동시 100요청 시 100회 → 1회 | S4 | 상동 |
| 시스템 변곡점 | 없음 — "몇 pps에서 꺾이는지"가 산출물이다 | S5 | 상동 |
| 쿼리별 역전 지점 | 없음 — 산출물이다 | S5 | 상동 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| ClickHouse 중단 후 소진 시간 | 원본 목표 ≤ 중단 시간의 30% | S6 | 상동 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 축출 연쇄가 관찰되는 메모리 조건 | 원본 실험 조건 maxmemory 하향 | S6 | 상동 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| D-11 · D-12 추가 범위의 소요 | 없음 | 착수 후 | 이 문서 §소요 |

## 관련 문서

- [06_design_decisions.md](./06_design_decisions.md) — D-07 학습 순서 · D-11 업무 축 · D-12 대조군 편입
- [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) — 각 단계가 닫는 학습 목표
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 채번 정본
- [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md) — 단계별 인수 기준 AC-NN
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 3회 중앙값 · 4요소 · 스냅샷 규칙
- [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) — 실측 환경과 메모리 프로파일
- [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) — 학습 단계 뒤의 확장 로드맵
