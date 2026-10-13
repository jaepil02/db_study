# 05_data_stores — 저장소

> **대상**: db_study의 저장소 세 종 — PostgreSQL 업무 테이블 · ClickHouse 시계열 테이블과 롤업 · Redis 키 공간과 메모리 · 저장소 간 정합성 · 수명 주기 · 마이그레이션 · PostgreSQL 대조군
> **작성일**: 2026-09-23
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — 파일 목차 09 행 순번에 말미 009 · 10 행 지금 모양에 TimescaleDB hypertable · 열 압축 · 고정 기준 축약 PostgreSQL 세는 기준에 hypertable 칸과 압축 표 제외 — 테이블 · 함수 수 불변(비교 사본 함수는 준비 함수가 빠지고 압축 함수가 더해졌다)
> **개정일**: 2026-10-11 — 웨이브 6 코드 수정 반영 — 고정 기준 축약 한계 등재 채번 29 → **30**행(현행 18 → **19** · 정본 02 #30 지우기 잠금의 범위)
> **개정일**: 2026-10-11 — **D-16 웨이브 2 저장소 반영**(사용자 결정 2026-10-11) — 고정 기준 축약 PostgreSQL 8 → **9**(실행 보관 run_result) · FK 6 → **7** · 다중 컬럼 PK **1** · 결합 CHECK 4 → **5** · 인덱스 2 → **3** · 한계 등재 27 → **29**(현행 18) · Redis 접두 6 → **7**(ctl) · 활성 키 16 → **18** · 통제 칸 23 → **27** · 소유 테이블 없는 도메인 6 → **5**(GEN이 run_result 소유) · 파일 목차 01 · 05 · 09 · 10 설명
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — 고정 기준 축약 PostgreSQL 업무 15 → **7** · 합 16 → **8** · FK 15 → **6** · UNIQUE 9 → **6** · 결합 CHECK 8 → **4** · 인덱스 9 → **2** · 한계 등재 27행 → **현행 16 · 결번 11** · ClickHouse 테이블 8 → **4** · 객체 12 → **8** · Redis 영역 접두 10 → **6** · 활성 키 패턴 24 → **16** · 통제 칸 32 → **23** · 파일 목차 01 · 02 · 03 · 05 · 09 · 10 행 · 도메인 공백의 GEN 모드 D 문장 삭제 — 루트 고정 기준 갱신은 리드
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 한계 등재 26 → **27**행(정본 02 #27 시연 전용 행) — 루트 고정 기준 갱신은 리드
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27 · 사용자 요구 2026-09-28) — 고정 기준 축약에 시간대 행 신설(DB 처리 UTC · 달력 의미 경계 KST 명시) · 파일 목차 03 · 09 행에 시각 컬럼 UTC · DB 시간대 전환 — 테이블 · 객체 수 불변
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(f-biz) — 한계 등재 25 → **26**행(#26 failed는 적용 여부 미확정) · 활성 키 패턴 23 → **24**(lock:biz:writer) · 통제 칸 31 → **32**
> **개정일**: 2026-09-28 — 흐름 이벤트 반영 — Redis 축약 활성 키 패턴 21 → **23**(ch:flow · cache:flow:subscribed) · 통제 칸 30 → **31**
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — 고정 기준 축약 PostgreSQL 업무 14 → **15**(biz_command_log) · 합 15 → **16** · UNIQUE 8 → **9** · 한계 등재 23 → **25**행 · Redis 영역 접두 9 → **10**(biz · 캐시 6) · 활성 키 패턴 18 → **21** · 봉인 표 통제 칸 26 → **30** · 파일 목차 01 · 05 행 — 루트 고정 기준 갱신은 리드
> **개정일**: 2026-09-27 — W6 반영 — 한계 등재 22 → **23**행(정본 02 #23 · ClickHouse 업무 대조 CHECK는 INSERT 경로만 · 기록 043)
> **개정일**: 2026-09-26 — W3 반영 — 한계 등재 19 → **22**행(정본 02 #20~#22)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 고정 기준 축약 ClickHouse 테이블 5 → **8**(목적지 5 + 업무 대조 계측물 3) · 객체 **12** 검산 · 파일 목차 03 · 10 행에 업무 대조 테이블 · 역방향 대조 · 스트리밍 동시 적재
> **원천**: D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · [../README.md](../README.md)(테이블 · 객체 · 영역 접두 수) · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)(분기 정책) · 원본 architecture.md §6~§8 · §10.1 · §12 · 원본 tech_stack.md §5 · 원본 data_flow.md §10 · §13 · 원본 implementation_plan.md §2.3 · §7.5(커밋 ff66a37) · docs_plan 학습 목표 1(대조군 설계)

"데이터가 어디에 어떤 모양으로 앉는가"에 답하는 폴더다. **테이블명 · 컬럼명 · Redis 키 패턴을 채번**한다. 무엇이 어디로 가는지의 정책은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)가 정하고, 이 폴더는 그 결정이 실제로 앉는 모양을 정한다.

**학습 목표 ①의 설계 정본이 이 폴더에 있다.** [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)가 PostgreSQL 대조군(동형 테이블 · 동일 쿼리 5종 · 비교 축 6)을 설계하고, 측정 실행은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP가 소유한다. 설계(왜 · 무엇을)와 실행(어떻게 · 결과)을 가른다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_postgresql_schema.md](./01_postgresql_schema.md) | 업무 테이블 7 · 실행 보관 1 명세 — 컬럼 · 타입 · 설계 결정 · 튜닝 파라미터 · tag_master_history 신설 · biz_command_log(업무 명령 멱등 원장) 신설 · **run_result(직접 비교 결과 보관) · tag_kind(D-16)** | architecture §6 · §12 · tech_stack §5.1 | W3 |
| [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 제약 · 인덱스 · 커넥션 · **한계 등재(어느 계층도 강제하지 않는 것)** | architecture §6 설계 결정 · data_flow §4.2 순서 보장 | W3 |
| [03_clickhouse_schema.md](./03_clickhouse_schema.md) | tag_raw · 코덱 · 파티션 · 정렬 키 · 중복 제거 · 서버 설정 · 시각 컬럼 시간대 UTC(ADR-27) | architecture §7.1 · §7.3 · §7.5 · tech_stack §5.2 | W3 |
| [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) | tag_1m · tag_1h · tag_1d · MV 캐스케이드 · -State/-Merge 조합자 · MV 제약 · 백필 절차 | architecture §7.2 · data_flow §10 | W3 |
| [05_redis_keyspace.md](./05_redis_keyspace.md) | ★ 키 계열 · 영역 접두 7(ctl — 설비 가동 · D-16) · 동시 적재 게이트 cache:dual:active · 업무 명령 키(stream:biz:cmd · biz:result · ch:bizreply) · TTL 정책 · 네이밍 · 실패 전략 · Pub/Sub 채널 · **봉인 표** · 키 계열별 래퍼 강제 | architecture §8 · §8.1~§8.3 · §10.1 · tech_stack §5.3 · implementation_plan §7.5 | W3 |
| [06_redis_memory.md](./06_redis_memory.md) | ★ 엔트리 단위 설계 · maxmemory 산정 · volatile-lru · **축출 연쇄** · 프로파일별 산정(중간 프로파일 포함) | architecture §8.4 · implementation_plan §2.3 | W3 |
| [07_cross_store_consistency.md](./07_cross_store_consistency.md) | Dictionary · tag_id 불변 · 논리 삭제 · 스케일 변경 · 즉시 반영 · 두 DB를 묶지 않는 원칙 | architecture §7.4 · §12 | W3 |
| [08_retention_lifecycle.md](./08_retention_lifecycle.md) | **보존 조정값의 정본** — 단계별 보존 · 삭제 방식 · 복구 가능성 · 파티션 단위 변경 원칙 | data_flow §13 | W3 |
| [09_migrations_seed.md](./09_migrations_seed.md) | PostgreSQL 마이그레이션(D-16 새 기준선 001~008 · 말미 009 비교 사본 TimescaleDB — ADR-32) · ClickHouse DDL 순번(001~007) · 시드(S2 슬라이스 · **카드 라인 — 로컬 기본**) · DB 시간대 기준선(ADR-27) | tech_stack §10.5 · §11 | W3 |
| [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | ★★ **PostgreSQL 대조군 · 비교 사본 설계 정본(학습 목표 ①)** — 지금 모양(직접 비교 · 기본 키 · 설비 참조 · 값 규칙 · SW-09 gated — D-16 · **TimescaleDB hypertable · 열 압축** — D-05 부분 개정 · ADR-32) · 옛 plc_tag_raw_control · SW-09 동시 적재 · 동일 쿼리 5종 · 비교 축 6 · 폐지된 실험 설계(D-16 — 격자 · 스트리밍 동시 적재 · 역방향 대조) · 결과(역전 구간 · 역방향 대조표) | 신설(docs_plan 학습 목표 1) · tech_stack §5.1 "왜 여기에 시계열을 넣지 않나" | W3 |
| [erd.md](./erd.md) | 번호 없음 · 전역 ERD(PostgreSQL erDiagram + ClickHouse 객체 관계) | architecture §6 | W3 |

검산: 번호 문서 10 + erd 1 + README 1 = **12**. 07~10은 횡단 예약 대역이다 — 타 폴더의 인바운드 링크가 이 번호에 고정된다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| PostgreSQL | 업무 **7** + 대조군 **1** + 실행 보관 **1** = **9** 테이블(부모 테이블 기준 — 도구 관리 테이블 · 자식 파티션 · hypertable 칸과 압축 표 제외) · FK 7 · UNIQUE 6 · 다중 컬럼 PK 1 · 결합 CHECK 5 · 인덱스 3 · 비교 사본 함수 4(SECURITY DEFINER 3) · 한계 등재 채번 **30**행(현행 **19** · 결번 11) |
| ClickHouse | 테이블 **4**(tag_raw · tag_1m · tag_1h · tag_1d) · MV **3** · Dictionary **1** · 검산: 4 + 3 + 1 = **8** |
| Redis | 단일 인스턴스 · volatile-lru · 영역 접두 **7**(봉인 3 + 캐시 3 + 채널 1 · biz는 업무 명령 결과 · ctl은 실행 중 제어 상태) · 활성 키 패턴 **18** · 봉인 표 통제 칸 **27** |
| 시간대 | DB 처리 시간대 **UTC**(PostgreSQL DB 기본 · ClickHouse 서버 · 시각 컬럼 인자) · 파티션 · TTL 경계 UTC · 달력 의미 경계만 KST 명시(닫힌 목록 정본 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)) — ADR-27 |
| 보존 · TTL · MAXLEN | 2계층 조정값 — 보존 정본 [08_retention_lifecycle.md](./08_retention_lifecycle.md) · 키별 TTL 정본 [05_redis_keyspace.md](./05_redis_keyspace.md) · MAXLEN과 메모리 정본 [06_redis_memory.md](./06_redis_memory.md) |
| 도메인 공백 | 세는 기준은 **소유 테이블**이다. 소유 테이블 없음 **5** — COL · SIM · TSQ · RLT · OBS. SIM의 레지스터는 메모리 상태이고 시드는 실행 인자다 · GEN은 직접 비교의 실행 보관 run_result 하나를 소유한다(D-16 — 생성 벡터는 여전히 메모리). TSQ · RLT는 읽기만 하고 COL은 Stream까지만 쓰며 OBS는 저장소 카탈로그를 읽는다. 롤업 테이블 · MV는 **ING 귀속**이다(W3 확정 — [04_clickhouse_rollup.md](./04_clickhouse_rollup.md)) |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 분기 정책 정본
- [../06_pipeline/README.md](../06_pipeline/README.md) — 데이터가 저장소에 닿는 흐름
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 · 단위 의미론
