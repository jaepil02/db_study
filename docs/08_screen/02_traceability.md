# 기능 → 화면 추적성 (02_traceability)

> **대상**: 기능 93 → 화면 매핑 전수 · 화면 없는 기능의 닫힌 어휘(내부 모듈 · 표면 없음 · 화면 없음(API 전용)) · 주 화면별 파생 집계 · 권한 매트릭스와의 교차 검산 · 화면 → 표면 인용 목록 · 누락 0 · 유령 0 검산
> **작성일**: 2026-09-24
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
> **원천**: D-14(사용자 결정 2026-10-03 · [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) · 리드 지침 .omc/web2-brief.md(2026-10-03 · 재분류 규칙) · 리드 지침 .omc/run-control-brief.md(2026-09-28 · GEN-11 · GEN-12 · 분류 재판정) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) 역할 × 기능 매트릭스 · §검산 · 도메인 파일 11본 [../02_features/01_auth.md](../02_features/01_auth.md) ~ [../02_features/11_metrics.md](../02_features/11_metrics.md) 기능 목록 · [README.md](./README.md) 화면 인벤토리 · [08_evidence_screens.md](./08_evidence_screens.md) 요소 표 · 호출 표면 표 · [01_standards.md](./01_standards.md) 공통 셸 요소 표 · 07_api 도메인 문서의 표면 요약 · 원본 architecture.md §11(커밋 ff66a37)

이 문서는 **기능 → 화면 매핑과 파생 집계의 정본**이다. 기능 ID와 기능명의 정본은 02_features 도메인 파일 11본이고, 화면 코드의 정본은 [README.md](./README.md) 화면 인벤토리다. 이 문서는 둘을 잇기만 하며 기능도 화면도 새로 만들지 않는다.

**매핑의 근거는 화면 문서의 요소 표다.** 요소 표의 기능 ID 열에 적힌 기능만 그 화면에 매핑하고, 요소 표에 없는 기능을 화면에 붙이지 않는다([01_standards.md](./01_standards.md) §화면 명세 템플릿). 그래서 요소 표를 고치면 이 문서를 같은 변경 단위에서 다시 센다 — 문서 간 정합은 [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md)(W7)가 전 축으로 맞춘다.

**현행 화면은 EXP-PERF(/performance) · EXP-FLOW(/monitoring) 2개와 공통 셸이다(D-14 · 사용자 결정 2026-10-03).** 폐지 화면 10(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE)은 결번이라 주 화면 · 보조 화면 열에 오지 않는다. 그 화면이 주 화면이던 기능은 아래 규칙으로 다시 매핑했다 — ① 현행 화면(공통 셸 포함)이 그 기능의 표면을 부르면 그 화면을 주 화면으로 ② 아니면 표면이 있는 기능은 화면 없음(API 전용) · 표면이 없는 기능은 기존 어휘 그대로 ③ 산출이 보이는 자리의 폐지 화면 언급은 현행 자리 또는 해당 없음으로 ④ 새 기능 ID · 새 어휘 없음. **api 표면은 지우지 않는다**(D-14 결정 1) — 그래서 표면 수는 그대로이고 화면이 인용하는 표면만 준다.

## 매핑 어휘

셀은 아래 닫힌 어휘로만 채운다. 빈 칸을 두지 않는다.

| 분류 | 뜻 | 주 화면 열 | 권한 매트릭스 어휘와의 대응 |
|------|------|------|------|
| 화면 | 화면 요소가 그 기능의 표면을 호출하거나, 횡단 기능이면 공통 셸이 그 동작을 받는다 | 화면 코드 또는 "공통 셸" | 허용 · 거부(역할 판정) · 공개 · 횡단 |
| 내부 모듈 | 도메인 자체에 외부 표면이 없다 — COL · SIM · ING | 해당 없음 | 내부(내부 모듈) |
| 표면 없음 | 표면이 있는 도메인의 기능이지만 그 기능은 내부 단계 · 실행 인자라 표면이 없다 | 해당 없음 | 내부(내부 단계 · 실행 인자) |
| 화면 없음(API 전용) | 표면은 있으나 어느 화면도 부르지 않는다 — 호출 주체가 기계이거나, 부르던 화면이 폐지됐거나(D-14), 현행 화면 · 셸에 그 표면을 부르는 요소가 없다 | 해당 없음 | 게이트 · 공개 · 역할 판정 |

- 검산: 분류 = **4** · 화면 없는 분류 = 내부 모듈 · 표면 없음 · 화면 없음(API 전용) = **3**
- **간접 표시는 매핑이 아니다.** 내부 기능의 산출이 화면에 보이는 자리(예: ING의 컨슈머 랙이 EXP-FLOW Redis 적체 지표에 보인다)는 아래 표의 "산출이 보이는 자리" 열에 적되 분류를 바꾸지 않는다 — 화면이 부르는 것은 OBS 표면이지 ING가 아니다.
- **주 화면은 기능 하나에 하나다.** 여러 화면이 같은 표면을 부르면 기능의 목적과 페르소나가 같은 화면을 주 화면으로, 나머지를 보조로 적는다. 집계는 주 화면으로만 센다 — 보조까지 세면 기능 수가 화면 수만큼 부풀어 기능 총수와 맞지 않는다.

## 기능 → 화면 매핑

도메인 순서는 [../README.md](../README.md) 고정 기준의 도메인 목록 순서다. 표면 없는 도메인(COL · SIM · ING)과 실행 인자 기능 묶음은 범위 한 행으로 묶고 행마다 기능 수를 적는다.

| 기능 ID | 기능명 | 분류 | 주 화면 | 보조 화면 | 호출 표면(메서드 + 경로) | 산출이 보이는 자리 |
|------|------|------|------|------|------|------|
| AUT-01 | 로그인 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/auth/login | 해당 없음 — 로그인 화면은 폐지(AUTH-LOGIN · D-14) · 현행 셸에 사용자 메뉴 없음 |
| AUT-02 | 토큰 갱신 | 화면 | 공통 셸 | 해당 없음 | POST /api/v1/auth/refresh(셸 인증 가드 — BFF 갱신 1회) | 표시 없음 — 조용한 갱신 |
| AUT-03 | 로그아웃 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/auth/logout | 해당 없음 — 현행 셸에 사용자 메뉴 없음(리드 판정 2026-10-03) |
| AUT-04 | 신원 확인 | 화면 | 공통 셸 | EXP-PERF · EXP-FLOW | 인증이 필요한 전 표면 · WS /ws/realtime | 401 안내 — 로그인 화면은 폐지(AUTH-LOGIN · D-14) |
| AUT-05 | 역할 기반 인가 | 화면 | 공통 셸 | 역할 판정 화면(EXP-PERF · EXP-FLOW 실행 패널) | 인가 대상 전 표면 | 버튼 활성 · 403 제자리 안내 |
| AUT-06 | 레이트 리밋 | 화면 | 공통 셸 | EXP-PERF · EXP-FLOW | 인증이 필요한 전 REST 표면 | 429 띠 |
| AUT-07 | 요청 출처 방어 | 화면 | 공통 셸 | EXP-FLOW(흐름 구독 표지 — 출처 거절 표시) | 직결 표면 · WS /ws/realtime | EXP-FLOW 흐름 구독 표지(끊김 — 4403 출처 거절 사유 · 셸 WS 표지 폐지 — 리드 판정 2026-10-03) |
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
| GEN-01~06 | 생성 · 모드 A · B(6) | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 실행 인자 | EXP-FLOW 발생원 초당 포인트(모드 B — 메트릭) |
| GEN-07 | 모드 C 부하 주입 표면 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/ingest/bulk — k6 · datagen 컨테이너가 부른다 | 해당 없음 — 폐지 화면 EXP-CONSOLE(D-14) |
| GEN-08~10 | 모드 D · 단독 실측 · 대조군 백필(3) | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 실행 인자 | EXP-PERF(BFF가 docs/measurements 기록을 읽는다) |
| GEN-11 | 성능 비교 라이브 실행 | 화면 | EXP-PERF | 해당 없음 | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop | EXP-PERF 진행 띠 · 그림 2 내 측정 점(시연값) |
| GEN-12 | 흐름 시연 실행 | 화면 | EXP-FLOW | 해당 없음 | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop | EXP-FLOW 진행 띠 · 흐름도 · 숫자 4(실행이 늘린 발행 · 명령이 flow 프레임으로 보인다) · 발생원 초당 포인트(mode run) |
| ING-01~13 | 적재 · 분기(13) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | EXP-FLOW 흐름도 · DB 노드 · 모아서 대 하나씩(flow 프레임 — 분기 ING-10 · 대조군 ING-11) · 숫자 4 밀린 데이터(컨슈머 랙 — 메트릭) |
| TSQ-01 | 시계열 조회 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query | EXP-FLOW 조회 줄(시계열 사본 히트 · 미스 — tsq_cache_requests_total · GEN-12 조회 섞기가 프로세스 안에서 부른다 · 화면이 부르는 것은 GET /metrics) — 부르던 화면 ANL-TREND · DSH-REALTIME은 폐지(D-14) |
| TSQ-02 | 해상도 자동 선택 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query(meta.interval) | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-03 | 캐시 키 정규화 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-04의 내부 단계 | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-04 | 조회 결과 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
| TSQ-05 | 스탬피드 방지 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | 해당 없음 — 폐지 화면 EXP-COMPARE(D-14) |
| TSQ-06 | 다운샘플 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/timeseries/query(meta.downsampled) | 해당 없음 — 폐지 화면 ANL-TREND(D-14) |
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
| RLT-08 | 알람 푸시 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | WS /ws/realtime(alarm) | 해당 없음 — 폐지 화면 ALM-CONSOLE · DSH-REALTIME(D-14) |
| RLT-09 | 무효화 신호 중계 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | WS /ws/realtime(cacheinv — ch:cacheinv 중계) | 해당 없음 — 셸이 신호를 받지 않는다(리드 판정 2026-10-03) |
| ALM-01 | 알람 규칙 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/alarms/rules · PATCH /api/v1/alarms/rules/{id} · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ALM-RULES(D-14) |
| ALM-02 | 규칙 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 내부 단계 | 해당 없음 |
| ALM-03 | 디바운스 판정 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ING-09가 호출 | EXP-FLOW 배치 점 알람 단계 · 모아서 대 하나씩 센서 막대(flow 프레임) |
| ALM-04 | 이벤트 확정 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 후속 | EXP-FLOW 흐름도 PostgreSQL 알람 이벤트(opened · closed) |
| ALM-05 | 판정 전수 기록 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 후속 | EXP-FLOW 흐름도 ClickHouse 갈래 선 굵기(judgedRows) |
| ALM-06 | 발생 · 해제 발행 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — RLT-08이 전달 | EXP-FLOW 흐름도 알람 갈래(ch:alarm) |
| ALM-07 | 알람 이벤트 조회 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/alarms/events | 해당 없음 — 폐지 화면 ALM-CONSOLE(D-14) |
| ALM-08 | 알람 확인 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/alarms/events/{id}/ack · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ALM-CONSOLE(D-14) |
| ALM-09 | 판정 이력 분석 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/alarms/evaluations | 해당 없음 — 폐지 화면 ALM-RULES(D-14) |
| WRK-01 | 작업지시 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/work-orders · GET · PATCH /api/v1/work-orders/{id} · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-WORKORDER(D-14) |
| WRK-02 | 작업지시 상태 관리 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/work-orders/{id}/status · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-WORKORDER(D-14) |
| WRK-03 | 생산 실적 기록 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET · POST /api/v1/work-orders/{id}/production-logs · GET /api/v1/commands/{cmdId}(202 뒤 — 명령 조회) | 해당 없음 — 폐지 화면 ADM-WORKORDER(D-14) |
| WRK-04 | 감사 로그 기록 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 쓰기 트랜잭션 안 단계 | 해당 없음 — 폐지 화면 ADM-AUDIT(D-14) |
| WRK-05 | 감사 로그 조회 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | GET /api/v1/audit-logs · GET /api/v1/audit-logs/tag-reissues | 해당 없음 — 폐지 화면 ADM-AUDIT · ANL-TREND(D-14) |
| OBS-01 | 앱 메트릭 통합 노출 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics(화면은 BFF 경유) | 해당 없음 |
| OBS-02 | 저장소 메트릭 수집 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-03 | 키 계열별 메모리 샘플링 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-04 | E2E 지연 게이지 | 화면 | EXP-FLOW | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-05 | 헬스체크 | 화면 | EXP-FLOW | EXP-PERF(각주 툴팁) | GET /api/v1/health | 해당 없음 |
| OBS-06 | 스위치 상태 노출 | 화면 | EXP-FLOW | EXP-PERF(각주 툴팁) | GET /api/v1/health · GET /metrics | EXP-FLOW 각주의 꺼진 길(스위치 이름은 툴팁) |

- 검산: 표 행 = AUT 7 + MST 9 + COL 1 + SIM 1 + GEN 5 + ING 1 + TSQ 9 + RLT 9 + ALM 9 + WRK 5 + OBS 6 = **62** · 범위 행이 담는 기능 = COL 9 + SIM 5 + GEN 6 + GEN 3 + ING 13 = **36** · 기능 = 62 − 범위 행 5 + 36 = **93**
- **GEN-11 · GEN-12는 같은 표면 4를 나눠 쓴다.** 실행 표면은 본문의 type(perf · flow)으로 종류를 가르므로 표면이 기능마다 따로 있지 않다 — 두 화면이 상대 종류의 실행을 current · 단건 조회로 보는 것(시작 비활성 · "다른 실행 진행 중" 링크)은 상대 기능의 보조 매핑이 아니라 동시 실행 1 규칙의 표시다([08_evidence_screens.md](./08_evidence_screens.md) §실행 패널 — 두 화면 공통 규칙).
- **GEN-07이 화면 없음인 것은 누락이 아니다.** 부하 주입 표면의 호출 주체는 k6 · datagen 컨테이너이고, 켜는 권한은 머신 접근이다(권한 매트릭스 §GEN · OBS 표면 인가). 화면에서 부르게 하면 부하 도구가 아닌 브라우저가 측정 부하에 섞인다.
- **폐지 화면의 기능이 화면 없음(API 전용)이 된 것은 누락이 아니다(D-14 결정 1).** 표면은 그대로 살아 있고 호출 주체가 curl · 통합 테스트 · 흐름 시연 실행으로 바뀌었을 뿐이다 — 흐름 시연이 업무 명령 경로를 쓰고 측정 기록이 이 표면들을 인용하므로 표면을 지우면 EXP-FLOW가 보여 줄 업무 길과 기록의 근거가 함께 사라진다.
- **OBS 6이 EXP-FLOW로 모인 이유** — EXP-FLOW가 GET /metrics를 5초마다 부르고(숫자 4 · 흐름도 DB 노드 — 측정 → 저장까지 포함) 각주의 꺼진 길 · 스위치 상태를 health로 보인다. EXP-PERF는 각주 툴팁에서 health를 읽기만 하고 원천 기록의 4요소가 주 근거라 보조로 둔다.
- **RLT 중 둘만 화면이다.** WS /ws/realtime 한 표면이 여러 메시지 type을 싣는다 — EXP-FLOW가 쓰는 것은 subscribe_flow 구독(RLT-05) · 연결 관리와 재연결 뒤 재구독(RLT-07)이다. rt 프레임 병합(RLT-06) · 알람 푸시(RLT-08) · 무효화 신호 중계(RLT-09)는 받는 화면이 없어 화면 없음(API 전용)이다 — 셸은 연결을 하나 열지만 cacheinv를 받지 않는다(공통 셸 요소 표에 신호 수신 행이 없다 · [01_standards.md](./01_standards.md)). "받고 버린다"를 매핑하면 화면이 기능을 쓴다고 세게 된다.
- **AUT 중 로그인 · 로그아웃은 화면 없음(API 전용)이다.** 로그인 화면은 폐지됐고(AUTH-LOGIN · D-14) 현행 셸에 사용자 메뉴가 없어 로그아웃을 부르는 자리가 없다(리드 판정 2026-10-03 — S7 인증 진입 자리와 함께 S7 착수 때 정한다). 토큰 갱신(AUT-02)은 셸 인증 가드가 BFF에서 부르므로 공통 셸에 남는다.

## 파생 집계

### 분류별

| 분류 | 기능 수 | 내역 |
|------|------|------|
| 화면 | **15** | AUT 5(02 · 04~07) · GEN 2(11 · 12) · RLT 2(05 · 07) · OBS 6 |
| 내부 모듈 | **27** | COL 9 · SIM 5 · ING 13 |
| 표면 없음 | **21** | MST 3(07 · 08 · 09) · GEN 9(01~06 · 08~10) · TSQ 3(03 · 04 · 05) · ALM 5(02~06) · WRK 1(04) |
| 화면 없음(API 전용) | **30** | AUT 2(01 · 03) · MST 6(01~06) · GEN 1(07) · TSQ 6(01 · 02 · 06 · 07 · 08 · 09) · RLT 7(01~04 · 06 · 08 · 09) · ALM 4(01 · 07 · 08 · 09) · WRK 4(01 · 02 · 03 · 05) |

- 검산: 화면 5 + 2 + 2 + 6 = **15** · 내부 모듈 9 + 5 + 13 = **27** · 표면 없음 3 + 9 + 3 + 5 + 1 = **21** · 화면 없음(API 전용) 2 + 6 + 1 + 6 + 7 + 4 + 4 = **30** · 15 + 27 + 21 + 30 = **93** — 누락 0
- **권한 매트릭스와의 교차 검산**([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §검산) — 표면 있는 기능 = 화면 15 + 화면 없음(API 전용) 30 = 45 = 역할 판정 33 + 공개 7 + 횡단 4 + 게이트 1 = **45** · 내부 모듈 27 + 표면 없음 21 = 내부 **48**. 화면 15 = 역할 판정 5(AUT-02 · GEN-11 · 12 · RLT-05 · 07) + 공개 6(OBS-01~06) + 횡단 4(AUT-04~07) = **15** · 화면 없음(API 전용) 30 = 역할 판정 28 + 공개 1(AUT-01) + 게이트 1(GEN-07) = **30** · 역할 판정 5 + 28 = 33 · 공개 6 + 1 = 7. **두 등식이 성립한다** — 인가 밖 기능(내부)은 하나도 화면이 없고, 표면 있는 기능은 화면이 있거나 화면 없음(API 전용)으로 닫힌다. D-14 전의 "인가 대상 기능은 전부 화면이 있다"는 더 성립하지 않는다 — 역할 판정 기능 28(폐지 화면이 부르던 26 + 현행 셸이 부르지 않는 AUT-03 · RLT-09)은 표면만 남았다.

### 주 화면별

| 주 화면 | 기능 수 | 기능 |
|------|------|------|
| EXP-PERF | 1 | GEN-11(실행 패널) — 그림 1 · 그림 2 · 왜? 카드 · 상황 카드는 측정 기록 읽기(기능 없음) · 보조 2(OBS-05 · 06 — 각주 툴팁) |
| EXP-FLOW | 9 | GEN-12(실행 패널) · RLT-05 · 07 · OBS-01~06 — 흐름 이벤트는 기능 ID 없음 |
| 공통 셸 | 5 | AUT-02 · 04~07 |
| 폐지 화면 10(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE) | 0 | 해당 없음 — 결번(D-14) |

- 검산: 1 + 9 + 5 + 0 = **15** = 분류 "화면" · 현행 화면 코드 행 = **2** — 인벤토리 현행 2와 같다 · 폐지 화면은 10을 한 행으로 묶고 주 기능 0으로 센다
- **유령 0 · 고아 0** — 주 화면 열의 화면 코드는 전부 인벤토리 현행 화면이고(유령 0 — 폐지 화면 코드는 주 화면 · 보조 화면 열에 없다), 현행 2가 전부 주 기능을 1개 이상 갖는다(고아 0). 폐지 화면의 주 기능 0은 고아가 아니다 — 결번이라 인벤토리 현행 밖이다. 현행 화면에 주 기능 0이 생기면 그것은 고아다 — 예외 분류를 두지 않는다.
- **D-14 재분류(2026-10-03 · 리드 판정 웨이브 1 정합 반영)** — 폐지 10이 주 화면이던 기능 3 + 8 + 5 + 3 + 2 + 6 + 3 + 1 + 5 + 1 = **37**(AUTH-LOGIN · DSH-REALTIME · ANL-TREND · ALM-CONSOLE · ALM-RULES · ADM-MASTER · ADM-WORKORDER · ADM-AUDIT · EXP-CONSOLE · EXP-COMPARE 순) 중 현행 자리의 요소가 표면을 부르는 9(EXP-FLOW 8 — RLT-05 · 07 · OBS-01~06 · 공통 셸 1 — AUT-02)는 올리고 나머지 28(AUT-03 포함 — 셸에 사용자 메뉴가 없다)은 화면 없음(API 전용)으로 내렸다 — 9 + 28 = **37**. D-14 전 공통 셸 주였던 RLT-09도 셸 요소에서 신호 수신이 빠져 화면 없음(API 전용)이다 · 화면 44 − 37 + 9 − 1 = **15** · 화면 없음(API 전용) 기존 1(GEN-07) + 28 + 1 = **30**.
- **두 실증 화면의 분류 재판정(리드 판정 2026-09-28)** — EXP-PERF · EXP-FLOW는 2026-09-28 앞선 판정에서 "주 기능 없는 실증 화면(OBS 보조)"이었다. 실행 패널(GEN-11 · GEN-12)의 주 화면이 각 화면이 되면서 두 화면은 **주 기능 있는 화면**으로 바뀌고 그 분류는 비었다. EXP-PERF의 기록 곡선 · 표는 원천이 api 표면이 아닌 BFF 기록 읽기라 기능이 붙지 않고, EXP-FLOW의 흐름 이벤트(ch:flow 발행 · flow 중계)는 관찰 보조 채널이라 기능으로 세지 않는다.

### 도메인별

| 도메인 | 기능 | 화면 | 내부 모듈 | 표면 없음 | API 전용 | 주 화면 |
|------|------|------|------|------|------|------|
| AUT | 7 | 5 | 0 | 0 | 2 | 공통 셸 5 |
| MST | 9 | 0 | 0 | 3 | 6 | 해당 없음 |
| COL | 9 | 0 | 9 | 0 | 0 | 해당 없음 |
| SIM | 5 | 0 | 5 | 0 | 0 | 해당 없음 |
| GEN | 12 | 2 | 0 | 9 | 1 | EXP-PERF 1 · EXP-FLOW 1 |
| ING | 13 | 0 | 13 | 0 | 0 | 해당 없음 |
| TSQ | 9 | 0 | 0 | 3 | 6 | 해당 없음 |
| RLT | 9 | 2 | 0 | 0 | 7 | EXP-FLOW 2 |
| ALM | 9 | 0 | 0 | 5 | 4 | 해당 없음 |
| WRK | 5 | 0 | 0 | 1 | 4 | 해당 없음 |
| OBS | 6 | 6 | 0 | 0 | 0 | EXP-FLOW 6 |

- 검산: 기능 7 + 9 + 9 + 5 + 12 + 13 + 9 + 9 + 9 + 5 + 6 = **93** · 화면 열 합 5 + 2 + 2 + 6 = **15** · API 전용 열 합 2 + 6 + 1 + 6 + 7 + 4 + 4 = **30** · 행마다 화면 + 내부 모듈 + 표면 없음 + API 전용 = 기능
- **화면 공백 도메인은 일곱이다 — COL · SIM · ING(내부 모듈) · MST · TSQ · ALM · WRK(D-14 — 폐지 화면이 부르던 표면만 남았다).** 앞의 셋은 07_api 표면 없음 3과 같은 도메인이다. 뒤의 넷은 표면이 그대로 있어(D-14 결정 1) 화면 없음(API 전용)이고, 산출은 EXP-FLOW 흐름도의 업무 길 · 알람 갈래로만 보인다. GEN은 라이브 실행 기능 2(GEN-11 · 12)가 EXP-PERF · EXP-FLOW를 주 화면으로 갖는다([../07_api/09_datagen.md](../07_api/09_datagen.md) 실행 표면 #2~#5) — 부하 주입 표면(GEN-07)은 호출 주체가 기계라 화면이 없고, 생성기 모드 A~D(GEN-01~06 · 08~10)는 실행 인자라 산출이 EXP-FLOW 발생원 · EXP-PERF 기록 곡선으로만 보인다. OBS는 EXP-FLOW 귀속이다.

## 화면 → 표면 인용

현행 화면이 인용한 표면을 07_api 문서별로 모은다. 표면 번호({문서} #N)는 쓰지 않고 메서드 + 경로로 적는다 — 번호 대응은 W7 추적성이 맞춘다. 폐지 화면만 부르던 표면은 행을 지우지 않고 수 0과 화면 없음(API 전용)으로 적는다.

| 07_api 문서 | 화면이 인용한 표면 | 수 | 호출 화면 |
|------|------|------|------|
| [../07_api/01_conventions.md](../07_api/01_conventions.md) | 해당 없음 — GET /api/v1/commands/{cmdId}는 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ADM-MASTER · ALM-RULES · ALM-CONSOLE · ADM-WORKORDER(D-14) |
| [../07_api/03_auth.md](../07_api/03_auth.md) | POST /api/v1/auth/refresh — POST /api/v1/auth/login · POST /api/v1/auth/logout은 화면 없음(API 전용) | 1 | 공통 셸(인증 가드 — BFF 갱신) — 로그인은 폐지 화면 AUTH-LOGIN(D-14) · 로그아웃은 현행 셸에 사용자 메뉴 없음 |
| [../07_api/04_master.md](../07_api/04_master.md) | 해당 없음 — 17 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ADM-MASTER(D-14) |
| [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 해당 없음 — 2 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ANL-TREND · DSH-REALTIME(D-14) |
| [../07_api/06_realtime.md](../07_api/06_realtime.md) | 해당 없음 — 2 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 DSH-REALTIME(D-14) |
| [../07_api/07_alarms.md](../07_api/07_alarms.md) | 해당 없음 — 6 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ALM-CONSOLE · ALM-RULES(D-14) |
| [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 해당 없음 — 9 전부 화면 없음(API 전용) | 0 | 화면 없음(API 전용) — 폐지 화면 ADM-WORKORDER · ADM-AUDIT(D-14) |
| [../07_api/09_datagen.md](../07_api/09_datagen.md) | POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop(#2~#5 · BFF 경유 no-store) — POST /api/v1/ingest/bulk(#1)는 화면 없음(API 전용) | 4 | EXP-PERF · EXP-FLOW |
| [../07_api/10_metrics.md](../07_api/10_metrics.md) | GET /api/v1/health · GET /metrics(화면은 BFF 경유) | 2 | EXP-FLOW · EXP-PERF(health만 — 각주 툴팁) |
| [../07_api/11_websocket.md](../07_api/11_websocket.md) | WS /ws/realtime | 1 | EXP-FLOW(subscribe_flow · flow) · 공통 셸(연결만 — cacheinv 중계 RLT-09는 받지 않는다) |

- 검산: 인용 표면 = 0 + 1 + 0 + 0 + 0 + 0 + 0 + 4 + 2 + 1 = **8** · 화면이 인용하지 않은 표면 = 명령 조회 1 + 로그인 1 + 로그아웃 1 + 마스터 17 + 시계열 2 + 최신값 2 + 알람 6 + 작업지시 · 감사 9 + 부하 주입 1 = **40** · 8 + 40 = 48 = [../07_api/README.md](../07_api/README.md) 표면 총수와 같다
- **EXP-PERF 기록 곡선의 원천은 이 표에 없다** — api 표면이 아니라 BFF가 docs/measurements를 읽기 전용으로 읽는다. EXP-PERF의 실행 패널은 09_datagen 행에 있다([08_evidence_screens.md](./08_evidence_screens.md)). EXP-FLOW의 flow 프레임은 새 표면이 아니라 WS /ws/realtime 한 표면의 메시지 type이다 — 표면이 늘지 않으므로 인용 수도 늘지 않는다.
- **화면이 부르지 않는 표면은 40이다 — 부하 주입 1(호출 주체가 기계) · 폐지 화면이 부르던 38(D-14) · 현행 셸에 부르는 자리가 없는 로그아웃 1(리드 판정 2026-10-03).** 무효화 신호 중계(RLT-09)는 WS /ws/realtime 한 표면의 메시지 type이라 표면 수가 아니라 이 문서 매핑 표에서 화면 없음(API 전용)으로 닫는다. 화면 없는 표면이 늘거나 줄면 그 표면의 호출 주체를 이 표에 적는다.
- 07_api README의 표면 총수와 이 표의 합이 다르면 차이는 화면 없는 표면이다 — 표면 총수의 정본은 [../07_api/README.md](../07_api/README.md)이고 이 표는 그것을 세지 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| README 도메인 공백 행의 GEN · OBS 잠정 귀속 | 닫힘 — README 도메인 공백 행 반영 · **D-14로 다시 바뀜**(OBS는 EXP-FLOW 귀속 · 공백 도메인 7) | [README.md](./README.md) |
| 주 기능 없는 화면 2(EXP-PERF · EXP-FLOW) · 흐름 이벤트 기능 ID | **닫힘(리드 판정 1 · 2026-09-28)** — 새 기능 ID 없음 · 주 기능 없는 실증 화면(OBS 보조) 분류 인정 · **같은 날 재판정으로 대체**(아래 분류 재판정 행 — GEN-11 · 12 신설로 분류 2 → 0) | 이 문서 |
| 명령 조회 표면(GET /api/v1/commands/{cmdId}) | **닫힘(2026-09-28)** — 07_api/01 확정(횡단 표면 #1 · 기능 MST-01~06 · ALM-01 · ALM-08 · WRK-01~03) · 해당 기능 행의 호출 표면 열에 반영 · **D-14 뒤 화면 없음(API 전용)** — 부르던 화면 4가 폐지됐다 | 이 문서 |
| 두 실증 화면의 분류 재판정(GEN-11 · GEN-12 신설) | **닫힘(리드 판정 2026-09-28)** — 실행 패널의 주 화면 = 각 화면 · 주 기능 없는 실증 화면 분류 2 → 0 | 이 문서 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 폐지 화면 10의 기능 재분류(D-14) | **닫힘(2026-10-03)** — 현행 자리로 올림 10 · 화면 없음(API 전용)으로 내림 27 · **같은 날 리드 판정(웨이브 1 정합)으로 올림 9 · 내림 28 + RLT-09**(AUT-03 · RLT-09 → 화면 없음(API 전용)) · 표면 없는 기능은 기존 어휘 그대로 · 새 기능 ID · 새 어휘 없음 | 이 문서 · [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |
| 기능 ↔ REQ ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전 축 정합 | 닫힘 — 전 축 매핑 완성(미매핑 0 · 유령 0) — [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) | [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [01_standards.md](./01_standards.md) — 명세 템플릿 · 공통 셸 요소 표
- [08_evidence_screens.md](./08_evidence_screens.md) — EXP-PERF · EXP-FLOW 요소 표 · 실행 패널
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-14 2화면 전환
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 기능 · 교차 검산 상대
- [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) — 전 축 추적성
- [../07_api/README.md](../07_api/README.md) — 표면 목차 · 표면 총수
