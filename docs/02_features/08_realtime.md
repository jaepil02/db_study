# RLT — 실시간 기능 명세

> **대상**: 실시간(RLT · NestJS realtime 모듈 · 설비 가동 · HMI 개요 plant 모듈) 기능 목록 · 기능별 경계 · 스위치 교체 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID RLT-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — 웨이브 6 코드 수정 반영(r5-code 검수 M4 · L7) — RLT-10에 **지우는 동안 켜기 거절**(끄기는 받는다) · 켜기 중간 실패 되돌림 — 기능 수 불변
> **개정일**: 2026-10-11 — **D-16 설비 가동 · HMI 개요 신설**(사용자 결정 2026-10-11 결정 3 · 공용 계약 packages/shared plant.ts) — **RLT-10 설비 가동 스위치**(실행 중 켜고 끄기 · Redis 봉인 계열 ctl:plant:power · 기동 기본값 SENSOR_AUTOGEN · 수집기 역할이 1초마다 따른다) · **RLT-11 HMI 설비 개요**(카드 라인 30대 지금 값 · 상태 4 · 초당 점 · Redis만) 신설 — RLT 현행 8 → **10**(채번 9 → **11**) · 단계 S5 **2** 신설 · 표면별 REST 4 → **6** · 도입 단락 "자기 저장 객체가 없다" → Redis 제어 키 하나만 쓴다 · 의존 도메인 COL · SIM · GEN 행 · 실패 표 3행
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 삭제**(사용자 결정 2026-10-11) — **RLT-08 알람 푸시 폐지 · 결번** · RLT-05 첫 메시지 인증(AUT-04) → **핸드셰이크 Host · Origin 검사(AUT-07)** · 도입 단락 ch:alarm · 경계 표 알람 행 · 의존 도메인 ALM 행 · AUT 행(인가 → 출처 검사) · 실패 표 인증 실패 표현 삭제 — RLT 9 → **8**(결번 1) · (리드 판정 — 도메인 11 → 8) AUT-07 인용 → 횡단 출처 방어 **REQ-GLB-25 · 26**(옛 AUT 도메인 폐지) · D-16 정리(d4 전역 sweep) — 폐지 실험을 확정 수단으로 가리키던 자리 교정(EXP-07)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — "표면 번호는 W5 몫" → 각 API 문서가 채번(W5 완료) · 최신값 갱신 주체 행 행선지 ADR(W3) → ADR-10(잠정 ingest) · SW-11 · EXP-15
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(구독 방식 · 푸시 조정값 소유처) — 기능 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 메트릭 이름 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W5 판정 반영 — RLT-07 느린 구독자 절단 — 브라우저 단위 소켓 송신 대기량 한도 · Redis 출력 버퍼는 api 구독 연결 보호의 최후선으로 가름 — 기능 수 불변
> **개정일**: 2026-09-24 — W4 판정 반영 — RLT-09 무효화 체인 ⑤단 → **⑥단**(6단 번호 표기) — 기능 수 불변
> **원천**: 원본 data_flow.md §2 · §5 · §7.2 · §9 · §9.1 · §9.2 · §12.2 · §16 · §17(커밋 ff66a37) · 원본 architecture.md §5 · §8.1 · §8.2 · §11 · §11.2 · §17(커밋 ff66a37) · 원본 implementation_plan.md §4.1 · §5 S2 · S4 · §7.2 · §7.4(커밋 ff66a37) · [13_switch_matrix.md](./13_switch_matrix.md) SW-02 · SW-06 · SW-07 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) STALE 판정

RLT는 **"지금 값"을 ClickHouse에 닿지 않고 돌려주는 도메인**이다. 최신값은 Ingest가 쓴 Redis Hash(rt:latest)에서 읽고, 실시간 변화는 Ingest가 발행한 Pub/Sub(ch:rt)을 WebSocket으로 밀어준다. PostgreSQL · ClickHouse 저장 객체가 없다 — 설비 가동 스위치(RLT-10)가 Redis 실행 중 제어 키 ctl:plant:power 하나를 쓰는 것 말고는 읽기만 한다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)).

**설비 가동 · HMI 개요(RLT-10 · 11)는 D-16으로 들어온 현장 화면의 백엔드다**(사용자 결정 2026-10-11 결정 3 — 카드 생산 라인 3개 × 공정 10 = 설비 30). 설비 가동은 센서 데이터를 저절로 만드는 가상 공장(가상 PLC · 모드 A · 수집기 폴링)을 실행 중에 켜고 끈다 — 끈 것이 기본이다(사용자 결정 2026-10-03 "저절로 쌓이지 않게" 유지). HMI 개요는 30대의 지금 값을 Redis에서 한 번에 읽어 상태 4(가동 · 대기 · 정지 · 통신 끊김)와 초당 점 수를 낸다 — 알람 · 원격 조작은 없다.

**최신값 조회가 ClickHouse에 도달하면 안 된다.** 대시보드는 초당 수십~수백 회 최신값을 부르는데, ClickHouse는 대량 스캔용이라 "태그의 마지막 1행" 점조회에 오히려 약하다. 이 지점이 Redis를 중간에 두는 가장 직접적인 이유이고(원본 data_flow.md §5), SW-02가 바로 이 역할을 끄고 켠다. 그래서 RLT의 실패 규칙은 반직관적이다 — Redis에 **접속할 수 없으면** ClickHouse로 우회하지 않고 503을 낸다.

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 각 API 문서의 표면 요약 표가 채번한다).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **RLT-01** | 설비 전체 최신값 | 설비의 전체 태그 최신값을 rt:latest:{device_id} HGETALL **1회**로 읽어 돌려준다. 값은 "ts,value,quality" 문자열이다. 브라우저 직결이다. SW-02 off면 같은 응답을 ClickHouse argMax 점조회로 만든다(실험 전용) | S2 | F-03 | SW-02 | 07_api/06_realtime | Redis rt:latest(읽기) |
| **RLT-02** | 단일 태그 최신값 | 태그 하나의 최신값을 돌려준다. rt:latest는 설비 단위 Hash라 태그 → 설비 해석이 먼저 필요하다(태그 메타) | S4 | F-03 | SW-02 | 07_api/06_realtime | Redis rt:latest · cache:tagmeta(읽기) |
| **RLT-03** | STALE 판정 · 메타 부착 | 현재 − ts가 태그 스캔 주기 × 배수(현행 3)를 넘으면 STALE(5) 경고를 단다. **ingested_at으로 판정하지 않는다** — 백프레셔로 늦게 적재된 값이 "방금 갱신"으로 보여 멈춘 설비를 살아 있는 것으로 표시한다. 태그명 · 단위는 cache:tagmeta에서 붙인다 | S2 | F-03 | 해당 없음 | 07_api/06_realtime | Redis cache:tagmeta(읽기) |
| **RLT-04** | 빈 키 복원과 503 | **키만 비어 있으면**(재시작 직후 복원 전 · 신규 설비) ClickHouse에서 태그별 최신 1행을 최근 창(현행 10분) argMax로 복원하고 lock:rebuild로 설비당 1회만 실행한 뒤 결과를 Redis에 워밍해 200을 낸다. **Redis에 접속할 수 없으면** 이 폴백을 타지 않고 503을 낸다 | S2 · S6 | F-03 · F-10 | 해당 없음 | 07_api/06_realtime | ClickHouse tag_raw(읽기) · Redis rt:latest · lock:rebuild |
| **RLT-05** | WebSocket 구독 | /ws/realtime 핸드셰이크에서 Host · Origin을 검사하고(출처 방어 REQ-GLB-26), 구독 메시지로 받은 설비 목록에 대해 ch:rt:{device_id}를 구독한다. 소켓 ↔ 설비 매핑은 인스턴스 안 구독 레지스트리가 갖는다. SW-06 off면 Pub/Sub 없이 Ingest가 게이트웨이를 직접 부른다(실험 전용) | S2 | F-07 | SW-06 | 07_api/11_websocket | Redis ch:rt(구독) |
| **RLT-06** | 스로틀 병합 | 창(현행 100 ms) 안에 들어온 같은 태그의 중간값을 버리고 최종값만 한 프레임으로 보낸다. 사람 눈은 초당 10회 이상의 숫자 변화를 읽지 못한다 — 그 이상은 낭비이고 브라우저 탭을 멈춘다. SW-07이 창 크기이며 0이면 무제한 전송이다 | S4 | F-07 | SW-07 | 07_api/11_websocket | 없음 — 메모리 |
| **RLT-07** | 연결 관리 · 재연결 동기화 | 주기 ping(현행 30초)에 pong이 연속으로 오지 않으면(현행 3회) 소켓을 닫고 구독을 정리한다. 느린 브라우저는 게이트웨이의 소켓 송신 대기량 한도로 그 소켓만 절단하고(4413), Redis Pub/Sub 출력 버퍼 한도는 api 구독 연결 보호의 최후선으로 둔다(W5). 클라이언트는 지수 백오프로 재연결하고 **재연결 직후 REST 최신값을 1회 읽어** 끊긴 동안의 공백을 메운다 — Pub/Sub은 전달을 보장하지 않는다 | S4 | F-07 · F-03 | 해당 없음 | 07_api/11_websocket · 07_api/06_realtime | Redis ch:rt · rt:latest |
| **RLT-09** | 무효화 신호 중계 | 마스터 쓰기 뒤의 캐시 무효화 신호를 WebSocket으로 브라우저에 전달해 브라우저 쿼리 캐시를 무효화하게 한다(무효화 체인 ⑥단 — 6단 번호 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)). ch:cacheinv에 구독자를 더하는 것만으로 된다(원본 implementation_plan.md §7.4) | S4 | F-05 | 해당 없음 | 07_api/11_websocket | Redis ch:cacheinv(구독) |
| **RLT-10** | 설비 가동 스위치 | 센서 자동 생성(가상 PLC 포트 · 모드 A 틱 · 수집기 폴링)을 **실행 중에 켜고 끈다.** 실행 중 상태는 Redis 봉인 계열 ctl:plant:power(Hash state · changed_at — TTL 없음)이고 키가 없으면 기동 기본값 SENSOR_AUTOGEN(로컬 Compose off)을 쓴다. 쓰기는 같은 상태면 그대로 두는 원자 스크립트 하나 · 응답은 "적었다"이고 수집기 역할(APP_ROLE all · collector)이 1초마다 읽어 켜기(수집 정의 → 포트 → 틱 → 폴링) · 끄기(역순)로 따른다. 수집기 역할은 기동 때 키를 지워 **재기동이면 기동 기본값(꺼짐)부터** 시작한다. 센서 데이터를 지우는 동안(GEN-14)은 켜기를 거절하고 끄기는 받는다 · 켜기가 중간에 실패하면 앞서 켠 것을 되돌리고 다음 읽기에서 다시 맞춘다. health run.sensorAutogen은 이 프로세스가 지금 실제로 만들고 있는지(실효값)다 | S5 | F-01 · F-09 | 해당 없음 | 07_api/06_realtime | Redis ctl:plant:power(읽기 · 쓰기) |
| **RLT-11** | HMI 설비 개요 | 카드 라인 활성 설비 30대(시연 설비 · 슬라이스 제외)의 rt:latest를 **파이프라인 1회**로 읽어 설비별 상태 4 · 핵심 값 · 태그별 지금 값 · 형식 · 주기 · 마지막 갱신 · 초당 점 수와 합계 · 종류별 초당 점 수를 낸다(1초마다 부른다). 상태는 설비 가동 꺼짐 → 전부 정지 · 마지막 갱신이 5초 넘음 → 통신 끊김(켠 지 5초 안이면 정지) · 그 밖 STATE 태그 값(2 가동 · 1 대기 · 0 정지 · BAD_COMM이면 끊김)이다. 초당 점 수는 같은 프로세스에 수집기가 있으면 실제 발행을 센 값(measured) · 없으면 통신 중 설비의 주기 합(nominal)이고 기준을 본문에 적는다. 메타(라인 · 설비 · 태그 · 종류)는 api 프로세스 메모리 사본(PostgreSQL에서 10초마다 다시 읽음 · 실패면 마지막 사본)이라 요청마다 PostgreSQL · ClickHouse를 부르지 않는다 | S5 | F-03 | 해당 없음 | 07_api/06_realtime | Redis rt:latest · ctl:plant:power(읽기) · PostgreSQL site · production_line · device · tag_master(10초 사본) |

- 검산: 현행 RLT-01~07 · 09 · 10 · 11 = **10**. 단계별(첫 도입 기준) S2 4(RLT-01 · 03 · 04 · 05) + S4 4(RLT-02 · 06 · 07 · 09) + S5 2(RLT-10 · 11) = **10** · 결번 RLT-08 알람 푸시 **1**(D-16 폐지 · 재사용 금지) · 채번 10 + 1 = **11**
- 표면별: REST(07_api/06_realtime) 6(RLT-01 · 02 · 03 · 04 · 10 · 11) + WebSocket(07_api/11_websocket) 4(RLT-05 · 06 · 07 · 09) = **10**. RLT-07은 재연결 동기화에서 REST 최신값을 한 번 더 부른다.

## 키가 빈 것과 Redis가 죽은 것

RLT-04의 두 갈래다. 같은 "값이 없다"가 반대의 응답을 만든다(원본 data_flow.md §5 · §12.2).

```plain
최신값 요청
├─ Redis 접속 불가 ──────────────────────────────── 503 realtime.latest_unavailable
├─ 키 있음 ──────────────────────────────────────── 200 · STALE 판정(RLT-03)
└─ 키 없음(Redis 정상)
   ├─ 설비가 마스터에 없음 ───────────────────────── 404 common.not_found
   └─ 설비가 마스터에 있음 → 락 획득 → ClickHouse 복원 → 워밍 ─ 200
```

- **B형 — Redis가 죽으면 최신값 API는 실패한다.** 우회하면 대시보드의 초당 수백 회 점조회가 전부 ClickHouse로 쏟아져 적재 삽입까지 밀린다. 이 503은 결함이 아니라 적재 경로를 지키는 차단기이며, 클라이언트도 같은 이유로 시계열 조회로 대체 호출하지 않는다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)).
- **키만 빈 경우의 복원은 설비당 1회로 끝난다.** 락이 single-flight를 보장하고 결과가 워밍되므로 부담이 작다 — 전 요청을 ClickHouse로 보내는 것과 규모가 다르다.

## 스위치가 교체하는 것

| 스위치 | 교체 대상 기능 | off일 때 | 이 도메인이 지키는 조건 |
|------|------|------|------|
| SW-02 REDIS_LATEST_CACHE | RLT-01 · 02 읽기 | ClickHouse argMax 점조회 | **읽기 포트만 교체한다** — Ingest의 rt:latest 갱신(ING-08)과 ch:rt 발행은 그대로라 WebSocket 경로는 영향이 없다 |
| SW-06 REDIS_PUBSUB_FANOUT | RLT-05 · 08 수신 | 발행자가 게이트웨이를 직접 부른다 | 단일 인스턴스에서만 성립한다 — 인스턴스가 둘이면 다른 인스턴스의 소켓에 닿지 않는다 |
| SW-07 WS_THROTTLE_MS | RLT-06 | 0 — 병합 없이 매 갱신 전송 | 프레임 폭증의 측정이 목적이다 |

- 채번 · 포트 · 원본 예상치의 정본은 [13_switch_matrix.md](./13_switch_matrix.md)다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| RLT-01 · 02 | rt:latest에 쓰지 않는다 — 워밍(RLT-04)만 예외다 | ING-08 |
| RLT-01 · 02 | 시간 범위 이력을 돌려주지 않는다 | TSQ-01 |
| RLT-03 | STALE을 저장하지 않는다 — 조회 시점 판정이다 | 해당 없음 |
| RLT-04 | Redis 불가 시 ClickHouse로 우회하지 않는다 | 해당 없음 — 설계상 금지 |
| RLT-05 | Pub/Sub 메시지를 저장하지 않는다 — 저장은 반드시 별도 경로다 | ING-03 |
| RLT-09 | 무효화를 결정하지 않는다 — 신호를 옮길 뿐이다 | MST-08 |
| RLT-10 | 포트 · 틱 · 폴링을 표면 프로세스에서 직접 켜고 끄지 않는다(키만 쓴다) · 직접 비교 · 흐름 시연의 센서 발행을 막지 않는다(그 둘은 Stream 직결) · 센서 데이터를 지우지 않는다 | 수집기 역할의 설비 가동 적용(SIM-01 · GEN-05 · COL-01) · GEN-12 · 13 · GEN-14 |
| RLT-11 | 알람 · 원격 조작을 하지 않는다(D-16) · 추이(이력)를 돌려주지 않는다 · 값을 ClickHouse에서 보충하지 않는다 | 해당 없음 — 범위 밖 · TSQ-01(상세 추이) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| ING | ING → RLT | Pub/Sub · 저장소 경유 | ch:rt · rt:latest. **RLT의 신선도는 ING의 갱신 주기에 묶인다** |
| MST | MST → RLT | 저장소 경유 · Pub/Sub | cache:tagmeta · ch:cacheinv |
| 횡단 방어선 | 방어선 → RLT | 출처 검사 | REST 직결 표면 CORS · Host 대조 · WebSocket Origin 검증(REQ-GLB-25 · 26 — 도메인 기능 아님) |
| TSQ | TSQ → RLT | 저장소 경유 | 진행 구간 분할(TSQ-08)이 rt:latest를 읽는다 |
| SIM · GEN · COL | RLT → 수집기 역할 | 저장소 경유(Redis ctl:plant:power) | RLT-10이 쓴 키를 수집기 역할이 1초마다 읽어 가상 PLC 포트(SIM) · 모드 A 틱(GEN-05) · 폴링(COL)을 켜고 끈다 — 표면 프로세스와 수집기 프로세스가 갈려도 같은 키로 따른다 |
| GEN | GEN → RLT | 포트(PLANT_POWER_PORT) | 센서 데이터 지우기(GEN-14)가 가동 중 409를 가르려고 가동 상태를 읽는다 |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| Redis 접속 불가 | 최신값 API 실패 · WebSocket 푸시 중단 · 설비 가동 읽기 · 바꾸기 실패 · HMI 개요 실패 | realtime.latest_unavailable/503 | RLT-01 · 02 · 04 · 05 · 10 · 11 |
| 설비 가동 키를 수집기가 읽지 못함 | 지금 상태(켜짐 · 꺼짐)를 유지하고 상태가 바뀔 때만 경고 · 다음 읽기에서 다시 맞춘다 — 모르는 상태를 기본값으로 덮지 않는다 | 로그 · durable_wrapper_failures_total{prefix="ctl"} | RLT-10 |
| HMI 개요 메타를 한 번도 읽지 못한 채 PostgreSQL 불가 | 거절 — 사본이 있으면 마지막 사본으로 200 | common.postgres_unavailable/503 | RLT-11 |
| 설비 가동을 켠 직후 · 수집이 끊긴 설비 | 켠 지 5초 안은 정지 · 그 뒤 5초 넘게 갱신이 없으면 통신 끊김 | 본문 state offline · totals.offline | RLT-11 |
| 설비 · 태그가 마스터에 없음 | 거절 | common.not_found/404 | RLT-01 · 02 |
| ClickHouse 중단(최신값 갱신 주체가 Ingest인 현행) | **대시보드가 멈춘다** — 값은 그대로이고 STALE 경고가 붙는다 | STALE 비율 | RLT-03 |
| 수집 정지 · 생성 모드의 과거 ts | STALE 경고 | STALE 비율 | RLT-03 |
| 느린 구독자 | 그 소켓만 절단(4413) · 클라이언트 재연결 — 출력 버퍼 한도 초과면 인스턴스 전원 푸시 중단(4503) | WebSocket 연결 수 · 종료 수 | RLT-07 |
| WebSocket Origin · Host 불일치 | 연결 종료 — HTTP 코드가 아니다 | 종료 코드 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) | RLT-05 |
| 스로틀 창 0(SW-07 off) | 프레임 폭증 · 이벤트 루프 지연 | 초당 프레임 · nodejs_eventloop_lag_p95_seconds | RLT-06 |

- **B형 — ClickHouse가 멈췄는데 대시보드가 멈추는 것은 현행 설계의 알려진 결합이다.** 최신값 갱신이 삽입 성공 뒤에 오기 때문이다. 결합을 끊는 안(Collector 갱신)은 S6 실측으로 결정한다(보정 7.2) — 그 전까지는 STALE 표시가 유일한 신호다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.2 ClickHouse 중단 시 최신값 정지 | RLT-03 STALE 표시로 드러낸다 · 갱신 주체 결정은 S6 | [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) · ADR [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) |
| 보정 7.4 브라우저가 무효화 체인에서 빠짐 | RLT-09가 ⑥단의 중계를 맡는다 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 보정 7.5 TTL 강제 수단 | rt:latest 워밍(RLT-04)은 봉인 계열 래퍼로 쓴다 — TTL을 붙이지 않는다. lock:rebuild는 TTL 필수 래퍼다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.1 · 7.3 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 구독 방식 | API 표는 /ws/realtime?devices=1,2,3(쿼리 파라미터 · 원본 architecture.md §11), 흐름 시퀀스는 연결 뒤 subscribe 메시지(원본 data_flow.md §9) | 닫힘 — subscribe 메시지로 고정 · 쿼리 파라미터 구독을 받지 않는다 — [../07_api/11_websocket.md](../07_api/11_websocket.md) | [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5) |
| 최신값 조회 on/off 차이 | 원본 예상치 off 30~150 ms · on 0.3~1 ms | 미확인 — 확정 전 임의 값 고정 금지 · 확정 수단 없음(EXP-07 D-16 폐지 · S2 기록 013) | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 최신값 갱신 주체 | 현행 Ingest · 대안 Collector | S6 실측 결정 — ADR-10 잠정(ingest) · 교체 포트 SW-11 · 비교 실험 EXP-15 | [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-10 |
| STALE 배수 · 복원 창 · ping 주기 · 스로틀 창 | 현행 참고 값만 있다 | 닫힘 — 소유처 확정: STALE 판정 계약 · 복원 창 · ping 주기 · 스로틀 창은 06_pipeline/05 §푸시 조정값 · 소켓 송신 대기량 한도는 07_api/11 — [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) | [../07_api/06_realtime.md](../07_api/06_realtime.md) · [../07_api/11_websocket.md](../07_api/11_websocket.md)(W5) |

## 관련 문서

- [../03_requirements/09_realtime.md](../03_requirements/09_realtime.md) — REQ-RLT 동작 계약
- [../07_api/06_realtime.md](../07_api/06_realtime.md) — 최신값 REST 표면
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — WebSocket 프로토콜
- [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) — F-03 · F-07 기전
- [06_ingest.md](./06_ingest.md) — 최신값 갱신 · ch:rt 발행
- [13_switch_matrix.md](./13_switch_matrix.md) — SW-02 · SW-06 · SW-07 정본
