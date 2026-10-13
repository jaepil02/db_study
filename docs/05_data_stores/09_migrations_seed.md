# 마이그레이션 · 시드 (09_migrations_seed)

> **대상**: 스키마 적용의 저장소 간 순서 · PostgreSQL 순번 마이그레이션(D-16 새 기준선 001~008 · 말미 009 비교 사본 TimescaleDB 전환) · ClickHouse DDL 순번 · 도구 관리 테이블 · 시드(S2 슬라이스 · **카드 라인 — 로컬 기본**) · 스키마 변경 절차 · DB 시간대 기준선
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — PostgreSQL 순번 **009 control_timescale** 등재(마지막 순번 008 → **009** · 다음 순번 009 → **010**) · 도입 단락에 말미 009 · 적용 순서 ② 관리자 단계에 **timescaledb 확장** · ③ 002~008 → **002~009** · ②의 확장 생성 불릿 · **009 B형 불릿 신설**(표를 다시 만든다 · 비교 사본 행이 지워진다 · pg_partman은 004 재생용으로 남는다) · 004 · 007 행에 009가 푸는 것 · 도구 관리 테이블 4 → **5**행(대조군 자식 파티션 → **hypertable 칸 · 압축 칸 표** · TimescaleDB 카탈로그 신설 · partman 설정에 관리 대상 없음) · 기준선 경로 ② · ③ 002~005 → **002~009** · 미확인 pg_partman 워커 시간대 행 → **대상 없음** · 관련 문서 — 테이블 수 불변(비교 사본 1 그대로)
> **개정일**: 2026-10-11 — **D-16 웨이브 2 순번 · 카드 라인 시드**(사용자 결정 2026-10-11 결정 2 · 3 · 5) — PostgreSQL 순번 **006 tag_kind · 007 비교 사본 키 · 참조 · 값 규칙 + SECURITY DEFINER 함수 · 008 run_result** 등재 — 새 기준선 001~005 → **001~008**(테이블 8 → **9**) · 다음 순번 006 → **009** · **§시드(카드 라인) 신설**(로컬 기본 — 사이트 1 · 라인 3 · 설비 30 · 접속 설정 30 · 태그 129 · 주기 100 ms 6 · 200 ms 12 · 1000 ms 111 · 형식 3 · 종류 8 — 값 정본 packages/shared card-line.ts) · 미확인 등재 카드 라인 행 닫힘 · 대조군 기본 off → gated · 시드 검산 8 → **9**(run_result 0행)
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제 · 새 기준선**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — PostgreSQL 순번 001~011 → **새 기준선 001~005**(bootstrap · master · guards · control · biz_command_log — 테이블 16 → **8** · 실행 수명 객체 함수 2 · UTC 경계 재구성 009 삭제) · ClickHouse DDL 001~009 → **001~007**(alarm_eval · 업무 대조 3 삭제 — 객체 12 → **8**) · 적용 순서 ③ AUT · ALM · WRK 삭제 · 시드를 S2 슬라이스 기준으로(용량 티어 시드 · 계정 · 역할 시드 삭제 — 시드 테이블 15 → **8**) · §S2 · S3 적용 범위(as-built) · §S7 ① 계정 · 역할 시드 · §스냅샷과의 관계 삭제 · §시드의 결정성과 무인증 기간 → **§시드의 결정성**(무인증 기간 행위자 행 삭제 4 → **3**) · §DB 시간대 전환의 기존 볼륨 경로 · 스냅샷 복원 뒤 삭제(이행 코드 삭제) · 빈 볼륨 경로 → **기준선 경로** · 미확인 11 → **5**행(티어 시드 · 알람 규칙 · 계정 4 · 전환 소요 삭제 · 카드 라인 시드 신설)
> **개정일**: 2026-09-28 — 코드 검수 반영(r-code-api M1 · L1) — §DB 시간대 전환 ③에 **쓰기 정지 확인**(system.processes INSERT · 판정 대상이 남았을 때만) · **EXCHANGE 직전 원본 재검사**(집계 테이블은 countMerge) · PostgreSQL 순번 **011 run_perf 함수 search_path pg_temp 끝 명시** · 이후 변경 대역 011~ → **012~**
> **개정일**: 2026-09-28 — 운영 전환 실측 반영 — ClickHouse 복사 설정에 **optimize_on_insert 0** 추가(집계 테이블 삽입 시 미리 합침으로 행 수 대조가 멈춘 사건)
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
> **원천**: D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · 마이그레이션 009 as-built(infra/postgres/migrations/009_control_timescale.sql · apps/api/src/db/migrate.ts ensureTimescale · 2026-10-12) · D-16(사용자 결정 2026-10-11) · ADR-27(사용자 요구 2026-09-28) · 원본 tech_stack.md §5.1 · §10.3 · §10.5 · §11(커밋 ff66a37) · 원본 architecture.md §3 · §6 · §7 · §18(커밋 ff66a37) · 원본 data_flow.md §10.2 · §14.2(커밋 ff66a37) · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-TEC-05 · [../02_features/03_collector.md](../02_features/03_collector.md) 모드 A SIMULATED 판정 · 옛 순번 · 시드 · 전환 절차 원문 커밋 28c0cc9

**스키마는 순번 마이그레이션으로만 바뀐다**(REQ-TEC-05). 수동 DDL은 새 환경에서 재현되지 않아 **같은 커밋에서 다른 스키마로 측정**하게 만든다. 기동 순서는 migrate(PostgreSQL 마이그레이션 + ClickHouse DDL 순번 파일) → seed다(원본 tech_stack.md §10.5). 스키마 소유권은 api(NestJS) 쪽에 둔다.

이 문서는 **적용 순서와 시드의 모양**을 고정한다. 마이그레이션 도구의 선택과 버전은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)가, migrate · seed 작업의 실행 명령은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)가, 기동 순서(healthcheck · depends_on)는 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)가 갖는다.

**순번은 D-16 새 기준선이다.** 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구를 지우면서(D-16(사용자 결정 2026-10-11)) 남는 객체만 담아 PostgreSQL 001~005 · ClickHouse 001~007로 다시 썼고, 같은 날 직접 비교 · 카드 라인이 006~008을 말미에 더했다 — 지금 기준선은 **PostgreSQL 001~008 · ClickHouse 001~007**이다(결정 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-30). 그 위에 말미 채번 **009**(비교 사본 TimescaleDB 전환 — D-05 부분 개정 · ADR-32)가 쌓여 마지막 순번은 PostgreSQL 009 · ClickHouse 007이다. 옛 순번(PostgreSQL 001~011 · ClickHouse 001~009)이 거친 이행 단계(시간대 전환 · 파티션 경계 재구성 · 실행 수명 객체 함수)는 결과 상태만 기준선에 들어가고 이행 절차는 지웠다 — 옛 원문은 커밋 28c0cc9에 있다.

## 저장소 간 적용 순서

세 저장소의 객체는 서로를 참조한다 — Dictionary는 PostgreSQL 테이블과 계정을, MV는 타깃 테이블을 필요로 한다. 적용은 한 방향으로만 흐른다.

```plain
① PostgreSQL 001(관리자)            pg_stat_statements · app_owner · app_rw · ch_reader · DB 기본 timezone UTC
② 관리자 단계                        pg_partman 확장(partman 스키마) · timescaledb 확장 · 통계 읽기 권한 · 역할 비밀번호(환경변수)
③ PostgreSQL 002~009(app_owner)     MST 6 → 가드 · 권한 · 인덱스 → 대조군 일 파티션 → 원장 → 태그 종류 → 비교 사본 규칙 · 함수 → 실행 보관 → 비교 사본 TimescaleDB 전환
④ ClickHouse 데이터베이스 plc
⑤ ClickHouse 테이블 4              tag_raw · tag_1m · tag_1h · tag_1d
⑥ ClickHouse MV 3(위에서 아래로)   mv_tag_1d → mv_tag_1h → mv_tag_1m
⑦ ClickHouse Dictionary            dict_tag — ①의 ch_reader · ③의 tag_master가 먼저 있어야 한다
⑧ 시드                             PostgreSQL 마스터
⑨ SYSTEM RELOAD DICTIONARY          시드된 태그를 즉시 적재
```

- **⑥을 위에서 아래로 만든다.** mv_tag_1m이 먼저 생기면 그 순간부터 tag_raw 삽입이 tag_1m으로 흐르는데 mv_tag_1h가 아직 없어 그 구간의 시간 · 일 롤업이 빈다. 위에서부터 만들면 연쇄의 입구가 마지막에 열린다.
- **①이 DB 기본 timezone을 UTC로 맞추고 ③은 새 세션으로 돈다(ADR-27).** ③의 app_owner 연결은 ① 뒤에 열린 새 세션이라 DB 기본값 UTC를 받고, 004의 create_parent가 UTC 자정 경계로 대조군 일 파티션을 세운다(§DB 시간대 전환 확인한 사실 #8 · #9). 순서가 뒤집히면 경계가 KST로 서는데 경계를 옮길 재구성 순번이 기준선에 없다. 009의 hypertable 칸 경계는 세션 시간대와 무관하게 epoch 기준 하루 배수(UTC 자정)다.
- **②가 timescaledb 확장을 만든다(ADR-32).** 009가 app_owner로 create_hypertable을 부르므로 확장이 먼저 있어야 한다 — pg_partman 다음 자리에서 CREATE EXTENSION IF NOT EXISTS로 멱등하게 만든다(migrate ensureTimescale). 확장은 shared_preload_libraries에 timescaledb가 실린 서버에서만 만들어진다(설정 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §PostgreSQL 확장과 설정 파일).
- **Redis에는 마이그레이션이 없다.** 키는 런타임이 만들고, 컨슈머 그룹 grp:ingest는 Ingest 기동 시 · grp:biz-writer는 명령 워커 기동 시 **XGROUP CREATE stream:biz:cmd grp:biz-writer 0 MKSTREAM**(시작 ID 0 — 그룹 생성 전에 실린 명령도 읽는다 · $면 그 명령이 영영 소비되지 않는다)이 만든다(ING-01 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). 키 패턴의 정본은 [05_redis_keyspace.md](./05_redis_keyspace.md)이며 스키마 파일이 아니다.
- **⑦이 ③보다 뒤인 이유** — Dictionary 생성 자체는 소스를 즉시 읽지 않지만, 첫 조회 때 소스 계정 · 테이블이 없으면 적재 실패가 LIFETIME마다 반복된다. ⑨는 시드 직후의 첫 조회가 빈 사전을 보지 않게 한다.

## PostgreSQL 마이그레이션

순번 파일 하나가 한 변경 단위다. 아래는 D-16 새 기준선의 순번이다 — 실제 파일 이름 형식은 도구가 정한다.

| 순번 | 내용 | 정본 | 도구 표현 제약 |
|------|------|------|------|
| 001 | 확장 pg_stat_statements · DB 역할 3(app_owner · app_rw · ch_reader — 로그인 기능이 아니라 DB 접속 계정) · DB 기본 timezone UTC — 관리자 계정으로 돈다 | [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 확장 · 역할은 모델 선언으로 표현되지 않는다 |
| 002 | MST 6 테이블 · 결합 CHECK(tag_master_history에 변경자 칸 없음) | [01_postgresql_schema.md](./01_postgresql_schema.md) | 해당 없음 |
| 003 | 가드 트리거 · 추가 전용 권한(REVOKE) · 인덱스 | [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL |
| 004 | 대조군 plc_tag_raw_control · 일 파티션(pg_partman 등록 · UTC 경계 · 보존 7일) · BRIN(007이 지운다) · pg_partman 등록은 009가 푼다 | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | 원시 SQL — 선언적 파티션은 모델 선언 밖이다 |
| 005 | biz_command_log · UNIQUE(cmd_id) · 추가 전용 REVOKE — 업무 쓰기 Redis 경유 | [01_postgresql_schema.md](./01_postgresql_schema.md) §biz_command_log 설계 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 권한 |
| **006** | tag_master.tag_kind text NULL + CHECK 8값(D-16 결정 3 — 카드 라인) | [01_postgresql_schema.md](./01_postgresql_schema.md) | 원시 SQL — 기존 행은 건드리지 않는다(시드가 채운다) |
| **007** | 비교 사본 고침 — TRUNCATE(옛 대조군 행은 키 규칙을 모른 채 쌓였다) · BRIN 삭제 · PRIMARY KEY (device_id, tag_id, ts) · FK device · CHECK 3(NaN 아님 · ±1조 · 품질 7값) · 함수 넷(검사 1 + SECURITY DEFINER 3) · app_rw EXECUTE 3(파티션 준비 함수는 009가 지운다) | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) §비교 사본 함수 | 원시 SQL — 함수 · 권한 |
| **008** | run_result · CHECK 4(type · part · status · ended ≥ started) · 인덱스 (type, part, ended_at DESC) · 추가 전용 REVOKE | [01_postgresql_schema.md](./01_postgresql_schema.md) §run_result 설계 | 원시 SQL — 권한 |
| **009** | 비교 사본 TimescaleDB 전환(D-05 부분 개정 · ADR-32) — pg_partman 등록 해제(part_config 행 · template 표) · control_prepare_range 삭제 · 표 DROP 후 다시 만들기(컬럼 7 · 순서 · 기본 키 · FK device · CHECK 3은 007 그대로 · **비교 사본 행은 지워진다**) · create_hypertable 칸 1일(경계 UTC 자정 · 기본 시각 인덱스 없음) · 열 압축 설정(묶음 device_id · tag_id · 묶음 안 ts · 자동 압축 정책 없음) · 보존 정책 7일 · app_rw UPDATE 회수 · control_clear_range 재정의 · **control_compress_range 신설** · app_rw EXECUTE | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §지금 모양 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) §비교 사본 함수 | 원시 SQL — 확장 함수 · 함수 · 권한 · 확장은 ② 관리자 단계가 먼저 만든다 |
| 010~ | 이후 변경 — 말미 채번 · 재배치 금지 | 변경한 문서 | 해당 없음 |

- 검산: 순번 = 기준선 001~008 8(D-16 정리 5 + 웨이브 2 3) + 말미 009 1(D-05 부분 개정) = **9** · 테이블 = MST 6(002) + 대조군 1(004 · 009가 hypertable로 다시 만든다) + 업무 명령 원장 1(005) + 실행 보관 1(008) = **9** · 옛 AUT 3 · ALM 2 · WRK 3 테이블 · 실행 수명 객체 함수 2 · UTC 경계 재구성(옛 009)은 기준선에 없다(D-16)
- **새 기준선은 빈 볼륨에서만 선다(B형).** 결론 — D-16은 적용된 순번을 고치지 않는다는 규칙의 한 번뿐인 예외로 001부터 다시 썼다. 반대 시나리오 — 옛 순번이 적용된 볼륨에 migrate를 돌리면 이력(pgmigrations)의 이름이 새 파일과 달라 순서 검사(checkOrder)가 거부한다. 파생 지침 — 옛 볼륨은 비우고 ①부터 다시 적용한다 · 이후 변경은 009부터 말미 채번이며 적용된 순번의 내용을 바꾸지 않는다(같은 순번의 두 스키마가 생긴다).
- **006~008은 같은 날 기준선 위에 쌓은 말미 순번이다.** 업무 방해 삭제로 008의 part CHECK가 4값에서 3값으로 줄고 007 · 008 주석이 정리됐다 — 이미 적용된 볼륨은 리드의 마지막 검증에서 비우고 다시 적용한다(같은 순번의 두 스키마를 남기지 않는다). 그 뒤로 006~008의 내용은 바꾸지 않는다.
- **009는 적용된 004 · 007을 고치지 않고 표를 다시 만든다(B형).** 결론 — 선언 분할 표는 hypertable로 바꿀 수 없어 009가 비교 사본을 DROP 후 같은 컬럼 · 키 · 참조 · 값 규칙으로 다시 만들고, 그때 비교 사본 행이 지워진다(넣기가 다시 채운다 — 007의 TRUNCATE와 같은 판단). 반대 시나리오 — 004 · 007을 고쳐 처음부터 hypertable로 만들면 이미 적용한 볼륨과 빈 볼륨이 같은 순번에서 다른 스키마를 갖는다(ADR-30이 금한 모양). 파생 지침 — 빈 볼륨도 004(pg_partman 일 파티션) → 007 → 009 순으로 같은 최종 모양에 닿으므로 pg_partman은 이미지 · 선적재 · ② 확장 생성에 그대로 남고, 009 뒤로 관리 대상이 없다(ADR-32).
- **도구가 무엇이든 원시 SQL 마이그레이션을 쓸 수 있어야 한다.** 파티션 · 트리거 · 권한 · 확장 · BRIN은 ORM 모델 선언으로 표현되지 않는다 — 원본 후보(Prisma Migrate · node-pg-migrate) 중 이 제약으로 **node-pg-migrate**를 골랐다(W6 판정 · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) §마이그레이션 도구 판정).
- **대조군은 SW-09 기본 gated · off여도 초기 스키마에 만든다.** 스위치로 테이블이 생기고 사라지면 스위치 전환이 재기동이 아니라 마이그레이션이 되어, 스위치 = DI 구현 교체라는 제약(ADR-08)이 깨진다.

## ClickHouse DDL 순번

ClickHouse DDL은 순번 SQL 파일로 둔다(원본 tech_stack.md §11). 파일 목록은 적용 순서 그대로다.

| 순번 | 파일 내용 | 정본 | 멱등 수단 |
|:-:|------|------|------|
| 001 | CREATE DATABASE plc | [03_clickhouse_schema.md](./03_clickhouse_schema.md) | IF NOT EXISTS |
| 002 | tag_raw | 상동 | 상동 |
| 003 | tag_1m | [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) | 상동 |
| 004 | tag_1h · tag_1d | 상동 | 상동 |
| 005 | mv_tag_1d · mv_tag_1h | 상동 | 상동 |
| 006 | mv_tag_1m — 연쇄 입구를 마지막에 연다 | 상동 | 상동 |
| 007 | dict_tag | [03_clickhouse_schema.md](./03_clickhouse_schema.md) | 상동 |

- 검산: 객체 = 테이블 4(002 · 003 · 004의 2) + MV 3(005의 2 · 006) + Dictionary 1(007) = **8** · 옛 alarm_eval · 업무 대조 3은 D-16 삭제 · 다음 순번 008
- **시각 컬럼 인자는 처음부터 UTC다(ADR-27).** tag_raw · 롤업의 시각 컬럼은 'UTC'로 서고(tag_1h · tag_1d는 AS plc.tag_1m으로 구조를 물려받는다), mv_tag_1d의 'Asia/Seoul' 인자만 달력 의미 경계로 남는다(005) — 옛 볼륨을 옮기던 ClickHouse 시간대 전환 단계는 기준선에 없다.
- **ClickHouse 쪽에 적용 이력 테이블을 두지 않는다(판정).** 이력 테이블을 plc에 두면 ClickHouse 테이블 수 고정 기준이 바뀐다. 대신 모든 파일을 IF NOT EXISTS로 멱등하게 쓰고 migrate가 **매번 전 파일을 순서대로** 적용한다. 멱등하게 쓸 수 없는 변경(아래 §스키마 변경 절차)은 새 순번 파일이 새 객체를 만드는 모양으로만 한다.
- 비밀번호 같은 비밀 값은 DDL 파일에 쓰지 않고 설정 파일로 주입한다 — dict_tag 소스 비밀번호가 대표 사례다([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)).

## 도구 관리 테이블

마이그레이션 도구 · 확장이 스스로 만드는 테이블은 업무 테이블이 아니다.

| 저장소 | 테이블 | 만드는 주체 | 고정 기준 테이블 수에 드는가 |
|------|------|------|:------:|
| PostgreSQL | 마이그레이션 이력(도구가 이름을 정한다) | 마이그레이션 도구 | 아니다 |
| PostgreSQL | pg_partman 설정 · 기록 테이블(partman 스키마 — 009 뒤 관리 대상 행 없음) | pg_partman | 아니다 |
| PostgreSQL | TimescaleDB 카탈로그 · 작업 테이블(확장 스키마 — _timescaledb_catalog 등) | TimescaleDB | 아니다 |
| PostgreSQL | 비교 사본의 칸(chunk) · 압축 칸 표(_timescaledb_internal 스키마) | TimescaleDB | 아니다 — hypertable(부모 테이블)로 센다 |
| ClickHouse | 없음 — 이력 테이블을 두지 않는다 | 해당 없음 | 해당 없음 |

- 검산: 행 = **5**
- **세는 기준은 "업무 · 실험 스키마가 선언한 부모 테이블"이다.** 자식 파티션 · 칸과 도구 테이블을 세면 파티션 · 칸이 생길 때마다 고정 기준이 흔들린다 — 이 기준은 루트 README 고정 기준 PostgreSQL 테이블 행에 올라 있다.

## 시드

migrate 뒤 seed가 넣는 행이다. 시드 대상은 seed 인자가 고른다 — **--card-line(인자가 없을 때의 기본 · 로컬 기본 — §시드(카드 라인))** · **--slice s2**(시험 · 빈 DB 기동용 S2 슬라이스 — 설비 1 · 태그 8 · [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md)). 둘을 함께 주면 거부한다. 아래 표는 S2 슬라이스의 모양이다. 용량 티어 시드(S · M · M+ · L)는 측정 도구와 함께 D-16으로 지웠다.

| 테이블 | S2 슬라이스 행 수 | 값 규칙 | 근거 |
|------|:------:|------|------|
| site | 1 | timezone 'Asia/Seoul' | CHECK 고정([01_postgresql_schema.md](./01_postgresql_schema.md)) |
| production_line | 1 | 설비 전부를 한 라인에 | S2 시드 최소분(REQ-MST-01) |
| device | 1 | 설비 코드 DEV-001 · is_active true | 해당 없음 |
| modbus_config | 1 | **host 127.0.0.1(컨테이너 루프백)** · port 5020(PlcSim 대역 5020~5119의 첫 칸) · unit_id 1 | 루프백 host = 시뮬레이션 설비 → 정상 값에 SIMULATED(9)([../02_features/03_collector.md](../02_features/03_collector.md)) |
| tag_master | 8 | function_code 3 · 연속 주소(2레지스터 간격) · FLOAT32 · word_order ABCD · scale 1 · offset_value 0 · deadband 0(seed 인자 --deadband가 바꾼다) · scan_rate_ms 1000 · 범위 없음(seed 인자 --range가 건다) | 연속 주소는 블록 병합(원본 data_flow.md §3.1) · deadband 0은 SW-10 off 기준 |
| tag_master_history · biz_command_log · run_result | 0 | 마스터 표면이 이력을 · 명령 적용이 원장을 · 직접 비교 실행이 결과를 만든다 | 시드는 사람이 쓰기 표면으로 만들 데이터를 흉내 내지 않는다 — 시드 행에 원장 행을 만들면 존재하지 않은 명령이 명령 조회에 나타난다 |

- 검산: 시드 행이 있는 테이블 5(site · production_line · device · modbus_config · tag_master) + 0행 3(tag_master_history · biz_command_log · run_result) + 적재가 채우는 대조군 1 = **9** = PostgreSQL 테이블 수 · S2 슬라이스 태그의 tag_kind는 NULL이다(가상 PLC는 GEN_PROFILE 구성을 쓴다)
- **seed는 빈 볼륨 전용 · 한 트랜잭션이다.** 마스터에 행이 있으면 거부한다 — 두 번 시드한 볼륨은 tag_id 공간이 달라 같은 시드의 두 실행이 다른 태그를 본다. 빈 상태로 되돌리는 수단은 볼륨을 비우고 migrate → seed를 다시 하는 것이다(옛 빈 상태 스냅샷 복원은 D-16 삭제).
- **계정 · 역할을 시드하지 않는다(D-16).** 로그인 · 권한이 없어 user_account · role · user_role 테이블 자체가 없다 — 옛 학습자 계정 · 비밀번호 환경변수 · 알람 확인 행위자 대리를 함께 지웠다.
- **BOOL · FC01 · FC02 태그는 시드하지 않는다.** 결합 CHECK가 막아 두었고([02_postgresql_constraints.md](./02_postgresql_constraints.md)) W4 판정도 **시드 금지 유지**다 — SIM이 비트 영역을 응답하지 않는다. 해제 조건 4개는 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) §BOOL 판정이 갖는다.

## 시드(카드 라인)

**로컬 기본 시드다**(D-16 결정 3 — 카드 생산 라인 3개 × 공정 10 = 설비 30). 설비 · 태그 정의의 값 정본은 코드 packages/shared/src/card-line.ts(라인 · 공정 · 태그 템플릿 · 주기 · 범위 · 핵심 값)이고, 시드는 그 템플릿을 그대로 행으로 옮긴다 — 가상 PLC · HMI 개요 · 직접 비교가 같은 정본을 읽어 구성이 어긋나지 않는다. 이 절은 행의 모양과 수를 고정한다.

| 테이블 | 행 수 | 값 규칙 |
|------|:------:|------|
| site | 1 | CARD-FAB '카드 공장' · timezone 기본 'Asia/Seoul' |
| production_line | 3 | L1 '라인 1' · L2 '라인 2' · L3 '라인 3' |
| device | 30 | 설비 코드 {라인}-{공정}(L1-PRT … L3-PAC) · 이름 '라인 1 인쇄' 꼴 · vendor 'SIM' · model 공정 코드 · is_active true |
| modbus_config | 30 | host 127.0.0.1(루프백 = 시뮬레이션 설비) · port 5020 + 순번(라인 순 → 공정 순 — L1-PRT 5020 … L3-PAC 5049) · unit_id 1 · timeout_ms 3000 · retry_count 0 · max_regs_per_request 125 |
| tag_master | 129 | 공정 템플릿 그대로 — FC03 · 주소는 설비 안에서 형식 워드 수만큼 연속(갭 0 · FLOAT32 · UINT32 2워드 · UINT16 1워드) · word_order 2워드 ABCD · 1워드 NULL · scale 1 · offset_value 0 · deadband 0(--deadband가 바꾼다) · scan_rate_ms · range · unit · **tag_kind** 템플릿 값 · --range는 거부한다(태그별 범위가 템플릿에 있다) |

- 검산: 행 = 1 + 3 + 30 + 30 + 129 = **193**

| 공정(순서) | 코드 | 태그 수 | 0.1초 | 0.2초 | 1초 | 핵심 값 |
|------|------|:--:|:--:|:--:|:--:|------|
| 인쇄(1) | PRT | 4 | 0 | 0 | 4 | 인쇄 속도 |
| 합지(2) | COL | 4 | 0 | 0 | 4 | 이송 속도 |
| 라미네이팅(3) | LAM | 5 | 0 | 1 | 4 | 상판 온도 |
| 펀칭(4) | PUN | 4 | 1 | 0 | 3 | 타발 속도 |
| 핫스탬핑(5) | HST | 4 | 0 | 1 | 3 | 헤드 온도 |
| 칩 홈 가공(6) | MIL | 4 | 1 | 1 | 2 | 스핀들 회전수 |
| 칩 삽입(7) | EMB | 5 | 0 | 1 | 4 | 핫멜트 온도 |
| 개인화(8) | PER | 5 | 0 | 0 | 5 | 처리 속도 |
| 검사(9) | INS | 5 | 0 | 0 | 5 | 검사 속도 |
| 포장(10) | PAC | 3 | 0 | 0 | 3 | 포장 속도 |

- 검산: 라인당 태그 4 + 4 + 5 + 4 + 4 + 4 + 5 + 5 + 5 + 3 = **43** · 주기별 0.1초 2 + 0.2초 4 + 1초 37 = **43** · 라인 3이라 설비 30 · 태그 43 × 3 = **129** · 주기별 100 ms 6 · 200 ms 12 · 1000 ms 111 = **129**(seed 완료 줄과 같다)
- 검산: 명목 초당 점 = 라인당 2 × 10 + 4 × 5 + 37 × 1 = **77** · × 3 = **231**(설비 가동 · 통신 중 30대 — HMI 개요 nominal의 상한 · packages/shared nominalPointsPerSec)
- 검산: 형식별 FLOAT32 60 + UINT32 39(수량) + UINT16 30(상태) = **129** · 종류별 TEMP 15 · PRESSURE 9 · SPEED 21 · CURRENT 3 · VIBRATION 3 · COUNT 39 · STATE 30 · OTHER 9 = 15 + 9 + 21 + 3 + 3 + 39 + 30 + 9 = **129**
- **모든 설비가 상태(STATE · UINT16 · 0 정지 · 1 대기 · 2 가동)와 수량(COUNT · UINT32 — 단조 누적) 태그를 가진다.** HMI의 상태 4 판정과 직접 비교의 일별 생산량(daily-output)이 이 두 종류에 기댄다 — 템플릿에서 빼면 개요가 그 설비를 늘 통신 끊김으로 본다.
- **시연 전용 설비(DEMO-FLOW-DEV)는 시드하지 않는다** — 흐름 시연 · 무결성 시험이 처음 필요할 때 업무 명령으로 만든다(기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §시연 전용 행). 카드 라인 코드 모양(L1~L3-공정 3글자)이 아니라 HMI 개요 · 직접 비교 대상에서 빠진다.
- **설비 30은 PlcSim 대역 5020~5119(100칸) 안이다** — 시드가 대역을 넘는 설비 수를 거부한다.

## 시드의 결정성

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 빈 볼륨에서만 번호가 정해진다 | IDENTITY는 1부터 발급 — 빈 볼륨 + 같은 시드 = 같은 tag_id | 실험 기록 · 대조 쿼리가 가리키는 tag_id가 환경마다 다르다 |
| 재실행은 자연 키로 건너뛴다 | tag_code · device_code 유일 제약으로 중복을 건너뛴다 | 재실행이 두 번째 태그 집합을 만들어 Collector가 같은 주소를 두 번 폴링한다 |
| 시드 값은 커밋과 함께 고정 | 시드 파일 변경은 측정 조건 변경이다 | 같은 커밋 해시의 두 측정이 다른 태그 구성에서 돈다(D-10 4요소) |

- 검산: 규칙 = **3** · 옛 무인증 기간 행위자 행은 로그인 · 감사 삭제로 D-16 폐지

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

## DB 시간대 전환

ADR-27(DB 처리 시간대 UTC · 저장 운영 경계 UTC · 달력 의미 경계만 KST 명시)을 볼륨에 들이는 자리다. 바뀌는 자리 전수는 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록이 갖는다. D-16 새 기준선은 빈 볼륨에서 처음부터 UTC로 서므로, 옛 기존 볼륨 전환 절차(파티션 경계 재구성 · ClickHouse 테이블 재구성 · 이력 run_on 보정)와 스냅샷 복원 뒤 경로는 이행 코드와 함께 지웠다(원문 커밋 28c0cc9). 남는 것은 그 절차를 정한 **확인한 사실**과 **기준선 경로**다 — 저장값(epoch)은 어느 경로에서도 바뀌지 않는다.

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
| 8 | ALTER DATABASE … SET은 DB 소유자 · 슈퍼유저만 할 수 있고 이후 새 세션부터 듣는다 · DB별 기본값이 postgresql.conf를 덮는다 | 공식 문서(ALTER DATABASE) | DB 기본 timezone은 관리자 계정이 도는 001에 둔다 · 002부터의 새 세션이 받는다 |
| 9 | create_parent는 경계를 세션 timezone으로 계산한다 — KST 세션의 1 day · 1 month 경계가 15:00Z였다 · 공식 문서는 파티션 세트를 만들고 유지 작업을 부르는 클라이언트까지 UTC로 둘 것을 요구한다 | 실측 · 공식 문서(pg_partman) | 경계는 세션 timezone이 정한다 |
| 10 | KST 경계 세트를 둔 채 세션만 UTC로 바꾸고 유지 작업을 돌리면 **일 세트는 마지막 경계 뒤 하루 틈**(그 사이 행은 기본 파티션으로 간다)이 생기고 **월 세트는 경계가 30일로 밀린다**(11-30 15:00Z → 12-30 15:00Z) | 실측 | **설정만 바꾸는 전환을 금지한다** — 세트를 다시 세운다 |
| 11 | create_partition_time은 넘긴 시각을 하한 그대로 쓴다(내림 없음 — 03:00Z를 넘기면 03:00Z가 하한인 자식이 생긴다) | 실측 · 공식 문서(주어진 시각으로 자식을 만든다) | 과거 일 파티션을 만드는 호출은 UTC 자정 값을 넘긴다 |
| 12 | 새 데이터가 없으면 미리 만들기를 하지 않는다(infinite_time_partitions 기본 false) | 공식 문서 · 실측 | 전환 직후의 미래 자식은 create_parent의 premake가 만든다 |
| 13 | 분리 → part_config 행 삭제 → UTC 세션 create_parent(p_start_partition = UTC 경계) → OVERRIDING SYSTEM VALUE 재삽입 → 옛 자식 삭제가 행 수 · event_id를 보존하고 다음 IDENTITY 값이 이어지며 경계가 UTC다 · **시작 경계가 최소 행의 UTC 경계보다 늦으면 앞 행이 기본 파티션에 간다**(KST 8월 1일 00:00 = 7월 31일 15:00Z 행 1) | 실측(alarm_event 모양 임시 테이블) | 옛 009 재구성 절차의 근거(D-16 기준선에서 삭제) — 이미 선 세트의 경계를 옮겨야 하는 날 다시 쓰는 사실이다 · 시작 경계 = 최소 행을 UTC 간격으로 내린 값 |

- 검산: 사실 = **13** · 실측만 3(#4 · #5 · #10) · 공식 문서만 4(#1 · #6 · #7 · #8) · 둘 다 6(#2 · #3 · #9 · #11 · #12 · #13)

### 기준선 경로

빈 볼륨은 전환할 것이 없다 — 순서만 맞으면 처음부터 UTC로 선다.

```plain
① PostgreSQL 001(관리자)          ALTER DATABASE plc SET timezone TO 'UTC' — 이후 새 세션이 받는다
② 관리자 단계                      pg_partman · timescaledb 준비 · 통계 읽기 권한 · 역할 비밀번호
③ 002~009(app_owner 새 세션)       새 세션이라 UTC — 004의 create_parent가 UTC 경계로 만든다 · 009의 칸 경계는 epoch 기준 UTC 자정
④ ClickHouse DDL 001~007           시각 컬럼 UTC · mv_tag_1d만 KST 자정 인자
```

- **①이 ③보다 앞서야 한다.** ③의 app_owner 세션이 ① 뒤에 열려야 DB 기본값 UTC를 받는다(확인한 사실 #8) — 순서가 뒤집히면 004가 KST 경계로 서고, 설정만 바꾸는 전환은 틈과 밀린 경계를 낸다(사실 #10). 경계를 옮길 순번이 기준선에 없으므로 그 볼륨은 비우고 다시 만든다.
- **옛 볼륨은 전환하지 않고 비운다.** 옛 순번 이력이 남은 볼륨은 순서 검사가 거부한다(§PostgreSQL 마이그레이션) — 전환 단계가 없으므로 볼륨을 비우고 ①부터 다시 적용한다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 마이그레이션 도구 선택 | **W6 판정** — node-pg-migrate SQL 순번 파일 · ClickHouse는 도구 없이 순번 SQL | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| 로컬 기본 시드(카드 라인 — D-16) | **닫힘** — §시드(카드 라인)(행 193 · 태그 129 · 값 정본 packages/shared/src/card-line.ts) | 이 문서 |
| 도구 관리 테이블을 고정 기준에서 빼는 문장 | 닫힘 — 루트 README 고정 기준 PostgreSQL 테이블 행에 "세는 기준은 부모 테이블" 반영 | [../README.md](../README.md) |
| pg_partman 백그라운드 워커 세션이 DB 기본 timezone을 받는가 | **대상 없음(009 · ADR-32)** — 009가 비교 사본을 pg_partman 관리에서 빼 워커가 유지할 세트가 없다 · 어느 시간대를 받는지는 실측하지 않은 채 남는다(postgresql.conf와 DB 기본값이 모두 UTC — 세트를 다시 두는 날에도 어느 쪽을 받아도 같다) | §DB 시간대 전환 |
| api · datagen 컨테이너 TZ 값 | **닫힘(리드 판정 2026-09-28)** — UTC · 코드는 TZ에 기대지 않는다 · 화면 표시는 웹이 Asia/Seoul을 명시 | [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록 #24 |

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — 테이블 · 컬럼 정본
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — ClickHouse 객체 목록 · DDL
- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — MV 제약 · 백필
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 보존 변경 절차
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 비교 사본 계약(004 · 007 · 009)
- [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) — 파생 이미지 · PostgreSQL 확장 · 선적재
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 시각 의미론 · DB 시간대 전환 구현 목록
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-27 · ADR-30 · ADR-32
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 기동 순서 · 볼륨
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — REQ-TEC-05
