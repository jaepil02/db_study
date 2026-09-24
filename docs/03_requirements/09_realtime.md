# REQ-RLT — 실시간 요구사항

> **대상**: 실시간(RLT)의 동작 계약 — 최신값 읽기 · STALE 판정 · 메타 부착 · 빈 키 복원과 Redis 불가 503의 구분 · SW-02 읽기 포트 교체 · WebSocket 연결과 인증 · 스로틀 병합 · 연결 관리 · 재연결 동기화 · 알람 푸시 · 무효화 신호 중계 · ClickHouse 중단 중 최신값 정지의 표시 — REQ-RLT-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — Pub/Sub 출력 버퍼 한도의 값 소유 09_tech_stack/03 확정 · 계약(게이트웨이 소켓 한도보다 늦게 끊는다) · 값은 S4
> **개정일**: 2026-09-24 — W5 판정 반영 — REQ-RLT-12 느린 구독자 절단을 둘로 가름 — 브라우저 단위 소켓 송신 대기량 한도(4413) · Redis 출력 버퍼 한도는 api 구독 연결 보호의 최후선 · 조정값 7 → **8** — REQ 수 불변
> **개정일**: 2026-09-24 — W4 판정 반영 — 무효화 체인 단 번호를 6단 정본(07_business_crud · ADR-12)에 맞춤(⑤단 → ⑥단)
> **원천**: 원본 data_flow.md §5 · §7.2 · §9 · §9.1 · §9.2 · §12.2 · §12.4 · §15 · §17(커밋 ff66a37) · 원본 architecture.md §8.1 · §8.2 · §10.1 · §11 · §11.2 · §17 · §18(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S6 · §7.2 · §7.4 · §7.5(커밋 ff66a37) · D-06 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-01~09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-02 · SW-06 · SW-07 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) STALE 판정 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) realtime.latest_unavailable

이 문서는 **"지금 값"을 ClickHouse에 닿지 않고 돌려주는 계약**을 고정한다. 기능의 존재와 경계는 [../02_features/08_realtime.md](../02_features/08_realtime.md)가, F-03 · F-07 기전은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)가 갖는다. RLT는 저장 객체가 없어 모든 계약이 "무엇을 읽고, 무엇을 읽지 않는가"로 선다.

**RLT의 핵심 계약은 같은 "값이 없다"를 두 갈래로 가르는 것이다.** Redis가 살아 있고 키만 비면 ClickHouse에서 설비당 1회 복원해 200을 내고, Redis에 접속할 수 없으면 복원하지 않고 503을 낸다. 두 갈래를 섞으면 Redis 장애 한 번이 대시보드의 초당 수백 회 점조회를 ClickHouse로 쏟아 적재 삽입까지 밀어낸다(원본 data_flow.md §5 · §12.2). 이 503은 결함이 아니라 적재 경로를 지키는 차단기이며, 전역 실패 전략의 정본은 [01_global_rules.md](./01_global_rules.md)다.

**Pub/Sub은 전달을 보장하지 않는다.** 그래서 WebSocket 계약은 "모든 변화를 전한다"가 아니라 "놓친 것을 REST 1회로 메운다"로 선다. 저장은 언제나 별도 경로(ClickHouse · PostgreSQL)이며 RLT는 어떤 메시지도 저장하지 않는다.

## 요구사항 — 최신값 REST

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-RLT-01** | 설비 전체 최신값은 rt:latest:{device_id}의 HGETALL **1회**로 읽고 "ts,value,quality" 값을 파싱해 응답한다. SW-02 on에서 이 요청은 ClickHouse에 도달하지 않는다 | 원본 data_flow.md §5 · 원본 architecture.md §11 · RLT-01 | 태그별 HGET을 반복하면 태그 수만큼 Redis 왕복이 생겨 단일 스레드 Redis의 ops/s가 대시보드 수에 곱으로 늘어난다 · ClickHouse에 닿으면 점조회에 약한 엔진이 적재와 CPU를 다툰다 | 최신값 폴링 부하 중 ClickHouse 쿼리 로그의 argMax 점조회 0건 · Redis 명령 통계의 요청당 HGETALL 1회 | RLT-01 | F-03 | 해당 없음 |
| **REQ-RLT-02** | 단일 태그 최신값은 태그 → 설비 해석을 cache:tagmeta로 먼저 하고 해당 설비 Hash의 필드 하나를 읽는다. cache:tagmeta 미스 · 실패는 캐시 계열 degrade로 PostgreSQL에서 해석한다 | 원본 architecture.md §8.2 · §11 · RLT-02 | 태그 → 설비 해석 없이 전 설비 Hash를 훑으면 설비 수에 비례한 왕복이 생긴다 · 메타 캐시 실패를 에러로 올리면 캐시 계열 장애가 최신값 실패로 번진다 | 태그 1건 조회 → Redis 명령 통계 대조 · cache:tagmeta 삭제 후 조회 → 200 | RLT-02 | F-03 | 해당 없음 |
| **REQ-RLT-03** | 응답 직전에 현재(api 서버 시계) − ts가 태그의 scan_rate_ms × 배수를 넘으면 해당 값의 품질을 STALE(5)로 바꿔 경고한다. **ingested_at으로 판정하지 않고 저장값을 바꾸지 않는다** | 원본 data_flow.md §5 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) STALE 판정 · RLT-03 | ingested_at으로 판정하면 백프레셔로 늦게 적재된 값이 "방금 갱신"으로 보여 멈춘 설비를 살아 있는 것으로 표시한다 · 저장값을 바꾸면 다음 갱신 전까지 복원 경로가 STALE을 진실로 퍼뜨린다 | 수집 정지 후 scan_rate_ms × 배수 경과 → 응답 품질 5 · rt:latest 원문 품질은 그대로 | RLT-03 | F-03 | 해당 없음 |
| **REQ-RLT-04** | 태그명 · 단위는 cache:tagmeta에서 붙인다. rt:latest 값에 메타를 싣지 않는다 | 원본 data_flow.md §5 · RLT-03 | 값에 메타를 실으면 태그명 변경이 설비 전 Hash의 재기록이 되고, 무효화 체인(MST-08)이 rt:latest까지 지워야 해 봉인 계열이 캐시 무효화 대상이 된다 | rt:latest 값 형식 대조(필드 3개) · 태그명 변경 후 첫 조회 → 새 이름 | RLT-03 | F-03 · F-05 | 해당 없음 |
| **REQ-RLT-05** | Redis가 정상이고 **키만 비어 있으면**(재시작 직후 복원 전 · 신규 설비) 설비 단위 lock:rebuild를 잡은 한 요청만 ClickHouse에서 최근 창의 태그별 argMax를 읽어 rt:latest에 워밍하고 200을 낸다. 워밍 쓰기는 봉인 계열 래퍼로 하며 TTL을 붙이지 않는다 | 원본 data_flow.md §5 · 원본 implementation_plan.md §7.5 · RLT-04 | 락이 없으면 재시작 직후 대시보드 전원이 같은 복원 쿼리를 동시에 보낸다 · 워밍에 TTL을 붙이면 rt:latest가 volatile-lru 축출 후보가 되어 메모리 압박 때 최신값이 조용히 사라진다 | redis 재시작(데이터 유지 없음) 후 동시 N건 요청 → ClickHouse 복원 쿼리 1건 · 워밍 키 TTL 없음 확인 | RLT-04 | F-03 | 해당 없음 |
| **REQ-RLT-06** | Redis에 **접속할 수 없으면** 복원 폴백을 타지 않고 503으로 응답한다. 서버는 ClickHouse 점조회로 대신 답하지 않고, 클라이언트는 시계열 조회 표면으로 대체 호출하지 않는다 | 원본 data_flow.md §5 · §12.2 · 원본 architecture.md §17 · RLT-04 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) | 폴백하면 초당 수백 회 점조회가 ClickHouse로 쏟아져 대량 스캔용 엔진이 과부하에 걸리고 적재 삽입까지 밀린다 — Redis 장애가 ClickHouse 장애로 번진다 | redis 컨테이너 정지 → 최신값 503 · 같은 구간 ClickHouse 쿼리 로그의 점조회 0건 | RLT-01 · RLT-02 · RLT-04 | F-03 · F-10 | realtime.latest_unavailable/503 |
| **REQ-RLT-07** | 설비 · 태그가 마스터에 없으면 404로 거절한다. **키가 비어 있다는 이유로 404를 내지 않는다** — 마스터에 있으면 REQ-RLT-05 복원을 탄다 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) common.not_found · RLT-01 · RLT-02 | 빈 키를 404로 내면 Redis 재시작 직후 모든 설비가 "없음"으로 보여 클라이언트가 설비 목록을 지운다 | 미등록 설비 id → 404 · 등록 설비의 키 삭제 후 → 200 | RLT-01 · RLT-02 | F-03 | common.not_found/404 |
| **REQ-RLT-08** | SW-02 off는 **읽기 포트만** ClickHouse argMax 점조회 구현으로 바꾼다. Ingest의 rt:latest 갱신과 ch:rt 발행은 그대로 둔다. off는 실험 전용이다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-02 판정 · 원본 implementation_plan.md §4.1 · D-06 | 갱신까지 끄면 WebSocket 경로와 Redis 메모리가 함께 바뀌어 on/off 차이가 점조회 비용 하나로 설명되지 않는다 | SW-02 off 기동 → 최신값 요청마다 ClickHouse 점조회 1건 · rt:latest 갱신 계속 · WebSocket 프레임 계속 | RLT-01 · RLT-02 | F-03 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-RLT-01~08 = **8**
- **REQ-RLT-06은 B형이다.** 결론 — Redis가 죽으면 최신값 API는 실패한다. 반대 시나리오 — 우회하면 Redis 장애 3분이 ClickHouse 과부하와 적재 지연으로 번져 무손실 복구 실험까지 오염된다. 파생 지침 — 클라이언트는 503에 백오프로만 대응한다.

## 요구사항 — 실시간 푸시

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-RLT-09** | /ws/realtime 연결은 첫 메시지로 토큰을 받아 인증하고 **URL에 토큰을 받지 않는다.** 핸드셰이크 Origin은 CORS 허용 목록과 같은 규칙으로 검증한다. 인증 · Origin 실패는 HTTP 코드가 아니라 연결 종료로 표현한다(S7 이후) | 원본 architecture.md §11.2 · §18 · 원본 data_flow.md §9 · RLT-05 · [02_auth.md](./02_auth.md) | URL 토큰은 접근 로그 · 브라우저 기록에 남아 액세스 토큰이 유출된다 · Origin을 보지 않으면 다른 오리진의 페이지가 로그인된 브라우저로 소켓을 연다 | 쿼리 파라미터 토큰 연결 → 거절 · 허용 밖 Origin → 종료 · 종료 코드 대조([../07_api/11_websocket.md](../07_api/11_websocket.md)) | RLT-05 | F-07 | 해당 없음 — 연결 종료 |
| **REQ-RLT-10** | 구독한 설비마다 ch:rt:{device_id}를 구독하고 소켓 ↔ 설비 매핑을 인스턴스 안 구독 레지스트리가 갖는다. 소켓이 닫히면 그 소켓의 매핑을 지우고, 구독자가 0이 된 채널은 구독을 해지한다 | 원본 data_flow.md §9 · RLT-05 · RLT-07 | 레지스트리를 정리하지 않으면 닫힌 소켓 몫의 채널 구독이 남아 Redis 출력 버퍼와 api 메모리가 연결 횟수에 비례해 새어 나간다 | 연결 · 구독 · 종료 N회 반복 → 활성 구독 채널 수가 열린 소켓의 구독 합과 일치 | RLT-05 · RLT-07 | F-07 | 해당 없음 |
| **REQ-RLT-11** | 스로틀 창 안에 들어온 같은 태그의 중간값을 버리고 최종값만 한 프레임으로 보낸다. 창 크기는 SW-07이며 0이면 병합 없이 매 갱신을 전송한다 | 원본 data_flow.md §9 · §9.1 · RLT-06 · SW-07 | 병합이 없으면 태그 500개 · 10 Hz에서 연결당 초당 수천 프레임이 나가 브라우저 탭이 멈추고 api 이벤트 루프가 팬아웃에 묶인다 | SW-07 기본값과 0에서 같은 부하 → 연결당 초당 프레임 수 · nodejs_eventloop_lag_p95_seconds 대조 | RLT-06 | F-07 | 해당 없음 |
| **REQ-RLT-12** | 주기 ping에 pong이 연속으로 정해진 횟수만큼 오지 않으면 소켓을 닫고 구독을 정리한다. 느린 브라우저는 게이트웨이의 **소켓 송신 대기량 한도**로 그 소켓만 절단한다(종료 코드 4413). Redis Pub/Sub 출력 버퍼 한도는 **api 구독 연결 보호의 최후선**이다 — 넘으면 인스턴스의 구독 연결이 끊겨 전원 푸시가 멈추므로(4503) 송신 대기량 한도가 먼저 걸리게 둔다(W5 판정) | 원본 data_flow.md §9 · §9.2 · RLT-07 · [../07_api/11_websocket.md](../07_api/11_websocket.md) | 죽은 소켓을 닫지 않으면 끊긴 클라이언트 몫의 프레임 생성이 계속된다 · 느린 브라우저를 출력 버퍼로 다루면 탭 하나의 지연이 인스턴스 전원의 푸시 중단이 된다 · 출력 버퍼 한도가 없으면 api가 채널을 못 따라갈 때 Redis 메모리를 채워 봉인 계열 쓰기(XADD)까지 OOM으로 막는다 | 클라이언트 pong 차단 → 정해진 주기 후 연결 종료 · 수신 지연 브라우저 → 그 소켓만 4413 · 다른 소켓 푸시 계속 · Redis client list의 출력 버퍼 상한 확인 | RLT-07 | F-07 | 해당 없음 |
| **REQ-RLT-13** | 클라이언트는 끊기면 지수 백오프(상한 있음)로 재연결하고 **재연결 직후 REST 최신값을 1회 읽어** 끊긴 동안의 공백을 메운다. 서버는 끊긴 동안의 메시지를 재전송하지 않는다 | 원본 data_flow.md §9 · §9.2 · RLT-07 · [14_acceptance_criteria.md](./14_acceptance_criteria.md) WebSocket 재연결 | 동기화가 없으면 재연결 전 마지막 값이 화면에 남아 끊긴 동안의 변화가 영영 보이지 않는다 · 백오프 상한이 없으면 api 재시작 동안 전 클라이언트가 재연결 폭주를 건다 | 연결 강제 종료 후 복구 → 재연결 간격이 지수로 증가 · 재연결 직후 REST 최신값 요청 1건 · 화면 값 = rt:latest | RLT-07 | F-07 · F-03 | 해당 없음 |
| **REQ-RLT-14** | ch:alarm을 구독해 알람 발생 · 해제 이벤트를 연결된 클라이언트에 브로드캐스트한다. **알람을 판정하지 않고 확인을 받지 않으며**, 전달 실패가 알람 확정에 영향을 주지 않는다 | 원본 data_flow.md §8 · §9.2 · RLT-08 · [10_alarms.md](./10_alarms.md) | 푸시 전달을 확정 조건으로 두면 구독자가 없는 순간의 알람이 확정되지 않는다 — Pub/Sub은 구독자 없는 메시지를 버린다 | 구독자 0에서 알람 발생 → alarm_event 행 생성 · 구독자 있을 때 → 발생 · 해제 프레임 수신 | RLT-08 | F-06 · F-07 | 해당 없음 |
| **REQ-RLT-15** | ch:cacheinv를 구독해 마스터 쓰기 뒤의 무효화 신호를 WebSocket으로 브라우저에 전달한다. 이 채널은 SW-06의 대상이 아니다 — SW-06 off에서도 구독을 유지한다 | 원본 implementation_plan.md §7.4 · RLT-09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-06 판정 | 신호가 브라우저에 닿지 않으면 무효화 체인이 BFF에서 끝나 브라우저 쿼리 캐시가 staleTime만큼 옛 값을 보여 캐시 정합성 인수 기준이 반드시 실패한다 · SW-06이 이 채널까지 끄면 정합성 계약이 스위치 상태에 따라 달라진다 | 태그명 변경 → 브라우저가 신호 수신 · 다음 조회에 새 이름 · SW-06 off에서 같은 결과 | RLT-09 | F-05 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-RLT-09~15 = **7**
- **REQ-RLT-13은 A형이다.** 통념은 "WebSocket이면 변화를 빠짐없이 받는다"이지만 Pub/Sub은 fire-and-forget이라 끊긴 동안의 값을 버린다. 진짜 축은 전달 보장이 아니라 **복구 수단**이며, 대체 경로는 재연결 직후의 REST 최신값 1회다.

## 요구사항 — 장애 표시 · 스위치 · 인가

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-RLT-16** | 최신값 갱신 주체가 Ingest인 동안 ClickHouse 중단은 rt:latest 갱신 정지로 이어지며, 그 정지는 REQ-RLT-03의 STALE로 드러나야 한다. 갱신 주체를 옮기는 결정은 S6 실측 전에 하지 않는다 | 원본 implementation_plan.md §7.2 · 원본 data_flow.md §12.3 · RLT-03 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) | STALE이 드러나지 않으면 ClickHouse 5분 중단 동안 대시보드가 마지막 값을 정상처럼 보여 운영자가 설비 이상을 놓친다 | clickhouse 정지 → scan_rate_ms × 배수 경과 후 전 태그 STALE · 복구 뒤 STALE 해제 | RLT-03 | F-03 · F-10 | 해당 없음 |
| **REQ-RLT-17** | SW-06 off는 발행자(Ingest · Alarm)가 게이트웨이를 직접 부르게 하며 **api 인스턴스가 하나일 때만** 쓴다. on/off 모두 같은 프레임 내용을 낸다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-06 · 조합 제약 #6 · 원본 data_flow.md §9 | 인스턴스가 둘인 구성에서 off로 돌리면 다른 인스턴스의 소켓이 값을 받지 못해 "팬아웃 경계 비용"이 아니라 누락이 측정된다 | SW-06 on/off 각각 같은 부하 → 프레임 내용 동일 · 발행 → 수신 지연 대조 | RLT-05 · RLT-08 | F-07 | 해당 없음 |
| **REQ-RLT-18** | S7 이후 최신값 REST와 WebSocket 구독은 역할이 1개 이상인 인증 사용자 전원에게 연다. S2~S6은 무인증이며 이 요구가 적용되지 않는다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) RLT · D-07 | 역할로 막으면 OPERATOR 대시보드가 최신값을 읽지 못한다 — 읽기 원칙(인증 사용자 전원)과 어긋난다 | 역할 1개 이상 사용자 → 200 · 역할 0 사용자 → 403 · 무토큰 → 401 | RLT-01 · RLT-02 · RLT-05 | F-03 · F-07 | auth.unauthenticated/401 · auth.forbidden/403 |

- 검산: 이 표의 REQ = REQ-RLT-16~18 = **3** · 문서 전체 REQ = 8 + 7 + 3 = **18**(REQ-RLT-01~18 · 결번 없음)
- **REQ-RLT-16은 B형이다.** ClickHouse가 멈췄는데 대시보드가 멈추는 것은 현행 설계의 알려진 결합이다. 결합을 끊는 안(Collector 갱신)은 S6에서 ClickHouse 중단 중 대시보드 생존으로 비교하며, 그 전까지 STALE이 유일한 신호다.

## 조회 계약 — 2계층 조정값

아래 값은 본문에 박지 않는다. 소유처가 미정인 값은 W5가 [../07_api/06_realtime.md](../07_api/06_realtime.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md)에서 고정한다.

| 조정값 | 읽는 자리 · 키 모양 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 · 소유처 |
|------|------|------|------|------|------|
| STALE 배수 | 응답 직전 판정 | api 서버 시계 | ingested_at 기준 판정 · 설비 단위 주기 | 기동 거부 | 3 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 복원 창 | ClickHouse argMax 조건 | 복원 요청 시 | 창 없는 전 기간 argMax | 기동 거부 | 10분 · 상동 |
| 복원 락 만료 | lock:rebuild:{device 단위 식별자} | 빈 키 감지 시 | 만료 없는 락 | 기동 거부 | 미정 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 스로틀 창 | SW-07 환경변수 | 기동 시 | 런타임 토글 | 기본 on 값 | 100 ms · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| ping 주기 · pong 미수신 허용 횟수 | 게이트웨이 | 연결마다 | 무기한 유지 | 기동 거부 | 30초 · 3회 · [../07_api/11_websocket.md](../07_api/11_websocket.md) |
| 재연결 백오프 시작 · 상한 | 클라이언트 | 끊김 시 | 고정 간격 재시도 | 클라이언트 기본 | 1초 → 최대 30초 · 상동 |
| 소켓 송신 대기량 한도 | 게이트웨이 | 소켓마다 · 프레임 송신 시 | 한도 없음 · 출력 버퍼로 대신 절단 | 기동 거부 | 미정 · [../07_api/11_websocket.md](../07_api/11_websocket.md) |
| Pub/Sub 출력 버퍼 한도 | Redis 설정 client-output-buffer-limit pubsub | api 구독 연결마다 | 한도 없음 | Redis 기본값(사용 금지) | 미정 — 값 소유 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(W6 판정) · 게이트웨이 소켓 송신 대기량 한도보다 늦게 끊는다 · S4에서 소켓 한도와 같은 변경 단위로 |

- 검산: 조정값 = STALE 배수 · 복원 창 · 복원 락 · 스로틀 창 · ping · 백오프 · 송신 대기량 · 출력 버퍼 = **8**
- **복원 락 키의 식별자 자리가 조회 캐시와 다르다.** 조회 캐시 락은 쿼리 해시 단위이고 복원 락은 설비 단위다 — 같은 lock:rebuild 접두를 쓰므로 키 모양의 정본([../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md))이 두 식별자 공간을 가른다.

## 스위치 계약

| 스위치 | 교체 대상 | on | off | 지키는 조건 | 요구 |
|------|------|------|------|------|------|
| SW-02 REDIS_LATEST_CACHE | 최신값 읽기 포트 | rt:latest HGETALL | ClickHouse argMax 점조회 | 갱신 · 발행은 그대로 | REQ-RLT-08 |
| SW-06 REDIS_PUBSUB_FANOUT | 팬아웃 포트(ch:rt · ch:alarm) | PUBLISH · SUBSCRIBE | 게이트웨이 직접 호출 | 단일 인스턴스 · ch:cacheinv 제외 | REQ-RLT-15 · 17 |
| SW-07 WS_THROTTLE_MS | 프레임 스로틀 포트 | 창 안 최종값만 | 0 — 매 갱신 전송 | 프레임 내용은 창과 무관하게 최종값이 같다 | REQ-RLT-11 |

- 검산: RLT가 받는 스위치 = SW-02 · SW-06 · SW-07 = **3**. 채번 · 포트 이름 · 원본 예상치의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)다.

## 실패 시 응답 전수

| 상황 | 응답 | 코드 또는 지표 | 요구 |
|------|------|------|------|
| Redis 접속 불가 | 최신값 503 · WebSocket 푸시 중단 | realtime.latest_unavailable/503 | REQ-RLT-06 |
| 키 없음(Redis 정상 · 설비 있음) | 200 · 복원 후 워밍 | 복원 쿼리 수 | REQ-RLT-05 |
| 설비 · 태그 없음 | 404 | common.not_found/404 | REQ-RLT-07 |
| ClickHouse 중단(현행 갱신 주체) | 200 · STALE 경고 | STALE 비율 | REQ-RLT-16 |
| 수집 정지 · 생성 모드의 과거 ts | 200 · STALE 경고 | STALE 비율 | REQ-RLT-03 |
| 느린 구독자 · pong 미수신 | 연결 종료 | 연결 수 · 종료 수 | REQ-RLT-12 |
| WebSocket 인증 · Origin 실패(S7 이후) | 연결 종료 | 종료 코드 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) | REQ-RLT-09 |
| 스로틀 창 0 | 프레임 폭증 | 초당 프레임 · nodejs_eventloop_lag_p95_seconds | REQ-RLT-11 |

- 검산: 상황 = **8** · HTTP 코드를 내는 행 2(latest_unavailable · not_found) + 코드 없는 행 6 = **8**

## 기능 → REQ 대응 검산

[../02_features/08_realtime.md](../02_features/08_realtime.md)의 기능 9개 전부가 적어도 하나의 REQ에 대응한다.

| 기능 ID | 기능명 | 대응 REQ |
|------|------|------|
| RLT-01 | 설비 전체 최신값 | REQ-RLT-01 · 06 · 07 · 08 · 18 |
| RLT-02 | 단일 태그 최신값 | REQ-RLT-02 · 06 · 07 · 08 · 18 |
| RLT-03 | STALE 판정 · 메타 부착 | REQ-RLT-03 · 04 · 16 |
| RLT-04 | 빈 키 복원과 503 | REQ-RLT-05 · 06 |
| RLT-05 | WebSocket 구독 | REQ-RLT-09 · 10 · 17 · 18 |
| RLT-06 | 스로틀 병합 | REQ-RLT-11 |
| RLT-07 | 연결 관리 · 재연결 동기화 | REQ-RLT-10 · 12 · 13 |
| RLT-08 | 알람 푸시 | REQ-RLT-14 · 17 |
| RLT-09 | 무효화 신호 중계 | REQ-RLT-15 |

- 검산: 기능 9 중 대응 REQ 있음 9 · 누락 0 = **9** · 기능에 대응하지 않는 REQ 0(유령 0). REQ 총수를 세는 자리는 §요구사항 — 장애 표시 · 스위치 · 인가의 검산 하나다

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.2 ClickHouse 중단 시 최신값 정지 | REQ-RLT-16 — STALE로 드러내고 갱신 주체 결정은 S6 실측 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) |
| 보정 7.4 브라우저가 무효화 체인에서 빠짐 | REQ-RLT-15 — ⑥단 중계 · SW-06 대상 제외 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 보정 7.5 TTL 강제 수단 | REQ-RLT-05 — 워밍은 봉인 계열 래퍼 · 복원 락은 캐시 계열 래퍼 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.1 · 7.3 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 최신값 조회 p95 · on/off 차이 | 원본 목표 10 ms 이하(4 vCPU 가정) · 원본 예상치 off 30~150 ms · on 0.3~1 ms | 미확인 — 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| Pub/Sub → WebSocket 도달 지연 · 동시 연결 수 | 원본 목표 150 ms · 500 연결 이상 | 미확인 — 확정 전 임의 값 고정 금지 | 상동 |
| 구독 방식 | 쿼리 파라미터(원본 architecture.md §11) 대 subscribe 메시지(원본 data_flow.md §9) | 신규 불일치(W2a 등재) | [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5) |
| 복원 창 안에 행이 없는 설비의 응답 | 원본에 없다 — 신규 설비의 첫 수집 전 | 미설계 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4) |
| cache:tagmeta 미스 + PostgreSQL 불가 시 최신값 응답 | 원본에 없다 — 값은 Redis에 있고 메타만 없는 상태 | 미설계 | 상동 |
| 최신값 갱신 주체 | 현행 Ingest · 대안 Collector | S6 실측 결정 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)(W3) |
| 조회 캐시 락과 복원 락의 키 모양 분리 | 둘 다 lock:rebuild 접두 | 미설계 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)(W3) |

## 관련 문서

- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT 기능 목록 · 경계
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — F-03 · F-07 기전
- [../07_api/06_realtime.md](../07_api/06_realtime.md) — 최신값 REST 표면
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — WebSocket 프로토콜 · 종료 코드
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — STALE 판정식
- [10_alarms.md](./10_alarms.md) — 알람 발행 계약
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 최신값 정확성 · WebSocket 재연결 인수 기준
