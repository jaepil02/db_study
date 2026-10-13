# 08_screen — 화면 명세

> **대상**: db_study 웹(Next.js)의 화면 — 명세 표준 · 기능 추적성 · **현행 화면 7**(메뉴 순서 = 발표 순서 — 개념 ① 세 DB 한눈에 · ② PG vs CH 장단점 / 비교 ③ 시계열: PG에 vs CH에 · ④ PG 하나로 vs 나눠서 / 직접 해 보기 ⑤ 직접 비교 실험 · ⑥ 분산 처리 모니터링 / 현장 적용 ⑦ HMI 설비 현황판) · 폐지 화면 11의 코드 결번(문서는 D-16 삭제 — 원문 커밋 28c0cc9)
> **작성일**: 2026-09-23
> **개정일**: 2026-10-11 — **D-16 웹 7화면**(사용자 결정 2026-10-11 · as-built 코드 apps/web/app · lib/nav.ts) — **표면 접두 6 → 8**(LRN 학습 · HMI 현장 화면 신설) · **화면 코드 신설 6**(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE · EXP-LAB · HMI-PLANT — 인벤토리 말미) · 채번 12 → **18** · 현행 1 → **7** · 폐지 11 그대로 · **명세 문서 신설 3**(09_learn_screens · 10_lab_screen · 11_hmi_screen) · 문서 수 4 → **7** · 도입 단락 7화면 문단 · 고정 기준 화면 코드 · 기능 → 화면(정본 02_traceability 재집계) · 도메인 공백 · 경로 분리(공용 컨트롤 · HMI 개요 BFF 경유 · 시계열 직결) · 화면 접근 · 차트 행(ECharts 2 사용처) · **반응형 행 신설**
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 알람 · 로그인 · 권한 · 감사 · 작업지시 삭제**(사용자 결정 2026-10-11 · 리드 판정 — 대상 문서 파일 삭제) — 폐지 화면 문서 03~07 **삭제**(파일 번호 결번 · 목차 행 삭제 · 인벤토리 소속 파일 → 삭제) · **EXP-PERF 현행 → 폐지(D-16)** — 현행 화면 2 → **1** · 폐지 10 → **11** · 기능 → 화면 93 → **63**(화면 있음 15 → **9** · 내부 모듈 27 → **26** · 표면 없음 21 → **10** · API 전용 30 → **18**) · 공통 셸 주 기능 5 → **0** · 도메인 공백 7 → **5** · 화면 접근 → 전원 무인증 · 차트 행 현행 화면은 ECharts 없음 · 문서 수 9 → **4**
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
> **원천**: D-16(사용자 결정 2026-10-11 — 웹 7화면 · 반응형 · HMI 최소 화면) · lib/nav.ts NAV_SECTIONS(메뉴 순서) · [../README.md](../README.md) · [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) · 원본 tech_stack.md §4 · 원본 data_flow.md §6.3 · §7.2 · §9.1 · 원본 implementation_plan.md §4 · §5 S2(커밋 ff66a37)

"사람이 무엇을 보는가"에 답하는 폴더다. **화면 코드 {표면}-{의미}를 채번**하며 채번 자리는 이 README의 화면 인벤토리다. 화면은 데이터를 소유하지 않는다 — 모든 수치는 07_api 표면을 거쳐 오고, 화면 명세는 어느 표면을 어떤 빈도로 부르는지와 상태 4행(로딩 · 빈 값 · 오류 · 정상)을 고정한다.

**웹 화면은 일곱이고 메뉴 순서가 곧 발표 순서다(D-16 — 사용자 결정 2026-10-11).** 개념 섹션 ①②는 세 DB의 역할과 PostgreSQL · ClickHouse의 강약을, 비교 섹션 ③④는 센서 데이터를 어디에 둘지를 측정 기록으로 보이고([09_learn_screens.md](./09_learn_screens.md)), 직접 해 보기 섹션 ⑤⑥은 지금 시스템에서 다시 재고 흐름을 보이며([10_lab_screen.md](./10_lab_screen.md) · [08_evidence_screens.md](./08_evidence_screens.md)), 현장 적용 섹션 ⑦은 회사 카드 생산 라인에 붙인 최소 HMI다([11_hmi_screen.md](./11_hmi_screen.md) · 도입 설계 [../04_architecture/10_plant_adoption.md](../04_architecture/10_plant_adoption.md)). 옛 성능 비교(EXP-PERF · /performance)는 옛 perf 직접 재 보기와 함께 D-16으로 폐지됐고 /performance는 ②로 넘어간다. **폐지 화면 문서 03~07은 D-16으로 지웠다**(리드 판정 — 대상 문서 파일 삭제) — 화면 코드는 인벤토리에 결번으로 남겨 재사용하지 않고, 폐지 전 원문은 커밋 28c0cc9에 있다. 스위치는 여전히 화면에서 켜고 끄지 않는다 — 상태만 각주 툴팁에 보인다(설비 가동 스위치는 역할 스위치 SW-NN이 아니라 실행 중 운영 상태다). **화면은 1년차 학습자가 접기 없이 한 눈에 읽는 한 장이고(D-15), 1280 × 720 ~ 2560 × 1440에서 페이지 스크롤이 없다(D-16)** — 원칙은 [01_standards.md](./01_standards.md) §한 화면 원칙 · §반응형 규칙.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_standards.md](./01_standards.md) | 명세 템플릿 · 상태 4행 · 한 화면 원칙 · 반응형 규칙 · 공통 틀 · 글자와 화면 표면 · 요청 경로와 공통 셸(내비 섹션 4 · 화면 7) · 차트 표준(uPlot 주력 · ECharts 보조) · 갱신 주기와 캐시 정렬(TanStack Query ↔ Redis TTL) | tech_stack §4.2 · §4.3 · data_flow §6.3 | W5 · D-16 |
| [02_traceability.md](./02_traceability.md) | 기능 → 화면 매핑 · 파생 집계 | 신설 | W5 |
| [08_evidence_screens.md](./08_evidence_screens.md) | ★ ⑥ 분산 처리 모니터링(EXP-FLOW · /monitoring — 숫자 4 · 쉬운 이름 흐름도 · 왜 나눌까 세 칸 · 모아서 대 하나씩 · 각주 · 머리 공용 컨트롤) · **§실행 패널(⑤ · ⑥ 공유 실행 규칙의 정본)** · 옛 성능 비교(EXP-PERF)는 D-16 폐지 | 신설(사용자 요구 2026-09-27) · 재작성(D-14 · D-16) | 실증 화면 |
| [09_learn_screens.md](./09_learn_screens.md) | ①~④ 발표 화면 — 세 DB 한눈에(LRN-CONCEPTS · 정적) · PG vs CH 장단점(LRN-STRENGTHS · 줄다리기 8줄) · 시계열: PG에 vs CH에(LRN-TIMESERIES · 곡선 2 · 관리 비용) · PG 하나로 vs 나눠서(LRN-ARCHITECTURE · 점수판 4줄 · 계산값 표지) — 전부 측정 기록 판독 · api 표면 없음 | 신설(D-16) | D-16 |
| [10_lab_screen.md](./10_lab_screen.md) | ⑤ 직접 비교 실험(EXP-LAB · /lab — 넣기 · 조회 대결 · 무결성 패널 3 · 쌓인 비교 데이터) · **§공용 컨트롤**(설비 가동 스위치 · 데이터 지우기 — ⑤ ⑥ ⑦ 머리) | 신설(D-16) | D-16 |
| [11_hmi_screen.md](./11_hmi_screen.md) | ⑦ HMI 설비 현황판(HMI-PLANT · /hmi — 요약 줄 · 라인 3 × 공정 10 라인 판 · 고른 설비 태그 목록 · 최근 10분 작은 선 · 상태 4 판정 표시 · 알람 · 원격 조작 없음) | 신설(D-16) | D-16 |

검산: 표준 · 추적성 2 + 화면 문서 4(08 · 09 · 10 · 11) + README 1 = **7** · 파일 번호 03~07은 D-16으로 삭제한 결번이다(재사용 금지)

## 화면 인벤토리

W5 착수 전 리드가 화면 코드를 선점한다. 07_api를 쓰는 팀원이 표면 설명에 화면 코드를 동시에 인용하기 때문이다. **이 표가 화면 코드의 채번 자리**이며, 새 화면은 표 말미에 추가하고 코드를 재사용하지 않는다. 표면 접두는 8이다 — AUTH(인증) · DSH(실시간) · ANL(분석) · ALM(알람) · ADM(관리) · EXP(실험) · **LRN(학습 — 측정 기록을 판독하는 발표 화면)** · **HMI(현장 설비 화면)**(LRN · HMI는 D-16 신설). **상태 열이 현행 화면의 정본이다(D-14 · D-16)** — 폐지 행은 결번으로 남기고 지우지 않는다. 현행 행의 순서 열(①~⑦)은 메뉴 · 발표 순서다(웹 lib/nav.ts NAV_SECTIONS). 폐지 화면의 명세 문서는 D-16으로 지웠으므로 소속 파일 열은 "삭제"로 적는다.

| 화면 코드 | 상태 | 화면 | 웹 경로 | 소속 파일 | 주 페르소나 | 주 도메인 |
|-----------|------|------|---------|----------|------------|----------|
| AUTH-LOGIN | 폐지(D-14) | 로그인 | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 전원 | AUT |
| DSH-REALTIME | 폐지(D-14) | 설비 실시간 대시보드(최신값 표 · 실시간 트렌드 · STALE · 연결 상태) | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 현장 운영자 | RLT · TSQ |
| ANL-TREND | 폐지(D-14) | 트렌드 분석(범위 조회 · 해상도 · 다운샘플 표시 · 내보내기) | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 엔지니어 | TSQ |
| ALM-CONSOLE | 폐지(D-14) | 알람 콘솔(활성 · 확인 · 이력) | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 현장 운영자 | ALM |
| ALM-RULES | 폐지(D-14) | 알람 규칙 관리 · 판정 분석 | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 엔지니어 | ALM |
| ADM-MASTER | 폐지(D-14) | 마스터 관리(사이트 · 라인 · 설비 · Modbus 설정 · 태그) | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 관리자 | MST |
| ADM-WORKORDER | 폐지(D-14) | 작업지시 · 생산 실적 | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 관리자 | WRK |
| ADM-AUDIT | 폐지(D-14) | 감사 로그 조회 | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 관리자 | WRK |
| EXP-CONSOLE | 폐지(D-14) | 실험 콘솔(스위치 상태 표시 · 생성기 · 메트릭 요약 · 전환 절차 안내) | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 실험 수행자 | OBS |
| EXP-COMPARE | 폐지(D-14) | 실험 비교(on/off · 구현값 비교 · 대조군 역전 지점) — 역전 지점 · 실증 요약은 EXP-PERF로 이관 | 해당 없음 | 삭제(D-16 — 원문 커밋 28c0cc9) | 실험 수행자 | OBS |
| EXP-PERF | 폐지(D-16) | 성능 비교(센서 데이터는 ClickHouse · 업무 데이터는 PostgreSQL이 왜 맞는지 좌우로 대비) — 옛 perf 직접 재 보기 | 해당 없음 — /performance는 웨이브 2 전까지 /monitoring으로 넘긴다 | 삭제(D-16 — 08_evidence_screens §EXP-PERF · 원문 커밋 28c0cc9) | 실험 수행자 · 시연 청중 | GEN(옛 GEN-11 — D-16 폐지) |
| EXP-FLOW | **현행 ⑥** | 분산 처리 모니터링(한 장 — 센서 · 업무 데이터가 Redis 대기줄을 거쳐 DB로 나뉘는 흐름 실시간 · 직접 보내 보기) | /monitoring | [08_evidence_screens.md](./08_evidence_screens.md) | 실험 수행자 · 시연 청중 | GEN(실행 조작부 — GEN-12) · RLT(흐름 구독 — RLT-05 · 07) · OBS(메트릭 · health · 스위치 — OBS-01~06) |
| LRN-CONCEPTS | **현행 ①** | 세 DB 한눈에(역할 · 처리 방식 그림 · 정적) | /concepts(루트 / 가 이리로) | [09_learn_screens.md](./09_learn_screens.md) | 시연 청중 · 학습자 | 해당 없음 — 정적(api 표면 없음) |
| LRN-STRENGTHS | **현행 ②** | PG vs CH 장단점(줄다리기 막대 8줄 — 측정 기록) | /strengths(옛 /performance가 이리로) | [09_learn_screens.md](./09_learn_screens.md) | 시연 청중 · 학습자 | 해당 없음 — 기록 판독(api 표면 없음) |
| LRN-TIMESERIES | **현행 ③** | 시계열: PG에 vs CH에(10만 → 10억 행 곡선 · 관리 비용 — 측정 기록) | /timeseries | [09_learn_screens.md](./09_learn_screens.md) | 시연 청중 · 학습자 | 해당 없음 — 기록 판독(api 표면 없음) |
| LRN-ARCHITECTURE | **현행 ④** | PG 하나로 vs 나눠서(점수판 4줄 — 측정 기록 · 계산값 표지) | /architecture | [09_learn_screens.md](./09_learn_screens.md) | 시연 청중 · 학습자 | 해당 없음 — 기록 판독(api 표면 없음) |
| EXP-LAB | **현행 ⑤** | 직접 비교 실험(같은 센서 데이터를 Redis로 두 DB에 — 넣기 · 조회 대결 · 무결성 · 쌓인 비교 데이터 · 데이터 지우기) | /lab | [10_lab_screen.md](./10_lab_screen.md) | 시연 청중 · 실험 수행자 | GEN(직접 비교 실행 GEN-13 · 센서 데이터 현황 · 지우기 GEN-14) · RLT(설비 가동 RLT-10 — 지우기 버튼이 읽는다 · 보조) |
| HMI-PLANT | **현행 ⑦** | HMI 설비 현황판(카드 생산 라인 3 × 공정 10 = 30대 — 상태 4 · 데이터 종류 · 최근 10분 · 설비 가동 스위치 · 알람 · 원격 조작 없음) | /hmi | [11_hmi_screen.md](./11_hmi_screen.md) | 시연 청중 · 현장 운영자 | RLT(HMI 개요 RLT-11 · 설비 가동 RLT-10) · TSQ(최근 10분 — TSQ-01 · 06) |

검산: 채번 **18** — AUTH 1 + DSH 1 + ANL 1 + ALM 2 + ADM 3 + EXP 5 + LRN 4 + HMI 1 = **18** · 상태 — 현행 7(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE · EXP-LAB · EXP-FLOW · HMI-PLANT) + 폐지 11(D-14 10 · D-16 1) = **18** · 표 행 순서는 채번 순서다(EXP-FLOW가 먼저 채번돼 앞에 있다 — 메뉴 순서는 순서 열)

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 화면 코드 | **18** 채번 — 표면 접두 8(AUTH 1 · DSH 1 · ANL 1 · ALM 2 · ADM 3 · EXP 5 · LRN 4 · HMI 1) · 상태 현행 **7**(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE · EXP-LAB · EXP-FLOW · HMI-PLANT) + 폐지 11(D-14 10 · D-16 EXP-PERF 1). 채번 · 상태 자리는 §화면 인벤토리 · 현행 화면을 세는 기준은 화면 문서 4본(08 · 09 · 10 · 11)의 화면 명세 H2 블록 수(1 + 4 + 1 + 1 = **7**) |
| 기능 → 화면 | 화면 있음 15 + 내부 모듈 26 + 표면 없음 10 + 화면 없음(API 전용) 16 = **67** · 누락 0 · 고아 0(정본 [02_traceability.md](./02_traceability.md)) · 주 화면 EXP-FLOW 9(GEN-12 · RLT-05 · 07 · OBS-01~06) · EXP-LAB 2(GEN-13 · 14) · HMI-PLANT 4(RLT-10 · 11 · TSQ-01 · 06) · **기록 판독 화면 LRN 4는 주 기능 0이 설계**(api 표면을 부르지 않는다) · 공통 셸 0 · 폐지 11은 주 기능 0 |
| 도메인 공백 | **주 화면이 없는 도메인 4** — COL · SIM · ING은 내부 모듈이라 전용 화면이 없고 산출은 EXP-FLOW 흐름도 · HMI-PLANT 30칸에 보인다. **MST는 주 화면이 폐지됐다(D-14)** — 표면은 남고(화면 없음(API 전용)) 업무 명령 · 조회는 EXP-FLOW 흐름에, 설비 · 태그 이름은 HMI-PLANT에 나타난다. TSQ는 HMI-PLANT 최근 10분(TSQ-01 · 06)으로 D-16에 공백에서 빠졌다. GEN은 EXP-FLOW(GEN-12) · EXP-LAB(GEN-13 · 14), RLT는 EXP-FLOW(05 · 07) · HMI-PLANT(10 · 11), OBS는 EXP-FLOW가 주 화면이다. 옛 AUT · ALM · WRK는 D-16 폐지 도메인이다 |
| 경로 분리 | 저빈도 조회는 BFF 경유, WebSocket과 시계열 조회는 api 직결 — 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) · 화면이 부르는 health · /metrics는 BFF 경유 · EXP-FLOW는 셸 WebSocket 연결의 flow 프레임(subscribe_flow)과 BFF 경유 메트릭 5초 폴링 · 실행 표면(⑤ ⑥)은 BFF 경유 no-store · 측정 기록 읽기(②③④)는 BFF가 docs/measurements를 읽는다(api 표면 없음) · 공용 컨트롤(설비 가동 · 센서 데이터 현황 · 지우기)은 BFF 경유 no-store · **HMI 개요는 1초 고빈도인데 BFF 경유**(api 표면이 CORS 없는 BFF 경유 표면 — 기록된 예외) · HMI 최근 10분은 api 직결 시계열 조회 |
| 화면 접근 | 전원 무인증(D-16 — 로그인 · 권한 없음) · 흐름 관찰 · 기록 판독은 **표시 전용** · 실행 시작 · 중단 · 설비 가동 켜고 끄기 · 센서 데이터 지우기도 전원(라이브 실행 동시 1 · 지우기는 실행 중 · 설비 가동 중 409) · 장애 주입 · 설비 원격 조작 버튼은 없다 |
| 차트 | 채택 uPlot · ECharts — **ECharts 사용처 2**(LRN-TIMESERIES 곡선 2 · EXP-LAB 넣기 그림) · uPlot 사용처 0(HMI-PLANT 최근 10분은 인라인 SVG 작은 선) · 흐름도 · 막대는 SVG · HTML(정본 [01_standards.md](./01_standards.md) §차트 표준). 서버 다운샘플이 1차 방어선이고 차트는 2차 방어선이다 |
| 반응형 | 맞춤 보기 **1280 × 720 ~ 2560 × 1440 페이지 스크롤 0** · 스크롤은 목록형 조각 안에서만 · 1280 × 720 미만은 쌓고 세로 스크롤만 · 가로 스크롤 0 · e2e 검사 4크기 + 작은 화면 1(정본 [01_standards.md](./01_standards.md) §반응형 규칙 · D-16 결정 6) |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../07_api/README.md](../07_api/README.md) — 화면이 부르는 표면
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 각주 툴팁이 표시하는 스위치
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 실험 정본
