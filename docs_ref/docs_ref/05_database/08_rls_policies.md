# 08_rls_policies — RLS 정책 정본

> **대상**: insadesk — public 61테이블의 RLS 정책 **173개**(SELECT 61 · INSERT 61 · UPDATE 46 · DELETE 5) · 앱 롤 · 헬퍼 함수 **44종** · GUC 주입 계약 **5종**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **V0741** 반영 — **#83 work_schedules_select · #92 leave_requests_select · #86 leave_types_select**에 sys()를 결합해 읽기 축이 23정책 24참조 → **26정책 27참조**가 된다. rollupAttendanceDaily가 편성 · 승인 휴가를 읽지 못해 **정기작업이 만든 일 집계가 편성 없이 NORMAL**로 굳고 근태 마감이 스케줄 누락으로 막히던 결함이며, 요청 경로의 재집계가 관리자 컨텍스트로 통과해 가려졌다. ALTER POLICY라 **정책 173은 불변**
> **개정일**: 2026-09-16 — **V0740** 반영 — **#146 audit_logs_select**의 action IN 목록이 데이터 축 4 → **5**로 넓어져 개방 34 → **35종**이 된다(**list.export** — 채번 정본 [15_system.md](./15_system.md)). 목록 공통 내보내기(DSH-06)의 반출 기록이며 그 사업장 관리자의 행위 · workplace_id 격리 · 전후값이 조건의 모양뿐이라 개방의 전제 셋을 만족한다. **민감 목록(list.export_sensitive)은 열지 않는다** — 개인정보 접근 축이다. **ALTER POLICY라 정책 수 · 봉인 칸 · 헬퍼 수는 움직이지 않는다.** 같은 날 idempotency_records 절의 "멱등 표면 10건" 인용을 걷는다(일괄 승인·반려로 14가 됐다 — 수는 정본 [../06_api/01_conventions.md](../06_api/01_conventions.md)가 갖는다)
> **개정일**: 2026-09-10 — **V0736** 반영 — **#146 audit_logs_select**의 action IN 목록이 인사 축 5 → **6**으로 넓어져 개방 33 → **34종**이 된다(**contract.cancel** — 채번 정본 [15_system.md](./15_system.md)). **근로계약 취소(../06_api/05_hr.md #23)의 사유가 어디에도 남지 않고 있었다** — 표면이 reason을 필수로 받는데 contracts에 사유 열이 없고 상태만 CANCELLED로 바뀌며 감사 기록도 없어, **되돌릴 수 없는 작업의 사유가 검증만 되고 소멸했다**(REQ-GLB-17 위반 · 2026-09-10 실측). 계약 도메인의 action 코드가 집합에 **하나도 없던 것**이 그 형태다. 취소는 그 사업장 관리자의 행위이고 workplace_id로 격리되며 전후값이 상태 문자열뿐이라 개방의 전제 셋을 만족한다. **사유 필수로 두지 않는다** — 사유는 표면이 필수로 강제하며 감사 배열에서 다시 강제하면 정본이 둘이 된다(compliance_task.waive · 근태 대리 제출과 같은 근거다). **ALTER POLICY라 정책 173 · 봉인 칸 · 헬퍼 44 · 사유 필수 16항목 27코드는 전건 불변**이다
> **개정일**: 2026-09-10 — **V0735** 반영 — 헬퍼 말미 채번 **#45 workplace_member_email(wid, user_id)** — 헬퍼 43 → **44종** · DB 함수 104 → **105** · 실측 pg_proc 105 → **106**. **명세서의 대체 교부 경로(EMAIL)가 수신 주소를 얻지 못하고 있었다** — 주소가 profiles.recovery_email인데 #4 profiles_select의 축이 본인과 플랫폼(user:view) 둘뿐이라 발행(06_api/09 #6)도 정기작업(#18)도 그 축에 걸리지 않아 **조회가 언제나 0행**이었고 그 채널의 교부는 한 번도 성립하지 않았다(2026-09-10 실측). **정책에 sys()를 결합하지 않고 헬퍼를 둔다** — 필요한 것은 주소 한 값인데 정책을 열면 이름·전화까지 담은 표가 서버 전용 경로 전체에 열린다. **#9 · #10 · #43과 같은 형태**이며 복구 이메일을 정의자 함수로 내는 것도 #36 · #44가 이미 쓴 축이다. **멤버십 status를 좁히지 않는 것이 판단**이다 — 퇴직월 명세서의 교부 의무는 퇴사로 사라지지 않으므로 ACTIVE로 좁히면 그 달의 대체 교부가 통째로 성립하지 않는다. **정책 173 · 봉인 칸 · GUC 5종은 전건 불변**(함수 신설)
> **개정일**: 2026-09-10 — **#158 export_jobs_select에 서버 컨텍스트 축(sys())을 더한다**(V0734 · ALTER POLICY라 **정책 173은 불변**). INSERT·UPDATE는 서버 표식을 보는데 SELECT만 보지 않아 **서버 전용 러너가 방금 INSERT한 작업 행을 같은 컨텍스트로 읽지 못했다** — 감사 내보내기 3단(202 → 폴링 → 1회용 토큰)이 1단에서 영영 PENDING으로 남는 결함(2026-09-10 웹 세션 실측 · pg_policies 대조). 쓰기 정책이 보는 축을 읽기 정책이 빠뜨린 형태라, 같은 표의 세 정책이 같은 주체 집합을 보는지가 검사 축이다
> **개정일**: 2026-09-10 — 시스템 콘솔 **#10 보조 비밀번호 재설정의 대행 방식 확정**(복구 이메일 대리 등록 · 표면 정본 [../06_api/14_system.md](../06_api/14_system.md)) 반영 — 헬퍼 말미 채번 **#44 issue_assisted_password_reset(target_user_id, recovery_email)** — 헬퍼 42 → **43종** · DB 함수 103 → **104** · 실측 pg_proc 104 → **105**. **#36이 복구 이메일 미등록 계정을 0행으로 배제하는데 #10의 대상이 정확히 그 집합**이라, 등록과 발급을 나누면 **등록된 복구 이메일만 있고 토큰이 없는 창**이 열린다. **#36을 넓히지 않고 별도 함수로 둔다** — 대상 집합이 겹치지 않는 쌍이라 합치지 않으며 #30 · #42가 같은 형태다. **GUC를 늘리지 않는다 — 주입 계약 5종은 불변**이고 정책 173 · 봉인 칸도 불변이다(함수 신설). 마이그레이션 번호는 **배정 전**이다
> **개정일**: 2026-09-09 — **V0727** 반영 — **#26 workplace_members_select**에 sys()를 결합해 읽기 축이 21/22 → **22정책 23참조**가 된다. **읽기의 종류가 하나 늘었다 — 산출물 수신자를 열거하는 질의**이며, 앞의 다섯이 전부 계산 성립 전의 읽기인 것과 달리 이것은 계산이 끝난 뒤의 읽기다. checkComplianceDeadlines가 과제를 감지하고 정상 종료하는데 **알림만 0건**이라 실행 이력에 SUCCEEDED + 정상 target_count 로 남고, 드러나는 자리가 **"법정 신고 기한을 아무도 통보받지 못했다"**이며 그것은 기한이 지난 뒤다 — V0723보다 한 단계 더 조용하다. **"배치가 읽는 것은 셋이다"로 축을 닫고 있던 문장을 판정 기준으로 바꿨다**(그 질의가 0행일 때 배치의 어느 단계가 성립하지 않는가). **작업별 표와 정책 전수 표 둘 다** 고쳤다 — 그 절이 스스로 등재한 자리다. **ALTER POLICY라 정책 수 · 봉인 칸은 바뀌지 않는다**
> **개정일**: 2026-09-09 — **V0726** 반영 — 헬퍼 말미 채번 **#41 suspend_account · #42 unsuspend_account · #43 last_payroll_confirmed_at** — 헬퍼 39 → **42종** · DB 함수 100 → **103** · 실측 pg_proc 101 → **104**. 시스템 콘솔 제재 표면의 **쓰기 축이 구조와 스키마 양쪽에서 막혀 있었다** — users 는 앱 롤 grant 가 0건이라 경로가 정의자 함수뿐인데 정지 함수가 아예 없고 해제는 **기한 경과분만** 되돌리는 #30 하나뿐이었다. **#43은 정책을 열지 않고 헬퍼를 둔 자리**다(#9 · #10과 같은 형태 — 값 하나를 위해 급여 실행 행 전체를 열지 않는다). **#26에 플랫폼 축 perm('workplace:view')도 결합**했다 — 콘솔이 사업장도 사용자도 보는데 그 둘을 잇는 표만 못 봤다. 가드 둘의 예외 축(강제 삭제의 소유 사업장 · 강제 폐쇄의 보존 안내 확인)은 [09_functions_triggers.md](./09_functions_triggers.md)가 정본이다. **GUC 를 늘리지 않았다 — 주입 계약 5종은 불변**이고, ALTER POLICY 와 함수 신설이라 **정책 수 · 봉인 칸도 불변**이다. VOLATILE 축 서술이 V0709 이후 갱신되지 않은 채 폐지분 27을 세고 있던 것도 함께 고쳤다 — **번호 열거를 걷고 판정 기준으로 바꿨다**
> **개정일**: 2026-09-08 — 표기 규약에 **규약이 있다는 사실이 그 규약을 지키게 하지 않는다**를 실측으로 등재한다 — 규약 등재 이후에도 #74 · #80이 전수 표에 실리지 않은 채 두 회차를 지났고, **결합을 더할 때 고칠 자리가 둘**(읽기 축 절의 표 · 정책 전수 표)임을 명시했다. 정책 수·검산은 전건 불변
> **개정일**: 2026-09-08 — **V0725** 반영 — 급여 3정책(**#106 · #109 · #112**)에 sys()를 결합해 읽기 축이 18/19 → **21정책 22참조**가 된다. 셋 다 **retryPayslipAndPush**가 읽으며 도메인 축으로는 **급여 0 → 3**이다 — **읽는 배치가 아니라 테이블의 도메인**으로 세는 규약의 두 번째 적용례다. **ALTER POLICY라 정책 수 · 봉인 칸은 바뀌지 않는다.** **#114 pvr_select를 열지 않은 이유**(검증 결과는 확정 흐름이 보는 것이고 명세서 재생성이 읽지 않는다)와 **쓰기 축과의 대칭이 근거가 아니라는 것**을 절에 등재했다 — 넷 중 셋만 열려 있으므로 적어 두지 않으면 다음 사람이 정합성을 맞춘다며 넷째를 연다. **전수 표의 인라인 결합 표기가 #74 · #80에서 빠져 있던 것**(V0720 · V0723 반영 누락)도 함께 채웠고, 표기 규약의 보정분 번호 열거를 걷었다 — 보정이 늘 때마다 그 목록이 틀린다
> **개정일**: 2026-09-08 — **V0720 · V0722 · V0723** 반영. ① V0720이 **#173 attendance_breaks_delete**를 신설해 정책 수가 하나 늘고 DELETE 정책이 하나 늘며 **봉인 칸이 하나 열린다** — 술어가 **is_auto인 행만 · 서버 컨텍스트에서만**이라 사용자가 기록한 휴게는 어떤 경로로도 지워지지 않는다. 앱 롤 DELETE grant도 한 테이블 늘었다. ② V0720이 **#80 apc_select**에, V0723이 **#74 ads_select**에 각각 sys()를 결합해 **읽기 축이 둘 늘었다** — 둘 다 ALTER POLICY라 **정책 수는 바뀌지 않는다.** ③ V0722가 **#146**의 action IN 목록을 근태·휴가 축 10 → **12**로 넓혔다(개방 **33종** · 채번 정본 [15_system.md](./15_system.md)) — 역시 ALTER POLICY라 **정책 수는 바뀌지 않는다.** 읽기 축 절의 등급 차이(**계산 입력이 0행이면 계산이 0을 내는 것이 아니라 틀린 값을 낼 수 있다**)를 같은 절에 등재했다
> **개정일**: 2026-09-07 — **V0718** 반영 — **#146 audit_logs_select**의 action IN 목록이 데이터 축 3 → **4**로 넓어져 개방 30 → **31종**이 된다(**compliance_task.waive** — 채번 정본 [15_system.md](./15_system.md)). 기한 과제 면제는 그 사업장 관리자의 행위이고 workplace_id로 격리되며 PII 원문을 담지 않아 개방의 전제 셋을 만족한다. **사유 필수로 두지 않는다** — 면제 사유는 compliance_tasks.waived_reason이 표면 계약으로 필수이고 열도 실재하므로, 감사 배열에서 다시 강제하면 정본이 둘이 된다(근태 대리 제출과 같은 근거다). **ALTER POLICY라 정책 172 · 봉인 72 · 헬퍼 39 · 사유 필수 15항목 26코드는 전건 불변**이다
> **개정일**: 2026-09-07 — **V0716** 반영 — 헬퍼 말미 채번 **#40 sign_contract(contract_id, signer_user_id, signed_at, signature_hash, terms_confirmed, ip, user_agent)** — 헬퍼 38 → **39종** · DB 함수 99 → **100** · 실측 pg_proc 100 → **101**. **본인 서명이 RLS에 막혀 있었다** — #25가 STAFF 본인의 SENT → SIGNED 전이인데 **#62 contracts_update가 admin 축 하나뿐**이라 UPDATE가 0행이 됐고, 증적 INSERT는 정책 술어가 signer_user_id = uid라 통과하므로 **증적만 남고 상태가 안 바뀌는 중간 상태**가 만들어질 수 있었다. 정의자 롤에 contracts SELECT·UPDATE · contract_signatures INSERT grant를 함께 열었다 — **BYPASSRLS는 정책 평가를 건너뛸 뿐 테이블 권한을 대신하지 않는다**(V0712 ①과 같은 형태다). **정책 172 · 봉인 72 · GUC 5종은 전건 불변**이다 — 이 전이에는 행위자를 알아야 판정이 달라지는 가드가 없어 새 주입 축이 필요하지 않다
> **개정일**: 2026-09-07 — **V0715** 반영 — **#146 audit_logs_select**의 action IN 목록이 근태·휴가 축 7 → **10**으로 넓어져 개방 27 → **30종**이 된다(attendance_record.approve · attendance_record.reject · attendance_change_request.proxy_submit — 채번 정본 [15_system.md](./15_system.md)). 셋 다 그 사업장 관리자의 행위이고 workplace_id로 격리되며 PII 원문을 담지 않아 개방의 전제 셋을 만족한다. **셋은 사유 필수가 아니다** — 대리 제출의 사유는 attendance_change_requests.reason이 NOT NULL로 강제하므로 감사 배열에서 다시 강제하면 정본이 둘이 되고, 승인·반려는 정상 업무라 사유를 요구하면 형식적 입력만 쌓인다. **ALTER POLICY라 정책 172 · 봉인 72 · 헬퍼 38 · 사유 필수 15항목 26코드는 전건 불변**이다
> **개정일**: 2026-09-07 — **V0714** 반영 — 헬퍼 **#36 issue_password_reset**의 반환을 text → **TABLE(token text, recipient_email text)**로 개정한다. V0709가 **발송 경로의 절반만 열었다** — 토큰은 돌려주는데 수신 주소가 없어, 아이디 축 요청은 그 계정의 복구 이메일을 읽을 자리가 미인증 경로에 없다(profiles SELECT는 본인·플랫폼 조회 권한 둘뿐이고 users는 앱 롤 grant가 0건이다). 결과로 **토큰만 적재되고 메일이 나가지 않았다.** **DROP 후 같은 이름·같은 인자로 다시 만들었으므로 헬퍼 38 · DB 함수 99 · 실측 100 · 정책 172 · 봉인 72는 전건 불변**이며, 소유자·실행 권한을 함께 재설정했다
> **개정일**: 2026-09-07 — **V0711 · V0712** 적용 — ① V0711이 idempotency_records를 신설해 대상 테이블 60 → **61** · 정책 169 → **172**(말미 채번 **#170 idempotency_records_select · #171 …_insert · #172 …_update**) · 봉인 칸 71 → **72**. 늘어난 봉인 칸은 **DELETE 하나**이고 **DELETE 정책 4는 불변**이다 — 부분 UNIQUE가 DISCARDED를 빼 물리 삭제 없이 재시도를 열므로 삭제 표면 자체가 필요 없다(테이블 정본 [17_infra.md](./17_infra.md)). **시스템 컨텍스트 축도 두지 않는다** — 멱등 표면은 전부 사용자 요청 경로라 정기작업이 부르는 자리가 없고, 배치가 읽지 않는 것은 배치에 열지 않는다. ② V0712가 **#146 audit_logs_select**의 action IN 목록을 넓혔다 — 사업장·멤버 5 → **7**(workplace.close · business_unit.declare 흡수 · 개방 25 → **27종**. 채번 정본 [15_system.md](./15_system.md)). **ALTER POLICY라 정책 수를 바꾸지 않는다** — 172는 V0711만의 결과다. ③ 전수 절 헤딩 넷이 정책 수 요약 표와 갈라져 있었다(말미 채번 #161~#169를 헤딩이 세지 않았다) — 사업장 23 → **24** · 휴가 14 → **17** · 급여 16 → **18** · 인프라 6 → **9**이고, 인프라는 이번 3행을 더해 **12**다
> **개정일**: 2026-09-07 — 보정 **V0710** 적용 — ① 서버 배치 읽기 축에 **#20 workplaces_select · #23 business_units_select** 결합(읽기 축 14 → **16정책** · 참조 15 → **17**). V0708이 계산 입력을 고쳤을 때 **대상 열거의 입력**은 함께 다뤄지지 않아 recomputeEmployeeCountSnapshot이 계산할 사업장을 하나도 찾지 못했다 — 같은 형태를 두 번 놓친 원인(배치의 두 축을 각각 세지 않았다)을 읽기 축 절에 등재했다. ② 헬퍼 말미 채번 **#39 close_workplace(workplace_id, reason)** — app.workplace_close_context를 켜는 함수가 없어 **읽는 헬퍼는 있고 켜는 쪽이 없던** 상태였다(REQ-WRK-36). 헬퍼 37 → **38종** · DB 함수 98 → **99** · 실측 pg_proc 99 → **100**. **정책 169 · 봉인 71 · GUC 5종은 전건 불변**(①은 ALTER POLICY · ②는 함수 신설)
> **개정일**: 2026-09-07 — 인증 쓰기 서버 함수 6종 신설·1종 폐지(보정 V0709) — 헬퍼 32 → **37종** · DB 함수 93 → **98**. users·password_reset_tokens는 앱 롤 grant가 0건이라 **가입·비밀번호 변경·재설정 확정·탈퇴·정지 만료 열거의 쓰기 경로가 전부 부재했다**(구현 착수 시 로컬 PostgreSQL 18 실측 — 서버 전용 표식을 켜도 권한 층에서 막힌다). 말미 채번 **#33~#38**로 create_user_credentials · update_user_password · consume_password_reset · issue_password_reset · mark_user_deleted · expired_suspension_user_ids를 등재하고, **#27 request_password_reset을 폐지**한다 — #36이 같은 일을 하되 평문 토큰을 반환해 메일 발송이 성립한다. **ID는 재사용하지 않는다.** password_reset_tokens에 정의자 롤 SELECT·UPDATE grant를 함께 추가했다. **정책 169 · 봉인 71 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-07 — 서버 배치 읽기 축 실측 정합(pg_policy 카탈로그 전수 대조) — 이 문서가 규정한 **14정책 중 4정책에 sys() 결합이 적용 스키마에 없었다**(#43 employees_select · #49 employment_terms_select · #68 attendance_records_select · #71 attendance_breaks_select). 보정 **V0708**이 넷을 ALTER POLICY로 맞췄고 적용 후 14정책 전건 결합을 실측 확인했다 — 나머지 10정책(#29 · #139 · #89 · #95 · #97 · #162 · #124 · #127 · #116 · #121)은 보정 전에도 전건 결합돼 있었다. 전수 표 USING 4행에 결합형을 등재하고, **쓰기 축이 열려 있어 배치가 SUCCEEDED + target_count 0으로 끝나 실행 이력에 드러나지 않는 형태**임을 읽기 축 절에 등재. 같은 절 도입 문장의 15개 정책 → **14정책**(참조 15) 표기 정정. 나머지 10정책의 결합도 전수 표에 인라인으로 등재해 **읽기 축 14정책의 표기를 통일**했다 — 절에 서술만 두고 표를 비워 두는 구조가 4정책 누락을 지나가게 한 원인이므로 **표기 규약을 절에 명문화**하고, 도입 문장을 결합한다 → **결합돼 있다** 상태 서술로 바꿨다. 두 sys() 축(읽기 14 · 쓰기 반환 4)의 강조를 전부 걷어 **전수 표의 sys() 표기를 평문으로 통일**하고 쓰기 반환 축 절에도 같은 표기 규약을 등재 — 굵게가 개정 이력을 담으면 다음 개정마다 걷어내야 한다(강조 규약은 ID · 수치 변화의 새 값 · 반직관적 사실 · 금지 서술 · 신설 항목에 한정한다). 같은 논리로 이전 개정이 남긴 #6 · #31의 sys() 강조도 함께 정리했다 — **신설 정책 행(#161 · #165 · #166)의 행 단위 강조는 축이 달라 유지**한다. **표현식 변경이라 정책 169 · 봉인 71 · 헬퍼 32종 · 검산 14정책 15참조는 전건 불변**
> **개정일**: 2026-09-07 — 정책 표현식 실측 정합(pg_policy 카탈로그 대조) — 보정 V0703·V0705·V0707이 문서에 내려오지 않아 USING 4행이 실제와 어긋나 있었다. #38 wecs_select · #41 ecsd_select에 **sys() 결합**(V0707) · #142 system_admins_select에 **본인 행 축 user_id = uid 결합**(V0703) · #146 audit_logs_select에 **sys() 결합**(V0705). 네 보정의 공통 원인을 **쓰기 반환 축 — RETURNING이 요구하는 SELECT 가시성 4지점** 절로 신설 등재(#38 · #41 · #146 · #167 · V0706의 반환 제거도 같은 뿌리 · 현행 축의 saveAndFlush와 @GeneratedValue 조합이 같은 구문을 쓰므로 되돌리지 않는다). **넷 다 표현식 변경이라 정책 169 · 봉인 71 · 헬퍼 32종은 전건 불변**
> **개정일**: 2026-09-06 — 실측 정합(로컬 PostgreSQL 18에 db_migration V0001~V0707 전량 적용 후 카탈로그 대조) — 보정 V0704·V0706의 **append_audit_log**를 헬퍼 말미 채번 **#32**로 등재 — 헬퍼 31 → **32종** · DB 함수 92 → **93**. 휘발성 서술을 조회 축 STABLE · 쓰기 축 5종 VOLATILE로 정밀화. 가드 내부 술어 is_sync_user_id_update는 정의자 함수가 아니고 정책이 부르는 자리도 없어 **헬퍼로 세지 않고 각주로 둔다**(실측 pg_proc 94 = 정본 93 + 술어 1). **정책 169 · GUC 5종 · 봉인 매트릭스는 전건 불변**
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — GUC 주입 주체를 NestJS 요청 트랜잭션 → **DataSource 프록시의 트랜잭션 진입 주입**으로(ADR-28) · ORM 클라이언트 확장 래핑 서술을 **단일 주입 지점·트랜잭션 필수·연결 초기화 구문 금지**로 대체 · GUC 표 app.current_user_id 행의 주입 주체 셀 요청 인터셉터 → **DataSource 프록시**(주입 자리와 값 출처를 분리 표기 — 나머지 4행의 호출 지점 주입은 불변). **GUC 5종 · set_config 형태 · 정책 169 · 헬퍼 31종은 전건 불변**
> **개정일**: 2026-08-20 — 인증 서버 함수 4종 신설(보정 V0702) — 헬퍼·서비스 27 → **31종**(auth_credentials_of · account_status_of · reactivate_expired_suspension · create_bootstrap_admin). 구현 검증 실측: 앱 롤 grant 0 설계에서 로그인 자격 조회·상태 재조회·정지 복귀·부트스트랩의 정의자 경로가 부재했다. 미인증 경로 서술 26·27 → **26~28**로 갱신(28의 열거 차단은 앱 계층 등시간 검증 계약)
> **개정일**: 2026-08-20 — #167 sjr_select USING에 시스템 컨텍스트 축 결합 — perm('audit:view') → perm('audit:view') **OR sys()**. 배치가 자기 RUNNING 행을 닫지 못하는 결함 보정(UPDATE의 WHERE 열 참조와 INSERT … RETURNING에 SELECT 가시성이 함께 필요해 #168·#169의 sys() 의도와 모순). 구현 검증 중 실측 발견, 보정 마이그레이션 V0701. 정책 수 **169** 불변
> **개정일**: 2026-08-19 — GUC 주입 형태 서술의 잔재 정정 — 세 GUC → **다섯 GUC**(표·검산은 이미 5종)
> **개정일**: 2026-08-08 — DB 커버리지 감사 통합 반영 — 테이블 58 → **60** · 정책 160 → **169**(신설 9 · 표현식 정정 11) · 헬퍼 22 → **27** · GUC 3 → **5** · **헬퍼 정의자 롤 insadesk_helper 신설**(FORCE RLS 아래에서 SECURITY DEFINER만으로는 재귀가 끊기지 않는다) · DELETE 정책 1 → **4**
> **개정일**: 2026-08-08 — GUC 주입 SQL을 set_config(트랜잭션 지역 · 값 바인드) 형태로 정정 · 신뢰 가드 계층 3계층 + 클라이언트 보조 명시(D-20)
> **개정일**: 2026-08-03 — 테이블 58종 × 4명령 봉인 매트릭스 신설(정책 160 + 봉인 72 = 232) · 자기포함 확정 OWNER 전용 서술 · 정책 #142 SUPER_ADMIN 전용 키 명시
> **원천**: docs_ref2/schema_p0.md — 설계 원칙(RLS = 2단 방어 · ENABLE + FORCE · 기본 거부) · RLS 헬퍼 함수 · 롤·권한 분리 · 각 테이블 명세의 RLS 절 · [../README.md](../README.md) 전역 불변식(멀티테넌트 격리 · 본인 소유권 인가)

접근 통제의 정본이다. **61테이블 전부 ENABLE + FORCE ROW LEVEL SECURITY**이며 **기본 거부**다 — 정책이 없는 명령은 접근할 수 없다.

**RLS는 2단 방어의 두 번째 층이다.** 서비스 레이어가 1차로 검증하고 RLS가 심층방어로 행 단위 격리를 강제한다. 클라이언트 가드는 보조이며 어느 판정의 근거도 되지 않는다.

**본 문서는 to-be 설계 명세다.** 정책 표현식은 구현이 따라야 할 계약으로 확정 기술하며, 구현 후 실측으로 승격한다.

---

## 표기 규약

| 표기 | 뜻 |
|------|-----|
| **—** | 그 명령의 정책이 **없다**. RLS는 정책 없는 명령을 기본 거부하므로 대시는 "그 명령이 봉인돼 있다"는 뜻이다 |
| uid | (select current_user_id()) — 서브쿼리로 감싸 initplan 캐싱을 유도하는 관용구. **전 정책이 이 형태를 쓴다** |
| sys() | (select is_system_context()) — 서버 전용 경로 |
| member(w) | (select is_workplace_member(w, uid)) |
| admin(w) | (select is_workplace_admin(w, uid)) — OWNER 또는 MANAGER |
| owner(w) | (select is_workplace_owner(w, uid)) |
| writable(w) | (select is_workplace_writable(w)) — CLOSED·SUSPENDED면 false |
| self_emp(e) | (select is_self_employee(e)) — **멤버십·사업장 상태를 보지 않는다** |
| sysadmin() | (select is_system_admin(uid)) |
| perm(p) | (select has_system_permission(p, uid)) |
| USING / WITH CHECK | 각각 "읽을 수 있는 행" / "쓸 수 있는 결과 행"의 조건. UPDATE는 양쪽을 모두 명시한다 |

- **UPDATE는 USING과 WITH CHECK를 모두 갖는다.** WITH CHECK가 없으면 변경 **후** 행이 정책 밖으로 나가는 것을 막지 못한다 — workplace_id를 타 사업장으로 바꾸는 UPDATE가 USING만으로는 통과한다.
- **fail-closed**: GUC가 주입되지 않으면 current_user_id()가 NULL이고 헬퍼가 false·빈 집합을 반환해 모든 행이 비가시가 된다.
- **비소유 행은 0행으로 반환된다** — 거부가 아니라 부재로 보이므로 존재 자체가 노출되지 않는다. 앱은 404로 통일해 표면화한다.

---

## 앱 롤과 롤 분리

| 항목 | 규약 |
|------|------|
| 마이그레이션 소유자 | 애플리케이션 접속 롤과 **분리한다** |
| 앱 롤 insadesk_app | LOGIN + **NOSUPERUSER + NOBYPASSRLS**. 테이블 소유자가 아니다 |
| **헬퍼 정의자 롤 insadesk_helper** | **BYPASSRLS + NOLOGIN**. 헬퍼·서비스 함수 44종의 소유자이며 **로그인 경로가 없어 접속 자체가 불가능하다**. 이 롤만 FORCE RLS를 통과한다 |
| RLS 활성화 | 모든 public 테이블에 **ENABLE + FORCE ROW LEVEL SECURITY**. **앱 롤 insadesk_app의 우회 경로가 없다** |
| grant | 필요한 SELECT·INSERT·UPDATE를 명시 grant하고, **DELETE는 재계산·재산정 교체 4테이블에만** 준다. DDL·소유자 권한은 주지 않는다 |
| 서버 전용 테이블 | users · password_reset_tokens는 직접 grant 없이 SECURITY DEFINER 함수로만 접근한다 |
| 비밀번호 | versioned migration은 앱 롤 비밀번호를 설정하지 않는다(환경별 secret provisioning) |

- **FORCE가 없으면 테이블 소유자로 접속하는 순간 RLS가 통째로 무력해진다.** 소유자와 앱 롤을 분리하고 FORCE를 켜는 두 조치가 함께 있어야 우회 경로가 사라진다.
- **그런데 FORCE는 SECURITY DEFINER 함수에도 그대로 적용된다.** 정의자가 테이블 소유자여도 정책이 다시 평가되므로, 정책이 헬퍼를 호출하고 헬퍼가 그 테이블을 읽는 구조는 **무한 재귀**가 된다 — 정책 #26(workplace_members) ↔ is_workplace_member() · 정책 #142(system_admins) ↔ has_system_permission()이 그 구조다.
- **그래서 정의자 롤을 세 번째 축으로 분리한다.** insadesk_helper는 BYPASSRLS를 갖되 NOLOGIN이라 그 권한이 함수 본문 밖으로 나가지 않는다. 앱 롤은 함수를 EXECUTE할 뿐이고, 함수가 무엇을 반환하는지는 함수 본문이 정한다 — **권한 상승 경로는 함수의 반환 타입만큼만 넓다**.
- 헬퍼 정의자 롤이 없으면 남는 선택지는 FORCE를 끄는 것뿐인데, 그 순간 마이그레이션 소유자 접속이 전 테이블을 여는 우회 경로가 된다.
- 여기서 말하는 **소유자는 PostgreSQL 객체 소유권**이며 사업장 역할값 OWNER와 다른 축이다. 역할값은 전 문서에서 대문자로만 표기한다.
- 앱 롤에 DELETE를 주지 않는 것이 "업무·법정 보존행은 지워지지 않는다"는 설계의 물리적 근거다 — 정책이 아니라 grant가 막는다.

---

## 헬퍼 함수 44종

전 함수 **SECURITY DEFINER + SET search_path = ''**이며 **소유자는 insadesk_helper**다. **상태를 바꾸는 것과 시각에 의존하는 조회만 VOLATILE**이고 나머지는 STABLE이다 — **어느 번호가 그것인지를 목록으로 닫지 않는다**(쓰기 축 헬퍼가 늘 때마다 그 목록이 틀리는데 드러날 자리가 없다. 실측 근거 — V0709가 쓰기 헬퍼 6종을 더한 뒤에도 이 문장이 5종을 세고 있었고 그 열거에 폐지분 27이 남아 있었다). **시각에 의존하는 조회는 #38 하나**이며 그것이 "조회인데 STABLE이 아닌" 유일한 자리다. 스키마 주입을 막고, RLS 재귀를 막고, 실행계획을 공유한다. PUBLIC EXECUTE를 회수하고 앱 롤에만 재부여한다.

**정책 안에서는 (select fn(...)) 로 감싼다** — initplan 캐싱을 유도해 행마다 재평가되는 것을 막는다.

```sql
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT nullif(current_setting('app.current_user_id', true), '')::uuid $$;
```

| # | 함수 | 반환 | 용도 |
|---|------|------|------|
| 1 | **current_user_id()** | uuid | 현재 인증 주체. 미주입 시 NULL → 기본 거부 |
| 2 | **is_system_context()** | boolean | app.system_context = 'on'. 서버 전용 테이블·배치 경로 |
| 3 | **is_invitation_accept_context()** | boolean | accept_workplace_invitation() 내부에서만 켜는 플래그. 클라이언트 직접 ACCEPT 우회와 구분한다 |
| 4 | **is_workplace_member(wid, uid)** | boolean | ACTIVE 멤버 여부. **profiles.status = 'ACTIVE'가 아니면 false** — 정지·탈퇴가 즉시 RLS에 반영된다 |
| 5 | **workplace_role_of(wid, uid)** | workplace_role | 활성 역할(없으면 NULL) |
| 6 | **is_workplace_admin(wid, uid)** | boolean | OWNER 또는 MANAGER |
| 7 | **is_workplace_owner(wid, uid)** | boolean | OWNER |
| 8 | **is_workplace_writable(wid)** | boolean | status IN ('ACTIVE','PENDING_VERIFICATION'). **CLOSED·SUSPENDED면 false** → 신규 업무 생성 차단 |
| 9 | **owned_workplace_count(uid)** | integer | OWNER인 ACTIVE + PENDING_VERIFICATION + SUSPENDED 사업장 수. **CLOSED 제외** |
| 10 | **active_member_count(wid)** | integer | ACTIVE 멤버(OWNER·MANAGER·STAFF 전원) 수 |
| 11 | **is_self_employee(employee_id)** | boolean | **employees.user_id = current_user_id(). 멤버십·사업장 상태를 보지 않는다 — CMP-07 인가의 정본 헬퍼** |
| 12 | **is_self_employee_in_workplace(wid, employee_id, uid)** | boolean | 위 + 사업장 소속 확인(workplace 스코프 병용 테이블) |
| 13 | **employee_belongs_to_workplace(wid, employee_id)** | boolean | 테넌트 오염 차단 |
| 14 | **is_period_locked(wid, pay_period)** | boolean | attendance_period_closings.status = 'LOCKED' |
| 15 | **is_run_confirmed(run_id)** | boolean | 확정 불변 가드 |
| 16 | **is_system_admin(uid)** | boolean | 플랫폼 관리자(만료 역할 제외) |
| 17 | **system_role_of(uid)** | system_role | 최고 레벨 역할(ACTIVE 프로필만 인정) |
| 18 | **has_permission(role, perm)** | boolean | 역할별 **명시 화이트리스트**. 리터럴 와일드카드 없음, 미정의 키 기본 거부 |
| 19 | **has_system_permission(perm, uid)** | boolean | 16·18의 조합 |
| 20 | **list_workplace_members(wid)** | SETOF record | 동료 공개 디렉토리(이름·아바타·역할). **연락처·민감정보를 반환 타입에 담지 않는다** |
| 21 | **distance_meters(lat1, lng1, lat2, lng2)** | double precision | haversine 지오펜스 거리. numeric 입력을 함수 내부에서만 double로 캐스팅한다 |
| 22 | **is_invitation_target(target_username, target_phone)** | boolean | 본인 대상 초대 판정. username 일치 **또는** 프로필 phone 일치이며, 미가입 상태로 받은 초대가 가입 후 이어지려면 두 축이 모두 필요하다 |
| 23 | **accept_workplace_invitation(invitation_id, actor_user_id)** | void | 초대 수락 원자 처리 |
| 24 | **is_workplace_close_context()** | boolean | 폐쇄 서버 함수가 트랜잭션 안에서만 켜는 플래그. 읽기 전용 가드의 멤버십 종료 예외를 판정한다 |
| 25 | **is_workplace_reverify_context()** | boolean | 재검증 정정 서버 함수 전용 플래그. 불변 3필드 정정의 두 조건 중 하나다 |
| 26 | **is_username_available(username)** | boolean | 미인증 아이디 중복 확인. **가용 여부만 반환**해 계정 존재 여부의 추가 정보를 주지 않는다 |
| 27 | ~~request_password_reset(username_or_email)~~ | — | **폐지(보정 V0709 · DROP)**. 반환이 void라 평문 토큰이 나오지 않아 메일 발송이 성립하지 않았다 — 같은 일을 하되 토큰을 반환하는 **#36**이 대체한다. **ID를 재사용하지 않는다** |
| 28 | **auth_credentials_of(username)** | 자격 행(식별자 · 해시 · 상태 · 정지 기한·사유) | 로그인 자격 검증 전용(보정 V0702). DELETED 포함 전 상태를 반환하고 상태 분기는 로그인 절차가 맡는다. 미존재·공백 입력은 0행 — **열거 차단은 앱 계층의 더미 해시 등시간 검증과 응답 통일(auth.invalid_credentials)이 담당**한다 |
| 29 | **account_status_of(user_id)** | (상태 · 정지 기한) | 가드의 매 요청 상태 재조회(REQ-AUT-13) · refresh 회전 차단 · 세션 조회 표면용. 자격을 반환하지 않는 최소 표면이다 |
| 30 | **reactivate_expired_suspension(user_id)** | boolean | 정지 기한 경과 시에만 ACTIVE 복귀 + account_status_events 1행(경과 기한 보존 · actor NULL). 행 잠금으로 동시 호출의 이벤트 중복을 차단한다. 로그인 절차와 정기작업 autoUnsuspendAccounts가 공용한다 |
| 31 | **create_bootstrap_admin(username, password_hash, name, reason)** | uuid | 유효 플랫폼 관리자 0명일 때만 초기 SUPER_ADMIN을 원자 생성(users → profiles → system_admins → audit_logs, actor_role 'BOOTSTRAP' · 사유 필수). 기동 부트스트랩 전용이며 2회째 호출은 예외다 |
| 32 | **append_audit_log(actor_id, actor_role, workplace_id, action, target_type, target_id, before_value, after_value, reason, ip, user_agent)** | void | 감사 로그 1행 추가 전용(보정 V0704 신설 → V0705 철회 → V0706 재신설). audit_logs의 INSERT 정책 #147은 sys() 단일 조건인데 실 앱 경로에서 app.system_context 주입이 신뢰되지 않아, GUC와 무관한 정의자 경로로 대체했다. **RETURNING을 두지 않아 반환이 void다** — RETURNING은 삽입 행의 SELECT 가시성을 별도로 요구하므로 uuid를 돌려주려던 V0704의 첫 형태가 그 자리에서 막혔다. action 공백은 함수가 거부한다 |
| 33 | **create_user_credentials(username, password_hash)** | uuid | 가입의 users INSERT 전용(보정 V0709). **중복을 미리 조회해 판정하지 않는다** — UNIQUE 위반을 그대로 올려 앱의 제약 이름 매핑(users_username_key → auth.username_taken/409)이 받는다. 미리 조회하면 확인과 삽입 사이의 경합에서 통과가 갈린다. profiles · user_consents는 호출부가 같은 트랜잭션에서 넣는다 |
| 34 | **update_user_password(user_id, password_hash)** | boolean | 비밀번호 변경(#10)과 재설정 확정(#12) 공용. DELETED 계정은 대상이 아니라 거짓이다 |
| 35 | **consume_password_reset(token_hash)** | uuid | 재설정 토큰의 1회 소비. **만료 · 사용완료 · 불일치를 구분하지 않고 전부 NULL**이다 — 구분하면 "그 토큰은 있지만 이미 썼다"가 새어 토큰 존재가 드러난다. 소비와 판정이 한 UPDATE 문장이라 동시 호출에서 두 번 소비되지 않는다 |
| 36 | **issue_password_reset(username_or_email)** | **TABLE(token text, recipient_email text)** | 미인증 재설정 요청. **#27을 대체한다.** 원문 토큰은 반환값과 발송 채널에만 존재하고 저장은 SHA-256 해시뿐이다. 미존재 · DELETED · **복구 이메일 미등록은 0행**이며 **그 사실이 응답으로 새지 않는다** — 받는 것은 서버이고 사용자 응답은 어느 경우에도 202로 통일한다. 수신 주소를 함께 돌려주는 근거는 아래 절이다(V0714) |
| 37 | **mark_user_deleted(user_id)** | boolean | 탈퇴의 users 축. **소유 사업장을 다시 판정하지 않는다** — guard_account_deletion_blocked()가 이미 막으므로 판정을 두 곳에 두지 않는다. 프로필 비식별화 · 남은 멤버십 LEFT 전이 · 컨텍스트 폐기는 호출부가 같은 트랜잭션에서 수행한다(REQ-AUT-21) |
| 38 | **expired_suspension_user_ids()** | setof uuid | 정기작업 autoUnsuspendAccounts의 대상 열거. 복귀 처리는 **#30**이 단건으로 하며 행 잠금과 이벤트 중복 차단이 거기 있다 — 열거와 처리를 나눈 이유다 |
| 39 | **close_workplace(workplace_id, reason)** | boolean | 사업장 폐쇄(보정 V0710). **app.workplace_close_context를 켜고** 상태 전이와 OWNER 멤버십 종료(LEFT)를 한 트랜잭션에 묶는다 — 나누면 지연 가드가 잔존 ACTIVE 멤버십을 거부해 폐쇄 자체가 성립하지 않는다. **선행조건 5종은 판정하지 않는다**(업무 규칙이라 서비스 계층의 몫이고, 여기 넣으면 판정이 두 곳에 생긴다). 이미 CLOSED면 거짓 — 재폐쇄를 성공으로 돌려주면 호출부가 감사와 알림을 두 번 남긴다. SECURITY DEFINER라 **실행자가 그 사업장 멤버가 아니어도 성립한다**(REQ-WRK-36이 강제 폐쇄 경로에 요구하는 성질) |
| 40 | **sign_contract(contract_id, signer_user_id, signed_at, signature_hash, terms_confirmed, ip, user_agent)** | boolean | 본인 전자서명(V0716). **증적 INSERT와 SENT → SIGNED 전이를 한 함수 경계에 묶는다** — 둘이 갈리면 "서명했는데 SENT인 계약"과 "증적 없는 SIGNED"가 각각 생기고 둘 다 근로기준법 §17② 교부의 증적을 무너뜨린다. **인가를 새로 만들지 않는다** — guard_contract_signature_insert()가 계약 상태 · 서명자 일치 · pdf_hash 일치를 BEFORE INSERT에서 검증하고 **트리거는 롤과 무관하게 돌므로 정의자 함수가 RLS를 지나가도 그 판정은 그대로 선다.** 이 함수가 얹는 것은 원자성뿐이다 |
| 41 | **suspend_account(user_id, reason, suspended_until, actor_id)** | boolean | 플랫폼 계정 정지(V0726). 전이 · 프로필 동기화 · account_status_events 1행을 한 함수 경계에 묶는다 — **이벤트의 INSERT 정책이 sys() 단일**이라 요청 경로에서 따로 켤 자리가 없기 때문이며 #30이 이미 그 형태다. ACTIVE가 아니면 거짓이고 사유 공백은 거부한다 |
| 42 | **unsuspend_account(user_id, reason, actor_id)** | boolean | 관리자의 기한 전 수동 해제(V0726). **기한을 보지 않는 것이 #30과 갈리는 지점**이다 — #30은 기한 경과분만 되돌리므로 **제재를 앞당겨 푸는 경로가 없었다.** 두 함수의 대상 집합이 겹치지 않아 하나로 합치지 않는다 |
| 43 | **last_payroll_confirmed_at(workplace_id)** | timestamptz | 시스템 콘솔 사업장 상세의 최근 급여 확정 시각(V0726). **정책을 열지 않고 헬퍼를 둔다** — 콘솔에 필요한 것은 시각 하나인데 #106을 플랫폼 축으로 열면 급여 실행 행 전체(집계 금액 포함)가 플랫폼 운영자에게 열린다. **#9 · #10과 같은 형태**이며 그 셋이 "값 하나를 위해 표를 열지 않는다"의 실례다 |
| 44 | **issue_assisted_password_reset(target_user_id, recovery_email)** | **TABLE(token text, recipient_email text)** | 보조 재설정의 **복구 이메일 대리 등록과 토큰 발급을 한 트랜잭션에 묶는다**(표면 정본 [../06_api/14_system.md](../06_api/14_system.md) #10). **#36과 대상 집합이 겹치지 않는다** — #36은 복구 이메일이 있는 계정이고 이쪽은 없는 계정이다. 등록은 recovery_email IS NULL · status = 'ACTIVE'인 profiles 행만 갱신하는 **조건부 UPDATE**라 동시 호출에서 두 번 등록되지 않는다. 원문 토큰은 반환값과 발송 채널에만 존재하고 저장은 SHA-256 해시뿐이다. **security_events 1행(kind = 'PASSWORD_RESET' · result = 'SUCCESS')을 같은 경계에서 남긴다** — 그 INSERT 정책이 sys() 단일이라 요청 경로에서 따로 켤 자리가 없다(#41과 같은 형태). **부적격은 0행이고 사유를 가르지 않는다** — 인증된 플랫폼 표면이라 은닉 축이 아니며 코드 배정은 표면 정본이 한다 |
| 45 | **workplace_member_email(wid, user_id)** | text | 대체 교부 경로(EMAIL)의 수신 주소(V0735 · 표면 정본 [../06_api/09_payslip.md](../06_api/09_payslip.md) #17). **#4 profiles_select에 sys()를 결합하는 대신 둔 자리**다 — 필요한 것은 주소 한 값인데 정책을 열면 이름·전화를 담은 표가 서버 전용 경로 전체에 열린다(#9 · #10 · #43과 같은 형태). 축은 **서버 컨텍스트 하나**다 — 부르는 자리가 발행(#6)과 정기작업(#18) 둘뿐이고, 관리자 축을 함께 열면 사업장 관리자 세션이 동료 연락처를 읽는 경로가 생긴다. **멤버십 status를 좁히지 않는다** — 퇴직월 명세서의 교부 의무는 퇴사로 사라지지 않으므로 ACTIVE로 좁히면 그 달의 대체 교부가 성립하지 않는다. 소속 이력이 없거나 서버 컨텍스트가 아니면 NULL이다 |

검산: 컨텍스트 **5**(1~3 · 24 · 25) + 멤버십 7(4~10) + 소유권 3(11~13) + 상태 2(14~15) + 플랫폼 4(16~19) + 조회·계산 3(20~22) + 트랜잭션·서버 2(23 · 26) + **인증 조회 서버 4(28~31 — V0702)** + **감사 기록 1(32 — V0706)** + **인증 쓰기 서버 6(33~38 — V0709)** + **사업장 폐쇄 서버 1(39 — V0710)** + **전자서명 서버 1(40 — V0716)** + **시스템 콘솔 서버 3(41~43 — V0726)** + **보조 재설정 서버 1(44)** + **대체 교부 수신 주소 1(45 — V0735)** = **44**. 27은 폐지분이라 세지 않는다(ID 재사용 금지).

- **헬퍼가 SECURITY DEFINER인 것만으로는 RLS 재귀가 끊기지 않는다.** 정책이 workplace_members를 조회하면 그 테이블 자신의 정책이 다시 평가되는데, FORCE 아래에서는 정의자가 소유자여도 정책 대상이라 재귀가 그대로 성립한다 — **재귀를 끊는 것은 BYPASSRLS를 가진 정의자 롤 insadesk_helper**다.
- **26 · 28 · 36이 미인증 경로의 접근 수단 전부다.** users·password_reset_tokens에는 앱 롤 grant가 없고, 그 대안으로 app.system_context를 미인증 경로에서 켜면 두 테이블이 통째로 열린다 — 정의자 함수가 그 경로를 대신한다. 26은 반환을 boolean으로 좁혀 계정 존재가 응답으로 새지 않고, **28(로그인 자격)은 행을 반환하므로 열거 차단이 앱 계층 계약으로 이전된다** — 미존재 0행 + 더미 해시 등시간 검증 + auth.invalid_credentials 통일 응답(REQ-AUT-10). **36은 평문 토큰과 수신 주소를 반환하지만 받는 것이 서버**라 열거 축이 아니다 — 미존재·부적격은 0행으로 정상 종료하고 사용자 응답은 어느 경우에도 202다. 29~31 · 33~35 · 37 · 38 · 44는 인증 후·서버 내부 경로라 이 축에 속하지 않는다 — **44는 평문 토큰을 반환하되 부르는 것이 플랫폼 지원 담당의 인증된 요청**이고 그 표면의 인가는 user:reset_password가 판정한다.
- **앱 롤 grant 0건은 정책이 아니라 권한 층의 차단이다.** users·password_reset_tokens는 RLS 정책을 갖되 앱 롤에 테이블 권한 자체가 없어 **서버 전용 표식을 켜도 열리지 않는다**(구현 착수 시 로컬 PostgreSQL 18 실측 — insadesk_app으로 SELECT 시 42501). 그래서 이 두 테이블에 닿는 모든 경로가 정의자 함수여야 하며, 33~38이 그 나머지 절반(쓰기)을 채운다.
- **is_workplace_member가 profiles.status를 보는 것이 설계의 핵심 연결이다** — users.status → sync_account_status() → profiles.status → 헬퍼 → 전 정책. 계정 정지가 한 컬럼 갱신으로 전 사업장의 행 가시성을 즉시 닫는다.
- **가드 내부 술어 is_sync_user_id_update(old, new)는 헬퍼로 세지 않는다.** 정책이 부르는 자리가 없고 SECURITY DEFINER도 아니며 소유자도 insadesk_helper가 아니다 — 봉인 가드 3종과 확정 가드 2종이 계정 연결 지연 전파(sync_user_id) 경로만 통과시키려고 공유하는 조건식이라, 헬퍼 축에도 트리거 함수 61종 축에도 속하지 않는다. 실측 pg_proc 검산: 헬퍼 44 + 트리거 함수 61 + 내부 술어 1 = **106**이며 정본 계수는 **105**다. 술어의 판정 로직 정본은 [09_functions_triggers.md](./09_functions_triggers.md)다.
- accept_workplace_invitation()은 함수 초반에 actor_user_id = current_user_id()를 강제해 앱 롤 직접 호출도 fail-closed다. 처리 순서는 사업장 advisory lock → 한도 재검증 → 멤버십 ACTIVE 생성 또는 LEFT 재활성화 → employees 초안 → 초대 ACCEPTED → 알림이다.

### #40을 정책 확장이 아니라 서버 함수로 둔 이유 (V0716)

**본인 서명 경로가 막혀 있었다.** #25(본인 계약 서명)는 STAFF 본인이 SENT → SIGNED 전이를 일으키는데 **#62 contracts_update의 축이 admin 하나뿐**이라 UPDATE가 0행이 된다. 증적 INSERT(#64)는 정책 술어가 signer_user_id = uid라 통과하므로, **증적만 남고 상태가 안 바뀌는 중간 상태**가 만들어질 수 있었다.

| 대안 | 판정 |
|------|------|
| #62에 본인 가지를 더한다 | **버린다** — 한 전이를 위해 STAFF에게 contracts UPDATE를 **상시 열게** 되고, 그 뒤로는 guard_contract_transition() 하나에만 기대게 된다 |
| 서버 함수로 묶는다 | **채택** — 원자성이 함수 경계로 보장되고 쓰기 표면이 열리지 않는다 |

- **원자성이 이 선택의 첫째 근거다.** 증적과 전이가 갈리면 "서명했는데 SENT인 계약"과 "증적 없는 SIGNED"가 각각 생기고, **둘 다 근로기준법 §17② 교부의 증적을 무너뜨린다.**
- **인가를 새로 만들지 않는다.** guard_contract_signature_insert()가 계약이 SENT인지 · 서명자가 그 직원의 계정인지 · pdf_hash가 일치하는지를 BEFORE INSERT에서 전부 검증한다. **트리거는 롤과 무관하게 돌므로 정의자 함수가 RLS를 지나가도 그 판정은 그대로 선다** — 이 함수는 기존 판정 위에 원자성만 얹는다.
- **GUC를 새로 만들지 않는다.** 폐쇄와 달리 이 전이에는 **행위자를 알아야 판정이 달라지는 가드가 없다** — guard_contract_transition()은 상태 기계만 본다. 주입 계약 **5종은 불변**이다.
- **정의자 롤 권한을 함께 열었다** — contracts SELECT·UPDATE · contract_signatures INSERT다. **BYPASSRLS는 정책 평가를 건너뛸 뿐 테이블 권한을 대신하지 않으므로**, 함수를 늘리면 그 함수가 참조하는 객체의 grant도 함께 늘린다(V0712 ①이 같은 형태의 결함이었다).

### #36이 수신 주소를 함께 돌려주는 이유 (V0714)

**V0709가 발송 경로의 절반만 열었다.** 토큰은 돌려주는데 **그 토큰을 어디로 보낼지가 없다.**

| 요청 축 | 발송 성립 여부(V0714 이전) |
|---------|---------------------------|
| 이메일로 요청 | 성립한다 — 입력값 자체가 수신 주소다 |
| **아이디로 요청** | **성립하지 않는다** — 그 계정의 복구 이메일을 읽어야 하는데 profiles SELECT 정책의 축이 본인과 플랫폼 조회 권한 둘뿐이라 **미인증 경로에서는 읽을 자리가 없다.** users는 앱 롤에 테이블 권한 자체가 없다 |

결과로 아이디 축 요청은 **토큰만 적재되고 메일이 나가지 않았다** — 사용자는 202를 받고 아무것도 오지 않으며, 데이터베이스에는 **아무에게도 가지 않는 유효 토큰이 1시간 남는다.**

- **은닉은 여전히 응답이 담당한다.** 함수는 미존재·부적격에 0행을 돌려주지만 그것을 받는 것은 서버이고, 서버는 어느 경우에도 202를 통일해 낸다. **수신 주소가 반환에 실려도 미인증 클라이언트는 그 값을 볼 수 없다** — 반환 타입이 넓어진 것과 열거 표면이 열린 것은 다른 축이다.
- **복구 이메일이 없으면 토큰을 만들지 않는다.** REQ-AUT-15가 미등록 계정의 구제 경로를 플랫폼 지원 담당의 보조 재설정으로 정했으므로, **발송할 수 없는 토큰을 적재하는 것은 만료를 기다리는 유효 자격 증명을 남기는 것일 뿐이다.** 판정 자리는 이 함수 안이다.
- **반환 타입이 바뀌므로 CREATE OR REPLACE가 성립하지 않는다** — DROP 후 다시 만들고 소유자·실행 권한을 재설정한다. 이름과 인자가 같아 **헬퍼 수 · DB 함수 수는 불변**이다.

### #44를 #36의 확장이 아니라 별도 함수로 둔 이유

**#36은 복구 이메일이 있는 계정만 대상으로 삼는다** — 미등록은 0행이며 그 배제가 REQ-AUT-15의 계약이다. **보조 재설정의 대상은 정확히 그 0행 집합이다.**

| 대안 | 판정 |
|------|------|
| #36의 조건을 넓혀 등록까지 겸하게 한다 | **버린다** — 미인증 표면과 플랫폼 표면이 한 함수를 공유하게 되고, **"복구 이메일 미등록은 0행"이 조건부가 되어 그 계약의 강제 지점이 사라진다.** 반환의 은닉 요구도 두 표면이 서로 다르다 |
| 표면이 등록과 발급을 두 번 호출한다 | **버린다** — 두 호출 사이에 **등록된 복구 이메일만 있고 토큰이 없는 창**이 열린다. 그 창은 정상 재설정 경로가 이미 열린 상태이고, 발급이 실패해도 등록은 되돌아가지 않는다 |
| 별도 서버 함수로 묶는다 | **채택** — 원자성이 함수 경계로 보장되고 #36의 배제 판정이 그대로 선다 |

- **대상 집합이 겹치지 않는 쌍이라 합치지 않는다.** #30(기한 경과분 자동 복귀)과 #42(기한 전 수동 해제)가 같은 형태이며, 거기서 쓴 근거를 여기서 다시 쓴다.
- **정의자 경로 말고 다른 자리가 없다.** password_reset_tokens는 앱 롤 grant가 0건이고, profiles UPDATE 정책의 축은 본인과 서버 둘뿐인데 **지원 담당은 대상 계정 본인이 아니다.** 사용자 요청 경로에서 app.system_context를 켜면 users · password_reset_tokens가 통째로 열린다.
- **GUC를 새로 만들지 않는다.** 이 경로에는 **행위자를 알아야 판정이 달라지는 가드가 없다** — profiles_guard()는 본인 UPDATE 축의 id · username · status 변경만 보고 recovery_email을 보지 않으며, guard_reset_token_consume()은 used_at 전이 축이다. 주입 계약 **5종은 불변**이다.
- **정의자 롤 권한을 함께 연다** — profiles UPDATE · password_reset_tokens INSERT · security_events INSERT다. **BYPASSRLS는 정책 평가를 건너뛸 뿐 테이블 권한을 대신하지 않으므로**, 함수를 늘리면 그 함수가 참조하는 객체의 grant도 함께 늘린다.
- **판정을 함수에 넣지 않는다.** 대상 부재 · 정지 · 삭제 · 이미 등록은 표면이 서로 다른 코드로 갈라야 하는데 함수는 0행 하나로만 답한다. 함수의 조건부 UPDATE는 **그 판정의 재현이 아니라 경합 차단**이다 — 사전 판정과 갱신 사이에 등록이 끼어들어도 두 번째 호출이 0행으로 끝난다.
- **상태 축을 users가 아니라 profiles에서 본다.** sync_account_status()가 users.status를 profiles.status로 내리고 전 헬퍼가 그 컬럼을 평가하므로, 같은 축을 쓰면 계정 상태가 RLS에 반영되는 통로와 이 함수의 판정이 갈리지 않는다.
- **security_events의 ip · user_agent를 채우지 않는다.** 그 열의 뜻은 "그 계정의 사용자가 어디서 무엇으로 했는가"인데 이 사건의 조작 주체는 지원 담당이다 — 지원 담당의 지문을 대상 계정 이벤트에 담으면 침해 조사에서 본인 접속으로 읽힌다. **행위자 축은 audit_logs.actor_id가 갖는다.**

---

## 정책 전수 173개

전역 통번호 1~173이며 도메인 그룹 순서는 도메인 파일 번호(01~06 → 11~17)를 따른다.

### 계정 (01_auth) — 19

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 1 | users | users_select | SELECT | sys() OR **perm('user:view')** | — |
| 2 | users | users_insert | INSERT | — | sys() |
| 3 | users | users_update | UPDATE | sys() | sys() |
| 4 | profiles | profiles_select | SELECT | id = uid OR **perm('user:view')** | — |
| 5 | profiles | profiles_insert | INSERT | — | sys() |
| 6 | profiles | profiles_update | UPDATE | id = uid OR sys() | id = uid OR sys() |
| 7 | terms_documents | terms_documents_select | SELECT | **true** | — |
| 8 | terms_documents | terms_documents_insert | INSERT | — | perm('settings:update') |
| 9 | terms_documents | terms_documents_update | UPDATE | perm('settings:update') | perm('settings:update') |
| 10 | user_consents | user_consents_select | SELECT | user_id = uid OR sys() | — |
| 11 | user_consents | user_consents_insert | INSERT | — | sys() |
| 12 | user_consents | user_consents_update | UPDATE | user_id = uid | user_id = uid |
| 13 | account_status_events | account_status_events_select | SELECT | user_id = uid OR sysadmin() | — |
| 14 | account_status_events | account_status_events_insert | INSERT | — | sys() |
| 15 | security_events | security_events_select | SELECT | user_id = uid OR sysadmin() | — |
| 16 | security_events | security_events_insert | INSERT | — | sys() |
| 17 | password_reset_tokens | password_reset_tokens_select | SELECT | sys() | — |
| 18 | password_reset_tokens | password_reset_tokens_insert | INSERT | — | sys() |
| 19 | password_reset_tokens | password_reset_tokens_update | UPDATE | sys() | sys() |

- profiles의 SELECT는 **본인 축 + 플랫폼 조회 권한 축** 둘뿐이다 — **동료 공개정보는 정책이 아니라 list_workplace_members() 함수가 반환**하며, 그 반환 타입에 연락처가 없다. 플랫폼 축이 없으면 사용자 관리 화면(SYS-04)이 app.system_context 전면 개방에 의존하게 된다.
- 6의 서버 축이 없으면 sync_account_status()의 profiles UPDATE가 **0행 갱신으로 조용히 실패**해 정지·탈퇴가 전 사업장의 행 가시성에 반영되지 않는다 — 계정 상태가 RLS로 내려가는 유일한 통로가 이 한 줄이다.
- user_consents의 UPDATE 정책은 행을 좁힐 뿐이고 **revoked_at 1회 전이 제한은 guard_consent_mutation() 트리거가 강제한다.** 정책은 컬럼 단위 제한을 표현하지 못한다.
- terms_documents의 SELECT가 true인 이유는 약관이 미인증 사용자에게도 공개되어야 하기 때문이다.

### 사업장·멤버 (02_workplace) — 24

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 20 | workplaces | workplaces_select | SELECT | sys() OR member(id) OR perm('workplace:view') | — |
| 21 | workplaces | workplaces_insert | INSERT | — | sys() |
| 22 | workplaces | workplaces_update | UPDATE | admin(id) OR perm('workplace:suspend') OR **perm('workplace:unsuspend')** OR **perm('workplace:close')** | 동일 |
| 23 | business_units | business_units_select | SELECT | sys() OR owner_user_id = uid OR EXISTS(소속 workplace admin) OR sysadmin() | — |
| 24 | business_units | business_units_insert | INSERT | — | owner_user_id = uid AND declared_by = uid |
| 25 | business_units | business_units_update | UPDATE | owner_user_id = uid | owner_user_id = uid |
| 26 | workplace_members | workplace_members_select | SELECT | sys() OR admin(workplace_id) OR user_id = uid OR perm('workplace:view') | — |
| 27 | workplace_members | workplace_members_insert | INSERT | — | **(admin(workplace_id) AND writable(workplace_id)) OR (accept_ctx() AND writable(workplace_id)) OR sys()** |
| 28 | workplace_members | workplace_members_update | UPDATE | **admin(workplace_id) OR user_id = uid OR accept_ctx() OR close_ctx() OR sys()** | **동일** |
| 29 | workplace_invitations | workplace_invitations_select | SELECT | admin(workplace_id) OR (status = 'PENDING' AND **is_invitation_target(target_username, target_phone)**) OR sys() | — |
| 30 | workplace_invitations | workplace_invitations_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 31 | workplace_invitations | workplace_invitations_update | UPDATE | admin(workplace_id) OR **is_invitation_target(…)** OR sys() | 동일 |
| 32 | workplace_change_logs | workplace_change_logs_select | SELECT | **admin(workplace_id)** | — |
| 33 | workplace_change_logs | workplace_change_logs_insert | INSERT | — | sys() |
| 34 | membership_role_events | membership_role_events_select | SELECT | admin(workplace_id) OR member_user_id = uid | — |
| 35 | membership_role_events | membership_role_events_insert | INSERT | — | sys() |
| 36 | business_verification_logs | business_verification_logs_select | SELECT | admin(workplace_id) OR perm('verification:view') | — |
| 37 | business_verification_logs | business_verification_logs_insert | INSERT | — | sys() |
| 38 | workplace_employee_count_snapshots | wecs_select | SELECT | sys() OR admin(workplace_id) OR sysadmin() | — |
| 39 | workplace_employee_count_snapshots | wecs_insert | INSERT | — | sys() |
| 40 | workplace_employee_count_snapshots | wecs_update | UPDATE | sys() | sys() |
| 41 | employee_count_snapshot_days | ecsd_select | SELECT | sys() OR admin(workplace_id) | — |
| 42 | employee_count_snapshot_days | ecsd_insert | INSERT | — | sys() |
| **161** | employee_count_snapshot_days | **ecsd_delete** | **DELETE** | **sys() AND EXISTS(부모 스냅샷의 confirmed_at IS NULL)** | — |

- **workplaces의 SELECT는 비멤버에게 행 존재조차 노출하지 않는다.** 사업자등록번호로 타사 사업장을 탐지하는 경로를 막는다.
- **22가 제재 3키를 모두 인용하는 이유는 권한 화이트리스트와의 정합이다** — 정지·해제·강제 폐쇄가 각각 다른 키인데 정책이 suspend 하나만 인용하면 나머지 둘이 정책 표면에서 소비되지 않는 키가 된다. 액션별 판정은 서비스가 하고 정책은 행 가시성만 연다.
- **workplace_change_logs의 SELECT는 관리자 전용이다** — REQ-WRK-11이 STAFF에게 변경 이력과 변경자를 노출하지 않도록 명시 금지한다. STAFF가 출퇴근에 필요한 것은 이력이 아니라 workplaces 행의 현재값이며 그 SELECT(#20)가 이미 열려 있다.
- **workplace_members의 SELECT는 동료 축을 좁힌다** — 행에 leave_reason(제외 사유)·left_at·invited_by가 실려 있어 멤버 전체에게 열면 동료의 제외 사유가 노출된다. 동료 공개정보는 list_workplace_members()가 반환한다. **좁히는 대상은 동료이지 서버와 플랫폼이 아니다.**
- **26의 sys()와 perm('workplace:view')는 서로를 대신하지 않는다.** 플랫폼 축(V0726)은 **행위자가 있는 콘솔 조회**이고 서버 축(V0727)은 **행위자가 없는 배치**다 — 사업장도 사용자도 보는 콘솔이 그 둘을 잇는 표만 못 보면 정지 통보의 OWNER 수신자와 소속 사업장 요약이 0행이 되고(REQ-SYS-05 · REQ-NTF-05), 배치가 못 보면 기한 과제 알림의 수신자가 0행이 된다. **한 축을 열었다고 다른 축이 열리지 않는다.**
- workplace_invitations의 SELECT는 **타인 초대의 행 존재를 노출하지 않는다** — 본인 대상 PENDING만 보인다.
- **30의 표현식은 MANAGER와 OWNER를 구분하지 못한다** — "MANAGER는 STAFF만 초대한다"(REQ-WRK-12)는 정책이 아니라 guard_invitation_insert_role()이 강제한다. 정책은 컬럼 값(role)에 따라 역할 요구를 달리하는 조건을 표현하지 못하며, 이는 guard_role_change()가 멤버십 역할 축에서 맡는 것과 같은 구조다.
- **27·28의 서버·컨텍스트 축이 네 경로를 연다** — 등록 트랜잭션의 OWNER 멤버십 생성(등록자는 아직 멤버가 아니다) · 수락 트랜잭션의 LEFT 재활성화(수락자는 관리자가 아니다) · 본인 이탈과 탈퇴 · 폐쇄 트랜잭션의 일괄 종료(강제 폐쇄자는 사업장 멤버가 아니다)다. 관리자 축만 두면 넷이 전부 막힌다.
- **27의 수락 분기에 writable을 결합하는 괄호가 중요하다** — AND가 OR보다 강하게 결합해 원문은 (admin AND writable) OR accept_ctx로 읽혔고, 그 형태가 SUSPENDED 사업장의 초대 수락을 통과시켰다(REQ-WRK-18).
- **38·41의 sys() 축은 스냅샷 산정·확정이 전부 서버 컨텍스트이기 때문이다** — 쓰기(#39·#40·#42)가 이미 sys() 단독인데, 그 쓰기가 행을 돌려받는 순간 SELECT 가시성이 별도로 필요해진다(보정 V0707). 근거는 아래 쓰기 반환 축 절이다.
- **161이 재산정 교체의 유일한 경로다** — UNIQUE(workplace_id, base_date, scope)가 같은 키의 새 스냅샷을 막으므로 자식 시계열을 지우고 다시 넣는 것 말고는 재산정이 성립하지 않는다. USING이 미확정 스냅샷으로 좁히므로 확정분은 여전히 지워지지 않는다.

### 인사 (03_hr) — 25

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 43 | employees | employees_select | SELECT | sys() OR admin(workplace_id) OR **self_emp(id)** | — |
| 44 | employees | employees_insert | INSERT | — | **(admin(workplace_id) AND writable(workplace_id)) OR (accept_ctx() AND writable(workplace_id))** |
| 45 | employees | employees_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 46 | employee_personal_infos | epi_select | SELECT | admin(workplace_id) OR self_emp(employee_id) | — |
| 47 | employee_personal_infos | epi_insert | INSERT | — | admin(workplace_id) AND sys() |
| 48 | employee_personal_infos | epi_update | UPDATE | admin(workplace_id) AND sys() | admin(workplace_id) AND sys() |
| 49 | employment_terms | employment_terms_select | SELECT | sys() OR admin(workplace_id) OR self_emp(employee_id) | — |
| 50 | employment_terms | employment_terms_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 51 | employment_terms | employment_terms_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 52 | employee_insurance_infos | eii_select | SELECT | admin(workplace_id) OR self_emp(employee_id) | — |
| 53 | employee_insurance_infos | eii_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 54 | employee_insurance_infos | eii_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 55 | employee_insurance_histories | eih_select | SELECT | admin(workplace_id) | — |
| 56 | employee_insurance_histories | eih_insert | INSERT | — | sys() |
| 57 | contract_templates | contract_templates_select | SELECT | member(workplace_id) | — |
| 58 | contract_templates | contract_templates_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 59 | contract_templates | contract_templates_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 60 | contracts | contracts_select | SELECT | admin(workplace_id) OR (**self_emp(employee_id)** AND status IN ('SENT','SIGNED','ARCHIVED')) | — |
| 61 | contracts | contracts_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 62 | contracts | contracts_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 63 | contract_signatures | contract_signatures_select | SELECT | admin(workplace_id) OR signer_user_id = uid | — |
| 64 | contract_signatures | contract_signatures_insert | INSERT | — | **signer_user_id = uid** |
| 65 | documents | documents_select | SELECT | admin(workplace_id) OR (self_emp(employee_id) AND is_sensitive = false) OR (**category = 'PAYSLIP' AND user_id = uid**) | — |
| 66 | documents | documents_insert | INSERT | — | admin(workplace_id) OR sys() |
| 67 | documents | documents_update | UPDATE | admin(workplace_id) OR sys() | admin(workplace_id) OR sys() |

- **44의 수락 컨텍스트 축이 초대 수락 트랜잭션의 세 번째 단계를 연다** — REQ-WRK-16 ③이 수락과 같은 트랜잭션에서 employees 초안(hire_date NULL)을 만들도록 계약하는데 수락자는 STAFF·MANAGER 피초대자이고 admin이 아니다. **sys()를 쓰지 않는 이유는 이 경로가 사용자 요청 트랜잭션이기 때문이다** — app.system_context를 클라이언트 경로에서 켜면 users·password_reset_tokens가 통째로 열린다(같은 문서 GUC 절의 경고). #27·#28과 같은 패턴으로 컨텍스트 축을 쓰고 writable을 함께 결합한다.
- **60·65의 소유권 축이 멤버십을 요구하지 않는다** — 퇴사·폐쇄 후 보존기간 내 본인 열람이 CMP-07의 요구다. DRAFT·CANCELLED 계약은 관리자 전용이다.
- 64가 **본인만 INSERT**인 것이 전자서명의 성립 요건이다. 관리자가 대리 서명하는 경로를 정책이 막고, guard_contract_signature_insert()가 계약 상태·서명자 일치·pdf_hash를 다시 검증한다.
- 47·48의 sys() 결합은 **서버 암호화 경유**를 뜻한다 — 앱 롤이 평문을 직접 넣는 경로가 없다.
- **documents 정책이 열려 있어도 파일을 받을 수 있는 것은 아니다** — RLS는 메타 행 가시성만 담당하고 다운로드는 서비스 인가 + 1회용 토큰 + 서버 스트리밍이다.
- **43·49의 sys() 축은 정기작업이 계산 입력을 얻는 자리다** — recomputeEmployeeCountSnapshot이 employees · employment_terms를, accrueAndExpireLeave가 employees를 읽는다. 이 결합이 없으면 상시근로자 산정 자체가 성립하지 않는다. 적용 스키마에 결합이 없어 보정 V0708이 맞췄고 근거는 아래 서버 배치의 읽기 축 절이다.

### 근태 (04_attendance) — 19

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 68 | attendance_records | attendance_records_select | SELECT | sys() OR admin(workplace_id) OR **user_id = uid** | — |
| 69 | attendance_records | attendance_records_insert | INSERT | — | (user_id = uid AND member(workplace_id) AND writable(workplace_id)) OR sys() |
| 70 | attendance_records | attendance_records_update | UPDATE | **(user_id = uid AND status = 'OPEN' AND member(workplace_id) AND writable(workplace_id)) OR admin(workplace_id) OR sys()** | **(user_id = uid AND status IN ('OPEN','COMPLETED')) OR admin(workplace_id) OR sys()** |
| 71 | attendance_breaks | attendance_breaks_select | SELECT | sys() OR admin(workplace_id) OR user_id = uid | — |
| 72 | attendance_breaks | attendance_breaks_insert | INSERT | — | (user_id = uid AND member(workplace_id) AND writable(workplace_id)) OR sys() |
| 73 | attendance_breaks | attendance_breaks_update | UPDATE | **(user_id = uid AND break_end IS NULL AND member(workplace_id) AND writable(workplace_id)) OR sys()** | **(user_id = uid) OR sys()** |
| 74 | attendance_daily_summaries | ads_select | SELECT | sys() OR admin(workplace_id) OR user_id = uid | — |
| 75 | attendance_daily_summaries | ads_insert | INSERT | — | sys() |
| 76 | attendance_daily_summaries | ads_update | UPDATE | sys() | sys() |
| 77 | attendance_change_requests | acr_select | SELECT | admin(workplace_id) OR user_id = uid | — |
| 78 | attendance_change_requests | acr_insert | INSERT | — | (user_id = uid AND member(workplace_id)) OR admin(workplace_id) |
| 79 | attendance_change_requests | acr_update | UPDATE | admin(workplace_id) OR (user_id = uid AND status = 'PENDING') | admin(workplace_id) OR (user_id = uid AND status = 'CANCELLED') |
| 80 | attendance_period_closings | apc_select | SELECT | sys() OR admin(workplace_id) | — |
| 81 | attendance_period_closings | apc_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 82 | attendance_period_closings | apc_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 83 | work_schedules | work_schedules_select | SELECT | sys() OR admin(workplace_id) OR self_emp(employee_id) | — |
| 84 | work_schedules | work_schedules_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 85 | work_schedules | work_schedules_update | UPDATE | admin(workplace_id) | admin(workplace_id) |

- **68·71·74·77의 SELECT는 멤버십을 요구하지 않는다**(user_id = uid 단독). 근태 이력은 본인의 근로 사실 기록이므로 퇴사 후에도 조회된다. **반면 INSERT·UPDATE는 ACTIVE 멤버십 + 사업장 writable을 요구한다** — 읽기와 쓰기의 축이 다르다.
- **68·71의 sys() 축은 본인 축과 근거가 다르다** — rollupAttendanceDaily가 근태 원본을 읽는 자리이며, 이 결합이 없으면 쓰기 축(#75·#76)이 열려 있어도 일 집계가 대상 0건으로 끝난다. 적용 스키마에 결합이 없어 보정 V0708이 맞췄고 근거는 아래 서버 배치의 읽기 축 절이다.
- **70·73의 본인 UPDATE 축이 없으면 퇴근과 휴게 종료가 서버 컨텍스트를 요구한다.** 퇴근은 OPEN → COMPLETED의 UPDATE이고 휴게 종료는 break_end 기록의 UPDATE인데, 가장 빈번한 사용자 경로에서 app.system_context를 켜면 users·password_reset_tokens가 함께 열린다. 시각은 서버가 찍고 상태 전이는 guard_attendance_status_transition()이 강제하므로 본인 축을 열어도 값 조작 경로는 생기지 않는다.
- **70의 관리자 축은 PENDING 승인·반려를 표현한다**(REQ-ATT-04) — 같은 성격의 #79가 이미 관리자 축을 갖고 있어 두 정책의 방어 층을 맞춘다.
- 69의 GPS 체크인은 **kind = LOCATION 동의 유무를 정책이 보지 않는다** — 다른 테이블 조회가 필요하므로 guard_location_consent_required()가 맡는다.
- 79의 WITH CHECK가 STAFF의 결과 상태를 CANCELLED로 못박는다. 승인·반려로 바꾸는 것은 관리자 분기만 통과한다.
- REOPENED 전이의 OWNER 제한과 급여 미확정 조건은 guard_closing_transition() 트리거가 강제한다 — 정책은 컬럼 값 조건을 표현하기에 부적절하다.

| **173** | **attendance_breaks** | **attendance_breaks_delete** | **DELETE** | **is_auto AND sys()** | — |

- **173은 롤업이 만든 자동 차감분을 걷어내는 자리다.** REQ-ATT-06이 자동 차감분을 롤업 시점에 만들라고 하는 근거가 **사후 수정 요청 승인으로 재실 구간이 바뀔 때 차감분이 따라오게 하는 것**인데, 삭제 축이 없어 롤업은 한 번 만든 행을 걷어낼 수 없었고 **계약이 요구한 그 성질이 성립하지 않았다.** **갱신으로는 닫히지 않는다** — 재실 구간이 나뉘거나 합쳐지면 행 수가 달라지는데 UPDATE는 개수를 바꾸지 못한다.
- **술어를 둘로 좁힌 것이 요점이다** — **is_auto인 행만** 그리고 **서버 컨텍스트에서만**이다. 직원이 기록한 휴게(is_auto = false)는 어떤 경로로도 지워지지 않고 사용자 요청 경로에는 삭제가 열리지 않는다.
- **물리 삭제 표면을 만들지 않는다는 규약과 어긋나지 않는다.** 그 규약이 막는 것은 **업무 기록**의 삭제이고 DELETE 정책 다섯은 전부 **재계산·재산정 교체이거나 권한 회수**다. 자동 차감분은 원본이 아니라 **롤업이 계산한 파생 행**이라 같은 부류다.

### 휴가 (05_leave) — 17

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 86 | leave_types | leave_types_select | SELECT | sys() OR member(workplace_id) **OR EXISTS(본인 leave_requests·leave_grants가 참조하는 유형)** | — |
| 87 | leave_types | leave_types_insert | INSERT | — | admin(workplace_id) OR sys() |
| 88 | leave_types | leave_types_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 89 | leave_grants | leave_grants_select | SELECT | admin(workplace_id) OR user_id = uid OR sys() | — |
| 90 | leave_grants | leave_grants_insert | INSERT | — | sys() |
| 91 | leave_grants | leave_grants_update | UPDATE | sys() | sys() |
| 92 | leave_requests | leave_requests_select | SELECT | sys() OR admin(workplace_id) OR user_id = uid | — |
| 93 | leave_requests | leave_requests_insert | INSERT | — | user_id = uid AND member(workplace_id) AND writable(workplace_id) |
| 94 | leave_requests | leave_requests_update | UPDATE | admin(workplace_id) OR (user_id = uid AND status = 'PENDING') | admin(workplace_id) OR (user_id = uid AND status = 'CANCELLED') |
| 95 | leave_transactions | leave_transactions_select | SELECT | admin(workplace_id) OR user_id = uid OR sys() | — |
| 96 | leave_transactions | leave_transactions_insert | INSERT | — | sys() |
| 97 | leave_balances | leave_balances_select | SELECT | admin(workplace_id) OR user_id = uid OR sys() | — |
| 98 | leave_balances | leave_balances_insert | INSERT | — | sys() |
| 99 | leave_balances | leave_balances_update | UPDATE | sys() | sys() |
| **162** | employee_protected_periods | **epp_select** | SELECT | admin(workplace_id) OR **user_id = uid** OR sys() | — |
| **163** | employee_protected_periods | **epp_insert** | INSERT | — | (admin(workplace_id) AND writable(workplace_id)) OR sys() |
| **164** | employee_protected_periods | **epp_update** | UPDATE | admin(workplace_id) OR sys() | admin(workplace_id) OR sys() |

- 원장(leave_transactions)에 UPDATE 정책이 없는 것이 "원장이 진실 원천"의 물리적 표현이다.
- 89·95·97의 본인 SELECT는 user_id 비정규화 컬럼을 쓴다 — employees를 조인하면 그 테이블의 정책이 다시 평가된다.
- **86에 본인 축을 더한 이유는 반쪽 인가를 막기 위해서다** — 신청·발생·원장·잔액의 SELECT가 전부 user_id = uid로 멤버십을 보지 않는데 유형만 member() 단독이면 퇴사자에게 유형 명칭과 유급 여부가 0행이 된다.
- **162의 본인 축도 같은 계열이다** — 출산전후휴가·육아휴직 기간은 본인의 근로 사실 기록이고 연차 발생의 근거이므로 퇴사 후에도 조회된다. **DELETE 정책은 두지 않는다** — 정리는 end_date 확정이며 확정된 과거 구간은 연차 발생의 근거라 지우지 않는다.

### 급여 (06_payroll) — 18

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 100 | pay_items | pay_items_select | SELECT | member(workplace_id) | — |
| 101 | pay_items | pay_items_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 102 | pay_items | pay_items_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 103 | payroll_terms | payroll_terms_select | SELECT | admin(workplace_id) OR self_emp(employee_id) | — |
| 104 | payroll_terms | payroll_terms_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 105 | payroll_terms | payroll_terms_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 106 | payroll_runs | payroll_runs_select | SELECT | sys() OR admin(workplace_id) OR EXISTS(자기 결과) | — |
| 107 | payroll_runs | payroll_runs_insert | INSERT | — | sys() |
| 108 | payroll_runs | payroll_runs_update | UPDATE | sys() | sys() |
| 109 | payroll_employee_results | per_select | SELECT | sys() OR admin(workplace_id) OR **user_id = uid** | — |
| 110 | payroll_employee_results | per_insert | INSERT | — | sys() |
| 111 | payroll_employee_results | per_update | UPDATE | sys() | sys() |
| 112 | payroll_employee_result_items | peri_select | SELECT | sys() OR admin(workplace_id) OR **user_id = uid** | — |
| 113 | payroll_employee_result_items | peri_insert | INSERT | — | sys() |
| 114 | payroll_validation_results | pvr_select | SELECT | **admin(workplace_id)** | — |
| 115 | payroll_validation_results | pvr_insert | INSERT | — | sys() |
| **165** | payroll_employee_result_items | **peri_delete** | **DELETE** | **sys() AND EXISTS(소속 실행이 DRAFT·CALCULATED)** | — |
| **166** | payroll_validation_results | **pvr_delete** | **DELETE** | **sys() AND EXISTS(소속 실행이 DRAFT·CALCULATED)** | — |

- **165·166이 재계산 교체의 물리적 전제다.** REQ-PAY-28이 CALCULATED → CALCULATED 재계산을 상태 전이로 확정했는데 라인을 지울 경로가 없으면 덧쌓이고, DEFERRABLE check_payroll_result_balance()가 트랜잭션 종료 시 반드시 실패한다. 해소된 BLOCK 검증 행이 남으면 "검증 무오류" 판정도 영구 차단된다.
- **두 정책의 USING이 상태 조건을 담는 것이 봉인 유지의 근거다** — 확정분은 정책이 행을 보이지 않게 하고 guard_confirmed_result_item()이 한 번 더 막는다. 삭제 가능 범위는 미확정 실행의 파생물뿐이다.
- **109·112의 본인 축은 멤버십·사업장 상태·구독 상태를 전부 보지 않는다**(REQ-PAY-32 · CMP-07).
- **114에 STAFF 축이 없는 것이 설계다** — 최저임금 미달 경고 등 내부 판정을 직원 화면에 노출하지 않는다.
- 106의 STAFF 접근이 자기 결과 경유인 이유는 헤더에 사업장 전체의 합계·정책 동결값이 실리기 때문이다.
- 확정 불변은 정책이 아니라 guard_confirmed_result()·guard_confirmed_result_item() 트리거가 강제한다 — 108·111의 sys()는 서비스 경로만 열 뿐 확정 후 변경을 막지 못한다.
- **VOID·정정본 발행과 자기포함 런의 확정은 OWNER 전용**이며, 정책이 아니라 서비스 + guard_payroll_status_transition()이 판정한다. 정책은 컬럼 값(self_included)에 따라 역할 요구를 달리하는 조건을 표현하지 못한다 — 108이 sys()인 이유다.

### 명세서 (11_payslip) — 8

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 116 | payslips | payslips_select | SELECT | **user_id = uid** OR admin(workplace_id) OR **perm('support:act')** OR sys() | — |
| 117 | payslips | payslips_insert | INSERT | — | sys() |
| 118 | payslips | payslips_update | UPDATE | sys() | sys() |
| 119 | payslip_deliveries | pd_select | SELECT | admin(workplace_id) OR **user_id = uid** | — |
| 120 | payslip_deliveries | pd_insert | INSERT | — | sys() OR (**user_id = uid AND delivery_type IN ('VIEWED','DOWNLOADED')**) |
| 121 | batch_jobs | batch_jobs_select | SELECT | admin(workplace_id) OR sys() | — |
| 122 | batch_jobs | batch_jobs_insert | INSERT | — | sys() |
| 123 | batch_jobs | batch_jobs_update | UPDATE | sys() | sys() |
| — | — | — | — | — | — |

- **116이 본 문서군에서 가장 중요한 정책이다.** workplace_members를 조인하지 않으므로 멤버십 LEFT·REMOVED, 사업장 CLOSED, 구독 EXPIRED 어느 경우에도 본인 명세서 접근이 끊기지 않는다. 명세서는 지급일 + 3년 보존·교부 대상이라 접근 차단 자체가 위반 소지다(REQ-SLP-09 · CMP-07).
- **플랫폼 축을 등급(sysadmin)이 아니라 권한 키(support:act)로 좁힌다** — 등급 판정만 걸면 VIEWER까지 전 사업장 명세서 메타가 열린다. 고객지원 목적을 표현하는 기존 키를 쓰므로 권한 키 27종은 늘지 않는다. 시스템 관리자는 메타만 보며 PDF 원문은 별도 권한 + 사유 + 감사를 거친다.
- **120의 표현식은 대상 행의 소유권을 보지 않는다** — payslip_id·workplace_id를 임의로 채운 INSERT가 통과하고, 참조 성립 여부가 명세서 존재 신호가 되어 404 은닉이 뚫린다. guard_payslip_delivery_insert()가 그 대조를 맡는다.
- **120이 writable(workplace_id)를 요구하지 않는 유일한 사용자 INSERT다.** 사업장 CLOSED 이후에도 본인 열람 기록이 남아야 하므로 guard_workplace_readonly()의 예외이기도 하다.

### 법정 준수 (12_compliance) — 6

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 124 | compliance_tasks | compliance_tasks_select | SELECT | admin(workplace_id) OR sys() | — |
| 125 | compliance_tasks | compliance_tasks_insert | INSERT | — | sys() |
| 126 | compliance_tasks | compliance_tasks_update | UPDATE | sys() | sys() |
| 127 | severance_assessments | sa_select | SELECT | admin(workplace_id) OR **self_emp(employee_id)** OR sys() | — |
| 128 | severance_assessments | sa_insert | INSERT | — | sys() |
| 129 | severance_assessments | sa_update | UPDATE | sys() | sys() |

- compliance_tasks에 STAFF 축이 없다 — 사업주의 신고 의무 관리 도구이며 직원 개인의 열람 대상이 아니다.
- 127은 급여이력 범주이므로 소유권 축을 갖는다.

### 알림 (13_notification) — 6

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 130 | notification_types | nt_select | SELECT | **true** | — |
| 131 | notification_types | nt_insert | INSERT | — | sys() |
| 132 | notification_types | nt_update | UPDATE | sys() | sys() |
| 133 | notifications | notifications_select | SELECT | **recipient_user_id = uid** | — |
| 134 | notifications | notifications_insert | INSERT | — | sys() |
| 135 | notifications | notifications_update | UPDATE | recipient_user_id = uid | recipient_user_id = uid |

- 133에 관리자 축이 없다 — 개인 수신함이며 사업주가 직원의 알림을 열람할 근거가 없다. 타인 알림 조작은 notification.forbidden/403, 미존재·삭제는 notification.not_found/404다.
- 135는 행만 좁히고 **read_at·deleted_at 외 컬럼 변경 차단은 트리거가 강제한다.**

### 구독 (14_subscription) — 6

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 136 | plans | plans_select | SELECT | **true** | — |
| 137 | plans | plans_insert | INSERT | — | perm('settings:update') |
| 138 | plans | plans_update | UPDATE | perm('settings:update') | perm('settings:update') |
| 139 | subscriptions | subscriptions_select | SELECT | user_id = uid OR perm('subscription:view') OR **EXISTS(구독자가 OWNER인 사업장의 admin)** OR sys() | — |
| 140 | subscriptions | subscriptions_insert | INSERT | — | sys() |
| 141 | subscriptions | subscriptions_update | UPDATE | sys() | sys() |

- **139에 사업장 관리자 축이 필요한 이유는 한도 가드의 판정 입력 때문이다.** 구독은 계정 단위(user_id UNIQUE)이고 그 계정은 OWNER인데, guard_member_cap()은 **MANAGER가 초대·수락을 수행할 때도** plan.max_staff_per_workplace를 읽어야 한다. 본인 축만 두면 MANAGER의 uid로는 OWNER의 구독 행이 0행이라 한도 판정이 무력화된다.
- 노출 범위는 여전히 좁다 — 관리자가 보는 것은 **자기 사업장 소유자의 구독 한도**이고 결제·조정 이력은 서버 API가 응답 필드로 좁힌다.
- plans의 SELECT가 true인 이유는 요금제가 공개 페이지에 노출되기 때문이다. **is_active 필터와 응답 필드 한정(code · name · 한도 2축 · price · display_order)은 서버 API가 강제한다** — 정책은 비활성 요금제 행과 내부 운영 필드를 좁히지 못한다.
- **true인 SELECT 5종(terms_documents · notification_types · plans · statutory_rates · income_tax_table_entries)은 전부 전역 마스터다.** 행 가시성이 공개인 것과 응답 표면이 공개인 것은 다르며, 후자는 서버 API가 정한다.
- 수동 조정의 subscription:update 권한과 사유 필수는 서비스 + audit_logs 트리거가 강제한다.

### 시스템 (15_system) — 11

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 142 | system_admins | system_admins_select | SELECT | perm('system_admin:view') OR **user_id = uid** — 앞 축은 **SUPER_ADMIN 전용 키** | — |
| 143 | system_admins | system_admins_insert | INSERT | — | perm('admin:grant_role') |
| 144 | system_admins | system_admins_update | UPDATE | perm('admin:manage') | perm('admin:manage') |
| 145 | system_admins | system_admins_delete | **DELETE** | perm('admin:manage') | — |
| 146 | audit_logs | audit_logs_select | SELECT | sys() OR perm('audit:view') OR (**admin(workplace_id) AND action IN 도메인 이력 집합 35종** — 사업장·멤버 **7** · 인사 **6** · 근태·휴가 **12** · 급여·명세서 5 · 데이터 **5**) | — |
| 147 | audit_logs | audit_logs_insert | INSERT | — | sys() |
| 148 | statutory_rates | statutory_rates_select | SELECT | **true** — 확인 메타 노출은 서버가 statutory:view로 한정한다 | — |
| 149 | statutory_rates | statutory_rates_insert | INSERT | — | perm('settings:update') |
| 150 | statutory_rates | statutory_rates_update | UPDATE | perm('settings:update') | perm('settings:update') |
| 151 | income_tax_table_entries | itte_select | SELECT | **true** | — |
| 152 | income_tax_table_entries | itte_insert | INSERT | — | perm('settings:update') |

- **145는 상태 전이가 아니라 행 삭제로 권한을 회수하는 유일한 자리다.** 나머지 DELETE 4건(#161 · #165 · #166 · #173)은 회수가 아니라 **재산정·재계산의 교체**이며 대상이 파생·미확정 행으로 한정된다. guard_last_super_admin()이 마지막 SUPER_ADMIN을 보호한다.
- **142에 본인 행 축을 더한 이유는 본인 권한 조회다** — SUPER_ADMIN이 아닌 VIEWER·SUPPORT·ADMIN은 system_admin:view를 갖지 않아 자기 system_admins 행조차 0행이 되고, 본인 권한과 만료일을 돌려주는 표면이 성립하지 않는다. 본인 조회는 목록 열람이 아니므로 이 키를 요구할 이유가 없다(보정 V0703). **같은 시기 보정 넷 중 유일하게 반환 축이 아니다.**
- **146의 sys() 축은 서버가 감사 로그를 기록하는 경로 자체를 성립시킨다** — INSERT(#147)가 sys() 단독인데 기록한 행을 돌려받으면 SELECT 가시성이 별도로 필요하다(보정 V0705). 근거는 아래 쓰기 반환 축 절이다.
- **146의 두 번째 축이 legacy와 갈리는 지점이다.** v1에서 employee_change_logs를 폐기했으므로 사업장 관리자에게 workplace 스코프를 명시적으로 연다. PII 원문이 없고 workplace_id로 격리되므로 안전하다.
- **146의 IN 목록은 [15_system.md](./15_system.md)가 채번 정본이고 이 정책이 그 강제 지점이다.** V0712가 사업장·멤버 축을 5 → **7**로 넓혀 workplace.close(자발 폐쇄)와 business_unit.declare를 흡수했고, **V0715가 근태·휴가 축을 7 → 10으로 넓혀** attendance_record.approve · attendance_record.reject · attendance_change_request.proxy_submit을 흡수했고, **V0718이 데이터 축을 3 → 4로 넓혀** compliance_task.waive를, **V0722가 근태·휴가 축을 10 → 12로 넓혀** leave_request.cancel · leave_grant.recompute를 흡수했다(개방 **33종**) — 둘 다 그 사업장의 OWNER·MANAGER가 한 행위이고 workplace_id로 격리되며 PII 원문을 담지 않는다. **workplace.close_forced는 여전히 열지 않는다** — 같은 결과 상태를 만들더라도 그것은 플랫폼이 사업장에 가한 제재이고, 제재 축을 대상자에게 여는 것은 개방의 전제와 다른 판단이다. **ALTER POLICY라 정책 수 172는 이 변경으로 바뀌지 않는다.**
- **audit:view는 VIEWER 권한에 없다.** 사업장 OWNER라도 플랫폼 권한 없이는 전체 감사 로그에 접근하지 못한다.
- statutory_rates·income_tax_table_entries의 SELECT가 공개인 이유는 계산 엔진이 서버 API 경유로 조회하며 기준값 자체가 법령 공개 정보이기 때문이다. **UPDATE는 새 버전 INSERT가 원칙이라 실제 사용을 최소화한다.**

### 개인정보 (16_privacy) — 2

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 153 | location_usage_records | lur_select | SELECT | **user_id = uid** OR sys() | — |
| 154 | location_usage_records | lur_insert | INSERT | — | sys() |

- **관리자 축이 없는 유일한 업무 테이블이다.** 확인자료는 정보주체가 자기 위치정보 처리 내역을 확인하기 위한 자료이며, 사업주가 직원의 위치 이용 이력을 조회할 근거가 없다.

### 인프라 (17_infra) — 12

| # | 테이블 | 정책명 | cmd | USING | WITH CHECK |
|---|--------|--------|-----|-------|------------|
| 155 | import_jobs | import_jobs_select | SELECT | admin(workplace_id) | — |
| 156 | import_jobs | import_jobs_insert | INSERT | — | admin(workplace_id) AND writable(workplace_id) |
| 157 | import_jobs | import_jobs_update | UPDATE | admin(workplace_id) | admin(workplace_id) |
| 158 | export_jobs | export_jobs_select | SELECT | requested_by = uid OR (admin(workplace_id) AND export_type = 'PAYROLL_LEDGER') OR perm('audit:view') **OR sys()** | — |
| 159 | export_jobs | export_jobs_insert | INSERT | — | sys() |
| 160 | export_jobs | export_jobs_update | UPDATE | sys() | sys() |
| **167** | scheduled_job_runs | **sjr_select** | SELECT | perm('audit:view') OR sys() | — |
| **168** | scheduled_job_runs | **sjr_insert** | INSERT | — | sys() |
| **169** | scheduled_job_runs | **sjr_update** | UPDATE | sys() | sys() |
| **170** | **idempotency_records** | **idempotency_records_select** | SELECT | (scope_type = 'WORKPLACE' AND member(scope_id)) OR (scope_type = 'USER' AND scope_id = uid) | — |
| **171** | **idempotency_records** | **idempotency_records_insert** | INSERT | — | (scope_type = 'WORKPLACE' AND member(scope_id)) OR (scope_type = 'USER' AND scope_id = uid) |
| **172** | **idempotency_records** | **idempotency_records_update** | UPDATE | (scope_type = 'WORKPLACE' AND member(scope_id)) OR (scope_type = 'USER' AND scope_id = uid) | 같음 |

- **167~169가 정기작업 8건의 실행 이력을 담는 유일한 표면이다.** batch_jobs는 job_type이 2값이고 workplace 스코프라 플랫폼 배치를 담지 못한다. SELECT를 audit:view로 두는 이유는 이 원장이 운영 감사 자료이고 사업장 사용자에게 열 근거가 없기 때문이다. **167의 sys() 축은 배치 자신의 최소 개방이다** — UPDATE의 WHERE 열 참조와 INSERT … RETURNING에는 SELECT 가시성이 함께 필요하므로, 이 축이 없으면 배치가 자기 RUNNING 행을 닫지 못한다(보정 V0701).
- 157이 admin인데 **VALIDATED → COMMITTED 전이의 OWNER 제한은 guard_import_transition() 트리거가 강제한다.**
- 158의 세 축이 서로 다른 근거를 갖는다 — 요청자 본인 · 급여대장의 사업장 관리자 · 감사 내보내기의 플랫폼 권한.
- **170~172는 스코프 열을 술어의 인자로 쓰는 유일한 자리다.** 다른 테이블은 workplace_id 열이 곧 테넌트 축이지만 여기서는 scope_type이 scope_id의 해석을 정하므로, 정책이 **두 축을 각각 평가하고 OR로 잇는다**. 축이 둘인 근거는 사업장 스코프가 없는 표면(감사 로그 내보내기)이 있다는 것이다([17_infra.md](./17_infra.md)).
- **DELETE를 두지 않는 것이 설계다** — 부분 UNIQUE가 status <> 'DISCARDED'로 좁혀 물리 삭제 없이 같은 키의 재시도를 열므로 삭제 표면이 필요 없다. **DELETE 정책 4는 이 테이블로 늘어나지 않는다.**
- **sys() 축을 두지 않는 것도 설계다** — 멱등 표면이 전부 사용자 요청 경로이고 정기작업이 이 테이블을 읽는 자리가 없다. 167이 배치에 최소 개방을 준 것과 대비되는 판단이며, 근거는 같다 — **읽는 주체가 있는 축만 연다.**

---

## 서버 배치의 읽기 축 — SELECT에 결합하는 sys() 27지점

**쓰기 축은 sys()로 열려 있는데 읽기 축이 닫혀 있으면 정기작업은 계산 입력을 얻지 못한다.** 배치는 멤버도 관리자도 본인도 아니므로 admin(w) · user_id = uid · self_emp() 어느 축에도 걸리지 않고, fail-closed 설계상 0행을 받는다. 아래 **23정책**의 SELECT에 **sys()가 결합돼 있다**(참조 **24** — employees를 두 작업이 공유한다). 표현식은 위 전수 표가 그대로 담고, 이 절은 **왜 이 22정책만 배치에 열려 있는가**를 갖는다.

| 정기작업 | 읽어야 하는 테이블 | 정책 |
|----------|------------------|------|
| expireInvitations | workplace_invitations | #29 |
| checkSubscriptionExpiry | subscriptions | #139 |
| rollupAttendanceDaily | attendance_records · attendance_breaks · **attendance_period_closings** · **work_schedules · leave_requests · leave_types** | #68 · #71 · **#80** · **#83 · #92 · #86** |
| accrueAndExpireLeave | employees · leave_grants · leave_transactions · leave_balances · employee_protected_periods · **attendance_daily_summaries** | #43 · #89 · #95 · #97 · #162 · **#74** |
| recomputeEmployeeCountSnapshot | workplaces · business_units · employees · employment_terms | #20 · #23 · #43 · #49 |
| checkComplianceDeadlines | compliance_tasks · severance_assessments · **workplace_members** | #124 · #127 · **#26** |
| retryPayslipAndPush | payslips · batch_jobs · **payroll_runs · payroll_employee_results · payroll_employee_result_items** | #116 · #121 · **#106 · #109 · #112** |
| **감사 내보내기 러너**(정기작업이 아닌 서버 전용 경로 — [../06_api/14_system.md](../06_api/14_system.md) #20~#22) | export_jobs | **#158** |

검산: 초대 1 + 구독 1 + 근태 **5** + **사업장 3** + 인사 2(employees는 두 작업이 공유) + 휴가 **6** + 준수 2 + 명세서 2 + 급여 3 + **시스템 1** = **26정책 · 27참조**(employees 중복).

- **검산의 축은 읽는 배치가 아니라 테이블의 도메인이다.** 사업장 묶음과 인사 묶음을 둘 다 recomputeEmployeeCountSnapshot이 읽는데도 한 묶음으로 세지 않는 것이 그 규약이고, 거꾸로 **사업장 3은 두 배치가 나눠 읽는다**(#20 · #23은 recomputeEmployeeCountSnapshot · **#26은 checkComplianceDeadlines**) — 한 묶음이 한 배치에 대응하지 않는 것이 이 축의 성질이다. 앞선 신설 둘도 같은 축으로 **근태**에 든다 — **attendance_daily_summaries는 근태 표인데 읽는 것은 accrueAndExpireLeave다.** 어느 작업이 무엇을 읽는지의 정본은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) 작업별 동작 절이고, 이 표는 그 서술에서 유도한다 — rollupAttendanceDaily의 "**마감된 기간은 건너뛴다**"가 #80을, accrueAndExpireLeave의 출근율 판정이 #74를 요구한다.

**실측 정합(2026-09-07 · pg_policy 카탈로그 전수 대조)** — 위 14정책 중 **4정책에 이 결합이 적용 스키마에 없었다**. #43 employees_select · #49 employment_terms_select · #68 attendance_records_select · #71 attendance_breaks_select 넷이며, 나머지 10정책(#29 · #139 · #89 · #95 · #97 · #162 · #124 · #127 · #116 · #121)은 전건 결합돼 있었다. 보정 **V0708**이 넷을 ALTER POLICY로 맞췄다.

**또 둘이 있었다(2026-09-07 · 구현 중 실측)** — #20 workplaces_select · #23 business_units_select다. V0708이 계산 입력(employees · employment_terms)을 고쳤을 때 **대상 열거의 입력**은 함께 다뤄지지 않아, recomputeEmployeeCountSnapshot이 계산할 사업장을 하나도 찾지 못했다. 보정 **V0710**이 둘을 맞췄고 적용 후 **그 시점의 16정책** 전건 결합을 실측했다. **표현식 변경이므로 정책 수도 위 검산의 정책 수 축도 계수로는 바뀌지 않는다** — 검산의 두 수는 이 절이 세는 결합 지점이고, 계수 검수로는 드러나지 않아 표현식 대조로만 잡힌다.

**넷째·다섯째가 2026-09-08에 나왔다** — #80 apc_select(**V0720**)와 #74 ads_select(**V0723**)다. 앞의 셋과 달리 **증상의 등급이 다르다.**

| 지점 | 배치 | 0행이 만드는 것 |
|------|------|----------------|
| #80 apc_select | rollupAttendanceDaily | **마감된 기간을 마감되지 않은 것으로 본다** — 정기작업이 확정 집계를 덮어쓴다. 급여의 확정 입력이 사후에 조용히 바뀐다 |
| #74 ads_select | accrueAndExpireLeave | **없는 근거로 권리를 발생시킨다** — 소정근로일수 0 · 출근일수 0이 되고 정수 비교로 반올림을 피한 80% 판정(출근일수 × 5 >= 소정근로일수 × 4)이 0 >= 0으로 **참**이 되어 근속 응당일마다 **연차 15일이 전건 발생**한다 |

- **이 절이 지금까지 담지 못한 사실이 그것이다 — 계산 입력이 0행이면 계산이 0을 내는 것이 아니라 틀린 값을 낼 수 있다.** 앞의 셋(V0708 계산 입력 · V0710 대상 열거의 입력 · V0720 ①의 마감 판정 입력)은 **아무 일도 일어나지 않거나 막혀야 할 것이 통과한 것**인데, #74는 **일어나서는 안 될 일이 정상 경로로 일어난다.**
- **실행 이력으로는 어느 쪽도 드러나지 않는다.** #74의 경우 이력이 SUCCEEDED이고 **대상 수도 정상값**이라 "돌았으나 대상 0건"이라는 신호조차 없다 — 앞의 셋이 남기던 SUCCEEDED + target_count 0보다 한 단계 더 조용하다. **계수로 드러나지 않는 결함은 표현식 대조로만 잡힌다.**
- **판정 입력을 계산 입력과 같은 무게로 센다.** 무엇을 계산할지 고르는 질의 · 고른 것을 계산하는 질의 말고 **계산해도 되는지 판정하는 질의**가 따로 있다. 그것을 빼먹으면 배치는 막힌 것이 아니라 **틀린 전제로 정상 동작한다.** (이 문장은 한때 "배치가 읽는 것은 셋이다"로 축을 닫고 있었다 — 아래 여섯째 사례가 그 열거를 그날로 틀린 문장으로 만들었다.)

**다섯째가 급여 3정책이다(V0725)** — #106 payroll_runs_select · #109 per_select · #112 peri_select이며 **retryPayslipAndPush 하나가 셋을 읽는다.** 실패한 명세서 PDF를 재생성하는데 **그 PDF가 법정 필수 기재사항이라 급여 라인이 있어야 만들어진다**([../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)).

- **앞의 넷과 달리 표면 시험으로 잡히지 않는다.** 요청 경로는 정상 동작한다 — app.current_user_id가 함께 켜져 admin(w)로 통과하기 때문이다. **정기작업에서만 0행이 된다.**
- **그래서 실패가 나는 자리와 원인이 있는 자리가 다르다.** 활성 원본을 찾는 조회가 **없는 실행을 없다고 판정해** 같은 급여월의 실행을 새로 만들려다 **부분 유니크에 부딪힌다** — 증상은 유니크 위반인데 원인은 SELECT 정책이다. **증상이 가리키는 층과 원인이 있는 층이 다르면 그 자리에서 원인을 찾지 못한다.**
- **발견도 자동이 아니었다** — 구현 레인이 정책 카탈로그를 직접 읽어 **쓰기 축과 읽기 축의 비대칭을 눈으로 대조해** 잡았다. 계수 검수로는 나오지 않는다.

**#114 pvr_select에는 두지 않는다.** 검증 결과는 확정 흐름이 보는 것이고 **명세서 재생성이 읽지 않는다** — **배치가 읽지 않는 것은 배치에 열지 않는다.**

- **이 절이 다섯 번째 사례를 맞으면서 반대 방향의 압력이 생긴다** — "쓰기에 서버 축이 있으니 읽기에도 있어야 한다"로 축을 넓히는 것이다. 급여 표의 INSERT · UPDATE · DELETE 정책 **일곱**(#107 · #110 · #111 · #113 · #115 · #165 · #166)이 전부 서버 축을 요구하는데 **SELECT 넷 중 셋만 열려 있으므로**, 넷째를 열지 않은 이유가 여기 없으면 **다음 사람이 정합성을 맞춘다며 연다.**
- **쓰기 축과 읽기 축의 대칭은 근거가 아니다.** 쓰기는 배치가 결과를 남기는 자리라 도메인 전체에 걸리고, 읽기는 **그 배치가 실제로 참조하는 것**만 연다. 둘이 갈리는 것이 정상이며 **갈린다는 사실 자체가 읽기 축을 좁게 유지한다는 증거**다.

**여섯째가 #26 workplace_members_select다(V0727) — 종류가 하나 늘었다.** checkComplianceDeadlines가 기한 과제를 감지한 뒤 compliance_deadline 알림을 보내야 하는데(REQ-TAX-03 · REQ-TAX-04), 알림은 수신자를 요구하고 **compliance_tasks에는 workplace_id · employee_id만 있어 수신자 축이 없다.** 관리자를 얻으려면 workplace_members를 읽어야 하는데 그 정책의 축이 관리자와 본인 둘뿐이라 배치는 0행을 받는다.

- **앞의 다섯과 종류가 다르다 — 산출물 수신자를 열거하는 질의다.** 대상 열거는 무엇을 계산할지, 계산 입력은 무엇으로 계산할지, 판정 입력은 계산해도 되는지를 묻는데 **이것은 계산이 끝난 뒤 그 결과를 누구에게 보낼지를 묻는다.** 앞의 셋은 전부 계산이 성립하기 전의 읽기이고 이것은 계산이 성립한 뒤의 읽기다.
- **증상 등급이 앞의 다섯보다 한 단계 더 조용하다.** #74는 이력이 SUCCEEDED이고 대상 수도 정상값이었는데, 이번은 **거기에 더해 과제 감지까지 정상으로 끝난다** — 배치가 하는 일 중 실패한 것이 하나도 없고 **알림만 0건**이다. 드러나는 자리가 실행 이력도 데이터도 아니라 **"법정 신고 기한을 아무도 통보받지 못했다"**이고, 그것은 기한이 지난 뒤다.
- **배치가 읽는 것을 종류로 열거하지 않는다 — 열거는 늘 한 종류씩 늦는다.** 지금까지 드러난 것이 넷이지만(대상 열거 · 계산 입력 · 판정 입력 · 산출물 수신자 열거) **그것이 전수라는 근거는 없다.** 판정 기준은 하나다 — **그 질의가 0행일 때 배치의 어느 단계가 성립하지 않는가.** 답이 있으면 읽기 축이며, 그 단계가 계산 앞인지 뒤인지는 묻지 않는다.
- **이것이 "어긋난 사례 하나가 분류를 강제한다"의 두 번째 적용이다**([../CLAUDE.md](../CLAUDE.md)). 사례를 다섯 겪는 동안 분류는 셋으로 닫혀 있었고, **여섯째가 그 셋 어디에도 들어가지 않아** 비로소 축이 목록이었다는 것이 드러났다. 칸을 넷으로 늘리는 것이 아니라 **닫는 축을 판정 기준으로 바꾸는 것**이 이번 개정이다.
- **V0726의 플랫폼 축과 다른 축이다.** 같은 정책에 has_system_permission('workplace:view')가 함께 결합돼 있지만 그것은 **시스템 콘솔의 조회 축**이다. 배치는 플랫폼 관리자가 아니라 행위자가 없는 경로라 그 축에 걸리지 않는다 — **두 축은 서로를 대신하지 않으며**, 하나가 이미 있다는 이유로 다른 하나를 생략하면 그 순간 0행이 된다.


- **두 번 같은 형태로 놓쳤다는 것이 이 절의 교훈이다.** 정기작업이 읽는 것을 열거할 때 **계산 입력만 세고 대상 열거의 입력을 세지 않았다.** 배치는 "무엇을 계산할지 고르는 질의"와 "고른 것을 계산하는 질의"를 둘 다 갖는데, 앞의 것이 막히면 뒤의 것은 아예 실행되지 않아 증상이 같다 — SUCCEEDED + target_count 0이다. 새 정기작업을 등재할 때 **두 축을 각각 적는다.**

- **막히던 것은 세 정기작업이다** — recomputeEmployeeCountSnapshot이 employees · employment_terms를 못 읽어 상시근로자 산정이 성립하지 않고, rollupAttendanceDaily가 attendance_records · attendance_breaks를 못 읽어 일 집계가 대상 0건으로 끝나며, accrueAndExpireLeave가 employees를 못 읽어 적립 대상이 0명이 된다. 스냅샷이 없으면 5인·10인 경계 판정이 파생되지 않아 급여와 연차가 연쇄로 차단된다.
- **이 결함이 늦게 드러나는 이유는 쓰기 축이 열려 있기 때문이다.** 읽을 것을 얻지 못해도 쓰기 정책(#39 · #40 · #42 · #75 · #76)은 sys()로 통과하므로 배치는 예외 없이 끝나고 **SUCCEEDED + target_count 0**으로 기록된다. 실행 이력만 보면 아예 돌지 않은 배치와 구분되지 않으며, 이것이 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)가 **"돌지 않음"은 행 부재 · "돌았으나 대상 0건"은 SUCCEEDED + target_count 0**으로 두 상태를 갈라 기록하도록 요구하는 자리와 같다(REQ-NFR-16). **조용한 성공은 실패보다 늦게 발견된다.**
- **표기 규약 — 읽기 축 sys()는 전수 표에 인라인으로 싣는다.** 절에 서술만 두고 표를 비워 두면 **절을 읽지 않고 표만 보고 구현할 때 결합이 빠지는데, V0708 이전의 4정책이 정확히 그 형태로 어긋나 있었다.** 표가 실제 표현식을 담아야 표 하나로 카탈로그와 대조된다. **결합 위치도 실제 SQL 순서대로 적는다** — **보정으로 뒤늦게 결합한 것은 맨 앞**이고 **처음부터 결합돼 있던 10건은 맨 뒤**다. 보정분을 번호로 열거하지 않는다 — 보정이 늘 때마다 그 목록이 틀리고, **구분의 축은 개별 번호가 아니라 언제 결합됐는가**다. 이 축의 sys()에는 강조를 걸지 않는다 — 전건이 갖는 균일한 사실이고, 표의 굵게가 개정 이력을 담기 시작하면 다음 개정마다 걷어내야 한다.
- **규약이 있다는 사실이 그 규약을 지키게 하지 않는다**(2026-09-08 실측). 위 표기 규약을 등재한 뒤에도 **#74 · #80이 전수 표에 인라인으로 실리지 않은 채 두 회차를 지났다** — 읽기 축 절의 표만 고치고 전수 표를 둔 것이며, **그것이 이 규약이 정확히 막으려던 형태**다(절을 읽지 않고 표만 보고 구현하면 결합이 빠진다). **결합을 더할 때 고칠 자리는 둘이다 — 읽기 축 절의 작업별 표와 정책 전수 표.** 한쪽만 고치면 규약은 남고 표는 어긋난다.
- **결합 대상을 열거로 고정하는 것이 요점이다** — "필요하면 켠다"로 두면 app.system_context가 사용자 요청 경로로 번지고, 그 순간 users·password_reset_tokens가 통째로 열린다.
- 여기 없는 테이블의 SELECT에 **정기작업 읽기 축으로는** sys()를 두지 않는다. **배치가 읽지 않는 것은 배치에 열지 않는다.** 근거가 다른 축이 하나 더 있으며 아래 절이 그 4지점을 따로 열거한다.
- 쓰기 축과 달리 읽기 축은 **정기작업 8건이 실제로 참조하는 집합**으로만 정의되며, 그 집합의 정본은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)의 작업별 동작 절이다.

---

**일곱째가 #158 export_jobs_select다(V0734) — 읽는 주체가 정기작업 8건 밖에 있다.** 감사 내보내기(#20)는 요청 트랜잭션이 export_jobs 행을 만들고 산출물은 **요청 밖의 서버 전용 러너**가 시스템 컨텍스트에서 채운다. INSERT · UPDATE(#159 · #160)는 sys()를 보는데 SELECT만 보지 않아 **러너가 방금 만들어진 작업 행을 찾지 못하고 작업이 영영 PENDING으로 남았다** — 진행 조회(#21)는 export.not_ready만 되풀이하고 실행 이력에는 아무것도 없다(정기작업이 아니라 이력 표 자체가 없다). 이 절이 **배치 표로만 세고 있어서** 러너 행을 표에 더했다 — 서버 전용 경로는 정기작업의 부분집합이 아니다.

- **통합 시험이 잡지 못한 이유는 시험 스레드에 관리자 사용자 컨텍스트가 남아 있었기 때문이다** — requested_by = uid 축으로 통과해 sys() 부재가 드러나지 않았다. 운영에서는 러너가 사용자 컨텍스트 없는 스레드에서 돈다. **서버 전용 경로의 시험은 사용자 컨텍스트를 비우고 돌린다** — 그래야 시험이 sys() 축 하나에만 의존한다.

**여덟째가 #83 work_schedules_select · #92 leave_requests_select · #86 leave_types_select다(V0741) — 판정 입력인데 요청 경로의 재집계가 가렸다.** rollupAttendanceDaily는 기록 없는 평일을 결근으로 판정하려면 편성을, 휴가일을 ON_LEAVE로 판정하려면 승인 휴가와 유형의 유급 여부를 읽어야 한다. 셋 다 관리자 · 본인 축뿐이라 **정기작업에서는 0행**이었고, 일 집계는 편성 없이 NORMAL로 저장됐다 — 근태 마감은 그 행들을 "판정에 필요한 스케줄 누락"으로 세어 막혔다(2026-09-17 교차 검수 실측 — 픽스처 빌드가 만든 일 집계는 편성이 붙고 그 뒤 밤마다 만들어진 일 집계만 비어 있었다).

- **요청 경로가 같은 계산을 하므로 가려졌다.** 편성 저장 · 수정 요청 승인이 부르는 재집계는 관리자 컨텍스트라 admin(w)로 통과한다. **같은 서비스가 두 컨텍스트에서 돌고 한쪽만 막히면 시험이 요청 경로만 밟는 한 드러나지 않는다** — 시험은 사용자 컨텍스트를 비우고 정기작업 진입점으로 돌린다(AttendanceIntegrationTest).
- **documents_select에는 두지 않는다** — 연소자 서류 비치 판정은 편성 저장 경로가 읽고 롤업은 읽지 않는다. **배치가 읽지 않는 것은 배치에 열지 않는다.**

## 쓰기 반환 축 — RETURNING이 요구하는 SELECT 가시성 4지점

**쓰기가 열려 있어도 반환 단계가 막힌다.** INSERT·UPDATE가 삽입·갱신한 행을 돌려주는 RETURNING은 그 행에 대한 **SELECT 정책의 가시성을 별도로 요구한다.** 서버 컨텍스트 호출은 admin(w) · user_id = uid · self_emp() 어느 축에도 걸리지 않으므로, WITH CHECK가 sys()로 열려 있어 쓰기 자체는 통과해도 반환 단계에서 42501로 끝난다 — **WITH CHECK만 읽어서는 드러나지 않는 결함 형태**이며 구현 검증에서 네 번 반복해 나타났다.

| 정책 | 결합한 축 | 막히던 경로 | 보정 |
|------|----------|------------|------|
| #167 sjr_select | sys() | 배치가 자기 RUNNING 행을 닫는 UPDATE의 WHERE 열 참조와 INSERT 반환 | V0701 |
| #146 audit_logs_select | sys() | 서버가 감사 로그를 기록하고 그 행을 돌려받는 경로 | V0705 |
| #38 wecs_select | sys() | 상시근로자 수 스냅샷의 산정·확정 쓰기가 행을 돌려받는 경로 | V0707 |
| #41 ecsd_select | sys() | 확정이 시계열을 다시 읽는 서버 컨텍스트 SELECT | V0707 |

검산: V0701 1 + V0705 1 + V0707 2 = **4정책**. 넷 다 정책 신설·폐기가 아니라 표현식 변경이므로 **정책 수는 불변**이다 — 계수 검수로는 드러나지 않고 표현식 대조로만 잡힌다.

- **반환을 없애는 것도 같은 결함의 대응이다** — 헬퍼 #32 append_audit_log는 RETURNING을 두지 않고 void를 반환한다(보정 V0706). 반환을 포기하면 SELECT 가시성 요구 자체가 성립하지 않는다. 두 대응은 배타적이지 않고 **그 표면이 행을 돌려받아야 하는지**로 갈린다.
- **이 4건은 특정 데이터 접근 클라이언트의 관용구가 아니므로 되돌리지 않는다.** 발견은 스택 전환 전 구현 검증에서 나왔지만 현행 축에서도 그대로 재현된다 — 저장 후 즉시 반영(saveAndFlush)과 생성 키 채번(@GeneratedValue) 조합이 생성값을 받으려고 같은 구문을 쓴다(D-21 · ADR-26).
- **위 읽기 축 절과 근거가 다르다** — 그 절은 정기작업이 계산 입력을 얻는 자리이고, 이 절은 서버 쓰기가 자기 결과를 돌려받는 자리다. 새 서버 쓰기 표면을 만들 때는 WITH CHECK와 함께 **그 표면이 행을 돌려받는지**를 확인한다.
- **표기 규약은 읽기 축과 같다** — 이 축의 sys()도 전수 표에 인라인으로 싣고 **강조를 걸지 않는다.** 넷 다 이제 균일한 사실이라, 셋만 굵게 두면 표의 굵게가 "언제 고쳤는가"라는 개정 이력이 되어 다음 개정마다 걷어내야 한다. 개정 이력은 문서 머리의 개정일 줄이 갖는다.
- **#142는 이 축이 아니다** — 같은 시기 보정(V0703)이지만 근거는 본인 권한 조회의 SELECT 가시성이며 반환과 무관하다.

---

---

## 테이블 61종 × 4명령 봉인 매트릭스

**61테이블 전부의 명령별 정책 유무를 한자리에 고정한다.** 숫자는 위 전수 표의 정책 번호이고 **—** 는 정책이 없다는 뜻이며, RLS는 정책 없는 명령을 기본 거부하므로 곧 **봉인**이다.

| # | 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|--------|:------:|:------:|:------:|:------:|
| 1 | users | #1 | #2 | #3 | **—** |
| 2 | profiles | #4 | #5 | #6 | **—** |
| 3 | terms_documents | #7 | #8 | #9 | **—** |
| 4 | user_consents | #10 | #11 | #12 | **—** |
| 5 | account_status_events | #13 | #14 | **—** | **—** |
| 6 | security_events | #15 | #16 | **—** | **—** |
| 7 | password_reset_tokens | #17 | #18 | #19 | **—** |
| 8 | workplaces | #20 | #21 | #22 | **—** |
| 9 | business_units | #23 | #24 | #25 | **—** |
| 10 | workplace_members | #26 | #27 | #28 | **—** |
| 11 | workplace_invitations | #29 | #30 | #31 | **—** |
| 12 | workplace_change_logs | #32 | #33 | **—** | **—** |
| 13 | membership_role_events | #34 | #35 | **—** | **—** |
| 14 | business_verification_logs | #36 | #37 | **—** | **—** |
| 15 | workplace_employee_count_snapshots | #38 | #39 | #40 | **—** |
| 16 | employee_count_snapshot_days | #41 | #42 | **—** | #161 |
| 17 | employees | #43 | #44 | #45 | **—** |
| 18 | employee_personal_infos | #46 | #47 | #48 | **—** |
| 19 | employment_terms | #49 | #50 | #51 | **—** |
| 20 | employee_insurance_infos | #52 | #53 | #54 | **—** |
| 21 | employee_insurance_histories | #55 | #56 | **—** | **—** |
| 22 | contract_templates | #57 | #58 | #59 | **—** |
| 23 | contracts | #60 | #61 | #62 | **—** |
| 24 | contract_signatures | #63 | #64 | **—** | **—** |
| 25 | documents | #65 | #66 | #67 | **—** |
| 26 | attendance_records | #68 | #69 | #70 | **—** |
| 27 | attendance_breaks | #71 | #72 | #73 | **#173** |
| 28 | attendance_daily_summaries | #74 | #75 | #76 | **—** |
| 29 | attendance_change_requests | #77 | #78 | #79 | **—** |
| 30 | attendance_period_closings | #80 | #81 | #82 | **—** |
| 31 | work_schedules | #83 | #84 | #85 | **—** |
| 32 | leave_types | #86 | #87 | #88 | **—** |
| 33 | leave_grants | #89 | #90 | #91 | **—** |
| 34 | leave_requests | #92 | #93 | #94 | **—** |
| 35 | leave_transactions | #95 | #96 | **—** | **—** |
| 36 | leave_balances | #97 | #98 | #99 | **—** |
| 37 | pay_items | #100 | #101 | #102 | **—** |
| 38 | payroll_terms | #103 | #104 | #105 | **—** |
| 39 | payroll_runs | #106 | #107 | #108 | **—** |
| 40 | payroll_employee_results | #109 | #110 | #111 | **—** |
| 41 | payroll_employee_result_items | #112 | #113 | **—** | #165 |
| 42 | payroll_validation_results | #114 | #115 | **—** | #166 |
| 43 | payslips | #116 | #117 | #118 | **—** |
| 44 | payslip_deliveries | #119 | #120 | **—** | **—** |
| 45 | batch_jobs | #121 | #122 | #123 | **—** |
| 46 | compliance_tasks | #124 | #125 | #126 | **—** |
| 47 | severance_assessments | #127 | #128 | #129 | **—** |
| 48 | notification_types | #130 | #131 | #132 | **—** |
| 49 | notifications | #133 | #134 | #135 | **—** |
| 50 | plans | #136 | #137 | #138 | **—** |
| 51 | subscriptions | #139 | #140 | #141 | **—** |
| 52 | system_admins | #142 | #143 | #144 | #145 |
| 53 | audit_logs | #146 | #147 | **—** | **—** |
| 54 | statutory_rates | #148 | #149 | #150 | **—** |
| 55 | income_tax_table_entries | #151 | #152 | **—** | **—** |
| 56 | location_usage_records | #153 | #154 | **—** | **—** |
| 57 | import_jobs | #155 | #156 | #157 | **—** |
| 58 | export_jobs | #158 | #159 | #160 | **—** |
| 59 | **employee_protected_periods** | #162 | #163 | #164 | **—** |
| 60 | **scheduled_job_runs** | #167 | #168 | #169 | **—** |
| 61 | **idempotency_records** | #170 | #171 | #172 | **—** |

검산: 정책 칸 **173** + 봉인 칸 **71** = 61 × 4 = **244**.

- **DELETE 봉인 56** — 예외는 다섯이다. #145 system_admins(역할 회수) · #161 employee_count_snapshot_days(스냅샷 재산정 교체) · #165 payroll_employee_result_items · #166 payroll_validation_results(급여 재계산 교체) · **#173 attendance_breaks(롤업 자동 차감분 교체)**이며, 회수 하나를 뺀 넷은 정책 USING이 **대상을 파생·미확정 행으로 좁히고 주체를 sys()로 한정한다.**
- **UPDATE 봉인 15** — account_status_events · security_events · workplace_change_logs · membership_role_events · business_verification_logs · employee_count_snapshot_days · employee_insurance_histories · contract_signatures · leave_transactions · payroll_employee_result_items · payroll_validation_results · payslip_deliveries · audit_logs · income_tax_table_entries · location_usage_records. 전부 append-only 원장·이벤트·파생 시계열·재적재 대상이다.
- **삭제는 열되 수정은 닫는 것이 재계산·재산정 교체의 형태다** — 세 테이블은 DELETE 정책을 갖지만 UPDATE 봉인은 그대로다. 행을 고치는 것이 아니라 지우고 다시 넣기 때문이다.
- **SELECT·INSERT 봉인 0** — 61테이블 전부가 두 명령의 정책을 갖는다. 읽기 경로 없는 테이블도, 서버조차 쓸 수 없는 테이블도 두지 않는다.
- 검산: DELETE 56 + UPDATE 15 + SELECT 0 + INSERT 0 = **71**.
- **봉인 칸이 줄어든 첫 개정이 V0720이다** — 지금까지 신설은 테이블을 늘려 칸을 함께 늘렸는데(idempotency_records가 정책 3 · 봉인 1을 함께 더했다), 이번은 **테이블을 늘리지 않고 봉인된 칸 하나를 열었다.** 정책 172 → 173과 봉인 72 → 71이 **같은 하나의 변경**이며 합은 244로 그대로다.

---

## 정책 수 요약

| 그룹 | SELECT | INSERT | UPDATE | DELETE | 계 |
|------|:------:|:------:|:------:|:------:|:--:|
| 계정(01_auth) | 7 | 7 | 5 | 0 | 19 |
| 사업장(02_workplace) | 9 | 9 | 5 | 1 | 24 |
| 인사(03_hr) | 9 | 9 | 7 | 0 | 25 |
| 근태(04_attendance) | 6 | 6 | 6 | **1** | **19** |
| 휴가(05_leave) | 6 | 6 | 5 | 0 | 17 |
| 급여(06_payroll) | 6 | 6 | 4 | 2 | 18 |
| 명세서(11_payslip) | 3 | 3 | 2 | 0 | 8 |
| 법정 준수(12_compliance) | 2 | 2 | 2 | 0 | 6 |
| 알림(13_notification) | 2 | 2 | 2 | 0 | 6 |
| 구독(14_subscription) | 2 | 2 | 2 | 0 | 6 |
| 시스템(15_system) | 4 | 4 | 2 | 1 | 11 |
| 개인정보(16_privacy) | 1 | 1 | 0 | 0 | 2 |
| 인프라(17_infra) | 4 | 4 | 4 | 0 | 12 |
| **계** | **61** | **61** | **46** | **5** | **173** |

검산: 19 + 24 + 25 + **19** + 17 + 18 + 8 + 6 + 6 + 6 + 11 + 2 + 12 = **173**. 명령별 61 + 61 + 46 + **5** = **173**.

- **SELECT와 INSERT는 테이블당 정확히 1개씩**이라 각각 61이다.
- UPDATE가 없는 테이블 **15개**는 전부 append-only 또는 파생 시계열이다 — account_status_events · security_events · workplace_change_logs · membership_role_events · business_verification_logs · employee_count_snapshot_days · employee_insurance_histories · contract_signatures · leave_transactions · payroll_employee_result_items · payroll_validation_results · payslip_deliveries · audit_logs · income_tax_table_entries · location_usage_records. 검산: 61 − 15 = **46**.

---

## 정책이 없는 것이 설계인 지점

| 지점 | 없는 정책 | 뜻 |
|------|----------|-----|
| **전 61테이블** | DELETE(예외 5종) | 업무·법정 보존행은 지워지지 않는다. **근거는 grant의 전면 부재가 아니라 grant 범위 + 정책 USING의 상태 조건 + 확정 가드의 3중 결속**이다 — 지울 수 있는 것은 미확정 실행의 파생물과 미확정 스냅샷의 시계열뿐이다 |
| append-only 12종 | UPDATE·DELETE | 이력 위조 경로가 없다. prevent_mutation()이 트리거로 다시 막는다 |
| users · password_reset_tokens | 앱 롤 grant | 서버 전용. SECURITY DEFINER 함수로만 접근한다 |
| profiles | 동료 SELECT · **관리자의 이메일 열람** | 동료 정보는 정책이 아니라 list_workplace_members() 반환 타입이 제한한다. **관리자 세션에서 직원 recovery_email을 읽을 수 없는 것은 결함이 아니라 설계다** — SELECT 축이 본인과 플랫폼 조회 권한 둘뿐인 것이 개인정보 보호의 축이며, 통지가 필요하면 **메일이 아니라 notifications 축을 연다** |
| payroll_validation_results | STAFF SELECT | 내부 판정 경고를 직원에게 노출하지 않는다 |
| location_usage_records | 관리자 SELECT | 확인자료는 정보주체 전용이다 |
| notifications | 관리자 SELECT | 개인 수신함이다 |
| compliance_tasks | STAFF SELECT | 사업주의 의무 관리 도구다 |
| employee_count_snapshot_days | UPDATE | 재산정은 새 스냅샷 + 새 시계열이다 |
| leave_transactions | UPDATE | 원장이 진실 원천이다 |
| income_tax_table_entries | UPDATE | 정정은 새 rate_id 버전 전체 재적재다 |
| **idempotency_records** | DELETE · sys() 축 | 부분 UNIQUE가 status <> 'DISCARDED'로 좁혀 **물리 삭제 없이 재시도를 연다**. 멱등 표면은 전부 사용자 요청 경로라 배치가 읽는 자리도 없다 |
| documents | 파일 접근 정책 | **RLS는 메타 행 가시성만 담당한다.** 실체 접근은 S3 정책 + 서비스 인가 + 1회용 토큰이다 |

---

## 본인 소유권 인가 (CMP-07)

**퇴사·폐쇄 후 본인 열람은 멤버십이 아니라 employees.user_id로 판정한다.** 이것이 legacy 설계와 갈리는 가장 중요한 지점이다.

| 대상 | 인가 축 | 정책 # |
|------|--------|:------:|
| 명세서 | payslips.user_id = uid | 116 |
| 교부·열람 이력 | payslip_deliveries.user_id = uid | 119 |
| 급여 결과 | payroll_employee_results.user_id = uid | 109 |
| 급여 항목 라인 | payroll_employee_result_items.user_id = uid | 112 |
| 근로계약 | is_self_employee(employee_id) AND status IN ('SENT','SIGNED','ARCHIVED') | 60 |
| 전자서명 증적 | signer_user_id = uid | 63 |
| 인사 레코드 | is_self_employee(id) | 43 |
| 퇴직급여 판정 | is_self_employee(employee_id) | 127 |
| 근태 원본·집계·요청 | user_id = uid | 68 · 74 · 77 |
| 연차 발생·원장·잔액 | user_id = uid | 89 · 95 · 97 |
| 보호 기간(출근 간주) | employee_protected_periods.user_id = uid | 162 |

검산: 급여·명세서 축 4 + 계약 축 2 + 인사 축 2 + 근태 축 3 + 휴가 축 **4** = **15지점**.

### 계정 상태 조건 — DELETED만 차단한다

**15지점의 소유권 축에 계정 상태 조건을 넣을지가 쟁점이었다.** REQ-AUT-18은 "정지 중에는 모든 권한 헬퍼가 거부를 반환한다"고 하고, CMP-07은 퇴사·폐쇄 후에도 본인 열람이 끊기지 않아야 한다고 한다. 두 요구가 같은 축에서 부딪힌다.

| 상태 | 판정 | 근거 |
|------|------|------|
| ACTIVE | 열린다 | 기본 |
| **SUSPENDED** | **열린다** | 정지는 **세션 폐기가 1차 차단**이므로 그 계정으로 새 요청이 성립하지 않는다. 제재를 이유로 이미 발생한 임금의 명세서 열람까지 끊으면 법정 교부 의무와 충돌한다 |
| **DELETED** | **차단한다** | 탈퇴·강제 삭제는 종단이고 재로그인 경로가 없다. 열어 둘 이유가 없으며, 남은 법정 보존 데이터는 사업장 관리자 축과 플랫폼 감사 축으로 접근한다 |

- **소유권 축이 멤버십을 보지 않는 것과 계정 상태를 보지 않는 것은 다른 문제다** — 전자는 CMP-07의 요구이고, 후자는 판정을 넣지 않으면 삭제된 계정의 uid로 주입된 컨텍스트가 그대로 통한다는 뜻이다. GUC는 서버가 넣는 값이라 실제 위험은 낮지만, **fail-closed 설계에서 상태 축을 비워 두는 것은 근거 없는 신뢰**다.
- 판정은 is_self_employee()와 user_id = uid 축 양쪽에 같은 형태로 들어간다 — profiles.status <> 'DELETED'.

- **workplace_members 조인으로 짜면 퇴사·폐쇄 순간 접근이 끊긴다.** 명세서는 지급일 + 3년 보존·교부 대상이므로 그 자체가 위반 소지다.
- 그것을 물리적으로 가능하게 하는 것이 **비정규화 user_id**다. employees를 조인하면 employees 자신의 정책이 다시 평가되고, 고volume 테이블에서 행마다 조인이 발생한다.
- sync_employee_user_id() 트리거가 employees.user_id 변경을 이 컬럼들에 전파한다([09_functions_triggers.md](./09_functions_triggers.md)).

---

## 2단 방어에서의 위치

```
① 클라이언트 가드   — 보조. 어느 판정의 근거도 아니다
        ↓
② 서비스 레이어     — 1차 검증. 권한·상태·입력 유효성
        ↓
③ RLS 정책          — 2차 심층방어. 행 단위 격리
        ↓
④ 제약·트리거       — 무결성·상태 전이·확정 불변
```

- **신뢰 계층은 ②~④ 3계층이다.** ①은 신뢰 계층이 아니라 사용성 보조이며, 웹은 정적 호스팅이라 요청을 가로채는 서버 계층이 존재하지 않는다(D-20).
- **서비스 레이어가 통과시킨 요청도 RLS를 통과해야 한다.** 서비스 코드의 결함이 곧바로 테넌트 경계 붕괴가 되지 않게 하는 것이 RLS의 목적이다.
- 반대로 **RLS만으로는 부족하다** — 컬럼 단위 제한·상태 전이·값 검증은 정책이 표현하지 못하므로 트리거가 맡는다.

### GUC 주입 계약

**DataSource 프록시가 트랜잭션에 커넥션이 바인딩되는 순간** app.current_user_id를 주입한다 — 호출부가 주입을 책임지지 않는다(D-21 · ADR-28). **나머지 4종은 성격이 다르다** — 서버 전용 경로와 각 서버 함수가 자기 트랜잭션 안에서 직접 켜는 플래그이며 **프록시가 대신 켜지 않는다.**

| GUC | 값 | 주입 주체 | 읽는 헬퍼 |
|-----|----|----------|----------|
| **app.current_user_id** | 인증 주체 uuid | **DataSource 프록시** — 트랜잭션 진입 시 주입하며 **값의 출처는 인증 컨텍스트**다 | current_user_id() |
| **app.system_context** | 'on' | 서버 전용 서비스·배치 | is_system_context() |
| **app.invitation_accept_context** | 'on' | accept_workplace_invitation() 내부 | is_invitation_accept_context() |
| **app.workplace_close_context** | 'on' | 사업장 폐쇄 서버 함수 내부 | is_workplace_close_context() |
| **app.workplace_reverify_context** | 'on' | 사업자 재검증 정정 서버 함수 내부 | is_workplace_reverify_context() |

```sql
SELECT set_config('app.current_user_id', $1, true);
```

- **set_config의 세 번째 인자 true가 SET LOCAL과 같은 의미다** — 트랜잭션 지역 설정이다. 커넥션 풀에서 전역 SET을 쓰면 값이 다음 요청으로 새어 나가 다른 사용자의 컨텍스트로 쿼리가 실행된다.
- **GUC 이름과 값을 SQL 문자열에 이어 붙이지 않는다.** SET LOCAL 구문은 값 자리에 바인드 파라미터를 받지 못해 문자열 조립을 강요하지만, set_config는 값을 파라미터로 받으므로 주입 경로가 없다. 다섯 GUC 전부 같은 형태로 주입한다.
- **주입 지점은 데이터소스 한 곳이며 두 데이터 접근 축이 같은 데이터소스·같은 트랜잭션을 공유하므로 주입이 한 번에 걸린다**(D-21 · ADR-26 · ADR-28). 모든 업무 쿼리를 트랜잭션 안에서만 실행하고, **커넥션 풀의 연결 초기화 구문으로 주입하지 않는다** — 풀 생성 시 1회만 실행돼 사용자별 값을 담지 못하고 전역 설정은 다음 요청으로 샌다. 프록시 밖에서 연결·영속성 컨텍스트·SQL 세션을 직접 얻는 코드는 아키텍처 테스트가 차단한다.
- **주입이 없으면 current_user_id()가 NULL이고 전 정책이 false를 반환한다** — 기본 거부가 곧 안전한 실패다.
- app.system_context는 서버 전용 경로에서만 켠다. 이 플래그가 클라이언트 요청 경로에서 켜지면 users·password_reset_tokens가 통째로 열리므로, 주입 지점을 서비스 계층 한 곳으로 제한한다.
- **뒤 세 GUC는 전부 같은 형태다** — 서버 함수 한 곳에서만 켜고, 트랜잭션이 끝나면 사라지며, 전용 헬퍼가 읽는다. **"같은 트랜잭션 안인가"는 행 값으로 알 수 없으므로** 폐쇄의 멤버십 종료 예외와 불변 3필드 정정처럼 좁은 예외를 여는 자리에는 컨텍스트 축이 필요하다.
- **컨텍스트가 여는 것은 경로이지 검증 면제가 아니다** — 재검증 정정은 컨텍스트에 더해 같은 트랜잭션의 MATCH 검증 로그를 함께 요구하고, 수락 컨텍스트는 사업장 쓰기 가능 판정을 함께 요구한다.

---

## 관련 문서

- 폴더 정본·접근 모델 → [README.md](./README.md)
- 전역 ERD·관계 요약 → [erd.md](./erd.md)
- 제약·enum·FK 정책 전수 → [07_constraints_integrity.md](./07_constraints_integrity.md)
- 함수·트리거 전수(헬퍼 구현·가드) → [09_functions_triggers.md](./09_functions_triggers.md)
- 마이그레이션 배치(V06xx grants) → [10_migrations_seed.md](./10_migrations_seed.md)
- 멀티테넌시·2단 방어 아키텍처 → [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)
- RLS 격리 위협 서술 → [../10_security/02_rls_isolation.md](../10_security/02_rls_isolation.md)
- 플랫폼 RBAC → [../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)
- 전역 규칙(2단 방어·소유권 인가) → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
