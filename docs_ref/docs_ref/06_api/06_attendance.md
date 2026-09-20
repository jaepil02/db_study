# 06_api / 06 근태 (ATT)

> **대상**: ATT 도메인 REST 표면 — 출퇴근 체크인과 지오펜스 서버 재검증 · 휴게 기록 · 일 집계와 8 법정 시간버킷 · 근태 수정 요청과 승인 · **일괄 승인·반려** · 월 마감과 재오픈 · 근무 스케줄 · 휴게 준수 검증 · 근로시간 한도 경고
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **#12 근태 수정 요청 목록 항목에 그 날의 현재 출근 · 퇴근 시각을, #17 선점검의 미승인 수정 요청 차단에 직원 이름 · 대상 일자를 더한다**(대조 · 바로가기). 표면 수 · 권한 불변
> **개정일**: 2026-09-16 — **#12 근태 수정 요청 목록에 q(직원명 · 사유 부분 일치)를 더한다.** 길이 상한 · ESCAPE 규약은 [01_conventions.md](./01_conventions.md)가 정본이고 여기서 다시 정의하지 않는다. **표면 신설 없음 · 필터 필드 1종 추가**
> **개정일**: 2026-09-16 — **표면 27 → 29**(REST 26 → **28**) — 근태 수정 요청 **일괄 승인 #28 · 일괄 반려 #29**를 말미에 채번한다(웹의 행별 루프를 서버 한 번으로 · 멱등 필수). 행마다 단건 #14 · #15를 그대로 지나 **각자 한 트랜잭션**이고 부분 실패는 200의 행 결과다. **ATT-10 실시간 근태 현황**(D-23)을 추적성에 등재한다 — **신규 표면 없음**(기존 조회 조합). 에러 코드 · action 코드 신설 0
> **개정일**: 2026-09-10 — **#25 응답의 대상 범위를 명시**한다 — 기간의 모든 근무일을 내고 위반은 violated 플래그로 가른다. 표면 이름(준수 검증)이 위반 목록으로 읽혀 화면이 조회 일수를 휴게 미달로 세고 있었다(웹 세션 실측). 계약 표의 필드 열거(위반 여부)는 원래 그 형태였고 문장 하나가 빠져 있던 자리다. **표면 수 27 · 번호 · 에러 코드는 전건 불변**
> **개정일**: 2026-09-10 — **원본이 없는 날의 승인 계약을 등재**한다(#11 · #14). 출근 체크인 자체를 빠뜨린 날은 고칠 원본이 없는데 승인이 조용히 성공해 **요청만 APPROVED 로 바뀌고 일 집계는 ABSENT · 0분으로 남았다** — 관리자는 성공만 보고 그 날은 영원히 0분이다. 정본이 가리키는 방향은 거부가 아니라 **생성**이다: attendance_source 에 **MANUAL** 이 있고 「위치 처리가 없어 확인자료가 NULL 인 것이 정상」으로 규정돼 **체크인 없이 만들어지는 원본이 설계에 있으며**(05_database/04) REQ-ATT-16 이 관리자 수동 보정을 「대리 작성 후 승인」 경로 하나로 못박았다. 제출을 막으면 **근무는 했는데 기록이 없는 상태**가 남아 attendance.accuracy_too_low 의 근거 문장이 경고한 막다른 길이 그대로 생긴다. **표면 수 27 · 표면 번호 · 에러 코드는 전건 불변**이다
> **개정일**: 2026-09-08 — 임계 축 절에 셋을 등재한다 — ① **사전 통제와 사후 분류는 다른 축이고 한쪽만 있으면 통제를 우회한 근로가 분류에서 정상으로 취급된다**(연소자가 편성 차단으로만 다뤄지던 자리) ② 그 물음의 확장 — **"막는 규칙이 있으면 그 규칙을 우회한 결과를 분류하는 규칙도 있는가"**(지오펜스 밖 체크인 · 마감 기간의 수정 요청 · 한도 초과 근로가 같은 형태다) ③ **계산 계층만 읽어서는 그 계층이 언제 적용되는지 알 수 없다** — 적용 조건이 계층 밖(서비스 게이트)에 있으면 계층만 보고 "누구에게나 적용된다"로 읽게 되며 실제로 그 오독이 두 번 났다. 표면 수 · 번호 · 응답 필드는 전건 불변
> **개정일**: 2026-09-08 — 8버킷 계약의 **연장 임계 축을 등재**한다(채번 없음 — 기존 REQ-ATT-11 · ATT-05를 계약 서술이 참조하게 만드는 것이다). **단시간근로자는 소정근로시간 초과분도 연장**이고(기간제법 §6③) **연소자는 1일 7시간 · 주 35시간이 법정 기산**이다(§69) — 종전 연장 판정 행이 성인 8시간·40시간만 적어 **두 축을 함께 빠뜨리고 있었다.** 판정 축이 **employment_terms.employment_type = PART_TIME이고 is_short_time이 아니라는 것**(그 열은 초단시간 적용 예외 축이다) · **휴일에는 소정 축을 적용하지 않는다는 것** · 1일 소정 도출 규칙의 정본이 §1.2라는 것을 함께 적었다. **구현이 실제로 이 상태로 갔다** — 근태가 소정 초과분을 소정 버킷으로 분류해 급여와 다른 버킷을 냈고 그대로면 가산수당 과소 지급이다. 표면 수 · 번호 · 응답 필드는 전건 불변
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행에 **#14 · #15를 등재**한다(누락 보정 — 계약 확장이 아니다). attendance_change_request.approve · reject는 **원본 정책부터 개방 목록에 있던 코드**이고 #14 · #15가 그 유일한 발생 후보인데 이 표가 두 표면을 적지 않았다. **표면과 코드를 잇는 자리가 없으면 어느 방향으로든 빠진다**는 것을 표 아래에 등재한다 — 같은 회차에 반대 방향(표면이 요구하는데 코드가 없던 #5 · #6 · #11)도 함께 드러났다. **표면 수 · 표면 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-09-07 — 연동 표의 audit_logs 행에 **action 코드를 병기**한다(V0715 채번 반영). 종전에는 표면 번호만 가리키고 코드를 적지 않아 **#5 · #6 · #11의 코드가 채번되지 않은 채로 남았다** — 코드가 없으면 action이 자유 문자열이 아니므로 그 기록을 남길 방법 자체가 없다(채번 정본 [../05_database/15_system.md](../05_database/15_system.md) · 강제 지점 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) #146). **사유 필수가 뒤 셋뿐**임도 함께 적었다 — 종전 서술이 여섯 표면 전부를 사유 필수처럼 읽히게 뒀다. **표면 수 · 표면 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정 — **STAFF가 닿는 사업장 규모 축을 명문화**(ATT-1 · #9 · #10의 premiumEligible과 기간 단위 미적용 표기 규칙) · **본인 진행 상태(#3) 응답에 표시용 근무지 사본 worksite 등재**(API-3) · 수정 요청(#11) evidenceDocumentId의 생성 경로·소유권 재판정 계약 명시(EVID-1). **표면 수는 27로 불변**이다 — 셋 다 응답 필드·규약이며 표면 신설이 아니다
> **개정일**: 2026-08-09 — attendance.assignment_forbidden/422 등재 — 스케줄 편성·수정 표면(#22 · #23)의 배치 차단을 공통 폴백에서 도메인 전용 코드로 교체하고 검증·실패 행과 에러 코드 표를 갱신(attendance 7 → **8종**)
> **개정일**: 2026-08-08 — 자기승인 차단의 판정 축을 대상 직원 본인으로 확정(대리 제출자 승인 허용 · 감사 필수) · 휴게 자동 차감 정책의 정본을 사업장 정책으로 정정하고 생성 시점을 일 집계 롤업으로 명시 · 스케줄 삭제를 비활성화 계약으로 정정 · 표면 번호 상호참조 4곳 교정
> **개정일**: 2026-08-03 — 휴게 경계 이상 확정 반영
> **원천**: [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md)(REQ-ATT-01~20 · 8버킷) · [../02_features/04_attendance.md](../02_features/04_attendance.md)(ATT 12기능 · D-23) · [../03_requirements/14_privacy.md](../03_requirements/14_privacy.md)(REQ-PRV-01·04 위치정보) · [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md)(REQ-CMP-06 스냅샷 차단)

근태는 **급여 계산의 유일한 실적 입력**이다. 그래서 이 도메인의 표면은 두 방향을 함께 지킨다 — **기록은 최대한 남기고**(정확도가 나빠도 저장하고 위험 플래그로 넘긴다) **잘못된 값은 마감에서 막는다**(차단 사유 6종을 배열로 반환한다). 출근을 차단하면 근무는 했는데 기록이 없는 상태가 되어 임금 누락으로 직결되기 때문이다.

**시각은 서버가 기록하고 지오펜스는 서버가 재검증한다**(REQ-ATT-01·03). 클라이언트가 보낸 좌표와 기기 시각은 판정 입력일 뿐이며 그중 기기 시각은 위험 플래그 산출에만 쓴다. **근로시간을 15분·30분 단위로 절사하는 처리는 임금체불이므로 사업장 설정으로도 열지 않는다**(REQ-ATT-14) — 그런 파라미터를 받는 표면 자체가 없다.

**위치정보 처리에는 선행 단계가 있다.** 개인위치정보를 다루기 전에 이용·제공 사실 확인자료를 먼저 기록하고, 기록에 실패하면 그 처리를 중단한다(REQ-PRV-04). 체크인 표면(#1)이 그 계약을 지는 유일한 지점이다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 전 표면이 /v1/workplaces/{workplaceId}/… 이다. 본인 진행 상태 조회(#3)만 /v1/me/… 다 |
| 권한 축 | STAFF(본인 체크인 · 휴게 · 수정 요청 · 본인 집계) · MANAGER(전원 집계 · 승인 · 마감 · 스케줄) · **OWNER 전용 2갈래**(마감 취소 · 마감 재오픈) |
| 시각 소유 | **서버 시각이 기록 시각이다.** 요청 본문의 clientTimestamp는 별도 필드로 보존해 기기·서버 시각 차이를 위험 플래그 판정에 쓴다 |
| 절사 금지 | 근로시간에는 work_minutes 규칙(초 단위 절사)만 적용한다. **출퇴근 시각의 15분·30분 라운딩 파라미터를 어느 표면도 받지 않는다** |
| 멱등 | 마감 실행(#18) · **일괄 승인·반려(#28 · #29)** **3표면**이 Idempotency-Key 필수다. 체크인 중복은 (직원, 근무일, 미퇴근) 상태 검증이, 수정 요청 중복은 (직원, 일자, PENDING) 1건 제약이 막는다 |
| 잠금 | ① 같은 근태 건의 동시 승인은 대상 행 잠금으로 직렬화한다 ② 마감 실행은 기간 잠금으로 근태·휴가 수정과 경합하지 않게 한다(REQ-GLB-15) |
| 페이지네이션 | **범위 조회 6표면**(#4 · #9 · #21 · #25 · #24와 #8의 단건 조회) · 오프셋 2표면(#12 · #16). 일 단위 목록의 기간 상한은 366일이다 |
| 5인 분기 | 가산 대상 판정의 유일한 근거는 상시근로자 스냅샷이다([11_compliance.md](./11_compliance.md)). **5인 미만이어도 실근로시간은 그대로 집계**하며 가산 대상 플래그만 false다. **STAFF가 규모를 알 수 있는 유일한 축은 일 집계 행의 premiumEligible**(#9 · #10)이며 사업장 규모를 별도 필드로 다시 싣지 않는다 |
| 마감 존중 | LOCKED 기간은 수정·승인·재집계 대상에서 제외한다. 정기작업(#27)도 건너뛴다 — 확정 급여의 입력이 사후에 바뀌면 재현성이 깨진다 |
| 상태 전이 | 수정 요청(PENDING → APPROVED · REJECTED · CANCELLED)과 마감(LOCKED → REOPENED → LOCKED · LOCKED → CANCELLED)의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다 |
| 감사 | 마감·재오픈·무효화의 전이는 **감사 로그가 필수**다(REQ-ATT-19) |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | POST /v1/workplaces/{workplaceId}/attendance/clock-in | STAFF | — | ATT-01 · ATT-02 |
| 2 | REST | POST /v1/workplaces/{workplaceId}/attendance/clock-out | STAFF | — | ATT-01 · ATT-02 |
| 3 | REST | GET /v1/me/attendance/current | 본인 | — | ATT-01 |
| 4 | REST | GET /v1/workplaces/{workplaceId}/attendance/records | STAFF · MANAGER | 범위 조회 | ATT-01 |
| 5 | REST | POST /v1/workplaces/{workplaceId}/attendance/records/{recordId}/approve | MANAGER | — | ATT-01 · ATT-02 |
| 6 | REST | POST /v1/workplaces/{workplaceId}/attendance/records/{recordId}/reject | MANAGER | — | ATT-01 · ATT-02 |
| 7 | REST | POST /v1/workplaces/{workplaceId}/attendance/breaks/start | STAFF | — | ATT-03 |
| 8 | REST | POST /v1/workplaces/{workplaceId}/attendance/breaks/end | STAFF | — | ATT-03 |
| 9 | REST | GET /v1/workplaces/{workplaceId}/attendance/daily-summaries | STAFF · MANAGER | 범위 조회 | ATT-04 · ATT-05 |
| 10 | REST | GET /v1/workplaces/{workplaceId}/attendance/daily-summaries/{employeeId}/{workDate} | STAFF · MANAGER | — | ATT-04 · ATT-05 |
| 11 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests | STAFF · MANAGER(대리) | — | ATT-06 |
| 12 | REST | GET /v1/workplaces/{workplaceId}/attendance/change-requests | STAFF · MANAGER | 오프셋 | ATT-06 |
| 13 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests/{requestId}/cancel | 본인 | — | ATT-06 |
| 14 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests/{requestId}/approve | MANAGER | — | ATT-07 |
| 15 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests/{requestId}/reject | MANAGER | — | ATT-07 |
| 16 | REST | GET /v1/workplaces/{workplaceId}/attendance/closings | MANAGER | 오프셋 | ATT-08 |
| 17 | REST | GET /v1/workplaces/{workplaceId}/attendance/closings/preflight | MANAGER | — | ATT-08 |
| 18 | REST | POST /v1/workplaces/{workplaceId}/attendance/closings | MANAGER · 멱등 | — | ATT-08 |
| 19 | REST | POST /v1/workplaces/{workplaceId}/attendance/closings/{closingId}/reopen | OWNER | — | ATT-08 |
| 20 | REST | POST /v1/workplaces/{workplaceId}/attendance/closings/{closingId}/cancel | OWNER | — | ATT-08 |
| 21 | REST | GET /v1/workplaces/{workplaceId}/work-schedules | STAFF · MANAGER | 범위 조회 | ATT-09 |
| 22 | REST | POST /v1/workplaces/{workplaceId}/work-schedules | MANAGER | — | ATT-09 |
| 23 | REST | PATCH /v1/workplaces/{workplaceId}/work-schedules/{scheduleId} | MANAGER | — | ATT-09 |
| 24 | REST | DELETE /v1/workplaces/{workplaceId}/work-schedules/{scheduleId} | MANAGER | — | ATT-09 |
| 25 | REST | GET /v1/workplaces/{workplaceId}/attendance/break-compliance | MANAGER | 범위 조회 | ATT-12 |
| 26 | REST | GET /v1/workplaces/{workplaceId}/attendance/work-hour-warnings | MANAGER | 범위 조회 | ATT-13 |
| 27 | 서버 내부 | 정기작업 rollupAttendanceDaily(매일 00:20 KST) | 시스템 | — | ATT-04 · ATT-05 |
| 28 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests/bulk-approve | MANAGER · 멱등 | — | ATT-07 |
| 29 | REST | POST /v1/workplaces/{workplaceId}/attendance/change-requests/bulk-reject | MANAGER · 멱등 | — | ATT-07 |

- 29행 = REST **28** · 서버 내부 **1**이다. SSE·다운로드 표면은 없다 — **실시간 근태 현황(ATT-10)은 조회 시점의 상태**라 스트림을 열지 않고 기존 조회 표면을 조합한다(추적성 절).
- **#28 · #29는 말미 채번이다** — 흐름상 자리는 단건 승인·반려(#14 · #15) 옆이지만 번호를 밀지 않는다.
- STAFF와 MANAGER가 함께 쓰는 조회 표면(#4 · #9 · #10 · #12 · #21)은 **응답 범위가 역할로 갈린다** — STAFF는 본인 행만 받는다.

## 상세

### 1. POST /v1/workplaces/{workplaceId}/attendance/clock-in — 출근 체크인 (ATT-01 · ATT-02)

```json
{
  "location": { "lat": "37.566512", "lng": "126.978011", "accuracyM": "18.00" },
  "clientTimestamp": "2026-08-03T09:01:44Z",
  "source": "GPS"
}
```

```plain
① 위치정보 동의 확인          미동의 → privacy.location_consent_required/403
                             동의 화면으로 유도한다. 여기서 끊어야 이후 단계가 위치를 다루지 않는다
② 이용·제공 사실 확인자료 기록  location_usage_records INSERT — 정보주체 · 일시 · 목적 · 주체 · 경로
                             **기록 실패 시 처리를 중단한다**(REQ-PRV-04). 부수 처리가 아니라 선행 단계다
③ 좌표 수신 검증              좌표 자체가 없음 → attendance.accuracy_too_low/422
                             정확도가 기준보다 나쁨 → **차단하지 않는다.** risk_flags에 사유를 남긴다
④ 지오펜스 서버 재검증         근무지 좌표와의 거리 > geofence_radius_m → attendance.out_of_geofence/422
                             **클라이언트 판정을 신뢰하지 않는다.** 요청 본문에 판정 결과 필드를 두지 않는다
⑤ 순서 검증                   같은 KST 근무일에 미퇴근 레코드 존재 → attendance.invalid_sequence/409
⑥ 위험 플래그 산출             모의위치 의심 · 기기와 서버 시각 차이 초과 · 비정상 이동거리
                             → **탐지하되 차단하지 않는다.** risk_flags에 남겨 승인 대상으로 넘긴다
⑦ 기록 저장                   clock_in_at = **서버 시각** · work_date = 서버 시각의 KST 일자
                             client_timestamp는 별도 필드로 보존한다
```

- ③의 분기가 이 표면의 핵심 설계다. **좌표 미수신은 차단이고 정확도 저하는 통과**다 — 정확도까지 차단하면 실내·지하 매장에서 근무는 했는데 기록이 없는 상태가 되어 근태·급여 누락으로 직결된다(REQ-ATT-04).
- 응답은 저장된 레코드와 risk_flags 배열, 그리고 status(NORMAL 또는 PENDING)를 담는다. PENDING이면 관리자 승인 대상임을 화면이 즉시 알린다.
- **좌표와 정확도는 JSON 문자열이다**([01_conventions.md](./01_conventions.md)). lat · lng · accuracyM 전부 NUMERIC 컬럼이며 number로 실으면 지오펜스 경계에서 판정이 갈린다.
- **v1은 사업장당 단일 근무지**다. worksiteId는 사업장의 기준 좌표 하나를 가리킨다.

### 2·3·4. 퇴근 체크인·진행 상태·기록 조회 (ATT-01)

| 항목 | 2. 퇴근 | 3. 진행 상태 | 4. 기록 조회 |
|------|--------|-------------|-------------|
| 입력 | location · clientTimestamp · source | — | from · to · employeeId(선택) |
| 처리 | ①~④는 #1과 같다. ⑤ 순서 검증만 다르다 | 오늘의 미퇴근 레코드 · 진행 중 휴게 · 오늘 누적 실근로분 · 오늘 스케줄 · **worksite**(표시용 근무지 사본) | 기간 내 출퇴근 이벤트 |
| 순서 차단 | 출근 없는 퇴근 · 퇴근 시각이 출근보다 이름 → **attendance.invalid_sequence/409** | — | — |
| 자정 경과 | work_date는 **출근 일자 기준 1개 레코드**로 유지하되 집계는 실제 시간대로 날짜에 분할 귀속한다 | — | 분할 귀속 결과는 #7이 보여 준다 |
| 권한 | 본인 | 본인 | STAFF는 본인 행만 · MANAGER는 전원 |
| 미퇴근 처리 | — | — | 퇴근 누락 레코드는 미퇴근으로 플래그하고 **보정 요청(#11) 대상으로 전환**한다 |

- **자정 경과 근무의 검증 불변식은 총 분 합 일치**다(REQ-ATT-05). 분할 전후의 총 실근로분이 같아야 하며 경계분(23:59과 00:00)에서 손실·중복이 없어야 한다.
- #4는 범위 조회이며 기간 상한은 366일이다. 기간이 곧 상한이라 쪽을 나누지 않는다([01_conventions.md](./01_conventions.md)).
- **#3 응답의 worksite는 지오펜스 판정 파라미터의 표시용 사본**이다. 화면이 "근무지까지 거리"와 "허용 반경"을 그리려면(체크인 화면 정본 [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md) §5-5 위치 6분기) 기준 좌표와 반경이 필요한데, 정본에 그 값을 STAFF에게 주는 표면이 없었다.

```json
"worksite": {
  "companyName": "…",
  "siteLabel": "…",
  "lat": "37.566512",
  "lng": "126.978011",
  "geofenceRadiusM": 200,
  "locationAccuracyLimitM": 50
}
```

- **worksite를 실어도 판정은 언제나 서버다.** 클라이언트가 이 값으로 계산한 통과 여부를 요청 본문에 담는 경로를 두지 않으며(#1 ④) 서버는 요청마다 workplaces 행의 값으로 다시 잰다. 화면 계산은 사용자에게 "지금 가면 되는가"를 미리 보여 주는 보조일 뿐이다.
- **lat · lng는 JSON 문자열이고 두 반경은 정수 미터(JSON number)**다([01_conventions.md](./01_conventions.md)). 좌표를 number로 실으면 경계에서 화면 표시와 서버 판정이 갈린다.
- **worksite는 활성 사업장이 없으면 null**이다. v1은 사업장당 단일 근무지이므로 배열이 아니라 단건이다(#1).
- **민감도 판단**: 담기는 값은 사업장의 상호 · 근무지 라벨 · 기준 좌표 · 반경이며 **개인정보가 아니다.** 요청자는 이미 그 사업장의 활성 멤버이고 매일 그 자리로 출근한다.

### 5·6. PENDING 체크인 승인·반려 (ATT-01 · ATT-02)

정확도 저하·위험 플래그로 PENDING 저장된 출퇴근 레코드를 관리자가 판정하는 표면이다. **차단하지 않고 저장한 값**(#1 ③ · ⑥)이 여기로 흘러온다.

| 항목 | 5. 승인 | 6. 반려 |
|------|--------|--------|
| 권한 | MANAGER | MANAGER |
| 대상 | status가 **PENDING인 레코드만**. 그 밖의 상태는 common.conflict/409 | 위와 동일 |
| 입력 | reason(선택) | reason(**필수**) |
| 처리 | 레코드를 **COMPLETED**로 전이하고 일 집계를 재판정·재집계한다 | **CANCELLED**로 전이하고 그 레코드를 집계에서 제외한다(반려 사유 필수) |
| 자기승인 | **본인 레코드의 본인 승인을 차단**한다 → attendance.self_approval_forbidden/403 | 위와 동일 |
| 기간 차단 | 마감·급여 확정된 기간 → attendance.period_closed/409 | 위와 동일 |
| 원본 취급 | **좌표·정확도·risk_flags 원본을 지우지 않는다.** 판정 결과만 덧쓴다 | 위와 동일 |
| 부수효과 | 일 집계 재산출 · 대상자 알림 · 감사 기록 | 대상자 알림 · 감사 기록 |

- **반려가 기록 삭제가 아니다.** 레코드는 남고 집계에서만 빠지므로, 실제 근무가 있었다면 대상자가 수정 요청(#11)으로 정정한다 — 반려로 근무 사실이 사라지면 임금 누락이 된다.
- 이 두 표면은 **수정 요청 승인(#14 · #15)과 다른 축**이다. 이쪽은 이미 저장된 원본의 신뢰도 판정이고, 저쪽은 값 자체를 바꾸는 요청의 승인이다. 한 표면으로 합치면 "무엇이 바뀌었는가"가 감사에서 갈리지 않는다.
- **정확도 저하를 차단하지 않고 PENDING으로 받는 설계**(REQ-ATT-04)가 성립하려면 사람이 마무리하는 경로가 있어야 한다. 이 두 표면이 없으면 PENDING 레코드가 영구히 미판정으로 남아 마감 차단 사유만 쌓인다.
- 상태 값 집합과 허용 전이의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다.

### 7·8. 휴게 시작·종료 (ATT-03)

| 항목 | 7. 휴게 시작 | 8. 휴게 종료 |
|------|-------------|-------------|
| 입력 | clientTimestamp(선택) | clientTimestamp(선택) |
| 선행 | 진행 중 출근 레코드 존재 · 진행 중 휴게 없음 | 진행 중 휴게 존재 |
| 차단 | 출근 전 · 퇴근 후 · **중복 휴게 시작** → attendance.invalid_sequence/409 | 진행 중 휴게 없음 → attendance.invalid_sequence/409 |
| 산출 | attendance_breaks 구간 생성 | 구간 종료 · **실근로분 = 재실분 − 휴게분** 재계산 |
| 자동 차감 | 사업장 정책이 자동 차감이면 이 두 표면 대신 정책값이 적용된다. **자동 차감 정책의 정본은 workplaces.attendance_policy**이며 스케줄(#22)의 breakMinutes는 **예정 휴게값**이지 정책이 아니다 | — |

- **휴게가 재실시간보다 길거나 음수이면 저장은 하되 마감을 차단한다**(REQ-ATT-18 사유 ⑥). 저장 시점에 막지 않는 이유는 자정 경과·수정 요청 반영 순서에 따라 일시적으로 모순이 생길 수 있어서다.
- **자동 차감분은 체크아웃 시점이 아니라 일 집계 롤업 시점에 만든다** — #27이 attendance_breaks에 is_auto = true 구간을 생성하고 실근로분을 재산출한다(REQ-ATT-06). 체크아웃 시점에 만들면 사후 수정 요청 승인으로 재실 구간이 바뀔 때 차감분이 따라오지 않는다.
- ATT-03은 **기록만** 한다. 법정 미달 판정은 #25가 별도로 수행하며 그것이 마감 차단 사유 ⑤가 된다 — 기록 표면이 미달을 막으면 8시간 근무·휴게 0분이 저장조차 되지 않아 실태가 사라진다.

### 9·10. 일 집계 조회·8버킷 상세 (ATT-04 · ATT-05)

```json
{
  "employeeId": "…",
  "workDate": "2026-08-02",
  "status": "LATE",
  "totalWorkMinutes": 570,
  "lateMinutes": 12,
  "earlyLeaveMinutes": 0,
  "buckets": {
    "regular": 420,
    "night": 0,
    "overtime": 90,
    "overtimeNight": 60,
    "holiday": 0,
    "holidayNight": 0,
    "holidayOvertime": 0,
    "holidayOvertimeNight": 0
  },
  "premiumEligible": true,
  "employeeCountSnapshotId": "…"
}
```

판정 상태는 **NORMAL · LATE · EARLY_LEAVE · ABSENT · MISSING_CLOCKOUT · ON_LEAVE · HOLIDAY · WEEKLY_HOLIDAY** 8종이다.

| 항목 | 내용 |
|------|------|
| 지각·조퇴 산식 | 지각분 = max(0, 실제 출근시각 − 스케줄 시작시각 − grace) · 조퇴분 = max(0, 스케줄 종료시각 − 실제 퇴근시각) |
| 스케줄 없음 | **실측만 기록하고 지각·결근 판정을 생략한다.** status는 NORMAL로 두고 판정 생략 사유를 함께 담는다 |
| 승인 휴가 | 승인된 휴가일은 **결근으로 판정하지 않는다**(ON_LEAVE) |
| 버킷 불변식 | **8버킷 합 = totalWorkMinutes**다. 배정은 시간대 단위(분)로 수행하고 겹침·누락이 없어야 한다 |
| 연장 판정 | **일 임계 초과분**을 먼저 연장으로 확정하고, 남은 소정분을 **ISO 주(월요일 시작)**로 누적해 주 임계 초과분을 추가 연장으로 전환한다. **전환 대상은 그 주의 시간 순 후순위 근로분부터**로 고정해 결정성을 보장한다. 임계는 대상자에 따라 갈리며 아래 행이 그 축이다 |
| **임계 축** | **성인 8시간 · 주 40시간**이 기본이고 둘이 이를 낮춘다 — **연소자(만 15~18세)는 1일 7시간 · 주 35시간이 법정 기산**이고(근로기준법 §69), **단시간근로자는 소정근로시간 초과분도 연장**이다(기간제법 §6③ · REQ-ATT-11). 일 임계는 **휴일이면 법정 기산시간 · 아니면 단시간에 한해 min(법정 기산시간, 1일 소정)**이다 |
| 야간·휴일 | 야간은 22:00~06:00, 휴일은 **주휴일**(직원별 지정 요일 · employment_terms 정본)과 (**5인 이상**) **관공서 공휴일** 둘뿐이다 — 약정휴일은 v1에 두지 않는다(REQ-ATT-12). 겹칠 수 있으므로 시간대를 분리해 상호배타 버킷에 배정한다 |
| 휴일 연장 | 휴일근로의 "연장"은 주 40시간 초과가 아니라 **그 휴일의 8시간 초과분**이다 |
| 5인 미만 | premiumEligible이 false다. **버킷 값은 그대로 채운다** — 가산만 미발생이지 근로시간 미기록이 아니다 |
| 규모 축 | **premiumEligible = false는 그 근무일의 적용 스냅샷이 5인 미만이라는 뜻이다**(v1에서 false가 되는 사유는 이것 하나다). STAFF·MANAGER 응답 모두 이 필드를 담으며 **이것이 STAFF가 사업장 규모에 닿는 유일한 경로**다 |
| 응답 범위 | STAFF는 본인 행만 받는다. #8은 단건이며 적용 스냅샷 ID를 함께 담아 재현 근거를 남긴다 |

- **단시간 판정 축은 employment_terms.employment_type = PART_TIME이다.** **is_short_time이 아니다** — 그 열은 **주 15시간 미만(초단시간) 파생 플래그**로 주휴·퇴직금·일부 보험의 **적용 예외 축**이지 연장 판정 축이 아니다([../05_database/03_hr.md](../05_database/03_hr.md)). **이름이 "단시간"이라 오용하기 쉬운 자리이고, 축을 잘못 고르면 초단시간이 아닌 단시간 전원이 판정에서 빠진다.**
- **휴일에는 소정 축을 적용하지 않는다.** 소정 6시간인 단시간의 휴일 7시간 근로를 "8시간 초과"로 보면 가산이 100%로 뛴다 — 휴일 버킷의 연장 경계는 **그 휴일의 법정 기산시간 초과분**이며(위 휴일 연장 행) 소정과 무관하다.
- **1일 소정근로시간 도출 규칙의 정본은 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.2다.** 여기서 그 규칙을 다시 쓰지 않는다 — 근태와 급여가 **각각 자기 모듈의 계산 계층에 구현**하므로(모듈이 계산 계층을 공유하지 않는다) **문서가 정본이라는 사실이 두 구현의 유일한 접합점**이다.
- **연소자는 사전 통제와 사후 분류가 갈려 있었다.** 이 문서는 연소자를 **스케줄 편성 차단**(#22의 attendance.assignment_forbidden/422)과 한도 경고로만 다루고 **이미 일어난 근로의 분류 기준**으로는 서술하지 않았다. **사전 통제와 사후 분류는 다른 축이고, 한쪽만 있으면 통제를 우회한 근로가 분류에서 정상으로 취급된다** — 편성을 막아도 실제 근로는 체크인으로 들어오고, 그때 임계가 성인 기준이면 7시간 초과분이 소정으로 분류된다.
- **이 물음은 다른 자리에도 선다** — **"막는 규칙이 있으면 그 규칙을 우회한 결과를 분류하는 규칙도 있는가."** 지오펜스 밖 체크인 · 마감된 기간의 수정 요청 · 한도 초과 근로가 같은 형태이며, **차단이 있다는 사실이 분류 규칙을 대신하지 않는다.**
- **계산 계층만 읽어서는 그 계층이 언제 적용되는지 알 수 없다**(2026-09-08 실측). 단시간 임계는 **근태 서비스가 PART_TIME 게이트를 걸어** 계산 계층에 아예 싣지 않는데, 급여는 같은 성격의 플래그를 계산 입력에 둔다. **적용 조건이 계층 밖에 있으면 그 계층만 보고 "누구에게나 적용된다"고 읽게 되며** 실제로 그 오독이 두 번 났다. **계약 서술이 적용 조건을 함께 담아야 하는 이유가 이것이다** — 구현 위치는 도메인마다 다를 수 있어도 문서는 하나다.
- **이 축이 계약 서술에 없어 구현이 실제로 갈렸다**(2026-09-08 실측). 근태 집계가 단시간 축 없이 만들어져 **소정 초과분이 소정 버킷으로 분류됐고**, 급여 쪽은 같은 축을 갖고 있어 **두 구현이 같은 근태에 다른 버킷을 냈다.** 그대로 넘어가면 가산수당이 빠진 **과소 지급**이 된다. **규칙은 처음부터 REQ-ATT-11 · ATT-05에 있었고 빠진 것은 계약 서술이다** — 구현자가 API 계약과 DB 명세만 읽으면 놓치는 자리이며, **강제 지점이 없던 지금까지의 결함과 반대 방향이되 결과는 같다.**

**8 법정 시간버킷**의 정의 정본은 [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md)이며 지급배수 정본은 [08_payroll.md](./08_payroll.md)다.

```plain
비휴일 ┬ 비연장 ┬ 비야간 → 1 regular
       │        └ 야간   → 2 night
       └ 연장   ┬ 비야간 → 3 overtime
                └ 야간   → 4 overtimeNight
휴일   ┬ 8시간 이내 ┬ 비야간 → 5 holiday
       │            └ 야간   → 6 holidayNight
       └ 8시간 초과 ┬ 비야간 → 7 holidayOvertime
                    └ 야간   → 8 holidayOvertimeNight
```

- **raw 실근로분(totalWorkMinutes)을 함께 보존한다.** 주휴·주연장을 ISO 주 단위로 재합산하려면 버킷만으로는 부족하다.
- 5인과 4인을 오가는 기간은 **귀속 기간별 스냅샷 기준**으로 분기한다. 그래서 응답에 employeeCountSnapshotId가 들어간다.
- **가산 미적용 안내의 데이터원은 premiumEligible이며 기간 단위 표기 규칙은 다음 하나다** — 조회 기간의 **전 행이 false일 때만** 미적용으로 표기하고, true·false가 섞인 기간은 표기하지 않는다. 스냅샷이 귀속 기간별이라 **한 달에 단일 규모 값이 성립하지 않는 기간**이 실재하고, 그 달을 통째로 "5인 미만"이라 적으면 가산이 붙은 날까지 미적용으로 읽힌다.
- **행이 0건이면 규모를 표기하지 않는다.** 근무 기록이 없는 기간에는 가산 미적용 안내가 성립할 대상 자체가 없다. **버킷이 0인 것을 근거로 규모를 역추정하지 않는다** — 5인 이상 사업장도 연장·야간이 없으면 그 버킷이 0이다.
- **사업장 규모를 별도 응답 필드로 신설하지 않은 근거는 판정 단위**다. 규모는 사업장의 상태가 아니라 **귀속 기간별 스냅샷의 판정 결과**이며(정본 [11_compliance.md](./11_compliance.md)), 사업장 자원에 단일 플래그로 얹으면 조회 시점 값이 과거 근무일에 소급 적용된 것처럼 읽힌다.

### 11·12·13. 근태 수정 요청 제출·목록·취소 (ATT-06)

| 항목 | 11. 제출 | 12. 목록 | 13. 취소 |
|------|--------|---------|---------|
| 입력 | workDate · requestedClockInAt · requestedClockOutAt · reason(필수) · evidenceDocumentId(선택) | status · employeeId · 기간 · **q**(직원명 · 사유 부분 일치) · 오프셋 | — |
| 권한 | STAFF 본인 · **MANAGER 대리 제출** | STAFF는 본인 요청만 · MANAGER는 전원 | 본인 · PENDING 상태만 |
| 중복 차단 | **동일 직원·동일 일자 PENDING은 1건만** → attendance.change_request_pending/409 | — | — |
| 기간 차단 | 마감·급여 확정된 기간 → attendance.period_closed/409 | — | — |
| 원본 취급 | **원본 이벤트를 삭제하지 않는다.** 요청은 별도 행으로 쌓이고 승인 시에만 집계가 갱신된다 | — | — |

- **evidenceDocumentId의 생성 경로는 문서 업로드 본인 축([05_hr.md](./05_hr.md) #27) 하나**다. 직원이 자기 증빙을 올려 받은 documentId를 이 요청에 싣고, **서버는 그 문서가 요청자 본인 소유이고 같은 사업장 소속인지 다시 판정**한다 — 아니면 common.validation_failed/400이다. 요청 본문으로 파일을 직접 받지 않는 이유는 업로드 검증(크기·MIME·매직넘버)과 문서 메타 기록이 한 표면에서 끝나야 하기 때문이다([01_conventions.md](./01_conventions.md)).
- **대리 제출(MANAGER)의 증빙은 대리 제출자가 아니라 대상 직원의 문서를 참조한다.** 관리자가 자기 이름으로 올린 문서를 직원 요청에 붙이면 증빙의 출처가 요청자와 어긋난다.
- **관리자 수동 보정도 원본을 직접 고치지 않는다**(REQ-ATT-16). MANAGER는 대상 직원 대신 요청을 대리 작성한 뒤 승인 경로(#14)를 거치며, 그래야 누가 왜 바꿨는지가 요청·승인 두 행에 남는다.
- **대리 제출은 요청 행에 표기한다** — 신청자(대상 직원)와 **제출자를 분리 기록**하고 응답에 proxySubmitted 플래그를 담으며 **대리 사실과 사유를 감사 로그에 남긴다**(필수). 표기가 없으면 직원이 하지 않은 요청이 본인 명의로만 남는다.
- **원본이 없는 날의 제출을 거부하지 않는다.** 출근 체크인 자체를 빠뜨린 날은 그 날의 유일한 보정 경로가 이 표면이며(REQ-ATT-16), 반영은 승인(#14)이 **MANUAL 원본을 만들어** 한다. 다만 **원본도 없고 요청 출퇴근 시각도 둘 다 비어 있으면 승인이 반영할 값이 하나도 없으므로** 그 제출은 여기서 거부한다 — common.validation_failed/400이다. 원본이 있는 날은 한쪽 시각만으로도 그 쪽만 덧쓰는 보정이 성립하므로 대상이 아니다.
- **대리 제출자가 그 요청을 승인하는 것은 허용한다.** 자기승인 차단의 판정 축은 **대상 직원 본인**이며 대리 제출자 = 승인자는 차단 대상이 아니다(#14) — 관리자가 1명뿐인 사업장에서 미퇴근 레코드를 해소할 경로가 사라지면 마감 차단 사유 ①이 영구히 남아 급여 마감이 멈춘다. 대신 대리 사실·사유·감사 기록을 필수로 두어 사후 추적을 보장한다(REQ-ATT-16 · REQ-GLB-16 예외).
- **#12 목록 항목은 그 날의 현재 기록 시각(currentClockInAt · currentClockOutAt)을 함께 싣는다** — 요청 시각과 나란히 대조하는 반쪽이다. 한 날에 기록이 여럿이면 첫 출근 · 마지막 퇴근이고, 원본 기록이 없는 날이면 비운다. 제출 · 검토 응답(#11 · #14 · #15)은 싣지 않는다.

### 14·15. 근태 승인·반려 (ATT-07)

| 항목 | 14. 승인 | 15. 반려 |
|------|---------|---------|
| 권한 | MANAGER | MANAGER |
| 입력 | reason(필수) | reason(필수) |
| 선행 판정 | ① **대상 직원 본인의 승인 차단** → attendance.self_approval_forbidden/403. 판정 축은 **승인자 = 대상 직원의 user_id**이며 **대리 제출자 = 승인자는 허용**한다(대리 사실·사유·감사 기록 필수) ② 대상 기간이 마감·확정 상태 → attendance.period_closed/409 | ①만 적용한다 |
| 처리 | 대상 행 잠금 → 근태 이벤트 갱신 → **일 집계 재판정·재집계**(주 경계 재합산 포함) → 요청 APPROVED 전이 → 알림 | 요청 REJECTED 전이 → 알림 |
| 원자성 | 이벤트 갱신과 집계 재산출이 **한 트랜잭션**이다. 나뉘면 승인은 됐는데 집계가 옛 값인 구간이 생긴다 | — |

- **원본이 없는 날의 승인은 MANUAL 레코드를 만든다.** 그 날의 attendance_records가 없으면 승인이 요청 출퇴근 시각으로 **source = MANUAL 원본 1행을 생성**하고 일 집계 재롤업이 같은 트랜잭션에서 돈다(REQ-ATT-17 「원자적으로 갱신」). 만들지 않으면 승인은 200 · APPROVED · 감사 2행인데 집계는 ABSENT · 0분 그대로여서 **성공 응답이 거짓**이 된다. MANUAL은 위치 처리가 없는 경로라 좌표·확인자료·지오펜스 판정을 갖지 않으며 그것이 조건부 CHECK가 확인자료를 GPS에만 요구하는 이유다([../05_database/04_attendance.md](../05_database/04_attendance.md)).
- **원본은 요청 행의 참조가 아니라 그 날로 다시 찾는다.** 제출 시점에 없던 원본이 승인 전에 생겼을 수 있어(직원이 뒤늦게 체크인한 경우다) 참조만 보고 만들면 같은 날 원본이 둘이 되어 **재실분이 이중 계상**된다.
- **원본이 없는데 요청 시각이 한쪽뿐이면 승인이 거부한다** — attendance.invalid_sequence/409다(REQ-ATT-02 ②③). 한쪽만으로 만들 수 있는 것은 미퇴근 원본뿐이고, 그것은 이 경로가 해소하려던 마감 차단 사유 ①을 승인이 도리어 심는 꼴이다. **승인 본문은 사유 하나뿐이라 형식 오류를 낼 자리가 아니다** — 거부 대상은 요청 본문이 아니라 저장된 요청 행이다.
- **주 경계 재합산이 승인의 숨은 비용**이다. 하루의 출퇴근이 바뀌면 그 주의 40시간 초과 전환이 통째로 다시 계산되므로 재집계 범위가 그 주 전체다.
- 승인 잠금은 멱등키로 대체되지 않는다 — 서로 다른 관리자가 같은 요청을 동시에 승인·반려하는 경합은 행 잠금만 막는다(REQ-GLB-15).

### 16·17·18·19·20. 마감 목록·선점검·실행·재오픈·무효화 (ATT-08)

```json
{
  "period": "2026-07",
  "closable": false,
  "blockers": [
    { "reason": "MISSING_CLOCKOUT", "employeeId": "…", "workDate": "2026-07-14" },
    { "reason": "PENDING_CHANGE_REQUEST", "requestId": "…" },
    { "reason": "MISSING_SCHEDULE", "employeeId": "…", "workDate": "2026-07-20" },
    { "reason": "MISSING_EMPLOYEE_COUNT_SNAPSHOT", "baseDate": "2026-07-31" },
    { "reason": "BREAK_SHORTFALL", "employeeId": "…", "workDate": "2026-07-22" },
    { "reason": "BREAK_EXCEEDS_PRESENCE", "employeeId": "…", "workDate": "2026-07-23" }
  ],
  "warnings": [
    { "reason": "WEEKLY_OVERTIME_LIMIT", "employeeId": "…", "isoWeek": "2026-W29" }
  ]
}
```

차단 사유는 **6종**이다(REQ-ATT-18) — ① 미퇴근 레코드 존재 ② 미승인 수정 요청 존재 ③ 판정에 필요한 스케줄 누락 ④ **상시근로자 산정 스냅샷 누락** ⑤ **휴게시간 미달** ⑥ 휴게가 재실보다 긴 데이터 모순이다.

| 항목 | 16. 목록 | 17. 선점검 | 18. 마감 실행 | 19. 재오픈 | 20. 무효화 |
|------|---------|-----------|--------------|-----------|-----------|
| 권한 | MANAGER | MANAGER | MANAGER · **멱등키 필수** | **OWNER** | **OWNER** |
| 입력 | 기간 필터 · 오프셋 | period(YYYY-MM) | period · confirmedWarnings | reason(필수) | reason(필수) |
| 응답 | 기간별 상태 · 마감 시각 · 처리자 | 위 예시 | LOCKED 전이 결과 | REOPENED 전이 | CANCELLED 전이 |
| 차단 | — | 읽기 전용 | blockers가 비어 있지 않으면 **attendance.closing_blocked/409** + 사유 배열 | **급여 미확정 기간에 한한다.** 확정됐으면 409 | 이미 급여 입력으로 소비된 마감은 거부 |
| 감사 | — | — | 필수 | 필수 | 필수 |

- **경고와 차단을 나눈다.** 근로시간 한도 위반(#26)은 경고로 표시하되 마감 차단 여부는 사업장 정책으로 둔다 — 연장 주 12시간 초과는 5인 이상에만 해당하고, 이를 일률 차단하면 정상 마감이 막힌다.
- 마감 후 상태는 LOCKED이며 그 기간의 **근태 수정 · 휴가 반영 · 스케줄 변경을 제한**하고 급여 계산의 확정 입력으로 제공한다(REQ-ATT-19).
- **마감된 기간은 재오픈 없이 재판정·재집계하지 않는다**(REQ-ATT-20). 일 집계 롤업(#27)도 LOCKED 기간을 건너뛴다.
- 오입력 마감은 CANCELLED로 재사용 불가 종결한다 — REOPENED와 다른 축이며 되살릴 수 없다.
- **#17 선점검의 미승인 수정 요청 차단(PENDING_CHANGE_REQUEST)은 employeeName · workDate를 함께 싣는다** — 화면이 이름을 따로 잇지 않고 해당 일자로 바로 간다.

### 21·22·23·24. 근무 스케줄 조회·편성·수정·삭제 (ATT-09)

| 항목 | 21. 조회 | 22. 편성 | 23. 수정 | 24. 삭제 |
|------|---------|---------|---------|---------|
| 권한 | STAFF는 본인 · MANAGER는 전원 | MANAGER | MANAGER | MANAGER |
| 입력 | from · to · employeeId(선택) | employeeId · 반복 패턴(주 고정) 또는 단일 예외일 · startTime · endTime · breakMinutes · graceMinutes · worksite | 부분 갱신 | — |
| 검증 | — | 겹침 차단 · **종료가 시작보다 이른 편성 차단** · 연소자·임신 중 근로자 배치 제약 차단 → **attendance.assignment_forbidden/422** | 위와 동일 | 마감된 기간의 스케줄은 삭제 불가 → attendance.period_closed/409 |
| 삭제 의미 | — | — | — | **물리 삭제가 아니라 is_active = false 비활성화**다. 과거 판정이 참조한 스케줄이 사라지면 지각·결근 판정 근거가 소급 소멸한다 |
| 실패 | — | **attendance.assignment_forbidden/422**(법정 보호 대상자 배치) · common.conflict/409(겹침) · **hr.minor_document_missing/422**(연소자 서류 미비치) · common.validation_failed/400 | 위와 동일 | attendance.period_closed/409 |

- **스케줄 없이는 지각·조퇴·결근 판정과 소정근로 분해가 성립하지 않는다**(REQ-ATT-08). 그래서 스케줄 누락이 마감 차단 사유 ③이다.
- 연소자(만 18세 미만) 제약은 **편성 단계에서 차단**한다 — 1일 7시간 · 주 35시간 · 야간 22:00~06:00 금지 · 휴일 배치 금지이며 위반은 **attendance.assignment_forbidden/422**다. 제약값은 WORK_HOUR_LIMIT 기준값에서 조회한다.
- 임신 중 근로자 연장근로 금지도 같은 축·같은 코드이며 **전 규모 적용**이다. 판정 입력은 employees의 생년월일·임신 보호기간과 employee_protected_periods의 임신기 근로시간 단축 진행 구간이다.
- **경고(#26)와 차단(#22 · #23)의 축이 다르다.** 연장 주 12시간 초과는 이미 발생한 근로라 마감 경고로 두지만, 배치는 발생 전이라 편성 자체를 거부한다 — 위반이 §70② · §74⑤ 형사처벌 대상이기 때문이다.

### 25. GET /v1/workplaces/{workplaceId}/attendance/break-compliance — 휴게시간 준수 검증 (ATT-12)

| 항목 | 내용 |
|------|------|
| 입력 | from · to · employeeId(선택) |
| 판정 | **실근로분 기준**이다 — 8시간 이상이면 휴게 60분 이상, 4시간 이상 8시간 미만이면 30분 이상이다(근로기준법 §54) |
| 응답 | 일자별 실근로분 · 실제 휴게분 · 필요 휴게분 · 위반 여부(violated) · 부족분. **대상은 기간의 모든 근무일이고 위반은 플래그로 가른다** — 위반만 내면 화면이 조회 일수를 위반 일수로 세고, 마감 차단 사유 ⑤의 대조 근거(정상인 날)가 사라진다 |
| 적용 범위 | **전 규모 적용**이다. 5인 미만도 포함한다 |
| 마감 연동 | 위반은 마감 차단 사유 ⑤가 된다(#17 · #18). 위반 시 2년 이하 징역 또는 2천만원 이하 벌금 대상이다 |
| 경계 해석 | **이상으로 확정**됐다(확인 완료 · REQ-ATT-07) — 정확히 4시간 → 30분 · 정확히 8시간 → 60분 · 4시간 미만 의무 없음. 응답에 판정 기준을 함께 담는다 |

- ATT-03이 기록만 하므로 **이 검증이 없으면 8시간 근무·휴게 0분 근태가 그대로 마감된다.** 표면을 별도로 둔 이유가 그것이다.

### 26. GET /v1/workplaces/{workplaceId}/attendance/work-hour-warnings — 근로시간 한도 경고 (ATT-13)

| 대상 | 한도 | 규모 분기 | 처리 |
|------|------|----------|------|
| 성인 연장 | **주 12시간 초과**(근로기준법 §53①) | **5인 이상에만 경고** | 경고. 5인 미만에 오경고를 내지 않는다 |
| 연소자(만 18세 미만) | 1일 7시간 · 주 35시간(합의 시 1일 1시간·주 5시간까지 연장 · §69) | **전 규모 적용** | 경고 |
| 연소자 야간·휴일 | 22:00~06:00과 휴일 근로 원칙 금지(§70②) | **전 규모 · 배치 차단** | 스케줄 편성(#22)이 차단한다 |
| 임신 중 근로자 | 연장근로 금지(§74⑤) | **전 규모 · 배치 차단** | 스케줄 편성(#22)이 차단한다 |

- **규모 분기가 필수다.** 근거는 근로기준법 제5장(여성과 소년 · §64~§74)이 규모 무관 적용이고 §53①은 5인 이상 적용이라는 점이다. 이 둘을 섞으면 5인 미만 사업장에 주 12시간 오경고가 나간다.
- 응답은 경고 목록이며 **차단하지 않는다.** 배치 차단이 필요한 두 항목은 스케줄 편성 표면이 진다.
- 한도값은 전부 WORK_HOUR_LIMIT 기준값 조회다. 기준값이 없으면 경고를 만들지 않고 부재를 응답에 드러낸다.

### 27. 정기작업 rollupAttendanceDaily (배치)

| 항목 | 내용 |
|------|------|
| 실행 | 매일 00:20 KST · 분산락 · 멱등 · **기준일 파라미터로 동작**한다 |
| 동작 | 전일 근태 원본을 읽어 판정(ATT-04)과 8버킷 분해(ATT-05) 결과를 일 집계에 UPSERT한다 |
| 마감 존중 | **LOCKED 기간은 건너뛴다.** 마감은 급여의 확정 입력이므로 정기작업이 사후에 다시 계산하면 확정 급여의 근거가 조용히 바뀐다 |
| 자정 경과 | 출근 일자 기준 레코드를 실제 시간대로 분할 귀속하고 **분할 전후 총 분 합 일치**를 불변식으로 검증한다 |
| 표면 없음 근거 | 사용자가 요청할 일이 아니다. 관리자의 재집계 요구는 수정 요청 승인(#14)이 그 자리에서 처리하므로 수동 트리거 표면을 두지 않는다 |
| 실패 처리 | 재시도 상한(5회) 초과 시 dead_letter_at을 기록하고 **관측 채널(에러 추적·로그 경보 — ADR-23)로 운영자에게 통보**한다. 인앱 알림 경로를 쓰지 않는다. 조용히 사라지는 실패를 만들지 않는다 |

### 28·29. 근태 수정 요청 일괄 승인·반려 (ATT-07)

```plain
① 형식          requestIds 1~200건 · reason 필수 · 멱등키 필수 — 위반은 common.validation_failed/400
② 인가          MANAGER 1회 — 미충족은 요청 전체가 auth.workplace_forbidden/403
③ 중복          같은 식별자가 두 번이면 행 처리 전에 400(field requestIds)
④ 행마다        MANAGER 재판정 → 단건 승인(#14) · 반려(#15)를 그대로 지난다 — 각자 한 트랜잭션
                성공 → SUCCEEDED · 도메인 실패 → FAILED + 단건 코드 · 문구
⑤ 200           total · succeeded · failed · results(요청 순서)
```

| 항목 | 28. 일괄 승인 | 29. 일괄 반려 |
|------|-------------|-------------|
| 권한 | MANAGER · **멱등** | MANAGER · **멱등** |
| 입력 | requestIds(1~200 · 중복 불가) · reason(필수 · 모든 행에 같이 남는다) | 상동 |
| 행 처리 | **#14와 같은 계약** — 자기 승인 차단 · 마감 기간 · 대상 행 잠금 · 주 재집계 · 감사 · 알림 | **#15와 같은 계약** |
| 응답 | 200 · total · succeeded · failed · results[requestId · outcome(SUCCEEDED · FAILED) · code · message] | 상동 |
| 실패(요청 전체) | common.validation_failed/400 · auth.workplace_forbidden/403 · 멱등 키 충돌 common.conflict/409 | 상동 |

- **부분 실패는 오류가 아니라 200이다.** 행마다 독립 트랜잭션이라 성공한 행은 이미 확정됐고, 전체를 실패로 돌려주면 클라이언트가 성공 행까지 다시 보낸다. 행의 code는 **단건 표면이 냈을 코드 그대로**다 — attendance.self_approval_forbidden · attendance.period_closed · common.conflict(이미 처리) · common.not_found 등.
- **한 트랜잭션으로 묶지 않는다.** 묶으면 한 행의 실패가 앞선 성공 행까지 되돌리고, 주 재집계가 요구하는 서버 전용 표식이 커넥션을 얻는 순간 한 번만 읽혀 둘째 행부터 정책에 걸리며, 200건의 재집계 잠금을 한꺼번에 쥔다. 처리 순서는 요청 순서다.
- **인가를 행마다 다시 판정한다** — 단건 표면이 요청마다 판정하는 것과 같다. 처리 도중 역할이 회수되면 그 뒤 행은 auth.workplace_forbidden으로 남는다. 요청 전체를 먼저 한 번 막는 것은 STAFF 요청이 200과 전 행 실패로 끝나 권한 없음이 결과 표에 묻히지 않게 하려는 것이다.
- **멱등키가 필수다**([01_conventions.md](./01_conventions.md) 멱등 필수 표면). 재시도가 두 번째 실행이 되면 첫 실행에서 성공한 행이 이미 처리됨(common.conflict)으로 바뀌어 **응답이 사실과 달라진다** — 같은 키 + 같은 본문은 첫 응답을 그대로 재생한다.
- **분류되지 않은 서버 실패는 그 행의 code를 비우고** 문구만 싣는다(서버 로그에 원인을 남긴다). 없는 코드를 지어내지 않는다 — 단건 표면이 코드 없는 500을 내는 것과 같은 축이다.
- **대상 상한 200은 목록의 묶음 크기와 같다.** 행마다 트랜잭션 · 재집계 · 알림이 돌아 요청 시간이 건수에 비례한다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| attendance.invalid_sequence | 409 | 미퇴근 상태의 중복 출근 · 출근 없는 퇴근 · 퇴근이 출근보다 이름 · **휴게 순서 위반**(출근 전·퇴근 후 휴게 · 중복 휴게 시작 · 진행 중 휴게 없는 휴게 종료) | #1 · #2 · #7 · #8 |
| attendance.out_of_geofence | 422 | 서버 재검증 결과 지오펜스 반경 밖. **예외 요청 경로를 안내**한다 | #1 · #2 |
| attendance.accuracy_too_low | 422 | **좌표 미수신**(위치 자체가 없음). **정확도 저하는 차단하지 않고 PENDING으로 저장한 뒤 risk_flags에 사유를 남겨 #5 · #6의 승인 대상으로 넘긴다** | #1 · #2 |
| attendance.change_request_pending | 409 | 동일 직원·동일 일자에 PENDING 수정 요청이 이미 존재 | #11 |
| attendance.self_approval_forbidden | 403 | **대상 직원 본인**의 수정 요청·체크인 레코드를 본인이 승인하려는 시도. 대리 제출자가 승인자인 경우는 차단하지 않는다 | #5 · #6 · #14 · #28 · #29(행 결과) |
| attendance.closing_blocked | 409 | 마감 차단 — **사유 6종을 배열로 반환**한다(미퇴근 · 미승인 수정요청 · 스케줄 누락 · 스냅샷 누락 · 휴게 미달 · 데이터 모순) | #18 |
| attendance.period_closed | 409 | 마감(LOCKED)·급여 확정된 기간의 근태 수정·승인 시도 · **마감 기간의 스케줄 변경·삭제 시도** | #5 · #6 · #11 · #14 · #19 · #23 · #24 · #28(행 결과) |
| **attendance.assignment_forbidden** | **422** | **법정 보호 대상자의 금지 시간대 편성 시도** — 연소자(만 18세 미만)의 야간(22:00~06:00 걸침)·주휴일 배치 · 임신 중 근로자의 소정근로 초과 배치. **전 규모 적용**이며 서비스 1차 검증과 DB 가드가 함께 낸다 | #22 · #23 |
| privacy.location_consent_required | 403 | 위치정보 별도 동의 없이 GPS 체크인 시도 | #1 · #2 |
| hr.minor_document_missing | 422 | 연소자 법정 비치 서류 미비치 상태의 스케줄 편성 | #22 · #23 |
| leave.employee_count_snapshot_required | 422 | 스냅샷 부재 — 마감 경로에서는 closing_blocked 사유 배열로 표현한다 | (#17이 사유로 예고) |
| common.conflict | 409 | 스케줄 겹침 · **PENDING이 아닌 레코드의 승인·반려** 등 도메인 전용 코드가 없는 충돌 · **같은 멱등키 + 다른 본문** | #5 · #6 · #14 · #15 · #22 · #23 · #28 · #29 |
| common.not_found | 404 | 수정 요청·마감·스케줄 부재 또는 존재 은닉 | #10 · #13 · #14 · #15 · #19 · #20 · #23 · #24 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 · 범위 조회 기간 상한 초과 | 전 REST 표면 |
| common.invalid_format | 400 | 좌표 · 날짜 · 시각 형식 오류 | #1 · #2 · #11 · #22 |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 | 전 사업장 스코프 표면 |

- **attendance 8종 전량이 이 표에 있다.**
- **배치 차단은 common.validation_failed/400이 아니라 전용 코드다.** 입력 형식 오류가 아니라 법정 금지 시간대에 사람을 배치하려는 시도이므로 사용자가 취할 조치가 다르고, 응답이 어느 대상자의 어느 축(야간·주휴일·소정근로 초과)에 걸렸는지를 함께 담는다.
- 스냅샷 부재는 마감 경로에서 attendance.closing_blocked의 사유 배열로 표현하고 별도 코드로 내지 않는다 — 사용자는 "상시근로자 산정이 없다"가 아니라 "이 기간을 마감할 수 없다"는 맥락에서 문제를 만난다(REQ-CMP-06).
- 정의처가 다른 코드는 발생만 한다 — privacy 코드는 [15_privacy.md](./15_privacy.md), hr 코드는 [05_hr.md](./05_hr.md), leave 코드는 [07_leave.md](./07_leave.md)가 정의한다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| attendance_records | #1 · #2 INSERT · #3 · #4 SELECT · #5 · #6 · #14 · #27 · #28 UPDATE | 출퇴근 이벤트 — **서버 시각** · 좌표 · 정확도 · source · risk_flags · client_timestamp |
| attendance_breaks | #7 · #27 INSERT · #8 UPDATE · #25 SELECT | 휴게 구간 — 실근로분 산출의 차감 원천. **자동 차감분(is_auto = true)은 #27이 일 집계 롤업 시점에 만든다** |
| attendance_daily_summaries | #9 · #10 · #25 · #26 SELECT · #14 · #27 · #28 UPSERT | 일 집계 — 판정 상태 · 8버킷 · total_work_minutes · 적용 스냅샷 ID |
| attendance_change_requests | #11 INSERT · #12 SELECT · #13 · #14 · #15 · #28 · #29 UPDATE | 수정 요청 — (직원, 일자, PENDING) 1건 제약이 중복을 막는다. evidence_document_id는 documents 참조이며 **소유권 재판정 대상**이다 |
| documents | #11 SELECT | 증빙 참조 대상. 생성은 [05_hr.md](./05_hr.md) #27 본인 축이며 **이 도메인에 업로드 표면을 두지 않는다** |
| attendance_period_closings | #16 · #17 SELECT · #18 INSERT · #19 · #20 UPDATE | 기간 마감 — LOCKED · REOPENED · CANCELLED와 차단 사유 |
| work_schedules | #21 SELECT · #22 INSERT · #23 · #24 UPDATE | 근무 스케줄 — 반복 패턴 · 예외일 · 겹침 차단. 판정과 소정근로 분해의 기준. **#24는 물리 DELETE가 아니라 is_active = false 갱신**이다 |
| workplaces | #1 · #2 · #3 · #27 SELECT | 지오펜스 기준 좌표 · geofence_radius_m · location_accuracy_limit_m(**#3 응답 worksite의 원천**) · **attendance_policy**(자동 휴게 차감 · grace 기본값 · 한도 위반 마감 차단 여부의 정본) |
| workplace_employee_count_snapshots | #9 · #10 · #17 · #18 SELECT | 5인 분기 판정 근거. 없으면 마감을 차단한다 |
| statutory_rates | #9 · #10 · #22 · #26 SELECT | HOLIDAY_CALENDAR · WORK_HOUR_LIMIT · PREMIUM_RATE 조회 |
| location_usage_records | #1 · #2 INSERT | 위치정보 이용·제공 사실 확인자료 — **체크인 처리의 필수 선행 기록** |
| user_consents | #1 · #2 SELECT | 위치정보 별도 동의 여부 판정 |
| employees | #1 · #9 · #22 · #26 SELECT | 대상 직원 · 생년월일(연소자 판정) · worker_type |
| leave_requests | #9 SELECT | 승인 휴가일의 결근 미판정 반영 |
| audit_logs | #5 · #6 · #11(대리 제출) · #14 · #15 · #18 · #19 · #20 · #28 · #29 INSERT | 체크인 판정 **attendance_record.approve**(#5) · **attendance_record.reject**(#6) · 대리 제출 **attendance_change_request.proxy_submit**(#11) · 수정 요청 판정 **attendance_change_request.approve**(#14 · **#28은 성공 행마다**) · **attendance_change_request.reject**(#15 · **#29는 성공 행마다**) · 마감 **attendance_closing.lock**(#18) · 재오픈 **attendance_closing.reopen**(#19) · 무효화 **attendance_closing.cancel**(#20). **사유 필수는 마감 축 셋뿐이다** — 나머지 다섯은 사유를 요구하지 않으며 대리 제출의 사유는 attendance_change_requests.reason이 NOT NULL로 강제한다. action 코드 집합의 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)이며 **여기서 코드를 신설하지 않는다** |
| notifications | #1 · #5 · #6 · #11 · #14 · #15 · #28 · #29 INSERT | attendance_anomaly · attendance_change_requested · attendance_approved · attendance_rejected |

- **연동 표가 action 코드를 적는다.** 표면 번호만 가리키면 표면과 코드를 잇는 자리가 어디에도 없어 **어느 방향으로든 빠진다** — 실제로 양방향이 다 일어났다. #5 · #6 · #11은 이 표가 기록을 요구하는데 코드가 채번되지 않은 채였고(2026-09-07 V0715가 채번), #14 · #15는 코드가 개방 목록에 있는데 이 표가 그 표면을 감사 대상으로 적지 않고 있었다. **코드가 존재한다는 것 자체가 그 표면이 감사 로그를 쓴다는 계약이다** — 쓰는 자리가 없으면 코드는 채번될 이유가 없다.

## 추적성

기능명·우선순위의 정본은 [../02_features/04_attendance.md](../02_features/04_attendance.md)다.

| 기능ID | 표면 |
|--------|------|
| ATT-01 출근/퇴근 체크인 | #1 · #2 · #3 · #4 · #5 · #6 |
| ATT-02 지오펜스 검증 | #1 · #2(④ 서버 재검증 단계) · #5 · #6(판정 결과 마무리) |
| ATT-03 휴게시간 기록 | #7 · #8 |
| ATT-04 지각/조퇴/결근 판정 | #9 · #10 · #27(배치) |
| ATT-05 연장/야간/휴일 집계 | #9 · #10 · #27(배치) |
| ATT-06 근태 수정 요청 | #11 · #12 · #13 |
| ATT-07 근태 승인 | #14 · #15 · **#28 · #29**(일괄) |
| ATT-08 근태 마감 | #16 · #17 · #18 · #19 · #20 |
| ATT-09 근무 스케줄 | #21 · #22 · #23 · #24 |
| **ATT-10 실시간 근태 현황** | **신규 표면 없음** — #4(오늘 기록) · #21(오늘 스케줄) · [07_leave.md](./07_leave.md) #3(오늘 승인 휴가) · [05_hr.md](./05_hr.md) #1(재직 명단)을 조회 시점에 조합한다 |
| ATT-12 휴게시간 준수 검증 | #25 |
| ATT-13 근로시간 한도 경고 | #26 |

**ATT 12기능 전수를 담았다**(위 표 12행). **ATT-10은 자체 표면이 없다** — 판정을 하지 않고 서버 기록(출퇴근 · 스케줄 · 승인 휴가)만으로 상태를 보이므로 조회 표면의 조합으로 성립하고, 지각·결근 판정을 흉내 내는 전용 표면을 두면 일 집계(#27)와 같은 날에 값이 둘 생긴다(기능 정본 [../02_features/04_attendance.md](../02_features/04_attendance.md)). ATT-02는 요청 표면이 아니라 체크인 표면 안의 서버 재검증 단계이고, 그 판정이 PENDING으로 남긴 레코드를 사람이 마무리하는 경로가 #5 · #6이다 — 클라이언트가 지오펜스 판정 자체를 요청하는 경로를 두면 그 결과를 신뢰하는 표면이 생기기 때문이다.

## 관련 문서

- 전역 규약·범위 조회·멱등·시간 직렬화 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/04_attendance.md](../02_features/04_attendance.md) · 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 요구사항 정본 → [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md) · 전역 규칙 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 8버킷 지급배수·마감을 입력으로 쓰는 급여 → [08_payroll.md](./08_payroll.md) · 휴가 연동 → [07_leave.md](./07_leave.md) · 스냅샷 → [11_compliance.md](./11_compliance.md) · 위치정보 동의·확인자료 → [15_privacy.md](./15_privacy.md)
- 증빙 문서 업로드(본인 축)와 다운로드 → [05_hr.md](./05_hr.md) #27 · #29 · #30 · 명세서가 소비하는 근태 축(workSummary) → [09_payslip.md](./09_payslip.md)
- 테이블 명세 → [../05_database/04_attendance.md](../05_database/04_attendance.md)
- 정기작업·스케줄링 설계 → [../04_architecture/07_batch_scheduling.md](../04_architecture/07_batch_scheduling.md)
- 상태 머신 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) · 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
