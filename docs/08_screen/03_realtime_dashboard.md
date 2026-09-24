# 실시간 대시보드 (03_realtime_dashboard)

> **대상**: DSH-REALTIME — 설비별 최신값 표 · 실시간 트렌드 · STALE 표시 · WebSocket 연결과 재연결 표시 · SW-02 · SW-06 · SW-07 · SW-11 영향 표시
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 메트릭 이름 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 트렌드 창 길이 5분 · 최대 태그 8 현행값(09_tech_stack/01 · S2 고정)
> **원천**: 원본 data_flow.md §5 · §9 · §9.1 · §9.2 · §12.2(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · §7.2(커밋 ff66a37) · 원본 architecture.md §11 · §17(커밋 ff66a37) · REQ-RLT-01~18 · REQ-TSQ-13 · AC-10 · AC-11 · AC-17 · AC-18 · AC-41 · 기능 RLT-01~09 · TSQ-01 · TSQ-08 · MST-01 · MST-02 · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) · [../02_features/08_realtime.md](../02_features/08_realtime.md) · [01_standards.md](./01_standards.md)

이 문서는 현장 운영자가 상시 띄워 두는 화면 하나를 명세한다. **이 화면은 거의 전부 Redis만 본다** — 최신값은 rt:latest HGETALL 1회, 실시간 변화는 ch:rt Pub/Sub 푸시다. ClickHouse에 닿는 것은 진입 시 트렌드 채움 한 번과 SW-02 off 실험뿐이며, 그래서 이 화면의 체감 속도는 대개 Redis 역할 스위치 하나의 상태로 설명된다([../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md)).

**Redis가 죽으면 이 화면은 값을 새로 받지 못한다.** 최신값 API는 ClickHouse로 우회하지 않고 503을 내며, 화면도 시계열 조회로 대체 호출하지 않는다(REQ-RLT-06). 이 화면의 실패 표시는 그 차단기를 사람에게 설명하는 자리다.

## DSH-REALTIME — 설비 실시간 대시보드

| 항목 | 내용 |
|------|------|
| 화면 코드 | DSH-REALTIME |
| 웹 경로 | /realtime · /realtime/{device_id} · /realtime/tag/{tag_id}(태그 딥링크) |
| 페르소나 | 현장 운영자(주) · 실험 수행자(관찰) |
| 역할 | S7 이후 역할 1개 이상인 인증 사용자 전원(REQ-RLT-18) · S2~S6 무인증 |
| 도입 단계 | S2 최소 1페이지(차트 1 · 최신값 표) · S4 재연결 동기화 · 스로틀 · 진행 구간 분할 · S7 알람 띠 |
| 요청 경로 | 최신값 · 시계열 · WebSocket은 api 직결 · 설비 선택 목록 · health는 BFF 경유 |

**목적**: 이 설비의 태그가 지금 정상인가 — 값 · 품질 · 측정 시각을 한눈에 보고, 멈춘 태그(STALE)와 통신 이상(품질 2 · 4)을 가른다.

**진입**: 공통 셸 메뉴 · ALM-CONSOLE 알람 행의 태그 링크(태그 딥링크) · 직접 경로. 설비가 경로에 없으면 마지막으로 본 설비(브라우저 저장)를 쓰고, 그것도 없으면 설비 선택기를 연다. 태그 딥링크는 단일 태그 최신값으로 먼저 그리고 응답의 설비로 설비 전체 조회에 들어간다.

```plain
┌─ 설비 선택기 ──────────────────────────────────────────────────────────────┐
│ [사이트 ▾] [라인 ▾] [설비 ▾]     STALE 3/8 · 통신 이상 1   [구성 배지: SW-02 off] │
├─ 최신값 표 ────────────────────────────────────────────────────────────────┤
│ 태그명        값        단위   품질           측정 시각(KST)         추세     │
│ 온도-1        72.4      ℃      GOOD           2026-09-24 10:15:03    ▁▂▃▅   │
│ 압력-2        1.02      MPa    STALE ⚠        2026-09-24 10:14:21    ────   │
│ 유량-3        —         L/min  BAD_COMM ✕     2026-09-24 10:15:02    ╳       │
├─ 실시간 트렌드(uPlot) ──────────────────────────────────────────────────────┤
│  선택 태그 최대 N개 · 창 = 최근 M분 · 좌측 확정 과거 │ 우측 진행 버킷         │
├─ 활성 알람 띠(S7) ─────────────────────────────────────────────────────────┤
│ ● HIGH 온도-1 GT 80 발생 10:12:40  [알람 콘솔로]                           │
└────────────────────────────────────────────────────────────────────────────┘
```

- **최신값 표가 첫 화면의 주인이다.** 트렌드는 표에서 고른 태그만 그린다 — 태그 8개 전체를 기본으로 그리면 S2 합격 판정의 육안 확인(AC-17)은 되지만 태그가 늘면 프레임마다 모든 선을 다시 그려 표 갱신이 밀린다.
- **추세 열은 별도 조회를 부르지 않는다.** 표 행 안의 작은 스파크라인이며 링 버퍼의 마지막 구간을 그린다 — 행마다 조회하면 태그 수만큼 요청이 는다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 사이트 · 라인 · 설비 선택기 | 머리 | 목록을 BFF로 읽고 선택하면 경로를 바꾼다 · 비활성 설비는 목록 끝에 흐리게 | MST-01 · MST-02(조회) | GET /api/v1/sites · GET /api/v1/lines · GET /api/v1/devices(BFF 경유) |
| 설비 전체 최신값 표 | 본문 위 | 진입 · 설비 전환 · 재연결 때 1회 읽고 이후는 WS 프레임을 병합한다 | RLT-01 | GET /api/v1/realtime/devices/{id}/tags |
| 품질 열 · STALE 표지 | 최신값 표 | 응답 시점은 서버 판정(quality 5) · 푸시 사이의 정적 구간은 응답의 staleAfterMs와 servedAt으로 화면이 판정한다 | RLT-03 | 상동 |
| 빈 키 복원 결과 | 최신값 표 | 복원된 값은 일반 값과 같이 그리고 meta.source가 restored면 표 머리 툴팁에 "방금 ClickHouse에서 복원" · 오래된 복원 값은 서버가 이미 STALE로 낸다 | RLT-04 | 상동 |
| 태그 딥링크 첫 값 | 최신값 표 | 태그 하나의 값과 설비를 먼저 얻는다 | RLT-02 | GET /api/v1/realtime/tags/{id} |
| 실시간 트렌드 | 본문 가운데 | uPlot · 태그별 링 버퍼 · 프레임을 ts 오름차순으로 붙인다 | RLT-05 · RLT-06 | WS /ws/realtime(subscribe · unsubscribe 메시지 · rt 프레임) |
| 트렌드 확정 과거 채움 | 트렌드 좌측 | 진입 · 설비 전환 때 창의 과거 구간을 한 번 조회한다 | TSQ-01 · TSQ-08 | POST /api/v1/timeseries/query |
| 트렌드 진행 버킷 | 트렌드 우측 | 진행 중 버킷은 최신값과 WS 프레임으로 채운다 · 두 조각을 화면이 합친다 | TSQ-08 | GET /api/v1/realtime/devices/{id}/tags · WS /ws/realtime |
| 연결 표지 · 재연결 | 공통 셸 WS 표지 | 연결 · 재연결 중(다음 시도까지 초) · 끊김 · 수신 프레임/초 · JSON ping이 주기 × 한도 동안 없으면 클라이언트가 닫고 재연결 · 종료 코드 8종(1000 · 1001 · 4400 · 4401 · 4403 · 4408 · 4413 · 4503)별 표지와 재연결 여부는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 · 4503은 최신값 503 띠와 같이 보인다 | RLT-07 | WS /ws/realtime |
| 활성 알람 띠 | 본문 아래 | ch:alarm 푸시를 받아 이 설비의 열림 · 닫힘을 띄운다 · 클릭하면 ALM-CONSOLE | RLT-08 | WS /ws/realtime |
| 무효화 신호 반영 | 공통 셸 | cache:tagmeta · cache:devlist 신호에 태그명 · 설비 목록을 다시 읽는다 | RLT-09 | WS /ws/realtime |
| 구성 배지 | 머리 우측 | 이 화면의 표시를 바꾸는 스위치가 기본값이 아니면 띄운다 | OBS-06(표시) | GET /api/v1/health(BFF 경유 · 공통 셸이 읽은 값 재사용) |

- 검산: 요소 = **12** · 이 화면의 요소가 인용한 기능 = RLT 9(01~09) + TSQ 2(01 · 08) + MST 2(01 · 02) + OBS 1(06) = **14**
- **화면은 STALE 배수를 따로 갖지 않는다.** 판정 기준 staleAfterMs(= scan_rate_ms × 배수)는 서버가 응답에 싣고, 기준 시계는 응답의 servedAt(서버 현재)으로 맞춘다 — 화면 판정식은 "추정 서버 현재 − ts > staleAfterMs"이고 추정 서버 현재 = 브라우저 현재 + (servedAt − 응답 수신 시각)이다. 배수나 브라우저 시계를 화면이 따로 쓰면 두 시계 차이만큼 표와 머리 숫자가 다른 태그를 STALE이라 말한다. 배수의 소유처는 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md), 필드 계약은 [../07_api/06_realtime.md](../07_api/06_realtime.md)다.
- **푸시만으로는 STALE을 알 수 없다(B형).** 결론 — 푸시는 변화의 도착이라 "오지 않음"을 표현하지 못한다. 반대 시나리오 — 화면 판정 없이 서버 판정만 쓰면 설비가 멈춘 뒤 다음 REST 호출까지 마지막 프레임 값이 신선하게 보인다. 파생 지침 — 머리의 STALE n/N은 두 판정의 합집합을 센다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 설비 선택기와 표 머리(태그명 자리)를 먼저 그리고 값 칸만 스켈레톤으로 둔다. 트렌드는 확정 과거 채움이 올 때까지 빈 축을 그리고 WS 프레임이 먼저 오면 진행 버킷부터 그린다. 설비 전환 중에는 이전 설비의 값을 지우고 새 설비의 스켈레톤으로 바꾼다 — 이전 설비 값을 남기면 다른 설비의 값을 이 설비로 읽는다 |
| 빈 값 | ① **측정값 아직 없음** — 최신값 200 빈 목록(신규 설비 · 복원 창에 행 없음 · 락 대기 소진). 표에 "이 설비는 아직 측정값이 없다"와 설비 등록 시각을 둔다 ② 설비 0 — 선택기에 "등록된 설비가 없다"와 ADM-MASTER 링크(ADMIN에게만) ③ 트렌드 선택 태그 0 — 축만 그리고 "표에서 태그를 고른다" |
| 오류 | realtime.latest_unavailable/503 · common.not_found/404 · common.postgres_unavailable/503(태그 딥링크) · timeseries.clickhouse_unavailable/503(트렌드 채움) · common.rate_limited/429 · auth 계열(S7) — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시. **503 중에는 마지막 값을 흐리게 유지하고 그 값의 측정 시각을 보인다** — 값을 지우면 운영자가 "설비가 0을 낸다"로 읽는다 |
| 정상 | 값 · 단위 · 품질 · 측정 시각(ts · KST). 품질 5 STALE은 경고 색과 "마지막 측정 {경과}", 품질 2 · 4는 값 대신 표지, 9 SIMULATED는 값 옆 작은 표기. **메타를 못 붙인 태그**(tagName · unit null · meta.metaMissing > 0)는 태그명 자리에 tag_id와 "메타 없음"을 두고, staleAfterMs가 null이라 STALE을 판정하지 않는 대신 값의 나이(servedAt − ts)를 보인다 — 5로 덮으면 PostgreSQL 장애 동안 신선한 값까지 STALE로 보여 설비 이상과 메타 장애를 가를 수 없다 |

### 호출 표면

| 표면 | 호출 시점 | 경로 | 쓰는 응답 필드 |
|------|------|------|------|
| GET /api/v1/sites · GET /api/v1/lines · GET /api/v1/devices | 진입 · 신호 무효화 뒤 | BFF | 식별자 · 이름 · isActive |
| GET /api/v1/realtime/devices/{id}/tags | 진입 · 설비 전환 · 재연결 직후(구독 뒤) 1회 | 직결 | meta(deviceId · servedAt · source · restored · metaMissing) · items(tagId · tagCode · tagName · unit · ts · value · quality · staleAfterMs) · 빈 목록 = items [] |
| GET /api/v1/realtime/tags/{id} | 태그 딥링크 진입 1회 | 직결 | meta(tagId · deviceId · servedAt · source) · item(값 없으면 null) |
| POST /api/v1/timeseries/query | 진입 · 설비 전환 · 트렌드 태그 추가 | 직결 | meta.interval · points(확정 과거 구간) |
| WS /ws/realtime | 공통 셸이 연결 · 이 화면이 subscribe · unsubscribe | 직결 | rt 프레임(windowEnd · devices[] · tags는 [tagId, ts, value, quality] 배열의 배열 — STALE 없음) · subscribed(거절 목록) · alarm · cacheinv · ping |
| GET /api/v1/health | 공통 셸 진입 1회 | BFF | 스위치 상태 · 주입 구현 |

- 검산: 표면 = **8**(sites · lines · devices · 설비 최신값 · 태그 최신값 · 시계열 조회 · WebSocket · health)
- **WebSocket이 붙어 있는 동안 최신값을 주기 폴링하지 않는다.** 값은 프레임이 가져오고 STALE은 staleAfterMs로 화면이 판정하므로 폴링이 더할 정보가 없다 — 폴링하면 대시보드 한 개가 설비 수 × 주기만큼 일반 등급 한도를 쓰고([../07_api/06_realtime.md](../07_api/06_realtime.md) 미확인 등재), SW-02 off 실험 중에는 그 폴링이 전부 ClickHouse 점조회가 된다. REST는 진입 · 설비 전환 · 재연결 세 사건에만 부른다.
- 트렌드 채움의 창 끝은 최근 구간이라 서버가 캐시하지 않는다([../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) TTL 구간 분류) — 그래서 채움은 진입 · 설비 전환 때 한 번만 하고 이후는 WS로 이어 그린다. 주기적으로 다시 채우면 운영자 화면이 ClickHouse 원시 조회를 주기적으로 부르는 화면이 된다.

### 갱신과 값 병합

같은 태그의 값이 REST 응답 · WS 프레임 · 재연결 동기화 세 경로로 온다. 화면은 아래 규칙으로 하나로 합친다.

| 규칙 | 내용 | 없으면 |
|------|------|------|
| ts 최대값 우선 | 태그별로 저장된 ts보다 크거나 같은 값만 받아들인다 | 늦게 도착한 REST 응답이 방금 받은 WS 값을 덮어 화면이 뒤로 간다 — 서버 조건부 쓰기(ts ≥)와 같은 기준이다 |
| STALE은 두 자리에서 켜지고 새 ts가 끈다 | REST 응답의 품질 5 또는 화면 판정(추정 서버 현재 − ts > staleAfterMs)이 켠다 · 더 큰 ts의 WS 프레임이 오면 끈다 | 재개된 설비가 다음 REST 호출까지 STALE로 남거나, 멈춘 설비가 신선하게 보인다 |
| 재연결 동기화 순서 | 재연결 · 인증 · **구독을 먼저** 하고 구독 설비마다 REST 최신값 1회 · 알람 목록 재조회 순으로 한다 · 겹친 값은 위 두 규칙으로 병합 | 동기화를 먼저 하면 동기화와 구독 사이의 변화가 두 경로 어디에도 없다(REQ-RLT-13 · [../07_api/06_realtime.md](../07_api/06_realtime.md) §재연결 동기화) |
| 구독 교체 | 설비를 바꾸면 이전 설비 구독을 해지하고 새 설비를 구독한 뒤 REST 1회 | 이전 설비 프레임이 새 설비 표에 섞인다 |
| 알람 띠는 저장하지 않는다 | ch:alarm은 통지다 · 띠는 이 세션에서 받은 이벤트만 보이고 진실은 ALM-CONSOLE 목록이다 | 푸시를 놓친 세션이 알람이 없다고 판단한다 — Pub/Sub은 전달을 보장하지 않는다 |

- 검산: 규칙 = **5**
- **서버 스로틀 창 안의 중간값은 이 화면에 오지 않는다.** 창(현행 참고 100 ms · SW-07) 안의 같은 태그는 ts 최대값 하나만 프레임으로 온다 — 사람 눈이 초당 10회 이상의 숫자 변화를 읽지 못하므로 버린 것이다(원본 data_flow.md §9.1). 트렌드에서 초 단위 이하 변동을 보려면 ANL-TREND의 raw 조회로 간다.

### 스위치 영향

| 스위치 | 상태 | 이 화면에서 달라지는 것 | 구성 배지 문구 |
|------|------|------|------|
| SW-02 REDIS_LATEST_CACHE | off | 최신값 REST가 ClickHouse argMax 점조회로 응답해 진입 · 설비 전환 · 재연결 지연이 는다(원본 예상치 30~150 ms 대 0.3~1 ms — 미확인) · 응답 meta.source가 clickhouse라 표 머리 툴팁에 원천을 보인다 · **WS 프레임은 그대로다**(읽기 포트만 교체 · REQ-RLT-08) | "최신값을 ClickHouse에서 읽는 실험 구성" |
| SW-06 REDIS_PUBSUB_FANOUT | off | 프레임 내용은 같다(REQ-RLT-17) · 발행자가 게이트웨이를 직접 부른다 — api 인스턴스 1에서만 성립 | "팬아웃 직접 호출 구성" |
| SW-07 WS_THROTTLE_MS | 0 | 병합 없이 매 갱신이 프레임으로 온다 — 수신 프레임/초가 태그 수 × 갱신 빈도로 뛰고 탭이 멈출 수 있다(원본 예상치 초당 5,000 대 10 — 미확인) | "스로틀 없음 — 프레임 폭증 실험" |
| SW-11 LATEST_VALUE_WRITER | collector | ClickHouse 중단 중에도 값이 계속 갱신되어 STALE이 붙지 않는다 · 표시 값이 아직 ClickHouse에 없을 수 있다 | "최신값을 수집 직후 쓰는 구성" |
| SW-01 REDIS_STREAM_BUFFER | off | 표시는 같다 · 부팅 경고 상태를 배지로 옮긴다 | "Stream 경계 없음 — 실험 전용" |

- 검산: 표시 스위치 = **5** · 나머지 6(SW-03 · 04 · 05 · 08 · 09 · 10)은 이 화면의 표시를 바꾸지 않는다 — 트렌드 채움의 최근 구간은 캐시하지 않으므로 SW-03~05도 닿지 않는다 · 5 + 6 = **11**
- **수신 프레임/초는 화면 쪽 관찰 보조다.** AC-41의 기록값은 서버 메트릭(연결당 초당 프레임 · nodejs_eventloop_lag_p95_seconds)이며 화면 수치는 기록에 올리지 않는다 — 4요소가 없다.
- **SW-11 비교 중에는 SW-02가 on이어야 차이가 이 화면에 보인다**(조합 제약 #7). SW-02 off면 최신값 REST가 rt:latest를 읽지 않아 갱신 주체의 차이가 표에 드러나지 않는다.

### 장애 시 보이는 것

| 장애 | 최신값 표 | 트렌드 | 알람 띠 | 근거 |
|------|------|------|------|------|
| Redis 중단 | 503 띠 · 마지막 값 흐리게 유지 | WS 끊김 · 새 점 없음 | 끊김 | REQ-RLT-06 · AC-31 |
| ClickHouse 중단 · SW-11 ingest | 값이 멈추고 scan_rate_ms × 배수 뒤 STALE | 새 점 없음 · 채움 503 | 새 알람 없음 — 판정은 적재 확정 뒤에만 시작한다 | REQ-RLT-16 · AC-11 |
| ClickHouse 중단 · SW-11 collector | 계속 갱신 | WS로 계속 그려진다 · 채움 503 | 판정이 멈춰 새 알람 없음 | AC-34 |
| PostgreSQL 중단 | 값은 나온다 · 메타 미스 태그는 "메타 없음" | 정상(메타는 Dictionary) | 새 알람 확정 멈춤 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §메타 부착 판정 |
| api 재기동 | WS 재연결 백오프 · 재연결 직후 REST 1회 | 끊긴 구간이 비어 보인다 | 끊김 뒤 재개 | AC-10 |
| 수집 정지 · 생성 모드 과거 ts | 전부 STALE | 새 점 없음 | 없음 | REQ-RLT-03 |

- 검산: 장애 = **6**
- **B형 — ClickHouse가 멈췄는데 대시보드 값이 멈추는 것은 현행 기본 구성(SW-11 ingest)의 알려진 결합이다.** 결론 — 최신값 갱신이 삽입 성공 뒤에 오기 때문이다. 반대 시나리오 — STALE 표시를 끄거나 화면이 ts를 무시하면 운영자가 몇 분 전 값을 현재 값으로 읽는다. 파생 지침 — 이 화면에서 STALE 표지를 숨기는 설정을 두지 않는다(REQ-RLT-16).
- **트렌드의 끊긴 구간을 화면이 이어 그리지 않는다.** 재연결 동기화는 최신값 1회라 끊긴 동안의 점은 채우지 않는다 — 끊긴 구간의 추이는 ANL-TREND 범위 조회로 본다. 이어 그리면 두 점 사이 직선이 실제 파형처럼 보인다.

### 비고

- 원본 S2 범위는 인증 없는 1페이지 · 설비 1 · 태그 8 · raw 고정 조회다(원본 implementation_plan.md §5 S2). 설비 선택기 · 알람 띠 · 구성 배지는 단계가 오르며 더해지는 요소이고 S2 합격(AC-17)은 표와 차트 둘로 판정한다.
- 설비 목록 조회가 BFF 경유인 것은 저빈도 목록이기 때문이다. 같은 화면 안에서 경로가 둘로 갈리는 것은 설계다 — 최신값을 BFF로 보내면 고빈도 요청에 1홉이 더해진다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 트렌드 창 길이 · 트렌드 최대 태그 수 | **W6 판정** — 계약 이 문서 · 현행값 창 5분 · 최대 태그 8(09_tech_stack/01) · S2 고정 | 이 문서 · [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) |
| 최신값 p95 · 푸시 도달 지연 · 복원 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR · EXP-07 · EXP-11 · EXP-30 |

## 관련 문서

- [01_standards.md](./01_standards.md) — 명세 템플릿 · 에러 표시 · 캐시 정렬
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — F-03 · F-07 기전 · STALE 계약
- [../02_features/08_realtime.md](../02_features/08_realtime.md) — RLT 기능 정본
- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 계약
- [../07_api/06_realtime.md](../07_api/06_realtime.md) — 최신값 표면
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — WebSocket 프로토콜
- [05_alarm_console.md](./05_alarm_console.md) — 알람 띠의 목적지
