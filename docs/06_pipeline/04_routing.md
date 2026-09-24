# 3계층 분기 기전 (04_routing)

> **대상**: ★★ 학습 목표 ②의 기전 정본 — 어느 모듈이 어떤 판정으로 어느 저장소에 쓰는가 · 분기 판정 트리 · ① 원시값 · ② 알람 판정(PostgreSQL 확정 · ClickHouse 전수 · Redis 핫 상태) · **생산 카운터 기전 판정** · ③ 업무 쓰기가 Stream을 타지 않는 경로 · 사본 쓰기(최신값 SW-11 · 캐시) · **대조군 동시 적재 기전(SW-09 · COPY 1회 · 재시도 없음)** · 모듈 × 저장소 쓰기 행렬 · 분기 계측 · 스위치별 경로 변화 · 정책 문서와의 1:1 대응 검산
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — COUNTER 랩어라운드 행에 W5 판정(표면이 증가량을 계산하지 않음) 반영
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · 기록 형식 · COPY 타임아웃 관계(정본 10_observability/01 · 06)
> **원천**: 원본 data_flow.md §2 · §4 · §7 · §8 · §8.2 · §13(커밋 ff66a37) · 원본 architecture.md §5 · §9(커밋 ff66a37) · 원본 implementation_plan.md §7.2 · §7.3(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #4 · 웨이브 인계 W4 06_pipeline/04 행 전부 · W3 05/10 · W4 06/04 행 · D-01 · D-04 · D-05 · ADR-03 · ADR-06 · ADR-10 · ADR-11 · ADR-17 · REQ-GLB-11 · 12 · 13 · REQ-ING-10 · 14 · 15 · REQ-WRK-01 · 05 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) 정책 정본 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) 대조군 저장소 계약

분기의 **정책**(무엇이 어디로 왜 가는가)은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)가 갖고, 이 문서는 **기전**(어느 모듈이 어느 시점에 어떤 판정으로 어느 호출을 하는가)을 갖는다. 둘을 가르는 이유는 기전이 바뀌어도 정책이 흔들리지 않게 하기 위해서다 — SW-11이 최신값 쓰기 주체를 Ingest에서 Collector로 옮겨도 "최신값은 Redis 휘발 사본 · 진실은 ClickHouse"는 그대로다.

분기는 흐름이 아니라 **흐름 안에서 일어나는 판정**이라 F-NN을 받지 않는다([01_flow_inventory.md](./01_flow_inventory.md)). 분기는 세 흐름에 걸쳐 일어난다 — ①은 F-02 flusher에서, ②는 F-06 판정기에서, ③은 F-05의 API 트랜잭션에서다. 그리고 **③의 기전은 "갈라지지 않음"이다** — 업무 쓰기는 Stream에 오지 않으므로 ING는 ③을 받지 않는 것으로 분기에 참여한다(ING-10).

## 분기 판정 트리

쓰기 하나가 목적지를 얻기까지의 판정이다. 우측이 쓰는 모듈 · 목적지이며, 판정 순서는 정책 문서의 성격 판정 기준(쓰는 주체 → 갱신 여부 → 즉시 읽는 자 → 진실)과 같다.

```plain
쓰기 하나
├─ 사람이 인증된 API 표면으로 쓴다(F-05) ─────────────────────── Stream 경로 없음
│  ├─ 업무 행(회원 · 마스터 · 작업지시 · 실적 · 규칙) ────── MST · WRK · AUT · ALM → PostgreSQL 트랜잭션
│  │  ├─ 같은 트랜잭션의 감사 행 ─────────────────────────── 변경 도메인 → PostgreSQL audit_log
│  │  └─ 커밋 뒤 ─────────────────── cache 계열 DEL → ch:cacheinv → Dictionary → BFF → 브라우저
│  └─ 알람 확인(ACK — ②계층 행을 사람이 갱신) ──────────── ALM 표면 → PostgreSQL alarm_event 조건부 UPDATE
└─ 설비 스트림에서 온다(stream:plc:raw)
   ├─ 해독할 수 없는 엔트리 ─────────────────────────────────────────── ING → stream:plc:dlq
   ├─ 측정 사실(행 전부 — 생산 카운터 표본 포함) ──────────────── ① ING flusher → ClickHouse tag_raw
   │  ├─ SW-09 on ─────────────────────────────── ING flusher → PostgreSQL plc_tag_raw_control(COPY 1회)
   │  ├─ 삽입 블록 ────────────────────────────────── ClickHouse MV → tag_1m → tag_1h → tag_1d(F-08)
   │  └─ 최신값 사본 ────────── SW-11 ingest: ING(XACK 뒤) · collector: COL(XADD 파이프라인) → rt:latest
   └─ 확정 배치 중 규칙이 걸린 태그의 행 ─────────────────────────── ② ING → ALM 직접 호출(F-06)
      ├─ 품질 2 · 4 ────────────────────────────────────────────────────── 판정 제외 · 쓰기 없음
      ├─ 판정 결과 전수 ─────────────────────────────────────────── ALM → ClickHouse alarm_eval
      ├─ 상태가 바뀐다 ────────────────────────────────────────────────── ALM → Redis alarm:state
      └─ 이벤트가 열리거나 닫힌다 ─────────────── ALM → PostgreSQL alarm_event → alarm:state 확정 → ch:alarm
```

- **첫 분기가 경로를 고른다.** 사람의 쓰기는 요청 하나가 트랜잭션 경계라 Stream을 탈 수 없다 — 트리의 윗가지에는 stream 접두가 한 번도 나오지 않는다(REQ-GLB-12).
- **ACK는 ②계층 행을 ③의 방식으로 쓰는 유일한 자리다.** alarm_event는 판정기가 여는 ② 데이터지만 확인은 사람이 쓰므로 API 트랜잭션 · 감사(REQ-ALM-15)를 따른다. 판정기는 ACK를 alarm:state에 쓰지 않고 PostgreSQL에서 읽는다([08_alarm.md](./08_alarm.md) §ACK와 alarm:state).
- **생산 카운터는 ① 가지에서 끝난다.** 카운터 태그의 표본은 다른 태그와 같은 측정 사실이고, ② 가지로 가는 파생 판정기는 현재 없다(§생산 카운터 기전 판정).
- 최신값 · 롤업은 목적지가 아니라 **①의 파생**이다 — 진실은 tag_raw 하나다.

## ① 태그 원시값

| 단계 | 모듈 | 판정 | 목적지 · 호출 | 실패하면 | 흐름 |
|------|------|------|------|------|------|
| 발행 | COL · GEN 모드 B · C | 판정 없음 — 모든 스캔 사이클이 엔트리 하나 | XADD stream:plc:raw | 스풀 · 거절(위험 단계) | F-01 · F-09 |
| 선별 | ING 컨슈머 | 스키마 버전 v로 해독 가능한가 | 해독 불가면 DLQ · XACK | 해당 없음 — 격리가 판정 결과다 | F-02 |
| 적재 | ING flusher | 판정 없음 — 해독된 행 전부 | INSERT plc.tag_raw(창 정렬 배치 · 결정적 토큰) | 재시도 → DLQ(원 엔트리 단위) | F-02 |
| 롤업 | ClickHouse MV | 삽입 블록만 본다 | tag_1m → tag_1h → tag_1d | 원시만 확정 · 롤업 공백 — 대조 · 재계산 | F-08 |
| 사본 | ING(SW-11 ingest) | 확정 배치의 설비별 태그 최종값 | rt:latest 조건부 쓰기 + ch:rt | 최신값만 멈춘다 · STALE | F-02 · F-07 |

- 검산: 단계 = **5**
- **①에는 품질 코드에 따른 분기가 없다.** 2 · 4 · 9 · 0 행이 전부 tag_raw로 간다 — 품질은 저장의 조건이 아니라 조회 · 판정의 조건이다. 행을 만들지 않는 것은 BAD_TIMEOUT(3) 하나이고 그것은 분기가 아니라 Collector의 결측이다([02_collect.md](./02_collect.md)).
- **①의 유일한 목적지는 ClickHouse다.** 대조군 COPY는 목적지가 아니라 계측이다 — 조회 표면은 대조군을 읽지 않는다(REQ-TSQ-16).

## ② 알람 판정 — 세 쓰기

판정 한 건이 성격에 따라 세 저장소로 흩어지는 자리가 학습 목표 ②의 핵심이다(D-01 · D-04). 판정 단계 · 디바운스 · 부분 실패의 정본은 [08_alarm.md](./08_alarm.md)이며 아래는 **분기의 모양**만 고정한다.

| 쓰기 | 모듈 · 시점 | 호출 | 쓰는 조건 | 진실 여부 | 실패 시 분기 경로의 반응 |
|------|------|------|------|------|------|
| 핫 상태 | ALM 판정기 · 배치마다 | 관련 rule_id만 파이프라인 1회 읽기 · 전이분 쓰기(ADR-11) | 상태 필드가 바뀔 때 | 아님 | 판정 중단 — 봉인 계열이라 실패를 던진다 |
| 판정 전수 | ALM 판정기 · 배치마다 | INSERT plc.alarm_eval — 원 배치 토큰 재사용 | 판정한 행마다 | 아님 | 같은 백오프 재시도 · 소진 시 분석 무효 구간 기록 |
| 확정 이벤트 | ALM 판정기 · 전이 때만 | INSERT · UPDATE alarm_event(PostgreSQL) | PENDING → ACTIVE 열기 · 해제 확정 닫기 | **진실** | alarm:state를 직전 상태로 되돌리고 다음 배치에 재시도 |

- 검산: 쓰기 = **3** — 정책 문서 §목적이 다른 세 쓰기의 3행과 같은 순서 · 같은 진실 여부
- **세 쓰기는 한 트랜잭션이 아니고 순서만 계약이다.** alarm_event 커밋 → alarm:state 확정 기록 → ch:alarm 발행 순이다(REQ-ALM-10). 판정 전수는 확정과 독립이다 — ClickHouse가 멈춰도 알람은 열리고 닫힌다.
- **CDC · dual-write로 읽히는 순간이 오면 이 표가 반박 근거다.** alarm_event 한 행은 규칙의 알람 생애 한 번, alarm_eval 한 행은 행 하나의 판정 한 번이다 — 같은 사실이 아니다([../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) §CDC로 맞추자는 제안에 대하여).

## 생산 카운터 기전 판정

루트 고정 기준은 ②계층을 "알람 판정 · 생산 카운터"로 적었고, 정책 문서는 **원시 표본은 ① · 파생만 ② · production_log 대체 금지**를 판정하고 기전을 이 문서로 넘겼다.

| 부분 | 기전 판정 | 쓰는 모듈 | 목적지 | 근거 |
|------|------|------|------|------|
| 카운터 표본(COUNTER 프로파일 태그 값) | **① 경로 그대로** — 다른 태그와 같은 엔트리 · 같은 배치 · 같은 토큰 | ING flusher | tag_raw → 롤업 | 추가 전용 측정 사실이다. "생산"이라는 이름이 경로를 바꾸지 않는다 |
| 구간 생산량 조회 | 조회 시점 계산 — 판정기가 아니라 F-04 | TSQ | 쓰기 없음 | 롤업 max − min이 구간 증가량이다 · 랩어라운드 보정은 조회의 몫 |
| 파생 사실(예: 작업지시 목표 수량 도달) | **판정기를 두지 않는다 — 미설계 유지** | 없음 | 없음 — 현 스키마에 테이블이 없다 | 목적지 없이 스키마에 올리지 않는다(고유 규칙) |
| 사람의 실적 입력 | ③ 경로 — 스트림 값으로 채우지 않는다 | WRK | production_log | REQ-WRK-05 |

- 검산: 부분 = **4** · ② 가지로 가는 것 0
- **②계층의 생산 카운터 칸이 현재 비어 있는 것은 누락이 아니라 판정이다(B형).** 결론 — 현 범위에서 생산 카운터로 ②에 쓰이는 것은 없다. 반대 시나리오 — 파생 판정기를 목적지 없이 만들면 결과를 둘 곳이 없어 production_log에 쓰게 되고, 그 순간 스트림 유래 값이 업무 트랜잭션 경로에 섞여 ③의 "Stream을 타지 않는다"가 거짓이 된다. 파생 지침 — 파생 판정기를 들이려면 아래 네 조건을 같은 변경 단위에서 충족한다.

| # | 도입 조건 | 자리 |
|:-:|------|------|
| 1 | 정책 문서 데이터 종류별 목적지 #12에 파생 사실의 목적지를 먼저 판정한다 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |
| 2 | 판정기는 **확정 배치의 후처리 자리**(판정 인계 뒤 · worker 역할 · 직렬)에서 돈다 — 알람과 같은 자리 · 규칙 모델은 따로 | 이 문서 · [08_alarm.md](./08_alarm.md) |
| 3 | 인계 대상이 ALM 밖 모듈이면 **경계 예외가 하나 는다** — 예외 근거 4행 상당을 먼저 적는다 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §경계 변경 절차 |
| 4 | 목적지 테이블을 채번하고 고정 기준 테이블 수를 고친다 · production_log에 쓰지 않는다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../README.md](../README.md)(리드) |

- 검산: 도입 조건 = **4**
- **A형 — 롤업 max − min이 생산량이라는 통념은 랩어라운드에서 틀린다.** COUNTER는 UInt32에서 되감긴다([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)). 되감긴 버킷은 max − min이 거의 전 범위가 되어 생산량이 폭증해 보인다. 진짜 축은 버킷 안의 감소 지점이다 — 롤업 컬럼(min · max · last)만으로는 감소 지점을 알 수 없다. 대체 경로 — 되감김이 의심되는 버킷은 원시(1시간 이하 · 보존 7일 안)로 다시 읽어 감소 지점을 더한다. 되감김 보정을 판정기에 두는 것이 도입 조건 #2의 첫 용도다.

## ③ 업무 쓰기 — 갈라지지 않는 경로

③의 기전은 **Stream 경로가 구조적으로 없다**는 것이다. 정책 문서가 적은 깨지는 보장 넷을 기전이 어떻게 막는지다.

| 보장 | 기전 | 막는 자리 | 검증 |
|------|------|------|------|
| read-your-writes | API가 PostgreSQL 트랜잭션을 커밋한 뒤 응답한다 · 캐시는 커밋 뒤 삭제 | [07_business_crud.md](./07_business_crud.md) 무효화 체인 | AC-37 쓰기 직후 재조회 |
| 트랜잭션 원자성 | 변경과 감사가 같은 트랜잭션(REQ-WRK-08) | 변경 도메인 서비스 | 쓰기 1건 → audit_log 1행 |
| 제약 위반 즉시 응답 | 유일 · 전이 제약 위반이 커밋 시점에 409로 돌아간다 | common.duplicate_key/409 · work_orders.invalid_status_transition/409 | 표면 테스트 |
| 재시도 멱등 | 재시도는 클라이언트의 몫이고 서버는 큐에 보관하지 않는다(REQ-WRK-06) | PostgreSQL 불가 시 common.postgres_unavailable/503 | 불가 중 쓰기 → 503 · 재생 없음 |

- 검산: 보장 = **4** — 정책 문서 §업무 쓰기가 Stream을 타지 않는 이유의 4행과 같은 순서
- **ING에는 ③을 해독할 디코더가 없다.** Stream 페이로드 계약(스키마 버전 v)은 측정 행 하나의 모양뿐이라, 누군가 업무 쓰기를 Stream에 실으면 해독 불가로 DLQ에 격리된다 — 구조가 우회를 막는다.
- 검증 AC-37 — 업무 CRUD 부하 on/off에서 stream:plc:raw 유입량이 CRUD와 무관하게 움직여야 한다(REQ-GLB-12).

## 사본 쓰기 — 최신값 · 캐시

사본은 목적지가 아니다. 목적지가 둘로 보이게 만드는 사본 쓰기의 주체와 시점을 고정한다.

| 사본 | 원천 | 쓰는 모듈 · 시점 | 쓰기 방식 | 스위치 | 기전 정본 |
|------|------|------|------|------|------|
| rt:latest | tag_raw | ING flusher · XACK 뒤(SW-11 ingest) | 설비별 필드 조건부 쓰기(새 ts ≥ 저장 ts) | SW-11 | [05_realtime_read.md](./05_realtime_read.md) |
| 상동 | 상동 | COL · XADD 파이프라인(SW-11 collector) | 상동 | 상동 | 상동 |
| 상동 | 상동 | RLT · 빈 키 복원 · ING 기동 복원 | 상동 — argMax 결과 | 해당 없음 | 상동 |
| cache:q | ClickHouse 집계 | TSQ · 미스 뒤 | cache-aside · TTL + 지터 | SW-03 · 04 · 05 | [06_timeseries_read.md](./06_timeseries_read.md) |
| cache:tagmeta · devlist · alarmrules · perm · alarmevents · workorders | PostgreSQL | 읽는 모듈 · 미스 뒤 | cache-aside · 쓰기 뒤 DEL | 없음 | [07_business_crud.md](./07_business_crud.md) |
| dict_tag | PostgreSQL tag_master | ClickHouse · LIFETIME · SYSTEM RELOAD | 전량 재적재 | 없음 | 상동 |

- 검산: 사본 행 = **6** · rt:latest 쓰기 주체 3(ING · COL · RLT)
- **rt:latest는 쓰기 주체가 셋이라 조건부 쓰기가 필요하다.** 키 공간 네이밍 규칙 "키 패턴 하나에 쓰는 모듈 하나"의 예외(워밍)에 SW-11 collector가 더해진다 — 무조건 덮어쓰기면 스풀 재발행 · 회수 · 복원 경합이 옛 값으로 최신값을 덮는다(한계 등재 #2의 판정 — [05_realtime_read.md](./05_realtime_read.md) §덮어쓰기 순서 역전).

## 대조군 동시 적재 기전

저장소 쪽 계약(순서 · COPY 1회 · 재시도 없음 · 구간 count 검출)은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)가 판정했다(ADR-17). 이 절은 **flusher 안의 위치 · 커넥션 · 실패 기록 · 구간 대조 절차**를 고정한다.

```plain
① 배치 확정        창 정렬 · 결정적 토큰(03_ingest_batch)
② ClickHouse 삽입   재시도 루프 — 성공할 때까지 대조군은 건드리지 않는다
③ 대조군 COPY       SW-09 on일 때만 · 같은 행 배열 · 전용 커넥션 · 트랜잭션 1 · 타임아웃 · 시도 1회
④ XACK              ③의 성패와 무관
⑤ 후속              최신값 조건부 쓰기 → 판정 인계
```

- **③은 ②의 재시도 루프 밖이고 ② 성공 뒤 한 번이다.** 루프 안이면 ClickHouse 재시도마다 대조군에 같은 행이 쌓인다.
- **③이 느리면 XACK가 늦는다 — 이것이 SW-09가 기본 off인 이유다.** 대조군 비용이 수집 경로의 지연으로 섞이므로 SW-09 on과 목표 ② 처리량 측정을 섞지 않는다(조합 제약 #4). COPY 타임아웃은 이 섞임의 상한이며 넘으면 실패로 센다 — 값은 2계층 · 현행 미정.
- **③과 ④ 사이의 크래시만 대조군 중복을 만든다.** 재전달된 배치는 ClickHouse에서 토큰으로 무시되고 대조군에는 한 번 더 들어간다 — 막지 않고 구간 count로 검출한다(한계 등재 #5).

| 계약 | 규칙 | 어기면 |
|------|------|------|
| 입력 | ②에 보낸 것과 **같은 행 배열** · ts는 같은 epoch ms · ingested_at은 각 저장소 DEFAULT | 따로 만든 행이면 두 저장소의 행 집합이 달라 대조가 성립하지 않는다(ADR-17 버린 대안 ①) |
| 커넥션 | 업무 풀 밖 전용 커넥션 1 · 끊기면 그 배치를 실패로 세고 다음 배치가 새로 연다 | 업무 풀을 쓰면 COPY가 CRUD 커넥션을 점유해 F-05 지연이 대조 실험에 오염된다(ADR-19) |
| 실패 기록 | 대조군 실패 계수 + 실패 배치의 ts 최솟값 · 최댓값 · 행 수 · 토큰 | 기록이 없으면 무효 구간을 사후에 찾을 방법이 count 전수 대조뿐이다 |
| 재시도 | 없다 — 실패 배치는 대조군에 0행(롤백) | 재시도하면 성공 뒤 재시도 · 부분 성공의 중복을 가를 수단이 필요해진다 |
| ingested_at | 대조에 쓰지 않는다 | 두 저장소의 적재 시각은 서로 다른 시계 · 시점이라 차이가 계측 오차가 된다 |

- 검산: 계약 = **5**

대조 실험 직전의 구간 count 대조 절차다. 판정 조건(정확 일치 구간에서만 대조)은 REQ-ING-15 · REQ-NFR-18이며 기록 형식은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)가 갖는다(W6 — 격자 단계 기록의 기계 판독 블록).

```plain
① 대상 구간을 KST 일 파티션 단위로 나눈다        두 저장소의 파티션 경계가 같다(08_retention_lifecycle)
② 일마다 count(tag_raw) 대 count(plc_tag_raw_control)  정확 일치만 합격 — 오차 허용 없음
③ 불일치 일 표시                                 실패 기록(③ COPY 실패)의 ts 범위와 겹치는지 대조
④ 무효 일 처리                                   대조에서 빼거나 수리 — 측정 창 밖에서만
⑤ 수리                                           대조군 그 일 파티션을 비우고 tag_raw의 같은 일 행을 COPY → ② 재대조
```

- **⑤의 수리는 ClickHouse → PostgreSQL 복제(ADR-17 버린 대안 ③)가 아니다.** 버린 대안은 상시 복제라 복제 지연이 행 수 일치를 깨고 복제 부하가 측정에 섞였다. 수리는 측정 창 밖의 일회성 채우기이고 끝나면 count가 정확히 맞는다.
- 모드 D 백필 구간은 SW-09 경로를 타지 않으므로 GEN-10 절차로 채운다 — [10_datagen_inject.md](./10_datagen_inject.md) §모드 D 대조군 동일 행.

## 모듈 × 저장소 쓰기 행렬

"누가 어디에 쓰는가"의 전수다. 읽기는 세지 않는다. 칸의 뜻 — 쓰기가 있으면 대상 · 없으면 없음.

| 모듈 | ClickHouse | PostgreSQL | Redis 봉인 계열 | Redis 캐시 계열 | Pub/Sub |
|------|------|------|------|------|------|
| COL | 없음 | 없음 | stream XADD · rt(SW-11 collector) | cache:tagmeta 워밍 | ch:rt(SW-11 collector) |
| SIM | 없음 | 없음 | 없음 | 없음 | 없음 |
| GEN | tag_raw · 롤업(모드 D) | 대조군(GEN-10) | stream XADD(모드 B · C) | 없음 | 없음 |
| ING | tag_raw | 대조군(SW-09) | stream XACK · dlq · rt(SW-11 ingest · 기동 복원) | 없음 | ch:rt(SW-11 ingest) |
| ALM | alarm_eval | alarm_event · alarm_rule · audit_log | alarm:state | cache:alarmrules · alarmevents | ch:alarm |
| MST | 없음 — Dictionary 재적재 명령만 | 마스터 6 · audit_log | 없음 | cache:tagmeta · devlist DEL · 채움 | ch:cacheinv |
| WRK | 없음 | work_order · production_log · audit_log | 없음 | cache:workorders | 없음 |
| AUT | 없음 | user_role(역할 변경) · audit_log | 없음 | cache:perm · rl · auth | 없음 |
| TSQ | 없음 | 없음 | 없음 | cache:q · lock:rebuild:q | 없음 |
| RLT | 없음 | 없음 | rt(빈 키 복원 워밍) | lock:rebuild:rt | 없음 |
| OBS | 없음 | 없음 | 없음 | 없음 | 없음 |

- 검산: 모듈 = **11** = 도메인 11 · 어느 저장소에도 쓰지 않는 모듈 2(SIM · OBS) · ClickHouse에 데이터를 쓰는 모듈 3(GEN · ING · ALM) · PostgreSQL에 쓰는 모듈 6(GEN · ING · ALM · MST · WRK · AUT)
- **ClickHouse에 쓰는 모듈 셋 중 ①계층 목적지를 소유하는 것은 ING 하나다.** GEN 모드 D는 실험 도구의 쓰기이고 ALM은 ②의 판정 전수다 — 소유 판정 [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) §도메인 귀속 판정.
- **COL의 PostgreSQL 칸이 "없음"인 것이 Stream 경계의 증거다.** Collector는 PostgreSQL을 읽기만 하고(기동 로드) ClickHouse · PostgreSQL 어디에도 측정값을 쓰지 않는다(REQ-COL-10).
- MST의 마스터 6은 site · production_line · device · modbus_config · tag_master · tag_master_history다.

## 분기 계측

분기가 실제로 일어났는지를 저장소별 쓰기 결과로 대조하는 자리다. ING가 계층별 쓰기 결과를 계측해 분기 대조표의 원천을 만든다(ING-10 · REQ-ING-14).

| 대조 | 같은 구간의 세 값 | 기대 관계 | 어긋나면 가리키는 것 | 인수 기준 |
|------|------|------|------|------|
| ① 적재 | 적재 행 수 · tag_raw count · DLQ 행 수 | 발행 행 = tag_raw + DLQ(생략 · 결측 제외) | 유실 · 중복 · 격리 누락 | AC-01 · AC-02 |
| ② 세 쓰기 | alarm_eval 판정 수 · alarm_event 확정 수 · alarm:state 키 수 | 판정 ≥ 확정 · 상태 키 = 판정된 규칙 수 | 부분 실패 · 판정 누락 | AC-35 |
| ③ 비경유 | 업무 쓰기 수 · 같은 구간 Stream 유입 변화 | 무관 | 업무 쓰기가 Stream을 탔다 | AC-37 |
| 대조군 | 구간별 두 저장소 count | 정확 일치 | COPY 실패 · 재전달 중복 | AC-21 |

- 검산: 대조 = **4**
- **②의 기대 관계에 "판정 = 확정"이 없는 이유** — 디바운스가 PENDING 판정 대부분을 확정 없이 끝낸다. 판정 수 대비 확정 수의 비가 곧 디바운스의 오탐 억제량이다(학습 목표 ② 합격 판정 — S7).
- 계측 메트릭의 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다 — ing_routed_rows_total{layer} · alm_evaluations_total · alm_events_opened_total · redis_stream_entries_added_total(W6).

## 스위치별 경로 변화

스위치는 경로를 바꾸지만 목적지 정책을 바꾸지 않는다(정책 문서 §스위치가 분기를 바꾸는가). 기전 쪽에서 어느 호출이 바뀌는지다.

| 스위치 | 바뀌는 호출 | 그대로인 호출 | 분기 트리에서의 자리 |
|------|------|------|------|
| SW-01 off | XADD → 프로세스 안 큐 · XACK · PEL · 스풀 없음 | tag_raw 삽입 · 판정 인계 | ① 발행 가지 — 실험 전용 · 모드 A만 |
| SW-02 off | 최신값 읽기가 ClickHouse argMax | rt:latest 쓰기 · ch:rt 발행 | 해당 없음 — 읽기 경로 |
| SW-03 off | cache:q 쓰기 · 읽기 없음 | ClickHouse 집계 | 해당 없음 — 사본 |
| SW-06 off | PUBLISH 대신 게이트웨이 직접 호출(ch:rt · ch:alarm) | ch:cacheinv · 세 쓰기 | ② 발행 가지 |
| SW-08 off | 토큰 없는 INSERT | 나머지 전부 | ① 적재 가지 |
| SW-09 on | 대조군 COPY 추가 | 나머지 전부 | ① SW-09 가지 |
| SW-11 collector | rt:latest 쓰기 · ch:rt 발행 주체가 COL로 | 조건부 쓰기 방식 · ClickHouse 진실 | ① 최신값 사본 가지 |

- 검산: 경로를 바꾸는 스위치 = **7**(SW-01 · 02 · 03 · 06 · 08 · 09 · 11) · 분기 트리 밖 조회 · 병합 스위치 4(SW-04 · 05 · 07 · 10) · 7 + 4 = **11**
- **SW-10은 분기 트리 앞에서 행 수를 바꾼다.** 데드밴드가 생략한 값은 Stream에 오지 않으므로 분기의 대상이 아니다 — 목적지가 아니라 입력량이 바뀐다.

## 정책 문서와의 1:1 대응 검산

[../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) §데이터 종류별 목적지 19행마다 이 문서의 기전 자리를 대응시킨다. **정책 행이 기전 자리를 갖지 않으면 목적지만 있고 쓰는 경로가 없는 데이터다.**

| 정책 # | 데이터 | 계층 | 쓰는 모듈 · 호출 | 흐름 | 기전 자리 |
|:-:|------|------|------|------|------|
| 1 | 사용자 · 권한 | ③ | AUT 표면 트랜잭션 · cache:perm DEL | F-05 | §③ 업무 쓰기 · [07_business_crud.md](./07_business_crud.md) |
| 2 | 사이트 · 라인 · 설비 | ③ | MST 트랜잭션 · 체인 6단 | F-05 | 상동 |
| 3 | 태그 마스터 | ③ | MST 트랜잭션 + 감사 · 체인 6단 | F-05 | 상동 |
| 4 | 태그 변경 이력 | ③ | MST 스케일 변경 트랜잭션 안 | F-05 | 상동 |
| 5 | Modbus 접속 설정 | ③ | MST 트랜잭션 → Collector 재로드 신호 | F-05 → F-01 | 상동 · [02_collect.md](./02_collect.md) |
| 6 | 작업지시 · 생산 실적 | ③ | WRK 트랜잭션 · cache:workorders DEL | F-05 | 상동 |
| 7 | 감사 로그 | ③ | 변경 도메인 · 같은 트랜잭션 | F-05 | §③ 업무 쓰기 |
| 8 | 알람 규칙 | ③ | ALM 규칙 표면 트랜잭션 + 감사 · cache:alarmrules DEL | F-05 | 상동 |
| 9 | 알람 이벤트(확정) | ② | ALM 판정기 INSERT · UPDATE · ACK는 ALM 표면 조건부 UPDATE | F-06 · F-05 | §② 알람 판정 · [08_alarm.md](./08_alarm.md) |
| 10 | 알람 판정 전수 | ② | ALM 판정기 INSERT alarm_eval | F-06 | 상동 |
| 11 | 알람 핫 상태 | ② | ALM 판정기 파이프라인 읽기 · 쓰기 | F-06 | 상동 |
| 12 | 생산 카운터 | ② | 표본은 ① ING flusher · 파생은 판정기 없음 | F-02 | §생산 카운터 기전 판정 |
| 13 | PLC 태그 원시값 | ① | ING flusher INSERT tag_raw | F-02 | §① 태그 원시값 · [03_ingest_batch.md](./03_ingest_batch.md) |
| 14 | 롤업 3 | ① | ClickHouse MV 연쇄 | F-08 | [09_rollup.md](./09_rollup.md) |
| 15 | 태그 최신값 | ① 사본 | ING · COL(SW-11) · RLT 조건부 쓰기 | F-02 · F-01 · F-03 | §사본 쓰기 · [05_realtime_read.md](./05_realtime_read.md) |
| 16 | 조회 결과 캐시 | 사본 | TSQ cache-aside | F-04 | §사본 쓰기 · [06_timeseries_read.md](./06_timeseries_read.md) |
| 17 | 수집 버퍼 · DLQ | 경로 | COL · GEN XADD · ING XACK · DLQ | F-01 · F-02 · F-10 | §① 태그 원시값 · [11_backpressure_failure.md](./11_backpressure_failure.md) |
| 18 | 세션 · 토큰 | ③ 보조 | AUT auth:refresh 쓰기 · DEL | F-05 | [07_business_crud.md](./07_business_crud.md) |
| 19 | 대조군 원시값 | 계측물 | ING flusher COPY(SW-09) · GEN-10(모드 D) | F-02 · F-09 | §대조군 동시 적재 기전 |

- 검산: 정책 행 **19** = 기전 자리 **19** · 기전 자리 없는 정책 행 **0**
- 계층별: ③ 8(#1~#8) + ③ 보조 1(#18) + ② 4(#9~#12) + ① 2(#13 · #14) + 사본 2(#15 · #16) + 경로 1(#17) + 계측물 1(#19) = **19** — 정책 문서의 계층별 검산과 같은 구성
- 정책 문서의 나머지 대응 — §목적이 다른 세 쓰기 3행 ↔ §② 알람 판정 표 3행 · §업무 쓰기가 Stream을 타지 않는 이유 4행 ↔ §③ 업무 쓰기 표 4행 · §스위치가 분기를 바꾸는가 4행(SW-01 · 02 · 03 · 09) ↔ §스위치별 경로 변화의 같은 4행 · §②계층 생산 카운터 판정 ↔ §생산 카운터 기전 판정. 검산: 대응 묶음 = 19 + 3 + 4 + 4 + 1 = **31**행 · 기전 없는 정책 행 **0**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 생산 카운터 파생 사실의 목적지 · 판정기 | 판정 — 현 범위에 두지 않는다 · 도입 조건 4 | 정책 문서 #12 · 이 문서 |
| 대조군 COPY 타임아웃 값 | 2계층 · 현행 미정 — 관계 COPY 타임아웃 + ClickHouse 삽입 p95 < 창 폭 W(W6 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값) | S3 · 이 문서 · AC-21 동시 적재 기록 |
| 분기 대조 · 대조군 실패 계수 메트릭 이름 | **W6 판정** — ing_routed_rows_total{layer} · ing_control_copy_failures_total | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 구간 count 대조의 기록 형식 | **W6 판정** — 격자 단계 기록(절차 ②) · 기계 판독 블록 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| COUNTER 랩어라운드 조회 보정 | 잔여 — W5 판정: 조회 표면은 구간 증가량(max − min)을 계산하지 않는다 · 증가량 집계 요청 필드 없음 · 랩어라운드 보정은 표면이 생길 때의 몫 | [06_timeseries_read.md](./06_timeseries_read.md) · [../07_api/05_timeseries.md](../07_api/05_timeseries.md) |

## 관련 문서

- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 분기 정책 정본
- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 ②
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 저장소 계약
- [03_ingest_batch.md](./03_ingest_batch.md) — ① 적재 기전
- [08_alarm.md](./08_alarm.md) — ② 판정 기전
- [07_business_crud.md](./07_business_crud.md) — ③ 업무 쓰기 · 무효화 체인
- [05_realtime_read.md](./05_realtime_read.md) — 최신값 사본 쓰기
