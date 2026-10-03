# GEN — 데이터 생성 기능 명세

> **대상**: 데이터 생성(GEN · NestJS datagen 모듈) 기능 목록 · 주입 모드 4종 · 부하 주입 표면 · **라이브 실행 제어(EXP-PERF 성능 비교 · EXP-FLOW 흐름 시연)** · SIMULATED 표기 · 기능별 경계 · 실패 시 보이는 것 — 기능 ID GEN-NN 채번 정본
> **작성일**: 2026-09-24
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
> **원천**: 원본 tech_stack.md §3.3 · §3.4 · §7 · §8(커밋 ff66a37) · 원본 data_flow.md §10.3 · §11 · §11.1 · §11.2 · §11.3 · §12.1(커밋 ff66a37) · 원본 architecture.md §4 · §9.3 · §11 · §15 · §18(커밋 ff66a37) · 원본 implementation_plan.md §5 S1 · S2 · S5(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #11 · D-05 · D-12 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 신호 프로파일 · 주입 모드

GEN은 **실장비가 없는 이 시스템에서 실험의 품질을 결정하는 도메인**이다(원본 tech_stack.md §7). 신호 프로파일 8종으로 값을 만들고, 주입 모드 A~D 중 하나로 파이프라인의 서로 다른 계층에 부하를 건다. 정상 수집 경로의 단계가 아니라 경로 입구에 데이터를 넣을 뿐이다 — 데이터 평면이지만 흐름의 단계가 아닌 이유다([../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)).

**생성기가 병목이면 측정 자체가 무의미하다.** 생성기는 수집 · 적재와 같은 CPU를 나눠 쓰므로 S1에서 단독 처리량을 먼저 재고, 모든 부하 측정에 생성기 CPU 사용률을 함께 기록한다. 생성기가 포화되지 않은 구간의 수치만 신뢰한다(원본 data_flow.md §11.1 · 원본 tech_stack.md §8).

**GEN은 소유 테이블이 없다.** 생성 벡터는 메모리 상태이고 시드는 실행 인자다. 모드 D가 tag_raw에 직접 쓰지만 소유하지 않는다([../05_data_stores/README.md](../05_data_stores/README.md)). 라이브 성능 비교(GEN-11)가 만드는 run_perf_raw 둘(ClickHouse · PostgreSQL)은 **실행 하나 동안만 존재하는 실행 수명 객체**라 테이블 수에 세지 않는다 — 실행 종결 때 반드시 DROP하고 api 부팅 때 남은 것을 DROP한다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §실행 수명 객체).

**라이브 실행(GEN-11 · 12)은 측정이 아니라 시연이다**(사용자 요구 2026-09-28). 실증 화면 EXP-PERF · EXP-FLOW의 실행 패널에서 시작 · 중단하고 진행 단계 · 완료 · 총 소요 시간을 보인다. 앱을 거쳐 재므로 결과에 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지가 붙고 측정 기록을 만들지 않는다 — 측정 기록을 만드는 실험은 여전히 모드 A~D의 실행 인자로만 돈다.

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 각 API 문서의 표면 요약 표가 채번한다).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **GEN-01** | 신호 프로파일 생성 | 태그마다 프로파일 8종(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) 중 하나로 값을 만든다. 태그 N × 시점 M을 Float64Array · Uint32Array에 한 번에 채우고 piscina 워커로 병렬화한다 — numpy가 없는 대신 TypedArray 벡터와 워커가 벡터화 이득을 낸다. S2는 SINE 1종이다 | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 — 메모리 |
| **GEN-02** | 품질 표지와 결측 표현 | 모드 B · C · D의 산출 행은 **전부 SIMULATED(9)**로 싣는다. 결측(DROPOUT)은 BAD를 다는 대신 **행을 생략**한다 — BAD를 달면 생성 데이터 표지가 지워진다(W1 판정). SPIKE는 기저값 위 확률적 이상치로 알람 트리거를 유발한다. 모드 A의 표지는 Collector가 단다(COL-05) | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-03** | 시드 고정 | 난수 시드를 고정해 같은 데이터셋을 다시 만든다. 같은 초기 상태에서 반복해야 on/off 비교가 성립하고, 대조군 백필(GEN-10)이 같은 행 집합을 얻는 전제다 | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-04** | 부하 티어 설정 | 용량 티어 S · M · M+ · L(설비 수 · 설비당 태그 · 주기)을 생성 규모로 받는다. 초당 포인트는 티어가 정하고 생성기는 그 값을 만들어 낸다 — 티어 값의 정본은 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) | S1 · S5 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-05** | 모드 A 레지스터 갱신 | PlcSim 레지스터 Buffer를 주기적으로 갱신한다. Collector 폴링을 거치므로 **진짜 E2E 지연과 Modbus 병목**을 잰다. DB 상한은 잴 수 없다 — Modbus가 먼저 막힌다 | S2 | F-01 · F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음(SIM Buffer) |
| **GEN-06** | 모드 B Stream 직결 | stream:plc:raw에 직접 XADD한다. Modbus와 Collector를 우회해 **Redis · Ingest · ClickHouse 상한**을 잰다. 엔트리는 Collector와 같은 페이로드 계약(스키마 버전 v 포함)을 따른다. api 컨테이너 안 또는 같은 머신의 APP_ROLE=datagen 컨테이너에서 돈다 | **S3**(S5 → S3 당김 — EXP-13 · 19 · 31 · 34가 요구 · 최소분) | F-02 · F-09 | 해당 없음 | 표면 없음 — 실행 인자 | Redis stream:plc:raw |
| **GEN-07** | 모드 C 부하 주입 표면 | **POST /api/v1/ingest/bulk**로 받아 Stream에 넣는다. HTTP 계층 · 인증 · 직렬화 비용을 포함한 수집 상한을 잰다. **기본 비활성이며 환경변수로만 켠다.** 켜진 상태에서도 XADD 전에 미확인 적체(그룹 lag + pending — XLEN이 아니다 · ADR-21)를 검사해 백프레셔 **위험** 단계면 거절한다 — Collector가 스풀로 가는 것과 같은 임계다 | S5 | F-09 · F-10 | 해당 없음 | 07_api/09_datagen | Redis stream:plc:raw |
| **GEN-08** | 모드 D 백필 | ClickHouse에 직접 삽입해 과거 구간을 채운다(시간 압축). 절차는 MV 분리 → 원시 대량 삽입 → 롤업 직접 채우기(INSERT SELECT) → MV 재연결 → 원시 count 대 롤업 countMerge 대조 순이다. MV를 붙인 채 백필하면 삽입이 느려지고 중간 실패 시 롤업이 부분만 채워져 정합 판단이 불가능하다(원본 data_flow.md §10.3). **ING를 우회하므로 멱등 토큰 · 대조군 동시 적재를 타지 않는다** | S5 | F-08 · F-09 | 해당 없음 | 표면 없음 — 실행 인자 | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(쓰기 · 소유 아님) |
| **GEN-09** | 생성기 단독 처리량 실측 | 수집 경로 없이 생성 + MessagePack 인코딩 처리량을 워커 수별로 잰다. 합격은 **M 티어 초당 포인트의 3배**(원본 목표 30,000 pps)이며 목적은 판정보다 **기준선 확보**다. 미달이면 APP_ROLE=datagen 별도 컨테이너 또는 Python 생성기로 간다(원본 tech_stack.md §3.4) | S1 | F-09 | 해당 없음 | 표면 없음 — 실행 인자 | 없음 |
| **GEN-10** | 대조군 동일 행 백필 | 모드 D로 채운 구간은 SW-09 동시 적재가 적용되지 않으므로, 같은 시드 · 같은 구간 · 같은 태그 집합으로 PostgreSQL 대조군 plc_tag_raw_control에도 **같은 행 집합**을 채운다. 행 집합이 다르면 두 저장소의 쿼리 결과 자체를 대조할 수 없다(D-05). S5의 용량 단계별 대조 쿼리가 이 기능 위에서 돈다(D-12). 절차의 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | S5 | F-09 | SW-09 | 표면 없음 — 실행 인자 | PostgreSQL plc_tag_raw_control(쓰기 · 소유 아님) |
| **GEN-11** | 성능 비교 라이브 실행 | EXP-PERF에서 규모 10^5 ~ 10^maxExponent(maxExponent ∈ 5~8)의 격자 분포 데이터를 실행 수명 객체 run_perf_raw 둘(tag_raw · plc_tag_raw_control과 동형 · PostgreSQL 인덱스 I2 변형만)에 **서버 측 생성**(INSERT … SELECT)으로 이어 채우고, 규모마다 동일 쿼리 5종을 두 저장소에서 웜 3회 재어 중앙값 · 빠른 쪽 · 배수 · 결과 일치를 낸다. 끝 · 중단 · 실패 모두 정리 단계가 객체를 DROP한다. 결과는 시연값 — 곡선의 기록 계열과 섞지 않는다 | S5 | F-09 | 해당 없음 | 07_api/09_datagen | ClickHouse plc.run_perf_raw · PostgreSQL run_perf_raw(실행 수명 객체 — 테이블 수에 세지 않는다) |
| **GEN-12** | 흐름 시연 실행 | EXP-FLOW에서 durationSec 동안 api 안의 생성기가 stream:plc:raw에 **엔트리 계약 v1 그대로** pps만큼 발행하고(모드 B와 같은 적체 검사 · 위험 단계면 멈췄다 잇는다) 1 ÷ bizPerSec초마다 BizWritePort로 업무 명령 master.device.patch를 **시연 전용 설비 DEMO-FLOW-DEV에만**(비활성 · 태그 없음 · 새 이름 · 되돌림 없음 — 운영 행은 바뀌지 않는다 · prepare가 없으면 사이트 · 라인 · 설비를 명령으로 만든다) 하나 보내고, 1 ÷ readsPerSec초마다 **조회 하나**(센서 시계열 · 센서 지금 값 · 업무 설비 목록을 차례로 — 표면 뒤의 같은 서비스 메서드를 프로세스 안에서 불러 사람의 조회와 같은 cache-aside 경로를 탄다 · 같은 키 반복과 주기적 새 키로 히트와 미스가 둘 다 생긴다 · 결과는 버리고 실패는 세기만)를 섞은 뒤, grp:ingest 적체가 시작 전 수준으로 돌아올 때까지(상한 30초) 기다린다. 흐름도는 기존 flow 프레임과 조회 메트릭으로 움직인다 — 흐름 계약은 바꾸지 않는다 | S5 | F-02 · F-03 · F-04 · F-05 · F-09 | 해당 없음 | 07_api/09_datagen | Redis stream:plc:raw · stream:biz:cmd(BizWritePort 경유 — 시연 전용 행(site · production_line · device DEMO-FLOW 계열) · 원장 쓰기는 명령 워커) · 조회 읽기 — Redis cache:q · rt:latest · cache:devlist · 미스면 ClickHouse · PostgreSQL |

- 검산: GEN-01~12 = **12**. 단계별(첫 도입 기준) S1 5(GEN-01 · 02 · 03 · 04 · 09) + S2 1(GEN-05) + S3 1(GEN-06) + S5 5(GEN-07 · 08 · 10 · 11 · 12) = **12**
- 표면 있음 3(GEN-07 · 11 · 12) + 표면 없음 9 = **12**. 모드 A~D 생성기의 실행 · 설정은 실행 인자와 환경변수이며 원본에 실행 제어 API가 없다(§미확인 · 미설계 등재). GEN-11 · 12의 표면(#2~#5)은 모드 A~D의 원격 손잡이가 아니라 시연 실행의 시작 · 관찰 · 중단이다.
- **두 실행은 합쳐 한 번에 하나다** — 동시에 돌면 서로의 부하를 잰다(REQ-GEN-16 · datagen.run_in_progress/409). 실행 주체는 api 프로세스(APP_ROLE api · all)의 RunControlModule이고 실행 상태는 인스턴스 메모리다 — 재기동이면 실행은 사라지고 실패가 아니라 기록 없음이다.

## 주입 모드

**한 번에 한 모드만 쓴다.** A와 B를 동시에 돌리면 어느 계층이 병목인지 가를 수 없다(원본 data_flow.md §11.1). 주입 경로의 기전 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)다.

| 모드 | 기능 | 경로 | 잴 수 있는 것 | 잴 수 없는 것 | SIMULATED 표지 | 멱등 · 대조군 |
|------|------|------|------|------|------|------|
| A | GEN-05 | 생성기 → PlcSim 레지스터 → Collector 폴링 → Stream | 진짜 E2E · Modbus 병목 | DB 상한 | Collector가 접속 대상으로 판정(COL-05) | 적용 |
| B | GEN-06 | 생성기 → Stream 직결 | Redis · Ingest · ClickHouse 상한 | Modbus · Collector | 생성기가 q에 9 | 적용 |
| C | GEN-07 | 생성기 → /api/v1/ingest/bulk → Stream | API 처리량 · 인증 · 직렬화 비용 | 수집 계층 | 생성기가 q에 9 | 적용 |
| D | GEN-08 | 생성기 → ClickHouse 직접 | 순수 삽입 성능 · 압축률 | 파이프라인 전체 | 생성기가 quality에 9 | **미적용** — 대조군은 GEN-10으로 따로 채운다 |

- 검산: 주입 모드 = A · B · C · D = **4**
- **모드 C의 "인증 비용"은 S7 이후에만 잰다.** 인증은 S7에 오고(D-07) 모드 C 부하 측정은 S5에 온다 — S5의 모드 C 수치에는 인증 비용이 없다. 두 수치를 같은 조건으로 비교하지 않는다(커밋 해시가 가른다).
- **SW-01 off 실험은 모드 A로만 한다.** 모드 B · C는 Stream이 있다는 전제의 주입이라 Stream 경계를 끈 구성과 조합되지 않는다([13_switch_matrix.md](./13_switch_matrix.md) 조합 제약).

## 부하 주입 표면이 GEN 소유인 이유

**통념**: 경로가 /api/v1/ingest/bulk이니 ING(적재) 표면이다. **부정**: ING는 외부 표면이 없는 내부 모듈이며 Stream 뒤에서만 데이터를 받는다. 이 표면을 부르는 주체는 부하 주입(모드 C)이고 거절을 판정하는 것도 ING 소비 루프가 아니라 표면이 XADD 전에 하는 적체 검사다. **진짜 축**: 표면 소유는 URL이 아니라 **호출 주체와 판정 주체**를 따른다(docs_plan 보정 #11). **대체 경로**: 에러 네임스페이스도 datagen이다 — datagen.stream_full/503 · datagen.bulk_disabled/404([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)).

- ING 네임스페이스로 코드를 내면 "ING는 표면이 없다"와 "ING 코드가 응답으로 나간다"가 동시에 참이 되어 도메인 공백 진술이 깨진다.
- 표면 명세(요청 본문 · 게이트 환경변수 이름)는 [../07_api/09_datagen.md](../07_api/09_datagen.md)(W5)가 정한다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| GEN-01~04 | 정상 수집 경로에 참여하지 않는다 | COL · ING |
| GEN-05 | Modbus 서버를 띄우지 않는다 | SIM-01 |
| GEN-06 · 07 | Stream을 소비하지 않는다 · ClickHouse에 쓰지 않는다 | ING |
| GEN-07 | **XADD 뒤의 적재 실패를 응답에 싣지 않는다** — 받은 순간 Stream에 넣고 끝난다 | ING-05(재시도 · DLQ) |
| GEN-08 | 롤업 · MV를 정의하지 않는다 — 분리 · 재연결 절차만 실행한다 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |
| GEN-08 · 10 | 저장 객체를 소유하지 않는다 | ING(tag_raw · 대조군 — 잠정) |
| GEN-09 | 시스템 처리량을 판정하지 않는다 — 생성기 자신의 여유만 판정한다 | 부하 시나리오 [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) |
| GEN-11 | **측정 기록을 만들지 않는다** · 운영 테이블(tag_raw · plc_tag_raw_control)을 건드리지 않는다 · 역전 음영을 판정하지 않는다 | 측정 기록 EXP-01~05 · 구조 판정 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| GEN-12 | Stream을 소비하지 않는다 · 업무 행을 직접 쓰지 않는다(명령만 싣는다) · **운영 마스터 행(시드 · 사람이 만든 행)에 명령을 보내지 않는다**(시연 전용 행만) · flow 프레임 계약을 바꾸지 않는다 | ING · 명령 워커([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)) · RLT |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| SIM | GEN → SIM | 시뮬레이션 결합 | 모드 A Buffer 갱신. 같은 프로세스여야 한다([04_plc_sim.md](./04_plc_sim.md)) |
| ING | GEN → ING | Stream 경계 | 모드 B · C. 모드 D는 ING를 우회한다 |
| COL | 간접 | 해당 없음 | 모드 A의 표지를 Collector가 단다 |
| AUT | AUT → GEN | 인가 | GEN-07에 S7 이후 인증이 걸린다. 게이트가 먼저다. GEN-11 · 12의 시작 · 중단은 S7 ② 뒤 ENGINEER · ADMIN([12_permission_matrix.md](./12_permission_matrix.md)) |
| MST | GEN → 명령 경로 | 업무 명령 포트 | GEN-12가 BizWritePort로 시연 전용 행에 한정한 마스터 명령을 싣는다 — 적용 · 감사 · 무효화는 명령 워커가 한다(HTTP가 아니라 프로세스 안 호출 · actor null · MST-02 ADMIN 단일 주체의 명시 예외 — [12_permission_matrix.md](./12_permission_matrix.md)) |
| OBS | GEN → OBS | 계측 | 생성 카운트(무손실 판정의 분자) · 생성기 CPU 사용률 |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다. 표면 있는 GEN-07 · 11 · 12만 코드를 내고 나머지는 메트릭과 실험 판정으로 드러난다. **라이브 실행의 실패는 코드가 아니라 실행 객체의 status failed와 error 필드다.**

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| 부하 주입 표면이 꺼져 있음 | 표면이 없는 것과 같다 — 환경변수를 켜고 재기동 | datagen.bulk_disabled/404 | GEN-07 |
| 백프레셔 위험 단계 | 거절 — **거절 수가 측정값이다.** 재시도 루프로 덮지 않는다 | datagen.stream_full/503 | GEN-07 |
| 요청 본문 계약 위반 | 요청 수정 | common.validation_failed/400 | GEN-07 |
| S7 이후 인증 실패 · 한도 초과 | auth 계열 · 레이트 리밋 | auth.unauthenticated/401 · common.rate_limited/429 | GEN-07 |
| 다른 라이브 실행이 진행 중인데 시작 | 거절 — 화면은 진행 중 실행으로 패널을 맞춘다 | datagen.run_in_progress/409 | GEN-11 · 12 |
| 라이브 실행 단계 예외(저장소 불가 · 디스크 부족) | 정리 단계를 돈 뒤 실행 status failed · error 메시지 · 끝난 단계까지의 결과는 남는다 | 코드 없음 — status failed · gen_runs_total{status="failed"} | GEN-11 · 12 |
| 라이브 실행 중 api 재기동 | 실행이 사라진다 — 기록 없음 · 부팅 때 실행 수명 객체 DROP | 코드 없음 — 현재 실행 null | GEN-11 · 12 |
| 생성기 포화 | 코드 없음 — **그 구간의 수치를 버린다** | 생성기 CPU 사용률 | GEN-01 · 09 |
| 모드 D 도중 실패 | 롤업이 부분만 채워짐 — MV 분리 상태에서 절차를 처음부터 다시 한다 | 원시 count 대 롤업 countMerge 불일치 | GEN-08 |
| 모드 D와 대조군 행 수 불일치 | 대조 쿼리 무효 | 두 저장소 count 대조 | GEN-10 |

- **B형 — stream_full은 실패가 아니라 관측 대상이다.** 모드 C 부하 실험에서 이 코드의 발생률이 곧 HTTP 경유 수집 상한의 신호다. k6가 재시도로 덮으면 백프레셔가 흡수한 양과 거절한 양을 가를 수 없다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 부하 주입 표면 소유 — docs_plan 보정 #11 | GEN-07이 소유한다 · §부하 주입 표면이 GEN 소유인 이유 | [../07_api/09_datagen.md](../07_api/09_datagen.md) |
| DROPOUT의 품질 코드 불일치 — W1 판정 | GEN-02가 행 생략으로 표현한다 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 모드 A SIMULATED 표지 — W1 인계 | [03_collector.md](./03_collector.md) §모드 A의 SIMULATED 표지 판정으로 닫았다 | 상동 |
| 대조군 단계 편입 — D-12 | GEN-10이 S5 용량 단계의 대조군 행을 채운다 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) |
| 보정 7.1~7.5 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 모드 B의 스트림 길이 검사 | Collector는 그룹 적체(lag + pending)를 파이프라인으로 확인하고(ADR-21 — XLEN이 아니다) bulk 표면도 같은 임계에서 거절한다(원본 architecture.md §9.3) · MAXLEN은 "검사를 우회한 발행자"를 막는 최후 안전장치다 | 닫힘 — 모드 B도 XADD 전에 적체 검사 · 위험 단계면 발행 중단 · 주의 임계에서 재개(REQ-GEN-07) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 생성기 실행 제어 표면 | 원본 API 표(원본 architecture.md §11)에 생성기 실행 · 정지 표면이 없다 | 모드 A~D는 **닫힘 — 두지 않는다**(W5 판정 유지) · 시연 실행은 **사용자 요구 2026-09-28로 GEN-11 · 12 신설** — 측정 기록을 만들지 않는 시연이라 W5 판정의 실패(실험 조건이 요청 본문으로 흩어짐)와 부딪히지 않는다 | [../07_api/09_datagen.md](../07_api/09_datagen.md) §원본에 없는 표면 판정 |
| 모드 D와 대조군의 동일 행 절차 | 대조군 쪽도 같은 행 집합이어야 한다(W1 [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)) | 닫힘 — §모드 D 백필과 대조군 동일 행(같은 행 벡터를 날짜 단위로 두 저장소에 차례로 쓰고 일마다 count 대조) — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 생성 모드의 과거 ts와 STALE | 시간 압축으로 과거 시각을 찍으면 최신값 화면이 전부 STALE이다(W1 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)) | 닫힘 — 실시간 화면 · STALE · E2E를 읽는 실험은 현재 시각 생성만 쓴다(실험 프로토콜 §조건 분리 강제) | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 압축률 · 생성 처리량 | 원본 예상치(프로파일별 압축률 · 20 스레드 머신 미달 가능성 낮음) | 생성 처리량 **닫힘**(워커 1 약 590만 pps · 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값) · 압축률은 미확인 — 확정 전 임의 값 고정 금지 | EXP-35 · EXP-21 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |

## 관련 문서

- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 동작 계약
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 부하 주입 표면 · 라이브 실행 제어 표면
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — F-09 주입 기전
- [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) — 백필 절차
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
- [03_collector.md](./03_collector.md) — 모드 A의 SIMULATED 판정
- [13_switch_matrix.md](./13_switch_matrix.md) — 스위치와 주입 모드의 조합 제약
