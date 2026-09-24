# F-10 백프레셔와 장애 (11_backpressure_failure)

> **대상**: F-10 흐름의 기전 정본 — 백프레셔 전파 체인(판정량 그룹 적체 · 히스테리시스 ADR-23) · 스풀 진입 · 재발행 · 종료 · 축출 연쇄 · **ClickHouse 중단 복구와 SW-11 두 구현의 차이** · Redis 중단(두 degrade 동시) · PostgreSQL 중단 · **DLQ 재처리 경로** · 재빌드 · 재시작 영향 · 장애 × 흐름 영향 행렬
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — DLQ 재처리 그룹 이름 grp:dlq 반영 · MAXLEN만 미정으로 · §스풀 기동 시 잔여 → 실제 절 이름으로 교정
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 data_flow.md §12 · §12.1 · §12.2 · §12.3 · §12.4 · §13(커밋 ff66a37) · 원본 architecture.md §9.3 · §17(커밋 ff66a37) · 원본 implementation_plan.md §7.2 · §5 S6(커밋 ff66a37) · docs_plan.md 보정 #5(7.2 → 06_pipeline/11) · 웨이브 인계(DLQ 재처리 경로) · ADR-05 · ADR-09 · ADR-10 · ADR-13 · ADR-21 · ADR-23 · ADR-24 · D-13 · REQ-GLB-05 · 09 · 10 · REQ-COL-12 · 13 · REQ-ING-17 · REQ-NFR-01 · 02 · 16 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) 임계 · 단계 · 시나리오 정본 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)

F-10은 정상 흐름이 아니라 **흐름이 막혔을 때 데이터가 어디로 비켜 가고 어떻게 돌아오는가**다. 원칙은 하나다 — **버퍼가 차면 조용히 버리지 않고 실패시키고 계측한다**(REQ-GLB-10). 단계의 이름 · 임계 · 하강 규칙 · 장애 시나리오 10행의 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)이고, 이 문서는 그 단계가 **어느 모듈의 어느 호출로 실행되는가**(스풀 · 재발행 · 소진 · 재처리 · 복원 순서)를 고정한다.

원본은 단계를 스트림 길이(XLEN)로 판정했지만 XACK는 엔트리를 지우지 않아 정상 운전의 XLEN은 MAXLEN까지 차오른다. 판정량은 **컨슈머 그룹의 미확인 적체(lag + pending)**다(ADR-21). 이 문서의 모든 "적체"는 그 양이다.

## 백프레셔 전파 체인

원본 전파 흐름도(원본 data_flow.md §12.1)를 판정량 교정과 ADR-09 구조로 옮긴다.

```plain
ClickHouse 삽입 지연(머지 폭주 · 디스크 포화 · 중단)
   → flusher 삽입 시간 증가 · 재시도대기
   → 창 버퍼 가득 → 컨슈머 XREADGROUP 정지(프로세스 메모리에 적체를 들이지 않는다)
   → 그룹 lag 증가 · PEL 유지 = 미확인 적체 증가
   → 발행자(Collector · 모드 B · 모드 C)가 발행 파이프라인의 XINFO GROUPS로 적체를 읽는다
   → 주의: 경고 알림 · 컨슈머 증설(삽입 병목엔 효과 없음)
   → 경고: SW-10 on이면 데드밴드 강화 · off면 무동작(ADR-24)
   → 위험: Collector 스풀 · 모드 B 발행 중단 · 모드 C 503
   → 검사를 우회한 발행자가 있으면 MAXLEN 트리밍 → 미소비분이 잘리면 stream_trimmed_unacked(결함)
```

- **컨슈머 정지가 체인의 연결 고리다.** 컨슈머가 계속 읽으면 적체가 Stream이 아니라 api 메모리로 옮겨 가 판정량이 낮게 보이고, 발행자는 스풀로 가지 않은 채 api가 메모리로 죽는다([03_ingest_batch.md](./03_ingest_batch.md) §행 수 상한과 flusher 메모리).
- **1차 신호는 발행자가 만든다.** Redis OOM이 아니라 애플리케이션의 적체 검사가 스풀을 연다 — MAXLEN은 검사를 우회한 발행자를 막는 최후 안전장치이고, 트리밍이 미소비 엔트리를 자르면 그것 자체가 결함으로 센다.
- **판정의 원인이 삽입이 아닐 수도 있다.** 판정기가 플러시 주기보다 느리면 인계 대기 → flusher 정지 → 같은 체인이 오른다([08_alarm.md](./08_alarm.md) §인계와 직렬 판정기) — 인계 대기 히스토그램과 삽입 지연 히스토그램이 원인을 가른다.

## 단계별 실행 주체

| 단계 | Collector | 모드 B | 모드 C 표면 | Ingest | 단계 이탈(ADR-23) |
|------|------|------|------|------|------|
| 정상 | 발행 | 발행 | 수락 | 정상 소비 | 해당 없음 |
| 주의 | 발행 | 발행 | 수락 | 읽기 컨슈머 증설 · 경고 알림 | 진입 임계 − 폭 미만이 유지 시간 지속 |
| 경고 | SW-10 on만 데드밴드 × 강화 계수 | 발행 | 수락 | 상동 | 상동 |
| 위험 | **스풀** — 폴링은 계속 | **발행 중단 · 중단 수 계수** | **503 datagen.stream_full** | 소비 계속 | 적체 < 주의 임계 → 복구 |
| 복구 | 스풀 재발행 + 새 수집분은 Stream 직접 | 주의 임계 미만에서 재개 | 수락 | 소비 · 소진 모드 | 스풀 잔여 0 → 정상 |

- 검산: 단계 = **5** · 위험 반응 주체 3(Collector · 모드 B · 모드 C)
- 임계 값(MAXLEN 비율 10% · 50% · 90%)과 폭 · 유지 시간의 정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)다. 발행 경로 셋이 같은 임계를 쓴다.
- **소진 모드(Ingest)는 단계가 아니라 배치 규칙이다** — 적체가 주의 임계 이상인 채로 삽입이 성공하기 시작하면 정렬된 창 묶음으로 배치를 키운다([03_ingest_batch.md](./03_ingest_batch.md) §소진 모드).

## 스풀 — 진입 · 재발행 · 종료

| 국면 | 기전 | 규칙 | 어기면 |
|------|------|------|------|
| 진입 | 위험 단계 판정 또는 XADD 실패(OOM · 연결 끊김) | 이번 엔트리부터 /app/spool 프레임 파일에 순서대로 기록 · spool_active | 버리면 유실 · 폴링을 멈추면 결측 |
| 기록 | 4바이트 길이 접두(uint32 빅엔디안) + MessagePack 본문 | Stream 엔트리와 같은 페이로드 — 변환 없음 | 다른 인코더면 재발행에 변환 코드가 생긴다 |
| 유지 | 위험 동안 모든 새 엔트리 | 적체가 경고 · 주의 대역으로 내려와도 **주의 임계 미만까지 유지** | 임계 바로 아래에서 닫으면 스풀과 Stream이 번갈아 받아 순서가 뒤섞인다 |
| 재발행 | 복구 단계 · 앞 프레임부터 순차 XADD | 적체가 주의 임계 이상이면 **재발행만 일시 정지** | 재발행이 적체를 다시 올려 복구 중 주의 반응이 외부 적체로 계측된다 |
| 새 수집분 | 복구 중에는 Stream에 직접 | 스풀에 계속 쌓지 않는다 | 수집 속도 ≥ 재발행 속도인 동안 스풀이 영영 비지 않는다 |
| 종료 | 스풀 잔여 0 → 정상 · spool_active 0 | 파일 삭제는 마지막 프레임의 XADD 성공 뒤 | 먼저 지우면 마지막 프레임이 사라진다 |
| 기동 시 잔여 | 기동 로드 뒤 스풀에 프레임이 있으면 **복구 단계로 시작** | spooldata는 named volume이라 재기동을 넘는다 | 잔여를 무시하면 재기동 전 스풀이 영영 재발행되지 않는다 |

- 검산: 국면 = **7**
- **재발행 엔트리는 새 엔트리 ID를 받는다.** 옛 ts의 행이 새 창에 들어가므로 배치 토큰은 새 창 기준이고, 스풀 프레임은 XADD 실패 뒤에만 쓰였으니 ClickHouse에 이미 있을 수 없다 — 재발행이 중복을 만들지 않는다.
- **재발행은 옛 ts를 늦게 적재한다.** 순서 무관성(REQ-GLB-07)이 허용하고, 최신값은 조건부 쓰기가 옛 값을 버리며([05_realtime_read.md](./05_realtime_read.md) §덮어쓰기 순서 역전), 알람은 늦은 행으로 전이하지 않는다([08_alarm.md](./08_alarm.md) §행 평가 순서). 과거 구간 조회 캐시는 TTL만큼 옛 결과다([06_timeseries_read.md](./06_timeseries_read.md)).
- 스풀 파일의 포맷 계약은 [12_data_contract.md](./12_data_contract.md) §스풀 프레임이다. 확인은 docker compose exec api ls -l /app/spool로 한다(호스트에서 직접 보이지 않는다).

## 축출 연쇄

Redis 메모리 압박의 연쇄다. MAXLEN · maxmemory 값과 산정의 정본은 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)다.

```plain
Stream 충전(확인된 엔트리도 MAXLEN까지 남는다) + DLQ + 최신값 · 알람 상태 + 캐시
   → maxmemory 도달
   → volatile-lru: TTL 있는 캐시 계열(cache · lock · rl · auth)부터 축출
      → 조회 캐시 히트율 하락 · 원천 쿼리 증가 · 리프레시 토큰 축출로 재로그인
   → TTL 키 소진 뒤 XADD OOM
   → 발행자 위험 단계(스풀) — Stream 엔트리의 조용한 유실은 없다
```

- **연쇄를 모는 것은 적체가 아니라 Stream 충전량이다.** 정상 운전에서도 Stream은 MAXLEN 근처를 점유한다 — 축출 실험은 스냅샷 복원 직후(Stream이 비어 있을 때)부터 충전 곡선을 따라 관찰한다([../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) §MAXLEN과 maxmemory).
- **봉인 계열은 끝까지 남는다.** TTL이 없어 volatile-lru의 후보가 아니다 — 축출은 캐시 계열만 잃고, 캐시 계열은 원천이 있어 degrade한다(auth만 원천이 없어 재로그인).
- M 티어 정상 구성(설비당 태그 200)에서는 연쇄가 재현되지 않는다 — 태그 500 구성 또는 maxmemory 하향이 재현 조건이다(AC-32).

## ClickHouse 중단 복구

원본 중단 복구 시퀀스(원본 data_flow.md §12.3)를 단계로 옮긴다. 원본에 없던 최신값 · 알람 줄을 더했다.

```plain
T+0 중단     flusher INSERT 연결 거부 → 같은 토큰 백오프 재시도 · XACK 보류 · PEL 보존
             창 버퍼 가득 → 컨슈머 정지 → lag 증가 → 단계 상승(주의 → 경고 → 위험 → 스풀)
             최신값: SW-11 ingest면 정지 → STALE · collector면 계속 갱신
             알람: 판정 인계가 삽입 확정 뒤라 **판정도 멈춘다**
T+중단 동안  재시도 소진 배치는 DLQ(원 엔트리 단위) → XACK — 재시도가 중단 길이보다 짧으면 DLQ가 찬다
T+복구      INSERT 성공 → XACK → 소진 모드(정렬된 창 묶음 · COUNT 확대)
             적체 < 주의 임계 → Collector 복구 단계 → 스풀 재발행
             최신값: ingest면 옛 창부터 따라잡으며 갱신 · collector면 변화 없음
             알람: 옛 창의 판정이 몰려 들어온다 — 발생 시각은 행 ts · 통지는 소진 시각
T+소진 끝   적체 0 · 스풀 0 → 정상 · 검증
```

- **A형 — ClickHouse 중단은 알람도 멈춘다.** 통념은 "알람은 Redis · PostgreSQL에 쓰니 ClickHouse와 무관하다"이다. 부정 — 판정 입력이 **삽입이 확정된 배치**라(ADR-11) 삽입이 멈추면 판정할 배치가 오지 않는다. 진짜 축은 판정의 입력 경계다. 대체 경로 — 중단 중 알람은 복구 뒤 소진과 함께 늦게 열리고, occurred_at은 행 ts라 이력은 정확하다. 장애 시나리오 #1의 "최신값 정지"에 **알람 정지**를 함께 적는 것은 W4에서 반영했다.
- **재시도 소진이 DLQ를 채운다.** 현행 참고 백오프 합계 31초보다 긴 중단은 재시도 중이던 배치를 DLQ로 보낸다 — 원본 합격 기준 "유실 0건"은 DLQ 재처리(§DLQ 재처리)를 마친 뒤에 판정한다. 중단 중 새로 읽히는 배치는 컨슈머 정지로 창 버퍼에 들어오지 않으므로 DLQ로 가는 것은 중단 시작 무렵의 배치 몇 개다.
- **복구 직후 알람 통지가 몰린다.** 소진 모드는 과거 창을 빠르게 판정하므로 중단 동안의 위반이 한꺼번에 ch:alarm으로 나간다 — 알람 폭주가 아니라 지연 통지이며 발생 시각이 과거다.

| 검증 항목 | 확인 방법 | 합격 기준(원본) | 판정 자리 |
|------|------|------|------|
| 무손실 | 생성 수(차감 반영) 대 tag_raw count — DLQ 재처리 뒤 | 완전 일치 | REQ-NFR-01 · AC-11 |
| 무중복 | tag_id + ts 중복 행 | 0 | REQ-NFR-02 |
| 소진 시간 | 적체가 0으로 돌아오는 데 걸린 시간 | 중단 시간의 30% 이내(원본 목표 · 미확인) | REQ-NFR-16 |
| 결측 구간 | ts 정렬 시 공백 | 없음(모드 A는 폴링이 계속된다) | AC-11 |
| 중단 중 STALE 전환 | SW-11 ingest에서 최신값이 배수 × 주기 뒤 STALE | 전환됨 | ADR-10 파생 지침 |

- 검산: 검증 = **5** — 원본 4 + 신설 1(STALE 전환)

### SW-11 두 구현의 차이

ADR-10이 S6 실측으로 미룬 비교의 측정 자리다. 채번 · 기본값 정본은 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)(SW-11 LATEST_VALUE_WRITER · 기본 ingest)다.

| 비교 축 | ingest(IngestLatestValueWriter) | collector(CollectorLatestValueWriter) | 재는 법 |
|------|------|------|------|
| ① 중단 중 갱신 공백 | 중단 시간 전체 + 소진 시간 | 0 — 폴링이 계속되는 한 | 설비별 rt:latest ts의 정체 구간 |
| ② 최신값 대 argMax 불일치 | 0 — 적재된 값만 쓴다 | 중단 동안 **전 설비** — ClickHouse에 없는 값 | 주기 대조 rt:latest 대 argMax(value, ts) |
| ③ 복구 뒤 수렴 시간 | 소진 시간과 같다 — 옛 창부터 따라잡는다 | 소진 시간 — ClickHouse 쪽이 따라잡는다 | ②의 불일치가 0으로 돌아오는 시간 |
| DLQ 격리분 | 최신값에 오지 않는다 | **최신값에만 있고 이력에 없다** | DLQ 엔트리 태그의 rt:latest 대조 |
| 기동 복원 소유 | ING | COL(기동 로드 뒤 같은 창) | [05_realtime_read.md](./05_realtime_read.md) §기동 복원과 복원 창 |

- 검산: 비교 축 = **5** — ADR-10 측정 설계 3(① · ② · ③) + 파생 2
- **비교는 SW-02 on으로 한다**(조합 제약 #7). 두 구현은 쓰기 포트만 다르고 읽기 포트는 같다.
- **B형 — collector에서 ②가 0이 아닌 것은 결함이 아니라 결합도의 대가다.** 결론 — 대시보드가 살아 있는 대신 최신값이 진실(ClickHouse)보다 앞선다. 반대 시나리오 — ②를 0으로 만들려고 collector가 적재 확인을 기다리면 ingest 구현과 같아져 비교가 무의미하다. 파생 지침 — S6 결정은 ①과 ②의 교환으로 판정하고, "진실은 ClickHouse"(REQ-GLB-11)의 문구를 collector 채택 시 "적재 확정 전 사본을 허용한다"로 고칠지 함께 판정한다.

## Redis 중단

**두 degrade가 동시에 발동한다** — 캐시 계열은 원천으로 우회하고, 봉인 계열은 명시적으로 실패한다(ADR-05 · REQ-GLB-09). 인스턴스가 하나라 인프라가 지켜 주던 이 구분을 키 계열별 래퍼가 지킨다(ADR-13).

| 모듈 | 중단 중 반응 | 드러나는 것 | 복구 뒤 |
|------|------|------|------|
| COL | XADD 실패 → 스풀 · 폴링 계속 · SW-11 collector 최신값 쓰기 실패 계수 | spool_active · spool_bytes | 복구 단계 재발행 · 마스터 전체 재로드(재연결 대조) |
| ING | XREADGROUP 실패 → 대기 · 재시도. 삽입 성공 뒤 XACK 실패면 후속(최신값 · 판정 인계)을 하지 않는다 | 적재 정지 | 미확인 엔트리를 회수 · 재전달 → 같은 창 · 같은 토큰으로 무시 · 이번에 XACK와 후속 |
| ALM | alarm:state 읽기 실패 → 판정 중단 | 판정 구간 계측 0 | 재전달 배치로 판정 재개 |
| RLT | 최신값 503 realtime.latest_unavailable · Pub/Sub 끊김 → WebSocket 푸시 중단 | 503 · 푸시 0 | 클라이언트 재연결 → REST 최신값 1회 |
| TSQ | 캐시 호출 타임아웃 → ClickHouse 직행 · 200 | 지연 상승 | 히트율 회복 |
| MST · WRK | 목록 캐시 우회 → PostgreSQL · 쓰기 성공 · 체인 ② · ③ 실패 계수 | 지연 상승 | 옛 사본은 TTL까지 |
| AUT | 로그인 · 갱신 · 로그아웃 503 auth.token_store_unavailable · 레이트 리밋은 세지 않고 통과 | 503 · 통과 계수 | 재시도 |

- 검산: 모듈 = **7**
- **삽입 성공 뒤 XACK 실패는 크래시와 같은 경로다.** 엔트리는 PEL에 남고(AOF 보존) 회수 뒤 재전달되며, 창 정렬 배치라 같은 토큰으로 ClickHouse가 무시한다 — 재전달 관계식(윈도우 블록 수 ÷ 초당 삽입 > 회수 지연)이 성립하는 한 중복이 없다([03_ingest_batch.md](./03_ingest_batch.md)).
- **복구 순서는 AOF 복원 → 컨슈머 그룹 확인 → 스풀 재발행 → 최신값 복원이다.** 그룹은 재연결 때 없으면 만든다(MKSTREAM). 최신값은 SW-11 쓰기 주체가 재연결 시 기동 복원과 같은 창으로 1회 복원하고, 그래도 빈 설비는 요청 시 빈 키 복원이 채운다 — 조건부 쓰기라 AOF가 보존한 새 값을 덮지 않는다.

## PostgreSQL 중단

| 흐름 | 반응 | 응답 | 근거 |
|------|------|------|------|
| F-01 수집 | 영향 없음 — 메모리 사본으로 폴링 · 마스터 변경 반영만 보류 | 해당 없음 | [02_collect.md](./02_collect.md) |
| F-02 적재 | 영향 없음 · SW-09 on이면 대조군 COPY 실패 계수 · 구간 무효 | 해당 없음 | REQ-ING-15 |
| F-03 최신값 | 설비 전체는 200(메타 비움) · 단일 태그 해석 불가면 503 | common.postgres_unavailable | [05_realtime_read.md](./05_realtime_read.md) |
| F-04 시계열 | 정상 — Dictionary 마지막 적재 값 | 200 | REQ-TSQ-08 |
| F-05 CRUD | 실패 · 쓰기를 보관하지 않는다 | 503 common.postgres_unavailable | REQ-WRK-06 |
| F-06 알람 | 판정 · 전수 기록은 계속 · 확정만 PENDING에 머물러 재시도 | 해당 없음 | REQ-ALM-19 |

- 검산: 흐름 = **6**
- **알람은 "판정은 되는데 확정이 안 되는" 상태로 간다.** alarm_eval에는 위반 판정이 쌓이고 alarm_event에는 행이 없다 — 분기 대조(AC-35)가 이 구간을 "판정 > 확정"으로 보인다. PostgreSQL 복구 뒤 다음 배치에서 확정된다.

## DLQ 재처리

인계 "DLQ 재처리 경로"(REQ-GLB-05 · REQ-ING-08 · 한계 등재 #12)를 닫는다. **판정 — DLQ 재처리는 사람이 거는 운영 절차이고, 원 토큰으로 tag_raw에 직접 삽입한다. stream:plc:raw에 다시 발행하지 않는다.**

```plain
① 읽기          stream:plc:dlq를 재처리 전용 그룹으로 읽는다 — 처리 표시는 XACK(엔트리는 MAXLEN 트리밍까지 남는다)
② 사유 분류     해독 불가 → 재처리 대상 아님(원인 분석 · 폐기 기록) · 재시도 소진 → ③
③ 보존 확인     행 ts가 원시 보존 창 밖이면 폐기 기록 — 넣어도 TTL 머지가 곧 지운다
④ 묶기          원 배치 토큰별로 원 엔트리를 모은다(DLQ 엔트리에 실린 토큰)
⑤ 존재 확인     그 행들의 (device_id · tag_id · ts)가 tag_raw에 이미 있는가
               ├─ 전부 있다(첫 시도가 기록됐지만 응답을 잃었다) ─ 삽입하지 않는다
               └─ 없다 ──────────────────────────────── ⑥
⑥ 삽입          원 토큰으로 INSERT plc.tag_raw — MV 연쇄 정상 발동
⑦ 후속 없음     최신값 · 판정 · 대조군을 다시 돌리지 않는다
```

- **재발행하지 않는 이유 셋.** ① 새 엔트리 ID → 새 창 → 새 토큰이라 첫 시도가 사실 기록된 배치가 두 번 들어간다. ② 재발행이 최신값 쓰기와 판정 인계를 다시 태워, 과거 값으로 알람 상태를 흔든다. ③ 원인이 해소되지 않았으면 같은 배치가 다시 DLQ로 돌아오는 순환이 된다.
- **⑤의 존재 확인은 윈도우 밖 중복 제거를 대신한다.** 재처리는 대개 중복 제거 윈도우를 한참 지난 뒤라 원 토큰만으로는 중복을 막지 못한다 — 한 삽입 블록은 원시에 통째로 기록되거나 통째로 없으므로 정확 키 조회로 가른다.
- **⑦ — 판정 전수는 재생하지 않는다.** 판정은 알람 상태가 전진한 뒤라 과거 행을 다시 판정하면 다른 결과가 나온다([08_alarm.md](./08_alarm.md) §alarm_eval 재시도와 격리). SW-09 구간이면 그 구간은 대조 무효로 남는다.
- **DLQ는 MAXLEN이 조용히 자른다(한계 등재 #12).** dlq_count와 DLQ 길이를 대조해 트리밍 전에 재처리한다 — DLQ MAXLEN의 프로파일별 값은 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)가 갖는다. 재처리 전용 그룹 이름은 키 공간 정본이 정한다(그룹은 키 패턴이 아니다).

## 재빌드 · 재시작의 영향

| 항목 | 영향 | 기전 | 근거 |
|------|------|------|------|
| 중단 범위 | 수집 · 적재 · 판정 · 조회 API가 동시에 멈춘다 | 단일 컨테이너 — 역할 분리(확장 1단계)의 직접 근거 | 원본 data_flow.md §12.4 |
| 결측 구간 | 재기동 동안 SIM도 멈춰 생성 자체가 없다 — 장애가 아니라 정상 동작 | 실험 밖 결측은 재빌드 흔적으로 기록 | REQ-SIM-12 · REQ-TEC-15 |
| 미소비 · PEL | Redis AOF로 보존 → 재기동 뒤 XREADGROUP 소진 · XAUTOCLAIM 회수 | 창 정렬 · 같은 토큰으로 재전달 무시 | REQ-GLB-05 |
| 스풀 | named volume이라 남는다 → 기동 시 잔여가 있으면 복구 단계로 시작 | §스풀 — 진입 · 재발행 · 종료의 기동 시 잔여 행 | 이 문서 판정 |
| 최신값 | rt:latest는 AOF로 남는다 · 기동 복원이 조건부로 창 안을 보강 | [05_realtime_read.md](./05_realtime_read.md) | REQ-ING-11 |
| 판정 | 판정 중 · 인계 슬롯의 배치(최대 2)의 판정을 잃는다 | XACK가 인계 앞이라 재전달되지 않는다 | [08_alarm.md](./08_alarm.md) |
| 프로세스 메모리 | 창 버퍼 · 삽입 중 배치는 PEL에 있어 잃지 않는다 | XACK 전이다 | [03_ingest_batch.md](./03_ingest_batch.md) |

- 검산: 항목 = **7**
- 부하 실험 중에는 재빌드하지 않는다(REQ-TEC-15). 재기동 시간 · 결측 구간 길이는 3계층 미확인이며 실측해 기록한다.

## 장애 × 흐름 영향 행렬

[../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) §장애 시나리오 10행이 흐름마다 무엇을 멈추는지다. 칸의 뜻 — 정상 · 지연 · 정지 · 우회 · 실패(응답 코드).

| # | 시나리오 | F-01 | F-02 | F-03 | F-04 | F-05 | F-06 | F-07 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | ClickHouse 중단 | 정상 → 위험이면 스풀 | 정지 · PEL 보존 | ingest 정지(STALE) · collector 정상 | 히트 200 · 미스 503 | 정상 | **정지** | ch:rt 정지(ingest) |
| 2 | ClickHouse 느려짐 | 적체에 따라 단계 반응 | 지연 · 배치 확대 | 지연 | 지연 | 정상 | 지연 | 지연 |
| 3 | Redis 중단 | 스풀 | 정지 | 503 | 우회(ClickHouse 직행) | 우회 · 로그인 503 | 정지 | 정지 |
| 4 | Redis 메모리 초과 | OOM이면 스풀 | 정상 | 정상 | 히트율 하락 | 재로그인 발생 | 정상 | 정상 |
| 5 | PostgreSQL 중단 | 정상 | 정상(대조군 실패) | 메타 비움 · 단일 태그 503 | 정상 | 503 | 확정만 정지 | 정상 |
| 6 | Ingest 예외 | 정상 | 컨슈머 재기동 · 회수 | 지연 | 정상 | 정상 | 지연 | 지연 |
| 7 | Collector 예외 | 그 루프 결측 | 유입 감소 | 그 설비 STALE | 정상 | 정상 | 그 설비 판정 없음 | 그 설비 없음 |
| 8 | Modbus 타임아웃 | 그 그룹 행 없음 | 정상 | 그 태그 STALE | 정상 | 정상 | 그 태그 판정 없음 | 그 태그 없음 |
| 9 | api 재시작 | 정지 · 결측 | 정지 · PEL 보존 | 정지 | 정지 | 정지 | 정지 · 최대 2배치 판정 손실 | 정지 |
| 10 | 디스크 포화 | 적체 상승 | 삽입 실패 → DLQ | ingest 정지 | 지연 | PostgreSQL 쓰기 실패 가능 | 정지 | 정지 |

- 검산: 시나리오 **10** × 흐름 **7** = 70칸 · F-08 · F-09 · F-10은 열에서 뺐다 — F-08은 F-02를 따르고(삽입이 멈추면 롤업도 멈춘다), F-09는 주입 도구, F-10은 이 행렬 자체다
- **#1의 F-06 "정지"가 원본에 없던 칸이다** — §ClickHouse 중단 복구 A형.
- #10의 PostgreSQL 칸은 디스크를 공유하는 로컬 구성의 결과다 — 저장소 볼륨이 같은 디스크에 있다(ADR-18).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 소진 시간 · 재기동 시간 · 결측 구간 길이 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-16 · EXP-28 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| SW-11 최종안 · collector 채택 시 진실 문구 | 잠정 ingest — S6 실측 | ADR-10 · AC-34 |
| 히스테리시스 폭 · 유지 시간 · 강화 계수 | 2계층 · 원본 값 없음 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) S6 · EXP-20 |
| 스풀 재발행 속도 상한 | 2계층 · 현행 미정 — 적체를 주의 임계 위로 밀지 않는 속도 · 계측 spool_drain_rate | S6 · 이 문서 · EXP-20 |
| DLQ 재처리 전용 그룹 이름 · DLQ MAXLEN 프로파일별 값 | 그룹 이름 닫힘 — grp:dlq(W4) · MAXLEN 프로파일별 값은 2계층 미정(원본 한 값 10000 · S3 DLQ 실험 뒤 06_redis_memory가 정한다) | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| 장애 시나리오 #1에 알람 정지 추가 | 판정 — W4 반영 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |

## 관련 문서

- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 판정량 · 임계 · 히스테리시스 · 장애 시나리오 정본
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — MAXLEN · maxmemory · 축출
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 상태 머신 1 · 3
- [03_ingest_batch.md](./03_ingest_batch.md) — 재시도 · DLQ · 소진 모드
- [05_realtime_read.md](./05_realtime_read.md) — 최신값 복원 · 순서 역전
- [12_data_contract.md](./12_data_contract.md) — 스풀 프레임 · DLQ 엔트리 계약
