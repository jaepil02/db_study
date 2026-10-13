# REQ-GEN — 데이터 생성 요구사항

> **대상**: 데이터 생성(GEN · NestJS datagen 모듈 · 라이브 실행 runs 모듈)의 동작 계약 — 신호 프로파일 · SIMULATED 표지와 결측 · 시드 재현성 · 주입 모드 A · B · **라이브 실행 제어(동시 실행 하나 · 흐름 실행 발행과 드레인 · 중단 · 경과 시간 · 완료 표시)** · **직접 비교(넣기 · 조회 대결 · 무결성 · 결과 보관) · 센서 데이터 현황 · 지우기(D-16)** — REQ-GEN-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — REQ-GEN-21 비우기 일 파티션째(007 함수로 일 파티션을 미리 만들고 TRUNCATE) → **하루 단위째(009 control_clear_range — 통째로 덮은 칸 drop_chunks · 칸은 넣을 때 생긴다)** · 최종값 전에 **PostgreSQL 구간 칸 열 압축**(control_compress_range) · 디스크 크기 병합한 파티션 → **ClickHouse 병합 파티션 · PostgreSQL 압축 칸(압축 포함)** · 경고에 압축 실패 · 위반 열 2 · 검증 열 1 · REQ-GEN-22 질의 그대로 · 압축된 칸을 읽는다 · REQ-GEN-23 규칙 셋은 압축 여부와 무관 · 근거 009 — REQ 수 불변
> **개정일**: 2026-10-11 — **⑤ 실시간 그래프**(사용자 결정 2026-10-11 — 세 패널 모두 실시간 · 공용 계약 runs.ts 불변) — REQ-GEN-20 run_result에 **진행 중 값은 남기지 않는다** · REQ-GEN-21 **발행이 시작되면 결과를 1초마다 중간값으로 바꾼다**(크기는 2초마다 병합 전 순간값 · verify가 병합 뒤 다시 잰 최종값) · REQ-GEN-22 · 23 **질문 · 시험 하나가 끝날 때마다 결과에 그 줄**(이미 있던 동작을 적음) — 위반 열(20~23) · 검증 열(21) 함께 — REQ 수 불변
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 H1 · H2 · M1~M4 · L3 · L4 · 리드 판정 지침서 §6) — REQ-GEN-18 발행 대상 시드 설비 · 태그 → **시연 설비 DEMO-FLOW-DEV의 flow 전용 태그 50**(카드 라인 영향 0) · REQ-GEN-20 **설비 가동 켜짐 400 path plant** · 지우는 중 400 path purge · 최근 결과 → **최근 완료 1 + attempts** · REQ-GEN-21 창 KST 자정 → **UTC 자정** · **적체 0 대기**(상한 30초) · 일 파티션 통째 비우기 · 경고 단계 detail · REQ-GEN-22 **마지막 넣기 미완료 409 reason ingest_incomplete**(details reason 3값) · REQ-GEN-23 창 KST D−5 22시 → **UTC D−6 13시(KST 22시)** · REQ-GEN-24 compareRows · 막는 이유 2 → **3**(stream_backlog · 수집기 적용 상태) · 지우기 잠금 · 에러 표에 realtime.latest_unavailable 인용 행(5 → **6**) — REQ 수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 지우기 신설**(사용자 결정 2026-10-11 결정 2 · 5 · 공용 계약 packages/shared runs.ts · data.ts · 업무 방해는 사용자 결정으로 삭제) — **REQ-GEN-20 직접 비교 공통 · 21 넣기 · 22 조회 대결 · 23 무결성 · 24 센서 데이터 현황 · 지우기** 신설(§요구사항 — 직접 비교 · 센서 데이터) · REQ-GEN-06 SENSOR_AUTOGEN=off → **설비 가동 꺼짐**(RLT-10 · 기동 기본값 SENSOR_AUTOGEN) · REQ-GEN-16 동시 하나에 compare · 기능 → REQ 대응 GEN-13 · 14 · 에러 코드 인용 행 3 → **5**(datagen.compare_no_data · data.purge_blocked 행 신설 · validation_failed 행에 SW-09 off · 지우기 본문) · 코드를 내는 자리 1 → **3** — REQ-GEN 현행 9 → **14**(채번 19 → **24**)
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11) — REQ-GEN-04(부하 티어) · 08 · 09(모드 C 부하 주입 표면) · 10 · 11(모드 D 백필) · 12(생성기 단독 처리량 실측) · 13(부하 측정의 생성기 CPU 기록) · 14(대조군 동일 행) · 15(모드 C 인증 비용) · 17(성능 비교 실행) **폐지 · 결번** · REQ-GEN-02 모드 B · C · D → **모드 B** · 03 대조군 백필 근거 삭제 · 06 측정용 주입 모드 삭제 · 16 · 19의 perf 실행 서술 삭제 · §주입 모드별 요구 적용 A~D → **A · B** · 에러 코드 인용 8 → **3** · §인계 판정 모드 D 행 삭제 — REQ-GEN 19 → **9**(결번 10) · (리드 판정 — 추적성 재생성 검산) 관련 기능 열의 결번 기능 인용 정리 — REQ-GEN-05 GEN-06 · 07 · 08 → **GEN-12**(모드 B는 흐름 시연 실행이 쓴다) · REQ-GEN-07 GEN-06 → **GEN-12** · D-16 정리(d4 전역 sweep) — REQ-GEN-18 HTTP 대안의 인가 · 레이트 리밋 → 표면 검증
> **개정일**: 2026-10-03 — 센서 자동 생성 게이트(사용자 결정 2026-10-03 · SENSOR_AUTOGEN — 스위치 밖) — REQ-GEN-06 요구 칸에 **off 동작 한 줄**(모드 A 틱 없음) · REQ-GEN-18 요구 칸에 **게이트와 무관하게 돈다** — REQ 수 불변
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9 · 리드 판정 2026-10-03) — REQ-GEN-18 검증 열에 **rlt_latest_requests_total hit 증가 > 0** — 요구 수 불변
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9) — REQ-GEN-18 범위 확장(새 REQ 없음) — publish 동안 **조회 3종을 readsPerSec로 섞는다**(프로세스 안 호출 · 같은 서비스 메서드 · cache-aside 그대로 · 히트와 미스가 둘 다 생기는 키 선택 · 실패는 세기만 · readsSent) · 위반 · 검증 열에 조회 조건 · 흐름 열 F-02 · F-05 · F-09 → **F-02 · F-03 · F-04 · F-05 · F-09** — 요구 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — REQ-GEN-18 업무 명령 이름 토글 짝 → **시연 전용 설비 DEMO-FLOW-DEV에만 새 이름 명령**(prepare가 없으면 명령으로 만든다 · 되돌림 없음) · 검증 "실행 뒤 device 행 값 불변" → **실행 뒤 시연 전용 행 밖의 마스터 행 불변** · 위반 열 "운영 설비에 명령을 보내면 시연이 운영 마스터를 바꾼다" · REQ-GEN-17 생성 식(ts 오름차순 삽입 · 두 저장소 같은 식) · REQ-GEN-19 전용 PostgreSQL 연결 pid 취소 · 종결 규칙(정상 경로 정리 실패 → failed · 정리 중 중단 무시) — 요구 수 불변
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 "시작 · 중단 · 완료 표시 · 소요 시간" · 리드 판정 10) — **REQ-GEN-16~19** 신설(16 동시 실행 하나 · 409 · 17 성능 실행 단계 · 정리 · 18 흐름 실행 발행 · 드레인 · 19 중단 · 경과 시간 · 완료 표시) · 기능 → REQ 대응에 GEN-11 · 12 · 에러 코드 인용 5 → **8**(datagen.run_in_progress/409 · common.not_found/404 · 라이브 실행의 common.validation_failed/400) · 코드를 내는 자리 1 → **2**(부하 주입 · 라이브 실행) — REQ-GEN 15 → **19**
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146) — 미확인 "생성기 단독 처리량" 미확인 → **워커 1 약 590만 pps**(압축률은 미확인 유지)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 과거 ts와 STALE 행 닫힘(실험 프로토콜 규칙으로 강제)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(모드 D 대조군 절차 · 부하 주입 표면 게이트 · 본문) — REQ 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 메트릭 이름 반영 · 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-GEN-07 · 09 스트림 길이 검사 → **미확인 적체 검사**(ADR-21) · 모드 B 검사 기전 W4 판정 반영 — REQ 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 모드 B 검사의 판정량을 그룹 적체로 교정(ADR-21)
> **원천**: 원본 tech_stack.md §3.4 · §7 · §8(커밋 ff66a37) · 원본 data_flow.md §11 · §11.1 · §11.2 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3(커밋 ff66a37) · 원본 implementation_plan.md §5 S1(커밋 ff66a37) · 사용자 요구 2026-09-28(라이브 실행 제어) · D-16(사용자 결정 2026-10-11) · 사용자 결정 2026-10-11(⑤ 실시간 그래프) · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-01~03 · 05 · 12 · [../07_api/09_datagen.md](../07_api/09_datagen.md) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen 네임스페이스 · [01_global_rules.md](./01_global_rules.md)

이 문서는 GEN 기능 7개의 동작 계약을 고정한다. GEN은 실장비가 없는 이 시스템에서 **파이프라인에 넣는 데이터를 만드는 도메인**이다 — 생성기가 틀리면 화면에 보이는 모든 흐름이 틀리고, 생성기가 병목이면 보이는 흐름이 생성기의 한계다.

**GEN의 요구는 세 종류로 갈린다.** 하나는 파이프라인에 넣는 데이터의 **정합**(표지 · 결측 · 페이로드 계약 · 적체 검사 · 시드 · 모드 단일성)이고, 둘째는 **라이브 실행 제어**(REQ-GEN-16 · 18 · 19 · 사용자 요구 2026-09-28)이며, 셋째는 **직접 비교 · 센서 데이터**(REQ-GEN-20~24 · D-16)다 — 같은 배치가 두 저장소에 실렸다는 것과 지운 것 · 남긴 것이 계약대로라는 것을 요구한다. 둘째는 — 측정이 아니라 시연이므로 **시연이 운영 데이터를 오염시키지 않는 것**(동시 실행 하나 · 시연 전용 행 · 기록 비생성)과 **사용자가 보는 진행 · 완료 · 소요 시간이 참인 것**을 요구한다. 측정 도구(티어 · 모드 C · D · 대조군 백필 · 단독 처리량 실측)와 옛 성능 비교 실행의 요구는 D-16으로 지웠다([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)).

**에러 코드를 내는 자리는 셋이다** — 라이브 실행 표면(GEN-12 · 13 — 07_api/09_datagen #2~#5) · 직접 비교 최근 결과(#6) · 센서 데이터 표면(GEN-14 — #7 · #8). 나머지 기능은 실행 인자로 돌며 실패가 메트릭으로 드러나고, 라이브 실행의 실패도 코드가 아니라 실행 객체의 status failed로 드러난다.

## 요구사항 — 생성 · 표지 · 재현성

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-01** | 태그마다 신호 프로파일 8종(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) 중 하나로 값을 만든다. 태그 N × 시점 M을 TypedArray에 한 번에 채우고 worker_threads 풀에서 병렬화한다 — 생성 연산을 이벤트 루프에서 하지 않는다. S2는 SINE 1종이다 | 원본 tech_stack.md §7 · 원본 data_flow.md §11 · REQ-GLB-20 | 이벤트 루프에서 생성하면 같은 프로세스의 수집 · 조회가 생성 부하에 밀려, 측정한 조회 p95가 생성기 비용을 포함한다 | 생성 중 nodejs_eventloop_lag_p95_seconds 대 생성 중지 시 대조 · 프로파일별 샘플 파형 확인 | GEN-01 | F-09 | 해당 없음 |
| **REQ-GEN-02** | 모드 B(흐름 시연 실행)의 산출 행은 **전부 SIMULATED(9)**로 싣는다. DROPOUT의 결측은 BAD 코드를 다는 대신 **행을 생략**한다. SPIKE는 기저값 위 확률적 이상치다. 모드 A의 표지는 Collector가 단다 | 원본 data_flow.md §3.2 · §11 · REQ-GLB-18 · W1 판정 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | 결측에 BAD를 달면 그 행의 품질 칸이 출처 표지(9)를 잃어 생성 데이터를 구분할 수 없게 된다. 모드 B 산출이 0으로 저장되면 실데이터와 섞인 뒤 복원할 방법이 없다 | 모드 B · C · D 적재 후 quality 분포(9뿐) · DROPOUT 태그의 기대 행 수 대비 실제 행 수 조회 | GEN-02 | F-09 | 해당 없음 |
| **REQ-GEN-03** | 난수 시드를 실행 인자로 받고 고정한다. 같은 시드 · 같은 구간 · 같은 태그 집합은 **같은 행 집합**을 만든다 | 원본 tech_stack.md §7 · 원본 data_flow.md §11 · REQ-GLB-17 | 시드가 없으면 두 실행이 다른 데이터를 받아 차이의 원인이 조건인지 데이터인지 가를 수 없다 | 같은 시드로 2회 생성한 결과의 행 수 · 값 합 대조 | GEN-03 | F-09 | 해당 없음 |
| **REQ-GEN-05** | **한 번에 한 주입 모드만 쓴다.** 주입 모드는 측정 기록의 실험 조건에 적는다. SW-01 off 실험은 모드 A로만 한다 | 원본 data_flow.md §11.1 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #2 | 모드 A와 B를 동시에 돌리면 어느 계층이 병목인지 가를 수 없다. SW-01 off에 모드 B를 걸면 Stream 없는 구성에 Stream 직결 주입을 거는 모순이 된다 | 실험 실행 중 활성 주입 경로 수 = 1 확인 · 측정 기록 주입 모드 칸 | GEN-05 · GEN-12 | F-09 | 해당 없음 |

## 요구사항 — 주입 모드

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-06** | 모드 A는 PlcSim 레지스터 Buffer를 주기적으로 갱신하고 Collector 폴링을 거친다. 모드 A로 재는 것은 진짜 E2E와 Modbus 병목이며 **DB 상한을 모드 A로 판정하지 않는다**. **설비 가동이 꺼져 있으면 모드 A 틱을 돌지 않는다**(RLT-10 · REQ-RLT-19 — 실행 중 상태 ctl:plant:power · 키가 없으면 기동 기본값 SENSOR_AUTOGEN) — SIM 포트 · Collector 폴링과 함께 꺼지고 센서 데이터는 흐름 시연 · 직접 비교 실행(REQ-GEN-18 · 21)만 보낸다(이름 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)) | 원본 data_flow.md §11.1 · [05_plc_sim.md](./05_plc_sim.md) REQ-SIM-06 | 모드 A로 DB 상한을 재면 Modbus가 먼저 막혀 **ClickHouse 한계가 실제보다 낮게 기록된다** | 모드 A 부하 상승 중 poll_duration 포화가 insert_duration 포화보다 먼저 오는지 기록 | GEN-05 | F-01 · F-09 | 해당 없음 |
| **REQ-GEN-07** | 모드 B는 stream:plc:raw에 직접 XADD하며 Collector와 **같은 페이로드 계약**(스키마 버전 v 포함)을 따른다. **모드 B도 XADD 전에 미확인 적체(그룹 lag + pending — XLEN이 아니다 · ADR-21)를 검사하고 백프레셔 위험 단계면 발행을 멈추고 멈춘 엔트리 수를 계측한다** — 검사를 우회한 발행자가 되지 않는다. 검사의 기전은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) | 원본 architecture.md §9.3 · 원본 data_flow.md §12.1 · REQ-GLB-10 · 21 · 웨이브 인계(모드 B 길이 검사) | 모드 B가 검사하지 않으면 모드 B가 바로 MAXLEN이 막으려던 "우회한 발행자"가 되어 위험 단계에서 **미소비 엔트리가 조용히 잘린다** — 무손실 판정이 거짓 실패하고 원인이 적재 쪽으로 오인된다 | 모드 B로 위험 단계까지 부하 → stream_trimmed_unacked 0 · 발행 중단 계수 증가 · 샘플 엔트리 v 대조 | GEN-12 | F-02 · F-09 · F-10 | 해당 없음 |

## 요구사항 — 라이브 실행 제어

표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) §라이브 실행 제어 · 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §라이브 실행. 결과는 전부 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"이다 — 이 요구들은 수치의 정확도가 아니라 **시연의 무해성과 표시의 참**을 검증한다.

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-16** | 라이브 실행은 **한 번에 하나**다(흐름 시연 flow · 직접 비교 compare가 같은 틀을 쓴다 — 종류가 달라도 서로 막는다). 진행 중(running · stopping) 실행이 있을 때 시작 요청은 datagen.run_in_progress/409(details {runId, type})로 거절하고, 확인과 생성을 한 임계 구역으로 묶어 동시 시작 두 건 중 하나만 running이 된다. 실행 상태는 api 인스턴스 메모리에 두고 재기동이면 실행은 사라진다(실패가 아니라 기록 없음) | 사용자 요구 2026-09-28 · 리드 판정 2 · 3 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen | 두 실행이 함께 돌면 서로의 발행 · 적재가 섞여 화면이 서로의 부하를 보인다 · 임계 구역이 없으면 동시 클릭 두 번에 실행 둘이 running이 된다 | flow 실행 중 두 번째 시작 → 409 · details.runId = 진행 중 runId · 시작 요청 2건 동시 발사 → 202 1 + 409 1 · 재기동 뒤 현재 실행 null | GEN-12 | F-09 | datagen.run_in_progress/409 |
| **REQ-GEN-18** | 흐름 시연 실행(flow)은 durationSec 동안 api 안의 생성기가 stream:plc:raw에 **엔트리 계약 v1 그대로**(시연 전용 설비 DEMO-FLOW-DEV의 **flow 전용 태그 50** — DEMO-FLOW-DEV-T01~T50 · FLOAT32 · 1초 · 범위 0~100 · prepare가 없는 것만 master.tag.create 명령으로 만든다 · quality 9 · 현재 시각) pps만큼 발행하고, 모드 B와 같은 적체 검사로 백프레셔 위험 단계면 멈췄다 해제되면 잇는다(멈춘 횟수를 센다 · gen_points_generated_total의 mode 값 run). 1 ÷ bizPerSec초마다 BizWritePort로 명령 master.device.patch를 **시연 전용 설비 DEMO-FLOW-DEV에만**(사이트 DEMO-FLOW · 라인 DEMO-FLOW-L · 비활성 · 태그는 flow 전용 50뿐 — prepare가 없으면 명령으로 만든다 · 본문은 매번 새 이름 · 되돌림 없음 · actor null) 하나 싣고 결과(성공 · 202 · 오류)를 센다(명령 1건 = 1). publish 동안 1 ÷ readsPerSec초마다 **조회 하나**를 센서 시계열 · 센서 지금 값 · 업무 설비 목록 차례로 보낸다 — 표면 뒤의 같은 서비스 메서드를 프로세스 안에서 불러 사람의 조회와 같은 cache-aside 경로(있으면 Redis 사본 · 없으면 ClickHouse · PostgreSQL 뒤 사본 담기)를 타고 · 같은 키 반복과 주기적 새 키로 히트와 미스가 둘 다 생기게 고르며 · 일정대로 보내고 기다리지 않되 동시 진행 상한을 넘으면 건너뛰고 · 결과는 버리고 · **조회 실패는 실행을 멈추거나 failed로 만들지 않는다**(result는 보낸 수 readsSent만 싣는다 — 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §흐름 시연 실행). publish 뒤 drain은 grp:ingest 적체가 시작 전 수준으로 돌아올 때까지(상한 30초 — 넘으면 done + timedOut) 기다린다. flow 프레임 계약은 바꾸지 않는다. **설비 가동과 무관하게 돈다** — 수집기를 거치지 않고 stream에 직접 발행하므로 가동이 꺼진 스택에서도 화면의 센서 원천이 된다 · **카드 라인 30대의 태그에는 쓰지 않는다**(r5 검수 H2) | 리드 판정 EXP-FLOW · REQ-GEN-07 · REQ-GLB-10 · 21 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) | 적체 검사 없이 발행하면 실행이 MAXLEN이 막으려던 "우회한 발행자"가 되어 미소비 엔트리가 조용히 잘린다 · 명령을 HTTP로 보내면 BFF 중계 · 표면 검증이 섞여 명령 경로가 아니라 표면 비용을 보인다 · **운영 설비에 명령을 보내면 시연이 운영 마스터를 바꾼다** — 바꿨다 되돌리는 짝은 중단 · 되돌림 실패 · 짝 가운데 재기동에서 바뀐 값을 남긴다 · 조회를 대기줄(Stream)에 넣거나 HTTP로 보내면 사람의 조회와 다른 경로를 보인다 · 조회 실패로 실행을 멈추면 ClickHouse 순간 불가가 시연 전체를 끊는다 · **카드 라인 태그에 발행하면 flow 값(0~99.9 톱니)이 rt:latest를 덮어 HMI 설비 칸의 지금 값 · 상태(STATE가 "코드 37.4") · 누적 수량이 거짓이 된다** | pps 50000 실행 중 stream_trimmed_unacked **0** · backpressurePauses 계수 · **실행 뒤 시연 전용 행 밖의 마스터 행 불변**(site · production_line · device · modbus_config 전 행 대조 — 중단 · 실패 실행 포함) · 원장 biz_command_log의 실행 구간 APPLIED 수 = result.commandsOk · drain 뒤 grp:ingest 적체 ≤ 시작 전 · readsPerSec 20 실행 구간에서 tsq_cache_requests_total · mst_cache_requests_total의 hit · miss 증가가 각각 0보다 크다(bizPerSec ≥ 0.5) · rlt_latest_requests_total의 hit 증가가 0보다 크다 · result.readsSent + publish detail.readsSkipped ≤ durationSec × readsPerSec의 정수 부분 · flow 실행 뒤 카드 라인 129 태그의 rt:latest 값 변화 0(리드 통합 확인 2026-10-11) | GEN-12 | F-02 · F-03 · F-04 · F-05 · F-09 | common.validation_failed/400 |
| **REQ-GEN-19** | 중단 요청은 status를 stopping으로 바꾸고 진행 중 단계에 **실제 취소**(발행 루프 · 업무 명령 · 조회 정지)를 건 뒤 stopped로 끝낸다 — 끝난 단계 done 유지 · 미실행 단계 skipped · 진행 중이던 단계 0~1개 stopped. 끝난 실행의 중단은 200 + 그대로다. elapsedMs는 서버가 계산하고(종결 endedAt − startedAt · 진행 중 응답 시각 − startedAt) 시각은 UTC ISO 8601 Z다. 종결 3값(completed · stopped · failed)은 다음 시작 전까지 현재 실행으로 남아 완료 표시 · 총 소요를 보인다. 단계 예외는 failed + error {code 또는 null, message}이며 에러 코드를 새로 만들지 않는다 | 사용자 요구 2026-09-28 · 리드 판정 5 · 6 · 7 · [../07_api/01_conventions.md](../07_api/01_conventions.md) §시각 직렬화 | status만 바꾸고 발행을 멈추지 않으면 중단 뒤에도 Stream에 시연 행이 쌓여 다음 실행 · 화면에 섞인다 · 화면이 브라우저 시계로 경과를 계산하면 시계 차만큼 틀리고 완료 순간 표시 시간이 뒤로 뛴다 · 종결 실행을 바로 지우면 완료 표시가 폴링 한 번 뒤 사라진다 | flow 실행 중 중단 → 수 초 안 gen_points_generated_total{mode="run"} 증가 0 · status stopped · 종결 실행의 elapsedMs = endedAt − startedAt(ms 정확 일치) · 끝난 runId 중단 → 200 | GEN-12 | F-09 | common.not_found/404 · common.validation_failed/400 |

## 요구사항 — 직접 비교 · 센서 데이터

표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) §직접 비교 · §센서 데이터 · 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §직접 비교 실행 · 동시 적재 정본 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전. 직접 비교 결과도 앱 경유 시연값이다 — 요구는 수치가 아니라 **같은 배치 · 같은 질문 · 지운 범위**의 참을 검증한다(D-16 결정 2 · 5 · 업무 방해는 실측이 흔들려 판정 불가 — 사용자 결정 2026-10-11로 삭제).

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-GEN-20** | 직접 비교(compare)는 라이브 실행 틀(동시 하나 · 단계 · 중단 · 서버 경과 시간)을 그대로 쓰고 **실행 하나 = 부분 하나**(part — ingest · query · integrity 닫힌 집합 3)다. 넣기 · 무결성은 SW-09 off면 · **설비 가동이 켜져 있으면 시작 전에** common.validation_failed/400(fields path SW-09 · plant · reason enum)으로 거절한다 — 가동 상태를 읽지 못하면 realtime.latest_unavailable/503 · 조회 대결은 둘 다 막지 않는다. 센서 데이터를 지우는 동안은 어떤 실행도 시작하지 않는다(400 path purge · REQ-GEN-24). PostgreSQL 쪽 싣기는 실행이 Redis 게이트 cache:dual:active(값 runId · TTL 10초 · 2초마다 다시 쓴다)를 켠 동안만 열리고, 켜고 끈 뒤 1초를 기다린다(flusher 읽기 캐시 500 ms가 새 판정을 보게). 종결(완료 · 중단 · 실패)마다 게이트를 끄고 backpressure_stage{publisher="compare"}를 0으로 되돌린다. 종결 직전 PostgreSQL run_result에 1행(runId · part · params · status · result는 완료만 · 시작 · 끝 · 커밋 · 스위치 값 · plant_on = 시작 또는 끝에 설비 가동 켜짐)을 남기고 부분별 **최근 완료 1건 + 부분별 마지막 시도**(attempts {runId, status, endedAt})를 낸다(지금 부분 집합 밖의 옛 행은 읽지 않는다 · 결과 json이 지금 계약과 어긋나면 result만 null) · 보관 실패는 종결을 막지 않는다 · **진행 중 값은 남기지 않는다**(실행 객체의 진행 중 result는 REQ-GEN-21~23 — 보관은 완료한 실행의 최종 결과뿐). **결과는 실측 그대로 낸다** — 예상(ClickHouse가 늘 빠르다)과 달라도 고치지 않는다 | D-16 결정 2 · REQ-GEN-16 · 19 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #11 · ADR-28 | SW-09 off에서 넣기를 받으면 PostgreSQL 0행이 "PostgreSQL이 못 받는다"로 기록되고 무결성은 막지 않았는데 막은 것처럼 읽힌다 · 게이트를 끄지 않고 끝내면 TTL 10초 동안 설비 가동 배치가 PostgreSQL에 실려 비교 사본이 구간 밖으로 자란다 · 보관이 없으면 api 재기동 뒤 ⑤ 패널의 마지막 결과가 사라진다 · plant_on이 없으면 가동 부하가 섞인 값과 아닌 값이 같은 조건으로 읽힌다 · 가동 켠 채 넣기를 받으면 가동 엔트리가 같은 배치에 섞이고 최대 속도 발행의 적체 뒤에서 수 초 밀려 HMI가 설비를 통신 끊김으로 보인다 · 최근 종결 1건만 내면 조회 대결 하나를 중단한 순간 데이터가 그대로인데도 앞 완료 결과가 사라진다 · 진행 중 값을 보관하면 중단된 넣기의 반쪽 값(사흘 창을 비우고 앞부분만 채운 구간)이 다음 진입 때 완료 결과처럼 보인다 | api 시험 runs-compare(SW-09 off 400 · 가동 중 400 path plant · 중단 → stopped · 게이트 꺼짐 · result null 보관 · 부분별 최근 완료 1건 + attempts · 보관 실패 무해) · runs-gate · 실기동 — 실행 종결 뒤 10초 안 cache:dual:active 없음 · run_result 1행 · 가동 중 넣기 400 path plant(리드 통합 확인 2026-10-11) | GEN-13 | F-09 · F-02 | common.validation_failed/400 · datagen.run_in_progress/409 · realtime.latest_unavailable/503 |
| **REQ-GEN-21** | 넣기(ingest)는 구간 = **오늘(UTC) 자정에서 4일 전 00:00(KST 09:00)부터 spanHours**(1 · 24 · 72)다 — 지금 흐르는 가동 데이터 · 보존 7일과 겹치지 않는다. 발행 전에 **대기줄 적체(lag + pending)가 0이 될 때까지 기다리고**(상한 30초 — 넘으면 비우기 전에 failed) 가장 긴 구간(72시간 = UTC 날 3) 창을 두 저장소에서 **하루 단위째** 비우고(ClickHouse 일 파티션 DROP · 롤업 3은 구간 버킷 동기 삭제 · PostgreSQL — 009 함수 control_clear_range가 구간이 통째로 덮은 하루 칸을 drop_chunks · 칸은 넣을 때 스스로 생겨 미리 만들지 않는다) **비운 뒤에** 게이트를 켠다. 카드 라인 활성 설비 · 태그(시드)로 구간 행을 주기대로 결정적으로 만들어(설비 1초분 = 엔트리 1 · 엔트리 계약 v1 · quality 9) stream:plc:raw에 최대 속도로 발행한다 — 적체 검사로 위험 단계면 **기다렸다 잇고 버리지 않는다**(비교 행이 빠지면 대조가 성립하지 않는다 · 발행 실패면 실행을 멈춘다). **발행이 시작되면 실행 객체의 결과를 1초마다 중간값으로 바꾼다** — 보낸 행 · 지금까지 각 DB에 들어간 행(Ingest 계측의 실행 앞 대비 차분) · 발행 시작부터의 경과 · 초당 행(두 DB 중 적은 쪽 ÷ 경과) · 배치 수 · p50 · p95 · COPY 실패(히스토그램 차분) · 지금까지의 초별 점 · 크기는 2초마다 구간 UTC 날의 크기(ClickHouse 일 파티션 · PostgreSQL 하루 칸 — 병합 · 압축 전 · 마지막 읽기 뒤 조각이 빠진 순간값이라 최종값과 다를 수 있다 · 첫 값 전 null · 한 저장소 읽기 실패면 그 저장소만 null) — publish · drain 내내 바뀌고 끝나기 전 값으로 행 수 같음 · 크기 배수를 판정하지 않는다 · 표본기가 멈춘 뒤 늦게 끝난 표본은 버린다(최종 결과를 덮지 않게). 적체가 시작 수준으로 돌아오고 ClickHouse 구간 행 ≥ 발행 행이면(상한 180초 · 넘으면 timedOut) 마지막 COPY를 기다린 뒤 게이트를 끄고 **ClickHouse 구간 파티션 병합(FINAL) · PostgreSQL 구간 칸 열 압축(009 함수 control_compress_range — 압축한 칸은 통계를 다시 모은다)** 뒤 결과를 최종값으로 바꾼다 — 행 수(발행 · ClickHouse · PostgreSQL · 다르면 그대로) · 걸린 시간(소진 확인까지) · 초당 행 · 배치 수 · 배치 하나 시간 p50 · p95(insert_duration 대 ing_control_copy_seconds의 실행 앞뒤 버킷 차) · COPY 실패 수 · 디스크 크기(UTC 날별 크기 × 구간 몫 — ClickHouse는 병합한 파티션 크기 · PostgreSQL은 압축한 칸 크기(압축 데이터 포함 — TimescaleDB 칸 크기 함수)) · 초 단위 timeline. 소진 상한 초과 · 병합 실패 · **압축 실패**(크기는 압축 전 값 · detail compressed false · 넣기는 완료로 끝난다)는 결과가 아니라 그 단계 detail의 경고로 남긴다 — 결과 계약은 그대로다 | D-16 결정 2 · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · 기록 045(묶음 COPY 대 삽입) · REQ-GEN-07 · REQ-GLB-10 | 비우지 않으면 앞 넣기의 더 긴 구간이 남아 "쌓인 비교 데이터"가 이번 넣기보다 크게 보이고 행 수 대조가 어긋난다 · 게이트를 비우기 전에 켜면 비우는 동안 실린 배치가 다시 지워진다 · 위험 단계에서 버리면 발행 ≠ ClickHouse가 결함처럼 보인다 · 누적 히스토그램을 그대로 읽으면 앞 실행 표본이 섞인다 · 병합 전 크기를 재면 작은 파트 여럿의 크기라 압축 차가 작게 보인다 · 압축 전에 재면 PostgreSQL 크기가 행 저장 그대로라 TimescaleDB 열 압축이 결과에 보이지 않는다 · 칸 크기를 상속 자식 표 합으로 읽으면 압축 데이터가 따로 둔 압축 표에 있어 압축 뒤 PostgreSQL 크기가 거의 0으로 보인다 · **구간을 KST 자정에서 시작하면 첫 UTC 날이 늘 걸친 날이라 행 단위 DELETE 뒤 같은 자리로 COPY가 들어와 죽은 행 자리만큼 PostgreSQL 파일이 부풀어 "디스크 N배"가 넣기를 거듭할수록 커진다** · 앞 실행의 남은 적체를 기다리지 않으면 같은 (설비 · 태그 · 시각)이 비운 구간에 들어와 ClickHouse는 두 번 저장 · PostgreSQL은 기본 키 충돌로 배치 COPY를 통째로 롤백한다 · 끝난 뒤에만 결과를 내면 사흘치 넣기 동안 ⑤ 넣기 패널이 빈 채로 있어 넣는 과정을 볼 수 없다 · 중간 행 수로 같음을 판정하면 COPY가 늦게 끝나는 순간마다 PostgreSQL이 덜 받은 것처럼 보인다 | api 시험 runs-compare(1시간치 — 발행 = ClickHouse = PostgreSQL · 게이트 켰다가 끔 · 결과 계약 모양 · 창 계산 UTC 자정 · 보존 안 · 행 생성 결정적 · 적체 0 대기 · 상한 초과 failed) · 실기동 — 1시간치 발행 = ClickHouse = PostgreSQL = 831,600행(설비 30 · 1초 231점 × 3,600초 — 구조값) · COPY 실패 0 · 1시간 → 24시간 → 1시간 넣기 뒤 PostgreSQL 크기가 첫 1시간 넣기 수준으로 돌아온다(리드 통합 확인 2026-10-11) · api 시험 runs-compare 넣는 중 결과(계측 차분 · 속도는 두 DB 중 적은 쪽 ÷ 경과 · 계약 모양 · 표본마다 onSample · 멈춘 뒤 늦은 표본 버림) · 넣는 중 runs/current 연속 응답에서 result.rows.published · timeline 길이가 줄지 않고 verify 뒤 rows가 저장소 구간 행 수와 같다 · api 시험 runs-compare(verify detail optimized · compressed true · 압축 실패면 compressed false · 경고 · 넣기 완료 · 결과 계약 그대로) | GEN-13 | F-09 · F-02 | 해당 없음 — 실패는 실행 status |
| **REQ-GEN-22** | 조회 대결(query)은 **마지막 넣기(상태 무관)가 완료일 때 그 구간**을 쓴다 — 넣기가 없거나(reason no_ingest) · 마지막 넣기가 중단 · 실패했거나(ingest_incomplete — 앞의 완료 구간도 쓰지 않는다) · 그 구간에 두 저장소 중 하나라도 행이 없으면(no_rows) 시작 전에 datagen.compare_no_data/409(details {part, reason, range})로 거절한다. 4문항을 두 저장소에 **같은 뜻의 질의**로 묻는다 — 소량 2(sensor-1m — 진동 태그 L1-MIL-VIB 구간 마지막 1분 원본 · device-latest — 설비 L1-LAM 태그별 구간 끝 마지막 값) · 대량 2(hourly-avg — 전체 설비 · 태그 시간별 평균 · 원본 전부 · daily-output — 라인 · KST 날별 수량 태그 (최대 − 최소) 합). PostgreSQL 쪽은 기본 키를 타는 정상 질의(태그별 마지막 값은 LATERAL + LIMIT 1)이고 값은 전부 바인딩이다 — 질의는 TimescaleDB 전환 뒤에도 그대로이며 **넣기가 압축한 칸을 읽는다**(D-05 부분 개정 · ADR-32). 측정 규칙은 워밍업 1 + 3회 · 중간값 · 결과 행 수를 함께 내고 **승자는 3회 모두 같은 쪽이 빨랐을 때만**(아니면 null) · ratio = 느린 쪽 중간값 ÷ 빠른 쪽 중간값. 질문 하나가 끝날 때마다 실행 객체 결과의 questions[]에 그 줄을 붙인다(prepare 동안 결과 null) | D-16 결정 2 · 옛 perf 측정 규칙(apps/api modules/runs/measure.ts로 옮김) · REQ-GLB-24 | 넣지 않은 구간을 물으면 두 저장소가 0행을 빠르게 돌려줘 "둘 다 빠르다"가 결론이 된다 · PostgreSQL에 키를 안 타는 질의를 주면 "RDB를 제대로 쓰면"이 아니라 잘못 쓴 RDB를 잰다 · 1회 측정이나 한 번 이긴 쪽을 승자로 두면 노트북 Docker의 CPU 경합 흔들림이 승패를 뒤집는다 · 결과 행 수를 대조하지 않으면 다른 답을 낸 두 질의의 속도를 비교한다 · 중단한 넣기 뒤에 앞 완료 구간으로 재면 그 넣기가 이미 사흘 창을 비웠고 앞부분만 다시 채워 두 저장소가 다른 행 집합으로 승패를 낸다 · 끝난 뒤에만 결과를 내면 ⑤ 조회 패널이 네 질문이 다 끝날 때까지 비어 어느 질문을 재는 중인지 볼 수 없다 | api 시험 runs-compare(넣기 전 → 409 no_ingest · 마지막 넣기 중단 → 409 ingest_incomplete · 실행을 만들지 않는다 · 4문항 소량 2 대량 2 · 결과 행 수 · 배수 · 대상 L1-MIL-VIB · L1-LAM) · SQL 모양 시험(기본 키 · LATERAL · 바인딩) | GEN-13 | F-04 | datagen.compare_no_data/409 |
| **REQ-GEN-23** | 무결성(integrity)은 넣기 사흘 창과 다른 UTC 날의 시험 창(**오늘(UTC) 6일 전 13:00~14:00 — KST 22~23시** · 10분 슬롯 3)에서 시험 셋을 **각각 따로** 발행한다(앞 시험이 flusher를 지난 뒤 다음 — 한 배치에 섞이지 않게) — duplicate(같은 100행을 두 번) · unknown-device(device에 없는 설비 ID — 시작 때 없음을 확인) · fault-value(FLOAT32 최댓값 — 센서 고장 표지). 대상 설비는 시연 전용 DEMO-FLOW-DEV(없으면 업무 명령으로 만든다 · HMI에 안 보인다) · 시험 태그는 시드와 겹치지 않는 높은 대역이다. 결과는 시험마다 보낸 행 · ClickHouse 저장 행 · PostgreSQL 저장 행 · **막음 = PostgreSQL 행이 늘지 않았고 그 보냄의 COPY 실패 차분 > 0** · 막은 규칙(쉬운 말)이다. **NaN · Infinity는 시험하지 않는다** — Stream 엔트리 계약(va 유한 값)이 소비자 디코더에서 먼저 DLQ로 막아 두 DB에 닿지 않는다 — 같은 성격의 값 규칙(PostgreSQL CHECK 범위 ±1조)으로 잰다. 비교 사본이 TimescaleDB hypertable이어도 규칙 셋은 칸의 압축 여부와 무관하게 같이 막는다(실측 확인 2026-10-12 · ADR-32). 끝나면(중단 · 실패 포함 — 정리 단계는 중단을 무시한다) 게이트를 끄고 시험 창을 비우고 시험이 만든 rt:latest 키를 지운다. 시험 하나가 끝날 때마다 실행 객체 결과의 tests[]에 그 줄을 붙인다(prepare 동안 결과 null · 정리 단계는 결과를 바꾸지 않는다) | D-16 결정 2 · 지침 "스트림 계약이 먼저 막는 행은 같은 성격의 DB 규칙으로 바꾼다" · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) · 마이그레이션 007 · 009(키 · 참조 · 값 규칙 그대로) | 시험 셋을 한 배치에 섞으면 PostgreSQL COPY가 첫 위반 행에서 통째로 롤백돼 어느 규칙이 막았는지 가를 수 없다 · NaN을 그대로 보내면 디코더 DLQ가 막아 "ClickHouse도 막았다"가 거짓으로 기록된다 · 게이트를 켜지 못한 채(PostgreSQL이 받지 않음) 0행을 막음으로 세면 무결성이 거짓 성립한다 · 정리를 건너뛰면 시험 설비의 rt:latest · 시험 행이 남아 화면 · 현황에 섞인다 · 끝난 뒤에만 결과를 내면 ⑤ 무결성 패널이 세 시험이 다 끝날 때까지 비어 있다 | api 시험 runs-compare(건수 · 막은 규칙 · 끝나면 창 · rt:latest 정리 · 게이트가 안 켜지면 막음 0) · 실기동 — duplicate CH 200 · PG 100 / unknown-device CH 100 · PG 0 / fault-value CH 100 · PG 0(리드 통합 확인 2026-10-11 — 보낸 행 100 기준 구조값) | GEN-13 | F-09 · F-02 | 해당 없음 — 실패는 실행 status |
| **REQ-GEN-24** | 센서 데이터 현황(#7)은 ClickHouse tag_raw 행 · 디스크 크기(활성 파트) · PostgreSQL 비교 사본 행 · 크기 · Redis stream:plc:raw 길이 · rt:latest 키 수 · 마지막 넣기가 완료일 때 그 구간과 **구간 안 두 저장소 행 수**(넣기가 센 값을 다시 쓴다 — 지금 ClickHouse에 행이 있을 때만)를 낸다 — 5초 사본 · PostgreSQL 행 세기가 3초를 넘으면 통계 추정치. 지우기(#8)는 **쌓인 센서 데이터만** 지운다 — ClickHouse tag_raw · tag_1m · tag_1h · tag_1d TRUNCATE · PostgreSQL 비교 사본 전부(007 SECURITY DEFINER 함수 control_purge) · Redis stream:plc:raw · stream:plc:dlq 엔트리(XTRIM MAXLEN 0 — **소비 그룹 · 키는 남긴다**) · rt:latest 전부(SCAN · UNLINK — KEYS 금지) · 조회 사본 cache:q(SCAN · DEL · degrade면 TTL에 맡긴다). 설비 · 태그 · 업무 · run_result는 남긴다. **지우는 동안 새 행이 들어올 길이 열려 있으면 data.purge_blocked/409**다 — details.reason을 이 순서로 하나 낸다: run_in_progress(실행 진행 중) · plant_running(설비 가동 원하는 상태 켜짐 · 켜는 중 · 이 프로세스의 수집기가 아직 도는 중 — 가동 상태를 읽지 못하면 켜진 것으로 본다) · stream_backlog(대기줄 적체 lag + pending > 0 — 읽지 못하면 막지 않는다). **지우기는 프로세스 안 잠금을 먼저 세우고 이유를 본다** — 지우는 동안 실행 시작 · 설비 켜기는 common.validation_failed/400(fields path purge)이고 끄기는 받는다(잠금은 api 하나 기준 — 한계 등재). 응답은 저장소별 지운 행 수(지우기 직전 정확 count) · 걸린 시간이고, 겹친 요청은 진행 중인 지우기 하나를 나눠 받는다. 상태를 바꾸는 POST라 본문은 JSON 빈 객체 {}다(REQ-GLB-27) | D-16 결정 5 · REQ-GLB-27 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) | 가동 중에 지우면 지우는 동안 새 행이 들어와 "지웠는데 남았다"가 결함처럼 보인다 · 소비 그룹까지 지우면 Ingest가 다음 읽기에서 그룹 없음 오류로 멈춘다 · KEYS로 훑으면 단일 Redis가 그 동안 멈춘다 · run_result를 지우면 ⑤ 패널의 마지막 결과가 지우기와 함께 사라진다 · 본문 없는 POST를 받으면 다른 출처 페이지의 폼 POST 하나로 센서 데이터가 지워진다 · 가동 키만 보고 통과시키면 끈 직후의 마지막 폴링 · 창 버퍼 · 적체의 마지막 배치가 TRUNCATE 뒤에 들어와 "지웠는데 행 · 지금 값이 남았다"가 된다 · 지우는 동안 넣기 · 가동 켜기를 받으면 지운 직후 새 행이 생긴다 | api 시험 sensor-data(409 세 이유 · 순서 · 읽기 실패 = 켜짐 · 적체 읽기 실패 = 통과 · 지우는 중 실행 시작 · 설비 켜기 400 · 겹친 요청 공유 · 직전 count) · 실기동 — 가동 중 · 끈 직후 409 plant_running · 본문 없는 지우기 400 · 지우기 200 뒤 현황 0행 · XINFO GROUPS grp:ingest 유지(리드 통합 확인 2026-10-11) | GEN-14 | 해당 없음 | data.purge_blocked/409 · common.validation_failed/400 |

- 검산: 현행 REQ-GEN = 생성 · 표지 · 재현성 4(01 · 02 · 03 · 05) + 주입 모드 2(06 · 07) + 라이브 실행 3(16 · 18 · 19) + 직접 비교 · 센서 데이터 5(20 · 21 · 22 · 23 · 24) = **14**

## 결번

| 범위 | 옛 요구 | 수 |
|------|------|------|
| REQ-GEN-04 | 부하 티어 | 1 |
| REQ-GEN-08 · 09 · 15 | 모드 C 부하 주입 표면 · 적체 거절 · 인증 비용 | 3 |
| REQ-GEN-10 · 11 · 14 | 모드 D 백필 절차 · 우회 · 대조군 동일 행 | 3 |
| REQ-GEN-12 · 13 | 생성기 단독 처리량 실측 · 부하 측정의 생성기 CPU 기록 | 2 |
| REQ-GEN-17 | 성능 비교 실행(perf — Redis를 거치지 않는 직접 재 보기) | 1 |

- 검산: 1 + 3 + 3 + 2 + 1 = **10** · 채번 현행 14 + 결번 10 = **24**(REQ-GEN-01~24) · 재사용 금지(D-16)

## 주입 모드별 요구 적용

| 요구 축 | 모드 A | 모드 B |
|------|------|------|
| SIMULATED 표지 주체 | Collector(REQ-COL-07) | 생성기(REQ-GEN-02) |
| 페이로드 계약 v | Collector가 싣는다 | 생성기가 싣는다(REQ-GEN-07) |
| 발행 전 적체 검사 | Collector(REQ-COL-10) | 생성기(REQ-GEN-07) |
| 위험 단계 반응 | 스풀 전환 | 발행 중단 + 계측 |
| 멱등 토큰 · 대조군 동시 적재 | 적용 | 적용 · 비교 사본은 직접 비교 실행 중 게이트가 열린 배치만(SW-09 gated) |
| 보이는 것 | 진짜 E2E · Modbus 병목 | Redis · Ingest · 저장소 쪽 흐름 |

- 검산: 모드 = A · B = **2** · 요구 축 = **6**행
- **적체 검사 행이 두 모드 모두 채워진 것이 REQ-GEN-07의 결과다.** 모드 B 칸이 비어 있으면 REQ-GLB-10의 "검사 없는 발행자" 잔여가 계측 없이 남는다.

## 기능 → REQ 대응

[../02_features/05_datagen.md](../02_features/05_datagen.md) 기능 목록의 GEN 기능 전부가 하나 이상의 REQ-GEN에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| GEN-01 | 신호 프로파일 생성 | REQ-GEN-01 | 1 |
| GEN-02 | 품질 표지와 결측 표현 | REQ-GEN-02 | 1 |
| GEN-03 | 시드 고정 | REQ-GEN-03 | 1 |
| GEN-05 | 모드 A 레지스터 갱신 | REQ-GEN-05 · 06 | 2 |
| GEN-12 | 흐름 시연 실행 | REQ-GEN-05 · 07 · 16 · 18 · 19 | 5 |
| GEN-13 | 직접 비교 실행 | REQ-GEN-07 · 16 · 19 · 20 · 21 · 22 · 23 | 7 |
| GEN-14 | 센서 데이터 현황 · 지우기 | REQ-GEN-24 | 1 |

### 검산

- 현행 기능 = **7** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 1 + 1 + 1 + 2 + 5 + 7 + 1 = **18**
- 현행 REQ-GEN = **14** · 기능에 대응하지 않는 현행 REQ **0**

## 에러 코드

GEN-12 · 13 · 14 표면만 코드를 낸다. 인용 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드뿐이다.

| 코드 | 발생 REQ | 클라이언트(실행 화면) 대응 |
|------|------|------|
| datagen.run_in_progress/409 | REQ-GEN-16 | details.runId로 진행 중 실행을 읽어 패널을 맞춘다 · 즉시 재시도 금지 |
| common.not_found/404 | REQ-GEN-19 | 현재 실행(09_datagen 표면)을 다시 읽는다(재기동으로 사라진 실행) |
| common.validation_failed/400 | REQ-GEN-18 · 19 · 20 · 24 | 매개변수를 값 집합 안에서 고른다 · runId 형식 확인 · SW-09 off면 설정을 gated로 바꾸고 api를 다시 띄운다 · 가동 중이면 설비 가동을 끈 뒤 · 지우는 중이면 끝난 뒤 · 본문은 Content-Type application/json(지우기 · 중단은 {}) |
| datagen.compare_no_data/409 | REQ-GEN-22 | 넣기를 끝까지 돌린 뒤 다시 시작한다(reason no_ingest · ingest_incomplete · no_rows 모두) |
| data.purge_blocked/409 | REQ-GEN-24 | reason run_in_progress면 실행이 끝난 뒤 · plant_running이면 설비 가동을 끄고 잠시 뒤 · stream_backlog면 잠시 뒤 다시 |
| realtime.latest_unavailable/503 | REQ-GEN-20 | 직접 비교 넣기 · 무결성이 설비 가동 상태를 읽지 못했다 — 백오프 뒤 다시 시작한다 |

- 검산: 인용 행 **6** · 정본 11_glossary/02에서 채번된 이 도메인의 코드 **3**(datagen.run_in_progress · datagen.compare_no_data · data.purge_blocked — 이 문서는 인용만) · 옛 datagen.bulk_disabled · datagen.stream_full은 모드 C와 함께 폐지(D-16)

## 인계 판정

| 인계 항목 | 판정 | 자리 |
|------|------|------|
| 모드 B의 적체 검사 — 검사하는지 없다 | **검사한다(요구 수준).** 위험 단계에서 발행을 멈추고 멈춘 수를 센다. 기전(파이프라인 적체 조회 · 임계 조회 계약 — 판정량은 XLEN이 아니라 그룹 적체, ADR-21)은 W4가 판정했다 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §모드 B 적체 검사 | REQ-GEN-07 |

- 검산: 인계 항목 = **1** · 새 코드 채번 제안 **0** — 모드 B는 표면이 없어 거절이 응답이 아니라 계측이다

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 모드 B 적체 검사의 기전 · 발행 중단 계수 메트릭 이름 | 기전 **W4 판정**(XADD + XINFO GROUPS 파이프라인 · 위험이면 중단 · 주의 임계 미만 재개) · 메트릭 이름 **W6 판정** — gen_publish_halted_entries_total · gen_publish_halted_points_total · backpressure_stage{publisher} | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 생성기 실행 제어 표면 | 모드 A는 원본 API 표에 없다 — 표면을 요구하지 않는다(W5 판정 유지) · 시연 실행은 **REQ-GEN-16 · 18 · 19가 요구한다**(사용자 요구 2026-09-28) | [../07_api/09_datagen.md](../07_api/09_datagen.md) §원본에 없는 표면 판정 |
| 라이브 실행 소요 시간 | 3계층 미확인 — 시연값이라 확정 대상이 아니다 | [../07_api/09_datagen.md](../07_api/09_datagen.md) §미확인 · 미설계 등재 |
| 생성기 단독 처리량 | **닫힘**(워커 1 약 590만 pps · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값) — 실행 도구는 D-16으로 삭제 | 기록 006 |

## 관련 문서

- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN 기능 목록 · 주입 모드
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-10 백프레셔 명시화 · REQ-GLB-18 생성 데이터 구분 · REQ-GLB-21 데이터 계약
- [07_ingest.md](./07_ingest.md) — 모드 B의 받는 쪽 · 대조군 동시 적재
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — F-09 주입 기전
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 라이브 실행 제어 표면
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-16 폐지 결정
