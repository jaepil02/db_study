# 에러 코드 미러 (02_errors)

> **대상**: 에러 코드 정본의 **미러** — 코드 12종이 어느 표면(문서 #N)에서 나는가 · 표면 밖 실패 표현(헬스 503 · 스트림 중단 · WebSocket 종료 코드)의 자리 · W5 표면 판정이 낳아 정본이 채번한 코드 3종의 이력
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(정본 11_glossary/02 뒤따름) — common.validation_failed 비고에 path plant · purge · header.content-type(JSON 본문 계약 as-built — 코드 반영 대기 문구 삭제) · 발생 표면 그대로 · realtime.latest_unavailable 발생 표면 06_realtime #1~#5 → **+ 09_datagen #2** · datagen.compare_no_data details {part, range} → **{part, reason, range}** · data.purge_blocked reason 2 → **3**(stream_backlog) — 미러 행 수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 설비 가동 · HMI 개요 · 센서 데이터 지우기 반영**(정본 11_glossary/02 뒤따름) — **datagen.compare_no_data/409**(09_datagen #2) · **data.purge_blocked/409**(09_datagen #8) 발생 표면 등재 · common.validation_failed에 06_realtime #4 · 09_datagen #6 · #8(#8은 REQ-GLB-27 JSON 본문 계약 — 코드 반영 대기) · common.postgres_unavailable에 06_realtime #5 · realtime.latest_unavailable에 06_realtime #3 · #4 · #5 — 미러 코드 10 → **12종** · 네임스페이스 표 data 행
> **개정일**: 2026-10-11 — **D-16 정본 폐지 반영**(사용자 결정 2026-10-11 · 정본 11_glossary/02 §폐지 코드) — 미러 행 23 → **12**(auth 6 · alarms 2 · datagen.stream_full · bulk_disabled · common.rate_limited 삭제) · 발생 표면에서 03_auth · 07_alarms · 09_datagen #1 · 인가 단계 삭제 · WebSocket 종료 코드 4401 삭제 · 미러 대조 재계산 — 미러에서의 신설 · 개명 · 폐기 0 · (정본 뒤따름 · 리드 판정 — WRK 함께 폐지) 미러 행 12 → **10**(work_orders 2 삭제) · 발생 표면에서 08_work_orders 삭제 · 인증 표면 공통 4종 단락 삭제(D-16 누락분) · W5 이력 표에 work_orders 폐지 표기 · 관련 문서의 권한 매트릭스(삭제) 줄 삭제
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(정본 11_glossary/02 뒤따름 · 사용자 요구 2026-09-28) — **datagen.run_in_progress/409** 발생 표면 09_datagen #2 등재 · common.validation_failed에 09_datagen #2 · #4 · #5 · common.not_found에 09_datagen #4 · #5 — 코드 22 → **23종** 미러 · **미러 신설 0**
> **개정일**: 2026-09-27 — D-04 부분 개정 반영(사용자 결정 — 업무 쓰기도 Redis를 거친다 · 동기 응답) — 업무 쓰기 경로 반영 — 발생 표면에 명령 조회 01_conventions #1 추가(validation_failed · not_found · postgres_unavailable) · Idempotency-Key 형식 위반 · 업무 쓰기 Redis 불가를 common.postgres_unavailable 재사용으로 표기 — **코드 수 불변 · 미러 신설 0**
> **개정일**: 2026-09-26 — W1 검수 반영(정본 11_glossary/02 뒤따름) — auth.unauthenticated · auth.forbidden 발생 표면에 인증 전(S7 ①) 알람 확인 조건 추가 · 인증 표면 S7 → **S7 ②** — 코드 수 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 미러 발생 위치에 Host 헤더 거절 추가(정본 11_glossary/02 반영)
> **개정일**: 2026-09-24 — W5 판정 반영 — 코드 19 → **22종** 미러(master.reissue_source_inactive · alarms.eval_store_unavailable · work_orders.production_log_not_allowed 발생 표면 등재) · 채번 제안 절을 정본 채번 이력으로 전환 · 문구 보강 3건 반영 표기
> **원천**: [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(채번 정본 — 코드 · HTTP · 발생 조건 · 클라이언트 대응) · [01_conventions.md](./01_conventions.md) 에러 봉투 · API 문서의 표면 요약 표 · 원본 architecture.md §11 · §11.1 · §11.2(커밋 ff66a37)

이 문서는 **미러**다. 코드를 신설 · 개명 · 폐기하지 않는다 — 에러 코드를 새로 만들 수 있는 자리는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 하나뿐이다. 미러가 정본보다 먼저 바뀌면 표면 문서가 존재하지 않는 코드를 인용하게 된다. 발생 조건 · 클라이언트 대응은 정본이 갖고, 이 문서는 **발생 표면**만 더한다.

미러의 코드 집합은 정본과 같아야 한다. 같지 않으면 정본이 이긴다. 표면 판정 중 정본에 맞는 코드가 없는 실패가 셋 나왔고, 이 문서는 채번하지 않고 제안으로 넘겼으며 정본이 같은 날 채번했다 — §W5 판정이 낳은 코드.

## 봉투와 상태

응답 모양의 정본은 [01_conventions.md](./01_conventions.md) §에러 봉투다. 요약만 둔다.

| 항목 | 규칙 |
|------|------|
| 본문 | error.code · error.message · error.details(선택 · code별 모양 고정) |
| 분기 | 클라이언트는 code로만 분기한다 — message는 사람용 |
| 상태 | 한 code는 한 HTTP 상태 — 정본 HTTP 상태 규약 |
| 500 | code 없음 — 결함이다 |
| 봉투 밖 | 헬스 503(정상 본문 모양) · 다운로드 스트림 도중 중단 · WebSocket 종료 코드 |

- 검산: 항목 = **5**

## 표면별 발생 위치

표기는 {문서} #N이다. 모든 표면이 무인증이라(D-16) 인증 · 인가 · 한도 단계에서 나는 코드는 없다.

### common — 횡단

| 코드 | HTTP | 발생 표면 | 미러 비고 |
|------|:--:|------|------|
| common.validation_failed | 400 | 01_conventions #1 · 04_master #2 · #3 · #4 · #5 · #7 · #9 · #10 · #11 · #12 · #13 · #14 · #15 · #17 · 05_timeseries #1 · #2 · 06_realtime #4 · 09_datagen #2 · #4 · #5 · #6 · #8 | 09_datagen #2는 직접 비교 넣기 · 무결성을 SW-09 off · 설비 가동 켜짐에서 시작할 때(fields path SW-09 · plant · reason enum) · 09_datagen #2 · 06_realtime #4는 센서 데이터를 지우는 동안의 실행 시작 · 설비 켜기(path purge)도 여기다 · 06_realtime #4 · 09_datagen #2 · #5 · #8의 Content-Type 위반 · 본문 형식 위반은 상태를 바꾸는 POST의 JSON 본문 계약(REQ-GLB-27 · path header.content-type · body)이다 · Idempotency-Key 헤더 형식 위반(업무 쓰기 표면 · path header.idempotency-key · reason format)도 여기다 · Host 헤더가 허용 목록 밖(전 표면 · WebSocket 핸드셰이크 포함 — path header.host · reason enum) · 쓰기 본문의 참조 대상 없음(reason reference)도 여기다 — [01_conventions.md](./01_conventions.md) §요청 검증과 성공 본문 |
| common.not_found | 404 | 01_conventions #1(행위자 불일치) · 04_master #2 · #3 · #5 · #6 · #7 · #8 · #10 · #13 · #15 · #16 · #17 · 06_realtime #1 · #2 · 09_datagen #4 · #5 | 경로 식별자 · 조회 필터의 대상 없음만 · rt:latest 빈 키는 여기가 아니다 · 09_datagen은 api 메모리에 없는 runId(옛 실행 · 재기동 전 실행) |
| common.duplicate_key | 409 | 04_master #4 · #5 · #7 · #9 · #10 · #12 · #13 · #14 · #15 | tag_code · site_code · (site_id, line_code) · device_code UNIQUE — 정본 발생 조건 W5 보강 반영 |
| common.postgres_unavailable | 503 | 01_conventions #1 · 04_master #1~#17 · 06_realtime #2 · #5 | 정본 발생 표면 W5 보강 반영 · **업무 쓰기 표면의 Redis 불가(SW-12 stream — 명령을 싣지 못함)도 이 코드다**(재사용 판정 [01_conventions.md](./01_conventions.md) §업무 쓰기 경로 · 정본 발생 조건 반영 완료) |

- 검산: common = **4**

### 도메인 네임스페이스

| 코드 | HTTP | 발생 표면 | 미러 비고 |
|------|:--:|------|------|
| master.scale_change_forbidden | 409 | 04_master #5 | 새 태그 발급은 04_master #7 |
| **master.reissue_source_inactive** | 409 | 04_master #7 | 원천 태그가 이미 비활성 — W5 신설 |
| timeseries.clickhouse_unavailable | 503 | 05_timeseries #1 · #2 | #2는 응답 시작 전만 — 도중 중단은 전송 계층 종료 |
| timeseries.too_many_tags | 400 | 05_timeseries #1 · #2 | details(limit · received) |
| realtime.latest_unavailable | 503 | 06_realtime #1 · #2 · #3 · #4 · #5 · 09_datagen #2 | WebSocket의 Redis 불가는 4503 · 06_realtime #3 · #4와 09_datagen #2(직접 비교 넣기 · 무결성의 가동 확인)는 설비 가동 키(ctl:plant:power) · #5는 rt:latest 파이프라인 |
| **datagen.run_in_progress** | 409 | 09_datagen #2 | details {runId, type} — 진행 중 실행 · 라이브 실행 제어 신설(2026-09-28) |
| **datagen.compare_no_data** | 409 | 09_datagen #2 | details {part, reason no_ingest · ingest_incomplete · no_rows, range} — 직접 비교 조회 대결의 시작 전 확인 · 실행 객체를 만들지 않는다(D-16) |
| **data.purge_blocked** | 409 | 09_datagen #8 | details.reason run_in_progress · plant_running · stream_backlog — 네임스페이스 data는 정본의 기록된 예외(D-16) |

- 검산: 도메인 네임스페이스 = master 2 + timeseries 2 + realtime 1 + datagen 2 + data 1 = **8** · metrics 0

## 미러 대조

정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §종수 산정 기준의 두 축을 이 문서의 행으로 다시 센다.

| 축 | 이 문서의 행 | 합 | 정본 |
|------|------|:--:|:--:|
| 네임스페이스별 | common 4 · master 2 · timeseries 2 · realtime 1 · datagen 2 · data 1 · metrics 0 | 4 + 2 + 2 + 1 + 2 + 1 = **12** | 12 |
| HTTP 상태별 | 400 2 · 404 1 · 409 6 · 503 3 | 2 + 1 + 6 + 3 = **12** | 12 |

- 검산: 미러 행 = 정본 코드 = **12** · 미러에서의 신설 0 · 개명 0 · 폐기 0 — 폐지 13(auth 6 · alarms 2 · datagen 2 · work_orders 2 · common.rate_limited)은 정본 §폐지 코드가 먼저 폐지했다(D-16)
- **발생 표면이 0인 코드가 없다.** 현행 코드 모두 표면 하나 이상에 앉는다 — 유령 코드가 없다. 반대로 표면 요약 표의 에러 코드 열에 정본 밖 코드가 없다(API 문서 7본 대조).
- 표면 있는 네임스페이스 중 코드가 0인 것은 metrics 하나다 — 헬스의 부분 실패가 코드 없는 503으로 판정됐다(REQ-OBS-09).

## 에러 코드가 아닌 실패 표현

정본 "에러 코드가 아닌 것" 표 중 표면에 드러나는 셋의 자리다.

| 표현 | 표면 | 모양의 정본 |
|------|------|------|
| 헬스 부분 실패 503 | 10_metrics #1 | [10_metrics.md](./10_metrics.md) §부분 실패 판정 — 봉투 대신 저장소별 상태 본문 |
| 다운로드 스트림 도중 중단 | 05_timeseries #2 | [05_timeseries.md](./05_timeseries.md) §내보내기 스트림 중단 종료 표지 판정 — 종결 청크 없는 종료 |
| WebSocket Origin · 연결 관리 거절 | 11_websocket #1 | [11_websocket.md](./11_websocket.md) §종료 코드 — 4400 · 4403 · 4408 · 4413 · 4503 |

- 검산: 표현 = **3**
- **종료 코드는 에러 코드 체계 밖이다.** {domain}.{snake_case}를 붙이지 않고 코드 종수에 넣지 않는다 — 넣으면 HTTP 상태 축의 검산이 깨지고, 응답 봉투가 없는 채널에 봉투 규약이 적용되는 것처럼 읽힌다.

## W5 판정이 낳은 코드

W5 표면 판정에서 정본에 맞는 코드가 없는 실패가 셋 나왔다. 이 문서는 제안만 했고 **정본이 채번했다**([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 2026-09-24 개정).

| 코드 | HTTP | 표면 | 기존 코드를 쓰지 않은 이유 |
|------|:--:|------|------|
| master.reissue_source_inactive | 409 | 04_master #7 | scale_change_forbidden의 대응은 "새 태그 발급으로 다시 요청"이라 이 실패의 대응(현재 활성 후속 태그에서 발급)과 반대다 |
| alarms.eval_store_unavailable(D-16 폐지) | 503 | 07_alarms #6(결번) | timeseries.clickhouse_unavailable은 TSQ 표면 소유라 네임스페이스 배정 규칙(표면 소유 도메인)에 어긋난다 |
| work_orders.production_log_not_allowed(D-16 폐지) | 409 | 08_work_orders #7(삭제) | invalid_status_transition은 상태 전이 요청의 코드다 — 실적 기록은 전이가 아니다 |

- 검산: W5 신설 = 409 2 + 503 1 = **3**(이력 — 503 1 · 409 1은 D-16 폐지)
- 정본 문구 보강 3건(common.duplicate_key 대상 컬럼 · common.postgres_unavailable 인가 단계 · invalid_status_transition의 fromStatus 경합)도 같은 개정에서 반영됐다 — 보강은 코드 수를 바꾸지 않았다.

## 관련 문서

- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 채번 정본
- [01_conventions.md](./01_conventions.md) — 에러 봉투 · details 모양
- [11_websocket.md](./11_websocket.md) — 종료 코드 정본
- [10_metrics.md](./10_metrics.md) — 헬스 부분 실패
