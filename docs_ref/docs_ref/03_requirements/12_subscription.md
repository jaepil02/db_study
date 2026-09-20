# REQ-SUB — 구독 요구사항

> **대상**: 요금제 스키마와 시드·버전 관리 · 계정 단위 구독 레코드와 상태 · 등급/사용량 조회 · 사업장 등록 한도 강제 · 직원 한도 강제 · 한도 표시와 초과 상태 · 구독 상태 일일 점검 · 만료 처리와 법정 조회 보장
> **작성일**: 2026-08-03
> **개정일**: 2026-08-08 — DB 커버리지 감사 반영 — 등급별 활성 행 1개와 발효일 유일을 제약 계약으로 승격 · 참조된 요금제의 파괴적 변경 차단을 가드로 명시 · 구독 미설정 계정의 FREE 판정 규칙 등재 · 사업장 등록 한도의 DB 백스톱 등재
> **개정일**: 2026-08-08 — 요금제 참조 축을 plan_code → **plan_id**(plans 행 참조)로 정정하고 REQ-SUB-01에 (code, version) 복합 유일 + effective_from 구간 · 3등급 고정 계약을 명문화(정본 05_database/14_subscription.md)
> **개정일**: 2026-08-08 — v1은 기능 플래그를 쓰지 않고 등급 차이가 한도 2축뿐임을 명문화(upgrade_required 발생 지점 확정) · 공개 요금제 페이지 렌더링 서술을 프리렌더 셸 + 클라이언트 조회로 정정(D-20)
> **원천**: docs_ref2/requirements_p0.md SUB 절(REQ-SUB-01~09) · docs_ref2/features_p0.md(SUB 5기능) · docs_ref2/schema_p0.md subscription 2테이블

구독은 **계정 단위**다(사업장 단위가 아니다). 한도는 OWNER 측 두 축에만 적용된다 — **소유 사업장 수**와 **사업장당 활성 멤버 수**다. STAFF·MANAGER로서의 타 사업장 소속은 본인 구독과 무관하게 무료·무제한이며, 이것이 1계정 대 N사업장 구조의 전제다.

**v1의 유료 전환은 수동 처리**다. PG 자동 결제와 업그레이드 요청 워크플로를 v1에 두지 않으므로, 등급 조정은 플랫폼 관리자의 수동 조정 경로(REQ-SYS-09)로 처리하고 사용자 화면은 문의 CTA를 노출한다.

한 가지 원칙이 이 도메인의 상한을 정한다 — **구독 만료를 이유로 법정 의무 이행을 막지 않는다.** 만료는 신규 생성과 유료 기능만 차단하고 기존 급여·명세서 등 법정 보존 데이터의 조회·교부는 그대로 열어 둔다. 전역 계약은 [01_global_rules.md](./01_global_rules.md)를 전제한다.

## SUB-01 요금제 정의  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SUB-01 | 요금제 스키마 | plans(code · name · max_owned_workplaces · max_staff_per_workplace · price · features(json) · version · effective_from · display_order · is_active)를 정의한다. **유일 키는 (code, version) 복합 유일이고 버전 구간의 시작은 effective_from**이며 **(code, effective_from)도 유일**하다 — 구간이 다음 발효일까지로 파생되므로 시작일이 유일하면 겹침이 성립하지 않는다. **같은 code의 is_active 행은 정확히 1개이며 부분 유니크가 그것을 강제한다** — 활성 행이 둘이면 신규 가입과 FREE 간주 판정이 어느 한도를 쓸지 결정할 수 없다. **등급 코드는 FREE · PRO · ULTRA 3등급 고정**이다 — 개정은 등급을 늘리지 않고 **같은 code의 새 버전 행**으로 한다(정본 [../05_database/14_subscription.md](../05_database/14_subscription.md)). **max_owned_workplaces**는 OWNER로 등록 가능한 사업장 수, **max_staff_per_workplace**는 사업장당 활성 멤버(OWNER·MANAGER·STAFF 전원) 수 한도다. **어떤 등급도 max_staff_per_workplace가 30을 초과할 수 없다**(상품 전역 상한). **활성 요금제 목록과 등급별 한도는 미인증 조회를 허용한다** — 공개 요금제 페이지가 **프리렌더된 셸 위에서 클라이언트 조회로 최신 수치를 채우고**(D-20) 가입 전 사용자가 한도를 비교해야 하므로 세션을 요구하지 않는다(D-02 — 목적은 유효하고 수단만 개정됐다). 미인증 응답은 **is_active인 요금제의 code · name · 한도 2축 · price · display_order로 한정**하며 내부 운영 필드(version · effective_from · features 상세)와 비활성 요금제를 노출하지 않는다 — **RLS는 컬럼과 행을 좁히지 않으므로 이 한정은 서버 API가 강제한다**(정본 [../05_database/14_subscription.md](../05_database/14_subscription.md)). **v1은 plans.features 기능 플래그를 쓰지 않는다** — 등급 차이는 **한도 2축(소유 사업장 수 · 사업장당 인원 수)뿐**이며 features는 v1.1 확장 지점으로 비워 둔다. 생성·수정·비활성화는 플랫폼(ADMIN) 전용이다(REQ-SYS-08) | 플랫폼(ADMIN) · 목록 조회는 미인증 | P0 |
| REQ-SUB-02 | 기본 시드·버전 관리 | 최초 배포 시 **FREE(사업장 1 · 멤버 5) · PRO(사업장 3 · 멤버 15) · ULTRA(사업장 5 · 멤버 30)** 3등급을 시드한다(가격은 운영 설정값이다). 요금제 변경은 **새 버전 + effective_from**으로 관리해 과거 구독에 적용된 한도를 추적 가능하게 한다. **이미 참조된 요금제는 삭제하지 않는다** — 파괴적 변경은 **system.plan_in_use/409**이며 **guard_plan_immutable()이 code·version·effective_from·한도 2축·price의 UPDATE를 차단하고 name·display_order·is_active만 연다**(정본 [../05_database/14_subscription.md](../05_database/14_subscription.md)) | 플랫폼(ADMIN) · 시스템 | P0 |

## SUB-02 구독 등급(계정)  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SUB-03 | 계정 구독 레코드·상태 | subscriptions(user_id UNIQUE · **plan_id**(plans 행 참조 — 가입 시점 code + version 행을 고정한다) · status ∈ TRIAL·ACTIVE·PAST_DUE·EXPIRED·CANCELLED · started_at · expires_at(nullable) · memo)를 **계정 단위**로 관리한다. **구독이 설정되지 않은 계정은 FREE로 간주**하며, 한도 판정이 적용하는 행은 **code = 'FREE' AND is_active인 plans 행**이다(부분 유니크가 그 행의 유일성을 보장한다 — 정본 [../05_database/14_subscription.md](../05_database/14_subscription.md)). **EXPIRED는 신규 사업장 등록을 차단**한다. 존재하지 않는 요금제 참조는 **subscription.plan_not_found/404** | 본인 · 플랫폼(ADMIN) | P0 |
| REQ-SUB-04 | 등급·사용량 조회 | 본인은 구독 등급·한도·현재 사용량·상태·만료일을 조회한다. 플랫폼 관리자는 사용자별 구독을 검색한다. **게이팅과 UI가 동일한 사용량 산출 헬퍼를 공유**해 표시와 강제가 어긋나지 않게 한다 | 본인 · 플랫폼(VIEWER) | P0 |

## SUB-03 사업장 등록 게이팅  P0

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SUB-05 | 사업장 등록 한도 강제 | 사업장 등록 시 소유 사업장 수 < max_owned_workplaces를 **서버에서 강제**한다. 초과 시 **subscription.workplace_limit_exceeded/402**와 함께 현재 사용량·필요 등급·업그레이드 안내를 반환한다. **동시 다중 생성은 사용자 행 잠금으로 직렬화**해 우회를 방지하고 **guard_workplace_cap()이 DB 백스톱으로 같은 판정을 재수행한다**(인원 한도의 guard_member_cap()과 같은 층 — 정본 [../05_database/14_subscription.md](../05_database/14_subscription.md))(REQ-GLB-15). **권한 부족(403)과 한도 초과(402)를 분리**한다 | 서버 | P0 |

## SUB-04 이용 한도  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SUB-06 | 직원 한도 강제 | **모든 사업장은 활성 멤버 30명을 절대 상한**으로 하며 요금제별 한도는 그 이하다. **초대 발송 시점과 수락 시점 양쪽**에서 활성 멤버 수 < max_staff_per_workplace(OWNER 구독 기준)를 서버에서 강제한다(REQ-WRK-14·16). 초과는 **subscription.staff_limit_exceeded/402**다. **동시 다중 수락은 사업장 행 잠금으로 직렬화**한다 | 서버 | P1 |
| REQ-SUB-07 | 한도 표시·초과 상태 | 사업장·계정 화면에 사용량 대비 한도를 표시하고 임박·초과 시 경고한다. 현재 등급에서 허용되지 않는 실행은 **subscription.upgrade_required/402**로 업그레이드 경로를 안내한다. **v1의 발생 지점은 한도 초과뿐**이다(REQ-SUB-01 — 기능 플래그를 쓰지 않으므로 기능 단위 게이팅이 없다). 따라서 안내 문구는 **어느 한도 축을 어느 등급이 얼마나 허용하는지**를 지목하며, 기능명을 지목하는 분기를 v1에 두지 않는다. **한도 축소로 기존 사용량이 초과되어도 기존 데이터를 삭제하지 않고 신규 생성·초대만 제한**한다(REQ-WRK-31) | 본인 · 시스템 | P1 |

## SUB-05 구독 상태 점검  P1

| 요구사항ID | 요구사항명 | 설명 | 접근 권한 | 우선순위 |
|-----------|-----------|------|----------|----------|
| REQ-SUB-08 | 구독 상태 일일 점검 | 정기작업 **checkSubscriptionExpiry**(매일 00:10 KST)가 체험 종료·구독 만료·수동 부여 종료일을 점검해 상태를 전이한다(TRIAL → EXPIRED · ACTIVE → EXPIRED 등). 작업은 멱등해야 하며 분산락으로 중복 실행을 방지한다(REQ-GLB-14) | 시스템 | P1 |
| REQ-SUB-09 | 만료 처리·법정 조회 보장 | 만료 예정·만료·한도 초과는 OWNER와 플랫폼 관리자에게 알린다(subscription_notice). 만료는 **신규 사업장 등록과 유료 기능 실행을 차단**하되 — v1에 기능 플래그가 없으므로 실제 차단 지점은 **신규 사업장 등록과 한도 소비 행위(초대 수락 포함)**다(REQ-SUB-01) — **기존 급여·명세서 등 법정 보존 데이터의 조회·교부는 차단하지 않는다** — **구독 만료를 이유로 법정 의무 이행을 막으면 안 된다**. 기능 차단은 **subscription.expired/402** | 시스템 | P1 |

## 관련 테이블

| 테이블 | 역할 |
|--------|------|
| plans | 요금제 — 등급별 한도 2축 · version · effective_from · is_active. 참조된 버전은 삭제 불가(REQ-SUB-01·02) |
| subscriptions | 계정 구독 — user_id UNIQUE · **plan_id**(plans 행 참조) · status · expires_at · memo(REQ-SUB-03) |
| workplaces | 소유 사업장 수 산출 대상 — CLOSED는 한도 계산에서 제외(REQ-SUB-05 · REQ-AUT-20) |
| workplace_members | 활성 멤버 수 산출 대상 — OWNER·MANAGER·STAFF 전원(REQ-SUB-06) |
| notifications | 구독 안내 알림 subscription_notice(REQ-SUB-09) |
| audit_logs | 수동 등급 조정의 사유·전후값 기록(REQ-SYS-09) |

## 관련 화면

| 화면 코드 | 화면명 |
|-----------|--------|
| PUB-LANDING | 서비스 소개 랜딩 |
| PUB-PRICING | 요금제 안내 |
| APP-INVITE | 초대 수락·거절 |
| ADM-WORKPLACE-CREATE | 사업장 등록 |
| ADM-MEMBERS | 멤버·역할·초대 관리 |
| ADM-SUBSCRIPTION | 구독·이용 한도 |
| SYS-SUBSCRIPTIONS | 구독·요금제 관리 |

검산: 7본 — PUB 2 · APP 1 · ADM 3 · SYS 1. 등록·인원 게이팅(SUB-03 · SUB-04)의 강제 지점은 화면이 아니라 (서버)이며 화면은 판정 결과와 잔여 한도만 보인다. **결제 화면을 만들지 않고** 등급 조정은 SYS-SUBSCRIPTIONS의 수동 처리로만 한다. 만료 점검은 (배치) 축을 함께 갖는다.

기능→화면 전수 매핑 정본은 [../07_screen/02_traceability.md](../07_screen/02_traceability.md)다.

## 에러 코드

| 에러 코드 | HTTP | 발생 조건 |
|-----------|:--:|----------|
| subscription.workplace_limit_exceeded | 402 | OWNER 사업장 등록 수 한도 초과(REQ-WRK-02 · REQ-SUB-05) |
| subscription.staff_limit_exceeded | 402 | 사업장 활성 멤버 수 한도 초과 — 초대 발송·수락·임포트(REQ-WRK-14 · REQ-WRK-16 · REQ-WRK-35 · REQ-SUB-06) |
| subscription.expired | 402 | 구독 만료로 기능 차단 — **법정 보존 데이터 조회는 제외**(REQ-SUB-09) |
| subscription.plan_not_found | 404 | 요금제 미존재(REQ-SUB-03) |
| subscription.upgrade_required | 402 | 등급 한도 초과로 업그레이드 필요 — **v1 발생 지점은 한도 2축뿐**이며 기능 플래그 축은 v1에 없다(REQ-SUB-01 · REQ-SUB-07) |

검산: subscription **5종**. 요금제 파괴적 변경 차단(system.plan_in_use/409)의 정의처는 [13_system.md](./13_system.md)다.

## 관련 문서

- [../02_features/11_subscription.md](../02_features/11_subscription.md) — SUB 5기능 명세 정본
- [01_global_rules.md](./01_global_rules.md) — 동시성 잠금·멱등성·에러 규약
- [03_workplace.md](./03_workplace.md) — 등록 한도·초대 한도의 강제 지점
- [13_system.md](./13_system.md) — 요금제 관리·계정 구독 수동 조정 권한
- [02_auth.md](./02_auth.md) — 탈퇴 시 소유 사업장 정리(한도 산출과 같은 집합)
- [../05_database/14_subscription.md](../05_database/14_subscription.md) — 요금제·구독 테이블 명세
- [../06_api/13_subscription.md](../06_api/13_subscription.md) — 구독 API 표면
