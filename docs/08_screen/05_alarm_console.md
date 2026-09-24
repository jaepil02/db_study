# 알람 콘솔 (05_alarm_console)

> **대상**: ALM-CONSOLE(활성 · 미확인 · 이력 · 확인) · ALM-RULES(규칙 관리 · 판정 이력 분석 — min · max 쌍 차트) — ACK 허용 조건 · alarms.ack_not_allowed/409 표시 · 역할 OPERATOR · ENGINEER
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 무효 구간 자리 판정 · EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 data_flow.md §6.3 · §8 · §8.1 · §8.2 · §9.2(커밋 ff66a37) · 원본 architecture.md §6 · §7.3 · §11 · §18(커밋 ff66a37) · REQ-ALM-01~20 · REQ-RLT-14 · AC-09 · AC-35 · AC-36 · AC-38 · 기능 ALM-01 · 07 · 08 · 09 · RLT-08 · MST-04 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../02_features/09_alarms.md](../02_features/09_alarms.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) · [01_standards.md](./01_standards.md)

이 문서는 알람 화면 둘을 명세한다. ALM-CONSOLE은 현장 운영자가 알람을 받고 확인하는 자리이고, ALM-RULES는 엔지니어가 판정 전수를 분석해 임계값을 고치는 자리다. **쓰기 주체는 역할 하나씩이다** — 확인은 OPERATOR, 규칙 변경은 ENGINEER다([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)). 같은 쓰기를 두 역할에 열면 감사 로그의 행위자로 책임 축을 읽을 수 없다.

**알람은 세 저장소에 목적이 다른 세 쓰기로 남고, 이 두 화면은 그중 두 조각씩만 본다.** 콘솔은 PostgreSQL alarm_event(확정 이벤트)와 Redis ch:alarm(통지)을, 규칙 화면은 PostgreSQL alarm_rule과 ClickHouse alarm_eval(판정 전수)을 본다. Redis alarm:state(핫 상태)는 어느 화면에도 직접 나오지 않는다 — 세 저장소를 한꺼번에 대조하는 것은 실험 수행자의 일이다(AC-35).

## ALM-CONSOLE — 알람 콘솔

| 항목 | 내용 |
|------|------|
| 화면 코드 | ALM-CONSOLE |
| 웹 경로 | /alarms(탭 — 활성 · 미확인 · 이력) |
| 페르소나 | 현장 운영자(주) · 엔지니어(이력 열람) |
| 역할 | 조회는 역할 1개 이상인 인증 사용자 전원 · **확인은 OPERATOR만**(REQ-ALM-18) |
| 도입 단계 | S7 — 알람 판정 · 세 쓰기 · 확인은 S7에서 생략 없이 만든다(REQ-ALM-20) |
| 요청 경로 | 이벤트 목록 · 확인은 BFF 경유 no-store · 실시간 통지는 WebSocket 직결 |

**목적**: 방금 뜬 알람을 확인했는가 — 열린 알람과 미확인 알람을 가르고, 확인할 수 있는 행만 확인한다.

**진입**: 공통 셸 메뉴 · DSH-REALTIME 활성 알람 띠 · 탭은 쿼리 문자열(탭 · 발생 시각 범위 · 심각도)로 딥링크된다.

```plain
┌─ [활성 3] [미확인 5] [이력] ─────── 발생 시각 [이력만 — 최근 7일 ▾]  심각도 [전체 ▾] ─┐
├─ 실시간 겹침 ──────────────────────────────────────────────────────────────┤
│ ● 새 알람 HIGH 온도-1 GT 80 · 10:12:40 (목록 반영 대기)                     │
├─ 목록 ─────────────────────────────────────────────────────────────────────┤
│ 심각도 태그(설비)          조건      발생값  발생 KST   해제 KST   확인         │
│ HIGH   온도-1(설비12)      GT 80     81.2   10:12:40   —          [확인]      │
│ MEDIUM 압력-2(설비12)      LT 0.9    0.85   09:58:02   —          operator1 10:01 │
│ LOW    유량-3(설비13) 비활성  OUT 1~9   0.4    08:10:11   —          [확인]      │
│                                                        [더 보기]            │
└────────────────────────────────────────────────────────────────────────────┘
```

- **탭 셋은 조회 조건 하나씩이다**(REQ-ALM-13). 활성 = state=ACTIVE, 미확인 = acked=false, 이력 = 조건 없음(발생 시각 범위만). 한 행이 활성과 미확인 두 탭에 동시에 보이는 것은 중복이 아니다.
- **활성 · 미확인 탭은 발생 시각 입력이 없다.** 두 탭은 from을 생략해 서버 기본 범위(보존 창 시작 ~ 현재)를 쓴다 — 화면이 최근 24시간 같은 범위를 실으면 열흘 전 비활성 태그의 열린 알람이 기본 목록에서 빠져 누구도 확인하지 않는다([../07_api/07_alarms.md](../07_api/07_alarms.md) §알람 목록 범위 기본값 판정). 이력 탭만 범위를 고르며 기본은 7일이다.
- **"비활성" 표지는 태그가 꺼져 판정이 멈춘 열린 알람이다.** 시스템은 해소를 관측하지 못해 닫지 않는다 — 확인만 할 수 있다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §비활성 태그 규칙).

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 탭 · 범위 · 심각도 필터 | 머리 | 탭이 조회 조건(state · acked)을 바꾼다 · 이력 탭만 from · to를 싣는다 | ALM-07 | GET /api/v1/alarms/events(BFF 경유 · state · acked · from · to · severity · limit · cursor) |
| 이벤트 목록 | 본문 | 심각도 · 태그 · 설비 · 조건 · 발생값 · 발생 시각 · 해제 시각 · 확인자 · 확인 시각 · 태그 활성 여부 | ALM-07 | 상동 |
| 더 보기 | 목록 끝 | 키셋 커서로 이어 읽는다 · 전체 건수를 표시하지 않는다 | ALM-07 | 상동(meta.nextCursor) |
| 확인 버튼 | 목록 행 | §확인 허용 판정의 조건이 참일 때만 활성 · 누르면 확인 다이얼로그 없이 요청 · 응답 뒤 목록 재조회 | ALM-08 | POST /api/v1/alarms/events/{id}/ack(BFF 경유) |
| 실시간 겹침 | 목록 위 | ch:alarm 열림 · 닫힘을 받아 목록에 아직 없는 이벤트를 띄운다 | RLT-08 | WS /ws/realtime |
| 태그 링크 | 목록 행 | DSH-REALTIME 태그 딥링크 | RLT-01(목적지) | 해당 없음 — 이동 |
| 규칙 링크 | 목록 행 | ALM-RULES의 해당 규칙 | ALM-01(목적지) | 해당 없음 — 이동 |

- 검산: 요소 = **7** · 이 화면이 표면을 호출하는 기능 = ALM-07 · ALM-08 · RLT-08 = **3**(링크 목적지 둘은 매핑에 세지 않는다)
- **확인에 확인 다이얼로그를 두지 않는다.** 확인은 되돌릴 수 없지만 잘못 눌러도 사실(누가 언제 봤는가)이 틀리지 않는다 — 운영자가 알람 폭주 중 행마다 두 번 누르게 하면 확인 지연이 알람 피로로 이어진다.

### 확인 허용 판정

버튼의 활성 조건은 서버 허용 조건(REQ-ALM-14)을 화면에 옮긴 것이다. **화면은 서버 판정을 대신하지 않는다** — 버튼이 켜져 있어도 서버가 409로 거절할 수 있다.

```plain
확인 버튼
├─ 역할에 OPERATOR 없음(로그인 응답 user.roles) ──────────── 숨김 · 툴팁 "확인은 운영자만"
├─ 행 state = CLEARED ───────────────────────────────── 비활성 · "해제된 알람"
├─ 행 acked_at 채워짐 ─────────────────────────────── 비활성 · 확인자 · 확인 시각 표시
└─ 행 state = ACTIVE · acked_at 비어 있음 ─────────────────────────────── 활성
   ├─ 200 ────────────────────────── 목록 재조회 → 확인자 · 확인 시각 채워진 행
   ├─ 409 alarms.ack_not_allowed ──────── "이미 확인됐거나 해제된 알람" · 목록 재조회
   ├─ 404 common.not_found ─────────────────────────── "대상이 없다" · 목록 재조회
   └─ 403 auth.forbidden ──────────────── 제자리 안내 · 역할 표시와 서버가 어긋났다
```

- **CLEARING 중인 알람도 버튼이 켜진다.** 해제 대기 중인 행은 alarm_event에서 아직 state ACTIVE이므로 확인할 수 있고(REQ-ALM-14), 확인은 시작된 해제 디바운스를 끊지 않는다 — 해제는 디바운스가 끝나야 확정된다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §ACK와 alarm:state). 화면은 Redis 상태를 모르므로 CLEARING을 따로 표시하지 않는다.
- **409는 경합의 정상 결과다(B형).** 결론 — 목록을 읽은 뒤 해제가 확정되거나 다른 운영자가 먼저 확인하면 409가 온다. 반대 시나리오 — 조건 없이 갱신하면 확인 없이 해제된 알람에 사후 확인이 붙어 "해제 시점까지 아무도 보지 않았다"는 사실이 사라진다. 파생 지침 — 화면은 같은 요청을 재시도하지 않고 목록을 다시 읽는다.
- **낙관적 갱신을 하지 않는다.** 응답 전에 행을 확인됨으로 바꾸면 409 때 되돌리는 순간 운영자가 두 상태를 본다([01_standards.md](./01_standards.md) §에러 코드별 사용자 표시).
- **확인한 알람은 해소되면 디바운스 없이 곧바로 닫힌다**(REQ-ALM-16) — 목록의 해제 시각이 확인하지 않은 알람보다 빨리 채워지는 것은 결함이 아니다.

### 실시간 겹침

목록은 BFF no-store지만 서버 쪽 cache:alarmevents가 확인 커밋 뒤에만 지워진다. **발생 · 해제는 목록 캐시 TTL만큼 늦게 목록에 반영된다**(REQ-ALM-13) — 그 창을 WebSocket 통지가 메운다.

| 사건 | 겹침 층 동작 | 목록 동작 | 겹침이 사라지는 때 |
|------|------|------|------|
| ch:alarm 열림 수신 | 새 행을 겹침 층에 "목록 반영 대기"로 띄운다 · 확인 버튼 없음 | 그대로 | 목록 재조회 결과에 같은 이벤트가 나타날 때 · 또는 목록 캐시 TTL 경과 뒤 재조회 |
| ch:alarm 닫힘 수신 | 목록에 있는 행이면 해제 표지를 덧칠 · 없으면 겹침 행에 해제 표지 | 그대로 | 상동 |
| 확인 성공(자기) | 해당 없음 | 쓴 탭은 곧바로 재조회 — 서버가 cache:alarmevents를 지웠다 | 해당 없음 |
| WebSocket 재연결 | 겹침 층을 비운다 | 재조회 1회 — 끊긴 동안 놓친 통지를 목록이 메운다 | 해당 없음 |

- 검산: 사건 = **4**
- **겹침 행에 확인 버튼을 두지 않는다.** 통지 페이로드는 저장이 아니라 알림이다 — 확인 대상은 alarm_event 행이고, 목록에 행이 나타나기 전 확인을 허용하면 캐시 창 안에서 서버 조건 판정과 화면 판정이 다른 행을 본다.
- **통지 누락은 알람 확정에 영향을 주지 않는다**(REQ-RLT-14). ch:alarm은 전달을 보장하지 않으므로 겹침 층은 보조이고 진실은 목록이다. 겹침이 없다는 이유로 알람이 없다고 판단하지 않는다.
- **다른 운영자의 확인은 푸시되지 않는다.** ch:alarm은 열림 · 닫힘만 싣는다 — 다른 화면의 확인 표시는 목록 TTL만큼 늦고, 그 사이 같은 행을 누르면 409가 온다([../07_api/07_alarms.md](../07_api/07_alarms.md)). 409 뒤 목록 재조회가 그 창을 닫는다.
- 겹침이 사라지는 상한은 cache:alarmevents TTL(현행 참고 30초 · 지터 없음 · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md))이다 — 화면은 겹침 행이 생긴 뒤 그 TTL이 지나면 목록을 한 번 다시 읽는다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 탭 머리와 필터를 먼저 그리고 목록 행만 스켈레톤. 탭 전환 중에는 이전 탭 목록을 지운다 — 활성 탭의 행을 이력 탭으로 오인하지 않게 |
| 빈 값 | ① 활성 0 · 미확인 0 — "열린 알람이 없다"(정상 상태) ② 이력 범위에 0 — "이 범위에 발생한 알람이 없다"와 범위 표시 ③ **규칙 0**(S7 첫 기동 — 규칙은 시드하지 않는다) — "판정 규칙이 없다"와 ALM-RULES 링크 |
| 오류 | common.postgres_unavailable/503 · alarms.ack_not_allowed/409 · common.not_found/404 · auth.forbidden/403 · common.rate_limited/429 · common.validation_failed/400(범위) — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시. PostgreSQL 불가 중에도 **실시간 겹침은 받는다** — 다만 PostgreSQL이 멈추면 새 알람이 확정되지 않아(REQ-ALM-10) 새 통지도 오지 않는다 |
| 정상 | 행마다 심각도(1 LOW · 2 MEDIUM · 3 HIGH) · 발생값 · 발생 시각 · 해제 시각 · 확인 여부. **다른 운영자의 확인은 ch:alarm에 실리지 않아 목록 캐시 TTL(cache:alarmevents)만큼 늦게 이 화면에 반영된다** — 쓴 탭만 즉시 본다. 발생 · 해제 시각은 **행 ts 기준**(측정 시각)이라 적체 소진 중 확정된 이벤트도 원래 시각에 놓인다. 확인은 "확인자 · 시각", 비활성 태그는 "태그 비활성 — 판정 중단" |

- **발생 시각이 확정 시각이 아닌 이유** — occurred_at은 디바운스를 채운 행의 ts다. 벽시계로 쓰면 ClickHouse 중단 뒤 적체 소진 중 확정된 이벤트가 소진 시각에 몰려 알람 폭주로 보인다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §디바운스 전이와 세 쓰기).

### 호출 표면

| 표면 | 호출 시점 | 경로 | 쓰는 응답 필드 |
|------|------|------|------|
| GET /api/v1/alarms/events | 진입 · 탭 · 필터 변경 · 더 보기 · 확인 뒤 · 재연결 뒤 · 겹침 TTL 경과 | BFF(no-store) | items(eventId · ruleId · tagId · severity · state · triggerValue · occurredAt · clearedAt · ackedBy · ackedAt · tagIsActive 등 — 필드 정본 [../07_api/07_alarms.md](../07_api/07_alarms.md)) · meta.nextCursor |
| POST /api/v1/alarms/events/{id}/ack | 확인 버튼 | BFF | 200이면 목록 재조회 · 409 · 404 · 403 |
| WS /ws/realtime | 공통 셸 연결 · 이 화면은 알람 통지만 쓴다 | 직결 | alarm 메시지(eventId · ruleId · tagId · transition OPENED · CLEARED · ts · severity) — 확인은 푸시되지 않는다 |

- 검산: 표면 = **3**
- **범위 조건은 언제나 쿼리에 실린다** — 화면이 from을 생략해도 서버가 필터별 기본 범위를 채운다(REQ-ALM-13 · 07_api/07_alarms 판정). 열린 · 미확인 조회의 넓은 기본 범위가 싼 이유는 부분 인덱스가 파티션마다 열린 · 미확인 행만 담기 때문이다.

## ALM-RULES — 알람 규칙 관리 · 판정 분석

| 항목 | 내용 |
|------|------|
| 화면 코드 | ALM-RULES |
| 웹 경로 | /alarms/rules · /alarms/rules/{rule_id}(편집 · 분석 패널) |
| 페르소나 | 엔지니어(주) · 현장 운영자(규칙 열람) |
| 역할 | 규칙 조회는 인증 사용자 전원 · **규칙 쓰기 ENGINEER만** · **판정 이력 분석 ENGINEER만**(REQ-ALM-17 · 18) |
| 도입 단계 | S7 |
| 요청 경로 | 규칙 조회 · 쓰기는 BFF 경유 no-store · 판정 이력 분석은 api 직결 · 태그 선택 목록은 BFF 경유 |

**목적**: 이 임계값은 오탐이 많은가 — 판정 전수의 min · max 쌍으로 위반 분포를 보고 규칙을 고친다.

**진입**: 공통 셸 메뉴 · ALM-CONSOLE 규칙 링크 · 쿼리 문자열(규칙 · 분석 범위).

```plain
┌─ 규칙 목록 ─────────────────────────┬─ 규칙 편집 ─────────────────────────────┐
│ 태그        조건        심각도 사용   │ 태그 [온도-1 ▾](설비12)                  │
│ 온도-1      GT 80       HIGH   ✓     │ 조건 [GT ▾] 임계 [80] 하한 [—]            │
│ 압력-2      LT 0.9      MEDIUM ✓     │ 디바운스 [5000] ms  심각도 [HIGH ▾] 사용 [✓] │
│ 유량-3(비활성) OUT 1~9  LOW    ✓     │ [저장]   [비활성화]                      │
│ [+ 규칙 추가]                        ├─ 판정 분석(ENGINEER) ──────────────────────┤
│                                     │ 범위 [최근 7일 ▾]  [원 시계열 보기]        │
│                                     │  min~max 밴드 · 임계선 · 위반 표지(ECharts) │
│                                     │  빈 버킷(evalCount 0) 주의 표지            │
└─────────────────────────────────────┴──────────────────────────────────────────┘
```

- **삭제 버튼이 없다.** 규칙을 지우면 그 규칙이 연 과거 alarm_event가 참조를 잃어 어느 임계값이 이벤트를 만들었는지 복원할 수 없다(REQ-ALM-01) — 끄는 수단은 사용 해제(enabled 거짓)다.
- **분석 패널은 규칙 편집과 한 화면이다.** 임계값을 고치는 사람이 같은 자리에서 판정 전수를 보게 해 튜닝 루프를 끊지 않는다 — 이것이 규칙 변경을 ENGINEER에게 준 근거다(권한 매트릭스 §역할 정의).

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 규칙 목록 | 좌측 | 태그 · 조건 · 임계 · 심각도 · 사용 여부 · 대상 태그 활성 여부 | ALM-01(조회) | GET /api/v1/alarms/rules(BFF 경유 · tagId · enabled 필터) |
| 규칙 추가 · 편집 폼 | 우측 위 | 태그 · 조건 4종 · 임계 · 하한(OUT_OF_RANGE만) · 디바운스 · 심각도 · 사용 · **편집 모드에서 태그 · 조건은 읽기 전용** | ALM-01(쓰기) | POST /api/v1/alarms/rules · PATCH /api/v1/alarms/rules/{id}(BFF 경유) |
| 비활성화 | 편집 폼 | 사용 해제(enabled false) — 물리 삭제 없음 | ALM-01(쓰기) | PATCH /api/v1/alarms/rules/{id} |
| 태그 선택기 | 편집 폼 | 사이트 → 설비 → 태그 · 비활성 태그는 선택할 수 없다 | MST-04(조회) | GET /api/v1/sites · GET /api/v1/devices · GET /api/v1/tags(BFF 경유) |
| 판정 분석 차트 | 우측 아래 | 선택 규칙의 alarm_eval을 범위로 읽어 버킷별 min · max 밴드 · 현재 임계선 · 위반 비율(breachCount ÷ evalCount)을 그린다 | ALM-09 | GET /api/v1/alarms/evaluations(직결 · ruleId · from · to · maxPoints) |
| 빈 버킷 주의 표지 | 분석 차트 | evalCount 0인 버킷을 "판정 없음 또는 기록 실패"로 표시 — 둘을 가르는 무효 구간 표지가 응답에 없다 | ALM-09 | 상동 |
| 원 시계열 보기 | 분석 패널 | 같은 태그 · 범위로 ANL-TREND 딥링크 | TSQ-01(목적지) | 해당 없음 — 이동 |

- 검산: 요소 = **7** · 이 화면이 표면을 호출하는 기능 = ALM-01 · ALM-09 · MST-04 = **3**
- **빈 버킷을 "위반 0"으로 그리지 않는다.** alarm_eval 삽입이 재시도를 소진하면 그 구간은 격리하지 않고 비워 둔다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §alarm_eval 재시도와 격리). 응답이 무효 구간을 싣지 못하므로(기록 자리 미설계 — [../07_api/07_alarms.md](../07_api/07_alarms.md)) 화면은 evalCount 0 버킷을 위반 0과 다른 색으로 둔다 — 같게 그리면 기록 실패 구간을 "오탐 없음"으로 읽어 임계값을 느슨하게 고친다.
- **임계선은 현재 규칙이다.** 응답 meta.rule은 현재 값이라 과거 구간의 임계선은 그 시점 값이 아닐 수 있다 — 화면은 범위 안에 규칙 변경이 있었으면 "임계값 변경 이력은 감사 로그" 안내를 둔다.

### 규칙 폼 검증

서버 검증(REQ-ALM-04)을 화면이 먼저 막는다. 화면 검증은 입력 편의이고 서버 400이 최종이다.

| 필드 | 화면 검증 | 서버 거절 | 근거 |
|------|------|------|------|
| 태그 | 필수 · 활성 태그만 · 편집 모드에서 불변 | 없는 태그 · 비활성 태그 400 | REQ-ALM-04 · 07_api/07_alarms |
| 조건 | GT · LT · OUT_OF_RANGE · RATE_OF_CHANGE 중 하나 · 편집 모드에서 불변 — 바꾸려면 새 규칙 등록 후 옛 규칙 끄기 | 허용 밖 · 불변 필드 400 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 저장 enum |
| 임계 | 필수 · 수치 · RATE_OF_CHANGE면 단위 "초당 변화량" 표기 | 형식 위반 400 | 조건 정의 |
| 하한 | **OUT_OF_RANGE일 때만 보이고 필수** · 하한 < 임계 | 하한 없는 OUT_OF_RANGE 400 | REQ-ALM-04 |
| 디바운스 | 필수 · 0 이상 정수 ms | 형식 위반 400 | 상태 머신 PENDING → ACTIVE |
| 심각도 | 1 LOW · 2 MEDIUM · 3 HIGH | 1~3 밖 400 | 저장 enum |
| 사용 | 기본 참 | 해당 없음 | REQ-ALM-01 |

- 검산: 필드 = **7**
- **저장 확인 문구가 판정 반영 시점을 말한다.** "다음 판정 배치부터 새 임계값이 쓰인다 · 이미 대기(PENDING) 중인 위반은 새 임계값으로 이어 판정한다"([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §규칙과 상태의 조회). 문구가 없으면 저장 직후 열린 알람이 옛 임계값 기준이라는 사실을 결함으로 읽는다.
- **스케일 변경으로 대상 태그가 비활성이 된 규칙은 자동으로 옮겨지지 않는다.** 목록의 "비활성" 표지 행에 "새 태그에 규칙을 새로 만든다" 안내를 둔다 — 임계값은 공학 단위 값이라 옮겨 붙이면 섭씨 80이 화씨 80이 된다(07_api/04_master 새 태그 발급 판정).

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 목록 · 폼 골격을 먼저 그린다. 분석 차트는 규칙을 고른 뒤에만 조회하고 그동안 축만 그린다 — 진입 즉시 분석을 부르면 대량 스캔 한도를 열람만으로 쓴다 |
| 빈 값 | ① **규칙 0** — "규칙이 없다 · 여기서 만든다"(시드하지 않는다 — 규칙 쓰기의 감사와 무효화 체인이 시연 안에서 함께 검증된다) ② 분석 범위에 alarm_eval 행 0 — "이 범위에 판정 기록이 없다" · 규칙 생성 이전 범위인지 안내 ③ ENGINEER 아닌 사용자 — 분석 패널 자리에 "판정 분석은 엔지니어만" |
| 오류 | common.validation_failed/400(비활성 태그 규칙 등록 · 불변 필드 포함) · common.not_found/404 · auth.forbidden/403 · common.rate_limited/429(분석 — 대량 조회 한도) · common.postgres_unavailable/503(규칙) · alarms.eval_store_unavailable/503(분석 — ClickHouse 불가 · 규칙 편집은 계속) — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 규칙 목록 · 편집 폼. 분석 차트는 버킷별 min · max 밴드 · 현재 임계선 · 위반 버킷 표지 · 빈 버킷 주의 표지. 보존 창(현행 참고 30일) 밖 구간은 빈 points다. 늦게 도착한 행의 판정도 alarm_eval에 남아 차트에 보인다 — 상태 전이는 일으키지 않았더라도 |

### 호출 표면

| 표면 | 호출 시점 | 경로 | 쓰는 응답 필드 |
|------|------|------|------|
| GET · POST /api/v1/alarms/rules · PATCH /api/v1/alarms/rules/{id} | 진입 · 저장 · 신호 무효화 뒤 | BFF(no-store) | 규칙 객체(ruleId · tagId · conditionType · threshold · thresholdLow · debounceMs · severity · enabled) |
| GET /api/v1/alarms/evaluations | 규칙 선택 · 범위 변경 | 직결 | meta(interval · from · to · columns · pointCount · rule) · points [ts, min, max, breachCount, evalCount] |
| GET /api/v1/sites · GET /api/v1/devices · GET /api/v1/tags | 태그 선택기 | BFF | 식별자 · 이름 · isActive |

- 검산: 표면 묶음 = **3**(규칙 3 · 분석 1 · 선택 목록 3 — 7개 표면)
- **규칙 저장 뒤 다른 사용자 화면은 체인 ⑥ 신호로 갱신된다** — cache:alarmrules 키 이름이 ch:cacheinv로 오면 alarm · rules 쿼리를 무효화한다([01_standards.md](./01_standards.md) §무효화 신호 수신). 쓴 탭은 저장 응답으로 즉시 무효화한다.
- 분석 요청은 min · max 쌍을 돌려받는다 — 평균만 받으면 임계값 근처의 순간 초과가 사라져 오탐 분석 근거가 없어진다(REQ-ALM-17 · 원본 data_flow.md §6.3).

## 스위치 · 장애 영향

두 화면에 공통으로 걸리는 영향이다.

| 조건 | ALM-CONSOLE | ALM-RULES | 근거 |
|------|------|------|------|
| SW-06 off | 겹침 통지 내용 같다 — 발행자가 게이트웨이를 직접 부른다 | 영향 없음 | REQ-RLT-17 |
| ClickHouse 중단 | 새 알람 없음 — 판정은 적재 확정 뒤에만 시작한다 | 분석 503 alarms.eval_store_unavailable · 규칙 편집은 정상 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §판정 한 배치 |
| alarm_eval 삽입만 실패 | 알람 발생 · 해제 · 통지 정상 | 해당 구간이 빈 버킷 주의 표지로 보인다 | AC-36 |
| PostgreSQL 중단 | 목록 · 확인 503 · 새 알람 미확정(대기 상태 유지) · 통지 0 | 규칙 조회 · 쓰기 503 · 분석은 정상 | REQ-ALM-19 · AC-36 |
| Redis 중단 | 통지 끊김 · 새 알람 없음(판정이 봉인 계열 실패로 중단) · 목록은 PostgreSQL 직행 degrade | 규칙 조회는 PostgreSQL 직행 degrade · 분석 정상 | REQ-ALM-07 · AC-31 |
| 그 밖의 스위치 | 영향 없음 | 영향 없음 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |

- 검산: 조건 = **6**
- **B형 — alarm_eval이 비어도 알람 콘솔은 멀쩡하다.** 결론 — 세 쓰기는 한 트랜잭션이 아니고 진실은 alarm_event다. 반대 시나리오 — 셋을 묶으면 ClickHouse 문제 하나로 운영자가 알람을 받지 못한다(REQ-GLB-13). 파생 지침 — 판정 전수의 빈 구간은 규칙 화면에서만 드러나고 콘솔에는 표시하지 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 분석 무효 구간의 기록 자리 · 응답 표지 | **W6 판정** — 자리는 계수 alm_eval_gap_* + 구조화 로그 이벤트 · 분석 API 응답 표지는 두지 않는다 — 화면은 evalCount 0 주의 표지로 버틴다 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) §구간 기록 |
| 알람 통지 도달 지연 · 판정 구간 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) · EXP-30 · EXP-33 |
| 비활성 태그의 열린 알람을 닫는 수단 | 범위 밖 — 확인만 가능 | [../02_features/09_alarms.md](../02_features/09_alarms.md)(리드) |

## 관련 문서

- [01_standards.md](./01_standards.md) — 에러 표시 · 캐시 정렬 · 신호 수신
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — 판정 · 세 쓰기 · ACK 기전
- [../02_features/09_alarms.md](../02_features/09_alarms.md) — ALM 기능 정본
- [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) — REQ-ALM 계약
- [../07_api/07_alarms.md](../07_api/07_alarms.md) — 알람 표면
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 알람 상태 머신 · 규칙 enum
- [03_realtime_dashboard.md](./03_realtime_dashboard.md) — 알람 띠 · 태그 딥링크
