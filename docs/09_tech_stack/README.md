# 09_tech_stack — 기술 스택

> **대상**: db_study의 기술 선택과 버전 — 프론트엔드 · 백엔드 · 데이터 인프라 · 로컬 실행 환경 · 개발 도구 · 선정 근거
> **작성일**: 2026-09-23
> **개정일**: 2026-09-25 — S3 구현 반영 — 환경변수 34 → **37** · 버전 고정 상태는 03_data_infra 개정일 줄
> **개정일**: 2026-09-24 — S2 착수 반영 — 버전 고정표 상태 분류를 정본 03_data_infra 검산에 맞춤 — 버전 고정 11 → **24** · 재확인 대기 15 → **5** · 미고정 7 → **4**(행 38 불변)
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — 버전 고정표 37 → **38**행(Biome · Vitest 행 분리) · 상태 분류 — 태그 고정 3 → **4** · 버전 고정 2 → **11** · 재확인 대기 21 → **15** · 미고정 10 → **7**
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — 스택 표기 ClickHouse 25.8 → **26.8**
> **개정일**: 2026-09-24 — 착수 체크리스트 7 · Python 반영 — 버전 고정표 36 → **37**행(Python 버전 고정) · 버전 고정 1 → **2**
> **개정일**: 2026-09-24 — S0 실측 반영 — 버전 고정표 상태 분류에 버전 고정 1(Task) 반영 · 미고정 11 → **10**
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 버전 고정표 상태 분류에 태그 고정 3 반영
> **개정일**: 2026-09-24 — W6 완성판 — 관측 프로파일 구성원 2 · 환경변수 25 · 버전 고정표 35행 · 마이그레이션 도구 node-pg-migrate
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 환경변수 25 → **34**(비밀 9) · 버전 고정표 35 → **36**행(비밀번호 해시 라이브러리)
> **원천**: [../README.md](../README.md)(스택 표기) · 원본 tech_stack.md §2~§5 · §10~§13 · 원본 implementation_plan.md §2 · §6 · §9(커밋 ff66a37)

"무엇을 어느 버전으로 쓰는가"에 답하는 폴더다. **버전 문자열의 유일한 기재처**다 — 다른 문서는 스택을 Next.js · NestJS · PostgreSQL 18 · ClickHouse 26.8 · Redis 8로만 표기하고 라이브러리 메이저 · 이미지 태그는 여기를 링크한다.

**성능 실험은 버전이 바뀌면 재현되지 않는다.** 그래서 모든 이미지는 태그를 명시하고 latest를 쓰지 않으며, 착수 시점에 공식 릴리스 노트로 최신 안정 버전을 재확인해 고정한다. 릴리스 노트의 URL은 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)에 둔다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_frontend.md](./01_frontend.md) | Next.js App Router · BFF 역할 · 차트(uPlot · ECharts) · TanStack Query · Zustand · 네이티브 WebSocket · Tailwind · shadcn/ui · zod 공유 | tech_stack §4 | W6 |
| [02_backend.md](./02_backend.md) | NestJS + Fastify 어댑터 · 단일 런타임 · 데이터 평면 라이브러리(@clickhouse/client · ioredis · pg · pg-copy-streams · modbus-serial · jsmodbus · msgpackr · piscina · prom-client) | tech_stack §2 · §3 | W6 |
| [03_data_infra.md](./03_data_infra.md) | PostgreSQL · ClickHouse · Redis 이미지와 확장 · observability 프로파일 구성원(판정) · **버전 고정표** | tech_stack §5 · §9 · §12 · architecture §14 | W6 |
| [04_local_environment.md](./04_local_environment.md) | 머신 요구사항 · 실측 환경(WSL2 · 20스레드 · 가용 RAM) · 메모리 프로파일 · 중간 프로파일 · **컨테이너 메모리 상한 · 환경변수 정본** · cpuset · networkingMode=mirrored | tech_stack §10.2 · implementation_plan §2 | W6 |
| [05_tooling_devops.md](./05_tooling_devops.md) | pnpm workspace · Biome · tsc strict · Vitest · Testcontainers · Taskfile(migrate · seed · snapshot · restore · bench) · 리포지터리 구조 · 착수 체크리스트의 도구 항목 · 마이그레이션 도구 판정(node-pg-migrate) · SIM 주입 계획 형식 · docs:lint 편입 | tech_stack §11 · implementation_plan §6 · §9 | W6 |
| [06_decisions_rationale.md](./06_decisions_rationale.md) | 선정 근거 · NestJS vs Python 비교 · 감수 비용과 완화책 · 전환 조건 · **채택하지 않은 기술과 버린 대안의 실패 시나리오** | tech_stack §3.2~§3.4 · §4.1 · §5.2 · §13 | W6 |

검산: 본문 6 + README 1 = **7**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 스택 표기 | Next.js · NestJS · PostgreSQL 18 · ClickHouse 26.8 · Redis 8 · Docker Compose |
| 버전 고정 | 정확 버전은 [03_data_infra.md](./03_data_infra.md)의 버전 고정표 한 자리에만 적는다 |
| 메모리 프로파일 | **2** — 부하 실험 · 개발. 중간 프로파일은 WSL2 메모리 상향이 불가능할 때의 조건부 대안이다 |
| 관측 프로파일 | 선택 기동 · 구성원 **2**(prometheus · grafana). alertmanager 채택하지 않음 · tempo 조건부(현 범위 밖). 판정 정본 [03_data_infra.md](./03_data_infra.md) |
| 환경변수 | **37**(스위치 11 + 스위치 밖 26 — 비밀 9 포함) — 정본 [04_local_environment.md](./04_local_environment.md) §환경변수 |
| 버전 고정표 | **38행**(태그 고정 4 · 버전 고정 24 · 재확인 대기 5 · 미고정 4 · 해당 없음 1 = 38) — 착수 시점 공식 릴리스 노트 재확인 전까지 확정 태그가 아니다 · 정본 [03_data_infra.md](./03_data_infra.md) |

## 관련 문서

- [../README.md](../README.md) — 스택 표기 규약
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 컨테이너 배치와 자원 배분
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — 기술 결정 ADR
- [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) — 공식 문서 URL
