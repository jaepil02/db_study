# 추적성 — 기능 ↔ 요구사항 ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블

> **대상**: 기능 현행 67 전수의 요구사항 · 흐름 · 화면 · API 문서 · 저장 객체 대응 · 요구사항 현행 163의 역방향 검산 · 흐름 9 · 화면 현행 7(api 표면을 부르는 화면 3 · 기록 판독 화면 4 — 주 기능 0 · 폐지 11 — 주 기능 0) · API 문서 7 · 저장 객체 17 · AC 현행 29 축별 검산 · 미매핑 0 · 유령 0 · 재생성 규칙
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — **D-16 새 기능 4 · 웹 7화면 재생성**(사용자 결정 2026-10-11 · 기능 정본 02_features 05 · 08 · 요구사항 정본 06 · 07 · 09 · 01 · AC 정본 14 · 화면 정본 08_screen/02) — 전역 매트릭스 **GEN-13 · GEN-14 · RLT-10 · RLT-11 행 신설** · ING-11 이름 대조군 동시 적재 → **비교 사본 동시 적재** · 요구사항 열 REQ-ING-19 추가 · **TSQ-01 · TSQ-06 화면 화면 없음(API 전용) → HMI-PLANT** · 기능 63 → **67**(GEN 5 → **7** · RLT 8 → **10**) · 요구사항 154 → **163**(GLB 24 → **25** · GEN 9 → **14** · ING 17 → **18** · RLT 16 → **18** — 기능을 가리킴 148 → **156** · 해당 없음 6 → **7**(REQ-GLB-27)) · 흐름 참여 F-01 15 → **16** · F-02 12 → **13** · F-03 9 → **10** · F-09 6 → **8** · 합 75 → **80** · 흐름 없는 기능 6 → **7**(GEN-14) · 화면 축 현행 1 → **7**(EXP-LAB 2 · HMI-PLANT 4 · 기록 판독 화면 4 신설) · 화면 있음 9 → **15** · 화면 없음(API 전용) 18 → **16** · API 축 06_realtime 2 → **5** 표면 · 기능 5 → **7** · 09_datagen 4 → **7** · 기능 1 → **3** · 표면 29 → **35** · 저장 객체 16 → **17**(run_result) · site · production_line · device · tag_master · plc_tag_raw_control · tag_raw · 롤업 3 기능 열 · AC 26 → **29**(AC-47 · 48 · 49)
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지 · 도메인 11 → 8) — 재생성 — AUT · ALM · WRK 절과 결번 기능 행(GEN-04 · 06~11 · ING-09 · RLT-08) 삭제 · 요구사항 열을 현행 REQ 표의 관련 기능 열로 다시 뒤집음(결번 REQ 인용 0 · 관련 기능 열의 결번 기능 인용 17건은 정본 01 · 06 · 07 · 13에서 먼저 정리) · 흐름 열 F-06 삭제 · 저장 열 audit_log · 알람 호출 삭제 · 기능 93 → **63** · 요구사항 233 → **167**(해당 없음 5 → **6** — REQ-GLB-25 · 26 횡단 방어선) · 흐름 10 → **9**(F-06 결번) · 참여 합 124 → **75** · 화면 현행 2 → **1**(EXP-PERF 폐지 — D-16 · 공통 셸 주 기능 0) · 화면 있음 15 → **9** · API 문서 10 → **7** · 표면 48 → **29** · 저장 객체 28 → **16**(PostgreSQL 16 → **8** · ClickHouse 테이블 8 → **4** — alarm_eval · 업무 대조 3 삭제) · AC 46 → **40** · 고빈도 축 전용 매트릭스에서 권한 매트릭스(삭제) 제외 · **리드 판정 적용(d4 · 2026-10-11)** — 폐지 표기 REQ-NFR 13을 기능 표 요구사항 열에서 제외(인용 21건) · 요구사항 현행 167 → **154**(NFR 18 → **5** · 기능을 가리킴 161 → **148**) · AC 현행 40 → **26**(관련 기능 있음 38 → **24** · 결번 6 → **20**)
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9 · 리드 판정 2026-10-03) — GEN-12 흐름 열 F-02 · F-05 · F-09 → **F-02 · F-03 · F-04 · F-05 · F-09**(조회 섞기 — 정본 02_features/05) · 저장 열에 조회 읽기(Redis 사본 키 — 테이블 축 불변) · 흐름 축 F-03 12 → **13** · F-04 14 → **15** · 참여 합 122 → **124** — 기능 · REQ · 표면 · 저장 객체 수 불변
> **개정일**: 2026-10-03 — 리드 판정(웨이브 1 정합 · .omc/web2-brief.md §6) 반영(정본 08_screen/02_traceability) — 화면 열 AUT-03 · RLT-09 공통 셸 → **화면 없음(API 전용)** · AUT-02 공통 셸 · OBS-04 · 05 EXP-FLOW 유지 · 화면 축 공통 셸 7 → **5** · EXP-FLOW 9 불변 · 화면 있음 17 → **15** · 화면 없음(API 전용) 28 → **30** · D-14 올림 10 → **9**(EXP-FLOW 8 · 공통 셸 1) · 내림 27 → **28** · 닫힌 어휘 화면 없음(API 전용) 뜻에 현행 화면 · 셸에 부르는 요소 없음을 더함 — 기능 · REQ · 흐름 · API · 저장 객체 · AC 수 불변
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03 · 리드 지침 .omc/web2-brief.md §2 재분류 규칙) — 화면 열 재생성(정본 08_screen/02_traceability) — 기능 37행의 화면 열(AUT-01 · MST-01~06 · TSQ-01 · 02 · 06~09 · RLT-01~04 · 06 · 08 · ALM-01 · 07~09 · WRK-01~03 · 05 → 화면 없음(API 전용) · AUT-02 · 03 → 공통 셸 · RLT-05 · 07 · OBS-01~06 → EXP-FLOW) · 화면 축 화면 12 → **현행 2 + 폐지 10 묶음 행** · 화면 있음 44 → **17**(EXP-FLOW 1 → **9** · 공통 셸 5 → **7** · 폐지 10 → **0**) · 화면 없음(API 전용) 1 → **28** · 검산 요약 화면 축 전수 12 → **2** · 닫힌 어휘 화면 없음(API 전용) 뜻에 폐지 화면 표면 — 기능 · REQ · 흐름 · API · 저장 객체 · AC 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설 반영(사용자 요구 2026-09-28 · 리드 판정 10) — **GEN-11 · GEN-12** 행(REQ-GEN-16~19 · 흐름 F-09 · F-02 · F-05 · 화면 EXP-PERF · EXP-FLOW 주 화면 · API 09_datagen · 저장 객체 실행 수명 객체 · Redis) — 기능 91 → **93** · 요구사항 229 → **233**(GEN 15 → **19** · 기능을 가리킴 224 → **228**) · 흐름 참여 F-02 12 → **13** · F-05 21 → **22** · F-09 12 → **14** · 화면 축 10 → **12**(EXP-PERF · EXP-FLOW 각 주 기능 1 · 화면 있음 42 → **44** — 08_screen 인벤토리 12와 맞춤) · API 축 09_datagen 표면 1 → **5** · 기능 1 → **3** · 표면 44 → **48** · AC 45 → **46**(관련 기능 정본에 있음 43 → **44**) · 저장 객체 28 불변(실행 수명 객체는 세지 않는다)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-L3) — ALM-08 흐름 F-06 → **F-05 · F-06**(확인 쓰기는 업무 명령 경로) · 흐름 축 F-05 참여 20 → **21** — 기능 · REQ · 미매핑 · 유령 수 불변
> **개정일**: 2026-09-27 — D-04 부분 개정 반영(사용자 결정 — 업무 쓰기도 Redis를 거친다) — 업무 쓰기 기능 11(MST-01~06 · ALM-01 · ALM-08 · WRK-01~03)의 API 열에 01_conventions(명령 조회 #1) · 저장 객체 열에 **biz_command_log**(명령 원장 · WRK 소유) · API 축 문서 9 → **10** · 표면 43 → **44** · 저장 객체 27 → **28**(PostgreSQL 15 → **16**) — 기능 · REQ 수 불변
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 저장 객체 축에 ClickHouse 업무 대조 테이블 3 한 행(기능 해당 없음 — 계측물) — 저장 객체 24 → **27** · 기능이 가리키지 않는 객체 0 → **3**(해당 없음 명시 · 미매핑 0 유지) · 닫힌 어휘 해당 없음의 쓰는 열에 저장 객체 축의 기능 열
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 요구사항 열을 REQ- 접두 전체 ID로(줄인 표기가 기능 ID와 같은 모양이라 두 축이 섞인다)
> **개정일**: 2026-09-24 — W7 검수 반영 — REQ-GLB-24 반영(요구사항 228 → **229** · 기능을 가리킴 223 → **224**) · API 열이 기능 표면의 API 문서 전부를 싣도록 재생성(RLT-07 → 11_websocket · 06_realtime)
> **원천**: D-16(사용자 결정 2026-10-11) · 기능 정본 [../02_features/README.md](../02_features/README.md) 도메인 파일 8본의 기능 표(흐름 · 표면 · 저장소 열) · 요구사항 정본 이 폴더 01 · 03~09 · 12 · 13의 요구사항 표(관련 기능 열) · 기능 → 화면 정본 [../08_screen/02_traceability.md](../08_screen/02_traceability.md) · AC 정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md) · 저장 객체 정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · 원본 없음(신설)

이 문서는 **추적성 3중 중 전역 매트릭스**다. 아무것도 채번하지 않고, 대응을 새로 정하지도 않는다 — 모든 칸은 정본 표의 열을 모아 뒤집은 것이다. 그래서 정본과 이 문서가 어긋나면 **정본이 맞고 이 문서가 낡은 것이다.** 정본의 대응 열을 고친 변경 단위에서 이 문서를 다시 만든다(§재생성 규칙).

**미매핑 0 · 유령 0이 이 문서의 합격선이다.** 미매핑은 어느 축에서도 짝이 없는 ID이고, 유령은 정본에 없는 ID를 가리키는 참조다. 둘 중 하나라도 있으면 설계가 구현보다 먼저 거짓말을 한다 — 요구사항 없는 기능은 검증되지 않은 채 구현되고, 없는 기능을 가리키는 요구사항은 아무도 만족시키지 않는 계약으로 남는다.

## 추적성 3중

| 층 | 자리 | 무엇을 잇는가 |
|------|------|------|
| 전역 매트릭스 | 이 문서 | 기능 ↔ 요구사항 ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전수 |
| 고빈도 축 전용 매트릭스 | [../08_screen/02_traceability.md](../08_screen/02_traceability.md) · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대응 검산 | 기능 → 화면 · 스위치 → 기능 · 흐름 · 스위치 · AC · REQ-NFR → 실험 |
| 문서별 지역 절 | 각 문서의 관련 기능 · 관련 흐름 · 근거 요구 열 | 그 문서 안의 항목 하나가 어디서 왔고 어디로 가는가 |

- 검산: 층 = **3**
- 이 문서는 고빈도 축의 대응을 다시 적지 않는다. 화면 열은 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 분류와 주 화면만 옮기고, 실험 대응은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 닫는다.

## 닫힌 어휘

대응이 없는 칸은 비우지 않고 아래 어휘로 채운다([README.md](./README.md) 고정 기준 추적성).

| 어휘 | 뜻 | 쓰는 열 |
|------|------|------|
| 해당 없음 | 그 축에 대응할 대상이 원리상 없다 — 예: 관측 기능의 흐름 · 저장 객체가 없는 기능 · 특정 기능에 속하지 않는 요구사항 | 흐름 · 저장 객체 · 요구사항 · 요구사항의 관련 기능 |
| 내부 모듈 | 도메인 자체에 외부 표면이 없다 — COL · SIM · ING | 화면 · API |
| 표면 없음 | 표면이 있는 도메인의 기능이지만 내부 단계 · 실행 인자라 표면이 없다 | 화면 · API |
| 화면 없음(API 전용) | 표면은 있으나 어느 화면도 부르지 않는다 — 호출 주체가 기계이거나, 부르던 화면이 폐지됐거나(D-14 · D-16), 현행 화면 · 셸에 그 표면을 부르는 요소가 없다 | 화면 |

- 검산: 어휘 = **4**

## 전역 매트릭스

열의 출처 — 요구사항은 요구사항 표의 관련 기능 열을 뒤집은 것, 흐름 · API · 저장 객체는 기능 표의 흐름 · 표면 · 저장소 열, 화면은 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 분류 · 주 화면이다. 요구사항 ID는 접두 REQ-를 붙인 전체 ID로 적는다 — 줄이면 REQ-TSQ-01과 기능 TSQ-01이 같은 모양이 되어 두 축이 섞인다.

### MST — 마스터

정본 [../02_features/02_master.md](../02_features/02_master.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| MST-01 | 사이트 · 라인 관리 | REQ-GLB-24 · REQ-MST-01 · REQ-MST-14 · REQ-TEC-05 | F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL site · production_line · Redis cache 계열 · biz_command_log |
| MST-02 | 설비 관리 | REQ-GLB-24 · REQ-MST-02 · REQ-MST-14 | F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL device · Redis cache:devlist · biz_command_log |
| MST-03 | Modbus 접속 설정 관리 | REQ-GLB-24 · REQ-MST-03 · REQ-MST-14 | F-01 · F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL modbus_config · biz_command_log |
| MST-04 | 태그 마스터 관리 | REQ-GLB-12 · REQ-GLB-24 · REQ-MST-04 · REQ-MST-14 | F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL tag_master · biz_command_log |
| MST-05 | 태그 논리 삭제 | REQ-GLB-14 · REQ-GLB-24 · REQ-MST-06 · REQ-MST-08 | F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL tag_master · biz_command_log |
| MST-06 | 스케일 변경 시 새 태그 발급 | REQ-GLB-14 · REQ-GLB-24 · REQ-MST-07 | F-05 | 화면 없음(API 전용) | 04_master · 01_conventions | PostgreSQL tag_master · tag_master_history · biz_command_log |
| MST-07 | 태그 메타 캐시 | REQ-GLB-08 · REQ-MST-13 | F-01 · F-03 | 표면 없음 | 표면 없음 — 다른 기능의 내부 조회 | Redis cache:tagmeta |
| MST-08 | 캐시 무효화 체인 | REQ-GLB-09 · REQ-MST-09 · REQ-MST-10 | F-05 | 표면 없음 | 표면 없음 — 쓰기 표면의 후처리 | Redis cache 계열 · ch:cacheinv · ClickHouse dict_tag |
| MST-09 | Dictionary 원천 제공 | REQ-GLB-11 · REQ-GLB-14 · REQ-MST-08 · REQ-MST-10 · REQ-MST-11 · REQ-MST-12 · REQ-TEC-14 | F-04 · F-08 | 표면 없음 | 표면 없음 — TSQ-07이 소비 | PostgreSQL tag_master · ClickHouse dict_tag |

- 검산: MST 기능 = **9**

### COL — 수집

정본 [../02_features/03_collector.md](../02_features/03_collector.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| COL-01 | 수집 정의 로드 | REQ-COL-01 · REQ-COL-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis cache:tagmeta · PostgreSQL tag_master · modbus_config(읽기) |
| COL-02 | 스캔 그룹 폴링 | REQ-COL-02 · REQ-COL-03 · REQ-COL-14 · REQ-COL-15 · REQ-GLB-02 · REQ-NFR-04 · REQ-TEC-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음(PlcSim 소켓) |
| COL-03 | 레지스터 블록 병합 | REQ-COL-04 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-04 | 디코딩 · 공학 단위 변환 | REQ-COL-05 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-05 | 품질 판정 | REQ-COL-06 · REQ-COL-07 · REQ-COL-15 · REQ-GLB-18 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-06 | 데드밴드 필터 | REQ-COL-08 · REQ-COL-15 · REQ-COL-16 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-07 | 인코딩 · Stream 발행 | REQ-COL-09 · REQ-COL-10 · REQ-COL-15 · REQ-COL-16 · REQ-GLB-03 · REQ-GLB-04 · REQ-GLB-08 · REQ-GLB-10 · REQ-GLB-16 · REQ-GLB-21 · REQ-NFR-04 | F-01 · F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |
| COL-08 | 발행량 감축 | REQ-COL-11 · REQ-COL-15 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-09 | 스풀 전환과 재발행 | REQ-COL-12 · REQ-COL-13 · REQ-COL-15 · REQ-GLB-09 · REQ-GLB-10 · REQ-TEC-03 · REQ-TEC-06 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | spooldata 볼륨(저장소 밖) · Redis stream:plc:raw |

- 검산: COL 기능 = **9**

### SIM — PLC 시뮬레이터

정본 [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| SIM-01 | 설비당 Modbus TCP 서버 | REQ-GLB-19 · REQ-SIM-01 · REQ-SIM-02 · REQ-SIM-03 · REQ-SIM-07 · REQ-SIM-11 · REQ-SIM-12 · REQ-TEC-02 · REQ-TEC-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 |
| SIM-02 | 레지스터 응답 | REQ-SIM-04 · REQ-SIM-05 · REQ-SIM-07 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| SIM-03 | 레지스터 런타임 갱신 | REQ-SIM-06 · REQ-SIM-11 | F-01 · F-09 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| SIM-04 | 지연 주입 | REQ-SIM-08 · REQ-SIM-10 | F-01 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| SIM-05 | 오류 주입 | REQ-SIM-09 · REQ-SIM-10 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |

- 검산: SIM 기능 = **5**

### GEN — 데이터 생성기

정본 [../02_features/05_datagen.md](../02_features/05_datagen.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| GEN-01 | 신호 프로파일 생성 | REQ-GEN-01 · REQ-GLB-20 · REQ-NFR-01 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 없음 — 메모리 |
| GEN-02 | 품질 표지와 결측 표현 | REQ-GEN-02 · REQ-GLB-18 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-03 | 시드 고정 | REQ-GEN-03 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-05 | 모드 A 레지스터 갱신 | REQ-GEN-05 · REQ-GEN-06 | F-01 · F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 없음(SIM Buffer) |
| GEN-12 | 흐름 시연 실행 | REQ-GEN-05 · REQ-GEN-07 · REQ-GEN-16 · REQ-GEN-18 · REQ-GEN-19 · REQ-GLB-03 · REQ-GLB-10 · REQ-GLB-21 | F-02 · F-03 · F-04 · F-05 · F-09 | EXP-FLOW | 09_datagen | Redis stream:plc:raw · stream:biz:cmd · 조회 읽기 Redis cache:q · rt:latest · cache:devlist(미스면 원천 — 테이블 축은 TSQ · RLT · MST 기능이 갖는다) |
| GEN-13 | 직접 비교 실행 | REQ-GEN-20 · REQ-GEN-21 · REQ-GEN-22 · REQ-GEN-23 | F-09 · F-02 | EXP-LAB | 09_datagen | Redis stream:plc:raw · cache:dual:active · ClickHouse tag_raw · tag_1m · tag_1h · tag_1d · PostgreSQL plc_tag_raw_control · run_result · device(무결성) · rt:latest |
| GEN-14 | 센서 데이터 현황 · 지우기 | REQ-GEN-24 | 해당 없음 | EXP-LAB | 09_datagen | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d · PostgreSQL plc_tag_raw_control · Redis stream:plc:raw · stream:plc:dlq · rt:latest · cache:q |

- 검산: GEN 기능 = **7**

### ING — 적재

정본 [../02_features/06_ingest.md](../02_features/06_ingest.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| ING-01 | Stream 소비 | REQ-GLB-03 · REQ-GLB-20 · REQ-GLB-21 · REQ-ING-01 · REQ-ING-02 · REQ-ING-18 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw · 컨슈머 그룹 |
| ING-02 | 배치 누적과 플러시 | REQ-ING-03 · REQ-ING-04 · REQ-ING-18 · REQ-NFR-04 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 버퍼 |
| ING-03 | ClickHouse 배치 삽입 | REQ-GLB-01 · REQ-GLB-02 · REQ-ING-05 · REQ-ING-18 · REQ-NFR-01 · REQ-NFR-03 · REQ-NFR-04 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| ING-04 | 멱등 토큰 | REQ-GLB-06 · REQ-ING-06 · REQ-ING-18 · REQ-NFR-02 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| ING-05 | 재시도 · 격리 · XACK | REQ-GLB-05 · REQ-GLB-06 · REQ-GLB-08 · REQ-GLB-16 · REQ-ING-07 · REQ-ING-08 · REQ-ING-18 · REQ-NFR-01 · REQ-NFR-02 | F-02 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:dlq |
| ING-06 | PEL 회수 | REQ-GLB-05 · REQ-ING-09 · REQ-ING-18 · REQ-TEC-06 | F-02 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 PEL |
| ING-07 | 다중 컨슈머 | REQ-GLB-07 · REQ-ING-04 · REQ-ING-10 · REQ-ING-18 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 |
| ING-08 | 최신값 갱신 · 복원 | REQ-GLB-07 · REQ-GLB-08 · REQ-GLB-11 · REQ-ING-11 · REQ-ING-12 · REQ-ING-18 | F-02 · F-03 · F-07 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis rt:latest · ch:rt |
| ING-10 | 분기 실행 | REQ-GLB-12 · REQ-ING-14 · REQ-ING-18 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| ING-11 | 비교 사본 동시 적재 | REQ-GLB-11 · REQ-ING-15 · REQ-ING-18 · REQ-ING-19 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | PostgreSQL plc_tag_raw_control |
| ING-12 | 롤업 캐스케이드 발동 | REQ-GLB-15 · REQ-ING-16 · REQ-ING-18 | F-08 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_1m · tag_1h · tag_1d · MV 3 |
| ING-13 | 백프레셔 대응 · 적체 소진 | REQ-GLB-05 · REQ-GLB-10 · REQ-ING-12 · REQ-ING-17 · REQ-ING-18 · REQ-NFR-16 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |

- 검산: ING 기능 = **12**

### TSQ — 시계열 조회

정본 [../02_features/07_timeseries.md](../02_features/07_timeseries.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| TSQ-01 | 시계열 조회 | REQ-GLB-02 · REQ-GLB-07 · REQ-GLB-15 · REQ-GLB-24 · REQ-TSQ-01 · REQ-TSQ-02 · REQ-TSQ-05 · REQ-TSQ-07 · REQ-TSQ-16 | F-04 | HMI-PLANT | 05_timeseries | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(읽기) |
| TSQ-02 | 해상도 자동 선택 | REQ-TSQ-03 · REQ-TSQ-04 | F-04 | 화면 없음(API 전용) | 05_timeseries | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(읽기) |
| TSQ-03 | 캐시 키 정규화 | REQ-TSQ-09 · REQ-TSQ-14 | F-04 | 표면 없음 | 표면 없음 — TSQ-04의 내부 단계 | Redis cache:q |
| TSQ-04 | 조회 결과 캐시 | REQ-GLB-09 · REQ-TSQ-10 · REQ-TSQ-11 · REQ-TSQ-14 · REQ-TSQ-16 | F-04 | 표면 없음 | 표면 없음 — TSQ-01의 내부 단계 | Redis cache:q |
| TSQ-05 | 스탬피드 방지 | REQ-TSQ-12 · REQ-TSQ-14 | F-04 | 표면 없음 | 표면 없음 — TSQ-01의 내부 단계 | Redis lock:rebuild |
| TSQ-06 | 다운샘플 | REQ-GLB-20 · REQ-TSQ-06 · REQ-TSQ-07 | F-04 | HMI-PLANT | 05_timeseries | 없음 — 계산 |
| TSQ-07 | 태그 메타 부착 | REQ-GLB-14 · REQ-TSQ-08 | F-04 | 화면 없음(API 전용) | 05_timeseries | ClickHouse dict_tag(읽기) |
| TSQ-08 | 진행 구간 분할 | REQ-TSQ-13 | F-04 · F-03 | 화면 없음(API 전용) | 05_timeseries | Redis cache:q · rt:latest(읽기) |
| TSQ-09 | 원시 내보내기 | REQ-GLB-24 · REQ-TSQ-15 · REQ-TSQ-16 | F-04 | 화면 없음(API 전용) | 05_timeseries | ClickHouse tag_raw(읽기) |

- 검산: TSQ 기능 = **9**

### RLT — 실시간

정본 [../02_features/08_realtime.md](../02_features/08_realtime.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| RLT-01 | 설비 전체 최신값 | REQ-GLB-24 · REQ-RLT-01 · REQ-RLT-06 · REQ-RLT-07 · REQ-RLT-08 | F-03 | 화면 없음(API 전용) | 06_realtime | Redis rt:latest(읽기) |
| RLT-02 | 단일 태그 최신값 | REQ-GLB-24 · REQ-RLT-02 · REQ-RLT-06 · REQ-RLT-07 · REQ-RLT-08 | F-03 | 화면 없음(API 전용) | 06_realtime | Redis rt:latest · cache:tagmeta(읽기) |
| RLT-03 | STALE 판정 · 메타 부착 | REQ-GLB-01 · REQ-GLB-02 · REQ-RLT-03 · REQ-RLT-04 · REQ-RLT-16 | F-03 | 화면 없음(API 전용) | 06_realtime | Redis cache:tagmeta(읽기) |
| RLT-04 | 빈 키 복원과 503 | REQ-GLB-09 · REQ-RLT-05 · REQ-RLT-06 | F-03 · F-10 | 화면 없음(API 전용) | 06_realtime | ClickHouse tag_raw(읽기) · Redis rt:latest · lock:rebuild |
| RLT-05 | WebSocket 구독 | REQ-RLT-09 · REQ-RLT-10 · REQ-RLT-17 | F-07 | EXP-FLOW | 11_websocket | Redis ch:rt(구독) |
| RLT-06 | 스로틀 병합 | REQ-RLT-11 | F-07 | 화면 없음(API 전용) | 11_websocket | 없음 — 메모리 |
| RLT-07 | 연결 관리 · 재연결 동기화 | REQ-RLT-10 · REQ-RLT-12 · REQ-RLT-13 | F-07 · F-03 | EXP-FLOW | 11_websocket · 06_realtime | Redis ch:rt · rt:latest |
| RLT-09 | 무효화 신호 중계 | REQ-RLT-15 | F-05 | 화면 없음(API 전용) | 11_websocket | Redis ch:cacheinv(구독) |
| RLT-10 | 설비 가동 스위치 | REQ-RLT-19 | F-01 · F-09 | HMI-PLANT | 06_realtime | Redis ctl:plant:power(읽기 · 쓰기) |
| RLT-11 | HMI 설비 개요 | REQ-RLT-20 | F-03 | HMI-PLANT | 06_realtime | Redis rt:latest · ctl:plant:power(읽기) · PostgreSQL site · production_line · device · tag_master(10초 사본) |

- 검산: RLT 기능 = **10**

### OBS — 관측

정본 [../02_features/11_metrics.md](../02_features/11_metrics.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| OBS-01 | 앱 메트릭 통합 노출 | REQ-GLB-16 · REQ-GLB-20 · REQ-GLB-22 · REQ-OBS-01 · REQ-OBS-02 · REQ-OBS-06 · REQ-OBS-07 · REQ-OBS-10 · REQ-TEC-01 · REQ-TEC-12 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | 해당 없음 |
| OBS-02 | 저장소 메트릭 수집 | REQ-GLB-22 · REQ-OBS-01 · REQ-OBS-03 · REQ-OBS-06 · REQ-TEC-07 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | 세 저장소 카탈로그(읽기) |
| OBS-03 | 키 계열별 메모리 샘플링 | REQ-OBS-04 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | Redis(샘플 읽기) |
| OBS-04 | E2E 지연 게이지 | REQ-GLB-01 · REQ-NFR-03 · REQ-OBS-05 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | ClickHouse tag_raw(읽기) |
| OBS-05 | 헬스체크 | REQ-OBS-08 · REQ-OBS-09 · REQ-OBS-10 · REQ-TEC-03 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | 세 저장소(핑) |
| OBS-06 | 스위치 상태 노출 | REQ-GLB-04 · REQ-GLB-16 · REQ-GLB-17 · REQ-OBS-10 · REQ-OBS-11 · REQ-OBS-12 · REQ-TEC-10 | 해당 없음 — 관측 | EXP-FLOW | 10_metrics | 해당 없음 |

- 검산: OBS 기능 = **6**

## 기능 축 검산

| 도메인 | 기능 | 요구사항 있음 | 흐름 · 해당 없음 | 화면 분류 확정 |
|------|:--:|:--:|:--:|:--:|
| MST | 9 | 9 | 9 | 9 |
| COL | 9 | 9 | 9 | 9 |
| SIM | 5 | 5 | 5 | 5 |
| GEN | 7 | 7 | 7 | 7 |
| ING | 12 | 12 | 12 | 12 |
| TSQ | 9 | 9 | 9 | 9 |
| RLT | 10 | 10 | 10 | 10 |
| OBS | 6 | 6 | 6 | 6 |
| **계** | **67** | **67** | **67** | **67** |

- 검산: 기능 = 9 + 9 + 5 + 7 + 12 + 9 + 10 + 6 = **67** · 요구사항 없는 기능 **0** · 화면 분류 없는 기능 **0**
- 폐지 도메인 AUT · ALM · WRK와 결번 기능(GEN-04 · 06~11 · ING-09 · RLT-08)은 행을 두지 않는다 — 결번 기록의 자리는 [../02_features/README.md](../02_features/README.md) §기능 집계와 [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) §폐지 도메인 결번이다(D-16).

## 요구사항 역방향 검산

현행 요구사항 163 각각이 기능을 하나 이상 가리키거나, 닫힌 어휘로 "해당 없음"을 밝힌다. 가리키는 기능 ID가 기능 정본에 모두 있다(유령 0). 결번 요구사항과 폐지 표기 요구사항(REQ-NFR 13 — D-16 측정 수단 삭제)은 세지 않고 기능 표의 요구사항 열에서도 뺀다.

| 접두 | 요구사항 | 기능을 가리킴 | 해당 없음 | 유령 |
|------|:--:|:--:|:--:|:--:|
| GLB | 25 | 22 | 3 | 0 |
| MST | 13 | 13 | 0 | 0 |
| COL | 16 | 16 | 0 | 0 |
| SIM | 12 | 12 | 0 | 0 |
| GEN | 14 | 14 | 0 | 0 |
| ING | 18 | 18 | 0 | 0 |
| TSQ | 16 | 16 | 0 | 0 |
| RLT | 18 | 18 | 0 | 0 |
| OBS | 12 | 12 | 0 | 0 |
| NFR | 5 | 5 | 0 | 0 |
| TEC | 14 | 10 | 4 | 0 |
| **계** | **163** | **156** | **7** | **0** |

- 검산: 25 + 13 + 16 + 12 + 14 + 18 + 16 + 18 + 12 + 5 + 14 = **163** · 기능을 가리킴 156 + 해당 없음 7 = **163** · 폐지 표기 REQ-NFR 13(05~15 · 17 · 18 — D-16)은 세지 않는다
- **기능을 가리키지 않는 요구사항 7** — REQ-GLB-25 · 26(요청 출처 방어 — 전 표면에 끼어드는 횡단 방어선 · 옛 REQ-AUT-12 · 13 이관) · REQ-GLB-27(상태를 바꾸는 POST의 JSON 본문 필수 — 같은 횡단 방어선 · D-16) · REQ-TEC-04(전 모듈) · REQ-TEC-09(실험 절차) · REQ-TEC-11(실험 절차) · REQ-TEC-13(구성). 전부 횡단 방어 · 실험 절차 · 구성 · 전 모듈 계약이라 특정 기능에 속하지 않는다. 검증 자리는 각 요구사항 행의 검증 방법 열이다.

## 흐름 축

정본 [../06_pipeline/README.md](../06_pipeline/README.md). 흐름마다 그 흐름에 참여하는 기능을 센다(한 기능이 여러 흐름에 참여한다). F-06(알람 판정)은 D-16 결번이라 행이 없다.

| 흐름 | 참여 기능 수 | 참여 기능 |
|------|:--:|------|
| F-01 | 16 | MST-03 · MST-07 · COL-01 · COL-02 · COL-03 · COL-04 · COL-05 · COL-06 · COL-07 · SIM-01 · SIM-02 · SIM-03 · SIM-04 · SIM-05 · GEN-05 · RLT-10 |
| F-02 | 13 | COL-07 · GEN-12 · GEN-13 · ING-01 · ING-02 · ING-03 · ING-04 · ING-05 · ING-06 · ING-07 · ING-08 · ING-10 · ING-11 |
| F-03 | 10 | MST-07 · GEN-12 · ING-08 · TSQ-08 · RLT-01 · RLT-02 · RLT-03 · RLT-04 · RLT-07 · RLT-11 |
| F-04 | 11 | MST-09 · GEN-12 · TSQ-01 · TSQ-02 · TSQ-03 · TSQ-04 · TSQ-05 · TSQ-06 · TSQ-07 · TSQ-08 · TSQ-09 |
| F-05 | 9 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 · MST-08 · GEN-12 · RLT-09 |
| F-07 | 4 | ING-08 · RLT-05 · RLT-06 · RLT-07 |
| F-08 | 2 | MST-09 · ING-12 |
| F-09 | 8 | SIM-03 · GEN-01 · GEN-02 · GEN-03 · GEN-05 · GEN-12 · GEN-13 · RLT-10 |
| F-10 | 7 | COL-08 · COL-09 · SIM-04 · ING-05 · ING-06 · ING-13 · RLT-04 |

- 검산: 흐름 = **9** · 참여 기능이 없는 흐름 **0** · 참여 합 16 + 13 + 10 + 11 + 9 + 4 + 2 + 8 + 7 = **80** · 흐름 없는 기능 **7**(흐름 열이 해당 없음 — GEN-14 · OBS-01 · OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06)

## 화면 축

정본 [../08_screen/02_traceability.md](../08_screen/02_traceability.md). 주 화면으로만 센다 — 보조 화면까지 세면 합이 기능 수와 맞지 않는다.

| 화면 | 주 화면인 기능 수 | 기능 |
|------|:--:|------|
| EXP-FLOW | 9 | GEN-12 · RLT-05 · RLT-07 · OBS-01 · OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06 |
| EXP-LAB | 2 | GEN-13 · GEN-14 |
| HMI-PLANT | 4 | TSQ-01 · TSQ-06 · RLT-10 · RLT-11 |
| 기록 판독 화면 4(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE) | 0 | 해당 없음 — api 표면을 부르지 않는다(정본 08_screen/02 §매핑 어휘) |
| 폐지 화면 11(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE · EXP-PERF) | 0 | 해당 없음 — 결번(D-14 · EXP-PERF는 D-16) |
| 표면 없음 | 10 | 전역 매트릭스의 화면 열 |
| 내부 모듈 | 26 | 전역 매트릭스의 화면 열 |
| 화면 없음(API 전용) | 16 | 전역 매트릭스의 화면 열 |

- 검산: 현행 화면 = **7**(api 표면을 부르는 화면 3 + 기록 판독 화면 4) · 화면 있음 9 + 2 + 4 = 15 + 표면 없음 10 + 내부 모듈 26 + 화면 없음(API 전용) 16 = **67** · api 표면을 부르면서 주 기능이 없는 현행 화면 **0** · 기록 판독 화면 4의 주 기능 0은 설계(기능 ID가 붙을 api 표면이 없다) · 폐지 화면 11은 한 행으로 묶어 주 기능 0으로 센다(결번 — 미매핑이 아니다)
- **D-16은 화면 6을 새로 열었다** — EXP-LAB(GEN-13 · 14) · HMI-PLANT(RLT-10 · 11 · TSQ-01 · 06 — 시계열 조회가 다시 화면을 얻었다) · 기록 판독 화면 4. **EXP-PERF는 D-16으로 폐지됐다** — 주 기능이던 GEN-11(성능 비교 라이브 실행)이 옛 perf 직접 재 보기와 함께 지워졌다. 공통 셸이 주 화면이던 AUT-02 · 04~07도 D-16으로 지워져 공통 셸의 주 기능은 0이다. 재분류 근거와 기능별 판정은 정본 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)이 갖는다.

## API 축

정본 [../07_api/README.md](../07_api/README.md) §도메인별 표면 수. 표면 번호 단위 대응은 각 API 문서의 표면 요약 표와 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 호출 표면 열이 갖는다.

| API 문서 | 표면 수 | 기능 수 | 기능 |
|------|:--:|:--:|------|
| [../07_api/01_conventions.md](../07_api/01_conventions.md) | 1 | 6 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 |
| [../07_api/04_master.md](../07_api/04_master.md) | 17 | 6 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 |
| [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 2 | 6 | TSQ-01 · TSQ-02 · TSQ-06 · TSQ-07 · TSQ-08 · TSQ-09 |
| [../07_api/06_realtime.md](../07_api/06_realtime.md) | 5 | 7 | RLT-01 · RLT-02 · RLT-03 · RLT-04 · RLT-07 · RLT-10 · RLT-11 |
| [../07_api/09_datagen.md](../07_api/09_datagen.md) | 7 | 3 | GEN-12 · GEN-13 · GEN-14 |
| [../07_api/10_metrics.md](../07_api/10_metrics.md) | 2 | 6 | OBS-01 · OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06 |
| [../07_api/11_websocket.md](../07_api/11_websocket.md) | 1 | 4 | RLT-05 · RLT-06 · RLT-07 · RLT-09 |

- 검산: 표면 = 1 + 17 + 2 + 5 + 7 + 2 + 1 = **35** · 기능이 가리키지 않는 API 문서 **0** · 표면 열이 API 문서가 아닌 기능(표면 없음) **36**
- 02_errors는 미러라 기능이 가리키지 않는다 — 미매핑이 아니다. **01_conventions는 규약이지만 횡단 표면 명령 조회(#1 · D-04 개정)를 채번하므로 API 문서로 센다** — 그 표면이 결과를 확인해 주는 업무 쓰기 기능 6(MST-01~06)이 가리킨다. 옛 03_auth · 07_alarms · 08_work_orders는 D-16으로 삭제됐다.

## 저장 객체 축

정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §테이블 목록 · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §객체 목록. Redis 키 계열의 기능 대응은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)의 키 표가 갖는다.

| 저장소 | 객체 | 기능 수 | 기능 |
|------|------|:--:|------|
| PostgreSQL | site | 2 | MST-01 · RLT-11 |
| PostgreSQL | production_line | 2 | MST-01 · RLT-11 |
| PostgreSQL | device | 3 | MST-02 · GEN-13 · RLT-11 |
| PostgreSQL | modbus_config | 2 | MST-03 · COL-01 |
| PostgreSQL | tag_master | 6 | MST-04 · MST-05 · MST-06 · MST-09 · COL-01 · RLT-11 |
| PostgreSQL | tag_master_history | 1 | MST-06 |
| PostgreSQL | plc_tag_raw_control | 3 | GEN-13 · GEN-14 · ING-11 |
| PostgreSQL | biz_command_log | 6 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 |
| PostgreSQL | run_result | 1 | GEN-13 |
| ClickHouse | tag_raw | 10 | GEN-13 · GEN-14 · ING-03 · ING-04 · ING-10 · TSQ-01 · TSQ-02 · TSQ-09 · RLT-04 · OBS-04 |
| ClickHouse | tag_1m | 5 | GEN-13 · GEN-14 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | tag_1h | 5 | GEN-13 · GEN-14 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | tag_1d | 5 | GEN-13 · GEN-14 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | mv_tag_1m · mv_tag_1h · mv_tag_1d | 1 | ING-12 |
| ClickHouse | dict_tag | 3 | MST-08 · MST-09 · TSQ-07 |

- 검산: PostgreSQL 9 + ClickHouse 테이블 4 + MV 3(한 행) + Dictionary 1 = 객체 **17** · 기능이 가리키지 않는 객체 **0** · 미매핑 **0** · PostgreSQL 9 = 업무 7 + 비교 사본 1 + 실행 보관 1(run_result — D-16)
- **삭제한 객체는 행을 두지 않는다**(D-16) — PostgreSQL alarm_rule · alarm_event · user_account · role · user_role · work_order · production_log · audit_log · ClickHouse alarm_eval · 업무 대조 계측물 3(work_order_control · work_order_control_rmt · production_log_control). 옛 실행 수명 객체(run_perf_raw)도 성능 비교 라이브 실행과 함께 사라졌다.

## AC 축

정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md). 현행 AC 29 각각의 관련 기능 ID 열을 기능 정본과 대조한다. 실험 대응(AC → EXP)은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §AC → EXP 대응 검산이 닫는다.

| 대조 | 수 |
|------|:--:|
| AC | 29 |
| 관련 기능 ID가 기능 정본에 있음 | 27 |
| 관련 기능 ID 해당 없음 | 2 |
| 유령 참조 | 0 |

- 검산: AC = 27 + 2 = **29** · 유령 **0** · 해당 없음 AC-14 · AC-15 · 결번 AC 20(행 없음 6 — AC-09 · 26 · 27 · 35 · 36 · 38 + 폐지 표기 14 — AC-05 · 16 · 18 · 19 · 20 · 22 · 23 · 29 · 31 · 32 · 39 · 41 · 44 · 45 · D-16)은 세지 않는다 · D-16 신설 AC-47(RLT-10 · 11) · AC-48(GEN-13) · AC-49(GEN-14)

## 검산 요약

| 축 | 전수 | 미매핑 | 유령 |
|------|:--:|:--:|:--:|
| 기능 → 요구사항 | 67 | 0 | 0 |
| 요구사항 → 기능 | 163 | 0(해당 없음 7 명시) | 0 |
| 흐름 | 9 | 0 | 0 |
| 화면 | 7(기록 판독 4 — 주 기능 0 · 폐지 11 — 주 기능 0) | 0 | 0 |
| API 문서 | 7 | 0 | 0 |
| 저장 객체 | 17 | 0 | 0 |
| AC | 29 | 0 | 0 |

- 검산: 축 = **7** · 미매핑 합 **0** · 유령 합 **0**

## 재생성 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 같은 변경 단위 | 기능 표의 흐름 · 표면 · 저장소 열, 요구사항 표의 관련 기능 열, 화면 매핑 표, AC 표를 고친 커밋에서 이 문서를 다시 만든다 | 이 문서가 정본과 다른 대응을 보여 주고, 읽는 사람은 어느 쪽이 맞는지 모른다 |
| 뒤집기만 한다 | 이 문서에서 대응을 추가 · 삭제하지 않는다 — 정본 열을 고친다 | 정본에 없는 대응이 여기에만 생겨 유령이 된다 |
| 닫힌 어휘 | 빈 칸 대신 §닫힌 어휘 4개 중 하나 | 빈 칸이 "아직 안 씀"인지 "대응 없음"인지 가를 수 없다 |
| 검산 동반 | 재생성 뒤 §검산 요약의 미매핑 · 유령을 다시 센다 | 미매핑이 생긴 채로 추적성이 "완료" 상태로 남는다 |

- 검산: 규칙 = **4**
- 재생성 수단은 정본 표를 읽어 뒤집는 스크립트다. 코드 착수 전에는 리드가 손으로 돌리고, 코드 착수 뒤에는 문서 린트 작업(docs:lint)에 편입한다 — 편입 항목은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)가 갖는다.

## 관련 문서

- [README.md](./README.md) — 추적성 닫힌 어휘 규약
- [../02_features/README.md](../02_features/README.md) — 기능 ID 채번 정본
- [../08_screen/02_traceability.md](../08_screen/02_traceability.md) — 기능 → 화면 정본
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — AC 채번 정본
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — AC · REQ-NFR → 실험 대응
