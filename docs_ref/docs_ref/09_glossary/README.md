# 09_glossary — 용어·코드 사전

> **대상**: insadesk 설계 문서군 전체의 단일 참조점 — 도메인 용어 · 에러 코드 · enum/상태 머신 · ID 규약 · 단위/시간
> **작성일**: 2026-08-03
> **개정일**: 2026-09-16 — 인용 갱신 — v1 기능 94 → **98**(D-23 · 정본 [../02_features/README.md](../02_features/README.md)) · 기능 접두사 13 → **14종**(DSH). **13도메인은 불변**이다 — DSH는 도메인을 세우지 않는다
> **개정일**: 2026-09-10 — 인용 갱신 — 에러 코드 119 → **120종**(workplace.mgmt_no_required/422 신설 — 신고자료의 빈 관리번호 계열. 채번 정본 [02_error_codes.md](./02_error_codes.md)). **16네임스페이스는 불변**이다 — 발생 표면은 TAX 이지만 부재한 값이 사업장의 것이라 workplace 가 갖는다
> **개정일**: 2026-09-09 — 인용 표에서 **수치를 걷고 정본을 가리킨다** — 이 줄이 "인용 — 정본"이라고 스스로 표시하면서 **한 줄에 낡은 값을 둘** 담고 있었다(나눗셈 13 → 정본 14 · 기준값 17카테고리 → 정본 19. 후자는 2026-08-09에 정본이 고쳐진 뒤 한 달을 그대로 지났다). **미러가 값을 다시 세면 정본이 움직일 때마다 조용히 어긋나므로**, 세는 자리를 정본 하나로 두고 여기서는 무엇을 가리키는지만 적는다. **에러 코드 119종은 본 폴더가 정본이라 그대로 센다**
> **개정일**: 2026-09-07 — 인용 갱신 — **V0711**(idempotency_records 신설)로 테이블 60 → **61종** · RLS 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46** · **DELETE 4는 불변**) · 유일성 강제 59 → **60** · PK 60 → **61**. 정본 [../05_database/README.md](../05_database/README.md). 나머지 수치는 전건 불변
> **개정일**: 2026-09-06 — 파생 집계 정합 — 에러 코드 118 → **119종** 4자리(파일 목차 · 세는 기준 문단 · 고정 기준 표 · 산정 기준 각주). 채번 정본 [02_error_codes.md](./02_error_codes.md)는 2026-08-21 workplace.business_unit_overlap/409 신설로 이미 119였는데 **같은 폴더의 인덱스가 118에 멈춰 있었다** · 각주의 인용처 열거를 실제 상태에 맞게 정정(../README.md · 04_id_conventions.md 모두 119). 도메인 용어 154 · enum 33/132 · 상태 머신 9는 불변
> **개정일**: 2026-08-09 — 전역 수치 정합 — 테이블 58 → **60종** 인용 갱신(3단계 누락분)
> **원천**: docs_ref2/requirements_p0.md(에러코드 카탈로그 · 상태 머신 · 전역 규칙) · docs_ref2/schema_p0.md(enum 목록 · 설계 원칙) · docs_ref2/features.md(도메인 개념·권한 모델) · [../README.md](../README.md) 고정 기준

insadesk 문서 전반에서 반복 인용되는 **도메인 용어 · 에러 코드 · enum과 상태 머신 · ID 규약 · 단위와 시간 규칙**을 한곳에 모은 사전이다. 다른 문서가 용어·코드·식별자를 각자 정의하지 않고 본 폴더를 가리킬 수 있도록 정의는 여기서만 단일하게 유지한다.

**노무·세무 도메인은 같은 대상에 이름이 여럿 붙는 영역**이다 — 임금명세서와 급여명세서, 마감과 확정, 기준값과 기준율이 실무에서 섞여 쓰인다. 문서군이 그 혼용을 그대로 옮기면 구현자가 서로 다른 두 개념으로 읽는다. 그래서 본 폴더는 정의뿐 아니라 **표기 자체의 정본** 역할을 함께 진다.

## 파일 목차

| 파일 | 내용 |
|------|------|
| [01_domain_terms.md](./01_domain_terms.md) | 도메인 용어 **154항목** — 계정·권한·테넌시 · 사업장·검증 · 근태·시간 · 휴가·연차 · 급여·임금 · 공제·세무 · 명세서·보존 · 법정 준수·규모 · 개인정보·위치정보 · 플랫폼·기술 **10그룹**(그룹 안은 개념 의존 순서) + **표기 규칙** |
| [02_error_codes.md](./02_error_codes.md) | {domain}.{snake_case} 에러 코드 **전수 정본 — 120종 · 16네임스페이스** + HTTP 상태 규약(403과 422의 구분) + 네임스페이스 배정 규칙 + 도메인별·상태별 집계 + 폐기 코드 |
| [03_enums_state_machines.md](./03_enums_state_machines.md) | **enum 33종 전값(값 132)** + **상태 머신 9종**(계정 · 멤버십 · 초대 · 사업장 · 근로계약 · 명세서 · 구독 · 데이터 임포트 · 직원 재직)의 mermaid 전이도와 전이 조건·가드 표 |
| [04_id_conventions.md](./04_id_conventions.md) | 기능ID · REQ · 화면 코드 · 에러 코드 · ADR · D · AC · 테이블 · enum · 마이그레이션 ID 형식과 채번 정본 · 결번 규칙 · 기능 접두사 14종 |
| [05_units_and_time.md](./05_units_and_time.md) | 단위(금액 bigint 원 · 기간 integer 분 · 휴가 numeric 0.1일 · 좌표) · 부동소수점 금지와 역직렬화 규약 · UTC 저장/KST 경계 · **기준일 3종**(귀속 근로일 · 귀속월 · 지급일) · 단수 처리 요약 |

## 이 사전의 원칙

- **중복 정의 금지** — 용어·코드·식별자·단위의 정의는 본 폴더에만 둔다. 다른 문서는 정의를 다시 쓰지 않고 링크한다. 값이 문서 간 어긋나면 본 사전이 정본이다.
- **에러 코드는 단일 채번** — 새 코드는 [02_error_codes.md](./02_error_codes.md)에서만 만든다. [../06_api/02_errors.md](../06_api/02_errors.md)는 미러이며 미러에서 신설·개명·폐기하지 않는다. [../03_requirements](../03_requirements/README.md) 도메인 파일의 에러 절은 그 도메인이 정의·발생시키는 부분집합의 도메인 관점 뷰이며 전수를 넘지 않는다.
- **용어 표기가 정본이다** — [01_domain_terms.md](./01_domain_terms.md)의 표제어와 표기 규칙 표가 전 문서군의 표기를 구속한다. 동의어를 만들지 않으며, 새 용어를 쓰려면 먼저 여기 등재한다.
- **enum 값은 원천 문자 그대로** — enum 타입명·값은 docs_ref2/schema_p0.md의 문자열을 그대로 옮긴다. 한글 라벨은 화면 표시용이며 값 자체가 아니다.
- **세는 기준이 둘이면 기준을 밝힌다** — 에러 코드는 원천 카탈로그 절의 행 수(105)와 유효 코드 전수(119)가 다르다. 두 값은 어긋난 것이 아니라 산출 범위가 다르며, 본 폴더는 **v1 서버가 발생시킬 수 있는 유효 코드**를 정본으로 삼는다.
- **테스트 케이스 전용 채번 체계를 두지 않는다** — 검증 식별자는 인수기준 AC-NN([../03_requirements/16_acceptance_criteria.md](../03_requirements/16_acceptance_criteria.md))만 쓴다.

## 고정 기준

아래 표는 **본 폴더가 확정하는 값**과 **타 폴더 정본을 인용하는 값**이 섞여 있다. 인용 값이 정본과 어긋나면 정본을 따르고 본 표를 같은 변경 단위에서 고친다.

| 항목 | 기준 | 정본 |
|------|------|------|
| 도메인 용어 | **154항목 · 10그룹** | **본 폴더** — [01_domain_terms.md](./01_domain_terms.md) |
| 에러 코드 | **120종 · 16네임스페이스**(폐기 2종 별도) | **본 폴더** — [02_error_codes.md](./02_error_codes.md) |
| enum | **33종 · 값 132** | **본 폴더** — [03_enums_state_machines.md](./03_enums_state_machines.md) |
| 상태 머신 | **9종** | **본 폴더** — [03_enums_state_machines.md](./03_enums_state_machines.md) |
| ID 형식·채번 규약 | 10종 + 기능 접두사 14종 | **본 폴더** — [04_id_conventions.md](./04_id_conventions.md) |
| 단위·시간·기준일 | 금액 bigint 원 · 기간 integer 분 · 휴가 numeric 0.1일 · UTC 저장/KST 경계 · 기준일 3종 | **본 폴더** — [05_units_and_time.md](./05_units_and_time.md) |
| 반올림 규칙 · 나눗셈 지점 · 기준값 카테고리 · 결과 동결 | **수치를 여기서 다시 세지 않는다** — 종수·지점 수·카테고리 수는 정본이 갖는다 | 인용 — [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) §1.1~§1.4 |
| v1 기능 | **98기능 · 13도메인**(접두사 14 — DSH는 도메인 파일이 없다) | 인용 — [../02_features/README.md](../02_features/README.md) |
| 요구사항 | REQ 총수 | 인용 — [../03_requirements/README.md](../03_requirements/README.md) |
| 테이블 | **61종** | 인용 — [../05_database/README.md](../05_database/README.md) |
| 화면 | 화면 인벤토리 | 인용 — [../07_screen/README.md](../07_screen/README.md) |
| 사업장 역할 · 플랫폼 역할 · 요금제 | OWNER ⊃ MANAGER ⊃ STAFF · VIEWER(1)·SUPPORT(2)·ADMIN(3)·SUPER_ADMIN(4) · FREE·PRO·ULTRA | 인용 — [../README.md](../README.md) 고정 기준 |
| 정기작업 | v1 필수 **8건** | 인용 — [../02_features/15_scheduled_jobs.md](../02_features/15_scheduled_jobs.md) |

> **에러 코드 수의 산정 기준** — 원천 카탈로그 절의 행 수는 105(담당 94 + 타 도메인 참조 9 + 폐기 2)이나, 본 문서군의 정본은 **유효 코드 전수 120종**이다. [../README.md](../README.md) 고정 기준과 [04_id_conventions.md](./04_id_conventions.md)도 120을 인용한다(2026-09-10 재정렬 완료). 산정 근거는 [02_error_codes.md](./02_error_codes.md) 종수 산정 기준 절에 있다.

## 다른 폴더와의 경계

같은 사실을 두 문서가 다르게 말하지 않도록 소유 관계를 명시한다.

| 사실 | 본 폴더 | 상대 문서 | 관계 |
|------|--------|----------|------|
| 에러 코드 집합·HTTP 상태 | [02_error_codes.md](./02_error_codes.md) | [../06_api/02_errors.md](../06_api/02_errors.md) | 정본 → 미러 |
| 에러 코드의 도메인별 발생 조건 | 발생 조건 한 줄 | [../03_requirements](../03_requirements/README.md) 도메인 파일 | 정본(집합) ↔ 상세(발생 관점 부분집합) |
| enum 값 집합·상태 전이 | [03_enums_state_machines.md](./03_enums_state_machines.md) | [../05_database/07_constraints_integrity.md](../05_database/07_constraints_integrity.md) | 정본 → DB 타입 강제 관점 미러 |
| 반올림·나눗셈·기준값 카탈로그 | 요약과 링크만 | [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) | 인용 ← 정본. **본 폴더에서 재정의하지 않는다** |
| 테이블·컬럼 타입 | 단위 해석 계약 | [../05_database](../05_database/README.md) | 인용 ← 정본 |
| 기능명·우선순위 | 인용하지 않는다 | [../02_features](../02_features/README.md) | 정본은 02_features |

## 관련 문서

- 문서 지도·고정 기준·전역 불변식 → [../README.md](../README.md)
- 작성·검수 지침 → [../CLAUDE.md](../CLAUDE.md)
- 전역 규칙(REQ-GLB)·반올림·나눗셈·기준값·동결 → [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md)
- 기능 채번 정본 → [../02_features/README.md](../02_features/README.md)
- 테이블·제약·RLS 정본 → [../05_database/README.md](../05_database/README.md)
- API 에러 응답 규약(본 폴더의 미러) → [../06_api/02_errors.md](../06_api/02_errors.md)
