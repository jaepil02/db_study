# WebSocket 프로토콜 (11_websocket)

> **대상**: /ws/realtime 한 표면의 프로토콜 — 핸드셰이크 Origin 검증 · 첫 메시지 인증 · **구독 방식 판정(쿼리 파라미터 대 subscribe 메시지)** · 메시지 봉투와 스키마 · 스로틀 병합(SW-07) · 알람 · 무효화 신호 중계 · **흐름 이벤트(flow · subscribe_flow · unsubscribe_flow — EXP-FLOW)** · ping · 재연결 · 종료 코드 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-03 — 리드 판정(웨이브 1 정합 · 정본 08_screen/02_traceability) — #1 호출 화면 공통 셸(무효화 신호) → **공통 셸(연결만 — cacheinv는 받지 않는다)** · 무효화 신호 중계(RLT-09) 화면 없음(API 전용) — 표면 · 메시지 type · 종료 코드 수 불변(cacheinv 중계 계약은 그대로)
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03) — #1 호출 화면 DSH-REALTIME · ALM-CONSOLE · EXP-FLOW · 전 화면 → **EXP-FLOW(subscribe_flow · flow) · 공통 셸(무효화 신호)** — rt · alarm을 받던 화면은 폐지 — 표면 · 기능 · 에러 코드 수 불변(api 표면은 지우지 않는다 — D-14 결정 1)
> **개정일**: 2026-09-28 — 웨이브 1 검증 반영(v-wave1 M1) — 업무 요약 발행자 행의 direct 구분 "source로" → **role api-direct로**(같은 문서 페이로드 행 · 08_screen/08과 일치)
> **개정일**: 2026-09-28 — 웨이브 1 검수 판정 반영(f-screens · r-screens M1 · M2 · M5) — ch:flow 두 event에 **role** 필드(batch → ingest · biz → biz-writer 또는 api-direct — 게이트웨이 totals 묶음 키 · 화면 direct 판별 · source는 인스턴스 식별만) · biz 발행 대상에 **failed**(PostgreSQL 불가 — 결과 키만 · result = common.postgres_unavailable) · biz totals에 **failed** · commands = applied + rejected + expired + failed · duplicates는 부분집합 · 예시 JSON 정합 · 미확인 행 flow 레이블 **닫힘** — 페이로드 행 · 프레임 필드 · 계약 · type 수 불변
> **개정일**: 2026-09-28 — 표지 키 리드 재판정 — rt:flow:subscribed → **cache:flow:subscribed**(rt 봉인 계열 TTL 금지) · 표지 읽기 실패 시 발행하지 않는다 한 줄 — TTL · 갱신 · 확인 간격과 type 수 불변
> **개정일**: 2026-09-27 — 흐름 이벤트 판정 반영(리드 판정 1 · 3 · 업무 쓰기 Redis 경유 개정) — 업무 요약 발행자 api → **워커 grp:biz-writer**(SW-12 direct면 api · source로 구분) · biz 필드를 명령 경로로(cmdId · kind · result · duplicate · stages queueWaitMs · txMs · invalidateMs · replyMs) · 요약 구분 필드 kind → **event**(kind는 명령 종류) · 구독 중 표지 키 **rt:flow:subscribed**(TTL 15초 · 5초 갱신 · 발행자 확인 5초) · 흐름 이벤트 기능 ID 없음(OBS 보조 실증 화면) — type 수 불변
> **개정일**: 2026-09-27 — 새 화면 EXP-FLOW(리드 판정 2) — §흐름 이벤트 — flow 신설(ch:flow 페이로드 2종 · flow 프레임 필드 · 발행 조건 · 250 ms 병합 · 구독자 없으면 발행 안 함 · 인증) · 메시지 type 10 → **13**(클라이언트 subscribe_flow · unsubscribe_flow · 서버 flow) · 채널 4번째 ch:flow · 표면 수 · 종료 코드 수 불변
> **개정일**: 2026-09-25 — S4 as-built(3e8a46d · 35e8b8d · 기록 025 · 026) — 2계층 미정 셋 중 둘 **현행 참고**(소켓 송신 대기량 1 MiB · 연결당 구독 설비 상한 100 — S4 판정 5) · 인증 대기 시간은 S7 · 구독 연결 미준비 중 새 연결 즉시 4503(검수 L5) · 스로틀 병합 관측(티어 M 1초 주기 — 설비 사이 묶음이 주 효과) · 프레임 수 on/off 차이 **기록**
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 핸드셰이크 Origin 검증 S7 → **S2**(인증 ②③만 S7) — 종료 코드 수 불변(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — §STALE과 푸시의 화면 판정 기준을 화면 시계 → **servedAt(서버 시계) 기준 + 화면 오프셋 보정**으로 정렬(06_realtime) — 표 행 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 느린 구독자 절단 불일치 → **닫힘**(REQ-RLT-12 · RLT-07 · 06_pipeline/05 반영 — 브라우저 단위 4413 · 출력 버퍼는 구독 연결 보호의 최후선) — 표면 · 종료 코드 수 불변
> **원천**: 원본 architecture.md §11 · §11.2 · §18(커밋 ff66a37) · 원본 data_flow.md §9 · §9.1 · §9.2(커밋 ff66a37) · REQ-RLT-09~15 · 17 · 18 · REQ-AUT-08 · 13 · ADR-07 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-05~09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-06 · SW-07 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §F-07 실시간 푸시 한 사이클 · §푸시 조정값 · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 봉인 계열 값과 채널 페이로드 · docs_plan.md 웨이브 인계 W5 07_api 행(구독 방식)

WebSocket은 **RLT가 소유하는 횡단 표면**이다. 설비 최신값 푸시(RLT-05 · 06 · 07), 알람 열림 · 닫힘 푸시(RLT-08), 마스터 무효화 신호 중계(RLT-09) 세 흐름에 **흐름 이벤트(EXP-FLOW — 구독한 연결만)**가 더해져 네 흐름이 한 연결을 나눠 쓴다. 발행 쪽은 Redis Pub/Sub 채널 넷(ch:rt:{device_id} · ch:alarm · ch:cacheinv · ch:flow)이고, 게이트웨이는 받은 것을 소켓에 옮길 뿐 판정하지 않는다(ADR-07).

**인증 · Origin 실패는 HTTP 코드가 아니라 종료 코드다**(REQ-RLT-09). 이 문서가 종료 코드의 정본이다 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)는 WebSocket 거절을 "에러 코드가 아닌 것"으로 두고 이 문서를 가리킨다. 종료 코드는 에러 코드 체계({domain}.{snake_case})의 밖이다.

**Pub/Sub은 전달을 보장하지 않는다.** 끊긴 동안의 프레임은 다시 오지 않고, 서버도 재전송하지 않는다. 공백은 재연결 직후 REST 최신값 1회가 메운다(REQ-RLT-13 · [06_realtime.md](./06_realtime.md) §재연결 동기화).

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | WS | /ws/realtime | RLT-05 · 06 · 07 · 08 · 09 · 흐름 이벤트(기능 ID 없음 · 리드 판정) | 전원 | 없음 — 채널 ch:rt:{device_id} · ch:alarm · ch:cacheinv · ch:flow 구독 | 없음 — 종료 코드(§종료 코드) | EXP-FLOW(subscribe_flow · flow) · 공통 셸(연결만 — cacheinv는 받지 않는다 · RLT-09 화면 없음(API 전용)) — rt · alarm을 받던 DSH-REALTIME · ALM-CONSOLE은 폐지(D-14) | 원본 |

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
                 subscribe_flow → ch:flow SUBSCRIBE(인스턴스 첫 구독자일 때)  형식 위반 4400
⑤ 수신 · 병합    ch:rt → 스로틀 창 병합 → rt 프레임 · ch:alarm · ch:cacheinv → 즉시 중계
                 ch:flow → 250 ms 창 병합 → flow 프레임(흐름 구독 연결만)
⑥ 연결 관리      서버 ping → 클라이언트 pong · 연속 미수신이면 종료            4408
⑦ 토큰 연장      만료 전 auth 재전송 → auth_ok · 만료 지나면 종료              4401
⑧ 종료 · 재연결  클라이언트 지수 백오프 → ①부터 → 구독 → REST 최신값 1회
```

- **①의 Origin 검증은 S2부터, ②③은 S7부터다.** 인증은 S7에 붙고(D-07) 그 전에는 연결 직후 subscribe가 첫 메시지다. Origin 검증은 토큰이 필요 없어 CORS와 같은 S2부터 건다(REQ-AUT-13 · W7 판정 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) §Origin 검증) — S7까지 미루면 S2~S6 내내 같은 머신 브라우저의 아무 페이지나 실시간 프레임을 받는다. S7부터는 ②가 끝나기 전의 subscribe를 4401로 끊는다.
- **Origin 실패를 업그레이드 거부(HTTP 403)가 아니라 종료 코드로 내는 이유** — 브라우저 WebSocket API는 핸드셰이크 HTTP 상태를 스크립트에 주지 않아 403과 네트워크 오류가 같은 1006으로 보인다. 업그레이드 뒤 4403으로 닫으면 클라이언트가 원인을 읽고 재연결을 멈춘다.
- ⑤의 스로틀 병합(SW-07)은 ch:rt에만 걸린다 — ch:alarm · ch:cacheinv는 병합하지 않는다(§스로틀 병합). ch:flow의 250 ms 병합은 SW-07과 무관한 고정 창이다(§흐름 이벤트 — flow).

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
| 상동 | subscribe_flow | 없음 | 흐름 이벤트 구독 — 연결당 켜짐 · 꺼짐 하나 · 이미 구독 중이면 무시 |
| 상동 | unsubscribe_flow | 없음 | 흐름 이벤트 구독 해지 · 구독 중이 아니면 무시 |
| 서버 → 클라이언트 | auth_ok | userId · expiresAt | 인증 성공 · 연장 성공 |
| 상동 | subscribed | devices · rejected[](deviceId · reason) | 구독 결과 — reason은 not_found · limit |
| 상동 | rt | windowEnd · devices[](deviceId · tags) | 최신값 병합 프레임 — tags는 [tagId, ts, value, quality] 배열의 배열 |
| 상동 | alarm | eventId · ruleId · tagId · transition · ts · severity | 알람 열림 · 닫힘 — transition은 OPENED · CLEARED |
| 상동 | cacheinv | keys(문자열 배열) | 무효화된 키 이름 — 접두 포함 그대로 |
| 상동 | flow | windowEnd · batches[] · biz[] · dropped · totals[] | 흐름 이벤트 병합 프레임 — 흐름 구독 연결만 · 필드는 §흐름 이벤트 — flow |
| 상동 | ping | t | 연결 확인 — t는 서버 epoch ms |

- 검산: type = 클라이언트 6 + 서버 7 = **13**
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
- **S4 관측 — 병합의 주 효과는 설비 사이 프레임 묶음이다(기록 026 · 35e8b8d · 부하 실험 · M · SW-07 100/0).** 적재가 1초 창마다 설비별로 한 번 발행하므로 창 0은 구독 설비 수만큼(설비 5 → 초당 5 프레임), 창 100은 한 창에 모인 다섯이 약 1 프레임이 된다 · 같은 태그 병합 수는 0이다(태그 주기 1초 > 창 100 ms). 같은 태그 병합이 생기는 것은 주기 < 창인 구성(100 ms 주기 · 티어 L)이다.
- SW-06 off(DirectGatewayFanout)에서도 프레임 내용은 같다 — 발행자가 게이트웨이를 직접 부르는 것뿐이며 api 인스턴스가 하나일 때만 쓴다(REQ-RLT-17). ch:cacheinv 중계는 SW-06의 대상이 아니라 off에서도 유지된다(REQ-RLT-15).

## 흐름 이벤트 — flow

EXP-FLOW가 받는 흐름이다(리드 판정 2 · 화면 [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md)). 메트릭 폴링은 "배치 하나가 어디를 지나는가"를 보이기엔 거칠어, **배치 · 업무 명령이 끝날 때마다 요약 1건**을 Redis Pub/Sub ch:flow로 내고 게이트웨이가 구독한 연결에만 옮긴다. 값(측정값 · 업무 행 내용 · 명령 payload)은 싣지 않고 개수 · 시간 · 명령 종류 · 결과 코드만 싣는다.

### 발행 조건

| 항목 | 계약 | 어기면 |
|------|------|------|
| 대용량 요약 발행자 | Ingest 워커 — 알람 판정 인계가 있는 배치는 판정기가 ⑦(ch:alarm 발행)을 마친 뒤 · 인계가 없는 배치는 flusher가 ⑧ 후속(최신값 쓰기)을 마친 뒤 · 배치당 1건 · ⑧ 전수(alarm_eval 삽입)는 기다리지 않는다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §판정 한 배치) | 삽입 완료까지 기다리면 요약 발행이 판정기의 쓰기 큐에 묶이고, 배치마다 두 번 내면 점이 둘로 갈라진다 |
| 업무 요약 발행자 | 워커 grp:biz-writer — 명령 하나를 끝낸 뒤(적용 단계 ⑦ 결과 SET · ch:bizreply 알림 뒤 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로) · 명령 1건당 1건 — 적용(APPLIED) · 도메인 거절(REJECTED) · 유효 창 초과(EXPIRED) · **PostgreSQL 불가(failed — 원장 행 없이 결과 키만 SET)** · 멱등 재적용 전부 · **SW-12 direct**면 api가 커밋과 체인 ②③ 뒤 1건을 내고 role api-direct로 구분한다(source는 인스턴스 식별만 · 명령 경로 필드는 null) · api 검증에서 거절된 요청(400 · 403)은 명령이 되지 않으므로 내지 않는다 | 결과 알림 전에 내면 응답을 받기 전 화면이 적용을 먼저 보이고, 거절 · 재적용을 빼면 409 · 재시도가 흐름도에서 사라진다 |
| 구독자 없으면 발행 안 함 | 게이트웨이가 흐름 구독 연결이 1 이상인 동안 **구독 중 표지 키**를 TTL로 두고 주기 갱신한다 · 발행자는 표지를 최대 5초 간격으로 확인해 기억하고 없으면 요약을 만들지도 발행하지도 않는다 · 키는 **cache:flow:subscribed**(리드 재판정 — 캐시 계열 · TTL 15초 · 게이트웨이가 5초마다 갱신 · 발행자 확인 간격 5초 · 등재 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · rt 계열은 봉인이라 TTL을 둘 수 없다) · **표지 읽기가 실패하면(Redis 불가 · 타임아웃) 발행하지 않는다** — 관찰 보조 채널이 불확실할 때는 측정 쪽을 지킨다 | 배치마다 표지를 읽으면 표지 확인이 새 Redis 왕복이 되고, 구독자 없이 발행하면 측정 중 PUBLISH 비용이 flusher 후속 구간에 섞인다 |
| 채널 구독 | 게이트웨이는 인스턴스의 첫 흐름 구독자가 생길 때 ch:flow를 SUBSCRIBE하고 마지막 구독자가 해지 · 종료되면 UNSUBSCRIBE한다 | 상시 구독이면 구독자 없는 인스턴스가 출력 버퍼만 쓴다 |
| 발행 실패 | 계수하고 삼킨다 — 적재 · 쓰기 경로를 실패시키지 않는다(ch:* 발행 실패 규칙 · 05_data_stores/05) | 관찰 보조 채널의 실패가 적재 재시도를 일으킨다 |
| SW-06 | ch:flow는 대상이 아니다 — off에서도 Pub/Sub으로 낸다 | 워커 역할 분리 뒤에는 발행자와 게이트웨이가 다른 프로세스라 직접 호출이 성립하지 않는다 |

- 검산: 항목 = **6**
- **측정 오염 방지는 두 겹이다.** 발행자 쪽은 표지가 없으면 발행하지 않고, 실험 쪽은 러너가 표지가 없는 상태에서 측정 창을 연다(EXP-FLOW를 닫는다). 표지 TTL + 확인 간격(현행 15 + 5초) 동안은 마지막 구독자가 떠난 뒤에도 발행이 이어질 수 있다 — 러너는 표지 부재를 확인한 뒤 창을 연다.

### ch:flow 페이로드

한 메시지가 요약 1건이다. event로 둘을 가른다 — kind는 업무 명령의 종류(명령 봉투의 kind 그대로)라 구분 필드로 쓰지 않는다. 시각 at · startedAt은 발행자 시계의 epoch ms다([01_conventions.md](./01_conventions.md) §시각 직렬화의 측정 시각과 같은 정수 형식).

| event | 필드 | 뜻 |
|------|------|------|
| batch | source · role · seq · at · rows | 워커 인스턴스 식별 · 발행 역할(batch는 항상 ingest) · 기동 이후 배치 번호(1부터 · 1씩) · 요약 발행 시각 · 배치 행 수 |
| 상동 | stages.streamWaitMs · decodeMs | 배치 엔트리의 (XREADGROUP 수신 − 엔트리 ID 시각) 최댓값(구간 6a) · 수신 → 행 배열 완료 최댓값(6b) · SW-01 대안이면 streamWaitMs는 큐 대기 |
| 상동 | stages.chInsertMs · controlCopyMs | ⑥ 삽입 송신 → 성공 응답(재시도 포함 합) · ⑧ 대조군 COPY 트랜잭션(SW-09 off면 null) |
| 상동 | stages.latestWriteMs · alarmMs | 최신값 조건부 쓰기 + ch:rt 발행(SW-11 collector면 null) · 판정 ②~⑦(인계 없으면 null · ⑧ 전수 삽입 제외) |
| 상동 | chRows · retries · dlqEntries | tag_raw에 쓴 행(성공 응답 기준) · 삽입 재시도 수 · 격리 엔트리 수 |
| 상동 | controlCopy · latestWrites | {rows · ok} 또는 null(SW-09 off) · 조건부 쓰기가 받아들인 필드 수 또는 null(SW-11 collector) |
| 상동 | alarm · stream | {judgedRows · opened · closed}(판정기에 넘긴 행 · 확정 열림 · 닫힘 — alarm_event 커밋 기준) 또는 null · {length · lag}(직전 계측 값 — 요약을 위해 Redis 왕복을 더하지 않는다 · SW-01 대안이면 null) |
| 상동 | startedAt · totals | 인스턴스 기동 시각 · 기동 이후 누적(batches · rows · chRows · dlqEntries · controlCopyRows · judgedRows · opened · closed · latestWrites) |
| biz | source · role · seq · at | 발행 인스턴스 식별 · 발행 역할(biz-writer — 명령 워커 · api-direct — SW-12 direct의 api) · 기동 이후 명령 번호 · 요약 발행 시각 |
| 상동 | cmdId · kind | 명령 식별(UUID · 멱등 키 — direct면 null) · 명령 종류 도메인.대상.동작(master.* · alarm.rule.* · alarm.event.ack) |
| 상동 | result · duplicate | ok · 오류 코드(에러 카탈로그 {domain}.{snake_case} — REJECTED의 도메인 오류 코드 또는 failed의 common.postgres_unavailable) · expired(유효 창 초과) 중 하나 · 멱등 재적용 여부(원장에 이미 있어 적용 없이 결과만 다시 냈으면 true) |
| 상동 | stages.queueWaitMs · txMs | 스트림 대기(XREADGROUP 수신 − requestedAt · direct면 null) · ⑤ BEGIN → COMMIT 또는 롤백(duplicate · expired · failed면 null) |
| 상동 | stages.invalidateMs · replyMs | ⑥ 체인 ②③(캐시 DEL · ch:cacheinv — 적용 없으면 null) · ⑦ 결과 SET + ch:bizreply(direct면 null) |
| 상동 | invalidatedKeys · cacheinv | 체인 ②에서 지운 키 수 · 체인 ③ ch:cacheinv 발행 여부(ACK는 false) |
| 상동 | startedAt · totals | 인스턴스 기동 시각 · 기동 이후 누적(commands · applied · rejected · expired · failed · duplicates) — **commands = applied + rejected + expired + failed**이고 duplicates는 그 부분집합이다(재적용 요약은 원장 결과에 따라 applied · rejected · expired 중 하나에도 든다 — 겹쳐 센다) |

- 검산: 행 = batch 8 + biz 7 = **15** · event = **2** · role = **3**(ingest · biz-writer · api-direct) · kind 접두 = **3**(master · alarm.rule · alarm.event) · result 형태 = **3**(ok · 오류 코드 · expired — failed는 오류 코드 형태) · biz totals 계수 = **6**
- **role을 두는 이유 — source로는 경로를 가를 수 없다.** source는 인스턴스 식별자(예 worker-1)라 APP_ROLE all이면 api와 워커가 같은 source를 쓸 수 있다. 게이트웨이는 totals를 (source · role)로 묶고, 화면은 biz 요약의 role로 SW-12 direct를 가른다([../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) §표시 계약) — cmdId null 같은 간접 규칙에 기대면 필드 의미가 바뀔 때 조용히 틀린다.
- **failed는 도메인 거절이 아니다.** result가 common.postgres_unavailable이면 워커가 PostgreSQL 불가로 적용 여부를 확정하지 못한 것이다(원장 행 없음 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §멱등 · 재전달) — rejected에 넣으면 도메인 오류율이 저장소 장애로 부풀어, totals에 failed를 따로 센다.
- **stages가 6개이고 창 대기(6c)가 없다.** fan-in 창이 닫히기를 기다린 시간은 배치 하나의 처리가 아니라 창 폭의 몫이라 싣지 않는다 — 점 애니메이션은 스트림 대기 뒤 곧바로 디코드로 넘어간다.
- **totals가 있는 이유 — 병합으로 빠진 요약이 있어도 합계가 맞는다.** 게이트웨이 병합 · 연결 지연으로 요약이 빠져도 다음 요약의 누적값이 합계를 되살린다. 기동하면 누적이 0으로 돌아가므로 화면은 startedAt 변화를 재기동으로 읽는다.
- **kind는 지금 구현된 업무 쓰기 셋의 접두만 온다(리드 판정 2)** — 마스터 · 알람 규칙 · 알람 확인. 작업지시 · 실적(S7 ②)은 같은 명령 기전을 따르며 들어올 때 kind 접두가 더해진다 — 이 표의 검산을 같은 변경 단위에서 고친다.
- **업무 요약의 단계 순서는 적용 단계 그대로다** — 대기 → 트랜잭션 → 무효화 → 결과. 무효화가 결과보다 앞인 것이 read-your-writes의 기전이라([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §적용 단계) 화면도 이 순서로만 그린다.

### flow 프레임

| 필드 | 형식 | 뜻 |
|------|------|------|
| type | "flow" | 봉투 |
| windowEnd | epoch ms 정수 | 병합 창 끝 — 게이트웨이 시계 |
| batches | batch 요약 배열 — ch:flow 페이로드에서 totals · startedAt을 뺀 모양 · 창 안 최신 8건 · seq 오름차순 | 배치 점 · 타임라인 |
| biz | biz 요약 배열 — totals · startedAt을 뺀 모양 · 창 안 최신 20건 | 업무 점 · 목록 |
| dropped | {batches · biz} 정수 | 창 안에서 상한을 넘어 버린 요약 수 |
| totals | {source · role(ingest · biz-writer · api-direct) · startedAt · 누적 필드} 배열 — 게이트웨이가 요약의 (source · role)마다 창 안 마지막 값 하나로 묶는다 — 워커 한 프로세스가 ingest · biz-writer 둘을 가질 수 있다 | 간선 굵기 · 초당 값 · 재기동 판정 |

- 검산: 필드 = **6**

| 계약 | 규칙 | 어기면 |
|------|------|------|
| 병합 창 | 연결마다 250 ms 고정 — **초당 최대 4 프레임** · 창에 요약이 없으면 보내지 않는다 · SW-07과 무관 | 배치마다 보내면 100,000 pps 계단(초당 2배치)에서는 문제없지만 업무 쓰기 폭주 때 프레임이 쓰기 수만큼 는다 |
| 구독 확인 | subscribe_flow를 받으면 즉시 빈 flow 프레임 1회(batches · biz · totals 빈 배열 · dropped 0) | 배치가 드문 시간에는 구독 성립과 발행 없음이 구분되지 않는다 |
| 인증 · 인가 | subscribe와 같다 — S7부터 auth 뒤에만 · 인증 전 subscribe_flow는 4401 · 역할은 인증 사용자 전원 · S2~S6은 연결 직후 가능 | 흐름 구독만 인증 규칙이 달라 무인증 창이 생긴다 |
| 형식 | subscribe_flow · unsubscribe_flow에 필드가 오면 무시하지 않고 4400 | 다른 메시지와 섞인 오타가 조용히 구독으로 읽힌다 |
| 송신 대기량 | rt와 같은 소켓 한도(1 MiB · 4413) 안에서 센다 | 흐름 프레임만 한도 밖이면 느린 시연 탭이 api 힙을 채운다 |
| 재연결 | 서버는 흐름 구독을 기억하지 않는다 — 클라이언트가 재연결 뒤 subscribe_flow를 다시 보낸다 · 끊긴 동안의 요약은 오지 않는다 | 재연결 뒤 구독이 살아 있다고 믿어 빈 화면이 적재 정지로 읽힌다 |

- 검산: 계약 = **6**

프레임 예시다(창 하나 · 배치 1 · 업무 쓰기 1). 수치는 형식 예시이며 측정값이 아니다.

```json
{
  "type": "flow",
  "windowEnd": 1758675600250,
  "batches": [
    {
      "event": "batch", "source": "worker-1", "role": "ingest", "seq": 5120, "at": 1758675600180, "rows": 10000,
      "stages": { "streamWaitMs": 12, "decodeMs": 4, "chInsertMs": 64, "controlCopyMs": null, "latestWriteMs": 3, "alarmMs": 6 },
      "chRows": 10000, "retries": 0, "dlqEntries": 0, "controlCopy": null, "latestWrites": 2400,
      "alarm": { "judgedRows": 320, "opened": 1, "closed": 0 },
      "stream": { "length": 81234, "lag": 3 }
    }
  ],
  "biz": [
    {
      "event": "biz", "source": "worker-1", "role": "biz-writer", "seq": 42, "at": 1758675600120, "cmdId": "3f1c9a2e-8b7d-4c1e-9f0a-2d6b5e4c3a10", "kind": "alarm.rule.patch",
      "result": "ok", "duplicate": false,
      "stages": { "queueWaitMs": 2, "txMs": 4.2, "invalidateMs": 1.1, "replyMs": 0.6 },
      "invalidatedKeys": 1, "cacheinv": true
    }
  ],
  "dropped": { "batches": 0, "biz": 0 },
  "totals": [
    { "source": "worker-1", "role": "ingest", "startedAt": 1758670000000, "batches": 5120, "rows": 51200000, "chRows": 51200000, "dlqEntries": 0, "controlCopyRows": 0, "judgedRows": 1638400, "opened": 12, "closed": 11, "latestWrites": 12288000 },
    { "source": "worker-1", "role": "biz-writer", "startedAt": 1758670000000, "commands": 42, "applied": 41, "rejected": 1, "expired": 0, "failed": 0, "duplicates": 1 }
  ]
}
```

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
| 인증 대기 시간 | 미정 — 인증과 함께 S7 | 이 문서 | ② 안에 auth가 없으면 4401 — 무인증 소켓이 열린 채 남지 않게 |
| 서버 ping 주기 · pong 미수신 한도 | 30초 · 3회 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §푸시 조정값 | 연속 3회 미수신이면 4408 · 구독 정리 · 구독자 0 채널 해지 |
| 연결당 구독 설비 상한 | **100**(S4 판정 5 · 티어 M 50 · L 100을 담는다) | 이 문서 | 넘는 설비는 subscribed.rejected(reason limit) — 연결을 끊지 않는다 |
| 재연결 백오프 | 1 · 2 · 4초 … 최대 30초 | 기전 정본 · 클라이언트 | 상한 없는 백오프는 api 재기동 뒤 전 클라이언트가 같은 순간 재연결한다 |

- 검산: 조정값 = **4**
- **ping을 WebSocket 제어 프레임이 아니라 JSON 메시지로 둔다(판정).** 브라우저는 제어 프레임 ping에 자동으로 pong하지만 스크립트는 그 ping을 보지 못해, 서버가 죽은 반쪽 연결을 클라이언트가 감지할 수 없다. JSON ping이면 클라이언트도 "ping이 끊겼다"를 보고 재연결을 시작한다 — ping 주기 × 한도 동안 ping이 없으면 클라이언트가 닫는다.
- **토큰 연장을 연결 안에서 받는다(판정).** 액세스 수명(현행 참고 15분)마다 끊고 다시 붙으면 재연결 · 재구독 · REST 동기화가 15분마다 전 연결에서 일어난다. 만료 전 auth 재전송으로 expiresAt을 늘리고, 연장 없이 만료가 지나면 4401로 닫는다 — 끊는 쪽이 만료 뒤 토큰으로 프레임을 받는 창을 남기지 않는다.
- **소켓 송신 대기량 한도는 현행 참고 1 MiB다(S4 판정 5 · 소유 이 문서).** bufferedAmount가 넘으면 그 소켓만 4413으로 닫는다 — Redis 출력 버퍼 한도(09_tech_stack/03 · 32mb 8mb 60)보다 먼저 걸려 느린 브라우저 하나가 api 구독 연결(4503 · 인스턴스 전체)을 끊지 않는다. 한도를 넘기는 부하는 S4 측정(기록 026 · 연결 100 · 5 프레임/초)에서 나오지 않았다 — 4413 0건.
- **구독 연결이 준비되지 않은 동안 들어온 연결은 즉시 4503으로 닫는다(S4 검수 L5).** subscribe가 Redis 복구까지 멈춰 subscribed도 4503도 없는 연결이 남지 않게 한다 — api 기동 직후 구독 연결이 붙기 전의 연결도 같은 4503을 받고 클라이언트 백오프로 회복한다.
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
| 소켓 송신 대기량 한도 · 인증 대기 시간 · 구독 설비 상한 | 2계층 — 송신 대기량 1 MiB · 구독 상한 100 **현행 참고(S4 판정 5)** · 인증 대기 시간 미정(S7) · 한도 적정성은 S5 연결 계단 | 이 문서 |
| 4503 뒤 Redis 복구 시 구독 복원 | 게이트웨이가 스스로 재구독하지 않고 클라이언트 재연결로 복원한다(판정) — 재연결 폭주 폭은 백오프가 흩는다 | 이 문서 |
| 흐름 이벤트 — 구독 중 표지 키 · 기능 ID · 메트릭 레이블 | 표지 키 **닫힘**(cache:flow:subscribed · TTL 15초 · 리드 재판정 — rt 봉인 계열은 TTL 금지 · 등재 05_data_stores/05) · 기능 ID **닫힘**(새 ID 없음 — OBS 보조 실증 화면 · 리드 판정 1) · 메트릭 레이블 **닫힘**(ws_frames_sent_total channel · rlt_publish_failures_total channel의 flow 값 — 10_observability/01 등재) | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 푸시 도달 지연 · 연결 수 상한 | 3계층 미확인 — 원본 목표 500 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-12 |
| 프레임 수 on/off 차이 | 3계층 미확인 — 원본 예상치 초당 5,000 → 10 프레임 · **S4 기록**: 티어 M 1초 주기 · 연결당 설비 5에서 창 0 초당 5.0 · 창 100 약 1.05 · 이벤트 루프 p95 차 없음(기록 026 · 35e8b8d · 부하 실험 · M) — 폭증 조건(주기 < 창)은 S5 | EXP-12 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 시각 직렬화 · 직결 배정
- [06_realtime.md](./06_realtime.md) — REST 최신값 · 재연결 동기화 · staleAfterMs
- [07_alarms.md](./07_alarms.md) — 알람 이벤트 목록
- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT-05~09 기능 정본
- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 계약
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — F-07 기전 · 푸시 조정값
- [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) — Origin 검증 리뷰
- [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) — EXP-FLOW(flow 프레임을 그리는 화면)
