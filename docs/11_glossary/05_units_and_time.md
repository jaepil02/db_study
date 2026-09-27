# 단위와 시각 (05_units_and_time)

> **대상**: db_study의 시각 의미론(ts · ingested_at) · 시각 인코딩 · 저장 시간대와 표시 시간대 · 버킷 경계 · 공학 단위 · 부동소수 비교 · 수치 단위 표기 — 시각 의미론 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-28 — r-utc 검수 반영(H1 · M1 · M3 · L2 · L4) — §DB 시간대 전환 구현 목록 머리에 **수집 규칙** 신설('Asia/Seoul' 리터럴 · 시간대 없는 toString · toDate · 인자 없는 달력 함수 · +9h 오프셋 연산 전수) · 구현 목록 24 → **30**자리(#25 s2-verify AC-04 KST 문자열 변경 · #26~#30 유지 5 — 변경 12 → **13** · 유지 7 → **12**) · #8 ClickHouse 전환 판정 대상 → **테이블 8 · MV 제외** · #5 세션 시간대 SET → **SET LOCAL** · #10 · #11 시험 기대값 동반 · #12 러너 주석 포함 · #23 대상 s0 DDL → **scripts/lab/s0 전체**
> **개정일**: 2026-09-28 — 리드 판정(컨테이너 TZ) — api · datagen 컨테이너 TZ Asia/Seoul → **UTC** — 구현 목록 23 → **24**자리(#24 신설 · 변경 11 → **12**)
> **개정일**: 2026-09-28 — DB 시각 UTC · 화면 KST(사용자 요구 2026-09-28 · **ADR-27**) — DB 처리 시간대 Asia/Seoul → **UTC**(PostgreSQL DB 기본 · ClickHouse 서버 · ClickHouse 시각 컬럼 인자) · 저장 운영 경계(파티션 · TTL · 보존) KST → **UTC** · 달력 의미 경계는 함수 인자 'Asia/Seoul' 명시로 유지 — **닫힌 목록 3**(tag_1d 버킷 · 조회 1d 스냅 · 웹 추이 1d 스냅) · site.timezone 뜻 저장 시간대 아님 → **표시 · 달력 의미 시간대** · §DB 시간대 전환 구현 목록 신설(정본) · W3 · W6 판정은 ADR-27이 대체
> **개정일**: 2026-09-24 — W7 검수 반영 — 레이트 리밋 키 rl:{user_id}:{unix_minute} → **rl:{class}:{user_id}:{unix_minute}**(정본 05_data_stores/05)
> **개정일**: 2026-09-24 — W6 판정 반영 — ClickHouse 서버 timezone → **Asia/Seoul**(정본 09_tech_stack/03)
> **개정일**: 2026-09-24 — W4 판정 반영 — Stream 대기 시작점 t0 → **엔트리 ID 시각** · t0 = 엔트리 ts 최솟값 · dt ≥ 0 판정 반영(06_pipeline/12)
> **개정일**: 2026-09-24 — W3 판정 반영 — 시간대 표기 통일 경계 → **닫힘**(ClickHouse 전 시각 컬럼 Asia/Seoul 명시 · 정본 05_data_stores/03) · 버킷 · 파티션 경계 미확인 → **KST 확정**(tag_1d · tag_1m · tag_1h · alarm_eval · alarm_event) · site.timezone 미확인 → **CHECK Asia/Seoul 고정**(05_data_stores/01)
> **개정일**: 2026-09-24 — W2 판정 반영 — 롤업 대 원시 허용 오차 미확인 → avg 상계식 · count · min · max · last 정확 일치 · p95만 미확인(정본 03_requirements/14)
> **원천**: 사용자 요구(2026-09-28 — DB는 UTC · 화면 표시는 KST) · ADR-27 · 원본 architecture.md §6 · §7.1 · §7.2 · §7.3 · §8.2 · §10.2 · §12(커밋 ff66a37) · 원본 data_flow.md §3 · §5 · §6.2 · §14 · §14.1 · §15 · §17(커밋 ff66a37) · 원본 tech_stack.md §6(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #16 · [../README.md](../README.md) 전역 불변식 시각 의미론

시계열 시스템의 가장 흔한 버그는 시간대 혼동이다. 이 문서는 **어느 시각이 무엇을 재는가 · 어떤 형태로 저장되는가 · 어디서 사람이 읽는 시각으로 바뀌는가** 세 가지를 고정한다. 값의 컬럼 타입은 [../05_data_stores](../05_data_stores/README.md)가, 직렬화 형식은 [../07_api/01_conventions.md](../07_api/01_conventions.md)가 갖고, 이 문서는 그 둘이 따라야 할 의미만 갖는다.

**경계 — DB는 UTC로 처리하고 화면만 KST로 보인다(ADR-27 · 사용자 요구 2026-09-28).** PostgreSQL DB 기본 timezone · ClickHouse 서버 timezone · ClickHouse의 모든 시각 컬럼 인자(ts · ingested_at · alarm_eval.ts · 롤업 bucket 3 · 업무 대조 시각 3)가 **UTC**다([../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §시각 컬럼 시간대 표기). 옛 W3 판정(모든 시각 컬럼 'Asia/Seoul')과 W6 판정(서버 timezone Asia/Seoul)은 ADR-27이 대체했다 — 원문은 각 정본의 상태 항목에 남는다. 이 문서는 "시간대 인자는 저장값을 바꾸지 않는다"는 의미 · 달력 의미 경계의 닫힌 목록 · 전환 구현 목록을 고정하고, DDL 표기의 정본은 스키마 문서다.

## ★ 두 시각 — ts와 ingested_at

| 컬럼 | 재는 것 | 찍는 주체 · 시계 | 찍는 시점 | 쓰는 곳 |
|------|--------|---------------|---------|--------|
| ts | **측정 시각** — 값이 관측된 순간 | 모드 A는 Collector(api 컨테이너 시계) · 모드 B · C · D는 생성기 | 모드 A는 스캔 사이클 폴링 시점 · 생성 모드는 생성기가 부여한 시점 | 파티션 · 정렬 키 · 롤업 버킷 · TTL · 알람 판정 · STALE 판정 |
| ingested_at | **적재 시각** — 행이 ClickHouse에 들어간 순간 | ClickHouse 서버(DEFAULT now64(3)) | INSERT 실행 시 | E2E 지연 계산 전용 |

- **둘을 서로 대체하지 않는다.** ts 대신 ingested_at으로 파티션 · 버킷을 자르면 백프레셔로 늦게 들어온 행이 늦은 분에 집계되어 차트에 가짜 급증이 생기고, ingested_at 대신 ts로 지연을 재면 지연이 늘 0이 된다.
- **E2E 지연 = ingested_at − ts.** 두 컬럼의 차 하나로 수집 → 버퍼 → 적재 전체의 지연을 잰다. 이 컬럼 쌍이 없으면 별도 추적 시스템 없이는 파이프라인 지연을 SQL 한 줄로 잴 수 없다(원본 data_flow.md §15).
- **모드 A의 ts는 PLC가 보낸 시각이 아니다(판정).** Modbus FC03 응답에는 시각 필드가 없으므로 Collector가 폴링 시점에 ts를 찍는다. 그래서 모드 A의 E2E는 "신호 생성 → 레지스터 반영" 구간을 포함하지 않는다. 폴링 요청 직전과 응답 직후 중 어느 쪽을 쓰는지는 미확인이며 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)가 확정한다.
- **한 INSERT의 행은 같은 ingested_at을 받는다.** now64는 질의 단위로 한 번 평가되므로 배치 안의 행 사이에 적재 시각 차이가 없다. E2E 분포의 폭은 ts 쪽의 흩어짐(배치 대기 시간)에서 나온다.

### E2E 계산의 전제

| 전제 | 성립 근거 | 깨지는 조건 |
|------|---------|-----------|
| 두 시계가 같다 | api · clickhouse 컨테이너가 같은 호스트 커널 시계를 공유한다 | 역할 분리로 다른 머신에 올리는 순간 — 확장 로드맵 밖 |
| ts가 과거 백필이 아니다 | E2E 질의가 ts > now() − 5분으로 거른다(원본 data_flow.md §15) | 모드 D 백필 행을 필터 없이 집계하면 E2E가 일 단위로 튄다 |
| 시간대가 차를 바꾸지 않는다 | dateDiff는 두 순간의 차이를 epoch로 계산한다 | 없음 — 시간대 인자가 달라도 결과가 같다 |

## 저장 형태 전수

**저장은 epoch 기준이다.** 모든 시각은 저장소 안에서 1970-01-01T00:00:00Z로부터의 경과량이며, 시간대는 문자열로 읽고 쓸 때만 개입한다.

| 위치 | 필드 | 형태 | 정밀도 | 시간대 개입 |
|------|------|------|:------:|-----------|
| Collector 메모리 | ts | epoch ms 정수 | ms | 없음 |
| Stream 엔트리 | t0 · dt[] | uint64 epoch ms + int32 오프셋 ms | ms | 없음 |
| rt:latest:{device_id} 값 | "ts,value,quality"의 ts | epoch ms 10진 문자열 | ms | 없음 |
| rl:{class}:{user_id}:{unix_minute} 키 | unix_minute | epoch 분 정수 | 분 | 없음 |
| alarm:state:{rule_id} | first_breach_ts · first_clear_ts · last_ts | epoch ms 정수(W3 확정) | ms | 없음 |
| ClickHouse tag_raw | ts · ingested_at | DateTime64(3) | ms | 문자열 변환 · 날짜 함수에만 |
| ClickHouse tag_1m | bucket | DateTime | 초 | 상동 |
| ClickHouse alarm_eval | ts | DateTime64(3) | ms | 상동 |
| PostgreSQL | occurred_at · cleared_at · acked_at · planned_start · planned_end · recorded_at · acted_at | timestamptz | μs | 세션 TimeZone(DB 기본 UTC)으로 문자열 변환 · date_trunc 경계에만 |
| API 요청 | from · to | ISO 8601 문자열 | 원본 미기재 | 오프셋 표기로 해석 |
| API 응답 | points의 timestamp | 원본 미기재 | 원본 미기재 | 형식 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) |

- **alarm:state의 최초 위반 시각을 epoch ms로 둔 것은 판정이다.** 원본은 필드만 적었다. 날짜 문자열로 두면 디바운스 경과 계산(판정 ts − 최초 위반 시각)이 매번 파싱을 거치고, 시간대 없는 문자열이 들어가는 순간 9시간 어긋난 디바운스가 된다. W3이 필드 7과 함께 확정했다 — 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md).
- **API 요청 from · to는 오프셋 없는 ISO 8601을 받지 않는다(판정).** 오프셋이 없으면 서버 시간대로 해석되어, 같은 요청이 서버 설정에 따라 9시간 다른 구간을 조회한다. 거절 코드는 common.validation_failed/400이다([02_error_codes.md](./02_error_codes.md)).

## ★ ClickHouse 컬럼 시간대는 저장값이 아니다

원본에는 "모든 시각은 UTC로 저장하고 표시 시점에만 변환"(원본 architecture.md §12)과 "ts DateTime64(3, 'Asia/Seoul')"(원본 architecture.md §7.1)이 나란히 있다. **둘은 모순이 아니다** — 그리고 ADR-27이 컬럼 인자를 'UTC'로 바꾼 것도 저장값을 바꾸지 않는다.

- **A형 — 통념:** "컬럼에 Asia/Seoul이 붙었으니 KST 벽시계 값이 저장된다(UTC로 바꾸면 값이 9시간 옮겨진다)." **부정:** DateTime64는 시간대 인자와 무관하게 epoch 기준의 틱 수를 저장한다 — 공식 문서 "시간대는 행에 저장되지 않고 컬럼 메타데이터에 저장된다"([../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) ClickHouse DateTime). 같은 순간을 UTC 컬럼과 Asia/Seoul 컬럼에 넣으면 디스크의 바이트가 같다. **진짜 축:** 시간대 인자는 ① 문자열로 출력할 때의 표시 ② 문자열을 입력받을 때의 파싱 ③ toStartOfDay · toYYYYMMDD 같은 달력 함수의 경계 세 가지만 바꾼다. **대체 경로:** 저장값을 확인하려면 toUnixTimestamp64Milli(ts)로 epoch를 직접 본다. 화면의 시각이 9시간 어긋나 보이면 저장이 아니라 ①②③ 중 어디서 시간대가 개입했는지를 찾는다.

시간대 인자가 실제로 바꾸는 것을 적는다. 가운데 열은 **원본 DDL(인자 없음)의 동작**이며 ADR-27 뒤에는 모든 컬럼이 왼쪽 열처럼 동작한다.

| 동작 | 시각 컬럼(UTC · ADR-27) | 원본의 ingested_at · alarm_eval.ts(인자 없음) | 원본 구성의 실패 형태 |
|------|---------------|--------------------------------------|----------|
| 문자열 출력 | UTC 벽시계 | 서버 시간대 벽시계 | 같은 행의 두 시각이 서버 시간대만큼 떨어져 보인다 |
| 문자열 입력 파싱 | UTC로 해석 | 서버 시간대로 해석 | 적재가 문자열 시각을 보내면 서버 설정에 따라 값이 바뀐다 |
| 달력 함수 경계(인자 없이 부를 때) | UTC 자정 · UTC 월 | 서버 시간대 자정 · 월 | 일 · 월 단위 경계가 컬럼마다 다르다 |
| epoch 비교 · 차 | 영향 없음 | 영향 없음 | 없음 |

- **적재는 시각을 epoch 숫자로 보낸다(판정).** Stream의 t0 + dt는 이미 epoch ms이므로 문자열로 바꾸지 않고 넘기면 파싱 개입이 사라진다. 문자열 경유는 서버 시간대 설정 하나로 전 행이 어긋나는 경로다.
- **ClickHouse 서버 시간대 설정은 스키마에서 빠졌다.** 모든 시각 컬럼이 시간대를 명시하므로 파티션 · 버킷 경계가 서버 timezone에 의존하지 않는다. 서버 설정은 인자 없는 수동 조회(now() · toDate(now()))와 시스템 로그 테이블 표시에만 남으며, ADR-27이 **UTC**로 판정했다(W6 판정 Asia/Seoul 대체 · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) — 컬럼 · PostgreSQL과 같은 값이라 수동 조회의 "오늘"이 파티션 날짜와 맞는다. **사람이 KST 날짜로 세려면 인자를 명시한다** — toDate(ts, 'Asia/Seoul').

## 버킷 경계 · 파티션 경계와 시간대

경계는 두 종류다. **저장 운영 경계**(파티션 · TTL · 보존)는 사람이 보는 뜻이 없어 DB 처리 시간대 UTC로 자르고, **달력 의미 경계**(화면에 "하루"로 보이는 버킷)는 함수 인자에 'Asia/Seoul'을 명시해 KST로 자른다(ADR-27).

| 대상 | 함수 | 경계 시간대 | 종류 | 시간대에 따라 경계가 움직이는가 |
|------|------|----------|------|---------------------------|
| tag_1m 버킷 | toStartOfMinute(ts) | UTC(컬럼) | 해당 없음 — 어느 쪽이든 같다 | **아니다** — 분 경계는 모든 정수 시간 오프셋에서 같다 |
| tag_1h 버킷 | toStartOfHour(bucket) | UTC(컬럼) | 상동 | 아니다 — Asia/Seoul은 +09:00 정수 시간이라 KST 정시와 UTC 정시가 같은 순간이다 |
| tag_1d 버킷 | toStartOfDay(bucket, **'Asia/Seoul'**) | **KST 자정(인자 명시)** | **달력 의미** | 움직인다 — UTC 자정이면 KST 09:00이다 |
| tag_raw 파티션 · TTL | toYYYYMMDD(ts) · toDateTime(ts) + 7일 | **UTC 날짜** | 저장 운영 | 움직인다 — 파티션이 KST 09:00에 갈린다 |
| alarm_eval 파티션 · TTL | toYYYYMMDD(ts) · + 30일 | **UTC 날짜** | 저장 운영 | 상동 |
| tag_1m · tag_1h 파티션 | toYYYYMM(bucket) | **UTC 월** | 저장 운영 | 움직인다 — KST 1일 09:00에 넘어간다 |
| tag_1d 파티션 | toYear(bucket) | **UTC 년** | 저장 운영 | 움직인다 — 아래 A형 |
| alarm_event 월 파티션 | occurred_at 월 RANGE(pg_partman) | **UTC 월 1일 00:00** — 세션 timezone(DB 기본 UTC) | 저장 운영 | 움직인다 — 정본 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| 대조군 일 파티션 | ts 일 RANGE(pg_partman) | **UTC 자정** — 상동 | 저장 운영 | 움직인다 — tag_raw 파티션 날짜와 같은 경계여야 일 단위 대조가 파티션 하나씩 맞는다 |

- 검산: 대상 = **9** · 달력 의미 1(tag_1d 버킷) · 저장 운영 6 · 시간대 무관 2
- **저장 운영 경계는 사람이 보지 않는다(B형).** 결론 — 파티션이 KST 09:00에 갈려도 화면 · API 응답은 바뀌지 않는다. 반대 시나리오 — 파티션을 KST로 두려면 DB 처리 시간대를 KST로 두거나 파티션 식마다 인자를 박아야 하고, 그러면 DB가 내보내는 문자열 · 인자 없는 date_trunc · 수동 조회의 날짜가 한 저장소 안에서 둘로 갈린다. 파생 지침 — 보존이 "며칠 뒤 몇 시에 지워지는가"를 말할 때는 UTC 자정(= KST 09:00)으로 적는다([../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)).
- **A형 — "KST 1월 1일 막대가 전년 파티션에 들어 있다"는 버그가 아니다.** tag_1d 버킷은 KST 자정 = 전날 UTC 15:00이라 toYear(bucket)을 UTC로 계산하면 KST 1월 1일 버킷이 전년 파티션에 든다. tag_1d는 TTL이 없어 파티션 DROP이 일어나지 않으므로 결과가 바뀌지 않는다 — 파티션 ID로 연도를 세지 말고 toYear(bucket, 'Asia/Seoul')로 센다.
- **분 · 시 버킷은 두 시간대에서 같은 순간이다.** 그래서 tag_1m · tag_1h 버킷과 alarm_eval의 1m · 1h 집계는 전환의 영향을 받지 않는다 — 일 경계만 시간대를 탄다.

### 달력 의미 경계 — 닫힌 목록

화면에 "하루"로 보이는 경계만 KST다. **아래 목록 밖의 경계에 'Asia/Seoul' 인자를 새로 박지 않는다** — 늘리려면 이 표에 행을 먼저 둔다.

| # | 경계 | 자리 | KST를 명시하는 수단 | 셋이 어긋나면 |
|:-:|------|------|------|------|
| 1 | tag_1d 버킷 | mv_tag_1d(ClickHouse DDL 006) | toStartOfDay(bucket, 'Asia/Seoul') — 값은 UTC 순간(전날 15:00Z)으로 저장되고 화면에서 KST 00:00으로 보인다 | 기준이다 |
| 2 | 시계열 조회 1d 버킷 경계 스냅 | api 해상도 선택(캐시 키 경계 스냅 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)) | epoch 연산 — KST 오프셋 +9시간을 더해 일 단위로 내린 뒤 뺀다 | 1d 캐시 키가 버킷 경계와 9시간 어긋나 첫 막대가 반쪽 하루로 잘린다 |
| 3 | 웹 추이 1d 스냅 | 추이 분석 화면의 구간 정렬([../08_screen/04_trend_analysis.md](../08_screen/04_trend_analysis.md)) | 상동 | 화면이 요청하는 구간과 tag_1d 버킷이 어긋나 같은 날이 두 막대로 갈린다 |

- 검산: 달력 의미 경계 = **3** — #2 · #3은 #1과 같은 경계를 epoch로 재현하는 자리다
- **KST 값은 site.timezone이 갖는다.** site.timezone은 저장 시간대가 아니라 **표시 · 달력 의미 시간대**이며 'Asia/Seoul' 하나로 CHECK 고정된다([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §인계 판정). 위 세 자리가 그 값과 같아야 사이트의 하루와 tag_1d의 하루가 맞는다.
- **대조 · 검증 쿼리의 일 단위 집계는 달력 의미가 아니다.** 저장소 간 일 count 대조(AC-21)는 파티션 경계와 같은 UTC 날짜로 세면 파티션 하나씩 맞고, KST 날짜로 세려면 양쪽에 인자를 명시한다 — 한쪽만 명시하면 9시간이 어긋난 두 날짜를 비교한다.

## 기준값 + 오프셋 인코딩 (Stream 엔트리)

스캔 사이클 하나가 Stream 엔트리 하나다. 시각은 엔트리 단위 기준값 t0와 행 단위 오프셋 dt의 합으로 복원한다(원본 data_flow.md §14.1).

| 필드 | 타입 | 뜻 | 복원 |
|------|------|----|------|
| t0 | uint64 | 기준 타임스탬프 epoch ms | 엔트리당 1개 |
| dt[i] | int32 | t0 기준 오프셋 ms | ts[i] = t0 + dt[i] |
| s | uint64 | scan_seq — 스캔 사이클 일련번호 | ClickHouse scan_seq로 그대로 |
| v | uint8 | 스키마 버전 | 디코더 선택 |

- **오프셋을 8바이트에서 4바이트로 줄이는 것이 목적이다.** int32 ms는 ±약 24.8일을 표현하므로 한 스캔 사이클 안의 오프셋으로는 넘칠 수 없다. 넘친다면 한 엔트리에 서로 다른 사이클이 섞였다는 결함이다.
- **t0는 엔트리 안 ts의 최솟값이다(W4 판정).** 발행자는 dt ≥ 0이 되게 t0를 잡고, 소비자는 음수 dt를 거절하지 않고 계수만 한다 — 발행자 결함을 적재 유실로 바꾸지 않기 위해서다. 정본 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md).
- **Stream 대기(체류)의 시작점은 t0가 아니라 엔트리 ID의 밀리초(Redis가 XADD를 받은 시각)다(W3 판정 · W4 통일).** 원본 식 "XREADGROUP 수신 시각 − t0"(원본 data_flow.md §15)는 t0가 폴링 시각이라 Modbus 왕복 · 디코딩 · 인코딩 · XADD를 Stream 대기에 함께 센다 — Modbus 지연이 는 실험에서 플러시 주기를 줄이는 잘못된 튜닝으로 이어진다. 정본 [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §구간 경계 판정. 엔트리 단위 지표이므로 행 단위 E2E와 섞어 쓰지 않는다.

## 캐시 키 시간 스냅과 TTL 분류

시계열 조회 캐시 키는 from · to를 **해상도 버킷 경계로 내림**한 뒤 정규화 · 해싱한다(원본 architecture.md §10.2).

| 단계 | 시각 처리 | 스냅하지 않으면 |
|------|---------|--------------|
| 해상도 선택 | 범위 길이(to − from)로 interval 결정 | 해당 없음 |
| 경계 스냅 | from · to를 선택된 해상도의 버킷 경계로 내림 | 초 단위 now()가 키에 들어가 매 요청이 다른 키가 되고 히트율이 0에 수렴한다 |
| TTL 분류 | to와 현재 버킷 시작을 비교 — 완전 과거 · 현재 버킷 포함 · 최근 구간 | 불변 구간을 짧게, 갱신 구간을 길게 캐시해 낡은 값이 보인다 |
| 지터 | TTL에 무작위 가산 | 동시 만료로 스탬피드가 난다 |

- **스냅은 epoch 연산으로 한다.** 분 · 시 스냅은 시간대와 무관하지만 1d 스냅을 문자열 날짜로 하면 서버 시간대에 따라 다른 자정으로 내림되어, 같은 조회가 두 키로 갈린다. SW-04(CACHE_KEY_TIME_SNAP)를 끄면 스냅이 빠진 상태를 재현한다 — 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md).
- **"현재"는 api 서버 시계다.** from · to는 브라우저가 보내지만 TTL 분류의 현재 버킷은 서버가 정한다. TTL 값과 분류 경계는 2계층 조정값이며 정본은 [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)다.

## STALE 판정

| 항목 | 계약 |
|------|------|
| 판정식 | 현재 − ts > scan_rate_ms × 배수 이면 STALE(5) |
| 현재 | api 서버 시계(조회 요청 처리 시점) |
| ts | rt:latest 값의 ts — 마지막으로 적재된 측정 시각 |
| 배수 | 2계층 조정값 — 현행 3(원본 data_flow.md §5). 소유 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 기준 주기 | 태그별 tag_master.scan_rate_ms — 설비 단위가 아니다 |
| 결과 | 응답의 품질을 5로 바꿔 경고한다. 저장값은 바꾸지 않는다 |

- **생성 모드의 ts가 과거면 전부 STALE이다.** 모드 B · C가 시간 압축으로 과거 시각을 찍으면 적재는 정상인데 최신값 화면이 전부 경고가 된다. 버그가 아니라 판정식이 ts 의미를 그대로 따른 결과이며, 실시간 화면을 보는 실험은 현재 시각으로 생성한다.
- **ingested_at으로 STALE을 판정하지 않는다.** 백프레셔로 늦게 적재된 값이 "방금 갱신"으로 보여, 수집이 멈춘 설비를 살아 있는 것으로 표시한다.

## 표시 시간대

| 위치 | 규칙 |
|------|------|
| 웹 화면 | **Asia/Seoul로 표시한다.** 변환은 표시 시점에 한 번만 한다 — 시각 · 경과 시간 · 차트 축(uPlot · ECharts) · 실행 패널 · 증거 화면(EXP-PERF · EXP-FLOW)까지 같은 규칙이다(표시 정본 [../08_screen/01_standards.md](../08_screen/01_standards.md)) |
| API 응답 | UTC 그대로 낸다 — 측정 시각 epoch ms · 업무 시각 ISO 8601 Z(ADR-27 전후 불변 · 형식 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md)) |
| DB가 내보내는 문자열 | UTC — PostgreSQL 세션 기본 timezone · ClickHouse 컬럼 인자가 UTC다. 앱은 DB 문자열 시각을 화면에 그대로 싣지 않는다 |
| 호스트 psql · clickhouse-client | 세션 시간대에 따른다 — 기본 UTC. KST로 읽으려면 세션에 SET timezone = 'Asia/Seoul'(PostgreSQL) · SETTINGS session_timezone = 'Asia/Seoul'(ClickHouse — 인자 없는 컬럼 · 함수에만 듣고 UTC 인자를 가진 컬럼의 출력은 바꾸지 않는다) 또는 toTimeZone(ts, 'Asia/Seoul')을 쓴다. 수동 조회는 결과에 시간대를 밝혀 기록한다 |
| 측정 기록 | 시각을 적을 때 오프셋을 붙인다 |

- **site.timezone은 'Asia/Seoul' 하나로 CHECK 고정된다(W3 판정 · 뜻은 ADR-27이 다시 적었다).** 이 값은 **표시 · 달력 의미 시간대**이지 저장 · DB 처리 시간대가 아니다 — DB는 UTC로 처리하고 이 값은 화면 변환과 §달력 의미 경계 닫힌 목록이 따른다. 다른 값이 들어오면 사이트의 하루와 tag_1d의 하루가 조용히 어긋난다. 다중 시간대는 범위 밖이다. 정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §인계 판정.
- **표시 변환을 두 번 하지 않는다.** 서버가 KST 문자열로 내리고 브라우저가 다시 로컬 시간대를 적용하면 9시간이 두 번 더해진다. 원본 검증 항목 "저장 시각과 UI 표시 시각 대조 — 오차 없음"(원본 data_flow.md §17)이 이 실패를 잡는다.

## DB 시간대 전환 구현 목록

ADR-27을 구현이 따라올 자리의 **정본 목록**이다. 문서는 코드를 쓰지 않는다 — 자리와 규칙만 적는다. **수집 규칙 — 전수 = 'Asia/Seoul' 리터럴 + 시간대 없는 toString · toDate + 인자 없는 달력 함수(toStartOfDay · toStartOfHour · toStartOfMinute · toYYYYMMDD · date_trunc 등) + +9h 오프셋 연산(9 × 3600 · +09:00 · +09)**을 apps · packages · scripts · infra에서 찾은 자리다(2026-09-28 grep). 한 파일의 여러 자리는 같은 규칙이면 한 행에 묶는다. 전환 절차(순서 · 멱등 판정 · 기존 볼륨 · 스냅샷)의 정본은 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §DB 시간대 전환이다.

| # | 자리 | 지금 | 규칙 | 조치 |
|:-:|------|------|------|------|
| 1 | infra/postgres/postgresql.conf timezone · log_timezone | Asia/Seoul | 'UTC' — 설정 재적재로 새 세션부터 듣는다 | 변경 |
| 2 | migrate 관리자 단계 — DB 기본 timezone | 001이 ALTER DATABASE plc SET timezone 'Asia/Seoul' | 관리자 단계가 매 migrate **ALTER DATABASE plc SET timezone TO 'UTC'**를 멱등하게 맞춘다 — DB 소유자(관리자)만 할 수 있어 app_owner로 도는 순번 파일에 둘 수 없다 · 001 파일은 고치지 않는다 | 변경 |
| 3 | infra/clickhouse/config.d/timezone.xml | Asia/Seoul | UTC — 서버가 기동 시점에 읽으므로 재기동으로 듣는다 | 변경 |
| 4 | infra/compose/compose.yml TZ 환경변수 | postgres · api · datagen · grafana 모두 Asia/Seoul | postgres는 UTC(DB 처리 시간대) · api · datagen은 #24 · grafana는 표시라 유지 | 변경(postgres) |
| 5 | PostgreSQL 순번 009(제안 파일명 009_utc_partition_boundaries.sql) | 없음 | alarm_event 월 · 대조군 일 파티션을 UTC 경계로 다시 세운다 — 세션 시간대는 SET LOCAL timezone 'UTC'(migrate가 대기 순번 전체를 한 트랜잭션으로 감싼다 — 그 트랜잭션 안에서만 듣게) · 경계가 이미 UTC면 건너뛴다 | 신설 |
| 6 | ClickHouse DDL 002 · 003 · 004 · 009(005의 tag_1h · tag_1d는 AS plc.tag_1m으로 구조를 물려받는다) | 시각 컬럼 DateTime64(3, 'Asia/Seoul') · DateTime('Asia/Seoul') · last_v 상태 인자 | 인자를 'UTC'로 — 빈 볼륨이 곧바로 UTC 스키마로 선다 | 변경 |
| 7 | ClickHouse DDL 006 mv_tag_1d | toStartOfDay(bucket, 'Asia/Seoul') | **유지** — 달력 의미 경계 #1 | 유지 |
| 8 | migrate ClickHouse 시간대 전환 단계(순번 파일 밖) | 없음 | DDL 순번 적용 전에 카탈로그(system.columns)로 'Asia/Seoul' 컬럼을 찾아 재구성 · 인자만 교체 — 없으면 건너뛴다. **판정 대상은 테이블 8**(tag_raw · alarm_eval · tag_1m · tag_1h · tag_1d · 업무 대조 3)이고 **MV는 제외**한다 — mv_tag_1d.bucket의 DateTime('Asia/Seoul')은 정상(달력 의미 #1)이라 판정에서 뺀다 · MV 3은 재구성 때 DDL 파일로 다시 선다 | 신설 |
| 9 | PostgreSQL 004 · 007 머리 주석 "경계 Asia/Seoul" | 주석 | 적용된 순번의 내용을 바꾸지 않는다 — 009 머리 주석이 대체 사실을 적는다 | 불변 |
| 10 | apps/api mode-d-options(KST 오프셋 · 일 시작 · 일 이름 · 일 분할) | KST 자정으로 자른다 | **UTC 자정**으로 — tag_raw 파티션(toYYYYMMDD UTC) · 대조군 일 파티션과 같은 경계여야 한 INSERT가 파티션 하나에 든다 · **시험 기대값 동반 변경**(apps/api test/mode-d.test.ts의 KST 일 분할 기대) | 변경 |
| 11 | apps/api mode-d-stores(구간 비교 인자 · 일 파티션 생성 · 정리의 오늘) | fromUnixTimestamp64Milli(…, 'Asia/Seoul') · toDateTime(…, 'Asia/Seoul') · 오늘(KST) | 비교 인자는 'UTC'로 통일(epoch 비교라 결과 불변) · create_partition_time에 넘기는 값은 **UTC 자정** — pg_partman 5.5.0은 넘긴 값을 하한 그대로 쓴다(내림하지 않는다 · 실측) · 정리의 오늘 · 일 이름은 UTC · **시험 기대값 동반 변경**(apps/api test/mode-d-stores.test.ts의 KST 자정 · +09 경계 기대) | 변경 |
| 12 | apps/api mode-d 진입점 문구 · mode-d-runner.ts 주석 | KST 일 | UTC 일 — 러너 머리 주석 · 파티션 생성 주석을 포함한다 | 변경 |
| 13 | apps/api lab s3-verify | tag_1d 식 toStartOfDay(ts, 'Asia/Seoul') · tag_1h 식 toStartOfHour(ts)(인자 없음 — 시 경계는 두 시간대가 같아 불변) · AC-21 일 count 양쪽 KST 명시 | tag_1d 식 유지(#1) · 일 count는 파티션과 같은 UTC 날짜로 — 양쪽 명시가 유지되면 결과는 맞다 | 변경(일 count) |
| 14 | apps/api alarm-events 보존 창 시작 date_trunc('month', …) | 인자 없음 · 주석 "DB 기본 Asia/Seoul" | 인자 없는 date_trunc가 세션 UTC = 파티션 경계 UTC와 저절로 맞는다 — 주석만 고친다 | 주석 |
| 15 | apps/api alarm-evals 1m · 1h epoch 버킷 주석 | "KST 오프셋의 약수" | 결과 불변 — 주석만 | 주석 |
| 16 | apps/api timeseries resolution 1d 스냅 | KST 자정 epoch 연산 | **유지** — 달력 의미 경계 #2 | 유지 |
| 17 | apps/api oltp-lab 실험 DB DDL · 채우기 | plc 밖 실험 DB의 시각 컬럼 'Asia/Seoul' · toDateTime64('2026-01-01 00:00:00', 3, 'Asia/Seoul') | 실험 DB DDL은 009와 같은 정의(UTC) — 두 정의가 다르면 EXP-41 그래뉼 변형이 다른 테이블을 잰다 · 채우기 값은 인자 명시라 유지 | 변경(DDL) |
| 18 | PostgreSQL site.timezone CHECK · packages/shared 사이트 계약 · 웹 사이트 등록 문구와 e2e · api 시험 픽스처(biz-core.test.ts) | 'Asia/Seoul' 고정 | **유지** — 표시 · 달력 의미 시간대 | 유지 |
| 19 | apps/web 표시 변환(시각 포맷 · uPlot tzDate · 축 표기) · 표시 시험 설정(package.json test:tz · playwright.config.ts timezoneId) | Asia/Seoul 한 번 | **유지** — 새 화면 · ECharts 축도 같은 규칙 | 유지 |
| 20 | apps/web 추이 1d 스냅 | KST 자정 epoch 연산 | **유지** — 달력 의미 경계 #3 | 유지 |
| 21 | scripts/lab/s5/grid 러너 · 시험 | S = KST 자정 − 50,020초 · "한 KST 일 = 한 파티션" · 시간대 없는 TSV 시각을 KST로 해석 · 인자 없는 toStartOfHour · date_trunc('hour' · 'minute')(시 · 분 경계라 불변) | 파티션 가정은 **UTC 자정**으로 · TSV 시각은 UTC로 해석(컬럼 인자 UTC 뒤 출력이 UTC) · 인자를 명시한 비교는 유지 가능 | 변경 |
| 22 | scripts/lab 요청 시각 생성(s4 k6-query.js · stampede-rep.sh · ac06-capture.cjs · s5 k6-mix.js) | +09:00 오프셋 ISO | **유지** — 오프셋 포함 ISO는 요청 계약이 받는다 | 유지 |
| 23 | scripts/lab/s0 전체(자체 DDL로 닫힌 실습) | DDL · 실습 스크립트의 'Asia/Seoul' | 변경 없음 — S0 수동 실습의 기록이다 · migrate 스키마와 따로 서는 자체 DDL을 쓴다 | 유지 |
| 24 | infra/compose/compose.yml api · datagen TZ | Asia/Seoul | **UTC**(리드 판정 2026-09-28) — DB 처리와 같게 둔다 · 코드는 TZ에 기대지 않는다(로컬 시간 함수로 날짜를 자르지 않는다) · 화면 표시는 웹이 Asia/Seoul을 명시한다 | 변경 |
| 25 | apps/api lab s2-verify AC-04 알려진 행(toString(ts) AS ts_kst) · 웹 apps/web test/time.test.ts 머리 주석 | 시간대 없는 toString — 컬럼 인자 Asia/Seoul이라 KST 문자열이었다 | **toString(ts, 'Asia/Seoul')**로 — AC-04 증거는 KST 문자열이어야 웹 test/time.test.ts KNOWN.clickhouseKst · 기록 010과 대조된다(컬럼 인자 UTC 뒤 인자 없는 toString은 UTC 문자열) · 웹 시험 주석 "컬럼 시간대(DateTime64(3, 'Asia/Seoul'))로 낸 문자열" → toString(ts, 'Asia/Seoul') 문자열로 동반 | 변경 |
| 26 | scripts/lab/s5/load/exp45-control-stream.sh 일 대조(일 목록 +9h · toDate(ts, 'Asia/Seoul') · timestamptz '+09' 경계) | 양쪽 명시 KST 일 창 | **유지** — 양쪽이 같은 KST 일 창을 명시해 저장소 시간대와 무관하게 결과가 불변이다 · 기록 045 재현성 | 유지 |
| 27 | scripts/lab/s4/hist-seed.sh 이력 시드 toDateTime64(epoch, 3, 'Asia/Seoul') | epoch 정수를 인자 명시로 변환 | **유지** — epoch 값이 그대로라 저장값 불변 · 'Asia/Seoul'을 grep 일괄 치환하지 않는 표지 행 | 유지 |
| 28 | scripts/lab/s3/ac13-ttl.sh 대상 파티션 toYYYYMMDD(now() − INTERVAL 10 DAY) | 인자 없음 — 서버 timezone(KST) 날짜 | **유지** — 서버 timezone과 tag_raw 컬럼 인자가 함께 UTC가 되어 파티션 ID와 저절로 맞다 · 한쪽만 UTC인 전환 중간 상태에서는 어긋나므로 전환을 마친 뒤 돈다 | 유지 |
| 29 | apps/web 요청 직렬화 · 입력 해석(lib/time.ts +9h 오프셋 ISO · 추이 분석 사용자 지정 범위 입력의 +09:00 파싱) | +09:00 오프셋 ISO | **유지** — 오프셋 포함 ISO는 같은 순간이라 요청 계약이 받는다 · 입력은 사용자가 KST로 친 값이다 | 유지 |
| 30 | ClickHouse DDL 006 mv_tag_1h toStartOfHour(bucket) · 007 mv_tag_1m toStartOfMinute(ts) | 인자 없음 — 컬럼 시간대를 따른다 | **유지** — 시 · 분 경계는 KST(정수 시 오프셋)와 UTC가 같아 결과 불변 · 인자를 붙이지 않는다 | 유지 |

- 검산(조치별): 변경 13(1 · 2 · 3 · 4 · 6 · 10 · 11 · 12 · 13 · 17 · 21 · 24 · 25) + 신설 2(5 · 8) + 주석 2(14 · 15) + 불변 1(9) + 유지 12(7 · 16 · 18 · 19 · 20 · 22 · 23 · 26 · 27 · 28 · 29 · 30) = **30**
- **측정 기록(docs/measurements)은 고치지 않는다.** 기록은 당시 조건(Asia/Seoul 파티션 · 서버 timezone)이다 — 전환 뒤 같은 실험을 다시 재면 조건 칸에 ADR-27 이후임을 적는다.
- **"유지"도 목록에 두는 이유** — grep으로 'Asia/Seoul'을 찾아 일괄 치환하면 달력 의미 경계 3자리와 표시 변환이 함께 UTC가 되어 화면의 하루가 KST 09:00에 시작한다. 유지 행이 그 치환을 막는 목록이다.

## 공학 단위

| 항목 | 계약 | 근거 · 실패 |
|------|------|-----------|
| 변환식 | eng = raw × scale + offset_value | 원본 tech_stack.md §6. 컬럼명은 offset이 아니라 offset_value다 |
| 단위 문자열 | tag_master.unit — 저장값에 단위가 붙지 않는다 | 단위는 조회 시 Dictionary로 붙인다. 값과 단위를 함께 저장하면 단위 변경이 과거 행 수정이 된다 |
| 스케일 변경 | **새 tag_id 발급** · 이전 태그 비활성 | 같은 tag_id의 scale을 바꾸면 과거 값의 의미가 조용히 바뀐다(원본 architecture.md §12) |
| 범위 | range_min · range_max는 공학 단위 | BAD_RANGE 판정은 변환 후 값으로 한다. raw로 판정하면 scale 1이 아닌 태그에서 범위가 어긋난다 |
| 데드밴드 | tag_master.deadband는 **공학 단위 절대값(판정)** | 아래 불일치 |

- **불일치 판정 — 데드밴드의 단위.** 원본 tech_stack.md §6은 deadband를 절대값 0.5로 예시하고, 원본 data_flow.md §3.3은 "측정범위의 0.1% · 0.5% · 1.0%"로 비율 실험을 적었다. 이 문서는 **컬럼 값을 공학 단위 절대값으로, 비율은 실험 파라미터로** 판정한다 — 절대값 = (range_max − range_min) × 비율로 환산해 설정한다. 컬럼을 비율로 두면 범위가 없는 태그의 데드밴드를 정의할 수 없다.

## 부동소수와 오차 허용 비교

측정값은 Float64다. **원시 집계와 롤업 집계의 대조는 오차 허용 비교로만 한다.** 동등 비교는 병합 순서에 따라 거짓 불일치를 낸다 — 부분 평균 상태를 합치는 순서가 파트 머지마다 달라 마지막 자리 비트가 달라진다.

| 대조 | 비교 방법 | 이유 |
|------|---------|------|
| count(원시) vs countMerge(롤업) | **정확 일치** | 정수다. 어긋나면 적재 누락 · 중복이다 |
| min · max | 정확 일치 | 선택 연산이라 반올림이 없다 |
| avg vs avgMerge | 허용 오차 비교 | 합산 순서에 따라 최하위 비트가 달라진다 |
| p95 원시 분위수 vs quantilesTDigestMerge | **근사 허용 범위** — 부동소수 오차로 비교하지 않는다 | TDigest 근사 오차가 부동소수 오차보다 훨씬 크다. 부동소수 허용치로 비교하면 늘 불일치다 |
| last(argMax) | 정확 일치 — 같은 ts 중복이 없을 때 | 같은 ts가 둘이면 어느 값이 남을지 정하지 않는다 |

- **허용 오차는 W2가 판정했다.** avg는 |avg(원시) − avgMerge(롤업)| ≤ 2·γ(n)·S/n(γ(n) = nu/(1 − nu) · u = 2^−53 · S = 버킷의 원시 |value| 합)으로 합산 순서와 무관한 Float64 상계라 1계층 구조값이다. count · min · max · last는 정확 일치다. **p95만 미확인**이며 확정 수단은 원시 안 순위 오차의 3회 측정이다. 정본 [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md).
- **COUNTER · 정수형 원천도 Float64로 저장된다.** UInt32 랩어라운드 값은 2^53 미만이라 Float64에서 정확하다. 랩어라운드 보정(증분 계산)은 저장 후 조회 시점의 해석이다.
- **Gorilla 코덱은 무손실이다.** 압축이 값을 바꾸지 않으므로 압축률 실험이 정합성 비교를 오염시키지 않는다.

## 수치 · 단위 표기 규칙

문서 본문에서 수치와 단위를 적는 형식이다.

| 대상 | 규칙 | 예 |
|------|------|-----|
| 시간 | ms · s · 분 · 시간 · 일. 숫자와 단위 사이 한 칸 | 1,000 ms · 60 s |
| 크기 | KB · MB · GB(2진 접두 여부를 따지지 않는 어림값). 설정 키 값은 원문 그대로 | 2.0 GB · shared_buffers 512MB |
| 처리량 | pps(초당 포인트) · 행/s · 회/s | 10,000 pps |
| 서술 수량 | 천 단위 쉼표 | 50,000행 |
| 설정값 · 식별자 안의 수 | 쉼표 없음 — 설정 파일에 쓰는 모양 그대로 | MAXLEN 200000 · LIFETIME(MIN 300 MAX 600) |
| 범위 | 물결표 — 양 끝 단위는 뒤에 한 번 | 30~300 s |
| 비율 · 배수 | % · 배 | 1/60 · 5배 |
| 뺄셈 | 유니코드 − | ingested_at − ts |
| 2 · 3계층 수치 | 현행 값 뒤에 소유처 · 원본 예상치 표기 | 현행 1,000 ms(소유 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)) |

- **설정값에 쉼표를 넣지 않는 이유** — 설정 파일 · 명령에 그대로 옮겨 붙일 때 쉼표가 들어가면 파싱 오류가 나거나 다른 값으로 읽힌다.
- 수치 계층(구조값 · 조정값 · 미확인)의 판정은 [../CLAUDE.md](../CLAUDE.md) 수치 3계층을 따른다.

## 관련 문서

- [../README.md](../README.md) — 전역 불변식 시각 의미론 · 고정 기준 단위와 시각
- [03_enums_state_machines.md](./03_enums_state_machines.md) — 품질 코드 STALE · 집계 함수의 정확성
- [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) — 시각 컬럼 DDL · 시간대 표기 통일
- [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) — 롤업 버킷 · 일 경계
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — 단계별 스키마
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — 시각 직렬화 형식
- [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) — 구간별 지연 예산과 측정 지점
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-27 DB 시간대 UTC · 표시 KST · 달력 의미 경계 예외
- [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) — DB 시간대 전환 절차
