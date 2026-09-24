# 개발 도구와 작업 정의

> **대상**: 개발 도구 구성 — pnpm workspace · Biome · tsc strict · Vitest · Supertest · Testcontainers · 품질 게이트 · **마이그레이션 도구 판정** · Taskfile 작업 6(migrate · seed · snapshot · restore · bench · docs:lint) · 리포지터리의 도구 파일 자리 · **SIM 주입 계획 파일 형식(판정)** · 착수 체크리스트의 도구 항목
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S2 구현 반영 — Taskfile migrate · seed 구현(api 이미지 안 명령 · seed --tier · --slice) · 보조 작업 api-build · up · test-surface · Supertest 표면 계약 가동(Testcontainers 미사용)
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — pnpm workspace 가동(apps/api · packages/shared · 잠금 파일 커밋) · 품질 게이트 ①~④ 전부 가동 · 빌드 스크립트 허용 목록 규칙 신설
> **개정일**: 2026-09-24 — S0 구현 반영 — docs:lint 편입 완료(.omc/docs_lint.py → **scripts/docs_lint.py** · 품질 게이트 ④ 가동 — .githooks/pre-commit) · Taskfile S0분 3작업 구현(snapshot · restore · docs:lint) · 도구 파일 자리에 .nvmrc · .githooks · scripts 3행 추가
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 미확인 등재에 타 문서가 넘긴 3행 수용(구조화 로그 보관 · 시나리오 파일 형식 · 비밀번호 교체 작업화)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 표 웨이브 표지 (W7) 제거
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §5.1 · §10.3 · §10.5 · §11(커밋 ff66a37) · 원본 implementation_plan.md §2.1 · §6 · §9(커밋 ff66a37) · 원본 architecture.md §3(커밋 ff66a37) · docs_plan 실행 계획 보정 #4 · #9 · 웨이브 인계 W6 행(주입 계획 파일 형식) · ADR-01 · ADR-08 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 착수 체크리스트 · 코드 착수 항목 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어

도구의 목표는 하나다 — **같은 커밋이면 누가 언제 돌려도 같은 코드 · 같은 스키마 · 같은 엔진 버전에서 측정이 돈다.** 도구 선택마다 "이 도구가 빠지면 두 측정의 조건이 어디서 갈라지는가"로 근거를 닫는다. 도구의 버전은 적지 않는다 — 정본은 [03_data_infra.md](./03_data_infra.md) §버전 고정표다.

**도구 · 작업은 배정 단계에서 코드가 된다.** 이 문서는 작업의 계약이다. S0에서 Taskfile의 snapshot · restore · docs:lint와 pre-commit 게이트 ④가 먼저 생겼고(2026-09-24), 나머지 작업은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) §코드 착수 항목의 배정 단계에서 더한다(docs_plan 보정 #9).

모듈 디렉터리 배치의 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §리포지터리 구조다. 이 문서는 그 구조 위의 **도구 파일 자리**만 더한다.

## 도구 구성

| 영역 | 선택 | 근거 | 이 도구가 빠지면 |
|------|------|------|------|
| 패키지 관리 | pnpm workspace 모노레포 | 웹 · api · shared가 한 잠금 파일을 쓴다 | 패키지마다 잠금이 갈려 shared 스키마의 두 사본이 다른 버전으로 설치된다 |
| 린트 · 포맷 | Biome | 린트 · 포맷을 도구 하나로 · 설정 하나 | 린터 · 포매터 둘의 규칙 충돌이 커밋마다 공백 diff를 만든다 |
| 타입 검사 | tsc strict | 페이로드 계약의 필드 누락을 컴파일에서 막는다 | Stream 페이로드 필드 하나가 undefined로 흘러 디코더가 엔트리를 DLQ로 보낸다 |
| 단위 테스트 | Vitest | TypeScript 직접 실행 · 워크스페이스 공용 | 해당 없음 — 대체 가능한 선택이며 결정 사항이 아니다 |
| HTTP 테스트 | Supertest | Fastify 어댑터 위 표면 계약 검사 | 표면 계약(상태 코드 · 에러 코드)이 수동 확인에 머문다 |
| 통합 테스트 | Testcontainers | 실제 저장소 컨테이너로 경계 검사 | 저장소 흉내(mock)로 검사한 XACK · 중복 제거 동작이 실제 엔진과 다르다 |
| 마이그레이션 | node-pg-migrate(PostgreSQL) · 순번 SQL 파일(ClickHouse) | §마이그레이션 도구 판정 | 수동 DDL이 스냅샷 복원 · 새 환경에서 재현되지 않는다(REQ-TEC-05) |
| 작업 실행 | Taskfile | 명령 순서를 한 파일이 소유 | 사람마다 명령 순서가 달라 기동 조건이 기록 밖에서 갈린다 |
| 환경 견본 | .env.example | 환경변수 이름 · 로컬 기본값의 견본 | .env가 커밋되거나 이름이 사람마다 달라진다(REQ-TEC-14) |

- 검산: 영역 = **9**
- **Testcontainers는 버전 고정표와 같은 이미지 태그를 쓴다.** 통합 테스트가 다른 태그로 돌면 테스트가 통과한 엔진과 측정하는 엔진이 다르다 — 태그는 Compose 정의와 같은 원천에서 읽는다.

## pnpm workspace

| 항목 | 규칙 | 근거 | 어기면 |
|------|------|------|------|
| 워크스페이스 구성 | apps/web · apps/api · packages/shared | ADR-01 — 스키마 원천 하나 | shared가 패키지로 발행되면 웹과 api가 다른 발행 버전을 물어 계약이 두 벌이 된다 |
| 패키지 관리자 버전 | 루트 패키지 정의의 패키지 관리자 필드로 **정확 버전을 박는다** · corepack이 그 버전을 쓴다 | REQ-TEC-04 | 원본 체크리스트의 latest 활성화 명령은 설치 날짜마다 다른 pnpm을 받아 잠금 파일 형식이 흔들린다 — **latest 금지** |
| Node 버전 | 호스트와 컨테이너 같은 LTS 메이저 · 버전 관리자로 호스트 고정 | 원본 실측 호스트 v24.20.0(원본 implementation_plan.md §2.1) | 호스트 테스트와 컨테이너 실행이 다른 런타임에서 돈다 |
| 잠금 파일 | 커밋한다 · 설치는 잠금 고정 모드 | 같은 커밋 = 같은 의존성 | 잠금 밖 설치가 부 버전을 올려 같은 커밋의 두 측정이 다른 라이브러리에서 돈다 |
| 의존성 추가 | 버전 고정표에 행이 있어야 추가한다 | 03_data_infra 유일 기재처 | 표에 없는 라이브러리가 측정 경로에 들어와 버전 재확인 절차에서 빠진다 |
| **빌드 스크립트** | 의존성의 설치 스크립트는 pnpm-workspace.yaml 허용 목록에서 켜고 끄는 것을 명시한다 — 결정하지 않은 항목이 있으면 pnpm이 설치를 거부한다 | 같은 커밋 = 같은 설치 결과 | 호스트는 네이티브 가속으로, 컨테이너는 순수 JS로 도는 식으로 두 설치가 다른 코드 경로를 탄다 |

- 검산: 규칙 = **6**

## 품질 게이트

배포가 없으므로 CI는 선택이다. 품질 게이트의 정본 자리는 **pre-commit 훅**이고, CI를 둔다면 같은 명령을 그대로 돌린다(원본 tech_stack.md §11).

```plain
① Biome              린트 · 포맷 검사 — 수정은 하지 않고 실패만
② tsc strict         워크스페이스 전체 타입 검사
③ Vitest             단위 테스트 — Testcontainers 통합 테스트는 게이트 밖(수동 · 작업)
④ docs:lint          문서군 린트 — S0에서 편입(scripts/docs_lint.py)
```

- **순서는 싼 것부터다.** 포맷 실패로 끝날 커밋에 타입 검사 · 테스트 시간을 쓰지 않는다.
- **통합 테스트를 게이트에 넣지 않는다.** 저장소 컨테이너 기동이 커밋마다 수십 초를 더해 게이트를 우회하는 습관을 만든다 — 통합 테스트는 단계 합격 판정(01_overview/05) 전에 돌린다.
- **S1부터 ①~④가 모두 돈다.** pre-commit이 호스트 Node를 .nvmrc 메이저로 맞춘 뒤 biome check · 워크스페이스 전체 tsc · Vitest · docs:lint 순서로 돌린다.
- **④가 먼저 붙었다(S0).** 문서군 린트를 git 추적 밖 로컬 스크립트(.omc/docs_lint.py)에서 저장소 안 scripts/docs_lint.py로 옮기고, 훅 디렉터리 .githooks(git 설정 core.hooksPath)의 pre-commit이 task docs:lint를 부른다(docs_plan 보정 #9). ①~③은 코드가 생기는 S1부터 같은 훅에 앞순서로 붙는다. 훅 경로 설정은 저장소 복제마다 한 번 해야 한다 — 설정하지 않은 복제본에서는 게이트가 돌지 않는다.

## 마이그레이션 도구 판정

[../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md)가 넘긴 "마이그레이션 도구 선택"을 닫는다. 선택 조건은 그 문서가 정했다 — **도구가 무엇이든 원시 SQL 마이그레이션을 쓸 수 있어야 한다**(파티션 · 트리거 · 권한 · 확장 · BRIN은 모델 선언으로 표현되지 않는다). **판정 — PostgreSQL은 node-pg-migrate의 SQL 순번 파일, ClickHouse는 순번 SQL 파일을 migrate 작업이 순서대로 적용한다.**

| 안 | 수단 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① Prisma Migrate | 스키마 모델 선언 → 마이그레이션 생성 · 원시 SQL은 생성된 파일을 손으로 고침 | 스키마 원천이 둘이 된다(zod + Prisma 모델). 그리고 pg_partman 유지 작업이 런타임에 만드는 자식 파티션이 마이그레이션 이력 밖 객체로 보여 개발 명령의 드리프트 검사가 DB 초기화를 제안한다 — 받아들이면 볼륨 데이터가 사라진다(드리프트 동작은 공식 참조로 재확인) | 버림 |
| ② **node-pg-migrate** | 순번 마이그레이션 파일 · 원시 SQL 우선 · 이력 테이블 하나 | 모델 선언이 없어 타입을 스키마에서 생성하지 않는다 — 쿼리 결과 타입은 shared의 zod가 준다 | **채택** |
| ③ 손으로 쓴 SQL + 셸 스크립트 | 순번 SQL을 psql로 적용 | 적용 이력 테이블 · 잠금이 없어 두 번 적용 · 중간 실패 뒤 재적용이 사람의 기억에 달린다 | 버림 |

- 검산: 안 = **3**
- **이력 테이블은 도구 관리 테이블이다** — 루트 README 고정 기준의 PostgreSQL 테이블 수에 세지 않는다(세는 기준은 부모 업무 · 대조군 테이블).
- **ClickHouse에는 도구를 두지 않는다.** 순번 SQL 파일의 멱등 수단(IF NOT EXISTS)과 적용 순서는 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §ClickHouse DDL 순번이 정한다. migrate 작업이 PostgreSQL 적용 뒤 ClickHouse 파일을 순번대로 보낸다.
- **ORM을 쓰지 않는 파급** — 쿼리 계층은 pg 풀 하나다([02_backend.md](./02_backend.md) §데이터 평면 라이브러리). Prisma가 버전 고정표에서 빠진 근거는 [06_decisions_rationale.md](./06_decisions_rationale.md) §버린 대안의 실패 시나리오다.

## Taskfile 작업

원본 작업 5(migrate · seed · snapshot · restore · bench — 원본 implementation_plan.md §6) + 코드 착수 항목 1(docs:lint)이다. 사람이 치는 기동 순서의 정본은 [04_local_environment.md](./04_local_environment.md) §기동 · 정지 명령이다.

| 작업 | 동작 | 선행 조건 | 멱등 | 실패하면 |
|------|------|------|------|------|
| migrate | PostgreSQL 순번 마이그레이션 → ClickHouse DDL 순번 → Dictionary 재적재 | 저장소 3 healthy | 적용 이력으로 멱등 | 적용된 순번에서 멈춘다 · 다음 실행이 이어서 적용 |
| seed | 사이트 · 라인 · 설비 · 접속 설정 · 태그 · 계정 · 역할(티어 인자) | migrate 완료 · 빈 마스터 | 빈 볼륨 전용 — 채워진 볼륨이면 거부 | 부분 시드를 남기지 않게 한 트랜잭션 |
| snapshot | 컨테이너 정지 → 볼륨 4개를 볼륨별 아카이브로 snapshots/에 | 부하 없음 | 이름이 같으면 거부 | 정지 상태로 남는다 — 재기동은 사람이 |
| restore | 컨테이너 정지 → 볼륨 비우기 → 아카이브 역전개 → 재기동 | 대상 아카이브 존재 | 같은 아카이브면 같은 상태 | 볼륨이 빈 채로 남을 수 있다 — 복원 전 snapshot을 먼저 |
| bench | 부하 시나리오 하나를 k6로 실행 · k6를 전용 CPU 집합에 고정 · 조건 칸 초안 생성 | 기준선 관측 완료 · 캐시 계열 키 비움 | 해당 없음 — 실행마다 새 기록 | 기록 초안만 남고 수치는 기록하지 않는다 |
| docs:lint | 문서군 기계 검사 | 없음 | 읽기 전용 | 오류 목록 · 비정상 종료 |

- 검산: 작업 = 원본 5 + 코드 착수 1 = **6**
- **S0 구현(2026-09-24) — snapshot · restore · docs:lint가 저장소 루트 Taskfile.yml에 있다.** migrate · seed(S3) · bench(S5)는 배정 단계에서 더한다. snapshot은 아직 없는 볼륨(api 이전의 spooldata)을 manifest에 absent로 적고 건너뛰며, restore는 아카이브에 있는 볼륨만 되돌린 뒤 저장소 3개 healthy까지 기다린다. 묶기와 풀기에 같은 태그 고정 이미지를 써서 볼륨 파일의 소유자 번호를 보존한다.
- **S2 구현(2026-09-24) — migrate · seed가 Taskfile.yml에 있다.** 둘 다 api 이미지 안 명령이다(스키마 소유권 api — docker compose run --rm --no-deps api node dist/db/migrate.js · seed.js). migrate는 관리자 계정으로 001을 적용하고 역할 비밀번호를 .env 값으로 설정한 뒤 나머지 순번을 app_owner로 적용하며, ClickHouse 순번 파일을 매번 전부 멱등 적용한다 — Dictionary 재적재는 dict_tag가 생기는 S3부터다. seed는 --tier S · --slice s2 인자를 받고 계정 · 역할은 AUT 테이블이 생기는 단계(S7)에서 더한다. 보조 작업 셋 — api-build(작업 트리가 깨끗할 때만 커밋 해시를 빌드 인자로 · 아니면 null) · up(저장소 healthy → migrate → SEED가 있으면 seed → api healthy · 기동 순서 정본 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)) · test-surface(기동한 api에 표면 계약 테스트) — 은 원본 6작업 밖의 편의 작업이라 위 검산에 넣지 않는다.
- **seed가 채워진 볼륨을 거부하는 이유** — 시드 고정 생성기의 재현성은 빈 상태에서 출발할 때만 성립한다. 두 번 시드한 볼륨은 tag_id 공간이 달라 같은 시드의 두 실험이 다른 태그를 본다.
- **bench의 CPU 집합 고정** — k6를 측정 대상과 겹치지 않는 집합에 둔다(배치 정본 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §cpuset 배치). 시나리오 정의의 정본은 [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md), 기록 형식은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)다.
- **snapshot · restore는 컨테이너를 정지한다.** 실행 중 볼륨을 묶으면 ClickHouse 파트 · PostgreSQL WAL이 중간 상태로 묶여 복원이 기동에 실패하거나 조용히 손상된다.

## 리포지터리의 도구 파일 자리

모듈 배치는 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) §리포지터리 구조가 정본이다. 아래는 그 위에 도구가 두는 파일이다.

```plain
db_study/
├── 루트 패키지 정의           ← 패키지 관리자 필드(pnpm 정확 버전) · 워크스페이스 스크립트
├── 워크스페이스 정의           ← apps/* · packages/*
├── 잠금 파일                  ← 커밋한다
├── Biome 설정                 ← 린트 · 포맷 규칙 하나
├── tsconfig 기반 설정          ← strict · 패키지별 확장
├── Taskfile                  ← 작업 6
├── .env.example              ← 환경변수 이름 견본(정본 04_local_environment)
├── .gitignore                ← .env · snapshots/ · 빌드 산출물
├── .nvmrc                    ← 호스트 Node 메이저(버전 관리자가 읽는다)
├── .githooks/                ← pre-commit — 품질 게이트(git 설정 core.hooksPath)
├── scripts/                  ← docs_lint.py(docs:lint) · lab/s0(S0 실습 · 판별 스크립트)
├── infra/
│   ├── compose/              ← 기본 정의 + 프로파일 덮어쓰기 파일 3(부하 실험 · 개발 · 중간)
│   ├── postgres/migrations/  ← node-pg-migrate 순번 파일
│   ├── clickhouse/ddl/       ← 순번 SQL 파일
│   └── sim-plans/            ← SIM 주입 계획 파일(§SIM 주입 계획 파일 형식)
├── loadtest/                 ← k6 시나리오
└── snapshots/                ← 볼륨 아카이브 · 덤프 · alarm_event 아카이브(Git 제외)
```

- **.gitignore가 snapshots/와 .env를 막는다.** 스냅샷을 커밋하면 저장소가 GB 단위로 불고, .env를 커밋하면 비밀이 퍼진다(REQ-TEC-14).
- **Compose 덮어쓰기 파일이 프로파일마다 하나다.** 컨테이너 상한 · MEMORY_PROFILE · 워커 수가 한 파일에서 함께 나와야 어긋나지 않는다([04_local_environment.md](./04_local_environment.md) §기동 · 정지 명령).
- 파일 이름 형식은 구현이 정한다 — 이 트리는 자리의 계약이다.

## SIM 주입 계획 파일 형식

인계 "주입 계획의 파일 형식"을 닫는다. 제어 수단(기동 시 읽는 주입 계획)과 계획 항목 4개의 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어다. **판정 — 계획 파일은 JSON 하나이고, shared의 zod 스키마로 검증하며, 검증에 실패하면 기동을 거부한다.**

| 안 | 형식 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 환경변수 문자열 | 한 줄에 계획을 인코딩 | 주입 둘 이상 · 레지스터 범위를 한 줄에 담으면 사람이 못 읽고 오타가 기동 뒤에야 드러난다 | 버림 |
| ② YAML | 사람이 쓰기 쉬운 들여쓰기 형식 | 파서 의존성이 하나 늘고, 들여쓰기 한 칸 차이가 항목을 다른 부모로 옮겨도 파싱은 성공한다 — 계획과 실제 주입이 조용히 어긋난다 | 버림 |
| ③ **JSON + zod 검증** | 구조 명시 · 스키마 원천 하나(ADR-01) | 주석을 쓸 수 없다 — 설명은 note 필드에 둔다 | **채택** |

- 검산: 안 = **3**

계획 파일은 infra/sim-plans/ 아래에 두고 경로를 SIM_FAULT_PLAN 환경변수로 준다([04_local_environment.md](./04_local_environment.md) §환경변수). 모양은 아래와 같다.

```json
{
  "v": 1,
  "note": "S3 품질 판정 — 지연 1건 · 예외 1건",
  "faults": [
    {
      "ports": { "from": 5020, "to": 5024 },
      "registers": { "start": 0, "count": 100 },
      "kind": "delay",
      "delayMs": 1500,
      "startOffsetMs": 60000,
      "durationMs": 120000
    },
    {
      "ports": { "from": 5030, "to": 5030 },
      "registers": { "start": 0, "count": 50 },
      "kind": "exception",
      "exceptionCode": 2,
      "startOffsetMs": 240000,
      "durationMs": 60000
    }
  ]
}
```

- **필드는 계획 항목 4개에 그대로 대응한다** — 대상 설비(ports) · 대상 레지스터(registers) · 종류(kind + delayMs 또는 exceptionCode) · 시작 오프셋 · 지속 시간(startOffsetMs · durationMs). 스키마 버전 v는 Stream 페이로드 계약과 같은 방식이다.
- **종류는 delay · exception 둘뿐이다.** 범위 밖 값은 SIM이 아니라 GEN 모드 A 벡터가 만든다(06_pipeline/10) — 계획 파일에 세 번째 종류를 두면 같은 주입을 두 모듈이 만들 수 있게 된다.
- 예시의 수치는 형식을 보이는 견본이며 실험 조건이 아니다.

| 검증 규칙 | 내용 | 거부 사유 |
|------|------|------|
| 스키마 | zod 스키마(shared) 통과 · 모르는 필드 거부 | 오타 필드가 조용히 무시되면 계획의 일부가 적용되지 않는다 |
| 포트 범위 | 5020~5119 안 · 시드된 설비 포트 안 | 없는 설비에 건 주입은 아무 일도 하지 않아 "주입했는데 변화 없음"이 결과로 기록된다 |
| 종류별 필수 값 | delay면 delayMs · exception이면 exceptionCode(Modbus 표준 예외 코드) | 값 없는 주입이 기본값으로 돈다 |
| 겹침 | 같은 포트 · 겹치는 레지스터 범위의 시간 창이 겹치면 거부 | 두 주입이 한 요청에 동시에 걸려 결과를 어느 주입에 귀속할지 가를 수 없다 |

- 검산: 검증 규칙 = **4**
- **계획 자체가 측정 기록의 실험 조건이다.** 기록 조건 칸에 계획 파일 경로와 내용 해시를 적고, SIM이 노출하는 현재 적용 주입과 대조한다(REQ-SIM-10). 노출 메트릭 이름의 정본은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)다 — sim_fault_injection_active{kind}.
- **실행 중 계획을 바꾸지 않는다.** 바꾸려면 재기동한다 — 스위치와 같은 "전환 = 재기동" 원칙이다(06_pipeline/10 판정).

## 착수 체크리스트의 도구 항목

[../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 착수 체크리스트 중 도구 항목의 실행 기준이다. 환경 항목은 [04_local_environment.md](./04_local_environment.md) §착수 전 조정이 갖는다.

| 체크리스트 | 이 문서의 확인 기준 | 불합격이면 |
|------|------|------|
| 3 pnpm 설치 | corepack 활성 · 패키지 관리자 필드의 정확 버전으로 설치 | 워크스페이스 구성 불가 |
| 7 버전 재확인 | [03_data_infra.md](./03_data_infra.md) §재확인 절차 ①~⑤ 완료 · 고정표와 잠금 파일 · 이미지 태그가 한 커밋 | 이미지 태그가 흔들려 성능 실험이 재현되지 않는다 |
| 코드 착수 — Taskfile 기본 작업 | §Taskfile 작업의 원본 5 | 스냅샷 없이 S0에 들어가 기준 데이터셋을 되돌릴 수 없다 |
| 코드 착수 — docs:lint 편입 | 로컬 스크립트를 저장소 안으로 옮기고 품질 게이트 ④에 붙인다 | 문서 드리프트가 커밋 단위로 잡히지 않는다 |

- 검산: 도구 항목 = 체크리스트 2(3 · 7) + 코드 착수 2 = **4**

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 도구 버전 전부 | 원본 미기재 — 착수 시 고정 | [03_data_infra.md](./03_data_infra.md) §버전 고정표 |
| Prisma 드리프트 검사의 파티션 처리 | 버린 대안의 실패 근거 — 공식 참조로 재확인 | [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) |
| SIM 노출 필드 · 메트릭 이름 | 계획 파일 형식은 닫힘 · 노출 이름 **W6 판정** — sim_fault_injection_active{kind} | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| CI 도입 | 선택 — 배포가 없다 | 도입 시 같은 게이트 명령 |
| 구조화 로그의 보관 · 조회 수단 | 미설계 — 현행은 컨테이너 로그를 실험 수행자가 읽는다 · 무효 구간 이벤트를 기록으로 옮기는 절차만 계약 | 코드 착수 시 · [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) |
| k6 시나리오 정의 파일 형식 · 조회 부하 도착률 | 미설계 — 모양 5종과 판정 지표만 계약 | 코드 착수 시 · [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) |
| 저장소 비밀번호 교체 절차의 작업화 | 미설계 — 순서 계약만 있다 | 코드 착수 시 · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) |

## 관련 문서

- [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) — 적용 순서 · 시드 모양
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — SIM 주입 제어 판정 · 계획 항목
- [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) — 리포지터리 구조 정본
- [04_local_environment.md](./04_local_environment.md) — 기동 명령 · 환경변수
- [03_data_infra.md](./03_data_infra.md) — 버전 고정표 · 재확인 절차
- [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) — 착수 체크리스트 · 코드 착수 항목
- [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) — bench 시나리오
