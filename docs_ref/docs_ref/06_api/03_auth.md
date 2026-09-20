# 06_api / 03 인증·계정 (AUT)

> **대상**: AUT 도메인 REST 표면 — 회원가입 · 아이디 중복 확인 · 로그인 · 세션과 토큰 · 재인증 · 비밀번호 변경과 재설정 · 계정 상태 · 탈퇴 · 진입 컨텍스트 분기 · **프로필 수정(AUT-05)**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **표면 16 → 17**(REST 14 → **15**) — **AUT-05 프로필 관리**(D-23 · v1.1 이월 해제)의 **#17 PATCH /v1/me/profile**을 말미에 채번한다. 연락처 · 복구 이메일이 실리면 재인증(purpose **PROFILE_UPDATE** 신설 — #9 입력 5종)이 필요하고, 복구 이메일이 바뀌면 커밋 뒤 이전 주소로 알린다(새 주소 마스킹). 보안 이벤트 종류 2값(PROFILE_CHANGE · RECOVERY_EMAIL_CHANGE · V0739)을 연동 표에 등재한다. **에러 코드 신설 0** — auth.phone_taken · auth.reauth_required의 발생 표면만 늘어난다. 추적성 **10행**
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — 가입 흐름 펜스의 형식 검증 수단 표기에서 프런트 검증 라이브러리명을 제거한다. **표면·에러 코드·검증 규칙 자체는 불변**
> **개정일**: 2026-08-20 — #8 진입 컨텍스트의 workplaces 요약 열거·JSON 예시에 **selectable**(선행 드리프트)과 **employeeId**(2026-08-20 신설분)를 한 변경 단위로 채움 — 요약 필드 열거의 정본은 [04_workplace.md](./04_workplace.md) #17임을 명시. 표면 수 16 불변
> **개정일**: 2026-08-20 — 동의 출처 값 표기 정정(ENUM-2 · 리드 승인) — #3 ④의 재동의 출처를 RECONSENT → **REAGREE** 한 단어 치환. 값 집합의 정본은 [../05_database/01_auth.md](../05_database/01_auth.md)의 user_consents.source CHECK이며 [15_privacy.md](./15_privacy.md)와 같은 변경 단위로 정렬했다. **표면 수는 16으로 불변**이다
> **개정일**: 2026-08-08 — 웹 프론트엔드 전환(D-20) 반영: 근거 결정 표기를 D-04 → D-20으로 교체 · 탈퇴 트랜잭션의 멤버십 전이 대상을 남은 멤버십으로 한정(폐쇄 사업장 OWNER 멤버십은 폐쇄 트랜잭션 소관)
> **원천**: [../03_requirements/02_auth.md](../03_requirements/02_auth.md)(REQ-AUT-01~25) · [../02_features/01_auth.md](../02_features/01_auth.md)(AUT 10기능 · D-23) · [../03_requirements/13_system.md](../03_requirements/13_system.md)(REQ-SYS-07 보조 재설정) · 확정 결정 D-03 · D-20

AUT는 **사업장 스코프가 없는 유일한 업무 도메인**이다. 계정은 사업장보다 상위 개념이라 경로에 workplaceId가 들어가지 않고, 인가 축도 멤버십이 아니라 본인 여부다. 대신 이 도메인이 발급한 인증 컨텍스트가 나머지 12도메인의 전제가 된다.

**같은 엔드포인트가 두 인증 채널을 함께 받는다.** 로그인 응답이 갈릴 뿐이다 — 웹은 세션 쿠키를 Set-Cookie로 심고 CSRF 토큰을 함께 주며, 앱은 access와 refresh 토큰을 본문으로 돌려준다(REQ-AUT-08). 이후 요청은 채널에 따라 쿠키 또는 Bearer 헤더를 싣고 서버 가드가 어느 쪽인지 판정한다.

**응답이 계정의 존재를 알려 주지 않는다.** 로그인 실패는 아이디 미존재와 비밀번호 불일치를 한 코드로 통일하고, 비밀번호 재설정 요청은 계정 유무와 무관하게 같은 응답을 낸다. 아이디 중복 확인만 예외인데 그것도 가용 여부 불리언 하나만 돌려준다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | **사업장 스코프가 없다.** 경로는 /v1/auth(인증 흐름)와 /v1/me(본인 계정 자원) 둘로 갈린다 |
| 권한 축 | 미인증 공개 6표면과 본인 전용 9표면이다. 역할 판정이 없다 — 사업장 역할은 WRK가, 플랫폼 역할은 SYS가 판정한다 |
| 인증 채널 | 웹은 세션 쿠키 + CSRF 헤더, 앱은 Bearer JWT다. 한 요청이 두 자격 증명을 함께 실으면 거부한다([01_conventions.md](./01_conventions.md)) |
| 재인증 | #9가 발급한 단기 토큰을 X-Reauth-Token 헤더로 싣는다. **이 도메인 안의 소비처는 탈퇴(#13)와 프로필의 연락처 · 복구 이메일 변경(#17)**이고 나머지 소비처는 HR·사업장 도메인에 있다 |
| 멱등 | Idempotency-Key 대상 표면이 **없다.** 중복 차단은 username UNIQUE · phone 부분 유니크 · 재설정 토큰 1회 소비 같은 자연 제약이 진다 |
| 잠금 | 가입 트랜잭션은 username UNIQUE 재확인으로 경합을 흡수하고(REQ-AUT-07), 탈퇴는 소유 사업장 수 재검증을 사용자 행 잠금 안에서 수행한다 |
| 페이지네이션 | 목록 표면이 없다. 소속 사업장 목록과 수신 초대 목록은 [04_workplace.md](./04_workplace.md) 소유다 |
| rate limit | #2 · #3 · #9 · #11에 적용한다. 미인증 표면은 (IP, 입력값) 축이고 인증 표면은 사용자 ID 축이다 |
| 감사 | 비밀번호 변경·재설정·재인증 성공과 실패와 **프로필 변경**(#17 — 이름·연락처와 복구 이메일을 종류로 가른다)은 security_events에, 계정 상태 전이는 account_status_events와 audit_logs에 남는다. **원문·해시를 어디에도 남기지 않는다**(REQ-AUT-02·14) |
| 상태 전이 | 계정 상태 머신(ACTIVE · SUSPENDED · DELETED)의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다. 본 문서는 전이를 일으키는 표면만 적는다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | POST /v1/auth/signup | 미인증 | — | AUT-01 |
| 2 | REST | GET /v1/auth/username-available | 미인증 | — | AUT-04 |
| 3 | REST | POST /v1/auth/login | 미인증 | — | AUT-02 |
| 4 | REST | GET /v1/auth/csrf-token | 미인증 · 본인 | — | AUT-03 |
| 5 | REST | POST /v1/auth/token/refresh | 본인(앱) | — | AUT-03 |
| 6 | REST | POST /v1/auth/logout | 본인 | — | AUT-03 |
| 7 | REST | GET /v1/auth/session | 본인 | — | AUT-03 · AUT-08 |
| 8 | REST | GET /v1/me/entry-context | 본인 | — | AUT-10 |
| 9 | REST | POST /v1/auth/reauth | 본인 | — | AUT-06 |
| 10 | REST | PATCH /v1/me/password | 본인 | — | AUT-06 |
| 11 | REST | POST /v1/auth/password-reset/request | 미인증 | — | AUT-07 |
| 12 | REST | POST /v1/auth/password-reset/confirm | 미인증 | — | AUT-07 |
| 13 | REST | DELETE /v1/me | 본인 · 재인증 | — | AUT-09 |
| 14 | REST | GET /v1/me/deletion-preflight | 본인 | — | AUT-09 |
| 15 | 서버 내부 | 정기작업 autoUnsuspendAccounts(매일 00:05 KST) | 시스템 | — | AUT-08 |
| 16 | 서버 내부 | 세션·refresh 토큰 일괄 폐기 트리거 | 시스템 | — | AUT-03 |

| 17 | REST | PATCH /v1/me/profile | 본인 · 재인증(연락처 · 복구 이메일) | — | AUT-05 |

- 17행 = REST **15** · 서버 내부 **2**다. SSE·다운로드 표면은 없다.
- **#17은 말미 채번이다** — 흐름상 자리는 비밀번호 변경(#10) 옆이지만 번호를 밀지 않는다.
- 미인증 공개는 #1 · #2 · #3 · #4 · #11 · #12 **6표면**이며, 이 여섯과 약관 문서 조회([14_system.md](./14_system.md) — REQ-AUT-12) · 요금제 목록([13_subscription.md](./13_subscription.md) — REQ-SUB-01 · D-02)이 공개 경로 전량이다.

## 상세

### 1. POST /v1/auth/signup — 회원가입 (AUT-01)

```json
{
  "username": "hong1234",
  "password": "Hong!2026",
  "name": "홍길동",
  "phone": "01012345678",
  "recoveryEmail": "hong@example.com",
  "consents": [
    { "kind": "TERMS", "termsDocumentId": "…", "version": "1.0" },
    { "kind": "PRIVACY", "termsDocumentId": "…", "version": "1.0" },
    { "kind": "LOCATION", "termsDocumentId": "…", "version": "1.0" }
  ]
}
```

201 응답은 인증 컨텍스트를 함께 수립한다. 웹은 Set-Cookie로 세션을 심고 csrfToken을 본문에 담으며, 앱은 accessToken·refreshToken을 담는다.

```json
{
  "userId": "…",
  "username": "hong1234",
  "entryContext": { "membershipCount": 0, "pendingInvitationCount": 0, "next": "ONBOARDING" },
  "csrfToken": "…"
}
```

처리 순서는 다음과 같다.

```plain
① 형식 검증               username 4~20자·영소문자와 숫자·첫 글자 영문·예약어 금지
                           password 8자 이상·영문/숫자/특수문자 중 2종 이상
                           name 2~50자 · phone 국내 휴대폰 또는 E.164 · recoveryEmail 선택
② 동의 완결성 검증          필수 2종(TERMS·PRIVACY)의 활성 버전에 모두 동의했는가
                           LOCATION은 선택 동의라 누락이 가입을 막지 않는다(D-19)
                           → 필수 누락  auth.consent_required/422
                           → 활성 문서 자체가 없음  system.terms_not_found/404
③ 비밀번호 정책 판정        미충족  auth.weak_password/422
④ 트랜잭션 시작             username UNIQUE 재확인  → auth.username_taken/409
                           phone 부분 유니크(DELETED 제외) → auth.phone_taken/409
⑤ users INSERT              status=ACTIVE · password_hash(적응형 해시)
⑥ profiles INSERT           id = users.id · name · phone · recovery_email
⑦ user_consents INSERT      버전·시각·IP·user agent (append-only · PRV-02)
⑧ 커밋 → 인증 컨텍스트 발급 · entryContext 산출(#8과 같은 판정)
```

- consents 배열의 **LOCATION 항목은 선택**이다 — 동의한 경우에만 담고, 없으면 그대로 가입이 성립한다(**위치정보 동의는 가입 요건이 아니다** — D-19 · REQ-AUT-03). 미동의 상태의 GPS 체크인은 privacy.location_consent_required/403으로 막힌다.
- **원문·해시를 응답·로그·감사 전후값 어디에도 싣지 않는다**(REQ-AUT-02). ④~⑦ 중 하나라도 실패하면 전체 롤백이며 부분 생성된 프로필이 남지 않는다.
- ②를 ③보다 먼저 두는 이유는 동의가 가입의 **성립 조건**이라서다. 비밀번호를 고쳐 다시 보내게 한 뒤 동의 누락으로 또 막으면 왕복이 두 번이 된다.
- 사전 중복 확인(#2)을 통과했어도 ④에서 다시 확인한다 — 확인과 가입 사이의 경합은 UNIQUE 위반으로만 잡힌다(REQ-AUT-07).

### 2. GET /v1/auth/username-available — 아이디 중복 확인 (AUT-04)

| 항목 | 내용 |
|------|------|
| 쿼리 | username(필수). 형식 검증을 통과한 값만 조회한다 — 형식 위반은 common.invalid_format/400으로 끊고 DB를 보지 않는다 |
| 응답 | available 불리언 **하나뿐**이다. 계정 상태·프로필·가입 시각을 노출하지 않는다 |
| 판정 범위 | status가 DELETED인 계정의 username도 사용 불가로 본다 — 재사용 기본 금지가 정책값이다(REQ-AUT-22) |
| 클라이언트 | 입력 디바운스 약 400밀리초 후 표시한다. 호출 빈도 초과는 common.rate_limited/429 |
| 계약 한계 | **이 응답은 예약이 아니다.** 가용으로 나와도 가입 트랜잭션(#1 ④)이 최종 판정한다 |

### 3. POST /v1/auth/login — 로그인 (AUT-02)

```json
{ "username": "hong1234", "password": "Hong!2026", "channel": "APP" }
```

channel은 WEB 또는 APP이다. 응답 형태가 이 값으로 갈린다.

```json
{
  "userId": "…",
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 900,
  "entryContext": { "membershipCount": 2, "pendingInvitationCount": 0, "next": "WORKPLACE_SELECT" }
}
```

선검증 순서는 다음과 같으며 **순서 자체가 계약**이다.

```plain
① rate limit 판정          (IP, username) 실패 누적 초과 → common.rate_limited/429 + Retry-After
② 자격 증명 해시 검증       실패 → auth.invalid_credentials/401
                           아이디 미존재와 비밀번호 불일치를 구분하지 않는다(열거 방지)
③ 계정 상태 조회            DELETED   → auth.account_deleted/403
                           SUSPENDED → auth.account_suspended/403 + 사유·해제 예정일
                           단, suspended_until이 지났으면 ACTIVE로 복귀시킨 뒤 통과시킨다
④ 재동의 필요 판정          요청에 consents 배열(선택)이 동봉됐으면 ② 통과 사용자로 먼저 기록한 뒤 판정한다
                           — source=REAGREE · 검증 계약은 15_privacy #4와 동일(활성 버전·kind)
                           필수 2종(TERMS·PRIVACY)의 활성 버전에 미동의 → auth.consent_required/422
                           + 대상 kind 목록. LOCATION 개정은 로그인을 막지 않는다(D-19)
⑤ 컨텍스트 발급             WEB=세션 쿠키+CSRF 토큰 · APP=access+refresh
⑥ profiles.last_login_at 갱신 · entryContext 산출
```

- ②가 ①보다 뒤인 것은 rate limit이 자격 증명 검증 비용 자체를 막기 위해서다. ③이 ②보다 뒤인 것은 정지 여부가 인증 전에 새면 그 자체로 계정 존재를 알려 주기 때문이다.
- ③에서 컨텍스트를 발급하지 않고 즉시 거부한다 — 정지 계정에 세션이 잠깐이라도 생기면 그 세션으로 다른 요청이 통과한다.
- ④는 컨텍스트 발급 **전**이다. 재동의 화면은 미인증 상태에서 진입하며 **동의 제출은 로그인 재수행에 consents 배열로 동봉**한다(REQ-SYS-16) — 컨텍스트가 없는 상태라 본인 전용 표면([15_privacy.md](./15_privacy.md) #4)을 호출할 수 없고, 자격 증명 검증(②)을 통과한 사용자로 특정해 기록하므로 미인증 기록이 아니다.

### 4·5·6·7. 세션·토큰 표면 4종 (AUT-03 · AUT-08)

| 항목 | 4. GET /v1/auth/csrf-token | 5. POST /v1/auth/token/refresh | 6. POST /v1/auth/logout | 7. GET /v1/auth/session |
|------|---------------------------|-------------------------------|------------------------|------------------------|
| 채널 | 웹 전용 | 앱 전용 | 양쪽 | 양쪽 |
| 입력 | 없음 | refreshToken | 없음(앱은 refreshToken 동봉) | 없음 |
| 처리 | 세션에 묶인 CSRF 토큰을 발급·회전한다 | refresh 서명·만료·블랙리스트를 검증하고 **access와 refresh를 함께 회전 재발급**한다 | 세션 파기 · refresh 블랙리스트 등록 · 기기 푸시 토큰 정리 | 계정 상태 · 본인 프로필 요약 · 컨텍스트 만료 시각을 반환한다 |
| 응답 | csrfToken | accessToken · refreshToken · expiresIn | 204 | userId · username · name · accountStatus · suspendedUntil · reconsentRequired |
| 실패 | — | auth.token_invalid/401 | — | auth.token_invalid/401 · auth.account_suspended/403 |

- **refresh는 회전한다.** 직전 refresh는 재발급 즉시 블랙리스트에 오르며 재사용 시도는 auth.token_invalid/401이다. 회전하지 않으면 탈취된 refresh가 만료까지 계속 유효하다.
- #6은 **호출자 컨텍스트만** 폐기한다. 전 기기 로그아웃은 #10의 옵션과 #16이 담당한다.
- #7은 인증 컨텍스트가 살아 있는 동안에도 **계정 상태를 다시 조회**한다. 정지·삭제가 컨텍스트 발급 이후에 일어나면 이 표면이 먼저 알아챈다(REQ-AUT-13).
- #4는 미인증 상태에서도 호출한다 — 로그인 요청 자체가 상태 변경이라 CSRF 토큰이 선행한다.

### 8. GET /v1/me/entry-context — 진입 컨텍스트 분기 (AUT-10)

```json
{
  "membershipCount": 2,
  "pendingInvitationCount": 0,
  "platformRole": null,
  "next": "WORKPLACE_SELECT",
  "workplaces": [
    { "workplaceId": "…", "companyName": "…", "siteLabel": "본점", "role": "OWNER", "status": "ACTIVE", "selectable": true, "employeeId": "…", "lastSelectedAt": "2026-08-02T09:11:00Z" }
  ]
}
```

next 판정은 다음 순서다. **앱·관리자 웹·시스템 웹의 판정 축이 각각 다르므로** 요청의 surface 쿼리(APP · ADMIN · SYSTEM)를 함께 받아 그 표면 기준으로 답한다.

```plain
① surface=SYSTEM  플랫폼 RBAC 보유 여부만 본다
                  없으면 auth.platform_forbidden/403 — 사업장 OWNER라도 통과하지 않는다
② surface=ADMIN   OWNER·MANAGER 멤버십을 센다
③ surface=APP     STAFF 이상 멤버십을 센다
④ ②·③ 결과로 분기  0개 + PENDING 초대 있음 → INVITATION_PENDING
                   0개 + 초대 없음          → ONBOARDING
                   1개                      → WORKPLACE_READY (자동 선택 · workplaces[0])
                   2개 이상                 → WORKPLACE_SELECT
```

- workplaces 배열은 요약(사업장명 · 지점명 · 역할 · 상태 · **selectable 불리언** · **employeeId**(nullable) · 마지막 선택 시각)까지이며 **업무 데이터를 담지 않는다** — 이 표면 하나가 여러 사업장을 가로지르는 유일한 예외라서 담을 수 있는 것을 좁힌다([01_conventions.md](./01_conventions.md)). **요약 필드 열거의 정본은 [04_workplace.md](./04_workplace.md) #17**이며 본 표면은 같은 요약을 싣는다 — selectable · employeeId의 의미와 제약도 그 정본을 따른다.
- 진입 권한이 없는 사업장(그 표면 기준 역할 부족 · SUSPENDED · CLOSED)도 목록에는 넣고 선택 불가 표시를 준다. 빼 버리면 사용자가 자기 사업장이 사라진 것으로 읽는다.
- 실제 컨텍스트 전환은 [04_workplace.md](./04_workplace.md)의 활성 사업장 설정 표면이 수행한다. 이 표면은 **판정만** 한다.

### 9·10. POST /v1/auth/reauth · PATCH /v1/me/password — 재인증·비밀번호 변경 (AUT-06)

| 항목 | 9. 재인증 토큰 발급 | 10. 비밀번호 변경 |
|------|--------------------|------------------|
| 입력 | password · purpose(PII_DECRYPT · DOCUMENT_DOWNLOAD · WORKPLACE_CLOSE · ACCOUNT_DELETE · **PROFILE_UPDATE**) | currentPassword · newPassword · signOutOtherSessions 불리언 |
| 검증 | 현재 비밀번호 해시 검증. 실패는 auth.invalid_credentials/401 · 빈도 초과는 common.rate_limited/429 | 현재 비밀번호 재검증 → 신규 정책 검증 → **현재와 상이 검증** |
| 산출 | reauthToken · expiresIn(5분) · purpose 고정 | 재해시 저장 |
| 실패 | auth.reauth_required/401(만료·재사용 시 소비처에서) | auth.weak_password/422 · **auth.password_unchanged/422** |
| 부수효과 | Redis 저장(데이터베이스에 남기지 않는다) · security_events 기록 | signOutOtherSessions가 참이면 #16 트리거 · security_events 기록 |

- **재인증 토큰은 purpose에 묶인다.** 문서 다운로드용으로 받은 토큰으로 탈퇴를 수행할 수 없다 — 하나의 재인증이 여러 민감 작업을 여는 것을 막는다.
- #10은 현재 컨텍스트를 유지할지 전 기기를 끊을지 사용자가 고른다. 어느 쪽이든 **비밀번호 원문과 해시를 security_events에 남기지 않는다**(REQ-AUT-14).

### 11·12. 비밀번호 재설정 요청·확정 (AUT-07)

| 항목 | 11. POST /v1/auth/password-reset/request | 12. POST /v1/auth/password-reset/confirm |
|------|------------------------------------------|------------------------------------------|
| 입력 | username 또는 recoveryEmail | token · newPassword |
| 처리 | 복구 이메일이 등록된 계정에만 재설정 링크를 발송한다. 토큰은 **해시로 저장**하고 만료는 1시간이다 | 토큰 해시 대조 → 만료·사용 여부 검증 → REQ-AUT-14 정책으로 새 비밀번호 적용 |
| 응답 | **계정 존재 여부와 무관하게 동일한 202**다. 미등록 계정에는 플랫폼 지원 담당 보조 재설정 경로를 안내하는 문안을 함께 준다 | 204 |
| 실패 | common.rate_limited/429(발송 빈도 초과) | **auth.reset_token_invalid/400**(만료·사용완료·불일치) · auth.weak_password/422 |
| 부수효과 | 메일 발송 실패는 v1에서 재시도하지 않고 실패 로그만 남긴다. **사용자 응답은 성공과 동일**하게 유지한다(열거 방지) | 기존 세션과 refresh 토큰 **전체 폐기**(#16) · 토큰 사용 완료 표시 · security_events 기록 |

- #11의 응답을 성공으로 고정하는 것은 열거 방지의 핵심이다. 미등록 계정에 "복구 이메일이 없습니다"를 주면 그 아이디가 존재한다는 사실이 새고, 반복 실패 자체가 rate limit과 보안 이벤트 기록 대상이 된다.
- 보조 재설정(플랫폼 SUPPORT 이상)은 [14_system.md](./14_system.md) 소유 표면이며 여기서는 안내 문안만 담당한다.

### 13·14. DELETE /v1/me · GET /v1/me/deletion-preflight — 탈퇴 (AUT-09)

| 항목 | 14. 선행조건 점검 | 13. 탈퇴 실행 |
|------|------------------|--------------|
| 헤더 | — | **X-Reauth-Token 필수**(purpose=ACCOUNT_DELETE) |
| 응답·차단 | blockers 배열을 돌려준다 — 소유 사업장 목록(ACTIVE · PENDING_VERIFICATION · SUSPENDED)과 각 사업장의 폐쇄 경로 링크 | 소유 사업장 수 > 0이면 **auth.owner_must_transfer/409** + 대상 사업장 목록 |
| 처리 | 읽기 전용. 차단이 없으면 빈 배열이다 | 단일 트랜잭션 — users.status=DELETED · deleted_at · 프로필 비식별화 · 세션과 refresh 전체 폐기 · **남은 멤버십(STAFF · MANAGER) LEFT 전이** |
| 실패 | — | auth.reauth_required/401 · auth.owner_must_transfer/409 · system.last_super_admin/409 |

- **CLOSED 사업장은 소유 수에 세지 않는다.** 폐쇄가 v1의 유일한 이탈 경로이므로(양도는 v1에 없다) CLOSED까지 세면 탈퇴가 영구히 막힌다(REQ-AUT-20).
- **CLOSED 사업장의 OWNER 멤버십은 탈퇴가 건드리지 않는다.** 그 멤버십은 폐쇄 트랜잭션([04_workplace.md](./04_workplace.md) #26 · REQ-WRK-36)이 이미 종료 상태로 전이시켰기 때문이며, 탈퇴가 다시 전이시키면 OWNER 단일성 가드와 폐쇄 읽기전용 가드가 트랜잭션을 통째로 막는다.
- **법정 보존 대상은 삭제하지 않는다** — 급여 · 근태 · 근로계약 · 명세서 · 임금대장은 그대로 남고, 본인 열람권은 본인 소유권 인가로 계속 성립한다([09_payslip.md](./09_payslip.md)).
- 소유 사업장 수 재검증은 **사용자 행 잠금 안에서** 수행한다. 탈퇴 요청과 사업장 등록 요청이 겹치면 잠금 없이는 둘 다 통과한다(REQ-GLB-15).
- 마지막 SUPER_ADMIN 보유 계정의 탈퇴는 차단한다 — 코드는 system.last_super_admin/409이며 정의처는 [14_system.md](./14_system.md)다.

### 15·16. 서버 내부 종점 2종 (AUT-08 · AUT-03)

| 항목 | 15. autoUnsuspendAccounts (배치) | 16. 세션·refresh 일괄 폐기 트리거 (서버) |
|------|----------------------------------|------------------------------------------|
| 실행 | 정기작업 · 매일 00:05 KST · 분산락 · 멱등 | 도메인 이벤트의 동기 부수효과 |
| 동작 | suspended_until이 지난 SUSPENDED 계정을 ACTIVE로 복귀시키고 권한 캐시를 무효화한다 | 대상 사용자의 웹 세션을 파기하고 refresh 토큰을 블랙리스트에 등록한다 |
| 발화 지점 | 스케줄러 | 계정 정지(SYS-04) · 비밀번호 변경 시 전 기기 로그아웃 선택(#10) · 재설정 확정(#12) · 탈퇴(#13) |
| 표면 없음 근거 | 사용자가 요청할 수 있는 일이 아니다. 접근 시점 복귀는 #3 ③이 이미 처리하며 이 작업은 **로그인하지 않는 계정의 상태 정확성**을 위한 이중 경로다 | 요청 주체가 대상자 본인이 아닌 경우(정지)가 있어 사용자 표면으로 열 수 없다 |
| 보호 | 상태가 SUSPENDED인 행만 대상으로 하므로 DELETED를 되살리지 않는다. **마지막 SUPER_ADMIN 보호는 정지 시점에 이미 적용**되어 여기서 다시 판정하지 않는다 | 폐기 실패가 원 트랜잭션을 롤백하지 않는다 — 다음 요청의 상태 재조회(#7 · #3 ③)가 2차 방어다 |

### 17. PATCH /v1/me/profile — 프로필 수정 (AUT-05)

```plain
① 본문 성립      name · phone · recoveryEmail 중 하나 이상 — 셋 다 생략이면 common.validation_failed/400
② 재인증         phone · recoveryEmail이 실렸으면 X-Reauth-Token(purpose=PROFILE_UPDATE) 1회 소비
                 부재 · 만료 · 소비됨 · 용도 불일치 → auth.reauth_required/401 — 아무것도 바뀌지 않는다
③ 현재 값 잠금   같은 계정의 수정이 겹쳐도 "이전 복구 이메일"이 하나로 정해진다
④ 쓰기           phone 부분 유니크 위반 → auth.phone_taken/409
⑤ 보안 이벤트    바뀐 축만 — PROFILE_CHANGE(이름 · 연락처) · RECOVERY_EMAIL_CHANGE(복구 이메일)
⑥ 커밋 뒤        복구 이메일이 바뀌었고 이전 값이 있으면 이전 주소로 알림(새 주소 마스킹)
⑦ 200            세션 조회(#7)와 같은 모양
```

| 항목 | 17. 프로필 수정 |
|------|----------------|
| 입력 | name(2~50자 · 앞뒤 공백 불가) · phone(국내 010 계열 또는 E.164 · **비울 수 없다**) · recoveryEmail(**빈 문자열은 해제**) — 전부 선택이며 **실린 필드만 바꾼다** |
| 헤더 | phone · recoveryEmail이 실리면 **X-Reauth-Token 필수**(purpose=PROFILE_UPDATE). 이름만 바꾸면 요구하지 않는다 |
| 응답 | 200 · 세션 조회(#7)와 같은 모양 — 연락처는 마스킹이다 |
| 실패 | common.validation_failed/400(형식 · 빈 본문 · **선언 밖 필드**) · auth.reauth_required/401 · auth.phone_taken/409 |
| 부수효과 | profiles UPDATE · security_events(바뀐 축만) · 이전 복구 이메일로 알림 메일(커밋 뒤) |

- **재인증 문턱을 연락 축에만 둔다.** 복구 이메일은 비밀번호 재설정 링크(#11)의 수신처라 세션을 탈취한 사람이 바꾸면 재설정으로 계정 탈취가 완성되고, 연락처는 플랫폼 지원 담당의 본인 확인 축이다. 이름은 그 경로가 아니다 — 요구하면 오탈자 하나에 비밀번호를 다시 받는다.
- **재인증은 실린 값으로 판정하고 현재 값과 비교하지 않는다** — 비교가 재인증보다 앞서면 "그 번호가 지금 내 번호인가"가 재인증 없이 응답 차이로 샌다. 같은 값을 보내도 토큰을 소비한다.
- **이름과 연락처를 함께 실은 요청이 재인증에 막히면 이름도 바뀌지 않는다** — 부분 성공을 두지 않는다.
- **아이디 · 계정 상태는 받지 않는다.** 선언 밖 필드는 역직렬화가 400으로 거부하고 데이터베이스 가드(profiles_guard)도 두 열을 막는다. 아이디는 로그인 식별자이고 상태는 제재 축이다.
- **바뀐 것이 없으면 보안 이벤트도 알림도 남기지 않는다** — 같은 값을 다시 보낸 요청이 이벤트를 쌓으면 침해 조사에서 사건이 아닌 행이 사건처럼 읽힌다.
- **보안 이벤트 종류를 둘로 가른다.** 복구 이메일 변경은 재설정 수신처가 바뀌는 사건이라 침해 조사에서 따로 골라낼 수 있어야 한다. 값 집합의 정본은 [../05_database/01_auth.md](../05_database/01_auth.md)다(V0739).
- **알림은 이전 주소로만 보내고 커밋 뒤에 보낸다.** 탈취자가 바꾼 뒤에는 새 주소로 오는 어떤 메일도 원래 주인에게 닿지 않는다 — 알릴 곳은 이전 주소뿐이다. **본문에 새 주소 원문을 싣지 않는다**(첫 글자와 도메인만 — a***@example.com · 해제면 등록 해제로 적는다). 이전 주소가 이미 남의 손에 있을 수 있다. **첫 등록은 알리지 않는다** — 이전 주소가 없다. 발송 실패는 변경을 되돌리지 않고 응답도 바꾸지 않는다.
- **연락처를 비울 수 없다** — 가입이 요구하는 값이고 부분 유니크의 축이다. 복구 이메일만 해제할 수 있다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다. 아래는 이 문서의 표면이 낼 수 있는 코드다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| auth.username_taken | 409 | username 중복 — 가입 트랜잭션 재확인 포함 | #1 |
| auth.phone_taken | 409 | 휴대폰 중복(부분 유니크 · DELETED 제외) | #1 · **#17** |
| auth.weak_password | 422 | 비밀번호 정책 미충족. **필드별 메시지를 반환**한다 | #1 · #10 · #12 |
| auth.password_unchanged | 422 | 새 비밀번호가 현재와 동일 | #10 |
| auth.invalid_credentials | 401 | 아이디 미존재·비밀번호 불일치 통일 | #3 · #9 · #10 |
| auth.consent_required | 422 | 필수 약관·개인정보 동의 또는 개정 재동의 누락 — **위치정보는 별도 선택 동의라 가입 요건이 아니다**(D-19) | #1 · #3 |
| auth.token_invalid | 401 | access·refresh token 만료·revoke·서명 불일치. **회전 재발급 실패도 이 코드**이며 인증 컨텍스트를 폐기한다 — 화면은 작성 중 입력을 보존한 채 재로그인을 유도하고(01_standards §1-4), 단순 탐색 중이면 로그인 화면으로 보낸다 | #5 · #7 · 전 인증 표면 |
| auth.csrf_token_invalid | 403 | 웹 채널 상태변경 요청의 CSRF 토큰 부재·불일치 | #1 · #3 · #6 · #9 · #10 · #13 · **#17** |
| auth.account_suspended | 403 | SUSPENDED 계정의 로그인·접근. **정지 사유·해제 예정일을 함께 반환**한다 | #3 · #7 |
| auth.account_deleted | 403 | DELETED 계정의 로그인·재설정·**초대 수락** | #3 · #7 · #11 · #12 |
| auth.reset_token_invalid | 400 | 재설정 토큰 만료·사용완료·불일치 | #12 |
| auth.reauth_required | 401 | 민감 작업의 재인증 미충족 **또는 재인증 토큰 검증 실패**(만료 · 이미 소비 · 불일치). 재인증 결과는 단기 유효이며 작업 단위로 소비한다 | #13 · **#17** |
| auth.owner_must_transfer | 409 | OWNER로 소유한 사업장이 남아 있어 탈퇴 차단. v1은 양도가 없어 폐쇄 경로를 안내한다 | #13 |
| auth.platform_forbidden | 403 | surface=SYSTEM 판정에서 플랫폼 권한 자체가 없음. **사업장 OWNER라도 플랫폼 권한은 별개**다 | #8 |
| system.last_super_admin | 409 | 마지막 SUPER_ADMIN 보유 계정의 탈퇴 차단 | #13 |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 부재 | #1 |
| privacy.consent_version_conflict | 409 | 동일 (user_id, kind, version) 동의 중복 기록 — 멱등 처리 | #1 |
| common.invalid_format | 400 | 필드 형식 오류 — username·phone·이메일·UUID | #1 · #2 · #11 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 | 전 REST 표면 |
| common.rate_limited | 429 | 로그인 실패 누적 · 중복 확인·재설정·재인증 빈도 초과 | #2 · #3 · #9 · #11 |

- **auth.workplace_forbidden/403은 이 문서에 없다.** 사업장 스코프 표면이 없기 때문이며 정의처는 [../03_requirements/02_auth.md](../03_requirements/02_auth.md), 발생 표면은 [04_workplace.md](./04_workplace.md) 이후 도메인이다.
- #8의 판정 실패는 auth.platform_forbidden/403 하나뿐이다. 역할 레벨 부족(system.permission_denied/403)은 시스템 운영 표면에서 나며 정의처는 [14_system.md](./14_system.md)다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| users | #1 INSERT · #3 · #7 SELECT · #10 · #12 UPDATE · #13 · #15 UPDATE | 자격증명·계정 상태의 정본. username UNIQUE가 중복 판정의 최종 강제다 |
| profiles | #1 INSERT · #3 · #7 SELECT · #13 UPDATE · **#17 SELECT(잠금)·UPDATE** | 이름·연락처·복구 이메일·마지막 로그인. phone 부분 유니크(DELETED 제외) |
| terms_documents | #1 SELECT | 동의 대상 활성 버전 조회. kind별 활성 1개 보장이 전제다 |
| user_consents | #1 INSERT | 버전별 동의 이력 append-only. 쓰기 계약의 정본은 [15_privacy.md](./15_privacy.md)다 |
| password_reset_tokens | #11 INSERT · #12 SELECT·UPDATE | 해시 저장 · 만료 1시간 · 1회 소비 |
| security_events | #9 · #10 · #12 · **#17** INSERT | 비밀번호 변경·재설정·재인증의 성공과 실패 · **프로필 변경**(PROFILE_CHANGE · RECOVERY_EMAIL_CHANGE). **원문·해시를 담지 않는다** — 프로필 변경도 바뀐 값을 담지 않고 종류만 남긴다 |
| account_status_events | #13 · #15 INSERT | 계정 상태 전이의 전후 상태·사유·처리자 |
| audit_logs | #13 INSERT | 탈퇴 처리의 감사 기록. before/after에 PII 원문을 담지 않는다 |
| workplace_members | #8 · #13 SELECT · #13 UPDATE | 진입 판정의 입력이자 탈퇴 시 LEFT 전이 대상 |
| workplaces | #8 · #13 · #14 SELECT | 소속 사업장 요약과 소유 사업장 수 산출 대상. CLOSED는 소유 수에서 제외한다 |
| workplace_invitations | #8 · #14 SELECT | PENDING 초대 수 산출. 쓰기 계약의 정본은 [04_workplace.md](./04_workplace.md)다 |
| system_admins | #8 SELECT | surface=SYSTEM 판정의 플랫폼 권한 보유 여부 |

## 추적성

기능명·우선순위의 정본은 [../02_features/01_auth.md](../02_features/01_auth.md)다. 아래는 기능ID와 표면의 대응만 적는다.

| 기능ID | 표면 |
|--------|------|
| AUT-01 회원가입 | #1 |
| AUT-02 로그인 | #3 |
| AUT-03 세션 관리 | #4 · #5 · #6 · #7 · #16(서버) |
| AUT-04 아이디 중복 확인 | #2 |
| **AUT-05 프로필 관리** | **#17** |
| AUT-06 비밀번호 변경 | #9 · #10 |
| AUT-07 비밀번호 재설정 | #11 · #12 |
| AUT-08 계정 상태 머신 | #7 · #15(배치) |
| AUT-09 계정 삭제(탈퇴) | #13 · #14 |
| AUT-10 진입 컨텍스트 분기 | #8 |

**AUT 10기능 전수를 담았다**(위 표 10행). 표면 없는 기능은 없으며, AUT-03과 AUT-08만 서버 내부 종점을 함께 갖는다.

## 관련 문서

- 전역 규약·인증 채널·재인증·상태코드 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/01_auth.md](../02_features/01_auth.md) · 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 요구사항 정본 → [../03_requirements/02_auth.md](../03_requirements/02_auth.md) · 전역 규칙 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 사업장 컨텍스트 전환·초대 → [04_workplace.md](./04_workplace.md) · 동의 이력 → [15_privacy.md](./15_privacy.md) · 플랫폼 제재·약관 → [14_system.md](./14_system.md)
- 인증·세션 구현 설계 → [../04_architecture/02_authn_session.md](../04_architecture/02_authn_session.md)
- 테이블 명세 → [../05_database/01_auth.md](../05_database/01_auth.md)
- 계정 상태 머신 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) · 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
- 인증·인가 보안 통제 → [../10_security/01_authn_authz.md](../10_security/01_authn_authz.md)
