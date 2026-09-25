# 데이터 인프라와 버전 고정표

> **대상**: 저장소 3종(PostgreSQL · ClickHouse · Redis)의 이미지 · 확장 · 설정 파일의 모양 · ClickHouse 서버 timezone 판정 · pg_partman 미리 만들기 · TTL 머지 주기 · Compose healthcheck와 health 타임아웃의 관계 · **observability 프로파일 구성원 판정(보정 #17)** · **버전 고정표(버전 문자열의 유일한 기재처)**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S3 착수 반영 — 2행 고정 — pg_partman **5.5**(파생 이미지 db_study-postgres:18.6-partman5.5.0 · 소스 빌드) · pg-copy-streams **7.0** — 버전 고정 24 → **26** · 미고정 4 → **2** · 미확인 닫힘 2(pg_partman 기본값 — 미리 만들기 4 확인 · 워커 주기 3600초 명시 · 설치 경로 — 파생 이미지) · 확장 생성 자리 마이그레이션 001 · 004 → **migrate 관리자 단계**(확장 생성에 superuser 필요) · 등록 004 · 007
> **개정일**: 2026-09-25 — S2 실측 반영(EXP-30 기록 012 · d32b09a) — msgpackr-extract S1 판정 끔 → **끔 유지(S2 재판정 → S5)**
> **개정일**: 2026-09-24 — S2 착수 반영 — 13행 고정 — Fastify 어댑터 **11.2** · @clickhouse/client **1.23** · ioredis **5.11** · pg **8.23** · modbus-serial **8.0** · jsmodbus **4.0** · Next.js **15.5** · uPlot **1.6** · TanStack Query **5.103** · Zustand · Tailwind CSS **5.0 · 4.3** · Supertest **7.3** · node-pg-migrate **9.0** · k6 **1.8** — 버전 고정 11 → **24** · 재확인 대기 15 → **5** · 미고정 7 → **4** · zstd 요청 압축 미확인 닫힘
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — S1 착수 9행 고정 — Node **22.23** · api 기반 이미지 **node:22.23.3-alpine** · TypeScript **5.9** · NestJS **11.2** · msgpackr **1.12** · piscina **5.3** · prom-client **15.1** · zod **4.6** · pnpm **12.6** — 태그 고정 3 → **4** · 버전 고정 2 → **11** · 재확인 대기 21 → **15** · 미고정 10 → **7** · Biome · Vitest 행을 Supertest · Testcontainers와 갈라 행 37 → **38**(도구 6 → **7**) · TypeScript 7 · NestJS 12 · msgpackr 2 · ioredis 6 미채택 판정 · msgpackr-extract 끔 등재
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — ClickHouse 태그 고정 25.8.33.6 → **26.8.10.6**(26.8 계열 최신 패치 · 레지스트리 대조) · 스택 표기 26.8 · 미확인 "LTS 트랙 보안 지원 종료" 닫힘 · 사용자 프로파일 트리에 input_format_read_datetime_number_as_raw_value · 설정 수준 확인 문장에 26.8 재확인
> **개정일**: 2026-09-24 — 착수 체크리스트 7 · Python 반영 — 저장소 3행 릴리스 노트 · 레지스트리 대조 완료(18.6 · 8.10.2 계열 최신 · 25.8.33.6은 25.8 계열 최신이나 **25.x 보안 지원 종료**) · Python 행 신설(**버전 고정** 3.14 · 사용자 지정) — 행 36 → **37** · 도구 5 → **6** · 버전 고정 1 → **2** · 미확인 등재에 ClickHouse LTS 전환 신설
> **개정일**: 2026-09-24 — S0 실측 반영 — 사용자 프로파일 설정 트리에 deduplicate_blocks_in_dependent_materialized_views 추가(ADR-14 보강 · 기록 001) · alpine 시간대 데이터 미확인 닫힘(PostgreSQL alpine · ClickHouse 모두 Asia/Seoul 해석) · Task 행 미고정 → **버전 고정** 3.53 — 상태 미고정 11 → **10** · 버전 고정 **1** 신설
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 관측 스택 cpuset 18-19 → 13(현행 측정 머신 배치) · 저장소 이미지 3행 태그 고정(18.6-alpine · 25.8.33.6 · 8.10.2-alpine — 레지스트리 확인 · 릴리스 노트 대조 대기) · 상태 재확인 대기 24 → **21** · 태그 고정 **3** 신설 · ClickHouse 설정 트리를 실제 적용 수준으로 교정(max_concurrent_queries · background_pool_size 서버 · parts_to_* merge_tree) · pg_partman 공식 이미지 미포함 등재 · ClickHouse 설정 트리에 풀 파생 여유 슬롯 문턱 3 추가
> **개정일**: 2026-09-24 — 최종 정밀 검수 — §조정값 현행값 → §화면 조정값 현행값(절 이름 교정)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — Redis 설정 바인드 · 보호 모드 행에 **requirepass 필수** 명시 · 버전 고정표에 Argon2id 해시 라이브러리 행 추가 35 → **36**(백엔드 12 → **13** · 미고정 10 → **11**)(정본 12_security/01 · 02)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 tech_stack.md §2 · §5 · §9 · §10.1 · §10.4 · §12(커밋 ff66a37) · 원본 architecture.md §3 · §7.5 · §13 · §14(커밋 ff66a37) · 원본 implementation_plan.md §2.1 · §9(커밋 ff66a37) · ADR-03 · ADR-05 · ADR-18 · ADR-19 · ADR-20 · docs_plan 실행 계획 보정 #17 · 웨이브 인계 W6 09_tech_stack 행(ClickHouse 서버 timezone · pg_partman 미리 만들기 · TTL 머지 주기 · healthcheck timeout) · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · [../07_api/10_metrics.md](../07_api/10_metrics.md) §저장소 확인과 타임아웃 판정

이 문서는 **정확 버전이 적히는 유일한 자리**다. 다른 문서는 스택을 Next.js · NestJS · PostgreSQL 18 · ClickHouse 26.8 · Redis 8 · Docker Compose로만 적고 이미지 태그 · 라이브러리 메이저는 §버전 고정표를 링크한다. 같은 폴더의 01 · 02 · 05도 버전을 적지 않는다 — 버전이 두 자리에 적히면 착수 시점 재확인이 한 자리만 고친다.

**저장소 내부 설정 값의 정본은 이 문서가 아니다.** PostgreSQL 튜닝 값은 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §튜닝 파라미터, ClickHouse 서버 설정은 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §서버 설정 계약, Redis maxmemory · MAXLEN은 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)가 갖는다. 이 문서는 **설정 파일의 모양**과 인계로 넘어온 판정 넷(ClickHouse 서버 timezone · pg_partman 미리 만들기 · TTL 머지 주기 · healthcheck timeout)과 관측 프로파일 구성원 판정을 갖는다.

**버전은 원본 기준이다.** 아래 표의 모든 버전은 원본 설계서(2026-09-09 작성)가 적은 기준이며, **착수 시점에 공식 릴리스 노트로 최신 안정 버전을 재확인하기 전까지 확정 태그가 아니다**(REQ-TEC-04 · 원본 implementation_plan.md §9 착수 체크리스트 7번). 릴리스 노트의 URL은 공식 참조 — [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)(W7 등재)에 둔다.

## 저장소 이미지

| 서비스 | 이미지 계열 | 선택 이유 | 버리는 것 | 어기면 |
|------|------|------|------|------|
| postgres | PostgreSQL 공식 이미지 alpine 변형 | 버전 고정 · 설정 직접 제어(원본 tech_stack.md §10.1) | 호스트 직접 설치 | 호스트 패키지 갱신이 엔진 버전을 조용히 바꿔 같은 커밋의 두 측정이 다른 엔진에서 돈다 |
| clickhouse | ClickHouse 공식 서버 이미지 · LTS 트랙 | LTS는 패치만 받아 실험 기간 중 동작 변경이 작다 | stable 트랙 월간 릴리스 | 월간 릴리스를 따라가면 MV · 중복 제거 동작이 실험 도중 바뀐다 |
| redis | Redis 공식 이미지 alpine 변형 | Streams · Pub/Sub · Lua · volatile-lru를 한 인스턴스에서(ADR-05) | Valkey 대체(원본 비고 "대체 가능") | 대체하면 엔진이 바뀐 것이라 대체 전후 수치를 한 실험으로 묶을 수 없다 — **현행 범위에서 대체하지 않는다** |
| api 기반 이미지 | Node LTS alpine · 멀티스테이지 빌드 | 호스트와 같은 LTS 메이저(REQ-TEC-04) | 런타임 전용 이미지의 다른 배포판 | 네이티브 의존(압축 · 해시)의 libc 차이가 호스트 테스트와 컨테이너 실행을 가른다 |

- 검산: 이미지 = **4** — 저장소 3 + 로컬 빌드 1(api)
- **모든 태그를 명시하고 latest를 쓰지 않는다.** 태그 값은 §버전 고정표 한 자리에만 적는다.
- **공식 이미지의 alpine 변형은 로케일 · 시간대 데이터가 최소 구성이다.** 서버 timezone을 이름으로 줄 때 시간대 데이터베이스가 이미지에 들어 있는지 착수 시 확인한다(공식 참조 — 03_requirements/16 W7 등재). 없으면 기동은 되지만 시간대 이름이 해석되지 않아 기동 로그에 오류가 남는다. **S0 확인(2026-09-24) — PostgreSQL alpine 이미지(TimeZone)와 ClickHouse 이미지(timezone()) 모두 Asia/Seoul을 해석한다.**

## PostgreSQL 확장과 설정 파일

| 확장 | 용도 | 로드 방식 | 생성 자리 | 없으면 |
|------|------|------|------|------|
| pg_stat_statements | 쿼리 통계 — OBS가 느린 쿼리 Top-N을 읽는다 | 서버 시작 시 선적재 라이브러리 | 마이그레이션 001 | 업무 CRUD p95의 원인 쿼리를 가를 수 없다 |
| pg_partman | alarm_event 월 파티션 · 대조군 일 파티션 미리 만들기 · 보존 · 유지 작업 | 확장 + 백그라운드 워커(선적재) | migrate 관리자 단계에서 생성(partman 스키마 · 확장 생성은 superuser만 된다) · 마이그레이션 004 · 007에서 등록 | 파티션 없는 달의 INSERT가 기본 파티션으로 간다 |
| auto_explain | 느린 쿼리 계획 로깅 | 서버 시작 시 선적재 라이브러리 | 설정 파일 | 대조군 쿼리가 느려진 순간의 계획이 남지 않는다 |

- 검산: 확장 = **3**(원본 tech_stack.md §5.1) · 선적재 라이브러리 = pg_stat_statements · auto_explain · pg_partman 백그라운드 워커 = **3**
- 확장 생성 순서의 정본은 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §저장소 간 적용 순서 ①이다.

설정 파일은 infra/postgres/ 아래 하나이며 모양은 아래와 같다. 값은 소유처의 현행 참고를 옮긴 것이고 여기서 바꾸지 않는다.

```plain
infra/postgres/postgresql.conf
├── 선적재           shared_preload_libraries = pg_stat_statements · auto_explain · pg_partman 백그라운드 워커
├── 메모리           shared_buffers · effective_cache_size · work_mem · maintenance_work_mem   ← 05_data_stores/01 소유 · 프로파일별
├── 접속             max_connections                                                       ← 05_data_stores/02 소유
├── WAL · 체크포인트  wal_compression · checkpoint_timeout                                  ← 05_data_stores/01 소유
├── 플래너           random_page_cost                                                      ← 05_data_stores/01 소유
├── 시간대           timezone = Asia/Seoul                                                 ← 05_data_stores/01 소유 · 월 파티션 경계
└── pg_partman 워커  대상 DB · 유지 작업 주기                                                ← 이 문서 §pg_partman
```

- **프로파일별 값은 파일을 프로파일마다 두지 않고 포함 파일 하나로 가른다.** 본 파일은 공통 값만 갖고, 메모리 계열 4값은 프로파일 포함 파일에서 덮어쓴다 — 본 파일에 메모리 값이 섞이면 프로파일을 바꿔도 한 값이 남아 조건 칸과 실제 설정이 어긋난다.
- **선적재 라이브러리는 재시작으로만 바뀐다.** 설정 재적재로 바뀌지 않으므로 확장 추가는 postgres 재시작을 동반하는 변경이며 실험 중에 하지 않는다(REQ-TEC-15와 같은 이유).

## pg_partman 미리 만들기와 유지 작업

인계 "pg_partman 미리 만들기 개수"를 닫는다. **판정 — 미리 만들기는 도구 기본값(4개월로 알려져 있으나 원본 미기재 — 착수 시 공식 참조로 확인)을 쓰고, 유지 작업은 pg_partman 백그라운드 워커가 1시간 주기로 돌린다.** 두 값 모두 2계층 조정값이며 소유는 이 문서다. 파티션 결정 전체의 정본은 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) §alarm_event 월 파티션이다.

| 조정값 | 조회 계약 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 |
|------|------|------|------|------|------|
| 미리 만들기 개수 | 현재 월 이후 N개월의 파티션이 항상 있다 | 유지 작업 실행 시각(Asia/Seoul 달력) | 월초에 사람이 손으로 파티션 생성 | 기본 파티션에 적재되고 그 달 파티션 생성이 충돌한다 | 도구 기본값 4(5.5.0 part_config.premake 확인 · 2026-09-25) |
| 유지 작업 주기 | 백그라운드 워커가 주기마다 미리 만들기 · 분리 대상 판정을 돈다 | 워커 기동 시각부터 | 애플리케이션 타이머 · 호스트 cron | 미리 만든 개수가 소진될 때까지 알 수 없다 | 3600초(postgresql.conf pg_partman_bgw.interval에 명시 — 도구 기본값에 기대지 않는다 · 대상 DB plc · 실행 역할 app_owner) |

- 검산: 조정값 = **2**
- **개수 하한의 산술** — 미리 만든 달 수 × 1개월이 유지 작업 주기보다 길기만 하면 미래 파티션이 비지 않는다. 4개월 대 1시간이라 여유가 크고, 개수를 늘려도 빈 파티션 메타만 는다. **값을 줄이는 방향만 위험하다** — 0이면 매월 1일 00:00 KST 직후 워커가 돌기 전까지의 알람이 기본 파티션으로 간다.
- **시간 압축 생성(모드 B · C)이 과거 ts를 만들면 미리 만들기와 무관하게 기본 파티션으로 간다.** 미리 만들기는 미래 방향만 채운다. 이 경우의 판정 — 기본 파티션이 비어 있지 않으면 이상 신호(05_data_stores/02)다.

## ClickHouse 설정 파일과 서버 timezone

설정 파일은 infra/clickhouse/config.d/ 아래 조각 파일로 둔다. 서버 기본 설정 파일을 통째로 바꾸지 않는다 — 이미지 버전을 올릴 때 기본 파일의 신설 항목이 사라진다.

```plain
infra/clickhouse/
├── config.d/
│   ├── memory.xml         max_server_memory_usage_to_ram_ratio            ← 05_data_stores/03 소유
│   ├── server.xml         max_concurrent_queries · background_pool_size · merge_tree(parts_to_delay_insert · parts_to_throw_insert · 풀 파생 여유 슬롯 문턱 3) · TTL 머지 주기   ← 05_data_stores/03 · 이 문서 §TTL 머지 주기
│   ├── timezone.xml       서버 timezone = Asia/Seoul                      ← 이 문서 판정
│   └── prometheus.xml     내장 메트릭 엔드포인트 9363
├── users.d/
│   └── profiles.xml       async_insert · max_insert_block_size · materialized_views_ignore_errors · deduplicate_blocks_in_dependent_materialized_views · input_format_read_datetime_number_as_raw_value   ← 05_data_stores/03 소유
└── ddl/                   순번 DDL 001~                                    ← 05_data_stores/09 소유
```

- **서버 설정과 사용자 프로파일 설정을 가른다.** 메모리 비율 · 머지 풀 · 동시 쿼리 상한 · timezone은 서버 수준이고, 파트 수 문턱은 서버 설정의 merge_tree 절이며, 삽입 방식 · 블록 크기 · MV 오류 처리는 사용자 프로파일 수준이다 — 한 파일에 섞으면 적용 수준이 다른 설정이 조용히 무시된다. **수준은 25.8.33.6 이미지의 기본 설정 파일로 확인했고 26.8.10.6에서 같은 파일로 기동을 재확인했다(2026-09-24)** — 초판 트리는 동시 쿼리 상한 · 파트 수 문턱을 사용자 프로파일에 두었다.
- 설정 조각의 이름은 설계 계약이며 파일 이름 형식은 구현이 정한다.

### 서버 timezone 판정

인계 "ClickHouse 서버 시간대 설정"을 닫는다(웨이브 인계 W1 · W6 행 · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) 미확인 등재). **판정 — 서버 timezone을 Asia/Seoul로 명시한다.**

| 안 | 내용 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 설정하지 않음 | 컨테이너 기본(공식 이미지는 UTC로 알려짐 — 착수 시 확인)을 따른다 | 시간대 인자 없는 수동 쿼리(now()의 날짜 · toDate · toStartOfDay를 인자 없이)가 UTC 달력을 써, 사람이 CLI로 "오늘 행 수"를 세면 KST 00:00~09:00의 행이 어제로 간다 — 대조 쿼리의 일 경계가 PostgreSQL(Asia/Seoul)과 9시간 어긋난다 | 버림 |
| ② UTC 명시 | 서버 설정에 UTC | ①과 같은 실패를 명시적으로 고정한다 · 시스템 로그 테이블(query_log 등)의 이벤트 시각 표시가 PostgreSQL 로그 · 화면 KST와 9시간 어긋나 측정 구간을 맞추는 수작업이 매 실험 생긴다 | 버림 |
| ③ **Asia/Seoul 명시** | 서버 설정에 Asia/Seoul | 서버 설정이 스키마에 새지 않으므로 잃는 것이 없다 — 컬럼은 전부 시간대를 명시한다(05_data_stores/03 §시각 컬럼 시간대 표기) | **채택** |

- 검산: 안 = **3**
- **서버 timezone은 저장값을 바꾸지 않는다.** 저장은 epoch이고 컬럼 시간대 · 서버 시간대는 표시 · 파싱 · 달력 함수 경계만 바꾼다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)). 그래서 이 판정은 스키마 · 적재 · 보존 어디에도 파급이 없고 **수동 쿼리와 시스템 테이블 표시만** 바꾼다.
- **달력 경계 시간대 Asia/Seoul은 시스템 단일 값이다** — PostgreSQL DB 기본 timezone · alarm_event 월 파티션 경계 · ClickHouse 컬럼 시간대 · 서버 timezone이 같은 값을 쓴다. 한 자리만 다르면 "같은 날"의 정의가 저장소마다 갈린다.
- **B형 — 서버 timezone을 Asia/Seoul로 두어도 적재 쪽 시각 해석은 그대로다.** 결론 — 적재는 epoch 정수로 보내 파싱에 시간대가 개입하지 않는다(05_data_stores/03). 반대 시나리오 — 이 판정을 근거로 적재가 문자열 시각을 보내기 시작하면 보내는 쪽 시간대와 컬럼 시간대가 어긋난다. 파생 지침 — 서버 timezone은 사람의 쿼리를 위한 설정이고 적재 계약은 epoch 정수를 유지한다.

### TTL 머지 주기

인계 "TTL 머지 주기"를 닫는다. 보존 정책의 정본은 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md)이며 이 문서는 머지 주기 한 값만 갖는다. **판정 — 서버 기본값을 유지하고 값을 줄이지 않는다.**

| 조정값 | 조회 계약 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 |
|------|------|------|------|------|------|
| TTL 머지 최소 간격(merge_with_ttl_timeout) | 한 파티션의 TTL 머지가 이 간격보다 자주 돌지 않는다 · 파트 전체 만료면 파트를 통째로 지운다(ttl_only_drop_parts) | 직전 TTL 머지 시각 | ALTER TABLE … DELETE · 경량 DELETE로 보존을 대신 | 서버 기본값 | 서버 기본값(4시간으로 알려져 있으나 원본 미기재 — 착수 시 공식 참조로 확인) |

- **TTL 삭제 검증 시점 = 보존 기간 + 파티션 폭 + 이 간격 이후다.** 보존 직후에 확인하면 거짓 실패다(05_data_stores/08). 이 간격을 모르고 검증하면 "TTL이 동작하지 않는다"는 거짓 결함 보고가 나온다.
- **간격을 줄이지 않는 이유 — 머지 풀을 삽입과 나눠 쓴다.** TTL 머지는 background_pool_size 안에서 돈다. 간격을 줄이면 삭제할 것이 없는 파티션까지 자주 검사해 적재 부하 실험 중의 머지 큐 길이가 TTL 설정에 따라 달라진다 — 적재 실험이 보존 설정을 재게 된다.
- **파티션 삭제 지연은 3계층 미확인이다** — 미확인 · 확정 전 임의 값 고정 금지. 실측 자리는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP-29(AC-13 TTL 삭제)다.

## Redis 설정 파일

설정 파일은 infra/redis/redis.conf 하나다. 값의 정본은 [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)이고, 프로파일별 값(maxmemory)은 기동 인자로 덮어쓴다.

| 설정 | 모양 | 소유처 | 이 설정이 없으면 |
|------|------|------|------|
| maxmemory | 프로파일별 값 · 기동 인자로 주입 | 05_data_stores/06 | 컨테이너 상한에 먼저 닿아 OOM Killer가 Redis를 죽인다 — Stream 미소비분이 AOF 마지막 fsync 이후만큼 사라진다 |
| maxmemory-policy | volatile-lru 고정 | ADR-05 | 기본 정책(noeviction)이면 캐시 팽창만으로 XADD가 실패해 백프레셔가 캐시 때문에 발동한다 |
| appendonly · appendfsync | yes · everysec | ADR-05 · 05_data_stores/06 | 재기동 시 미소비 Stream 엔트리 · PEL이 사라진다 |
| client-output-buffer-limit pubsub | 명시 값 필수 · 값 미정 | 이 문서(값) · [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md)(계약) | 기본값을 쓰면 느린 구독 연결이 끊기는 기준이 설계 밖에서 정해진다 — **기본값 사용 금지** |
| 바인드 · 보호 · 인증 | 컨테이너 네트워크 안 접속 · 호스트 publish는 127.0.0.1 · **requirepass 필수**(값 REDIS_PASSWORD — 설정 파일에 값을 쓰지 않고 기동 인자로 주입) | ADR-18 · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) | 127.0.0.1 바인드는 LAN만 막는다 — 비밀번호가 없으면 같은 머신의 어느 프로세스든 6379에 붙어 봉인 계열을 FLUSH한다(12_security/05) |

- 검산: 설정 = **5**
- **Pub/Sub 출력 버퍼 한도는 값이 정해지지 않았다.** 계약은 "WebSocket 게이트웨이의 소켓 송신 대기량 한도보다 늦게 끊는다"다 — Redis가 먼저 끊으면 api 구독 연결 하나가 끊겨 모든 브라우저의 실시간 값이 한꺼번에 멈추고, 게이트웨이가 먼저 끊으면 느린 브라우저 하나만 끊긴다(07_api/11 소켓 단위 종료). 값은 S4에서 소켓 송신 대기량 한도와 같은 변경 단위로 정한다(§미확인 · 미설계 등재).

## Compose healthcheck와 health 타임아웃

인계 "Compose healthcheck timeout > health 저장소 타임아웃(현행 1,000 ms)"을 닫는다. **판정 — Compose healthcheck timeout은 health 저장소 타임아웃의 3배로 둔다.** health 쪽 값의 정본은 [../07_api/10_metrics.md](../07_api/10_metrics.md) §저장소 확인과 타임아웃 판정이고, Compose 쪽 값의 정본은 이 문서다. **두 값은 같은 변경 단위에서 함께 고친다.**

| 서비스 | 확인 동작 | interval | timeout | retries | start_period | 관계식 |
|------|------|------|------|------|------|------|
| postgres | pg_isready(애플리케이션 계정 · DB) | 5초 | 3초 | 10 | 10초 | 확인 동작이 연결 수립만 하므로 3초면 멈춤과 지연을 가른다 |
| clickhouse | HTTP ping(8123) | 5초 | 3초 | 10 | 20초 | 기동 시 파트 적재로 ping이 늦게 열린다 — start_period를 길게 |
| redis | redis-cli ping | 5초 | 3초 | 10 | 10초 | AOF 재생 중에는 ping이 로딩 오류를 낸다 — retries가 흡수 |
| api | /api/v1/health 왕복(무인증) | 10초 | **3초** | 5 | 30초 | **timeout 3초 > health 전체 시간 상한 1초(저장소 타임아웃 현행 1,000 ms · 병렬)** |

- 검산: 서비스 = **4** · 관계식이 걸린 행 1(api)
- **관계식 — Compose api healthcheck timeout > health 저장소 타임아웃의 최댓값.** health는 세 저장소를 병렬로 왕복하므로 전체 시간은 가장 긴 저장소 타임아웃을 넘지 않는다(07_api/10). Compose timeout이 이보다 짧으면 저장소 하나가 느린 순간 health가 503 본문을 내기 전에 Compose가 먼저 잘라 **"불가"(503 · 어느 저장소인지 보임)가 "응답 없음"(timeout · 원인 불명)으로 바뀐다.** 3배는 연결 수립과 HTTP 왕복 · 프로세스 스케줄 지연의 여유다.
- **health 저장소 타임아웃을 올리면 이 표의 api timeout을 같은 변경 단위에서 다시 산다.** 관계만 유지하면 3배라는 비율은 조정값이다.
- 저장소 3종의 값은 원본에 없는 **W6 초기값**이다. 원본은 확인 동작만 적었다(원본 architecture.md §3). 기동 순서의 정본은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §기동 순서다.

## observability 프로파일 구성원 판정

docs_plan 실행 계획 보정 #17을 닫는다. 원본 넷이 서로 다른 구성원을 적었다 — prometheus · grafana(원본 tech_stack.md §9 · §10.1 · §10.4 · §12) · alertmanager(원본 architecture.md §14 그림) · tempo(원본 tech_stack.md §2 · §9 "Phase 4 선택"). **판정 — 구성원은 prometheus · grafana 둘이다. alertmanager는 채택하지 않고, tempo는 조건부 확장으로 현 범위 밖에 둔다.** 프로파일의 결정 자체는 ADR-20이다.

| 후보 | 원본 근거 | 판정 | 판정 근거 — 구체적 실패 | 호스트 포트 |
|------|------|------|------|------|
| prometheus | tech §9 · §10.1 · §10.4 · §12 · arch §3 · §14 | **구성원** | 없으면 /metrics를 시계열로 쌓을 곳이 없어 Soak 2~6시간의 추이(메모리 누수 · 파트 누적)를 직접 덤프 파일로만 읽는다 | 127.0.0.1:9090 |
| grafana | tech §9 · §10.1 · §10.4 · §12 · arch §3 · §14 | **구성원** | 없으면 대시보드 6종(10_observability/03)이 표현될 자리가 없다 | 127.0.0.1:3002 |
| alertmanager | arch §14 그림 1곳 | **채택하지 않음** | 알림 라우팅만 하는 구성요소인데 로컬 전용이라 보낼 수신처가 없다 — 외부 통보 채널을 두는 순간 로컬 전용(D-02)을 어긴다. 알림 규칙은 Prometheus 규칙 파일이 평가하고 발화 상태는 Prometheus · Grafana 화면에서 본다 | 없음 |
| tempo | tech §2 · §9(Phase 4 선택) | **현 범위 밖 · 조건부** | E2E 지연은 두 시각 컬럼의 차(ingested_at − ts)를 SQL로 재고 구간은 메트릭으로 가른다. 추적을 넣으면 api 프로세스에 추적 SDK의 계측 비용이 섞여 **측정 대상이 측정 도구를 품는다** | 없음 |

- 검산: 후보 = **4** · 구성원 **2**(prometheus · grafana) · 채택하지 않음 1 · 조건부 1 — 2 + 1 + 1 = **4**
- **호스트 포트 고정 기준이 판정과 맞는다.** 루트 README 호스트 포트 고정 기준에 프로파일 포트는 prometheus 9090 · grafana 3002 둘뿐이다 — alertmanager · tempo의 포트는 원본 어디에도 없다.
- **tempo의 진입 조건 — SQL과 메트릭으로 구간 분해가 불가능하다는 것이 실측될 때다.** 진입 시 추적 SDK를 켠 측정과 끈 측정을 다른 조건으로 기록한다. 진입 전까지 추적 SDK는 의존성에 넣지 않는다([../01_overview/02_goals_scope.md](../01_overview/02_goals_scope.md) E2E 분산 추적 행이 이 판정을 따른다).
- **exporter 컨테이너(node_exporter 포함)는 구성원이 아니다.** 스크레이프 창구는 api의 /metrics 하나다(ADR-20). 호스트 지표는 호스트 도구로 본다(원본 architecture.md §14).
- 알림 규칙 · 대시보드의 정본은 [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md)다. 이 판정은 그 문서와 같은 변경 단위에서 맞춘다.

### 구성원 설정

| 구성원 | 설정 파일 자리 | 필수 설정 | 없으면 |
|------|------|------|------|
| prometheus | infra/observability/prometheus.yml · 규칙 파일 | 스크레이프 대상 api:3000/metrics 하나 · 주기 15초 · 알림 규칙 파일 · **remote write 수신 기능 켬** | k6의 remote write(원본 architecture.md §14)가 거절되어 부하 도구 지표가 대시보드에 없다 |
| grafana | infra/observability/ 대시보드 JSON · 데이터 소스 프로비저닝 | 데이터 소스 prometheus 하나 · 대시보드 파일 프로비저닝 | 대시보드를 손으로 만들어 커밋 해시와 대시보드 정의가 묶이지 않는다 |

- 검산: 구성원 = **2**
- **스크레이프 주기 15초는 MetricsModule 수집 주기와 같다**(원본 tech_stack.md §9). 더 짧게 긁으면 같은 값을 두 번 읽을 뿐이고 관측 부하만 는다 — 이 값이 콘솔 폴링 주기 하한의 근거다([01_frontend.md](./01_frontend.md) §화면 조정값 현행값).
- 두 구성원은 cpuset 13에 둔다 — 배치 정본 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §cpuset 배치.

## 버전 고정표

**이 표가 버전 문자열의 유일한 기재처다.** 버전 열은 전부 **원본 기준**이며 착수 시점 공식 릴리스 노트 재확인 전까지 확정 태그가 아니다. "원본 미기재"는 원본이 버전을 적지 않은 항목이며 착수 시 같은 절차로 고정한다. 상태 열의 **재확인 대기**는 원본 기준만 있는 행, **미고정**은 원본 기준도 없는 행, **태그 고정** · **버전 고정**은 착수 뒤 실제 태그 · 설치 버전을 박은 행이다.

| 구분 | 구성요소 | 원본 기준 | 고정 단위 | 쓰는 자리 | 상태 |
|------|------|------|------|------|------|
| 런타임 | Node.js | 22 LTS · 22.15 이상 | 부 버전까지 | api 이미지 · 호스트 웹 · 도구 | **버전 고정** 22.23(호스트 22.23.3 · .nvmrc 22 · 2026-09-24 · 타입 정의 @types/node 22.20은 Node 메이저를 따른다) |
| 런타임 | api 기반 이미지 | node 22 alpine | 태그 | api 멀티스테이지 빌드 | **태그 고정** node:22.23.3-alpine(apps/api/Dockerfile) |
| 런타임 | TypeScript | 원본 미기재 | 부 버전까지 | 전 패키지 | **버전 고정** 5.9 — 7.x(Go 컴파일러)는 NestJS 데코레이터 메타데이터 호환 미검증이라 쓰지 않는다 |
| 저장소 | PostgreSQL | 18 alpine | 부 버전 태그 | postgres 서비스 | **태그 고정** 18.6-alpine(18 계열 최신 — 릴리스 노트 · 레지스트리 대조 2026-09-24) |
| 저장소 | ClickHouse | 25.8 LTS 이상 | LTS 패치 태그 | clickhouse 서비스 | **태그 고정** 26.8.10.6(LTS 트랙 전환 — 사용자 결정 2026-09-24 · 25.x 보안 지원 종료 · 26.8 계열 최신 패치 — 레지스트리 대조) |
| 저장소 | Redis | 8 alpine | 부 버전 태그 | redis 서비스 | **태그 고정** 8.10.2-alpine(8 계열 최신 — 릴리스 · 레지스트리 대조 2026-09-24) |
| 저장소 확장 | pg_partman | 원본 미기재 | 부 버전까지 | alarm_event 월 파티션 · 대조군 일 파티션 | **버전 고정** 5.5(5.5.0 — infra/postgres/Dockerfile이 공식 18.6-alpine 위에 소스 빌드 · 이미지 db_study-postgres:18.6-partman5.5.0 · 2026-09-25) |
| 저장소 확장 | pg_stat_statements · auto_explain | PostgreSQL 동봉 | 엔진 버전을 따른다 | 쿼리 통계 · 계획 로깅 | 재확인 대기 |
| 백엔드 | NestJS | 11.x | 부 버전까지 | api 전체 | **버전 고정** 11.2(reflect-metadata 0.2 · rxjs 7.8는 NestJS를 따른다) — 12.x는 원본 기준 11.x 밖이라 쓰지 않는다 |
| 백엔드 | Fastify 어댑터 | NestJS와 같은 메이저 | NestJS를 따른다 | HTTP 서버 | **버전 고정** 11.2(@nestjs/platform-fastify · websockets · platform-ws — fastify 5.11 · @fastify/cors 11.3 · ws 8.21) |
| 백엔드 | @clickhouse/client | 1.x | 부 버전까지 | Ingest · TSQ · OBS | **버전 고정** 1.23 — zstd 요청 압축 지원(§미확인 · 미설계 등재 닫힘) |
| 백엔드 | ioredis | 5.x | 부 버전까지 | Streams · Pub/Sub · Lua | **버전 고정** 5.11 — 6.x는 원본 기준 5.x 밖 |
| 백엔드 | pg | 8.x | 부 버전까지 | in-process 풀(ADR-19) | **버전 고정** 8.23 |
| 백엔드 | pg-copy-streams | 원본 미기재 | 부 버전까지 | 대조군 COPY(SW-09 · ADR-17) | **버전 고정** 7.0(타입 정의 @types/pg-copy-streams 1.2) |
| 백엔드 | modbus-serial | 8.x | 부 버전까지 | Collector | **버전 고정** 8.0 — TCP만 쓴다 · 직렬 포트 네이티브 빌드(@serialport/bindings-cpp) 끔 |
| 백엔드 | jsmodbus | 4.x | 부 버전까지 | PlcSim | **버전 고정** 4.0 — 5.x는 원본 기준 4.x 밖 |
| 백엔드 | msgpackr | 1.x | 부 버전까지 | Stream 페이로드 | **버전 고정** 1.12 — 2.x는 원본 기준 밖 · 네이티브 해제 가속(msgpackr-extract) 끔(§미확인 · 미설계 등재) |
| 백엔드 | piscina | 5.x | 부 버전까지 | worker_threads 풀(ADR-25) | **버전 고정** 5.3 |
| 백엔드 | prom-client | 15.x | 부 버전까지 | /metrics | **버전 고정** 15.1 |
| 백엔드 | 보안 헤더 플러그인(helmet 계열) | 원본 미기재 | 부 버전까지 | 보안 헤더 | 미고정 |
| 백엔드 | 비밀번호 해시 라이브러리(Argon2id) | 원본 미기재 — 알고리즘은 12_security/01 판정 | 부 버전까지 | 로그인 · seed(REQ-AUT-01) | 미고정 |
| 프론트엔드 | Next.js | 15.x | 부 버전까지 | 웹 · BFF | **버전 고정** 15.5(React 19.3) — 16.x는 원본 기준 15.x 밖 |
| 프론트엔드 | uPlot | 1.6 | 부 버전까지 | 실시간 · 트렌드 차트 | **버전 고정** 1.6 |
| 프론트엔드 | Apache ECharts | 5.5 | 부 버전까지 | 분석 · 비교 차트 | 재확인 대기 |
| 프론트엔드 | TanStack Query | 5.x | 부 버전까지 | 브라우저 쿼리 캐시 | **버전 고정** 5.103 |
| 프론트엔드 | Zustand · React Hook Form · Tailwind CSS | 원본 미기재 | 부 버전까지 | 스토어 · 폼 · 스타일 | **버전 고정** Zustand 5.0 · Tailwind CSS 4.3 — React Hook Form은 폼 화면이 생기는 단계에서 고정 |
| 프론트엔드 | shadcn/ui | 버전 없음 — 컴포넌트 소스를 저장소에 복사 | 복사 시점 커밋 | UI 컴포넌트 | 해당 없음 |
| 공유 | zod | 원본 미기재 | 부 버전까지 | packages/shared | **버전 고정** 4.6 |
| 도구 | pnpm | 원본 미기재(원본 체크리스트는 latest 활성화 — 금지) | 패키지 관리자 필드 | 워크스페이스 | **버전 고정** 12.6(루트 package.json packageManager · corepack) |
| 도구 | Biome · Vitest | 원본 미기재 | 부 버전까지 | 품질 게이트 ① · ③ | **버전 고정** Biome 2.5 · Vitest 5.0 |
| 도구 | Supertest · Testcontainers | 원본 미기재 | 부 버전까지 | 표면 계약 · 통합 테스트 | **버전 고정** Supertest 7.3(표면 계약은 기동한 스택에 블랙박스로 붙는다 · task test-surface) — Testcontainers는 저장소 경계 통합 테스트가 생기는 단계(S3 XACK · 중복 제거)에서 고정 |
| 도구 | node-pg-migrate | 원본 미기재(원본 후보) | 부 버전까지 | PostgreSQL 마이그레이션 | **버전 고정** 9.0 — ESM 전용이라 api(CommonJS)가 동적 import로 부른다 |
| 도구 | Task(Taskfile 실행기) | 원본 미기재 | 부 버전까지 | migrate · seed · snapshot · restore · bench · docs:lint | **버전 고정** 3.53(호스트 설치 3.53.1 · 2026-09-24) |
| 도구 | **Python** | 원본 미기재 | 부 버전까지 | docs:lint(scripts/docs_lint.py) · 단계 실습 스크립트 | **버전 고정** 3.14(호스트 3.14.6 · 2026-09-24 사용자 지정) |
| 도구 | Docker Compose | v2 | 부 버전까지 | 실행 구성 | 재확인 대기 |
| 부하 | k6 | v1.x | 부 버전까지 | 부하 시나리오 | **버전 고정** 1.8(이미지 grafana/k6:1.8.1) — 2.x는 원본 기준 v1.x 밖 |
| 관측 | Prometheus | 3.x | 부 버전 태그 | observability 프로파일 | 재확인 대기 |
| 관측 | Grafana | 12.x | 부 버전 태그 | observability 프로파일 | 재확인 대기 |

- 검산: 행 = 런타임 3 + 저장소 3 + 저장소 확장 2 + 백엔드 13 + 프론트엔드 6 + 공유 1 + 도구 7 + 부하 1 + 관측 2 = **38** · 상태 태그 고정 4 + 버전 고정 26 + 재확인 대기 5 + 미고정 2 + 해당 없음 1 = **38**
- **원본 고정표에서 뺀 행 1** — Prisma(원본 "pg + Prisma")는 마이그레이션 도구 판정에서 채택하지 않았다([05_tooling_devops.md](./05_tooling_devops.md) §마이그레이션 도구 판정 · [06_decisions_rationale.md](./06_decisions_rationale.md)). 원본의 pg 행은 남았다.
- **원본에 없던 행 3** — pg-copy-streams(대조군 COPY가 스트림 복사를 요구) · 보안 헤더 플러그인(원본 tech_stack.md §10.4가 이름만 적음) · Python(S0의 docs:lint · 실습 스크립트 — 사용자 지정 3.14). 보안 헤더 플러그인만 미고정이다.
- **고정 단위가 "부 버전까지"인 이유** — 메이저만 고정하면 부 버전 갱신이 설치 시점마다 달라 같은 커밋의 두 설치가 다른 코드를 받는다. 잠금 파일이 패치까지 고정하고, 이 표는 잠금 파일을 갱신할 때 넘지 않을 경계를 준다.
- **Node 22.15 이상의 근거는 zstd 요청 압축이다**(원본 tech_stack.md §3.3 · §12). @clickhouse/client 1.23은 zstd 요청 압축을 지원한다 — S2 적재 경로가 zstd로 보낸다(§미확인 · 미설계 등재 닫힘).

### 재확인 절차

착수 체크리스트 7번([../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))의 실행 절차다.

```plain
① 공식 릴리스 노트 확인     구성요소마다 현 시점 최신 안정 버전 · LTS 여부 확인(URL은 03_requirements/16)
② 원본 기준과 대조          메이저가 원본 기준과 다르면 호환 검토 — ClickHouse는 LTS 트랙 안에서만 이동
③ 이 표 갱신               원본 기준 열은 두고 확정 태그를 적는 열을 더하거나 개정일 줄에 A → B로 적는다
④ 잠금 파일 · 이미지 태그   Compose 이미지 태그 · 잠금 파일 · 패키지 관리자 필드를 같은 커밋에서 고정
⑤ 첫 측정 기록             확정 뒤 첫 기록의 커밋 해시가 이 버전 집합의 식별자다
```

- **③과 ④를 다른 커밋으로 나누지 않는다.** 표와 실제 태그가 한 커밋이라도 어긋나면 그 사이의 측정 기록은 어느 버전에서 돌았는지 커밋 해시로 되찾을 수 없다.
- **착수 뒤의 버전 변경도 같은 절차다.** 버전을 바꾼 커밋 전후의 측정은 같은 실험으로 묶지 않는다 — 기록의 조건 칸에 버전 변경 커밋을 적는다.
- **latest · 범위 태그(메이저만 · x 와일드카드)를 이미지와 패키지 관리자에 쓰지 않는다.** 원본 체크리스트의 pnpm latest 활성화 명령은 이 원칙과 충돌한다 — pnpm도 패키지 관리자 필드로 버전을 박는다([05_tooling_devops.md](./05_tooling_devops.md)).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 버전 고정표 전 행의 확정 태그 | 저장소 3행은 릴리스 노트 · 레지스트리 대조 뒤 고정(2026-09-24) · 나머지는 원본 기준 — 각 단계 착수 시 재확인 전까지 확정 아님 | 이 문서 §버전 고정표 · 착수 체크리스트 7번 |
| ClickHouse LTS 트랙의 보안 지원 종료 | **닫힘(2026-09-24 사용자 결정)** — 25.8.33.6 → 26.8.10.6. 전환으로 드러난 동작 차이 넷(정수 ts 해석 · 적재 측 거절의 원시 커밋 · 토큰 없는 내용 중복 제거 · async_insert 동시 사용)은 기록 004가 적고, 정수 ts는 프로파일 설정으로 막았다 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §서버 설정 계약 |
| alpine 이미지의 시간대 데이터 포함 여부 | **닫힘(S0 확인 2026-09-24)** — PostgreSQL alpine · ClickHouse 이미지 모두 Asia/Seoul 해석 | 이 문서 |
| msgpackr-extract(msgpackr 네이티브 해제 가속) | **끔 유지(S2 재판정)** — S1 판정(pnpm-workspace.yaml 허용 목록에서 끔)을 S2에서 다시 봤다. 슬라이스 · 티어 S의 해제는 워커 한 번에 1 ms 미만이라 병목이 아니고(ing_decode_seconds p50 약 0.73 ms · 기록 012 · d32b09a · 부하 실험 · S · 스위치 기본값), 켜면 호스트와 컨테이너의 해제 경로가 갈린다 — 해제가 병목 후보가 되는 S5 M 티어에서 다시 판정 | S5 · 이 문서 · [02_backend.md](./02_backend.md) |
| @clickhouse/client의 zstd 요청 압축 지원 | **닫힘(S2 착수 확인 2026-09-24)** — 1.23이 zstd 요청 압축을 지원한다 · 적재 경로 zstd · gzip은 쓰지 않는다 | [02_backend.md](./02_backend.md) |
| client-output-buffer-limit pubsub 값 | 값 미정 — 계약만(게이트웨이 소켓 한도보다 늦게) | S4 · 이 문서 · [../07_api/11_websocket.md](../07_api/11_websocket.md) 소켓 송신 대기량 한도와 같은 변경 단위 |
| TTL 파티션 삭제 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | EXP-29 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| pg_partman 미리 만들기 · 워커 주기의 기본값 | **닫힘(S3 착수 확인 2026-09-25)** — 5.5.0 part_config.premake 기본 4 · 워커 주기는 설정 파일에 3600초로 명시해 기본값에 기대지 않는다 | 이 문서 §pg_partman 미리 만들기와 유지 작업 |
| pg_partman 설치 경로 | **닫힘(S3 · 2026-09-25)** — 공식 이미지에 없어(S0 확인) 파생 이미지를 도입했다 · infra/postgres/Dockerfile 다단 빌드(빌드 단계만 컴파일 도구 · 실행 단계는 공식 이미지 위에 확장 파일만 더한다) · 5.5.0 고정 · Compose postgres 서비스가 이 이미지를 빌드한다 | 이 문서 §버전 고정표 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| tempo 진입 | 조건부 — SQL · 메트릭 구간 분해 불가가 실측될 때 | [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) 진입 조건 추가 제안 |

## 관련 문서

- [README.md](./README.md) — 폴더 목차 · 버전 고정 원칙
- [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) — PostgreSQL 튜닝 값 정본
- [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) — ClickHouse 서버 설정 계약 · 시각 컬럼 시간대
- [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) — maxmemory · MAXLEN 정본
- [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) — 보존 · TTL 검증 시점
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health 저장소 타임아웃
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 기동 순서 · cpuset
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-03 · ADR-05 · ADR-18 · ADR-20
- [../10_observability/03_dashboards_alerts.md](../10_observability/03_dashboards_alerts.md) — 대시보드 · 알림 규칙
- [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) — 릴리스 노트 · 공식 문서 URL
