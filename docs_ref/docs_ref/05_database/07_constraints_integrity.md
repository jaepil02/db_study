# 07_constraints_integrity — 제약·무결성

> **대상**: insadesk — enum **33종 · 값 132** · CHECK · PK **61** · 유일성 강제 **60**(UNIQUE 32 + 부분 UNIQUE 28) · EXCLUDE **10** · FK ON DELETE 정책(SET NULL **48** · CASCADE **2** · 나머지 RESTRICT) · 합계 불변식 · 복합 FK **5**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — 인용 갱신 — security_events.kind CHECK 6 → **8값**(V0739 · 정본 [01_auth.md](./01_auth.md)). 제약 이름이 같아 제약 수는 움직이지 않는다
> **개정일**: 2026-09-09 — 한계 등재 36 → **37항** — **고정수당·비과세 항목 코드의 카탈로그 정합**을 등재한다. jsonb 배열 원소에 FK를 걸 수 없는 것은 정산 원장 배열과 같지만, 그쪽은 **참조가 끊기는 경로 자체가 없다**는 사실상의 보증이 있는 반면 이쪽은 없다 — pay_items는 사업장이 정의하는 카탈로그다. **강제 위치는 서비스 단독이고 DB 백스톱이 없다** — 이 절이 정확히 그런 자리를 담는 표다. **쓰기 시점의 갈림은 막지만 쓰인 뒤 카탈로그가 바뀌는 것은 막지 못하며**, 그 잔여는 결과 라인의 동결 축 미결이 담는다. **테이블 61 · enum 33/132 · UNIQUE 32 · 부분 UNIQUE 28 · EXCLUDE 10 · CHECK 142 · FK 정책은 전건 불변**
> **개정일**: 2026-09-08 — 한계 등재 35 → **36항** — **명세서 보존기한과 문서 보존기한의 대조**를 등재한다. 11_payslip이 GENERATED 전이에서 documents.retention_until과의 일치 검증을 규정하는데 **guard_payslip_transition()은 document_id의 존재만 보고 대조 구문이 없어 어느 층도 맡지 않는 상태**였다. 서비스 층이 맡고 payslip.generation_failed/422로 낸다. **트리거로 가지 않는 근거는 권한이다** — 대조 대상이 다른 테이블의 열이라 정의자 권한을 그 테이블까지 넓혀야 하고 그 확장이 검사 하나의 값보다 비싸다. 나머지 제약·PK·유일성 수치는 전건 불변
> **개정일**: 2026-09-07 — 표 안의 SQL 이어붙임 연산자를 **이스케이프**한다(표 셀 열 수 검사 발견 · 3행). 마크다운 표에서 이스케이프하지 않은 세로줄은 **칸 구분자로 파싱되어** advisory lock 키 식이 중간에서 잘리고 **뒤 칸이 통째로 렌더에서 사라졌다.** 인라인 백틱을 쓸 수 없으므로(작성 규약) 이스케이프로 처리한다. **내용·잠금 지점 수는 전건 불변**
> **개정일**: 2026-09-07 — **V0711** 적용 반영(idempotency_records 신설 — 정본 [17_infra.md](./17_infra.md)) — PK 60 → **61**(uuid v4 42 → **43**) · 유일성 강제 59 → **60**(부분 UNIQUE 27 → **28**) · 형식·범위 CHECK 3항 신설(scope_type 2값 · 키 길이 1~255 · status 3값 · 실측 CHECK 139 → **142**). **enum 33/132 · UNIQUE 32 · EXCLUDE 10 · 복합 FK 5 · FK SET NULL 48 · append-only 12 · 한계 등재 35항은 전건 불변** — 신설 테이블이 FK를 하나도 갖지 않는다. V0712는 GRANT · 함수 본문 교체 · ALTER POLICY라 이 문서의 수치를 바꾸지 않는다
> **개정일**: 2026-08-09 — 전역 수치 정합 — enum으로 굳히지 않은 축 표의 category 17 → **19종** · SET NULL 잔여 서술 46 → **48**(메타·본문 확정값과 일치시킴)
> **개정일**: 2026-08-08 — DB 커버리지 감사 통합 반영 — 테이블 58 → **60**(employee_protected_periods · scheduled_job_runs) · enum 32 → **33**(protected_period_kind) · PK 58 → **60** · 유일성 46 → **59** · EXCLUDE 6 → **10** · SET NULL 46 → **48** · 복합 FK 1 → **5** · 동시성 10 → **13지점** · 한계 등재 15 → **35항** · statutory_rates category 17 → **19값**
> **개정일**: 2026-08-08 — 요금제 버전 관리 재설계 반영 — plans PK를 uuid로 전환(uuid v4 40 → **41** · text 자연키 2 → **1**) · UNIQUE(code, version) 등재로 유일성 강제 45 → **46**(UNIQUE 26 → **27**) · 지급일 보정 정책 CHECK 삭제
> **개정일**: 2026-08-03 — M5 SET NULL FK 전수 재계수 44 → **46**(attendance_records.reviewed_by · workplace_employee_count_snapshots.confirmed_by 누락 보정) · 행위자 소계 34 → **36**
> **개정일**: 2026-08-03 — employment_terms·pay_items CHECK 추가(work_days 값 집합·weekly_holiday_dow·STATUTORY 순환 차단) · 동시성 지점 9 → **10** · 한계 등재 14 → **15항**
> **원천**: docs_ref2/schema_p0.md — enum 목록 · 공통 컬럼 규약 · 무결성 제약 요약 · 각 테이블 명세의 제약·인덱스 절

무결성 강제 지점을 한자리에 모은 참조표다. 컬럼별 설명은 도메인 파일(01~06 · 11~17)에 있고, 여기서는 **제약의 전수와 그 근거**를 고정한다.

강제는 네 층으로 나뉜다 — **타입(enum)** · **제약(CHECK · UNIQUE · EXCLUDE · FK)** · **정책(RLS)** · **트리거(BEFORE 가드)** 다. 제약으로 표현할 수 없는 것은 마지막 두 층이 맡으며, 어느 층도 맡지 않는 항목은 아래 한계 절에 등재한다.

필수 확장은 둘이다 — **btree_gist**(EXCLUDE **10종**에 필요) · **pgcrypto**(gen_random_uuid). uuidv7()은 PostgreSQL 18 내장이라 확장이 필요 없다.

---

## enum 타입 33종

legacy 23종 전량 유지 + 신설 10종 = **33종**이다. **값 삭제는 하지 않고 비활성 처리한다** — PostgreSQL에서 enum 라벨 삭제는 되돌리기 어렵다.

| # | 타입 | 값 수 | 값 | 사용처 |
|---|------|:----:|----|--------|
| 1 | account_status | 3 | ACTIVE · SUSPENDED · DELETED | users · profiles. DELETED 종단 |
| 2 | workplace_role | 3 | OWNER · MANAGER · STAFF | workplace_members · workplace_invitations |
| 3 | workplace_status | 4 | PENDING_VERIFICATION · ACTIVE · SUSPENDED · CLOSED | workplaces. CLOSED 종단·읽기전용 |
| 4 | member_status | 5 | INVITED · ACTIVE · LEFT · REMOVED · SUSPENDED | workplace_members. **LEFT(자발)→ACTIVE 재활성화 허용 · REMOVED(강제) 종단**. INVITED·SUSPENDED는 v1 미사용 예약값 |
| 5 | invitation_status | 5 | PENDING · ACCEPTED · REJECTED · CANCELLED · EXPIRED | workplace_invitations. PENDING 외 전부 종단 |
| 6 | system_role | 4 | VIEWER · SUPPORT · ADMIN · SUPER_ADMIN | system_admins |
| 7 | subscription_status | 5 | TRIAL · ACTIVE · PAST_DUE · EXPIRED · CANCELLED | subscriptions |
| 8 | tax_unit_type | 2 | GENERAL · BUSINESS_UNIT | workplaces. v1 기본 GENERAL |
| 9 | site_role | 2 | PRIMARY · SUB | workplaces. 동일 사업자번호 그룹 내 주·종 |
| 10 | **consent_kind**(신설) | 3 | TERMS · PRIVACY · LOCATION | terms_documents · user_consents. **위치정보는 별도 kind**(위치정보법 §18) |
| 11 | employment_type | 4 | REGULAR · CONTRACT · PART_TIME · DAILY | employment_terms · contract_templates |
| 12 | pay_type | 3 | HOURLY · MONTHLY · DAILY | employment_terms · payroll_terms |
| 13 | **employee_status**(신설 · text CHECK 승격) | 3 | ACTIVE · ON_LEAVE · RESIGNED | employees. RESIGNED 종단(재입사 = 새 레코드) |
| 14 | **worker_type**(신설) | 4 | EMPLOYEE · REPRESENTATIVE · COHABITING_RELATIVE · DOMESTIC_WORKER | employees. 비근로자는 상시근로자 산정·법정수당·연차·4대보험에서 제외(REQ-HRM-28) |
| 15 | gender | 3 | MALE · FEMALE · OTHER | employees |
| 16 | **insurance_type**(신설 · text CHECK 승격) | 5 | NATIONAL_PENSION · HEALTH · LONG_TERM_CARE · EMPLOYMENT · INDUSTRIAL_ACCIDENT | employee_insurance_infos · 급여 공제 라인 · compliance_tasks |
| 17 | contract_status | 5 | DRAFT · SENT · SIGNED · ARCHIVED · CANCELLED | contracts |
| 18 | attendance_status | 4 | OPEN · COMPLETED · PENDING · CANCELLED | attendance_records. PENDING = 정확도 미달 승인 대기 |
| 19 | attendance_source | 3 | GPS · MANUAL · IMPORT | attendance_records. **QR은 v1 제외**(ATT-11) |
| 20 | attendance_day_status | 8 | NORMAL · LATE · EARLY_LEAVE · ABSENT · MISSING_CLOCKOUT · ON_LEAVE · HOLIDAY · WEEKLY_HOLIDAY | attendance_daily_summaries |
| 21 | attendance_change_request_status | 4 | PENDING · APPROVED · REJECTED · CANCELLED | attendance_change_requests. 종결 3종 불변 |
| 22 | attendance_closing_status | 3 | LOCKED · REOPENED · CANCELLED | attendance_period_closings |
| 23 | leave_status | 4 | PENDING · APPROVED · REJECTED · CANCELLED | leave_requests. APPROVED→CANCELLED는 관리자 조건부 허용 |
| 24 | **leave_txn_type**(신설 · text CHECK 승격) | 5 | GRANT · USE · RESTORE · EXPIRE · ADJUST | leave_transactions |
| 25 | payroll_status | 4 | DRAFT · CALCULATED · CONFIRMED · VOIDED | payroll_runs. CONFIRMED→VOIDED 외 되돌리기 금지 |
| 26 | payslip_status | 5 | PENDING · GENERATED · FAILED · DELIVERED · CORRECTED | payslips |
| 27 | pay_item_type | 2 | EARNING · DEDUCTION | pay_items · payroll_employee_result_items |
| 28 | pay_calc_method | 4 | FIXED · RATE · FORMULA · STATUTORY | pay_items |
| 29 | **import_status**(신설) | 6 | UPLOADED · VALIDATED · COMMITTED · PARTIALLY_COMMITTED · CANCELLED · FAILED | import_jobs. **legacy PREVIEW·ROLLED_BACK 폐기** — requirements_p0 상태머신 준수 |
| 30 | **compliance_task_type**(신설) | 6 | INSURANCE_ACQUISITION · INSURANCE_LOSS · SEPARATION_CERTIFICATE · WAGE_SETTLEMENT · SEVERANCE_PAYMENT · WITHHOLDING_FILING | compliance_tasks(TAX-01·02·11 · PAY-19) |
| 31 | **compliance_task_status**(신설) | 3 | OPEN · COMPLETED · WAIVED | compliance_tasks. **임박·경과는 due_date에서 파생**(상태 저장 금지 — 배치 재실행 결정성) |
| 32 | **severance_plan_type**(신설) | 3 | STATUTORY_SEVERANCE · DB · DC | severance_assessments. 퇴직급여 추상(REQ-PAY-34) |
| 33 | **protected_period_kind**(신설) | 5 | OCCUPATIONAL_INJURY_LEAVE · MATERNITY_LEAVE · PARENTAL_LEAVE · CHILDCARE_REDUCED_HOURS · PREGNANCY_REDUCED_HOURS | employee_protected_periods. 근로기준법 §60⑥ 출근 간주 5유형(REQ-LEV-04) |

값 수 검산: (3 + 3 + 4 + 5 + 5 + 4 + 5 + 2 + 2 + 3 = 36) + (4 + 3 + 3 + 4 + 3 + 5 + 5 + 4 + 3 + 8 = 42) + (4 + 3 + 4 + 5 + 4 + 5 + 2 + 4 + 6 + 6 = 43) + (3 + 3 + 5 = 11) = **132**.

신설 10종 검산: consent_kind · employee_status · worker_type · insurance_type · leave_txn_type · import_status · compliance_task_type · compliance_task_status · severance_plan_type · **protected_period_kind** = **10**. legacy 승계 23 + 신설 10 = **33**.

- 신설 10종 중 **4종은 legacy의 text CHECK를 승격**한 것이고(employee_status · insurance_type · leave_txn_type · import_status), 6종은 v1 신규 개념이다(consent_kind · worker_type · compliance_task_type · compliance_task_status · severance_plan_type · protected_period_kind).
- **protected_period_kind를 enum으로 굳히는 이유는 값 집합이 법 조문에 고정되기 때문이다** — §60⑥의 다섯 호가 그대로 다섯 값이며 운영 중 늘어나지 않는다. 반대로 작업 상태·채널처럼 테이블마다 집합이 다른 축은 아래 절대로 text + CHECK로 둔다.
- 상태 머신 다이어그램의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다.

### enum으로 굳히지 않은 축

값 집합이 테이블마다 다르거나 운영 중 변동이 잦은 축은 **text + CHECK** 또는 **lookup 테이블**로 둔다.

| 축 | 형태 | 근거 |
|----|------|------|
| notification_types.code | lookup 테이블 | 알림 타입은 자주 늘어난다. 값 추가마다 ALTER TYPE이 필요하면 롤백이 어렵다 |
| plans.code | lookup 테이블 | 등급 코드는 FREE · PRO · ULTRA 3종 고정이고, 한도 변경은 **같은 code의 새 version 행**으로 쌓는다(비파괴) |
| statutory_rates.(category, key) | lookup 행 | 법령 기준값. category **19종**은 CHECK로 고정한다 |
| leave_types.code | 사업장 시드 | 사업장별로 다르다 |
| batch_jobs.status · export_jobs.status · import_jobs 외 작업 상태 | text + CHECK | 값 집합이 작업 유형마다 다르다 |
| delivery_type · channel · priority · source · category | text + CHECK | 테이블별 집합이 다르다 |

---

## CHECK 제약

### 형식·범위 CHECK

| 테이블 | 내용 |
|--------|------|
| users | username 정규식 ^[a-z][a-z0-9]{3,19}$ · **status <> 'DELETED' OR deleted_at IS NOT NULL** · **status <> 'SUSPENDED' OR (suspended_until IS NOT NULL AND suspend_reason IS NOT NULL)** |
| profiles | name 2~50자 · **phone 정규식** · **recovery_email 형식** · **status <> 'DELETED' OR deleted_at IS NOT NULL** |
| user_consents | source IN ('SIGNUP','REAGREE','SETTINGS') |
| security_events | kind IN (**8값** — PASSWORD_CHANGE · PASSWORD_RESET · LOGOUT_ALL · REAUTH · LOGIN_FAILED · **LOGIN_SUCCESS** · **PROFILE_CHANGE** · **RECOVERY_EMAIL_CHANGE**) · **result IN ('SUCCESS','FAILURE')** · **user_id IS NOT NULL OR (kind = 'LOGIN_FAILED' AND attempted_username IS NOT NULL)** · **로그인 kind와 result 정합** |
| password_reset_tokens | **expires_at > created_at** |
| workplaces | business_no 정규식 ^[0-9]{10}$ · company_name 1~100자 · geofence_radius_m 50~500 · close_path IN ('OWNER_VOLUNTARY','PLATFORM_FORCED') · **withholding_payment_cycle IN ('MONTHLY','SEMI_ANNUAL')** · **attendance_policy 허용 키 4종 화이트리스트**(auto_break_deduction · auto_break_minutes · default_grace_minutes · block_closing_on_limit_violation) |
| business_units | effective_to > effective_from |
| business_verification_logs | result IN ('MATCH','MISMATCH','SUSPENDED','CLOSED','ERROR') |
| workplace_members | **status <> 'REMOVED' OR (leave_reason IS NOT NULL AND effective_date IS NOT NULL)** |
| workplace_invitations | target_username IS NOT NULL OR target_phone IS NOT NULL · role IN ('MANAGER','STAFF') |
| workplace_employee_count_snapshots | scope IN ('WORKPLACE','BUSINESS_UNIT') · **scope <> 'BUSINESS_UNIT' OR business_unit_id IS NOT NULL** · period_end >= period_start · total_worker_days >= 0 · operating_days > 0 · under_five_days >= 0 · under_ten_days >= 0 · source IN ('AUTO','MANUAL') |
| employee_count_snapshot_days | worker_count >= 0 |
| employees | tax_dependents_count >= 1 · children_under_20_count >= 0 · resignation_date >= hire_date · last_work_date >= hire_date · resignation_reason IN ('VOLUNTARY','RECOMMENDED','CONTRACT_END','DISMISSAL') · source IN ('MANUAL','IMPORT') |
| employment_terms | base_wage >= 0 · contractual_minutes >= 0 · **work_days 값 집합 7값 한정**(MON · TUE · WED · THU · FRI · SAT · SUN) · **cardinality(work_days) >= 1**(빈 배열 금지 — 1일 소정근로시간 도출의 분모다) · **work_days 중복 금지** · **weekly_holiday_dow BETWEEN 0 AND 6**(0 = 일요일 ~ 6 = 토요일) · effective_to > effective_from · **probation_discount_allowed = false OR probation_wage_rate IS NOT NULL** |
| employee_insurance_infos | lost_date >= acquired_date |
| contracts | delivery_channel IN ('IN_APP','EMAIL') |
| contract_signatures | **terms_confirmed** — 주요 근로조건 확인 없는 서명 저장 차단 |
| documents | category 10값 · size_bytes IS NULL OR size_bytes >= 0 |
| attendance_records | clock_out_at >= clock_in_at · **source <> 'GPS' OR location_usage_record_id IS NOT NULL** |
| attendance_breaks | break_end >= break_start |
| attendance_daily_summaries | 전 분 컬럼 >= 0 · source IN ('ROLLUP','IMPORT') · **holiday_basis IN ('WEEKLY_HOLIDAY','PUBLIC_HOLIDAY')** · **premium_eligible = false OR count_snapshot_id IS NOT NULL** |
| attendance_change_requests | **status NOT IN ('APPROVED','REJECTED') OR (review_note IS NOT NULL AND btrim(review_note) <> '')** |
| work_schedules | pattern_type IN ('WEEKLY','SINGLE') · day_of_week 0~6 · ends_next_day OR end_time > start_time · **(WEEKLY AND day_of_week IS NOT NULL) OR (SINGLE AND specific_date IS NOT NULL)** |
| leave_requests | end_date >= start_date · requested_days > 0 · half_day_period IN ('AM','PM') · **is_half_day = false OR (requested_days = 0.5 AND half_day_period IS NOT NULL AND start_date = end_date)** · **is_half_day = true OR half_day_period IS NULL** |
| leave_grants | granted_days > 0 · source IN ('AUTO','MANUAL','IMPORT') · **expires_at NOT NULL**(컬럼 제약) |
| leave_transactions | days <> 0 · source IN ('AUTO','MANUAL','IMPORT') · **txn_type별 days 부호 정합** · **txn_type NOT IN ('USE','RESTORE','EXPIRE') OR grant_id IS NOT NULL** |
| employee_protected_periods | end_date IS NULL OR end_date >= start_date · **(kind IN ('CHILDCARE_REDUCED_HOURS','PREGNANCY_REDUCED_HOURS')) = (reduced_weekly_minutes IS NOT NULL)** · reduced_weekly_minutes IS NULL OR (reduced_weekly_minutes >= 0 AND baseline_weekly_minutes > reduced_weekly_minutes) |
| pay_items | **NOT (calc_method = 'STATUTORY' AND include_in_ordinary_wage)** — 서버 산출 법정수당을 통상임금에 산입하면 통상시급 계산이 순환한다(REQ-PAY-01 · REQ-PAY-08) |
| payroll_terms | base_wage >= 0 · income_tax_rate_percent IN (80,100,120) · payday 1~31 · **payday_month IN ('SAME_MONTH','NEXT_MONTH')** · effective_to > effective_from — **지급일 보정 정책 CHECK를 두지 않는다**(플랫폼 단일 규칙 · REQ-PAY-04). **payday_month는 보정 정책이 아니라 지급 시기의 사실**이라 그 금지에 걸리지 않는다([06_payroll.md](./06_payroll.md)) |
| payroll_runs | source IN ('REGULAR','IMPORT') · **supersedes_id IS NULL OR correction_reason IS NOT NULL** — 사유 없는 정정본 차단(REQ-PAY-29) |
| payroll_employee_results | **employee_no IS NOT NULL OR employee_birth_date IS NOT NULL** — 명세서 법정 기재사항 ①(성명·생년월일 **또는** 사번)의 특정 축이 둘 중 하나는 반드시 동결돼야 한다 |
| payroll_employee_result_items | bucket IN 8버킷 코드 · **amount >= 0** — 방향은 부호가 아니라 type이 표현한다(무급공제 = DEDUCTION) · **settlement_days IS NULL OR settlement_days > 0** — 정산 일수는 0일 수 없다(0이면 정산 라인 자체가 없다) |
| payroll_validation_results | check_type IN (**8값** — MIN_WAGE · TAX_TABLE · INSURANCE · REFERENCE_VALUE · SNAPSHOT · ATTENDANCE_CLOSING · PAYROLL_TERMS · **NONTAX_ELIGIBILITY**) · severity IN ('BLOCK','WARN') |
| payslips | **supersedes_id IS NULL OR correction_reason IS NOT NULL** — 사유 없는 정정본 차단 |
| payslip_deliveries | delivery_type IN ('ISSUED','VIEWED','DOWNLOADED') · channel IN ('IN_APP','EMAIL','WEB') · **delivery_type <> 'ISSUED' OR channel IS NOT NULL** |
| batch_jobs | job_type IN ('PAYSLIP_BULK','HR_OFFBOARD_SETTLEMENT') · status IN ('RUNNING','COMPLETED','FAILED','PARTIAL') · reissue_policy IN ('SKIP_ISSUED','GENERATE_MISSING') · **job_type <> 'PAYSLIP_BULK' OR payroll_run_id IS NOT NULL** |
| compliance_tasks | trigger_event IN ('HIRE','RESIGNATION','SEPARATION_REQUEST','PAYROLL_CONFIRM') · **task_type = 'WITHHOLDING_FILING' OR employee_id IS NOT NULL** |
| notification_types · notifications | priority IN ('LOW','NORMAL','HIGH','URGENT') |
| plans | max_owned_workplaces >= 1 · **max_staff_per_workplace BETWEEN 1 AND 30** · version >= 1 · code IN ('FREE','PRO','ULTRA') |
| statutory_rates | category **19값** · effective_to > effective_from |
| income_tax_table_entries | dependents_count >= 1 · **wage_base_to IS NULL OR wage_base_to > wage_base_from** |
| location_usage_records | purpose IN ('COMMUTE_GEOFENCE_VERIFICATION') · collection_channel IN ('MOBILE_APP_GPS') · **subject_ref_type IN ('ATTENDANCE_RECORD')** |
| import_jobs | import_type IN ('EMPLOYEES','OPENING_BALANCE') |
| export_jobs | export_type IN ('PAYROLL_LEDGER','AUDIT') · status IN ('PENDING','RUNNING','COMPLETED','FAILED') |
| scheduled_job_runs | job_name IN (**정기작업 8종**) · status IN ('RUNNING','SUCCEEDED','FAILED','SKIPPED') · attempt >= 1 · finished_at IS NULL OR finished_at >= started_at |
| **idempotency_records** | **scope_type IN ('WORKPLACE','USER')** · **idempotency_key 길이 1~255** · **status IN ('STARTED','COMPLETED','DISCARDED')** |

- **길이·범위를 varchar(n)이 아니라 text + CHECK로 두는 것이 의도다** — 상한 변경이 ALTER TABLE 재작성 없이 끝나고, 상한값 자체가 정책이므로 DDL에 남는다.

### 합계·불변식 CHECK

| 테이블 | 불변식 | 막는 것 |
|--------|-------|--------|
| attendance_daily_summaries | **total_work_minutes = 8버킷 합** · **total_work_minutes = present_minutes − break_minutes** · **break_minutes <= present_minutes** | 상호배타 분해의 겹침·누락. 겹치면 가산 이중 지급, 누락되면 미지급. 휴게가 재실을 초과하는 마감 차단 사유를 물리 차단으로 승격한다 |
| payroll_employee_results | **total_work_minutes = 8버킷 합** · **net_pay = gross_pay − total_deduction** | 위와 동일. 확정 결과에서 다시 검증한다. 산술 항등식은 라인 없이도 성립해야 한다 |
| payroll_employee_results · items | **gross_pay = Σ EARNING · total_deduction = Σ DEDUCTION · net_pay = gross − deduction** — DEFERRABLE CONSTRAINT TRIGGER. **source = 'IMPORT' 면제** | 헤더 캐시값과 라인 합의 괴리 |
| employee_count_snapshot_days | **total_worker_days = Σ worker_count · operating_days = count(\*)** — DEFERRABLE | 시계열과 판정 근거의 괴리 |
| leave_balances | **balance_days = granted_days − used_days − expired_days + restored_days + adjusted_days** · balance_days >= 0 · balance_days >= reserved_days | 음수 잔액·과다 예약. 원장 5종 중 RESTORE·ADJUST를 담는 항이 없으면 항등식이 성립 자체를 못 한다 |
| leave_balances · leave_requests | **reserved_days = Σ leave_requests.reserved_days WHERE status = 'PENDING'** — DEFERRABLE CONSTRAINT TRIGGER | 복원 누락이 감지 경로 없이 영구 누적되는 것 |
| leave_transactions | txn_type별 days 부호 정합 | 발생을 음수로, 사용을 양수로 넣는 오기 |
| workplaces | **status = 'CLOSED' → closed_at · retention_until NOT NULL** | 보존 기산일 없는 폐쇄 |
| contracts | **status = 'ARCHIVED' → retention_until · archived_at · delivered_at NOT NULL** | 보존 기산일 없는 보관 **및 교부 없는 보관**(§17② 미이행의 종단화) |
| attendance_records | **coords_purged_at NOT NULL → 좌표·정확도 전부 NULL** | 파기 표시만 하고 좌표가 남는 상태 |

- **employer_insurance_total과 산재 base는 합계 검증에서 제외한다** — 근로자 공제가 아니므로 공제 합에 들어가지 않는다.
- DEFERRABLE인 두 트리거는 부모·자식 행을 한 트랜잭션 안에서 순서 무관하게 넣을 수 있게 한다.

---

## PK 61개 — 테이블당 1개

| 형태 | 테이블 | 수 |
|------|--------|:--:|
| uuid 단일(gen_random_uuid) | users · profiles · terms_documents · password_reset_tokens · workplaces · business_units · workplace_members · workplace_invitations · workplace_employee_count_snapshots · employees · employee_personal_infos · employment_terms · employee_insurance_infos · contract_templates · contracts · contract_signatures · documents · attendance_daily_summaries · attendance_change_requests · attendance_period_closings · work_schedules · leave_types · leave_grants · leave_requests · leave_balances · **employee_protected_periods** · pay_items · payroll_terms · payroll_runs · payroll_employee_results · payroll_employee_result_items · payroll_validation_results · payslips · batch_jobs · severance_assessments · **plans** · subscriptions · system_admins · statutory_rates · income_tax_table_entries · import_jobs · export_jobs · **idempotency_records** | 43 |
| **uuid 단일(uuidv7)** — 고volume append | user_consents · account_status_events · security_events · workplace_change_logs · membership_role_events · business_verification_logs · employee_insurance_histories · attendance_records · attendance_breaks · leave_transactions · payslip_deliveries · compliance_tasks · notifications · audit_logs · location_usage_records · **scheduled_job_runs** | 16 |
| **text 자연키** | notification_types(code) | 1 |
| **복합** | employee_count_snapshot_days(snapshot_id, count_date) | 1 |

검산: 43 + 16 + 1 + 1 = **61**.

- **uuidv7을 쓰는 기준은 "시간순 대량 삽입인가"다.** 로그·이벤트·알림·근태 원본·원장·교부이력·확인자료가 대상이며, 시간정렬 PK가 인덱스 단편화를 줄이고 leave_transactions의 FIFO 재구성을 결정론적으로 만든다.
- gen_random_uuid(v4)를 쓰는 일반 엔티티는 삽입 순서에 의미가 없다.

---

## 유일성 강제 60개

**UNIQUE 제약 32 + 부분 UNIQUE 인덱스 28 = 60**이며, 별개로 복합 PK 1건(employee_count_snapshot_days)이 유일성을 겸한다.

### UNIQUE 제약 32개

| # | 테이블 | 조합 | 목적·에러 |
|---|--------|------|----------|
| 1 | users | (username) | auth.username_taken/409 |
| 2 | profiles | (username) | users에서 동기화된 표시 키 |
| 3 | terms_documents | (kind, version) | system.terms_version_conflict/409 |
| 4 | user_consents | (user_id, kind, terms_document_id) | privacy.consent_version_conflict/409(멱등) |
| 5 | password_reset_tokens | (token_hash) | 토큰 유일 |
| 6 | workplaces | (business_no, site_label) | workplace.duplicate_site/409 — **동일 사업자번호 복수 등록은 합법** |
| 7 | workplace_members | (workplace_id, user_id) | 멤버십 유일 |
| 8 | workplace_invitations | (token_hash) | 초대 토큰 유일 |
| 9 | workplace_employee_count_snapshots | (workplace_id, base_date, scope) | 스냅샷 유일 |
| 10 | employee_personal_infos | (employee_id) | 1:1 |
| 11 | contract_templates | (workplace_id, name) | 템플릿 명칭 유일 |
| 12 | **contract_templates** | **(id, workplace_id)** | contracts 복합 FK의 대상 키 |
| 13 | contracts | (id, workplace_id) | **contract_signatures 복합 FK의 대상 키** |
| 14 | **contracts** | **(workplace_id, employee_id, version)** | 세대 축의 유일성 — 동일 version 중복 발행 차단 |
| 15 | contract_signatures | (contract_id, signer_user_id) | 중복 서명 차단 |
| 16 | documents | (storage_path) | 경로 중복 메타 차단 |
| 17 | **documents** | **(id, workplace_id)** | contracts 복합 FK의 대상 키 |
| 18 | attendance_daily_summaries | (employee_id, work_date) | 일 집계 유일 |
| 19 | leave_types | (workplace_id, code) | 유형 유일 |
| 20 | **leave_types** | **(id, workplace_id)** | leave_requests 복합 FK의 대상 키 |
| 21 | **leave_requests** | **(id, workplace_id)** | attendance_daily_summaries 복합 FK의 대상 키 |
| 22 | leave_balances | (employee_id) | 직원당 1건 |
| 23 | pay_items | (workplace_id, code) | 항목 코드 유일 |
| 24 | payroll_employee_results | (payroll_run_id, employee_id) | 직원 결과 유일 |
| 25 | **payroll_validation_results** | **(payroll_run_id, employee_id, check_type) NULLS NOT DISTINCT** | 실행·직원·검사 축당 결과 1건. 재계산 교체의 전제다 |
| 26 | compliance_tasks | (workplace_id, idempotency_key) | 기한 작업 멱등(REQ-GLB-14) |
| 27 | severance_assessments | (employee_id, base_date) | 퇴직 판정 유일 |
| 28 | **plans** | **(code, version)** | 같은 등급의 버전 유일 — 중복 등록 시도는 기존 요금제 변경 계약(system.plan_in_use/409)과 같은 표면에서 거부된다 |
| 29 | **plans** | **(code, effective_from)** | 같은 등급의 시행일 유일 — 같은 날 두 버전이 유효해지면 한도 조회가 비결정적이 된다 |
| 30 | subscriptions | (user_id) | 계정당 1건 |
| 31 | system_admins | (user_id, role) | 역할 유일(복수 역할 가능) |
| 32 | income_tax_table_entries | (rate_id, dependents_count, wage_base_from) | 세액표 구간 시작점 유일 |

- **대상 키용 UQ 5종**(contracts · contract_templates · documents · leave_types · leave_requests의 (id, workplace_id))은 조회 성능이 아니라 **복합 FK를 성립시키기 위한 것**이다. PostgreSQL은 FK 대상이 PK 또는 UNIQUE여야 하므로 이 조합에 UQ가 없으면 복합 FK를 선언할 수 없다.
- **NULLS NOT DISTINCT를 명시하는 유일한 자리가 #25다** — PostgreSQL의 기본 UNIQUE는 NULL을 서로 다른 값으로 보아 실행 단위 검증(employee_id IS NULL)의 중복을 허용한다. PostgreSQL 15부터의 이 옵션이 그 구멍을 막는다.
- **삭제된 2종이 있다** — employee_insurance_infos (employee_id, insurance_type)은 자격 기간 이력 축으로 전환하며 부분 UQ + EXCLUDE가 대체하고, attendance_period_closings (workplace_id, pay_period)는 전체 UNIQUE라 CANCELLED 이후 재마감을 막아 부분 UQ로 대체했다.

### 부분 UNIQUE 인덱스 28개

| # | 테이블 | 정의 | 목적·에러 |
|---|--------|------|----------|
| 1 | profiles | (phone) WHERE status <> 'DELETED' | auth.phone_taken/409 — 탈퇴 계정의 번호는 재사용 가능 |
| 2 | terms_documents | (kind) WHERE is_active | **kind별 활성 정확히 1개**(REQ-SYS-15) |
| 3 | **workplaces** | **(business_no) WHERE site_role = 'PRIMARY'** | 동일 사업자번호 그룹의 대표 사업장 유일 — common.conflict/409 |
| 4 | workplace_members | (workplace_id) WHERE role = 'OWNER' AND status = 'ACTIVE' | **OWNER 2명 이상 차단** — workplace.owner_singleton/409 |
| 5 | workplace_invitations | (workplace_id, target_username) WHERE status = 'PENDING' | 초대 멱등 |
| 6 | workplace_invitations | (workplace_id, target_phone) WHERE status = 'PENDING' | 초대 멱등 |
| 7 | employees | (workplace_id, user_id) WHERE status = 'ACTIVE' | hr.duplicate_active_employee/409 |
| 8 | employees | (workplace_id, employee_no) WHERE employee_no IS NOT NULL | 사번 유일 |
| 9 | employee_personal_infos | (workplace_id, resident_no_blind_index) WHERE NOT NULL | hr.resident_no_duplicate/409 — **복호화 없는 판정** |
| 10 | **employee_insurance_infos** | **(employee_id, insurance_type) WHERE lost_date IS NULL** | 상실되지 않은 자격은 보험 종류당 1건 |
| 11 | attendance_records | (employee_id) WHERE status = 'OPEN' | 미퇴근 1건 — attendance.invalid_sequence/409 |
| 12 | attendance_records | (client_event_id) WHERE client_event_id IS NOT NULL | 오프라인 멱등 |
| 13 | attendance_change_requests | (employee_id, work_date) WHERE status = 'PENDING' | attendance.change_request_pending/409 |
| 14 | **attendance_period_closings** | **(workplace_id, pay_period) WHERE status <> 'CANCELLED'** | 마감 멱등 + 오입력 무효화 후 재마감 경로 확보 |
| 15 | **work_schedules** | **(employee_id, specific_date) WHERE pattern_type = 'SINGLE'** | 같은 날 단일 스케줄 2건 차단 |
| 16 | payroll_runs | (workplace_id, pay_period, source) WHERE supersedes_id IS NULL AND status <> 'VOIDED' | **중복 확정 차단** — payroll.already_confirmed/409 |
| 17 | payroll_runs | (supersedes_id) WHERE NOT NULL AND status <> 'VOIDED' | 원본당 활성 정정본 1건 |
| 18 | payroll_runs | (workplace_id, idempotency_key) WHERE NOT NULL | payroll.confirmation_conflict/409 |
| 19 | payslips | (payroll_run_id, employee_id) WHERE supersedes_id IS NULL | payslip.already_issued/409 |
| 20 | payslips | (supersedes_id) WHERE NOT NULL AND status <> 'CORRECTED' | 원본당 활성 정정본 1건 |
| 21 | payslip_deliveries | **(payslip_id, channel) WHERE delivery_type = 'ISSUED'** | **채널별 교부 1회 멱등** — 인앱 게시가 1행을 소진해 이메일 대체 교부를 기록하지 못하던 구멍을 막는다 |
| 22 | batch_jobs | (workplace_id, idempotency_key) WHERE NOT NULL | payslip.bulk_conflict/409 |
| 23 | batch_jobs | (payroll_run_id) WHERE status = 'RUNNING' AND job_type = 'PAYSLIP_BULK' | payslip.bulk_in_progress/409 |
| 24 | **notifications** | **(recipient_user_id, dedupe_key) WHERE dedupe_key IS NOT NULL** | 경보성 알림의 중복 발송 억제(REQ-TAX-04 배치 멱등의 산출물 축) |
| 25 | **plans** | **(code) WHERE is_active** | 등급별 활성 요금제 정확히 1개 |
| 26 | **scheduled_job_runs** | **(job_name, base_date) WHERE status IN ('RUNNING','SUCCEEDED')** | 정기작업 기준일 멱등 — 같은 기준일의 성공 실행은 1건이다 |
| 27 | **leave_grants** | **(employee_id, grant_date) WHERE source = 'AUTO'** | **연차 발생 배치 멱등**(REQ-GLB-14) — 같은 직원·같은 발생일의 자동 발생은 1건이다. 수동·임포트 발생은 조정 성격이라 제외한다 |
| 28 | **idempotency_records** | **(scope_type, scope_id, idempotency_key) WHERE status <> 'DISCARDED'** | **요청 재시도 멱등** — 같은 스코프·같은 키의 살아 있는 기록은 1건이다. DISCARDED를 빼는 이유는 **물리 삭제 없이 재시도를 열기 위해서다** |

검산: 32 + 28 = **60**. 도메인별 분포는 auth 7 · workplace 8 · hr 12 · attendance 6 · leave 5 · payroll 6 · payslip 5 · compliance 2 · subscription 4 · system 2 · notification 1 · infra **2** = 60.

- **27이 REQ-GLB-14의 마지막 공백을 메운다** — 멱등 대상 5종(급여 확정 · 근태 마감 · 명세서 발행 · 연차 발생 배치 · 신고자료 생성) 중 연차 발생만 DB 근거가 없어 재실행이 발생 행을 두 번 쌓을 수 있었다. 잔액 항등식은 그 중복을 잡지 못한다 — 원장과 요약이 함께 커지므로 둘 다 일관되게 틀린다.

- **28이 멱등키 계약의 물리적 근거다** — 실패 응답을 기록하지 않는다는 계약(④)을 물리 삭제 없이 지키려면 상태 전이가 유일한 수단이고, 그러면 같은 키의 재시도가 전체 유니크에 막힌다. 부분 유니크가 둘을 동시에 만족시킨다.
- **부분 유니크가 전체 유니크보다 많이 쓰이는 이유는 상태 축 때문이다.** "활성인 것만 유일" · "PENDING인 것만 유일" · "원본만 유일"처럼 상태를 조건으로 걸어야 정정본·이력·재초대가 공존한다.

---

## EXCLUDE 제약 10개 (btree_gist)

| # | 테이블 | 조건 | 에러 |
|---|--------|------|------|
| 1 | employment_terms | (employee_id =, daterange(effective_from, coalesce(effective_to,'infinity'),'[)') &&) | hr.term_overlap/409 |
| 2 | payroll_terms | 동일 패턴 | payroll.payroll_terms_overlap/409 |
| 3 | **statutory_rates** | (category =, key =, daterange &&) | system.statutory_rate_overlap/409 |
| 4 | business_units | (owner_user_id =, name =, daterange &&) | 사업 단위 선언 기간 겹침 |
| 5 | leave_requests | (employee_id =, daterange(start_date, end_date + 1) &&) WHERE status IN ('PENDING','APPROVED') | leave.request_overlap/409 |
| 6 | attendance_breaks | (attendance_record_id =, tstzrange(break_start, coalesce(break_end,'infinity')) &&) | 휴게 구간 겹침 |
| 7 | **employee_insurance_infos** | (employee_id =, insurance_type =, daterange(acquired_date, coalesce(lost_date,'infinity'),'[)') &&) WHERE acquired_date IS NOT NULL | common.conflict/409 |
| 8 | **work_schedules** | (employee_id =, day_of_week =, daterange(effective_from, coalesce(effective_to,'infinity'),'[)') &&) WHERE pattern_type = 'WEEKLY' AND is_active | common.conflict/409 |
| 9 | **employee_protected_periods** | (employee_id =, kind =, daterange(start_date, coalesce(end_date,'infinity'),'[)') &&) | common.conflict/409 |
| 10 | **income_tax_table_entries** | (rate_id =, dependents_count =, int8range(wage_base_from, coalesce(wage_base_to, 9223372036854775807)) &&) | system.statutory_rate_overlap/409 |

- **기간 겹침은 UNIQUE로 표현되지 않는다.** 같은 직원의 근로조건이 두 기간에 걸쳐 겹치면 "어느 시점의 조건인가"에 답이 둘이 되고, 계산이 비결정적이 된다.
- statutory_rates의 EXCLUDE가 가장 파급이 크다 — 겹치면 기준값 조회가 2행을 반환해 급여 계산 전체가 비결정적이 된다.
- **#10은 기간이 아니라 금액 구간의 겹침을 막는 유일한 자리다.** UNIQUE(rate_id, dependents_count, wage_base_from)은 같은 시작점만 막으므로 [1,000,000, 2,000,000)과 [1,500,000, 3,000,000)이 공존해도 통과하고, 그 상태에서 조회가 2행을 반환하면 **소득세가 비결정적**이 된다 — 부모 기간 겹침을 막으면서 자식 금액 구간을 열어 두면 방어가 한 층 빈다.
- **여덟은 daterange, 하나(attendance_breaks)는 tstzrange, 하나(income_tax_table_entries)는 int8range다** — 휴게만 시각 단위이고 세액표만 금액 단위이기 때문이다.
- 스케줄 겹침(#8)은 지각·조퇴 판정의 결정성을 지킨다 — 같은 요일에 두 편성이 유효하면 "그날의 소정근로 시작 시각"에 답이 둘이 된다.

---

## 인덱스 설계 원칙

전수는 각 도메인 파일의 인덱스 절이 담는다. 본 절은 반복되는 패턴만 고정한다.

| 패턴 | 용도 | 예 |
|------|------|-----|
| (workplace_id, …) 선두 | 테넌트 스코프 조회. RLS 1차 술어와 정렬이 일치한다 | (workplace_id, work_date, employee_id) |
| **부분 (user_id, … DESC) WHERE user_id IS NOT NULL** | STAFF 본인 조회. 비정규화 user_id가 조인을 없앤다 | payslips · payroll_employee_results · attendance_records |
| 부분 (…) WHERE 상태 | 배치 대상 좁히기. 인덱스 크기가 처리 대상에 비례한다 | (expires_at) WHERE status = 'PENDING' |
| (…, effective_from DESC) | effective-dated 이력의 최신 조회 | statutory_rates · employment_terms · payroll_terms |
| (retention_until) WHERE NOT NULL | 파기 배치 대상 조회 | contracts · documents · payslips |
| EXCLUDE 부수 gist | 기간 겹침 제약이 자동 생성한다 | 위 6종 |

- **date 컬럼은 범위 술어로 직접 비교한다.** 조회 시 컬럼에 AT TIME ZONE·캐스팅을 씌우면 인덱스를 못 타고 세션 시간대 의존 STABLE 표현식이 된다. timestamptz 범위 조회는 서버가 KST 경계를 UTC instant로 변환해 바인드 파라미터로 넘긴다.

---

## FK ON DELETE 정책 전수

**기본값은 RESTRICT/NO ACTION이다.** 업무·법정 보존행은 지워지지 않으며, 앱 롤에 DELETE 권한 자체를 주지 않는다. 폐쇄·퇴사·탈퇴는 status 전이 + retention_until로 처리한다.

### CASCADE 2개 — 휘발성 한정

| FK | 근거 |
|----|------|
| password_reset_tokens.user_id → users.id | 휘발성 토큰. 법정 보존·감사 대상이 아니고 재생성 가능하다 |
| employee_count_snapshot_days.snapshot_id → workplace_employee_count_snapshots.id | 부모 스냅샷과 생명주기가 완전히 같은 파생 시계열. 독립 보존 가치가 없다 |

- **CASCADE는 이 둘뿐이다.** 다른 어떤 참조에도 쓰지 않는다 — 한 행 삭제가 업무 원장을 연쇄로 지우는 경로를 만들지 않는다.

### SET NULL 48개 — 행위자·약한 참조

**행위자 계열** — 계정이 사라져도 그 행위의 기록은 남아야 한다.

| 도메인 | 컬럼 | 수 |
|--------|------|:--:|
| auth | terms_documents.created_by · account_status_events.actor_id | 2 |
| workplace | workplaces.created_by · workplaces.closed_by · workplace_members.invited_by · workplace_invitations.invited_by · workplace_change_logs.changed_by · membership_role_events.changed_by · business_verification_logs.requested_by · **workplace_employee_count_snapshots.confirmed_by** | 8 |
| leave(신설분) | **employee_protected_periods.created_by** | 1 |
| hr | employee_personal_infos.updated_by · employment_terms.created_by · employee_insurance_histories.changed_by · contracts.created_by · documents.uploaded_by | 5 |
| attendance | **attendance_records.reviewed_by** · attendance_change_requests.requested_by · attendance_change_requests.reviewed_by · attendance_period_closings.closed_by · attendance_period_closings.reopened_by | 5 |
| leave | leave_requests.reviewed_by · leave_transactions.created_by | 2 |
| payroll | payroll_terms.created_by · payroll_runs.confirmed_by · payroll_runs.created_by · payroll_runs.min_wage_override_by | 4 |
| payslip | batch_jobs.created_by | 1 |
| compliance | compliance_tasks.completed_by · severance_assessments.assessed_by | 2 |
| subscription | subscriptions.adjusted_by | 1 |
| system | system_admins.granted_by · audit_logs.actor_id · statutory_rates.confirmed_by | 3 |
| infra | import_jobs.created_by · import_jobs.committed_by · export_jobs.requested_by | 3 |

행위자 소계: 2 + 8 + 1 + 5 + 5 + 2 + 4 + 1 + 2 + 1 + 3 + 3 = **37**.

**약한 참조 계열** — 증빙·원본 레코드·배치 작업처럼 연결만 끊겨도 본체가 유효한 참조다.

| 컬럼 | 존속시키는 것 |
|------|--------------|
| employees.user_id | 인사 레코드(계정 연계 전·후 모두 유효) |
| business_verification_logs.workplace_id | **검증 사실**(등록 전 검증은 애초에 NULL) |
| audit_logs.workplace_id | **감사 사실**(사업장 삭제로 은폐 불가) |
| attendance_change_requests.attendance_record_id | 수정 요청 이력 |
| attendance_change_requests.evidence_document_id | 요청 이력(증빙만 끊긴다) |
| leave_requests.evidence_document_id | 휴가 신청 |
| **employee_protected_periods.evidence_document_id** | 보호 기간 판정(증빙만 끊긴다) |
| payslips.batch_job_id | 명세서(작업 메타가 정리돼도 남는다) |
| compliance_tasks.document_id | 기한 작업(산출물만 끊긴다) |
| import_jobs.document_id | 임포트 작업 이력 |
| export_jobs.document_id | 내보내기 작업 이력 |

약한 참조 소계: **11**.

검산: 37 + 11 = **48**.

- **나머지 FK는 전부 RESTRICT다.** 세는 기준은 "각 도메인 파일 관계 표의 ON DELETE 열"이며, CASCADE 2 · SET NULL **48**을 제외한 전부가 RESTRICT다.

### 복합 FK 5개 — 테넌트 오염 차단

| FK | 대상 키 | 막는 것 |
|----|--------|--------|
| contract_signatures (contract_id, workplace_id) → contracts (id, workplace_id) | contracts UQ(id, workplace_id) | A 사업장의 서명 행이 B 사업장의 계약을 가리키는 것 |
| **contracts (template_id, workplace_id) → contract_templates (id, workplace_id)** | contract_templates UQ | A 사업장의 계약이 B 사업장의 템플릿을 참조하는 것 |
| **contracts (document_id, workplace_id) → documents (id, workplace_id)** | documents UQ | A 사업장의 계약이 B 사업장의 문서를 PDF 실체로 참조하는 것 |
| **leave_requests (leave_type_id, workplace_id) → leave_types (id, workplace_id)** | leave_types UQ | A 사업장 신청이 B 사업장 휴가 유형을 가리키는 것 |
| **attendance_daily_summaries (leave_request_id, workplace_id) → leave_requests (id, workplace_id)** | leave_requests UQ | 교차 사업장 ON_LEAVE 판정 근거 |

- 단일 컬럼 FK였다면 workplace_id를 임의로 채워도 참조가 성립한다. workplace_id를 FK에 끼워 넣으면 그 조합이 존재하지 않아 거부된다.
- **ON DELETE SET NULL인 참조는 복합 FK로 전환하지 않는다** — attendance_change_requests.attendance_record_id가 그 예다. NULL 전이 시 workplace_id(NOT NULL)까지 함께 NULL이 되어야 해서 성립하지 않으며, 그 자리는 트리거가 맡는다.
- 같은 목적을 트리거로 푸는 지점이 하나 더 있다 — guard_employee_workplace_match()가 employee_id의 workplace_id 불일치를 차단한다([09_functions_triggers.md](./09_functions_triggers.md)).

---

## 법정 보존 기산일

| 대상 | 보존 | 기산일 | 물리 컬럼 |
|------|:----:|-------|----------|
| 근로계약서 | 3년 | **근로관계 종료일** | contracts.retention_until — **재직 중 NULL(파기 금지)**. ARCHIVED 전이 시 확정하고 guard_contract_retention()이 재직 중 만료를 DB에서 차단한다 |
| 임금대장 | 3년 | 마지막 기입일(= pay_date) | payroll_runs.retention_until |
| 근로자명부 | 3년 | 퇴직일 | employees.retention_until |
| 임금명세서 | 3년 | **지급일** | payslips.retention_until (NOT NULL) — **발행 시 documents.retention_until과 일치 검증**. 두 값은 정본·사본이 아니라 같은 산식의 각자 파생이며 **대조 관계**다 |
| 근태 원본·일 집계·마감 | 3년 | 마지막 기입일(= 귀속 급여월의 pay_date) | attendance_records · attendance_daily_summaries · attendance_period_closings의 retention_until — LAST_ENTRY_PLUS_3Y |
| 연차 발생·원장 | 3년 | 퇴직일 | leave_grants · leave_transactions의 retention_until — RESIGNATION_PLUS_3Y |
| 위치정보 **확인자료** | 법정 보존기간 | 이용·제공일 | location_usage_records.retention_until (NOT NULL) |
| 위치정보 **원좌표** | **목적 달성 즉시 파기** | — | attendance_records.coords_purged_at |

- 파기 배치는 **retention_until IS NOT NULL AND retention_until < 기준일**만 대상으로 한다.
- **기산일 없이 파기 배치를 돌리는 것 자체가 위반**이므로 NULL은 절대 파기하지 않는다. retention_basis가 기산 근거 코드를 남긴다 — EMPLOYMENT_END_PLUS_3Y · LAST_ENTRY_PLUS_3Y · RESIGNATION_PLUS_3Y · PAY_DATE_PLUS_3Y · LOCATION_ACT_ART16.

---

## 동시성 잠금

**멱등성은 같은 요청의 중복만 막고 서로 다른 요청의 경합은 막지 못한다.** 두 축을 분리해 배치한다.

| 지점 | 잠금 | 백스톱 |
|------|------|-------|
| **급여 확정** | pg_advisory_xact_lock('payroll:'\|\|wid\|\|':'\|\|pay_period) + 대상 마감 행 FOR SHARE | 부분 UQ 3종(원본 · 정정본 · 멱등키) |
| **급여 확정 중 입력 변경** | 해당 기간 근태·인사·휴가 수정 차단(REQ-GLB-15 ②) | **근태 3테이블은 guard_locked_period(), 인사·휴가는 guard_payroll_locked_period()** — 한 함수가 세 축을 모두 맡는다고 적으면 부착되지 않은 축이 생긴다 |
| **근태 마감** | pg_advisory_xact_lock('att_close:'\|\|wid\|\|':'\|\|pay_period) — **체크인·휴게·수정 요청 제출 경로도 같은 키를 획득한다** | 부분 UQ (workplace_id, pay_period) WHERE status <> 'CANCELLED' · guard_locked_period() |
| **근태 수정 요청 승인** | 요청 행 + 대상 일집계 행 FOR UPDATE | 부분 UQ PENDING 1건 · guard_self_approval() |
| **PENDING 체크인 승인·반려** | 대상 attendance_records 행 + 대상 일집계 행 FOR UPDATE — 승인은 일 집계 재판정, 반려는 집계 제외라 둘 다 일집계를 건드린다 | guard_attendance_status_transition() · guard_self_approval() · guard_locked_period() |
| **초대 수락** | pg_advisory_xact_lock('wp:'\|\|wid) → active_member_count 재검증 | UQ (workplace_id, user_id) + guard_member_cap() |
| **사업장 등록** | 등록자 users 행 FOR UPDATE(사용자 단위 직렬화) | **guard_workplace_cap()** |
| **연차 차감** | leave_balances 행 FOR UPDATE | balance_days >= 0 CHECK + 예약 차감 |
| **휴가 신청·승인** | leave_balances 행 FOR UPDATE + 마감 기간 판정 | check_leave_reservation_balance() · guard_locked_period() |
| **PII blind index 재색인** | pg_advisory_xact_lock('pii_reindex') — 재색인 트랜잭션과 employee_personal_infos 등록·수정 경로가 같은 키를 획득해 직렬화한다 | 부분 UQ (workplace_id, resident_no_blind_index) |
| **정기작업 실행** | 작업명 분산락(작업당 1개 · 인스턴스가 하나여도 생략하지 않는다) | scheduled_job_runs 부분 UQ (job_name, base_date) WHERE status IN ('RUNNING','SUCCEEDED') |
| **명세서 일괄 발행** | batch_jobs RUNNING 부분 UQ | payslips 원본 부분 UQ |
| **역할 변경·OWNER 불변식** | 멤버십 행 FOR UPDATE | 부분 UQ(2명 차단) + DEFERRABLE guard_owner_singleton()(0명 차단) |

검산: 급여 축 2 + 근태 축 3 + 멤버 축 3 + 휴가 축 2 + 명세서 축 1 + PII 축 1 + 배치 축 1 = **13지점**.

- **키 버전을 유일성 축에 넣지 않는 것이 PII 재색인 설계의 요점이다** — 넣으면 같은 주민번호의 버전 간 공존을 제약이 허용해 중복 검출이 정의상 무너진다. 혼재 상태를 만들지 않는 것(전면 전환 + 직렬화)이 해법이다.

---

## append-only 테이블 12종

UPDATE·DELETE를 차단한다. **강제 함수는 둘로 갈린다** — 10종은 prevent_mutation()이 무조건 막고, 2종은 조건부 변형 가드가 좁은 예외만 연다.

user_consents(**guard_consent_mutation** — kind = LOCATION의 revoked_at 1회 전이만) · account_status_events · security_events · workplace_change_logs · membership_role_events · business_verification_logs · employee_insurance_histories · leave_transactions · payslip_deliveries · audit_logs · **location_usage_records** · payroll_employee_result_items(**guard_confirmed_result_item** — 확정분만 차단, 미확정 실행의 라인은 재계산이 DELETE + INSERT로 교체한다)

검산: auth 3 + workplace 3 + hr 1 + leave 1 + payroll 1 + payslip 1 + system 1 + privacy 1 = **12**. 함수별로는 **prevent_mutation() 부착 10 + 변형 가드 2**다.

- **부착 수를 셀 때 함수 이름으로 필터하면 10이 나온다.** 12는 append-only 테이블 수이고 10은 prevent_mutation 트리거 수다 — 두 수를 같은 것으로 두면 배포 검수가 매번 어긋난다([10_migrations_seed.md](./10_migrations_seed.md) 검수 표).

---

## 제약으로 표현할 수 없는 것 (한계 등재)

DB 제약·트리거로 강제하지 않고 서비스 레이어가 책임지는 항목이다. **어느 층도 맡지 않는 것을 남기지 않기 위해 여기 등재한다.**

| 항목 | 강제 위치 | 근거 |
|------|----------|------|
| 사업자등록번호 체크섬 | 서비스 | 정규식은 CHECK가 막지만 체크섬 알고리즘은 SQL로 표현하기 부적절하다 |
| 국세청 진위 확인 결과의 등록 허용 여부 | 서비스 | 외부 API 응답에 따른 분기이며 DB가 알 수 없다 |
| 8버킷 분해의 **정확성**(각 분이 올바른 버킷에 갔는가) | 서비스(계산 엔진) | CHECK는 합만 검증한다. 야간·휴일 경계 판정은 규칙 엔진의 책임이다 |
| 최저임금 미달 판정 | 서비스 + payroll_validation_results | 기준값 조회와 산입 범위 판정이 필요하다 |
| 통상임금 산입 범위 | 서비스 + ORDINARY_WAGE_RULE 기준값 | 법령 해석이 기준값 행에 담긴다 |
| 보험별 가입 판정(초단시간·연령·계속근로) | 서비스 + employee_insurance_infos.eligibility_detail | 판정 입력이 여러 테이블에 걸친다 |
| 간이세액표 구간 조회 | 서비스 | 자녀 수 추가공제가 구간 축이 아니라 차감 축이다 |
| 수습 감액 3요건 판정 | 서비스 + probation_check | ③ 단순노무 여부는 직업분류 코드 해석이다 |
| PII 복호화 4요건 | 서비스 + audit_logs 트리거 | 재인증·1회성 응답은 DB 밖의 상태다 |
| 파일 다운로드 인가 | S3 정책 + 서비스 + 1회용 토큰 | **RLS는 메타 행 가시성만 담당한다** |
| **비근로자(worker_type) 제외 4축** — 상시근로자 산정 · 법정수당 · 연차 · 4대보험 | 서비스(스냅샷 생성 트랜잭션 · 계산 엔진 · 연차 발생 트랜잭션) | worker_type 필터가 집계·계산 로직 안에 있다. REQ-HRM-28이 네 축 제외를 요구하는데 한 축만 등재하면 나머지 셋의 필터가 코드에만 존재한다 |
| **weekly_holiday_dow와 work_days의 겹침 금지** | 서비스 | work_days가 text[] 요일 코드이고 본 컬럼이 smallint라 CHECK 대조에 두 표기를 잇는 IMMUTABLE 매핑 함수가 필요하다. 겹침 판정 규칙의 정본도 요구사항에 있다. **각 컬럼 자체의 값 범위는 CHECK가 강제하며**(work_days 값 집합·최소 1요일·중복 금지 · weekly_holiday_dow 0~6) 강제하지 않는 것은 **두 컬럼 사이의 관계**뿐이다([03_hr.md](./03_hr.md)) |
| 사업 단위 통합 여부 | **선언(business_units.is_integrated)** | 자동 합산은 법적 판단이라 DB가 강제할 수 없다. 미판정 위험은 서버 경고다 |
| 급여대장 출력의 5인 미만 항목 생략 | 출력 계층 | applies_five 분기이며 저장 구조와 무관하다 |
| 알림 생성 실패의 비롤백 | 서비스(별도 트랜잭션) | 트랜잭션 경계 설계라 제약으로 표현되지 않는다 |
| 멤버 제외 선행조건 3종과 필수 인원 미달 | 서비스 | 급여 확정 진행 중 · 미처리 승인의 필수 승인자 · 인원 미달은 여러 테이블에 걸친 판정이라 상태 전이 가드의 범위를 넘는다(REQ-WRK-27) |
| 임포트 확정 시 인원 한도 재검증 | 서비스(확정 트랜잭션) | 임포트가 만드는 것은 employees이고 guard_member_cap()은 workplace_members에만 부착된다 — 판정 축이 어긋나 백스톱이 발동하지 않는다(REQ-WRK-35) |
| 임포트 적재분의 명세서 자동 생성 제외 | 서비스(명세서 생성 트리거 조건) | 합계 검증 면제는 트리거가 맡지만 제외 규칙은 서버 판정이다. 강제되지 않으면 계산 근거 없는 명세서가 법정 교부물로 나간다(REQ-WRK-34) |
| 변경 이력·역할 이력의 **기록 자체** | 서비스 | 이력 테이블의 INSERT 정책은 서버 축만 열 뿐, 본체만 바꾸고 이력을 남기지 않는 경로를 막지 못한다(REQ-WRK-11 · REQ-WRK-23) |
| username 예약어 금지 | 서비스 | 예약어 목록이 운영 정책값이라 CHECK에 박지 않는다(REQ-AUT-06) |
| 가입 필수 2종 동의의 완결성 | 서비스(가입 트랜잭션) | 행 2건의 동시 존재는 제약으로 표현되지 않는다(REQ-SYS-15 · D-19) |
| 미인증 요금제 응답의 필드·행 한정 | 서버 API | RLS는 컬럼을 좁히지 못하고 정책 술어도 행 전체를 연다(REQ-SUB-01) |
| 알림 본문·payload의 민감정보 금지와 priority 복사 정합 | 서비스 | 값의 의미 판정이다(REQ-NTF-03) |
| 기준값 미확인 행의 계산 차단 | 서비스(계산 엔진) | confirmed_by·confirmed_at을 NOT NULL로 두면 확인 전 등록 자체가 막혀 등록·확인 2단 절차가 성립하지 않는다(REQ-GLB-09) |
| 원좌표 파기의 실행 여부 | 마감 트랜잭션 + 운영 점검 | CHECK는 파기 표시 행의 완결성만 본다 — 파기를 실행하지 않은 상태는 표현되지 않는다(REQ-PRV-04) |
| 입사 확정의 hire_date 일치 판정 | 서비스 | 부분 UQ는 ACTIVE 중복 행만 막고 기존 직원의 hire_date와의 일치를 보지 않는다(hr.hire_date_conflict) |
| 퇴사 선행조건 중 진행 중 급여 확정·미처리 승인 | 서비스 | 전자는 advisory lock으로 표현되는 트랜잭션 경계 판정, 후자는 세 테이블 PENDING 집합 판정이다. **OWNER 보유 축은 상태 전이 가드로 이관했다** |
| 근로조건·급여 기준 등록 시점의 최저임금 사전 차단과 base_wage 정합 | 서비스 | 두 테이블의 유효기간 분할 경계가 독립이라 특정 시점 대조에 기간 교집합 계산이 필요하다. 계산 결과의 사후 검증(payroll.below_minimum_wage)과 판정 입력이 다르다 |
| 민감정보 부분 저장의 키 버전 메타 보존과 blind index 재색인의 전면 전환 | 서비스 + advisory lock | 누락 필드를 NULL로 덮지 않는 것은 컬럼 단위 규율이라 제약으로 표현되지 않는다 |
| 자정 경과 근무의 총 분 합 일치 | 서비스(롤업 엔진) + 재계산 전후 대조 | CHECK는 하루 안의 8버킷 합만 검증하므로 레코드 총 분과 분할된 일자별 합의 일치는 표현되지 않는다(REQ-ATT-05) |
| 연차 미사용 일수의 정산 이력 대조 | 서비스 + 급여 항목 라인의 정산 축 | EXPIRE 행 집합과 확정 급여 정산 이력의 대조는 두 도메인에 걸쳐 있어 단일 제약으로 표현되지 않는다(REQ-LEV-12) |
| 비과세 항목 사업장 한도의 공식 한도 초과 금지 | 서비스 + NONTAX_LIMIT 기준값 | 공식 한도가 기준일 조회 결과라 CHECK가 참조할 수 없다 |
| 계산 입력 스냅샷의 필수 키 충족 | 서비스(계산 엔진) | jsonb 구조 검증은 CHECK로 표현하기 부적절하다. 누락은 REFERENCE_VALUE 검증이 잡는다 |
| 같은 사업 단위·같은 기준일 합산 스냅샷의 행 간 판정 일치 | 서비스(스냅샷 생성 트랜잭션) | 합산은 하나의 사실인데 사업장 수만큼 행이 생기므로 행마다 applies_five가 갈릴 수 있다. 사업 단위 전체를 한 트랜잭션에서 계산해 동일 값을 기록하는 것으로 막는다(REQ-CMP-08) |
| **정산 대상 원장 행 배열(settled_leave_txn_ids)의 참조 무결성** | 서비스 + append-only 보증 | uuid 배열에는 FK를 걸 수 없다. 참조 대상인 leave_transactions가 append-only이고 앱 롤에 DELETE grant가 없어 **참조가 끊기는 경로 자체가 없는 것**이 사실상의 보증이며, 배열 원소의 존재 검증은 정산 트랜잭션이 맡는다(REQ-LEV-12) |

| **명세서 보존기한과 문서 보존기한의 대조** | 서비스(명세서 생성 트랜잭션 · payslip.generation_failed/422) | **대조 대상이 다른 테이블(documents)의 열**이라 트리거가 읽으려면 정의자 권한을 그 테이블까지 넓혀야 하고, **그 권한 확장이 이 검사 하나의 값보다 비싸다.** guard_payslip_transition()은 GENERATED 전이에서 document_id의 존재만 본다(REQ-SLP-04) |

| **고정수당·비과세 항목 코드의 카탈로그 정합**(payroll_terms.fixed_allowances · nontax_items의 code ↔ pay_items.code) | **서비스(급여 기준 생성·수정) 단독 — DB 백스톱이 없다** | jsonb 배열 원소에는 FK를 걸 수 없고, 위 정산 원장 배열과 달리 **참조가 끊기는 경로가 없다는 사실상의 보증도 없다** — pay_items는 사업장이 정의하는 카탈로그라 코드가 개명·비활성화될 수 있다. **서비스가 쓰기 시점에 활성 카탈로그 실재와 비과세 코드 일치를 대조**한다([../06_api/08_payroll.md](../06_api/08_payroll.md) #5 · #6). **막는 것은 "들어올 때 다른 코드"까지이고 "들어온 뒤 바뀌는 코드"는 막지 못한다** — 그 잔여는 결과 라인의 동결 축 미결이 담는다([06_payroll.md](./06_payroll.md) 결과 라인 절) |

검산: 원 15항 + 신설 **22**항 = **37항**.

- **RLS가 파일 접근을 통제하지 않는다는 점이 가장 오해하기 쉬운 한계다.** documents 행이 보인다는 것과 파일을 받을 수 있다는 것은 다르며, 후자는 서비스 인가 + 1회용 다운로드 토큰 + 서버 스트리밍이 담당한다.

---

## 관련 문서

- 폴더 정본·타입 매핑·단위 규약 → [README.md](./README.md)
- 전역 ERD·관계 요약 → [erd.md](./erd.md)
- RLS 정책 전수 → [08_rls_policies.md](./08_rls_policies.md)
- 함수·트리거 전수 → [09_functions_triggers.md](./09_functions_triggers.md)
- 마이그레이션 배치·확장 설치 → [10_migrations_seed.md](./10_migrations_seed.md)
- enum·상태 머신 정본 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
- 전역 규칙(반올림·기준값·동결) → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
