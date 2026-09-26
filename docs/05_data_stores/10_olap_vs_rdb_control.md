# PostgreSQL 대조군 (10_olap_vs_rdb_control)

> **대상**: 학습 목표 ① 설계 정본 — PostgreSQL 대조군 plc_tag_raw_control의 tag_raw 동형 설계(BRIN · 일자 파티션) · SW-09 동시 적재 · 삽입 실패 의미론과 멱등 수단 판정 · 동일 쿼리 5종(양쪽 SQL) · 비교 축 6 · 역전 지점 탐색 설계(행 수 격자) · 측정 조건 · EXP-01~05 예약 대역 연결 · **스트리밍 동시 적재 EXP-45 · 역방향 대조(업무 워크로드를 ClickHouse에) EXP-40~44 설계**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-26 — 마지막 확인 반영 — reverse read 키를 EXP별 실제 라벨로(정본은 실행기)
> **개정일**: 2026-09-26 — 러너 재검수 반영 — EXP-43 ⓓ 입력 as-built(CH 같은 order_id · PG 같은 order_no) · reverse read 키 라벨 · EXP-43 MergeTree OPTIMIZE 명시 · after_wait 수렴 정의(미완 mutation 0만) · 수렴은 detail
> **개정일**: 2026-09-26 — 역방향 러너 보완 반영(as-built) — 머지 뒤 두 판독 라벨(after_wait · after_force) · 수렴 판정 = 강제 문장 성공 + mutation 완료(active patch 파트 수는 관측값) · EXP-40 호출 예산과 budget_exhausted
> **개정일**: 2026-09-26 — W3 코드 검수 반영(r-web-lab L3 · L4) — §스트리밍 동시 적재 — EXP-45 스위치 행 배치 안 현행 기본 → **배치 안 A만**(기록 조건) · 해설 불릿 2(편차 폐기 p50 · 판정 점 p95 · 안 B 보간 한계) — 항목 · 지표 수 불변
> **개정일**: 2026-09-26 — W1 재검수 반영 — 변형 설정 표에 async_insert 플러시 설정 행 신설(async_insert_busy_timeout_max_ms · async_insert_busy_timeout_min_ms · async_insert_use_adaptive_busy_timeout · async_insert_max_data_size — 서버 기본값과 쓴 값 원시) — 설정 행 9 → **10** · EXP-44 ⓑ wait 0 팔을 두지 않는 이유 불릿 · EXP-43 UPDATE 경로 = **work_order_control**(경량 UPDATE · ALTER UPDATE · RMT는 INSERT 경로만) · 원천 줄에 공식 문서 삽입 재시도 중복 제거 · 비동기 삽입 세션 설정 · 실행기 조정값 행에 플러시 설정 값
> **개정일**: 2026-09-26 — W1 검수 반영 — 경량 UPDATE는 공식 문서상 **Beta**(세션 설정 enable_lightweight_update · 판독 apply_patch_parts — Beta 상태의 정본 자리를 이 문서 §역방향 대조 도입으로 둔다) · EXP-42 동시 완료를 update_parallel_mode auto(기본) · sync 두 팔로 · EXP-43 ⓓ에 중복 제거 윈도우 N + 토큰 변형 — ClickHouse 변형 11 → **12** · ⓐ 입력 동형(실행기가 서로 다른 order_id 발급)과 RMT가 order_no 중복을 합치지 않는 구조 사실 · 변형 설정 표 5 → **9**행 · 원리 대응 다문장 트랜잭션을 뺀 이유와 실패 시나리오 · 2계층 실행기 조정값에 EXP-44 커넥션 수 · 동시성
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — §스트리밍 동시 적재 — EXP-45 · §역방향 대조 — 업무 워크로드(EXP-40~44 · 업무 대조 테이블 3 · 업무 규모 격자 3 · 그래뉼 변형 판정 · 원리 대응 · 공정성 규칙 · 기계 판독 필드 제안) 신설 — 결과 절 없음(실측 뒤)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 동시 적재 기전 행 닫힘(06_pipeline/04 W4 판정)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(모드 D 대조군 동일 행 절차) — 테이블 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 격자 6단계 보존 판정 · 조정값 · EXP 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 대조 실험 자원 조건의 메모리 동일화 값 → ClickHouse 3.5 GB · PostgreSQL 3.5 GB(정본 09_tech_stack/04 · 합계 불변)
> **원천**: docs_plan.md 학습 목표 1(대조군 설계) · 웨이브 인계 W3 05/10 · W4 06/04 행(SW-09 삽입 실패 의미론 · PostgreSQL 멱등 수단) · 원본 tech_stack.md §5.1 "왜 여기에 시계열을 넣지 않나" · §5.2(커밋 ff66a37) · 원본 architecture.md §7.1 · §13 · §15(커밋 ff66a37) · 원본 data_flow.md §10.1 · §11.1 · §11.2(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §5 S5(커밋 ff66a37) · D-05 · D-10 · D-12 · ADR-17 · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 목표 ① · [../03_requirements/07_ingest.md](../03_requirements/07_ingest.md) REQ-ING-15 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 · 목적 적합성 실증 계획 W1(2026-09-26 · 역방향 대조 · EXP-40~45) · ClickHouse 공식 문서 UPDATE 문 · 업데이트 개요 · ReplacingMergeTree · 테이블 제약 · 삽입 재시도 중복 제거 · 비동기 삽입 세션 설정(26.8 · 2026-09-26 context7 대조 — ClickHouse 문서 행 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) · 대조 항목 추가는 그 문서 소유)

**학습 목표 ①은 "시계열을 왜 RDB가 아니라 컬럼형으로 다루는가"를 측정으로 아는 것이다**([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)). 원본에는 RDB 대조 실험이 아예 없었고, PostgreSQL에 시계열을 넣지 않는 이유는 타인의 벤치마크 범위로만 적혀 있었다(원본 tech_stack.md §5.1 · §5.2). 이 문서는 그 이유를 이 머신 · 이 스키마 · 이 쿼리에서 재는 **실험의 설계**다(D-05 · ADR-17).

**산출물은 승패가 아니라 쿼리별 역전 지점이다.** 100만 행에서는 PostgreSQL이 이길 수도 있다 — 인덱스 점조회와 짧은 범위 조회에서 행 기반 저장은 충분히 빠르고 ClickHouse는 파트 스캔의 고정 비용을 낸다. 몇 행부터 역전되는지(또는 관측 범위 안에서 역전이 없는지)가 결과이며, 그 값은 전부 **3계층 미확인**이다. 이 문서는 값을 예측하지 않는다.

**설계와 실행을 가른다.** 이 문서가 왜 · 무엇을(테이블 · 적재 · 쿼리 · 축 · 격자)을 갖고, 어떻게 · 결과는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP-01~05 예약 대역이 갖는다. 동시 적재의 기전은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md), 모드 D 구간의 같은 행 채우기 절차는 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)가 갖는다.

## 실험의 모양

| 항목 | 결정 | 이유 |
|------|------|------|
| 고정하는 것 | **데이터** — 같은 행 집합 | 행 집합이 다르면 두 저장소의 쿼리 결과 자체를 대조할 수 없다(D-05) |
| 바꾸는 것 | **저장소** — ClickHouse tag_raw 대 PostgreSQL plc_tag_raw_control | 목표 ②와 비교 방향이 반대다 — ②는 저장소를 고정하고 역할을 바꾼다 |
| 손잡이 | SW-09 CONTROL_TABLE_ENABLED · **기본 off** | on이 기본이면 모든 삽입 처리량 측정에 대조군 비용이 섞인다(조합 제약 #4) |
| 보조 손잡이 | SW-10 off 고정 | 데드밴드는 행 수 · 압축률을 바꾼다 — 대조 실험은 데드밴드 0으로만 |
| 쿼리 | 동일 쿼리 5종 | 쿼리 모양마다 역전 지점이 다르다 |
| 축 | 비교 축 6 | 쿼리 시간만 재면 PostgreSQL이 이기는 구간의 대가(디스크 · WAL)가 보이지 않는다 |
| 독립 변수 | 테이블 총 행 수(격자) | 역전은 행 수 축 위의 한 점이다 |
| 학습 단계 | S3 적재 구현 · S5 측정(D-12) | S5의 용량 단계 데이터를 부하 측정과 공유한다 |

- 검산: 항목 = **8** · 동일 쿼리 **5** · 비교 축 **6**
- **대조군은 중복 저장이 아니라 실험 계측물이다**(전역 불변식 저장소 책임 단일화). 분기 ①계층의 목적지는 ClickHouse뿐이며, 대조군은 분기 표에 행이 없다.

## plc_tag_raw_control — 동형 설계

tag_raw와 **같은 컬럼 · 같은 의미 · 같은 파티션 경계**를 갖되, 각 엔진이 자기 방식으로 가장 합당하게 저장하게 둔다. 동형은 "같은 논리 스키마"이지 "같은 물리 배치"가 아니다.

| 컬럼 | ClickHouse tag_raw | PostgreSQL 대조군 | 폭(바이트) CH · PG | 동형 판정 |
|------|------|------|------|------|
| ts | DateTime64(3, 'Asia/Seoul') | timestamptz NOT NULL | 8 · 8 | 같다 — 값은 epoch ms · PG 정밀도 μs가 ms 값을 정확히 담는다 |
| device_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 — 값 범위가 2^31 미만 |
| tag_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 |
| value | Float64 | double precision NOT NULL | 8 · 8 | 같다 — 비트 단위 동일 |
| quality | UInt8 | **smallint** NOT NULL | 1 · **2** | 다르다 — PostgreSQL에 1바이트 정수가 없다. 폭 차 1바이트를 기록한다 |
| scan_seq | UInt64 | bigint NOT NULL | 8 · 8 | 같다 — 값 범위가 2^63 미만 |
| ingested_at | DateTime64(3, 'Asia/Seoul') DEFAULT now64(3) | timestamptz NOT NULL DEFAULT now() | 8 · 8 | 같다 — 한 적재 단위의 행이 같은 값을 받는다(질의 · 트랜잭션 단위 1회 평가) |

- 검산: 컬럼 = **7** · 폭 합 CH 41 · PG 42 바이트 · 같은 폭 6 + 다른 폭 1
- **PostgreSQL 쪽 컬럼 순서는 정렬 여백이 없게 둔다.** 8바이트 4개(ts · value · scan_seq · ingested_at) → 4바이트 2개 → 2바이트 1개 순이면 행 안 여백이 0이다. 선언 순서대로(ts · device_id · tag_id · value …) 두면 quality 뒤에 6바이트 여백이 생겨 저장 용량 축이 PostgreSQL에 불리하게 부풀린다 — 동형은 논리 스키마의 동일이지 선언 순서의 동일이 아니다.
- **ingested_at은 대조군 쪽에서 삽입 트랜잭션 시각이다.** 두 저장소의 ingested_at은 서로 다른 시계 시점을 가리키므로 E2E 지연 비교에 쓰지 않는다 — 삽입 처리량 축은 적재 계측(§비교 축 6)으로 잰다.

아래는 대조군 DDL 계약이다(설계 계약 · 구현 코드 아님). 적용 순번은 [09_migrations_seed.md](./09_migrations_seed.md) 007이다.

```sql
CREATE TABLE plc_tag_raw_control
(
    ts          timestamptz      NOT NULL,
    value       double precision NOT NULL,
    scan_seq    bigint           NOT NULL,
    ingested_at timestamptz      NOT NULL DEFAULT now(),
    device_id   integer          NOT NULL,
    tag_id      integer          NOT NULL,
    quality     smallint         NOT NULL
) PARTITION BY RANGE (ts);                       -- 일자 파티션 · 경계 Asia/Seoul 자정 · pg_partman 관리

CREATE INDEX plc_tag_raw_control_ts_brin
    ON plc_tag_raw_control USING brin (ts);       -- 인덱스 변형 I1(기본)

-- 인덱스 변형 I2에서만 추가:
-- CREATE INDEX plc_tag_raw_control_key_btree ON plc_tag_raw_control (device_id, tag_id, ts);
```

- **PK · UNIQUE · FK를 두지 않는다.** tag_raw는 기본 키 유일성 · 참조 검사를 하지 않는다. 대조군에만 두면 삽입 처리량 · 인덱스 크기 축이 두 엔진의 차가 아니라 제약 비용의 차를 잰다 — 멱등을 유일 제약으로 풀지 않는 이유와 같다(§삽입 실패 의미론).
- **파티션 경계는 tag_raw의 toYYYYMMDD(ts)와 같은 KST 자정이다.** DB 기본 timezone이 Asia/Seoul이라 pg_partman이 같은 경계로 만든다([02_postgresql_constraints.md](./02_postgresql_constraints.md)). 경계가 다르면 보존 · 쿼리 창의 경계 행이 한쪽에만 있다.
- 보존은 tag_raw와 같은 기간이다 — 정본 [08_retention_lifecycle.md](./08_retention_lifecycle.md) §대조군 보존 정합.

## 인덱스 변형

docs_plan의 설계 정본은 **BRIN · 일자 파티션**이다. BRIN은 블록 범위별 최소 · 최대만 기록해 추가 전용 시계열에서 크기가 작지만, ts 외 조건(device_id · tag_id)으로는 가지치기를 못 한다. 그래서 인덱스를 실험 변수로 둔다.

| 변형 | 인덱스 | 단일 태그 조회의 경로 | 쓰는 축 | 지위 |
|------|------|------|------|------|
| I1 | BRIN(ts) | ts 범위 블록을 읽고 device_id · tag_id를 행마다 거른다 | 전 축 | **기본 — docs_plan 설계** |
| I2 | I1 + btree(device_id, tag_id, ts) | 인덱스로 태그 행만 찾는다 | 쿼리 시간 · 인덱스 크기 · 삽입 처리량 · WAL | 변형 — 행 기반 RDB가 시계열에 거는 표준 인덱스 |

- 검산: 변형 = **2**
- **I1만 재면 PostgreSQL을 허수아비로 만든다(A형).** 통념은 "BRIN이 시계열 인덱스의 정답"이다. 그러나 1만 태그가 섞여 들어오는 행 순서에서 BRIN(ts)은 단일 태그 조회를 ts 범위 전체 스캔으로 만든다 — 단일 태그 1시간(Q1)에서 PostgreSQL이 지는 이유가 엔진이 아니라 인덱스 선택이 된다. 진짜 축은 "인덱스 비용을 내고 조회를 사는가"다. 대체 경로 — I2를 함께 재어 btree가 산 조회 시간과 그 대가(인덱스 크기 · 삽입 · WAL)를 한 표에 둔다.
- 변형은 측정 조건이다 — 모든 기록에 I1 · I2를 적는다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)).

## SW-09 동시 적재

같은 배치를 두 저장소에 싣는 순서다. 기전의 정본은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4)이며, 이 문서는 저장소 쪽 계약을 고정한다.

```plain
① 배치 확정              단일 flusher가 결정적 토큰으로 묶는다              ADR-09 · REQ-ING-06
② ClickHouse 삽입        재시도 · 같은 토큰 · 소진 시 DLQ                    REQ-ING-08
③ 대조군 삽입            ②가 성공한 배치만 · 1회 시도 · 트랜잭션 1개(COPY)  이 문서 판정
④ XACK                   ③의 성패와 무관                                   REQ-ING-15
⑤ 최신값 · 알람 전달     ④ 뒤                                              REQ-ING-07
```

- **③은 ②의 재시도 루프 밖에 있다.** ClickHouse 재시도가 몇 번 돌든 대조군 삽입은 확정된 배치당 한 번이다 — 재시도 루프 안에 두면 ClickHouse 쪽 재시도마다 대조군에 같은 행이 쌓인다.
- **③은 COPY 한 번 · 트랜잭션 하나다.** 트랜잭션이면 실패한 배치가 대조군에 부분만 남지 않는다. COPY는 PostgreSQL이 낼 수 있는 가장 빠른 표준 적재 경로다 — 행 단위 INSERT로 재면 PostgreSQL의 한계가 아니라 클라이언트 왕복을 잰다.
- **대조군 삽입은 업무 풀이 아니라 전용 커넥션을 쓴다**([02_postgresql_constraints.md](./02_postgresql_constraints.md) §커넥션) — COPY가 업무 CRUD 풀을 점유하지 않는다.
- 모드 D(ClickHouse 직접 백필) 구간은 ING를 거치지 않으므로 SW-09가 적용되지 않는다. 그 구간은 GEN-10이 같은 시드 · 같은 구간 · 같은 태그로 대조군을 채운다([../02_features/05_datagen.md](../02_features/05_datagen.md)).

## 삽입 실패 의미론 · 멱등 수단 판정

웨이브 인계 "SW-09 대조군 삽입 실패 의미론과 PostgreSQL 쪽 멱등 수단"을 닫는다. 요구 수준은 REQ-ING-15가 이미 판정했다 — **XACK를 막지 않는다 · 실패 계수 · 구간 무효 · 대조군 재시도가 중복을 만들지 않는다.** 이 절은 그 요구를 만족하는 저장소 쪽 수단을 고른다.

| 사건 | 대조군 상태 | 수단 | REQ-ING-15 대조 |
|------|------|------|------|
| 대조군 COPY 실패(PostgreSQL 불가 · 제약 오류) | 그 배치 행 0 — 트랜잭션 롤백 | **재시도하지 않는다** · 대조군 실패 계수 + 실패 배치의 ts 범위 기록 | XACK 계속 · 실패 계수 · 구간 무효 ✔ |
| ClickHouse 재시도 | 대조군은 아직 쓰이지 않았다 | ③이 ② 성공 뒤에만 돈다 | 재시도가 대조군에 중복을 만들지 않는다 ✔ |
| ② 성공 · ③ 성공 뒤 XACK 전 크래시 | 배치가 대조군에 있다 | 재전달 시 ClickHouse는 토큰으로 무시 · 대조군은 **한 번 더 들어간다** | 재전달 중복 — DB 제약으로 막지 않는다 · 구간 count 대조로 **검출** · 구간 무효 |
| ② 성공 · ③ 전 크래시 | 배치가 대조군에 없다 | 재전달 시 ②는 무시 · ③이 이번에 쓴다 | 결과적으로 정합 |

- 검산: 사건 = **4** · 대조군이 어긋날 수 있는 사건 2(COPY 실패 · XACK 전 크래시) — 둘 다 구간 count 대조가 드러낸다
- **판정: 대조군의 멱등 수단은 "재시도 없음 + 확정 뒤 1회 + 구간 count 검출"이다.** 재전달 창(③과 ④ 사이의 크래시)의 중복은 막지 않고 드러낸다. 드러난 구간은 대조 실험에서 빼거나 일 파티션 단위로 다시 채운다.

버린 대안은 전부 **비교 축 하나를 오염시킨다.**

| 버린 대안 | 막는 것 | 오염되는 비교 축 | 실패의 구체적 모양 |
|------|------|------|------|
| ① UNIQUE(device_id, tag_id, ts) + ON CONFLICT DO NOTHING | 재전달 중복까지 | 삽입 처리량 · 인덱스 크기 · WAL | 모든 행이 유일 btree 검사를 지나 I1(BRIN만)의 삽입 수치가 사라진다 — ClickHouse에 없는 비용이 PostgreSQL 쪽에만 붙는다 |
| ② 배치 토큰 원장 테이블 | 재전달 중복 | 테이블 수 · 삽입 경로 | PostgreSQL 테이블 수 고정 기준(업무 14 + 대조군 1)이 바뀌고 배치마다 원장 쓰기 · 조회가 더해진다 |
| ③ 대조군 재시도 + 사후 중복 제거(DELETE) | 일시 실패의 누락 | VACUUM/WAL 증폭 | 사후 DELETE가 죽은 튜플과 WAL을 만들어 증폭 축이 적재 비용이 아니라 정리 비용을 잰다 |
| ④ 대조군 실패 시 XACK 보류 | 누락 | 목표 ② 전체 | PostgreSQL 지연이 수집 경로의 백프레셔가 된다 — REQ-ING-15가 이미 기각 |

- 검산: 버린 대안 = **4**
- **재전달 창은 좁고 드러난다(B형).** 결론 — 크래시가 ③과 ④ 사이에 떨어진 배치만 중복된다. 반대 시나리오 — 이를 막으려 유일 제약을 걸면 대조 실험의 핵심 축 셋이 오염되어 실험 전체가 무의미해진다. 파생 지침 — 대조 실험 직전에 구간 count 정확 일치를 확인하고(REQ-NFR-18), 어긋난 구간은 무효로 표시한다. 이 잔여는 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) #5다.
- 무효 구간은 저장소에 표로 두지 않는다(테이블 수 고정). 실패 계수 · 실패 배치의 ts 범위는 계측으로, 무효 판정은 측정 기록으로 남는다 — 기록 형식 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) · 메트릭 이름 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md).

## 동일 쿼리 5종

쿼리 모양마다 역전 지점이 다르다. 창(1시간 · 7일 · 1일)은 **데이터 끝 시각 기준**이며, 테이블이 창보다 짧으면 쿼리가 테이블 전부를 읽는다 — 행 수 격자의 작은 단계에서 의도된 동작이다.

| 쿼리 | 모양 | 읽는 행 | 결과 대조 | 원천 |
|------|------|------|------|------|
| Q1 단일 태그 1시간 | 한 태그의 원시 점 · ts 정렬 | 태그 1 × 1시간 | 행 수 · 값 정확 일치 | 조회 해상도 raw의 실제 경로 |
| Q2 단일 태그 7일 | 한 태그의 시간 버킷 avg · min · max · count(원시에서) | 태그 1 × 7일 | count · min · max 정확 · avg 오차 허용 | 롤업 없이 원시로 긴 범위 |
| Q3 설비 전체 1일 | 한 설비 모든 태그의 태그별 avg · min · max · count | 설비 1 × 1일 | 상동 | 설비 대시보드 |
| Q4 분 단위 롤업 재계산 | 전 설비 1시간의 분 × 태그 count · avg · min · max · bad_cnt | 전체 × 1시간 | 상동 · bad_cnt 정확 | mv_tag_1m의 일을 조회로 |
| Q5 전체 스캔 count | 비정렬 컬럼 조건의 전 행 count | 전체 | count 정확 | 컬럼형의 열 단위 읽기 |

- 검산: 쿼리 = Q1 · Q2 · Q3 · Q4 · Q5 = **5**
- **Q4는 last · p95를 뺀다.** PostgreSQL에는 argMax가 없고 분위수 근사가 다르다 — 흉내 쿼리를 넣으면 엔진이 아니라 흉내의 비용을 잰다. 두 저장소가 같은 뜻으로 계산하는 집계만 쓴다.
- **Q5는 조건 없는 count를 쓰지 않는다(A형).** 통념은 "count(*)가 전체 스캔의 대표"다. 그러나 ClickHouse는 조건 없는 count()를 파트 메타데이터에서 답해 데이터를 읽지 않는다. 진짜 축은 "열 하나를 끝까지 읽는 비용"이다. 대체 경로 — 정렬 키 밖 컬럼(value) 조건으로 모든 행을 읽게 하고, 조건 없는 count는 보조 관찰로만 기록한다.

아래는 양쪽 SQL이다. 매개변수는 {device} · {tag} · {end}(데이터 끝 시각) · {v}(Q5 문턱)이며 두 쪽이 같은 값을 받는다 — PostgreSQL 쪽 $이름은 바인딩 자리표시다.

```sql
-- Q1 단일 태그 1시간
-- ClickHouse
SELECT ts, value, quality FROM plc.tag_raw
WHERE device_id = {device} AND tag_id = {tag} AND ts >= {end} - INTERVAL 1 HOUR AND ts < {end}
ORDER BY ts;
-- PostgreSQL
SELECT ts, value, quality FROM plc_tag_raw_control
WHERE device_id = $device AND tag_id = $tag AND ts >= $end - interval '1 hour' AND ts < $end
ORDER BY ts;

-- Q2 단일 태그 7일 · 시간 버킷
-- ClickHouse
SELECT toStartOfHour(ts) AS b, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {device} AND tag_id = {tag} AND ts >= {end} - INTERVAL 7 DAY AND ts < {end}
GROUP BY b ORDER BY b;
-- PostgreSQL
SELECT date_trunc('hour', ts) AS b, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $device AND tag_id = $tag AND ts >= $end - interval '7 days' AND ts < $end
GROUP BY b ORDER BY b;

-- Q3 설비 전체 1일 · 태그별
-- ClickHouse
SELECT tag_id, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {device} AND ts >= {end} - INTERVAL 1 DAY AND ts < {end}
GROUP BY tag_id;
-- PostgreSQL
SELECT tag_id, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $device AND ts >= $end - interval '1 day' AND ts < $end
GROUP BY tag_id;
```

- **시간 버킷 함수는 두 엔진에서 같은 경계를 낸다.** 시 · 분 버킷은 +09:00 정수 오프셋에서 시간대와 무관하다. 일 버킷을 쓰는 쿼리는 두지 않았다 — date_trunc('day')는 세션 시간대, toStartOfDay는 컬럼 시간대를 따라 설정 하나로 경계가 갈린다.
- **창 끝 {end}는 두 저장소 모두에 온전히 남은 구간 안이어야 한다.** 보존 경계의 파티션은 한쪽에만 행이 있을 수 있다([08_retention_lifecycle.md](./08_retention_lifecycle.md) §대조군 보존 정합).

나머지 두 쿼리 Q4 · Q5의 양쪽 SQL이다.

```sql
-- Q4 분 단위 롤업 재계산 · 전 설비 1시간
-- ClickHouse
SELECT toStartOfMinute(ts) AS b, device_id, tag_id,
       count(), avg(value), min(value), max(value), countIf(quality IN (2, 4))
FROM plc.tag_raw
WHERE ts >= {end} - INTERVAL 1 HOUR AND ts < {end}
GROUP BY b, device_id, tag_id;
-- PostgreSQL
SELECT date_trunc('minute', ts) AS b, device_id, tag_id,
       count(*), avg(value), min(value), max(value), count(*) FILTER (WHERE quality IN (2, 4))
FROM plc_tag_raw_control
WHERE ts >= $end - interval '1 hour' AND ts < $end
GROUP BY b, device_id, tag_id;

-- Q5 전체 스캔 count · 비정렬 컬럼 조건
-- ClickHouse
SELECT count() FROM plc.tag_raw WHERE value > {v};
-- PostgreSQL
SELECT count(*) FROM plc_tag_raw_control WHERE value > $v;
```

- **Q4의 bad_cnt 조건은 롤업과 같다(quality IN (2, 4)).** 조건식 판정의 정본은 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §bad_cnt 조건식 판정이다. 이 쿼리의 결과가 tag_1m의 같은 구간 -Merge 결과와 같아야 한다는 것이 롤업 정합의 대조로도 쓰인다.
- **Q5의 문턱 {v}는 선택도를 고정하는 값이다.** 결과 count가 전체의 일정 비율이 되도록 신호 프로파일에서 정하고 모든 단계에서 같은 값을 쓴다 — 선택도가 바뀌면 PostgreSQL 병렬 스캔 계획이 단계마다 달라진다.

## 비교 축 6

| # | 축 | ClickHouse 측정 | PostgreSQL 측정 | 공통 분모 · 함정 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | system.parts 활성 파트 bytes_on_disk 합(tag_raw) | pg_total_relation_size 파티션 합 · 힙과 인덱스를 나눠 적는다 | 단계의 행 수가 같아야 한다 · PostgreSQL은 VACUUM 전후로 다르다 |
| 2 | 압축률 | 공통 논리 크기 ÷ bytes_on_disk | 공통 논리 크기 ÷ 힙 크기 | **공통 논리 크기 = 행 수 × 41 B**(ClickHouse 컬럼 폭 합) — 양쪽에 같은 분자를 쓴다. PostgreSQL은 튜플 헤더 때문에 1보다 작을 수 있다 |
| 3 | 삽입 처리량 | 배치 행 수 ÷ 삽입 시간 | 배치 행 수 ÷ COPY 트랜잭션 시간 | 동시 적재(SW-09)는 두 싱크가 디스크 · CPU를 나눠 쓴다 — 단독 적재(모드 D · GEN-10)로도 잰다 |
| 4 | 쿼리 시간(행 수별) | Q1~Q5 지연 · 읽은 행 · 바이트(query_log) | Q1~Q5 지연 · 버퍼 적중 · 읽은 블록(EXPLAIN ANALYZE BUFFERS) | 콜드 · 웜 상태를 가른다(§측정 조건) |
| 5 | VACUUM/WAL 증폭 | 머지 쓰기 바이트 ÷ 삽입 바이트(part_log) | WAL 바이트 증가분 ÷ 공통 논리 크기(pg_stat_wal) · autovacuum 실행 수 · 동결 VACUUM | 추가 전용 테이블도 삽입 기준 autovacuum과 동결 VACUUM이 돈다 — 적재 끝이 아니라 안정화 뒤까지 잰다 |
| 6 | 인덱스 크기 | 희소 기본 인덱스 + 마크(primary_key_bytes_in_memory · marks_bytes) | pg_indexes_size — I1(BRIN) · I2(btree) 따로 | 변형을 섞어 적지 않는다 |

- 검산: 축 = **6** — 저장 용량 · 압축률 · 삽입 처리량 · 쿼리 시간 · VACUUM/WAL 증폭 · 인덱스 크기
- **축 5는 ClickHouse 쪽에도 짝이 있다.** ClickHouse는 WAL이 없지만 파트 머지가 같은 데이터를 여러 번 다시 쓴다 — "RDB만 쓰기 증폭이 있다"로 읽히지 않게 머지 증폭을 같은 칸에 둔다.
- **축 2의 분모가 다르면 비교가 성립하지 않는다.** ClickHouse의 data_uncompressed_bytes와 PostgreSQL의 행 크기는 서로 다른 "비압축"을 가리킨다 — 공통 논리 크기로 양쪽을 나눈다.

## 스트리밍 동시 적재 — EXP-45

비교 축 3(삽입 처리량)은 격자에서 단독 적재(모드 D · GEN-10)로 재고, 동시 적재는 S3의 행 수 차 0(AC-21)만 확인했다. **Redis를 거쳐 들어오는 스트리밍 부하가 계단으로 오를 때 같은 배치를 받는 두 싱크가 각각 얼마를 쓰는지는 어느 실험도 재지 않았다.** EXP-45가 그 질문이다. 기전(flusher 안의 ②와 ③ · 전용 커넥션 · COPY 타임아웃)의 정본은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전이며 이 절은 측정의 모양만 고정한다.

| 항목 | 결정 | 이유 |
|------|------|------|
| 경로 | 모드 B → stream:plc:raw → Ingest flusher → ② ClickHouse 삽입 → ③ 대조군 COPY | Redis 경유가 질문이다 — 모드 D는 ING를 거치지 않아 SW-09가 적용되지 않는다(§SW-09 동시 적재) |
| 손잡이 | 모드 B 계단 pps — M 티어 10,000 pps(구조값)부터 100,000 pps까지 | 계단 값 · 계단 폭은 2계층 — 모양의 정본 [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) §시나리오 5 + 장애 주입 1 · §판정 창(계단마다 정상 상태 창) |
| 스위치 | SW-09 on · SW-10 off · 나머지 기본값 · **배치 안 A만**(ADR-09 현행 기본 · 기록 조건 칸 batchPlan) | 데드밴드가 행 수를 바꾼다 · 배치 안이 바뀌면 두 싱크가 받는 배치 크기가 계단마다 달라진다 · 안 B는 판정 점 판독이 보간에 걸린다(아래 한계) |
| 자원 | 대조 자원 조건(§측정 조건 자원 행 · compose.control.yml) | 부하 실험 프로파일(ClickHouse 4 vCPU · PostgreSQL 2 vCPU)로 재면 COPY가 먼저 꺾이는 이유가 CPU 배분이 된다 |
| 생성기 | datagen 프로파일 · CPU 집합 11-12 · 달성 판정 | 생성기 포화 계단을 두 싱크의 상한으로 기록하지 않는다([../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) §생성기 위치) |
| 내구성 · 인덱스 | 대조군 COPY 세션 synchronous_commit off · 인덱스 변형 I1 | §측정 조건 내구성 행 · I2는 COPY마다 btree 삽입을 더해 다른 실험이 된다 |

- 검산: 항목 = **6**
- **B형 — SW-09 on에서 처리량을 재는 것은 조합 제약 #4 위반이 아니다.** 결론 — 이 실험은 목표 ②의 수집 처리량을 재지 않고, 같은 배치를 받는 두 싱크의 시간을 계단마다 나란히 잰다. 반대 시나리오 — 이 기록의 랙 · E2E를 모드 B 계단 기록(EXP-23 · 부하 실험 프로파일)과 한 선에 그리면 대조군 COPY 비용과 대조 자원 배분이 수집 한계로 오독된다. 파생 지침 — 기록 머리에 EXP-45만 인용하고 EXP-23과 겹쳐 그리지 않는다.

| 지표 | ClickHouse | PostgreSQL | 판독 |
|------|------|------|------|
| 싱크 시간 | insert_duration p50 · p95 | ing_control_copy_seconds p50 · p95 | **계단 창 앞뒤 두 캡처의 버킷 차**로 창 분위수를 낸다 — 누적 히스토그램을 그대로 읽으면 앞 계단의 표본이 섞인다 |
| 행 처리율 | rows_inserted 증가율 | ing_control_copy_rows_total 증가율 | 계단 pps 대비 달성 · 두 값의 차는 COPY 실패 행이다 |
| 랙 | 그룹 lag · pending — 두 싱크 공통 | 상동 | ③이 XACK 앞이라 COPY가 늘면 랙이 는다 — 두 싱크 합의 결과로 읽는다 |
| 쓰기 비용 | part_log 머지 쓰기 바이트 · 활성 파트 수 | pg_stat_wal 바이트 증가분 · autovacuum 실행 수 · 죽은 튜플 수 | 추가 전용이라 PostgreSQL 죽은 튜플은 0이 정상이다 — 0이 아니면 롤백된 COPY의 흔적이다 |
| 실패 | 재시도 → DLQ(REQ-ING-08) | ing_control_copy_failures_total · 타임아웃 | 한 건이라도 있으면 그 계단 구간을 구간 count 대조로 표시한다 |
| 판정 점 | 삽입 p95가 창 폭 W를 넘는 첫 계단 | COPY p95가 COPY 타임아웃(창 폭 W와의 2계층 관계)을 넘는 첫 계단 또는 첫 실패 계단 | **"PostgreSQL COPY가 플러시 주기를 넘는 pps"** — 관측 범위 안에서 넘지 않으면 그 범위를 적는다 |

- 검산: 지표 = **6**
- **편차 폐기는 p50으로 하고 판정 점은 p95로 읽는다.** 히스토그램 계열의 편차 판정 분위수는 p50이다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §반복과 폐기 — p95 이상은 참고). 판정 점은 분위수 값을 인용하지 않고 **p95가 기준을 넘는 첫 계단(pps)**을 인용하므로 p95를 쓴다 — p50으로 판정하면 절반의 배치가 기준을 넘은 뒤에야 점이 찍혀, 플러시 주기를 넘는 COPY가 이미 lag로 번진 계단을 경계로 적는다. 기록은 두 분위수의 편차를 모두 내고 폐기는 p50 편차로만 한다.
- **한계 — EXP-45는 배치 안 A만 돈다.** 안 A의 두 기준(창 폭 W · COPY 타임아웃 = W의 절반 — 현행 참고 1초 · 0.5초 · 소유 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md))은 지연 히스토그램의 칸 경계와 겹쳐, "p95 > 기준"이 칸 안 보간 없이 경계 위 표본 비율로 정해진다. 안 B(창 5초)의 COPY 타임아웃(현행 참고 2.5초)은 칸 경계가 아니라 한 칸 안에 놓여, 버킷 차 분위수의 선형 보간이 p95를 타임아웃 양쪽 어디에든 만들어 넘지 않은 계단을 판정 점으로 적거나 그 반대가 된다. 안 B · C의 판정 점은 이 기록에서 외삽하지 않는다 — 기록 해석 칸에 이 한계를 적는다.

계단 하나의 절차다.

```plain
① 복원              대조 실험용 빈 상태 스냅샷 · compose.control.yml 기동 · SW-09 on
② 계단 진입          생성기 pps 전환 · 전환 과도 구간은 버린다
③ 정상 상태 창       창 앞 캡처 → 창 유지 → 창 뒤 캡처(히스토그램 · 계수기 · pg_stat_wal · part_log)
④ 창 판독            버킷 차 분위수 · 증가율 · 달성 판정
⑤ 다음 계단          판정 점을 지난 뒤 한 계단 더 가고 멈춘다(Breakpoint 끝 규칙과 같은 모양 · 05_load_scenarios §시나리오 조정값)
⑥ 사후 대조          KST 일 단위 구간 count 대조 — 어긋난 구간의 계단은 무효
```

- **⑥이 실패하면 그 계단의 PostgreSQL 수치는 무효다.** COPY 타임아웃 뒤 서버 커밋이 행을 남기면 실패로 세면서 행은 있는 상태가 된다([../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)) — 두 싱크의 행 집합이 다른 계단의 시간 비교는 같은 배치의 비교가 아니다.
- **판정 점의 값은 3계층 미확인이다.** 계단 값 · 창 폭 · COPY 타임아웃의 현행 참고는 소유처가 갖고 기록 조건 칸에 적는다.
- 실행기는 모드 B 계단 러너 구조를 그대로 쓰고 대조군 스위치와 대조 자원 조건만 더한다(scripts/lab/s5/load — 구현 세부는 코드가 갖는다).

## 대조군 용량 축

대조군의 디스크는 용량 티어(설비 × 태그 × 주기 · [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md))와 **다른 축**이다 — 티어는 운영 부하의 크기이고, 대조군은 역전 지점 격자의 단계가 크기를 정한다. 티어 산정에는 대조군 항이 없으므로 이 절이 대조군 용량의 정본이다. 아래 값은 **구조 계산 도출**이며 실측이 아니다(3계층 미확인).

| 구성 요소 | 행당 크기(구조 계산) | 계산 | 비고 |
|------|------|------|------|
| 힙 행 | 약 76 B | 튜플 헤더 24 + 데이터 42 → 정렬 72 + 줄 포인터 4 | 여백 없는 컬럼 순서 전제 · 페이지 헤더 · fillfactor 제외 |
| BRIN(I1) | 무시 가능 | 블록 범위당 요약 1 | 인덱스 크기 축에서 실측 |
| btree(I2) | 약 30 B 안팎 | 키 16 + 인덱스 튜플 헤더 · 줄 포인터 | 페이지 분할 여백 제외 · 실측 교체 대상 |
| WAL | 삽입 바이트 이상 | 전 페이지 쓰기 · COPY 기록 | 축 5 — 체크포인트 뒤 재사용 |

| 격자 단계 | 행 수 | I1 힙(도출) | I2 추가(도출) |
|:-:|------|------|------|
| 1~3 | 10^5 ~ 10^7 | 1 GB 미만 | 1 GB 미만 |
| 4 | 10^8 | 약 7.6 GB | 약 3 GB |
| 5 | 10^9 | 약 76 GB | 약 30 GB |
| 6 | 6 × 10^9 | 약 460 GB | 약 180 GB |

- 검산: 구성 요소 = **4** · 단계 행 수 × 76 B — 10^8 × 76 B ≈ 7.6 GB
- **6단계는 이 머신의 여유 디스크(원본 실측 약 936 GB) 절반에 가깝다.** ClickHouse tag_raw(원본 예상치 M 티어 7일 약 25 GB) · WAL · 스냅샷을 더하면 상한에 닿을 수 있다 — 중단 규칙(§역전 지점 탐색 설계)의 디스크 예산이 여기서 걸린다. 예산 값은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 소유한다.
- 스냅샷(task snapshot)은 볼륨을 통째로 묶으므로 대조군 단계가 클수록 스냅샷도 커진다 — 대조 실험 단계 사이의 스냅샷 여부를 실험 기록에 적는다.

## 역전 지점 탐색 설계

역전 지점은 행 수 축 위의 한 점이다. **격자는 설계 값이고 역전 지점은 3계층 미확인이다.**

| 단계 | 총 행 수 | 구성(M 티어 배치 · 1 Hz 누적) | 데이터 기간(도출) |
|:-:|------|------|------|
| 1 | 10^5 | 설비 50 × 태그 200 | 10초 |
| 2 | 10^6 | 상동 | 100초 |
| 3 | 10^7 | 상동 | 약 17분 |
| 4 | 10^8 | 상동 | 약 2.8시간 |
| 5 | 10^9 | 상동 | 약 28시간 |
| 6 | 6 × 10^9 | 상동 | 약 7일 — **원시 보존 상한** |

- 검산: 기본 격자 = **6**단계 · 행 수 = 1만 태그 × 초 · 6단계 상한 = 10,000 × 604,800 ≈ 6.05 × 10^9(원본 M 티어 7일 행 수 60.5억과 같다)
- **구성을 고정하고 기간으로 키운다.** 시스템이 실제로 쌓이는 순서 그대로라 쿼리 창과 데이터 밀도(태그당 1 Hz)가 단계마다 같다. 태그 수로 키우면 Q3(설비 전체)의 결과 행 수가 단계마다 달라져 역전이 데이터 폭의 효과와 섞인다.
- **정밀화 — 역전이 두 단계 사이에서 일어나면 그 사이를 로그 중점으로 두 번 나눈다.** 교차 구간 하나당 점 2개가 늘어난다. 교차가 없으면 "관측 범위 안에서 역전 없음"과 그 범위를 기록한다 — 역전이 나올 때까지 조건을 조정하면 측정이 아니라 연출이다.
- **상한은 원시 보존 창이다 — 6단계는 현행 보존에서 수행할 수 없다(W6 판정).** 단계 k의 채우기 시작 ~ 마지막 쿼리 경과는 원시 보존 기간 − 데이터 기간 D_k보다 짧아야 한다(1계층 관계 — 넘으면 TTL이 tag_raw 머리 파티션을 지워 ② 정합이 깨지고, 대조군은 GEN이 지우므로 남는다). 6단계는 D가 약 7일이라 이 예산이 0에 수렴한다 — **5단계(D 약 28시간)에서 멈추고 관측 범위 10^9행으로 기록하거나, 보존을 늘리는 순번 마이그레이션을 실험 조건으로 적용하고 기록에 적는다**(수동 DDL 금지 — REQ-TEC-05 · 조정값 정본 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값). 6단계를 넘기려면 보존을 늘려야 하고, 백필 ts는 보존 창 안이어야 한다([04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §백필 절차). 이 머신에서 PostgreSQL이 6단계를 적재 · 저장할 수 있는지(시간 · 디스크)는 미확인이다 — 중단 규칙이 판정한다.

단계 하나의 절차다.

```plain
① 채우기        모드 D 백필(ClickHouse) + GEN-10(대조군) · 같은 시드 · 앞 단계에 이어 누적
② 정합 확인     구간별 count(tag_raw) = count(대조군) — 어긋나면 그 구간 무효 · 다시 채우기
③ 안정화        ClickHouse 활성 파트 수 수렴 · PostgreSQL autovacuum 유휴 · 체크포인트 경과
④ 비 쿼리 축    축 1 · 2 · 5 · 6 기록 · 축 3은 ①의 적재 계측
⑤ 쿼리 축       Q1~Q5 × 인덱스 변형 I1 · I2 × 콜드 · 웜 — 반복 중앙값
⑥ 중단 규칙     전 쿼리의 역전이 확인되고 한 단계 더 지났거나 · 적재 시간 · 디스크 예산을 넘으면 멈춘다
```

- **②가 실패하면 그 단계의 모든 수치가 무효다.** 행 수가 어긋난 단계의 역전은 저장소 차이가 아니라 데이터 차이를 가리킨다(REQ-NFR-18).
- **③을 건너뛰면 축 5가 비어 보인다.** 추가 전용 PostgreSQL 테이블의 autovacuum · 동결은 적재가 끝난 뒤에 돈다 — 적재 직후 재면 증폭이 0에 가깝게 보인다.
- 적재 시간 예산은 1계층 관계(위 불릿) · 디스크 예산은 식이 고정된 2계층 조정값이며 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 소유한다.

## 측정 조건

| 조건 | 값 · 규칙 | 어기면 |
|------|------|------|
| 스위치 | SW-09 on(동시 적재 단계) · SW-10 off · 나머지 기본값 | 데드밴드가 행 수를 바꾼다 |
| 인덱스 변형 | I1 · I2 중 하나를 명시 | 변형이 섞인 수치가 한 선에 그려진다 |
| 자원 | **두 컨테이너의 vCPU 수 · 메모리 상한을 같게 둔 조건을 표준으로 한다** — 메모리 현행 3.5 GB · 3.5 GB(W6 판정 · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §대조 실험 메모리 조건) | 부하 실험 프로파일은 ClickHouse 5.0 GB · PostgreSQL 2.0 GB이고 cpuset 안도 ClickHouse 6 · PostgreSQL 2 vCPU다(원본 implementation_plan.md §2.4) — 역전이 엔진이 아니라 자원 배분을 가리킨다 |
| 내구성 | 대조군 적재 세션은 synchronous_commit off | ClickHouse 기본 삽입은 파트 fsync를 기다리지 않는다 — PostgreSQL만 WAL 플러시를 기다리면 삽입 축이 내구성 수준의 차를 잰다 |
| 병렬도 | ClickHouse max_threads · PostgreSQL 병렬 작업자 수를 기록 | 한쪽만 병렬 스캔이면 Q4 · Q5가 코어 수의 차를 잰다 |
| 캐시 상태 | 콜드 = 컨테이너 재기동 직후 첫 실행 · 웜 = 1회 예열 뒤 반복 | OS 페이지 캐시는 Docker VM 안이라 비울 수 없다 — 콜드는 근사이며 기록에 밝힌다 |
| 반복 | 쿼리당 반복 중앙값 · 실험 3회 중앙값 · 편차 기준 초과 시 폐기(D-10) | 코어 배치 분산이 단일 실행 수치를 무의미하게 만든다 |
| 4요소 | 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 | 기록 비교 불가 |

- 검산: 조건 = **8**
- **자원 동일화 조건은 이 문서의 판정이다.** 목표 ①은 "컬럼형과 행 기반의 차"를 묻는다 — 운영 프로파일의 비대칭 배분은 목표 ②의 조건이다. 대조 실험 전용 자원 조건을 두려면 cpuset 배치 정본 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)와 메모리 상한 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)에 조건 한 행씩이 필요하다.
- 기록 형식의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)다.

## EXP 예약 대역 연결

EXP-01~05는 대조군 동일 쿼리 5종의 예약 대역이다([../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)). 채번과 실행 절차는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 확정했다(W6 — 다섯 실험이 조건 · 절차를 공유하고 쿼리만 다르다).

| EXP | 쿼리 | 주 축 | 함께 싣는 비 쿼리 축(제안) |
|------|------|------|------|
| EXP-01 | Q1 단일 태그 1시간 | 쿼리 시간 · I1 대 I2 | 인덱스 크기 |
| EXP-02 | Q2 단일 태그 7일 | 쿼리 시간 | 저장 용량 · 압축률 |
| EXP-03 | Q3 설비 전체 1일 | 쿼리 시간 | 상동 |
| EXP-04 | Q4 분 단위 롤업 재계산 | 쿼리 시간 · 결과의 롤업 대조 | 삽입 처리량 |
| EXP-05 | Q5 전체 스캔 count | 쿼리 시간 · 읽은 바이트 | VACUUM/WAL 증폭 |

- 검산: EXP = **5** · 쿼리와 1:1
- **비 쿼리 축은 단계마다 한 번 잰다.** 쿼리와 무관하게 테이블 상태의 값이라 다섯 EXP가 같은 단계의 같은 값을 공유한다 — **W6 판정 — 비 쿼리 축은 격자 단계 기록 하나에 싣고 EXP-01~05가 그 기록을 공유한다**(기계 판독 블록의 axes · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)). 오른쪽 열은 해석에서 주로 짝짓는 축이다.

## 역방향 대조 — 업무 워크로드

위 절들은 **시계열을 PostgreSQL에 넣으면** 어디서 꺾이는가의 한 방향이다. 목표 ①의 다른 절반 — **업무 데이터를 ClickHouse에 넣으면 무엇이 깨지는가** — 는 지금까지 문서의 주장으로만 있었다. 저장소 분기 표의 "ClickHouse UPDATE는 비동기 mutation이라 확인 직후 재조회가 옛 상태를 본다"([../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) #9)는 측정된 적이 없다. EXP-40~44가 그 방향을 잰다.

**ClickHouse 26.8에는 경량 UPDATE가 있다 — 단 공식 문서상 Beta다.** 공식 문서(ClickHouse 문서 reference/statements/update — UPDATE 문)에 따르면 UPDATE t SET … WHERE …는 patch 파트로 동작하고 테이블 설정 enable_block_number_column · enable_block_offset_column이 필요하며, 판독 설정 apply_patch_parts 1(기본)이면 **patch 파트가 SELECT에 적용되어 갱신이 곧바로 보이고** 물리 반영은 백그라운드 머지 때 한다. 쓰기 쪽은 세션 설정 **enable_lightweight_update**(별칭 allow_experimental_lightweight_update — 문서 표기 Beta)가 켜져 있어야 하고, 동시 경량 UPDATE의 일관성은 세션 설정 **update_parallel_mode**(sync · auto · async)가 정한다 — 경량 UPDATE는 진행 중인 머지 · mutation을 기다리지 않는다. **이 Beta 상태 표기의 정본은 이 단락이다** — 다른 문서는 경량 UPDATE를 인용할 때 이 자리를 가리킨다. Beta라서 동작이 버전마다 바뀔 수 있고, 그래서 세 설정 모두 서버 기본값과 쓴 값을 원시에 남긴다(§ClickHouse 변형의 설정). 기본 키 · 파티션 키 컬럼은 갱신할 수 없다. 비동기 mutation(ALTER TABLE … UPDATE)도 조회 설정 apply_mutations_on_fly 1이면 끝나지 않은 mutation을 조회에 적용하고(문서 concepts/features/operations/update), mutations_sync로 완료를 기다릴 수 있다. 그래서 **판정의 근거가 가시성에서 갱신 비용 · 원자성 · 제약으로 옮겨질 수 있다** — 옮겨지는지는 결과가 정한다. 이 절은 값을 예측하지 않는다.

### 실험의 모양

| 항목 | 결정 | 이유 |
|------|------|------|
| 고정하는 것 | **데이터와 연산** — 같은 업무 행 벡터 · 같은 대상 주문 집합 · 같은 문장 순서 | 대상 행이 다르면 갱신 비용이 파트 배치의 차를 잰다 |
| 바꾸는 것 | 저장소와 그 저장소의 갱신 수단(변형) | 정방향과 같은 축이다 — 데이터를 고정하고 저장소를 바꾼다 |
| PostgreSQL 쪽 | 기존 업무 테이블 work_order · production_log · audit_log(마이그레이션 005 · [01_postgresql_schema.md](./01_postgresql_schema.md)) 그대로 | 대조용 사본을 만들면 업무 제약(UNIQUE · FK · CHECK · 인덱스)이 빠진 PostgreSQL을 잰다 |
| ClickHouse 쪽 | 업무 대조 테이블 3 — work_order_control · work_order_control_rmt · production_log_control([03_clickhouse_schema.md](./03_clickhouse_schema.md) §업무 대조 테이블 · DDL 순번 009) | 업무 테이블과 같은 논리 컬럼 · 각 엔진이 할 수 있는 제약만 |
| 업무 규모 격자 | work_order **10^4 · 10^5 · 10^6**행 | 업무 규모 산정(수만~수십만 행 · [01_postgresql_schema.md](./01_postgresql_schema.md))을 양쪽 한 자릿수씩 감싼다 — 시계열 격자(10^5~)와 겹치지 않는 축이다 |
| 측정 경로 | 도구 컨테이너(CPU 집합 11-12)의 Node 실행기 — pg · @clickhouse/client로 두 저장소에 직접 · api 비경유 | **측정 경로에 앱이 끼지 않아야 저장소 비교가 된다**([../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) A형 판정) — 호스트 프로세스는 cpuset이 닿지 않는다 |
| 손잡이 | 스위치가 아니라 실행기 하위 명령이 변형을 고른다 | 변형이 앱 코드 경로를 바꾸지 않는다 — 앱 밖 측정이라 스위치 신설 대상이 아니다(EXP-34 배치 안 B · C와 같은 판정) |
| 반복 | 분포 지표 3회 중앙값 · 구조 지표(부분 반영 · 경합 위반 · 수용 건수) 3회 전부 | 구조 판정에는 분포가 없다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §구조 판정과 분포 판정) |

- 검산: 항목 = **8**
- **실행기는 모드 D와 같은 방식의 dist 진입점이다.** api 이미지 안 별도 진입점을 도구 컨테이너가 띄운다 — 앱 프로세스로 뜨지 않고 NestJS 모듈 그래프를 거치지 않는다. 오케스트레이터는 격자 러너 패턴(하위 명령 하나 = 호출 하나 · 원시 jsonl · 상태 파일)을 따른다. 서버 버전 · 테이블 설정 · 쿼리 설정을 원시에 남긴다.

### 변형과 판정 지표

| EXP | 질문(원리) | PostgreSQL | ClickHouse 변형 | 판정 지표 | 판정 종류 |
|------|------|------|------|------|------|
| **EXP-40** 상태 전이 갱신 | 행 하나의 상태를 바꾸는 비용 — MVCC · HOT · WAL 대 불변 파트 | 조건부 UPDATE 1문장(order_id · 현재 상태 조건 · IN_PROGRESS → COMPLETED) · 자동 커밋 | ① ALTER UPDATE 비동기(mutations_sync 0) ② ALTER UPDATE 동기(mutations_sync 1) ③ 경량 UPDATE ④ RMT 새 버전 삽입 + FINAL 조회 | 갱신 지연 p50 · p95 · **보이기까지 걸린 시간**(응답 뒤 새 값이 조회될 때까지 폴링) · 물리 비용 · 갱신 뒤 조회 비용 R1 · R2 | 분포 |
| **EXP-41** PK 점조회 | B-tree 대 희소 인덱스 — 조회당 읽는 행 | order_id 점조회(PK btree 인덱스 스캔) | index_granularity 8192(work_order_control) · 256(§그래뉼 변형 판정) | 동시성 1 · 8 · 32의 p50 · p95 · 조회당 read_rows(query_log) 대 읽은 블록(EXPLAIN ANALYZE BUFFERS) | 분포 |
| **EXP-42** 원자성 · 동시 갱신 | 트랜잭션 · 행 잠금 대 문장 단위 원자성 | 작업지시 완료 = 조건부 UPDATE + production_log INSERT + audit_log INSERT 한 트랜잭션 · 첫 문장 뒤 실패 주입 · 같은 주문 동시 완료 2 | 같은 순서의 문장(경량 UPDATE + production_log_control INSERT) · 같은 위치의 실패 주입 · 같은 동시 완료 — 동시 완료는 update_parallel_mode auto(기본) · sync 두 팔 | **부분 반영 건수**(상태만 바뀌고 실적이 없는 주문) · **경합 위반 건수**(한 주문에 완료 실적 2행 이상) | 구조 — 3회 전부 |
| **EXP-43** 무결성 제약 | UNIQUE · FK · CHECK 대 CHECK CONSTRAINT · 정렬 키 단위 최종 중복 제거 | ⓐ 같은 order_no 동시 삽입 K(행마다 IDENTITY가 서로 다른 order_id) ⓑ 없는 line_id ⓒ CHECK 위반(target_qty 0 이하 · planned_end ≤ planned_start · status 값 밖) ⓓ 같은 주문 재삽입(재시도 모양 — ClickHouse는 같은 order_id 재전송 · PostgreSQL은 IDENTITY라 같은 order_no 재전송) | 같은 입력을 MergeTree와 RMT에(ⓐ는 실행기가 행마다 서로 다른 order_id 발급) · CHECK는 INSERT 경로와 UPDATE 경로 둘 다(**UPDATE 경로 = work_order_control의 경량 UPDATE · ALTER UPDATE** — 블록 번호 · 오프셋 컬럼이 work_order_control에만 있다 · RMT는 INSERT 경로만) · ⓓ는 중복 제거 윈도우 0에 더해 **윈도우 N + insert_deduplication_token** 변형 | 수용 건수 · RMT 머지 전 · 후 중복 수 · FINAL 조회 대 비 FINAL 조회 시간 · read_rows | 구조(수용) + 분포(FINAL 비용) |
| **EXP-44** 단건 고빈도 삽입 | 힙 추가 + WAL 대 삽입마다 파트 생성 · 머지 | production_log 행 1 INSERT · 자동 커밋 · 50 · 200 · 500 req/s | production_log_control ⓐ 동기 INSERT ⓑ async_insert 1 · wait_for_async_insert 1 | 삽입 p50 · p95 · 달성률 · 활성 파트 추이 · 머지 쓰기 바이트 · 삽입 지연 · 거절 이벤트(DelayedInserts · RejectedInserts) · WAL 바이트 · autovacuum 실행 수 | 분포 |

- 검산: EXP = **5** · ClickHouse 변형 = EXP-40 4 + EXP-41 2 + EXP-42 1 + EXP-43 3(MergeTree · RMT · 윈도우 N + 토큰) + EXP-44 2 = **12** — 판독 설정 두 벌(EXP-40 ①)과 update_parallel_mode 두 팔(EXP-42)은 같은 쓰기 수단의 팔이라 변형으로 세지 않는다
- **EXP-40 ①은 두 번 판독한다 — apply_mutations_on_fly 0 · 1.** 04_storage_split #9의 주장은 0(기본 판독)에서만 설 수 있는 문장이다. 한 쪽 판독만 기록하면 주장을 반증하지도 확인하지도 못한다. 쓰기는 한 번이고 판독 세션 설정만 다르다.
- **보이기까지 걸린 시간은 응답 시각 기준이다.** 쓰기 응답을 받은 시각부터 별도 판독 커넥션이 새 값을 처음 본 시각까지를 잰다 — 폴링 간격 · 폴링 횟수 상한은 2계층(실행기 소유 · 기록 조건 칸)이고 상한 안에 보이지 않으면 "상한 안 미관측"으로 센다. PostgreSQL은 커밋 응답이 가시성 경계라 0에 가까운 것이 구조이며, 그것을 같은 폴링으로 재어 폴링 자체의 바닥을 드러낸다.
- **물리 비용은 저장소마다 다른 계기로 잰다.** ClickHouse — system.part_log의 MutatePart · MergeParts 쓰기 바이트 · patch 파트 수 · 활성 파트 수. PostgreSQL — pg_stat_wal 바이트 증가분 · pg_stat_user_tables의 갱신 수 · HOT 갱신 수 · 죽은 튜플 수. 갱신 N건당 값으로 나눠 적는다.
- **갱신 뒤 조회 비용은 두 쿼리다 — R1 점조회(order_id) · R2 상태별 건수(status 전 행 집계).** 갱신 직후(patch 미반영 · mutation 진행 중 · RMT 머지 전)와 머지 수렴 뒤를 모두 잰다 — 경량 UPDATE의 대가는 쓰기 시점이 아니라 머지 전 조회 시점에 patch 적용으로 나타날 수 있다. 머지 뒤는 두 판독 라벨로 가른다 — after_wait(자연 머지 상한 대기) · after_force(경량 UPDATE는 ALTER TABLE … APPLY PATCHES · RMT는 OPTIMIZE TABLE … FINAL · EXP-43의 MergeTree도 OPTIMIZE TABLE … FINAL · ALTER UPDATE는 mutation 완료 대기) · 한 호출 안에서 차례로 잰다(as-built). 수렴 판정은 after_force에서 강제 문장 성공 + 미완 mutation 0, after_wait에서 미완 mutation 0만(강제 문장이 없다)이고 측정 행이 아니라 detail에 둔다 — 남은 active patch 파트 수는 따로 적는 관측값이다 — 강제 뒤에도 0이 아닐 수 있다(26.8 스모크 관측 · 3계층).
- **EXP-40 가시성 폴링은 호출 예산 안에서 끊는다.** 예산을 넘겨 쓰지 못한 건 · 끊은 폴링은 값을 null로 두고 budget_exhausted(판독기별 계수)로 센다 — 호출이 한도를 넘겨 반복 원시가 통째로 사라지는 경로를 두지 않는다(미관측을 기록으로 남기는 정직성). 예산 값은 실행기 조정값(2계층)이고 검산을 원시에 남긴다.
- **EXP-42는 지연을 비교하지 않는다.** ClickHouse 쪽에는 감사 대조 테이블이 없어 문장이 하나 적다([03_clickhouse_schema.md](./03_clickhouse_schema.md) §업무 대조 테이블) — 이 실험의 판정은 건수뿐이다. 실패 주입 위치는 두 저장소 모두 **첫 문장(상태 갱신) 뒤 · 둘째 문장 전**이다.
- **EXP-42의 동시 완료에서 PostgreSQL은 행 잠금으로 두 번째 조건부 UPDATE가 0행이 되어 실적을 쓰지 않는 것이 구조다.** ClickHouse UPDATE가 갱신 행 수를 응답으로 돌려주는지는 판별 대상이다(§미확인 · 미설계 등재) — 돌려주지 않으면 실행기는 PostgreSQL과 같은 판단 규칙(갱신 0행이면 중단)을 적용할 입력이 없고, 그것이 관측이다. 행 수를 흉내 내려 앞 조회를 더하지 않는다(§공정성 규칙 7).
- **EXP-42 동시 완료는 update_parallel_mode 두 팔로 잰다 — auto(기본) · sync.** 경량 UPDATE는 동시 머지 · mutation을 기다리지 않고 동시 갱신의 일관성을 이 세션 설정에 맡긴다(공식 문서 UPDATE 문 · update 세션 설정). 기본 팔 하나만 재면 경합 위반 건수가 엔진의 한계인지 설정 하나의 선택인지 가를 수 없다. async 팔은 두지 않는다 — 동기화를 끈 결과는 경합을 막는 수단의 측정이 아니다. 두 팔 모두 서버 기본값(system.settings)과 쓴 값을 원시에 남긴다.
- **EXP-43 ⓐ와 ⓓ의 입력은 PostgreSQL과 같은 모양이다.** ⓐ 동시 중복 K행은 PostgreSQL에서 IDENTITY가 서로 다른 order_id를 받으므로 ClickHouse에서도 실행기가 행마다 서로 다른 order_id를 발급한다 — 같은 order_id로 넣으면 PostgreSQL과 다른 입력이 된다. ⓓ 재삽입은 ClickHouse에서 같은 order_id의 재전송이고, PostgreSQL에서는 IDENTITY가 order_id를 매기므로 같은 order_no의 재전송이다(as-built) — 두 쪽 모두 "같은 주문을 한 번 더 보낸다"는 뜻은 같고, 거절 주체가 PostgreSQL은 UNIQUE(order_no) · ClickHouse는 중복 제거 윈도우 · RMT 머지다.
- **구조 사실 — RMT는 정렬 키(order_id)로만 행을 합치므로 ⓐ의 order_no 중복은 머지 뒤에도 남는다.** ReplacingMergeTree는 정렬 키가 같은 행만 합친다(공식 문서 ReplacingMergeTree) — order_no는 정렬 키가 아니다. 이것은 예측이 아니라 엔진 정의이며, 실측(머지 전 · 후 중복 수)으로 확인한다. RMT가 합치는 것은 ⓓ의 같은 order_id 재전송뿐이다.
- **EXP-43 ⓓ의 윈도우 변형은 재시도 멱등 수단을 잰다.** 비복제 MergeTree의 삽입 중복 제거는 테이블 설정 non_replicated_deduplication_window가 0보다 커야 켜지고, insert_deduplication_token이 같은 재삽입을 윈도우 안에서 버린다(공식 문서 삽입 재시도 중복 제거 · MergeTree 설정). 기본 0 팔은 "유일 검사 없음"을, 윈도우 N + 토큰 팔은 "재시도 모양의 중복을 엔진이 버리는가"를 잰다 — 둘은 다른 질문이다. 윈도우는 ALTER TABLE … MODIFY SETTING으로 바꿀 수 있는 테이블 설정이라 실행기가 ⓓ 실행 범위 안에서만 켜고, 실행 끝에 0으로 복원하며, 켠 값 · 복원 · DuplicatedInsertedBlocks를 원시에 남긴다. 스냅샷 전에 윈도우 0을 확인한다(§그래뉼 변형 판정 ②와 같은 부재 확인). **ⓐ는 윈도우 0을 유지한다** — ⓐ의 질문은 유일 검사의 부재이고, 서로 다른 order_id 행은 내용 해시가 달라 윈도우와 무관하다.
- **EXP-44 ⓑ는 wait_for_async_insert 1 팔 하나이고 0 팔을 두지 않는다.** 0이면 서버 버퍼에 들어간 순간 응답하므로 응답이 가시성보다 앞선다 — 응답 뒤 플러시 전 데이터는 조회되지 않고 플러시 실패는 응답에 드러나지 않는다. PostgreSQL 커밋 응답은 synchronous_commit off여도 커밋 즉시 보이므로(off가 늦추는 것은 WAL 플러시이지 가시성이 아니다) 0 팔의 삽입 p50 · p95는 보장이 다른 두 응답의 비교가 된다. 1 팔의 지연은 플러시 설정(§ClickHouse 변형의 설정 async_insert 플러시 행)이 정하므로 그 서버 기본값과 쓴 값을 원시에 남긴다 — 없으면 ⓑ의 지연이 엔진의 비용인지 대기 설정의 선택인지 가를 수 없다.

### 업무 규모 격자와 채우기

| 단계 | work_order | 대상 주문 집합(반복당) | 채우기 |
|:-:|------|------|------|
| 1 | 10^4 | 상태 IN_PROGRESS 행에서 겹치지 않게 뽑는다 | PostgreSQL COPY · ClickHouse INSERT — 같은 시드 행 벡터 |
| 2 | 10^5 | 상동 | 상동 |
| 3 | 10^6 | 상동 | 상동 |

- 검산: 단계 = **3**
- **order_id는 빈 볼륨의 IDENTITY 발급 1..N을 두 저장소가 공유한다.** 빈 볼륨 + 같은 시드면 번호가 같다([09_migrations_seed.md](./09_migrations_seed.md) §시드의 결정성과 무인증 기간). ClickHouse에는 시퀀스가 없어 실행기가 같은 번호를 싣는다 — 채우기 뒤 (order_id · order_no) 집합을 두 저장소에서 대조하고 어긋나면 그 단계는 무효다. 같은 이유로 production_log_control.log_id도 실행기가 발급한다.
- **종결에서 나가는 전이가 없다([01_postgresql_schema.md](./01_postgresql_schema.md) §work_order.status 허용 전이).** 한 번 완료한 주문은 다시 완료할 수 없으므로 반복마다 겹치지 않는 대상 집합을 쓴다. 상태 분포(IN_PROGRESS 비율)는 2계층 — 실행기 소유 · 기록 조건 칸.
- **채우기는 감사하지 않는다.** 실험 행은 사람이 쓰기 표면으로 일으킨 변경이 아니다 — 시드와 같은 판정([09_migrations_seed.md](./09_migrations_seed.md) "시드는 감사하지 않는다" 불릿). production_log · audit_log는 채우지 않고 실험이 쓴 행만 담는다.
- **변형마다 같은 채움 상태에서 시작한다.** 앞 변형이 남긴 mutation · patch 파트 · RMT 버전 · 죽은 튜플이 다음 변형에 섞이면 비용이 누적 상태를 잰다 — ClickHouse는 비우고 다시 채운 뒤 머지 수렴, PostgreSQL은 채움 스냅샷 복원 뒤 VACUUM ANALYZE를 기록한다.
- 업무 테이블에 넣은 실험 행은 실험 전용 스냅샷에서만 산다 — 실험이 끝나면 기준 스냅샷으로 복원한다(REQ-TEC-08).

### 그래뉼 변형 판정

EXP-41의 index_granularity 256 변형을 어디에 둘지의 판정이다. **index_granularity는 테이블 생성 때 정해지고 뒤에 바꿀 수 없다** — 실행기가 첫 실행에서 MODIFY SETTING 시도의 거부를 원시에 남겨 26.8 동작을 판별한다.

| 안 | 내용 | 결과 |
|------|------|------|
| ① 마이그레이션 테이블 추가 | 009에 work_order_control_g256을 더한다 | ClickHouse 테이블 고정 기준이 하나 더 늘고, 실험 하나의 변형이 스키마 정본에 영구히 남는다 |
| ② 실행 범위 변형 테이블(**채택**) | 실행기가 EXP-41 실행 안에서만 plc 밖 실험 데이터베이스에 work_order_control과 같은 DDL을 granularity만 바꿔 만들고, 같은 행을 INSERT SELECT로 채운 뒤 실행 끝에 지운다 | 스키마 · 고정 기준 불변 · DDL 문은 코드와 원시(문 해시)에 남아 커밋으로 재현된다 |
| ③ RMT 테이블을 256으로 | work_order_control_rmt의 granularity를 256으로 둔다 | 엔진 차가 그래뉼 차에 섞이고 EXP-40 ④의 비교 조건이 바뀐다 |

- 검산: 안 = **3**
- **②는 수동 DDL 금지(REQ-TEC-05)의 예외가 아니다.** 그 규칙이 막는 것은 스냅샷 복원 · 새 환경에서 재현되지 않는 스키마다. ②의 객체는 실행이 끝나면 없고, 실행기는 스냅샷을 찍기 전 실험 데이터베이스의 부재를 확인한다 — 스냅샷에 들어가는 스키마는 순번 마이그레이션이 만든 것뿐이다. 이 판정이 틀렸다고 보면 ①로 바꾸고 고정 기준을 함께 고친다.

### ClickHouse 변형의 설정

| 설정 | 자리 | 쓰는 변형 | 기록 |
|------|------|------|------|
| mutations_sync | 쓰기 쿼리 | EXP-40 ① 0 · ② 1 | 원시 쿼리 설정 |
| apply_mutations_on_fly | 판독 쿼리 | EXP-40 ① 두 판독 0 · 1 | 상동 |
| enable_block_number_column · enable_block_offset_column | 테이블 설정(009 · work_order_control에만) | EXP-40 ③ · EXP-42 · EXP-43 UPDATE 경로(work_order_control — RMT는 INSERT 경로만) | system.tables 설정 문자열 |
| FINAL | 판독 쿼리 | EXP-40 ④ · EXP-43 | 원시 쿼리 문 |
| async_insert · wait_for_async_insert | 쓰기 쿼리 | EXP-44 ⓑ 1 · 1 | 원시 쿼리 설정 · 서버 기본 async_insert 0은 그대로([03_clickhouse_schema.md](./03_clickhouse_schema.md) §서버 설정 계약) |
| async_insert_busy_timeout_max_ms · async_insert_busy_timeout_min_ms · async_insert_use_adaptive_busy_timeout · async_insert_max_data_size | 쓰기 쿼리 | EXP-44 ⓑ — 버퍼 플러시 시점(첫 데이터 뒤 최대 대기 · 적응형 대기의 하한 · 적응형 여부 · 크기 문턱)을 정해 ⓑ의 삽입 지연을 좌우한다 · 값은 2계층(실행기 소유 · §미확인 · 미설계 등재 실행기 조정값 행) | 원시 쿼리 설정 · 서버 기본값(system.settings)과 쓴 값 둘 다 |
| enable_lightweight_update | 쓰기 쿼리(세션) | EXP-40 ③ · EXP-42 · EXP-43 UPDATE 경로(work_order_control) — 1 | 원시 쿼리 설정 · 서버 기본값 · 별칭 allow_experimental_lightweight_update — 공식 문서 Beta |
| apply_patch_parts | 판독 쿼리 | EXP-40 ③ · EXP-42 · EXP-43 판독 — 1(기본) | 원시 쿼리 설정 · 서버 기본값 |
| update_parallel_mode | 쓰기 쿼리(세션) | EXP-42 동시 완료 두 팔 auto(기본) · sync | 원시 쿼리 설정 · 서버 기본값 |
| non_replicated_deduplication_window · insert_deduplication_token | 테이블 설정(MODIFY SETTING — 실행 범위) · 쓰기 쿼리 | EXP-43 ⓓ 윈도우 N + 토큰 변형 — 기본 팔과 ⓐ는 윈도우 0 | system.tables 설정 문자열(켠 값 · 복원 뒤 0) · 원시 쿼리 설정 · DuplicatedInsertedBlocks |

- 검산: 설정 행 = **10**
- **변형 설정은 쿼리 · 테이블 단위로만 준다.** 서버 사용자 프로파일을 바꾸면 적재 경로(tag_raw 삽입 · 롤업)까지 같은 설정을 받아 목표 ②의 조건이 조용히 바뀐다. 기본값은 서버 버전 종속이라 실행기가 system.settings에서 읽어 원시에 남긴다.

### 원리 대응

해석 문단이 관측을 저장 구조로 설명하는 자리다. 오른쪽 두 열은 구조 사실이고, 관측 열의 값은 전부 3계층 미확인이다.

| 관측(EXP) | PostgreSQL 구조 | ClickHouse 구조 | 관측이 가리키는 것 |
|------|------|------|------|
| 갱신 비용(40) | MVCC — UPDATE는 새 튜플 버전을 쓰고 옛 버전은 죽은 튜플로 남아 VACUUM을 기다린다 · 모든 변경은 WAL에 먼저 쓴다 · status가 인덱스 (line_id, status)의 키라 **HOT 조건을 만족하지 않아** 인덱스 항목도 새로 쓴다 | 파트는 불변이다 — mutation은 대상 행이 있는 파트의 바뀐 컬럼을 다시 쓴다 · 경량 UPDATE는 바뀐 컬럼 · 정렬 키 · 행 위치 시스템 컬럼만 담은 patch 파트를 쓴다 · RMT는 새 행을 쓰고 옛 버전은 머지가 지운다 | 행 하나를 바꾸는 비용의 단위가 행인가 파트인가 |
| 보이기까지(40) | 커밋이 가시성 경계다 — 다음 스냅샷이 새 버전을 본다 | 비동기 mutation은 머지 스케줄에 묶인다(apply_mutations_on_fly가 조회에서 앞당긴다) · patch는 조회 때 적용된다 · RMT는 FINAL이 조회 때 합친다 | 가시성이 쓰기 쪽 비용인가 읽기 쪽 비용인가 |
| 점조회(41) | B-tree는 루트에서 리프까지 몇 페이지로 행 하나를 가리킨다 | 희소 기본 인덱스는 그래뉼 하나를 가리키고 그 그래뉼 전체를 읽는다 | 조회당 읽는 행 수가 그래뉼 크기에 묶이는가 |
| 원자성(42) | 트랜잭션 — 문장 여럿이 한 커밋이다 · 조건부 UPDATE가 행을 잠가 두 번째 완료가 0행을 본다 | 문장 단위 원자성 · 다문장 트랜잭션 없음(실험 기능은 쓰지 않는다 — 아래 불릿) | 부분 반영과 경합을 저장소가 막는가 앱이 막아야 하는가 |
| 제약(43) | UNIQUE는 btree 검사 · FK는 참조 행 검사 · CHECK — 전부 커밋 전에 거절 | CHECK CONSTRAINT는 INSERT 때 행마다 검사 · UNIQUE · FK 없음 · RMT는 정렬 키 단위로 머지 뒤에만 중복을 합친다 | 무결성이 쓰기 시점 보장인가 최종적 수렴인가 |
| 단건 삽입(44) | 힙 페이지 끝에 행 추가 + WAL · 커밋 단위가 행 하나 | 삽입마다 새 파트 · 머지가 합친다 · async_insert는 서버 버퍼가 묶어 한 파트로 쓴다 | 쓰기 단위가 작을 때 파트 수 한도가 먼저 오는가 |
| 스트리밍 적재(45) | COPY 한 트랜잭션 · WAL · 삽입 기준 autovacuum | 배치 하나 = 파트 · 머지 | 같은 배치에서 두 싱크의 시간이 부하에 따라 어떻게 벌어지는가 |

- 검산: 관측 = **7**
- **다문장 트랜잭션을 쓰지 않는 이유 — 운영 경로에 쓸 수 없는 보장이다.** ClickHouse의 트랜잭션은 실험 기능이라 기본 꺼져 있고 동작이 버전에 종속된다. 켜고 재면 결과는 "ClickHouse가 업무 완료 단위를 지킨다"로 읽히지만, 그 보장은 저장소 분기에서 업무 데이터 목적지를 고를 때 근거로 쓸 수 없다 — 기본값으로 운영하는 경로에 없는 기능이기 때문이다. 실패 시나리오 — 실험 기능 팔의 부분 반영 0을 근거로 업무 쓰기를 ClickHouse에 두면, 버전 갱신이나 설정 누락 하나로 보장이 조용히 사라지고 부분 반영이 운영 데이터에 쌓인다. 그래서 EXP-42는 기본 동작의 부분 반영 건수만 기록한다.
- **HOT 불가는 구조이고 HOT 비율은 관측이다.** HOT은 인덱스 키 컬럼이 바뀌지 않고 같은 페이지에 여유가 있을 때만 성립한다 — status 갱신은 첫 조건에서 빠진다. 그래서 EXP-40의 PostgreSQL 쪽은 인덱스 갱신 비용을 포함한 값이다. 인덱스 (line_id, status)를 실험 때문에 빼지 않는다(§공정성 규칙 8).

### 공정성 규칙

| # | 규칙 | 어기면 |
|:-:|------|------|
| 1 | 같은 행 벡터 · 같은 대상 집합 · 같은 문장 순서 · 같은 동시성 | 차이가 저장소가 아니라 입력을 잰다 |
| 2 | 대조 자원 조건(§측정 조건 자원 행) — 두 컨테이너 같은 CPU 집합 크기 · 같은 메모리 상한 | 역전이 자원 배분을 가리킨다 |
| 3 | 측정 경로는 도구 컨테이너 — api · BFF를 거치지 않는다 | 앱의 풀 · 직렬화 · 이벤트 루프가 두 저장소에 다르게 붙는다 |
| 4 | 클라이언트 지연과 서버 시간을 함께 적는다 — ClickHouse query_log의 query_duration_ms · PostgreSQL pg_stat_statements 평균 실행 시간 | ClickHouse HTTP(8123)와 PostgreSQL 와이어 프로토콜의 왕복 차가 엔진 차로 읽힌다 |
| 5 | PostgreSQL 실험 세션은 synchronous_commit off — EXP-44만 on 팔을 보조 관찰로 더한다 | ClickHouse 기본 삽입은 파트 fsync를 기다리지 않는다 — 한쪽만 WAL 플러시를 기다리면 내구성 수준의 차를 잰다(§측정 조건 내구성 행) |
| 6 | ClickHouse 서버 버전 · 테이블 설정 · 쿼리 설정을 원시에 남긴다 | 경량 UPDATE(Beta) · on-the-fly 동작은 버전 종속이라 기록이 다른 동작을 가리킨다 |
| 7 | **없는 기능을 흉내 내지 않는다** — ClickHouse에 UNIQUE · FK · 트랜잭션 · 갱신 행 수를 앞 조회나 앱 잠금으로 만들지 않는다 | 엔진이 아니라 흉내의 비용을 잰다 — Q4에서 last · p95를 뺀 것과 같은 원리 |
| 8 | **PostgreSQL 쪽 업무 제약 · 인덱스를 빼지 않는다** | 업무 보장의 비용이 이 방향의 질문 자체다 — 빼면 보장 없는 PostgreSQL과 보장 없는 ClickHouse를 비교한다 |
| 9 | 변형마다 같은 채움 상태에서 시작한다(§업무 규모 격자와 채우기) | 앞 변형의 mutation · patch · 죽은 튜플이 다음 변형 비용에 누적된다 |
| 10 | 동시성 32에서도 도구 컨테이너 CPU를 기록하고 포화 창은 버린다 | 도구 CPU 2개의 한계가 두 저장소의 동시성 상한으로 기록된다 |

- 검산: 규칙 = **10**
- **A형 — 정방향은 제약을 빼고 역방향은 제약을 남긴다.** 통념은 "대조는 같은 규칙으로 해야 공정하다"다. 부정 — 정방향 대조군이 PK · UNIQUE를 두지 않는 것은 tag_raw에 없는 비용을 PostgreSQL에만 붙이지 않기 위해서다(§plc_tag_raw_control — 동형 설계). 역방향의 질문은 "업무 보장을 어느 엔진이 어떤 비용으로 주는가"라 보장이 워크로드의 일부다. 진짜 축은 **그 방향의 워크로드가 요구하는 것**이다. 대체 경로 — 두 방향 모두 워크로드가 요구하지 않는 비용은 빼고 요구하는 비용은 남긴다. ClickHouse가 줄 수 없는 보장은 비용이 아니라 수용 건수 · 부분 반영 건수로 기록한다.

### 역방향 측정 조건

| 조건 | 값 · 규칙 | 어기면 |
|------|------|------|
| 스위치 | 전부 기본값 — SW-09 off | 역방향 실험은 적재 경로를 쓰지 않는다 · 켜 두면 배경 적재가 같은 CPU를 쓴다 |
| 배경 부하 | 주입 모드 없음 · api 유휴 | 수집 적재가 PostgreSQL · ClickHouse를 함께 써서 단건 지연에 섞인다 |
| 4요소 | 커밋 해시 · 메모리 프로파일(대조 조건) · 용량 티어 칸은 해당 없음(업무 규모 단계가 축) · 스위치 상태 | 기록 비교 불가 |
| 시작 상태 | 단계별 채움 스냅샷 · PostgreSQL ANALYZE 뒤 · ClickHouse 활성 파트 수 수렴 뒤 | 통계 · 머지 상태가 반복마다 달라 계획과 읽는 파트 수가 바뀐다 |
| 캐시 | 웜 — 예열 1회 뒤 반복 | 콜드는 이 방향의 질문이 아니다 · 첫 실행의 페이지 적재가 점조회 분포를 지배한다 |
| 관측 | 관측 프로파일 off | 스크레이프 쿼리가 쿼리 로그 · 지연에 섞인다(EXP-38) |

- 검산: 조건 = **6**

### EXP 연결 · 기계 판독 블록 제안

| EXP | 기록 slug(제안) | 확정되는 미확인 | 첫 기록 단계 |
|------|------|------|:--:|
| EXP-40 | oltp-control-update | 04_storage_split #9 주장의 성립 여부 · 변형별 갱신 · 가시성 · 물리 비용 | S5 |
| EXP-41 | oltp-control-point | 그래뉼 크기별 점조회 비용 | S5 |
| EXP-42 | oltp-control-atomic | 부분 반영 · 경합 위반의 저장소별 발생 | S5 |
| EXP-43 | oltp-control-constraint | 제약별 수용 건수 · RMT 머지 전후 중복 · FINAL 비용 | S5 |
| EXP-44 | oltp-control-insert | 단건 삽입 빈도별 파트 · 머지 · 한도 | S5 |
| EXP-45 | control-stream-ingest | PostgreSQL COPY가 플러시 주기를 넘는 pps | S5 |

- 검산: EXP = **6**
- **기계 판독 블록은 measurement/v1 그대로 두고 필드 둘을 더한다.** v1 판독 규칙 7이 모르는 필드를 무시하므로 필드 추가는 schema를 올리지 않는다. points · axes는 EXP-01~05 전용(판독 규칙 6)이라 섞지 않는다. 필드 표에 행을 더하는 자리는 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기계 판독 블록이다.

```json
{
  "reverse": [
    { "exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "lightweight_update", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "visible_after_ack", "unit": "ms", "values": [null, null, null], "median": null },
    { "exp": "EXP-42", "op": "atomic", "store": "postgresql", "variant": "pg_tx", "scale": 1000000, "concurrency": 2, "rate": null, "read": null, "metric": "partial_apply_count", "unit": "count", "values": [null, null, null], "median": null, "structural": true }
  ],
  "streamSteps": [
    { "pps": 10000, "store": "postgresql", "metric": "control_copy_seconds_p95", "unit": "s", "values": [null, null, null], "median": null, "failures": [null, null, null] }
  ]
}
```

- **값은 전부 null인 형식 예시다 — 측정값이 아니다.** reverse의 키는 exp · op(update · point · atomic · constraint · insert) · store · variant · scale(work_order 행 수) · concurrency · rate(EXP-44 req/s) · read(EXP별 판독 라벨 — EXP-40 R1 · R2는 {단계}:{판독기} 합성형(before_merge · after_wait · after_force × 판독 설정) · 가시성은 판독기 이름 · 물리 비용은 after_writes · after_wait · after_force · EXP-42는 inject · pairs · probe와 팔 · EXP-43은 before_merge · final · after_wait · after_force · window_{N} · 나머지는 null — 라벨 목록의 정본은 실행기 코드) · metric · unit · values · median이며, 구조 지표는 structural true로 표시해 판독기가 중앙값이 아니라 3회 전부를 본다. streamSteps는 계단 pps마다 두 싱크의 행을 둔다.

## 예상 결과

**전부 미확인이다 — 확정 전 임의 값 고정 금지.** 아래는 원본이 남긴 일반론 · 예상치이며 목표가 아니다. 4요소가 없으므로 "원본 예상치"로만 인용한다.

| 항목 | 원본 예상치 | 이 실험이 대신 내놓는 것 |
|------|------|------|
| 범위 집계 비용 | PostgreSQL은 1억 행 이상에서 급격히 증가(원본 tech_stack.md §5.1) | 쿼리별 역전 행 수 — "1억"이 이 머신에서 어디인가 |
| 삽입 처리량 | PostgreSQL 단독 1만~5만 rows/s · ClickHouse 100만+ rows/s(원본 tech_stack.md §5.2) | 같은 배치 · 같은 자원에서의 두 값 |
| 압축률 | PostgreSQL 1~3배 · ClickHouse 10~30배 | 공통 분모 기준 · 신호 프로파일별 |
| autovacuum · WAL | "부담이 크다"(원본 tech_stack.md §5.1) — 수치 없음 | 삽입 바이트당 WAL · 머지 증폭 |
| 역전 지점 | 없음 | 쿼리 5종 각각의 행 수 또는 "관측 범위 안에서 역전 없음" |

- 검산: 항목 = **5**
- **쿼리마다 역전 지점이 다를 것이라는 것만이 설계의 가정이다.** 전체 스캔(Q5)은 이른 단계에서, 단일 태그 1시간(Q1 · I2)은 늦은 단계에서 또는 끝내 역전하지 않을 수 있다 — 하나의 숫자로 요약하지 않는다([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 쿼리별 역전 지점 · 비교 축 6의 값 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-01~05 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 |
| 동시 적재 기전(flusher 안의 위치 · 전용 커넥션 관리) | 닫힘(W4) — ClickHouse 삽입 성공 뒤 COPY 1회 · 전용 커넥션 1 · 트랜잭션 1 · XACK는 대조군 성패와 무관 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전 |
| 모드 D 구간의 대조군 같은 행 채우기 절차 | 닫힘 — §모드 D 백필과 대조군 동일 행(같은 행 벡터 · 날짜 단위 · 일마다 count 대조) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 대조 실험 전용 자원 조건 | **W6 판정 반영** — 메모리 3.5 · 3.5 GB(09_tech_stack/04) · CPU 집합 크기 동일(04_architecture/03 §대조 실험 자원 조건) | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| 적재 시간 · 디스크 예산(중단 규칙) | **W6 판정** — 적재 시간은 1계층 관계(경과 < 보존 − D_k) · 디스크 예산은 식 고정 · 값은 실험 시작 시 실측 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값 |
| 대조군 실패 계수 · 무효 구간 기록의 메트릭 이름 | **W6 판정** — ing_control_copy_failures_total + 구조화 로그 이벤트 control_copy_failed | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| Q5 문턱 {v}의 선택도 | **W6 판정** — 격자 1단계 적재 직후 quantileExact(0.5)(value)로 한 번 정해 고정 · 선택도 50% | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 역방향 대조 EXP-40~44의 값 전부(갱신 · 가시성 · 물리 비용 · 점조회 · 부분 반영 · 경합 위반 · 수용 건수 · FINAL 비용 · 단건 삽입) | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 04_storage_split #9 주장도 이 결과로 확정한다 | EXP-40~44 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |
| PostgreSQL COPY가 플러시 주기를 넘는 pps | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-45 |
| ClickHouse UPDATE(경량 · ALTER)가 갱신 행 수를 응답으로 돌려주는가 | 판별 대상 — 26.8 실행기 첫 실행이 응답 요약을 원시에 남긴다 · EXP-42 동시 완료 해석의 전제 | EXP-42 |
| CHECK CONSTRAINT가 UPDATE 경로(경량 · ALTER)에도 검사되는가 | 판별 대상 — 공식 문서는 INSERT 검사만 적는다 | EXP-43 |
| index_granularity 생성 뒤 변경 불가 · 그래뉼 변형의 자리 | **이 문서 판정** — 실행 범위 변형 테이블(§그래뉼 변형 판정 ②) · 변경 불가는 실행기 첫 실행이 판별 | EXP-41 · [03_clickhouse_schema.md](./03_clickhouse_schema.md) |
| 실행기 조정값(폴링 간격 · 상한 · 갱신 건수 N · 상태 분포 · 동시 완료 쌍 수 · 중복 삽입 K · 중복 제거 윈도우 N · EXP-44 커넥션 수 · 동시성 · EXP-44 ⓑ async_insert 플러시 설정 값 — 공정성 규칙 1에 따라 두 저장소 같은 값) | 2계층 — 실행기 소유 · 기록 조건 칸에 적는다 | 첫 EXP-40~44 기록 |

## 관련 문서

- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 ① · 역전 지점 판정의 모양
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — 동형의 기준 tag_raw
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 대조군 전용 커넥션 · 한계 등재 #5
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 대조군 보존 정합
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 동시 적재 기전
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — EXP-01~05 실행
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-09 · 조합 제약 #4
- [01_postgresql_schema.md](./01_postgresql_schema.md) — 역방향 대조의 업무 테이블 · 허용 전이
- [09_migrations_seed.md](./09_migrations_seed.md) — ClickHouse DDL 순번 009 · 시드의 결정성
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — #9 주장(역방향 검증 대상)
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 구조 판정 · 기계 판독 블록
- [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) — EXP-45 계단 · 판정 창
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-17
