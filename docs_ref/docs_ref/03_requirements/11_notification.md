# REQ-NTF — 알림 요구사항

> **대상**: 알림 스키마와 수신자 격리 · 실시간 배달과 유실 방지 · 목록/페이지네이션 · 읽음과 미읽음 카운트 · 타입 카탈로그 · 필수 알림 불변식
> **작성일**: 2026-08-03
> **개정일**: 2026-09-07 — REQ-NTF-05 타입 전수에 **contract_sent · contract_signed 2종을 등재**한다(V0717 채번) — 22 → **24종** · 필수 4 → **5종**. [../06_api/05_hr.md](../06_api/05_hr.md) 연동 표가 #22 · #25에 알림을 이미 계약했는데 카탈로그에 코드가 없어 **type FK가 그 발송을 막던** 자리다. **contract_sent가 필수인 근거는 법정 교부**이며 REQ-NTF-06의 필수 4종 서술도 **5종**으로 함께 고쳤다. REQ 채번·건수는 전건 불변
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 재시도 큐 소관을 Redis로 확정 · 비활성 타입 생성 차단의 강제 위치를 가드로 명시 · 사용자 조작 컬럼을 read_at으로 한정(알림 삭제 v1 제외)
> **원천**: docs_ref2/requirements_p0.md NTF 절(REQ-NTF-01~06) · docs_ref2/features_p0.md(NTF 3기능) · docs_ref2/schema_p0.md notification 2테이블 · 2026-08-08 DB 커버리지 감사

v1은 **인앱 알림만** 제공한다. 푸시(FCM)·알림 삭제·알림 설정은 v1에 두지 않는다. 그래서 알림 채널은 하나이며 **법정 교부 알림은 어떤 설정으로도 끌 수 없다**.

두 가지가 이 도메인의 불변식이다. 첫째, **알림 본문에 급여·개인정보 상세를 담지 않는다** — 링크만 담고 실제 값은 인가를 통과한 화면에서 본다. 둘째, **알림 생성 실패가 원 이벤트를 롤백하지 않는다** — 급여 확정이 알림 실패로 되돌아가서는 안 되므로 실패는 재시도 큐로 넘긴다.

수신자 격리는 2차 방어에서 강제한다 — 수신자 본인만 조회·갱신할 수 있고 타인 알림은 존재 자체를 노출하지 않는다. 전역 계약은 [01_global_rules.md](./01_global_rules.md)를 전제한다.

## NTF-01 인앱 알림 배달  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-NTF-01 | 알림 스키마·격리 | notifications(id · recipient_user_id · workplace_id(nullable) · type · title · body · deeplink · payload(json) · priority ∈ LOW·NORMAL·HIGH·URGENT · read_at · deleted_at · created_at)를 정의한다. **2차 방어는 recipient_user_id가 요청자인 행만 조회·갱신을 허용**하고 **사용자가 갱신할 수 있는 컬럼은 read_at 하나다** — deleted_at은 서버 정리 경로 전용이다(알림 삭제(NTF-05)를 v1에 두지 않는다). **급여·개인정보 상세를 본문과 payload에 포함하지 않으며** 그 판정과 priority의 카탈로그 값 복사 정합은 서비스가 강제한다 | 본인 | P0 |
| REQ-NTF-02 | 실시간 배달·유실 방지 | 수신자는 본인 알림 채널을 구독해 즉시 수신한다(다중 서버 인스턴스 fan-out이 필요하다). **미연결 중 발생분은 재접속 시 목록 조회로 보충**한다. **알림 생성 실패는 원 이벤트를 롤백하지 않고** 재시도 큐에 기록한다 — 급여 확정이 알림 실패로 되돌아가서는 안 된다. **재시도 큐는 Redis에 두고 관계형 테이블을 만들지 않는다** — 성공하면 사라지는 휘발성 항목이고 알림 본체는 성공 시점에 notifications 행으로 남는다(정본 [../05_database/13_notification.md](../05_database/13_notification.md)). v1은 인앱 알림만 제공하고 푸시는 v1에 두지 않으므로 **기기 토큰을 등록·정리하는 경로도 두지 않는다** | 본인 · 시스템 | P0 |

## NTF-03 알림 목록·읽음  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-NTF-03 | 목록·페이지네이션 | 본인 알림을 최신순으로 페이지네이션 조회하고 **현재 사업장 필터**를 지원한다. **타인 알림은 조회·조작을 가리지 않고 모두 notification.not_found/404**로 응답해 **행 존재 자체를 숨긴다** — 403으로 답하면 그 알림이 존재한다는 사실이 새어 나가므로 미존재·삭제된 알림과 같은 코드로 통일한다. **notification.forbidden/403은 본인 알림에 대한 불허 조작**(필수 알림 해제·삭제 시도 등)에만 쓴다 | 본인 | P0 |
| REQ-NTF-04 | 읽음·미읽음 카운트 | 단건·일괄 읽음 시 read_at을 기록하며 **중복 읽음은 멱등 성공**으로 처리한다. 미읽음 카운트(배지)는 타입·사업장별로 조회하고 **삭제된 알림은 카운트에서 제외**한다 | 본인 | P0 |

## NTF-04 알림 타입  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-NTF-05 | 타입 카탈로그 | notification_types를 lookup 테이블(code PK · priority · deeplink 대상 · 표시 문구 키 · 민감정보 포함 금지 여부 · is_mandatory · is_active)로 관리한다. v1 타입은 invite_received · invite_accepted · invite_rejected · invite_cancelled · invite_expired · role_changed · member_removed · **account_suspended(필수)** · **workplace_suspended(필수)** · hr_info_change_requested · attendance_anomaly · attendance_change_requested · attendance_approved · attendance_rejected · leave_requested · leave_approved · leave_rejected · payroll_confirmed · **payslip_issued(필수)** · **contract_sent(필수)** · **contract_signed** · compliance_deadline · subscription_notice · **system_notice(필수)**다. **workplace_suspended는 검증 대기 기한 경과에 따른 자동 정지(REQ-WRK-08)와 플랫폼 제재 정지(REQ-SYS-05)를 OWNER에게 통보**한다 — 사업장이 멈추면 근태·급여가 함께 멈추므로 사용자가 반드시 알아야 하고, 계정 정지(account_suspended)와 대상 축이 달라 코드를 겸용하지 않는다. **미정의·비활성 타입 생성은 notification.unknown_type/400**으로 차단한다 — **미정의는 FK가, 비활성은 가드가 막는다**(FK는 code의 존재만 검사하므로 is_active 재검증이 따로 필요하다 — 정본 [../05_database/13_notification.md](../05_database/13_notification.md)) | 시스템 | P1 |
| REQ-NTF-06 | 타입 관리·필수 알림 | 새 타입 추가는 DB lookup과 클라이언트 라우팅 맵을 **함께** 갱신한다. **미사용 타입은 삭제하지 않고 비활성화**한다. 클라이언트는 알 수 없는 타입을 안전한 기본 UI로 표시한다. **법정 교부·보안·계정 정지·사업장 정지 알림(is_mandatory 5종)은 어떤 설정으로도 끌 수 없다** — 거부 시도는 **notification.mandatory_pref/409**다 | 플랫폼(ADMIN) · 시스템 | P1 |

검산: v1 알림 타입 **24종** — 초대 계열 5(invite_received · invite_accepted · invite_rejected · invite_cancelled · invite_expired) · 멤버·계정 계열 3(role_changed · member_removed · account_suspended) · 사업장 1(workplace_suspended) · 인사 1(hr_info_change_requested) · 근태 4(attendance_anomaly · attendance_change_requested · attendance_approved · attendance_rejected) · 휴가 3(leave_requested · leave_approved · leave_rejected) · 급여·명세서 2(payroll_confirmed · payslip_issued) · **근로계약 2(contract_sent · contract_signed)** · 기한 1(compliance_deadline) · 구독 1(subscription_notice) · 공지 1(system_notice) = 5 + 3 + 1 + 1 + 4 + 3 + 2 + **2** + 1 + 1 + 1 = **24**. 필수(is_mandatory)는 account_suspended · workplace_suspended · payslip_issued · **contract_sent** · system_notice **5종**이다 — **법정 교부 축이 명세서 하나에서 근로계약을 더해 둘이 된다.** 근로기준법 §17② 교부는 **발송이 성립해야 이행**이라 채널이 막히면 증적만 남고 이행이 없다. contract_signed는 관리자 수신 진행 통지라 필수가 아니다.

**인앱 알림은 사용자 대면 통보 전용이다.** 배치 실패 · dead letter · 메일 발송 반복 실패 같은 **운영 실패는 인앱 알림으로 보내지 않고 관측 채널(에러 추적·로그 경보)로 통보**한다(REQ-TEC-09 · ADR-23) — 수신자가 사용자가 아니라 운영자이고, notifications는 recipient_user_id 축이라 운영자 집단을 담을 수 없다. 반대로 **사업장 자동 정지처럼 사용자의 업무가 멈추는 사건은 인앱 필수 통보**다.

## 관련 테이블

| 테이블 | 역할 |
|--------|------|
| notifications | 알림 원장 — 수신자 격리 · deeplink · priority · read_at · deleted_at(REQ-NTF-01·04) |
| notification_types | 타입 카탈로그 lookup — is_mandatory · is_active · 민감정보 포함 금지 여부(REQ-NTF-05·06) |
| users · profiles | 수신자 식별 — recipient_user_id의 참조 대상 |
| workplaces | 사업장 필터의 스코프 — workplace_id는 계정 단위 알림에서 비어 있을 수 있다(REQ-NTF-03) |

## 관련 화면

| 화면 코드 | 화면명 |
|-----------|--------|
| APP-NOTIFICATION | 알림함 |

검산: 1본 — APP 1. **관리자 웹에는 독립 알림함 화면을 두지 않으며** 헤더 알림 벨 오버레이가 같은 알림 원장을 제공한다(규격 정본 [../07_screen/01_standards.md](../07_screen/01_standards.md)). 배달 배지·미읽음 카운트는 전 인증 화면의 셸에 걸리는 (전역) 축이고, 타입 카탈로그(NTF-04)는 관리 화면 없는 (서버) 축이다.

기능→화면 전수 매핑 정본은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)다.

## 에러 코드

| 에러 코드 | HTTP | 발생 조건 |
|-----------|:--:|----------|
| notification.not_found | 404 | 알림 없음 · 삭제된 알림 · **타인 알림의 조회와 조작 전부** — 행 존재 은닉(REQ-NTF-03) |
| notification.forbidden | 403 | **본인 알림에 대한 불허 조작** — 필수 알림 해제·삭제 시도 등. 타인 알림에는 쓰지 않는다(REQ-NTF-03 · REQ-NTF-06) |
| notification.unknown_type | 400 | 미정의·비활성 알림 타입 생성 시도(REQ-NTF-05) |
| notification.mandatory_pref | 409 | 필수 알림 5종(법정 교부 **2종** — 명세서 발행 · 근로계약 발송 · 보안 · 계정 정지 · 사업장 정지) 수신 거부 시도(REQ-NTF-06 · REQ-SLP-14) |
| device_token.invalid | 400 | 푸시 토큰·플랫폼 형식 오류 — **v1 발생 지점 없음**(푸시 미채택 · 코드만 예약) |

검산: notification 4 + device_token 1 = **5종**. v1은 알림 설정 기능 자체가 없어 notification.mandatory_pref의 실제 발생 지점이 없으나 REQ-SLP-14의 불변식을 명시하기 위해 예약한다.

## 관련 문서

- [../02_features/10_notification.md](../02_features/10_notification.md) — NTF 3기능 명세 정본
- [01_global_rules.md](./01_global_rules.md) — 멱등성·에러 규약
- [08_payslip.md](./08_payslip.md) — 명세서 발행 알림·법정 교부 우선(REQ-SLP-13·14)
- [03_workplace.md](./03_workplace.md) — 초대·역할 변경·멤버 제외 알림의 발화 지점
- [12_subscription.md](./12_subscription.md) — 구독 안내 알림의 발화 지점
- [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md) — 실시간 배달 채널·pub/sub 설계
- [../05_database/13_notification.md](../05_database/13_notification.md) — 알림 테이블 명세
- [../06_api/12_notification.md](../06_api/12_notification.md) — 알림 API 표면
