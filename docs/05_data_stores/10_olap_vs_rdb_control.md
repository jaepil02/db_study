# PostgreSQL 대조군 (10_olap_vs_rdb_control)

> **대상**: 학습 목표 ① 설계 정본 — PostgreSQL 대조군 plc_tag_raw_control의 tag_raw 동형 설계(BRIN · 일자 파티션) · SW-09 동시 적재 · 삽입 실패 의미론과 멱등 수단 판정 · 동일 쿼리 5종(양쪽 SQL) · 비교 축 6 · 역전 지점 탐색 설계(행 수 격자) · 측정 조건 · EXP-01~05 예약 대역 연결
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 동시 적재 기전 행 닫힘(06_pipeline/04 W4 판정)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(모드 D 대조군 동일 행 절차) — 테이블 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 격자 6단계 보존 판정 · 조정값 · EXP 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 대조 실험 자원 조건의 메모리 동일화 값 → ClickHouse 3.5 GB · PostgreSQL 3.5 GB(정본 09_tech_stack/04 · 합계 불변)
> **원천**: docs_plan.md 학습 목표 1(대조군 설계) · 웨이브 인계 W3 05/10 · W4 06/04 행(SW-09 삽입 실패 의미론 · PostgreSQL 멱등 수단) · 원본 tech_stack.md §5.1 "왜 여기에 시계열을 넣지 않나" · §5.2(커밋 ff66a37) · 원본 architecture.md §7.1 · §13 · §15(커밋 ff66a37) · 원본 data_flow.md §10.1 · §11.1 · §11.2(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §5 S5(커밋 ff66a37) · D-05 · D-10 · D-12 · ADR-17 · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 목표 ① · [../03_requirements/07_ingest.md](../03_requirements/07_ingest.md) REQ-ING-15 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18

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

## 관련 문서

- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 ① · 역전 지점 판정의 모양
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — 동형의 기준 tag_raw
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 대조군 전용 커넥션 · 한계 등재 #5
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 대조군 보존 정합
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 동시 적재 기전
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — EXP-01~05 실행
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-09 · 조합 제약 #4
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-17
