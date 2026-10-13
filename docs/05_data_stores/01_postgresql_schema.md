# PostgreSQL 업무 스키마 (01_postgresql_schema)

> **대상**: PostgreSQL 업무 테이블 7 · 실행 보관 1(run_result)의 컬럼 · 타입 · 컬럼 제약 · 소유 · tag_master_history 설계 · **biz_command_log 설계(업무 명령 멱등 원장)** · **run_result 설계(D-16)** · 저장 enum 값 집합 확정(biz_command_log.status) · 인계 판정(site.timezone) · 튜닝 파라미터와 조정값 소유처 — 테이블명 · 컬럼명 채번 정본 · 폐지 테이블 결번 기록
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — #15 수명 일 파티션 → **hypertable 칸 1일 · 열 압축 · TimescaleDB 보존 정책 7일** · 비고에 009(컬럼 · 키 · 규칙 그대로) · 관리 테이블 불릿에 hypertable 칸 · 압축 표 · 튜닝 timezone 근거에 칸 경계(epoch 하루 배수) · 확장 불릿 셋 → **넷(timescaledb 추가) · 생성 자리 001 · migrate 관리자 단계 · 정본 링크(03_data_infra)** — 테이블 · 파라미터 수 불변
> **개정일**: 2026-10-11 — **D-16 카드 라인 · 직접 비교 결과 보관**(사용자 결정 2026-10-11 · 마이그레이션 006 · 008) — **테이블 #17 run_result 신설**(GEN 소유 · 직접 비교 종결 결과 · 추가 전용 · §run_result 설계) — 테이블 8 → **9**(업무 7 + 대조군 1 + 실행 보관 1) · 소유 테이블 없는 도메인 6 → **5**(GEN이 run_result 소유) · tag_master에 **tag_kind** 컬럼(006 · NULL 허용 · CHECK 8값) · enum 값 확정에 tag_master.tag_kind 8 · run_result.type 1 · part 3 · status 3 · 대조군 행 비고에 007(기본 키 · 참조 · 값 규칙) · 미확인 간섭 크기 행에 업무 방해 실험 삭제(ADR-31)
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — 웨이브 1 새 기준선(순번 001~005)에 맞춤 — **테이블 8 삭제**(alarm_rule · alarm_event · user_account · role · user_role · work_order · production_log · audit_log — 번호 #7~#14 결번) · 업무 15 → **7** · 합계 16 → **8** · biz_command_log 소유 WRK → **명령 기전(공통)** · §테이블 명세 — ALM · AUT · WRK 삭제 · tag_master_history changed_by 삭제(10 → **9**컬럼) · actor 늘 NULL · enum 확정 14값 → **3**(work_order.status 허용 전이 삭제) · 인계 판정 4 → **2** · 미확인 6행 삭제 · run_perf 실행 수명 객체 불릿 삭제 · 공통 규약의 rule · user · alarm · work_order · threshold 예시 삭제
> **개정일**: 2026-09-28 — 최종 검증 반영(v-wave2 L) — 인증 뒤 NULL 감사 행 예외 문구 "행 하나" → **예외 부류 하나(시연 전용 행 대상 감사 행 · 명령마다)**
> **개정일**: 2026-09-28 — UTC 검수 반영(r-utc L1) — site.timezone 판정 칸의 옛 문장에 "(W3 원문)" 표지 · 원문의 파티션 경계는 이 값을 따르지 않는다(ADR-27)
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 인계 판정 audit_log.user_id NULL의 뜻 "무인증 기간의 행위" → **무인증 기간의 행위 또는 시스템 시연(라이브 flow — 시연 전용 행)** · 인증 도입 뒤 NULL 결함 불릿에 시연 전용 행 대상 행 제외 — 판정 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27 · 사용자 요구 2026-09-28) — site.timezone 뜻 표시 · 달력 경계 시스템 단일 시간대 → **표시 · 달력 의미 시간대**(DB 처리 시간대 아님 · CHECK 'Asia/Seoul' 불변) · 튜닝 파라미터 timezone(DB 기본) Asia/Seoul → **UTC** · log_timezone 병기 · 실행 수명 객체 포인터 한 줄 — 테이블 · 파라미터 수 불변
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-H4 — actor ⓐ 채택) — biz_command_log에 **actor**(bigint · NULL 허용 · FK 없음 — 명령 조회 요청자 대조 기준) 신설 — 컬럼 7 → **8** · "actor 컬럼을 두지 않는다" 불릿 → **actor는 요청자 · 감사 행위자 정본은 audit_log.user_id 그대로** — 테이블 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27 · D-04 · REQ-GLB-12 개정) — **biz_command_log 신설**(업무 명령 멱등 원장 · 소유 WRK — audit_log 선례 · 명령 적용과 같은 트랜잭션) — 업무 테이블 14 → **15** · WRK 3 → **4** · 합계 15 → **16** · 식별자 발급 규약에 cmd_id(요청이 정하는 UUID) 예외 · enum 값 11 → **14**(status 3 — 11_glossary/03 반영 제안) · "업무 쓰기는 Stream을 거치지 않는다" → **명령 스트림을 거쳐 워커가 트랜잭션으로 커밋한다**
> **개정일**: 2026-09-26 — W1 재검수 반영 — 무인증 기간 감사 행위자 판정 근거 칸 "인증은 S7" → **인증 도입은 S7 ②**(S7 ① 알람도 무인증) · 버린 대안 칸 S7 이후 → **인증 도입(S7 ②) 이후**
> **개정일**: 2026-09-26 — W1 검수 잔여 — NULL 결함 불릿 본문의 S7 이후 → **인증 도입(S7 ②) 이후**(제목과 일치)
> **개정일**: 2026-09-26 — S7 ① 알람 착수 반영 — 무인증 기간 경계 S4~S6 → **인증 도입(S7 ②) 전** · 예외 alarm_event.acked_by(시드 계정 대리 · 07_api/07) — 테이블 · 컬럼 수 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약) · 미확인 등재 3행 닫힘(enum 반영 · RATE_OF_CHANGE 경계 · 비활성 태그 규칙)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(실적 기록 상태 조건) — 테이블 수 불변
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — password_hash 알고리즘 미기재 → **Argon2id**(PHC 자기 기술 문자열 · 컬럼 형 불변)(정본 12_security/01)
> **원천**: D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · 마이그레이션 009 · D-16(사용자 결정 2026-10-11) · 웨이브 1 새 기준선 infra/postgres/migrations 001~005 · ADR-27(사용자 요구 2026-09-28) · 원본 architecture.md §5 · §6 · §12 · §13 · §18(커밋 ff66a37) · 원본 tech_stack.md §5.1 · §10.2(커밋 ff66a37) · 원본 data_flow.md §7 · §8 · §8.2(커밋 ff66a37) · 원본 implementation_plan.md §2.3(커밋 ff66a37) · docs_plan.md 보정 #15 · 웨이브 인계 W3 05_data_stores/01 행 · ADR-16 · ADR-19 · D-04 · D-11 · 사용자 결정 2026-09-27(업무 쓰기 Redis 경유) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로 · [../README.md](../README.md) 고정 기준 PostgreSQL 테이블

이 문서는 PostgreSQL에 앉는 **업무 데이터의 모양**을 고정한다. 테이블 수는 루트 고정 기준(업무 7 + 대조군 1 + 실행 보관 1)을 그대로 따르고, 이 문서가 채번하는 것은 **컬럼 이름 · 타입 · 컬럼 단위 제약**이다. 테이블 사이의 제약 · 인덱스 · 파티션 · 커넥션 · 한계 등재는 [02_postgresql_constraints.md](./02_postgresql_constraints.md)가, 대조군 plc_tag_raw_control의 명세는 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)가 갖는다.

**PostgreSQL은 분기 ③계층(업무 CRUD)만 받는다**(②계층 알람 판정은 D-16 폐지). 시계열 원시값은 한 행도 싣지 않는다 — 대조군은 분기 목적지가 아니라 SW-09 on의 실험 계측물이다(D-04 · D-05). 업무 쓰기는 명령 스트림(stream:biz:cmd)을 거쳐 워커가 트랜잭션 하나로 커밋하고, 그 트랜잭션이 biz_command_log에 명령 판정을 함께 남긴다(사용자 결정 2026-09-27 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). Redis에 오는 것은 명령이지 업무 행이 아니다.

**아래 DDL 조각은 설계 계약이지 구현 코드가 아니다.** 마이그레이션 파일의 모양과 도구는 [09_migrations_seed.md](./09_migrations_seed.md)가, 버전은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 정한다.

## 테이블 목록

도메인 소유의 기준은 **쓰기 표면과 수명 주기를 누가 결정하는가**다. 여러 업무 명령이 같은 트랜잭션에서 쓰는 원장(biz_command_log)은 소유를 도메인 밖 명령 기전에 둔다.

| # | 테이블 | 소유 도메인 | 분기 계층 | 원본 예상 규모 | 수명 | 비고 |
|:-:|------|:---------:|:-------:|------------|------|------|
| 1 | site | MST | ③ | 수백 행 | 무기한 · 물리 삭제 없음 | timezone 컬럼 판정 §인계 판정 |
| 2 | production_line | MST | ③ | 수백 행 | 상동 | 해당 없음 |
| 3 | device | MST | ③ | 수백 행 | 상동 · is_active 논리 삭제 | 해당 없음 |
| 4 | modbus_config | MST | ③ | 수백 행 | device와 1:1 | host 루프백 = 시뮬레이션 설비 |
| 5 | tag_master | MST | ③ | 수천~수만 행 | 무기한 · tag_id 영구 보존 | 시스템 전체의 메타 원천 |
| 6 | tag_master_history | MST | ③ | 스케일 변경 횟수 | 무기한 · 추가 전용 | **보정 #15 신설** |
| 15 | plc_tag_raw_control | ING | 대조군 | 비교 구간 행 수(사흘치 약 6천만) | **TimescaleDB hypertable 칸 1일 · 열 압축**(009 — ADR-32) · 보존 7일(TimescaleDB 보존 정책) · 직접 비교 · 지우기가 비운다 | 명세 정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) · 기본 키 · 참조 · 값 규칙(007 — D-16 · 009가 표를 다시 만들 때 그대로) |
| 16 | **biz_command_log** | 명령 기전(공통) | ③ | 업무 쓰기 수 | 무기한 · 추가 전용(보존 정본 [08_retention_lifecycle.md](./08_retention_lifecycle.md) #16) | 업무 명령 멱등 원장 · 쓰기는 명령 기전(지금은 MST 명령) · §biz_command_log 설계 |
| 17 | **run_result** | GEN | 해당 없음 — 실행 보관 | 직접 비교 실행 수 | 무기한 · 추가 전용 · 센서 데이터 지우기가 남긴다 | **D-16 신설** — 직접 비교 종결 결과 · §run_result 설계 |

- 검산: 업무 = MST 6(#1~#6) + 명령 기전 1(#16) = **7** · 대조군 1(#15) · 실행 보관 1(#17) · 합계 7 + 1 + 1 = **9** · 결번 #7~#14(alarm_rule · alarm_event · user_account · role · user_role · work_order · production_log · audit_log — D-16 · 폐지 전 원문 커밋 28c0cc9)
- **biz_command_log의 소유는 명령 기전(도메인 밖 공통 경로 — biz 모듈)이다**(D-16 — 옛 소유 WRK 폐지). 쓰기는 모든 업무 명령에서 오고 기준(상태 값 · 보존 · 추가 전용)은 명령 기전 정본([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로)이 정한다. 번호 #16은 식별자이지 순서가 아니다(말미 채번).
- **소유 테이블이 없는 도메인은 5이다** — COL · SIM · TSQ · RLT · OBS. ING는 PostgreSQL에서 대조군 하나만 소유하고(ING-11), GEN은 실행 보관 run_result 하나만 소유한다(GEN-13 · D-16 — 옛 "GEN은 소유 테이블이 없다"를 대체).
- **run_result는 업무 데이터도 측정 기록도 아니다.** 직접 비교 화면(⑤)이 api 재기동 뒤에도 마지막 결과를 보이려는 화면 보관이다 — 업무 명령 경로(Redis 명령 스트림)를 타지 않고 실행이 종결 직전 직접 INSERT한다. 측정 기록의 정본은 여전히 docs/measurements다. 도메인 공백의 정본 매트릭스는 [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)다.
- 도구가 스스로 만드는 관리 테이블(마이그레이션 이력 · pg_partman 설정 · 확장 카탈로그 · 비교 사본 hypertable의 칸과 압축 표 — TimescaleDB 내부 스키마)은 업무 테이블이 아니며 위 합계에 넣지 않는다 — 판정 근거는 [09_migrations_seed.md](./09_migrations_seed.md)다.

## 공통 규약

| 규약 | 결정 | 근거 · 어기면 |
|------|------|------|
| 시각 타입 | 전부 timestamptz · 컬럼명은 _at 또는 planned_ 접두 | 원본 architecture.md §6 "시간대 혼동은 시계열 시스템의 최대 버그 원인". timestamp(시간대 없음)는 세션 TimeZone이 바뀌면 같은 문자열이 다른 순간이 된다 |
| 식별자 발급 | integer · bigint 모두 GENERATED ALWAYS AS IDENTITY — 애플리케이션이 값을 넣지 못한다 · **예외 biz_command_log.cmd_id(uuid)** — 요청이 정하는 멱등 키라 PK가 아닌 UNIQUE 컬럼으로 둔다 | BY DEFAULT로 두면 시드 · 수동 INSERT가 번호를 지정해 시퀀스와 충돌하고, tag_id 재사용 금지(원본 architecture.md §12)가 애플리케이션 규율로만 남는다 |
| tag_id 폭 | integer(4바이트) | ClickHouse 모든 행에 실리는 키다 — UUID(16바이트)면 저장량이 4배다(원본 architecture.md §6) |
| 저빈도 참조 키 | integer — site · line · device | 수천 행을 넘지 않는 마스터에 bigint를 쓰면 ClickHouse UInt32 컬럼과 폭이 어긋난다 |
| 고빈도 누적 키 | bigint — tag_master_history · biz_command_log | 수명이 무기한인 누적 테이블은 21억을 넘는 날 시퀀스가 멈춘다 |
| 닫힌 값 집합 | **text + CHECK** — PostgreSQL enum 타입을 쓰지 않는다 | enum 라벨은 삭제 · 순서 변경이 어렵다. 값 집합의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)이고 CHECK는 그 사본이다 |
| 측정값 | double precision — 대조군 value | 전역 불변식 "측정값 Float64". numeric으로 받으면 Float64 비트가 10진 변환을 거쳐 ClickHouse tag_raw.value와 같은 값인지 비트로 대조할 수 없다 |
| 설정 수치 | numeric — scale · offset_value · deadband · range | 사람이 10진으로 입력하는 설정이다. 0.1을 이진 근사로 저장하면 입력값과 조회값이 달라 보인다 |
| 논리 삭제 | is_active boolean NOT NULL · 물리 삭제 표면 없음 | 물리 삭제하면 ClickHouse 과거 행의 tag_id · device_id가 고아가 된다(REQ-MST-06) |
| NULL 허용 | 뜻이 있는 부재만 — 아래 명세의 "NULL 뜻" 열에 적힌 것 외에는 NOT NULL | NULL의 뜻이 적히지 않은 컬럼은 구현마다 다른 뜻으로 채워 조회 조건이 갈린다 |

- **닫힌 값 집합을 PostgreSQL enum 타입으로 올리지 않는 것은 B형이다.** 결론 — CHECK 사본은 정본과 두 자리에 있게 된다. 반대 시나리오 — enum 타입이면 biz_command_log.status 값 하나를 폐지할 때 라벨 삭제가 불가능해 타입을 새로 만들고 컬럼을 이관해야 한다. 파생 지침 — CHECK를 고치는 마이그레이션과 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 개정을 같은 변경 단위로 묶는다.

## 테이블 명세 — MST

마스터 6 테이블이다. 쓰기는 명령 경로로 biz_command_log와 같은 트랜잭션에서 커밋한다(REQ-GLB-12 · 무인증 — D-16).

| 테이블 | 컬럼 | 타입 | 컬럼 제약 | NULL 뜻 · 설명 |
|------|------|------|------|------|
| site | site_id | integer | PK · IDENTITY ALWAYS | 해당 없음 |
| site | site_code | text | NOT NULL · UNIQUE | 사람이 읽는 코드 |
| site | site_name | text | NOT NULL | 해당 없음 |
| site | timezone | text | NOT NULL · DEFAULT 'Asia/Seoul' · **CHECK = 'Asia/Seoul'** | 판정 §인계 판정 — 표시 · 달력 경계와 같은 값만 허용 |
| production_line | line_id | integer | PK · IDENTITY ALWAYS | 해당 없음 |
| production_line | site_id | integer | NOT NULL · FK site | 해당 없음 |
| production_line | line_code | text | NOT NULL · UNIQUE(site_id, line_code) | 원본은 유일 제약이 없다 — 사이트 안 유일로 신설 |
| production_line | line_name | text | NOT NULL | 해당 없음 |
| device | device_id | integer | PK · IDENTITY ALWAYS | ClickHouse device_id UInt32의 원천 |
| device | line_id | integer | NOT NULL · FK production_line | 해당 없음 |
| device | device_code | text | NOT NULL · UNIQUE | 해당 없음 |
| device | device_name | text | NOT NULL | 해당 없음 |
| device | vendor · model | text | NULL 허용 | NULL = 미기재 — 시뮬레이션 설비는 비워 둔다 |
| device | is_active | boolean | NOT NULL · DEFAULT true | 논리 삭제(REQ-MST-02) |
| modbus_config | device_id | integer | PK · FK device | 설비 1:1 |
| modbus_config | host | inet | NOT NULL | **루프백이면 시뮬레이션 설비** — SIMULATED(9) 표지의 원천([../02_features/03_collector.md](../02_features/03_collector.md)) |
| modbus_config | port | integer | NOT NULL · CHECK 1~65535 | 시뮬레이션 설비는 5020~5119 |
| modbus_config | unit_id | smallint | NOT NULL · CHECK 0~247 | Modbus 슬레이브 주소 범위 |
| modbus_config | timeout_ms · retry_count | integer · smallint | NOT NULL · CHECK 양수 · 0 이상 | 원본 값 없음 — 설비별 설정 |
| modbus_config | max_regs_per_request | smallint | NOT NULL · CHECK 1~125 | FC03 요청당 상한 125([../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)) |
| tag_master | tag_id | integer | PK · IDENTITY ALWAYS | **영구 보존 · 재사용 금지** — 갱신 금지 트리거 [02_postgresql_constraints.md](./02_postgresql_constraints.md) |
| tag_master | device_id | integer | NOT NULL · FK device | 해당 없음 |
| tag_master | tag_code | text | NOT NULL · UNIQUE | 비활성 태그도 코드를 점유한다 |
| tag_master | tag_name | text | NOT NULL | dictGet이 조회 시점에 붙인다 |
| tag_master | function_code | smallint | NOT NULL · CHECK IN (1, 2, 3, 4) | 해당 없음 |
| tag_master | address | integer | NOT NULL · CHECK 0~65535 | 해당 없음 |
| tag_master | data_type | text | NOT NULL · CHECK 7값 | UINT16 · INT16 · UINT32 · INT32 · FLOAT32 · FLOAT64 · BOOL |
| tag_master | word_order | text | NULL 허용 · CHECK 4값 | **NULL = 워드 순서 적용 없음**(16비트 · BOOL) — 결합 규칙은 02 |
| tag_master | scale · offset_value | numeric | NOT NULL · DEFAULT 1 · 0 | **갱신 금지** — 바뀌면 새 tag_id(REQ-MST-07) |
| tag_master | unit | text | NOT NULL · DEFAULT '' | 빈 문자열 = 무차원 |
| tag_master | deadband | numeric | NOT NULL · DEFAULT 0 · CHECK 0 이상 | 공학 단위 절대값 · 0 = 비활성([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)) |
| tag_master | scan_rate_ms | integer | NOT NULL · CHECK 양수 | STALE 판정의 기준 주기 |
| tag_master | range_min · range_max | numeric | NULL 허용 · 둘 다 있으면 min < max | NULL = 범위 판정 없음 — BAD_RANGE를 내지 않는다 |
| tag_master | is_active | boolean | NOT NULL · DEFAULT true | 논리 삭제 · 폴링 대상 여부 |
| tag_master | **tag_kind** | text | NULL 허용 · CHECK 8값(006) | 태그 종류 TEMP · PRESSURE · SPEED · CURRENT · VIBRATION · COUNT · STATE · OTHER — **NULL = 종류 없음**(S2 슬라이스 · 시연 설비 · 마스터 표면으로 만든 태그 — 가상 PLC는 GEN_PROFILE 구성 · HMI는 템플릿 접미 · 그도 없으면 기타) · 카드 라인 시드가 채운다 · 마스터 표면 계약 밖(새 태그 발급은 옛 태그의 값을 잇는다) |

- 검산: MST 테이블 = site · production_line · device · modbus_config · tag_master + tag_master_history(§tag_master_history 설계) = **6**
- **range_min · range_max를 NULL로 두는 태그는 BAD_RANGE(4)를 받지 않는다.** COUNTER 프로파일처럼 범위가 없는 태그를 억지 범위로 채우면 랩어라운드 순간이 불량으로 집계된다.

## tag_master_history 설계

docs_plan 보정 #15가 신설한 테이블이다. 원본은 "태그 마스터에 변경 이력 테이블 유지"(원본 architecture.md §12)를 요구하고 ERD에는 두지 않았다. 기록 내용의 요구는 REQ-MST-07 — 이전 · 새 tag_id와 변경 전후 값이다.

| 컬럼 | 타입 | 컬럼 제약 | 뜻 |
|------|------|------|------|
| history_id | bigint | PK · IDENTITY ALWAYS | 해당 없음 |
| old_tag_id | integer | NOT NULL · FK tag_master | 비활성화된 이전 태그 |
| new_tag_id | integer | NOT NULL · **UNIQUE** · FK tag_master | 새로 발급된 태그 — 한 새 태그의 계보는 한 행이다 |
| old_scale · old_offset_value | numeric | NOT NULL | 이전 태그의 공학 단위 변환식 |
| new_scale · new_offset_value | numeric | NOT NULL | 새 태그의 변환식 |
| changed_at | timestamptz | NOT NULL · DEFAULT now() | 발급 트랜잭션 시각 |
| reason | text | NULL 허용 | 사람이 적는 사유 |

- 검산: 컬럼 = history_id · old_tag_id · new_tag_id · old_scale · old_offset_value · new_scale · new_offset_value · changed_at · reason = **9** · 옛 changed_by(FK user_account)는 계정과 함께 D-16 삭제
- **이 테이블은 tag_id의 계보만 담는다.** 태그명 · 단위 · 범위 같은 일반 메타 변경은 tag_id를 바꾸지 않아 여기에 쓰지 않는다 — 그 변경의 흔적은 명령 원장(biz_command_log의 kind · result)이 갖는다(옛 audit_log before · after는 D-16 삭제).
- **new_tag_id UNIQUE가 계보를 선형으로 만든다.** 한 새 태그가 두 이전 태그에서 나올 수 없으므로 "이 tag_id의 조상"은 old_tag_id를 따라가는 단일 경로다. 트렌드 화면이 스케일 변경 전후 구간을 이어 그릴 때 이 경로를 쓴다.
- 쓰기는 한 트랜잭션에서 ① 새 태그 INSERT ② 이전 태그 is_active false ③ 이 테이블 INSERT ④ biz_command_log INSERT 순이다(REQ-MST-07). 이 행이 빠져도 DB는 막지 못한다 — 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md).

## biz_command_log 설계

업무 명령의 **멱등 원장**이다(사용자 결정 2026-09-27 · 기전 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). 명령 하나의 판정(적용 · 거절 · 만료)을 행 하나로 남기고, 재전달 · 같은 cmdId 재요청이 이 행을 보고 두 번 적용하지 않는다.

| 컬럼 | 타입 | 컬럼 제약 | 뜻 |
|------|------|------|------|
| log_id | bigint | PK · IDENTITY ALWAYS | 해당 없음 |
| cmd_id | uuid | NOT NULL · **UNIQUE** | 명령 봉투의 cmdId — 멱등 키 |
| kind | text | NOT NULL | 쓰기 종류(예 master.site.create) — 값 집합은 표면이 늘 때마다 늘어 CHECK를 걸지 않는다 |
| status | text | NOT NULL · CHECK 3값 | APPLIED · REJECTED · EXPIRED — §enum 값 확정 |
| result | jsonb | NOT NULL | api가 돌려줄 HTTP 상태 · 본문 또는 오류 코드 · 세부 — biz:result 키와 같은 모양 |
| **actor** | bigint | **NULL 허용 · FK 없음** | 봉투의 actor — 명령 조회의 요청자 대조 기준 · 사용자 계정이 없어(D-16) 늘 NULL이다. FK가 없어 계정 테이블과 무관하게 원장이 남는다 |
| requested_at | timestamptz | NOT NULL | 봉투의 requestedAt — 명령 유효 창의 기준 |
| applied_at | timestamptz | NOT NULL · DEFAULT now() | 판정을 기록한 트랜잭션 시각(거절 · 만료도 같은 컬럼) |

- 검산: 컬럼 = log_id · cmd_id · kind · status · result · actor · requested_at · applied_at = **8**
- **APPLIED 행은 업무 행과 같은 트랜잭션에서 쓴다.** 원장을 트랜잭션 밖(Redis · 별도 커밋)에 두면 커밋과 원장 사이 크래시 창에서 재전달이 이미 커밋된 변경을 다시 적용한다 — 멱등이 원장 한 행에 기대는 이유다.
- **REJECTED 행은 롤백 뒤 별도 트랜잭션이다.** 업무 트랜잭션이 롤백되면 그 안의 원장 행도 사라지므로 거절은 따로 남긴다. 이 쓰기가 실패하면 같은 cmdId 재요청이 다시 적용을 시도한다 — 거절 판정은 다시 계산되고 이중 적용은 생기지 않는다.
- **PostgreSQL 불가는 행을 남기지 않는다.** 행을 쓸 수단이 없으므로 결과 키에만 503이 남고, 같은 cmdId 재요청은 적용을 새로 시도한다(재생 없음 — REQ-MST-14).
- **추가 전용이다** — 판정이 바뀌지 않으므로 UPDATE · DELETE 권한을 주지 않는다([02_postgresql_constraints.md](./02_postgresql_constraints.md) §가드 트리거와 DB 권한). 보존은 무기한 · 정리 주체 없음이다([08_retention_lifecycle.md](./08_retention_lifecycle.md) #16).
- **actor는 명령의 요청자 칸이다.** 명령 조회 GET /api/v1/commands/{cmdId}가 요청자와 대조하는 기준이지만 로그인이 없어(D-16) 늘 NULL이고 대조는 늘 같다고 본다(대조 규칙 [../07_api/01_conventions.md](../07_api/01_conventions.md) §업무 쓰기 경로). 컬럼은 남긴다 — 요청자를 다시 가를 일이 생기면 칸을 새로 만들지 않는다.

## run_result 설계

직접 비교 실행(GEN-13)의 **종결 결과 보관**이다(D-16 · 마이그레이션 008). 실행 상태는 api 메모리(진행 1 + 마지막 1)라 재기동이면 사라진다 — 직접 비교 화면이 부분별 마지막 결과를 계속 보이도록 종결 직전 한 행을 남긴다. 표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) #6.

| 컬럼 | 타입 | 컬럼 제약 | 뜻 |
|------|------|------|------|
| run_id | uuid | PK | 실행 ID — api가 발급한 runId(IDENTITY 예외 — 실행 객체와 같은 값이어야 한다) |
| type | text | NOT NULL · CHECK IN ('compare') | 실행 종류 — flow는 남기지 않는다 |
| part | text | NOT NULL · CHECK IN ('ingest', 'query', 'integrity') | 부분 — 옛 업무 방해(interfere)는 사용자 결정으로 삭제(ADR-31 · 008이 처음부터 3값) |
| params | jsonb | NOT NULL | 적용된 매개변수 {part, spanHours} |
| status | text | NOT NULL · CHECK IN ('completed', 'stopped', 'failed') | 종결 3값 |
| result | jsonb | NULL 허용 | **NULL = 완료가 아니다**(중단 · 실패) — 완료면 공용 계약 CompareRunResult 모양 |
| started_at · ended_at | timestamptz | NOT NULL · CHECK ended_at ≥ started_at | 시작 · 종결 |
| commit_hash | text | NULL 허용 | **NULL = 빌드 인자 없음** — 실행 때 api 커밋 |
| switches | jsonb | NOT NULL | 실행 때 스위치 값(health switches의 value) |
| plant_on | boolean | NOT NULL | 실행 시작 또는 끝에 설비 가동이 켜져 있었는가 — 켜져 있었으면 그 부하가 섞인 값 |

- 검산: 컬럼 = run_id · type · part · params · status · result · started_at · ended_at · commit_hash · switches · plant_on = **11**(started_at · ended_at를 한 행에 적었다)
- 인덱스 run_result_latest_idx (type, part, ended_at DESC) — 부분마다 최근 1건을 한 번 내려간다(정본 [02_postgresql_constraints.md](./02_postgresql_constraints.md)).
- **추가 전용이다** — app_rw는 INSERT · SELECT만 가진다(UPDATE · DELETE · TRUNCATE 회수 — biz_command_log와 같은 권한 관례). 결과는 바뀌지 않고 보관 실패는 실행 종결을 막지 않는다.
- **센서 데이터 지우기가 이 테이블을 지우지 않는다**(D-16 결정 5 — 남기는 것). 그래서 지운 뒤에도 ⑤ 화면은 마지막 결과를 보이고, 조회 대결의 사전 확인은 저장소에 행이 있는지를 따로 본다(datagen.compare_no_data).
- 읽기는 지금 부분 집합만 · 저장된 json이 지금 계약과 어긋나면 result만 NULL로 읽는다 — 계약이 바뀌어도 옛 행이 표면을 깨지 않는다.

## enum 값 확정

이 문서가 CHECK로 거는 닫힌 값 집합이다. 값의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)이고 CHECK는 그 사본이다.

| enum | 값 | 뜻 | 원본 근거 | 판정 |
|------|------|------|------|------|
| biz_command_log.status | APPLIED | 명령이 업무 행에 반영됐다 | 신설(사용자 결정 2026-09-27) | 확정 · 11_glossary/03 반영 |
| 상동 | REJECTED | 도메인 오류로 반영하지 않았다 — result에 오류 코드 | 상동 | 상동 |
| 상동 | EXPIRED | 명령 유효 창을 넘어 적용하지 않았다 | 상동 | 상동 |
| tag_master.tag_kind | TEMP · PRESSURE · SPEED · CURRENT · VIBRATION · COUNT · STATE · OTHER | 온도 · 압력 · 속도 · 전류 · 진동 · 수량 · 상태 · 기타 | 신설(D-16 · 공용 계약 packages/shared card-line.ts TAG_KINDS) | 확정 · 11_glossary/03 반영 |
| run_result.type | compare | 직접 비교 | 신설(D-16) | 상동 |
| run_result.part | ingest · query · integrity | 넣기 · 조회 대결 · 무결성 | 신설(D-16 · COMPARE_PARTS) | 상동 |
| run_result.status | completed · stopped · failed | 실행 종결 3값(실행 status 5의 종결 부분집합) | 신설(D-16) | 상동 |

- 검산: biz_command_log.status 3 + tag_master.tag_kind 8 + run_result.type 1 + part 3 + status 3 = **18**값 · 옛 alarm_rule.condition_type 4 · severity 3 · work_order.status 4와 work_order.status 허용 전이 표는 D-16으로 테이블과 함께 삭제

## 인계 판정

웨이브 인계 W3 05_data_stores/01 행 · 01 · 09 행 · 07 · 01 행에서 이 문서로 온 항목이다.

| 인계 항목 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| site.timezone 용도 vs 표시 Asia/Seoul 고정 | **컬럼을 유지하되 값은 'Asia/Seoul' 하나로 CHECK 고정한다.** (W3 원문) 표시 · 달력 경계(tag_1d 하루 · 파티션 경계)는 시스템 단일 시간대이며 이 컬럼이 바꾸지 않는다 — **뜻 개정(ADR-27 · 2026-09-28 · 원문의 파티션 경계는 이 값을 따르지 않는다)**: 이 값은 **표시 · 달력 의미 시간대**(화면 변환 · tag_1d 하루)이고 DB 처리 · 저장 운영 경계(파티션 · TTL)는 UTC다 · CHECK 값은 불변 | 달력 경계 시간대 판정 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) · [03_clickhouse_schema.md](./03_clickhouse_schema.md) — 모든 사이트가 한 tag_1d를 공유한다 · 달력 의미 경계 닫힌 목록 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) | ① 컬럼 삭제 — 원본 ERD와 어긋나고 다중 시간대 확장의 자리까지 지운다. ② 자유 값 허용 — 다른 값이 들어오는 순간 사이트의 하루와 tag_1d의 하루가 **조용히** 어긋난다 |
| tag_master_history 컬럼 | §tag_master_history 설계 — 9컬럼 · new_tag_id UNIQUE | REQ-MST-07 기록 내용 | 일반 메타 변경까지 담기 — 명령 원장과 정본이 둘이 된다 |

- 검산: 판정 = **2** · 옛 알람 담당자 배정 · 무인증 기간 감사 행위자 판정은 D-16으로 대상 테이블과 함께 삭제

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
| checkpoint_timeout | 체크포인트 스파이크 완화 | 15min | 상동 | 상동 | 해당 없음 |
| random_page_cost | 로컬 SSD | 1.1 | 상동 | 상동 | 해당 없음 |
| timezone(DB 기본) | DB 처리 시간대 UTC(ADR-27) — 설정 파일 timezone · log_timezone과 DB 기본값(관리자 단계) 두 자리를 같게 | UTC | 상동 | 상동 | **신설** — 월 · 일 파티션 경계 계산이 세션 시간대를 따른다(02) · 옛 값 Asia/Seoul(달력 경계 시간대와 같게)은 ADR-27이 대체 · 009 뒤 비교 사본의 칸 경계는 epoch 하루 배수(UTC 자정)라 세션 시간대를 따르지 않는다 — 빈 볼륨 004 재생의 일 파티션은 여전히 이 값을 따른다(ADR-32) |

- 검산: 파라미터 = **9** · 원본 8 + 신설 1(timezone)
- **대조군과 업무 테이블이 같은 인스턴스 · 같은 shared_buffers를 쓴다.** SW-09 on 실험 중에는 대조군 쓰기 · 쿼리가 버퍼를 밀어내 업무 명령 p95가 오른다 — 목표 ① 실험과 목표 ② 측정을 섞지 않는 조합 제약 #4([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md))의 저장소 쪽 이유다.
- 확장은 pg_stat_statements · pg_partman · auto_explain(원본 tech_stack.md §5.1) · timescaledb(ADR-32 — 비교 사본) 넷이다. 생성 자리 — pg_stat_statements는 001 · pg_partman · timescaledb는 migrate 관리자 단계 · auto_explain은 설정 파일 적재만 한다. 로드 방식의 정본은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §PostgreSQL 확장과 설정 파일이고, 적용 순서는 [09_migrations_seed.md](./09_migrations_seed.md) §저장소 간 적용 순서다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| work_mem · maintenance_work_mem의 개발 · 중간 프로파일 값 | 원본 미기재 — 산정 규칙만 | 이 문서(S5 대조 실험 전 확정) |
| biz_command_log 보존 기간 · 정리 주체 | **닫힘** — 무기한 · 정리 주체 없음 · 결과 키 TTL보다 긴 관계 성립 | [08_retention_lifecycle.md](./08_retention_lifecycle.md) |
| 업무 CRUD p95 · 대조군 동거 시 간섭 크기 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 직접 비교에 업무 방해를 넣었다가 실측이 흔들려 뺐다(ADR-31 — 사용자 결정 2026-10-11) | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-09(폐지 표기) |

## 관련 문서

- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 테이블 간 제약 · 인덱스 · 파티션 · 커넥션 · 한계 등재
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 plc_tag_raw_control 명세
- [erd.md](./erd.md) — 전역 ERD
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — tag_id 불변 · 스케일 변경 · Dictionary
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — enum 값 정본
- [../03_requirements/03_master.md](../03_requirements/03_master.md) — 마스터 쓰기 계약
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-16 · ADR-19
