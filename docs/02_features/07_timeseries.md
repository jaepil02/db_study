# TSQ — 시계열 조회 기능 명세

> **대상**: 시계열 조회(TSQ · NestJS timeseries 모듈) 기능 목록 · 기능별 경계 · 스위치 교체 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID TSQ-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — TSQ-03 · TSQ-05 키 표기 cache:q:{hash} · lock:rebuild:{hash} → **cache:q:{sha1} · lock:rebuild:q:{sha1}**(정본 05_data_stores/05) — 기능 수 불변
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 내보내기 범위 상한 · 등급 닫힘(정본 12_security/03)
> **개정일**: 2026-09-24 — W2 요구사항 판정 반영 — ClickHouse 불가 시 조회 응답(clickhouse_unavailable/503)의 채번 보류를 닫는다
> **원천**: 원본 architecture.md §7.2 · §7.4 · §8.2 · §10 · §10.1 · §10.2 · §10.3 · §11 · §11.1 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §6 · §6.1 · §6.2 · §6.3 · §14.1 · §16(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §4.3 · §5 S2 · S4(커밋 ff66a37) · [13_switch_matrix.md](./13_switch_matrix.md) SW-03 · SW-04 · SW-05 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 조회 해상도 · 집계 함수

TSQ는 **ClickHouse에 쌓인 시계열을 화면 폭에 맞게 줄여 돌려주는 도메인**이다. 조회 범위로 해상도를 서버가 고르고, 캐시 키를 정규화해 반복 조회를 Redis에 흡수하고, 캐시 미스가 몰리면 한 요청만 원천을 읽게 한다(원본 architecture.md §10 · 원본 data_flow.md §6). 자기 저장 테이블은 없다 — tag_raw와 롤업을 읽고 cache:q · lock:rebuild 키만 소유한다.

**TSQ는 Redis 캐시 역할 스위치 넷 중 셋의 자리다.** SW-03(조회 캐시) · SW-04(키 시간 스냅) · SW-05(스탬피드 락)가 모두 이 도메인의 기능을 교체한다. 그래서 TSQ의 기능 경계는 "스위치를 끄면 무엇이 원천으로 떨어지는가"로 읽어야 한다. 해상도 자동 선택은 스위치가 없다 — 끄면 긴 범위 원시 조회가 ClickHouse를 메모리 한계로 죽이는 **보호 장치**이기 때문이다(원본 data_flow.md §6.1).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 W5 몫).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **TSQ-01** | 시계열 조회 | 태그 배열(현행 상한 50) · 시간 범위(ISO 8601) · 해상도(raw · 1m · 1h · 1d — 미지정 시 서버 선택) · 집계 함수(avg · min · max · last · p95 복수) · 최대 포인트 수(현행 2000)를 받아 응답한다. 응답은 meta(interval · pointCount · downsampled · cached)와 태그별 points(**배열의 배열**)다 — 객체 배열보다 JSON이 약 1/3로 줄고 차트의 열 지향 형식으로 바꾸기 쉽다. 브라우저 직결이다. S2는 raw 고정이다 | S2 · S4 | F-04 | 해당 없음 | 07_api/05_timeseries | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(읽기) |
| **TSQ-02** | 해상도 자동 선택 | 범위 길이로 테이블을 고른다 — 1시간 이하 raw · 7일까지 1m · 90일까지 1h · 그 초과 1d(경계는 1계층 구조값). 결과 포인트가 최대치를 넘으면 한 단계 올린다 — **거절이 아니라 보정**이며 meta.interval에 드러난다 | S4 | F-04 | 해당 없음 — 보호 장치 | 07_api/05_timeseries | 상동 |
| **TSQ-03** | 캐시 키 정규화 | 시간 범위를 버킷 경계로 스냅하고 태그 배열을 정렬하고 기본값 파라미터를 뺀 정규화 문자열을 SHA-1로 해싱해 cache:q:{sha1}를 만든다. **스냅이 핵심이다** — 초 단위 now()를 그대로 쓰면 매 요청이 다른 키가 되어 히트율이 0에 수렴한다 | S4 | F-04 | SW-04 | 표면 없음 — TSQ-04의 내부 단계 | Redis cache:q |
| **TSQ-04** | 조회 결과 캐시 | cache-aside로 gzip 압축 결과를 둔다. TTL은 구간 성격으로 가른다 — 완전 과거 구간(길게) · 현재 버킷 포함(짧게) · 최근 수 분(캐시하지 않고 최신값 API · WebSocket으로 유도). TTL에 무작위 지터를 더해 동시 만료를 흩는다. TTL · 지터 값은 2계층 조정값이며 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md). **Redis 실패 시 짧은 타임아웃 뒤 ClickHouse로 우회한다**(degrade) | S2 · S4 | F-04 | SW-03 | 표면 없음 — TSQ-01의 내부 단계 | Redis cache:q |
| **TSQ-05** | 스탬피드 방지 | 캐시 미스에서 lock:rebuild:q:{sha1}를 SET NX PX로 잡은 한 요청만 ClickHouse를 부르고, 나머지는 짧게 대기한 뒤 캐시를 다시 읽는다(현행 참고 — 50 ms × 최대 3회). 해제는 **소유자 검증 Lua**로 한다 — 단순 DEL은 자기 락이 만료된 뒤 남의 락을 지운다 | S4 | F-04 | SW-05 | 표면 없음 — TSQ-01의 내부 단계 | Redis lock:rebuild |
| **TSQ-06** | 다운샘플 | 1차는 롤업 테이블이 이미 줄이고, 여전히 많으면 API가 LTTB로 2차 축소한다(piscina 워커 — 이벤트 루프 격리). 알람 분석 화면에는 극값을 보존하는 min · max 쌍을 쓴다. 단순 n번째 추출은 스파이크를 잃어 쓰지 않는다 | S4 | F-04 | 해당 없음 | 07_api/05_timeseries | 없음 — 계산 |
| **TSQ-07** | 태그 메타 부착 | 결과에 dictGet(plc.dict_tag)으로 태그명 · 단위를 붙인다. ClickHouse에는 tag_id만 있고 메타는 조회 시점에 붙인다 — 태그명이 바뀌어도 과거 데이터를 고치지 않는다 | S3 · S4 | F-04 | 해당 없음 | 07_api/05_timeseries | ClickHouse dict_tag(읽기) |
| **TSQ-08** | 진행 구간 분할 | "최근 N분"처럼 끝이 현재인 조회를 **확정된 과거 구간(긴 TTL 캐시)과 진행 중 마지막 버킷(최신값 또는 짧은 TTL)**으로 쪼개고 클라이언트가 합친다. 끝이 현재인 조회를 통째로 캐시하면 매번 미스가 나거나 오래된 값이 보인다(원본 architecture.md §10.2) | S4 | F-04 · F-03 | 해당 없음 | 07_api/05_timeseries | Redis cache:q · rt:latest(읽기) |
| **TSQ-09** | 원시 내보내기 | 원시가 꼭 필요한 조회를 스트리밍 다운로드로 보낸다(CSV · Parquet). ClickHouse가 FORMAT으로 직렬화한 응답을 그대로 중계해 애플리케이션 직렬화가 없다. 긴 범위 원시 조회를 조회 표면이 아니라 이 경로로 유도하는 것이 해상도 자동 선택의 짝이다. 레이트 리밋을 더 엄격히 건다 | S4 | F-04 | 해당 없음 | 07_api/05_timeseries | ClickHouse tag_raw(읽기) |

- 검산: TSQ-01~09 = **9**. 단계별(첫 도입 기준) S2 2(TSQ-01 · 04) + S3 1(TSQ-07) + S4 6(TSQ-02 · 03 · 05 · 06 · 08 · 09) = **9**
- 표면 있음 6(TSQ-01 · 02 · 06 · 07 · 08 · 09) + 표면 없음(내부 단계) 3(TSQ-03 · 04 · 05) = **9**. 표면 있음의 셋(02 · 06 · 07)은 TSQ-01 한 표면의 동작이며 표면 수는 W5가 센다.

## 조회 한 건의 단계

TSQ-01 한 요청이 지나는 단계다. 기전 정본은 [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)다.

```plain
① 권한 · 레이트 리밋        AUT-04 · 05 · 06(S7 이후)
② 해상도 선택              TSQ-02                 범위 → raw · 1m · 1h · 1d
③ 키 정규화                TSQ-03 (SW-04)         스냅 · 정렬 · 기본값 제거 · SHA-1
④ 캐시 조회                TSQ-04 (SW-03)         히트면 ⑧로
⑤ 락 획득                  TSQ-05 (SW-05)         실패하면 대기 → ④ 재조회
⑥ 집계 쿼리 · 메타 부착     ClickHouse · TSQ-07     -Merge 조합자 · dictGet
⑦ 다운샘플 · 캐시 적재      TSQ-06 · TSQ-04         LTTB → SET(TTL + 지터) → 락 해제
⑧ 응답                     TSQ-01                 meta.interval · downsampled · cached
```

- **③ · ⑤는 ④가 켜져 있을 때만 의미가 있다.** SW-03 off(캐시 없음)에서 SW-04 · SW-05를 켜고 끄는 측정은 차이가 0이다 — 조합 제약의 정본은 [13_switch_matrix.md](./13_switch_matrix.md)다.
- **⑥에서 롤업을 읽을 때 반드시 -Merge로 읽는다.** 롤업 컬럼은 집계 상태를 저장한다([../11_glossary/01_domain_terms.md](../11_glossary/01_domain_terms.md)).

## 스위치가 교체하는 것

| 스위치 | 교체 대상 기능 | off일 때 | 측정으로 보는 것 |
|------|------|------|------|
| SW-03 REDIS_QUERY_CACHE | TSQ-04 | 항상 미스를 돌려주는 구현 — 매 요청 ClickHouse 집계 | 반복 조회 흡수 |
| SW-04 CACHE_KEY_TIME_SNAP | TSQ-03 | now()를 그대로 키에 넣는다 | 키 파편화 — 히트율이 0으로 수렴 |
| SW-05 CACHE_STAMPEDE_LOCK | TSQ-05 | 미스 시 동시 요청 전원이 ClickHouse를 부른다 | 동시 요청 수 대비 ClickHouse 쿼리 실행 횟수 |

- 채번 · 포트 · 원본 예상치의 정본은 [13_switch_matrix.md](./13_switch_matrix.md)다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| TSQ-01 | 최신 1행 점조회를 하지 않는다 — ClickHouse는 점조회에 약하다 | RLT-01 · 02 |
| TSQ-01 | 쓰기를 하지 않는다 · 롤업을 만들지 않는다 | ING-03 · ING-12 |
| TSQ-02 | 사용자가 고른 원시 해상도를 긴 범위에 허용하지 않는다 | TSQ-09(내보내기로 유도) |
| TSQ-04 | 과거 구간 캐시를 무효화하지 않는다 — 과거는 불변이라 TTL 만료만 쓴다 | 해당 없음 |
| TSQ-04 | 태그 메타 캐시를 다루지 않는다 | MST-07 |
| TSQ-07 | 태그명 원천을 소유하지 않는다 | MST-09 |
| TSQ-09 | 해상도를 줄이지 않는다 · 캐시하지 않는다 | 해당 없음 — 원시 그대로가 목적이다 |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| ING | ING → TSQ | 저장소 경유 | tag_raw · 롤업 테이블 |
| MST | MST → TSQ | 저장소 경유 | dict_tag |
| RLT | TSQ → RLT | 저장소 경유 | 진행 구간 분할(TSQ-08)의 마지막 버킷이 rt:latest를 읽는다 |
| AUT | AUT → TSQ | 인가 | S7 이후 Guard · 레이트 리밋 |
| ALM | TSQ → ALM | 표면 공유 | 알람 분석 화면의 min · max 쌍(ALM-09) |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 태그 배열이 상한 초과 | 거절 — "고친다"가 아니라 "나눠서 여러 번 요청한다" | timeseries.too_many_tags/400 | TSQ-01 |
| 해상도 · 집계 함수가 허용값 밖 · 시각 형식 위반 | 거절 | common.validation_failed/400 | TSQ-01 |
| 결과 포인트가 최대치 초과 | 코드 없음 — 해상도 상향 · LTTB | meta.interval · meta.downsampled | TSQ-02 · 06 |
| Redis 캐시 실패 | 코드 없음 — **200이고 느려질 뿐이다**(degrade) | 캐시 히트율 · API 지연 | TSQ-04 |
| 락 획득 실패 | 코드 없음 — 대기 후 재조회 | 락 대기 메트릭 | TSQ-05 |
| ClickHouse 접속 불가 | **timeseries.clickhouse_unavailable/503** — 캐시 미스만 거절 · 캐시 히트는 200 · 대조군이나 최신값으로 우회하지 않는다 | [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) REQ-TSQ-16 | TSQ-01 · 09 |
| 분당 한도 초과(S7 이후) | 다음 창까지 대기 | common.rate_limited/429 | TSQ-01 · 09 |
| PostgreSQL 중단 | **영향 없음** — Dictionary가 마지막 적재 값을 유지한다 | 없음 | TSQ-07 |

- **A형 — "원시로 요청했는데 1m이 왔다"는 버그가 아니다.** 통념은 요청한 해상도가 그대로 온다는 것이지만, 서버는 범위와 최대 포인트 수로 해상도를 강제한다. 진짜 축은 ClickHouse 보호이며, 원시가 꼭 필요하면 대체 경로는 TSQ-09 내보내기다. 실제 해상도는 meta.interval이 말한다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.5 TTL 강제 수단 | cache:q · lock:rebuild 쓰기는 TTL 필수 래퍼로만 하고, 캐시 계열 호출은 짧은 타임아웃 + 예외 무시로 degrade한다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 스위치 구현 제약 — 원본 implementation_plan.md §4.3 | TSQ-04의 on/off가 원본이 예시로 든 포트(조회 캐시 포트 하나에 Redis 구현 · 항상 미스 구현)다. 조회 경로 안에 if를 흩뿌리지 않는다 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) · [13_switch_matrix.md](./13_switch_matrix.md) |
| 보정 7.1~7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| ClickHouse 불가 시 조회 응답 | ClickHouse 중단 시 적재가 XACK를 보류한다는 것뿐이다 | **W2 판정 완료** — clickhouse_unavailable/503 | [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) |
| 해상도별 응답 시간 · 히트율 | 원본 예상치(원본 data_flow.md §6.1 · 원본 architecture.md §16) | 미확인 — 확정 전 임의 값 고정 금지 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| p95 집계의 롤업 대조 | TDigest는 근사다 — 부동소수 허용 오차로 대조하지 않는다(W1) | 대조 기준 미정 | [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md)(W2) |
| 내보내기의 레이트 리밋 한도 · 범위 상한 | "엄격히"만 있다(원본 architecture.md §18) | **W7 닫힘** — 범위 상한 현행 참고 1일 · class export · 한도 값 2계층 미정(관계식 고정) | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |

## 관련 문서

- [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) — REQ-TSQ 동작 계약
- [../07_api/05_timeseries.md](../07_api/05_timeseries.md) — query · export 표면
- [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) — F-04 · 캐시 기전
- [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) — 롤업과 -Merge 조합자
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 캐시 키 시간 스냅 · 버킷 경계
- [13_switch_matrix.md](./13_switch_matrix.md) — SW-03 · SW-04 · SW-05 정본
