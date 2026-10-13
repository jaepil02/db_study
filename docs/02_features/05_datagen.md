# GEN — 데이터 생성 기능 명세

> **대상**: 데이터 생성(GEN · NestJS datagen 모듈 · 라이브 실행 runs 모듈) 기능 목록 · 주입 모드 2종(A Modbus 경유 · B Stream 직결) · **흐름 시연 실행(EXP-FLOW)** · **직접 비교 실행 · 센서 데이터 지우기(D-16)** · SIMULATED 표기 · 기능별 경계 · 실패 시 보이는 것 — 기능 ID GEN-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — GEN-13 넣기 비우기 일 파티션째(PG 일 파티션은 미리 만든다) → **하루 단위째(ClickHouse 일 파티션 · PostgreSQL 하루 칸 — 칸은 넣을 때 생긴다)** · 디스크 크기 병합 뒤 → **ClickHouse 병합 · PostgreSQL 구간 칸 압축 뒤**(압축 실패는 경고 · 넣기는 완료) · 조회 대결은 압축된 칸을 읽는다 · 도입 단락에 비교 사본 엔진 — 기능 수 불변
> **개정일**: 2026-10-11 — **⑤ 실시간 그래프**(사용자 결정 2026-10-11 — 세 패널 모두 실시간) — GEN-13 범위 확장(새 기능 ID 없음) — 결과를 **진행 중에도 실행 객체에 채운다**(넣기는 발행 시작부터 1초마다 중간값 · 크기는 2초마다 · 조회 대결 · 무결성은 질문 · 시험마다) · 보관은 **완료한 실행의 결과만** · 도입 단락 ⑤ 화면 문장에 실행 중 실시간 — 기능 수 불변
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 H1 · H2 · M1~M4) — GEN-12 발행 대상 → **시연 설비 DEMO-FLOW-DEV의 flow 전용 태그 50**(카드 라인 태그 안 씀) · GEN-13 창 KST → **UTC 자정**(넣기 UTC D−4 00:00 · 무결성 UTC D−6 13시) · 넣기 · 무결성 **가동 중 시작 거절** · 넣기 **적체 0 대기** · 조회 **마지막 넣기 미완료면 거절** · 최근 완료 + 마지막 시도 · GEN-14 구간 행 수 · 막는 이유에 **대기줄 적체** · 지우는 동안 실행 시작 · 설비 켜기 거절 — 기능 수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 지우기 신설**(사용자 결정 2026-10-11 결정 2 · 5 · 공용 계약 packages/shared runs.ts · data.ts) — **GEN-13 직접 비교 실행**(compare — 넣기 · 조회 대결 · 무결성 · run_result 보관 · 부분별 최근 결과 · 업무 방해는 실측이 흔들려 사용자 결정으로 삭제) · **GEN-14 센서 데이터 현황 · 지우기** 신설 — GEN 현행 5 → **7**(채번 12 → **14**) · 단계 S5 1 → **3** · 표면 있음 1 → **3** · 주입 모드 B 기능 GEN-12 → **GEN-12 · 13** · 의존 도메인 RLT 행(설비 가동 읽기) · 실패 표 5행(datagen.compare_no_data · data.purge_blocked · SW-09 off 400 · 정리 · 저장소 불가)
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11) — GEN-04 부하 티어 · GEN-06 모드 B 독립 실행기 · GEN-07 모드 C 부하 주입 표면 · GEN-08 모드 D 백필 · GEN-09 생성기 단독 처리량 실측 · GEN-10 대조군 동일 행 백필 · GEN-11 성능 비교 라이브 실행 **폐지 · 결번** · 주입 모드 4 → **2**(A · B — B는 흐름 시연이 쓰는 Stream 직결 경로 · C · D 폐지) · §부하 주입 표면이 GEN 소유인 이유 삭제 · 의존 도메인 AUT 행 삭제(인가 없음) — GEN 12 → **5**(결번 7)
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9) — GEN-12 범위 확장(새 기능 ID 없음) — publish 동안 **조회 3종(센서 시계열 · 센서 지금 값 · 업무 설비 목록)을 readsPerSec로 섞는다**(프로세스 안 호출 · cache-aside 경로 그대로) · 흐름 열 F-02 · F-05 · F-09 → **F-02 · F-03 · F-04 · F-05 · F-09** · 저장소 열에 조회 사본 읽기 — 기능 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — GEN-12 업무 명령 이름 토글 짝(운영 설비 이름을 바꿨다 되돌림) → **시연 전용 설비 DEMO-FLOW-DEV에만 새 이름 명령**(prepare가 없으면 사이트 DEMO-FLOW · 라인 DEMO-FLOW-L · 설비를 명령으로 만든다 · 되돌림 없음 · 운영 행 불변) · 도메인 간선 MST · WRK → **MST**(GEN-12 명령은 마스터 kind만) — 기능 수 불변
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 "시작 · 중단 · 완료 표시 · 소요 시간" · 리드 판정 10) — **GEN-11 성능 비교 라이브 실행 · GEN-12 흐름 시연 실행** 신설(S5 · 표면 07_api/09_datagen #2~#5 · 실행 주체 RunControlModule) — GEN 기능 10 → **12** · 단계 집계 S5 3 → **5** · 표면 있음 1 → **3** · 에러 코드를 내는 기능 1 → **3**(datagen.run_in_progress/409) · 소유 테이블 없음 서술에 실행 수명 객체 · 미확인 "생성기 실행 제어 표면" 행 갱신(모드 A~D는 여전히 표면 없음)
> **개정일**: 2026-09-25 — S3 구현 반영 — GEN-06 모드 B 단계 S5 → **S3**(최소분 당김 · 06_pipeline/10 §모드 B 적체 검사 as-built) — 단계 집계 S5 4 → **3** · S3 **1** 신설
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146) — 미확인 "생성 처리량" 미확인 → **워커 1 약 590만 pps**(압축률은 미확인 유지)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — "표면 번호는 W5 몫" → 각 API 문서가 채번(W5 완료) · 과거 ts와 STALE 행 닫힘(실험 프로토콜 규칙으로 강제)
> **개정일**: 2026-09-24 — W7 검수 반영 — GEN-07 · 판정 주체 서술의 스트림 길이 검사 → **미확인 적체 검사**(ADR-21) · 미확인 2행 닫힘(모드 B 검사 · 모드 D 대조군 절차) — 기능 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W3 판정 반영 — 길이 검사의 판정량을 그룹 적체로 교정(ADR-21)
> **원천**: 원본 tech_stack.md §3.3 · §3.4 · §7 · §8(커밋 ff66a37) · 원본 data_flow.md §11 · §11.1 · §11.2 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3(커밋 ff66a37) · 원본 implementation_plan.md §5 S1 · S2(커밋 ff66a37) · D-16(사용자 결정 2026-10-11) · 사용자 결정 2026-10-11(⑤ 실시간 그래프) · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 신호 프로파일 · 주입 모드

GEN은 **실장비가 없는 이 시스템에서 데이터를 만들어 넣는 도메인**이다(원본 tech_stack.md §7). 신호 프로파일 8종으로 값을 만들고, 주입 모드 A(가상 PLC 레지스터 → Collector 폴링) 또는 B(Stream 직결 — 흐름 시연)로 파이프라인 입구에 넣는다. 정상 수집 경로의 단계가 아니라 경로 입구에 데이터를 넣을 뿐이다 — 데이터 평면이지만 흐름의 단계가 아닌 이유다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)).

**생성기가 병목이면 관찰 자체가 무의미하다.** 생성기는 수집 · 적재와 같은 CPU를 나눠 쓴다. S1에서 단독 처리량을 한 번 재 두었다(기록 006 — 워커 1에서도 넉넉하다). 그 실행 도구는 측정 도구와 함께 지웠다(D-16 · [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)).

**GEN은 소유 테이블이 없다.** 생성 벡터는 메모리 상태이고 시드는 실행 인자다([../05_data_stores/README.md](../05_data_stores/README.md)).

**직접 비교 실행(GEN-13)은 같은 센서 데이터를 Redis로 두 DB에 똑같이 넣어 보는 실험이다**(D-16 결정 2). 과거 시각 구간을 Stream에 발행하면 Ingest가 같은 배치를 ClickHouse에 삽입하고 SW-09 gated 게이트가 열린 동안 PostgreSQL 비교 사본(TimescaleDB hypertable · 열 압축 — D-05 부분 개정 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-32)에도 COPY한다 — 그 뒤 넣기 · 조회 대결 · 무결성을 두 저장소에서 잰다. 결과는 앱 경유 시연값이라 기록 정본이 아니지만, ⑤ 화면이 마지막 결과를 계속 보이도록 PostgreSQL run_result에 남긴다(완료한 실행의 결과만). 실행 중에는 실행 객체의 결과를 끝나기 전부터 채워(넣기는 1초마다 · 조회 대결 · 무결성은 항목마다) ⑤가 그 패널을 실시간으로 그린다(사용자 결정 2026-10-11). **센서 데이터 지우기(GEN-14)**는 쌓인 센서 데이터만 지우고 설비 · 태그 · 업무 · 실행 결과를 남긴다(D-16 결정 5).

**흐름 시연 실행(GEN-12)은 측정이 아니라 시연이다**(사용자 요구 2026-09-28). 분산 처리 모니터링 화면(EXP-FLOW)의 실행 패널에서 시작 · 중단하고 진행 단계 · 완료 · 총 소요 시간을 보인다. 결과에 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지가 붙고 측정 기록을 만들지 않는다. **옛 성능 비교 라이브 실행(GEN-11 — Redis를 거치지 않는 perf 직접 재 보기)은 D-16으로 지웠다.**

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 각 API 문서의 표면 요약 표가 채번한다).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **GEN-01** | 신호 프로파일 생성 | 태그마다 프로파일 8종(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) 중 하나로 값을 만든다. 태그 N × 시점 M을 Float64Array · Uint32Array에 한 번에 채우고 piscina 워커로 병렬화한다 — numpy가 없는 대신 TypedArray 벡터와 워커가 벡터화 이득을 낸다. S2는 SINE 1종이다 | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 — 메모리 |
| **GEN-02** | 품질 표지와 결측 표현 | 생성기가 Stream에 직접 싣는 행(모드 B — GEN-12 흐름 시연)은 **전부 SIMULATED(9)**로 싣는다. 결측(DROPOUT)은 BAD를 다는 대신 **행을 생략**한다 — BAD를 달면 생성 데이터 표지가 지워진다(W1 판정). SPIKE는 기저값 위 확률적 이상치다. 모드 A의 표지는 Collector가 단다(COL-05) | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-03** | 시드 고정 | 난수 시드를 고정해 같은 데이터셋을 다시 만든다. 같은 초기 상태에서 반복해야 두 실행의 비교가 성립한다 | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-05** | 모드 A 레지스터 갱신 | PlcSim 레지스터 Buffer를 주기적으로 갱신한다. Collector 폴링을 거치므로 **진짜 E2E 지연과 Modbus 병목**을 잰다. DB 상한은 잴 수 없다 — Modbus가 먼저 막힌다 | S2 | F-01 · F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음(SIM Buffer) |
| **GEN-12** | 흐름 시연 실행 | EXP-FLOW에서 durationSec 동안 api 안의 생성기가 stream:plc:raw에 **엔트리 계약 v1 그대로** pps만큼 발행하고(모드 B — XADD 전 적체 검사 · 위험 단계면 멈췄다 잇는다 · 대상은 시연 전용 설비의 **flow 전용 태그 50**뿐 — 카드 라인 30대의 태그에 쓰면 HMI 지금 값 · 상태가 flow 값으로 거짓이 된다) 1 ÷ bizPerSec초마다 BizWritePort로 업무 명령 master.device.patch를 **시연 전용 설비 DEMO-FLOW-DEV에만**(비활성 · 새 이름 · 되돌림 없음 — 운영 행은 바뀌지 않는다 · prepare가 없으면 사이트 · 라인 · 설비 · flow 전용 태그를 명령으로 만든다) 하나 보내고, 1 ÷ readsPerSec초마다 **조회 하나**(센서 시계열 · 센서 지금 값 · 업무 설비 목록을 차례로 — 표면 뒤의 같은 서비스 메서드를 프로세스 안에서 불러 사람의 조회와 같은 cache-aside 경로를 탄다 · 같은 키 반복과 주기적 새 키로 히트와 미스가 둘 다 생긴다 · 결과는 버리고 실패는 세기만)를 섞은 뒤, grp:ingest 적체가 시작 전 수준으로 돌아올 때까지(상한 30초) 기다린다. 흐름도는 기존 flow 프레임과 조회 메트릭으로 움직인다 — 흐름 계약은 바꾸지 않는다 | S5 | F-02 · F-03 · F-04 · F-05 · F-09 | 해당 없음 | 07_api/09_datagen | Redis stream:plc:raw · stream:biz:cmd(BizWritePort 경유 — 시연 전용 행(site · production_line · device · tag_master DEMO-FLOW 계열) · 원장 쓰기는 명령 워커) · 조회 읽기 — Redis cache:q · rt:latest · cache:devlist · 미스면 ClickHouse · PostgreSQL |
| **GEN-13** | 직접 비교 실행 | /lab ⑤에서 부분 하나(part — ingest 넣기 · query 조회 대결 · integrity 무결성)를 실행 하나로 시작한다(라이브 실행 틀 · 한 번에 하나 · 단계 · 중단 · 실행 종류 compare). **넣기 · 무결성은 설비 가동이 꺼져 있어야 시작한다**(가동 데이터가 같은 대기줄 · 같은 배치에 섞인다). **넣기** — 앞 실행의 대기줄 적체가 0이 된 뒤(상한 30초) 오늘(UTC) 4일 전 00:00(KST 09:00)부터 spanHours(1 · 24 · 72) 구간을 카드 라인 30대 태그 주기대로 다시 만들어 stream:plc:raw에 최대 속도로 발행한다(설비 1초분 = 엔트리 1 · 적체 검사 · 위험 단계면 멈췄다 잇는다 — 비교 행은 버리지 않는다). 발행 전에 사흘치 창(UTC 날 3)을 두 저장소에서 하루 단위째 비우고(ClickHouse 일 파티션 · PostgreSQL 하루 칸 — 칸은 넣을 때 스스로 생긴다) 게이트 cache:dual:active를 켠다 · 적체가 시작 수준으로 돌아오면 게이트를 끄고 행 수(발행 = ClickHouse = PostgreSQL) · 디스크 크기(ClickHouse 병합 · PostgreSQL 구간 칸 열 압축 뒤 — 압축이 실패하면 단계 경고를 달고 압축 전 크기로 재며 넣기는 완료로 끝난다) · 배치 하나 시간(삽입 대 COPY p50 · p95) · COPY 실패를 낸다. **조회 대결** — 마지막 넣기가 완료일 때 그 구간에 4문항(마지막 넣기가 중단 · 실패면 거절)(소량 2 — 센서 1개 최근 1분 · 설비 1대 지금 값 / 대량 2 — 전체 1시간 평균 · 라인별 하루 생산량)을 두 저장소에 같은 뜻으로 묻는다(PostgreSQL은 넣기가 압축한 칸을 읽는다 · 워밍업 1 + 3회 · 중간값 · 승자는 3회 모두 같을 때만). **무결성** — 넣기 사흘 창과 다른 UTC 날의 시험 창(UTC 6일 전 13~14시 — KST 22~23시)에 시험 셋(같은 데이터 두 번 · 등록 안 된 설비 · 고장 값)을 따로 발행해 ClickHouse가 받은 행과 PostgreSQL이 막았는지를 내고 시험 행을 지운다. 결과는 **진행 중에도 실행 객체에 채운다** — 넣기는 발행이 시작되면 1초마다 중간값(보낸 행 · 각 DB에 들어간 행 · 경과 · 초당 행 · 배치 · 초별 점 — 크기는 2초마다 병합 · 압축 전 순간값이라 최종과 다를 수 있다)이고 verify가 ClickHouse 병합 · PostgreSQL 압축 뒤 다시 재서 최종값으로 바꾼다 · 조회 대결 · 무결성은 질문 · 시험 하나가 끝날 때마다 그 줄이 붙는다(⑤가 실행 중인 패널을 실시간으로 그린다 — 사용자 결정 2026-10-11). 종결 직전 run_result에 보관하고(완료한 실행만 결과 — 진행 중 값은 남기지 않는다) 부분별 최근 완료 결과와 마지막 시도를 표면으로 낸다 | S5 | F-09 · F-02 | SW-09 | 07_api/09_datagen | Redis stream:plc:raw · cache:dual:active · ClickHouse tag_raw · 롤업 3 · PostgreSQL plc_tag_raw_control · run_result · (무결성) device · rt:latest |
| **GEN-14** | 센서 데이터 현황 · 지우기 | 현황 — ClickHouse tag_raw 행 · 디스크 크기 · PostgreSQL 비교 사본 행 · 크기 · Redis 대기줄 길이 · 지금 값 키 수 · 마지막 넣기 구간과 그 구간 안 두 저장소 행 수를 낸다(5초 사본). 지우기 — 쌓인 센서 데이터만 지운다: ClickHouse tag_raw · tag_1m · tag_1h · tag_1d 비우기 · PostgreSQL 비교 사본 전부(SECURITY DEFINER 함수) · Redis stream:plc:raw · stream:plc:dlq 엔트리(소비 그룹은 남긴다) · rt:latest 전부 · 조회 사본(cache:q). 설비 · 태그 · 업무 · run_result는 남긴다. 실행 진행 중 · 설비 가동 중(끈 직후 수집기가 아직 도는 동안 포함) · 대기줄에 적재 안 된 엔트리가 남으면 막는다(409 · reason 3) · 지우는 동안은 실행 시작 · 설비 켜기를 거절한다 · 응답은 저장소별 지운 행 수(직전 정확 count) · 걸린 시간 | S5 | 해당 없음 | 해당 없음 | 07_api/09_datagen | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d · PostgreSQL plc_tag_raw_control · Redis stream:plc:raw · stream:plc:dlq · rt:latest · cache:q |

- 검산: 현행 GEN-01 · 02 · 03 · 05 · 12 · 13 · 14 = **7**. 단계별(첫 도입 기준) S1 3(GEN-01 · 02 · 03) + S2 1(GEN-05) + S5 3(GEN-12 · 13 · 14) = **7**
- 결번 GEN-04 · 06 · 07 · 08 · 09 · 10 · 11 = **7**(부하 티어 · 모드 B 독립 실행기 · 모드 C 부하 주입 표면 · 모드 D 백필 · 생성기 단독 처리량 실측 · 대조군 동일 행 백필 · 성능 비교 라이브 실행 — D-16 폐지 · 재사용 금지) · 채번 7 + 7 = **14**
- 표면 있음 3(GEN-12 · 13 · 14) + 표면 없음 4 = **7**. 모드 A 생성기의 실행 · 설정은 실행 인자와 환경변수다(켜고 끄기는 설비 가동 RLT-10). GEN-12 · 13의 표면은 모드의 원격 손잡이가 아니라 실행의 시작 · 관찰 · 중단이다.
- **실행은 한 번에 하나다** — 흐름 시연과 직접 비교는 같은 실행 틀을 써서 서로도 막는다 · 동시에 돌면 서로의 부하를 잰다(REQ-GEN-16 · datagen.run_in_progress/409). 실행 주체는 api 프로세스(APP_ROLE api · all)의 RunControlModule이고 실행 상태는 인스턴스 메모리다 — 재기동이면 실행은 사라지고 실패가 아니라 기록 없음이다.

## 주입 모드

**한 번에 한 모드만 쓴다.** A와 B를 동시에 돌리면 어느 계층이 병목인지 가를 수 없다(원본 data_flow.md §11.1). 주입 경로의 기전 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)다.

| 모드 | 기능 | 경로 | 보이는 것 | 보이지 않는 것 | SIMULATED 표지 | 멱등 · 대조군 |
|------|------|------|------|------|------|------|
| A | GEN-05 | 생성기 → PlcSim 레지스터 → Collector 폴링 → Stream | 진짜 E2E · Modbus 병목 | DB 상한 | Collector가 접속 대상으로 판정(COL-05) | 적용 |
| B | GEN-12 · GEN-13 | 생성기 → Stream 직결 | Redis · Ingest · 저장소 쪽 흐름 | Modbus · Collector | 생성기가 q에 9 | 적용 · 비교 사본은 GEN-13 실행 중 게이트가 열린 배치만 |

- 검산: 주입 모드 = A · B = **2** · 폐지 C(HTTP 부하 주입) · D(ClickHouse 직접 백필)는 D-16
- **직접 비교는 설비 가동(모드 A)과 막지 않는다** — 두 모드가 함께 돌 수 있다. 대신 비교 행은 과거 구간이라 지금 흐르는 가동 데이터와 섞이지 않고, 실행이 시작 · 끝에 설비 가동 여부를 run_result.plant_on에 남겨 화면이 "설비 가동 중에 잰 값"을 표시한다(REQ-GEN-20).
- **SW-01 off는 모드 A로만 의미가 있다.** 모드 B는 Stream이 있다는 전제의 주입이라 Stream 경계를 끈 구성과 조합되지 않는다([13_switch_matrix.md](./13_switch_matrix.md) 조합 제약).

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| GEN-01~03 | 정상 수집 경로에 참여하지 않는다 | COL · ING |
| GEN-05 | Modbus 서버를 띄우지 않는다 | SIM-01 |
| GEN-12 | Stream을 소비하지 않는다 · 업무 행을 직접 쓰지 않는다(명령만 싣는다) · **운영 마스터 행(시드 · 사람이 만든 행)에 명령을 보내지 않는다**(시연 전용 행만) · flow 프레임 계약을 바꾸지 않는다 · **측정 기록을 만들지 않는다** | ING · 명령 워커([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)) · RLT |
| GEN-13 | 두 저장소에 직접 쓰지 않는다(센서 행은 Stream으로만 — 적재는 ING의 같은 배치) · 비교 사본에 싣는지를 스스로 정하지 않는다(게이트만 켜고 끈다 · COPY는 ING-11) · 지금 시각 구간 · 보존 밖 구간을 비우지 않는다 · **측정 기록을 만들지 않는다**(run_result는 화면용 보관) | ING-11 · 측정 기록 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| GEN-14 | 설비 · 태그 · 업무 · 실행 결과를 지우지 않는다 · 설비 가동을 끄지 않는다(막고 알린다) · 소비 그룹 · Stream 키를 지우지 않는다 | MST · RLT-10 · ING |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| SIM | GEN → SIM | 시뮬레이션 결합 | 모드 A Buffer 갱신. 같은 프로세스여야 한다([04_plc_sim.md](./04_plc_sim.md)) |
| ING | GEN → ING | Stream 경계 | 모드 B(GEN-12) |
| COL | 간접 | 해당 없음 | 모드 A의 표지를 Collector가 단다 |
| MST | GEN → 명령 경로 | 업무 명령 포트 | GEN-12가 BizWritePort로 시연 전용 행에 한정한 마스터 명령을 싣는다 — 적용 · 무효화는 명령 워커가 한다(HTTP가 아니라 프로세스 안 호출) |
| RLT | GEN → RLT | 포트(PLANT_POWER_PORT) | GEN-14가 설비 가동 상태를 읽어 가동 중 지우기를 막는다 · GEN-13이 시작 · 끝의 가동 여부를 결과에 남긴다 |
| OBS | GEN → OBS | 계측 | 생성 카운트(무손실 판정의 분자) · 생성기 CPU 사용률 · 실행 계수 · backpressure_stage{publisher="compare"} |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다. 표면 있는 GEN-12만 코드를 내고 나머지는 메트릭으로 드러난다. **라이브 실행의 실패는 코드가 아니라 실행 객체의 status failed와 error 필드다.**

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 다른 라이브 실행이 진행 중인데 시작 | 거절 — 화면은 진행 중 실행으로 패널을 맞춘다 | datagen.run_in_progress/409 | GEN-12 |
| 요청 본문 계약 위반 | 요청 수정 | common.validation_failed/400 | GEN-12 |
| 라이브 실행 단계 예외(저장소 불가) | 정리 단계를 돈 뒤 실행 status failed · error 메시지 · 끝난 단계까지의 결과는 남는다 | 코드 없음 — status failed · gen_runs_total{status="failed"} | GEN-12 |
| 라이브 실행 중 api 재기동 | 실행이 사라진다 — 기록 없음 | 코드 없음 — 현재 실행 null | GEN-12 |
| 백프레셔 위험 단계 | 발행을 멈췄다가 주의 임계 아래에서 잇는다 — 거절 코드를 내지 않는다 | 적체 메트릭 | GEN-12 |
| 생성기 포화 | 코드 없음 — 그 구간의 흐름은 생성기가 막은 것이다 | 생성기 CPU 사용률 | GEN-01 |
| 넣기 전에 조회 대결 시작(또는 지우기 뒤) | 거절 — 실행 객체를 만들지 않는다 | datagen.compare_no_data/409 | GEN-13 |
| SW-09 off에서 넣기 · 무결성 시작 | 거절 — PostgreSQL이 받지 않아 비교가 성립하지 않는다 | common.validation_failed/400(fields SW-09) | GEN-13 |
| 직접 비교 단계 예외 · 중단 | 게이트를 끄고(무결성은 시험 창 · 시험 키까지 정리) status failed · stopped로 종결 · run_result에 그 상태로 보관(result null) | 코드 없음 — status · backpressure_stage{publisher="compare"} 0 복귀 | GEN-13 |
| 실행 중 · 설비 가동 중 지우기 | 거절 — 화면은 reason별 문구 | data.purge_blocked/409(details.reason) | GEN-14 |
| 현황 · 지우기 · 최근 결과의 저장소 불가 | 코드 없는 500 — 매핑 미설계(§미확인 · 미설계 등재) | 로그 · 에러율 | GEN-13 · 14 |

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| DROPOUT의 품질 코드 불일치 — W1 판정 | GEN-02가 행 생략으로 표현한다 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 모드 A SIMULATED 표지 — W1 인계 | [03_collector.md](./03_collector.md) §모드 A의 SIMULATED 표지 판정으로 닫았다 | 상동 |
| 보정 7.1~7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 모드 B의 스트림 길이 검사 | Collector는 그룹 적체(lag + pending)를 파이프라인으로 확인한다(ADR-21 — XLEN이 아니다) · MAXLEN은 "검사를 우회한 발행자"를 막는 최후 안전장치다(원본 architecture.md §9.3) | 닫힘 — 모드 B(GEN-12)도 XADD 전에 적체 검사 · 위험 단계면 발행 중단 · 주의 임계에서 재개 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 생성기 실행 제어 표면 | 원본 API 표(원본 architecture.md §11)에 생성기 실행 · 정지 표면이 없다 | 모드 A는 **닫힘 — 두지 않는다**(W5 판정 유지) · 시연 실행은 사용자 요구 2026-09-28로 GEN-12 신설 — 측정 기록을 만들지 않는 시연이다 | [../07_api/09_datagen.md](../07_api/09_datagen.md) §원본에 없는 표면 판정 |
| 생성 처리량 | 원본 예상치(20 스레드 머신 미달 가능성 낮음) | **닫힘**(워커 1 약 590만 pps · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값) — 실행 도구는 D-16으로 삭제 | 기록 006 |
| 직접 비교 결과 · 센서 데이터 현황 · 지우기 표면의 저장소 불가 응답 | 원본에 없는 표면(D-16) | **미설계** — 지금은 PostgreSQL · ClickHouse 오류가 코드 없는 500이다(예외 필터가 저장소 오류를 매핑하지 않는다) · common.postgres_unavailable · timeseries.clickhouse_unavailable 재사용 여부는 다음 코드 수정 웨이브 | [../07_api/09_datagen.md](../07_api/09_datagen.md) |

## 관련 문서

- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 동작 계약
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 라이브 실행 제어 표면
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — F-09 주입 기전
- [03_collector.md](./03_collector.md) — 모드 A의 SIMULATED 판정
- [13_switch_matrix.md](./13_switch_matrix.md) — 스위치와 주입 모드의 조합 제약
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-16 폐지 결정
