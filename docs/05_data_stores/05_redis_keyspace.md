# Redis 키 공간 (05_redis_keyspace)

> **대상**: Redis 단일 인스턴스의 영역 접두 9 · 키 패턴 전수 · 값 모양 · TTL 조회 계약 · 네이밍 · 계열별 실패 전략 · Pub/Sub 채널 3 · **봉인 표** · 키 계열별 래퍼 강제(ADR-13) · 키 인계 판정 — Redis 키 패턴 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W4 판정 반영 — rt:latest 조건부 쓰기(새 ts ≥ 저장 ts) · DurableKeyClient 조건부 쓰기 스크립트 노출 · ch:rt 발행자 ING → **SW-11 쓰기 주체** · DLQ 값에 원 배치 토큰 · 재처리 그룹 grp:dlq · alarm:state 쓰기 주체 판정기 단독 · 체인 번호 6단 표기 · 미확인 4행 W4 판정 — 키 패턴 · 봉인 칸 수 불변
> **원천**: 원본 architecture.md §5 · §8 · §8.1 · §8.2 · §8.3 · §10.1 · §10.3 · §11 · §11.2 · §17 · §18(커밋 ff66a37) · 원본 tech_stack.md §5.3(커밋 ff66a37) · 원본 data_flow.md §3 · §4 · §5 · §6 · §6.2 · §7 · §7.1 · §8 · §12.2(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §7.4 · §7.5(커밋 ff66a37) · docs_plan.md 이식 패턴 ② 봉인 표 · 보정 #5 · 웨이브 인계 W3 05_data_stores/05 행 전부 · ADR-05 · ADR-10 · ADR-12 · ADR-13 · [../README.md](../README.md) 고정 기준 Redis 영역 접두

Redis는 **단일 인스턴스 · volatile-lru**다(ADR-05). 인스턴스를 스트림용과 캐시용으로 나누지 않는 대신 **TTL 유무로 축출 대상을 가른다** — TTL이 없는 키는 volatile-lru의 후보가 되지 않고, TTL이 있는 키만 메모리 압박에 밀려난다. 그래서 이 인스턴스에서는 **키 접두 하나가 곧 데이터 생존 정책의 경계**다(전역 불변식 TTL 우선순위).

이 문서가 채번하는 것은 **키 패턴**이다. 메모리 산정 · MAXLEN · 축출 연쇄는 [06_redis_memory.md](./06_redis_memory.md)가, 캐시 무효화 체인의 순서는 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)가, 스탬피드 · TTL 구간 분류의 기전은 [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)가 갖는다.

**정책의 부재를 통제로 센다.** "stream 계열에 TTL을 붙이지 않는다"가 규약 문장 하나로 떠 있으면 새 코드가 조용히 어긴다. 이 문서는 TTL이 없는 것 · 축출되지 않는 것 · 특정 명령이 노출되지 않는 것을 §봉인 표의 칸으로 세고 검산한다. 칸은 문서가 아니라 **키 계열별 래퍼**가 강제한다(ADR-13 · 보정 7.5).

## 영역 접두

| 접두 | 뜻 | 계열 | TTL | volatile-lru에서의 운명 | 래퍼 | 활성 키 패턴 |
|------|------|------|------|------|------|:------:|
| stream | 수집 버퍼 · DLQ | 봉인 | **금지** | 축출되지 않는다 | DurableKeyClient | 2 |
| rt | realtime — 태그 최신값 | 봉인 | **금지** | 상동 | DurableKeyClient | 1 |
| alarm | 알람 판정 핫 상태 | 봉인 | **금지** | 상동 | DurableKeyClient | 1 |
| cache | 조회 · 마스터 · 목록 사본 | 캐시 | **필수** | 압박 시 LRU로 밀려난다 | CacheKeyClient | 7 |
| lock | 단일 실행 락 | 캐시 | **필수** | 상동 | CacheKeyClient | 2 |
| rl | 레이트 리밋 계수 | 캐시 | **필수** | 상동 | CacheKeyClient | 1 |
| sess | 세션 | 캐시 | **필수** | 상동 | CacheKeyClient | **0 — 예약** |
| auth | 리프레시 토큰 | 캐시 | **필수** | 상동 | CacheKeyClient | 1 |
| ch | Pub/Sub 채널 | 채널 | 해당 없음 — 키가 아니다 | 메모리에 남지 않는다 | FanoutPublisher | 3 |

- 검산: 영역 접두 = 봉인 3(stream · rt · alarm) + 캐시 5(cache · lock · rl · sess · auth) + 채널 1(ch) = **9** — 루트 고정 기준과 같다
- 검산: 활성 키 패턴 = 봉인 2 + 1 + 1 = 4 · 캐시 7 + 2 + 1 + 0 + 1 = 11 · 채널 3 → 4 + 11 + 3 = **18**. 세는 자리는 이 표 하나이며 아래 표들은 이 수를 다시 세지 않는다
- **sess는 활성 키 패턴 없이 접두만 예약한다(판정 §인계 판정).** 접두를 지우면 루트 고정 기준의 9가 바뀐다 — 접두 수 변경은 리드 제안으로 올린다.

## 봉인 계열 키

TTL을 붙이지 않는다. 사라지면 복구할 수 없거나(stream · alarm) 원천을 과부하시키는 복원이 필요한(rt) 데이터다.

| 키 패턴 | 자료구조 | 값 · 필드 | 크기 제어 | 쓰는 주체 | 읽는 주체 |
|------|------|------|------|------|------|
| stream:plc:raw | Stream · 컨슈머 그룹 grp:ingest | 엔트리 1 = 스캔 사이클 1 — MessagePack 컬럼 배열(v · d · s · t0 · tg · dt · va · q) | XADD MAXLEN ~ (근사 트리밍) | COL · GEN 모드 B · C | ING(XREADGROUP · XACK · XAUTOCLAIM) |
| stream:plc:dlq | Stream | 엔트리 1 = **실패한 원 엔트리 1** + 원 엔트리 ID + 오류 사유 + **원 배치 토큰**(재시도 소진 사유만 · W4) | XADD MAXLEN ~ | ING(재시도 소진 · 해독 불가) | 사람의 DLQ 재처리 절차 — 재처리 전용 컨슈머 그룹 **grp:dlq**(W4 · [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) §DLQ 재처리) |
| rt:latest:{device_id} | Hash | 필드 tag_id · 값 "ts,value,quality"(ts는 epoch ms 10진) | 태그 수만큼 · **필드 조건부 쓰기(새 ts ≥ 저장 ts · W4)** | SW-11 쓰기 주체(ingest 기본 · collector) — LatestValueWritePort(ADR-10 잠정 · S6 최종) · RLT-04 워밍 · 기동 복원 | RLT · TSQ-08 진행 구간 |
| alarm:state:{rule_id} | Hash | state · first_breach_ts · breach_count · event_id · **first_clear_ts · last_value · last_ts** | 규칙 수만큼 | ALM-03 판정기 하나 — **확인 표면은 쓰지 않는다**(W4 · state 값 NORMAL · PENDING · ACTIVE · CLEARING) | ALM-03 |

- **DLQ 엔트리를 원 엔트리 단위로 둔다(판정).** 원본은 "실패 배치 + 오류 사유"(원본 architecture.md §8.1)라 배치 통째(최대 수만 행)가 엔트리 하나가 될 수 있었다 — 그러면 DLQ MAXLEN이 엔트리 수로는 작아도 메모리로는 Stream 본체를 넘는다. 원 엔트리 단위면 크기가 본 Stream 엔트리와 같아 메모리 산정([06_redis_memory.md](./06_redis_memory.md))이 닫히고, 재처리가 원 엔트리 ID로 추적된다.
- **alarm:state 필드 7 중 셋을 신설한다.** 원본 필드(상태 · 연속 위반 횟수 · 최초 위반 시각) + event_id(원본 data_flow.md §8)만으로는 ① CLEARING 디바운스의 경과를 잴 시작 시각이 없고 ② RATE_OF_CHANGE의 직전 값이 없다([01_postgresql_schema.md](./01_postgresql_schema.md) §enum 값 확정). 시각 필드는 전부 **epoch ms 정수**다 — 문자열 날짜면 디바운스 계산이 매번 파싱을 거치고 시간대 없는 문자열이 9시간 어긋난 디바운스를 만든다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)의 판정을 여기서 확정).
- 검산: alarm:state 필드 = 원본 3 + event_id 1 + 신설 3 = **7**
- 컨슈머 그룹 grp:ingest와 PEL은 stream:plc:raw 키의 일부라 따로 세지 않는다. 미확인 엔트리가 PEL에 남아 있는 한 MAXLEN 트리밍이 그 엔트리를 잘라도 PEL 항목은 남는다 — 이 경우가 결함 계수 stream_trimmed_unacked다([06_redis_memory.md](./06_redis_memory.md)).

## 캐시 계열 키

TTL 없이 만들지 않는다. 사라져도 원천(PostgreSQL · ClickHouse)에서 다시 채울 수 있는 사본 · 계수 · 락이다 — auth만 예외로 원천이 없다(§실패 전략).

| 키 패턴 | 자료구조 | 값 | 무효화 | 쓰는 · 읽는 기능 | 비고 |
|------|------|------|------|------|------|
| cache:q:{sha1} | String | gzip 압축 JSON 조회 결과 | **TTL만** — 과거 구간은 불변 | TSQ-03 · 04 | 키 = 정규화 쿼리의 SHA-1 40자 |
| cache:tagmeta:{tag_id} | Hash | 태그 메타 사본(device_id · tag_code · tag_name · unit · 매핑 · 범위 · is_active) | 태그 쓰기 커밋 뒤 DEL | MST-07 · COL-01 · RLT-02 · 03 | **태그별 키 판정** §인계 판정 |
| cache:devlist:{site_id} | String | 설비 목록 JSON | 설비 쓰기 커밋 뒤 DEL | MST-02 | |
| cache:alarmrules | String | 활성 규칙 전체 JSON | 규칙 쓰기 커밋 뒤 DEL | ALM-01 · 02 | |
| **cache:perm:{user_id}** | String | 역할 집합 JSON | 역할 변경 커밋 뒤 DEL | AUT-05 | **신설 이름** — 원본은 TTL만 있었다 |
| **cache:alarmevents** | Hash | 필드 = 정규화 목록 쿼리 SHA-1 · 값 = gzip JSON | 확인 커밋 뒤 **키 하나 DEL** | ALM-07 · 08 | **신설** — 첫 채움 기준 만료(EXPIRE NX) |
| **cache:workorders** | Hash | 상동(작업지시 · 실적 조회) | 작업지시 · 실적 쓰기 커밋 뒤 키 하나 DEL | WRK-01 · 03 | **신설** — 상동 |
| **lock:rebuild:q:{sha1}** | String | 소유자 토큰(UUID) · SET NX PX | 소유자 검증 Lua로 해제 | TSQ-05 | 조회 캐시 재구성 락 |
| **lock:rebuild:rt:{device_id}** | String | 상동 | 상동 | RLT-04 | 최신값 빈 키 복원 락 |
| **rl:{class}:{user_id}:{unix_minute}** | String | INCR 계수 | 분 창 만료 | AUT-06 | class = 한도 등급 |
| auth:refresh:{refresh_token_id} | String | user_id | 로그아웃 시 DEL | AUT-01~03 | rt: 접두 금지(원본 개명) |

- **목록 캐시를 Hash 하나에 모으는 이유** — 목록 조회는 범위 · 필터 조합마다 결과가 달라 키가 여럿 생기는데, 쓰기 한 건이 그 전부를 무효화해야 한다. 키를 흩으면 무효화에 패턴 검색(KEYS)이 필요하고 KEYS는 금지다. Hash 하나면 DEL 한 번이 조합 전부를 지운다. 만료는 EXPIRE NX로 **첫 채움 시점 기준**이라 어떤 조합도 TTL보다 오래 낡지 않는다.
- **lock:rebuild를 두 하위 공간으로 가른다.** 원본은 조회 캐시 락(쿼리 해시)과 최신값 복원 락(설비)을 같은 lock:rebuild:{…}에 두었다 — 식별자 공간이 겹치면 우연히 같은 문자열을 가진 두 락이 서로를 막는다(REQ-RLT-05 · REQ-TSQ-12).
- auth:refresh는 캐시 계열이지만 원천 DB가 없다. 축출되면 해당 사용자는 재로그인이다 — 수집 적체가 로그아웃으로 번지는 경로이며 그 차단이 MAXLEN 산정의 이유다([06_redis_memory.md](./06_redis_memory.md) · [../02_features/01_auth.md](../02_features/01_auth.md)).

## Pub/Sub 채널

| 채널 | 발행자 | 구독자 | 페이로드 | SW-06 대상 |
|------|------|------|------|:------:|
| ch:rt:{device_id} | **SW-11 최신값 쓰기 주체**(ingest 기본 · collector) — 조건부 쓰기가 받아들인 필드만(W4) | WebSocket 게이트웨이 | 변경된 태그 값 배열 | 대상 |
| ch:alarm | ALM(PostgreSQL 커밋 뒤 · REQ-ALM-10) | WebSocket 게이트웨이 | 알람 열림 · 닫힘 이벤트 | 대상 |
| ch:cacheinv | api 마스터 쓰기(커밋 뒤 · modbus_config만 바꾼 쓰기도 cache:devlist 키 이름으로 — W4) | 다른 api 인스턴스 · RLT-09 브라우저 중계 · **Collector 마스터 재로드(W4)** | 무효화된 키 이름 | **대상 아님** |

- 검산: 채널 = **3** · SW-06 대상 2(ch:rt · ch:alarm) + 비대상 1(ch:cacheinv)
- **ch:cacheinv가 SW-06 밖인 이유** — 끄면 무효화 체인 ③ · ⑥단(6단 번호 — [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md))이 스위치 상태에 따라 달라져 정합성 계약에 스위치가 생긴다(판정 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)).
- **채널은 키가 아니다.** 발행된 메시지는 구독자가 없으면 버려지고 메모리에 남지 않는다 — 봉인 표의 대상이 아니며, 누락은 재연결 뒤 최신값 재조회로 메운다([../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)).
- 단일 프로세스인데도 Pub/Sub을 거치는 것은 루프백 1홉으로 역할 분리 · 수평 확장 때의 팬아웃 재작성을 면제받는 값이다(ADR-07).

## TTL 조회 계약

TTL은 2계층 조정값이다. 본문에 값을 박지 않고 **키 모양 · 기준 시점 · 금지된 대체 동작 · 부재 시 동작**으로 쓰며, 현행 값은 소유처를 밝혀 참고로 적는다. **소유처가 이 문서인 행의 값 정본은 이 표다.**

| 키 패턴 | 기준 시점 | 지터 | 금지된 대체 동작 | 부재 시(래퍼 인자 누락) | 현행 참고 · 소유처 |
|------|------|:------:|------|------|------|
| cache:q:{sha1} | 캐시 쓰기 시 · to와 api 서버 시계의 현재 버킷 비교 | ±20% | 구간 구분 없는 단일 TTL · 과거 구간 명시 무효화 | 컴파일 실패 | 완전 과거 300초 · 현재 버킷 30초 · 최근 5분 미캐시 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| cache:tagmeta:{tag_id} | 캐시 쓰기 시 | ±20% | 쓰기 뒤 DEL 생략 · 새 값 덮어쓰기 | 컴파일 실패 | 600초 · 이 문서 |
| cache:devlist:{site_id} | 캐시 쓰기 시 | ±20% | 상동 | 컴파일 실패 | 600초 · 이 문서 |
| cache:alarmrules | 캐시 쓰기 시 | ±20% | 규칙 변경 시 DEL 생략 | 컴파일 실패 | 300초 · 이 문서 |
| cache:perm:{user_id} | 캐시 쓰기 시 | ±20% | 역할 변경 시 DEL 생략 | 컴파일 실패 | 300초 · 이 문서 |
| cache:alarmevents | **첫 필드 채움 시 1회(EXPIRE NX)** | 없음 | 필드마다 만료 갱신 — 인기 조합이 영원히 안 낡는다 | 컴파일 실패 | 30초 · 이 문서 |
| cache:workorders | 상동 | 없음 | 상동 | 컴파일 실패 | 60초 · 이 문서 |
| lock:rebuild:q:{sha1} | 락 획득 시(PX) | 없음 | 만료 없는 락 · 소유자 검증 없는 DEL | 컴파일 실패 | 5000 ms · 대기 50 ms × 3회 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| lock:rebuild:rt:{device_id} | 락 획득 시(PX) | 없음 | 상동 | 컴파일 실패 | **복원 쿼리 타임아웃 이상** — 값 미정 · 이 문서(§미확인) |
| rl:{class}:{user_id}:{unix_minute} | 창의 첫 INCR 시 | 없음 | TTL 없는 계수 · IP 기준 계수 | 컴파일 실패 | 90초(1분 창 + 여유) · 한도 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| auth:refresh:{refresh_token_id} | 발급 시 | 없음 | TTL 없는 토큰 · rt: 접두 | 컴파일 실패 | 14일 · [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) |

- 검산: TTL 계약 행 = 캐시 계열 활성 키 패턴 전부(§영역 접두 표) — 누락 0
- **지터는 cache 접두의 단건 키에만 래퍼가 자동으로 건다(판정).** 원본은 "TTL에 ±20% 무작위 가산"을 모든 TTL 키에 걸었다(원본 architecture.md §8.3). 락에 지터가 붙으면 만료가 소유자 작업보다 먼저 와 스탬피드가 다시 열리고, rl에 붙으면 분 창 계수가 창 밖으로 새며, auth에 붙으면 토큰 수명이 사용자마다 달라진다.
- **"부재 시 = 컴파일 실패"가 ADR-13의 뜻이다.** TTL은 CacheKeyClient 쓰기 메서드의 필수 인자라 빠뜨린 호출은 빌드되지 않는다 — 런타임 기동 거부보다 한 단계 앞에서 막는다.

## 네이밍 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 계층 | 영역:용도:식별자 — 콜론 계층 · 앞이 넓은 범주. 하위 공간이 필요하면 용도 뒤에 한 단 더(lock:rebuild:q:{…}) | 접두 기준 모니터링(히트율 · 키 수)이 섞인다 |
| 접두 = 생존 정책 | 새 용도가 기존 접두의 TTL 정책과 다르면 **접두를 빌리지 않는다** | rt:{refresh_token_id}처럼 TTL 금지 접두 아래 TTL 키가 생겨 어느 래퍼 규칙도 맞지 않는다(원본 개명 사례) |
| 접두 채번 | 영역 접두는 이 문서에서만 늘린다 · 봉인인지 캐시인지 먼저 정한다 | 정책 미정 키가 기본 래퍼로 들어가 생존 정책이 우연으로 정해진다 |
| 식별자 | 정수 id · SHA-1 16진 40자 · epoch 정수(unix_minute)만. 문자열 날짜 금지 | 시간대 없는 날짜 문자열이 키를 두 개로 가른다 |
| 스캔 | KEYS 금지 — 필요하면 SCAN + COUNT(운영 도구만) | 단일 스레드 Redis가 키 공간 전체를 훑는 동안 모든 명령이 멈춘다 |
| 쓰기 주체 | 키 패턴 하나에 쓰는 모듈 하나(rt:latest의 워밍 · SW-11 collector만 예외 · 같은 봉인 래퍼 · 조건부 쓰기로 순서 역전 차단) | 두 모듈이 다른 값 형식으로 같은 키를 덮어쓴다 |
| 값 인코딩 | 시각은 epoch ms 정수 · 숫자는 10진 문자열 · 구조는 JSON(대형은 gzip) | 파서가 둘이 된다 |

- 검산: 규칙 = **7**

## 실패 전략

**같은 인스턴스 안에서 키 계열에 따라 실패 전략이 정반대다**(전역 불변식 실패 전략 이원화). 인스턴스를 나누지 않았으므로 인프라가 지켜 주던 이 구분을 래퍼가 지킨다.

| 계열 · 키 | 호출이 실패하면 | 시간 제한 | 드러나는 형태 | 근거 |
|------|------|------|------|------|
| stream:plc:raw 쓰기 | **명시적 실패** → Collector 스풀 전환 · bulk 주입은 datagen.stream_full/503 | 없음 — 실패를 삼키지 않는다 | spool_active · 백프레셔 위험 단계 | 원본 architecture.md §17 |
| stream:plc:raw 읽기 | XREADGROUP 실패 → Ingest 대기 · 재시도 | 없음 | consumer_lag | 원본 data_flow.md §12.2 |
| rt:latest 읽기 | **503** — ClickHouse 점조회로 대체하지 않는다 | 없음 | 최신값 API 503 | 원본 data_flow.md §5 — 키만 빈 경우의 복원과 다르다 |
| alarm:state | 판정 중단 — 명시적 실패 | 없음 | 판정 지연 | REQ-ALM-07 |
| cache:* | 짧은 타임아웃 뒤 **조용히 degrade** — 원천 직접 조회 | 현행 50 ms · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) | 캐시 히트율 · 지연 상승 | 원본 architecture.md §17 degrade 원칙 |
| lock:rebuild:* | 락 없이 원천 조회 — 스탬피드를 감수한다 | 상동 | 원천 동시 쿼리 수 | 캐시 실패가 요청 실패가 되지 않게 |
| rl:* | **통과** — 계수 없이 요청을 받는다 | 상동 | 레이트 리밋 통과 계수 | W2b 판정 [../03_requirements/02_auth.md](../03_requirements/02_auth.md) |
| auth:refresh | **거절** — 우회할 원천이 없다 | 상동 | auth.token_store_unavailable/503(로그인 · 갱신 · 로그아웃) | REQ-AUT-14 |
| ch:* 발행 | 무시하고 계수 — 푸시 누락은 재연결 재조회가 메운다 | 상동 | 발행 실패 계수 | Pub/Sub은 영속하지 않는다 |

- 검산: 행 = **9** · 명시적 실패 3(stream 쓰기 · rt 읽기 · alarm) + 대기 1(stream 읽기) + degrade · 통과 · 무시 4(cache · lock · rl · ch) + 거절 1(auth) = **9**
- **auth:refresh는 캐시 계열의 예외 행이다(B형).** 결론 — Redis가 멈추면 로그인 · 토큰 갱신이 거절된다. 반대 시나리오 — degrade(원천 조회)로 두려면 원천이 있어야 하는데 리프레시 토큰의 원천은 Redis뿐이다. 통과시키면 폐기한 토큰이 유효해진다. 파생 지침 — TTL 정책(캐시 계열)과 실패 전략(거절)은 별개 축이며, 래퍼는 degrade 신호를 돌려주고 판단은 AUT가 한다.

## 봉인 표

이식 패턴 ②의 정본 표다. **정책의 부재 자체를 통제로 센다** — 칸 하나가 "이 키에 이것이 없다"는 사실이며, 그 부재를 강제하는 주체가 칸 안에 있다.

| 키 패턴 | ① TTL 없음 | ② 축출 안 됨 | ③ TTL 명령 비노출 | 봉인 칸 |
|------|------|------|------|:------:|
| stream:plc:raw | ✔ DurableKeyClient가 TTL 인자를 받지 않는다 | ✔ volatile-lru는 TTL 없는 키를 후보로 넣지 않는다 | ✔ EXPIRE · PEXPIRE · EXPIREAT · SETEX · SET EX/PX · HEXPIRE 계열 미노출 | 3 |
| stream:plc:dlq | ✔ 상동 | ✔ 상동 | ✔ 상동 | 3 |
| rt:latest:{device_id} | ✔ 상동 · 워밍 쓰기도 같은 래퍼(REQ-RLT-05) | ✔ 상동 | ✔ 상동 — **필드 TTL(HEXPIRE)도 막는다** | 3 |
| alarm:state:{rule_id} | ✔ 상동 | ✔ 상동 | ✔ 상동 | 3 |

- **②는 ①과 정책 하나에 기대는 칸이다.** maxmemory-policy가 allkeys-lru로 바뀌면 ①이 그대로여도 ②가 전부 무너진다 — 정책 값의 정본은 [06_redis_memory.md](./06_redis_memory.md)이며 정책 변경은 이 표 전체의 재검산 사유다.
- **③에 필드 TTL을 넣은 이유** — Redis 8은 Hash 필드 단위 만료를 지원한다. 키에 TTL이 없어도 rt:latest의 필드가 만료되면 최신값이 조용히 사라지는 같은 실패가 생긴다.

캐시 계열은 반대 방향의 부재를 센다 — **TTL 없이 존재할 수 없다.**

| 키 패턴 | ④ TTL 없는 생성 · PERSIST 비노출 |
|------|------|
| cache:q:{sha1} · cache:tagmeta:{tag_id} · cache:devlist:{site_id} · cache:alarmrules · cache:perm:{user_id} · cache:alarmevents · cache:workorders | ✔ 각 1칸 — 7 |
| lock:rebuild:q:{sha1} · lock:rebuild:rt:{device_id} | ✔ 각 1칸 — 2 |
| rl:{class}:{user_id}:{unix_minute} | ✔ 1 |
| auth:refresh:{refresh_token_id} | ✔ 1 |

- **PERSIST를 막는 이유** — PERSIST는 TTL을 지워 캐시 키를 영구 · 비축출 키로 바꾼다. 봉인 계열이 아닌데 봉인처럼 남는 키가 메모리 예산 밖에서 쌓인다.

| 래퍼 | ⑤ KEYS · FLUSHDB · FLUSHALL 비노출 |
|------|------|
| DurableKeyClient · CacheKeyClient · FanoutPublisher | ✔ 각 1칸 — 3 |

### 검산

- 봉인 칸(①~③) = 봉인 키 패턴 4 × 3 = **12**
- 역봉인 칸(④) = 7 + 2 + 1 + 1 = **11** = 캐시 계열 활성 키 패턴 수(§영역 접두 표)와 같아야 한다
- 전역 비노출 칸(⑤) = 래퍼 **3**
- 통제 칸 합계 = 12 + 11 + 3 = **26**
- **새 키 패턴을 들이면 이 절의 칸과 §영역 접두 표의 활성 수를 같은 변경 단위에서 고친다.** 봉인이면 ①~③ 3칸, 캐시면 ④ 1칸이 는다 — 늘지 않으면 계열이 정해지지 않은 키다.

## 키 계열별 래퍼 강제

ADR-13(보정 7.5)의 계약이다. 인터페이스 이름과 책임만 적는다 — 구현은 apps/api/src/common/redis/ 아래이며 코드는 이 문서의 범위가 아니다.

| 래퍼 | 접두 | 노출하는 것 | 노출하지 않는 것 | 실패 처리 |
|------|------|------|------|------|
| DurableKeyClient | stream · rt · alarm | XADD(MAXLEN 필수 인자) · XREADGROUP · XACK · XAUTOCLAIM · XLEN · XPENDING · XINFO GROUPS(적체 판정량) · HSET · HGET · HGETALL · **rt:latest 필드 조건부 쓰기 스크립트(W4)** · 파이프라인 | 모든 TTL 명령(키 · 필드) · KEYS · FLUSH 계열 | 예외를 그대로 던진다 — 백프레셔 발동 |
| CacheKeyClient | cache · lock · rl · sess · auth | TTL 필수 쓰기(SET · HSET + EXPIRE NX · INCR + 창 만료) · GET · HGET · DEL · 소유자 검증 락 해제 | TTL 없는 쓰기 · PERSIST · KEYS · FLUSH 계열 | 짧은 타임아웃 · 예외를 삼키고 미스(degrade) 신호를 돌려준다 |
| FanoutPublisher | ch | PUBLISH · SUBSCRIBE | 키 명령 전부 | 발행 실패를 계수하고 삼킨다 |

- 검산: 래퍼 = **3** · 접두 배정 3 + 5 + 1 = 9 — 모든 접두가 정확히 한 래퍼에 속한다
- **린트가 아니라 타입이 막는다.** 원본은 "린트 규칙으로 강제"라 적었으나(원본 architecture.md §8.3) 린터는 "cache: 키 SET에 TTL 인자가 있는가"를 검사할 수 없다(원본 implementation_plan.md §7.5). 접두가 래퍼를 고르고 래퍼의 메서드 시그니처가 TTL 유무를 고정한다.
- **래퍼는 접두를 스스로 붙인다.** 호출자가 접두 문자열을 쓰면 봉인 접두를 캐시 래퍼로 쓰는 실수가 타입을 통과한다 — 래퍼 메서드는 용도 이름과 식별자만 받는다.

새 키 계열을 들일 때의 판정 순서다.

```plain
새 키 패턴
├─ 사라지면 복구 불가 또는 원천 과부하?
│  ├─ 예 → 봉인 계열(stream · rt · alarm)      DurableKeyClient · 봉인 표 3칸 · 메모리 예산 06에 행 추가
│  └─ 아니오 ↓
├─ 원천에서 다시 채울 수 있는 사본 · 계수 · 락?
│  ├─ 예 → 캐시 계열(cache · lock · rl · auth)  CacheKeyClient · TTL 계약 행 · 역봉인 1칸
│  └─ 아니오 → 키로 만들지 않는다               목적지 미정 데이터(04_storage_split 먼저)
└─ 기존 접두의 정책과 다른가? → 접두를 빌리지 않고 이 문서에서 새 접두를 채번한다
```

- **두 질문의 순서가 중요하다.** "원천이 있는가"를 먼저 물으면 auth:refresh처럼 원천이 없는 캐시 계열을 봉인으로 오판한다 — 생존 정책(축출 허용 여부)이 먼저, 실패 전략이 나중이다.
- **목적지가 정해지지 않은 데이터는 키가 되지 않는다.** 새 데이터 종류는 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)의 분기 표에 먼저 올라야 한다(고유 규칙).

## 인계 판정

웨이브 인계 W3 05_data_stores/05 행 전부와 이 문서가 새로 찾은 항목이다.

| # | 인계 항목 | 판정 | 버린 대안의 실패 |
|:-:|------|------|------|
| 1 | cache:tagmeta 단일 Hash(원본 data_flow.md §3 · §5) vs 태그별 키(원본 architecture.md §8.2) | **태그별 키 cache:tagmeta:{tag_id}.** 무효화 단위 = 쓰기 단위(태그 하나 · 원본 data_flow.md §7도 DEL cache:tagmeta:3401) · 축출 단위 = 태그 하나. 설비 단위 조회는 파이프라인 다건 HGETALL 1왕복 | 단일 Hash — 태그 하나를 고쳐도 전체를 DEL해 모든 Collector · 최신값 조회가 동시에 미스를 내고 PostgreSQL로 몰린다. 축출도 통째라 메모리 압박 한 번에 메타 전체가 사라진다 |
| 2 | sess:{session_id} 소비 기능 없음 | **키 패턴 폐지 · sess 접두는 예약으로 유지.** 인증은 JWT + auth:refresh로 닫혔다 | 유지 — 쓰는 기능이 없는 TTL 키 규칙이 구현에 "세션 저장소가 있다"는 오해를 준다 |
| 3 | lock:job:rollup 소비자 없음(롤업은 MV) | **폐지.** 재도입 조건 = 체이닝 깊이 3을 넘는 롤업을 배치 잡으로 옮길 때([04_clickhouse_rollup.md](./04_clickhouse_rollup.md)) | 유지 — 백필 · 재계산이 이 락을 "단일 실행 보장"으로 빌려 쓰며 뜻이 흐려진다 |
| 4 | rl 키에 엔드포인트 자리 없음(원본 architecture.md §18 "엔드포인트별") | **rl:{class}:{user_id}:{unix_minute}** — class는 한도 등급(기본 · 조회 · 내보내기 후보). class 값 집합과 한도는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 엔드포인트 경로를 키에 — 경로 파라미터마다 키가 생겨 한도가 식별자 단위로 쪼개진다 |
| 5 | lock:rebuild 식별자 공간 충돌(쿼리 해시 vs 설비) | **lock:rebuild:q:{sha1} · lock:rebuild:rt:{device_id}** 두 하위 공간 | 같은 공간 — 두 종류의 락이 이름으로 구분되지 않아 만료 값도 하나로 묶인다 |
| 6 | 작업지시 BFF 캐시 키 | **Redis는 cache:workorders(Hash · 키 하나 DEL). BFF 서버 fetch 캐시는 두지 않는다(no-store)** — ③계층의 read-your-writes가 BFF 캐시로 깨지지 않게 | BFF 캐시 유지 — 쓰기 응답 직후 목록이 최대 revalidate 창만큼 옛 값이다. 막으려면 태그 무효화 ④단을 작업지시에도 걸어야 해 체인이 넓어진다 |
| 7 | **rt:seq:{device_id} 소비자 없음(신규)** | **폐지.** 스캔 일련번호는 tag_raw.scan_seq · Stream 필드 s가 갖고, 갱신 확인은 rt:latest의 ts(STALE 판정)가 한다 | 유지 — 봉인 키는 축출되지 않으므로 아무도 읽지 않는 키가 설비 수만큼 영구히 남는다 |
| 8 | **권한 캐시 키 모양(신규 · AUT-05)** | cache:perm:{user_id} | |
| 9 | **알람 이벤트 목록 캐시 키(신규 · ALM-07)** | cache:alarmevents(Hash) | 조합별 흩은 키 — 확인 한 건의 무효화에 KEYS가 필요하다 |
| 10 | alarm:state 최초 위반 시각의 형식(W1 판정 확정 자리) | epoch ms 정수 · 필드 7로 확장 | |

- 검산: 판정 = **10** · 원본 키 폐지 3(#2 · #3 · #7) · 늘어난 키 패턴 4(#5 분할 1 · #6 cache:workorders · #8 cache:perm · #9 cache:alarmevents)
- 원본 키 패턴 수와의 대조 — 원본 17(봉인 §8.1 5 + 캐시 §8.2 9 + 채널 3) − 폐지 3 + 분할 1(lock:rebuild) + 신설 3(cache:perm · cache:alarmevents · cache:workorders) = **18** = §영역 접두 표의 활성 수
- **#1의 대가 — Collector 기동 로드는 PostgreSQL에서 태그 목록을 먼저 읽는다.** 태그별 키는 "이 설비의 태그가 무엇인가"를 열거할 수 없다(KEYS 금지). Collector는 기동 1회에 tag_master를 읽고 cache:tagmeta:{tag_id}를 워밍한다 — 기전 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4)와 정합이 필요하다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| lock:rebuild:rt 만료 값 | 계약만 — 복원 쿼리 타임아웃 이상. 복원 쿼리 시간은 3계층 미확인 | S2 실측 뒤 이 문서 |
| rl class 값 집합 · 등급별 한도 | 키 모양만 확정 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)(W7) |
| DLQ 재처리 경로 · alarm_eval DLQ가 같은 stream:plc:dlq인지 | **W4 판정** — 원 토큰 직접 삽입 절차 · grp:dlq · alarm_eval은 DLQ에 격리하지 않는다 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| ACK가 alarm:state를 바꾸는 주체 | **W4 판정** — 판정기 단독 · 해소 첫 감지 때 acked_at 조회 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| rt:latest 덮어쓰기의 ts 비교 | **W4 판정** — 조건부 쓰기 · 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) #2 갱신 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4) |
| 캐시 호출 타임아웃 값 | 현행 50 ms · 소유 W4 확정 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)(W4) |
| 캐시 히트율 · 키별 메모리 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [06_redis_memory.md](./06_redis_memory.md) · REQ-NFR-10 |

## 관련 문서

- [06_redis_memory.md](./06_redis_memory.md) — maxmemory · MAXLEN · 축출 연쇄
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 한계 등재(rt:latest 순서 역전 · DLQ 트리밍)
- [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) — 조회 캐시 TTL 구간 · 스탬피드 기전
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 기전(ADR-12)
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 캐시 · 팬아웃 스위치
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — REQ-GLB-08 TTL 우선순위
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-05 · ADR-13
