# NTF — 알림

> **대상**: 알림(NTF) 기능 명세
> **작성일**: 2026-08-03
> **개정일**: 2026-09-07 — 알림 타입 **22 → 24종** · 필수 **4 → 5종** 인용 갱신(V0717 — **contract_sent**(필수) · **contract_signed** 채번. 정본 [../05_database/13_notification.md](../05_database/13_notification.md) · REQ 정본 [../03_requirements/11_notification.md](../03_requirements/11_notification.md)). **contract_sent가 필수인 근거는 법정 교부**다 — 근로기준법 §17② 교부는 발송이 성립해야 이행이므로 채널이 막히면 증적만 남고 이행이 없다. 법정 교부 축이 명세서 하나에서 **둘**이 된다
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 재시도 큐를 Redis 소관으로 확정 · 비활성 타입 생성 차단의 강제 위치 명시 · 알림 삭제 미채택에 따른 사용자 조작 범위 정정
> **원천**: docs_ref2/features_p0.md §2 · §7 · docs_ref2/features.md §2 · §7 · docs_ref2/requirements_p0.md NTF 절 · 2026-08-08 DB 커버리지 감사

NTF는 **승인 요청과 법정 교부가 상대방에게 도달하는 경로**다. 근태 승인 요청·휴가 승인·급여 확정·명세서 발행은 상대가 알아야 다음 단계로 넘어가므로, 이 도메인이 없으면 마감 경로가 사용자 사이에서 끊긴다.

**v1은 인앱 알림 단일 채널이다.** 푸시(NTF-02)는 v1에 두지 않으므로 앱 미설치·미로그인 직원에게는 도메인별 대체 경로(명세서는 이메일 교부 — SLP-06)가 담당한다. 실시간 배달은 다중 서버 인스턴스 fan-out이 필요하고, **미연결 중 발생한 알림은 재접속 시 목록 조회로 보충**한다 — 실시간 채널을 유실 방지 수단으로 삼지 않는다.

**알림 생성 실패가 원 이벤트를 롤백하지 않는다.** 급여 확정이 알림 실패로 되돌아가서는 안 되므로 실패는 재시도 큐에 기록한다. 반대로 **법정 교부·보안·계정 정지·사업장 정지 알림(필수 5종)은 어떤 설정으로도 끌 수 없다** — 수신 거부를 허용하면 교부 의무 이행 사실이 사용자 설정에 종속된다.

**알림 본문에 급여·개인정보 상세를 담지 않는다.** 알림은 잠금화면·미리보기에 노출되므로 금액이 그대로 새어 나간다. 본문은 사건과 링크만 담고 상세는 화면에서 확인하게 한다.

**NTF-02(푸시) · NTF-05(알림 삭제) · NTF-06(알림 설정)은 v1에 두지 않는다.** 따라서 v1에는 타입별 수신 on/off 설정 화면이 없고, 모든 알림이 사실상 필수 알림처럼 동작한다.

## 기능 목록

| 기능ID | 기능명 | 설명 | 우선순위 |
|--------|--------|------|:--------:|
| **NTF-01** | 인앱 알림 배달 | 승인 요청·명세서 발행 통지가 상대에게 도달하는 경로다. 수신자·사업장(선택)·타입·제목·본문·딥링크·페이로드·중요도(LOW·NORMAL·HIGH·URGENT)·읽음 시각·삭제 시각을 저장하고, 수신자가 본인 채널을 구독해 즉시 수신한다. 서버가 여러 인스턴스로 뜨므로 발화가 어느 인스턴스에서 일어나도 구독자에게 닿도록 **fan-out 계층을 둔다**. **미연결 중 발생분은 재접속 시 목록 조회로 보충**하므로 실시간 채널이 유실 방지의 유일한 수단이 아니다. **알림 생성 실패는 원 이벤트를 롤백하지 않고** 재시도 큐에 기록한다 — 급여 확정이 알림 실패 때문에 되돌아가면 훨씬 큰 문제가 된다. **급여·개인정보 상세는 본문과 페이로드에 담지 않는다.** 2차 방어는 수신자 본인만 조회·수정할 수 있게 강제한다 | **P0** |
| **NTF-03** | 알림 목록·읽음 | NTF-01의 짝이다. 읽음 상태가 없으면 알림이 무한 누적되어 채널 자체가 무의미해진다. 본인 알림을 최신순 페이지네이션 조회하고 **현재 사업장 필터**를 지원한다 — 다중 소속 사용자는 사업장별로 알림을 나눠 봐야 한다. 단건·일괄 읽음 시 읽음 시각을 기록하며 **중복 읽음은 멱등 성공**으로 처리한다. 미읽음 카운트는 타입·사업장별로 조회하고 삭제된 알림은 카운트에서 제외한다. 타인 알림 조회·조작은 권한 거부, 미존재·삭제 알림은 부재로 응답해 두 상황을 구분한다 | **P0** |
| **NTF-04** | 알림 타입 | 서버 고정 카탈로그다. 코드·중요도·딥링크 대상·표시 문구 키·**민감정보 포함 금지 여부**·필수 여부·활성 여부를 lookup으로 관리하고 **미정의·비활성 타입의 생성을 거부**한다 — 타입을 자유롭게 만들 수 있게 두면 딥링크와 문구가 클라이언트마다 갈리고 민감정보 제약도 강제할 수 없다. v1 타입은 초대 수신·수락·거절·취소·만료 · 역할 변경 · 멤버 제외 · **계정 정지** · **사업장 정지** · 인사정보 변경 요청 · 근태 이상 · 근태 수정 요청·승인·반려 · 휴가 신청·승인·반려 · 급여 확정 · **명세서 발행** · 법정 기한 임박 · 구독 안내 · **플랫폼 공지** 22종이다. **사업장 정지(workplace_suspended)는 검증 대기 기한 경과에 따른 자동 정지(WRK-14)와 플랫폼 제재 정지(SYS-03)를 OWNER에게 통보**한다 — 사업장이 멈추면 근태·급여가 함께 멈추므로 사용자가 반드시 알아야 하고, **계정 정지와 대상 축이 달라 코드를 겸용하지 않는다**. 새 타입 추가는 DB lookup과 클라이언트 라우팅 맵을 **함께** 갱신하고 미사용 타입은 삭제하지 않고 비활성화한다. 중요도는 **LOW · NORMAL · HIGH · URGENT 4단계**다. 클라이언트는 알 수 없는 타입을 안전한 기본 UI로 표시한다. **법정 교부·보안·계정 정지·사업장 정지 알림(필수 4종)은 어떤 설정으로도 끌 수 없다** | P1 |

**3기능이다** — NTF-01 · 03 · 04. 우선순위 분포는 P0 2(NTF-01 · 03) · P1 1(NTF-04)이며 2 + 1 = 3이다. **NTF-02 · 05 · 06은 결번**이며 v1.1 이후 이월이다.

## 알림 타입 카탈로그 개요

전수와 딥링크 대상의 정본은 [../03_requirements/11_notification.md](../03_requirements/11_notification.md)이며 저장 구조는 [../05_database/13_notification.md](../05_database/13_notification.md)가 정본이다. 아래는 발화 도메인별 요약이다.

| 발화 도메인 | 타입 코드 | 수 | 필수 여부 |
|-------------|---------|:--:|----------|
| 사업장·멤버(WRK) | invite_received · invite_accepted · invite_rejected · invite_cancelled · invite_expired · role_changed · member_removed | 7 | 선택 |
| 계정(AUT) | **account_suspended** | 1 | **필수** |
| 사업장(WRK · SYS) | **workplace_suspended** | 1 | **필수** |
| 인사(HRM) | hr_info_change_requested | 1 | 선택 |
| 근태(ATT) | attendance_anomaly · attendance_change_requested · attendance_approved · attendance_rejected | 4 | 선택 |
| 휴가(LEV) | leave_requested · leave_approved · leave_rejected | 3 | 선택 |
| 급여(PAY) | payroll_confirmed | 1 | 선택 |
| 명세서(SLP) | **payslip_issued** | 1 | **필수** |
| 법정 준수·신고(CMP · TAX) | compliance_deadline | 1 | 선택 |
| 구독(SUB) | subscription_notice | 1 | 선택 |
| 시스템(SYS) | **system_notice** | 1 | **필수** |

**v1 타입은 24종이다** — 검산: 7 + 1 + 1 + 1 + 4 + 3 + 1 + 1 + **2** + 1 + 1 + 1 = **24**. 이 중 필수 알림은 **5종**(account_suspended · workplace_suspended · payslip_issued · system_notice)이다.

- **필수 알림 5종은 수신 거부 대상이 아니다** — 법정 교부 **2종**(명세서 발행 · **근로계약 발송**) · 보안·계정 상태(계정 정지) · **업무 중단(사업장 정지)** · 플랫폼 공지다. **근로계약 발송이 법정 교부 축의 둘째다** — 근로기준법 §17② 교부는 발송이 성립해야 이행이고, 이 알림은 수신자에게 **행동(서명)까지 요구**한다. 넷 모두 사용자가 모르면 법정 의무 미이행이나 업무 중단으로 직결된다. v1에는 수신 설정 화면 자체가 없으므로(NTF-06 이월) 이 구분은 데이터 속성으로만 존재하고 화면에는 드러나지 않는다.
- **민감정보 포함 금지 플래그는 타입 속성**이다. 명세서 발행 알림이 대표적이며 본문에 금액을 넣지 않고 화면 링크만 담는다.
- 타입 카탈로그가 서버 고정이므로 **알림 생성 요청이 미정의 타입을 쓰면 거부**한다.

## 관련 테이블

**notification_types**(타입 lookup — 코드·중요도·딥링크 대상·민감정보 금지·필수 여부·활성 여부) · **notifications**(알림 본체 — 수신자·사업장·타입·제목·본문·딥링크·페이로드·중요도·읽음 시각·삭제 시각). 명세 정본은 [../05_database/13_notification.md](../05_database/13_notification.md)이며 RLS 정책은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)가 정본이다.

**실시간 배달 채널과 인스턴스 간 fan-out은 관계형 테이블이 아니라 Redis pub/sub이 담당하고, 생성 실패의 재시도 큐도 같은 Redis에 둔다** — 배달과 재시도는 보존 대상이 아니고 알림 본체는 이미 테이블에 있으므로 채널은 전달만 한다. **알림 재시도 전용 테이블도 정기작업도 두지 않는다**(정기작업 8건 불변). 상세는 [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)가 정본이다.

## 에러 코드

| 코드 | HTTP | 발생 조건 |
|------|:----:|----------|
| notification.not_found | 404 | 알림 부재 또는 삭제된 알림 조회(NTF-03) |
| notification.forbidden | 403 | 필수 알림 해제·삭제 등 본인 알림에 대한 불허 조작 — 타인 알림 접근(조회·조작)은 notification.not_found/404로 존재를 은닉한다(NTF-03) |
| notification.unknown_type | 400 | 미정의·비활성 타입으로 알림 생성 시도(NTF-04) |
| device_token.invalid | 400 | 푸시 토큰·플랫폼 형식 오류 — **v1 발생 지점이 없다**(푸시는 v1.1 이월 · 코드만 예약)(NTF-01) |
| notification.mandatory_pref | 409 | 필수 알림 5종(법정 교부 2 · 보안·계정 정지 · 사업장 정지 · 공지)의 수신 거부 시도(NTF-04 · SLP-06) |

- **device_token.invalid는 v1 표면에서 발생하지 않는다** — 푸시(NTF-02)가 v1.1 이월이라 기기 토큰을 등록하는 경로 자체가 없다. 코드 자체의 등재는 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)가 정한다.
- **notification.mandatory_pref는 v1에서 수신 설정 화면이 없어 사용자 조작으로는 도달하지 않는다.** 서버 API 계약에는 남겨 두어 이월 기능이 들어올 때 규약이 이미 고정돼 있게 한다.
- 전수 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)다.

## 연계 도메인

| 도메인 | 연계 내용 |
|--------|-----------|
| [07_payslip.md](./07_payslip.md) | 명세서 발행 알림은 **필수 알림**이며 본문에 금액을 담지 않는다. 앱 미설치자 대체 경로는 SLP-06이 담당한다 |
| [02_workplace.md](./02_workplace.md) | 초대 수신·수락·거절·취소·만료와 역할 변경·멤버 제외 알림의 발화처다. **검증 대기 기한 경과 자동 정지(WRK-14)가 필수 알림 workplace_suspended를 발화**한다 |
| [04_attendance.md](./04_attendance.md) · [05_leave.md](./05_leave.md) | 승인 요청·승인·반려 알림이 승인 흐름의 도달 경로다 |
| [06_payroll.md](./06_payroll.md) · [08_tax.md](./08_tax.md) · [09_compliance.md](./09_compliance.md) | 급여 확정과 법정 기한 임박 경보가 알림으로 나간다 |
| [01_auth.md](./01_auth.md) | 계정 정지 알림은 수신 거부가 불가능한 필수 알림이다 |
| [11_subscription.md](./11_subscription.md) · [12_system.md](./12_system.md) | 구독 만료 임박 안내와 플랫폼 공지의 발화처다. **플랫폼 제재 정지(SYS-03)도 workplace_suspended를 발화**하며 계정 정지(SYS-04)와 대상 축이 다르다 |
| [15_scheduled_jobs.md](./15_scheduled_jobs.md) | checkSubscriptionExpiry · checkComplianceDeadlines · recomputeEmployeeCountSnapshot · retryPayslipAndPush가 알림을 만든다 |

## 관련 문서

- 요구사항 정본: [../03_requirements/11_notification.md](../03_requirements/11_notification.md)
- 화면 정본: [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md)(APP-NOTIFICATION — NTF-01·03. NTF-04 타입 카탈로그는 서버 고정이라 관리 화면이 없다)
- 데이터 정본: [../05_database/13_notification.md](../05_database/13_notification.md)
- API 정본: [../06_api/12_notification.md](../06_api/12_notification.md)
- 실시간·파일 아키텍처: [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)
