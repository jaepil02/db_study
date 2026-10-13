# RLT — 최신값 · 설비 가동 · HMI 개요 표면 (06_realtime)

> **대상**: RLT 도메인 REST 표면 — 설비 전체 최신값 · 단일 태그 최신값 · **설비 가동 #3 · #4 · HMI 개요 #5(D-16)**의 요청 · 응답 모양 · STALE 표시 · 빈 목록 표지 · 메타 비움 표지 · 응답 판정(200 · 404 · 503) · **설비 전체 200(메타 비움) · 단일 태그 common.postgres_unavailable/503 판정의 표면 반영** · WebSocket 재연결 동기화의 REST 쪽 계약
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — 웹 코드 대조(d5-screen 정정) — #3 호출 화면에 **EXP-LAB**(공용 지우기 버튼이 가동 상태를 읽는다) — 표면 수 불변
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 M4 · 리드 보안 판정 §5-4) — #4 ① 본문 검증에 **Content-Type application/json**(path header.content-type · body) · **② 지우기 중 켜기 거절 신설**(400 common.validation_failed path purge — 끄기는 언제나 받는다 · 켜는 동안은 지우기가 plant_running) — 단계 4 → **5**
> **개정일**: 2026-10-11 — **D-16 설비 가동 · HMI 개요 표면 신설**(사용자 결정 2026-10-11 결정 3 · 공용 계약 packages/shared plant.ts) — **#3 GET · #4 POST /api/v1/plant/power(RLT-10) · #5 GET /api/v1/plant/overview(RLT-11)** 신설 — 표면 2 → **5**(신설 0 → **3**) · 공통 규약 경로 · 단계 행에 #3~#5(BFF 경유 · S5) · realtime.latest_unavailable 발생 표면 #3~#5 · 미확인 등재의 재연결 폭주 행 general 한도 관계 → **레이트 리밋 삭제로 닫힘**(D-16)
> **개정일**: 2026-10-11 — **D-16 로그인 · 권한 · 알람 삭제**(사용자 결정 2026-10-11) — 표면 요약 표 역할 열 → **인증 열(무인증)** · 공통 규약 인가 · 레이트 리밋 두 행 → **인가 · 한도 한 행** · 단계의 인가 S7 · 재연결 순서의 인증 · 알람 목록 재조회 삭제(3 → **2**) — 표면 수 불변 · (리드 판정 — 대상 문서 파일 삭제) 관련 문서의 03_realtime_dashboard(삭제) 줄 삭제 · D-16 정리(d4 전역 sweep) — 폐지 실험을 확정 수단으로 가리키던 자리 교정(EXP-07)
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03) — 표면 2의 호출 화면 DSH-REALTIME → **화면 없음(API 전용)** · 관련 문서 폐지 표기 — 표면 · 기능 · 에러 코드 수 불변(api 표면은 지우지 않는다 — D-14 결정 1)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 재연결 폭주와 일반 등급 한도의 관계 닫힘 — 관계 R3(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — 미확인 "폴링 빈도 대 한도"를 **재연결 폭주 대 한도**로 좁힘(화면은 WebSocket 연결 중 폴링하지 않는다) · 공통 규약 레이트 리밋 행 정렬 — 표면 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 메타 없는 태그 STALE 판정 불가 행이 기전 정본(06_pipeline/05 STALE 판정 계약)에 반영됨 — 표면 수 불변
> **원천**: 원본 architecture.md §11 · §17(커밋 ff66a37) · 원본 data_flow.md §5 · §9 · §12.2(커밋 ff66a37) · REQ-RLT-01~08 · 13 · 16 · 18 · REQ-GLB-11 · ADR-05 · ADR-10 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-01~04 · 07 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) 응답 판정 · 메타 부착 판정 · STALE 판정 계약 · docs_plan.md 웨이브 인계 W5 07_api 행(최신값 설비 전체 200 · 단일 태그 503)

RLT REST 표면은 **Redis의 휘발 사본을 읽는 유일한 요청 · 응답 표면**이다. 최신값은 중복 저장의 유일한 예외이고 진실은 ClickHouse다(REQ-GLB-11). 그래서 이 표면의 모든 응답은 "사본이 뒤처질 때 무엇을 보여 주는가"에 답한다 — 멈춘 값은 STALE로, 비어 있는 설비는 빈 목록으로, Redis 자체의 부재는 503으로.

판정 트리 · 빈 키 복원 · 락 · 조건부 쓰기의 기전 정본은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)이고, 이 문서는 그 판정이 **응답에 어떤 모양으로 드러나는가**를 고정한다 — 특히 기전 문서가 넘긴 두 모양(빈 목록 표지 · 메타 비움 표지)이다.

**503은 Redis에 닿지 못할 때만 난다.** 키가 비어 있는 것 · ClickHouse가 멈춘 것 · PostgreSQL이 멈춘 것은 설비 전체 조회에서 모두 200이다 — 대시보드가 멈추면 운영자가 설비를 보지 못한다. 예외는 둘이다 — 단일 태그 조회의 태그 → 설비 해석 실패와, HMI 개요가 메타 사본을 한 번도 읽지 못한 채 PostgreSQL이 멈춘 경우다.

**설비 가동 · HMI 개요(#3~#5)는 D-16(사용자 결정 2026-10-11 결정 3)이 들인 현장 화면의 표면이다.** 셋 다 Redis 실시간 계열(설비 가동 키 ctl:plant:power · 지금 값 rt:latest)이라 Redis 불가가 realtime.latest_unavailable/503이다. 알람 · 원격 조작 표면은 없다.

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | #1 · #2 브라우저 → api 직결 — 초당 수 회 · #3~#5 브라우저 → BFF → api(no-store · CORS 허용 헤더 없음 · 상태를 바꾸는 #4는 BFF가 Origin 확인) | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 · REQ-GLB-27 |
| 인가 · 한도 | 없음 — 전 표면 무인증 · 레이트 리밋 없음(D-16) · 화면은 WebSocket 연결 중 이 표면을 폴링하지 않는다(첫 로드 · 재연결 동기화만) | [01_conventions.md](./01_conventions.md) §출처 방어 |
| 원천 | SW-02 on — rt:latest:{device_id} HGETALL 1회 · SW-02 off — ClickHouse argMax 점조회(실험 전용) · **응답 모양은 같다** | REQ-RLT-01 · 08 |
| 캐시 | Redis 사본 자체가 원천이다 — cache 계열 조회 캐시 · BFF 캐시 없음 · 메타는 cache:tagmeta:{tag_id} | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 시각 | ts = epoch ms(측정 시각) · servedAt = UTC ISO(STALE 판정에 쓴 서버 현재) | [01_conventions.md](./01_conventions.md) §시각 직렬화 |
| STALE | 응답 직전 현재 − ts > scanRateMs × 배수이면 quality를 5로 · 저장값은 그대로 · 배수 현행 참고 3(소유 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)) | REQ-RLT-03 |
| 단계 | #1 S2 · #2 S4 · #3~#5 S5(D-16) | [../02_features/08_realtime.md](../02_features/08_realtime.md) |

- 검산: 항목 = **7**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 인증 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/realtime/devices/{id}/tags | RLT-01 · 03 · 04 · 07 | 무인증 | rt:latest:{device_id}(봉인 사본) · cache:tagmeta:{tag_id} · lock:rebuild:rt:{device_id} | common.not_found/404 · realtime.latest_unavailable/503 | 화면 없음(API 전용) — 폐지 화면 DSH-REALTIME(D-14) | 원본 |
| 2 | GET | /api/v1/realtime/tags/{id} | RLT-02 · 03 | 무인증 | rt:latest:{device_id}(봉인 사본) · cache:tagmeta:{tag_id} | common.not_found/404 · realtime.latest_unavailable/503 · common.postgres_unavailable/503 | 화면 없음(API 전용) — 폐지 화면 DSH-REALTIME(D-14) | 원본 |
| **3** | GET | /api/v1/plant/power | RLT-10 | 무인증 | BFF no-store · ctl:plant:power(봉인) | realtime.latest_unavailable/503 | HMI-PLANT · EXP-FLOW · EXP-LAB(지우기 버튼이 가동 상태를 읽는다) | 신설(D-16) |
| **4** | POST | /api/v1/plant/power | RLT-10 | 무인증 | BFF no-store · Origin 확인 | common.validation_failed/400 · realtime.latest_unavailable/503 | HMI-PLANT · EXP-FLOW | 신설(D-16) |
| **5** | GET | /api/v1/plant/overview | RLT-11 | 무인증 | BFF no-store · 메타 프로세스 사본 10초 · rt:latest(봉인 사본) | realtime.latest_unavailable/503 · common.postgres_unavailable/503 | HMI-PLANT | 신설(D-16) |

- 검산: 표면 = REST **5** · 원본 2 + 신설 3 = **5**
- RLT의 나머지 기능 5(RLT-05 · 06 · 07 · 08 · 09)는 [11_websocket.md](./11_websocket.md) #1의 동작이다. RLT-07은 두 자리에 걸친다 — 연결 관리는 WebSocket, 재연결 동기화는 이 문서 #1이다.
- **common.postgres_unavailable/503이 #1 · #2 중 #2에만 있는 것은 의도다** — §메타 비움과 해석 실패. #5의 같은 코드는 메타 사본이 아예 없을 때뿐이다(§#5 GET /api/v1/plant/overview).

## #1 GET /api/v1/realtime/devices/{id}/tags

| 항목 | 계약 |
|------|------|
| 요청 | 경로 id(device_id) · 쿼리 없음 |
| 응답 200 | meta(deviceId · servedAt · source · restored · metaMissing) + items(태그 최신값 배열) |
| 태그 항목 | tagId · tagCode · tagName · unit · ts · value · quality · staleAfterMs |
| 빈 목록 | items [] · meta.restored — 설비는 있으나 측정값이 아직 없다(신규 설비 · 복원 창에 행 없음 · 복원 중 ClickHouse 불가 · 락 대기 뒤에도 비어 있음) |
| 실패 | 설비가 마스터에 없음 → 404 common.not_found · Redis 접속 불가 · 타임아웃 → 503 realtime.latest_unavailable |
| 관련 REQ | REQ-RLT-01 · 03 · 04 · 05 · 06 · 07 · 08 · 13 · 16 |
| 흐름 | F-03 · F-10 |

meta 필드는 기전 문서가 넘긴 두 표지를 담는다.

| 필드 | 값 | 뜻 | 어기면 |
|------|------|------|------|
| deviceId | 정수 | 경로 id 그대로 | 해당 없음 |
| servedAt | UTC ISO | STALE 판정에 쓴 api 서버 현재 | 클라이언트 시계로 다시 판정하면 두 시계 차이만큼 STALE이 어긋난다 |
| source | redis · restored · clickhouse | redis = 사본 · restored = 빈 키를 이번 요청이 ClickHouse에서 복원 · clickhouse = SW-02 off | 원천을 숨기면 SW-02 on/off 측정에서 응답 단위로 경로를 가를 수 없다 |
| restored | 불리언 | 빈 키 복원 경로를 탔는가 — 빈 목록이면 복원을 시도했으나 행이 없거나 불가였다 | 해당 없음 |
| metaMissing | 정수 | tagName · unit을 비운 태그 수 — cache:tagmeta 미스 + PostgreSQL 불가 | 0이 아닌데 표시하지 않으면 화면이 빈 이름을 결함으로 신고한다 |

- 검산: meta 필드 = **5**
- **빈 목록 표지는 items []다(판정).** 별도 상태 필드를 두지 않는다 — 빈 배열이 곧 "측정값이 아직 없다"는 사실이고, 원인(신규 설비 · 복원 불가)은 운영자의 대응을 바꾸지 않는다. 원인 구분은 복원 계수 메트릭이 갖는다([../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §응답 판정).
- **메타 비움 표지는 tagCode · tagName · unit · staleAfterMs null + meta.metaMissing이다(판정).** 값 · 품질 · ts는 그대로 나온다. 빈 문자열로 채우지 않는다 — unit의 빈 문자열은 "무차원"이라는 저장값의 뜻이 있다(스키마 정본 tag_master.unit).

응답 예시다(태그 하나는 정상 · 하나는 메타 비움).

```json
{
  "meta": {
    "deviceId": 12,
    "servedAt": "2026-09-24T01:00:00.120Z",
    "source": "redis",
    "restored": false,
    "metaMissing": 1
  },
  "items": [
    { "tagId": 3401, "tagCode": "D12-TEMP-01", "tagName": "반응기 온도", "unit": "°C",
      "ts": 1758675599870, "value": 72.4, "quality": 9, "staleAfterMs": 3000 },
    { "tagId": 3402, "tagCode": null, "tagName": null, "unit": null,
      "ts": 1758675590010, "value": 101.3, "quality": 9, "staleAfterMs": null }
  ]
}
```

- **staleAfterMs = scan_rate_ms × 배수다.** 화면이 WebSocket 푸시 사이의 정적 구간에서 스스로 STALE을 판정하는 기준이다 — 푸시는 변화의 도착이라 "오지 않음"을 표현할 수 없다([11_websocket.md](./11_websocket.md) §STALE과 푸시). 메타가 비면 scan_rate_ms도 모르므로 null이다 — 다음 불릿.
- **메타가 빈 태그는 STALE을 판정하지 못한다(판정).** 판정식의 주기(scan_rate_ms)가 메타에 있다. 저장 품질을 그대로 내고 staleAfterMs null로 "판정 불가"를 표지한다 — 5로 덮으면 PostgreSQL 장애 동안 신선한 값까지 전부 STALE이 되어 운영자가 설비 이상과 메타 장애를 가르지 못한다. 화면은 이 태그에 값의 나이(servedAt − ts)를 표시한다.

### 응답 판정

| 사건 | 응답 | source · restored | 근거 |
|------|------|------|------|
| 필드 있음 | 200 · STALE 판정 반영 | redis · false | REQ-RLT-01 · 03 |
| 키 없음 · 복원 성공 | 200 · 복원 값 | restored · true | REQ-RLT-05 |
| 키 없음 · 복원 창에 행 없음 | 200 · items [] | restored · true | 기전 정본 §신규 설비 판정 |
| 키 없음 · 복원 중 ClickHouse 불가 | 200 · items [] | restored · true | 기전 정본 §응답 판정 |
| 키 없음 · 락 실패 · 재읽기에도 없음 | 200 · items [] | redis · false | 상동 |
| 설비가 마스터에 없음 | 404 common.not_found | 해당 없음 | REQ-RLT-07 |
| Redis 접속 불가 | 503 realtime.latest_unavailable | 해당 없음 | REQ-RLT-06 |
| tagmeta 미스 + PostgreSQL 불가 | 200 · 해당 태그 메타 null · metaMissing 증가 | redis · false | 기전 정본 §메타 부착 판정 |

- 검산: 사건 = **8** · 200 6 + 404 1 + 503 1 = **8**
- **B형 — Redis가 죽으면 최신값 표면은 실패한다.** 결론 — ClickHouse로 대신 답하지 않는다. 반대 시나리오 — 대시보드의 초당 수백 회 점조회가 전부 ClickHouse로 쏟아져 대량 스캔 엔진이 점조회로 포화되고 적재 삽입까지 밀린다. 파생 지침 — 클라이언트도 503을 [05_timeseries.md](./05_timeseries.md) #1로 대체 호출하지 않고 백오프한다(REQ-RLT-06).
- **ClickHouse 중단 중에는 200이 계속 나오고 값이 STALE로 바뀐다.** SW-11 ingest(기본)에서 적재가 멈추면 최신값 갱신도 멈춘다 — 배수 × 주기 뒤 STALE 표시가 유일한 신호다(REQ-RLT-16 · ADR-10).
- **404는 마스터 기준이다.** 키가 비었다는 이유로 404를 내지 않는다 — Redis 재시작 직후 모든 설비가 "없음"이 되어 화면이 설비 목록을 지운다(REQ-RLT-07). 설비 존재 확인은 cache:devlist 사본 또는 PostgreSQL이 한다.

## #2 GET /api/v1/realtime/tags/{id}

| 항목 | 계약 |
|------|------|
| 요청 | 경로 id(tag_id) |
| 응답 200 | meta(tagId · deviceId · servedAt · source) + item(태그 항목 하나 — #1과 같은 모양) |
| 처리 | ① cache:tagmeta:{tag_id}로 태그 → 설비 해석(미스 · 실패면 PostgreSQL) ② rt:latest:{device_id}의 필드 하나 읽기 ③ STALE 판정 |
| 값 없음 | 태그는 있으나 그 필드가 없음 → 200 · item null — 복원하지 않는다(복원은 설비 단위다) |
| 비활성 태그 | 200 — 마지막 값이 있으면 그대로(대개 STALE) · 없으면 item null |
| 실패 | 태그가 마스터에 없음 → 404 · Redis 불가 → 503 realtime.latest_unavailable · **태그 해석 불가(tagmeta 미스 + PostgreSQL 불가) → 503 common.postgres_unavailable** |
| 관련 REQ | REQ-RLT-02 · 03 · 06 · 07 |
| 흐름 | F-03 |

- **단일 태그는 빈 키 복원을 부르지 않는다(판정).** 복원 락은 설비 단위(lock:rebuild:rt:{device_id})이고, 태그 하나를 위해 설비 전체 argMax를 부르면 단일 태그 폴링이 설비 복원의 방아쇠가 된다. 값이 필요하면 #1이 복원한다.

### 메타 비움과 해석 실패

인계 "최신값 설비 전체 200(메타 비움) · 단일 태그 common.postgres_unavailable/503"을 표면에 반영한다. 판정 자체는 기전 정본이 닫았고([../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §메타 부착 판정), 이 표는 **응답 모양**만 고정한다.

| 경로 | 같은 원인(tagmeta 미스 + PostgreSQL 불가) | 응답 | 클라이언트 대응 |
|------|------|------|------|
| #1 설비 전체 | 값의 자리(설비 Hash)는 알고 이름만 모른다 | 200 · tagName · unit · tagCode · staleAfterMs null · meta.metaMissing | 값을 그대로 표시하고 이름 칸에 "메타 없음" |
| #2 단일 태그 | 값의 자리(어느 설비 Hash인가)를 모른다 | 503 common.postgres_unavailable | 백오프 후 재요청 — 시계열 조회로 대체하지 않는다 |

- 검산: 경로 = **2**
- **A형 — "같은 PostgreSQL 장애에 한 표면은 200, 다른 표면은 503"은 모순이 아니다.** 통념은 같은 원인이면 같은 응답이라는 것이다. 부정 — 메타는 해석이지 값이 아니다. 진짜 축은 **값의 자리를 아는가**다. 설비 전체는 알고, 단일 태그는 모든 설비 Hash를 훑어야 알 수 있다 — KEYS 금지와 같은 비용이다. 대체 경로 — 단일 태그 화면이 막히면 그 태그의 설비로 #1을 부른다.

## #3 GET /api/v1/plant/power

설비 가동의 지금 상태다(RLT-10 · REQ-RLT-19). 응답은 200 {on, changedAt}이다.

| 필드 | 타입 | 규칙 |
|------|------|------|
| on | 불리언 | 실행 중 상태 ctl:plant:power의 state — 키가 없으면 기동 기본값(SENSOR_AUTOGEN · 로컬 Compose off) |
| changedAt | 문자열(UTC ISO 8601 Z) · null | 이번 기동 뒤 마지막으로 바뀐 시각 — 기동 기본값 그대로면 null(수집기 역할이 기동 때 키를 지운다) |

- 검산: 필드 = **2**
- Redis에 닿지 못하면 503 realtime.latest_unavailable이다 — **꺼짐(false)으로 답하지 않는다.** 모르는 상태를 기본값으로 덮으면 켜져 있는 공장을 "꺼졌다"고 보이고, 화면이 그 값으로 다시 켜기를 누르게 된다.
- 화면 공용 스위치는 5초마다 다시 읽는다 — 다른 화면 · 다른 창의 전환을 따라가기 위해서다(정본 [../08_screen/10_lab_screen.md](../08_screen/10_lab_screen.md) §공용 컨트롤).

## #4 POST /api/v1/plant/power

| 단계 | 동작 | 실패 응답 |
|:-:|------|------|
| ① | Host 대조 · 본문 검증 — Content-Type application/json의 JSON {on: 불리언} · 모르는 키 · 본문 없음 · JSON 아닌 본문 거절(REQ-GLB-27) | 400 common.validation_failed(fields path header.content-type · body) |
| ② | 켜기(on true)면 센서 데이터 지우기(09_datagen #8)가 진행 중인가 — 진행 중이면 거절 · 끄기는 언제나 지나간다 · 켜는 동안(②~④)은 지우기가 plant_running으로 막힌다 | 400 common.validation_failed(fields path purge · reason enum) |
| ③ | 지금 상태 읽기 — 같으면 쓰지 않고 그대로 답한다(바뀐 시각 유지 · 키가 없고 기본값과 같으면 키도 만들지 않는다) | 503 realtime.latest_unavailable |
| ④ | 다르면 원자 스크립트 하나로 state · changed_at을 함께 쓴다(읽고 쓰는 사이에 다른 요청이 끼지 않는다) | 503 realtime.latest_unavailable |
| ⑤ | 200 + {on, changedAt} — **적은 상태**다 | 해당 없음 |

- 검산: 단계 = **5**
- **지우는 동안 켜기를 막는 잠금은 프로세스 안이다** — 지우기 · 설비 켜기 · 실행 시작이 한 api 프로세스(APP_ROLE all · api 하나)에 있을 때 맞다. 끄기를 막지 않는 이유 — 끄기는 새 센서 데이터를 만들지 않아 지우기의 참을 깨지 않는다.
- **A형 — "켜기를 눌렀는데 응답이 왔는데도 잠깐 데이터가 안 온다"는 버그가 아니다.** 통념은 응답이 오면 공장이 이미 돌고 있다는 것이다. 부정 — 표면은 키만 쓰고, 가상 PLC 포트 · 모드 A 틱 · 폴링을 실제로 켜는 것은 수집기 역할이 1초마다 키를 읽어서 한다. 진짜 축은 **쓰기와 적용의 분리**다 — 표면 프로세스와 수집기 프로세스가 갈려도(APP_ROLE api · collector) 같은 키로 따른다. 대체 경로 — 화면은 #5의 상태(켠 지 5초 안은 정지 — 깨어나는 중)로 적용을 본다.
- 멱등 — 같은 값을 다시 보내면 200 + 그대로다(자연 멱등 · 멱등 키 없음).
- 캐시 — BFF no-store · api no-store. 경로는 BFF 경유다 — 브라우저 직결 표면이 아니라 CORS 허용 헤더를 붙이지 않고, BFF는 Origin이 허용 출처일 때만 중계한다(REQ-GLB-25 · 27).

## #5 GET /api/v1/plant/overview

HMI 설비 현황판(HMI-PLANT)이 1초마다 부르는 개요다(RLT-11 · REQ-RLT-20). 지금 값은 Redis만 읽는다 — rt:latest를 파이프라인 1회로 · 메타는 api 프로세스 메모리 사본(10초). 응답 모양의 정본은 공용 계약(packages/shared plant.ts PlantOverview)이다.

| 필드 | 모양 | 규칙 |
|------|------|------|
| at | 문자열(UTC ISO 8601 Z) | 판정에 쓴 서버 현재 |
| power | 불리언 | 설비 가동(#3의 on) |
| totals | {running, idle, stopped, offline, pointsPerSec} | 상태 4 개수(합 = 설비 수) · 초당 점 합 |
| pointsPerSecByKind | 종류 8 → 수 | 태그 종류(온도 · 압력 · 속도 · 전류 · 진동 · 수량 · 상태 · 기타)별 초당 점 |
| pointsPerSecBasis | measured · nominal | measured — 같은 프로세스 수집기의 실제 발행을 3초 창으로 센 값 · nominal — 가동 켜짐이고 통신 중인 설비의 태그 주기 합(Σ 1000 ÷ 주기) |
| lines[] | {code, name, devices[]} | 라인 코드 순 · 설비는 공정 순(1~10) |
| └ devices[] | {deviceId, code, name, lineCode, processCode, processName, order, state, lastUpdateAt, pointsPerSec, keyTagId, tags[]} | state는 아래 판정 · lastUpdateAt은 태그 지금 값 중 가장 최근 ts · keyTagId는 칸에 크게 보일 핵심 값 태그 |
| └ tags[] | {tagId, code, name, kind, unit, dataType, scanRateMs, value, ts, quality} | 값은 공학 단위 그대로 · 아직 값이 없으면 value · ts · quality null · 형식은 FLOAT32 · UINT32 · UINT16만(밖이면 빼고 경고) |

- 검산: 최상위 필드 = **6** · 설비 필드 = **12** · 태그 필드 = **10**

### 상태 판정

판정 순서다 — 위에서 먼저 걸린 줄이 이긴다.

```plain
설비 하나
├─ 설비 가동 꺼짐 ─────────────────────────────────────── stopped
├─ 마지막 갱신이 없거나 5초(PLANT_OFFLINE_AFTER_MS)보다 오래됨
│  ├─ 켠 지 5초 안(깨어나는 중) ────────────────────────── stopped
│  └─ 그 밖 ─────────────────────────────────────────── offline
├─ STATE 태그 품질 BAD_COMM 또는 STATE 값 없음 ────────── offline
├─ STATE 값 2 ────────────────────────────────────────── running
├─ STATE 값 1 ────────────────────────────────────────── idle
└─ STATE 값 0(그 밖) ──────────────────────────────────── stopped
```

- **판정의 원천은 Redis 지금 값 하나다** — 통신 끊김을 수집기 상태 표면에 묻지 않는다. 같은 rt:latest를 쓰므로 화면의 값과 상태가 어긋날 수 없다.
- **켠 직후 5초를 정지로 두는 이유** — 켜자마자 첫 값이 오기 전의 30대를 통신 끊김으로 그리면 화면 전체가 회색으로 한 번 깜박인다. 켠 시각은 #3의 changedAt이다.
- **measured는 같은 프로세스에 수집기가 있을 때만이다**(APP_ROLE all — 로컬 기본). api 역할만 띄우면 셀 발행 누계가 없어 nominal로 내고 basis에 적는다 — 화면은 nominal이면 "(주기 기준)"을 붙인다.

| 상황 | 응답 |
|------|------|
| 메타 사본 있음 · Redis 정상 | 200 |
| 메타 다시 읽기 실패(PostgreSQL 불가) · 사본 있음 | 200 — 마지막 사본으로 |
| 메타 사본 없음 · PostgreSQL 불가 | 503 common.postgres_unavailable |
| Redis 불가 | 503 realtime.latest_unavailable — ClickHouse로 채우지 않는다 |

- 검산: 상황 = **4**
- 상세 추이(최근 10분 작은 선)는 이 표면이 아니라 [05_timeseries.md](./05_timeseries.md) #1(5초마다 · api 직결)이다 — 개요가 이력을 실으면 1초 응답이 ClickHouse를 부르게 된다.

## 재연결 동기화

WebSocket이 끊겼다 다시 붙은 직후 클라이언트는 구독한 설비마다 #1을 **한 번** 부른다(REQ-RLT-13). 서버는 끊긴 동안의 프레임을 재전송하지 않는다 — Pub/Sub은 전달을 보장하지 않는다.

| 순서 | 호출 | 목적 | 어기면 |
|:-:|------|------|------|
| 1 | [11_websocket.md](./11_websocket.md) 재연결 · 구독 | 이후 변화를 받는다 | 동기화를 먼저 하면 그 사이의 변화가 두 경로 어디에도 없다 |
| 2 | #1 × 구독 설비 수 | 끊긴 동안의 공백을 메운다 | 재연결 전 마지막 값이 화면에 남는다 |

- 검산: 순서 = **2** · 옛 알람 목록 재조회는 D-16 폐지
- **구독을 먼저 하는 이유** — 동기화 응답과 첫 프레임이 겹치면 화면은 ts가 큰 쪽을 남긴다(조건부 쓰기와 같은 기준 — 기전 정본 §F-07 실시간 푸시 한 사이클 ⑤). 거꾸로 하면 동기화와 구독 사이의 변화가 영영 빠진다.
- 재연결 폭주에서 #1 호출은 설비 수 × 연결 수로 몰린다 — 백오프 상한이 그 폭을 흩는다(현행 참고 최대 30초 · 소유 기전 정본 §푸시 조정값).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 최신값 조회 p95 · 복원 지연 | 3계층 미확인 — 원본 목표 10 ms · 복원 원본 예상치 50~150 ms · SW-02 off 원본 예상치 30~150 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-07(D-16 폐지 표기) · 옛 EXP-07(D-16 폐지) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 메타 조회 실패 시 STALE 판정 불가 | **반영됨** — 기전 정본 STALE 판정 계약 행 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 재연결 폭주와 일반 등급 한도의 관계 | **닫힘(D-16 — 레이트 리밋 삭제)** — 한도가 없어 관계 R3도 없다 · 폭주의 시각은 백오프 상한이 흩는다 · 남는 위험은 위협 모델의 잔여로 둔다 | [../12_security/04_threat_model.md](../12_security/04_threat_model.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 직결 배정 · 시각 직렬화
- [11_websocket.md](./11_websocket.md) — 구독 · 푸시 · 재연결
- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT-01~11 기능 정본
- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 계약
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — 판정 트리 · 복원 · STALE 기전
