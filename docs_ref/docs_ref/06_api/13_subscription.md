# 06_api / 13 구독 (SUB)

> **대상**: SUB 도메인 REST 표면 — 요금제 목록 · 계정 구독 등급과 상태 · 사용량 2축 조회 · 사업장 등록 게이팅 · 활성 멤버 한도 게이팅 · 사업장 측 한도 표시 · 구독 상태 일일 점검
> **작성일**: 2026-08-03
> **개정일**: 2026-09-09 — **subscription.upgrade_required를 v1 미발생으로 등재**한다 — 발생 지점을 #5 · #6에 두고 있었으나 **같은 표가 같은 두 조건을 이미 workplace_limit_exceeded · staff_limit_exceeded에 배정**하고 있어 **같은 사유에 코드가 둘**이었다. 좁은 두 코드가 이긴다 — 넓은 코드로 폴백하지 않는다. **폐기하지 않고 미발생으로 두는 이유는 한도 축이 늘면 그때 쓸 자리이기 때문**이다. **에러 코드 119종 · 표면 수 7 · 번호는 전건 불변**
> **개정일**: 2026-08-09 — 요금제 목록 예시의 version 표기를 문자열 "1.0" → 정수 1로 정정(plans.version 은 integer 이며 CHECK 로 1 이상을 강제한다. 정본 [../05_database/14_subscription.md](../05_database/14_subscription.md))
> **개정일**: 2026-08-08 — v1은 기능 플래그를 쓰지 않고 등급 차이가 한도 2축뿐임을 명시(업그레이드 필요 코드의 발생 사유를 한도 초과로 한정) · 요금제 버전 재설계에 따라 구독의 요금제 참조를 plan_id로 정정
> **원천**: [../03_requirements/12_subscription.md](../03_requirements/12_subscription.md)(REQ-SUB-01~09) · [../02_features/11_subscription.md](../02_features/11_subscription.md)(SUB 5기능) · [../03_requirements/03_workplace.md](../03_requirements/03_workplace.md)(REQ-WRK-29~31 한도 강제 지점) · [../README.md](../README.md) 고정 기준(요금제 3등급)

구독은 **계정 단위**다(사업장 단위가 아니다). 그래서 조회 표면이 /v1/me 아래 있고 사업장 스코프 경로에는 표시용 표면(#4) 하나만 둔다. 한도는 OWNER 측 두 축에만 적용된다 — **소유 사업장 수**와 **사업장당 활성 멤버 수**다. STAFF·MANAGER로서의 타 사업장 소속은 본인 구독과 무관하게 무료·무제한이다.

**게이팅과 표시가 같은 사용량 산출 헬퍼를 공유한다**(REQ-SUB-04). 화면이 "3/5 사용"이라 보여 주는데 등록이 막히면 사용자는 원인을 알 수 없으므로, 표시(#3 · #4)와 강제(#5 · #6)가 같은 계산을 쓴다.

**v1의 유료 전환은 수동 처리다.** PG 자동 결제와 업그레이드 요청 워크플로를 v1에 두지 않으므로 등급 변경 표면이 이 문서에 없고, 조정은 플랫폼 관리자 표면([14_system.md](./14_system.md))이 소유하며 사용자 화면은 문의 안내를 노출한다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 요금제 목록은 공개 경로, 구독·사용량은 /v1/me/…, 사업장 측 표시는 /v1/workplaces/{workplaceId}/subscription-status다 |
| 권한 축 | 미인증(요금제 목록) · 본인(구독·사용량) · MANAGER(사업장 측 표시). **등급 변경 표면이 없다** |
| 한도 2축 | **max_owned_workplaces**(OWNER로 등록 가능한 사업장 수)와 **max_staff_per_workplace**(사업장당 활성 멤버 수)다. **어떤 등급도 후자가 30을 초과할 수 없다**(상품 전역 상한) |
| 미설정 계정 | **구독이 설정되지 않은 계정은 FREE로 간주**한다. 구독 행 부재를 오류로 만들지 않는다 |
| 멱등 | Idempotency-Key 대상 표면이 없다. 이 도메인에 자원 생성 표면이 없기 때문이다 |
| 잠금 | 게이팅 판정 2종은 각각 **사용자 행 잠금**(사업장 등록)과 **사업장 행 잠금**(멤버 수락)으로 직렬화한다. 잠금 없이 한도만 조회하면 동시 요청이 모두 통과한다(REQ-GLB-15) |
| 이중 검증 | 활성 멤버 한도는 **초대 발송과 수락 양쪽**에서 본다. 대기 중 다른 초대가 수락되어 한도가 찰 수 있다 |
| 페이지네이션 | 목록 표면이 없다. 요금제는 3등급 고정이라 전량을 한 번에 준다 |
| 법정 우선 | **구독 만료를 이유로 법정 의무 이행을 막지 않는다.** 만료는 신규 생성과 유료 기능만 차단하고 기존 급여·명세서 등 법정 보존 데이터의 조회·교부는 그대로 열어 둔다 |
| 코드 축 | **권한 부족(403)과 한도 초과(402)를 분리**한다. 402는 결제·등급으로 풀리고 403은 역할로 풀린다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | GET /v1/plans | 미인증 | — | SUB-01 |
| 2 | REST | GET /v1/me/subscription | 본인 | — | SUB-02 · SUB-05 |
| 3 | REST | GET /v1/me/subscription/usage | 본인 | — | SUB-02 · SUB-03 · SUB-04 |
| 4 | REST | GET /v1/workplaces/{workplaceId}/subscription-status | MANAGER | — | SUB-04 |
| 5 | 서버 내부 | 사업장 등록 한도 게이팅 판정 | 시스템 | — | SUB-03 |
| 6 | 서버 내부 | 활성 멤버 한도 게이팅 판정 | 시스템 | — | SUB-04 |
| 7 | 서버 내부 | 정기작업 checkSubscriptionExpiry(매일 00:10 KST) | 시스템 | — | SUB-05 |

- 7행 = REST **4** · 서버 내부 **3**이다. SSE·다운로드 표면은 없다.
- **요금제 정의·계정 구독 수동 조정 표면은 이 문서에 없다.** 플랫폼(ADMIN) 소관이며 [14_system.md](./14_system.md)가 소유한다.

## 상세

### 1. GET /v1/plans — 요금제 목록 (SUB-01)

```json
{
  "items": [
    { "code": "FREE",  "name": "무료",  "maxOwnedWorkplaces": 1, "maxStaffPerWorkplace": 5,  "price": "0",      "features": {}, "displayOrder": 1 },
    { "code": "PRO",   "name": "프로",  "maxOwnedWorkplaces": 3, "maxStaffPerWorkplace": 15, "price": "…",      "features": {}, "displayOrder": 2 },
    { "code": "ULTRA", "name": "울트라", "maxOwnedWorkplaces": 5, "maxStaffPerWorkplace": 30, "price": "…",      "features": {}, "displayOrder": 3 }
  ]
}
```

| 항목 | 내용 |
|------|------|
| 권한 | **미인증 공개**다. 공개 요금제 페이지(D-02)가 이 표면을 쓴다 |
| 범위 | is_active인 요금제만 반환하고 display_order 오름차순으로 정렬한다 |
| 버전 | 요금제 변경은 **새 버전 + effective_from**으로 관리한다 — 유일 키는 (code, version)이며 같은 code의 다버전이 구간으로 공존한다. 이 표면은 현재 시점 유효 버전만 주며 **version·effective_from을 응답에 담지 않는다** — REQ-SUB-01이 미인증 응답을 code · name · 한도 2축 · price · display_order로 한정하고 둘을 내부 운영 필드로 못박았다. 2026-09-07까지 이 절의 예시가 version을 싣고 있었고 구현이 그 미러를 따랐다 — **요구사항이 정본이다** |
| 기능 플래그 | **v1은 features를 쓰지 않는다.** 등급 차이는 **한도 2축**(maxOwnedWorkplaces · maxStaffPerWorkplace)뿐이며 features는 빈 객체로 나간다(REQ-SUB-01) |
| 삭제 금지 | **이미 참조된 요금제는 삭제하지 않는다.** 파괴적 변경 시도는 system.plan_in_use/409이며 발생 표면은 [14_system.md](./14_system.md)다 |
| 고정 기준 | 3등급의 한도 값은 [../README.md](../README.md) 고정 기준을 인용한다 — FREE(사업장 1 · 인원 5) · PRO(3 · 15) · ULTRA(5 · 30) |
| 가격 | 운영 설정값이며 금액이라 **문자열로 직렬화**한다 |

### 2·3. 계정 구독·사용량 조회 (SUB-02 · SUB-03 · SUB-04 · SUB-05)

```json
{
  "planCode": "PRO",
  "status": "ACTIVE",
  "startedAt": "2026-05-01T00:00:00Z",
  "expiresAt": "2027-05-01T00:00:00Z",
  "limits": { "maxOwnedWorkplaces": 3, "maxStaffPerWorkplace": 15 },
  "usage": {
    "ownedWorkplaces": { "used": 2, "limit": 3, "canRegister": true },
    "workplaces": [
      { "workplaceId": "…", "siteLabel": "본점",  "activeMembers": 12, "limit": 15, "canInvite": true },
      { "workplaceId": "…", "siteLabel": "2호점", "activeMembers": 15, "limit": 15, "canInvite": false }
    ]
  },
  "upgradeGuidance": { "manual": true, "message": "등급 변경은 문의 후 처리된다" }
}
```

| 항목 | 2. 구독 조회 | 3. 사용량 조회 |
|------|-------------|---------------|
| 응답 | planCode · status · startedAt · expiresAt · memo 없이 요약 | 위 예시의 limits · usage 전체 |
| 미설정 | 구독 행이 없으면 **FREE로 간주**해 응답한다. 404를 내지 않는다 | 위와 동일 |
| status | TRIAL · ACTIVE · PAST_DUE · EXPIRED · CANCELLED | — |
| 산출 축 | — | 소유 사업장 수는 **CLOSED를 제외**하고 센다. 활성 멤버 수는 OWNER·MANAGER·STAFF **전원**이다 |
| 공유 | — | **게이팅(#5 · #6)과 같은 헬퍼**를 쓴다. 표시와 강제가 어긋나면 사용자가 원인을 알 수 없다 |
| 실패 | subscription.plan_not_found/404(참조 요금제 미존재) | 위와 동일 |

- **STAFF·MANAGER로서의 타 사업장 소속은 사용량에 세지 않는다.** 본인 구독과 무관하게 무료·무제한이며, 이것이 1계정 대 N사업장 구조의 전제다(REQ-WRK-30).
- **동일 사업자번호라도 별도 사업장으로 등록하면 각각 한도 1개를 소진한다.**
- upgradeGuidance는 **v1의 수동 처리 사실**을 담는다. 업그레이드 요청 워크플로 표면을 두지 않으므로 화면은 문의 안내를 노출한다.

### 4. GET /v1/workplaces/{workplaceId}/subscription-status — 사업장 측 한도 표시 (SUB-04)

| 항목 | 내용 |
|------|------|
| 권한 | MANAGER. **OWNER의 구독 기준으로 판정한 값**을 사업장 관리자에게 보여 준다 |
| 응답 | 활성 멤버 수 · 한도 · 잔여 · canInvite · 구독 상태 · 만료 예정일 · 초과 여부 |
| 노출 제한 | **OWNER의 다른 사업장 사용량과 요금 정보를 담지 않는다** — MANAGER는 그 사업장의 한도만 알면 된다 |
| 경고 | 한도 임박·초과 시 경고 플래그를 세운다. 만료 예정도 함께 표기한다 |
| 초과 상태 | **한도 축소로 기존 사용량이 초과되어도 기존 데이터를 삭제하지 않고 신규 생성·초대만 제한한다**(REQ-SUB-07 · REQ-WRK-31) |

### 5·6·7. 서버 내부 종점 3종 (SUB-03 · SUB-04 · SUB-05)

| 항목 | 5. 사업장 등록 게이팅 | 6. 활성 멤버 한도 게이팅 | 7. checkSubscriptionExpiry (배치) |
|------|---------------------|------------------------|----------------------------------|
| 실행 | 사업장 등록([04_workplace.md](./04_workplace.md) #1) 트랜잭션 진입 | 초대 발송·재발송·수락·공유코드 수락·임포트 확정 | 매일 00:10 KST · 분산락 · 멱등 |
| 잠금 | **사용자 행 잠금**으로 동시 다중 생성을 직렬화한다 | **사업장 행 잠금**으로 동시 수락을 직렬화한다 | — |
| 판정 | 소유 사업장 수(CLOSED 제외) < max_owned_workplaces | 활성 멤버 수 < max_staff_per_workplace(**OWNER 구독 기준**) | 체험 종료 · 구독 만료 · 수동 부여 종료일을 점검해 상태를 전이한다 |
| 실패 코드 | **subscription.workplace_limit_exceeded/402** + 현재 사용량 · 한도 · 필요 등급 | **subscription.staff_limit_exceeded/402** + 같은 details | — |
| 전이 | — | — | TRIAL → EXPIRED · ACTIVE → EXPIRED 등 |
| 부수효과 | — | — | 만료 예정·만료·한도 초과를 OWNER와 플랫폼 운영자에게 알린다(subscription_notice) |
| 표면 없음 근거 | 게이팅은 다른 도메인 트랜잭션 안에서만 의미가 있다. 별도 표면으로 열면 "판정했는데 등록은 실패"하는 창이 생긴다 | 위와 동일 | 사용자 요청과 무관하게 매일 성립해야 한다 |
| 법정 경계 | — | — | **만료가 법정 보존 데이터의 조회·교부를 막지 않는다.** 차단 범위는 신규 사업장 등록과 유료 기능 실행이며 그 판정은 게이팅이 한다 |

- #5 · #6이 서버 내부인 근거는 **선판정과 실제 실행 사이의 창** 때문이다. 조회 표면(#3 · #4)이 canRegister를 주지만 그것은 화면 표시용이고, 실제 강제는 등록·수락 트랜잭션 안에서 잠금과 함께 일어난다.
- 알림은 만료 임박 구간에서 중복 발송되지 않도록 발송 이력으로 억제한다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| subscription.workplace_limit_exceeded | 402 | OWNER 사업장 등록 수 한도 초과 | #5 (발생은 [04_workplace.md](./04_workplace.md) #1) |
| subscription.staff_limit_exceeded | 402 | 사업장 활성 멤버 수 한도 초과 — 초대 발송·수락·임포트 | #6 (발생은 [04_workplace.md](./04_workplace.md) #9 · #11 · #14 · #16 · #30) |
| subscription.expired | 402 | 구독 만료로 기능 차단 — **법정 보존 데이터 조회는 제외** | #5 · #6 |
| subscription.plan_not_found | 404 | 참조 요금제 미존재 | #2 · #3 |
| subscription.upgrade_required | 402 | **등급 한도 초과**로 업그레이드 필요 — **v1 발생 지점 없음**(아래) | — |
| system.plan_in_use | 409 | 참조된 요금제의 파괴적 변경·삭제 — 정의처는 [14_system.md](./14_system.md) | (발생은 [14_system.md](./14_system.md)) |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 | #4 |
| common.validation_failed | 400 | 요청 쿼리 검증 실패 | 전 REST 표면 |

- **subscription 5종 전량이 이 표에 있다.** 이 도메인이 코드의 정의처이고 실제 발생 표면은 대부분 사업장 도메인이다 — 한도가 걸리는 지점이 등록·초대·수락이기 때문이다.
- 402 응답의 details에는 **현재 사용량 · 한도 · 필요 등급 · 업그레이드 안내**를 담는다. 이 셋이 없으면 사용자가 무엇을 해야 하는지 알 수 없다.

- **subscription.upgrade_required는 v1에서 발생하지 않는다.** 이 코드가 가리키는 "등급 한도 초과"의 v1 축은 **소유 사업장 수와 사업장당 활성 멤버 수 둘뿐**인데, 그 둘은 이미 **subscription.workplace_limit_exceeded**와 **subscription.staff_limit_exceeded**가 각각 갖는다 — **같은 사유에 두 코드를 두지 않으며 좁은 쪽이 이긴다.**
- **폐기하지 않고 미발생으로 등재하는 이유는 한도 축이 늘면 그때 쓸 자리이기 때문**이다. 등재하지 않으면 다음 사람이 "표에 있는데 아무 데서도 안 난다"를 결손으로 보고 넓은 코드를 되살린다 — export.forbidden과 같은 형태의 등재다([14_system.md](./14_system.md)).

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| plans | #1 · #2 · #3 · #4 SELECT | 요금제 — 등급별 한도 2축 · version · effective_from · is_active. 참조된 버전은 삭제 불가 |
| subscriptions | #2 · #3 · #5 · #6 SELECT · #7 UPDATE | 계정 구독 — user_id UNIQUE · **plan_id**(요금제 행 참조) · status · expires_at · memo |
| workplaces | #3 · #5 SELECT | 소유 사업장 수 산출 대상. **CLOSED는 한도 계산에서 제외**한다 |
| workplace_members | #3 · #4 · #6 SELECT | 활성 멤버 수 산출 대상 — OWNER·MANAGER·STAFF 전원 |
| notifications | #7 INSERT | subscription_notice — 만료 예정·만료·한도 초과 안내 |
| audit_logs | (참조) | 수동 등급 조정의 사유·전후값 기록. 쓰기 표면은 [14_system.md](./14_system.md)가 소유한다 |

## 추적성

기능명·우선순위의 정본은 [../02_features/11_subscription.md](../02_features/11_subscription.md)다.

| 기능ID | 표면 |
|--------|------|
| SUB-01 요금제 정의 | #1(조회) · 정의·변경은 [14_system.md](./14_system.md) 참조 |
| SUB-02 구독 등급(계정) | #2 · #3 |
| SUB-03 사업장 등록 게이팅 | #3 · #5(서버) |
| SUB-04 이용 한도 | #3 · #4 · #6(서버) |
| SUB-05 구독 상태 점검 | #2 · #7(배치) |

**SUB 5기능 전수를 담았다**(위 표 5행). SUB-01은 이 문서가 조회만 소유하고 정의·변경은 플랫폼 운영 문서가 가지며, 게이팅 2기능(SUB-03 · SUB-04)은 강제 지점이 서버 내부라 조회 표면과 짝을 이룬다.

## 관련 문서

- 전역 규약·상태코드(402) → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/11_subscription.md](../02_features/11_subscription.md) · 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 요구사항 정본 → [../03_requirements/12_subscription.md](../03_requirements/12_subscription.md) · 동시성 잠금 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 한도 강제 지점(등록·초대·수락·임포트) → [04_workplace.md](./04_workplace.md) · 요금제·구독 조정 권한 → [14_system.md](./14_system.md) · 법정 보존 데이터 조회 → [09_payslip.md](./09_payslip.md) · 구독 안내 알림 → [12_notification.md](./12_notification.md)
- 테이블 명세 → [../05_database/14_subscription.md](../05_database/14_subscription.md)
- 고정 기준(요금제 3등급) → [../README.md](../README.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
