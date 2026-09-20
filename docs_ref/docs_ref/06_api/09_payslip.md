# 06_api / 09 명세서 (SLP)

> **대상**: SLP 도메인 REST 표면 — 명세서 자동 생성과 재생성 · 법정 필수항목 검증 · 전자교부와 열람 통제 · 본인 소유권 인가 · 1회용 다운로드 토큰 · 보관과 보존 · 일괄 발행과 재시도 · 발행 알림 · 재발급과 정정본
> **작성일**: 2026-08-03
> **개정일**: 2026-09-17 — **관리자 목록 · 상세(#2 · #3)에 최초 열람 시각(viewedAt)과 교부 채널(deliveryChannels)을 더한다** — 사업주가 직원이 명세서를 열었는지, 어느 채널로 교부가 성립했는지를 목록에서 보고 대체 교부 · 안내를 고른다. 값은 교부 원장(payslip_deliveries)의 VIEWED 최초 행 · ISSUED 채널이며 읽기만 한다. 본인 상세(#14)의 viewedAt과 같은 뜻이다. 표면 수 · 권한 불변
> **개정일**: 2026-09-16 — **#2 명세서 목록 검색(q)의 ILIKE 이스케이프 결함을 고친다** — 매퍼가 검색어를 이스케이프 없이 `'%' || q || '%'`로 감싸 `%`·`_`가 들어간 검색어에서 의도와 다른 행이 잡혔다. 대상 필드(직원 이름·사번)와 계약은 그대로이며 q 길이 상한 50 · ESCAPE 규약은 [01_conventions.md](./01_conventions.md) 정본을 따른다. **표면 수 19 · 번호 · payslip 코드 10종은 전건 불변**
> **개정일**: 2026-09-12 — **#18의 대상 정의에 PENDING을 등재한다** — #1이 「행을 PENDING으로 만들고 렌더 작업을 큐에 넣으며 렌더는 요청 응답 경로가 아니라 일괄 실행 경로에서 수행한다」고 규정하는데 **그 일괄 실행 경로인 #18의 대상이 FAILED뿐이라 큐에 소비자가 없었다.** 결과로 확정한 명세서가 PENDING에서 멈췄다(2026-09-11 실측 — PENDING 259건 · 최고 12시간 정체 · scheduled_job_runs의 retryPayslipAndPush가 전건 target 0). **자동 파이프라인의 종점을 GENERATED로 둔 #1 종점 행이 그 상태에서 거짓이었고**, 15분 주기의 근거(교부 지연이 곧 법정 의무 미이행 시간)도 함께 무의미했다. **문서가 아니라 구현을 고친다** — 렌더를 확정 트랜잭션에 넣으면 브라우저 풀을 기다리는 동안 급여월 잠금을 쥐고 렌더 실패가 확정을 되돌리므로(REQ-SLP-03이 금지) 확정은 큐에 올리고 소비는 배치가 한다는 분리가 옳고, 빠진 것은 소비자였다. **#18은 GENERATED까지만 올린다** — DELIVERED 전이의 주체는 #6 하나뿐이라는 계약은 불변이다. **표면 수 19 · 번호 · payslip 코드 10종은 전건 불변**
> **개정일**: 2026-09-10 — **#2 명세서 목록에 검색 축 q를 등재하고 허용 정렬을 둘 → 넷으로 넓힌다**(payDay · issuedAt에 **employeeName · status**). q는 **직원 이름·사번 부분 일치**이며 직원 목록([05_hr.md](./05_hr.md) #1)과 같은 형태다 — 한 급여월의 명세서가 활성 멤버 수만큼 생기는데 **특정 직원의 건을 찾는 동선이 식별자를 미리 아는 경우로만 열려 있었다.** 함께 **정렬·검색의 이름(직원 원장)과 응답의 이름(확정 급여 결과의 동결값)이 갈리는 근거**를 적는다 — 전자는 모집단을 좁히는 축이고 후자는 산출물의 본체다. **표면 수 · 번호 · 권한 · 에러 코드는 전건 불변** — 선택 파라미터 추가는 v1 안의 변경이다
> **개정일**: 2026-09-10 — 구현 실측으로 **교부 성립의 두 자리를 등재**한다. ① **#6의 DELIVERED 전이는 채널 결과의 귀결이다** — 구현이 전이를 채널 결과와 무관하게 먼저 밀어 **EMAIL 단독 발행이 실패해도 status = DELIVERED이고 교부 이력은 0행**이었고 배치도 성공 1/1로 셌다(조용한 성공). 하나라도 성립해야 전이하고 아니면 GENERATED에 남긴다. ② **#17의 수신 주소는 정의자 헬퍼로만 닿는다** — profiles.recovery_email의 SELECT 축이 본인과 플랫폼뿐이라 **발행 경로의 조회가 언제나 0행**이었고 대체 교부가 한 번도 성립하지 않았다(헬퍼 #45 · V0735). **표면 수 19 · 번호 · payslip 코드 10종은 전건 불변**
> **개정일**: 2026-09-09 — 앞선 회차의 **집행 층 서술을 실측으로 정정**하고 차단 범위를 좁힌다. ① "읽기 전용 가드가 payslips·documents 쓰기를 차단한다"고 적었으나 **그 가드는 두 테이블에 붙어 있지 않다** — 강제 지점은 **서비스 진입 판정 1층**이며 그 사실을 적어 둔다(2층으로 읽히면 REQ-WRK-08이 경고한 형태를 못 알아본다). ② **재생성(#4)을 발행 계열 차단에서 뺀다** — 새 발행이 아니라 **이미 진 교부 의무의 이행**이라 막으면 실패 명세서가 영구 미교부로 고착된다. ③ **데이터베이스 층을 두지 않는 것이 판단임을 등재**한다 — 막을 것과 막으면 안 될 것이 같은 테이블의 같은 명령이라 갈리지 않고 재시도 배치가 통째로 막힌다. **표면 수 19 · 번호 · payslip 코드 10종은 전건 불변**
> **개정일**: 2026-09-09 — 정합 넷. ① **#11의 reason을 선택 → 필수**로 바로잡는다 — 이 문서 안에서 갈려 있었고(입력 행은 선택 · 연동 표는 "#11만 사유 필수 축"), 감사 액션 document.download_sensitive의 사유를 **데이터베이스 가드가 강제**하므로 사유 없이 받으면 표면이 400이 아니라 500을 돌려준다. ② **#11의 선행에 CORRECTED**를 더한다 — 정정본 발행이 원본을 폐기하지 않고 본인 모집단이 DELIVERED · CORRECTED라, 빠뜨리면 **직원은 받는 파일을 관리자가 못 받는다.** ③ **#4에 workplace.verification_pending을 등재하고 workplace.closed 행을 신설**한다 — 재생성도 PDF를 만들어 GENERATED로 올리므로 발행 계열이고, 판정 축은 표면 목록이 아니라 **쓰기 여부**다. ④ **403 둘의 경계를 등재**한다 — 멤버십 부재는 auth.workplace_forbidden · 역할 부족은 payslip.forbidden이며, 이 구분이 없어 **payslip.forbidden의 발생 지점이 0이었다.** **표면 수 19 · 번호 · payslip 코드 10종은 전건 불변**
> **개정일**: 2026-09-08 — 재발급 이력 등재처를 **행위자에 따라 갈라 서술**한다(REQ-SLP-15 개정 · 정본 [../03_requirements/08_payslip.md](../03_requirements/08_payslip.md)) — **본인 다운로드만 payslip_deliveries의 DOWNLOADED**이고 관리자 다운로드는 **audit_logs의 document.download_sensitive**다. payslip_deliveries는 **근로기준법 §48② 교부 이행의 법정 증적**이라 운영 감사 축을 섞지 않는다 — **이력이 사라지는 것이 아니라 옮겨 적히는 것**이다. 채번 없음
> **개정일**: 2026-09-07 — **#11 관리자 다운로드 토큰의 코드 귀속을 확정**한다 — `document.download_sensitive`이며 **새 코드를 만들지 않는다**(05_hr #29가 같은 코드를 쓴다). **귀속은 표면이 아니라 documents.is_sensitive 분류를 따른다** — 사유 요구 여부가 표면 계약이 아니라 문서 분류 문제가 되어, 분류가 바뀌면 표면을 고치지 않고도 따라간다. **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-09-07 — 연동 표 audit_logs 행에 **#6 일괄 발행을 등재**하고 action 코드를 병기한다(누락 보정 — 계약 확장이 아니다). payslip.issue는 **원본 개방 목록부터 있던 코드**이고 #6이 그 유일한 발행 표면인데(#1은 생성 큐 등록 · #4는 재생성 · #17은 알림 발화라 발행이 아니다) 이 표가 적지 않았다. #12는 payslip.correct로 병기했고, **#11 관리자 다운로드 토큰의 코드 귀속은 미확정으로 표시**한다 — 민감 문서 다운로드 축으로 보이나 귀속은 채번 정본이 정한다. **표면 수 · 번호 · 권한 · 에러 규격은 전건 불변**
> **개정일**: 2026-08-20 — 앱 as-built 정합 개정 — 명세서 상세 응답에 **법정 필수 기재 ⑤호 근태 축**(workSummary) 등재(SLP-1) · 본인 상세 응답에 **최초 열람 시각**(viewedAt) 등재(SLP-2) · **본인 미열람 수 표면 #19 신설**(API-1 · 드로어 급여 배지의 데이터원) — 표면 18 → **19**(REST 14 → **15**)
> **개정일**: 2026-08-08 — 교부(DELIVERED) 전이 주체를 관리자 게시 행위(#6)로 단일화하고 자동 파이프라인 범위를 GENERATED까지로 한정 · 자동 생성 트리거 발화 조건을 원본 급여 실행의 확정으로 명시 · 발행 알림 발화 시점을 교부 성립 시점으로 정정
> **원천**: [../03_requirements/08_payslip.md](../03_requirements/08_payslip.md)(REQ-SLP-01~16) · [../02_features/07_payslip.md](../02_features/07_payslip.md)(SLP 7기능) · [../03_requirements/10_compliance.md](../03_requirements/10_compliance.md)(CMP-07 퇴사자 본인 열람) · [../03_requirements/11_notification.md](../03_requirements/11_notification.md)(REQ-NTF-01 알림 본문 제약)

명세서 교부는 **근로기준법 §48② 법정 의무**이며 미교부는 최대 500만원 과태료 대상이다. 그래서 이 도메인의 표면은 교부를 막는 어떤 조건도 임의로 만들지 않는다 — 알림 수신 거부로도, 구독 만료로도, 퇴사로도 교부와 열람이 끊기지 않는다.

**인가의 축이 다른 도메인과 다르다.** 명세서·급여이력·근로계약은 사업장 멤버십이 아니라 **본인 소유권**(employees.user_id = 요청자)으로 인가한다. 그래서 본인 표면(#13~#16 · #19)은 사업장 스코프 경로에 두지 않는다 — 사업장 경로에 두면 가드가 멤버십을 먼저 보고 퇴사 순간 본인 명세서 접근이 끊기는데, 명세서는 지급일 + 3년 보존·교부 대상이라 그 자체가 위반 소지다(REQ-SLP-09).

**교부와 열람은 별개 이벤트다.** 전자 게시 완료 시점이 교부(ISSUED)이고 직원의 실제 열람(VIEWED)과 다운로드(DOWNLOADED)는 각각 별도 행으로 기록한다. **정정은 재발급이 아니다** — 재발급은 동일 원본의 재교부라 행을 만들지 않고, 정정은 원본을 보존한 채 supersedes_id로 연결된 정정본을 새로 발행한다.

**자동 파이프라인은 생성(GENERATED)까지이고 교부(DELIVERED)는 관리자의 게시 행위다.** 확정 트리거(#1)는 payslips 행을 만들고 PDF를 렌더하는 데서 끝나며, DELIVERED 전이와 payslip_deliveries의 ISSUED 기록을 만드는 표면은 **일괄 발행(#6) 하나뿐**이다 — 대상은 확정 급여월의 전 직원이거나 employeeIds로 지정한 일부이므로 단건 교부도 같은 표면이 처리한다. 사람이 게시 시점을 정하는 이유는 필수 기재사항 보완(#5)과 금액 검토가 끝나기 전에 법정 교부가 성립해 버리는 것을 막기 위해서다.

## 공통 규약

| 항목 | 규칙 |
|------|------|
| 스코프 | 관리 표면은 /v1/workplaces/{workplaceId}/…, **본인 표면은 /v1/me/payslips**다. 스트리밍 종점은 /v1/payslips/download/{token}이다 |
| 권한 축 | 본인(**소유권 인가** — 목록 · 열람 · 다운로드 · 미열람 수) · MANAGER(발행 · 재생성 · 일괄 · 교부 이력) · **OWNER 전용 1갈래**(정정본 발행) |
| 소유권 인가 | payslips.employee_id를 통해 얻은 employees.user_id가 요청자와 같은지로 판정한다. **workplace_members의 존재·상태를 요구하지 않는다** — 퇴사 · 사업장 폐쇄 · 탈퇴 전 보존기간 내 모두 열람 가능하다 |
| 존재 은닉 | 미존재와 타인 명세서를 **payslip.not_found/404**로 통일한다. 403을 쓰면 그 명세서가 존재한다는 사실이 샌다 |
| 멱등 | 일괄 발행(#6)과 정정본 발행(#12) **2표면**이 Idempotency-Key 필수다. 원본 중복은 **(payroll_run_id, employee_id) 부분 유니크**(supersedes_id가 비어 있는 행 대상)가 막는다 |
| 다운로드 | 토큰 발급(#11 · #15) → 스트리밍(#16) 2단이다. 토큰은 단기 만료 · 1회 소비 · 세션·IP·user agent 보조 바인딩이며 만료·재사용은 **payslip.download_token_expired/410**이다 |
| 페이지네이션 | 오프셋 2표면(#2 · #13) · 커서 1표면(#9). 교부 이력은 시간 역순 무한 증가라 커서다 |
| PDF 실체 | **documents가 일원 보유**한다(저장 경로 · 파일 해시 · 보존기한). payslips는 document_id 외래키로 참조하고 **별도 경로 컬럼을 두지 않는다** |
| 교부 축 | **DELIVERED 전이와 ISSUED 기록의 유일한 주체는 #6**이다. 자동 생성(#1)·재생성(#4)·정정본 발행(#12)은 교부를 성립시키지 않는다 |
| 법정 우선 | **법정 교부 인앱 알림과 명세서 목록 생성은 생략하지 않는다.** 구독 만료도 조회·교부를 막지 않는다([13_subscription.md](./13_subscription.md)) |
| 상태 전이 | PENDING · GENERATED · DELIVERED · FAILED · CORRECTED의 정본은 [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)다 |
| 법정 기재 축 | 근로기준법 시행령 §27의2 **⑤호(출근일수 · 총 근로시간 · 연장/야간/휴일 근로시간)**는 검증(#5)만이 아니라 **응답 필드 workSummary로 실린다**(#2 · #3 · #13 · #14). 값의 원천은 마감 근태이며 급여 확정 시점에 동결된 사본이다 |
| 열람 시각 | 본인 상세(#14) 응답의 viewedAt은 **최초 열람 시각**이다. 조회할 때마다 갱신되지 않으며 교부 시각(issuedAt)과 다른 축이다 |

## 표면 요약

| # | 계층 | 메서드·경로 | 권한 | 페이지네이션 | 기능ID |
|:-:|------|------------|------|-------------|--------|
| 1 | 서버 내부 | 급여 확정 트리거 — 직원별 명세서 생성 큐 등록 | 시스템 | — | SLP-01 |
| 2 | REST | GET /v1/workplaces/{workplaceId}/payslips | MANAGER | 오프셋 | SLP-01 · SLP-05 |
| 3 | REST | GET /v1/workplaces/{workplaceId}/payslips/{payslipId} | MANAGER | — | SLP-03 |
| 4 | REST | POST /v1/workplaces/{workplaceId}/payslips/{payslipId}/regenerate | MANAGER | — | SLP-01 |
| 5 | REST | GET /v1/workplaces/{workplaceId}/payslips/{payslipId}/required-fields | MANAGER | — | SLP-02 |
| 6 | REST | POST /v1/workplaces/{workplaceId}/payroll-runs/{payrollRunId}/payslips/bulk-issue | MANAGER · 멱등 | — | SLP-05 |
| 7 | REST | GET /v1/workplaces/{workplaceId}/payslip-batches/{batchJobId} | MANAGER | — | SLP-05 |
| 8 | REST | POST /v1/workplaces/{workplaceId}/payslip-batches/{batchJobId}/retry | MANAGER | — | SLP-05 |
| 9 | REST | GET /v1/workplaces/{workplaceId}/payslips/{payslipId}/deliveries | MANAGER | 커서 | SLP-03 |
| 10 | REST | GET /v1/workplaces/{workplaceId}/payslips/{payslipId}/retention | MANAGER | — | SLP-04 |
| 11 | REST | POST /v1/workplaces/{workplaceId}/payslips/{payslipId}/download-token | MANAGER | — | SLP-07 |
| 12 | REST | POST /v1/workplaces/{workplaceId}/payslips/{payslipId}/corrections | OWNER · 멱등 | — | SLP-07 |
| 13 | REST | GET /v1/me/payslips | 본인(소유권) | 오프셋 | SLP-03 |
| 14 | REST | GET /v1/me/payslips/{payslipId} | 본인(소유권) | — | SLP-03 |
| 15 | REST | POST /v1/me/payslips/{payslipId}/download-token | 본인(소유권) | — | SLP-03 · SLP-07 |
| 16 | 다운로드 | GET /v1/payslips/download/{token} | 토큰 소유자 | — | SLP-03 |
| 17 | 서버 내부 | 발행 알림 발화 — payslip_issued + 대체 교부 경로 | 시스템 | — | SLP-06 |
| 18 | 서버 내부 | 정기작업 retryPayslipAndPush(15분 주기) | 시스템 | — | SLP-01 · SLP-05 |
| 19 | REST | GET /v1/me/payslips/unread-count | 본인(소유권) | — | SLP-03 |

- 19행 = REST **15** · 다운로드 **1** · 서버 내부 **3**이다.
- **#19는 말미 채번이다.** 표면 번호는 문서 지역 번호이고 기존 번호를 재배치하면 타 문서의 상호참조(#13~#16 · #17 · #18)가 한꺼번에 어긋나므로, 신설 표면은 흐름상 위치와 무관하게 말미에 채번하고 **상세 절도 번호 오름차순 자리에 둔다**([README.md](./README.md)). 업무 흐름상 자리는 본인 목록(#13) 옆이다.
- **본인 표면 5종(#13~#16 · #19)만 사업장 스코프 경로 밖**이다. 인가 축이 멤버십이 아니라 소유권이기 때문이며, 이 배치가 CMP-07의 집행 지점이다. **CMP-07 집행 표면의 정본 열거는 #13~#16 4종**이며(열람·교부 축) #19는 배지 카운트라 그 열거에 넣지 않는다.

## 상세

### 1. 급여 확정 트리거 — 명세서 생성 큐 등록 (서버 · SLP-01)

| 항목 | 내용 |
|------|------|
| 발화 | 급여 확정([08_payroll.md](./08_payroll.md))이 CONFIRMED로 전이한 트랜잭션의 부수효과. **발화 조건은 supersedes_id가 비어 있는 원본 급여 실행의 확정에 한정**하며, 정정 실행의 확정은 명세서를 자동 생성하지 않는다(REQ-SLP-01) |
| 범위 | **원본(supersedes_id가 비어 있는 건)의 최초 생성만** 담당한다. 정정본은 #12 단일 경로로만 발행한다 |
| 종점 | **GENERATED까지다.** 교부(DELIVERED) 전이와 ISSUED 기록은 관리자 게시 행위(#6)가 수행한다. **종점에 닿는 것은 #18이고** 이 트리거 자체는 PENDING까지다 — 두 자리를 한 사건으로 읽으면 큐에 소비자가 없어도 「종점이 GENERATED」가 맞는 문장처럼 보인다 |
| 중복 차단 | **(payroll_run_id, employee_id) 부분 유니크 + 멱등키**로 이중 방어한다 |
| 선행 차단 | 대상 급여 실행이 CONFIRMED가 아니면 **payslip.run_not_confirmed/409** · 사업장이 검증 대기면 **workplace.verification_pending/409** |
| 처리 | payslips 행을 PENDING으로 만들고 PDF 렌더 작업을 큐에 넣는다. 렌더는 요청 응답 경로가 아니라 일괄 실행 경로에서 수행한다 — **그 경로는 #18이며 그것이 이 큐의 유일한 소비자다.** 렌더를 확정 트랜잭션에 넣지 않는 이유는 브라우저 풀 대기 중에 급여월 잠금을 쥐고 렌더 실패가 확정을 되돌리기 때문이다(REQ-SLP-03) |
| 표면 없음 근거 | 사용자가 요청하는 일이 아니다. 확정 한 번이 전 직원 명세서를 만들어야 하는데 이를 표면으로 두면 확정과 생성 사이에 사람이 끼어 미교부 구간이 생긴다 |
| 실패 격리 | **PDF 생성 실패가 급여 확정을 롤백하지 않는다.** payslips.status = FAILED로 저장하고 실패 사유를 기록하며 #18이 재큐잉한다 — 렌더가 배치에 있으므로 확정 트랜잭션은 그 실패를 볼 일조차 없다 |

### 2·3·4. 명세서 목록·상세·재생성 (SLP-01 · SLP-03)

```json
{
  "payslipId": "…",
  "payrollRunId": "…",
  "employeeId": "…",
  "payPeriod": "2026-07",
  "payDay": "2026-08-10",
  "status": "DELIVERED",
  "documentId": "…",
  "issuedAt": "2026-08-10T00:12:00Z",
  "supersedesId": null,
  "correctionReason": null,
  "totals": { "earnings": "2493375", "deductions": "319955", "netPay": "2173420" },
  "workSummary": {
    "workDays": 22,
    "totalWorkMinutes": 10560,
    "overtimeMinutes": 720,
    "nightMinutes": 240,
    "holidayMinutes": 480
  }
}
```

**workSummary는 법정 필수 기재 ⑤호(출근일수 · 총 근로시간 · 연장/야간/휴일 근로시간)의 응답 축**이며 #3 · #14 상세와 #2 · #13 목록 요약이 같은 이름으로 담는다. #5가 검증만 하던 항목을 응답이 실제로 싣는 자리다.

| 항목 | 2. 목록 | 3. 상세 | 4. 재생성 |
|------|--------|--------|----------|
| 입력 | payrollRunId · payPeriod · status · employeeId · **q(직원 이름·사번 부분 일치)** · 오프셋 | — | reason(선택) |
| 허용 정렬 | payDay(기본 · desc) · issuedAt · **employeeName** · **status** | — | — |
| 대상 상태 | — | — | **FAILED 또는 PENDING만.** GENERATED·DELIVERED는 거부한다 |
| 응답 | 위 예시의 요약 배열 + **viewedAt(최초 열람 · 없으면 비움) · deliveryChannels(ISSUED 채널 IN_APP · EMAIL · WEB)** | 위 예시 + 항목 라인 요약 + 교부 이력 최근 건 + viewedAt · deliveryChannels | 재큐잉 결과 |
| 근태 축 | workSummary 포함 | workSummary 포함 | — |
| 실패 | — | payslip.not_found/404 | **payslip.generation_failed/422**(재생성도 실패) · payslip.already_issued/409(이미 발행된 건) |

- **#2의 q는 직원 목록([05_hr.md](./05_hr.md) #1)과 같은 축**이며 대상 필드를 서버가 정한다 — 이름과 사번의 부분 일치다. **연락처를 대상에 두지 않는 것**은 이 목록의 행이 사람이 아니라 명세서라 전화번호로 찾을 동선이 없기 때문이다. employeeId 필터는 식별자를 이미 아는 호출용이고 q는 화면이 이름으로 찾는 축이라 **둘 다 남는다.**
- **#2의 허용 정렬 축은 목록 열과 같다.** 열이 화면에 있는데 정렬 축이 없으면 그 열의 머리를 누른 요청이 common.validation_failed/400으로 돌아온다. status 정렬은 알파벳이 아니라 **발행 진행 순서**(PENDING → GENERATED → FAILED → DELIVERED → CORRECTED)이며 열이 명명 enum이라 선언 순서로 비교된다. **값이 없는 행은 어느 방향이든 아래다**(NULLS LAST).
- **정렬·검색의 이름은 직원 원장에서 읽고 응답의 이름은 확정 급여 결과의 동결값이다.** 두 자리가 갈리는 것이 의도다 — 검색·정렬은 모집단을 좁히는 축이라 질의가 볼 수 있어야 하고, 응답에 싣는 이름은 **명세서 산출물의 본체**라 소유 도메인이 동결한 값이어야 한다(확정 뒤 개명이 교부된 명세서의 기재를 바꾸지 않는다).
- **#2 · #3의 viewedAt은 #14와 같은 최초 열람 시각이고 deliveryChannels는 교부(ISSUED) 행의 채널 집합이다.** 교부 성립과 열람은 다른 사건이라 교부가 성립한 명세서도 viewedAt이 비어 있을 수 있다 — 화면은 이 둘을 한 칸으로 합치지 않는다(REQ-SLP-07).
- **재생성은 새 명세서를 만들지 않는다.** 같은 payslips 행의 PDF만 다시 렌더하며, 발행된 명세서의 내용을 바꾸려면 정정본 경로(#12)를 써야 한다.
- 상세 응답은 급여 결과의 **스냅샷**이다. 확정 시점 데이터와 적용 기준값 버전이 보관돼 있어 이후 기준값이 바뀌어도 명세서는 불변이다(REQ-SLP-02).
- **workSummary의 산출 원천은 마감된 근태 일 집계**다([06_attendance.md](./06_attendance.md) #9 · #10의 8버킷과 판정 상태). 값은 급여 확정 시점에 payroll_employee_results로 **동결**된 사본이며 **명세서 표면이 근태 테이블을 직접 읽지 않는다** — 확정 뒤 근태가 재집계돼도 교부된 명세서의 기재는 바뀌지 않아야 한다(REQ-SLP-02 · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) 확정 불변).
- **8버킷과 법정 3축의 대응은 다음과 같다**([06_attendance.md](./06_attendance.md) 8버킷이 정본). 법정 표기 축은 **서로 겹칠 수 있으므로 세 값의 합이 totalWorkMinutes와 같지 않은 것이 정상**이다 — 휴일 야간 연장 1시간은 세 축 모두에 계상된다.

```plain
totalWorkMinutes = 8버킷 전량 합            (상호배타 · 중복 없음)
overtimeMinutes  = overtime + overtimeNight + holidayOvertime + holidayOvertimeNight
nightMinutes     = night + overtimeNight + holidayNight + holidayOvertimeNight
holidayMinutes   = holiday + holidayNight + holidayOvertime + holidayOvertimeNight
```

- **workDays는 정수 일(JSON number)**이고 근로시간 4축은 **정수 분(JSON number)**이다([01_conventions.md](./01_conventions.md)). 문자열 일수 규약은 0.1일 단위로 올림하는 연차 일수 전용이라 출근일수에는 적용하지 않는다.
- **5인 미만 사업장도 workSummary를 그대로 채운다.** 가산 미적용은 금액 축의 사실이지 근로시간 미기록이 아니며, 미적용 사실과 근거는 계산방법 표기가 담는다(#5).

### 5. GET /v1/workplaces/{workplaceId}/payslips/{payslipId}/required-fields — 법정 필수항목 검증 (SLP-02)

```json
{
  "complete": false,
  "missing": [
    { "clause": 1, "field": "employeeIdentifier", "message": "성명 또는 생년월일·사번이 없다" },
    { "clause": 5, "field": "overtimeMinutes", "message": "연장 근로시간수가 없다" }
  ]
}
```

근로기준법 시행령 §27의2 **6개 호**를 검증한다.

```plain
① 근로자 특정정보(성명 · 생년월일 또는 사번)
② 임금 지급일
③ 임금 총액
④ 기본급·수당 등 임금 구성항목별 금액
⑤ 출근일수 · 총 근로시간 · 연장/야간/휴일 근로시간 등 계산에 필요한 사항
⑥ 공제 항목별 금액과 공제 총액
```

- **⑤호는 검증에서 그치지 않는다.** 같은 값이 응답 필드 workSummary로 실려야 화면·PDF가 동일한 수치를 그린다(#2·#3·#13·#14). 검증만 하고 응답에 싣지 않으면 명세서 화면이 근태 축을 추정하게 된다.
- **사업자등록번호와 상호는 법정 기재사항이 아니다.** 포함해도 무방하나 필수 검증 대상이 아니며 missing에 넣지 않는다(REQ-SLP-04).
- 누락이 있으면 명세서를 FAILED로 두고 **payslip.missing_required_field/422**로 **보완해야 할 항목 목록**을 급여 담당자에게 안내한다. **누락 상태로는 교부하지 않는다**(REQ-SLP-06).
- 계산방법 표기는 연장·야간·휴일수당과 주휴수당에 **시간 · 단가 · 가산율을 포함한 계산식**을 담는다(급여 확정 시 동결된 값을 쓴다). **5인 미만 사업장은 가산 미적용 사실과 근거를 계산방법에 정확히 반영**하되 **실제 근로시간 기록은 내부 급여 결과에 보존**한다 — 가산 미적용이지 근로시간 미기록이 아니다.

### 6·7·8. 일괄 발행·진행 조회·재시도 (SLP-05)

```json
{
  "policy": "GENERATE_MISSING",
  "employeeIds": null,
  "deliveryChannels": ["IN_APP", "EMAIL"]
}
```

| 항목 | 6. 일괄 발행 | 7. 진행 조회 | 8. 재시도 |
|------|-------------|-------------|----------|
| 권한 | MANAGER · **멱등키 필수** | MANAGER | MANAGER |
| policy | **SKIP_ISSUED**(이미 발행된 직원 건너뜀) · **GENERATE_MISSING**(원본 누락분만 생성) | — | — |
| 응답 | 202 + batchJobId | 전체·성공·실패 건수 · 실패 사유 · 진행률 | 202 |
| 대상 | 확정 급여월의 전 직원 또는 employeeIds로 지정한 일부 — **단건 교부도 이 표면**이다 | — | **실패 건만** |
| 교부 전이 | 대상 명세서를 **GENERATED → DELIVERED로 전이**시키고 payslip_deliveries에 **ISSUED 행을 기록**한다. 이 전이가 근로기준법 §48② 교부의 성립 시점이다 | — | 실패 건에 한해 동일 전이를 다시 시도한다 |
| 실패 | **payslip.bulk_in_progress/409**(동일 급여 실행의 일괄 작업 진행 중) · **payslip.bulk_conflict/409**(멱등키 충돌) · **payslip.already_issued/409**(GENERATE_MISSING 대상이 이미 발행됨) | common.not_found/404 | payslip.bulk_in_progress/409 |

- **채널이 하나도 성립하지 않으면 전이하지 않는다.** 교부는 채널마다 따로 성립하므로(#9 · #10 — 앱 게시는 열람할 수 있는 상태로 입력된 때 · 이메일은 발송된 때) **DELIVERED 전이는 채널 결과의 귀결이지 선행이 아니다.** 앞세우면 payslip_deliveries가 0행인데 status = DELIVERED · issued_at · delivered_at이 채워진 명세서가 남고 **배치 결과도 성공으로 세어져 아무도 다시 시도하지 않는다** — 법정 교부의 증적이 없는데 이행된 것으로 보이는 형태다. 성립하지 않은 건은 **GENERATED에 남기고 실패로 센다** — 미교부 상태라야 #8 · #18의 재시도 대상이 된다. **새 실패 코드를 두지 않는다**(payslip 10종 불변) — 배치 결과의 실패 사유가 그 자리를 갖는다.
- **기존 발행분의 재발행은 정정본 경로(#12)로만 가능하다**(REQ-SLP-11). 일괄 발행이 발행분을 덮어쓰는 정책을 두지 않는다 — 덮어쓰면 원본이 사라져 정정 이력이 끊긴다.
- **재시도는 실패 건만 대상으로 하고 이미 교부된 명세서의 교부 이력을 중복 생성하지 않는다**(REQ-SLP-12). 멱등키가 그 계약을 보호한다.
- batch_jobs가 전체·성공·실패 건수와 실패 사유를 보유하며 화면이 진행률과 재시도를 표시한다.

### 9·10. 교부 이력·보관 정보 (SLP-03 · SLP-04)

| 항목 | 9. 교부 이력 | 10. 보관·보존 |
|------|-------------|--------------|
| 권한 | MANAGER | MANAGER |
| 입력 | deliveryType 필터 · 커서 | — |
| 응답 | deliveryType ∈ **ISSUED · VIEWED · DOWNLOADED** · deliveredAt · channel · ip · userAgent | documentId · fileHash · retentionUntil · **지급일 + 3년** 산정 근거 · 저장 경로 노출 없음 |
| 페이지네이션 | 커서 — 시간 역순 무한 증가 목록이라 오프셋은 행을 흘린다 | — |

- **교부 시점 판정이 이 도메인의 핵심 계약**이다(REQ-SLP-07). 사내 전산망·앱 게시는 **근로자가 열람할 수 있는 상태로 입력된 때**, 이메일·메신저는 **발송된 때**가 교부다. 그래서 ISSUED가 곧 교부이고 VIEWED는 별개 사실이다.
- **최소 3년(지급일 + 3년) 보존**하며 **퇴사·탈퇴·사업장 폐쇄 후에도 보존기간 내 열람 권한 정책을 유지**한다.
- 플랫폼 관리자는 고객지원 목적의 **메타 조회만** 기본 허용하고 PDF 원문 접근은 별도 권한·사유·감사를 요구한다([14_system.md](./14_system.md)).
- **응답에 오브젝트 스토리지 경로·서명 URL을 담지 않는다.** 다운로드는 #15 · #16 경로뿐이다.

### 11·12. 관리자 다운로드 토큰·정정본 발행 (SLP-07)

| 항목 | 11. 관리자 다운로드 토큰 | 12. 정정본 발행 |
|------|------------------------|----------------|
| 권한 | MANAGER | **OWNER · 멱등키 필수** |
| 입력 | **reason(필수)** | correctionReason(필수) · newPayrollRunId |
| 선행 | 명세서가 GENERATED · DELIVERED · **CORRECTED** | 원본 급여 실행이 VOIDED이고 새 실행이 CONFIRMED일 것 |
| 처리 | 1회용 토큰 발급 + audit_logs 기록 | supersedes_id로 연결된 명세서 정정본 생성 · 원본은 CORRECTED로 표시하되 **폐기하지 않는다** |
| 응답 | token · expiresAt | 생성된 정정본 자원 |
| 실패 | payslip.not_found/404 · **common.validation_failed/400**(reason 누락) | **payslip.correct_forbidden/403**(MANAGER 시도) · payslip.run_not_confirmed/409 · payslip.bulk_conflict/409(멱등키 충돌) |

- **#11의 reason은 필수다.** 이 표면이 남기는 감사 액션 document.download_sensitive가 **사유 필수 항목의 ⑭**이고(정본 [../05_database/15_system.md](../05_database/15_system.md)) 그 사유를 **데이터베이스 가드가 NOT NULL·공백 불가로 강제**하므로([../10_security/04_pii_protection.md](../10_security/04_pii_protection.md)), 사유 없이 받으면 **감사 기록에서 트랜잭션이 끊긴다.** REQ-HRM-24의 4요건(재인증 · 사유 · 감사 · 서버 1회성 응답)도 같은 요구다. **입력 검증에서 거르는 것이 옳다** — DB가 막을 것을 표면이 받아 두면 사용자에게 돌아가는 것은 400이 아니라 500이다.
- **#11의 선행에 CORRECTED가 든다.** 정정본을 발행해도 **원본을 폐기하지 않으므로**(#12) CORRECTED는 실체가 남아 있는 상태이고, 본인 표면의 모집단이 **DELIVERED · CORRECTED**(#13 · #14)라 빠뜨리면 **직원은 받을 수 있는 파일을 관리자가 못 받는다.** 관리자 축은 여기에 미교부분(GENERATED)까지 더한 것이라 **본인 축을 포함한다** — 두 축이 어긋나면 정정 이력을 확인하러 온 관리자가 원본에 닿지 못한다.
- **재발급과 정정은 다른 축이다**(REQ-SLP-15). 재발급은 동일 원본의 재교부이므로 payslips 행을 새로 만들지 않고 **본인 다운로드(#15 · #16)는 payslip_deliveries의 DOWNLOADED 행**으로 이력을 남긴다. **관리자 다운로드(#11)는 그 원장이 아니라 audit_logs의 document.download_sensitive**가 담는다 — 가드가 payslip_deliveries.user_id를 명세서 소유자로 강제하므로 관리자 행을 넣으면 **행위자가 뒤바뀐다.** 버전 개념은 재발급이 아니라 정정본 체인(supersedes_id)이 담당한다.
- **원본 급여 실행 VOID 시점에 PENDING·FAILED 상태인 명세서는 생성을 중단하고 FAILED(사유 = 원본 VOID)로 고정**한다. CORRECTED 체인은 GENERATED·DELIVERED 명세서에 한한다(REQ-SLP-16).
- 직원 화면에는 **최신본과 원본 이력을 함께 표시**하고 정정 사유·새 명세서 링크를 알리며 교부 이력을 별도 기록한다.

### 13·14·15·16. 본인 목록·상세·다운로드 토큰·스트리밍 (SLP-03 · SLP-07)

| 항목 | 13. 본인 목록 | 14. 본인 상세 | 15. 본인 다운로드 토큰 | 16. 스트리밍 다운로드 |
|------|--------------|--------------|----------------------|---------------------|
| 인가 | **본인 소유권** — employees.user_id = 요청자 | 위와 동일 | 위와 동일 | 토큰 소유자 |
| 입력 | payPeriod 범위 · workplaceId(선택 필터) · 오프셋 | — | — | — |
| 응답 | 사업장명 · 급여월 · 지급일 · 상태 · 정정 여부 · **workSummary** | 항목 라인 요약 · 계산방법 표기 · 정정 체인 · **workSummary** · **viewedAt** | token · expiresAt | attachment 스트리밍 |
| 부수효과 | — | **payslip_deliveries에 VIEWED 기록** | — | **DOWNLOADED 기록 후 스트리밍** |
| 실패 | — | payslip.not_found/404 | payslip.not_found/404 | **payslip.download_token_expired/410** |

- **#13에 workplaceId는 필터일 뿐 스코프가 아니다.** 여러 사업장을 거친 직원은 한 목록에서 전 이력을 본다 — 이것이 계정 단위 자원의 예외이며 담는 것은 본인 명세서로 한정된다([01_conventions.md](./01_conventions.md)).
- **읽기 전용이다.** 본인이 쓰기·재발행하는 경로는 없다.
- 토큰은 세션·IP·user agent 보조 바인딩으로 복사 재사용을 차단한다. **발급된 서명 URL을 직접 주지 않는 이유는 철회 불가능성**이다 — 대상이 임금 정보를 담은 법정 문서다.
- **기록 실패 시 파일을 내보내지 않는다.** 열람 이력이 남지 않는 다운로드를 허용하지 않는다.
- **viewedAt은 최초 열람 시각이다** — payslip_deliveries의 VIEWED 행 중 **가장 이른 행의 발생 시각**이며 이번 요청이 최초 열람이면 이번 요청이 남긴 시각이다. #14는 응답 전에 VIEWED를 기록하므로 **null이 되지 않는다**. 조회할 때마다 갱신되는 값이 아니라는 점이 계약의 요체다 — 화면이 "이번 조회 시각"을 대신 그리면 교부 증적과 다른 시각이 사용자에게 보인다.
- **viewedAt은 교부 시점이 아니다.** 교부(ISSUED)와 열람(VIEWED)은 별개 이벤트이며 교부 시각은 issuedAt이 담는다. 두 값을 한 필드로 합치지 않는다(REQ-SLP-07).
- **#13 · #14가 담는 모집단은 교부 성립분(DELIVERED · CORRECTED)**이다. 직원이 열람할 수 있는 상태로 입력된 때가 곧 교부이므로(#9·#10), 미교부(PENDING · GENERATED · FAILED) 명세서를 본인 표면이 보이면 게시 전에 법정 교부가 성립해 버린다.

### 17·18. 서버 내부 종점 2종 (SLP-06 · SLP-01 · SLP-05)

| 항목 | 17. 발행 알림 발화 (서버) | 18. retryPayslipAndPush (배치) |
|------|--------------------------|-------------------------------|
| 실행 | 명세서가 **DELIVERED로 전이한**(교부 성립) 트랜잭션의 부수효과 — 게시 행위(#6)가 그 트랜잭션을 연다 | 정기작업 · 15분 주기 · 분산락 · 멱등 |
| 동작 | 직원에게 payslip_issued 인앱 알림을 만들고 앱 미설치·미로그인 직원에게는 **이메일 등 대체 교부 경로**로 발송한다 | **대상이 셋이다** — ① **PENDING 명세서를 렌더해 GENERATED로 올린다**(#1이 만든 큐의 소비) ② FAILED 상태 명세서를 PENDING으로 재큐잉해 다시 렌더한다 ③ 실패가 남은 일괄 발행을 재시도한다. **①을 두지 않으면 #1의 큐에 소비자가 없다** |
| 본문 제약 | **알림 본문에 금액 상세를 포함하지 않고 명세서 화면 링크만 포함**한다(REQ-NTF-01) | — |
| 필수 알림 | **직원이 알림 수신을 거부해도 법정 교부 인앱 알림과 명세서 목록 생성을 생략하지 않는다.** 거부 시도는 notification.mandatory_pref/409다 | — |
| 교부 이력 | 대체 채널 발송 사실도 **교부 이력으로 기록**한다 | **이 작업은 교부를 성립시키지 않는다** — GENERATED까지만 올리고 DELIVERED 전이와 ISSUED 기록의 주체는 #6 하나뿐이다(사람이 게시 시점을 정하는 이유가 필수 기재사항 보완 전에 법정 교부가 성립해 버리는 것을 막기 위해서다). 이미 렌더·교부된 건은 대상에서 빠지고 이력을 중복 생성하지 않는다 |
| 표면 없음 근거 | 알림 발화는 발행의 부수효과이지 사용자 행위가 아니다 | 15분 주기인 것은 **교부 지연이 곧 법정 의무 미이행 시간**이기 때문이다. 이 작업이 없으면 실패분이 영구히 미교부 상태가 된다 |
| v1 경계 | **v1은 알림 설정 기능 자체를 두지 않으므로** notification.mandatory_pref의 실제 발생 지점이 없다 | **v1은 인앱 알림 단일 채널**이라 재전송 대상도 인앱 알림이며 푸시는 포함하지 않는다 |

- **대체 교부 경로의 수신 주소는 profiles.recovery_email이고 서버 함수로만 닿는다.** 그 표의 SELECT 정책은 본인 축과 플랫폼 축(user:view) 둘뿐이라 발행(#6)도 정기작업(#18)도 걸리지 않고 **조회가 0행이 되어 EMAIL 채널의 교부가 성립하지 않는다.** 정책에 서버 축을 결합하지 않고 주소 한 값만 내는 정의자 헬퍼를 둔다 — 정본은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #45다. **계정 미연계 직원에게는 닿지 않는다** — 그 수신 주소를 담는 열이 v1 스키마에 없어 REQ-SLP-13이 이름한 대상(앱 미설치·미로그인)과 정확히 겹치지 않는 자리다.

### 19. GET /v1/me/payslips/unread-count — 본인 미열람 명세서 수 (SLP-03)

```json
{ "count": 3 }
```

| 항목 | 내용 |
|------|------|
| 인가 | **본인 소유권** — employees.user_id = 요청자. #13~#16과 같은 축이며 멤버십을 요구하지 않는다 |
| 입력 | **없다.** 사업장 필터를 두지 않는다 |
| 미열람 정의 | 모집단(#13과 동일 — 교부 성립분) 중 **payslip_deliveries에 VIEWED 행이 없는 건**의 수다. **다운로드(DOWNLOADED)는 열람이 아니다** — 열람 사실은 VIEWED 행만 세운다 |
| 응답 | count(0 이상 정수). 목록·항목을 담지 않는다 |
| 실패 | 인증 실패 외에 없다. 대상 자원을 지목하지 않으므로 payslip.not_found/404가 발생하지 않는다 |

- **표면을 따로 두는 근거는 열람 사실의 소재**다. 열람은 payslips 행의 열이 아니라 **payslip_deliveries 원장의 사실**이라 목록(#13) 응답만으로는 미열람 수를 셀 수 없다. 배지와 법정 교부 증적이 같은 원장을 본다는 점이 이 배치의 이득이다.
- **사업장 필터를 두지 않는 근거는 소비처**다. 이 값을 쓰는 곳은 계정 단위의 앱 드로어 급여 배지이며(화면 정본 [../07_screen/05_app_employee.md](../07_screen/05_app_employee.md) §4-2), 여러 사업장을 거친 직원도 배지 하나만 본다. 사업장별 분해가 필요해지면 #13의 필터로 목록을 다시 부른다.
- **카운트 전용 표면이므로 목록 우회(size=1 + totalCount)를 쓰지 않는다.** 우회는 오프셋 봉투의 총 건수를 배지로 전용하는 것이라 "미열람"이 아니라 "전체"를 세게 된다.
- **경로 충돌 주의**: unread-count는 #14의 {payslipId} 자리와 같은 깊이라 라우팅에서 **고정 세그먼트를 식별자 패턴보다 먼저** 매칭해야 한다.

## 에러 코드

정본은 [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)이고 본 폴더의 미러는 [02_errors.md](./02_errors.md)다.

| 코드 | HTTP | 발생 조건 | 표면 |
|------|:----:|----------|------|
| payslip.not_found | 404 | 명세서 없음 또는 접근 불가. **행 존재 자체를 숨긴다 — 403이 아니다** | #3 · #11 · #12 · #14 · #15 |
| payslip.run_not_confirmed | 409 | 대상 급여 실행 미확정 | #1 · #6 · #12 |
| payslip.missing_required_field | 422 | 법정 필수 기재사항 데이터 누락. **보완 항목 목록을 반환하고 교부하지 않는다** | #5 · #1 |
| payslip.generation_failed | 422 | PDF 생성 실패 — status = FAILED. **급여 확정을 롤백하지 않는다** | #4 · #6 · #1 |
| payslip.already_issued | 409 | GENERATE_MISSING 대상이 이미 발행됨 — 재발행은 정정본 경로만 | #4 · #6 |
| payslip.bulk_in_progress | 409 | 동일 급여 실행의 일괄 작업 진행 중 | #6 · #8 |
| payslip.bulk_conflict | 409 | 일괄 발행·**정정본 발행** 멱등키 충돌 | #6 · #12 |
| payslip.download_token_expired | 410 | 1회용 다운로드 토큰 만료·사용 후 재사용 | #16 |
| payslip.forbidden | 403 | 본인도 사업장 관리자도 아닌 **관리 액션** 시도. 열람 대상 자원의 비소유 접근은 이 코드가 아니라 payslip.not_found/404다 | #4 · #6 · #8 · #9 · #10 · #11 |
| payslip.correct_forbidden | 403 | 정정본 발행 권한 없음 — MANAGER 시도이며 OWNER 전용이다 | #12 |
| workplace.verification_pending | 409 | 검증 대기 사업장의 명세서 **발행** 시도 | #1 · #6 |
| workplace.closed | 409 | **정지·폐쇄 사업장의 명세서 발행 시도** — 강제 지점은 **서비스 진입 판정**이다(아래) | #6 · #12 |
| notification.mandatory_pref | 409 | 필수 알림 수신 거부 시도 — **v1 발생 지점 없음**(알림 설정 미채택) | #17 |
| common.not_found | 404 | 일괄 작업·급여 실행 부재 | #7 · #8 |
| common.validation_failed | 400 | 요청 본문·쿼리 검증 실패 | 전 REST 표면(**#19는 입력이 없어 발생 지점이 없다**) |
| auth.workplace_forbidden | 403 | 요청자가 **그 사업장의 ACTIVE 멤버가 아니다**(비멤버 · 없는 사업장). **역할 부족은 이 코드가 아니라 payslip.forbidden/403이다** | 관리 표면 전량 |

- **payslip 10종 전량이 이 표에 있다.**
- **payslip.not_found와 payslip.forbidden의 경계가 이 도메인의 규약**이다 — 열람 대상 자원에는 404(존재 은닉)를, 관리 액션 권한 부족에는 403을 쓴다. 관리 액션은 이미 그 명세서의 존재를 아는 관리자가 부르는 표면이라 은닉의 의미가 없다.
- **막는 것은 새 업무를 시작하는 표면이지 명세서 쓰기 전부가 아니다.** 정지·폐쇄가 차단하는 것은 **일괄 발행(#6)과 정정본 발행(#12)**이며, **재생성(#4)과 정기작업 재시도(#18)는 막지 않는다** — 그 둘은 새 발행이 아니라 **이미 진 교부 의무의 이행**이고, 막으면 실패한 명세서가 **영구 미교부로 고착**된다. 근로기준법 §48② 교부 의무는 사업장이 멈춰도 사라지지 않는다. **#1은 급여 확정 자체가 막히므로 도달하지 않는다**([08_payroll.md](./08_payroll.md) workplace.closed).
- **이 축에 데이터베이스 층을 두지 않는다 — 판단이고 결손이 아니다**(2026-09-09). 읽기 전용 가드를 payslips·documents에 부착하면 **막아야 할 것과 막으면 안 되는 것이 같은 테이블의 같은 명령**(payslips UPDATE)이라 갈리지 않고, **가드에 서버 컨텍스트 예외가 없어 재시도 정기작업이 통째로 막힌다.** payslip_deliveries가 그 가드를 갖는 것과 대비되는데 **그쪽은 예외를 행 값(VIEWED · DOWNLOADED)으로 표현할 수 있어 부착이 성립**한 것이다 — 비대칭이 아니라 **표현 가능성의 차이**다.
- **그래서 이 축은 서비스 1층이며 그 사실을 적어 둔다.** REQ-WRK-08이 "서비스 레이어에만 두면 미검증 사업자 명의로 확정 임금대장이 생성될 수 있다"고 경고한 형태와 같은 자리이므로, **2층인 것처럼 서술하지 않는 것이 이 등재의 요점**이다 — 앞선 회차가 "읽기 전용 가드가 차단한다"고 적었으나 **그 가드는 두 테이블에 붙어 있지 않다**(2026-09-09 카탈로그 실측).
- **403 둘의 경계도 함께 정한다 — 축은 멤버십이냐 역할이냐다.** 요청자가 **그 사업장의 ACTIVE 멤버가 아니면** auth.workplace_forbidden이고(사업장의 존재까지 숨기는 축이라 없는 사업장도 여기다), **멤버인데 역할이 모자라면** payslip.forbidden이다. **두 사유가 실제로 다르므로 같은 사유에 두 코드를 두는 것이 아니다** — 앞은 "당신은 이 사업장 사람이 아니다"이고 뒤는 "당신은 이 사업장 사람이지만 이 액션의 역할이 아니다"이며, **조치가 다르다**(초대를 받아야 하는 것과 역할을 올려 받아야 하는 것).
- **도메인 전용 코드가 있으면 그 축을 계정 계열로 폴백하지 않는다.** 이 구분이 없으면 역할 부족이 전부 auth.workplace_forbidden으로 수렴해 **payslip.forbidden의 발생 지점이 0이 되고**, 표에 등재된 코드가 실제로는 아무 데서도 나지 않는 상태가 남는다(2026-09-09 구현 실측이 그 상태였다).
- 정의처가 다른 코드는 발생만 한다 — workplace 코드는 [04_workplace.md](./04_workplace.md), notification 코드는 [12_notification.md](./12_notification.md)가 정의한다.

## 연동 테이블

| 테이블 | 접근 | 역할 |
|--------|------|------|
| payslips | #1 · #12 INSERT · #2 · #3 · #13 · #14 · #19 SELECT · #4 · #6 · #18 UPDATE | 명세서 — payroll_run_id · employee_id · document_id · status · issued_at · supersedes_id · correction_reason. **원본 1건 부분 유니크** |
| payslip_deliveries | #6 · #14 · #16 · #17 INSERT · #9 · #14 · #19 SELECT | 교부·열람·다운로드 이력 — ISSUED · VIEWED · DOWNLOADED · channel · ip · user_agent. **ISSUED를 만드는 표면은 #6뿐**이며 #17은 대체 채널 발송 사실만 덧붙인다 |
| batch_jobs | #6 INSERT · #7 SELECT · #8 · #18 UPDATE | 일괄 발행 작업 — 전체·성공·실패 건수와 실패 사유 |
| documents | #1 · #12 INSERT · #10 · #16 SELECT | PDF 실체·파일 해시·보존기한의 **단일 보유처**. 계약서·문서함과 같은 테이블을 공유한다 |
| payroll_runs · payroll_employee_results · payroll_employee_result_items | #1 · #2 · #3 · #5 · #12 · #13 · #14 SELECT | 스냅샷 원천 — 확정 결과와 동결된 계산방법. **workSummary(법정 ⑤호 근태 축)도 여기서 동결된 사본을 읽는다** — 근태 테이블을 직접 읽지 않는다 |
| employees | #13 · #14 · #15 · #19 SELECT | **본인 소유권 인가의 판정 대상** — employees.user_id |
| workplaces | #1 · #6 SELECT | 검증 대기 상태 판정 |
| notifications | #17 INSERT | payslip_issued — **필수 알림이라 수신 거부로 생략되지 않는다** |
| audit_logs | **#6** · #11 · #12 INSERT | 일괄 발행 **payslip.issue**(#6) · 정정본 발행 **payslip.correct**(#12) · 관리자 다운로드 **document.download_sensitive**(#11). **#11만 사유 필수 축**이고 #6 · #12는 사유 필수가 아니다. **#11의 귀속은 표면이 아니라 documents.is_sensitive 분류를 따른다** — 05_hr #29와 같은 형태이며, 그렇게 두면 "명세서 다운로드마다 사유를 요구하는가"가 표면 계약이 아니라 **문서 분류 문제**가 된다. action 코드의 채번 정본은 [../05_database/15_system.md](../05_database/15_system.md)이며 **여기서 신설하지 않는다**(표기 규약 [01_conventions.md](./01_conventions.md) 연동 테이블의 코드 표기) |

## 추적성

기능명·우선순위의 정본은 [../02_features/07_payslip.md](../02_features/07_payslip.md)다.

| 기능ID | 표면 |
|--------|------|
| SLP-01 명세서 자동 생성 | #1(서버) · #2 · #4 · #18(배치) |
| SLP-02 법정 필수항목 | #5 |
| SLP-03 명세서 교부/열람 | #3 · #9 · #13 · #14 · #15 · #16 · #19 |
| SLP-04 명세서 보관 | #10 |
| SLP-05 일괄 발행 | #2 · #6 · #7 · #8 · #18(배치) |
| SLP-06 발행 알림 | #17(서버) |
| SLP-07 명세서 재발급/정정 | #11 · #12 · #15 |

**SLP 7기능 전수를 담았다**(위 표 7행). SLP-06은 서버 내부 종점만 갖는다 — 알림 발화는 발행의 부수효과이며 사용자가 요청하는 행위가 아니다. 알림 조회·읽음 표면은 [12_notification.md](./12_notification.md) 소유다.

## 관련 문서

- 전역 규약·다운로드 토큰·존재 은닉·멱등 → [01_conventions.md](./01_conventions.md) · 에러 미러 → [02_errors.md](./02_errors.md)
- 기능 명세 정본 → [../02_features/07_payslip.md](../02_features/07_payslip.md) · 정기작업 정본 → [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md)
- 요구사항 정본 → [../03_requirements/08_payslip.md](../03_requirements/08_payslip.md) · 확정 불변·정정 체인 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 확정·VOID·정정본의 급여 측 계약 → [08_payroll.md](./08_payroll.md) · 문서 메타와 토큰 규약 공유 → [05_hr.md](./05_hr.md) · 퇴사자 본인 열람 → [11_compliance.md](./11_compliance.md) · 알림 타입 → [12_notification.md](./12_notification.md)
- PDF 파이프라인·스트리밍 → [../04_architecture/10_realtime_files.md](../04_architecture/10_realtime_files.md)
- 테이블 명세 → [../05_database/11_payslip.md](../05_database/11_payslip.md)
- 상태 머신 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md) · 에러 코드 정본 → [../09_glossary/02_error_codes.md](../09_glossary/02_error_codes.md)
