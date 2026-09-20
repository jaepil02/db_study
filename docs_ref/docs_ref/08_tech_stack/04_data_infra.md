# 04 데이터·인프라 스택

> **대상**: insadesk 데이터 저장소와 실행 인프라 — PostgreSQL 18 · Redis · AWS EC2 Docker Compose · S3 · Vercel
> **작성일**: 2026-08-03
> **개정일**: 2026-09-07 — 인용 갱신 — **V0711**(idempotency_records 신설)로 테이블 60 → **61종** · RLS 정책 169 → **172**(SELECT·INSERT 각 61 · UPDATE **46** · **DELETE 4는 불변**) · 유일성 강제 59 → **60** · PK 60 → **61**. 정본 [../05_database/README.md](../05_database/README.md). 나머지 수치는 전건 불변
> **개정일**: 2026-09-06 — 백엔드 스택 전환(D-21 · ADR-25~29) 반영. PostgreSQL 절의 마이그레이션 행을 back/db/migration/ + 자체 러너 → **루트 db_migration/ + Flyway**(프로세스 밖 선행 단계 적용 · 이력 테이블 업무 스키마 밖)로 · Redis 절의 세션 스토어 행을 express-session + connect-redis(node-redis) → **Spring Session Data Redis**(Lettuce 단일 클라이언트)로 · Compose 표의 nestjs 컨테이너 → **backend**(Java 25 런타임 베이스 이미지)로 · **Node 24 LTS 지원 일정 단서 문단 삭제**하고 JVM 기준선 문단으로 대체 · Vercel 절의 back/ 경로 치환. 컨테이너 **4종 검산 불변**
> **개정일**: 2026-08-09 — 전역 수치 정합 — 테이블 58 → **60종** · enum 32 → **33종** 인용 갱신
> **개정일**: 2026-08-08 — 웹 전환(D-20 · ADR-24)과 실측 검증 반영. Vercel 절 재작성(정적 산출물 · 프리렌더 · VITE_ 접두 · 프리뷰 고정 픽스처) · S3 수명 주기 행을 자동 파기 미채택 부정형으로 · nginx 패치 하한 **1.30.4** 고정(취약점) · Node 24 LTS 지원 일정 단서 추가
> **원천**: docs_ref2/schema_p0.md(uuidv7 · btree_gist · RLS ENABLE + FORCE · 필수 확장) · docs_ref2/features.md(SSE + Redis Pub/Sub · 분산락 · 민감정보 국내 리전 저장) · 확정 결정 D-03(서브도메인 직접 호출) · D-20(웹 프론트엔드 전환) · **D-21**(백엔드 스택 전환) · 기술결정 **ADR-27**(스키마 적용) · **ADR-28**(RLS 주입) · 2026-08-08 시점 각 제품 최신 안정판 실측

데이터가 어디에 어떤 형태로 놓이고 무엇이 그것을 실행하는지를 고정한다. 웹은 Vercel, API·데이터베이스·캐시는 AWS EC2 단일 인스턴스의 Docker Compose, 파일과 백업은 서울 리전 S3다.

테이블·제약·RLS 정책의 명세 정본은 [../05_database/README.md](../05_database/README.md)이고, 배포 토폴로지·도메인·TLS의 정본은 [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)다. 본 문서는 스택 관점의 구성만 담는다.

## PostgreSQL 18

| 항목 | 내용 |
|------|------|
| 버전 | **PostgreSQL 18**(18.4). 메이저 18로 고정한다 — uuidv7 내장이 스키마 설계 전제다 |
| 테이블·enum | 테이블 **61종** · enum **33종**. 정본은 [../05_database/README.md](../05_database/README.md) |
| 기본 키 | 일반 테이블은 gen_random_uuid, 고volume append 테이블(로그·이벤트·알림·근태 원본·원장·교부 이력·확인자료)은 **uuidv7**을 쓴다. 시간 정렬 키라 삽입 국소성이 유지된다 |
| 필수 확장 | **btree_gist**(기간 겹침 EXCLUDE 제약) · **pgcrypto**(gen_random_uuid — PostgreSQL 18은 내장이나 명시한다). uuidv7은 내장이라 확장이 필요 없다 |
| 행 수준 보안 | 전 업무 테이블에 **ENABLE + FORCE ROW LEVEL SECURITY**를 건다. 기본 거부이며 정책 없는 테이블은 접근 자체가 불가하다. FORCE를 빼면 테이블 소유자 접속이 정책을 통째로 건너뛴다 |
| 접속 롤 | 애플리케이션 롤은 **NOSUPERUSER · NOBYPASSRLS · 비소유자**다. 마이그레이션 롤과 애플리케이션 롤을 분리한다. 세션 컨텍스트는 **데이터소스 프록시가 트랜잭션 진입 시 주입**하며 커넥션 풀의 연결 초기화 구문을 쓰지 않는다(ADR-28) |
| 시간대 | 저장은 timestamptz(UTC). 일(日) 경계 판정은 KST이며 date 컬럼에 물리 저장한다. 조회에서 컬럼에 시간대 변환을 씌우지 않는다 — 인덱스를 못 쓰고 세션 시간대에 의존하게 된다 |
| 수치 타입 | 금액은 bigint(원), 기간은 integer(분), 비율·중간 몫은 numeric이다. float·double precision을 쓰지 않는다(REQ-GLB-02) |
| 마이그레이션 | 저장소 루트 **db_migration/V{NNNN}__{name}.sql**을 **Flyway**가 애플리케이션 **프로세스 밖의 선행 실행 단계**에서 번호순 적용한다(ADR-27). 적용 이력 테이블로 재적용을 막되 **그 테이블은 업무 스키마 밖에 둔다** — 안에 두면 테이블 61종 검수 기준이 어긋난다. db_migration/은 backend/ 밖이라 클래스패스가 아니므로 파일 시스템 위치로 지정한다. 하위 provisioning/ · seed/ 는 적용 대상이 아니다. 번호 구간 배치 정본은 [../05_database/10_migrations_seed.md](../05_database/10_migrations_seed.md) |
| 실행 위치 | EC2 Docker 컨테이너. 데이터 디렉터리는 호스트 볼륨에 둔다 |
| 관리형 서비스 | RDS를 v1에 쓰지 않는다. 근거는 [06_decisions_rationale.md](./06_decisions_rationale.md) |

## Redis 8.10

| 항목 | 내용 |
|------|------|
| 세션 스토어 | 웹 세션(**Spring Session Data Redis**)의 저장소다. 만료를 Redis TTL로 강제해 세션 정리 정기작업을 두지 않는다. 클라이언트는 **Spring Data Redis(Lettuce) 단일 축**이다([03_backend.md](./03_backend.md)) |
| JWT 블랙리스트 | 로그아웃·계정 정지·강제 만료된 앱 토큰을 등재한다. 항목 TTL을 토큰 잔여 수명으로 맞춰 무한 증식을 막는다 |
| SSE Pub/Sub | 이벤트 생산자와 SSE 연결 보유자를 분리한다. **채널 분리는 서버 내부 개념이며** 클라이언트가 채널을 구독·재구독하지 않는다 |
| 분산락 | **정기작업 8건의 중복 실행 차단** 전용이며 스케줄 락(ShedLock)의 저장소다. 업무 데이터 경합(급여 확정 중 근태 수정, 초대 수락 시 인원 한도 재검증)은 Redis 락이 아니라 **데이터베이스 트랜잭션 잠금**으로 막는다 — 락 서버가 잠깐 끊겼을 때 업무 불변식이 함께 무너지면 안 된다 |
| 재인증 토큰 | 민감정보 열람 전 단기 재인증 토큰(5분 수명)을 둔다. 데이터베이스에 저장하지 않는다 — 회전이 잦고 법정 보존 대상이 아니다 |
| 버전 | **Redis 8.10**(8.10.0) |
| 영속성 | 세션·블랙리스트가 유실되면 전원 재로그인이 되므로 AOF 영속화를 켠다. 다만 Redis는 **업무 데이터의 정본이 아니다** — 유실 시 서비스는 재로그인으로 복구되고 데이터는 잃지 않는다 |
| 캐시 용도 | 업무 데이터 조회 캐시로 쓰지 않는다. RLS 판정을 거치지 않은 값이 캐시에 남으면 격리가 뚫린다 |

## AWS EC2 — Docker Compose

컨테이너 **4종**을 단일 EC2 인스턴스에서 Compose로 실행한다. 검산: nginx 1 + backend 1 + postgres 1 + redis 1 = **4**.

| 컨테이너 | 이미지 축 | 역할 | 노출 | 볼륨 |
|---------|----------|------|------|------|
| nginx | **nginx 1.30**(**1.30.4 이상 고정**) | TLS 종단 · api.{domain} 리버스 프록시 · SSE 버퍼링 해제 · 업로드 크기 제한 | 443 · 80(리다이렉트) | 인증서 · 설정 |
| backend | backend/ 빌드 이미지(**Java 25 런타임 베이스**) | REST API · SSE · 정기작업 · PDF 렌더링 · 기동 시 스키마 적용 | 내부 네트워크만 | 임시 렌더링 디렉터리 |
| postgres | **PostgreSQL 18**(18.4) | 업무 데이터 정본 | 내부 네트워크만 | 데이터 디렉터리(호스트 볼륨) |
| redis | **Redis 8.10**(8.10.0) | 세션 · 블랙리스트 · 재인증 토큰 · Pub/Sub · 분산락 | 내부 네트워크만 | AOF 파일 |

- **postgres · redis는 호스트 포트로 노출하지 않는다.** Compose 내부 네트워크로만 접근하며 외부 진입점은 nginx 하나다.
- **nginx는 1.30.4 이상으로 고정한다.** 1.30.0~1.30.3에 원격 코드 실행 가능 취약점이 포함돼 있어 stable 계열 표기만으로 배포하지 않는다.
- backend 이미지의 런타임 기준선은 **Java 25**다. 장기 지원 릴리스이므로 v1 주기 안에 기준선 전환 판단이 필요하지 않다. 빌드 산출물과 실행 이미지를 나눠 빌드 도구를 실행 이미지에 남기지 않는다.
- backend 이미지는 **스키마 정본 db_migration/을 이미지 안에 담고** 기동 절차에서 Flyway가 그 경로를 파일 시스템 위치로 읽는다(ADR-27) — 호스트 볼륨으로 마운트하지 않는다. 적용 실패는 기동 실패이고 그것이 곧 배포 중단이다.
- backend 이미지에는 PDF 렌더링용 headless Chromium과 한글 폰트를 포함하고, 좀비 프로세스 정리를 위한 init 프로세스를 둔다. 렌더 시점에 외부에서 폰트를 내려받지 않는다.
- TLS 인증서는 Let's Encrypt로 발급·갱신한다. 갱신 작업은 호스트에서 정기 실행하고 nginx 설정을 다시 읽게 한다.
- 컨테이너를 늘려 수평 확장하지 않는다. 타깃 규모(상시 근로자 1~30인 사업장)에서 단일 인스턴스로 충분하며, 확장이 필요해지는 시점의 판단은 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md)에 둔다.
- 인스턴스 사양·네트워크·보안 그룹의 정본은 [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)다.

## AWS S3

| 항목 | 내용 |
|------|------|
| 리전 | **ap-northeast-2(서울) 고정**. 주민번호·계좌·근로계약·명세서가 담기므로 국내 저장을 요건으로 둔다. 국외 리전 복제를 켜지 않는다 |
| 저장 대상 | 임금명세서 PDF · 근로계약서 교부본 · 직원 문서함 파일 · 임포트 원본 · 익스포트 산출물 · 아바타 · 데이터베이스 백업 |
| 공개 설정 | **전 버킷 비공개**다. 퍼블릭 읽기를 켜지 않는다 |
| 접근 | **1회용 다운로드 토큰 + 서버 스트리밍**으로만 내려준다. 공개 URL·영구 링크를 만들지 않으며 저장소 서명 URL을 클라이언트에 전달하지 않는다(ADR-16) |
| 암호화 | 서버 측 암호화를 켠다. 주민번호·계좌 같은 필드 수준 민감정보는 별도로 애플리케이션에서 암호화한다([../10_security/04_pii_protection.md](../10_security/04_pii_protection.md)) |
| 경로 규약 | 사업장 스코프를 경로 첫 세그먼트에 둔다. 다운로드 토큰 발급 전에 서버가 사업장·소유권을 검증하고, 서버 내부의 저장소 접근 서명은 서버 안에 머문다 |
| 수명 주기 | 법정 보존기간이 붙은 산출물은 자동 삭제 규칙을 걸지 않는다. **v1은 자동 파기도 두지 않는다** — 보존기한 도달 목록을 제시하는 데까지가 범위이며 파기 배치는 v1.1 이월이다. 보존기한 필드는 확정 시점에 채워 둔다 |

## 백업

| 항목 | 내용 |
|------|------|
| 방식 | **pg_dump 논리 백업 일일 1회** → S3 서울 리전 업로드. 정기작업이 아니라 호스트 스케줄로 실행해 애플리케이션 장애와 독립시킨다 |
| 보존 | 일일 백업과 월 단위 장기 보관으로 나누되 **정확한 보존 일수는 미확인 — 운영 비용 확정 전 임의 값 고정 금지**(ADR-22). 법정 보존(3년)은 백업이 아니라 운영 데이터베이스의 보존기간 관리가 담당하므로 백업 보존을 법정 보존에 맞추지 않는다 — 백업은 복구 수단이지 보관 수단이 아니다 |
| 복구 목표 | 논리 백업 단독이므로 **RPO는 최대 24시간 · RTO는 4시간**이다. 이 값을 그대로 인정하고 문서화한다 |
| WAL 아카이빙·PITR | **v1에 두지 않는다.** 베이스 백업·아카이브 스토리지·복구 리허설을 함께 운영해야 하고, 타깃 규모에서 하루치 재입력이 감당 가능하다고 판단한다 |
| 복구 검증 | 백업 파일이 실제로 복원되는지 정기적으로 확인한다. 업로드 성공을 백업 성공으로 간주하지 않는다 |
| 암호화 | 백업 객체도 S3 서버 측 암호화 대상이다. 백업에는 마스킹되지 않은 원본이 담긴다 |

## Vercel

| 항목 | 내용 |
|------|------|
| 대상 | web_front **1프로젝트**(D-20). 공개 페이지 · 관리자 웹 · 시스템 웹을 한 산출물이 담는다 |
| 산출물 | **정적 산출물 하나**다 — 빌드 시 프리렌더된 공개 2본의 HTML과 SPA 번들이 같은 디렉터리에 나온다. 서버 런타임 산출물이 없다 |
| 프레임워크 프리셋 | **Vite**. 빌드 명령은 react-router build이며 출력은 React Router framework mode의 클라이언트 빌드 경로다 |
| 도메인 | app.{domain}. API는 api.{domain}으로 EC2가 받는다(D-03). 전환 후에도 **웹 오리진은 하나**이므로 쿠키 스코프와 CORS 허용 오리진이 바뀌지 않는다 |
| 배포 | Git 연동 자동 배포. **프리뷰 빌드는 고정 픽스처(요금제·약관 샘플)로 렌더하고 운영 API를 호출하지 않는다** — 프리뷰가 실데이터에 닿는 경로를 만들지 않는다 |
| 프리렌더 | 랜딩(/)·요금제(/pricing) 2본만 빌드 시점 정적 HTML로 굽는다. **법정 문서는 프리렌더하지 않는다** — 활성 버전을 클라이언트 조회로 표시하므로 버전 전환에 재빌드가 필요 없다(D-20). 전략 정본은 [../04_architecture/05_rendering_seo.md](../04_architecture/05_rendering_seo.md) |
| SPA 딥링크 | fallback rewrite로 처리한다. **프리렌더 HTML과 rewrite의 매칭 우선순위는 호스팅 공식 문서에 명시가 없으므로 프리뷰 배포에서 실측 확인**한 뒤 규약을 확정한다 |
| 서버 실행 | **웹 호스팅 계층에 서버 실행 경로를 두지 않는다.** 업무 API를 프록시하지 않고 인증 후 데이터 경로를 두지 않는다 |
| 환경변수 | Vercel 대시보드에서 관리한다. **VITE_ 접두 변수만 클라이언트 번들에 들어가며**(ADR-18 개정) 서버 시크릿을 web_front에 두지 않는다 |
| 정기 실행 | Vercel의 정기 실행 기능을 쓰지 않는다. 정기작업은 backend/의 스케줄러가 전담한다 |

## 관련 문서

- 기술 선정 사유 → [06_decisions_rationale.md](./06_decisions_rationale.md)
- 백엔드 계층 → [03_backend.md](./03_backend.md)
- CI/CD·환경변수·로컬 개발 → [05_tooling_devops.md](./05_tooling_devops.md)
- 배포 토폴로지·도메인·TLS 정본 → [../04_architecture/08_deployment_topology.md](../04_architecture/08_deployment_topology.md)
- 데이터베이스 명세 정본 → [../05_database/README.md](../05_database/README.md)
- RLS 정책 정본 → [../05_database/08_rls_policies.md](../05_database/08_rls_policies.md)
- 멀티테넌시·격리 → [../04_architecture/03_multitenancy_rls.md](../04_architecture/03_multitenancy_rls.md)
- 시크릿·키 관리 정본 → [../10_security/03_secrets_keys.md](../10_security/03_secrets_keys.md)
