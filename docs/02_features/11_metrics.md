# OBS — 관측 기능 명세

> **대상**: 관측(OBS · NestJS metrics 모듈) 기능 목록 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID OBS-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — SW-11 LATEST_VALUE_WRITER 신설 반영(D-13 · 사용자 확정) — 스위치 10 → **11**
> **개정일**: 2026-09-24 — W2 요구사항 판정 반영 — 헬스 부분 실패는 503 + 저장소별 상태 본문 · 코드 없음(REQ-OBS-09)
> **원천**: 원본 architecture.md §3 · §4 · §11 · §14 · §16(커밋 ff66a37) · 원본 tech_stack.md §9(커밋 ff66a37) · 원본 data_flow.md §15 · §16(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S5 · S6 · §8(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #12 · D-06 · D-10 · [13_switch_matrix.md](./13_switch_matrix.md)

OBS는 **측정 대상과 측정 도구를 가르는 별도 평면의 도메인**이다. 전 도메인의 카운터와 세 저장소의 통계를 주기적으로 모아 api 컨테이너의 /metrics **하나**로 노출한다 — exporter 컨테이너를 두지 않는 이유는 로컬 메모리 예산과, 관측 도구가 측정 대상의 CPU를 덜 잡아먹게 하려는 것이다(원본 tech_stack.md §9). 헬스체크 /api/v1/health도 OBS가 소유한다(docs_plan 보정 #12).

**OBS는 의존 그래프 밖에 있다.** 모든 도메인이 자기 계측을 노출할 책임을 지고 OBS는 모으기만 한다 — "계측 없는 스위치는 장식이다"(전역 불변식 "계측 우선"). **소유 저장 객체도 없고**(메트릭은 앱 저장소에 앉지 않는다) **흐름 F-01~F-10 어디에도 주 경로로 참여하지 않는다** — 계측은 흐름이 아니라 관측이다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)). 메트릭 이름 · 전수의 정본은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6)이며 이 문서는 기능의 존재와 경계만 고정한다.

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 W5 몫). OBS는 흐름에 참여하지 않으므로 흐름 칸은 전부 "해당 없음 — 관측"이다.

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **OBS-01** | 앱 메트릭 통합 노출 | 앱 기본(이벤트 루프 지연 · 힙 · GC) · HTTP · WebSocket(RPS · 상태 코드 · 지연 히스토그램 · 연결 수) · 파이프라인(초당 포인트 · **컨슈머 랙** · 배치 크기 · DLQ 건수 · 스풀 상태)을 /metrics로 노출한다. S2는 계측 3종(방출 포인트 · 컨슈머 랙 · E2E 지연)만이다. 컨슈머 랙이 가장 중요한 단일 지표다 — 지속 증가하면 적재가 수집을 따라가지 못한다 | S2 · S5 | 해당 없음 — 관측 | 해당 없음 | 07_api/10_metrics | 없음 |
| **OBS-02** | 저장소 메트릭 수집 | Redis INFO · 스트림 길이(XLEN) · PostgreSQL 통계 뷰(pg_stat_database · pg_stat_statements) · ClickHouse 시스템 테이블(system.metrics · system.events · system.parts)을 주기(현행 15초)로 모아 /metrics에 합친다. 스크레이프 창구를 하나로 유지한다 | S5 | 해당 없음 — 관측 | 해당 없음 | 07_api/10_metrics | 세 저장소 카탈로그(읽기) |
| **OBS-03** | 키 계열별 메모리 샘플링 | 인스턴스가 하나라 인스턴스별 메모리 대신 **키 접두별 점유**를 본다. 접두별 샘플 키에 MEMORY USAGE를 돌려 추정한다 — 전수 계산은 비싸다. stream 접두와 cache 접두의 추이를 나란히 봐야 "스트림 적체가 캐시를 밀어냈는가"를 판별할 수 있다(축출 연쇄 그래프의 원천) | S6 | 해당 없음 — 관측 | 해당 없음 | 07_api/10_metrics | Redis(샘플 읽기) |
| **OBS-04** | E2E 지연 게이지 | ClickHouse에 주기 쿼리로 최근 창의 ingested_at − ts 분위수를 구해 게이지로 노출한다. 두 컬럼의 차 하나로 수집 → 버퍼 → 적재 전체의 지연을 잰다 — 별도 추적 시스템 없이 SQL 한 줄이다(원본 data_flow.md §15) | S2 | 해당 없음 — 관측 | 해당 없음 | 07_api/10_metrics | ClickHouse tag_raw(읽기) |
| **OBS-05** | 헬스체크 | /api/v1/health가 저장소별 상태를 낸다. Compose가 api의 healthcheck로 이 표면을 부른다(원본 architecture.md §3) — 저장소 3개가 healthy여야 api가 뜨고, api가 healthy여야 기동이 끝난다. 컨테이너가 떴다는 것과 접속을 받을 준비가 됐다는 것은 다르다 | S2 | 해당 없음 — 관측 | 해당 없음 | 07_api/10_metrics | 세 저장소(핑) |
| **OBS-06** | 스위치 상태 노출 | 현재 스위치 전부(정본 [13_switch_matrix.md](./13_switch_matrix.md))의 상태를 /api/v1/health 응답과 /metrics 레이블로 노출한다. 모든 측정 기록의 4요소 중 하나가 스위치 상태다(D-10) — 노출이 없으면 기록자가 환경변수를 손으로 옮겨 적다 틀린다. SW-01 off의 부팅 경고도 여기에 상태로 남긴다 | S2 | 해당 없음 — 관측 | SW-01~SW-10 전부(노출) | 07_api/10_metrics | 없음 |

- 검산: OBS-01~06 = **6**. 단계별(첫 도입 기준) S2 4(OBS-01 · 04 · 05 · 06) + S5 1(OBS-02) + S6 1(OBS-03) = **6**
- 표면 둘(/metrics · /api/v1/health)에 기능 여섯이 앉는다 — /metrics 4(OBS-01 · 02 · 03 · 04) + /api/v1/health 1(OBS-05) + 양쪽 1(OBS-06) = **6**

## 관측 스택과의 경계

OBS가 하는 일은 **노출**까지다. 저장 · 시각화 · 알림은 선택 기동 observability 프로파일이 한다(구성원 정본 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)).

| 층 | 주체 | 기본 기동 | 이 문서의 범위 |
|------|------|------|------|
| 계측 | 각 도메인 모듈 | 예 | 아니다 — 각 도메인 파일의 실패 절이 지표를 적는다 |
| 수집 · 노출 | OBS(api 컨테이너) | 예 | **예** |
| 저장 · 시각화 · 알림 | observability 프로파일 | **아니오** | 아니다 — [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md) |
| 정밀 측정 덤프 | 실험 수행자가 /metrics를 직접 읽는다 | 해당 없음 | 표면만 제공한다 |

- **B형 — 관측 스택이 기본으로 꺼져 있는 것은 누락이 아니다.** 측정 대상과 같은 CPU를 쓰므로, 켠 채 얻은 수치는 상대 비교용이다. 정밀 측정 세션은 프로파일을 끄고 /metrics를 낮은 주기로 직접 덤프한다(원본 architecture.md §14).

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| OBS-01 | 도메인 카운터를 대신 만들지 않는다 — 모을 뿐이다 | 각 도메인 |
| OBS-01 · 02 | 메트릭을 저장하지 않는다 | observability 프로파일 |
| OBS-02 | 저장소 설정을 바꾸지 않는다 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| OBS-04 | 구간별 지연을 분해하지 않는다 — E2E 한 값이다 | 구간 히스토그램(각 도메인) · 선택 항목 분산 추적 |
| OBS-05 | 저장소를 재시작하지 않는다 · 백프레셔 단계를 판정하지 않는다 | Compose 재시작 정책 · COL-07 |
| OBS-06 | **스위치를 바꾸지 않는다** — 환경변수 + 재기동이다(D-06) | [13_switch_matrix.md](./13_switch_matrix.md) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| 전 도메인 | 도메인 → OBS | 계측 노출 | 각 모듈이 카운터 · 히스토그램을 등록한다 |
| AUT | 없음 | 해당 없음 | /metrics · /api/v1/health는 무인증 표면으로 판정했다([12_permission_matrix.md](./12_permission_matrix.md)) |
| 저장소 | OBS → 저장소 | 카탈로그 읽기 | 통계 뷰 · 시스템 테이블 · INFO |

## 실패 시 보이는 것

OBS에는 유효 에러 코드가 없다(metrics 네임스페이스는 정의만 있다 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)).

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 일부 저장소가 응답하지 않음 | 헬스 응답 **503** + 저장소별 상태 본문 · 에러 봉투와 코드를 쓰지 않는다 | [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) REQ-OBS-09 | OBS-05 |
| 저장소 통계 수집 실패 | 그 계열 메트릭만 빈다 — /metrics 자체는 응답한다 | 수집 오류 메트릭 | OBS-02 |
| 메트릭 카디널리티 폭증 | 스크레이프 지연 · 메모리 증가 | /metrics 응답 크기 | OBS-01 |
| 주기 쿼리의 ClickHouse 부하 | E2E 게이지 쿼리가 측정 대상에 부하를 더한다 | 쿼리 로그 | OBS-04 |

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| health · metrics 표면 소유 — docs_plan 보정 #12 | OBS-05 · OBS-01이 소유한다 | [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| 스위치 상태 노출 — 원본 implementation_plan.md §4.1 | OBS-06 | [13_switch_matrix.md](./13_switch_matrix.md) |
| 보정 7.1~7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| OBS의 APP_ROLE | 원본 미지정(W1 등재) — 역할 분리 시 각 컨테이너가 자기 /metrics를 내는지 한 곳이 모으는지 없다 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)(W3) |
| 헬스 부분 실패 응답 | **W2 판정 완료** — 503 + 저장소별 상태 · 코드 없음 | [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) |
| 스위치 상태 레이블 이름 · 메트릭 이름 규약 | 미정 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |
| 수집 주기 · E2E 게이지 창 | 2계층 조정값 — 현행 15초 · 5분(원본) | 상동 |
| observability 프로파일 구성원 | W6 판정(docs_plan 보정 #17) | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(W6) |

## 관련 문서

- [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) — REQ-OBS 동작 계약
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — /api/v1/health · /metrics 표면
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 메트릭 전수 · 이름 규약
- [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) — 계측 지점
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 4요소 병기 · 정밀 측정 세션
- [13_switch_matrix.md](./13_switch_matrix.md) — 노출 대상 스위치
