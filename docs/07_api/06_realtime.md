# RLT — 최신값 표면 (06_realtime)

> **대상**: RLT 도메인 REST 표면 — 설비 전체 최신값 · 단일 태그 최신값의 요청 · 응답 모양 · STALE 표시 · 빈 목록 표지 · 메타 비움 표지 · 응답 판정(200 · 404 · 503) · **설비 전체 200(메타 비움) · 단일 태그 common.postgres_unavailable/503 판정의 표면 반영** · WebSocket 재연결 동기화의 REST 쪽 계약
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W5 판정 반영 — 미확인 "폴링 빈도 대 한도"를 **재연결 폭주 대 한도**로 좁힘(화면은 WebSocket 연결 중 폴링하지 않는다) · 공통 규약 레이트 리밋 행 정렬 — 표면 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 메타 없는 태그 STALE 판정 불가 행이 기전 정본(06_pipeline/05 STALE 판정 계약)에 반영됨 — 표면 수 불변
> **원천**: 원본 architecture.md §11 · §17(커밋 ff66a37) · 원본 data_flow.md §5 · §9 · §12.2(커밋 ff66a37) · REQ-RLT-01~08 · 13 · 16 · 18 · REQ-GLB-11 · ADR-05 · ADR-10 · [../02_features/08_realtime.md](../02_features/08_realtime.md) RLT-01~04 · 07 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) 응답 판정 · 메타 부착 판정 · STALE 판정 계약 · docs_plan.md 웨이브 인계 W5 07_api 행(최신값 설비 전체 200 · 단일 태그 503)

RLT REST 표면은 **Redis의 휘발 사본을 읽는 유일한 요청 · 응답 표면**이다. 최신값은 중복 저장의 유일한 예외이고 진실은 ClickHouse다(REQ-GLB-11). 그래서 이 표면의 모든 응답은 "사본이 뒤처질 때 무엇을 보여 주는가"에 답한다 — 멈춘 값은 STALE로, 비어 있는 설비는 빈 목록으로, Redis 자체의 부재는 503으로.

판정 트리 · 빈 키 복원 · 락 · 조건부 쓰기의 기전 정본은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)이고, 이 문서는 그 판정이 **응답에 어떤 모양으로 드러나는가**를 고정한다 — 특히 기전 문서가 넘긴 두 모양(빈 목록 표지 · 메타 비움 표지)이다.

**503은 Redis에 닿지 못할 때만 난다.** 키가 비어 있는 것 · ClickHouse가 멈춘 것 · PostgreSQL이 멈춘 것은 설비 전체 조회에서 모두 200이다 — 대시보드가 멈추면 운영자가 설비를 보지 못한다. 단 하나의 예외가 단일 태그 조회의 태그 → 설비 해석 실패다.

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 브라우저 → api 직결 — 초당 수 회 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 인가 | 전원(역할 1개 이상) · S2~S6 무인증 | REQ-RLT-18 |
| 레이트 리밋 | 일반 등급 — 화면은 WebSocket 연결 중 이 표면을 폴링하지 않는다(첫 로드 · 재연결 동기화만) | [01_conventions.md](./01_conventions.md) §한도 등급이 갈리는 표면 묶음 |
| 원천 | SW-02 on — rt:latest:{device_id} HGETALL 1회 · SW-02 off — ClickHouse argMax 점조회(실험 전용) · **응답 모양은 같다** | REQ-RLT-01 · 08 |
| 캐시 | Redis 사본 자체가 원천이다 — cache 계열 조회 캐시 · BFF 캐시 없음 · 메타는 cache:tagmeta:{tag_id} | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 시각 | ts = epoch ms(측정 시각) · servedAt = UTC ISO(STALE 판정에 쓴 서버 현재) | [01_conventions.md](./01_conventions.md) §시각 직렬화 |
| STALE | 응답 직전 현재 − ts > scanRateMs × 배수이면 quality를 5로 · 저장값은 그대로 · 배수 현행 참고 3(소유 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)) | REQ-RLT-03 |
| 단계 | #1 S2 · #2 S4 · 인가 S7 | [../02_features/08_realtime.md](../02_features/08_realtime.md) |

- 검산: 항목 = **8**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/realtime/devices/{id}/tags | RLT-01 · 03 · 04 · 07 | 전원 | rt:latest:{device_id}(봉인 사본) · cache:tagmeta:{tag_id} · lock:rebuild:rt:{device_id} | common.not_found/404 · realtime.latest_unavailable/503 | DSH-REALTIME | 원본 |
| 2 | GET | /api/v1/realtime/tags/{id} | RLT-02 · 03 | 전원 | rt:latest:{device_id}(봉인 사본) · cache:tagmeta:{tag_id} | common.not_found/404 · realtime.latest_unavailable/503 · common.postgres_unavailable/503 | DSH-REALTIME | 원본 |

- 검산: 표면 = REST **2** · 원본 2 + 신설 0 = **2**
- RLT의 나머지 기능 5(RLT-05 · 06 · 07 · 08 · 09)는 [11_websocket.md](./11_websocket.md) #1의 동작이다. RLT-07은 두 자리에 걸친다 — 연결 관리는 WebSocket, 재연결 동기화는 이 문서 #1이다.
- **common.postgres_unavailable/503이 #2에만 있는 것은 의도다** — §메타 비움과 해석 실패.

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

## 재연결 동기화

WebSocket이 끊겼다 다시 붙은 직후 클라이언트는 구독한 설비마다 #1을 **한 번** 부른다(REQ-RLT-13). 서버는 끊긴 동안의 프레임을 재전송하지 않는다 — Pub/Sub은 전달을 보장하지 않는다.

| 순서 | 호출 | 목적 | 어기면 |
|:-:|------|------|------|
| 1 | [11_websocket.md](./11_websocket.md) 재연결 · 인증 · 구독 | 이후 변화를 받는다 | 동기화를 먼저 하면 그 사이의 변화가 두 경로 어디에도 없다 |
| 2 | #1 × 구독 설비 수 | 끊긴 동안의 공백을 메운다 | 재연결 전 마지막 값이 화면에 남는다 |
| 3 | [07_alarms.md](./07_alarms.md) #1 | 놓친 알람 열림 · 닫힘 | 확인해야 할 알람이 화면에 없다 |

- 검산: 순서 = **3**
- **구독을 먼저 하는 이유** — 동기화 응답과 첫 프레임이 겹치면 화면은 ts가 큰 쪽을 남긴다(조건부 쓰기와 같은 기준 — 기전 정본 §F-07 실시간 푸시 한 사이클 ⑤). 거꾸로 하면 동기화와 구독 사이의 변화가 영영 빠진다.
- 재연결 폭주에서 #1 호출은 설비 수 × 연결 수로 몰린다 — 백오프 상한이 그 폭을 흩는다(현행 참고 최대 30초 · 소유 기전 정본 §푸시 조정값).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 최신값 조회 p95 · 복원 지연 | 3계층 미확인 — 원본 목표 10 ms · 복원 원본 예상치 50~150 ms · SW-02 off 원본 예상치 30~150 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-07 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)(W6) |
| 메타 조회 실패 시 STALE 판정 불가 | **반영됨** — 기전 정본 STALE 판정 계약 행 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 재연결 폭주와 일반 등급 한도의 관계 | 2계층 미정 — 화면은 WebSocket 연결 중 폴링하지 않으므로 호출은 첫 로드 · 재연결 동기화뿐이다 · 남는 위험은 api 재기동 뒤 재연결 폭주에서 사용자 하나가 구독 설비 수만큼 #1을 몰아 부르는 것 — 백오프 상한이 시각을 흩지만 사용자당 계수는 흩지 못한다 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)(W7) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 직결 배정 · 시각 직렬화
- [11_websocket.md](./11_websocket.md) — 구독 · 푸시 · 재연결
- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT-01~09 기능 정본
- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 계약
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — 판정 트리 · 복원 · STALE 기전
- [../08_screen/03_realtime_dashboard.md](../08_screen/03_realtime_dashboard.md) — DSH-REALTIME 화면
