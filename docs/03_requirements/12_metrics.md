# REQ-OBS — 관측 요구사항

> **대상**: 관측(OBS)의 동작 계약 — 단일 스크레이프 창구 · 도메인 계측의 등록 · 저장소 메트릭 주기 수집과 계열별 실패 격리 · 키 계열별 메모리 샘플링 · E2E 지연 게이지 · 헬스체크의 저장소별 확인 · **/api/v1/health 부분 실패 표현** · health · metrics 공개와 응답 내용 제한 · 스위치 상태 노출 — REQ-OBS-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — REQ-OBS-06 닫힌 레이블에 설비 추가 · 레이블 이름 · 조정값 · EXP 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — observability 프로파일 구성원 불일치를 닫는다(prometheus · grafana 2 — 정본 09_tech_stack/03)
> **개정일**: 2026-09-24 — W5 판정 반영 — REQ-OBS-10 · 11 — health 본문에 측정 기록 4요소 중 스위치 밖 3요소(커밋 해시 · 메모리 프로파일 · 용량 티어) 노출 추가(EXP-CONSOLE · EXP-COMPARE가 읽는다) — REQ 수 불변
> **개정일**: 2026-09-24 — SW-11 LATEST_VALUE_WRITER 신설 반영(D-13 · 사용자 확정) — 스위치 10 → **11**
> **원천**: 원본 architecture.md §3 · §11 · §14 · §16 · §17 · §18(커밋 ff66a37) · 원본 tech_stack.md §9 · §10.6(커밋 ff66a37) · 원본 data_flow.md §12.1 · §15 · §16(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §4.3 · §5 S2 · S5 · S6(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #12 · 웨이브 인계 W2b 행 · D-06 · D-10 · [../02_features/11_metrics.md](../02_features/11_metrics.md) OBS-01~06 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 공통 규칙

이 문서는 **측정 대상을 건드리지 않고 재는 계약**을 고정한다. 기능의 존재와 경계는 [../02_features/11_metrics.md](../02_features/11_metrics.md)가, 메트릭 이름 · 전수는 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가, 표면 명세는 [../07_api/10_metrics.md](../07_api/10_metrics.md)(W5)가 갖는다. OBS는 흐름 F-01~F-10 어디에도 주 경로로 참여하지 않으므로 이 문서의 흐름 칸은 전부 "해당 없음 — 관측"이다.

**OBS의 계약은 두 가지 오염을 막는 것이다.** 하나는 관측이 측정 대상을 바꾸는 오염(스크레이프 빈도가 저장소 부하를 바꾸고 전수 메모리 계산이 Redis를 멈추는 것)이고, 다른 하나는 측정 기록이 조건을 잃는 오염(스위치 상태가 기록에서 빠지는 것)이다. 앞의 것은 수집을 주기 캐시로 가르고 샘플링으로 막으며, 뒤의 것은 스위치 상태를 표면으로 내보내 막는다 — 스위치 상태는 측정 기록 4요소의 하나다(D-10).

**이 문서가 닫는 인계 1건** — /api/v1/health 부분 실패의 응답 표현(11_glossary/02 채번 보류 · 02_features/11 미확인 · docs_plan 웨이브 인계 W2b 행)을 §health 부분 실패 판정에서 판정한다. **health · metrics 공개는 02_features/12의 판정을 따르며 이 문서는 그 판정이 무효가 되지 않도록 응답 내용을 제한한다.**

## 요구사항 — 메트릭 수집과 노출

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-OBS-01** | 앱 · 파이프라인 · 세 저장소의 메트릭은 api 컨테이너의 /metrics **하나**로 노출한다. exporter 컨테이너를 두지 않는다 | 원본 architecture.md §14 · 원본 tech_stack.md §9 · OBS-01 · OBS-02 | 창구가 여럿이면 스크레이프 시점이 창구마다 달라 같은 순간의 캐시 히트율과 스트림 길이를 한 그래프에 겹칠 수 없다 · exporter 컨테이너가 로컬 메모리 예산에서 측정 대상 몫을 가져간다 | 기본 기동 컨테이너 목록 = 4 · /metrics 한 번의 응답에 앱 · Redis · PostgreSQL · ClickHouse 계열 모두 존재 | OBS-01 · OBS-02 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-02** | 각 도메인 모듈이 자기 카운터 · 히스토그램을 등록하고 OBS는 모으기만 한다. 새 컴포넌트와 새 스위치는 **같은 커밋에서** 그 계측을 갖는다. S2의 최소 계측은 방출 포인트 · 컨슈머 랙 · E2E 지연 셋이다 | 전역 불변식 "계측 우선" · 원본 implementation_plan.md §4.3 · §5 S2 · D-06 · OBS-01 | OBS가 도메인 카운터를 대신 만들면 계측 지점이 코드 경로에서 떨어져 측정값이 경로 변경을 따라가지 못한다 · 계측 없는 스위치는 on/off 차이를 잴 수 없는 장식이다 | S2 기동 → 계측 3종 노출 · 스위치별 on/off 차이 지표 존재([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 측정 · 교체 표 대조) | OBS-01 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-03** | 저장소 메트릭(Redis INFO · XLEN · pg_stat_database · pg_stat_statements · system.metrics · system.events · system.parts)은 **정해진 주기로 모아 두고** 스크레이프는 마지막 수집값을 돌려준다. 한 계열의 수집이 실패하면 그 계열만 비우고 수집 오류 지표를 올리며 /metrics 자체는 응답한다 | 원본 architecture.md §14 · 원본 tech_stack.md §9 · OBS-02 · [../02_features/11_metrics.md](../02_features/11_metrics.md) 실패 시 보이는 것 | 스크레이프마다 저장소를 조회하면 스크레이프 빈도(프로파일 on · 직접 덤프 주기)가 저장소 부하를 바꿔 측정 조건이 관측 도구에 따라 달라진다 · 한 계열 실패로 /metrics 전체가 실패하면 ClickHouse 중단 실험 중 Redis · 파이프라인 지표까지 사라진다 | 스크레이프 주기를 바꿔도 저장소 쪽 통계 조회 횟수 불변 · clickhouse 정지 → /metrics 200 · ClickHouse 계열만 빈다 · 수집 오류 지표 증가 | OBS-02 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-04** | Redis 메모리는 인스턴스 합계가 아니라 **키 접두별 점유**로 노출하며 접두별 샘플 키의 MEMORY USAGE로 추정한다. 키 전수를 훑어 계산하지 않는다. stream 접두와 cache 접두의 추이를 같은 수집 주기로 낸다 | 원본 architecture.md §14 · 원본 data_flow.md §12.1 · OBS-03 | 전수 계산은 단일 스레드 Redis를 수집 동안 점유해 측정하려던 XADD · 조회 지연을 관측이 만든다 · 두 접두의 수집 주기가 다르면 축출 연쇄 그래프의 역상관을 판별할 수 없다 | 수집 중 Redis slowlog에 전수 순회 명령 0 · 두 접두 시계열의 타임스탬프 정렬 확인 | OBS-03 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-05** | E2E 지연 게이지는 ClickHouse에 주기 쿼리로 최근 창의 ingested_at − ts 분위수(p50 · p95 · p99)를 구해 낸다. **두 컬럼의 차 외의 방법으로 계산하지 않는다** — ts를 ingested_at으로, 또는 그 반대로 대체하지 않는다 | 원본 data_flow.md §15 · 전역 불변식 "시각 의미론" · OBS-04 · [01_global_rules.md](./01_global_rules.md) | 한쪽을 대체하면 E2E 지연이 0이나 상수가 되어 수집 → 버퍼 → 적재 전체의 지연을 SQL 한 줄로 잴 수 없다 · 창이 없으면 쿼리가 tag_raw 전부를 훑어 게이지가 측정 대상에 부하를 더한다 | 게이지 값과 같은 창의 수동 분위수 SQL 결과 대조 · 쿼리 로그의 스캔 범위가 창 안 | OBS-04 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-06** | 메트릭 레이블 값은 닫힌 집합(도메인 · 저장소 · 스위치 · 상태 코드 · 단계 · 설비 — 설비는 티어 구성으로 상한 · 최대 L 100)으로만 둔다. 태그 · 요청 단위 식별자를 레이블에 싣지 않는다 | [../02_features/11_metrics.md](../02_features/11_metrics.md) 실패 시 보이는 것(카디널리티 폭증) · OBS-01 | 태그 식별자를 레이블로 두면 M 티어의 태그 수만큼 시계열이 생겨 /metrics 응답이 커지고 스크레이프 자체가 이벤트 루프를 점유한다 | M 티어 부하에서 /metrics 응답 크기가 태그 수에 비례하지 않음 | OBS-01 · OBS-02 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-07** | /metrics는 observability 프로파일 없이도 직접 덤프할 수 있어야 한다. OBS는 노출까지만 하고 저장 · 시각화 · 알림은 프로파일이 한다 | 원본 architecture.md §14 · 원본 tech_stack.md §9 · §10.6 · [../02_features/11_metrics.md](../02_features/11_metrics.md) §관측 스택과의 경계 | 프로파일에 의존하면 정밀 측정 세션(프로파일 off · 직접 덤프)이 불가능해 모든 수치가 관측 스택의 CPU 몫이 섞인 상대 비교용으로만 남는다 | 프로파일 off 기동 → /metrics 직접 덤프 성공 | OBS-01 | 해당 없음 — 관측 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-OBS-01~07 = **7**
- **REQ-OBS-03은 B형이다.** 결론 — 스크레이프는 저장소를 직접 조회하지 않고 마지막 수집값을 준다. 반대 시나리오 — 스크레이프가 조회를 일으키면 관측 프로파일을 켜는 행위가 PostgreSQL · ClickHouse에 부하를 더해 켠 측정과 끈 측정이 다른 실험이 된다. 파생 지침 — 수집 주기는 조정값이고 스크레이프 주기와 독립이다.

## 요구사항 — 헬스체크 · 공개 · 스위치 상태

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-OBS-08** | /api/v1/health는 PostgreSQL · ClickHouse · Redis 셋을 **각각 실제 왕복으로** 확인하고 저장소마다 타임아웃을 둔다. 한 저장소가 응답하지 않아도 health 응답은 타임아웃 안에 끝난다 | 원본 architecture.md §3 · §11 · OBS-05 | 프로세스가 떴는지만 보면 컨테이너가 뜬 것과 접속을 받을 준비가 된 것을 가르지 못해 api가 먼저 올라와 커넥션 오류로 재시작 루프를 돌고 Collector가 불필요한 스풀 파일을 만든다 · 타임아웃이 없으면 멈춘 저장소 하나가 healthcheck를 무기한 붙잡는다 | 저장소 하나씩 정지 · 일시 정지(응답 없음) → health가 타임아웃 안에 응답 · 해당 저장소만 불가 표시 | OBS-05 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-09** | 세 저장소가 모두 가용이면 200, **하나라도 불가면 503**으로 응답한다. 두 경우 모두 **같은 본문 모양**(저장소별 상태 · 스위치 상태)을 내고 에러 코드 봉투를 쓰지 않는다 — 판정 §health 부분 실패 판정 | 원본 architecture.md §3(healthcheck가 HTTP 결과로 판정) · 11_glossary/02 채번 보류 · 이 문서 판정 · OBS-05 | 항상 200이면 Compose healthcheck가 저장소 불가를 보지 못해 "api healthy = 접속을 받을 준비가 됐다"가 거짓이 된다 · 에러 봉투로 바꾸면 불가 순간에 저장소별 상태가 사라져 어느 저장소가 원인인지 응답에서 읽을 수 없다 | 전부 가용 → 200 · redis 정지 → 503 · 본문의 저장소별 상태에 redis만 불가 · 두 응답의 본문 필드 집합 동일 | OBS-05 | 해당 없음 — 관측 | 해당 없음 — 코드 없음(판정) |
| **REQ-OBS-10** | /api/v1/health와 /metrics는 **무인증 공개 표면**이다. 응답에 업무 데이터 · 비밀(접속 문자열 · 자격 증명 · 토큰)을 싣지 않는다 — health는 저장소별 상태 · 스위치 상태 · 측정 조건(커밋 해시 · 메모리 프로파일 · 용량 티어 — 비밀 아님)만, metrics는 집계 수치와 파라미터가 바인딩된 쿼리 문형만 낸다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · 원본 architecture.md §18 · OBS-01 · OBS-05 | 인증을 걸면 healthcheck가 로그인을 요구하고 로그인은 api가 떠야 되는 순환이 생긴다 · 업무 데이터가 실리는 순간 "호출 주체가 기계이고 응답에 업무 데이터가 없다"는 공개 판정의 근거가 무효가 된다 | 무토큰 요청 → 200 또는 503(health) · 200(metrics) · 응답 본문에서 비밀 · 업무 값 문자열 검출 0 | OBS-01 · OBS-05 · OBS-06 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-11** | 스위치 전부(정본 02_features/13)의 상태를 health 본문과 /metrics 레이블로 노출한다. 노출값은 **기동 시 실제로 주입된 구현**을 기준으로 하며 환경변수 문자열을 그대로 옮기지 않는다. SW-07은 밀리초 값을 내고, SW-01 off는 부팅 경고 상태를 함께 낸다. **health 본문은 측정 기록 4요소 중 나머지 셋(커밋 해시 · 메모리 프로파일 · 용량 티어)도 기동 시 주입값으로 함께 낸다** — 모르면 null이고 추정값으로 채우지 않는다(W5 판정 · 필드 모양 [../07_api/10_metrics.md](../07_api/10_metrics.md)) | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 공통 규칙 · 원본 implementation_plan.md §4.1 · D-10 · OBS-06 | 노출이 없으면 기록자가 환경변수를 손으로 옮겨 적다 틀려 같은 조건이라 믿은 두 측정의 조건이 다르다 · 문자열을 옮기면 오타로 기본 구현이 주입된 경우에도 off로 표시된다 | 스위치별 off 기동 → health · metrics 두 자리의 상태 일치 · 잘못된 값의 환경변수 → 실제 주입 구현이 노출 · SW-01 off → 경고 상태 · health run의 커밋 해시 = 실행 중 이미지 커밋 · 티어 환경변수 누락 → null | OBS-06 | 해당 없음 — 관측 | 해당 없음 |
| **REQ-OBS-12** | OBS 표면은 **스위치를 바꾸지 않는다** — 읽기 전용이다. 전환은 환경변수와 api 재기동뿐이다 | D-06 · docs_plan 보정 #14 · OBS-06 | 전환 표면을 두면 런타임 토글이 되어 경로 안 분기로 돌아가고, 측정 중 스위치가 바뀌어 한 기록 안에서 조건이 섞인다 | health · metrics 표면에 쓰기 메서드 부재 확인 | OBS-06 | 해당 없음 — 관측 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-OBS-08~12 = **5** · 문서 전체 REQ = 7 + 5 = **12**(REQ-OBS-01~12 · 결번 없음)
- OBS는 유효 에러 코드가 없다. metrics 네임스페이스는 정의만 있고([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)) 이 문서의 판정도 코드를 요구하지 않는다.

## health 부분 실패 판정

W1이 채번 보류로 넘긴 자리다. 판정은 **HTTP 상태로 가용 여부를, 본문으로 원인을** 말하는 것이다.

| 저장소 상태 | HTTP | 본문 | Compose healthcheck | 쓰는 쪽의 해석 |
|------|------|------|------|------|
| 셋 모두 가용 | 200 | 저장소별 상태 · 스위치 상태 | healthy | 접속을 받을 준비가 됐다 |
| 하나 이상 불가 | **503** | **같은 모양** — 불가 저장소 표시 | unhealthy | 어느 저장소인지는 본문이 말한다 |
| api 자체 불가 | 응답 없음 | 없음 | unhealthy | 컨테이너 · 프로세스 장애 |

- 검산: 판정 행 = **3**
- **판정: 부분 실패는 503 + 저장소별 상태 본문이며 에러 코드는 없다.** Compose healthcheck는 HTTP 결과만 보고(원본 architecture.md §3의 healthcheck는 HTTP 요청 도구 한 줄이며, 그 도구는 2xx가 아니면 실패로 끝난다), 기동 순서와 "healthy = 준비됨"의 뜻이 이 상태 코드에 걸려 있다. 본문은 에러 봉투가 아니라 정상 응답과 같은 진단 본문이다 — 코드를 붙일 자리가 없고 붙일 필요도 없다.
- **B형 — Redis 중단 실험에서 api가 unhealthy로 표시되는 것은 정상이다.** 그 순간에도 조회 API는 degrade로 200을 내고 최신값만 503이다. 반대 설계(Redis 불가를 healthy로 취급)는 health가 "캐시 계열만 죽었다"와 "봉인 계열까지 죽었다"를 가르지 못한다. 파생 지침 — 웹 화면은 health로 기능 가용 여부를 판단하지 않는다. 각 표면의 응답이 판단 근거다.
- **Docker Compose의 재시작 정책은 unhealthy로 컨테이너를 재시작하지 않는다.** 503은 진단 신호이며 재시작 트리거가 아니다 — 재시작은 프로세스 종료에만 걸린다(원본 architecture.md §17 api 행의 "Compose restart 정책으로 자동 재기동"은 컨테이너 중단의 경우다).

| 버린 대안 | 실패 시나리오 |
|------|------|
| ① 항상 200 + 본문에 저장소별 상태 | Compose healthcheck가 상태 코드만 보므로 저장소가 모두 죽어도 api가 healthy로 남고, 기동 대기(depends_on)가 뜻을 잃는다 |
| ② 503 + 에러 봉투(metrics 네임스페이스 코드) | 봉투가 본문을 대신해 불가 순간에 어느 저장소가 원인인지 사라진다 · 원본에 실패 코드가 없는 표면에 코드를 채번하면 미러 · 추적성 표에 발생 표면이 health 하나뿐인 코드가 생긴다 |
| ③ 207 Multi-Status | WebDAV 의미의 상태라 healthcheck 도구 · 부하 도구가 성공(2xx)으로 읽어 ①과 같은 실패가 난다 |

- 검산: 버린 대안 = **3**

## 조회 계약 — 2계층 조정값

| 조정값 | 읽는 자리 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 · 소유처 |
|------|------|------|------|------|------|
| 저장소 메트릭 수집 주기 | MetricsModule 수집 타이머 | 기동 시 | 스크레이프마다 조회 | 기동 거부 | 15초 · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| E2E 게이지 창 | 주기 쿼리 조건 | 쿼리 시 | 창 없는 전 기간 분위수 | 기동 거부 | 최근 5분 · 상동 |
| 메모리 샘플 키 수 · 주기 | 접두별 샘플링 | 수집 주기 | 전수 계산 | 기동 거부 | 캐시 계열 무작위 200 · rt · alarm 순환 10 · stream 2키 직접 · 수집 주기마다(W6) · 상동 |
| health 저장소별 타임아웃 | health 처리 | 요청마다 | 무기한 대기 | 기동 거부 | 미정 · [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| Compose healthcheck 주기 · 재시도 | Compose 설정 | 기동 · 실행 중 | healthcheck 없는 api | 기동 순서 미보장 | 미정 · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) |

- 검산: 조정값 = 수집 주기 · 게이지 창 · 샘플링 · health 타임아웃 · healthcheck 주기 = **5**

## 실패 시 보이는 것 전수

| 상황 | 드러나는 형태 | 코드 또는 지표 | 요구 |
|------|------|------|------|
| 저장소 하나 이상 불가 | health 503 · 저장소별 상태 | 코드 없음 | REQ-OBS-09 |
| 저장소 하나가 응답 없음(멈춤) | health가 타임아웃 안에 503 | 코드 없음 | REQ-OBS-08 |
| 저장소 통계 수집 실패 | 그 계열만 빈다 · /metrics는 200 | 수집 오류 지표 | REQ-OBS-03 |
| 레이블 카디널리티 폭증 | 스크레이프 지연 · 응답 크기 증가 | /metrics 응답 크기 | REQ-OBS-06 |
| E2E 게이지 쿼리 부하 | 측정 대상에 쿼리 부하 추가 | ClickHouse 쿼리 로그 | REQ-OBS-05 |
| 스위치 환경변수 오타 | 기본 구현 주입 · 노출값은 실제 구현 | 스위치 상태 레이블 | REQ-OBS-11 |

- 검산: 상황 = **6** · 전부 HTTP 에러 코드 없음

## 기능 → REQ 대응 검산

[../02_features/11_metrics.md](../02_features/11_metrics.md)의 기능 6개 전부가 적어도 하나의 REQ에 대응한다.

| 기능 ID | 기능명 | 대응 REQ |
|------|------|------|
| OBS-01 | 앱 메트릭 통합 노출 | REQ-OBS-01 · 02 · 06 · 07 · 10 |
| OBS-02 | 저장소 메트릭 수집 | REQ-OBS-01 · 03 · 06 |
| OBS-03 | 키 계열별 메모리 샘플링 | REQ-OBS-04 |
| OBS-04 | E2E 지연 게이지 | REQ-OBS-05 |
| OBS-05 | 헬스체크 | REQ-OBS-08 · 09 · 10 |
| OBS-06 | 스위치 상태 노출 | REQ-OBS-10 · 11 · 12 |

- 검산: 기능 6 중 대응 REQ 있음 6 · 누락 0 = **6** · 기능에 대응하지 않는 REQ 0(유령 0). REQ 총수를 세는 자리는 §요구사항 — 헬스체크 · 공개 · 스위치 상태의 검산 하나다

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| docs_plan 보정 #12 health · metrics 소유 | OBS가 두 표면을 소유한다 — REQ-OBS-01 · 08 | [../07_api/10_metrics.md](../07_api/10_metrics.md) |
| docs_plan 보정 #14 스위치는 표시 전용 | REQ-OBS-12 — 전환 표면 없음 | [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) |
| 원본 implementation_plan.md §4.1 스위치 상태 노출 | REQ-OBS-11 | [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) |
| 보정 7.1~7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| health 본문 필드 이름 · 모양 | "각 저장소 헬스체크"(원본 architecture.md §11)뿐이다 | 미설계 — 이 문서는 필드 내용만 고정 | [../07_api/10_metrics.md](../07_api/10_metrics.md)(W5) |
| 스위치 상태 레이블 이름 · 메트릭 이름 규약 | 없다 | **W6 판정** — obs_switch_info(switch · env · value · impl) · 이름 규약 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| OBS의 APP_ROLE · 역할 분리 시 /metrics 집계 위치 | 원본 미지정 | 미확인(W1 등재) | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)(W3) |
| observability 프로파일 구성원 | prometheus · grafana · alertmanager · tempo 표기 불일치 | **W6 판정** — 구성원 prometheus · grafana 2 · alertmanager 채택하지 않음(수신처 없음 · D-02) · tempo 현 범위 밖 · 조건부 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) |
| 관측 스택 on/off가 수치에 주는 영향 | "상대 비교용"(원본 architecture.md §14) | 미확인 — 확정 전 임의 값 고정 금지 | EXP-38 · [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md) |
| 수집 주기 · 게이지 창 · 샘플 수의 측정 부하 | 없다 | 미확인 — 확정 전 임의 값 고정 금지 | EXP-38 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [../02_features/11_metrics.md](../02_features/11_metrics.md) — OBS 기능 목록 · 관측 스택과의 경계
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — health · metrics 공개 판정
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 노출 대상 스위치 전수
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — /api/v1/health · /metrics 표면
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 메트릭 전수 · 이름 규약
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 4요소 병기 · 정밀 측정 세션
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 스위치 on/off 비교 · 축출 연쇄 인수 기준
