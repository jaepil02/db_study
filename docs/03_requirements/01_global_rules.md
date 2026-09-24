# REQ-GLB — 전역 규칙·불변식

> **대상**: db_study 전 도메인이 전제하는 공통 계약 — 시각 의미론 · 비동기 경계 · 전달 보장 · Redis 키 계열 · 저장소 책임과 분기 · 측정과 계측 · 실행 경계 — REQ-GLB-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — REQ-GLB-05 한계의 DLQ 재처리 경로 미설계 → 06_pipeline/11 §DLQ 재처리
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — **REQ-GLB-24** 신설(쿼리 사용자 입력 파라미터 바인딩 · 문자열 연결 금지) · REQ-GLB 23 → **24** · 불변식 로컬 전용 대응 1 → **2**(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — ClickHouse 서버 시간대 미확인 → **Asia/Seoul**(정본 09_tech_stack/03) · REQ 수 불변
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-GLB-10 1차 신호 스트림 길이 검사 → **미확인 적체 검사**(ADR-21) — REQ 수 불변
> **원천**: 원본 architecture.md §1 · §5 · §7.1 · §8 · §9 · §9.2 · §9.3 · §12 · §17 · §18 · §19(커밋 ff66a37) · 원본 tech_stack.md §1 · §5.3 · §10.4(커밋 ff66a37) · 원본 data_flow.md §2 · §3.2 · §4.2 · §4.3 · §8.2 · §12.1 · §15 · §17(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §4 · §7.3 · §7.5 · §8(커밋 ff66a37) · D-02 · D-04 · D-05 · D-06 · D-10 · [../README.md](../README.md) 전역 불변식 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)

이 문서는 루트 README 전역 불변식 표의 **상세 계약**이다. 불변식 한 행은 요약 문장이고, 여기서는 그 문장을 **검증 가능한 계약 · 위반 시 구체적 실패 · 검증 방법**으로 풀어 REQ-GLB-NN으로 채번한다. 도메인 파일(02~12)은 이 계약을 다시 서술하지 않고 REQ-GLB 번호로 인용한다.

**전역 규칙은 어느 도메인 하나가 지키는 규칙이 아니라 도메인 사이의 경계에서 깨지는 규칙이다.** 그래서 각 행의 관련 기능 열은 한 도메인에 몰리지 않고, 검증 방법은 대부분 두 저장소 · 두 모듈의 값을 대조하는 형태다. 한 모듈의 단위 검사로는 이 문서의 어떤 행도 검증되지 않는다.

**경계 — 수치는 여기에 없다.** 2계층 조정값(TTL · 백오프 · 윈도우 · 임계)은 조회 계약으로만 쓰고 현행 값은 소유처를 밝혀 참고로 적는다. 성능 목표는 [13_nonfunctional.md](./13_nonfunctional.md)가 갖는다. 에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

## 요구사항 — 시각 의미론

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GLB-01** | ts는 측정 시각이고 ingested_at은 적재 시각이다. 파티션 · 정렬 키 · 롤업 버킷 · TTL · 알람 판정 · STALE 판정은 ts로만 하고, E2E 지연은 ingested_at − ts로만 계산한다. ingested_at은 ClickHouse 서버의 DEFAULT가 채우며 적재 코드가 값을 보내지 않는다 | 원본 architecture.md §7.1 · 원본 data_flow.md §15 · 불변식 "시각 의미론" | ingested_at으로 버킷을 자르면 백프레셔로 늦게 들어온 행이 늦은 분에 집계되어 **차트에 가짜 급증**이 생긴다. ts로 지연을 재면 지연이 늘 0이다. 적재 코드가 ingested_at을 채우면 E2E에서 Stream → INSERT 구간이 빠진다 | 백프레셔 재현 중 tag_1m 버킷별 count를 ts 기준 · ingested_at 기준으로 각각 집계해 앞쪽만 평탄한지 조회 · INSERT 문에 ingested_at 컬럼이 없는지 쿼리 로그 조회 | ING-03 · OBS-04 · RLT-03 · ALM-03 | F-01 · F-02 · F-08 | 해당 없음 |
| **REQ-GLB-02** | 시각은 저장소 안에서 epoch 기준으로 저장하고 적재 경로는 시각을 epoch 숫자로 넘긴다. ClickHouse 컬럼의 시간대 인자는 출력 · 파싱 · 달력 함수 경계만 바꾸며 저장값을 바꾸지 않는다. 표시 시간대 Asia/Seoul 변환은 표시 시점에 한 번만 한다. API 요청의 오프셋 없는 ISO 8601은 거절한다 | 원본 architecture.md §12 · 원본 data_flow.md §17 "시간대 정확성" · docs_plan 보정 #16 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) | 적재가 문자열 시각을 보내면 ClickHouse 서버 시간대 설정 하나로 **전 행이 9시간 어긋난다.** 서버 · 브라우저가 각각 변환하면 9시간이 두 번 더해진다. 오프셋 없는 from · to를 받으면 같은 요청이 서버 설정에 따라 다른 구간을 조회한다 | toUnixTimestamp64Milli(ts)와 Stream 엔트리 t0 + dt 대조 · 저장 시각과 화면 표시 시각 대조 · 오프셋 없는 from을 넣은 조회 요청 주입 | COL-02 · ING-03 · TSQ-01 · RLT-03 | F-01 · F-02 · F-04 | common.validation_failed/400 |

- **ClickHouse 서버 시간대는 Asia/Seoul이다(W6 판정 · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)).** 그래도 판정 근거는 서버 설정이 아니라 컬럼 시간대다 — 모든 시각 컬럼이 시간대를 명시한다([../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md)). 서버 설정은 수동 쿼리 · 시스템 테이블 표시에만 영향이 있다.

## 요구사항 — 비동기 경계와 전달 보장

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GLB-03** | 수집과 적재 사이에는 Redis Stream stream:plc:raw를 둔다. 같은 프로세스 안이어도 Collector는 Ingest를 호출하지 않고 ClickHouse에 쓰지 않는다. 모듈 사이의 데이터는 Stream 페이로드 계약 하나로만 오간다 | 원본 architecture.md §1 비동기 경계 삽입 · §4 모듈 경계 규칙 · §9 · 불변식 "비동기 경계" | ① ClickHouse 삽입 지연이 Modbus 폴링 주기로 곧장 역류한다 ② 실패 배치를 다시 읽을 지점이 없어 프로세스가 죽으면 재시도 상태가 함께 사라진다 ③ 폴링 루프와 배치 삽입이 한 호출 스택을 다툰다 ④ APP_ROLE 분리 순간 호출부를 다시 써야 한다 | ClickHouse를 멈춘 채 SW-01 on에서 poll_duration이 scan_rate 안에 머무는지 측정 · Collector 모듈의 의존 그래프에 Ingest · ClickHouse 클라이언트가 없는지 조회 | COL-07 · ING-01 · GEN-06 · GEN-07 | F-01 · F-02 · F-10 | 해당 없음 |
| **REQ-GLB-04** | Stream 경계를 건너는 경로는 둘뿐이다 — ① SW-01 off(실험 전용 · 기본 on · 기동 시 경고를 로그와 /api/v1/health 상태로 노출) ② 확정 배치를 알람 판정에 넘기는 직접 호출(ING-09 — 의도된 유일한 예외). 그 밖의 모듈 간 직접 호출로 경계를 건너지 않는다 | 원본 implementation_plan.md §4.1 · §7.3 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · 예외 근거 정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | SW-01 off가 경고 없이 기동되면 유실이 기본 동작이 된다. 예외를 둘 넘게 허용하면 "같은 프로세스 안이어도 예외가 아니다"가 사례별 판단으로 퇴화해 역할 분리 시 끊기는 호출을 사전에 셀 수 없다 | SW-01 off 기동 로그 · 헬스 응답의 스위치 상태 조회 · 모듈 간 import 그래프에서 경계 횡단 호출 수 집계(기대값 = ING → ALM 1) | ING-09 · COL-07 · OBS-06 | F-01 · F-02 · F-06 | 해당 없음 |
| **REQ-GLB-05** | XACK은 ClickHouse 삽입이 성공한 뒤에만 한다. 재시도를 소진한 배치는 오류 사유와 함께 stream:plc:dlq에 복사하고 반드시 XACK한다. idle 기준을 넘긴 PEL은 주기 타이머의 XAUTOCLAIM이 회수한다 — 재시작은 회수의 원인일 뿐 신호가 아니다 | 원본 architecture.md §9.2 · 원본 data_flow.md §4 · 불변식 "at-least-once" · 배치 상태 머신 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | 삽입 전 XACK은 삽입 실패 시 **조용한 유실**이다. 격리에서 XACK을 생략하면 PEL에 영구 잔류해 컨슈머 랙이 영원히 0으로 돌아오지 않고 이후 모든 랙 알림이 거짓이 된다. 재시작 감지로만 회수하면 같은 프로세스 안 컨슈머 하나의 예외는 회수되지 않는다 | ClickHouse 5분 중단 후 생성 카운트 = tag_raw count · 잘못된 데이터 주입 후 DLQ 엔트리 증가와 XPENDING 0 조회 · 컨슈머 1개 예외 주입 후 회수 시간 측정 | ING-05 · ING-06 · ING-13 | F-02 · F-10 | 해당 없음 |
| **REQ-GLB-06** | 배치 토큰은 배치 내용에 결정적이다(첫 엔트리 ID + 끝 엔트리 ID + 행 수의 해시). 재시도는 첫 시도와 같은 토큰을 쓰고, 백오프 합계는 ClickHouse 중복 제거 윈도우 안에 머문다 — 백오프 · 윈도우는 2계층 조정값이며 조회 계약은 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) 소유(현행 참고 — 백오프 1 · 2 · 4 · 8 · 16초 · 윈도우 1000 파트) | 원본 architecture.md §1 멱등성 확보 · §7.1 · 원본 data_flow.md §4.3 · 불변식 "멱등" | 무작위 UUID면 재시작 후 같은 배치가 다른 토큰을 받아 **중복 행**이 생긴다. 백오프가 윈도우를 벗어나면 토큰이 같아도 중복이 생긴다. 중복 행은 avg · count 롤업을 조용히 부풀린다 | SW-08 on/off에서 삽입 직후 · XACK 직전 강제 종료를 주입하고 tag_id + ts 중복 행 수 조회(on 0 · off 발생) | ING-04 · ING-05 | F-02 | 해당 없음 |
| **REQ-GLB-07** | 컨슈머 사이의 처리 순서는 보장하지 않는다. 시계열 행은 ts를 자체 보유하므로 적재 순서에 의미를 두지 않으며, **적재 순서에 의존하는 집계를 도입하지 않는다** | 원본 data_flow.md §4.2 · 불변식 "순서 무관성" · 한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 삽입 순서를 전제한 집계(마지막 삽입 행 = 최신값 등)를 넣는 순간 라운드로빈 배분의 배치 간 역전이 결과를 바꾼다. ClickHouse는 삽입 순서를 보존하지 않으므로 오류 없이 틀린 값이 나온다 | 컨슈머 3개 구성에서 argMax(value, ts) 결과와 Redis 최신값 대조 · 집계 쿼리 전수에서 ingested_at · 삽입 순서 의존 여부 검토 | ING-07 · ING-08 · TSQ-01 | F-02 · F-03 | 해당 없음 |

## 요구사항 — Redis 키 계열

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GLB-08** | 키 접두 하나가 곧 생존 정책의 경계다. 봉인 계열(stream · rt · alarm)은 TTL을 붙이지 않고, 캐시 계열(cache · lock · rl · sess · auth)은 TTL 없이 만들지 않는다. 강제 수단은 린트가 아니라 **키 계열별 래퍼**다 — 캐시 래퍼는 TTL을 필수 파라미터로 받고 봉인 래퍼는 TTL 명령을 노출하지 않는다. 새 용도가 기존 접두의 정책과 다르면 접두를 빌리지 않는다 | 원본 architecture.md §8 · §8.3 · 원본 implementation_plan.md §7.5 · 불변식 "TTL 우선순위" · 봉인 표 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | 봉인 키에 TTL이 붙으면 volatile-lru의 축출 후보가 되어 메모리 압박 시 **Stream 엔트리 · 알람 상태가 조용히 사라진다.** 캐시 키에 TTL이 없으면 축출되지 않는 캐시가 Stream 예산을 잠식한다 | SCAN으로 접두별 샘플을 뽑아 TTL 조회(봉인 −1 · 캐시 양수) · maxmemory 하향 실험에서 evicted_keys 증가 중 stream · rt · alarm 키 수 불변 조회 | COL-07 · ING-05 · ING-08 · AUT-01 · AUT-06 · MST-07 | F-01 · F-02 · F-10 | 해당 없음 |
| **REQ-GLB-09** | 같은 Redis 인스턴스 안에서 실패 전략은 키 계열에 따라 정반대다 — 캐시 계열 호출은 짧은 타임아웃 후 예외를 삼키고 원천 DB로 우회(degrade)하며, 봉인 계열 호출 실패는 그대로 던져 백프레셔를 발동시킨다. 타임아웃은 2계층 조정값(현행 참고 50 ms · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)) | 원본 architecture.md §8 · §17 degrade 원칙 · 불변식 "실패 전략 이원화" | 캐시 호출 실패를 그대로 던지면 캐시 장애가 조회 서비스 실패가 된다. 봉인 호출 실패를 삼키면 XADD 실패가 스풀 전환 없이 **유실**이 된다. 최신값을 ClickHouse로 우회하면 초당 수백 회 점조회가 대량 스캔 엔진을 과부하시켜 적재까지 밀린다 | Redis 3분 중단 주입 — 시계열 조회 200(지연 증가) · 최신값 503 · Collector spool_active 켜짐을 동시에 조회 | TSQ-04 · RLT-04 · COL-09 · MST-08 | F-03 · F-04 · F-10 | realtime.latest_unavailable/503 |
| **REQ-GLB-10** | 버퍼가 차면 조용히 버리지 않고 실패시키고 계측한다. 1차 신호는 발행자의 적체 검사(컨슈머 그룹 lag + pending — XLEN이 아니다 · ADR-21 · 백프레셔 위험 단계 — 스풀 전환 · 부하 주입 표면 거절)이고, MAXLEN 트리밍은 검사를 우회한 발행자를 막는 최후 안전장치다. 미소비 엔트리가 잘리면 stream_trimmed_unacked로 **결함**으로 센다. 단계 임계는 2계층 조정값이며 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) | 원본 architecture.md §1 백프레셔 명시화 · §9.3 · 원본 data_flow.md §12.1 · 불변식 "백프레셔 명시화" | MAXLEN 트리밍은 오류 없이 오래된 데이터를 버린다 — 유실을 인지하지 못한 채 **틀린 처리량 수치**를 얻는다. 길이 검사를 하지 않는 발행자가 하나라도 있으면 그 발행자가 곧 "우회한 발행자"다 | 백프레셔 단계 전이 재현 중 stream_trimmed_unacked = 0 조회 · 모드 C 위험 단계 거절 수 집계 · 발행 경로 전수(Collector · 모드 B · 모드 C)의 길이 검사 유무 대조 | COL-07 · COL-09 · GEN-06 · GEN-07 · ING-13 | F-01 · F-09 · F-10 | datagen.stream_full/503 |

## 요구사항 — 저장소 책임과 분기

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GLB-11** | 업무 데이터는 PostgreSQL, 시계열은 ClickHouse에만 둔다. 중복 저장의 유일한 예외는 태그 최신값(Redis 휘발 사본 · 진실은 ClickHouse)이며 불일치 시 ClickHouse argMax로 재구성한다. 대조군 plc_tag_raw_control은 중복 저장이 아니라 SW-09 on에서만 채워지는 실험 계측물이다 | 원본 architecture.md §1 저장소 책임 단일화 · §5 · 불변식 "저장소 책임 단일화" · D-05 | 두 곳에 같은 사실을 두면 값이 갈라질 때 어느 쪽이 진실인지 정할 수 없다. 대조군을 기본 on으로 두면 모든 삽입 처리량에 대조군 비용이 섞여 목표 ②의 수치가 오염된다 | Redis HGETALL과 ClickHouse argMax 대조 · SW-09 off 기동에서 plc_tag_raw_control 행 증가 0 조회 | ING-08 · ING-11 · MST-09 | F-02 · F-03 | 해당 없음 |
| **REQ-GLB-12** | 분기는 성격 판정이다 — ① 태그 원시값은 ClickHouse 전용 ② 알람 판정은 목적이 다른 세 저장소로 ③ 회원 · 작업지시 · 감사는 PostgreSQL 전용이며 **Stream을 타지 않는다.** 업무 쓰기는 API가 트랜잭션으로 직접 커밋한다. 새 데이터 종류는 분기 표에 행을 먼저 두고 목적지 없이 스키마에 올리지 않는다 | D-04 · 원본 data_flow.md §8.2 · 불변식 "분기는 성격 판정" · 정책 정본 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) | 업무 쓰기를 Stream에 올리면 커밋 응답 직후 재조회가 아직 적재되지 않은 값을 보고(read-your-writes 붕괴), 재시도가 트랜잭션 밖에서 중복을 만든다 | 업무 CRUD 부하 중 stream:plc:raw 유입량이 CRUD 요청 수와 무관함을 측정(S7 합격 판정) | ING-10 · WRK-01 · MST-04 | F-02 · F-05 · F-06 | 해당 없음 |
| **REQ-GLB-13** | 알람의 PostgreSQL alarm_event · ClickHouse alarm_eval · Redis alarm:state 쓰기는 dual-write가 아니라 목적이 다른 세 쓰기다. 부분 실패 시 진실은 alarm_event이며 세 쓰기를 하나의 트랜잭션으로 묶지 않는다 | 원본 data_flow.md §8.2 · 불변식 "목적이 다른 세 쓰기" | dual-write로 오해하면 "CDC로 맞추자"는 제안이 들어와 판정 전수(분석) · 핫 상태(다음 판정) · 확정 이벤트(확인 이력)의 서로 다른 질문이 한 모양으로 뭉개진다 | 같은 구간의 alarm_eval 판정 수 · alarm_event 확정 수 · alarm:state 상태를 대조 · ClickHouse 중단 중 판정 후 alarm_event 존재 확인 | ALM-03 · ALM-04 · ALM-05 · ING-09 | F-06 | 해당 없음 |
| **REQ-GLB-14** | 두 DB를 트랜잭션으로 묶지 않는다. 시계열은 불변 사실로 두고 해석 메타(태그명 · 단위)는 조회 시점에 Dictionary로 붙인다. tag_id는 시퀀스로만 발급하고 영구 보존 · 재사용 금지이며, 스케일 변경은 기존 태그 수정이 아니라 새 tag_id 발급이다 | 원본 architecture.md §7.4 · §12 · 불변식 "불변 사실 기록" | 물리 삭제하면 ClickHouse 과거 행이 고아 tag_id를 갖고, 재사용하면 과거 행이 다른 태그의 이름을 얻고, 기존 태그의 scale을 고치면 과거 값의 공학 단위 의미가 조용히 바뀐다 | tag_master에 DELETE 권한 · 경로가 없는지 조회 · 스케일 변경 후 이전 tag_id 행 값이 변하지 않았는지 대조 | MST-05 · MST-06 · MST-09 · TSQ-07 | F-04 · F-05 | master.scale_change_forbidden/409 |
| **REQ-GLB-15** | 측정값은 Float64다. 원시 집계와 롤업 집계의 avg 대조는 오차 허용 비교로만 한다. avg는 버킷마다 abs(avg(원시) − avgMerge(롤업)) ≤ 2·γ(n)·S/n 상계로 비교하고(1계층 구조값 — γ(n)은 n회 합산의 부동소수 오차 계수 · S는 원시 abs(value) 합), count · min · max · last는 정확 일치로 한다. p95(TDigest) 근사 허용 범위만 미확인이다. 판정 자리는 [14_acceptance_criteria.md](./14_acceptance_criteria.md) | 원본 data_flow.md §17 롤업 정합성 · 불변식 "부동소수점" · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) | 동등 비교는 파트 병합 순서에 따라 최하위 비트가 달라져 **거짓 불일치**를 낸다. 반대로 count까지 오차 허용으로 비교하면 적재 누락 · 중복이 가려진다 | 원시 avg 대 avgMerge를 허용 오차로 · count 대 countMerge를 정확 일치로 대조하는 쿼리 | ING-12 · GEN-08 · TSQ-01 | F-08 | 해당 없음 |

- **REQ-GLB-14의 스케일 변경 거절은 master.scale_change_forbidden/409다.** 기존 태그 PATCH가 scale · offset_value를 바꾸려 하면 거절하고, 스케일 변경은 새 tag_id 발급 동작으로만 받는다 — 판정 자리는 [03_master.md](./03_master.md) REQ-MST-07, 코드 정본은 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)다.

## 요구사항 — 측정 · 계측 · 실행 경계

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GLB-16** | 새 컴포넌트는 메트릭 노출과 함께 추가한다. 스위치와 그 on/off 차이를 재는 계측은 같은 커밋에서 만든다. 외부 표면이 없는 도메인(COL · SIM · ING)의 실패는 에러 코드가 아니라 메트릭 · 품질 코드 · 상태 전이로 관측된다 | 원본 architecture.md §1 계측 우선 · 원본 tech_stack.md §1 원칙 3 · D-06 · 불변식 "계측 우선" | 계측 없는 스위치는 장식이다 — on/off를 바꿔도 차이를 기록할 수 없다. 내부 모듈에 코드를 주면 응답으로 나갈 곳이 없는 코드가 생겨 추적성 표에 유령 행이 된다 | 스위치 10종 각각의 교체 포트에 대응 메트릭이 /metrics에 있는지 조회 · 기능 추가 커밋에 메트릭 등록이 함께 있는지 대조 | OBS-01 · OBS-06 · COL-07 · ING-05 | F-01 · F-02 · F-10 | 해당 없음 |
| **REQ-GLB-17** | 모든 측정 수치에 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 4요소를 병기한다. 같은 실험을 3회 실행해 중앙값을 쓰고 편차가 기준을 넘으면 폐기한다(기준 정본 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) · 현행 참고 20%). 4요소가 없는 원본 수치는 "원본 예상치" · "원본 목표"로만 인용한다 | D-10 · 원본 implementation_plan.md §2.4 · §8 · 불변식 "측정 기록" | 넷 중 하나만 달라도 비교가 무의미한데 빠진 요소는 사후에 복원할 수 없다. P · E 코어 혼합 스케줄링으로 단일 실행 수치는 재현되지 않는다 | docs/measurements 기록 머리의 4요소 칸 존재 · 3회 값과 편차 칸 존재 대조 | OBS-06 · GEN-09 | 해당 없음 — 측정 절차 | 해당 없음 |
| **REQ-GLB-18** | 생성기가 만든 값은 품질 코드 SIMULATED(9)를 단다 — 모드 B · C · D는 생성기가 싣고, 모드 A는 Collector가 설비 접속 대상(modbus_config.host 루프백)으로 판정해 단다. 건강 코드(BAD_COMM · BAD_RANGE)가 출처 코드보다 앞선다 | 원본 data_flow.md §3.2 · 불변식 "생성 데이터 구분" · [../02_features/03_collector.md](../02_features/03_collector.md) §모드 A의 SIMULATED 표지 판정 | 실데이터와 섞인 뒤에는 과거 데이터가 시뮬레이션이었음을 구분할 수 없어 모든 분석 결과의 신뢰성이 무너진다 | 모드별 적재 후 quality 분포 조회(정상 값은 9뿐) · 오류 주입 행이 2로 저장됐는지 조회 | COL-05 · GEN-02 | F-01 · F-09 | 해당 없음 |
| **REQ-GLB-19** | 호스트 포트는 전부 127.0.0.1에 바인드하고 PlcSim 포트는 publish하지 않는다. **외부에서 도달할 수 없다는 사실로 인가 검사 · 입력 검증을 생략하지 않는다** — S7부터 전 인증 표면에 Guard를 걸고, 전 REST 표면이 요청을 스키마로 검증한다 | D-02 · 원본 architecture.md §3 · §18 · 원본 tech_stack.md §10.4 · 불변식 "로컬 전용" | 0.0.0.0 바인드는 같은 네트워크의 다른 기기에 DB를 여는 것과 같다. 로컬이라 검증을 생략하면 같은 머신의 부하 도구 · 잘못된 스크립트가 원시 1년치 조회로 ClickHouse를 마비시킨다 | Compose 포트 표기 전수 조회(127.0.0.1 접두) · 컨테이너 밖에서 5020 접속 실패 확인 · 무인증 요청 · 형식 위반 요청 주입 | AUT-04 · AUT-05 · AUT-07 · SIM-01 | F-03 · F-04 · F-05 | auth.unauthenticated/401 · auth.forbidden/403 · common.validation_failed/400 |
| **REQ-GLB-20** | 쓰기 경로와 읽기 경로를 모듈 경계와 Stream으로 가르고, CPU 바운드 작업(대량 생성 · MessagePack 인코딩 · 해제 · LTTB · gzip)은 worker_threads 풀에서 실행해 이벤트 루프를 비운다. 프로세스 · 컨테이너 분리는 이벤트 루프 지연이 실측된 뒤에만 한다 | 원본 architecture.md §1 쓰기 · 읽기 분리 · §4 · 원본 tech_stack.md §1 원칙 1 · 원본 data_flow.md §15 단일 이벤트 루프 공유 위험 | 수집 폭주가 이벤트 루프를 점유해 대시보드 응답이 느려진다 — 수집 pps에 비례해 조회 p95가 악화된다 | 수집 부하 단계별 nodejs_eventloop_lag_p95_seconds와 조회 p95의 상관 측정 | ING-01 · GEN-01 · TSQ-06 · OBS-01 | F-02 · F-04 · F-09 | 해당 없음 |
| **REQ-GLB-21** | 모듈 간 결합은 데이터 계약으로만 한다 — Stream 페이로드는 스키마 버전 v를 싣고, 소비자는 v로 디코더를 고르며, 발행자(Collector · 모드 B · 모드 C)는 같은 계약을 따른다. 계약 변경 규칙의 정본은 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) | 원본 tech_stack.md §1 원칙 2 · 원본 data_flow.md §14 | 발행자마다 페이로드가 다르면 APP_ROLE 분리 뒤 두 버전이 공존하는 순간 소비자가 적체된 구버전 엔트리를 읽지 못해 **DLQ로 쏟아진다** | 발행 경로별 샘플 엔트리의 v · 필드 집합 대조 · 구버전 엔트리를 적체시킨 채 재기동 후 dlq_count 조회 | COL-07 · GEN-06 · GEN-07 · ING-01 | F-01 · F-02 · F-09 | 해당 없음 |
| **REQ-GLB-22** | 단일 호스트에서 시작하고 병목이 실측될 때만 쪼갠다. 확장 로드맵의 각 단계는 진입 조건 수치가 대시보드에서 관측된 뒤에만 들어가고 진입 전후 수치를 기록한다. 진입 조건 값은 [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) 소유다 | 원본 tech_stack.md §1 원칙 4 · 원본 architecture.md §19 | 추측으로 분산하면 무엇이 병목이었는지 배울 수 없고, 분리 전 기준선이 없어 분리의 효과를 잴 수 없다 | 확장 단계 진입 기록에 진입 조건 지표의 실측값과 4요소가 있는지 대조 | OBS-01 · OBS-02 | 해당 없음 — 구성 변경 | 해당 없음 |
| **REQ-GLB-23** | 실험은 같은 초기 상태에서 반복한다 — 실험 전 볼륨 스냅샷 · 실험 후 복원을 거치고, 실험 시작 전 캐시 계열 키를 비우되 봉인 계열 키는 유지한다 | 원본 architecture.md §3 실험 롤백 · 원본 data_flow.md §11.3 · D-10 | TTL과 머지가 진행된 데이터 위에 다시 부하를 걸면 직전 실험의 파트 · 캐시 상태가 결과에 섞여 **같은 조건이라 믿은 두 측정이 다르다** | 측정 기록의 스냅샷 · 복원 칸 대조 · 실험 시작 시점 cache 접두 키 수 0 조회 | TSQ-04 · GEN-03 | 해당 없음 — 측정 절차 | 해당 없음 |
| **REQ-GLB-24** | ClickHouse · PostgreSQL 쿼리에 들어가는 사용자 입력(경로 · 쿼리 · 본문 값)은 전부 **파라미터 바인딩**으로 넘기고 **문자열 연결로 SQL을 만들지 않는다.** 바인딩할 수 없는 자리(테이블 · 해상도 · 집계 함수 · 출력 형식 · 정렬 방향)는 스키마 검증이 허용한 열거 값을 서버의 고정 대응표로 바꿔 넣는다. 태그 ID 배열은 정수 배열로 검증한 뒤 바인딩한다 | 원본 architecture.md §18 SQL 인젝션 행 · 불변식 "로컬 전용" · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) §ClickHouse 파라미터 바인딩 | 문자열을 연결하면 요청 값이 SQL 문장이 된다 — 같은 머신의 스크립트 · 무인증 기간(S2~S6) 브라우저 요청 하나가 tag_raw를 지우거나 TTL을 바꾼다. 해상도 값을 그대로 FROM 절에 넣으면 임의 테이블을 읽는다. 바인딩을 어긴 쿼리는 값이 문형에 박혀 **공개 표면 /metrics의 느린 쿼리 문형에 요청 값이 실린다**(REQ-OBS-10 위반) | 쿼리 조립 코드에서 SQL 문자열 연결 · 템플릿 삽입 검색 0건 · 태그 ID에 문자열 · 따옴표 · 세미콜론을 넣은 요청 → 400 · ClickHouse 쿼리 로그와 pg_stat_statements의 문형에 요청 리터럴 0건 · interval · aggregations · format에 허용 밖 값 → 400 | MST-01~06 · TSQ-01 · TSQ-09 · RLT-01 · RLT-02 · ALM-01 · ALM-07 · ALM-08 · ALM-09 · WRK-01 · WRK-02 · WRK-03 · WRK-05 | F-03 · F-04 · F-05 · F-06 | common.validation_failed/400 |

- **REQ-GLB-23의 운영 절차(스냅샷 명령 · 볼륨 목록)는 [13_nonfunctional.md](./13_nonfunctional.md) REQ-TEC가 갖는다.** 이 행은 "같은 초기 상태"라는 전역 계약만 고정한다.

## 전역 불변식 대응 검산

루트 README 전역 불변식 표의 17행이 각각 하나 이상의 REQ-GLB로 상세화되는지 검산한다. 불변식 이름은 루트 README 표의 항목 열 그대로다.

| # | 불변식 | 상세화 REQ | 대응 수 |
|------|------|------|------|
| 1 | 시각 의미론 | REQ-GLB-01 · 02 | 2 |
| 2 | 비동기 경계 | REQ-GLB-03 · 04 | 2 |
| 3 | at-least-once | REQ-GLB-05 | 1 |
| 4 | 멱등 | REQ-GLB-06 | 1 |
| 5 | 순서 무관성 | REQ-GLB-07 | 1 |
| 6 | TTL 우선순위 | REQ-GLB-08 | 1 |
| 7 | 실패 전략 이원화 | REQ-GLB-09 | 1 |
| 8 | 백프레셔 명시화 | REQ-GLB-10 | 1 |
| 9 | 저장소 책임 단일화 | REQ-GLB-11 | 1 |
| 10 | 분기는 성격 판정 | REQ-GLB-12 | 1 |
| 11 | 목적이 다른 세 쓰기 | REQ-GLB-13 | 1 |
| 12 | 불변 사실 기록 | REQ-GLB-14 | 1 |
| 13 | 부동소수점 | REQ-GLB-15 | 1 |
| 14 | 계측 우선 | REQ-GLB-16 | 1 |
| 15 | 측정 기록 | REQ-GLB-17 · 23 | 2 |
| 16 | 생성 데이터 구분 | REQ-GLB-18 | 1 |
| 17 | 로컬 전용 | REQ-GLB-19 · 24 | 2 |

- **불변식 17행 전부 대응이 있다 — 누락 0.** 대응이 둘인 불변식 4행(시각 의미론 · 비동기 경계 · 측정 기록 · 로컬 전용)은 요약 문장 하나가 서로 다른 실패 두 개를 막고 있어 행을 갈랐다.
- 불변식에 걸리지 않은 REQ-GLB 3행(20 · 21 · 22)은 원본 설계 원칙에서 왔다 — §원본 설계 원칙 대응이 닫는다.

### 검산

- 세는 기준은 **불변식 행별 대응 REQ 수의 합**이다. 대응 둘 4행(1 · 2 · 15 · 17) + 대응 하나 13행 = 4 × 2 + 13 × 1 = **21**
- 불변식에 걸린 REQ-GLB = 01~19 · 23 · 24 = 19 + 2 = **21**. REQ 하나가 불변식 둘에 걸린 경우가 없어 두 수가 같다
- REQ-GLB 채번 합 = 불변식 대응 21 + 원칙 전용 3(20 · 21 · 22) = **24**

## 원본 설계 원칙 대응

원본 설계서의 원칙 목록 두 벌 — architecture.md §1 원칙 6 · tech_stack.md §1 원칙 4 — 이 REQ-GLB로 닫히는지 대응한다. 원칙은 이 문서에서 흡수가 끝나며 다른 문서는 REQ-GLB를 인용한다.

| 원본 | 원칙 | 대응 REQ | 흡수 방식 |
|------|------|------|------|
| architecture.md §1 | 쓰기 경로와 읽기 경로 분리 | REQ-GLB-20 | 원칙 그대로 계약화 · 분리의 진입 조건은 REQ-GLB-22 |
| architecture.md §1 | 저장소 책임 단일화 | REQ-GLB-11 | 대조군을 예외가 아닌 계측물로 명시해 보강 |
| architecture.md §1 | 비동기 경계 삽입 | REQ-GLB-03 · 04 | 근거 네 가지를 위반 시 실패 ①~④로 · 경계 횡단 경로를 둘로 닫음 |
| architecture.md §1 | 멱등성 확보 | REQ-GLB-06 | 토큰의 결정성 · 윈도우 조건으로 구체화 |
| architecture.md §1 | 백프레셔 명시화 | REQ-GLB-10 | 1차 신호와 최후 안전장치를 갈라 계약화 |
| architecture.md §1 | 계측 우선 | REQ-GLB-16 | 같은 커밋 규칙 · 내부 모듈의 관측 형태 추가 |
| tech_stack.md §1 | ① 쓰기 경로와 읽기 경로를 분리한다 | REQ-GLB-20 | architecture.md §1 첫 원칙과 같은 사실 — 한 행으로 합침 |
| tech_stack.md §1 | ② 경계는 데이터 계약으로만 결합한다 | REQ-GLB-21 | 스키마 버전 v를 결합 계약으로 고정 |
| tech_stack.md §1 | ③ 모든 구간에 계측점을 심는다 | REQ-GLB-16 | architecture.md §1 계측 우선과 합침 |
| tech_stack.md §1 | ④ 단일 호스트에서 시작해 병목이 실측될 때만 쪼갠다 | REQ-GLB-22 | 확장 단계 진입 기록 요구로 계약화 |

- 검산: architecture.md §1 원칙 **6** + tech_stack.md §1 원칙 **4** = **10**행 · 대응 없는 원칙 **0**
- 두 벌이 겹치는 원칙 2쌍(쓰기 · 읽기 분리 · 계측)은 REQ 하나로 합쳤다. 원칙마다 REQ를 따로 두면 같은 사실의 정본이 둘이 된다.

## 강제 주체와 한계

각 전역 계약을 무엇이 강제하고 무엇을 못 막는지 적는다. **어느 계층도 강제하지 않는 것**은 누락이 아니라 기록된 상태이며, 잔여의 정본은 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재다.

| REQ | 강제 주체 | 막는 것 | 못 막는 것 | 잔여가 담기는 곳 |
|------|------|------|------|------|
| REQ-GLB-01 | ClickHouse DEFAULT(ingested_at) · 적재 코드 | 적재 코드가 적재 시각을 위조하는 것 | 조회 코드가 ts 대신 ingested_at으로 자르는 것 — 강제 수단 없음 | 코드 검토 · REQ-GLB-01 검증 쿼리 |
| REQ-GLB-05 | Ingest 배치 상태 머신 | 삽입 전 XACK · 격리 후 XACK 누락 | DLQ 엔트리의 재처리 — 사람이 거는 운영 절차(원 토큰으로 tag_raw 직접 삽입 · stream:plc:raw 재발행 없음) | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) §DLQ 재처리 |
| REQ-GLB-06 | 결정적 토큰 + ClickHouse 중복 제거 윈도우 | 윈도우 안 재시도 중복 | 윈도우 밖 재삽입 · 대조군 쪽 중복 | [07_ingest.md](./07_ingest.md) REQ-ING-15 |
| REQ-GLB-07 | 없음 — 설계 전제 | 해당 없음 | 순서 의존 집계의 도입 자체 | 한계 등재 — 순서 무관성 행 |
| REQ-GLB-08 | 키 계열별 래퍼(타입 시스템) | 래퍼를 거친 TTL 위반 | redis-cli 수동 조작 · 래퍼를 우회한 원시 클라이언트 호출 | 봉인 표 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| REQ-GLB-10 | 발행자의 적체 검사 + MAXLEN | 검사하는 발행자의 넘침 | 검사하지 않는 발행자의 조용한 유실 — 계측만 한다 | stream_trimmed_unacked |
| REQ-GLB-14 | 시퀀스 · 논리 삭제 · 쓰기 표면 | 표면을 통한 물리 삭제 · 스케일 덮어쓰기 | psql 직접 UPDATE | 한계 등재 |
| REQ-GLB-19 | Compose 포트 표기 | LAN 노출 | 같은 머신의 다른 프로세스 접근 | [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) |

- 검산: 강제 주체 등재 = **8**행. 강제 주체가 "없음"인 행 **1**(REQ-GLB-07) — 순서 무관성은 규칙이 아니라 전제라서 막을 주체가 없고, 전제가 깨지는 순간을 한계 등재가 경보로 받는다.

## 인계 판정

이 문서가 받은 웨이브 인계 항목은 없다. 도메인 파일로 간 판정 중 전역 계약에 걸리는 것만 가리킨다.

| 판정 | 전역 계약 | 판정 자리 |
|------|------|------|
| Redis 중단 시 로그인 · 갱신은 거절하고 레이트 리밋은 degrade한다 | REQ-GLB-09 — auth 계열은 캐시 계열이지만 **원천 DB가 없어 우회할 곳이 없다** | [02_auth.md](./02_auth.md) REQ-AUT-14 |
| 모드 B도 발행 전 적체 검사를 한다 | REQ-GLB-10 — 검사 없는 발행자를 남기지 않는다 | [06_datagen.md](./06_datagen.md) REQ-GEN-07 |
| SW-09 대조군 삽입 실패는 XACK를 막지 않는다 | REQ-GLB-11 — 계측물의 실패가 분기 목적지의 경로를 멈추지 않는다 | [07_ingest.md](./07_ingest.md) REQ-ING-15 |

## 관련 문서

- [../README.md](../README.md) — 전역 불변식 요약 17행 · 고정 기준
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론 · 부동소수 비교 정본
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 배치 재시도 · 백프레셔 상태 머신
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-01 off 경고 · 스위치 상태 노출
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 봉인 표 · 키 계열별 래퍼
- [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) — 한계 등재
- [13_nonfunctional.md](./13_nonfunctional.md) — 성능 목표 · 기술 운영 요구사항
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 롤업 비교 허용 오차 · 단계별 인수 기준
