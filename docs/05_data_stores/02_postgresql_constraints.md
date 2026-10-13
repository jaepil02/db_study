# PostgreSQL 제약 · 인덱스 · 한계 등재 (02_postgresql_constraints)

> **대상**: PostgreSQL 업무 테이블 7의 테이블 간 제약(FK · UNIQUE · 결합 CHECK · 가드 트리거 · DB 권한) · 인덱스 · 커넥션(ADR-19) · **한계 등재 — 어느 계층도 강제하지 않는 것**의 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — 다중 컬럼 PK 행 파티션 키 ts → **hypertable 시간 열 ts** · 압축된 칸에서도 막는다 · 보존 정리 주체 일 파티션(app_owner) → **TimescaleDB 보존 정책**(작업 주체 app_owner) · §비교 사본 함수 control_prepare_range → **control_compress_range(009 신설)** · control_clear_range 재정의(통째로 덮은 칸 drop_chunks · 걸친 칸 DELETE · 압축된 칸 푸는 행 상한 함수 안에서만 0) · control_purge 대상 칸 전부 · 검사 함수 호출자 셋 → **둘** · timezone 고정 불릿 · 넣기 TRUNCATE 갈래 → **drop_chunks 갈래** · **압축된 칸 DELETE 상한 불릿 신설** · 인덱스 불릿에 압축된 칸 읽기 · 한계 #29 막는 것 · 못 막는 것에 압축 · 미확인 pg_partman 행에 009 뒤 관리 대상 없음 · 관련 문서 ADR-32 — 함수 수 · app_rw EXECUTE 수 · 한계 채번 불변
> **개정일**: 2026-10-11 — 인덱스 #10 용도 부분별 최근 종결 1건 → **최근 완료 1건 + 마지막 시도 1건**(as-built apps/api/src/modules/runs/run-result.ts RUN_RESULT_LATEST · RUN_RESULT_ATTEMPTS · 검수 r6 L2)
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 H1 · M3 · M4) — §비교 사본 함수 B형 창 표기 KST D−4 · D−5 → **UTC D−4 · D−6** · 넣기는 일 파티션 통째라 control_clear_range가 TRUNCATE만 탄다 불릿 · 한계 #28 막는 것에 **넣기 · 무결성 시작 때 가동 거절**(남는 것은 실행 도중 켜기) · #29 창 표기 · **#30 지우기 잠금의 범위 신설**(프로세스 안 — api 여럿이면 서로 모른다) — 채번 29 → **30** · 현행 18 → **19**
> **개정일**: 2026-10-11 — **D-16 비교 사본 키 · 참조 · 값 규칙 · 실행 보관**(사용자 결정 2026-10-11 · 마이그레이션 007 · 008) — FK 6 → **7**(#16 plc_tag_raw_control.device_id → device) · 다중 컬럼 PK **1** 등재(plc_tag_raw_control (device_id, tag_id, ts)) · 결합 CHECK 4 → **5**(run_result ended_at ≥ started_at) · **§비교 사본 함수 신설**(SECURITY DEFINER 3 + 검사 1 · search_path 고정 · app_rw EXECUTE) · 추가 전용 권한 테이블 2 → **3**(run_result) · 인덱스 2 → **3**(#10 run_result_latest_idx · 대조군 BRIN 삭제) · 한계 등재 #5 크래시 재전달 중복 → PK가 막는다 · #22 옛 알람 캐시 TTL 표기 정정 · **#28 게이트 열림 동안의 가동 데이터 · #29 함수 허용 구간 안의 남의 구간** 신설 — 한계 채번 27 → **29**
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — 웨이브 1 새 기준선(순번 001~005)에 맞춤 — FK 15 → **6**(결번 #7~#15) · UNIQUE · 결합 CHECK 17 → **10** · 추가 전용 3 → **2**(audit_log 삭제) · app_rw 대상 업무 15 → **7** · 인덱스 9 → **2**(결번 #2~#8) · **§alarm_event 월 파티션 삭제** · 한계 등재 현행 27 → **16**(결번 11 — 번호 유지 · 행은 결번 표지로 남김) · #5 모드 D · #6 · #10 · #16 · #22 · #27의 알람 · 감사 · k6 표현 정리 · 미확인 unit 행의 audit_log → 명령 원장
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 한계 등재 #27 신설(**시연 전용 행** — 라이브 flow가 쓰는 DEMO-FLOW 계열 마스터 행 3 · 강제 주체 없음) · #4 검증 조회에서 시연 전용 행 대상 행 제외 — 등재 26 → **27**행 · 없음 9 → **10**
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27 · 사용자 요구 2026-09-28) — alarm_event 월 파티션 경계 Asia/Seoul 월 1일 → **UTC 월 1일 00:00**(= KST 1일 09:00 · 저장 운영 경계) · 옛 근거(화면의 달과 어긋남)는 ADR-27이 대체 · 기존 볼륨은 순번 009가 경계를 다시 세운다 — 결정 항목 수 불변
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-H4 · B-M9) — FK 절 "행위자는 audit_log가 갖는다" → **actor(요청자)에도 FK 없음 · 감사 행위자 정본은 audit_log.user_id** · 한계 등재 #26 신설(failed 명령의 적용 여부 미확정 — 강제 주체 없음) — 등재 25 → **26**행 · 없음 8 → **9** · FK · UNIQUE 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — biz_command_log 제약 — UNIQUE 8 → **9**(cmd_id) · 추가 전용 권한 2 → **3** · app_rw 업무 14 → **15** · 한계 등재 #24 신설(같은 cmdId · 다른 본문) · #25 신설(미적용 명령의 트리밍) — 등재 23 → **25**행 · 부분 강제 15 → **17** · #18 실적 이중 제출 잔여 문구(같은 cmdId 재요청은 원장이 막고 새 cmdId 이중 제출만 남는다) · FK 수 불변(원장은 FK를 갖지 않는다)
> **개정일**: 2026-09-27 — W6 결과 반영 — 한계 등재 #23 신설(ClickHouse 업무 대조 테이블의 CHECK는 INSERT 경로만 · 기록 043) — 등재 22 → **23**행 · 부분 강제 14 → **15**
> **개정일**: 2026-09-26 — W3 코드 검수 반영(r-alarm M5 · L4) — 한계 등재 신설 3행(#20 열기 커밋 뒤 상태 쓰기 실패의 고아 열린 행 · #21 닫기 커밋 뒤 상태 쓰기 실패의 새 에피소드 누락 — ⑥ 1회 재시도 뒤 잔여 · #22 cache-aside 채움 경합 — cache:alarmrules · cache:alarmevents · 태그 메타 · 설비 목록) · 등재 19 → **22** · 단독 · 부분 강제 11 → **14**
> **개정일**: 2026-09-26 — S7 ① 알람 착수 반영 — 한계 등재 #4 단계 경계 S7 이후 → **인증 도입(S7 ②) 이후** — 등재 수 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 빈 표 칸을 닫힌 어휘 해당 없음으로 채움(표 열 규약) · 비활성 태그 열린 알람 닫는 수단 — 리드 판정 대기 → 두지 않는다(W5 알람 강제 해제 표면 없음 판정 반영)
> **개정일**: 2026-09-24 — W6 판정 반영 — pg_partman 미리 만들기 · 유지 작업 주기 미확인을 닫는다(도구 기본값 · 백그라운드 워커 1시간 — 정본 09_tech_stack/03)
> **개정일**: 2026-09-24 — W5 판정 반영 — 한계 등재 신설 2행(#18 실적 이중 제출 · #19 실적 정정 수단 없음 — 강제 주체 없음) · 등재 17 → **19** · unit만 바꾸는 태그 수정 미확인 → W5 판정(허용)
> **개정일**: 2026-09-24 — W4 판정 반영 — 한계 등재 #2 강제 주체 없음 → **조건부 쓰기** · 신설 3행(#15 소진 모드 전환 중 크래시 재전달 중복 · #16 BFF 비경유 쓰기의 무효화 누락 · #17 비활성 태그의 열린 알람 이벤트) · 등재 14 → **17** · 없음 6 · 부분 강제 8 → **11**
> **원천**: D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · 마이그레이션 009 as-built(infra/postgres/migrations/009_control_timescale.sql · 2026-10-12) · ADR-27(사용자 요구 2026-09-28) · 원본 architecture.md §6 설계 결정 · §10.1 · §12 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §4.2 · §7.1 · §8.2 · §13(커밋 ff66a37) · 사용자 결정 2026-09-27(업무 쓰기 Redis 경유) · 원본 tech_stack.md §5.1(커밋 ff66a37) · docs_plan.md 이식 패턴 ① 한계 등재 · 웨이브 인계 W3 05_data_stores 행(audit_log 소유) · ADR-16 · ADR-19 · [../README.md](../README.md) 전역 불변식 순서 무관성

컬럼 하나에 걸리는 제약(타입 · NOT NULL · 단일 컬럼 CHECK)은 [01_postgresql_schema.md](./01_postgresql_schema.md)가 갖고, 이 문서는 **둘 이상의 컬럼 · 행 · 테이블에 걸치는 강제**와 그 강제가 끝나는 자리를 갖는다.

**강제는 네 층으로 나뉜다** — 제약(FK · UNIQUE · CHECK) · 가드 트리거 · DB 권한 · 서비스 코드다. 앞의 셋은 DB가 모든 쓰기 경로에 대해 막고, 서비스 코드는 그 코드를 지나는 경로만 막는다. 어느 층도 막지 않는 것은 §한계 등재에 **기록된 상태**로 올린다 — "아무도 책임지지 않는다"는 누락이 아니라 등재된 사실이다.

**전역 불변식 순서 무관성의 잔여 기록 자리가 이 문서다.** Stream 엔트리 순서와 적재 순서의 역전은 무해하다는 판정을 받고 남아 있으며, 그 판정의 근거(시계열이 ts를 자체 보유한다)가 깨지는 조건을 §한계 등재 1행이 경보로 둔다.

## FK 전수

**물리 삭제 표면이 없으므로 ON DELETE는 전부 RESTRICT다.** 논리 삭제(is_active)만 있는 스키마에서 CASCADE를 두면 수동 DELETE 한 줄이 과거 이력을 연쇄로 지운다.

| # | 참조하는 쪽 | 참조되는 쪽 | ON DELETE | 뜻 |
|:-:|------|------|:------:|------|
| 1 | production_line.site_id | site | RESTRICT | 해당 없음 |
| 2 | device.line_id | production_line | RESTRICT | 해당 없음 |
| 3 | modbus_config.device_id | device | RESTRICT | 1:1 — PK이자 FK |
| 4 | tag_master.device_id | device | RESTRICT | **갱신 금지** — §가드 트리거 |
| 5 | tag_master_history.old_tag_id | tag_master | RESTRICT | 해당 없음 |
| 6 | tag_master_history.new_tag_id | tag_master | RESTRICT | UNIQUE와 함께 계보를 선형으로 |
| 16 | **plc_tag_raw_control.device_id** | device | RESTRICT | **D-16(007)** — 등록된 설비만 · 무결성 시험 unknown-device의 근거 |

- 검산: FK = MST 계열 6(#1~#6) + 비교 사본 1(#16) = **7** · CASCADE **0** · SET NULL **0** · 결번 #7~#15(changed_by · 알람 3 · 역할 2 · 작업지시 · 실적 · 감사 — D-16)
- **교차 저장소 참조에는 FK가 없다.** ClickHouse tag_raw.tag_id · device_id는 PostgreSQL 키를 가리키지만 두 DB를 묶는 제약은 존재할 수 없다(ADR-16) — §한계 등재 10행.
- **biz_command_log는 FK를 갖지 않는다.** kind · result가 가리키는 업무 행은 명령마다 테이블이 달라 한 FK로 표현되지 않는다. **actor(요청자)에도 FK를 걸지 않는다** — 계정 테이블이 없고(D-16) actor는 늘 NULL이다([01_postgresql_schema.md](./01_postgresql_schema.md) §biz_command_log 설계).
- **비교 사본 plc_tag_raw_control은 D-16부터 설비 FK를 갖는다(007).** 옛 대조군은 "FK 검사가 비교 축 삽입 처리량에 ClickHouse에 없는 비용을 낸다"며 FK를 두지 않았다. 측정 도구를 지우며 그 대조 조건을 지킬 이유가 없어졌고, 직접 비교는 "RDB를 제대로 쓰면"의 모양을 잰다 — **그 비용 자체가 비교 대상이다**(넣기의 COPY 시간 · 무결성의 막음). tag_id에는 FK를 걸지 않는다 — 시험 태그 대역이 tag_master에 없고, 태그 계보(새 태그 발급)가 과거 행을 고아로 만들지 않게 한다. 정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md).

## UNIQUE와 결합 CHECK

| 종류 | 대상 | 식 | 막는 실패 |
|------|------|------|------|
| UNIQUE | site | (site_code) | 같은 코드의 두 사이트 |
| UNIQUE | production_line | (site_id, line_code) | 한 사이트 안 라인 코드 중복 — 원본에 없던 제약 |
| UNIQUE | device | (device_code) | 해당 없음 |
| UNIQUE | tag_master | (tag_code) | 동시 등록 두 건이 모두 통과 — 애플리케이션 조회만으로는 못 막는다 |
| UNIQUE | tag_master_history | (new_tag_id) | 한 새 태그의 계보가 둘 |
| UNIQUE | biz_command_log | (cmd_id) | **재전달 · 같은 cmdId 재요청의 이중 적용** — 원장 행 조회와 INSERT 사이의 경합도 커밋 시점에 막는다 |
| 다중 컬럼 PK | plc_tag_raw_control | (device_id, tag_id, ts) — hypertable 시간 열 ts 포함(009) | **같은 설비 · 태그 · 시각의 두 행**(무결성 시험 duplicate · 크래시 재전달) — 위반 행 하나가 그 배치 COPY를 통째로 롤백한다(D-16 · 007) · 압축된 칸에서도 막는다(리드 실측 2026-10-12) |
| CHECK | tag_master | (word_order IS NULL) = (data_type IN ('UINT16', 'INT16', 'BOOL')) | 16비트 태그에 워드 순서가 붙어 디코더가 워드를 잘못 합친다 |
| CHECK | tag_master | (data_type = 'BOOL') = (function_code IN (1, 2)) | 레지스터 영역을 비트로 읽거나 그 반대 — 레지스터 비트 BOOL은 미확인이라 막아 둔다 |
| CHECK | tag_master | range_min IS NULL 또는 range_max IS NULL 또는 range_min < range_max | 뒤집힌 범위가 모든 값을 BAD_RANGE로 만든다 |
| CHECK | tag_master_history | old_tag_id <> new_tag_id | 자기 자신을 계보로 가리킴 |
| CHECK | run_result | ended_at >= started_at | 끝이 시작보다 앞선 실행 — 경과 시간이 음수가 된다(D-16 · 008) |

- 검산: UNIQUE **6** + 다중 컬럼 PK **1** + 결합 CHECK **5** = **12** · 비교 사본의 값 · 품질 CHECK 3(NaN 아님 · ±1조 · 품질 7값)은 단일 컬럼이라 [01_postgresql_schema.md](./01_postgresql_schema.md) · [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)가 갖는다 · 옛 user_account · role · work_order UNIQUE와 alarm_rule · alarm_event 2 · work_order CHECK는 D-16 삭제
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

-- tag_master_history · biz_command_log · run_result: 추가 전용
REVOKE UPDATE, DELETE, TRUNCATE ON tag_master_history, biz_command_log, run_result FROM app_rw;
```

- **트리거는 서비스 거절의 백스톱이다.** 서비스가 스케일 PATCH를 409로 먼저 거절하고(REQ-MST-07), 트리거는 서비스를 거치지 않는 경로(수동 SQL · 새 표면의 누락)를 막는다. 트리거가 없으면 psql 한 줄이 과거 값의 공학 단위 의미를 조용히 바꾼다.
- **device_id도 갱신 금지다.** 태그의 설비를 바꾸면 같은 tag_id의 ClickHouse 행이 두 device_id 아래로 갈려 정렬 키(device_id · tag_id · ts) 조회가 과거 구간을 놓친다. 설비 이동은 새 태그 발급이다.
- **추가 전용은 트리거가 아니라 권한으로 막는다.** 애플리케이션 역할에 UPDATE · DELETE 권한이 없으면 어떤 코드 경로도 계보 · 원장 행을 고칠 수 없다 — 트리거는 소유자 역할이 끌 수 있지만 부여하지 않은 권한은 코드가 우회할 수 없다.

| DB 역할 | 접속 주체 | 권한 | 막는 것 |
|------|------|------|------|
| app_owner | 마이그레이션 | 스키마 소유 · DDL | 런타임이 DDL을 실행하지 못하게 소유를 가른다 |
| app_rw | api 풀 · 명령 워커 · 대조군 적재 | 업무 7 SELECT · INSERT · UPDATE(추가 전용 2 제외) · 대조군 INSERT · SELECT · run_result INSERT · SELECT · 비교 사본 함수 3 EXECUTE(§비교 사본 함수) | 계보 · 원장 · 실행 결과 행 수정 · 물리 DELETE · 비교 사본 DDL · TRUNCATE를 함수 밖에서 하는 것 |
| ch_reader | ClickHouse Dictionary 소스 | tag_master SELECT만 | Dictionary 소스가 쓰기 권한을 가진다(REQ-MST-11) |

- 검산: DB 역할 = **3** · 가드 트리거 **1** · 권한으로 막는 추가 전용 테이블 **3**(tag_master_history · biz_command_log · run_result)
- app_rw에 DELETE를 주지 않으므로 물리 삭제 표면은 코드가 아니라 권한에서 이미 없다. 비교 사본의 보존 정리는 TimescaleDB 보존 정책이 칸 통째로 한다(작업 주체 app_owner · 009 · [08_retention_lifecycle.md](./08_retention_lifecycle.md)) · 직접 비교 · 지우기가 비교 사본을 압축하고 비우는 일은 app_owner 소유 함수가 대신한다(§비교 사본 함수).

## 비교 사본 함수

app_rw는 DDL · DELETE · TRUNCATE 권한이 없다 — 그런데 직접 비교(GEN-13)는 넣은 구간의 칸을 압축하고 구간을 비워야 하고, 센서 데이터 지우기(GEN-14)는 비교 사본을 통째로 비워야 한다. 권한을 넓히는 대신 **app_owner 소유 SECURITY DEFINER 함수**로 그 세 일만 연다(D-16 · 마이그레이션 007 · 009 — 009가 파티션 준비를 지우고 구간 압축을 더했다 · ADR-32).

| 함수 | SECURITY | 하는 일 | 막는 것 | app_rw |
|------|------|------|------|------|
| control_check_range(start, end) | INVOKER(검사만) | 구간이 길이 8일 이하 · 시작이 보존 7일 안 · 끝이 지금 + 하루 이하인지 — 밖이면 예외 invalid_parameter_value | 남의 날 · 보존 밖 · 미래 먼 날을 비우거나 압축하는 호출 | 없음(PUBLIC 회수 — control_compress_range · control_clear_range가 부른다) |
| **control_compress_range(start, end)** | DEFINER · search_path public, pg_temp · timezone UTC | 구간에 걸친 칸 중 아직 압축하지 않은 것만 열 압축(convert_to_columnstore — 이미 압축된 칸은 건너뛴다) · 압축한 칸이 있으면 ANALYZE · 압축한 칸 수(**009 신설**) | 구간 밖 칸(다른 날 · 다른 창)까지 압축하는 것 · 압축 직후 행 수 추정(approximate_row_count)이 0으로 보이는 것 | EXECUTE |
| control_clear_range(start, end) | DEFINER · search_path public, pg_temp · timezone UTC · **압축된 칸 DML의 푸는 행 상한 0(이 함수 안에서만 — 009)** | 구간 [start, end) 비우기 — 구간이 칸을 통째로 덮으면 drop_chunks · 걸치기만 한 칸은 그 구간만 DELETE(압축된 칸은 풀어서 지운다 · 009 재정의) | 구간 밖 행(가동 데이터 · 다른 창)까지 지우는 것 | EXECUTE |
| control_purge() | DEFINER · search_path public, pg_temp | 비교 사본 전부 TRUNCATE(hypertable — 모든 칸) | 설비 · 태그 · 업무 · 실행 결과까지 지우는 것(다른 테이블이라 닿지 않는다) | EXECUTE |

- 검산: 함수 = 검사 1 + SECURITY DEFINER 3 = **4** · app_rw EXECUTE **3** · PUBLIC EXECUTE **0**(넷 다 회수) · 007의 control_prepare_range(일 파티션 준비)는 009가 지웠다 — 칸은 넣을 때 스스로 생긴다
- **search_path를 함수에 고정하고 pg_temp를 마지막에 둔다.** SECURITY DEFINER 함수가 호출자의 search_path를 따르면 호출자가 앞쪽 스키마 · 임시 스키마에 같은 이름의 객체를 만들어 소유자 권한으로 실행시킬 수 있다 — pg_temp를 명시적으로 마지막에 두지 않으면 PostgreSQL이 임시 스키마를 앞에서 먼저 찾는다.
- **timezone을 UTC로 고정한다(ADR-27 — DB 처리 UTC).** 날 경계를 세션 시간대로 계산하면 KST 세션에서 하루가 9시간 밀려 엉뚱한 날을 비운다 — 옛 007 함수가 date_trunc('day')로 날 파티션을 찾던 자리다. 009의 함수는 칸 경계(range_start · range_end)를 정보 뷰 timescaledb_information.chunks에서 그대로 읽어 날 계산이 없지만 고정은 남긴다 — 함수에 날 계산이 다시 들어와도 경계가 흔들리지 않게.
- **B형 — 함수가 허용 구간을 다시 검사하는 것은 중복이 아니다.** 결론 — 코드의 창 계산(UTC D−4 · D−6)과 함수의 허용 구간 검사가 둘 다 있다. 반대 시나리오 — 코드만 믿으면 app_rw 접속 정보를 가진 아무 스크립트가 함수를 직접 불러 지난 7일 밖 · 미래의 날을 비운다. 파생 지침 — 허용 구간 밖은 함수가 마지막으로 막고, 허용 구간 안의 남의 구간을 비우거나 압축하는 것은 한계 등재 #29로 남긴다.
- **넣기는 control_clear_range의 drop_chunks 갈래만 탄다**(웨이브 6 · r5 검수 H1 · 009). 넣기 사흘 창이 UTC 자정에서 시작해 칸(1일)을 통째로 덮기 때문이다 — 걸친 칸의 DELETE 갈래는 무결성 창(1시간)만 쓴다. 걸친 칸 DELETE 직후 같은 자리로 COPY가 들어오면 autovacuum 전이라 죽은 행 자리를 다시 못 써 파일이 늘고, 넣기의 크기 측정(칸 크기 × 구간 몫)이 그 부풀림을 그대로 센다 · drop_chunks로 비운 날의 칸은 다음 넣기 때 압축 전 상태로 새로 생긴다.
- **압축된 칸의 DELETE는 풀어서 지운다 — 푸는 행 상한은 control_clear_range 안에서만 없앤다(009).** TimescaleDB는 압축된 칸에 대한 DML 한 트랜잭션이 푸는 행 수에 상한을 둔다(timescaledb.max_tuples_decompressed_per_dml_transaction · 기본 10만). 이틀 전 넣기가 압축한 칸이 오늘의 무결성 창(UTC D−6)이 되면 그 1시간 비우기가 상한을 넘어 실행이 준비 단계에서 실패한다(정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) §지금 모양). 상한은 함수 설정으로만 0(무제한)이고 서버 · 세션 기본값은 그대로다 — app_rw의 다른 경로는 상한을 그대로 받는다.

## 인덱스

**업무 테이블은 작아서 순차 스캔이 이기는 구간이 넓다.** 인덱스는 조회 패턴이 문서로 확인되는 자리에만 둔다 — 무분별한 인덱스는 삽입 성능을 해친다(원본 architecture.md §6). PK · UNIQUE가 만드는 인덱스는 따로 세지 않는다.

| # | 인덱스 | 대상 조회 | 근거 |
|:-:|------|------|------|
| 1 | tag_master (device_id, is_active) | Collector 기동 로드 · 설비별 태그 목록 | 원본 architecture.md §6 |
| 9 | tag_master_history (old_tag_id) | 스케일 변경 계보 역추적 | 트렌드 화면의 전후 구간 연결 |
| 10 | **run_result (type, part, ended_at DESC)** | 부분별 최근 완료 1건 + 부분별 마지막 시도 1건(09_datagen #6 — 두 쿼리 모두 type · part 같음 + ended_at 내림차순 1건이라 이 인덱스 모양에 맞는다) | D-16 · 008 — 부분마다 인덱스를 한 번 내려간다 |

- 검산: 원본 1(#1) + 신설 2(#9 · #10) = **3** · 결번 #2~#8(알람 · 작업지시 · 실적 · 감사 인덱스 — D-16)
- **비교 사본의 인덱스는 기본 키 하나뿐이다**(PK 인덱스라 이 표에서 세지 않는다). 옛 BRIN(ts)과 btree 변형은 대조 격자의 실험 변수였고 007이 BRIN을 지웠다 · 009도 hypertable 기본 시각 인덱스를 만들지 않는다 — 조회 대결의 PostgreSQL 질의는 압축 전 칸에서 이 기본 키를 타고 압축된 칸에서는 묶음(device_id · tag_id) 단위로 건너뛴다(정본 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)).

## 커넥션

ADR-19의 저장소 쪽 계약이다. 풀 크기 · max_connections는 2계층 조정값이며 **이 표가 값의 정본이다**(ADR-19가 이 문서를 소유처로 지정).

| 접속 주체 | 수단 | 현행 상한(참고) | 계약 | 어기면 |
|------|------|------|------|------|
| api 업무 경로 | in-process 풀(pg Pool) | 20 | 요청마다 새 커넥션 금지 · prepared statement 자유 | 커넥션 생성 비용이 CRUD p95에 섞인다 |
| 대조군 적재(SW-09 on) | **전용 커넥션 1개 — 업무 풀과 분리** | 1 | 업무 풀에서 빌리지 않는다 | 대조군 COPY가 업무 풀을 점유해 목표 ② 측정의 CRUD p95가 대조군 비용을 먹는다 |
| ClickHouse Dictionary 소스 | ch_reader | 2 | LIFETIME 주기 조회만 | 해당 없음 |
| 호스트 도구 | psql · DBeaver | 나머지 | 학습용 수동 조회 | 해당 없음 |
| 합계 상한 | max_connections | 100 | 위 합 + 여유 | 해당 없음 |

- 검산: 접속 주체 = **4** · 현행 고정 상한 합 20 + 1 + 2 = 23 < 100
- **PgBouncer를 두지 않는다(ADR-19).** 접속 주체가 api 프로세스 하나라 커넥션 폭발의 발생 조건이 성립하지 않고, 풀러가 없어 prepared statement를 제약 없이 쓴다. 도입 시점은 api 다중 인스턴스(확장 로드맵 2단계)다 — [../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md).
- **대조군 전용 커넥션은 이 문서의 신설 판정이다.** ADR-19 본문과의 정합은 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)가 확인한다.

## 한계 등재 — 어느 계층도 강제하지 않는 것

이식 패턴 ①의 정본 표다. **강제 주체가 "없음"인 행이 있는 것이 정상이다** — 그 행이 누락이 아니라 기록된 상태라는 것이 이 표의 목적이다. 새 항목은 말미에 더하고 번호를 옮기지 않는다.

| # | 항목 | 강제 주체 | 막는 것과 못 막는 것 | 잔여가 어디에 담기는가 |
|:-:|------|------|------|------|
| 1 | **Stream 엔트리 순서 vs 적재 순서** | 적재 워커 단독 · DB 백스톱 없음 | 막는 것 — 한 배치 안의 행 순서. 못 막는 것 — **배치 간 역전.** 컨슈머 배분이 라운드로빈이고 단일 flusher의 fan-in 도착 순서도 엔트리 순서가 아니며, ClickHouse는 삽입 순서를 보존하지 않는다 | 시계열이 ts를 자체 보유해 무해하다는 판정(전역 불변식 순서 무관성). **순서 의존 집계를 도입하는 순간 이 행이 경보가 된다** — 도입 제안은 이 행을 먼저 닫아야 한다 |
| 2 | **rt:latest 덮어쓰기 순서 역전** | **봉인 래퍼의 필드 조건부 쓰기(새 ts ≥ 저장 ts · W4)** — 쓰기 주체 전부(ING · COL · RLT 워밍 · 기동 복원) | 막는 것 — 스풀 재발행 · 회수 · 복원 경합 · SW-11 collector가 옛 값으로 최신값을 덮는 것. 못 막는 것 — 래퍼 밖 원시 호출 · redis-cli 수동 HSET | 검증 "rt:latest 대 argMax(value, ts) 일치"(AC-07) · 기전 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §덮어쓰기 순서 역전 |
| 3 | **결번(D-16)** — 옛 audit_log 쓰기 주체 공유 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 4 | **결번(D-16)** — 옛 감사 행위자 NULL의 단계 조건 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 5 | **대조군 동일 행 보장** | SW-09 동시 적재(ING-11) · 비교 사본 기본 키(007) | 막는 것 — 한 배치를 두 저장소에 같은 행으로 싣는 것 · 크래시 재전달의 PostgreSQL 쪽 **중복**(기본 키가 그 COPY를 실패시킨다 — D-16). 못 막는 것 — 대조군 실패 배치의 **누락**, 재전달 COPY 실패가 세는 실패 계수(중복이 실패로 보인다), ClickHouse 쪽 재전달 중복(토큰 밖 재전달 — #15), 두 저장소 보존 삭제 시점의 어긋남 | 구간별 두 저장소 count 정확 일치 확인 뒤에만 대조(REQ-ING-15 · 직접 비교 넣기 결과 rows) · 설계 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) |
| 6 | **과거 행에 붙는 태그명의 시점** | 없음 — Dictionary는 현재 마스터만 안다 | 막는 것 — 비활성 태그의 이름 소실(판정 [07_cross_store_consistency.md](./07_cross_store_consistency.md) — 적재 쿼리에서 is_active 조건 제거). 못 막는 것 — 태그명을 바꾸면 **과거 구간에도 새 이름이 붙는다** | 설계 선택 — 시계열은 불변 사실 · 해석은 조회 시점(ADR-16). 옛 이름이 필요하면 명령 원장(biz_command_log result)을 읽는다 |
| 7 | **스케일 변경의 계보 행 누락** | 서비스 단독 · 가드 트리거는 기존 행 수정만 막는다 | 막는 것 — 기존 태그의 scale · offset_value 수정. 못 막는 것 — 새 태그를 만들고 tag_master_history 행을 빠뜨리는 것 | 스케일 변경 동작의 트랜잭션 순서(REQ-MST-07) · 검증은 발급 1건당 history 1행 |
| 8 | **결번(D-16)** — 옛 work_order 전이 쌍 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 9 | **결번(D-16)** — 옛 규칙당 열린 alarm_event 1건 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 10 | **교차 저장소 참조** | 없음 — 두 DB를 묶는 제약은 없다(ADR-16) | 막는 것 — 없음. 못 막는 것 — 마스터에 없는 tag_id의 tag_raw 행 · 태그의 device_id와 다른 device_id로 적재된 행 | 적재 쪽은 마스터에서 온 태그만 발행한다(Collector · 생성기) · dictGet 기본값(빈 문자열)이 드러내는 자리 [07_cross_store_consistency.md](./07_cross_store_consistency.md) |
| 11 | **원시 · 롤업 정합** | 없음 — MV는 원자적이지 않다 | 막는 것 — MV 오류 무시 설정을 끄면 실패가 드러난다. 못 막는 것 — 원시는 확정됐는데 롤업이 빈 구간 | 구간별 count(tag_raw) = countMerge(tag_1m) 대조 · 재계산 절차 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) |
| 12 | **DLQ 트리밍** | MAXLEN만 | 막는 것 — DLQ의 메모리 무한 증가. 못 막는 것 — 재처리 전 오래된 DLQ 엔트리가 **조용히 잘리는 것** | dlq_count와 DLQ 길이 대조 · 재처리 경로 [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md)(W4) · 크기 [06_redis_memory.md](./06_redis_memory.md) |
| 13 | **결번(D-16)** — 옛 과거 ts 알람 이벤트의 파티션 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 14 | **무효화 체인 삭제 실패** | TTL만 | 막는 것 — 요청 실패로 번지는 것(degrade · REQ-MST-10). 못 막는 것 — 커밋된 마스터와 다른 **옛 사본이 TTL 동안** 남는 것 | 캐시 삭제 실패 계수 · 키별 TTL [05_redis_keyspace.md](./05_redis_keyspace.md) |
| 15 | **소진 모드 전환 중 크래시 재전달 중복** | 창 정렬 배치 · 결정적 토큰 — **같은 모드 안에서만** 같은 배치가 된다 | 막는 것 — 재시도 · 같은 모드 안 재전달의 중복. 못 막는 것 — 정상 모드로 삽입된 창이 XACK 전 크래시 뒤 소진 모드 묶음으로 재전달(또는 그 반대)되어 토큰이 달라진 배치의 중복 | tag_id + ts 중복 조회(AC-02) · 기전 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) §소진 모드 |
| 16 | **BFF를 거치지 않은 쓰기의 BFF 캐시 무효화 누락** | BFF가 자기가 중계한 쓰기 성공에서만 무효화한다(체인 ⑤) | 막는 것 — BFF 경유 쓰기 뒤의 옛 목록. 못 막는 것 — 수동 호출 · 스크립트가 api에 직결한 쓰기 뒤 revalidate 창 동안의 옛 목록 | BFF revalidate 창 · 기전 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §무효화 체인 6단 |
| 17 | **결번(D-16)** — 옛 비활성 태그의 열린 알람 이벤트 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 18 | **결번(D-16)** — 옛 실적 이중 제출 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 19 | **결번(D-16)** — 옛 실적 정정 수단 없음 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 20 | **결번(D-16)** — 옛 열기 커밋 뒤 상태 쓰기 실패의 고아 열린 행 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 21 | **결번(D-16)** — 옛 닫기 커밋 뒤 상태 쓰기 실패의 새 에피소드 누락 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 22 | **cache-aside 채움 경합** | 커밋 뒤 DEL(무효화 체인 ②) · TTL | 막는 것 — 커밋 뒤에 시작한 조회의 옛 사본. 못 막는 것 — **커밋 전에 PostgreSQL을 읽은 조회가 ② 삭제 뒤에 사본을 채우는 순서** — 태그 메타 · 설비 목록이 옛 사본으로 TTL까지 남는다 | 잔여 상한은 키별 TTL(현행 참고 · 소유 [05_redis_keyspace.md](./05_redis_keyspace.md) — cache:tagmeta · cache:devlist · 옛 알람 캐시 키는 D-16 삭제)과 다음 쓰기의 DEL이 끊는다 · ADR-12는 덮어쓰기 경합만 막는다 · 기전 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §무효화 체인 6단 |
| 23 | **결번(D-16)** — 옛 ClickHouse 업무 대조 테이블의 CHECK는 INSERT 경로만 | 해당 없음 — 대상 삭제 | 해당 없음 | 해당 없음 |
| 24 | **같은 cmdId · 다른 본문** | biz_command_log UNIQUE(cmd_id) — 첫 판정에 고정 | 막는 것 — 재전달 · 같은 cmdId 재요청의 이중 적용. 못 막는 것 — **같은 cmdId에 다른 본문을 실은 요청이 첫 명령의 결과를 받는 것**(원장은 본문을 대조하지 않는다) · SW-12 direct 경로의 재요청 중복(원장이 없다) | 클라이언트는 새 쓰기에 새 cmdId를 쓴다 · 표면 계약 [../07_api/01_conventions.md](../07_api/01_conventions.md) · 기전 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로 |
| 25 | **미적용 업무 명령의 트리밍** | stream:biz:cmd MAXLEN · 명령 유효 창 | 막는 것 — 명령 스트림의 메모리 무한 증가 · 유효 창을 넘긴 명령의 늦은 적용(EXPIRED). 못 막는 것 — **워커 정지 중 쌓인 명령이 MAXLEN을 넘어 적용 전에 잘리는 것** — 202를 받은 쓰기가 원장 행 없이 사라져 명령 조회가 pending에 머문다 | MAXLEN ≥ 유효 창 동안의 최대 업무 쓰기 수(관계 — 값 [06_redis_memory.md](./06_redis_memory.md)) · biz_stream_lag 감시 · 키 [05_redis_keyspace.md](./05_redis_keyspace.md) |
| 26 | **failed 명령의 적용 여부 미확정** | 없음 — 판정을 기록할 PostgreSQL이 불가하다 · 원장은 PostgreSQL이 돌아온 뒤 같은 키 재요청에서만 확인된다 | 막는 것 — 같은 키 재요청의 이중 적용(원장이 돌아오면 저장된 판정을 낸다 · #24). 못 막는 것 — **failed가 '적용되지 않았다'로 읽히는 것** — 재전달된 명령이 이미 커밋된 뒤 PostgreSQL이 불가하면 원장 확인도 못 해 failed가 되므로 failed는 '적용 여부를 확정하지 못했다'다 · 결과 키가 만료되면 pending으로 보인다 | 같은 키 재요청으로 확정한다(원장이 돌아오면 applied) · biz_commands_total{result=failed} · 기전 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §멱등 · 재전달 · 표면 [../07_api/01_conventions.md](../07_api/01_conventions.md) |
| 27 | **시연 전용 행** | 없음 — 코드(사이트 DEMO-FLOW · 라인 DEMO-FLOW-L · 설비 DEMO-FLOW-DEV · flow 전용 태그 DEMO-FLOW-DEV-T01~T50)는 실행이 정한 약속일 뿐 DB가 시연 소유를 표시하는 컬럼 · 제약이 없다 | 막는 것 — 없음(DB 층). 라이브 flow는 이 코드의 행에만 명령을 보내므로 운영 행(시드 · 사람이 만든 행)은 바뀌지 않는다. 못 막는 것 — **시연 전용 행(사이트 · 라인 · 설비 각 1 · 태그 50)이 첫 실행 뒤 남아 마스터 목록에 보이는 것** · **사람이 같은 코드로 만든 행을 시연이 자기 행으로 쓰는 것**(이름이 매 명령 바뀐다) | 이름("시연 설비 …")으로 식별한다 · 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §시연 전용 행 · 잔여 [../12_security/04_threat_model.md](../12_security/04_threat_model.md) §잔여 위험 등재 |
| 28 | **게이트 열림 동안의 가동 데이터** | 없음 — 게이트는 배치 단위이지 행의 시각을 보지 않는다 | 막는 것 — 게이트가 닫힌 동안 가동 데이터가 PostgreSQL에 실리는 것 · 설비 가동이 켜진 채 넣기 · 무결성을 시작하는 것(400 path plant · 웨이브 6). 못 막는 것 — **실행 도중(게이트 열림) 설비 가동을 켜면 지금 시각의 가동 배치도 PostgreSQL에 COPY되는 것**(설비 가동 표면은 실행 진행을 보지 않는다) — 비교 구간 밖이라 대조 · 조회 대결에는 들지 않지만 비교 사본에 남는다(지우기 · 보존 7일이 지운다) · 현황(09_datagen #7)의 PostgreSQL 행 수가 구간보다 커진다 | 실행이 시작 · 끝의 가동 여부를 run_result.plant_on에 남긴다("설비 가동 중에 잰 값" 표지) · 구간 행 수로만 대조 · 결정 ADR-28 |
| 29 | **함수 허용 구간 안의 남의 구간** | 비교 사본 함수의 허용 구간 검사(§비교 사본 함수) — 부분 | 막는 것 — 보존 밖 · 8일 넘는 · 미래 먼 구간 비우기 · 압축. 못 막는 것 — **app_rw 접속을 가진 호출이 허용 구간 안(지난 7일 ~ 내일)의 아무 구간이나 비우거나 압축하는 것** — 지금은 직접 비교 하나만 부르지만 함수는 호출자를 가리지 않는다 | 호출 주체가 runs 모듈 하나 · 직접 비교 창은 가동 데이터가 없는 과거(UTC D−6 13~14시 · D−4~D−1) · 접속 정보는 비밀(정본 [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)) |
| 30 | **지우기 잠금의 범위** | api 프로세스 안 잠금(지우기 · 실행 시작 · 설비 켜기가 같은 인스턴스를 본다) — 부분 | 막는 것 — 같은 프로세스 안에서 지우는 동안 실행 시작 · 설비 켜기 · 켜는 동안 지우기(웨이브 6 · r5 검수 M4). 못 막는 것 — **api를 여럿 띄우면(APP_ROLE api 둘 이상) 다른 프로세스의 지우기 · 시작 · 켜기를 서로 모른다** · 수집기를 다른 역할로 떼면 지우기가 수집기 적용 상태를 못 보고 가동 키 · 대기줄 적체로만 막는다 | 로컬 기본 APP_ROLE all · api 하나 · 역할 분리 진입 때 재판정([../04_architecture/08_scaling_roadmap.md](../04_architecture/08_scaling_roadmap.md) 1단계) · 표면 [../07_api/09_datagen.md](../07_api/09_datagen.md) #8 |

- 검산: 채번 **30**행 = 현행 19 + 결번 11(#3 · #4 · #8 · #9 · #13 · #17~#21 · #23 — 감사 · 작업지시 · 실적 · 알람 · ClickHouse 업무 대조 — D-16) · 현행 중 강제 주체 "없음"인 행 6(#6 · #10 · #11 · #26 · #27 · #28) + 단독 · 부분 강제 13(#1 · #2 · #5 · #7 · #12 · #14 · #15 · #16 · #22 · #24 · #25 · #29 · #30) = **19**
- **#24 · #25 · #26은 업무 쓰기를 명령 스트림에 올린 대가다**(사용자 결정 2026-09-27). 옛 경로(요청 = 트랜잭션)에는 명령과 적용 사이의 간격이 없어 세 행이 생길 자리가 없었다 — #25의 폭은 워커 정지 시간과 MAXLEN의 관계로 정해진다.
- **#1과 #2는 같은 뿌리(컨슈머 간 순서 무관)에서 나온 두 결과다.** #1은 ts가 있어 무해하고 #2는 ts를 보지 않는 덮어쓰기라 유해했다 — 순서 무관성이 무해한 것은 **ts로 읽는 소비자에게만**이다. W4가 #2의 쓰기를 ts 비교 조건부 쓰기로 바꿔 덮어쓰기도 ts로 읽는 소비자가 되었다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| pg_partman 미리 만들기 개수 · 유지 작업 주기 | **W6 판정** — 미리 만들기 도구 기본값 · 유지 작업은 백그라운드 워커 1시간 주기 · 기본값 수치는 착수 시 공식 참조로 확인 · **009 뒤 관리 대상 없음**(비교 사본은 TimescaleDB hypertable — pg_partman은 빈 볼륨에서 004를 재생할 때만 쓰인다 · ADR-32) | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| unit만 바꾸는 태그 수정의 허용 여부 | **W5 판정** — 허용(변환식이 그대로면 표기 정정 · 물리 단위 변경은 변환식이 바뀌어 새 태그 발급으로 간다) · 가드 트리거 밖 잔여는 명령 원장이 흔적 | [../07_api/04_master.md](../07_api/04_master.md) |
| rt:latest 덮어쓰기의 ts 비교 | **W4 판정** — 조건부 쓰기 · 한계 등재 #2 갱신 | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 대조군 전용 커넥션과 ADR-19 본문 | 이 문서의 신설 판정 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md)(W3 w3-arch 정합) |

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — 컬럼 · 단일 컬럼 제약 · enum 값
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 파티션 보존 · 분리
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — 교차 저장소 참조 · Dictionary
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 인덱스 · 동일 행 보장 · 비교 사본 모양(TimescaleDB hypertable · 열 압축 · 009)
- [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) — 순서 무관성 · 불변 사실 기록
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-16 · ADR-19 · ADR-32(비교 사본 함수 압축 · 구간 비우기)
