# PostgreSQL 제약 · 인덱스 · 한계 등재 (02_postgresql_constraints)

> **대상**: PostgreSQL 업무 테이블 14의 테이블 간 제약(FK · UNIQUE · 결합 CHECK · 가드 트리거 · DB 권한) · 인덱스 · alarm_event 월 파티션 · 커넥션(ADR-19) · **한계 등재 — 어느 계층도 강제하지 않는 것**의 정본
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §6 설계 결정 · §10.1 · §12 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §4.2 · §7.1 · §8.2 · §13(커밋 ff66a37) · 원본 tech_stack.md §5.1(커밋 ff66a37) · docs_plan.md 이식 패턴 ① 한계 등재 · 웨이브 인계 W3 05_data_stores 행(audit_log 소유) · ADR-16 · ADR-19 · [../README.md](../README.md) 전역 불변식 순서 무관성

컬럼 하나에 걸리는 제약(타입 · NOT NULL · 단일 컬럼 CHECK)은 [01_postgresql_schema.md](./01_postgresql_schema.md)가 갖고, 이 문서는 **둘 이상의 컬럼 · 행 · 테이블에 걸치는 강제**와 그 강제가 끝나는 자리를 갖는다.

**강제는 네 층으로 나뉜다** — 제약(FK · UNIQUE · CHECK) · 가드 트리거 · DB 권한 · 서비스 코드다. 앞의 셋은 DB가 모든 쓰기 경로에 대해 막고, 서비스 코드는 그 코드를 지나는 경로만 막는다. 어느 층도 막지 않는 것은 §한계 등재에 **기록된 상태**로 올린다 — "아무도 책임지지 않는다"는 누락이 아니라 등재된 사실이다.

**전역 불변식 순서 무관성의 잔여 기록 자리가 이 문서다.** Stream 엔트리 순서와 적재 순서의 역전은 무해하다는 판정을 받고 남아 있으며, 그 판정의 근거(시계열이 ts를 자체 보유한다)가 깨지는 조건을 §한계 등재 1행이 경보로 둔다.

## FK 전수

**물리 삭제 표면이 없으므로 ON DELETE는 전부 RESTRICT다.** 논리 삭제(is_active · enabled)만 있는 스키마에서 CASCADE를 두면 수동 DELETE 한 줄이 과거 이력을 연쇄로 지운다.

| # | 참조하는 쪽 | 참조되는 쪽 | ON DELETE | 뜻 |
|:-:|------|------|:------:|------|
| 1 | production_line.site_id | site | RESTRICT | |
| 2 | device.line_id | production_line | RESTRICT | |
| 3 | modbus_config.device_id | device | RESTRICT | 1:1 — PK이자 FK |
| 4 | tag_master.device_id | device | RESTRICT | **갱신 금지** — §가드 트리거 |
| 5 | tag_master_history.old_tag_id | tag_master | RESTRICT | |
| 6 | tag_master_history.new_tag_id | tag_master | RESTRICT | UNIQUE와 함께 계보를 선형으로 |
| 7 | tag_master_history.changed_by | user_account | RESTRICT | NULL 허용 |
| 8 | alarm_rule.tag_id | tag_master | RESTRICT | |
| 9 | alarm_event.rule_id | alarm_rule | RESTRICT | 파티션 테이블에서 나가는 FK |
| 10 | alarm_event.acked_by | user_account | RESTRICT | NULL 허용 |
| 11 | user_role.user_id | user_account | RESTRICT | |
| 12 | user_role.role_id | role | RESTRICT | |
| 13 | work_order.line_id | production_line | RESTRICT | |
| 14 | production_log.order_id | work_order | RESTRICT | |
| 15 | audit_log.user_id | user_account | RESTRICT | NULL 허용 — 무인증 기간 |

- 검산: FK = MST 계열 7(#1~#7) + ALM 3(#8~#10) + AUT 2(#11 · #12) + WRK 3(#13~#15) = **15** · CASCADE **0** · SET NULL **0**
- **교차 저장소 참조에는 FK가 없다.** ClickHouse tag_raw.tag_id · device_id와 alarm_eval.rule_id는 PostgreSQL 키를 가리키지만 두 DB를 묶는 제약은 존재할 수 없다(ADR-16) — §한계 등재 10행.
- 대조군 plc_tag_raw_control은 FK를 하나도 갖지 않는다. 적재 경로에 FK 검사를 넣으면 비교 축 삽입 처리량이 ClickHouse에 없는 비용을 낸다([10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)).

## UNIQUE와 결합 CHECK

| 종류 | 대상 | 식 | 막는 실패 |
|------|------|------|------|
| UNIQUE | site | (site_code) | 같은 코드의 두 사이트 |
| UNIQUE | production_line | (site_id, line_code) | 한 사이트 안 라인 코드 중복 — 원본에 없던 제약 |
| UNIQUE | device | (device_code) | |
| UNIQUE | tag_master | (tag_code) | 동시 등록 두 건이 모두 통과 — 애플리케이션 조회만으로는 못 막는다 |
| UNIQUE | tag_master_history | (new_tag_id) | 한 새 태그의 계보가 둘 |
| UNIQUE | user_account | (email) | |
| UNIQUE | role | (role_code) | |
| UNIQUE | work_order | (order_no) | 동시 등록 경합(REQ-WRK-02) |
| CHECK | tag_master | (word_order IS NULL) = (data_type IN ('UINT16', 'INT16', 'BOOL')) | 16비트 태그에 워드 순서가 붙어 디코더가 워드를 잘못 합친다 |
| CHECK | tag_master | (data_type = 'BOOL') = (function_code IN (1, 2)) | 레지스터 영역을 비트로 읽거나 그 반대 — 레지스터 비트 BOOL은 미확인이라 막아 둔다 |
| CHECK | tag_master | range_min IS NULL 또는 range_max IS NULL 또는 range_min < range_max | 뒤집힌 범위가 모든 값을 BAD_RANGE로 만든다 |
| CHECK | alarm_rule | (threshold_low IS NOT NULL) = (condition_type = 'OUT_OF_RANGE') 이고 threshold_low < threshold | 하한 없는 범위 이탈 · 다른 조건에 남은 하한 |
| CHECK | alarm_event | (acked_by IS NULL) = (acked_at IS NULL) | 누가 없이 언제만 있는 확인 |
| CHECK | alarm_event | (state = 'CLEARED') = (cleared_at IS NOT NULL) 이고 cleared_at ≥ occurred_at | 열린 행에 해제 시각 · 해제가 발생보다 앞섬 |
| CHECK | work_order | planned_end > planned_start | |
| CHECK | tag_master_history | old_tag_id <> new_tag_id | 자기 자신을 계보로 가리킴 |

- 검산: UNIQUE **8** + 결합 CHECK **8** = **16**
- **BOOL과 function_code의 결합은 막아 두는 판정이다.** 레지스터 안 비트를 BOOL로 읽는 경로는 미확인([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md))이다. 확정되면 CHECK를 넓히는 마이그레이션 하나로 열리지만, 열어 둔 채 시작하면 확정 전에 쌓인 태그를 되돌릴 수 없다.

## 가드 트리거와 DB 권한

제약으로 표현할 수 없는 불변 조건(계보 키 · 변환식)을 트리거 하나로, 추가 전용 테이블 둘을 권한으로 막는다. 아래 DDL은 설계 계약이다 — 함수 본문은 구현이 쓴다.

```sql
-- tag_master: 계보 키와 변환식은 갱신하지 않는다 (REQ-MST-06 · REQ-MST-07)
CREATE TRIGGER tag_master_guard_immutable
  BEFORE UPDATE OF tag_id, device_id, scale, offset_value ON tag_master
  FOR EACH ROW WHEN (OLD.tag_id IS DISTINCT FROM NEW.tag_id
                  OR OLD.device_id IS DISTINCT FROM NEW.device_id
                  OR OLD.scale IS DISTINCT FROM NEW.scale
                  OR OLD.offset_value IS DISTINCT FROM NEW.offset_value)
  EXECUTE FUNCTION reject_update();   -- 예외를 던진다 · 서비스는 master.scale_change_forbidden/409로 옮긴다

-- audit_log · tag_master_history: 추가 전용
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, tag_master_history FROM app_rw;
```

- **트리거는 서비스 거절의 백스톱이다.** 서비스가 스케일 PATCH를 409로 먼저 거절하고(REQ-MST-07), 트리거는 서비스를 거치지 않는 경로(수동 SQL · 새 표면의 누락)를 막는다. 트리거가 없으면 psql 한 줄이 과거 값의 공학 단위 의미를 조용히 바꾼다.
- **device_id도 갱신 금지다.** 태그의 설비를 바꾸면 같은 tag_id의 ClickHouse 행이 두 device_id 아래로 갈려 정렬 키(device_id · tag_id · ts) 조회가 과거 구간을 놓친다. 설비 이동은 새 태그 발급이다.
- **추가 전용은 트리거가 아니라 권한으로 막는다.** 애플리케이션 역할에 UPDATE · DELETE 권한이 없으면 어떤 코드 경로도 감사 행을 고칠 수 없다(REQ-WRK-09) — 트리거는 소유자 역할이 끌 수 있지만 부여하지 않은 권한은 코드가 우회할 수 없다.

| DB 역할 | 접속 주체 | 권한 | 막는 것 |
|------|------|------|------|
| app_owner | 마이그레이션 | 스키마 소유 · DDL | 런타임이 DDL을 실행하지 못하게 소유를 가른다 |
| app_rw | api 풀 · 대조군 적재 | 업무 14 SELECT · INSERT · UPDATE(추가 전용 2 제외) · 대조군 INSERT · SELECT | 감사 · 계보 행 수정 · 물리 DELETE |
| ch_reader | ClickHouse Dictionary 소스 | tag_master SELECT만 | Dictionary 소스가 쓰기 권한을 가진다(REQ-MST-11) |

- 검산: DB 역할 = **3** · 가드 트리거 **1** · 권한으로 막는 추가 전용 테이블 **2**
- app_rw에 DELETE를 주지 않으므로 물리 삭제 표면은 코드가 아니라 권한에서 이미 없다. 대조군의 일 파티션 정리는 app_owner가 한다([08_retention_lifecycle.md](./08_retention_lifecycle.md)).

## 인덱스

**업무 테이블은 작아서 순차 스캔이 이기는 구간이 넓다.** 인덱스는 조회 패턴이 문서로 확인되는 자리에만 둔다 — 무분별한 인덱스는 삽입 성능을 해친다(원본 architecture.md §6). PK · UNIQUE가 만드는 인덱스는 따로 세지 않는다.

| # | 인덱스 | 대상 조회 | 근거 |
|:-:|------|------|------|
| 1 | tag_master (device_id, is_active) | Collector 기동 로드 · 설비별 태그 목록 | 원본 architecture.md §6 |
| 2 | alarm_event (rule_id, occurred_at DESC) | 규칙별 이벤트 이력 | 원본 architecture.md §6 · 파티션별 로컬 인덱스 |
| 3 | work_order (line_id, status) | 라인별 진행 지시 | 원본 architecture.md §6 · status가 조회 조건 |
| 4 | alarm_event (occurred_at DESC) WHERE state = 'ACTIVE' | 열린 알람 | REQ-ALM-13 — 열린 행은 소수라 부분 인덱스가 작다 |
| 5 | alarm_event (occurred_at DESC) WHERE acked_at IS NULL | 미확인 알람 | REQ-ALM-13 |
| 6 | production_log (order_id, recorded_at) | 지시별 실적 | REQ-WRK-05 |
| 7 | audit_log (target_table, target_key, acted_at) | 대상 행의 변경 이력 | REQ-WRK-10 · target_key 신설의 이유 |
| 8 | audit_log (acted_at) | 시각 범위 감사 조회 | REQ-WRK-10 범위 조건 |
| 9 | tag_master_history (old_tag_id) | 스케일 변경 계보 역추적 | 트렌드 화면의 전후 구간 연결 |

- 검산: 원본 3(#1~#3) + 신설 6(#4~#9) = **9**
- **alarm_event 인덱스는 파티션마다 생긴다.** 조회에 occurred_at 범위가 없으면 모든 파티션의 인덱스를 훑는다 — 범위 조건 필수(REQ-ALM-13)는 인덱스 수가 아니라 파티션 가지치기를 위한 것이다.
- 대조군 인덱스(BRIN과 btree 변형)는 비교 축 인덱스 크기의 실험 변수라 이 표에 넣지 않는다 — 정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md).

## alarm_event 월 파티션

occurred_at 기준 월 RANGE 파티션이고 pg_partman이 미래 파티션을 미리 만든다(원본 architecture.md §6). 보존 기간과 분리 절차의 정본은 [08_retention_lifecycle.md](./08_retention_lifecycle.md)다.

| 항목 | 결정 | 근거 · 어기면 |
|------|------|------|
| 파티션 키 | occurred_at(측정 시각 ts) | 조회 범위 제한과 오래된 파티션 분리 |
| PK | (event_id, occurred_at) | **파티션 테이블의 PK · UNIQUE는 파티션 키를 포함해야 한다.** event_id만으로는 선언할 수 없다 |
| 경계 시간대 | **Asia/Seoul 월 1일 00:00** — DB 기본 timezone으로 고정 | pg_partman은 경계를 세션 시간대로 계산한다. 세션이 UTC면 월 경계가 KST 1일 09:00이 되어 "이번 달 알람"이 화면의 달과 9시간 어긋난다 |
| 미리 만들기 | 현재 월 + 미래 월 몇 개(현행 값 pg_partman 기본 · 소유 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)) | 파티션이 없는 달의 INSERT는 기본 파티션으로 간다 |
| 기본 파티션 | 둔다 · **비어 있지 않으면 이상 신호** | 시간 압축 생성(모드 B · C)의 과거 ts 이벤트가 기본 파티션에 쌓이면 이후 그 달 파티션 생성이 충돌한다 |
| 조회 조건 | 발생 시각 범위 필수 | 범위 없는 목록 조회는 모든 파티션을 훑어 파티션 분리의 이득이 사라진다(REQ-ALM-13) |

- 검산: 결정 항목 = **6**
- **경계 시간대를 KST로 둔 것은 저장값을 바꾸지 않는다.** timestamptz는 epoch 기준이고 경계 시간대는 "어느 순간에서 파티션이 갈리는가"만 정한다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)). ClickHouse 쪽 달력 경계도 같은 Asia/Seoul이다([03_clickhouse_schema.md](./03_clickhouse_schema.md)).

## 커넥션

ADR-19의 저장소 쪽 계약이다. 풀 크기 · max_connections는 2계층 조정값이며 **이 표가 값의 정본이다**(ADR-19가 이 문서를 소유처로 지정).

| 접속 주체 | 수단 | 현행 상한(참고) | 계약 | 어기면 |
|------|------|------|------|------|
| api 업무 경로 | in-process 풀(pg Pool) | 20 | 요청마다 새 커넥션 금지 · prepared statement 자유 | 커넥션 생성 비용이 CRUD p95에 섞인다 |
| 대조군 적재(SW-09 on) | **전용 커넥션 1개 — 업무 풀과 분리** | 1 | 업무 풀에서 빌리지 않는다 | 대조군 COPY가 업무 풀을 점유해 목표 ② 측정의 CRUD p95가 대조군 비용을 먹는다 |
| ClickHouse Dictionary 소스 | ch_reader | 2 | LIFETIME 주기 조회만 | |
| 호스트 도구 | psql · DBeaver | 나머지 | 학습용 수동 조회 | |
| 합계 상한 | max_connections | 100 | 위 합 + 여유 | |

- 검산: 접속 주체 = **4** · 현행 고정 상한 합 20 + 1 + 2 = 23 < 100
- **PgBouncer를 두지 않는다(ADR-19).** 접속 주체가 api 프로세스 하나라 커넥션 폭발의 발생 조건이 성립하지 않고, 풀러가 없어 prepared statement를 제약 없이 쓴다. 도입 시점은 api 다중 인스턴스(확장 로드맵 2단계)다 — [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md).
- **대조군 전용 커넥션은 이 문서의 신설 판정이다.** ADR-19 본문과의 정합은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)가 확인한다.

## 한계 등재 — 어느 계층도 강제하지 않는 것

이식 패턴 ①의 정본 표다. **강제 주체가 "없음"인 행이 있는 것이 정상이다** — 그 행이 누락이 아니라 기록된 상태라는 것이 이 표의 목적이다. 새 항목은 말미에 더하고 번호를 옮기지 않는다.

| # | 항목 | 강제 주체 | 막는 것과 못 막는 것 | 잔여가 어디에 담기는가 |
|:-:|------|------|------|------|
| 1 | **Stream 엔트리 순서 vs 적재 순서** | 적재 워커 단독 · DB 백스톱 없음 | 막는 것 — 한 배치 안의 행 순서. 못 막는 것 — **배치 간 역전.** 컨슈머 배분이 라운드로빈이고 단일 flusher의 fan-in 도착 순서도 엔트리 순서가 아니며, ClickHouse는 삽입 순서를 보존하지 않는다 | 시계열이 ts를 자체 보유해 무해하다는 판정(전역 불변식 순서 무관성). **순서 의존 집계를 도입하는 순간 이 행이 경보가 된다** — 도입 제안은 이 행을 먼저 닫아야 한다 |
| 2 | **rt:latest 덮어쓰기 순서 역전** | 없음 — HSET은 무조건 덮어쓴다 | 막는 것 — 없음. 못 막는 것 — 두 컨슈머가 같은 설비의 배치를 역순으로 확인하면 **더 오래된 ts의 값이 최신값으로 남는다** | 검증 "rt:latest 대 argMax(value, ts) 일치"(REQ-ING-10) · ts 비교 덮어쓰기 여부는 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4) |
| 3 | **audit_log 쓰기 주체 공유** | 소유 WRK가 기준을 · 변경을 일으킨 도메인(MST · WRK · ALM)이 쓰기를 | 막는 것 — 감사 행의 형식(NOT NULL · FK · 추가 전용 권한). 못 막는 것 — **새 쓰기 표면이 감사를 빠뜨리는 것.** 업무 행 INSERT가 audit_log 행을 요구하는 제약은 없다 | 감사 대상 기준 REQ-WRK-07 · 표면별 1건 쓰기 → audit_log 1행 검증 · [../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md) |
| 4 | **감사 행위자 NULL의 단계 조건** | 없음 — DB는 학습 단계를 모른다 | 막는 것 — 없는 사용자 참조(FK). 못 막는 것 — S7 이후의 user_id NULL 행 | S7 이후 구간 NULL 행 수 0 조회 · 판정 [01_postgresql_schema.md](./01_postgresql_schema.md) §인계 판정 |
| 5 | **대조군 동일 행 보장** | SW-09 동시 적재(ING-11) · 모드 D 구간은 GEN-10 절차 | 막는 것 — 한 배치를 두 저장소에 같은 행으로 싣는 것. 못 막는 것 — 대조군 실패 배치의 **누락**, 크래시 재전달의 **중복**, 두 저장소 보존 삭제 시점의 어긋남 | 구간별 두 저장소 count 정확 일치 확인 뒤에만 대조(REQ-ING-15) · 설계 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) |
| 6 | **과거 행에 붙는 태그명의 시점** | 없음 — Dictionary는 현재 마스터만 안다 | 막는 것 — 비활성 태그의 이름 소실(판정 [07_cross_store_consistency.md](./07_cross_store_consistency.md) — 적재 쿼리에서 is_active 조건 제거). 못 막는 것 — 태그명을 바꾸면 **과거 구간에도 새 이름이 붙는다** | 설계 선택 — 시계열은 불변 사실 · 해석은 조회 시점(ADR-16). 옛 이름이 필요하면 audit_log before를 읽는다 |
| 7 | **스케일 변경의 계보 행 누락** | 서비스 단독 · 가드 트리거는 기존 행 수정만 막는다 | 막는 것 — 기존 태그의 scale · offset_value 수정. 못 막는 것 — 새 태그를 만들고 tag_master_history 행을 빠뜨리는 것 | 스케일 변경 동작의 트랜잭션 순서(REQ-MST-07) · 검증은 발급 1건당 history 1행 |
| 8 | **work_order 전이 쌍** | 서비스의 조건부 UPDATE(REQ-WRK-04) | 막는 것 — 값 집합 밖 status(CHECK). 못 막는 것 — 값 집합 안의 표 밖 전이(COMPLETED → PLANNED)를 수동 SQL로 쓰는 것 | 허용 전이 표 [01_postgresql_schema.md](./01_postgresql_schema.md) · 전이 트리거는 두지 않는다 — 값 확정 직후라 전이 표가 바뀔 여지를 남긴다 |
| 9 | **규칙당 열린 alarm_event 1건** | alarm:state의 단일 판정 경로(event_id 보관) | 막는 것 — 없음(DB 층). 못 막는 것 — 같은 rule_id의 ACTIVE 행 둘. **파티션 테이블의 UNIQUE는 파티션 키를 포함해야 해** rule_id 단독 부분 유일 인덱스를 걸 수 없다 | 판정 경로의 직렬성 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · 검증은 rule_id별 state = 'ACTIVE' 행 수 ≤ 1 조회 |
| 10 | **교차 저장소 참조** | 없음 — 두 DB를 묶는 제약은 없다(ADR-16) | 막는 것 — 없음. 못 막는 것 — 마스터에 없는 tag_id의 tag_raw 행 · 태그의 device_id와 다른 device_id로 적재된 행 · 없는 rule_id의 alarm_eval 행 | 적재 쪽은 마스터에서 온 태그만 발행한다(Collector · 생성기) · dictGet 기본값(빈 문자열)이 드러내는 자리 [07_cross_store_consistency.md](./07_cross_store_consistency.md) |
| 11 | **원시 · 롤업 정합** | 없음 — MV는 원자적이지 않다 | 막는 것 — MV 오류 무시 설정을 끄면 실패가 드러난다. 못 막는 것 — 원시는 확정됐는데 롤업이 빈 구간 | 구간별 count(tag_raw) = countMerge(tag_1m) 대조 · 재계산 절차 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |
| 12 | **DLQ 트리밍** | MAXLEN만 | 막는 것 — DLQ의 메모리 무한 증가. 못 막는 것 — 재처리 전 오래된 DLQ 엔트리가 **조용히 잘리는 것** | dlq_count와 DLQ 길이 대조 · 재처리 경로 [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md)(W4) · 크기 [06_redis_memory.md](./06_redis_memory.md) |
| 13 | **과거 ts 알람 이벤트의 파티션** | 없음 — 기본 파티션이 받는다 | 막는 것 — INSERT 실패(기본 파티션이 있으므로). 못 막는 것 — 기본 파티션 적체와 그 달 파티션 생성 충돌 | 기본 파티션 행 수 0 감시 · §alarm_event 월 파티션 |
| 14 | **무효화 체인 삭제 실패** | TTL만 | 막는 것 — 요청 실패로 번지는 것(degrade · REQ-MST-10). 못 막는 것 — 커밋된 마스터와 다른 **옛 사본이 TTL 동안** 남는 것 | 캐시 삭제 실패 계수 · 키별 TTL [05_redis_keyspace.md](./05_redis_keyspace.md) |

- 검산: 등재 = **14**행 · 강제 주체 "없음"인 행 6(#2 · #4 · #6 · #10 · #11 · #13) + 단독 · 부분 강제 8(#1 · #3 · #5 · #7 · #8 · #9 · #12 · #14) = **14**
- **#9는 DB가 막을 수 없는 것이 구조로 확정된 행이다.** 파티션을 버리면 막을 수 있지만 월 파티션이 주는 범위 조회 · 분리 이득을 잃는다 — 파티션을 고른 대가가 이 행이다.
- **#1과 #2는 같은 뿌리(컨슈머 간 순서 무관)에서 나온 두 결과다.** #1은 ts가 있어 무해하고 #2는 ts를 보지 않는 덮어쓰기라 유해하다 — 순서 무관성이 무해한 것은 **ts로 읽는 소비자에게만**이다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| pg_partman 미리 만들기 개수 · 유지 작업 주기 | 원본 미기재 — 현행 도구 기본값 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(W6) |
| unit만 바꾸는 태그 수정의 허용 여부 | **신규 미확인** — 단위 문자열 변경은 가드 트리거 밖이다. 값의 뜻이 바뀌는 정정인지 표기 정정인지 원본에 없다 | [../07_api/04_master.md](../07_api/04_master.md)(W5) |
| rt:latest 덮어쓰기의 ts 비교 | 한계 등재 #2 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4) |
| 대조군 전용 커넥션과 ADR-19 본문 | 이 문서의 신설 판정 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)(W3 w3-arch 정합) |

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — 컬럼 · 단일 컬럼 제약 · enum 값
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 파티션 보존 · 분리
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — 교차 저장소 참조 · Dictionary
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 인덱스 · 동일 행 보장
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — 순서 무관성 · 불변 사실 기록
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-16 · ADR-19
