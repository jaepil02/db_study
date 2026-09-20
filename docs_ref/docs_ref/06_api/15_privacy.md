# 06_api / 15 개인정보·위치정보 (PRV)

> **대상**: PRV 도메인 표면 — 위치정보 이용·제공 사실 확인자료 자동 기록과 본인 조회 · 원좌표 파기 · 위치정보 별도 동의 · 버전별 동의 이력 · 철회와 재동의
> **작성일**: 2026-08-03
> **개정일**: 2026-09-10 — #7 재동의 대상 응답에 **required · agreedVersion** 두 필드를 더한다(웹 재동의 화면 PUB-CONSENT의 근거 — "이 동의가 필수인가"와 "무엇이 바뀌었나"를 서버 응답 없이는 그릴 수 없다). **required는 D-19의 귀결**(TERMS · PRIVACY true · LOCATION false)이라 프런트가 kind로 유도할 수도 있으나 법령 판단을 화면에 두지 않으려 서버가 낸다. **agreedVersion은 서버만 아는 값**이다 — 대조 과정에서 읽는 최종 동의 버전이며, 한 번도 동의하지 않은 kind는 null이다. 표면 수 · 번호 · 에러 코드 전건 불변
> **개정일**: 2026-09-08 — 둘을 등재한다. ① **선택 동의 철회가 되돌릴 수 없다는 제품 결과** — 유일 제약이 같은 버전의 재동의를 막으므로 **문서가 개정돼야 다시 켤 수 있다.** **결함이 아니라 정본이 정한 결과**이며, 적어 두지 않으면 다음 사람이 **유일 제약을 결함으로 보고 푼다.** 앱 mock이 반대로 동작하는 것도 **어긋남으로 등재**한다(프런트는 다른 세션 범위라 고치지 않는다). ② **#6의 reason을 담을 자리가 없음을 미결로** 등재 — 열도 감사 코드도 없어 받으면 조용히 사라진다. **채번이 선행된다.** 표면 수 · 번호 · 계약은 전건 불변
> **개정일**: 2026-09-08 — 원좌표 파기의 실행 순서를 **"마감 트랜잭션의 자동 후속 처리" → "마감 트랜잭션 안에서 잠금 확정에 선행해 실행한다"**로 고친다(실측 — 그 순서로는 동작하지 않는다). guard_locked_period()가 attendance_records UPDATE를 보고 그 급여월이 LOCKED이면 거부하는데 **잠금 행은 같은 트랜잭션이 방금 쓴 행이라 이미 보인다** — 잠금 뒤에 파기하면 통째로 실패한다. **"후속"이 담으려던 뜻은 유지된다** — 같은 트랜잭션이라 마감이 되돌아가면 파기도 함께 되돌아간다. **그 말이 담으려던 것은 순서가 아니라 같은 트랜잭션 안이었다.** 정기작업 8건 · 파기 계약·감사 축은 전건 불변
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정 — 동의 출처(source) 값 표기를 RECONSENT → **REAGREE**로 정정(ENUM-2). 값 집합의 정본은 [../05_database/01_auth.md](../05_database/01_auth.md)의 user_consents.source CHECK이며 **본 문서 표기가 정본과 어긋나 있었다**. **표면 수는 7로 불변**이다
> **개정일**: 2026-08-08 — 원좌표 파기 시점을 귀속월 근태 마감 확정 시점으로 확정하고 실행 경로를 마감 트랜잭션의 자동 후속 처리로 단일화(전용 배치 없음 · 정기작업 8건 불변)
> **원천**: [../03_requirements/14_privacy.md](../03_requirements/14_privacy.md)(REQ-PRV-01~05) · [../02_features/13_privacy.md](../02_features/13_privacy.md)(PRV 2기능) · [../03_requirements/13_system.md](../03_requirements/13_system.md)(REQ-SYS-15·16 문서 버전과 재동의) · [../03_requirements/05_attendance.md](../03_requirements/05_attendance.md)(REQ-ATT-01 체크인)

GPS 출퇴근을 제공하는 이상 **위치정보법 §16② 이용·제공 사실 확인자료의 자동 기록·보존 의무는 회피할 수 없다.** 그래서 이 도메인의 첫 종점(#1)은 표면이 아니라 **위치정보 처리의 필수 선행 단계**이며, 기록에 실패하면 그 처리 자체를 중단한다. 체크인 표면([06_attendance.md](./06_attendance.md) #1 ②)이 그 계약을 지는 유일한 호출 지점이다.

**선택 동의를 철회하면 그 문서가 개정될 때까지 되돌릴 수 없다.** 위치정보 동의를 철회한 사용자는 **GPS 체크인을 다시 켜지 못하며** 새 버전이 게시돼야 다시 동의할 수 있다. **이것은 유일 제약의 부작용이 아니라 정본이 정한 결과다** — 동의 이력의 무결성을 자연 유일 제약이 지고(정본 [../05_database/16_privacy.md](../05_database/16_privacy.md)), 철회는 차단만 규정하며 되돌리는 경로를 두지 않는다.

- **이 사실을 등재해 두는 이유는 제약이 결함으로 보이기 때문이다.** 적어 두지 않으면 다음 사람이 **유일 제약을 결함으로 보고 푼다** — 그 순간 같은 버전에 동의 행이 여럿 생겨 "어느 버전에 언제 동의했는가"가 하나로 답해지지 않는다.
- **어긋남 등재 — 앱 mock이 반대로 동작한다.** app_front의 동의 mock이 중복 판정을 **철회되지 않은 행**만 보고 하여 **철회 후 재동의가 새 행으로 들어간다.** **mock이 정본과 어긋난 것이고 실 서버에서는 유일 제약에 막힌다** — 프런트는 다른 세션 범위라 여기서 고치지 않고 어긋남으로만 등재한다.

**동의는 "받았다"는 사실만으로 입증되지 않는다 — 어느 버전에 언제 동의했는지가 법적 증거다.** 그래서 동의 이력은 append-only이며 철회도 행을 지우지 않고 철회 시각만 기록한다. 갱신·삭제 표면을 두지 않는 이유가 그것이다.

**원좌표와 확인자료의 보존 정책은 분리한다.** 목적 달성 시 확인자료를 제외한 개인위치정보(원좌표)는 즉시 파기하고, 확인자료 자체는 법정 보존기간까지 유지한다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 전 REST 표면이 /v1/me/… 다. **사업장 스코프가 없다** — 동의와 위치정보는 계정 단위 사실이다 |
| 권한 축 | **본인 전용**이다. 관리자가 타인의 동의 이력·위치정보 확인자료를 조회하는 표면이 없다 |
| 서버 전용 기록 | 확인자료 기록(#1)과 원좌표 파기(#3)는 **서버 전용이며 사용자·관리자 조작으로 삭제·수정할 수 없다.** 쓰기 표면을 열지 않는다 |
| append-only | 동의 이력은 갱신·삭제하지 않는다. 철회는 기존 행을 지우지 않고 revoked_at만 채운다 |
| 재동의 축 | **재동의는 문서 개정으로만 성립한다.** (user_id, kind, version) 유일 제약이 같은 버전의 동의 행을 하나로 묶으므로 **철회 후 같은 버전에 다시 동의하는 경로가 없다** — 이것은 결함이 아니라 REQ-SYS-15·16이 정한 축이다(재동의의 축은 문서 버전이지 토글이 아니다) |
| 동의 출처 값 | source는 **SIGNUP · REAGREE · SETTINGS 3값**이다. 값 집합의 정본은 [../05_database/01_auth.md](../05_database/01_auth.md)의 user_consents.source CHECK이며([../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md) 동일) **text + CHECK 축이라 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) 33종에 들지 않는다.** 재동의 출처의 값 이름은 **REAGREE**이며 RECONSENT가 아니다 |
| 멱등 | Idempotency-Key 대상 표면이 없다. **동일 (user_id, kind, version) 중복 동의는 멱등 처리**하고 충돌 코드로 표현한다 |
| 잠금 | 별도 잠금이 없다. 동의 기록은 자연 유일 제약이, 확인자료는 append-only가 무결성을 진다 |
| 페이지네이션 | 커서 1표면(#2). 확인자료는 체크인마다 쌓이는 시간 역순 무한 증가 목록이라 오프셋은 행을 흘린다 |
| 별도 동의 | 개인위치정보 동의는 **약관·개인정보 동의와 분리된 별도 kind**다(위치정보법 §18). 세 kind를 한 문서로 묶지 않는다 |
| 필수 동의 철회 | 필수 동의(약관 · 개인정보) 철회는 **탈퇴 경로로 안내**한다 — 서비스 이용 자체가 성립하지 않기 때문이다 |
| **철회 사유** | **미결이다** — #6 입력의 reason(선택)을 **담을 자리가 없다.** user_consents에 사유 열이 없고 이 전이의 감사 action 코드도 채번돼 있지 않다. **받아서 버리면 사용자가 적은 값이 조용히 사라지므로** 현행 구현은 본문을 받지 않는다. **사유를 남기려면 열이든 코드든 채번이 선행된다** |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | 서버 내부 | 위치정보 이용·제공 사실 확인자료 자동 기록 | 시스템 | — | PRV-01 |
| 2 | REST | GET /v1/me/location-usage-records | 본인 | 커서 | PRV-01 |
| 3 | 서버 내부 | 목적 달성 원좌표 파기 | 시스템 | — | PRV-01 |
| 4 | REST | POST /v1/me/consents | 본인 | — | PRV-02 |
| 5 | REST | GET /v1/me/consents | 본인 | — | PRV-02 |
| 6 | REST | POST /v1/me/consents/{consentId}/revoke | 본인 | — | PRV-02 |
| 7 | REST | GET /v1/me/consents/pending | 본인 | — | PRV-02 |

- 7행 = REST **5** · 서버 내부 **2**다. SSE·다운로드 표면은 없다.
- **PRV-01 기능의 세 종점 중 둘이 서버 내부**다. 자동 기록과 파기가 법정 의무이면서 사용자 조작을 허용해서는 안 되는 처리이기 때문이며, 열려 있는 것은 정보주체의 조회권(#2)뿐이다.

## 상세

### 1. 위치정보 이용·제공 사실 확인자료 자동 기록 (서버 · PRV-01)

```plain
개인위치정보 처리 요청(GPS 체크인 · 체크아웃)
├─ ① 위치정보 별도 동의 확인       미동의 → privacy.location_consent_required/403
├─ ② **확인자료 INSERT**           정보주체(user_id) · 이용·제공 일시 · 목적
│                                 · 이용·제공 주체 · 제공받은 자(있는 경우) · 수집 경로
│     └─ 기록 실패 → **처리 중단**  부수 처리가 아니라 필수 선행 단계다
└─ ③ 위치정보 처리 진행            좌표 검증 · 지오펜스 재검증 · 근태 기록
```

| 항목 | 내용 |
|------|------|
| 호출 지점 | [06_attendance.md](./06_attendance.md) #1 · #2의 ② 단계. **v1에서 개인위치정보를 다루는 표면은 이 둘뿐**이다 |
| 목적 값 | **COMMUTE_GEOFENCE_VERIFICATION 단일 값**이다(v1). DB CHECK가 값 집합을 강제하므로 임의 문자열을 허용하지 않으며, 값이 늘면 CHECK를 넓히되 과거 행의 값은 그대로 유지된다 |
| 수집 경로·제공받은 자 | collectionChannel은 **MOBILE_APP_GPS 단일 값**이다(v1). recipient는 **v1에 제3자 제공이 없어 항상 null**이며 필드는 두되 값을 채우는 경로가 없다 |
| 불변성 | 서버 전용 기록이며 **사용자·관리자 조작으로 삭제·수정할 수 없다.** UPDATE·DELETE 표면을 두지 않는다 |
| 순서 근거 | **기록이 처리보다 먼저다.** 처리 후 기록하면 처리는 됐는데 기록이 없는 구간이 생기고 그것이 곧 위반이다 |
| 표면 없음 근거 | 사용자가 요청하는 행위가 아니다. 요청 표면을 열면 위치정보 처리 없이 기록만 남기거나 그 반대가 가능해진다 |

### 2. GET /v1/me/location-usage-records — 확인자료 본인 조회 (PRV-01)

```json
{
  "items": [
    {
      "id": "…",
      "usedAt": "2026-08-03T00:01:44Z",
      "purpose": "COMMUTE_GEOFENCE_VERIFICATION",
      "processor": "insadesk",
      "recipient": null,
      "collectionChannel": "MOBILE_APP_GPS",
      "workplaceId": "…"
    }
  ],
  "page": { "size": 20, "nextCursor": "…", "hasMore": true }
}
```

| 항목 | 내용 |
|------|------|
| 권한 | **정보주체 본인 전용**이다. 관리자·플랫폼 운영자가 타인의 확인자료를 조회하는 표면이 없다 |
| 입력 | from · to(기간 필터) · cursor · size |
| 응답 | usedAt · purpose · processor · recipient · collectionChannel(위치정보법 §16② 법정 6항목의 컬럼 카멜 변환). **원좌표를 담지 않는다** |
| 정렬 | used_at 내림차순 · id 내림차순(안정 정렬) |
| 법적 근거 | 위치정보법이 요구하는 **정보주체의 확인자료 조회권**을 이 표면이 이행한다(REQ-PRV-05) |

- **원좌표를 응답에 담지 않는 것이 핵심**이다. 확인자료는 "언제 어떤 목적으로 위치정보를 썼는가"의 기록이지 위치 자체가 아니며, 원좌표는 #3이 파기 대상으로 다룬다.
- 커서를 쓰는 근거는 목록의 성질이다 — 체크인마다 행이 쌓여 시간 역순으로 무한 증가한다([01_conventions.md](./01_conventions.md)).

### 3. 목적 달성 원좌표 파기 (서버 · PRV-01)

| 항목 | 내용 |
|------|------|
| 대상 | **확인자료를 제외한 개인위치정보(원좌표)**다. attendance_records의 입·퇴근 좌표가 여기 해당한다 |
| 시점 | 목적 달성 시점 = **해당 귀속월의 근태 마감(LOCKED) 확정 시점**이다(REQ-PRV-05). 마감으로 그 기간의 지오펜스 판정이 확정되면 원좌표를 더 들고 있을 이용 목적이 없다 |
| 보존 분리 | **확인자료 자체는 법정 보존기간까지 유지한다.** 원좌표와 확인자료의 보존 정책을 분리하는 것이 이 계약의 요지다 |
| 감사 | 파기 실행은 **audit_logs에 남긴다**. 무엇을 언제 얼마나 파기했는지가 기록되지 않으면 파기 이행을 증명할 수 없다 |
| 동의 철회 연동 | 위치정보 동의 철회(#6) 시 이후 GPS 체크인을 차단하되 **이미 수집된 확인자료는 법정 보존기간까지 유지**한다. **철회한 사용자는 그 문서가 개정되기 전까지 다시 켤 수 없다**(아래) |
| v1 실행 방식 | **마감 트랜잭션 안에서 잠금 확정에 선행해 실행한다.** 잠금 뒤에 두면 읽기 전용 가드가 **같은 트랜잭션이 방금 쓴 잠금 행**을 보고 좌표 갱신을 거부해 마감이 통째로 실패한다 — **묶는 것은 순서가 아니라 트랜잭션이며**, 같은 트랜잭션이므로 마감이 되돌아가면 파기도 함께 되돌아간다. 전용 배치를 두지 않으므로 **정기작업 8건은 변하지 않는다** — purgeExpiredData는 v1.1 이월이다 |
| 표면 없음 근거 | 사용자·관리자가 파기 시점을 고르면 목적 달성 전 파기(근태 분쟁 대응 불가)나 무기한 보존(법 위반) 중 하나가 된다 |

- **기산일 관리가 안정화되기 전에 광범위한 파기 배치를 돌리지 않는다**([11_compliance.md](./11_compliance.md) CMP-04). 기산일이 틀린 상태의 파기는 그 자체가 위반이다.

### 4·5·6·7. 동의 기록·이력·철회·재동의 대상 (PRV-02)

```json
{
  "consents": [
    { "kind": "TERMS",    "termsDocumentId": "…", "version": "1.1" },
    { "kind": "PRIVACY",  "termsDocumentId": "…", "version": "1.1" },
    { "kind": "LOCATION", "termsDocumentId": "…", "version": "1.0" }
  ],
  "source": "REAGREE"
}
```

| 항목 | 4. 동의 기록 | 5. 이력 조회 | 6. 철회 | 7. 재동의 대상 |
|------|-------------|-------------|--------|---------------|
| 입력 | consents 배열 · source(SIGNUP · **REAGREE** · SETTINGS) | kind 필터 | reason(선택) | — |
| 처리 | user_consents INSERT — kind · terms_document_id · version · agreed_at · ip · user_agent | 동의·철회 이력 **전체**를 시간순으로 반환한다 | **revoked_at만 기록한다.** 행을 지우지 않는다 | 활성 버전과 최종 동의 버전을 대조해 미동의 kind를 반환한다. 항목마다 **required**(TERMS · PRIVACY true · LOCATION false — D-19)와 **agreedVersion**(그 kind에 대한 최종 동의 버전 · 한 번도 동의하지 않았으면 null)을 함께 낸다 — 화면이 필수 여부와 개정 전후를 그리는 근거다 |
| 중복 | 동일 (user_id, kind, version) 중복은 **privacy.consent_version_conflict/409**로 멱등 처리한다 | — | 이미 철회된 동의의 재철회는 common.conflict/409 | — |
| 필수 동의 | TERMS · PRIVACY는 가입 성립 조건이다 | — | **철회는 곧 탈퇴 경로로 안내**한다. 이 표면이 계정을 삭제하지는 않는다 | 미동의는 auth.consent_required/422로 차단된다 |
| 선택 동의 | LOCATION은 별도 동의이며 없으면 GPS 체크인만 막힌다 | — | 위치정보 철회 시 이후 GPS 체크인을 차단한다 | — |

- **동의 이력은 append-only다**(REQ-PRV-02). 갱신·삭제 표면이 없고 철회조차 새 사실(revoked_at)의 기록이다. "동의를 받았다"는 사실만으로는 입증이 되지 않고 **어느 버전에 언제 동의했는지가 법적 증거**이기 때문이다.
- **재동의는 새 버전에 대한 신규 동의 이력으로 기록**하며 기존 이력을 덮어쓰지 않는다(REQ-SYS-16). **인증 상태의 재동의(APP-PRIVACY·체크인 유도)는 #4가 경로**이고 source=REAGREE로 구분한다. **재동의 게이트(미인증 — 컨텍스트 발급 전)의 제출은 로그인 재수행에 동봉**되며 그 계약은 [03_auth.md](./03_auth.md) #3 ④ 소관이다 — 본 표면은 미인증 호출을 받지 않는다.
- **위치정보 동의는 별도 kind로 관리한다**(위치정보법 §18). 동의 시 수집 항목·목적·보유기간을 고지하며 그 문안은 terms_documents의 LOCATION 문서가 갖는다([14_system.md](./14_system.md) #30).
- #7은 로그인 직후와 주요 액션 진입 시 화면이 부르는 표면이다. 활성 문서가 없으면 system.terms_not_found/404이며 정의처는 [14_system.md](./14_system.md)다.
- **본인은 자신의 동의·철회 이력 전체를 조회할 수 있다**(#5 · REQ-PRV-03).
- **06_api 안의 표기는 2026-08-20에 전량 정렬됐다** — 본 문서 3곳과 [03_auth.md](./03_auth.md) #3 ④(로그인 동봉 재동의)를 같은 변경 단위에서 REAGREE로 맞췄고 docs 전수에 RECONSENT 잔존은 없다. **두 표기를 섞어 쓰지 않는다**: 서버가 RECONSENT를 저장하려 하면 CHECK 위반으로 동의 기록 자체가 실패하고, 동의는 실패해서는 안 되는 가입·재동의 게이트의 선행 단계다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| privacy.location_consent_required | 403 | 위치정보 별도 동의 없이 GPS 체크인 시도 | #1 (발생은 [06_attendance.md](./06_attendance.md) #1 · #2) |
| privacy.consent_version_conflict | 409 | 동일 (user_id, kind, version) 동의 중복 기록 — **멱등 처리** | #4 |
| auth.consent_required | 422 | 필수 동의 또는 개정 재동의 누락 — 정의처는 [03_auth.md](./03_auth.md) | #7이 예고 · 차단은 로그인·주요 액션 |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 부재 — 정의처는 [14_system.md](./14_system.md) | #4 · #7 |
| auth.owner_must_transfer | 409 | 필수 동의 철회에서 탈퇴 경로로 넘어갈 때 소유 사업장 존재 — 정의처는 [03_auth.md](./03_auth.md) | #6이 안내 · 차단은 탈퇴 표면 |
| common.not_found | 404 | 동의 이력 부재 또는 타인 이력 | #6 |
| common.conflict | 409 | 이미 철회된 동의의 재철회 | #6 |
| common.validation_failed | 400 | 커서 형식 오류 · 요청 본문 검증 실패 | #2 · #4 |

- **privacy 2종 전량이 이 표에 있다.** 이 도메인이 정의처이며 location_consent_required의 실제 발생 표면은 근태 도메인이다.
- 필수 동의·재동의 누락 차단은 auth.consent_required/422이며 **이 문서에서 신설하지 않는다.**

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| location_usage_records | #1 INSERT · #2 SELECT | 위치정보 이용·제공 사실 확인자료 — **서버 전용 기록 · 사용자·관리자 삭제·수정 불가** |
| user_consents | #4 INSERT · #5 · #7 SELECT · #6 UPDATE(revoked_at) | 동의 이력 — kind별 버전·시각·철회 시각 · **append-only** |
| terms_documents | #4 · #7 SELECT | 동의 대상 문서 버전 — LOCATION은 별도 kind. 관리 표면은 [14_system.md](./14_system.md) |
| attendance_records | #3 UPDATE | 위치정보 처리의 발생 지점 — 체크인 좌표와 정확도. **원좌표 파기의 대상**이다 |
| audit_logs | #3 INSERT | 원좌표 파기 실행의 감사 기록 |
| users | #4 · #5 · #6 SELECT | 정보주체 식별 |

## 추적성

기능명·우선순위의 정본은 [../02_features/13_privacy.md](../02_features/13_privacy.md)다.

| 기능ID | 표면 |
|--------|------|
| PRV-01 위치정보 이용·제공 사실 확인자료 | #1(서버) · #2 · #3(서버) |
| PRV-02 동의 이력 관리 | #4 · #5 · #6 · #7 |

**PRV 2기능 전수를 담았다**(위 표 2행). PRV-01은 자동 기록과 파기가 서버 내부 종점이고 정보주체 조회권만 REST 표면으로 열린다 — 사용자가 기록을 만들거나 지울 수 있으면 법정 의무 이행 자체가 증명되지 않는다.

## 관련 문서

- 전역 규약·커서 페이지네이션 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/13_privacy.md](../02_features/13_privacy.md)
- 요구사항 정본 → [../03_requirements/14_privacy.md](../03_requirements/14_privacy.md) · 법정 보존 기산일·감사 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 가입 동의·탈퇴 경계 → [03_auth.md](./03_auth.md) · 위치정보 처리의 발생 지점 → [06_attendance.md](./06_attendance.md) · 문서 버전 관리와 재동의 트리거 → [14_system.md](./14_system.md) · 보존 기산일 관리 → [11_compliance.md](./11_compliance.md)
- 위치정보법 통제·위치기반서비스사업 신고 → [../10_security/05_location_privacy.md](../10_security/05_location_privacy.md) · PII 보호 → [../10_security/04_pii_protection.md](../10_security/04_pii_protection.md)
- 테이블 명세 → [../05_database/16_privacy.md](../05_database/16_privacy.md) · [../05_database/01_auth.md](../05_database/01_auth.md)
- 개인정보·위치정보 공식 출처 → [../03_requirements/18_official_references.md](../03_requirements/18_official_references.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
