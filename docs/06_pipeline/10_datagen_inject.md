# F-09 테스트 데이터 주입 (10_datagen_inject)

> **대상**: F-09 주입 흐름의 기전 정본 — 생성 엔진 → 모드 A~D · 한 번에 한 계층 원칙 · 모드 A 레지스터 갱신 · **모드 B 적체 검사 기전(판정량은 그룹 적체)** · 모드 C 표면 · 모드 D 백필 실행 · **모드 D 대조군 동일 행 절차** · 대조군 파티션 정리 · **SIM 지연 · 오류 주입 제어 수단** · 티어 시드 구성 · 생성기 포화 · 부하 실행 절차 · **라이브 실행 두 종류(perf · flow)의 단계 · 취소 · 정리 · 생성 규칙 · 흐름 시연의 조회 섞기**
> **작성일**: 2026-09-24
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9) — §흐름 시연 실행에 **조회 섞기** 신설(매개변수 readsPerSec 0 · 5 · 20 · 50 · 기본 20 · 조회 3종 센서 시계열 · 센서 지금 값 · 업무 설비 목록을 프로세스 안 호출로 · cache-aside 경로 그대로 · 히트와 미스가 둘 다 생기는 키 선택 · 실패는 세기만 · 결과 readsSent · 코드 기준 apps/api/src/modules/runs/flow-runner.ts — 리드 판정 2026-10-03) · 발행 규칙 6 → **9**(조회 섞기 — 일정대로 보내고 기다리지 않음 · 순환 2 : 2 : 1 · 동시 상한 32 · 조회 키 선택 · 조회 계수 — publish detail readsSent · readsFailed · readsSkipped) · **A형 — 조회를 대기줄에 넣지 않는 이유** · 단계 publish에 조회 · 취소 표 flow publish 행에 조회 정지 — 단계 · 주입 모드 수 불변
> **개정일**: 2026-09-28 — 코드 검수 반영(r-code-api L5) — 흐름 시연 대용량 발행에 태그 수 가드(⌈pps ÷ L⌉ > 1000이면 prepare failed · 시연 전용 행 명령 전)
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 흐름 시연 업무 명령 이름 토글 짝(운영 설비 이름을 바꿨다 되돌림 — 중단 · 되돌림 실패 · 짝 가운데 재기동에서 되돌림 보장 자리가 없다) → **시연 전용 설비 DEMO-FLOW-DEV에만 새 이름 명령**(사이트 DEMO-FLOW · 라인 DEMO-FLOW-L · 설비 비활성 · 태그 없음 · prepare가 없으면 명령으로 만든다 · 되돌림 없음 · 운영 행 불변 · 명령 1건 = 1) · §시연 전용 행 신설 · perf 생성 식 고정(행 번호 n · ts 오름차순 삽입 · 두 저장소 같은 식) · 규모 증가분 구간 k = 5는 [S, S + 10초) · flow 발행 식 고정((태그 · ts) 중복 없음) · 종결 규칙(정상 경로 cleanup 실패 → failed · cleanup 중 stop 무시 · flow prepare 중 stop → stopped) · perf 전용 PostgreSQL 연결 1(pg_backend_pid) · 취소 표 단계 5 → **6**(flow prepare) · 관련 문서 GEN-01~10 → **GEN-01~12**
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27) — 모드 D 일 단위 반복 KST 일 → **UTC 일(파티션 경계)** · 대조군 정리 기준 KST 일 파티션 → **UTC 날짜 일 파티션** · 정리 시점 KST 자정 뒤 → **UTC 자정(= 09:00 KST) 뒤** — 단계 · 행 수 불변
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정 — 시작 · 중단 · 완료 · 소요 시간) — §라이브 실행 — perf · flow 신설(실행 주체 RunControlModule · 동시 1 · 상태 5 · 단계 6 상태 · 중단 · 실패 · api 재기동 · 성능 비교 실행의 생성 규칙 · 단계 · 흐름 시연 실행의 발행 · 업무 명령 · 드레인 · 단계별 취소 수단) · §한 번에 한 계층 조합 5 → **6**(라이브 실행 + 부하 실험) · 미확인 등재 2행 신설 — 주입 모드 수 불변(라이브 실행은 주입 모드가 아니다)
> **개정일**: 2026-09-25 — S3 구현 반영 — 모드 B를 S5 → **S3 최소분**으로 당김(EXP-13 · 19 · 31 · 34 · AC-12 · 20이 요구) · as-built 불릿 신설(단독 진입점 · 1초 격자 · pps ÷ 태그 = 1,000의 약수 · 묶음 파이프라인 XADD × n + XINFO 1 · 해독 불가 혼합 형식)
> **개정일**: 2026-09-25 — S2 코드 판정 반영(fe64472 · 시작 위상 짝은 d32b09a) — 모드 A 레지스터 갱신에 시점 격자 행 신설(k = floor(now ÷ scan_rate_ms) · 벽시계 기준 — 02_collect 시작 위상의 짝 계약) — 항목 5 → **6**
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — 미확인 "생성기 단독 처리량" 미확인 → **워커 1 약 590만 pps**
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 주입 계획 노출 이름 미정 → W6 판정 반영 · bulk 본문 모양 행 닫힘(07_api/09)
> **개정일**: 2026-09-24 — W7 검수 반영 — 부하 절차 5단계 판정량의 산출식 "W6 확정 대상" → **닫힘**(consumer_lag = 그룹 lag + pending · 정본 10_observability/01)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · EXP 번호 · 디스크 예산 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 주입 계획 파일 형식 → JSON + zod 검증 · infra/sim-plans · SIM_FAULT_PLAN(정본 09_tech_stack/05 · 04) · 노출 필드 이름만 미정
> **원천**: 원본 data_flow.md §11 · §11.1 · §11.2 · §11.3 · §10.3 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3 · §11 · §17(커밋 ff66a37) · 원본 tech_stack.md §3.4(커밋 ff66a37) · docs_plan.md 웨이브 인계 W4 06_pipeline/10 행 전부 · SIM 지연 · 오류 주입 제어 수단 · D-05 · D-12 · ADR-17 · ADR-19 · ADR-21 · ADR-22 · ADR-23 · REQ-GEN-01~15 · REQ-SIM-08~11 · REQ-GLB-10 · 18 · 23 · REQ-TEC-08~13 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) §대조군 보존 정합 · [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) 티어 · 라이브 실행 제어 리드 판정(2026-09-28) · [../07_api/09_datagen.md](../07_api/09_datagen.md) #2~#5 · [07_business_crud.md](./07_business_crud.md) §업무 명령 경로 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §실행 수명 객체

F-09는 **생성기가 만든 값이 네 계층 중 하나에 들어가기까지**다. 주입 모드는 넷이고 각 모드는 다른 계층부터 부하를 준다 — A는 Modbus부터, B는 Stream부터, C는 HTTP 표면부터, D는 ClickHouse만. **측정 원칙은 한 번에 한 계층만 부하를 주는 것이다**(REQ-GEN-05) — 모드 A와 B를 동시에 돌리면 병목이 Modbus인지 적재인지 가를 수 없다.

생성기가 병목이면 측정 자체가 무의미하다. 생성기는 api 컨테이너의 CPU를 수집 · 적재와 나눠 쓰므로, 목표 부하의 3배를 만들 수 있는지 먼저 재고(REQ-GEN-12) 모든 부하 측정에 생성기 CPU를 함께 기록한다(REQ-GEN-13). 이 문서는 모드별 기전과 W2~W3이 넘긴 주입 쪽 미확인 다섯 건(모드 B 검사 · 모드 D 대조군 절차 · 대조군 정리 · SIM 주입 제어 · 티어 시드)을 닫는다.

## 생성 엔진에서 모드까지

원본 주입 흐름도(원본 data_flow.md §11)를 단계로 옮긴다.

```plain
① 설정        태그별 신호 프로파일(8종) · 난수 시드 · 용량 티어 · 주입 모드 1개 — 전부 측정 기록 조건
② 벡터 생성   worker_threads — Float64Array 태그 N × 시점 M(시드 고정이면 같은 행 집합)
③ 이상 주입   SPIKE 이상치 · DROPOUT은 행 생략(BAD를 달지 않는다)
④ 표지        모드 B · C · D 산출 행은 전부 SIMULATED(9) · 모드 A는 Collector가 설비 규칙으로 단다
⑤ 모드 분기   A 레지스터 Buffer 갱신 · B Stream XADD · C POST /api/v1/ingest/bulk · D ClickHouse 직접
```

- **DROPOUT은 BAD가 아니라 행 생략이다(W1 판정).** 품질 칸은 하나라 BAD를 달면 생성 데이터 표지 9가 지워진다 — 생성 데이터와 실데이터를 가를 방법이 사라진다(전역 불변식 생성 데이터 구분).
- **시드가 같으면 행 집합이 같다**(REQ-GEN-03). on/off 비교와 대조군 동일 행이 이 성질 위에 선다.
- 모드 A의 통신 장애 재현은 생성기가 아니라 SIM 주입(§SIM 주입 제어)이 한다 — Collector가 2 · 3을 판정한다.

## 주입 모드

| 모드 | 경로 | 측정할 수 있는 것 | 측정할 수 없는 것 | 백프레셔 검사 | 멱등 토큰 · 대조군 | APP_ROLE |
|:----:|------|------|------|------|------|------|
| A | 생성기 → SIM 레지스터 → Collector 폴링 → Stream | 진짜 E2E · Modbus 병목 | DB 상한 — Modbus가 먼저 막힌다 | Collector(COL-07) | 적용 · SW-09 적용 | collector(SIM · COL과 동거) |
| B | 생성기 → Stream XADD 직결 | Redis · Ingest · ClickHouse 상한 | Modbus · Collector | **모드 B 발행자 자신**(§모드 B 적체 검사) | 적용 · SW-09 적용 | datagen |
| C | 생성기 → bulk 표면 → Stream | API 처리량 · 인증 · 직렬화 비용 | 수집 계층 | bulk 표면(datagen.stream_full/503) | 적용 · SW-09 적용 | 수신 api · 발신 datagen |
| D | 생성기 → ClickHouse 직접(과거 구간) | 순수 삽입 성능 · 압축률 | 파이프라인 전체 | 없음 — Stream을 지나지 않는다 | **없음** — ING 우회 · 대조군은 GEN-10 | datagen |

- 검산: 모드 = **4** · Stream을 지나는 모드 3(A · B · C) · 멱등 토큰이 없는 모드 1(D)
- **발행 경로 셋(Collector · 모드 B · 모드 C)은 같은 페이로드 계약 · 같은 위험 임계를 쓴다**(REQ-GLB-21 · ADR-21). 검사하지 않는 발행자가 하나라도 있으면 그것이 "검사를 우회한 발행자"이고 MAXLEN 트리밍이 미소비 엔트리를 조용히 자른다.
- 모드 D 행은 ts가 과거라 E2E 창 밖에 떨어진다 — E2E 집계에서 빼는 규칙(REQ-GEN-11)이 창 조건으로 자동 성립한다([../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md)).

### 한 번에 한 계층

| 조합 | 판정 | 이유 |
|------|------|------|
| 모드 둘 이상 동시 | 금지 | 병목 계층을 가를 수 없다(원본 data_flow.md §11.1) |
| SW-01 off + 모드 B · C | 금지 | Stream을 끈 구성에 Stream 직결 주입 — 경로가 정의되지 않는다(조합 제약 #2) |
| 모드 D + 정상 수집 | 금지 — 백필 ① 주입 정지 확인 | MV 분리 중 들어온 행은 롤업되지 않는다 |
| 모드 C 인증 비용 비교 | S7 이후 수치끼리만 | S5 모드 C에는 인증이 없다(REQ-GEN-15) |
| 생성기 포화 구간 | 버린다 | 생성기가 병목이면 대상 계층의 상한이 아니라 생성기 상한을 잰다 |
| 라이브 실행(perf · flow) + 부하 실험 · 대조 실험 | 금지 — 실험 착수 전 gen_run_active 전부 0 확인 | 라이브 실행은 api 안에서 저장소 · Stream에 부하를 더한다 — 실험 기록의 지연 · 처리량에 실행 부하가 섞인다(§라이브 실행 — perf · flow) |

- 검산: 조합 = **6**

## 모드 A 레지스터 갱신

| 항목 | 규칙 | 근거 |
|------|------|------|
| 갱신 주체 | GEN 모드 A가 같은 프로세스 안 호출로 SIM Buffer에 쓴다 | 수집 이전의 모사 구간 — Stream 경계 대상이 아니다(REQ-SIM-06) |
| 갱신 주기 | 태그 scan_rate_ms 이하 간격으로 벡터 한 시점씩 | 폴링보다 느리면 같은 값이 반복 수집된다 |
| **시점 격자** | 벡터 시점 k = floor(now ÷ scan_rate_ms) — 벽시계 epoch ms 기준 · 같은 k면 다시 쓰지 않는다 · 값은 (시드 · tag_id · k)로 정해진다(S2 구현 apps/api/src/modules/datagen/mode-a/register-writer.ts · 틱은 가장 짧은 scan_rate_ms ÷ 2) | 기동 시각 기준 카운터로 k를 세면 격자가 기동마다 달라져 Collector 시작 위상(벽시계 격자 + 설비별 오프셋 — [02_collect.md](./02_collect.md) §폴링과 레지스터 블록 병합)이 갱신 순간을 비키지 못하고, 같은 시드 2회 대조(REQ-SIM-06)가 같은 시점에 다른 값을 본다 |
| ts | 생성기 시각이 아니라 **Collector 폴링 시각**(요청 송신 직전) | 레지스터에 시각이 없다 — [02_collect.md](./02_collect.md) §모드 A ts 채취 시점 |
| 표지 | 생성기가 달지 않는다 — Collector가 루프백 설비 규칙으로 9 | REQ-GLB-18 |
| 배치 | SIM · COL과 같은 프로세스 · collector 역할 | 루프백 포트가 다른 컨테이너에서 닿지 않는다(ADR-22) |

- 검산: 항목 = **6**
- **모드 A의 E2E는 "신호 생성 → 레지스터 반영"(구간 #1)을 포함하지 않는다.** ts가 폴링 시각이기 때문이다 — 구간 #1은 생성기 히스토그램으로 따로 잰다.

## 모드 B 적체 검사

인계 "모드 B 길이 검사 기전(판정량은 그룹 적체)"을 닫는다. 요구 수준은 REQ-GEN-07이다 — XADD 전에 검사하고 위험 단계면 발행을 멈추고 멈춘 엔트리 수를 센다.

```plain
모드 B 발행 한 번(설비 × 시점 엔트리 묶음)
├─ 직전 파이프라인이 준 단계 = 위험 ──────────────── 이번 묶음을 발행하지 않는다 · 발행 중단 수 += 묶음 엔트리 수
│  └─ 적체 확인만 보낸다(XINFO GROUPS 단독) ───────────────────── 적체 < 주의 임계면 다음 묶음부터 재개
└─ 그 밖(정상 · 주의 · 경고)
   └─ 파이프라인 1회 = 묶음 XADD MAXLEN ~ + XINFO GROUPS ─────── 결과 적체로 다음 묶음의 단계 판정
      ├─ XADD 실패 ────────────────────────── 위험으로 간주 · 실패 엔트리를 발행 중단 수에 더한다
      └─ lag가 비는 응답 ───────────────────────────────────────────── 직전 단계 유지(ADR-21)
```

- **판정량은 그룹 lag + pending이고 XLEN이 아니다**(ADR-21). XLEN으로 검사하면 정상 운전의 확인된 엔트리가 MAXLEN까지 남아 모드 B가 적체 없이 멈춘다 — 원본 "스트림 길이 검사"는 이 판정으로 대체된다.
- **모드 B에는 스풀이 없다.** 생성 데이터는 다시 만들 수 있어 보관할 이유가 없다 — 멈춘 엔트리는 결측이 아니라 **생성했으나 발행하지 않은 수**로 세고 무손실 판정(REQ-NFR-01)이 생성 측에서 뺀다.
- **S3 as-built(모드 B 최소분 · GEN-06 당김)** — 진입점 dist/mode-b.js(Nest 밖 · datagen 프로파일 컨테이너 · cpuset 11-12)가 PostgreSQL 활성 태그를 읽어 티어 모양이 다르면 거부하고, 벽시계 1초 격자마다 그 초에서 끝나는 시점들을 만든다(가장 새 ts = 틱 시각 · 미래 ts 없음 · 초당 시점 수 = pps ÷ 태그 수는 1,000의 약수여야 한다 — 격자 ts를 정수 ms로 둔다). 발행은 묶음 하나를 파이프라인 한 번(XADD × n + XINFO GROUPS 1)으로 보내고 그 XINFO로 다음 묶음의 단계를 판정한다. XADD가 실패하면 위험으로 가고 실패 엔트리는 중단 수에 더한다. 끝나면 생성 · 발행 · 중단 · 해독 불가 주입 수를 JSON 한 줄로 낸다.
- **해독 불가 혼합(EXP-19 · AC-12)** — --undecodable-every N이면 정상 엔트리 N개마다 msgpack이 중간에 끊긴 바이트(0x81 0xa1 0x76) 하나를 **더** 끼운다 — 정상 엔트리를 대체하지 않아 정상분 AC-01 식이 그대로 선다.
- **재개 기준은 주의 임계다.** 위험 임계 바로 아래에서 재개하면 다음 묶음이 다시 임계를 넘어 발행 · 중단이 번갈아 든다 — 위험 단계의 하강 기준(ADR-23)과 같은 값이다. 주의 · 경고 단계의 반응(컨슈머 증설 · 데드밴드 강화)은 모드 B에 없다.
- **생성 시계는 멈추지 않는다.** 중단 동안의 시점은 발행되지 않은 채 지나간다 — 재개 뒤 ts는 현재 시각이다. 중단 구간을 뒤늦게 몰아 발행하면 STALE 판정 · E2E가 과거 시각으로 오염된다.

| 계측 | 뜻 | 쓰는 곳 |
|------|------|------|
| 발행 중단 수 | 위험 단계로 발행하지 않은 엔트리 · 행 수 | 무손실 판정의 생성 측 차감 · REQ-GEN-07 |
| 모드 B 단계 게이지 | 모드 B가 본 적체 단계 | Collector 단계와 같은 판정인지 대조 |
| 생성기 CPU | 생성 · 인코딩 스레드 사용률 | 포화 구간 폐기(REQ-GEN-13) |

- 검산: 계측 = **3** · 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다 — gen_publish_halted_entries_total · gen_publish_halted_points_total · backpressure_stage{publisher} · gen_worker_utilization(W6)

## 모드 C 표면

| 단계 | 동작 | 응답 | 근거 |
|------|------|------|------|
| ① 표면 활성 | 기본 비활성 · 환경변수 + 재기동으로만 켠다 | 꺼져 있으면 404 datagen.bulk_disabled | REQ-GEN-08 |
| ② 인증 · 한도 | S7부터 인증 · 역할 무관 · 레이트 리밋 | 401 · 429 | 상동 |
| ③ 본문 검증 | 요청 본문을 엔트리 계약으로 변환 · 스키마 버전 v | 400 common.validation_failed | REQ-GEN-09 |
| ④ 적체 검사 | 모드 B와 같은 판정량 · 같은 위험 임계 | 위험이면 503 datagen.stream_full | 상동 |
| ⑤ XADD | 받은 순간 Stream에 넣고 끝 | 성공 응답 — **XADD 뒤의 적재 실패를 응답에 싣지 않는다** | 상동 |

- 검산: 단계 = **5**
- **부하 도구는 503을 재시도로 덮지 않는다.** 거절 수가 곧 HTTP 경유 수집 상한의 신호다 — 재시도하면 백프레셔가 흡수한 양과 거절한 양을 가를 수 없다. 설계된 거절은 오류율이 아니라 별도 계수다(REQ-NFR-11).
- 본문 모양 · 표면 번호는 [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5)가 정한다. 에러 코드 datagen.stream_full의 발생 조건 서술("stream:plc:raw 길이")은 ADR-21 뒤 "미확인 적체"로 읽는다 — 정본 문구 갱신은 W4에서 반영했다.

## 모드 D 백필과 대조군 동일 행

모드 D는 ING를 우회해 ClickHouse에 직접 과거 구간을 채운다(GEN-08). 롤업 쪽 절차의 정본은 [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) §백필 절차이고 롤업 흐름과의 관계는 [09_rollup.md](./09_rollup.md) §백필과의 관계다. 인계 "모드 D 대조군 동일 행 절차"를 아래로 닫는다 — **판정: 한 실행에서 만든 같은 행 벡터를 날짜 단위로 두 저장소에 차례로 쓰고, 일마다 count 정확 일치를 확인한다.**

```plain
① 조건 확정       구간(원시 보존 창 안) · 태그 집합 · 시드 · 프로파일 — 측정 기록에 적는다
② 주입 정지 확인   다른 모드 · 정상 수집이 멈췄는가
③ DETACH          mv_tag_1m
④ 일 단위 반복     그 UTC 일(파티션 경계 · ADR-27)의 벡터 생성 → ClickHouse tag_raw INSERT → 대조군 COPY(전용 커넥션 · 트랜잭션 1)
⑤ 롤업 채우기      tag_1m INSERT SELECT -State(백필 구간) → 상위 MV 연쇄
⑥ ATTACH          mv_tag_1m
⑦ 대조            일마다 count(tag_raw) = count(대조군) = countMerge(tag_1m) — 정확 일치
⑧ 불일치 일        대조군 그 일 파티션을 비우고 같은 시드로 그 일을 다시 생성해 COPY → ⑦
```

- **한 벡터를 두 저장소에 쓰는 이유 — 시드 재현성에 기대는 자리를 줄인다.** 같은 시드로 두 번 생성해도 같은 행이어야 하지만(REQ-GEN-03), 워커 수 · 분할이 바뀌면 부동소수 합산 순서가 달라져 값이 한 비트 어긋날 수 있다. 한 실행 안에서는 같은 벡터를 쓰고, 재생성(⑧)은 수리에만 쓴다.
- **대조군 COPY는 업무 풀이 아니라 전용 커넥션이다**(ADR-19). datagen 역할 프로세스가 자기 전용 커넥션을 연다 — SW-09 적재의 ING 전용 커넥션과 같은 규칙이다.
- **④의 ts는 원시 보존 창 안이어야 한다.** 창 밖 ts는 tag_raw에서 TTL 머지로 곧 사라지고 대조군에만 남아 행 집합이 어긋난다([../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) §대조군 보존 정합). 용량 단계를 채울 때는 창 안에서 태그 · 설비 수로 행 수를 늘린다.
- 도중 실패는 MV 분리 상태에서 **처음부터** 다시 한다(REQ-GEN-10). 백필에는 멱등 토큰이 없어 부분 재실행이 중복을 만든다.

## 대조군 파티션 정리

인계 "대조군 파티션 정리 작업의 주기 · 실행 주체"(보존 문서)를 닫는다. 대조군은 tag_raw와 **같은 경계**로 지워져야 하는데 삭제 수단이 다르다 — tag_raw는 TTL 머지가, 대조군은 일 파티션 DROP이 지운다.

| 항목 | 판정 | 근거 | 버린 해석의 실패 |
|------|------|------|------|
| 실행 주체 | GEN — datagen 역할의 실험 도구 | 대조군은 실험 계측물이고 대조 실험은 GEN이 준비한다 | pg_partman 보존 타이머 — tag_raw의 실제 삭제 시점(머지)과 무관한 시계로 지워 경계 일이 어긋난다 |
| 기준 | **tag_raw에 실제로 남은 일 파티션 목록(UTC 날짜 · ADR-27)** — 보존 값이 아니다 | TTL은 파트 단위 머지라 실제 삭제가 보존 값보다 늦다 | 보존 값(7일)으로 자르면 tag_raw에 아직 남은 경계 일이 대조군에서 먼저 사라진다 |
| 시점 | ① 대조 실험 착수 전 ② SW-09 on 운전 중에는 매일 UTC 자정(= 09:00 KST) 뒤 1회 | SW-09 기본 off라 실험 밖에서는 대조군이 자라지 않는다 | 상시 타이머 — SW-09 off 기간에 할 일이 없다 |
| 동작 | tag_raw 목록에 없는 대조군 일 파티션 DETACH · DROP | 행 단위 DELETE는 죽은 튜플 · WAL로 비교 축을 오염시킨다 | DELETE — VACUUM/WAL 증폭 축이 적재가 아니라 정리 비용을 잰다 |

- 검산: 항목 = **4**
- 대조 실험은 두 저장소 모두에 온전히 남은 일만 쓴다 — 정리 직후에도 구간 count 대조([04_routing.md](./04_routing.md) §대조군 동시 적재 기전)를 거친다.

## SIM 주입 제어

인계 "SIM 지연 · 오류 주입 제어 수단"을 닫는다. 주입의 대상 · 종류 · 기간은 SIM이 아니라 실험이 정한다(REQ-SIM-10). **판정 — 제어 수단은 기동 시 읽는 주입 계획이다. 실행 중 제어 표면은 두지 않는다.**

| 안 | 수단 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 환경변수 켜기 · 끄기 | 기동 시 주입 on/off | 주입을 풀려면 재기동해야 하는데 재기동이 SIM까지 멈춰 결측을 남긴다 — "주입을 풀면 다음 주기에 자동 복구"(REQ-SIM-08)를 관찰할 수 없다 | 버림 |
| ② 실행 중 HTTP 제어 표면 | 요청으로 주입 시작 · 해제 | 새 표면 · 인가 · 레이트 리밋 방어 지점이 생기고, 요청 시각이 실험 기록과 따로 논다 | 버림 — 필요해지면 W5 표면 판정 |
| ③ **기동 시 주입 계획** | 기동 때 계획(대상 · 종류 · 시작 오프셋 · 지속 시간)을 읽어 SIM이 계획대로 켜고 끈다 | 실험 도중 계획을 바꿀 수 없다 — 바꾸려면 재기동 | **채택** — 스위치와 같은 "전환 = 재기동" 원칙 |

- 검산: 안 = **3**

| 계획 항목 | 뜻 | 값 형식 |
|------|------|------|
| 대상 설비 | SIM 포트 범위(5020~5119 안) | 포트 목록 · 범위 |
| 대상 레지스터 | 주소 범위 — 블록 단위로 걸린다 | 시작 주소 · 개수 |
| 종류 | 지연(응답을 늦춤 · 타임아웃 초과 재현) · 오류(Modbus 예외 코드 응답) | 지연 ms · 예외 코드 |
| 시작 오프셋 · 지속 시간 | 기동 뒤 언제 켜고 얼마 동안 둘지 | ms |

- 검산: 계획 항목 = **4**
- **계획 자체가 측정 기록의 실험 조건이다.** SIM은 현재 적용 중인 주입을 health · 메트릭 상태로 노출해 기록자가 계획과 실제 적용을 대조한다(REQ-SIM-10).
- 결과는 [02_collect.md](./02_collect.md) §품질 판정대로 드러난다 — 지연은 행 없음(BAD_TIMEOUT 계수) · 오류는 품질 2 저장. 인수 기준 AC-08이 이 계획으로 세 주입(예외 · 지연 · 범위 밖 값 — 범위 밖 값은 GEN 모드 A 벡터가 만든다)을 건다.

## 티어 시드 구성

보존 · 시드 문서가 넘긴 "M · M+ · L 티어의 시드 태그 구성"을 닫는다. 티어 값의 정본은 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)이고, 아래는 **시드가 어떤 모양이어야 티어 산술이 성립하는가**다.

| 티어 | 설비(SIM 포트) | 태그/설비 | scan_rate_ms | 기본 data_type · 배치 | 설비당 요청(워드 ÷ 125 올림) | 초당 Modbus 요청 |
|------|------|------|------|------|:------:|------|
| S | 5(5020~5024) | 50 | 1000 | FLOAT32 · ABCD · 주소 연속 · 갭 0 | 1(100워드) | 5 |
| M | 50(5020~5069) | 200 | 1000 | 상동 | 4(400워드) | 200 |
| M+ | M과 같은 시드 | 200 | 100 | 상동 | 4 | 2,000 |
| L | 100(5020~5119) | 500 | 100 | 상동 | 8(1,000워드) | 8,000 |

- 검산: S 5 × 1 × 1 = 5 · M 50 × 4 × 1 = 200 · M+ 50 × 4 × 10 = 2,000 · L 100 × 8 × 10 = 8,000 · 티어 **4**행 · 워드 = 태그 × 2(FLOAT32)
- **A형 — 원본 산정 "M 초당 약 100회"는 태그당 1워드일 때의 값이다.** 통념은 요청 수가 설비 수 × 스캔 그룹으로 정해진다는 것이다. 부정 — FC03 요청당 125 레지스터 상한이 있어 요청 수는 **워드 수**가 정한다. 진짜 축은 data_type 구성이다 — FLOAT32 기본 시드면 M은 초당 200회로 원본의 두 배다. 대체 경로 — 원본 산술을 재현하려면 16비트 태그 시드(UINT16 · INT16 + scale)를 쓰고, 어느 쪽이든 data_type 구성을 측정 기록 조건에 적는다. 용량 산정 파생 지표의 "요청 블록 2" 해석은 W4에서 선행 문서에 반영했다.
- **모든 시드 설비의 modbus_config.host는 컨테이너 루프백이다** — 모드 A 행이 전부 9를 받는 근거다(REQ-COL-07).
- **모드 B · C의 태그 집합은 시드와 같은 집합이다.** 생성기가 시드에 없는 (device_id · tag_id)를 발행하면 적재는 막지 않고 조회에서 이름 없는 태그로 드러난다([03_ingest_batch.md](./03_ingest_batch.md) §적재 행 조합 검증).
- 신호 프로파일 배정(혼합 STEP 40% + SINE 40% + RANDOM_WALK 20% · RANDOM_WALK 단독)은 시드가 아니라 생성기 설정이다 — 압축 실험은 두 구성을 각각 잰다(REQ-NFR-14 · 원본 예상치 혼합 8~15배 · RANDOM_WALK 2~4배).

## 부하 실행 절차

원본 부하 절차(원본 data_flow.md §11.3)의 8단계와 계약 대응이다.

| 단계 | 동작 | 확인 | 계약 |
|:-:|------|------|------|
| 1 | 볼륨 스냅샷(task snapshot) | 실험 전 상태로 되돌릴 수 있는가 | REQ-TEC-08 |
| 2 | 컨테이너 4개 재시작 · 캐시 계열 키(cache · lock) 삭제 — 봉인 계열 유지 | 이전 실험의 캐시가 결과를 왜곡하지 않는가 | REQ-GLB-23 · REQ-TEC-09 |
| 3 | 기준선 5분 관측(정밀 세션은 관측 프로파일 off · /metrics 직접 덤프) | 유휴 자원 사용률 | REQ-TEC-12 |
| 4 | 주입 시작 — 모드 1개 · 생성기 CPU 함께 기록 | 생성기가 포화되지 않았는가 | REQ-GEN-05 · 13 |
| 5 | 목표 지속 시간 유지 | 적체(lag + pending)가 안정인가 증가 추세인가 | REQ-NFR-05 |
| 6 | 주입 중단 후 회복 관측 | 랙 소진 · 파트 병합 완료 시간 | REQ-NFR-16 |
| 7 | 정합 검증 | 생성 수(− DROPOUT · 데드밴드 생략 · 발행 중단) = tag_raw count | REQ-NFR-01 |
| 8 | 4요소와 함께 기록 → task restore | 다음 실험의 조건을 같게 | REQ-GLB-17 · REQ-TEC-10 |

- 검산: 단계 = **8**
- **5단계의 판정량도 XLEN이 아니다.** 원본은 "컨슈머 랙"으로 적었고 그 산출식이 원본마다 다르다 — 백프레셔와 같은 그룹 적체로 본다 — 산출식은 consumer_lag = 그룹 lag + pending으로 닫혔다([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) §컨슈머 랙 판정).
- **7단계의 차감 셋이 빠지면 거짓 유실이 난다.** 모드 B 발행 중단 · SW-10 on의 데드밴드 생략 · DROPOUT 행 생략은 생성했지만 적재되지 않는 것이 설계된 동작이다.

## 라이브 실행 — perf · flow

증거 화면 EXP-PERF · EXP-FLOW의 시작 버튼이 부르는 실행이다(표면 [../07_api/09_datagen.md](../07_api/09_datagen.md) #2~#5 · 화면 [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md)). 종류는 둘 — **perf**(규모별 성능 비교 · 격자의 앞부분을 api가 다시 채우고 잰다) · **flow**(흐름 시연 · 생성기 발행 · 업무 명령 · 조회를 함께 흘린다). 이 절은 두 종류의 단계 · 취소 · 정리 · 생성 규칙을 고정하고, 실행 객체 모양 · 응답 코드는 표면 정본이 갖는다.

**A형 — 라이브 실행의 값은 측정 기록이 아니다.** 통념은 화면에서 누른 실행의 시간이 격자 기록과 같은 종류의 수치라는 것이다. 부정 — 라이브 실행은 api 프로세스를 거쳐 재고(드라이버 · 이벤트 루프 · 풀 포함), 4요소 · 3회 중앙값 · 편차 판정을 갖추지 않는다. 격자 대조 쿼리는 앱을 거치지 않는다([../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §스위치별 비교 대상). 진짜 축은 **재는 경로와 기록 규칙**이다. 대체 경로 — 결과에는 항상 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지를 달고, docs/measurements 기록을 만들지 않으며, 정본 수치는 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과가 인용한 기록만이다.

| 항목 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 실행 주체 | api 프로세스의 RunControlModule(GEN 소유) — APP_ROLE api · all에서만 기동 | 표면을 받는 프로세스가 실행을 들고 있어야 중단 · 조회가 같은 메모리를 본다 | 실행을 datagen 역할에 두면 중단 요청이 프로세스 경계를 건너는 새 제어 채널이 필요하다([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §APP_ROLE 배정) |
| 동시성 | **두 종류를 합쳐 한 번에 하나** — 진행 중(running · stopping) 시작 요청은 datagen.run_in_progress/409(details에 현재 runId · type) | 두 실행은 서로의 저장소 · Stream 부하가 되어 서로를 오염시킨다 | perf 쿼리 시간에 flow 발행 부하가 섞이고, 실행 수명 객체 DDL이 겹친다 |
| 상태 보관 | **인스턴스 메모리** — 진행 중 실행 1 + 마지막으로 끝난 실행 1(다음 시작 전까지) | 로컬 단일 api(전역 불변식 로컬 전용) · 실행 기록은 측정 기록이 아니다 | 저장소에 두면 실행 이력이 테이블 · 키 계열로 늘어 고정 기준을 바꾼다 |
| api 재기동 | 실행은 사라진다 — **실패로 세지 않고 "기록 없음"**(GET current가 null) · 부팅 때 남은 실행 수명 객체를 DROP | 재기동이 끊은 실행은 결과가 없다 · 객체만 디스크에 남는다 | 재기동 뒤 run_perf_raw가 남아 다음 perf 실행의 prepare가 "이미 있음"으로 실패하고 디스크를 계속 쓴다 |
| 경과 시간 | elapsedMs는 **서버가 계산** — 종결이면 endedAt − startedAt · 진행 중이면 응답 시각 − startedAt | 화면은 진행 중에만 이 값에서 1초 틱으로 이어 센다 | 브라우저 시계로 startedAt을 빼면 두 시계의 차가 소요 시간에 섞인다 |
| 계측 | gen_run_active{type}(시작 1 · 종결 0) · gen_runs_total{type, status}(종결 때 1) · flow 발행은 gen_points_generated_total{mode="run"} | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | 실험 착수 전 실행 여부를 확인할 자리가 없다(§한 번에 한 계층) |

- 검산: 항목 = **6**
- **B형 — 재기동이 끊은 실행이 "실패"로 남지 않는 것은 누락이 아니다.** 결론 — 상태가 메모리뿐이라 재기동 뒤에는 실행이 없던 것과 같다. 반대 시나리오 — 재기동을 failed로 남기려면 실행 상태를 저장소에 영속해야 하고, 그 순간 실행 이력이 설계 대상 테이블이 된다. 파생 지침 — 화면은 current null을 "기록 없음"으로 보이고, 남은 객체는 부팅 정리가 지운다.

실행 하나의 상태 전이다. status 5값(running · stopping · completed · stopped · failed — 종결 3)과 단계 status 6값(pending · running · done · skipped · stopped · failed)의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)다.

```plain
시작(202) → running ─┬─ 단계 전부 done ────────────────────────── cleanup → completed
                     ├─ stop 요청 → stopping ─ 진행 단계 취소 ─── cleanup → stopped
                     └─ 단계 예외 ─────────────────────────────── cleanup → failed
```

- **cleanup은 세 갈래 모두 돈다.** 중단 · 실패여도 실행 수명 객체를 지우는 단계는 건너뛰지 않는다 — 정리 실패는 error에 담는다. 중단 · 실패 갈래는 status를 stopped · failed 그대로 두고, **정상 갈래의 정리 실패는 failed다** — 객체가 남은 실행을 완료로 보이면 다음 prepare가 남은 객체와 부딪힐 때까지 아무도 모른다.
- **cleanup 중 stop은 무시한다.** 정리는 마지막 단계라 취소할 것이 없다 — status는 정리 결과대로 completed(정리 실패면 failed)이고 stop 응답은 그 뒤 종결 실행에 대한 200이다(표면 #5).
- **중단의 단계 표지** — 끝난 단계는 done 유지 · 미시작 단계는 skipped · 진행 중이던 단계 0~1개는 stopped(단계 경계에서 받으면 0개) · cleanup은 done 또는 failed다. flow prepare 중 stop도 같다 — prepare stopped · publish · drain skipped · status stopped.
- **실패의 error는 메시지 전용이다.** error.code는 원인이 기존 에러 코드(예 common.postgres_unavailable)일 때만 싣고 아니면 null이다 — 에러 카탈로그에 run_failed를 만들지 않는다. 실패 원인은 실행 객체 안의 관찰값이지 표면의 거절이 아니다.
- **stop은 멱등이다.** 이미 종결된 실행에 stop이 오면 200으로 그대로 돌려준다 — 새 코드를 만들지 않는다(표면 #5).

### 성능 비교 실행 — perf

격자 단계 5의 앞부분(10^5 ~ 10^maxExponent)을 실행 수명 객체 위에 다시 채우고 동일 쿼리 5종을 잰다. 객체 · 쿼리 재사용 규칙의 정본은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §실행 수명 객체이고, 이 절은 채우기 · 단계 · 취소를 갖는다.

| 생성 규칙 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 매개변수 | maxExponent ∈ {5, 6, 7, 8}(기본 7) · 규모 = 10^5 · 10^6 · … · 10^maxExponent · 정밀화 점 없음 | 격자 단계 5(10^9)와 정밀화는 수 시간 · 수십 GB라 버튼 실행의 범위가 아니다 | 목록 밖 값은 common.validation_failed/400 — 화이트리스트가 디스크 소모의 상한이다 |
| 분포 | **격자와 같다** — 태그 10,000(설비 50 × 태그 200) · 1 Hz · 행 수 N이면 기간 N ÷ 10,000초 · quality 9 · 행 번호 n(0부터)에서 sec = n div 10000 · ts = S + sec초 · idx = n mod 10000 · device_id = idx div 200 + 1(1~50) · tag_id = idx + 1(1~10000) · **ts 오름차순 삽입(ORDER BY n)** | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §역전 지점 탐색 설계(구성 고정 · 기간으로 키운다) | 태그 수로 키우면 Q3 결과 행 수가 규모마다 달라 역전이 데이터 폭과 섞인다 |
| 시각 축 | 시작 S = 실행 시작 시각(초 내림) − 10^maxExponent ÷ 10,000초 · 규모 k까지의 누적 구간은 [S, S + 10^k ÷ 10,000초) · **마지막 규모의 끝 = 실행 시작 시각**(미래 ts 없음) · {end} = 그 규모의 데이터 끝 | 격자 2차가 시작 S를 고정하고 미래 방향으로 누적해 BRIN · 계획을 지켰다(기록 048~053) | 끝을 고정하고 과거로 늘리면 파티션 ts 상관이 무너져 PostgreSQL이 BRIN을 버리고 Seq Scan으로 간다(1차 기록 039 — 상관 0.027) |
| 값 | **value = ((tag_id × 7 + sec × 13) mod 1000) ÷ 10** — 태그 번호 · 초의 결정적 정수 산술 식(난수 없음 · 두 저장소가 **같은 식**으로 만들어 비트 단위 같은 Float64) — 같은 규모면 같은 행 | 결과 행 수 · 값 일치(resultMatch)가 성립해야 두 저장소가 같은 질문에 답한 것이다 | 엔진별 수학 함수(sin 등)로 만들면 마지막 비트가 달라 avg 대조가 흔들린다 |
| 생성 위치 | **서버 측 생성** — ClickHouse INSERT … SELECT FROM numbers · PostgreSQL INSERT … SELECT FROM generate_series | 앱 → 저장소 전송이 채우기 시간에 섞이지 않는다 | 앱이 행을 만들어 보내면 fillMs가 드라이버 · 직렬화 비용을 잰다 |
| 규모 올림 | 앞 규모에 **이어 채운다** — 규모 k의 증가분은 k = 5면 [S, S + 10초)(n 0 ~ 10^5 − 1) · k > 5면 [S + 10^(k−1) ÷ 10^4초, S + 10^k ÷ 10^4초)(n 10^(k−1) ~ 10^k − 1)만 더 넣는다 · 잘라 다시 만들지 않는다 | 행 수 격자는 누적이다 · 채우기 총량이 10^max행에 묶인다 | 규모마다 TRUNCATE 후 재생성하면 채우기가 규모 합(약 1.11 × 10^max)으로 늘고 쌓이는 순서가 격자와 달라진다 |

- 검산: 생성 규칙 = **6**
- **A형 — 라이브 저장 바이트는 격자 결정적 값과 같지 않다.** 통념은 같은 분포면 같은 저장 크기라는 것이다. 부정 — 격자 값은 생성기 신호 프로파일(혼합)이고 라이브 값은 정수 산술 식이라 ClickHouse 압축이 다르다. 진짜 축은 **값 열의 엔트로피**다. 대체 경로 — storageBytes는 같은 실행 안의 두 저장소 대조로만 읽고 §결과 비교 축 6과 겹쳐 그리지 않는다.
- **perf는 실행 수명 동안 전용 PostgreSQL 연결 1을 쓴다(풀 밖).** prepare가 그 연결의 pg_backend_pid를 기록하고, 중단은 다른 연결에서 그 pid에 pg_cancel_backend를 건다 — 풀 연결을 쓰면 문장마다 연결이 바뀌어 취소가 겨눌 pid가 없고, 다른 요청의 문장을 취소할 수 있다.
- **PostgreSQL 채우기 단계는 ANALYZE로 끝난다.** 통계 없이 쿼리하면 계획기가 규모를 모른 채 계획을 고른다 — 격자는 안정화(③) 뒤에 쟀다.
- 10^8은 시작 전에 화면이 예상 디스크(행당 저장 바이트 · 현행 참고 — [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §대조군 용량 축 · §결과 비교 축 6)와 "수 분 이상" 경고를 보인다.

단계(steps)의 순서다. key 형식의 정본은 [../07_api/09_datagen.md](../07_api/09_datagen.md) §실행 객체다. 규모마다 세 단계가 반복되므로 단계 수는 3 × 규모 수 + 2다.

```plain
① prepare     실행 수명 객체 생성(ClickHouse plc.run_perf_raw · PostgreSQL run_perf_raw + I2 인덱스) · 전용 PostgreSQL 연결의 pg_backend_pid 기록
② fill-ch@k   규모 10^k의 증가분 INSERT … SELECT(numbers) · detail rows · ms · storageBytes
③ fill-pg@k   규모 10^k의 증가분 INSERT … SELECT(generate_series) + ANALYZE · detail 상동
④ query@k     Q1~Q5 × 두 저장소 · 웜만(워밍업 1회 버림 + 3회) · detail 완료 쿼리 수(done ÷ 10) — 3회 값 · 중앙값 · 빠른 쪽 · 배수 · 결과 일치는 result.scales[]
   ②~④를 지수 k = 5 … maxExponent 순서로 반복 · 실행 시작 때 전 단계를 pending으로 만든다
⑤ cleanup     두 객체 DROP — 완료 · 중단 · 실패 모두
```

- 검산: 단계 수 = 3 × (maxExponent − 4) + 2 — maxExponent 5 → 3 × 1 + 2 = 5단계 · 8 → 3 × 4 + 2 = 14단계 · 기본 7 → 3 × 3 + 2 = **11**단계
- **Q5 문턱 {v}는 첫 규모(10^5) 채우기 직후 ClickHouse quantileExact(0.5)(value)로 한 번 정해 실행 끝까지 고정한다** — 격자와 같은 규칙(선택도 50%)이다. 규모마다 다시 정하면 선택도가 흔들려 PostgreSQL 병렬 스캔 계획이 규모마다 달라진다.
- **쿼리 매개변수 device · tag는 (device_id, tag_id) 사전순 첫 쌍이다**(격자 기록 048 조건과 같다).
- **result.scales[]는 끝난 규모만 싣는다.** 중단 · 실패 때 진행 중이던 규모는 싣지 않는다 — 반쪽 규모의 쿼리 시간은 채우기 중인 테이블의 값이다.

### 흐름 시연 실행 — flow

대용량 발행 · 업무 명령 · 조회를 함께 흘려 EXP-FLOW 흐름도를 움직인다. **흐름 계약은 바뀌지 않는다** — 실행은 발행 원천을 늘릴 뿐이고 화면은 기존 flow 프레임([../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트)으로 움직인다.

| 발행 규칙 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 매개변수 | pps ∈ {1000, 5000, 10000, 20000, 50000}(기본 10000) · durationSec ∈ {30, 60, 120, 300}(기본 60) · bizPerSec ∈ {0, 0.5, 1, 2}(기본 1) · readsPerSec ∈ {0, 5, 20, 50}(기본 20) | 화이트리스트가 발행량 · 명령량 · 조회량의 상한이다 | 목록 밖 값은 common.validation_failed/400 |
| 대용량 발행 | api 안 생성기가 stream:plc:raw에 **엔트리 계약 v1 그대로** XADD — 시드의 설비 · 태그 · quality 9 · 현재 시각 · 시드 활성 태그 목록 T(길이 L)에서 발행 초 s마다 점 i = 0 … pps − 1 · 태그 = T[(i + s × pps) mod L] · ts = 초 시작 + ⌊i ÷ L⌋ × ⌊1000 ÷ ⌈pps ÷ L⌉⌋ ms — **(태그 · ts) 중복 없음** · 같은 설비 · 같은 ts는 한 엔트리 · ⌈pps ÷ L⌉ > 1000(ts 간격 0)이면 prepare failed("활성 태그 수가 pps에 비해 적다" · 시연 전용 행 명령 전) | 모드 B와 같은 계약이라 ING · 흐름 요약이 발행자를 가리지 않는다([12_data_contract.md](./12_data_contract.md)) | 계약을 바꾸면 흐름 시연이 운영 경로가 아닌 경로를 보인다 |
| 백프레셔 | 모드 B와 **같은 판정량 · 같은 위험 임계**(§모드 B 적체 검사) — 위험이면 발행을 멈추고 주의 임계 아래로 내려오면 잇는다 · 정지 수는 detail.backpressurePauses | 검사하지 않는 발행자가 하나라도 있으면 MAXLEN 트리밍이 미소비 엔트리를 조용히 자른다(REQ-GLB-21) | 적체를 보지 않고 발행하면 시연이 수집 경로의 유실을 만든다 |
| 발행 시계 | durationSec는 벽시계다 — 정지 동안의 시점은 발행하지 않고 지나간다 · 재개 뒤 ts는 현재 시각 | §모드 B 적체 검사의 "생성 시계는 멈추지 않는다" | 정지분을 몰아 발행하면 STALE 판정 · E2E가 과거 시각으로 오염된다 |
| 업무 명령 | 1 ÷ bizPerSec초마다 **BizWritePort로 명령 하나**(HTTP가 아니라 프로세스 안 호출 — 같은 명령 스트림 · 같은 워커 · 같은 원장) · kind master.device.patch · **시연 전용 설비 DEMO-FLOW-DEV에만**(§시연 전용 행) · 본문 {deviceName: "시연 설비 {runId 앞 8자}-{명령 번호}"} — 매번 새 값 · **되돌림 없음** · actor null · bizPerSec 0이면 보내지 않는다 | 명령마다 실제 변경이 있어 트랜잭션 · 감사 · cache:devlist:{DEMO-FLOW의 site_id} DEL · ch:cacheinv가 돈다 — **변경 없는 본문은 기존 쓰기 서비스가 감사 · 체인을 건너뛰어 흐름도에 무효화가 보이지 않는다**(리드 통합 확인 2026-09-28) · 대상이 시연 전용 행뿐이라 **중단 · 실패 · 재기동 어느 경우에도 운영 행은 바뀌지 않는다**(리드 재판정 2026-09-28 — [07_business_crud.md](./07_business_crud.md) §업무 명령 경로) | 운영 설비에 명령을 보내면 시연이 운영 마스터를 바꾼다 — 바꿨다 되돌리는 짝(폐기)은 중단 · 되돌림 실패 · 짝 가운데 재기동에서 바뀐 이름을 남긴다 · 가짜 명령을 흉내 내면 흐름도의 biz 칸이 운영 경로가 아닌 것을 보인다 |
| 명령 계수 | publish 명령 1건 = 1(짝 없음 — commandsSent = durationSec × bizPerSec의 정수 부분 · 중단이면 그때까지) · 결과마다 commandsOk(applied) · commandsPending(202 · 대기 상한 초과) · commandsFailed(rejected · failed · unavailable) · prepare의 시연 전용 행 생성 명령은 세지 않는다 | 명령 결과는 동기 응답이다 — 대기 상한을 넘으면 pending이다 | 결과를 기다리지 않고 세면 워커 적체가 성공으로 보인다 |
| 조회 섞기 | 조회 수 = durationSec × readsPerSec의 정수 부분 · **j번째 조회는 publish 시작 + j ÷ readsPerSec초에 보낸다**(일정대로 — 앞 조회를 기다리지 않는다) · 종류는 j mod 5 자리 순환으로 **센서 시계열 2 · 센서 지금 값 2 · 업무 설비 목록 1**(40% · 40% · 20% — 무작위가 아니라 순환이라 같은 매개변수면 같은 순서) · 셋 다 **프로세스 안 호출**(HTTP 아님 — 업무 명령의 BizWritePort처럼 표면 컨트롤러가 부르는 서비스 그대로): ① TimeseriesService.query(표면 POST /api/v1/timeseries/query · cache:q 히트면 Redis · 미스면 ClickHouse 뒤 사본 담기 — [06_timeseries_read.md](./06_timeseries_read.md) §조회 판정 트리) ② RealtimeService.deviceLatest(표면 GET /api/v1/realtime/devices/{id}/tags · Redis rt:latest · 빈 키면 ClickHouse 복원 — [05_realtime_read.md](./05_realtime_read.md)) ③ MasterReadService.listDevices(표면 GET /api/v1/devices · cache:devlist 히트면 Redis · 미스면 PostgreSQL 뒤 사본 담기 — [07_business_crud.md](./07_business_crud.md) §읽기 · 쓰기 경로) · **동시 진행 상한 32**(2계층 조정값 · 현행 참고 · 소유 이 문서) — 넘으면 그 조회는 보내지 않고 건너뛴다 · 결과는 버린다(실행 객체 · 응답에 싣지 않는다) · readsPerSec 0이면 보내지 않는다 | 캐시 경로 · SW-02~05가 사람의 조회와 같아야 흐름도의 조회 줄이 실제 cache-aside를 보인다 — HTTP로 보내면 BFF · 인가 · 레이트 리밋이 섞여 캐시가 아니라 표면 비용을 보인다(업무 명령과 같은 이유) · 기다리지 않아 조회 지연이 발행 시계를 밀지 않는다 | 조회를 흉내 내 메트릭만 올리면 조회 줄이 실제 경로가 아닌 것을 보인다 · 상한 없이 보내면 ClickHouse 불가 동안 진행 중 조회가 api 메모리에 쌓인다 |
| 조회 키 선택 | **같은 키 반복 + 주기적 새 키** — ① 시드 활성 태그 앞 3개 · 범위 10분 · 기준 = publish 시작을 분 단위로 내린 시각에서 10분 전에 끝나는 범위(최근 창 5분 밖이라 과거 구간 TTL로 사본에 담긴다) · 시계열 순번 n의 4번 중 3번은 기준 범위 반복(첫 번째만 미스 · 뒤는 히트) · 1번은 k = ⌊n ÷ 4⌋ + 1분 더 과거의 새 범위(미스 → ClickHouse) · 기준 범위 사본은 TTL이 지나면 다시 미스 ② 시드 활성 태그의 설비를 오름차순으로 순환 — rt:latest는 사본이 아니라 원본 최신값이라 실행이 발행 중이면 hit · 빈 키면 restored ③ **시연 사이트 DEMO-FLOW 하나**(cache:devlist:{DEMO-FLOW의 site_id} · §시연 전용 행) — 첫 조회는 미스(PostgreSQL → 사본 담기) · 이후 히트 · **업무 명령의 체인 ②가 사본을 지운 다음 조회는 미스** · TTL(현행 참고 600초)이 지나도 미스 | 반복 키만 쓰면 첫 조회 뒤 히트 100%라 DB로 가는 길이 비고, 매번 새 키면 히트 0이라 사본의 효과가 보이지 않는다 · ③의 미스가 업무 명령의 무효화 체인과 이어져 "지운 사본은 다음 조회가 다시 담는다"가 한 화면에 보인다 · 새 범위 간격이 1분이라 SW-04 버킷 스냅에도 키가 갈린다 · 최근 구간을 고르면 캐시 없이 ClickHouse로 가 히트가 0이 된다([06_timeseries_read.md](./06_timeseries_read.md) §TTL 구간 분류와 지터) | 운영 사이트를 고르면 시연 명령이 그 사본을 지우지 않아 bizPerSec가 있어도 ③에 미스가 생기지 않는다 |
| 조회 계수 | publish detail에 readsSent(보낸 조회 — 실패 포함) · readsFailed(예외로 끝난 조회) · readsSkipped(동시 상한으로 건너뛴 조회) · result에는 **readsSent만** · readsSent + readsSkipped ≤ durationSec × readsPerSec의 정수 부분 · **실패는 세기만 한다** — 조회 예외(timeseries.clickhouse_unavailable · common.postgres_unavailable 등 503 · 404)는 실행을 멈추거나 failed로 만들지 않는다 · 히트 · 미스 · 실패의 뜻은 조회 메트릭(tsq_cache_requests_total · **rlt_latest_requests_total** · **mst_cache_requests_total** — 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md))이 사람의 조회와 같은 계열로 센다 · 완료 경로는 drain 전에 보낸 조회의 결말을 기다려 readsFailed를 확정한다 | 실행은 조회를 보내는 주체일 뿐 판정 주체가 아니다 | 조회 실패를 실행 실패로 올리면 ClickHouse가 잠깐 503인 동안 발행 · 명령까지 멈춰 흐름 시연 전체가 끊긴다 · 실행이 따로 히트를 세면 같은 사실의 정본이 둘이 된다 |

- 검산: 발행 규칙 = **9**
- **생성은 worker_threads에서 한다.** 신호 벡터 생성 · 대량 인코딩은 격리 대상이다([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §worker_threads 격리 대상) — api 이벤트 루프에서 만들면 50,000 pps에서 조회 · WebSocket 표면이 틱마다 멈춘다.
- **actor null은 거짓 귀속을 피한다.** 실행을 시작한 사용자를 명령 actor로 싣지 않는다 — 사람이 요청하지 않은 쓰기를 사람 이름으로 남기지 않는다. 귀속 없음 잔여는 [../12_security/04_threat_model.md](../12_security/04_threat_model.md) §잔여 위험 등재가 받는다.
- **A형 — 조회는 대기줄(Stream)에 넣지 않는다.** 통념은 "모든 요청은 Redis 대기줄을 거친다"는 것이다. 부정 — 대기줄을 타는 것은 쓰기 두 길(센서 stream:plc:raw · 업무 stream:biz:cmd)뿐이고 조회는 줄을 서지 않는다. 진짜 축은 **즉답이 필요한가**다 — 쓰기는 모아 넣거나(센서) 순서대로 하나씩 넣어야(업무) 해서 줄이 이득이지만, 조회는 사람이 화면 앞에서 답을 기다리므로 줄을 세우면 앞 요청을 기다린 시간만큼 느려질 뿐 얻는 것이 없다. 대체 경로 — 조회에서 Redis는 **먼저 확인하는 사본 자리**다(cache-aside — 있으면 바로 답하고 없을 때만 ClickHouse · PostgreSQL에 가서 사본을 담는다 · [07_business_crud.md](./07_business_crud.md) §읽기 · 쓰기 경로 · [06_timeseries_read.md](./06_timeseries_read.md)). 흐름 시연의 조회 섞기도 이 길을 그대로 탄다.
- **라이브 흐름 실행은 주입 모드가 아니다.** 주입 모드는 측정 원칙(한 번에 한 계층)의 손잡이이고, 이 실행은 대용량 발행 · 업무 명령 · 조회를 일부러 겹쳐 흐름을 보이는 시연이다 — mode 레이블 값 run이 둘을 가른다.

단계의 순서다.

```plain
① prepare   시드 설비 · 활성 태그 로드 · 시연 전용 행 확인(없으면 명령으로 생성) · 시작 시점 grp:ingest 적체(lag + pending) 기록
② publish   durationSec 동안 발행 + 명령 + 조회 · detail pointsSent · entriesSent · commandsSent · backpressurePauses · progress(0~1) · readsSent · readsFailed · readsSkipped
③ drain     grp:ingest 적체가 ①의 수준 이하로 돌아올 때까지 · 상한 30초 — 넘으면 done + detail.timedOut true · detail drainMs
④ 종결      completed · 중단이면 진행 중 단계 stopped · 뒤 단계 skipped · prepare 실패면 failed
```

- 검산: 단계 = **3**(prepare · publish · drain) · 실행 수명 객체 없음 — cleanup 단계를 두지 않는다
- **drain 상한 초과는 실패가 아니다(B형).** 결론 — 30초 안에 적체가 돌아오지 않아도 drain은 done이고 timedOut만 true다. 반대 시나리오 — failed로 두면 고 pps 시연이 매번 실패로 끝나 화면이 "완료"를 보이지 못하는데, 남은 적체는 ING가 계속 소진하므로 실행이 할 일은 없다. 파생 지침 — drainMs · timedOut을 결과에 싣고 상한(현행 참고 30초 · 소유 이 문서)은 2계층 조정값이다.
- **중단하면 drain을 건너뛴다.** 이미 발행한 엔트리는 ING가 소진한다 — 중단을 누른 사람은 곧바로 끝나기를 기대하므로 적체 소진을 기다리지 않는다.
- result = pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs · readsSent(표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md)).

### 시연 전용 행

흐름 시연의 업무 명령이 쓰는 마스터 행이다. **운영 행(시드 · 사람이 만든 행)을 바꾸지 않는다** — 실행이 쓰는 마스터 행은 이 셋뿐이다(리드 재판정 2026-09-28).

| 행 | 코드 | 값 | 근거 |
|------|------|------|------|
| 사이트 | site_code **DEMO-FLOW** | site_name 시연 사이트 · timezone 기본값 | 설비 목록 캐시 키가 사이트 단위라(cache:devlist:{site_id}) 운영 사이트의 캐시를 지우지 않으려면 사이트부터 가른다 |
| 라인 | line_code **DEMO-FLOW-L**(사이트 DEMO-FLOW 안) | line_name 시연 라인 | 설비는 라인 FK가 필수다 |
| 설비 | device_code **DEMO-FLOW-DEV** | **is_active false** · modbus_config 루프백 127.0.0.1 기본값 · **태그 없음** | Collector가 폴링하지 않는다 — 비활성이고 읽을 레지스터(태그)가 없다 · 시계열 · 알람에 닿지 않는다 |

- 검산: 시연 전용 행 = **3**
- **prepare가 코드로 찾고 없는 것만 만든다.** 순서는 BizWritePort로 master.site.create → master.line.create → master.device.create → master.device.patch {isActive: false}(명령 경로 그대로라 흐름도에 보인다 · actor null) — 설비 생성 표면은 isActive를 받지 않아 비활성은 뒤따르는 patch가 한다 · 그 사이 창에도 태그가 없어 Collector가 읽을 것이 없다. 있으면 재사용한다. 만들다 실패하면(rejected · failed · 대기 상한 초과) 실행은 failed다.
- **시연 전용 행은 첫 실행 뒤 남는다(재사용)** — 마스터 목록 화면에 보이고 이름("시연 설비 …")으로 식별한다. 사람이 같은 코드로 행을 만들면 시연이 그 행을 쓴다 — 두 잔여는 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 · [../12_security/04_threat_model.md](../12_security/04_threat_model.md) §잔여 위험 등재가 받는다.
- **권한 근거** — 흐름 실행은 시연 전용 행에 한정한 마스터 쓰기를 actor null로 싣는다 · MST-02 ADMIN 단일 주체의 명시 예외다([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)).

### 취소 · 정리

stop을 받으면 status stopping으로 바꾸고 진행 중 단계에 아래 수단으로 취소를 건다. 취소가 끝나면 cleanup(perf)을 돌고 stopped로 닫는다.

| 진행 중 단계 | 취소 수단 | 취소 뒤 남는 것 | 정리 |
|------|------|------|------|
| perf fill-ch@k · query@k(ClickHouse) | 실행이 문장마다 붙인 query_id로 KILL QUERY | 삽입 중이던 블록 일부 | cleanup이 plc.run_perf_raw를 DROP |
| perf fill-pg@k · query@k(PostgreSQL) | 다른 연결에서 prepare가 기록한 전용 연결 pid에 pg_cancel_backend | 롤백된 트랜잭션 — 행 없음 | cleanup이 run_perf_raw를 DROP |
| perf prepare | 생성 DDL이 끝나기를 기다린다(짧은 DDL — 취소하지 않는다) | 만들어진 객체 | cleanup이 DROP |
| flow prepare | 보낸 생성 명령의 결과까지 기다린 뒤 멈춘다(명령은 취소할 수 없다) | 만들어진 시연 전용 행 — 다음 실행이 재사용한다 | 없음 |
| flow publish | 발행 루프 정지 · 명령 발송 정지(보낸 명령은 결과까지 센다) · 새 조회 중지(보낸 조회는 기다리지 않는다 — 결과는 버린다 · 원천 지연이 중단을 늦추지 않게) | 이미 발행한 엔트리 · 시연 전용 설비에 적용된 명령 — 운영 행 변경 없음 | 없음 — 엔트리는 ING가 소진한다 · 되돌릴 것이 없다 |
| flow drain | 대기 중지 | 남은 적체 | 없음 |

- 검산: 단계 = **6**
- **query_id는 실행이 정한다** — runId를 접두로 문장마다 붙여 KILL QUERY가 이 실행의 문장만 겨누게 한다. 서버가 붙인 id를 쓰면 다른 세션의 문장과 가를 수 없다.
- **DROP은 IF EXISTS로 한다.** 부팅 정리 · 중단 · 실패가 같은 cleanup을 부르므로 객체가 이미 없어도 cleanup이 실패하지 않는다.
- **부팅 정리는 이름으로 찾는다** — api 부팅 때 plc.run_perf_raw · run_perf_raw가 있으면 DROP한다. 실행은 한 번에 하나라 이름이 하나로 고정된다(실행마다 다른 이름을 쓰면 부팅 정리가 무엇을 지울지 목록을 가져야 한다).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 생성기 단독 처리량 | **닫힘(S1 실측 · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값)** — 워커 1 약 590만 pps · 판정(M 티어 3배) 성립 | REQ-NFR-17 · AC-16 |
| 티어별 초당 Modbus 요청의 실측 · 폴링 주기 초과 여부 | 3계층 미확인 — 위 표는 구조 계산 | S5 · EXP-23(모드 A) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 주입 계획의 파일 형식 · 노출 필드 이름 | 형식 **W6 판정** — JSON 하나 · shared zod 검증 · 검증 실패 시 기동 거부 · 경로 SIM_FAULT_PLAN · 노출 이름도 W6 판정 — sim_fault_injection_active{kind} | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 노출은 sim_fault_injection_active{kind}(W6) |
| 실행 중 주입 제어 표면의 필요 여부 | 판정 — 두지 않는다 · 필요하면 표면 판정 | [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| bulk 본문 모양 | 닫힘 — Stream 페이로드 계약을 그대로 싣는 JSON 본문 · 요청당 엔트리 상한 | [../07_api/09_datagen.md](../07_api/09_datagen.md) §요청 본문 |
| 라이브 실행의 소요 시간 · 디스크(perf 10^8 채우기 · 쿼리 시간 · flow 고 pps 드레인) | 3계층 미확인 — 화면 경고는 행당 저장 바이트(현행 참고)로만 예상한다 · 값은 시연값이라 정본에 올리지 않는다 | §라이브 실행 — perf · flow · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §실행 수명 객체 |
| flow drain 상한 | 2계층 조정값 — 현행 참고 30초 · 소유 이 문서 · 넘으면 done + timedOut | 이 문서 §흐름 시연 실행 — flow |
| 대조군 정리의 디스크 예산 · 중단 규칙 | **W6 판정** — 디스크 예산은 식 고정(여유 − 잔여 알림 문턱 − 다음 스냅샷 ≥ 다음 단계 도출 크기) · 적재 시간은 1계층 관계 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값 |

## 관련 문서

- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN-01~12 기능 정본
- [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) — SIM 주입 기능
- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 계약
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
- [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) — 백필 절차
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 적체 판정량 · 위험 임계
- [02_collect.md](./02_collect.md) — 모드 A 수집 · 품질 판정
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 라이브 실행 표면 #2~#5 · 실행 객체
- [07_business_crud.md](./07_business_crud.md) — flow 실행의 업무 명령 경로
