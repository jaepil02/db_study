# REQ-NFR · REQ-TEC — 비기능 · 기술 운영 요구사항

> **대상**: db_study의 비기능 목표(무손실 · 무중복 · 지연 예산 · 처리량 · 조회 지연 · 캐시 히트율 · WebSocket 연결 · 활성 파트 · 압축률 · 이벤트 루프 지연 · 소진 시간 · 역전 지점)와 기술 운영 계약(로컬 실행 · 127.0.0.1 바인드 · 기동 순서 · 버전 고정 · 마이그레이션 순번 · 메모리 프로파일 · 스냅샷 복원 · 측정 기록 4요소 · 3회 중앙값) — REQ-NFR-NN · REQ-TEC-NN 채번 정본 · 성능 목표치의 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S2 실측 반영(EXP-30 기록 011 폐기 · 012 · EXP-07 기록 013 · d32b09a) — REQ-NFR-03 미확인 → **기준선 p50 608 · p95 1,011 · p99 1,013 ms** · REQ-NFR-07 미확인 → **p95 on 2.30 · off 6.50 ms(슬라이스 · k6)** · REQ-NFR-04 구간 p50 기록(6c 575 ms 지배) — 목표 판정은 S5
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — REQ-NFR-17 이 머신 실측값 미확인 → **워커 1 약 590만 pps**(합격선 3만의 약 197배) · 도입 단락 · 미확인 표의 "전부 미확인" 교정
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 알람 판정 구간 예산 행에 구간 신설 완료 · 값 EXP-30 연결
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — REQ-NFR 18행 검증 방법에 EXP 번호 · 오류율 산정 메트릭 판정 · 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 중간 프로파일 정식 채택 안 함 · 관측 스택 구성원 prometheus · grafana 2(정본 09_tech_stack/03 · 04) · REQ 수 불변
> **원천**: 원본 architecture.md §3 · §13 · §14 · §15 · §16 · §17 · §18 · §19(커밋 ff66a37) · 원본 data_flow.md §11.2 · §11.3 · §12.3 · §15 · §16 · §17(커밋 ff66a37) · 원본 tech_stack.md §1 · §5.1 · §10 · §10.1~§10.6 · §12(커밋 ff66a37) · 원본 implementation_plan.md §2 · §2.1~§2.5 · §4 · §8 · §9(커밋 ff66a37) · D-02 · D-06 · D-09 · D-10 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) · [01_global_rules.md](./01_global_rules.md) REQ-GLB-17 · 19 · 22 · 23

이 문서는 **성능 목표치의 정본**이다(루트 README 고정 기준 "성능 수치"). 그러나 이 문서의 목표치는 실측으로 닫힌 행(REQ-NFR-17 — S1)을 빼고 **3계층 미확인**이다 — 실측 전이므로 "미확인 — 확정 전 임의 값 고정 금지"로 등재하고, 원본 값은 **원본 목표(4 vCPU 가정)**로 곁에 둔다. 원본은 스스로 "로컬 머신에서는 첫 실행 결과를 기준선으로 다시 잡는다"(원본 architecture.md §16)고 적었고, 이 머신은 원본 가정과 병목 방향이 반대다(CPU 과잉 · 메모리 부족 — 원본 implementation_plan.md §2.1). 원본 목표를 그대로 합격선으로 쓰면 다른 머신의 목표로 이 머신을 판정하게 된다.

**수치가 없는 대신 확정 수단이 있다.** 각 REQ-NFR은 측정 방법 · 기록 조건 · 확정할 실험 자리를 갖는다. 실험 번호 EXP-NN은 W6이 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)에서 채번했다(W6 — EXP-01~39) — 검증 방법 칸이 확정 실험 번호를 가리킨다(대조군 쿼리는 EXP-01~05). 확정된 값은 측정 기록(docs/measurements)의 4요소와 함께 이 문서가 인용해 올리며, 그때 원본 목표 칸은 지우지 않고 남긴다.

**경계 — 판정 조건과 성능 수치를 가른다.** 무손실(생성 수 = 행 수) · 무중복(중복 0건)은 성능 수치가 아니라 **정확 일치 조건**이라 1계층으로 쓴다. 미확인인 것은 그 조건이 성립하는 **부하 상한**이다. REQ-TEC는 수치가 아니라 절차 계약이다.

## 수치 표기 규칙

| 표기 | 뜻 | 쓰는 자리 | 어기면 |
|------|------|------|------|
| 미확인 — 확정 전 임의 값 고정 금지 | 실측 전 목표치 | REQ-NFR 요구 칸의 현행 목표 | 원본 값이 목표로 굳어 다른 머신의 기준으로 이 머신을 판정한다 |
| 원본 목표(4 vCPU 가정) | 원본 architecture.md §16 · 원본 data_flow.md §15의 값 | 요구 칸의 병기 | 원본 값과 실측 기준선이 한 칸에 섞여 어느 쪽이 확정인지 모른다 |
| 원본 예상치 | 원본의 예상 차이 · 예상 압축률(목표 아님) | 요구 칸의 병기 | 예상이 목표로 오독된다 |
| 정확 일치 | 1계층 판정 조건(무손실 · 무중복 · count 대조) | 요구 칸 | 판정 조건에 오차 허용을 두면 누락 · 중복이 가려진다 |
| EXP-NN | 확정할 실험 자리 — 채번 정본 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) | 검증 방법 칸 | 실험 없는 목표가 남는다 |

- 검산: 표기 = **5**종
- **개발 프로파일 수치는 어떤 REQ-NFR에도 대조하지 않는다**(REQ-TEC-07). 그 프로파일의 목적은 파이프라인 연결 확인이다.

## 비기능 요구사항 — 파이프라인 (REQ-NFR)

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-NFR-01** | 수집 무손실 — 생성 포인트 수 = ClickHouse tag_raw 행 수 **정확 일치**(DROPOUT 생략 행 · 데드밴드 생략분은 생성 측에서 뺀다). 이 조건이 성립하는 최대 부하는 **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) M 티어 100% | 원본 architecture.md §16 · 원본 data_flow.md §12.3 · §17 | 생성 측 카운트에서 생략분을 빼지 않으면 DROPOUT 프로파일 실험이 매번 거짓 유실로 판정된다. 상한을 원본 M 티어로 고정하면 이 머신에서 먼저 걸리는 Redis 메모리 한계를 가린다 | 생성 카운트 대 count() 대조 · 부하 단계별 반복 · EXP-23 · 26 | GEN-09 · ING-03 · ING-05 | F-01 · F-02 · F-09 | 해당 없음 |
| **REQ-NFR-02** | 무중복 — tag_id + ts 조합의 중복 행 **0건**(SW-08 on). ClickHouse 중단 · 컨슈머 강제 종료 후에도 성립한다 | 원본 data_flow.md §12.3 · §17 · REQ-GLB-06 | 중복이 있으면 avg · count 롤업이 조용히 부풀어 역전 지점 · 압축률 측정까지 오염된다 | GROUP BY tag_id, ts HAVING count() > 1 조회 · 장애 주입 후 반복 · EXP-13 · 16 | ING-04 · ING-05 | F-02 · F-10 | 해당 없음 |
| **REQ-NFR-03** | E2E 지연(ingested_at − ts) p50 · p95 · p99 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) M 티어 p95 1.5초 이하. S2에서 기준선으로 기록(판정 아님)하고 S5에서 판정한다. **S2 기준선 p50 608 · p95 1,011 · p99 1,013 ms**(기록 012 · d32b09a · 부하 실험 · S · 스위치 기본값 · 모드 A · 폴링 시작 위상 고정) — 1 Hz 폴링과 창 W 1초에서 설비별 E2E가 오프셋(1,000 − 오프셋 + 유예 100 ms + 삽입(약 10 ms))으로 정해진 값이다. 모드 D 백필 행은 집계에서 뺀다 | 원본 architecture.md §16 · 원본 data_flow.md §15 · REQ-GLB-01 | 로컬 루프백 경로라 값이 **낙관적**으로 나온다 — 망 지연을 가산하지 않고 원본 목표와 비교하면 과대평가한다 | ClickHouse 분위수 쿼리(ts > now() − 5분) · OBS-04 게이지 · EXP-30 | OBS-04 · ING-03 | F-01 · F-02 | 해당 없음 |
| **REQ-NFR-04** | 구간별 지연 예산 p95 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정): 신호 생성 → 레지스터 2 ms · Modbus 왕복 30 ms · 디코딩 + 품질 5 ms · MessagePack 3 ms · XADD 3 ms · **Stream 대기 400 ms(지배 구간)** · ClickHouse INSERT 250 ms · MV 캐스케이드 100 ms. **알람 판정 구간은 원본 예산에 없다 — 신설 · 미확인.** S2 구간 기록(p50 · 서브 ms 구간의 p95는 버킷 보간 왜곡이라 참고) — #2 Modbus 왕복 1.49 · 6a Stream 체류 0.55 · 6b 디코딩 0.73 · **6c fan-in 대기 575**(버킷 보간 — 평균 약 600 ms(설계값 600)) · #7 INSERT 10.7 ms(기록 012 · d32b09a · 부하 실험 · S · 스위치 기본값) — 지배 구간은 6c다 | 원본 data_flow.md §15 · 원본 implementation_plan.md §7.3 · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) | 알람 판정 구간을 예산에 넣지 않으면 S7에서 E2E가 늘어도 어느 구간 탓인지 가를 자리가 없다. 지배 구간(Stream 대기)을 모르고 삽입을 튜닝하면 E2E가 줄지 않는다 | 구간별 히스토그램(Modbus 왕복 · Stream 대기 · 삽입 · 판정) · EXP-30 | COL-02 · COL-07 · ING-02 · ING-03 · ING-09 | F-01 · F-02 · F-06 · F-08 | 해당 없음 |
| **REQ-NFR-05** | 정상 상태 컨슈머 랙 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) M 티어 5,000 엔트리 이하. 5분 지속 증가를 경고로 본다(현행 알림 규칙 · 소유 [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md)) | 원본 architecture.md §14 · §16 | 랙 상한이 없으면 적재가 생성을 못 따라가는 상태를 "아직 소진 중"으로 무기한 넘긴다 | consumer_lag 시계열 · 정상 상태 구간의 최대값 · EXP-22 · 34 | ING-01 · ING-07 | F-02 | 해당 없음 |
| **REQ-NFR-06** | 수집 처리량과 변곡점 — 시스템이 무손실을 유지하며 받는 최대 pps와 성능이 꺾이는 지점. **원본 목표 없음 — 산출물이다.** 미확인 — 확정 전 임의 값 고정 금지. 한 번에 한 주입 모드(REQ-GEN-05) · 생성기 비포화 구간(REQ-GEN-13)에서만 잰다 | 원본 implementation_plan.md §5 S5 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) S5 합격 판정 | 모드를 섞거나 생성기 포화 구간을 넣으면 변곡점이 병목 계층이 아니라 **측정 도구의 한계**를 가리킨다 | 부하 시나리오 Ramp-up · Breakpoint · 모드별 pps 대 consumer_lag · E2E 곡선 · EXP-23 · 26 | GEN-06 · GEN-07 · ING-01 | F-02 · F-09 | 해당 없음 |
| **REQ-NFR-16** | ClickHouse 중단 후 소진 시간 — 랙이 0으로 돌아오는 시간. **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 중단 시간의 30% 이내. 무손실 · 무중복(REQ-NFR-01 · 02)과 함께 판정한다 | 원본 data_flow.md §12.3 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) | 소진 시간만 보고 무중복을 보지 않으면 멱등 실패로 빨리 끝난 소진을 합격으로 판정한다 | docker stop clickhouse 5분 → 복구 후 소진 시간 · 무손실 · 무중복 · EXP-16 | ING-13 | F-10 | 해당 없음 |
| **REQ-NFR-17** | 생성기 단독 처리량 — **M 티어 초당 포인트의 3배 이상**이 판정 조건(배수는 원본 판정 규칙). **이 머신의 실측값 — 워커 1 약 590만 · 워커 2 약 1,031만 · 워커 4 약 2,006만 pps(api 위치 0-4 · 중앙값 · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값) — 판정 성립.** 원본 목표(4 vCPU 가정) 30,000 pps. 원본 예상치: 20 스레드 머신에서 미달 가능성 낮음 | 원본 data_flow.md §11.1 · 원본 implementation_plan.md §5 S1 · [06_datagen.md](./06_datagen.md) REQ-GEN-12 | 3배 여유를 확인하지 않고 부하를 걸면 REQ-NFR-06의 변곡점이 생성기 포화점일 수 있다 | 워커 수별 단독 처리량 3회 중앙값 · EXP-21 | GEN-09 | F-09 | 해당 없음 |

- **REQ-NFR-16 · 17은 파이프라인 표에 둔다.** 번호는 채번 순서이고 표 배치는 주제다 — 번호를 옮기지 않는다([../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) 재배치 금지).

## 비기능 요구사항 — 조회 · 실시간 · 런타임 (REQ-NFR)

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-NFR-07** | 최신값 조회 p95 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 10 ms 이하(구간 예산 5 ms). SW-02 on/off 각각을 S2에서 기록한다 — 원본 예상치 off 30~150 ms · on 0.3~1 ms. **S2 기록 p95 on 2.30 · off 6.50 ms · p50 on 1.52 · off 5.26 ms(k6 클라이언트 분위수 — 서버 히스토그램은 버킷 보간이라 비와 방향만 인용: p95 비 약 2.7배)**(기록 013 · d32b09a · 부하 실험 · S 부분 구성(설비 1 · 태그 8) · SW-02 on/off · 100 req/s) — 슬라이스는 argMax가 읽는 행이 적어 off가 원본 예상치보다 작다 · M 재측정은 S5 | 원본 architecture.md §16 · 원본 data_flow.md §15 · 원본 implementation_plan.md §4.1 | on만 재면 Redis 기여분을 분리할 수 없다 — off 수치가 없는 on 수치는 "원래 빠르다"와 구별되지 않는다 | k6 최신값 시나리오 × SW-02 on/off · EXP-07 | RLT-01 · RLT-02 | F-03 | 해당 없음 |
| **REQ-NFR-08** | 시계열 조회 p95 — 캐시 히트 · 1일 범위 캐시 미스 각각 **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 히트 20 ms 이하 · 미스 300 ms 이하. SW-03 on/off로 가른다 — 원본 예상치 히트 시 250 ms → 15 ms | 원본 architecture.md §16 · 원본 data_flow.md §15 · 원본 implementation_plan.md §4.1 | 히트와 미스를 한 분포로 재면 히트율이 바뀔 때 p95가 움직여 캐시 효과와 쿼리 성능을 가를 수 없다 | k6 반복 조회 · 신규 범위 조회 분리 × SW-03 on/off · EXP-08 | TSQ-01 · TSQ-04 | F-04 | 해당 없음 |
| **REQ-NFR-09** | 업무 데이터 CRUD p95 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 100 ms 이하(구간 예산 80 ms). S7에서 수집 부하와 동시에 잰다 | 원본 architecture.md §16 · 원본 data_flow.md §15 | 수집 부하 없이 재면 같은 이벤트 루프 · 같은 머신을 나눠 쓰는 조건이 빠져 분기 ③계층의 격리 효과를 보일 수 없다 | k6 CRUD 시나리오 · 수집 부하 on/off 대조 · EXP-36 | WRK-01 · MST-04 | F-05 | 해당 없음 |
| **REQ-NFR-10** | 반복 조회 캐시 히트율 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 80% 이상. SW-04 off에서 0에 수렴함을 실측으로 기록한다 — 원본 예상치 약 0% → 80% 이상 | 원본 architecture.md §16 · 원본 implementation_plan.md §4.1 · S4 합격 판정 | 히트율을 keyspace 전체로 재면 rl · auth 키 조회가 섞여 조회 캐시의 히트율이 아니다 | cache:q 접두 기준 히트 · 미스 계수 × SW-04 on/off · EXP-09 | TSQ-03 · TSQ-04 | F-04 | 해당 없음 |
| **REQ-NFR-11** | API 오류율 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 0.1% 미만. 설계된 거절(datagen.stream_full/503 · common.rate_limited/429)은 오류율이 아니라 별도 계수로 센다 | 원본 architecture.md §16 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) HTTP 상태 규약 | 설계된 거절을 오류율에 넣으면 백프레셔가 제대로 동작할수록 오류율이 나빠져 **안전장치가 실패로 기록된다** | k6 · /metrics 상태 코드별 계수 · 5xx 중 503 코드별 분리 · EXP-22 · 37 | OBS-01 · GEN-07 | F-03 · F-04 · F-05 | datagen.stream_full/503 · common.rate_limited/429 |
| **REQ-NFR-12** | WebSocket 동시 연결 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 500 이상. SW-07 on/off의 프레임 수를 함께 기록한다 — 원본 예상치 초당 5,000 → 10 프레임(태그 500 · 10 Hz) | 원본 architecture.md §16 · 원본 implementation_plan.md §4.1 · 원본 data_flow.md §16 F-07 | 연결 수만 재고 프레임 수 · 이벤트 루프 지연을 재지 않으면 연결은 유지되는데 화면이 늦는 상태를 합격으로 판정한다 | k6 ws 시나리오 · 연결 수 · 프레임 수 · nodejs_eventloop_lag_p95_seconds · EXP-12 | RLT-05 · RLT-06 | F-07 | 해당 없음 |
| **REQ-NFR-15** | api 이벤트 루프 지연 p95 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 100 ms를 넘으면 역할 분리(확장 로드맵 1단계) 진입 조건. 수집 부하 단계별로 조회 p95와 상관을 기록한다 | 원본 architecture.md §19 · 원본 data_flow.md §15 · §16 · REQ-GLB-20 · 22 | 이벤트 루프 지연을 재지 않으면 역할 분리의 진입 조건을 추측으로 판단하게 된다 — REQ-GLB-22 위반 | nodejs_eventloop_lag_p95_seconds × 수집 부하 단계 · EXP-27 | OBS-01 | F-02 · F-04 · F-07 | 해당 없음 |

## 비기능 요구사항 — 저장 (REQ-NFR)

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-NFR-13** | ClickHouse 활성 파트 수 — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 100 이하 유지. 배치 트리거 세 안(보정 7.1)의 파트 생성률을 S3에서 비교 기록한다 | 원본 architecture.md §16 · 원본 implementation_plan.md §7.1 · [07_ingest.md](./07_ingest.md) REQ-ING-04 | 파트 수를 재지 않으면 too many parts 오류가 나서야 배치 정책의 결함을 안다 | system.parts 활성 파트 수 시계열 × 배치 안 A · B · C · EXP-34 · 25 | ING-02 · ING-03 | F-02 | 해당 없음 |
| **REQ-NFR-14** | 디스크 압축률(data_uncompressed_bytes 대비) — **미확인 — 확정 전 임의 값 고정 금지.** 원본 목표(4 vCPU 가정) 8배 이상. **혼합 프로파일과 RANDOM_WALK 두 가지로 각각 재고 보수적인 쪽을 용량 계획에 쓴다.** 원본 예상치: STEP · BINARY · COUNTER 20~50배 · SINE 5~12배 · RANDOM_WALK 2~4배 · 혼합 8~15배. SW-10 off로 잰다 | 원본 architecture.md §16 · 원본 data_flow.md §11.2 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #5 | 혼합 프로파일 하나로 재면 최악의 경우(RANDOM_WALK)를 모른 채 디스크를 산정한다. 데드밴드를 켜고 재면 압축률이 아니라 행 감축이 섞인다 | system.parts 압축 전후 바이트 × 프로파일별 · EXP-35 | GEN-01 · ING-03 | F-02 · F-09 | 해당 없음 |
| **REQ-NFR-18** | 대조군 쿼리별 역전 지점 — 동일 쿼리 5종 × 용량 단계에서 ClickHouse와 PostgreSQL 대조군의 지연이 역전되는 행 수(또는 역전 없음). **원본 목표 없음 — 산출물이다.** 두 저장소 행 수 정확 일치 구간에서만 잰다 | D-05 · D-12 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) · [07_ingest.md](./07_ingest.md) REQ-ING-15 | 행 수가 어긋난 구간을 넣으면 역전 지점이 저장소 차이가 아니라 **데이터 차이**를 가리킨다. 목표치를 먼저 박으면 산출물이 가설 확인으로 퇴화한다 | 쿼리 5종 × 용량 단계 × 저장소 2의 지연 3회 중앙값 · EXP-01~05(대조군 쿼리 5종) | ING-11 · GEN-10 | F-02 · F-09 | 해당 없음 |

### 검산

- 파이프라인 8(01 · 02 · 03 · 04 · 05 · 06 · 16 · 17) + 조회 · 실시간 · 런타임 7(07 · 08 · 09 · 10 · 11 · 12 · 15) + 저장 3(13 · 14 · 18) = **18**
- REQ-NFR 채번 = 01~18 = **18** · 원본 목표가 있는 행 = 18 − 2(06 · 18 — 산출물) = **16**
- **원본 목표가 수치로 박힌 행에 확정 값은 0개다.** 확정은 W6이 채번한 실험의 실측 결과로만 한다.

## 학습 단계별 적용

REQ-NFR이 어느 학습 단계의 합격 판정에 들어가는지 가른다. 단계 범위와 판정 문장의 정본은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md), 인수 기준 AC-NN은 [14_acceptance_criteria.md](./14_acceptance_criteria.md)다.

| 단계 | 기준선으로 기록(판정 아님) | 판정 | 비고 |
|------|------|------|------|
| S1 | 해당 없음 | REQ-NFR-17 | 판정보다 기준선 확보가 목적 |
| S2 | REQ-NFR-03 · 07 | REQ-NFR-01 | 이 단계의 수치는 전부 기준선 |
| S3 | REQ-NFR-13(배치 세 안 비교) | REQ-NFR-01 · 02 · 05 | S 티어 |
| S4 | 해당 없음 | REQ-NFR-08 · 10 | SW-04 off 수렴 기록 |
| S5 | 해당 없음 | REQ-NFR-03 · 04 · 06 · 09 · 11 · 12 · 14 · 18 | 성능 목표표 각 행에 실측값 기입 |
| S6 | 해당 없음 | REQ-NFR-01 · 02 · 16 | 장애 주입 후 |
| S7 | REQ-NFR-15 | REQ-NFR-09 | 수집 부하와 동시 |

- 검산: 한 번 이상 등장하는 REQ-NFR = 01 · 02 · 03 · 04 · 05 · 06 · 07 · 08 · 09 · 10 · 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18 = **18** · 단계에 걸리지 않는 REQ-NFR **0**

## 기술 운영 요구사항 — 실행 환경 (REQ-TEC)

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-TEC-01** | 로컬 머신 1대에서 Docker Compose 컨테이너 4개(api 1 + postgres · clickhouse · redis)와 호스트 프로세스 웹(Next.js 개발 서버)으로 실행한다. 데이터 평면은 api 컨테이너 안 모듈이며 기동 범위는 APP_ROLE(기본 all)로 정한다. 관측 스택은 observability 프로파일로만 띄운다 | D-02 · 원본 architecture.md §3 · 원본 tech_stack.md §10.1 | 웹을 컨테이너로 넣으면 HMR이 느려지고, 관측 스택을 기본 기동에 넣으면 측정 대상과 CPU를 나눠 정밀 측정 세션 수치가 흔들린다 | docker compose ps 기본 기동 = 4 · 호스트 웹 프로세스 확인 | OBS-01 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-02** | 호스트 publish는 전부 **127.0.0.1**에 바인드한다 — 웹 3001 · api 3000 · postgres 5432 · clickhouse 8123 · 9000 · 9363 · redis 6379 · (프로파일) prometheus 9090 · grafana 3002. PlcSim 5020~5119는 publish하지 않는다. 포트 충돌 시 호스트 쪽 포트만 바꾸고 컨테이너 내부 포트 · 서비스명은 유지한다. 앱은 ClickHouse HTTP 8123만 쓴다 | 원본 architecture.md §3 · 원본 tech_stack.md §10.4 · REQ-GLB-19 | 0.0.0.0 바인드는 같은 네트워크의 기기에 DB를 여는 것과 같다. 내부 포트를 바꾸면 서비스명 DNS 접속 설정이 전부 어긋난다. 앱이 9000을 쓰면 커넥션 수 해석에서 사람과 앱을 가를 수 없다 | Compose 포트 표기 전수의 127.0.0.1 접두 확인 · LAN 다른 기기에서 접속 실패 확인 | SIM-01 · AUT-07 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-03** | 저장소 3개에 healthcheck를 두고 api는 세 저장소가 healthy일 때만 뜬다. api의 healthcheck는 /api/v1/health이며 무인증이다 | 원본 architecture.md §3 기동 순서 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 | api가 먼저 뜨면 커넥션 오류로 재시작 루프를 돌고, 그 사이 Collector가 **불필요한 스풀 파일**을 만든다. health에 인증을 걸면 기동이 순환한다 | 기동 직후 spool_bytes 0 · depends_on 조건 확인 · 네 컨테이너 healthy | OBS-05 · COL-09 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-04** | 모든 이미지 · 런타임 · 핵심 라이브러리는 버전을 명시하고 latest를 쓰지 않는다. 착수 시점에 공식 릴리스 노트로 최신 안정 버전을 재확인해 고정표를 갱신한 뒤 고정한다. 호스트와 컨테이너의 Node를 같은 LTS 메이저로 맞춘다. 정확 버전의 정본은 [../09_tech_stack](../09_tech_stack/README.md) | 원본 tech_stack.md §12 · 원본 implementation_plan.md §2.1 · §9 | 버전이 흔들리면 성능 실험이 재현되지 않는다 — 같은 커밋 해시의 두 측정이 다른 엔진 버전에서 돈다 | Compose 이미지 태그 전수에 latest 부재 · 호스트 · 컨테이너 Node 메이저 대조 | 해당 없음 — 전 모듈 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-05** | 스키마는 순번 마이그레이션으로만 바꾼다 — PostgreSQL 마이그레이션과 ClickHouse DDL 순번 파일을 migrate 작업이 순서대로 적용하고, 그 뒤 seed가 사이트 · 라인 · 설비 · 태그 · 계정 · 역할을 넣는다. 스키마 소유권은 api(NestJS) 쪽에 둔다. 수동 DDL로 스키마를 바꾸지 않는다 | 원본 tech_stack.md §5.1 · §10.5 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) | 수동 DDL은 스냅샷 복원 · 새 환경에서 재현되지 않아 **같은 커밋에서 다른 스키마**로 측정한다 | 빈 볼륨에서 migrate → seed 후 스키마 대조 · 마이그레이션 이력 테이블 조회 | MST-01 · AUT-01 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-06** | 볼륨은 named volume 4개(pgdata · chdata · redisdata · spooldata)이며 호스트 디렉터리를 마운트하지 않는다. Redis는 appendonly로 미소비 Stream 엔트리를 재기동 뒤에도 보존한다 | 원본 architecture.md §3 · 원본 tech_stack.md §10.3 | bind mount는 Docker Desktop 파일 공유 계층을 거쳐 DB 랜덤 I/O가 느려져 **디스크 계층 수치가 측정 대상이 아닌 계층을 잰다.** AOF가 없으면 api 재기동 때 PEL · 미소비 엔트리가 사라진다 | Compose 볼륨 선언 대조 · api 재기동 후 XPENDING 보존 확인 | ING-06 · COL-09 | F-10 | 해당 없음 |
| **REQ-TEC-07** | 컨테이너 메모리 상한을 Compose 리소스 제한으로 반드시 고정한다. 프로파일은 부하 실험(기본 · 성능 측정 전용)과 개발(기능 검증 · 티어 S 전용) 2개이며 중간 프로파일은 WSL2 메모리 조정이 불가능할 때만 쓰는 조건부 대안이다. **개발 · 중간 프로파일 수치를 REQ-NFR과 비교하지 않는다.** 상한 값은 2계층 조정값(소유 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)) | 원본 architecture.md §13 · 원본 implementation_plan.md §2.2 · §2.3 | 상한이 없으면 ClickHouse가 페이지 캐시를 점유하다 PostgreSQL OOM을 유발한다. 중간 프로파일에서는 축출 연쇄가 기본 구성에서 자연 발생해, 그 수치를 목표와 비교하면 **캐시 히트율 미달이 설계 결함으로 오독**된다 | docker stats로 상한 적용 확인(S0 합격 판정) · 측정 기록의 프로파일 칸 | OBS-02 | 해당 없음 — 구성 | 해당 없음 |

## 기술 운영 요구사항 — 재현성과 측정 (REQ-TEC)

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-TEC-08** | 실험 전 볼륨 스냅샷 · 실험 후 복원을 작업(snapshot · restore)으로 둔다 — 컨테이너 정지 → 볼륨별 아카이브 → 복원은 역방향. 볼륨을 지우는 정지 명령은 스냅샷 뒤에만 쓴다. Redis는 따로 백업하지 않는다 | 원본 architecture.md §3 · §18 백업 · 원본 tech_stack.md §10.3 · §10.5 · REQ-GLB-23 | 복원 없이 연속 실험하면 TTL과 머지가 진행된 데이터 위에 부하를 걸어 **직전 실험의 파트 · 캐시 상태가 결과에 섞인다** | 측정 기록의 스냅샷 이름 · 복원 여부 칸 · 복원 후 tag_raw count 대조 | 해당 없음 — 실험 절차 | 해당 없음 — 절차 | 해당 없음 |
| **REQ-TEC-09** | 부하 실험 시작 전 캐시 계열 키(cache · lock)를 비우고 봉인 계열(Stream · 최신값)은 유지하며, 유휴 기준선을 관측한 뒤 부하를 건다. 부하 종료 후 회복(랙 소진 · 파트 병합)을 관측하고 정합성(REQ-NFR-01)을 검증한 뒤 수치를 기록한다 | 원본 data_flow.md §11.3 | 이전 실험의 캐시가 남으면 첫 요청부터 히트해 캐시 미스 p95가 비어 있다. 회복을 보지 않고 끝내면 소진되지 않은 적체를 무손실로 오판한다 | 실험 시작 시점 cache 접두 키 수 0 · 기록에 기준선 · 회복 구간 존재 | 해당 없음 — 실험 절차 | F-09 | 해당 없음 |
| **REQ-TEC-10** | 모든 측정 수치에 **커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태** 4요소를 병기한다. 스위치는 바꾼 것만 명시하고 나머지는 "기본값"으로 적을 수 있다. 주입 모드 · 시드 · 관측 스택 on/off · 생성기 CPU를 조건 칸에 함께 적는다. 기록 형식의 정본은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) | D-10 · 원본 implementation_plan.md §8 · REQ-GLB-17 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 공통 규칙 | 넷 중 하나만 달라도 비교가 무의미한데, 빠진 요소는 사후에 복원할 수 없다 — SW-10이 빠지면 행 수가 다른 두 측정이 같은 실험으로 묶인다 | docs/measurements 기록 머리의 4요소 · 조건 칸 전수 대조 | OBS-06 | 해당 없음 — 절차 | 해당 없음 |
| **REQ-TEC-11** | 같은 실험을 **3회 실행해 중앙값**을 쓰고 최대 · 최소 편차가 기준을 넘으면 폐기하고 조건을 다시 잡는다. 편차 기준은 2계층 조정값(현행 참고 20% · 소유 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)). 기록은 사후에 고치지 않고 정정 기록을 새 번호로 쓴다 | D-10 · 원본 implementation_plan.md §2.4 · §8 · [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) 측정 기록 파일명 | P · E 코어 혼합과 WSL2 vCPU 매핑 불확실성으로 실행 간 분산이 생겨 **단일 실행 수치는 재현되지 않는다** | 기록의 3회 값 · 편차 칸 존재 · 폐기 기록 존재 여부 | 해당 없음 — 실험 절차 | 해당 없음 — 절차 | 해당 없음 |
| **REQ-TEC-12** | 정밀 측정 세션은 observability 프로파일을 끄고 /metrics를 낮은 주기로 직접 덤프한다. 부하 생성기(k6 · 생성기)의 CPU 사용률을 함께 기록하고 부하 생성기가 포화되지 않은 구간만 신뢰한다. 관측 프로파일을 켠 탐색 수치는 상대 비교용이다 | 원본 architecture.md §14 · 원본 tech_stack.md §10.6 · REQ-GEN-13 | 관측 스택을 켠 채 정밀 측정하면 측정 도구가 측정 대상과 CPU를 나눠 절대값이 흔들린다 | 기록의 관측 스택 칸 · 부하 생성기 CPU 칸 | OBS-01 · GEN-09 | 해당 없음 — 절차 | 해당 없음 |
| **REQ-TEC-13** | 부하 생성기와 측정 대상의 CPU 집합을 cpuset · taskset으로 가르는 배치 계획을 착수 전에 세우고, 부하 실험에서 그 배치를 쓴다. 배치 값은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) 소유 | 원본 implementation_plan.md §2.4 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 착수 체크리스트 6 | cpuset 없이 S5에 들어가면 부하 생성기와 측정 대상의 CPU가 겹친 채 기준선이 잡혀 이후 모든 비교가 그 오염을 물려받는다 | Compose cpuset 표기 · k6 taskset 기록 | 해당 없음 — 구성 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-14** | .env 등 비밀이 든 파일을 Git에 커밋하지 않는다. ClickHouse Dictionary 소스는 전용 읽기 계정을 쓴다 | 원본 architecture.md §7.4 · §18 · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) | .env가 커밋되면 로컬 전용이라도 저장소 사본 · 스냅샷 공유로 비밀이 퍼진다 | git 추적 파일에서 .env 부재 · Dictionary 소스 계정 권한 조회 | MST-09 | 해당 없음 — 구성 | 해당 없음 |
| **REQ-TEC-15** | 부하 실험 중에는 api 재빌드 · 재기동을 하지 않는다. 실험 밖 재빌드로 생긴 결측 구간은 재빌드 흔적으로 기록하고 재기동 시간 · 결측 구간 길이를 잰다 | 원본 architecture.md §17 단일 컨테이너의 대가 · 원본 data_flow.md §12.4 · [05_plc_sim.md](./05_plc_sim.md) REQ-SIM-12 | 실험 중 재빌드하면 수집 · 적재 · 조회가 함께 멈춰 그 실험의 무손실 · 지연 판정이 전부 무효가 된다 | 실험 구간의 api 컨테이너 재시작 횟수 0 · 기록의 재빌드 여부 칸 | SIM-01 · COL-02 | F-10 | 해당 없음 |

### 검산

- 실행 환경 7(01~07) + 재현성과 측정 8(08~15) = **15**
- REQ-TEC 채번 = 01~15 = **15**

## 로컬 측정 한계와 해석

REQ-NFR을 판정할 때 수치를 어떻게 읽어야 하는지 고정한다. 한계 전수의 정본은 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md)다.

| 한계 | 걸리는 REQ | 해석 규칙 |
|------|------|------|
| 부하 생성기가 대상과 같은 머신 | REQ-NFR-06 · 11 · 12 | 생성기 비포화 구간만 신뢰(REQ-TEC-12) · cpuset으로 완화(REQ-TEC-13) |
| 전 구간 루프백 · Docker 브리지 | REQ-NFR-03 · 04 · 07 | 지연이 낙관적 — 망 지연을 가산해 해석 |
| 디스크 IOPS를 조정할 수 없음 | REQ-NFR-13 · 14 · 16 | 디스크는 상수 · 배치 크기와 머지 설정만 변수 |
| 수평 확장이 같은 CPU를 나눠 씀 | REQ-NFR-15 | 확장 실험의 목표는 처리량이 아니라 동작 검증 |
| 병목 방향이 원본 가정과 반대(CPU 과잉 · 메모리 부족) | 전 REQ-NFR | 원본 목표를 합격선으로 쓰지 않는다 — 첫 실측을 기준선으로 |

- 검산: 한계 = **5**행

## 에러 코드

이 문서가 인용하는 코드는 오류율 산정에서 **빼는** 설계된 거절 두 개뿐이다(REQ-NFR-11).

| 코드 | 인용 REQ | 산정 규칙 |
|------|------|------|
| datagen.stream_full/503 | REQ-NFR-11 | 오류율 밖 — 거절 수로 따로 센다 |
| common.rate_limited/429 | REQ-NFR-11 | 오류율 밖 — 한도 초과 수로 따로 센다 |

- 검산: 인용 코드 **2** · 채번 제안 **0**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| REQ-NFR 18행 전부의 확정 값 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지 · REQ-NFR-17은 S1에서 닫힘(기록 006) · REQ-NFR-03 · 04 · 07은 S2 기준선 기록(012 · 013 — 목표 판정은 S5) | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) EXP-NN(§REQ-NFR → EXP 대응 검산 · 18행 전부 대응) · 실측 기록 |
| 알람 판정 구간의 지연 예산 | **신설 · 미확인** — 원본 예산표에 구간이 없다(원본 implementation_plan.md §7.3) · 구간 정의는 W3 완료 · 값은 EXP-30 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) §알람 판정 구간 — 신설 |
| 설계된 거절을 뺀 오류율의 메트릭 산정 | **W6 판정** — http_designed_rejections_total + 파생 지표 API 오류율(설계 거절 제외) | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 중간 프로파일의 정식 채택 여부 | **W6 판정** — 정식 채택하지 않는다 · 조건부 대안 — WSL2 메모리 조정이 불가능할 때만 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| 관측 스택 구성원(prometheus · grafana · alertmanager · tempo) | **W6 판정** — 구성원 prometheus · grafana 2 · alertmanager 채택하지 않음(수신처 없음 · D-02) · tempo 현 범위 밖 · 조건부 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| 롤업 대 원시 비교 허용 범위 | avg는 abs(avg(원시) − avgMerge(롤업)) ≤ 2·γ(n)·S/n 상계(1계층 구조값)로 판정됐고 count · min · max · last는 정확 일치다 · **p95(TDigest) 근사 허용 범위만 미확인** | [14_acceptance_criteria.md](./14_acceptance_criteria.md)(W2b) |

## 관련 문서

- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-17 측정 기록 · REQ-GLB-19 로컬 전용 · REQ-GLB-22 실측 후 분리 · REQ-GLB-23 실험 초기 상태
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 단계별 인수 기준
- [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) — 학습 단계와 합격 판정
- [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) — 구간별 지연 예산 기전
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 기록 형식 · 편차 기준
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — EXP 채번 정본
- [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) — 메모리 프로파일 · 실측 환경
