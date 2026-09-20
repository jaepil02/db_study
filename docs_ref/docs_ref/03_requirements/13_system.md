# REQ-SYS — 시스템 관리 요구사항

> **대상**: 플랫폼 RBAC와 권한 화이트리스트 · 사업장 조회·정지·강제 폐쇄 · 사용자 조회와 제재 · 요금제 관리와 계정 구독 수동 조정 · 감사 로그 기록·조회·내보내기 · 기준값 스키마와 발효일 적용 · 약관/개인정보/위치정보 문서 관리 · **시스템 콘솔 목록 내보내기(DSH-06)**
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — **REQ-SYS-17 신설**(DSH-06 리포트 내보내기의 시스템 콘솔 목록 축 · D-23) — 요구사항 파일 접두사로 채번한다(DSH는 도메인 파일이 없어 행을 담은 파일의 접두사를 쓴다 — 규약 [../09_glossary/04_id_conventions.md](../09_glossary/04_id_conventions.md)). REQ-SYS-10의 사유 필수 열거 **두 자리**에 **민감 목록 내보내기**를 더한다(V0740 · 전수 16 → **17종**) · 에러 표의 export 3종에 REQ-SYS-17을 병기한다. 사업장 목록 축의 요구사항은 DSH-06 행이 있는 [03_workplace.md](./03_workplace.md)가 갖는다
> **개정일**: 2026-09-07 — REQ-SYS-10의 사유 필수 열거 **두 자리**에 **계정 구독 수동 조정**을 더한다(V0719 · 전수 15 → **16종**). **이 문서가 자기 안에서 어긋나 있던 자리다** — REQ-SYS-09가 등급 조정에 "사유가 필수"라고 못박는데 REQ-SYS-10의 열거는 그것을 담지 못했고, 채번 정본(15_system)도 같은 공백을 갖고 있었다. **신설이 아니라 누락 보정이다** — "15항목이 늘었다"가 아니라 **"15항목이 처음부터 하나 모자랐다"**로 읽는다. REQ-GLB-17 대조 문구는 **그 규칙이 든 5항목에 관해 불변**으로 정밀화했다(총수를 그 문장이 다시 세지 않는다). REQ 채번·건수는 전건 불변
> **개정일**: 2026-09-07 — REQ-SYS-10의 사유 필수 액션 열거 **두 자리**에서 ⑦ 표기를 **강제 폐쇄 → 사업장 폐쇄(자발·강제)**로 넓힌다(V0712 판정 배열 확장). 자발 폐쇄(workplace.close)도 되돌릴 수 없고 사업장 운영이 즉시 멈추므로 사유를 요구하는 근거가 강제 폐쇄와 같다 — **새 항목을 만들지 않고 기존 항목에 코드를 더한 것**이라 **전수 15종은 불변**이고 action 코드가 25 → **26**이 된다(집합 정본 [../05_database/15_system.md](../05_database/15_system.md)). REQ 채번·건수는 전건 불변
> **개정일**: 2026-08-20 — REQ-SYS-12 신고·납부 기한 규칙의 흡수 범위에 검증 대기 자동 정지 기한 14일 등재(REQ-WRK-08 — 정본 [01_global_rules.md](./01_global_rules.md) §1.3, 카테고리 수 **19종 불변**)
> **개정일**: 2026-08-09 — D-9 후속 정합 — 기준값 카테고리 17 → **19종**(STANDARD_WORK_HOURS · FILING_DEADLINE) · 사유 필수 **15종 유지 판정**(REQ-GLB-17 대조 — 일반 급여 확정 비귀속 · 기준값 적용 예외는 최저임금 미달 강행에 귀속) · analytics 2키를 v1 예약으로 표기
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 감사 로그 action 코드 집합과 사업장 관리자 개방 집합의 정본 위치 등재 · 역할 만료 판정의 강제 위치 명시 · 기준값 조회 권한 축을 확인 메타 한정으로 정정 · 강제 삭제의 사유 필수 귀속 확인 항목 등재
> **개정일**: 2026-08-08 — 권한 화이트리스트 정본에 verification:view/search · analytics:export · system_admin:view 3키 등재(소비 표면 명시) · 권한 키 검산 **27종** 병기 · 사유 필수 액션 13 → **15종**(민감 문서 다운로드 · 원좌표 파기 실행)
> **원천**: docs_ref2/requirements_p0.md SYS 절(REQ-SYS-01~16) · docs_ref2/features_p0.md(SYS 7기능) · docs_ref2/schema_p0.md system 4테이블

**플랫폼 RBAC는 사업장 RBAC와 완전히 별개**다. 사업장 OWNER라도 플랫폼 권한이 없으면 시스템 웹에 진입조차 못 한다. 권한은 resource:action 형식의 **명시적 화이트리스트**이며 **알 수 없는 권한 키는 기본 거부**한다 — 와일드카드형 권한이 새면 감사 로그 열람 같은 고위험 액션이 조회 권한자에게 흘러간다.

**기준값(statutory_rates)이 비어 있으면 급여 계산이 아예 불가능하다.** 그래서 이 도메인은 두 방향을 함께 강제한다 — 유효기간 겹침을 DB 제약으로 막고, **확인되지 않은 값은 시드하지 않으며 확인자 필드가 빈 행은 미확인으로 간주해 계산을 차단**한다. v1은 자동 누락 점검 배치를 두지 않으므로 배포 전 수동 확인 절차를 필수 운영 항목으로 둔다.

**감사 로그는 수정·삭제가 불가능**하고 정정이 필요하면 새 정정 로그를 추가한다. 내보내기 행위 자체도 감사 대상이다. 전역 계약은 [01_global_rules.md](./01_global_rules.md)를 전제한다.

## SYS-01 플랫폼 RBAC  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-01 | 플랫폼 RBAC 스키마 | system_admins(id · user_id · role ∈ VIEWER·SUPPORT·ADMIN·SUPER_ADMIN · granted_by · expires_at(nullable) · created_at)를 정의하고 (user_id, role)을 유일하게 둔다. 역할 레벨은 VIEWER 1 · SUPPORT 2 · ADMIN 3 · SUPER_ADMIN 4다. **초기 SUPER_ADMIN은 시드가 아니라 서버 기동 시 환경변수 1회성 부트스트랩으로 생성**하며(REQ-TEC-13 — 자격증명을 형상관리에 담지 않는다) 역할 임명 UI는 v1에 두지 않는다 | 플랫폼(SUPER_ADMIN) | P0 |
| REQ-SYS-02 | 권한 화이트리스트 | 권한은 **resource:action 명시적 화이트리스트**로 정의하고 역할별 권한 집합을 정적 상수로 선언한다. **알 수 없는 권한 키는 기본 거부**한다. VIEWER는 workplace·user·subscription·plan·statutory·analytics의 **view와 search만** 가진다 — **analytics:view는 v1 예약이다**(통계 표면 SYS-10 영구 제외 · 대시보드 DSH 이월이라 소비 지점이 없다). SUPPORT는 VIEWER + support:act · user:reset_password · **verification:view/search**(사업장 상세의 사업자 진위확인 이력 조회·검색 — REQ-SYS-04의 검증 결과 열람 축)다. ADMIN은 SUPPORT + user:suspend/unsuspend · workplace:suspend/unsuspend/close · subscription:update · settings:update · audit:view/export · **analytics:export**(조회와 반출을 분리하는 규약을 위해 두는 키이며 **analytics:view와 함께 v1 예약**이다 — 소비 정책이 없다)다. SUPER_ADMIN은 ADMIN + admin:manage · admin:grant_role · user:delete · **system_admin:view**(플랫폼 관리자 목록·권한 부여 현황 조회 — REQ-SYS-01의 부여 이력 열람 축)다. **audit:view/export는 VIEWER에 포함되지 않는다** — 와일드카드형 권한 누출을 차단한다. 검산: VIEWER 9 + SUPPORT 추가 4 + ADMIN 추가 10 + SUPER_ADMIN 추가 4 = **27종**이며 역할별 집합의 상세 열거는 [../05_database/15_system.md](../05_database/15_system.md) system_admins 절이 같은 값을 갖는다 | 시스템 | P0 |
| REQ-SYS-03 | 권한 강제·경계 | 플랫폼 권한 판정 헬퍼(플랫폼 관리자 여부 · 역할 조회 · 권한 보유 여부)를 제공한다. 시스템 웹과 운영 API는 세션과 권한 키를 검증하고 **플랫폼 권한 자체가 없으면 auth.platform_forbidden/403**, **역할별 권한이 부족하면 system.permission_denied/403**으로 구분한다. **사업장 OWNER라도 플랫폼 권한 없이는 접근할 수 없으며** expires_at이 지난 역할은 무효 처리한다 — **만료 판정은 조회 술어와 판정 헬퍼가 수행하고 인덱스 술어에 시각 함수를 넣지 않는다**(부분 인덱스는 IMMUTABLE 술어만 허용한다 — 정본 [../05_database/15_system.md](../05_database/15_system.md)) | 시스템 | P0 |

## SYS-03 사업장 관리  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-04 | 사업장 조회 | VIEWER 이상은 전체 사업장을 상호 · 사업자번호 · 상태 · 구독 소유자 · 검증 결과 · 등록일로 검색·필터·페이지네이션한다(workplace:view/search). **급여·주민번호 등 민감 데이터는 기본 목록에 포함하지 않는다.** 정지·해제·폐쇄 액션은 REQ-SYS-05의 권한을 별도로 요구한다 | 플랫폼(VIEWER) | P0 |
| REQ-SYS-05 | 사업장 정지·해제·강제 폐쇄 | ADMIN 이상은 약관 위반·요금 문제 등 **사유를 필수 입력**해 사업장을 SUSPENDED로 전이·해제하거나 **강제 폐쇄(CLOSED)**한다. **이 강제 폐쇄는 OWNER 자발 폐쇄(REQ-WRK-36)와 별개 경로**이며 OWNER 재인증 없이 사유만으로 수행한다. 정지 시 신규 업무 생성을 차단하고 **OWNER에게 인앱 필수 알림(타입 workplace_suspended)을 보낸다** — 제재 사실을 사용자가 모르면 업무 중단 원인을 찾을 수 없다(REQ-NTF-05). SUPPORT 이상은 지원 목적으로 메타와 일부 로그를 조회하되 **개인정보·급여 원문 접근은 별도 권한과 감사 사유**를 요구한다. 모든 액션은 감사 로그를 남긴다 | 플랫폼(ADMIN) | P0 |

## SYS-04 사용자 관리  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-06 | 사용자 조회 | VIEWER 이상은 사용자 목록 · 계정 상태 · 가입일 · 소속 사업장 수 · 최근 로그인을 검색한다(user:view/search). **민감정보는 마스킹**한다. 제재·복구·삭제 액션은 REQ-SYS-07의 권한을 별도로 요구한다 | 플랫폼(VIEWER) | P0 |
| REQ-SYS-07 | 제재·복구·강제 삭제 | 최소 역할을 액션별로 분리한다 — **보조 비밀번호 재설정(REQ-AUT-15)은 SUPPORT 이상**(user:reset_password) · **계정 정지·해제(REQ-AUT-18 · 사유와 기간 입력 · 정지 즉시 세션 폐기)는 ADMIN 이상**(user:suspend/unsuspend) · **강제 삭제는 SUPER_ADMIN 전용**(user:delete)이다. 강제 삭제는 DELETED 논리 삭제이며 **법정 보존 데이터는 유지**한다. **마지막 SUPER_ADMIN은 정지·삭제할 수 없다** — **system.last_super_admin/409**. 모든 액션은 감사 로그를 남긴다 | 플랫폼(SUPPORT) · 플랫폼(ADMIN) · 플랫폼(SUPER_ADMIN) | P0 |

## SYS-05 구독/요금제 관리  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-08 | 요금제 관리 | **VIEWER 이상은 요금제 목록·한도·버전을 조회**하고(plan:view) **ADMIN 이상만 생성·수정·비활성화**한다(settings:update). **이미 참조된 요금제는 삭제하지 않고 새 버전을 만든다** — 파괴적 변경은 **system.plan_in_use/409**. 한도 변경 시 기존 계정에 미치는 영향(초과 계정 수)을 미리 계산해 표시한다. 공개 요금제 페이지가 읽는 미인증 조회 표면은 REQ-SUB-01이 계약한다 | 플랫폼(VIEWER 조회 · ADMIN 변경) | P1 |
| REQ-SYS-09 | 계정 구독 수동 조정 | **v1의 유료 전환은 수동 처리다.** ADMIN 이상이 계정 구독 등급·상태·만료일·한도를 조정한다. **사유가 필수**이며 조정 시 대상 계정의 소유 사업장 수·한도 초과 여부·등록 가능 여부를 미리 계산해 표시하고 감사 로그를 남긴다. 상태 변경은 OWNER에게 알린다(subscription_notice). PG 자동 결제와 업그레이드 요청 워크플로는 v1에 두지 않으므로 **문의 CTA와 이 경로**로 처리한다 | 플랫폼(ADMIN) | P1 |

## SYS-07 감사 로그  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-10 | 감사 로그 기록 | audit_logs(actor_id · actor_role · action · target_type · target_id · workplace_id · before_value · after_value · reason · ip · user_agent · created_at)에 **INSERT 전용**으로 기록한다. 대상은 모든 관리자 액션 · 권한 변경 · 제재 · 사업장 상태 변경 · **개인정보 접근과 복호화** · 급여/명세서 확정과 정정 · 기준값 변경 · 임포트 확정 · 감사 내보내기다. **사유 필수 액션**은 제재 · 역할변경 · PII 복호화 · 급여 VOID/정정 · 기준값 변경 · 감사 내보내기 · **사업장 폐쇄**(자발·강제) · **계정 구독 수동 조정**(REQ-SYS-09) · **민감 목록 내보내기**(REQ-SYS-17)이다. **before/after에 PII 원문을 저장하지 않는다** — 마스킹 값·참조 ID·변경 분류만 남긴다  **사유(reason) 필수 액션은 전수 17종**이다(정본 [../05_database/15_system.md](../05_database/15_system.md) — 계정/사업장 축 3 · 권한 축 3 · 급여 축 4 · 데이터 축 3 · 개인정보 축 3 · 구독 축 1): 제재 · 역할 변경 · PII 복호화 · 급여 VOID/정정 · 기준값 변경 · 감사 내보내기 · **사업장 폐쇄**(자발·강제) · **최저임금 미달 강행 확정** · **상시근로자 스냅샷 확정·정정** · **임포트 확정** · **근태 마감·재오픈·무효화** · **자기포함 급여 확정** · **초기 SUPER_ADMIN 부트스트랩**(행위자 없는 유일 액션 — actor_id NULL) · **민감 문서 다운로드** · **원좌표 파기 실행**(REQ-PRV-05) · **계정 구독 수동 조정**(REQ-SYS-09) · **민감 목록 내보내기**(REQ-SYS-17 · DSH-06). 사유 없는 기록은 트리거가 거부한다. **action은 자유 문자열이 아니며 코드 집합의 정본은 [../05_database/15_system.md](../05_database/15_system.md)의 action 코드 집합 절**이다 — 트리거가 비교할 값이 없으면 사유 강제가 오타로 우회된다. **강제 삭제(account.delete_forced)를 제재 축에 귀속시킬지는 그 절이 등재한 확인 항목**이며, 되돌릴 수 없는 조치라 사유 필수로 두는 것이 본 문서의 판단이다. **REQ-GLB-17과 대조한 결과는 그 규칙이 든 5항목에 관해 불변**이다 — 그 규칙이 든 5항목 중 급여 VOID·정정 · 근태 마감·재오픈·무효화 · 스냅샷 확정·정정 · 최저임금 미달 강행은 그대로 대응하고, **일반 급여 확정은 사유 필수가 아니며**(매월 반복되는 정상 업무라 사유를 강제하면 고위험 사건의 감사 신호가 희석된다 · 본 REQ의 급여 축 열거도 VOID·정정뿐이다 · 확정의 **기록 자체는 이미 필수**다) **기준값 적용 예외는 별도 항목 없이 최저임금 미달 강행에 귀속**한다(v1에서 기준값 판정을 관리자 확인으로 넘기는 유일한 경로다). 사유가 필요한 급여 확정은 **자기포함 확정과 최저임금 미달 강행 2종**이다 | 시스템 | P1 |
| REQ-SYS-11 | 감사 조회·불변·내보내기 | ADMIN 이상은 기간 · 행위자 · 대상 · 액션 · 사업장으로 검색하고 CSV로 내보낸다(audit:view/export). **사업장 OWNER·MANAGER는 자기 사업장 행 중 도메인 이력 액션만** 보며 그 화이트리스트의 정본은 [../05_database/15_system.md](../05_database/15_system.md)다 — **개인정보 접근·플랫폼 제재·내보내기 액션은 자기 사업장 행이어도 열지 않는다**. **감사 로그는 수정·삭제가 불가능**하며 정정이 필요하면 새 정정 로그를 추가한다. **내보내기 다운로드 이력 자체를 별도 감사 로그로 남긴다.** 내보내기는 1회용 토큰과 만료를 적용하고 권한·필터 범위 위반은 **export.forbidden/403**, 미완료 작업 조회는 **export.not_ready/409**, 토큰 만료는 **export.expired/410**, 생성 실패는 **export.failed/500**이다 | 플랫폼(ADMIN) | P1 |

## SYS-08 기준값 관리  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-12 | 기준값 스키마·카테고리 | statutory_rates(category · key · value · effective_from · effective_to · version · source_url · confirmed_at · confirmed_by)로 관리한다. **이 테이블이 비어 있으면 급여 계산이 아예 불가능하다.** v1 카테고리는 최저임금 · 최저임금 산입범위 · 국민연금 요율 · 건강보험 요율 · 장기요양 요율 · 고용보험 요율 · 산재보험 요율 · 보수월액 상하한 · 보험별 보수 포함 매핑 · 근로소득 간이세액표 · 비과세 한도 · 가산율 · 관공서 공휴일 · 단수(반올림) 규칙 · 규모별 정책 · 통상임금 규칙 · 근로시간 한도 · **통상근로자 소정근로시간**(단시간 비례 산정의 분모 — REQ-LEV-05) · **신고·납부 기한 규칙**(원천세 납부 주기별 기한 · 금품청산 14일 · 이직확인서 10일 · 4대보험 신고 기한 — REQ-TAX 계열 · **검증 대기 자동 정지 기한 14일**(제품 파라미터 — REQ-WRK-08))의 **19종**이다. **값 집합의 정본은 statutory_rates의 category CHECK 19값**([../05_database/15_system.md](../05_database/15_system.md))이며 **key는 lower_snake이고 조회 축이 둘 이상인 카테고리는 콜론으로 축을 이어 붙인다**(합성 규약의 정본도 같은 문서다) — 조회 계약의 정본은 [01_global_rules.md](./01_global_rules.md) §1.3이다 — **목록에 없는 값은 CHECK가 거부하므로 저장 자체가 되지 않는다**. 주휴 산정에 필요한 값은 별도 카테고리를 두지 않고 규모별 정책(주휴일 조문키)·통상임금 규칙(주휴시간 산입)·단수(반올림) 규칙이 나눠 가지며, 연소자·단시간 적용 기준은 근로시간 한도가, 상시근로자 산정 정책은 규모별 정책이 흡수한다. **일용 세액은 일용 급여 계산이 v1에 없으므로 카테고리를 만들지 않는다**. **유효기간 겹침은 DB 제약으로 차단**한다 — **system.statutory_rate_overlap/409**. **국민연금 요율은 단계 인상이므로 연도별 버전을 선등록**해야 하고, 국민연금 기준소득월액 상하한은 **매년 7월에 경계가 바뀌므로 연 단위가 아니라 7월 기준으로 분할 등록**한다. **기준값 행 자체는 법령 공개 정보라 조회가 공개이고(계산 엔진이 서버 API로 조회한다) 확인 상태(source_url · source_name · confirmed_by · confirmed_at)는 VIEWER 이상에게만 반환**한다(statutory:view) — 조회를 열어야 미확인 행과 누락 구간을 운영 전원이 발견할 수 있고, 미확인 여부는 운영 정보라 공개 표면에 싣지 않는다(정본 [../05_database/15_system.md](../05_database/15_system.md)). **ADMIN 이상만 등록·수정**한다(settings:update) | 플랫폼(VIEWER 확인 상태 조회 · ADMIN 변경) · 시스템 | P1 |
| REQ-SYS-13 | 발효일 적용·누락 차단 | 급여·연차·명세서 계산은 **연도가 아니라 귀속 기준일**에 유효한 기준값 버전을 선택하고 **결과에 기준값 행 ID를 동결 저장**한다(간이세액표는 지급일 기준이다). **귀속기간에 필요한 기준값이 없으면 해당 작업을 차단**한다 — payroll.missing_reference_value/422. **기준값 변경은 과거 확정 결과에 자동 소급하지 않는다**(REQ-GLB-10) | 시스템 | P1 |
| REQ-SYS-14 | 기준값 변경 권한·이력 | settings:update 권한자만 변경하며 감사 로그에 전후값과 발효일을 남긴다. 연도 갱신(최저임금·요율·공휴일·세액표)을 정기 반영한다. **v1은 자동 누락 점검 배치를 두지 않으므로 배포 전 수동 확인 절차를 필수 운영 항목으로 둔다** — 요율이 비어 있으면 급여가 통째로 틀린다. **확인되지 않은 값은 시드하지 않는다** | 플랫폼(ADMIN) | P1 |

## SYS-11 약관/개인정보/위치정보 문서 관리  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-15 | 약관·개인정보·위치정보 문서 관리 | terms_documents(kind ∈ TERMS·PRIVACY·LOCATION · version · title · body · effective_from · is_active)에 버전을 작성·활성화한다. **위치정보 문서는 별도 kind로 관리**한다(위치정보법 §18 별도 동의). 가입 동의(REQ-AUT-03)가 참조하는 **활성 버전이 kind별로 정확히 1개** 존재함을 보장하며 활성 문서 부재는 **system.terms_not_found/404**다. 동일 (kind, version) 중복은 **system.terms_version_conflict/409**. **이미 동의에 참조된 버전은 삭제하지 않고 비활성화만 허용**하며 삭제 시도는 **system.terms_in_use/409**다. **문서 본문은 시드하지 않는다** — 법무 검토를 거친 3종(TERMS·PRIVACY·LOCATION)을 **출시 전 운영 절차로 등록**하며, 등록 전에는 **필수 2종(TERMS·PRIVACY)의 활성 버전 부재로 가입이 차단**되는 것이 정상 동작이다(system.terms_not_found/404 · auth.consent_required/422). **LOCATION 활성본 부재는 가입을 막지 않고 GPS 체크인만 잠근다**(D-19). 마이그레이션 시드에 약관 본문을 넣지 않는 이유는 법정 문안이 코드 릴리스 주기와 분리되어야 하기 때문이다(REQ-TEC-13) | 플랫폼(ADMIN) · 시스템 | P1 |
| REQ-SYS-16 | 문서 개정·재동의 | 개정 시 새 버전을 발효하고 **재동의 흐름을 트리거**한다. **필수 2종(TERMS·PRIVACY)**의 재동의 미완료 사용자는 다음 로그인·주요 액션에서 동의 화면으로 유도하며 미동의 상태는 **auth.consent_required/422**로 차단한다. **LOCATION 개정은 진입을 차단하지 않는다** — 새 버전 동의 전까지 GPS 체크인만 privacy.location_consent_required/403으로 다시 잠긴다(D-19). **재동의는 새 버전에 대한 신규 동의 이력으로 기록**하며 기존 이력을 덮어쓰지 않는다(REQ-PRV-02). **재동의 게이트(미인증 — 컨텍스트 발급 전)의 동의 제출은 로그인 재수행에 동봉해 기록한다**(REQ-AUT-08 · REQ-PRV-02) — 미인증 상태에서 본인 전용 동의 표면을 호출하지 않는다 | 플랫폼(ADMIN) · 시스템 | P1 |

## DSH-06 리포트 내보내기 — 시스템 콘솔 목록  P2

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SYS-17 | 시스템 콘솔 목록 내보내기 | 시스템 웹의 목록 표를 **화면에 걸린 검색 · 필터 · 정렬 · 표시 열 그대로** XLSX로 내려받는다. 발급(POST /v1/system/list-exports)은 **그 목록 조회 표면의 플랫폼 권한 키를 그대로** 판정한다 — 내보내기 전용 키를 두지 않고 **analytics:export를 쓰지 않는다**(통계 산출물의 반출 축이다). 발급은 조건을 1회용 토큰에 봉인하고 **파일은 다운로드 순간 서버가 만들며 저장하지 않는다.** 열은 목록이 선언한 화이트리스트 안에서만 고른다. **민감 목록**(연락처 · 이메일처럼 개인 식별 · 연락 정보가 한 파일에 모이는 목록)은 **사유 필수**이고 list.export_sensitive로, 그 밖은 list.export로 **다운로드 시점에** 기록한다 — workplace_id가 비어 사업장 관리자에게 열리지 않는다. 등재된 사업장 목록을 이 표면에서 요청하면 **export.forbidden/403**, 토큰의 없음 · 만료 · 재사용 · 소유자 불일치는 **export.expired/410**, 파일 작성 실패는 **export.failed/500**이다. **감사 로그는 이 경로로 내보내지 않는다**(REQ-SYS-11의 비동기 CSV가 그 자리다). 계약 정본은 [../06_api/04_workplace.md](../06_api/04_workplace.md) #35 · #36이고 사업장 목록 축의 요구사항은 [03_workplace.md](./03_workplace.md)의 DSH-06 절이다 | 플랫폼(목록의 조회 권한) | P2 |

## 미확인 — 확인 전 시드 금지

기준값 운영의 전제다. **확인되지 않은 값은 statutory_rates에 시드하지 않으며, 확인자(confirmed_by)가 빈 행은 미확인으로 간주해 계산을 차단한다**(REQ-GLB-09 · REQ-SYS-14).

**목록과 건수의 정본은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) 미확인 절**이며, 아래는 이 도메인에 걸리는 항목의 상세다.

| 항목 | 내용 | 영향 |
|------|------|------|
| 기준값 실데이터 미확보 | 당해 연도 근로소득 간이세액표 실데이터와 건강보험 보수월액 상한 등이 미확보다. **확보 전까지 기준값 누락 차단에 맡기고 추정값을 시드하지 않는다** | 시드하면 전 직원의 소득세·건강보험 공제액이 틀린다 |
| legacy 시드값 이관 금지 | 이전 설계의 마이그레이션 시드는 발효일을 당해 연도로 두고 과거 연도 값을 등록해 다수가 오류였다. **시드도, 그 시드를 기대값으로 박은 테스트도 이관하지 않는다.** 실측값은 별도 확인 경로로 확보해 source_url과 confirmed_by를 함께 등록한다 | 최저임금을 낮은 값으로 검증하면 실제 미달 사업장을 통과시켜 사용자를 법 위반에 노출시킨다 |
| 자동 누락 점검 배치 부재 | 기준값 커버리지 점검 정기작업을 v1에 두지 않는다. **수동 확인 절차를 운영 문서에 필수 항목으로 등재**해 대체한다(REQ-SYS-14) | 요율 한 줄이 비면 그 귀속월 급여가 통째로 차단되거나(정상) 잘못 계산된다(시드했을 경우) |

## 관련 테이블

| 테이블 | 역할 |
|--------|------|
| system_admins | 플랫폼 역할 — (user_id, role) 유일 · expires_at 만료 처리(REQ-SYS-01) |
| audit_logs | 감사 원장 — INSERT 전용 · 사유 필수 액션 · **action 코드 집합과 사업장 관리자 개방 집합의 정본은 05_database/15_system.md** · PII 원문 저장 금지(REQ-SYS-10·11) |
| statutory_rates | 기준값 — **category 19종** · key(다축은 콜론 합성) · effective 기간 겹침 차단 · source_url · confirmed_by(REQ-SYS-12) |
| income_tax_table_entries | 간이세액표 행 — 지급일 기준 버전 선택(REQ-SYS-12 · REQ-PAY-24) |
| terms_documents | 약관·개인정보·위치정보 문서 버전 — kind별 활성 1개 보장(REQ-SYS-15) |
| user_consents | 동의 이력 — 문서 버전 참조로 삭제를 막는 근거(REQ-SYS-15 · REQ-PRV-02) |
| plans · subscriptions | 요금제 관리·계정 구독 수동 조정 대상(REQ-SYS-08·09) |
| export_jobs | 감사 내보내기 작업 — 상태 · 1회용 토큰 · 만료(REQ-SYS-11) |
| users · workplaces | 제재·정지·강제 폐쇄의 대상(REQ-SYS-05·07) |

## 관련 화면

| 화면 코드 | 화면명 |
|-----------|--------|
| PUB-LANDING | 서비스 소개 랜딩 |
| PUB-LEGAL | 약관·개인정보·위치정보 문서 |
| PUB-CONSENT | 약관·개인정보·위치정보 동의 |
| APP-PRIVACY | 개인정보·위치정보 관리 |
| SYS-WORKPLACES | 사업장 관리 |
| SYS-USERS | 사용자 관리 |
| SYS-SUBSCRIPTIONS | 구독·요금제 관리 |
| SYS-RATES | 기준값 관리 |
| SYS-POLICY | 규모별 적용 정책 관리 |
| SYS-AUDIT | 감사 로그 |
| SYS-TERMS | 약관·개인정보·위치정보 문서 관리 |

검산: 11본 — PUB 3 · APP 1 · SYS 7. **플랫폼 RBAC(SYS-01)는 시스템 웹 7화면 전체의 접근 게이트라 특정 화면에 귀속되지 않는 (전역) 축**이며, 위 SYS 7본이 그 판정의 적용 대상 전량이다. **역할 임명·회수 화면을 두지 않는다**(SYS-02 이월) — 초기 SUPER_ADMIN은 서버 기동 시 환경변수 1회성 부트스트랩으로 만든다(시드 아님).

기능→화면 전수 매핑 정본은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)다.

## 에러 코드

| 에러 코드 | HTTP | 발생 조건 |
|-----------|:--:|----------|
| system.permission_denied | 403 | 역할별 권한 키 미충족 — 플랫폼 권한은 보유(REQ-SYS-03) |
| system.last_super_admin | 409 | 마지막 SUPER_ADMIN 정지·삭제·회수 차단(REQ-AUT-19 · REQ-SYS-07) |
| system.plan_in_use | 409 | 참조된 요금제의 파괴적 변경·삭제(REQ-SUB-02 · REQ-SYS-08) |
| system.statutory_rate_overlap | 409 | 기준값 (category, key) 유효기간 겹침 — btree_gist EXCLUDE 제약이 강제한다(REQ-SYS-12 · REQ-GLB-08) |
| system.terms_version_conflict | 409 | 동일 (kind, version) 문서 중복(REQ-SYS-15) |
| system.terms_not_found | 404 | 활성 약관·개인정보·위치정보 문서 없음(REQ-SYS-15) |
| system.terms_in_use | 409 | 이미 동의에 참조된 문서 버전 삭제 시도(REQ-SYS-15) |
| export.forbidden | 403 | 내보내기 권한·필터 범위 위반(REQ-SYS-11 · REQ-SYS-17) |
| export.not_ready | 409 | 내보내기 작업 미완료(REQ-SYS-11) |
| export.expired | 410 | 내보내기 다운로드 토큰 만료·자동 삭제(REQ-SYS-11 · REQ-SYS-17) |
| export.failed | 500 | 내보내기 파일 생성 실패(REQ-SYS-11 · REQ-SYS-17) |

검산: system 7 + export 4 = **11종**. 플랫폼 권한 자체가 없는 경우는 auth.platform_forbidden/403이며 정의처는 [02_auth.md](./02_auth.md)다.

## 관련 문서

- [../02_features/12_system.md](../02_features/12_system.md) — SYS 7기능 명세 정본
- [01_global_rules.md](./01_global_rules.md) — 기준값 조회 계약·누락 차단·감사 로그(§1.3 · REQ-GLB-09·17)
- [02_auth.md](./02_auth.md) — 계정 상태 전이·보조 재설정·플랫폼 진입 판정
- [12_subscription.md](./12_subscription.md) — 요금제·한도의 소비 계약
- [10_compliance.md](./10_compliance.md) — SIZE_POLICY 정책값의 소비 계약
- [14_privacy.md](./14_privacy.md) — 동의 이력·문서 버전 참조
- [../10_security/07_platform_rbac.md](../10_security/07_platform_rbac.md) — 플랫폼 RBAC 보안 설계
- [../05_database/15_system.md](../05_database/15_system.md) — 시스템 테이블 명세
- [../06_api/14_system.md](../06_api/14_system.md) — 시스템 운영 API 표면
