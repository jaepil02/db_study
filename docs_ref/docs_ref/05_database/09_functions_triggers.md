# 09_functions_triggers — 함수·트리거

> **대상**: insadesk — DB 함수 **105종**(헬퍼·서비스 44 + 트리거 함수 61) · 공통 트리거 6 · 가드 트리거 55 · set_updated_at 부착 **43** · prevent_mutation 부착 **10**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — 사유 필수 **16 → 17항목 · 27 → 28코드** 인용 갱신(**V0740** — **⑰ 민감 목록 내보내기 · list.export_sensitive**. 정본 [15_system.md](./15_system.md)). guard_audit_reason_required()의 **판정 배열만 넓힌 본문 교체**라 함수 수 · 공통 트리거 · 가드 · 부착 수는 움직이지 않는다
> **개정일**: 2026-09-10 — 인용 갱신 — 명세서 대체 교부 경로의 수신 주소 헬퍼 **workplace_member_email** 신설(V0735) — 헬퍼·서비스 43 → **44** · 계 104 → **105** · 실측 pg_proc 105 → **106**(내부 술어 1종 포함). **공통 트리거 6 · 가드 55 · 부착 수는 전건 불변**이다. 시그니처 정본 [08_rls_policies.md](./08_rls_policies.md) 헬퍼 #45
> **개정일**: 2026-09-10 — 가드 문단에서 **에러 코드 종수를 걷는다** — "등재 119종 안에서 고른다"가 **채번 때마다 틀리는 형태**였고 실제로 workplace.mgmt_no_required 채번(119 → **120종**)으로 틀렸다. 종수의 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)다. **함수 104 · 트리거 61 · 가드 55는 전건 불변**
> **개정일**: 2026-09-10 — 인용 갱신 — 보조 비밀번호 재설정의 서버 함수 **issue_assisted_password_reset** 신설 — 헬퍼·서비스 42 → **43** · 계 103 → **104** · 실측 pg_proc 104 → **105**(내부 술어 1종 포함). **공통 트리거 6 · 가드 55 · 부착 수는 전건 불변**이다. 시그니처 정본 [08_rls_policies.md](./08_rls_policies.md) 헬퍼 #44
> **개정일**: 2026-09-09 — **V0726** 반영 — 헬퍼·서비스 39 → **42**(시스템 콘솔 서버 함수 3종 — 정본 [08_rls_policies.md](./08_rls_policies.md) #41~#43) · 계 100 → **103** · 실측 pg_proc 101 → **104**. 가드 둘의 예외 축을 등재했다 — **강제 삭제**는 행위자의 user:delete 플랫폼 권한을 가드가 직접 평가하고(**GUC를 늘리지 않는다** — 주입 계약 5종은 불변), **강제 폐쇄**는 close_path = PLATFORM_FORCED 일 때 retention_acknowledged_at 요구를 걷고 **열을 NULL로 둔다**(서버가 대신 채우면 "확인했다"는 뜻의 열에 사실이 아닌 값이 남는다). **공통 트리거 6 · 가드 55 · 부착 수 · 설계 확정 24는 전건 불변**이다 — 둘 다 본문 교체다
> **개정일**: 2026-09-08 — **V0724** 반영 — guard_request_status_transition()의 review_note 요구를 **테이블별로 나눴다**(attendance_change_requests 승인·반려 양쪽 · leave_requests 반려에만). **V0721이 완화를 공유 가드 전체에 적용한 것이 결함**이었고 CHECK가 정본으로 판정됐다. **공유 부착 가드는 부착된 모든 테이블의 정본을 확인한 뒤에 고친다**(함수가 하나라는 사실이 규칙이 하나라는 뜻은 아니다)와 **판정 3층이 서로를 잡되 갈린 것을 자동으로 드러내는 자리는 없다**를 함께 등재했다. **함수 본문 교체라 함수 수 · 가드 수 · 부착 수는 불변**
> **개정일**: 2026-09-08 — **V0721** 반영 — guard_request_status_transition()이 **review_note를 반려에만** 요구하도록 좁혔다(승인에도 요구하던 것을 완화 · reviewed_by · reviewed_at은 양쪽 필수 그대로). **함수 본문 교체라 함수 수 · 가드 수 · 부착 수는 불변**이다. **부착 두 테이블의 실질 요구가 갈린다는 것을 함께 등재했다** — attendance_change_requests의 CHECK 제약이 승인에도 review_note를 계속 요구하므로 그 테이블에서는 완화가 표면에 닿지 않는다(2026-09-08 실측 · 미결)
> **개정일**: 2026-09-07 — 사유 필수 **15 → 16항목 · 26 → 27코드** 인용 갱신(V0719 — **⑯ 계정 구독 수동 조정 · subscription.adjust**. 정본 [15_system.md](./15_system.md)). **신설이 아니라 누락 보정이다** — REQ-SYS-09와 RBAC 위험 행위 통제 표가 사유 필수를 이미 요구하는데 **열거만 그것을 담지 못하고 있었다.** "15항목이 늘었다"가 아니라 **"15항목이 처음부터 하나 모자랐다"**로 읽는다
> **개정일**: 2026-09-07 — **V0716** 반영 — 헬퍼·서비스 38 → **39**(전자서명 서버 함수 sign_contract 신설 · 정본 [08_rls_policies.md](./08_rls_policies.md) #40) · 계 99 → **100** · 실측 pg_proc 100 → **101**. **공통 트리거 6 · 가드 55 · 부착 수 · GUC 5종은 전건 불변**이다 — 인가는 기존 guard_contract_signature_insert()가 그대로 맡고 새 함수는 원자성만 얹는다
> **개정일**: 2026-09-07 — **V0711 · V0712** 반영 — ① **guard_workplace_readonly() 본문 교체**(V0712) — 예외 ②·③의 판정이 NEW의 열을 직접 참조해 **그 열이 없는 테이블에서 CLOSED 사업장의 모든 쓰기가 SQL 오류로 끝났다.** 참조 축을 함수 안에 이미 있던 v_new(to_jsonb(NEW))로 옮겼다. ② **guard_audit_reason_required() 판정 배열 확장**(V0712) — ⑦이 강제 폐쇄에서 **사업장 폐쇄**로 넓어져 workplace.close를 흡수해 대상 코드 25 → **26**이다(**사유 필수 항목 15는 불변**). ③ V0711의 idempotency_records는 updated_at 컬럼을 두지 않아 **set_updated_at 미보유 17 → 18**이며 부착 **43은 불변**이다(43 + 18 = **61**). **함수 수 99 · 공통 트리거 6 · 가드 55 · prevent_mutation 부착 10은 전건 불변** — 둘 다 신설이 아니라 본문 교체다
> **개정일**: 2026-09-07 — 보정 **V0710** 반영 — 헬퍼·서비스 37 → **38**(사업장 폐쇄 서버 함수 close_workplace 신설 · 정본 [08_rls_policies.md](./08_rls_policies.md) #39) · 계 98 → **99** · 실측 pg_proc 99 → **100**. 공통 트리거 6 · 가드 55 · 부착 수는 전건 불변
> **개정일**: 2026-09-07 — 인증 쓰기 축 서버 함수 신설(보정 **V0709**) 반영 — 헬퍼·서비스 32 → **37** · 계 93 → **98**(신설 6 create_user_credentials · update_user_password · consume_password_reset · issue_password_reset · mark_user_deleted · expired_suspension_user_ids, 폐기 1 request_password_reset. 검산 32 + 6 − 1 = **37**) · 실측 pg_proc 94 → **99**(내부 술어 1종 포함). 공통 트리거 6 · 가드 55 · 부착 수는 전건 불변. 시그니처 정본 [08_rls_policies.md](./08_rls_policies.md)
> **개정일**: 2026-09-06 — 실측 정합(로컬 PostgreSQL 18에 db_migration V0001~V0707 전량 적용 후 카탈로그 대조) — 함수 구성 표의 잔재 정정 헬퍼·서비스 27 → **32** · 계 88 → **93**(표가 V0702 반영에서 멈춰 같은 문서 안에서 검산식과 어긋나 있었다) · 검산 92 → **93** · 헬퍼 인용 31 → **32종**(보정 V0704·V0706의 append_audit_log 등재 — 정본 08_rls_policies.md #32) · 가드 에러 코드 전제 118 → **119종**(채번 정본 ../09_glossary/02_error_codes.md 2026-08-21 신설분) · **가드 내부 술어 is_sync_user_id_update 각주 신설**(함수 계수 밖 — 실측 pg_proc 94 = 정본 93 + 술어 1). 공통 트리거 6 · 가드 55 · 부착 수는 전건 불변
> **개정일**: 2026-08-20 — 인증 서버 함수 4종 신설(보정 V0702) — 헬퍼·서비스 27 → **31** · 함수 88 → **92**(시그니처 정본은 08_rls_policies.md #28~31)
> **개정일**: 2026-08-09 — 전역 수치 정합 — 가드 에러 코드 전제를 등재 117 → **118종** 기준으로 재서술하고 금지 원칙을 **가드에서의 임의 신설 금지**로 정밀화(채번은 09_glossary/02 정본에서만)
> **개정일**: 2026-08-08 — DB 커버리지 감사 통합 반영 — 가드 38 → **55**(신설 17) · 공통 트리거 4 → **6** · 헬퍼 22 → **27** · 함수 64 → **88** · DEFERRABLE 3 → **6** · 확정 불변 11 → **13지점** · set_updated_at 40 → **43** · prevent_mutation 부착 표기 12 → **10**(변형 가드 2 분리)
> **개정일**: 2026-08-08 — guard_role_change의 에러를 workplace.role_change_forbidden/403 **단일**로 정정(auth.workplace_forbidden/403 병기 제거 — 정본 09_glossary/02_error_codes.md)
> **개정일**: 2026-08-08 — guard_role_change에 역할 변경 주체 제한(OWNER 전용) 추가 · guard_self_approval 판정 축 명시(대상 직원 본인만 차단) · guard_owner_singleton의 CLOSED 제외 조건 · guard_workplace_readonly 예외 2 → **3** · 사유 필수 액션 13 → **15종**. 함수 수·가드 수는 불변이다
> **개정일**: 2026-08-03 — 가드 트리거 37 → **38**(guard_attendance_status_transition 신설) · 함수 63 → **64** · 설계 확정 6 → **7종** · guard_self_approval 부착 2 → **3테이블** · 확정 불변 10 → **11지점**
> **원천**: docs_ref2/schema_p0.md — RLS 헬퍼 함수 · 각 테이블 명세의 불변·트리거 절 · 동시성 절 · docs_ref2/requirements_p0.md 상태 머신 9종

DB 계층이 스스로 지키는 규칙의 정본이다. **RLS 정책이 행 가시성을 정하고 트리거가 상태 전이·컬럼 불변·합계 정합을 정한다** — 정책은 컬럼 단위 제한과 상태 전이를 표현하지 못하므로 두 층이 함께 있어야 한다.

전 함수 **SECURITY DEFINER + SET search_path = ''**를 기본으로 한다(트리거 함수 중 OLD·NEW 튜플 비교만 하는 것은 invoker로 둔다). PUBLIC EXECUTE를 회수하고 앱 롤에만 재부여한다.

**원천에 없는 함수를 창작하지 않는다.** 아래 표에서 **설계 확정**으로 표기한 24종은 원천이 요구를 서술했으나 함수명을 부여하지 않은 것이며, 근거 열에 그 서술을 명기한다.

---

## 함수 구성

| 구분 | 종수 | 정본 |
|------|:----:|------|
| RLS 헬퍼·서비스 함수 | **44** | [08_rls_policies.md](./08_rls_policies.md) 헬퍼 절 |
| 공통 트리거 함수 | **6** | 본 문서 |
| 가드·검증 트리거 함수 | **55** | 본 문서 |
| **계** | **105** | — |

검산: 44 + 6 + 55 = **105**. 트리거 함수 소계는 6 + 55 = **61**이다.

- 헬퍼 44종의 시그니처·용도 표는 [08_rls_policies.md](./08_rls_policies.md)가 정본이며 본 문서는 중복 열거하지 않는다.
- **가드 내부 술어 is_sync_user_id_update(old, new) 1종은 위 105에 들어가지 않는다.** 아래 sync 전파 절의 각주가 근거이며, 데이터베이스 카탈로그 실측은 그래서 **106**으로 나온다(105 + 술어 1).
- 가드 55 = 원천 명시 31 + **설계 확정 24**다.
- **설계 확정이 24로 늘어난 것은 원천이 요구를 서술하고 함수명을 부여하지 않은 지점이 그만큼 많았다는 뜻이다.** 각 함수의 근거 열에 그 서술을 명기하며, 근거 없는 함수를 창작하지 않는 원칙은 그대로다.

---

## 공통 트리거 함수 6종

| 함수 | 부착 | 내용 | invoker/definer |
|------|------|------|:---------------:|
| **set_updated_at()** | BEFORE UPDATE · **43테이블** | updated_at = now() | invoker |
| **sync_account_status()** | **AFTER UPDATE OF username, status ON users** | username·status를 profiles에 동기화 | definer |
| **sync_employee_user_id()** | AFTER UPDATE OF user_id ON employees | 비정규화 user_id를 근태·휴가·급여결과·명세서에 전파 | definer |
| **log_insurance_history()** | AFTER INSERT/UPDATE ON employee_insurance_infos | 전후값·적용일·변경자를 employee_insurance_histories에 INSERT | definer |
| **propagate_run_void_to_payslips()** | AFTER UPDATE ON payroll_runs(→ VOIDED) | 산하 PENDING·FAILED 명세서를 FAILED(failure_reason = 'run_voided')로 고정 | definer |
| **prevent_mutation()** | BEFORE UPDATE/DELETE · **10테이블** | 무조건 예외. append-only 강제 | invoker |

- **뒤 둘은 가드가 아니라 기록·전파 트리거다** — 무엇을 막는 것이 아니라 한 테이블의 변화를 다른 테이블에 옮긴다. sync_* 계열과 같은 성격이라 가드 55종이 아니라 이 절에 둔다.
- **log_insurance_history()가 없으면 employee_insurance_histories가 영구 공백이 될 수 있다** — 그 테이블은 append-only인데 기록 주체가 확정되지 않으면 서비스 누락이 곧 이력 부재다.
- **propagate_run_void_to_payslips()가 없으면 무효 급여의 명세서가 재큐잉된다** — 15분 주기 정기작업이 FAILED 명세서를 다시 생성 큐에 넣기 때문이며, failure_reason = 'run_voided'만이 그 재큐잉을 고정 차단한다.
- sync_account_status()의 부착을 INSERT에서 제외한 이유는 **가입 순서가 users INSERT → profiles INSERT**라 INSERT 시점에는 동기화할 profiles 행이 없기 때문이다. 최초 값은 profiles INSERT가 직접 싣는다.

### set_updated_at 부착 43개

updated_at 컬럼 보유 테이블과 정확히 1:1이다.

users · profiles · terms_documents · workplaces · business_units · workplace_members · workplace_invitations · **workplace_employee_count_snapshots** · employees · employee_personal_infos · employment_terms · employee_insurance_infos · contract_templates · contracts · documents · attendance_records · attendance_breaks · attendance_daily_summaries · attendance_change_requests · attendance_period_closings · work_schedules · leave_types · leave_grants · leave_requests · leave_balances · **employee_protected_periods** · pay_items · payroll_terms · payroll_runs · payroll_employee_results · payslips · batch_jobs · compliance_tasks · severance_assessments · notification_types · notifications · plans · subscriptions · system_admins · statutory_rates · import_jobs · export_jobs · **scheduled_job_runs**

도메인별 검산: auth 3 + workplace **5** + hr 7 + attendance 6 + leave **5** + payroll 4 + payslip 2 + compliance 2 + notification 2 + subscription 2 + system 2 + privacy 0 + infra **3** = **43**.

**미보유 18개**(부착 없음): user_consents · account_status_events · security_events · password_reset_tokens · workplace_change_logs · membership_role_events · business_verification_logs · employee_count_snapshot_days · employee_insurance_histories · contract_signatures · leave_transactions · payroll_employee_result_items · payroll_validation_results · payslip_deliveries · audit_logs · income_tax_table_entries · location_usage_records · **idempotency_records**.

43 + 18 = **61**로 전 테이블을 남김없이 분류한다.

- 미보유 18개는 append-only 원장·이벤트·파생 시계열·재적재 대상이 대부분이다 — 수정되지 않으므로 수정 시각이 의미가 없다.
- **idempotency_records만 다른 이유로 미보유다.** append-only가 아니라 상태가 STARTED에서 COMPLETED·DISCARDED로 한 번 움직이는데, 그 시각을 completed_at이 담고 기록의 수명은 created_at 하나로 판정하므로 updated_at을 둘 자리가 없다.
- password_reset_tokens만 예외적으로 used_at 세팅이라는 UPDATE가 있으나 1회용 소비이며 갱신 이력이 무의미하다.

### prevent_mutation 부착 10개

account_status_events · security_events · workplace_change_logs · membership_role_events · business_verification_logs · employee_insurance_histories · leave_transactions · payslip_deliveries · audit_logs · **location_usage_records**

검산: auth 2 + workplace 3 + hr 1 + leave 1 + payslip 1 + system 1 + privacy 1 = **10**.

**append-only 테이블은 12종이고 그중 10종에 prevent_mutation()이 붙는다.** 나머지 2종은 좁은 예외를 열어야 해서 변형 가드가 대신한다.

| 테이블 | 강제 함수 | 여는 예외 |
|--------|----------|----------|
| user_consents | **guard_consent_mutation()** | kind = 'LOCATION'인 행의 revoked_at NULL → 값 1회 전이 |
| payroll_employee_result_items | **guard_confirmed_result_item()** | 미확정 실행(DRAFT·CALCULATED)의 라인 DELETE — 재계산 교체 |

- **두 수를 같은 것으로 두면 배포 검수가 매번 어긋난다** — 트리거 이름으로 세면 10이고 append-only 테이블로 세면 12다([10_migrations_seed.md](./10_migrations_seed.md) 검수 표).
- **필수 2종(TERMS·PRIVACY) 동의는 철회 경로가 없다** — 철회하면 서비스 이용 근거 자체가 사라지므로 탈퇴가 그 자리를 대신한다. 위치정보만 선택 동의라 철회가 열린다.

### sync_employee_user_id 전파 대상

employees.user_id가 나중에 연결되거나 바뀔 때 비정규화 컬럼을 갱신한다.

| 대상 | 컬럼 |
|------|------|
| attendance_records · attendance_breaks · attendance_daily_summaries · attendance_change_requests | user_id |
| leave_grants · leave_requests · leave_transactions · leave_balances | user_id |
| payroll_employee_results · payroll_employee_result_items | user_id |
| payslips · payslip_deliveries | user_id |
| documents | user_id |

검산: 근태 4 + 휴가 4 + 급여 2 + 명세서 2 + 문서 1 = **13컬럼**.

- **payroll_employee_results·items는 확정 후에도 이 컬럼만 갱신이 허용된다** — guard_confirmed_result()가 user_id·updated_at을 예외로 둔다. 계정 연결이 늦어 본인 열람 경로가 영영 닫히는 것을 막기 위해서다.
- FK가 아닌 이유는 계정 삭제 시 CASCADE·SET NULL이 업무 원장을 건드리기 때문이다.
- **전파 UPDATE는 봉인·확정 가드 5종을 그대로 통과해야 한다** — prevent_mutation · guard_locked_period · guard_workplace_readonly(봉인 3) · guard_confirmed_result · guard_confirmed_result_item(확정 2)이 이 갱신을 막으면 계정 연결이 늦은 직원의 본인 열람 경로가 영영 닫힌다. 다섯 가드는 공통 술어 **is_sync_user_id_update(old, new)**로 그 경로만 열며, 판정은 ① 다른 트리거 안에서 일어난 UPDATE ② 바뀐 컬럼이 user_id 하나뿐 ③ user_id가 NULL → 값 **1회** 전이 셋을 모두 만족할 때다. 클라이언트·서비스의 직접 UPDATE는 ①에서 걸러진다.
- **이 술어는 함수 105종 계수에 넣지 않는다.** 정책이 부르지 않아 헬퍼가 아니고(SECURITY INVOKER · 소유자도 insadesk_helper가 아니다), 트리거에 부착되지 않아 트리거 함수도 아니다 — 가드가 쓰는 조건식이다. 데이터베이스 카탈로그 실측이 **106**으로 나오는 차이가 이 1종이며 결함이 아니다.

---

## 가드·검증 트리거 함수 55종

**가드가 반환하는 에러 코드는 전부 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) 등재 전수 안에서 고른다 — 가드가 코드를 임의로 신설하지 않는다.** **종수를 여기서 세지 않는다** — 채번이 일어날 때마다 이 문장이 틀리는데 가드 목록에는 드러날 자리가 없다(2026-09-10 — workplace.mgmt_no_required 채번으로 120종이 됐고 이 문장은 119에서 멈춰 있었다). 채번은 그 정본에서만 일어나며, 2026-08-08 감사 반영에서 attendance.assignment_forbidden/422 **1종이 정본 채번으로 신설**되어 전수가 117 → **118종**이 됐고(연소자·임신 중 근로자의 금지 시간대 배치 차단 — 사용자 조치가 명확한 도메인 사건이라 폴백으로 두지 않았다), 2026-08-21 workplace.business_unit_overlap/409 신설로 118 → **119종**이 됐다. 상태 전이·불변 위반처럼 도메인 전용 코드가 없는 가드는 common.conflict/409 · common.validation_failed/400 폴백을 쓰고, 종단 상태 재전이는 해당 도메인의 종단 코드(auth.account_deleted · workplace.closed)를 재사용한다.

### 계정 (01_auth) — 7

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_account_status_transition() | BEFORE UPDATE ON users | ACTIVE↔SUSPENDED · →DELETED만 허용. **DELETED 종단** | auth.account_deleted/403(DELETED 종단) · common.conflict/409 |
| guard_last_super_admin() | BEFORE UPDATE ON users · BEFORE UPDATE/DELETE ON system_admins | 마지막 SUPER_ADMIN 역할 회수·삭제 차단 **및 해당 계정의 SUSPENDED·DELETED 전이 차단** | system.last_super_admin/409 |
| profiles_guard() | BEFORE UPDATE ON profiles | 본인 UPDATE 시 id·username·status 변경 차단 | common.conflict/409 |
| guard_consent_mutation() | BEFORE UPDATE ON user_consents | user_id·kind·terms_document_id·document_version·agreed_at 변경 차단. **kind = 'LOCATION'인 행에 한해** revoked_at의 NULL→값 1회 전이를 허용 | common.conflict/409 |
| **guard_account_deletion_blocked()** — **설계 확정** | BEFORE UPDATE ON users | owned_workplace_count(id) > 0이면 DELETED 전이 차단. **행위자가 user:delete 플랫폼 권한을 가지면 그 차단을 적용하지 않는다**(V0726 — [../06_api/14_system.md](../06_api/14_system.md) #13이 계약하는 강제 삭제 축) | auth.owner_must_transfer/409 |
| **guard_consent_document_active()** — **설계 확정** | BEFORE INSERT ON user_consents | terms_document_id가 해당 kind의 is_active 행인지 · document_version이 그 행의 version과 일치하는지 재검증 | auth.consent_required/422 |
| **guard_reset_token_consume()** — **설계 확정** | BEFORE UPDATE ON password_reset_tokens | token_hash·user_id·expires_at 불변 · used_at의 NULL→값 1회 전이만 | common.conflict/409 |

- **guard_last_super_admin()이 두 테이블에 부착되는 유일한 가드다.** 역할 회수와 계정 정지는 서로 다른 경로인데 결과가 같으므로 둘 다 막아야 한다.
- guard_account_deletion_blocked()의 근거: 상태 머신이 "OWNER로 소유한 사업장이 있으면 차단"을 **가드**로 표기했으나 그 함수가 없어 계약이 서비스 단독이었다.
- **강제 삭제 예외를 GUC로 만들지 않은 것이 요점이다**(V0726). 06_api/14_system #13이 "소유 사업장 차단도 적용하지 않는다"고 계약하는데 가드에 예외 축이 없어 사업장을 가진 계정을 플랫폼이 지울 수 없었다. **주입 계약은 5종으로 닫혀 있으므로** 여섯째 GUC를 만드는 대신 **행위자의 플랫폼 권한(user:delete)을 가드가 직접 평가한다** — 그 권한은 SUPER_ADMIN만 갖는다([../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)). **본인 탈퇴는 사업장을 넘기고 나서만 성립하지만 제재는 그 전제를 두지 않는다** — 넘길 의사가 없는 계정을 지우는 것이 제재이기 때문이고, 남은 사업장은 강제 폐쇄가 따로 처리한다.
- guard_consent_document_active()의 근거: 비활성 구버전 동의가 성립하면 **재동의 게이트가 오염**된다 — 활성 버전에 동의하지 않은 계정이 동의 완료로 계상된다.
- **필수 2종 동의의 철회를 막는 것이 guard_consent_mutation() 확장의 요점이다** — 위치정보만 선택 동의이고, 약관·개인정보 철회는 서비스 이용 근거를 없애므로 탈퇴 경로가 대신한다.

### 사업장·멤버 (02_workplace) — 12

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_workplace_immutable_fields() | BEFORE UPDATE ON workplaces | business_no·owner_name·open_date 직접 변경 차단. **정정은 app.workplace_reverify_context가 켜지고 같은 트랜잭션에 result = 'MATCH'인 business_verification_logs 행이 새로 기록된 경우에만** 허용한다 · **business_unit_id 변경은 is_workplace_owner(id)에게만 허용**하고 대상 business_units.owner_user_id가 그 사업장 OWNER와 일치하지 않으면 거부 | workplace.immutable_field/422 · auth.workplace_forbidden/403 |
| guard_workplace_status_transition() | BEFORE UPDATE ON workplaces | 허용 전이만. **CLOSED 종단**. CLOSED 전이 시 close_path·close_reason NOT NULL 강제 · retention_acknowledged_at은 **close_path가 PLATFORM_FORCED가 아닐 때만** 강제(V0726) | workplace.closed/409(CLOSED 종단) · workplace.retention_ack_required/422 |
| **guard_workplace_readonly()** | BEFORE INSERT/UPDATE · 산하 **18테이블** | 사업장이 CLOSED면 INSERT·UPDATE 차단. **예외 3 — 본인 소유권 SELECT · payslip_deliveries의 VIEWED·DOWNLOADED INSERT · 폐쇄 트랜잭션 안의 workplace_members 종료 전이**이며 세 번째의 판정 축은 **app.workplace_close_context GUC**다. **예외 판정의 열 참조는 v_new(to_jsonb(NEW)) 축이다**(V0712 본문 교체 — 아래 절) | workplace.closed/409 |
| **guard_owner_singleton()** | **DEFERRABLE CONSTRAINT TRIGGER** ON workplace_members | 트랜잭션 종료 시 ACTIVE OWNER가 0명이면 차단. **workplaces.status = 'CLOSED'인 사업장은 대상에서 제외한다**(폐쇄가 OWNER 멤버십을 함께 종료한다) | workplace.last_owner/409 |
| guard_member_transition() | BEFORE UPDATE ON workplace_members | →ACTIVE(신규·**LEFT에서만**) · ACTIVE→LEFT · ACTIVE→REMOVED. **REMOVED→ACTIVE 차단** · **표에 없는 전이는 전부 거부한다**(기본 거부) | workplace.member_state_conflict/409 |
| guard_member_cap() | BEFORE INSERT/UPDATE ON workplace_members | ACTIVE 전이 시 active_member_count >= plan.max_staff_per_workplace면 차단(절대 상한 30) | subscription.staff_limit_exceeded/402 |
| guard_role_change() | BEFORE UPDATE ON workplace_members | **OWNER는 역할 직접 변경으로 생성할 수 없다**(양도 경로 전용 · v1 미구현) · **역할 컬럼 변경 자체를 is_workplace_owner(workplace_id)에게만 허용한다** — MANAGER의 STAFF 승격·타 MANAGER 강등을 DB에서 막는다 | workplace.role_change_forbidden/403 |
| guard_invitation_transition() | BEFORE UPDATE ON workplace_invitations | **클라이언트 직접 ACCEPT 차단**(is_invitation_accept_context()에서만 허용). EXPIRED는 배치 전용. PENDING에서도 workplace_id·target·role·invited_by 직접 UPDATE 불가. 종결 재응답 차단 | invitation.already_responded/409 |
| **check_snapshot_series_balance()** | **DEFERRABLE CONSTRAINT TRIGGER** ON employee_count_snapshot_days | total_worker_days = Σ worker_count · operating_days = count(\*) | common.conflict/409 |
| **guard_closed_workplace_members()** — **설계 확정** | **DEFERRABLE CONSTRAINT TRIGGER** ON workplaces | 트랜잭션 종료 시 status = 'CLOSED'인 사업장에 ACTIVE 멤버십이 남아 있으면 거부 | workplace.close_blocked/409 |
| **guard_invitation_insert_role()** — **설계 확정** | BEFORE INSERT ON workplace_invitations | role = 'MANAGER'인 초대를 is_workplace_owner(workplace_id)에게만 허용 | workplace.invite_role_forbidden/403 |
| **guard_workplace_cap()** — **설계 확정** | BEFORE INSERT ON workplaces | owned_workplace_count(created_by) >= plan.max_owned_workplaces면 차단 | subscription.workplace_limit_exceeded/402 |

#### 예외 판정의 열 참조는 jsonb 축이다 (V0712 본문 교체)

**예외 ②·③의 판정이 NEW.delivery_type · NEW.status를 직접 참조했다.** plpgsql은 IF 조건 전체를 하나의 SQL 식으로 준비하므로 TG_TABLE_NAME 비교가 앞에 있어도 **식을 준비하는 시점에 그 열이 없는 테이블에서 즉시 실패한다**. 이 트리거는 **18테이블이 공유**하므로, 결과로 **CLOSED 사업장에 대한 모든 쓰기가 workplace.closed/409가 아니라 SQL 오류로 끝났다** — close_workplace()의 OWNER 멤버십 UPDATE도 같은 자리에서 막혔다(workplace_members에는 delivery_type이 없다).

보정 **V0712**가 참조 축을 이미 함수 안에 있던 **v_new**(to_jsonb(NEW))로 옮겼다. 없는 키는 NULL이고 **NULL IN (…)은 예외가 아니라 거짓**이라 어느 테이블에서 평가해도 성립한다.

- **중첩 IF로 도달을 막지 않는다.** 중첩은 두 자리를 고칠 뿐이고 예외가 하나 더 늘면 같은 결함이 다시 생긴다 — 참조 축 자체를 바꾸면 예외가 늘어도 형태가 재현되지 않는다.
- **함수 신설이 아니라 본문 교체다.** 함수 수 · 가드 55 · 부착 수는 불변이다.

#### 강제 폐쇄는 보존 안내 확인을 요구하지 않는다 (V0726)

**retention_acknowledged_at의 뜻은 "사업주가 보존 안내를 확인했다"이고, 플랫폼이 가한 제재에는 그 확인이 존재하지 않는다.** 06_api/14_system #7은 자발 폐쇄의 선행조건 5종을 요구하지 않는데 가드는 이 열을 NOT NULL로 요구했고, 그래서 강제 폐쇄 자체가 성립하지 않았다.

- **서버가 대신 채우지 않는다 — 열을 NULL로 둔다.** 채우면 "확인했다"는 뜻의 열에 사실이 아닌 값이 남고, 사후에 그 사업장이 안내를 받았는지 데이터로는 분간할 수 없게 된다. **없는 사실을 적는 것은 안 적는 것보다 나쁘다** — 같은 판단을 V0721(review_note)과 REQ-SLP-15에서 두 번 했다.
- **판정 축은 close_path다.** OWNER_VOLUNTARY면 요구가 그대로 서고 PLATFORM_FORCED면 걷힌다 — 예외를 상태(CLOSED)가 아니라 **경로**에 걸어야 자발 폐쇄의 계약이 흔들리지 않는다.
- **close_path · close_reason은 두 경로 모두에서 여전히 필수다.** 걷은 것은 셋 중 하나뿐이며, 폐쇄가 왜 일어났는지의 기록은 제재에서 더 필요하다.

#### OWNER 정확히 1명 — 두 방향

- 부분 UQ (workplace_id) WHERE role = 'OWNER' AND status = 'ACTIVE'가 **2명 이상**을 막는다.
- DEFERRABLE guard_owner_singleton()이 트랜잭션 종료 시 **0명**을 막는다.
- **한쪽만으로는 "정확히 1명"이 성립하지 않는다.** DEFERRABLE이라 향후 양도의 강등 → 승격(중간 0명 · 최종 1명)과도 양립한다.
- 동시성은 멤버십 행 FOR UPDATE가 1차, advisory lock 'wp:'||wid가 초대 수락 경로의 직렬화를 담당한다.
- **폐쇄는 두 장치가 함께 성립시킨다** — app.workplace_close_context가 읽기 전용 가드의 예외를 열고, guard_closed_workplace_members()가 그 예외를 쓰지 않은 채 폐쇄가 끝나는 것을 막는다. 열쇠와 자물쇠라 한쪽만으로는 계약이 서지 않으며, 멤버십을 남긴 채 CLOSED가 되면 읽기 전용 가드가 그 행을 영구히 잠가 OWNER 탈퇴 교착이 되살아난다.
- **초대 역할 제한과 사업장 한도는 같은 형태의 공백이었다** — 정책의 관리자 축은 OWNER와 MANAGER를 구분하지 못하고, 인원 한도에는 트리거 백스톱이 있는데 소유 한도에는 없었다. 두 가드가 그 비대칭을 없앤다.
- **역할 변경 주체 제한은 guard_role_change()의 조건 확장으로 넣는다** — 함수를 새로 만들지 않고 에러는 기존 workplace.role_change_forbidden/403을 재사용한다(정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) — MANAGER의 역할 변경 · 역할 변경으로 OWNER 생성 시도). 멤버십 UPDATE 정책은 관리자 축(OWNER 또는 MANAGER)이라 MANAGER의 역할 조작을 RLS가 막지 못하므로, 이 조건이 없으면 "역할 변경은 OWNER 전용"(WRK-07)의 2차 방어가 실재하지 않는다.

### 인사 (03_hr) — 6

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_employee_status_transition() | BEFORE UPDATE ON employees | ACTIVE↔ON_LEAVE · →RESIGNED만. **RESIGNED 종단**. RESIGNED 전이 시 resignation_date·last_work_date **· hire_date** NOT NULL 강제 + retention_until 자동 세팅 · **대상자의 ACTIVE OWNER 멤버십 보유 차단** | hr.rehire_requires_new_employee/409 · hr.resignation_blocked/409 |
| **guard_employee_workplace_match()** | BEFORE INSERT/UPDATE · **employee_id 보유 16테이블**(아래 부착 전수) | employee_id의 workplace_id 불일치 차단(테넌트 오염) | auth.workplace_forbidden/403 |
| guard_contract_transition() | BEFORE UPDATE ON contracts | DRAFT→SENT→SIGNED→ARCHIVED · SENT→CANCELLED만. employee_id·workplace_id 불변. **SENT 이후 content·pdf_hash·document_id 변경 차단** · **DRAFT → SENT 시 document_id NOT NULL · pdf_hash = documents.file_hash 재검증** · **SIGNED → ARCHIVED 시 delivered_at NOT NULL 요구** | common.conflict/409 |
| **guard_contract_retention()** | BEFORE INSERT/UPDATE ON contracts | ARCHIVED 전이 시 retention_until NOT NULL 강제. **직원이 ACTIVE·ON_LEAVE인 동안 retention_until을 과거 일자로 설정 차단** | common.validation_failed/400 |
| guard_contract_signature_insert() | BEFORE INSERT ON contract_signatures | **계약이 SENT 상태 · 서명자가 해당 employee 본인 · pdf_hash 일치** 재검증 | hr.contract_not_signable/409 |
| **check_resignation_membership_mapping()** — **설계 확정** | **DEFERRABLE CONSTRAINT TRIGGER** ON employees | RESIGNED 전이 직원의 멤버십 종료 상태가 사유 매핑과 일치하는지 트랜잭션 종료 시 검증 — **VOLUNTARY·CONTRACT_END → LEFT · RECOMMENDED·DISMISSAL → REMOVED** | workplace.member_state_conflict/409 |

**guard_employee_workplace_match() 부착 16테이블** — 기존 서술은 "employee_id 보유 테이블"이라는 포괄이라 실제 부착 집합이 어느 문서에도 없었다.

| 도메인 | 테이블 |
|--------|--------|
| 인사 6 | employee_personal_infos · employment_terms · employee_insurance_infos · employee_insurance_histories · contracts · documents(employee_id IS NOT NULL인 행만 — NULL은 사업장 문서) |
| 근태 5 | attendance_records · attendance_breaks · attendance_daily_summaries · attendance_change_requests · work_schedules |
| 휴가 5 | leave_grants · leave_requests · leave_transactions · leave_balances · employee_protected_periods |

- 검산: 6 + 5 + 5 = **16테이블**. 급여·명세서·준수 도메인의 employee_id 보유 테이블은 복합 FK 또는 부모 실행의 workplace_id로 이미 결속돼 있어 중복 부착하지 않는다.
- guard_break_bounds()는 부착 대상이 attendance_breaks이므로 **근태 절로 옮겼다** — 인사 6 · 근태 9이며 합계는 변하지 않는다.
- check_resignation_membership_mapping()이 DEFERRABLE인 이유: 퇴사 트랜잭션이 employees와 workplace_members 중 어느 쪽을 먼저 고치든 검증이 성립해야 한다.
- **guard_contract_retention()이 재직 중 만료를 DB에서 막는 것이 이 도메인의 핵심 방어다.** 없으면 파기 배치가 재직자의 근로계약서를 지운다(REQ-GLB-18 · REQ-CMP-10).
- **ARCHIVED 진입에 delivered_at을 요구하는 것이 §17② 교부 의무의 물리적 강제다** — 교부하지 않은 서명본이 보관으로 닫히면 미이행이 종단 상태가 된다.

### 인사 (03_hr) 검산

guard_employee_status_transition · guard_employee_workplace_match · guard_contract_transition · guard_contract_retention · guard_contract_signature_insert · check_resignation_membership_mapping = **6종**.

### 근태 (04_attendance) — 9

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_locked_period()** | BEFORE INSERT/UPDATE ON attendance_records · attendance_daily_summaries · attendance_change_requests · **leave_requests** | LOCKED 급여월의 변경 차단. is_period_locked(wid, pay_period)로 판정한다 | attendance.period_closed/409 · leave.period_closed/409 |
| guard_work_schedule_locked_period() | BEFORE INSERT/UPDATE ON work_schedules | 신규 기간 또는 UPDATE 전 기존 기간이 LOCKED 근태월과 겹치면 차단(**소급 변경 방지**) | attendance.period_closed/409 |
| **guard_self_approval()** | BEFORE UPDATE ON attendance_change_requests · leave_requests · **attendance_records** | reviewed_by가 **대상 직원(employee_id)의 user_id**면 차단. **대리 제출자(requested_by) = 승인자는 차단하지 않는다.** 부착 3테이블 | attendance.self_approval_forbidden/403 · leave.self_approval_forbidden/403 |
| guard_request_status_transition() | BEFORE UPDATE ON attendance_change_requests · leave_requests | 종결 3상태 불변. 승인·반려 시 **reviewed_by·reviewed_at 필수**. **review_note(공백 불가)는 테이블별로 갈린다**(V0724) — **attendance_change_requests는 승인·반려 양쪽 · leave_requests는 반려에만**이다. **APPROVED→CANCELLED는 관리자 조건부** | common.conflict/409 |
| **guard_attendance_status_transition()** — **설계 확정** | BEFORE UPDATE ON attendance_records | OPEN→COMPLETED · OPEN→PENDING · **PENDING→COMPLETED(승인)** · **PENDING→CANCELLED(반려 · review_note 필수)**만 허용. 승인·반려 시 reviewed_by·reviewed_at 필수 | common.conflict/409 |
| guard_closing_transition() | BEFORE UPDATE ON attendance_period_closings | LOCKED→REOPENED(**급여 미확정만** · 사유 필수 · OWNER) · REOPENED→LOCKED · LOCKED→CANCELLED(종결). 마감 시 count_snapshot_id NOT NULL | attendance.closing_blocked/409 |
| **guard_break_bounds()** — **설계 확정** | BEFORE INSERT/UPDATE ON attendance_breaks | 출근 전·퇴근 후 휴게 차단 · 중복 휴게 시작 차단 | attendance.invalid_sequence/409 |
| **guard_minor_pregnancy_assignment()** — **설계 확정** | BEFORE INSERT/UPDATE ON work_schedules | 연소자(만 18세 미만 — employees.birth_date)의 야간(22:00~06:00 걸침)·주휴일 편성 차단 · 임신 중 근로자의 소정근로 초과 편성 차단 | common.validation_failed/400 |
| **guard_location_consent_required()** — **설계 확정** | BEFORE INSERT ON attendance_records | source = 'GPS'이면 kind = LOCATION이고 revoked_at IS NULL인 동의 존재 재검증 | privacy.location_consent_required/403 |

- guard_attendance_status_transition()의 근거: **REQ-ATT-04**가 PENDING 레코드의 승인·반려 계약(MANAGER 수행 · 승인은 COMPLETED · 반려는 CANCELLED + 사유 필수 · 원본 보존)을 확정했으나 원천 schema_p0의 attendance_records 절에 상태 전이 가드가 없다. 서비스 1차 검증의 2단 방어로 부착한다.
- **review_note 요구는 테이블별로 갈린다**(V0724). **leave_requests는 반려에만** — 반려는 신청자가 왜 거절됐는지 알아야 다시 신청할 수 있으므로 사유가 그 판정의 일부이지만, 승인은 신청대로 된 것이라 설명할 것이 없고 강제하면 형식적 입력만 쌓인다(REQ-LEV-10). **attendance_change_requests는 승인·반려 양쪽** — 관리자가 대신 제출하고 스스로 승인하는 경로가 있어(REQ-ATT-16) **승인 사유가 곧 임금 분쟁의 1차 증거**다. **reviewed_by · reviewed_at은 양쪽 다 필수**이며 누가 언제 판정했는지가 기록의 최소 단위다.
- **V0721이 완화를 공유 가드 전체에 적용한 것이 결함이었고 V0724가 테이블별로 나눴다.** 완화 자체는 휴가 축에서 옳았으나 **근태 문서가 정반대 근거를 이미 갖고 있었다.** **공유 부착 가드는 부착된 모든 테이블의 정본을 확인한 뒤에 고친다 — 함수가 하나라는 사실이 규칙이 하나라는 뜻은 아니다.** 이 함수는 이미 TG_TABLE_NAME = 'leave_requests' 분기를 갖고 있었다는 것이 그 증거였는데, V0721은 그 분기를 보고도 사유 요구를 테이블 무관으로 뒀다.
- **판정 3층이 실제로 서로를 잡은 자리다.** 업무 규칙 층(가드)이 잘못 움직였을 때 **무결성 층(CHECK)이 결과를 막았다** — 셋 중 하나를 다른 하나의 대체로 쓰지 않는 규약이 실측으로 값을 낸 사례다. **다만 그 값은 "한 층이 틀려도 안전하다"가 아니라 "두 층이 갈린 것을 누군가 발견해야 한다"이다** — 계수 검수로는 드러나지 않고 이번에도 수치 미러 작업 중에 카탈로그를 직접 읽어 잡았다. **자동으로 드러나는 자리가 없다.**
- **guard_self_approval()과 guard_request_status_transition()은 근태·휴가 두 도메인에 공유 부착된다** — 판정 논리가 같으므로 함수를 둘로 만들지 않는다. guard_self_approval()은 **수정 요청·휴가 신청·PENDING 체크인 레코드 3테이블**에 붙는다.
- **본인 요청 본인 승인은 차단하고, 본인 포함 급여의 확정은 OWNER로 제한한다**(guard_payroll_status_transition — 자기포함 판정·동결 + 비OWNER 확정 차단 + 감사) — 전자는 대안 경로(다른 관리자)가 있고, 후자는 소상공인 사업장에서 OWNER 본인이 대상인 것이 정상이라 OWNER의 자기포함 확정은 허용하되 기록으로 남기기 때문이다.

### 휴가 (05_leave) — 3

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_leave_grant_snapshot()** — **설계 확정** | BEFORE INSERT ON leave_grants | count_snapshot_id 부재 시 발생 차단 · applies_five = false면 미적용 반환 | leave.employee_count_snapshot_required/422 · leave.not_applicable/403 |
| **check_leave_reservation_balance()** — **설계 확정** | **DEFERRABLE CONSTRAINT TRIGGER** ON leave_requests · leave_balances | leave_balances.reserved_days = Σ leave_requests.reserved_days WHERE status = 'PENDING' | common.conflict/409 |
| **guard_protected_period_effective_date()** — **설계 확정** | BEFORE INSERT/UPDATE ON employee_protected_periods | CHILDCARE_REDUCED_HOURS · PREGNANCY_REDUCED_HOURS는 **2025-10-23 이후 구간에만** counts_as_attendance = true를 허용 | common.validation_failed/400 |

- 근거: 원천 leave_grants 절의 "스냅샷 부재 시 발생 차단 → leave.employee_count_snapshot_required/422 · 5인 미만은 미적용 → leave.not_applicable/403" 서술이며 함수명이 부여되지 않았다.
- **403과 422를 구분하는 것이 규약이다**(REQ-GLB-19) — 5인 미만은 조치할 것이 없는 정상 상태이고 스냅샷 부재는 재시도 가능한 전제 미충족이다.
- **예약 잔액은 원장 행이 아니라 ledger_checksum의 대조 범위 밖이다** — 복원 누락이 감지 경로 없이 영구 누적되므로 DEFERRABLE 대조가 그 자리를 맡는다. 신청 행과 잔액 행의 갱신 순서를 고정하지 않기 위해 지연 검증이다.
- **④·⑤ 단축 2종은 법률 제20520호 신설이라 시행일 이전 구간에 출근 간주를 적용하면 연차가 과다 발생한다** — 기간이 시행일을 걸치면 행을 두 구간으로 나눠 등록한다.
- 나머지 휴가 가드는 근태와 공유한다(guard_self_approval · guard_request_status_transition · guard_locked_period).

### 급여 (06_payroll) — 5

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_payroll_status_transition() | BEFORE UPDATE ON payroll_runs | DRAFT→CALCULATED→CONFIRMED→VOIDED · CALCULATED→CALCULATED. **CONFIRMED→CALCULATED 금지**. CONFIRMED 후 pay_date·pay_period·동결 컬럼 불변. VOIDED 시 void_reason NOT NULL. CONFIRMED 시 pay_date·정책 3종 **· retention_until · retention_basis** NOT NULL. **CONFIRMED 시 헤더 캐시 3종(total_gross · total_deduction · total_net)을 산하 결과 합과 대조**한다. **CONFIRMED 전이 시 self_included를 판정·동결**하고(판정 축은 **employees.user_id**이며 결과 행의 사본이 아니다) true면 확정자를 OWNER로 제한. **사업장이 PENDING_VERIFICATION이면 CONFIRMED 전이를 차단** | common.conflict/409 · **auth.workplace_forbidden/403**(자기포함 런의 비OWNER 확정) · **workplace.verification_pending/409** |
| **guard_payroll_locked_period()** — **설계 확정** | BEFORE INSERT/UPDATE ON employment_terms · payroll_terms · leave_requests · leave_transactions | 해당 기간에 **확정 트랜잭션이 advisory lock을 보유 중**이면 변경 차단 | attendance.period_closed/409 |
| **guard_confirmed_result()** | BEFORE UPDATE/DELETE ON payroll_employee_results | 소속 run이 CONFIRMED면 **모든 컬럼** 변경·삭제 차단. **user_id·updated_at 동기화만 예외** | common.conflict/409 |
| **guard_confirmed_result_item()** | BEFORE UPDATE/DELETE ON payroll_employee_result_items | **CONFIRMED·VOIDED** run의 전 컬럼 변경·삭제 차단. **DRAFT·CALCULATED run의 라인 DELETE는 허용**한다 — 재계산 교체 경로이며 정책과 가드가 같은 상태 조건을 이중으로 건다 | common.conflict/409 |
| **check_payroll_result_balance()** | **DEFERRABLE CONSTRAINT TRIGGER** ON payroll_employee_result_items | gross_pay = Σ EARNING · total_deduction = Σ DEDUCTION · net_pay = gross − deduction. **source = 'IMPORT' 면제** | common.conflict/409 |

- **확정 불변이 이 도메인의 유일한 되돌리기 방지 장치다.** 정정은 원본 VOID + supersedes_id 정정본 발행으로만 하며, DB가 UPDATE 자체를 막으므로 애플리케이션 결함이 확정 임금대장을 바꿀 수 없다.
- check_payroll_result_balance()가 DEFERRABLE인 이유는 결과 행과 라인 행의 삽입 순서를 자유롭게 두기 위해서다.
- **employer_insurance_total과 산재 base는 검증에서 제외한다** — 근로자 공제가 아니므로 공제 합에 들어가지 않는다.
- **payroll_validation_results에는 가드를 두지 않는다** — 확정 후 INSERT·DELETE가 모두 정책 층에서 닫히므로 트리거를 겹칠 필요가 없다. 라인은 확정 후에도 sync_employee_user_id()의 user_id 갱신 경로가 있어 가드가 필요하다.
- **guard_payroll_locked_period()가 employees에 부착되지 않는 것이 판단의 결과다** — 성명·고용 연월일·종사 업무가 확정 결과에 값으로 동결되므로 확정 후 인사 변경이 과거 대장을 바꾸지 않는다. 남는 위험은 확정 트랜잭션 진행 중의 동시 변경뿐이라 그 구간만 막는다.

### 명세서 (11_payslip) — 3

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_payslip_transition() | BEFORE UPDATE ON payslips | PENDING→{GENERATED, FAILED} · GENERATED→{DELIVERED, CORRECTED} · DELIVERED→CORRECTED · FAILED→PENDING(**failure_reason = 'run_voided' · 'missing_required_field'는 제외·고정**). GENERATED 전이 시 document_id NOT NULL. **CORRECTED 체인은 GENERATED·DELIVERED 한정**. **사업장이 PENDING_VERIFICATION이면 GENERATED·DELIVERED 전이를 차단** | common.conflict/409 · **workplace.verification_pending/409** |
| **guard_payslip_correction_insert()** — **설계 확정** | BEFORE INSERT ON payslips | supersedes_id가 채워진 INSERT에 한해 ① 요청자가 해당 사업장 OWNER인지 ② correction_reason이 비지 않았는지 ③ 대상 원본이 GENERATED·DELIVERED인지 재검증 | payslip.correct_forbidden/403 · common.conflict/409 |
| **guard_payslip_delivery_insert()** — **설계 확정** | BEFORE INSERT ON payslip_deliveries | payslip_id로 명세서 행을 읽어 **user_id 일치·workplace_id 일치** 재검증 | auth.workplace_forbidden/403 |

- run VOID 시 산하 PENDING·FAILED를 FAILED(run_voided)로 고정하고 원본 PDF·해시는 보존한다 — 그 연쇄를 실행하는 것이 propagate_run_void_to_payslips()다.
- **정정본은 상태 전이가 아니라 INSERT라 전이 가드가 닿지 않는다** — INSERT 정책은 서버 컨텍스트 단일 축이라 역할을 판별하지 못하므로, 급여 도메인이 전이 가드로 확보한 2단 방어를 명세서 축에서는 INSERT 가드가 맡는다.
- **교부 이력은 append-only 법정 증거 원장이다** — 정책이 기록 행의 user_id만 보므로 payslip_id·workplace_id를 임의로 채운 INSERT가 통과하고, 참조 성립 여부가 명세서 존재 신호가 되어 404 은닉이 뚫린다.
- **필수항목 누락을 재큐잉에서 고정하는 이유는 재시도로 해소되지 않기 때문이다** — 데이터 보완 전까지 15분 주기 무한 재시도가 되며, 해소 경로는 관리자 보완 후 재생성이다.
- 교부 1회 멱등은 트리거가 아니라 payslip_deliveries의 부분 UQ가 담당한다.

### 법정 준수 (12_compliance) — 1

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_compliance_task_immutable()** — **설계 확정** | BEFORE UPDATE ON compliance_tasks | trigger_date·due_date·task_type 불변. COMPLETED 전이 시 completed_at NOT NULL · WAIVED 전이 시 waived_reason NOT NULL | common.conflict/409 |

- 근거: 원천 compliance_tasks 절의 "trigger_date·due_date·task_type 불변. 완료 전이 시 completed_at NOT NULL" 서술이며 함수명이 부여되지 않았다.
- **기한을 사후에 바꿀 수 있으면 감지 배치의 재실행 결정성이 무너진다.**

### 알림 (13_notification) — 2

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_notification_user_columns()** — **설계 확정** | BEFORE UPDATE ON notifications | 사용자는 **read_at만** 조작 가능 · deleted_at은 서버 전용 · 다른 컬럼 UPDATE 차단 | notification.forbidden/403 |
| **guard_notification_type_active()** — **설계 확정** | BEFORE INSERT ON notifications | 참조 타입의 is_active 재검증 | notification.unknown_type/400 |

- 근거: 원천 notifications 절의 "사용자는 read_at·deleted_at만 조작 가능(다른 컬럼 UPDATE 차단)" 서술이며 함수명이 부여되지 않았다. **deleted_at을 서버 전용으로 좁힌 것은 알림 삭제(NTF-05)가 v1 제외**인데 조작 경로만 열려 있었기 때문이다.
- **RLS 정책은 행을 좁힐 뿐 컬럼을 좁히지 못한다** — 이 가드가 없으면 수신자가 자기 알림의 title·payload를 바꿀 수 있다.
- FK는 타입 코드의 **존재**만 보므로 비활성 타입으로도 알림이 생성된다 — 서버 고정 카탈로그(NTF-04)의 "미정의 타입 생성 거부"를 활성 축까지 확장하는 것이 두 번째 가드다.

### 구독 (14_subscription) — 2

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_subscription_transition() | BEFORE UPDATE ON subscriptions | TRIAL→{ACTIVE, EXPIRED} · ACTIVE→{PAST_DUE, CANCELLED, EXPIRED} · PAST_DUE→{ACTIVE, EXPIRED} · **EXPIRED·CANCELLED→{ACTIVE, TRIAL}는 관리자 수동 조정 전용**(adjusted_by · memo 필수 · 감사 기록) | common.conflict/409 |
| **guard_plan_immutable()** — **설계 확정** | BEFORE UPDATE ON plans | code·version·effective_from·한도 2축·price 변경 차단. name·display_order·is_active만 허용 | system.plan_in_use/409 |

- guard_plan_immutable()의 근거: statutory_rates에는 같은 성격의 불변 가드가 있는데 plans에만 없었다. **한도를 고치면 그 요금제를 참조한 과거 구독의 한도가 소급 변형**되므로, 변경은 같은 code의 새 version 행 INSERT다.

### 시스템 (15_system) — 2

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_audit_reason_required()** | BEFORE INSERT ON audit_logs | 고위험 액션 **17항목 · action 코드 28종**의 reason을 NOT NULL·공백 불가로 강제 | common.validation_failed/400 |
| **guard_statutory_rate_immutable()** — **설계 확정** | BEFORE UPDATE ON statutory_rates | category·key·value·effective_from·version 변경 차단. **확인 메타(confirmed_by·confirmed_at·source_url·source_name)만 갱신 허용** | common.conflict/409 |

- guard_statutory_rate_immutable()의 근거: 원천 statutory_rates 절의 "변경은 신 버전 행 INSERT. 기존 행 UPDATE 금지(이미 급여 결과가 참조)" 서술이며 함수명이 부여되지 않았다. 확인 메타만 여는 이유는 확인 절차가 등록 후에 수행되기 때문이다.
- guard_audit_reason_required()의 대상은 [15_system.md](./15_system.md)가 정본이며 **항목 17 · 코드 28**이다 — 한 항목이 여러 코드를 갖는다.
- **⑯ 계정 구독 수동 조정(subscription.adjust)이 항목을 15 → 16으로 만든 자리다**(V0719 판정 배열 확장). **신설이 아니라 누락 보정이다** — REQ-SYS-09가 사유 필수를 못박고 RBAC 위험 행위 통제 표도 같은 요구를 적는데 **열거만 그것을 담지 못하고 있었다.** ⑦처럼 흡수할 항목이 없어(제재도 기준값도 아니다) 항목을 하나 더 둔다.
- **⑦이 강제 폐쇄에서 사업장 폐쇄로 넓어져 코드가 25 → 26이 됐다**(V0712 판정 배열 확장). 자발 폐쇄(workplace.close)도 되돌릴 수 없고 사업장 운영이 즉시 멈추므로 사유를 요구하는 근거가 강제 폐쇄와 같다. **항목 15는 불변이다** — 새 항목을 만들지 않고 기존 항목에 코드를 더한다.
- **판정 배열은 함수 본문에 있으므로 코드 채번이 곧 강제 지점의 개정이다.** 정본에 코드를 등재하고 배열을 함께 넓히지 않으면 강제가 조용히 빠진다.

### 상시근로자 스냅샷 (02_workplace 소속) — 1

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_snapshot_confirmed()** — **설계 확정** | BEFORE UPDATE ON workplace_employee_count_snapshots · employee_count_snapshot_days | confirmed_at이 세팅된 스냅샷의 판정 컬럼 변경 차단 | workplace.immutable_field/422 |

- 근거: 원천 두 테이블 절의 "confirmed_at이 세팅된 스냅샷은 판정 컬럼 변경 차단" · "스냅샷 확정 후 변경 차단" 서술이며 함수명이 부여되지 않았다.
- 확정 후 정정은 **자동 소급하지 않고** 급여 원본 VOID + 정정본 경로로만 반영한다(REQ-CMP-07).

### 개인정보 (16_privacy) — 1

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| **guard_location_usage_consent()** — **설계 확정** | BEFORE INSERT ON location_usage_records | consent_id가 같은 user_id의 kind = LOCATION 동의이고 미철회인지 재검증 | privacy.location_consent_required/403 |

- 확인자료는 **위치정보 이용의 법정 증거**이므로 동의 없는 이용 기록이 남는 것 자체가 모순이다. 체크인 축(guard_location_consent_required)과 기록 축을 함께 막아야 두 경로가 한 계약을 갖는다.

### 인프라 (17_infra) — 1

| 함수 | 부착 | 내용 | 에러 |
|------|------|------|------|
| guard_import_transition() | BEFORE UPDATE ON import_jobs | 표에 없는 전이 거부. **VALIDATED→COMMITTED는 OWNER 전용**. COMMITTED·PARTIALLY_COMMITTED·CANCELLED·FAILED 종단(**재시도는 새 작업**) | common.conflict/409 |

### 가드 함수 검산

계정 7 + 사업장 12 + 인사 6 + 근태 9 + 휴가 3 + 급여 5 + 명세서 3 + 준수 1 + 알림 2 + 구독 2 + 시스템 2 + 스냅샷 1 + 개인정보 1 + 인프라 1 = **55**.

설계 확정 **24종**: guard_break_bounds · guard_leave_grant_snapshot · guard_attendance_status_transition · guard_compliance_task_immutable · guard_notification_user_columns · guard_statutory_rate_immutable · guard_snapshot_confirmed(원 7) + guard_closed_workplace_members · guard_invitation_insert_role · guard_account_deletion_blocked · guard_consent_document_active · guard_reset_token_consume · guard_plan_immutable · guard_workplace_cap · guard_notification_type_active · guard_location_consent_required · guard_location_usage_consent · check_resignation_membership_mapping · guard_minor_pregnancy_assignment · check_leave_reservation_balance · guard_protected_period_effective_date · guard_payroll_locked_period · guard_payslip_correction_insert · guard_payslip_delivery_insert(신설 17) = **24**. 원천 명시 31 + 설계 확정 24 = **55**.

---

## 확정 불변 강제 — 전 도메인 요약

CONFIRMED·LOCKED·SIGNED 이후의 변경을 막는 지점을 한자리에 모은다.

| 상태 | 대상 | 강제 함수 | 되돌리기 경로 |
|------|------|----------|--------------|
| payroll_runs = CONFIRMED | 결과 전 컬럼 · 항목 라인 전 컬럼 | guard_confirmed_result() · guard_confirmed_result_item() | 원본 VOID + supersedes_id 정정본. **미확정 실행에는 이 봉인이 걸리지 않는다** — DRAFT·CALCULATED의 라인·검증 결과는 재계산이 교체하며 봉인은 CONFIRMED·VOIDED에서 시작된다 |
| payroll_runs = CONFIRMED | 헤더 pay_date·pay_period·동결 컬럼 | guard_payroll_status_transition() | 〃 |
| attendance_period_closings = LOCKED | 근태 원본·일 집계·수정 요청 | guard_locked_period() | REOPENED(급여 미확정 시) |
| attendance_records = COMPLETED·CANCELLED | PENDING 출구 이후 재전이 | guard_attendance_status_transition() | 없음 — 정정은 수정 요청(attendance_change_requests) 경로다 |
| attendance_period_closings = LOCKED | 스케줄 기간 겹침 | guard_work_schedule_locked_period() | 〃 |
| contracts = SENT 이후 | content·pdf_hash·document_id | guard_contract_transition() | 기존본 CANCELLED + 새 version DRAFT |
| workplaces = CLOSED | 산하 업무 테이블 INSERT·UPDATE | guard_workplace_readonly() | 없음(종단) |
| workplace_employee_count_snapshots.confirmed_at | 판정 컬럼 · 시계열 | guard_snapshot_confirmed() | **확정 전 재산정은 같은 행 교체**(부모 UPDATE + 자식 DELETE·재INSERT) · **확정 후 정정은 급여 정정본** |
| employee_protected_periods 확정 구간 | 종료된 보호 기간의 kind·기간·counts_as_attendance | guard_protected_period_effective_date() | 새 행 |
| contracts = ARCHIVED | 교부 없는 보관 진입 | guard_contract_transition()(delivered_at 요구) | 기존본 CANCELLED + 새 version DRAFT |
| payslips = CORRECTED 체인 | 원본 명세서 | guard_payslip_transition() | supersedes_id 정정본 |
| import_jobs 종단 4상태 | 전 컬럼 | guard_import_transition() | 새 임포트 작업 |
| statutory_rates 등록분 | 값·기간 | guard_statutory_rate_immutable() | 새 버전 행 INSERT |

검산: 급여 축 2 + 근태 축 3 + 계약 축 **2** + 사업장 축 1 + 스냅샷 축 1 + 명세서 축 1 + 임포트 축 1 + 기준값 축 1 + **휴가 축 1** = **13지점**.

- **되돌리기 경로가 항상 "새 행"인 것이 공통 패턴이다.** 확정된 사실을 덮어쓰지 않고 새 사실을 이어 붙이며, 어느 쪽이 유효한지는 상태와 supersedes 체인이 표현한다.

---

## DEFERRABLE CONSTRAINT TRIGGER 6종

트랜잭션 종료 시점에 검증한다 — 중간 상태를 허용해야 하는 불변식이다.

| 함수 | 불변식 | DEFERRABLE인 이유 |
|------|-------|------------------|
| guard_owner_singleton() | ACTIVE OWNER >= 1(**CLOSED 사업장 제외**) | 양도의 강등 → 승격 과정에서 중간 0명이 발생하고, 폐쇄 트랜잭션은 OWNER 멤버십을 종료한다 |
| **guard_closed_workplace_members()** | CLOSED 사업장의 ACTIVE 멤버십 = 0 | 사업장 상태와 멤버십 종료의 순서 의존을 만들지 않는다 |
| check_snapshot_series_balance() | total_worker_days = Σ worker_count · operating_days = count(\*) | 부모 스냅샷과 자식 시계열의 삽입 순서를 고정하지 않는다 |
| check_payroll_result_balance() | gross = Σ EARNING · deduction = Σ DEDUCTION · net = gross − deduction | 결과 행과 라인 행의 삽입 순서를 고정하지 않는다 |
| **check_resignation_membership_mapping()** | 퇴사 사유 ↔ 멤버십 종료 상태 매핑 | employees와 workplace_members의 갱신 순서를 고정하지 않는다 |
| **check_leave_reservation_balance()** | reserved_days = Σ PENDING 신청의 예약 일수 | 신청 행과 잔액 행의 갱신 순서를 고정하지 않는다 |

- **즉시 검증이면 삽입 순서가 스키마 제약이 된다** — 애플리케이션이 특정 순서로만 쓸 수 있게 되고, 그 순서를 어기면 정상 데이터가 거부된다.

---

## 트리거로 표현하지 않는 것

| 항목 | 담당 | 근거 |
|------|------|------|
| 8버킷 분해의 **정확성** | 서비스(계산 엔진) | CHECK는 합만 검증한다. 야간·휴일 경계 판정은 규칙 엔진의 책임이다 |
| 사업 단위 통합 여부 | **선언 + 서버 경고** | 자동 합산은 법적 판단이라 DB가 강제할 수 없다 |
| PII 복호화 4요건 | 서비스 + audit_logs 트리거 | 재인증·1회성 응답은 DB 밖의 상태다 |
| 파일 다운로드 인가 | S3 정책 + 서비스 + 1회용 토큰 | RLS·트리거는 메타 행만 다룬다 |
| 알림 생성 실패의 비롤백 | 서비스(별도 트랜잭션) | 트랜잭션 경계 설계다 |
| 급여 확정 중 입력 변경 차단 | advisory lock + guard_locked_period() | 잠금은 트리거가 아니라 서비스가 획득한다 |
| 미리보기 결과의 오용 | **저장하지 않음** | payroll_previews를 만들지 않으면 오용 경로 자체가 없다 |

전체 한계 등재의 정본은 [07_constraints_integrity.md](./07_constraints_integrity.md)의 "제약으로 표현할 수 없는 것" 절이다.

---

## 관련 문서

- 폴더 정본·접근 모델 → [README.md](./README.md)
- 전역 ERD·관계 요약 → [erd.md](./erd.md)
- 제약·불변식·동시성 잠금 전수 → [07_constraints_integrity.md](./07_constraints_integrity.md)
- RLS 정책·헬퍼 44종 시그니처 → [08_rls_policies.md](./08_rls_policies.md)
- 마이그레이션 배치(V0300 triggers) → [10_migrations_seed.md](./10_migrations_seed.md)
- 상태 머신 다이어그램 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
- 급여 엔진 파이프라인 → [../04_architecture/06_payroll_engine.md](../04_architecture/06_payroll_engine.md)
