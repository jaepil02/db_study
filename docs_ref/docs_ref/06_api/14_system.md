# 06_api / 14 시스템 관리 (SYS)

> **대상**: SYS 도메인 REST 표면 — 플랫폼 RBAC 판정과 권한 조회 · 사업장 조회와 정지·해제·강제 폐쇄 · 사용자 조회와 보조 재설정·제재·강제 삭제 · 요금제 관리와 계정 구독 수동 조정 · 감사 로그 조회와 내보내기 · 기준값 관리 · 약관/개인정보/위치정보 문서 관리 · **정기작업 재실행** · **시스템 콘솔 목록 내보내기 발급(DSH-06)**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **#3 사업장 목록에 구독 만료 시각(subscriptionExpiresAt) · #8 계정 목록에 정지 해제 예정일(suspendedUntil)을 더한다** — 만료 임박 사업장과 곧 풀리는 정지 계정을 상세를 열지 않고 목록에서 고르게 한다. 구독 만료는 구독 소유자(활성 OWNER) 계정의 구독 행이고 subscription:view가 없으면 비어 나간다. 해제 예정일은 **지금 정지 중인 계정에만** 마지막 정지 전이의 값을 싣고, 상태 이력 정책이 시스템 관리자를 요구하므로 그 밖의 역할에게는 비어 나간다. #36 내보내기 열에 두 값을 더하고 **system_workplaces의 ownerName 열 머리글을 대표자 → 구독 소유자로 정정**한다(목록의 ownerName은 사업자등록증 대표자명이 아니라 OWNER 계정 이름이다). 함께 **#3 · #8 · #17 검색의 이스케이프 누락을 고친다** — 2026-09-16 개정이 매퍼에 ESCAPE를 걸었으나 서비스가 검색어를 부분 일치 패턴으로 감싸지 않고 원문을 넘겨 **가운데 글자로는 찾지 못했다**(`%` · `_`도 와일드카드로 남았다). 시험이 접두 일치 검색어만 써서 드러나지 않았다. **표면 수 · 번호 · 권한 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-17 — **#36 목록 표의 listType 3종을 system_ 접두 규칙에 맞춘다** — statutory_rates → system_statutory_rates · size_policies → system_size_policies · terms_documents → system_terms_documents(테이블명 statutory_rates · terms_documents 자체는 바뀌지 않는다 — listType 표기만 접두를 문다). **표면 수 · 번호는 전건 불변**
> **개정일**: 2026-09-16 — **#36 목록 표에 시스템 콘솔 listType 6종을 등재**한다(system_workplaces · system_users · system_subscriptions · statutory_rates · size_policies · terms_documents) — 이 표가 "아직 등재된 목록이 없다"로 비어 있었다. 민감(●)은 계정 목록(system_users)뿐이다. **표면 수 · 번호는 전건 불변**
> **개정일**: 2026-09-16 — **#8 계정 목록·#17 계정 구독 목록의 ILIKE 이스케이프 결함을 고친다** — 매퍼가 검색어를 이스케이프 없이 감싸 `%`·`_`가 들어간 검색어에서 의도와 다른 행이 잡혔다(**#3 사업장 목록은 q가 이미 표에 있었고 같은 결함을 같은 자리에서 고쳤다**). 함께 **#23 기준값 목록·#27 규모 정책 목록·#30 약관 문서 목록에 검색 축 q를 신설**한다. **#19 감사 로그 조회 응답에 totalCount(선택)를 더한다** — 첫 묶음(커서 없음)에만 싣는다. q 길이 상한 50 · ESCAPE 규약 · totalCount 계약의 정본은 [01_conventions.md](./01_conventions.md)다. **표면 수 · 번호 · 권한 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-16 — **표면 35 → 36**(REST 34 → **35**) — **DSH-06 리포트 내보내기**(D-23)의 시스템 콘솔 발급 **#36 POST /v1/system/list-exports**를 말미에 채번한다. 계약 · 다운로드 · 감사의 정본은 [04_workplace.md](./04_workplace.md) #35 · #36이고 **다운로드는 그 문서의 #36을 함께 쓴다**(사업장 경로 밖 토큰 소유자 축). 권한은 **목록 조회 표면의 권한 키 그대로**이며 키를 신설하지 않는다. export.forbidden/403의 **v1 미발생 등재를 걷는다** — 표면이 어긋난 목록 요청이 첫 발생 지점이 됐고, 감사 로그 내보내기(#20)에서는 여전히 발생하지 않는다. 기능 열 DSH-06은 [../02_features/02_workplace.md](../02_features/02_workplace.md)가 갖는 기능이라 **SYS 7 검산에 넣지 않는다.** 멱등 필수 표면 수 인용 두 자리("10표면")를 걷는다 — 일괄 승인·반려로 14가 됐고 수는 [01_conventions.md](./01_conventions.md)가 갖는다
> **개정일**: 2026-09-10 — **#3 사업장 목록 응답에 activeMemberCount를 더한다** — 상세(#4)에만 있어 **목록에서 규모를 보려면 행마다 상세를 불러야 했고**, 그것이 파생 열을 행마다 조회하지 않는다는 화면 규약이 금지하는 형태다. **#4가 쓰던 정의자 헬퍼(active_member_count)를 그대로 부른다** — 표에 플랫폼 축을 여는 대신 값 하나만 내는 자리이며 두 표면이 다른 수를 말하지 않는 근거가 그것이다. **멤버 수는 민감 데이터가 아니라 규모 지표**이고 금지 행이 막는 것은 급여·주민번호다. **표면 수 35 · 번호 · 권한 · 에러 코드는 전건 불변** — 응답 필드 추가는 v1 안의 변경이다. **화면 정본([../07_screen/10_system_console.md](../07_screen/10_system_console.md) SYS-WORKPLACES)이 아직 「활성 멤버 수는 목록 표면에 없다」로 남아 있다** — 서버가 값을 내게 됐으므로 그쪽의 후속 개정 대상이다
> **개정일**: 2026-09-10 — **표면 2건 채번**(#34 · #35)으로 이 문서 표면 33 → **35**(REST 32 → **34**)이며 **고정 기준이 움직인다 — API 표면 256 → 258 · REST 228 → 230**(정본 [../README.md](../README.md)). ① **#34 POST /v1/system/jobs/{job}/rerun** 정기작업 재실행 — 정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)가 "수동 재실행이 동일 결과를 내야 한다"를 계약하고 [../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md)가 dead letter 의 재개를 "담당자의 명시 조작"으로만 규정하는데 **그 조작의 표면이 없었다.** 연차 발생이 정기작업 하나뿐이라 소급 발생 경로가 아예 없던 자리이며, 그 문서의 관련 문서 절이 이미 이 문서를 운영 트리거 정본으로 가리키고 있었다. **기능ID를 신설하지 않는다** — 정기작업이 94기능 집계 밖이라 채번하면 기능 94가 움직이므로, 표면 표의 기능 열은 (정기작업) 병기와 정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) 링크로 적는다. **화면 자리는 SYS-RATES 운영 절**이다(화면 채번 정본은 [../07_screen/README.md](../07_screen/README.md)이며 이 문서는 인용만 한다). ② **#35 GET /v1/system/terms-documents/{termsDocumentId}** 약관 문서 단건 전문 — 목록(#30)이 본문을 싣지 않고 공개 조회(#33)는 활성본만 열어 **비활성본·초안의 문안을 확인할 경로가 없었다**. **에러 코드를 신설하지 않는다** — #34의 락 경합은 common.conflict/409(채번 정본이 "락 획득 실패의 폴백"으로 규정한다) · #35의 부재는 common.not_found/404다. **#34의 권한 키도 신설하지 않는다** — settings:update 를 쓰며 그 키가 여는 축이 플랫폼 마스터 데이터 넷에서 **플랫폼 운영 다섯**으로 넓어진다(정본 [../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)를 같은 변경 단위에서 고쳤다). 감사 action 코드 **scheduled_job.rerun**을 채번했다(정본 [../05_database/15_system.md](../05_database/15_system.md) · 그 밖의 축 6 → **7** · 전수 57 → **58**). **변이 표면 17 → 18 · 사유 비필수 다섯 → 여섯**이며 **권한 키 27종 · 사유 필수 12 · 사업장 개방 33 · 멱등 1표면 · 쪽 나눔 9표면은 전건 불변**
> **개정일**: 2026-09-10 — **#10 보조 비밀번호 재설정의 대행 방식을 결정으로 닫는다** — 채택안은 **복구 이메일 대리 등록**이며 나머지 둘(임시 비밀번호 발급 · 토큰 대면 전달)은 **평문 자격 증명이 지원 담당을 지난다**는 이유로 버린다. **등록과 발송이 한 표면·한 트랜잭션**이고 강제 지점은 서버 함수 issue_assisted_password_reset 안이다(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 **#44** — 헬퍼 42 → **43종**). **본인 확인 수단을 선택지 3값으로 필수화**하되 **사유는 비필수를 유지**한다 — 「왜」와 「어떻게 확인했나」는 다른 축이라 사유 필수 목록이 움직이지 않는다. **이미 복구 이메일이 등록된 계정은 거부한다**(common.conflict/409) — 덮어쓰기를 허용하면 이 표면 자체가 계정 탈취 경로가 된다. **에러 코드를 신설하지 않고 전부 인용**했으며 기록 구조의 정본은 [../05_database/15_system.md](../05_database/15_system.md)다. 같은 자리에서 연동 표의 **사유 비필수 넷 → 다섯**을 정정한다 — 변이 표면 17 − 사유 필수 12 = **5**인데 열거는 다섯을 적고 계수만 넷이었다. **표면 수 33 · 번호 · 권한 · 사유 필수 12는 전건 불변**
> **개정일**: 2026-09-09 — **#10 보조 비밀번호 재설정의 대행 방식을 미결로 등재**한다 — REQ-AUT-15가 "보조 재설정을 안내한다"까지만 정하고 **SUPPORT가 무엇을 하는지**를 비워 두었다. 갈래 셋(임시 비밀번호 발급 · 복구 이메일 대리 등록 · 토큰 대면 전달)의 **보안 성질이 각각 달라** 남길 감사 기록과 요구할 본인 확인이 갈리므로 표면 계약이 서지 않는다. **감사 코드 account.reset_password_assisted가 채번돼 있으면서 미참조인 것은 결함이 아니라 이 미결의 신호**다. **표면 수 33 · 번호 · 권한은 전건 불변**
> **개정일**: 2026-09-09 — **V0726** 반영 — 이 문서의 계약 넷이 스키마에서 성립하지 않던 자리를 등재한다. ① **#7이 보존 안내 확인을 채우지 않고 열을 NULL로 둔다**(가드가 그 열을 NOT NULL로 요구해 강제 폐쇄가 성립하지 않았다) ② **#13의 소유 사업장 예외를 행위자의 user:delete 권한으로 판정한다**(GUC를 늘리지 않는다) ③ **#11 · #12가 정의자 서버 함수 경로**이며 #12는 기한을 보지 않는다 ④ **#4의 최근 급여 확정 시각을 정책이 아니라 헬퍼가 낸다.** **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**이다 — 계약은 그대로이고 그것을 세우는 자리가 생겼다
> **개정일**: 2026-09-07 — **V0719** 반영으로 연동 표 audit_logs 열거를 **완성**한다 — 미채번이던 넷(#10 account.reset_password_assisted · #15 plan.create · #16 plan.update · #18 subscription.adjust)이 채번돼 **변이 표면 17 전부에 코드가 있다.** 규약 행의 병기(넷이 계약을 채우지 못한다)를 걷었고 **이제 열거가 그 계약의 증명이다.** 사유 필수는 열하나 → **열둘**(#18 추가)이며 **사유 필수 항목 15 → 16**의 근거가 이 표면이다. **사업장 개방 31 · 정책 172 · 함수 수는 불변** — 넷 다 플랫폼·계정 축이라 사업장 관리자에게 열지 않는다
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행의 **포괄 표기("전 변이 표면 INSERT")를 표면별 열거로 바꾼다.** 변이 표면 **17**을 system 축 코드와 대조해 **13은 짝이 맞고 넷(#10 · #15 · #16 · #18)은 붙일 코드가 없음**을 확인했고, 넷을 미채번으로 등재했다. #28 · #29는 **새 코드를 만들지 않고** statutory_rate.create·update로 귀속한다(연동 표상 둘 다 statutory_rates 쓰기이고 SIZE_POLICY는 그 테이블의 category 하나다). **코드는 있으나 v1 표면이 없는 셋**(system_admin.grant_role · revoke_role · bootstrap)은 역할 임명 UI 미채택과 기동 부트스트랩이라 **의도된 공백**임을 함께 적었다. 규약 행의 "모든 변이 표면이 audit_logs 대상이다"는 유지하되 **넷이 아직 그 계약을 채우지 못한다**를 병기했다 — **포괄 표기는 검증되지 않은 채로 참처럼 읽힌다.** **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-09-07 — 알림 타입 **22 → 24종** · 필수 **4 → 5종** 인용 갱신(V0717 — **contract_sent**(필수) · **contract_signed** 채번. 정본 [../05_database/13_notification.md](../05_database/13_notification.md) · REQ 정본 [../03_requirements/11_notification.md](../03_requirements/11_notification.md)). **contract_sent가 필수인 근거는 법정 교부**다 — 근로기준법 §17② 교부는 발송이 성립해야 이행이므로 채널이 막히면 증적만 남고 이행이 없다. 법정 교부 축이 명세서 하나에서 **둘**이 된다
> **개정일**: 2026-09-07 — 사유 필수 ⑦의 표기를 **강제 폐쇄 → 사업장 폐쇄(자발·강제)**로 넓힌다(V0712 판정 배열 확장 · 채번 정본 [../05_database/15_system.md](../05_database/15_system.md)). 자발 폐쇄도 되돌릴 수 없고 사업장 운영이 즉시 멈추므로 사유를 요구하는 근거가 강제 폐쇄와 같다. **사유 필수 항목 15는 불변**이고 action 코드가 25 → **26**이 된 것이다
> **개정일**: 2026-09-07 — 멱등 행의 기록 축 표기를 갱신한다(V0711) — (user_id, idempotency_key) → idempotency_records의 **scope_type = 'USER'**. **표면 수·필수 여부는 불변**이며 저장처가 문서에 없던 것을 잇는다
> **개정일**: 2026-09-07 — 감사 내보내기 구현 계약 등재 — **산출물 보존 24시간**(다운로드 토큰 수명과 별개 축) · 생성·다운로드가 각각 감사에 남고 phase가 둘을 가른다 · 다운로드 기록의 사유는 생성 시점의 것을 쓴다 · 산출물을 documents에 등록하지 않는다(사업장 열 필수)
> **개정일**: 2026-09-07 — export.forbidden/403을 **v1 미발생으로 등재**(audit:view 보유자의 조회 범위를 좁히는 축이 v1에 없어 발생 조건이 성립하지 않는다 · 코드는 폐기하지 않고 남긴다) · #19·#20의 권한 미충족을 system.permission_denied/403으로 명시
> **개정일**: 2026-09-07 — #25·#29의 갱신 축을 **확인 메타와 출처로 정정**(값·유효기간·버전은 가드 트리거가 UPDATE를 거부하며 변경은 새 버전 행 등록이다 — 따라서 두 표면에서 유효기간 겹침이 성립하지 않는다) · #26 조회 축 명칭을 과세표준 → **월 급여액**으로 정정하고 payDate 필수 표기
> **개정일**: 2026-09-07 — #27~#29 예시를 적재된 정책값 표기에 맞춤 — clauseTitle을 표시명으로 좁히고 **article(법령 조항 표기) 등재** · 응답의 reason을 확인 상태로 교체(사유의 저장처는 audit_logs이며 행에 열이 없다). 값 키 정본은 05_database/15_system.md의 SIZE_POLICY value 구조 절
> **개정일**: 2026-08-09 — 요금제 한도 변경 영향 미리보기를 **#15·#16의 dryRun 질의**로 확정(별도 표면 미채번 · 엔드포인트 수 불변) · statutory_rates version 표기를 문자열 "2026.1" · "2021.1" → **정수 연번**으로 정정(스키마 정본 [../05_database/15_system.md](../05_database/15_system.md) integer에 맞춤)
> **개정일**: 2026-08-09 — 전역 수치 정합 — 기준값 카테고리 17 → **19종**(통상근로자 소정근로시간 · 신고·납부 기한 규칙) · CHECK 17 → **19값**
> **개정일**: 2026-08-08 — 제재 해제·강제 폐쇄 통보를 메일 + 감사 로그로 확정하고 부수효과에서 알림 생성 제거(알림 타입 22종 불변) · 권한 키 집합에 verification:view/search · analytics:export · system_admin:view 등재(전수 27종 정합)
> **원천**: [../03_requirements/13_system.md](../03_requirements/13_system.md)(REQ-SYS-01~16) · [../02_features/12_system.md](../02_features/12_system.md)(SYS 7기능) · [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)(플랫폼 RBAC 4단계) · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)(§1.3 기준값 조회 계약)

**플랫폼 RBAC는 사업장 RBAC와 완전히 별개**다. 사업장 OWNER라도 플랫폼 권한이 없으면 /v1/system 경로에 진입조차 못 하며, 그 거부는 역할 부족(system.permission_denied/403)이 아니라 **플랫폼 권한 부재**(auth.platform_forbidden/403)다. 두 코드를 구분하는 이유는 전자가 진입 후 특정 액션만 막히는 상태이고 후자가 진입 자체가 막히는 상태이기 때문이다.

**권한은 resource:action 명시적 화이트리스트**이며 **알 수 없는 권한 키는 기본 거부**한다. 와일드카드형 부여를 두지 않는 근거는 새 자원이 추가될 때 의도치 않게 권한이 열리기 때문이며, 특히 **audit:view와 audit:export는 VIEWER에 포함되지 않는다**.

**기준값 테이블이 비어 있으면 급여 계산이 아예 불가능하다.** 그래서 이 도메인은 두 방향을 함께 강제한다 — 유효기간 겹침을 DB 제약으로 막고, **확인되지 않은 값은 시드하지 않으며 확인자 필드가 빈 행은 미확인으로 간주해 계산을 차단**한다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 운영 표면은 /v1/system/… 이며 **사업장 스코프가 없다**. 공개 약관 조회(#33)만 /v1/terms/… 다 |
| 권한 축 | 플랫폼 RBAC 4단계 — VIEWER(1) · SUPPORT(2) · ADMIN(3) · SUPER_ADMIN(4). 누적이며 사업장 역할과 무관하다 |
| 진입 판정 | ① 플랫폼 권한 보유 여부 → 없으면 **auth.platform_forbidden/403** ② 권한 키 보유 여부 → 없으면 **system.permission_denied/403**. **만료일이 지난 역할은 무효**다 |
| 사유 필수 | 제재 · 역할변경 · PII 복호화 · 급여 무효화/정정 · 기준값 변경 · 감사 내보내기 · **사업장 폐쇄**(자발·강제)는 **reason이 필수**다(REQ-GLB-17) |
| 감사 | 이 도메인의 **모든 변이 표면이 audit_logs 대상**이다 — 연동 테이블 절의 **표면별 열거가 그 계약의 증명**이며 변이 표면 18이 전부 코드를 갖는다. **before/after에 PII 원문을 저장하지 않는다** — 마스킹 값 · 참조 ID · 변경 분류만 남긴다 |
| 감사 불변 | **감사 로그는 수정·삭제가 불가능**하다. 정정이 필요하면 새 정정 로그를 추가하며 그래서 UPDATE·DELETE 표면이 없다 |
| 멱등 | 감사 내보내기 생성(#20) **1표면**이 Idempotency-Key 필수다. 사업장 스코프가 없어 idempotency_records에 **scope_type = 'USER'** 로 기록한다 — 멱등 필수 표면 중 계정 축은 이 하나뿐이다(계약 정본 [01_conventions.md](./01_conventions.md) 멱등 절) |
| 페이지네이션 | 오프셋 8표면(#2 · #3 · #8 · #17 · #23 · #26 · #27 · #30) · 커서 1표면(#19). **감사 로그는 시간 역순 무한 증가라 커서**다 |
| 목록 내보내기 | #36은 **그 목록 조회 표면의 권한 키를 그대로** 판정한다 — 내보내기 전용 키를 두지 않는다. analytics:export는 통계 산출물의 반출 축이라 목록 반출에 쓰지 않는다 |
| PII 접근 | 조회 표면은 **민감정보를 마스킹**한다. 급여 원문·PII 접근은 어느 레벨에서도 자동으로 열리지 않으며 별도 권한 + 사유 + 감사를 요구한다 |
| v1 경계 | **역할 임명 UI를 v1에 두지 않는다.** 초기 SUPER_ADMIN은 서버 기동 시 환경변수 1회성 부트스트랩으로 만들고(시드 아님) 이후 부여·회수는 운영 절차로 처리한다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | GET /v1/system/me/permissions | 플랫폼(VIEWER) | — | SYS-01 |
| 2 | REST | GET /v1/system/admins | 플랫폼(SUPER_ADMIN) | 오프셋 | SYS-01 |
| 3 | REST | GET /v1/system/workplaces | 플랫폼(VIEWER) | 오프셋 | SYS-03 |
| 4 | REST | GET /v1/system/workplaces/{workplaceId} | 플랫폼(VIEWER) | — | SYS-03 |
| 5 | REST | POST /v1/system/workplaces/{workplaceId}/suspend | 플랫폼(ADMIN) | — | SYS-03 |
| 6 | REST | POST /v1/system/workplaces/{workplaceId}/unsuspend | 플랫폼(ADMIN) | — | SYS-03 |
| 7 | REST | POST /v1/system/workplaces/{workplaceId}/close | 플랫폼(ADMIN) | — | SYS-03 |
| 8 | REST | GET /v1/system/users | 플랫폼(VIEWER) | 오프셋 | SYS-04 |
| 9 | REST | GET /v1/system/users/{userId} | 플랫폼(VIEWER) | — | SYS-04 |
| 10 | REST | POST /v1/system/users/{userId}/password-reset | 플랫폼(SUPPORT) | — | SYS-04 |
| 11 | REST | POST /v1/system/users/{userId}/suspend | 플랫폼(ADMIN) | — | SYS-04 |
| 12 | REST | POST /v1/system/users/{userId}/unsuspend | 플랫폼(ADMIN) | — | SYS-04 |
| 13 | REST | DELETE /v1/system/users/{userId} | 플랫폼(SUPER_ADMIN) | — | SYS-04 |
| 14 | REST | GET /v1/system/plans | 플랫폼(VIEWER) | — | SYS-05 |
| 15 | REST | POST /v1/system/plans | 플랫폼(ADMIN) | — | SYS-05 |
| 16 | REST | PATCH /v1/system/plans/{planCode} | 플랫폼(ADMIN) | — | SYS-05 |
| 17 | REST | GET /v1/system/subscriptions | 플랫폼(VIEWER) | 오프셋 | SYS-05 |
| 18 | REST | PATCH /v1/system/subscriptions/{userId} | 플랫폼(ADMIN) | — | SYS-05 |
| 19 | REST | GET /v1/system/audit-logs | 플랫폼(ADMIN) | 커서 | SYS-07 |
| 20 | REST | POST /v1/system/audit-logs/exports | 플랫폼(ADMIN) · 멱등 | — | SYS-07 |
| 21 | REST | GET /v1/system/audit-logs/exports/{exportJobId} | 플랫폼(ADMIN) | — | SYS-07 |
| 22 | 다운로드 | GET /v1/system/audit-logs/exports/download/{token} | 토큰 소유자 | — | SYS-07 |
| 23 | REST | GET /v1/system/statutory-rates | 플랫폼(VIEWER) | 오프셋 | SYS-08 |
| 24 | REST | POST /v1/system/statutory-rates | 플랫폼(ADMIN) | — | SYS-08 |
| 25 | REST | PATCH /v1/system/statutory-rates/{rateId} | 플랫폼(ADMIN) | — | SYS-08 |
| 26 | REST | GET /v1/system/income-tax-table-entries | 플랫폼(VIEWER) | 오프셋 | SYS-08 |
| 27 | REST | GET /v1/system/size-policies | 플랫폼(VIEWER) | 오프셋 | CMP-02 |
| 28 | REST | POST /v1/system/size-policies | 플랫폼(ADMIN) | — | CMP-02 |
| 29 | REST | PATCH /v1/system/size-policies/{sizePolicyId} | 플랫폼(ADMIN) | — | CMP-02 |
| 30 | REST | GET /v1/system/terms-documents | 플랫폼(ADMIN) | 오프셋 | SYS-11 |
| 31 | REST | POST /v1/system/terms-documents | 플랫폼(ADMIN) | — | SYS-11 |
| 32 | REST | POST /v1/system/terms-documents/{termsDocumentId}/activate | 플랫폼(ADMIN) | — | SYS-11 |
| 33 | REST | GET /v1/terms/{kind}/active | 미인증 | — | SYS-11 |
| 34 | REST | POST /v1/system/jobs/{job}/rerun | 플랫폼(ADMIN) | — | **(정기작업)** [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) |
| 35 | REST | GET /v1/system/terms-documents/{termsDocumentId} | 플랫폼(ADMIN) | — | SYS-11 |
| 36 | REST | POST /v1/system/list-exports | 플랫폼(목록의 조회 권한 키) | — | DSH-06 |

- 36행 = REST **35** · 다운로드 **1**이다. **#36의 다운로드는 [04_workplace.md](./04_workplace.md) #36이다** — 표면을 둘 두지 않는다. SSE·서버 내부 표면은 없다 — 계정 정지 만료 복귀 배치(autoUnsuspendAccounts)는 [03_auth.md](./03_auth.md)가 소유한다. **#34가 그 사실을 뒤집지 않는다** — 정기작업을 다시 돌리는 요청 표면이지 정기작업 자체가 아니며, 작업 8건의 서버 내부 종점은 각 소유 도메인 문서가 갖는다.
- **#34의 기능 열은 기능ID가 아니라 정본을 가리킨다.** 정기작업은 기능ID를 갖지 않는 서버 실행 항목이라 기능 집계에 들어가지 않으며 그 운영 트리거도 같은 축이다 — **여기서 기능ID를 채번하면 기능 수가 움직인다**(값은 정본 [../02_features/README.md](../02_features/README.md)가 갖는다). 그래서 (정기작업) 병기와 함께 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)를 적는다: 작업 8건이 각각 관련 기능을 갖고 **그 매핑의 정본이 그 문서**이므로, 이 칸이 가리켜야 할 것은 없는 ID가 아니라 있는 정본이다.
- **CMP-02 규모별 적용 정책의 관리 표면(#27~#29 — 조회 #27은 플랫폼(VIEWER) · 변경 #28·#29는 플랫폼(ADMIN))이 이 문서에 있다.** 기능 자체는 법정 준수 도메인이지만 **관리 축이 플랫폼**이라 표면이 여기 놓인다 — 사업장 관리자가 자기 사업장의 법 적용 조문을 바꿀 수 있으면 규모 분기가 사업장 재량이 된다.
- **기준값·약관 삭제 표면을 두지 않는다.** 참조된 값은 비활성화만 허용하며 삭제 시도는 409로 거부한다.

## 상세

### 1·2. 플랫폼 권한 조회·관리자 목록 (SYS-01)

```json
{
  "role": "ADMIN",
  "level": 3,
  "expiresAt": null,
  "permissions": [
    "workplace:view", "workplace:search", "workplace:suspend", "workplace:unsuspend", "workplace:close",
    "user:view", "user:search", "user:reset_password", "user:suspend", "user:unsuspend",
    "subscription:view", "subscription:update", "plan:view",
    "statutory:view", "settings:update", "analytics:view", "analytics:export",
    "verification:view", "verification:search",
    "support:act", "audit:view", "audit:export"
  ]
}
```

역할별 권한 집합은 **정적 상수로 선언**하며 누적이다.

| 역할 | 레벨 | 권한 집합 |
|------|:----:|----------|
| VIEWER | 1 | workplace · user · subscription · plan · statutory · analytics의 **view와 search만** |
| SUPPORT | 2 | VIEWER + support:act · **user:reset_password** · verification:view · verification:search |
| ADMIN | 3 | SUPPORT + user:suspend/unsuspend · workplace:suspend/unsuspend/close · subscription:update · settings:update · **audit:view/export** · analytics:export |
| SUPER_ADMIN | 4 | ADMIN + admin:manage · admin:grant_role · **user:delete** · system_admin:view |

- **audit:view/export는 VIEWER에 포함되지 않는다**(REQ-SYS-02). 와일드카드형 권한이 새면 감사 로그 열람 같은 고위험 액션이 조회 권한자에게 흘러간다.
- **알 수 없는 권한 키는 기본 거부**다. 화이트리스트에 없는 키를 요구하는 표면은 통과하지 못한다.
- #2는 SUPER_ADMIN 전용 조회다. **v1은 역할 임명·회수 표면을 두지 않으므로** 목록 조회만 있고 쓰기가 없다(SYS-02 이월).
- expires_at이 지난 역할은 무효 처리한다 — #1이 그 판정 결과를 반영해 응답한다.

### 3·4·5·6·7. 사업장 조회·정지·해제·강제 폐쇄 (SYS-03)

| 항목 | 3. 목록 | 4. 상세 | 5. 정지 | 6. 해제 | 7. 강제 폐쇄 |
|------|--------|--------|--------|--------|-------------|
| 권한 | VIEWER | VIEWER | **ADMIN** | **ADMIN** | **ADMIN** |
| 입력 | q(상호 · 사업자번호) · status · 구독 소유자 · 검증 결과 · 등록일 범위 · 오프셋 | — | reason(필수) | reason(필수) | reason(필수) |
| 응답 | 상호 · 사업자번호(마스킹) · 상태 · 구독 소유자 · 검증 결과 · 등록일 · **활성 멤버 수** · **구독 만료 시각**(구독 소유자 계정 · subscription:view 없으면 생략) | 위 + 최근 급여 확정 시각 · 검증 이력 요약 | 전이 결과 | 전이 결과 | 전이 결과 |
| 금지 | **급여·주민번호 등 민감 데이터를 기본 목록에 포함하지 않는다** | 위와 동일. 급여 원문·PII 접근은 별도 권한 + 사유 + 감사 | — | — | — |
| 부수효과 | — | — | 신규 업무 생성 차단 · OWNER 알림(**workplace_suspended**) | 이전 상태로 복귀 · **메일 통보 + 감사 로그** | CLOSED 전이 · 읽기 전용 · 법정 보존 유지 · **메일 통보 + 감사 로그** |

- **해제(#6)와 강제 폐쇄(#7)는 알림을 만들지 않는다.** 알림 타입 카탈로그 24종에 해제·폐쇄 타입이 없고 미정의 타입 생성은 notification.unknown_type/400으로 차단되기 때문이다([12_notification.md](./12_notification.md)). 통보는 **메일 + 감사 로그** 두 축으로 하며 타입을 새로 만들지 않는다. workplace_suspended는 정지(#5) 전용이다.
- **#7은 OWNER 자발 폐쇄와 별개 경로**다([04_workplace.md](./04_workplace.md) #26). OWNER 재인증 없이 사유만으로 수행하며 선행조건 5종도 요구하지 않는다 — 약관 위반·요금 문제 같은 사유로 즉시 차단해야 하기 때문이다.
- **#7은 보존 안내 확인(retention_acknowledged_at)을 채우지 않는다 — 열은 NULL로 남는다**(V0726). 그 열의 뜻이 "사업주가 확인했다"이고 플랫폼 제재에는 그 확인이 존재하지 않으므로, 서버가 대신 채우면 **사후에 안내를 받은 사업장과 받지 않은 사업장을 데이터로 분간할 수 없게 된다.** 가드의 요구를 걷는 판정 축은 close_path = PLATFORM_FORCED이며 정본은 [../05_database/09_functions_triggers.md](../05_database/09_functions_triggers.md)다. **close_path · close_reason은 두 경로 모두에서 필수**로 남는다.
- **#4의 최근 급여 확정 시각은 급여 실행 행을 열어서 얻지 않는다.** 정책을 여는 대신 값 하나를 돌려주는 정의자 헬퍼를 둔다 — 정책을 열면 집계 금액을 포함한 급여 실행 행 전체가 플랫폼 운영자에게 열리고, 그것은 이 표의 금지 행("급여·주민번호 등 민감 데이터")과 어긋난다. 같은 형태가 멤버 수에도 쓰인다(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 절).
- **활성 멤버 수는 #3 · #4가 같은 헬퍼로 낸다.** 목록에서 빼면 화면이 행마다 상세를 불러 세게 되는데, 그것이 파생 열을 행마다 조회하지 않는다는 화면 규약이 금지하는 형태다 — 값 하나를 목록에 실어 그 조회 자체를 없앤다. **두 표면이 다른 수를 말하지 않는 것도 같은 헬퍼를 쓰는 데서 온다.**
- **활성 멤버 수는 민감 데이터가 아니라 규모 지표**다. 위 금지 행이 막는 것은 급여·주민번호이고, 멤버 수는 한도(REQ-SUB-06)의 대상 축이라 운영자가 목록에서 판단해야 하는 값이다.
- SUPPORT 이상은 지원 목적으로 메타와 일부 로그를 조회하되 **개인정보·급여 원문 접근은 별도 권한과 감사 사유**를 요구한다(REQ-SYS-05).
- 명세서 PDF 원문 접근은 기본 허용하지 않는다 — 플랫폼 관리자는 **메타 조회만** 기본 허용이다([09_payslip.md](./09_payslip.md) REQ-SLP-10).

### 8~13. 사용자 조회·보조 재설정·제재·강제 삭제 (SYS-04)

**최소 역할을 액션별로 분리한다**(REQ-SYS-07).

| # | 표면 | 최소 역할 | 권한 키 | 처리 |
|:-:|------|----------|--------|------|
| 8 | 목록 | VIEWER | user:view · user:search | **q**(아이디 · 이름 · 연락처 부분 일치) · status · 가입일 범위 · 오프셋. 계정 상태 · 가입일 · 소속 사업장 수 · 최근 로그인 · **정지 해제 예정일**(정지 중일 때만 · 무기한이거나 상태 이력을 읽을 권한이 없으면 생략). **민감정보는 마스킹**한다 |
| 9 | 상세 | VIEWER | user:view | 위 + 소속 사업장 요약 · 구독 요약 · 상태 이력 |
| 10 | 보조 비밀번호 재설정 | **SUPPORT** | user:reset_password | 복구 이메일 미등록 계정의 재설정을 대행한다([03_auth.md](./03_auth.md) REQ-AUT-15). **복구 이메일을 대리 등록하고 그 주소로 재설정 링크를 보낸다** — 계약은 아래 표다 |
| 11 | 정지 | **ADMIN** | user:suspend | 사유와 기간을 입력해 SUSPENDED로 전이하고 **기존 세션을 즉시 폐기**한다 |
| 12 | 해제 | **ADMIN** | user:unsuspend | ACTIVE로 복귀시키고 권한 캐시를 무효화한다. **알림을 만들지 않고 메일 + 감사 로그로 통보**한다 — 해제 알림 타입이 카탈로그에 없다 |
| 13 | 강제 삭제 | **SUPER_ADMIN** | user:delete | DELETED 논리 삭제. **법정 보존 데이터는 유지**한다 |

- **마지막 SUPER_ADMIN은 정지·삭제할 수 없다** — **system.last_super_admin/409**다(#11 · #13).
- #11의 정지는 자동 해제 대상이 된다 — 만료 판정은 로그인 시점과 정기작업 autoUnsuspendAccounts 양쪽에서 일어나며 그 작업의 소유 문서는 [03_auth.md](./03_auth.md)다.
- #13은 사용자 본인 탈퇴([03_auth.md](./03_auth.md) #13)와 같은 결과 상태를 만들지만 **재인증을 요구하지 않고 소유 사업장 차단도 적용하지 않는다** — 운영상 강제 조치이기 때문이며 그래서 SUPER_ADMIN 전용이다.
- **#13의 예외는 GUC가 아니라 행위자의 권한으로 판정한다**(V0726). 소유 사업장 차단 가드가 **user:delete 권한 보유자에게만** 걷히며, 주입 계약 5종을 늘리지 않는다 — 그 권한은 SUPER_ADMIN만 갖는다([../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)). **남은 사업장은 #7이 따로 처리한다.**
- **#11 · #12는 정의자 서버 함수 경로다**(V0726). users에 앱 롤 grant가 0건이라 다른 경로가 없고, 전이 · 프로필 동기화 · 상태 이벤트 1행이 **한 함수 경계 안에서** 함께 일어난다 — account_status_events의 INSERT 정책이 서버 컨텍스트 단일이라 요청 경로에서 따로 켤 자리가 없기 때문이다. **#12는 기한을 보지 않는다** — 기한 경과분의 자동 복귀는 정기작업이 담고 이 표면은 **관리자가 기한 전에 푸는 경로**라, 둘의 대상 집합이 겹치지 않는다.
- **#11 · #12 · #13은 account_status_events와 audit_logs 양쪽에 남고 #10은 audit_logs와 security_events에 남는다.** 상태 전이가 아닌 액션에 전이 이력을 만들지 않는다 — 보조 재설정은 계정 상태를 바꾸지 않는다.

**#10의 대행 계약**은 아래가 정본이다.

| 항목 | 10. 보조 비밀번호 재설정 |
|------|------------------------|
| 요청 | **recoveryEmail(필수)** · **verificationMethod(필수)** — PHONE_CALL · IN_PERSON · WORKPLACE_ADMIN · reason(선택) |
| 처리 | 복구 이메일을 profiles에 대리 등록하고 **같은 트랜잭션에서** 재설정 토큰을 발급해 그 주소로 링크를 보낸다 |
| 응답 | 200 · **단건 자원 객체** — userId · recoveryEmail(**마스킹**) · verificationMethod · sentAt · expiresAt. **토큰과 링크를 응답에 담지 않는다** |
| 실패 | common.not_found/404(대상 부재) · auth.account_suspended/403 · auth.account_deleted/403 · **common.conflict/409**(이미 복구 이메일이 등록된 계정) · common.validation_failed/400(이메일 형식 · 확인 수단 화이트리스트 밖) |
| 부수효과 | audit_logs INSERT(**account.reset_password_assisted**) · security_events INSERT(대상 계정 · PASSWORD_RESET) · 메일 발송 |

- **채택한 방식이 복구 이메일 대리 등록인 근거는 평문 자격 증명의 이동 경로다.** 나머지 둘은 **비밀번호나 토큰이 지원 담당의 손을 지나간다** — 임시 비밀번호 발급은 그 순간 자격 증명이 제3자에게 있고, 토큰 대면·유선 전달은 같은 문제에 전달 채널의 증적조차 남지 않는다. 채택안은 **등록만 대신하고 그 뒤는 정상 재설정 흐름**이라 토큰이 본인의 메일함에만 간다.
- **등록 직후 링크를 보내며 별도 인증 단계를 두지 않는다.** 링크를 열 수 있다는 것이 그 메일함을 소유한다는 증명이다. 나누면 **등록된 복구 이메일만 있고 토큰이 없는 창**이 열리고, 그 창에서는 이미 정상 재설정 경로가 열려 있다 — 그래서 한 표면·한 트랜잭션이며 강제 지점은 서버 함수 issue_assisted_password_reset 안이다(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #44).
- **이미 복구 이메일이 등록된 계정은 거부한다.** 지원 담당이 등록된 주소를 덮어쓸 수 있으면 **이 표면 자체가 계정 탈취 경로**가 된다. 그 계정에는 이미 구제 경로가 있으므로(정상 재설정 — [03_auth.md](./03_auth.md) #11) 대행이 성립할 이유도 없다. 전용 409 코드를 만들지 않고 **common.conflict/409**를 쓴다 — 도메인 전용 409가 없는 상태 충돌이다.
- **그래서 이 표면은 한 계정에 두 번 성립하지 않는다.** 등록이 끝난 계정은 정상 경로의 대상이 되며, 메일 발송이 실패해도 재시도는 #10이 아니라 [03_auth.md](./03_auth.md) #11이다.
- **대상 계정의 존재를 숨기지 않는다.** #9 상세가 같은 권한(user:view)으로 이미 그 계정을 보여 주므로 열거 축이 아니며, 부재는 404 · 정지와 삭제는 403으로 갈라 **지원 담당이 무엇을 해야 하는지 구분되게** 한다. 미인증 표면([03_auth.md](./03_auth.md) #11)의 응답 통일 계약과 축이 다르다.
- **본인 확인 수단은 필수이고 자유 텍스트가 아니라 선택지다.** 문장으로 받으면 같은 절차가 매번 다른 문자열로 남아 사후 대조가 성립하지 않는다. **reason은 선택으로 유지한다** — 사유는 「왜」이고 확인 수단은 「어떻게 확인했나」라 축이 다르며, 그래서 **사유 필수 목록은 움직이지 않는다**(공통 규약의 사유 필수 행 · REQ-GLB-17). 값 집합과 기록 구조의 정본은 [../05_database/15_system.md](../05_database/15_system.md)다.
- **토큰을 응답에 싣지 않는다.** 실으면 채택하지 않은 "토큰 대면 전달"과 같은 상태가 되어 채택 근거가 사라진다. expiresAt만 내주는 것은 지원 담당이 만료(1시간)를 안내할 수 있게 하기 위해서다. **expiresAt의 출처는 서버 환산이다** — 헬퍼 #44의 반환은 (token, recipient_email) 둘뿐이라 서버가 password_reset_tokens.expires_at의 기본값(발급 + 1시간)으로 환산해 낸다. **표시용이며 만료 판정에 쓰이지 않는다** — 판정은 consume_password_reset이 저장된 열로 한다. 함수 반환에 열을 더하지 않는 것은 표시값 하나를 위해 정의자 함수의 계약을 넓히지 않기 위해서다(2026-09-10 구현 실측으로 등재).
- **v1에는 본인이 복구 이메일을 등록·변경하는 표면이 없다** — 프로필 관리(AUT-05)가 v1.1 이월이라 가입 시 입력값이 전부다. 그래서 이 표면이 **가입 이후 복구 이메일이 생기는 유일한 경로**이며, 미등록 계정의 구제 경로가 여기 하나뿐인 이유도 같다.

### 14·15·16·17·18. 요금제 관리·계정 구독 수동 조정 (SYS-05)

| 항목 | 14·15·16. 요금제 | 17·18. 계정 구독 |
|------|-----------------|-----------------|
| 권한 | 조회 VIEWER · 생성·수정 **ADMIN**(settings:update) | 조회 VIEWER · 조정 **ADMIN**(subscription:update) |
| 입력 | code · name · maxOwnedWorkplaces · maxStaffPerWorkplace · price · features · version · effectiveFrom · displayOrder · isActive | **q**(아이디 · 이름 부분 일치) · planCode · status · expiresAt · memo · **reason(필수)** |
| 검증 | **maxStaffPerWorkplace ≤ 30**(상품 전역 상한) · 동일 code의 유효 버전 겹침 금지 | 대상 계정 존재 · 요금제 존재 |
| 파괴적 변경 | **이미 참조된 요금제는 삭제하지 않고 새 버전을 만든다** → **system.plan_in_use/409** | — |
| 영향 미리보기 | 한도 변경 시 **기존 계정에 미치는 영향(초과 계정 수)을 미리 계산해 표시**한다. **별도 표면을 채번하지 않고 #15·#16의 dryRun 질의로 처리**한다 — 저장 없이 초과 계정 수만 계산해 돌려주므로 부수효과도 감사 로그도 남기지 않는다 | 조정 시 대상 계정의 **소유 사업장 수 · 한도 초과 여부 · 등록 가능 여부**를 미리 계산해 표시한다 |
| 부수효과 | — | 감사 로그 · OWNER에게 subscription_notice 알림 |

- **v1의 유료 전환은 수동 처리다**(REQ-SYS-09). PG 자동 결제와 업그레이드 요청 워크플로를 v1에 두지 않으므로 문의 CTA와 #18이 유일한 등급 변경 경로다.
- #16은 비활성화(isActive=false)까지만 허용하고 삭제 메서드를 두지 않는다.

### 19·20·21·22. 감사 로그 조회·내보내기 (SYS-07)

```json
{
  "actorId": "…",
  "actorRole": "ADMIN",
  "action": "payroll.void",
  "targetType": "payroll_run",
  "targetId": "…",
  "workplaceId": "…",
  "beforeValue": { "status": "CONFIRMED" },
  "afterValue": { "status": "VOIDED" },
  "reason": "계산 오류 정정",
  "ip": "…",
  "userAgent": "…",
  "createdAt": "2026-08-03T02:11:00Z"
}
```

| 항목 | 19. 조회 | 20. 내보내기 생성 | 21. 진행 조회 | 22. 다운로드 |
|------|---------|------------------|--------------|-------------|
| 권한 | ADMIN(audit:view) | ADMIN(audit:export) · **멱등키 필수** | ADMIN(audit:export) | 토큰 소유자 + 플랫폼 역할 |
| 입력 | 기간 · actorId · targetType · action · workplaceId · cursor · size | 같은 필터 + format(CSV) + reason(필수) | — | — |
| 응답 | 위 예시의 items + 커서(**totalCount는 첫 묶음에만 싣는다** — 커서 없는 요청) | 202 + exportJobId | status · 진행률 · downloadToken(완료 시) | attachment 스트리밍 |
| 실패 | 권한 미충족은 system.permission_denied/403 (**export.forbidden은 이 표면에서 발생하지 않는다** — 아래) | 위와 같다 | **export.not_ready/409**(미완료) · **export.failed/500**(생성 실패) | **export.expired/410**(토큰 만료·자동 삭제) |

- **#22는 토큰만으로 열지 않는다.** 토큰이 소유자와 요청 지문에 묶여 있어 그 확인이 곧 인가지만, 다운로드 기록에 **행위 시점 역할을 동결**해야 하므로 플랫폼 역할을 함께 확인한다 — 역할 없이 남긴 기록은 "그때 무슨 권한으로 받아 갔는가"에 답하지 못한다. 좁히는 방향이라 토큰 계약을 약화시키지 않는다.
- **export.forbidden/403은 감사 로그 내보내기에서 발생하지 않는다**(발생 지점은 목록 공통 내보내기의 표면 불일치 하나다 — #36 · [04_workplace.md](./04_workplace.md) #35). 이 코드가 가리키는 것은 "필터 범위 위반"인데, **v1에는 audit:view 보유자의 조회 범위를 좁히는 축이 없다** — 플랫폼 축은 사업장 스코프를 갖지 않고 기간·행위자·대상에 상한을 두는 규칙도 채번돼 있지 않다. 그래서 권한 미충족은 system.permission_denied/403이고 등재되지 않은 액션 코드는 common.validation_failed/400이며, 이 코드가 열릴 자리가 남지 않는다. **코드를 폐기하지 않고 미발생으로 등재하는 이유는 범위 축이 생기면 그때 쓸 자리이기 때문**이고, 등재하지 않으면 다음 사람이 "구현이 빠졌나"를 다시 조사한다. **없는 규칙을 추측해 만들지 않는다.**
- **감사 로그는 수정·삭제가 불가능**하다(REQ-SYS-11). UPDATE·DELETE 표면이 없고 정정이 필요하면 새 정정 로그를 추가한다.
- **내보내기 다운로드 이력 자체를 별도 감사 로그로 남긴다.** 감사 데이터를 밖으로 꺼내는 행위가 감사 대상에서 빠지면 통제의 끝단이 비어 있다. **생성과 다운로드가 각각 audit_log.export로 남고** 전후값의 phase가 둘을 가른다 — 작업만 만들어 둔 것과 실제로 받아 간 것이 구분되지 않으면 반출 사실을 셀 수 없다. **다운로드 기록의 사유는 생성 시점의 사유를 쓴다** — 다운로드는 사유를 다시 입력받는 자리가 아니고 서버가 문장을 지어내면 그 기록이 무엇도 증명하지 못한다.
- **산출물 보존은 24시간이고 다운로드 토큰 수명과 다른 축이다.** 토큰은 한 번의 다운로드를, 보존 기간은 파일이 남아 있는 기간을 정한다 — 둘을 같은 값으로 두면 토큰을 받고 잠시 뒤 내려받는 정상 흐름이 만료로 끝난다. 보존 기간이 지난 뒤의 요청은 **export.expired/410**이다.
- **감사 내보내기 산출물은 documents에 등록하지 않는다.** 그 표는 사업장 열이 필수인데 이 내보내기는 사업장 스코프가 없다 — export_jobs.document_id를 비우고 저장 위치를 작업 식별자에서 유도한다.
- 기록 대상은 모든 관리자 액션 · 권한 변경 · 제재 · 사업장 상태 변경 · **개인정보 접근과 복호화** · 급여/명세서 확정과 정정 · 기준값 변경 · 임포트 확정 · 감사 내보내기다(REQ-SYS-10).
- **감사 action 키는 에러 코드가 아니다.** audit_logs.action의 {domain}.{verb} 형식(pii.decrypt · payroll.void · workplace.suspend)은 HTTP 상태를 갖지 않으며 에러 코드 카탈로그의 대상이 아니다.
- **before/after에 PII 원문을 저장하지 않는다** — 마스킹 값 · 참조 ID · 변경 분류만 남긴다.
- 커서를 쓰는 근거는 목록의 성질이다 — 시간 역순으로 무한 증가하고 조회 중에도 새 행이 앞에 쌓인다.
- **totalCount는 선택이고 첫 묶음(커서 없는 요청)에만 싣는다** — 이어 읽는 묶음은 담지 않는다. 조회 중에도 새 행이 앞에 쌓이는 목록이라 **이어 읽는 도중 다시 세면 총계가 매 묶음 달라져** 화면이 그 값을 신뢰할 수 없다. 계약 정본은 [01_conventions.md](./01_conventions.md) 커서 절이다.

### 23·24·25·26. 기준값 관리 (SYS-08)

```json
{
  "category": "PENSION_RATE",
  "key": "employee_share",
  "value": "0.045",
  "effectiveFrom": "2026-01-01",
  "effectiveTo": null,
  "version": 1,
  "sourceUrl": "…",
  "confirmedAt": "2026-01-05T00:00:00Z",
  "confirmedBy": "…"
}
```

| 항목 | 23. 목록 | 24. 등록 | 25. 수정 | 26. 간이세액표 조회 |
|------|---------|---------|---------|-------------------|
| 권한 | VIEWER(statutory:view) | **ADMIN**(settings:update) | **ADMIN**(settings:update) | VIEWER |
| 입력 | category · key(완전일치) · **q**(key · 출처 · 버전 부분 일치) · baseDate · 오프셋 | 위 예시 필드(version 생략 시 서버가 다음 연번을 고른다) + sourceName + reason(필수) | **sourceUrl · sourceName · confirmed** + reason(필수) | payDate(필수) · 월 급여액 · 부양가족 수 · 오프셋 |
| 검증 | — | **동일 (category, key)의 기간 겹침 차단** → **system.statutory_rate_overlap/409** | 값 축은 갱신 대상이 아니다 — 겹침이 성립하지 않는다 | — |
| 감사 | — | 전후값과 발효일을 남긴다 | 위와 동일 | — |

v1 카테고리는 **19종**이며 값 집합의 정본은 statutory_rates의 category CHECK **19값**([../05_database/15_system.md](../05_database/15_system.md)), 조회 계약의 정본은 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.3이다 — 최저임금 · 최저임금 산입범위 · 국민연금 요율 · 건강보험 요율 · 장기요양 요율 · 고용보험 요율 · 산재보험 요율 · 보수월액 상하한 · 보험별 보수 포함 매핑 · 간이세액표 · 비과세 한도 · 가산율 · 관공서 공휴일 · 단수(반올림) 규칙 · 규모별 정책 · 통상임금 규칙 · 근로시간 한도 · **통상근로자 소정근로시간** · **신고·납부 기한 규칙**이다.

- **#25가 만지는 것은 확인 메타와 출처뿐이다.** 값 · 유효기간 · 버전을 고치면 이미 확정된 급여가 참조하는 행이 달라지므로 guard_statutory_rate_immutable() 트리거가 그 UPDATE를 거부한다 — **변경은 새 버전 행 INSERT(#24)**이고, 기간을 바꿀 수 없으므로 이 표면에서 겹침은 성립하지 않는다. 확인자는 요청 본문이 아니라 행위자에서 가져온다.
- **이 테이블이 비어 있으면 급여 계산이 아예 불가능하다.** 계산 측 차단 코드는 payroll.missing_reference_value/422이며 발생 표면은 [08_payroll.md](./08_payroll.md)다.
- **확인자(confirmedBy)가 빈 행은 미확인으로 간주해 계산을 차단한다**(REQ-GLB-09 · REQ-SYS-14). #23은 그 상태를 목록에 드러낸다.
- **국민연금 요율은 단계 인상이므로 연도별 버전을 선등록**해야 하고, **국민연금 기준소득월액 상하한은 매년 7월에 경계가 바뀌므로 연 단위가 아니라 7월 기준으로 분할 등록**한다.
- **v1은 자동 누락 점검 배치를 두지 않는다.** 배포 전 수동 확인 절차를 필수 운영 항목으로 두며 그 근거는 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)다.
- **확인되지 않은 값은 시드하지 않는다.** 추정값을 넣으면 차단이 풀려 틀린 값으로 계산이 진행된다.
- **version은 정수 연번이다** — statutory_rates.version은 integer이며([../05_database/15_system.md](../05_database/15_system.md)) 같은 category·key 안에서 1부터 올린다. "2026.1" 같은 연.차수 문자열을 쓰지 않는다 — 귀속 구간은 effective_from · effective_to가 이미 담고, 문자열 버전은 사전식 비교라 10차가 2차보다 앞선다. 이 규칙은 같은 테이블을 쓰는 #27~#29에도 그대로 적용된다.

### 27·28·29. 규모별 적용 정책 관리 (CMP-02)

```json
{
  "clauseKey": "LB-56",
  "clauseTitle": "가산수당",
  "article": "근로기준법 §56",
  "threshold": 5,
  "appliedUnderThreshold": false,
  "effectiveFrom": "2021-07-01",
  "effectiveTo": null,
  "version": 1,
  "sourceUrl": "…",
  "confirmed": false
}
```

| 항목 | 27. 조회 | 28. 등록 | 29. 수정 |
|------|---------|---------|---------|
| 권한 | 플랫폼(VIEWER) — statutory:view | **플랫폼(ADMIN)** — settings:update | **플랫폼(ADMIN)** — settings:update |
| 입력 | clauseKey(완전일치) · **q**(clauseKey · 정책명 · 조항 부분 일치) · threshold · baseDate · 오프셋 | 위 예시 필드(version 생략 시 서버가 다음 연번을 고른다) + sourceName + reason(필수) | **sourceUrl · sourceName · confirmed** + reason(필수) |
| 검증 | — | **동일 (clauseKey, threshold)의 유효기간 겹침 차단** → system.statutory_rate_overlap/409 | 값 축은 갱신 대상이 아니다 — 겹침이 성립하지 않는다 |
| 응답 | 조문키별 적용 여부 · 임계값 · effective 구간 · 정책 버전 · 확인 여부 | 생성 자원 | 갱신 자원 |
| 감사 | — | 전후값과 발효일을 남긴다 | 위와 동일 |

- **#29가 만지는 것은 확인 메타와 출처뿐이다.** 값 · 유효기간 · 버전은 이미 확정된 급여가 참조하므로 고칠 수 없고, guard_statutory_rate_immutable() 트리거가 그 UPDATE를 거부한다([../05_database/15_system.md](../05_database/15_system.md)). **변경은 새 버전 행 등록(#28)이다.** 기간을 바꿀 수 없으므로 이 표면에서 유효기간 겹침은 성립하지 않는다.
- **표시명과 조항 표기를 나눠 싣는다.** 저장된 정책값이 label과 article을 나눠 갖기 때문이며, 표시명만으로는 어느 조문인지 지목되지 않고 조항만으로는 화면에 쓸 이름이 없다. 값 키의 정본은 [../05_database/15_system.md](../05_database/15_system.md)의 SIZE_POLICY value 구조 절이다.
- **reason은 요청 필드이고 응답에 실리지 않는다.** statutory_rates에 사유 열이 없고 사유의 저장처는 audit_logs다 — 응답에 실으면 같은 사실의 정본이 둘이 된다. 응답이 확인 상태를 싣는 것은 미확인 행을 목록에서 드러내기 위해서다.
- **저장소는 statutory_rates의 SIZE_POLICY 행**이다. 기준값 관리(#23~#26)와 같은 테이블을 쓰되 **조문 단위 정책이라 조회·편집 축이 달라** 표면을 나눈다 — 조문키와 임계값(5 · 10)이 조회 키이고 요율·세액표는 category·key가 조회 키다.
- **화이트리스트 방향을 뒤집지 않는다.** 근로기준법 시행령 [별표 1]은 5인 미만에 **적용되는** 조문만 열거하므로 appliedUnderThreshold가 참인 행만 적용이고 목록에 없으면 미적용이다(REQ-GLB-12 · D-15). 방향을 반대로 등록하면 5인 미만 분기가 통째로 뒤집힌다.
- **코드에 하드코딩하지 않는다**(REQ-CMP-09). 적용 확대 논의가 진행 중이므로 기준값 변경만으로 대응할 수 있어야 하고, 그래야 과거 급여의 재현성도 지켜진다.
- **급여 확정 시 적용된 정책 버전을 결과에 동결**한다([08_payroll.md](./08_payroll.md)). 이 표면이 값을 바꿔도 과거 확정분은 변하지 않는다.
- 사업장 측 **소비 조회는 [11_compliance.md](./11_compliance.md) #5**가 담당한다 — 그쪽은 특정 사업장의 기준일 적용분을 읽는 읽기 전용 표면이고 이쪽이 값의 관리 축이다.
- **삭제 표면을 두지 않는다.** 확정 결과가 정책 버전을 참조하므로 폐지는 effectiveTo를 닫는 방식으로만 한다.

### 30·31·32·33·35. 약관/개인정보/위치정보 문서 관리 (SYS-11)

| 항목 | 30. 목록 | 31. 생성 | 32. 활성화 | 33. 공개 활성 문서 조회 | 35. 단건 전문 |
|------|---------|---------|-----------|----------------------|--------------|
| 권한 | **ADMIN** | **ADMIN** | **ADMIN** | **미인증** | **ADMIN** |
| 입력 | kind · isActive · **q**(버전 · 제목 부분 일치) · 오프셋 | kind ∈ TERMS · PRIVACY · LOCATION · version · title · body · effectiveFrom | — | kind(경로 변수) | termsDocumentId(경로 변수) |
| 검증 | — | 동일 (kind, version) 중복 → **system.terms_version_conflict/409** | **kind별 활성 버전이 정확히 1개**가 되도록 직전 활성본을 비활성화한다 | — | — |
| 응답 | 버전 목록과 활성 여부 | 생성 자원 | 활성화 결과 | 활성 문서 전문 | **단건 자원 객체** — 30의 목록 항목 필드 + body |
| 실패 | — | system.terms_version_conflict/409 | **system.terms_not_found/404**(대상 부재) · **system.terms_in_use/409**(참조된 버전 삭제 시도) | system.terms_not_found/404 | **common.not_found/404**(대상 부재) |

- **#30의 조회 권한은 ADMIN이다** — VIEWER 권한 집합(사업장 · 사용자 · 구독 · 요금제 · 기준값의 view와 search)에 약관 문서가 없고 REQ-SYS-15가 관리 권한을 ADMIN으로 정한다. 미인증 사용자와 일반 사용자에게 열리는 것은 **활성 문서 전문(#33)뿐**이며 버전 이력·비활성본은 운영 정보다.
- **위치정보 문서는 별도 kind로 관리한다**(위치정보법 §18 별도 동의). 약관·개인정보와 한 문서로 묶으면 별도 동의가 성립하지 않는다.
- **이미 동의에 참조된 버전은 삭제하지 않고 비활성화만 허용한다** — 삭제하면 과거 동의 이력이 가리키는 버전이 사라져 법적 증거가 끊긴다.
- 개정 시 **재동의 흐름을 트리거**한다. **필수 2종(TERMS·PRIVACY)**의 재동의 미완료 사용자는 다음 로그인·주요 액션에서 동의 화면으로 유도하며 미동의 상태는 auth.consent_required/422로 차단한다. **LOCATION 개정은 진입을 막지 않는다**(D-19 · [03_auth.md](./03_auth.md) #3 ④).
- **재동의는 새 버전에 대한 신규 동의 이력으로 기록**하며 기존 이력을 덮어쓰지 않는다([15_privacy.md](./15_privacy.md)).
- **#35는 활성 여부를 보지 않는다.** 비활성본과 아직 활성화하지 않은 초안도 그대로 돌려주며 그것이 공개 조회(#33)와 갈리는 축이다 — 등록(#31)과 활성화(#32)가 나뉜 표면에서 운영자는 **걸리기 전의 문안**을 먼저 읽어야 하는데, 목록(#30)이 본문을 싣지 않으므로 그 경로가 여기 하나뿐이었다.
- **#35의 부재는 common.not_found/404다.** system.terms_not_found 의 발생 조건은 **활성본 부재**이고(채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)), 식별자로 지목한 행이 없는 것과 종류별 활성본이 없는 것은 **조치가 다르다** — 한 코드로 묶으면 그 구분이 사라진다. 아래 에러 코드 표의 common.not_found 행이 이미 문서 부재를 적고 있었고 이 표면이 그 자리를 채운다.
- **#33이 공개 경로다.** 가입 화면과 공개 약관 페이지가 이 표면을 쓴다(공개 요금제 페이지는 [13_subscription.md](./13_subscription.md) #1을 쓴다). **이 문서의 #30**은 플랫폼(ADMIN) 운영 표면이라 공개가 아니다.

### 34. 정기작업 재실행

| 항목 | 34. 재실행 |
|------|-----------|
| 권한 | 플랫폼(**ADMIN**) — settings:update |
| 입력 | 경로 변수 job(정기작업 이름 **8값** — scheduled_job_runs.job_name 의 저장 값과 문자 그대로 같고 정기작업 8건과 **1:1**이다) · 본문 baseDate(**필수**) · reason(선택) |
| 처리 | 분산락을 얻어 그 작업의 본문을 **기준일로** 실행하고 결과를 실행 이력에 남긴다. **백오프 대기와 dead letter 를 건너뛴다** |
| 응답 | 200 · **단건 자원 객체** — 실행 이력 1행(id · jobName · baseDate · status · attempt · startedAt · finishedAt · targetCount · successCount · failCount · nextRetryAt · deadLetterAt · errorSummary) |
| 실패 | **common.not_found/404**(등재되지 않은 작업 이름) · common.validation_failed/400(기준일 누락 · **미래 기준일**) · **common.conflict/409**(분산락 미획득 — 같은 작업이 이미 돌고 있다) |
| 부수효과 | scheduled_job_runs 1행 · audit_logs INSERT(**scheduled_job.rerun**) |

- **이 표면이 없으면 소급 보정 경로 자체가 없다.** 시각 트리거는 인메모리 타이머라 프로세스가 내려간 동안 지나간 실행을 스스로 채우지 않고, 기동 시 누락 감지는 **알리기만 하고 보정하지 않는다**(자동 재실행은 배포가 잦은 구간에서 같은 작업을 연쇄로 돌린다). 연차 발생이 정기작업 accrueAndExpireLeave 하나뿐이라 **응당일을 지난 발생을 만들 길**도 여기 말고 없다.
- **경로 값 8개가 정기작업 8건과 1:1이다.** 그래서 **등재되지 않은 이름은 common.not_found/404**다 — 경로 변수가 지목한 자원이 없는 것이지 본문 값이 형식을 어긴 것이 아니고, 400으로 내면 v1.1 이월 작업(예 checkStatutoryRateCoverage)을 넣은 요청이 「값이 올바르지 않다」로 돌아와 **그 작업이 아직 없다는 사실이 응답에서 읽히지 않는다.** 미래 기준일은 본문 값이라 400이며 두 축을 섞지 않는다.
- **화면 자리는 SYS-RATES 운영 절이다.** 기준값 관리와 같은 화면에 두는 근거는 **둘 다 플랫폼 마스터 운영이고 같은 권한 키가 열기** 때문이며, 새 화면을 만들면 화면 55가 움직인다. 화면 채번 정본은 [../07_screen/README.md](../07_screen/README.md)이고 이 문서는 인용만 한다.
- **기준일이 곧 대상 집합이라 필수다.** 정기작업은 실행 시각이 아니라 기준일로 동작하며(정본 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) 공통 규약), 서버가 기준일을 대신 고르면 **무엇을 다시 돌렸는지가 요청에 남지 않는다.** **미래 기준일은 거부한다** — 아직 오지 않은 날의 대상은 성립하지 않는데도 돌리면 원장에 행을 쌓는 작업이 오지 않은 날짜로 적립한다. 판정은 KST 다.
- **분산락은 건너뛰지 않는다.** 동시 실행 방어는 재실행이 우회할 축이 아니며, 같은 작업이 이미 돌고 있으면 **common.conflict/409** 다 — 그 사실은 SKIPPED 1행으로 이력에 남으므로 응답이 실패여도 **경합은 기록된다.** 락 경합과 미실행은 다른 사건이다. 다만 **락 최소 유지 시간은 이 경로에서 0**이다([../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md) 락 유지 시간) — 전건 30초는 시각 트리거의 시계 차이를 막는 값이라 사람이 부른 요청에는 성립 조건이 없고, 그대로 두면 **아무것도 돌고 있지 않은 30초 동안 409가 나서** 그 응답이 말하는 바가 사실이 아니게 된다.
- **백오프 대기와 dead letter 는 건너뛴다.** 그 둘은 시각 트리거가 같은 실패를 주기마다 되풀이하지 않게 막는 문인데, [../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md)가 dead letter 의 재개를 **담당자의 명시 재시도 조작**으로만 규정한다 — 그 조작까지 같은 문에 막히면 재개 경로가 아예 없다. 회차는 직전 실패 회차의 다음으로 이어 붙어 **재개도 이력에서 세어진다.**
- **응답이 실행 결과 1건이라 동기다.** 순회 규모가 큰 작업은 그만큼 요청이 오래 열려 있으며 **그것이 이 표면의 성질**이다 — 진행 조회를 따로 두려면 표면이 둘로 갈려야 하고 그 채번은 필요가 생길 때 한다.
- **멱등키를 요구하지 않는다.** 같은 기준일의 재실행이 같은 결과를 낸다는 것이 정기작업의 멱등 계약이고 동시 실행은 분산락이 막으므로 중복 요청을 흡수할 축이 이미 둘이다 — **멱등 필수 표면은 그 축이 없는 자리들**이고 이 표면은 그 열거에 들어가지 않는다.
- **권한 키를 신설하지 않고 settings:update 를 쓴다.** 새 키는 화이트리스트·판정 헬퍼·정책까지 함께 움직이므로 마이그레이션이 따라온다. 그 키가 이미 **플랫폼 운영자만 만지는 축**을 여는 자리이며, 이 표면이 더해져 여는 것이 요금제·기준값·약관·규모 정책 **넷에서 다섯**이 된다([../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)).
- **사유를 요구하지 않는다.** 같은 기준일의 재실행이 같은 결과를 낸다는 것이 계약이라 되돌릴 수 없는 조치도 상태를 뒤집는 처분도 아니고, 남길 것은 「왜 다시 돌렸나」가 아니라 **「무엇이 언제 어떤 결과로 돌았나」**다 — 그것은 실행 이력과 감사 전후값이 담는다. **사유 필수 12는 움직이지 않는다.**
- **작업 목록·주기·기준일 규칙의 정본은 이 문서가 아니다** — 8값의 이름과 관련 기능은 [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md), 전일·당일 규칙과 재시도·dead letter 계약은 [../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md)다.

### 36. 시스템 콘솔 목록 내보내기 발급 (DSH-06)

| 항목 | 36. 발급 |
|------|---------|
| 권한 | **목록 조회 표면의 권한 키 그대로**(진입 판정 ①② — auth.platform_forbidden/403 · system.permission_denied/403) |
| 입력 | [04_workplace.md](./04_workplace.md) #35와 **같은 본문**(listType · q · filters · sort · order · columns · reason) |
| 응답 | 200 · token · fileName · expiresIn(초) — 다운로드는 [04_workplace.md](./04_workplace.md) #36 |
| 실패 | common.validation_failed/400 · **export.forbidden/403**(사업장 목록을 이 표면에서 요청) · 목록 조회 표면의 인가 코드 |
| 부수효과 | 없음 — 감사는 다운로드에서 **list.export** · **list.export_sensitive**로 남고 workplace_id가 비어 사업장 개방 술어에 닿지 않는다 |

**시스템 콘솔 목록 식별자의 정본은 이 절에 둘 목록 표다.** 행은 목록 구현이 서는 변경 단위에서 표와 함께 더한다. **명명은 system_ 접두 + 경로 자원 세그먼트의 lower_snake**다(/v1/system/users → system_users).

| listType | 목록 조회 표면 | 민감 |
|----------|--------------|:---:|
| system_workplaces | 이 문서 #3 사업장 목록 | |
| system_users | 이 문서 #8 계정 목록 | ● |
| system_subscriptions | 이 문서 #17 계정 구독 목록 | |
| system_statutory_rates | 이 문서 #23 기준값 목록 | |
| system_size_policies | 이 문서 #27 규모 정책 목록 | |
| system_terms_documents | 이 문서 #30 약관 문서 목록 | |

민감·열·검증 규칙의 정본은 [04_workplace.md](./04_workplace.md) #35다. 등재되지 않은 listType은 **어떤 요청이든 400 · 403으로 끝난다.**

- **발급 계약 · 판정 순서 · 파일 규약 · 멱등 비요구 근거 · 감사 기록 구조의 정본은 [04_workplace.md](./04_workplace.md) #35 · #36이다** — 두 표면이 계약을 따로 적으면 한쪽만 갱신된다. 이 절은 권한 축과 목록 표만 갖는다.
- **감사 로그는 이 표면으로 내보내지 않는다** — 비동기 작업 · 사유 필수 · 계정 축 멱등 · CSV라 계약이 다르고 #20~#22가 그 자리다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| system.permission_denied | 403 | 역할별 권한 키 미충족 — **플랫폼 권한은 보유**한 상태 | 전 /v1/system 표면 |
| system.last_super_admin | 409 | 마지막 SUPER_ADMIN 정지·삭제·회수 차단 | #11 · #13 |
| system.plan_in_use | 409 | 참조된 요금제의 파괴적 변경·삭제 | #16 |
| system.statutory_rate_overlap | 409 | 기준값·규모 정책 유효기간 겹침 | #24 · #25 · #28 · #29 |
| system.terms_version_conflict | 409 | 동일 (kind, version) 문서 중복 | #31 |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 없음 | #32 · #33 |
| system.terms_in_use | 409 | 이미 동의에 참조된 문서 버전 삭제 시도 | #32 |
| export.forbidden | 403 | 내보내기 권한·필터 범위 위반 — **등재된 목록을 그 목록이 속하지 않은 표면에서 요청**(사업장 목록을 #36으로). 감사 로그 내보내기에서는 발생하지 않는다 | #36 · [04_workplace.md](./04_workplace.md) #35 |
| export.not_ready | 409 | 내보내기 작업 미완료 | #21 |
| export.expired | 410 | 내보내기 다운로드 토큰 만료·자동 삭제 | #22 · [04_workplace.md](./04_workplace.md) #36 |
| export.failed | 500 | 내보내기 파일 생성 실패 | #21 · [04_workplace.md](./04_workplace.md) #36 |
| auth.platform_forbidden | 403 | **플랫폼 권한 자체가 없음** — 시스템 웹 진입 차단 | 전 /v1/system 표면 |
| auth.account_suspended | 403 | **SUSPENDED 계정에 대한 보조 재설정 시도** — 로그인 자체가 막힌 상태라 구제 대상이 아니다 | #10 |
| auth.account_deleted | 403 | **DELETED 계정에 대한 보조 재설정 시도** — 종단 상태다 | #10 |
| subscription.plan_not_found | 404 | 조정 대상 요금제 미존재 | #18 |
| workplace.close_blocked | 409 | **강제 폐쇄에는 적용하지 않는다** — OWNER 자발 폐쇄 전용이다 | 없음 |
| common.conflict | 409 | **이미 복구 이메일이 등록된 계정의 보조 재설정 시도**(#10) · **정기작업 재실행의 분산락 미획득**(#34 — 채번 정본이 락 획득 실패의 폴백을 이 코드로 규정한다). 둘 다 도메인 전용 409가 없는 상태 충돌이다 | #10 · **#34** |
| common.not_found | 404 | 사업장 · 사용자 · 요금제 · 기준값 · 규모 정책 · 문서 부재 · **등재되지 않은 정기작업 이름**(#34) | #4 · #9 · **#10** · #16 · #18 · #25 · #29 · **#34** · **#35** |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 · 커서 형식 오류 · 한도 상한 초과 · **미래 기준일**(#34) · **등재되지 않은 목록 · 선언 밖 열·필터 · 민감 목록 사유 누락**(#36) | 전 REST 표면 |

- **system 7종과 export 4종 전량이 이 표에 있다.**
- **#34 · #35도 코드를 신설하지 않는다.** 락 경합은 채번 정본이 이미 common.conflict 의 발생 조건으로 적어 둔 자리이고, 문서 단건 부재는 같은 표의 common.not_found 가 이미 문서 부재를 담고 있었다 — **없는 코드를 만들기 전에 있는 코드가 맞는지 본다.**
- **#10은 코드를 신설하지 않고 전부 인용한다.** 대상 부재 · 정지 · 삭제 · 이미 등록 넷 다 이미 채번된 코드가 답하며, **같은 사유에 두 코드를 두지 않는다**는 규약대로 도메인 전용 코드를 새로 만들지 않았다.
- **auth.platform_forbidden과 system.permission_denied를 구분한다**(REQ-SYS-03). 전자는 진입 자체가 막히고 후자는 진입 후 특정 액션만 막힌다 — 운영 로그에서 두 상황을 분간해야 지원 대응이 갈린다.
- workplace.close_blocked를 강제 폐쇄에 적용하지 않는 것은 의도된 설계다. 선행조건 미충족을 이유로 위반 사업장을 차단하지 못하면 통제가 성립하지 않는다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| system_admins | #1 · #2 SELECT | 플랫폼 역할 — (user_id, role) 유일 · expires_at 만료 처리. **초기 SUPER_ADMIN은 서버 기동 부트스트랩으로 생성**한다(시드 아님) |
| audit_logs | #5 · #6 · #7 · **#10** · #11 · #12 · #13 · **#15** · **#16** · **#18** · #20 · #24 · #25 · #28 · #29 · #31 · #32 · **#34** INSERT · #19 · #20 SELECT | 사업장 정지 **workplace.suspend**(#5) · 해제 **workplace.unsuspend**(#6) · 강제 폐쇄 **workplace.close_forced**(#7) · 계정 정지 **account.suspend**(#11) · 해제 **account.unsuspend**(#12) · 강제 삭제 **account.delete_forced**(#13) · 보조 비밀번호 재설정 **account.reset_password_assisted**(#10) · 요금제 등록 **plan.create**(#15) · 수정 **plan.update**(#16) · 계정 구독 수동 조정 **subscription.adjust**(#18) · 감사 내보내기 **audit_log.export**(#20) · 기준값 등록 **statutory_rate.create**(#24 · #28) · 수정 **statutory_rate.update**(#25 · #29) · 약관 등록 **terms_document.create**(#31) · 활성화 **terms_document.activate**(#32) · 정기작업 재실행 **scheduled_job.rerun**(#34). **사유 필수는 #5 · #6 · #7 · #11 · #12 · #13 · #18 · #20 · #24 · #25 · #28 · #29 — 열둘이다.** 사유 비필수는 **#10 보조 재설정 · #15 · #16 요금제 · #31 · #32 약관 · #34 정기작업 재실행 여섯**이다 — 지원 업무와 마스터 데이터 운영의 정상 경로라 사유를 요구하면 형식적 입력만 쌓인다. **INSERT 전용 · PII 원문 저장 금지.** 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)이며 **여기서 신설하지 않는다**(표기 규약 [01_conventions.md](./01_conventions.md) 연동 테이블의 코드 표기) |
| export_jobs | #20 INSERT · #21 SELECT · #22 소비 | 감사 내보내기 작업 — 상태 · 만료. **1회용 토큰은 이 표에 열이 없다** — 토큰은 캐시 축이고 이 표는 작업 축이다. 쓰기가 서버 컨텍스트를 요구하므로 사용자 요청 경로가 서버 전용 진입점을 지난다 |
| statutory_rates | #23 · #27 SELECT · #24 · #28 INSERT · #25 · #29 UPDATE | 기준값과 **SIZE_POLICY 조문 단위 정책값** — category · key · effective 기간 겹침 차단 · source_url · confirmed_by |
| income_tax_table_entries | #26 SELECT | 간이세액표 행 — **지급일 기준** 버전 선택 |
| terms_documents | #30 · **#35** SELECT · #31 INSERT · #32 UPDATE · #33 SELECT | 약관·개인정보·위치정보 문서 버전 — kind별 활성 1개 보장. **#35만 본문을 낸다** — 목록은 메타이고 #33은 활성본으로 좁혀지므로, 비활성본·초안의 문안을 읽는 자리가 그 하나다 |
| user_consents | #32 SELECT | 동의 이력 — 문서 버전 삭제를 막는 근거 |
| plans · subscriptions | #14 · #17 SELECT · #15 · #16 · #18 INSERT·UPDATE | 요금제 관리와 계정 구독 수동 조정 대상 |
| users · profiles | #8 · #9 SELECT · #10 · #11 · #12 · #13 UPDATE | 제재·복구·강제 삭제의 대상. 민감정보는 마스킹해 노출한다. **#10이 쓰는 것은 profiles.recovery_email 하나**이며 users를 건드리지 않는다 — 비밀번호를 바꾸는 것이 아니라 재설정 링크의 수신 주소를 등록하는 표면이다 |
| password_reset_tokens | **#10 INSERT** | 대리 등록 직후 발급하는 재설정 토큰 — **해시만 저장**하고 원문은 반환값과 발송 채널에만 둔다. 소비는 [03_auth.md](./03_auth.md) #12가 한다 |
| security_events | **#10 INSERT** | 대상 계정에 남기는 보안 이벤트(kind = PASSWORD_RESET). **행위자 축은 audit_logs가 갖고 이 표는 그 계정에 무슨 일이 있었는지를 남긴다** |
| account_status_events | #11 · #12 · #13 INSERT | 계정 상태 전이 이력 |
| workplaces | #3 · #4 SELECT · #5 · #6 · #7 UPDATE | 정지·해제·강제 폐쇄의 대상 |
| scheduled_job_runs | **#34 INSERT·UPDATE** | 정기작업 실행 이력(테이블 60 · 소유는 core 인프라다). 같은 (작업, 기준일)의 진행 중·성공 행이 **부분 유일 인덱스로 1건**이라 재실행이 행을 늘리지 않고 그 행을 이번 실행으로 되돌린다 — **하루치 이력이 최신 1행으로 접히는 것과 같은 형태**다([../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md) 실행 이력). 락 미획득은 SKIPPED 행으로 따로 쌓인다. 쓰기가 서버 컨텍스트를 요구하므로 사용자 요청 경로가 서버 전용 진입점을 지난다 |
| notifications | #5 · #11 · #18 INSERT | **workplace_suspended**(사업장 정지 시 OWNER 통보 · #5) · account_suspended(계정 정지 · #11) · subscription_notice(구독 조정 · #18) · system_notice. **해제(#6 · #12)와 강제 폐쇄(#7)는 대응 타입이 없어 알림을 만들지 않고 메일 + 감사 로그로 통보한다** |

- **#36은 변이 표면이 아니다** — 토큰을 발급할 뿐 저장소를 바꾸지 않고, 반출 기록은 파일이 만들어지는 다운로드([04_workplace.md](./04_workplace.md) #36)가 **list.export** · **list.export_sensitive**로 남긴다. workplace_id가 비어 사업장 관리자에게 열리지 않는다.
- **변이 표면 18 전부에 코드가 있다.** 2026-09-07 대조에서 넷(#10 · #15 · #16 · #18)에 붙일 코드가 없던 것을 **V0719가 채번해 메웠다** — 이 문서가 "모든 변이 표면이 audit_logs 대상"이라고 계약하므로 **코드 부재는 곧 계약 미이행**이었고, 그래서 계약 확장이 아니라 누락 보정이다.
- **#18만 사유 필수다.** REQ-SYS-09가 등급 조정에 사유를 못박고 RBAC 위험 행위 통제 표도 같은 요구를 적는데 **채번 정본의 열거만 그것을 담지 못하고 있었다** — 사유 필수 항목이 15 → **16**이 된 자리이며 **처음부터 하나 모자랐던 것**이다. #10 · #15 · #16은 사유 필수가 아니다: 보조 재설정은 지원 업무의 정상 경로이고 **대상 계정에 보안 이벤트가 별도로 남으며**, 요금제 등록·수정은 settings:update가 여는 넷 중 **사유 필수가 기준값 변경뿐**이라는 RBAC 표의 구분을 따른다.
- **넷 다 개방 목록에는 들어가지 않는다** — 플랫폼 축이거나 계정 축이라 사업장 관리자에게 열지 않으므로 **사업장 개방은 불변**이다.
- **scheduled_job.rerun 도 같다.** 전 사업장을 순회하는 플랫폼 축이라 workplace_id 가 비어 있고, 그 축의 정책이 평가할 값 자체가 없다 — 사유 비필수이자 비개방이므로 채번 정본의 **그 밖의 축**에 등재된다.

- **#28 · #29를 기준값 코드로 귀속한 것은 같은 테이블·같은 행위이기 때문이다** — 연동 표상 둘 다 statutory_rates INSERT·UPDATE이고 SIZE_POLICY는 그 테이블의 category 하나다. **없는 코드를 만들기 전에 있는 코드가 맞는지 본다.**
- **코드는 있으나 v1 표면이 없는 것이 셋 있다** — system_admin.grant_role · system_admin.revoke_role은 **역할 임명 UI를 v1에 두지 않으므로**(아래 v1 경계) 부여·회수가 운영 절차이고, system_admin.bootstrap은 서버 기동 부트스트랩이라 표면이 아니다. **이 셋은 결손이 아니라 의도된 공백이다.**
- **포괄 표기를 표면별 열거로 바꾼 이유가 이 절이다.** "전 변이 표면 INSERT"는 **검증되지 않은 채로 참처럼 읽힌다** — 표면과 코드를 잇지 않으면 어느 변이가 기록되지 않는지 드러날 자리가 없고, 실제로 넷이 그 상태였다.

## 추적성

기능명·우선순위의 정본은 [../02_features/12_system.md](../02_features/12_system.md)다.

| 기능ID | 표면 |
|--------|------|
| SYS-01 플랫폼 RBAC | #1 · #2 |
| SYS-03 사업장 관리 | #3 · #4 · #5 · #6 · #7 |
| SYS-04 사용자 관리 | #8 · #9 · #10 · #11 · #12 · #13 |
| SYS-05 구독/요금제 관리 | #14 · #15 · #16 · #17 · #18 |
| SYS-07 감사 로그 | #19 · #20 · #21 · #22 |
| SYS-08 기준값 관리 | #23 · #24 · #25 · #26 |
| SYS-11 약관/개인정보/위치정보 문서 관리 | #30 · #31 · #32 · #33 · **#35** |
| CMP-02 규모별 적용 정책 버전 관리 | #27 · #28 · #29(변경 축) · 사업장 소비 조회는 [11_compliance.md](./11_compliance.md) #5 |
| **(정기작업)** [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) | **#34** — 기능ID를 신설하지 않는다 · 화면 자리는 SYS-RATES 운영 절이다 |
| DSH-06 리포트 내보내기 | **#36**(시스템 콘솔 발급) · 계약 · 다운로드는 [04_workplace.md](./04_workplace.md) #35 · #36 |

**SYS 7기능 전수를 담았다**(위 표의 SYS 접두 7행). **DSH-06은 [../02_features/02_workplace.md](../02_features/02_workplace.md)가 갖는 기능**이라 SYS 검산에 넣지 않는다 — 이 문서는 발급 표면 하나를 갖는다. (정기작업) 행은 기능이 아니다 — 표를 채우려고 기능ID를 지어내지 않고 **그 표면의 정본을 가리킨다**. **CMP-02 행은 이 문서가 변경 표면을 소유하는 타 도메인 기능**이라 SYS 검산에 넣지 않는다 — 기능 전수 집계의 정본은 [../02_features/README.md](../02_features/README.md)이고 CMP-02는 [11_compliance.md](./11_compliance.md)의 CMP 5기능에 이미 계상돼 있다. 서버 내부 종점은 없다 — 이 도메인의 모든 동작은 플랫폼 운영자의 명시적 요청으로 일어나며, 계정 정지 만료 복귀 같은 자동 처리는 그 상태를 소유한 [03_auth.md](./03_auth.md)가 배치를 갖는다. **#34가 그 문장을 뒤집지 않는다** — 정기작업을 다시 돌리는 것도 운영자의 명시적 요청이고, 돌아가는 작업의 종점은 여전히 각 소유 도메인 문서에 있다.

## 관련 문서

- 전역 규약·멱등·커서 페이지네이션·다운로드 토큰 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/12_system.md](../02_features/12_system.md) · 플랫폼 RBAC 요약 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 요구사항 정본 → [../03_requirements/13_system.md](../03_requirements/13_system.md) · 기준값 조회 계약 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 계정 상태·보조 재설정·플랫폼 진입 판정 → [03_auth.md](./03_auth.md) · 자발 폐쇄와의 경로 구분 → [04_workplace.md](./04_workplace.md) · 한도의 소비 계약 → [13_subscription.md](./13_subscription.md) · SIZE_POLICY의 소비 계약 → [11_compliance.md](./11_compliance.md) · 동의 이력 → [15_privacy.md](./15_privacy.md)
- 플랫폼 RBAC 보안 설계 → [../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md)
- 테이블 명세 → [../05_database/15_system.md](../05_database/15_system.md) · [../05_database/17_infra.md](../05_database/17_infra.md)
- 정기작업 목록·주기·멱등 계약 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) · 실행 구조·기준일·재시도 → [../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
