# 06_api / 12 알림 (NTF)

> **대상**: NTF 도메인 표면 — SSE 인앱 알림 배달과 유실 보충 · 알림 목록과 미읽음 카운트 · 읽음 처리 · 타입 카탈로그와 필수 알림 불변식 · 알림 생성의 서버 내부 종점
> **작성일**: 2026-08-03
> **개정일**: 2026-09-12 — **deeplink_target · label_key 24종 채번**(M-7 · L-5 감사 보정) 반영 — 딥링크 경로의 정본이 **"웹 URL 형식"**(예 /attendance · /payslips)임을 명시하고 목록 예시의 "/me/payslips/…"를 정본 형식 "/payslips/…"로 갱신한다. 값 전수와 형식 결정의 근거는 [../05_database/13_notification.md](../05_database/13_notification.md) "딥링크 대상 · 표시 그룹" 절. 표면 수 7 · 타입 24종은 불변
> **개정일**: 2026-09-07 — 알림 타입 **22 → 24종** · 필수 **4 → 5종** 인용 갱신(V0717 — **contract_sent**(필수) · **contract_signed** 채번. 정본 [../05_database/13_notification.md](../05_database/13_notification.md) · REQ 정본 [../03_requirements/11_notification.md](../03_requirements/11_notification.md)). **contract_sent가 필수인 근거는 법정 교부**다 — 근로기준법 §17② 교부는 발송이 성립해야 이행이므로 채널이 막히면 증적만 남고 이행이 없다. 법정 교부 축이 명세서 하나에서 **둘**이 된다
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정 — **알림 중요도(priority) 4값을 표면 계약에 등재**(ENUM-1). 값 집합의 정본은 [../05_database/13_notification.md](../05_database/13_notification.md)의 CHECK이며 본 문서가 등재만 하지 않아 클라이언트 계약이 3값으로 굳는 드리프트가 생겼다. **표면 수는 7로 불변**이다
> **개정일**: 2026-08-08 — SSE 구독 단위를 수신자 고정 단일 스트림으로 명문화하고 사업장 구독 어휘를 서버 내부 채널 축으로 한정
> **원천**: [../03_requirements/11_notification.md](../03_requirements/11_notification.md)(REQ-NTF-01~06 · 타입 24종) · [../02_features/10_notification.md](../02_features/10_notification.md)(NTF 3기능) · [../03_requirements/08_payslip.md](../03_requirements/08_payslip.md)(REQ-SLP-13·14 법정 교부 우선) · [../08_tech_stack/03_backend.md](../08_tech_stack/03_backend.md)(SSE + Redis Pub/Sub)

v1은 **인앱 알림만** 제공한다. 푸시(FCM) · 알림 삭제 · 알림 설정은 v1에 두지 않으므로 그 표면을 만들지 않는다. 채널이 하나이므로 **법정 교부 알림은 어떤 설정으로도 끌 수 없다** — 끄는 표면 자체가 없다.

**이 도메인은 SSE 표면을 갖는 유일한 도메인**이다(#1). 다른 도메인에 스트림을 추가하지 않으며, 실시간이 필요해 보이는 근태 현황도 v1 범위 밖이라 열지 않는다([01_conventions.md](./01_conventions.md)).

**알림은 계정 단위 자원**이라 사업장 스코프 경로 밖에 있다. 사업장 필터는 쿼리 파라미터이며 수신자 격리는 2차 방어가 강제한다 — 수신자 본인만 조회·갱신할 수 있고 타인 알림은 존재 자체를 노출하지 않는다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 전 표면이 /v1/notifications 또는 /v1/notification-types다. **사업장 스코프 경로를 쓰지 않는다** — 계정 단위 알림(초대 · 계정 정지)은 workplace_id가 비어 있을 수 있다 |
| 권한 축 | 수신자 본인 전용이다. 관리자가 타인 알림을 읽는 표면이 없다 |
| 격리 | 2차 방어가 **recipient_user_id가 요청자인 행만** 조회·갱신을 허용한다. **타인 알림은 조회·조작 모두 notification.not_found/404**이며 403을 쓰지 않는다 — 403은 그 알림이 존재한다는 사실을 알려 준다. notification.forbidden은 본인 알림에 대한 불허 조작 전용이다 |
| 본문 제약 | **급여·개인정보 상세를 본문과 payload에 포함하지 않는다.** 링크만 담고 실제 값은 인가를 통과한 화면에서 본다(REQ-NTF-01) |
| 생성 실패 격리 | **알림 생성 실패가 원 이벤트를 롤백하지 않는다.** 급여 확정이 알림 실패로 되돌아가서는 안 되므로 실패는 재시도 큐로 넘긴다 |
| 멱등 | Idempotency-Key 대상 표면이 없다. **중복 읽음은 멱등 성공**으로 처리한다 |
| 페이지네이션 | 커서 1표면(#2)뿐이다. 시간 역순 무한 증가 목록이라 오프셋은 새 행 삽입 시 행을 흘린다 |
| 필수 알림 | is_mandatory 타입 5종(법정 교부 **2종** — 명세서 발행 · 근로계약 발송 · 보안 · 계정 정지 · 사업장 정지)은 **어떤 설정으로도 끌 수 없다.** 거부 시도는 notification.mandatory_pref/409이며 **v1은 알림 설정 기능 자체가 없어 발생 지점이 없다** |
| 미정의 타입 | 미정의·비활성 타입 생성은 notification.unknown_type/400으로 차단한다. 클라이언트는 알 수 없는 타입을 **안전한 기본 UI**로 표시한다 |
| 중요도 | priority는 **LOW · NORMAL · HIGH · URGENT 4값**이다. 값 집합의 정본은 [../05_database/13_notification.md](../05_database/13_notification.md)의 CHECK(notification_types · notifications 양쪽)이며 **enum 타입이 아니라 text + CHECK 축**이라 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) 33종에 들지 않는다. 표시 규칙만 클라이언트가 갖고 **값 집합을 클라이언트가 좁히지 않는다** |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | SSE | GET /v1/notifications/stream | 본인 | — | NTF-01 |
| 2 | REST | GET /v1/notifications | 본인 | 커서 | NTF-03 |
| 3 | REST | GET /v1/notifications/unread-count | 본인 | — | NTF-03 |
| 4 | REST | POST /v1/notifications/{notificationId}/read | 본인 | — | NTF-03 |
| 5 | REST | POST /v1/notifications/read-all | 본인 | — | NTF-03 |
| 6 | REST | GET /v1/notification-types | 본인 | — | NTF-04 |
| 7 | 서버 내부 | 도메인 이벤트 알림 생성 · Redis 채널 발행 | 시스템 | — | NTF-01 · NTF-04 |

- 7행 = SSE **1** · REST **5** · 서버 내부 **1**이다. 다운로드 표면은 없다.
- **알림 삭제·설정 표면을 두지 않는다.** deleted_at 컬럼은 카운트 제외 판정에만 쓰이며 v1에서 값을 채우는 경로가 없다.

## 상세

### 1. GET /v1/notifications/stream — SSE 인앱 알림 배달 (NTF-01)

```plain
연결 수립
├─ 인증          웹 = 세션 쿠키(D-03) · 앱 = Authorization 헤더
│                **쿼리 파라미터로 토큰을 받지 않는다** — 접근 로그와 리퍼러에 남는다
├─ 스코프 고정    recipient_user_id를 연결에 박는다. 이후 이벤트는 그 수신자 것만 흐른다
├─ 채널 구독      **서버 내부** Redis 채널 구독. 각 인스턴스가 자기가 붙든 연결에만 전달한다(다중 인스턴스 fan-out)
│                클라이언트에는 구독 개념이 없다 — 연결 하나가 곧 스코프다
└─ 하트비트      주기적 코멘트 프레임으로 프록시 타임아웃을 막는다

이벤트 페이로드
└─ id · type · title · deeplink · workplaceId · priority · createdAt
   **본문 상세·금액·개인정보를 싣지 않는다**
```

| 항목 | 규약 |
|------|------|
| 방향 | 서버 → 클라이언트 **단방향**이다. 클라이언트 발신은 전부 REST다 |
| 유실 보충 | **미연결 중 발생분은 재접속 시 #2 목록 조회로 보충한다.** 스트림을 정본으로 삼지 않는다 — 알림 원장의 정본은 서버 목록이다 |
| 재연결 | 클라이언트가 지수 백오프로 재연결하고 성립 직후 #2와 #3을 다시 부른다 |
| 사업장 필터 | 연결은 수신자 단위이고 **사업장 필터는 클라이언트가 payload의 workplaceId로 가른다.** 사업장별 연결을 나누면 전환 때마다 스트림을 다시 맺어야 한다 |
| 구독 단위 | **수신자 고정 단일 스트림 하나뿐이다.** 사업장 구독·구독 해제·재구독 표면이 없고 사업장 전환(WRK-06)이 연결을 다시 맺게 하지 않는다. 사용자·사업장 분리는 **서버 내부 Redis 채널의 축**이며 클라이언트 계약에 드러나지 않는다 |
| 프록시 | nginx가 이 경로의 버퍼링을 끄고 타임아웃을 길게 잡는다([../08_tech_stack/04_data_infra.md](../08_tech_stack/04_data_infra.md)) |
| 인증 만료 | 스트림 중 토큰이 만료되면 서버가 연결을 닫는다. 클라이언트는 재인증 후 다시 맺는다 |

- **WebSocket을 쓰지 않는 근거**는 방향이다. 실시간이 서버→클라이언트 단방향뿐이라 양방향 프로토콜의 연결 관리·하트비트·재연결 복잡도를 감당할 이유가 없다.
- **페이로드를 믿고 화면을 그리지 않는다.** 목록 무효화 신호로만 쓰고 상세는 #2가 준다 — 그래야 인가 판정을 거친 값만 화면에 오른다.

### 2·3. 알림 목록·미읽음 카운트 (NTF-03)

```json
{
  "items": [
    {
      "id": "…",
      "type": "payslip_issued",
      "title": "2026년 7월 임금명세서가 발행되었습니다",
      "body": "명세서 화면에서 확인하세요",
      "deeplink": "/payslips/…",
      "workplaceId": "…",
      "priority": "HIGH",
      "readAt": null,
      "createdAt": "2026-08-10T00:12:00Z"
    }
  ],
  "page": { "size": 20, "nextCursor": "…", "hasMore": true }
}
```

| 항목 | 2. 목록 | 3. 미읽음 카운트 |
|------|--------|-----------------|
| 입력 | workplaceId(선택 필터) · type · unreadOnly · cursor · size | workplaceId(선택) · groupBy(type · workplace) |
| 정렬 | created_at 내림차순 · id 내림차순(안정 정렬) | — |
| 응답 | 위 예시 | 총 미읽음 수와 그룹별 분해 |
| 제외 | 삭제된 알림은 목록과 카운트에서 제외한다 | 위와 동일 |
| 실패 | **notification.not_found/404**(타인 알림 — 존재 은닉) | — |

- **알림 본문에 금액 상세를 포함하지 않는다.** 위 예시의 payslip_issued도 금액 없이 링크만 담는다(REQ-SLP-13).
- 커서를 쓰는 근거는 목록의 성질이다 — 시간 역순으로 무한히 쌓이고 조회 중에도 새 알림이 앞에 들어오므로 오프셋은 같은 행을 두 번 주거나 건너뛴다([01_conventions.md](./01_conventions.md)).
- **priority는 4값(LOW · NORMAL · HIGH · URGENT)이며 클라이언트가 부분 집합으로 파싱하지 않는다.** 값 집합을 좁혀 두면 서버가 넓은 값을 내보내는 순간 **목록 응답 전체가 파싱 경계에서 실패**해 알림 화면이 통째로 비는데, 알림에는 법정 교부 통지가 섞여 있다. 알 수 없는 값은 타입 카탈로그의 미정의 타입과 같은 원칙으로 **안전한 기본 표시**로 떨어뜨린다(REQ-NTF-06).
- **priority는 생성 시점에 타입 카탈로그 값을 복사해 고정한다**(#7). 카탈로그의 중요도를 나중에 바꿔도 이미 발송된 알림의 값은 그대로다 — 정합 강제는 서비스 책임이며 제약으로 표현하지 않는다([../05_database/13_notification.md](../05_database/13_notification.md)).
- **workplaceId는 필터일 뿐 스코프가 아니다.** 계정 단위 알림(초대 수신 · 계정 정지 · 시스템 공지)은 workplaceId가 비어 있으며 필터를 걸면 그 알림들이 사라진다 — 그래서 필터는 선택이고 기본은 전체다.

### 4·5. 읽음 처리 (NTF-03)

| 항목 | 4. 단건 읽음 | 5. 일괄 읽음 |
|------|-------------|-------------|
| 입력 | — | workplaceId(선택) · type(선택) · beforeCreatedAt(선택) |
| 처리 | read_at을 기록한다 | 조건에 맞는 미읽음 알림의 read_at을 일괄 기록한다 |
| 멱등 | **중복 읽음은 멱등 성공**이다(204). 이미 읽은 알림에 대한 요청이 오류가 되지 않는다 | 위와 동일. 대상이 0건이어도 성공이다 |
| 응답 | 204 | 204 + 처리 건수 |
| 실패 | **notification.not_found/404**(미존재·타인·삭제) · notification.forbidden/403(본인 알림의 불허 조작) | — |

- **읽지 않음으로 되돌리는 표면을 두지 않는다.** read_at은 단조 증가 상태이며 되돌릴 업무 이유가 없다.
- #5의 beforeCreatedAt은 "지금 화면에 보이는 것까지만 읽음" 동작을 위한 것이다. 없으면 요청 처리 중 도착한 새 알림까지 읽음이 되어 사용자가 놓친다.

### 6. GET /v1/notification-types — 타입 카탈로그 (NTF-04)

| 항목 | 내용 |
|------|------|
| 응답 | code · priority(**LOW · NORMAL · HIGH · URGENT**) · deeplink 대상 · 표시 문구 키 · 민감정보 포함 금지 여부 · **isMandatory** · isActive |
| 용도 | 클라이언트 라우팅 맵과 표시 규칙의 원천이다. **새 타입 추가는 DB lookup과 클라이언트 라우팅 맵을 함께 갱신**한다 |
| 비활성 | **미사용 타입은 삭제하지 않고 비활성화**한다. 삭제하면 과거 알림의 type이 미정의가 된다 |
| 관리 권한 | 조회는 인증 사용자 전원, **생성·변경은 플랫폼(ADMIN)** 소관이며 v1은 마이그레이션 시드로만 관리한다([14_system.md](./14_system.md)) |

v1 알림 타입은 **24종**이다.

| 그룹 | 타입 | 수 |
|------|------|:--:|
| 초대 | invite_received · invite_accepted · invite_rejected · invite_cancelled · invite_expired | 5 |
| 멤버 | role_changed · member_removed · **account_suspended(필수)** | 3 |
| 사업장 | **workplace_suspended(필수)** — 검증 대기 기한 경과 자동 정지·플랫폼 제재 정지를 OWNER에게 통보 | 1 |
| 인사 | hr_info_change_requested | 1 |
| 근태 | attendance_anomaly · attendance_change_requested · attendance_approved · attendance_rejected | 4 |
| 휴가 | leave_requested · leave_approved · leave_rejected | 3 |
| 급여·명세서 | payroll_confirmed · **payslip_issued(필수)** | 2 |
| **근로계약** | **contract_sent(필수)** · **contract_signed** | **2** |
| 기한 | compliance_deadline | 1 |
| 구독 | subscription_notice | 1 |
| 공지 | **system_notice(필수)** | 1 |

검산: 5 + 3 + 1 + 1 + 4 + 3 + 2 + **2** + 1 + 1 + 1 = **24**. 필수(is_mandatory)는 account_suspended · workplace_suspended · payslip_issued · contract_sent · system_notice **5종**이다 — **법정 교부 축이 명세서 하나에서 근로계약을 더해 둘이 된다.**

- **클라이언트는 알 수 없는 타입을 안전한 기본 UI로 표시한다**(REQ-NTF-06). 앱 스토어 배포 지연으로 서버가 먼저 새 타입을 내보낼 수 있어서다.
- 미정의·비활성 타입으로 알림을 만들려는 시도는 **notification.unknown_type/400**으로 서버가 차단한다.
- **중요도 4값과 필수 알림 5종은 다른 축이다.** priority는 표시 우선순위이고 isMandatory는 수신 거부 불가 여부다 — URGENT가 곧 필수 알림이 아니고 필수 알림이 반드시 URGENT인 것도 아니다.

### 7. 도메인 이벤트 알림 생성 (서버)

| 항목 | 내용 |
|------|------|
| 발화 | 각 도메인의 상태 전이 트랜잭션 — 초대·역할·제외([04_workplace.md](./04_workplace.md)) · 인사 변경 요청([05_hr.md](./05_hr.md)) · 근태 승인([06_attendance.md](./06_attendance.md)) · 휴가 승인([07_leave.md](./07_leave.md)) · 급여 확정([08_payroll.md](./08_payroll.md)) · 명세서 발행([09_payslip.md](./09_payslip.md)) · 기한 경보([10_tax.md](./10_tax.md)) · 구독 안내([13_subscription.md](./13_subscription.md)) · 계정 정지([14_system.md](./14_system.md)) |
| 순서 | **저장을 먼저 하고 Redis 채널에 발행한다.** 발행 후 저장하면 전달 실패가 곧 기록 누락이 된다 |
| 타입 검증 | notification_types lookup에 없거나 비활성이면 생성하지 않는다 → notification.unknown_type/400 |
| 실패 격리 | **알림 생성 실패는 원 이벤트를 롤백하지 않고** 재시도 큐에 기록한다. 급여 확정이 알림 실패로 되돌아가서는 안 된다(REQ-NTF-02) |
| 본문 제약 | 생성 시점에 **금액·개인정보 상세를 title·body·payload에 넣지 않는다.** 링크만 담는다 |
| 법정 교부 | **payslip_issued는 수신 거부로 생략되지 않는다.** 명세서 목록 생성도 마찬가지다(REQ-SLP-14) |
| 표면 없음 근거 | 알림 생성은 도메인 이벤트의 부수효과다. 사용자가 임의로 알림을 만드는 경로를 열면 타인에게 알림을 밀어 넣을 수 있다 |

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| notification.not_found | 404 | 알림 부재 **또는 타인 알림(조회·조작 모두) — 행 존재 은닉**. 타인 자원 접근은 403이 아니라 404로 통일한다 | #2 · #4 · #5 |
| notification.forbidden | 403 | 필수 알림 해제·삭제 등 **본인 알림에 대한 불허 조작**. 대상이 본인 알림임을 이미 아는 상태의 권한 판정이며 **타인 알림 접근은 notification.not_found/404**다 | #4 |
| notification.unknown_type | 400 | 미정의·비활성 알림 타입 생성 시도 | #7 |
| notification.mandatory_pref | 409 | 필수 알림 5종(법정 교부 2 · 보안 · 계정 정지 · 사업장 정지) 수신 거부 시도 — **v1 발생 지점 없음**(알림 설정 미채택 · 불변식 명시용 예약) | 없음 |
| device_token.invalid | 400 | 푸시 토큰·플랫폼 형식 오류 — **v1 발생 지점 없음**(푸시 미채택 · 코드만 예약) | 없음 |
| auth.token_invalid | 401 | SSE 연결 중 토큰 만료·revoke — 서버가 연결을 닫는다 | #1 |
| common.validation_failed | 400 | 커서 형식 오류 · 요청 본문·쿼리 검증 실패 | #2 · #3 · #5 |

- **notification 4종과 device_token 1종 전량이 이 표에 있다.** 그중 둘은 v1에 발생 지점이 없으며, 불변식을 명시하기 위해 예약된 상태다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| notifications | #7 INSERT · #1 · #2 · #3 SELECT · #4 · #5 UPDATE | 알림 원장 — recipient_user_id 격리 · deeplink · **priority(CHECK 4값)** · read_at · deleted_at |
| notification_types | #6 SELECT · #7 검증 | 타입 카탈로그 lookup — **priority(CHECK 4값 · 복사 원천)** · is_mandatory · is_active · 민감정보 포함 금지 여부 |
| users · profiles | #1 · #7 SELECT | 수신자 식별 — recipient_user_id의 참조 대상 |
| workplaces | #2 · #3 SELECT | 사업장 필터의 스코프. **계정 단위 알림에서는 비어 있을 수 있다** |

## 추적성

기능명·우선순위의 정본은 [../02_features/10_notification.md](../02_features/10_notification.md)다.

| 기능ID | 표면 |
|--------|------|
| NTF-01 인앱 알림 배달 | #1 · #7(서버) |
| NTF-03 알림 목록·읽음 | #2 · #3 · #4 · #5 |
| NTF-04 알림 타입 | #6 · #7(서버 · 타입 검증) |

**NTF 3기능 전수를 담았다**(위 표 3행). NTF-01은 배달 표면(SSE)과 생성 종점(서버)을 함께 가지며 유실 보충은 NTF-03의 목록 표면이 겸한다.

## 관련 문서

- 전역 규약·SSE 규약·커서 페이지네이션 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/10_notification.md](../02_features/10_notification.md)
- 요구사항 정본 → [../03_requirements/11_notification.md](../03_requirements/11_notification.md)
- 발행 알림·법정 교부 우선 → [09_payslip.md](./09_payslip.md) · 초대·역할·제외 알림 발화 → [04_workplace.md](./04_workplace.md) · 구독 안내 알림 → [13_subscription.md](./13_subscription.md) · 타입 관리 권한 → [14_system.md](./14_system.md)
- 실시간 배달 채널·pub/sub 설계 → [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)
- **중요도 4값의 정본** → [../05_database/13_notification.md](../05_database/13_notification.md) · text + CHECK 축의 위임 근거 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)
- 테이블 명세 → [../05_database/13_notification.md](../05_database/13_notification.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
