# OBS — 헬스 · 메트릭 표면 (10_metrics)

> **대상**: OBS 도메인 표면 — GET /api/v1/health(저장소별 상태 · 스위치 12종의 실제 주입 구현 · 부분 실패 503) · GET /metrics(Prometheus 텍스트 · 스위치 상태 레이블) · 두 표면의 공개 판정 반영 · **health 본문 필드 이름 판정** · **저장소별 타임아웃 판정**
> **작성일**: 2026-09-24
> **개정일**: 2026-10-05 — 센서 자동 생성 게이트 검수 반영(리드 판정 M1) — run.sensorAutogen 게이트 값 → **실효값(게이트 × 역할)** — 게이트 on이고 APP_ROLE이 수집기를 띄우는 역할일 때만 on(api · worker는 off) — 필드 행 · 공통 규약 응답 내용 · run 행 문구 · **실효값 근거 불릿 신설** — 필드 수 · 표면 · 에러 코드 수 불변
> **개정일**: 2026-10-03 — 센서 자동 생성 게이트 SENSOR_AUTOGEN 신설(사용자 결정 2026-10-03 · 스위치 밖 운영 게이트 · 이름 정본 09_tech_stack/04) — health run에 **sensorAutogen**(on · off) — 필드 행 10 → **11** · 최상위 필드 5 불변 · 공통 규약 응답 내용 · #1 호출 화면(EXP-FLOW 꺼짐 안내) · 응답 예시 run · run 근거 불릿 — 표면 · 에러 코드 수 불변
> **개정일**: 2026-10-03 — D-15 학습자 눈높이 한 화면(사용자 지시 2026-10-03 — 08_screen/08_evidence_screens · 01_standards §한 화면 원칙) — 측정 조건 서랍 → **각주 툴팁**(읽기 전용 단락 · #1 호출 화면 · EXP-PERF 불릿 · run 근거 불릿 · 관련 문서) · EXP-PERF 불릿의 기록 곡선 · 배수 지도 → 그림 1 · 그림 2 — 표면 · 기능 불변
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03) — 호출 화면 EXP-CONSOLE · EXP-COMPARE → **#1 EXP-FLOW · EXP-PERF(측정 조건 서랍) · #2 EXP-FLOW** · 읽기 전용 · 경로 · run 근거 · 메트릭 요약 JSON 행의 화면 서술 · 관련 문서에 08_evidence_screens — 표면 · 기능 · 에러 코드 수 불변(api 표면은 지우지 않는다 — D-14 결정 1)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-M3) — 대상 줄 스위치 11종 → **12종** · 도입 전 스위치 불릿 "스위치 11키" → **스위치 키(현재 12 — 정본 링크)** · switches 노출 표에 **SW-12 행**(stream · direct · StreamBizWriter · DirectBizWriter) — 스위치 행 11 → **12** · 표면 수 불변
> **개정일**: 2026-09-24 — S2 구현 반영 — switches.*.impl 문자열 → **문자열 또는 null**(도입 전 스위치) · obs_switch_info는 주입된 스위치만
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 레이블 이름 · 설비 레이블 · EXP 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — Compose api healthcheck timeout **3초**(저장소 타임아웃 1,000 ms의 3배 · 정본 09_tech_stack/03) · run 환경변수 이름 MEMORY_PROFILE · CAPACITY_TIER · COMMIT_HASH(정본 09_tech_stack/04) — 필드 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — health 본문에 측정 조건 **run**(commitHash · memoryProfile · memoryLimitMb · capacityTier) 신설 — 최상위 필드 4 → **5** · 필드 행 8 → **10** · #1 호출 화면에 EXP-COMPARE · EXP-COMPARE 비교 값은 표면 없음(BFF의 docs/measurements 읽기)
> **원천**: 원본 architecture.md §3 · §11 · §14 · §18(커밋 ff66a37) · 원본 implementation_plan.md §4.1(커밋 ff66a37) · REQ-OBS-01~12 · REQ-GLB-04 · 16 · D-06 · D-10 · ADR-08 · ADR-22 · docs_plan.md 실행 계획 보정 #12 · #14 · [../02_features/11_metrics.md](../02_features/11_metrics.md) OBS-01~06 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) healthcheck · docs_plan.md 웨이브 인계 W5 07_api 행(health 본문 필드 이름 · 저장소별 타임아웃)

OBS 표면은 **둘뿐이고 둘 다 공개다.** /api/v1/health는 Compose가 api의 healthcheck로 자격 증명 없이 부르고(인증을 걸면 기동이 순환한다), /metrics는 Prometheus 스크레이프와 정밀 측정 세션의 직접 덤프가 토큰 수명과 무관하게 읽는다. 공개의 근거는 도달 가능성이 아니라 **호출 주체가 기계이고 응답에 업무 데이터가 없다**는 것이다 — 업무 데이터가 실리는 순간 판정이 무효다(권한 매트릭스 §GEN · OBS 표면 인가).

**두 표면은 읽기 전용이다.** 스위치를 바꾸는 쓰기 메서드가 없다 — 전환은 환경변수와 api 재기동뿐이다(D-06 · REQ-OBS-12). 두 실증 화면(EXP-PERF · EXP-FLOW)의 각주 툴팁이 스위치 상태를 표시하는 원천이 이 두 표면이지만, 화면은 표시만 한다(docs_plan 보정 #14 · 실험 콘솔 EXP-CONSOLE은 폐지 — D-14).

metrics 네임스페이스는 정의만 있고 코드가 0이다. health의 503은 **에러 봉투가 아니라 정상 본문과 같은 모양**을 낸다 — 불가 순간에 저장소별 상태가 사라지면 어느 저장소가 원인인지 응답에서 읽을 수 없다(REQ-OBS-09).

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 인증 · 인가 | 공개 — Authorization을 보지 않는다 · 레이트 리밋 계수 대상 아님(user_id 없음) | REQ-OBS-10 · REQ-AUT-16 |
| 응답 내용 | 업무 데이터 · 비밀(접속 문자열 · 자격 증명 · 토큰)을 싣지 않는다 · health는 저장소별 상태 · 스위치 상태 · 측정 조건(커밋 해시 · 메모리 프로파일 · 용량 티어 · 센서 자동 생성 실효값)만 | REQ-OBS-10 · 11 |
| 경로 | 기계 호출 직결 · 화면(EXP-PERF · EXP-FLOW)은 BFF 경유 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 쓰기 | 없음 — GET만 | REQ-OBS-12 |
| 캐시 | 없음 · Cache-Control no-store | [01_conventions.md](./01_conventions.md) §캐시 헤더 |
| 에러 코드 | 없음 — metrics 네임스페이스 코드 0 · health 부분 실패는 코드 없는 503 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 채번 보류의 처리 결과 |
| 단계 | 두 표면 S2(계측 3종 · 스위치 노출) · 저장소 메트릭 S5 · 키 접두 메모리 S6 | [../02_features/11_metrics.md](../02_features/11_metrics.md) |

- 검산: 항목 = **7**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/health | OBS-05 · 06 | 공개 | 없음 | 없음 — 부분 실패는 코드 없는 503 | EXP-FLOW(각주 툴팁 · 자동 생성 꺼짐 안내) · EXP-PERF(각주 툴팁) | 원본 |
| 2 | GET | /metrics | OBS-01 · 02 · 03 · 04 · 06 | 공개 | 없음 | 없음 | EXP-FLOW | 원본 |

- 검산: 표면 = **2** · REST JSON 1 + 메트릭 텍스트 1 = **2** · 원본 2 + 신설 0
- 기능 6이 두 표면에 앉는다 — /metrics 4(OBS-01~04) + health 1(OBS-05) + 양쪽 1(OBS-06) = **6**
- EXP-PERF의 그림 1 승패 막대 · 그림 2 규모 곡선 값은 **api 표면이 없다** — BFF가 docs/measurements를 읽기 전용으로 읽는다(W5 리드 판정 · 폐지 화면 EXP-COMPARE의 역전 지점 패널과 같은 경로 · D-14). 이 화면이 api에서 읽는 것은 각주 툴팁의 #1 run · switches뿐이다.
- 기계 호출 주체(Compose healthcheck · Prometheus · 직접 덤프)는 화면 코드가 아니라 호출 화면 열에 적지 않는다 — [01_conventions.md](./01_conventions.md) §BFF 경유와 직결의 기계 호출 행이 갖는다.

## #1 GET /api/v1/health

### 저장소 확인과 타임아웃 판정

인계 "저장소별 타임아웃"을 닫는다. **판정 — 세 저장소를 병렬로 실제 왕복하고, 저장소마다 독립 타임아웃을 둔다. health 전체 시간은 가장 긴 저장소 타임아웃을 넘지 않는다.**

| 저장소 | 확인 동작 | 쓰는 연결 | 타임아웃 | 그 동작을 고른 이유 |
|------|------|------|------|------|
| PostgreSQL | SELECT 1 | **앱 커넥션 풀** | 현행 참고 1,000 ms | 별도 연결로 확인하면 풀 고갈을 보지 못해 "healthy인데 요청은 풀 대기"가 된다 |
| ClickHouse | HTTP 8123 SELECT 1 | 앱 HTTP 클라이언트 | 상동 | /ping은 HTTP 서버 생존만 본다 — 질의 처리 불가를 놓친다 |
| Redis | PING | 앱 명령 연결(구독 연결이 아니다) | 상동 | 구독 연결은 명령을 받지 않아 PING 경로가 다르다 |

- 검산: 저장소 = **3**
- **타임아웃은 2계층 조정값이다 — 현행 참고 1,000 ms · 소유 이 문서.** 조회 계약은 둘이다 ① 캐시 계열 호출 타임아웃(현행 참고 50 ms)보다 길다 — health는 연결 수립을 포함한 왕복이다 ② Compose healthcheck timeout보다 짧다 — 길면 멈춘 저장소 하나가 healthcheck를 무기한 붙잡아 "응답 없음"과 "불가"를 가를 수 없다(REQ-OBS-08). Compose 쪽 값의 정본은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)이며(W6 판정 — api healthcheck timeout 3초 = 이 값의 3배) 두 값을 같은 변경 단위에서 맞춘다.
- **병렬인 이유** — 직렬이면 health 시간이 세 타임아웃의 합이 되어, 저장소 둘이 멈춘 순간 ②의 조건이 깨진다.

### 응답 — 본문 필드 이름 판정

인계 "health 본문 필드 이름"을 닫는다. 200과 503이 **같은 필드 집합**을 낸다(REQ-OBS-09).

| 필드 | 타입 | 뜻 |
|------|------|------|
| status | 문자열 | ok(셋 다 up · HTTP 200) · degraded(하나라도 down · HTTP 503) |
| checkedAt | UTC ISO | 확인을 시작한 서버 시각 |
| stores.postgres · stores.clickhouse · stores.redis | 객체 | 저장소별 결과 — 아래 셋 |
| stores.*.status | 문자열 | up · down |
| stores.*.latencyMs | 정수 · null | 왕복 시간 — down이면 null |
| stores.*.error | 문자열 · null | timeout · refused · error 중 하나 — up이면 null · 원문 오류 메시지를 싣지 않는다 |
| switches | 객체 | 키 = 스위치 ID(SW-01 · …) · 값 = 아래 넷 |
| switches.*.name · value · impl · warning | 문자열 · 문자열 또는 정수 · 문자열 또는 null · 문자열 또는 null | 환경변수 이름 · 실제 값 · 실제 주입된 구현 이름(**포트가 아직 코드에 없는 도입 전 스위치는 null** — value는 기동 설정값) · 경고 |
| **run** | 객체 | 측정 조건 — 기록 4요소 중 스위치 밖 3요소(아래 넷) · 센서 자동 생성 실효값(아래 하나) |
| **run.commitHash · memoryProfile · memoryLimitMb · capacityTier** | 문자열 · 문자열 · 정수 · 문자열(S · M · M+ · L) — 각각 null 가능 | 빌드된 커밋 해시 · 메모리 프로파일 이름 · api 컨테이너의 실제 메모리 상한(cgroup에서 읽음) · 기동 시 주입된 용량 티어 |
| **run.sensorAutogen** | 문자열 on · off — null 없음 | 센서 자동 생성 **실효값(게이트 × 역할)** — 환경변수 SENSOR_AUTOGEN(스위치가 아니다)이 on이고 이 프로세스의 APP_ROLE이 수집기를 띄우는 역할일 때만 on · 그 밖은 off(예: 수집기가 없는 api · worker는 게이트가 on이어도 off) — off면 이 프로세스에 SIM 포트 · 모드 A 틱 · 수집기 폴링이 없어 화면의 센서 데이터는 직접 보내 보기(07_api/09 flow 실행)가 보낸다 — 측정용 주입 모드(B · C · D)는 게이트와 무관하다 |

- 검산: 필드 행 = **11** · 최상위 필드 = status · checkedAt · stores · switches · run = **5**
- **run을 싣는 이유(W5 리드 판정)** — 측정 기록의 4요소(커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 — REQ-GLB-17)를 한 응답에서 읽게 한다. 두 실증 화면의 각주 툴팁이 기록 조건을 손으로 옮겨 적지 않는다 — 옮겨 적다 틀리면 같은 조건이라 믿은 두 측정의 조건이 다르다. 셋 다 비밀이 아니다.
- **값은 기동 시 주입값이며 모르면 null이다.** 커밋 해시는 이미지 빌드 인자, 메모리 프로파일 · 용량 티어는 기동 환경변수에서 읽는다(환경변수 MEMORY_PROFILE · CAPACITY_TIER · 빌드 인자 COMMIT_HASH — 이름 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)). 추정값으로 채우지 않는다 — null은 "그 측정 기록은 4요소가 빠져 인용할 수 없다"는 표지다. memoryLimitMb만은 프로파일 이름과 별도로 cgroup의 실제 상한을 읽는다 — 스위치와 같은 "실제 적용값" 원칙(REQ-OBS-11)이다.
- **sensorAutogen을 run에 싣는 이유(사용자 결정 2026-10-03)** — 자동 생성이 켜진 실행은 수집기가 늘 스트림에 싣는 배경 적재 위에서 재고, 꺼진 실행은 직접 보낸 양만 흐른다. 이 칸이 없으면 배경 적재가 있고 없는 두 측정이 같은 조건으로 읽힌다. 기동 시 1회 · 허용값 밖이면 기동 거부라 모르는 값(null)이 없다 — 기본값(앱 on · 로컬 Compose off)은 이름 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)가 갖는다. 기록 4요소의 정의는 바꾸지 않는다 — 4요소에 더해지는 조건 칸이다.
- **sensorAutogen은 health에만 싣는다.** 도구 출력(bench · 모드 B · 모드 D · oltp-lab)의 run에 넣으면 수집기를 띄우지 않는 별도 프로세스가 api의 SENSOR_AUTOGEN을 모른 채 자기 기본값(on)을 적는다 — 그 칸은 실제 실행과 어긋난다.
- **sensorAutogen은 게이트 값이 아니라 실효값이다(검수 반영 2026-10-05).** 게이트 값을 그대로 실으면 역할 분리 실행(APP_ROLE api · worker — 수집기 없음)의 기록이 게이트 on이라 배경 적재가 있었던 것처럼 읽힌다 — 실제로는 그 프로세스가 센서 데이터를 하나도 만들지 않았다. 역할 판정의 기준은 그 프로세스가 SIM · 모드 A · 수집기를 띄우는가 하나다 — 어느 역할이 띄우는지는 역할 배정 정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §APP_ROLE 배정이 갖는다. 값은 이 프로세스 기준이다 — 다른 컨테이너의 collector 역할이 싣는 데이터는 그 프로세스의 health가 말한다.
- **error에 원문 메시지를 싣지 않는 이유** — 드라이버 오류 문자열에는 접속 문자열 · 호스트 · 사용자 이름이 섞인다. 공개 표면의 응답에 비밀이 실리면 공개 판정이 무효다(REQ-OBS-10).
- **도입 전 스위치의 impl은 null이다(S2 as-built).** 주입되지 않은 구현 이름을 적으면 "실제 주입 구현"이 거짓이 되고, 키를 빼면 측정 기록의 스위치 키(현재 12 — 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md))가 비어 4요소가 성립하지 않는다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) BFF 판독 규칙 4) — 키는 싣고 impl만 비운다. obs_switch_info는 impl 레이블이 비지 않게 주입된 스위치만 낸다.
- **switches의 키 집합은 정본의 스위치 전부다.** 개수를 이 문서가 세지 않는다 — 스위치가 늘면 키가 늘 뿐이고 응답 필드 추가 규칙(v1 유지)을 따른다. 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md).

### 스위치 값 — 실제 주입 구현 기준

노출값은 **기동 시 DI가 실제로 주입한 구현**에서 거꾸로 읽는다. 환경변수 문자열을 옮기지 않는다(REQ-OBS-11).

| 스위치 | value 형식 | impl(포트 구현 이름 — 정본 13_switch_matrix) | warning |
|------|------|------|------|
| SW-01 | on · off | RedisStreamBuffer · InProcessQueueBuffer | **off이면 stream_boundary_bypassed** |
| SW-02 | on · off | RedisLatestValueReader · ClickHouseLatestValueReader | null |
| SW-03 | on · off | RedisTimeseriesCache · NoopTimeseriesCache | null |
| SW-04 | on · off | TimeSnapKeyNormalizer · RawTimeKeyNormalizer | null |
| SW-05 | on · off | RedisRebuildLock · NoopRebuildLock | null |
| SW-06 | on · off | RedisPubSubFanout · DirectGatewayFanout | null |
| SW-07 | **정수(ms)** — 0이면 병합 없음 | WindowMergeThrottle · PassthroughThrottle | null |
| SW-08 | on · off | DeterministicBatchToken · NoBatchToken | null |
| SW-09 | on · off | PostgresControlSink · NoopControlSink | null |
| SW-10 | on · off | TagDeadbandFilter · PassthroughFilter | null |
| SW-11 | ingest · collector | IngestLatestValueWriter · CollectorLatestValueWriter | null |
| SW-12 | stream · direct | StreamBizWriter · DirectBizWriter | null |

- 검산: 스위치 행 = **12**(정본 행을 옮겨 적은 대조용 — 수의 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md))
- **A형 — "환경변수를 off로 줬는데 health가 on이라 말한다"는 버그가 아니다.** 통념은 health가 설정을 보여 준다는 것이다. 부정 — health는 주입된 구현을 보여 준다. 진짜 축은 **측정 기록의 스위치 상태는 실제로 돈 코드여야 한다**는 것이다(D-10). 대체 경로 — 값이 다르면 환경변수 오타 · 허용값 밖 값으로 기본 구현이 주입된 것이니 환경변수를 고치고 재기동한다.
- **SW-07만 정수다.** on/off로 내면 창 크기가 다른 두 측정이 같은 조건으로 기록된다(REQ-OBS-11).
- **SW-01 off의 경고는 이 본문과 부팅 로그 두 자리에 남는다**(REQ-GLB-04). off는 실험 전용이며 정상 경로로 오인되면 유실이 기본 동작이 된다.

응답 예시다(Redis 중단 · HTTP 503 · 스위치는 셋만 보인다).

```json
{
  "status": "degraded",
  "checkedAt": "2026-09-24T01:00:00.000Z",
  "stores": {
    "postgres": { "status": "up", "latencyMs": 2, "error": null },
    "clickhouse": { "status": "up", "latencyMs": 5, "error": null },
    "redis": { "status": "down", "latencyMs": null, "error": "refused" }
  },
  "switches": {
    "SW-01": { "name": "REDIS_STREAM_BUFFER", "value": "on", "impl": "RedisStreamBuffer", "warning": null },
    "SW-07": { "name": "WS_THROTTLE_MS", "value": 100, "impl": "WindowMergeThrottle", "warning": null },
    "SW-11": { "name": "LATEST_VALUE_WRITER", "value": "ingest", "impl": "IngestLatestValueWriter", "warning": null }
  },
  "run": {
    "commitHash": "a1b2c3d",
    "memoryProfile": "load",
    "memoryLimitMb": 4096,
    "capacityTier": "M",
    "sensorAutogen": "on"
  }
}
```

- **Redis가 멈춰도 switches · run은 나온다.** 둘 다 기동 시 확정된 프로세스 안 값이라 저장소 상태와 무관하다 — 장애 실험 도중에도 측정 기록의 4요소를 이 응답에서 읽는다.
- 실제 응답은 switches에 정본의 스위치 전부를 싣는다 — 예시는 형식을 보이려고 셋만 적었다.

### 부분 실패 판정

| 상황 | HTTP | status | 본문 | 근거 |
|------|:--:|------|------|------|
| 셋 다 up | 200 | ok | 같은 모양 | REQ-OBS-09 |
| 하나 이상 down(타임아웃 포함) | 503 | degraded | 같은 모양 · 해당 저장소만 down | 상동 |
| api 프로세스가 응답하지 않음 | 연결 실패 | 해당 없음 | 없음 | Compose가 unhealthy로 판정 |

- 검산: 상황 = **3**
- **B형 — 저장소 하나만 멈춰도 health가 503인 것은 과민 반응이 아니다.** 결론 — Compose healthcheck는 HTTP 결과로만 판정한다(원본 architecture.md §3). 반대 시나리오 — 부분 실패에 200을 내면 "api healthy = 접속을 받을 준비가 됐다"가 거짓이 되어 기동 직후 api가 커넥션 오류로 재시작 루프를 돌고 Collector가 불필요한 스풀을 만든다. 파생 지침 — 부분 가용 상태의 세부는 본문의 stores가 말하고, Compose 쪽 판정은 HTTP 상태 하나로 끝낸다.
- 에러 봉투를 쓰지 않는 것이 [01_conventions.md](./01_conventions.md) §에러 봉투의 예외 셋 중 하나다.

## #2 GET /metrics

| 항목 | 계약 |
|------|------|
| 응답 200 | Prometheus 텍스트 형식 · Content-Type text/plain(텍스트 형식 버전 명시) |
| 내용 | 앱 기본 · HTTP · WebSocket · 파이프라인(OBS-01) + 저장소 메트릭(OBS-02) + 키 접두별 메모리(OBS-03) + E2E 지연 게이지(OBS-04) + 스위치 상태 레이블(OBS-06) |
| 저장소 메트릭 | 스크레이프 때 저장소를 조회하지 않는다 — 주기 수집(현행 참고 15초)의 마지막 값을 낸다 |
| 부분 실패 | 한 계열 수집 실패는 그 계열만 비우고 수집 오류 지표를 올린다 · **/metrics 자체는 200** |
| 레이블 | 닫힌 집합(도메인 · 저장소 · 스위치 · 상태 코드 · 단계 · 설비 — 티어 구성으로 상한)만 · 태그 · 요청 단위 식별자 금지 |
| 이름 · 레이블 이름 | 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 스위치 상태는 obs_switch_info(레이블 switch · env · value · impl) · 경고 obs_switch_warning |
| 관련 REQ | REQ-OBS-01 · 02 · 03 · 04 · 05 · 06 · 07 · 10 · 11 |

- **스크레이프가 저장소를 조회하지 않는 이유(B형)** — 결론: 스크레이프 빈도가 저장소 부하를 바꾸지 않는다. 반대 시나리오 — 스크레이프마다 system.parts · pg_stat_statements를 읽으면 observability 프로파일을 켠 측정과 끈 측정의 저장소 부하가 달라져 측정 조건이 관측 도구에 따라 갈린다(REQ-OBS-03). 파생 지침 — 정밀 측정 세션의 직접 덤프 주기를 바꿔도 저장소 쪽 통계 조회 횟수는 그대로다.
- **/metrics는 observability 프로파일 없이도 덤프된다**(REQ-OBS-07). OBS는 노출까지만 하고 저장 · 시각화 · 알림은 프로파일이 한다.
- **같은 머신의 다른 프로세스가 스위치 상태 · 스트림 길이 · 느린 쿼리 문형을 읽을 수 있다.** 쿼리 값은 파라미터 바인딩이라 문형에 드러나지 않는다 — 잔여 위험은 [../12_security/04_threat_model.md](../12_security/04_threat_model.md) 등재 대상이다.

## 원본에 없는 표면 판정

| 후보 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 스위치 전환 표면 | **두지 않는다** | D-06 · REQ-OBS-12 · 보정 #14 | 런타임 토글이 되어 경로 안 분기로 돌아가고 측정 도중 스위치가 바뀌어 한 기록 안에서 조건이 섞인다 |
| 저장소별 헬스 분리(/health/postgres 등) | **두지 않는다** | Compose healthcheck는 표면 하나를 부른다 | 표면이 셋이면 api healthy의 뜻이 어느 것을 부르느냐에 따라 달라진다 |
| 준비(readiness) · 생존(liveness) 분리 | **두지 않는다** | 오케스트레이터 없음 · 로컬 Compose 단일 판정 | 클러스터 개념을 현행 범위로 들인다 — 확장 로드맵 밖 |
| 메트릭 요약 JSON(화면용) | **두지 않는다** | EXP-FLOW는 BFF가 /metrics 텍스트를 해석한다 | 같은 수치가 두 형식으로 나가 화면과 Prometheus가 다른 스크레이프 시점을 본다 |

- 검산: 후보 = **4** · 신설 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 저장소 타임아웃과 Compose healthcheck timeout의 짝 | 2계층 — 이 문서 현행 참고 1,000 ms · **Compose api timeout 3초(W6 판정)** · 한쪽을 바꾸면 다른 쪽을 같은 변경 단위에서 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| 스위치 상태 레이블 이름 · 메트릭 이름 | **닫힘(W6)** — obs_switch_info · 이름 전수 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 역할 분리 뒤 health · metrics의 자리 | APP_ROLE별 컨테이너가 각자 두 표면을 내는지 없다 — 현행 범위 밖(확장 1단계) | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) · [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |
| health에 부하 주입 게이트 상태를 실을지 | 싣지 않는다(스위치가 아니다 · REQ-OBS-10 내용 한정) — 측정 기록에 사람이 적는다 | [09_datagen.md](./09_datagen.md) · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §조건 칸 |
| /metrics 응답 크기 · 스크레이프 지연 | 3계층 미확인 — obs_metrics_response_bytes로 계측 · EXP-38이 잰다 | [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 봉투 예외 · 기계 호출 배정
- [../02_features/11_metrics.md](../02_features/11_metrics.md) — OBS-01~06 기능 정본
- [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) — REQ-OBS 계약
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 · 포트 구현 이름 정본
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — healthcheck · 기동 순서
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 메트릭 이름 정본
- [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) — EXP-CONSOLE 화면(폐지 · D-14 — 폐지 전 원문 보존)
- [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) — EXP-PERF · EXP-FLOW 각주 툴팁 · 흐름 메트릭
