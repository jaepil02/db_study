# 마이그레이션 · 시드 (09_migrations_seed)

> **대상**: 스키마 적용의 저장소 간 순서 · PostgreSQL 순번 마이그레이션 · ClickHouse DDL 순번 · 도구 관리 테이블 · 시드(사이트 · 라인 · 설비 · 접속 설정 · 태그 · 계정 · 역할) · 스키마 변경 절차 · 스냅샷과의 관계
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — S2 구현 반영 — §S2 적용 범위(as-built) 신설(PostgreSQL 001 · 002 · ClickHouse 001 · 002 · 시드 --tier · --slice · changed_by 외래 키 003) · tag_master 시드 data_type 혼합(16 · 32비트) → **06_pipeline/10 §티어 시드 구성 인용(S = FLOAT32 · ABCD)** — 두 정본 불일치 해소
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약) · BOOL · FC01 · FC02 시드 금지 근거를 W4 판정으로 갱신 · 도구 관리 테이블 제외 기준의 루트 README 반영 완료 표기
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(티어 시드 구성 · 알람 규칙 시드)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 학습자 계정 비밀번호 주입 방식 닫힘 — SEED_USER_PASSWORD · Argon2id 해시 · 원문 비저장(정본 12_security/02)
> **개정일**: 2026-09-24 — W6 판정 반영 — 마이그레이션 도구 선택 → **node-pg-migrate**(SQL 순번 파일 · Prisma Migrate 채택하지 않음 — 정본 09_tech_stack/05)
> **원천**: 원본 tech_stack.md §5.1 · §10.3 · §10.5 · §11(커밋 ff66a37) · 원본 architecture.md §3 · §6 · §7 · §18(커밋 ff66a37) · 원본 data_flow.md §10.2 · §14.2(커밋 ff66a37) · 웨이브 인계 W3 05_data_stores/01 · 09 행(무인증 기간 감사 행위자) · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-TEC-05 · REQ-TEC-08 · [../02_features/03_collector.md](../02_features/03_collector.md) 모드 A SIMULATED 판정 · [../03_requirements/02_auth.md](../03_requirements/02_auth.md) REQ-AUT-17

**스키마는 순번 마이그레이션으로만 바뀐다**(REQ-TEC-05). 수동 DDL은 스냅샷 복원 · 새 환경에서 재현되지 않아 **같은 커밋에서 다른 스키마로 측정**하게 만든다. 기동 순서는 migrate(PostgreSQL 마이그레이션 + ClickHouse DDL 순번 파일) → seed다(원본 tech_stack.md §10.5). 스키마 소유권은 api(NestJS) 쪽에 둔다.

이 문서는 **적용 순서와 시드의 모양**을 고정한다. 마이그레이션 도구의 선택과 버전은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)가, migrate · seed · snapshot · restore 작업의 실행 명령은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)가, 기동 순서(healthcheck · depends_on)는 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)가 갖는다.

## 저장소 간 적용 순서

세 저장소의 객체는 서로를 참조한다 — Dictionary는 PostgreSQL 테이블과 계정을, MV는 타깃 테이블을 필요로 한다. 적용은 한 방향으로만 흐른다.

```plain
① PostgreSQL 확장 · DB 역할      pg_stat_statements · pg_partman · auto_explain · app_owner · app_rw · ch_reader
② PostgreSQL 업무 테이블          MST → AUT → ALM → WRK 순(FK 방향)
③ PostgreSQL 파티션 · 트리거 · 권한 alarm_event 월 파티션 · 대조군 일 파티션 · 가드 트리거 · REVOKE
④ ClickHouse 데이터베이스 plc
⑤ ClickHouse 테이블 5            tag_raw · alarm_eval · tag_1m · tag_1h · tag_1d
⑥ ClickHouse MV 3(위에서 아래로) mv_tag_1d → mv_tag_1h → mv_tag_1m
⑦ ClickHouse Dictionary          dict_tag — ①의 ch_reader · ②의 tag_master가 먼저 있어야 한다
⑧ 시드                           PostgreSQL 마스터 · 계정 · 역할
⑨ SYSTEM RELOAD DICTIONARY        시드된 태그를 즉시 적재
```

- **⑥을 위에서 아래로 만든다.** mv_tag_1m이 먼저 생기면 그 순간부터 tag_raw 삽입이 tag_1m으로 흐르는데 mv_tag_1h가 아직 없어 그 구간의 시간 · 일 롤업이 빈다. 위에서부터 만들면 연쇄의 입구가 마지막에 열린다.
- **Redis에는 마이그레이션이 없다.** 키는 런타임이 만들고, 컨슈머 그룹 grp:ingest는 Ingest 기동 시 XGROUP CREATE MKSTREAM이 만든다(ING-01). 키 패턴의 정본은 [05_redis_keyspace.md](./05_redis_keyspace.md)이며 스키마 파일이 아니다.
- **⑦이 ②보다 뒤인 이유** — Dictionary 생성 자체는 소스를 즉시 읽지 않지만, 첫 조회 때 소스 계정 · 테이블이 없으면 적재 실패가 LIFETIME마다 반복된다. ⑨는 시드 직후의 첫 조회가 빈 사전을 보지 않게 한다.

## PostgreSQL 마이그레이션

순번 파일 하나가 한 변경 단위다. 아래는 초기 스키마의 순번 대역 설계다 — 실제 파일 이름 형식은 도구가 정한다.

| 대역 | 내용 | 정본 | 도구 표현 제약 |
|------|------|------|------|
| 001 | 확장 3 · DB 역할 3 · DB 기본 timezone Asia/Seoul | [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 확장 · 역할은 모델 선언으로 표현되지 않는다 |
| 002 | MST 6 테이블 · 결합 CHECK | [01_postgresql_schema.md](./01_postgresql_schema.md) | 해당 없음 |
| 003 | AUT 3 테이블 | 상동 | 해당 없음 |
| 004 | ALM 2 테이블 · alarm_event 월 파티션(pg_partman 등록) | 상동 · [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL — 선언적 파티션은 모델 선언 밖이다 |
| 005 | WRK 3 테이블 | [01_postgresql_schema.md](./01_postgresql_schema.md) | 해당 없음 |
| 006 | 가드 트리거 · 추가 전용 권한(REVOKE) · 인덱스 | [02_postgresql_constraints.md](./02_postgresql_constraints.md) | 원시 SQL |
| 007 | 대조군 plc_tag_raw_control · 일 파티션 · BRIN | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) | 원시 SQL |
| 008~ | 이후 변경 — 말미 채번 · 재배치 금지 | 변경한 문서 | 해당 없음 |

- 검산: 초기 대역 = 001~007 = **7** · 초기 테이블 = MST 6 + AUT 3 + ALM 2 + WRK 3 + 대조군 1 = **15**
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

- 검산: 객체 = 테이블 5(002 · 003 · 004 · 005의 2) + MV 3(006의 2 · 007) + Dictionary 1(008) = **9** — 고정 기준과 같다
- **ClickHouse 쪽에 적용 이력 테이블을 두지 않는다(판정).** 이력 테이블을 plc에 두면 ClickHouse 테이블 수 고정 기준(5)이 바뀐다. 대신 모든 파일을 IF NOT EXISTS로 멱등하게 쓰고 migrate가 **매번 전 파일을 순서대로** 적용한다. 멱등하게 쓸 수 없는 변경(아래 §스키마 변경 절차)은 새 순번 파일이 새 객체를 만드는 모양으로만 한다.
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
| alarm_rule · work_order · production_log · audit_log · tag_master_history · alarm_event | 0 | 표면(S4 · S7)이 만든다 | 시드는 사람이 쓰기 표면으로 만들 데이터를 흉내 내지 않는다 |

- 검산: 시드 행이 있는 테이블 8(site · production_line · device · modbus_config · tag_master · user_account · role · user_role) + 0행 6 = **14** · 대조군은 적재가 채운다
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

- **시드는 감사하지 않는다.** 감사 대상은 사람이 인증된 쓰기 표면으로 일으킨 변경이다(REQ-WRK-07). 시드 행에 감사 행을 만들면 "변경 이력 조회"에 존재하지 않은 변경이 나타난다.

## 시드의 결정성과 무인증 기간

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 빈 볼륨에서만 번호가 정해진다 | IDENTITY는 1부터 발급 — 빈 볼륨 + 같은 시드 = 같은 tag_id | 실험 기록 · 알람 규칙 · 대조 쿼리가 가리키는 tag_id가 환경마다 다르다 |
| 재실행은 자연 키로 건너뛴다 | tag_code · device_code · email · role_code 유일 제약으로 중복을 건너뛴다 | 재실행이 두 번째 태그 집합을 만들어 Collector가 같은 주소를 두 번 폴링한다 |
| 시드 값은 커밋과 함께 고정 | 시드 파일 변경은 측정 조건 변경이다 | 같은 커밋 해시의 두 측정이 다른 태그 구성에서 돈다(D-10 4요소) |
| 무인증 기간 행위자 | **시스템 계정을 시드하지 않는다** — S4~S6 감사 행은 user_id NULL | 시드 계정을 행위자로 쓰면 S7 이후 같은 계정의 실제 행위와 구분되지 않는다(판정 [01_postgresql_schema.md](./01_postgresql_schema.md) §인계 판정) |

- 검산: 규칙 = **4**
- **학습자 계정은 S7 이전에도 시드된다.** 인증이 없는 S4~S6에는 쓰이지 않고 S7에서 로그인 · 역할 판정의 대상이 된다 — 계정이 있다는 사실과 그 계정이 행위자라는 사실은 다르다.

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

- 검산: 변경 유형 = **6**

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

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 마이그레이션 도구 선택 | **W6 판정** — node-pg-migrate SQL 순번 파일 · ClickHouse는 도구 없이 순번 SQL | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |
| M · M+ · L 티어의 시드 태그 구성 | 닫힘 — §티어 시드 구성(티어별 설비 · 태그/설비 · scan_rate_ms · 요청 산술) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 알람 규칙 시연용 시드 여부(S7) | 닫힘 — 알람 규칙은 시드하지 않는다(현행 0행 유지) · S7 시연은 규칙 쓰기 표면으로 — [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 학습자 계정 비밀번호 주입 방식 | **W7 닫힘** — seed가 SEED_USER_PASSWORD를 읽어 Argon2id로 해시해 넣는다 · 원문은 시드 파일 · 로그 · 감사에 남지 않는다 · 비었거나 자리표시면 seed 거부 | [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) |
| 도구 관리 테이블을 고정 기준에서 빼는 문장 | 닫힘 — 루트 README 고정 기준 PostgreSQL 테이블 행에 "세는 기준은 부모 테이블" 반영 | [../README.md](../README.md) |

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — 테이블 · 컬럼 정본
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — ClickHouse 객체 목록 · DDL
- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — MV 제약 · 백필
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 보존 변경 절차
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 기동 순서 · 볼륨 · 스냅샷
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — REQ-TEC-05 · 08
