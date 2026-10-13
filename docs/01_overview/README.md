# 01_overview — 개요

> **대상**: db_study — 왜 만드는가 · 무엇을 배우려는가 · 어디까지 만드는가 · 어떤 순서로 가는가
> **작성일**: 2026-09-23
> **개정일**: 2026-10-11 — **D-16 웹 7화면 · 발표 · 도입**(사용자 결정 2026-10-11) — 목차 01 행 두 축을 화면으로 · 02 행 HMI 최소 화면 In · 직접 비교 · 지우기 · 도입 설계 · 03 행 시연 청중 · 05 행 D-16 재구성 묶음 · 고정 기준 축약 **화면 행 신설**(7화면 · 메뉴 순서 = 발표 순서) · 범위 행 신설(HMI 최소 화면 In · 상용 SCADA 수준 Out)
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11) — 목차 03 역할 대응 → 화면 · 요청 경로 대응 · 04 11도메인 → **8도메인** · 고정 기준 축약 도메인 11 → **8**(제어 6 → **3**) · 분기 3계층 → **두 갈래**(② 폐지) · 제품·학습 결정 13 → **16**(D-14 · 15 · 16 반영 누락분 — 정본 06_design_decisions)
> **개정일**: 2026-09-27 — D-04 부분 개정 반영(사용자 결정 — 업무 쓰기도 Redis를 거친다) — 고정 기준 축약 역할 스위치 11 → **12종**(SW-12 BIZ_WRITE_PATH · Redis 역할 10 → **11**)
> **원천**: [../README.md](../README.md)(고정 기준 · 전역 불변식) · 원본 tech_stack.md §1 · §14 · 원본 implementation_plan.md §1 · §3 · §5 · §9(커밋 ff66a37) · 저장소 루트 docs_plan.md(학습 목표 2축 · 확정 사항 3건) · D-16(사용자 결정 2026-10-11)

신규 합류자와 학습자가 가장 먼저 읽는 폴더다. 이 시스템이 서비스가 아니라 **측정 장치**라는 것, 그래서 기능의 완성도보다 비교 가능한 수치가 우선한다는 것을 여기서 잡는다. 맥락을 잡은 뒤 [../02_features](../02_features/README.md) → [../03_requirements](../03_requirements/README.md) → [../04_architecture](../04_architecture/README.md) 순으로 넘어간다.

이 폴더는 **제품·학습 결정 D-NN**을 채번한다. 기술 결정 ADR-NN은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)가 별개 축으로 소유한다 — 무엇을 배울지는 D, 그것을 어떤 구조로 강제할지는 ADR이다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) | ★ **학습 목표 2축의 정본** — 축별 질문 · 산출물 · 측정 경로(설계 문서 → 실험 EXP) · 두 축을 관통하는 스위치 SW-NN · 두 축을 화면으로(7화면 — 기록 판독 · 라이브) | tech_stack §1 · implementation_plan §1 · docs_plan Context | W1 |
| [02_goals_scope.md](./02_goals_scope.md) | In 범위(HMI 최소 화면 · 직접 비교 · 센서 데이터 지우기 · 회사 도입 설계 — D-16) · Out 범위 · 비목표(상용 MES/SCADA 수준 · 고가용성 · 배포) · 제외가 만드는 한계 | tech_stack §1 | W1 |
| [03_personas_roles.md](./03_personas_roles.md) | 페르소나 — 현장 운영자 · 관리자 · 엔지니어 · 실험 수행자 · 시연 청중(D-16) · 화면 · 요청 경로의 대응(권한 역할 없음 — D-16) | architecture §2 | W1 |
| [04_domain_map.md](./04_domain_map.md) | **8도메인 ↔ NestJS 모듈 ↔ 평면 매핑의 정본** · 도메인 간 의존 그래프 · 폴더별 도메인 공백 | architecture §4 · tech_stack §3.1 | W1 |
| [05_priorities_roadmap.md](./05_priorities_roadmap.md) | 학습 단계 S0~S7과 완성 Phase 0~5의 대응 · 단계별 진입 조건과 합격 판정 · D-16 재구성 묶음(단계 밖) · 착수 체크리스트 · 코드 착수 항목(Taskfile · 린트 편입) · 미확인 등재 | tech_stack §14 · implementation_plan §3 · §5 · §9 | W1 |
| [06_design_decisions.md](./06_design_decisions.md) | **제품·학습 결정 D-NN 채번 정본** — 결정 원문 · 버린 대안 · 파급 | docs_plan 확정 사항 3건 · 실행 계획 보정 · implementation_plan §3.2 · W1 판정 D-11 · D-12 | W1 |

검산: 본문 6 + README 1 = **7**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.** 아래는 이 폴더를 읽는 데 필요한 값만 추린 축약이며, 값이 어긋나면 정본을 따른다.

| 항목 | 기준 |
|------|------|
| 학습 목표 | **2축** — ① 컬럼형 vs RDB를 측정으로 안다 ② Redis 중간 계층에서 성격별 분기를 경험한다 |
| 도메인 | **8개** — MST · COL · SIM · GEN · ING · TSQ · RLT · OBS(제어 3 · 데이터 4 · 관측 1) · AUT · ALM · WRK는 D-16 폐지 |
| 분기 계층 | **두 갈래** — ① 원시값 ③ 업무 명령(② 알람 · 실적은 D-16 폐지 — 번호 재배치 없음) |
| 역할 스위치 | **12종** — SW-01~SW-12(Redis 역할 11 + 수집 1). 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| 학습 단계 | S0~S7 — 완성 순서(Phase 0~5)와 학습 순서는 다르다. 학습 순서의 정본은 [05_priorities_roadmap.md](./05_priorities_roadmap.md) |
| 제품·학습 결정 | **16** — D-01~D-16 · 채번 정본 [06_design_decisions.md](./06_design_decisions.md) |
| 실행 환경 | 로컬 머신 1대 · Docker Compose 컨테이너 4개 + 호스트 웹 · 127.0.0.1 바인드 · 배포 없음 · 회사 도입은 설계 문서만([../04_architecture/10_plant_adoption.md](../04_architecture/10_plant_adoption.md)) |
| 화면 | **7** — 메뉴 순서 = 발표 순서(개념 2 · 비교 2 · 직접 해 보기 2 · 현장 적용 1 — D-16 결정 1) · 정본 [../08_screen/README.md](../08_screen/README.md) |
| 범위 경계 | HMI 최소 화면(상태 + 데이터 종류 · 알람 · 원격 조작 없음)은 In · 상용 MES/SCADA 수준은 Out(D-16 결정 3) · 정본 [02_goals_scope.md](./02_goals_scope.md) |

## 관련 문서

- [../README.md](../README.md) — 문서 지도 · 고정 기준 · 전역 불변식 · ID 규약
- [../CLAUDE.md](../CLAUDE.md) — 작성·검수 지침
- [../02_features/README.md](../02_features/README.md) — 기능 ID · 스위치 채번 정본
- [../04_architecture/README.md](../04_architecture/README.md) — 구조 · ADR 채번 정본
- [../10_observability/README.md](../10_observability/README.md) — 실험 EXP-NN 채번 정본
