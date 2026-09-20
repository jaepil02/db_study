# 06_api / 04 사업장·멤버 (WRK)

> **대상**: WRK 도메인 REST 표면 — 사업장 등록과 진위확인 · 검증 상태 · 정보 관리와 지오펜스 · 초대 생성과 수락 · 컨텍스트 전환 · 역할 관리 · 멤버 목록과 제외 · 등록 한도 · 데이터 임포트 2단계 · 사업장 폐쇄 · **목록 공통 내보내기(DSH-06)**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **멤버 목록(#19) MANAGER 응답에 합류 시각(joinedAt) · 초대한 사람(invitedByName)을, 임포트 작업 목록(#28)에 확정한 사람(committedByName)을 더한다** — 인사 입사일과 계정 합류는 다른 축이고(인사 레코드 없는 MANAGER), 확정은 OWNER 전용이라 올린 사람과 다를 수 있다. 이름은 **동료 디렉토리(list_workplace_members)로만** 읽어 이미 떠난 사람이면 비어 있다. **아이디(username)는 싣지 않는다** — users에 앱 롤 grant가 없고 디렉토리 함수가 이름 · 역할만 내는 경계를 넓히지 않는다. **#17 소속 목록에 사업장별 처리 대기 건수를 싣지 않는다** — 계정 단위 자원은 사업장 업무 데이터를 담지 않는다([01_conventions.md](./01_conventions.md)). 화면이 필요하면 사업장 경로 목록 표면의 건수로 읽는다. 표면 수 · 권한 불변
> **개정일**: 2026-09-17 — **#35 목록 표를 19행으로 정리**한다. ① **listType 8종을 정본 규칙(경로 유도 · lower_snake · 부모 단수화 + 자식 세그먼트)에 맞춰 고친다** — attendance_days → attendance_daily_summaries · payroll_run_results → payroll_run_employees · insurance_reports → tax_insurance_reports · separation_certificates → tax_separation_certificates · retention_documents → retention · statutory_rates → system_statutory_rates · size_policies → system_size_policies · terms_documents → system_terms_documents(뒤 셋은 [14_system.md](./14_system.md) #36 표 소속). ② **contracts의 민감(●)을 걷는다** — 판정 기준(파일이 담는 값)을 다시 적용하면 이 목록에는 임금이 없다. ③ **documents(#28) · imports(#28) 두 행을 더한다.** ④ **listType 유도 규칙에 부모 단수화 + 자식 세그먼트 구절을 더한다**(payroll_run_employees 근거). ⑤ **급여 미리보기 · 급여 기준 이력 · 퇴직 정산에 listType이 없는 이유 한 줄을 더한다.** **표면 수 · 번호는 전건 불변**
> **개정일**: 2026-09-16 — **#35 목록 표에 workplace 표면 소속 listType 16종을 등재**한다(contracts · members · invitations · attendance_change_requests · attendance_days · attendance_closings · leave_requests · leave_balances · payslips · payroll_runs · payroll_run_results · insurance_reports · separation_certificates · compliance_tasks · retention_documents · employee_count_snapshots) — 이 표가 employees 한 행뿐이었다. payroll_run_results는 filters.runId가 필수다. **표면 수 · 번호는 전건 불변**
> **개정일**: 2026-09-16 — **#19 멤버 목록·#10 초대 목록의 ILIKE 이스케이프 결함을 고친다** — 매퍼가 검색어를 이스케이프 없이 감싸 `%`·`_`가 들어간 검색어에서 의도와 다른 행이 잡혔다. q 계약(대상 필드 · 길이 상한 50 · ESCAPE)은 그대로이고 정본은 [01_conventions.md](./01_conventions.md)다. **표면 수 · 번호는 전건 불변**
> **개정일**: 2026-09-16 — **표면 34 → 36**(REST 31 → **32** · 다운로드 1 → **2**) — **DSH-06 리포트 내보내기**(D-23)의 발급 **#35 POST /v1/workplaces/{workplaceId}/list-exports**와 다운로드 **#36 GET /v1/list-exports/download/{token}**을 말미에 채번한다. 목록을 가리지 않는 공통 표면이라 **테넌트 도메인 문서에 둔다**(기능 행이 [../02_features/02_workplace.md](../02_features/02_workplace.md)에 있는 것과 같은 축). 시스템 콘솔 목록의 발급은 [14_system.md](./14_system.md) #36이 갖고 **다운로드는 이 문서의 #36 하나를 함께 쓴다.** 발급은 **조건을 1회용 토큰에 봉인**하고 파일은 **내려받는 순간** 만든다 · 멱등키를 요구하지 않는다(재생이 소비된 토큰을 돌려준다 — 임금대장 선례) · 감사 action 2종(list.export · list.export_sensitive · 채번 정본 [../05_database/15_system.md](../05_database/15_system.md)) · **export.forbidden/403의 첫 발생 지점**(표면이 어긋난 목록 요청). 추적성에 DSH-06 행을 더해 **14행**이다
> **개정일**: 2026-09-10 — 에러 절에 **workplace.mgmt_no_required/422**(신고자료의 빈 관리번호 계열 · 채번 정본 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md) 119 → **120종**)와 **workplace.business_unit_overlap/409**(2026-08-21 채번분 — **이 미러에 닿지 않아 빠져 있었다**)를 등재한다. 함께 **"workplace 20종 전량"과 "발생 표면이 없는 코드는 둘"이라는 두 닫는 열거를 걷는다** — 전자는 2026-08-21 신설로 이미 틀려 있었고 후자는 이번 채번으로 틀린다. **종수는 정본이 갖고 여기서 세지 않는다.** **표면 34행 · REST 31 · 기능ID 매핑은 전건 불변**
> **개정일**: 2026-09-10 — **보험 계열별 사업장관리번호 3열의 쓰기 표면을 #4 정보 수정에 둔다**(insurance_mgmt_no 고용·산재 · pension_mgmt_no 국민연금 · health_mgmt_no 건강보험). **정본이 이 셋을 받는 자리를 정하지 않아 컬럼과 읽기만 있고 쓰기 경로가 없었다** — 신고자료(TAX-01)가 사업장 축 입력으로 요구하는데 채울 표면이 없었다. **새 표면을 두지 않는다** — 같은 자원(workplaces 행)의 부분 갱신이고 권한(MANAGER)·감사 코드(workplace.update)가 #4와 같아 **나눌 근거가 없다.** 지오펜스가 #5로 갈린 것은 effectiveFrom 과 소급 금지 계약이 붙기 때문인데 이 셋에는 그 축이 없고, **"어느 열을 고쳤는가"로 표면과 코드를 나누지 않는다**는 것은 아래 연동 표가 이미 세운 축이다. **표면 34행 · REST 31 · 기능ID 매핑 · action 코드 7종은 전건 불변**이다 — 기존 PATCH 의 입력이 늘어날 뿐이다
> **개정일**: 2026-09-07 — 보류했던 두 자리를 **등재한다** — **#5 지오펜스 수정도 workplace.update** · **#11 재발송도 workplace_invitation.send**다. **표면이 둘이라는 이유만으로 코드를 나누지 않는다**(나누면 "어느 열을 고쳤는가"마다 코드가 생긴다 — 무엇이 바뀌었는지는 before/after 값이 담는다). 재발송은 REQ-WRK-14상 **새 행 생성 + 직전 토큰 무효화**라 새 초대를 만드는 행위이고, 직전 행의 무효화는 그 행 자신의 전이로 기록된다. **한 코드가 여러 표면을 갖는 것과 한 표면이 여러 코드를 조건으로 갖는 것**(08_payroll #17)은 반대 방향이며 **둘 다 정상이다.** 표면 수 · 번호 · 권한은 전건 불변
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행에 **#4 · #9 · #12를 등재**하고 일곱 표면 전부에 action 코드를 병기한다(누락 보정 — 계약 확장이 아니다). workplace.update · workplace_invitation.send · .cancel은 **원본 개방 목록부터 있던 코드**인데 이 표가 대응 표면을 적지 않았다. **사유 필수 표기도 함께 고쳤다** — 종전 서술이 네 표면을 묶어 "사유 필수 감사"로 적었으나 실제로 사유가 필수인 것은 **폐쇄(#26)와 임포트 확정(#30) 둘뿐**이다. **#5 지오펜스 수정 · #11 초대 재발송은 코드 귀속 미확정으로 남긴다.** **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정(**앱 축 필드 등재만** · 리드 승인) — 소속 사업장 요약(#17)에 **employeeId** 등재 · 컨텍스트 전환(#18) 응답에 **underFive** 등재 · 소속 사업장 요약의 **정본이 #17임을 선언**. **표면 수는 34로 불변**이다 — 둘 다 응답 필드이며 표면 신설이 아니다
> **개정일**: 2026-08-08 — 폐쇄 트랜잭션이 OWNER 멤버십을 함께 종료 전이시킴을 명시 · 퇴사 사유별 멤버십 종료 상태 매핑(LEFT · REMOVED) 반영
> **개정일**: 2026-08-03 — 자동 정지 기한 14일 확정 반영(2곳)
> **원천**: [../03_requirements/03_workplace.md](../03_requirements/03_workplace.md)(REQ-WRK-01~36) · [../02_features/02_workplace.md](../02_features/02_workplace.md)(WRK 13기능 · **DSH-06**) · D-23 · [../03_requirements/12_subscription.md](../03_requirements/12_subscription.md)(REQ-SUB-05·06 한도) · 확정 결정 D-11 · D-12 · D-13 · D-18

사업장은 **테넌트 경계**다. 이 도메인의 표면 하나가 사업장을 만들면 그 뒤 12도메인의 모든 경로에 workplaceId가 붙는다. 그래서 등록 표면(#1)은 다른 어떤 표면보다 선검사가 많다 — 계정 상태 · 구독 한도 · 국세청 진위확인 · 중복 판정을 모두 통과해야 생성 트랜잭션이 시작된다.

**국세청 진위확인 게이트는 법이 요구한 것이 아니라 제품이 선택한 신뢰 장치**다(D-11). 그래서 표면 설계도 게이트를 유지하되 세 구멍을 막는다 — 개업 준비 중과 API 장애는 검증 대기 상태로 생성을 허용하고(#1 · #7), 휴업은 경고 후 허용하며(#2), **폐업만 등록을 차단**한다.

**임포트는 2단계다**(#27 → #30). 업로드는 행별 검증과 미리보기까지만 하고 어떤 데이터도 커밋하지 않으며, 확정은 OWNER 전용에 멱등키가 필수다. 한 번의 잘못된 확정이 직원 수십 명의 인사·근로조건을 한꺼번에 만들기 때문이다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 사업장 자원은 /v1/workplaces/{workplaceId}/… 이고, 등록(#1) · 진위확인(#2) · 본인 관점 표면(#13~#18)만 스코프 밖이다 |
| 권한 축 | STAFF(멤버 목록 최소 정보) · MANAGER(정보 관리 · 초대 · 멤버 목록 · 임포트 업로드) · **OWNER 전용 4갈래**(역할 변경 · MANAGER 제외 · 임포트 확정 · 폐쇄) |
| 역할 초대 제약 | MANAGER는 STAFF만 초대·제외한다. OWNER는 MANAGER·STAFF를 초대·제외한다. **OWNER 역할은 어떤 표면으로도 부여할 수 없다** — 양도가 v1에 없다(D-13) |
| 멱등 | 임포트 확정(#30) **1표면**이 Idempotency-Key 필수다. 초대 중복은 (사업장, 대상, PENDING) 자연 제약이, 사업장 중복은 (business_no, site_label) UNIQUE가 막는다 |
| 잠금 | ① 사업장 등록은 **사용자 행 잠금**으로 소유 수 재검증을 직렬화한다 ② 초대 수락은 **사업장 행 잠금**으로 활성 멤버 한도 재검증을 직렬화한다. 둘 다 멱등키로는 막을 수 없는 경합이다(REQ-GLB-15) |
| 한도 이중 검증 | 활성 멤버 한도는 **초대 발송(#9 · #11)과 수락(#14 · #16) 양쪽**에서 본다. 대기 중 다른 초대가 수락되어 한도가 찰 수 있다(REQ-WRK-14) |
| 재인증 | 폐쇄(#26)가 X-Reauth-Token(purpose=WORKPLACE_CLOSE)을 요구한다 |
| 페이지네이션 | 오프셋 **5표면**(#6 · #10 · #19 · #22 · #28). 모집단이 활성 멤버 30명 상한 또는 사업장 단위 이력이라 총 건수가 화면 요건이다 |
| 내보내기 | 목록 공통 내보내기(#35 · #36)는 **그 목록의 조회 권한을 그대로 따른다** — 이 문서의 권한 축에 새 역할 경계를 더하지 않는다. 멤버 · 직원 · 급여처럼 다른 도메인 목록도 발급은 #35 하나이며, 목록마다 무엇을 싣는지는 목록을 소유한 도메인의 구현이 선언한다 |
| 존재 은닉 | 타인 수신 초대(#13~#15)는 행 존재 자체를 노출하지 않는다 — 권한 밖 조회는 404다(REQ-WRK-15) |
| 상태 전이 | 사업장·멤버십·초대 상태 머신 3종의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | POST /v1/workplaces | 본인 | — | WRK-01 · WRK-11 |
| 2 | REST | POST /v1/workplaces/business-verification | 본인 | — | WRK-02 |
| 3 | REST | GET /v1/workplaces/{workplaceId} | STAFF | — | WRK-03 |
| 4 | REST | PATCH /v1/workplaces/{workplaceId} | MANAGER | — | WRK-03 |
| 5 | REST | PATCH /v1/workplaces/{workplaceId}/geofence | MANAGER | — | WRK-03 |
| 6 | REST | GET /v1/workplaces/{workplaceId}/change-logs | MANAGER | 오프셋 | WRK-03 |
| 7 | REST | GET /v1/workplaces/{workplaceId}/verification | MANAGER | — | WRK-14 |
| 8 | REST | POST /v1/workplaces/{workplaceId}/verification/revalidate | OWNER | — | WRK-14 |
| 9 | REST | POST /v1/workplaces/{workplaceId}/invitations | MANAGER | — | WRK-04 |
| 10 | REST | GET /v1/workplaces/{workplaceId}/invitations | MANAGER | 오프셋 | WRK-04 |
| 11 | REST | POST /v1/workplaces/{workplaceId}/invitations/{invitationId}/resend | MANAGER | — | WRK-04 |
| 12 | REST | POST /v1/workplaces/{workplaceId}/invitations/{invitationId}/cancel | MANAGER | — | WRK-04 |
| 13 | REST | GET /v1/me/invitations | 본인 | — | WRK-05 |
| 14 | REST | POST /v1/me/invitations/{invitationId}/accept | 본인 | — | WRK-05 |
| 15 | REST | POST /v1/me/invitations/{invitationId}/reject | 본인 | — | WRK-05 |
| 16 | REST | POST /v1/me/invitations/redeem | 본인 | — | WRK-05 |
| 17 | REST | GET /v1/me/workplaces | 본인 | — | WRK-06 |
| 18 | REST | PUT /v1/me/active-workplace | 본인 | — | WRK-06 |
| 19 | REST | GET /v1/workplaces/{workplaceId}/members | STAFF | 오프셋 | WRK-08 |
| 20 | REST | GET /v1/workplaces/{workplaceId}/members/{memberId} | MANAGER | — | WRK-08 |
| 21 | REST | PATCH /v1/workplaces/{workplaceId}/members/{memberId}/role | OWNER | — | WRK-07 |
| 22 | REST | GET /v1/workplaces/{workplaceId}/members/{memberId}/role-events | MANAGER | 오프셋 | WRK-07 |
| 23 | REST | GET /v1/workplaces/{workplaceId}/members/{memberId}/removal-preflight | MANAGER | — | WRK-09 |
| 24 | REST | DELETE /v1/workplaces/{workplaceId}/members/{memberId} | MANAGER | — | WRK-09 |
| 25 | REST | GET /v1/workplaces/{workplaceId}/close-preflight | OWNER | — | WRK-10 |
| 26 | REST | POST /v1/workplaces/{workplaceId}/close | OWNER · 재인증 | — | WRK-10 |
| 27 | REST | POST /v1/workplaces/{workplaceId}/imports | MANAGER | — | WRK-16 |
| 28 | REST | GET /v1/workplaces/{workplaceId}/imports | MANAGER | 오프셋 | WRK-16 |
| 29 | REST | GET /v1/workplaces/{workplaceId}/imports/{importJobId} | MANAGER | — | WRK-16 |
| 30 | REST | POST /v1/workplaces/{workplaceId}/imports/{importJobId}/commit | OWNER · 멱등 | — | WRK-16 |
| 31 | REST | POST /v1/workplaces/{workplaceId}/imports/{importJobId}/report-token | MANAGER | — | WRK-16 |
| 32 | 다운로드 | GET /v1/imports/reports/{token} | 토큰 소유자 | — | WRK-16 |
| 33 | 서버 내부 | 정기작업 expireInvitations(30분 주기) | 시스템 | — | WRK-04 · WRK-05 |
| 34 | 서버 내부 | 검증 대기 기한 초과 자동 정지 판정 | 시스템 | — | WRK-14 |
| 35 | REST | POST /v1/workplaces/{workplaceId}/list-exports | 목록의 조회 권한 | — | DSH-06 |
| 36 | 다운로드 | GET /v1/list-exports/download/{token} | 토큰 소유자 | — | DSH-06 |

- 36행 = REST **32** · 다운로드 **2** · 서버 내부 **2**다. SSE 표면은 없다.
- **#35 · #36은 말미 채번이다** — 흐름상 자리는 멤버 목록(#19) 옆이지만 번호를 밀지 않는다. **#36은 경로가 사업장 밖이다** — 인가 축이 멤버십이 아니라 토큰 소유자이고 시스템 콘솔 목록의 발급([14_system.md](./14_system.md) #36)도 같은 다운로드를 쓴다.
- **WRK-11 사업장 등록 한도의 표면은 #1 하나**다 — 게이팅이 등록 트랜잭션 안에서만 일어나기 때문이며, 사용량 조회는 [13_subscription.md](./13_subscription.md)의 구독 사용량 표면이 소유한다.

## 상세

### 1. POST /v1/workplaces — 사업장 등록 (WRK-01 · WRK-11)

```json
{
  "businessNo": "1234567890",
  "companyName": "행복상사",
  "ownerName": "홍길동",
  "openDate": "2024-03-02",
  "siteLabel": "본점",
  "address": "서울특별시 …",
  "industry": "…",
  "bizType": "…",
  "worksite": { "lat": "37.566500", "lng": "126.978000", "geofenceRadiusM": 100, "locationAccuracyLimitM": 50 },
  "verificationTicket": "…",
  "acknowledgedWarnings": ["BUSINESS_SUSPENDED", "MULTI_SITE_HEADCOUNT"]
}
```

verificationTicket은 #2가 발급한 검증 결과 참조값이다. 티켓이 없거나 만료됐으면 서버가 #2를 내부적으로 다시 수행한다.

```plain
① 요청자 계정 상태 검증      ACTIVE 아니면 auth.account_suspended/403 · auth.account_deleted/403
② 구독 한도 선검사           사용자 행 잠금 → 소유 사업장 수(CLOSED 제외) < max_owned_workplaces
                            초과 → subscription.workplace_limit_exceeded/402
                                   details에 현재 사용량 · 한도 · 필요 등급을 담는다
③ 진위·상태 판정             티켓 소비 또는 재조회(#2와 같은 판정)
                            MISMATCH · CLOSED → workplace.business_invalid/422
                            SUSPENDED(휴업)   → 경고. acknowledgedWarnings에 없으면 422로 되돌려 확인을 요구한다
                            ERROR(API 장애)   → PENDING_VERIFICATION 경로로 진행(REQ-WRK-07)
④ 중복 판정                  (business_no, site_label) 완전 중복 → workplace.duplicate_site/409
                            동일 business_no 다른 site_label은 허용하고 business_units 그룹에 연결한다(D-18)
⑤ 트랜잭션 시작              workplaces INSERT(status=ACTIVE 또는 PENDING_VERIFICATION · site_role · tax_unit_type=GENERAL)
⑥ 멤버십 시드                workplace_members INSERT(role=OWNER · status=ACTIVE)
⑦ 초기 데이터 시드            기본 근무정책 · 알림 설정 · 휴가 유형 · 급여 기준 초안
⑧ 검증 이력 기록              business_verification_logs INSERT(result · latency · 응답 요약)
⑨ 커밋 → 201 Location: /v1/workplaces/{workplaceId}
```

- **진위 미통과 입력으로는 사업장이 생성되지 않는다**(REQ-WRK-03). ③이 트랜잭션 밖인 것은 외부 호출을 트랜잭션 안에 두면 API 지연이 그대로 행 잠금 시간이 되기 때문이다.
- ②의 잠금 없이 한도만 조회하면 동시 등록 두 건이 모두 통과한다. **권한 부족(403)과 한도 초과(402)를 분리**하는 것이 이 표면의 계약이다(REQ-WRK-02).
- 동일 business_no로 복수 등록이 성사되면 응답에 **상시근로자 합산 판정 요구 안내**(CMP-08)를 함께 담는다. 판정 표면은 [11_compliance.md](./11_compliance.md)다.
- 응답 status가 PENDING_VERIFICATION이면 **근태·인사 입력은 열리고 급여 확정·명세서 발행만 막힌다**(#7 참조).

### 2. POST /v1/workplaces/business-verification — 사업자 진위·상태 검증 (WRK-02)

| 항목 | 내용 |
|------|------|
| 입력 | businessNo · ownerName · openDate · companyName(선택) |
| 처리 | 서버가 국세청 진위확인·상태조회 API를 호출한다. **API 키는 서버 비밀이며 클라이언트에 어떤 형태로도 내려가지 않는다**(REQ-WRK-04) |
| 결과 | result ∈ MATCH · MISMATCH · SUSPENDED · CLOSED · ERROR와 taxationType · closedDate · warnings 배열 · verificationTicket |
| 캐싱 | 동일 입력의 성공 결과는 정책 기간 동안 캐시한다. 캐시 적중도 business_verification_logs에 기록한다 |
| 티켓 | verificationTicket은 #1이 소비하는 단기 참조값이다. 클라이언트가 판정 결과를 조작해 #1에 실을 수 없게 하려는 장치이며 **결과 값 자체는 신뢰 근거가 아니다** |
| 실패 | MISMATCH·CLOSED는 **workplace.business_invalid/422** · API 장애·timeout·호출량 초과는 **workplace.business_api_unavailable/503** |
| 503 처리 | 503 응답에 **검증 대기 생성 경로 안내**를 함께 담는다 — 외부 API 가용성에 법정 의무 이행이 종속되지 않게 한다(REQ-WRK-07) |

- **휴업(SUSPENDED)은 차단이 아니라 경고다**(D-12). 휴업 중에도 근로관계·휴업수당·퇴직금 의무가 존속하므로 등록을 막으면 사용자가 의무 이행 수단을 잃는다.
- 응답의 원문 민감 데이터는 최소 보관한다 — 로그에는 요약만 남기고 응답 원문을 그대로 저장하지 않는다.
- 이 표면은 rate limit 대상이다. 타인의 사업자번호를 대량 조회하는 경로가 되지 않게 (사용자, 사업자번호) 축으로 제한한다.

### 3·4·5·6. 사업장 정보 조회·수정·지오펜스·변경 이력 (WRK-03)

| 항목 | 3. 상세 조회 | 4. 정보 수정 | 5. 지오펜스 수정 | 6. 변경 이력 |
|------|-------------|-------------|-----------------|-------------|
| 권한 | STAFF — 좌표·반경·근무정책은 출퇴근에 필요하다 | MANAGER | MANAGER | MANAGER |
| 입력 | — | companyName · address · industry · bizType · 대표 연락처 · 기본 근무시간 · **보험 계열별 사업장관리번호 3**(insuranceMgmtNo 고용·산재 · pensionMgmtNo 국민연금 · healthMgmtNo 건강보험) | lat · lng · geofenceRadiusM(50~500) · locationAccuracyLimitM | 오프셋 · 기간 필터 |
| 불변 필드 | — | **businessNo · ownerName · openDate는 변경할 수 없다** → workplace.immutable_field/422 | — | — |
| 응답 범위 | STAFF에게는 좌표·반경·정확도 한계·상호·주소까지, MANAGER 이상에게는 검증 상태·구독 요약과 **보험 계열별 관리번호 3**을 더한다 | 갱신된 자원 | 갱신된 자원 + effectiveFrom | items에 전후값·유효시작일·변경자 |
| 부수효과 | — | workplace_change_logs INSERT | workplace_change_logs INSERT | — |

- **반경 변경은 변경 시각 이후 체크인부터 적용하고 과거 판정을 소급하지 않는다**(REQ-WRK-10). 그래서 #5의 응답과 이력에 effectiveFrom을 반드시 담는다 — 소급 여부가 응답에서 드러나지 않으면 근태 분쟁에서 어느 반경으로 판정했는지 재현할 수 없다.
- **보험 계열별 관리번호 3은 #4가 받고 #3의 MANAGER 이상 응답에만 담는다.** 신고자료의 사업장 축 입력이라 STAFF 업무에 쓰이지 않으므로 STAFF 응답 범위를 넓히지 않는다. **세 축을 한 필드로 합치지 않는다** — 고용·산재는 번호를 공유하지만 국민연금과 건강보험은 각각 별도 식별번호라 합치면 신고서 4종 중 일부가 틀린 번호로 나간다(REQ-TAX-01).
- **서버가 자릿수·체크 규칙을 판정하지 않는다.** 세 계열의 번호 형식은 확인된 근거가 없고 **틀린 규칙을 걸면 정당한 번호가 거부되어 신고 자체가 막힌다** — 미확인을 확정 형식처럼 쓰지 않는다는 원칙이 드는 자리다. 검증은 공백 제거와 길이 상한 같은 일반 형식(common.validation_failed/400)까지이고 **값의 진위는 서버가 판정하지 않는다.** 형식 규칙이 확인되면 그때 제약을 더한다 — **이 셋은 기준값이 아니라 사업장 설정값이므로 확인 전 시드 금지 목록에 등재하지 않는다.**
- **부재를 이 표면이 막지 않는다.** 세 열은 NULL 허용이고 사업장 등록(#1) 시점에는 번호가 아직 발급되지 않았을 수 있다 — **차단은 값을 쓰는 자리인 신고자료 표면이 수행**하며 대상 보험의 번호가 비면 그 보험의 자료 생성을 막는다([10_tax.md](./10_tax.md) · REQ-TAX-01).
- **감사는 workplace.update가 흡수한다.** 관리번호 변경도 사업장 속성 변경이고 무엇이 바뀌었는지는 workplace_change_logs 의 field 와 before/after 가 담으므로 **새 action 코드를 채번하지 않는다** — 아래 연동 표가 #5 지오펜스에 대해 세운 것과 같은 축이다.
- **v1은 사업장당 단일 근무지**다. 다중 근무지 표면을 두지 않는다.
- 세 불변 필드가 사업장 아이덴티티 앵커다. 바꾸려면 재검증(#8)이 선행해야 하는데 v1은 그 경로를 열지 않고 **차단만** 한다.

### 7·8. 검증 상태 조회·재검증 (WRK-14)

| 항목 | 7. GET verification | 8. POST verification/revalidate |
|------|--------------------|--------------------------------|
| 권한 | MANAGER | OWNER |
| 응답·처리 | status · lastVerifiedAt · lastResult · pendingSince · **blockedActions 배열** · 자동 정지 예정일 | #2와 같은 외부 조회를 수행하고 성공 시 PENDING_VERIFICATION → ACTIVE로 전이한다 |
| 차단 계약 | PENDING_VERIFICATION에서 blockedActions는 급여 확정 · 명세서 발행 **둘뿐**이다. 근태·인사 입력은 열려 있다 | 실패는 workplace.business_invalid/422 · workplace.business_api_unavailable/503 |
| 부수효과 | — | business_verification_logs INSERT · 성공 시 OWNER 알림 |

- 실제 차단은 이 표면이 아니라 급여·명세서 표면이 수행한다 — **workplace.verification_pending/409**이며 발생 지점은 [08_payroll.md](./08_payroll.md) · [09_payslip.md](./09_payslip.md)다. #7은 그 사실을 미리 알려 주는 조회일 뿐이다.
- **자동 정지 기한은 14일로 확정됐다**(사용자 확정 2026-08-03 · REQ-WRK-08 — 기준값으로 시드). #7의 자동 정지 예정일은 기준값 등록 후 값을 갖고, 등록 전에는 null이다. #34가 그 판정을 수행한다.

### 9·10·11·12. 초대 생성·목록·재발송·취소 (WRK-04)

```json
{
  "targetUsername": "kim5678",
  "targetPhone": null,
  "role": "STAFF",
  "employmentStartDate": "2026-09-01",
  "message": "9월부터 함께 근무합니다."
}
```

targetUsername과 targetPhone 중 정확히 하나를 채운다. 가입자에게는 인앱 알림으로, 미가입자에게는 공유 코드로 전달한다.

```plain
① 역할 초대 권한 판정        MANAGER가 MANAGER·OWNER를 지정 → workplace.invite_role_forbidden/403
                            role에 OWNER를 지정하는 것은 누구에게도 허용하지 않는다
② 대상 상태 판정             이미 ACTIVE 멤버 → workplace.already_member/409
                            동일 대상 PENDING 초대 존재 → 새로 만들지 않고 기존 초대를 반환한다(멱등)
③ 활성 멤버 한도 검증         활성 멤버 수 < max_staff_per_workplace(OWNER 구독 기준)
                            초과 → subscription.staff_limit_exceeded/402
④ 초대 생성                  token_hash(원문은 저장하지 않는다) · expires_at 기본 7일
                            invitation_type=MEMBER_INVITE · status=PENDING
⑤ 발송                      가입자 = 인앱 알림 invite_received · 미가입자 = 공유 코드 응답 반환
```

| 항목 | 10. 목록 | 11. 재발송 | 12. 취소 |
|------|---------|-----------|---------|
| 입력·필터 | status · role · q(대상자) · 오프셋 | — | — |
| 대상 상태 | — | **EXPIRED · REJECTED만** | **PENDING만** |
| 처리 | 대상자 표시명 · 역할 · 상태 · 만료 시각 · 초대자 | 새 토큰 생성 + **직전 토큰 즉시 무효화** + 한도 재검증 | status=CANCELLED 전이 + 알림 |
| 실패 | — | invitation.already_responded/409(PENDING·ACCEPTED 대상) · subscription.staff_limit_exceeded/402 | invitation.already_responded/409 |

- **재발송은 직전 토큰을 즉시 무효화한다**(REQ-WRK-14). 직전 토큰으로의 수락 시도는 invitation.invalid_token/422이며 정기작업(#33)의 만료 처리와 무관하게 즉시 적용된다.
- **토큰 원문은 응답에서 단 한 번만** 나간다(미가입자 공유 코드). 이후 어떤 조회 표면도 토큰을 반환하지 않는다 — 저장이 해시라 되돌릴 수도 없다.
- ②의 멱등 반환은 성공(200)이며 새 알림을 다시 보내지 않는다. 중복 초대가 대상자에게 알림 폭탄이 되는 것을 막는다.

### 13·14·15·16. 수신 초대 조회·수락·거절·공유 코드 (WRK-05)

| 항목 | 13. 목록 | 14. 수락 | 15. 거절 | 16. 공유 코드 수락 |
|------|---------|---------|---------|------------------|
| 권한 | 본인 수신분만 | 본인 | 본인 | 본인 |
| 입력 | — | — | — | code |
| 응답 | 사업장명 · 역할 · 초대자 · 만료 시각 | 생성된 멤버십 요약 + 활성 사업장 전환 안내 | 204 | #14와 동일 |
| 존재 은닉 | **타인 초대는 404**다. 행 존재를 노출하지 않는다 | 위와 동일 | 위와 동일 | 무효 코드는 invitation.invalid_token/422 |

수락(#14 · #16)의 처리 순서는 다음과 같으며 **전체가 단일 트랜잭션**이다.

```plain
① 토큰·코드 검증             해시 대조 실패·재발송으로 무효화된 직전 토큰 → invitation.invalid_token/422
                            만료(EXPIRED)                              → invitation.expired/410
                            이미 응답(ACCEPTED·REJECTED·CANCELLED)      → invitation.already_responded/409
② 대상자 일치 검증           공유 코드는 초대 대상 phone·username 일치를 **필수 검증**한다
                            불일치는 거부한다 — v1은 관리자 최종 승인 우회 경로를 제공하지 않는다
③ 사업장 상태 검증           SUSPENDED·CLOSED → workplace.closed/409
④ 사업장 행 잠금 → 한도 재검증  활성 멤버 수 < max_staff_per_workplace
                            초과 → subscription.staff_limit_exceeded/402
⑤ 멤버십 이력 판정           신규 → workplace_members INSERT(ACTIVE)
                            LEFT  → 재활성화(ACTIVE)
                            REMOVED · SUSPENDED → workplace.member_state_conflict/409
⑥ employees 초안 생성        인사 레코드를 만들고 멤버십과 연계한다(HRM-01)
⑦ 초대 전이                  status=ACCEPTED
⑧ 알림 발송                  OWNER·MANAGER에게 invite_accepted
```

- **공유 코드는 1회용**이다. ②의 대상자 일치 검증이 없으면 코드가 유출된 순간 임의의 계정이 사업장에 들어온다(REQ-WRK-16).
- ④의 사업장 행 잠금이 이 도메인에서 가장 중요한 동시성 장치다. 잠금 없이 한도만 조회하면 동시 수락 두 건이 모두 통과해 한도가 우회된다.
- **REMOVED 이력자의 재초대 수락은 차단한다**(⑤). 강제 제외에는 사유가 있으므로 관리자가 그 사유를 확인한 뒤 별도로 처리한다(REQ-WRK-17).
- 모든 전이(#14 · #15 · #12 · #33)는 알림을 발송한다. 알림 발송 실패가 전이를 롤백하지 않는다([12_notification.md](./12_notification.md)).

### 17·18. 소속 목록·컨텍스트 전환 (WRK-06)

| 항목 | 17. GET /v1/me/workplaces | 18. PUT /v1/me/active-workplace |
|------|--------------------------|--------------------------------|
| 입력 | surface(APP · ADMIN · SYSTEM · 선택) | workplaceId |
| 응답 | 사업장명 · 지점명 · 역할 · 사업장 상태 · 마지막 선택 시각 · **selectable 불리언** · **employeeId**(nullable) | workplaceId · role · permissions 요약 · 사업장 상태 · **underFive** |
| 차단 | — | SUSPENDED·CLOSED 사업장 → **workplace.unavailable/409** · LEFT·REMOVED 멤버십 → auth.workplace_forbidden/403 · STAFF의 surface=ADMIN → auth.workplace_forbidden/403 |
| 부수효과 | — | workplace_members.last_selected_at 갱신 |

- **전환은 서버 상태를 바꾸지 않는다.** #18은 선택 가능 여부를 판정하고 마지막 선택 시각만 갱신하며, 이후 요청의 스코프는 여전히 경로 변수 {workplaceId}가 정한다([01_conventions.md](./01_conventions.md)). #18을 부르지 않고 곧바로 사업장 경로를 호출해도 서버 판정은 같다 — 이 표면은 **화면의 진입 판정과 최근 사용 이력**을 위한 것이다.
- **클라이언트 캐시는 workplaceId + 역할 단위로 격리한다.** 전환 시 이전 사업장 응답이 남으면 타 테넌트 데이터가 화면에 보인다(REQ-WRK-20).
- 진입 권한이 없는 사업장도 목록에 넣고 selectable=false로 표시한다.
- **#17의 요약이 소속 사업장 요약의 정본**이다. 같은 요약을 [03_auth.md](./03_auth.md) #8(진입 컨텍스트)의 workplaces 배열이 그대로 싣는다 — 두 자리가 갈리면 같은 화면이 진입 경로에 따라 다른 필드를 받는다.
- **employeeId는 그 사업장에서의 요청자 본인 직원 레코드 식별자**이며 **nullable**이다. 초대 수락 전이거나 임포트로 만들어진 인사 레코드가 아직 계정과 연결되지 않았으면 비어 있고(REQ-HRM-01의 user_id nullable 축), **null이면 클라이언트가 인적사항 조회([05_hr.md](./05_hr.md) #3)를 시도하지 않는다.** 이 값이 없으면 본인 employeeId를 얻을 경로가 정본에 없어 직원 앱이 자기 인사 레코드에 닿지 못한다 — #3은 employeeId를 이미 알아야 부를 수 있어 순환이다.
- **employeeId를 실어도 계정 단위 자원의 제약을 깨지 않는다.** 담기는 것은 **요청자 본인의 식별자 하나**이고 타인 정보도 사업장 업무 데이터도 아니다([01_conventions.md](./01_conventions.md)의 "계정 단위 자원은 사업장 업무 데이터를 담지 않는다").
- **#18의 underFive는 조회 시점의 표시용 파생값**이다. **가산 대상 판정의 정본은 상시근로자 스냅샷**이며([11_compliance.md](./11_compliance.md)) 근무일별 판정은 근태 일 집계의 premiumEligible이 담는다([06_attendance.md](./06_attendance.md) #9 · #10). **이 플래그로 과거 근무일의 가산 미적용을 단정하지 않는다** — 스냅샷은 귀속 기간별이라 한 사업장이 5인과 4인을 오간 기간이 실재한다.
- **underFive의 용도는 진입 시점의 안내 분기**다(연차 미적용 안내 · 가산 미적용 고지). 계산·집계의 입력으로 쓰지 않는다.

### 19·20. 멤버 목록·상세 (WRK-08)

| 항목 | 19. 목록 | 20. 상세 |
|------|---------|---------|
| 권한 | STAFF 이상. **응답 범위가 역할로 갈린다** | MANAGER 이상 |
| 필터 | q(이름 · username · 연락처 뒤 4자리) · role · memberStatus · employmentStatus · 오프셋 | — |
| STAFF 응답 | 이름 · 역할 · 멤버 상태까지의 공개 최소 정보 | (접근 불가) |
| MANAGER 응답 | 위 + 입사일 · 고용형태 · 재직 상태 · 연락처 일부 · **합류 시각(joinedAt)** · **초대한 사람(invitedByName)** | 위 + 근로조건 요약 · 보험 적용 요약 링크 |
| 금지 | **급여 · 주민번호 · 계좌 · 상세 주소를 어느 역할에게도 목록에 포함하지 않는다**(REQ-WRK-25) | 민감정보는 마스킹 값만. 원문은 [05_hr.md](./05_hr.md)의 복호화 표면이 4요건을 통과해야 준다 |

- 검색 입력은 trim · 길이 제한 · 특수문자 이스케이프를 거친다. q는 서버가 대상 필드를 정하며 클라이언트가 지정하지 않는다.
- 멤버십은 인사 레코드·근로조건과 1:1 연계된다. 상세 응답의 인사 필드는 **참조 요약**이고 정본 표면은 [05_hr.md](./05_hr.md)다.

### 21·22. 역할 변경·역할 이력 (WRK-07)

| 항목 | 21. 역할 변경 | 22. 역할 이력 |
|------|--------------|--------------|
| 권한 | **OWNER 전용** | MANAGER |
| 입력 | role(MANAGER 또는 STAFF) · reason(필수) | 오프셋 |
| 허용 전이 | MANAGER ↔ STAFF **둘뿐**이다. role에 OWNER를 지정하면 workplace.role_change_forbidden/403 | — |
| 차단 | 마지막 OWNER 강등 · 본인 권한 자가 제거로 OWNER 0명 → **workplace.owner_singleton/409** 또는 **workplace.last_owner/409** · 대상 멤버십 부재 → workplace.member_not_found/404 | — |
| 부수효과 | membership_role_events INSERT · 대상자에게 role_changed 알림 · **대상자 세션의 권한 캐시 즉시 무효화** | — |

- **OWNER 단일성은 서비스 레이어와 DB 제약 양쪽에서 강제한다**(D-13). 표면 검증만으로는 동시 요청 두 건을 막을 수 없다.
- **역할 회수 후에도 그 사람이 만든 근태·급여 데이터는 유지되고 감사 로그에 행위자로 남는다**(REQ-WRK-23). 이 표면은 데이터를 지우지 않는다.
- 권한 캐시 무효화가 없으면 강등된 MANAGER가 캐시 수명 동안 관리 표면을 계속 통과한다.

### 23·24. 멤버 제외 선행조건·실행 (WRK-09)

| 항목 | 23. 선행조건 점검 | 24. 제외 실행 |
|------|------------------|--------------|
| 입력 | — | reason(필수) · effectiveDate(필수) |
| 응답 | blockers 배열 — 비어 있으면 제외 가능 | 204 |
| 권한 판정 | — | OWNER는 MANAGER·STAFF를, MANAGER는 STAFF만. **OWNER 본인은 제외할 수 없다** |
| 차단 조건 | 아래 4종을 배열로 반환한다 | 같은 4종을 코드로 반환한다 |

```plain
blockers                                        제외 실행 시 코드
├─ 대상이 마지막 OWNER                          workplace.last_owner/409
│    → v1에 양도가 없으므로 폐쇄 경로(#26)를 안내한다
├─ 대상자의 급여 확정이 진행 중                  workplace.payroll_in_progress/409
├─ 대상자가 진행 중 승인의 필수 승인자           workplace.pending_approver/409
└─ 제외 후 사업장 활성 직원이 0명                workplace.employee_required/409
```

- 멤버십 전이는 축이 둘이다 — **본인 이탈은 LEFT, 강제 제외는 REMOVED**다. #24는 REMOVED만 만들고, 퇴사 처리([05_hr.md](./05_hr.md))는 **퇴사 사유에 따라 LEFT(자진 · 계약만료) 또는 REMOVED(권고사직 · 해고)** 를 만들며 탈퇴([03_auth.md](./03_auth.md))는 LEFT만 만든다.
- **제외 후에도 근태·급여·명세서·근로계약은 법정 보존한다.** 본인은 보존기간 내 계속 열람하며 인가 축은 멤버십이 아니라 본인 소유권이다([09_payslip.md](./09_payslip.md)).
- 퇴사에 따른 제외는 퇴사 처리와 연동해 4대보험 상실·정산을 함께 트리거한다(REQ-WRK-28).

### 25·26. 폐쇄 선행조건·폐쇄 실행 (WRK-10)

| 항목 | 25. 선행조건 점검 | 26. 폐쇄 실행 |
|------|------------------|--------------|
| 권한 | OWNER | OWNER · **X-Reauth-Token 필수**(purpose=WORKPLACE_CLOSE) |
| 입력 | — | reason(필수) · retentionAcknowledged 불리언 |
| 응답 | blockers 배열 + 보존 안내 문안 + 보존 대상 건수 요약 | 전이된 사업장 자원 |
| 차단 | 진행 중 급여 확정 · 미발행 명세서 · 미처리 승인 | **workplace.close_blocked/409** + 미충족 항목 상세 · 보존 안내 미확인은 **workplace.retention_ack_required/422** · 재인증 미충족은 auth.reauth_required/401 |
| 전이 후 | — | CLOSED — **신규 업무 생성 차단 + 읽기 전용**. 법정 보존 데이터는 유지된다 |
| 멤버십 처리 | — | **같은 트랜잭션이 OWNER 멤버십을 종료 상태로 전이시킨다.** 폐쇄 후 남은 OWNER 멤버십을 탈퇴가 뒤늦게 전이시키면 OWNER 단일성 가드와 폐쇄 읽기전용 가드가 그 트랜잭션을 막는다([03_auth.md](./03_auth.md) #13) |

- 선행조건 5종은 ① 진행 중 급여 확정 없음 ② 미발행 명세서 없음 ③ 미처리 승인 없음 ④ 보존 안내 확인 ⑤ 재인증이다(REQ-WRK-36).
- **플랫폼 관리자의 강제 폐쇄는 별개 경로**다 — [14_system.md](./14_system.md)의 사업장 강제 폐쇄 표면이며 OWNER 재인증 없이 사유만으로 수행한다.
- **양도(OWNER 이전) 표면을 두지 않는다.** v1의 사업장 이탈 경로는 폐쇄뿐이며, 예약된 코드 workplace.transfer_invalid는 발생 지점이 없다.

### 27·28·29·30. 임포트 2단계 — 업로드·목록·미리보기·확정 (WRK-16)

```plain
27. 업로드 (MANAGER)                     30. 확정 (OWNER · Idempotency-Key)
    multipart/form-data                      ↓
    ① 크기 상한 → 413                        ① 미리보기 결과 재확인(파일 해시 일치)
    ② MIME·매직넘버 검증 → 400                ② 활성 멤버 수 재검증 → 402
    ③ import_jobs INSERT(**UPLOADED**)       ③ 트랜잭션 — 검증 통과 행만 커밋
    ④ 행별 검증 실행 → **VALIDATED**          ④ 민감정보 즉시 암호화(AES-GCM)
    ⑤ 202 + importJobId                      ⑤ import_jobs UPDATE(건수 + 상태)
        ↓                                       전량 성공 → **COMMITTED**
29. 미리보기 (MANAGER)                           일부 실패 → **PARTIALLY_COMMITTED**
                                             ⑥ 감사 로그 기록
                                             ⑦ 200 + 실패 상세 리포트 참조
    검증 결과 · 오류 행 · 한도 초과 경고
    **어떤 데이터도 커밋되지 않은 상태**
```

| 항목 | 내용 |
|------|------|
| 임포트 유형 | importType ∈ EMPLOYEES · OPENING_BALANCE. 후자는 근태·급여·**연차 잔액 기초값** 적재다(REQ-WRK-34) |
| 미리보기 계약 | #27 · #29 단계에서는 **어떤 데이터도 커밋하지 않는다**. 전체 롤백이 가능한 유일한 구간이다 |
| 행 검증 실패 | **import.validation_failed/422** — details에 행 번호 · 필드 · 사유를 담는다 |
| 중복 검출 2종 | 파일 내 행간 중복은 **import.duplicate_employee/409**, 기존 DB 직원과의 중복은 **hr.duplicate_active_employee/409** 또는 **hr.resident_no_duplicate/409**다. 주민번호 판정은 복호화 없이 blind-index로 한다 |
| 상태 집합 | UPLOADED · VALIDATED · **COMMITTED** · **PARTIALLY_COMMITTED** · CANCELLED · FAILED. 값 정의의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다 |
| 부분 실패 | 확정은 **검증 통과 행만 커밋**하고 실패 행은 건너뛴다. 응답은 **200 + status = PARTIALLY_COMMITTED + 성공·실패 건수 + 실패 리포트 참조**이며 **오류가 아니다** |
| 실패 행 후속 | **실패 리포트(CSV)를 내려받아(#31 → #32) 원본을 고친 뒤 새 업로드(#27)로 다시 올린다.** 같은 작업을 다시 돌리는 원클릭 재실행 표면을 두지 않는다 — 이미 커밋된 행이 무엇인지 서버가 파일과 대조할 수 없어 중복 생성 위험이 크다 |
| import.rollback_required | **확정 트랜잭션이 원자 단계에서 실패해 커밋분 자체가 무효화된 경우**에만 낸다(409 · 전체 재실행 필요). **행 단위 부분 실패는 이 코드를 내지 않는다** |
| 확정 권한 | **OWNER 전용**이다. 업로드·미리보기는 MANAGER 이상이며 이 경계는 노무·운영 확인이 필요한 항목으로 등재돼 있다(REQ-WRK-33) |
| 기초값 취급 | 적재 데이터는 source=IMPORT로 표시하고 **급여 계산·연차 산정의 기산 기준으로만** 쓴다. **명세서 자동 생성 대상에서 제외**한다 |
| 목록(#28) | status 필터는 **6값 전량**(UPLOADED · VALIDATED · COMMITTED · **PARTIALLY_COMMITTED** · CANCELLED · FAILED)을 받는다 · importType · 기간 필터 · 오프셋. 전체·성공·실패 건수를 함께 준다 · 올린 사람 · **확정한 사람(committedByName — 확정은 OWNER 전용이라 올린 사람과 다를 수 있다)** |

- **이미 사용한 연차를 적재할 경로가 없으면 잔액이 0부터 시작해 연차 계산이 처음부터 틀린다**(REQ-LEV-07). OPENING_BALANCE 유형이 그 경로이며 원장에 ADJUST로 남는다([07_leave.md](./07_leave.md)).
- #30이 멱등키 필수인 이유는 커밋이 되돌릴 수 없어서다. 네트워크 재시도로 같은 파일이 두 번 커밋되면 직원 레코드가 중복 생성되고, 그때는 hr.duplicate_active_employee가 아니라 이미 만들어진 행을 지우는 문제가 된다.
- **PARTIALLY_COMMITTED는 정상 종료 상태다.** 성공 행은 그대로 살아 있고 되돌리지 않는다 — 전체를 롤백하면 정상 등록된 직원까지 사라져 관리자가 처음부터 다시 올려야 한다. 그래서 후속은 **차집합만 다시 올리는 흐름**이고, 재업로드분이 기존 행과 겹치면 hr.duplicate_active_employee/409 · hr.resident_no_duplicate/409가 막는다.

### 31·32. 임포트 실패 리포트 토큰·다운로드 (WRK-16)

| 항목 | 31. 토큰 발급 | 32. 스트리밍 다운로드 |
|------|--------------|---------------------|
| 권한 | MANAGER | 토큰 소유자 |
| 처리 | 대상 import_job의 error_report에 대한 1회용 토큰을 발급한다 | 토큰 검증(단기 만료 · 1회 소비 · 세션·IP·user agent 보조 바인딩) 후 CSV를 스트리밍한다 |
| 응답 | token · expiresAt | Content-Disposition: attachment. 본문은 행 번호 · 필드 · 사유 · 원본 값 요약 |
| 실패 | common.not_found/404(리포트 없음) | **payslip.download_token_expired/410**(만료·재사용) |

- 다운로드 토큰 규약은 명세서·민감 문서와 **같은 코드를 공유한다**([01_conventions.md](./01_conventions.md)). 코드 정의처는 [09_payslip.md](./09_payslip.md)다.
- 리포트에 **주민번호·계좌 원문을 담지 않는다** — 실패 사유 판별에 필요한 마스킹 값까지만 싣는다.

### 33·34. 서버 내부 종점 2종 (WRK-04 · WRK-05 · WRK-14)

| 항목 | 33. expireInvitations (배치) | 34. 검증 대기 자동 정지 판정 (서버) |
|------|------------------------------|-----------------------------------|
| 실행 | 정기작업 · 30분 주기 · 분산락 · 멱등 | #3 · #7 · #8 진입 시점과 사업장 접근 시점의 동기 판정 |
| 동작 | PENDING 초대 중 만료 시각이 지난 것을 EXPIRED로 전이하고 대상자·초대자에게 알린다 | pendingSince + 정책 기한(N일)이 지난 PENDING_VERIFICATION 사업장을 SUSPENDED로 전이하고 OWNER에게 알린다 |
| 표면 없음 근거 | 사용자가 요청할 일이 아니다. 30분 주기인 것은 만료 판정 지연이 곧 "만료됨"과 "무효"의 응답 차이가 되어 원인을 알 수 없게 만들기 때문이다 | 정지 판정은 사업장 소유자의 요청과 무관하게 성립해야 한다 |
| 경계 | **재발송으로 무효화된 직전 토큰은 이 작업과 무관하게 즉시 무효**다. 이미 응답된 초대는 상태 조건으로 건드리지 않는다 | v1 정기작업 8건에 전용 작업이 없어 **접근 시점 판정**으로 수행한다. **정책 기한은 14일로 확정됐고(사용자 확정) 기준값 등록 전에는 판정 자체를 하지 않는다** |

### 35·36. 목록 공통 내보내기 — 토큰 발급·다운로드 (DSH-06)

화면이 목록을 조회한 **조건 그대로**(검색어 · 필터 · 정렬 · 표시 열) 서버가 XLSX를 만든다. **발급은 조건을 봉인하고 파일은 내려받는 순간 만든다** — 파일을 미리 만들어 저장하면 5분 뒤 버려질 업무 데이터 사본이 보존 · 파기 대상 밖에 남는다. 브라우저에서 만들지 않는 근거는 D-23이다(누적 목록을 끝까지 불러와야 하고 민감정보 반출이 서버가 모르는 경로가 된다).

```plain
35. 발급 (목록의 조회 권한)                      36. 다운로드 (토큰 소유자)
    ① listType 등재 확인                             ① 토큰 GETDEL 소비 · 소유자 대조
       없음 → 400 · 표면 불일치 → export.forbidden/403     실패 전부 → export.expired/410
    ② 목록의 인가 — 그 목록 조회 표면과 같은 코드      ② 읽기 전용 스냅샷(REPEATABLE READ)
    ③ 필터 키 · 열 · 정렬 방향 · 사유(민감 목록)          목록의 인가를 다시 판정 → 전 행 기록
       → 모아서 common.validation_failed/400         ③ 트랜잭션 밖 XLSX 작성
    ④ 필터 값 · 검색어 · 정렬 필드 — 목록 규칙          ④ 감사 1행(list.export · list.export_sensitive)
    ⑤ 조건을 1회용 토큰에 봉인                       ⑤ attachment 스트리밍 → 임시 파일 삭제
    ⑥ 200 + token · fileName · expiresIn
```

요청 본문(#35)이다. **선언하지 않은 필드는 거부한다.**

| 필드 | 형식 | 규칙 |
|------|------|------|
| listType | 문자열 · 필수 | 목록 식별자. 아래 목록 표의 값만 받는다 |
| q | 문자열 · 선택 | 검색어. 길이 상한 · 이스케이프는 **그 목록 조회 표면의 규칙**이다 |
| filters | 객체(키 → 문자열) · 선택 | 키는 **그 목록 조회 표면의 쿼리 파라미터 이름**이다. 선언 밖 키는 필드 오류 filters.{키}이고 값의 해석도 목록 규칙이다(다중 값은 쉼표) |
| sort · order | 문자열 · 선택 | 정렬 필드는 목록의 화이트리스트 · 방향은 asc · desc. 생략은 목록의 기본 정렬이다 |
| columns | 문자열 배열 · 선택 | 실을 열 키. **목록이 선언한 열의 부분집합만** 받고 순서가 파일의 열 순서다. 비우면 목록의 기본 열이다. 중복 · 선언 밖은 필드 오류 columns다 |
| reason | 문자열 · 민감 목록은 필수 | 최대 500자. 민감 목록에서 비면 필드 오류 reason이다 |

| 항목 | 35. 발급 | 36. 다운로드 |
|------|---------|-------------|
| 권한 | **그 목록의 조회 권한 그대로**(아래 목록 표) | 토큰 소유자 — 파일을 만드는 순간 **목록의 인가를 다시 판정**한다 |
| 응답 | 200 · token · fileName(예 직원_목록_20260916-1430.xlsx) · **expiresIn**(초 · 정수) | 200 · XLSX(attachment · filename*=UTF-8'' · no-store · nosniff) |
| 토큰 | 단기 만료 · 1회 소비 · 세션·IP·user agent 보조 바인딩([01_conventions.md](./01_conventions.md) 다운로드 규약) | 없음 · 만료 · 재사용 · 바인딩 불일치 · **소유자 불일치**가 전부 **export.expired/410** |
| 실패 | common.validation_failed/400 · **export.forbidden/403** · 목록 조회 표면의 인가 코드 | export.expired/410 · **export.failed/500**(파일 작성 실패) · 목록 조회 표면의 인가 코드(발급 뒤 권한 회수) |

목록 표 — **목록 식별자의 정본은 이 표**다. 행은 목록을 소유한 도메인의 구현이 서는 변경 단위에서 더한다.

| listType | 목록 조회 표면 | 민감 |
|----------|--------------|:---:|
| employees | [05_hr.md](./05_hr.md) #1 직원 목록 | ● |
| contracts | [05_hr.md](./05_hr.md) #20 근로계약 목록 | |
| documents | [05_hr.md](./05_hr.md) #28 문서함 목록 | ● |
| members | 이 문서 #19 멤버 목록 | ● |
| invitations | 이 문서 #10 초대 목록 | ● |
| imports | 이 문서 #28 임포트 작업 목록 | |
| attendance_change_requests | [06_attendance.md](./06_attendance.md) #12 근태 수정 요청 목록 | |
| attendance_daily_summaries | [06_attendance.md](./06_attendance.md) #9 일 집계 목록(범위 조회) | |
| attendance_closings | [06_attendance.md](./06_attendance.md) #16 마감 목록 | |
| leave_requests | [07_leave.md](./07_leave.md) #3 휴가 신청 목록 | |
| leave_balances | [07_leave.md](./07_leave.md) #8 잔여 연차 목록 | |
| payslips | [09_payslip.md](./09_payslip.md) #2 명세서 목록 | ● |
| payroll_runs | [08_payroll.md](./08_payroll.md) #11 실행 목록 | ● |
| payroll_run_employees | [08_payroll.md](./08_payroll.md) #13 직원별 결과(filters.runId 필수) | ● |
| tax_insurance_reports | [10_tax.md](./10_tax.md) #2 신고자료 목록 | ● |
| tax_separation_certificates | [10_tax.md](./10_tax.md) #6 이직확인서 목록 | ● |
| compliance_tasks | [11_compliance.md](./11_compliance.md) #8 기한 과제 목록 | |
| retention | [11_compliance.md](./11_compliance.md) #6 법정 서류 보존 목록 | |
| employee_count_snapshots | [11_compliance.md](./11_compliance.md) #1 스냅샷 목록(q 미지원 — 표면 자체가 검색어를 받지 않는다) | |

급여 미리보기([08_payroll.md](./08_payroll.md) #8) · 급여 기준 이력 · 퇴직 정산은 **listType을 두지 않는다** — 저장되지 않는 산출이거나(미리보기) 직원 단위 상세라 사업장 단위 목록 표면 자체가 없다(급여 기준 · 퇴직 정산은 employees가 이미 직원 목록을 내보낸다).

- **listType은 목록 조회 표면 경로에서 유도한다** — 사업장 경로 뒤 자원 세그먼트를 밑줄로 이은 lower_snake다(/employees → employees · /attendance/change-requests → attendance_change_requests). **경로 변수가 낀 자식 자원은 그 변수를 빼고 부모를 단수화해 자식과 잇는다**(/payroll-runs/{payrollRunId}/employees → payroll_run_employees). 시스템 콘솔 목록은 system_ 접두를 붙인다([14_system.md](./14_system.md) #36). 규칙이 있어야 목록이 늘 때 이름을 따로 합의하지 않는다.
- **민감(●)은 사유 필수 · list.export_sensitive · 사업장 관리자 비개방**, 그 밖은 **list.export**(사유 선택 · 개방)다. 판정 기준은 **파일이 담는 값**이다 — 개인 식별 · 연락 · 임금 · 신고 정보가 한 파일에 모이면 민감이다. 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)(사유 필수 ⑰ · 기록 구조)다.
- **열은 목록이 선언한 화이트리스트 안에서만 고른다.** 주민등록번호는 **원문도 마스킹 값도** 선언하지 않는다 — 목록 화면은 식별 보조로 마스킹 값을 보이지만 파일은 화면 밖으로 나가 통제가 끝나는 산출물이다.
- **칸은 전부 문자열이다.** 금액 · 정수 · 날짜도 숫자 칸 · 날짜 칸(배정도)을 지나지 않는다(REQ-GLB-02 · 임금대장 XLSX와 같은 규약). 비운 값은 빈 칸이고 0으로 채우지 않는다. 시각은 **KST**로 적는다 — 응답(UTC)과 달리 사람이 읽는 산출물이다. enum은 화면과 같은 한국어 이름이다.
- **쪽 번호 · 크기를 받지 않는다.** 내보내기는 조건에 맞는 **전 행**이다 — 화면이 불러온 묶음만 내보내면 파일이 목록 전체인 척한다. 쪽을 나눠 읽는 동안 행이 밀리지 않게 **한 스냅샷**으로 읽는다.
- **멱등키를 요구하지 않는다.** 발급의 부수효과는 1회용 토큰 하나이고, 멱등 재생은 **첫 응답의 토큰을 그대로 돌려주는데 그 토큰은 이미 소비됐을 수 있다** — 재시도가 쓸 수 없는 토큰을 받는다. 중복 발급은 쓰이지 않은 토큰이 만료로 사라질 뿐이다([08_payroll.md](./08_payroll.md) #21과 같은 판단).
- **감사는 발급이 아니라 #36에서 한 번 남긴다.** 발급만 하고 내려받지 않은 토큰은 아무것도 반출하지 않았다. **기록이 전송보다 먼저**이며 기록이 실패하면 파일을 내보내지 않는다. 전후값에 **검색어 원문을 담지 않는다**(이름 검색어가 곧 개인 식별 값이다).
- **표면이 어긋난 목록 요청이 export.forbidden/403이다** — 등재된 시스템 콘솔 목록을 이 표면에서 요청하는 경우다. 형식 오류가 아니라 권한 범위 위반이며, **목록 자체의 조회 권한 미충족은 그 목록 조회 표면의 코드 그대로**(auth.workplace_forbidden/403 등)다 — 같은 사유에 두 코드를 두지 않는다.
- **전용 내보내기를 대체하지 않는다** — 임금대장([08_payroll.md](./08_payroll.md) #21) · 근로자명부([05_hr.md](./05_hr.md)) · 신고자료([10_tax.md](./10_tax.md)) · 감사 로그([14_system.md](./14_system.md) #20)는 법정 서식이나 별도 계약을 가진다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| workplace.business_invalid | 422 | 진위확인 불일치 또는 **폐업** 사업자 | #1 · #2 · #8 |
| workplace.business_api_unavailable | 503 | 국세청 API 장애·timeout·호출량 초과 | #2 · #8 |
| workplace.duplicate_site | 409 | (business_no, site_label) 완전 중복. **동일 사업자번호의 복수 사업장 등록 자체는 허용**한다 | #1 |
| workplace.verification_pending | 409 | 검증 대기 상태에서 급여 확정·명세서 발행 시도 | (#7이 예고 · 발생은 [08_payroll.md](./08_payroll.md) · [09_payslip.md](./09_payslip.md)) |
| workplace.immutable_field | 422 | businessNo · ownerName · openDate 변경 시도 | #4 |
| workplace.already_member | 409 | 초대 대상이 이미 ACTIVE 멤버 | #9 |
| workplace.invite_role_forbidden | 403 | MANAGER의 MANAGER·OWNER 초대 · OWNER 역할 지정 | #9 · #11 |
| workplace.closed | 409 | SUSPENDED·CLOSED 사업장에서 초대 수락 시도 | #14 · #16 |
| workplace.unavailable | 409 | SUSPENDED·CLOSED 사업장으로 컨텍스트 전환 시도 | #18 |
| workplace.role_change_forbidden | 403 | 역할 변경 권한·경로 위반 | #21 |
| workplace.owner_singleton | 409 | ACTIVE OWNER 1명 불변식 위반 | #21 · #24 |
| workplace.last_owner | 409 | 마지막 OWNER 강등·제외 시도 | #21 · #23 · #24 |
| workplace.payroll_in_progress | 409 | 급여 확정 진행 중인 대상자의 멤버 제외 차단 | #23 · #24 |
| workplace.pending_approver | 409 | 미처리 승인의 필수 승인자 제외 차단. **승인자 재배정이 선행**해야 한다 | #23 · #24 |
| workplace.member_not_found | 404 | 대상 멤버십 부재 | #20 · #21 · #22 · #23 · #24 |
| workplace.member_state_conflict | 409 | REMOVED·SUSPENDED 이력 멤버십의 재초대 수락 | #14 · #16 |
| workplace.employee_required | 409 | **멤버 제외로** 사업장 필수 직원(최소 1명) 미달. 퇴사 처리의 선행조건 차단은 hr.resignation_blocked/409가 담당한다 | #23 · #24 |
| workplace.close_blocked | 409 | 폐쇄 전 미완 급여·미발행 명세서·미처리 승인 존재. **미충족 항목을 details로 반환**한다 | #25 · #26 |
| workplace.retention_ack_required | 422 | 폐쇄 시 법정 보존 안내 미확인 | #26 |
| workplace.transfer_invalid | 422 | 양도 검증 실패 — **v1 발생 지점 없음**(양도 미채택 · 코드만 예약) | 없음 |
| workplace.business_unit_overlap | 409 | 같은 소유자·명칭의 사업 단위 선언 유효기간 겹침(business_units EXCLUDE) — 주로 **동시 선언 경합** | (발생은 [11_compliance.md](./11_compliance.md) #11) |
| **workplace.mgmt_no_required** | 422 | 신고자료 생성 시 **대상 보험 계열의 사업장관리번호가 비어 있음**. 해소 자리는 #4이며 **비어 있는 계열을 details로 반환**한다 | (#4가 해소 · 발생은 [10_tax.md](./10_tax.md)) |
| invitation.expired | 410 | EXPIRED 토큰으로 수락 시도 | #14 · #16 |
| invitation.invalid_token | 422 | 토큰·공유코드 무효 — 재발송으로 무효화된 직전 토큰 포함 | #14 · #16 |
| invitation.already_responded | 409 | 이미 응답한 초대의 재수락·재거절 · **이미 응답된 초대의 재발송·취소 시도**. 재발송은 종단 상태(REJECTED · EXPIRED)에서만 새 행을 만든다 | #11 · #12 · #14 · #15 |
| import.validation_failed | 422 | 행 단위 검증 오류 — 행 번호·필드·사유를 details에 담는다 | #27 · #29 · #30 |
| import.duplicate_employee | 409 | 업로드 파일 내 행간 중복(동일 username·주민번호) | #27 · #30 |
| import.rollback_required | 409 | **확정 트랜잭션이 원자 단계에서 실패해 커밋분이 무효화됨** — 전체 재실행이 필요하다. 행 단위 부분 실패는 이 코드가 아니라 200 + PARTIALLY_COMMITTED다 | #30 |
| hr.duplicate_active_employee | 409 | 기존 DB의 ACTIVE 직원과 중복 | #30 |
| hr.resident_no_duplicate | 409 | 동일 사업장 주민번호 중복 — blind-index 판정 | #30 |
| subscription.workplace_limit_exceeded | 402 | 소유 사업장 수 한도 초과 | #1 |
| subscription.staff_limit_exceeded | 402 | 활성 멤버 수 한도 초과 — 초대 발송·수락·임포트 | #9 · #11 · #14 · #16 · #30 |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 | 전 사업장 스코프 표면 · #18 |
| auth.reauth_required | 401 | 폐쇄 재인증 미충족 | #26 |
| payslip.download_token_expired | 410 | 리포트 다운로드 토큰 만료·재사용 | #32 |
| export.forbidden | 403 | **등재된 목록을 그 목록이 속하지 않은 표면에서 요청** — 시스템 콘솔 목록을 사업장 표면으로 꺼내는 경우 | #35 |
| export.expired | 410 | 목록 내보내기 토큰의 없음 · 만료 · 재사용 · 바인딩 불일치 · 소유자 불일치 | #36 |
| export.failed | 500 | 목록 내보내기 파일(XLSX) 작성 실패 | #36 |
| common.payload_too_large | 413 | 임포트 파일 크기 초과 | #27 |
| common.rate_limited | 429 | 진위확인 호출 빈도 초과 | #2 |
| common.not_found | 404 | 사업장·초대·임포트 작업 부재 또는 존재 은닉 | #3 · #13 · #29 · #31 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 | 전 REST 표면 |
| common.invalid_format | 400 | 사업자번호 체크섬 · 좌표 · 날짜 형식 오류 | #1 · #2 · #5 |

- **이 표는 workplace 네임스페이스 전량과 invitation 3종 · import 3종을 담는다** — 종수의 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 **여기서 세지 않는다.**
- **이 문서에 발생 표면이 없는 코드도 담고 표면 열에 그 사실을 적는다.** 사업장의 상태나 설정값이 비어 **다른 도메인 표면에서 차단이 나는 형태**가 이 네임스페이스의 상수이며, 빼면 사업장 담당자가 자기 도메인의 코드를 한자리에서 볼 수 없다. **어느 코드가 그런지 열거하지 않는다** — 표면 열이 코드마다 그것을 적는다.
- 정의처가 다른 코드는 발생만 한다 — subscription 2종은 [13_subscription.md](./13_subscription.md), hr 2종은 [05_hr.md](./05_hr.md), payslip 토큰 코드는 [09_payslip.md](./09_payslip.md), **export 3종은 [14_system.md](./14_system.md)**가 정의한다.
- **#35 · #36은 목록 조회 표면의 인가 코드를 그대로 낸다** — 목록이 다른 도메인이면 그 도메인의 코드이고 여기서 열거하지 않는다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| workplaces | #1 INSERT · #3~#8 · #17 · #18 SELECT · #4 · #5 · #26 · #34 UPDATE | 테넌트 루트 — business_no · site_label · status · 좌표 · geofence_radius_m · tax_unit_type · site_role · **보험 계열별 관리번호 3**(#4 가 쓰는 열 · 신고자료의 사업장 축 입력) |
| business_units | #1 SELECT·INSERT | 동일 business_no 사업장 그룹 연결. v1 기본은 GENERAL이며 사업자단위과세는 확장 지점으로만 둔다 |
| workplace_members | #1 · #14 · #16 INSERT · #14 · #21 · #24 UPDATE · #17~#20 SELECT | 멤버십 — role · status(ACTIVE·LEFT·REMOVED) · last_selected_at. OWNER 단일성 제약이 최종 강제다 |
| workplace_invitations | #9 · #11 INSERT · #10 · #13 SELECT · #12 · #14 · #15 · #33 UPDATE | 초대 — token_hash · status · expires_at · invitation_type |
| workplace_change_logs | #4 · #5 INSERT · #6 SELECT | 정보 변경 이력 — 전후값 · 유효시작일 · 변경자 |
| membership_role_events | #21 INSERT · #22 SELECT | 역할 변경 이력 — 전후 역할 · 처리자 · 사유 |
| business_verification_logs | #1 · #2 · #8 INSERT | 진위·상태 조회 이력 — result · latency · 응답 요약. **원문 민감 데이터는 최소 보관한다** |
| import_jobs | #27 INSERT · #28 · #29 · #31 SELECT · #30 UPDATE | 임포트 작업 — import_type · status · 건수 · error_report |
| employees | #14 · #16 · #30 INSERT · #23 · #24 SELECT | 초대 수락·임포트가 생성하는 인사 레코드. 쓰기 계약의 정본은 [05_hr.md](./05_hr.md)다 |
| employee_personal_infos | #30 INSERT | 임포트 확정 시 민감정보 즉시 암호화 저장 |
| plans · subscriptions | #1 · #9 · #11 · #14 · #16 · #30 SELECT | 소유 사업장 한도와 활성 멤버 한도 조회 대상 |
| payroll_runs · payslips · attendance_change_requests · leave_requests | #23 · #25 SELECT | 제외·폐쇄 선행조건 판정의 입력 — 진행 중 급여 · 미발행 명세서 · 미처리 승인 |
| notifications | #9 · #12 · #14 · #15 · #21 · #24 · #33 · #34 INSERT | 초대·역할·제외·정지 알림. 발송 실패가 원 트랜잭션을 롤백하지 않는다 |
| audit_logs | **#4** · **#5** · **#9** · **#11** · **#12** · #21 · #24 · #26 · #30 · **#36** INSERT | 사업장 수정 **workplace.update**(#4 · #5) · 초대 발송 **workplace_invitation.send**(#9 · #11) · 초대 취소 **workplace_invitation.cancel**(#12) · 역할 변경 **workplace_member.role_change**(#21) · 멤버 제외 **workplace_member.remove**(#24) · 폐쇄 **workplace.close**(#26) · 임포트 확정 **import_job.commit**(#30) · 목록 내보내기 **list.export** · **list.export_sensitive**(#36 — 목록의 민감 선언이 코드를 고른다). **사유 필수는 #26 · #30과 민감 목록을 내려받는 #36이다** — 나머지는 사유를 요구하지 않는다. **#5 지오펜스 수정도 workplace.update이고 #11 재발송도 workplace_invitation.send다.** 지오펜스는 사업장 속성이고 무엇이 바뀌었는지는 before/after 값이 담으므로 **표면이 둘이라는 이유만으로 코드를 나누지 않는다** — 나누면 "어느 열을 고쳤는가"마다 코드가 생긴다. 재발송은 REQ-WRK-14에 따라 **기존 행을 되돌리지 않고 새 행 생성 + 직전 토큰 무효화로만** 하므로 **새 초대를 만드는 행위이고 곧 발송**이며, 직전 행의 무효화는 **그 행 자신의 전이로 기록되지** 재발송의 별개 코드가 아니다. action 코드의 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)이며 **여기서 신설하지 않는다**(표기 규약 [01_conventions.md](./01_conventions.md) 연동 테이블의 코드 표기) |
| workplace_employee_count_snapshots | #1 SELECT | 복수 사업장 등록 시 합산 판정 요구 안내의 근거 조회 |
| (목록별) | **#36 SELECT** | 목록 조회 표면이 읽는 테이블 그대로다 — 읽는 것의 정본은 그 표면 문서이며 **#35는 테이블을 읽지 않는다**(인가 · 형식 판정만). 토큰은 Redis에만 두고 파일은 저장하지 않는다 |

## 추적성

기능명·우선순위의 정본은 [../02_features/02_workplace.md](../02_features/02_workplace.md)다.

| 기능ID | 표면 |
|--------|------|
| WRK-01 사업장 등록 | #1 |
| WRK-02 사업자 진위/상태 검증 | #2 |
| WRK-03 사업장 정보 관리 | #3 · #4 · #5 · #6 |
| WRK-04 직원 초대 | #9 · #10 · #11 · #12 · #33(배치) |
| WRK-05 초대 수락/거절 | #13 · #14 · #15 · #16 · #33(배치) |
| WRK-06 사업장 선택/전환 | #17 · #18 |
| WRK-07 멤버 역할 관리 | #21 · #22 |
| WRK-08 멤버 목록·검색 | #19 · #20 |
| WRK-09 멤버 제외 | #23 · #24 |
| WRK-10 사업장 폐쇄 | #25 · #26 |
| WRK-11 사업장 등록 한도 | #1(게이팅 실행 지점) · 사용량 조회는 [13_subscription.md](./13_subscription.md) 참조 |
| WRK-14 사업장 검증 상태 관리 | #7 · #8 · #34(서버) |
| WRK-16 데이터 온보딩·일괄 임포트 | #27 · #28 · #29 · #30 · #31 · #32 |
| **DSH-06 리포트 내보내기** | **#35 · #36** · 시스템 콘솔 목록의 발급은 [14_system.md](./14_system.md) #36 |

**WRK 13기능과 DSH-06 전수를 담았다**(위 표 14행 — 기능 행의 정본 [../02_features/02_workplace.md](../02_features/02_workplace.md)). 자체 표면이 없는 기능은 WRK-11 하나이며, 게이팅이 등록 트랜잭션 안에서만 일어나고 사용량 조회의 정본이 구독 도메인이기 때문이다.

## 관련 문서

- 전역 규약·멱등·페이지네이션·다운로드 토큰 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/02_workplace.md](../02_features/02_workplace.md) · 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 요구사항 정본 → [../03_requirements/03_workplace.md](../03_requirements/03_workplace.md) · 전역 규칙 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 인사 레코드·민감정보 → [05_hr.md](./05_hr.md) · 한도 정의처 → [13_subscription.md](./13_subscription.md) · 합산 판정 → [11_compliance.md](./11_compliance.md) · 강제 폐쇄 → [14_system.md](./14_system.md)
- 멀티테넌시·RLS 2단 방어 → [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)
- 테이블 명세 → [../05_database/02_workplace.md](../05_database/02_workplace.md)
- 상태 머신 3종 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) · 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
- 확정 의사결정(D-11 · D-12 · D-13 · D-18) → [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)
