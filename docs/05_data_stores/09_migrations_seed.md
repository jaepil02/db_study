# 마이그레이션 · 시드 (09_migrations_seed)

> **대상**: 스키마 적용의 저장소 간 순서 · PostgreSQL 순번 마이그레이션 · ClickHouse DDL 순번 · 도구 관리 테이블 · 시드(사이트 · 라인 · 설비 · 접속 설정 · 태그 · 계정 · 역할) · 스키마 변경 절차 · 스냅샷과의 관계
> **작성일**: 2026-09-24
> **개정일**: 2026-09-28 — 구현 반영(i-utc 실측 · 리드 채택) — 기존 볼륨 경로 ②에 **pgmigrations.run_on 보정 단계**(KST 벽시계 행 → UTC 벽시계 · 재구성 볼륨만) · 불릿 신설 — 순서 검사 영구 실패 방지
> **개정일**: 2026-09-28 — 리드 판정 — PostgreSQL 순번 **010 실행 수명 객체 함수**(010_run_perf_functions.sql · SECURITY DEFINER 2) · 이후 변경 대역 010~ → **011~**
> **개정일**: 2026-09-28 — r-utc 검수 반영(M1 · L2 · L3 · L4) — §DB 시간대 전환 ClickHouse 판정 대상 → **테이블 8 · MV 제외**(mv_tag_1d.bucket의 'Asia/Seoul'은 정상 — 빈 볼륨 ⑤ · 멱등 불릿) · 기존 볼륨 ② 009 트랜잭션 부모마다 → **migrate 실행 하나(migrate.ts singleTransaction — 대기 순번 전체)** · 세션 시간대 SET → **SET LOCAL** · ③ INSERT SELECT에 ingested_at 명시 복사 · tag_raw 복사 중 디스크 일시 2배 전제
> **개정일**: 2026-09-28 — 리드 판정 — 미확인 행 api · datagen 컨테이너 TZ 닫힘(UTC · 구현 목록 #24)
> **개정일**: 2026-09-28 — DB 시각 UTC 전환(ADR-27 · 사용자 요구 2026-09-28) — PostgreSQL 순번 **009 제안**(009_utc_partition_boundaries.sql — alarm_event · 대조군 파티션 UTC 경계 재구성) · 이후 변경 대역 009~ → **010~** · 관리자 단계에 DB 기본 timezone UTC 맞춤 · ClickHouse DDL 002 · 003 · 004 · 009 시각 컬럼 인자 → **UTC**(파일 내용 교체 · 순번 불변 — 객체 12 불변) · **§DB 시간대 전환 신설**(빈 볼륨 · 기존 볼륨 · 스냅샷 복원 뒤 · 확인 사실 · 미확인) · 스키마 변경 유형 6 → **7**(시간대 인자 변경)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-L1) — grp:biz-writer 그룹 생성 XGROUP CREATE MKSTREAM → **XGROUP CREATE stream:biz:cmd grp:biz-writer 0 MKSTREAM**(시작 ID 0) — 순번 · 시드 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — PostgreSQL 순번 **008 biz_command_log 제안**(제안 파일명 008_biz_command_log.sql · UNIQUE(cmd_id) · 추가 전용 REVOKE) · 이후 변경 대역 008~ → **009~** · 컨슈머 그룹 grp:biz-writer 기동 생성 · 시드 0행 테이블 6 → **7**(합 14 → **15**)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — ClickHouse DDL 순번 **009 업무 대조 테이블 3**(009_business_control.sql · 역방향 대조 EXP-40~44 · 정본 03_clickhouse_schema §업무 대조 테이블) — 객체 검산 9 → **12** · 적용 순서 ⑤에 009 병기
> **개정일**: 2026-09-26 — 리드 판정 — 학습자 계정 email **learner@localhost** · 확인 행위자 환경변수 이름 정본 등재(09_tech_stack/04) — 미확인 1행 닫힘
> **개정일**: 2026-09-26 — S7 ① 선행 반영(알람 분기를 인증보다 먼저 · 사용자 결정) — **§S7 ① 계정 · 역할 시드 신설**(문서에 정해진 범위만 — 학습자 계정 1 · 역할 3 · 부여 3 · email 값 미확인 등재) · 무인증 기간 행위자 행의 경계 S4~S6 → **인증 도입(S7 ②) 전**과 확인 행위자 예외(정본 07_api/07 §인증 전 확인 행위자 판정) · 학습자 계정 시드 시점 불릿을 as-built에 맞춤 — 테이블 수 · 시드 행 수 불변
> **개정일**: 2026-09-25 — S3 구현 반영 — §S3 적용 범위(as-built) 신설(PostgreSQL 003~007 · ClickHouse 003~008 · pg_partman 확장은 migrate 관리자 단계 · ⑨ RELOAD는 seed 끝 · ClickHouse 러너 다문장 분할)
> **개정일**: 2026-09-24 — S2 구현 반영 — §S2 적용 범위(as-built) 신설(PostgreSQL 001 · 002 · ClickHouse 001 · 002 · 시드 --tier · --slice · changed_by 외래 키 003) · tag_master 시드 data_type 혼합(16 · 32비트) → **06_pipeline/10 §티어 시드 구성 인용(S = FLOAT32 · ABCD)** — 두 정본 불일치 해소
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약) · BOOL · FC01 · FC02 시드 금지 근거를 W4 판정으로 갱신 · 도구 관리 테이블 제외 기준의 루트 README 반영 완료 표기
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(티어 시드 구성 · 알람 규칙 시드)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 학습자 계정 비밀번호 주입 방식 닫힘 — SEED_USER_PASSWORD · Argon2id 해시 · 원문 비저장(정본 12_security/02)
> **개정일**: 2026-09-24 — W6 판정 반영 — 마이그레이션 도구 선택 → **node-pg-migrate**(SQL 순번 파일 · Prisma Migrate 채택하지 않음 — 정본 09_tech_stack/05)
> **원천**: ADR-27(사용자 요구 2026-09-28) · 원본 tech_stack.md §5.1 · §10.3 · §10.5 · §11(커밋 ff66a37) · 원본 architecture.md §3 · §6 · §7 · §18(커밋 ff66a37) · 원본 data_flow.md §10.2 · §14.2(커밋 ff66a37) · 웨이브 인계 W3 05_data_stores/01 · 09 행(무인증 기간 감사 행위자) · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-TEC-05 · REQ-TEC-08 · [../02_features/03_collector.md](../02_features/03_collector.md) 모드 A SIMULATED 판정 · [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-17 · [../07_api/07_alarms.md](../07_api/07_alarms.md) §인증 전 확인 행위자 판정 · [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) Argon2id 판정

**스키마는 순번 마이그레이션으로만 바뀐다**(REQ-TEC-05). 수동 DDL은 스냅샷 복원 · 새 환경에서 재현되지 않아 **같은 커밋에서 다른 스키마로 측정**하게 만든다. 기동 순서는 migrate(PostgreSQL 마이그레이션 + ClickHouse DDL 순번 파일) → seed다(원본 tech_stack.md §10.5). 스키마 소유권은 api(NestJS) 쪽에 둔다.

이 문서는 **적용 순서와 시드의 모양**을 고정한다. 마이그레이션 도구의 선택과 버전은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)가, migrate · seed · snapshot · restore 작업의 실행 명령은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)가, 기동 순서(healthcheck · depends_on)는 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)가 갖는다.

## 저장소 간 적용 순서

세 저장소의 객체는 서로를 참조한다 — Dictionary는 PostgreSQL 테이블과 계정을, MV는 타깃 테이블을 필요로 한다. 적용은 한 방향으로만 흐른다.

```plain
① PostgreSQL 확장 · DB 역할      pg_stat_statements · pg_partman · auto_explain · app_owner · app_rw · ch_reader
② PostgreSQL 업무 테이블          MST → AUT → ALM → WRK 순(FK 방향)
③ PostgreSQL 파티션 · 트리거 · 권한 alarm_event 월 파티션 · 대조군 일 파티션 · 가드 트리거 · REVOKE
④ ClickHouse 데이터베이스 plc
⑤ ClickHouse 테이블 8            tag_raw · alarm_eval · tag_1m · tag_1h · tag_1d · 업무 대조 3(009 — 의존 없음 · 순번은 008 뒤)
⑥ ClickHouse MV 3(위에서 아래로) mv_tag_1d → mv_tag_1h → mv_tag_1m
⑦ ClickHouse Dictionary          dict_tag — ①의 ch_reader · ②의 tag_master가 먼저 있어야 한다
⑧ 시드                           PostgreSQL 마스터 · 계정 · 역할
⑨ SYSTEM RELOAD DICTIONARY        시드된 태그를 즉시 적재
```

- **⑥을 위에서 아래로 만든다.** mv_tag_1m이 먼저 생기면 그 순간부터 tag_raw 삽입이 tag_1m으로 흐르는데 mv_tag_1h가 아직 없어 그 구간의 시간 · 일 롤업이 빈다. 위에서부터 만들면 연쇄의 입구가 마지막에 열린다.
- **①의 관리자 단계가 DB 기본 timezone을 UTC로 맞추고, ③과 ④ 사이에 ClickHouse 시간대 전환 단계가 돈다(ADR-27).** 둘 다 멱등이라 빈 볼륨에서는 아무것도 하지 않는다 — 순서 · 판정의 정본은 §DB 시간대 전환이다.
- **Redis에는 마이그레이션이 없다.** 키는 런타임이 만들고, 컨슈머 그룹 grp:ingest는 Ingest 기동 시 · grp:biz-writer는 명령 워커 기동 시 **XGROUP CREATE stream:biz:cmd grp:biz-writer 0 MKSTREAM**(시작 ID 0 — 그룹 생성 전에 실린 명령도 읽는다 · $면 그 명령이 영영 소비되지 않는다)이 만든다(ING-01 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). 키 패턴의 정본은 [05_redis_keyspace.md](./05_redis_keyspace.md)이며 스키마 파일이 아니다.
- **⑦이 ②보다 뒤인 이유** — Dictionary 생성 자체는 소스를 즉시 읽지 않지만, 첫 조회 때 소스 계정 · 테이블이 없으면 적재 실패가 LIFETIME마다 반복된다. ⑨는 시드 직후의 첫 조회가 빈 사전을 보지 않게 한다.

## PostgreSQL 마이그레이션

순번 파일 하나가 한 변경 단위다. 아래는 초기 스키마의 순번 대역 설계다 — 실제 파일 이름 형식은 도구가 정한다.

| 대역 | 내용 | 정본 | 도구 표현 제약 |
|------|------|------|------|
| 001 | 확장 3 · DB 역할 3 · DB 기본 timezone Asia/Seoul(파일 내용 — 현행 값은 관리자 단계가 UTC로 덮는다 · §DB 시간대 전환) | [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 확장 · 역할은 모델 선언으로 표현되지 않는다 |
| 002 | MST 6 테이블 · 결합 CHECK | [01_postgresql_schema.md](./01_postgresql_schema.md) | 해당 없음 |
| 003 | AUT 3 테이블 | 상동 | 해당 없음 |
| 004 | ALM 2 테이블 · alarm_event 월 파티션(pg_partman 등록) | 상동 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 선언적 파티션은 모델 선언 밖이다 |
| 005 | WRK 3 테이블 | [01_postgresql_schema.md](./01_postgresql_schema.md) | 해당 없음 |
| 006 | 가드 트리거 · 추가 전용 권한(REVOKE) · 인덱스 | [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL |
| 007 | 대조군 plc_tag_raw_control · 일 파티션 · BRIN | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | 원시 SQL |
| **008** | **biz_command_log · UNIQUE(cmd_id) · 추가 전용 REVOKE**(제안 파일명 008_biz_command_log.sql) — 업무 쓰기 Redis 경유 | [01_postgresql_schema.md](./01_postgresql_schema.md) §biz_command_log 설계 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 권한 |
| **009** | **alarm_event 월 · 대조군 일 파티션 UTC 경계 재구성**(제안 파일명 009_utc_partition_boundaries.sql · 경계가 이미 UTC면 건너뛴다) — ADR-27 | §DB 시간대 전환 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) · [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | 원시 SQL — pg_partman 호출 · 파티션 분리 |
| **010** | **실행 수명 객체 함수 run_perf_create(p_from, p_to) · run_perf_drop()**(제안 파일명 010_run_perf_functions.sql · app_owner 소유 SECURITY DEFINER · search_path 고정 · EXECUTE는 app_rw만) — 라이브 실행 perf | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §실행 수명 객체 | 원시 SQL — 함수 · 권한 |
| 011~ | 이후 변경 — 말미 채번 · 재배치 금지 | 변경한 문서 | 해당 없음 |

- 검산: 초기 대역 = 001~007 = **7** · 초기 테이블 = MST 6 + AUT 3 + ALM 2 + WRK 3 + 대조군 1 = **15** · 008이 1을 더해 현행 테이블 = 15 + 1 = **16** · 009는 테이블을 더하지 않는다(파티션 재구성 — 부모 테이블 수 불변) · 010은 함수 2만 만든다(실행 수명 객체는 실행이 함수로 만들고 지운다 — 고정 기준 밖)
- **009는 008 뒤에만 적용한다.** node-pg-migrate 순서 검사(checkOrder)는 적용된 순번보다 앞선 미적용 순번을 거부한다 — 008 구현 전에 009를 적용한 볼륨에 008을 더하면 migrate가 멈춘다(§S3 적용 범위의 순서 검사와 같은 기전). 두 순번은 같은 구현 웨이브에서 008 → 009로 넣는다.
- **008은 초기 대역에 끼우지 않고 말미에 둔다.** 기존 볼륨(001~007 적용 · 스냅샷)에 migrate를 다시 돌리면 008만 적용되어 원장 테이블이 생긴다 — 005(WRK)에 넣으면 이미 적용된 순번의 내용이 바뀌어 같은 순번의 두 스키마가 생긴다. 008은 업무 테이블 어느 것도 참조하지 않는다(FK 없음).
- **도구가 무엇이든 원시 SQL 마이그레이션을 쓸 수 있어야 한다.** 파티션 · 트리거 · 권한 · 확장 · BRIN은 ORM 모델 선언으로 표현되지 않는다 — 원본 후보(Prisma Migrate · node-pg-migrate) 중 이 제약으로 **node-pg-migrate**를 골랐다(W6 판정 · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) §마이그레이션 도구 판정).
- **대조군은 SW-09 기본 off여도 초기 스키마에 만든다.** 스위치로 테이블이 생기고 사라지면 스위치 전환이 재기동이 아니라 마이그레이션이 되어, 스위치 = DI 구현 교체라는 제약(ADR-08)이 깨진다.

## ClickHouse DDL 순번

ClickHouse DDL은 순번 SQL 파일로 둔다(원본 tech_stack.md §11). 파일 목록은 적용 순서 그대로다.

| 순번 | 파일 내용 | 정본 | 멱등 수단 |
|:-:|------|------|------|
| 001 | CREATE DATABASE plc | [03_clickhouse_schema.md](./03_clickhouse_schema.md) | IF NOT EXISTS |
| 002 | tag_raw | 상동 | 상동 |
| 003 | alarm_eval | 상동 | 상동 |
| 004 | tag_1m | [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) | 상동 |
| 005 | tag_1h · tag_1d | 상동 | 상동 |
| 006 | mv_tag_1d · mv_tag_1h | 상동 | 상동 |
| 007 | mv_tag_1m — 연쇄 입구를 마지막에 연다 | 상동 | 상동 |
| 008 | dict_tag | [03_clickhouse_schema.md](./03_clickhouse_schema.md) | 상동 |
| **009** | 업무 대조 테이블 3 — work_order_control · work_order_control_rmt · production_log_control(제안 파일명 009_business_control.sql) | [03_clickhouse_schema.md](./03_clickhouse_schema.md) §업무 대조 테이블 | 상동 |

- 검산: 객체 = 테이블 8(002 · 003 · 004 · 005의 2 · 009의 3) + MV 3(006의 2 · 007) + Dictionary 1(008) = **12**
- **ADR-27은 DDL 순번을 늘리지 않는다(판정).** 002 · 003 · 004 · 009 파일의 시각 컬럼 인자를 'UTC'로 바꾸고(005의 tag_1h · tag_1d는 AS plc.tag_1m으로 구조를 물려받는다 · 006 mv_tag_1d의 'Asia/Seoul' 인자는 달력 의미 경계라 유지), 이미 KST로 선 볼륨은 migrate의 **ClickHouse 시간대 전환 단계**(순번 파일 밖 · 카탈로그로 멱등 판정)가 같은 모양으로 수렴시킨다 — §DB 시간대 전환. 다음 DDL 순번은 여전히 010이다.
- **009는 앞 순번 어느 객체도 참조하지 않는다.** MV의 원천도 Dictionary 소스도 아니라 적용 위치가 결과를 바꾸지 않고, 말미 채번 규칙대로 008 뒤에 둔다. 기존 볼륨에 migrate를 다시 돌리면 IF NOT EXISTS로 이 셋만 새로 생긴다(§스냅샷과의 관계 복원 후 migrate 행). EXP-41의 그래뉼 256 변형은 이 순번에 없다 — 실행기가 실행 범위에서만 만든다([10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §그래뉼 변형 판정).
- **ClickHouse 쪽에 적용 이력 테이블을 두지 않는다(판정).** 이력 테이블을 plc에 두면 ClickHouse 테이블 수 고정 기준이 바뀐다. 대신 모든 파일을 IF NOT EXISTS로 멱등하게 쓰고 migrate가 **매번 전 파일을 순서대로** 적용한다. 멱등하게 쓸 수 없는 변경(아래 §스키마 변경 절차)은 새 순번 파일이 새 객체를 만드는 모양으로만 한다.
- 비밀번호 같은 비밀 값은 DDL 파일에 쓰지 않고 설정 파일로 주입한다 — dict_tag 소스 비밀번호가 대표 사례다([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)).

## 도구 관리 테이블

마이그레이션 도구 · 확장이 스스로 만드는 테이블은 업무 테이블이 아니다.

| 저장소 | 테이블 | 만드는 주체 | 고정 기준 테이블 수에 드는가 |
|------|------|------|:------:|
| PostgreSQL | 마이그레이션 이력(도구가 이름을 정한다) | 마이그레이션 도구 | 아니다 |
| PostgreSQL | pg_partman 설정 · 기록 테이블(partman 스키마) | pg_partman | 아니다 |
| PostgreSQL | alarm_event · 대조군의 자식 파티션 | pg_partman | 아니다 — 부모 테이블로 센다 |
| ClickHouse | 없음 — 이력 테이블을 두지 않는다 | 해당 없음 | 해당 없음 |

- 검산: 행 = **4**
- **세는 기준은 "업무 · 실험 스키마가 선언한 부모 테이블"이다.** 자식 파티션과 도구 테이블을 세면 파티션이 생길 때마다 고정 기준이 흔들린다 — 이 기준은 루트 README 고정 기준 PostgreSQL 테이블 행에 올라 있다.

## 시드

migrate 뒤 seed가 넣는 행이다. 기본 시드는 용량 티어 S(설비 5 × 태그 50 · 1 Hz — [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md))를 채우고, 다른 티어는 같은 규칙에 설비 · 태그 수만 바꾼다.

| 테이블 | S 티어 행 수 | 값 규칙 | 근거 |
|------|:------:|------|------|
| site | 1 | timezone 'Asia/Seoul' | CHECK 고정([01_postgresql_schema.md](./01_postgresql_schema.md)) |
| production_line | 1 | 설비 전부를 한 라인에 | S2 시드 최소분(REQ-MST-01) |
| device | 5 | 설비 코드 연번 · is_active true | 해당 없음 |
| modbus_config | 5 | **host 127.0.0.1(컨테이너 루프백)** · port 5020부터 설비당 1 · unit_id 1 | 루프백 host = 시뮬레이션 설비 → 정상 값에 SIMULATED(9)([../02_features/03_collector.md](../02_features/03_collector.md)) |
| tag_master | 250 | function_code 3 · 연속 주소 · data_type · 배치는 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §티어 시드 구성(S = FLOAT32 · word_order ABCD · 갭 0) · scale 1 · offset_value 0 · deadband 0 · scan_rate_ms 1000 | 연속 주소는 블록 병합(원본 data_flow.md §3.1) · deadband 0은 SW-10 off 기준 |
| user_account | 1 | 학습자 계정 · 비밀번호는 환경 변수에서 해시 | REQ-AUT-17 · 비밀 값은 시드 파일에 쓰지 않는다 |
| role | 3 | OPERATOR · ENGINEER · ADMIN | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| user_role | 3 | 학습자 계정에 세 역할 전부 | REQ-AUT-17 |
| alarm_rule · work_order · production_log · audit_log · tag_master_history · alarm_event · biz_command_log | 0 | 표면(S4 · S7)이 만든다 · 원장은 명령 적용이 만든다 | 시드는 사람이 쓰기 표면으로 만들 데이터를 흉내 내지 않는다 — 시드 행에 원장 행을 만들면 존재하지 않은 명령이 명령 조회에 나타난다 |

- 검산: 시드 행이 있는 테이블 8(site · production_line · device · modbus_config · tag_master · user_account · role · user_role) + 0행 7 = **15** · 대조군은 적재가 채운다
- **BOOL · FC01 · FC02 태그는 시드하지 않는다.** 결합 CHECK가 막아 두었고([02_postgresql_constraints.md](./02_postgresql_constraints.md)) W4 판정도 **시드 금지 유지**다 — SIM이 비트 영역을 응답하지 않는다. 해제 조건 4개는 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) §BOOL 판정이 갖는다.
### S2 적용 범위(as-built)

S2는 초기 대역의 앞 둘만 적용한다 — 뒤 순번은 그 테이블을 쓰는 단계에서 추가하며 재배치하지 않는다.

| 대상 | S2 적용 | 뒤로 미룬 것 | 이유 |
|------|------|------|------|
| PostgreSQL 001 | pg_stat_statements · 역할 3(app_owner · app_rw · ch_reader — 비밀번호는 migrate가 환경변수에서 설정) · DB timezone | pg_partman(004 — 공식 이미지에 없다 · [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) · auto_explain(확장이 아니라 적재 모듈 — 서버 설정이 싣는다) | 확장 생성은 첫 순번 원칙 유지 |
| PostgreSQL 002 | MST 6 테이블 · 결합 CHECK | tag_master_history.changed_by → user_account 외래 키(003 — AUT 테이블과 같은 순번) | 참조 대상이 없는 외래 키는 만들 수 없다 |
| ClickHouse | 001 DB · 002 tag_raw | 003~(alarm_eval · 롤업 · MV · dict_tag — S3) | 적재 경로가 tag_raw만 쓴다 |
| 시드 | --tier S(설비 5 · 태그 250) · --slice s2(설비 1 · 태그 8 · 수직 슬라이스 — [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)) | user_account · role · user_role(003 이후 · S7) | 테이블이 없다 |

- 검산: 대상 = **4**
- **seed는 빈 볼륨 전용 · 한 트랜잭션이다.** 마스터에 행이 있으면 거부한다 — 두 번 시드한 볼륨은 tag_id 공간이 달라 같은 시드의 두 실험이 다른 태그를 본다. 빈 상태로 되돌리는 수단은 스냅샷 복원이다(s2-empty-slice · s2-empty-s).

### S3 적용 범위(as-built)

S3는 초기 대역의 나머지를 전부 적용한다 — node-pg-migrate의 순서 검사가 앞 순번이 빠진 채 뒤 순번만 적용하는 것을 막으므로 대조군(007)만 먼저 넣으면 003~006을 그 뒤에 끼울 수 없다.

| 대상 | S3 적용 | 도구 표현 · 권한 | 이유 |
|------|------|------|------|
| PostgreSQL 003~006 | AUT 3 · tag_master_history.changed_by 외래 키 · ALM 2(alarm_event 월 파티션 등록 · 보존 2년 · 분리 보존) · WRK 3 · 가드 트리거 · REVOKE · 인덱스 | 원시 SQL · app_owner 소유 | 스키마만 — 표면은 S4 · S7이 만든다 · 순서 검사 |
| PostgreSQL 007 | plc_tag_raw_control · 일 파티션 등록 · 보존 7일 · BRIN | 상동 | SW-09 동시 적재(AC-21) |
| pg_partman 확장 | partman 스키마 · 확장 생성 · app_owner 권한 부여 | **migrate 관리자 단계**(마이그레이션 파일 밖) — 확장 생성은 superuser만 되고 마이그레이션은 app_owner로 돈다 | 004 · 007의 등록 호출이 확장을 요구한다 |
| ClickHouse 003~008 | alarm_eval · tag_1m · tag_1h · tag_1d · mv_tag_1d → mv_tag_1h → mv_tag_1m · dict_tag(명명 수집 pg_dict — ch_reader 비밀번호는 서버 설정 파일이 환경변수에서 읽는다) | 파일 하나에 여러 문장 — 러너가 문장 끝 세미콜론으로 나눠 한 문장씩 보낸다 | 적재 경로가 롤업 · 사전을 채운다 |
| ⑨ SYSTEM RELOAD DICTIONARY | seed 트랜잭션 커밋 뒤 한 번 | seed가 ClickHouse에 보낸다 | 시드 직후 첫 dictGet이 빈 사전을 보지 않는다 |

- 검산: 대상 = **5**
- **확장 생성을 마이그레이션 파일에 두지 않은 이유** — 파일에 두면 마이그레이션 실행 역할이 superuser여야 하고, 그러면 마이그레이션이 만든 객체의 소유가 app_owner가 아니게 되어 app_rw 권한 부여 규칙(01_postgresql_schema)이 객체마다 갈린다. 관리자 단계는 멱등(IF NOT EXISTS)이라 migrate를 다시 돌려도 같다.
- 빈 상태 스냅샷은 s3-base(migrate만) · s3-empty-slice · s3-empty-s다 — S2 스냅샷에는 003~008이 없어 그 위에 S3 이미지를 띄우면 롤업 · 사전 · 대조군 없이 돈다 — S3 측정은 S3 스냅샷에서만 시작한다.

### S7 ① 계정 · 역할 시드

S7 ①(알람 분기 — 인증 S7 ②보다 먼저)은 §시드 표의 계정 · 역할 세 행을 그대로 채운다 — 문서에 없는 값은 만들지 않고 §미확인 · 미설계 등재에 올린다. 마스터 시드와 **같은 트랜잭션 · 같은 빈 볼륨 규칙**이다. 인증 전 이 계정의 쓰임은 알람 확인의 acked_by 대리 하나다([../07_api/07_alarms.md](../07_api/07_alarms.md) §인증 전 확인 행위자 판정).

| 테이블 | 행 | 값 | 정본 |
|------|:------:|------|------|
| role | 3 | role_code OPERATOR · ENGINEER · ADMIN — 이 순서로 넣어 IDENTITY role_id가 빈 볼륨마다 같다 | [01_postgresql_schema.md](./01_postgresql_schema.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §역할 정의 |
| user_account | 1 | email **learner@localhost**(리드 판정 2026-09-26 — 07_api/03 · 08_screen/06 예시 값을 채택 · 비밀이 아닌 설계 값) · password_hash = SEED_USER_PASSWORD의 Argon2id 자기 기술 문자열(비용 파라미터 2계층 미정) · is_active 참 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) #8 |
| user_role | 3 | 학습자 계정 × 역할 3 | REQ-AUT-17 |
| audit_log | 0 | 시드는 감사하지 않는다 | REQ-WRK-07 · 아래 불릿 |

- 검산: 행이 있는 테이블 3 · 시드 행 = 3 + 1 + 3 = **7**

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 비밀번호 | SEED_USER_PASSWORD가 비었거나 자리표시와 같으면 seed 거부 · 원문은 시드 파일 · 로그 · 감사에 남지 않는다 | 모든 환경이 같은 학습자 비밀번호로 돌고 스냅샷 파일이 그 해시를 퍼뜨린다([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)) |
| 시드 대상 | --tier · --slice 어느 쪽이든 계정 · 역할은 같다 | 슬라이스 시드에서 계정이 빠지면 수직 슬라이스 위의 알람 시연에서 확인만 401이 된다 |
| 옛 스냅샷 | S2~S5 스냅샷은 마스터가 차 있어 seed가 거부한다 · **계정만 더하는 부분 시드를 두지 않는다** · 계정이 필요한 측정 · 시연은 migrate → seed를 새로 한 빈 볼륨에서 시작한다 | 부분 시드를 두면 한 볼륨에 두 시드 실행이 섞여 "빈 볼륨 + 같은 시드 = 같은 번호"가 깨진다 |
| 확인 행위자 | 인증 전 행위자 환경변수 ALARM_ACK_ACTOR_EMAIL(정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §환경변수)의 값은 이 계정의 email과 같아야 한다 | 다르면 확인만 401 auth.unauthenticated — 나머지 알람 기능은 돈다 |

- 검산: 규칙 = **4**
- **옛 스냅샷 위에서도 api는 기동한다(B형).** 결론 — 계정이 없어도 판정 · 세 쓰기 · 조회 · 규칙 쓰기는 돌고 확인만 401이다. 반대 시나리오 — 계정 부재를 기동 거부로 막으면 계정 시드 없이 만든 S2~S5 스냅샷에서 알람과 무관한 부하 측정까지 새 이미지로 다시 재지 못한다. 파생 지침 — 확인까지 시연하는 기록은 조건 칸에 계정 시드가 든 스냅샷을 적는다(스냅샷 이름은 §미확인 · 미설계 등재).

- **시드는 감사하지 않는다.** 감사 대상은 사람이 인증된 쓰기 표면으로 일으킨 변경이다(REQ-WRK-07). 시드 행에 감사 행을 만들면 "변경 이력 조회"에 존재하지 않은 변경이 나타난다.

## 시드의 결정성과 무인증 기간

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 빈 볼륨에서만 번호가 정해진다 | IDENTITY는 1부터 발급 — 빈 볼륨 + 같은 시드 = 같은 tag_id | 실험 기록 · 알람 규칙 · 대조 쿼리가 가리키는 tag_id가 환경마다 다르다 |
| 재실행은 자연 키로 건너뛴다 | tag_code · device_code · email · role_code 유일 제약으로 중복을 건너뛴다 | 재실행이 두 번째 태그 집합을 만들어 Collector가 같은 주소를 두 번 폴링한다 |
| 시드 값은 커밋과 함께 고정 | 시드 파일 변경은 측정 조건 변경이다 | 같은 커밋 해시의 두 측정이 다른 태그 구성에서 돈다(D-10 4요소) |
| 무인증 기간 행위자 | **시스템 계정을 시드하지 않는다** — 인증 도입(S7 ②) 전의 감사 행은 user_id NULL · 예외 하나 — 알람 확인의 acked_by는 결합 CHECK가 NULL을 막아 환경변수가 가리키는 학습자 계정으로 대리하고, 그 확인의 감사 행은 여전히 NULL이다([../07_api/07_alarms.md](../07_api/07_alarms.md) §인증 전 확인 행위자 판정) | 시드 계정을 감사 행위자로 쓰면 인증 뒤 같은 계정의 실제 행위와 구분되지 않는다(판정 [01_postgresql_schema.md](./01_postgresql_schema.md) §인계 판정) |

- 검산: 규칙 = **4**
- **학습자 계정은 S7 ①부터 시드된다(as-built — S2~S5 시드는 넣지 않았다 · §S2 적용 범위).** 인증 전에는 로그인 대상이 아니고 알람 확인의 acked_by 대리로만 쓰이며, S7 ②에서 로그인 · 역할 판정의 대상이 된다 — 계정이 있다는 사실과 그 계정이 감사 행위자라는 사실은 다르다.

## 스키마 변경 절차

계약 변경 규칙(원본 data_flow.md §14.2)의 저장소 쪽 절차다.

| 변경 | 허용 | 절차 | 어기면 |
|------|:------:|------|------|
| ClickHouse 컬럼 추가 | 허용 | DEFAULT를 가진 ADD COLUMN IF NOT EXISTS · 롤업 세 테이블은 함께 | DEFAULT가 없으면 기존 파트 읽기가 실패한다 |
| ClickHouse ORDER BY · 파티션 키 변경 | **불가** | 새 테이블 생성 → INSERT SELECT 이관 → 이름 교체 | ALTER로 흉내 내면 정렬이 다른 파트가 섞인다 |
| MV 정의 변경 | 허용 | 주입 정지 → DROP VIEW → 새 순번 파일로 CREATE → 공백 구간 재계산 | 수집 중 교체하면 그 사이 삽입이 롤업되지 않는다(MV 제약 #1) |
| 원천 테이블 변경 시 MV | 주의 | MV 분리 → 테이블 변경 → MV 재생성 | MV가 깨진다(MV 제약 #4) |
| PostgreSQL 컬럼 · CHECK 변경 | 허용 | 순번 마이그레이션 · enum CHECK는 11_glossary/03 개정과 같은 변경 단위 | CHECK와 값 정본이 어긋난다 |
| 보존 기간 변경 | 허용 | [08_retention_lifecycle.md](./08_retention_lifecycle.md) §보존 변경 절차 | MODIFY TTL 기본 동작이 테이블 전체를 다시 쓴다 |
| 시각 컬럼 시간대 인자 · DB 처리 시간대 변경 | 주의 | 파티션 식이 그 컬럼에 기대면 재구성 · 아니면 인자만 교체 · PostgreSQL은 파티션 경계 재구성 — §DB 시간대 전환 | ClickHouse ALTER가 오류 없이 받아 옛 파트의 파티션 ID와 새 파트가 한 파티션에 섞인다 · pg_partman이 옛 경계에 이어 틈 · 어긋난 경계를 만든다(실측) |

- 검산: 변경 유형 = **7**

## 스냅샷과의 관계

스냅샷은 볼륨 4개(pgdata · chdata · redisdata · spooldata)를 컨테이너 정지 후 통째로 묶는다(원본 tech_stack.md §10.3). 마이그레이션 이력은 pgdata 안에 있다.

| 상황 | 동작 | 결과 | 주의 |
|------|------|------|------|
| 복원 후 migrate | PostgreSQL 도구는 이력 이후 순번만 적용 · ClickHouse는 전 파일 멱등 재적용 | 스냅샷보다 새 스키마로 올라간다 | 새 순번이 기존 데이터와 맞지 않으면 복원 직후 실패 — 측정 전에 드러난다 |
| 네 볼륨을 함께 복원 | 한 시점의 전 상태 | 대조군 · tag_raw · Stream · 스풀이 같은 시점 | 이것만 허용한다 |
| 일부 볼륨만 복원 | 예 — chdata만 옛 시점 | Redis의 미소비 엔트리 · PEL이 이미 적재된 배치를 다시 가리키거나, 적재되지 않은 배치가 사라진다 | **금지** — 무손실 · 무중복 판정이 무의미해진다 |
| pg_dump만 복원 | 스키마 · 시드 복원 | 시계열 없음 · tag_id 번호 보존 | 시계열 실험 없이 마스터만 되돌릴 때 |

- 검산: 상황 = **4**
- **네 볼륨은 한 몸이다(B형).** 결론 — 스냅샷과 복원은 항상 네 볼륨을 함께 한다. 반대 시나리오 — ClickHouse만 되돌리면 Redis AOF에 남은 PEL이 이미 사라진 행을 재적재하고 중복 제거 윈도우는 비어 있어 중복이 생긴다. 파생 지침 — 측정 기록의 스냅샷 이름 칸은 볼륨 묶음 하나를 가리킨다(REQ-TEC-08).

## DB 시간대 전환

ADR-27(DB 처리 시간대 UTC · 저장 운영 경계 UTC · 달력 의미 경계만 KST 명시)을 볼륨에 들이는 절차다. 바뀌는 자리 전수는 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록이 갖고, 이 절은 **순서 · 멱등 판정 · 볼륨 상태별 경로**만 갖는다. 저장값(epoch)은 어느 단계에서도 바뀌지 않는다 — 옮겨지는 것은 파티션 경계와 컬럼 메타데이터다.

### 확인한 사실

공식 문서와 임시 객체 실측(2026-09-28 · ClickHouse 26.8.10.6 임시 DB · PostgreSQL 18.6 + pg_partman 5.5.0 임시 스키마 — 시험 뒤 삭제 · 운영 테이블 무변경)으로 확인했다. 공식 문서 출처는 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)에 둔다.

| # | 사실 | 확인 수단 | 절차에 주는 결론 |
|:-:|------|------|------|
| 1 | DateTime · DateTime64는 시각을 Unix 타임스탬프로 저장하고 시간대는 행이 아니라 컬럼 메타데이터에 있다 | 공식 문서(ClickHouse DateTime) | 인자 교체는 데이터를 옮기지 않는다 |
| 2 | 정렬 키 · 파티션 키에 든 DateTime64 컬럼의 인자만 바꾸는 MODIFY COLUMN을 **받는다** — 뮤테이션 0 · 메타데이터만 | 실측 · 공식 문서(기본 키 컬럼 타입 변경은 데이터를 바꾸지 않을 때만 가능) | 허용이 안전을 뜻하지 않는다 — #3 |
| 3 | MODIFY 뒤 **옛 파트는 KST 파티션 ID를 그대로 갖고 새 삽입은 UTC 파티션 ID로 간다.** 같은 ID 아래 다른 날짜 집합이 섞이고, 파티션 식 조건 count(toYYYYMMDD(ts) = D)가 틀린 값을 낸다(실측 44 대 전수 계산 40) · 병합은 같은 파티션 값의 파트끼리만 한다 | 실측 · 공식 문서(사용자 정의 파티션 키) | **파티션 식이 그 컬럼에 기대는 테이블은 재구성한다** — 인자만 바꾸지 않는다 |
| 4 | AggregateFunction 상태 인자 타입(last_v의 DateTime64 시간대)만 바꾸는 MODIFY도 뮤테이션 0으로 받는다 | 실측 | 롤업의 상태 컬럼은 재구성 때 새 정의로 따라온다 |
| 5 | MV는 원천 · 타깃을 이름으로 따른다 — EXCHANGE TABLES 뒤 새 원천 삽입이 MV를 거쳐 새 타깃에 들고 옛 테이블 삽입은 MV를 타지 않는다(Atomic DB) | 실측 | 재생성이 기능상 필수는 아니다 — 그래도 복사 전에 MV를 내리고 복사 뒤 DDL 파일로 다시 만든다(복사분 이중 롤업 방지 · 카탈로그 MV 열 타입 = DDL) |
| 6 | 서버 timezone은 서버 기동 시점에 읽는다 · session_timezone은 시간대 없는 값에만 듣는다 | 공식 문서(DateTime · 세션 설정) | timezone.xml 교체 뒤 재기동 · 세션 설정으로 UTC 컬럼의 출력은 바뀌지 않는다 |
| 7 | timestamptz는 내부 UTC로 저장하고 출력 때 현재 TimeZone으로 바꾼다 · date_trunc(timestamptz)의 기본 경계는 현재 TimeZone이다 | 공식 문서(PostgreSQL 날짜 · 시각 타입 · 함수) | PostgreSQL 전환도 저장값을 바꾸지 않는다 — 인자 없는 date_trunc가 DB 처리 시간대를 따른다 |
| 8 | ALTER DATABASE … SET은 DB 소유자 · 슈퍼유저만 할 수 있고 이후 새 세션부터 듣는다 · DB별 기본값이 postgresql.conf를 덮는다 | 공식 문서(ALTER DATABASE) | DB 기본 timezone은 관리자 단계에 둔다 · 009는 자기 트랜잭션을 SET LOCAL로 UTC로 맞춘다 |
| 9 | create_parent는 경계를 세션 timezone으로 계산한다 — KST 세션의 1 day · 1 month 경계가 15:00Z였다 · 공식 문서는 파티션 세트를 만들고 유지 작업을 부르는 클라이언트까지 UTC로 둘 것을 요구한다 | 실측 · 공식 문서(pg_partman) | 경계는 세션 timezone이 정한다 |
| 10 | KST 경계 세트를 둔 채 세션만 UTC로 바꾸고 유지 작업을 돌리면 **일 세트는 마지막 경계 뒤 하루 틈**(그 사이 행은 기본 파티션으로 간다)이 생기고 **월 세트는 경계가 30일로 밀린다**(11-30 15:00Z → 12-30 15:00Z) | 실측 | **설정만 바꾸는 전환을 금지한다** — 세트를 다시 세운다 |
| 11 | create_partition_time은 넘긴 시각을 하한 그대로 쓴다(내림 없음 — 03:00Z를 넘기면 03:00Z가 하한인 자식이 생긴다) | 실측 · 공식 문서(주어진 시각으로 자식을 만든다) | 모드 D는 UTC 자정 값을 넘긴다(구현 목록 #11) |
| 12 | 새 데이터가 없으면 미리 만들기를 하지 않는다(infinite_time_partitions 기본 false) | 공식 문서 · 실측 | 전환 직후의 미래 자식은 create_parent의 premake가 만든다 |
| 13 | 분리 → part_config 행 삭제 → UTC 세션 create_parent(p_start_partition = UTC 경계) → OVERRIDING SYSTEM VALUE 재삽입 → 옛 자식 삭제가 행 수 · event_id를 보존하고 다음 IDENTITY 값이 이어지며 경계가 UTC다 · **시작 경계가 최소 행의 UTC 경계보다 늦으면 앞 행이 기본 파티션에 간다**(KST 8월 1일 00:00 = 7월 31일 15:00Z 행 1) | 실측(alarm_event 모양 임시 테이블) | 009 절차의 근거 · 시작 경계 = 최소 행을 UTC 간격으로 내린 값 |

- 검산: 사실 = **13** · 실측만 3(#4 · #5 · #10) · 공식 문서만 4(#1 · #6 · #7 · #8) · 둘 다 6(#2 · #3 · #9 · #11 · #12 · #13)

### 빈 볼륨 경로

빈 볼륨은 전환할 것이 없다 — 순서만 맞으면 처음부터 UTC로 선다.

```plain
① PostgreSQL 001(관리자)          DB 기본 timezone 'Asia/Seoul' — 파일 내용 그대로
② 관리자 단계                      ALTER DATABASE plc SET timezone TO 'UTC'(멱등) · pg_partman 준비 · 통계 권한 · 역할 비밀번호
③ 002~008(app_owner 새 세션)       새 세션이라 UTC — 004 · 007의 create_parent가 UTC 경계로 만든다
④ 009                             경계가 이미 UTC → 건너뛴다
⑤ ClickHouse 시간대 전환 단계       판정 대상 테이블 8에 'Asia/Seoul' 컬럼 없음 → 건너뛴다(MV 제외)
⑥ ClickHouse DDL 001~009           시각 컬럼 UTC · mv_tag_1d만 KST 자정 인자
```

- **②가 ③보다 앞서야 한다.** ③의 app_owner 세션이 ② 뒤에 열려야 DB 기본값 UTC를 받는다(확인한 사실 #8) — 순서가 뒤집히면 004 · 007이 KST 경계로 서고 009가 곧바로 재구성한다(결과는 같고 일만 는다).
- **001 파일을 고치지 않는다.** 적용된 순번의 내용을 바꾸면 같은 순번의 두 파일이 생긴다(§PostgreSQL 마이그레이션 008 불릿과 같은 규칙) — 현행 값은 ②가 매번 덮는다.

### 기존 볼륨 경로

001~007(또는 008까지)이 적용되고 ClickHouse가 KST로 선 볼륨이다.

```plain
⓪ 전제            api(적재 · 명령 워커) 정지 · postgresql.conf · timezone.xml 교체 · postgres 설정 재적재 · clickhouse 재기동
① 관리자 단계      DB 기본 timezone UTC
② 008 · 009        migrate 실행 하나 = 한 트랜잭션(대기 순번 전체) · 009가 부모 둘(alarm_event · plc_tag_raw_control)을 차례로:
                     SET LOCAL timezone 'UTC' → 경계 판정(자식 하한이 UTC 자정 · 월초가 아니면 대상)
                     → 자식 전부(기본 포함) DETACH · 이름 바꿈 → part_config 행 삭제
                     → create_parent(같은 간격 · p_start_partition = 옛 행 최솟값을 UTC 간격으로 내린 값 · 행 없으면 현재)
                     → 보존 설정 복원(alarm_event 2 years · 분리 보존 · 대조군 7 days · 삭제)
                     → 옛 자식 행 재삽입(alarm_event는 OVERRIDING SYSTEM VALUE) → 행 수 대조 → 옛 자식 DROP
                     → 재구성을 했을 때만 pgmigrations.run_on 보정(이 트랜잭션이 넣지 않은 행을 KST 벽시계 → UTC 벽시계로)
③ ClickHouse 전환  판정 대상 테이블 8마다 카탈로그(system.columns) 판정 — MV 제외:
                     파티션 식이 시각 컬럼에 기대는 5(tag_raw · alarm_eval · tag_1m · tag_1h · tag_1d)
                       MV 3 DROP(입구 mv_tag_1m 먼저) → UTC 정의로 새 테이블(tag_1m을 tag_1h · tag_1d보다 먼저)
                       → INSERT SELECT(insert_deduplicate 0 · deduplicate_insert_select disable · 컬럼 목록에 ingested_at 명시)
                       → 행 수 · countMerge 대조 → EXCHANGE TABLES → 옛 테이블 DROP
                     파티션 식이 기대지 않는 3(업무 대조) — MODIFY COLUMN 인자만(메타데이터)
④ ClickHouse DDL   전 파일 재적용 — MV 3이 위에서 아래로 다시 선다(IF NOT EXISTS)
⑤ api 기동
```

- **③을 DDL 재적용보다 앞에 둔다.** MV가 없는 상태에서 복사해야 원시 복사분이 롤업에 한 번 더 들어가지 않고(롤업은 롤업대로 복사한다), ④가 연쇄 입구를 마지막에 연다(§저장소 간 적용 순서 ⑥).
- **INSERT SELECT에 중복 제거 해제 두 설정을 준다.** 대상 테이블에 비복제 중복 제거 윈도우가 있어 같은 내용 블록이 오류 없이 버려질 수 있다 — 설정 근거는 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §백필 절차 ④와 같다.
- **pgmigrations.run_on을 UTC 벽시계로 옮긴다(구현 i-utc 실측 · 리드 채택).** run_on은 시간대 없는 timestamp(세션 벽시계)이고 순서 검사(checkOrder)는 ORDER BY run_on, id다 — KST로 기록된 옛 행 뒤 9시간 안에 UTC 세션이 009 행을 쓰면 009가 앞에 놓여 이후 모든 migrate가 "preceding already run migration"으로 영구히 실패한다(임시 컨테이너 재현). 009는 재구성을 한 경우(= KST 시대 볼륨)에만 같은 트랜잭션이 넣지 않은 행의 run_on을 9시간 당긴다 — 빈 볼륨 · 이미 UTC면 손대지 않는다.
- **ingested_at을 컬럼 목록에 명시해 복사한다.** 빼면 DEFAULT now64(3)가 복사 시각을 넣어 적재 지연(ingested_at − ts) 이력이 전부 전환 시각으로 바뀐다.
- **tag_raw 복사 중 디스크는 일시 2배를 전제한다.** 옛 테이블은 EXCHANGE · DROP 전까지 남으므로 복사가 끝날 때까지 tag_raw 크기만큼 여유가 더 있어야 한다 — 모자라면 복사가 중간에 실패하고 옛 테이블은 그대로 남는다(멱등 불릿).
- **멱등 판정은 카탈로그다.** 전환 단계는 시작 때 남은 전환용 테이블(이름 접미)을 지우고 판정 대상 테이블 8(tag_raw · alarm_eval · tag_1m · tag_1h · tag_1d · 업무 대조 3) 가운데 'Asia/Seoul' 컬럼이 남은 테이블만 다시 한다 — 옛 테이블은 EXCHANGE 전까지 그대로라 중간에 멈춰도 잃는 것이 없다. **MV는 판정에서 뺀다** — mv_tag_1d.bucket의 DateTime('Asia/Seoul')은 정상(달력 의미 #1)이라 판정에 넣으면 전환이 끝나지 않는다. 009는 migrate 실행 하나의 트랜잭션 안에서 돈다(apps/api/src/db/migrate.ts가 node-pg-migrate에 singleTransaction을 준다 — 대기 순번 전체가 BEGIN · COMMIT 하나) — 부모 둘이 함께 커밋되거나 함께 되돌려지고 부모별 커밋은 없다 · 실패하면 재실행이 처음부터 다시 해 수렴한다 · SET LOCAL은 그 트랜잭션이 끝나면 풀린다.
- **파티션 경계만 옮기는 것이 아니다 — 파티션 ID가 바뀐다.** tag_raw · 대조군의 일 파티션 이름이 UTC 날짜가 되므로 파티션 이름을 KST 날짜로 읽는 코드 · 절차(모드 D 정리 · 대조군 정리)는 구현 목록대로 함께 바뀌어야 한다.

### 스냅샷 복원 뒤

복원은 네 볼륨을 함께 한다(§스냅샷과의 관계). 설정 파일(postgresql.conf · timezone.xml)은 볼륨 밖이라 복원이 되돌리지 않는다.

| 스냅샷 계열 | 복원 시점 스키마 | 복원 뒤 migrate | 결과 |
|------|------|------|------|
| s2-empty-s · s2-empty-slice | PostgreSQL 001 · 002 · ClickHouse 001 · 002 | 관리자 단계 UTC → 003~009(004 · 007이 UTC 세션에서 서서 009 건너뜀) · ClickHouse 전환이 tag_raw만 재구성 · 나머지는 DDL이 UTC로 만든다 | 수렴 |
| s3-base · s3-empty-* · s3-deadband-s · s3-range-s · s4-hist-m · s5-* · s7a-seed-m · lab-exp26-r3-interrupted | 001~007 · ClickHouse 001~008(009 적용 뒤의 스냅샷은 009까지) | 관리자 단계 UTC → 008 · 009(재구성) → ClickHouse 전환(5 재구성 · 업무 대조 인자 교체) → DDL 재적용 | 수렴 — 행이 많을수록 009 · 전환이 오래 걸린다 |
| s0-empty · s0-empty-ch25 | migrate 이전의 수동 실습 스키마 | 대상 밖 | S0 실습 기록으로만 쓴다 |

- 검산: 계열 = **3**
- **복원 뒤 migrate 전에 api를 띄우지 않는다.** 복원 직후 DB 기본값은 볼륨 안의 Asia/Seoul이라(확인한 사실 #8 — DB 기본값이 설정 파일을 덮는다) pg_partman 워커는 KST 세트를 KST로 유지해 어긋나지 않는다. 어긋남은 관리자 단계와 009 사이에 워커가 돌 때만 생길 수 있고, 생겨도 009가 세트 전체를 분리해 다시 세운다.
- **스냅샷 안의 측정 기록 조건은 바뀌지 않는다.** 전환한 볼륨에서 다시 잰 수치는 조건 칸에 ADR-27 이후를 적는다 — 파티션 경계가 달라 파티션 단위 지표(파트 수 · 파티션당 행)가 옛 기록과 직접 비교되지 않는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 마이그레이션 도구 선택 | **W6 판정** — node-pg-migrate SQL 순번 파일 · ClickHouse는 도구 없이 순번 SQL | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| M · M+ · L 티어의 시드 태그 구성 | 닫힘 — §티어 시드 구성(티어별 설비 · 태그/설비 · scan_rate_ms · 요청 산술) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 알람 규칙 시연용 시드 여부(S7) | 닫힘 — 알람 규칙은 시드하지 않는다(현행 0행 유지) · S7 시연은 규칙 쓰기 표면으로 — [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 학습자 계정 비밀번호 주입 방식 | **W7 닫힘** — seed가 SEED_USER_PASSWORD를 읽어 Argon2id로 해시해 넣는다 · 원문은 시드 파일 · 로그 · 감사에 남지 않는다 · 비었거나 자리표시면 seed 거부 | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) |
| 학습자 계정 email 값 | **닫힘(리드 판정 2026-09-26)** — learner@localhost · 예시 값([../07_api/03_auth.md](../07_api/03_auth.md) 로그인 응답 · [../08_screen/06_master_admin.md](../08_screen/06_master_admin.md) 감사 목록)을 채택 · 비밀이 아닌 설계 값이라 시드 코드에 고정한다 | 이 문서 |
| Argon2id 비용 파라미터 값 | 2계층 미정 — S7 로그인 p50 기록과 같은 변경 단위 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) |
| 계정 시드가 든 빈 상태 스냅샷 이름 | 미확인 — S3 이름(s3-base · s3-empty-slice · s3-empty-s)과 같은 모양의 새 이름이 필요하다 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) |
| 도구 관리 테이블을 고정 기준에서 빼는 문장 | 닫힘 — 루트 README 고정 기준 PostgreSQL 테이블 행에 "세는 기준은 부모 테이블" 반영 | [../README.md](../README.md) |
| pg_partman 백그라운드 워커 세션이 DB 기본 timezone을 받는가 | 미확인 — 실측하지 않았다 · postgresql.conf와 DB 기본값을 모두 UTC로 두어 어느 쪽을 받아도 같다 | §DB 시간대 전환 |
| 전환 소요 시간(기존 볼륨 · 격자 스냅샷 10^9행 대조군) | 미확인 — 확정 전 임의 값 고정 금지 · 009와 ClickHouse 전환이 행 전부를 옮긴다 | 구현 웨이브 실측 |
| api · datagen 컨테이너 TZ 값 | **닫힘(리드 판정 2026-09-28)** — UTC · 코드는 TZ에 기대지 않는다 · 화면 표시는 웹이 Asia/Seoul을 명시 | [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록 #24 |

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — 테이블 · 컬럼 정본
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — ClickHouse 객체 목록 · DDL
- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — MV 제약 · 백필
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 보존 변경 절차
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론 · DB 시간대 전환 구현 목록
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-27
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 기동 순서 · 볼륨 · 스냅샷
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — REQ-TEC-05 · 08
