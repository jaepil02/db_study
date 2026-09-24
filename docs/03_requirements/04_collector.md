# REQ-COL — 수집 요구사항

> **대상**: 수집(COL · NestJS collector 모듈)의 동작 계약 — 정의 로드 · 폴링 · 블록 병합 · 디코딩 · 품질 판정 · SIMULATED 표지 · 데드밴드 · Stream 발행 · 발행량 감축 · 스풀 전환과 재발행 · 관측 — REQ-COL-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-COL-01 기동 로드 원천 → **PostgreSQL** · 실행 중 마스터 변경 재기동 전 미반영 → **ch:cacheinv 반영** · 미확인 4행 W4 판정 반영 — REQ 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — REQ-COL-10 판정량을 XLEN에서 그룹 적체(lag + pending)로 교정(ADR-21)
> **원천**: 원본 data_flow.md §3 · §3.1 · §3.2 · §3.3 · §12.1 · §12.2 · §14.1 · §15 · §16 · §17(커밋 ff66a37) · 원본 architecture.md §3 · §4 · §8.1 · §9 · §9.3 · §17(커밋 ff66a37) · 원본 tech_stack.md §5.3 · §6(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S3 · S6 · §7.2 · §7.5(커밋 ff66a37) · D-08 · [../02_features/03_collector.md](../02_features/03_collector.md) COL-01~09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-01 · SW-10 · [01_global_rules.md](./01_global_rules.md) REQ-GLB-03 · 10 · 18

이 문서는 COL 기능 9개의 동작 계약을 고정한다. COL은 PLC 레지스터를 정규화된 포인트로 바꿔 Stream 입구에 놓고, DB와 Ingest를 직접 부르지 않는다(REQ-GLB-03).

**COL에는 외부 표면이 없으므로 이 문서의 어떤 요구도 에러 코드로 실패하지 않는다.** 호출 주체가 기동과 폴링 타이머이고 HTTP 응답을 만드는 자리가 없다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 네임스페이스 배정 규칙). 실패는 **품질 코드 · 메트릭 · 상태 전이(스풀 전환)**로만 관측된다. 그래서 요구 표의 에러 코드 열은 전부 "해당 없음"이고, 그 자리를 **검증 방법 열의 지표**가 대신한다 — 지표 없이 적은 요구는 이 도메인에서 검증 불가능한 요구다(REQ-GLB-16).

## 요구사항 — 정의 로드 · 폴링 · 병합

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-COL-01** | 기동 시 활성 태그 정의와 설비별 modbus_config를 **PostgreSQL에서** 읽어 설비 × scan_rate_ms로 스캔 그룹을 만들고 cache:tagmeta:{tag_id}를 워밍한다 — 캐시는 기동 로드의 원천이 아니다(태그별 키는 열거할 수 없다). 기동 시 PostgreSQL이 불가면 폴링을 시작하지 않고 재시도한다. 폴링 중에는 포인트마다 PostgreSQL을 읽지 않는다. 실행 중 마스터 변경은 ch:cacheinv 신호를 받아 해당 설비만 다음 사이클 경계에 다시 읽는다(W4 판정 · [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)) | 원본 data_flow.md §3 · 원본 architecture.md §5 · 원본 tech_stack.md §5.3 마스터 캐시 | 포인트마다 PostgreSQL을 읽으면 M 티어에서 초당 1만 회 조회가 업무 DB로 가 업무 CRUD p95 측정이 수집 부하에 오염된다 | 폴링 중 pg_stat_statements의 tag_master 조회 수 증가 0 · cache:tagmeta 삭제 후 기동 성공 | COL-01 | F-01 | 해당 없음 — 기동 실패는 points_emitted 0 |
| **REQ-COL-02** | 설비당 Modbus 연결 1개 위에서 스캔 그룹마다 폴링 루프를 돈다. 응답이 설비별 timeout_ms 안에 오지 않으면 그 그룹은 그 주기를 건너뛰고 **행을 만들지 않으며** 타임아웃 계수를 올린다. 다음 주기는 자동으로 다시 시도한다 | 원본 data_flow.md §3 · 원본 architecture.md §17 Modbus 타임아웃 | 타임아웃에 행을 만들면 결측이 값처럼 저장되어 평균 · 롤업이 가짜 값을 포함한다. 건너뛰지 않고 대기하면 다음 주기가 밀려 폴링 주기가 붕괴한다 | SIM 지연 주입(REQ-SIM-08) → 타임아웃율 증가 · 해당 구간 tag_raw 행 없음 · 주입 해제 후 다음 주기 행 재개 | COL-02 | F-01 · F-10 | 해당 없음 — 타임아웃율 |
| **REQ-COL-03** | ts는 Collector가 폴링 시점에 api 컨테이너 시계로 찍는다(epoch ms). Modbus 응답에는 시각이 없다. 요청 직전 · 응답 직후 중 어느 쪽인지는 미확인이며 확정 전에는 두 시각을 모두 계측해 Modbus 왕복 히스토그램으로 남긴다 | 원본 data_flow.md §3 · §15 측정 방법 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) · REQ-GLB-01 | 채취 시점이 불명이면 모드 A E2E에서 Modbus 왕복이 포함되는지가 실행마다 달라져 두 측정을 비교할 수 없다 | 스캔 사이클별 요청 직전 · 응답 직후 시각과 ts 대조 · Modbus 왕복 히스토그램 존재 조회 | COL-02 | F-01 | 해당 없음 — Modbus 왕복 히스토그램 |
| **REQ-COL-04** | 연속 주소 태그를 한 요청으로 묶고 사이의 안 쓰는 레지스터를 허용 갭까지 함께 읽는다. 요청당 레지스터 수는 FC03 상한 125(1계층 프로토콜 제약) 이하이고 설비별 max_regs_per_request를 넘지 않는다. 허용 갭 크기는 2계층 조정값(현행 참고 20 레지스터 · 소유 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)) | 원본 data_flow.md §3.1 · 원본 architecture.md §6 modbus_config | 병합이 없으면 태그 1개당 요청 1회가 되어 설비 50대 · 1초 주기에서 초당 2만 5천 요청으로 **폴링 주기를 넘긴다** — F-01의 1차 병목이 설계로 확정된다 | 설비당 스캔 사이클의 요청 수 계측 · poll_duration < scan_rate 유지 확인 · 요청 레지스터 수 최대값 ≤ 125 | COL-03 | F-01 | 해당 없음 — poll_duration |

## 요구사항 — 디코딩 · 품질 · 표지 · 데드밴드

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-COL-05** | 디코딩 순서는 ① 워드 순서 적용 ② 타입 변환 ③ eng = raw × scale + offset_value다. 범위 판정은 ③ 뒤 공학 단위 값으로 한다. data_type · word_order 허용값은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)를 따르며 S2는 FLOAT32 · ABCD만 지원한다 | 원본 data_flow.md §3 디코딩 파이프라인 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 공학 단위 | raw로 범위를 판정하면 scale이 1이 아닌 태그에서 범위가 어긋난다. **word_order가 틀려도 예외가 나지 않는다** — 엉뚱한 유한값이 BAD_RANGE로만 드러나므로 순서가 바뀌면 원인 추적이 끊긴다 | 워드 순서 4종 × 타입별 기지값 레지스터를 SIM에 넣고 디코딩 결과 대조 · 틀린 word_order 설정 시 BAD_RANGE 발생 확인 | COL-04 | F-01 | 해당 없음 — 품질 코드 분포 |
| **REQ-COL-06** | 값마다 품질 코드를 단다 — Modbus 예외 응답 BAD_COMM(2) · 범위 밖 BAD_RANGE(4) · 실설비 정상 GOOD(0) · 시뮬레이션 설비 정상 SIMULATED(9). 타임아웃 BAD_TIMEOUT(3)은 행을 만들지 않는다. **건강 코드(2 · 4)가 출처 코드(9)보다 앞선다.** STALE(5) · UNCERTAIN(1)은 부여하지 않는다 — STALE은 조회 시점 판정이고 UNCERTAIN을 부여할 보간 단계가 없다 | 원본 data_flow.md §3.2 · [../02_features/03_collector.md](../02_features/03_collector.md) §모드 A의 SIMULATED 표지 판정 · REQ-GLB-18 | 오류 행에 9를 달면 범위 밖 값이 **알람 판정에 들어간다**(2 · 4만 판정 제외). Collector가 STALE을 쓰면 저장값이 조회 시점 판정을 선점해 복구 뒤에도 STALE이 남는다 | SIM 오류 주입 → quality 2 저장 · 범위 밖 값 → 4 · 정상 → 9 · quality 1 · 5 행 수 0 조회 | COL-05 | F-01 | 해당 없음 — 품질 코드 분포 |
| **REQ-COL-07** | 시뮬레이션 설비는 modbus_config.host가 컨테이너 루프백인 설비다. Collector는 이 판정을 설비 단위로 하고 정상 값에 SIMULATED(9)를 단다. 전역 환경변수 · 레지스터 품질 워드로 표지하지 않는다 | [../02_features/03_collector.md](../02_features/03_collector.md) §모드 A의 SIMULATED 표지 판정 · REQ-MST-03 | 전역 표지는 실설비 하나가 붙는 순간 한 프로세스 안의 **한쪽 전부가 틀린 표지**를 받는다. 품질 워드를 레지스터에 실으면 실장비로 바꿀 때 디코딩 경로를 고쳐야 한다 | 루프백 설비와 비루프백 설비를 함께 두고 정상 값 quality를 설비별로 대조 | COL-05 | F-01 · F-09 | 해당 없음 — 품질 코드 분포 |
| **REQ-COL-08** | 데드밴드는 직전 전송값 대비 변화량이 tag_master.deadband(공학 단위 절대값)보다 작으면 전송을 생략한다. SW-10이 켜고 끄며 **기본은 off**다. 성능 측정은 off로 하고 데드밴드 효과는 on으로 따로 잰다. SW-10 상태는 측정 기록 4요소에 들어간다 | 원본 data_flow.md §3.3 · 원본 implementation_plan.md §4.1 · D-08 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약 #5 | on을 성능 측정에 섞으면 원본 파형을 잃고 전송량이 달라져 처리량 수치가 의미를 잃는다. 스위치 상태를 기록하지 않으면 **같은 조건이라 믿은 두 측정의 행 수가 다르다** | SW-10 off/on에서 같은 시드 · 같은 구간의 points_emitted · tag_raw 행 수 대조 · 헬스 응답의 SW-10 상태 조회 | COL-06 | F-01 | 해당 없음 — points_emitted |

## 요구사항 — 발행 · 백프레셔 · 스풀

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-COL-09** | 스캔 사이클 하나를 Stream 엔트리 하나로 만든다 — MessagePack 컬럼 배열(스키마 버전 v · 설비 d · 시퀀스 s · 기준 시각 t0 · 태그 tg · 오프셋 dt · 값 va · 품질 q). 계약의 정본은 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) | 원본 architecture.md §8.4 · 원본 data_flow.md §14.1 · REQ-GLB-21 | 포인트 단위 엔트리는 필드 이름을 반복 저장해 메모리가 약 9배로 늘고 고부하에서 Redis 메모리가 수 분 만에 고갈된다 | XLEN 증가량 = 스캔 사이클 수 대조 · 샘플 엔트리의 필드 집합 · v 조회 | COL-07 | F-01 · F-02 | 해당 없음 — Redis 메모리 |
| **REQ-COL-10** | 매 사이클 XADD와 컨슈머 그룹 적체(lag + pending) 조회를 한 파이프라인으로 보내 적체를 확인한다 — 이것이 백프레셔 1차 신호의 원천이다. **XLEN으로 판정하지 않는다** — 확인된 엔트리가 MAXLEN까지 남아 정상 운전에서도 위험 단계로 오판한다(ADR-21). stream:plc:raw 쓰기는 봉인 계열 래퍼로만 하며 래퍼는 실패를 삼키지 않고 던진다. Collector는 ClickHouse에 쓰지 않고 Ingest를 부르지 않는다 — 예외는 SW-01 off(실험 전용 · 기동 경고)뿐이며 이때 스풀 경로는 없다 | 원본 architecture.md §9 · §9.3 · 원본 implementation_plan.md §7.5 · REQ-GLB-03 · 04 · 08 | 적체 확인을 생략하면 Collector가 곧 "검사를 우회한 발행자"가 되어 MAXLEN이 미소비 엔트리를 **조용히 자른다.** 래퍼가 실패를 삼키면 XADD 실패가 스풀 전환 없이 유실이 된다 | 백프레셔 재현 중 stream_trimmed_unacked 0 · Redis 중단 주입 → spool_active 켜짐 · SW-01 off 기동 로그 경고 | COL-07 | F-01 · F-02 · F-10 | 해당 없음 — stream_length · stream_trimmed_unacked |
| **REQ-COL-11** | 백프레셔 **경고** 단계에서 데드밴드를 임시 강화해 발행량을 줄이고 deadband_boost_active를 켠다. 하강 시 해제한다. 단계 임계는 2계층 조정값(정본 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)). SW-10 off일 때의 강화 의미는 미확인이다 | 원본 architecture.md §9.3 · 원본 data_flow.md §12.1 | 경고 단계에 반응이 없으면 정상 → 위험으로 곧장 넘어가 스풀 전환이 늦는다. 강화 상태를 계측하지 않으면 경고 구간의 행 수 감소가 유실로 오독된다 | 경고 단계 도달 시 deadband_boost_active 1 · points_emitted 감소 · 단계 하강 후 0 복귀 | COL-08 | F-10 | 해당 없음 — deadband_boost_active |
| **REQ-COL-12** | 백프레셔 **위험** 단계이거나 XADD가 실패하면(OOM · 연결 끊김) spooldata 볼륨의 /app/spool에 길이 접두 + MessagePack 프레임을 순서대로 쌓고 spool_active · spool_bytes를 올린다. 버리지 않는다 — 발행을 스풀로 돌릴 뿐 폴링은 계속한다 | 원본 architecture.md §9.3 스풀 파일 포맷 · §17 Redis 중단 · 원본 data_flow.md §12.1 · REQ-GLB-10 | 위험 단계에서 발행을 계속하면 MAXLEN 트리밍이 미소비 엔트리를 자른다. 스풀 없이 폴링을 멈추면 Redis 중단 3분이 그대로 수집 결측이 된다 | docker stop redis 3분 → spool_active 1 · spool_bytes 증가 · 복구 후 생성 카운트 = tag_raw count | COL-09 | F-10 | 해당 없음 — spool_active · spool_bytes |
| **REQ-COL-13** | 복구 단계에서 스풀 프레임을 앞에서부터 순차 재발행하고 다 비우면 스풀을 끝낸다. 프레임은 Stream 엔트리와 같은 포맷이라 디코딩 없이 XADD 페이로드로 넘긴다. 재발행 속도를 spool_drain_rate로 계측한다 | 원본 architecture.md §9.3 · 원본 data_flow.md §12.2 | 재발행에 변환 코드가 끼면 인코더가 둘이 되어 스풀 경유 행과 직행 행의 값이 갈릴 수 있다. 순서를 섞으면 같은 설비의 scan_seq가 역전돼 재발행 누락을 가려낼 수 없다 | 스풀 재발행 전후 scan_seq 연속성 조회 · spool_drain_rate 존재 · 재발행 뒤 스풀 파일 0 | COL-09 | F-10 | 해당 없음 — spool_drain_rate |

- **B형 — 스풀 전환은 장애가 아니라 설계된 백프레셔다.** 스풀이 켜진 동안의 수치는 흡수량이지 유실이 아니며, 이 시스템에서 조용한 유실을 세는 자리는 stream_trimmed_unacked 하나뿐이다. 스풀을 "오류"로 알림하면 S6의 핵심 실험이 매번 경보로 끝난다.

## 요구사항 — 루프 장애와 관측

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-COL-14** | 폴링 루프 예외는 그 루프만 재기동한다. 조회 API와 다른 설비의 루프는 영향받지 않는다. 재기동 동안의 결측 구간은 조회에서 STALE로 드러나며 결측은 채우지 않는다 | 원본 architecture.md §17 CollectorModule 예외 | 루프 예외가 프로세스를 죽이면 수집 · 적재 · 조회가 함께 멈춘다. 결측을 보간으로 채우면 UNCERTAIN 부여 주체가 없는 상태에서 가짜 값이 GOOD으로 저장된다 | 폴링 루프 하나에 예외 주입 → 해당 설비 points_emitted 0 · 다른 설비 정상 · 최신값 조회 STALE · 재기동 후 재개 | COL-02 | F-01 · F-03 | 해당 없음 — points_emitted |
| **REQ-COL-15** | Collector는 points_emitted · poll_duration · 타임아웃율 · 품질 코드별 계수 · spool_active · spool_bytes · spool_drain_rate · deadband_boost_active · Modbus 왕복 히스토그램을 노출한다. 이 지표들이 COL의 실패를 관측하는 **유일한 자리**다 | 원본 architecture.md §14 파이프라인 계열 · 원본 data_flow.md §15 · §16 · REQ-GLB-16 | 지표 하나가 빠지면 그 실패는 응답 코드로도 드러나지 않으므로 **관측 불가능**하다 — 예: 타임아웃율이 없으면 SIM 지연 주입이 조용한 결측으로만 남는다 | /metrics에서 지표 9종 존재 조회 · 지표 이름의 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) 대조 | COL-01 · COL-02 · COL-05 · COL-06 · COL-07 · COL-08 · COL-09 | F-01 · F-10 | 해당 없음 |
| **REQ-COL-16** | 스위치 두 개가 COL 구현을 교체한다 — SW-01(발행 포트)과 SW-10(데드밴드 포트). 교체는 DI 초기화 선택이며 전환은 재기동이다. SW-01 off 실험은 주입 모드 A로만 한다 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 공통 규칙 · 조합 제약 #2 · D-06 | 폴링 루프 안에 if로 분기하면 분기 자체가 poll_duration 측정 대상 코드에 섞인다. SW-01 off를 모드 B로 재면 Stream 없는 구성에 Stream 직결 주입을 거는 모순이 된다 | 기동 시 선택된 포트 구현 이름 로그 · 헬스 응답의 SW-01 · SW-10 상태 | COL-06 · COL-07 | F-01 | 해당 없음 |

## 관측 형태 요약

COL의 요구가 깨질 때 무엇이 보이는지를 한 표로 모은다. 에러 코드 열이 없는 도메인에서 이 표가 에러 코드 표를 대신한다.

| 요구 위반 | 드러나는 형태 | 지표 · 상태 | REQ |
|------|------|------|------|
| Modbus 응답 없음 | 그 주기 행 없음 · 조회 STALE | 타임아웃율 | REQ-COL-02 |
| 폴링이 주기를 넘김 | 주기 초과 — F-01 1차 병목 | poll_duration > scan_rate | REQ-COL-04 |
| 디코딩 설정 오류 | BAD_RANGE 급증 | 품질 코드별 계수 | REQ-COL-05 · 06 |
| 경고 단계 | 발행량 감축 | deadband_boost_active | REQ-COL-11 |
| 위험 단계 · XADD 실패 | 스풀 전환 | spool_active · spool_bytes | REQ-COL-12 |
| 복구 단계 | 순차 재발행 | spool_drain_rate | REQ-COL-13 |
| 우회 발행자의 트리밍 | 조용한 유실 — 결함 | stream_trimmed_unacked | REQ-COL-10 |
| 루프 예외 | 설비 단위 결측 | points_emitted | REQ-COL-14 |

- 검산: 관측 형태 = **8**행 · 에러 코드로 드러나는 행 **0**

## 기능 → REQ 대응

[../02_features/03_collector.md](../02_features/03_collector.md) 기능 목록의 COL 기능 전부가 하나 이상의 REQ-COL에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| COL-01 | 수집 정의 로드 | REQ-COL-01 · 15 | 2 |
| COL-02 | 스캔 그룹 폴링 | REQ-COL-02 · 03 · 14 · 15 | 4 |
| COL-03 | 레지스터 블록 병합 | REQ-COL-04 | 1 |
| COL-04 | 디코딩 · 공학 단위 변환 | REQ-COL-05 | 1 |
| COL-05 | 품질 판정 | REQ-COL-06 · 07 · 15 | 3 |
| COL-06 | 데드밴드 필터 | REQ-COL-08 · 15 · 16 | 3 |
| COL-07 | 인코딩 · Stream 발행 | REQ-COL-09 · 10 · 15 · 16 | 4 |
| COL-08 | 발행량 감축 | REQ-COL-11 · 15 | 2 |
| COL-09 | 스풀 전환과 재발행 | REQ-COL-12 · 13 · 15 | 3 |

### 검산

- 기능 = COL-01~09 = **9** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 2 + 4 + 1 + 1 + 3 + 3 + 4 + 2 + 3 = **23**
- REQ-COL 채번 = 01~16 = **16** · 기능에 대응하지 않는 REQ **0**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 모드 A ts 채취 시점(요청 직전 · 응답 직후) | **W4 판정** — 요청 블록 송신 직전(응답 직후 시각은 왕복 히스토그램에만) | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 실행 중 마스터 변경의 반영 | **W4 판정** — ch:cacheinv 구독 · REQ-COL-01 반영 | 상동 |
| SW-10 off와 경고 단계 데드밴드 강화 | 데드밴드가 꺼진 상태에서 "강화"가 태그별 설정값 적용인지 무동작인지 없다 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)(W3) |
| 백프레셔 하강 히스테리시스 | 경고 해제 · 스풀 종료 조건의 떨림 방지 없음 | 상동 |
| BAD_TIMEOUT "기록"의 자리 | **W4 판정** — 메트릭만 · 행 · 최신값 갱신 없음 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| FLOAT64 4워드 순서 · 레지스터 비트 BOOL | **W4 판정** — 두 축 조합 · 레지스터 비트 BOOL 미지원 | 상동 |
| 품질 코드별 계수 · Modbus 왕복 히스토그램의 메트릭 이름 | **W6 판정** — col_points_by_quality_total · col_modbus_rtt_seconds | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 폴링 주기 여유 · Modbus 왕복 지연 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지. 원본 목표(4 vCPU 가정) Modbus 왕복 p95 30 ms | [13_nonfunctional.md](./13_nonfunctional.md) REQ-NFR-04 |

## 관련 문서

- [../02_features/03_collector.md](../02_features/03_collector.md) — COL 기능 목록 · SIMULATED 판정
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-03 비동기 경계 · REQ-GLB-10 백프레셔 명시화 · REQ-GLB-18 생성 데이터 구분
- [05_plc_sim.md](./05_plc_sim.md) — Modbus 경계 반대편의 요구
- [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) — F-01 기전
- [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) — F-10 스풀 · 재발행 기전
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — Stream 엔트리 · 스풀 프레임 계약
