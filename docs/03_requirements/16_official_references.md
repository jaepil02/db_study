# 공식 참조 — 외부 URL 유일 등재처

> **대상**: 설계 문서군이 인용하는 외부 공식 문서 · 릴리스 노트 · 표준의 URL 전수 — 런타임 · 저장소 · 저장소 확장 · 백엔드 라이브러리 · 프론트엔드 · 도구 · 부하 · 관측 · 실행 환경 · 프로토콜 표준 · 보안 참고 · 인용처 · 재확인 규칙
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S1 반영 — 버전 고정표 37 → **38**행(Biome · Vitest 행 분리 — 두 구성요소는 이미 각자 행으로 등재돼 등재 수 불변)
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — ClickHouse 변경 이력 행의 확인 대상 25.8 → **26.8** LTS 패치 태그
> **개정일**: 2026-09-24 — 착수 체크리스트 7 반영 — 저장소 6행 확인일 채움(릴리스 · 레지스트리 대조) · ClickHouse 보안 정책 행 신설(25.x 지원 종료 확인) · Python 행 신설(버전 고정표 36 → **37**행 대응) — 등재 68 → **70** · 저장소 9 → **10** · 도구 · 부하 · 관측 13 → **14** · 미확인 68 → **63**
> **개정일**: 2026-09-24 — W7 검수 반영 — 보안 참고 10 · Compose 변수 치환 1 추가 57 → **68** · 버전 고정표 35 → **36**행 대응 · 도입문의 역링크 서술을 인용처 열 기준으로
> **원천**: [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 버전 고정표 38행 · 각 문서의 "공식 참조로 재확인" 등재 행 · 원본 tech_stack.md §12 · 원본 implementation_plan.md §9 착수 체크리스트 7번(커밋 ff66a37) · 신설

이 문서는 **외부 URL의 유일한 등재처**다. 다른 문서는 URL을 쓰지 않고 무엇을 확인해야 하는지만 적으며, 그 사실이 어느 URL로 확인되는지는 이 문서의 인용처 열이 역으로 잇는다([../CLAUDE.md](../CLAUDE.md) 외부 URL 규칙). URL을 한 자리에 모으는 이유는 하나다 — 공식 문서의 주소는 버전마다 바뀌고, 여러 문서에 흩어진 URL은 한 번에 고칠 수 없어 낡은 주소가 조용히 남는다.

**등재는 확인이 아니다.** 아래 URL은 2026-09-24 등재 시점에 접속 · 내용을 검증하지 않았다. 버전 문자열 · 기본값 · 지시자 이름은 이 문서가 아니라 각 정본이 갖고, 그 값을 공식 문서로 대조하는 일은 착수 체크리스트 7번(버전 재확인 — [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))에서 한다. 확인이 끝난 행은 §재확인 규칙대로 확인일을 채운다.

## 등재 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 공식 출처만 | 프로젝트 공식 사이트 · 공식 저장소 · 표준 기구 문서만 등재한다. 블로그 · 질의응답 사이트 · 요약 글은 등재하지 않는다 | 버전이 지난 2차 서술이 기본값의 근거가 되어 실측과 설계가 어긋난다 |
| 판(latest)보다 목록 | 버전 고정 대상은 릴리스 노트 · 변경 이력 목록을 등재한다 — 고정할 판은 버전 고정표가 정한다 | latest 문서만 보면 고정한 판과 다른 판의 동작을 근거로 삼는다 |
| 인용처 병기 | 행마다 그 URL로 무엇을 확인하는지와 인용하는 문서를 적는다 | 인용처 없는 URL은 지워도 되는지 판단할 수 없어 목록이 부풀기만 한다 |
| 확인일 | 착수 시 대조한 행은 확인일 열에 날짜를 적는다. 대조 전은 "미확인" | 확인한 값과 기억에 기댄 값을 가를 수 없다 |

- 검산: 규칙 = **4**

## 런타임

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| Node.js | 릴리스 목록 · LTS 일정 | [https://nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases) | 22 LTS의 현행 부 버전 · 22.15 이상 조건 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [13_nonfunctional.md](./13_nonfunctional.md) REQ-TEC-04 | 미확인 |
| Node.js | worker_threads 문서 | [https://nodejs.org/api/worker_threads.html](https://nodejs.org/api/worker_threads.html) | 워커 격리 · 메시지 전달 비용 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) ADR-25 | 미확인 |
| node 이미지 | 공식 이미지 | [https://hub.docker.com/_/node](https://hub.docker.com/_/node) | 22 alpine 태그 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| TypeScript | 공식 문서 · 릴리스 노트 | [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/) | 부 버전 고정 · strict 옵션 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |

- 검산: 런타임 = **4**

## 저장소

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| PostgreSQL | 릴리스 노트 목록 | [https://www.postgresql.org/docs/release/](https://www.postgresql.org/docs/release/) | 18의 현행 부 버전 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| PostgreSQL | 18 문서 | [https://www.postgresql.org/docs/18/](https://www.postgresql.org/docs/18/) | 선언적 파티션 · BRIN · COPY · 튜닝 파라미터 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) | 미확인 |
| postgres 이미지 | 공식 이미지 | [https://hub.docker.com/_/postgres](https://hub.docker.com/_/postgres) | 18 alpine 태그 · 초기화 스크립트 규약 · 시간대 데이터 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| ClickHouse | 변경 이력 | [https://clickhouse.com/docs/whats-new/changelog](https://clickhouse.com/docs/whats-new/changelog) | 26.8 LTS 패치 태그 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| ClickHouse | 문서 | [https://clickhouse.com/docs](https://clickhouse.com/docs) | MergeTree · AggregatingMergeTree · MV · Dictionary · 코덱 · TTL · insert_deduplication_token · async_insert · 서버 설정과 사용자 프로파일 설정의 수준 · merge_with_ttl_timeout 기본값 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| clickhouse-server 이미지 | 공식 이미지 | [https://hub.docker.com/r/clickhouse/clickhouse-server](https://hub.docker.com/r/clickhouse/clickhouse-server) | LTS 태그 · 설정 파일 마운트 경로 · 시간대 데이터 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| ClickHouse | 보안 정책(지원 버전 표) | [https://github.com/ClickHouse/ClickHouse/blob/master/SECURITY.md](https://github.com/ClickHouse/ClickHouse/blob/master/SECURITY.md) | 고정한 LTS 계열의 보안 지원 여부 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| Redis | 릴리스 | [https://github.com/redis/redis/releases](https://github.com/redis/redis/releases) | 8의 현행 부 버전 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |
| Redis | 문서 | [https://redis.io/docs/latest/](https://redis.io/docs/latest/) | Streams(컨슈머 그룹 · XPENDING · XAUTOCLAIM · XINFO GROUPS의 lag) · 축출 정책 volatile-lru · Pub/Sub · client-output-buffer-limit 기본값 · Lua 스크립트 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | 미확인 |
| redis 이미지 | 공식 이미지 | [https://hub.docker.com/_/redis](https://hub.docker.com/_/redis) | 8 alpine 태그 · 설정 파일 전달 방식 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 2026-09-24 |

- 검산: 저장소 = **10**

## 저장소 확장

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| pg_partman | 공식 저장소 | [https://github.com/pgpartman/pg_partman](https://github.com/pgpartman/pg_partman) | 부 버전 · 미리 만들기 개수 기본값 · 백그라운드 워커 주기 기본값 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 미확인 |
| pg_stat_statements | PostgreSQL 동봉 모듈 문서 | [https://www.postgresql.org/docs/current/pgstatstatements.html](https://www.postgresql.org/docs/current/pgstatstatements.html) | 공유 라이브러리 적재 설정 | [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) | 미확인 |
| auto_explain | PostgreSQL 동봉 모듈 문서 | [https://www.postgresql.org/docs/current/auto-explain.html](https://www.postgresql.org/docs/current/auto-explain.html) | 계획 로깅 문턱 설정 | [../10_observability/02_instrumentation.md](../10_observability/02_instrumentation.md) | 미확인 |

- 검산: 저장소 확장 = **3**

## 백엔드 라이브러리

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| NestJS | 공식 문서 | [https://docs.nestjs.com/](https://docs.nestjs.com/) | 11.x · Fastify 어댑터 · DI 커스텀 프로바이더(스위치 포트) | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) · [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) | 미확인 |
| NestJS | 릴리스 | [https://github.com/nestjs/nest/releases](https://github.com/nestjs/nest/releases) | 부 버전 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| @clickhouse/client | 공식 문서 | [https://clickhouse.com/docs/integrations/javascript](https://clickhouse.com/docs/integrations/javascript) | 1.x · zstd 요청 압축 지원 여부 · 파라미터 바인딩 · 스트리밍 응답 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| @clickhouse/client | 공식 저장소 | [https://github.com/ClickHouse/clickhouse-js](https://github.com/ClickHouse/clickhouse-js) | 릴리스 · 런타임 하한 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| ioredis | 공식 저장소 | [https://github.com/redis/ioredis](https://github.com/redis/ioredis) | 5.x · 구독 연결 분리 · 파이프라인 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) | 미확인 |
| pg(node-postgres) | 공식 문서 | [https://node-postgres.com/](https://node-postgres.com/) | 8.x · 풀 설정 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 미확인 |
| pg-copy-streams | 공식 저장소 | [https://github.com/brianc/node-pg-copy-streams](https://github.com/brianc/node-pg-copy-streams) | 부 버전 · COPY FROM STDIN 스트림 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) · [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) | 미확인 |
| modbus-serial | 공식 저장소 | [https://github.com/yaacov/node-modbus-serial](https://github.com/yaacov/node-modbus-serial) | 8.x · TCP 클라이언트 타임아웃 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) | 미확인 |
| jsmodbus | 공식 저장소 | [https://github.com/Cloud-Automation/node-modbus](https://github.com/Cloud-Automation/node-modbus) | 4.x · TCP 서버 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) | 미확인 |
| msgpackr | 공식 저장소 | [https://github.com/kriszyp/msgpackr](https://github.com/kriszyp/msgpackr) | 1.x · 레코드 확장 사용 여부 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) | 미확인 |
| piscina | 공식 저장소 | [https://github.com/piscinajs/piscina](https://github.com/piscinajs/piscina) | 5.x · 대기열 · 워커 수 설정 | [../09_tech_stack/02_backend.md](../09_tech_stack/02_backend.md) | 미확인 |
| prom-client | 공식 저장소 | [https://github.com/siimon/prom-client](https://github.com/siimon/prom-client) | 15.x · 기본 메트릭의 이벤트 루프 지연 분위수(p95 미제공 여부) | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) | 미확인 |
| @fastify/helmet | 공식 저장소 | [https://github.com/fastify/fastify-helmet](https://github.com/fastify/fastify-helmet) | 보안 헤더 플러그인 부 버전 · 기본 헤더 집합 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 미확인 |

- 검산: 백엔드 라이브러리 = **13**

## 프론트엔드

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| Next.js | 공식 문서 | [https://nextjs.org/docs](https://nextjs.org/docs) | 15.x · App Router · Route Handler · 서버 fetch 캐시 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) · [../07_api/01_conventions.md](../07_api/01_conventions.md) | 미확인 |
| Next.js | 릴리스 | [https://github.com/vercel/next.js/releases](https://github.com/vercel/next.js/releases) | 부 버전 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) | 미확인 |
| TanStack Query | 공식 문서 | [https://tanstack.com/query/latest](https://tanstack.com/query/latest) | 5.x · 기본 재조회 트리거 · staleTime · gcTime 기본값 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| uPlot | 공식 저장소 | [https://github.com/leeoniya/uPlot](https://github.com/leeoniya/uPlot) | 1.6 · 스트리밍 갱신 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| Apache ECharts | 공식 사이트 | [https://echarts.apache.org/](https://echarts.apache.org/) | 5.5 · 대용량 렌더링 옵션 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| Zustand | 공식 저장소 | [https://github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) | 부 버전 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| React Hook Form | 공식 사이트 | [https://react-hook-form.com/](https://react-hook-form.com/) | 부 버전 · zod 연결 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| Tailwind CSS | 공식 문서 | [https://tailwindcss.com/docs](https://tailwindcss.com/docs) | 부 버전 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| shadcn/ui | 공식 문서 | [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs) | 컴포넌트 복사 절차 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) | 미확인 |
| zod | 공식 사이트 | [https://zod.dev/](https://zod.dev/) | 부 버전 · 공유 스키마 | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |

- 검산: 프론트엔드 = **10**

## 도구 · 부하 · 관측

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| pnpm | 공식 사이트 | [https://pnpm.io/](https://pnpm.io/) | 워크스페이스 · 패키지 관리자 필드 고정 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Biome | 공식 사이트 | [https://biomejs.dev/](https://biomejs.dev/) | 부 버전 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Vitest | 공식 사이트 | [https://vitest.dev/](https://vitest.dev/) | 부 버전 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Supertest | 공식 저장소 | [https://github.com/ladjs/supertest](https://github.com/ladjs/supertest) | 부 버전 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Testcontainers for Node.js | 공식 문서 | [https://node.testcontainers.org/](https://node.testcontainers.org/) | 부 버전 · 모듈(PostgreSQL · Redis · ClickHouse) | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| node-pg-migrate | 공식 문서 | [https://salsita.github.io/node-pg-migrate/](https://salsita.github.io/node-pg-migrate/) | 부 버전 · 원시 SQL 마이그레이션 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) | 미확인 |
| Prisma Migrate | 공식 문서 | [https://www.prisma.io/docs/orm/prisma-migrate](https://www.prisma.io/docs/orm/prisma-migrate) | 개발 명령의 드리프트 검사가 마이그레이션 이력 밖 파티션을 어떻게 다루는가 — 버린 대안의 실패 근거 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) · [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) | 미확인 |
| Task | 공식 사이트 | [https://taskfile.dev/](https://taskfile.dev/) | 부 버전 · Taskfile 문법 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Python | 릴리스 목록 | [https://www.python.org/downloads/](https://www.python.org/downloads/) | 3.14의 현행 부 버전 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) | 미확인 |
| Docker Compose | 공식 문서 | [https://docs.docker.com/compose/](https://docs.docker.com/compose/) | v2 부 버전 · 리소스 제한(deploy.resources) · cpuset · healthcheck · profiles 문법 | [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) | 미확인 |
| Docker Compose 변수 치환 | 공식 문서 | [https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) | .env 값의 접속 문자열 치환 · 미설정 변수 처리 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) | 미확인 |
| k6 | 공식 문서 | [https://grafana.com/docs/k6/latest/](https://grafana.com/docs/k6/latest/) | v1.x · 시나리오 실행기 · Prometheus 원격 쓰기 출력 | [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) | 미확인 |
| Prometheus | 공식 문서 | [https://prometheus.io/docs/](https://prometheus.io/docs/) | 3.x · 규칙 파일 · 원격 쓰기 수신 기능 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md) | 미확인 |
| Grafana | 공식 문서 | [https://grafana.com/docs/grafana/latest/](https://grafana.com/docs/grafana/latest/) | 12.x · 대시보드 프로비저닝 형식 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) · [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md) | 미확인 |

- 검산: 도구 · 부하 · 관측 = **14**

## 실행 환경

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| WSL 설정 | 공식 문서 | [https://learn.microsoft.com/en-us/windows/wsl/wsl-config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config) | .wslconfig 메모리 · 프로세서 · swap 지시자 이름 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) | 미확인 |
| WSL 네트워킹 | 공식 문서 | [https://learn.microsoft.com/en-us/windows/wsl/networking](https://learn.microsoft.com/en-us/windows/wsl/networking) | networkingMode=mirrored의 루프백 · 포트 노출 동작 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) · [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) | 미확인 |

- 검산: 실행 환경 = **2**

## 프로토콜 표준

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| Modbus | 공식 규격 목록 | [https://modbus.org/specs.php](https://modbus.org/specs.php) | 응용 프로토콜 · TCP 규격 — 기능 코드 · 레지스터 영역 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) · [05_plc_sim.md](./05_plc_sim.md) | 미확인 |
| MessagePack | 규격 | [https://msgpack.org/](https://msgpack.org/) | 형식 규격 · 확장 타입 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) | 미확인 |
| JWT | RFC 7519 | [https://www.rfc-editor.org/rfc/rfc7519](https://www.rfc-editor.org/rfc/rfc7519) | 등록 클레임 · 만료 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | 미확인 |
| WebSocket | RFC 6455 | [https://www.rfc-editor.org/rfc/rfc6455](https://www.rfc-editor.org/rfc/rfc6455) | 종료 코드 영역(4000~4999 응용 사용) · Origin 헤더 | [../07_api/11_websocket.md](../07_api/11_websocket.md) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 미확인 |

- 검산: 프로토콜 표준 = **4**

## 보안 참고

| 대상 | 종류 | URL | 확인할 것 | 인용처 | 확인일 |
|------|------|------|------|------|------|
| OWASP Password Storage Cheat Sheet | 보안 참고 | [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Argon2id 채택 근거 · 비용 파라미터 하한 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | 미확인 |
| Argon2 | RFC 9106 | [https://www.rfc-editor.org/rfc/rfc9106](https://www.rfc-editor.org/rfc/rfc9106) | Argon2id 매개변수 정의 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | 미확인 |
| PHC 문자열 형식 | 규격 | [https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md) | 해시 저장 형식 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) | 미확인 |
| 쿠키 · SameSite | IETF 초안 rfc6265bis | [https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/](https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/) | same-site 판정이 포트를 보지 않는다는 점 · SameSite 속성 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 미확인 |
| CORS | Fetch 표준 | [https://fetch.spec.whatwg.org/#http-cors-protocol](https://fetch.spec.whatwg.org/#http-cors-protocol) | 사전 요청 · 자격 증명 동반 요청의 허용 오리진 규칙 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) | 미확인 |
| Next.js CLI | 공식 문서 | [https://nextjs.org/docs/app/api-reference/cli/next](https://nextjs.org/docs/app/api-reference/cli/next) | 개발 서버 호스트 이름 인자 · 기본 바인드 인터페이스 | [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) | 미확인 |
| Next.js 환경변수 | 공식 문서 | [https://nextjs.org/docs/app/guides/environment-variables](https://nextjs.org/docs/app/guides/environment-variables) | NEXT_PUBLIC_ 접두 변수의 번들 포함 | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) | 미확인 |
| Docker 포트 publish와 방화벽 | 공식 문서 | [https://docs.docker.com/engine/network/packet-filtering-firewalls/](https://docs.docker.com/engine/network/packet-filtering-firewalls/) | publish 포트가 호스트 방화벽을 우회하는 동작 · 127.0.0.1 바인드 | [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) | 미확인 |
| Redis 보안 | 공식 문서 | [https://redis.io/docs/latest/operate/oss_and_stack/management/security/](https://redis.io/docs/latest/operate/oss_and_stack/management/security/) | requirepass · protected mode · ACL | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) · [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md) | 미확인 |
| ClickHouse Dictionary 소스 | 공식 문서 | [https://clickhouse.com/docs/sql-reference/dictionaries](https://clickhouse.com/docs/sql-reference/dictionaries) | PostgreSQL 소스 자격 증명 설정 방식 | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) | 미확인 |

- 검산: 보안 참고 = **10**

## 검산

- 검산: 등재 = 런타임 4 + 저장소 10 + 저장소 확장 3 + 백엔드 라이브러리 13 + 프론트엔드 10 + 도구 · 부하 · 관측 14 + 실행 환경 2 + 프로토콜 표준 4 + 보안 참고 10 = **70**
- **버전 고정표 38행이 모두 이 문서의 행 하나 이상에 닿는다**(Fastify 어댑터는 NestJS 문서 행 · 비밀번호 해시 라이브러리는 라이브러리 미선정이라 Argon2 RFC 9106 행 — 선정 시 그 공식 저장소 행을 더한다) — 고정표의 묶음 행(Zustand · React Hook Form · Tailwind CSS · Biome · Vitest · Supertest · Testcontainers)은 구성요소마다 한 행씩 나눠 등재했다. 해당 없음 행(shadcn/ui)도 복사 절차 확인을 위해 등재한다. pg_stat_statements · auto_explain은 엔진을 따르므로 버전이 아니라 적재 설정을 확인한다.
- **등재했지만 대부분 확인하지 않았다** — 확인일 열 확인 7(저장소 릴리스 · 이미지 · ClickHouse 보안 정책 — 착수 체크리스트 7번 · 2026-09-24) + 미확인 63 = **70**. 나머지 대조는 각 구성요소를 쓰는 단계의 착수 때 한다.

## 재확인 규칙

| 단계 | 내용 |
|------|------|
| ① 대조 | 착수 체크리스트 7번에서 버전 고정 대상 행의 URL로 현행 안정 판을 확인하고 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) 버전 고정표의 상태 열을 갱신한다 |
| ② 기본값 | "공식 참조로 재확인"이 등재된 기본값(pg_partman 미리 만들기 · merge_with_ttl_timeout · TanStack Query 재조회 트리거 · prom-client 이벤트 루프 분위수 · client-output-buffer-limit · @clickhouse/client zstd)을 대조하고, 결과를 그 값의 정본 문서에 쓴다 — 이 문서에 값을 쓰지 않는다 |
| ③ 확인일 | 대조한 행의 확인일 열에 날짜를 적는다 |
| ④ 주소 변경 | 주소가 바뀌었으면 이 문서의 행만 고친다 — 다른 문서는 이 문서를 링크하므로 따라 고칠 곳이 없다 |

- 검산: 단계 = **4**

## 관련 문서

- [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) — 버전 고정표(버전 문자열 유일 기재처)
- [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) — 착수 체크리스트 7번 버전 재확인
- [13_nonfunctional.md](./13_nonfunctional.md) — REQ-TEC-04 버전 고정
- [../CLAUDE.md](../CLAUDE.md) — 외부 URL 규칙
