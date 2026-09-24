# 인수 기준 — AC-NN

> **대상**: db_study가 "동작한다" · "그 단계를 마쳤다" · "학습 목표를 산출했다"고 말할 수 있는 조건 — 흐름 검증 체크리스트 · 학습 단계 S0~S7 합격 판정 · 학습 목표 산출물(대조군 역전 지점 · 축출 연쇄 · 스위치 on/off 비교) · 롤업 부동소수 허용 오차 판정 · 캐시 정합성 판정 — **AC-NN 채번 정본**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W5 판정 반영 — §캐시 정합성 판정의 체인 단 번호를 5단 표기 → **6단 정본**(② ③ ④ · ⑤ · ⑥)으로 · API 직결 층의 "Dictionary 재적재가 응답 전에 끝난다" → **④는 응답 뒤 — 재적재 완료가 사건**(06_pipeline/07) — 판정 층 수 불변
> **개정일**: 2026-09-24 — SW-11 LATEST_VALUE_WRITER 신설 반영(D-13 · 사용자 확정) — 스위치 10 → **11**
> **원천**: 원본 data_flow.md §12.3 · §13 · §15 · §17(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §5 · §5.1 · §7.1 · §7.2 · §7.4 · §8(커밋 ff66a37) · 원본 architecture.md §8.4 · §14 · §16 · §17(커밋 ff66a37) · 원본 tech_stack.md §14(커밋 ff66a37) · 저장소 루트 docs_plan.md 웨이브 인계 W2 행(롤업 대 원시 부동소수 허용 오차) · D-05 · D-10 · D-11 · D-12 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 진입 조건과 합격 판정 · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 산출물과 성공 판정 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 부동소수와 오차 허용 비교

이 문서는 **AC-NN의 유일한 채번 자리**다. 원천은 셋이다 — ① 원본 흐름 검증 체크리스트 13행(원본 data_flow.md §17) ② 학습 단계 S0~S7의 합격 판정(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)) ③ 두 학습 목표의 산출물(정본 [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)). 같은 검증이 두 원천에 나타나면 AC를 하나만 두고 대응 검산 표가 가리킨다 — 단계 판정 "무손실"과 체크리스트 "수집 무손실"은 같은 AC다.

**합격 기준은 수치를 박지 않고 조건으로 쓴다.** 성능 수치는 실측 전이라 3계층 미확인이며, 원본 목표치는 4 vCPU급 가정이라 "원본 목표"로만 곁에 둔다. 정확 일치 · 0건 · 순서 · 존재처럼 **구조로 판정되는 조건만 합격선**이 되고, 지연 · 처리량 · 히트율은 "기록"이 합격선이며 목표 대비 판정은 [13_nonfunctional.md](./13_nonfunctional.md)의 목표가 EXP-NN으로 확정된 뒤에 한다. 근거 요구 칸은 REQ 번호가 아니라 **요구 파일**을 가리키며, AC ↔ REQ의 행 대응은 [15_traceability.md](./15_traceability.md)(W7)가 맞춘다.

**이 문서가 닫는 인계 2건** — ① 롤업 대 원시 부동소수 비교의 허용 오차(docs_plan 웨이브 인계 W2 행 · 11_glossary/05 미확인)를 §롤업 정합성 허용 오차 판정에서 판정한다 — avg는 **Float64 합산 오차 상계**로 판정하고 p95는 미확인(확정 수단 명시)으로 등재한다. ② 원본 체크리스트 "캐시 정합성 — 무효화 후 즉시 반영"을 원본 implementation_plan.md §7.4 보정(BFF · 브라우저 캐시 누락)에 맞춰 §캐시 정합성 판정에서 세 층으로 가른다.

## 판정 공통 규칙

모든 AC에 먼저 적용된다. 규칙의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)이며 이 표는 AC 판정에 걸리는 부분만 옮긴다.

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 4요소 병기 | 모든 수치에 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태를 적는다(D-10) | 같은 조건이라 믿은 두 측정의 조건이 달라 비교가 무의미하다 |
| 3회 중앙값 | 같은 실험을 3회 실행해 중앙값을 쓰고 편차가 기준을 넘으면 폐기한다 | 코어 배치가 매 실행 달라 한 번의 수치가 재현되지 않는다 |
| 스냅샷 복원 | 실험 전 스냅샷 · 실험 후 복원 | 직전 실험의 파트 · 캐시 상태가 결과에 섞인다 |
| 주입 모드 하나 | 한 실험에 주입 모드를 하나만 쓴다 | 어느 계층이 병목인지 가를 수 없다 |
| 숫자 없는 완료 불인정 | 합격 기준이 "기록"인 AC는 4요소가 붙은 수치가 남아야 통과다(원본 tech_stack.md §14) | "돌려 봤다"가 합격이 된다 |
| 무손실 대조 조건 | 생성 카운트와 저장 행 수의 대조는 SW-10 off · 오류 주입 없음 · 적재 정지 후 랙 0에서 한다 | 데드밴드 · BAD_TIMEOUT 비저장 · 적재 중 행이 차이로 잡혀 결함과 설계 동작을 가를 수 없다 |

- 검산: 공통 규칙 = **6**
- **흐름 검증 AC(AC-01~13)는 회귀 기준이다.** 도입 단계에서 처음 통과한 뒤 이후 단계를 마칠 때마다 다시 돌린다 — 원본은 "각 Phase 완료 시 실제로 실행하고 수치를 기록한다"로 적었다(원본 data_flow.md §17).

## 흐름 검증 체크리스트

원본 data_flow.md §17의 13행을 AC-01~13으로 옮긴다. 학습 단계 칸은 **처음 판정하는 단계**다.

| AC ID | 검증 대상 | 방법 | 합격 기준 | 관련 흐름 | 관련 기능 ID | 근거 요구 | 학습 단계 |
|------|------|------|------|------|------|------|------|
| **AC-01** | 수집 무손실 | 정해진 포인트 수를 생성 → 적재 정지 · 랙 0 확인 → 생성 카운트와 같은 구간 tag_raw count() 대조 | **차 0**(완전 일치). DROPOUT이 생략한 행은 생성 카운트에 넣지 않는다 | F-01 · F-02 · F-09 | GEN-09 · COL-07 · ING-03 | [06_datagen.md](./06_datagen.md) · [07_ingest.md](./07_ingest.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S2 |
| **AC-02** | 중복 없음 | tag_id + ts 조합별 행 수가 2 이상인 조합 조회 · 재시도를 유발한 구간 포함 | **0건** | F-02 | ING-04 · ING-05 | [07_ingest.md](./07_ingest.md) | S3 |
| **AC-03** | E2E 지연 | 최근 창의 ingested_at − ts 분위수 SQL | p50 · p95 · p99가 4요소와 함께 **기록**된다. 목표 대비 판정(원본 목표 M 티어 p95 1.5초 이하 — 미확인)은 S5에서 [13_nonfunctional.md](./13_nonfunctional.md) 목표로 한다 | F-01 · F-02 | OBS-04 | [12_metrics.md](./12_metrics.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S2 기록 · S5 판정 |
| **AC-04** | 시간대 정확성 | 알려진 epoch ts의 행을 적재 → API 응답 시각 · 웹 표시 시각 대조 | API 응답은 저장 시각과 같은 순간을 가리키고, 웹 표시는 Asia/Seoul 변환을 **한 번만** 적용한 값이다 — 밀리초 단위 **오차 0** | F-04 · F-03 | TSQ-01 · RLT-01 | [01_global_rules.md](./01_global_rules.md) · [08_timeseries.md](./08_timeseries.md) | S2 |
| **AC-05** | 롤업 정합성 | 적재 정지 후 원시 보존 기간 안의 버킷마다 원시 집계와 롤업 -Merge 집계 대조 | count · min · max · last **정확 일치** · avg는 §롤업 정합성 허용 오차 판정의 상계 이내 · p95는 미확인(판정에서 제외하고 기록) | F-08 | ING-12 · TSQ-01 | [07_ingest.md](./07_ingest.md) · [08_timeseries.md](./08_timeseries.md) | S3 |
| **AC-06** | 캐시 정합성 | 태그명 변경 → API 직결 · BFF 경유 · 브라우저 화면 세 층에서 첫 읽기 대조 | 세 층 모두 **무효화 사건 이후의 첫 읽기**가 새 값 — §캐시 정합성 판정 | F-05 · F-04 | MST-08 · TSQ-07 · RLT-09 | [03_master.md](./03_master.md) · [09_realtime.md](./09_realtime.md) · [08_timeseries.md](./08_timeseries.md) | S4 |
| **AC-07** | 최신값 정확성 | 수집 정지 · 랙 0 확인 뒤 설비별 rt:latest와 ClickHouse 태그별 argMax(value, ts) · max(ts) 대조 | 전 태그 ts · value · quality **일치**. 수집 중 대조는 적재 중 행 때문에 판정하지 않는다 | F-02 · F-03 | ING-08 · RLT-01 | [09_realtime.md](./09_realtime.md) · [07_ingest.md](./07_ingest.md) | S2 |
| **AC-08** | 품질 코드 전파 | 모드 A에서 시뮬레이터에 Modbus 예외 · 응답 지연(타임아웃 초과) · 범위 밖 값을 각각 주입 → tag_raw 대조 | 예외 구간 quality 2 · 범위 밖 quality 4 · **타임아웃 주기는 행 없음**(BAD_TIMEOUT 비저장 판정) · 나머지 9 | F-01 | SIM-04 · SIM-05 · COL-05 | [04_collector.md](./04_collector.md) · [05_plc_sim.md](./05_plc_sim.md) | S3 |
| **AC-09** | 알람 디바운스 | 디바운스 미만 · 이상 길이의 스파이크를 각각 주입 | 미만 — alarm_event **0행** · alarm_eval 위반 행 존재 · alarm:state NORMAL 복귀 / 이상 — alarm_event **1행** | F-06 | ALM-03 · ALM-04 · ALM-05 | [10_alarms.md](./10_alarms.md) | S7 |
| **AC-10** | WebSocket 재연결 | 연결을 강제로 끊고(서버 소켓 종료 또는 브라우저 오프라인 전환) 복구 | 재연결 간격이 지수로 늘고 상한에서 멈춘다 · 재연결 직후 REST 최신값 요청 **1건** · 화면 값 = rt:latest | F-07 · F-03 | RLT-07 | [09_realtime.md](./09_realtime.md) | S4 |
| **AC-11** | 백프레셔 — ClickHouse 5분 중단 | 부하 중 clickhouse 컨테이너 5분 정지 → 재기동 → 소진 | AC-01 식 **차 0** · AC-02 식 **0건** · 생성 구간 ts 공백 없음 · 소진 시간 **기록**(원본 목표 중단 시간의 30% 이하 — 미확인) · 중단 중 최신값 STALE 표시 | F-10 · F-02 · F-03 | ING-13 · ING-05 · RLT-03 | [07_ingest.md](./07_ingest.md) · [04_collector.md](./04_collector.md) · [09_realtime.md](./09_realtime.md) | S6 |
| **AC-12** | DLQ | 모드 B로 디코딩 불가 페이로드를 섞어 주입 | 불량 엔트리는 재시도 소진 뒤 DLQ로 이동하고 **XACK되어 PEL 잔류 0** · dlq_count 증가 · 정상 엔트리 AC-01 식 차 0. 알림 발동은 observability 프로파일 기동 시에만 판정한다 | F-02 · F-09 | ING-05 · GEN-06 · OBS-01 | [07_ingest.md](./07_ingest.md) · [12_metrics.md](./12_metrics.md) | S3 |
| **AC-13** | TTL 삭제 | 모드 D로 보존 기간을 넘긴 ts의 행을 적재 → 보존 적용 뒤 파티션 · mutation 조회 | 보존 기간 밖 일자 파티션이 system.parts에서 **사라진다** · 행 단위 DELETE mutation **0건**. 적용 시점(머지 주기)은 2계층 · 소유 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) | F-08 · F-09 | GEN-08 · ING-12 | [07_ingest.md](./07_ingest.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S3 |

- 검산: 흐름 검증 AC = AC-01~13 = **13**
- **AC-08의 "타임아웃 주기는 행 없음"은 A형이다.** 통념은 BAD_TIMEOUT(3)이 저장된다는 것이지만 W1 판정은 저장하지 않고 결측으로 둔다([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)). 진짜 축은 결측의 표현이며, 3이 저장된 행이 보이면 그것이 불합격이다.
- **AC-12의 알림은 선택 스택의 판정이다.** 관측 스택은 기본 기동이 아니므로 DLQ 이동과 계측이 합격선이고, 알림은 프로파일을 켠 실행에서만 추가로 본다.

## 롤업 정합성 허용 오차 판정

W1이 이 문서로 넘긴 값이다(11_glossary/05 · 웨이브 인계 W2 행). **판정: avg의 허용 오차는 고정 상수가 아니라 버킷마다 원시 데이터로 계산하는 Float64 합산 오차 상계다.** 상대 오차 한 값으로 고정하면 평균이 0 근처인 버킷(부호가 섞인 값)에서 상대 오차가 무한대로 커져 거짓 불일치가 나고, 절대 오차 한 값으로 고정하면 값 크기가 다른 태그 사이에서 한쪽은 너무 느슨하고 한쪽은 너무 엄격하다.

```plain
버킷 하나의 판정 (n = 원시 행 수 · S = 원시 |value| 합 · u = 2^−53)
├─ count(원시) ≠ countMerge(롤업) ─────────────────────────── 불합격 — 누락 · 중복 · MV 실패
├─ min · max · last 불일치 ─────────────────────────────────── 불합격 — 선택 연산은 정확해야 한다
└─ avg 대조
   ├─ |avg(원시) − avgMerge(롤업)| ≤ 2 · γ(n) · S / n ────────── 합격
   │    γ(n) = n · u / (1 − n · u)
   └─ 초과 ──────────────────────────────────────────────────── 불합격 — 부동소수 잡음이 아니라 결함
```

- **상계의 근거는 합산 순서와 무관한 오차 한계다.** Float64 합의 반올림 오차는 어떤 합산 순서 · 병합 트리에서도 γ(n − 1) · S를 넘지 않고, 나눗셈 한 번의 오차를 더해도 γ(n) · S / n 안에 든다. 원시와 롤업이 각각 이 한계 안에 있으므로 둘의 차는 그 두 배를 넘지 않는다 — 파트 머지 순서가 매번 달라도 성립한다.
- **이 값은 1계층 구조값이다.** Float64 형식(u = 2^−53)과 버킷의 행 수 · 값 크기로만 정해지고 실측으로 바꾸지 않는다. 계산에 쓰는 n · S는 원시에서 같은 버킷의 count()와 sum(abs(value))로 얻는다.
- **대조는 같은 행 집합에서만 한다.** MV 입력과 같도록 원시 쪽에 품질 필터를 걸지 않고, 원시 보존 기간 안의 버킷만 대조하며, 적재를 멈춘 뒤 늦게 도착한 행이 없을 때 한다 — 늦은 행은 롤업에 병합되어 최종적으로 정확해지지만 병합 전 대조는 count부터 어긋난다.
- **1h · 1d 해상도도 같은 식이다.** 체이닝 롤업의 avg는 같은 원시 값들의 다른 합산 트리일 뿐이라 n · S를 그 버킷의 원시 전체로 잡으면 상계가 그대로 성립한다.
- **p95는 이 식으로 판정하지 않는다.** TDigest 근사 오차가 부동소수 오차보다 훨씬 크다 — 확정 수단은 §미확인 등재의 p95 행이다.

## 캐시 정합성 판정

원본 체크리스트의 "무효화 후 즉시 반영"은 원본 설계 그대로면 **반드시 실패한다** — BFF 서버 fetch 캐시와 브라우저 쿼리 캐시가 무효화 체인에 없어 최대 revalidate 주기와 staleTime만큼 늦는다(원본 implementation_plan.md §7.4). 보정된 체인(무효화 체인 6단 — 번호 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md))을 전제로 "즉시"를 **시간이 아니라 사건 순서**로 정의한다.

| 층 | 무효화 사건 | 합격 기준 — 사건 이후의 첫 읽기가 새 값 | 체인 단 | 근거 요구 |
|------|------|------|------|------|
| API 직결(Redis · Dictionary) | Redis — 쓰기 응답 수신(커밋 · ② 삭제 · ③ 발행이 응답 전에 끝난다) · Dictionary — ④ 재적재 완료(**응답 뒤에 돈다** — 완료 시점은 재적재 계수 · 로그로 확인) | GET 목록 · 태그 단건(Redis 층) · cache:q 히트를 제외한 시계열 조회의 태그명(Dictionary 층) | ② ③ ④ | [03_master.md](./03_master.md) · [08_timeseries.md](./08_timeseries.md) |
| BFF 경유 | BFF가 쓰기 응답을 중계하며 태그 무효화를 건다 | BFF 경유 목록 조회 | ⑤ | [03_master.md](./03_master.md) |
| 브라우저(쓴 탭 · 다른 탭) | 쓴 탭 — 쓰기 응답 수신 · 다른 탭 — WebSocket 무효화 신호 수신 | 해당 탭의 다음 조회 · 렌더링(신호 키 → 쿼리 키 대응 [../08_screen/01_standards.md](../08_screen/01_standards.md) §무효화 신호 수신) | ⑥ | [09_realtime.md](./09_realtime.md) |

- 검산: 판정 층 = **3**
- **시간 기준을 합격선에 두지 않는다.** 신호 전달 지연은 성능 수치라 미확인이고 기록만 한다. 합격선은 "사건 뒤의 첫 읽기가 옛 값이면 불합격"이다 — 옛 값이 한 번이라도 보이면 체인 어딘가가 빠진 것이다.
- **Dictionary 층의 사건이 쓰기 응답이 아닌 이유** — ④는 CRUD 지연 예산을 지키려 응답 뒤로 옮겼다(06_pipeline/07 판정). 응답 직후 첫 시계열 조회는 수백 ms 동안 옛 이름을 낼 수 있고 이것은 불합격이 아니다 — 재적재 완료 뒤의 첫 조회가 옛 이름이면 불합격이다.
- **⑤ · ⑥을 구현하지 않은 상태의 실패는 결함이다.** 원본대로 만들면 이 AC가 실패한다는 것 자체가 보정 7.4의 근거이며, 실패를 TTL 대기로 통과시키지 않는다.

## 단계별 합격 판정

[../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)의 단계별 합격 판정 중 흐름 검증 AC와 겹치지 않는 항목이다. 겹치는 항목의 대응은 §단계 판정 → AC 대응 검산이 적는다.

| AC ID | 검증 대상 | 방법 | 합격 기준 | 관련 흐름 | 관련 기능 ID | 근거 요구 | 학습 단계 |
|------|------|------|------|------|------|------|------|
| **AC-14** | 저장소 기동 | 저장소 컨테이너 3개 기동 후 상태 조회 | 3개 모두 **healthy** | 해당 없음 | 해당 없음 — 기반 | [13_nonfunctional.md](./13_nonfunctional.md) | S0 |
| **AC-15** | 메모리 상한 적용 | 컨테이너 통계와 Compose 리소스 한도 대조 | 컨테이너별 메모리 한도가 프로파일 상한과 **일치** | 해당 없음 | 해당 없음 — 기반 | [13_nonfunctional.md](./13_nonfunctional.md) | S0 |
| **AC-16** | 생성기 단독 처리량 | 생성기 단독 실행 경로로 워커 수별 처리량 측정 | 워커 수별 수치 **기록** · 처리량 ≥ M 티어 초당 포인트의 **3배**. 미달이면 원본 tech_stack.md §3.4 전환 조건 발동 | F-09 | GEN-09 · GEN-01 | [06_datagen.md](./06_datagen.md) | S1 |
| **AC-17** | 수직 슬라이스 육안 확인 | 설비 1 · 태그 8 · SINE · 모드 A로 기동 → 웹 1페이지 | 차트에 새 점이 연속으로 그려지고 최신값 표가 갱신된다 | F-01 · F-02 · F-03 · F-04 · F-07 | TSQ-01 · RLT-01 · RLT-05 | [08_timeseries.md](./08_timeseries.md) · [09_realtime.md](./09_realtime.md) | S2 |
| **AC-18** | SW-02 첫 비교 | 같은 부하로 SW-02 on · off 각각 최신값 API p95 측정 | 두 수치가 4요소와 함께 **기록**(판정 아님 · 원본 예상치 off 30~150 ms · on 0.3~1 ms — 미확인) | F-03 | RLT-01 · RLT-02 | [09_realtime.md](./09_realtime.md) | S2 |
| **AC-19** | 컨슈머 랙 | S 티어 부하 지속 중 컨슈머 랙 추이 | 랙이 **0으로 유지**된다 — 지표 정의(산출식 · 샘플 주기)는 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | F-02 | ING-01 · ING-07 · OBS-01 | [07_ingest.md](./07_ingest.md) · [12_metrics.md](./12_metrics.md) | S3 |
| **AC-20** | SW-08 재시도 중복 | 삽입 성공 뒤 XACK 전에 실패를 강제해 재시도를 유발 · SW-08 off/on | off — 중복 행 **1건 이상** · on — **0건** | F-02 | ING-04 · ING-05 | [07_ingest.md](./07_ingest.md) | S3 |
| **AC-21** | SW-09 동시 적재 | SW-09 on으로 적재 → 같은 구간 두 저장소 행 수 대조 | count(tag_raw) = count(plc_tag_raw_control) — **차 0** | F-02 · F-09 | ING-11 · GEN-10 | [07_ingest.md](./07_ingest.md) · [06_datagen.md](./06_datagen.md) | S3 |
| **AC-22** | 배치 트리거 세 안 | 읽기 · 삽입 분리 · 컨슈머 1 + 배치 확대 · 서버 측 비동기 삽입을 같은 부하로 비교 | 세 안의 파트 생성률 · E2E 지연이 **기록**된다(원본 산술 — 독립 플러시 시 파트 생성률 3배 · 미확인) | F-02 | ING-02 · ING-07 | [07_ingest.md](./07_ingest.md) | S3 |
| **AC-23** | 반복 조회 히트율 | 반복 조회 시나리오 · SW-03 · SW-04 on | 히트율이 [13_nonfunctional.md](./13_nonfunctional.md) 목표 이상(원본 목표 80% — 미확인). 목표 확정 전에는 **기록**이 합격선 | F-04 | TSQ-03 · TSQ-04 | [08_timeseries.md](./08_timeseries.md) | S4 |
| **AC-24** | SW-04 키 파편화 | AC-23과 같은 시나리오 · SW-04 off | 히트율이 **0에 수렴**하는 추이가 기록된다 | F-04 | TSQ-03 | [08_timeseries.md](./08_timeseries.md) | S4 |
| **AC-25** | SW-05 스탬피드 | 캐시를 비운 뒤 같은 조회 동시 N건 · SW-05 off/on | 두 조건의 ClickHouse 동일 쿼리 실행 횟수 **기록** · on의 횟수 < off의 횟수(원본 예상치 100 → 1 — 미확인) | F-04 | TSQ-05 | [08_timeseries.md](./08_timeseries.md) | S4 |
| **AC-26** | 부하 시나리오 | Baseline · Ramp-up · Spike · Soak · Breakpoint 실행 | 5종 **전부** 3회 실행 · 4요소 기록 | F-09 · F-02 | GEN-04 · GEN-07 | [06_datagen.md](./06_datagen.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S5 |
| **AC-27** | 시스템 변곡점 | Ramp-up · Breakpoint 결과에서 성능이 꺾이는 초당 포인트 판독 | 변곡점이 **수치로** 기록된다 — 값은 산출물이며 미확인 | F-09 · F-02 | GEN-04 · OBS-01 | [13_nonfunctional.md](./13_nonfunctional.md) | S5 |
| **AC-28** | 성능 목표표 실측 | 목표표 각 행의 측정 방법대로 측정 | 목표표 **모든 행**에 실측값이 기입된다 | 해당 없음 — 횡단 | OBS-01 · OBS-02 | [13_nonfunctional.md](./13_nonfunctional.md) | S5 |
| **AC-29** | 대조군 역전 지점 | SW-09 on 적재 · 용량 단계별로 대조 쿼리 5종을 두 저장소에서 실행 | 쿼리별 **역전 지점 또는 "관측 범위 안에서 역전 없음"**이 4요소와 기록 · 두 저장소의 결과 집합이 같다(count 정확 · avg는 §롤업 정합성 허용 오차 판정의 식) · 해석 문단이 저장 구조로 원인을 설명한다 | F-02 · F-09 | ING-11 · GEN-10 | [07_ingest.md](./07_ingest.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S5 |
| **AC-30** | 백프레셔 단계 전이 | ClickHouse 삽입 지연을 유발해 Stream 길이를 올린다 | 정상 → 주의 → 경고 → 위험 전이와 스풀 전환 재현 · 위험 단계에서 모드 C 거절 · stream_trimmed_unacked **0** | F-10 · F-01 | COL-08 · COL-09 · ING-13 · GEN-07 | [04_collector.md](./04_collector.md) · [07_ingest.md](./07_ingest.md) · [06_datagen.md](./06_datagen.md) | S6 |
| **AC-31** | Redis 중단 | 부하 중 redis 컨테이너 3분 정지 → 재기동 | Collector 스풀 전환 · 시계열 조회 200(degrade) · 최신값 503 · WebSocket 푸시 중단 · 복구 뒤 스풀 재발행과 AC-01 식 **차 0** | F-10 · F-03 · F-04 · F-07 | COL-09 · TSQ-04 · RLT-04 | [04_collector.md](./04_collector.md) · [08_timeseries.md](./08_timeseries.md) · [09_realtime.md](./09_realtime.md) | S6 |
| **AC-32** | 축출 연쇄 | maxmemory를 정상 구성보다 낮춰 Stream 적체를 유발(조건 2계층 · 소유 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)) | 스트림 길이 · stream 접두 메모리 · cache 접두 메모리 · evicted_keys · 캐시 히트율 · 조회 지연을 **한 화면 그래프로 기록** · 적체 → 캐시 축출 → 히트율 하락 → 조회 지연 상승의 선후가 시계열에 나타난다 · **봉인 계열 키 축출 0** · 히트율 하락을 캐시 결함으로 기록하지 않는다 | F-10 · F-04 | OBS-03 · TSQ-04 · COL-09 | [12_metrics.md](./12_metrics.md) · [08_timeseries.md](./08_timeseries.md) | S6 |
| **AC-33** | 원칙의 증명 — SW-01 off | SW-01 off · 모드 A · ClickHouse 중단 | 폴링 주기 붕괴와 유실 수가 **기록**된다 · 같은 조건 SW-01 on은 AC-11 합격 | F-01 · F-10 | COL-07 · ING-01 | [04_collector.md](./04_collector.md) · [07_ingest.md](./07_ingest.md) | S6 |
| **AC-34** | 최신값 갱신 주체 | 갱신 주체 두 안(Ingest · Collector)으로 ClickHouse 중단 재현 | 두 안의 중단 중 rt:latest 갱신 여부 · STALE 비율 **기록** → 결정 기록 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) | F-03 · F-10 | ING-08 · RLT-03 | [09_realtime.md](./09_realtime.md) | S6 |
| **AC-35** | 알람 ②계층 분기 대조 | 같은 구간의 alarm_eval 판정 수 · alarm_event 확정 수 · alarm:state 키 수 대조 | 셋이 **각자의 목적대로 존재**한다 — 판정 수 ≥ 확정 수 · 상태 키는 판정된 규칙당 1. **건수 일치를 기대하지 않는다** | F-06 | ALM-03 · ALM-04 · ALM-05 · ING-10 | [10_alarms.md](./10_alarms.md) | S7 |
| **AC-36** | 알람 부분 실패 | postgres 정지 중 위반 지속 · alarm_eval 삽입 강제 실패를 각각 재현 | PostgreSQL 정지 — 이벤트 미확정 · 발행 0 · 복구 뒤 확정 1 / alarm_eval 실패 — 알람 발생 · 해제 · 발행 **정상** | F-06 · F-10 | ALM-04 · ALM-05 · ALM-06 | [10_alarms.md](./10_alarms.md) | S7 |
| **AC-37** | ③ 비경유 확인 | 업무 CRUD 부하 on · off에서 stream:plc:raw 유입량 비교 · 쓰기 직후 재조회 | 유입량 차이가 CRUD와 **무관** · 쓰기 응답 직후 재조회가 새 값 | F-05 | WRK-01 · WRK-03 · WRK-04 | [11_work_orders.md](./11_work_orders.md) | S7 |
| **AC-38** | 역할 기반 인가 | 권한 매트릭스의 역할 판정 행마다 세 역할 토큰으로 호출 | 허용 · 거부가 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)와 **전부 일치** · 거부는 403 | F-04 · F-05 · F-06 | AUT-04 · AUT-05 | [02_auth.md](./02_auth.md) | S7 |

- 검산: 단계별 합격 AC = AC-14~38 = **25**
- **AC-35는 B형이다.** 결론 — 세 저장소의 건수가 다른 것이 합격이다. 반대 시나리오 — 건수 일치를 기준으로 두면 dual-write를 검증하는 AC가 되어 "목적이 다른 세 쓰기"가 CDC로 맞출 대상으로 오해된다. 파생 지침 — 대조표는 수가 아니라 존재 이유를 대조한다.

## 학습 목표 산출

단계 판정에 없던 학습 목표 산출물이다. 스위치 on/off 비교 중 단계 판정이 이미 가진 것(SW-01 AC-33 · SW-02 AC-18 · SW-04 AC-24 · SW-05 AC-25 · SW-08 AC-20 · SW-09 AC-21 · AC-29)은 다시 채번하지 않는다.

| AC ID | 검증 대상 | 방법 | 합격 기준 | 관련 흐름 | 관련 기능 ID | 근거 요구 | 학습 단계 |
|------|------|------|------|------|------|------|------|
| **AC-39** | SW-03 on/off | 같은 반복 조회 부하로 SW-03 on · off | 조회 p95 · ClickHouse 쿼리 실행 수가 on/off 쌍으로 **기록**(원본 예상치 히트 시 250 ms → 15 ms — 미확인) | F-04 | TSQ-04 | [08_timeseries.md](./08_timeseries.md) | S4 |
| **AC-40** | SW-06 on/off | 같은 발행 부하로 SW-06 on · off · api 인스턴스 1 | 발행 → 수신 지연이 on/off 쌍으로 **기록** · 두 조건의 수신 프레임 내용 **동일** | F-06 · F-07 | RLT-05 · RLT-08 · ALM-06 · ING-08 | [09_realtime.md](./09_realtime.md) · [10_alarms.md](./10_alarms.md) | S4 |
| **AC-41** | SW-07 on/off | 같은 갱신 부하로 SW-07 기본값 · 0 | 연결당 초당 프레임 · nodejs_eventloop_lag가 쌍으로 **기록**(원본 예상치 초당 5,000 → 10 프레임 — 미확인) | F-07 | RLT-06 | [09_realtime.md](./09_realtime.md) | S4 |
| **AC-42** | SW-10 off/on | 신호 프로파일별로 SW-10 off · on | 전송량 · tag_raw 행 수 · 압축률이 프로파일별 쌍으로 **기록**(원본 예상치 전송률 3~100% — 미확인) | F-01 | COL-06 · GEN-01 | [04_collector.md](./04_collector.md) | S3 |
| **AC-43** | 역할별 on/off 차이 완결 | 스위치 전수(정본 02_features/13)의 on/off 기록을 모은다 | 전수 **전부** off · on 쌍이 4요소 · 3회 중앙값과 함께 존재 · 한쪽만 잰 스위치 0 | 해당 없음 — 횡단 | OBS-06 | [12_metrics.md](./12_metrics.md) · [01_global_rules.md](./01_global_rules.md) | S6 |
| **AC-44** | 목표 ① 비교 축별 수치표 | AC-29와 같은 용량 단계에서 비교 축을 잰다 | 비교 축 **6축 전부**가 같은 용량 단계에서 양 저장소 값을 갖는다 — 쿼리 시간만 있고 저장 비용 축이 빈 표는 불합격 | F-02 · F-09 | ING-11 · GEN-10 | [07_ingest.md](./07_ingest.md) · [13_nonfunctional.md](./13_nonfunctional.md) | S5 |
| **AC-45** | 신호 프로파일별 압축 대조 | RANDOM_WALK와 혼합 프로파일을 각각 적재해 압축률 측정 | 두 조건의 압축률이 **기록**되고 용량 판단에는 보수적인 쪽을 쓴다 | F-09 · F-08 | GEN-01 · GEN-08 | [06_datagen.md](./06_datagen.md) | S5 |

- 검산: 학습 목표 산출 AC = AC-39~45 = **7** · 문서 전체 AC = 13 + 25 + 7 = **45**(AC-01~45 · 결번 없음)
- **스위치 on/off 비교 AC** = SW-01 AC-33 · SW-02 AC-18 · SW-03 AC-39 · SW-04 AC-24 · SW-05 AC-25 · SW-06 AC-40 · SW-07 AC-41 · SW-08 AC-20 · SW-09 AC-21 · AC-29 · SW-10 AC-42 · SW-11 AC-34 — 스위치 11 중 비교 AC 있음 11 · 누락 0 = **11**(SW-09는 적재 AC-21과 측정 AC-29 둘 · SW-11은 두 구현값 비교)

## 원본 체크리스트 → AC 대응 검산

원본 data_flow.md §17의 13행 전부가 AC 하나에 대응한다.

| # | 원본 항목 | 원본 합격 기준 | AC | 이 문서의 변경 |
|------|------|------|------|------|
| 1 | 수집 무손실 | 완전 일치 | AC-01 | 대조 조건(SW-10 off · 오류 주입 없음 · 랙 0)을 명시 |
| 2 | 중복 없음 | 0건 | AC-02 | 재시도 유발 구간 포함 |
| 3 | E2E 지연 | p95 ≤ 1.5초 | AC-03 | **수치 → 기록**(원본 목표는 미확인 · S5 판정) |
| 4 | 시간대 정확성 | 오차 없음 | AC-04 | 변환 1회 조건 명시 |
| 5 | 롤업 정합성 | 부동소수 오차 범위 내 | AC-05 | **허용 오차를 상계식으로 판정** · p95 제외 |
| 6 | 캐시 정합성 | 무효화 후 즉시 반영 | AC-06 | **보정 7.4 반영 — 세 층 · 사건 순서 기준** |
| 7 | 최신값 정확성 | 일치 | AC-07 | 수집 정지 후 대조 조건 명시 |
| 8 | 품질 코드 전파 | 해당 품질 코드로 저장됨 | AC-08 | **BAD_TIMEOUT은 비저장**(W1 판정) |
| 9 | 알람 디바운스 | 디바운스 미만이면 알람 미발생 | AC-09 | 이상 길이 대조 추가 |
| 10 | WebSocket 재연결 | 재연결 + 최신값 동기화 완료 | AC-10 | 백오프 상한 추가 |
| 11 | 백프레셔 | 무손실 복구 · 소진 시간 측정 | AC-11 | 무중복 · 공백 없음 · STALE 표시 추가 |
| 12 | DLQ | DLQ 이동 + 알림 발동 | AC-12 | **알림은 선택 스택 기동 시에만 판정** · PEL 잔류 0 추가 |
| 13 | TTL 삭제 | 파티션 자동 DROP 확인 | AC-13 | mutation 0건 추가 |

- 검산: 원본 13행 중 AC 대응 있음 13 · 누락 0 = **13**

## 단계 판정 → AC 대응 검산

[../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 진입 조건과 합격 판정 표의 번호 항목 전부가 AC에 대응한다.

| 단계 | 판정 항목 | AC |
|------|------|------|
| S0 | 저장소 3개 healthy · 메모리 상한 적용 | AC-14 · AC-15 |
| S1 | 생성기 단독 처리량 ≥ M 티어 3배 · 워커 수별 기록 | AC-16 |
| S2 | ① 육안 ② 무손실 ③ E2E 기록 ④ SW-02 on/off p95 | ① AC-17 ② AC-01 ③ AC-03 ④ AC-18 |
| S3 | ① S 티어 무손실 ② 랙 0 ③ SW-08 off/on ④ 원시 대 1분 롤업 avg ⑤ SW-09 행 수 ⑥ 배치 트리거 세 안 | ① AC-01 ② AC-19 ③ AC-20 ④ AC-05 ⑤ AC-21 ⑥ AC-22 |
| S4 | ① 히트율 ② SW-04 off 0 수렴 ③ SW-05 쿼리 횟수 | ① AC-23 ② AC-24 ③ AC-25 |
| S5 | ① 시나리오 5종 ② 변곡점 ③ 목표표 실측 ④ 대조 쿼리 역전 지점 | ① AC-26 ② AC-27 ③ AC-28 ④ AC-29 |
| S6 | ① 백프레셔 전이 ② ClickHouse 중단 복구 ③ Redis 중단 ④ 축출 연쇄 ⑤ SW-01 off ⑥ DLQ ⑦ 갱신 주체 비교 | ① AC-30 ② AC-11 ③ AC-31 ④ AC-32 ⑤ AC-33 ⑥ AC-12 ⑦ AC-34 |
| S7 | ① 알람 ②계층 대조 ② 부분 실패 ③ ③ 비경유 ④ 역할 기반 인가 | ① AC-35 ② AC-36 ③ AC-37 ④ AC-38 |

- 검산: 판정 항목 = S0 1 + S1 1 + S2 4 + S3 6 + S4 3 + S5 4 + S6 7 + S7 4 = **30** · AC 대응 있음 30 · 누락 0
- S0의 한 항목은 두 조건이라 AC 둘로 가른다. 흐름 검증 AC를 재사용한 항목은 S2 ② · ③ · S3 ① · ④ · S6 ② · ⑥ = **6**이다.

## 학습 목표 산출물 → AC 대응 검산

[../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)의 두 목표 산출물 전부가 AC에 대응한다.

| 목표 | 산출물 | AC |
|------|------|------|
| ① | 쿼리별 역전 지점표 | AC-29 |
| ① | 해석 문단 | AC-29 |
| ① | 비교 축별 수치표 | AC-44 |
| ① | 신호 프로파일별 압축 대조 | AC-45 |
| ② | 분기 대조표 | AC-35 |
| ② | ③ 비경유 확인 | AC-37 |
| ② | 축출 연쇄 그래프 | AC-32 |
| ② | 역할별 on/off 차이 | AC-43(스위치별 AC는 §학습 목표 산출 검산) |
| ② | 원칙의 증명 | AC-33 |

- 검산: 산출물 = 목표 ① 4(역전 지점표 · 해석 문단 · 수치표 · 압축 대조) + 목표 ② 5(분기 대조표 · ③ 비경유 · 축출 연쇄 · on/off 차이 · 원칙의 증명) = **9** · AC 대응 있음 9 · 누락 0

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 수단 · 자리 |
|------|------|------|------|
| p95 원시 대 롤업의 근사 허용 범위 | TDigest는 근사다 — 부동소수 허용 오차로 비교하지 않는다(W1) | 미확인 — 확정 전 임의 값 고정 금지 | S3에서 롤업 p95 값의 원시 내 순위(값 이하 행 수 ÷ n)와 0.95의 차를 버킷별로 3회 측정해 분포를 기록 → [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) 실험 결과로 이 문서에 순위 오차 기준을 올린다 |
| 성능 목표 전부(E2E p95 · 조회 p95 · 히트율 · 소진 시간 · 처리량) | 원본 목표(4 vCPU 가정) | 미확인 — 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) · EXP-NN |
| 쿼리별 역전 지점 · 시스템 변곡점 | 없다 — 산출물이다 | 미확인 — 확정 전 임의 값 고정 금지 | AC-27 · AC-29 실측 |
| 축출 연쇄가 관찰되는 메모리 조건 | 원본 실험 조건 maxmemory 하향 | 2계층 조정값 · 관찰 결과는 미확인 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| 시뮬레이터 지연 · 오류 주입 제어 수단 | 주입 기능은 있고 제어 표면은 없다 | 미설계(W2a 등재) | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4) · [../07_api](../07_api/README.md)(W5) |
| 컨슈머 랙 지표 정의 | "Stream 길이 − 처리 완료 오프셋"(원본 tech_stack.md §9) · "XLEN − PEL 처리량"(원본 architecture.md §16) | 신규 불일치 — 두 산출식이 다르다 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |
| 보존 적용 시점 | TTL DELETE(파티션 DROP) | 2계층 | [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)(W3) |

## 관련 문서

- [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) — 학습 단계 · 진입 조건과 합격 판정
- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 산출물과 성공 판정
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 4요소 · 3회 중앙값 · 스냅샷
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — AC를 수행하는 실험 EXP-NN
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 부동소수 비교 규칙
- [13_nonfunctional.md](./13_nonfunctional.md) — 성능 목표표
- [15_traceability.md](./15_traceability.md) — AC ↔ REQ ↔ 기능 추적성
