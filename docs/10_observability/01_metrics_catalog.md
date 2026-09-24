# 메트릭 카탈로그

> **대상**: /metrics로 노출하는 메트릭 전수 — 이름 규약 · 닫힌 레이블 집합 · **스위치 상태 레이블 이름** · **컨슈머 랙 산출식 판정(가장 중요한 단일 지표)** · 계열별 전수(앱 기본 · HTTP·WS · 수집 · 적재 · 알람 · 실시간 · 조회 · 업무 · 인증 · Redis · PostgreSQL · ClickHouse · E2E · 관측 자체) · 파생 지표 식 · 선행 문서 인계 메트릭 대응 · 수집 주기 · E2E 창 · 메모리 표본 수 조회 계약 · Pub/Sub 출력 버퍼 관련 메트릭
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — aut_ratelimit_rejected_total class 값 **4 확정**(general · bulk_read · export · bulk_ingest) · 로그인 실패 계수는 신설하지 않고 http_requests_total로 대체 — 메트릭 수 불변(정본 12_security/03)
> **원천**: 원본 architecture.md §14 · §16(커밋 ff66a37) · 원본 tech_stack.md §9(커밋 ff66a37) · 원본 data_flow.md §15 · §16(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2(커밋 ff66a37) · docs_plan.md 웨이브 인계 W6 10/01 행 · D-10 · ADR-20 · ADR-21 · ADR-22 · REQ-OBS-01~12 · [../02_features/11_metrics.md](../02_features/11_metrics.md) OBS-01~06 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) §판정량 · [../07_api/10_metrics.md](../07_api/10_metrics.md) #2

이 문서는 **메트릭 이름의 정본**이다. 선행 문서들이 "이름은 W6"으로 넘긴 계수 · 히스토그램 · 게이지 전부를 여기서 명명하고, 어느 요구가 그 지표를 요구했는지를 원천 열에 남긴다. 계측 지점과 수집 방식은 [02_instrumentation.md](./02_instrumentation.md), 대시보드와 알림은 [03_dashboards_alerts.md](./03_dashboards_alerts.md), 실험의 판정 지표 선택은 [06_experiment_catalog.md](./06_experiment_catalog.md)가 갖는다.

**이름은 계약이다.** 메트릭 이름은 알림 규칙 · 대시보드 · EXP-CONSOLE의 BFF 해석 · 측정 기록의 지표 칸이 같은 문자열로 부른다. 그래서 이름은 바꾸지 않고, 뜻이 바뀌면 새 이름을 만든다(§이름 변경 규칙). 수치는 이 문서에 하나도 없다 — 목표 · 원본 예상치는 [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md)와 실험 카탈로그가 갖고 전부 3계층 미확인이다.

**가장 중요한 단일 지표는 컨슈머 랙(consumer_lag)이다**(원본 tech_stack.md §9). 원본의 두 산출식이 서로 다르고 둘 다 ADR-21 뒤에는 정상 운전에서 틀린 값을 낸다 — §컨슈머 랙 판정이 이것을 닫는다.

## 이름 규약

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 표기 | snake_case · 프로젝트 접두 없음 — 창구가 /metrics 하나라 충돌할 이름공간이 없다(ADR-20) | 접두를 붙이면 원본 · 선행 문서의 이름과 grep이 끊긴다 |
| 원본 이름 보존 | 원본이 이름을 준 13종(points_emitted · poll_duration · consumer_lag · rows_inserted · insert_duration · batch_size · dlq_count · spool_active · spool_bytes · spool_drain_rate · deadband_boost_active · stream_trimmed_unacked · e2e_latency)은 **그대로 쓴다** — 접두 · 단위 접미 규칙의 예외 | 원본 · REQ-COL-15 · REQ-ING-18 · 측정 기록이 옛 이름으로 남아 두 이름이 한 지표를 가리킨다 |
| 계열 접두 | 새 이름은 도메인 소문자(col · sim · gen · ing · alm · rlt · tsq · mst · aut · obs) · 저장소(redis · pg · ch) · 표면(http · ws) 접두 · 워커 풀(worker_pool — ADR-25) · 앱 기본은 prom-client 기본 이름 | 어느 모듈이 내는 지표인지 이름에서 읽을 수 없다 |
| 단위 접미 | 시간 _seconds · 크기 _bytes · 누적 계수 _total · 비율은 접미 없이 0~1 | 밀리초와 초가 섞여 대시보드 축이 1,000배 어긋난다 |
| 종류 | counter(누적) · gauge(순간) · histogram(분포) 셋 — summary를 쓰지 않는다 | summary는 인스턴스 간 합산이 안 되어 역할 분리(ADR-22) 뒤 분위수를 합칠 수 없다 |
| 분위수 | 히스토그램 버킷에서 계산한다 · 버킷 경계는 원본 목표 · 원본 예상치 값을 경계로 포함한다 | 경계 사이 보간 오차가 목표 대비 판정을 뒤집는다 |

- 검산: 규칙 = **6** · 원본 이름 보존 = **13**
- **B형 — 원본 이름 13종이 규약을 어기는 것은 결함이 아니다.** 결론 — 옛 이름을 보존하는 비용(접두 없는 이름 13개)이 새 이름으로 바꾸는 비용보다 작다. 반대 시나리오 — consumer_lag를 ing_consumer_lag로 바꾸면 용어 사전 · AC-19 · REQ-ING-18 · 원본 인용이 전부 옛 이름을 가리켜 알림 규칙이 존재하지 않는 시계열을 본다. 파생 지침 — 보존 목록에 새 이름을 더하지 않는다.

## 레이블 — 닫힌 집합

레이블 값은 닫힌 집합으로만 둔다(REQ-OBS-06). 태그 · 요청 · 사용자 식별자를 레이블에 싣지 않는다.

| 레이블 | 값 집합 | 상한의 근거 | 쓰는 계열 |
|------|------|------|------|
| route · method · code | API 표면 43 · HTTP 메서드 · HTTP 상태 | [../07_api](../07_api/README.md) 표면 요약 | http |
| error_code | 에러 코드 22 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) | http |
| channel · close_code | rt · alarm · cacheinv · WebSocket 종료 코드 8 | [../07_api/11_websocket.md](../07_api/11_websocket.md) | ws · rlt |
| device | 설비 ID — **티어 구성으로 상한**(최대 L 100) | [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) | col |
| quality · profile · mode | 품질 코드 7 · 신호 프로파일 8 · 주입 모드 4 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | col · gen |
| publisher · stage | collector · gen_b · gen_c · 백프레셔 단계 값 0 정상 · 1 주의 · 2 경고 · 3 위험 · 4 복구 | 발행 경로 3 · 단계 5 | backpressure_stage |
| phase · from · to · severity | A1~A6 · total · 알람 상태 5 · 심각도 3 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) · 상태 머신 | alm |
| prefix · stream | Redis 키 접두 8(stream · rt · alarm · cache · lock · rl · sess · auth) · raw · dlq | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | redis · mst · 래퍼 |
| store · table | postgres · clickhouse · redis · PostgreSQL 테이블 15 · ClickHouse 테이블 5 | 루트 README 고정 기준 | obs · pg · ch |
| **switch · env · value · impl · warning** | 스위치 11 · 환경변수 11 · 값(on · off · 정수 ms · ingest · collector) · 포트 구현 22 · stream_boundary_bypassed | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) | obs_switch_info · obs_switch_warning |
| commit_hash · memory_profile · capacity_tier | 기동 1값씩 | 프로세스 수명 동안 불변 | obs_run_info |
| 나머지(result · reason · layer · writer · freshness · op · kind · class · rank · queryid · quantile) | 계열 표의 레이블 칸이 값을 적는다 | 각 계열 표 | 각 계열 |

- 검산: 행 = **12**
- **device 레이블은 판정이다.** REQ-OBS-06의 원래 열거(도메인 · 저장소 · 스위치 · 상태 코드 · 단계)에 설비가 없었지만, Collector의 타임아웃 · 생략분은 설비 단위로 세어야 SIM 주입 계획(설비 포트 범위)과 대조된다([../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)). 설비 수는 티어 구성이 닫으므로 태그 수에 비례하지 않는다 — REQ-OBS-06 열거에 설비가 추가됐다(W6 반영).
- **스위치 상태 레이블 이름 판정 — switch · env · value · impl.** 스위치 상태를 모든 시계열의 레이블로 붙이지 않고 **정보 메트릭 obs_switch_info**(값 1) 하나에 싣는다. 모든 시계열에 11개 레이블을 붙이면 시계열 수는 그대로여도 스크레이프 본문이 스위치 수에 비례해 커지고, 기동마다 레이블 값이 바뀌어 같은 지표가 다른 시계열로 끊긴다. 대시보드 · 콘솔은 obs_switch_info를 조인해 읽는다.

## 컨슈머 랙 판정

인계 "컨슈머 랙 산출식 불일치(tech §9 대 arch §16)"를 닫는다. **판정 — consumer_lag = 그룹 lag(아직 배달하지 않은 엔트리 수) + pending(배달했으나 XACK하지 않은 엔트리 수)이다. 백프레셔 판정량(미확인 적체 · ADR-21)과 같은 양이며, XLEN을 식에 넣지 않는다.**

| 산출식 | 출처 | 정상 운전에서 내는 값 | 판정 |
|------|------|------|------|
| Stream 길이 − 처리 완료 오프셋 | 원본 tech_stack.md §9 | XLEN이 확인분을 포함해 MAXLEN까지 차므로 "처리 완료 오프셋"을 엔트리 수로 읽으면 확인분이 랙으로 남는다 · pending(XACK 누락)을 못 본다 | 버림 |
| XLEN − PEL 처리량 | 원본 architecture.md §16 | "처리량"의 단위가 없어 식이 닫히지 않는다 · XLEN 항이 같은 오류를 낸다 | 버림 |
| **그룹 lag + pending** | XINFO GROUPS의 lag · pending | 정상 운전에서 in-flight 배치 분량 안에 머물고 소비가 멈추면 발행 속도로 오른다 | **채택** — ADR-21 판정량과 같다 |

- 검산: 산출식 = **3**
- **pending을 넣는 이유 — XACK 누락이 랙에 드러나야 한다.** 격리 뒤 XACK를 빠뜨리면 엔트리는 배달됐으므로 그룹 lag에서 빠지지만 PEL에 영구 잔류한다. lag만 보면 랙이 0으로 돌아와 결함이 숨는다(REQ-ING-18 · 전역 불변식 at-least-once).
- **구성 성분을 따로 노출한다** — ing_group_lag · ing_group_pending. 합만 보면 "소비가 느리다(lag)"와 "삽입이 느리다(pending)"를 가를 수 없다.
- **lag를 산출할 수 없는 응답이면**(스트림 중간 삭제 등으로 lag가 비는 경우) consumer_lag는 직전 값을 유지하고 ing_consumer_lag_unknown을 1로 둔다 — 백프레셔의 "직전 단계 유지"(ADR-21)와 같은 규칙이다.
- **샘플 주기 — ING flusher가 플러시마다 한 번 XINFO GROUPS로 갱신하고 스크레이프는 마지막 값을 읽는다.** 저장소 통계 수집 주기(15초)에 맡기지 않는 이유는 랙이 가장 빠르게 변하는 지표라서다 — 15초 표본은 스파이크 흡수의 정점을 놓친다.
- **AC-19 "랙 0 유지"의 해석(판정).** 부하 중 pending은 in-flight 배치(창 버퍼 1 + 삽입 중 1 — XACK는 삽입 성공 뒤라 판정 인계 슬롯은 이미 확인된 배치다)만큼 늘 존재하므로 consumer_lag는 부하 중 0이 아니다. 합격선은 **그룹 lag 0 유지 · pending이 in-flight 2배치 분량 안에서 유계 · 부하 정지 뒤 consumer_lag 0 복귀**다 — [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md) AC-19 문구가 이 해석으로 보정됐다(W6 반영).

## 앱 기본 · HTTP · WebSocket

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| nodejs_eventloop_lag_seconds | gauge | 초 | 없음 | 이벤트 루프 지연(prom-client 기본 · p50 · p90 · p99 동반 게이지 포함) | OBS-01 |
| **nodejs_eventloop_lag_p95_seconds** | gauge | 초 | 없음 | 같은 계측기의 p95 — 기본 메트릭에 p95가 없다 | REQ-NFR-15 · 확장 1단계 진입 |
| nodejs_heap_size_used_bytes | gauge | 바이트 | 없음 | 힙 사용량 — Soak 누수 판정 | OBS-01 |
| nodejs_gc_duration_seconds | histogram | 초 | kind | GC 시간 | OBS-01 |
| process_cpu_seconds_total | counter | 초 | 없음 | api 프로세스 CPU | OBS-01 |
| nodejs_active_handles_total | gauge | 개 | 없음 | 활성 핸들 수 | OBS-01 |
| **worker_pool_queue_length** | gauge | 작업 | pool | piscina 워커 풀 대기열 길이 — 격리 작업이 워커를 기다리는 양 | ADR-25 |
| **worker_pool_task_duration_seconds** | histogram | 초 | pool | 워커 작업 시간(대기 제외) — 대기와 실행을 가른다 | ADR-25 |
| http_request_duration_seconds | histogram | 초 | route · method · code | API 지연 | OBS-01 · 조회 경로 예산 |
| http_requests_total | counter | 건 | route · method · code | 요청 수 · 상태 코드 분포 | OBS-01 |
| **http_designed_rejections_total** | counter | 건 | route · error_code | 설계된 거절(datagen.stream_full · common.rate_limited) | REQ-NFR-11 |
| ws_connections | gauge | 연결 | 없음 | WebSocket 동시 연결 | REQ-NFR-12 |
| ws_frames_sent_total | counter | 프레임 | channel | 송신 프레임 — 연결당 초당 프레임의 분자 | AC-41 · SW-07 |
| ws_closes_total | counter | 건 | close_code | 종료 코드별 절단(느린 구독자 4413 포함) | [../07_api/11_websocket.md](../07_api/11_websocket.md) |

- 검산: 행 = **14** — 앱 기본 6 + 워커 풀 2 + HTTP 3 + WebSocket 3
- **워커 풀 두 지표가 이벤트 루프 지연을 가른다.** 대기열이 길고 작업 시간이 그대로면 워커 수가 모자란 것이고(WORKER_POOL_SIZE · 소유 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)), 작업 시간이 늘면 입력 크기가 커진 것이다 — 둘 다 없이 이벤트 루프 지연만 보면 격리가 동작하는지 알 수 없다. pool 값은 격리 대상 목록(정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §worker_threads 격리 대상)의 닫힌 집합이다.
- prom-client 기본 메트릭의 정확한 목록은 라이브러리 버전 종속이다 — 버전 정본 [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md).

## 수집 — COL · SIM · GEN

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| points_emitted | counter | 포인트 | device | Collector가 발행한 포인트 | REQ-COL-15 · S2 계측 3종 |
| poll_duration | histogram | 초 | device | 폴링 한 사이클 소요 — scan_rate 초과가 병목 #1 | REQ-COL-15 |
| col_polls_total · col_poll_timeouts_total | counter | 건 | device | 폴링 수 · 타임아웃 수 — 타임아웃율의 분모 · 분자 | REQ-COL-02 · 15 |
| col_points_by_quality_total | counter | 포인트 | quality | 품질 코드별 판정 수 | REQ-COL-15 · AC-08 |
| col_modbus_rtt_seconds | histogram | 초 | 없음 | Modbus 요청 직전 · 응답 직후 차(구간 #2) · 타임아웃은 +Inf 칸 | REQ-COL-15 · 지연 예산 #2 |
| col_deadband_skipped_total | counter | 포인트 | device | 데드밴드 생략분 — 무손실 판정의 생성 측 차감 | ADR-24 · [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| deadband_boost_active | gauge | 0 · 1 | 없음 | 경고 단계 강화 적용 중 — SW-10 off면 0 고정 | REQ-COL-15 · ADR-24 |
| spool_active · spool_bytes | gauge | 0 · 1 · 바이트 | 없음 | 스풀 전환 여부 · 스풀 파일 크기 | REQ-COL-15 |
| spool_drain_rate | gauge | 엔트리/초 | 없음 | 복구 단계 재발행 속도 | REQ-COL-13 |
| col_spool_truncated_frames_total | counter | 프레임 | 없음 | 쓰다 끊긴 스풀 프레임 — 버리고 센다 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| col_ready | gauge | 0 · 1 | 없음 | 기동 로드(설비 · 활성 태그) 완료 — 0이면 기동 미준비 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| col_latest_write_failures_total | counter | 건 | 없음 | SW-11 collector의 rt:latest 쓰기 실패 | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) |
| **backpressure_stage** | gauge | 단계 값 | publisher | 발행 경로별 백프레셔 단계 — 모드 B 단계가 Collector와 같은 판정인지 대조 | ADR-21 · 23 · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) |
| sim_listen_failed_ports | gauge | 포트 | 없음 | 기동 실패한 SIM 포트 수 | REQ-SIM-03 |
| sim_fault_injection_active | gauge | 0 · 1 | kind(delay · exception) | 지금 적용 중인 주입 계획 | REQ-SIM-10 |
| gen_points_generated_total | counter | 포인트 | mode · profile | 생성 카운트 — 무손실 판정의 분모 | AC-01 · REQ-NFR-01 |
| gen_points_dropout_total | counter | 포인트 | mode | DROPOUT이 생략한 행 | AC-01 |
| gen_publish_halted_entries_total · gen_publish_halted_points_total | counter | 엔트리 · 포인트 | mode | 위험 단계로 발행하지 않은 양 | REQ-GEN-07 |
| gen_worker_utilization | gauge | 0~1 | mode | 생성기 워커 스레드 이벤트 루프 사용률 — 생성기 CPU | REQ-GEN-13 |
| gen_register_update_seconds | histogram | 초 | 없음 | 신호 생성 → 레지스터 반영(구간 #1 · 모드 A) | 지연 예산 #1 |

- 검산: 행 = **20**(COL 13 + SIM 2 + GEN 5) — 이름 수는 §검산 한 자리에서 센다
- **backpressure_stage는 발행자가 판정한 단계다.** 판정량은 consumer_lag와 같은 양이고, 위 계열 모두가 같은 임계(MAXLEN 비율)를 쓴다 — 발행자마다 다른 단계가 보이면 검사 주기 차이이거나 임계 설정 결함이다.

## 적재 — ING

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| **consumer_lag** | gauge | 엔트리 | 없음 | 그룹 lag + pending — §컨슈머 랙 판정 | REQ-ING-18 · AC-19 |
| ing_group_lag · ing_group_pending | gauge | 엔트리 | 없음 | consumer_lag의 두 성분 | 상동 |
| ing_consumer_lag_unknown | gauge | 0 · 1 | 없음 | lag 산출 불가 — 직전 값 유지 중 | ADR-21 |
| rows_inserted | counter | 행 | 없음 | tag_raw에 쓰인 행 | REQ-ING-18 |
| insert_duration | histogram | 초 | 없음 | INSERT 송신 → 응답(구간 #7) | REQ-ING-18 |
| batch_size | histogram | 행 | 없음 | 배치당 행 수 | REQ-ING-18 |
| dlq_count | counter | 엔트리 | reason(retry_exhausted · undecodable) | DLQ로 옮긴 원 엔트리 | REQ-ING-18 · AC-12 |
| ing_insert_retries_total | counter | 건 | 없음 | 같은 토큰 재시도 | AC-20 |
| ing_stream_residence_seconds | histogram | 초 | 없음 | XREADGROUP 수신 − 엔트리 ID 시각(6a) | REQ-ING-18 · 지연 예산 6a |
| ing_decode_seconds | histogram | 초 | 없음 | 수신 → 행 배열 완료(6b) | 지연 예산 6b |
| ing_fanin_wait_seconds | histogram | 초 | 없음 | 행 배열 완료 → 플러시 시작(6c) | 지연 예산 6c |
| ing_consumer_paused_seconds_total | counter | 초 | 없음 | flusher 보유 상한으로 컨슈머가 읽기를 멈춘 시간 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| ing_dedup_ignored_batches_total | counter | 배치 | 없음 | 중복 제거로 쓰인 행 수 0인 성공 | 상동 |
| ing_xautoclaim_claimed_total | counter | 엔트리 | 없음 | 주기 회수로 인수한 PEL | EXP-28 |
| ing_routed_rows_total | counter | 행 | layer(raw · alarm) | 분기 계층별 쓰기 결과 — ① 원시 적재 · ② 판정기 인계 | REQ-ING-14 · 분기 대조 |
| ing_negative_dt_total | counter | 행 | 없음 | 음수 dt 행 — 거절하지 않고 센다 | [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) |
| ing_control_copy_rows_total · ing_control_copy_failures_total | counter | 행 · 배치 | 없음 | 대조군 COPY 행 · 실패 배치(SW-09) | REQ-ING-15 |
| ing_control_copy_seconds | histogram | 초 | 없음 | 대조군 COPY 트랜잭션 시간 — 비교 축 3 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| ing_mv_errors_total | counter | 건 | result(error · retry_ok) | MV 삽입 실패와 재시도 성공 | [../06_pipeline/09_rollup.md](../06_pipeline/09_rollup.md) |
| ing_rollup_suspect_batches_total | counter | 배치 | 없음 | 롤업 의심 구간 기록 수 | 상동 |

- 검산: 행 = **20**
- **구간을 식별하는 값(ts 범위 · 토큰)은 메트릭에 싣지 않는다.** 대조군 실패 · 롤업 의심 · 판정 무효 구간은 계수만 메트릭이고 구간 자체는 구조화 로그 이벤트다 — 레이블에 ts를 넣으면 닫힌 집합이 깨진다. 기록 자리의 판정은 [02_instrumentation.md](./02_instrumentation.md) §구간 기록.

## 알람 — ALM

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| alm_evaluations_total | counter | 판정 | result(normal · violation) | 판정 수 — 분기 대조 ②의 첫 값 | AC-35 |
| alm_eval_duration_seconds | histogram | 초 | phase(A1~A6 · total) | 판정 구간과 하위 구간 | 지연 예산 판정 구간 |
| alm_handoff_wait_seconds | histogram | 초 | 없음 | flusher가 인계 슬롯을 기다린 시간 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| alm_transitions_total | counter | 건 | from · to | 디바운스 상태 전이 수 | 원본 tech_stack.md §9 · AC-09 |
| alm_events_opened_total · alm_events_closed_total | counter | 건 | 없음 | alarm_event 확정 열기 · 닫기 | AC-35 |
| alm_active_alarms | gauge | 건 | severity | 열린 알람 수 — 규칙 ID 대신 심각도로 가른다 | 원본 tech_stack.md §9 |
| alm_eval_rows_inserted_total | counter | 행 | 없음 | alarm_eval에 쓰인 판정 행 | AC-35 |
| alm_eval_gap_batches_total · alm_eval_gap_rows_total | counter | 배치 · 행 | 없음 | 재시도 소진으로 판정 전수가 빈 무효 구간 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| alm_state_write_failures_total | counter | 건 | 없음 | 커밋 뒤 alarm:state 쓰기 실패 | 상동 |
| alm_pg_write_failures_total | counter | 건 | op(open · close) | 확정 INSERT · UPDATE 실패 | AC-36 |
| alm_acks_total | counter | 건 | result(accepted · rejected) | 확인(ACK) 요청 결과 — ACK 신호 부재 계측의 분모 | [../07_api/07_alarms.md](../07_api/07_alarms.md) |

- 검산: 행 = **11**
- 원본의 "규칙별 활성 알람 수"는 rule_id 레이블이 되어 닫힌 집합을 깬다 — 심각도(3)로 바꿨다. 규칙별 값은 alarm_event 조회로 본다.

## 실시간 · 조회 · 업무 · 인증 — RLT · TSQ · MST · AUT

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| rlt_latest_restores_total | counter | 건 | result(success · empty · failed) | 키 없음 → ClickHouse 복원 결과 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| rlt_latest_lock_wait_exhausted_total | counter | 건 | 없음 | 최신값 락 실패 뒤 대기 소진 | 상동 |
| rlt_latest_points_served_total | counter | 포인트 | freshness(fresh · stale) | 응답한 태그 값 — STALE 비율의 분모 · 분자 | AC-34 · RLT-03 |
| rlt_latest_updates_total | counter | 건 | writer(ingest · collector) | rt:latest 갱신 — 갱신 공백 판정 | SW-11 · AC-34 |
| rlt_tag_unresolved_total | counter | 건 | 없음 | 단일 태그 해석 실패(503) | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| rlt_fanout_delivery_seconds | histogram | 초 | channel | 발행 → 게이트웨이 송신 | SW-06 · AC-40 |
| rlt_publish_failures_total | counter | 건 | channel | FanoutPublisher 발행 실패(계수 · 삼킴) | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · 08_alarm |
| rlt_throttle_merged_total | counter | 갱신 | 없음 | 스로틀 창이 병합해 버린 갱신 | SW-07 |
| rlt_subscriber_disconnects_total | counter | 건 | 없음 | api 구독 연결이 출력 버퍼 한도로 끊김(4503) | 한도 값 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| tsq_cache_requests_total | counter | 건 | result(hit · miss · error) | cache:q 조회 결과 — 히트율은 이 계열만 쓴다 | REQ-NFR-10 · AC-23 |
| tsq_source_queries_total | counter | 건 | 없음 | 시계열 조회가 ClickHouse를 부른 수 | AC-25 · AC-39 |
| tsq_rebuild_duration_seconds | histogram | 초 | 없음 | 캐시 미스 재구성 시간 — 스탬피드 대기 관계의 우변 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| tsq_rebuild_lock_wait_exhausted_total | counter | 건 | 없음 | 스탬피드 대기 소진 → 직접 조회 | 상동 |
| tsq_export_aborted_total | counter | 건 | 없음 | 원시 내보내기 도중 중단 | [../07_api/05_timeseries.md](../07_api/05_timeseries.md) |
| mst_cache_delete_failures_total | counter | 건 | prefix | 무효화 체인 ② 삭제 실패 | REQ-MST-10 |
| mst_dict_reloads_total | counter | 건 | result(ok · failed) | 체인 ④ Dictionary 재적재 — AC-06 사건 | REQ-MST-10 · AC-06 |
| cache_wrapper_failures_total | counter | 건 | prefix · op | CacheKeyClient가 삼킨 실패(degrade) | REQ-GLB-09 |
| durable_wrapper_failures_total | counter | 건 | prefix | DurableKeyClient가 던진 실패 | 상동 |
| aut_ratelimit_bypassed_total | counter | 건 | 없음 | Redis 불가 중 세지 않고 통과한 요청 | REQ-AUT-14 |
| aut_ratelimit_rejected_total | counter | 건 | class(general · bulk_read · export · bulk_ingest) | 한도 초과 거절 — 등급 이름 정본 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) · 실험 구간 증가가 0이 아니면 그 측정 기록은 무효(관계 R2 · R4) | REQ-AUT-14 |
| aut_token_verify_seconds | histogram | 초 | 없음 | 액세스 토큰 검증 시간(S7) — 모드 C 인증 비용 | REQ-GEN-15 · EXP-37 |

- 검산: 행 = **21**
- **로그인 실패 계수는 따로 두지 않는다(W7 판정).** http_requests_total{route="/api/v1/auth/login", method="POST", code="401"}가 곧 로그인 실패 수다 — 로그인 표면의 401은 auth.invalid_credentials 하나뿐이다([../07_api/03_auth.md](../07_api/03_auth.md) #1). 대입 흔적은 이 계수의 급증으로 본다(로그인 시도 제한을 두지 않은 판정의 관측 자리 — [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) §로그인 시도 제한 판정).

## 저장소 — Redis · PostgreSQL · ClickHouse

OBS가 수집 주기마다 모아 마지막 값을 낸다(REQ-OBS-03). 수집 명령 · 뷰는 [02_instrumentation.md](./02_instrumentation.md) §수집 방식.

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| redis_used_memory_bytes · redis_maxmemory_bytes | gauge | 바이트 | 없음 | 사용 메모리 · 상한 | OBS-02 |
| redis_mem_fragmentation_ratio | gauge | 비 | 없음 | 단편화 — 컨테이너 상한 여유 | [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| redis_evicted_keys_total | counter | 키 | 없음 | 축출 수 | AC-32 |
| redis_keyspace_hits_total · redis_keyspace_misses_total | counter | 건 | 없음 | 인스턴스 전체 적중 — **히트율 판정에 쓰지 않는다**(rl · auth 조회가 섞인다) | REQ-NFR-10 |
| redis_ops_per_sec | gauge | 명령/초 | 없음 | 명령 처리율 — 병목 #5 | [../06_pipeline/01_flow_inventory.md](../06_pipeline/01_flow_inventory.md) |
| redis_client_output_buffer_bytes | gauge | 바이트 | 없음 | 일반 · Pub/Sub 클라이언트 출력 버퍼 합 — 한도 접근 감시 | 한도 값 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| redis_stream_length | gauge | 엔트리 | stream | XLEN — **메모리 양 · 트리밍 감시 전용 · 적체 판정 금지** | ADR-21 |
| redis_stream_entries_added_total | counter | 엔트리 | stream | 누적 XADD 수 — Stream 유입량 | AC-37 |
| redis_prefix_memory_bytes | gauge | 바이트 | prefix | 키 접두별 점유 추정(표본) | OBS-03 · REQ-OBS-04 |
| redis_prefix_sampled_keys | gauge | 키 | prefix | 그 추정에 쓴 표본 수 — 추정 신뢰도 | 상동 |
| stream_trimmed_unacked | counter | 엔트리 | 없음 | 미확인(PEL · 미배달) 엔트리가 트리밍으로 잘린 수 — 0이어야 한다 | 전역 불변식 백프레셔 명시화 |
| pg_xact_commit_total | counter | 트랜잭션 | 없음 | 커밋 수 — TPS | OBS-02 |
| pg_connections | gauge | 연결 | state | 상태별 연결 수 — 병목 #8 | 상동 |
| pg_buffer_hit_ratio | gauge | 0~1 | 없음 | 버퍼 적중률 | 상동 |
| pg_lock_waits | gauge | 건 | 없음 | 대기 중인 락 | 상동 |
| pg_statement_top_mean_seconds | gauge | 초 | rank · queryid | 평균 시간 상위 10 문형 — 문형 텍스트는 싣지 않는다 | 상동 · REQ-OBS-10 |
| pg_table_dead_tuples · pg_autovacuum_total | gauge · counter | 튜플 · 건 | table | 데드 튜플 · autovacuum 실행 | 비교 축 5 |
| pg_relation_size_bytes | gauge | 바이트 | table · kind(heap · index) | 테이블 · 인덱스 크기 | 비교 축 1 · 6 |
| pg_wal_bytes_total | counter | 바이트 | 없음 | WAL 누적 바이트 | 비교 축 5 |
| ch_inserted_rows_total | counter | 행 | 없음 | 서버가 받은 삽입 행 | OBS-02 |
| ch_active_parts | gauge | 파트 | table | 활성 파트 수 | REQ-NFR-13 |
| ch_new_parts_total | counter | 파트 | table | 새 파트 생성 — 파트 생성률 | AC-22 |
| ch_merges_running | gauge | 건 | 없음 | 진행 중 머지 | OBS-02 |
| ch_merge_written_bytes_total | counter | 바이트 | table | 머지가 다시 쓴 바이트 — 머지 증폭 | 비교 축 5 |
| ch_parts_bytes_on_disk · ch_parts_uncompressed_bytes | gauge | 바이트 | table | 디스크 크기 · 비압축 크기 — 압축률 | REQ-NFR-14 |
| ch_query_duration_p95_seconds | gauge | 초 | 없음 | 직전 수집 창의 쿼리 p95(query_log) | OBS-02 |
| ch_memory_tracking_bytes | gauge | 바이트 | 없음 | 서버 메모리 추적 값 | OBS-02 |
| ch_disk_free_bytes · ch_disk_total_bytes | gauge | 바이트 | 없음 | 데이터 디스크 여유 · 전체 — 디스크 잔여 알림 · 디스크 예산 | 장애 시나리오 #10 |

- 검산: 행 = **28** — Redis 11 + PostgreSQL 8 + ClickHouse 9
- **stream_trimmed_unacked는 발행자가 셀 수 없다.** 트리밍은 XADD MAXLEN ~가 조용히 하므로 OBS가 수집 주기마다 스트림 첫 엔트리 ID와 그룹의 최소 미확인 ID(PEL 최솟값 · 마지막 배달 ID 다음)를 대조해 첫 엔트리가 더 뒤면 그 차를 더한다 — 판정 기전은 [02_instrumentation.md](./02_instrumentation.md).

## E2E · 관측 자체 · 스위치 상태

| 이름 | 종류 | 단위 | 레이블 | 뜻 | 원천 |
|------|------|------|------|------|------|
| e2e_latency | gauge | 초 | quantile(0.5 · 0.95 · 0.99) | 최근 창 ingested_at − ts 분위수 | OBS-04 · REQ-OBS-05 · S2 계측 3종 |
| e2e_latency_rows | gauge | 행 | 없음 | 그 창의 행 수 — 0이면 게이지가 비었다 | 상동 |
| **obs_switch_info** | gauge | 1 | switch · env · value · impl | 스위치별 실제 주입 구현 | OBS-06 · REQ-OBS-11 |
| obs_switch_warning | gauge | 1 | switch · warning | 스위치 경고(SW-01 off의 stream_boundary_bypassed) | REQ-GLB-04 |
| obs_run_info | gauge | 1 | commit_hash · memory_profile · capacity_tier | 측정 기록 4요소 중 스위치 밖 셋 | REQ-OBS-11 · health run |
| obs_run_memory_limit_bytes | gauge | 바이트 | 없음 | cgroup에서 읽은 api 컨테이너 실제 메모리 상한 | 상동 |
| obs_collect_errors_total | counter | 건 | store | 저장소 통계 수집 실패 — 그 계열만 빈다 | REQ-OBS-03 |
| obs_collect_duration_seconds | histogram | 초 | store | 수집 한 번의 시간 — 관측 부하 | EXP-38 |
| obs_collect_last_success_timestamp_seconds | gauge | epoch 초 | store | 마지막 성공 수집 시각 — 표시값의 나이 | REQ-OBS-03 |
| obs_metrics_response_bytes | gauge | 바이트 | 없음 | 직전 /metrics 응답 크기 — 카디널리티 감시 | REQ-OBS-06 |

- 검산: 행 = **10**
- **obs_switch_info의 value는 health switches.*.value와 같은 문자열이다.** SW-07은 정수 ms를 문자열로 싣는다("100") — 레이블 값은 문자열뿐이다. 두 자리의 값이 다르면 health가 아니라 계측 결함이다(REQ-OBS-11 검증).

### 검산

- 표 행 = 14 + 20 + 20 + 11 + 21 + 28 + 10 = **124**
- 한 행에 이름 둘을 둔 행 = 수집 3(col_polls · spool · gen_publish_halted) + 적재 2(ing_group · ing_control_copy) + 알람 2(alm_events · alm_eval_gap) + 저장소 5(redis 메모리 · redis keyspace · pg 데드 튜플 · ch 파트 크기 · ch 디스크) = **12**
- **이름 수 = 124 + 12 = 136** — 계열별 앱 · 워커 풀 · HTTP · WS 14 · 수집 23 · 적재 22 · 알람 13 · 실시간 · 조회 · 업무 · 인증 21 · 저장소 33 · E2E · 관측 10 = 14 + 23 + 22 + 13 + 21 + 33 + 10 = **136**
- 원본 보존 13종은 전부 위 표에 있다 — points_emitted · poll_duration · deadband_boost_active · spool_active · spool_bytes · spool_drain_rate(수집) · consumer_lag · rows_inserted · insert_duration · batch_size · dlq_count(적재) · stream_trimmed_unacked(저장소) · e2e_latency(E2E) = **13**

## 파생 지표

PromQL 기록 규칙으로 계산하는 값이다. 관측 프로파일이 없을 때는 직접 덤프 두 점의 차로 같은 식을 계산한다([04_experiment_protocol.md](./04_experiment_protocol.md)).

| 지표 | 식(창 w의 증가분 기준) | 쓰는 곳 | 식을 다르게 쓰면 |
|------|------|------|------|
| API 오류율 | (5xx 증가 − 설계 거절 중 503 증가) ÷ (요청 증가 − 설계 거절 증가) | REQ-NFR-11 | 백프레셔가 잘 동작할수록 오류율이 나빠져 안전장치가 실패로 기록된다 |
| 조회 캐시 히트율 | hit 증가 ÷ (hit + miss 증가) — tsq_cache_requests_total만 | REQ-NFR-10 · AC-23 · 확장 3단계 | keyspace 전체로 재면 rl · auth 조회가 섞인다 |
| 타임아웃율 | col_poll_timeouts_total 증가 ÷ col_polls_total 증가 | REQ-COL-15 | 폴링 수 대신 시간으로 나누면 설비 수가 바뀔 때 비교할 수 없다 |
| STALE 비율 | stale 증가 ÷ 전체 증가(rlt_latest_points_served_total) | AC-34 | 키 수로 나누면 태그 수가 다른 설비가 같은 무게를 갖는다 |
| 연결당 초당 프레임 | ws_frames_sent_total 증가율 ÷ ws_connections | AC-41 | 전체 프레임만 보면 연결 수 증가와 스로틀 효과를 가를 수 없다 |
| 무손실 차 | gen_points_generated_total − dropout − col_deadband_skipped_total − gen_publish_halted_points_total − tag_raw count | AC-01 · REQ-NFR-01 | 차감 셋을 빼지 않으면 설계된 생략이 거짓 유실이 된다 |
| 파트 생성률 | ch_new_parts_total{table="tag_raw"} 증가율 | AC-22 · REQ-NFR-13 | 활성 파트 수만 보면 머지가 생성을 따라잡는 동안의 부담이 안 보인다 |

- 검산: 파생 지표 = **7**
- 무손실 차의 tag_raw count는 메트릭이 아니라 SQL이다 — 적재를 멈추고 랙 0 뒤에 같은 구간으로 센다(AC-01).

## 인계 메트릭 대응 검산

선행 문서가 "이름은 W6"으로 넘긴 자리 전부다.

| 원천(요구 · 문서) | 넘긴 지표 | 이름 |
|------|------|------|
| docs_plan W6 10/01 · REQ-AUT-14 | 레이트 리밋 통과 | aut_ratelimit_bypassed_total |
| REQ-MST-10 · 06_pipeline/07 | 캐시 삭제 · 재적재 · 발행 실패 | mst_cache_delete_failures_total · mst_dict_reloads_total · rlt_publish_failures_total |
| REQ-COL-15 · 06_pipeline/02 | 품질 코드별 · Modbus 왕복 · 타임아웃 · 생략분 · 기동 미준비 | col_points_by_quality_total · col_modbus_rtt_seconds · col_poll_timeouts_total · col_deadband_skipped_total · col_ready |
| REQ-SIM-03 · 10 | 기동 실패 포트 · 적용 중 주입 | sim_listen_failed_ports · sim_fault_injection_active |
| REQ-GEN-07 · 13 · 06_pipeline/10 | 모드 B 발행 중단 · 모드 B 단계 게이지 · 생성기 CPU | gen_publish_halted_entries_total · gen_publish_halted_points_total · backpressure_stage · gen_worker_utilization |
| REQ-ING-14 · 15 · 18 · 06_pipeline/03 · 04 | 계층별 쓰기 · 대조군 실패 · Stream 체류 · fan-in 대기 · 컨슈머 정지 · 쓰인 행 수 0 | ing_routed_rows_total · ing_control_copy_failures_total · ing_stream_residence_seconds · ing_fanin_wait_seconds · ing_consumer_paused_seconds_total · ing_dedup_ignored_batches_total |
| REQ-NFR-11 | 설계 거절 제외 오류율 | http_designed_rejections_total + §파생 지표 API 오류율 |
| 04_architecture/06 · ADR-24 | 단계 게이지 · 데드밴드 생략분 · 컨슈머 랙 산출식 | backpressure_stage · col_deadband_skipped_total · consumer_lag |
| 04_architecture/05 | Stream 대기 · 판정 · 히스토그램 이름 | ing_stream_residence_seconds · ing_decode_seconds · ing_fanin_wait_seconds · alm_eval_duration_seconds |
| 06_pipeline/05 · 06 | 최신값 대기 소진 · 복원 · 스탬피드 소진 · 캐시 실패 | rlt_latest_lock_wait_exhausted_total · rlt_latest_restores_total · tsq_rebuild_lock_wait_exhausted_total · cache_wrapper_failures_total |
| 06_pipeline/08 · 07_api/07 | 인계 대기 · 판정 무효 구간 · 전이 수 · ACK 부재 | alm_handoff_wait_seconds · alm_eval_gap_batches_total · alm_eval_gap_rows_total · alm_transitions_total · alm_acks_total |
| 06_pipeline/09 | 롤업 의심 구간 · MV 오류 | ing_rollup_suspect_batches_total · ing_mv_errors_total |
| 06_pipeline/12 | 음수 dt · 잘린 스풀 프레임 | ing_negative_dt_total · col_spool_truncated_frames_total |
| 07_api/05 | 내보내기 중단 | tsq_export_aborted_total |
| 02_features/13 · 07_api/10 · 03_requirements/12 | 스위치 상태 레이블 이름 | obs_switch_info(switch · env · value · impl) |

- 검산: 원천 행 = **15** · 넘긴 지표 전부 이름 있음 · 미명명 **0**
- 병목 확인 지표(06_pipeline/01 §흐름별 병목 후보의 원본 표기)는 poll_duration · ch_active_parts · redis_ops_per_sec · ch_query_duration_p95_seconds · tsq_cache_requests_total · pg_connections · alm_eval_duration_seconds · nodejs_eventloop_lag_p95_seconds · gen_worker_utilization · ing_fanin_wait_seconds · alm_handoff_wait_seconds로 읽는다. 디스크 대기 · 호스트 CPU는 메트릭이 아니라 호스트 도구다([02_instrumentation.md](./02_instrumentation.md)).

## 조정값 — 조회 계약

REQ-OBS 조회 계약 표가 이 문서로 넘긴 값이다.

| 조정값 | 읽는 자리 | 기준 시점 | 금지된 대체 | 부재 시 | 현행 참고 |
|------|------|------|------|------|------|
| 저장소 메트릭 수집 주기 | MetricsModule 수집 타이머 | 기동 시 | 스크레이프마다 조회 | 기동 거부 | 15초(원본) |
| E2E 게이지 창 | 주기 쿼리의 ts 조건 | 쿼리 시 | 창 없는 전 기간 · ingested_at으로 자른 창 | 기동 거부 | 최근 5분(원본) · 쿼리 주기 = 수집 주기 |
| 메모리 표본 수 | 접두별 표본 추정 | 수집 주기 | 전수 순회(KEYS · 전 키 SCAN) | 기동 거부 | 캐시 계열 무작위 표본 200 · 봉인 rt · alarm 순환 표본 10 · 봉인 stream 키 2는 직접 측정 |

- 검산: 조정값 = **3**
- **Pub/Sub 출력 버퍼 한도는 이 표에 없다.** 값의 소유는 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(S4 확정)이고 이 문서는 한도 접근을 보는 메트릭(redis_client_output_buffer_bytes · rlt_subscriber_disconnects_total)만 갖는다. 한도를 넘으면 Redis가 그 api 인스턴스의 구독 연결을 끊어 인스턴스 전체 푸시가 멈춘다(종료 코드 4503).
- **메모리 표본 수의 근거** — 수집 한 번에 무작위 키 추출 + MEMORY USAGE가 키당 두 명령이라 200표본은 주기당 400명령, 15초 주기면 초당 약 27명령이다. M 티어 수집 경로의 초당 XADD 50 · 조회 부하에 비해 작고, 전부 O(1)에 가까운 명령이라 단일 스레드 점유가 짧다. 추정 오차는 3계층 미확인이며 EXP-39가 부하 없는 전수와 대조해 표본 수를 조정한다.

## 이름 변경 규칙

| 변경 | 처리 | 어기면 |
|------|------|------|
| 뜻 유지 · 이름만 변경 | **하지 않는다** | 알림 · 대시보드 · BFF 해석 · 측정 기록의 지표 칸이 존재하지 않는 시계열을 본다 |
| 뜻 변경(산출식 · 단위 · 레이블 의미) | 새 이름을 만들고 옛 이름은 폐지로 이 문서에 남긴다 | 전후 기록이 같은 이름으로 다른 양을 비교한다 |
| 레이블 값 추가 | 닫힌 집합의 정본이 늘면 따라 늘린다(스위치 · 에러 코드 · 표면) | 새 값이 조용히 빠져 합계가 맞지 않는다 |
| 메트릭 신설 | 이 문서 계열 표 · §검산 · 원천 열을 같은 변경 단위에서 | 계측 없는 스위치 · 이름 없는 지표가 생긴다 |

- 검산: 변경 = **4**
- 폐지된 이름은 현재 **0**이다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 히스토그램 버킷 경계 전수 | 규칙만(원본 목표 · 예상치 포함) — 경계 목록은 코드 착수 | 이 문서 · 코드 착수 |
| 메모리 표본 추정 오차 | 3계층 미확인 | EXP-39 |
| /metrics 응답 크기 · 스크레이프 지연 | 3계층 미확인 | EXP-38 · [07_measurement_limits.md](./07_measurement_limits.md) |
| 역할 분리 뒤 이름 충돌 | ADR-22 — 역할마다 /metrics · 저장소 통계는 api 역할만 | 확장 1단계 진입 시 |

## 관련 문서

- [02_instrumentation.md](./02_instrumentation.md) — 계측 지점 · 수집 방식 · 구간 기록
- [03_dashboards_alerts.md](./03_dashboards_alerts.md) — 대시보드 · 알림 규칙
- [06_experiment_catalog.md](./06_experiment_catalog.md) — 판정 지표
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — /metrics · health 표면
- [../03_requirements/12_metrics.md](../03_requirements/12_metrics.md) — REQ-OBS 계약
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 판정량 · 단계
- [../11_glossary/01_domain_terms.md](../11_glossary/01_domain_terms.md) — 컨슈머 랙 용어
