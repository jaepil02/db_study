# 실험 콘솔 (07_experiment_console)

> **대상**: ★ EXP-CONSOLE(스위치 11종의 실제 주입 구현 표시 · 저장소 상태 · 조합 경고 · 메트릭 요약 · 전환 절차 안내 · 측정 기록 4요소 조건 블록) · EXP-COMPARE(on/off · 구현값 비교 · 측정 창 · 대조군 역전 지점 표시) — 인증 사용자 전원 · **표시 전용**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 기계 판독 형식 · 메트릭 이름 · EXP 번호 반영 · 조합 경고 7 → 9(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 콘솔 폴링 주기 현행값 15초(스크레이프 주기와 같음 · 09_tech_stack/01)
> **원천**: 원본 implementation_plan.md §3.1 · §4 · §4.1 · §4.2 · §4.3 · §5 S2 · §8(커밋 ff66a37) · 원본 architecture.md §3 · §11 · §14(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #14 · D-06 · D-10 · REQ-OBS-01~12 · AC-18 · AC-20 · AC-24 · AC-25 · AC-29 · AC-33 · AC-34 · AC-39~AC-44 · 기능 OBS-01~06 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §실험 수행자와 실험 콘솔 · [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) · [../07_api/09_datagen.md](../07_api/09_datagen.md) 실행 제어 표면 판정 · [../10_observability/README.md](../10_observability/README.md) · [01_standards.md](./01_standards.md)

이 문서는 학습 목표 2축의 산출이 사람 눈에 닿는 자리 두 곳을 명세한다. **실험 콘솔은 스위치를 켜고 끄는 화면이 아니다.** 스위치는 환경변수 + DI 초기화 선택이라 전환에 api 재기동이 필요하고(D-06), 콘솔은 **지금 무엇이 주입됐는지 표시 · 전환 절차 안내 · 측정 창 비교**만 한다(보정 #14 · REQ-OBS-12). 생성기 실행 · 부하 주입 게이트 · 저장소 수동 실습도 전부 호스트 셸의 일이다 — 생성기 실행 · 상태 표면은 두지 않기로 판정됐다([../07_api/09_datagen.md](../07_api/09_datagen.md)).

**콘솔의 수치는 측정 기록이 아니다.** 측정 기록의 정본은 docs/measurements이고 모든 수치에 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 4요소와 3회 중앙값이 붙어야 한다(D-10 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)). 콘솔은 그 기록을 만들 때의 **관찰 보조**이고, 4요소가 없는 화면 수치를 본문에 올리지 않는다.

## EXP-CONSOLE — 실험 콘솔

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-CONSOLE |
| 웹 경로 | /experiments |
| 페르소나 | 실험 수행자(주) · 누구나 열람 |
| 역할 | S7 이후 **인증 사용자 전원 · 표시 전용** — 데이터 원천(health · metrics)이 이미 공개 표면이라 역할로 막으면 방어가 아니라 불편이다(권한 매트릭스 판정) · S2~S6 무인증 |
| 도입 단계 | S2(스위치 상태 · 저장소 상태 — SW-02 · SW-03만 먼저) · S3~S6에 스위치 · 메트릭이 단계마다 늘어난다 |
| 요청 경로 | health · metrics 모두 BFF 경유 — BFF가 메트릭 텍스트를 해석해 요약만 내린다([../07_api/01_conventions.md](../07_api/01_conventions.md) §BFF 경유와 직결) |

**목적**: 지금 어떤 구성으로 떠 있는가 — 11개 스위치 각각에 **실제로 주입된 구현**을 보고, 이 구성으로 무엇을 재도 되는지(조합 경고)와 기록에 적을 조건을 얻는다.

**진입**: 공통 셸의 실험 조건 배지 · 메뉴. 배지는 기본값과 다른 스위치 수를 보이고 누르면 이 화면이다.

```plain
┌─ 저장소 ─ PostgreSQL ● · ClickHouse ● · Redis ●   health 200 · 조회 10:15:03.120 KST ─┐
├─ 스위치 11 ───────────────────────────────────────────────────────────────────────┤
│ ID    환경변수              기본값    주입 구현(현재)                기본값과 같은가 │
│ SW-02 REDIS_LATEST_CACHE    on        ClickHouseLatestValueReader    ✕ 다름          │
│ SW-07 WS_THROTTLE_MS        100 ms    WindowMergeThrottle(100 ms)    ✓               │
│ SW-11 LATEST_VALUE_WRITER   ingest    IngestLatestValueWriter        ✓               │
├─ 조합 경고 ─ ⚠ SW-02 off — SW-11 비교를 이 구성으로 재지 않는다(조합 제약 #7) ──────────┤
├─ 메트릭 요약 ─ 컨슈머 랙 · E2E p50 · p95 · p99 · 백프레셔 단계 · 미확인 적체 · 스풀 · DLQ ─┤
│               키 계열별 메모리(stream · rt · alarm · cache · lock · rl · auth) · 생성기 pps │
├─ 전환 절차 ─ ① 환경변수 ② api 재기동 ③ 주입 구현 확인 ④ 복원 ⑤ 기록 ────────────────────┤
├─ 기록 조건 블록 ─ [복사]  커밋 a1b2c3d · 프로파일 부하 실험 · 티어 M · 스위치 SW-02=off 그 외 기본값 · 게이트 ? ─┤
└─ [정밀 측정 모드 — 폴링 정지] ────────────────────────────────────────────────────┘
```

- **토글이 없다(A형).** 통념은 실험 콘솔이 스위치를 바꾸는 곳이라는 것이다. 부정 — 런타임 토글은 결국 조회 경로 안의 if가 되어 분기 자체가 측정 대상 코드에 섞인다(원본 implementation_plan.md §4.3). 진짜 축은 **스위치가 모듈 초기화 때 고르는 구현체**라는 것이다. 대체 경로 — 전환 절차 안내를 따라 호스트 셸에서 바꾸고 이 화면으로 결과를 확인한다.
- **기록 조건 블록은 측정 기록 4요소를 전부 health에서 채운다**(W5 리드 판정 — 커밋 해시 · 메모리 프로파일 · 용량 티어를 health에 노출 · 필드 정본 [../07_api/10_metrics.md](../07_api/10_metrics.md)). 수기로 남는 칸은 부하 주입 게이트 켜짐 여부 하나다 — 스위치가 아니라 health에 싣지 않는다. 손으로 옮겨 적는 칸이 줄수록 기록 조건과 실제 기동이 어긋날 자리가 준다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 저장소 상태 | 머리 | PostgreSQL · ClickHouse · Redis 각각의 가용 · 불가 · 응답 시각 · health HTTP 200 · 503 | OBS-05 | GET /api/v1/health(BFF) |
| 스위치 11 표 | 본문 위 | §스위치 11 표시의 열 · 기본값과 다른 행 강조 · SW-01 off 부팅 경고 | OBS-06 | GET /api/v1/health(BFF) · GET /metrics(BFF — 스위치 상태 레이블) |
| 조합 경고 | 스위치 표 아래 | 현재 주입 구현을 §조합 경고 표에 대조해 해당 경고만 띄운다 | OBS-06 | 상동 |
| 앱 · 파이프라인 메트릭 요약 | 본문 가운데 | 컨슈머 랙 · 백프레셔 단계 · 미확인 적체 · 스풀 · DLQ · 캐시 히트율 · 생성기 pps · 모드 C 거절 수 | OBS-01(보조) | GET /metrics(BFF 해석) |
| 저장소 메트릭 요약 | 본문 가운데 | 저장소별 연결 · 느린 쿼리 · 파트 수 등 | OBS-02 | 상동 |
| 키 계열별 메모리 | 본문 가운데 | 접두별 점유 막대 — 봉인 계열(stream · rt · alarm)과 캐시 계열을 색으로 가른다 | OBS-03 | 상동 |
| E2E 지연 게이지 | 본문 가운데 | 최근 창의 ingested_at − ts p50 · p95 · p99 | OBS-04 | 상동 |
| 전환 절차 안내 | 본문 아래 | §전환 절차의 정적 안내 | 해당 없음 — 정적 | 해당 없음 |
| 기록 조건 블록 | 본문 아래 | 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태를 기록 템플릿의 조건 표 모양으로 만들어 복사 · 게이트 칸만 수기 | OBS-06 | GET /api/v1/health(BFF) |
| 정밀 측정 모드 | 바닥 | 켜면 이 화면의 모든 폴링을 멈추고 "관찰 정지" 표지 — 브라우저 안 설정 | 해당 없음 — 화면 동작 | 해당 없음 |

- 검산: 요소 = **10** · 이 화면이 호출하는 기능 = OBS 6(01 보조 · 02 · 03 · 04 · 05 · 06)
- **메트릭 이름은 이 문서가 정하지 않는다.** 요약 카드는 계열(컨슈머 랙 · E2E · 백프레셔 단계 등)로 적고 이름과 레이블은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다(W6 — 컨슈머 랙 consumer_lag · 단계 backpressure_stage · E2E e2e_latency 등). BFF 해석 결과의 필드 모양은 [../07_api/10_metrics.md](../07_api/10_metrics.md)가 정한다.
- **가장 중요한 단일 지표는 컨슈머 랙이다**([../10_observability/README.md](../10_observability/README.md)). 요약 카드의 첫 자리에 두고, 백프레셔 단계(정상 · 주의 · 경고 · 위험 · 복구)를 그 옆에 둔다 — 랙이 오르는데 단계가 정상이면 판정량(미확인 적체)과 랙의 산출식 차이를 의심할 자리다.

### 스위치 11 표시

스위치의 채번 · 포트 · 구현 이름의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)와 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)다. **"현재" 열은 환경변수 문자열이 아니라 health switches.*.impl(주입 구현)과 value다**(REQ-OBS-11) — 표의 행은 health의 switches 키에서 만들고 아래 표는 기본 · 대안 대조용이다.

| ID | 환경변수 | 분류 | 기본 구현 | 대안 구현 | 화면이 강조하는 경우 |
|------|------|------|------|------|------|
| SW-01 | REDIS_STREAM_BUFFER | 백프레셔 | RedisStreamBuffer | InProcessQueueBuffer | 대안이면 빨간 경고 + switches.SW-01.warning(stream_boundary_bypassed)과 문구 "실험 전용 · 정상 경로 아님" |
| SW-02 | REDIS_LATEST_CACHE | 캐시 | RedisLatestValueReader | ClickHouseLatestValueReader | 대안 |
| SW-03 | REDIS_QUERY_CACHE | 캐시 | RedisTimeseriesCache | NoopTimeseriesCache | 대안 |
| SW-04 | CACHE_KEY_TIME_SNAP | 캐시 | TimeSnapKeyNormalizer | RawTimeKeyNormalizer | 대안 |
| SW-05 | CACHE_STAMPEDE_LOCK | 캐시 | RedisRebuildLock | NoopRebuildLock | 대안 |
| SW-06 | REDIS_PUBSUB_FANOUT | 팬아웃 | RedisPubSubFanout | DirectGatewayFanout | 대안 |
| SW-07 | WS_THROTTLE_MS | 팬아웃 | WindowMergeThrottle(창 ms 병기) | PassthroughThrottle(0) | 대안 · 또는 창 값이 기본값과 다름 |
| SW-08 | INGEST_IDEMPOTENCY | 멱등 | DeterministicBatchToken | NoBatchToken | 대안 |
| SW-09 | CONTROL_TABLE_ENABLED | 대조군 | NoopControlSink(off) | PostgresControlSink(on) | on — 목표 ② 처리량 측정 경고와 함께 |
| SW-10 | COLLECTOR_DEADBAND | 수집 | PassthroughFilter(off) | TagDeadbandFilter(on) | on — 성능 측정 경고와 함께 |
| SW-11 | LATEST_VALUE_WRITER | 최신값 결합 | IngestLatestValueWriter(ingest) | CollectorLatestValueWriter(collector) | collector — 켜고 끄는 스위치가 아니라 구현 선택이라 "다름"으로만 표시 |

- 검산: 스위치 = 백프레셔 1 + 캐시 4 + 팬아웃 2 + 멱등 1 + 대조군 1 + 수집 1 + 최신값 결합 1 = **11** · 값 형식 = 불리언 9 + 밀리초 1(SW-07) + 구현 선택 1(SW-11) = **11**
- **"현재" 열이 환경변수를 옮겨 적지 않는 이유(B형).** 결론 — 화면은 기동 때 실제로 주입된 구현을 보인다. 반대 시나리오 — 환경변수 문자열을 보이면 REDIS_LATEST_CACHE=of 같은 오타로 기본 구현이 주입된 기동이 off로 표시되어, on으로 잰 수치가 off 기록에 들어간다. 파생 지침 — 기록 조건 블록도 주입 구현에서 만든다.
- **스위치가 늘면 이 표 · 조합 경고 · 기록 조건 블록을 같은 변경 단위에서 고친다**([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) §스위치 추가 · 변경 절차). 화면은 health가 모르는 스위치를 만들지 않고, health에 있는데 이 표에 없는 스위치는 "표에 없는 스위치" 행으로 그대로 보인다 — 조용히 숨기면 기록에서 빠진다.
- 구현 이름의 대응(기본 · 대안)은 13_switch_matrix의 측정 · 교체 표를 옮긴 것이다. SW-09 · SW-10은 기본값이 off라 기본 구현이 Noop · Passthrough 쪽이다.

### 조합 경고

[../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) §조합 제약 9건을 현재 주입 구현만으로 판정해 띄운다. 제약의 강제는 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)가 하고 화면은 알리기만 한다.

| 조합 제약 | 화면 판정 조건 | 경고 문구 |
|------|------|------|
| #1 | SW-03 대안 | "캐시가 없다 — SW-04 · SW-05 on/off 차이는 0이다 · 이 구성으로 비교하지 않는다" |
| #2 | SW-01 대안 | "Stream 경계가 없다 — 주입 모드 A로만 실험한다(모드 B · C 금지)" |
| #3 | SW-01 대안 | "멱등 수치를 이 구성으로 재지 않는다 — 배치 토큰 재료(엔트리 ID)가 없다" |
| #4 | SW-09 on | "대조군 적재가 켜졌다 — 목표 ② 처리량 측정과 섞지 않는다" |
| #5 | SW-10 on | "데드밴드가 켜졌다 — 처리량 · 행 수 · 압축률 성능 측정에 쓰지 않는다" |
| #6 | SW-06 대안 | "팬아웃 직접 호출 — api 인스턴스 1에서만 성립한다" |
| #7 | SW-02 대안 | "SW-11 비교를 이 구성으로 재지 않는다 — 최신값 조회가 rt:latest를 읽지 않는다" |
| #8 | SW-10 대안(on) | "데드밴드는 주입 모드 A에서만 돈다 — 모드 B · C · D로 재지 않는다" |
| #9 | SW-11 대안(collector) | "collector 갱신은 주입 모드 A에서만 돈다 — 모드 B · C · D에서는 최신값을 쓰는 주체가 없다" |

- 검산: 조합 제약 = **9** · 스위치 상태만으로 판정 가능 9 · 판정 불가 0 — #2 · #8 · #9의 "모드"와 #6의 "인스턴스 수"는 화면이 모르므로 경고는 조건을 알리기만 한다
- **경고는 측정을 막지 않는다.** 콘솔은 표시 전용이다 — 막을 수단이 있다면 그것이 곧 실험 손잡이의 인가 판정이 되어 "실험은 앱 권한으로 막는다"는 오해를 만든다(권한 매트릭스 버린 대안 ①).

### 전환 절차

스위치 전환은 호스트 셸에서 한다. 화면은 순서를 안내하고 ③에서 결과를 확인시킨다.

```plain
① 환경변수 변경       .env의 해당 변수(예: REDIS_LATEST_CACHE=off) — .env는 커밋하지 않는다
② api 재기동          환경변수는 모듈 초기화 때만 읽힌다 — 명령 정본 09_tech_stack/04_local_environment
③ 주입 구현 확인      이 화면 새로고침 → "현재" 열이 대안 구현인가 · 조합 경고 확인
④ 기준 상태 복원      스냅샷 복원 · 캐시 키 초기화 — 절차 정본 10_observability/04_experiment_protocol
⑤ 측정 · 기록         측정 창을 EXP-COMPARE에서 잡고 · 기록 조건 블록을 docs/measurements에 붙인다
```

- **③을 건너뛰지 않는다.** 재기동 뒤 "현재" 열을 보지 않으면 오타 · 잘못된 파일 편집으로 기본 구현이 그대로 주입된 기동에서 측정한다 — 두 조건의 수치가 같게 나와 "스위치 효과 없음"이라는 거짓 결론이 기록된다.
- **재기동은 메트릭 누적값을 0으로 되돌린다.** 재기동 전에 잡은 측정 창은 재기동 뒤와 이어지지 않는다 — EXP-COMPARE는 창 안의 누적값 감소를 재기동으로 보고 그 창을 무효로 표시한다.
- **SW-01 off 기동은 부팅 경고를 남기고 상태로 노출한다.** 화면의 빨간 경고는 설정 오류가 아니라 경로의 등급 표시다 — off 측정은 S6 "off + ClickHouse 중단" 기록에만 남긴다(AC-33).

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 저장소 · 스위치 표 골격을 먼저 그리고 health가 오면 채운다. 메트릭 요약은 첫 해석 결과가 오기 전까지 카드 자리만 둔다 |
| 빈 값 | ① 단계상 아직 없는 메트릭(예: S2에는 랙 · E2E · 생성기 pps 3계열뿐 — 원본 implementation_plan.md §5 S2) — 카드에 "이 단계에서 아직 계측하지 않는다" ② health에 없는 스위치 — 행에 "도입 전(단계)" · 기본값과 비교하지 않는다 |
| 오류 | health 503은 에러가 아니라 **같은 본문의 저장소별 상태**로 그린다(REQ-OBS-09) — 불가 저장소만 빨간 점. BFF 해석 실패 · 네트워크 실패는 카드 머리 "메트릭을 읽지 못했다"와 마지막 성공 시각 · 인증 계열(S7)은 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 스위치 11행 · 저장소 3점 · 메트릭 카드 · 경고. 모든 수치 옆에 조회 시각(KST · 밀리초) — 화면 수치는 순간값이며 4요소가 없다는 표기를 카드 바닥에 둔다 |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| GET /api/v1/health | 진입 · 새로고침 · 폴링 | BFF | status(ok · degraded) · checkedAt · stores.*(status · latencyMs · error) · switches.*(name · value · impl · warning) — 필드 정본 [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| GET /metrics | 진입 · 폴링 | BFF가 텍스트를 해석해 요약만 | 계열별 요약값 · 스위치 상태 레이블 |

- 검산: 표면 = **2**
- **정밀 측정 중에는 이 화면이 측정 대상을 건드린다(B형).** 결론 — health 폴링은 매번 세 저장소에 실제 왕복을 하고(REQ-OBS-08), metrics 폴링은 api의 텍스트 생성과 BFF 해석을 같은 머신에 더한다(/metrics 자체는 저장소를 조회하지 않고 주기 수집의 마지막 값을 낸다). 반대 시나리오 — 콘솔을 띄운 채 측정하면 health 주기마다 세 저장소에 왕복이 끼어 p95 꼬리가 콘솔 주기에 맞춰 튄다. 파생 지침 — 정밀 측정 세션에서는 정밀 측정 모드로 폴링을 멈추거나 화면을 닫는다([../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) — 관측 대시보드를 끄는 것과 같은 규칙).
- 폴링 주기는 2계층 조정값이다 — 계약 이 문서 · 현행값 15초([../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) W6 판정). 계약은 "Prometheus 스크레이프 주기보다 짧지 않게"다 — 더 짧으면 콘솔이 스크레이프보다 큰 관측 부하가 된다. 캐시 층이 없어 staleTime은 0이다([01_standards.md](./01_standards.md) §갱신 주기와 캐시 층 정렬).

### 스위치 영향

- 이 화면은 스위치 상태를 **표시**하는 화면이라 모든 스위치가 표시를 바꾼다 — §스위치 11 표시 · §조합 경고가 그 전수다. 스위치가 이 화면의 동작(호출 · 갱신)을 바꾸지는 않는다.

## EXP-COMPARE — 실험 비교

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-COMPARE |
| 웹 경로 | /experiments/compare |
| 페르소나 | 실험 수행자 |
| 역할 | S7 이후 인증 사용자 전원 · 표시 전용 · S2~S6 무인증 |
| 도입 단계 | S4 — 캐시 · 팬아웃 스위치 on/off 비교가 시작되는 단계(AC-39~AC-41) · S2의 첫 비교(AC-18)는 k6 결과로 기록한다 |
| 요청 경로 | health · metrics BFF 경유 · 측정 기록은 **BFF가 docs/measurements를 읽기 전용으로 읽는다**(api 표면 아님) · **어디에도 쓰지 않는다** — 측정 창은 브라우저 안에만 둔다 |

**목적**: 이 스위치를 바꾸면 무엇이 얼마나 달라지나 — 두 조건의 측정 창을 나란히 놓고, 비교가 성립하는 조건인지 먼저 판정한다.

**진입**: EXP-CONSOLE 전환 절차 ⑤ · 메뉴.

```plain
┌─ 측정 창 ─ [창 시작 캡처] … [창 끝 캡처]   진행 00:02:14 ─────────────────────────────┐
├─ 조건 A: SW-02=RedisLatestValueReader  창 3/3 ✓ │ 조건 B: SW-02=ClickHouseLatestValueReader 창 2/3 ─┤
├─ 비교 가능성 ─ ✓ 다른 스위치 = SW-02 하나 · 재기동 감지 없음 · 편차 기준 이내 ─────────┤
├─ 비교 표 ─ 지표(SW-02 측정 대상) · A 중앙값 · B 중앙값 · 비 · 창별 편차 ────────────────┤
├─ 대조군 역전 지점(EXP-01~05) ─ 쿼리별 행 수 × 쿼리 시간 · PostgreSQL · ClickHouse 두 선 ─┤
│   원천 — BFF가 docs/measurements 기록을 읽기 전용으로 읽는다 · 4요소 없는 점은 제외        │
└─ 이 브라우저의 쌍 현황 ─ on/off 두 조건이 모두 있는 스위치 4/11 ─────────────────────┘
```

- **측정 창은 누적값의 차다.** /metrics의 카운터 · 히스토그램은 기동 이후 누적이라 한 번의 캡처로는 창의 분위수를 얻을 수 없다 — 창 시작 캡처와 끝 캡처의 버킷 차로 창 안의 p50 · p95를 계산한다.
- **측정 창은 브라우저 저장소에만 둔다.** 콘솔은 표시 전용이고 창을 서버에 쓰는 표면이 없다 — 창은 탭을 닫거나 브라우저를 바꾸면 사라질 수 있으며, 남길 것은 기록 파일에 옮긴다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 창 시작 · 끝 캡처 | 머리 | 누르는 순간 health(스위치 상태)와 metrics(누적값)를 함께 받아 창 경계로 저장 | OBS-01 · OBS-06 | GET /metrics · GET /api/v1/health(BFF) |
| 조건 묶음 | 머리 아래 | 창을 주입 구현 조합으로 자동 분류 · 조건당 창 최대 3 | OBS-06 | 상동(캡처 값) |
| 비교 가능성 판정 | 가운데 머리 | §비교 성립 조건을 대조해 성립 · 불성립과 이유 | OBS-06 | 해당 없음 — 캡처 값 계산 |
| 비교 표 | 가운데 | 대상 스위치의 측정 대상 지표 · 조건별 창 중앙값 · 비 · 창별 편차 | OBS-01 | 해당 없음 — 캡처 값 계산 |
| 대조군 역전 지점 | 가운데 아래 | EXP-01~05 쿼리별 역전 지점 선 차트(ECharts) · §대조군 역전 지점의 표시 계약 | 해당 없음 — 측정 기록 읽기 | api 표면 없음 — BFF 기록 읽기(docs/measurements · 읽기 전용) |
| 쌍 현황 | 바닥 | 이 브라우저에 on · off 창이 모두 있는 스위치 수 | OBS-06 | 해당 없음 |

- 검산: 요소 = **6** · 이 화면이 호출하는 기능 = OBS-01 · OBS-06 = **2**
- **쌍 현황은 AC-43의 화면 쪽 거울일 뿐이다.** AC-43의 합격은 docs/measurements에 전 스위치의 on · off 쌍이 4요소 · 3회 중앙값과 함께 있는 것이다 — 브라우저의 창은 그 증거가 되지 않는다.

### 비교 성립 조건

두 조건의 창을 나란히 놓기 전에 아래를 모두 통과해야 비교 표를 그린다. 통과하지 못하면 표 대신 이유를 보인다.

| 조건 | 판정 | 어기면 |
|------|------|------|
| 다른 스위치가 정확히 하나 | 두 조건의 주입 구현 11개를 대조해 다른 항목이 대상 스위치 하나 · SW-07은 창 값까지 대조 | 같은 조건이라 믿은 두 측정의 조건이 달라 차이를 한 스위치로 설명할 수 없다(D-10) |
| 창 안에 재기동 없음 | 창 끝 누적값 ≥ 창 시작 누적값(카운터 감소 없음) | 재기동으로 0이 된 카운터가 음의 차를 만들어 분위수가 뒤집힌다 |
| 조건당 창 3개 | 3회 중앙값 — 창이 모자라면 "n/3"만 보이고 비를 계산하지 않는다 | 한 번의 수치가 코어 배치에 따라 재현되지 않는다 |
| 편차 기준 이내 | 창별 편차가 폐기 기준 이내 — 기준 값 정본 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) | 흔들린 측정이 중앙값에 섞인다 |
| 조합 제약 밖 | 두 조건 어느 쪽도 대상 스위치의 조합 제약에 걸리지 않는다(예: SW-11 비교에 SW-02 off 금지) | 차이가 0으로 나와 "효과 없음"이 거짓으로 기록된다 |
| 나머지 3요소 같음 | 두 조건의 커밋 해시 · 메모리 프로파일 · 용량 티어가 같다 | 다른 커밋 · 다른 티어의 창이 한 스위치 효과로 읽힌다(D-10) |

- 검산: 조건 = **6**
- **창 경계마다 4요소를 함께 캡처한다.** health가 커밋 해시 · 메모리 프로파일 · 용량 티어를 싣으므로 두 조건의 세 값이 다르면 비교 불성립이다 — 같은 브라우저에 다른 커밋 · 다른 티어에서 잡은 창이 섞여도 화면이 가른다.

### 스위치별 비교 대상

[../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 측정 · 교체 표의 측정 대상을 화면에서 볼 수 있는 것과 없는 것으로 가른다. 예상 차이는 전부 원본 예상치이고 3계층 미확인이다.

| 스위치 | 측정 대상 | 화면 비교 표의 지표(계열 — 이름은 W6) | 화면 밖 판정 | 관련 AC |
|------|------|------|------|------|
| SW-01 | 백프레셔 흡수력 · 유실 | 폴링 주기 · 스풀 · 트리밍 계수 | 유실 수는 생성 카운트 대 tag_raw count() 대조(CLI) | AC-33 |
| SW-02 | 점조회 비용 | 최신값 API 지연 p50 · p95 | 해당 없음 | AC-18 |
| SW-03 | 반복 조회 흡수 | 시계열 조회 지연 · ClickHouse 쿼리 실행 수 | 해당 없음 | AC-39 |
| SW-04 | 키 파편화 | 캐시 히트율 | 해당 없음 | AC-24 |
| SW-05 | 스탬피드 | ClickHouse 동일 쿼리 실행 수 · 대기 소진 계수 | 해당 없음 | AC-25 |
| SW-06 | 팬아웃 경계 비용 | 발행 → 수신 지연 | 프레임 내용 동일성은 수신 로그 대조 | AC-40 |
| SW-07 | 프레임 폭증 | 연결당 초당 프레임 · 이벤트 루프 지연 | 해당 없음 | AC-41 |
| SW-08 | 재시도 중복 | 재시도 계수 | **중복 행 수는 SQL 대조** — 메트릭에 없다 | AC-20 |
| SW-09 | 쿼리별 역전 지점 | 삽입 처리량(대조군 적재 비용) | **역전 지점은 두 저장소 대조 쿼리 실행**(CLI) — §대조군 역전 지점 | AC-29 · AC-44 |
| SW-10 | 전송량 · 행 수 · 압축률 | 발행량 · 생략분 계수 | **행 수 · 압축률은 ClickHouse 시스템 테이블 조회** | AC-42 |
| SW-11 | 중단 중 최신값 갱신 · 결합도 | 최신값 갱신 계수 · STALE 비율 | 중단 재현은 장애 주입 절차 | AC-34 |

- 검산: 스위치 = **11** · 화면 밖 판정 열이 "해당 없음"인 스위치 = SW-02 · 03 · 04 · 05 · 07 = **5** · 화면 밖 판정이 필요한 스위치 = 11 − 5 = **6**
- **목표 ①의 산출(역전 지점)은 이 화면의 메트릭으로 나오지 않는다(A형).** 통념은 실험 콘솔이 두 저장소의 비교 수치를 계산한다는 것이다. 부정 — 대조 쿼리는 호스트 CLI(psql · clickhouse-client)로 두 저장소에 직접 실행하며 api를 거치지 않는다([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §실험 수행자와 실험 콘솔). 진짜 축은 **측정 경로에 앱이 끼지 않아야 저장소 비교가 된다**는 것이다. 대체 경로 — 결과는 docs/measurements에 기록되고, 이 화면은 그 기록을 그리는 표시 계약만 갖는다.

### 대조군 역전 지점

**데이터 원천은 Next.js BFF가 docs/measurements 기록을 읽기 전용으로 읽는 것이다**(W5 리드 판정 — 후보 ①). api 컨테이너 표면을 신설하지 않는다 — 측정 기록은 설계 정본이 아니라 실측 파일이고 api는 그 파일을 모른다. 기록의 기계 판독 형식(어느 자리에서 용량 단계 · 저장소 · 쿼리 시간 · 4요소를 읽는가)의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기계 판독 블록이고, 이 절은 그 값을 그리는 표시 계약을 고정한다.

| 계약 | 내용 | 어기면 |
|------|------|------|
| 대상 | EXP-01~05 — 대조군 쿼리 5종(단일 태그 1시간 · 단일 태그 7일 · 설비 전체 1일 · 분 단위 롤업 재계산 · 전체 스캔 count) · 채번 정본 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) | 쿼리 목록을 화면이 따로 정하면 기록과 다른 쿼리가 그려진다 |
| 축 | 가로 = 적재 행 수(용량 단계) · 세로 = 쿼리 시간 3회 중앙값 · 두 선 = PostgreSQL 대조군 · ClickHouse | 가로를 시간으로 두면 "몇 행에서 역전되는가"라는 질문의 축이 사라진다 |
| 역전 표지 | 두 선이 교차하는 첫 용량 단계에 표지 · 교차가 없으면 "관측 범위 안에서 역전 없음"과 관측 최대 행 수 | 교차 없음을 빈 차트로 두면 측정 누락과 구분되지 않는다(AC-29) |
| 4요소 | 점마다 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태를 툴팁에 · **4요소가 없는 점은 그리지 않는다** | 조건이 다른 점이 한 선에 이어져 가짜 교차가 생긴다 |
| 결과 동일성 | 두 저장소의 결과 집합 일치 여부(count 정확 · avg 허용 오차 상계) 표지 — 불일치 점은 속이 빈 점 | 다른 답을 내는 두 쿼리의 속도를 비교한다(AC-29) |
| 비교 축 | 쿼리 시간 외 저장 비용 축(디스크 · 압축률 등)은 별도 막대 — 6축 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) | 쿼리 시간만 있는 표가 학습 목표 ① 산출로 오인된다(AC-44) |

- 검산: 계약 = **6**
- **BFF는 기록을 읽기만 한다.** 화면에서 기록을 만들거나 고치는 경로를 두지 않는다 — 콘솔은 표시 전용이고, 기록의 정본성은 파일이 커밋 해시와 함께 git에 남는 데서 온다. 판독 형식에 맞지 않는 기록 파일은 패널에서 빠지고 "판독 불가 기록 N건"으로 센다 — 조용히 빼면 역전 지점이 측정 누락 위에 그려진다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 캡처 버튼을 누르면 두 표면 응답이 모두 올 때까지 창 경계를 확정하지 않는다 — 한쪽만 오면 스위치 상태와 누적값의 시각이 어긋난다 |
| 빈 값 | ① 창 0 — "창 시작 캡처로 측정을 시작한다" ② 한 조건만 있음 — "비교할 두 번째 조건이 없다 · 전환 절차로 스위치를 바꾼다" ③ 역전 지점 — 판독 가능한 대조군 기록 0 · "EXP-01~05 기록이 아직 없다" |
| 오류 | 캡처 중 health · metrics 실패 → 그 창을 버리고 "캡처 실패 — 다시 캡처" · 비교 불성립은 오류가 아니라 §비교 성립 조건의 이유 표시 · 인증 계열(S7)은 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 조건별 창 수 · 비교 성립 표지 · 비교 표(중앙값 · 비 · 편차) · 창 경계 시각(KST · 밀리초) · "관찰 보조 — 기록 정본 아님" 표기 |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| GET /api/v1/health | 창 시작 · 끝 캡처 | BFF | 스위치별 주입 구현 · 커밋 해시 · 메모리 프로파일 · 용량 티어 |
| GET /metrics | 창 시작 · 끝 캡처 | BFF 해석 — 히스토그램 버킷 누적값까지 내려야 창 분위수를 계산한다 | 계열별 누적 카운터 · 히스토그램 버킷 |
| BFF 기록 읽기(api 표면 아님) | 진입 · 역전 지점 패널 새로고침 | BFF가 docs/measurements를 읽기 전용으로 | EXP-01~05 기록의 용량 단계 · 저장소 · 쿼리 시간 중앙값 · 4요소 · 결과 동일성 — 기계 판독 형식 정본 10_observability/04(W6) |

- 검산: 부르는 자리 = api 표면 2 + BFF 기록 읽기 1 = **3**
- **이 화면은 폴링하지 않는다.** 캡처는 사람이 누를 때 두 번뿐이다 — 측정 중 관찰 부하를 창 경계 두 점으로 줄이는 것이 EXP-CONSOLE 폴링과 이 화면을 가른 이유다.
- **BFF 해석은 요약이 아니라 누적 버킷을 내려야 한다.** EXP-CONSOLE용 요약(순간 분위수)만 내리면 창의 분위수를 계산할 수 없다 — 해석은 화면용 JSON 표면 없이 BFF가 하므로([../07_api/10_metrics.md](../07_api/10_metrics.md) §원본에 없는 표면 판정) 두 모양은 웹 내부 계약이다.

### 스위치 영향

- 모든 스위치가 비교 대상이다 — §스위치별 비교 대상이 전수다. 스위치가 이 화면의 호출 · 갱신 동작을 바꾸지는 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| BFF 메트릭 해석 결과 모양 | **이 문서 판정** — 화면용 요약 JSON 표면을 두지 않는 07_api/10_metrics 판정에 따라 해석은 웹(BFF Route Handler) 내부 계약이다 · EXP-CONSOLE은 계열별 순간값, EXP-COMPARE는 누적 카운터 · 히스토그램 버킷을 받는다 | 이 문서 · [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)(W6) |
| 커밋 해시 · 메모리 프로파일 · 용량 티어의 화면 원천 | **닫힘** — health에 노출(W5 리드 판정) · 필드 이름은 07_api/10_metrics | [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| 부하 주입 게이트(모드 C 표면) 켜짐 여부 | **닫힘** — health에 싣지 않는다(07_api/10_metrics 판정 · 스위치가 아니다) · 기록 조건 블록에 수기 칸으로 둔다 | [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| 대조군 역전 지점 패널의 데이터 원천 | **닫힘** — BFF가 docs/measurements를 읽기 전용으로 읽는다(W5 리드 판정) · 기계 판독 형식 **닫힘(W6)** — json 펜스 1개 · schema measurement/v1 · BFF 판독 규칙 7(§기계 판독 블록) | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 메트릭 이름 · 스위치 상태 레이블 이름 | **닫힘(W6)** — 이름 전수 · 스위치 상태는 obs_switch_info(switch · env · value · impl) | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 스위치별 EXP 번호(SW-09의 EXP-01~05 제외) | **닫힘(W6)** — SW-01~08 · 10 · 11 = EXP-06~15 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 콘솔 폴링 주기 · 편차 폐기 기준 | 2계층 — 폴링은 계약 이 문서 · **현행값 15초(W6 판정 · 09_tech_stack/01)** · 편차 기준 (최대 − 최소) ÷ 중앙값 · 현행 참고 20%(W6 판정) | 이 문서 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 스위치 on/off 차이 전 행 · 역전 지점 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | 각 EXP 실측 결과 |

## 관련 문서

- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 채번 · 조합 제약 정본
- [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) — 포트 · 구현 이름 정본
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 스위치별 실험 · EXP 채번
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 4요소 · 3회 중앙값 · 복원 절차
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health · metrics 표면
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 실험 콘솔 인가 판정
- [01_standards.md](./01_standards.md) — 공통 셸 실험 조건 배지 · 캐시 정렬
