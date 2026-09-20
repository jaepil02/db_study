# 에러 코드 사전 (02_error_codes)

> **대상**: insadesk 전 API·서버 경로가 반환하는 도메인 에러 코드 전수 — 채번 정본
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — auth.reauth_required의 발생 조건에 **프로필의 연락처·복구 이메일 변경**을 더한다(AUT-05 · 코드 신설 아님). 예약 코드 **export.forbidden/403에 발생 지점이 생긴다** — 목록 공통 내보내기(DSH-06 · [../06_api/04_workplace.md](../06_api/04_workplace.md) #35 · [../06_api/14_system.md](../06_api/14_system.md) #36)가 **등재된 목록을 그 목록의 표면이 아닌 자리에서 요청**하는 경우다(사업장 표면으로 시스템 목록을 꺼내는 요청 — 형식 오류가 아니라 권한 범위 위반). export.expired · export.failed도 그 표면에서 발생한다. **신설 · 개명 · 폐기가 아니므로 120종 · 16네임스페이스는 움직이지 않는다.** 예약 사유 문단의 예시에서 내보내기를 걷는다
> **개정일**: 2026-09-10 — **workplace.mgmt_no_required/422 채번**(119 → **120종** · workplace 21 → **22** · 422 23 → **24**). 신고자료 생성이 보험 계열별 사업장관리번호를 요구하는데 **부재 시 낼 코드가 없어 구현이 404를 내고 있었다** — 404는 존재 은닉 축이고 이것은 「전제를 채우면 된다」라 **422**다. **네임스페이스는 16 불변** — 발생 표면은 TAX 이지만 **부재한 값이 사업장의 것**이라 workplace 가 갖는다(workplace.verification_pending 이 급여·명세서 표면에서 나는 것과 같은 축). 함께 **배정 규칙의 TAX 문장에서 닫는 열거를 걷는다** — "실패 원인이 **전부 payroll·common으로** 표현되고"가 **이 채번 하나로 틀리는 형태**였고, 읽는 상위 도메인이 늘 때마다 같은 일이 반복된다. workplace 범위 서술에 **설정값** 축을 더했다
> **개정일**: 2026-09-09 — 세는 기준 문단의 **예약 코드 목록을 판정 기준으로 바꾼다** — "발생 지점이 v1에 없으나 예약한 코드"를 셋으로 닫아 두고 있었는데 **export.forbidden과 subscription.upgrade_required가 그 밖에서 미발생으로 등재**돼 문장이 이미 틀려 있었다. **세는 자리는 표의 행 하나**로 두고 문단은 기준만 갖는다. 두 코드의 행에 **v1 발생 지점 없음과 그 이유**를 등재했다 — 전자는 **범위를 좁히는 축이 없어서**이고 후자는 **좁은 두 코드가 같은 사유를 이미 갖기 때문**이다. **에러 코드 119종 · 16네임스페이스는 전건 불변**이다 — 예약 코드는 계약에 살아 있어 전수에 든다
> **개정일**: 2026-09-07 — notification.mandatory_pref 설명의 필수 알림 4 → **5종** 인용 갱신(V0717 — contract_sent 채번. 정본 [../05_database/13_notification.md](../05_database/13_notification.md)). **에러 코드 119종 · 16네임스페이스 · 채번은 전건 불변**이며 설명 문구만 바뀐다
> **개정일**: 2026-08-21 — 신설 반영 **잔여 집계 정합**(직전 개정이 헤더·종수 산정 절만 고치고 본문 집계를 남겨 두어 문서 안에서 118과 119가 함께 읽혔다) — 절 제목 workplace 20 → **21종** · 도메인별 집계표 workplace 20 → **21** · HTTP 상태별 집계표 409 51 → **52** 및 검산 118 → **119** · 유효 전수 행·검산식 담당 94 → **95** · 폐기 코드 절 전수 118 → **119종** · 422 서술 22 → **23**(2026-08-08 attendance.assignment_forbidden 신설 때 남은 드리프트) — 미러 [../06_api/02_errors.md](../06_api/02_errors.md) 동반 대조
> **개정일**: 2026-08-21 — **workplace.business_unit_overlap/409 신설**(118 → **119종** · workplace 20 → **21** · 409 51 → **52**) — business_units 소유자·명칭 유효기간 EXCLUDE 겹침의 제약별 코드 부재를 구현 검증에서 실측 발견(23P01 무폴백 원칙 — [../06_api/02_errors.md](../06_api/02_errors.md) 제약 매핑표 동반 갱신)
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — **attendance.assignment_forbidden/422 신설**(117 → **118종** · attendance 7 → **8** · 422 22 → **23**) · 발생 표면 보강 6건(정책·가드 2차 방어 축 병기)
> **개정일**: 2026-08-08 — 발생조건 정밀화(양도 미구현 캐치 2종 · 원본 급여 중복확정 키 3열 · 근로조건·보험정보 부재 흡수 · 역할 변경 DB 가드 2차 방어). 코드 수 변동 없음 — **118종 유지**
> **원천**: docs_ref2/requirements_p0.md 에러코드 카탈로그 절(담당 도메인 94종 · 타 도메인 참조 9종 · 폐기 2종)과 ATT·LEV·PAY 도메인 REQ 본문의 코드 정의 · [../03_requirements](../03_requirements/README.md) 도메인 파일 에러 코드 절 전수 대조

에러는 **{domain}.{snake_case} 코드 + HTTP 상태**로 반환한다. 응답 본문은 code와 message 단일 규격이며 내부 식별자·원문 오류를 싣지 않는다(REQ-GLB-19). 클라이언트 검증은 UX 보조이며 **서버 검증이 최종 판단**이다.

본 문서는 insadesk 전 문서군에 등장하는 에러 코드의 **유일 채번 정본**이며, 새 코드는 여기서만 만든다. [../06_api/02_errors.md](../06_api/02_errors.md)는 미러이고 [../03_requirements](../03_requirements/README.md) 도메인 파일의 에러 절은 그 도메인이 정의·발생시키는 부분집합의 도메인 관점 뷰다. 세 곳이 어긋나면 본 문서가 우선한다.

## 정본 선언

| 축 | 정본 | 성격 |
|----|------|------|
| 코드 채번·형식·HTTP 상태 배정 | 본 문서 | 유일 등재처. 신설·개명·폐기는 여기서만 한다 |
| 도메인별 발생 조건·REQ 연결 | [../03_requirements](../03_requirements/README.md) 도메인 파일 | 정의처 표기는 도메인 파일이 갖되 코드 집합은 본 문서를 넘지 않는다 |
| API 응답 규격·엔드포인트별 노출 | [../06_api/02_errors.md](../06_api/02_errors.md) | 미러. 미러에서 코드를 신설·개명·폐기하지 않는다 |
| 상태 전이 위반이 어떤 코드를 내는가 | [03_enums_state_machines.md](./03_enums_state_machines.md) | 전이 가드 표가 본 문서의 코드를 참조한다 |

## 종수 산정 기준

**전수는 120종 · 16네임스페이스**다. 원천 문서의 "에러코드 카탈로그" 절 하나만 세면 105행이 나오므로, 두 값이 어긋난 것이 아니라 **산출 범위가 다르다**는 점을 먼저 고정한다.

| 산출 | 종수 | 내용 |
|------|:----:|------|
| 원천 카탈로그 절 담당 도메인 | 94 | common 7 · auth 15 · workplace/invitation 23 · subscription 5 · hr 13 · payslip 10 · notification/device_token 5 · import 3 · privacy 2 · system/export 11 |
| 카탈로그 절 타 도메인 참조 행 | 9 | attendance 2 · leave 1 · payroll 6. **참조 표기이며 카탈로그가 채번하지 않는다** |
| 카탈로그 절 폐기 코드 행 | 2 | import.staff_limit_exceeded · dashboard.export_failed. **유효 코드가 아니다** |
| 카탈로그 절 행 수 합 | **105** | 94 + 9 + 2. 원천 문서의 한 절을 행 단위로 센 값이다 |
| ATT·LEV·PAY 도메인 REQ 본문 정의 | 23 | attendance 7 · leave 6 · payroll 10. 참조 9종을 포함한 전수다 |
| **유효 코드 전수(본 문서 등재)** | **119** | 담당 **95** + ATT·LEV·PAY **24**. 폐기 2종은 별도 절에 두고 세지 않는다 |

검산: 95 + 24 = **119**. 참조 9종은 ATT·LEV·PAY 23종 안에 이미 포함되므로 다시 더하지 않는다.

위 표의 **원천 카탈로그 절 행(94 · 9 · 2 · 105)은 원천 문서를 센 값이라 바뀌지 않는다.** 본 문서 등재 종수만 신설분을 얹는다 — 담당 95 = 원천 94 + workplace.business_unit_overlap 1(2026-08-21), ATT·LEV·PAY 24 = 원천 REQ 본문 23 + attendance.assignment_forbidden 1(2026-08-08).

**세는 기준은 "v1 서버가 발생시킬 수 있는 유효 코드의 개수"**다. 폐기 코드는 재사용 금지 목록으로만 남기고 전수에서 뺀다. 발생 지점이 v1에 없으나 **계약에 살아 있는 코드는 전수에 포함**하고 **발생 조건 셀에 "v1 발생 지점 없음"과 그 이유를 명시**한다. **어느 코드가 그것인지를 여기서 목록으로 닫지 않는다** — 예약 코드는 범위 결정과 축 신설 때마다 늘고, 목록을 정본으로 두면 **늘 때마다 이 문장이 틀리는데 드러날 자리가 없다**(실측 — export.forbidden과 subscription.upgrade_required가 그 목록 밖에서 미발생으로 등재됐다). **세는 자리는 표의 행이고 이 문단은 세는 기준만 갖는다.** 예약의 사유는 셋 중 하나다 — 기능이 v1 제외이거나(푸시 · 사업장 양도) · 불변식을 명시하려는 것이거나(필수 알림) · **판정 축이 아직 없어 열릴 자리가 없는 것**이다(등급 한도).

> **원천 카탈로그 절의 행 수 105는 유효 코드 전수가 아니다.** 인용처([../README.md](../README.md) 고정 기준 · [04_id_conventions.md](./04_id_conventions.md) · [../03_requirements/README.md](../03_requirements/README.md) · [../10_security/README.md](../10_security/README.md))는 모두 **유효 전수 119**로 정렬돼 있다(2026-08-21 재정렬). 새 인용은 반드시 119와 세는 기준을 함께 쓴다.

## HTTP 상태 규약

| 상태 | 의미 |
|------|------|
| 400 | 입력 형식·요청 검증 실패 |
| 401 | 미인증 — 자격증명 부재·실패·재인증 필요 |
| 402 | 결제·플랜 한도 — 업그레이드 필요 |
| 403 | 권한 없음 또는 **적용 대상 아님**(인증됐으나 접근 거부) |
| 404 | 리소스 부재(비소유 자원의 존재 은닉 포함) |
| 409 | 충돌 — 중복·상태 불일치·동시성 |
| 410 | 만료·1회용 리소스 소진 |
| 413 | 요청 크기 초과 |
| 422 | 검증 불가 — 의미상 처리 불가·**기준값/전제 미충족** |
| 429 | rate limit 초과 |
| 500 | 서버 내부 처리 실패 |
| 503 | 외부 서비스 장애 |

**403(적용 대상 아님)과 422(전제 미충족)를 구분한다.** 이것이 insadesk 에러 규약의 핵심이며 REQ-GLB-19가 강제한다.

- **403은 정상 상태**다 — 요청 자체는 유효하지만 그 사업장·그 기간·그 역할에는 규정이 적용되지 않는다. 사용자가 할 조치가 없다. 5인 미만 기간의 법정 연차 미적용(leave.not_applicable/403)이 대표 사례이며, 화면은 "적용되지 않습니다"로 안내하고 재시도 경로를 제시하지 않는다.
- **422는 조치 가능한 상태**다 — 계산·처리에 필요한 전제가 아직 채워지지 않았다. 상시근로자 스냅샷 부재(leave.employee_count_snapshot_required/422 · payroll.employee_count_snapshot_required/422)가 대표 사례이며, 화면은 무엇을 채워야 하는지를 안내한다.
- 둘을 뒤바꾸면 **없는 문제를 고치라고 재촉하거나(403→422) 실제 차단 사유를 정상 상태로 감춘다(422→403).** 후자가 특히 위험하다 — 기준값 누락이 "적용 대상 아님"으로 보이면 급여가 임의값으로 계산된 것을 아무도 눈치채지 못한다.
- **401과 403의 구분**: 인증 자체가 없으면 401, 인증됐으나 권한·적용 대상이 아니면 403이다. 재인증 필요(auth.reauth_required)는 자격증명을 다시 요구하므로 401이다.
- **404와 403의 구분**: 타인 소유 자원은 존재를 노출하지 않기 위해 404를 준다(payslip.not_found · notification.not_found). 대상의 존재를 이미 아는 상태에서 역할이 모자란 경우가 403이다(payslip.correct_forbidden).
- **402와 403의 구분**: 한도 초과는 402(구독 등급을 올리면 해소), 권한 부족은 403(등급과 무관)이다. 사업장 등록 차단에서 이 둘을 섞지 않는다(REQ-WRK-02).

## 네임스페이스 배정 규칙

**네임스페이스는 소문자**이며 기능 접두사(AUT·WRK 등 대문자)와 표기 축이 다르다. 16종은 실제로 코드를 발생시키는 표면의 전수이며, 설계에 없는 표면에는 네임스페이스를 만들지 않는다.

| 네임스페이스 | 범위 | 비고 |
|-------------|------|------|
| common | 요청 검증·형식 오류·도메인 전용 코드가 없는 부재/충돌·업로드 크기·rate limit·외부 장애 | 전 도메인 공유. 도메인 전용 코드가 있으면 그것을 우선한다 |
| auth | 계정 수명주기·로그인·세션·CSRF·재인증·컨텍스트 권한 판정 | 사업장 스코프 위반(auth.workplace_forbidden)과 플랫폼 권한 부재(auth.platform_forbidden)가 여기 속한다 |
| workplace | 사업장 등록·진위확인·상태·**설정값**·멤버 역할·제외·폐쇄 | 사업장과 멤버십은 한 네임스페이스를 쓴다 — 멤버십은 사업장에 종속한 개체다. **다른 도메인 표면에서 나더라도 부재한 값이 사업장의 것이면 여기다** — workplace.verification_pending(급여·명세서 표면) · workplace.mgmt_no_required(신고자료 표면)가 그 형태다 |
| invitation | 초대 토큰·응답 상태 | 초대 자체의 수명주기만 담당한다. 초대 대상의 역할 권한 위반은 workplace가 갖는다 |
| subscription | 요금제 한도·구독 상태 | **한도 초과는 전부 402**다. 어느 도메인에서 터지든 정의처는 여기다 |
| hr | 직원·민감정보·근로조건·입퇴사·근로계약 | 복호화 통제·키 버전·최저임금 미달(등록 시점)이 여기 속한다 |
| attendance | 출퇴근 순서·지오펜스·수정 요청·마감 | 마감 차단은 사유를 배열로 반환하는 단일 코드다 |
| leave | 연차 적용 판정·신청·잔액·승인 | **403(미적용)과 422(전제 미충족)의 구분이 이 도메인의 핵심 규약**이다 |
| payroll | 급여 기준·계산 전제·확정·정정·퇴직급여 | 기준값 누락 차단(payroll.missing_reference_value)의 정의처다 |
| payslip | 명세서 생성·발행·교부·다운로드 토큰·정정본 | 다운로드 토큰 만료 규약을 인사 문서함(REQ-HRM-24)과 공유한다 |
| notification | 알림 조회·타입·필수 알림 | 알림 생성 실패는 원 이벤트를 롤백하지 않으므로 에러 코드가 아니라 재시도 큐로 간다 |
| device_token | 푸시 기기 토큰 형식 | **v1 발생 지점 없음** — 푸시(NTF-02)는 v1 제외이며 코드만 예약한다 |
| import | 데이터 온보딩 파일 검증·행간 중복·커밋 재시도 | 기존 DB와의 중복은 hr이, 인원 한도는 subscription이 갖는다 |
| privacy | 위치정보 동의·동의 이력 | 필수 동의 누락 차단은 auth.consent_required가 갖는다 — 가입 흐름의 코드다 |
| system | 플랫폼 권한 키·기준값·요금제·약관 문서 | 플랫폼 권한 자체가 없는 경우는 auth.platform_forbidden이다 |
| export | 감사 로그·자료 내보내기 | 내보내기 실패는 유일한 500 코드다 |

**TAX·CMP·SUB 화면 도메인은 전용 네임스페이스를 갖지 않는다.** TAX는 상위 도메인 데이터를 읽어 문서를 만드는 경로라 **실패 원인이 그 데이터를 소유한 도메인의 코드로 표현된다** — 급여 원천이 없으면 payroll 이고 사업장 설정값이 비었으면 workplace 다. **어느 네임스페이스로 표현되는지를 열거하지 않는다** — 읽는 상위 도메인이 늘면 그 열거가 틀리는데 **틀렸다는 사실이 드러날 자리가 없다**(2026-09-10 실측 — workplace.mgmt_no_required 채번이 그 자리였다). CMP는 스냅샷 부재가 차단되는 도메인(payroll·leave·attendance)의 코드로 드러나는 것이 REQ-CMP-06의 의도다 — 사용자는 "상시근로자 산정이 없다"가 아니라 "이 급여를 확정할 수 없다"는 맥락에서 문제를 만난다. SUB는 subscription 네임스페이스를 그대로 쓴다.

## 에러 코드 전수

### common — 공통 검증 (7종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| common.validation_failed | 400 | 요청 본문·쿼리·경로 파라미터 검증 실패. **업로드 매직넘버와 확장자 불일치 · 수치 범위 상한 초과(페이지 크기·조회 기간·정렬 필드 화이트리스트) 검증을 포함**한다. 전 API 공통 |
| common.invalid_format | 400 | 필드별 형식 오류 — 전화번호·날짜·UUID · **사업자등록번호 체크섬 · 좌표 형식** 등 |
| common.not_found | 404 | 도메인 전용 404 코드가 없는 조회 대상 부재. **UPDATE·DELETE가 RLS로 0행을 반환한 경우의 승격 폴백**을 포함한다 — 403을 주면 그 자원이 존재한다는 사실이 샌다 |
| common.conflict | 409 | 도메인 전용 409 코드가 없는 중복·상태 충돌. **직렬화 실패·락 획득 실패의 폴백**을 포함한다(REQ-GLB-15 잠금 대상의 경합 표면) |
| common.payload_too_large | 413 | 업로드·임포트 파일 등 허용 크기 초과(REQ-WRK-32 · REQ-HRM-23) |
| common.rate_limited | 429 | 로그인 실패 누적 · 재설정 메일 발송 빈도 초과 · **국세청 진위확인 호출량 제한**. 재시도 가능 시각을 함께 반환한다(REQ-AUT-10 · REQ-AUT-15 · REQ-WRK-07) |
| common.service_unavailable | 503 | 외부 서비스 일시 실패. 국세청 API는 전용 코드를 쓴다(REQ-WRK-07) |

### auth — 인증·계정 (15종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| auth.username_taken | 409 | username 중복. 사전 확인을 통과했어도 가입 트랜잭션에서 재검증한다(REQ-AUT-04 · REQ-AUT-07) |
| auth.phone_taken | 409 | 휴대폰 중복 — profiles.phone 부분 유니크, DELETED 계정 제외(REQ-AUT-04) |
| auth.weak_password | 422 | 비밀번호 정책 미충족. 필드별 메시지를 반환한다(REQ-AUT-04 · REQ-AUT-14) |
| auth.invalid_credentials | 401 | 아이디 미존재와 비밀번호 불일치를 통일한 응답 — **사용자 열거 차단**(REQ-AUT-10) |
| auth.password_unchanged | 422 | 새 비밀번호가 현재 비밀번호와 동일(REQ-AUT-14) |
| auth.token_invalid | 401 | access·**refresh** token 만료·revoke·서명 불일치. 회전 재발급 실패도 이 코드이며 인증 컨텍스트를 폐기한다 — 화면은 작성 중 입력을 버리지 않고 보존한 채 재로그인을 유도한다(REQ-AUT-11 · 01_standards §1-4) |
| auth.csrf_token_invalid | 403 | 웹 세션 채널 상태변경 요청의 CSRF 토큰 부재·불일치. **앱 JWT 채널은 대상이 아니다**(REQ-AUT-11) |
| auth.account_suspended | 403 | SUSPENDED 계정의 로그인·접근. 정지 사유·해제 예정일을 함께 반환한다(REQ-AUT-09) |
| auth.account_deleted | 403 | DELETED 계정의 로그인·재설정·초대 수락 · DELETED 종단에서의 상태 재전이 시도(DB 가드)(REQ-AUT-09 · REQ-AUT-22) |
| auth.consent_required | 422 | 필수 약관·개인정보 동의 또는 개정 재동의 누락 — 위치정보는 별도 선택 동의라 가입 요건이 아니다(D-19)(REQ-AUT-03 · REQ-SYS-16) |
| auth.reset_token_invalid | 400 | 재설정 토큰 만료·사용완료·불일치. 반복 실패는 rate limit + 보안 이벤트 기록(REQ-AUT-16) |
| auth.reauth_required | 401 | 민감 작업(민감정보 복호화 · 사업장 폐쇄 · 계정 탈퇴 · 민감 문서 다운로드 · **프로필의 연락처·복구 이메일 변경**) 시 재인증 미충족 **또는 재인증 토큰 검증 실패**(만료·이미 소비·불일치). 재인증 결과는 단기 유효이며 작업 단위로 소비한다(REQ-AUT-25 · REQ-AUT-26) |
| auth.workplace_forbidden | 403 | 요청 workplace_id와 멤버십·역할 불일치(REQ-WRK-20) |
| auth.platform_forbidden | 403 | 시스템 웹 진입 시 플랫폼 권한 자체가 없음. **사업장 OWNER라도 플랫폼 권한은 별개**다(REQ-AUT-23 · REQ-SYS-03) |
| auth.owner_must_transfer | 409 | OWNER로 소유한 사업장이 남아 있어 탈퇴 차단. **v1은 사업장 양도가 미구현이라 실질 해소 경로는 폐쇄뿐**이며 화면은 폐쇄 경로를 안내한다(REQ-AUT-20) |

### workplace — 사업장·멤버 (22종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| workplace.business_invalid | 422 | 진위확인 불일치 또는 **폐업** 사업자. 휴업은 경고 후 등록을 허용한다(REQ-WRK-04 · REQ-WRK-05) |
| workplace.business_api_unavailable | 503 | 국세청 API 장애·timeout·호출량 초과. PENDING_VERIFICATION 생성 경로를 함께 제시한다(REQ-WRK-07) |
| workplace.duplicate_site | 409 | 동일 (business_no, site_label) 완전 중복. 동일 사업자번호의 복수 사업장 등록 자체는 허용한다(REQ-WRK-06) |
| workplace.verification_pending | 409 | PENDING_VERIFICATION 상태에서 급여 확정·명세서 발행 시도. 근태·인사 입력은 허용한다(REQ-WRK-08 · REQ-SLP-01) |
| workplace.immutable_field | 422 | business_no·owner_name·open_date 등 재검증 없이 바꿀 수 없는 보호 필드 변경 시도 · 확정 스냅샷의 판정 컬럼 변경 시도(DB 가드)(REQ-WRK-09) |
| workplace.already_member | 409 | 초대 대상이 이미 ACTIVE 멤버(REQ-WRK-13) |
| workplace.invite_role_forbidden | 403 | 역할 초대 권한 위반 — MANAGER가 MANAGER·OWNER를 초대(REQ-WRK-12) |
| workplace.closed | 409 | SUSPENDED·CLOSED 사업장에서 초대 수락·업무 진입 시도 · CLOSED 종단에서의 상태 재전이 시도(DB 가드)(REQ-WRK-18) |
| workplace.unavailable | 409 | SUSPENDED·CLOSED 사업장으로 컨텍스트 전환 시도(REQ-WRK-20) |
| workplace.role_change_forbidden | 403 | 역할 변경 권한·경로 위반 — MANAGER의 역할 변경, 역할 변경으로 OWNER 생성 시도. **역할 컬럼 변경을 OWNER로 제한하는 DB 가드(guard_role_change)의 2차 방어도 이 코드를 낸다** — 신규 코드를 만들지 않는다(REQ-WRK-21) |
| workplace.owner_singleton | 409 | ACTIVE OWNER 1명 불변식 위반 — 0명 또는 2명 이상이 되는 전이(REQ-WRK-22) |
| workplace.last_owner | 409 | 마지막 OWNER 강등·제외 시도. 양도가 선행해야 하나 **v1은 양도가 미구현이라 실질 해소 경로는 폐쇄뿐**이다(REQ-WRK-22 · REQ-WRK-27) |
| workplace.payroll_in_progress | 409 | 급여 확정 진행 중인 대상자의 멤버 제외 차단(REQ-WRK-27) |
| workplace.pending_approver | 409 | 미처리 승인의 필수 승인자 제외 차단. 승인자 재배정이 선행해야 한다(REQ-WRK-27) |
| workplace.member_not_found | 404 | 역할 변경·제외 대상 멤버십 부재(REQ-WRK-21) |
| workplace.member_state_conflict | 409 | **REMOVED·SUSPENDED 이력 멤버십의 재초대 수락 차단** — LEFT만 재활성화를 허용한다(REQ-WRK-17) |
| workplace.employee_required | 409 | 멤버 제외로 사업장 필수 직원(최소 1명)이 미달(REQ-WRK-27). 퇴사 처리의 선행조건 차단은 hr.resignation_blocked/409가 담당한다 |
| workplace.close_blocked | 409 | 폐쇄 전 미완 급여·미발행 명세서·미처리 승인 존재. 미충족 항목을 details로 반환한다(REQ-WRK-36) |
| workplace.retention_ack_required | 422 | 폐쇄 시 법정 보존 안내 확인(retention_acknowledged) 누락(REQ-WRK-36) |
| workplace.transfer_invalid | 422 | 양도 대상·상태·한도 검증 실패. **v1 발생 지점 없음** — 사업장 양도는 v1.1 이월이며 코드만 예약한다 |
| workplace.business_unit_overlap | 409 | 같은 소유자·명칭의 사업 단위 선언 유효기간 겹침 — business_units EXCLUDE 제약(23P01)의 제약별 코드. 정상 경로는 같은 날 재선언을 갱신으로 흡수하므로 주로 **동시 선언 경합**에서 발생한다(REQ-CMP-10) |
| **workplace.mgmt_no_required** | 422 | 신고자료 생성 시 **대상 보험 계열의 사업장관리번호가 비어 있음**(REQ-TAX-01 · REQ-WRK-09). **발생 지점은 TAX 표면**([../06_api/10_tax.md](../06_api/10_tax.md))이고 해소 자리는 사업장 설정이다 — 부재한 값이 사업장의 것이라 workplace 가 갖는다. **비어 있는 계열을 details로 반환**한다. **404를 쓰지 않는다** — 자원이 없는 것이 아니라 전제가 비어 있는 것이며, 404는 존재 은닉 축이다 |

### invitation — 초대 (3종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| invitation.expired | 410 | 만료(EXPIRED) 토큰으로 수락 시도(REQ-WRK-16) |
| invitation.invalid_token | 422 | 초대 토큰·공유 코드 무효 — **재발송으로 무효화된 직전 토큰 포함**(REQ-WRK-14 · REQ-WRK-16) |
| invitation.already_responded | 409 | 이미 응답한 초대의 재수락·재거절 · **이미 응답된 초대의 재발송·취소 시도**. 재발송은 종단 상태(REJECTED·EXPIRED)에서만 새 행을 만든다(REQ-WRK-18) |

### subscription — 구독·한도 (5종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| subscription.workplace_limit_exceeded | 402 | OWNER 사업장 등록 수 한도 초과. 현재 사용량·필요 등급·업그레이드 경로를 함께 반환한다(REQ-WRK-02 · REQ-SUB-05) |
| subscription.staff_limit_exceeded | 402 | 사업장 활성 멤버 수 한도 초과 — 초대 발송·수락·임포트 세 지점에서 각각 검증한다(REQ-WRK-14 · REQ-WRK-16 · REQ-WRK-35 · REQ-SUB-06) |
| subscription.expired | 402 | 구독 만료로 기능 차단. **법정 보존 데이터의 조회·교부는 차단하지 않는다**(REQ-SUB-09) |
| subscription.plan_not_found | 404 | 요금제 미존재(REQ-SUB-03) |
| subscription.upgrade_required | 402 | 기능 플래그·한도로 업그레이드 필요(REQ-SUB-07). **v1 발생 지점 없음** — 한도 2축(소유 사업장 수 · 사업장당 활성 멤버 수)은 subscription.workplace_limit_exceeded · staff_limit_exceeded가 각각 가지며 **같은 사유에 두 코드를 두지 않는다.** 한도 축이 늘면 그때 쓸 자리라 예약한다 |

### hr — 인사·계약 (13종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| hr.duplicate_active_employee | 409 | 동일 사업장·동일 사용자에 ACTIVE 직원 레코드 중복(REQ-HRM-11 · REQ-WRK-35) |
| hr.resident_no_duplicate | 409 | 동일 사업장 주민등록번호·외국인등록번호 중복 — **복호화 없이 blind index로 판정**(REQ-HRM-03 · REQ-WRK-35) |
| hr.decrypt_forbidden | 403 | 복호화 4요건(재인증·사유·감사·1회성 응답) 미충족 — 민감 문서 다운로드 토큰 발급에도 같은 요건(REQ-HRM-04 · REQ-HRM-24) |
| hr.decrypt_envelope_conflict | 409 | 1회성 복호화 응답 envelope 등록 충돌(REQ-HRM-04) |
| hr.personal_info_key_version_conflict | 409 | 키 회전 경계에서 행 단위 키 버전 메타데이터가 깨질 수 있는 부분 저장 요청(REQ-HRM-03) |
| hr.hire_date_conflict | 409 | 기존 ACTIVE 직원의 hire_date와 다른 입사 확정 요청(REQ-HRM-10) |
| hr.rehire_requires_new_employee | 409 | RESIGNED 직원 레코드 재활성화 시도 — 재입사는 **새 고용기간 레코드**를 만든다(REQ-HRM-11) |
| hr.term_overlap | 409 | 근로조건(employment_terms) 유효기간 겹침(REQ-HRM-06) |
| hr.below_minimum_wage | 422 | 근로조건 등록 시 시급 환산액이 최저임금 미만(REQ-HRM-07) |
| hr.resignation_blocked | 409 | 퇴사 전 미완 급여 확정·미처리 승인·OWNER 역할 보유. 미충족 항목을 details로 반환한다(REQ-HRM-14) |
| hr.contract_missing_field | 422 | 근로계약 법정 명시사항 누락 — **단시간 근로일별 근로시간 포함**(REQ-HRM-08 · REQ-HRM-20) |
| hr.contract_not_signable | 409 | 계약 상태상 전자서명 불가 또는 본인 계약이 아님(REQ-HRM-21) |
| hr.minor_document_missing | 422 | 연소자 법정 비치 서류(가족관계증명서·친권자 동의서) 미비치(REQ-HRM-26) |

### attendance — 근태 (8종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| attendance.invalid_sequence | 409 | 미퇴근 상태의 중복 출근 · 출근 없는 퇴근 · 퇴근이 출근보다 이름(REQ-ATT-02) · **휴게 순서 위반 — 출근 전·퇴근 후 휴게 · 중복 휴게 시작 · 진행 중 휴게 없는 휴게 종료**(REQ-ATT-06) |
| attendance.out_of_geofence | 422 | 서버 재검증 결과 지오펜스 반경 밖. 예외 요청 경로를 안내한다(REQ-ATT-03) |
| attendance.accuracy_too_low | 422 | **좌표 미수신**(위치 자체가 없음). **정확도 저하만으로는 차단하지 않고 attendance_status = PENDING으로 저장한 뒤 사유를 risk_flags에 남겨 관리자 승인 대상으로 넘긴다** — 출근을 차단하면 근무는 했는데 기록이 없는 상태가 되어 근태·급여 누락으로 직결된다(REQ-ATT-04) |
| attendance.change_request_pending | 409 | 동일 직원·동일 일자에 PENDING 수정 요청이 이미 존재(REQ-ATT-16) |
| attendance.self_approval_forbidden | 403 | 본인 수정 요청·본인 PENDING 체크인 레코드의 본인 승인 시도(REQ-ATT-04 · REQ-ATT-17 · REQ-GLB-16) |
| attendance.closing_blocked | 409 | 월 마감 차단. **사유 6종을 배열로 반환**한다 — 미퇴근·미승인 수정요청·스케줄 누락·스냅샷 누락·휴게 미달·데이터 모순(REQ-ATT-18) |
| attendance.period_closed | 409 | 마감(LOCKED)·급여 확정된 기간의 근태 수정·승인 시도(REQ-ATT-17 · REQ-WRK-27) · **마감 기간의 스케줄 변경·삭제 시도**(REQ-ATT-19) · **급여 확정 진행 중 해당 기간의 인사·휴가 변경 시도**(REQ-GLB-15 ②) |
| **attendance.assignment_forbidden** | **422** | **법정 보호 대상자의 금지 시간대 편성 시도** — 연소자(만 18세 미만)의 야간(22:00~06:00 걸침)·주휴일 배치, 임신 중 근로자의 소정근로 초과 배치다. 규모와 무관하게 적용되며 위반은 근로기준법 §70② · §74⑤ 형사처벌 대상이다(REQ-ATT-15 ③④ · REQ-ATT-08) |

### leave — 휴가·연차 (6종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| leave.not_applicable | 403 | 5인 미만 기간의 법정 연차 미적용 — **정상 상태이며 조치 대상이 아니다**(REQ-LEV-01) |
| leave.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재로 적용 여부 판정 불가 — **조치 가능**(REQ-LEV-01 · REQ-CMP-06) |
| leave.request_overlap | 409 | 동일 직원의 휴가 기간 중복 신청(REQ-LEV-08) |
| leave.insufficient_balance | 422 | 예약 차감 시점 잔액 부족(REQ-LEV-08 · REQ-LEV-09) |
| leave.period_closed | 409 | 마감된 근태·급여 기간에 대한 휴가 신청·변경(REQ-LEV-08) |
| leave.self_approval_forbidden | 403 | 본인 신청의 본인 승인 시도(REQ-LEV-10 · REQ-GLB-16) |

### payroll — 급여 (10종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| payroll.missing_reference_value | 422 | 귀속기간·지급일에 필요한 기준값 누락 또는 확인자 미기입. **임의 기본값·직전 연도 값 대체를 금지**한다(REQ-GLB-09 · REQ-SYS-13) |
| payroll.missing_payroll_terms | 422 | 급여 기준 부재 또는 **지급일 미설정** — 지급일이 없으면 간이세액표 버전을 결정할 수 없다. **근로조건(employment_terms) 부재와 보험 적용정보(employee_insurance_infos) 부재도 이 코드로 흡수**한다 — 계산 전제인 급여 기준 묶음의 결손이라 별도 코드를 두지 않는다(REQ-PAY-05 · REQ-PAY-06) |
| payroll.payroll_terms_overlap | 409 | 급여 기준(payroll_terms) 유효기간 겹침(REQ-PAY-04) |
| payroll.attendance_not_closed | 409 | 근태 미마감 상태의 계산·확정 시도. 미리보기에는 적용하지 않는다(REQ-PAY-06 · REQ-SLP-01) |
| payroll.employee_count_snapshot_required | 422 | 기준일 상시근로자 스냅샷 부재. 사업장 검증 대기 차단과는 **별개 사유**다(REQ-PAY-06 · REQ-CMP-06) |
| payroll.below_minimum_wage | 422 | 최저임금 미달 — 확정 차단 또는 관리자 명시 확인 요구. 강행 확정은 사유·행위자를 감사 기록한다(REQ-PAY-26) |
| payroll.already_confirmed | 409 | 동일 **(workplace_id, pay_period, source)** 에 **무효화되지 않은 실행이 이미 있는데** 다시 확정 — 유일성 키는 source(REGULAR·IMPORT)를 포함한 3열이고 술어는 status <> VOIDED 라 **정정본도 판정에 참여한다**(V0737). 서비스 사전검증도 같은 축이다(REQ-PAY-28) |
| payroll.confirmation_conflict | 409 | 확정·**정정본 발행** 멱등키 충돌. 두 표면이 같은 멱등키 공간을 쓴다(REQ-PAY-28 · REQ-PAY-29) |
| payroll.void_forbidden | 403 | 원본 VOID·정정본 발행 권한 없음 — MANAGER 시도, OWNER 전용(REQ-PAY-29) |
| payroll.severance_source_missing | 409 | 퇴직금·이직확인서 산정에 필요한 확정 급여 부재(REQ-PAY-34 · REQ-TAX-02) |

### payslip — 명세서 (10종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| payslip.not_found | 404 | 명세서 없음 또는 접근 불가. **행 존재 자체를 숨긴다** — 403이 아니다(REQ-SLP-08) |
| payslip.run_not_confirmed | 409 | 대상 급여 실행이 CONFIRMED가 아님(REQ-SLP-01) |
| payslip.missing_required_field | 422 | 법정 필수 기재사항 데이터 누락. 보완 항목 목록을 반환하고 교부하지 않는다(REQ-SLP-06) |
| payslip.generation_failed | 422 | PDF 생성 실패 — status = FAILED. 급여 확정을 롤백하지 않는다(REQ-SLP-03) |
| payslip.already_issued | 409 | GENERATE_MISSING 대상이 이미 발행됨. **재발행은 정정본 경로만**(REQ-SLP-11) |
| payslip.bulk_in_progress | 409 | 동일 급여 실행의 일괄 작업 진행 중(REQ-SLP-11) |
| payslip.bulk_conflict | 409 | 일괄 발행·**정정본 발행** 멱등키 충돌(REQ-SLP-11 · REQ-SLP-16) |
| payslip.download_token_expired | 410 | 1회용 다운로드 토큰 만료·사용 후 재사용. **인사 민감 문서 다운로드와 규약을 공유**한다(REQ-SLP-08 · REQ-HRM-24) |
| payslip.forbidden | 403 | 본인도 사업장 관리자도 아닌 **관리 액션** 시도. 열람 대상 자원의 비소유 접근은 이 코드가 아니라 payslip.not_found/404다 — 관리 액션은 이미 그 명세서의 존재를 아는 관리자가 부르는 표면이라 은닉의 의미가 없다(REQ-SLP-08) |
| payslip.correct_forbidden | 403 | 정정본 발행 권한 없음 — MANAGER 시도, OWNER 전용(REQ-SLP-16) |

### notification — 알림 (4종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| notification.not_found | 404 | 알림 부재 **또는 타인 알림(조회·조작 모두) — 행 존재 은닉**. 타인 자원 접근은 403이 아니라 404로 통일해 존재를 노출하지 않는다(REQ-NTF-03) |
| notification.forbidden | 403 | 필수 알림 해제·삭제 등 **본인 알림에 대한 불허 조작**. 대상이 본인 알림임을 이미 아는 상태의 권한 판정이며, **타인 알림 접근은 이 코드가 아니라 notification.not_found/404**다(REQ-NTF-03 · REQ-NTF-06) |
| notification.unknown_type | 400 | 미정의·비활성 알림 타입 생성 시도(REQ-NTF-05) |
| notification.mandatory_pref | 409 | 필수 알림 5종(법정 교부 **2종** — 명세서 발행 · 근로계약 발송 · 보안 · 계정 정지 · 사업장 정지) 수신 거부 시도. **v1은 알림 설정 기능이 없어 발생 지점이 없으나 REQ-SLP-14 불변식을 명시하기 위해 예약**한다(REQ-NTF-06 · REQ-SLP-14) |

### device_token — 기기 토큰 (1종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| device_token.invalid | 400 | 푸시 토큰·플랫폼 형식 오류. **v1 발생 지점 없음** — 푸시(NTF-02)는 v1 제외이며 코드만 예약한다 |

### import — 데이터 온보딩 (3종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| import.validation_failed | 422 | 행 단위 검증 오류. **행 번호·필드·사유를 포함**한다(REQ-WRK-32) |
| import.duplicate_employee | 409 | **업로드 파일 내 행간 중복**(동일 username·주민등록번호) 전용. 기존 DB와의 중복은 hr 코드를 쓴다(REQ-WRK-35) |
| import.rollback_required | 409 | 확정 트랜잭션이 원자 단계에서 실패해 커밋분이 무효화된 경우 — 재실행 필요. **행 단위 부분 실패는 이 코드가 아니라 200 + PARTIALLY_COMMITTED다**(REQ-WRK-33) |

### privacy — 개인정보·위치정보 (2종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| privacy.location_consent_required | 403 | 위치정보 별도 동의 없이 GPS 체크인 시도. 동의 화면으로 유도한다(REQ-PRV-01) |
| privacy.consent_version_conflict | 409 | 동일 (user_id, kind, version) 동의 중복 기록 — 멱등 처리한다(REQ-PRV-02) |

### system — 플랫폼 운영 (7종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| system.permission_denied | 403 | 역할별 권한 키 미충족 — **플랫폼 권한은 보유한 상태**다(REQ-SYS-03) |
| system.last_super_admin | 409 | 마지막 SUPER_ADMIN 정지·삭제·회수 차단(REQ-AUT-19 · REQ-SYS-07) |
| system.plan_in_use | 409 | 이미 참조된 요금제의 파괴적 변경·삭제(REQ-SUB-02 · REQ-SYS-08) |
| system.statutory_rate_overlap | 409 | 기준값 유효기간 겹침. btree_gist EXCLUDE 제약이 강제한다(REQ-SYS-12 · REQ-GLB-08) |
| system.terms_version_conflict | 409 | 동일 (kind, version) 문서 중복(REQ-SYS-15) |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 없음(REQ-SYS-15) |
| system.terms_in_use | 409 | 이미 동의에 참조된 문서 버전 삭제 시도. 비활성화만 허용한다(REQ-SYS-15) |

### export — 내보내기 (4종)

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| export.forbidden | 403 | 내보내기 권한·필터 범위 위반(REQ-SYS-11). **발생 지점은 목록 공통 내보내기의 표면 불일치**다 — 등재된 목록을 **그 목록이 속하지 않은 표면에서** 요청한 경우(사업장 표면으로 시스템 목록 · 그 반대). 등재되지 않은 목록은 common.validation_failed/400이고, **목록 자체의 조회 권한 미충족은 그 목록 조회 표면의 코드 그대로**다(auth.workplace_forbidden/403 · system.permission_denied/403) — 같은 사유에 두 코드를 두지 않는다. 감사 로그 내보내기의 권한 미충족도 system.permission_denied/403이다 |
| export.not_ready | 409 | 내보내기 작업 미완료 — PENDING·RUNNING 상태(REQ-SYS-11) |
| export.expired | 410 | 내보내기 다운로드 토큰 만료·자동 삭제(REQ-SYS-11). **목록 공통 내보내기는 없음 · 만료 · 재사용 · 바인딩 불일치 · 소유자 불일치를 전부 이 코드로 수렴한다** — 갈라 주면 토큰의 존재가 샌다 |
| export.failed | 500 | 내보내기 파일 생성 실패 — 감사 로그 내보내기 작업 · 목록 공통 내보내기의 XLSX 작성(REQ-SYS-11). **전수에서 유일한 500 코드**다 |

## 도메인별 집계

| 네임스페이스 | common | auth | workplace | invitation | subscription | hr | attendance | leave | payroll | payslip | notification | device_token | import | privacy | system | export |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 종수 | 7 | 15 | **22** | 3 | 5 | 13 | **8** | 6 | 10 | 10 | 4 | 1 | 3 | 2 | 7 | 4 |

검산: 7 + 15 + **22** + 3 + 5 + 13 + 8 + 6 + 10 + 10 + 4 + 1 + 3 + 2 + 7 + 4 = **120종 · 16네임스페이스**.

> **파생 집계** — [../03_requirements](../03_requirements/README.md) 도메인 파일의 에러 절 합계와 대조한 값이다. 03_workplace.md는 workplace **22** + invitation 3 + import 3 = **28종**을 한 파일에 싣고, 13_system.md는 system 7 + export 4 = 11종을, 11_notification.md는 notification 4 + device_token 1 = 5종을 싣는다. 09_tax.md·10_compliance.md·15_nonfunctional.md의 표는 **타 도메인 정의 코드의 인용**이므로 여기서 다시 세지 않는다 — 15_nonfunctional.md는 common 4종(rate_limited · service_unavailable · payload_too_large · validation_failed)을 비기능 관점으로 인용하며 **분류되지 않은 내부 실패에는 코드를 두지 않고** 500 폴백 규칙([../06_api/02_errors.md](../06_api/02_errors.md) SQLSTATE 매핑 ⑤)을 따른다.

## HTTP 상태별 집계

| 상태 | 400 | 401 | 402 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 503 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 종수 | 5 | 3 | 4 | 18 | 6 | **52** | 3 | 1 | **24** | 1 | 1 | 2 |

검산: 5 + 3 + 4 + 18 + 6 + 52 + 3 + 1 + **24** + 1 + 1 + 2 = **120**.

- **409가 52종으로 최다**다. 도메인 규칙의 대부분이 "지금 이 상태에서는 안 된다"는 상태 가드이며, 그 가드가 상태 머신([03_enums_state_machines.md](./03_enums_state_machines.md))의 전이 표와 1:1로 대응한다.
- **422 24종 중 9종이 기준값·스냅샷·전제 부재**다(payroll 4 · leave 1 · attendance 2 · workplace **2**). 이 묶음이 REQ-GLB-09 기준값 누락 차단의 표면이다 — **다만 workplace.mgmt_no_required는 기준값이 아니라 사업장 설정값의 부재**이고, 같은 422 축이되 해소 자리가 기준값 등록이 아니라 사업장 설정이다.
- **403 18종 중 leave.not_applicable 1종만 "적용 대상 아님"**이고 나머지 17종은 권한 부족이다. 둘의 화면 처리가 다르므로 코드 단위로 분기한다.

## 에러 코드가 아닌 것

같은 {소문자}.{소문자} 표기를 쓰지만 에러 코드 카탈로그의 대상이 아닌 식별자가 셋 있다. 구분하지 않으면 없는 에러를 계약에 올리게 된다.

| 대상 | 형식 | 왜 에러 코드가 아닌가 |
|------|------|---------------------|
| 감사 action 키 | audit_logs.action의 {domain}.{verb} — pii.decrypt · payroll.void · workplace.suspend | **HTTP 상태를 갖지 않는다.** 성공한 행위의 기록이지 실패 응답이 아니다 |
| 멱등키 접두 | payslip.bulk:{run_id} 등 | 중복 부수효과를 막는 키 문자열이다. 충돌 시 반환하는 코드는 payslip.bulk_conflict로 따로 있다 |
| 응답 필드명 | 응답 본문의 code·message 외 필드 | 규격의 일부이지 코드 값이 아니다 |

**CORS 위반에는 전용 코드를 두지 않는다** — 프리플라이트 단계에서 브라우저가 차단하므로 응답 본문이 애플리케이션에 도달하지 않는다. 반면 **CSRF 위반은 서버가 실제 403을 생성**하므로 auth.csrf_token_invalid를 갖는다.

## 폐기 코드

폐기 코드는 **재사용하지 않는다**. 전수 120종에 포함하지 않으며, 구현·문서에 문자열이 남아 있어도 계약으로 취급하지 않는다.

| 폐기 코드 | 대체 코드 | 사유 |
|-----------|-----------|------|
| import.staff_limit_exceeded | subscription.staff_limit_exceeded / 402 | 직원 한도 초과는 발생 지점과 무관하게 구독 도메인 코드를 재사용한다 — 같은 사실에 코드를 둘 두지 않는다 |
| dashboard.export_failed | export.failed / 500 | 리포트·대장 생성 실패를 단일 코드로 통합했다. dashboard 네임스페이스 자체를 두지 않는다 |

## 관련 문서

- ID·표기 규약(네임스페이스 대소문자 축) → [04_id_conventions.md](./04_id_conventions.md)
- enum·상태 머신 정본(상태 가드가 내는 코드의 전이 근거) → [03_enums_state_machines.md](./03_enums_state_machines.md)
- 도메인 용어 정의 → [01_domain_terms.md](./01_domain_terms.md)
- 에러 규약 요구사항(REQ-GLB-19) → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- API 응답 규격·미러 → [../06_api/02_errors.md](../06_api/02_errors.md) · [../06_api/01_conventions.md](../06_api/01_conventions.md)
- 도메인별 발생 조건 상세 → [../03_requirements/README.md](../03_requirements/README.md)
