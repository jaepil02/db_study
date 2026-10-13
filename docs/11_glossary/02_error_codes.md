# 에러 코드 사전 (02_error_codes)

> **대상**: db_study api 컨테이너의 REST 표면이 반환하는 에러 코드 전수 — 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 M1 · M3 · M4 · 리드 보안 판정 §5-4) — common.validation_failed 발생 조건에 **Content-Type application/json 아님**(path header.content-type) · **설비 가동 중 직접 비교 넣기 · 무결성**(path plant) · **센서 데이터 지우는 중 실행 시작 · 설비 켜기**(path purge) · realtime.latest_unavailable 발생 표면에 09_datagen #2(넣기 · 무결성의 가동 상태 읽기) · datagen.compare_no_data details에 **reason 3값**(no_ingest · ingest_incomplete · no_rows — 마지막 넣기 미완료 신설) · data.purge_blocked details.reason 2 → **3값**(stream_backlog · plant_running에 켜는 중 · 수집기 적용 상태) — 코드 종수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 지우기**(사용자 결정 2026-10-11 · 공용 계약 packages/shared errors.ts) — **datagen.compare_no_data/409 · data.purge_blocked/409 신설**(조회 대결을 넣기 전에 시작 · 실행 중 · 설비 가동 중 지우기) · 네임스페이스 정의 6 → **7**(data — 도메인 모듈명 규칙의 기록된 예외) · 코드 보유 5 → **6** · 에러 코드 10 → **12종** · realtime.latest_unavailable 발생 표면에 설비 가동 · HMI 개요(07_api/06 #3~#5) · common.postgres_unavailable에 HMI 개요 메타 사본 없음
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 측정 도구 삭제**(사용자 결정 2026-10-11) — 코드 11 **폐지**(common.rate_limited · auth 6 · alarms 2 · datagen.stream_full · datagen.bulk_disabled — §폐지 코드 신설 · 재사용 금지) — 전수 23 → **12** · 네임스페이스 정의 9 → **7**(auth · alarms 삭제) · 코드 보유 8 → **6** · HTTP 규약 표 401 · 403 · 429 행 삭제(쓰지 않음) · common 범위의 레이트 리밋 삭제 · 채번 보류 처리 결과에 폐지 표기 · (리드 판정 — WRK 함께 폐지) work_orders 코드 2 **폐지**(invalid_status_transition · production_log_not_allowed) — 전수 12 → **10** · 409 6 → **4** · 네임스페이스 정의 7 → **6** · 코드 보유 6 → **5** · 폐지 11 → **13** · 발생 조건의 작업지시 · order_no 삭제 · common 발생 표면에서 07_alarms · 08_work_orders(삭제) 링크 · 로그인 · 인가 단계 삭제
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 · 리드 판정 2) — **datagen.run_in_progress/409 신설**(실행 중 시작 요청 · details {runId, type} · 발생 표면 07_api/09_datagen #2) — 에러 코드 22 → **23종** · datagen 2 → **3** · 409 6 → **7** · common.not_found 발생 조건에 실행 식별자(runId) · 발생 표면에 09_datagen #4 · #5 · 에러 코드가 아닌 것에 실행 실패(status failed)와 끝난 실행의 중단(200) 2행 — 실행 실패 코드(run_failed)는 만들지 않는다
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-M4 · B-M9) — common.postgres_unavailable 원인 구분 "result=unavailable이 가른다" → **Redis 불가 = unavailable · PostgreSQL 불가 = failed** · 워커 PostgreSQL 불가 = 명령 조회 failed(적용 여부 미확정 · 같은 키 재요청으로 확정) — 코드 수 불변
> **개정일**: 2026-09-27 — D-04 부분 개정 반영(사용자 결정 — 업무 쓰기도 Redis를 거친다 · 동기 응답) — common.postgres_unavailable 발생 조건 · 발생 표면 보강 — **업무 쓰기 표면의 Redis 불가(명령 스트림 적재 실패 · SW-12 stream)와 워커의 PostgreSQL 불가도 이 코드**(클라이언트 대응이 같아 재사용 · 원인은 biz_commands_total result 레이블) · 발생 표면에 명령 조회 07_api/01_conventions #1 — **코드 수 불변(22)**
> **개정일**: 2026-09-26 — W1 검수 반영 — auth.unauthenticated · auth.forbidden 발생 조건에 인증 도입(S7 ②) 전 알람 확인 조건(행위자 해석 실패 · 행위자 OPERATOR 없음 — 정본 07_api/07 §인증 전 확인 행위자 판정) 추가 — 코드 수 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — common.validation_failed 발생 조건에 Host 헤더 허용 목록 위반 추가(코드 수 불변)
> **개정일**: 2026-09-24 — W7 검수 반영 — README ID 규약 예시와의 충돌 서술 → **W1에 고쳤다**로 갱신 — 코드 수 불변
> **개정일**: 2026-09-24 — W5 표면 판정 반영 — 에러 코드 19 → **22종**(master.reissue_source_inactive/409 · alarms.eval_store_unavailable/503 · work_orders.production_log_not_allowed/409 신설) · common.duplicate_key 대상 · common.postgres_unavailable 인가 단계 표면 · invalid_status_transition fromStatus 경합 조건 보강
> **개정일**: 2026-09-24 — W4 판정 반영 — datagen.stream_full 조건 스트림 길이 → **미확인 적체**(ADR-21) · common.postgres_unavailable 표면에 최신값 단일 태그 추가 · common.rate_limited 키 표기 rl:{class}:{user_id}:{unix_minute} — 코드 수 불변
> **개정일**: 2026-09-24 — W2 요구사항 판정으로 채번 보류 8건을 닫는다 — 에러 코드 14 → **19종**(auth.token_store_unavailable/503 · master.scale_change_forbidden/409 · timeseries.clickhouse_unavailable/503 · alarms.ack_not_allowed/409 · work_orders.invalid_status_transition/409 신설) · 코드 보유 네임스페이스 5 → **8** · 재사용 1 · 코드 없음 2
> **원천**: 원본 architecture.md §9.3 · §11 · §11.1 · §11.2 · §17(커밋 ff66a37) · 원본 data_flow.md §5 · §7.2 · §12.1 · §12.2(커밋 ff66a37) · 원본 architecture.md §6 ERD 유일 제약 · docs_plan.md 실행 계획 보정 #11 · #12 · [04_id_conventions.md](./04_id_conventions.md) 에러 코드 형식

에러는 **{domain}.{snake_case} 코드 + HTTP 상태**로 반환하며 문서에서는 {domain}.{snake_case}/{HTTP}로 적는다. 본 문서는 문서군 전체에서 에러 코드를 **새로 만들 수 있는 유일한 자리**다. [../07_api/02_errors.md](../07_api/02_errors.md)는 미러이며 코드를 신설 · 개명 · 폐기하지 않는다 — 미러가 정본보다 먼저 바뀌면 W5 표면 문서가 존재하지 않는 코드를 인용하게 된다.

**원본에서 실패가 확인되는 것만 채번한다.** 원본 설계서가 실패 조건 · 응답 상태 · 거절 동작을 적은 자리만 코드가 되고, 원본이 적지 않은 실패 후보는 "채번 보류" 절에 등재해 W2 · W5가 요구사항과 표면을 확정할 때 이 문서에서 채번한다. 응답 봉투(본문 구조 · 헤더)의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)이고, 이 문서는 코드 · 상태 · 발생 조건 · 클라이언트 대응만 갖는다.

## 정본 선언

| 축 | 정본 | 성격 |
|----|------|------|
| 코드 채번 · 형식 · HTTP 상태 배정 | 본 문서 | 유일 등재처. 신설 · 개명 · 폐기는 여기서만 한다 |
| 표면별 노출 · 응답 봉투 | [../07_api/02_errors.md](../07_api/02_errors.md) · [../07_api/01_conventions.md](../07_api/01_conventions.md) | 미러 · 규약. 코드 집합은 본 문서를 넘지 않는다 |
| 도메인별 발생 조건의 요구사항 | [../03_requirements](../03_requirements/README.md) 도메인 파일 | REQ가 코드를 인용한다. REQ가 새 실패를 정의하면 본 문서에 먼저 채번한다 |
| 배치 · 실행 상태 전이 | [03_enums_state_machines.md](./03_enums_state_machines.md) | 전이 위반이 코드를 내면 이 문서의 코드를 인용한다 |

## HTTP 상태 규약

상태는 **클라이언트가 할 일**로 고른다. 같은 원인이라도 클라이언트 대응이 다르면 코드를 가르고, 대응이 같으면 원인이 달라도 한 코드로 묶는다.

| HTTP | 뜻 | 클라이언트 대응 축 | 재시도 |
|:----:|----|------------------|:------:|
| 400 | 요청 형식이 계약을 어긴다 | 요청을 고친다 | 금지 |
| 404 | 대상이 없다 | 대상을 확인한다 | 금지 |
| 409 | 현재 저장 상태와 충돌한다 | 다른 값으로 다시 요청한다 | 같은 값으로 금지 |
| 503 | 의존 저장소가 응답할 수 없거나 버퍼가 위험 단계다 | 백오프 후 다시 요청한다 | 백오프 |

- **401 · 403 · 429는 쓰지 않는다.** 로그인 · 권한 · 레이트 리밋을 D-16(사용자 결정 2026-10-11)으로 지웠다 — 신원 · 역할 · 한도로 거절하는 표면이 없다.
- **5xx 중 503만 코드로 채번한다.** 500은 설계된 실패가 아니라 결함이므로 코드를 주지 않는다 — 500에 코드를 붙이면 결함이 "정의된 동작"으로 문서화되어 수정 동기가 사라진다.
- **400과 422를 가르지 않는다.** 원본에 형식 오류와 의미 오류를 다르게 다루는 자리가 없고, 클라이언트 대응(요청 수정)이 같다. 의미 검증 실패가 다른 대응을 요구하는 사례가 나오면 그때 422를 도입한다.

## 네임스페이스 배정 규칙

네임스페이스는 **표면을 소유한 도메인 모듈명**이다(모듈명의 하이픈은 밑줄로 바꾼다). 도메인과 무관하게 전역 파이프 · 필터 · 저장소 공통 경로에서 나는 실패는 common이 갖는다.

| 네임스페이스 | 도메인 | 발생 표면 | 범위 |
|-------------|--------|----------|------|
| common | 횡단 | 전 REST 표면 | 요청 검증(Host 대조 포함) · 대상 없음 · 유일 제약 충돌 · PostgreSQL 접속 불가(업무 쓰기의 명령 스트림 불가 포함) |
| master | MST | [../07_api/04_master.md](../07_api/04_master.md) | 스케일 변경 · 새 태그 발급 원본 |
| timeseries | TSQ | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 조회 요청 상한 · ClickHouse 접속 불가 |
| realtime | RLT | [../07_api/06_realtime.md](../07_api/06_realtime.md) | 최신값 저장소 접속 불가(설비 가동 · HMI 개요 포함 — 둘 다 Redis 실시간 계열) |
| datagen | GEN | [../07_api/09_datagen.md](../07_api/09_datagen.md) | 라이브 실행의 동시 실행 거절 · 직접 비교 조회 대결의 데이터 없음 |
| data | GEN(예외) | [../07_api/09_datagen.md](../07_api/09_datagen.md) #7 · #8 | 센서 데이터 지우기의 막힘 |
| metrics | OBS | [../07_api/10_metrics.md](../07_api/10_metrics.md) | 현재 채번 없음 |

- **COL · SIM · ING은 네임스페이스를 두지 않는다.** 세 도메인은 외부 표면이 없는 내부 모듈이라 HTTP 응답을 만드는 자리가 없다. 내부 모듈의 실패는 에러 코드가 아니라 **메트릭과 상태 전이**로 드러난다 — ING의 삽입 실패는 재시도대기 → 격리(DLQ) 전이와 dlq_count로, COL의 XADD 실패는 스풀 전환과 spool_active로 계측한다. 코드를 주면 응답으로 나갈 곳이 없는 코드가 생겨 미러와 추적성 표에 유령 행이 된다.
- **AUT · ALM · WRK는 네임스페이스를 두지 않는다(D-16 — 세 도메인 폐지).** 남은 출처 방어(REQ-GLB-25 · 26)는 소유 표면이 없는 횡단 방어선이라 Host 대조 실패는 common.validation_failed다. 옛 auth · alarms · work_orders 코드는 §폐지 코드가 갖는다.
- **네임스페이스 정의와 코드 보유를 가른다.** 표면 있는 도메인은 코드가 0이어도 네임스페이스를 가진다 — 첫 코드를 채번할 때 이름을 새로 정하지 않도록 자리를 먼저 고정한다.
- **A형 — data는 도메인 모듈명이 아니다(기록된 예외).** 통념은 "센서 데이터 지우기(GEN-14)는 GEN 표면이니 datagen이어야 한다"이다. 그렇지 않다 — 공용 계약(packages/shared errors.ts · D-16 결정 5)이 표면 경로 /api/v1/data/sensor를 따라 data로 정했다. 진짜 축은 클라이언트 대응이다 — 지우기의 막힘은 "실행 · 가동을 멈추고 다시"이고 실행 시작의 막힘(datagen.run_in_progress)은 "그 실행이 끝나기를 기다린다"라서 이름이 갈려도 대응이 섞이지 않는다. 대체 경로 — 다음 코드를 채번할 때 이 예외를 넓히지 않는다(새 GEN 실패는 datagen) · 이름을 datagen으로 옮기면 코드 · 미러 · 화면 문구를 같은 변경 단위에서 바꾼다.

## 에러 코드 전수

### common — 횡단

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| common.validation_failed | 400 | 요청 본문 · 쿼리 · Host 헤더가 계약을 어긴다(Host는 허용 목록 밖 — path header.host · reason enum · 12_security/03) — 타입 불일치 · 필수 누락 · 허용값 밖(interval이 raw · 1m · 1h · 1d가 아님 · aggregations가 5종 밖 · from · to가 ISO 8601이 아님). 원본 architecture.md §11.1. 상태를 바꾸는 POST의 Content-Type이 application/json이 아니거나 본문이 JSON 객체가 아닐 때(path header.content-type · body — REQ-GLB-27)도 이 코드다. **지금 상태가 시작을 허락하지 않는 거절 셋도 새 코드 없이 여기다** — 직접 비교 넣기 · 무결성을 SW-09 off에서(path SW-09) · 설비 가동이 켜진 채(path plant) 시작할 때 · 센서 데이터를 지우는 동안 실행 시작 · 설비 켜기(path purge) — 셋 다 reason enum이고 대응이 "조건을 바꾼 뒤 다시"라 409 코드를 새로 만들지 않았다 | 전 REST 표면 | 요청을 고친다. 같은 요청의 재시도 금지 |
| common.not_found | 404 | 경로의 식별자가 가리키는 대상이 마스터에 없다(설비 · 태그). 라이브 실행의 runId가 api 메모리에 없을 때(옛 실행 · 재기동 전 실행 — [../07_api/09_datagen.md](../07_api/09_datagen.md) #4 · #5)도 이 코드다. **rt:latest 키가 비어 있는 것은 여기가 아니다** — 설비가 마스터에 있으면 ClickHouse 복원 경로를 탄다(원본 data_flow.md §5) | [../07_api/04_master.md](../07_api/04_master.md) · [../07_api/06_realtime.md](../07_api/06_realtime.md) · [../07_api/09_datagen.md](../07_api/09_datagen.md) | 식별자를 확인한다 · 실행이면 현재 실행(09_datagen #3)을 다시 읽는다 |
| common.duplicate_key | 409 | 유일 제약 컬럼에 이미 있는 값을 쓴다 — tag_master.tag_code · site.site_code · production_line(site_id, line_code) · device.device_code(05_data_stores/02 UNIQUE) | [../07_api/04_master.md](../07_api/04_master.md) | 다른 값으로 다시 요청한다 |
| common.postgres_unavailable | 503 | PostgreSQL에 접속할 수 없어 업무 읽기 · 쓰기가 실패한다. 시계열 조회는 영향을 받지 않는다 — Dictionary가 마지막 적재 값을 유지한다(원본 architecture.md §17). 최신값 단일 태그 조회는 태그 → 설비 해석(cache:tagmeta 미스)이 PostgreSQL에 막히면 이 코드다 — 설비 전체 조회는 값을 내고 메타만 비운다(W4 판정 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)) **업무 쓰기 표면에서 Redis에 접속할 수 없어 명령을 명령 스트림 stream:biz:cmd에 싣지 못할 때(SW-12 stream)도 이 코드다** — 적용 없음 · 클라이언트 대응(백오프 뒤 같은 Idempotency-Key로 재요청)이 PostgreSQL 불가와 같아 코드를 가르지 않는다(HTTP 상태 규약 · 재사용 판정 [../07_api/01_conventions.md](../07_api/01_conventions.md) §업무 쓰기 경로) · 원인은 biz_commands_total의 result 레이블이 가른다 — Redis 불가 = unavailable · PostgreSQL 불가 = failed. 워커가 PostgreSQL 불가로 명령을 적용하지 못한 경우도 이 코드다(재시도 · 보관 없음 · 명령 조회 failed — 적용 여부 미확정이라 같은 키 재요청으로 확정한다). HMI 개요가 설비 · 태그 메타 사본을 한 번도 읽지 못한 채 PostgreSQL에 막힐 때도 이 코드다 — 사본이 있으면 마지막 사본으로 200을 낸다(REQ-RLT-20) | 업무 CRUD 표면 · 최신값 단일 태그 · HMI 개요([../07_api/06_realtime.md](../07_api/06_realtime.md) #2 · #5) · 명령 조회([../07_api/01_conventions.md](../07_api/01_conventions.md) #1 — 결과 키가 없고 원장을 읽지 못할 때) | 백오프 후 다시 요청한다 |

### master — 마스터 데이터

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **master.scale_change_forbidden** | 409 | 기존 태그의 scale · offset_value를 바꾸는 PATCH다. 스케일 변경은 새 tag_id 발급이므로 기존 행 수정으로 받지 않는다(원본 architecture.md §12 · REQ-MST-07) | [../07_api/04_master.md](../07_api/04_master.md) | 새 태그 발급 동작으로 다시 요청한다 |
| **master.reissue_source_inactive** | 409 | 새 태그 발급(reissue)의 원본 태그가 이미 비활성이다 — 비활성 태그에서 다시 발급하면 계보가 갈라진다(W5 판정 · [../07_api/04_master.md](../07_api/04_master.md) #7) | [../07_api/04_master.md](../07_api/04_master.md) | 현재 활성 후속 태그에서 발급한다 |

### timeseries — 시계열 조회

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **timeseries.clickhouse_unavailable** | 503 | 캐시 미스 조회 또는 내보내기 응답 시작 전에 ClickHouse 접속 불가 · 타임아웃이다. **캐시 히트는 200이고, 대조군 PostgreSQL이나 Redis 최신값으로 우회하지 않는다**(REQ-TSQ-16) | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 백오프 후 다시 요청한다 |
| timeseries.too_many_tags | 400 | 조회 요청 tagIds 배열 길이가 상한을 넘었다(현행 50 — 원본 architecture.md §11.1) | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 태그를 상한 이하 묶음으로 나눠 여러 번 요청한다 |

- **common.validation_failed와 따로 두는 이유는 대응이 "고친다"가 아니라 "나눈다"이기 때문이다.** 같은 코드로 묶으면 클라이언트가 형식 오류로 읽고 요청을 포기한다.

### realtime — 최신값

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| realtime.latest_unavailable | 503 | Redis에 접속할 수 없다. **키가 비어 있는 것과 다르다** — 키만 비면 ClickHouse 복원으로 200을 낸다(원본 data_flow.md §5 · §12.2 · 원본 architecture.md §17). 설비 가동 상태(ctl:plant:power)를 읽거나 바꾸지 못할 때 · HMI 개요가 rt:latest를 읽지 못할 때도 이 코드다(REQ-RLT-19 · 20 — 모르는 가동 상태를 기동 기본값으로 덮어 답하지 않는다) | [../07_api/06_realtime.md](../07_api/06_realtime.md) #1 · #2 · #3 · #4 · #5 · [../07_api/09_datagen.md](../07_api/09_datagen.md) #2(직접 비교 넣기 · 무결성이 가동 상태를 읽지 못할 때) | 백오프 후 다시 요청한다. 대신 시계열 조회 표면을 호출하지 않는다 |

- **B형 — 최신값 API는 Redis가 죽으면 ClickHouse로 우회하지 않고 실패한다.** 우회하면 대시보드의 초당 수백 회 점조회가 전부 ClickHouse로 쏟아져, 대량 스캔용 엔진이 점조회로 과부하에 걸리고 적재 삽입까지 밀린다. 따라서 이 503은 결함이 아니라 적재 경로를 지키는 차단기이며, 클라이언트도 같은 이유로 시계열 조회로 대체 호출하지 않는다.

### datagen — 라이브 실행

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **datagen.run_in_progress** | 409 | 라이브 실행 시작 요청(09_datagen #2) 때 다른 실행이 진행 중(running · stopping)이다 — 실행은 한 번에 하나다(REQ-GEN-16 · 사용자 요구 2026-09-28). details {runId, type}이 진행 중 실행을 가리킨다 | [../07_api/09_datagen.md](../07_api/09_datagen.md) | details.runId로 실행을 읽어 패널을 맞추고 그 실행이 끝난 뒤 다시 시작한다. 같은 요청의 즉시 재시도 금지 |
| **datagen.compare_no_data** | 409 | 직접 비교 조회 대결(compare part query) 시작 요청 때 비교할 데이터가 없다 — 마지막 넣기(ingest — 상태 무관)가 run_result에 없거나(reason no_ingest) · 중단 · 실패로 끝났거나(ingest_incomplete — 시작하자마자 사흘 창을 비웠으므로 앞의 완료 구간도 쓰지 않는다) · 그 구간에 ClickHouse · PostgreSQL 중 하나라도 행이 없다(no_rows — 지우기 뒤 · 보존 7일 경과). details {part, reason, range 또는 null}. 시작 전 확인이라 실행 객체를 만들지 않는다(REQ-GEN-22 · D-16) | [../07_api/09_datagen.md](../07_api/09_datagen.md) #2 | 넣기를 끝까지 돌린 뒤 다시 시작한다. 같은 요청의 즉시 재시도 금지 |

- **run_in_progress가 409인 이유** — 요청 형식은 옳고(400 아님) 대상도 있으며(404 아님) 의존 저장소도 살아 있다(503 아님). 충돌하는 것은 **현재 실행 상태**다 — HTTP 상태 규약의 409 "현재 저장 상태와 충돌한다"의 저장 상태 자리에 api 메모리의 실행 상태가 온다. 503으로 내면 화면이 백오프 재시도를 돌려 앞 실행이 끝나는 순간 의도하지 않은 실행이 시작된다.
- **compare_no_data가 404가 아닌 이유** — 경로의 식별자가 가리키는 대상이 없는 것이 아니라 **저장 상태(넣은 비교 데이터)가 요청과 맞지 않는다.** 404로 내면 화면이 "실행이 없다"로 읽고 실행 목록을 다시 읽는다 — 할 일은 넣기를 먼저 돌리는 것이다. 무결성(integrity)은 자기 시험 창에 직접 싣고 지우므로 넣기 없이도 돌아 이 코드를 내지 않는다.

### data — 센서 데이터 지우기

| 코드 | HTTP | 발생 조건 | 발생 표면 | 클라이언트 대응 |
|------|:----:|----------|----------|---------------|
| **data.purge_blocked** | 409 | 센서 데이터 지우기(09_datagen #8) 요청 때 지우는 동안 새 행이 들어올 길이 열려 있다 — 들어오면 지운 뒤 행 수가 0이 아니다. details.reason 3값을 이 순서로 하나만 낸다 — run_in_progress(라이브 실행 running · stopping) · plant_running(설비 가동 원하는 상태 켜짐 · 켜는 중 · 수집기가 아직 도는 중 — 가동 상태를 읽지 못하면 켜진 것으로 본다) · stream_backlog(stream:plc:raw 적체 lag + pending > 0 — 읽지 못하면 막지 않는다). REQ-GEN-24 · D-16 결정 5 | [../07_api/09_datagen.md](../07_api/09_datagen.md) #8 | run_in_progress면 실행이 끝난 뒤 · plant_running이면 설비 가동을 끄고 잠시 뒤(06_realtime #4) · stream_backlog면 잠시 뒤 다시 요청한다 |

- **reason을 코드로 가르지 않는 이유** — 두 막힘의 대응 축(앞선 상태를 멈추고 다시)이 같아 HTTP 상태 규약대로 한 코드로 묶는다. 무엇을 멈출지는 details.reason이 가르고 화면 문구는 reason마다 다르다.

## 종수 산정 기준

**전수는 12종 · 네임스페이스 7(정의) · 6(코드 보유)**다. 세는 자리는 이 절 하나이며 다른 절은 이 수를 다시 세지 않는다.

| 산출 축 | 내역 | 합 |
|--------|------|:--:|
| 네임스페이스별 | common 4 · master 2 · timeseries 2 · realtime 1 · datagen 2 · data 1 · metrics 0 | 4 + 2 + 2 + 1 + 2 + 1 = **12** |
| HTTP 상태별 | 400 2(validation_failed · too_many_tags) · 404 1(not_found) · 409 6(duplicate_key · scale_change_forbidden · reissue_source_inactive · run_in_progress · compare_no_data · purge_blocked) · 503 3(postgres_unavailable · clickhouse_unavailable · latest_unavailable) | 2 + 1 + 6 + 3 = **12** |
| 네임스페이스 정의 | 표면 있는 도메인 5(master · timeseries · realtime · datagen · metrics) + common 1 + 예외 1(data — §네임스페이스 배정 규칙 A형) | 5 + 1 + 1 = **7** |
| 코드 보유 네임스페이스 | common · master · timeseries · realtime · datagen · data — metrics만 0 | **6** |

- **세는 대상은 유효 코드뿐이다.** 폐기 코드는 §폐지 코드에 폐지 행으로 두고 전수에서 빼며, 채번 보류 후보는 코드가 아니므로 세지 않는다.
- 두 축의 합이 같아야 한다. 한쪽만 고치면 이 표에서 즉시 어긋난다 — 코드를 신설하면 네임스페이스 열과 HTTP 열을 같은 변경 단위에서 고친다.
- 이 수치는 [../README.md](../README.md) 고정 기준과 [README.md](./README.md) 고정 기준(축약)에 행으로 올린다(리드 소유).

## 폐지 코드

D-16(사용자 결정 2026-10-11 — 알람 · 로그인 · 권한 · 감사 기록 · 작업지시 · 측정 도구 삭제 · 리드 판정 WRK 함께 폐지)으로 발생 표면이 사라진 코드다. **재사용하지 않는다** — 같은 이름을 다른 뜻으로 다시 쓰면 옛 기록 · 로그의 코드가 다른 실패를 가리킨다. 전수에 세지 않는다.

| 코드 | HTTP | 옛 발생 조건 | 폐지 사유 |
|------|:----:|------|------|
| common.rate_limited | 429 | 사용자 · 토큰 기준 분당 한도 초과 | 레이트 리밋 삭제(사용자 계정 없음) |
| auth.invalid_credentials | 401 | 로그인 자격 증명 불일치 | 로그인 삭제 |
| auth.unauthenticated | 401 | 액세스 토큰 없음 · 형식 · 서명 불량 | 상동 |
| auth.token_expired | 401 | 액세스 토큰 수명 경과 | 상동 |
| auth.refresh_invalid | 401 | 리프레시 토큰 없음 | 상동 |
| auth.token_store_unavailable | 503 | Redis 불가로 리프레시 토큰 저장소에 닿지 못함 | 상동 |
| auth.forbidden | 403 | 역할이 표면 권한 밖 | 권한 삭제 |
| alarms.ack_not_allowed | 409 | 확인 불가 상태의 알람 확인 | 알람 삭제 |
| alarms.eval_store_unavailable | 503 | 판정 전수 조회 중 ClickHouse 불가 | 상동 |
| datagen.stream_full | 503 | 부하 주입 표면의 백프레셔 위험 거절 | 모드 C 부하 주입 표면 삭제(측정 도구) |
| datagen.bulk_disabled | 404 | 부하 주입 표면 비활성 | 상동 |
| work_orders.invalid_status_transition | 409 | 작업지시 status를 허용 전이 표 밖으로 바꾸려 함 | 작업지시 · 실적 삭제(WRK 폐지) |
| work_orders.production_log_not_allowed | 409 | IN_PROGRESS가 아닌 작업지시에 실적 기록 | 상동 |

- 검산: 폐지 = common 1 + auth 6 + alarms 2 + datagen 2 + work_orders 2 = **13** · 옛 전수 23 = D-16 정리 직후 현행 10 + 폐지 13(그 뒤 신설 2는 이 식에 들지 않는다 — 현행 수는 §종수 산정 기준)

## 에러 코드가 아닌 것

실패처럼 보이지만 코드를 주지 않는 동작이다. 코드를 주면 정상 동작이 오류로 계측된다.

| 동작 | 왜 코드가 아닌가 | 드러나는 자리 |
|------|----------------|-------------|
| 조회 캐시 계열의 Redis 실패 | 짧은 타임아웃 후 DB로 우회하는 degrade가 설계 동작이다. 응답은 200이고 지연만 늘어난다 | 캐시 히트율 · API 지연 메트릭 |
| maxPoints 초과 · 긴 범위의 원시 해상도 요청 | 서버가 해상도를 올리거나 LTTB로 줄인다. 거절이 아니라 보정이다(원본 architecture.md §11.1) | 응답 meta.interval · meta.downsampled |
| 캐시 스탬피드 락 획득 실패 | 대기 후 캐시를 다시 읽는다. 요청자는 실패를 보지 않는다 | 락 대기 메트릭 |
| 삽입 실패 → 재시도 → DLQ | 내부 모듈(ING)의 상태 전이다. 응답으로 나갈 곳이 없다 | 배치 재시도 상태 · dlq_count |
| Collector XADD 실패 → 스풀 | 내부 모듈(COL)의 백프레셔 전환이다 | spool_active · spool_bytes |
| MAXLEN 트리밍으로 미소비 엔트리 유실 | 오류를 내지 않는 조용한 유실이라 코드로 잡을 수 없다. **결함으로 계측**한다 | stream_trimmed_unacked |
| CORS 거절 | 브라우저가 응답을 막는 것이며 서버 코드가 도달하지 않는다 | 브라우저 콘솔 |
| WebSocket Host · Origin 거절 | HTTP 응답 봉투가 아니라 연결 종료로 표현한다. 종료 코드의 정본은 [../07_api/11_websocket.md](../07_api/11_websocket.md) | 연결 종료 |
| 라이브 실행의 실패(단계 예외 — 저장소 불가 · 디스크 부족) | 실행은 응답 뒤 비동기로 돈다 — 실패는 요청의 실패가 아니라 실행의 관찰값이다. run_failed 같은 코드를 만들면 조회 응답(200)과 실행 실패가 한 코드 체계에 섞인다 | 실행 객체 status failed · error {code: 원인의 기존 코드 또는 null, message}([../07_api/09_datagen.md](../07_api/09_datagen.md) §중단과 실패) · gen_runs_total{status} |
| 끝난 실행의 중단 요청 | 사용자가 원한 상태(더 돌지 않음)가 이미 참이다 — 자연 멱등 | 09_datagen #5 200 + 실행 객체 그대로 |
| 설계 밖 예외(500) | 결함이다. 코드를 주지 않는다 | 로그 · 에러율 메트릭 |

## 채번 보류의 처리 결과

W1이 원본에 실패 동작이 없어 보류한 후보 8건은 W2 요구사항이 전부 판정했다. **보류 중인 후보는 없다.** 새 후보가 생기면 이 절에 행을 더하고 결정 자리를 적는다.

| 후보 | 판정 | 결과 | 근거 |
|------|------|------|------|
| ClickHouse 접속 불가 시 시계열 조회 | 캐시 미스 거절 | **timeseries.clickhouse_unavailable/503 신설** | [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) REQ-TSQ-16 |
| Redis 접속 불가 시 로그인 · 리프레시 · 레이트 리밋 | 인증 저장소 쓰기는 거절 · 레이트 리밋은 통과 | auth.token_store_unavailable/503 신설 → **D-16 폐지** | 옛 REQ-AUT-14(결번) |
| 알람 ACK 불가 상태 | CLEARED · 이미 확인됨은 거절 · CLEARING은 허용 | alarms.ack_not_allowed/409 신설 → **D-16 폐지** | 옛 REQ-ALM-14(결번) |
| 태그 스케일 변경 PATCH | 거절 · 새 태그 발급은 별도 동작 | **master.scale_change_forbidden/409 신설** | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-07 |
| 비활성 계정 로그인 | 계정 존재 노출 방지 | auth.invalid_credentials 재사용 · 신설 없음 → **D-16 폐지** | 옛 REQ-AUT-02(결번) |
| 비활성 태그 조회 · 수정 | 200 + is_active false · 404는 마스터에 없는 식별자만 | 코드 없음 | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-08 |
| 헬스체크 실패 | 503 + 저장소별 상태 본문 · 에러 봉투를 쓰지 않는다 | 코드 없음 | [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) REQ-OBS-09 |
| 작업지시 상태 전이 위반 | 허용 전이 표 밖 거절 | work_orders.invalid_status_transition/409 신설 → **D-16 폐지** | 옛 REQ-WRK-04(결번) |

검산: 신설 5 + 재사용 1 + 코드 없음 2 = **8**(이력 — 그중 신설 3 · 재사용 1은 D-16으로 폐지)

W5 표면 판정이 낳은 실패 3건은 보류를 거치지 않고 표면 확정과 같은 변경 단위에서 채번했다 — master.reissue_source_inactive/409 · alarms.eval_store_unavailable/503(D-16 폐지) · work_orders.production_log_not_allowed/409(D-16 폐지). 라이브 실행 제어(사용자 요구 2026-09-28)가 낳은 실패 1건도 같은 방식이다 — datagen.run_in_progress/409. 직접 비교 · 센서 데이터 지우기(D-16 결정 2 · 5)가 낳은 실패 2건도 공용 계약 확정과 같은 변경 단위에서 채번했다 — datagen.compare_no_data/409 · data.purge_blocked/409. 직접 비교의 넣기 · 무결성을 SW-09 off에서 시작하는 실패는 새 코드 없이 common.validation_failed/400(fields path SW-09 · reason enum)이다 — 대응이 "설정을 고친다"라 형식 오류와 같다.

## 관련 문서

- [../07_api/02_errors.md](../07_api/02_errors.md) — 미러
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — 응답 봉투 · 헤더 규약
- [04_id_conventions.md](./04_id_conventions.md) — 에러 코드 형식 · 도메인 접두와 네임스페이스 파생
- [03_enums_state_machines.md](./03_enums_state_machines.md) — 상태 전이와 전이 위반
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계 · 장애 시나리오
