# 04_architecture — 아키텍처

> **대상**: db_study의 시스템 구조 — 조감도 · 모듈 경계 · 실행 토폴로지 · 저장소 분리 정책 · 지연 예산 · 백프레셔와 장애 · 용량 · 확장 로드맵 · 기술 결정
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(전역 불변식 · 분기 3계층) · 원본 architecture.md §1~§5 · §9 · §13 · §15 · §17 · §19 · 원본 tech_stack.md §3 · §5.3 · §13 · 원본 data_flow.md §8.2 · §15 · 원본 implementation_plan.md §2 · §4.3 · §6 · §7(커밋 ff66a37)

"어떤 구조로 계약을 강제하는가"에 답하는 폴더다. **기술 결정 ADR-NN을 채번**한다. 요구사항이 "무엇이 참이어야 하는가"라면 아키텍처는 "무엇이 그것을 참으로 만드는가"다.

**학습 목표 ②의 정책 정본이 이 폴더에 있다.** [04_storage_split.md](./04_storage_split.md)가 무엇이 어디로 왜 가는지를 정하고, 어느 모듈이 어떻게 가르는지는 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)가 정한다. 정책과 기전을 가르는 이유는 기전이 바뀌어도(예: 최신값 갱신 주체 이동) 정책이 흔들리지 않게 하기 위해서다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_system_architecture.md](./01_system_architecture.md) | 조감도 · 시스템 컨텍스트 · 경계별 프로토콜 · 컨테이너 4 · **아키텍처 불변식 표** | architecture §1 · §2 · §3 | W3 |
| [02_module_boundaries.md](./02_module_boundaries.md) | Stream 경계 원칙과 근거 4 · 경계 예외(알람 직접 호출)의 근거 · APP_ROLE · worker_threads 격리 · **스위치 = DI 포트 제약** · 리포지터리 구조 | architecture §4 · §9 · implementation_plan §4.3 · §6 · §7.3 | W3 |
| [03_execution_topology.md](./03_execution_topology.md) | Compose 서비스 · healthcheck · 기동 순서 · named volume · 메모리 프로파일 · CPU 가중 · cpuset 배치 · 스냅샷과 복원 | architecture §3 · §13 · tech_stack §10.1~§10.5 · implementation_plan §2 | W3 |
| [04_storage_split.md](./04_storage_split.md) | ★★ **저장소 분리·분기 정책 정본(학습 목표 ②)** — 3계층 분기 표 · 데이터 종류별 목적지와 근거 · 목적이 다른 세 쓰기 · 업무 쓰기가 Stream을 타지 않는 이유 · 중복 저장의 유일한 예외 | architecture §5 · tech_stack §5.3 · data_flow §8.2 | W3 |
| [05_latency_budget.md](./05_latency_budget.md) | 구간별 p95 예산 · 지배 구간 · 측정 지점 · 알람 판정 구간 신설 | data_flow §15 · implementation_plan §7.3 | W3 |
| [06_backpressure_failure.md](./06_backpressure_failure.md) | 백프레셔 5단계 · 프로파일별 임계 · MAXLEN과 maxmemory 관계 · 장애 시나리오 · degrade 원칙 · **ClickHouse 중단 시 최신값 정지 문제** | architecture §9.3 · §17 · implementation_plan §7.2 | W3 |
| [07_capacity_planning.md](./07_capacity_planning.md) | 용량 티어 S · M · M+ · L · 정상 상태 디스크 · 파생 지표 | architecture §15 | W3 |
| [08_scaling_roadmap.md](./08_scaling_roadmap.md) | 확장 4단계 · 실측 진입 조건 · 삭제한 단계와 이유 | architecture §19 | W3 |
| [09_decision_records.md](./09_decision_records.md) | **ADR-NN 채번 정본** — 맥락 · 결정 · 버린 대안 · 파급 4항목 고정 · 대체 결정의 상태 항목 | tech_stack §3 · §5.2 · §5.3 · §13 · implementation_plan §7 | W3 |

검산: 본문 9 + README 1 = **10**

## ADR 선점표

W3 착수 전 리드가 번호를 선점한다. 05_data_stores를 쓰는 팀원이 04_architecture와 동시에 이 번호를 인용하기 때문이다. 결정 본문의 정본은 [09_decision_records.md](./09_decision_records.md)이며, 제목은 본문 작성 때 다듬을 수 있지만 **번호와 주제는 바꾸지 않는다.** 새 결정은 ADR-22부터 말미에 채번한다.

| ADR | 주제 | 원천 | 주 인용처 |
|-----|------|------|----------|
| ADR-01 | 백엔드 NestJS 단일 런타임(Python 데이터 평면 미채택) | tech_stack §3 · §13 | 04/02 · 09_tech_stack/06 |
| ADR-02 | 프론트엔드 Next.js + Route Handler BFF · 고빈도는 api 직결 | tech_stack §4.1 · data_flow §7.2 | 04/01 · 07_api/01 |
| ADR-03 | 시계열 엔진 ClickHouse(TimescaleDB · InfluxDB 미채택) | tech_stack §5.2 · §13 | 04/04 · 05/03 |
| ADR-04 | 수집 버퍼 Redis Streams(Kafka · RabbitMQ 보류) | tech_stack §5.3 · §13 | 04/02 · 04/08 |
| ADR-05 | Redis 단일 인스턴스 · volatile-lru · TTL 유무로 축출 대상 구분 | architecture §8 · tech_stack §5.3 | 05/05 · 05/06 |
| ADR-06 | 모듈 경계는 Redis Stream — 같은 프로세스여도 예외 없음 | architecture §1 · §9 | 04/02 |
| ADR-07 | 실시간 팬아웃은 Redis Pub/Sub 경계 유지 | architecture §8.2 · data_flow §9 | 04/02 · 06/05 |
| ADR-08 | 역할 스위치는 DI 포트 · 구현 둘(런타임 분기 금지) | implementation_plan §4.3 | 04/02 · 02_features/13 |
| ADR-09 | 배치 적재 읽기 · 삽입 분리(단일 flusher fan-in) — 보정 7.1 | implementation_plan §7.1 | 06/03 · 04/05 |
| ADR-10 | 최신값 갱신 주체 — 잠정안 + 교체 가능한 포트 · 최종은 S6 실측 — 보정 7.2 | implementation_plan §7.2 | 04/06 · 06/05 |
| ADR-11 | 알람 판정은 배치 단위 상태 조회 · Ingest 직접 호출은 경계 예외 — 보정 7.3 | implementation_plan §7.3 | 04/02 · 06/08 |
| ADR-12 | 캐시 무효화 체인 6단(BFF · 브라우저 포함) — 보정 7.4 | implementation_plan §7.4 | 06/07 |
| ADR-13 | TTL 강제는 린트가 아니라 키 계열별 래퍼 — 보정 7.5 | implementation_plan §7.5 | 05/05 |
| ADR-14 | 적재 멱등은 insert_deduplication_token(ReplacingMergeTree 미채택) | architecture §7.1 | 05/03 · 06/03 |
| ADR-15 | tag_raw 롱 포맷 · 일자 파티션 · 정렬 키(device_id · tag_id · ts) | architecture §7.1 | 05/03 |
| ADR-16 | 마스터 연동은 ClickHouse Dictionary(PostgreSQL 소스) · 두 DB를 트랜잭션으로 묶지 않는다 | architecture §7.4 · §12 | 05/07 |
| ADR-17 | PostgreSQL 대조군 동형 테이블 · SW-09 동시 적재 | docs_plan 학습 목표 1 · D-05 | 05/10 · 06/04 |
| ADR-18 | named volume · 호스트 포트 127.0.0.1 바인드 | architecture §3 · tech_stack §10.3 · §10.4 | 04/03 · 12_security/05 |
| ADR-19 | PostgreSQL 커넥션은 api in-process 풀 · PgBouncer 유예 | architecture §6 · tech_stack §5.1 · §13 | 05/02 · 04/08 |
| ADR-20 | 관측 스택은 선택 프로파일 · 스크레이프 창구는 /metrics 하나 | architecture §14 · tech_stack §9 · §13 | 10_observability/01 · 09_tech_stack/03 |
| ADR-21 | 백프레셔 1차 신호는 애플리케이션 XLEN 검사 · MAXLEN을 maxmemory보다 먼저 건다 | architecture §9.3 · data_flow §12.1 | 04/06 · 05/06 |

검산: 선점 ADR-01~ADR-21 = **21**(결번 없음). 주제별 분류는 [09_decision_records.md](./09_decision_records.md)가 정한다

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 실행 구성 | 컨테이너 **4개**(api 1 + 저장소 3) + 호스트 웹 · 관측 스택은 선택 프로파일 |
| 분기 계층 | **3계층** — ① 원시값 → ClickHouse 전용 ② 알람 · 실적 → 세 저장소로 갈라짐 ③ 업무 CRUD → PostgreSQL 전용 |
| 백프레셔 | **5단계**(정상 · 주의 · 경고 · 위험 · 복구). 임계는 2계층 조정값이며 프로파일별 값의 정본은 [06_backpressure_failure.md](./06_backpressure_failure.md) |
| 용량 티어 | **4개**(S · M · M+ · L) |
| 확장 단계 | **4단계**(역할 분리 · api 다중 인스턴스 · Redis 분리 · 큐 교체). 각 단계는 실측 진입 조건으로만 진입한다 |
| 기술 결정 | ADR-NN — 채번 정본 [09_decision_records.md](./09_decision_records.md). 수치는 W3 채번 후 올린다 |
| 보정 결정 | 원본 implementation_plan §7의 보정 5건(배치 트리거 · 최신값 소유 · 알람 조회 상한 · 무효화 체인 · TTL 강제)은 ADR로 결정을 고정하고 각 정본에 반영한다 |

## 관련 문서

- [../README.md](../README.md) — 전역 불변식
- [../05_data_stores/README.md](../05_data_stores/README.md) — 저장소별 스키마와 키
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 분기 기전 정본
- [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) — 기술 선정 근거
