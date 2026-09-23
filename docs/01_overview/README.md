# 01_overview — 개요

> **대상**: db_study — 왜 만드는가 · 무엇을 배우려는가 · 어디까지 만드는가 · 어떤 순서로 가는가
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(고정 기준 · 전역 불변식) · 원본 tech_stack.md §1 · §14 · 원본 implementation_plan.md §1 · §3 · §5 · §9(커밋 ff66a37) · 저장소 루트 docs_plan.md(학습 목표 2축 · 확정 사항 3건)

신규 합류자와 학습자가 가장 먼저 읽는 폴더다. 이 시스템이 서비스가 아니라 **측정 장치**라는 것, 그래서 기능의 완성도보다 비교 가능한 수치가 우선한다는 것을 여기서 잡는다. 맥락을 잡은 뒤 [../02_features](../02_features/README.md) → [../03_requirements](../03_requirements/README.md) → [../04_architecture](../04_architecture/README.md) 순으로 넘어간다.

이 폴더는 **제품·학습 결정 D-NN**을 채번한다. 기술 결정 ADR-NN은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)가 별개 축으로 소유한다 — 무엇을 배울지는 D, 그것을 어떤 구조로 강제할지는 ADR이다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_purpose_learning_goals.md](./01_purpose_learning_goals.md) | ★ **학습 목표 2축의 정본** — 축별 질문 · 산출물 · 측정 경로(설계 문서 → 실험 EXP) · 두 축을 관통하는 스위치 SW-NN | tech_stack §1 · implementation_plan §1 · docs_plan Context | W1 |
| [02_goals_scope.md](./02_goals_scope.md) | In 범위 · Out 범위 · 비목표(상용 MES/SCADA 수준 · 고가용성 · 배포) · 제외가 만드는 한계 | tech_stack §1 | W1 |
| [03_personas_roles.md](./03_personas_roles.md) | 페르소나 — 현장 운영자 · 관리자 · 엔지니어 · 실험 수행자 · 역할과 화면의 대응 | architecture §2 | W1 |
| [04_domain_map.md](./04_domain_map.md) | **11도메인 ↔ NestJS 모듈 ↔ 평면 매핑의 정본** · 도메인 간 의존 그래프 · 폴더별 도메인 공백 | architecture §4 · tech_stack §3.1 | W1 |
| [05_priorities_roadmap.md](./05_priorities_roadmap.md) | 학습 단계 S0~S7과 완성 Phase 0~5의 대응 · 단계별 진입 조건과 합격 판정 · 착수 체크리스트 · 코드 착수 항목(Taskfile · 린트 편입) · 미확인 등재 | tech_stack §14 · implementation_plan §3 · §5 · §9 | W1 |
| [06_design_decisions.md](./06_design_decisions.md) | **제품·학습 결정 D-NN 채번 정본** — 결정 원문 · 버린 대안 · 파급 | docs_plan 확정 사항 3건 · 실행 계획 보정 · implementation_plan §3.2 · W1 판정 D-11 · D-12 | W1 |

검산: 본문 6 + README 1 = **7**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.** 아래는 이 폴더를 읽는 데 필요한 값만 추린 축약이며, 값이 어긋나면 정본을 따른다.

| 항목 | 기준 |
|------|------|
| 학습 목표 | **2축** — ① 컬럼형 vs RDB를 측정으로 안다 ② Redis 중간 계층에서 성격별 분기를 경험한다 |
| 도메인 | **11개** — AUT · MST · COL · SIM · GEN · ING · TSQ · RLT · ALM · WRK · OBS(제어 6 · 데이터 4 · 관측 1) |
| 분기 계층 | **3계층** — ① 원시값 ② 알람 · 실적 ③ 업무 CRUD |
| 역할 스위치 | **10종** — SW-01~SW-10(Redis 역할 9 + 수집 1). 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| 학습 단계 | S0~S7 — 완성 순서(Phase 0~5)와 학습 순서는 다르다. 학습 순서의 정본은 [05_priorities_roadmap.md](./05_priorities_roadmap.md) |
| 제품·학습 결정 | **12** — D-01~D-12 · 채번 정본 [06_design_decisions.md](./06_design_decisions.md) |
| 실행 환경 | 로컬 머신 1대 · Docker Compose 컨테이너 4개 + 호스트 웹 · 127.0.0.1 바인드 · 배포 없음 |

## 관련 문서

- [../README.md](../README.md) — 문서 지도 · 고정 기준 · 전역 불변식 · ID 규약
- [../CLAUDE.md](../CLAUDE.md) — 작성·검수 지침
- [../02_features/README.md](../02_features/README.md) — 기능 ID · 스위치 채번 정본
- [../04_architecture/README.md](../04_architecture/README.md) — 구조 · ADR 채번 정본
- [../10_observability/README.md](../10_observability/README.md) — 실험 EXP-NN 채번 정본
