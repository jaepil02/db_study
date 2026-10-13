# 기능 → 화면 추적성 (02_traceability)

> **대상**: 기능 현행 67 → 화면 매핑 전수 · 화면 없는 기능의 닫힌 어휘(내부 모듈 · 표면 없음 · 화면 없음(API 전용)) · **기록 판독 화면 축**(api 표면을 부르지 않는 현행 화면 — 주 기능 0이 설계) · 주 화면별 파생 집계 · 화면 → 표면 인용 목록 · 누락 0 · 유령 0 · 고아 0 검산
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — TSQ-06 행 다운샘플 점 수 6,000 → 600을 **6,600 → 660**으로(11_hmi_screen과 맞춤 · 검수 r6 M1) — 분류 · 매핑 · 집계 불변
> **개정일**: 2026-10-11 — TSQ-01 행 HMI 작은 선 요청 maxPoints 600 → **660**(끝을 다음 분 경계로 올린 요청 · 11_hmi_screen) — 분류 · 매핑 · 집계 불변
> **개정일**: 2026-10-11 — **D-16 웹 7화면 · 새 기능 4**(사용자 결정 2026-10-11 · 기능 정본 02_features — GEN-13 직접 비교 실행 · GEN-14 센서 데이터 현황 · 지우기 · RLT-10 설비 가동 스위치 · RLT-11 HMI 설비 개요) — 매핑 표 GEN-13 · 14 · RLT-10 · 11 행 신설 · **TSQ-01 · TSQ-06 화면 없음(API 전용) → 화면(HMI-PLANT — 최근 10분 작은 선이 api 직결로 부른다)** · 기능 63 → **67** · 분류 화면 9 → **15** · 화면 없음(API 전용) 18 → **16** · 내부 모듈 26 · 표면 없음 10 불변 · 주 화면 EXP-LAB 2 · HMI-PLANT 4 신설 · **기록 판독 화면 축 신설**(LRN 4 — 주 기능 0이 설계 · 고아 판정은 api 표면을 부르는 화면만) · 도메인별 GEN 5 → **7** · RLT 8 → **10** · 화면 공백 도메인 5 → **4**(TSQ 빠짐) · 화면 → 표면 인용 7 → **14**(05_timeseries 1 · 06_realtime 3 · 09_datagen 7) · 인용하지 않은 표면 22 → **21** · 표면 총수 29 → **35**
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지 · 대상 문서 파일 삭제) — 매핑 표에서 AUT 7 · ALM 9 · WRK 5 · GEN-07 · GEN-08~10 · GEN-11 · RLT-08 행 삭제 · GEN 범위 행 01~06 → **01~03 · 05**(4) · ING 범위 13 → **12** · OBS-05 · 06 보조 EXP-PERF 삭제 · 기능 93 → **63** · 분류 화면 15 → **9** · 내부 모듈 27 → **26** · 표면 없음 21 → **10** · 화면 없음(API 전용) 30 → **18** · 주 화면 EXP-PERF · 공통 셸 행 삭제(현행 화면 2 → **1** · 폐지 10 → **11**) · 도메인별 11 → **8**행 · 화면 공백 도메인 7 → **5** · 화면 → 표면 인용 8 → **7** · 인용하지 않은 표면 40 → **22** · 매핑 어휘 표의 권한 매트릭스 열 · 교차 검산 삭제
> **개정일**: 2026-10-03 — UI/UX 다듬기(사용자 지시 2026-10-03) — EXP-PERF 행 요소 이름(왜? 카드 · 상황 카드 → 왜? 두 줄 · 업무 네 줄) — 기능 · 화면 수 불변
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9 · 리드 판정 2026-10-03) — 산출이 보이는 자리 — MST-02 · TSQ-01 · RLT-01에 **EXP-FLOW 조회 줄**(GEN-12 조회 섞기의 결과가 GET /metrics로 보인다 — 간접 표시) — 분류 · 주 · 보조 · 집계 불변
> **개정일**: 2026-10-03 — D-15 학습자 눈높이 한 화면(사용자 지시 2026-10-03 — 08_screen/08_evidence_screens · 01_standards §한 화면 원칙) — 측정 조건 서랍 → **각주 툴팁**(OBS-05 · 06 보조 칸 · 주 화면별 EXP-PERF 행 · 화면 → 표면 인용 10_metrics 행 · OBS 불릿) · 산출이 보이는 자리 문구를 한 장 요소로(GEN-11 서랍 라이브 결과 표 → 그림 2 내 측정 점 · GEN-12 지표 띠 → 숫자 4 · ING · ALM-03 · 05 분배 표 · 처리 방식 비교 → 흐름도 DB 노드 · 모아서 대 하나씩 · OBS-06 회색 꺼진 길 → 각주의 꺼진 길) — 분류 · 매핑 · 집계 불변
> **개정일**: 2026-10-03 — D-14 검수 반영(리드 판정 — /monitoring 머리 표지 하나로 · 셸 WS 표지 폐지) — AUT-07 보조 EXP-FLOW(WS) → **EXP-FLOW(흐름 구독 표지 — 출처 거절 표시)** · 산출이 보이는 자리 WS 끊김 표지 → **EXP-FLOW 흐름 구독 표지** · RLT-05 보조 공통 셸(연결) → **해당 없음** · RLT-07 보조 공통 셸(WS 표지) → **해당 없음** — 분류 · 주 화면 수 불변
> **개정일**: 2026-10-03 — 리드 판정(웨이브 1 정합 · .omc/web2-brief.md §6 정정본) — AUT-03 · RLT-09 공통 셸 → **화면 없음(API 전용)**(셸 요소 표에 사용자 메뉴 · 무효화 신호 수신 행 없음) · AUT-02 공통 셸 · OBS-04 · 05 EXP-FLOW 주(OBS-04 — 서랍 지연(E2E)) · OBS-05 EXP-PERF 보조 유지 · 분류 화면 17 → **15** · 화면 없음(API 전용) 28 → **30** · 주 화면별 공통 셸 7 → **5** · EXP-FLOW 9 · EXP-PERF 1 불변 · 도메인별 AUT 화면 6 → **5** · RLT 3 → **2** · 화면 공백 도메인 7 불변 · 권한 교차 검산 화면 17 = 역할 판정 7 + 공개 6 + 횡단 4 → **화면 15 = 역할 판정 5 + 공개 6 + 횡단 4** · 화면 없음(API 전용) 28 = 역할 판정 26 + 공개 1 + 게이트 1 → **30 = 역할 판정 28 + 공개 1 + 게이트 1** · 인용 표면 9 → **8**(03_auth 2 → **1** — 로그아웃 빠짐) · 화면이 인용하지 않은 표면 39 → **40** · D-14 재분류 올림 10 → **9** · 내림 27 → **28** · 화면 없음(API 전용) 뜻에 현행 화면 · 셸에 부르는 요소 없음을 더함
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03 · 리드 지침 .omc/web2-brief.md §2 재분류 규칙 ①②③④) — 폐지 화면 10이 주 화면이던 기능 재분류 · 분류 화면 44 → **17** · 화면 없음(API 전용) 1 → **28** · 내부 모듈 27 · 표면 없음 21 불변 · 주 화면별 — EXP-FLOW 1 → **9**(GEN-12 · RLT-05 · 07 · OBS-01~06) · 공통 셸 5 → **7**(AUT-02 · 03 — 셸 인증 가드 · 사용자 메뉴) · EXP-PERF 1 불변 · 폐지 10 → **0**(행 묶음 하나) · 화면 공백 도메인 3 → **7**(MST · TSQ · ALM · WRK 더함) · 권한 교차 검산 — 화면 44 = 역할 판정 33 + 공개 7 + 횡단 4 → **화면 17 + 화면 없음(API 전용) 28 = 역할 판정 33 + 공개 7 + 횡단 4 + 게이트 1 = 45** · 인용 표면 47 → **9**(화면이 인용하지 않은 표면 1 → **39**) · 산출이 보이는 자리의 폐지 화면 언급을 현행 자리 또는 해당 없음으로 · 화면 없음(API 전용) 뜻에 폐지 화면 표면 포함
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 지침 .omc/run-control-brief.md) — 기능 **GEN-11**(성능 비교 라이브 실행 → 주 화면 EXP-PERF) · **GEN-12**(흐름 시연 실행 → 주 화면 EXP-FLOW) 2행 · 기능 91 → **93** · 분류 화면 42 → **44** · 주 화면 합 42 → **44**(EXP-PERF 0 → **1** · EXP-FLOW 0 → **1**) · **두 화면 분류 재판정 — 주 기능 없는 실증 화면(OBS 보조) 2 → 0**(실행 패널의 주 화면 = 각 화면 · 기록 판독 · 흐름 이벤트 요소는 보조 · 산출 표시 그대로 — 리드 판정) · 도메인 GEN 10 → **12**(화면 2) · 화면 공백 도메인 4 → **3**(GEN 빠짐) · 권한 교차 검산 역할 판정 31 → **33** · AUT-05 보조 화면에 두 실행 패널 · 화면 → 표면 인용 09_datagen 0 → **4**(#2~#5) · 인용 표면 43 → **47**(+ 화면 없는 1 = 07_api 48)
> **개정일**: 2026-09-28 — 07_api/01 확정 값 반영 — 명령 조회 GET /api/v1/commands/{cmdId}를 기능 11행(MST-01~06 · ALM-01 · ALM-08 · WRK-01~03) 호출 표면 열에 · 화면 → 표면 인용에 01_conventions 행 — 인용 표면 42 → **43**(+ 화면 없는 1 = 07_api 44) · 미확인 1행 닫힘 — 기능 · 분류 · 주 화면 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 명령 경로 반영 — 미확인 등재에 명령 조회 표면(07_api/01 확정 대기) 1행 — 인용 표면 · 매핑 수 불변(확정 뒤 다시 센다)
> **개정일**: 2026-09-28 — 리드 판정 1 — 주 기능 없는 두 화면을 **주 기능 없는 실증 화면(OBS 보조)** 분류로 닫는다(새 기능 ID 없음) · 고아 검산을 이 분류 밖 화면으로 · 미확인 1행 닫힘 — 기능 · 분류 · 주 화면 합 불변
> **개정일**: 2026-09-27 — 새 화면 2(EXP-PERF · EXP-FLOW · 08_evidence_screens) — 보조 화면 4행(RLT-05 · OBS-01 · 02 · 03 → EXP-FLOW) · 산출이 보이는 자리 6행(MST-08 · GEN-08~10 · ING-01~13 · ALM-04 · 05 · 06) · 주 화면별 화면 코드 행 10 → **12**(두 화면 주 기능 0 — 고아 2 판정 대기) · 화면 → 표면 인용 호출 화면 2행 — 기능 91 · 분류 · 주 화면 합 42 · 인용 표면 42 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — GEN · OBS 귀속 제안 행 닫힘(README 반영)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(전 축 정합 — 15_traceability 완성) — 매핑 수 불변
> **원천**: D-16(사용자 결정 2026-10-11 — 웹 7화면 · 결정 2 · 3 · 5) · [10_lab_screen.md](./10_lab_screen.md) · [11_hmi_screen.md](./11_hmi_screen.md) · [09_learn_screens.md](./09_learn_screens.md) 요소 표 · D-14(사용자 결정 2026-10-03 · [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) · 리드 지침 .omc/web2-brief.md(2026-10-03 · 재분류 규칙) · 리드 지침 .omc/run-control-brief.md(2026-09-28 · GEN-11 · GEN-12 · 분류 재판정) · D-16(사용자 결정 2026-10-11) · 도메인 파일 8본 [../02_features/02_master.md](../02_features/02_master.md) ~ [../02_features/11_metrics.md](../02_features/11_metrics.md) 기능 목록 · [README.md](./README.md) 화면 인벤토리 · [08_evidence_screens.md](./08_evidence_screens.md) 요소 표 · 호출 표면 표 · [01_standards.md](./01_standards.md) 공통 셸 요소 표 · 07_api 도메인 문서의 표면 요약 · 원본 architecture.md §11(커밋 ff66a37)

이 문서는 **기능 → 화면 매핑과 파생 집계의 정본**이다. 기능 ID와 기능명의 정본은 02_features 도메인 파일 8본이고, 화면 코드의 정본은 [README.md](./README.md) 화면 인벤토리다. 이 문서는 둘을 잇기만 하며 기능도 화면도 새로 만들지 않는다.

**매핑의 근거는 화면 문서의 요소 표다.** 요소 표의 기능 ID 열에 적힌 기능만 그 화면에 매핑하고, 요소 표에 없는 기능을 화면에 붙이지 않는다([01_standards.md](./01_standards.md) §화면 명세 템플릿). 그래서 요소 표를 고치면 이 문서를 같은 변경 단위에서 다시 센다 — 문서 간 정합은 [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md)(W7)가 전 축으로 맞춘다.

**현행 화면은 7과 공통 셸이다(D-16 — 사용자 결정 2026-10-11).** api 표면을 부르는 화면 3(EXP-LAB · EXP-FLOW · HMI-PLANT)이 기능의 주 화면이 되고, 측정 기록만 판독하는 화면 4(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE)는 api 표면을 부르지 않아 주 기능이 없다(§매핑 어휘 기록 판독 화면). 폐지 화면 11(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE · EXP-PERF)은 결번이라 주 화면 · 보조 화면 열에 오지 않는다. 폐지 화면이 주 화면이던 기능은 아래 규칙으로 다시 매핑했다 — ① 현행 화면(공통 셸 포함)이 그 기능의 표면을 부르면 그 화면을 주 화면으로 ② 아니면 표면이 있는 기능은 화면 없음(API 전용) · 표면이 없는 기능은 기존 어휘 그대로 ③ 산출이 보이는 자리의 폐지 화면 언급은 현행 자리 또는 해당 없음으로 ④ 새 기능 ID는 기능 정본(02_features)에서만. D-16이 다시 연 표면(TSQ-01 시계열 조회 — HMI-PLANT 최근 10분)은 규칙 ①로 화면에 올랐다.

## 매핑 어휘

셀은 아래 닫힌 어휘로만 채운다. 빈 칸을 두지 않는다.

| 분류 | 뜻 | 주 화면 열 |
|------|------|------|
| 화면 | 화면 요소가 그 기능의 표면을 호출하거나, 횡단 기능이면 공통 셸이 그 동작을 받는다 | 화면 코드 또는 "공통 셸" |
| 내부 모듈 | 도메인 자체에 외부 표면이 없다 — COL · SIM · ING | 해당 없음 |
| 표면 없음 | 표면이 있는 도메인의 기능이지만 그 기능은 내부 단계 · 실행 인자라 표면이 없다 | 해당 없음 |
| 화면 없음(API 전용) | 표면은 있으나 어느 화면도 부르지 않는다 — 호출 주체가 기계이거나, 부르던 화면이 폐지됐거나(D-14 · D-16), 현행 화면 · 셸에 그 표면을 부르는 요소가 없다 | 해당 없음 |

- 검산: 분류 = **4** · 화면 없는 분류 = 내부 모듈 · 표면 없음 · 화면 없음(API 전용) = **3**
- **기록 판독 화면은 기능 분류가 아니라 화면 축이다(D-16 · 리드 판정 제안 2026-10-11).** api 표면을 하나도 부르지 않는 현행 화면 — 정적 화면(LRN-CONCEPTS)과 BFF가 docs/measurements를 읽기 전용으로 판독하는 화면(LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE) — 이다. 기능 ID는 NestJS 도메인 모듈의 기능이라 BFF 판독기(웹 내부)에 붙일 자리가 없고, 그래서 이 화면들의 주 기능 0은 고아가 아니라 설계다. **고아 판정은 api 표면을 부르는 현행 화면에만 건다** — 표면을 부르면서 주 기능이 0인 화면이 생기면 그것은 고아다.
- **간접 표시는 매핑이 아니다.** 내부 기능의 산출이 화면에 보이는 자리(예: ING의 컨슈머 랙이 EXP-FLOW Redis 적체 지표에 보인다)는 아래 표의 "산출이 보이는 자리" 열에 적되 분류를 바꾸지 않는다 — 화면이 부르는 것은 OBS 표면이지 ING가 아니다.
- **주 화면은 기능 하나에 하나다.** 여러 화면이 같은 표면을 부르면 기능의 목적과 페르소나가 같은 화면을 주 화면으로, 나머지를 보조로 적는다. 집계는 주 화면으로만 센다 — 보조까지 세면 기능 수가 화면 수만큼 부풀어 기능 총수와 맞지 않는다.

## 기능 → 화면 매핑

도메인 순서는 [../README.md](../README.md) 고정 기준의 도메인 목록 순서다. 표면 없는 도메인(COL · SIM · ING)과 실행 인자 기능 묶음은 범위 한 행으로 묶고 행마다 기능 수를 적는다.

| 기능 ID | 기능명 | 분류 | 주 화면 | 보조 화면 | 호출 표면(메서드 + 경로) | 산출이 보이는 자리 |
|------|------|------|------|------|------|------|
| MST-01 | 사이트 · 라인 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/sites · PATCH /api/v1/sites/{id} · GET · POST /api/v1/lines · PATCH /api/v1/lines/{id} · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-MASTER(D-14) |
| MST-02 | 설비 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/devices · PATCH /api/v1/devices/{id} · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | EXP-FLOW 업무 명령(GEN-12 시연 전용 행의 설비 수정 명령 — 화면이 부르는 것은 flow 프레임) · EXP-FLOW 조회 줄(목록 사본 히트 · 미스 — mst_cache_requests_total · 화면이 부르는 것은 GET /metrics) |
| MST-03 | Modbus 접속 설정 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · PUT /api/v1/devices/{id}/modbus-config · POST /api/v1/devices(함께 등록) · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-MASTER(D-14) |
| MST-04 | 태그 마스터 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/tags · PATCH /api/v1/tags/{id} · GET /api/v1/tags/{id} · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-MASTER(D-14) |
| MST-05 | 태그 논리 삭제 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/tags/{id}/deactivate · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-MASTER(D-14) |
| MST-06 | 스케일 변경 시 새 태그 발급 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/tags/{id}/reissue · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-MASTER(D-14) |
| MST-07 | 태그 메타 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 내부 조회 | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| MST-08 | 캐시 무효화 체인 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 쓰기 표면의 후처리 | EXP-FLOW 업무 명령(무효화 키 수 · ch:cacheinv) — 셸 신호 수신(⑥)은 D-14로 빠짐 |
| MST-09 | Dictionary 원천 제공 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-07이 소비 | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| COL-01~09 | 수집(9) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 폐지 화면 DSH-REALTIME · EXP-CONSOLE(D-14) |
| SIM-01~05 | 시뮬레이션(5) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| GEN-01~03 · 05 | 생성 · 모드 A · B(4) | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 실행 인자 | EXP-FLOW 발생원 초당 포인트(모드 B — 메트릭) |
| GEN-12 | 흐름 시연 실행 | 화면 | EXP-FLOW | 해당 없음 | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop | EXP-FLOW 진행 띠 · 흐름도 · 숫자 4(실행이 늘린 발행 · 명령이 flow 프레임으로 보인다) · 발생원 초당 포인트(mode run) |
| GEN-13 | 직접 비교 실행 | 화면 | EXP-LAB | 해당 없음 | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop · GET /api/v1/runs/latest?type=compare | EXP-LAB 패널 3(넣기 · 조회 대결 · 무결성) · 진행 띠 · EXP-FLOW 흐름도(넣기 동안 비교 사본 갈래 "비교 실험 중" — flow 프레임 · 화면이 부르는 것은 WS) |
| GEN-14 | 센서 데이터 현황 · 지우기 | 화면 | EXP-LAB | EXP-FLOW · HMI-PLANT(공용 컨트롤 데이터 지우기) | GET /api/v1/data/sensor/stats · POST /api/v1/data/sensor/purge | EXP-LAB 머리 쌓인 비교 데이터 · 지우기 확인 창 · 결과 한 줄 |
| ING-01~08 · 10~13 | 적재 · 분기(12) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | EXP-FLOW 흐름도 · DB 노드 · 모아서 대 하나씩(flow 프레임 — 분기 ING-10 · 대조군 ING-11) · 숫자 4 밀린 데이터(컨슈머 랙 — 메트릭) |
| TSQ-01 | 시계열 조회 | 화면 | HMI-PLANT | 해당 없음 | POST /api/v1/timeseries/query(api 직결 · 최근 10분 · interval raw · maxPoints 660) | HMI-PLANT 태그 목록 작은 선 · EXP-FLOW 조회 줄(시계열 사본 히트 · 미스 — tsq_cache_requests_total · GEN-12 조회 섞기가 프로세스 안에서 부른다 · 화면이 부르는 것은 GET /metrics) |
| TSQ-02 | 해상도 자동 선택 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query(meta.interval) | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-03 | 캐시 키 정규화 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-04의 내부 단계 | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-04 | 조회 결과 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-05 | 스탬피드 방지 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | 해당 없음 — 폐지 화면 EXP-COMPARE(D-14) |
| TSQ-06 | 다운샘플 | 화면 | HMI-PLANT | 해당 없음 | POST /api/v1/timeseries/query(0.1초 태그 원시 최근 10분 — 끝을 다음 분 경계로 올려 최대 11분 6,600점 → 서버 LTTB 660점) | HMI-PLANT 작은 선(화면은 meta.downsampled를 따로 표시하지 않는다 — 서버가 1차 방어선) |
| TSQ-07 | 태그 메타 부착 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query(태그 메타) | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-08 | 진행 구간 분할 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query · GET /api/v1/realtime/devices/{id}/tags | 해당 없음 — 폐지 화면 DSH-REALTIME · ANL-TREND(D-14) |
| TSQ-09 | 원시 내보내기 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/timeseries/export | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| RLT-01 | 설비 전체 최신값 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags | EXP-FLOW 조회 줄(지금 값 hit · restored · bypass — rlt_latest_requests_total · GEN-12 조회 섞기가 프로세스 안에서 부른다 · 화면이 부르는 것은 GET /metrics) — 부르던 화면 DSH-REALTIME은 폐지(D-14) |
| RLT-02 | 단일 태그 최신값 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/realtime/tags/{id} | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| RLT-03 | STALE 판정 · 메타 부착 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags(quality · staleAfterMs · servedAt) | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| RLT-04 | 빈 키 복원과 503 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags(meta.source · restored) | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| RLT-05 | WebSocket 구독 | 화면 | EXP-FLOW | 해당 없음 — 셸 요소 표에 대응 행 없음 | WS /ws/realtime(subscribe_flow — 구독 수단) | 해당 없음 |
| RLT-06 | 스로틀 병합 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | WS /ws/realtime(rt 프레임 — ch:rt만 병합) | 해당 없음 — 폐지 화면 DSH-REALTIME(D-14) |
| RLT-07 | 연결 관리 · 재연결 동기화 | 화면 | EXP-FLOW | 해당 없음 — 연결 3상태는 EXP-FLOW 흐름 구독 표지(셸 WS 표지 폐지) | WS /ws/realtime(재연결 뒤 subscribe_flow 재전송) | 해당 없음 |
| RLT-09 | 무효화 신호 중계 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | WS /ws/realtime(cacheinv — ch:cacheinv 중계) | 해당 없음 — 셸이 신호를 받지 않는다(리드 판정 2026-10-03) |
| RLT-10 | 설비 가동 스위치 | 화면 | HMI-PLANT | EXP-FLOW(머리 스위치) · EXP-LAB(데이터 지우기가 가동 상태를 읽는다) | GET · POST /api/v1/plant/power | HMI-PLANT 라인 판 꺼짐 안내 · EXP-FLOW 흐름도 설비 가동 꺼짐 안내(health run.sensorAutogen — 실행 중 실효 상태) |
| RLT-11 | HMI 설비 개요 | 화면 | HMI-PLANT | 해당 없음 | GET /api/v1/plant/overview(BFF 경유 · 1초) | HMI-PLANT 요약 줄 · 라인 판 30칸 · 상세 머리 · 태그 목록 |
| OBS-01 | 앱 메트릭 통합 노출 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics(화면은 BFF 경유) | 해당 없음 |
| OBS-02 | 저장소 메트릭 수집 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-03 | 키 계열별 메모리 샘플링 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-04 | E2E 지연 게이지 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-05 | 헬스체크 | 화면 | EXP-FLOW | 해당 없음 | GET /api/v1/health | 해당 없음 |
| OBS-06 | 스위치 상태 노출 | 화면 | EXP-FLOW | 해당 없음 | GET /api/v1/health · GET /metrics | EXP-FLOW 각주의 꺼진 길(스위치 이름은 툴팁) |

- 검산: 표 행 = MST 9 + COL 1 + SIM 1 + GEN 4 + ING 1 + TSQ 9 + RLT 10 + OBS 6 = **41** · 범위 행이 담는 기능 = COL 9 + SIM 5 + GEN 4 + ING 12 = **30** · 기능 = 41 − 범위 행 4 + 30 = **67** · 폐지 도메인 AUT · ALM · WRK와 결번 기능(GEN-04 · 06~11 · ING-09 · RLT-08)은 행을 두지 않는다(D-16)
- **GEN-12 · GEN-13이 실행 표면 4를 함께 쓴다.** 실행 표면은 본문의 type(flow · compare)으로 종류를 가르므로 같은 표면이 두 기능에 걸리고, 각 기능의 주 화면은 그 type을 시작하는 화면이다(GEN-12 EXP-FLOW · GEN-13 EXP-LAB). 다른 종류의 실행을 current · 단건 조회로 보는 것은 보조 매핑이 아니라 동시 실행 1 규칙의 표시다([08_evidence_screens.md](./08_evidence_screens.md) §실행 패널). 옛 GEN-11(성능 비교 라이브 실행 — EXP-PERF)은 D-16으로 지웠다.
- **폐지 화면의 기능이 화면 없음(API 전용)이 된 것은 누락이 아니다(D-14 결정 1).** 표면은 그대로 살아 있고 호출 주체가 curl · 통합 테스트 · 흐름 시연 실행으로 바뀌었을 뿐이다 — 흐름 시연이 업무 명령 경로를 쓰고 측정 기록이 이 표면들을 인용하므로 표면을 지우면 EXP-FLOW가 보여 줄 업무 길과 기록의 근거가 함께 사라진다.
- **OBS 6이 EXP-FLOW로 모인 이유** — EXP-FLOW가 GET /metrics를 5초마다 부르고(숫자 4 · 흐름도 DB 노드 — 측정 → 저장까지 포함) 각주의 꺼진 길 · 스위치 상태를 health로 보인다.
- **RLT 중 넷이 화면이다.** WS /ws/realtime 한 표면이 여러 메시지 type을 싣는다 — EXP-FLOW가 쓰는 것은 subscribe_flow 구독(RLT-05) · 연결 관리와 재연결 뒤 재구독(RLT-07)이고, HMI-PLANT가 설비 가동(RLT-10) · 개요(RLT-11)를 부른다. rt 프레임 병합(RLT-06) · 무효화 신호 중계(RLT-09)는 받는 화면이 없어 화면 없음(API 전용)이다 — 셸은 연결을 하나 열지만 cacheinv를 받지 않는다(공통 셸 요소 표에 신호 수신 행이 없다 · [01_standards.md](./01_standards.md)). "받고 버린다"를 매핑하면 화면이 기능을 쓴다고 세게 된다. HMI-PLANT의 지금 값은 RLT-01(최신값 표면)이 아니라 RLT-11 개요로 읽는다 — 설비 30대를 파이프라인 한 번으로 읽는 별도 표면이다.

## 파생 집계

### 분류별

| 분류 | 기능 수 | 내역 |
|------|------|------|
| 화면 | **15** | GEN 3(12 · 13 · 14) · TSQ 2(01 · 06) · RLT 4(05 · 07 · 10 · 11) · OBS 6 |
| 내부 모듈 | **26** | COL 9 · SIM 5 · ING 12 |
| 표면 없음 | **10** | MST 3(07 · 08 · 09) · GEN 4(01~03 · 05) · TSQ 3(03 · 04 · 05) |
| 화면 없음(API 전용) | **16** | MST 6(01~06) · TSQ 4(02 · 07 · 08 · 09) · RLT 6(01~04 · 06 · 09) |

- 검산: 화면 3 + 2 + 4 + 6 = **15** · 내부 모듈 9 + 5 + 12 = **26** · 표면 없음 3 + 4 + 3 = **10** · 화면 없음(API 전용) 6 + 4 + 6 = **16** · 15 + 26 + 10 + 16 = **67** — 누락 0
- 표면 있는 기능 = 화면 15 + 화면 없음(API 전용) 16 = **31** · 표면 없는 기능 = 내부 모듈 26 + 표면 없음 10 = **36** · 31 + 36 = **67** · 옛 권한 매트릭스와의 교차 검산은 D-16으로 없어졌다(역할 · 인가 없음)

### 주 화면별

| 주 화면 | 기능 수 | 기능 |
|------|------|------|
| EXP-FLOW | 9 | GEN-12(실행 패널) · RLT-05 · 07 · OBS-01~06 — 흐름 이벤트는 기능 ID 없음 |
| EXP-LAB | 2 | GEN-13(패널 3 · 진행 띠) · GEN-14(쌓인 비교 데이터 · 지우기) |
| HMI-PLANT | 4 | RLT-10(설비 가동 스위치) · RLT-11(개요) · TSQ-01 · TSQ-06(최근 10분) |
| 기록 판독 화면 4(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE) | 0 | 해당 없음 — api 표면을 부르지 않는다(§매핑 어휘 기록 판독 화면) |
| 폐지 화면 11(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE · EXP-PERF) | 0 | 해당 없음 — 결번(D-14 · EXP-PERF는 D-16) |

- 검산: 9 + 2 + 4 + 0 + 0 = **15** = 분류 "화면" · 현행 화면 코드 = 표면을 부르는 화면 3 + 기록 판독 화면 4 = **7** — 인벤토리 현행 7과 같다 · 공통 셸의 주 기능은 0이다(옛 AUT-02 · 04~07은 D-16 폐지)
- **유령 0 · 고아 0** — 주 화면 · 보조 화면 열의 화면 코드는 전부 인벤토리 현행 화면이고(유령 0 — 폐지 화면 코드는 두 열에 없다), api 표면을 부르는 현행 3은 주 기능을 1개 이상 갖는다(고아 0). 기록 판독 화면 4의 주 기능 0은 고아가 아니다 — 부르는 표면이 없어 기능을 붙일 자리가 없다(§매핑 어휘). 표면을 부르면서 주 기능 0인 현행 화면이 생기면 그것은 고아다.
- **보조 화면은 집계하지 않는다.** GEN-14는 EXP-FLOW · HMI-PLANT 머리의 공용 컨트롤로도 불리고 RLT-10은 EXP-FLOW 머리 스위치 · EXP-LAB 지우기 버튼으로도 불린다 — 기능의 목적과 페르소나가 같은 화면 하나만 주 화면이다(GEN-14 — 쌓인 비교 데이터를 보이는 EXP-LAB · RLT-10 — 설비 가동이 현장 적용의 조작인 HMI-PLANT).
- **재분류 이력** — D-14(2026-10-03)는 폐지 화면 10이 주 화면이던 기능을 현행 자리로 올리거나 화면 없음(API 전용)으로 내렸고, D-16(2026-10-11)은 AUT · ALM · WRK 도메인과 EXP-PERF · 결번 기능을 지운 뒤 같은 날 7화면을 열어 TSQ-01 · 06을 HMI-PLANT로 올리고 새 기능 4를 매핑했다. 단계마다의 수는 개정일 줄이 갖는다.
- **EXP-FLOW의 흐름 이벤트(ch:flow 발행 · flow 중계)는 관찰 보조 채널이라 기능으로 세지 않는다** — 주 기능은 실행 패널(GEN-12)과 구독 · 메트릭 · health 요소다.

### 도메인별

| 도메인 | 기능 | 화면 | 내부 모듈 | 표면 없음 | API 전용 | 주 화면 |
|------|------|------|------|------|------|------|
| MST | 9 | 0 | 0 | 3 | 6 | 해당 없음 |
| COL | 9 | 0 | 9 | 0 | 0 | 해당 없음 |
| SIM | 5 | 0 | 5 | 0 | 0 | 해당 없음 |
| GEN | 7 | 3 | 0 | 4 | 0 | EXP-FLOW 1 · EXP-LAB 2 |
| ING | 12 | 0 | 12 | 0 | 0 | 해당 없음 |
| TSQ | 9 | 2 | 0 | 3 | 4 | HMI-PLANT 2 |
| RLT | 10 | 4 | 0 | 0 | 6 | EXP-FLOW 2 · HMI-PLANT 2 |
| OBS | 6 | 6 | 0 | 0 | 0 | EXP-FLOW 6 |

- 검산: 기능 9 + 9 + 5 + 7 + 12 + 9 + 10 + 6 = **67** · 화면 열 합 3 + 2 + 4 + 6 = **15** · API 전용 열 합 6 + 4 + 6 = **16** · 행마다 화면 + 내부 모듈 + 표면 없음 + API 전용 = 기능
- **화면 공백 도메인은 넷이다 — COL · SIM · ING(내부 모듈) · MST(D-14 — 폐지 화면이 부르던 표면만 남았다).** 앞의 셋은 07_api 표면 없음 3과 같은 도메인이다. MST는 표면이 그대로 있어(D-14 결정 1) 화면 없음(API 전용)이고, 산출은 EXP-FLOW 흐름도의 업무 길 · 조회 줄과 HMI-PLANT의 설비 · 태그 이름(개요가 마스터 사본을 붙인다)으로만 보인다. TSQ는 D-16으로 HMI-PLANT 최근 10분이 시계열 조회를 다시 부르면서 공백에서 빠졌다. GEN은 흐름 시연(GEN-12)이 EXP-FLOW, 직접 비교 · 지우기(GEN-13 · 14)가 EXP-LAB를 주 화면으로 갖고, 생성기 모드 A · B(GEN-01~03 · 05)는 실행 인자라 산출이 EXP-FLOW 발생원 · HMI-PLANT 30칸 값으로만 보인다. RLT · OBS는 EXP-FLOW와 HMI-PLANT 귀속이다.

## 화면 → 표면 인용

현행 화면이 인용한 표면을 07_api 문서별로 모은다. 표면 번호({문서} #N)는 쓰지 않고 메서드 + 경로로 적는다 — 번호 대응은 [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md)가 맞춘다. 화면이 부르지 않는 표면은 행을 지우지 않고 수 0과 화면 없음(API 전용)으로 적는다.

| 07_api 문서 | 화면이 인용한 표면 | 수 | 호출 화면 |
|------|------|------|------|
| [../07_api/01_conventions.md](../07_api/01_conventions.md) | 해당 없음 — GET /api/v1/commands/{cmdId}는 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ADM-MASTER(D-14) |
| [../07_api/04_master.md](../07_api/04_master.md) | 해당 없음 — 17 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ADM-MASTER(D-14) |
| [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | POST /api/v1/timeseries/query(api 직결) — 원시 내보내기 GET /api/v1/timeseries/export는 화면 없음(API 전용) | 1 | HMI-PLANT(최근 10분) |
| [../07_api/06_realtime.md](../07_api/06_realtime.md) | GET · POST /api/v1/plant/power · GET /api/v1/plant/overview(BFF 경유) — 최신값 2(설비 전체 · 단일 태그)는 화면 없음(API 전용) | 3 | HMI-PLANT(셋) · EXP-FLOW(설비 가동 GET · POST) · EXP-LAB(설비 가동 GET — 지우기 버튼) |
| [../07_api/09_datagen.md](../07_api/09_datagen.md) | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop · GET /api/v1/runs/latest?type=compare · GET /api/v1/data/sensor/stats · POST /api/v1/data/sensor/purge(BFF 경유 no-store) | 7 | EXP-FLOW(실행 4 · 현황 · 지우기) · EXP-LAB(실행 5 · 현황 · 지우기) · HMI-PLANT(현황 · 지우기) |
| [../07_api/10_metrics.md](../07_api/10_metrics.md) | GET /api/v1/health · GET /metrics(화면은 BFF 경유) | 2 | EXP-FLOW |
| [../07_api/11_websocket.md](../07_api/11_websocket.md) | WS /ws/realtime | 1 | EXP-FLOW(subscribe_flow · flow) · 공통 셸(연결만 — cacheinv 중계 RLT-09는 받지 않는다) |

- 검산: 인용 표면 = 0 + 0 + 1 + 3 + 7 + 2 + 1 = **14** · 화면이 인용하지 않은 표면 = 명령 조회 1 + 마스터 17 + 시계열 내보내기 1 + 최신값 2 = **21** · 14 + 21 = **35** = [../07_api/README.md](../07_api/README.md) 표면 총수와 같다
- **EXP-FLOW의 flow 프레임은 새 표면이 아니라 WS /ws/realtime 한 표면의 메시지 type이다** — 표면이 늘지 않으므로 인용 수도 늘지 않는다.
- **기록 판독 화면 4는 이 표에 행이 없다** — BFF 기록 읽기(/bff/measurements)는 api 표면이 아니라 웹 내부 경로다(정본 [01_standards.md](./01_standards.md) §요청 경로와 공통 셸 측정 기록 읽기 행).
- **화면이 부르지 않는 표면은 21이다** — 마스터 · 명령 조회 · 최신값 · 내보내기는 폐지 화면이 부르던 표면이다(D-14). 무효화 신호 중계(RLT-09)는 WS /ws/realtime 한 표면의 메시지 type이라 표면 수가 아니라 이 문서 매핑 표에서 화면 없음(API 전용)으로 닫는다. 화면 없는 표면이 늘거나 줄면 그 표면의 호출 주체를 이 표에 적는다.
- 07_api README의 표면 총수와 이 표의 합이 다르면 차이는 화면 없는 표면이다 — 표면 총수의 정본은 [../07_api/README.md](../07_api/README.md)이고 이 표는 그것을 세지 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| README 도메인 공백 행의 GEN · OBS 잠정 귀속 | 닫힘 — README 도메인 공백 행 반영 · **D-14로 다시 바뀜**(OBS는 EXP-FLOW 귀속) · **D-16으로 다시 바뀜**(공백 도메인 4 — TSQ 빠짐) | [README.md](./README.md) |
| 주 기능 없는 화면 2(EXP-PERF · EXP-FLOW) · 흐름 이벤트 기능 ID | **닫힘(리드 판정 1 · 2026-09-28)** — 새 기능 ID 없음 · 주 기능 없는 실증 화면(OBS 보조) 분류 인정 · **같은 날 재판정으로 대체**(아래 분류 재판정 행 — GEN-11 · 12 신설로 분류 2 → 0) | 이 문서 |
| 명령 조회 표면(GET /api/v1/commands/{cmdId}) | **닫힘(2026-09-28)** — 07_api/01 확정(횡단 표면 #1 · 기능 MST-01~06 — 옛 ALM · WRK 기능은 D-16 폐지) · 해당 기능 행의 호출 표면 열에 반영 · **D-14 뒤 화면 없음(API 전용)** — 부르던 화면 4가 폐지됐다 | 이 문서 |
| 두 실증 화면의 분류 재판정(GEN-11 · GEN-12 신설) | **닫힘(리드 판정 2026-09-28)** — 실행 패널의 주 화면 = 각 화면 · 주 기능 없는 실증 화면 분류 2 → 0 | 이 문서 |
| 폐지 화면 10의 기능 재분류(D-14) | **닫힘(2026-10-03)** — 현행 자리로 올림 10 · 화면 없음(API 전용)으로 내림 27 · **같은 날 리드 판정(웨이브 1 정합)으로 올림 9 · 내림 28 + RLT-09**(AUT-03 · RLT-09 → 화면 없음(API 전용)) · 표면 없는 기능은 기존 어휘 그대로 · 새 기능 ID · 새 어휘 없음 | 이 문서 · [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |
| 폐지 도메인 · 결번 기능 · EXP-PERF 재분류(D-16) | **닫힘(2026-10-11)** — AUT · ALM · WRK 행 · 결번 기능 행 · EXP-PERF 삭제 · 공통 셸 주 기능 0 · 새 기능 ID · 새 어휘 없음 | 이 문서 · [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |
| 7화면 · 새 기능 4 매핑(D-16) | **닫힘(2026-10-11)** — GEN-13 · 14 EXP-LAB · RLT-10 · 11 HMI-PLANT · TSQ-01 · 06 HMI-PLANT로 올림 · 기록 판독 화면 축(LRN 4 — 주 기능 0이 설계) — 리드에 판정 제안 보고(2026-10-11) | 이 문서 · [README.md](./README.md) |
| 기능 ↔ REQ ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전 축 정합 | 닫힘 — 전 축 매핑 완성(미매핑 0 · 유령 0) — [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) | [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [01_standards.md](./01_standards.md) — 명세 템플릿 · 공통 셸 요소 표
- [08_evidence_screens.md](./08_evidence_screens.md) — EXP-FLOW 요소 표 · 실행 패널
- [09_learn_screens.md](./09_learn_screens.md) — 기록 판독 화면 4
- [10_lab_screen.md](./10_lab_screen.md) — EXP-LAB 요소 표 · 공용 컨트롤
- [11_hmi_screen.md](./11_hmi_screen.md) — HMI-PLANT 요소 표
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-14 2화면 전환 · D-16 7화면
- [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) — 전 축 추적성
- [../07_api/README.md](../07_api/README.md) — 표면 목차 · 표면 총수
