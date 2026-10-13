# F-09 테스트 데이터 주입 (10_datagen_inject)

> **대상**: F-09 주입 흐름의 기전 정본 — 생성 엔진 → 모드 A · B · 한 번에 한 계층 원칙 · 모드 A 레지스터 갱신 · **모드 B 적체 검사 기전(판정량은 그룹 적체)** · **SIM 지연 · 오류 주입 제어 수단** · **흐름 시연 실행(flow)의 단계 · 취소 · 발행 규칙 · 조회 섞기** · **직접 비교 실행(compare — D-16)의 넣기 · 조회 대결 · 무결성 기전 · 진행 중 결과 갱신** · 카드 라인 가상 PLC 신호
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — §직접 비교 실행 도입에 비교 사본 모양 한 문장(칸(chunk) 1일 · 검증 단계 압축) · 넣기 ① prepare의 **PG 일 파티션 만들기(control_prepare_range) 삭제**(칸은 넣을 때 생긴다) · ② clear PG TRUNCATE → **통째로 덮은 칸 drop_chunks** · ⑤ verify 병합 → **ClickHouse 병합 + PostgreSQL 구간 칸 압축(control_compress_range)** · 넣는 중 크기 일 파티션 → **일 파티션 · 칸**(병합 · 압축 전) · **크기는 자리 잡은 모양에서 잰다 불릿 신설**(칸 크기 chunks_detailed_size · 압축 실패 경고 · 조회 대결은 압축 칸) · 경고에 압축 실패 · 무결성 ① prepare 시험 창 파티션 만들기 삭제 · **무결성 창은 압축하지 않은 칸 불릿 신설** · 히스토그램 칸 → **버킷**(칸(chunk)과 가름) — 단계 · 사건 · 부분 수 불변 · 결과 계약 불변
> **개정일**: 2026-10-11 — **⑤ 실시간 그래프**(사용자 결정 2026-10-11 — 세 패널 모두 실시간) — §직접 비교 실행 넣기 단계 ③ publish · ④ drain에 **1초마다 중간 결과 · 2초마다 구간 크기** · ⑤ verify가 **최종값으로 바꾼다** · 걸린 시간 불릿에 넣는 중 결과(표본기 TimelineSampler onSample → liveIngestResult · Ingest 계측 차분 · 크기 LIVE_BYTES_EVERY_MS 2초 · liveBytes · 병합 전 순간값이라 최종과 다를 수 있음 · 읽기 실패한 초는 건너뜀 · 멈춘 뒤 늦은 표본 버림) · 조회 대결 · 무결성 ② **질문 · 시험이 끝날 때마다 결과에 그 줄** · 사건 표 종결 공통에 진행 중 값 미보관 — 단계 · 사건 · 부분 수 불변
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 H1 · H2 · M1~M4 · 리드 판정 지침서 §6) — 흐름 시연 발행 · 조회 대상 시드 활성 태그 → **시연 설비 DEMO-FLOW-DEV의 flow 전용 태그 50**(카드 라인 영향 0) · §시연 전용 행 3 → **4행**(태그 행 신설 · 설비 태그 없음 → flow 전용 50) · §직접 비교 실행 넣기 ① prepare에 **적체 0 대기**(상한 30초) · ② clear 일 파티션째 · 넣기 · 무결성 **가동 중 시작 거절** · 조회 대결 사전 확인 **마지막 넣기 미완료 409** · 지우는 동안 시작 거절 · 경고는 단계 detail — 단계 · 사건 수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 실행 · 카드 라인 가상 PLC · 설비 가동**(사용자 결정 2026-10-11 결정 2 · 3 · 업무 방해는 사용자 결정으로 삭제) — **§직접 비교 실행 신설**(넣기 · 조회 대결 · 무결성의 단계 기전 · 발행 규칙 · 게이트 · 비우기 · 정리 · 취소 · 계측 · 보관) · 모드 A에 **카드 라인 신호**(태그 종류 → 프로파일 · 설비 운전 상태 먼저 · 상태 연동) · 설비 가동이 틱을 켜고 끈다 · 주입 모드 B 행에 직접 비교 · 한 번에 한 계층 조합 4 → **5**(직접 비교 + 설비 가동 — 막지 않고 plant_on 표지) · 상태 보관 행에 run_result 예외
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11) — §모드 C 표면 · §모드 D 백필과 대조군 동일 행 · §대조군 파티션 정리 · §티어 시드 구성 · §부하 실행 절차 · §성능 비교 실행 — perf **삭제** · 주입 모드 4 → **2**(A · B — B는 흐름 시연 실행이 쓴다 · 옛 독립 진입점 mode-b.js 삭제) · 한 번에 한 계층 조합 6 → **4** · §라이브 실행 — perf · flow → **§라이브 실행 — flow**(cleanup 단계 · 실행 수명 객체 · 부팅 정리 삭제) · 취소 표 6 → **3** · 업무 명령의 감사 · 권한 근거 삭제 · 미확인 4행 삭제 · D-16 정리(d4) — 지운 절을 가리키던 § 참조 교정(원천 §실행 수명 객체 → §폐지된 실험 설계(D-16)) · D-16 정리(d4 전역 sweep) — 조회 섞기 HTTP 대안 문구 · 실행 주체 버린 대안 datagen 역할 → 옛 역할
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
> **원천**: 원본 data_flow.md §11 · §11.1 · §11.2 · §11.3 · §10.3 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3 · §11 · §17(커밋 ff66a37) · 원본 tech_stack.md §3.4(커밋 ff66a37) · docs_plan.md 웨이브 인계 W4 06_pipeline/10 행 전부 · SIM 지연 · 오류 주입 제어 수단 · D-05 · D-12 · ADR-17 · ADR-19 · ADR-21 · ADR-22 · ADR-23 · REQ-GEN-01~03 · 05~07 · 16 · 18 · 19 · REQ-SIM-08~11 · REQ-GLB-10 · 18 · D-16(사용자 결정 2026-10-11) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) §대조군 보존 정합 · [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) 티어 · 라이브 실행 제어 리드 판정(2026-09-28) · [../07_api/09_datagen.md](../07_api/09_datagen.md) #2~#5 · [07_business_crud.md](./07_business_crud.md) §업무 명령 경로 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §폐지된 실험 설계(D-16) · 사용자 결정 2026-10-11(⑤ 실시간 그래프) · as-built 코드 apps/api/src/modules/runs/compare-runner.ts(liveIngestResult · TimelineSampler onSample · LIVE_BYTES_EVERY_MS) · compare-stores.ts(CompareStores.liveBytes) · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · as-built 코드 compare-stores.ts(rangeStats · compressed) · compare-sql.ts(PG_CHUNK_BYTES · PG_COMPRESS_RANGE) · infra/postgres/migrations/009_control_timescale.sql

F-09는 **생성기가 만든 값이 파이프라인 입구에 들어가기까지**다. 주입 모드는 둘이다 — A는 Modbus부터(가상 PLC 레지스터 → Collector 폴링), B는 Stream부터(흐름 시연 · 직접 비교 실행의 직접 발행). **원칙은 한 번에 한 계층만 부하를 주는 것이다**(REQ-GEN-05) — 모드 A와 B를 동시에 돌리면 병목이 Modbus인지 적재인지 가를 수 없다. 옛 모드 C(HTTP 부하 주입 표면) · D(ClickHouse 직접 백필)와 티어 시드 · 부하 실행 절차 · 성능 비교 실행(perf)은 측정 도구와 함께 지웠다(D-16 · [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)).

생성기가 병목이면 보이는 흐름이 생성기의 한계다. 생성기는 api 컨테이너의 CPU를 수집 · 적재와 나눠 쓰므로 S1에서 단독 처리량을 한 번 재 두었다(기록 006). 이 문서는 모드별 기전과 W2~W3이 넘긴 주입 쪽 미확인 중 남은 두 건(모드 B 검사 · SIM 주입 제어)을 닫는다.

## 생성 엔진에서 모드까지

원본 주입 흐름도(원본 data_flow.md §11)를 단계로 옮긴다.

```plain
① 설정        태그별 신호 프로파일(8종) · 난수 시드 · 주입 모드 1개
② 벡터 생성   worker_threads — Float64Array 태그 N × 시점 M(시드 고정이면 같은 행 집합)
③ 이상 주입   SPIKE 이상치 · DROPOUT은 행 생략(BAD를 달지 않는다)
④ 표지        모드 B 산출 행은 전부 SIMULATED(9) · 모드 A는 Collector가 설비 규칙으로 단다
⑤ 모드 분기   A 레지스터 Buffer 갱신 · B Stream XADD
```

- **DROPOUT은 BAD가 아니라 행 생략이다(W1 판정).** 품질 칸은 하나라 BAD를 달면 생성 데이터 표지 9가 지워진다 — 생성 데이터와 실데이터를 가를 방법이 사라진다(전역 불변식 생성 데이터 구분).
- **시드가 같으면 행 집합이 같다**(REQ-GEN-03). 반복 비교가 이 성질 위에 선다.
- 모드 A의 통신 장애 재현은 생성기가 아니라 SIM 주입(§SIM 주입 제어)이 한다 — Collector가 2 · 3을 판정한다.

## 주입 모드

| 모드 | 경로 | 측정할 수 있는 것 | 측정할 수 없는 것 | 백프레셔 검사 | 멱등 토큰 · 대조군 | APP_ROLE |
|:----:|------|------|------|------|------|------|
| A | 생성기 → SIM 레지스터 → Collector 폴링 → Stream | 진짜 E2E · Modbus 병목 | DB 상한 — Modbus가 먼저 막힌다 | Collector(COL-07) | 적용 · SW-09 적용 | collector(SIM · COL과 동거) |
| B | 생성기 → Stream XADD 직결(흐름 시연 · 직접 비교 실행) | Redis · Ingest · 저장소 쪽 흐름 | Modbus · Collector | **모드 B 발행자 자신**(§모드 B 적체 검사 · 직접 비교는 위험 단계에서 기다렸다 잇는다 — §직접 비교 실행) | 적용 · SW-09 적용(gated는 직접 비교 중) | api(RunControlModule) |

- 검산: 모드 = **2** · 둘 다 Stream을 지난다 · 폐지 모드 C · D(D-16)
- **발행 경로 둘(Collector · 모드 B)은 같은 페이로드 계약 · 같은 위험 임계를 쓴다**(REQ-GLB-21 · ADR-21). 검사하지 않는 발행자가 하나라도 있으면 그것이 "검사를 우회한 발행자"이고 MAXLEN 트리밍이 미소비 엔트리를 조용히 자른다.

### 한 번에 한 계층

| 조합 | 판정 | 이유 |
|------|------|------|
| 모드 둘 이상 동시 | 금지 | 병목 계층을 가를 수 없다(원본 data_flow.md §11.1) |
| SW-01 off + 모드 B | 금지 | Stream을 끈 구성에 Stream 직결 주입 — 경로가 정의되지 않는다(조합 제약 #2) |
| 생성기 포화 구간 | 버린다 | 생성기가 병목이면 대상 계층의 상한이 아니라 생성기 상한을 잰다 |
| 직접 비교 + 설비 가동(모드 A) | **막지 않는다** — 실행이 시작 · 끝의 가동 여부를 결과(plant_on)에 남기고 화면이 "설비 가동 중에 잰 값"을 표시한다 | 직접 비교는 측정 기록이 아니고 비교 행은 과거 구간이라 가동 데이터와 행이 섞이지 않는다 — 섞이는 것은 CPU · 저장소 부하이며 그 사실을 결과가 말한다(D-16) |
| 라이브 실행 + 다른 측정 | 금지 — 측정 착수 전 gen_run_active 전부 0 확인 | 라이브 실행은 api 안에서 저장소 · Stream에 부하를 더한다 — 측정의 지연 · 처리량에 실행 부하가 섞인다(§라이브 실행 — flow) |

- 검산: 조합 = **5**

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
- **틱을 켜고 끄는 것은 설비 가동이다(D-16 · RLT-10).** 수집기 역할이 ctl:plant:power를 1초마다 읽어 켜기(수집 정의 → SIM 포트 → 모드 A 틱 → 폴링) · 끄기(역순)를 하고, 키가 없으면 기동 기본값 SENSOR_AUTOGEN을 따른다 — 기전 [05_realtime_read.md](./05_realtime_read.md) §설비 가동 · HMI 개요.
- **카드 라인 태그는 종류가 신호를 정한다(D-16 결정 3).** tag_master.tag_kind가 있으면 종류 → 프로파일(온도 RANDOM_WALK · 압력 SINE · 속도 STEP + 잡음 · 전류 SINE + 잡음 · 진동 SPIKE · 수량 COUNTER · 상태 상태 기계 · 기타 RANDOM_WALK — 상태 기계는 8종 밖이라 STEP 칸으로 센다) · 종류가 없으면(S2 슬라이스) GEN_PROFILE 구성을 쓴다. **설비 단위로 운전 상태를 먼저 정한다** — (시드 · 설비 · 시각)으로 정해지는 결정적 상태 기계(40초 칸마다 가동 0.86 · 대기 0.10 · 정지 0.04 · 설비마다 칸 경계를 비킨다)이고, 가동이 아니면 속도 0 · 수량 멈춤 · 압력 · 전류 · 진동 0 근처 · 온도는 천천히 식는다. 값은 템플릿 범위 안이다(BAD_RANGE를 만들지 않는다). 상태 확률 · 칸 길이는 생성기 설정이지 설계 수치가 아니다(코드 apps/api modules/datagen/signal/card-signal.ts).
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
- **모드 B 발행자는 흐름 시연 실행(GEN-12)이다.** 옛 독립 진입점(dist/mode-b.js · GEN-06 — 티어 모양 검사 · 1초 격자 · 해독 불가 혼합 옵션)은 측정 도구와 함께 지웠다(D-16). 검사 규칙(묶음 하나 = 파이프라인 한 번 · 그 XINFO로 다음 묶음 판정 · XADD 실패는 위험)은 실행의 발행 루프가 그대로 지킨다.
- **재개 기준은 주의 임계다.** 위험 임계 바로 아래에서 재개하면 다음 묶음이 다시 임계를 넘어 발행 · 중단이 번갈아 든다 — 위험 단계의 하강 기준(ADR-23)과 같은 값이다. 주의 · 경고 단계의 반응(컨슈머 증설 · 데드밴드 강화)은 모드 B에 없다.
- **생성 시계는 멈추지 않는다.** 중단 동안의 시점은 발행되지 않은 채 지나간다 — 재개 뒤 ts는 현재 시각이다. 중단 구간을 뒤늦게 몰아 발행하면 STALE 판정 · E2E가 과거 시각으로 오염된다.

| 계측 | 뜻 | 쓰는 곳 |
|------|------|------|
| 발행 중단 수 | 위험 단계로 발행하지 않은 엔트리 · 행 수 | 무손실 판정의 생성 측 차감 · REQ-GEN-07 |
| 모드 B 단계 게이지 | 모드 B가 본 적체 단계 | Collector 단계와 같은 판정인지 대조 |
| 생성기 CPU | 생성 · 인코딩 스레드 사용률 | 생성기 포화 구간 판독 |

- 검산: 계측 = **3** · 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다 — gen_publish_halted_entries_total · gen_publish_halted_points_total · backpressure_stage{publisher} · gen_worker_utilization(W6)

## SIM 주입 제어

인계 "SIM 지연 · 오류 주입 제어 수단"을 닫는다. 주입의 대상 · 종류 · 기간은 SIM이 아니라 실험이 정한다(REQ-SIM-10). **판정 — 제어 수단은 기동 시 읽는 주입 계획이다. 실행 중 제어 표면은 두지 않는다.**

| 안 | 수단 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 환경변수 켜기 · 끄기 | 기동 시 주입 on/off | 주입을 풀려면 재기동해야 하는데 재기동이 SIM까지 멈춰 결측을 남긴다 — "주입을 풀면 다음 주기에 자동 복구"(REQ-SIM-08)를 관찰할 수 없다 | 버림 |
| ② 실행 중 HTTP 제어 표면 | 요청으로 주입 시작 · 해제 | 새 표면 · 방어 지점이 생기고, 요청 시각이 실험 기록과 따로 논다 | 버림 — 필요해지면 W5 표면 판정 |
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

## 라이브 실행 — flow

분산 처리 모니터링 화면(EXP-FLOW)의 시작 버튼이 부르는 실행이다(표면 [../07_api/09_datagen.md](../07_api/09_datagen.md) · 화면 [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md)). 종류는 **flow**(흐름 시연 · 생성기 발행 · 업무 명령 · 조회를 함께 흘린다) 하나다 — 옛 **perf**(Redis를 거치지 않는 규모별 성능 직접 재 보기)는 D-16으로 지웠다. 이 절은 단계 · 취소 · 발행 규칙을 고정하고, 실행 객체 모양 · 응답 코드는 표면 정본이 갖는다.

**A형 — 라이브 실행의 값은 측정 기록이 아니다.** 통념은 화면에서 누른 실행의 수치가 측정 기록과 같은 종류라는 것이다. 부정 — 라이브 실행은 api 프로세스를 거쳐 흐르고(드라이버 · 이벤트 루프 · 풀 포함), 4요소 · 3회 중앙값 · 편차 판정을 갖추지 않는다. 진짜 축은 **재는 경로와 기록 규칙**이다. 대체 경로 — 결과에는 항상 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지를 달고, docs/measurements 기록을 만들지 않으며, 정본 수치는 측정 기록만이다.

| 항목 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 실행 주체 | api 프로세스의 RunControlModule(GEN 소유) — APP_ROLE api · all에서만 기동 | 표면을 받는 프로세스가 실행을 들고 있어야 중단 · 조회가 같은 메모리를 본다 | 실행을 api 밖 역할(옛 datagen 역할 — D-16 삭제)에 두면 중단 요청이 프로세스 경계를 건너는 새 제어 채널이 필요하다([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §APP_ROLE 배정) |
| 동시성 | **한 번에 하나** — 진행 중(running · stopping) 시작 요청은 datagen.run_in_progress/409(details에 현재 runId · type) | 두 실행은 서로의 저장소 · Stream 부하가 되어 서로를 오염시킨다 | 두 실행의 발행이 섞여 흐름도가 서로의 부하를 보인다 |
| 상태 보관 | **인스턴스 메모리** — 진행 중 실행 1 + 마지막으로 끝난 실행 1(다음 시작 전까지) · **예외 — 직접 비교(compare)는 종결 직전 PostgreSQL run_result에 1행**(화면이 마지막 결과를 재기동 뒤에도 보이게 · D-16 · 테이블 수 고정 기준에 실행 보관 1로 들었다) | 로컬 단일 api(전역 불변식 로컬 전용) · 실행 기록은 측정 기록이 아니다 | 저장소에 두면 실행 이력이 테이블 · 키 계열로 늘어 고정 기준을 바꾼다 — compare의 run_result는 그 대가를 받아들인 판정이다(ADR-28) |
| api 재기동 | 실행은 사라진다 — **실패로 세지 않고 "기록 없음"**(GET current가 null) | 재기동이 끊은 실행은 결과가 없다 | 재기동을 failed로 남기면 실행 상태를 저장소에 영속해야 한다 |
| 경과 시간 | elapsedMs는 **서버가 계산** — 종결이면 endedAt − startedAt · 진행 중이면 응답 시각 − startedAt | 화면은 진행 중에만 이 값에서 1초 틱으로 이어 센다 | 브라우저 시계로 startedAt을 빼면 두 시계의 차가 소요 시간에 섞인다 |
| 계측 | gen_run_active{type}(시작 1 · 종결 0) · gen_runs_total{type, status}(종결 때 1) · flow 발행은 gen_points_generated_total{mode="run"} | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | 실험 착수 전 실행 여부를 확인할 자리가 없다(§한 번에 한 계층) |

- 검산: 항목 = **6**
- **B형 — 재기동이 끊은 실행이 "실패"로 남지 않는 것은 누락이 아니다.** 결론 — 상태가 메모리뿐이라 재기동 뒤에는 실행이 없던 것과 같다. 반대 시나리오 — 재기동을 failed로 남기려면 실행 상태를 저장소에 영속해야 하고, 그 순간 실행 이력이 설계 대상 테이블이 된다. 파생 지침 — 화면은 current null을 "기록 없음"으로 보인다.

실행 하나의 상태 전이다. status 5값(running · stopping · completed · stopped · failed — 종결 3)과 단계 status 6값(pending · running · done · skipped · stopped · failed)의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)다.

```plain
시작(202) → running ─┬─ 단계 전부 done ─────────────────────────── completed
                     ├─ stop 요청 → stopping ─ 진행 단계 취소 ──── stopped
                     └─ 단계 예외 ──────────────────────────────── failed
```

- **flow에는 정리 단계가 없다.** 실행 수명 객체를 만들지 않으므로 지울 것이 없다 — 발행한 엔트리는 ING가 소진하고 시연 전용 행은 다음 실행이 재사용한다.
- **중단의 단계 표지** — 끝난 단계는 done 유지 · 미시작 단계는 skipped · 진행 중이던 단계 0~1개는 stopped(단계 경계에서 받으면 0개)다. prepare 중 stop도 같다 — prepare stopped · publish · drain skipped · status stopped.
- **실패의 error는 메시지 전용이다.** error.code는 원인이 기존 에러 코드(예 common.postgres_unavailable)일 때만 싣고 아니면 null이다 — 에러 카탈로그에 run_failed를 만들지 않는다. 실패 원인은 실행 객체 안의 관찰값이지 표면의 거절이 아니다.
- **stop은 멱등이다.** 이미 종결된 실행에 stop이 오면 200으로 그대로 돌려준다 — 새 코드를 만들지 않는다(표면 #5).

### 흐름 시연 실행 — flow

대용량 발행 · 업무 명령 · 조회를 함께 흘려 EXP-FLOW 흐름도를 움직인다. **흐름 계약은 바뀌지 않는다** — 실행은 발행 원천을 늘릴 뿐이고 화면은 기존 flow 프레임([../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트)으로 움직인다.

| 발행 규칙 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 매개변수 | pps ∈ {1000, 5000, 10000, 20000, 50000}(기본 10000) · durationSec ∈ {30, 60, 120, 300}(기본 60) · bizPerSec ∈ {0, 0.5, 1, 2}(기본 1) · readsPerSec ∈ {0, 5, 20, 50}(기본 20) | 화이트리스트가 발행량 · 명령량 · 조회량의 상한이다 | 목록 밖 값은 common.validation_failed/400 |
| 대용량 발행 | api 안 생성기가 stream:plc:raw에 **엔트리 계약 v1 그대로** XADD — **시연 전용 설비 DEMO-FLOW-DEV의 flow 전용 태그 50**(§시연 전용 행) · quality 9 · 현재 시각 · flow 전용 태그 목록 T(길이 L = 50 · tag_id 오름차순)에서 발행 초 s마다 점 i = 0 … pps − 1 · 태그 = T[(i + s × pps) mod L] · ts = 초 시작 + ⌊i ÷ L⌋ × ⌊1000 ÷ ⌈pps ÷ L⌉⌋ ms — **(태그 · ts) 중복 없음** · 같은 설비 · 같은 ts는 한 엔트리 · ⌈pps ÷ L⌉ > 1000(ts 간격 0)이면 prepare failed("flow 전용 태그 수가 pps에 비해 적다" · 시연 전용 행 명령 전 — L 50이면 pps 50,000까지 1,000점이라 값 집합 안에서는 늘 지난다) | 모드 B와 같은 계약이라 ING · 흐름 요약이 발행자를 가리지 않는다([12_data_contract.md](./12_data_contract.md)) · 카드 라인 태그를 쓰지 않아 HMI(카드 라인 30대)의 지금 값 · 상태 · 최근 추이가 flow 값에 닿지 않는다(r5 검수 H2) | 계약을 바꾸면 흐름 시연이 운영 경로가 아닌 경로를 보인다 · 카드 라인 태그에 발행하면 종류를 모르는 flow 값(0~99.9)이 rt:latest를 덮어 상태 태그가 "코드 37.4" · 누적 수량이 뒤로 가는 화면이 된다 |
| 백프레셔 | 모드 B와 **같은 판정량 · 같은 위험 임계**(§모드 B 적체 검사) — 위험이면 발행을 멈추고 주의 임계 아래로 내려오면 잇는다 · 정지 수는 detail.backpressurePauses | 검사하지 않는 발행자가 하나라도 있으면 MAXLEN 트리밍이 미소비 엔트리를 조용히 자른다(REQ-GLB-21) | 적체를 보지 않고 발행하면 시연이 수집 경로의 유실을 만든다 |
| 발행 시계 | durationSec는 벽시계다 — 정지 동안의 시점은 발행하지 않고 지나간다 · 재개 뒤 ts는 현재 시각 | §모드 B 적체 검사의 "생성 시계는 멈추지 않는다" | 정지분을 몰아 발행하면 STALE 판정 · E2E가 과거 시각으로 오염된다 |
| 업무 명령 | 1 ÷ bizPerSec초마다 **BizWritePort로 명령 하나**(HTTP가 아니라 프로세스 안 호출 — 같은 명령 스트림 · 같은 워커 · 같은 원장) · kind master.device.patch · **시연 전용 설비 DEMO-FLOW-DEV에만**(§시연 전용 행) · 본문 {deviceName: "시연 설비 {runId 앞 8자}-{명령 번호}"} — 매번 새 값 · **되돌림 없음** · actor null · bizPerSec 0이면 보내지 않는다 | 명령마다 실제 변경이 있어 트랜잭션 · cache:devlist:{DEMO-FLOW의 site_id} DEL · ch:cacheinv가 돈다 — **변경 없는 본문은 기존 쓰기 서비스가 체인을 건너뛰어 흐름도에 무효화가 보이지 않는다**(리드 통합 확인 2026-09-28) · 대상이 시연 전용 행뿐이라 **중단 · 실패 · 재기동 어느 경우에도 운영 행은 바뀌지 않는다**(리드 재판정 2026-09-28 — [07_business_crud.md](./07_business_crud.md) §업무 명령 경로) | 운영 설비에 명령을 보내면 시연이 운영 마스터를 바꾼다 — 바꿨다 되돌리는 짝(폐기)은 중단 · 되돌림 실패 · 짝 가운데 재기동에서 바뀐 이름을 남긴다 · 가짜 명령을 흉내 내면 흐름도의 biz 칸이 운영 경로가 아닌 것을 보인다 |
| 명령 계수 | publish 명령 1건 = 1(짝 없음 — commandsSent = durationSec × bizPerSec의 정수 부분 · 중단이면 그때까지) · 결과마다 commandsOk(applied) · commandsPending(202 · 대기 상한 초과) · commandsFailed(rejected · failed · unavailable) · prepare의 시연 전용 행 생성 명령은 세지 않는다 | 명령 결과는 동기 응답이다 — 대기 상한을 넘으면 pending이다 | 결과를 기다리지 않고 세면 워커 적체가 성공으로 보인다 |
| 조회 섞기 | 조회 수 = durationSec × readsPerSec의 정수 부분 · **j번째 조회는 publish 시작 + j ÷ readsPerSec초에 보낸다**(일정대로 — 앞 조회를 기다리지 않는다) · 종류는 j mod 5 자리 순환으로 **센서 시계열 2 · 센서 지금 값 2 · 업무 설비 목록 1**(40% · 40% · 20% — 무작위가 아니라 순환이라 같은 매개변수면 같은 순서) · 셋 다 **프로세스 안 호출**(HTTP 아님 — 업무 명령의 BizWritePort처럼 표면 컨트롤러가 부르는 서비스 그대로): ① TimeseriesService.query(표면 POST /api/v1/timeseries/query · cache:q 히트면 Redis · 미스면 ClickHouse 뒤 사본 담기 — [06_timeseries_read.md](./06_timeseries_read.md) §조회 판정 트리) ② RealtimeService.deviceLatest(표면 GET /api/v1/realtime/devices/{id}/tags · Redis rt:latest · 빈 키면 ClickHouse 복원 — [05_realtime_read.md](./05_realtime_read.md)) ③ MasterReadService.listDevices(표면 GET /api/v1/devices · cache:devlist 히트면 Redis · 미스면 PostgreSQL 뒤 사본 담기 — [07_business_crud.md](./07_business_crud.md) §읽기 · 쓰기 경로) · **동시 진행 상한 32**(2계층 조정값 · 현행 참고 · 소유 이 문서) — 넘으면 그 조회는 보내지 않고 건너뛴다 · 결과는 버린다(실행 객체 · 응답에 싣지 않는다) · readsPerSec 0이면 보내지 않는다 | 캐시 경로 · SW-02~05가 사람의 조회와 같아야 흐름도의 조회 줄이 실제 cache-aside를 보인다 — HTTP로 보내면 BFF 중계 · 표면 검증이 섞여 캐시가 아니라 표면 비용을 보인다(업무 명령과 같은 이유) · 기다리지 않아 조회 지연이 발행 시계를 밀지 않는다 | 조회를 흉내 내 메트릭만 올리면 조회 줄이 실제 경로가 아닌 것을 보인다 · 상한 없이 보내면 ClickHouse 불가 동안 진행 중 조회가 api 메모리에 쌓인다 |
| 조회 키 선택 | **같은 키 반복 + 주기적 새 키** — ① flow 전용 태그 앞 3개 · 범위 10분 · 기준 = publish 시작을 분 단위로 내린 시각에서 10분 전에 끝나는 범위(최근 창 5분 밖이라 과거 구간 TTL로 사본에 담긴다) · 시계열 순번 n의 4번 중 3번은 기준 범위 반복(첫 번째만 미스 · 뒤는 히트) · 1번은 k = ⌊n ÷ 4⌋ + 1분 더 과거의 새 범위(미스 → ClickHouse) · 기준 범위 사본은 TTL이 지나면 다시 미스 ② 시연 전용 설비 하나(flow 전용 태그의 설비) — rt:latest는 사본이 아니라 원본 최신값이라 실행이 발행 중이면 hit · 빈 키면 restored ③ **시연 사이트 DEMO-FLOW 하나**(cache:devlist:{DEMO-FLOW의 site_id} · §시연 전용 행) — 첫 조회는 미스(PostgreSQL → 사본 담기) · 이후 히트 · **업무 명령의 체인 ②가 사본을 지운 다음 조회는 미스** · TTL(현행 참고 600초)이 지나도 미스 | 반복 키만 쓰면 첫 조회 뒤 히트 100%라 DB로 가는 길이 비고, 매번 새 키면 히트 0이라 사본의 효과가 보이지 않는다 · ③의 미스가 업무 명령의 무효화 체인과 이어져 "지운 사본은 다음 조회가 다시 담는다"가 한 화면에 보인다 · 새 범위 간격이 1분이라 SW-04 버킷 스냅에도 키가 갈린다 · 최근 구간을 고르면 캐시 없이 ClickHouse로 가 히트가 0이 된다([06_timeseries_read.md](./06_timeseries_read.md) §TTL 구간 분류와 지터) | 운영 사이트를 고르면 시연 명령이 그 사본을 지우지 않아 bizPerSec가 있어도 ③에 미스가 생기지 않는다 |
| 조회 계수 | publish detail에 readsSent(보낸 조회 — 실패 포함) · readsFailed(예외로 끝난 조회) · readsSkipped(동시 상한으로 건너뛴 조회) · result에는 **readsSent만** · readsSent + readsSkipped ≤ durationSec × readsPerSec의 정수 부분 · **실패는 세기만 한다** — 조회 예외(timeseries.clickhouse_unavailable · common.postgres_unavailable 등 503 · 404)는 실행을 멈추거나 failed로 만들지 않는다 · 히트 · 미스 · 실패의 뜻은 조회 메트릭(tsq_cache_requests_total · **rlt_latest_requests_total** · **mst_cache_requests_total** — 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md))이 사람의 조회와 같은 계열로 센다 · 완료 경로는 drain 전에 보낸 조회의 결말을 기다려 readsFailed를 확정한다 | 실행은 조회를 보내는 주체일 뿐 판정 주체가 아니다 | 조회 실패를 실행 실패로 올리면 ClickHouse가 잠깐 503인 동안 발행 · 명령까지 멈춰 흐름 시연 전체가 끊긴다 · 실행이 따로 히트를 세면 같은 사실의 정본이 둘이 된다 |

- 검산: 발행 규칙 = **9**
- **생성은 worker_threads에서 한다.** 신호 벡터 생성 · 대량 인코딩은 격리 대상이다([../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §worker_threads 격리 대상) — api 이벤트 루프에서 만들면 50,000 pps에서 조회 · WebSocket 표면이 틱마다 멈춘다.
- **명령 actor는 null이다.** 사용자 계정이 없다(D-16) — 사람이 요청하지 않은 쓰기를 사람 이름으로 남길 자리도 없다.
- **A형 — 조회는 대기줄(Stream)에 넣지 않는다.** 통념은 "모든 요청은 Redis 대기줄을 거친다"는 것이다. 부정 — 대기줄을 타는 것은 쓰기 두 길(센서 stream:plc:raw · 업무 stream:biz:cmd)뿐이고 조회는 줄을 서지 않는다. 진짜 축은 **즉답이 필요한가**다 — 쓰기는 모아 넣거나(센서) 순서대로 하나씩 넣어야(업무) 해서 줄이 이득이지만, 조회는 사람이 화면 앞에서 답을 기다리므로 줄을 세우면 앞 요청을 기다린 시간만큼 느려질 뿐 얻는 것이 없다. 대체 경로 — 조회에서 Redis는 **먼저 확인하는 사본 자리**다(cache-aside — 있으면 바로 답하고 없을 때만 ClickHouse · PostgreSQL에 가서 사본을 담는다 · [07_business_crud.md](./07_business_crud.md) §읽기 · 쓰기 경로 · [06_timeseries_read.md](./06_timeseries_read.md)). 흐름 시연의 조회 섞기도 이 길을 그대로 탄다.
- **라이브 흐름 실행은 주입 모드가 아니다.** 주입 모드는 측정 원칙(한 번에 한 계층)의 손잡이이고, 이 실행은 대용량 발행 · 업무 명령 · 조회를 일부러 겹쳐 흐름을 보이는 시연이다 — mode 레이블 값 run이 둘을 가른다.

단계의 순서다.

```plain
① prepare   시연 전용 행 · flow 전용 태그 50 확인(없는 것만 명령으로 생성) · 시작 시점 grp:ingest 적체(lag + pending) 기록
② publish   durationSec 동안 발행 + 명령 + 조회 · detail pointsSent · entriesSent · commandsSent · backpressurePauses · progress(0~1) · readsSent · readsFailed · readsSkipped
③ drain     grp:ingest 적체가 ①의 수준 이하로 돌아올 때까지 · 상한 30초 — 넘으면 done + detail.timedOut true · detail drainMs
④ 종결      completed · 중단이면 진행 중 단계 stopped · 뒤 단계 skipped · prepare 실패면 failed
```

- 검산: 단계 = **3**(prepare · publish · drain) · 실행 수명 객체 없음 — cleanup 단계를 두지 않는다
- **drain 상한 초과는 실패가 아니다(B형).** 결론 — 30초 안에 적체가 돌아오지 않아도 drain은 done이고 timedOut만 true다. 반대 시나리오 — failed로 두면 고 pps 시연이 매번 실패로 끝나 화면이 "완료"를 보이지 못하는데, 남은 적체는 ING가 계속 소진하므로 실행이 할 일은 없다. 파생 지침 — drainMs · timedOut을 결과에 싣고 상한(현행 참고 30초 · 소유 이 문서)은 2계층 조정값이다.
- **중단하면 drain을 건너뛴다.** 이미 발행한 엔트리는 ING가 소진한다 — 중단을 누른 사람은 곧바로 끝나기를 기대하므로 적체 소진을 기다리지 않는다.
- result = pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs · readsSent(표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md)).

### 시연 전용 행

흐름 시연의 업무 명령 · 대용량 발행이 쓰는 마스터 행이다. **운영 행(시드 · 사람이 만든 행)을 바꾸지 않는다** — 실행이 쓰는 마스터 행은 이 넷 종류뿐이다(리드 재판정 2026-09-28 · flow 전용 태그는 웨이브 6).

| 행 | 코드 | 값 | 근거 |
|------|------|------|------|
| 사이트 | site_code **DEMO-FLOW** | site_name 시연 사이트 · timezone 기본값 | 설비 목록 캐시 키가 사이트 단위라(cache:devlist:{site_id}) 운영 사이트의 캐시를 지우지 않으려면 사이트부터 가른다 |
| 라인 | line_code **DEMO-FLOW-L**(사이트 DEMO-FLOW 안) | line_name 시연 라인 | 설비는 라인 FK가 필수다 |
| 설비 | device_code **DEMO-FLOW-DEV** | **is_active false** · modbus_config 루프백 127.0.0.1 기본값 | Collector가 폴링하지 않는다 — 비활성이라 수집 정의에 들지 않는다 · HMI 개요(카드 라인)에 보이지 않는다 |
| 태그 | tag_code **DEMO-FLOW-DEV-T01~T50**(설비 DEMO-FLOW-DEV 아래 · 50행) | 실수 FLOAT32 · 유지 레지스터 2워드씩 · 1초 · 범위 0~100 | flow의 대용량 발행 대상 — 카드 라인 태그 대신 이 태그에만 싣는다(r5 검수 H2) · 설비가 비활성이라 수집기 · 가상 PLC는 읽지 않고 값은 flow가 Redis Stream으로 보낸 것뿐이다 · 직접 비교 무결성의 시험 태그(높은 대역)와 겹치지 않는다 |

- 검산: 시연 전용 행 = 종류 **4**(사이트 1 · 라인 1 · 설비 1 · 태그 50)
- **prepare가 코드로 찾고 없는 것만 만든다.** 순서는 BizWritePort로 master.site.create → master.line.create → master.device.create → master.device.patch {isActive: false} → 없는 flow 전용 태그만 master.tag.create(명령 경로 그대로라 흐름도에 보인다 · actor null) — 설비 생성 표면은 isActive를 받지 않아 비활성은 뒤따르는 patch가 한다 · 태그는 비활성 뒤에 만들어 Collector가 읽을 창이 없다. 있으면 재사용한다. 만들다 실패하면(rejected · failed · 대기 상한 초과) 실행은 failed다.
- **시연 전용 행은 첫 실행 뒤 남는다(재사용)** — 마스터 목록 화면에 보이고 이름("시연 설비 …")으로 식별한다. 사람이 같은 코드로 행을 만들면 시연이 그 행을 쓴다 — 두 잔여는 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 · [../12_security/04_threat_model.md](../12_security/04_threat_model.md) §잔여 위험 등재가 받는다.

### 취소 · 정리

stop을 받으면 status stopping으로 바꾸고 진행 중 단계에 아래 수단으로 취소를 건다. 취소가 끝나면 stopped로 닫는다.

| 진행 중 단계 | 취소 수단 | 취소 뒤 남는 것 | 정리 |
|------|------|------|------|
| flow prepare | 보낸 생성 명령의 결과까지 기다린 뒤 멈춘다(명령은 취소할 수 없다) | 만들어진 시연 전용 행 — 다음 실행이 재사용한다 | 없음 |
| flow publish | 발행 루프 정지 · 명령 발송 정지(보낸 명령은 결과까지 센다) · 새 조회 중지(보낸 조회는 기다리지 않는다 — 결과는 버린다 · 원천 지연이 중단을 늦추지 않게) | 이미 발행한 엔트리 · 시연 전용 설비에 적용된 명령 — 운영 행 변경 없음 | 없음 — 엔트리는 ING가 소진한다 · 되돌릴 것이 없다 |
| flow drain | 대기 중지 | 남은 적체 | 없음 |

- 검산: 단계 = **3**

## 직접 비교 실행

실행 종류 **compare**(GEN-13 · D-16 결정 2)의 기전이다. 같은 센서 데이터를 Redis Stream으로 발행하고 Ingest가 같은 배치를 ClickHouse 삽입 + PostgreSQL COPY로 받게 한 뒤(SW-09 gated의 게이트 — [04_routing.md](./04_routing.md) §gated 게이트 판정) 넣기 · 조회 대결 · 무결성을 잰다. **PostgreSQL 쪽 비교 사본은 TimescaleDB hypertable이다** — 칸(chunk) 1일 · 경계 UTC 자정(ClickHouse 일 파티션과 같은 날) · 칸은 넣을 때 스스로 생기고 넣기 검증 단계가 그 구간 칸을 열 압축한다(D-05 부분 개정 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-32 · 스키마 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §지금 모양). 실행 하나가 부분 하나다. 라이브 실행 틀(동시 하나 · 단계 · 중단 · 서버 경과)은 §라이브 실행 — flow를 그대로 쓰고, 표면 · 창 · 문항 · 시험 · 결과 계약은 [../07_api/09_datagen.md](../07_api/09_datagen.md) §직접 비교가 갖는다. **업무 방해(센서를 쏟으며 업무 1건 처리 시간)는 넣었다가 뺐다** — 같은 강도에서도 느린 쪽(p95)이 실행마다 크게 달라 판정할 수 없었다(사용자 결정 2026-10-11 · ADR-31).

```plain
넣기(ingest)
① prepare   카드 라인 설비 · 태그 읽기 · 대기줄 적체 0까지 기다림(상한 30초 — 넘으면 failed) · 시작 적체 기록
② clear     72시간 창 = UTC 날 3 통째 비우기(CH 파티션 DROP · 롤업 3 구간 동기 삭제 · PG control_clear_range — 통째로 덮은 칸 drop_chunks) → 게이트 켬 → 1초
③ publish   구간을 10초 묶음으로 만들어 XADD(설비 1초분 = 엔트리 1) · 위험 단계면 기다렸다 잇는다 · 1초마다 진행 · 중간 결과(크기는 2초마다)
④ drain     적체 ≤ 시작 · CH 구간 행 ≥ 발행 행(상한 180초) → 마지막 COPY 기다림(COPY 타임아웃 + 500 ms) → 게이트 끔 · 중간 결과는 소진 확인까지 계속
⑤ verify    CH 구간 파티션 병합(OPTIMIZE FINAL) · PG 구간 칸 열 압축(control_compress_range) → 행 수 · 크기(구간 몫) · 배치 시간(히스토그램 차분) · COPY 실패 차분 → 결과를 최종값으로 바꾼다
```

- **넣기 · 무결성은 설비 가동이 꺼져 있어야 시작한다**(시작 전 확인 400 path plant — 표면 [../07_api/09_datagen.md](../07_api/09_datagen.md) #2). 가동 엔트리가 비교 행과 같은 대기줄 · 같은 배치를 타면 배치 시간 · 타임라인에 가동 행이 섞이고, 최대 속도 발행의 적체 뒤에서 가동 엔트리가 수 초 밀려 HMI 개요가 통신 끊김으로 보인다. 실행 도중 켜는 것은 막지 않는다 — run_result.plant_on이 표지다.
- **적체 0을 기다린 뒤 비운다.** 중단한 넣기 · flow가 남긴 엔트리가 비운 구간에 같은 (설비 · 태그 · 시각)으로 들어오면 ClickHouse는 두 번 저장하고 PostgreSQL은 기본 키 충돌로 그 배치 COPY를 통째로 롤백한다.
- **비우기 뒤에 게이트를 켠다.** 비우는 동안 실린 가동 배치는 구간 밖이라 섞이지 않고, 게이트를 먼저 켜면 비우기가 막 실린 비교 행을 지운다.
- **발행은 버리지 않는다.** 흐름 시연은 위험 단계에서 멈췄다 주의 임계 아래에서 잇고, 직접 비교도 같은 적체 검사로 기다리되 XADD가 하나라도 실패하면 실행을 멈춘다(failed) — 비교 행이 빠지면 대조가 성립하지 않는다. 기다린 횟수는 backpressurePauses · 단계는 backpressure_stage{publisher="compare"}가 보인다(종결 때 0으로 돌린다).
- **설비 1초분을 엔트리 하나로 묶는다.** 수집기는 주기 그룹마다 엔트리를 내지만, 과거 구간 재생은 1초분을 한 엔트리로 묶어 엔트리 수가 약 8분의 1이다 — 최대 속도 발행이 Redis 명령 수가 아니라 적재(삽입 · COPY)에서 막히게 한다. 행(설비 · 태그 · 시각)과 값은 묶음과 무관하고 결정적이다(같은 구간이면 같은 행 — 상태 2 · 수량 단조 증가 · 그 밖 범위 안 사인 + 잔물결). 엔트리 계약은 v1 그대로다([12_data_contract.md](./12_data_contract.md)).
- **걸린 시간은 소진 확인까지다** — 마지막 COPY를 기다리는 시간(COPY 타임아웃 + 500 ms)은 재지 않는다. 배치 시간은 실행 앞뒤 히스토그램의 버킷 차이고 분위수는 버킷 안 선형 보간이다(해상도 = 버킷 폭). 이 계측은 적재와 같은 프로세스(APP_ROLE all)일 때만 움직인다 — 아래 중간 결과도 같다. **넣는 중 결과는 1초마다 바뀐다(사용자 결정 2026-10-11 — ⑤ 실시간 그래프).** 발행이 시작되면 표본기(TimelineSampler)가 1초마다 Ingest 계측(삽입 · COPY 행 수 · 배치 히스토그램 · COPY 실패 계수)을 읽고, 표본마다(onSample) 순수 함수 liveIngestResult가 실행 앞 값과의 차로 result를 바꾼다 — 보낸 행 · 각 DB에 들어간 행 · 발행 시작부터 경과 · 초당 행(두 DB 중 적은 쪽 ÷ 경과 — 다 들어간 순간에는 최종 정의와 같아진다) · 배치 수 · p50 · p95 · COPY 실패 · 지금까지의 초별 점(timeline)이다. 순서는 prepare · clear 동안 null → publish 첫 표본부터 → drain 동안에도 1초마다 → verify 뒤 최종값이다. 구간이 걸친 UTC 일 파티션 · 칸의 디스크 크기는 표본과 따로 2초마다(LIVE_BYTES_EVERY_MS) 읽어 다음 표본에 싣는다(CompareStores.liveBytes — ClickHouse system.parts · PostgreSQL chunks_detailed_size의 크기만 읽고 행은 세지 않는다 · 첫 값 전 null · 한 저장소 읽기가 실패하면 그 저장소만 null · 크기 읽기가 늦거나 실패해도 표본을 막지 않는다) — ② clear가 사흘 창을 일 파티션 · 칸째 비웠으므로 그 크기에는 이번 넣기 행만 든다. 넣는 중 크기는 병합(OPTIMIZE) · 압축 전 · 마지막 읽기 뒤에 들어온 조각이 빠진 순간값이라 최종값과 다를 수 있다(방향은 정해지지 않는다). 계측 읽기가 실패한 초는 건너뛴다(그 초의 점이 빠질 뿐 실행은 계속된다). 표본기는 drain이 끝나면 멈추고 멈춘 뒤 늦게 끝난 표본은 버린다 — verify의 최종 결과를 덮지 않게. ⑤ verify가 저장소에서 센 행 수 · 병합 · 압축 뒤 다시 잰 크기로 결과 전체를 다시 쓴다 — 필드의 넣는 중 · 끝난 뒤 뜻은 표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) §진행 중 결과(compare).
- **크기는 자리 잡은 모양에서 잰다 — ClickHouse는 병합 뒤 · PostgreSQL은 압축 뒤다(ADR-32).** ⑤ verify는 구간 파티션을 병합하고 구간에 걸친 압축 전 칸을 열 압축한 뒤(압축한 칸이 있으면 ANALYZE — 행 수 추정이 0으로 보이지 않게) 행 수 · 크기를 잰다. PostgreSQL 크기는 UTC 날별 칸 크기(chunks_detailed_size — 압축 데이터 포함) × 구간 몫이다 — 칸 표만 더하면(옛 pg_inherits 합) 압축 데이터가 칸 표 밖의 압축 표에 있어 압축 뒤 크기가 거의 0으로 보인다. 압축이 실패하면 압축 전 크기로 재고 verify detail에 compressed false와 경고를 남긴다 — 넣기는 완료로 끝나고 결과 계약은 그대로다. **조회 대결은 압축된 칸을 읽는다**(문항 질의는 그대로). 자동 압축 정책은 없다 — 압축하는 자리는 이 단계 하나다.

조회 대결과 무결성의 흐름이다.

```plain
조회 대결(query)
① prepare        마지막 넣기(상태 무관)가 completed일 때 그 구간(run_result) · 두 저장소 행 수
② 문항 4         문항마다 CH 워밍업 1 + 3회 → PG 워밍업 1 + 3회 · 중간값 · 결과 행 수 · 승자(3회 모두 같을 때만) · 배수 · 끝날 때마다 결과에 그 줄

무결성(integrity)
① prepare        시연 전용 설비 확보 · 없는 설비 ID가 정말 없는지 · 시험 창 비우기 · 게이트 켬
② 시험 3         duplicate · unknown-device · fault-value를 따로 — 보냄마다 ClickHouse 행이 다 찰 때까지 소진 · COPY 실패 차분 · 끝날 때마다 결과에 그 줄
③ cleanup        중단 · 실패에도 돈다(중단 무시) — 게이트 끔 → 시험 창 비우기 → 시험 설비 rt:latest 키 지우기
```

- **조회 대결 · 무결성의 결과는 질문 · 시험 하나가 끝날 때마다 는다.** prepare 동안 result는 null이고, 문항 · 시험 단계가 끝나면 questions[] · tests[]에 그 줄이 붙는다 — ⑤ 패널은 진행 중 실행의 result로 끝난 줄을 먼저 그린다. 무결성의 cleanup은 결과를 바꾸지 않는다.
- **조회 대결의 사전 확인은 실행을 만들기 전에 한다** — 넣기가 없거나(no_ingest) · 마지막 넣기가 중단 · 실패였거나(ingest_incomplete — 그 넣기가 이미 사흘 창을 비웠다) · 둘 중 하나라도 비었으면(no_rows) 409 datagen.compare_no_data다. 넣기 · 무결성의 SW-09 off · 설비 가동 확인(400)도 같은 자리고, 센서 데이터를 지우는 동안이면 종류와 무관하게 400(path purge)이다.
- **소진 상한 초과 · 병합 실패 · 압축 실패는 결과가 아니라 단계 detail의 경고다** — 결과 계약은 바뀌지 않고 화면이 단계 표지에서 "끝까지 못 쟀을 수 있어요"를 읽는다.
- **무결성 시험 칸은 압축돼 있을 수도 있다.** 시험 창(UTC D−6 13~14시)은 같은 날의 넣기 사흘 창(D−4~D−2)과 다른 칸이지만, 이틀 이상 전에 넣기가 압축한 칸(그날의 D−4)이 오늘의 D−6일 수 있다. 규칙 3(기본 키 · 설비 참조 · 값 범위)은 압축 칸에서도 막히고(리드 확인 2026-10-12) 창 비우기는 압축 칸의 구간 DELETE도 처리한다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §지금 모양) — 칸의 압축 여부가 무결성 결과를 가르지 않는다.
- **무결성 시험은 각각 따로 보낸다.** COPY 한 문장이 트랜잭션 하나라 시험 둘이 한 배치에 섞이면 첫 위반에서 통째 롤백돼 어느 규칙이 막았는지 가를 수 없다 — 앞 시험의 행이 ClickHouse에 다 찬 것을 본 뒤 다음을 보낸다.
- **무결성의 PostgreSQL 거절은 Stream 계약을 지난 행에만 성립한다.** NaN · Infinity는 소비자 디코더가 먼저 DLQ로 막아 두 DB에 닿지 않는다 — 고장 값은 FLOAT32 최댓값(유한 값이라 계약을 지난다)이다([12_data_contract.md](./12_data_contract.md)).

| 사건 | 넣기 | 조회 대결 | 무결성 |
|------|------|------|------|
| 중단(#5) | 발행 정지 · 게이트 끔 · stopped · 이미 실린 구간 행은 남는다(다음 넣기가 비운다) | 진행 중 문항 정지 · stopped | 진행 중 시험 정지 → cleanup(중단 무시) → stopped |
| 단계 예외 | 게이트 끔 · failed · error | failed · error | cleanup → failed · error |
| api 재기동 | 실행이 사라진다 · 게이트는 TTL 10초로 닫힌다 · 실린 구간 행은 남는다 | 상동 | 실행이 사라진다 · 시험 창 행 · 시험 키가 남는다(다음 무결성이 시작 때 비운다) |
| 종결 공통 | 종결 직전 run_result 1행(완료만 result — 진행 중 값 · 중단 · 실패의 결과는 남지 않는다) · backpressure_stage{publisher="compare"} 0 | 상동 | 상동 |

- 검산: 사건 = **4** · 부분 = **3**
- **재기동이 남긴 것은 다음 실행이 지운다.** 넣기는 시작 때 72시간 창을, 무결성은 시작 때 시험 창을 비운다 — 재기동이 끊은 실행의 흔적이 다음 결과에 섞이지 않는다. 게이트는 키 TTL이 닫는다(봉인이었다면 영구히 열렸다 — [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) §인계 판정 #13).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 생성기 단독 처리량 | **닫힘(S1 실측 · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값)** — 워커 1 약 590만 pps · 판정(M 티어 3배) 성립 · 실행 도구는 D-16으로 삭제 | REQ-NFR-17 · AC-16 |
| 주입 계획의 파일 형식 · 노출 필드 이름 | 형식 **W6 판정** — JSON 하나 · shared zod 검증 · 검증 실패 시 기동 거부 · 경로 SIM_FAULT_PLAN · 노출 이름도 W6 판정 — sim_fault_injection_active{kind} | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 노출은 sim_fault_injection_active{kind}(W6) |
| 실행 중 주입 제어 표면의 필요 여부 | 판정 — 두지 않는다 · 필요하면 표면 판정 | [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| 라이브 실행의 소요 시간(flow 고 pps 드레인) | 3계층 미확인 — 값은 시연값이라 정본에 올리지 않는다 | §라이브 실행 — flow |
| flow drain 상한 | 2계층 조정값 — 현행 참고 30초 · 소유 이 문서 · 넘으면 done + timedOut | 이 문서 §흐름 시연 실행 — flow |

## 관련 문서

- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN 기능 정본
- [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md) — SIM 주입 기능
- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 계약
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 적체 판정량 · 위험 임계
- [02_collect.md](./02_collect.md) — 모드 A 수집 · 품질 판정
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 라이브 실행 표면 · 실행 객체
- [07_business_crud.md](./07_business_crud.md) — flow 실행의 업무 명령 경로
- [04_routing.md](./04_routing.md) — 직접 비교의 동시 적재 · gated 게이트 판정
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 비교 사본의 지금 모양
