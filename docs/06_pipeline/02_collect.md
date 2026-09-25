# F-01 PLC 수집 (02_collect)

> **대상**: F-01 수집 흐름의 기전 정본 — 기동 로드(PostgreSQL 태그 목록 선조회) · 스캔 그룹 폴링 · 레지스터 블록 병합 · 디코딩(FLOAT64 4워드 순서 · BOOL 판정) · 모드 A ts 채취 시점 · 품질 판정(SIMULATED · BAD_TIMEOUT 기록 자리 · UNCERTAIN 부여 주체) · 데드밴드(SW-10) · XADD와 그룹 적체 조회 · 스풀 진입 · 실행 중 마스터 변경 반영 · FC01 · FC02 해제 조건
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S3 실측 반영(기록 017) — §데드밴드에 프로파일 8종 실측 전송률 불릿 · 미확인 신설 1(압축률 변화 원인 · 모드 A DROPOUT 결측 표현)
> **개정일**: 2026-09-25 — S3 구현 반영 — S2 as-built 차이 둘 닫힘(허용 갭 20 병합 · 125 상한 · retry_count 재시도) · 재시도 조건 as-built(타임아웃만 · 지금 + timeout_ms ≤ 사이클 시작 + scan_rate_ms) · 품질 2 행의 값 자리 0 · 비유한 값은 4 · 미설계 "스캔 그룹 여럿의 위상" 닫힘(루프마다 (i + 0.5) ÷ N × 자기 주기 · 한 연결 위 사이클 배타)
> **개정일**: 2026-09-25 — S2 구현 · 실측 반영 — 폴링 계약에 시작 위상 행 신설(벽시계 격자 + (i + 0.5) × 주기 ÷ N · 기록 011 폐기 · 012) · 시작 위상 미설계 두 행 등재(스캔 그룹 여럿 · 실행 중 설비 증감) — 계약 6 → **7** · S2 as-built 차이 등재(허용 갭 병합 · retry_count 미구현 — S3)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 data_flow.md §3 · §3.1 · §3.2 · §3.3 · §14.1 · §15(커밋 ff66a37) · 원본 architecture.md §4 · §9 · §9.3 · §17(커밋 ff66a37) · 원본 tech_stack.md §6(커밋 ff66a37) · docs_plan.md 웨이브 인계 W4 06_pipeline/02 행 전부 · ADR-06 · ADR-10 · ADR-21 · ADR-22 · ADR-24 · ADR-25 · D-08 · REQ-COL-01~16 · REQ-SIM-04~07 · REQ-GLB-01 · 03 · 10 · 18 · [../02_features/03_collector.md](../02_features/03_collector.md) · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)

F-01은 **값이 레지스터에서 Stream 엔트리가 되기까지**다. 모듈은 셋이 한 프로세스에 산다 — SIM(Modbus 서버) · COL(Modbus 클라이언트 · 디코딩 · 발행) · GEN 모드 A(레지스터 갱신). 같은 프로세스여도 SIM과 COL 사이는 실제 루프백 TCP 소켓이고(REQ-SIM-07), COL과 적재 사이는 Redis Stream이다(ADR-06). **COL은 ClickHouse에 쓰지 않고 Ingest를 부르지 않는다** — 예외는 실험 전용 SW-01 off뿐이다(REQ-COL-10).

이 문서는 원본 수집 시퀀스를 plain 체인으로 옮기고, W1~W3이 넘긴 수집 쪽 미확인 여덟 건을 판정한다. 스풀의 재발행 · 복구 전이는 [11_backpressure_failure.md](./11_backpressure_failure.md), Stream 엔트리의 필드 계약은 [12_data_contract.md](./12_data_contract.md), 모드 A 생성 · SIM 주입 제어는 [10_datagen_inject.md](./10_datagen_inject.md)가 갖는다.

## 수집 한 사이클

원본 시퀀스(원본 data_flow.md §3)를 스캔 사이클 하나의 단계 체인으로 옮긴다.

```plain
기동 1회     PostgreSQL 활성 태그 · modbus_config 읽기 → cache:tagmeta:{tag_id} 워밍 → 설비 × scan_rate_ms 스캔 그룹 · 요청 블록 계산
                ↓
스캔 주기    요청 블록마다 송신 직전 시각 채취 → FC03 · FC04 요청 → 응답(설비별 timeout_ms 안)
                ↓
디코딩       ① 워드 순서 적용 → ② 타입 변환 → ③ eng = raw × scale + offset_value
                ↓
품질 판정    예외 응답 2 · 범위 밖 4 · 정상은 설비 규칙으로 0 또는 9 · 타임아웃은 행 없음
                ↓
데드밴드     SW-10 on이면 직전 전송값 대비 변화량 < deadband인 값 생략
                ↓
인코딩       설비 1 · 사이클 1 = 엔트리 1(v · d · s · t0 · tg · dt · va · q) — 대량이면 워커
                ↓
발행         파이프라인 1회 = XADD stream:plc:raw MAXLEN ~ + 그룹 적체 조회(XINFO GROUPS)
                ↓
단계 반응    적체로 백프레셔 단계 판정 → 정상 · 주의 그대로 · 경고 데드밴드 강화(SW-10 on만) · 위험 스풀
```

- **체인의 모든 단계가 한 설비의 한 사이클 안에서 끝난다.** 원본 목표는 "스캔 주기 안 완료"이며(원본 data_flow.md §1) poll_duration > scan_rate가 곧 F-01 병목의 신호다.
- **적체 조회는 발행과 같은 파이프라인이다.** 결과는 이번 XADD 뒤의 적체라서 단계 반응은 **다음 사이클의 발행**에 적용된다 — 검사와 발행 사이에 왕복을 하나 더 두지 않는 대가로 한 사이클 늦게 반응한다.
- **XLEN은 판정량이 아니다.** 확인된 엔트리가 MAXLEN까지 남아 정상 운전에서도 XLEN은 상한 근처에 머문다(ADR-21) — 판정량은 그룹 lag + pending이다.
- SW-01 off면 발행 단계가 프로세스 안 큐 호출로 바뀌고 단계 반응 · 스풀 경로가 없다(조합 제약 #2 — 모드 A 전용).

## 기동 로드 — PostgreSQL 태그 목록 선조회

**판정 — Collector 기동 로드의 원천은 PostgreSQL이다. cache:tagmeta는 기동 로드가 채우는 사본이지 읽는 원천이 아니다.** W3이 cache:tagmeta를 태그별 키로 판정하면서(키 공간 인계 판정 #1) "이 설비의 태그가 무엇인가"를 Redis에서 열거할 수 없게 됐다 — KEYS는 금지다. 원본의 "HGETALL cache:tagmeta → 미스 시 PostgreSQL"(원본 data_flow.md §3)은 단일 Hash 전제였다.

| 단계 | 읽는 것 | 경로 | 실패하면 |
|------|------|------|------|
| ① 설비 · 접속 설정 | device(is_active) · modbus_config 1:1 | PostgreSQL 직접 | 폴링을 시작하지 않고 재시도한다 — health에 collector 미준비로 드러난다 |
| ② 활성 태그 목록 | tag_master WHERE device_id · is_active — 인덱스 (device_id, is_active) | PostgreSQL 직접 | 상동 |
| ③ 메타 사본 워밍 | cache:tagmeta:{tag_id} 태그마다 | CacheKeyClient(TTL 필수) | 무시하고 진행 — 캐시 계열 degrade · 폴링에 쓰는 메타는 ①②의 메모리 사본이다 |
| ④ 스캔 그룹 · 요청 블록 | 설비 × scan_rate_ms 그룹 · 주소 정렬 후 블록 병합 | 프로세스 메모리 | 해당 없음 — 계산 단계 |

- 검산: 단계 = **4** · PostgreSQL 읽기 2(①②) · Redis 쓰기 1(③) · 계산 1(④)
- **PostgreSQL이 기동 시 불가면 수집은 시작하지 않는다(B형).** 결론 — Collector는 캐시 사본으로 대신 기동하지 않는다. 반대 시나리오 — 캐시로 기동하면 축출로 일부 키가 빠진 태그가 조용히 폴링 대상에서 빠져, 무손실 판정(생성 수 = 행 수)이 "태그 누락"을 "유실"로 오판한다. 파생 지침 — Compose가 postgres healthy 뒤에 api를 띄우므로 정상 기동에서는 이 경로를 타지 않는다(REQ-TEC-03).
- **폴링 중에는 포인트마다 PostgreSQL을 읽지 않는다**(REQ-COL-01). 메타는 ①②의 메모리 사본이 쥐고, cache:tagmeta는 RLT의 이름 · 단위 부착과 다른 인스턴스를 위한 사본이다.
- 이 판정은 REQ-COL-01 · COL-01의 "cache:tagmeta — 미스면 PostgreSQL" 서술과 어긋난다 — W4에서 선행 문서에 반영했다.

## 실행 중 마스터 변경 반영

원본은 기동 1회 로드뿐이라 태그 추가 · 비활성화 · 스케일 변경(새 tag_id 발급)이 api 재기동 전까지 폴링에 반영되지 않았다(REQ-COL-01 · REQ-MST-03 현행). 재기동은 PlcSim까지 멈춰 결측 구간을 남긴다(REQ-SIM-12).

| 안 | 기전 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 재기동 전용(현행) | 기동 로드만 | S7 마스터 시연에서 새 태그의 값이 재기동 전까지 없고, 재기동이 전 설비 결측을 만든다 — 태그 하나 추가가 수집 전체 중단이 된다 | 버림 |
| ② 주기 재로드 | 일정 주기로 PostgreSQL 전체를 다시 읽는다 | 변경이 없어도 설비 수 × 주기만큼 PostgreSQL을 읽고, 반영 지연이 주기에 묶인다 | 버림 |
| ③ **ch:cacheinv 구독** | 무효화 체인 ③단의 신호(무효화된 키 이름)를 Collector가 구독해 해당 설비만 다시 읽는다 | 신호가 유실되면 반영이 빠진다 — Pub/Sub은 전달을 보장하지 않는다 | **채택** — 유실은 재연결 대조로 메운다 |

- 검산: 안 = **3**
- **반영 단위는 설비, 반영 시점은 다음 스캔 사이클 경계다.** 신호의 키가 cache:tagmeta:{tag_id}면 그 태그의 설비를, cache:devlist:{site_id}면 그 사이트의 설비 전부를 PostgreSQL에서 다시 읽어 스캔 그룹 · 요청 블록을 새로 만든다. 사이클 도중에 바꾸지 않는다 — 한 엔트리 안에 두 버전의 태그 집합이 섞이면 엔트리의 tg와 요청 블록이 어긋난다.
- **Redis 재연결 뒤에는 전 설비를 한 번 다시 읽는다(대조).** 끊긴 동안의 신호는 다시 오지 않는다(원본 data_flow.md §9.2 재연결 공백과 같은 한계).
- **스케일 변경은 특별 취급이 없다.** 새 tag_id 발급 · 이전 태그 비활성화가 한 트랜잭션이고(REQ-MST-07) 둘 다 신호를 내므로 다음 사이클부터 새 tag_id로 발행되고 이전 tag_id는 멈춘다 — 이전 태그의 알람 규칙 처리는 [08_alarm.md](./08_alarm.md) §비활성 태그 규칙.
- 새 구독자는 발행자를 바꾸지 않는다(ADR-07). 단 **modbus_config만 바꾸는 쓰기도 cache:devlist:{site_id} 무효화 신호를 내야** Collector가 접속 설정 변경을 안다 — 무효화 체인 쪽 계약은 [07_business_crud.md](./07_business_crud.md) §도메인별 체인 적용.

## 폴링과 레지스터 블록 병합

| 계약 | 규칙 | 값 · 소유 | 어기면 |
|------|------|------|------|
| 연결 | 설비당 Modbus 연결 1 · 유닛 1 | 1계층 구조값(REQ-SIM-01) | 연결을 늘리면 루프백 포트당 동시 요청이 생겨 SIM 응답 순서가 측정에 섞인다 |
| 요청당 상한 | FC03 125 레지스터 · 설비별 max_regs_per_request 이하 | 1계층 프로토콜 제약 | 상한을 넘은 요청은 예외 응답이 되어 블록 전체가 BAD_COMM으로 저장된다 |
| 허용 갭 | 사이의 안 쓰는 레지스터를 허용 갭까지 함께 읽는다 | **2계층 — 현행 참고 20 레지스터 · 소유 이 문서** | 갭 0이면 흩어진 주소마다 요청이 늘고, 갭이 크면 쓸모없는 워드 전송이 늘어 응답이 커진다 |
| 블록 순서 | 한 사이클의 블록을 주소 오름차순으로 순차 요청 | 구조 | 병렬 요청은 연결 1개 위에서 순서만 섞인다 |
| 타임아웃 | 설비별 timeout_ms 안에 응답이 없으면 그 스캔 그룹의 그 주기를 건너뛴다 | modbus_config.timeout_ms | 다음 주기를 기다리지 않고 재시도하면 폴링 주기가 밀린다 |
| 재시도 | 같은 주기 안 재시도는 retry_count까지 · 남은 시간이 없으면 포기 | modbus_config.retry_count | 재시도가 주기를 넘기면 다음 사이클과 겹쳐 ts가 뒤섞인다 |
| **시작 위상** | 설비 i(폴링하는 설비 N개 중)의 첫 요청을 벽시계 scan_rate_ms 격자 + (i + 0.5) × scan_rate_ms ÷ N에 맞추고 이후 고정 주기 | **S2 판정** · 구조 | 위상이 기동 순간의 우연이면 창 W(엔트리 ID 시각 정렬)와의 어긋남이 기동마다 달라 fan-in 대기 · E2E가 반복마다 다른 조건이 된다 — 기록 011 폐기(E2E 편차 기준 초과 — 기동마다 폴링 위상이 달라짐) |

- 검산: 계약 = **7**
- **시작 위상을 고정하면 E2E 분포가 오프셋으로 설계된다(기록 012).** 설비별 E2E ≈ 창 끝 − 폴링 시각 + 유예 + 삽입이라 N = 5(티어 S)에서 오프셋 100 · 300 · 500 · 700 · 900 ms가 약 1,010 · 810 · 610 · 410 · 210 ms로 고르게 퍼지고, 세 반복의 p50이 608 · 609 · 608 ms로 같았다(d32b09a · 부하 실험 · S · 스위치 기본값). 0.5칸은 모드 A 생성기의 격자 갱신 순간(k = floor(now ÷ scan_rate_ms) — 계약 정본 [10_datagen_inject.md](./10_datagen_inject.md) §모드 A 레지스터 갱신)과 요청이 겹치지 않게 비킨다.
- **S2 as-built 차이 둘 — S3에서 닫혔다.** 허용 갭 병합은 같은 function_code 안에서 갭 20 이하를 한 블록으로 묶고 블록 길이는 min(125, max_regs)로 자른다(요청 순서 FC03 → FC04 · 주소 오름차순). retry_count 재시도는 타임아웃에만 하며 조건은 시도 횟수 < retry_count이고 지금 + timeout_ms ≤ 사이클 시작 + scan_rate_ms다 — 재시도의 최악 소요가 주기를 넘지 않는다. 재시도로 얻은 값의 ts는 성공한 시도의 송신 직전이고 t0는 첫 시도다. **예외 응답은 재시도하지 않는다** — 장비의 확정 답이고 재시도가 품질 분포를 흔든다. 티어 시드는 timeout_ms 3,000 > scan_rate_ms 1,000이라 재시도 조건이 성립하지 않아 재시도가 일어나지 않는다.
- **요청 수는 태그 수가 아니라 워드 수가 정한다.** FLOAT32는 2워드라 설비당 태그 200이면 400 레지스터 · 최소 4요청이다. 원본 산정 "설비 50 × 요청 블록 2"(원본 architecture.md §15)는 태그당 1워드일 때만 맞는다 — 티어 시드의 data_type 구성이 Modbus 요청 수를 정한다([10_datagen_inject.md](./10_datagen_inject.md) §티어 시드 구성).
- 원본 표 "갭 허용 병합 — 설비당 약 5요청 · 50대 1초 주기 초당 250요청"(원본 data_flow.md §3.1)은 태그 500 · 1워드 기준 원본 예상치다. 실제 요청 수는 시드 구성에서 계산하고, 폴링 지연은 3계층 미확인이다.

## 디코딩 — 워드 순서 · 타입 · 공학 단위

디코딩 순서는 워드 순서 적용 → 타입 변환 → 공학 단위 변환이며 범위 판정은 공학 단위 값으로 한다(REQ-COL-05).

### FLOAT64 4워드 순서 판정

word_order 4값(ABCD · CDAB · BADC · DCBA)은 32비트 2워드 기준 표기다(원본 tech_stack.md §6). **판정 — 4값을 "워드 순서"와 "워드 안 바이트 순서" 두 축의 조합으로 읽고, 64비트에도 같은 두 축을 그대로 적용한다.** 워드 순서 축의 "하위 워드 먼저"는 64비트에서 4워드 **완전 역순**이다.

| word_order | 워드 순서 축 | 바이트 순서 축 | 32비트(2워드) 조립 | 64비트(4워드) 조립 |
|:----:|------|------|------|------|
| ABCD | 상위 워드 먼저 | 빅엔디안 | W0 W1 | W0 W1 W2 W3 |
| CDAB | 하위 워드 먼저 | 빅엔디안 | W1 W0 | W3 W2 W1 W0 |
| BADC | 상위 워드 먼저 | 워드 안 바이트 교환 | W0' W1' | W0' W1' W2' W3' |
| DCBA | 하위 워드 먼저 | 워드 안 바이트 교환 | W1' W0' | W3' W2' W1' W0' — 8바이트 완전 리틀엔디안 |

- 검산: word_order = **4** = 워드 순서 2 × 바이트 순서 2 · W는 응답 순서의 16비트 워드 · '는 워드 안 두 바이트 교환
- **버린 해석 — 32비트 반쪽 교환(W1 W0 W3 W2)을 CDAB로 읽는 것.** 두 축 조합이 아니라 "32비트 단위 교환"이라는 세 번째 축을 끌어들여, DCBA의 64비트 뜻이 정해지지 않는다. 반쪽 교환 장비는 실재하지만 표현하려면 word_order 값이 늘어야 하므로 값 집합의 정본([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md))에서 채번한다 — 현 범위 밖 잔여다.
- **A형 — 64비트에서 순서가 틀려도 예외가 나지 않는다.** 통념은 "8바이트를 잘못 조립하면 NaN이 난다"이지만 대부분 유한한 엉뚱한 값으로 풀린다. 진짜 축은 범위 판정이며 BAD_RANGE(4)로만 드러난다. 대체 경로 — 태그 등록 시 알려진 값으로 디코딩을 대조한다(원본 tech_stack.md §6).

### BOOL 판정

| 대상 | 판정 | 근거 | 해제 조건 |
|------|------|------|------|
| 레지스터 비트 BOOL(FC03 · FC04 워드의 특정 비트) | **지원하지 않는다** | tag_master에 비트 인덱스 컬럼이 없다 — 워드에서 몇 번째 비트인지 적을 자리가 없다 | 비트 인덱스 컬럼 신설(05_data_stores/01 채번) · 디코딩 ② 단계에 비트 추출 추가 · 결합 CHECK 해제를 같은 변경 단위에서 |
| FC01 Coil · FC02 Discrete Input | **시드 금지 유지** — SIM이 비트 영역을 응답하지 않는다 | SIM 책임은 holding · input 레지스터뿐이다(REQ-SIM-04 · 05) | 아래 네 조건 전부 |

FC01 · FC02 시드 금지의 **해제 조건**은 넷이며 같은 변경 단위에서 충족한다.

| # | 조건 | 자리 |
|:-:|------|------|
| 1 | SIM에 Coil · Discrete Input 비트 Buffer를 두고 GEN 모드 A가 BINARY 프로파일로 갱신한다 | [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) · [10_datagen_inject.md](./10_datagen_inject.md) |
| 2 | Collector 디코딩이 비트를 Float64 0 · 1로 옮긴다(scale · offset_value 미적용 · 범위 판정은 0 · 1) | 이 문서 |
| 3 | 블록 병합의 비트 요청 상한(요청당 비트 수)을 1계층 값으로 확정한다 — 원본 미기재 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) function_code 표 |
| 4 | tag_master 결합 CHECK의 BOOL · FC01 · FC02 차단을 해제하고 시드에 넣는다 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) |

- 검산: 해제 조건 = **4**
- **하나만 풀면 조용한 결측이 생긴다.** CHECK만 풀고 SIM 비트 영역이 없으면 FC01 요청이 예외 응답이 되어 그 태그가 전부 BAD_COMM으로 저장된다 — 품질 분포가 "통신 불량"으로 오염된다.

## 모드 A ts 채취 시점

**판정 — 모드 A의 ts는 그 태그를 실은 요청 블록의 송신 직전 시각(api 컨테이너 시계 · epoch ms)이다. 엔트리의 t0는 그 사이클 첫 요청의 송신 직전 시각이다.** 응답 직후 시각은 Modbus 왕복 히스토그램에만 쓰고 행에 싣지 않는다.

| 후보 | E2E(ingested_at − ts)에 드는 구간 | 결과 | 판정 |
|------|------|------|------|
| 요청 송신 직전 | 구간 #2 Modbus 왕복 ~ #9 | 지연 예산표의 수집 구간(#2 → E2E)과 같다 | **채택** |
| 응답 수신 직후 | #3 디코딩 ~ #9 | Modbus 지연이 늘어난 실험에서 E2E가 그대로라 "Modbus 병목"(모드 A의 측정 목적)이 E2E에 드러나지 않는다 | 버림 |

- 검산: 후보 = **2**
- **값이 레지스터에 있던 순간은 둘 사이 어딘가다.** 어느 쪽도 측정 시각의 참값이 아니며 판정은 "E2E가 무엇을 포함하는가"로 한다 — 모드 A의 목적은 진짜 E2E와 Modbus 병목이다(REQ-GEN-06). 예산표 구간 #2의 시작 시각도 "요청 직전"이다([../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md)).
- **t0를 사이클 첫 요청으로 두면 dt는 음수가 되지 않는다.** 블록은 주소 순으로 순차 요청되므로(§폴링과 레지스터 블록 병합) 같은 사이클의 뒤 블록 ts는 t0 이상이다 — 엔트리 계약의 t0 규칙은 [12_data_contract.md](./12_data_contract.md).
- 이 판정은 REQ-COL-03의 "확정 전 두 시각을 모두 계측"을 닫는다 — 두 시각의 계측은 왕복 히스토그램으로 남고 행에는 하나만 간다.

## 품질 판정

값마다 품질 코드 하나를 단다. 코드 정의의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)이며 아래는 **Collector가 판정하는 순서**다.

```plain
응답 · 값 하나
├─ 응답이 timeout_ms 안에 오지 않음 ─────────────────────────── 행 없음(BAD_TIMEOUT 3 · 계수만)
├─ Modbus 예외 응답 ──────────────────────────────────────────── 2 BAD_COMM
├─ 공학 단위 값이 range_min · range_max 밖 ─────────────────────── 4 BAD_RANGE
├─ modbus_config.host가 컨테이너 루프백(시뮬레이션 설비) ──────────── 9 SIMULATED
└─ 그 밖 ─────────────────────────────────────────────────────── 0 GOOD
```

- **건강 코드(2 · 4)가 출처 코드(9)보다 앞선다**(REQ-GLB-18). 시뮬레이션 설비의 BAD 행은 품질 칸에서 출처를 잃고 device_id → modbus_config.host로 복원한다([../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §품질 코드 컬럼 판정).
- **Collector는 STALE(5) · UNCERTAIN(1)을 부여하지 않는다.** STALE은 조회 시점 판정이다(REQ-COL-06).
- 예외 응답은 블록 단위로 온다 — 한 요청의 예외는 그 블록의 태그 전부를 2로 만든다. 블록 병합이 넓을수록 오류 주입 한 번의 파급이 커진다.
- **2 행의 값 자리는 0이다(S3 as-built).** 받은 값이 없어 만들지 않는다 — 판독은 품질로 한다. 비유한 공학 값(NaN · ±Inf)은 4로 판정하고 값 자리는 NaN이면 0 · ±Inf면 ±Float64 최댓값으로 싣는다 — 엔트리 계약(12_data_contract)이 유한값만 받는다.
- **AC-08 통합 확인(S3)** — SIM 계획의 예외 60초는 설비 한 대 태그 50 × 60주기 = 3,000행의 2로, 지연 4,000 ms(timeout 3,000 초과)는 그 설비의 61초 행 공백으로, 범위 밖 값은 4로 나왔고 3은 0행이었다(판정 러너 scripts/lab/s3/ac08-check.sh · 정식 측정은 기록 015).

| 미확인 인계 | 판정 | 드러나는 자리 | 버린 해석의 실패 |
|------|------|------|------|
| BAD_TIMEOUT "기록"의 자리(원본 architecture.md §17 "품질 BAD_TIMEOUT 기록") | **메트릭만 기록한다** — 타임아웃 계수(설비 · 스캔 그룹 레이블)와 왕복 히스토그램의 타임아웃 칸. tag_raw 행 · rt:latest 갱신 · Stream 엔트리를 만들지 않는다 | 타임아웃율 · 조회 STALE(rt:latest ts가 멈춘다) · 롤업 cnt 감소 | rt:latest에 3을 쓰면 최신값이 "값 없는 품질 3"을 갖게 되어 "ts,value,quality" 형식에 값 자리가 빈다 · 행으로 쓰면 bad_cnt · 무손실 판정의 분모가 바뀐다 |
| UNCERTAIN(1) 부여 주체 | **부여 주체 없음 — 현행 유지.** 디코딩 체인에 보간 · 추정 단계가 없다 | 롤업 avg는 1을 0과 같은 무게로 센다([../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md)) | 주체 없이 1을 "재시도 뒤 성공 값"에 달면 재시도가 품질 분포를 바꿔 오류 주입 실험의 판정이 흔들린다 |
| 모드 A SIMULATED 표지 | W2 판정 유지 — 설비 단위 루프백 규칙(REQ-COL-07) | 품질 코드 분포 | 전역 환경변수 표지는 실설비가 섞이는 순간 틀린다 |

- 검산: 인계 판정 = **3**
- **UNCERTAIN을 재판정하는 조건은 보간 단계의 신설이다.** 그때 가중치(롤업 상태 타입 변경)도 함께 판정한다 — 롤업 세 테이블과 MV 셋을 다시 만드는 변경이다.

## 데드밴드 — SW-10

| 항목 | 규칙 | 근거 |
|------|------|------|
| 판정식 | abs(eng − 직전 전송값) < tag_master.deadband 이면 생략 | deadband는 공학 단위 절대값(W1 판정) |
| 직전 전송값 | 태그별 프로세스 메모리 · **전송한 값**만 갱신한다 — 생략한 값으로 갱신하지 않는다 | 생략 값으로 갱신하면 느린 드리프트가 매 사이클 임계 미만이라 영영 전송되지 않는다 |
| 품질 전환 | 품질 코드가 직전과 다르면 변화량과 무관하게 전송한다 | 정상 → BAD 전환이 데드밴드에 먹히면 품질 전파 검증(AC-08)이 실패한다 |
| 첫 값 · 재기동 | 직전 전송값이 없으면 전송한다 | 재기동 뒤 첫 사이클이 전부 생략되면 결측이 재빌드 흔적보다 길어진다 |
| 기본값 | **off**(SW-10) — PassthroughFilter | 성능 · 압축률 측정은 off로만 한다(조합 제약 #5) |
| 경고 단계 강화 | SW-10 on에서만 deadband × 강화 계수 · off면 무동작 | ADR-24 — 계수는 2계층 · 원본 값 없음 |
| 계측 | 생략 수를 태그 레이블 없이 설비 단위로 센다 | 무손실 판정(REQ-NFR-01)이 생략분을 생성 측에서 뺀다 |

- 검산: 항목 = **7**
- **데드밴드는 코덱이 아니라 행 수를 바꾼다.** 원본 전송률 표(RANDOM_WALK 0.1% 약 85% · STEP 약 3%)는 원본 예상치이며 실측은 SW-10 실험이다(원본 data_flow.md §3.3).
- **실측 전송률(S3 · 기록 017 · fdc7849 · 부하 실험 · S · SW-10 on · 모든 태그 deadband 0.1 공학 단위 · 모드 A 단독 프로파일 · 3회 중앙값)** — SINE 77.5% · RANDOM_WALK 79.9%(원본 예상치 약 85%) · RAMP 100.0% · STEP 2.0%(원본 예상치 약 3%) · BINARY 4.0% · COUNTER 99.7% · SPIKE 94.2% · DROPOUT 74.1%. 전송률 = 방출 ÷ (방출 + 생략). off 대비 압축률 변화는 측정 시점의 파트 병합 상태에 좌우돼 참고로만 남겼다(기록 017 폐기 · 예외). 모드 A의 DROPOUT은 레지스터에 직전 값이 남아 결측이 행 생략으로 나타나지 않는다 — 데드밴드 on에서 결측과 생략이 구별되지 않는다(미확인 등재).
- 생략분 계수의 메트릭 이름은 col_deadband_skipped_total이다([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)).

## 발행 · 적체 조회 · 스풀 진입

발행 파이프라인 하나가 싣는 명령과 그 결과가 가르는 경로다.

| 파이프라인 명령 | 래퍼 | 결과가 쓰이는 곳 | 실패하면 |
|------|------|------|------|
| XADD stream:plc:raw MAXLEN ~ | DurableKeyClient(MAXLEN 필수 인자) | 엔트리 ID — 로그 · Stream 체류 측정 시작점 | 이번 엔트리를 스풀에 쓰고 위험 단계로 간다 |
| XINFO GROUPS stream:plc:raw | 상동 | grp:ingest의 lag + pending = 미확인 적체 | lag가 비면 직전 단계 유지(ADR-21) |
| rt:latest 조건부 쓰기 · ch:rt 발행 | 상동 · FanoutPublisher | **SW-11 = collector일 때만** — 기본 ingest면 싣지 않는다 | 최신값만 멈춘다 — 발행 경로는 계속 |

- 검산: 명령 = **3** · SW-11 기본값에서 **2**
- **SW-11 collector는 스풀 중에도 최신값을 쓴다.** Redis 쓰기가 가능한 한 발행 성패와 무관하게 쓴다 — 목적이 "ClickHouse 중단 중에도 대시보드가 산다"인데 스풀 중에 멈추면 적체가 위험 단계에 닿는 순간 목적이 사라진다. 대가는 ClickHouse에 아직 없는 값이 최신값이 되는 것이다(ADR-10 · [05_realtime_read.md](./05_realtime_read.md)).
- **스풀 진입은 두 경로다** — 적체가 위험 임계를 넘거나 XADD가 실패한다(OOM · 연결 끊김). 폴링은 멈추지 않고 발행만 스풀로 돌린다(REQ-COL-12). 스풀 프레임 포맷은 [12_data_contract.md](./12_data_contract.md), 복구 재발행은 [11_backpressure_failure.md](./11_backpressure_failure.md)다.
- 위험 · 스풀 판정 임계의 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)다 — 발행 경로 셋(Collector · 모드 B · 모드 C)이 같은 임계를 쓴다.

## 실패 · 예외 경로

| 사건 | Collector 반응 | 행 · 엔트리 | 조회에서 보이는 것 | 요구 |
|------|------|------|------|------|
| Modbus 타임아웃 | 그 그룹 그 주기 스킵 · 계수 | 없음 | 그 태그만 STALE | REQ-COL-02 · REQ-SIM-08 |
| Modbus 예외 응답 | 블록 태그를 2로 발행 | 있음(2) | 값은 보이고 알람 판정에서 빠진다 | REQ-SIM-09 |
| 폴링 루프 예외 | 그 루프만 재기동 | 재기동 동안 없음 | 그 설비 STALE · 결측 채움 없음 | REQ-COL-14 |
| XADD 실패 | 스풀 전환 | 스풀 프레임 | 적재 지연 · 스풀 계측 | REQ-COL-12 |
| SIM 포트 기동 실패 | 연결 실패 → 폴링 결측 | 없음 | 그 설비 STALE | REQ-SIM-03 |
| PostgreSQL 불가(기동 시) | 폴링 보류 · 재시도 | 없음 | 전 설비 STALE · health 미준비 | §기동 로드 |
| PostgreSQL 불가(실행 중) | 영향 없음 — 메모리 사본으로 계속 | 정상 | 정상 · 마스터 변경 반영만 보류 | §실행 중 마스터 변경 반영 |

- 검산: 사건 = **7**
- **Collector의 실패는 에러 코드가 아니라 메트릭과 조회 STALE로 드러난다**(REQ-GLB-16) — 외부 표면이 없는 내부 모듈이다. 관측 지표의 목록은 REQ-COL-15가 갖는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 폴링 지연 · Modbus 왕복 · 요청 수의 실측 | 3계층 미확인 — 확정 전 임의 값 고정 금지. 원본 예상치 설비당 약 5요청 | EXP-23(모드 A) · EXP-30 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 허용 갭 20의 적정성 | 2계층 현행 참고 — 시드 주소 배치(갭 0)에서는 효과가 없다 | S3 실측 · 이 문서 |
| 데드밴드 강화 계수 | 2계층 · 원본 값 없음 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) S6 |
| 32비트 반쪽 교환 word_order | 현 범위 밖 잔여 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 비트 요청 상한(FC01 · FC02) | 원본 미기재 — 해제 조건 #3 | 상동 |
| 시작 위상 — 설비에 scan_rate_ms가 둘 이상일 때 어느 주기로 위상을 잡는가 | **닫힘(S3 판정)** — 설비 × scan_rate_ms마다 루프 하나 · 각 루프의 위상은 설비 몫 (i + 0.5) ÷ N에 자기 주기를 곱한다. 한 연결 위에서는 한 그룹의 사이클만 배타로 돈다(요청 · 디코딩만 배타 구간 · XADD는 밖) — ts에 다른 그룹을 기다린 시간이 섞이지 않는다 | S3 스캔 그룹 폴링 · 이 문서 |
| 데드밴드 on의 압축률 변화 원인 · 모드 A DROPOUT 결측 표현 | 3계층 미확인 — 압축률은 on에서 낮아졌으나 파트 병합 상태가 반복마다 달라(활성 파트 1~5 · Compact 파트라 열별 크기 0) 원인(ts Delta 불규칙 · 파트 고정 비용)을 가르지 못했다 · 모드 A DROPOUT은 레지스터 직전 값이 남아 행이 줄지 않는다 | 기록 017 · S5(재측정 — 파트 1개 수렴 · Wide 파트) · [10_datagen_inject.md](./10_datagen_inject.md) |
| 시작 위상 — 실행 중 설비 증감 시 재위상 | 미설계 — **S2는 기동 시 1회**(설비 수 N과 순번 i를 기동 로드에서 고정) · 설비 증감이 N을 바꿔도 다시 잡지 않는다. 마스터 변경 반영은 S4 | S4 · 이 문서 §실행 중 마스터 변경 반영 |
| 타임아웃 · 생략분 · 기동 미준비 메트릭 이름 | **W6 판정** — col_poll_timeouts_total · col_deadband_skipped_total · col_ready | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |

## 관련 문서

- [../02_features/03_collector.md](../02_features/03_collector.md) — COL-01~09 기능 정본
- [../03_requirements/04_collector.md](../03_requirements/04_collector.md) — REQ-COL 계약
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 품질 코드 · Modbus 매핑 enum
- [12_data_contract.md](./12_data_contract.md) — 엔트리 · 스풀 포맷
- [11_backpressure_failure.md](./11_backpressure_failure.md) — 스풀 재발행 · 복구
- [10_datagen_inject.md](./10_datagen_inject.md) — 모드 A 갱신 · SIM 주입 제어 · 티어 시드
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 적체 판정량 · 임계 정본
