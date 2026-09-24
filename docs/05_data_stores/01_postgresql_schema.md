# PostgreSQL 업무 스키마 (01_postgresql_schema)

> **대상**: PostgreSQL 업무 테이블 14의 컬럼 · 타입 · 컬럼 제약 · 도메인 소유 · tag_master_history 설계 · 저장 enum 값 집합 확정(condition_type · severity · work_order.status) · 인계 판정(site.timezone · 알람 담당자 · 무인증 기간 감사 행위자) · 튜닝 파라미터와 조정값 소유처 — 테이블명 · 컬럼명 채번 정본
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §5 · §6 · §12 · §13 · §18(커밋 ff66a37) · 원본 tech_stack.md §5.1 · §10.2(커밋 ff66a37) · 원본 data_flow.md §7 · §8 · §8.2(커밋 ff66a37) · 원본 implementation_plan.md §2.3(커밋 ff66a37) · docs_plan.md 보정 #15 · 웨이브 인계 W3 05_data_stores/01 행 · ADR-16 · ADR-19 · D-04 · D-11 · [../README.md](../README.md) 고정 기준 PostgreSQL 테이블

이 문서는 PostgreSQL에 앉는 **업무 데이터의 모양**을 고정한다. 테이블 수는 루트 고정 기준(업무 14 + 대조군 1)을 그대로 따르고, 이 문서가 채번하는 것은 **컬럼 이름 · 타입 · 컬럼 단위 제약**이다. 테이블 사이의 제약 · 인덱스 · 파티션 · 커넥션 · 한계 등재는 [02_postgresql_constraints.md](./02_postgresql_constraints.md)가, 대조군 plc_tag_raw_control의 명세는 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)가 갖는다.

**PostgreSQL은 분기 ③계층(업무 CRUD)과 ②계층의 확정 이벤트를 받는다.** 시계열 원시값은 한 행도 싣지 않는다 — 대조군은 분기 목적지가 아니라 SW-09 on의 실험 계측물이다(D-04 · D-05). 업무 쓰기는 Stream을 거치지 않고 API 트랜잭션으로 곧장 커밋된다.

**아래 DDL 조각은 설계 계약이지 구현 코드가 아니다.** 마이그레이션 파일의 모양과 도구는 [09_migrations_seed.md](./09_migrations_seed.md)가, 버전은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 정한다.

## 테이블 목록

도메인 소유의 기준은 **쓰기 표면과 수명 주기를 누가 결정하는가**다. 다른 도메인이 같은 트랜잭션에서 쓰는 테이블(audit_log)은 소유와 쓰기가 갈리며 그 잔여는 [02_postgresql_constraints.md](./02_postgresql_constraints.md) 한계 등재가 받는다.

| # | 테이블 | 소유 도메인 | 분기 계층 | 원본 예상 규모 | 수명 | 비고 |
|:-:|------|:---------:|:-------:|------------|------|------|
| 1 | site | MST | ③ | 수백 행 | 무기한 · 물리 삭제 없음 | timezone 컬럼 판정 §인계 판정 |
| 2 | production_line | MST | ③ | 수백 행 | 상동 | |
| 3 | device | MST | ③ | 수백 행 | 상동 · is_active 논리 삭제 | |
| 4 | modbus_config | MST | ③ | 수백 행 | device와 1:1 | host 루프백 = 시뮬레이션 설비 |
| 5 | tag_master | MST | ③ | 수천~수만 행 | 무기한 · tag_id 영구 보존 | 시스템 전체의 메타 원천 |
| 6 | tag_master_history | MST | ③ | 스케일 변경 횟수 | 무기한 · 추가 전용 | **보정 #15 신설** |
| 7 | alarm_rule | ALM | ③ | 수백 행 | 무기한 · enabled로 비활성 | |
| 8 | alarm_event | ALM | ② | 월 수만 행 | 월 파티션 · 보존 정본 08 | ②계층의 PostgreSQL 쓰기 |
| 9 | user_account | AUT | ③ | 수백 행 | 무기한 | 시드로만 생성 |
| 10 | role | AUT | ③ | 3행 | 고정 | 값 OPERATOR · ENGINEER · ADMIN |
| 11 | user_role | AUT | ③ | 수백 행 | 무기한 | 다대다 · 합집합 판정 |
| 12 | work_order | WRK | ③ | 수만~수십만 행 | 무기한 | status 값 §enum 값 확정 |
| 13 | production_log | WRK | ③ | 수만~수십만 행 | 무기한 | 사람이 입력하는 실적 |
| 14 | audit_log | WRK | ③ | 쓰기 표면 호출 수 | 무기한 · 추가 전용 | 쓰기는 MST · WRK · ALM |
| 15 | plc_tag_raw_control | ING | 대조군 | 용량 단계 행 수 | 일 파티션 · 실험 단위 | 명세 정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) |

- 검산: 업무 = MST 6(#1~#6) + ALM 2(#7 · #8) + AUT 3(#9~#11) + WRK 3(#12~#14) = **14** · 대조군 1(#15) · 합계 14 + 1 = **15**
- **소유 테이블이 없는 도메인은 6이다** — COL · SIM · GEN · TSQ · RLT · OBS. ING는 PostgreSQL에서 대조군 하나만 소유한다(ING-11). 도메인 공백의 정본 매트릭스는 [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)다.
- 도구가 스스로 만드는 관리 테이블(마이그레이션 이력 · pg_partman 설정 · 확장 카탈로그)은 업무 테이블이 아니며 위 합계에 넣지 않는다 — 판정 근거는 [09_migrations_seed.md](./09_migrations_seed.md)다.

## 공통 규약

| 규약 | 결정 | 근거 · 어기면 |
|------|------|------|
| 시각 타입 | 전부 timestamptz · 컬럼명은 _at 또는 planned_ 접두 | 원본 architecture.md §6 "시간대 혼동은 시계열 시스템의 최대 버그 원인". timestamp(시간대 없음)는 세션 TimeZone이 바뀌면 같은 문자열이 다른 순간이 된다 |
| 식별자 발급 | integer · bigint 모두 GENERATED ALWAYS AS IDENTITY — 애플리케이션이 값을 넣지 못한다 | BY DEFAULT로 두면 시드 · 수동 INSERT가 번호를 지정해 시퀀스와 충돌하고, tag_id 재사용 금지(원본 architecture.md §12)가 애플리케이션 규율로만 남는다 |
| tag_id 폭 | integer(4바이트) | ClickHouse 모든 행에 실리는 키다 — UUID(16바이트)면 저장량이 4배다(원본 architecture.md §6) |
| 저빈도 참조 키 | integer — site · line · device · rule · user · role | 수천 행을 넘지 않는 마스터에 bigint를 쓰면 ClickHouse UInt32 컬럼과 폭이 어긋난다 |
| 고빈도 누적 키 | bigint — alarm_event · work_order · production_log · audit_log · tag_master_history | 수명이 무기한인 누적 테이블은 21억을 넘는 날 시퀀스가 멈춘다 |
| 닫힌 값 집합 | **text + CHECK** — PostgreSQL enum 타입을 쓰지 않는다 | enum 라벨은 삭제 · 순서 변경이 어렵다. 값 집합의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)이고 CHECK는 그 사본이다 |
| 측정값 | double precision — 알람 trigger_value 포함 | 전역 불변식 "측정값 Float64". numeric으로 받으면 Float64 비트가 10진 변환을 거쳐 ClickHouse alarm_eval.value와 같은 값인지 비트로 대조할 수 없다 |
| 설정 수치 | numeric — scale · offset_value · deadband · range · threshold | 사람이 10진으로 입력하는 설정이다. 0.1을 이진 근사로 저장하면 입력값과 조회값이 달라 보인다 |
| 논리 삭제 | is_active · enabled boolean NOT NULL · 물리 삭제 표면 없음 | 물리 삭제하면 ClickHouse 과거 행의 tag_id · rule_id가 고아가 된다(REQ-MST-06 · REQ-ALM-01) |
| NULL 허용 | 뜻이 있는 부재만 — 아래 명세의 "NULL 뜻" 열에 적힌 것 외에는 NOT NULL | NULL의 뜻이 적히지 않은 컬럼은 구현마다 다른 뜻으로 채워 조회 조건이 갈린다 |

- **닫힌 값 집합을 PostgreSQL enum 타입으로 올리지 않는 것은 B형이다.** 결론 — CHECK 사본은 정본과 두 자리에 있게 된다. 반대 시나리오 — enum 타입이면 work_order.status 값 하나를 폐지할 때 라벨 삭제가 불가능해 타입을 새로 만들고 컬럼을 이관해야 한다. 파생 지침 — CHECK를 고치는 마이그레이션과 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 개정을 같은 변경 단위로 묶는다.

## 테이블 명세 — MST

마스터 6 테이블이다. 쓰기 권한은 ADMIN이고(REQ-MST-15) 쓰기는 audit_log를 같은 트랜잭션에서 쓴다(REQ-MST-05).

| 테이블 | 컬럼 | 타입 | 컬럼 제약 | NULL 뜻 · 설명 |
|------|------|------|------|------|
| site | site_id | integer | PK · IDENTITY ALWAYS | |
| site | site_code | text | NOT NULL · UNIQUE | 사람이 읽는 코드 |
| site | site_name | text | NOT NULL | |
| site | timezone | text | NOT NULL · DEFAULT 'Asia/Seoul' · **CHECK = 'Asia/Seoul'** | 판정 §인계 판정 — 표시 · 달력 경계와 같은 값만 허용 |
| production_line | line_id | integer | PK · IDENTITY ALWAYS | |
| production_line | site_id | integer | NOT NULL · FK site | |
| production_line | line_code | text | NOT NULL · UNIQUE(site_id, line_code) | 원본은 유일 제약이 없다 — 사이트 안 유일로 신설 |
| production_line | line_name | text | NOT NULL | |
| device | device_id | integer | PK · IDENTITY ALWAYS | ClickHouse device_id UInt32의 원천 |
| device | line_id | integer | NOT NULL · FK production_line | |
| device | device_code | text | NOT NULL · UNIQUE | |
| device | device_name | text | NOT NULL | |
| device | vendor · model | text | NULL 허용 | NULL = 미기재 — 시뮬레이션 설비는 비워 둔다 |
| device | is_active | boolean | NOT NULL · DEFAULT true | 논리 삭제(REQ-MST-02) |
| modbus_config | device_id | integer | PK · FK device | 설비 1:1 |
| modbus_config | host | inet | NOT NULL | **루프백이면 시뮬레이션 설비** — SIMULATED(9) 표지의 원천([../02_features/03_collector.md](../02_features/03_collector.md)) |
| modbus_config | port | integer | NOT NULL · CHECK 1~65535 | 시뮬레이션 설비는 5020~5119 |
| modbus_config | unit_id | smallint | NOT NULL · CHECK 0~247 | Modbus 슬레이브 주소 범위 |
| modbus_config | timeout_ms · retry_count | integer · smallint | NOT NULL · CHECK 양수 · 0 이상 | 원본 값 없음 — 설비별 설정 |
| modbus_config | max_regs_per_request | smallint | NOT NULL · CHECK 1~125 | FC03 요청당 상한 125([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)) |
| tag_master | tag_id | integer | PK · IDENTITY ALWAYS | **영구 보존 · 재사용 금지** — 갱신 금지 트리거 [02_postgresql_constraints.md](./02_postgresql_constraints.md) |
| tag_master | device_id | integer | NOT NULL · FK device | |
| tag_master | tag_code | text | NOT NULL · UNIQUE | 비활성 태그도 코드를 점유한다 |
| tag_master | tag_name | text | NOT NULL | dictGet이 조회 시점에 붙인다 |
| tag_master | function_code | smallint | NOT NULL · CHECK IN (1, 2, 3, 4) | |
| tag_master | address | integer | NOT NULL · CHECK 0~65535 | |
| tag_master | data_type | text | NOT NULL · CHECK 7값 | UINT16 · INT16 · UINT32 · INT32 · FLOAT32 · FLOAT64 · BOOL |
| tag_master | word_order | text | NULL 허용 · CHECK 4값 | **NULL = 워드 순서 적용 없음**(16비트 · BOOL) — 결합 규칙은 02 |
| tag_master | scale · offset_value | numeric | NOT NULL · DEFAULT 1 · 0 | **갱신 금지** — 바뀌면 새 tag_id(REQ-MST-07) |
| tag_master | unit | text | NOT NULL · DEFAULT '' | 빈 문자열 = 무차원 |
| tag_master | deadband | numeric | NOT NULL · DEFAULT 0 · CHECK 0 이상 | 공학 단위 절대값 · 0 = 비활성([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)) |
| tag_master | scan_rate_ms | integer | NOT NULL · CHECK 양수 | STALE 판정의 기준 주기 |
| tag_master | range_min · range_max | numeric | NULL 허용 · 둘 다 있으면 min < max | NULL = 범위 판정 없음 — BAD_RANGE를 내지 않는다 |
| tag_master | is_active | boolean | NOT NULL · DEFAULT true | 논리 삭제 · 폴링 대상 여부 |

- 검산: MST 테이블 = site · production_line · device · modbus_config · tag_master + tag_master_history(§tag_master_history 설계) = **6**
- **range_min · range_max를 NULL로 두는 태그는 BAD_RANGE(4)를 받지 않는다.** COUNTER 프로파일처럼 범위가 없는 태그를 억지 범위로 채우면 랩어라운드 순간이 불량으로 집계된다.

## 테이블 명세 — ALM · AUT · WRK

| 테이블 | 컬럼 | 타입 | 컬럼 제약 | NULL 뜻 · 설명 |
|------|------|------|------|------|
| alarm_rule | rule_id | integer | PK · IDENTITY ALWAYS | ClickHouse alarm_eval.rule_id UInt32의 원천 |
| alarm_rule | tag_id | integer | NOT NULL · FK tag_master | 비활성 태그의 규칙 처리는 W4 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) |
| alarm_rule | condition_type | text | NOT NULL · CHECK 4값 | §enum 값 확정 |
| alarm_rule | threshold | numeric | NOT NULL | 조건별 뜻은 §enum 값 확정 |
| alarm_rule | **threshold_low** | numeric | NULL 허용 | **신설** — OUT_OF_RANGE의 하한. 그 외 조건은 NULL |
| alarm_rule | debounce_ms | integer | NOT NULL · CHECK 0 이상 | ts(측정 시각) 기준 경과(REQ-ALM-08) |
| alarm_rule | severity | smallint | NOT NULL · CHECK 1~3 | §enum 값 확정 · alarm_eval.severity로 복사 |
| alarm_rule | enabled | boolean | NOT NULL · DEFAULT true | 규칙을 끄는 유일한 수단(REQ-ALM-01) |
| alarm_event | event_id | bigint | PK(event_id, occurred_at) · IDENTITY ALWAYS | 파티션 키를 PK에 포함해야 한다 — 02 |
| alarm_event | rule_id | integer | NOT NULL · FK alarm_rule | |
| alarm_event | occurred_at | timestamptz | NOT NULL · 파티션 키 | PENDING → ACTIVE를 일으킨 판정 행의 **ts** — 벽시계가 아니다 |
| alarm_event | cleared_at | timestamptz | NULL 허용 | NULL = 열린 이벤트. 해제를 확정한 판정 행의 ts |
| alarm_event | trigger_value | double precision | NOT NULL | 확정 판정 행의 value — Float64 그대로 |
| alarm_event | state | text | NOT NULL · CHECK IN ('ACTIVE', 'CLEARED') | 생애 축 2값(W1 판정) |
| alarm_event | acked_by | integer | NULL 허용 · FK user_account | NULL = 미확인 |
| alarm_event | acked_at | timestamptz | NULL 허용 | acked_by와 짝 — 결합 CHECK는 02 |
| user_account | user_id | integer | PK · IDENTITY ALWAYS | |
| user_account | email | text | NOT NULL · UNIQUE | 소문자 정규화 후 저장 |
| user_account | password_hash | text | NOT NULL | 해시 알고리즘 정본 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md) |
| user_account | is_active | boolean | NOT NULL · DEFAULT true | 비활성 계정 로그인은 auth.invalid_credentials 재사용 |
| role | role_id | smallint | PK · IDENTITY ALWAYS | |
| role | role_code | text | NOT NULL · UNIQUE · CHECK 3값 | OPERATOR · ENGINEER · ADMIN — 누적 아님 |
| user_role | user_id · role_id | integer · smallint | PK(user_id, role_id) · FK 각각 | 다대다 · 합집합 판정 |
| work_order | order_id | bigint | PK · IDENTITY ALWAYS | |
| work_order | line_id | integer | NOT NULL · FK production_line | |
| work_order | order_no | text | NOT NULL · UNIQUE | 중복은 DB 제약 위반 → common.duplicate_key/409 |
| work_order | product_code | text | NOT NULL | 제품 마스터 테이블은 없다 — 자유 문자열 |
| work_order | target_qty | integer | NOT NULL · CHECK 양수 | |
| work_order | planned_start · planned_end | timestamptz | NOT NULL · planned_end > planned_start | |
| work_order | status | text | NOT NULL · DEFAULT 'PLANNED' · CHECK 4값 | §enum 값 확정 |
| production_log | log_id | bigint | PK · IDENTITY ALWAYS | |
| production_log | order_id | bigint | NOT NULL · FK work_order | |
| production_log | recorded_at | timestamptz | NOT NULL | 실적 시각 — 사람이 입력한다 |
| production_log | good_qty · defect_qty | integer | NOT NULL · CHECK 0 이상 | |
| audit_log | audit_id | bigint | PK · IDENTITY ALWAYS | |
| audit_log | user_id | integer | **NULL 허용** · FK user_account | **NULL = 무인증 기간(S4~S6)의 행위** — §인계 판정 |
| audit_log | acted_at | timestamptz | NOT NULL · DEFAULT now() | 트랜잭션 시작 시각 — 같은 트랜잭션의 업무 행과 같은 값 |
| audit_log | action | text | NOT NULL · CHECK IN ('INSERT', 'UPDATE') | 물리 DELETE 표면이 없다 — 논리 삭제 · 확인 · 상태 변경은 UPDATE |
| audit_log | target_table | text | NOT NULL | 업무 테이블 이름 |
| audit_log | **target_key** | text | NOT NULL | **신설** — 대상 행의 PK 값. 복합 키는 컬럼 순서대로 잇는다 |
| audit_log | before_value · after_value | jsonb | before NULL 허용 · after NOT NULL | before NULL = INSERT |

- 검산: 이 표의 테이블 = ALM 2(alarm_rule · alarm_event) + AUT 3(user_account · role · user_role) + WRK 3(work_order · production_log · audit_log) = **8** · MST 6과 합쳐 6 + 8 = **14**
- **audit_log.target_key를 신설한 이유** — 원본은 before · after jsonb뿐이라 INSERT 행의 대상 식별이 after 안에 숨는다. "이 작업지시의 변경 이력"이 jsonb 경로 조회가 되어 인덱스를 탈 수 없다(REQ-WRK-10 범위 조회).
- **alarm_event.occurred_at은 측정 시각이다.** 디바운스를 ts로 재므로(REQ-ALM-08) 발생 시각도 같은 시계를 쓴다. 벽시계로 찍으면 백프레셔 소진 중 확정된 이벤트가 소진 시각에 몰려 "알람 폭주"로 보인다.

## tag_master_history 설계

docs_plan 보정 #15가 신설한 테이블이다. 원본은 "태그 마스터에 변경 이력 테이블 유지"(원본 architecture.md §12)를 요구하고 ERD에는 두지 않았다. 기록 내용의 요구는 REQ-MST-07 — 이전 · 새 tag_id와 변경 전후 값이다.

| 컬럼 | 타입 | 컬럼 제약 | 뜻 |
|------|------|------|------|
| history_id | bigint | PK · IDENTITY ALWAYS | |
| old_tag_id | integer | NOT NULL · FK tag_master | 비활성화된 이전 태그 |
| new_tag_id | integer | NOT NULL · **UNIQUE** · FK tag_master | 새로 발급된 태그 — 한 새 태그의 계보는 한 행이다 |
| old_scale · old_offset_value | numeric | NOT NULL | 이전 태그의 공학 단위 변환식 |
| new_scale · new_offset_value | numeric | NOT NULL | 새 태그의 변환식 |
| changed_at | timestamptz | NOT NULL · DEFAULT now() | 발급 트랜잭션 시각 |
| changed_by | integer | NULL 허용 · FK user_account | audit_log.user_id와 같은 NULL 뜻 |
| reason | text | NULL 허용 | 사람이 적는 사유 |

- 검산: 컬럼 = history_id · old_tag_id · new_tag_id · old_scale · old_offset_value · new_scale · new_offset_value · changed_at · changed_by · reason = **10**
- **이 테이블은 tag_id의 계보만 담는다.** 태그명 · 단위 · 범위 같은 일반 메타 변경은 tag_id를 바꾸지 않으므로 audit_log before · after가 담는다. 모든 변경을 여기에 겹쳐 쓰면 같은 변경의 기록이 두 테이블에 생겨 어느 쪽이 정본인지 갈린다.
- **new_tag_id UNIQUE가 계보를 선형으로 만든다.** 한 새 태그가 두 이전 태그에서 나올 수 없으므로 "이 tag_id의 조상"은 old_tag_id를 따라가는 단일 경로다. 트렌드 화면이 스케일 변경 전후 구간을 이어 그릴 때 이 경로를 쓴다.
- 쓰기는 한 트랜잭션에서 ① 새 태그 INSERT ② 이전 태그 is_active false ③ 이 테이블 INSERT ④ audit_log INSERT 순이다(REQ-MST-07). 이 행이 빠져도 DB는 막지 못한다 — 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md).

## enum 값 확정

웨이브 인계 "condition_type · severity · work_order.status 값 미설계"(W2 · W3 행)를 닫는다. 확정 값은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 미설계 enum 3행의 반영 제안으로 올리고, 이 문서의 CHECK는 그 사본이 된다.

| enum | 값 | 뜻 · 판정 식의 모양 | 원본 근거 | 판정 |
|------|------|------|------|------|
| alarm_rule.condition_type | GT | value > threshold | 조건 종류 "초과"(원본 data_flow.md §8) | 저장 문자열 확정 |
| 상동 | LT | value < threshold | "미만" | 상동 |
| 상동 | OUT_OF_RANGE | value < threshold_low 또는 value > threshold | "범위 이탈" | **threshold_low 신설** — 원본 threshold 하나로 양쪽 경계를 표현할 수 없다 |
| 상동 | RATE_OF_CHANGE | abs(value − 직전 value) ÷ (ts − 직전 ts)초 > threshold | "변화율" | threshold 단위 = 공학 단위/초 · 직전 값은 alarm:state가 보관([05_redis_keyspace.md](./05_redis_keyspace.md)) |
| alarm_rule.severity | 1 LOW | 참고 | smallint · alarm_eval.severity UInt8 복사(원본 architecture.md §6 · §7.3) | 값 범위 1~3 확정 |
| 상동 | 2 MEDIUM | 주의 | 상동 | 상동 |
| 상동 | 3 HIGH | 즉시 대응 | 상동 | 상동 |
| work_order.status | PLANNED | 등록 직후 · 초기 상태 | text · (line_id, status) 인덱스(원본 architecture.md §6) | 확정 |
| 상동 | IN_PROGRESS | 생산 중 | 상동 | 상동 |
| 상동 | COMPLETED | 생산 완료 · 종결 | 상동 | 상동 |
| 상동 | CANCELLED | 취소 · 종결 | 상동 | 상동 |

- 검산: condition_type **4** + severity **3** + work_order.status **4** = 11값
- **OUT_OF_RANGE는 tag_master.range_min · range_max를 쓰지 않는다(A형).** 통념은 "범위 이탈 알람은 태그 범위를 쓴다"이다. 그러나 태그 범위 밖 값은 BAD_RANGE(4)가 되고 BAD 계열은 판정에서 빠진다(REQ-ALM-06) — 태그 범위로 판정하면 이 조건은 **영원히 발생하지 않는다.** 진짜 축은 운전 범위(규칙)와 계측 범위(태그)의 구분이다. 대체 경로 — 규칙이 자기 경계를 갖고, 운전 범위는 계측 범위 안쪽에 둔다.
- **severity를 숫자 3단으로 둔 이유** — 알림 채널이 없어(외부 알림 Out 범위) 심각도가 바꾸는 것은 정렬 · 필터뿐이다. 숫자는 ORDER BY severity DESC 한 줄로 정렬되고 alarm_eval UInt8 복사에 변환이 없다. 문자열이면 두 저장소에서 정렬 규칙을 따로 구현해야 한다.
- **RATE_OF_CHANGE의 직전 값은 판정 경로가 가진다.** 원본 alarm:state 필드(상태 · 연속 위반 횟수 · 최초 위반 시각)에는 직전 값이 없어 이 조건을 판정할 재료가 없었다 — 필드 추가는 [05_redis_keyspace.md](./05_redis_keyspace.md), 판정 식의 기전은 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4)가 소유한다.

### work_order.status 허용 전이

REQ-WRK-04가 요구한 허용 전이 표다. 표 밖 전이는 work_orders.invalid_status_transition/409로 거절한다.

| 이전 | 다음 | 뜻 | 되돌림 |
|------|------|------|------|
| PLANNED | IN_PROGRESS | 생산 착수 | 없음 |
| PLANNED | CANCELLED | 착수 전 취소 | 없음 — 종결 |
| IN_PROGRESS | COMPLETED | 생산 완료 | 없음 — 종결 |
| IN_PROGRESS | CANCELLED | 생산 중단 | 없음 — 종결 |

- 검산: 허용 전이 = **4** · 초기 상태 1(PLANNED) · 종결 상태 2(COMPLETED · CANCELLED)
- **종결에서 나가는 전이가 없다.** COMPLETED를 IN_PROGRESS로 되돌리면 production_log의 실적이 "완료 후 추가 생산"인지 "재개"인지 구분할 수 없다. 잘못 종결한 지시는 새 작업지시로 다시 등록한다.
- 전이 규칙은 조건부 UPDATE 하나(현재 상태 확인과 쓰기 결합)로 서비스가 강제하고 DB CHECK는 값 집합만 막는다 — 전이 쌍의 DB 백스톱 부재는 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md)다.

## 인계 판정

웨이브 인계 W3 05_data_stores/01 행 · 01 · 09 행 · 07 · 01 행에서 이 문서로 온 항목이다.

| 인계 항목 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| site.timezone 용도 vs 표시 Asia/Seoul 고정 | **컬럼을 유지하되 값은 'Asia/Seoul' 하나로 CHECK 고정한다.** 표시 · 달력 경계(tag_1d 하루 · 파티션 경계)는 시스템 단일 시간대이며 이 컬럼이 바꾸지 않는다 | 달력 경계 시간대 판정 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) · [03_clickhouse_schema.md](./03_clickhouse_schema.md) — 모든 사이트가 한 tag_1d를 공유한다 | ① 컬럼 삭제 — 원본 ERD와 어긋나고 다중 시간대 확장의 자리까지 지운다. ② 자유 값 허용 — 다른 값이 들어오는 순간 사이트의 하루와 tag_1d의 하루가 **조용히** 어긋난다 |
| 알람 담당자 배정 컬럼 | **두지 않는다.** alarm_event의 갱신은 확인(acked_by · acked_at)과 해제(state · cleared_at) 둘로 닫는다 | ALM-01~09에 배정 기능이 없다. 원본 "담당자 배정 등"(원본 data_flow.md §8.2)은 PostgreSQL을 고르는 이유의 예시다 | 컬럼만 두기 — 쓰는 기능이 없는 컬럼은 구현이 임의 뜻(최초 확인자 · 규칙 소유자)으로 채워 두 뜻이 섞인다 |
| S4~S6 무인증 기간 audit_log 행위자 | **user_id NULL을 허용하고 NULL = 무인증 기간의 행위로 정의한다.** 시드 계정으로 채우지 않는다 | 인증은 S7이고 마스터 쓰기 감사는 S4부터다(REQ-MST-05 · REQ-WRK-12). 행위자를 모르는 사실을 그대로 기록한다 | 시드 계정 대입 — S7 이후 같은 계정의 실제 행위와 **구분할 수 없어** 감사가 거짓 귀속을 담는다. 시스템 전용 계정 신설 — 계정 생성 표면이 없는 원칙(REQ-AUT-17)에 예외 계정을 만든다 |
| tag_master_history 컬럼 | §tag_master_history 설계 — 10컬럼 · new_tag_id UNIQUE | REQ-MST-07 기록 내용 | 일반 메타 변경까지 담기 — audit_log와 정본이 둘이 된다 |

- 검산: 판정 = **4**
- **S7 이후 user_id NULL은 결함이다.** 인증된 쓰기 표면만 감사 대상이므로(REQ-WRK-07) S7 이후에 NULL 행이 생기면 인증 없이 열린 쓰기 표면이 있다는 뜻이다. DB는 단계를 모르므로 막지 못한다 — 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) · 검증은 S7 이후 구간의 NULL 행 수 0 조회다.
- 시드 쓰기는 감사하지 않는다 — 사람이 쓰기 표면으로 일으킨 변경이 아니다(REQ-WRK-07 기준 · [09_migrations_seed.md](./09_migrations_seed.md)).

## 튜닝 파라미터

**산정 규칙과 현행 값은 이 문서가 소유한다**([../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §메모리 프로파일이 PostgreSQL 내부 설정의 소유처로 이 문서를 가리킨다). 컨테이너 메모리 상한은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md), max_connections · 풀 크기는 [02_postgresql_constraints.md](./02_postgresql_constraints.md)(ADR-19)가 소유하고, 설정 파일의 모양은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 갖는다. 아래 값은 원본 산정의 참고 표기다(2계층).

| 파라미터 | 산정 규칙 | 부하 실험(2.0 GB) | 개발(1.5 GB) | 중간(1.5 GB) | 근거 |
|------|------|------|------|------|------|
| shared_buffers | 컨테이너 상한의 약 25% | 512MB | 256MB | 규칙 도출 — 원본 미기재 | 원본 architecture.md §6 · §13 |
| effective_cache_size | 컨테이너 상한의 약 75% | 1536MB | 768MB | 상동 | 플래너 힌트 — 메모리를 잡지 않는다 |
| work_mem | 동시 정렬 수를 감안해 보수적으로 | 16MB | 원본 미기재 | 원본 미기재 | 대조군 집계 쿼리가 이 값으로 디스크 정렬 여부가 갈린다 |
| maintenance_work_mem | VACUUM · 인덱스 생성 | 256MB | 원본 미기재 | 원본 미기재 | 대조군 btree 변형 인덱스 생성 시간에 직결 |
| max_connections | 접속 주체 합 + 여유 | 100 | 상동 | 상동 | 값의 정본 [02_postgresql_constraints.md](./02_postgresql_constraints.md) §커넥션(ADR-19) — 인용 |
| wal_compression | 디스크 쓰기 절감 | zstd | 상동 | 상동 | 대조군 비교 축 VACUUM/WAL 증폭의 측정 조건 |
| checkpoint_timeout | 체크포인트 스파이크 완화 | 15min | 상동 | 상동 | |
| random_page_cost | 로컬 SSD | 1.1 | 상동 | 상동 | |
| timezone(DB 기본) | 달력 경계 시간대와 같게 | Asia/Seoul | 상동 | 상동 | **신설** — 월 파티션 경계 계산이 세션 시간대를 따른다(02) |

- 검산: 파라미터 = **9** · 원본 8 + 신설 1(timezone)
- **대조군과 업무 테이블이 같은 인스턴스 · 같은 shared_buffers를 쓴다.** SW-09 on 실험 중에는 대조군 쿼리가 버퍼를 밀어내 업무 CRUD p95가 오른다 — 목표 ① 실험과 목표 ② 측정을 섞지 않는 조합 제약 #4([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md))의 저장소 쪽 이유다.
- 확장은 pg_stat_statements · pg_partman · auto_explain 셋이다(원본 tech_stack.md §5.1). 확장 생성은 마이그레이션 첫 순번이 한다([09_migrations_seed.md](./09_migrations_seed.md)).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| condition_type · severity · work_order.status 값 | **이 문서가 확정** — 11_glossary/03 미설계 3행의 반영 제안 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)(리드 반영) |
| RATE_OF_CHANGE의 첫 판정(직전 값 없음) · 직전 값의 BAD 행 처리 | **신규 미설계** — 판정 식의 경계 조건 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 비활성 태그를 가리키는 alarm_rule | W2a 등재 미확인 — DB는 FK만 유지한다 | 상동 |
| 생산 실적 기록 시점의 작업지시 상태 조건 | **신규 미설계** — PLANNED · 종결 지시에 실적을 적을 수 있는지 없다 | [../07_api/08_work_orders.md](../07_api/08_work_orders.md)(W5) |
| password_hash 알고리즘 | 원본 미기재 | [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md)(W7) |
| work_mem · maintenance_work_mem의 개발 · 중간 프로파일 값 | 원본 미기재 — 산정 규칙만 | 이 문서(S5 대조 실험 전 확정) |
| 업무 CRUD p95 · 대조군 동거 시 간섭 크기 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-09 |

## 관련 문서

- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 테이블 간 제약 · 인덱스 · 파티션 · 커넥션 · 한계 등재
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 plc_tag_raw_control 명세
- [erd.md](./erd.md) — 전역 ERD
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — tag_id 불변 · 스케일 변경 · Dictionary
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — enum 값 정본
- [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) — 상태 전이 · 감사 계약
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-16 · ADR-19
