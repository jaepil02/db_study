# 페르소나와 역할

> **대상**: 기능 · 화면 · 권한 설계자 — db_study를 누가 어떤 목적으로 쓰는가, 각자 어느 화면과 어느 경로로 어느 저장소에 닿는가
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §2 · §6 · §11 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §7.2 · §8.1 · §8.2(커밋 ff66a37) · 원본 implementation_plan.md §5 S0 · S2 · S7(커밋 ff66a37) · [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) · [06_design_decisions.md](./06_design_decisions.md) D-01 · D-02 · D-11

원본은 사용자를 세 종류로 그렸다 — 실시간 모니터링의 **현장 운영자**, 업무 데이터 관리의 **관리자**, 이력 분석의 **엔지니어**(원본 architecture.md §2). 이 문서는 여기에 **실험 수행자**를 더한다. 원본 세 종류는 이 시스템이 모사하는 현장의 사용자이고, 실험 수행자는 이 시스템을 측정 장치로 쓰는 사용자다. 학습 목표 2축(D-01)의 산출물은 앞의 셋이 아니라 넷째가 만든다.

**페르소나는 사람 수가 아니라 관점이다.** 로컬 머신 1대(D-02)에서 학습자 한 명이 네 관점을 오간다. 그래서 페르소나 구분은 동시 사용자 부하의 근거가 아니라 **화면 · 요청 경로 · 권한 역할을 가르는 기준**으로만 쓴다. 역할 코드 값과 역할 × 기능 권한은 원본에 없으며 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)(W2)가 확정한다 — 이 문서는 값을 만들지 않는다.

## 페르소나 요약

| 페르소나 | 원천 | 목표 | 대표 질문 | 주 화면 | 빈도 | 권한 역할 |
|------|------|------|------|------|------|------|
| 현장 운영자 | 원본 architecture.md §2 | 설비 상태를 지금 보고 알람에 반응한다 | 이 설비의 태그가 지금 정상인가 · 방금 뜬 알람을 확인했는가 | [../08_screen/03_realtime_dashboard.md](../08_screen/03_realtime_dashboard.md) · [../08_screen/05_alarm_console.md](../08_screen/05_alarm_console.md) | 상시 — 화면을 띄워 둔다 | W2 확정(12_permission_matrix) |
| 관리자 | 원본 architecture.md §2 | 마스터 · 작업지시 · 실적 등 업무 데이터를 정확히 유지한다 | 새 설비와 태그를 등록했는가 · 작업지시 상태가 맞는가 | [../08_screen/06_master_admin.md](../08_screen/06_master_admin.md) | 수시 — 변경이 생길 때 | 상동 |
| 엔지니어 | 원본 architecture.md §2 | 과거 시계열과 알람 판정 이력으로 원인과 임계값을 분석한다 | 지난주 이 태그는 어떻게 움직였나 · 이 임계값은 오탐이 많은가 | [../08_screen/04_trend_analysis.md](../08_screen/04_trend_analysis.md) · [../08_screen/05_alarm_console.md](../08_screen/05_alarm_console.md) | 분석 세션 단위 | 상동 |
| 실험 수행자 | **신설** — 학습 목표 2축(D-01) | 스위치 조건을 바꿔 두 축의 비교 수치를 만들고 기록한다 | SW-02를 끄면 최신값 조회가 얼마나 느려지나 · 몇 행부터 역전되나 | [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) · 저장소 CLI · observability 프로파일 대시보드 | 실험 세션 단위 — 같은 실험을 반복한다 | 앱 역할보다 **머신 접근**이 주 권한이다(§권한 역할) |

- 검산: 원본 3(현장 운영자 · 관리자 · 엔지니어) + 신설 1(실험 수행자) = **4**
- **빈도는 정성 서술이다.** 동시 사용자 수 · 요청률은 페르소나가 아니라 용량 티어와 부하 시나리오가 정한다([../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) · [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md)).
- **실험 수행자를 신설한 이유** — 원본 세 페르소나로는 스위치 상태 표시 · 실험 기록 · on/off 비교 화면의 사용자가 없다. 사용자가 없는 화면은 요구사항의 근거를 잃고, 실험 콘솔이 "관리자 부가 기능"으로 밀려 학습 목표의 산출 자리가 사라진다.

## 페르소나별 작업

### 현장 운영자

| 작업 | 화면 | 요청 경로 | 닿는 저장소 | 분기 계층 |
|------|------|------|------|------|
| 설비 전체 태그 최신값 보기 | 03_realtime_dashboard | 브라우저 → api 직결 | Redis rt:latest | ① 사본(진실은 ClickHouse) |
| 실시간 트렌드 받기 | 03_realtime_dashboard | 브라우저 → api WebSocket 직결 | Redis Pub/Sub ch:rt | ① |
| 태그 STALE · 통신 이상 인지 | 03_realtime_dashboard | 상동 | Redis rt:latest의 품질 필드 | ① |
| 알람 발생 · 해제 받기 | 05_alarm_console | WebSocket 직결 | Redis Pub/Sub ch:alarm | ② |
| 알람 확인(ack) | 05_alarm_console | 브라우저 → api | PostgreSQL alarm_event | ② 확정 이벤트 |

- **운영자의 화면은 거의 전부 Redis만 본다.** 운영자가 체감하는 "시스템이 느리다"는 대개 Redis 역할 스위치 하나의 상태로 설명된다 — SW-02 off면 최신값이 ClickHouse 점조회로 떨어지고, SW-07이 0이면 프레임이 폭증한다.
- **알람 확인은 운영자가 한다**(원본 data_flow.md §8.1 상태 머신의 확인 전이). 확인 기록의 진실은 PostgreSQL alarm_event이며 Redis alarm:state가 아니다.

### 관리자

| 작업 | 화면 | 요청 경로 | 닿는 저장소 | 분기 계층 |
|------|------|------|------|------|
| 로그인 · 토큰 갱신 | 06_master_admin | 브라우저 → Next.js BFF → api | PostgreSQL user_account · Redis auth · sess | ③ |
| 사이트 · 라인 · 설비 · 태그 마스터 관리 | 06_master_admin | BFF 경유 | PostgreSQL · 커밋 이후 캐시 무효화 · Dictionary 재적재 | ③(ClickHouse는 Dictionary로만 닿는다) |
| 작업지시 · 생산 실적 관리 | 06_master_admin | BFF 경유 | PostgreSQL work_order · production_log | ③ |
| 변경 이력 확인 | 06_master_admin | BFF 경유 | PostgreSQL audit_log · tag_master_history | ③ |

- **관리자의 쓰기는 Stream을 타지 않는다.** 이것이 분기 ③계층 — 경로를 고르지 않는 분기 — 의 시연 자리다(D-11). 관리자가 태그 스케일을 바꾸면 새 tag_id가 발급되고 이전 태그는 비활성화된다(전역 불변식 "불변 사실 기록").
- **마스터 변경은 네 저장소 층을 건드린다** — PostgreSQL 커밋 → Redis 캐시 삭제 → Pub/Sub 전파 → ClickHouse Dictionary 재적재(원본 data_flow.md §7.1). 관리자 한 번의 저장이 운영자 · 엔지니어 화면의 태그명까지 바꾸는 경로이며, 확장된 무효화 체인의 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다.

### 엔지니어

| 작업 | 화면 | 요청 경로 | 닿는 저장소 | 분기 계층 |
|------|------|------|------|------|
| 시간 범위 트렌드 조회 | 04_trend_analysis | 브라우저 → api 직결 | Redis cache:q → 미스 시 ClickHouse 롤업 또는 원시 | ① |
| 원시 데이터 내보내기 | 04_trend_analysis | 직결 · 스트리밍 | ClickHouse | ① |
| 알람 판정 이력 분석 | 05_alarm_console | 직결 | ClickHouse alarm_eval | ② 판정 전수 |
| 알람 규칙 조정 | 05_alarm_console | BFF 경유 | PostgreSQL alarm_rule · 캐시 즉시 무효화 | ② 규칙(원천) |

- **엔지니어는 해상도를 고르지 않는다.** 조회 범위에 따라 서버가 raw · 1m · 1h · 1d 중 하나를 고른다 — 원시 1년치 요청이 ClickHouse를 마비시키는 사고를 서버가 구조로 막기 위해서다. 원시가 꼭 필요하면 내보내기로 간다.
- **알람 규칙을 누가 고치는지는 원본에 없다.** 판정 전수를 분석하는 엔지니어와 업무 데이터를 관리하는 관리자 중 누구의 권한인지는 W2가 정한다(§미확정 등재).

### 실험 수행자

| 작업 | 도구 · 화면 | 요청 경로 | 닿는 저장소 | 학습 목표 |
|------|------|------|------|------|
| 저장소 수동 실습(PEL 관찰 등) | redis-cli · psql · clickhouse-client | 호스트 CLI → 127.0.0.1 저장소 포트 | 전부 | ②(at-least-once의 실체) |
| 스위치 조건 설정 · 재기동 | 환경변수 · Compose 재기동 · 07_experiment_console(상태 확인) | 호스트 셸 | 해당 없음 | ① · ② |
| 부하 주입 | k6(호스트 프로세스) · 생성기 주입 모드 | 호스트 → api · 부하 주입 표면 | Redis Stream · ClickHouse | ① · ② |
| 계측 관찰 | observability 프로파일 대시보드 · /metrics 직접 덤프 | 호스트 → api /metrics | 해당 없음 | ① · ② |
| 스냅샷 · 복원 | Taskfile 스냅샷 · 복원 | 호스트 셸 | 볼륨 전체 | 전제(같은 초기 상태) |
| 대조 쿼리 실행 | psql · clickhouse-client · 07_experiment_console | 호스트 CLI · 직결 | PostgreSQL 대조군 · ClickHouse tag_raw | ① |
| 결과 기록 | docs/measurements · 07_experiment_console | 파일 · 화면 | 해당 없음 | ① · ② |

- **실험 수행자의 화면 밖 작업이 화면 안 작업보다 많다.** 스위치는 환경변수 + DI 초기화 선택이라 화면에서 바꿀 수 없고(D-06), 실험 콘솔은 상태 표시 · 실행 기록 · 비교만 한다. 콘솔에 토글을 기대하면 설계를 버그로 오해한다.
- **정밀 측정 세션에서는 관측 대시보드를 끈다.** 관측 스택이 측정 대상과 같은 CPU를 쓰므로 그 동안의 수치는 상대 비교용이다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)).

## 요청 경로 — BFF 경유와 직결

같은 웹 화면이라도 요청 성격에 따라 경로가 둘로 갈린다(원본 architecture.md §2 · 원본 data_flow.md §7.2). 경로 기준의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)다.

| 요청 유형 | 경로 | 주로 부르는 페르소나 | 이유 |
|------|------|------|------|
| 로그인 · 토큰 갱신 | 브라우저 → BFF → api | 전원 | **httpOnly 리프레시 쿠키를 서버에서만 다룬다** — BFF가 남는 가장 중요한 이유 |
| 마스터 · 작업지시 CRUD | BFF 경유 | 관리자 | 저빈도 · 요청 오리진이 하나로 모여 쿠키 · CORS가 단순해진다 |
| 최신값 폴링 · 시계열 조회 | 브라우저 → api 직결 | 운영자 · 엔지니어 | 고빈도 요청에 중계 1홉을 더할 이유가 없다 |
| WebSocket 실시간 | 직결 | 운영자 | BFF가 중계할 필요가 없다. 토큰은 첫 메시지로 보낸다(URL에 남기지 않는다) |
| 저장소 직접 접속 | 호스트 CLI → 127.0.0.1 저장소 포트 | 실험 수행자 | 상태를 손으로 확인하는 것이 학습 수단이다 |
| 웹 → DB 직접 | **금지** | 없음 | 커넥션을 api 한 곳으로 일원화하고 인가를 우회하는 경로를 만들지 않는다 |

## 페르소나 × 분기 계층

어느 페르소나가 분기의 어느 계층을 보는지를 한 표로 둔다. 빈 칸 대신 닫힌 어휘(보지 않음)를 쓴다.

| 페르소나 | ① 원시값 | ② 알람 · 실적 | ③ 업무 CRUD | 대조군 |
|------|------|------|------|------|
| 현장 운영자 | Redis 사본(최신값 · 푸시) | 핫 상태 푸시 · 확정 이벤트 확인 | 보지 않음 | 보지 않음 |
| 관리자 | 보지 않음 | 보지 않음 | 쓰기 주체 | 보지 않음 |
| 엔지니어 | ClickHouse 롤업 · 원시 | 판정 전수(alarm_eval) · 규칙 | 보지 않음 | 보지 않음 |
| 실험 수행자 | 전 경로 계측 | **세 저장소 동시 대조** | Stream 비경유 확인 | 쓰기 · 조회 주체 |

- **②를 세 저장소에서 한꺼번에 보는 페르소나는 실험 수행자뿐이다.** 운영자는 Redis와 PostgreSQL 쪽만, 엔지니어는 ClickHouse 쪽만 본다. 학습의 핵심 계층이 현장 페르소나에게는 한 조각씩만 보인다는 사실이 실험 수행자를 따로 세운 두 번째 이유다.

## 권한 역할

원본이 정한 것은 역할 기반 인가의 **구조**뿐이고 역할의 **값**은 정하지 않았다.

| 항목 | 원본이 정한 것 | 원본에 없는 것 | 확정 자리 |
|------|------|------|------|
| 역할 저장 | role(role_code 유일) · user_role(사용자 ↔ 역할 다대다) 테이블(원본 architecture.md §6) | role_code 값 · 역할 수 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| 인가 방식 | 역할 기반 · 엔드포인트별 Guard 검사(원본 architecture.md §18) | 역할 × 기능 매트릭스 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 권한 캐시 | cache-aside · 권한 변경 시 즉시 삭제(원본 architecture.md §10.1) | 캐시 키 모양 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 페르소나 ↔ 역할 | 없음 | 페르소나 하나가 역할 하나인지 여부 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 실험 권한 | 부하 주입 표면은 환경변수로 켠다 · 기본 비활성(원본 architecture.md §18) | 앱 역할로 실험을 막을지 여부 | 상동 · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) |

- **실험 수행자의 주 권한은 앱 역할이 아니라 머신 접근이다.** 스위치 · 부하 주입 표면 · 저장소 포트는 환경변수와 호스트 셸로 다루며, 이 경계를 지키는 것은 127.0.0.1 바인드와 .env 비커밋이다([../12_security/05_local_exposure.md](../12_security/05_local_exposure.md)).

## 단계별 페르소나 가용성

인증은 학습 순서상 늦게 온다(원본 implementation_plan.md §5 S2 "인증 없음" · S7 인증). **S7 이전에는 역할로 페르소나를 가를 수 없다.** 순서의 정본은 [05_priorities_roadmap.md](./05_priorities_roadmap.md)다.

| 단계 | 쓸 수 있는 페르소나 관점 | 인증 | 역할 구분 |
|------|------|------|------|
| S0 · S1 | 실험 수행자(CLI · 생성기 단독 실행) | 해당 없음 | 없음 |
| S2 | 실험 수행자 · 운영자 관점의 최소 대시보드 1페이지 | 없음 | 없음 |
| S3 · S4 | 상동 + 엔지니어 관점(해상도 자동 선택 · 캐시) · 관리자 관점의 마스터 CRUD | 없음 | 없음 |
| S5 · S6 | 상동 — 부하 · 장애 실험의 관찰자 | 없음 | 없음 |
| S7 | 전 페르소나 — 알람 콘솔 · 작업지시 · 로그인 | 있음 | 역할 기반 인가 적용 |

- **S2~S6의 무인증은 결함이 아니라 순서의 결과다.** 인증을 먼저 넣으면 수직 슬라이스가 두꺼워지고 첫 기준선이 늦어진다(D-07). 대신 이 구간의 모든 표면은 127.0.0.1 바인드 안에 있다.
- **S7에서 인가를 붙일 때 기존 측정의 비교 가능성이 깨진다.** 인증 · 인가 비용이 요청 경로에 더해지므로, S7 전후의 조회 p95는 같은 스위치 상태라도 다른 조건이다 — 기록의 커밋 해시가 이를 가른다.

## 흔한 오해

| 형 | 통념 또는 결론 | 부정 또는 반대 시나리오 | 진짜 축 또는 결과 | 대체 경로 또는 지침 |
|------|------|------|------|------|
| A | 페르소나가 넷이면 동시 사용자 부하도 넷 분량이다 | 로컬 1대에서 학습자 한 명이 관점을 오간다 | 부하는 용량 티어와 k6 시나리오가 만든다 | 동시 연결 · 요청률은 부하 시나리오 문서에서 읽는다 |
| A | 실험 수행자에게 역할 코드가 없으니 권한 누락이다 | 스위치는 앱 권한으로 막을 대상이 아니다 | 스위치 전환은 환경변수 + 재기동이다 | 머신 접근 경계(127.0.0.1 · .env)로 지킨다 |
| A | 실험 콘솔에서 스위치를 못 바꾸는 것은 미구현이다 | 런타임 토글은 설계상 없다 | DI 초기화 선택(D-06) | 콘솔은 상태 표시와 재기동 절차 안내를 한다 |
| B | 운영자 화면이 ClickHouse를 거의 안 부르는 것은 기능 부족이다 → 의도된 차단이다 | 최신값을 ClickHouse에서 읽으면 고빈도 점조회가 OLAP에 몰린다 | 운영자 화면의 부하가 Redis에 머문다 | 운영자 화면에 새 조회를 더할 때는 Redis 경유 여부를 먼저 정한다 |
| B | 관리자 저장 직후 트렌드 화면의 태그명이 잠시 옛값이다 → 무효화 체인 밖 캐시 층의 흔적이다 | 체인을 생략하면 Dictionary 수명만큼 옛 이름이 남는다 | 무효화는 커밋 이후 순서로만 동작한다 | 체인의 정본(06_pipeline/07)에서 층별 반영 시점을 읽는다 |

## 미확정 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| role_code 값과 역할 수 | 원본에 없음 — 임의로 만들지 않는다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)(W2) |
| 알람 규칙 변경 권한의 주체(관리자 · 엔지니어) | 원본에 없음 | 상동 |
| 실험 콘솔 화면의 접근 권한 | 원본에 없음(화면 자체가 신설) | 상동 · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md)(W5) |
| 화면 코드({표면}-{의미}) | 채번 전 — 이 문서는 파일명으로만 가리킨다 | [../08_screen/README.md](../08_screen/README.md)(W5) |

## 관련 문서

- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 기능 권한의 정본
- [../08_screen/README.md](../08_screen/README.md) — 화면 목차 · 화면 코드 채번
- [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) — 인증 · 인가 방어선
- [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) — 실험 수행자가 산출하는 학습 목표
- [05_priorities_roadmap.md](./05_priorities_roadmap.md) — 페르소나 관점이 열리는 단계
- [../11_glossary/01_domain_terms.md](../11_glossary/01_domain_terms.md) — STALE · PEL 등 용어
