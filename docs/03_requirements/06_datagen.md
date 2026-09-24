# REQ-GEN — 데이터 생성 요구사항

> **대상**: 데이터 생성(GEN · NestJS datagen 모듈)의 동작 계약 — 신호 프로파일 · SIMULATED 표지와 결측 · 시드 재현성 · 부하 티어 · 주입 모드 A~D · 부하 주입 표면 · 백필 절차 · 생성기 여유 · 대조군 동일 행 — REQ-GEN-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 메트릭 이름 반영 · 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-GEN-07 · 09 스트림 길이 검사 → **미확인 적체 검사**(ADR-21) · 모드 B 검사 기전 W4 판정 반영 — REQ 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 모드 B 검사의 판정량을 그룹 적체로 교정(ADR-21)
> **원천**: 원본 tech_stack.md §3.4 · §7 · §8 · §10.6(커밋 ff66a37) · 원본 data_flow.md §10.2 · §10.3 · §11 · §11.1 · §11.2 · §11.3 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3 · §11 · §14 · §15 · §18(커밋 ff66a37) · 원본 implementation_plan.md §5 S1 · S5(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #11 · D-05 · D-07 · D-12 · [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-01~10 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen 네임스페이스 · [01_global_rules.md](./01_global_rules.md) REQ-GLB-10 · 17 · 18 · 21

이 문서는 GEN 기능 10개의 동작 계약을 고정한다. GEN은 실장비가 없는 이 시스템에서 **실험의 품질을 결정하는 도메인**이다 — 생성기가 틀리면 측정된 모든 수치가 틀리고, 생성기가 병목이면 측정 자체가 무의미하다.

**GEN의 요구는 두 종류로 갈린다.** 하나는 파이프라인에 넣는 데이터의 **정합**(표지 · 결측 · 페이로드 계약 · 적체 검사)이고, 다른 하나는 측정을 성립시키는 **재현성**(시드 · 모드 단일성 · 생성기 여유 · 대조군 동일 행)이다. 앞쪽은 파이프라인 결함을 막고, 뒤쪽은 측정 결함을 막는다.

**에러 코드를 내는 자리는 부하 주입 표면(GEN-07) 하나다.** 네임스페이스는 URL의 ingest가 아니라 표면 소유 도메인인 datagen이다(docs_plan 보정 #11). 나머지 기능은 실행 인자로 돌며 실패가 메트릭과 대조 쿼리로 드러난다.

## 요구사항 — 생성 · 표지 · 재현성

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-01** | 태그마다 신호 프로파일 8종(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) 중 하나로 값을 만든다. 태그 N × 시점 M을 TypedArray에 한 번에 채우고 worker_threads 풀에서 병렬화한다 — 생성 연산을 이벤트 루프에서 하지 않는다. S2는 SINE 1종이다 | 원본 tech_stack.md §7 · 원본 data_flow.md §11 · REQ-GLB-20 | 이벤트 루프에서 생성하면 같은 프로세스의 수집 · 조회가 생성 부하에 밀려, 측정한 조회 p95가 생성기 비용을 포함한다 | 생성 중 nodejs_eventloop_lag_p95_seconds 대 생성 중지 시 대조 · 프로파일별 샘플 파형 확인 | GEN-01 | F-09 | 해당 없음 |
| **REQ-GEN-02** | 모드 B · C · D의 산출 행은 **전부 SIMULATED(9)**로 싣는다. DROPOUT의 결측은 BAD 코드를 다는 대신 **행을 생략**한다. SPIKE는 기저값 위 확률적 이상치다. 모드 A의 표지는 Collector가 단다 | 원본 data_flow.md §3.2 · §11 · REQ-GLB-18 · W1 판정 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | 결측에 BAD를 달면 그 행의 품질 칸이 출처 표지(9)를 잃어 생성 데이터를 구분할 수 없게 된다. 모드 B 산출이 0으로 저장되면 실데이터와 섞인 뒤 복원할 방법이 없다 | 모드 B · C · D 적재 후 quality 분포(9뿐) · DROPOUT 태그의 기대 행 수 대비 실제 행 수 조회 | GEN-02 | F-09 | 해당 없음 |
| **REQ-GEN-03** | 난수 시드를 실행 인자로 받고 고정한다. 같은 시드 · 같은 구간 · 같은 태그 집합은 **같은 행 집합**을 만든다. 시드는 측정 기록의 실험 조건에 적는다 | 원본 tech_stack.md §7 · 원본 data_flow.md §11 · D-05 · REQ-GLB-17 | 시드가 없으면 on/off 비교의 두 실행이 다른 데이터를 받아 차이의 원인이 스위치인지 데이터인지 가를 수 없다. 대조군 백필(REQ-GEN-14)이 같은 행 집합을 얻지 못한다 | 같은 시드로 2회 생성한 결과의 행 수 · 값 합 대조 | GEN-03 | F-09 | 해당 없음 |
| **REQ-GEN-04** | 생성 규모는 용량 티어 S · M · M+ · L(설비 수 · 설비당 태그 · 주기)로 받는다. 티어 값의 정본은 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)이며 생성기는 티어를 정의하지 않는다. 티어는 측정 기록 4요소의 하나다 | 원본 architecture.md §15 · 원본 data_flow.md §11 · REQ-GLB-17 | 생성기가 티어 값을 따로 가지면 같은 이름의 티어가 문서와 생성기에서 다른 pps를 뜻한다 | 티어별 생성 pps 실측과 티어 정본 초당 포인트 대조 | GEN-04 | F-09 | 해당 없음 |
| **REQ-GEN-05** | **한 번에 한 주입 모드만 쓴다.** 주입 모드는 측정 기록의 실험 조건에 적는다. SW-01 off 실험은 모드 A로만 한다 | 원본 data_flow.md §11.1 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #2 | 모드 A와 B를 동시에 돌리면 어느 계층이 병목인지 가를 수 없다. SW-01 off에 모드 B를 걸면 Stream 없는 구성에 Stream 직결 주입을 거는 모순이 된다 | 실험 실행 중 활성 주입 경로 수 = 1 확인 · 측정 기록 주입 모드 칸 | GEN-05 · GEN-06 · GEN-07 · GEN-08 | F-09 | 해당 없음 |

## 요구사항 — 주입 모드

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-06** | 모드 A는 PlcSim 레지스터 Buffer를 주기적으로 갱신하고 Collector 폴링을 거친다. 모드 A로 재는 것은 진짜 E2E와 Modbus 병목이며 **DB 상한을 모드 A로 판정하지 않는다** | 원본 data_flow.md §11.1 · [05_plc_sim.md](./05_plc_sim.md) REQ-SIM-06 | 모드 A로 DB 상한을 재면 Modbus가 먼저 막혀 **ClickHouse 한계가 실제보다 낮게 기록된다** | 모드 A 부하 상승 중 poll_duration 포화가 insert_duration 포화보다 먼저 오는지 기록 | GEN-05 | F-01 · F-09 | 해당 없음 |
| **REQ-GEN-07** | 모드 B는 stream:plc:raw에 직접 XADD하며 Collector와 **같은 페이로드 계약**(스키마 버전 v 포함)을 따른다. **모드 B도 XADD 전에 미확인 적체(그룹 lag + pending — XLEN이 아니다 · ADR-21)를 검사하고 백프레셔 위험 단계면 발행을 멈추고 멈춘 엔트리 수를 계측한다** — 검사를 우회한 발행자가 되지 않는다. 검사의 기전은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) | 원본 architecture.md §9.3 · 원본 data_flow.md §12.1 · REQ-GLB-10 · 21 · 웨이브 인계(모드 B 길이 검사) | 모드 B가 검사하지 않으면 모드 B가 바로 MAXLEN이 막으려던 "우회한 발행자"가 되어 위험 단계에서 **미소비 엔트리가 조용히 잘린다** — 무손실 판정이 거짓 실패하고 원인이 적재 쪽으로 오인된다 | 모드 B로 위험 단계까지 부하 → stream_trimmed_unacked 0 · 발행 중단 계수 증가 · 샘플 엔트리 v 대조 | GEN-06 | F-02 · F-09 · F-10 | 해당 없음 |
| **REQ-GEN-08** | 모드 C 부하 주입 표면(POST /api/v1/ingest/bulk)은 **기본 비활성**이며 환경변수와 재기동으로만 켠다. 꺼져 있으면 datagen.bulk_disabled/404다. 켜진 뒤에는 S7부터 인증을 요구하며 역할과 무관하다. 레이트 리밋이 걸린다 | 원본 architecture.md §11 · §18 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · REQ-AUT-16 | 기본 활성이면 같은 머신의 임의 프로세스가 Stream에 직접 쓸 수 있다. 403 · 503으로 내면 역할을 바꾸면 풀린다는 오해 · 재시도 폭주를 만든다 | 기본 기동에서 호출 → 404 · 게이트 켠 S7 커밋에서 무인증 호출 → 401 | GEN-07 | F-09 | datagen.bulk_disabled/404 · auth.unauthenticated/401 · common.rate_limited/429 |
| **REQ-GEN-09** | 모드 C는 XADD 전에 미확인 적체를 검사해 백프레셔 **위험** 단계면 datagen.stream_full/503으로 거절한다 — Collector의 스풀 전환과 같은 임계다. 부하 도구는 이 거절을 **재시도로 덮지 않고 거절 수를 측정값으로 센다.** 요청 본문 계약 위반은 common.validation_failed/400이다. 표면은 받은 순간 Stream에 넣고 끝나며 **XADD 뒤의 적재 실패를 응답에 싣지 않는다** | 원본 architecture.md §9.3 · 원본 data_flow.md §12.1 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen | 재시도로 덮으면 백프레셔가 흡수한 양과 거절한 양을 가를 수 없어 HTTP 경유 수집 상한 신호가 사라진다. 적재 결과를 기다려 응답하면 표면이 Ingest 배치 주기에 묶여 API 처리량이 아니라 플러시 주기를 재게 된다 | 모드 C로 위험 단계까지 부하 → 503 발생률 기록 · k6 스크립트에 503 재시도 부재 · 응답 지연이 배치 플러시 주기와 무관함 확인 | GEN-07 | F-09 · F-10 | datagen.stream_full/503 · common.validation_failed/400 |
| **REQ-GEN-10** | 모드 D 백필은 ① MV 분리 ② 원시 대량 삽입 ③ 롤업 직접 채우기(INSERT SELECT) ④ MV 재연결 ⑤ 원시 count 대 롤업 countMerge 정확 일치 대조 순서로만 한다. 도중 실패 시 MV 분리 상태에서 **처음부터** 다시 한다. MV · 롤업 정의는 소유하지 않는다 | 원본 data_flow.md §10.2 · §10.3 · 원본 architecture.md §7.2 · REQ-GLB-15 · [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) | MV를 붙인 채 백필하면 삽입이 느려지고 중간 실패 시 롤업이 **부분만** 채워져 정합 판단이 불가능하다. 중간부터 재개하면 이미 들어간 원시 행이 다시 롤업에 합산된다 | 백필 후 구간별 count(원시) = countMerge(tag_1m) 대조 · 백필 중 MV 상태 조회 | GEN-08 | F-08 · F-09 | 해당 없음 |
| **REQ-GEN-11** | 모드 D는 ING를 우회하므로 멱등 토큰과 대조군 동시 적재가 적용되지 않는다. 모드 D 구간의 대조군은 REQ-GEN-14로 따로 채우고, 모드 D 구간을 E2E 지연 집계에 넣지 않는다 | [../02_features/05_datagen.md](../02_features/05_datagen.md) 주입 모드 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) E2E 계산의 전제 | 모드 D 행을 필터 없이 E2E로 집계하면 과거 ts 때문에 지연이 **일 단위로 튄다.** 대조군이 비면 그 구간의 대조 쿼리가 한쪽 저장소만 행을 가진다 | 백필 구간 E2E 쿼리에 ts 필터 적용 확인 · 백필 구간 두 저장소 행 수 조회 | GEN-08 | F-09 | 해당 없음 |

## 요구사항 — 생성기 여유와 대조군

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-12** | S1에서 수집 경로 없이 생성 + MessagePack 인코딩 처리량을 워커 수별로 잰다. 합격 판정은 **M 티어 초당 포인트의 3배 이상**이며 목적은 판정보다 기준선 확보다. 값은 [13_nonfunctional.md](./13_nonfunctional.md) REQ-NFR-17이 갖는다. 미달이면 APP_ROLE=datagen 별도 컨테이너 또는 Python 생성기로 간다 | 원본 data_flow.md §11.1 · 원본 tech_stack.md §3.4 · 원본 implementation_plan.md §5 S1 | 생성기 여유를 재지 않고 부하를 걸면 생성기가 먼저 포화된 구간의 수치를 시스템 한계로 기록한다 | 워커 수 1 · 2 · 4 · …별 단독 처리량 3회 중앙값 기록 | GEN-09 | F-09 | 해당 없음 |
| **REQ-GEN-13** | 모든 부하 측정에 생성기 CPU 사용률(k6 포함)을 함께 기록하고, 생성기가 포화된 구간의 수치는 버린다 | 원본 tech_stack.md §10.6 · 원본 architecture.md §14 측정 한계 · REQ-GLB-17 | 로컬에서는 생성기와 측정 대상이 같은 CPU를 나눠 쓴다. 포화 구간을 남기면 변곡점이 시스템이 아니라 생성기의 한계를 가리킨다 | 측정 기록의 생성기 CPU 칸 존재 · 포화 구간 제외 표시 | GEN-01 · GEN-09 | F-09 | 해당 없음 |
| **REQ-GEN-14** | 모드 D로 채운 구간은 같은 시드 · 같은 구간 · 같은 태그 집합으로 PostgreSQL 대조군 plc_tag_raw_control에도 채운다. 두 저장소의 구간별 행 수는 **정확 일치**해야 대조 쿼리를 돌린다. 절차 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) | D-05 · D-12 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) | 행 집합이 다르면 두 저장소 쿼리 결과 자체를 대조할 수 없어 역전 지점이 저장소 차이가 아니라 **데이터 차이**를 가리킨다 | 구간별 count(tag_raw) = count(plc_tag_raw_control) 대조 후에만 대조 쿼리 실행 | GEN-10 | F-09 | 해당 없음 |
| **REQ-GEN-15** | 모드 C의 인증 비용은 S7 이후에만 잰다. S5의 모드 C 수치에는 인증이 없으므로 S7 이후 수치와 같은 조건으로 비교하지 않는다 — 커밋 해시가 둘을 가른다 | D-07 · [../02_features/05_datagen.md](../02_features/05_datagen.md) 주입 모드 · REQ-AUT-16 | 두 수치를 한 표에 섞으면 인증 비용이 처리량 저하로, 또는 처리량 개선이 인증 제거로 오독된다 | 모드 C 측정 기록의 커밋 해시 · 인증 적용 여부 칸 대조 | GEN-07 | F-09 | 해당 없음 |

## 주입 모드별 요구 적용

| 요구 축 | 모드 A | 모드 B | 모드 C | 모드 D |
|------|------|------|------|------|
| SIMULATED 표지 주체 | Collector(REQ-COL-07) | 생성기(REQ-GEN-02) | 상동 | 상동 |
| 페이로드 계약 v | Collector가 싣는다 | 생성기가 싣는다(REQ-GEN-07) | 상동(표면 본문 → 엔트리) | 해당 없음 — Stream을 타지 않는다 |
| 발행 전 적체 검사 | Collector(REQ-COL-10) | 생성기(REQ-GEN-07) | 표면(REQ-GEN-09) | 해당 없음 |
| 위험 단계 반응 | 스풀 전환 | 발행 중단 + 계측 | 503 거절 | 해당 없음 |
| 멱등 토큰 · 대조군 동시 적재 | 적용 | 적용 | 적용 | **미적용** — REQ-GEN-11 · 14 |
| 재는 것 | 진짜 E2E · Modbus 병목 | Redis · Ingest · ClickHouse 상한 | API 처리량 · 인증 · 직렬화 | 순수 삽입 · 압축률 |

- 검산: 모드 = A · B · C · D = **4** · 요구 축 = **6**행
- **적체 검사 행이 모드 A~C 전부 채워진 것이 REQ-GEN-07의 결과다.** 모드 B 칸이 비어 있으면 REQ-GLB-10의 "검사 없는 발행자" 잔여가 계측 없이 남는다.

## 기능 → REQ 대응

[../02_features/05_datagen.md](../02_features/05_datagen.md) 기능 목록의 GEN 기능 전부가 하나 이상의 REQ-GEN에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| GEN-01 | 신호 프로파일 생성 | REQ-GEN-01 · 13 | 2 |
| GEN-02 | 품질 표지와 결측 표현 | REQ-GEN-02 | 1 |
| GEN-03 | 시드 고정 | REQ-GEN-03 | 1 |
| GEN-04 | 부하 티어 설정 | REQ-GEN-04 | 1 |
| GEN-05 | 모드 A 레지스터 갱신 | REQ-GEN-05 · 06 | 2 |
| GEN-06 | 모드 B Stream 직결 | REQ-GEN-05 · 07 | 2 |
| GEN-07 | 모드 C 부하 주입 표면 | REQ-GEN-05 · 08 · 09 · 15 | 4 |
| GEN-08 | 모드 D 백필 | REQ-GEN-05 · 10 · 11 | 3 |
| GEN-09 | 생성기 단독 처리량 실측 | REQ-GEN-12 · 13 | 2 |
| GEN-10 | 대조군 동일 행 백필 | REQ-GEN-14 | 1 |

### 검산

- 기능 = GEN-01~10 = **10** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 2 + 1 + 1 + 1 + 2 + 2 + 4 + 3 + 2 + 1 = **19**
- REQ-GEN 채번 = 01~15 = **15** · 기능에 대응하지 않는 REQ **0**

## 에러 코드

GEN-07 표면만 코드를 낸다. 인용 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드뿐이다.

| 코드 | 발생 REQ | 클라이언트(부하 도구) 대응 |
|------|------|------|
| datagen.bulk_disabled/404 | REQ-GEN-08 | 환경변수를 켜고 재기동 |
| datagen.stream_full/503 | REQ-GEN-09 | **재시도하지 않고 거절 수를 센다** |
| common.validation_failed/400 | REQ-GEN-09 | 요청 본문 수정 |
| auth.unauthenticated/401 | REQ-GEN-08 | S7 이후 토큰 첨부 |
| common.rate_limited/429 | REQ-GEN-08 | 다음 분 창까지 대기 — 레이트 리밋 거절도 측정 기록에 따로 센다 |

- 검산: 인용 코드 **5** · 채번 제안 **0**
- **B형 — stream_full은 실패가 아니라 관측 대상이다.** 모드 C 실험에서 503 발생률이 HTTP 경유 수집 상한의 신호다. 재시도로 덮으면 이 신호를 잃는다.

## 인계 판정

| 인계 항목 | 판정 | 자리 |
|------|------|------|
| 모드 B의 적체 검사 — 검사하는지 없다 | **검사한다(요구 수준).** 위험 단계에서 발행을 멈추고 멈춘 수를 센다. 기전(파이프라인 적체 조회 · 임계 조회 계약 — 판정량은 XLEN이 아니라 그룹 적체, ADR-21)은 W4가 판정했다 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §모드 B 적체 검사 | REQ-GEN-07 |
| 모드 D와 대조군의 동일 행 절차 | 요구 수준은 "구간별 행 수 정확 일치 후에만 대조 쿼리"로 닫는다. 절차는 W4 | REQ-GEN-14 |

- 검산: 인계 항목 = **2** · 새 코드 채번 제안 **0** — 모드 B는 표면이 없어 거절이 응답이 아니라 계측이다

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 모드 B 적체 검사의 기전 · 발행 중단 계수 메트릭 이름 | 기전 **W4 판정**(XADD + XINFO GROUPS 파이프라인 · 위험이면 중단 · 주의 임계 미만 재개) · 메트릭 이름 **W6 판정** — gen_publish_halted_entries_total · gen_publish_halted_points_total · backpressure_stage{publisher} | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 모드 D 대조군 동일 행 절차 | 절차 미설계 | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 생성기 실행 제어 표면 | 원본 API 표에 없다 — 이 문서는 표면을 요구하지 않는다 | [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) · 리드 판정 |
| 부하 주입 표면 게이트 환경변수 이름 · 요청 본문 | 표면 명세 | [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5) |
| 생성 모드의 과거 ts와 STALE | 실시간 화면 실험은 현재 시각으로 생성한다 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 생성기 단독 처리량 · 프로파일별 압축률 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) REQ-NFR-14 · 17 · EXP-35 · EXP-21 |

## 관련 문서

- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN 기능 목록 · 주입 모드 · 표면 소유
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-10 백프레셔 명시화 · REQ-GLB-18 생성 데이터 구분 · REQ-GLB-21 데이터 계약
- [07_ingest.md](./07_ingest.md) — 모드 B · C의 받는 쪽 · 대조군 동시 적재
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — F-09 주입 기전
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 부하 주입 표면
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
