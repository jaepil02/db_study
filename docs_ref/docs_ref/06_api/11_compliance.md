# 06_api / 11 법정 준수 (CMP)

> **대상**: CMP 도메인 REST 표면 — 상시근로자 수 산정(제1항 기본식·제2항 보정)과 일자별 시계열 · 스냅샷 확정과 차단 · 규모별 적용 정책 조회 · 법정 서류 보존 관리 · 퇴사자 본인 법정문서 열람의 인가 축 · 사업 단위 판정(합산 범위)
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **#6 보존 목록·#8 기한 과제 목록에 검색 축 q를 신설**한다(REQ-WRK-25 일반화 · [01_conventions.md](./01_conventions.md) q 상한 50 · ESCAPE 규약). ① **#6은 문서명(파일 실체의 original_name)·직원명**의 부분 일치다 — 파일 실체가 없는 보유처(임금대장·근로자명부)는 문서명이 널이라 문서명 검색에 걸리지 않는다. ② **#8은 대상자명**(detail 스냅샷)만이다 — 과제는 제목 컬럼이 없어 taskType 라벨은 검색 대상이 아니다. #6·#8을 원장으로 공유하는 [10_tax.md](./10_tax.md) #2·#6도 같은 대상자명 검색을 함께 받는다. **표면 수 14 · 번호 · 권한 · 페이지네이션 방식은 전건 불변**
> **개정일**: 2026-09-12 — **정본 세 문서가 갈려 있던 보존 관리(CMP-04)의 조회 대상을 REQ 쪽으로 정합**하고 사업 단위 판정(#10)의 그룹 축을 나눈다. ① **#6 · #7의 원장을 documents 단일에서 유형별 물리 보유처 4곳**(contracts · payroll_runs · employees · payslips)**으로 넓힌다** — 이 문서가 "documents 가 유일한 원장"이라 적고 구현이 그대로 따랐는데, [../02_features/09_compliance.md](../02_features/09_compliance.md) CMP-04 와 [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md) REQ-CMP-10 은 "물리 보유처 4곳"이며 **"문서함만 보면 임금대장과 근로자명부가 빠진다"고 정확히 그 실패를 경고**하고 있었다. **근로기준법이 보존을 요구하는 근로자명부·임금대장은 업로드된 파일이 아니라 데이터베이스 행으로 존재**하므로 법령이 요구하는 REQ 쪽이 맞고, **갈린 쪽이 이 문서였다.** 그 귀결로 필터·정렬 축 `category`(문서함 분류 10값)가 **`documentType`(보존 서류 4종)**으로 바뀌고, 응답의 `documentId`가 **`recordId`**(보유처 행)로, 파일 3필드가 **널 가능한 `file` 객체**로 바뀐다. ② **#10에 `groupSiteCount`를 더한다** — 사업장 조회가 멤버십 축이라 그룹의 다른 사업장에 멤버십이 없는 MANAGER 에게는 목록이 하나뿐이 되고, "없다"와 "못 본다"가 같은 결론이 되어 **미판정 위험 경고가 서지 않았다.** 상세는 넓히지 않는다. **표면 수 14 · 번호 · 권한 · 에러 코드 · 페이지네이션 방식은 전건 불변**이며 응답 필드 변경은 v1 안의 변경이다
> **개정일**: 2026-09-10 — **DUE_SOON 임계일수 미결을 닫는다**(2026-09-09 등재분) — **남은 일수 3일 이하가 임박**이며(사용자 확정 2026-09-10) 값은 **기준값 테이블의 FILING_DEADLINE / due_soon_window**가 갖는다. 이 문서가 「값이 정해지면 기준값 테이블에서 조회한다」를 못박은 자리라 **코드 상수를 걷었고 부재는 payroll.missing_reference_value/422로 차단한다** — 임의 기본값으로 파생하면 화면 배지 · 알림 경보일 · 목록 필터가 서로 다른 날을 임박이라 부른다. **억제 키는 (과제, dueState)를 유지한다** — dueState가 이미 구간을 담으므로 임계가 정해져도 새 축이 필요하지 않다. 카테고리 열거의 정본은 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.3 · key 열거는 [../05_database/15_system.md](../05_database/15_system.md)다. **표면 수 14 · 번호 · 권한 · 에러 코드 · 카테고리 19종은 전건 불변**이며 시드 행 하나만 늘어난다
> **개정일**: 2026-09-10 — **#8의 허용 정렬 축을 등재하고 응답에 employeeName을 더한다**. ① 허용 정렬은 dueDate(기본) · triggerDate · createdAt에 **taskType · employeeName · status**를 더한 여섯이며 **목록 열과 같은 집합**이다(ADM-DEADLINE-CALENDAR — 기본 정렬이 기한 오름차순 → 유형 오름차순이라 **taskType이 축인 표면은 이곳뿐**이다). ② **응답에 employeeName이 없어 화면의 「대상」 열을 그릴 값이 어디에도 없었다** — employeeId만 나갔다. 값의 출처는 **detail 스냅샷**이고 정렬이 읽는 자리와 같다 — 표시와 정렬이 다른 원천을 보면 정렬된 목록이 정렬되지 않은 것처럼 보인다. **사업장 단위 과제는 널**이며 그 널이 「대상자가 없는 기한」이라는 표현이다. **표면 수 14 · 번호 · 권한 · 에러 코드 · 페이지네이션 방식은 전건 불변** — 응답 필드 추가와 정렬 축 추가는 v1 안의 변경이다
> **개정일**: 2026-09-10 — **#1 · #6의 허용 정렬 축을 등재한다** — 표에 칸이 없어 **축이 있는지 없는지 문서만 보고 알 수 없었고**, 실제로 #6은 축 자체가 없었다. ① **#1에 averageHeadcount를 더한다**(baseDate · createdAt에 이어 셋) — 정렬 토큰은 응답 필드명이며 저장 축의 열 이름이 아니다. ② **#6에 정렬 파라미터를 신설**하고 축 셋(retentionUntil 기본 · category · **baseDate**)을 등재한다. **기산일은 저장된 열이 아니라 보존기한에서 근거별 연수만큼 되돌린 값**이고 그 연수 표의 정본은 하나라 질의가 바인딩으로 받는다 — 되돌리지 못한 행은 양방향 모두 마지막이다. **#7은 정렬 축을 열지 않는다**(쪽을 나누지 않는 전량 목록이라 화면이 스스로 한다). **표면 수 14 · 번호 · 권한 · 페이지네이션 방식은 전건 불변**
> **개정일**: 2026-09-10 — **INSURANCE_ACQUISITION 생성 지점 미결을 닫는다**(2026-09-09 등재분) — **입사 확정**([05_hr.md](./05_hr.md) #11)의 부수효과이며 **표면을 새로 채번하지 않았다**(표면 14 · REST 12 · **API 표면 258은 전건 불변**). 이로써 **task_type 6종 전부 생성 지점을 갖는다.** 함께 **취득·상실 기한이 보험별로 갈린다**는 것을 등재한다 — 건강보험만 그 날부터 14일이고 **과제 기한은 적용 보험 중 가장 이른 값**이며 근거는 행의 detail이 든다(정본 [../05_database/12_compliance.md](../05_database/12_compliance.md)). **에러 코드 · 권한 · 전이 가드는 전건 불변**
> **개정일**: 2026-09-09 — **기한 과제 전이 표면을 둘로 가른다** — #9 PATCH …/compliance-tasks/{taskId} **폐지** · **#14 POST …/complete** · **#15 POST …/waive** 말미 채번. **문서 안의 내부 모순을 없앤 것**이다 — [01_conventions.md](./01_conventions.md)가 두 자리에서 "상태 전이는 전부 POST"와 "PATCH { status }로 상태를 전이하지 않는다"를 못박는데 이 표면 하나가 그 형태였고, **OPEN → COMPLETED와 OPEN → WAIVED의 요구 입력이 달라**(면제만 사유 필수) 하나로 두면 **사유 필수 여부가 본문 값에 따라 갈리는 조건부 검증**이 됐다. **#9는 결번으로 남기고 재사용하지 않는다.** 표면 13 → **14**(REST 11 → **12**)이며 **고정 기준이 움직인다 — API 표면 255 → 256 · REST 227 → 228**(정본 [README.md](./README.md)). 함께 등재한 미결 셋 — **DUE_SOON 임계일수의 정본 부재** · **checklist 키(item · done)를 정하는 자리가 이 문서 예시 하나뿐** · **INSURANCE_ACQUISITION 과제의 생성 지점 부재**. checklist 예시의 taskType도 금품청산으로 맞췄다(그 유형만 checklist를 갖는데 상실신고 과제에 실려 있었다)
> **개정일**: 2026-09-07 — 표 형식 결함 **2건 정정**(표 셀 검사 발견). ① 연동 표의 severance_assessments 행이 3열 표에서 **2칸이라 설명이 접근 칸으로 밀려** 있었다 — 셋으로 갈랐다. ② 보존 목록·도래 목록 대조 표에서 **기산일 · 재직 중 만료 방지 · v1 범위 · 원장 네 행이 두 표면의 대조가 아니라 보존 축 전체의 성질**인데 한 칸에 담겨 있었다 — **마크다운이 빈 칸을 채워 렌더하므로 "#6에만 해당한다"로 읽혔고 그것은 쓰려던 뜻의 정반대다.** 넷을 표 밖 항목으로 뺐다(대조표에 대조 아닌 행이 섞이면 표의 축이 흐려진다). **내용·표면 수·번호는 전건 불변**
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행에 **action 코드를 병기**한다. #9 기한 과제 면제의 코드가 없어 **V0718이 compliance_task.waive를 채번**했다 — 이 표가 #9를 audit_logs 대상으로 이미 선언했는데 붙일 코드가 없던 자리다. **사유 필수는 #3 · #4 둘뿐**임도 표시했다 — 면제 사유는 waived_reason이 표면 계약으로 필수라 감사 배열에서 다시 강제하면 정본이 둘이 된다. **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-08-20 — CMP-07 집행 표면 열거에 [05_hr.md](./05_hr.md) **#36**(본인 계약 상세) 추가 — 2026-08-20 신설된 표면이며 같은 인가 축(본인 소유권)의 집행 지점이다. **표면 수는 13으로 불변**이다(#36의 소유는 05_hr)
> **개정일**: 2026-08-08 — 법정 서류 보존 관리를 documents.retention_until 조회 전용으로 축소(보존 과제 유형 없음) · 기한 과제 표면의 대상 축을 신고·지급 기한 전용으로 한정하고 원천징수이행상황신고 과제의 생성 지점 등재 · 스냅샷 목록의 입력·응답에 산정 범위(scope) 명시
> **개정일**: 2026-08-03 — 파견·도급 산정 제외 확정 반영
> **원천**: [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md)(REQ-CMP-01~10) · [../02_features/09_compliance.md](../02_features/09_compliance.md)(CMP 5기능) · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)(REQ-GLB-11 · 12 · 18) · 확정 결정 D-14 · D-15 · D-18

**상시근로자 스냅샷은 5인·10인 분기의 유일한 근거**다(REQ-GLB-11). 사업장 속성도, 수동 플래그도, 활성 멤버 수도 근거가 아니다. 그래서 이 도메인의 산정 표면(#3)이 만들어 내는 값 하나에 근태 마감 · 급여 확정 · 연차 발생 세 도메인이 걸려 있고, 값이 없으면 셋 다 차단된다.

**단일 5인 미만 플래그를 저장하지 않는다**(D-14). 취업규칙(10인)·성희롱 예방교육(10인)이 5인과 다른 경계를 쓰므로 **평균 근로자 수 실수값과 일자별 시계열**을 저장하고 임계값별 경계를 파생시킨다. 제2항 보정을 구현하려면 시계열이 필수이기도 하다 — 월 평균값 하나로는 계산할 수 없다.

**경계 판정은 반올림된 평균이 아니라 정수 비교다.** 평균값은 표시·감사용이며 판정은 연인원과 임계값 × 가동일수의 비교로 한다(REQ-GLB-02).

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 전 표면이 /v1/workplaces/{workplaceId}/… 이다. 규모 정책의 **변경**은 플랫폼 표면([14_system.md](./14_system.md))이 소유하고 여기서는 조회만 한다 |
| 권한 축 | MANAGER(산정 · 조회 · 보존 관리) · **OWNER 전용 1갈래**(사업 단위 독립성 선언) |
| 멱등 | 산정 실행(#3) **1표면**이 Idempotency-Key 필수다. (workplace_id, base_date, scope) 유일 제약이 2차 방어다 |
| 잠금 | 산정은 (사업장, 기준일, 산정 범위) 단위 UPSERT이며 동시 실행은 유일 제약이 흡수한다. **확정된 과거 스냅샷을 자동으로 덮어쓰지 않는다** |
| 정수 비교 | 경계 판정에 실수 평균을 쓰지 않는다. 연인원 ≥ 임계값 × 가동일수와 2 × 미달일수 ≥ 가동일수의 정수 비교로 한다 |
| 차단 위임 | **스냅샷 부재는 이 도메인이 코드를 내지 않는다.** 차단이 일어나는 도메인의 코드로 표현되며 이것이 REQ-CMP-06이 의도한 설계다 |
| 페이지네이션 | 오프셋 3표면(#1 · #6 · #8). 시계열은 스냅샷 단건(#2) 안에 담기므로 별도 목록 표면을 두지 않는다 |
| 소급 금지 | 확정 후 산정 정정은 **자동 소급하지 않고** 관리자 재계산(원본 무효화 + 정정본)으로만 반영하며 감사 로그를 남긴다 |
| 자동 합산 금지 | 사업 단위 판정은 법적 판단이라 자동으로 내리지 않는다. **선언 + 경고 방식**이며 근거를 감사 보존한다(D-18) |
| 산정 범위(scope) | 스냅샷은 **scope ∈ WORKPLACE · BUSINESS_UNIT** 축을 갖는다. 유일 키가 (workplace_id, base_date, scope) 3열이라 **같은 기준일에 사업장 단위 산정과 합산 단위 산정이 각각 한 행씩 존재**한다. 조회·산정 표면은 scope를 쿼리로 받고 **생략 시 기본값은 WORKPLACE**다. BUSINESS_UNIT은 사업 단위 판정(#11)이 COMBINED로 선언된 그룹에서만 유효하다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | REST | GET /v1/workplaces/{workplaceId}/employee-count-snapshots | MANAGER | 오프셋 | CMP-01 |
| 2 | REST | GET /v1/workplaces/{workplaceId}/employee-count-snapshots/{baseDate} | MANAGER | — | CMP-01 |
| 3 | REST | POST /v1/workplaces/{workplaceId}/employee-count-snapshots | MANAGER · 멱등 | — | CMP-01 |
| 4 | REST | POST /v1/workplaces/{workplaceId}/employee-count-snapshots/{baseDate}/confirm | MANAGER | — | CMP-01 |
| 5 | REST | GET /v1/workplaces/{workplaceId}/size-policies | MANAGER | — | CMP-02 |
| 6 | REST | GET /v1/workplaces/{workplaceId}/retention | MANAGER | 오프셋 | CMP-04 |
| 7 | REST | GET /v1/workplaces/{workplaceId}/retention/due | MANAGER | — | CMP-04 |
| 8 | REST | GET /v1/workplaces/{workplaceId}/compliance-tasks | MANAGER | 오프셋 | CMP-04 · TAX-11 |
| 10 | REST | GET /v1/workplaces/{workplaceId}/business-unit-assessment | MANAGER | — | CMP-08 |
| 11 | REST | PUT /v1/workplaces/{workplaceId}/business-unit-assessment | OWNER | — | CMP-08 |
| 12 | 서버 내부 | 정기작업 recomputeEmployeeCountSnapshot(매일 02:20 KST) | 시스템 | — | CMP-01 |
| 13 | 서버 내부 | 본인 소유권 인가 술어 — 멤버십 술어와 별개 축 | 시스템 | — | CMP-07 |
| 14 | REST | POST /v1/workplaces/{workplaceId}/compliance-tasks/{taskId}/complete | MANAGER | — | CMP-04 · TAX-11 |
| 15 | REST | POST /v1/workplaces/{workplaceId}/compliance-tasks/{taskId}/waive | MANAGER | — | CMP-04 · TAX-11 |

- 14행 = REST **12** · 서버 내부 **2**다. SSE·다운로드 표면은 없다. **#9는 결번이다** — 아래 각주가 근거다.
- **#14 · #15는 말미 채번이고 #9는 폐지분이다.** 하나의 PATCH 전이 표면을 둘로 가른 것이며, **폐지한 번호를 재사용하지 않으므로**([README.md](./README.md)) 남은 쪽에 #9를 물려주지 않는다 — 물려주면 같은 번호가 다른 메서드·다른 경로를 가리키게 되고, 타 문서가 인용한 "#9"가 **어느 쪽을 뜻하는지 문서만 보고는 알 수 없다.** 업무 흐름상 자리는 조회(#8) 옆이다.
- **기한 과제 표면 3종(#8 · #14 · #15)은 이 문서가 소유한다.** 과제 원장(compliance_tasks)이 신고 기한(TAX-11) · 금품청산과 퇴직급여(PAY-19) · 원천징수이행상황신고의 공용 저장소라, 생성은 각 도메인이 하고 **조회·전이는 한 문서로 모은다** — 같은 원장의 전이를 여러 문서가 나눠 가지면 상태 가드가 갈린다. **전이 표면이 둘인 것은 그것과 다른 축**이다(전이마다 요구 입력이 달라 나눈 것이며 소유 문서는 하나다). **법정 보존 관리(CMP-04)의 축은 이 원장이 아니라 documents.retention_until 조회(#6 · #7)**이며, #8 · #14 · #15는 CMP-04 화면이 신고·지급 기한을 함께 보여 줄 때 소비된다.
- **CMP-07은 새 화면도 새 표면도 아니라 인가 판정의 축을 바꾸는 계약**이다. 집행은 명세서·급여이력·근로계약 표면이 하며 #13이 그 축을 고정한다.

## 상세

### 1·2. 스냅샷 목록·상세 (CMP-01)

```json
{
  "workplaceId": "…",
  "baseDate": "2026-07-31",
  "scope": "WORKPLACE",
  "periodFrom": "2026-07-01",
  "periodTo": "2026-07-31",
  "totalHeadcountDays": 138,
  "operatingDays": 27,
  "averageHeadcount": "5.111",
  "thresholds": [
    { "threshold": 5, "applied": true, "rule": "CLAUSE_1", "shortfallDays": 4 },
    { "threshold": 10, "applied": false, "rule": "CLAUSE_1", "shortfallDays": 27 }
  ],
  "series": [ { "date": "2026-07-01", "headcount": 5 }, { "date": "2026-07-02", "headcount": 6 } ],
  "source": "AUTO",
  "confirmedBy": null
}
```

| 항목 | 1. 목록 | 2. 상세 |
|------|--------|--------|
| 입력 | 기간 필터 · **scope**(생략 시 WORKPLACE) · source · 확정 여부 · 오프셋 | — |
| 허용 정렬 | baseDate(기본 · desc) · createdAt · **averageHeadcount** | — |
| 응답 | 기준일 · **산정 범위(scope)** · 평균값 · 임계값별 판정 결과 · source · 확정 여부 | 위 예시 전체(**일자별 시계열 포함**) |
| 시계열 | 요약에는 넣지 않는다 — 목록 응답이 커진다 | series 배열로 전량을 준다 |

- **단일 5인 미만 플래그를 저장하지 않는다.** thresholds 배열이 임계값별 경계를 담고, 새 임계값이 필요해지면 실수값과 시계열에서 파생한다(D-14).
- averageHeadcount는 **표시·감사용 실수값**이다. 판정은 thresholds의 applied가 정본이며 그 값은 정수 비교로 산출된다.
- **정렬 토큰은 응답 필드명이다** — averageHeadcount이며 저장 축의 열 이름이 아니다. 클라이언트가 아는 이름은 응답에 실린 것 하나뿐이므로 그 이름으로 정렬을 건다. **이 축이 정렬 대상인 것과 판정의 정본이 thresholds인 것은 따로다** — 목록을 평균값 순으로 보는 것은 5인 경계에 걸친 기준일을 찾는 동선이고, 그 경계의 판정은 여전히 applied가 답한다.
- **(workplace_id, base_date, scope)는 유일하다.** 같은 기준일에 사업장 단위(WORKPLACE)와 합산 단위(BUSINESS_UNIT) 산정이 각각 한 행씩 존재할 수 있으므로 응답에 scope를 함께 담는다.

### 3·4. 산정 실행·확정 (CMP-01)

```json
{ "baseDate": "2026-07-31", "reason": "급여 확정 전 산정" }
```

산정은 **제1항 기본식**과 **제2항 보정** 2단이다.

```plain
① 산정기간 결정        법 적용 사유 발생일(baseDate) 이전 1개월
② 대상 근로자 범위      근로자 아닌 자를 제외한다 — 대표자 본인 · 동거 친족만 사용하는 사업 · 가사사용인
                      (worker_type — [05_hr.md](./05_hr.md) #34)
                      **파견·도급 근로자는 산정 제외로 확정**됐다(시행령 §7의2④ — 확인 완료). 선언 기반 입력은 유지하되 기본값은 제외다
③ 일자별 시계열 산출     (날짜, 근로자 수) 배열. 연인원 = 시계열 합 · 가동일수 D = 시계열 길이
                      가동일수는 0보다 커야 한다
④ 제1항 기본식         평균 = 연인원 ÷ 가동일수 (표시·감사용 실수값으로 저장)
⑤ 제2항 보정 — 임계값 T별로 판정을 뒤집는다
      U = 산정기간 중 근로자 수가 T 미만인 날의 수
      ├─ 연인원 < T × D  이고  2U < D   → **T 이상으로 본다**(적용)
      ├─ 연인원 ≥ T × D  이고  2U ≥ D   → **T 미만으로 본다**(미적용)
      └─ 그 외                           → 제1항 결과를 따른다
⑥ UPSERT              (workplace_id, base_date, scope) 단위 멱등 UPSERT
                      **확정된 과거 스냅샷은 덮어쓰지 않는다**
```

| 항목 | 3. 산정 실행 | 4. 확정 |
|------|-------------|--------|
| 권한 | MANAGER · 멱등키 필수 | MANAGER |
| 입력 | baseDate · reason(선택) | reason(필수) |
| 처리 | 위 ①~⑥. source=MANUAL로 기록한다 | confirmed_by를 채우고 이후 자동 재산정 대상에서 제외한다 |
| 응답 | 산출된 스냅샷 자원 | 확정된 스냅샷 자원 |
| 실패 | common.validation_failed/400(가동일수 0 · 기준일 형식) · common.conflict/409(확정된 스냅샷 덮어쓰기 시도) | common.not_found/404 · common.conflict/409(이미 확정) |

- **제2항 보정이 제1항 판정을 뒤집는다**(REQ-CMP-04). 평균이 5명 미만이어도 미달일수가 가동일수의 절반 미만이면 5인 이상으로 본다 — 이 규칙을 빠뜨리면 가산수당·연차 적용이 통째로 잘못된다.
- **경계 판정은 반올림된 평균이 아니라 정수 비교로 수행**한다. averageHeadcount를 소수 둘째 자리에서 반올림해 5.00과 비교하면 경계에서 판정이 갈린다.
- 기간 중 경계를 넘나들면 **귀속 기간별 스냅샷 기준**으로 분기를 적용한다(REQ-CMP-07).
- 확정 후 정정은 자동 소급하지 않는다 — 급여 재계산은 원본 무효화 + 정정본 경로([08_payroll.md](./08_payroll.md))로만 반영하며 감사 로그를 남긴다.

**스냅샷이 없으면 세 도메인이 차단된다.** 이 도메인은 그 코드를 내지 않고 각 도메인이 자기 맥락의 코드를 낸다(REQ-CMP-06).

| 차단 지점 | 코드 | 정의처 |
|----------|------|--------|
| 급여 계산·확정 | payroll.employee_count_snapshot_required/422 | [08_payroll.md](./08_payroll.md) |
| 연차 발생·조회 | leave.employee_count_snapshot_required/422 | [07_leave.md](./07_leave.md) |
| 근태 마감 | attendance.closing_blocked/409(사유 배열에 포함) | [06_attendance.md](./06_attendance.md) |

사용자는 "상시근로자 산정이 없다"가 아니라 "이 급여를 확정할 수 없다"는 맥락에서 문제를 만나야 한다.

### 5. GET /v1/workplaces/{workplaceId}/size-policies — 규모별 적용 정책 조회 (CMP-02)

| 항목 | 내용 |
|------|------|
| 입력 | baseDate(필수) · threshold(선택) |
| 응답 | 조문키별 적용 여부 · 임계값 · 적용 근거 · effective 구간 · **정책 버전** |
| 조회원 | statutory_rates의 SIZE_POLICY 행이다. **코드에 하드코딩하지 않는다** |
| 성격 | **사업장 적용분의 읽기 전용 소비 조회**다. 특정 사업장의 기준일에 어떤 조문이 적용되는지를 돌려줄 뿐 값을 만들지 않는다 |
| 변경 권한 | 정책값 생성·수정은 **플랫폼(ADMIN) 표면**([14_system.md](./14_system.md) **#28 · #29**)이 소유한다(관리 축 조회는 #27 — 플랫폼(VIEWER)). **관리 축(SYS-POLICY)과 이 소비 조회는 별개 표면**이며 권한 축도 다르다 — 사업장 관리자가 자기 사업장의 법 적용 조문을 바꿀 수 있으면 규모 분기가 사업장 재량이 된다 |
| 화이트리스트 | 근로기준법 시행령 [별표 1]은 **5인 미만에 적용되는 조문만 열거하는 화이트리스트**다. **목록에 없으면 미적용**이며 이를 제외 목록으로 오해하면 분기가 통째로 뒤집힌다(REQ-GLB-12 · D-15) |
| 동결 | 급여 확정 시 **적용된 정책 버전을 결과에 동결**한다. 적용 조문이 바뀌어도 과거 급여가 뒤틀리지 않는다 |

v1 계산에 영향을 주는 조문키의 초기 세트는 **17종**이며 값의 실제 정본은 statutory_rates의 SIZE_POLICY 행이다. 목록의 정본은 [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md)다.

- 5인 미만에 **적용**되는 것 — 주휴일 · 휴게시간 · 금품청산 · 임금지급 4원칙 · 임금대장 · 임금명세서 교부 · 근로자명부와 서류 보존 · **제5장 여성과 소년 전체** · 해고예고 · 최저임금법 · 4대보험 · 퇴직금이다.
- 5인 미만에 **미적용**인 것 — 연장근로 주 12시간 한도 · 관공서 공휴일 유급 · 연장·야간·휴일 가산 · 연차유급휴가다.
- 10인 이상에서 추가 발생하는 것 — 취업규칙 작성·신고이며 **v1은 경계 감지만** 한다.

### 6·7. 법정 서류 보존 목록·도래 목록 (CMP-04)

| 항목 | 6. 보존 목록 | 7. 도래 목록 |
|------|-------------|-------------|
| 입력 | **documentType** · employeeId · 기간 · asOf(선택 · 기본은 오늘) · 오프셋 | asOf(선택 · 기본은 오늘) |
| 허용 정렬 | retentionUntil(기본 · asc) · **documentType** · **baseDate** | 고정(retentionUntil 오름차순) |
| 응답 | **recordId** · 문서 유형 · 대상자 · **기산일** · 보존기한 · 남은 일수 · **file**(널 가능) | 보존기한이 도달했거나 임박한 행 목록 |

**아래 넷은 두 표면의 대조가 아니라 보존 축 전체의 성질이다** — 대조표에 두면 빈 칸이 "#6에만 해당한다"로 읽힌다.

- **기산일은 유형별로 다르다** — 근로계약서 = 근로관계 종료일 + 3년 · 임금대장 = 마지막 기입일 + 3년 · 근로자명부 = 퇴직일 + 3년 · 임금명세서 = 지급일 + 3년.
- **재직 중 만료 방지** — 근로계약서와 근로자명부는 **근로관계 종료 시점에 보존기한을 확정·연장**한다. 종료 전에는 만료 없음으로 표기한다.
- **v1 범위** — **자동 파기 배치를 두지 않는다.** 보존기한 도달 목록 제시까지가 범위이며 파기 실행 표면이 없다.
- **원장은 유형별 물리 보유처 4곳이다**(2026-09-12 정정 — 종전 "documents 단일 원장"은 REQ-CMP-10·CMP-04 와 갈려 있었고 **갈린 쪽이 이 문서였다**). 근로계약서는 **contracts** · 임금대장은 **payroll_runs** · 근로자명부는 **employees** · 임금명세서는 **payslips** 행이 각자 기산일과 보존기한을 든다. **documents 는 파일 실체를 붙이는 바깥 조인이지 원장이 아니다** — 임금대장과 근로자명부는 관리자가 PDF 를 내려받기 전까지 문서 행으로 존재하지 않으므로, 문서함만 훑으면 **법정 필수 서류 둘이 목록에서 통째로 빠진다.** 보존을 기한 과제로 만들지 않으며 compliance_tasks에 보존 유형을 두지 않는다.
- **documentType 은 문서함 분류(documents.category)가 아니다.** 값은 **EMPLOYMENT_CONTRACT · WAGE_LEDGER · WORKER_REGISTER · PAYSLIP** 넷이다. 문서함 분류는 임금대장과 근로자명부를 같은 값(LEDGER)으로 접는데, 둘은 기산 사건이 다른 별개의 서류라 보존 축에서 갈라 보아야 한다. 등재 밖 값은 무시하지 않고 `common.validation_failed/400`(필드 `documentType`)이다.
- **recordId 는 보유처 행의 식별자이고 문서 식별자가 아니다.** 파일은 `file` 객체가 들고 **없으면 널**이다 — 없는 것이 결함이 아니라 "아직 내보내지 않았다"는 사실이며, 빈 값을 가진 객체로 채우면 화면이 이름 없는 파일이 있는 것으로 읽는다.
- **각 보유처에서 무엇을 담는가** — 계약은 서명 이후(SIGNED · ARCHIVED · 초안·발송은 아직 근로계약서가 아니다) · 급여 실행은 보존기한이 선 행(확정 전이가 그 값을 세운다) · 직원은 전원(근로자명부는 사람마다 한 줄이다) · 명세서는 전량이다. **임금대장은 사업장 단위**라 employeeId 가 널이고, 대상자 필터를 걸면 자연히 빠진다.
- **기산일 없이 파기 배치를 돌리는 것 자체가 위반**이다(REQ-GLB-18). 그래서 v1은 파기를 자동화하지 않고 기산일 관리(#6)가 안정화된 뒤로 미룬다 — 정기작업 purgeExpiredData가 v1.1 이월인 근거다.
- 이 표면은 조회만 한다. **보존 축에는 완료·면제 전이가 없다** — 전이가 필요한 것은 신고·지급 기한 과제(#14 · #15)뿐이다.
- **#6의 기산일 정렬은 저장된 열을 보지 않는다.** 기산일을 담는 열이 없어 보존기한에서 근거별 연수만큼 되돌린 값이며, **그 연수 표의 정본은 하나**다 — 질의가 스스로 알지 않고 바인딩으로 받는다. 적어 두면 법정 보존기간의 정본이 둘이 되고 기간이 바뀔 때 한쪽만 움직여도 드러날 자리가 없다.
- **되돌리지 못한 행은 어느 방향이든 마지막이다**(NULLS LAST). 등재되지 않은 근거는 기산일을 비우는 것이 계약이고, 정렬도 그 계약을 따른다 — 기한이 서지 않은 행(재직 중인 근로계약서·근로자명부)이 기본 정렬에서 마지막인 것과 같은 축이다.
- **#7은 정렬 축을 열지 않는다.** 조치 대상의 전량이라 쪽을 나누지 않고, 나누지 않는 목록에서 정렬은 화면이 스스로 할 수 있는 일이다.

### 8. 기한 과제 조회 (CMP-04 · TAX-11)

```json
{
  "taskId": "…",
  "taskType": "WAGE_SETTLEMENT",
  "employeeId": "…",
  "employeeName": "홍길동",
  "triggerEvent": "RESIGNATION",
  "triggerDate": "2026-08-10",
  "dueDate": "2026-08-24",
  "status": "OPEN",
  "dueState": "DUE_SOON",
  "checklist": [ { "item": "WAGE", "done": true }, { "item": "SEVERANCE", "done": false }, { "item": "UNUSED_LEAVE_ALLOWANCE", "done": false } ],
  "documentId": null,
  "waivedReason": null
}
```

| 항목 | 8. 목록 조회 |
|------|-------------|
| 권한 | MANAGER |
| 입력 | status(OPEN · COMPLETED · WAIVED) · taskType · employeeId · from · to(기한 범위) · dueState · 오프셋 |
| 허용 정렬 | dueDate(기본 · asc) · triggerDate · createdAt · **taskType** · **employeeName** · **status** |
| 응답 | 위 예시의 배열. 기한 임박·경과는 **dueState 파생 필드**로 준다 |
| 대상 축 | **신고·지급 기한 과제 전용**이며 **6종 전수**다 — 4대보험 취득 · 4대보험 상실 · 이직확인서 · 금품청산 · 퇴직급여 · 원천징수이행상황신고. **보존 과제 유형은 존재하지 않는다**(보존은 #6 · #7의 documents 조회 축이다) |

- **status는 OPEN · COMPLETED · WAIVED 3값뿐이고 임박(DUE_SOON)·경과(OVERDUE)는 상태로 저장하지 않는다.** dueState는 요청의 asOf 또는 오늘(KST)과 dueDate를 비교해 응답 시점에 파생하며 **비교의 임계는 기준값이 갖는다**(아래 항목) — **배치가 상태를 쓰면 재실행 결정성이 깨진다**(같은 기준일로 재실행한 배치가 같은 행을 다른 상태로 만든다).
- **DUE_SOON의 임계일수는 남은 일수 3일 이하다**(사용자 확정 2026-09-10 — 2026-09-09에는 정한 자리가 없어 미결로 등재돼 있었고 dueState 3값과 파생 계약을 다섯 문서가 중복 등재하는데 **며칠 남았을 때 DUE_SOON인가**만 비어 있었다). 값의 정본은 **기준값 테이블의 FILING_DEADLINE / due_soon_window**(제품 파라미터 · rule days_before_due · 사건 축은 기한 자체)이며 **코드에 상수로 박지 않는다**(REQ-GLB-09 기준값 계약) — 행이 없거나 미확인이면 **payroll.missing_reference_value/422**이고 details가 (category, key)를 든다. **억제 키는 (과제, dueState)를 그대로 둔다** — dueState가 이미 임박 구간을 담으므로 임계가 정해져도 REQ-TAX-04가 요구하는 둘째 축이 새로 생기지 않는다. **같은 행을 네 자리가 함께 읽는다** — 이 목록 · 캘린더([10_tax.md](./10_tax.md) #10) · 감지 배치([10_tax.md](./10_tax.md) #12) · 보존 도래(#7)이며, 읽는 자리가 갈리면 한 화면의 두 목록이 서로 다른 기준으로 경보한다.
- **checklist의 원소는 { item, done }이다.** 항목 값 3종(WAGE · SEVERANCE · UNUSED_LEAVE_ALLOWANCE)의 정본은 [../05_database/12_compliance.md](../05_database/12_compliance.md)이고 **키 이름의 정본은 이 예시**다 — 데이터베이스 축은 jsonb라 열 정의가 키를 강제하지 못하므로, **키를 정하는 자리가 여기 하나뿐이라는 사실을 적어 둔다.** 다른 키(예: settled)로 읽는 구현은 이 계약과 어긋난 것이다.
- **checklist를 갖는 것은 금품청산(WAGE_SETTLEMENT) 과제다.** 나머지 유형은 빈 배열이며, 위 예시가 그 유형인 이유다.
- **employeeName은 인사 원장의 현재 값이 아니라 detail 스냅샷의 값이다.** 신고자료는 외부에 나간 문서라 원천을 나중에 고쳐도 소급 변형되면 안 되고, 같은 이유로 **정렬도 같은 값을 본다** — 표시와 정렬이 다른 원천을 보면 정렬된 목록이 정렬되지 않은 것처럼 보인다(개명한 대상자가 있으면 즉시 드러난다). **사업장 단위 과제(원천징수이행상황신고)는 널**이며 employeeId도 함께 널이다 — 그 널이 "대상자가 없는 기한"이라는 서버의 표현이고, 빈 문자열로 채우면 대상자가 있는 것으로 보인다.
- **허용 정렬 축은 목록 열과 같다**(ADM-DEADLINE-CALENDAR의 유형 · 대상 · 기산일 · 기한 · 잔여일 · 상태). 기본 정렬이 기한 오름차순 → 유형 오름차순이라 **taskType이 축인 표면은 이곳뿐**이다 — 신고자료·이직확인서 목록은 유형이 하나로 고정돼 정렬할 것이 없다. **taskType · status는 명명 enum이라 알파벳이 아니라 선언 순서로 비교된다.**
- **이 원장을 쓰는 표면이 셋이고 허용 정렬도 셋이다**(#8 · [10_tax.md](./10_tax.md) #2 · #6). 하나로 합치면 **어느 표면에도 없는 열의 정렬이 열리고** 그 축이 무엇을 뜻하는지 답할 자리가 사라진다 — 접수일(requestedAt)은 이직확인서 전용 열이라 #8과 #2에서는 전건 널이다.
- 과제 **생성 표면은 이 문서에 없다.** **입사 확정**([05_hr.md](./05_hr.md) #11 — 4대보험 취득) · 퇴사 연동 트리거([05_hr.md](./05_hr.md) #35 — 상실 · 금품청산 · 퇴직급여) · 신고자료 생성([10_tax.md](./10_tax.md) #1 · #5) · 감지 배치([10_tax.md](./10_tax.md) #12) · **급여 확정 부수효과**([08_payroll.md](./08_payroll.md) #17 — 원천징수이행상황신고)가 만든다. **6종 전부 생성 지점을 갖는다**(2026-09-10 — INSURANCE_ACQUISITION 미결 해소).
- 캘린더 관점의 조회는 [10_tax.md](./10_tax.md) #10이 같은 원장을 기한 축으로 다시 보여 준다 — 그쪽은 범위 조회이고 이쪽은 과제 목록이라 쪽 나눔 방식이 다르다.

### 10·11. 사업 단위 판정 조회·선언 (CMP-08)

```json
{
  "groupBusinessNo": "1234567890",
  "groupSiteCount": 3,
  "workplaces": [ { "workplaceId": "…", "siteLabel": "본점" }, { "workplaceId": "…", "siteLabel": "2호점" } ],
  "independence": {
    "hrManagementSeparate": false,
    "budgetAccountingSeparate": false,
    "siteManagerExists": false,
    "workingConditionAuthority": false
  },
  "declaredUnit": "COMBINED",
  "declaredBy": "…",
  "declaredAt": "2026-08-03T01:20:00Z",
  "warning": null
}
```

| 항목 | 10. 조회 | 11. 선언 |
|------|--------|--------|
| 권한 | MANAGER | **OWNER 전용** |
| 입력 | — | independence 4항목 · declaredUnit(SEPARATE · COMBINED) · reason |
| 처리 | 같은 사업자번호 그룹과 현재 선언 상태를 반환한다. 미판정이면 **warning에 위험 경고**를 담는다 | 선언을 저장하고 근거를 감사 보존한다. COMBINED이면 산정 범위를 합산한다 |
| 그룹 축 | **groupSiteCount는 전부의 수, workplaces는 볼 수 있는 것의 상세**다. 둘이 갈릴 수 있다 | 조회와 같다 |
| 합산 효과 | — | #3의 산정 대상 범위가 그룹 전체로 넓어진다. **확정된 과거 스냅샷은 소급하지 않는다** |
| 실패 | common.not_found/404(그룹 없음) | auth.workplace_forbidden/403(OWNER 아님) · common.validation_failed/400 |

독립성 체크리스트 4항목은 ① 인사·노무관리 독립 ② 예산·회계 독립 ③ 사업장별 경영담당자 존재 ④ 근로조건 결정권 전속이다.

- **사업자등록번호가 별개인지는 판단 기준이 아니다**(REQ-CMP-08). 근로기준법 적용 단위는 "사업 또는 사업장"이며 장소가 분리돼도 독립성이 없으면 합산한다.
- **자동 합산은 법적 판단이라 불가능하다.** 그래서 선언 + 경고 방식이며 미판정 상태에서는 #10이 위험 경고를 노출한다 — 3인 매장 2개를 사업주가 직접 관리하면 실질 6인이라 5인 이상 규정이 적용되는데, 사업장별로만 산정하면 사용자를 법 위반에 노출시킨다.
- **그룹의 수와 그룹의 상세는 다른 축이다**(2026-09-12 등재). `groupSiteCount`는 **같은 사업자등록번호로 등록된 사업장 전부의 수**(요청 사업장 자신을 포함)이고 `workplaces`는 **요청자가 볼 수 있는** 사업장의 상세다. 사업장 조회는 멤버십 축이라, 그룹의 다른 사업장에 멤버십이 없는 MANAGER 에게는 **목록이 자기 자신 하나뿐**이 된다 — 그 길이로 그룹 유무를 판정하면 **"없다"와 "못 본다"가 같은 결론**이 되고, 화면이 "동일 대표자 소유의 다른 사업장이 없습니다"라고 사실과 다르게 단정한다. 실제로 그랬다(250인 사업장을 매니저 여럿이 나눠 쓰는 형태에서 재현된다).
- **위험 경고(warning)는 `groupSiteCount`로 판정한다.** 위험은 요청자가 보든 못 보든 존재하므로, 보이지 않는다는 이유로 경고를 접으면 **CMP-08 의 존재 이유(법 위반 노출 방지)가 조회 권한 경계에서 조용히 무효화된다.**
- **상세는 넓히지 않는다.** 멤버십 없는 사업장의 상호·인원·식별자는 테넌트 경계를 넘으므로 나가지 않고, 판정에 필요한 **수**까지만 낸다. 화면은 "그중 N곳은 멤버십이 없어 상세를 표시하지 않습니다"로 그 사실을 밝힌다.
- 복수 사업장 등록 시 이 판정을 요구하는 안내는 사업장 등록 응답([04_workplace.md](./04_workplace.md) #1)에 담긴다.

### 12·13. 서버 내부 종점 2종 (CMP-01 · CMP-07)

| 항목 | 12. recomputeEmployeeCountSnapshot (배치) | 13. 본인 소유권 인가 술어 (서버) |
|------|-------------------------------------------|--------------------------------|
| 실행 | 매일 02:20 KST · 분산락 · 멱등 · 기준일 파라미터 | 명세서·급여이력·근로계약 표면의 인가 판정 단계 |
| 동작 | 스냅샷을 산정하고 **5인·10인 경계 변동을 감지·알린다**. source=AUTO로 UPSERT한다 | 인가 조건을 **employees.user_id = 요청자**로 판정하고 workplace_members의 존재·상태를 요구하지 않는다 |
| 시각 근거 | **전일 근태 롤업(00:20) 이후여야** 그날의 근로자 수 시계열이 완성된다 | — |
| 없으면 | **근태 마감·급여 확정·연차 발생이 모두 차단 상태로 멈춘다** — 스냅샷 부재가 세 도메인의 공통 차단 사유다 | 퇴사 순간 본인 명세서 접근이 끊기는데, 명세서는 지급일 + 3년 보존·교부 대상이라 그 자체가 위반 소지다 |
| 보호 | **확정된 과거 스냅샷을 자동으로 덮어쓰지 않는다.** 정정은 관리자 재계산 경로로만 반영된다 | 읽기 전용이다. 쓰기·재발행 경로를 열지 않는다 |
| 집행 표면 | — | [09_payslip.md](./09_payslip.md) #13~#16 · [05_hr.md](./05_hr.md) #24~#26 · **#36** · [08_payroll.md](./08_payroll.md) #24 |
| 표면 없음 근거 | 사용자 요청과 무관하게 매일 성립해야 한다. 수동 산정은 #3이 받는다 | **인가 술어이지 자원이 아니다.** REQ를 새로 채번하지 않는 것과 같은 이유로 표면도 만들지 않는다 |

- #13이 성립하는 3구간은 **① 퇴사(LEFT·REMOVED) 후 ② 사업장 폐쇄(CLOSED) 후 ③ 계정 탈퇴 전 보존기간 내**다.
- 멤버십으로만 정책을 쓰면 그 세 순간에 본인 법정문서가 잠긴다. 그래서 명세서·급여이력·근로계약에는 **소유권 술어를 멤버십 술어와 함께** 둔다([../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)).

### 14·15. 기한 과제 완료·면제 (CMP-04 · TAX-11)

```json
{ "checklist": [ { "item": "WAGE", "done": true }, { "item": "SEVERANCE", "done": true }, { "item": "UNUSED_LEAVE_ALLOWANCE", "done": true } ] }
{ "reason": "대상자가 4대보험 적용 제외라 신고 의무가 없습니다" }
```

| 항목 | 14. 완료 | 15. 면제 |
|------|---------|---------|
| 경로 | POST …/compliance-tasks/{taskId}/complete | POST …/compliance-tasks/{taskId}/waive |
| 권한 | MANAGER | MANAGER |
| 입력 | checklist(선택) | **reason(필수)** |
| 허용 전이 | **OPEN → COMPLETED 하나뿐**이다. 그 밖은 common.conflict/409 | **OPEN → WAIVED 하나뿐**이다. 그 밖은 common.conflict/409 |
| 불변 필드 | taskType · triggerDate · dueDate는 **바꿀 수 없다**. 값이 바뀌면 법정 기한 자체가 흔들린다 | 상동 |
| 부수효과 | completed_at · completed_by를 서버가 채운다 | waived_reason을 저장하고 **compliance_task.waive**를 감사에 남긴다 |
| 응답 | 갱신된 자원 | 갱신된 자원 |

**둘로 가른 근거는 요구 입력이 다르다는 것이다.** 하나의 PATCH { status }로 두면 **사유 필수 여부가 본문 값에 따라 갈리는 조건부 검증**이 되고, 그것이 [01_conventions.md](./01_conventions.md)가 "허용 전이 판정이 요청 본문 검증으로 밀려난다"고 금지한 형태다. 전이마다 요구 입력이 다르면 **전이마다 동사를 둔다.**

- **전이 표면을 이 문서 하나로 모은 근거**는 원장 공유다. compliance_tasks는 4대보험 신고([10_tax.md](./10_tax.md)) · 이직확인서 · 금품청산과 퇴직급여([08_payroll.md](./08_payroll.md) #28) · 원천징수이행상황신고([08_payroll.md](./08_payroll.md) #17 생성)가 함께 쓰는 저장소라, 생성은 각 도메인이 하되 조회·전이가 여러 곳에 있으면 상태 가드가 갈린다. **표면이 둘로 늘어도 소유 문서는 하나**이며 그것이 이 규약의 축이다. 전이 가드의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다.
- **체크리스트는 #14의 본문으로만 갱신된다.** 완료는 그 근거를 함께 확정하는 것이고 **면제는 그 근거 없이 닫는 것**이라 #15에는 체크리스트 자리가 없다. **부분 진행만 저장하는 표면을 따로 두지 않는다** — 전이 없는 체크 상태는 판정에 쓰이지 않아 표면이 원장을 늘릴 뿐이다.
- **#15의 사유를 감사 배열에서 다시 강제하지 않는다.** compliance_tasks.waived_reason이 표면 계약으로 이미 필수이므로, 감사에서 또 요구하면 **정본이 둘이 된다**(정본 [../05_database/15_system.md](../05_database/15_system.md)).
- **INSURANCE_ACQUISITION 과제의 생성 지점이 어느 표면에도 없었다 — 2026-09-10 닫혔다.** 2026-09-09에는 [../05_database/12_compliance.md](../05_database/12_compliance.md)의 파생 표가 "입사 확정(HIRE)이 만든다"고 단정하고 trigger_event CHECK도 HIRE를 받아들이는데 **그 행을 INSERT하는 표면이 없었다** — [05_hr.md](./05_hr.md) #11이 compliance_tasks를 만들지 않았고 #35는 퇴사 전용 3건이었으며 [10_tax.md](./10_tax.md)의 연동 표와 캘린더 최소 항목은 **6종 중 5종만 셌다.** **닫는 데 필요했던 둘이 함께 채워졌다** — #11이 그 과제를 여는 부수효과를 갖고(기산·멱등키 축 = 입사일) 기한 기준값이 **보험별 키 8종**으로 등재됐다([../05_database/15_system.md](../05_database/15_system.md)). **표면을 새로 채번하지 않았으므로 이 문서의 표면 수도 API 표면 수도 움직이지 않는다.**
- **취득·상실 과제의 기한은 적용 보험 중 가장 이른 값이다.** 건강보험이 적용되면 그 날부터 14일이고 그 밖은 다음 달 15일이라 **같은 기산일의 두 직원이 다른 마감을 가질 수 있다** — 그래서 응답의 dueDate 하나만으로는 근거가 서지 않고 **행의 detail이 보험별 기한을 함께 든다**(정본 [../05_database/12_compliance.md](../05_database/12_compliance.md)).

## 에러 코드

**CMP 도메인은 전용 에러 코드를 두지 않는다.** 스냅샷 부재는 차단이 일어나는 도메인의 코드로 표현되며 이것이 REQ-CMP-06이 의도한 설계다. 정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| payroll.employee_count_snapshot_required | 422 | 기준일 스냅샷 부재로 급여 계산·확정 차단 | (발생은 [08_payroll.md](./08_payroll.md)) |
| leave.employee_count_snapshot_required | 422 | 기준일 스냅샷 부재로 연차 발생·조회 차단 | (발생은 [07_leave.md](./07_leave.md)) |
| attendance.closing_blocked | 409 | 스냅샷 부재가 마감 차단 사유 배열에 포함 | (발생은 [06_attendance.md](./06_attendance.md)) |
| leave.not_applicable | 403 | 5인 미만 기간의 법정 연차 미적용 — 정상 상태 | (발생은 [07_leave.md](./07_leave.md)) |
| system.statutory_rate_overlap | 409 | SIZE_POLICY 기준값의 유효기간 겹침 | (발생은 [14_system.md](./14_system.md)) |
| payslip.download_token_expired | 410 | 보존 문서 다운로드 토큰 만료 — 발급·스트리밍은 [05_hr.md](./05_hr.md) 소유 | (참조) |
| common.not_found | 404 | 스냅샷 · 기한 과제 · 사업 단위 그룹 · 보존 문서 부재 | #2 · #4 · #10 · #14 · #15 |
| common.conflict | 409 | 확정된 스냅샷 덮어쓰기 시도 · 중복 확정 · **허용되지 않는 기한 과제 전이**(COMPLETED·WAIVED에서의 재전이) | #3 · #4 · #14 · #15 |
| common.validation_failed | 400 | 기준일 형식 오류 · 가동일수 0 · **#15의 reason 누락** · 불변 필드 변경 시도 · 요청 본문 검증 실패 | #3 · #11 · #15 · 전 REST 표면 |
| auth.workplace_forbidden | 403 | 요청 workplaceId와 멤버십·역할 불일치 — OWNER 전용 선언 포함 | 전 사업장 스코프 표면 · #11 |

- **이 문서에서 코드를 신설하지 않는다.** 정의처는 각 도메인 파일이며 여기서는 발생 맥락만 적는다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| workplace_employee_count_snapshots | #1 · #2 SELECT · #3 UPSERT · #4 · #12 UPDATE | 상시근로자 스냅샷 — base_date · **scope** · 연인원 · 가동일수 · 평균값 · source · confirmed_by. **(workplace_id, base_date, scope) 유일** |
| employee_count_snapshot_days | #2 SELECT · #3 · #12 INSERT | 일자별 근로자 수 시계열 — **제2항 보정의 필수 입력** |
| employees | #3 · #6 · #7 · #8 · #12 SELECT | 근로자성 구분(worker_type)과 재직 이력 — 산정 대상 범위 판정. **#6 · #7에서는 근로자명부의 보존 원장**(퇴직일 + 3년)이며 대상자 이름의 출처이기도 하다 |
| statutory_rates | #5 SELECT | SIZE_POLICY 조문 단위 정책값과 effective date |
| contracts · payroll_runs · employees · payslips | #6 · #7 SELECT | **보존 관리(CMP-04)의 원장 4곳**이다 — 근로계약서 · 임금대장 · 근로자명부 · 임금명세서가 각자 retention_until · retention_basis 를 든다. **어느 하나가 유일한 원장이 아니다**(REQ-CMP-10) |
| documents | #6 · #7 SELECT | **파일 실체만** 붙이는 바깥 조인이다 — 계약·명세서가 document_id 로 참조한 행이며, 임금대장·근로자명부는 문서 행 자체가 없을 수 있다. 원장이 아니다 |
| compliance_tasks | #8 SELECT · #14 · #15 UPDATE | 기한 과제 원장 — task_type · trigger_date · due_date · status(OPEN · COMPLETED · WAIVED) · checklist · waived_reason. **생성은 타 도메인이, 조회·전이는 이 문서가 소유**한다. **보존 유형을 두지 않으므로 #6 · #7은 이 원장을 읽지 않는다** |
| severance_assessments | 참조 없음 | 퇴직금 판정·산출은 [08_payroll.md](./08_payroll.md) #25·#26 소관이며 본 문서 표면은 이 테이블을 읽지 않는다 |
| workplaces · business_units | #10 SELECT · #11 UPDATE | 사업 단위 판정의 대상 집합 — 동일 사업주의 복수 사업장 그룹. **#10의 그룹 수(groupSiteCount)는 멤버십 범위 밖까지 세고 상세는 범위 안까지다** |
| payslips · contracts · payroll_employee_results | #13 SELECT | 본인 소유권 인가 술어의 판정 대상. 쓰기 계약의 정본은 각 도메인 문서다 |
| audit_logs | #3 · #4 · #11 · #15 INSERT | 산정 정정 **employee_count_snapshot.correct**(#3) · 확정 **employee_count_snapshot.confirm**(#4) · 독립성 선언 **business_unit.declare**(#11) · **기한 과제 면제 compliance_task.waive**(#15). **완료(#14)에는 감사 코드를 두지 않는다** — 정상 업무의 이행이라 남길 판단이 없다. **사유 필수는 #3 · #4 둘뿐이다** — #15의 면제 사유는 compliance_tasks.waived_reason이 표면 계약으로 필수라 감사 배열에서 다시 강제하지 않고, #11도 사유 필수가 아니다. 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)이며 **여기서 신설하지 않는다**(표기 규약 [01_conventions.md](./01_conventions.md) 연동 테이블의 코드 표기) |
| notifications | #12 INSERT | 경계 변동 감지 알림 |

## 추적성

기능명·우선순위의 정본은 [../02_features/09_compliance.md](../02_features/09_compliance.md)다.

| 기능ID | 표면 |
|--------|------|
| CMP-01 상시근로자 수 산정 | #1 · #2 · #3 · #4 · #12(배치) |
| CMP-02 규모별 적용 정책 버전 관리 | #5(사업장 소비 조회) · 변경 축은 [14_system.md](./14_system.md) #27 · #28 · #29 |
| CMP-04 법정 서류 보존 관리 | #6 · #7 · #8 · #14 · #15 |
| CMP-07 퇴사자 본인 법정문서 열람 | #13(서버) · 집행 표면은 [09_payslip.md](./09_payslip.md) #13~#16 · [05_hr.md](./05_hr.md) #24~#26 · **#36** · [08_payroll.md](./08_payroll.md) #24 |
| CMP-08 사업 단위 판정(합산 범위) | #10 · #11 |

**CMP 5기능 전수를 담았다**(위 표 5행). CMP-07은 자체 표면 없이 서버 내부 인가 술어와 세 도메인의 집행 표면으로 성립하고, CMP-02는 이 문서가 조회만 소유하며 변경 표면은 플랫폼 운영 문서가 갖는다. **기한 과제 표면 3종(#8 · #14 · #15)은 CMP-04와 [10_tax.md](./10_tax.md)의 TAX-11이 공유**하므로 그쪽 추적성 표에도 참조로 등재된다 — 표면 실체는 이 문서가 소유한다.

## 관련 문서

- 전역 규약·멱등·오프셋 페이지네이션 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/09_compliance.md](../02_features/09_compliance.md) · 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md) · 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 요구사항 정본 → [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md) · 규모 분기 단일 기준·화이트리스트·보존 기산일 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 5인 분기 집계와 마감 차단 → [06_attendance.md](./06_attendance.md) · 연차 미적용과 판정 불가 → [07_leave.md](./07_leave.md) · 실근로분 지급과 정책 버전 동결 → [08_payroll.md](./08_payroll.md) · 본인 소유권 인가 → [09_payslip.md](./09_payslip.md) · 기준값 변경 권한 → [14_system.md](./14_system.md)
- 테이블 명세 → [../05_database/12_compliance.md](../05_database/12_compliance.md) · [../05_database/02_workplace.md](../05_database/02_workplace.md)
- 확정 의사결정(D-14 · D-15 · D-18) → [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)
- 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
