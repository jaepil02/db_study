# 01_overview — 제품 개요

> **대상**: insadesk — 소상공인(상시 근로자 1~30인)이 노무사·세무사 없이 근태 → 급여 자동계산 → 명세서 교부 → 법정 신고 자료까지 직접 마감하는 SaaS
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — v1 범위 94 → **98기능**(D-23) · 영구 제외 7 → **6** · 이월 44 → **41** · P2 11 → **15** · 제품 결정 범위 D-01~D-20 → **D-01~D-24**(앞 개정에서 D-21 · D-22를 반영하지 못한 것을 함께 닫는다)
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21) 반영 — 스택 표기 행을 Spring Boot 축으로, 저장소 표기를 back → **backend**로 갱신하고 루트 db_migration/ 등재
> **개정일**: 2026-08-08 — 웹 프론트엔드 스택 전환 반영(클라이언트 표면·스택 표기 행 재작성) · 제품 결정 범위 D-01~D-19 → **D-01~D-20**
> **원천**: [../README.md](../README.md)(고정 기준·전역 불변식) · [06_design_decisions.md](./06_design_decisions.md)(제품 결정 D-01~D-24) · docs_ref2/features_p0.md(v1 필수 94기능 — D-23으로 98) · docs_ref2/features.md(권한 모델·법정 의무 감사)

신규 합류자와 평가자가 가장 먼저 읽는 폴더다. 제품이 무엇이고 누구를 위한 것이며 v1의 범위와 순서가 어떤 근거로 이렇게 정해졌는지 맥락을 잡는다. 여기서 맥락을 잡은 뒤 [../02_features](../02_features/README.md) → [../03_requirements](../03_requirements/README.md) → [../04_architecture](../04_architecture/README.md) 순으로 넘어간다.

insadesk는 **구현 착수 전**이며 본 문서군은 to-be 설계 정본이다. 근거는 실측이 아니라 원천 문서(docs_ref2/ 4본)와 확정 결정(D-NN · ADR-NN)이며, 구현이 진행되면 각 문서를 as-built로 승격한다.

## 파일 목차

| 파일 | 내용 |
|------|------|
| [01_product_summary.md](./01_product_summary.md) | 무엇·누구·핵심 흐름·제품 표면·스택 요약 — 제품 한 장 요약 |
| [02_goals_scope.md](./02_goals_scope.md) | 목표 · In 범위(98기능) · **Out 범위 — v1 제외 항목(영구 제외 6 · v1.1 이월 41)의 유일한 등재처** · 제외가 만드는 위험 |
| [03_personas_roles.md](./03_personas_roles.md) | **페르소나 4종과 3층 권한 구조의 정본** — 사업장 RBAC · 플랫폼 RBAC · 계정·멤버십·사업장 수명주기 · 사업자등록 요건 분류 |
| [04_domain_map.md](./04_domain_map.md) | **13개 문서 도메인과 접두사 매핑** · 도메인 간 의존 관계 · 마감 경로 0~6단계 |
| [05_priorities_roadmap.md](./05_priorities_roadmap.md) | 도메인 × 우선순위 분포(파생 집계) · 구현 로드맵 · **v1.1 이월 트리거** · **법 개정 감시 항목** |
| [06_design_decisions.md](./06_design_decisions.md) | **제품 결정 D-NN 채번 정본** — D-01~D-24 원문과 버린 대안 |

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.** 아래는 본 폴더를 읽는 데 필요한 값만 추린 축약이며, 값이 어긋나면 정본을 따른다.

| 항목 | 기준 |
|------|------|
| 문서 도메인 | **13개** — AUT · WRK · HRM · ATT · LEV · PAY · SLP · TAX · CMP · NTF · SUB · SYS · PRV |
| v1 범위 | **98기능**. 검산: 10 + 13 + 11 + 12 + 5 + 13 + 7 + 3 + 5 + 3 + 5 + 7 + 2 + DSH 2 = **98** |
| v1 제외 | **영구 제외 6** · **v1.1 이월 41** — 등재처는 [02_goals_scope.md](./02_goals_scope.md) Out 범위 표뿐이다 |
| 우선순위 | P0 **25** · P1 **58** · P2 **15** — 98기능 안의 구현 순위이며 채택 여부와 다른 축이다(파생 집계 · 정본은 [../02_features](../02_features/README.md)) |
| 제품 결정 | **D-01~D-24** — 채번 정본은 [06_design_decisions.md](./06_design_decisions.md). 기술 결정(ADR-NN)은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)가 별개 축으로 소유한다 |
| 클라이언트 표면 | **3표면 + 공개 웹** — 직원 앱(app_front) · 관리자 웹 + 시스템 웹 + 공개 페이지(web_front 단일 페이지 앱 + 공개 페이지 프리렌더, D-20) |
| 사업장 역할 | OWNER ⊃ MANAGER ⊃ STAFF(누적). 사업장당 OWNER 1명(D-13). **ADVISOR는 v1에 두지 않는다**(WRK-13 이월) |
| 플랫폼 역할 | VIEWER(1) · SUPPORT(2) · ADMIN(3) · SUPER_ADMIN(4) — 사업장 RBAC와 완전 별개 |
| 요금제 | FREE(사업장 1 · 인원 5) · PRO(3 · 15) · ULTRA(5 · 30) |
| 정기작업 | v1 필수 **8건** — 정본은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) |
| 구현 순서 | 0 기준값·규모 → 1 인증·사업장 → 2 인사 → 3 근태 → **4 급여·명세서(MVP 증명점)** → 5 퇴사 경로 → 6 연차·보존·신고 캘린더 |
| 스택 표기 | **React · Vite · React Router · Spring Boot · PostgreSQL 18 · React Native**. 저장소는 backend · web_front · app_front(D-06 — 두 차례 전환 후에도 3폴더 불변)이고 스키마 정본은 루트 db_migration/이다(D-21). 정확 버전 정본은 [../08_tech_stack](../08_tech_stack/README.md) |

## 관련 문서

- [../README.md](../README.md) — 문서 지도 · 고정 기준 · 전역 불변식 · ID 규약
- [../CLAUDE.md](../CLAUDE.md) — 작성·검수 지침 · 범위 규약
- [../02_features/README.md](../02_features/README.md) — 98기능 채번 정본
- [../03_requirements/README.md](../03_requirements/README.md) — 요구사항 정본
- [../04_architecture/README.md](../04_architecture/README.md) — 시스템 구조 · ADR 채번 정본
- [../08_tech_stack/README.md](../08_tech_stack/README.md) — 기술 스택·버전 정본
- [../09_glossary/README.md](../09_glossary/README.md) — 용어 · 에러 코드 · enum/상태 머신 · ID 규약
