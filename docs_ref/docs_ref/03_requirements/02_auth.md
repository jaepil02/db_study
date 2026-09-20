# REQ-AUT — 인증·계정 요구사항

> **대상**: 회원가입 · 로그인 · 세션 · **프로필 관리** · 비밀번호 변경/재설정 · 계정 상태 머신 · 탈퇴 · 진입 컨텍스트 분기 · 민감 작업 재인증
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **REQ-AUT-26 신설**(AUT-05 프로필 관리 · D-23 · v1.1 이월 해제) — 절 **AUT-05 프로필 관리 P2**를 기능 번호 자리에 둔다. REQ-AUT-25의 재인증 대상 4 → **5종**(프로필의 연락처 · 복구 이메일 변경) · 관련 테이블 security_events kind 6 → **8값**(V0739) · 에러 표 auth.phone_taken · auth.reauth_required에 REQ-AUT-26 병기
> **개정일**: 2026-09-10 — REQ-AUT-15에 **SUPPORT가 하는 일을 등재**한다(대행 방식 확정 — 표면 정본 [../06_api/14_system.md](../06_api/14_system.md) #10) — **복구 이메일 대리 등록**이며 등록과 링크 발송이 한 트랜잭션이고, 이미 등록된 계정은 대행 대상이 아니다. **대체가 아니라 정밀화**라 새 REQ를 채번하지 않는다 — 종전 문언(안내한다 · 토큰 미발급 · 응답 통일 · 발송 빈도 제한)은 그대로이고 **비어 있던 자리만 채운다.** **REQ 채번·건수는 전건 불변**
> **개정일**: 2026-09-07 — REQ-AUT-15에 **강제 지점을 등재**한다(V0714) — 복구 이메일 미등록 계정에는 토큰을 발급하지 않으며 판정은 서버 함수 issue_password_reset 안이다. **요구사항 문장의 계약은 바뀌지 않고 어디서 강제되는지가 더해진다.** 같은 보정이 그 함수의 반환에 수신 주소를 더했다 — 아이디 축 요청은 복구 이메일을 읽을 자리가 미인증 경로에 없어 **토큰만 적재되고 메일이 나가지 않았다**(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #36). REQ 채번·문언·건수는 전건 불변
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 보안 이벤트의 성공·실패 구분과 미존재 아이디 기록 계약 명문화 · 상태 전이 부수컬럼의 DB 강제 등재 · 탈퇴 차단과 활성 버전 동의의 2차 방어 등재 · 푸시 토큰 정리 서술을 부정형으로 정정 · username 재사용 정책값 서술 정정
> **개정일**: 2026-08-08 — 라우트 보호를 서버 미들웨어 판정에서 클라이언트 라우터 가드(UX 보조) + 서버 최종 강제로 재정의(D-20) · 탈퇴 시 멤버십 처리 범위를 남은 멤버십으로 통일(폐쇄 트랜잭션이 OWNER 멤버십을 종료 전이)
> **원천**: docs_ref2/requirements_p0.md AUT 절(REQ-AUT-01~25) · docs_ref2/features_p0.md(AUT 9기능) · docs_ref2/schema_p0.md auth 7테이블 · 확정 결정 D-03 · D-20(D-04 대체)

계정은 **아이디·비밀번호 단일 체계**이며 직원 · 사업장 운영자(OWNER·MANAGER) · 플랫폼 관리자가 같은 계정을 쓴다. 표면에 따라 인증 컨텍스트가 다르다 — **관리자 웹과 시스템 웹은 서버 세션**(HttpOnly 쿠키 + CSRF 토큰), **직원 앱은 JWT**(access + refresh)다. 쿠키는 D-03에 따라 상위 도메인 스코프로 발급해 웹과 API가 서브도메인으로 분리돼도 같은 세션을 공유한다.

계정 상태(ACTIVE · SUSPENDED · DELETED)와 사업장 멤버십은 별개 축이다. 계정이 살아 있어도 멤버십이 없으면 온보딩으로 가고, 사업장 OWNER라도 플랫폼 권한은 별개다. **상태 전이 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)**이며 본 문서는 전이의 조건·차단·부수효과만 계약한다.

전역 계약(시간 경계 · 감사 · 에러 규약 · 동시성)은 [01_global_rules.md](./01_global_rules.md)를 전제한다.

## AUT-01 회원가입  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-01 | 회원가입 입력·검증 | 필드는 **username**(4~20자 · 영소문자와 숫자 · 첫 글자 영문 · 예약어 금지) · **password**(8자 이상 · 영문·숫자·특수문자 중 2종 이상) · **name**(2~50자) · **phone**(국내 휴대폰 또는 E.164) · **recovery_email**(선택) · **약관·개인정보 동의(필수 2종)** · **위치정보 동의(선택 — 가입 요건이 아니다, D-19 · REQ-AUT-03)**다. 클라이언트와 서버 양쪽에서 검증하고 **서버 판정이 최종**이다. **username 형식·phone 형식·recovery_email 형식은 DB CHECK가 함께 강제하고 예약어 금지만 서버 검증 전용이다** — 예약어 목록이 운영 중 늘어나는 정책값이라 제약에 박지 않는다(정본 [../05_database/01_auth.md](../05_database/01_auth.md)) | 미인증 | P0 |
| REQ-AUT-02 | 자격증명·프로필 원자 생성 | 단일 트랜잭션에서 users(id · username UNIQUE · password_hash · status=ACTIVE)와 profiles(id = users.id · name · phone · recovery_email · avatar_url · created_at)를 생성한다. 비밀번호는 적응형 해시(bcrypt·argon2 계열)로 저장하고 **원문·해시를 로그·응답·감사 전후값에 남기지 않는다**. 실패 시 전체 롤백한다 | 서버 | P0 |
| REQ-AUT-03 | 가입 동의 필수 | 활성 버전의 **약관·개인정보 문서 2종**(REQ-SYS-15)에 동의해야 가입이 성립하며, **동의 행이 활성 버전을 가리키는지와 복사한 version 값이 그 문서의 version과 일치하는지를 DB 가드가 재검증**한다(정본 [../05_database/01_auth.md](../05_database/01_auth.md)). **위치정보 동의는 가입 요건이 아니라 별도 선택 동의**다(D-19) — 가입 화면에서 선택으로 받되 미동의여도 가입은 성립하고, GPS 체크인 사용 전에 필수로 받으며(REQ-PRV-01) 미동의·철회 상태의 체크인은 차단된다. 동의 이력은 REQ-PRV-02가 기록한다. 필수 동의 누락은 **auth.consent_required/422** | 미인증 | P0 |
| REQ-AUT-04 | 중복·강도 처리 | username 중복은 **auth.username_taken/409**, phone 중복은 **auth.phone_taken/409**(profiles.phone 부분 유니크 · status ≠ DELETED 대상), 비밀번호 정책 미충족은 **auth.weak_password/422**로 필드별 메시지와 함께 반환한다. 클라이언트는 weak·medium·strong 강도를 실시간 표시한다 | 미인증 | P0 |
| REQ-AUT-05 | 가입 후 진입 | 가입 성공 시 인증 컨텍스트를 수립하고, 소속·소유 사업장이 0개면 온보딩(사업장 등록 또는 초대 대기) 화면으로 보낸다(REQ-AUT-24) | 본인 | P0 |

## AUT-02 로그인  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-08 | 로그인 인증·컨텍스트 발급 | username과 password를 해시 검증한다. **관리자 웹과 시스템 웹은 서버 세션** — HttpOnly·Secure 쿠키 + CSRF 토큰이며 access token을 JavaScript에 노출하지 않는다. **직원 앱은 JWT** — access와 refresh를 기기 보안 저장소에 보관하고 Bearer로 전송한다 | 미인증 | P0 |
| REQ-AUT-09 | 로그인 상태 선검증 | 인증 성공 직후 users.status를 조회한다. DELETED이면 컨텍스트를 즉시 폐기하고 **auth.account_deleted/403**, SUSPENDED이면 정지 사유와 해제 예정일을 포함해 **auth.account_suspended/403**을 반환한다 | 미인증 | P0 |
| REQ-AUT-10 | 오류 통일·rate limit | 아이디 미존재와 비밀번호 불일치를 **auth.invalid_credentials/401**로 통일해 사용자 열거를 차단한다. (IP, username) 조합의 실패 횟수를 제한하고 초과 시 **common.rate_limited/429**와 재시도 가능 시각을 반환한다 — **판정 카운터는 Redis에 두고**([../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md)) security_events는 사후 감사 증거만 담는다. 로그인 성공 시 profiles.last_login_at을 갱신한다. **로그인 성공·실패를 security_events에 남기며 아이디가 존재하지 않는 실패도 기록한다** — 대상 축은 user_id가 아니라 attempted_username이고 user_id는 NULL이다(정본 [../05_database/01_auth.md](../05_database/01_auth.md)) | 미인증 | P0 |

## AUT-03 세션 관리  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-11 | 세션 검증·갱신 | 앱은 시작 시 JWT를 검증하고 access token 만료가 임박하면 refresh token으로 회전 재발급해 자동 로그인을 유지한다. 웹은 서버 세션 유효성을 검증·연장한다. **access token과 refresh token 어느 쪽이든 만료·revoke·서명 불일치이면 auth.token_invalid/401**로 인증 컨텍스트를 폐기한다 — 회전 재발급 요청에서 refresh token 검증이 실패하는 경우도 같은 코드이며, 실패 사유를 세분해 응답하지 않는다(토큰 상태 열거 방지). **화면 처리는 작성 중인 폼 입력을 버리지 않는다** — 입력을 보존한 채 재로그인을 유도하고 복귀 후 사용자가 재제출한다(정본: 07_screen/01_standards.md §1-4 세션 만료 상태). 단순 탐색 중이면 로그인 화면으로 보낸다. 웹 상태변경 요청에 CSRF 토큰이 없거나 불일치하면 **auth.csrf_token_invalid/403** | 본인 | P0 |
| REQ-AUT-12 | 라우트 보호 | 미인증 사용자의 보호 경로 접근은 로그인으로 유도한다. **공개 경로는 로그인 · 회원가입 · 가입 동의(재동의 게이트 — 컨텍스트 발급 전 미인증 진입) · 아이디 중복 확인 · 비밀번호 재설정 · 약관·개인정보·위치정보 문서 조회로 한정**한다. **웹에는 요청을 가로채는 서버 미들웨어 계층이 없다**(D-20) — 클라이언트 라우터 가드는 UX 보조일 뿐 신뢰 계층이 아니며, 최종 강제는 서버 검증과 RLS 2차 방어다. 세션 쿠키는 HttpOnly라 스크립트가 읽을 수 없으므로 **가드가 쿠키를 직접 판독하는 구현을 금지**하며, 판정 입력의 정본은 [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md)다 | 시스템 | P0 |
| REQ-AUT-13 | 세션 폐기 트리거 | 로그아웃 · 계정 정지 · 비밀번호 변경(전체 로그아웃 선택 시) · 탈퇴 시 웹 세션을 무효화하고 refresh token을 revoke한다. 인증이 유효한 중에 status가 SUSPENDED·DELETED로 바뀌면 다음 요청에서 서버 검증과 2차 방어가 차단한다. **기기 푸시 토큰을 정리하는 절차를 v1에 두지 않는다** — 푸시(NTF-02)가 v1 제외라 토큰을 등록하는 경로도 저장처도 없다(정본 [../05_database/13_notification.md](../05_database/13_notification.md)). **계정 정지·탈퇴의 2차 방어는 profiles.status 전파에 의존하므로 처리자와 대상이 다른 경로에도 서버 UPDATE 축이 필요하다**(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)) | 본인 · 시스템 | P0 |

## AUT-04 아이디 중복 확인  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-06 | 아이디 중복 확인 API | 형식 검증을 통과한 username만 조회해 **가용·불가용 boolean만** 반환한다 — 계정 상태·프로필을 노출하지 않는다. 입력 디바운스 약 400밀리초 후 표시하고 호출 빈도를 제한한다 | 미인증 | P0 |
| REQ-AUT-07 | 가입 트랜잭션 재검증 | 사전 중복 확인을 통과했더라도 가입 트랜잭션에서 username UNIQUE를 재확인하고, 경합으로 인한 중복은 **auth.username_taken/409**로 반환한다 | 서버 | P0 |

## AUT-05 프로필 관리  P2

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-26 | 프로필 수정 | 본인이 **이름 · 연락처 · 복구 이메일**을 부분 갱신한다(PATCH /v1/me/profile). 이름은 재인증 없이 반영하고 **연락처 · 복구 이메일이 실리면 비밀번호 재인증을 선행**한다(REQ-AUT-25 · purpose PROFILE_UPDATE) — 복구 이메일은 재설정 링크(REQ-AUT-16)의 수신처라 세션을 탈취한 사람이 바꾸면 계정 탈취가 완성된다. 재인증은 **실린 값으로 판정하고 현재 값과 비교하지 않는다**(비교가 앞서면 현재 값이 재인증 없이 샌다). 재인증에 막히면 함께 실린 이름도 바뀌지 않는다. **연락처는 비울 수 없고 복구 이메일은 빈 문자열로 해제한다.** 연락처 중복은 **auth.phone_taken/409**, 형식 위반 · 빈 본문 · **아이디 · 계정 상태 같은 선언 밖 필드**는 common.validation_failed/400이다(아이디 · 상태는 데이터베이스 가드도 막는다). 바뀐 축만 security_events에 남긴다 — **이름 · 연락처는 PROFILE_CHANGE, 복구 이메일은 RECOVERY_EMAIL_CHANGE**이며 바뀐 값을 담지 않는다. **복구 이메일이 바뀌고 이전 값이 있었으면 커밋 뒤 이전 주소로 변경 알림을 보낸다** — 본문에 새 주소 원문을 싣지 않고(첫 글자와 도메인만) 발송 실패는 변경을 되돌리지 않는다. 같은 값만 보낸 요청은 기록도 알림도 남기지 않는다. 응답은 세션 조회(REQ-AUT-13)와 같은 모양이다. 아바타 이미지는 v1에 두지 않는다 | 본인 | P2 |

## AUT-06 비밀번호 변경  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-14 | 비밀번호 변경 | 현재 비밀번호로 재인증한 뒤 신규 비밀번호를 가입과 동일 정책 + **현재와 상이함**으로 검증해 재해시한다. 동일 비밀번호는 **auth.password_unchanged/422**. 변경 후 현재 세션 유지와 모든 기기 로그아웃 중 하나를 선택할 수 있고, security_events에 사용자·시각·IP·user agent를 기록하되 **원문·해시는 남기지 않는다** | 본인 | P0 |
| REQ-AUT-25 | 민감 작업 재인증 | 아래 작업은 비밀번호 재인증을 선행한다 — 민감정보 원문 복호화(REQ-HRM-04) · 사업장 폐쇄(REQ-WRK-36) · 계정 탈퇴(REQ-AUT-20) · 민감 문서 다운로드(REQ-HRM-24) · **프로필의 연락처 · 복구 이메일 변경**(REQ-AUT-26). 재인증 결과의 유효시간은 **5분**이며 **작업 단위로 소비**한다 — 소비 후에는 남은 시간이 있어도 다음 민감 작업에서 다시 요구한다. 미충족 또는 재인증 토큰 검증 실패(만료·이미 소비·불일치)는 **auth.reauth_required/401** | 본인 | P0 |

## AUT-07 비밀번호 재설정  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-15 | 비밀번호 재설정 요청 | recovery_email이 등록된 계정에는 메일로 재설정 링크를 발송하고, 미등록 계정에는 플랫폼 지원 담당(SUPPORT 이상 — REQ-SYS-07)의 보조 재설정을 안내한다. **미등록 계정에는 토큰을 발급하지 않으며 강제 지점은 서버 함수 issue_password_reset 안이다**(정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #36) — 보조 재설정이 구제 경로인 이상 발송할 수 없는 토큰을 적재하는 것은 **만료를 기다리는 유효 자격 증명을 남기는 것일 뿐이다.** **응답은 계정 존재 여부와 무관하게 동일**하며 발송 빈도를 제한한다(common.rate_limited/429). 메일 발송 실패는 v1에서 재시도하지 않고 실패 로그만 남기며 사용자 응답은 성공과 동일하게 유지한다(열거 방지). **반복 실패는 인앱 알림이 아니라 관측 채널**(에러 추적·로그 경보 — ADR-23)로 운영자에게 통보한다 — 수신자가 사용자가 아니고, 미인증 경로라 알릴 대상 계정을 특정하는 것 자체가 열거 방지 원칙과 충돌한다. **보조 재설정에서 SUPPORT가 하는 일은 복구 이메일 대리 등록이다** — 본인 확인 수단을 선택지로 받아 감사에 남기고 복구 이메일을 대신 등록하며, **등록과 재설정 링크 발송이 한 트랜잭션**이라 등록만 되고 토큰이 없는 창이 열리지 않는다(강제 지점은 서버 함수 issue_assisted_password_reset 안이다 — 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #44). **임시 비밀번호 발급과 재설정 토큰의 대면·유선 전달은 채택하지 않는다** — 평문 자격 증명이 지원 담당을 지나기 때문이며, 대리 등록은 그 뒤가 정상 재설정 흐름이라 **토큰이 본인의 메일함에만 간다.** **이미 복구 이메일이 등록된 계정은 대행 대상이 아니다** — 덮어쓰기를 허용하면 그 표면이 계정 탈취 경로가 되고, 그 계정에는 이미 이 요구사항의 정상 경로가 있다. 표면 계약의 정본은 [../06_api/14_system.md](../06_api/14_system.md) #10이다 | 미인증 · 플랫폼(SUPPORT) | P1 |
| REQ-AUT-16 | 재설정 토큰 검증·적용 | 토큰은 **해시로 저장**하고 만료(1시간)와 사용 여부를 검증한다. 성공 시 REQ-AUT-14 정책으로 새 비밀번호를 적용하고 기존 세션과 refresh token을 전체 폐기한다. **소비는 used_at의 NULL → 값 1회 전이이며 트리거가 되돌리기와 만료 연장을 차단한다**(정본 [../05_database/01_auth.md](../05_database/01_auth.md)). 만료·사용완료·불일치는 **auth.reset_token_invalid/400**이며, 반복 실패는 rate limit과 보안 이벤트 기록 대상이다 — **실패는 kind = PASSWORD_RESET · result = FAILURE로 남긴다** | 미인증 | P1 |

## AUT-08 계정 상태 머신  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-17 | 계정 상태·전이 | users.status는 ACTIVE · SUSPENDED · DELETED이며 suspended_until · suspend_reason · deleted_at을 함께 둔다. 전이는 ACTIVE → SUSPENDED(제재) · SUSPENDED → ACTIVE(만료·해제) · ACTIVE와 SUSPENDED → DELETED(탈퇴·강제삭제)다. **DELETED에서 다른 상태로의 전이는 불가능**하다. **부수 컬럼은 DB CHECK가 강제한다** — DELETED는 deleted_at을, SUSPENDED는 suspended_until과 suspend_reason을 비운 채로 성립하지 않는다(정본 [../05_database/01_auth.md](../05_database/01_auth.md)) | 시스템 | P1 |
| REQ-AUT-18 | 정지 처리·자동 해제 | 플랫폼 관리자가 사유와 해제 예정일을 입력해 SUSPENDED로 전이하고 기존 세션을 즉시 폐기한다. 정지 중에는 모든 권한 헬퍼가 거부를 반환한다. suspended_until이 지난 계정은 로그인·접근 시점에 ACTIVE로 복귀시키고, 정기작업 **autoUnsuspendAccounts**(매일 00:05 KST)가 일괄 점검과 권한 캐시 무효화를 수행한다 | 플랫폼(ADMIN) · 시스템 | P1 |
| REQ-AUT-19 | 전이 감사·필수계정 보호 | 상태 변경은 account_status_events와 audit_logs에 전후 상태·사유·처리자를 기록한다. **마지막 SUPER_ADMIN 보유 계정의 정지·삭제는 차단**한다 — **system.last_super_admin/409** | 시스템 | P1 |

## AUT-09 계정 삭제(탈퇴)  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-20 | 탈퇴 차단 조건 | 탈퇴 전 비밀번호 재인증(REQ-AUT-25)을 요구한다. **소유 사업장 수 > 0**(OWNER로 소유한 ACTIVE·PENDING_VERIFICATION·SUSPENDED 사업장. CLOSED는 제외)이면 **auth.owner_must_transfer/409**로 차단하며 **서비스 판정과 DELETED 전이 가드가 2단으로 강제한다**(정본 [../05_database/01_auth.md](../05_database/01_auth.md) — owned_workplace_count 헬퍼를 호출하는 가드), 그리고 폐쇄 경로(REQ-WRK-36)를 안내한다 — 양도는 v1에 두지 않는다. SUSPENDED 소유 사업장도 정리 대상이다. **탈퇴 시점에 남아 있는 멤버십(STAFF·MANAGER)은 탈퇴와 함께 LEFT로 전이한다** — CLOSED 사업장의 OWNER 멤버십은 폐쇄 트랜잭션(REQ-WRK-36)이 이미 종료 상태로 전이시켰으므로 탈퇴가 다루는 대상에 남지 않는다. 탈퇴 트랜잭션이 CLOSED 사업장의 멤버십을 다시 갱신하면 OWNER 단일성 가드와 폐쇄 읽기전용 가드에 막힌다 | 본인 | P1 |
| REQ-AUT-21 | 탈퇴 처리·법정 보존 | users.status = DELETED · deleted_at = 처리 시각 · 프로필 비식별화 · 세션과 refresh token 전체 폐기 · **남은 멤버십(REQ-AUT-20의 STAFF·MANAGER)의 LEFT 전이**를 단일 트랜잭션으로 수행한다 — **"모든 멤버십"이 아니다**. **법정 보존 대상(급여 · 근태 · 근로계약 · 명세서 · 임금대장)은 삭제하지 않는다.** 보존 데이터의 본인 열람권은 REQ-SLP-09가 정한다 | 본인 · 서버 | P1 |
| REQ-AUT-22 | 탈퇴 후 접근·재사용 | DELETED 계정은 로그인·비밀번호 재설정·초대 수락을 모두 차단한다(auth.account_deleted/403). **동일 username 재사용은 금지이며 users의 전체 UNIQUE(username)가 그것을 강제한다** — 탈퇴가 행 삭제가 아니라 상태 전이라 옛 아이디가 그대로 남는다. **v1에 재사용을 허용하는 정책값을 두지 않는다**(허용하려면 부분 유니크로의 스키마 변경이 필요하다 — phone의 부분 UQ와 비대칭인 것이 의도다). 보존기간 만료 후 파기 절차가 잔여 개인정보를 정리한다 | 시스템 | P1 |

## AUT-10 진입 컨텍스트 분기  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-AUT-23 | 앱별 진입 판정 | 직원 앱은 STAFF 이상 멤버십, 관리자 웹은 OWNER·MANAGER 멤버십, 시스템 웹은 플랫폼 RBAC 보유 여부로 진입을 판정한다. 시스템 웹에 플랫폼 권한 없이 진입하면 **auth.platform_forbidden/403**. **사업장 OWNER라도 플랫폼 권한은 별개**다 | 본인 | P1 |
| REQ-AUT-24 | 멤버십 기반 라우팅 | ACTIVE 멤버십 조회 결과에 따라 ① 0개는 온보딩(사업장 등록 또는 초대 대기) ② 1개는 자동 선택 ③ 2개 이상은 사업장 선택 화면(REQ-WRK-19)으로 분기한다. PENDING 초대만 있으면 초대 수락 화면으로 보낸다. 선택된 사업장의 역할(OWNER·MANAGER·STAFF)로 기능 노출을 분기하며 **동일 사용자가 사업장별로 다른 역할을 가질 수 있다** | 본인 | P1 |

## 관련 테이블

| 테이블 | 역할 |
|--------|------|
| users | 자격증명·계정 상태 — username UNIQUE · password_hash · status · suspended_until · suspend_reason · deleted_at |
| profiles | 프로필 — id = users.id · name · phone(부분 유니크) · recovery_email · avatar_url · last_login_at |
| terms_documents | 약관·개인정보·위치정보 문서 버전 — 가입 동의가 참조하는 활성 버전(REQ-SYS-15) |
| user_consents | 버전별 동의 이력 — append-only(REQ-PRV-02) |
| account_status_events | 계정 상태 전이 이력 — 전후 상태·사유·처리자(REQ-AUT-19) |
| security_events | 보안 이벤트 — 로그인 성공·실패(미존재 아이디 포함) · 비밀번호 변경 · 재설정 · 재인증 · **프로필 변경**. **kind 8값 + result 2값**(REQ-AUT-10·14·16·25·26) |
| password_reset_tokens | 재설정 토큰 — 해시 저장·만료·사용 여부(REQ-AUT-16) |
| workplace_members | 멤버십 기반 라우팅·진입 판정의 조회 대상(REQ-AUT-23·24) |
| system_admins | 플랫폼 권한 보유 판정 대상(REQ-AUT-23) |

## 관련 화면

| 화면 코드 | 화면명 |
|-----------|--------|
| PUB-LANDING | 서비스 소개 랜딩 |
| PUB-PRICING | 요금제 안내 |
| PUB-SIGNUP | 회원가입 |
| PUB-LOGIN | 로그인 |
| PUB-PASSWORD-RESET | 비밀번호 재설정 |
| PUB-CONSENT | 약관·개인정보·위치정보 동의 |
| APP-SETTINGS | 내 정보·설정 |
| ADM-WORKPLACE-SELECT | 사업장 선택·진입 분기 |
| ADM-ACCOUNT | 계정 설정 |
| SYS-USERS | 사용자 관리 |

검산: 10본 — PUB 6 · APP 1 · ADM 2 · SYS 1. 세션 관리(AUT-03)는 전 인증 화면의 셸 게이트로도 발현하며 그 축은 화면 코드가 아니라 (전역)이다.

기능→화면 전수 매핑 정본은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)다.

## 에러 코드

| 에러 코드 | HTTP | 발생 조건 |
|-----------|:--:|----------|
| auth.username_taken | 409 | username 중복(REQ-AUT-04 · REQ-AUT-07) |
| auth.phone_taken | 409 | 휴대폰 중복 — 부분 유니크, DELETED 제외(REQ-AUT-04 · REQ-AUT-26) |
| auth.weak_password | 422 | 비밀번호 정책 미충족(REQ-AUT-04 · REQ-AUT-14) |
| auth.invalid_credentials | 401 | 아이디 미존재·비밀번호 불일치 통일(REQ-AUT-10) |
| auth.password_unchanged | 422 | 새 비밀번호가 현재 비밀번호와 동일(REQ-AUT-14) |
| auth.token_invalid | 401 | access·refresh token 만료·revoke·서명 불일치 — 회전 재발급 실패 포함(REQ-AUT-11) |
| auth.csrf_token_invalid | 403 | 웹 세션 채널 상태변경 요청의 CSRF 토큰 부재·불일치 — 앱 JWT 채널은 대상 아님(REQ-AUT-11) |
| auth.account_suspended | 403 | SUSPENDED 계정의 로그인·접근(REQ-AUT-09) |
| auth.account_deleted | 403 | DELETED 계정의 로그인·접근(REQ-AUT-09 · REQ-AUT-22) |
| auth.consent_required | 422 | 필수 약관·개인정보 동의 또는 개정 재동의 누락 — 위치정보는 별도 선택 동의라 가입 요건이 아니다(D-19)(REQ-AUT-03 · REQ-SYS-16) |
| auth.reset_token_invalid | 400 | 재설정 토큰 만료·사용완료·불일치(REQ-AUT-16) |
| auth.reauth_required | 401 | 민감 작업 5종에서 재인증 미충족 또는 재인증 토큰 검증 실패(만료·이미 소비·불일치)(REQ-AUT-25 · REQ-AUT-26) |
| auth.workplace_forbidden | 403 | 요청 workplace_id와 멤버십·역할 불일치(REQ-WRK-20) |
| auth.platform_forbidden | 403 | 시스템 웹 진입 시 플랫폼 권한 자체가 없음(REQ-AUT-23 · REQ-SYS-03) |
| auth.owner_must_transfer | 409 | OWNER 소유 사업장 존재로 탈퇴 차단(REQ-AUT-20) |

전 도메인 공통 코드(common 7종)는 [01_global_rules.md](./01_global_rules.md), 전수 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)다.

## 관련 문서

- [../02_features/01_auth.md](../02_features/01_auth.md) — AUT 9기능 명세 정본
- [01_global_rules.md](./01_global_rules.md) — 시간 경계·감사·에러 규약
- [03_workplace.md](./03_workplace.md) — 멤버십·초대·컨텍스트 전환(REQ-AUT-24의 후속)
- [13_system.md](./13_system.md) — 플랫폼 RBAC·제재·보조 재설정·약관 문서
- [14_privacy.md](./14_privacy.md) — 가입 동의 이력·위치정보 별도 동의
- [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md) — 웹 세션/앱 JWT·CSRF·재인증 구현 설계
- [../05_database/01_auth.md](../05_database/01_auth.md) — 인증·계정 테이블 명세
- [../06_api/03_auth.md](../06_api/03_auth.md) — 인증 API 표면
- [../10_security/01_authn_authz.md](../10_security/01_authn_authz.md) — 인증·인가 보안 통제
