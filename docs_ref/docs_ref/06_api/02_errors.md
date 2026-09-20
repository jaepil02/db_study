# 06_api / 02 에러 응답 (Errors)

> **대상**: 전 REST·SSE·다운로드 표면의 에러 응답 포맷 · 상태코드 규약 · SQLSTATE와 제약 위반의 코드 매핑 계약 · 네임스페이스별 에러 코드 미러
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — 미러 갱신 — auth.reauth_required의 대상 작업에 **프로필의 연락처·복구 이메일 변경**을 더한다([03_auth.md](./03_auth.md) #17) · export.forbidden에 **발생 지점**(목록 공통 내보내기의 표면 불일치 — [04_workplace.md](./04_workplace.md) #35 · [14_system.md](./14_system.md) #36)을 표기하고 export.expired · export.failed에 같은 표면을 더한다(채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)). **여기서 신설 · 개명 · 폐기하지 않으며 종수는 정본이 갖는다**
> **개정일**: 2026-09-09 — 미러 갱신 — export.forbidden · subscription.upgrade_required 두 행에 **v1 발생 지점 없음**을 표기한다(채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)). **코드 119종 · 16네임스페이스는 전건 불변**이며 **여기서 신설·개명·폐기하지 않는다**
> **개정일**: 2026-09-07 — 제약 → 코드 매핑 표에 **idempotency_records의 요청 축 부분 유일** 행을 더한다(V0711). **에러 코드를 신설하지 않았다** — 매핑되는 코드는 이미 채번된 도메인 멱등 코드 집합 그대로이고 제약 키만 늘어난다. 두 멱등 행이 **대체 관계가 아니라는 것**(도메인 자연 중복 방지 축 · 요청 축)과 **아래 행이 멱등 인터셉터 뒤의 백스톱**이라는 것을 함께 등재한다. 에러 코드 119종 · 16네임스페이스는 전건 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — 애플리케이션 검증 1차의 수단 표기를 Zod → **Bean Validation**으로 치환. **에러 코드 119종 · 16네임스페이스 · SQLSTATE 매핑 순서 계약은 불변**
> **개정일**: 2026-09-10 — details 열거를 규약 정본([01_conventions.md](./01_conventions.md))과 맞춘다 — **「workplace 제외 계열」을 걷는다.** 멤버 제외는 선행조건 4종이 **각각 별개 코드**라 details 축이 아니고, 목록이 필요한 자리는 에러가 아니라 **선행조건 조회 표면의 blockers 배열**이다([04_workplace.md](./04_workplace.md) #23) — **preflight 의 배열을 details 로 읽은 오독**이었다. 함께 **판정 기준을 앞세워** 열거가 다시 갈리지 않게 한다. **코드 120종 · 네임스페이스 16은 불변**
> **개정일**: 2026-09-10 — 정본의 **workplace.mgmt_no_required/422 채번을 미러**한다(119 → **120종** · workplace 21 → **22** · 422 축). 신고자료 표면에서 나되 **부재한 값이 사업장의 것이라 workplace 네임스페이스**이며 **네임스페이스 16은 불변**이다. details 표면 열거에도 이 코드를 더한다(규약 정본 [01_conventions.md](./01_conventions.md))
> **개정일**: 2026-08-21 — 정본의 잔여 집계 정합을 **같은 변경 단위로 미러** — 세는 기준 문장 118 → **119종** · 네임스페이스별 종수표 workplace 20 → **21**·합계 118 → **119** 및 검산식 · 절 제목 workplace (20) → **(21)** · 미러 범위 문장 118 → **119종** · 폐기 코드 절 118 → **119종**(정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) 2026-08-21 잔여 집계 정합 개정 대조)
> **개정일**: 2026-08-21 — 정본 채번 미러 — workplace.business_unit_overlap/409 등재(118 → **119종**) · 23P01 제약 매핑표에 business_units 소유자·명칭 겹침 행 추가
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 미러 — attendance.assignment_forbidden/422 등재(117 → **118종** · attendance 7 → **8** · 422 22 → **23**)
> **개정일**: 2026-08-08 — 정본 갱신 미러 반영: 마지막 OWNER 이탈 차단 2종에 양도 미구현 캐치 동일 문안 적용 · 원본 급여 중복확정 키를 (workplace_id, pay_period) → **(workplace_id, pay_period, source)** 3열로 정정 · 급여 기준 부재 코드에 근로조건·보험 정보 부재 흡수 명시 · 역할 변경 거부 코드에 데이터베이스 가드 2차 방어 명시
> **원천**: [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)(채번 정본 — 120종 · 16네임스페이스 · 폐기 2종) · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)(REQ-GLB-19 에러 규약) · [../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md)(제약 이름·정의)

에러는 **{domain}.{snake_case} 코드 + HTTP 상태**로 식별한다. 클라이언트는 code로만 분기하고 message는 표시에만 쓴다 — 문안이 바뀌어도 분기가 깨지지 않아야 하고, 다국어로 재매핑할 수 있어야 한다.

> **본 문서는 미러다.** 아래 표는 **정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)** 를 옮긴 것이다. 신규 코드는 정본에 먼저 등재한 뒤 이 문서에 반영한다 — 반대 순서로 진행하면 미러가 정본을 앞질러 두 문서가 갈린다. **여기서 코드를 신설·개명·폐기하지 않는다.**

**세는 기준은 "v1 서버가 발생시킬 수 있는 유효 코드의 개수"**이며 정본이 정한 값 그대로 **120종 · 16네임스페이스**다. 폐기 코드는 전수에서 빼고 폐기 절에만 남기며, 발생 지점이 v1에 없어도 불변식 명시를 위해 예약한 코드는 계약에 살아 있으므로 전수에 포함한다. 산정 범위의 상세는 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)의 종수 산정 기준 절이 갖는다.

> **원천 카탈로그 절의 행 수 105**(담당 도메인 94 + 타 도메인 참조 9 + 폐기 2)**는 유효 코드 전수가 아니다.** 정본이 유효 전수 **120종 · 16네임스페이스**를 확정했고 인용처([../README.md](../README.md) 고정 기준 · [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md) 등)도 119로 정렬돼 있다(2026-08-21 재정렬). **미러는 정본을 앞지르지 않으므로 여기서 코드를 신설·개명·폐기하지 않는다.**

## 응답 본문 포맷

실패는 전 표면이 같은 모양이다.

```json
{
  "code": "attendance.closing_blocked",
  "message": "마감할 수 없습니다. 아래 항목을 먼저 처리하세요.",
  "details": [
    { "reason": "MISSING_CLOCKOUT", "employeeId": "…", "workDate": "2026-07-14" },
    { "reason": "MISSING_EMPLOYEE_COUNT_SNAPSHOT", "baseDate": "2026-07-31" }
  ]
}
```

| 필드 | 타입 | 내용 |
|------|------|------|
| code | string | {domain}.{snake_case}. **클라이언트 분기의 유일한 근거**다 |
| message | string | 한국어 기본 문안. 표시 전용이며 분기 근거가 아니다 |
| details | array 또는 object · 선택 | 사용자가 조치할 수 있는 도메인 값 — 행 번호 · 필드명 · 사유 코드 · 대상 자원 ID · 현재 사용량과 한도 |

- **details에 내부 정보를 싣지 않는다** — 스택 트레이스 · SQL · DB 제약명 · 원문 예외 메시지 · 서버 파일 경로 · 환경변수는 어느 상황에서도 응답에 나가지 않는다(REQ-GLB-19).
- **details를 쓰는 표면은 정해져 있다.** 판정 기준은 하나다 — **한 코드가 여러 항목을 대표하고 사용자가 그 항목 각각을 조치해야 하는가.** **항목마다 코드가 다르면 code 가 이미 무엇을 조치할지 말하므로 details 를 두지 않는다** — 멤버 제외가 그 형태다(선행조건 4종이 각각 별개 코드이고, 목록이 필요한 자리는 에러가 아니라 **선행조건 조회 표면의 blockers 배열**이다). 현재 이 기준을 만족하는 것은 신고자료의 빈 관리번호 계열(workplace.mgmt_no_required — insuranceType · mgmtNoField) · 마감 차단 사유 배열(attendance.closing_blocked) · 임포트 행 오류(import.validation_failed) · 명세서 필수항목 누락 목록(payslip.missing_required_field) · 한도 초과의 사용량과 필요 등급(subscription 계열) · 폐쇄·퇴사 선행조건 미충족 목록(workplace.close_blocked · hr.resignation_blocked) · **누락 기준값 키 목록(payroll.missing_reference_value)**이다. 그 밖의 코드는 code와 message만 낸다. 규약 정본은 [01_conventions.md](./01_conventions.md)다.
- **성공 봉투를 두지 않는다.** 단건 응답은 자원 객체를 그대로 반환하고 목록만 items·page 봉투를 쓴다([01_conventions.md](./01_conventions.md)).
- **같은 사유에 두 코드를 두지 않는다.** 도메인 전용 코드가 있으면 common 계열로 폴백하지 않는다.

## 표준 상태코드

| 상태 | 의미 | 대표 코드 |
|:----:|------|----------|
| 400 | 입력 형식·요청 검증 실패 | common.validation_failed · common.invalid_format · auth.reset_token_invalid · notification.unknown_type |
| 401 | 미인증 · 재인증 필요 | auth.invalid_credentials · auth.token_invalid · auth.reauth_required |
| 402 | 결제·플랜 한도 | subscription 계열 4종 |
| 403 | 권한 없음 **또는 적용 대상 아님** | auth.csrf_token_invalid · leave.not_applicable · payroll.void_forbidden · system.permission_denied |
| 404 | 리소스 부재 **또는 존재 은닉** | common.not_found · payslip.not_found · notification.not_found · workplace.member_not_found |
| 409 | 충돌 — 중복 · 상태 불일치 · 동시성 · 선행조건 미완 | common.conflict · payroll.already_confirmed · workplace.close_blocked · hr.resignation_blocked |
| 410 | 만료·1회용 소진 | invitation.expired · payslip.download_token_expired · export.expired |
| 413 | 요청 크기 초과 | common.payload_too_large |
| 422 | **전제 미충족 — 조치하면 진행 가능** | payroll.missing_reference_value · attendance.out_of_geofence · import.validation_failed |
| 429 | rate limit 초과 | common.rate_limited |
| 500 | 서버 내부 처리 실패 | export.failed |
| 503 | 외부 서비스 장애 | common.service_unavailable · workplace.business_api_unavailable |

- **403과 422를 구분한다**(REQ-GLB-19). 403은 "적용 대상이 아니다"(정상 상태 — 5인 미만 연차 미적용)이고 422는 "전제가 빠졌다"(조치 가능 — 스냅샷 부재)다. 판정 트리의 정본은 [01_conventions.md](./01_conventions.md)다.
- **404를 존재 은닉에도 쓴다.** 타인 명세서·타인 알림·타인 초대는 403이 아니라 404다 — 403은 그 자원이 존재한다는 사실을 알려 준다.
- **413과 422를 구분한다.** 업로드 크기 초과는 요청 표면에서 끊기므로 413이고, 파일 안 행의 검증 실패는 422다.
- **cron·CORS 전용 코드를 두지 않는다.** 정기작업은 HTTP 표면이 아니라 서버 내부 종점이고, CORS 위반은 프리플라이트 단계에서 브라우저가 차단해 응답 본문이 애플리케이션에 도달하지 않는다. 반면 CSRF 위반은 서버가 실제 403을 생성하므로 auth.csrf_token_invalid를 갖는다.

## SQLSTATE·제약 위반 매핑 계약

애플리케이션 검증(요청 DTO 선언적 검증 → 서비스 규칙)이 1차이고 **DB 제약·RLS가 최종 판단**이다. 데이터베이스가 낸 오류를 도메인 코드로 바꾸는 순서는 다음과 같으며 **순서 자체가 계약**이다.

```plain
① 이미 도메인 코드를 가진 예외인가            → 그대로 통과(서비스 계층이 지정한 코드가 가장 정확하다)
② 제약 이름이 매핑 표에 있는가                → 그 코드로 좁힌다(SQLSTATE보다 좁은 판정이라 앞에 둔다)
③ SQLSTATE 기본 매핑                        → 아래 표
④ 영향 행 0건 승격                           → UPDATE·DELETE가 RLS USING을 통과하지 못하면 예외가 아니라 0행이다
                                              도메인 코드가 없으면 common.not_found/404로 승격한다
⑤ 그 밖                                     → 서버 내부 실패로 500을 응답하고 원문을 로그에만 남긴다
```

### SQLSTATE 기본 매핑

| SQLSTATE | 의미 | 기본 코드 | HTTP |
|----------|------|----------|:----:|
| 23505 | unique_violation | common.conflict | 409 |
| 23514 | check_violation | common.validation_failed | 400 |
| 23503 | foreign_key_violation | common.not_found | 404 |
| 23P01 | exclusion_violation(기간 겹침) | **제약별 도메인 코드 필수** — 아래 표 | 409 |
| 42501 | insufficient_privilege(RLS 거부) | auth.workplace_forbidden | 403 |
| 40001 · 55P03 | serialization_failure · lock_not_available | common.conflict | 409 |
| 그 외 | — | (도메인 코드 없음) | 500 |

- **23P01에는 기본 폴백을 두지 않는다.** 기간 겹침은 항상 어느 자원의 겹침인지가 사용자 조치를 가르므로 제약별 도메인 코드가 반드시 있어야 한다.
- **42501을 조회에 기대하지 않는다.** RLS는 조회에서 예외가 아니라 0행을 돌려주므로 조회 경로의 권한 밖 접근은 ④의 404로 수렴한다.
- **원문 예외 메시지를 응답에 싣지 않는다.** 제약명·SQL·테이블명이 그대로 나가면 스키마가 노출된다.

### 제약 위반 → 도메인 코드

제약 이름과 정의의 정본은 [../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md)다. 아래는 **제약이 지키는 불변식과 그 위반이 매핑될 코드**의 계약이다.

| 불변식 | SQLSTATE | 코드 | HTTP |
|--------|:--------:|------|:----:|
| username 유일 | 23505 | auth.username_taken | 409 |
| 휴대폰 부분 유일(DELETED 제외) | 23505 | auth.phone_taken | 409 |
| (business_no, site_label) 유일 | 23505 | workplace.duplicate_site | 409 |
| 사업장당 ACTIVE OWNER 1명 | 23505 · 트리거 | workplace.owner_singleton | 409 |
| 동일 사업장·대상 PENDING 초대 1건 | 23505 | (멱등 반환 — 오류로 만들지 않는다) | 200 |
| 동일 사업장·사용자 ACTIVE 직원 1건 | 23505 | hr.duplicate_active_employee | 409 |
| 주민번호 blind-index 사업장 내 유일 | 23505 | hr.resident_no_duplicate | 409 |
| 근로조건 유효기간 겹침 금지 | 23P01 | hr.term_overlap | 409 |
| 급여 기준 유효기간 겹침 금지 | 23P01 | payroll.payroll_terms_overlap | 409 |
| 기준값 (category, key) 기간 겹침 금지 | 23P01 | system.statutory_rate_overlap | 409 |
| 사업 단위 (소유자, 명칭) 유효기간 겹침 금지 | 23P01 | workplace.business_unit_overlap | 409 |
| 동일 직원·일자 PENDING 수정 요청 1건 | 23505 | attendance.change_request_pending | 409 |
| 동일 직원 휴가 기간 겹침 금지 | 23P01 | leave.request_overlap | 409 |
| **(workplace_id, pay_period, source)** 원본 급여 유일 | 23505 | payroll.already_confirmed | 409 |
| (payroll_run_id, employee_id) 원본 명세서 부분 유일 | 23505 | payslip.already_issued | 409 |
| (workplace_id, base_date, scope) 스냅샷 유일 | 23505 | common.conflict | 409 |
| (kind, version) 약관 문서 유일 | 23505 | system.terms_version_conflict | 409 |
| (user_id, kind, version) 동의 유일 | 23505 | privacy.consent_version_conflict | 409 |
| (workplace_id, idempotency_key) 부분 유일 | 23505 | 도메인 멱등 코드 — payroll.confirmation_conflict · payslip.bulk_conflict · 그 밖은 common.conflict | 409 |
| idempotency_records (scope_type, scope_id, idempotency_key) 부분 유일(WHERE status <> 'DISCARDED') | 23505 | 위 행과 같은 집합 | 409 |
| 동의에 참조된 약관 문서 삭제 금지 | 23503 | system.terms_in_use | 409 |
| 참조된 요금제 파괴적 변경 금지 | 23503 · 트리거 | system.plan_in_use | 409 |
| 마지막 SUPER_ADMIN 보호 | 트리거 | system.last_super_admin | 409 |

- **멱등 두 행은 대체 관계가 아니다** — 위는 **도메인 자연 중복 방지 축**(결과 행의 중복)이고 아래는 **요청 축**(재시도)이다. 축의 정본은 REQ-GLB-14([../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md))다.
- **아래 행은 백스톱이다.** 요청 축의 유니크 위반은 정상 경로에서 이 번역기까지 오지 않는다 — 멱등 인터셉터가 시작 기록의 위반을 잡아 표면이 선언한 충돌 코드로 접기 때문이며, 이 행은 **그 앞단이 빠졌을 때** 비로소 쓰인다.
- **같은 SQLSTATE가 호출 맥락에 따라 다른 코드로 갈린다.** 판별은 제약 이름과 호출 표면 기준으로 하며 **에러 코드에서 역산하지 않는다**.
- 초대 중복만 오류가 아니라 **멱등 반환**이다. 중복 초대를 409로 만들면 관리자가 같은 사람을 다시 초대할 때마다 실패를 본다.

## 네임스페이스별 코드 (미러 — 120종 전량)

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)다. 아래 16개 표가 **120종 전량을 미러링**한다(발췌가 아니다). v1에 발생 지점이 없는 예약 코드는 그 사실을 함께 적는다.

### common (7)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| common.validation_failed | 400 | 요청 본문·쿼리·경로 파라미터 검증 실패. **업로드 매직넘버와 확장자 불일치 · 수치 범위 상한 초과**(페이지 크기 · 조회 기간 · 정렬 필드 화이트리스트) 검증을 포함한다. 전 API 공통 |
| common.invalid_format | 400 | 필드별 형식 오류 — 전화번호 · 날짜 · UUID · 사업자번호 체크섬 · 좌표 |
| common.not_found | 404 | 도메인 전용 404 코드가 없는 조회 대상 부재. **UPDATE·DELETE가 RLS로 0행을 반환한 경우의 승격 폴백**을 포함한다 — 403을 주면 그 자원이 존재한다는 사실이 샌다 |
| common.conflict | 409 | 도메인 전용 409 코드가 없는 중복·상태 충돌. **직렬화 실패·락 획득 실패의 폴백**을 포함한다 |
| common.payload_too_large | 413 | 업로드·임포트 파일 등 허용 크기 초과 |
| common.rate_limited | 429 | 로그인 실패 누적 · 재설정 메일 발송 빈도 초과 · **국세청 진위확인 호출량 제한**. 재시도 가능 시각을 함께 반환한다 |
| common.service_unavailable | 503 | 외부 서비스 일시 실패(국세청 API 전용 코드는 별도) |

### auth (15)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| auth.username_taken | 409 | username 중복 — 가입 트랜잭션 재확인 포함 |
| auth.phone_taken | 409 | 휴대폰 중복 — 부분 유니크 · DELETED 제외 |
| auth.weak_password | 422 | 비밀번호 정책 미충족. **필드별 메시지를 반환**한다 |
| auth.invalid_credentials | 401 | 아이디 미존재·비밀번호 불일치 통일 — 사용자 열거 차단 |
| auth.password_unchanged | 422 | 새 비밀번호가 현재 비밀번호와 동일 |
| auth.token_invalid | 401 | access·**refresh** token 만료·revoke·서명 불일치. **회전 재발급 실패도 이 코드**이며 인증 컨텍스트를 폐기한다 — 화면은 입력을 보존한 채 재로그인을 유도한다(01_standards §1-4) |
| auth.csrf_token_invalid | 403 | 웹 세션 채널 상태변경 요청의 CSRF 토큰 부재·불일치 — 앱 JWT 채널은 대상 아님 |
| auth.account_suspended | 403 | SUSPENDED 계정의 로그인·접근. **정지 사유·해제 예정일을 함께 반환**한다 |
| auth.account_deleted | 403 | DELETED 계정의 로그인·재설정·**초대 수락** |
| auth.consent_required | 422 | 필수 약관·개인정보 동의 또는 개정 재동의 누락 — 위치정보는 별도 선택 동의라 가입 요건이 아니다(D-19) |
| auth.reset_token_invalid | 400 | 재설정 토큰 만료·사용완료·불일치. 반복 실패는 rate limit + 보안 이벤트 기록 대상이다 |
| auth.reauth_required | 401 | 민감 작업(민감정보 복호화 · 사업장 폐쇄 · 계정 탈퇴 · 민감 문서 다운로드 · 프로필의 연락처·복구 이메일 변경)의 재인증 미충족 **또는 재인증 토큰 검증 실패**(만료 · 이미 소비 · 불일치). 재인증 결과는 단기 유효이며 작업 단위로 소비한다 |
| auth.workplace_forbidden | 403 | 요청 workplace_id와 멤버십·역할 불일치 |
| auth.platform_forbidden | 403 | 시스템 웹 진입 시 플랫폼 권한 자체가 없음. **사업장 OWNER라도 플랫폼 권한은 별개**다 |
| auth.owner_must_transfer | 409 | OWNER로 소유한 사업장이 남아 있어 탈퇴 차단. **v1은 사업장 양도가 미구현이라 실질 해소 경로는 폐쇄뿐**이므로 폐쇄 경로를 안내한다 |

### workplace (22)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| workplace.business_invalid | 422 | 진위확인 불일치 또는 **폐업** 사업자 — 휴업은 경고 후 허용 |
| workplace.business_api_unavailable | 503 | 국세청 API 장애·timeout·호출량 초과. **PENDING_VERIFICATION 생성 경로를 함께 제시**한다 |
| workplace.duplicate_site | 409 | 동일 (business_no, site_label) 완전 중복. **동일 사업자번호의 복수 사업장 등록 자체는 허용**한다 |
| workplace.verification_pending | 409 | PENDING_VERIFICATION 상태에서 급여 확정·명세서 발행 시도. **근태·인사 입력은 허용**한다 |
| workplace.immutable_field | 422 | business_no · owner_name · open_date 등 **재검증 없이 바꿀 수 없는** 보호 필드 변경 시도 |
| workplace.already_member | 409 | 초대 대상이 이미 ACTIVE 멤버 |
| workplace.invite_role_forbidden | 403 | 역할 초대 권한 위반 — MANAGER의 MANAGER·OWNER 초대 |
| workplace.closed | 409 | SUSPENDED·CLOSED 사업장에서 초대 수락·업무 진입 시도 |
| workplace.unavailable | 409 | SUSPENDED·CLOSED 사업장으로 컨텍스트 전환 시도 |
| workplace.role_change_forbidden | 403 | 역할 변경 권한·경로 위반 — MANAGER의 역할 변경 · **역할 변경으로 OWNER를 생성하려는 시도**. 서비스 1차 검증과 **데이터베이스 가드 2차 방어**가 같은 코드를 낸다 |
| workplace.owner_singleton | 409 | ACTIVE OWNER 1명 불변식 위반 — 0명 또는 2명 이상 |
| workplace.last_owner | 409 | 마지막 OWNER 강등·제외 시도. **v1은 사업장 양도가 미구현이라 실질 해소 경로는 폐쇄뿐**이므로 폐쇄 경로를 안내한다 |
| workplace.payroll_in_progress | 409 | 급여 확정 진행 중인 대상자의 멤버 제외 차단 |
| workplace.pending_approver | 409 | 미처리 승인의 필수 승인자 제외 차단. **승인자 재배정이 선행**해야 한다 |
| workplace.member_not_found | 404 | 역할변경 등 대상 멤버십 부재 |
| workplace.member_state_conflict | 409 | REMOVED·SUSPENDED 이력 멤버십의 재초대 수락 — LEFT만 재활성화 허용 |
| workplace.employee_required | 409 | **멤버 제외로** 사업장 필수 직원(최소 1명)이 미달. 퇴사 처리의 선행조건 차단은 hr.resignation_blocked/409가 담당한다 |
| workplace.close_blocked | 409 | 폐쇄 전 미완 급여·미발행 명세서·미처리 승인 존재. **미충족 항목을 details로 반환**한다 |
| workplace.retention_ack_required | 422 | 폐쇄 시 법정 보존 안내 확인(retention_acknowledged) 누락 |
| workplace.transfer_invalid | 422 | 양도 대상·상태·한도 검증 실패 — **v1 발생 지점 없음**(양도 미채택 · 코드만 예약) |
| workplace.business_unit_overlap | 409 | 같은 소유자·명칭의 사업 단위 선언 유효기간 겹침(business_units EXCLUDE — 주로 동시 선언 경합) |
| **workplace.mgmt_no_required** | 422 | 신고자료 생성 시 **대상 보험 계열의 사업장관리번호가 비어 있음**. 발생 지점은 TAX 표면([10_tax.md](./10_tax.md))이고 해소 자리는 사업장 설정이다. **비어 있는 계열을 details로 반환**한다 |

### invitation (3)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| invitation.expired | 410 | 만료(EXPIRED) 토큰으로 수락 시도 |
| invitation.invalid_token | 422 | 초대 토큰·공유코드 무효 — 재발송으로 무효화된 직전 토큰 포함 |
| invitation.already_responded | 409 | 이미 응답한 초대의 재수락·재거절 · **이미 응답된 초대의 재발송·취소 시도**. 재발송은 종단 상태(REJECTED · EXPIRED)에서만 새 행을 만든다 |

### subscription (5)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| subscription.workplace_limit_exceeded | 402 | OWNER 사업장 등록 수 한도 초과. **현재 사용량·필요 등급·업그레이드 경로를 함께 반환**한다 |
| subscription.staff_limit_exceeded | 402 | 사업장 활성 멤버 수 한도 초과 — 초대 발송·수락·임포트 **세 지점에서 각각 검증**한다 |
| subscription.expired | 402 | 구독 만료로 기능 차단 — **법정 보존 데이터 조회는 제외** |
| subscription.plan_not_found | 404 | 요금제 미존재 |
| subscription.upgrade_required | 402 | 기능 플래그·한도로 업그레이드 필요. **v1 발생 지점 없음** — 한도 2축은 좁은 두 코드가 갖는다 |

### hr (13)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| hr.duplicate_active_employee | 409 | 동일 사업장·사용자 ACTIVE 직원 중복 |
| hr.resident_no_duplicate | 409 | 동일 사업장 주민번호·외국인등록번호 중복 — blind-index 판정 |
| hr.decrypt_forbidden | 403 | 복호화 **4요건**(재인증 · 사유 · 감사 · 1회성 응답) 미충족 |
| hr.decrypt_envelope_conflict | 409 | 1회성 복호화 응답 envelope 등록 충돌 |
| hr.personal_info_key_version_conflict | 409 | 키 회전 경계의 부분 저장으로 키 버전 메타데이터가 깨질 수 있음 |
| hr.hire_date_conflict | 409 | 기존 ACTIVE 직원의 hire_date와 다른 입사 확정 요청 |
| hr.rehire_requires_new_employee | 409 | RESIGNED 직원 레코드 재활성화 시도 — 새 입사 레코드가 필요 |
| hr.term_overlap | 409 | 근로조건 유효기간 겹침 |
| hr.below_minimum_wage | 422 | 근로조건 등록 시 시급 환산액이 최저임금 미만 |
| hr.resignation_blocked | 409 | 퇴사 전 미완 **급여 확정**·미처리 승인·OWNER 역할 보유. **미충족 항목을 details로 반환**한다 |
| hr.contract_missing_field | 422 | 근로계약 필수 명시사항 누락 — 단시간 근로일별 시간 포함 |
| hr.contract_not_signable | 409 | 계약 상태상 전자서명 불가 또는 본인 계약 아님 |
| hr.minor_document_missing | 422 | 연소자 법정 비치 서류 미비치 |

### attendance (8)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| attendance.invalid_sequence | 409 | 미퇴근 상태의 중복 출근 · 출근 없는 퇴근 · 퇴근이 출근보다 이름 · **휴게 순서 위반**(출근 전·퇴근 후 휴게 · 중복 휴게 시작 · 진행 중 휴게 없는 휴게 종료) |
| attendance.out_of_geofence | 422 | 서버 재검증 결과 지오펜스 반경 밖. **예외 요청 경로를 안내**한다 |
| attendance.accuracy_too_low | 422 | **좌표 미수신**(위치 자체가 없음). **정확도 저하만으로는 차단하지 않고 attendance_status = PENDING으로 저장한 뒤 사유를 risk_flags에 남겨 관리자 승인 대상으로 넘긴다** — 출근을 차단하면 근무는 했는데 기록이 없는 상태가 되어 근태·급여 누락으로 직결된다 |
| attendance.change_request_pending | 409 | 동일 직원·동일 일자에 PENDING 수정 요청이 이미 존재 |
| attendance.self_approval_forbidden | 403 | 본인 수정 요청·본인 PENDING 체크인 레코드의 본인 승인 시도 |
| attendance.closing_blocked | 409 | 월 마감 차단. **사유 6종을 배열로 반환**한다 — 미퇴근 · 미승인 수정요청 · 스케줄 누락 · 스냅샷 누락 · 휴게 미달 · 데이터 모순 |
| attendance.period_closed | 409 | 마감(LOCKED)·급여 확정된 기간의 근태 수정·승인 시도 · **마감 기간의 스케줄 변경·삭제 시도** |
| **attendance.assignment_forbidden** | **422** | **법정 보호 대상자의 금지 시간대 편성 시도** — 연소자의 야간·주휴일 배치, 임신 중 근로자의 소정근로 초과 배치 |

### leave (6)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| leave.not_applicable | 403 | 5인 미만 기간의 법정 연차 미적용 — **정상 상태**이며 조치 대상이 아니다 |
| leave.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재로 적용 여부 판정 불가 — **조치 가능** |
| leave.request_overlap | 409 | 동일 직원의 휴가 기간 중복 신청 |
| leave.insufficient_balance | 422 | 예약 차감 시점 잔액 부족 |
| leave.period_closed | 409 | 마감된 근태·급여 기간에 대한 휴가 신청·변경 |
| leave.self_approval_forbidden | 403 | 본인 신청의 본인 승인 시도 |

### payroll (10)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| payroll.missing_reference_value | 422 | 귀속기간·지급일에 필요한 기준값 누락 또는 확인자 미기입. **임의 기본값·직전 연도 값 대체를 금지**한다 |
| payroll.missing_payroll_terms | 422 | 급여 기준 부재 또는 **지급일 미설정** — 지급일이 없으면 간이세액표 버전을 결정할 수 없다. **근로조건(employment_terms)·보험 적용정보(employee_insurance_infos) 부재도 이 코드로 흡수**하며 별도 코드를 두지 않는다 |
| payroll.payroll_terms_overlap | 409 | 급여 기준 유효기간 겹침 |
| payroll.attendance_not_closed | 409 | 근태 미마감 상태의 계산·확정 시도. **미리보기에는 적용하지 않는다** |
| payroll.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재. 사업장 검증 대기 차단과는 **별개 사유**다 |
| payroll.below_minimum_wage | 422 | 최저임금 미달 — 확정 차단 또는 관리자 명시 확인 요구. **강행 확정은 사유·행위자를 감사 기록**한다 |
| payroll.already_confirmed | 409 | 동일 **(workplace_id, pay_period, source)** 에 **무효화되지 않은 실행이 이미 있는데** 다시 확정 — source(REGULAR · IMPORT)가 키에 포함되므로 같은 급여월에 정기 실행과 임포트 실행이 각각 한 건씩 성립하고, **정정본도 판정에 참여한다**(V0737 — 종전 술어는 정정본을 세지 않아 원본 무효화 뒤 새 원본이 설 수 있었다) |
| payroll.confirmation_conflict | 409 | 확정·**정정본 발행** 멱등키 충돌. 두 표면이 같은 멱등키 공간을 쓴다 |
| payroll.void_forbidden | 403 | 원본 VOID·정정본 발행 권한 없음 — MANAGER 시도, **OWNER 전용**이다 |
| payroll.severance_source_missing | 409 | 퇴직금·이직확인서 산정에 필요한 확정 급여 부재 |

### payslip (10)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| payslip.not_found | 404 | 명세서 없음 또는 접근 불가. **행 존재 자체를 숨긴다 — 403이 아니다** |
| payslip.run_not_confirmed | 409 | 대상 급여 실행 미확정 |
| payslip.missing_required_field | 422 | 법정 필수 기재사항 데이터 누락. **보완 항목 목록을 반환하고 교부하지 않는다** |
| payslip.generation_failed | 422 | PDF 생성 실패 — status = FAILED. **급여 확정을 롤백하지 않는다** |
| payslip.already_issued | 409 | GENERATE_MISSING 대상이 이미 발행됨 — 재발행은 정정본 경로만 |
| payslip.bulk_in_progress | 409 | 동일 급여 실행의 일괄 작업 진행 중 |
| payslip.bulk_conflict | 409 | 일괄 발행·**정정본 발행** 멱등키 충돌 |
| payslip.download_token_expired | 410 | 1회용 다운로드 토큰 만료·사용 후 재사용. **인사 민감 문서 다운로드와 규약을 공유**한다 |
| payslip.forbidden | 403 | 본인도 사업장 관리자도 아닌 **관리 액션** 시도. 열람 대상 자원의 비소유 접근은 이 코드가 아니라 payslip.not_found/404다 — 관리 액션은 이미 그 명세서의 존재를 아는 관리자가 부르는 표면이라 은닉의 의미가 없다 |
| payslip.correct_forbidden | 403 | 정정본 발행 권한 없음 — MANAGER 시도이며 OWNER 전용 |

### notification (4)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| notification.not_found | 404 | 알림 부재 **또는 타인 알림(조회·조작 모두) — 행 존재 은닉**. 타인 자원 접근은 403이 아니라 404로 통일해 존재를 노출하지 않는다 |
| notification.forbidden | 403 | 필수 알림 해제·삭제 등 **본인 알림에 대한 불허 조작**. 대상이 본인 알림임을 이미 아는 상태의 권한 판정이며 **타인 알림 접근은 이 코드가 아니라 notification.not_found/404**다 |
| notification.unknown_type | 400 | 미정의·비활성 알림 타입 생성 시도 |
| notification.mandatory_pref | 409 | 필수 알림 수신 거부 시도 — **v1 발생 지점 없음**(알림 설정 미채택 · 불변식 명시용 예약) |

### device_token (1)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| device_token.invalid | 400 | 푸시 토큰·플랫폼 형식 오류 — **v1 발생 지점 없음**(푸시 미채택 · 코드만 예약) |

### import (3)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| import.validation_failed | 422 | 행 단위 검증 오류 — details에 행 번호·필드·사유 |
| import.duplicate_employee | 409 | **업로드 파일 내 행간 중복**(동일 username·주민번호) 전용 |
| import.rollback_required | 409 | 확정 후 재시도 필요 — **확정 트랜잭션이 원자 단계에서 실패해 커밋분 자체가 무효화된 경우**로 한정한다. 행 단위 부분 실패는 이 코드가 아니라 200 + PARTIALLY_COMMITTED다 |

### privacy (2)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| privacy.location_consent_required | 403 | 위치정보 별도 동의 없이 GPS 체크인 시도. **동의 화면으로 유도**한다 |
| privacy.consent_version_conflict | 409 | 동일 (user_id, kind, version) 동의 중복 기록 — 멱등 처리 |

### system (7)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| system.permission_denied | 403 | 역할별 권한 키 미충족 — **플랫폼 권한은 보유**한 상태 |
| system.last_super_admin | 409 | 마지막 SUPER_ADMIN 정지·삭제·회수 차단 |
| system.plan_in_use | 409 | **이미 참조된** 요금제의 파괴적 변경·삭제 |
| system.statutory_rate_overlap | 409 | 기준값 유효기간 겹침. **btree_gist EXCLUDE 제약이 강제**한다 |
| system.terms_version_conflict | 409 | 동일 (kind, version) 문서 중복 |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 없음 |
| system.terms_in_use | 409 | 이미 동의에 참조된 문서 버전 삭제 시도. **비활성화만 허용**한다 |

### export (4)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| export.forbidden | 403 | 내보내기 권한·필터 범위 위반. **발생 지점은 목록 공통 내보내기의 표면 불일치**다 — 등재된 목록을 그 목록이 속하지 않은 표면에서 요청. 목록 자체의 조회 권한 미충족은 그 목록 조회 표면의 코드 그대로다 |
| export.not_ready | 409 | 내보내기 작업 미완료 — PENDING · RUNNING 상태 |
| export.expired | 410 | 내보내기 다운로드 토큰 만료·자동 삭제. 목록 공통 내보내기는 없음 · 만료 · 재사용 · 바인딩 불일치 · 소유자 불일치를 이 코드로 수렴한다 |
| export.failed | 500 | 내보내기 파일 생성 실패 — 감사 로그 내보내기 작업 · 목록 공통 내보내기의 XLSX 작성. **전수에서 유일한 500 코드**다 |

### 네임스페이스별 종수

| 네임스페이스 | common | auth | workplace | invitation | subscription | hr | attendance | leave | payroll | payslip | notification | device_token | import | privacy | system | export | 합계 |
|--------------|:------:|:----:|:---------:|:----------:|:------------:|:--:|:----------:|:-----:|:-------:|:-------:|:------------:|:------------:|:------:|:-------:|:------:|:------:|:----:|
| 종수 | 7 | 15 | **22** | 3 | 5 | 13 | **8** | 6 | 10 | 10 | 4 | 1 | 3 | 2 | 7 | 4 | **120** |

검산: 7 + 15 + **22** + 3 + 5 + 13 + 8 + 6 + 10 + 10 + 4 + 1 + 3 + 2 + 7 + 4 = **120** · 네임스페이스 **16종**. 표의 순서와 값은 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)의 도메인별 집계와 일치한다.

- **v1에 발생 지점이 없는 예약 코드는 3종**이다 — workplace.transfer_invalid(양도 미채택) · notification.mandatory_pref(알림 설정 미채택) · device_token.invalid(푸시 미채택). 셋 다 **계약에 살아 있으므로 전수에 포함**하되 발생 표면 열이 비어 있다.
- **감사 action 키는 에러 코드가 아니다.** audit_logs.action의 {domain}.{verb} 형식(pii.decrypt · payroll.void · workplace.suspend)은 HTTP 상태를 갖지 않으며 이 카탈로그의 대상이 아니다. 멱등키 접두와 응답 필드명도 마찬가지다.
- **cron·CORS 전용 네임스페이스를 두지 않는다.** 정기작업 8건은 HTTP 표면이 아니라 서버 내부 종점이고 CORS 위반은 응답 본문이 애플리케이션에 도달하지 않는다.
- **TAX·CMP·SUB 화면 도메인은 전용 네임스페이스를 갖지 않는다.** TAX·CMP는 상위 도메인 코드로 실패가 표현되고 SUB는 subscription 네임스페이스를 그대로 쓴다.

## 폐기 코드

폐기 코드는 **재사용하지 않는다**. 전수 120종에 포함하지 않으며 구현·문서에 문자열이 남아 있어도 계약으로 취급하지 않는다. 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)의 폐기 코드 절이다.

| 폐기 코드 | 대체 코드 | 사유 |
|-----------|-----------|------|
| import.staff_limit_exceeded | subscription.staff_limit_exceeded / 402 | 직원 한도 초과는 발생 지점과 무관하게 구독 도메인 코드를 재사용한다 — 같은 사실에 코드를 둘 두지 않는다 |
| dashboard.export_failed | export.failed / 500 | 리포트·대장 생성 실패를 단일 코드로 통합했다. dashboard 네임스페이스 자체를 두지 않는다 |

## 도메인 문서별 코드 소재

| 문서 | 정의처인 네임스페이스 | 발생만 하는 주요 코드 |
|------|---------------------|---------------------|
| [03_auth.md](./03_auth.md) | auth(15) | system.last_super_admin · system.terms_not_found · privacy.consent_version_conflict |
| [04_workplace.md](./04_workplace.md) | workplace(20) · invitation(3) · import(3) | subscription 2종 · hr 2종 · payslip 토큰 |
| [05_hr.md](./05_hr.md) | hr(13) | auth.reauth_required · payslip.download_token_expired |
| [06_attendance.md](./06_attendance.md) | attendance(7) | privacy.location_consent_required · hr.minor_document_missing |
| [07_leave.md](./07_leave.md) | leave(6) | — |
| [08_payroll.md](./08_payroll.md) | payroll(10) | workplace.verification_pending · payslip.download_token_expired |
| [09_payslip.md](./09_payslip.md) | payslip(10) | workplace.verification_pending · notification.mandatory_pref |
| [10_tax.md](./10_tax.md) | **없음** | payroll 2종 · payslip 토큰 · common 계열 |
| [11_compliance.md](./11_compliance.md) | **없음** | payroll · leave · attendance · system 계열 |
| [12_notification.md](./12_notification.md) | notification(4) · device_token(1) | auth.token_invalid |
| [13_subscription.md](./13_subscription.md) | subscription(5) | system.plan_in_use |
| [14_system.md](./14_system.md) | system(7) · export(4) | auth.platform_forbidden · subscription.plan_not_found |
| [15_privacy.md](./15_privacy.md) | privacy(2) | auth.consent_required · system.terms_not_found |
| [01_conventions.md](./01_conventions.md) · 본 문서 | 규약 문서 — 정의처가 아니다 | — |

- common 7종의 정의처는 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)이며 전 표면이 발생시킨다.
- **TAX·CMP 두 도메인은 전용 코드를 갖지 않는다.** 신고자료 산출과 상시근로자 산정은 상위 도메인의 데이터를 읽어 결과를 만드는 경로라 실패 원인이 모두 상위 도메인 코드로 표현되며, 사용자도 "산정이 없다"가 아니라 "이 급여를 확정할 수 없다"는 맥락에서 문제를 만나야 한다.

## 관련 문서

- 응답 규격·상태코드 판정 트리·details 규약 → [01_conventions.md](./01_conventions.md)
- 에러 코드 채번 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) · ID 규약 → [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)
- 에러 규약 원천(REQ-GLB-19) · common 7종 정의처 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 제약 이름·정의 정본 → [../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md) · RLS 정책 → [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)
- 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 표면 총괄·파일 목차 → [README.md](./README.md)
- 고정 기준 → [../README.md](../README.md)
