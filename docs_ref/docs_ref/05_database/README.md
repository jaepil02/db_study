# 05_database — 데이터베이스

> **대상**: insadesk — PostgreSQL 18 위의 업무 테이블 **61종** · enum **33종** · 제약 · RLS 정책 **173** · 함수 **105** · 마이그레이션 배치
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — 인용 정리 — idempotency_records 문단의 **멱등 필수 표면 수 인용을 걷고 정본 링크로 바꾼다**(10 → 14로 늘어 문장이 틀리게 된 자리 · 근태 · 휴가 일괄 승인·반려 4표면). 테이블 · 정책 수는 움직이지 않는다
> **개정일**: 2026-09-10 — 타입 매핑 표에 **time 행을 신설**한다(**LocalTime** · 근무 편성의 시작·종료 시각). **표가 date 와 timestamptz 만 담아 시간대 없는 시각 열의 자리가 없었고**, 그 공백에서 **드라이버·ORM 의 시간대 달력 설정을 「UTC 저장」의 이행으로 읽는 오독**이 성립해 값이 9시간 밀렸다(2026-09-10 실측 · [ADR-17](../04_architecture/09_decision_records.md) 개정). 함께 timestamptz 행에 **달력 설정에 기대지 않는 근거**를 적는다. **테이블 61 · enum 33 · 정책 173 · 함수 104 는 전건 불변**이다 — 스키마가 아니라 그 스키마를 받는 자바 타입의 표다
> **개정일**: 2026-09-10 — 인용 갱신 — 명세서 대체 교부 경로(EMAIL)의 수신 주소를 내는 서버 함수 **workplace_member_email** 신설(V0735) — 헬퍼 43 → **44종** · DB 함수 104 → **105** (트리거 61 불변) · 실측 pg_proc 105 → **106**. 정본 [08_rls_policies.md](./08_rls_policies.md) 헬퍼 #45. **정책 173 · 테이블 61 · enum 33/132 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-10 — 인용 갱신 — 보조 비밀번호 재설정의 대행 방식 확정(복구 이메일 대리 등록 — 표면 정본 [../06_api/14_system.md](../06_api/14_system.md) #10)으로 서버 함수 **issue_assisted_password_reset** 신설 — 헬퍼 42 → **43종** · DB 함수 103 → **104**(트리거 61 불변) · 실측 pg_proc 104 → **105**. 정본 [08_rls_policies.md](./08_rls_policies.md) 헬퍼 #44. **정책 173 · 테이블 61 · enum 33/132 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-09 — **V0726 · V0727** 반영 — 헬퍼 39 → **42종**(시스템 콘솔 제재 표면의 서버 함수 3종) · DB 함수 100 → **103** · 실측 pg_proc 101 → **104**. 정본 [08_rls_policies.md](08_rls_policies.md) #41~#43. **둘 다 ALTER POLICY와 함수 신설이라 정책 수 · 봉인 칸 · 테이블 수는 바뀌지 않는다.** V0727이 **읽기 축의 넷째 종류(산출물 수신자 열거)**를 드러냈고 그 절의 분류 축을 목록에서 판정 기준으로 바꿨다. **테이블 61 · 정책 173 · PK 61 · enum 33/132 · 가드 55 · 부분 UNIQUE 28 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-08 — 인용 갱신 — 한계 등재 35 → **36항**(명세서 보존기한과 문서 보존기한의 대조 · 정본 [07_constraints_integrity.md](07_constraints_integrity.md)). 테이블 61 · 정책 173 · PK 61 · 함수 100 · 헬퍼 39는 전건 불변
> **개정일**: 2026-09-08 — **V0720** 반영 — attendance_breaks에 DELETE 정책 신설로 RLS 정책 172 → **173** · DELETE 정책 4 → **5** · 앱 롤 DELETE grant 3 → **4테이블** · 봉인 칸 72 → **71**. **테이블을 늘리지 않고 봉인된 칸 하나를 연 첫 개정**이며 정책과 봉인의 합은 244로 그대로다. 정본 [08_rls_policies.md](08_rls_policies.md) #173. **테이블 61 · PK 61 · 부분 UNIQUE 28 · 함수 100 · 헬퍼 39 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-07 — 인용 갱신 — **V0716**(전자서명 서버 함수 sign_contract 신설)으로 헬퍼 38 → **39종** · DB 함수 99 → **100** · 실측 pg_proc 100 → **101**. 정본 [08_rls_policies.md](08_rls_policies.md) #40. **테이블 61 · 정책 172 · PK 61 · 부분 UNIQUE 28 · 가드 55 · GUC 5종은 전건 불변**
> **개정일**: 2026-09-07 — **V0711 · V0712** 적용 반영 — V0711이 idempotency_records를 신설해 테이블 60 → **61종**(legacy 채택 52 + 신설 8 → **9**) · PK 60 → **61**(uuid v4 42 → **43**) · RLS 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46**) · 유일성 강제 59 → **60**(부분 UNIQUE 27 → **28**) · set_updated_at 미보유 17 → **18**(부착 **43은 불변**). V0712는 GRANT · 함수 본문 교체 · ALTER POLICY라 수치를 바꾸지 않는다. **enum 33/132 · DELETE 정책 4 · 함수 99 · 헬퍼 38 · 가드 55 · UNIQUE 32 · EXCLUDE 10 · SET NULL 48은 전건 불변**. 접근 모델 절의 **도입 문장이 표와 갈라져 있었다** — workplace_id 미보유를 15종·다섯 부류로 적었으나 표는 6행 합 16이었다(scheduled_job_runs를 부류로 더할 때 도입 문장을 함께 고치지 않았다). 이번에 **17종 · 일곱 부류**로 맞추고 검산을 다시 세웠다. 폴더 목차의 헬퍼 인용 32 → **38**도 함께 정정한다(고정 기준 표와 갈라져 있었다)
> **개정일**: 2026-09-07 — 인용 갱신 — 헬퍼 37 → **38종**(사업장 폐쇄 서버 함수 신설 — 보정 V0710. 정본 [08_rls_policies.md](08_rls_policies.md)) · DB 함수 98 → **99**. 격리 분류 수치 · 정책 169 · 위협·통제 항목은 전건 불변
> **개정일**: 2026-09-07 — 인증 쓰기 축 서버 함수 신설(보정 **V0709**) 반영 — 헬퍼 32 → **37종** · DB 함수 93 → **98**(신설 6 create_user_credentials · update_user_password · consume_password_reset · issue_password_reset · mark_user_deleted · expired_suspension_user_ids, 폐기 1 request_password_reset. 검산 32 + 6 − 1 = **37**). 실측 pg_proc 94 → **99**(내부 술어 1종 포함). 휘발성 축 5 → **10종**(상태를 바꾸는 9 + 시각 의존 조회 1). 정본 [08_rls_policies.md](08_rls_policies.md)
> **개정일**: 2026-09-06 — 실측 정합(로컬 PostgreSQL 18에 db_migration V0001~V0707 전량 적용 후 카탈로그 대조) — 보정 V0704·V0706의 append_audit_log 등재로 헬퍼 31 → **32종** · 함수 92 → **93**(정본 08_rls_policies.md #32). **고정 기준 표의 잔재 정정** — RLS 헬퍼·서비스 함수 27 → **32종** · DB 함수 88 → **93** · 헬퍼 정의자 롤 소유 31 → **32종**(표가 V0702 반영에서 멈춰 같은 문서 안에서 메타·본문과 어긋나 있었다) · 문서 지도의 헬퍼 27 → **32** · 함수 92 → **93**. 테이블 60 · 정책 169 · enum 33 · 가드 55는 실측 전건 일치로 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영 — **타입 매핑·역직렬화 규약을 Java 축으로 전면 재작성**(bigint → long · numeric → BigDecimal · date → **LocalDate**로 문자열 우회 폐기 · timestamptz → OffsetDateTime) · 드라이버 전역 파서 절을 **JDBC 축 등가 함정**으로 대체 · 저장소 폴더 back/ → **backend/** · 마이그레이션 경로 back/db/migration/ → 루트 **db_migration/**(Flyway). DB 수치는 전건 불변
> **개정일**: 2026-08-20 — 인증 서버 함수 4종 신설(보정 V0702) — 헬퍼 27 → **31** · 함수 88 → **92** · 미인증 경로 서술 둘 → **셋**(로그인 자격 함수 — 열거 차단은 앱 계층 등시간 검증 계약)
> **개정일**: 2026-08-08 — DB 커버리지 감사 통합 반영 — 테이블 58 → **60**(employee_protected_periods · scheduled_job_runs) · enum 32 → **33** · 정책 160 → **169** · 헬퍼 22 → **27** · 가드 38 → **55** · 함수 64 → **88** · 유일성 46 → **59** · EXCLUDE 6 → **10** · SET NULL 46 → **48** · GUC 3 → **5** · **헬퍼 정의자 롤 insadesk_helper 신설**
> **개정일**: 2026-08-08 — Prisma 어댑터 기준으로 타입 매핑·역직렬화 규약 재작성(드라이버 전역 파서 설정 금지 · 금액 평균 집계 금지 · date는 조회 계층 변환) · 요금제 버전 재설계 반영으로 PK 구성 갱신(uuid v4 40 → **41** · text 자연키 2 → **1**) · 유일성 강제 45 → **46**(UNIQUE 26 → **27**)
> **개정일**: 2026-08-03 — M5 파생 집계 재계수 — DB 함수 63 → **64** · 가드 트리거 37 → **38** · 트리거 함수 41 → **42** · 설계 확정 6 → **7** · SET NULL FK 44 → **46**. 인용처 전수 스윕(대상 메타 · 접근 모델 · 폴더 목차 · 고정 기준 4행)
> **개정일**: 2026-08-03 — workplace_id 스코프 집계 정정(테넌트 스코프 46 → **38** · 선택 스코프 5 신설) · 위치 정확도 numeric(8,2) 명시 · 반올림 금지 값 정밀도 분리 · 미확인 기준값 목록을 정본 링크로 대체
> **원천**: docs_ref2/schema_p0.md(테이블 58 · enum 32 · RLS · 제약 · 마이그레이션 배치) · docs_ref2/requirements_p0.md(REQ-GLB 전역 규칙 · 상태 머신) · 확정 결정 D-21(raw SQL 정본 · JPA·MyBatis 2축 · Flyway — D-05 대체) · ADR-25~29

본 폴더는 insadesk 데이터베이스 설계의 **단일 정본**이며, to-be 설계 정본이다 — 구현이 진행되면 실측(pg_catalog 조회)으로 갱신·승격한다. PostgreSQL **18**을 전제하며(AWS EC2 Docker · backend/), public 스키마에 업무 테이블 **61개**를 둔다. 전 테이블에 ENABLE + FORCE ROW LEVEL SECURITY를 걸고 앱 롤 insadesk_app은 NOSUPERUSER · NOBYPASSRLS · 비소유자이며, **헬퍼 정의자 롤 insadesk_helper**(BYPASSRLS · NOLOGIN)만 정책 평가를 우회한다.

설계는 legacy 65개 테이블 전수에 대한 채택·폐기 판정의 결과다 — **legacy 채택 52 + 신설 9 = 61**이며 v1 제외 기능에 속한 13개를 폐기했다. 신설 9종은 business_units · employee_count_snapshot_days · compliance_tasks · severance_assessments · location_usage_records · income_tax_table_entries · **employee_protected_periods** · **scheduled_job_runs** · **idempotency_records**다.

- employee_protected_periods · scheduled_job_runs 2종은 커버리지 감사가 드러낸 **저장 공백**을 메운다 — 출근 간주 기간(근로기준법 §60⑥ 5유형)을 담을 구조가 없어 연차 출근율 판정이 성립하지 않았고, 정기작업 8건의 실행 이력·마지막 성공 시각·dead letter를 담을 자리가 없어 "돌지 않음"과 "돌았으나 대상 0건"을 구분할 수 없었다.
- **idempotency_records는 구현 착수가 드러낸 계약 공백을 메운다**(V0711) — 멱등키 계약이 요구하는 넷(응답 재생 · 본문 충돌 거부 · 24시간 보존 · 실패 미기록)을 담을 자리가 없었다. 도메인 4테이블의 idempotency_key 열은 각 도메인의 자연 중복 방지이고, 멱등 필수 표면의 **대부분**은 그 열조차 없다([17_infra.md](./17_infra.md) · 표면 목록의 정본 [../06_api/01_conventions.md](../06_api/01_conventions.md)).

**세 가지가 이 스키마의 핵심 제약이며 어기면 조용히 틀린 결과가 나온다.**

1. **타입 매핑·역직렬화** — bigint·numeric이 부동소수점(double)으로 역직렬화되면 부동소수점 금지 원칙이 데이터 접근 계층에서 깨진다.
2. **값 동결은 FK가 아니라 값 복사** — 기준값 행 ID만 참조하면 그 행이 정정될 때 과거 명세서 재출력이 틀어진다.
3. **퇴사자 본인 열람 RLS는 소유권 기준** — workplace_members 조인으로 짜면 퇴사·폐쇄 순간 본인 명세서 접근이 끊긴다.

---

## 테이블 61종 (이름 집합 — 대조 정본)

account_status_events · attendance_breaks · attendance_change_requests · attendance_daily_summaries · attendance_period_closings · attendance_records · audit_logs · batch_jobs · **business_units** · business_verification_logs · **compliance_tasks** · contract_signatures · contract_templates · contracts · documents · **employee_count_snapshot_days** · employee_insurance_histories · employee_insurance_infos · employee_personal_infos · **employee_protected_periods** · employees · employment_terms · export_jobs · **idempotency_records** · import_jobs · **income_tax_table_entries** · leave_balances · leave_grants · leave_requests · leave_transactions · leave_types · **location_usage_records** · membership_role_events · notification_types · notifications · password_reset_tokens · pay_items · payroll_employee_result_items · payroll_employee_results · payroll_runs · payroll_terms · payroll_validation_results · payslip_deliveries · payslips · plans · profiles · **scheduled_job_runs** · security_events · **severance_assessments** · statutory_rates · subscriptions · system_admins · terms_documents · user_consents · users · work_schedules · workplace_change_logs · workplace_employee_count_snapshots · workplace_invitations · workplace_members · workplaces

굵게 표기한 **9종이 신설**이다. **폐기한 legacy 13종은 여기 없다** — worksites · comprehensive_wage_terms · employee_change_logs · kiosk_devices · payroll_previews · device_tokens · notification_prefs · push_send_logs · subscription_requests · system_admin_role_events · announcements · payroll_monthly_stats · user_notification_settings. 검산: 52 + 9 = **61** · 65 − 13 = **52**.

---

## 접근 모델 — 테넌트 스코프 + 소유권 인가 + 전역 마스터 예외

기본은 **사업장 테넌트 격리**이고, 그 위에 **본인 소유권 인가**가 멤버십과 독립된 축으로 얹힌다. 전역 마스터와 계정 도메인만 테넌트 스코프 밖이다.

| 축 | 규칙 |
|----|------|
| 테넌트 스코프 | 업무 테이블 **39종**이 workplace_id NOT NULL이며 RLS 1차 술어가 그 컬럼이다. 비멤버에게는 **행 존재조차 노출되지 않는다** |
| 선택 스코프 | **5종**은 workplace_id가 nullable이다 — business_verification_logs(등록 전 검증) · notifications(계정 단위 알림) · audit_logs(플랫폼 액션) · location_usage_records(처리 맥락) · export_jobs(플랫폼 전체 내보내기). **사업장 스코프가 선택인 횡단 원장**이며 NULL 행은 테넌트 술어로 걸러지지 않으므로 정책이 별도 축을 갖는다 |
| 관리자 확장 | is_workplace_admin(w)(OWNER·MANAGER)이 사업장 전체 행을 연다. 역할 계층은 OWNER ⊃ MANAGER ⊃ STAFF 누적이다 |
| **본인 소유권 인가** | 명세서·급여 결과·근로계약·근태·연차는 **멤버십이 아니라 employees.user_id**로 판정한다. 퇴사·폐쇄·구독 만료 후에도 보존기간 내 본인 열람이 끊기지 않는다(CMP-07) |
| 고volume 가속 | 조회량이 많은 테이블은 **user_id 비정규화**(FK 아님)로 조인을 회피하고, 그 외는 is_self_employee() 헬퍼가 판정한다 |
| 쓰기 제한 | 사업장이 CLOSED·SUSPENDED면 is_workplace_writable()이 false가 되어 신규 업무 생성을 차단한다. **읽기와 쓰기의 축이 다르다** |
| 서버 전용 | users · password_reset_tokens는 앱 롤 직접 grant 없이 SECURITY DEFINER 함수로만 접근한다 — 미인증 경로는 **is_username_available()** · **request_password_reset()** · **auth_credentials_of()**(V0702) 셋이다. 앞 둘은 반환이 boolean·void라 계정 존재가 새지 않고, 로그인 자격 함수는 미존재 0행 + 앱 계층의 더미 해시 등시간 검증·응답 통일이 열거를 차단한다 |
| 전역 마스터 예외 | plans · statutory_rates · notification_types · terms_documents · income_tax_table_entries **5종**은 workplace_id가 없고 SELECT가 공개(서버 API 경유)다 |
| 계정 도메인 예외 | users · profiles · user_consents · account_status_events · security_events · password_reset_tokens · terms_documents **7종**은 사업장과 무관한 전역 도메인이다 |
| 플랫폼 RBAC | VIEWER · SUPPORT · ADMIN · SUPER_ADMIN 4단계이며 **사업장 RBAC와 완전 별개**다. 사업장 OWNER라도 플랫폼 권한 없이 감사 로그에 접근할 수 없다 |
| 삭제 | **DELETE 정책은 5건뿐**이다 — system_admins(역할 회수) · employee_count_snapshot_days(스냅샷 재산정 교체) · payroll_employee_result_items · payroll_validation_results(급여 재계산 교체) · **attendance_breaks(롤업 자동 차감분 교체)**. 앱 롤 DELETE grant도 그 **4테이블**에만 주며(회수 1건은 서버 함수 경로다) 정책 USING이 **파생·미확정 행**으로 대상을 좁힌다. 폐쇄·퇴사·탈퇴는 status 전이 + retention_until이다 |
| 강제 위치 | 애플리케이션이 아니라 **DB 계층** — RLS 정책 **173** + 헬퍼 **43종** + 가드 트리거 **55종** |

**workplace_id 컬럼 자체를 갖지 않는 17종**은 아래 일곱 부류다. terms_documents는 계정 도메인과 전역 마스터에 모두 걸치므로 계정 쪽에서 한 번만 센다.

| 부류 | 수 | 테이블 |
|------|:--:|--------|
| 계정 도메인 | 7 | users · profiles · terms_documents · user_consents · account_status_events · security_events · password_reset_tokens |
| 전역 마스터(계정 도메인 제외분) | 4 | plans · statutory_rates · notification_types · income_tax_table_entries |
| 테넌트 루트 자신 | 1 | workplaces — 자기 id가 곧 스코프다 |
| 상위 그룹 | 1 | business_units — 사업장 위에 놓이는 축이라 사업장에 종속하지 않는다 |
| 계정 단위 자원 | 2 | subscriptions(user_id UNIQUE) · system_admins(플랫폼 역할) |
| **플랫폼 운영 원장** | 1 | scheduled_job_runs — 정기작업이 전 사업장을 순회하므로 특정 사업장에 매이지 않는다 |
| **다형 스코프** | 1 | idempotency_records — scope_type이 scope_id의 해석을 정하므로 사업장 축이 열 하나로 고정되지 않는다 |

검산: 7 + 4 + 1 + 1 + 2 + 1 + 1 = **17**. workplace_id 보유는 61 − 17 = **44**이고, 그중 NOT NULL **39** · nullable **5**다 — 17 + 39 + 5 = **61**.

- **이 도입 문장은 표와 갈라져 있었다** — 15종·다섯 부류로 적혀 있었으나 표는 이미 6행이고 합이 16이었다. scheduled_job_runs를 여섯째 부류로 더할 때 도입 문장을 함께 고치지 않은 자리다. **부류 수와 합계를 도입 문장이 다시 세는 구조**라 표만 늘리면 반드시 갈라지므로, 부류를 더할 때 이 문장과 검산 줄을 같은 변경 단위에서 고친다.

정책 전수는 [08_rls_policies.md](./08_rls_policies.md), 헬퍼·트리거 전수는 [09_functions_triggers.md](./09_functions_triggers.md)가 정본이다.

---

## 단위·타입 규약

| 항목 | 규칙 |
|------|------|
| 금액 | **bigint(원)**. numeric·float 금지. 중간 몫만 numeric, 항목 최종 금액에서 1회 반올림 후 bigint 저장(REQ-GLB-02·03) |
| 기간·근로시간 | **integer(분)**. 초 단위 절사. **시각을 15·30분 단위로 절사하는 컬럼·제약을 두지 않는다**(REQ-ATT-14) |
| 시각 | **timestamptz(UTC 저장)**. 일 경계·표시는 KST(Asia/Seoul)(REQ-GLB-07) |
| 일자 | 근무일·급여월·효력일·기준일·지급일은 KST로 산출해 **date 컬럼에 물리 저장**한다. 급여월·통계월은 해당월 1일 |
| KST 조회 술어 | 저장된 date 컬럼을 **범위 술어로 직접 비교**한다. 조회 시 컬럼에 AT TIME ZONE·캐스팅을 씌우지 않는다 — 인덱스를 못 타고 세션 시간대 의존 STABLE 표현식이 된다. timestamptz 범위 조회는 서버가 KST 경계를 UTC instant로 변환해 바인드 파라미터로 넘긴다 |
| 비율 | **numeric**. 가산율 numeric(5,3) · 임금률 numeric(5,2) · 요율 값은 statutory_rates.value jsonb에 십진 문자열 |
| **반올림 금지 값** | 평균임금 일액(average_daily_wage) · 최저임금 환산시급(min_wage_converted_hourly · min_wage_reference)은 **numeric(18,4)**, 통상시급 환산시간 divisor(ordinary_wage_divisor)는 **numeric(12,6)**이다. **셋 다 반올림 없이 저장**한다 — 절사하면 과다경고, 절상하면 미달을 놓친다(REQ-GLB-03 §1.1) |
| 위치 정확도 | **numeric(8,2)**(미터). in_accuracy_m · out_accuracy_m. 정수가 아니며 직렬화는 문자열이다. 판정 한계값 geofence_radius_m · location_accuracy_limit_m만 integer다 |
| 휴가일수 | **numeric(6,1)** — 0.1일 단위. 반차 0.5 |
| 좌표 | **numeric(9,6)**(위도) · **numeric(10,6)**(경도). 저장 결정성 확보. 거리 계산 시점에만 double 캐스팅 |
| PK — 일반 엔티티 | **uuid DEFAULT gen_random_uuid()**(v4). **43테이블** |
| PK — 고volume append | **uuid DEFAULT uuidv7()**(PostgreSQL 18 네이티브 · 시간정렬). **16테이블** — 로그·이벤트·알림·근태 원본·원장·교부이력·확인자료·배치 실행 이력 |
| PK — 그 외 | text 자연키 1(notification_types.code) · 복합 1(employee_count_snapshot_days) |
| jsonb | 객체. **동결 필드의 수치는 문자열로 직렬화**해 저장한다 |
| 민감정보 | 평문 컬럼 금지. 암호문(bytea) + 키 버전 + HMAC blind index(+ 인덱스 키 버전) + 마스킹 표시값 |
| 확장 지점 | v1 제외 기능이 요구할 컬럼·테이블은 **주석으로만** 남긴다. 미사용 컬럼을 미리 만들지 않는다(값 동결 예약 필드 제외) |

PK 검산: 43 + 16 + 1 + 1 = **61**.

NULL 열 표기: **N** = 필수(NOT NULL) · **Y** = 선택(nullable). 키 표기: **PK** · **FK → table.col (정책)** · **UQ**(별표는 복합·부분 유니크의 구성 축). created_at·updated_at은 timestamptz NOT NULL DEFAULT now()가 기본이다.

---

## 타입 매핑·역직렬화 규약 (필수)

**PostgreSQL 타입이 맞아도 애플리케이션이 부동소수점(IEEE754 double)으로 역직렬화하면 REQ-GLB-02가 데이터 접근 계층에서 조용히 깨진다.** 데이터 접근 경로는 **쓰기·단순 조회 = Spring Data JPA · 복잡 조회 = MyBatis 읽기 전용** 2축이며 둘이 같은 데이터소스와 같은 트랜잭션을 공유한다(D-21 · ADR-26 · 정본 [../08_tech_stack/03_backend.md](../08_tech_stack/03_backend.md)). **역직렬화 계약이 결정되는 자리는 셋이다 — 엔티티 필드 타입 · 매퍼 결과 매핑 · DTO 필드 타입.** 아래를 스키마 정의·조회 계층과 함께 고정한다.

| PG 타입 | Java 표현 | 강제 방법 |
|---------|-----------|----------|
| **bigint**(금액·원) | **long**(또는 Long) | 세 자리 전부를 정수 타입으로 선언한다. **float · double 변환을 금지**하며 **컴파일 시점 정적 분석이 차단**한다(ADR-18) |
| **numeric**(비율·평균근로자수·휴가일수·평균임금·환산시급·divisor) | **BigDecimal** | **부동소수점으로 BigDecimal을 생성하는 호출을 금지**한다(십진 문자열 또는 정수로만 생성). **doubleValue 사용 금지** · **나눗셈은 스케일과 반올림 모드를 호출부가 명시**한다 |
| integer(분·일수·건수) | **int** | 안전 정수 범위 내 |
| **date**(근무일·급여월·효력일) | **LocalDate** | **시간대를 갖지 않는 타입이라 하루 밀림 함정이 성립하지 않는다.** 대신 **시간대를 끌고 들어오는 구형 날짜·시각 타입(java.sql.Date · java.util.Date · Calendar) 사용을 금지**한다 |
| **time**(근무 편성 시작·종료) | **LocalTime** | **시간대 없는 열이라 드라이버·ORM 의 시간대 달력을 지나지 않아야 한다** — 달력이 걸리면 저장값이 통째로 밀리고, **읽을 때 같은 달력으로 되돌아와 왕복은 일관해 보인다.** 어긋남을 그대로 보는 것은 데이터베이스 안의 가드뿐이라 **주간 편성이 야간으로, 야간 편성이 주간으로 판정된다**(ADR-17 개정) |
| timestamptz | **OffsetDateTime**(또는 Instant) | UTC 저장 · 응답 직렬화는 **UTC ISO-8601** · 서버 프로세스 시간대 Asia/Seoul 고정. **오프셋을 함께 보내 데이터베이스가 스스로 정규화하므로 드라이버 시간대 달력 설정에 기대지 않는다** — 「UTC 저장」은 이 열의 이야기다(ADR-17) |
| uuid · enum | **UUID** · 문자열 또는 열거 타입 | — |
| jsonb | 객체 또는 문자열. 동결 필드의 수치는 **문자열로 직렬화**해 저장 | resolved_rate_values · calc_detail · size_policy_values에 부동소수점을 넣지 않는다 |

- **date의 문자열 우회를 폐기하고 LocalDate로 고정한 것은 근거가 바뀐 결과다.** 이전 계약("조회 계층 변환 함수가 KST 일자 문자열을 만든다")의 근거는 **JavaScript가 date를 UTC 자정으로 파싱해 KST 일자가 하루 밀리는 것**이었다. **LocalDate는 시간대 개념을 갖지 않아 그 함정의 성립 조건 자체가 없으므로** 우회가 불필요하다 — 대신 같은 목적을 **구형 날짜·시각 타입 금지**로 달성한다. 그 셋은 기본 시간대로 해석되므로 한 자리라도 들어오면 밀림이 되살아난다.
- **JDBC에는 전역 타입 파서 개념이 없으므로 등가 함정은 매핑 선언 자리로 옮긴다.** 드라이버가 컬럼 타입을 어떻게 읽을지를 애플리케이션이 전역으로 갈아 끼우는 축이 없는 대신, **엔티티 필드 · 매퍼 결과 매핑 · DTO 필드 셋 중 하나라도 double · float로 선언되면 그 자리에서 값이 부동소수점이 된다.** 세 자리 전부가 정적 분석과 기동 스모크 테스트의 대상이다.
- **두 데이터 접근 축을 각각 검사한다.** 같은 컬럼이 JPA 엔티티에서는 BigDecimal이고 MyBatis 결과 매핑에서는 double일 수 있으며, 그 어긋남은 조회가 읽기 축으로 갈리는 자리에서만 드러난다(ADR-26).
- **금액 컬럼의 평균을 SQL AVG에 맡기지 않는다.** 이전 계약의 근거(집계 API가 IEEE754를 돌려준다)는 **AVG가 numeric을 돌려주므로 재현되지 않으나**, **합계와 건수를 각각 집계해 애플리케이션이 나눈다는 규약은 유지**한다 — 나눗셈의 스케일과 반올림을 호출부가 명시해야 하는데 AVG는 그 둘을 데이터베이스 기본값에 맡겨 반올림 1회 원칙(REQ-GLB-03)의 적용 지점을 흐린다. 중간 몫은 BigDecimal이다.
- 기동 스모크 테스트의 검증 대상은 설정이 아니라 **세 축이 실제로 돌려주는 Java 타입**이다(타입·스케일 단언 — [10_migrations_seed.md](./10_migrations_seed.md)). 골든 케이스 G-11(동일 입력 100회 재계산 바이트 동일)이 이 규약을 회귀 검증한다.
- **엔티티는 수기로 작성하고 스키마 생성을 금지하며 검증만 수행한다**(ADR-26 · ADR-27) — 데이터베이스가 정본인 축이 코드로 이중화되지 않는다. RLS 세션 컨텍스트는 **DataSource 프록시가 트랜잭션에 커넥션이 바인딩되는 순간 set_config로 주입**한다(D-21 · ADR-28 · [08_rls_policies.md](./08_rls_policies.md)).

---

## 폴더 목차

| 파일 | 도메인 | 테이블 수 | 전역 번호 |
|------|--------|:---------:|-----------|
| [erd.md](./erd.md) | **전역 ERD** — 표기 규약 · 5블록 조감도 · 관계 요약 | — | — |
| [01_auth.md](./01_auth.md) | 인증·계정 | 7 | 1~7 |
| [02_workplace.md](./02_workplace.md) | 사업장·멤버·상시근로자 | 9 | 8~16 |
| [03_hr.md](./03_hr.md) | 인사·근로계약·문서함 | 9 | 17~25 |
| [04_attendance.md](./04_attendance.md) | 근태 | 6 | 26~31 |
| [05_leave.md](./05_leave.md) | 휴가·연차 | 6 | 32~36 · 59 |
| [06_payroll.md](./06_payroll.md) | 급여 | 6 | 37~42 |
| [11_payslip.md](./11_payslip.md) | 명세서·일괄 작업 | 3 | 43~45 |
| [12_compliance.md](./12_compliance.md) | 법정 준수·퇴직급여 | 2 | 46~47 |
| [13_notification.md](./13_notification.md) | 알림 | 2 | 48~49 |
| [14_subscription.md](./14_subscription.md) | 구독·요금제 | 2 | 50~51 |
| [15_system.md](./15_system.md) | 시스템 관리·법정 기준값 | 4 | 52~55 |
| [16_privacy.md](./16_privacy.md) | 위치정보 | 1 | 56 |
| [17_infra.md](./17_infra.md) | 임포트·내보내기·배치 실행 이력·멱등 기록 | 4 | 57~58 · 60~61 |
| [07_constraints_integrity.md](./07_constraints_integrity.md) | enum · CHECK · PK/UNIQUE · EXCLUDE · 인덱스 · FK ON DELETE · 한계 등재 | — | — |
| [08_rls_policies.md](./08_rls_policies.md) | RLS 정책 전수 **173** · 앱 롤·정의자 롤 · 헬퍼 **43** · GUC 계약 **5** | — | — |
| [09_functions_triggers.md](./09_functions_triggers.md) | 함수 **105** · 공통 트리거 **6** · 가드 **55** · 확정 불변 | — | — |
| [10_migrations_seed.md](./10_migrations_seed.md) | 마이그레이션 배치 21구간 · 시드 정책 · 적용 후 검수 | — | — |

테이블 수 합계 검산: 7 + 9 + 9 + 6 + 6 + 6 + 3 + 2 + 2 + 2 + 4 + 1 + 4 = **61**.

- **도메인 파일 번호가 06 다음 11로 이어지는 이유는 횡단 문서 07~10을 예약해 두기 위해서다** — 타 폴더에서 들어오는 링크(제약·RLS·함수·마이그레이션)를 안정된 번호에 고정한다. docs_ref 05_database의 관행을 승계했다.
- 신설 테이블은 기존 번호를 밀지 않고 **맨 뒤 번호를 받는다**. 본 문서군은 신규 작성이므로 번호가 schema_p0 등장 순서와 일치한다.

---

## 고정 기준 (본 폴더가 정본인 값)

| 항목 | 기준 | 정본 |
|------|------|------|
| 테이블 | **61종** | 본 문서의 이름 집합 |
| 컬럼 | 도메인 파일 컬럼 명세 표의 합산 | 각 도메인 파일 |
| enum | **33종 · 값 132** | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| PK | **61** — uuid v4 43 · uuidv7 16 · text 자연키 1 · 복합 1 | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| 유일성 강제 | **60** — UNIQUE 32 + 부분 UNIQUE 28 | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| EXCLUDE | **10**(btree_gist) | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| FK ON DELETE | **CASCADE 2 · SET NULL 48 · 나머지 RESTRICT** | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| 복합 FK | **5** — 테넌트 오염 차단 | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| append-only | **12테이블** — prevent_mutation 부착 **10** + 변형 가드 2 | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| 한계 등재 | **37항** — 어느 층도 맡지 않는 것을 남기지 않기 위한 전수 | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| RLS 정책 | **173** — SELECT 61 · INSERT 61 · UPDATE 46 · DELETE 5 | [08_rls_policies.md](./08_rls_policies.md) |
| RLS 헬퍼·서비스 함수 | **43종** | [08_rls_policies.md](./08_rls_policies.md) |
| GUC 주입 계약 | **5종** — app.current_user_id · app.system_context · app.invitation_accept_context · **app.workplace_close_context** · **app.workplace_reverify_context** | [08_rls_policies.md](./08_rls_policies.md) |
| DB 함수 | **105** — 헬퍼·서비스 44 + 트리거 함수 61 | [09_functions_triggers.md](./09_functions_triggers.md) |
| 가드 트리거 함수 | **55** — 원천 명시 31 + 설계 확정 24 | [09_functions_triggers.md](./09_functions_triggers.md) |
| 공통 트리거 함수 | **6** — set_updated_at · sync 2 · log_insurance_history · propagate_run_void_to_payslips · prevent_mutation | [09_functions_triggers.md](./09_functions_triggers.md) |
| set_updated_at 부착 | **43**(미보유 18. 43 + 18 = 61) | [09_functions_triggers.md](./09_functions_triggers.md) |
| DEFERRABLE 제약 트리거 | **6** | [09_functions_triggers.md](./09_functions_triggers.md) |
| 동시성 잠금 지점 | **13** | [07_constraints_integrity.md](./07_constraints_integrity.md) |
| 마이그레이션 | 루트 db_migration/V{NNNN}\_\_{name}.sql · **21구간** · 적용은 Flyway | [10_migrations_seed.md](./10_migrations_seed.md) |
| 필수 확장 | **2종** — btree_gist · pgcrypto(uuidv7은 PG18 내장) | [10_migrations_seed.md](./10_migrations_seed.md) |
| 미확인 기준값 | 확인 전 시드 금지. **목록·건수의 정본은 본 폴더가 아니다** | [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 미확인 절. 막히는 시드 지점은 [10_migrations_seed.md](./10_migrations_seed.md) |
| 앱 롤 | insadesk_app — NOSUPERUSER · NOBYPASSRLS · 비소유자 · **DELETE grant는 재계산·재산정 교체 4테이블에만** | [08_rls_policies.md](./08_rls_policies.md) |
| 헬퍼 정의자 롤 | **insadesk_helper** — BYPASSRLS · NOLOGIN · 헬퍼 44종의 소유자. FORCE RLS 아래에서 정책 ↔ 헬퍼 재귀를 끊는 유일한 축 | [08_rls_policies.md](./08_rls_policies.md) |
| PostgreSQL | **18** | [../08_tech_stack/04_data_infra.md](../08_tech_stack/04_data_infra.md) |

> 파생 집계: 위 값 중 컬럼 총수는 도메인 파일 명세 표의 합이며, 본 표는 정본을 다시 세지 않고 각 도메인 파일을 가리킨다.

기능·요구사항·화면·에러 코드 같은 폴더 밖 수치의 정본은 [../README.md](../README.md)다.

---

## 읽는 순서

1. **도메인 실체** — [01_auth.md](./01_auth.md) → [02_workplace.md](./02_workplace.md) → [03_hr.md](./03_hr.md) → [04_attendance.md](./04_attendance.md) → [05_leave.md](./05_leave.md) → [06_payroll.md](./06_payroll.md). 데이터가 흐르는 순서다 — 계정 → 사업장 → 직원 → 근태 → 휴가 → 급여.
2. **파생·부속 도메인** — [11_payslip.md](./11_payslip.md) → [12_compliance.md](./12_compliance.md) → [13_notification.md](./13_notification.md) → [14_subscription.md](./14_subscription.md) → [15_system.md](./15_system.md) → [16_privacy.md](./16_privacy.md) → [17_infra.md](./17_infra.md).
3. **횡단 규약** — [07_constraints_integrity.md](./07_constraints_integrity.md) → [08_rls_policies.md](./08_rls_policies.md) → [09_functions_triggers.md](./09_functions_triggers.md) → [10_migrations_seed.md](./10_migrations_seed.md). 도메인을 먼저 읽어야 제약과 정책의 대상이 무엇인지 이해된다.
4. **조감이 필요하면** [erd.md](./erd.md)를 먼저 본다.

**횡단 번호 07~10을 도메인 사이에 비워 둔 것은 링크 안정성 때문이다** — 타 폴더가 제약·RLS·함수·마이그레이션을 자주 참조하므로 도메인이 늘어도 그 번호가 움직이지 않는다. 읽는 순서는 파일 번호가 아니라 본 절을 따른다.

---

## 관련 문서

- 전역 ERD·관계 요약 → [erd.md](./erd.md)
- 제약·enum·FK 정책 전수 → [07_constraints_integrity.md](./07_constraints_integrity.md)
- RLS 정책·앱 롤·GUC 계약 → [08_rls_policies.md](./08_rls_policies.md)
- 함수·트리거·확정 불변 → [09_functions_triggers.md](./09_functions_triggers.md)
- 마이그레이션·시드·검수 기준 → [10_migrations_seed.md](./10_migrations_seed.md)
- 문서군 지도·고정 기준 → [../README.md](../README.md)
- 작성·검수 지침 → [../CLAUDE.md](../CLAUDE.md)
- 멀티테넌시·2단 방어 → [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)
- 급여 엔진 파이프라인 → [../04_architecture/06_payroll_engine.md](../04_architecture/06_payroll_engine.md)
- API 표면 → [../06_api/README.md](../06_api/README.md)
- 전역 규칙(단위·반올림·기준값) → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- enum·상태 머신 정본 → [../09_glossary/03_enums_state_machines.md](../09_glossary/03_enums_state_machines.md)
- 단위·시간 규약 → [../09_glossary/05_units_and_time.md](../09_glossary/05_units_and_time.md)
- RLS 격리 위협 서술 → [../10_security/02_rls_isolation.md](../10_security/02_rls_isolation.md)
