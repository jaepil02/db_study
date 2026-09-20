# 02 RLS 격리 (RLS Isolation)

> **대상**: insadesk — 사업장 테넌트 격리 모델 요약 · 2단 방어에서 RLS의 위치 · 본인 소유권 인가 · 봉인 지점 · 교차 사업장 차단 검증 절차 · 잔여 위험
> **작성일**: 2026-08-03
> **개정일**: 2026-09-10 — 인용 갱신 — 헬퍼 42 → **43종**(보조 비밀번호 재설정의 서버 함수 신설 — 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 헬퍼 #44). 격리 분류 수치 · 정책 173은 전건 불변
> **개정일**: 2026-09-09 — 인용 갱신 — **V0726**으로 헬퍼 39 → **42종**. 함께 **휘발성 축의 종수 인용을 걷었다** — 이 미러가 값을 다시 세고 있어 V0716 이후 갱신되지 않은 채 남아 있었다(정본을 링크하고 여기서는 판정 기준만 적는다). 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md). **테이블 61 · 정책 173 · GUC 5종 · 위협·통제 항목은 전건 불변**
> **개정일**: 2026-09-08 — 인용 갱신 — **V0720**이 attendance_breaks에 DELETE 정책을 신설해 정책 172 → **173** · DELETE 정책 4 → **5** · 봉인 칸 72 → **71**. 술어가 **is_auto인 행만 · 서버 컨텍스트에서만**이라 직원이 기록한 휴게는 어떤 경로로도 지워지지 않으며, 대상이 **롤업이 계산한 파생 행**이라 기존 넷과 같은 재계산 교체 부류다. 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) #173. **테이블 61 · 헬퍼 39 · GUC 5종 · 통제 항목은 전건 불변**
> **개정일**: 2026-09-07 — 격리 분류 검산이 **정본과 갈라져 있었다**(발견·정정) — workplace_id 보유 44는 맞으나 **60 − 16 = 44 · 16 + 39 + 5 = 60**으로 남아 있었다. **61 − 17 = 44 · 17 + 39 + 5 = 61**로 다시 셌다(scheduled_job_runs·idempotency_records 신설이 이 검산에 내려오지 않은 자리다). 보유 44 · NOT NULL 39 · 선택 5는 값 자체가 불변이며 **전체 합과 미보유만 움직인다.** 집계 정본은 [../05_database/README.md](../05_database/README.md) 접근 모델 절이다
> **개정일**: 2026-09-07 — 인용 갱신 — **V0716**(전자서명 서버 함수)으로 헬퍼 38 → **39종** · DB 함수 99 → **100**. 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) #40. **테이블 61 · 정책 172 · GUC 5종 · 통제 항목은 전건 불변**
> **개정일**: 2026-09-07 — 인용 갱신 — **V0711**(idempotency_records 신설)로 테이블 60 → **61** · 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46**) · 봉인 칸 71 → **72**(늘어난 칸은 신설 테이블의 DELETE 하나다). **DELETE 정책 4 · 헬퍼 38종 · 가드 55 · 권한 키 27종 · 위협·통제 항목은 전건 불변**. 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)
> **개정일**: 2026-09-07 — 인용 갱신 — 헬퍼 37 → **38종**(사업장 폐쇄 서버 함수 신설 — 보정 V0710. 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)) · DB 함수 98 → **99**. 격리 분류 수치 · 정책 169 · 위협·통제 항목은 전건 불변
> **개정일**: 2026-09-07 — 인용 갱신 — 헬퍼 32 → **37종**(인증 쓰기 축 서버 함수 6종 신설 · 1종 폐기 — 보정 V0709. 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)). 휘발성 축 서술 상태를 바꾸는 5종 → **VOLATILE 10종**(상태를 바꾸는 9 + 시각 의존 조회 1 expired_suspension_user_ids). 위협·통제 항목과 격리 분류 수치·정책 169는 전건 불변
> **개정일**: 2026-09-07 — 정책 표현식 실측 정합(pg_policy 카탈로그 대조 · 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 갱신 반영) — 선택 스코프의 audit_logs에 **서버 컨텍스트 축** 명시(보정 V0705) · 계정 단위 자원의 system_admins에 **본인 행 축** 명시(보정 V0703) · 봉인 지점에 **쓰기 반환 축**(RETURNING이 SELECT 가시성을 별도로 요구한다 — #38 · #41 · #146 · #167) 등재. **격리 분류 수치 · 정책 169 · 봉인 71 · 헬퍼 32종 · 검증 20항은 전건 불변**
> **개정일**: 2026-09-06 — 실측 정합 인용 갱신 — 헬퍼 31 → **32종**(보정 V0704·V0706의 append_audit_log 등재 — 정본 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) #32) · 휘발성 단서 상태 전이 2종 → **상태를 바꾸는 5종**(23 · 27 · 30 · 31 · 32 — V0702 반영 때 4종이 된 것을 2로 두고 있었다). **격리 분류 수치 · 주입 컨텍스트 5종 · 검증 20항은 불변**
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — 잔여 위험 2번의 완화 수단을 **데이터소스 프록시 단일 주입 지점 + 아키텍처 테스트**로 치환(ADR-07 → **ADR-28**). **격리 분류 수치 · 헬퍼 31종 · 주입 컨텍스트 5종 · 검증 20항은 불변**
> **개정일**: 2026-08-20 — 헬퍼 27 → **31종**(인증 서버 함수 4종 — 보정 V0702. STABLE 단서를 조회 축 한정으로 정밀화)
> **개정일**: 2026-08-19 — 격리 분류·판정 보조 잔재 정합 — 테넌트 스코프 38 → **39종** · workplace_id 미보유 15 → **16종**(정기작업 실행 이력 scheduled_job_runs) · 보유 43 → **44**(NOT NULL 38 → **39**) · 검산 58 → **60** · 헬퍼 22 → **27종** · 주입 컨텍스트 3 → **5종** · DELETE 정책 1 → **4건**(앱 롤 grant는 교체 3테이블 한정 명시)
> **개정일**: 2026-08-09 — 전역 수치 정합 — 테이블 58 → **60** · 정책 160 → **169**(SELECT 60 · INSERT 60 · UPDATE 45 · DELETE 4) · 매트릭스 232 → **240칸** · 봉인 72 → **71**(DELETE 56 · UPDATE 15)
> **개정일**: 2026-08-08 — 구독 만료의 쓰기 차단 범위를 구독 도메인 정본과 일치시킴(사업장 내 업무 생성은 차단하지 않는다) · 전역 마스터 쓰기 축에서 알림 타입의 시스템 컨텍스트 전용 예외 명시 · 심층방어 도해의 신뢰 계층을 **3계층 + 클라이언트 보조**로 재표기
> **원천**: [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)(정책 표현식·헬퍼·GUC 정본) · [../05_database/09_functions_triggers.md](../05_database/09_functions_triggers.md) · [../05_database/README.md](../05_database/README.md)(접근 모델·테넌트 스코프 집계) · [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)(2단 방어 아키텍처) · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-07·ADR-08 · [../03_requirements/15_nonfunctional.md](../03_requirements/15_nonfunctional.md) REQ-TEC-07·08

격리 단위는 **사업장(workplace)**이다. 전 **61테이블**에 ENABLE + FORCE ROW LEVEL SECURITY가 걸리고 정책은 **173개**이며 **기본 거부**다 — 정책이 없는 명령은 접근할 수 없다.

본 문서는 보안 관점의 요약과 검증 절차다. **정책 표현식·헬퍼 시그니처·봉인 매트릭스의 전수 정본은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)이며 본 문서와 어긋나면 그쪽이 우선한다.** 여기서는 정책을 다시 정의하지 않고 그 배치가 무엇을 불가능하게 만드는지만 서술한다.

애플리케이션이 정책과 맺는 계약(세션 컨텍스트 주입 · 격리 판정 경로 · 사업장 전환)의 정본은 [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)다.

---

## 핵심 원칙

**1. 정책이 없는 것이 통제다.** RLS는 정책 없는 명령을 기본 거부하므로 만들지 않은 정책은 누락이 아니라 방어의 형태다. **61테이블 × 4명령 중 72칸이 봉인**돼 있고 그 대부분은 원장·이벤트·파생 시계열이다 — 이력을 고칠 수 있으면 그것은 이력이 아니다.

**2. 최종 방어는 데이터베이스다.** 서비스 레이어가 통과시킨 요청도 RLS를 통과해야 한다. 새 엔드포인트 하나가 사업장 스코프 검사를 빠뜨렸을 때 남의 사업장 행에 닿지 않게 하는 것이 RLS의 존재 이유이며, 이를 "혹시 모를 보험"으로 두지 않는다(ADR-08).

**3. 우회 경로를 남기지 않는다.** ENABLE만으로는 테이블 소유자로 접속한 세션이 정책을 통째로 건너뛴다. **FORCE와 롤 분리가 함께 있어야** 우회가 사라지며, 앱 롤은 소유자가 아니고 NOSUPERUSER · NOBYPASSRLS다.

**4. 미주입은 통과가 아니라 거부다.** 세션 컨텍스트가 비면 current_user_id()가 NULL이고 헬퍼가 거짓을 반환해 전 행이 비가시가 된다. 주입 누락이 **데이터 유출이 아니라 조회 실패로** 나타나는 것이 이 설계의 안전 실패 방식이다(ADR-07).

**5. 인가 축은 멤버십 하나가 아니다.** 명세서·급여이력·근로계약은 **본인 소유권**으로 인가한다. 멤버십으로만 정책을 짜면 퇴사·폐쇄 순간 본인 법정문서가 잠기고, 명세서는 지급일 + 3년 보존·교부 대상이라 그 잠김 자체가 위반 소지다(CMP-07).

**6. 거부는 부재로 보인다.** 비소유 행은 오류가 아니라 0행으로 반환되므로 존재 자체가 노출되지 않는다. 애플리케이션은 이를 404로 통일해 표면화하되, **변이의 0행은 부재가 아니라 결함 신호**로 다룬다.

---

## 격리 모델 요약

집계의 정본은 [../05_database/README.md](../05_database/README.md) 접근 모델 절이다.

| 부류 | 테이블군 | 규칙 |
|------|---------|------|
| **테넌트 스코프 39종** | 사업장·인사·근태·휴가·급여·명세서·법정 준수·임포트 전 업무 테이블 | workplace_id NOT NULL을 1차 술어로 삼는다. 멤버십 헬퍼 3종(멤버 여부 · 관리자 여부 · 소유자 여부)이 역할을 판정하고 쓰기 가능 헬퍼가 CLOSED·SUSPENDED 사업장의 신규 생성을 막는다. **비멤버에게는 행 존재조차 노출되지 않는다** |
| **선택 스코프 5종** | business_verification_logs · notifications · audit_logs · location_usage_records · export_jobs | workplace_id가 **nullable**인 횡단 원장이다 — 등록 전 검증 · 계정 단위 알림 · 플랫폼 액션 감사 · 처리 맥락 · 플랫폼 전체 내보내기가 NULL 행을 만든다. **NULL 행은 테넌트 술어로 걸러지지 않으므로** 정책이 본인 축(user_id·recipient_user_id·requested_by) 또는 플랫폼 권한 축을 함께 갖는다. **audit_logs는 서버 컨텍스트 축도 함께 갖는다** — 서버가 기록한 행을 돌려받는 경로가 SELECT 가시성을 별도로 요구하기 때문이다(보정 V0705) |
| **본인 소유권 축** | 명세서 · 교부 이력 · 급여 결과·항목 라인 · 근로계약 · 전자서명 · 인사 레코드 · 퇴직급여 판정 · 근태 원본·집계·요청 · 연차 발생·원장·잔액 | 멤버십·사업장 상태·구독 상태를 보지 않는다. 판정 축은 employees.user_id 또는 비정규화 user_id 하나다. **14지점**이며 전수 정본은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md) 본인 소유권 인가 절이다 |
| **전역 마스터 5종** | plans · statutory_rates · notification_types · terms_documents · income_tax_table_entries | workplace_id가 없고 SELECT가 공개(서버 API 경유)다. 요금제·약관은 미인증 공개 페이지에 실리고 기준값은 법령 공개 정보다. **쓰기는 settings:update 플랫폼 권한 전용이며, notification_types만 예외로 시스템 컨텍스트 전용**이다 — 알림 타입 카탈로그는 운영자가 고치는 값이 아니라 서버가 고정하는 상수라 관리자 축을 두지 않는다 |
| **계정 도메인 7종** | users · profiles · terms_documents · user_consents · account_status_events · security_events · password_reset_tokens | 사업장과 무관한 전역 도메인이다. users · password_reset_tokens는 **앱 롤에 grant 자체가 없고** SECURITY DEFINER 함수로만 접근한다 |
| **상위 그룹 1종** | business_units | 사업자등록번호 단위 그룹이라 사업장 하위가 아니다. 판정 축은 owner_user_id이며 소속 사업장 관리자에게 읽기만 열린다 |
| **계정 단위 자원 2종** | subscriptions · system_admins | 구독은 계정 단위(user_id UNIQUE)이고 플랫폼 역할은 사업장과 축이 다르다. 사업장을 스코프로 갖지 않는다. **system_admins의 SELECT는 플랫폼 권한 축 외에 본인 행 축을 갖는다** — 본인 권한과 만료일 조회는 목록 열람이 아니므로 목록 권한 키를 요구하지 않는다(보정 V0703) |

**workplace_id 컬럼 자체를 갖지 않는 16종** — 계정 7 + 전역 마스터 4(plans · statutory_rates · notification_types · income_tax_table_entries) + 테넌트 루트 자신 1(workplaces) + 상위 그룹 1(business_units) + 계정 단위 자원 2 + 정기작업 실행 이력 1(scheduled_job_runs). terms_documents는 계정 도메인과 전역 마스터에 모두 걸치므로 한 번만 센다. 검산: 7 + 4 + 1 + 1 + 2 + 1 = **16**.

workplace_id 보유는 61 − 17 = **44**이며 NOT NULL **39** · nullable **5**로 갈린다. 검산: 17 + 39 + 5 = **61**. 집계 정본은 [../05_database/README.md](../05_database/README.md) 접근 모델 절이다.

| 판정 보조 | 값 |
|-----------|-----|
| 정책 총수 | **173** — SELECT 61 · INSERT 61 · UPDATE 46 · DELETE 5. 검산: 61 + 61 + 46 + 5 = **173** |
| 봉인 칸 | **71** — DELETE 56 · UPDATE 15 · SELECT 0 · INSERT 0. 검산: 61 × 4 = **244**, 244 − 173 = **71** |
| 헬퍼 함수 | **43종**. 전부 SECURITY DEFINER + 검색 경로 고정이며 PUBLIC 실행 권한을 회수하고 앱 롤에만 재부여한다. **상태를 바꾸는 것과 시각에 의존하는 조회만 VOLATILE**이고 나머지는 STABLE이다 — **어느 함수가 그것인지를 여기서 다시 세지 않는다**(쓰기 축 헬퍼가 늘 때마다 이 미러가 조용히 어긋난다. 실측으로 두 번 그렇게 됐다). 시그니처·휘발성의 정본은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)다 |
| 주입 컨텍스트 | **5종** — 현재 사용자 · 시스템 컨텍스트 · 트랜잭션 컨텍스트 3(초대 수락 · 사업장 폐쇄 · 사업자 재검증) |
| DELETE 정책 | **5건** — system_admins의 권한 회수 1 · 재계산·재산정 교체 **4**(employee_count_snapshot_days · payroll_employee_result_items · payroll_validation_results · **attendance_breaks** — 롤업이 만든 자동 차감분이며 술어가 **is_auto인 행만 · 서버 컨텍스트에서만**이다). 나머지 56테이블은 DELETE가 봉인이며 **앱 롤 DELETE grant는 교체 4테이블에만 있다** |

- **헬퍼가 SECURITY DEFINER인 이유는 RLS 재귀다.** 정책이 workplace_members를 직접 조회하면 그 테이블 자신의 정책이 다시 평가되어 무한 재귀가 된다. 반환이 boolean · 정수 · 좁은 레코드로 한정되는 것이 승격의 안전 근거이므로 **레코드를 넓게 반환하도록 확장하지 않는다**.
- **is_workplace_member()가 profiles.status를 보는 것이 인증과 인가를 잇는 지점이다** — 계정 정지가 한 컬럼 갱신으로 전 사업장의 행 가시성을 즉시 닫는다.
- **동료의 연락처·민감정보를 여는 정책이 없다.** 동료 조회는 list_workplace_members()가 담당하며 **연락처가 반환 타입에 없으므로 실릴 자리 자체가 없다.**

---

## 2단 방어에서의 위치

```plain
[보조] 클라이언트 라우터·화면 가드 — 신뢰 계층이 아니다. 어느 판정의 근거도 아니다
        ↓
① 서비스 레이어     — 1차 검증. 멤버십·역할·사업장 스코프·상태 전이·선행조건
        ↓
② RLS 정책          — 2차 심층방어. 행 단위 격리
        ↓
③ 제약·트리거       — 컬럼 단위 제한·상태 전이·확정 불변·사유 필수
```

| 층 | 이 층만으로 부족한 이유 |
|----|------------------------|
| ① 서비스 레이어 | 스코프 검사 누락은 코드 리뷰로 100% 잡히지 않는다. 새 엔드포인트 하나의 누락이 곧 테넌트 경계 붕괴가 된다 |
| ② RLS 정책 | 권한 없음과 데이터 없음이 구분되지 않아 사용자에게 잘못된 안내가 나가고, 차단 사유를 알려줄 수 없다. 게다가 **컬럼 단위 제한·상태 전이·값 검증을 정책이 표현하지 못한다** |
| ③ 제약·트리거 | 행 가시성을 판정하지 않는다. 트리거는 이미 도달한 행에 대해서만 동작한다 |

- **1차가 왜 거부됐는지를 알려주고 2차가 1차의 누락을 결과적으로 막는다.** 둘의 역할을 바꾸지 않는다.
- 정책은 **스칼라 서브쿼리로 감싸** initplan 캐싱을 유도한다 — 행마다 헬퍼가 재평가되면 격리 비용이 조회 규모에 비례해 커지고, 그 비용이 정책을 느슨하게 만들 압력이 된다.
- **UPDATE는 USING과 WITH CHECK를 모두 갖는다.** WITH CHECK가 없으면 변경 후 행이 정책 밖으로 나가는 것을 막지 못한다 — workplace_id를 타 사업장으로 바꾸는 UPDATE가 USING만으로는 통과한다.

---

## 본인 소유권 인가

퇴사·사업장 폐쇄·계정 탈퇴 전 보존기간 내 본인 열람은 **멤버십이 아니라 employees.user_id로 판정한다**(CMP-07 · REQ-SLP-09 · REQ-HRM-15). 판정 헬퍼는 is_self_employee()이며 **멤버십·사업장 상태를 보지 않는다**.

| 상황 | 사업장 업무 접근 | 본인 귀속 법정문서 열람 |
|------|-----------------|----------------------|
| 재직 중(ACTIVE 멤버십) | 역할 범위 내 허용 | 허용 |
| 퇴사(LEFT · REMOVED) | 차단 | **보존기간 내 허용**(읽기 전용) |
| 사업장 폐쇄(CLOSED) | 신규 생성 차단 · 읽기 전용 | **허용** |
| 사업장 구독 만료 | **차단하지 않는다** — 막히는 것은 신규 사업장 등록과 유료 기능뿐이다(REQ-SUB-09) | **허용** |
| 계정 탈퇴 전 보존기간 내 | 차단 | **허용** |
| 계정 탈퇴(DELETED) | 차단 | 차단 — 법정 보존 데이터 자체는 파기하지 않는다 |

- **구독 만료는 폐쇄와 다른 축이다.** 폐쇄·정지는 쓰기 가능 헬퍼와 가드 트리거가 사업장 상태로 막지만, **구독 상태는 어느 헬퍼·가드의 판정 축도 아니다** — 만료가 근태·급여·명세서 같은 법정 업무를 막으면 그 차단 자체가 법정 의무 이행을 방해하기 때문이다. 강제 지점은 사업장 등록과 유료 기능 실행의 서비스 가드이며, 계약 정본은 [../03_requirements/12_subscription.md](../03_requirements/12_subscription.md) REQ-SUB-09다.
- **소유권 인가는 읽기 전용이다.** 퇴사자가 자기 명세서를 재발행하거나 수정할 수 없다.
- 그것을 물리적으로 가능하게 하는 것이 **비정규화 user_id 컬럼**이다. employees를 조인하면 employees 자신의 정책이 다시 평가되고 고volume 테이블에서 행마다 조인이 발생한다. sync_employee_user_id() 트리거가 변경을 전파한다.
- 사업장 스코프를 함께 요구하는 테이블은 소유권 헬퍼와 사업장 소속 확인을 병용해 **테넌트 오염**을 차단한다.
- **본인 열람 기록(payslip_deliveries)의 INSERT는 사업장 쓰기 가능 여부를 요구하지 않는 유일한 사용자 INSERT다** — 사업장 폐쇄 이후에도 본인 열람 사실이 남아야 교부 의무 이행이 증빙된다.

---

## 봉인 지점

정책을 두지 않은 자리가 곧 표현 불가능한 접근이다. 전수 매트릭스의 정본은 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)의 봉인 매트릭스와 "정책이 없는 것이 설계인 지점" 절이며, 아래는 각 봉인이 **무엇을 불가능하게 만드는가**의 보안 함의다.

| 봉인 | 보안 함의 |
|------|----------|
| DELETE 57테이블(system_admins 제외) | 업무·법정 보존행을 지울 수 없다. 정책이 아니라 **grant 부재가 막으므로** 정책 실수로 열리는 경로도 없다 |
| audit_logs · security_events · account_status_events의 UPDATE·DELETE | **감사·보안 이력을 고칠 수 없다.** 정정은 새 로그 추가이며, 이 성질이 없으면 침해 행위자가 자기 흔적을 지운다 |
| location_usage_records의 UPDATE·DELETE·관리자 SELECT | 위치정보 확인자료를 **사용자·관리자 조작으로 삭제·수정할 수 없고** 사업주가 직원의 위치 이용 이력을 조회할 수도 없다([05_location_privacy.md](./05_location_privacy.md)) |
| users · password_reset_tokens의 앱 롤 grant | 자격 증명 원장과 재설정 토큰에 **클라이언트 경로에서 닿을 수 없다.** 접근은 서버 전용 함수로만 한다 |
| profiles의 동료 SELECT | 동료 정보 유출을 정책이 아니라 **함수 반환 타입**이 막는다 — 반환 타입 변경은 시그니처 변경이라 조용히 일어나지 않는다 |
| payroll_validation_results의 STAFF SELECT | 최저임금 미달 경고 등 내부 판정이 직원 화면에 흘러가지 않는다 |
| 급여 확정 결과의 사용자 UPDATE | 확정 불변을 규칙이 아니라 **표현 불가능성**으로 강제한다. 확정 후 변경 차단은 트리거가 다시 받는다 |
| 초대의 클라이언트 직접 수락 정책 | 인원 한도 재검증·멤버십 생성·직원 초안 생성이 한 트랜잭션에 묶이도록 **서버 원자 함수 경로로만** 허용한다 |
| leave_transactions · payroll_employee_result_items 등 원장의 UPDATE | 원장이 진실 원천이라는 설계를 물리적으로 고정한다 |
| Materialized View 미채택 | 행 수준 보안이 적용되지 않는 객체를 만들지 않는다 — **집계 뷰 하나가 사업장 경계를 통째로 무력화**한다 |
| 업무 데이터의 Redis 캐시 미채택 | RLS 판정을 거치지 않은 값이 캐시에 남아 격리가 캐시 계층에서 뚫리는 경로를 만들지 않는다(ADR-11) |
| documents의 파일 접근 정책 | **RLS는 메타 행 가시성만 담당한다.** 실체 접근은 비공개 버킷 + 서비스 인가 + 1회용 토큰 + 서버 스트리밍이며, 정책이 열려 있어도 파일을 받을 수 있는 것은 아니다(ADR-16) |

- **쓰기를 열었다고 반환까지 열린 것은 아니다.** INSERT·UPDATE의 WITH CHECK가 서버 컨텍스트로 열려 있어도 삽입·갱신 행을 돌려주는 RETURNING은 **SELECT 정책의 가시성을 별도로 요구**해 그 자리에서 42501로 끝난다. 서버 쓰기 표면 4지점(#38 · #41 · #146 · #167)이 이 이유로 SELECT에 서버 컨텍스트 축을 결합했고, 감사 로그 기록 함수는 반대로 반환을 없애 요구 자체를 지웠다(보정 V0701 · V0705 · V0706 · V0707). 전수와 근거는 [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)의 쓰기 반환 축 절이다.
- **새 테이블을 정책 없이 배포하지 않는다.** RLS 활성이 먼저이고 정책이 뒤이며, 정책을 먼저 만들고 활성화하는 순서를 쓰지 않는다.
- 확장 정책을 추가하려면 **그것이 열어 주는 컬럼 전부를 열거하고** 그중 암호문·마스킹 대상·좌표가 있는지 먼저 확인한다.

---

## 교차 사업장 차단 검증 절차

**검증은 정의가 아니라 행위로 한다.** 정책 정의를 읽는 것은 검증이 아니며, 완료 판정은 실제 세션 조작 결과로 한다(REQ-TEC-08). 본 절은 **구현 후 실측할 게이트**를 미리 고정한다.

사업장 A의 OWNER를 U1, 사업장 B의 STAFF를 U2, 사업장 A에서 퇴사한 전 직원을 U3로 둔다.

| # | 시도 | 기대 |
|:-:|------|------|
| 1 | U2 세션으로 사업장 A의 employees · employee_personal_infos SELECT | 0행 |
| 2 | U2 세션으로 사업장 A의 attendance_records · payroll_employee_results SELECT | 0행 |
| 3 | U2 세션으로 사업장 A의 payslips SELECT | 0행 |
| 4 | U2 세션으로 workplace_id를 사업장 A로 지정한 attendance_records INSERT | 정책 위반 오류 |
| 5 | U1 세션으로 사업장 A 행의 workplace_id를 사업장 B로 바꾸는 UPDATE | WITH CHECK 위반 오류 |
| 6 | U2 세션으로 사업장 A의 workplaces 행 SELECT(사업자등록번호 탐지 시도) | 0행 — **행 존재 자체가 노출되지 않는다** |
| 7 | U2 세션으로 타인 대상 workplace_invitations SELECT | 0행 |
| 8 | U1 세션으로 사업장 A 동료의 연락처·주민번호 컬럼 조회 | 반환 타입에 없음 · 암호문 컬럼 미투영 |
| 9 | STAFF 세션으로 payroll_validation_results SELECT | 0행 |
| 10 | 사업장 A의 STAFF 세션으로 타인 알림(notifications) SELECT·UPDATE | 0행 · 0행 갱신 |
| 11 | STAFF 세션으로 타인의 location_usage_records SELECT | 0행 |
| 12 | 사업장 A의 OWNER 세션으로 직원의 location_usage_records SELECT | **0행 — 관리자에게도 열리지 않는다** |
| 13 | 세션 컨텍스트를 주입하지 않은 연결로 아무 업무 테이블 SELECT | 0행(전 테이블) |
| 14 | 앱 롤로 users · password_reset_tokens 직접 SELECT | 권한 오류 — grant 자체가 없다 |
| 15 | 앱 롤로 임의 테이블 DELETE | 권한 오류 — grant 자체가 없다 |
| 16 | 세션으로 audit_logs · security_events INSERT·UPDATE·DELETE | 거부 |
| 17 | U3(퇴사자) 세션으로 본인 payslips · contracts(SIGNED) · payroll_employee_results SELECT | **성공** — 소유권 축이 멤버십과 독립임을 확인한다 |
| 18 | U3 세션으로 사업장 A의 근태 신규 INSERT | 거부 — 소유권은 읽기 전용이다 |
| 19 | 사업장 A를 CLOSED로 만든 뒤 U3 세션으로 본인 payslips SELECT | **성공** |
| 20 | 계정 정지 직후 같은 사용자 세션으로 업무 테이블 SELECT | 0행 — 헬퍼가 프로필 상태를 본다 |

검산: 교차 사업장 차단 7(1~7) + 컬럼·내부판정 차단 3(8~10) + 위치정보 차단 2(11~12) + 컨텍스트·롤 차단 4(13~16) + 소유권 축 확인 3(17~19) + 상태 반영 1(20) = **20항**.

- **정책·헬퍼·트리거를 고치면 위 절차를 다시 전수로 수행한다.** 부분 검증은 확장을 넓히는 변경에서 특히 위험하다(REQ-TEC-07).
- 17~19는 차단이 아니라 **열려 있어야 정상인 항목**이다. 격리 검증을 차단 확인만으로 구성하면 과도한 차단이 통과하고, 그 결과가 법정문서 접근 단절이다.

---

## 잔여 위험

| # | 위험 | 근거 | 판단 |
|:-:|------|------|------|
| 1 | 앱 롤 자격 증명이 유출되면 정책 안에서의 전 사업장 조회가 가능해진다 | 정책은 세션 컨텍스트를 신뢰하므로 임의 사용자 식별자를 주입한 연결은 그 사용자로 동작한다 | **수용** — 데이터베이스 포트를 호스트에 노출하지 않고 컨테이너 내부 네트워크로만 접근한다(ADR-21). 자격 회전은 [03_secrets_keys.md](./03_secrets_keys.md) |
| 2 | 시스템 컨텍스트가 사용자 요청 경로에서 켜지면 서버 전용 테이블이 통째로 열린다 | 플래그 하나가 users · password_reset_tokens의 정책을 통과시킨다 | **구조적 위험** — 주입 지점을 데이터소스 프록시 한 곳으로 제한하고 아키텍처 테스트가 프록시 우회 접근을 차단한다(ADR-28 · ADR-18) |
| 3 | 원시 SELECT는 감사에 남지 않는다 | 조회는 함수 호출이 없어 데이터베이스가 가로챌 수 없다 | **구조적 한계** — 감사가 필요한 접근(PII 복호화 · 민감 문서 다운로드 · 감사 내보내기)은 전부 **서버 경유 함수·스트리밍 경로**로 설계해 기록이 남게 한다 |
| 4 | 사업장 관리자에게 audit_logs의 자기 사업장 도메인 이력이 열려 있다 | v1에서 도메인별 이력 테이블을 폐기하고 workplace 스코프 SELECT를 명시 개방했다 | **의식적 선택** — before/after에 PII 원문이 없고 workplace_id로 격리되는 것이 이 개방의 전제다. 그 규율이 깨지면 개방을 되돌려야 한다 |
| 5 | 정책 성능 저하가 정책을 느슨하게 만들 압력이 된다 | 헬퍼가 행마다 재평가되면 대량 조회 비용이 커진다 | **등재** — 전 정책이 스칼라 서브쿼리 관용구를 쓰고 소유권 축이 비정규화 컬럼을 쓰는 것이 그 대응이다. 실측 후 재평가한다 |
| 6 | 격리 검증 20항이 아직 실측되지 않았다 | 본 문서군은 구현 착수 전 to-be 설계 정본이다 | **이월** — 구현 후 실측으로 승격하며, 미실측 상태를 검증 통과로 간주하지 않는다 |
| 7 | 플랫폼 권한 키 system_admin:view가 화이트리스트 열거에 없었다 | RLS 정책 #142가 이 키를 참조하는데 has_permission의 역할별 권한 집합에 나타나지 않았다 | **해소(2026-08-03)** — **SUPER_ADMIN 전용 키**로 확정해 화이트리스트에 등재했다. 권한 키 26 → **27**([07_platform_rbac.md](./07_platform_rbac.md) · [../05_database/15_system.md](../05_database/15_system.md)) |

---

## 관련 문서

- 정책 표현식·헬퍼·봉인 매트릭스 정본 → [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)
- 함수·트리거 전수 정본 → [../05_database/09_functions_triggers.md](../05_database/09_functions_triggers.md)
- 접근 모델·테넌트 스코프 집계 → [../05_database/README.md](../05_database/README.md)
- 멀티테넌시·2단 방어 아키텍처 → [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)
- 인증·인가 → [01_authn_authz.md](./01_authn_authz.md)
- 플랫폼 RBAC → [07_platform_rbac.md](./07_platform_rbac.md)
- 위협모델 → [06_threat_model.md](./06_threat_model.md)
- 권한 매트릭스 → [../02_features/14_permission_matrix.md](../02_features/14_permission_matrix.md)
- 격리 검증 요구사항 → [../03_requirements/15_nonfunctional.md](../03_requirements/15_nonfunctional.md)
