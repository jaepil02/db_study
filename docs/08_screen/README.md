# 08_screen — 화면 명세

> **대상**: db_study 웹(Next.js)의 화면 — 명세 표준 · 기능 추적성 · **현행 화면 2**(성능 비교 /performance · 분산 처리 모니터링 /monitoring — 실증 화면) · 폐지 화면 10의 원문 보존(실시간 대시보드 · 트렌드 분석 · 알람 콘솔 · 관리 화면 · 실험 콘솔)
> **작성일**: 2026-09-23
> **개정일**: 2026-10-03 — UI/UX 다듬기(사용자 지시 2026-10-03) — 08_evidence_screens 행의 요소 이름을 현행 화면에 맞춤(왜? 카드 2 → 왜? 두 줄 · 상황 카드 4 → 업무 네 줄 · 왜 나눌까 카드 3 → 세 칸) — 요소 수 · 문서 수 불변
> **개정일**: 2026-10-03 — **D-15 학습자 눈높이 한 장** — 파일 목차 08 설명 · 인벤토리 EXP-PERF · EXP-FLOW 화면 설명 · 도입 단락 · "측정 조건 서랍" → 각주 툴팁 — 화면 · 기능 수 불변
> **개정일**: 2026-10-03 — D-14 검수 반영 — 인벤토리 주 도메인 칸(EXP-PERF OBS 보조 = 측정 조건 서랍 · EXP-FLOW RLT · OBS 주 — 02_traceability와 일치) · 고정 기준 차트 행(현행 ECharts · 흐름도 SVG) · 관련 문서 두 줄의 실험 콘솔 표현 — 화면 · 기능 수 불변
> **개정일**: 2026-10-03 — **D-14 2화면 전환**(사용자 결정 2026-10-03) — 화면 인벤토리에 상태 열(현행 · 폐지) · 현행 12 → **2**(EXP-PERF /performance · EXP-FLOW /monitoring) + 폐지 **10**(코드 결번 보존 · 재사용 금지) · 파일 목차 03~07 폐지 표기 · 08 설명 재작성 · 도입 단락의 실험 콘솔 문단 → 2화면 문단 · 고정 기준 화면 코드 · 기능 → 화면(화면 있음 44 → **15** · 화면 없음(API 전용) 1 → **30**) · 도메인 공백(주 화면 없음 7) · 경로 분리 · 실험 콘솔 접근 → 화면 접근 행 개정 — 파일 수 불변(폐지 문서는 지우지 않는다)
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 지침 .omc/run-control-brief.md) — 두 실증 화면에 실행 패널(GEN-11 · GEN-12) · 인벤토리 주 도메인 칸 "OBS 보조 — 주 기능 없는 실증 화면" → **GEN(실행 패널) · OBS 보조** · 기능 → 화면 91 → **93**(화면 있음 42 → **44** · 주 기능 없는 실증 화면 2 → **0**) · 도메인 공백 GEN 빠짐 · 경로 분리 줄에 실행 표면 BFF 경유 · 실험 콘솔 접근 줄 "표시 전용(EXP-PERF · EXP-FLOW 포함)" → 두 실행 패널 예외 — 화면 12 · 파일 수 불변
> **개정일**: 2026-09-28 — 웨이브 1 검수 판정 반영(f-screens · r-screens L7) — 08_evidence_screens 파일 목차 설명 "업무 이벤트" → **업무 명령**(본문 용어) — 파일 수 불변
> **개정일**: 2026-09-28 — 리드 판정 1 — 두 새 화면을 주 기능 없는 실증 화면(OBS 보조)으로 확정 · 인벤토리 주 도메인 칸 · 기능 → 화면 줄 · EXP-FLOW 업무 길을 명령 경로로(08_evidence_screens)
> **개정일**: 2026-09-27 — 새 화면 2(리드 채번 — EXP-PERF 규모별 성능 비교 · EXP-FLOW 분산 처리 모니터링) — 화면 10 → **12**(EXP 2 → 4 · 표면 접두 6 불변) · 명세 파일 08_evidence_screens.md 신설 · 경로 분리 줄에 EXP-PERF BFF 기록 읽기 · EXP-FLOW flow 프레임 · 기능 → 화면 91 불변(두 화면 주 기능 0 — 판정 대기 02_traceability)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — EXP-CONSOLE 주 도메인 OBS · GEN → OBS(GEN은 간접 표시 — 02_traceability와 일치)
> **개정일**: 2026-09-24 — W5 완성판 — 화면 10 확정(추가 0) · 기능 → 화면 91 누락 0 · GEN 화면 없음 · 대조군 역전 지점은 BFF 파일 읽기
> **원천**: [../README.md](../README.md) · [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) · 원본 tech_stack.md §4 · 원본 data_flow.md §6.3 · §7.2 · §9.1 · 원본 implementation_plan.md §4 · §5 S2(커밋 ff66a37)

"사람이 무엇을 보는가"에 답하는 폴더다. **화면 코드 {표면}-{의미}를 채번**하며 채번 자리는 이 README의 화면 인벤토리다. 화면은 데이터를 소유하지 않는다 — 모든 수치는 07_api 표면을 거쳐 오고, 화면 명세는 어느 표면을 어떤 빈도로 부르는지와 상태 4행(로딩 · 빈 값 · 오류 · 정상)을 고정한다.

**웹 화면은 둘이다(D-14).** 성능 비교(EXP-PERF · /performance)는 같은 데이터를 PostgreSQL과 ClickHouse에 넣었을 때 몇 행부터 누가 빠르고 왜 그런지 — 업무 데이터는 왜 반대로 PostgreSQL인지까지 — 를 답하고, 분산 처리 모니터링(EXP-FLOW · /monitoring)은 지금 어떤 데이터가 Redis를 거쳐 어느 저장소로 초당 얼마나 가는지를 답한다. 두 명세의 정본은 [08_evidence_screens.md](./08_evidence_screens.md)다. **폐지 화면 10은 문서를 지우지 않는다** — 03~07은 상태 단락을 달고 폐지 전 설계 원문을 보존하며, 화면 코드는 결번으로 남겨 재사용하지 않는다. 스위치는 여전히 화면에서 켜고 끄지 않는다 — 상태만 두 화면의 각주 툴팁에 보인다. **두 화면은 1년차 학습자가 스크롤 · 접기 없이 한 눈에 읽는 한 장이다(D-15)** — 원칙은 [01_standards.md](./01_standards.md) §한 화면 원칙.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_standards.md](./01_standards.md) | 명세 템플릿 · 상태 4행 · 차트 표준(uPlot 주력 · ECharts 보조) · 갱신 주기와 캐시 정렬(TanStack Query ↔ Redis TTL) | tech_stack §4.2 · §4.3 · data_flow §6.3 | W5 |
| [02_traceability.md](./02_traceability.md) | 기능 → 화면 매핑 · 파생 집계 | 신설 | W5 |
| [03_realtime_dashboard.md](./03_realtime_dashboard.md) | **폐지(D-14)** — 설비별 최신값 · 실시간 트렌드 · STALE 표시 · WebSocket 재연결 표시 | data_flow §5 · §9 · implementation_plan §5 S2 | W5 |
| [04_trend_analysis.md](./04_trend_analysis.md) | **폐지(D-14)** — 시간 범위 조회 · 해상도 표시(meta.interval) · 다운샘플 표시 · 내보내기 | data_flow §6 · §14.1 | W5 |
| [05_alarm_console.md](./05_alarm_console.md) | **폐지(D-14)** — 활성 알람 · 확인 · 이력 · 규칙 관리 · min/max 쌍 분석 차트 | data_flow §8 · §6.3 | W5 |
| [06_master_admin.md](./06_master_admin.md) | **폐지(D-14)** — **관리 화면군** — 로그인 · 사이트 · 라인 · 설비 · 태그 마스터 · 작업지시 · 생산 실적 | architecture §11 · data_flow §7 | W5 |
| [07_experiment_console.md](./07_experiment_console.md) | **폐지(D-14)** — 스위치 상태 표시 · 실험 실행 기록 · on/off 비교 대시보드 · 전환 절차 안내 | implementation_plan §4 · §8 | W5 |
| [08_evidence_screens.md](./08_evidence_screens.md) | ★ **현행 화면 2 — 학습자 눈높이 한 장(D-15)** — 성능 비교(/performance — 센서 데이터 구역(질문별 승패 막대 · 규모 곡선 · 왜? 두 줄) · 업무 데이터 구역(업무 네 줄) · 한 줄 정리 · 각주) · 분산 처리 모니터링(/monitoring — 숫자 4 · 쉬운 이름 흐름도 · 왜 나눌까 세 칸 · 모아서 대 하나씩 · 각주) · 두 화면의 머리 버튼 · 진행 띠 한 줄 | 신설(사용자 요구 2026-09-27) · 재작성(D-14) | 실증 화면 |

검산: 표준 · 추적성 2 + 화면 문서 6 + README 1 = **9**

## 화면 인벤토리

W5 착수 전 리드가 화면 코드를 선점한다. 07_api를 쓰는 팀원이 표면 설명에 화면 코드를 동시에 인용하기 때문이다. **이 표가 화면 코드의 채번 자리**이며, 새 화면은 표 말미에 추가하고 코드를 재사용하지 않는다. 표면 접두는 6이다 — AUTH(인증) · DSH(실시간) · ANL(분석) · ALM(알람) · ADM(관리) · EXP(실험). **상태 열이 현행 화면의 정본이다(D-14)** — 폐지 행은 결번으로 남기고 지우지 않는다.

| 화면 코드 | 상태 | 화면 | 웹 경로 | 소속 파일 | 주 페르소나 | 주 도메인 |
|-----------|------|------|---------|----------|------------|----------|
| AUTH-LOGIN | 폐지(D-14) | 로그인 | 해당 없음 | [06_master_admin.md](./06_master_admin.md) | 전원 | AUT |
| DSH-REALTIME | 폐지(D-14) | 설비 실시간 대시보드(최신값 표 · 실시간 트렌드 · STALE · 연결 상태) | 해당 없음 | [03_realtime_dashboard.md](./03_realtime_dashboard.md) | 현장 운영자 | RLT · TSQ |
| ANL-TREND | 폐지(D-14) | 트렌드 분석(범위 조회 · 해상도 · 다운샘플 표시 · 내보내기) | 해당 없음 | [04_trend_analysis.md](./04_trend_analysis.md) | 엔지니어 | TSQ |
| ALM-CONSOLE | 폐지(D-14) | 알람 콘솔(활성 · 확인 · 이력) | 해당 없음 | [05_alarm_console.md](./05_alarm_console.md) | 현장 운영자 | ALM |
| ALM-RULES | 폐지(D-14) | 알람 규칙 관리 · 판정 분석 | 해당 없음 | [05_alarm_console.md](./05_alarm_console.md) | 엔지니어 | ALM |
| ADM-MASTER | 폐지(D-14) | 마스터 관리(사이트 · 라인 · 설비 · Modbus 설정 · 태그) | 해당 없음 | [06_master_admin.md](./06_master_admin.md) | 관리자 | MST |
| ADM-WORKORDER | 폐지(D-14) | 작업지시 · 생산 실적 | 해당 없음 | [06_master_admin.md](./06_master_admin.md) | 관리자 | WRK |
| ADM-AUDIT | 폐지(D-14) | 감사 로그 조회 | 해당 없음 | [06_master_admin.md](./06_master_admin.md) | 관리자 | WRK |
| EXP-CONSOLE | 폐지(D-14) | 실험 콘솔(스위치 상태 표시 · 생성기 · 메트릭 요약 · 전환 절차 안내) | 해당 없음 | [07_experiment_console.md](./07_experiment_console.md) | 실험 수행자 | OBS |
| EXP-COMPARE | 폐지(D-14) | 실험 비교(on/off · 구현값 비교 · 대조군 역전 지점) — 역전 지점 · 실증 요약은 EXP-PERF로 이관 | 해당 없음 | [07_experiment_console.md](./07_experiment_console.md) | 실험 수행자 | OBS |
| EXP-PERF | **현행** | 성능 비교(한 장 — 센서 데이터는 ClickHouse · 업무 데이터는 PostgreSQL이 왜 맞는지 좌우로 대비) | /performance | [08_evidence_screens.md](./08_evidence_screens.md) | 실험 수행자 · 시연 청중 | GEN(실행 조작부 — GEN-11) · OBS 보조(각주 툴팁 — OBS-05 · 06) |
| EXP-FLOW | **현행** | 분산 처리 모니터링(한 장 — 센서 · 업무 데이터가 Redis 대기줄을 거쳐 DB 3으로 나뉘는 흐름 실시간) | /monitoring | [08_evidence_screens.md](./08_evidence_screens.md) | 실험 수행자 · 시연 청중 | GEN(실행 조작부 — GEN-12) · RLT(흐름 구독 — RLT-05 · 07) · OBS(메트릭 · health · 스위치 — OBS-01~06) |

검산: 채번 **12** — AUTH 1 + DSH 1 + ANL 1 + ALM 2 + ADM 3 + EXP 4 = **12** · 상태 — 현행 2(EXP-PERF · EXP-FLOW) + 폐지 10 = **12**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 화면 코드 | **12** 채번 — 표면 접두 6(AUTH 1 · DSH 1 · ANL 1 · ALM 2 · ADM 3 · EXP 4) · 상태 현행 **2**(EXP-PERF · EXP-FLOW) + 폐지 10(D-14). 채번 · 상태 자리는 §화면 인벤토리 · 현행 화면을 세는 기준은 08_evidence_screens.md의 화면 명세 H2 블록 수 |
| 기능 → 화면 | 화면 있음 15 + 내부 모듈 27 + 표면 없음 21 + 화면 없음(API 전용) 30 = **93** · 누락 0 · 고아 0(정본 [02_traceability.md](./02_traceability.md)) · 주 화면 EXP-PERF 1(GEN-11) · EXP-FLOW 9(GEN-12 · RLT-05 · 07 · OBS-01~06) · 공통 셸 5(AUT-02 · 04~07) · 폐지 10은 주 기능 0 |
| 도메인 공백 | **주 화면이 없는 도메인 7** — COL · SIM · ING은 내부 모듈이라 전용 화면이 없고 산출은 EXP-FLOW 흐름도의 DB 노드 숫자에만 보인다. **MST · TSQ · ALM · WRK는 주 화면이 폐지됐다(D-14)** — 표면은 남고(화면 없음(API 전용)) 업무 명령 · 알람 전이 · 판정 행은 EXP-FLOW 흐름에 나타난다. GEN은 라이브 실행 기능(GEN-11 · 12)만 화면을 갖는다(두 화면의 실행 조작부). OBS는 EXP-FLOW가 주 화면이다(메트릭 · health · 스위치 — EXP-PERF는 각주 툴팁 보조). AUT는 공통 셸만 남는다(로그인 화면 폐지 — S7 인증 진입 자리는 S7 착수 때 정한다) |
| 경로 분리 | 저빈도 조회는 BFF 경유, WebSocket은 api 직결 — 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) · 화면이 부르는 health · /metrics는 BFF 경유 · EXP-PERF의 기록 곡선 · 표 · 업무 데이터 탭은 BFF가 docs/measurements를 읽기 전용으로 읽는다(api 표면 없음) · EXP-FLOW는 셸 WebSocket 연결의 flow 프레임(subscribe_flow)과 BFF 경유 메트릭 5초 폴링 · 두 화면의 실행 조작부는 BFF 경유 실행 표면(07_api/09_datagen #2~#5 · no-store · 진행 중 1초 폴링) |
| 화면 접근 | 인증 사용자 전원이 본다 · 기록 판독 · 흐름 관찰은 **표시 전용** · **실행 조작부의 시작 · 중단만 S7 뒤 ENGINEER · ADMIN**(라이브 실행 두 종류 · 동시 1 — 장애 주입 버튼은 없다) — 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 차트 | 채택 uPlot · ECharts — **현행 두 화면은 ECharts와 흐름도 SVG만 쓴다**(uPlot을 쓰던 화면은 폐지 · 정본 [01_standards.md](./01_standards.md) §차트 표준). 서버 다운샘플이 1차 방어선이고 차트는 2차 방어선이다 |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../07_api/README.md](../07_api/README.md) — 화면이 부르는 표면
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 두 화면의 각주 툴팁이 표시하는 스위치
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 두 화면이 판독 · 실행하는 실험
