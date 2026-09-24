# 대시보드와 알림

> **대상**: observability 프로파일에서 보는 것 — 알림 경로 판정 · 대시보드 6 · 대시보드별 핵심 패널 · **축출 연쇄 패널(캐시 히트율 대 Stream 점유 메모리 역상관)** · 알림 규칙(**스트림 알림을 적체 기준으로**) · 알림 임계 조회 계약 · 관측 부하 규칙
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §14 · §16 · §19(커밋 ff66a37) · 원본 tech_stack.md §9 · §10.6(커밋 ff66a37) · 원본 implementation_plan.md §5 S6(커밋 ff66a37) · docs_plan.md 보정 #17 · 웨이브 인계 W6 10/03 행(스트림 길이 MAXLEN 80% → 적체 기준) · ADR-20 · ADR-21 · ADR-23 · REQ-OBS-03 · 07 · AC-12 · AC-32 · [01_metrics_catalog.md](./01_metrics_catalog.md) · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 관측 스택 구성원

이 문서는 **관측 스택을 켰을 때 무엇을 보고 무엇에 경보하는가**를 고정한다. OBS는 노출까지만 하고 저장 · 시각화 · 알림은 선택 기동 observability 프로파일이 한다(REQ-OBS-07). 프로파일 구성원의 정본은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(prometheus · grafana)이고 이 문서는 그 위에서 도는 대시보드와 규칙을 갖는다.

**프로파일을 켠 수치는 상대 비교용이다**(ADR-20). 대시보드는 탐색 · 디버깅 · 연쇄의 선후를 눈으로 보는 도구이고, 측정 기록의 수치는 프로파일을 끈 정밀 세션의 직접 덤프에서 나온다([04_experiment_protocol.md](./04_experiment_protocol.md)). 예외는 하나다 — 축출 연쇄 그래프(AC-32)는 "한 화면 그래프"가 산출물이라 프로파일을 켠 기록으로 남기고, 그 기록의 관측 스택 칸을 on으로 적는다.

원본 알림 "스트림 길이 MAXLEN 80% 초과"는 **정상 운전에서 항상 울린다.** XACK은 엔트리를 스트림에서 지우지 않아 XLEN이 발행 누적을 따라 MAXLEN까지 차고 거기 머물기 때문이다(ADR-21). 이 문서가 스트림 알림을 적체 기준으로 바꾼다(§스트림 알림 판정).

## 알림 경로 판정

docs_plan 보정 #17(관측 스택 구성원 불일치) 중 알림 쪽을 이 문서가 판정한다. 구성원 목록 자체는 09_tech_stack/03의 몫이다.

| 요소 | 원본 표기 | 판정 | 이유 | 버린 쪽의 실패 |
|------|------|------|------|------|
| 규칙 평가 | prometheus(암묵) | **Prometheus 규칙 파일**이 평가한다 | 스크레이프한 시계열과 같은 자리에서 평가해 평가 시점이 한 곳이다 | Grafana 알림으로 평가하면 대시보드 쿼리와 알림 쿼리가 두 벌이 되어 규칙이 대시보드 수정에 끌려간다 |
| 전달 | alertmanager(원본 architecture.md §14) | **두지 않는다** — 발동 상태는 ALERTS 시계열 · Prometheus 알림 화면 · Grafana 알림 목록 패널로 본다 | 로컬 단일 사용자라 전달 대상(메일 · 메신저)이 없다 · AC-12 알림 판정은 발동 상태로 충분하다 | 컨테이너 하나가 늘어 측정 대상의 메모리 몫이 줄고 받을 사람 없는 전달 경로를 설정한다 |
| 분산 추적 | tempo(원본 tech_stack.md §9 · Phase 4 선택) | **현 범위 밖 · 조건부** — 진입 조건은 "SQL과 구간 메트릭으로 구간 분해가 불가능하다고 실측된 경우"(판정 정본 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) | E2E는 ingested_at − ts SQL 한 줄로 잰다(OBS-04) · 구간 분해는 히스토그램이 한다 | 추적 SDK가 측정 대상 프로세스의 모든 요청에 계측 비용을 섞는다 |
| 호스트 지표 | node_exporter(원본 선택) | **두지 않는다** — docker stats · iostat 수동 기록 | exporter 컨테이너 금지(REQ-OBS-01) | 호스트 대시보드가 exporter 하나 때문에 창구 원칙을 깬다 |

- 검산: 요소 = **4**
- **B형 — 알림이 어디로도 전달되지 않는 것은 누락이 아니다.** 결론 — 로컬 학습 시스템에서 알림은 "지금 이 조건이 참이다"를 보이는 표지다. 반대 시나리오 — 전달 경로를 두면 부하 실험 중 알림 폭주가 실험 수행자의 주의를 측정에서 뺏고 전달 컨테이너가 메모리를 먹는다. 파생 지침 — 실험 기록에는 판정 창 안에 발동한 알림 이름을 적는다(ALERTS 시계열에서 옮긴다).

## 대시보드 6

원본 architecture.md §14의 6종이다. 패널의 메트릭 이름 정본은 [01_metrics_catalog.md](./01_metrics_catalog.md)다.

| 대시보드 | 답하는 질문 | 핵심 패널 | 출처 | 주로 쓰는 실험 |
|------|------|------|------|------|
| 파이프라인 전경 | 적재가 수집을 따라가는가 | 컨슈머 랙(lag · pending 분리) · 백프레셔 단계(발행자별) · 초당 포인트 · 배치 크기 · DLQ · 스풀 · E2E p50 · p95 · p99 · 6a · 6b · 6c | api /metrics | EXP-16 · 20 · 22~26 · 30 · 34 |
| ClickHouse | 삽입과 머지가 버티는가 | 초당 삽입 행 · 활성 파트 · 새 파트율 · 머지 진행 · 압축률 · 쿼리 p95 · 메모리 · 디스크 여유 | api /metrics(system.*) | EXP-25 · 26 · 34 · 35 |
| PostgreSQL | 업무 경로 · 대조군이 버티는가 | 커밋 · 연결 · 버퍼 적중 · 락 대기 · 상위 문형 10 · 데드 튜플 · WAL | api /metrics(pg_stat_*) | EXP-36 · EXP-01~05 적재 |
| Redis | 한 인스턴스 안에서 누가 메모리를 먹는가 | 접두별 점유(봉인 · 캐시 색 구분) · ops/s · 스트림 길이 · 출력 버퍼 · 축출 · **축출 연쇄 패널** | api /metrics(INFO · 표본) | EXP-17 · 18 · 39 |
| API | 조회가 수집 부하에 끌려가는가 | 표면별 p50 · p95 · p99 · 요청 수 · 5xx · 설계 거절 · 오류율 · 이벤트 루프 지연 p95 · WebSocket 연결 · 연결당 프레임 | api /metrics | EXP-07~12 · 27 · 37 |
| 호스트 | 머신이 포화됐는가 | 컨테이너별 CPU · 메모리 · 디스크 대기 · k6 CPU | **Prometheus 출처 없음** — docker stats · iostat 기록 | 전 실험의 조건 칸 |

- 검산: 대시보드 = **6**
- **스위치 상태 행을 모든 대시보드 머리에 둔다.** obs_switch_info · obs_run_info를 표 패널로 올려, 화면을 캡처한 순간의 4요소가 같은 화면에 남게 한다 — 캡처에 조건이 없으면 그 그래프는 기록에 인용할 수 없다.
- 호스트 대시보드는 대시보드라기보다 기록 절차다. 원본 도식의 "docker stats → grafana" 화살표는 exporter 없이 성립하지 않는다 — 버린 이유는 §알림 경로 판정의 호스트 지표 행이다.

## 대시보드별 판독 규칙

패널을 잘못 읽는 형태가 정해져 있다. 각 행이 막는 오독이다.

| 대시보드 · 패널 | 판독 규칙 | 오독하면 |
|------|------|------|
| 파이프라인 · 컨슈머 랙 | lag와 pending을 겹쳐 그리고 합은 선으로 — lag가 오르면 소비 병목, pending이 오르면 삽입 병목 | 합 하나로 보면 컨슈머 증설이 필요한지 배치 확대가 필요한지 가를 수 없다(ADR-09 뒤 증설은 삽입 병목에 무효) |
| 파이프라인 · 백프레셔 단계 | 발행자별 선 셋 · 계단 모양 | 발행자 하나만 다른 단계면 임계 설정 결함이다 — 판정량은 같은 양이다 |
| 파이프라인 · E2E | 게이지는 근사 · 창 5분 · 관찰용 | 게이지 값을 기록에 옮기면 근사값이 측정값이 된다 — 기록은 quantilesExact |
| ClickHouse · 활성 파트 | 새 파트율과 함께 본다 | 활성 파트만 보면 머지가 따라잡는 동안의 부담이 안 보인다 |
| Redis · 스트림 길이 | **메모리 양 · 트리밍 감시로만** — MAXLEN 근처가 정상 | 적체로 읽으면 정상 운전을 위험으로 판정한다(ADR-21) |
| Redis · keyspace 적중 | 참고용 — 판정은 cache:q 히트율 | rl · auth 조회가 섞인 적중률로 캐시 효과를 판정한다(REQ-NFR-10) |
| API · 오류율 | 설계 거절을 뺀 식(파생 지표) | 백프레셔가 잘 동작할수록 오류율이 나빠 보인다(REQ-NFR-11) |
| API · 이벤트 루프 p95 | 수집 부하 단계 패널과 같은 가로축 | 조회 p95 악화를 조회 코드 탓으로 돌린다 — 확장 1단계 진입 근거를 놓친다 |

- 검산: 규칙 = **8**

## 축출 연쇄 패널

원본 "캐시 히트율과 스트림 길이의 역상관 그래프를 한 화면에"(원본 implementation_plan.md §5 S6)를 옮긴다. **판정 — 상관 대상은 스트림 길이(XLEN)가 아니라 Stream 점유 메모리다.** 연쇄를 모는 것은 적체가 아니라 Stream 충전량이고, XLEN은 엔트리 크기를 모른다 — 태그 200 구성과 태그 500 구성의 같은 XLEN이 2.5배 다른 메모리다([../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)).

| 패널 행 | 시계열 | 축 | 연쇄에서의 자리 |
|:--:|------|------|------|
| 1 | Stream 점유 메모리 · 캐시 계열 점유 메모리(접두 합) · maxmemory 선 | 바이트 | 원인 — 충전이 캐시 몫을 밀어낸다 |
| 2 | 축출 수 증가율 · 봉인 계열 축출 수(0이어야 한다) | 키/초 | 전달 — volatile-lru가 TTL 키만 민다 |
| 3 | cache:q 히트율 | 0~1 | 결과 1 |
| 4 | 시계열 조회 p95 · ClickHouse 쿼리 수 | 초 · 건 | 결과 2 — 원천 부하 증가 |
| 5 | 백프레셔 단계 · XADD 실패(내구 래퍼 실패) | 단계 · 건 | 끝 — OOM이면 스풀 |

- 검산: 패널 행 = **5**
- **다섯 행은 같은 가로축 · 같은 수집 주기다.** 점유 메모리 표본과 히트율이 다른 주기로 찍히면 선후 판독이 주기 차이를 인과로 읽는다(REQ-OBS-04).
- **정상 구성에서 이 패널은 평평하다(B형).** 결론 — M 티어 정상 구성은 봉인 + 캐시 합이 maxmemory 안이라 축출이 없다. 반대 시나리오 — 평평한 패널을 "연쇄 재현 실패"로 기록하면 재현 조건(maxmemory 하향 · 태그 500 설비)을 빠뜨린 실험이 결함 보고가 된다. 파생 지침 — EXP-18은 스냅샷 복원 직후(Stream 빈 상태)부터 충전 곡선을 따라 이 패널을 기록한다.
- 이 패널이 확장 3단계(Redis 분리) 진입 판정의 화면이다 — 히트율과 Stream 점유 메모리의 역상관 · 히트율 절대값([../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md)).

## 알림 규칙

규칙 식의 모양이다(PromQL을 plain 펜스로 옮긴다). 임계 값의 계층과 소유는 §알림 임계 조회 계약이 갖는다.

```plain
consumer_lag_rising        deriv(consumer_lag[5m]) > 0                                    for 5m    경고
backlog_warning            max(backpressure_stage) >= 2 and max(backpressure_stage) != 4  for 1m    경고
backlog_critical           max(backpressure_stage) == 3 or max(spool_active) == 1         for 0m    위험
stream_trim_defect         increase(stream_trimmed_unacked[5m]) > 0                       for 0m    위험
dlq_occurred               increase(dlq_count[5m]) >= 1                                   for 0m    위험
clickhouse_parts_high      max(ch_active_parts{table="tag_raw"}) > 파트 임계               for 5m    경고
disk_low                   ch_disk_free_bytes / ch_disk_total_bytes < 잔여 임계            for 5m    위험
cache_hit_low              cache:q 히트율(파생 지표) < 히트율 임계                          for 10m   정보
lag_unknown                max(ing_consumer_lag_unknown) == 1                             for 1m    경고
collect_failing            increase(obs_collect_errors_total[5m]) > 0                     for 0m    정보
stream_boundary_bypassed   max(obs_switch_warning) == 1                                   for 0m    정보
control_copy_failed        increase(ing_control_copy_failures_total[5m]) > 0              for 0m    경고
rollup_suspect             increase(ing_mv_errors_total{result="error"}[5m]) > 0          for 0m    경고
alarm_eval_gap             increase(alm_eval_gap_batches_total[5m]) > 0                   for 0m    정보
```

- **규칙은 14개다** — 원본 6(랙 증가 · 스트림 · DLQ · 파트 · 디스크 · 히트율) 중 스트림 1을 적체 둘(backlog_warning · backlog_critical)로 바꾸고 신설 7(트리밍 결함 · 랙 산출 불가 · 수집 실패 · SW-01 off · 대조군 실패 · 롤업 의심 · 판정 무효 구간)을 더했다. 검산: 원본 유지 5 + 적체 대체 2 + 신설 7 = **14**
- **복구 단계(4)는 경고에서 뺀다.** 복구는 위험을 지난 이력 상태이고 재발행 중 적체가 오르면 재발행만 멈춘다(ADR-23) — 복구 중에 경고가 울리면 재발행이 만든 적체가 외부 적체로 읽힌다.
- **랙 증가는 기울기로 본다.** 원본 "5분간 지속 증가"를 절대값 임계로 바꾸지 않는다 — 정상 상태 랙 상한(REQ-NFR-05)이 미확인이라 절대값을 박을 수 없다.

| 알림 | 심각도 | 원본 대비 | 근거 · 막는 것 |
|------|------|------|------|
| consumer_lag_rising | 경고 | 유지 — 산출식만 판정식(lag + pending) | 적재가 수집을 못 따라가는 상태를 "소진 중"으로 넘긴다(REQ-NFR-05) |
| backlog_warning · backlog_critical | 경고 · 위험 | **대체** — 스트림 길이 MAXLEN 80% | §스트림 알림 판정 |
| stream_trim_defect | 위험 | 신설 | 조용한 유실의 유일 경로(MAXLEN 트리밍)를 드러낸다 |
| dlq_occurred | 위험 | 유지 | AC-12 알림 판정 |
| clickhouse_parts_high · disk_low · cache_hit_low | 경고 · 위험 · 정보 | 유지 — 임계는 2계층 | 파트 폭주 · 디스크 포화(장애 #10) · 확장 3단계 진입 신호 |
| lag_unknown · collect_failing | 경고 · 정보 | 신설 | 판정량이 비는 동안 단계가 직전값에 머무는 것을 드러낸다 · 한 계열만 빈 /metrics를 드러낸다 |
| stream_boundary_bypassed | 정보 | 신설 | SW-01 off가 정상 경로로 오인되는 것을 막는다(REQ-GLB-04) |
| control_copy_failed · rollup_suspect · alarm_eval_gap | 경고 · 경고 · 정보 | 신설 | 무효 · 의심 구간이 생겼음을 실험 수행자에게 알린다 — 구간은 로그 이벤트([02_instrumentation.md](./02_instrumentation.md) §구간 기록) |

- 검산: 표의 알림 = 1 + 2 + 1 + 1 + 3 + 2 + 1 + 3 = **14**

### 스트림 알림 판정

인계 "알림 스트림 길이 MAXLEN 80% → 적체 기준"을 닫는다.

**A형 — 통념**: 스트림이 MAXLEN에 가까우면 위험하다. 원본도 "스트림 길이 > MAXLEN × 80% → 위험"으로 적었다(원본 architecture.md §14). **부정**: XACK은 엔트리를 PEL에서 뺄 뿐 스트림에서 지우지 않는다. M 티어 부하 실험 프로파일에서 발행 누적은 약 67분(200,000 ÷ 50) 뒤 MAXLEN에 닿고 그 뒤로 XLEN은 늘 MAXLEN 근처다 — 원본 규칙은 적체 0에서도 한 시간 남짓 뒤부터 **상시 위험**을 울린다. **진짜 축**: 위험은 "적재 경로가 아직 책임지지 않은 엔트리"가 많을 때다 — 백프레셔 판정량(그룹 lag + pending)이 그것이고 단계 게이지가 그 판정의 결과다. **대체 경로**: 스트림 알림을 backpressure_stage 두 단(경고 · 위험)으로 바꾸고, XLEN은 트리밍 감시(stream_trim_defect)의 입력으로만 쓴다.

| 안 | 조건 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 원본 유지 | XLEN > MAXLEN × 80% | 정상 운전에서 상시 발동 — 알림이 소음이 되어 진짜 적체가 묻힌다 | 버림 |
| ② 적체 절대값 새 임계 | consumer_lag > MAXLEN × 80% | 백프레셔 위험 임계(MAXLEN × 90%)와 다른 두 번째 임계가 생겨 알림과 단계가 어긋난다 | 버림 |
| ③ **단계 게이지** | 경고 단계 이상 · 위험 단계 | 알림 임계가 곧 백프레셔 임계라 따로 조정할 수 없다 — 의도된 결합이다 | **채택** |

- 검산: 안 = **3**
- 채택안에서 알림 임계의 소유는 백프레셔 임계 정본([../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) §프로파일별 임계)으로 넘어간다 — 알림 규칙이 MAXLEN 비율을 두 번 적지 않는다.

## 알림 임계 조회 계약

| 임계 | 계층 | 기준 시점 | 금지된 대체 | 현행 참고 · 소유 |
|------|------|------|------|------|
| 파트 임계 | 2계층 | Prometheus 규칙 로드 | REQ-NFR-13 목표(미확인)를 알림 임계로 씀 | 활성 파트 200(원본) · 이 문서 |
| 잔여 임계 | 2계층 | 상동 | 절대 바이트 | 디스크 20%(원본) · 이 문서 · 대조 실험 디스크 예산 식이 인용 |
| 히트율 임계 · 지속 | 2계층 | 상동 | keyspace 적중률 | 50% · 10분(원본) · 이 문서 |
| 랙 증가 창 | 2계층 | 상동 | 절대값 임계 | 5분(원본) · 이 문서 |
| 적체 단계 임계 | 2계층 | Collector 기동 | 알림 쪽 별도 비율 | MAXLEN 비율 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |

- 검산: 임계 = **5**
- **알림 임계는 목표가 아니다.** 파트 200 · 히트율 50%는 "지금 살펴봐라"의 문턱이고, 목표(파트 100 · 히트율 80% — 원본 목표 · 미확인)와 다른 값이다. 목표가 실측으로 확정돼도 알림 임계를 자동으로 따라 바꾸지 않는다.

## 관측 부하 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 스크레이프 주기 ≥ 수집 주기 | Prometheus 스크레이프(현행 참고 15초 · 원본)는 저장소 통계 수집 주기보다 짧게 두지 않는다 | 같은 마지막 값을 여러 번 가져가 저장 · 조회 부하만 는다 |
| 콘솔 폴링 ≥ 스크레이프 | EXP-CONSOLE 폴링(현행 15초 · 소유 [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md))은 스크레이프보다 짧지 않다 | 콘솔이 관측 스택보다 큰 관측 부하가 된다 |
| 정밀 세션은 프로파일 off | 측정 기록 수치는 직접 덤프에서 | 관측 스택이 측정 대상과 CPU를 나눠 절대값이 흔들린다 |
| 대시보드 새로고침 | 스크레이프 주기보다 짧게 두지 않는다 | Grafana 쿼리가 Prometheus를 불필요하게 두드린다 |
| k6 결과 전송 | k6 → Prometheus 원격 쓰기(Prometheus 쪽 수신 기능은 켠다 — 설정 정본 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md))는 탐색 세션에만 | 정밀 세션에서 원격 쓰기가 k6 CPU를 먹어 생성기 포화 판정이 흔들린다 |

- 검산: 규칙 = **5**
- 관측 스택이 수치에 주는 영향의 크기는 3계층 미확인이다 — EXP-38이 같은 부하에서 프로파일 on/off를 재어 [07_measurement_limits.md](./07_measurement_limits.md)에 올린다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 관측 프로파일 on/off의 수치 영향 | 3계층 미확인 | EXP-38 |
| 대시보드 정의 파일의 형식 · 버전 관리 | 미설계 — 코드 착수 항목 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| 확장 3단계 진입의 히트율 · 상관 현행 값 | 3계층 미확인 — 원본 목표 50% 미만 · 역상관 | EXP-18 · [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) |

## 관련 문서

- [01_metrics_catalog.md](./01_metrics_catalog.md) — 패널 · 규칙의 메트릭 이름
- [02_instrumentation.md](./02_instrumentation.md) — 수집 방식 · 구간 기록
- [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) — 관측 스택 구성원
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 판정량 · 단계 임계
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — 축출 연쇄 재현 조건
- [06_experiment_catalog.md](./06_experiment_catalog.md) — EXP-18 축출 연쇄
