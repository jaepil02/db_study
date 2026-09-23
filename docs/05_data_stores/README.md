# 05_data_stores — 저장소

> **대상**: db_study의 저장소 세 종 — PostgreSQL 업무 테이블 · ClickHouse 시계열 테이블과 롤업 · Redis 키 공간과 메모리 · 저장소 간 정합성 · 수명 주기 · 마이그레이션 · PostgreSQL 대조군
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(테이블 · 객체 · 영역 접두 수) · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)(분기 정책) · 원본 architecture.md §6~§8 · §10.1 · §12 · 원본 tech_stack.md §5 · 원본 data_flow.md §10 · §13 · 원본 implementation_plan.md §2.3 · §7.5(커밋 ff66a37) · docs_plan 학습 목표 1(대조군 설계)

"데이터가 어디에 어떤 모양으로 앉는가"에 답하는 폴더다. **테이블명 · 컬럼명 · Redis 키 패턴을 채번**한다. 무엇이 어디로 가는지의 정책은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)가 정하고, 이 폴더는 그 결정이 실제로 앉는 모양을 정한다.

**학습 목표 ①의 설계 정본이 이 폴더에 있다.** [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)가 PostgreSQL 대조군(동형 테이블 · 동일 쿼리 5종 · 비교 축 6)을 설계하고, 측정 실행은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP가 소유한다. 설계(왜 · 무엇을)와 실행(어떻게 · 결과)을 가른다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_postgresql_schema.md](./01_postgresql_schema.md) | 업무 테이블 14 명세 — 컬럼 · 타입 · 설계 결정 · 튜닝 파라미터 · tag_master_history 신설 | architecture §6 · §12 · tech_stack §5.1 | W3 |
| [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 제약 · 인덱스 · 월 파티션 · 커넥션 · **한계 등재(어느 계층도 강제하지 않는 것)** | architecture §6 설계 결정 · data_flow §4.2 순서 보장 | W3 |
| [03_clickhouse_schema.md](./03_clickhouse_schema.md) | tag_raw · alarm_eval · 코덱 · 파티션 · 정렬 키 · 중복 제거 · 서버 설정 | architecture §7.1 · §7.3 · §7.5 · tech_stack §5.2 | W3 |
| [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) | tag_1m · tag_1h · tag_1d · MV 캐스케이드 · -State/-Merge 조합자 · MV 제약 · 백필 절차 | architecture §7.2 · data_flow §10 | W3 |
| [05_redis_keyspace.md](./05_redis_keyspace.md) | ★ 키 계열 · 영역 접두 9 · TTL 정책 · 네이밍 · 실패 전략 · Pub/Sub 채널 · **봉인 표** · 키 계열별 래퍼 강제 | architecture §8 · §8.1~§8.3 · §10.1 · tech_stack §5.3 · implementation_plan §7.5 | W3 |
| [06_redis_memory.md](./06_redis_memory.md) | ★ 엔트리 단위 설계 · maxmemory 산정 · volatile-lru · **축출 연쇄** · 프로파일별 산정(중간 프로파일 포함) | architecture §8.4 · implementation_plan §2.3 | W3 |
| [07_cross_store_consistency.md](./07_cross_store_consistency.md) | Dictionary · tag_id 불변 · 논리 삭제 · 스케일 변경 · 즉시 반영 · 두 DB를 묶지 않는 원칙 | architecture §7.4 · §12 | W3 |
| [08_retention_lifecycle.md](./08_retention_lifecycle.md) | **보존 조정값의 정본** — 단계별 보존 · 삭제 방식 · 복구 가능성 · 파티션 단위 변경 원칙 | data_flow §13 | W3 |
| [09_migrations_seed.md](./09_migrations_seed.md) | PostgreSQL 마이그레이션 · ClickHouse DDL 순번 · 시드 · 스냅샷과의 관계 | tech_stack §10.5 · §11 | W3 |
| [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | ★★ **PostgreSQL 대조군 설계 정본(학습 목표 ①)** — plc_tag_raw_control · SW-09 동시 적재 · 동일 쿼리 5종 · 비교 축 6 · 역전 지점 탐색 | 신설(docs_plan 학습 목표 1) · tech_stack §5.1 "왜 여기에 시계열을 넣지 않나" | W3 |
| [erd.md](./erd.md) | 번호 없음 · 전역 ERD(PostgreSQL erDiagram + ClickHouse 객체 관계) | architecture §6 | W3 |

검산: 번호 문서 10 + erd 1 + README 1 = **12**. 07~10은 횡단 예약 대역이다 — 타 폴더의 인바운드 링크가 이 번호에 고정된다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| PostgreSQL | 업무 **14** + 대조군 **1** = **15** 테이블 |
| ClickHouse | 테이블 **5** · MV **3** · Dictionary **1** |
| Redis | 단일 인스턴스 · volatile-lru · 영역 접두 **9**(봉인 3 + 캐시 5 + 채널 1) |
| 보존 · TTL · MAXLEN | 2계층 조정값 — 보존 정본 [08_retention_lifecycle.md](./08_retention_lifecycle.md) · 키별 TTL 정본 [05_redis_keyspace.md](./05_redis_keyspace.md) · MAXLEN과 메모리 정본 [06_redis_memory.md](./06_redis_memory.md) |
| 도메인 공백 | **SIM · GEN은 테이블이 없다** — 시뮬레이터 레지스터와 생성 벡터는 메모리 상태이며 산출물은 수집 경로를 거쳐 tag_raw에 앉는다. 시드 고정 설정은 테이블이 아니라 실행 인자다 |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 분기 정책 정본
- [../06_pipeline/README.md](../06_pipeline/README.md) — 데이터가 저장소에 닿는 흐름
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 · 단위 의미론
