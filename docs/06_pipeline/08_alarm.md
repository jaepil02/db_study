# F-06 알람 판정 (08_alarm)

> **대상**: F-06 판정 흐름의 기전 정본 — 확정 배치 인계 · **판정을 flusher 흐름에서 기다리는가 판정(직렬 판정기 · 인계 깊이 1)** · 규칙 조회 · 배치 단위 상태 조회(ADR-11) · 행 평가 순서 · 조건 평가와 **RATE_OF_CHANGE 경계** · 디바운스 전이와 세 쓰기의 순서 · 부분 실패(PostgreSQL이 진실) · **ACK 시 alarm:state 갱신 주체 · CLEARING 중 ACK 전이** · alarm_eval 재시도 · 격리 · **비활성 태그 규칙** · 판정 경로 직렬성 · 규칙 시드
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 비활성 태그 열린 알람 닫는 수단 — 리드 판정 대기 → 두지 않는다(W5 알람 강제 해제 표면 없음 판정 반영)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · 무효 구간 자리 · ACK 부재 계측 판정(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — 미확인 표에 2행 등재 — 알람 확인의 ch:alarm 미전파 · alarm_eval 분석 무효 구간 기록 자리 미설계(행선지 W6 10_observability/01)
> **원천**: 원본 data_flow.md §8 · §8.1 · §8.2 · §15(커밋 ff66a37) · 원본 implementation_plan.md §7.3(커밋 ff66a37) · docs_plan.md 웨이브 인계 W4 06_pipeline/08 행 전부 · ADR-06 · ADR-11 · ADR-22 · ADR-25 · D-01 · D-04 · REQ-ALM-01~20 · REQ-ING-13 · REQ-GLB-04 · 13 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2 · alarm_event.state 대응 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) alarm:state 필드 7 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) alarm_rule · alarm_event · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) 알람 판정 구간

F-06은 **확정된 배치의 행이 판정되어 목적이 다른 세 저장소에 쓰이기까지**다. 분기 ②계층이 실제로 갈라지는 자리이며(D-01), Ingest → Alarm 직접 호출은 **Stream 경계 원칙의 의도된 유일한 예외**다 — 판정은 배치의 후처리이고 재처리 단위가 배치와 같다(ADR-11 · [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §경계 예외).

원본 판정 시퀀스는 **행마다** alarm:state를 조회해 판정 처리량이 곧 Redis 왕복 상한이었고(원본 implementation_plan.md §7.3), 해제 경로가 CLEARING 디바운스를 건너뛰었으며, ACK가 Redis 상태를 누가 바꾸는지 적지 않았다. 이 문서는 배치 단위 판정 기전을 고정하고 W1~W3이 넘긴 판정 경계 다섯 건을 닫는다. 상태 머신의 모양은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2가, 세 쓰기의 정책은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)가 정본이다.

## 판정 한 배치

원본 시퀀스(원본 data_flow.md §8)를 배치 단위로 옮긴 단계다. 괄호는 지연 예산의 하위 구간이다.

```plain
① 인계          flusher → 판정기 · 확정 배치의 행 배열(XACK 뒤) — 인계 깊이 1
② 규칙(A1)      cache:alarmrules 활성 규칙 — 미스면 PostgreSQL · 규칙 없는 태그의 행은 버린다
③ 상태(A2)      배치에 걸린 rule_id만 모아 alarm:state 파이프라인 HGETALL 1회
④ 평가(A3)      규칙마다 행을 ts 순으로 — 품질 2 · 4 제외 · 조건 평가 · 디바운스 전이 계산
⑤ 확정(A4)      열기 · 닫기 전이만 alarm_event INSERT · UPDATE(PostgreSQL 커밋)
⑥ 상태 쓰기     전이 결과를 alarm:state 파이프라인 1회 — 확정 전이는 ⑤ 커밋 뒤에만
⑦ 발행(A6)      열림 · 닫힘을 ch:alarm(SW-06 off면 게이트웨이 직접)
⑧ 전수(A5)      판정한 행 전부 alarm_eval INSERT — 원 배치 토큰 · ⑤~⑦과 독립
```

- **Redis 왕복은 배치당 둘이다 — 읽기 1(③) · 쓰기 1(⑥).** 행 수와 무관하다(ADR-11). 판정 전체를 서버 스크립트 1회로 하는 것은 같은 결정의 구현 변형이며, 이 문서는 파이프라인 두 번을 고른다 — 조건 평가를 Redis 안에서 돌리면 단일 스레드 Redis가 판정 CPU를 떠안아 F-03 점조회가 밀린다.
- **⑤가 ⑥ · ⑦보다 앞서는 것이 부분 실패 규칙의 기전이다.** 커밋이 실패하면 확정 상태를 쓰지 않고 통지하지 않는다(REQ-ALM-10) — Redis와 WebSocket이 PostgreSQL에 없는 알람을 말하지 않는다.
- ⑧은 확정과 독립이라 ClickHouse가 멈춰도 알람은 열리고 닫힌다. 판정 구간은 E2E(ingested_at − ts) 밖이다 — 판정이 느려져도 E2E에 드러나지 않아 구간을 따로 잰다([../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §알람 판정 구간).

## 인계와 직렬 판정기

인계 "판정을 flusher 흐름에서 기다리는가"를 닫는다. **판정 — 기다리지 않되 인계 깊이를 1로 제한한다.** 판정기는 프로세스 안 하나이고 배치를 인계 순서대로 하나씩 판정한다. flusher는 배치 N을 인계하고 곧장 다음 배치로 가며, 판정기가 N을 판정하는 동안 N+1이 인계 슬롯을 차지하면 **N+2를 인계하려는 flusher가 기다린다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 동기 대기 | flusher가 판정 완료까지 기다린다 | 판정 시간이 매 배치의 fan-in 대기(구간 6c)에 더해져 Stream 대기가 판정 시간만큼 는다 | 버림 |
| ② 비동기 무제한 | 인계하고 잊는다 · 판정을 병렬로 | 같은 규칙을 두 배치가 동시에 판정해 상태 읽기-쓰기가 경합한다 — **같은 알람이 두 번 열린다**(한계 등재 #9) · 판정 대기열이 메모리로 무한히 쌓인다 | 버림 |
| ③ 별도 Stream | 판정 전용 컨슈머 그룹 | 재처리 단위가 둘이 되어 원시는 적재됐는데 판정만 DLQ로 가는 창이 생긴다(ADR-11 버린 대안 ③) | 버림 |
| ④ **직렬 판정기 · 인계 깊이 1** | 판정은 한 번에 하나 · flusher는 슬롯이 찰 때만 기다린다 | 판정이 플러시 주기보다 계속 느리면 flusher가 기다려 적체가 Stream(lag)에 쌓인다 | **채택** — 쌓이는 자리가 계측되는 Stream이다 |

- 검산: 안 = **4**
- **구조 관계 — 판정 구간 p95 ≤ 플러시 주기**(1계층 관계 · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md)). 이 관계가 깨지면 ④에서는 인계 대기 → flusher 정지 → 컨슈머 정지(창 버퍼 가득) → lag 증가 순으로 백프레셔가 판정을 원인으로 오른다 — 인계 대기 히스토그램이 원인을 가른다.
- **잔여 — 크래시가 판정 중 · 인계 슬롯의 배치를 잃는다(최대 2배치).** XACK는 인계 전이라 재전달되지 않는다 — 판정 실패가 적재 XACK를 되돌리지 않는 것(REQ-ING-13)의 대가이며, 잃은 배치의 행은 alarm_eval에 없고 알람 상태는 다음 배치의 행으로 이어 판정된다. 원본 구조(동기 호출)도 한 배치를 잃었다.
- **역할 분리 뒤에도 판정기는 worker 컨테이너당 하나다**(ADR-22). worker 컨테이너를 둘 이상 띄우면 두 판정기가 같은 규칙을 평가한다 — §판정 경로 직렬성.

## 규칙과 상태의 조회

| 조회 | 원천 | 방식 | 실패하면 | 근거 |
|------|------|------|------|------|
| 활성 규칙 | cache:alarmrules — 미스면 PostgreSQL 읽어 채움 · TTL(현행 참고 300초) | 배치 시작마다 1회 | Redis 실패는 PostgreSQL 직행(캐시 계열 degrade) · PostgreSQL도 불가면 **그 배치를 판정하지 않는다** — 행은 이미 적재됐다 | REQ-ALM-05 |
| 활성의 정의 | enabled = 참 **이고 대상 태그의 is_active = 참** | 규칙 목록을 채울 때 판정 | 해당 없음 | §비활성 태그 규칙 |
| 핫 상태 | alarm:state:{rule_id} — 배치에 걸린 rule_id만 | 파이프라인 HGETALL 1회 | **판정 중단** — 봉인 계열이라 실패를 던진다 · 그 배치 판정 없음 | REQ-ALM-07 |
| 확인 여부(acked_at) | PostgreSQL alarm_event — event_id PK | 해소 첫 감지 때만 1회 | 확인 안 된 것으로 본다 → CLEARING | §ACK와 alarm:state |

- 검산: 조회 = **4**
- **상태를 프로세스 메모리에 두지 않는다**(REQ-ALM-07). 왕복은 없어지지만 역할 분리 뒤 두 워커가 서로의 상태를 모른 채 같은 알람을 두 번 확정한다(ADR-11 버린 대안 ②).
- 규칙 변경은 커밋 뒤 cache:alarmrules를 지우므로(무효화 체인 ② · [07_business_crud.md](./07_business_crud.md)) 다음 배치부터 새 임계값이 쓰인다. 이미 PENDING인 상태는 새 임계값으로 이어 판정한다.

## 행 평가 순서

한 배치 안의 행 순서는 보장되지 않는다(REQ-GLB-07). 디바운스와 변화율은 순서에 의존하므로 판정기가 순서를 만든다.

| 규칙 | 내용 | 없으면 |
|------|------|------|
| 규칙별 ts 정렬 | 배치 안에서 규칙(= 태그)마다 행을 ts 오름차순으로 평가한다 | 옛 행이 나중에 평가되어 CLEARING이 ACTIVE로 되돌아가는 가짜 재위반이 생긴다 |
| 늦은 행 | ts < alarm:state.last_ts인 행은 **전이를 일으키지 않는다** · alarm_eval에는 GT · LT · OUT_OF_RANGE의 판정 결과를 쓴다 | 스풀 재발행 · 회수된 옛 행이 현재 상태를 과거로 돌린다 |
| BAD 제외 | 품질 2 · 4는 판정하지 않고 alarm_eval에도 쓰지 않는다 · last_value를 갱신하지 않는다 | 통신 불량 값이 알람을 연다 |
| SIMULATED 포함 | 품질 9는 판정한다 | 생성 데이터만 있는 이 시스템에서 알람이 한 건도 나지 않는다 |
| 디바운스 시계 | 경과는 행 ts로 잰다 — 벽시계가 아니다 | 적체 소진 중 몰려 들어온 행이 디바운스를 순식간에 채우거나 영영 못 채운다 |

- 검산: 규칙 = **5**
- **B형 — 늦은 행이 전이를 일으키지 않는 것은 판정 누락이 아니다.** 결론 — 상태 머신은 last_ts보다 앞선 행으로 뒤로 가지 않는다. 반대 시나리오 — 복구 단계에서 스풀의 옛 위반 행이 재발행되면 이미 NORMAL로 닫힌 규칙이 PENDING → ACTIVE로 다시 열려, 과거 사건의 알람이 현재 알람으로 통지된다. 파생 지침 — 늦은 행의 판정 결과는 alarm_eval에 남아 사후 분석(ALM-09)에서 보인다.

## 조건 평가와 RATE_OF_CHANGE 경계

조건 4종의 정의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 저장 enum이다. 인계 "RATE_OF_CHANGE 경계"를 닫는다.

| 조건 | 위반 판정 | 필요한 상태 | 경계 |
|------|------|------|------|
| GT | value > threshold | 없음 | 같으면 위반 아님 |
| LT | value < threshold | 없음 | 상동 |
| OUT_OF_RANGE | value < threshold_low 또는 value > threshold | 없음 — 태그 범위(range_min · max)가 아니라 규칙 경계 | 태그 범위 밖 값은 이미 품질 4라 판정에 오지 않는다 |
| RATE_OF_CHANGE | abs(value − last_value) ÷ ((ts − last_ts) ÷ 1000) > threshold | last_value · last_ts(alarm:state 필드) | 아래 표 |

- 검산: 조건 = **4**

| RATE_OF_CHANGE 경계 | 판정 | 상태 갱신 | 버린 해석의 실패 |
|------|------|------|------|
| 직전 값 없음(규칙 첫 판정 · 상태 초기화 뒤) | **판정하지 않는다** · alarm_eval 행 없음 | last_value · last_ts만 기록 | 직전 값을 0으로 두면 첫 행의 변화율이 값 자체가 되어 첫 판정마다 위반한다 |
| Δts = 0(같은 ts 두 행) | 판정하지 않는다 | 갱신 없음 | 0으로 나누기 — 무한대가 위반으로 읽힌다 |
| Δts < 0(늦은 행) | 판정하지 않는다 | 갱신 없음 | 음수 간격이 부호를 뒤집어 abs가 가린다 |
| Δts > scan_rate_ms × STALE 배수(결측 뒤) | **판정하지 않는다 — 직전 값 무효** | 새 행으로 last_value · last_ts 교체 | 결측 구간을 사이에 둔 두 값의 변화율은 결측 길이로 희석되어 급변을 숨기거나, 재기동 직후 값 점프를 급변으로 오판한다 |
| 직전 값이 BAD였음 | 해당 없음 — BAD 행은 last_value를 갱신하지 않는다 | 마지막 GOOD · SIMULATED 값 유지 | BAD 값과의 변화율이 통신 불량을 급변 알람으로 만든다 |

- 검산: 경계 = **5**
- **결측 한도에 STALE 배수를 쓰는 이유** — "이 값은 이미 낡았다"의 판정을 두 자리에서 따로 정하면 최신값 화면은 STALE인데 변화율 판정은 신선한 직전 값으로 쓰는 모순이 생긴다. 배수 값의 소유는 [05_realtime_read.md](./05_realtime_read.md)다.

## 디바운스 전이와 세 쓰기

상태 머신 2의 전이마다 무엇을 어느 순서로 쓰는지다. 시각 필드는 전부 epoch ms이고 행 ts를 쓴다.

| 전이 | 조건 | PostgreSQL alarm_event | alarm:state(⑥) | ch:alarm | alarm_eval |
|------|------|------|------|------|------|
| NORMAL → PENDING | 위반 첫 감지 | 없음 — PENDING은 흔적을 남기지 않는다 | state · first_breach_ts = ts · breach_count 1 | 없음 | breached 1 |
| PENDING → PENDING | 위반 지속 · 경과 < debounce_ms | 없음 | breach_count + 1 | 없음 | breached 1 |
| PENDING → NORMAL | 디바운스 안 정상 복귀(오탐 억제) | 없음 | state · 필드 초기화 | 없음 | breached 0 |
| PENDING → ACTIVE | ts − first_breach_ts ≥ debounce_ms | **INSERT**(state ACTIVE · occurred_at = 이 행 ts · trigger_value) | 커밋 뒤 state · event_id | 커밋 뒤 열림 | breached 1 |
| ACTIVE → CLEARING | 해소 첫 감지 · **확인 안 됨** | 없음 | state · first_clear_ts = ts | 없음 | breached 0 |
| ACTIVE → NORMAL | 해소 첫 감지 · **확인됨**(ACKED 경로) | **UPDATE**(CLEARED · cleared_at = ts · acked 유지) | 커밋 뒤 NORMAL | 커밋 뒤 닫힘 | breached 0 |
| CLEARING → ACTIVE | 해제 대기 중 재위반 | 없음 — 행은 계속 열려 있다 | state · first_clear_ts 초기화 | 없음 | breached 1 |
| CLEARING → NORMAL | ts − first_clear_ts ≥ debounce_ms | **UPDATE**(CLEARED · cleared_at = ts) | 커밋 뒤 NORMAL | 커밋 뒤 닫힘 | breached 0 |

- 검산: 전이 = **8** · PostgreSQL을 쓰는 전이 3(열기 1 · 닫기 2) · ch:alarm 3 · 행을 남기지 않는 전이 5
- **해제는 CLEARING을 거친다**(W1 판정 — 원본 시퀀스는 CLEARING을 건너뛰었다). 없으면 경계값 근처 노이즈마다 이벤트가 닫히고 다시 열려 alarm_event 행이 폭증한다.
- **ACKED는 alarm:state에 머무는 상태가 아니다** — §ACK와 alarm:state. 상태도의 ACTIVE → ACKED → NORMAL은 "확인된 ACTIVE의 첫 해소가 디바운스 없이 닫힌다"로 실행된다(REQ-ALM-16).
- 발생 시각 occurred_at · 해제 시각 cleared_at이 행 ts인 이유 — 벽시계면 적체 소진 중 확정된 이벤트가 소진 시각에 몰려 알람 폭주로 보인다([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)).

## ACK와 alarm:state

인계 둘을 닫는다 — **ACK 시 alarm:state 갱신 주체**와 **CLEARING 중 ACK의 Redis 전이**. 확인 자체는 API가 PostgreSQL에 쓴다 — 행이 state ACTIVE이고 acked_at이 NULL일 때만 조건부 갱신 하나로(REQ-ALM-14).

**판정 — alarm:state의 쓰기 주체는 판정기 하나다. 확인 표면은 alarm:state를 쓰지 않는다. 판정기는 ACTIVE · CLEARING 규칙의 해소를 처음 감지할 때 PostgreSQL에서 그 event_id의 acked_at을 한 번 읽어 확인 여부를 안다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 확인 표면이 alarm:state를 ACKED로 쓴다 | 커밋 뒤 HSET | 판정기가 배치 시작에 ACTIVE를 읽고 · 확인 표면이 ACKED를 쓰고 · 판정기가 CLEARING을 써서 **ACKED가 덮인다** — 역할 분리 뒤에는 api와 worker 두 프로세스가 같은 봉인 키를 쓴다 | 버림 |
| ② 확인 신호를 Pub/Sub으로 판정기에 | 판정기가 구독해 반영 | 신호 유실 시 확인이 Redis에 영영 반영되지 않는다 — Pub/Sub은 전달을 보장하지 않는다 | 버림 |
| ③ **판정기가 해소 시점에 PostgreSQL에서 읽는다** | 쓰기 주체 하나 · 진실(PostgreSQL)에서 읽는다 | 해소 첫 감지마다 PK 읽기 1회 — 해소는 전이 때만이라 드물다 | **채택** |

- 검산: 안 = **3**
- **Redis는 확인을 모른 채 ACTIVE로 남는다.** 확인은 판정 진행에 영향을 주는 시점이 해소 하나뿐이다 — ACTIVE 동안에는 확인 여부와 무관하게 같은 판정을 한다. 그래서 확인을 Redis에 복사할 이유가 해소 시점까지 없고, 그 시점에 진실에서 읽는다. [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)의 "ACKED — alarm:state 기록 상태 · event_id" 서술은 "ACKED는 alarm_event.acked_at에서 파생 — alarm:state.state 값은 NORMAL · PENDING · ACTIVE · CLEARING 4"로 고치는 것이 이 판정의 파급이다(W4 반영).
- **PostgreSQL을 읽지 못하면 확인 안 된 것으로 본다.** CLEARING 디바운스를 타므로 해제가 늦어질 뿐이고, 닫기 UPDATE는 어차피 PostgreSQL 불가로 실패한다.

CLEARING 중 확인의 전이다. 상태도에 CLEARING → ACKED 전이가 없다는 인계(REQ-ALM-16 주석)를 아래로 닫는다.

| 확인 시점 | Redis 전이 | 행 | 그 뒤 해소가 이어지면 | 그 뒤 재위반하면 |
|------|------|------|------|------|
| ACTIVE 중 | 없음 — ACTIVE 유지 | acked_by · acked_at 채움 | 해소 첫 감지에서 acked 확인 → **즉시 닫기**(디바운스 없음) | 해당 없음 — ACTIVE 유지 |
| CLEARING 중 | **없음 — CLEARING 유지** | acked_by · acked_at 채움(REQ-ALM-14가 허용) | 디바운스 완료에서 닫기 · 확인 유지 | CLEARING → ACTIVE · 다음 해소 첫 감지에서 acked 확인 → 즉시 닫기 |
| 닫힌 뒤(CLEARED) | 해당 없음 | 409 alarms.ack_not_allowed | 해당 없음 | 새 알람 생애 |

- 검산: 시점 = **3**
- **CLEARING 중 확인은 이미 시작된 해제 디바운스를 끊지 않는다.** 확인으로 즉시 닫으려면 판정기가 CLEARING 규칙마다 배치마다 PostgreSQL을 읽어야 한다 — 해소 첫 감지 한 번이라는 읽기 상한이 깨진다. 결과는 REQ-ALM-16을 지킨다 — 닫힌 행은 acked_by · acked_at을 유지한다.

## 부분 실패 — PostgreSQL이 진실

| 실패 | 판정기 반응 | alarm:state | 통지 | 알람 기능 |
|------|------|------|------|------|
| 열기 INSERT 실패 | 전이 미확정 | PENDING 유지(직전 상태) — 다음 배치에 재시도 | 없음 | 확정이 늦어진다 |
| 닫기 UPDATE 실패 | 전이 미확정 | 직전 상태(CLEARING · ACTIVE) 유지 — 다음 배치에 재시도 | 없음 | 해제가 늦어진다 |
| alarm:state 쓰기 실패(커밋 뒤) | 판정 중단 · 다음 배치에서 읽은 상태로 재판정 | 옛 상태 | 이미 발행했으면 유지 | **같은 전이를 다시 확정하려 한다 — 열린 행이 있으면 INSERT하지 않는다**(아래) |
| alarm_eval 삽입 실패 | 같은 토큰 · 같은 백오프 재시도 → 소진 시 분석 무효 구간 기록 | 영향 없음 | 영향 없음 | 정상 — 분석 데이터만 빈다 |
| ch:alarm 발행 실패 | 계수 · 삼킴 | 영향 없음 | 누락 — 재연결 목록 재조회가 메운다 | 정상 |

- 검산: 실패 = **5**
- **커밋 뒤 Redis 쓰기 실패의 중복 열기를 막는 자리** — 열기 전에 alarm:state.event_id가 비어 있어도, 같은 rule_id의 열린 행(state ACTIVE)이 있으면 새로 INSERT하지 않고 그 event_id를 상태에 다시 쓴다. PostgreSQL 층에는 "규칙당 열린 행 1"을 강제할 부분 유일 인덱스가 없다(파티션 키 제약 · 한계 등재 #9) — 판정기의 이 확인이 강제 주체다.
- **세 쓰기를 한 트랜잭션으로 묶지 않는다**(REQ-GLB-13). 묶으면 ClickHouse 중단이 알람 확정을 막아 분석 데이터 하나 때문에 운영자가 알람을 받지 못한다.

### alarm_eval 재시도와 격리

**판정 — alarm_eval의 재시도는 원시 배치와 같은 정책(같은 토큰 · 같은 백오프 · 같은 횟수)이지만 소진 시 stream:plc:dlq로 격리하지 않는다.** 소진 배치의 ts 범위 · 행 수 · 규칙 수를 계수로 남기고 그 구간을 판정 분석에서 무효로 표시한다.

| 격리 안 | 실패 시나리오 | 판정 |
|------|------|------|
| 원 엔트리를 DLQ에 | DLQ 엔트리가 "원시 삽입 실패"와 "판정 전수 실패" 두 뜻을 갖는다 · 재처리가 원 엔트리를 다시 판정하면 **이미 전진한 상태로 과거 행을 판정해** 다른 결과가 나온다 — 판정 전수는 재생할 수 없다 | 버림 |
| 판정 결과 행을 DLQ에 | DLQ 엔트리 단위(원 엔트리)와 크기 산정이 깨진다 — 판정 행은 배치 행 × 규칙 수 | 버림 |
| **격리 없이 무효 구간 기록** | 분석 데이터가 빈다 — 원본 부분 실패 규칙이 이미 허용한 결과다 | **채택** |

- 검산: 안 = **3**
- REQ-ALM-11 · ALM-05의 "재시도 · DLQ는 Ingest 배치와 같은 정책" 문구와 격리 부분이 다르다 — W4에서 선행 문서에 반영했다. 토큰은 원 배치 토큰이며 테이블별 기억이라 tag_raw와 간섭하지 않는다.

## 비활성 태그 규칙

인계 "비활성 태그를 가리키는 알람 규칙"을 닫는다. 태그 비활성화는 논리 삭제이고(REQ-MST-06) 규칙은 FK로 남는다.

| 항목 | 판정 | 근거 | 버린 해석의 실패 |
|------|------|------|------|
| 판정 대상 | **빼낸다** — 활성 규칙 = enabled ∧ 태그 is_active | 비활성 태그는 폴링 대상이 아니라 행이 오지 않는다 · 적체 안의 늦은 행만 온다 | 판정을 계속하면 비활성화 직전 적체분이 알람을 연다 |
| 규칙 행 | 남긴다 — enabled를 바꾸지 않는다 | 감사 · FK · 태그 재활성화 시 규칙이 그대로 살아난다 | 자동으로 enabled 거짓이면 시스템이 사람의 설정을 감사 없이 바꾼다 |
| 열린 이벤트 | **닫지 않는다** | 시스템이 해소를 관측하지 않았다 — CLEARED로 닫으면 "해소됐다"는 거짓 사실이 된다 | 자동 닫기 — 알람 이력이 거짓 해제 시각을 갖는다 |
| alarm:state 키 | 남긴다 — 봉인 계열 | 재활성화 시 이어 판정 | 삭제하면 재활성화 첫 배치가 열린 행을 모른 채 새 알람을 연다 |
| 스케일 변경 | 새 tag_id에는 규칙이 없다 — 엔지니어가 새로 만든다 | 규칙의 임계값은 이전 공학 단위의 값이다 | 규칙 자동 이전 — 단위가 바뀐 태그에 옛 임계값이 붙는다 |

- 검산: 항목 = **5**
- **잔여 — 비활성 태그의 열린 이벤트는 사람이 확인하기 전까지 열려 있다.** 목록은 태그 is_active를 함께 보여 "태그가 꺼져 판정이 멈춘 열린 알람"을 식별하게 한다 — 표시 모양은 [../07_api/07_alarms.md](../07_api/07_alarms.md)다. **닫는 수단은 두지 않는다** — W5가 알람 강제 해제 표면을 두지 않기로 판정했다([../07_api/README.md](../07_api/README.md) 원본에 없는 표면 행).

## 판정 경로 직렬성

| 구성 | 같은 규칙을 평가하는 판정기 | 보장 | 잔여 |
|------|------|------|------|
| APP_ROLE all · worker 1 | 1 | 인계 순서 직렬 — 규칙 상태 읽기-쓰기 경합 없음 | 없음 |
| worker 컨테이너 2 이상(확장 단계) | 2 이상 | **없다** — 두 판정기가 같은 상태를 읽고 쓴다 | 같은 알람의 이중 열기 · 전이 유실 |

- 검산: 구성 = **2**
- **worker를 늘리는 확장은 판정 분할 규칙과 함께 들어간다.** 규칙을 판정기에 나누는 수단(rule_id 분할 · 원자 전이 스크립트)이 정해지기 전에는 worker를 하나로 둔다 — 확장 단계 진입 조건의 정본은 [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md)다.

## 규칙 시드

**판정 — 알람 규칙은 시드하지 않는다(현행 0행 유지). S7 시연은 규칙 쓰기 표면으로 만든다.** 표면으로 만들면 규칙 쓰기의 감사(REQ-ALM-03)와 무효화 체인 ②가 시연 안에서 함께 검증된다. 시드로 넣으면 감사 행 없는 규칙이 생기고, 디바운스 실험(AC-09)의 임계값이 실험 기록이 아니라 시드 파일에 숨는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 판정 구간 A1~A6 · 알람 통지 지연 | 신설 · 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) · 실측 |
| 판정 구간 ≤ 플러시 주기 관계의 실측 | 1계층 관계 — 값 미확인 | S7 · 인계 대기 히스토그램 |
| worker 다중화 시 판정 분할 수단 | 미설계 — 확장 단계 | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |
| 비활성 태그의 열린 이벤트를 닫는 수단 | 닫힘 — 두지 않는다(W5 판정 — 알람 강제 해제 표면 없음) · 잔여는 한계 등재 #17 | [../07_api/README.md](../07_api/README.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| ACKED 파생 표기 · alarm_eval 격리 문구 정합 | 판정 — 선행 문서 갱신 필요 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) · [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md)(W4 반영) |
| 인계 대기 · 판정 무효 구간 · 전이 수 메트릭 이름 | **W6 판정** — alm_handoff_wait_seconds · alm_eval_gap_batches_total · alm_eval_gap_rows_total · alm_transitions_total | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 알람 확인(ACK)의 실시간 전파 | **미설계**(W5 등재) — ch:alarm은 열림 · 닫힘만 싣고 확인은 싣지 않는다 · 다른 운영자 화면의 확인 표시는 이벤트 목록 캐시 TTL(현행 참고 30초)만큼 늦다 | [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) §확인(ACK) 신호 부재의 계측(**W6 판정** — alm_acks_total + 구조 관계 상한 + EXP-33 두 브라우저 관찰 · 전파 신호는 두지 않는다) · [../07_api/07_alarms.md](../07_api/07_alarms.md) #2 |
| alarm_eval 분석 무효 구간의 기록 자리 | **미설계**(W5 등재) — 소진 배치의 ts 범위를 "기록한다"만 있고 테이블 · 키 · 메트릭 중 어디인지 없다 · 판정 이력 분석 표면이 빈 버킷을 "판정 없음"과 "기록 실패"로 가르지 못한다 | [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) §구간 기록(**W6 판정** — 계수 alm_eval_gap_* + 구조화 로그 이벤트 alarm_eval_gap · 분석 API 응답에는 표지 없음) · [../07_api/07_alarms.md](../07_api/07_alarms.md) #6 |

## 관련 문서

- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 상태 머신 2 · alarm_event.state 대응
- [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) — 직접 호출 예외 근거
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 목적이 다른 세 쓰기
- [../03_requirements/10_alarms.md](../03_requirements/10_alarms.md) — REQ-ALM 계약
- [04_routing.md](./04_routing.md) — ② 분기 기전
- [03_ingest_batch.md](./03_ingest_batch.md) — 인계 앞의 배치 확정
- [05_realtime_read.md](./05_realtime_read.md) — ch:alarm 푸시 · STALE 배수
