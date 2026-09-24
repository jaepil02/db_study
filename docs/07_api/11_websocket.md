# WebSocket 프로토콜 (11_websocket)

> **대상**: /ws/realtime 한 표면의 프로토콜 — 핸드셰이크 Origin 검증 · 첫 메시지 인증 · **구독 방식 판정(쿼리 파라미터 대 subscribe 메시지)** · 메시지 봉투와 스키마 · 스로틀 병합(SW-07) · 알람 · 무효화 신호 중계 · ping · 재연결 · 종료 코드 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 핸드셰이크 Origin 검증 S7 → **S2**(인증 ②③만 S7) — 종료 코드 수 불변(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — §STALE과 푸시의 화면 판정 기준을 화면 시계 → **servedAt(서버 시계) 기준 + 화면 오프셋 보정**으로 정렬(06_realtime) — 표 행 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 느린 구독자 절단 불일치 → **닫힘**(REQ-RLT-12 · RLT-07 · 06_pipeline/05 반영 — 브라우저 단위 4413 · 출력 버퍼는 구독 연결 보호의 최후선) — 표면 · 종료 코드 수 불변
> **원천**: 원본 architecture.md §11 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §9 · §9.1 · §9.2(커밋 ff66a37) · REQ-RLT-09~15 · 17 · 18 · REQ-AUT-08 · 13 · ADR-07 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-05~09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-06 · SW-07 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §F-07 실시간 푸시 한 사이클 · §푸시 조정값 · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 봉인 계열 값과 채널 페이로드 · docs_plan.md 웨이브 인계 W5 07_api 행(구독 방식)

WebSocket은 **RLT가 소유하는 횡단 표면**이다. 설비 최신값 푸시(RLT-05 · 06 · 07), 알람 열림 · 닫힘 푸시(RLT-08), 마스터 무효화 신호 중계(RLT-09) 세 흐름이 한 연결을 나눠 쓴다. 발행 쪽은 Redis Pub/Sub 채널 셋(ch:rt:{device_id} · ch:alarm · ch:cacheinv)이고, 게이트웨이는 받은 것을 소켓에 옮길 뿐 판정하지 않는다(ADR-07).

**인증 · Origin 실패는 HTTP 코드가 아니라 종료 코드다**(REQ-RLT-09). 이 문서가 종료 코드의 정본이다 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)는 WebSocket 거절을 "에러 코드가 아닌 것"으로 두고 이 문서를 가리킨다. 종료 코드는 에러 코드 체계({domain}.{snake_case})의 밖이다.

**Pub/Sub은 전달을 보장하지 않는다.** 끊긴 동안의 프레임은 다시 오지 않고, 서버도 재전송하지 않는다. 공백은 재연결 직후 REST 최신값 1회가 메운다(REQ-RLT-13 · [06_realtime.md](./06_realtime.md) §재연결 동기화).

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | WS | /ws/realtime | RLT-05 · 06 · 07 · 08 · 09 | 전원 | 없음 — 채널 ch:rt:{device_id} · ch:alarm · ch:cacheinv 구독 | 없음 — 종료 코드(§종료 코드) | DSH-REALTIME · ALM-CONSOLE · 전 화면(무효화 신호) | 원본 |

- 검산: 표면 = WebSocket **1** · 원본 1 + 신설 0 = **1**
- **원본 경로의 쿼리 파라미터(?devices=1,2,3)는 버렸다** — §구독 방식 판정. 번호 · 경로는 그대로이고 구독 수단만 메시지로 옮겼다.
- 경로는 브라우저 → api 직결이다 — 장기 연결을 BFF가 중계하지 않는다([01_conventions.md](./01_conventions.md) §BFF 경유와 직결).

## 연결 한 번의 단계

원본 푸시 시퀀스(원본 data_flow.md §9)를 연결 한 번으로 옮긴다. 우측은 실패의 종료 코드다.

```plain
① 핸드셰이크     Origin 헤더 = CORS 허용 목록(http://localhost:3001)     아니면 업그레이드 뒤 즉시 4403
② 인증 대기      첫 메시지 auth(토큰) — 인증 대기 시간 안에                 시간 초과 · 다른 type · 토큰 불량 4401
③ 인증 성공      auth_ok(userId · expiresAt)                               역할 0 사용자 4403
④ 구독           subscribe(devices) → ch:rt:{device_id} SUBSCRIBE          형식 위반 4400 · 없는 설비는 거절 목록
⑤ 수신 · 병합    ch:rt → 스로틀 창 병합 → rt 프레임 · ch:alarm · ch:cacheinv → 즉시 중계
⑥ 연결 관리      서버 ping → 클라이언트 pong · 연속 미수신이면 종료            4408
⑦ 토큰 연장      만료 전 auth 재전송 → auth_ok · 만료 지나면 종료              4401
⑧ 종료 · 재연결  클라이언트 지수 백오프 → ①부터 → 구독 → REST 최신값 1회
```

- **①의 Origin 검증은 S2부터, ②③은 S7부터다.** 인증은 S7에 붙고(D-07) 그 전에는 연결 직후 subscribe가 첫 메시지다. Origin 검증은 토큰이 필요 없어 CORS와 같은 S2부터 건다(REQ-AUT-13 · W7 판정 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) §Origin 검증) — S7까지 미루면 S2~S6 내내 같은 머신 브라우저의 아무 페이지나 실시간 프레임을 받는다. S7부터는 ②가 끝나기 전의 subscribe를 4401로 끊는다.
- **Origin 실패를 업그레이드 거부(HTTP 403)가 아니라 종료 코드로 내는 이유** — 브라우저 WebSocket API는 핸드셰이크 HTTP 상태를 스크립트에 주지 않아 403과 네트워크 오류가 같은 1006으로 보인다. 업그레이드 뒤 4403으로 닫으면 클라이언트가 원인을 읽고 재연결을 멈춘다.
- ⑤의 병합은 ch:rt에만 걸린다 — ch:alarm · ch:cacheinv는 병합하지 않는다(§스로틀 병합).

## 구독 방식 판정

인계 "WebSocket 구독 방식(쿼리 파라미터 vs subscribe 메시지)"을 닫는다. 원본은 API 표가 쿼리 파라미터(원본 architecture.md §11), 흐름 시퀀스가 연결 뒤 subscribe 메시지(원본 data_flow.md §9)로 갈렸다. **판정 — subscribe 메시지다. 쿼리 파라미터 구독을 받지 않는다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 쿼리 파라미터 | 핸드셰이크 URL의 devices로 구독 확정 | **인증 전에 구독 레지스트리가 채워진다** — 첫 메시지 인증(REQ-RLT-09)과 합치면 토큰을 보내기 전 창에 이미 ch:rt가 구독돼 무인증 연결이 프레임을 받는다 · 설비를 바꾸려면 재연결해야 해 그 사이 프레임을 잃는다 | 버림 |
| ② 둘 다 받음 | URL이 초기 구독 · 메시지가 추가 · 해지 | 레지스트리 갱신 시점이 둘이라 "언제부터 구독됐나"가 경로마다 다르다 · 인증 전 창 문제는 ①과 같다 | 버림 |
| ③ **subscribe 메시지** | 인증 뒤 subscribe · unsubscribe 메시지로만 레지스트리 갱신 | 연결 직후 한 왕복이 더 든다 — 장기 연결에서 한 번뿐이다 | **채택** |

- 검산: 안 = **3**
- **레지스트리 갱신 시점이 하나로 고정된다** — 인증 성공 뒤의 subscribe 처리 순간이다. 기전 정본이 요구한 "구독 레지스트리의 갱신 시점"([../02_features/08_realtime.md](../02_features/08_realtime.md) 미확인 등재)이 이 판정으로 닫힌다.
- URL에 devices가 와도 무시하지 않고 **4400으로 닫는다** — 무시하면 원본 표를 따른 클라이언트가 아무 프레임도 못 받으면서 연결은 살아 있어 원인을 찾지 못한다.

## 메시지 봉투와 스키마

모든 메시지는 JSON 텍스트 프레임이고 type 필드 하나로 종류를 가른다. 시각은 측정 시각이 epoch ms, 그 밖이 UTC ISO다([01_conventions.md](./01_conventions.md) §시각 직렬화).

| 방향 | type | 필드 | 뜻 |
|------|------|------|------|
| 클라이언트 → 서버 | auth | token | 액세스 토큰 — 첫 메시지 · 만료 전 연장 |
| 상동 | subscribe | devices(정수 배열) | 설비 구독 추가 — 여러 번 보낼 수 있다 |
| 상동 | unsubscribe | devices(정수 배열) | 구독 해지 |
| 상동 | pong | t | 받은 ping의 t를 그대로 |
| 서버 → 클라이언트 | auth_ok | userId · expiresAt | 인증 성공 · 연장 성공 |
| 상동 | subscribed | devices · rejected[](deviceId · reason) | 구독 결과 — reason은 not_found · limit |
| 상동 | rt | windowEnd · devices[](deviceId · tags) | 최신값 병합 프레임 — tags는 [tagId, ts, value, quality] 배열의 배열 |
| 상동 | alarm | eventId · ruleId · tagId · transition · ts · severity | 알람 열림 · 닫힘 — transition은 OPENED · CLEARED |
| 상동 | cacheinv | keys(문자열 배열) | 무효화된 키 이름 — 접두 포함 그대로 |
| 상동 | ping | t | 연결 확인 — t는 서버 epoch ms |

- 검산: type = 클라이언트 4 + 서버 6 = **10**
- **rt 프레임의 tags가 배열의 배열인 이유** — 태그 500 · 병합 창마다 한 프레임이면 객체 배열의 필드 이름 반복이 프레임 크기를 지배한다. [05_timeseries.md](./05_timeseries.md) points와 같은 열 지향 모양이라 화면이 같은 변환으로 차트에 넣는다.
- **알람 · 무효화 신호는 구독과 무관하게 인증된 연결 전원에게 간다**(RLT-08 브로드캐스트 · RLT-09). 알람 권한은 조회 전원이다(권한 매트릭스 ALM-07).
- alarm의 ts는 전이를 일으킨 판정 행의 측정 시각이다 — 벽시계가 아니다. 발행은 PostgreSQL 커밋 뒤에만 온다(REQ-ALM-10) — 받은 eventId는 [07_alarms.md](./07_alarms.md) #1에 이미 있다.

프레임 예시다(스로틀 창 하나 · 설비 둘).

```json
{
  "type": "rt",
  "windowEnd": 1758675600100,
  "devices": [
    { "deviceId": 12, "tags": [[3401, 1758675600050, 72.5, 9], [3402, 1758675600010, 101.2, 9]] },
    { "deviceId": 13, "tags": [[3501, 1758675600080, 1, 9]] }
  ]
}
```

- **rt 프레임에 STALE(5)은 실리지 않는다** — §STALE과 푸시.
- 한 창에 변화가 없는 설비는 devices에 없다. 한 창에 변화가 전혀 없으면 프레임을 보내지 않는다.

## 스로틀 병합 — SW-07

| 항목 | 계약 | 어기면 |
|------|------|------|
| 창 | SW-07 값(ms · 현행 참고 100) — 연결마다 창 끝에 rt 프레임 1회 | 창이 없으면 태그 500 · 10 Hz에서 연결당 초당 수천 프레임(원본 예상치)이 나가 탭이 멈춘다 |
| 병합 기준 | 같은 태그는 창 안에서 **ts가 가장 큰 값 하나** — 도착 순이 아니다 | 도착 순이면 늦게 온 옛 값이 화면을 뒤로 돌린다 · 조건부 쓰기와 같은 기준 |
| 창 0 | 병합 구현을 끄고 받은 대로 즉시 전송(PassthroughThrottle) · 프레임 모양은 같다 | 창 0 병합 구현을 두면 "병합 없음"과 "창 0 병합"이 계측에서 갈리지 않는다 |
| 병합 대상 | ch:rt만 · alarm · cacheinv는 즉시 · 병합 없음 | 무효화 신호를 병합하면 키가 빠진다 · 알람이 창만큼 늦는다 |
| 발행 원천 | 조건부 쓰기가 받아들인 필드만 ch:rt에 실린다 | 버려진 옛 값이 푸시되어 화면이 뒤로 간다 |

- 검산: 항목 = **5**
- SW-06 off(DirectGatewayFanout)에서도 프레임 내용은 같다 — 발행자가 게이트웨이를 직접 부르는 것뿐이며 api 인스턴스가 하나일 때만 쓴다(REQ-RLT-17). ch:cacheinv 중계는 SW-06의 대상이 아니라 off에서도 유지된다(REQ-RLT-15).

## STALE과 푸시

**rt 프레임은 STALE을 싣지 않는다(판정).** 푸시는 변화의 도착이라 "값이 오지 않음"을 표현할 수 없다 — 수집이 멈추면 프레임이 멈출 뿐이다.

| 자리 | STALE 판정 | 기준 |
|------|------|------|
| REST 최신값 응답 | 서버가 응답 직전에 판정 · quality 5 | [06_realtime.md](./06_realtime.md) |
| WebSocket 프레임 사이 | **화면이 판정** — 태그별 마지막 ts + staleAfterMs < 서버 현재 추정이면 STALE 표시 · 서버 현재 추정 = 화면 시계 + 오프셋 · 오프셋 = 마지막 REST 응답의 servedAt − 그 응답을 받은 화면 시각 | 재연결 · 첫 로드의 REST 응답이 준 staleAfterMs · servedAt([06_realtime.md](./06_realtime.md)) |

- 검산: 자리 = **2**
- **A형 — "화면은 STALE인데 서버 로그에는 STALE 판정이 없다"는 모순이 아니다.** 통념은 STALE을 서버가 판정한다는 것이다. 부정 — 푸시 경로에는 판정할 사건이 없다. 진짜 축은 **판정 시점**이다 — REST는 응답 시점, 화면은 표시 시점이다. 대체 경로 — 같은 식(scan_rate_ms × 배수)을 staleAfterMs 하나로 화면에 넘기고, 기준 시계도 서버 시계(servedAt)로 맞춰 두 판정이 같은 기준을 쓴다.
- **화면 시계를 그대로 쓰지 않는 이유** — ts는 서버 쪽(Collector · 생성기) 시계로 찍힌다. 화면 시계가 서버보다 몇 초 빠르면 신선한 값도 staleAfterMs를 넘긴 것으로 보여 REST 응답은 정상인데 화면만 STALE이 된다. servedAt으로 오프셋을 한 번 재 두면 두 판정이 같은 시계를 쓴다 — 오프셋은 REST 응답마다(재연결 동기화 포함) 다시 잰다.

## 연결 관리와 재연결

| 조정값 | 현행 참고 | 소유 | 계약 |
|------|------|------|------|
| 인증 대기 시간 | 미정 | 이 문서 | ② 안에 auth가 없으면 4401 — 무인증 소켓이 열린 채 남지 않게 |
| 서버 ping 주기 · pong 미수신 한도 | 30초 · 3회 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §푸시 조정값 | 연속 3회 미수신이면 4408 · 구독 정리 · 구독자 0 채널 해지 |
| 연결당 구독 설비 상한 | 미정 | 이 문서 | 넘는 설비는 subscribed.rejected(reason limit) — 연결을 끊지 않는다 |
| 재연결 백오프 | 1 · 2 · 4초 … 최대 30초 | 기전 정본 · 클라이언트 | 상한 없는 백오프는 api 재기동 뒤 전 클라이언트가 같은 순간 재연결한다 |

- 검산: 조정값 = **4**
- **ping을 WebSocket 제어 프레임이 아니라 JSON 메시지로 둔다(판정).** 브라우저는 제어 프레임 ping에 자동으로 pong하지만 스크립트는 그 ping을 보지 못해, 서버가 죽은 반쪽 연결을 클라이언트가 감지할 수 없다. JSON ping이면 클라이언트도 "ping이 끊겼다"를 보고 재연결을 시작한다 — ping 주기 × 한도 동안 ping이 없으면 클라이언트가 닫는다.
- **토큰 연장을 연결 안에서 받는다(판정).** 액세스 수명(현행 참고 15분)마다 끊고 다시 붙으면 재연결 · 재구독 · REST 동기화가 15분마다 전 연결에서 일어난다. 만료 전 auth 재전송으로 expiresAt을 늘리고, 연장 없이 만료가 지나면 4401로 닫는다 — 끊는 쪽이 만료 뒤 토큰으로 프레임을 받는 창을 남기지 않는다.
- 재연결 직후 순서는 인증 → 구독 → REST 최신값 1회 → 알람 목록 재조회다([06_realtime.md](./06_realtime.md) §재연결 동기화).

## 종료 코드

이 표가 WebSocket 종료 코드의 정본이다. 4000번대는 애플리케이션 정의 대역이며 뒤 세 자리를 HTTP 상태의 뜻에 맞췄다.

| 코드 | 이유 문자열 | 조건 | 클라이언트 대응 | 재연결 |
|:--:|------|------|------|:--:|
| 1000 | normal | 클라이언트 · 서버의 정상 종료 | 없음 | 안 함 |
| 1001 | going_away | api 종료 · 재기동 | 백오프 재연결 | 함 |
| 4400 | invalid_message | JSON 아님 · 모르는 type · 필드 형식 위반 · URL 쿼리 구독 | 클라이언트 수정 | 안 함 |
| 4401 | unauthenticated | 인증 대기 시간 초과 · 첫 메시지가 auth가 아님 · 토큰 불량 · 토큰 만료(연장 없음) | BFF로 갱신한 토큰으로 재연결 · 갱신 실패면 로그인 | 갱신 후 1회 |
| 4403 | forbidden | Origin이 허용 목록 밖 · 역할 0 사용자 | 없음 | 안 함 |
| 4408 | pong_timeout | pong 연속 미수신 | 백오프 재연결 | 함 |
| 4413 | slow_consumer | 소켓 송신 대기량이 한도를 넘음 | 백오프 재연결 · REST 동기화 | 함 |
| 4503 | upstream_unavailable | Redis 접속 불가로 채널 구독이 끊김 | 백오프 재연결 — 재연결 뒤 REST도 503이면 백오프 유지 | 함 |

- 검산: 코드 = **8** · 표준 2(1000 · 1001) + 애플리케이션 6 = **8** · 재연결 함 4 · 안 함 3 · 갱신 후 1회 1
- **4401과 4403을 가르는 이유는 HTTP 401 · 403과 같다.** 4401은 토큰 갱신으로 풀리고 4403은 풀리지 않는다 — 하나로 묶으면 Origin 불일치에도 갱신 · 재연결 루프를 돈다.
- **4413은 신설 판정이며 Redis 출력 버퍼 절단과 다른 사건이다.** Redis의 client-output-buffer-limit pubsub은 **api 프로세스의 구독 연결**을 끊는다 — 그 순간 그 인스턴스의 모든 소켓이 푸시를 잃는다(4503 경로). 느린 **브라우저 한 개**를 끊는 장치는 게이트웨이의 소켓 송신 대기량 한도다. 요구사항 · 기전 문서도 이 구분으로 고쳤다(REQ-RLT-12 · RLT-07 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §푸시 조정값) — 출력 버퍼 한도는 api 구독 연결 보호의 최후선이다.
- 1011(서버 내부 오류)은 계약 코드가 아니다 — 설계된 종료가 아니라 결함이므로 이 표에 두지 않는다(500과 같은 기준).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 소켓 송신 대기량 한도 · 인증 대기 시간 · 구독 설비 상한 | 2계층 미정 — 소유 이 문서 · S4 실측 | 이 문서 |
| 4503 뒤 Redis 복구 시 구독 복원 | 게이트웨이가 스스로 재구독하지 않고 클라이언트 재연결로 복원한다(판정) — 재연결 폭주 폭은 백오프가 흩는다 | 이 문서 |
| 푸시 도달 지연 · 연결 수 상한 | 3계층 미확인 — 원본 목표 500 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-12 |
| 프레임 수 on/off 차이 | 3계층 미확인 — 원본 예상치 초당 5,000 → 10 프레임 | EXP-12 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 시각 직렬화 · 직결 배정
- [06_realtime.md](./06_realtime.md) — REST 최신값 · 재연결 동기화 · staleAfterMs
- [07_alarms.md](./07_alarms.md) — 알람 이벤트 목록
- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT-05~09 기능 정본
- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 계약
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — F-07 기전 · 푸시 조정값
- [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) — Origin 검증 리뷰
