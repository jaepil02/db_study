# 실증 화면 (08_evidence_screens)

> **대상**: EXP-PERF(규모별 성능 비교 — PostgreSQL 대 ClickHouse · 10^5~10^9행 · 격자 기록의 참고값 곡선 · 구조 판정 역전 구간 · 원리 증거 · 저장 비용) · EXP-FLOW(분산 처리 모니터링 — Redis Stream을 거치는 두 길 — 대용량 배치 경로와 업무 명령 경로(stream:biz:cmd)의 갈림과 처리를 flow 프레임으로 실시간 표시) — 인증 사용자 전원 · **표시 전용**
> **작성일**: 2026-09-27
> **개정일**: 2026-09-28 — 웨이브 1 검수 판정 반영(f-screens · r-screens H1 · M1 · M2 · M4 · L1~L7) — 저장 비용 WAL 바이트 산식 삭제 → **WAL 증폭 비율만**(바이트는 기록 값이 있을 때만 — 051 · 052 index_bytes I2 buildWalBytes) · biz 요약 **role**(biz-writer · api-direct)로 direct 판별 · **failed**(PostgreSQL 불가 — ⚠ + 코드 · 도메인 거절 ✕와 구분) · Redis 카드에 biz_stream_lag · biz_commands_total(result) · 행당 바이트 **닫힘**(pg_table_live_tuples · ch_parts_rows) · structuralRanges 필드 정리 · P4 저장소 값 정규화 · 원리 증거 Q5x 제외 · 캐시 선택 미적용 · 참고값 배지 한 자리 · 053 axes 미사용 · gcTime 정본 링크 · H2 미확인 · 미설계 → **미확인 · 확정 대기 등재** — 요소 · 원천 · 계약 · 판독 수 불변
> **개정일**: 2026-09-28 — 표지 키 리드 재판정 — 구독 중 표지 **cache:flow:subscribed**(rt 봉인 계열은 TTL 금지) · 표지 읽기 실패 시 발행 안 함을 표시 계약 요약 없음 행 · B형 불릿에 — 계약 수 불변
> **개정일**: 2026-09-28 — 리드 판정 1~3 · 업무 쓰기 Redis 경유 개정 반영 — EXP-FLOW 업무 길을 명령 경로(api → stream:biz:cmd → 워커 grp:biz-writer → PostgreSQL 트랜잭션 → 무효화 → 결과 → api 응답)로 · 업무 점 · 목록 · 원천 · 표시 계약(업무 단계 순서 · SW-12 direct) · 스위치 영향 SW-12 행 · 두 화면 주 기능 없음 = **OBS 보조 실증 화면**(새 기능 ID 없음) · 미확인 1행 닫힘
> **원천**: 리드 지침 .omc/screens-perf-flow-brief.md(2026-09-27 · 화면 코드 채번 · 판정 1~4) · 사용자 요구 "데이터 규모별 성능 비교 화면" · "업무 데이터와 대용량 데이터를 Redis로 분산시켜 처리하는 것을 모니터링할 화면" · "실시간으로 한 눈에 이동하고 처리되는 게 보이도록" · 사용자 결정 2026-09-27(모든 데이터가 Redis를 거쳐 분산 처리 — 업무 쓰기 명령 스트림) · 리드 지침 .omc/biz-via-redis-brief.md · [README.md](./README.md) 화면 인벤토리 · [01_standards.md](./01_standards.md) 명세 템플릿 · [07_experiment_console.md](./07_experiment_console.md) §대조군 역전 지점 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과 · §원리 대응 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기계 판독 블록 · §기록 상태와 정정 · [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) · [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · 측정 기록 048~053 기계 판독 블록

이 문서는 학습 목표 ①(저장소 선택의 근거)과 저장소 분리 설계(3계층 분기)를 **사람이 한 화면에서 보는 자리 두 곳**을 명세한다. 두 화면 모두 표시 전용이다 — 부하 · 장애를 일으키는 버튼을 두지 않는다(리드 판정 3 · GEN 표면 없음 판정 유지). 시연의 부하와 장애는 호스트 셸의 스크립트가 일으키고 화면은 그 결과를 그린다.

**두 화면의 수치는 측정 기록이 아니다.** EXP-PERF는 기록을 읽어 그리지만 격자 기록 048~053이 전부 discarded라 ms 곡선은 **참고값**이고(리드 판정 1 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정의 화면 참고값 예외), EXP-FLOW는 지금 돌고 있는 시스템의 순간 관찰이다. 정본 문장이 인용하는 것은 기록의 구조 사실 · 결정적 값뿐이고 화면 수치를 인용하지 않는다.

## EXP-PERF — 규모별 성능 비교

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-PERF |
| 웹 경로 | /experiments/perf |
| 페르소나 | 실험 수행자(주) · 시연 청중 |
| 역할 | S7 이후 인증 사용자 전원 · 표시 전용 · S2~S6 무인증 — 원천이 git에 있는 기록 파일이라 역할로 막을 것이 없다(EXP-COMPARE와 같은 판정) |
| 도입 단계 | S5 — 격자 2차 기록 048~053 이후 |
| 요청 경로 | **BFF 기록 읽기만**(api 표면 없음) — Next.js BFF가 docs/measurements를 읽기 전용으로 읽고 판독 결과만 내린다(EXP-COMPARE 역전 지점 패널과 같은 경로 · 다른 판독 보기) |

**목적**: 행 수가 10^5에서 10^9로 늘 때 쿼리마다 어느 저장소가 앞서고, 역전은 어느 구간에서 일어나며, 그 까닭이 읽은 양과 저장 구조의 어디에 있는가.

**진입**: 좌측 내비 실험 섹션 · EXP-COMPARE 대조군 역전 지점 패널의 "규모별 자세히" 링크. 진입 파라미터 q(Q1~Q5 · 기본 Q2) · cache(warm · cold · 기본 warm) — 딥링크는 이 두 값으로 곡선 · 결론 카드가 열린다.

```plain
┌─ 툴바 ─ 쿼리 [Q1 Q2* Q3 Q4 Q5] · 캐시 [웜* 콜드] · 세로 [로그* 선형] · 원천 기록 053(+048~052) · 판독 10:15:03 KST ─┐
├─ 참고값 배지 ─ ⚠ 참고값 — 편차 기준 초과(구조 판정만 정본) · 기록 048~053 discarded · 막대 = 반복 3회 최소~최대 ─────┤
├─ 규모 곡선 ───────────────────────────────────────────────────┬─ 결론 카드 ──────────────────────┤
│  ms(로그)                                                      │ Q2 단일 태그 7일 · 웜             │
│   │            ░░░░ 역전 구간 (10^7.5, 10^8.25] I2 → CH         │ I2 대비 (10^7.5, 10^8.25]         │
│   │  PG I1 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄             │   PostgreSQL I2 → ClickHouse      │
│   │  PG I2 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╳┄┄┄┄┄┄┄┄┄┄┄┄┄             │ I1 대비 10^5~10^9 ClickHouse 우세  │
│   │  CH    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄             │ 우열 미정 10^8 웜                 │
│   └──10^5──10^6──10^7──10^8──10^9── 행(로그 · 점 11)             │ PostgreSQL이 앞서는 경우 — 목록   │
├─ 배수 히트맵 ─ 행 11 × Q1~Q5 · 칸 = PG ÷ CH(참고값) · 색 = 3/3 우열(정본) · ? = 우열 미정 · 변형 [I2* I1] ──────┤
├─ 원리 증거 ─ 규모 [10^9*] · 쿼리별 CH 읽은 바이트 ÷ 논리 · PG 버퍼 블록 ÷ 힙 · 계획 노드 · 병렬 작업자 ─────────┤
├─ 저장 비용 ─ 행당 저장 B · 압축률 · 인덱스 B(CH · BRIN · btree) · PG WAL 증폭 — 결정적 값 · 단계 5 ────────────────┤
├─ 조건 표지 ─ 자원(cpuset · 메모리) · 4요소 · CH trace 로그 한계 · 동률 규칙 · 서버 µs 비대칭 · 콜드 근사 ───────────┤
└─ 판독 계수 줄 ─ 원천 기록 · 단계 기록 · 판독 불가 · 4요소 누락 · 형식이 어긋난 행 · 그리지 않은 점 · "관찰 보조 — 기록 정본 아님" ┘
```

- **곡선은 참고값이고 음영은 정본이다.** 선 위의 ms는 discarded 기록의 중앙값이라 크기를 인용하지 않는다. 역전 구간 음영과 결론 카드는 기록 053 structuralRanges(반복 3회 우열 일치 — 구조 판정)만 쓴다 — 곡선의 교차점과 음영이 어긋나면 음영이 맞다(중앙값 교차는 한 반복의 흔들림으로도 움직인다).
- **흔들림을 숨기지 않는다.** 점마다 반복 3회의 최소~최대 막대를 함께 그린다 — 막대가 겹치는 구간은 우열 미정 점과 대개 같은 자리이고, 겹침을 보여야 참고값 배지의 뜻이 눈에 보인다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 툴바 | 머리 | 쿼리 Q1~Q5 · 캐시 웜/콜드 · 세로 로그/선형 선택 · 원천 기록 번호 · 판독 시각(KST · 밀리초) · 새로고침 | 해당 없음 — 화면 동작 | BFF 기록 읽기(새로고침) |
| 참고값 배지 | 툴바 아래 | 원천 기록 가운데 discarded가 하나라도 있으면 상시 표시 · 문구 "참고값 — 편차 기준 초과(구조 판정만 정본)" · 해당 기록 번호 · 전부 valid면 배지 없음 | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 규모 곡선 | 본문 왼쪽 | ECharts 선 · 가로 행 수(로그 · 점 11 = 단계 5 + 정밀화 6) · 세로 ms · 선 3(ClickHouse · PostgreSQL I1 · I2) · 점 = client 중앙값 · 반복 최소~최대 막대 · discarded 점선 · 회색 · 역전 구간 음영 · 우열 미정 점 표지 · 툴팁(3회 값 · 서버 µs 중앙값 · 판정 기준 · 결과 일치 · 4요소) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 결론 카드 | 본문 오른쪽 | 선택 쿼리 · 캐시의 structuralRanges 행을 문장으로 — I2 대비 · I1 대비 구간 또는 "역전 없음 — 앞선 쪽 · 범위" · 우열 미정 점 · 전 쿼리의 "PostgreSQL이 앞서는 경우" 목록(winner postgresql 행과 역전 전 구간) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 배수 히트맵 | 곡선 아래 | 행 11 × 쿼리 5 · 칸 숫자 PG ÷ CH 중앙값 배수(참고값 · 소수 1자리) · 칸 색 = 그 점의 3/3 우열(정본 — 빠른 쪽 저장소 색 · 미정은 무채색 ?) · PG 변형 I2/I1 전환 · 캐시는 툴바를 따른다 | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 원리 증거 | 히트맵 아래 | 규모 선택(단계 5점 — scan 필드가 있는 기록만) · 쿼리 5행(Q1~Q5 — scan의 Q5x 행은 곡선과 같은 이유로 뺀다 · §판독 규칙 아래 auxPoints 불릿) · 툴바 캐시 선택은 적용하지 않는다(scan에 cache 필드가 없다 — 칸 머리에 "캐시 구분 없음") × (CH read_rows · read_bytes ÷ 공통 논리 크기 · PG I1 · I2 버퍼 블록 ÷ 힙 블록 · 계획 노드 · 병렬 작업자 · 결과 행) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 저장 비용 | 원리 증거 아래 | 단계 5행 × (행당 저장 바이트 CH · PG · 압축률 CH · PG · 인덱스 바이트 CH · BRIN · btree · PG WAL 증폭 비율) · "결정적 값 · 기록 NNN · discarded" 표지 · 053 정밀화 6점의 axes는 싣지 않는다(원리 증거 scan이 단계 5점에만 있어 두 표의 규모 행을 맞춘다) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 조건 표지 | 바닥 위 | 원천 기록의 run · conditions에서 자원(cpuset · storeResources · controlMemoryMb · clickhouseMaxThreads · pgMaxParallelWorkersPerGather) · 4요소 · clickhouseServerLogLevel(trace 한계) · tieRule · serverTimeAsymmetry · cacheDefinition(콜드 근사) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 판독 계수 줄 | 바닥 | 원천 기록 번호 · 단계 기록 번호 · 판독 불가(파일명) · 4요소 누락 · 형식이 어긋난 행 · 그리지 않은 점 · "관찰 보조 — 기록 정본 아님" | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |

- 검산: 요소 = **9** · 이 화면이 호출하는 기능 = **0** — 원천이 api 표면이 아니라 BFF 기록 읽기라 기능 ID가 붙지 않는다(EXP-COMPARE 역전 지점 · 실증 요약 패널과 같은 사정) · **주 기능 없는 실증 화면(OBS 보조)** — 리드 판정 1 · 분류 정본 [02_traceability.md](./02_traceability.md)
- **요소 표에 삽입 처리량이 없다.** insert_rows_per_sec는 비 쿼리 축이지만 시간을 재는 크기 수치라 결정적 값이 아니다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정) — 같은 배치를 받는 두 싱크의 시간은 valid 기록 045가 재고 EXP-COMPARE 실증 요약 패널이 그린다.
- **ClickHouse write_amplification도 그리지 않는다.** 머지 증폭은 머지 시점에 좌우되어 결정적 값이 아니다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6) — PostgreSQL 쪽 WAL 증폭만 저장 비용에 싣는다.

### 데이터 원천

모두 기계 판독 블록(schema measurement/v1)의 필드다. 기록마다 이름이 다른 필드는 판독기가 둘 다 읽어 한 모양으로 맞춘다 — 아래 "기록별 이름" 열이 그 대응이다.

| 화면 값 | 기록 필드 | 기록별 이름 | 인용 성격 |
|------|------|------|------|
| 곡선 점 · 막대 | points[] — query · rows · store · index · cache · values · median · resultMatch | 048~053 같다 · 053은 point(정밀화 점 이름 r5.5 등)를 더 싣는다 | 참고값(크기) |
| 서버 µs 툴팁 | 서버 3회 값 · 중앙값 | 048~050 server.values · server.median / 051~053 serverValues · serverMedian | 참고값(크기) |
| 판정 기준 툴팁 | 편차 판정 기준(client · server) · 편차 | 048~050 judgment.basis · judgment.deviation / 051 · 052 deviationBasis · deviation / 053 judgmentBasis · deviation | 참고값 |
| 점 단위 3/3 우열(히트맵 색) | 반복별 우열과 합의 | 048~050 dominance[](reps "CH" · "PG" · unanimous · winner) / 051 · 052 pairVerdicts[](repWinners · structuralWinner · tieWithinResolution · decidedBy) / 053 점 단위 판정 없음 — structuralRanges에서 계산(아래 판독 규칙 P4) | 구조 사실 |
| 역전 구간 음영 · 결론 카드 | structuralRanges[] — query · cache · pgVariant · crossover · winner · range · undetermined | 053만 · 방향(from · to)은 structuralRanges 행에 없다 — crossovers[](query · cache · pgVariant · from · to)에서 같은 키로 찾는다 | 구조 사실(정본) |
| 원리 증거 | scan[] — ClickHouse readRows · readBytes · resultRows / PostgreSQL sharedHitBlocks · sharedReadBlocks · tempReadBlocks · workersLaunched · actualRows · nodes | 048~052(053 없음) · nodes · executionMs는 051 · 052만 — 없으면 "계획 노드 기록 없음" | 구조 사실 · 결정적 값 |
| 저장 비용 | axes[] — storage_bytes · compression_ratio · index_bytes · write_amplification(PostgreSQL만 · 비율 그대로) | 048~052 단계 1점씩(053 정밀화 6점 axes는 읽지 않는다) · 051 · 052 index_bytes I2에 buildWalBytes · buildSec — **WAL 바이트는 이 값이 있을 때만 싣는다**(I2 인덱스 생성 WAL · 적재 WAL 아님) | 결정적 값 |
| 조건 표지 | run(commitHash · memoryProfile · memoryLimitMb · capacityTier · memoryLimitSource) · switches · conditions(storeResources · cpuset · controlMemoryMb · clickhouseMaxThreads · pgMaxParallelWorkersPerGather · clickhouseServerLogLevel · tieRule · serverTimeAsymmetry · cacheDefinition) · repeat | 048~053 같다 | 조건 |
| 단계 기록 목록 | conditions.stageRecords(단계 번호 → 기록 번호) | 053만 | 원천 선택 |

- 검산: 원천 행 = **9**
- **분모는 기록 안에서 만든다 — 화면 상수를 두지 않는다.** 공통 논리 크기 = rows × 41 B([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6의 공통 논리 41 B) · 힙 블록 = 같은 기록 Q5 I1의 sharedHitBlocks + sharedReadBlocks(Seq Scan이 힙 전부를 읽는다 — §원리 대응의 분모 9,345,856블록과 같은 값) · 행당 저장 바이트 = storage_bytes ÷ rows. 41 B 하나만 설계 상수이고 판독기 상수로 두며 05_data_stores/10과 같은 변경 단위에서 따라간다.
- **버퍼 블록은 hit + read다**(05_data_stores/10 §원리 대응의 통일). read만 쓰면 웜에서 0에 가까워져 BRIN 붕괴 · btree 페이지 방문 같은 구조가 사라진다. 100%를 넘는 칸(Q3 I2 128.2%)은 방문 횟수라서다 — 툴팁에 그 문장을 싣는다.

### 판독 규칙

EXP-COMPARE와 같은 BFF 판독 규칙([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §BFF 판독 규칙) 1 · 2 · 4 · 6 · 7을 따르고, 규칙 3(status valid)과 규칙 5(편차)를 **참고값 표시로 바꾼다**(리드 판정 1).

| # | 규칙 | 어기면 |
|:--:|------|------|
| P1 | **원천 기록** — EXP-COMPARE §대조군 역전 지점의 구조 판정 원천 선택과 같은 하나(exp에 EXP-01~05 · structuralRanges 배열 · 4요소 완비 · superseded 제외 · 번호가 가장 큰 것) | 두 화면이 다른 기록의 구간을 정본으로 보인다 |
| P2 | **단계 기록** — 원천 기록 conditions.stageRecords가 가리키는 기록만 곡선 · 원리 증거 · 저장 비용에 더한다 · 목록이 없으면 원천 기록의 점만 그리고 계수 줄에 "단계 기록 목록 없음" · 목록의 기록이 superseded · 판독 불가 · 4요소 누락이면 빼고 센다 | 1차 격자(035~039 — 역방향 적재로 BRIN이 무너진 조건)의 점이 같은 선에 섞여 가짜 꺾임이 생긴다 |
| P3 | **참고값 표지** — status discarded 점은 그리되 점선 · 회색 · 참고값 배지 · 편차 초과 칸(repeat.threshold를 넘는 점 편차)은 툴팁에 "편차 N% > 기준" · status valid 점은 실선 | 폐기 기록의 크기가 정본 곡선으로 읽히거나, 반대로 격자 실측 전체가 화면에서 사라진다 |
| P4 | **점 단위 우열** — dominance winner(unanimous true) 또는 pairVerdicts structuralWinner가 있으면 그 쪽 · null이면 미정 · 저장소 값은 한 모양으로 정규화한다(dominance의 reps · winner "CH" → clickhouse · "PG" → postgresql — pairVerdicts · structuralRanges · crossovers의 값) · 053 정밀화 점은 structuralRanges 행에서 계산(undetermined에 그 점 지수가 있으면 미정 · crossover가 있으면 a 이하는 from · b 이상은 to · null이면 winner · 방향을 찾지 못하면 "방향 미상" 빗금) · 행 수 → 지수는 log10을 0.25 단위로 반올림 | 중앙값 비로 색을 칠하면 반복 사이에 뒤집힌 점이 한쪽 우세로 보인다 |
| P5 | **같은 점 중복** — 같은 (query · rows · store · index · cache)가 두 기록에 있으면 번호가 큰 기록 | 재측정과 옛 측정이 한 점에 겹친다 |
| P6 | **그리지 않은 점** — median null · 로그 축의 0 이하 · unit이 ms가 아닌 점은 그리지 않고 "그리지 않은 점 N"으로 센다(0이어도 보인다) · resultMatch false 점은 속 빈 점 · Q5x 등 auxPoints는 곡선에 싣지 않는다 | 0 ms가 "비용 없음"으로 읽히거나 결과가 다른 두 쿼리의 속도가 비교된다 |

- 검산: 판독 = **6** — 공통 규칙 5개(1 · 2 · 4 · 6 · 7) 적용 + 3 · 5 대체
- **auxPoints(Q5x — 조건 없는 count)를 곡선에서 빼는 이유** — ClickHouse는 파트 메타데이터로 답해 데이터를 읽지 않는다(05_data_stores/10 §동일 쿼리 5종 A형). 한 축에 두면 "ClickHouse 전체 스캔 1 ms"로 읽힌다.

### 표시 계약

| 계약 | 내용 | 어기면 |
|------|------|------|
| 가로축 | 행 수 로그 · 눈금 10^5 · 10^6 · 10^7 · 10^8 · 10^9 · 정밀화 점은 눈금 없이 점만 · 툴팁에 "10^7.25 = 17,780,000행" | 선형 축이면 10^5~10^8이 한 픽셀에 눌려 역전 구간이 안 보인다 |
| 세로축 | ms 로그 기본 · 선형 전환 · 단위 표기 "ms · client 중앙값(참고값)" | 선형 기본이면 PostgreSQL I1 10^9(수십 초)가 ClickHouse 전 구간을 바닥선으로 만든다 |
| 역전 음영 | structuralRanges의 선택 쿼리 · 캐시 · pgVariant I2 행의 (10^a, 10^b] 반개구간 · 음영 안에 "I2 → ClickHouse"(방향) · I1 행은 결론 카드에만 · 역전 없음이면 음영 없이 곡선 머리에 "관측 범위 10^a~10^b 역전 없음 — 앞선 쪽" | 교차점 하나를 찍으면 구간 폭(10^0.25 · 10^0.5 · 10^0.75) 안의 교차 위치가 정해진 것처럼 읽힌다 |
| 우열 미정 | undetermined 점과 P4 미정 점에 ? 표지 · 결론 카드에 "우열 미정 10^8 웜" | 미정 점이 앞 · 뒤 어느 쪽에 붙어 구간이 실제보다 좁게 보인다 |
| 참고값 배지 | discarded 점이 하나라도 그려지면 툴바 아래 배지 하나(곡선 · 히트맵 · 결론 카드 전체에 걸린다 — 요소 표 · 와이어프레임과 같은 자리) · 문구 고정 "참고값 — 편차 기준 초과(구조 판정만 정본)" | 캡처한 화면 한 장이 정본 수치처럼 돈다 |
| 결정적 값 표지 | 원리 증거 · 저장 비용 칸은 "결정적 값 · 기록 NNN · discarded" 또는 "구조 사실 · 기록 NNN · discarded" · 참고값 배지를 달지 않는다 | 인용 가능한 값까지 참고값으로 묶여 원리 설명의 근거가 약해 보인다 |
| 한계 표지 | 조건 표지에 셋을 상시 — ① ClickHouse 측정에 trace 로그 쓰기 부하 포함(clickhouseServerLogLevel) ② 동률 점은 서버 µs로 판정했고 PostgreSQL 서버 값은 계획 시간을 뺀다(serverTimeAsymmetry — client만이면 콜드 Q1 · Q2 · Q3 구간이 다르다) ③ 콜드는 컨테이너 재기동 직후 1회 근사(OS 페이지 캐시 미비움) | 콜드 구간이 확정값으로 읽힌다([07_experiment_console.md](./07_experiment_console.md) §대조군 역전 지점 구조 판정 한계와 같은 문장) |
| 색 | 저장소 색 2(ClickHouse · PostgreSQL) · I1 · I2는 같은 색의 선 모양으로 가른다 · 히트맵은 두 저장소 색의 발산 · 미정 무채색 | 변형마다 색을 주면 "저장소 셋"으로 읽힌다 |

- 검산: 계약 = **8**
- **"PostgreSQL이 앞서는 경우"를 결론 카드에 반드시 둔다.** 이 화면의 목적은 "ClickHouse가 빠르다"가 아니라 쿼리마다 역전 지점이 다르다는 것이다 — 단일 태그 1시간(Q1) 웜 I2는 10^9까지 PostgreSQL이 앞서고, 이 사실이 빠지면 화면이 한 숫자 요약이 된다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §예상 결과).

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 툴바 · 배지 자리 · 곡선 축 틀 · 히트맵 격자 · 표 머리를 먼저 그리고 응답이 오면 채운다 — 이전 판독 결과가 있으면 흐리게 유지 |
| 빈 값 | ① 원천 기록 없음(structuralRanges 기록 0) — "EXP-01~05 구조 판정 기록이 아직 없다" · 곡선 · 히트맵 자리에 같은 문구 · 판독 계수 줄은 보인다 ② 원천은 있고 단계 기록 없음 — 원천 기록의 정밀화 점만 곡선에 · 원리 증거 · 저장 비용은 "단계 기록 없음(scan · 단계 axes)" ③ 선택 쿼리 · 캐시의 structuralRanges 행 없음 — 결론 카드 "이 쿼리 · 캐시의 구조 판정 행이 없다" |
| 오류 | 기록 읽기 실패(BFF 500 · 네트워크) → 본문 머리 띠 "기록을 읽지 못했다" · 앞서 판독한 결과 유지 · 판독 불가 · 4요소 누락 · 형식 위반은 오류가 아니라 계수 줄의 수 · 인증 계열(S7)은 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 곡선(참고값 배지) · 음영(정본) · 결론 카드 · 히트맵 · 원리 증거 · 저장 비용 · 조건 표지 · 계수 줄 · 판독 시각(KST · 밀리초) · 바닥 "관찰 보조 — 기록 정본 아님" |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| BFF 기록 읽기 — 성능 보기(api 표면 아님) | 진입 · 새로고침 | BFF가 docs/measurements를 읽기 전용으로 — EXP-COMPARE와 같은 라우트의 성능 보기(웹 내부 계약 · 응답 모양은 [07_experiment_console.md](./07_experiment_console.md) §미확인 · 확정 대기 등재의 BFF 해석 결과 모양 행과 같은 성격) | perf — 원천 기록 번호 · status · 4요소 · 조건 표지 필드 · 단계 기록 번호 목록 · 정규화한 점(query · rows · exponent · store · index · cache · values · median · serverMedian · resultMatch · 기록 번호 · status) · 점 단위 우열 · structuralRanges 행(방향 보강) · scan · axes · 판독 계수 |

- 검산: 부르는 자리 = BFF 기록 읽기 **1** · api 표면 0
- **폴링하지 않는다.** 기록은 커밋으로만 바뀐다 — 진입과 새로고침 두 번이면 충분하고, 폴링은 파일 읽기를 반복할 뿐이다.
- **캐시 층** — 브라우저 쿼리 키 measurements · perf · staleTime 0(서버 층 없음 · BFF no-store) · gcTime은 시계열 행과 같은 짧은 값(현행값 정본 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) §gcTime) — 응답이 수백 KB라서다(정밀화 180점 + 단계 30점 × 5).

### 스위치 영향

- 해당 없음 — 이 화면은 현재 기동의 스위치가 아니라 기록에 박힌 switches를 툴팁 · 조건 표지로 보인다. 격자 기록은 SW-09 off · api 정지 조건(도구 컨테이너 경로)이다.

### 비고

- 곡선 차트는 ECharts(보조)다 — 점 수가 적은 분석 차트이고 로그 축 · 오차 막대 · 영역 음영이 필요하다([01_standards.md](./01_standards.md) §차트 표준).
- EXP-COMPARE 역전 지점 패널은 그대로 둔다 — 그 패널은 valid 기록의 시간 점만 그리는 계약이라 폐기 기록 곡선을 그리지 않는다. 두 화면이 같은 원천 기록을 쓰므로 구조 판정 표는 같은 값을 보인다.

## EXP-FLOW — 분산 처리 모니터링

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-FLOW |
| 웹 경로 | /experiments/flow |
| 페르소나 | 실험 수행자(주) · 시연 청중 |
| 역할 | S7 이후 인증 사용자 전원 · 표시 전용 · S2~S6 무인증 — flow 프레임은 값이 아니라 개수 · 시간 · 명령 종류 · 결과 코드만 싣는다 |
| 도입 단계 | S5 — 적재 · 알람 분기 · WebSocket 게이트웨이가 선 뒤 |
| 요청 경로 | WebSocket은 셸의 연결 하나를 그대로 쓴다(api 직결 · subscribe_flow) · 저장소 누적은 BFF 경유 메트릭 해석 · health는 셸 배지의 것을 쓴다 |

**목적**: 대용량 측정 데이터와 업무 데이터가 지금 어느 길로 갈라져 어디에 얼마만큼 쓰이고, 각 단계가 얼마나 걸리는가 — 두 데이터가 모두 Redis Stream을 지나되 **묶음(배치)으로 가는 길과 명령 하나씩 직렬로 가는 길**의 차이를 움직임으로 본다.

**진입**: 좌측 내비 실험 섹션. 진입 파라미터 없음 — 진입이 곧 subscribe_flow이고 이탈이 unsubscribe_flow다.

```plain
┌─ 머리 ─ 흐름 구독 ● 구독 중 · 마지막 배치 0.4초 전 · 배치 1.0/초 · 업무 명령 0.2/초 · "관찰 보조 — 기록 정본 아님" ─────────────┐
├─ 흐름도 ────────────────────────────────────────────────────────────────────────────────────────────┤
│ 대용량(측정 사실)                                                                                   │
│  [SIM · Collector] ═╗                            ┌─▶ CH tag_raw ──▶ MV tag_1m                         │
│  [생성기 B · C]   ══╬══▶ (Redis Stream) ══▶ [Ingest 워커] ─┼─▶ PG 대조군 COPY (SW-09 off — 회색)          │
│                    ║   stream:plc:raw  ● ●  flusher 1     ├─▶ Redis rt:latest + ch:rt ──▶ WS ──▶ 브라우저  │
│                    ║   길이 · 랙           XACK ▮          └─▶ 알람 판정 ─▶ CH alarm_eval(전수)            │
│                    ║                                                  ├▶ PG alarm_event ◆(전이만)        │
│                    ║                                                  └▶ Redis alarm:state · ch:alarm    │
│ ─────────────── 업무 명령 — 하나씩 직렬 · 커밋 결과를 기다려 응답 ──────────────────────────────── │
│ 업무(사람의 쓰기)                                                                                   │
│  [브라우저] ─▶ [BFF] ─▶ [api 검증 · XADD] ═▶ (stream:biz:cmd) ═▶ [워커 biz-writer 1]                   │
│       ▲                    ⏳ 대기(상한 5초)     길이 · 랙           │                                  │
│       │                         ▲                               ├─▶ PG 트랜잭션(변경 · 감사 · 원장)    │
│       │                         │                               ├─▶ Redis cache DEL · ch:cacheinv    │
│       └──── 응답 ◀──────────────┴──── ch:bizreply ◀── biz:result ◀┘ ↺ 재적용 · ✕ 거절 · ⚠ 불가 · ⌛ 만료 │
├─ 배치 타임라인 ─ 최근 20배치 · 단계 막대(스트림 대기 · 디코드 · CH 삽입 · PG COPY · 최신값 · 알람) · 병합 생략 표지 ─────┤
├─ 저장소 누적 ─ CH 바이트 · 압축률 · 행당 B · 파트 │ PG 크기 · 행당 B · WAL │ Redis 메모리 · 접두별 · 스트림 길이 · 랙 · 명령 랙 (5초) ┤
└─ 업무 명령 ─ 최근 20건 · 시각 · kind · 결과 · 재적용 · 대기 · 트랜잭션 · 무효화 · 결과 ms · 무효화 키 수 · 발행 주체 ───────┘
```

- **두 길을 한 그림에 위아래로 둔다(A형).** 통념은 "Redis를 거치면 비동기라 쓴 직후 조회가 옛 값을 본다"는 것이다. 부정 — 업무 명령은 api가 워커의 커밋 결과(biz:result · ch:bizreply)를 받은 뒤에만 기존 상태 코드로 응답하고, 워커는 무효화를 결과보다 먼저 한다([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). 진짜 축은 **같은 Redis Stream이라도 단위와 순서 보장이 다르다**는 것이다 — 대용량 길은 창마다 묶은 배치를 flusher 하나가 처리량 위주로 넣고, 업무 길은 명령 하나를 소비자 하나가 직렬로 트랜잭션에 넣는다. 대체 경로 — 대용량 점은 행 수만큼 크게, 업무 점은 명령 하나로 작게 그리고, 업무 줄에는 api 대기(⏳)를 응답 화살표로 되돌려 동기 응답이 눈에 보이게 한다.
- **점은 실제 배치 하나다 — 연출이 아니다.** 점 하나가 flow 프레임의 배치 요약 하나이고, 단계마다 머무는 시간의 비율이 그 배치의 실제 단계 ms 비율이다. 요약이 오지 않으면 점도 없다 — 멈춘 그림이 곧 멈춘 적재다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 흐름 구독 표지 | 머리 | 구독 중 · 구독 요청 중 · 끊김(셸 WS 3상태를 따른다) · 마지막 배치 요약의 나이 · 초당 배치 · 초당 업무 명령(최근 10초 totals 차) | RLT-05(보조 — 구독 수단) | WS /ws/realtime(subscribe_flow · flow) |
| 흐름도 | 본문 위 | 노드 · 간선 SVG · 대용량 길과 업무 길 · 비활성 간선(SW-09 off · SW-11 collector · SW-01 대안)은 회색과 스위치 이름 · 발생원 간선에 초당 포인트(메트릭) | 해당 없음 — 흐름 이벤트(기능 ID 없음 · 리드 판정 1) | WS /ws/realtime(flow) · GET /metrics(BFF) |
| 배치 점 | 흐름도 위 | 배치 요약마다 점 하나 — 순서 스트림 대기 → 디코드 → CH 삽입 → PG COPY → XACK → 최신값 → 알람 판정 · 단계별 머묾 = 단계 ms × 배율(배치 전체가 1.5초 이상 보이게 늘리고 비율은 유지) · 점 크기 ∝ log10(행 수) · CH 삽입 뒤 네 갈래로 나뉜다 · 알람 전이가 있으면 PG alarm_event에 ◆(열림 · 닫힘 수) | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 간선 굵기 | 흐름도 | 대용량 간선 = 최근 10초 초당 행(totals.rows 차 ÷ 초) · 갈래별(chRows · controlCopyRows · latestWrites · judgedRows) · 업무 간선 = 초당 업무 명령 · 굵기는 로그 · 숫자 라벨 병기 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 업무 점 | 흐름도 아래 줄 | 업무 요약마다 점 하나 — api → stream:biz:cmd(queueWaitMs) → 워커 → PG 트랜잭션(txMs) → cache DEL · ch:cacheinv(invalidateMs · 키 수 · 발행 시만) → biz:result · ch:bizreply(replyMs) → api 응답 · duplicate면 트랜잭션을 건너뛰고 ↺ · result가 도메인 오류 코드(REJECTED)면 트랜잭션 노드에서 ✕와 코드 · result가 common.postgres_unavailable(failed — PostgreSQL 불가 · 원장 행 없음)면 트랜잭션 노드에서 **⚠와 코드**(✕와 가른다 — 적용 여부를 확정하지 못한 결과다) · expired면 ⌛ · ACK는 ch:cacheinv로 가지 않는다 · SW-12 direct 요약(role api-direct)은 스트림 · 결과 노드를 건너뛴다 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 배치 타임라인 | 흐름도 아래 | 최근 20배치 가로 누적 막대(단계 6 · null 단계는 자리 없음) · 막대 끝 행 수 · 배치 번호 순 · 번호가 건너뛰면 "N배치 병합으로 생략" 틈 표지 · 툴팁 전 필드 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 저장소 누적 | 타임라인 아래 | 카드 3(ClickHouse · PostgreSQL · Redis) — §데이터 원천의 메트릭 · 5초 폴링 · 값마다 수집 나이(obs_collect_last_success_timestamp_seconds) | OBS-01(보조) · OBS-02(보조) · OBS-03(보조) | GET /metrics(BFF 해석) |
| 업무 명령 목록 | 바닥 위 | 최근 20건 · 시각(KST · 밀리초) · kind · 결과(ok · ✕ 도메인 오류 코드 · ⚠ common.postgres_unavailable · expired) · 멱등 재적용 · 단계 ms 넷 · 무효화 키 수 · ch:cacheinv 발행 여부 · 발행 주체(role — biz-writer · api-direct) | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 관찰 보조 표기 | 바닥 | "관찰 보조 — 기록 정본 아님 · 구독 중에는 워커(SW-12 direct면 api)가 요약을 발행한다(측정 중 닫는다)" | 해당 없음 — 정적 | 해당 없음 |

- 검산: 요소 = **9** · 이 화면이 호출하는 기능 = RLT-05 · OBS-01 · 02 · 03 = **4**(전부 보조 — 주 화면은 각각 DSH-REALTIME · EXP-COMPARE · EXP-CONSOLE) · 흐름 이벤트 요소 6은 기능 ID가 없다 — 새 기능 ID를 만들지 않고 **주 기능 없는 실증 화면(OBS 보조)**으로 둔다(리드 판정 1 · [02_traceability.md](./02_traceability.md))
- **알람을 대용량 길에 그리는 이유** — 알람 이벤트는 측정 사실에서 파생된 업무 데이터다. 판정 전수는 ClickHouse alarm_eval, 상태 전이만 PostgreSQL alarm_event로 간다([../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §분기 판정 트리) — ◆가 드문 것이 설계의 결과다(판정 행 수천 대 전이 몇 건).
- **알람 확인(ACK)은 업무 길에 그린다.** ②계층 행을 사람이 ③의 방식으로 쓰는 유일한 자리라서다(04_routing) — 명령 kind alarm.event.ack로 같은 명령 스트림을 탄다.

### 데이터 원천

| 화면 값 | 원천 | 이름 · 필드 | 주기 |
|------|------|------|------|
| 배치 점 · 타임라인 | flow 프레임 batches[] | seq · at · rows · stages(streamWaitMs · decodeMs · chInsertMs · controlCopyMs · latestWriteMs · alarmMs) · chRows · retries · dlqEntries · controlCopy · latestWrites · alarm(judgedRows · opened · closed) · stream(length · lag) — 필드 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 | 배치마다 · 병합 창 250 ms |
| 간선 굵기 · 초당 값 | flow 프레임 totals[] | source · role · startedAt · batches · rows · chRows · dlqEntries · controlCopyRows · judgedRows · opened · closed · latestWrites(ingest) · commands · applied · rejected · expired · failed · duplicates(biz-writer · api-direct — commands = applied + rejected + expired + failed · duplicates는 그 부분집합) | 상동 |
| 업무 점 · 목록 | flow 프레임 biz[] | source · role(biz-writer · api-direct — direct 판별은 이 필드 · source는 인스턴스 식별만) · seq · at · cmdId · kind · result · duplicate · stages(queueWaitMs · txMs · invalidateMs · replyMs) · invalidatedKeys · cacheinv | 명령마다 |
| 발생원 초당 포인트 | GET /metrics | points_emitted · gen_points_generated_total(mode) · redis_stream_entries_added_total(stream) | 5초 |
| ClickHouse 카드 | 상동 | ch_parts_bytes_on_disk · ch_parts_uncompressed_bytes(table — tag_raw · tag_1m · alarm_eval) → 압축률 · ch_parts_rows(table) → 행당 바이트 = ch_parts_bytes_on_disk ÷ ch_parts_rows · ch_active_parts(table) · ch_new_parts_total(table) · ch_inserted_rows_total · rows_inserted · alm_eval_rows_inserted_total | 상동 |
| PostgreSQL 카드 | 상동 | pg_relation_size_bytes(table · kind — plc_tag_raw_control · alarm_event · 마스터) · pg_table_live_tuples(table) → 행당 바이트 = pg_relation_size_bytes ÷ pg_table_live_tuples(통계 추정치 — 툴팁에 "ANALYZE 시점에 따라 늦다") · pg_wal_bytes_total · pg_xact_commit_total · pg_table_dead_tuples(table) · alm_active_alarms(severity) | 상동 |
| Redis 카드 | 상동 | redis_used_memory_bytes · redis_maxmemory_bytes · redis_prefix_memory_bytes(prefix) · redis_stream_length(stream — stream:plc:raw · stream:biz:cmd) · consumer_lag · backpressure_stage(publisher) · rlt_latest_updates_total(writer) · biz_stream_lag(grp:biz-writer 미확인 적체 — 그룹 lag + pending) · biz_commands_total(result — 초당 명령과 결과 구성) | 상동 |
| 수집 나이 | 상동 | obs_collect_last_success_timestamp_seconds(store) | 상동 |

- 검산: 원천 행 = **8** — flow 프레임 3 + 메트릭 5 · 메트릭 이름은 전부 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)에 있는 것만 쓴다 — 업무 명령 계열은 등재된 biz_stream_lag · biz_commands_total(result)을 Redis 카드에 싣는다 · **명령 적체 판정은 biz_stream_lag다**(stream:biz:cmd 길이는 MAXLEN까지 남은 확인된 엔트리를 포함한다) · biz_commands_total은 api 쪽과 워커 쪽이 한 명령을 두 번 셀 수 있어(카탈로그 정본) 화면의 명령 수는 flow 프레임 totals.commands다
- **행당 바이트의 분모는 테이블 전체 행 수 계열이다 — 누적 삽입 수가 아니다.** rows_inserted · ch_inserted_rows_total은 프로세스 기동 이후 누적이라 테이블 바이트(테이블 전체)와 분모가 맞지 않는다 — 카탈로그에 등재된 ch_parts_rows(활성 파트 행 합 — 머지 전 중복 포함) · pg_table_live_tuples(n_live_tup 추정치)를 분모로 쓴다. 분모가 0 · 수집 없음이면 칸은 "행 수 계측 없음".
- **redis_stream_length는 길이로만 보인다 — 적체 판정은 consumer_lag다**(카탈로그 ADR-21 조항). 흐름도 Stream 노드의 "랙" 숫자는 flow 프레임 stream.lag 또는 메트릭 consumer_lag이고 길이가 아니다.

### 표시 계약

| 계약 | 내용 | 어기면 |
|------|------|------|
| 단계 순서 | 배치 점은 ⑧ 순서 그대로 — CH 삽입 → PG COPY → XACK → 최신값 → 알람([../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) §적재 한 배치) · 업무 점은 적용 단계 순서 그대로 — 대기 → 트랜잭션 → 무효화 → 결과 → 응답([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §적용 단계) · null 단계는 건너뛴다 | 순서를 보기 좋게 바꾸면 "최신값은 확정된 값만" · "대조군은 XACK 앞" · "무효화가 결과보다 먼저"(read-your-writes)라는 계약이 그림에서 사라진다 |
| 배율 | 단계 ms에 한 배율을 곱한다 · 배치 전체가 1.5초보다 짧으면 늘리고 비율은 유지 · 배율 값을 머리에 "×N 느리게" | 단계마다 다른 배율이면 비율이 거짓이 되고, 배율 표기가 없으면 실제 지연이 초 단위로 읽힌다 |
| 병합 생략 | 배치 번호(seq)가 건너뛰면 점을 만들지 않고 타임라인에 틈 표지 · 간선 굵기와 합계는 totals에서 계산 | 병합으로 빠진 배치 때문에 합계가 실제보다 작게 보인다 |
| 재기동 | totals의 startedAt이 바뀌면 그 source의 초당 값 계산을 한 창 건너뛴다 | 누적값 감소가 음의 처리량으로 그려진다 |
| 비활성 간선 | SW-09 off · controlCopy null → PG 대조군 간선 회색 "SW-09 off" · latestWrites null → 최신값 간선 발원을 Collector로 옮기고 "SW-11 collector" · 인계 없는 배치(alarm null)는 알람 갈래를 지나지 않는다 | 꺼진 경로가 비어 있는 채 그려져 적재 실패로 읽힌다 |
| 구독 없음 · 끊김 | 셸 WS가 끊기면 점 애니메이션을 멈추고 흐름도 머리에 "끊김 — 마지막 배치 N초 전" · 재연결 뒤 subscribe_flow 재전송 · 그 사이 배치는 오지 않는다(Pub/Sub — 재전송 없음) | 끊긴 동안 멈춘 그림이 적재 정지로 읽힌다 |
| SW-12 direct | biz 요약의 role이 api-direct면(source는 인스턴스 식별만 — APP_ROLE all이면 api와 워커의 source가 같을 수 있다) 업무 점이 stream:biz:cmd · 워커 · 결과 노드를 건너뛰고 api에서 곧바로 트랜잭션으로 간다 · 업무 줄 머리에 "SW-12 direct — 옛 경로(비교 실험용)" | 옛 경로 요약이 명령 스트림 위에 그려져 Redis를 거친 것처럼 읽힌다 |
| 요약 없음 | 구독 중인데 10초 동안 flow 프레임이 없으면 "배치 요약 없음 — 적재가 멈췄거나 발행이 꺼져 있다(표지 cache:flow:subscribed를 읽지 못한 발행자는 발행하지 않는다)"와 메트릭 카드의 consumer_lag · 초당 포인트를 나란히 | 표지 키(cache:flow:subscribed) 갱신 지연(최대 표지 TTL) · 표지 읽기 실패와 적재 정지가 구분되지 않는다 |

- 검산: 계약 = **8**
- **정밀 측정 중에는 이 화면을 닫는다(B형).** 결론 — 구독자가 있으면 워커가 배치 · 명령마다 요약을 만들고 Pub/Sub에 한 번 더 발행한다. 반대 시나리오 — 화면을 띄운 채 EXP-45 계단을 재면 PUBLISH 비용이 flusher 후속 구간에 섞인다. 파생 지침 — 구독자가 없으면(구독 중 표지 cache:flow:subscribed가 없거나 읽지 못하면) 발행 자체를 하지 않고([../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 발행 조건), 실험 러너는 구독 표지가 없는 상태에서 측정 창을 연다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 흐름도 노드 · 간선 골격(굵기 기본 · 숫자 없음)과 타임라인 · 카드 · 목록 틀을 먼저 그린다 · subscribe_flow 직후의 빈 flow 프레임이 오면 "구독 중"으로 바꾼다 · 메트릭 카드는 첫 응답 전까지 자리만 |
| 빈 값 | ① 구독 중 · 배치 0 — "배치 요약이 아직 없다 — 발생원이 발행 중인지 메트릭 초당 포인트로 확인" ② 업무 명령 0 — 목록에 "이 구독 뒤 업무 명령 없음"(적재와 무관한 정상) ③ 기능 미도입 단계(S5 전) — "이 단계에서 아직 흐름 이벤트를 발행하지 않는다" |
| 오류 | WS 종료 코드는 셸이 처리하고 이 화면은 끊김 표시만([01_standards.md](./01_standards.md) §에러 코드별 사용자 표시의 WebSocket 종료 코드 행) · 4400(subscribe_flow 형식 위반)은 재구독하지 않고 끊김 · 메트릭 해석 실패는 카드 머리 "메트릭을 읽지 못했다"와 마지막 성공 시각 · 기존 점 · 타임라인은 지우지 않는다 |
| 정상 | 흐름도 점 · 굵기 · ◆ · 타임라인 20배치 · 카드 · 목록 · 모든 시각 KST 밀리초 · 배율 표기 · 병합 생략 수 · 저장소 값의 수집 나이 · 바닥 "관찰 보조 — 기록 정본 아님" |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| WS /ws/realtime — subscribe_flow · unsubscribe_flow · flow | 진입 subscribe_flow · 이탈 unsubscribe_flow · 재연결 뒤 subscribe_flow 재전송 · flow는 서버가 병합 창마다 | api 직결 — 셸의 연결 하나 | flow(windowEnd · batches · biz · dropped · totals) |
| GET /metrics | 진입 · 5초 폴링 | BFF 해석 — 흐름 보기(웹 내부 계약 · §데이터 원천의 이름만 요약해 내린다) | 계열별 순간값 · 누적 카운터(초당 값은 화면이 두 응답의 차로) |

- 검산: 부르는 자리 = WS 1 + api 표면 1 = **2** · health는 부르지 않는다(셸 배지 응답을 스위치 표시에 쓴다)
- **메트릭 5초 폴링은 EXP-CONSOLE 15초 계약과 다르다(리드 판정 2).** 흐름도 옆의 누적이 15초마다 한 번 움직이면 점의 움직임과 어긋나 보인다. 대가는 BFF 해석 비용과 api 텍스트 생성이며, 저장소 계열은 OBS 수집 주기보다 빨리 바뀌지 않는다 — 같은 값이 반복되는 것을 수집 나이로 보인다. 이 화면도 정밀 측정 중 닫는 화면이라 관측 부하 판정은 EXP-CONSOLE과 같다.
- **캐시 층** — flow 프레임은 캐시 층이 없다(Pub/Sub · 링 버퍼 20). 메트릭 쿼리 키 obs · metrics · flow · staleTime 0(서버 층 없음).

### 스위치 영향

| 스위치 | 이 화면에서 보이는 것 |
|------|------|
| SW-01 대안(InProcessQueueBuffer) | Stream 노드 회색 "Stream 경계 없음 — 실험 전용" · stream.length · lag null · streamWaitMs는 큐 대기 |
| SW-06 대안(DirectGatewayFanout) | 최신값 · 알람 간선의 Pub/Sub 표기를 "직접 호출"로 · flow 프레임 자신은 SW-06과 무관하다(ch:flow는 대상 아님) |
| SW-09 on | PG 대조군 간선이 살아나고 controlCopyMs 막대가 타임라인에 선다 — "대조군 적재가 켜졌다" 경고는 셸 배지 · EXP-CONSOLE이 맡는다 |
| SW-10 on | 발생원 초당 포인트가 줄고 배치 행 수가 준다 — 흐름도에 "데드밴드 on" 표지 |
| SW-11 collector | 최신값 간선이 Collector에서 나간다 · 배치 요약 latestWrites · latestWriteMs null |
| SW-12 direct | 업무 줄이 옛 경로(api가 트랜잭션을 직접 커밋)로 바뀐다 — stream:biz:cmd · 워커 · 결과 노드 회색 · 표시 계약 SW-12 direct 행 |

- 검산: 행 = **6** · 나머지 스위치(SW-02~05 · 07 · 08)는 조회 경로 · 병합 · 멱등이라 이 화면의 그림을 바꾸지 않는다(SW-08 대안이면 재시도 배치의 중복은 retries로만 보인다)

### 비고

- 흐름도는 SVG 직접 그리기다 — 시계열 차트가 아니라 uPlot · ECharts 대상이 아니다. 배치 타임라인만 ECharts 가로 누적 막대다.
- 링 버퍼 20은 화면 상수다 — 시연 중 한 화면에 보이는 양이고 메모리는 배치 요약 20건이다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 두 화면의 주 기능 · 흐름 이벤트 기능 ID | **닫힘(리드 판정 1)** — 새 기능 ID 없음 · 주 기능 없는 실증 화면(OBS 보조) 분류 | [02_traceability.md](./02_traceability.md) |
| 행당 바이트의 분모(테이블 전체 행 수 메트릭) | **닫힘** — 카탈로그 등재 pg_table_live_tuples{table} · ch_parts_rows{table} · 저장소 카드 행당 바이트 칸(바이트 ÷ 행 수) | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| BFF 성능 보기 · 흐름 보기 응답 모양 | 웹 내부 계약 — 이 문서의 호출 표면 표가 쓰는 필드를 고정하고 모양은 구현이 정한다(EXP-COMPARE와 같은 판정) | 이 문서 |
| 시연 시나리오 | 범위 밖 — 스크립트(scripts/demo)가 부하 · 장애를 일으키고 화면은 표시만(리드 판정 3) | 리드 · 09_tech_stack/05(등재 제안) |
| 쿼리 레이스(두 저장소에 같은 쿼리를 실시간 실행하는 화면 · API) | 미확인 · 미설계 — 이번 범위 밖(리드 판정 4) · 대조 쿼리는 앱을 거치지 않는다는 판정([07_experiment_console.md](./07_experiment_console.md) §스위치별 비교 대상 A형)과 충돌 여부부터 판정 | 리드 |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [01_standards.md](./01_standards.md) — 명세 템플릿 · 상태 4행 · 차트 표준 · 공통 셸
- [02_traceability.md](./02_traceability.md) — 기능 → 화면 매핑
- [07_experiment_console.md](./07_experiment_console.md) — EXP-COMPARE 역전 지점 · 실증 요약 패널 · BFF 기록 읽기 선례
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 역전 구간 정본 · 비교 축 · 원리 대응
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 기계 판독 블록 · 기록 상태와 참고값 예외
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 메트릭 이름
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — flow · subscribe_flow · unsubscribe_flow 계약
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 3계층 분기 · 업무 쓰기 경로 판정
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 업무 명령 경로 · 적용 단계 · 무효화 체인
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 분기 판정 트리 · 모듈 × 저장소 쓰기 행렬
