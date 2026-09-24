# ClickHouse 스키마 (03_clickhouse_schema)

> **대상**: ClickHouse 객체 9(테이블 5 · MV 3 · Dictionary 1)의 목록과 원시 · 판정 테이블 tag_raw · alarm_eval DDL · 코덱 · 파티션 · 정렬 키(ADR-15) · 중복 제거(ADR-14) · 시각 컬럼 시간대 표기 통일 · dict_tag DDL · 품질 코드 컬럼 판정 · 서버 설정 계약
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — background_pool_size 8의 파생 병합 설정 3(10 · 12 · 4) 등재 — 없으면 25.8이 기동을 거부한다(S0 확인)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 실험 자리 W6 결과 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 서버 timezone 미확인 → **Asia/Seoul**(정본 09_tech_stack/03) · 스키마는 여전히 서버 설정에 기대지 않는다 — 설정 수 불변
> **개정일**: 2026-09-24 — W4 판정 반영 — Dictionary 즉시 반영 단 번호 ③ → **④**(무효화 체인 6단 표기)
> **원천**: 원본 architecture.md §5 · §7.1 · §7.3 · §7.4 · §7.5 · §12 · §15(커밋 ff66a37) · 원본 tech_stack.md §5.2(커밋 ff66a37) · 원본 data_flow.md §4 · §4.3 · §11.2 · §14.1 · §14.2(커밋 ff66a37) · docs_plan.md 보정 #16 · 웨이브 인계(ingested_at · alarm_eval.ts 시간대 표기 통일) · ADR-03 · ADR-14 · ADR-15 · ADR-16 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 시각 의미론 정본

ClickHouse는 **분기 ①계층(태그 원시값)의 유일한 목적지**이고 ②계층 판정 전수의 목적지다(ADR-03 · D-04). 이 문서는 원시 · 판정 테이블의 모양과 ClickHouse 쪽 공통 규약을 고정한다. 롤업 테이블 tag_1m · tag_1h · tag_1d와 MV 3의 명세는 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md)가, Dictionary가 지키는 교차 저장소 원칙은 [07_cross_store_consistency.md](./07_cross_store_consistency.md)가 갖는다.

**시계열은 불변 사실 기록이다.** 행을 고치지 않고, 삭제는 파티션 단위 TTL로만 하며, 해석에 필요한 메타(태그명 · 단위)는 행에 싣지 않고 조회 시점에 Dictionary로 붙인다(ADR-16 · REQ-MST-12). 아래 DDL은 설계 계약이지 구현 코드가 아니다 — 적용 순번은 [09_migrations_seed.md](./09_migrations_seed.md)가 정한다.

## 객체 목록

| # | 객체 | 종류 | 엔진 · 레이아웃 | 소유 도메인 | 쓰는 주체 | 명세 |
|:-:|------|------|------|:------:|------|------|
| 1 | plc.tag_raw | 테이블 | MergeTree | ING | ING(모드 A · B · C) · GEN 모드 D(소유 아님) | 이 문서 |
| 2 | plc.tag_1m | 테이블 | AggregatingMergeTree | ING | mv_tag_1m · 백필 INSERT SELECT | [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |
| 3 | plc.tag_1h | 테이블 | AggregatingMergeTree | ING | mv_tag_1h | 상동 |
| 4 | plc.tag_1d | 테이블 | AggregatingMergeTree | ING | mv_tag_1d | 상동 |
| 5 | plc.alarm_eval | 테이블 | MergeTree | ALM | ALM 판정(ALM-05) | 이 문서 |
| 6 | plc.mv_tag_1m | MV | TO tag_1m | ING | tag_raw 삽입이 발동 | [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |
| 7 | plc.mv_tag_1h | MV | TO tag_1h | ING | tag_1m 삽입이 발동 | 상동 |
| 8 | plc.mv_tag_1d | MV | TO tag_1d | ING | tag_1h 삽입이 발동 | 상동 |
| 9 | plc.dict_tag | Dictionary | HASHED · PostgreSQL 소스 | MST | LIFETIME 재적재 · SYSTEM RELOAD | 이 문서 §dict_tag |

- 검산: 테이블 5(#1~#5) + MV 3(#6~#8) + Dictionary 1(#9) = **9**
- **롤업 객체의 소유는 ING로 확정한다(잠정 → 확정).** 판정 근거는 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §도메인 귀속 판정이다. GEN은 모드 D로 tag_raw · 롤업에 쓰지만 소유하지 않는다 — 도메인 공백(소유 테이블 없음 6)은 그대로다.
- 모든 객체는 데이터베이스 plc로 한정해 이름을 쓴다(REQ-ING-05 — 한정하지 않은 이름은 default 데이터베이스의 같은 이름 객체에 오류 없이 닿는다).

## tag_raw — 원시 테이블

롱 포맷(태그당 1행) · 일자 파티션 · 정렬 키(device_id · tag_id · ts)가 ADR-15의 결정이다. 원본 DDL에서 **시각 컬럼 시간대 명시 · TTL 파트 단위 삭제 설정** 두 곳을 바꿨다.

```sql
CREATE TABLE IF NOT EXISTS plc.tag_raw
(
    ts          DateTime64(3, 'Asia/Seoul')                  CODEC(Delta(8), ZSTD(1)),
    device_id   UInt32                                       CODEC(Delta(4), ZSTD(1)),
    tag_id      UInt32                                       CODEC(Delta(4), ZSTD(1)),
    value       Float64                                      CODEC(Gorilla, ZSTD(1)),
    quality     UInt8                                        CODEC(ZSTD(1)),
    scan_seq    UInt64                                       CODEC(Delta(8), ZSTD(1)),
    ingested_at DateTime64(3, 'Asia/Seoul') DEFAULT now64(3) CODEC(Delta(8), ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (device_id, tag_id, ts)
TTL toDateTime(ts) + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192,
         non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1;
```

- **ingested_at에 'Asia/Seoul'을 붙였다.** 원본은 ts에만 시간대 인자를 달아 같은 행의 두 시각이 문자열 출력 · 달력 함수에서 서로 다른 시간대를 따랐다. 저장값(epoch)은 바뀌지 않는다 — §시각 컬럼 시간대 표기.
- **ttl_only_drop_parts = 1이 "TTL 삭제는 파티션 DROP"을 참으로 만든다.** 이 설정이 없으면 만료 행은 머지 때 행 단위로 다시 쓰여 지워진다 — 원본이 적은 "파티션 DROP으로 즉시 완료"(원본 architecture.md §7.1)는 설정 없이는 성립하지 않는다. 일자 파티션이라 한 파트 안의 행은 같은 날짜여서 파트 전체가 함께 만료된다.
- **TTL 7일 · 중복 제거 윈도우 1000은 2계층 조정값이다.** 보존 값의 정본은 [08_retention_lifecycle.md](./08_retention_lifecycle.md), 윈도우 · 백오프 합계 계약의 정본은 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)다.
- ingested_at을 적재 코드가 보내지 않는다 — 서버 DEFAULT가 채워야 E2E 지연이 Stream 대기 · 삽입 구간을 포함한다(REQ-ING-05).

## 설계 근거 — 파티션 · 정렬 키 · 형식

| 요소 | 결정 | 근거 | 버린 것의 실패 |
|------|------|------|------|
| 형식 | 롱 포맷(태그당 1행) | 설비마다 태그 구성이 다르고 태그 추가가 잦다 | 와이드 포맷 — 태그 추가가 ALTER가 되고 MV · 대조군 DDL이 함께 깨진다(원본 data_flow.md §10.2 ALTER 취약) |
| PARTITION BY | toYYYYMMDD(ts) — **KST 날짜** | TTL이 파티션 단위로 떨어지고 보존 변경이 파티션 단위로 된다 | 월 — 파티션이 커져 TTL이 한 달 단위로만 떨어진다. 시간 — 파티션 수가 폭증해 삽입 블록이 여러 파티션에 걸친다 |
| ORDER BY | (device_id, tag_id, ts) | 조회는 "특정 설비의 특정 태그를 시간 범위로"다. 카디널리티 낮은 컬럼을 앞에 두어 압축과 희소 인덱스 가지치기를 얻는다 | (ts, …) — 시간 범위 조회는 빨라 보이지만 단일 태그 조회가 모든 태그의 그래뉼을 읽는다 |
| ORDER BY 변경 | **불가** — 새 테이블 생성 후 이관 | 계약 변경 규칙(원본 data_flow.md §14.2) | ALTER로 흉내 내면 정렬이 다른 파트가 섞여 인덱스가 무의미해진다 |
| index_granularity | 8192(기본) | 원본 기본값 · 좁은 시간 범위 조회가 많으면 4096이 실험 대상 | 해당 없음 |
| 행 폭 | 7컬럼 · 문자열 없음 | tag_id(4바이트)만 저장하고 이름은 dictGet(ADR-16) | 태그명 컬럼 — 이름 변경이 과거 행 mutation이 된다 |
| 파티션당 삽입 | 한 배치는 보통 1~2일 파티션에 걸친다 | 모드 D 백필은 여러 날짜를 한 INSERT에 싣는다 | 한 INSERT가 max_partitions_per_insert_block(서버 기본)을 넘으면 거절된다 — 백필 절차는 날짜 단위로 쪼갠다([04_clickhouse_rollup.md](./04_clickhouse_rollup.md)) |

- 검산: 요소 = **7**
- **device_id를 정렬 키 맨 앞에 두는 것이 태그의 설비 이동을 금지하는 이유다.** 같은 tag_id가 두 device_id 아래로 갈리면 (device_id, tag_id) 접두 조회가 한쪽 구간을 놓친다 — PostgreSQL 가드 트리거가 tag_master.device_id 갱신을 막는다([02_postgresql_constraints.md](./02_postgresql_constraints.md)).

## 코덱

압축률은 신호 프로파일에 종속되는 3계층 미확인이다 — 아래 선택 이유는 원본의 근거이며 수치가 아니다. 압축률 목표의 정본은 [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-14다.

| 컬럼 | 코덱 | 선택 이유 | 약점 · 실험 대상 |
|------|------|------|------|
| ts | Delta(8) + ZSTD(1) | 정렬 키 안에서 한 태그의 ts는 등간격이라 델타가 거의 상수가 된다 | DoubleDelta는 등간격 상수를 0으로 만든다 — 대안 코덱 실험 후보 |
| device_id · tag_id | Delta(4) + ZSTD(1) | 정렬 키 앞자리라 긴 동일 값 구간이 이어진다 | 사실상 ZSTD만으로도 거의 0에 수렴 — 기여분 측정 대상 |
| value | Gorilla + ZSTD(1) | 부동소수 시계열 전용 XOR 코덱 · 무손실 | RANDOM_WALK처럼 매 값의 가수가 흔들리면 XOR 이득이 작다 — 용량 산정의 최악 기준 |
| quality | ZSTD(1) | 값 대부분이 같은 코드(생성 데이터는 9) | 해당 없음 |
| scan_seq | Delta(8) + ZSTD(1) | 태그 안에서 단조 증가 | 해당 없음 |
| ingested_at | Delta(8) + ZSTD(1) | 배치 안 행은 같은 값(now64 1회 평가) | **정렬 키 밖이라** 배치 경계마다 값이 뛴다 — ts보다 압축 기여가 작다 |

- 검산: 코덱 행 = **6**(device_id · tag_id를 한 행으로 셈 · 컬럼 7)
- **Gorilla는 무손실이다.** 코덱 실험이 값 정합성 비교(원시 대 롤업 · ClickHouse 대 대조군)를 오염시키지 않는다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)).
- 데드밴드(SW-10)는 코덱이 아니라 행 수를 바꾼다. 압축률 측정은 SW-10 off로만 한다(조합 제약 #5).

## 중복 제거 — insert_deduplication_token

ADR-14의 저장소 쪽 계약이다. 토큰 재료 · 백오프 합계의 기전은 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)가 소유한다.

| 항목 | 계약 | 어기면 |
|------|------|------|
| 토큰 | 배치 내용에 결정적 — 엔트리 ID 집합 + 행 수의 해시(REQ-ING-06) | 무작위 UUID면 재시작 후 같은 배치가 다른 토큰을 받아 중복 행이 생긴다 |
| 윈도우 | non_replicated_deduplication_window — 최근 N개 삽입 블록의 토큰을 기억 | 0이면 비복제 MergeTree에서 토큰이 무시된다 — **설정 없이 토큰만 보내면 조용히 중복된다** |
| 단위 | 테이블마다 따로 기억한다 | 같은 배치 토큰을 tag_raw와 alarm_eval에 함께 써도 서로 간섭하지 않는다 |
| 재시도 | 같은 토큰 · 백오프 합계가 윈도우 안 | 윈도우를 벗어난 재시도는 새 삽입으로 취급된다 |
| 조회 비용 | 없음 — FINAL 불필요 | ReplacingMergeTree를 버린 이유(ADR-14): 머지 전까지 중복이 보여 모든 조회에 FINAL 비용이 붙는다 |
| 검증 | tag_id + ts 중복 행 0(REQ-NFR-02) | 해당 없음 |

- 검산: 계약 항목 = **6**
- **B형 — 중복 제거된 재시도도 성공 응답을 받는다.** 결론 — 삽입이 무시돼도 클라이언트는 정상 응답을 받고 XACK로 넘어간다. 반대 시나리오 — 무시를 오류로 올리면 재시도가 영원히 실패로 보여 DLQ가 정상 배치로 찬다. 파생 지침 — 중복 제거 발생은 응답 코드가 아니라 쓰인 행 수(written_rows 0)로 계측한다.

## 시각 컬럼 시간대 표기

docs_plan 보정 #16의 W3 몫 "ingested_at · alarm_eval.ts 시간대 표기 통일"을 닫는다. **판정: ClickHouse의 모든 시각 컬럼에 'Asia/Seoul'을 명시한다.** 시간대 인자는 저장값(epoch)을 바꾸지 않고 ① 문자열 출력 ② 문자열 파싱 ③ 달력 함수 경계만 바꾼다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)).

| 테이블 | 컬럼 | 원본 | 이 문서 | 달력 함수가 쓰는 곳 |
|------|------|------|------|------|
| tag_raw | ts | DateTime64(3, 'Asia/Seoul') | 유지 | 파티션 · TTL · mv_tag_1m 버킷 |
| tag_raw | ingested_at | DateTime64(3) | **DateTime64(3, 'Asia/Seoul')** | E2E 분위수 쿼리의 시간 필터 |
| alarm_eval | ts | DateTime64(3) | **DateTime64(3, 'Asia/Seoul')** | 파티션 · TTL |
| tag_1m · tag_1h · tag_1d | bucket | DateTime(인자 없음) | **DateTime('Asia/Seoul')** | 월 · 년 파티션 · 상위 롤업 버킷 — [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |

- 검산: 시각 컬럼 = ts · ingested_at · alarm_eval.ts · bucket 3 = **6** · 인자를 새로 단 컬럼 5
- **시간대를 명시하면 서버 timezone 설정이 스키마에서 빠진다.** 인자 없는 컬럼의 달력 경계는 서버 설정을 따른다 — W6이 서버 timezone을 Asia/Seoul로 판정했지만([../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) 스키마는 그 값에 기대지 않는다. 서버가 UTC로 기동하면 alarm_eval 파티션이 KST 09:00에 갈리고 tag_1m 월 파티션이 KST 1일 09:00에 넘어간다 — 컬럼에 박으면 서버 설정과 무관해진다.
- **적재는 시각을 epoch 정수로 보낸다.** 정수는 정밀도 3에 맞춘 epoch ms로 해석되어 파싱에 시간대가 개입하지 않는다. 문자열로 보내면 컬럼 시간대로 파싱되어 보내는 쪽 시간대와 어긋난다.
- **달력 경계 시간대 Asia/Seoul은 시스템 단일 값이다.** PostgreSQL alarm_event 월 파티션 경계 · site.timezone CHECK · tag_1d 하루가 같은 값을 쓴다([02_postgresql_constraints.md](./02_postgresql_constraints.md) · [01_postgresql_schema.md](./01_postgresql_schema.md)).

## alarm_eval — 판정 전수 테이블

②계층의 ClickHouse 쓰기다. 매 판정의 결과 전수를 갱신 없이 쌓고 임계값 튜닝 · 오탐 분석(ALM-09)에 쓴다. 원본 DDL에서 **ts 시간대 · 중복 제거 윈도우 · TTL 파트 삭제** 세 곳을 바꿨다.

```sql
CREATE TABLE IF NOT EXISTS plc.alarm_eval
(
    ts        DateTime64(3, 'Asia/Seoul') CODEC(Delta(8), ZSTD(1)),
    rule_id   UInt32,
    tag_id    UInt32,
    value     Float64                     CODEC(Gorilla, ZSTD(1)),
    breached  UInt8,
    severity  UInt8
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (rule_id, ts)
TTL toDateTime(ts) + INTERVAL 30 DAY DELETE
SETTINGS non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1;
```

- **중복 제거 윈도우를 더했다.** 원본은 alarm_eval 삽입이 "Ingest 배치와 같은 재시도 정책"을 따른다고 적고(원본 data_flow.md §8.2) 윈도우를 두지 않았다 — 재시도가 판정 전수를 두 번 쌓아 오탐 비율이 부풀었을 것이다. 토큰은 원 배치 토큰을 그대로 쓴다(테이블별 기억 · §중복 제거).
- **ORDER BY (rule_id, ts)** — 분석은 규칙 단위 시간 범위다. tag_id로 거르는 분석은 규칙 → 태그가 1:1에 가까워 rule_id 접두로 충분하다.
- breached는 0 · 1(판정 결과), severity는 alarm_rule.severity 1~3의 복사다([01_postgresql_schema.md](./01_postgresql_schema.md) §enum 값 확정). 상태 머신 상태를 싣지 않는다 — 상태는 alarm:state가 갖는다.
- TTL 30일은 2계층 조정값이며 정본은 [08_retention_lifecycle.md](./08_retention_lifecycle.md)다.

## dict_tag — PostgreSQL 소스 Dictionary

ADR-16의 DDL 자리다. 적재 대상 판정(비활성 태그 포함)의 근거는 [07_cross_store_consistency.md](./07_cross_store_consistency.md) §비활성 태그 이름 판정이며, 이 DDL은 그 판정을 반영한다.

```sql
CREATE DICTIONARY IF NOT EXISTS plc.dict_tag
(
    tag_id     UInt64,
    device_id  UInt32,
    tag_code   String,
    tag_name   String,
    unit       String,
    range_min  Nullable(Float64),
    range_max  Nullable(Float64),
    is_active  UInt8
)
PRIMARY KEY tag_id
SOURCE(POSTGRESQL(
    host 'postgres' port 5432 user 'ch_reader' password '{설정 파일 주입}' db 'plcdb'
    query 'SELECT tag_id, device_id, tag_code, tag_name, unit, range_min, range_max, is_active::int FROM tag_master'
))
LAYOUT(HASHED())
LIFETIME(MIN 300 MAX 600);
```

- **적재 쿼리에서 WHERE is_active를 뺐다.** 원본 조건은 비활성화 순간 그 태그의 과거 행에서 dictGet이 이름을 잃게 했다 — 판정 [07_cross_store_consistency.md](./07_cross_store_consistency.md). 활성 여부는 is_active 속성으로 싣는다.
- **키를 UInt64로 선언한다.** 단순 키 Dictionary의 키는 UInt64다 — 원본은 UInt32로 적고 조회에서 toUInt64(tag_id)로 바꿨다. 조회 쪽 변환은 그대로 둔다.
- **LIFETIME(MIN 300 MAX 600)은 2계층 조정값이다.** 조회 계약 — 마스터 커밋 뒤 즉시 반영은 LIFETIME이 아니라 SYSTEM RELOAD DICTIONARY가 한다(무효화 체인 ④ — 6단 번호 · tag_master 쓰기만 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)). 비밀번호는 DDL에 쓰지 않고 설정 파일로 주입한다([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)).

## 품질 코드 컬럼 판정

[../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)가 이 문서로 넘긴 질문 — 품질 코드가 출처 축(9 SIMULATED)과 건강 축(0~5)을 한 칸에 겹치는데 컬럼을 가를지.

| 안 | 내용 | 결과 |
|------|------|------|
| ① 컬럼 분리 | quality(건강) + source(출처) 두 컬럼 | tag_raw 행 폭 1바이트 증가 · Stream 페이로드 · 대조군 · 롤업 DDL이 함께 바뀐다 |
| ② 현행 유지(**채택**) | quality 한 컬럼 · 7값 | 출처는 설비 규칙(modbus_config.host 루프백)과 생성 모드로 복원된다 — 건강 코드 2 · 4가 9보다 우선 |

- **판정: 컬럼을 가르지 않는다.** 이 시스템의 데이터는 전부 생성 데이터라 출처가 설비 · 주입 모드로 이미 결정된다. 실장비가 섞이는 시점(확장 범위 밖)에 컬럼 추가는 DEFAULT 값을 가진 ADD COLUMN으로 기존 파트를 건드리지 않는다(원본 data_flow.md §14.2 — 허용 변경).
- 잔여 — 모드 A 시뮬레이션 설비의 BAD 행은 품질 칸에서 출처를 잃는다. 출처가 필요한 분석은 device_id → modbus_config.host로 복원한다([../02_features/03_collector.md](../02_features/03_collector.md)).

## 서버 설정 계약

**이 표의 현행 참고가 값의 정본이다**([../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §메모리 프로파일이 ClickHouse 내부 설정의 소유처로 이 문서를 가리킨다). 서버 timezone만 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 확정하며(W6 판정 — Asia/Seoul), 설정 파일의 모양도 그 문서가 갖는다(원본 architecture.md §7.5 · 부하 실험 프로파일 참고값).

| 설정 | 현행 참고 | 스키마 쪽 계약 | 어기면 |
|------|------|------|------|
| max_server_memory_usage_to_ram_ratio | 0.8 | 컨테이너 상한(프로파일별)의 비율 | 비율이 1에 가까우면 머지 · 집계가 컨테이너 OOM Killer에 먼저 걸린다 |
| max_concurrent_queries | 32 | 대조 실험 쿼리 · 대시보드 동시 수 상한 | 해당 없음 |
| background_pool_size | 8 | 머지 병렬도 — TTL 파트 삭제도 이 풀에서 돈다 | 작으면 파트 수가 줄지 않아 삽입 지연이 오른다 |
| parts_to_delay_insert · parts_to_throw_insert | 150 · 300 | 파트 폭증을 조기에 드러낸다 | 기본값이면 too many parts가 늦게 보여 배치 정책 결함을 늦게 안다 |
| async_insert | 0 | 적재는 단일 flusher 배치(ADR-09) · C안 비교 실험에서만 켠다 | 켜 둔 채 A안을 재면 서버 병합이 섞여 세 안 비교가 무효 |
| max_insert_block_size | 1048576 | 대량 배치 삽입 | 해당 없음 |
| materialized_views_ignore_errors | 0(끔) | MV 실패를 삽입 오류로 드러낸다(REQ-ING-16) | 켜면 원시는 있고 롤업은 빈 구간이 오류 없이 남는다 |
| 서버 timezone | **Asia/Seoul**(W6 판정) | **스키마는 의존하지 않는다** — 모든 시각 컬럼에 시간대 명시 | 해당 없음 |

- **background_pool_size 8은 병합 풀 파생 설정 3을 함께 낮춰야 기동한다(2026-09-24 S0 확인).** 25.8은 슬롯(풀 × 동시성 비율 2 = 16)보다 큰 여유 슬롯 문턱을 설정 오류로 보고 기동을 거부한다(Code 36) — 기본값 20 · 25 · 8(뮤테이션 · 파티션 전체 최적화 · 병합 크기 하향 문턱)은 기본 풀 16(슬롯 32) 전제다. 기본값의 슬롯 대비 비율을 옮긴 10 · 12 · 4를 서버 설정 merge_tree 절에 둔다([../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §ClickHouse 설정 파일과 서버 timezone). 파생값이라 아래 설정 수에 세지 않는다.
- 검산: 설정 = 원본 6 + 신설 2(materialized_views_ignore_errors · 서버 timezone 의존 부정) = **8** · 원본 merge_tree.merge_max_block_size(8192 · 기본값)는 스키마 쪽 계약이 없어 뺐다
- 접속 프로토콜 — api는 HTTP 8123만 쓰고 네이티브 9000은 CLI · 벤치마크 전용이다(원본 tech_stack.md §5.2). 삽입 형식은 JSONCompactEachRow + 요청 압축이다(REQ-ING-05).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 원시 삽입 성공 · MV 실패 뒤 같은 토큰 재시도가 MV를 다시 실행하는가 | **신규 미확인** — 원시가 중복 제거되면 종속 MV 삽입이 함께 건너뛰어질 수 있다(deduplicate_blocks_in_dependent_materialized_views 동작 · 버전 종속). 건너뛰면 롤업 공백이 재시도로 메워지지 않는다 | S0 저장소 수동 실습 실측 · [../06_pipeline/09_rollup.md](../06_pipeline/09_rollup.md)(W4) |
| 압축률(프로파일별) · 코덱 대안 효과 | 3계층 미확인 — 확정 전 임의 값 고정 금지. 원본 예상치 혼합 8~15배 · RANDOM_WALK 2~4배 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-14 |
| 서버 timezone 설정 | **W6 판정 — Asia/Seoul** · 스키마는 의존하지 않는다 — 수동 쿼리 · 시스템 테이블 표시에만 영향 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| index_granularity 4096 실험 | 원본 실험 후보 — **W6 미채번**(카탈로그 39에 없다 · 필요해지면 EXP-40부터 말미 채번) | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 대량 태그 시 Dictionary 레이아웃 전환 | 원본 "수만 행을 넘으면 LIFETIME 확대 또는 CACHE 레이아웃" — 비활성 포함 적재로 행 수가 단조 증가한다 | [07_cross_store_consistency.md](./07_cross_store_consistency.md) |

## 관련 문서

- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — 롤업 테이블 · MV · 백필
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — Dictionary 원칙 · 비활성 태그 판정
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — TTL 보존 정본
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — tag_raw 동형 대조군
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — 배치 토큰 · 백오프 기전
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-03 · ADR-14 · ADR-15 · ADR-16
