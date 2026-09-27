# ClickHouse 스키마 (03_clickhouse_schema)

> **대상**: ClickHouse 객체 12(테이블 8 · MV 3 · Dictionary 1)의 목록과 원시 · 판정 테이블 tag_raw · alarm_eval DDL · **업무 대조 테이블 3(역방향 대조 계측물)** DDL · 코덱 · 파티션 · 정렬 키(ADR-15) · 중복 제거(ADR-14) · 시각 컬럼 시간대 표기 통일 · dict_tag DDL · 품질 코드 컬럼 판정 · 서버 설정 계약
> **작성일**: 2026-09-24
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27 · 사용자 요구 2026-09-28) — 시각 컬럼 인자 'Asia/Seoul' → **'UTC'**(tag_raw 2 · alarm_eval 1 · 롤업 bucket 3 · last_v 상태 인자 · 업무 대조 3) · tag_raw · alarm_eval 파티션 KST 날짜 → **UTC 날짜** · 서버 timezone Asia/Seoul → **UTC** · §시각 컬럼 시간대 표기에 상태 항목(W3 판정 대체) · 실행 수명 객체 포인터 한 줄 — 객체 12 · 설정 10 불변
> **개정일**: 2026-09-27 — W6 결과 반영 — 업무 대조 보장 표 값 검사 · 경합 판정 칸의 판별 대상 → **CHECK는 INSERT 경로만(기록 043)** · **갱신 행 수 응답 없음(기록 042)** · 미확인 판별 둘 닫힘 · 보장 수 불변
> **개정일**: 2026-09-26 — W1 재검수 반영 — 보장 표 유일성 · MergeTree 칸 "재삽입은 윈도우 N + 토큰일 때만 버린다" → **윈도우 N일 때 버린다(토큰이 없으면 블록 내용 해시 · 있으면 토큰 기준)**(공식 문서 삽입 재시도 중복 제거 대조)
> **개정일**: 2026-09-26 — W1 검수 반영 — 중복 제거 윈도우 불릿 "두지 않는다" → **DDL은 0 · EXP-43 ⓓ 윈도우 N + 토큰 변형만 실행 범위에서 MODIFY SETTING으로 켜고 0으로 복원** · 보장 표 다문장 원자성 칸에 뺀 이유와 실패 시나리오 · 갱신 가시성 칸 경량 UPDATE는 Beta(정본 10_olap_vs_rdb_control) · RMT가 order_no 중복을 합치지 않는 구조 사실
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — §업무 대조 테이블 신설(work_order_control · work_order_control_rmt · production_log_control · DDL 순번 009 · 역방향 대조 EXP-40~44) — 객체 9 → **12** · 테이블 5 → **8** · CH에 없는 것(UNIQUE · FK · 다문장 트랜잭션)과 있는 것(CHECK CONSTRAINT) 등재 · 그래뉼 256 변형은 테이블을 늘리지 않는다(실행 범위 변형 테이블 판정 · 정본 10_olap_vs_rdb_control)
> **개정일**: 2026-09-25 — S3 구현 · 검수 반영 — dict_tag SOURCE를 as-built 명명 수집 NAME pg_dict로(접속 · ch_reader 비밀번호는 서버 설정 파일 config.d/named_collections.xml이 환경변수에서 읽는다 · 옛 표기 db 'plcdb'는 실제 DB plc와 달랐다) · 재계산 삽입 설정에 deduplicate_insert_select 'disable' 병기(26.8에서 insert_deduplicate를 대체)
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — 서버 설정 계약에 input_format_read_datetime_number_as_raw_value 1 신설(설정 9 → **10** — 26.8은 정수 ts를 초로 읽어 9999-12-31로 포화 · 기록 004) · 종속 MV 판별 근거에 26.8 · async_insert 동시 사용은 25.8 거부 · 26.8 허용 · 병합 풀 파생 설정 26.8 재확인 · 토큰 없는 같은 내용의 중복 제거(26.8) 불릿 신설
> **개정일**: 2026-09-24 — S0 실측 반영(EXP-32 · 기록 001) — 미확인 "MV 재실행" 닫힘(ⓑ — 종속 MV가 다시 돈다) · ADR-14 보강(사용자 결정) — 중복 제거 계약 항목 6 → **7**(종속 MV) · 서버 설정 계약 8 → **9**(deduplicate_blocks_in_dependent_materialized_views 1) · B형 계측 수단 written_rows → **DuplicatedInsertedBlocks**(재시도 응답의 written_rows는 0이 되지 않는다)
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — background_pool_size 8의 파생 병합 설정 3(10 · 12 · 4) 등재 — 없으면 25.8이 기동을 거부한다(S0 확인)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 실험 자리 W6 결과 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 서버 timezone 미확인 → **Asia/Seoul**(정본 09_tech_stack/03) · 스키마는 여전히 서버 설정에 기대지 않는다 — 설정 수 불변
> **개정일**: 2026-09-24 — W4 판정 반영 — Dictionary 즉시 반영 단 번호 ③ → **④**(무효화 체인 6단 표기)
> **원천**: ADR-27(사용자 요구 2026-09-28) · 원본 architecture.md §5 · §7.1 · §7.3 · §7.4 · §7.5 · §12 · §15(커밋 ff66a37) · 원본 tech_stack.md §5.2(커밋 ff66a37) · 원본 data_flow.md §4 · §4.3 · §11.2 · §14.1 · §14.2(커밋 ff66a37) · docs_plan.md 보정 #16 · 웨이브 인계(ingested_at · alarm_eval.ts 시간대 표기 통일) · ADR-03 · ADR-14 · ADR-15 · ADR-16 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 시각 의미론 정본 · 목적 적합성 실증 계획 W1(2026-09-26 — 업무 대조 테이블) · ClickHouse 공식 문서 UPDATE 문 · ReplacingMergeTree · 테이블 제약(26.8 · 2026-09-26 context7 대조)

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
| 10 | plc.work_order_control | 테이블 · 계측물 | MergeTree · 블록 번호 · 오프셋 컬럼 | 해당 없음 — 계측물 | 역방향 대조 실행기(EXP-40~44) | 이 문서 §업무 대조 테이블 |
| 11 | plc.work_order_control_rmt | 테이블 · 계측물 | ReplacingMergeTree(version) | 해당 없음 — 계측물 | 상동(EXP-40 ④ · EXP-43) | 상동 |
| 12 | plc.production_log_control | 테이블 · 계측물 | MergeTree | 해당 없음 — 계측물 | 상동(EXP-42 · EXP-44) | 상동 |

- 검산: 테이블 8(#1~#5 · #10~#12) + MV 3(#6~#8) + Dictionary 1(#9) = **12** · 테이블 = 목적지 5 + 계측물 3
- **업무 대조 테이블은 목적지가 아니라 계측물이다.** 업무 데이터의 목적지는 PostgreSQL뿐이며 이 셋은 분기 표에서 대조군 plc_tag_raw_control과 같은 계측물 자리를 받는다([../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)). 앱은 이 테이블을 읽지도 쓰지도 않는다 — 쓰는 주체는 도구 컨테이너의 실행기뿐이고 소유 도메인이 없어 도메인 공백(소유 테이블 없음)의 셈에 영향이 없다.
- **롤업 객체의 소유는 ING로 확정한다(잠정 → 확정).** 판정 근거는 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §도메인 귀속 판정이다. GEN은 모드 D로 tag_raw · 롤업에 쓰지만 소유하지 않는다 — 도메인 공백(소유 테이블 없음 6)은 그대로다.
- **라이브 실행(perf)의 실행 수명 객체 plc.run_perf_raw · run_perf_raw는 이 문서의 객체 수에 세지 않는다 — 모양 · 수명의 정본은 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §실행 수명 객체다.**
- 모든 객체는 데이터베이스 plc로 한정해 이름을 쓴다(REQ-ING-05 — 한정하지 않은 이름은 default 데이터베이스의 같은 이름 객체에 오류 없이 닿는다).

## tag_raw — 원시 테이블

롱 포맷(태그당 1행) · 일자 파티션 · 정렬 키(device_id · tag_id · ts)가 ADR-15의 결정이다. 원본 DDL에서 **시각 컬럼 시간대 명시 · TTL 파트 단위 삭제 설정** 두 곳을 바꿨다.

```sql
CREATE TABLE IF NOT EXISTS plc.tag_raw
(
    ts          DateTime64(3, 'UTC')                         CODEC(Delta(8), ZSTD(1)),
    device_id   UInt32                                       CODEC(Delta(4), ZSTD(1)),
    tag_id      UInt32                                       CODEC(Delta(4), ZSTD(1)),
    value       Float64                                      CODEC(Gorilla, ZSTD(1)),
    quality     UInt8                                        CODEC(ZSTD(1)),
    scan_seq    UInt64                                       CODEC(Delta(8), ZSTD(1)),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)        CODEC(Delta(8), ZSTD(1))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (device_id, tag_id, ts)
TTL toDateTime(ts) + INTERVAL 7 DAY DELETE
SETTINGS index_granularity = 8192,
         non_replicated_deduplication_window = 1000,
         ttl_only_drop_parts = 1;
```

- **ts · ingested_at 둘 다 'UTC'를 붙인다(ADR-27).** 원본은 ts에만 시간대 인자를 달아 같은 행의 두 시각이 문자열 출력 · 달력 함수에서 서로 다른 시간대를 따랐다. 저장값(epoch)은 바뀌지 않는다 — §시각 컬럼 시간대 표기.
- **ttl_only_drop_parts = 1이 "TTL 삭제는 파티션 DROP"을 참으로 만든다.** 이 설정이 없으면 만료 행은 머지 때 행 단위로 다시 쓰여 지워진다 — 원본이 적은 "파티션 DROP으로 즉시 완료"(원본 architecture.md §7.1)는 설정 없이는 성립하지 않는다. 일자 파티션이라 한 파트 안의 행은 같은 날짜여서 파트 전체가 함께 만료된다.
- **TTL 7일 · 중복 제거 윈도우 1000은 2계층 조정값이다.** 보존 값의 정본은 [08_retention_lifecycle.md](./08_retention_lifecycle.md), 윈도우 · 백오프 합계 계약의 정본은 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)다.
- ingested_at을 적재 코드가 보내지 않는다 — 서버 DEFAULT가 채워야 E2E 지연이 Stream 대기 · 삽입 구간을 포함한다(REQ-ING-05).

## 설계 근거 — 파티션 · 정렬 키 · 형식

| 요소 | 결정 | 근거 | 버린 것의 실패 |
|------|------|------|------|
| 형식 | 롱 포맷(태그당 1행) | 설비마다 태그 구성이 다르고 태그 추가가 잦다 | 와이드 포맷 — 태그 추가가 ALTER가 되고 MV · 대조군 DDL이 함께 깨진다(원본 data_flow.md §10.2 ALTER 취약) |
| PARTITION BY | toYYYYMMDD(ts) — **UTC 날짜**(ADR-27 · 저장 운영 경계) | TTL이 파티션 단위로 떨어지고 보존 변경이 파티션 단위로 된다 | 월 — 파티션이 커져 TTL이 한 달 단위로만 떨어진다. 시간 — 파티션 수가 폭증해 삽입 블록이 여러 파티션에 걸친다 |
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
| **종속 MV** | 롤업 3테이블도 윈도우를 갖고([04_clickhouse_rollup.md](./04_clickhouse_rollup.md) DDL) 삽입 설정 deduplicate_blocks_in_dependent_materialized_views 1로 MV가 쓰는 블록도 원 토큰에서 파생된 토큰으로 가른다 — 둘은 한 쌍이다(ADR-14 보강) | 25.8 · 26.8 모두 원시가 중복 제거돼도 종속 MV를 다시 돌린다 — 쌍 중 하나라도 없으면 응답 유실 뒤 같은 토큰 재시도가 세 롤업을 두 배로 센다(설정만 · 윈도우만 · 둘 다 없음 모두 3/3 — S0 실측 · 기록 001 · 004). 비운 롤업에 같은 내용을 다시 넣는 재계산은 윈도우에 걸려 버려지므로 insert_deduplicate 0 · deduplicate_insert_select 'disable'을 함께 준다 — 26.8은 뒤 설정이 앞 설정을 대체해 insert_deduplicate만 주면 무시된다(S3 통합 확인) |
| 재시도 | 같은 토큰 · 백오프 합계가 윈도우 안 | 윈도우를 벗어난 재시도는 새 삽입으로 취급된다 |
| 조회 비용 | 없음 — FINAL 불필요 | ReplacingMergeTree를 버린 이유(ADR-14): 머지 전까지 중복이 보여 모든 조회에 FINAL 비용이 붙는다 |
| 검증 | tag_id + ts 중복 행 0(REQ-NFR-02) | 해당 없음 |

- 검산: 계약 항목 = **7**
- **26.8은 토큰 없는 같은 내용도 중복 제거한다(기록 004).** 25.8은 ingested_at DEFAULT가 매번 달라 가르지 못했다(기록 001). 토큰은 계약대로 둔다 — 내용 해시 동작은 버전 종속이다. 파급은 SW-08 off 비교다 — 토큰만 빼면 26.8에서 재시도 중복이 재현되지 않는다([../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) 미확인 등재).
- **B형 — 중복 제거된 재시도도 성공 응답을 받는다.** 결론 — 삽입이 무시돼도 클라이언트는 정상 응답을 받고 XACK로 넘어간다. 반대 시나리오 — 무시를 오류로 올리면 재시도가 영원히 실패로 보여 DLQ가 정상 배치로 찬다. 파생 지침 — 중복 제거 발생은 응답 코드도 응답 요약의 written_rows도 아니라 쿼리 로그의 ProfileEvents DuplicatedInsertedBlocks로 계측한다 — **중복 제거된 재시도의 written_rows는 첫 시도와 같은 값이다**(S0 실측 · 기록 001).

## 시각 컬럼 시간대 표기

- **상태**: **대체됨 → ADR-27(2026-09-28 · 사용자 요구).** 아래 W3 판정 원문(모든 시각 컬럼 'Asia/Seoul')은 보존한다. 살아남은 것 — **모든 시각 컬럼에 인자를 명시한다**(서버 설정이 스키마에 새지 않는다) · 인자는 저장값을 바꾸지 않는다 · 적재는 epoch 정수. 죽은 것 — 인자 값 'Asia/Seoul'과 "달력 경계 시간대는 시스템 단일 값 Asia/Seoul". 현행 인자는 **'UTC'**이고, 화면에 "하루"로 보이는 경계만 함수 인자로 KST를 명시한다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §달력 의미 경계 — 닫힌 목록).

W3 원문 — docs_plan 보정 #16의 W3 몫 "ingested_at · alarm_eval.ts 시간대 표기 통일"을 닫는다. **판정: ClickHouse의 모든 시각 컬럼에 'Asia/Seoul'을 명시한다.** 시간대 인자는 저장값(epoch)을 바꾸지 않고 ① 문자열 출력 ② 문자열 파싱 ③ 달력 함수 경계만 바꾼다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)).

현행 표기(ADR-27)다.

| 테이블 | 컬럼 | 원본 | ADR-27 전 | 현행 | 달력 함수가 쓰는 곳 |
|------|------|------|------|------|------|
| tag_raw | ts | DateTime64(3, 'Asia/Seoul') | 유지 | **DateTime64(3, 'UTC')** | 파티션 · TTL · mv_tag_1m 버킷 |
| tag_raw | ingested_at | DateTime64(3) | DateTime64(3, 'Asia/Seoul') | **DateTime64(3, 'UTC')** | E2E 분위수 쿼리의 시간 필터 |
| alarm_eval | ts | DateTime64(3) | DateTime64(3, 'Asia/Seoul') | **DateTime64(3, 'UTC')** | 파티션 · TTL |
| tag_1m · tag_1h · tag_1d | bucket | DateTime(인자 없음) | DateTime('Asia/Seoul') | **DateTime('UTC')** | 월 · 년 파티션 · 상위 롤업 버킷 — tag_1d 버킷만 toStartOfDay(bucket, 'Asia/Seoul')로 KST 자정 · [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |
| 업무 대조 3 | planned_start · planned_end · recorded_at | 해당 없음 — W1 신설 | DateTime64(3, 'Asia/Seoul') | **DateTime64(3, 'UTC')** | 없음 — 파티션 키 · TTL 없음 |

- 검산: 시각 컬럼 = ts · ingested_at · alarm_eval.ts · bucket 3 · 업무 대조 3 = **9** · 롤업 상태 last_v의 인자 타입도 같은 'UTC'다(04_clickhouse_rollup)
- **시간대를 명시하면 서버 timezone 설정이 스키마에서 빠진다.** 인자 없는 컬럼의 달력 경계는 서버 설정을 따른다 — ADR-27이 서버 timezone도 UTC로 두지만([../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) 스키마는 그 값에 기대지 않는다. 컬럼에 박으면 서버 설정과 무관해진다.
- **적재는 시각을 epoch 정수로 보낸다.** 정수는 정밀도 3에 맞춘 epoch ms로 해석되어 파싱에 시간대가 개입하지 않는다 — **26.8은 사용자 프로파일 input_format_read_datetime_number_as_raw_value 1이 있어야 이 해석이 성립한다**(없으면 초로 읽어 9999-12-31로 포화 · §서버 설정 계약 · 기록 004). 문자열로 보내면 컬럼 시간대로 파싱되어 보내는 쪽 시간대와 어긋난다.
- **A형 — "인자만 UTC로 바꾸면 끝난다"가 아니다.** 26.8은 파티션 키 컬럼의 인자만 바꾸는 MODIFY COLUMN을 오류 없이 받지만 옛 파트는 KST 파티션 ID를 그대로 갖고 새 삽입은 UTC 파티션 ID로 가, 같은 파티션 ID에 다른 날짜 집합이 섞인다(실측). 기존 볼륨은 재구성으로 옮긴다 — 절차 정본 [09_migrations_seed.md](./09_migrations_seed.md) §DB 시간대 전환.

## alarm_eval — 판정 전수 테이블

②계층의 ClickHouse 쓰기다. 매 판정의 결과 전수를 갱신 없이 쌓고 임계값 튜닝 · 오탐 분석(ALM-09)에 쓴다. 원본 DDL에서 **ts 시간대 · 중복 제거 윈도우 · TTL 파트 삭제** 세 곳을 바꿨다.

```sql
CREATE TABLE IF NOT EXISTS plc.alarm_eval
(
    ts        DateTime64(3, 'UTC')        CODEC(Delta(8), ZSTD(1)),
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
    NAME pg_dict
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

**이 표의 현행 참고가 값의 정본이다**([../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §메모리 프로파일이 ClickHouse 내부 설정의 소유처로 이 문서를 가리킨다). 서버 timezone만 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 확정하며(ADR-27 — UTC · W6 판정 Asia/Seoul 대체), 설정 파일의 모양도 그 문서가 갖는다(원본 architecture.md §7.5 · 부하 실험 프로파일 참고값).

| 설정 | 현행 참고 | 스키마 쪽 계약 | 어기면 |
|------|------|------|------|
| max_server_memory_usage_to_ram_ratio | 0.8 | 컨테이너 상한(프로파일별)의 비율 | 비율이 1에 가까우면 머지 · 집계가 컨테이너 OOM Killer에 먼저 걸린다 |
| max_concurrent_queries | 32 | 대조 실험 쿼리 · 대시보드 동시 수 상한 | 해당 없음 |
| background_pool_size | 8 | 머지 병렬도 — TTL 파트 삭제도 이 풀에서 돈다 | 작으면 파트 수가 줄지 않아 삽입 지연이 오른다 |
| parts_to_delay_insert · parts_to_throw_insert | 150 · 300 | 파트 폭증을 조기에 드러낸다 | 기본값이면 too many parts가 늦게 보여 배치 정책 결함을 늦게 안다 |
| async_insert | 0 | 적재는 단일 flusher 배치(ADR-09) · C안 비교 실험에서만 켠다 | 켜 둔 채 A안을 재면 서버 병합이 섞여 세 안 비교가 무효 |
| max_insert_block_size | 1048576 | 대량 배치 삽입 | 해당 없음 |
| **input_format_read_datetime_number_as_raw_value** | **1(켬)** — S0 실측 | 적재는 ts를 epoch ms 정수로 보낸다(§시각 컬럼 시간대 표기) — 1이면 따옴표 없는 정수를 열 정밀도의 틱(ms)으로 읽는다 | 26.8은 끄면 정수를 초로 읽어 **9999-12-31로 포화시키고 오류가 없다** — date_time_input_format 값과 무관(기록 004) |
| materialized_views_ignore_errors | 0(끔) | MV 실패를 삽입 오류로 드러낸다(REQ-ING-16) | 켜면 원시는 있고 롤업은 빈 구간이 오류 없이 남는다 |
| **deduplicate_blocks_in_dependent_materialized_views** | **1(켬)** — ADR-14 보강 · S0 실측 | 롤업 3테이블의 non_replicated_deduplication_window와 한 쌍 · async_insert 1과의 동시 사용은 25.8이 삽입을 Code 344로 거부했고 26.8은 허용한다(S0 실측 · 기록 001 · 004) | 끄면 같은 토큰 재시도마다 종속 MV가 다시 돌아 롤업이 이중 계수된다 · 윈도우만 두어도 같다(EXP-32 · 기록 001) |
| 서버 timezone | **UTC**(ADR-27 — W6 판정 Asia/Seoul 대체) | **스키마는 의존하지 않는다** — 모든 시각 컬럼에 시간대 명시 | 해당 없음 |

- **background_pool_size 8은 병합 풀 파생 설정 3을 함께 낮춰야 기동한다(2026-09-24 S0 확인).** 25.8 · 26.8 모두 슬롯(풀 × 동시성 비율 2 = 16)보다 큰 여유 슬롯 문턱을 설정 오류로 보고 기동을 거부한다(Code 36 · 26.8 재확인 — 기록 005) — 기본값 20 · 25 · 8(뮤테이션 · 파티션 전체 최적화 · 병합 크기 하향 문턱)은 기본 풀 16(슬롯 32) 전제다. 기본값의 슬롯 대비 비율을 옮긴 10 · 12 · 4를 서버 설정 merge_tree 절에 둔다([../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §ClickHouse 설정 파일과 서버 timezone). 파생값이라 아래 설정 수에 세지 않는다.
- 검산: 설정 = 원본 6 + 신설 4(materialized_views_ignore_errors · 서버 timezone 의존 부정 · 종속 MV 중복 제거 · 정수 ts 틱 해석) = **10** · 원본 merge_tree.merge_max_block_size(8192 · 기본값)는 스키마 쪽 계약이 없어 뺐다
- 접속 프로토콜 — api는 HTTP 8123만 쓰고 네이티브 9000은 CLI · 벤치마크 전용이다(원본 tech_stack.md §5.2). 삽입 형식은 JSONCompactEachRow + 요청 압축이다(REQ-ING-05).

## 업무 대조 테이블

역방향 대조(업무 워크로드를 ClickHouse에 — EXP-40~44)의 ClickHouse 쪽 계약이다. 실험 설계 · 공정성 규칙 · 변형의 정본은 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §역방향 대조 — 업무 워크로드이고, 이 절은 테이블의 모양만 고정한다. PostgreSQL 쪽은 대조 사본 없이 업무 테이블 work_order · production_log를 그대로 쓴다([01_postgresql_schema.md](./01_postgresql_schema.md)).

| PostgreSQL 컬럼 | 타입 · 제약 | ClickHouse 타입 | 동형 판정 |
|------|------|------|------|
| work_order.order_id · production_log.log_id | bigint · PK IDENTITY | UInt64 · 정렬 키 | 값은 같다 — ClickHouse에 시퀀스가 없어 실행기가 PostgreSQL이 발급한 번호와 같은 값을 싣는다 |
| work_order.line_id · production_log.order_id | integer · bigint · FK | UInt32 · UInt64 · 참조 검사 없음 | 값은 같다 · **FK는 옮기지 않는다** — 없는 기능이다 |
| order_no · product_code | text · order_no UNIQUE | String · 유일 검사 없음 | 값은 같다 · **UNIQUE는 옮기지 않는다** |
| target_qty · good_qty · defect_qty | integer · CHECK | **Int32** · CONSTRAINT CHECK | 부호 있는 정수로 둔다 — UInt면 음수 입력이 파싱 단계에서 거절되거나 감겨 CHECK 경로를 잴 수 없다 |
| planned_start · planned_end · recorded_at | timestamptz · CHECK(planned_end > planned_start) | DateTime64(3, 'UTC') · CONSTRAINT CHECK | 값은 epoch ms로 채운다 — PostgreSQL μs 정밀도가 ms 값을 정확히 담는다 |
| status | text · DEFAULT 'PLANNED' · CHECK 4값 | **LowCardinality(String)** · CONSTRAINT CHECK 4값 | Enum8이면 값 밖 입력이 타입 변환에서 먼저 거절되어 CHECK 대 CHECK 비교가 되지 않는다 |

- 검산: 컬럼 행 = **6**(work_order 8컬럼 · production_log 5컬럼을 뜻 단위로 묶음)
- **RMT 테이블은 같은 컬럼에 version UInt64 하나를 더한다.** 새 버전 삽입이 갱신의 수단이라 버전이 없으면 같은 정렬 키 행 중 무엇이 남을지가 삽입 순서에 달린다(공식 문서 — 버전이 같으면 마지막 삽입 행).

아래는 DDL 계약이다(설계 계약 · 구현 코드 아님). 적용 순번은 [09_migrations_seed.md](./09_migrations_seed.md) 009다.

```sql
CREATE TABLE IF NOT EXISTS plc.work_order_control
(
    order_id      UInt64,
    line_id       UInt32,
    order_no      String,
    product_code  String,
    target_qty    Int32,
    planned_start DateTime64(3, 'UTC'),
    planned_end   DateTime64(3, 'UTC'),
    status        LowCardinality(String),
    CONSTRAINT c_target_qty CHECK target_qty > 0,
    CONSTRAINT c_planned    CHECK planned_end > planned_start,
    CONSTRAINT c_status     CHECK status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
)
ENGINE = MergeTree
ORDER BY order_id
SETTINGS index_granularity = 8192,
         enable_block_number_column = 1,
         enable_block_offset_column = 1;

-- work_order_control_rmt: 위와 같은 컬럼 · 제약 + version UInt64
--   ENGINE = ReplacingMergeTree(version) ORDER BY order_id SETTINGS index_granularity = 8192

CREATE TABLE IF NOT EXISTS plc.production_log_control
(
    log_id      UInt64,
    order_id    UInt64,
    recorded_at DateTime64(3, 'UTC'),
    good_qty    Int32,
    defect_qty  Int32,
    CONSTRAINT c_good   CHECK good_qty >= 0,
    CONSTRAINT c_defect CHECK defect_qty >= 0
)
ENGINE = MergeTree
ORDER BY (order_id, log_id);
```

- **블록 번호 · 오프셋 컬럼은 work_order_control에만 켠다.** 경량 UPDATE의 요구 조건이다(공식 문서 UPDATE 문). RMT 테이블은 새 버전 삽입으로만 갱신하고 production_log_control은 갱신하지 않는다 — 켜 두면 쓰지 않는 시스템 컬럼이 저장 · 삽입 비용에 섞인다.
- **정렬 키는 order_id 하나다.** 경량 UPDATE는 기본 키 · 파티션 키 컬럼을 갱신할 수 없다 — 갱신 대상인 status가 키에 들어가면 EXP-40 ③이 성립하지 않는다. 파티션 키 · TTL을 두지 않는다(업무 규모 10^6행 안 · 보존은 실험 범위).
- **DDL은 중복 제거 윈도우를 두지 않는다(non_replicated_deduplication_window 기본 0).** EXP-43 ⓐ와 ⓓ 기본 팔이 토큰 · 내용 해시로 버려지면 "유일 검사 없음"이 아니라 "삽입 중복 제거"를 재게 된다. 윈도우 0이면 비복제 MergeTree는 토큰과 내용 해시 모두로 가르지 않는다(§중복 제거 — 윈도우 행) — 실행기는 첫 실행에서 DuplicatedInsertedBlocks 0을 원시에 남겨 26.8 동작을 판별한다. **재시도 멱등 수단(윈도우 N + insert_deduplication_token)은 EXP-43 ⓓ의 별도 변형으로 잰다** — 윈도우는 MODIFY SETTING으로 바꿀 수 있는 테이블 설정이라 실행기가 그 실행 범위에서만 켜고 끝에 0으로 복원한다. DDL과 스냅샷의 값은 0 그대로다(판정 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §변형과 판정 지표).
- **그래뉼 256 변형은 이 목록에 없다.** index_granularity는 생성 때 정해지므로 변형은 실행기가 EXP-41 실행 안에서만 plc 밖 실험 데이터베이스에 같은 DDL로 만들고 지운다 — 판정 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §그래뉼 변형 판정. 테이블 수는 그래서 늘지 않는다.

ClickHouse가 업무 보장 중 무엇을 줄 수 있고 없는지의 등재다. **없는 것을 앱 로직으로 흉내 내지 않는다** — 흉내의 비용을 엔진 비용으로 기록하게 된다(공정성 규칙 7).

| 보장 | PostgreSQL | ClickHouse MergeTree | ClickHouse RMT | 이 차이를 재는 실험 |
|------|------|------|------|------|
| 유일성 | UNIQUE · PK — 커밋 전 거절 | 없음 — 같은 키 행이 그대로 쌓인다 · 같은 블록의 재삽입은 윈도우 N일 때 버린다(토큰이 없으면 블록 내용 해시 · 있으면 토큰 기준 — 공식 문서 삽입 재시도 중복 제거 · ⓓ 변형) | 정렬 키(order_id) 단위 · **머지 뒤에만** 합친다 · 조회 때 FINAL이 합친다 — **order_no는 정렬 키가 아니라 서로 다른 order_id의 order_no 중복은 머지 뒤에도 남는다**(엔진 정의 · 실측으로 확인) | EXP-43 ⓐ · ⓓ |
| 참조 무결성 | FK — 커밋 전 거절 | 없음 | 없음 | EXP-43 ⓑ |
| 값 검사 | CHECK — 커밋 전 거절(INSERT · UPDATE 두 경로) | CONSTRAINT CHECK — **INSERT 경로만 검사** · 경량 UPDATE · ALTER UPDATE(mutations_sync 1)는 위반 값을 오류 없이 받아 되읽힌다(3종 × 3규모 × 3회 · 기록 043 · valid · 26.8.10.6) | INSERT 경로만(UPDATE 경로 없음) | EXP-43 ⓒ |
| 다문장 원자성 | 트랜잭션 | 문장 단위 · 다문장 트랜잭션 없음 — 실험 기능이라 기본 꺼짐 · 버전 종속이므로 켜지 않는다. 켜고 잰 부분 반영 0은 운영 경로에 쓸 수 없는 보장이라, 그것을 근거로 업무 쓰기를 옮기면 버전 갱신 하나로 보장이 사라진다([10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §역방향 대조 — 업무 워크로드 · 원리 대응) | 상동 | EXP-42 |
| 경합 판정 | 조건부 UPDATE의 갱신 행 수 · 행 잠금 | **갱신 행 수를 응답하지 않는다**(경량 · ALTER 모두 written_rows 0 · 기록 042 · valid) | 해당 없음 — 갱신이 삽입이다 | EXP-42 |
| 갱신 가시성 | 커밋 | 경량 UPDATE는 apply_patch_parts 1(기본)에서 조회에 적용(문서 · **Beta** — 정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §역방향 대조) · ALTER UPDATE는 mutations_sync · apply_mutations_on_fly에 따른다 | FINAL 조회 즉시 · 비 FINAL은 머지 뒤 | EXP-40 |

- 검산: 보장 = **6** · ClickHouse가 구조로 갖지 않는 것 = 유일성(MergeTree) · 참조 무결성 · 다문장 원자성 = **3**
- **감사 대조 테이블은 두지 않는다(판정).** EXP-42의 판정은 부분 반영 · 경합 위반 건수이고 첫 문장 뒤 실패 주입으로 성립한다 — audit_log 사본을 더하면 테이블 하나가 지연 비교 없는 실험 하나를 위해 고정 기준에 남는다. 대가로 ClickHouse 쪽 완료 단위는 문장 둘이고 PostgreSQL은 셋이다 — 그래서 EXP-42는 지연을 비교하지 않는다([10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §변형과 판정 지표).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 원시 삽입 성공 · MV 실패 뒤 같은 토큰 재시도가 MV를 다시 실행하는가 | **닫힘(S0 실측 · EXP-32 · 기록 001 · 004 — 25.8 · 26.8 같음)** — 다시 실행한다(ⓑ). 대가로 이미 성공한 MV도 다시 돌아 롤업이 이중 계수되므로 ADR-14를 보강했다(§중복 제거 종속 MV 행 · §서버 설정 계약) | [../06_pipeline/09_rollup.md](../06_pipeline/09_rollup.md) |
| 압축률(프로파일별) · 코덱 대안 효과 | 3계층 미확인 — 확정 전 임의 값 고정 금지. 원본 예상치 혼합 8~15배 · RANDOM_WALK 2~4배 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-14 |
| 서버 timezone 설정 | **ADR-27 — UTC**(W6 판정 Asia/Seoul 대체) · 스키마는 의존하지 않는다 — 수동 쿼리 · 시스템 테이블 표시에만 영향 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| index_granularity 4096 실험 | 원본 실험 후보 — **W6 미채번**(카탈로그에 없다 · 필요해지면 말미 채번 — 다음 번호는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §분류와 검산) | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 업무 대조 테이블의 판별 둘 — UPDATE가 갱신 행 수를 응답하는가 · CHECK CONSTRAINT가 UPDATE 경로에도 검사되는가 | **닫힘(W6)** — 응답하지 않는다(기록 042) · UPDATE 경로는 검사하지 않는다(기록 043 · 둘 다 valid · 19f8861 · 부하 실험 · 티어 해당 없음 · 스위치 기본값 · 26.8.10.6) | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) |
| 업무 대조 테이블의 갱신 · 조회 · 삽입 비용 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-40~44 · [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) |
| 대량 태그 시 Dictionary 레이아웃 전환 | 원본 "수만 행을 넘으면 LIFETIME 확대 또는 CACHE 레이아웃" — 비활성 포함 적재로 행 수가 단조 증가한다 | [07_cross_store_consistency.md](./07_cross_store_consistency.md) |

## 관련 문서

- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — 롤업 테이블 · MV · 백필
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — Dictionary 원칙 · 비활성 태그 판정
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — TTL 보존 정본
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — tag_raw 동형 대조군 · 역방향 대조(업무 대조 테이블의 실험 정본)
- [01_postgresql_schema.md](./01_postgresql_schema.md) — 업무 대조 테이블의 원형 work_order · production_log
- [09_migrations_seed.md](./09_migrations_seed.md) — DDL 순번 009
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — 배치 토큰 · 백오프 기전
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-03 · ADR-14 · ADR-15 · ADR-16
