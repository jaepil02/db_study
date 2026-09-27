# PostgreSQL 대조군 (10_olap_vs_rdb_control)

> **대상**: 학습 목표 ① 설계 정본 — PostgreSQL 대조군 plc_tag_raw_control의 tag_raw 동형 설계(BRIN · 일자 파티션) · SW-09 동시 적재 · 삽입 실패 의미론과 멱등 수단 판정 · 동일 쿼리 5종(양쪽 SQL) · 비교 축 6 · 역전 지점 탐색 설계(행 수 격자) · 측정 조건 · EXP-01~05 예약 대역 연결 · **스트리밍 동시 적재 EXP-45 · 역방향 대조(업무 워크로드를 ClickHouse에) EXP-40~44 설계** · **결과(쿼리별 역전 구간 · 비교 축 6 · 역방향 대조표) · 원리 대응표 — 측정 기록 034 · 042~054 인용** · **실행 수명 객체(라이브 실행 perf — plc.run_perf_raw · run_perf_raw) · 라이브 실행의 쿼리 재사용 규칙**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-28 — 리드 판정(구현 i-run 문의) — 실행 수명 객체 PostgreSQL 생성 · 삭제 주체 → **마이그레이션 010의 SECURITY DEFINER 함수 run_perf_create · run_perf_drop**(런타임 app_rw DDL 권한 없음 유지 · 소유자 비밀번호를 api에 주지 않는다) — 객체 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 실행 수명 객체의 생성 식 고정(행 번호 n · **ts 오름차순 삽입(ORDER BY n)** · device_id · tag_id · value 식 · 두 저장소 같은 식) · 규모 증가분 구간(k = 5는 [S, S + 10초) · k > 5는 [S + 10^(k−1) ÷ 10^4초, S + 10^k ÷ 10^4초)) · perf 전용 PostgreSQL 연결 1 — 객체 · 규칙 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27) — 동형 표 ts · ingested_at DateTime64(3, 'Asia/Seoul') → **'UTC'** · 대조군 DDL 주석 경계 Asia/Seoul 자정 → **UTC 자정** · 사후 대조 단위 KST 일 → **UTC 일(파티션 경계)** · 파티션 경계 불릿 KST 자정 → **UTC 자정** — 컬럼 · 폭 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — §실행 수명 객체 신설(ClickHouse plc.run_perf_raw · PostgreSQL run_perf_raw — tag_raw · 대조군 동형 · I2 변형만 · 실행마다 생성 · 종결 시 DROP · 부팅 시 정리 · **고정 기준 테이블 수에 세지 않는다**) · 라이브 실행의 쿼리 재사용 규칙(동일 쿼리 5종 그대로 · 웜만 · 워밍업 1 + 3회 · Q5x 제외) · 라이브 값이 측정 기록이 아니라는 A형 — 테이블 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — 버린 대안 ② 칸의 고정 기준 인용 "업무 14 + 대조군 1" → **업무 · 대조군 부모 테이블 수**(수치는 정본이 갖는다) — 판정 불변
> **개정일**: 2026-09-27 — W6 검수 반영 — Q5 웜 10^5 미정 · 10^5.5부터 ClickHouse를 판정 문장 전부에 · 열 단위 읽기 원리를 Q5로 한정(Q4는 읽는 비율 3.11% 대 3.6%라 설명되지 않음) · BRIN 블록을 hit + read로 통일(10^8 36.1% · 10^9 3.6%) · ClickHouse 머지 증폭 수치 삭제(머지 시점 의존 — 인용 안 함 · WAL 바이트 유지) · 1차 폐기 사유(편차 초과)와 적재 순서의 BRIN 붕괴(039)를 가름 · synchronous_commit off 병기(044 on 보조 팔로 결론 유지) · 버퍼 블록 ≈ 읽은 태그 행 수 · btree 31.6 · 31.5 B · WAL 분모 표현 · 결정적 값 태그 3곳 · 비교 축 6 헤더에 PG 저장 열 구성과 압축률 분모 차 · §예상 결과 역전 행은 역전 표 검산 줄을 가리킴
> **개정일**: 2026-09-27 — W6 결과 반영 — §결과 신설(쿼리별 역전 구간 — 구조 판정 정본 · 중앙값 구간 참고 · 비교 축 6 · 역방향 대조표 EXP-40~45 — 기록 034 · 042~054) · §원리 대응 — 관측에서 원인 구조로 신설(읽은 양 ÷ 테이블 양) · §예상 결과 실측 대조 열 · §미확인 · 미설계 등재 닫힘 7행 · §역전 지점 탐색 설계 "쌓이는 순서" 불릿에 1차 어긋남(역방향 적재)과 2차 해소 한 줄 — 인용 규칙은 04 §기록 상태와 정정(discarded는 구조 사실 · 결정적 값만)
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
> **원천**: docs_plan.md 학습 목표 1(대조군 설계) · 웨이브 인계 W3 05/10 · W4 06/04 행(SW-09 삽입 실패 의미론 · PostgreSQL 멱등 수단) · 원본 tech_stack.md §5.1 "왜 여기에 시계열을 넣지 않나" · §5.2(커밋 ff66a37) · 원본 architecture.md §7.1 · §13 · §15(커밋 ff66a37) · 원본 data_flow.md §10.1 · §11.1 · §11.2(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §5 S5(커밋 ff66a37) · D-05 · D-10 · D-12 · ADR-17 · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 목표 ① · [../03_requirements/07_ingest.md](../03_requirements/07_ingest.md) REQ-ING-15 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 · 목적 적합성 실증 계획 W1(2026-09-26 · 역방향 대조 · EXP-40~45) · ClickHouse 공식 문서 UPDATE 문 · 업데이트 개요 · ReplacingMergeTree · 테이블 제약 · 삽입 재시도 중복 제거 · 비동기 삽입 세션 설정(26.8 · 2026-09-26 context7 대조 — ClickHouse 문서 행 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) · 대조 항목 추가는 그 문서 소유) · 라이브 실행 제어 리드 판정(2026-09-28 — 실행 수명 객체 · 쿼리 재사용)

**학습 목표 ①은 "시계열을 왜 RDB가 아니라 컬럼형으로 다루는가"를 측정으로 아는 것이다**([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)). 원본에는 RDB 대조 실험이 아예 없었고, PostgreSQL에 시계열을 넣지 않는 이유는 타인의 벤치마크 범위로만 적혀 있었다(원본 tech_stack.md §5.1 · §5.2). 이 문서는 그 이유를 이 머신 · 이 스키마 · 이 쿼리에서 재는 **실험의 설계**다(D-05 · ADR-17).

**산출물은 승패가 아니라 쿼리별 역전 지점이다.** 100만 행에서는 PostgreSQL이 이길 수도 있다 — 인덱스 점조회와 짧은 범위 조회에서 행 기반 저장은 충분히 빠르고 ClickHouse는 파트 스캔의 고정 비용을 낸다. 몇 행부터 역전되는지(또는 관측 범위 안에서 역전이 없는지)가 결과이며, 설계는 값을 예측하지 않는다. 격자 2차가 낸 **구조 판정 역전 구간**(반복 3회 우열이 같은 점만 끝점)이 §결과에 있고, 구간 안의 정밀 행 수와 쿼리 시간의 크기는 **3계층 미확인**으로 남는다(격자 기록이 전부 편차 폐기다).

**설계와 실행을 가른다.** 이 문서가 왜 · 무엇을(테이블 · 적재 · 쿼리 · 축 · 격자)을 갖고, 어떻게(절차 · 판정 지표)는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP-01~05 예약 대역이 갖는다. 측정 기록의 값을 이 설계의 칸(쿼리 · 축 · 원리)에 올린 자리는 §결과 · §원리 대응 — 관측에서 원인 구조로다. 동시 적재의 기전은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md), 모드 D 구간의 같은 행 채우기 절차는 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)가 갖는다.

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
| ts | DateTime64(3, 'UTC') | timestamptz NOT NULL | 8 · 8 | 같다 — 값은 epoch ms · PG 정밀도 μs가 ms 값을 정확히 담는다 |
| device_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 — 값 범위가 2^31 미만 |
| tag_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 |
| value | Float64 | double precision NOT NULL | 8 · 8 | 같다 — 비트 단위 동일 |
| quality | UInt8 | **smallint** NOT NULL | 1 · **2** | 다르다 — PostgreSQL에 1바이트 정수가 없다. 폭 차 1바이트를 기록한다 |
| scan_seq | UInt64 | bigint NOT NULL | 8 · 8 | 같다 — 값 범위가 2^63 미만 |
| ingested_at | DateTime64(3, 'UTC') DEFAULT now64(3) | timestamptz NOT NULL DEFAULT now() | 8 · 8 | 같다 — 한 적재 단위의 행이 같은 값을 받는다(질의 · 트랜잭션 단위 1회 평가) |

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
) PARTITION BY RANGE (ts);                       -- 일자 파티션 · 경계 UTC 자정(ADR-27) · pg_partman 관리

CREATE INDEX plc_tag_raw_control_ts_brin
    ON plc_tag_raw_control USING brin (ts);       -- 인덱스 변형 I1(기본)

-- 인덱스 변형 I2에서만 추가:
-- CREATE INDEX plc_tag_raw_control_key_btree ON plc_tag_raw_control (device_id, tag_id, ts);
```

- **PK · UNIQUE · FK를 두지 않는다.** tag_raw는 기본 키 유일성 · 참조 검사를 하지 않는다. 대조군에만 두면 삽입 처리량 · 인덱스 크기 축이 두 엔진의 차가 아니라 제약 비용의 차를 잰다 — 멱등을 유일 제약으로 풀지 않는 이유와 같다(§삽입 실패 의미론).
- **파티션 경계는 tag_raw의 toYYYYMMDD(ts)와 같은 UTC 자정이다(ADR-27).** DB 기본 timezone이 UTC라 pg_partman이 같은 경계로 만든다(옛 KST 경계 볼륨은 순번 009가 다시 세운다 · [09_migrations_seed.md](./09_migrations_seed.md) §DB 시간대 전환 · [02_postgresql_constraints.md](./02_postgresql_constraints.md)). 경계가 다르면 보존 · 쿼리 창의 경계 행이 한쪽에만 있다.
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
| ② 배치 토큰 원장 테이블 | 재전달 중복 | 테이블 수 · 삽입 경로 | PostgreSQL 테이블 수 고정 기준(업무 · 대조군 부모 테이블 수)이 바뀌고 배치마다 원장 쓰기 · 조회가 더해진다 |
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
⑥ 사후 대조          UTC 일(파티션 경계) 단위 구간 count 대조 — 어긋난 구간의 계단은 무효
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

역전 지점은 행 수 축 위의 한 점이다. **격자는 설계 값이고 역전 지점의 정밀 행 수는 3계층 미확인이다** — 격자 2차가 좁힌 구조 구간은 §결과가 갖는다.

| 단계 | 총 행 수 | 구성(M 티어 배치 · 1 Hz 누적) | 데이터 기간(도출) |
|:-:|------|------|------|
| 1 | 10^5 | 설비 50 × 태그 200 | 10초 |
| 2 | 10^6 | 상동 | 100초 |
| 3 | 10^7 | 상동 | 약 17분 |
| 4 | 10^8 | 상동 | 약 2.8시간 |
| 5 | 10^9 | 상동 | 약 28시간 |
| 6 | 6 × 10^9 | 상동 | 약 7일 — **원시 보존 상한** |

- 검산: 기본 격자 = **6**단계 · 행 수 = 1만 태그 × 초 · 6단계 상한 = 10,000 × 604,800 ≈ 6.05 × 10^9(원본 M 티어 7일 행 수 60.5억과 같다)
- **구성을 고정하고 기간으로 키운다.** 시스템이 실제로 쌓이는 순서 그대로라 쿼리 창과 데이터 밀도(태그당 1 Hz)가 단계마다 같다. 태그 수로 키우면 Q3(설비 전체)의 결과 행 수가 단계마다 달라져 역전이 데이터 폭의 효과와 섞인다. **1차 구현(기록 035~039)은 이 문장과 어긋났다** — 1차는 편차 초과로 전부 폐기됐고, 따로 데이터 끝을 고정하고 과거로 채운 적재 순서가 5단계에서 BRIN을 무너뜨렸다(파티션 ts 상관 0.027 → PostgreSQL이 BRIN을 버리고 Seq Scan · 기록 039). 2차(기록 048~053)는 시작 S를 고정하고 미래 방향으로 누적해 해소했다 — 5단계 I1 Q1이 Bitmap Heap Scan으로 돌아왔다(기록 052 · 한계 등재 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md)).
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

## 실행 수명 객체

EXP-PERF 화면의 성능 비교 라이브 실행(type perf)이 격자의 앞부분을 다시 채울 자리다. 실행 단계 · 취소 · 채우기 규칙의 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §라이브 실행 — perf · flow이고, 이 절은 **객체 모양 · 수명 · 쿼리 재사용 규칙**을 고정한다.

**A형 — 라이브 실행의 쿼리 시간은 이 문서의 측정 기록이 아니다.** 통념은 같은 쿼리 · 같은 분포면 라이브 값이 §결과의 칸을 채운다는 것이다. 부정 — 라이브 실행은 api를 거쳐(드라이버 · 풀 · 이벤트 루프 포함) 웜 3회만 재고, 4요소 · 실험 3회 중앙값 · 편차 판정 · 콜드가 없다. 격자 기록은 호스트 CLI로 앱을 거치지 않고 쟀다(기록 048 조건). 진짜 축은 **재는 경로와 기록 규칙**이다. 대체 경로 — 라이브 결과는 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지를 달고 docs/measurements 기록을 만들지 않으며, 역전 구간 · 비교 축의 정본은 §결과(기록 048~053)만이다.

| 저장소 | 객체 | 동형 기준 | 인덱스 | 수명 |
|------|------|------|------|------|
| ClickHouse | plc.run_perf_raw | tag_raw(ClickHouse 원시 테이블)와 **컬럼 · 엔진 · 정렬 키 · 파티션 · 코덱 동형** — TTL 절만 뺀다 | 희소 기본 인덱스(정렬 키) — tag_raw와 같다 | 실행 시작(prepare) 때 생성 · **종결(완료 · 중단 · 실패) 때 반드시 DROP** · api 부팅 때 남은 것 DROP |
| PostgreSQL | run_perf_raw | plc_tag_raw_control과 **컬럼 · 컬럼 순서 · 일 파티션 경계 동형** — 파티션은 실행이 덮는 일(1~2개)만 prepare가 만든다(pg_partman 등록 없음) | **I2 변형만** — BRIN(ts) + btree(device_id, tag_id, ts) | 상동 |

- 검산: 객체 = **2** · 저장소마다 1
- **PostgreSQL 쪽 생성 · 삭제는 함수 둘로만 한다(리드 판정 2026-09-28).** 런타임 계정 app_rw는 DDL 권한이 없다(001 · 12_security) — 마이그레이션 010이 app_owner 소유 SECURITY DEFINER 함수 run_perf_create(p_from, p_to)(부모 · 덮는 UTC 일 파티션 · I2 인덱스 생성 · 규모를 올릴 때 다시 불러 파티션 추가 · app_rw에 SELECT · INSERT · MAINTAIN 부여)와 run_perf_drop()(DROP IF EXISTS)을 만들고 EXECUTE만 app_rw에 준다. 채우기 · ANALYZE · 쿼리 · 취소(같은 역할의 pg_cancel_backend)는 app_rw로 한다 — api에 소유자 비밀번호를 주면 런타임이 모든 업무 테이블의 DDL을 얻는다. ClickHouse는 api 계정의 DDL 권한 그대로다.
- **고정 기준 테이블 수에 세지 않는다.** 수명이 실행 하나이고 실행 밖에는 존재하지 않는다 — 업무 · 대조군 부모 테이블 수(루트 README 고정 기준)와 ClickHouse 객체 수는 이 둘을 더하지 않는다. 스키마 문서(01_postgresql_schema · 03_clickhouse_schema)는 이 절을 가리키는 포인터만 둔다.
- **운영 테이블을 건드리지 않는다.** tag_raw · plc_tag_raw_control에 쓰지도 지우지도 않는다 — 라이브 실행이 격자 대조군을 채우면 SW-09 · 모드 D의 구간 count 대조(REQ-NFR-18)가 실행 행으로 어긋난다.
- **I2만 두는 이유 — 격자 053 구조 판정의 기준 변형이 I2다.** 역전 구간은 전부 I2 대비로 정했고(§쿼리별 역전 구간), I1 대비는 전 범위 ClickHouse 우세라 버튼 실행이 새로 보일 것이 없다. 두 변형을 다 재면 I2 빌드가 실행마다 한 번 더 들어 10^8에서 btree 약 3 GB(§대조군 용량 축)를 두 번 쓴다.
- **TTL을 빼는 이유** — 실행 데이터의 ts는 실행 시작 시각까지 과거 약 2.8시간(10^8) 안이라 TTL이 지울 행은 없지만, TTL 절이 있으면 머지가 TTL 평가를 더해 채우기 직후 파트 상태가 tag_raw 격자와 달라질 여지가 생긴다. 수명은 DROP이 정한다.
- **이름이 하나로 고정된 것은 동시 1의 결과다(B형).** 결론 — 실행마다 접미를 붙이지 않는다. 반대 시나리오 — runId 접미를 붙이면 api 크래시 뒤 부팅 정리가 지울 이름의 목록을 따로 기억해야 하고, 그 목록이 메모리뿐이라 크래시와 함께 사라져 고아 테이블이 디스크를 계속 쓴다. 파생 지침 — 동시 실행을 허용하는 변경은 이 이름 규칙과 부팅 정리를 같은 변경 단위에서 다시 판정한다.

아래는 객체 DDL 계약이다(설계 계약 · 구현 코드 아님 · 순번 마이그레이션이 아니라 실행이 만든다).

```sql
-- ClickHouse — tag_raw DDL의 컬럼 · 코덱 · ENGINE · PARTITION BY · ORDER BY · SETTINGS 그대로, TTL 절 없음
CREATE TABLE plc.run_perf_raw ( /* tag_raw와 같은 컬럼 7 */ )
ENGINE = MergeTree PARTITION BY toYYYYMMDD(ts) ORDER BY (device_id, tag_id, ts);

-- PostgreSQL — 대조군과 같은 컬럼 순서 · 일 파티션 · I2
CREATE TABLE run_perf_raw (LIKE plc_tag_raw_control INCLUDING DEFAULTS) PARTITION BY RANGE (ts);
-- 실행이 덮는 일마다 CREATE TABLE run_perf_raw_pYYYYMMDD PARTITION OF run_perf_raw FOR VALUES FROM (…) TO (…);
CREATE INDEX ON run_perf_raw USING brin (ts);
CREATE INDEX ON run_perf_raw (device_id, tag_id, ts);

-- 종결 · 부팅 정리
DROP TABLE IF EXISTS plc.run_perf_raw;   -- ClickHouse
DROP TABLE IF EXISTS run_perf_raw;       -- PostgreSQL(파티션 함께)
```

- **PostgreSQL 일 파티션 경계는 대조군과 같은 경계식을 쓴다** — 경계가 다르면 Q3(1일 창)의 파티션 가지치기가 격자와 달라진다. 경계식 · 시간대의 정본은 [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md)다.
- **btree는 채우기 전에 만든다.** 격자는 I1 쿼리 뒤 I2를 지었지만(기록 048 ⑥) 라이브 실행은 I2만 재므로 규모를 올릴 때마다 인덱스를 다시 지을 이유가 없다 — 채우기 시간(fillMs.pg)에 btree 유지 비용이 들어간다는 점이 격자 적재 계측과 다르다.

### 라이브 실행의 쿼리 재사용

| 규칙 | 계약 | 어기면 |
|------|------|------|
| 쿼리 | §동일 쿼리 5종 **그대로** — 같은 SQL(테이블 이름만 run_perf_raw) · 같은 매개변수 규칙({device} · {tag} = (device_id, tag_id) 사전순 첫 쌍 · {end} = 그 규모의 데이터 끝 · {v} = 첫 규모 채우기 직후 quantileExact(0.5)(value)로 한 번 정해 고정) | 쿼리를 화면용으로 줄이면 라이브 결과가 §결과의 어느 칸과도 대응하지 않는다 |
| Q5x 제외 | 조건 없는 count(보조 관찰 Q5x)는 돌리지 않는다 | ClickHouse가 파트 메타데이터로 답해 "전체 스캔 1 ms"로 읽힌다(§동일 쿼리 5종 A형) |
| 캐시 | **웜만** — 쿼리 · 저장소마다 워밍업 1회 버림 + 3회 | 버튼 실행에서 콜드(컨테이너 재기동)를 만들면 api · 운영 경로 전체가 끊긴다 |
| 결과 | 3회 값 · 중앙값 · 빠른 쪽 · 배수(PG ÷ CH) · 결과 행 수 일치(resultMatch) | 결과가 다른 두 쿼리의 속도를 비교하게 된다 |
| 격자와의 관계 | 곡선에 라이브 계열로 따로 그린다(다른 마커 · 범례 "라이브 실행(시연값)") · 역전 음영은 053 구조 판정만 | 라이브 점이 기록 점과 한 계열이 되면 시연값이 정본 곡선을 흔든다 |

- 검산: 규칙 = **5**
- 데이터 분포(태그 10,000 = 설비 50 × 태그 200 · 1 Hz · 기간 = 행 수 ÷ 10,000초 · quality 9)는 §역전 지점 탐색 설계의 격자 구성과 같다. 값은 결정적 정수 산술 식이라 격자의 신호 프로파일과 압축이 다르다 — 라이브 storageBytes는 §결과 비교 축 6과 겹쳐 읽지 않는다.

두 저장소가 **같은 식**으로 만드는 생성 식이다(ClickHouse numbers · PostgreSQL generate_series가 n을 준다 · 채우기 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §성능 비교 실행 — perf).

```plain
n          행 번호 — 0부터 · 규모 k의 증가분은 k = 5면 0 ~ 10^5 − 1 · k > 5면 10^(k−1) ~ 10^k − 1
sec        n div 10000
ts         S + sec초 — 규모 k의 증가분 구간은 k = 5면 [S, S + 10초) · k > 5면 [S + 10^(k−1) ÷ 10^4초, S + 10^k ÷ 10^4초)
idx        n mod 10000
device_id  idx div 200 + 1     (1~50)
tag_id     idx + 1             (1~10000)
value      ((tag_id × 7 + sec × 13) mod 1000) ÷ 10
quality    9
삽입 순서   ts 오름차순(ORDER BY n)
```

- **ts 오름차순 삽입이 BRIN · 파트 모양을 격자와 맞춘다.** 삽입 순서가 ts와 어긋나면 PostgreSQL 힙의 ts 상관이 무너져 BRIN이 블록 범위를 좁히지 못한다(1차 기록 039의 붕괴와 같은 원인).
- **정수 산술만 쓴다** — 두 엔진의 정수 mod와 Float64 나눗셈 한 번은 같은 비트를 낸다 · 엔진별 수학 함수(sin 등)는 마지막 비트가 달라 resultMatch · avg 대조가 흔들린다.
- **PostgreSQL 쪽은 실행 수명 동안 전용 연결 1(풀 밖)로 채우고 잰다** — 취소가 그 연결의 pid를 겨눈다(기전 정본 06_pipeline/10 §취소 · 정리).

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

해석 문단이 관측을 저장 구조로 설명하는 자리다. 오른쪽 두 열은 구조 사실이다. 이 표는 설계 때의 질문이고, 관측 값은 §결과 역방향 대조표 · §원리 대응 — 관측에서 원인 구조로가 채운다.

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

## 결과

측정 기록 034 · 042~054를 이 설계의 칸에 올린다. **인용은 기록 상태를 따른다**([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정) — valid 기록은 3회 중앙값을 4요소(커밋 · 메모리 프로파일 · 용량 티어 · 스위치 상태)와 함께 싣고, discarded 기록은 구조 사실(우열 3/3 · 계획 노드 · 읽은 행 · 블록 수 · 결과 일치 · 원자성 · 제약 판정)과 단계당 1회 결정적 값(저장 · 인덱스 · WAL 바이트 · 압축률 · 파트 수)만 싣는다. discarded 기록의 ms · 배수 · 처리량은 기록 번호로만 가리킨다.

- **격자 기록 048~053은 전부 discarded다** — 콜드 1회 실행 분산과 서브 ms 서버 값이 편차 20%를 넘었다(한계 등재 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md)). 그래서 쿼리 축은 우열 방향만, 비 쿼리 축은 결정적 값만 이 절에 오른다.
- **모든 ClickHouse 측정에는 서버 로그 trace 수준의 쓰기 부하가 들어 있다**(이미지 기본값 · 측정 중 바꾸지 않음 · 07_measurement_limits) — ClickHouse 쪽 절대값은 이 몫을 가르지 않은 값이다.

### 쿼리별 역전 구간 — 구조 판정(정본)

기록 053(discarded · 구조 판정 · 격자 2차 11점 = 단계 5 + 정밀화 6)의 최종 판정이다. **반복마다의 우열 부호가 3회 모두 같은 점만 끝점이 된다** — 부호는 그 반복의 pair가 동률(ClickHouse client 1 ms 해상도 안)이면 서버 µs, 아니면 client 중앙값으로 정한다. 구간은 (아래 점, 위 점]이고 PostgreSQL 쪽은 I2(btree)다.

| 쿼리 | 웜 — I2 대비 | 콜드 — I2 대비 | I1(BRIN만) 대비 | 우열 미정 점(끝점 제외) |
|------|------|------|------|------|
| Q1 단일 태그 1시간 | 역전 없음 — 10^5~10^9 PostgreSQL I2 우세 | **(10^7, 10^7.25]** I2 → ClickHouse | 웜 · 콜드 10^5~10^9 ClickHouse 우세 | 없음 |
| Q2 단일 태그 7일 | **(10^7.5, 10^8.25]** I2 → ClickHouse | **(10^7, 10^7.25]** I2 → ClickHouse | 상동 | 10^8 웜 |
| Q3 설비 전체 1일 | **(10^5.75, 10^6]** I2 → ClickHouse | **(10^5.5, 10^6]** I2 → ClickHouse | 상동 | 10^5.75 콜드 |
| Q4 분 단위 롤업 재계산 | 역전 없음 — 10^5~10^9 ClickHouse 우세 | 상동 | 상동 | 없음 |
| Q5 비정렬 열 조건 count | 10^5 우열 미정 · 10^5.5~10^9 ClickHouse 우세 | 역전 없음 — 10^5~10^9 ClickHouse 우세 | 웜 10^5 우열 미정 · 그 위와 콜드 ClickHouse 우세 | 10^5 웜(I1 · I2) |

- 검산: 판정 칸 = 쿼리 5 × 캐시 2 × 변형 2 = **20** — 역전 있음 5(전부 I2 대비 · 웜 Q2 · Q3 · 콜드 Q1 · Q2 · Q3) + 역전 없음 · 미정 15 = **20**
- **"ClickHouse 우세 — 10^5부터"는 역전이 관측 범위 아래(10^5행 이하)에 있다는 뜻이다.** Q4 · Q5 콜드와 I1 대비(Q5 웜 제외)가 그렇다 — 첫 점부터 ClickHouse가 앞서므로 이 격자는 그 아래를 재지 않았다. Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse다.
- **Q5 웜 10^5는 반복 우열이 갈렸다**(I1 PG · CH · CH · I2 CH · CH · PG — 기록 048) — 끝점이 될 수 없어 구간 대신 "미정 · 그 위 ClickHouse"로 적는다.
- 결과 대조 — 정밀화 6점 36/36 · 롤업 대조 6/6(기록 053) · 단계 5점 각 기록의 match 전부 true(기록 048~052) — 두 저장소가 같은 답을 냈다.
- **한계 — 동률 점의 서버 µs 판정은 PostgreSQL 쪽으로 기운다**(PostgreSQL 서버 시간은 계획 시간을 빼고 ClickHouse는 파싱 · 계획을 넣는다 — serverTimeAsymmetry). client 부호만으로 구조 판정하면 콜드 Q1 (10^6, 10^7] · Q2 (10^6, 10^7.25] · Q3 (10^5, 10^5.5]가 된다 — 웜 구간은 client만으로도 같다(기록 053).

중앙값 기준 구간은 **참고**다 — 점 중앙값의 앞선 쪽으로 같은 규칙을 적용한 값이며 정본이 아니다(기록 053).

| 쿼리 | 웜(참고) | 콜드(참고) | 구조 구간과 다른 칸 |
|------|------|------|------|
| Q1 | 역전 없음(10^5~10^9 I2 우세) | (10^7, 10^7.25] | 없음 |
| Q2 | (10^8, 10^8.25] | (10^7, 10^7.25] | 웜 — 10^8의 반복 우열이 PG · PG · CH로 갈려 구조 구간의 아래 끝이 10^7.5 |
| Q3 | (10^5.75, 10^6] | (10^5.75, 10^6] | 콜드 — 10^5.75의 반복 우열이 CH · PG · PG로 갈려 구조 구간의 아래 끝이 10^5.5 |
| Q4 · Q5 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 없음 |

- 검산: 행 = **4**(Q4 · Q5 한 행) · 다른 칸 = **2**

### 비교 축 6

격자 2차 단계 기록의 비 쿼리 축이다. 전부 **discarded 기록의 결정적 값**(단계당 1회 · I1 상태 · 안정화 뒤)이다. 행당 값은 이 표의 바이트 ÷ 행 수다. **PostgreSQL 저장 열은 힙과 인덱스(I1 BRIN · 파티션 전부)를 더한 값이고, 압축률 분모는 ClickHouse bytes_on_disk 대 PostgreSQL pg_table_size(힙 · FSM · VM · TOAST — 인덱스 제외)라 두 열의 PostgreSQL 분모가 다르다.** ClickHouse 머지 증폭은 머지 시점에 좌우되는 값이라 결정적 값이 아니다 — 기록 048~052를 참고로 가리키고 인용하지 않는다.

| 단계 · 기록 | 저장 bytes CH · PG(I1 · 힙 + 인덱스) — 행당 B | 압축률 CH · PG(공통 논리 41 B × 행 ÷ 분모) | PG WAL 증폭(WAL bytes ÷ 증가 행 × 41 B) — WAL bytes | 인덱스 bytes CH · BRIN · btree(I2) |
|------|------|------|------|------|
| 10^5 · 048 | 537,029 · 8,519,680 — 5.37 · 85.20 | 7.63 · 0.511 | 1.385 — 5,679,986 | 360 · 245,760 · 3,252,224 |
| 10^6 · 049 | 4,930,420 · 77,152,256 — 4.93 · 77.15 | 8.32 · 0.535 | 1.251 — 46,144,728 | 3,221 · 245,760 · 31,637,504 |
| 10^7 · 050 | 44,687,468 · 766,590,976 — 4.47 · 76.66 | 9.17 · 0.535 | 1.248 — 460,682,100 | 27,502 · 262,144 · 315,514,880 |
| 10^8 · 051 | 440,122,785 · 7,659,085,824 — 4.40 · 76.59 | 9.316 · 0.5354 | 1.797 — 6,629,623,964 | 253,611 · 491,520 · 3,154,337,792 |
| 10^9 · 052 | 4,528,577,595 · 76,584,214,528 — 4.53 · 76.58 | 9.054 · 0.5354 | 1.857 — 68,525,395,670 | 3,271,454 · 2,531,328 · 31,542,476,800 |

- 검산: 단계 = **5** · 축 = 저장 용량 · 압축률 · VACUUM/WAL 증폭(PostgreSQL WAL 쪽) · 인덱스 크기 **4**(이 표) + 삽입 처리량 · 쿼리 시간 **2**(아래 불릿) = **6**
- **축 4 쿼리 시간은 우열 방향만 오른다** — §쿼리별 역전 구간이 그 값이다. 단계 · 정밀화 점의 ms는 기록 048~053이 갖고 정본에 오르지 않는다.
- **축 3 삽입 처리량(단독 적재 rows/s)은 인용하지 않는다** — 기록 048~053의 값이며 처리량은 결정적 값이 아니다. 같은 배치를 받는 두 싱크의 시간은 valid 기록 045가 잰다(§역방향 대조표 EXP-45 행).
- **PostgreSQL 압축률이 1보다 작은 것은 구조다** — 힙 행당 약 76.6 B는 튜플 헤더 24 + 데이터 42 → 정렬 72 + 줄 포인터 4 = 76 B 구조 계산(§대조군 용량 축)과 같다. 10^5의 85.20 B는 파티션별 인덱스 491,520 B가 작은 표에 나뉜 몫이다 — 힙만은 행당 80.0 B(기록 048).
- **btree(I2) 행당은 10^6부터 거의 고정이다** — 31.6 B(10^6 · 31,637,504 ÷ 10^6) · 31.6 B(10^7) · 31.5 B(10^8 · 10^9 · 31,542,476,800 ÷ 10^9) — I2가 산 조회(Q1 웜 역전 없음)의 대가가 행 수에 선형이다.
- **ClickHouse 머지 증폭은 이 표에 없다** — 창 안 머지 실행 시점에 좌우되는 값이라(10^5~10^7은 창 안 머지 0 · 파트 1~5) 결정적 값이 아니다. 머지 시점 의존 — 기록 048~052 참고 · 인용 안 함.
- 신호 프로파일별 압축(EXP-35) — 혼합 **9.16** · RANDOM_WALK **5.70**(보수적인 쪽) · 범위 STEP 124.44 ~ DROPOUT 5.41(기록 034 · valid · 5492c73 · 부하 실험 · M · SW-09 off · SW-10 off · 1시간 36,000,000행 · 파트 1 수렴). 격자의 혼합 압축률(7.63~9.316 · 10^5~10^9 · 048~052 결정적 값)은 같은 방향이지만 파트 · 행 수 조건이 달라 한 표에 겹치지 않는다.

### 역방향 대조표 — EXP-40~45

업무 워크로드를 ClickHouse에 넣었을 때와 스트리밍 적재의 두 싱크다. valid 기록의 4요소 — 042 · 043 · 044 = 19f8861 · 부하 실험 · 티어 해당 없음 · 스위치 기본값 / 046 = 5492c73 · 부하 실험 · 티어 해당 없음 · 스위치 기본값 / 045 = 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 배치 안 A. 규모 10^4 · 10^5 · 10^6 전부 같은 결과인 칸은 한 값으로 적는다.

| EXP · 기록 · 상태 | 질문 | PostgreSQL | ClickHouse | 판정 |
|------|------|------|------|------|
| EXP-40 · 047 · discarded(구조 사실만) | 행 하나의 상태 전이 갱신 | 갱신 300건 = tup_upd 300 · dead_tup 300 · hot_upd 0(9/9 호출) — 새 튜플 버전 · 죽은 튜플 · 인덱스 키 컬럼이라 HOT 불가 | ①② ALTER UPDATE 1건 = 파트 전 행 재작성(MutatePart 300 · 행 합 = 규모 × 300) · ③ 경량 UPDATE 1건 = patch 파트 1개(new_parts 300) · 자연 대기 뒤 patch 미반영 · ④ RMT plain 판독은 50건 × 3회 × 3규모 전부 상한 안에 새 값만 보이는 상태 미관측 · 같은 키 중복 50 → 강제 머지 뒤 0(10^5 · 10^6) | 갱신 단위가 PostgreSQL은 행 · ClickHouse는 파트 · patch · 새 버전 행이다. 가시성 · 갱신 지연 크기는 인용 불가(편차 초과 두 번 — 040 · 047) |
| EXP-41 · 046 · valid | PK 점조회 | p50 0.101 · 0.103 · 0.102 ms(동시성 1) · 조회당 행 1 · 블록 3 · 3 · 4 · Index Scan | 그래뉼 8192 p50 4.176 · 4.167 · 4.268 ms · read_rows 10,000 · 8,359.06 · 8,188.19 / 그래뉼 256 p50 3.981 · 3.973 · 4.16 ms · read_rows 257.6 · 256.64 · 256 · index_granularity MODIFY 거부(code 472) | 읽는 행은 그래뉼 크기에 묶이지만(10^6 행 비 32.0 = 그래뉼 비) 지연은 조회 한 건의 고정 비용이 정한다. PostgreSQL 동시성 8 · 32 처리량은 도구 이벤트 루프 상한에 가려 저장소 상한으로 인용하지 않는다 |
| EXP-42 · 042 · valid(구조 3회 전부) | 완료 단위 원자성 · 같은 주문 동시 완료 | 부분 반영 **0/20** · 경합 위반 **0/20**(3규모 × 3회) — 끊긴 트랜잭션은 버려지고 두 번째 조건부 UPDATE는 행 잠금 뒤 0행 → ROLLBACK | 경량 UPDATE auto · sync 두 팔 모두 부분 반영 **20/20** · 경합 위반 **20/20** · 갱신 행 수 응답 없음(written_rows 0 — 맞힌 문장 · 빗나간 문장 같다) | 불변식(완료 주문 = 실적 1행)을 PostgreSQL은 저장소가 지키고 ClickHouse는 앱이 져야 한다 |
| EXP-43 · 043 · valid(구조 3회 전부) | 무결성 제약 | 수용 2/17 — ⓐ 같은 order_no 동시 8 중 1 · ⓓ 재삽입 2 중 1 · 없는 line_id · CHECK 3종(INSERT · UPDATE) 전부 거절 | MergeTree 수용 17/20 · RMT 11/14 — 거절은 INSERT 경로 CHECK 3종뿐 · **UPDATE 경로(경량 · ALTER) CHECK 미검사** · RMT는 ⓐ 8행이 강제 머지 뒤에도 8 · ⓓ만 1 · 중복 제거 윈도우 100은 재삽입을 1행으로(응답은 오류 없음) · FINAL ÷ 비 FINAL p50 0.95~0.97(수렴 테이블 + 새 행 11개 조건) | 무결성이 PostgreSQL은 쓰기 시점 보장 · ClickHouse는 정렬 키 · 블록 내용 단위의 최종적 수렴이다 |
| EXP-44 · 044 · valid | 단건 고빈도 삽입 50 · 200 · 500 req/s | synchronous_commit off p50 0.967 · 0.572 · 0.550 ms · WAL 343.7 · 341.3 · 338.5 B/삽입(레코드 약 5) · 죽은 튜플 0 | 동기 p50 5.834 · 3.399 · 2.777 ms · 새 파트 = 삽입 수(3,000 · 12,000 · 30,000) · Delayed · Rejected 0 / async_insert(wait 1) p50 114.031 · 691.552 · 708.868 ms · 달성 49.9 · 86 · 86.7 req/s | PostgreSQL은 쓰기 단위가 행이라 비용이 요청률에 무관하고, ClickHouse는 요청 하나가 파트 하나거나(동기) 응답이 플러시 주기에 묶인다(async) — 파트 한도는 500 req/s × 60초 안에서 오지 않았다 |
| EXP-45 · 045 · valid | 스트리밍 동시 적재 — 같은 배치를 받는 두 싱크 | COPY p50 12.51 · 25.0 · 65.0 · 65.0 ms(10,000 · 20,000 · 50,000 · 100,000 pps — 20,000부터 한 칸 보간) · COPY 실패 0 · WAL 51.5 · 50.9 · 53.5 · 52.5 B/행 · 죽은 튜플 0 | 삽입 p50 64.22 · 65.08 · 91.81 · 83.95 ms · 배치 하나 = tag_raw 파트 하나 · 새 파트 8.2 · 7.2 · 5.8 · 5.8 B/행 + 뒤에서 머지 | **PostgreSQL COPY가 플러시 주기를 넘는 pps — 관측 범위 10,000~100,000 pps 안 없음**(COPY p95 중앙값 최대 78.5 ms 대 타임아웃 500 ms). 배치 행 상한 50,000이라 50,000 · 100,000 계단은 같은 크기 배치다 |

- 검산: EXP = **6** — valid 5(042 · 043 · 044 · 045 · 046) + discarded 1(047)
- **EXP-45의 배치당 시간은 PostgreSQL이 더 짧다 — 스트리밍 경로에서 PostgreSQL이 시계열을 못 받는다는 뜻이 아니다(A형).** 통념은 "PostgreSQL은 시계열 적재를 못 따라간다"다. 부정 — 배치 안 A(행 상한 50,000)에서 COPY는 모든 계단에서 ClickHouse 삽입보다 짧고 실패 0이다(COPY 세션 synchronous_commit off — ClickHouse 기본 삽입도 fsync를 기다리지 않는 조건 · 공정성 규칙 5). 진짜 축은 **적재가 아니라 적재한 뒤의 읽기 · 저장 비용**이다 — 같은 행을 PostgreSQL은 행당 약 76.6 B 힙 + 단일 태그 조회용 btree 행당 약 31.5 B로 들고(§비교 축 6), 전 설비 집계(Q4)와 콜드 전 행 스캔(Q5)은 관측 범위 아래에서 이미 역전된다 — Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse(§쿼리별 역전 구간). 대체 경로 — 적재 단가가 아니라 §원리 대응의 읽은 양 비로 목적지를 정한다. ClickHouse 삽입 시간에는 MV 연쇄(tag_1m · 1h · 1d) 쓰기가 들어 있다(기록 045 한계).
- **EXP-41 · 44 · 45의 ClickHouse 값은 trace 로그 부하를 포함하고, 046의 PostgreSQL 동시성 8 · 32 칸은 도구 상한에 가깝다** — 인용 한정은 각 기록의 해석 한계 불릿이 갖는다.

## 원리 대응 — 관측에서 원인 구조로

학습 목표 ①의 해석 문단이 쓰는 표다. 관측 하나마다 그것을 만든 저장 구조를 잇는다. 관측 열의 출처가 discarded 기록이면 구조 사실 · 결정적 값만 쓴다.

| 원리 | 관측(기록 · 상태) | 원인 구조 | 가리키는 것 |
|------|------|------|------|
| 열 단위 읽기 | Q5 10^9 — ClickHouse read_bytes 8,000,000,000 = 공통 논리 크기의 19.51%(= 8 B ÷ 41 B · value 열 하나) 대 PostgreSQL 힙 9,345,856블록 전부(100.0%)(052 · discarded 결정적 값) | 열마다 파일이 따로라 조건 열만 읽는다 · 힙은 행 전체가 한 페이지에 있어 한 열을 읽으려 해도 모든 페이지를 읽는다 | 전 행 한 열 조건(Q5)은 읽는 바이트의 비로 설명된다 — 콜드는 10^5부터 · 웜은 10^5 미정 · 10^5.5부터 ClickHouse. Q4(1시간 창 전 설비)는 읽는 비율이 거의 같아(ClickHouse 3.11% 대 PostgreSQL 힙 3.6%) 열 단위 읽기로 설명되지 않는다 |
| 희소 인덱스(그래뉼) | PK 점조회 read_rows 8,188.19 · 256(10^6 · 그래뉼 8192 · 256)(046 · valid) · 격자 Q1 10^9 read_rows 32,768 = 그래뉼 4개로 결과 3,600행(052) | 기본 인덱스는 그래뉼(기본 8,192행)마다 한 항목 — 행이 아니라 그래뉼을 가리킨다 | 범위 · 집계의 읽기 단위를 줄이지만 점조회를 행 단위로 만들지 않는다 — 업무 키 조회는 PostgreSQL |
| 코덱 · 정렬 | 정렬 키 · 품질 네 열 원시 행당 0.0226 B · 압축 바이트의 93.4%가 value 한 열 · 열 압축 배수 device_id 961.9 · ts 650.1 · value 1.9(혼합)(034 · valid · 5492c73 · 부하 실험 · M · SW-09 off · SW-10 off) | ORDER BY (device_id, tag_id, ts)로 정렬된 열에 Delta가 반복을 만들고 ZSTD가 접는다 · value는 Gorilla가 이웃 값 XOR로 줄인다 | PLC 행이 불어나는 몫(식별 · 시각 열)은 거의 공짜다 — 행당 저장 4.40~5.37 B 대 76.58~85.20 B(048~052 · discarded 결정적 값) |
| 파트 머지 | 동기 INSERT 새 파트 = 삽입 수 · 머지가 뒤따름(044 · valid) · 스트리밍 창 새 파트 180 · 360(= 배치 수) · 머지 약 5 새 파트마다 1회(045 · valid · 참고 관측) · 단계 창의 머지 증폭은 머지 시점 의존이라 인용 안 함(048~052 참고) | 파트는 불변이고 삽입 단위마다 새로 생긴다 · 합치는 비용은 백그라운드 머지가 뒤에서 낸다 | 쓰기 단위가 작을수록 머지가 커진다 — 단건 업무 쓰기에 맞지 않고 큰 배치 적재에 맞는다 |
| 불변 파트 대 힙 | 스트리밍 적재 PostgreSQL 죽은 튜플 0 · autovacuum은 삽입 문턱(045 · valid) · 갱신은 PostgreSQL 죽은 튜플 300 대 ClickHouse 파트 재작성 · patch 파트(047 · discarded 구조 사실) | 추가 전용 힙은 뒤처리가 없고, 갱신은 새 튜플 버전(MVCC)이다 · ClickHouse 갱신은 불변 파트를 다시 쓰거나 patch를 덧댄다 | 추가 전용 시계열은 두 엔진 모두 뒤처리가 작고, 갱신이 섞이는 순간 ClickHouse의 단위가 파트로 커진다 |
| B-tree | 점조회 블록 3 · 3 · 4(10^4 · 10^5 · 10^6)(046 · valid) · 격자 I2 역전 칸 버퍼 블록 ≈ 읽은 태그 행 수(r7.25 Q1 1,778행 · 1,788블록 · r8.25 Q2 태그 행 17,800 · 17,881블록)(053 · discarded 구조 사실) · btree 행당 31.5~31.6 B(049~052 · discarded 결정적 값) | 루트 → 리프 몇 페이지로 행을 가리킨다 · 힙이 삽입 순서(1초에 1만 태그)라 같은 태그의 이웃 행은 서로 다른 페이지 — 행 하나에 페이지 하나 | 읽는 행이 적으면(Q1 1시간 · 점조회) btree가 이기고, 읽는 행이 늘면 페이지 수만큼 비용이 는다 — Q2 · Q3 역전의 원인 |
| BRIN | Q1 I1 버퍼 블록(hit + read) 10^8 337,204(힙의 36.1%) · 10^9 336,887(= 10^9 힙의 3.6% · 1시간 창 ÷ 데이터 27.8시간)(051 · 052 · discarded 구조 사실) · BRIN 10^9 2,531,328 B(052 · discarded 결정적 값) · Q2 I1 10^9 Seq Scan 힙 100.0% | 블록 범위의 ts 최소 · 최대만 적는다 — ts 순서로 쌓인 힙에서 창 밖 범위를 건너뛰지만 device · tag 조건은 거르지 못한다 · 1차 역방향 적재에서는 ts 상관 0.027로 쓸모를 잃었다(039) | 작고 쌓는 순서에 기대는 인덱스 — 단일 태그 조회에서는 I1 대비 전 범위 ClickHouse 우세 |
| MVCC | 갱신 300건 = 죽은 튜플 300 · HOT 0(047 · discarded 구조 사실) | UPDATE는 새 튜플 버전을 쓰고 옛 버전은 VACUUM을 기다린다 · 인덱스 키 컬럼 갱신은 HOT 불가 | 상태 갱신 비용은 행 단위로 유한하다 — 업무의 상태 전이에 맞는 단위 |
| WAL | 단건 삽입 WAL 약 340 B · 레코드 약 5(044 · valid) · 배치 COPY WAL 51~54 B/행 일정(045 · valid) · 격자 WAL bytes ÷ (증가 행 × 41 B) 1.248~1.857(048~052 · discarded 결정적 값) | 모든 변경을 먼저 로그에 쓴다 — 행 수에 비례 · 체크포인트 뒤 첫 수정 페이지는 전체 이미지(FPI) | 내구성의 대가가 행 수에 선형이다 — 시계열 행 수에서는 저장 바이트만큼 쌓이는 비용 |
| 행 잠금 · 트랜잭션 | 부분 반영 0 · 경합 위반 0 대 ClickHouse 20 · 20(042 · valid) | 문장 여럿이 한 커밋 · 조건부 UPDATE가 행을 잠가 두 번째 완료가 0행을 본다 · ClickHouse는 문장 단위 원자성 · 갱신 행 수 응답 없음 | 여러 행을 한 단위로 바꾸는 업무 쓰기는 PostgreSQL |
| 제약 | 수용 PostgreSQL 2/17 대 MergeTree 17/20 · RMT 11/14 · ClickHouse CHECK는 INSERT 경로만(043 · valid) | UNIQUE는 btree 검사 · FK는 참조 행 검사 · CHECK는 모든 쓰기 경로 커밋 전 · ClickHouse는 UNIQUE · FK가 없고 RMT는 정렬 키 단위로 머지 뒤에만 합친다 | 업무 무결성은 쓰기 시점 보장이 필요하다 — PostgreSQL |

- 검산: 원리 = 열 단위 읽기 · 희소 인덱스 · 코덱 · 파트 머지 · 불변 파트 대 힙 · B-tree · BRIN · MVCC · WAL · 행 잠금 · 트랜잭션 · 제약 = **11**행(행 잠금 · 트랜잭션은 한 행)

**읽은 양 ÷ 테이블 양 — 10^9행(기록 052 · discarded · 구조 사실 · 결정적 값).** 원리가 수치로 드러나는 자리다. ClickHouse는 반복 1 웜 첫 측정의 query_log(read_bytes는 비압축) ÷ 공통 논리 크기 41,000,000,000 B, PostgreSQL은 반복 1 EXPLAIN 최상위 노드 shared hit + read(이 절의 블록 수는 전부 hit + read) ÷ 힙 9,345,856블록이다.

| 쿼리 | CH read_rows · read_bytes(÷ 공통 논리) | PG I1 버퍼 블록(÷ 힙) · 계획 | PG I2 버퍼 블록(÷ 힙) · 계획 | 결과 행 |
|------|------|------|------|------:|
| Q1 | 32,768 · 458,879(0.00%) | 336,887(3.6%) · Bitmap Heap Scan(BRIN) | 3,618(0.0%) · Index Scan | 3,600 |
| Q2 | 188,416 · 3,694,560(0.01%) | 9,345,932(100.0%) · Seq Scan × 5 | 100,399(1.1%) · Index Scan × 5 | 28 |
| Q3 | 17,547,264 · 421,134,336(1.03%) | 8,075,165(86.4%) · Bitmap Heap Scan + Seq Scan | 11,984,036(128.2%) · Index Scan + Seq Scan | 200 |
| Q4 | 51,028,480 · 1,275,712,000(3.11%) | 336,901(3.6%) · Bitmap Heap Scan | 336,901(3.6%) · Bitmap Heap Scan | 600,000 |
| Q5 | 1,000,000,000 · 8,000,000,000(19.51%) | 9,345,856(100.0%) · Seq Scan × 10 | 9,345,856(100.0%) · Seq Scan × 10 | 1 |

- 검산: 쿼리 = **5**
- **ClickHouse는 모든 쿼리에서 테이블의 1/5 이하를 읽는다 — Q5도 value 열 하나(8 B ÷ 41 B = 19.51%)다.** PostgreSQL은 인덱스가 조건과 맞지 않는 칸(Q2 · Q5 I1 · Q5 I2)에서 힙 전부를 읽고, I2가 맞는 Q1 · Q2에서도 결과 행 하나에 페이지 하나를 읽는다(Q1 3,600행 · 3,618블록 · Q2 태그 행 100,000 · 100,399블록).
- **Q3 I2의 128.2%는 버퍼 적중이 접근 횟수라서다** — 같은 페이지를 여러 태그가 다시 방문한다(설비 1 = 태그 200이 한 페이지를 나눠 쓴다). 행 기반 힙에서 인덱스가 늘리는 것은 읽는 페이지의 선택이지 페이지 안의 불필요한 열이 아니다.
- **BRIN이 읽는 블록 수는 쌓는 순서에서 나온다** — hit + read 10^8 337,204블록(힙의 36.1%)과 10^9 336,887블록(힙의 3.6%)이 같은 규모다(기록 051 · 052) · 테이블이 10배여도 1시간 창만큼만 읽는다. 1차(역방향 적재)의 같은 쿼리는 p20260926 파티션 전체 4,706,013블록을 Seq Scan했다(기록 039 · discarded · 대조로만).

## 예상 결과

원본이 남긴 일반론 · 예상치와 실측의 대조다. 원본 값은 4요소가 없어 "원본 예상치"로만 인용하고 목표로 읽지 않는다. 실측 칸은 기록 상태의 인용 규칙(§결과 첫 단락)을 따른다.

| 항목 | 원본 예상치 | 이 실험이 대신 내놓는 것 | 실측 대조(기록 · 상태) |
|------|------|------|------|
| 범위 집계 비용 | PostgreSQL은 1억 행 이상에서 급격히 증가(원본 tech_stack.md §5.1) | 쿼리별 역전 행 수 — "1억"이 이 머신에서 어디인가 | **"1억"은 쿼리 하나(Q2 웜 · I2)의 자리다** — 구조 구간 (10^7.5, 10^8.25]. Q3 I2는 10^6 이하 · 콜드 Q1 · Q2는 (10^7, 10^7.25] · Q4 · Q5 콜드와 I1 대비는 10^5 아래 · Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse · Q1 웜 I2는 10^9까지 역전 없음(053 · discarded 구조 판정) |
| 삽입 처리량 | PostgreSQL 단독 1만~5만 rows/s · ClickHouse 100만+ rows/s(원본 tech_stack.md §5.2) | 같은 배치 · 같은 자원에서의 두 값 | 단독 적재 rows/s는 격자 기록(048~053 · discarded)이라 인용 불가 · **같은 배치의 싱크 시간은 모든 계단에서 PostgreSQL COPY가 짧다**(COPY p50 12.51~65.0 ms 대 삽입 64.22~91.81 ms · 10,000~100,000 pps · 045 · valid · COPY 세션 synchronous_commit off) · 단건은 PostgreSQL p50 0.550~0.967 ms(synchronous_commit off) 대 ClickHouse 동기 2.777~5.834 ms(044 · valid) — on 보조 팔도 1.011~1.897 ms라 결론이 유지된다(044) |
| 압축률 | PostgreSQL 1~3배 · ClickHouse 10~30배 | 공통 분모 기준 · 신호 프로파일별 | PostgreSQL **0.511~0.5354**(1 미만 — 튜플 헤더) · ClickHouse 격자 7.63~9.316(048~052 · discarded 결정적 값) · 프로파일별 혼합 9.16 · RANDOM_WALK 5.70 · STEP 124.44(034 · valid) — 두 원본 범위 모두 이 분모에서는 맞지 않는다 |
| autovacuum · WAL | "부담이 크다"(원본 tech_stack.md §5.1) — 수치 없음 | 삽입 바이트당 WAL · 머지 증폭 | WAL bytes ÷ (증가 행 × 41 B) 1.248~1.857(048~052 · discarded 결정적 값) · ClickHouse 머지 증폭은 머지 시점 의존 — 기록 048~052 참고 · 인용 안 함 · 스트리밍 WAL 51~54 B/행 · 죽은 튜플 0 · autovacuum 창마다 1~3회(045 · valid) — 추가 전용에서 부담은 WAL 바이트이지 VACUUM이 아니다 |
| 역전 지점 | 없음 | 쿼리 5종 각각의 행 수 또는 "관측 범위 안에서 역전 없음" | §결과 쿼리별 역전 구간 — 칸 수는 그 표의 검산 줄이 센다(053 · discarded 구조 판정) |

- 검산: 항목 = **5**
- **설계의 가정 — 쿼리마다 역전 지점이 다르다 — 은 성립한다.** 전체 스캔(Q5)은 콜드에서 관측 범위 아래에서 이미 역전했고 웜은 10^5 미정 · 10^5.5부터 ClickHouse이며 단일 태그 1시간(Q1 · I2)은 웜에서 끝내 역전하지 않았다(10^9까지) — 원래 문장("Q5는 이른 단계 · Q1 · I2는 늦은 단계에서 또는 끝내 역전하지 않을 수 있다")의 두 끝이 다 관측됐다. 하나의 숫자로 요약하지 않는다([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)).
- **정밀 행 수는 여전히 미확인이다** — 구간 폭 10^0.25 · 10^0.5 · 10^0.75 안의 교차점, 쿼리 시간의 크기, 다른 태그 · 설비 매개와 다른 자원 조건(3 vCPU · 3.5 GiB)의 구간은 재지 않았다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 쿼리별 역전 지점 · 비교 축 6의 값 | **부분 닫힘(W6)** — 역전은 구조 구간으로 확정(웜 Q1 역전 없음 · Q2 (10^7.5, 10^8.25] · Q3 (10^5.75, 10^6] · 콜드 Q1 · Q2 (10^7, 10^7.25] · Q3 (10^5.5, 10^6] · Q4 · Q5 콜드 · I1 대비 ClickHouse 전 범위 · Q5 웜 10^5 미정 · 10^5.5부터 ClickHouse — 기록 053 · discarded 구조 판정) · 비 쿼리 축은 결정적 값(기록 048~052) — **구간 안 정밀 행 수 · 쿼리 시간 크기 · 삽입 처리량은 3계층 미확인 유지** | §결과 · EXP-01~05 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 |
| 동시 적재 기전(flusher 안의 위치 · 전용 커넥션 관리) | 닫힘(W4) — ClickHouse 삽입 성공 뒤 COPY 1회 · 전용 커넥션 1 · 트랜잭션 1 · XACK는 대조군 성패와 무관 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전 |
| 모드 D 구간의 대조군 같은 행 채우기 절차 | 닫힘 — §모드 D 백필과 대조군 동일 행(같은 행 벡터 · 날짜 단위 · 일마다 count 대조) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 대조 실험 전용 자원 조건 | **W6 판정 반영** — 메모리 3.5 · 3.5 GB(09_tech_stack/04) · CPU 집합 크기 동일(04_architecture/03 §대조 실험 자원 조건) | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| 적재 시간 · 디스크 예산(중단 규칙) | **W6 판정** — 적재 시간은 1계층 관계(경과 < 보존 − D_k) · 디스크 예산은 식 고정 · 값은 실험 시작 시 실측 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값 |
| 대조군 실패 계수 · 무효 구간 기록의 메트릭 이름 | **W6 판정** — ing_control_copy_failures_total + 구조화 로그 이벤트 control_copy_failed | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| Q5 문턱 {v}의 선택도 | **W6 판정** — 격자 1단계 적재 직후 quantileExact(0.5)(value)로 한 번 정해 고정 · 선택도 50% | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 역방향 대조 EXP-40~44의 값 전부(갱신 · 가시성 · 물리 비용 · 점조회 · 부분 반영 · 경합 위반 · 수용 건수 · FINAL 비용 · 단건 삽입) | **닫힘(W6) — 가시성 · 갱신 지연 크기만 미확인 유지** — 점조회 046 · 부분 반영 · 경합 위반 042 · 수용 건수 · RMT 중복 · FINAL 비용 043 · 단건 삽입 044(전부 valid) · 갱신 단위 · RMT plain 미관측은 047 구조 사실(discarded) — 가시성 · 갱신 지연 · 재작성 바이트는 040 · 047 두 번 편차 초과로 인용 불가 · 04_storage_split #9는 원자성 · 제약 · 갱신 단위로 확정 | §결과 역방향 대조표 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |
| PostgreSQL COPY가 플러시 주기를 넘는 pps | **닫힘(W6)** — 관측 범위 10,000~100,000 pps 안 없음 · COPY 실패 0(기록 045 · valid · 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 배치 안 A) — 100,000 pps 너머 · 배치 안 B · C는 미확인 유지 | EXP-45 · §결과 |
| ClickHouse UPDATE(경량 · ALTER)가 갱신 행 수를 응답으로 돌려주는가 | **닫힘(W6) — 돌려주지 않는다** — 경량 UPDATE · ALTER UPDATE(mutations_sync 1) 모두 응답 요약 written_rows 0 · 맞힌 문장과 빗나간 문장이 같다(기록 042 · 26.8.10.6) | EXP-42 |
| CHECK CONSTRAINT가 UPDATE 경로(경량 · ALTER)에도 검사되는가 | **닫힘(W6) — 검사하지 않는다** — 경량 UPDATE · ALTER UPDATE(mutations_sync 1)의 CHECK 3종 위반이 3규모 × 3회 전부 수용되고 되읽힌다 · 같은 값의 INSERT는 거절(기록 043 · 26.8.10.6) | EXP-43 |
| index_granularity 생성 뒤 변경 불가 · 그래뉼 변형의 자리 | **이 문서 판정** — 실행 범위 변형 테이블(§그래뉼 변형 판정 ②) · **변경 불가 닫힘(W6)** — MODIFY SETTING 거부 code 472(3규모 전부 · 기록 046) | EXP-41 · [03_clickhouse_schema.md](./03_clickhouse_schema.md) |
| 실행기 조정값(폴링 간격 · 상한 · 갱신 건수 N · 상태 분포 · 동시 완료 쌍 수 · 중복 삽입 K · 중복 제거 윈도우 N · EXP-44 커넥션 수 · 동시성 · EXP-44 ⓑ async_insert 플러시 설정 값 — 공정성 규칙 1에 따라 두 저장소 같은 값) | 2계층 — 실행기 소유 · 기록 조건 칸에 적는다 · **첫 기록 반영됨(W6)** — 기록 042~044 · 046 · 047 조건 칸 | 기록 042~044 · 046 · 047 |

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
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — 라이브 실행 perf의 채우기 · 단계 · 취소
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-17
