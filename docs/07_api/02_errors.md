# 에러 코드 미러 (02_errors)

> **대상**: 에러 코드 정본의 **미러** — 코드 22종이 어느 표면(문서 #N)에서 나는가 · 표면 밖 실패 표현(헬스 503 · 스트림 중단 · WebSocket 종료 코드)의 자리 · W5 표면 판정이 낳아 정본이 채번한 코드 3종의 이력
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 미러 발생 위치에 Host 헤더 거절 추가(정본 11_glossary/02 반영)
> **개정일**: 2026-09-24 — W5 판정 반영 — 코드 19 → **22종** 미러(master.reissue_source_inactive · alarms.eval_store_unavailable · work_orders.production_log_not_allowed 발생 표면 등재) · 채번 제안 절을 정본 채번 이력으로 전환 · 문구 보강 3건 반영 표기
> **원천**: [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(채번 정본 — 코드 · HTTP · 발생 조건 · 클라이언트 대응) · [01_conventions.md](./01_conventions.md) 에러 봉투 · 도메인 문서 8본의 표면 요약 표 · 원본 architecture.md §11 · §11.1 · §11.2(커밋 ff66a37)

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

표기는 {문서} #N이다. **인증 표면 공통 4종**(auth.unauthenticated · auth.token_expired · auth.forbidden · common.rate_limited)은 S7부터 인증 표면 전부에서 나므로 표면을 나열하지 않고 범위로 적는다 — 인증 표면 = 전 표면 − 공개 2(10_metrics #1 · #2) − 리프레시 쿠키 · 공개 3(03_auth #1~#3).

### common — 횡단

| 코드 | HTTP | 발생 표면 | 미러 비고 |
|------|:--:|------|------|
| common.validation_failed | 400 | 03_auth #1 · #2 · #3 · 04_master #2 · #3 · #4 · #5 · #7 · #9 · #10 · #11 · #12 · #13 · #14 · #15 · #17 · 05_timeseries #1 · #2 · 07_alarms #1 · #3 · #4 · #5 · #6 · 08_work_orders #1 · #2 · #3 · #5 · #6 · #7 · #8 · #9 · 09_datagen #1 | Host 헤더가 허용 목록 밖(전 표면 · WebSocket 핸드셰이크 포함 — path header.host · reason enum) · 쓰기 본문의 참조 대상 없음(reason reference)도 여기다 — [01_conventions.md](./01_conventions.md) §요청 검증과 성공 본문 |
| common.not_found | 404 | 04_master #2 · #3 · #5 · #6 · #7 · #8 · #10 · #13 · #15 · #16 · #17 · 06_realtime #1 · #2 · 07_alarms #2 · #5 · 08_work_orders #3 · #4 · #5 · #6 · #7 | 경로 식별자 · 조회 필터의 대상 없음만 · rt:latest 빈 키는 여기가 아니다 |
| common.duplicate_key | 409 | 04_master #4 · #5 · #7 · #9 · #10 · #12 · #13 · #14 · #15 · 08_work_orders #2 · #3 | tag_code · order_no · site_code · (site_id, line_code) · device_code UNIQUE — 정본 발생 조건 W5 보강 반영 |
| common.rate_limited | 429 | 인증 표면 전부(S7) — 공통 4종 | 등급별 한도 [01_conventions.md](./01_conventions.md) §한도 등급이 갈리는 표면 묶음 |
| common.postgres_unavailable | 503 | 03_auth #1 · 04_master #1~#17 · 06_realtime #2 · 07_alarms #1~#5 · 08_work_orders #1~#9 · **인가 단계(권한 캐시 미스 + PostgreSQL 불가) — 인증 표면 전부** | 인가 단계는 REQ-AUT-15 · 정본 발생 표면 W5 보강 반영 |

- 검산: common = **5**

### auth — 인증 · 인가

| 코드 | HTTP | 발생 표면 | 미러 비고 |
|------|:--:|------|------|
| auth.invalid_credentials | 401 | 03_auth #1 | 비활성 · 없는 계정도 같은 코드 · 같은 본문 |
| auth.unauthenticated | 401 | 인증 표면 전부(S7) — 공통 4종 | WebSocket은 4401 종료로 표현 |
| auth.token_expired | 401 | 인증 표면 전부(S7) — 공통 4종 | 상동 |
| auth.refresh_invalid | 401 | 03_auth #2 | 03_auth #3은 키가 없어도 204 — 이 코드를 내지 않는다 |
| auth.token_store_unavailable | 503 | 03_auth #1 · #2 · #3 | 레이트 리밋은 이 코드를 내지 않고 통과한다 |
| auth.forbidden | 403 | 인증 표면 전부(S7) — 공통 4종 · 역할 한정 표면은 역할 밖 사용자 · 전원 표면은 역할 0 사용자 | WebSocket은 4403 |

- 검산: auth = **6**

### 도메인 네임스페이스

| 코드 | HTTP | 발생 표면 | 미러 비고 |
|------|:--:|------|------|
| master.scale_change_forbidden | 409 | 04_master #5 | 새 태그 발급은 04_master #7 |
| **master.reissue_source_inactive** | 409 | 04_master #7 | 원천 태그가 이미 비활성 — W5 신설 |
| timeseries.clickhouse_unavailable | 503 | 05_timeseries #1 · #2 | #2는 응답 시작 전만 — 도중 중단은 전송 계층 종료 |
| timeseries.too_many_tags | 400 | 05_timeseries #1 · #2 | details(limit · received) |
| realtime.latest_unavailable | 503 | 06_realtime #1 · #2 | WebSocket의 Redis 불가는 4503 |
| alarms.ack_not_allowed | 409 | 07_alarms #2 | CLEARING 중인 열린 행은 허용 |
| **alarms.eval_store_unavailable** | 503 | 07_alarms #6 | 판정 이력 분석 중 ClickHouse 불가 — W5 신설 |
| work_orders.invalid_status_transition | 409 | 08_work_orders #5 | details.currentStatus · fromStatus 불일치도 여기(정본 발생 조건 W5 보강 반영) |
| **work_orders.production_log_not_allowed** | 409 | 08_work_orders #7 | 작업지시가 IN_PROGRESS가 아님 — W5 신설 |
| datagen.stream_full | 503 | 09_datagen #1 | details.acceptedEntries — 부분 수용 |
| datagen.bulk_disabled | 404 | 09_datagen #1 | 게이트 DATAGEN_BULK_ENABLED false |

- 검산: 도메인 네임스페이스 = master 2 + timeseries 2 + realtime 1 + alarms 2 + work_orders 2 + datagen 2 = **11** · metrics 0

## 미러 대조

정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §종수 산정 기준의 두 축을 이 문서의 행으로 다시 센다.

| 축 | 이 문서의 행 | 합 | 정본 |
|------|------|:--:|:--:|
| 네임스페이스별 | common 5 · auth 6 · master 2 · timeseries 2 · realtime 1 · alarms 2 · work_orders 2 · datagen 2 · metrics 0 | 5 + 6 + 2 + 2 + 1 + 2 + 2 + 2 = **22** | 22 |
| HTTP 상태별 | 400 2 · 401 4 · 403 1 · 404 2 · 409 6 · 429 1 · 503 6 | 2 + 4 + 1 + 2 + 6 + 1 + 6 = **22** | 22 |

- 검산: 미러 행 = 정본 코드 = **22** · 미러에서의 신설 0 · 개명 0 · 폐기 0
- **발생 표면이 0인 코드가 없다.** 22종 모두 표면 하나 이상에 앉는다 — 유령 코드가 없다. 반대로 표면 요약 표의 에러 코드 열에 정본 밖 코드가 없다(도메인 문서 8본 대조).
- 표면 있는 네임스페이스 중 코드가 0인 것은 metrics 하나다 — 헬스의 부분 실패가 코드 없는 503으로 판정됐다(REQ-OBS-09).

## 에러 코드가 아닌 실패 표현

정본 "에러 코드가 아닌 것" 표 중 표면에 드러나는 셋의 자리다.

| 표현 | 표면 | 모양의 정본 |
|------|------|------|
| 헬스 부분 실패 503 | 10_metrics #1 | [10_metrics.md](./10_metrics.md) §부분 실패 판정 — 봉투 대신 저장소별 상태 본문 |
| 다운로드 스트림 도중 중단 | 05_timeseries #2 | [05_timeseries.md](./05_timeseries.md) §내보내기 스트림 중단 종료 표지 판정 — 종결 청크 없는 종료 |
| WebSocket 인증 · Origin · 연결 관리 거절 | 11_websocket #1 | [11_websocket.md](./11_websocket.md) §종료 코드 — 4400 · 4401 · 4403 · 4408 · 4413 · 4503 |

- 검산: 표현 = **3**
- **종료 코드는 에러 코드 체계 밖이다.** {domain}.{snake_case}를 붙이지 않고 코드 종수에 넣지 않는다 — 넣으면 HTTP 상태 축의 검산이 깨지고, 응답 봉투가 없는 채널에 봉투 규약이 적용되는 것처럼 읽힌다.

## W5 판정이 낳은 코드

W5 표면 판정에서 정본에 맞는 코드가 없는 실패가 셋 나왔다. 이 문서는 제안만 했고 **정본이 채번했다**([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 2026-09-24 개정).

| 코드 | HTTP | 표면 | 기존 코드를 쓰지 않은 이유 |
|------|:--:|------|------|
| master.reissue_source_inactive | 409 | 04_master #7 | scale_change_forbidden의 대응은 "새 태그 발급으로 다시 요청"이라 이 실패의 대응(현재 활성 후속 태그에서 발급)과 반대다 |
| alarms.eval_store_unavailable | 503 | 07_alarms #6 | timeseries.clickhouse_unavailable은 TSQ 표면 소유라 네임스페이스 배정 규칙(표면 소유 도메인)에 어긋난다 |
| work_orders.production_log_not_allowed | 409 | 08_work_orders #7 | invalid_status_transition은 상태 전이 요청의 코드다 — 실적 기록은 전이가 아니다 |

- 검산: W5 신설 = 409 2 + 503 1 = **3**
- 정본 문구 보강 3건(common.duplicate_key 대상 컬럼 · common.postgres_unavailable 인가 단계 · invalid_status_transition의 fromStatus 경합)도 같은 개정에서 반영됐다 — 보강은 코드 수를 바꾸지 않았다.

## 관련 문서

- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 채번 정본
- [01_conventions.md](./01_conventions.md) — 에러 봉투 · details 모양
- [11_websocket.md](./11_websocket.md) — 종료 코드 정본
- [10_metrics.md](./10_metrics.md) — 헬스 부분 실패
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — auth.forbidden의 역할 판정
