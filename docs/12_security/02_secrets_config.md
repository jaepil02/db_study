# 시크릿과 설정 (02_secrets_config)

> **대상**: 비밀과 설정을 위협 관점에서 다시 읽는 리뷰 — **비밀 목록(정본)** · .env 비커밋 · .env.example의 자리표시 규칙 · 비밀이 새는 자리 · Dictionary 전용 읽기 계정 · 부하 주입 표면 게이트(DATAGEN_BULK_ENABLED) 리뷰 · 백업 정책의 보안 함의 · 설정 전환의 경계
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §3 · §7.4 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.3(커밋 ff66a37) · REQ-TEC-06 · 08 · 14 · REQ-GEN-08 · REQ-AUT-01 · 17 · REQ-OBS-10 · REQ-MST-11 · D-06 · ADR-16 · ADR-18 · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) 환경변수 정본 · [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) DB 역할 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) · [../07_api/09_datagen.md](../07_api/09_datagen.md) · docs_plan.md 웨이브 인계 W7 12_security 행

이 문서는 **무엇이 비밀이고 어디로 새는가**를 고정한다. 환경변수 **이름**의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)이고 이 문서는 이름을 만들지 않는다 — 비밀의 목록 · 주입 경로 · 커밋 규칙 · 새는 자리만 갖는다. 비밀 9종은 **비밀 하나 = 환경변수 하나**로 이름 정본에 등재되어 있다(W7 — [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §환경변수 비밀 행).

**로컬 전용이라도 비밀은 비밀이다.** 저장소는 원격 저장소로 push되고, 볼륨 스냅샷은 파일로 복사되며, 실험 기록과 로그는 공유된다. 네트워크 경계가 없는 대신 **복사본이 경계를 넘는다** — 이 문서의 모든 규칙은 사본이 어디로 가는지를 기준으로 선다.

**설정의 전환은 환경변수와 재기동뿐이다**(D-06). 실행 중에 설정을 바꾸는 표면이 없다는 사실이 이 문서의 방어 하나다 — 스위치 · 게이트 · 비밀을 요청으로 바꿀 수 있는 자리가 api에 없다.

## 비밀 목록 (정본)

**이 표가 비밀 목록의 정본이다.** 여기 없는 값은 비밀이 아니며 로그 · health에 나가도 된다. 새 비밀이 생기면 이 표에 행을 먼저 둔다.

| # | 비밀 | 쓰는 자리 | 주입 경로 | 새면 |
|:-:|------|------|------|------|
| 1 | 액세스 토큰 서명 키 | api AUT 모듈 | .env → api 환경변수 | 임의 사용자 · 임의 수명의 액세스 토큰을 만든다 — 인가 전체가 무너진다 |
| 2 | PostgreSQL 관리자 비밀번호 | postgres 이미지 초기화 · 사람의 psql | .env → postgres 컨테이너 환경변수 | 스키마 · 권한 · 감사 행까지 수정한다 — 추가 전용 권한(REQ-WRK-09)을 우회한다 |
| 3 | 스키마 소유 계정 비밀번호(app_owner) | migrate | .env → migrate 접속 | DDL — 테이블 삭제 · 권한 재부여 |
| 4 | 앱 계정 비밀번호(app_rw) | api 풀 | .env → 접속 문자열 | 업무 테이블 읽기 · 쓰기 — 감사 · 계보 행 수정과 물리 삭제는 권한이 막는다 |
| 5 | Dictionary 읽기 계정 비밀번호(ch_reader) | ClickHouse Dictionary 소스 · migrate의 역할 생성 | .env → ClickHouse 설정 파일 · migrate | tag_master 읽기뿐 — 권한 최소화의 효과(§Dictionary 전용 읽기 계정) |
| 6 | ClickHouse 계정 비밀번호 | api · 사람의 clickhouse-client | .env → 접속 문자열 · clickhouse 컨테이너 환경변수 | 시계열 삭제 · TTL 변경 · 파트 조작 |
| 7 | Redis 비밀번호 | api · 사람의 redis-cli | .env → 접속 문자열 · redis 설정 | Stream 삭제 · 봉인 계열 조작 · 키 계열 래퍼를 우회한 FLUSH |
| 8 | 학습자 계정 초기 비밀번호 | seed(해시 후 user_account) | .env → seed 실행 환경 | 세 역할 전부의 로그인(REQ-AUT-17) |
| 9 | Grafana 관리자 비밀번호 | observability 프로파일 | .env → grafana 컨테이너 환경변수 | 대시보드 · 데이터 원천 설정 변경 — 측정 화면의 조작 |

- 검산: 비밀 = 서명 키 1 + 저장소 계정 6(#2~#7) + 사람 계정 2(#8 · #9) = **9** — 세는 기준은 **비밀 값 하나 = 한 행**이다(값이 여러 자리에 주입돼도 한 행)
- **세 저장소 모두 비밀번호를 요구한다(판정).** 127.0.0.1 바인드는 LAN만 막고 같은 머신의 프로세스는 막지 않는다([05_local_exposure.md](./05_local_exposure.md)). 비밀번호가 없으면 같은 머신의 어떤 프로세스든 저장소 포트에 붙는 순간 전권을 가진다 — 바인드 주소 하나에 전부를 걸지 않는다. 접속 문자열에 자격 증명이 든다는 환경변수 정본의 서술([../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md))이 이 판정과 같다.
- **#1 · #8 · #9는 저장소가 아니라 사람이 만든다.** 서명 키는 난수 생성 명령으로 만들고, 학습자 · Grafana 비밀번호는 사람이 정한다. 셋 다 .env.example에 값이 없다(§.env와 .env.example).

### 비밀이 아닌 것

| 값 | 비밀이 아닌 이유 | 노출 자리 |
|------|------|------|
| 커밋 해시 · 메모리 프로파일 · 용량 티어 | 측정 조건이다 — 기록 4요소로 공유해야 한다 | health run(REQ-OBS-10) |
| 스위치 상태 11종 · APP_ROLE | 측정 조건이다 | health switches · /metrics 레이블 |
| 호스트 포트 · 서비스명 · DB 이름 · 계정 이름 | 설계 값이다 — 고정 기준에 있다 | 문서 · .env.example |
| DATAGEN_BULK_ENABLED | 게이트 상태 — 비밀이 아니라 **방치 위험**이다(§부하 주입 표면 게이트) | 측정 기록 조건 칸 |

- 검산: 비밀 아닌 값 묶음 = **4**
- **계정 이름(app_rw · ch_reader)이 비밀이 아닌 이유** — 이름은 권한 설계의 일부라 문서가 이미 말한다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)). 이름을 숨겨 얻는 방어는 없고, 숨기면 권한 검토가 불가능해진다.

## .env와 .env.example

| 파일 | Git | 담는 것 | 규칙 | 어기면 |
|------|------|------|------|------|
| .env | **제외** | 비밀 9종의 실제 값 · 스위치 · 측정 조건 | .gitignore가 막는다([../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)) · REQ-TEC-14 | 원격 저장소 push 한 번으로 비밀이 이력에 남는다 — 이력에서 지워도 사본은 회수되지 않는다 |
| .env.example | 포함 | 환경변수 이름 전부 · 비밀 아닌 값의 로컬 기본값 · **비밀 자리는 자리표시** | 이 문서 판정 | 비밀 자리에 실제 값을 두면 .env를 커밋하지 않아도 비밀이 커밋된다 |

- 검산: 파일 = **2**
- **자리표시 비밀로는 기동하지 않는다(판정).** api · seed는 비밀 값이 비었거나 .env.example의 자리표시와 같으면 기동을 거부한다. 서명 키는 길이 하한(256비트 이상 무작위)을 기동 시 검사한다. 반대 시나리오 — 자리표시로 기동을 허용하면 모든 학습자 환경이 같은 서명 키 · 같은 저장소 비밀번호로 돈다. 저장소 사본을 가진 누구나 그 키로 토큰을 만든다.
- **접속 문자열은 비밀번호를 담지 않고 참조한다.** 호스트(서비스명) · 포트 · DB 이름 · 계정 이름은 로컬 값 그대로 두고, 비밀번호 자리는 비밀 변수를 Compose 변수 치환으로 참조한다 — 비밀번호를 문자열에 직접 적으면 같은 비밀이 두 변수에 나뉘어 바꿀 때 한쪽이 남는다. 그래서 .env.example에는 비밀 값이 한 글자도 없다.
- 비밀 값을 만드는 절차는 사람의 셸 명령이다 — 무작위 생성 → .env에 기입 → 저장소 초기화(빈 볼륨) 순이다. 볼륨이 이미 있으면 저장소 비밀번호는 초기화 때 한 번 정해져 있어 .env만 바꾸면 접속이 실패한다.

```plain
① .env.example 복사 → .env
② 비밀 자리 채우기      서명 키 · 저장소 비밀번호 6종은 난수 생성 명령으로 · 학습자 비밀번호 · Grafana 비밀번호는 사람이 정한다
③ 빈 볼륨으로 기동       저장소 이미지가 관리자 비밀번호를 초기화한다
④ migrate              app_owner · app_rw · ch_reader 역할을 .env의 비밀번호로 만든다
⑤ seed                 학습자 비밀번호를 Argon2id로 해시해 user_account에 넣는다 — 원문은 어디에도 남지 않는다
```

- **③ 이후 비밀번호를 바꾸는 것은 .env 수정이 아니다.** 저장소 안의 계정 비밀번호를 먼저 바꾸고 .env를 맞춘다 — 순서를 거꾸로 하면 api가 접속 오류로 재시작 루프를 돈다.
- **⑤의 원문은 seed 실행 환경에만 있다.** 시드 파일 · migrate 파일 · 감사 로그 어디에도 원문을 쓰지 않는다(REQ-AUT-01 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md)).
- 해시 알고리즘의 정본은 [01_authn_authz.md](./01_authn_authz.md) §비밀번호 저장이다.

## 비밀이 새는 자리

비밀은 저장소 · 네트워크가 아니라 **사본**으로 샌다. 자리마다 막는 규칙 하나를 둔다.

| 자리 | 새는 것 | 막는 규칙 | 근거 |
|------|------|------|------|
| Git 이력 | .env · 실제 값이 든 설정 파일 | .gitignore · .env.example 자리표시 | REQ-TEC-14 |
| 마이그레이션 · DDL 파일 | Dictionary 소스 비밀번호 | DDL에 비밀을 쓰지 않고 설정 파일로 주입한다 | 원본 architecture.md §7.4 · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| 앱 로그 | 접속 문자열(비밀번호 포함) · 토큰 · 비밀번호 원문 | 접속 문자열은 비밀번호를 가린 모양으로만 기록 · 토큰 · 비밀번호는 기록하지 않는다 | REQ-AUT-01 · 이 문서 판정 |
| 에러 봉투 | 스택 · SQL · 접속 문자열 | 봉투에 싣지 않는다 · 500은 message만 | [../07_api/01_conventions.md](../07_api/01_conventions.md) §에러 봉투 |
| health · /metrics | 접속 문자열 · 자격 증명 · 토큰 | 저장소별 상태 · 스위치 · 측정 조건 3요소 · 집계 수치 · 바인딩된 쿼리 문형만 | REQ-OBS-10 |
| 브라우저 번들 | 웹 공개 접두 환경변수의 값 | **공개 접두(NEXT_PUBLIC_)에 비밀을 두지 않는다** — 그 값은 빌드 때 브라우저 코드에 박힌다 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) 웹 계열 · 이 문서 판정 |
| 볼륨 스냅샷 · 덤프 | password_hash · 감사 before · after · 리프레시 요약값 · AOF | snapshots/는 Git 제외 · **스냅샷 공유는 비밀 공유로 취급한다** | §백업 정책 · REQ-TEC-08 |
| 측정 기록 | 붙여 넣은 CLI 출력 · 접속 명령 | 기록에 접속 문자열 · 비밀번호가 든 명령을 붙이지 않는다 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |

- 검산: 자리 = **8**
- **B형 — 브라우저 쪽 api 주소가 공개 접두 변수인 것은 누출이 아니다.** 결론 — 공개 접두 변수는 비밀이 아닌 값만 담는 자리다. 반대 시나리오 — 편의상 서명 키나 저장소 주소를 공개 접두로 두면 개발 도구의 소스 탭에서 누구나 읽는다. 파생 지침 — 비밀 목록 9종은 어느 것도 공개 접두 이름을 갖지 않는다.
- 로그에서 비밀번호를 가리는 규칙은 드라이버가 오류 메시지에 접속 문자열을 싣는 경우까지 포함한다 — 기동 실패 로그가 가장 흔한 누출 자리다.

## Dictionary 전용 읽기 계정

ClickHouse Dictionary는 PostgreSQL을 주기적으로 읽는다(원본 architecture.md §7.4). 그 읽기의 신원이 ch_reader다.

| 항목 | 계약 | 근거 | 어기면 |
|------|------|------|------|
| 권한 | tag_master SELECT만 | REQ-MST-11 · REQ-TEC-14 · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 앱 계정을 쓰면 Dictionary 소스가 업무 테이블 쓰기 권한을 가진다 — ClickHouse 쪽 사람 접속이 곧 PostgreSQL 쓰기 경로가 된다 |
| 비밀번호 주입 | ClickHouse 설정 파일(.env에서) — **DDL에 쓰지 않는다** | 원본 architecture.md §7.4 password 자리 · [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) | DDL 순번 파일은 커밋되므로 비밀번호가 Git 이력에 남는다 |
| 역할 생성 | migrate ① 단계가 .env의 비밀번호로 만든다 | [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) 적용 순서 | 수동으로 만들면 환경마다 비밀번호가 달라 Dictionary 적재가 LIFETIME마다 실패한다 |
| 커넥션 | 상한 2(현행 참고) · LIFETIME 주기 조회만 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) §커넥션 | 해당 없음 |
| 적재 실패 | 조회는 마지막 적재 값으로 계속된다 | 원본 architecture.md §17 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) common.postgres_unavailable | 해당 없음 — 비밀번호 불일치도 같은 모양으로 조용하다 |

- 검산: 항목 = **5**
- **비밀번호 불일치는 조용하다(B형).** 결론 — Dictionary 적재 실패는 시계열 조회를 막지 않는다. 반대 시나리오 — ch_reader 비밀번호를 .env에서만 바꾸면 조회는 계속 200인데 태그명이 옛 값으로 멈춘다 — 새 태그는 메타 없이 나온다. 파생 지침 — 비밀번호 변경 뒤 SYSTEM RELOAD DICTIONARY를 한 번 부르고 오류 여부를 본다.

## 부하 주입 표면 게이트

인계 "DATAGEN_BULK_ENABLED 보안 리뷰"를 닫는다. 게이트의 이름과 표면 계약의 정본은 [../07_api/09_datagen.md](../07_api/09_datagen.md) · [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)다. **판정 — 게이트 설계를 유지하고, 방치를 드러내는 기동 경고 하나를 더한다.**

| 게이트 · 단계 | 표면 상태 | 받는 쪽 | 방어 | 남는 것 |
|------|------|------|------|------|
| false(기본) | 라우트 없음 — datagen.bulk_disabled/404 | 아무도 | 존재하지 않음 | 없음 |
| true · S5~S6 | 무인증 수락 | 같은 머신의 어느 프로세스든 | 본문 검증(quality 9만 · dt 0 이상 · 길이 일치) · 적체 검사 | 임의 프로세스가 SIMULATED 행을 적재한다 |
| true · S7 이후 | 인증 · 역할 무관 · 부하 주입 등급 레이트 리밋 | 역할 1개 이상의 인증 사용자 | 인증 · 레이트 리밋(한도는 실험 부하 이상 — [03_api_surface_defense.md](./03_api_surface_defense.md)) · 본문 검증 · 적체 검사 | 토큰을 가진 쪽은 한도까지 주입한다 |

- 검산: 상태 = **3**
- **게이트를 켠 채 잊는 것이 이 표면의 주 위험이다.** 게이트 상태는 health에 실리지 않는다 — 스위치가 아니기 때문이다([../07_api/09_datagen.md](../07_api/09_datagen.md) 판정). 그래서 켜져 있다는 사실이 화면 어디에도 보이지 않는다. **판정 — 게이트가 true로 기동하면 SW-01 off와 같은 방식으로 기동 경고 로그 1줄을 남긴다.** health 본문은 바꾸지 않으므로 07_api/09의 판정과 충돌하지 않는다. 반영 자리는 [../07_api/09_datagen.md](../07_api/09_datagen.md) 공통 규약 게이트 행이다(W7 반영).
- **주입된 행은 전부 SIMULATED(9)다.** 표면이 quality 9 외를 400으로 거절하므로(REQ-GEN-02) 게이트가 열려 있어도 실데이터처럼 보이는 행은 들어오지 않는다 — 방치의 피해는 측정 오염과 디스크 사용이지 데이터 위조가 아니다.
- **deviceId의 마스터 존재를 검사하지 않는다**([../07_api/09_datagen.md](../07_api/09_datagen.md)) — 마스터에 없는 설비 ID로 행이 쌓일 수 있다. 원시 보존(현행 7일 · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md))이 지나면 사라지고, 그 전에는 조회에서 메타 없이 나온다 — 잔여 [04_threat_model.md](./04_threat_model.md).

## 백업 정책

원본의 백업 정책을 옮기고 각 행의 보안 함의를 붙인다. 스냅샷 명령 · 위치의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)다.

| 대상 | 방식 | 이유 | 보안 함의 |
|------|------|------|------|
| PostgreSQL | 덤프를 로컬 snapshots/에 — 스키마 · 시드 보존 | 원본 architecture.md §18 · 원본 tech_stack.md §10.3 | 덤프에 password_hash · 감사 before · after 원문이 든다 — 해시가 Argon2id라 대입 비용이 크지만 공유는 비밀 공유다 |
| ClickHouse 원시 데이터 | 백업하지 않는다 — 생성기로 재생성 | 상동 | 생성 데이터라 기밀성이 없다 — 잃어도 재현 가능하다 |
| Redis | 백업하지 않는다 — Stream은 재생 가능한 버퍼 · 캐시는 휘발 · 최신값은 ClickHouse에서 재구성 | 원본 architecture.md §3 · §18 · REQ-TEC-08 | 따로 떠 두지는 않지만 **볼륨 스냅샷에는 redisdata(AOF)가 들어간다** — 리프레시 키가 요약값이라 AOF가 로그인 권한 목록이 되지 않는다([01_authn_authz.md](./01_authn_authz.md) §리프레시 토큰) |
| 전체 볼륨 | 실험 전 task snapshot — 볼륨별 압축 tar | 원본 architecture.md §3 · 원본 tech_stack.md §10.3 · REQ-TEC-08 | pgdata · chdata · redisdata · spooldata 전부 — 위 셋의 함의를 합친 것 |

- 검산: 대상 = **4**
- **AOF의 목적은 백업이 아니다.** 재기동 때 미소비 Stream 엔트리를 잃지 않는 것이다(원본 architecture.md §3 · REQ-TEC-06). 전체 롤백은 task snapshot이 맡는다.
- **snapshots/는 Git에서 제외된다**([../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) .gitignore). 제외는 크기 때문이기도 하지만 보안 쪽 이유가 더 무겁다 — 스냅샷 하나가 비밀 셋(해시 · 감사 원문 · 저장소 상태)을 담는다.

## 설정 전환의 경계

| 전환 대상 | 수단 | 실행 중 변경 표면 | 이 경계가 막는 것 |
|------|------|------|------|
| 역할 스위치 11종 | 환경변수 + api 재기동 | 없음(REQ-OBS-12) | 측정 중 스위치가 바뀌어 한 기록 안에 조건이 섞이는 것 · 요청 하나로 방어 구성이 바뀌는 것 |
| 부하 주입 게이트 | 환경변수 + 재기동 | 없음 | 요청으로 표면을 여는 것 |
| 비밀 9종 | .env + 재기동(저장소 비밀번호는 저장소 안 변경 먼저) | 없음 | 요청으로 서명 키 · 자격 증명을 바꾸는 것 |
| 생성기 · 주입 계획 | 실행 인자 · 주입 계획 파일 | 없음([../07_api/09_datagen.md](../07_api/09_datagen.md) 판정) | 실험 기록 밖의 장애 주입 |

- 검산: 전환 대상 = **4**
- **환경변수는 기동 시 1회만 읽는다**([../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)). 실행 중 다시 읽는 변수가 하나라도 생기면 이 표의 "실행 중 변경 표면 없음"이 거짓이 된다 — .env 파일을 쓸 수 있는 프로세스가 재기동 없이 방어 구성을 바꾼다.
- 이 경계를 지키는 것은 앱 인가가 아니라 **머신 접근**이다 — .env와 호스트 셸에 닿는 쪽이 전환 권한을 가진다([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §실험 수행자와 실험 콘솔).

## 원본 대조

| 원본 자리 | 사실 | 이 문서의 자리 |
|------|------|------|
| architecture §3 스냅샷 · Redis AOF 문단 | 실험 롤백 유지 · task snapshot · Redis AOF 별도 백업 없음 · AOF 목적 | §백업 정책 |
| architecture §7.4 Dictionary DDL · 주의 문단 | 소스 계정 ch_reader · password 자리 · 전용 읽기 전용 계정 | §Dictionary 전용 읽기 계정 |
| architecture §18 시크릿 행 | .env를 Git에 커밋하지 않는다 | §.env와 .env.example |
| architecture §18 부하 테스트 엔드포인트 행 | /api/v1/ingest/bulk는 환경변수로 끈다 · 기본 비활성 | §부하 주입 표면 게이트 |
| architecture §18 백업 행 | pg_dump · ClickHouse 원시 비백업 · Redis 비백업 · task snapshot | §백업 정책 |
| tech_stack §10.3 볼륨 표 | 볼륨 4 · redisdata AOF everysec · spooldata | §백업 정책 전체 볼륨 행 · 정본 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |
| tech_stack §10.3 named volume · 롤백 문단 | bind mount 대신 named volume · 실험 롤백 능력 유지 | 정본 ADR-18 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 보안 함의만 §백업 정책 |
| tech_stack §10.3 백업 정책 표 | 대상 4행 | §백업 정책 |

- 검산: 원본 행 = **8** · 누락 0

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 저장소 비밀번호 교체 절차의 작업화 | 미설계 — 순서 계약만 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |

## 관련 문서

- [01_authn_authz.md](./01_authn_authz.md) — 서명 키를 쓰는 토큰 · 해시 알고리즘
- [04_threat_model.md](./04_threat_model.md) — 비밀 누출 위협 · 잔여
- [05_local_exposure.md](./05_local_exposure.md) — 저장소 포트와 비밀번호의 관계
- [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) — 환경변수 이름 정본 · 스냅샷 위치
- [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) — .env.example · .gitignore
- [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) — DB 역할 3
- [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) — 역할 생성 · 시드 순서
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 부하 주입 표면 · 게이트
