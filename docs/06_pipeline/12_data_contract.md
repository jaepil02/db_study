# 데이터 계약 (12_data_contract)

> **대상**: 측정값 하나가 계층을 지나며 바뀌는 모양의 정본 — 단계별 스키마(와이어 → 디코딩 → Stream 엔트리 → ClickHouse 행 → API 응답) · 스키마 버전 필드 v · t0 · dt 규칙 · 최신값 Hash 값 · Pub/Sub 페이로드 · 스풀 프레임 · DLQ 엔트리 · 계약 변경 규칙 · 발행자 공통 계약
> **작성일**: 2026-09-24
> **원천**: 원본 data_flow.md §14 · §14.1 · §14.2 · §15(커밋 ff66a37) · 원본 architecture.md §9.3(커밋 ff66a37) · docs_plan.md 파일 목차(06_pipeline/12) · ADR-01 · ADR-04 · ADR-14 · ADR-15 · REQ-GLB-01 · 02 · 21 · REQ-COL-09 · REQ-GEN-07 · REQ-ING-01 · 05 · REQ-TSQ-05 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 기준값 + 오프셋 인코딩 · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) tag_raw · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) 봉인 계열 값 모양

모듈 사이의 결합은 **데이터 계약 하나로만** 한다(REQ-GLB-21). Collector와 Ingest는 같은 프로세스에 있어도 서로의 코드를 부르지 않고 Stream 엔트리의 모양으로만 만난다 — 역할 분리(APP_ROLE) 뒤에는 두 모듈이 서로 다른 시점에 배포되어 **두 버전이 공존하는 구간이 반드시 생긴다.** 이 문서가 그 모양과 버전 규칙의 정본이다.

계약의 물리적 자리는 packages/shared의 스키마 정의다(ADR-01) — 이 문서는 필드 · 타입 · 의미 · 불변 조건을 고정하고 코드는 쓰지 않는다. 테이블 DDL의 정본은 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md), API 응답 봉투 · 시각 형식은 [../07_api/01_conventions.md](../07_api/01_conventions.md)(W5), 시각 의미론은 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)다.

## 계층을 지나는 변형

원본 계약 흐름도(원본 data_flow.md §14)를 단계 체인으로 옮긴다.

```plain
1 와이어        Modbus 응답 — 16비트 빅엔디안 워드 배열 · 품질 · 시각 없음
   → 워드 순서 적용 + 타입 변환
2 디코딩        Collector 메모리 — tag_id · raw · eng · ts · quality
   → 공학 단위 변환 + 품질 판정 + 데드밴드
3 Stream 엔트리  MessagePack 컬럼 배열 — v · d · s · t0 · tg · dt · va · q(스캔 사이클 1 = 엔트리 1)
   → 해제 + 행 전개 + 컬럼 정렬
4 ClickHouse 행  tag_raw 7컬럼 — ts · device_id · tag_id · value · quality · scan_seq · ingested_at
   → 집계 + dictGet + 다운샘플
5 API 응답      meta + series[].points(배열의 배열)
   → 열 지향 변환
6 차트          uPlot 열 배열(브라우저)
```

- **품질과 시각은 2단계에서 처음 생긴다.** 와이어에는 둘 다 없다 — 품질은 Collector가 판정하고 ts는 Collector가 폴링 시각으로 찍는다([02_collect.md](./02_collect.md)).
- **3단계가 모듈 경계의 계약이다.** 발행자 셋(Collector · 모드 B · 모드 C 표면)이 같은 모양을 내고 소비자 하나(Ingest)가 v로 해석을 고른다.
- 4 → 5에서 행이 버킷으로 접히고 이름이 붙는다 — 이름은 저장하지 않고 조회 시점에 붙인다(ADR-16).

## 1 · 2단계 — 와이어와 디코딩

| 단계 | 필드 | 타입 | 예 | 규칙 |
|------|------|------|------|------|
| 1 와이어 | 워드 배열 | uint16[] · 빅엔디안 | [0x4291, 0x999A] — FLOAT32 ABCD 72.8 | 태그당 1 · 2 · 4워드 또는 비트(FC01 · FC02는 시드 금지) |
| 2 디코딩 | tag_id | uint32 | 3401 | 기동 로드의 태그 정의에서 |
| 상동 | raw | float64 | 72.8 | 워드 순서 적용 → 타입 변환 — FLOAT64 4워드 순서는 [02_collect.md](./02_collect.md) §FLOAT64 4워드 순서 판정 |
| 상동 | eng | float64 | 72.8 × 1.0 + 0.0 | eng = raw × scale + offset_value |
| 상동 | ts | epoch ms 정수 | 1757400000123 | 모드 A는 요청 블록 송신 직전 · 생성 모드는 생성기 시각 |
| 상동 | quality | uint8 | 9 | 2 · 4 · 9 · 0 — 3이면 행 자체가 없다 |

- 검산: 필드 행 = **6** · 디코딩 필드 5(tag_id · raw · eng · ts · quality)
- **raw는 Stream에 싣지 않는다.** 엔트리의 va는 eng다 — raw가 필요한 디코딩 대조는 태그 등록 시점의 일이고 적재 경로의 일이 아니다.

## 3단계 — Stream 엔트리

엔트리 하나 = **설비 하나의 스캔 사이클 하나**다(생성 모드는 설비 하나의 시점 하나). 필드 이름을 요소마다 반복하지 않는 컬럼 배열이라 크기가 줄고 ClickHouse 컬럼 지향 삽입으로 바로 넘어간다(원본 data_flow.md §14.1).

| 필드 | 타입 | 뜻 | 불변 조건 | 없으면 |
|------|------|------|------|------|
| v | uint8 | 스키마 버전 | **필수** · 현행 1 | 소비자가 해석을 고를 수 없어 해독 불가 격리 |
| d | uint32 | device_id | 필수 · 마스터의 설비 | 행의 설비를 알 수 없다 |
| s | uint64 | scan_seq — 발행자의 사이클 일련번호 | 필수 · 설비 안에서 단조 증가(재기동 시 재시작 허용) | tag_raw.scan_seq가 빈다 |
| t0 | uint64 | 기준 시각 epoch ms | **엔트리 안 ts의 최솟값** | dt 기준이 없다 |
| tg | uint32[] | tag_id 배열 | 길이 = dt · va · q 길이 | 행 전개 불가 |
| dt | int32[] | t0 기준 오프셋 ms | **0 이상** · ts[i] = t0 + dt[i] | 상동 |
| va | float64[] | 공학 단위 값 | 유한 값 — NaN · 무한대는 발행 전에 BAD_RANGE로 판정된다 | 상동 |
| q | uint8[] | 품질 코드 | 0 · 1 · 2 · 4 · 9 중 하나 — 3 · 5는 오지 않는다 | 상동 |

- 검산: 필드 = **8** · 스칼라 4(v · d · s · t0) + 배열 4(tg · dt · va · q)
- **t0를 엔트리의 최솟값으로 고정한다(판정).** 용어 사전이 "t0가 사이클 최솟값이라는 보장이 없어 음수 dt를 금지하지 않는다"며 넘긴 자리를 닫는다. Collector는 사이클 첫 요청의 송신 직전 시각을 t0로 쓰고 뒤 블록은 그 이후라 dt ≥ 0이 자연히 성립한다. 생성기도 엔트리 안 최소 ts를 t0로 둔다. **소비자는 음수 dt를 거절하지 않고 계수만 한다** — 발행자 결함을 적재 유실로 바꾸지 않기 위해서다.
- **dt가 int32라 한 엔트리의 시각 폭은 약 ±24.8일이다.** 한 사이클 안에서 넘칠 수 없으므로, 넘친다면 한 엔트리에 다른 사이클이 섞였다는 결함이다.
- **품질 1(UNCERTAIN)은 계약상 허용하되 현재 부여 주체가 없다**([02_collect.md](./02_collect.md) §품질 판정). 계약에서 빼면 부여 주체가 생길 때 v를 올려야 한다.
- 엔트리 크기의 원본 산정은 약 7 KB(설비당 태그 500)이며 실제 크기는 미확인이다([../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)).

### 발행자 공통 계약

| 발행자 | 엔트리 단위 | v · 필드 | 품질 | 백프레셔 검사 | 태그 집합 |
|------|------|------|------|------|------|
| Collector(모드 A 포함) | 설비 × 스캔 사이클 | 같은 계약 | 판정 결과 2 · 4 · 9 · 0 | 발행 파이프라인의 그룹 적체 | 기동 로드한 마스터 태그 |
| GEN 모드 B | 설비 × 생성 시점 | 같은 계약 | 전부 9 · DROPOUT은 행 생략 | 상동 — [10_datagen_inject.md](./10_datagen_inject.md) §모드 B 적체 검사 | 시드와 같은 집합 |
| GEN 모드 C 표면 | 요청 본문을 변환한 설비 × 시점 | 같은 계약 — 본문 모양은 W5 | 상동 | 표면이 XADD 전에 | 상동 |

- 검산: 발행자 = **3** — 모드 D는 Stream을 지나지 않아 이 계약의 발행자가 아니다
- **발행자 하나라도 계약을 어기면 소비자는 격리로만 반응한다.** 해독 불가 엔트리는 재시도 없이 DLQ로 가고 XACK된다(REQ-ING-01) — 발행자의 결함이 적재를 멈추지 않지만 DLQ 계수로 드러난다.

## 4단계 — ClickHouse 행

| 컬럼 | 타입 | 출처 | 규칙 |
|------|------|------|------|
| ts | DateTime64(3, 'Asia/Seoul') | t0 + dt[i] | **epoch 정수로 보낸다** — 문자열이면 컬럼 시간대로 파싱되어 보낸 쪽과 어긋난다 |
| device_id | UInt32 | d | 정렬 키 첫 자리 — 태그의 설비 이동 금지의 이유 |
| tag_id | UInt32 | tg[i] | 이름은 싣지 않는다(ADR-16) |
| value | Float64 | va[i] | 무손실 Gorilla 코덱 |
| quality | UInt8 | q[i] | 7값 한 컬럼(출처 · 건강 겹침 — W3 판정) |
| scan_seq | UInt64 | s | 엔트리의 모든 행이 같은 값 |
| ingested_at | DateTime64(3, 'Asia/Seoul') | **서버 DEFAULT now64(3)** | 적재 코드가 보내지 않는다 |

- 검산: 컬럼 = **7**
- **ingested_at을 적재 코드가 채우면 E2E에서 Stream 대기와 삽입 구간이 빠진다**(REQ-ING-05 · REQ-GLB-01). E2E = ingested_at − ts를 SQL 한 줄로 재는 것이 이 계약의 핵심이다.
- 삽입 형식은 JSONCompactEachRow + 요청 압축 · HTTP 8123이며(REQ-ING-05) 테이블은 plc 데이터베이스로 한정해 쓴다.

## 5단계 — API 응답

| 필드 | 뜻 | 규칙 |
|------|------|------|
| meta.interval | 서버가 실제로 고른 해상도 | 요청 값이 아니다 — 상향되면 여기 드러난다 |
| meta.pointCount | 반환 포인트 수 | 다운샘플 뒤 |
| meta.downsampled | LTTB 적용 여부 | 참이면 2차 축소됨 |
| meta.cached | 캐시 히트 여부 | 성능 디버깅용 |
| series[].tagId · tagName · unit | 태그 식별과 Dictionary 메타 | 이름 · 단위는 조회 시점 값 |
| series[].points | 배열의 배열 — 시각 · 집계값 순의 열 위치 고정 | 객체 배열이 아니다 |

- 검산: 필드 행 = **6**
- **배열의 배열인 이유** — 2,000포인트 기준 JSON이 원본 예상치 약 1/3로 줄고 uPlot의 열 지향 형식으로 바꾸기 쉽다(원본 data_flow.md §14.1). 열 순서는 요청 aggregations 순서를 따른다.
- 시각 형식(epoch 또는 오프셋 포함 ISO 8601)의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)(W5)다.

## 봉인 계열 값과 채널 페이로드

Stream 밖에서 모듈이 주고받는 모양이다. 키 패턴의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다.

| 대상 | 모양 | 쓰는 쪽 | 읽는 쪽 | 규칙 |
|------|------|------|------|------|
| rt:latest:{device_id} 필드 | 필드 = tag_id · 값 = "ts,value,quality" | SW-11 쓰기 주체 · 복원 | RLT · TSQ 진행 구간 | ts는 epoch ms 10진 · value는 10진 문자열 · **조건부 쓰기(새 ts ≥ 저장 ts)** |
| ch:rt:{device_id} | 조건부 쓰기가 받아들인 (tag_id · ts · value · quality) 배열 | 상동 | WebSocket 게이트웨이 | 버려진 옛 값은 싣지 않는다 |
| ch:alarm | 알람 열림 · 닫힘 이벤트(event_id · rule_id · 전이 · ts) | ALM(PostgreSQL 커밋 뒤) | WebSocket 게이트웨이 | 커밋 전 발행 금지 |
| ch:cacheinv | 무효화된 키 이름 | api 업무 쓰기(커밋 뒤) | 다른 api 인스턴스 · Collector · RLT 중계 | 키 이름 그대로 — 접두 포함 |
| alarm:state:{rule_id} | 필드 7(state · first_breach_ts · breach_count · event_id · first_clear_ts · last_value · last_ts) | ALM 판정기 하나 | ALM 판정기 | 시각은 epoch ms 정수 · state 값은 NORMAL · PENDING · ACTIVE · CLEARING |

- 검산: 대상 = **5**
- **alarm:state의 state 값에 ACKED가 없다.** 확인은 alarm_event.acked_at에서 판정기가 읽는다([08_alarm.md](./08_alarm.md) §ACK와 alarm:state).
- 채널 메시지의 직렬화 형식(JSON)과 필드 이름의 최종 모양은 [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5)가 WebSocket 프레임과 함께 정한다.

## 스풀 프레임

XADD가 실패하거나 위험 단계일 때 Collector가 쓰는 파일이다(원본 data_flow.md §14.1 · 원본 architecture.md §9.3).

| 항목 | 계약 | 이유 | 어기면 |
|------|------|------|------|
| 자리 | api 컨테이너 /app/spool · named volume spooldata | 재기동을 넘어 남는다 | 컨테이너 파일 시스템이면 재기동에 스풀이 사라진다 |
| 파일 | *.msgpack.spool · 프레임 열 | 순차 재생 전용 | 분석 포맷(컬럼형)은 목적이 다르다 |
| 프레임 | 4바이트 길이 접두(uint32 빅엔디안) + MessagePack 본문 | 앞에서부터 길이만큼 읽는다 | 구분자 방식이면 본문 바이트와 충돌한다 |
| 본문 | **3단계 엔트리 그대로**(v 포함) | 인코더 하나 · 재발행에 변환이 없다 | 다른 모양이면 재발행 경로에 변환 코드와 두 번째 계약이 생긴다 |
| 끝 검사 | 마지막 프레임 길이가 파일 끝을 넘으면 그 프레임은 쓰다 끊긴 것 | 기록 도중 크래시 | 잘린 본문을 XADD하면 해독 불가로 DLQ에 간다 — 계수하고 버린다 |

- 검산: 항목 = **5**
- **스풀 본문이 v를 갖는 것이 재기동 뒤 재발행을 안전하게 한다.** 스풀은 옛 버전 코드가 썼을 수 있고, 재발행된 엔트리를 소비자가 v로 해석한다 — 두 버전 공존 규칙이 스풀에도 그대로 적용된다.

## DLQ 엔트리

stream:plc:dlq 엔트리 하나 = **실패한 원 엔트리 하나**다(W3 판정 — 배치 통째가 아니다).

| 필드 | 뜻 | 자리 |
|------|------|------|
| 원 엔트리 본문 | 3단계 엔트리 그대로 | 키 공간 정본 |
| 원 엔트리 ID | stream:plc:raw에서의 ID | 상동 |
| 오류 사유 | 해독 불가 · 재시도 소진 · 그 밖 | 상동 |
| **원 배치 토큰** | 재시도 소진 사유일 때 그 배치의 insert_deduplication_token | **이 문서 판정 — 신설 필드** |

- 검산: 필드 = **4** · 키 공간 정본의 값 모양 3 + 신설 1
- **원 배치 토큰을 싣는 이유** — DLQ 재처리가 원 토큰으로 직접 삽입하면 첫 시도가 사실 기록된 경우를 윈도우 안에서 흡수하고, 윈도우 밖이면 토큰별로 묶어 정확 키 존재 확인을 한다([11_backpressure_failure.md](./11_backpressure_failure.md) §DLQ 재처리). 해독 불가 사유는 배치에 들기 전에 격리되므로 토큰이 없다. 키 공간 정본의 값 모양 갱신은 W4에서 반영했다.

## 스키마 버전 v

**재시작 시점에 Stream에는 옛 코드가 만든 엔트리가 적체돼 있고, 새 코드가 그것을 읽는다.** 역할 분리 뒤에는 Collector와 Ingest가 다른 시점에 배포되어 두 버전이 공존하는 구간이 반드시 생긴다(원본 data_flow.md §14.1). v는 그 구간의 엔트리를 버리거나 잘못 해석하지 않게 하는 유일한 장치다.

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 필수 | 모든 엔트리 · 스풀 프레임 · DLQ 본문에 v | 없는 엔트리는 해독 불가 — 버전 추정 금지 |
| 소비자 선택 | Ingest는 v로 디코더를 고르고 모르는 v는 격리 · XACK | 추정 해석은 필드 의미가 바뀐 엔트리를 조용히 틀리게 적재한다 |
| 공존 | 소비자는 적어도 **현재 v와 직전 v** 둘을 읽는다 | 배포 순서가 한 번 어긋나면 적체 전체가 DLQ로 간다 |
| 증가 조건 | 필드 삭제 · 의미 변경 · 타입 변경 | 선택 필드 추가는 v를 올리지 않는다 |
| 발행자 동기 | 발행자 셋이 같은 v를 낸다 — 모드 B · C도 | 발행자마다 다른 v면 공존 규칙이 셋으로 갈라진다 |

- 검산: 규칙 = **5**
- 현행 v는 1이다. 1은 이 문서의 8필드 계약이다.

## 계약 변경 규칙

원본 계약 변경표(원본 data_flow.md §14.2)에 이 문서가 더한 셋이다.

| 변경 | 허용 | 절차 | 어기면 |
|------|------|------|------|
| Stream 엔트리에 선택 필드 추가 | 허용 | v 유지 · 소비자가 존재 여부 확인 | 해당 없음 |
| Stream 엔트리 필드 삭제 · 의미 변경 | 주의 | v 증가 → 소비자에 두 디코더 적용 → 발행자 셋 적용 → 적체 · 스풀 · DLQ에 옛 v가 없음을 확인 → 옛 디코더 제거 | 발행자 먼저 바꾸면 옛 소비자가 새 엔트리를 격리한다 |
| ClickHouse 컬럼 추가 | 허용 | DEFAULT 지정 — 기존 파트 무영향 · 대조군 동형 DDL도 같은 변경 단위 | 대조군과 컬럼이 달라지면 동일 쿼리 비교가 깨진다 |
| ClickHouse ORDER BY 변경 | 불가 | 새 테이블 생성 후 이관 | 정렬이 다른 파트가 섞여 인덱스가 무의미 |
| ClickHouse 원시 컬럼 변경 | 주의 | MV 분리 → 테이블 변경 → MV 재생성(롤업 · MV 제약 #4) | MV가 깨져 롤업이 오류 없이 빈다 |
| API 응답 필드 추가 | 허용 | 프론트는 모르는 필드를 무시 | 해당 없음 |
| API 응답 필드 삭제 | 주의 | 버전 경로(v2) 신설 후 단계적 폐기 | 기존 화면이 빈 칸을 그린다 |
| **스풀 · DLQ 본문** | Stream 엔트리 규칙을 따른다 | 같은 v · 같은 절차 | 스풀 재발행 · DLQ 재처리가 옛 v를 만나 격리된다 |
| **봉인 계열 값 모양(rt:latest · alarm:state)** | 주의 | 읽는 쪽 먼저 두 모양 수용 → 쓰는 쪽 변경 → 옛 모양이 남지 않음 확인(봉인 키는 축출되지 않아 저절로 사라지지 않는다) | 옛 모양 값이 TTL 없이 영구히 남아 파서가 둘이 된다 |

- 검산: 변경 유형 = 원본 6 + 신설 3(원시 컬럼 변경 · 스풀 · DLQ · 봉인 계열 값) = **9**
- **봉인 계열 값 모양 변경이 가장 조용히 실패한다.** 캐시 계열은 TTL이 옛 모양을 지우지만 봉인 계열은 아무도 지우지 않는다 — 변경 절차에 "옛 모양 잔존 확인"이 들어가는 이유다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 실제 엔트리 크기 · 컬럼 배열 대 객체 배열 크기 비 | 3계층 미확인 — 원본 예상치 약 7 KB(태그 500) · 약 1/9 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) · 실측 |
| 모드 C 요청 본문 모양 | 미정 — 이 계약으로 변환된다 | [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| 응답 시각 형식 · WebSocket 프레임 · 채널 필드 이름 | 미정 | [../07_api/01_conventions.md](../07_api/01_conventions.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5) |
| DLQ 엔트리 원 배치 토큰 필드 | 판정 — 키 공간 값 모양 갱신 필요 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)(W4 반영) |
| 음수 dt · 잘린 스풀 프레임 계수 이름 | 미정 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |

## 관련 문서

- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 기준값 + 오프셋 · 시각 의미론
- [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) — tag_raw DDL
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 봉인 계열 값 모양 · DLQ
- [02_collect.md](./02_collect.md) — 디코딩 · 품질 · ts
- [03_ingest_batch.md](./03_ingest_batch.md) — 소비 · 격리
- [11_backpressure_failure.md](./11_backpressure_failure.md) — 스풀 · DLQ 재처리
