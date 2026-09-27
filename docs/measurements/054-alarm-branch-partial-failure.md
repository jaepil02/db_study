# 054 — 알람 분기 · 부분 실패: 모드 B(SPIKE · 10,000 pps) 위 규칙 41(표면 POST)의 세 저장소 분기 · 디바운스 · PostgreSQL 정지 · alarm_eval 삽입 실패 · 판정 구간 · ACK 반영 (S7 · 티어 M)

> 실험: EXP-33 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-27T09:42:50.859Z ~ 10:49:13.736Z(반복 1 정상 창 시작 ~ 반복 3 정상 창 끝 · 반복마다 정상 창 약 300초 — 반복별 창은 기계 판독 블록 conditions.windows) · 실행 2026-09-27 18:36 ~ 20:08 KST(반복 1 기준선 시작 09:36:14Z ~ 반복 3 collect 11:08:08Z)

S7 ① 판정기가 확정 배치 하나를 받아 세 저장소에 목적이 다른 세 쓰기(alarm_eval 판정 전수 · alarm_event 확정 · alarm:state 상태)를 하는 흐름(06_pipeline/08 ①~⑧)을 모드 B 부하 위에서 잰다. 한 반복은 다섯 구간이다 — ① 정상 창 300초(판정 처리량 · 판정 구간 · 인계 대기 · 세 저장소 대조) ② ACK 두 브라우저 ③ PostgreSQL 정지 60초(AC-36 ①) ④ alarm_eval 삽입 강제 실패 60초 + 회복 45초(AC-36 ②) ⑤ 마감(생성기 종료 · 소진 · 규칙 전체의 세 저장소 · 디바운스 · 재생 완전성).

**구조 판정 14건은 3회 전부 성립했다. 분포 판정(p50 · 계수 처리량) 최대 편차는 0.87%로 기준 20% 안이다(카탈로그 판정 지표는 구조 판정 — 편차 판정 지표는 측정 전 승인된 러너 DIST · 04 p50 조항).** ACK 반영 지연은 참고 지표이고, 판정은 상한 성립만 한다(06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿 · 2026-09-27). 수치는 전부 원시(docs/measurements/raw/054-alarm-branch-partial-failure.jsonl — 반복 3줄 + table 1줄)와 반복 상태 폴더(.omc/lab/s5/exp33-r{1,2,3}-alarm)의 값이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | **05b237a**(health run.commitHash — 세 반복 모두 · 생성기 보고 run도 05b237a) — 러너 핫픽스 두 건(아래 §폐기 · 예외) 커밋 뒤 실행 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · api 컨테이너 상한 2048 MB(run.memoryLimitMb — api health 원시 그대로 · 세 반복 같음). api health 경로라 memoryLimitSource는 없다(값이 null이 아니다). 생성기 컨테이너 보고 run의 memoryLimitMb는 null이며 기록 run이 아니다 |
| 용량 티어 | M(run.capacityTier M · 생성기 인자 --tier M · 복원 스냅샷 **s7a-seed-m** — 규칙 0 · 학습자 계정 시드) |
| 스위치 | 전부 기본값 — SW-06 on(ch:alarm 발행 관찰 전제 · 러너 start가 api · worker health 둘 다 대조) · SW-09 off · SW-10 off · SW-11 ingest. api health · worker health · 생성기 보고 switches 11개가 세 반복 모두 같다 · 전수는 기계 판독 블록 |
| 배치 안 · 플러시 주기 | 배치 안 A(INGEST_BATCH_PLAN A — 러너가 A만 허용) · 플러시 주기 1,000 ms(_alarm.FLUSH_PERIOD_MS) |
| 저장소 자원 | 부하 실험 프로파일 — ClickHouse cpuset 5-8 · 5,368,709,120 B(5 GiB) · PostgreSQL cpuset 9-10 · 2,147,483,648 B(2 GiB)(원시 storeResources · 리드가 docker inspect로 확인) · compose.load.yml(리드 확인 · 원시에 파일 이름 없음) · Redis 2.5 GiB(기준선 docker stats) |
| 프로세스 구성 | api(APP_ROLE api — 알람 표면 · WebSocket) + worker(APP_ROLE worker — 적재 · 판정기 · lag 표본 원천) + datagen 컨테이너(모드 B) · web(3001 — ack 호출 안에서 러너가 띄우고 거둠 · BUILD_ID J2NQidWhMo0dGSb7VDNnF · webDirty false · apps/web 마지막 변경 5c01375 — 리드 확인) · 조회 부하 없음 |
| 주입 모드 · 부하 | B · 신호 프로파일 **SPIKE** · 10,000 pps · 지속 1,500초 · 시드 42 · 생성기 발행 15,000,000점 × 3 · 달성률 1.0 · lateTicks 0 · xaddFailures 0 · 생성기 컨테이너 CPU 최대 2.43 · 1.63 · 3.71% · workerUtilization 0.0032 · 0.0033 · 0.0033 |
| 규칙 계획 | 쓰기 표면 POST /api/v1/alarms/rules로만 41개(시드 0 · 06_pipeline/08 §규칙 시드) — 계층 S 20(GT · 기저 + 25 · 디바운스 5,000 ms · 심각도 1 — 한 시점 이상치만 위반 = AC-09 미만) · 계층 B 20(GT · 기저 − 1 · 디바운스 2,000 ms · 심각도 2 — 잡음이 열림 · 해소 · 재위반을 돌린다 = AC-09 이상) · 탐침 P 1(GT · 기저 − 10 · 디바운스 30,000 ms · 심각도 3 — fault-pg가 건다). 생성식 대조 861행 · 태그 41 · 불일치 0(허용 1e-6) × 3 |
| 장애 주입 | PostgreSQL — docker stop 60초(탐침 PENDING 뒤 · 규칙 캐시 TTL 246 · 288 · 351초 ≥ 정지 + 30) / ClickHouse — RENAME TABLE plc.alarm_eval ↔ plc.alarm_eval_exp33_hold 보류 60초 + 회복 관찰 45초(05 §장애 주입 삽입 강제 실패의 수단 — 리드 판정 2026-09-27) |
| 판정 셈 하한 | evalFloorMs = 규칙 POST 시작 − 60초(핫픽스 (b)) · evalLeadMs(대상 규칙 첫 판정 행 ts − POST 시작) **−512 · −821 · −799 ms** — 세 값 모두 판정 하한 60초 여유 안 · 하한 전 대상 규칙 alarm_eval 행 0 × 3 · 러너 주석의 −663 ms는 중단된 앞선 시도의 값(리드 확인) |
| 초기 상태 · 기준선 | 반복마다 복원 s7a-seed-m(규칙 0 · 상태 키 0 · 이벤트 0 · 감사 규칙 INSERT 0 — start가 대조) · 기준선 303 · 302 · 302초(09:36:14 ~ 09:41:17Z · 10:07:01 ~ 10:12:03Z · 10:37:41 ~ 10:42:43Z) |
| 관측 스택 · CPU 배치 | off · 표준(standard) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd — 원시 없음 · 코드 상수 apps/api/src/common/clickhouse/clickhouse.module.ts:9 CLICKHOUSE_REQUEST_COMPRESSION · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 확인 행위자 | api ALARM_ACK_ACTOR_EMAIL learner@localhost(비밀 아님) |
| 반복 · 편차 | 3회 · 분포 판정 지표(p50 · 계수 처리량)(카탈로그 판정 지표는 구조 판정 — 편차 판정 지표는 측정 전 승인된 러너 DIST · 04 p50 조항) 최대 편차 **0.87%**(판정 구간 p50) — 기준 20% 이내 · 구조 판정 14건 3회 전부 성립 · 앞선 시도 1회 중단(§폐기 · 예외) |
| 스크립트 · 원시 | scripts/lab/s5/alarm/exp33-alarm.sh start · load · window · ack · fault-pg · fault-ch · stop · collect · table · _alarm.py(window_view · ack_view · faultpg_view · faultch_view · final_view · table) · ack-two-browsers.cjs · 원시 4줄(반복 3줄 + table 1줄 — .omc/lab/s5/exp33-out 두 파일을 가공 없이 이어 붙임) |

반복 한 번의 절차는 아래 순서다(호출마다 540초 미만).

```plain
start     복원 s7a-seed-m → 기준선 약 302초 → api · worker 기동 → 전제 대조(규칙 0 · 상태 키 0 · 이벤트 0 · SW-06 on · 확인 행위자)
load      모드 B 1,500초 기동 → 규칙 계획 · 생성식 대조 → evalFloorMs 기록 → 규칙 40 POST → 상태 키 = 40 대기 → 예열 60초
window    정상 창 300초 — 캡처 m0 · m1(worker /metrics) · 상태 키 · 판정된 규칙 · alarm_eval · alarm_event
ack       web 기동 → 두 격리 브라우저 · 같은 이력 탭 · A 확인 클릭 3회 → B 행의 확인자 표시 시각 → web 정지
fault-pg  탐침 P POST → PENDING 확인 → PostgreSQL 정지 60초 → 기동 → 탐침 확정 1 · ch:alarm 프레임 대조
fault-ch  alarm_eval 보류 60초(RENAME) → 되돌림 → 회복 45초 → alarm_eval_gap 로그 대 계수 대조
stop      생성기 종료 대기 → 소진 → 규칙 41 전체 마감 판독(세 저장소 · 디바운스 · 재생 완전성 · 감사) → 정지
collect · table   반복 한 줄 · 반복 3줄 → 구조(3회 전부) · 분포(중앙값 · 편차) 한 줄(저장소 접속 없음)
```

- **판정 구간 · 인계 대기는 창 앞뒤 두 캡처의 버킷 차 분위수다(칸 안 선형 보간).** 버킷은 apps/api/src/common/metrics/registry.ts LATENCY_BUCKETS_SECONDS(… 0.0005 · 0.001 · 0.003 · 0.005 · 0.008 · 0.01 · 0.015 … 0.65 · 1 …)다.
- **구조 관계 "판정 구간 p95 ≤ 플러시 주기"는 보간하지 않는다.** 버킷 경계에 1초가 있어 le=1 칸 누적 ÷ 전체 비율 ≥ 0.95로 판정한다(_alarm.flush_relation).
- **세 저장소 대조의 alarm_eval 셈은 evalFloorMs 뒤 ts만 읽는다.** alarm_eval.ts는 판정한 배치의 데이터 시각이라 첫 판정 행이 POST 시각보다 앞선다(evalLeadMs 음수) — 하한을 POST 시작으로 두면 첫 판정 행이 빠진다(핫픽스 (b)).

## 결과

값의 순서는 반복 1 · 2 · 3이다. 시간은 ms로 옮겨 적는다(블록은 원시 단위 그대로 초).

### 분포 판정 — 정상 창 300초

| 지표 | 값 | 중앙값 | 편차 | 판정 |
|------|------|------|------|------|
| 초당 판정 행(alm_evaluations_total 창 차 ÷ 창 초) | 40.038 · 40.055 · 40.006 | 40.038 | 0.12% | 판정 |
| 초당 판정 배치(판정 구간 total count ÷ 창 초) | 1.0009 · 0.9980 · 1.0001 | 1.0001 | 0.29% | 판정 |
| 판정 구간 total p50 | 6.676 · 6.734 · 6.726 | 6.726 | **0.87%** | 판정(최대 편차) |
| 판정 구간 total p95 | 9.510 · 9.848 · 9.552 | 9.552 | 3.54% | 참고(p95) |
| 인계 대기 p50 · p95 | 0.25 · 0.25 · 0.25 / 0.475 × 3 | 0.25 / 0.475 | 0% | 참고(첫 칸 양자화 · p95) |
| 판정 구간 ≤ 1초 비율(le=1 누적) | 1.0 · 1.0 · 1.0 | 1.0 | 0% | 구조 관계의 판독값 |
| 하위 구간 p50 — A1 규칙 · A2 상태 읽기 · A3 평가 | 0.252 × 3 · 0.686 · 0.729 · 0.739 · 0.25 × 3 | 0.252 · 0.729 · 0.25 | 0% · 7.26% · 0% | 참고(하위 구간) |
| 하위 구간 p50 — A4 확정 · A5 전수 · A6 발행 | 2.117 · 2.176 · 2.137 · 4.192 · 4.199 · 4.166 · 0.25 · 0.278 · 0.25 | 2.137 · 4.192 · 0.25 | 2.79% · 0.79% · 11.11% | 참고(하위 구간) |

- 판정 행 = 12,000 × 3(40 규칙 × 1 Hz × 300초) · 판정 배치 300 · 299 · 300 · 위반 5,075 · 5,116 · 5,103 · 정상 6,925 · 6,884 · 6,897.
- **판정 구간 total은 창 안 전 배치가 15 ms 이하다.** 버킷 차 — ≤ 5 ms 26 · 31 · 28 · ≤ 8 ms 248 · 236 · 240 · ≤ 10 ms 297 · 288 · 298 · ≤ 15 ms 300 · 299 · 300(= 전체). 플러시 주기 1,000 ms의 1.5% 이하다.
- **A6 발행은 확정이 있는 배치에서만 관측된다(count 35 · 30 · 25 — 전체 배치 300 · 299 · 300).** 나머지 하위 구간은 배치마다 1회다.
- 인계 대기 표본 300 · 299 · 300은 전부 첫 칸(≤ 0.5 ms)이다 — flusher가 인계 슬롯을 기다리지 않았다.

### 세 저장소 대조(AC-35) · 정상 창

| 반복 | alarm_eval 행(위반) | 판정된 규칙(창 · 하한 뒤 전체) | alarm_event 열림 · 닫힘 | alarm:state 키 | 창 끝 규칙 | 판정 ≥ 확정 | 상태 키 = 판정된 규칙 |
|------|------|------|------|------|------|------|------|
| 1 | 12,000(5,073) | 40 · 40 | 18 · 18 | 40 | 40 | 성립 | 성립 |
| 2 | 12,000(5,116) | 40 · 40 | 16 · 16 | 40 | 40 | 성립 | 성립 |
| 3 | 12,000(5,100) | 40 · 40 | 13 · 12 | 40 | 40 | 성립 | 성립 |

- **세 수가 다른 것이 합격이다(AC-35 B형).** 판정 12,000 ≥ 확정 13~18 · 상태 키는 판정된 규칙당 1이다. 규칙마다 판정 수 ≥ 열림 수도 성립한다(원시 evalGeConfirmed에 포함 · _alarm.py window_view).
- 정상 창 전이(창 차) — NORMAL→PENDING 62 · 47 · 37 · PENDING→ACTIVE 18 · 16 · 13 · ACTIVE→CLEARING 791 · 768 · 785 · CLEARING→ACTIVE 777 · 755 · 770 · CLEARING→NORMAL 18 · 16 · 12 · ACTIVE→NORMAL 0 × 3. 활성 알람 게이지 심각도 2 = 20 × 3.
- 계층 B 창 안 열림의 디바운스 대조 — ok 18 · 16 · 13 · short 0 · unknown 0. 계층 S 창 안 — 위반 행 35 · 28 · 22 · 연속 최장 0 ms(한 행씩) · 열림 0.
- 창 안 무효 구간 0 · 상태 쓰기 실패 0 · DLQ 0 · 발행 실패 0 · 재기동 없음 · 적재 3,000,000행 × 3(라우팅 raw = alarm 3,000,000).
- consumer_lag 중앙값 50 × 3(초당 엔트리 = 10,000 ÷ 태그 200) · 최대 100 · 100 · 50.
- 컨테이너 CPU 중앙값(최대) — worker 8.1(10.9) · 6.7(11.3) · 8.6(10.1)% · ClickHouse 12.9(30.1) · 12.9(34.0) · 13.1(33.3)% · Redis 4.7 · 5.4 · 4.8% · PostgreSQL 0.2 · 0.9 · 0.3% · api 0.8 · 0.4 · 0.4%.

### 마감 — 규칙 41 전체(AC-09 · AC-35)

| 항목 | 반복 1 | 반복 2 | 반복 3 |
|------|------|------|------|
| alarm:state 키 = 판정된 규칙 = 규칙 | 41 = 41 = 41 | 41 = 41 = 41 | 41 = 41 = 41 |
| 감사 규칙 INSERT 증분(= 규칙 수 · 표면 경유) | 41 | 41 | 41 |
| alarm_event 행 · 하한 뒤 alarm_eval 행 | 108 · 57,657 | 117 · 57,657 | 107 · 57,664 |
| AC-09 미만(계층 S) — 이벤트 · 위반 행 · 위반 규칙 · 연속 최장 · 끝 상태 NORMAL | 0 · 156 · 20 · 1,000 ms · 20 | 0 · 137 · 20 · 0 ms · 20 | 0 · 136 · 20 · 1,000 ms · 20 |
| AC-09 이상(계층 B) — 이벤트 · 디바운스 ok · short · 규칙당 열린 행 최대 | 107 · 101 · 0 · 1 | 116 · 111 · 0 · 1 | 106 · 97 · 0 · 1 |
| 제외 구간 안 B 열림(ok · short · unknown) | 6(2 · 0 · 4) | 5(2 · 0 · 3) | 9(2 · 0 · 7) |
| 재생 완전성 — 예측 = 실측 = 일치 · 누락 · 초과 · 제외 이벤트 | 101 = 101 = 101 · 0 · 0 · 7 | 111 = 111 = 111 · 0 · 0 · 6 | 97 = 97 = 97 · 0 · 0 · 10 |
| 확인된 이벤트(닫힘) | 3(3) | 3(3) | 3(3) |
| 끝 상태 NORMAL · PENDING · ACTIVE · CLEARING | 20 · 0 · 17 · 4 | 21 · 0 · 20 · 0 | 21 · 1 · 17 · 2 |
| 구간별 열림 — 창 · PG 정지 · CH 보류 · 그 밖 | 18 · 1 · 6 · 83 | 16 · 2 · 4 · 95 | 13 · 1 · 8 · 85 |

- **AC-09 미만은 연속 위반이 디바운스 5,000 ms보다 짧다는 것이 전제다.** 계층 S의 연속 위반은 최장 1,000 ms(연속 두 행)이고 20개 규칙 모두 위반 행을 가졌는데 이벤트가 0 · 끝 상태가 NORMAL이다.
- **재생 완전성은 judge.ts 상태 머신(GT · 전이 8)을 alarm_eval 행으로 다시 돌려 예측한 열림 ts 집합과 alarm_event.occurred_at 집합의 대조다.** 제외 구간 63개(PostgreSQL 정지 · alarm_eval 보류 · 무효 구간 로그 61)를 지나면 상태를 다시 맞춘다. 열림 ts만 대조하고 닫힘 ts는 대조하지 않는다 — ACTIVE 해소 첫 행의 확인 분기는 판정 순간의 acked_at을 재생할 수 없어 실측 닫힘 시각으로 정한다(리드 승인 조건 2026-09-27 · 원시 completeness.limitation).
- 생성기 종료 뒤 소진 2초 × 3.

### PostgreSQL 정지(AC-36 ①)

| 항목 | 반복 1 | 반복 2 | 반복 3 |
|------|------|------|------|
| 정지 완료 → docker start 호출 | 09:49:27.321 → 09:50:27.413Z | 10:20:03.625 → 10:21:03.733Z | 10:50:37.428 → 10:51:37.548Z |
| 탐침 첫 위반 → 확정 기한(첫 위반 + 30초) | 09:49:25 → 09:49:55Z | 10:20:01 → 10:20:31Z | 10:50:35 → 10:51:05Z |
| 기한이 정지 안 · 정지 전 PENDING | 예 · 예 | 예 · 예 | 예 · 예 |
| 정지 중 확정 실패 계수(open · close) | 2 · 0 | 9 · 0 | 2 · 1 |
| 정지 중 ch:alarm 프레임(전체 · 탐침) | 0 · 0 | 0 · 0 | 0 · 0 |
| 복구 뒤 탐침 이벤트 · OPENED 프레임 | 1(09:50:27Z) · 1 | 1(10:21:03Z) · 1 | 1(10:51:37Z) · 1 |
| 정지 중 판정 배치 · 적재 행 · DLQ | 62 · 620,000 · 0 | 62 · 620,000 · 0 | 62 · 620,000 · 0 |
| 정지 중 판정 구간 p50 · 인계 대기 p50 | 8.878 · 0.25 | 8.757 · 0.25 | 8.647 · 0.25 |
| 복구(pg_isready) 뒤 확정 확인까지(참고 · 1초 폴링) | 1,178 | 1,168 | 1,171 |
| worker 가동 · 재기동 | 가동 · 없음 | 가동 · 없음 | 가동 · 없음 |

- **정지 중 이벤트 미확정 · 발행 0 · 복구 뒤 확정 1이 세 반복 모두 성립한다.** 정지 중에도 판정은 배치마다 돌고(62배치) 적재 · 인계는 멈추지 않았다 — 판정 구간이 8.6~8.9 ms(p50)에 머문 것은 배치 단위 halt(06_pipeline/08 §부분 실패)의 결과로 읽힌다(원인은 원시로 가르지 않았다).
- 탐침 occurred_at이 docker start 호출보다 413 · 733 · 548 ms 앞선다(confirmAfterStartMs 음수). occurred_at은 확정한 행의 데이터 시각(초 단위)이라 벽시계 순서와 다르다 — 정지 완료 뒤인 것은 세 반복 모두 성립한다(probeOccurredAfterStop).

### alarm_eval 삽입 강제 실패(AC-36 ②)

| 항목 | 반복 1 | 반복 2 | 반복 3 |
|------|------|------|------|
| 보류 → 되돌림 → 끝 | 09:50:38.344 → 09:51:38.665 → 09:52:23.799Z | 10:21:11.831 → 10:22:12.101 → 10:22:57.226Z | 10:51:45.902 → 10:52:46.156 → 10:53:31.281Z |
| 보류 중 열림 · 닫힘(계수) · ch:alarm 프레임 | 4 · 4 · 8 | 2 · 3 · 5 | 7 · 6 · 13 |
| 보류 중 alarm_event 열림 · 닫힘(PostgreSQL) | 4 · 4 | 3 · 3 | 6 · 6 |
| 보류 중 alarm_eval 삽입 행 · 확정 실패 · DLQ · 적재 행 | 0 · 0 · 0 · 600,000 | 0 · 0 · 0 · 600,000 | 0 · 0 · 0 · 600,000 |
| 무효 구간 계수(배치 · 행) — 전체 | 61 · 2,501 | 61 · 2,501 | 61 · 2,501 |
| alarm_eval_gap 로그 — 이벤트(queue_full · retry_exhausted) · 행 · 못 읽은 줄 | 61(60 · 1) · 2,501 · 0 | 61(60 · 1) · 2,501 · 0 | 61(60 · 1) · 2,501 · 0 |
| 되돌림 뒤 45초 — 삽입 행 · 무효 구간(배치 · 행) | 1,804 · 3 · 123 | 1,845 · 3 · 123 | 1,845 · 3 · 123 |
| 보류 중 판정 구간 p50 · A5 p50 | 2.933 · 0.254 | 2.933 · 0.254 | 2.813 · 0.254 |

- **알람 발생 · 해제 · 발행이 정상이고 무효 구간 계수와 구조화 로그가 1:1이다(02_instrumentation §구간 기록).** 보류 60초 동안 alarm_eval 삽입은 0행이고 적재 · 확정은 그대로 돌았다.
- 무효 구간은 보류 중 58배치(2,378행) + 되돌림 뒤 3배치(123행)다. 되돌림 뒤 3배치는 무효 구간 로그의 마지막 데이터 ts가 되돌림 뒤 1.3 · 0.9 · 0.8초까지 걸친 몫이다 — 보류 중 깊이 1 큐를 잡고 재시도하던 배치가 끝나기 전에 온 배치로 읽힌다(원인은 원시로 가르지 않았다 · 사유별 시각 분해는 원시에 없다 · 구간은 gapLog.ranges). 세 반복이 같은 수인 것은 보류 길이와 재시도 백오프가 고정이기 때문으로 읽힌다(원인은 원시로 가르지 않았다).
- PostgreSQL 쪽 열림 · 닫힘(4 · 4 · 3 · 3 · 6 · 6)과 worker 계수(4 · 4 · 2 · 3 · 7 · 6)가 반복 2 · 3에서 1씩 다르다. 구조 판정과 무관한 셈 경로 차다(PG 셈 대 계수) — 원인은 단정하지 않는다.

### ACK 반영(두 브라우저) — 참고 지표 · 상한 성립만 구조 판정

| 반복 · 시도 | 이벤트 | 확인 응답 → B 표시(ms · 참고) | 구조 상한(ms) | 지연 − 상한(ms) | 확인 응답 → B 목록 응답 − 상한(ms · 참고) | A 자기 반영(ms) | 상한 성립(여유 3,000 ms 포함 · 러너 규칙) |
|------|------|------|------|------|------|------|------|
| 1 · 1 | 41 | 30,965 | 30,864 | +101 | +17 | 53 | 성립 |
| 1 · 2 | 40 | 4,943 | 40,863 | −35,920 | −35,990 | 54 | 성립 |
| 1 · 3 | 39 | 33,946 | 33,879 | +67 | +7 | 55 | 성립 |
| 2 · 1 | 41 | 34,233 | 34,173 | +60 | +10 | 53 | 성립 |
| 2 · 2 | 40 | 1,989 | 31,886 | −29,897 | −29,989 | 55 | 성립 |
| 2 · 3 | 39 | 16,955 | 30,844 | −13,889 | −13,998 | 55 | 성립 |
| 3 · 1 | 36 | 30,370 | 30,262 | +108 | +12 | 54 | 성립 |
| 3 · 2 | 35 | 6,876 | 30,823 | −23,947 | −23,977 | 52 | 성립 |
| 3 · 3 | 34 | 22,010 | 31,903 | −9,893 | −9,986 | 54 | 성립 |

- 반복 중앙값(참고) — 반영 지연 **30,965 · 16,955 · 22,010 ms**(중앙값 22,010 · 편차 63.65% — 편차 판정 밖) · A 자기 반영 54 · 55 · 54 ms. 확인 수락 3 · 거절 0 × 3이고 alm_acks_total{accepted} 창 차 3 × 3과 같다.
- **구조 상한의 식(러너 _alarm.ack_bound_ms · 리드 판정 2026-09-27 · 정본 문장은 W6).** 다른 탭의 확인 표시는 다음 목록 재조회 때이고, 이력 탭의 재조회 계기는 ch:alarm 프레임 뒤 겹침 행 TTL 경과뿐이다(08_screen/05 §실시간 겹침). 기준점 = max(tR − TTL, tR 이전 B의 마지막 목록 응답 시각)이고 상한 = (기준점 뒤 B의 첫 프레임 수신) + TTL − tR이다(tR = 확인 응답 시각 · TTL = cache:alarmevents 30,000 ms — 05_data_stores/05 현행 참고). 판정은 지연 ≤ 상한 + 여유 3,000 ms(ACK_SLACK_MS — 재조회 → 응답 → 그리기 · 러너 잠정)다.
- **판정은 측정 전에 검수 · 승인된 러너 규칙(ACK_SLACK_MS 3,000 ms 포함)대로 둔다 — 상한 성립 3/3(리드 판정 2026-09-27 · 측정을 본 뒤 기준을 바꾸지 않는다).** 여유 3,000 ms의 근거 문장은 W6에서 02_instrumentation에 둔다(리드 등재).
- **여유값 없는 엄격 상한으로는 아홉 시도 중 넷(r1 t1 · r1 t3 · r2 t1 · r3 t1)이 60~108 ms 넘는다.** 초과분은 B 탭 목록 응답 뒤 화면 반영(bDom − bFetch 84 · 60 · 50 · 96 ms)과 같은 규모다.
- **반영 시점을 B 탭 목록 응답(bFetch — 목록 응답 수신 시각 · ack-two-browsers.cjs response 이벤트)으로 잡아도 아홉 시도 모두 엄격 상한 안은 아니다.** 같은 넷이 7~17 ms(+17 · +7 · +10 · +12) 넘고 나머지 다섯은 9,986~35,990 ms 안이다 — 참고 열이며 판정에 쓰지 않는다. 남은 7~17 ms가 무엇의 몫인지(재조회 요청 → 응답 왕복 등)는 원시로 가르지 않았다.
- 02_instrumentation §확인(ACK) 신호 부재의 계측 표는 전파 지연 상한을 "이벤트 목록 캐시 TTL + 화면 폴링 주기"로 적는다. ALM-CONSOLE에는 주기 폴링이 없어(06_experiment_catalog 2026-09-27 불릿) 러너는 프레임 계기 식을 쓴다 — 두 문장의 정렬은 §정본 반영의 제안이다.
- B 탭이 받은 프레임 11 · 13 · 8(OPENED 6 · 6 · 4 · CLEARED 5 · 7 · 4) · B 목록 재조회 4 · 6 · 4. ACK 창 09:48:04 ~ 09:49:20Z · 10:19:00 ~ 10:20:00Z · 10:49:27 ~ 10:50:33Z.

### 구조 판정 — 3회 전부

| # | 판정 | 반복 1 · 2 · 3 | 3회 전부 |
|:--:|------|------|------|
| 1 | AC-35 판정 ≥ 확정(정상 창 · 규칙별 포함) | 성립 × 3 | 성립 |
| 2 | AC-35 상태 키 = 판정된 규칙 = 규칙(정상 창 40) | 성립 × 3 | 성립 |
| 3 | AC-35 상태 키 = 판정된 규칙 = 규칙(마감 41) | 성립 × 3 | 성립 |
| 4 | AC-09 미만(계층 S — 0행 · 위반 행 존재 · NORMAL 복귀) | 성립 × 3 | 성립 |
| 5 | AC-09 이상(계층 B — 이벤트 > 0 · 디바운스 short 0 · 규칙당 열린 행 ≤ 1) | 성립 × 3 | 성립 |
| 6 | AC-09 재생 완전성(예측 = 실측 = 일치) | 성립 × 3 | 성립 |
| 7 | AC-36 PostgreSQL 정지(미확정 · 발행 0 · 복구 뒤 확정 1) | 성립 × 3 | 성립 |
| 8 | AC-36 alarm_eval 실패(발생 · 해제 · 발행 정상 · 계수 = 로그 · 적재 무영향) | 성립 × 3 | 성립 |
| 9 | 판정 구간 p95 ≤ 플러시 주기(le=1 누적 ≥ 0.95) | 성립 × 3 | 성립 |
| 10 | ACK 반영 ≤ 구조 상한(여유 포함 · 수락 수 = 계수) | 성립 × 3 | 성립 |
| 11 | 규칙은 표면 경유(감사 INSERT 증분 = 규칙 수) | 성립 × 3 | 성립 |
| 12 | 정상 창 무효 구간 0 | 성립 × 3 | 성립 |
| 13 | 정상 창 재기동 없음 | 성립 × 3 | 성립 |
| 14 | 생성기 포화 아님(달성률 ≥ 0.99 · lateTicks 0) | 성립 × 3 | 성립 |

- 검산: 판정 = **14**(원시 judgement.structure 키 수 · table structure 행 수) · 빠진 판정(missing) 0 × 3.

## 해석

- **판정 구간 대 플러시 주기 — 이 부하에서 판정 구간은 플러시 주기의 1% 안팎이다.** 판정 구간 p50 6.73 ms(판정) · p95 9.55 ms(참고) · 전 배치 ≤ 15 ms 대 플러시 주기 1,000 ms이고 인계 대기가 전부 첫 칸이다. 06_pipeline/08의 구조 관계(판정 구간 p95 ≤ 플러시 주기)는 여유를 두고 성립한다 — 전 배치 ≤ 15 ms 기준 66배 이상 · p95 중앙값 9.55 ms 기준 약 105배(플러시 주기 1,000 ms ÷ 각 값). 원인 구조 — 배치당 Redis 왕복이 셋(규칙 캐시 GET · 상태 HGETALL · 상태 쓰기)으로 행 수와 무관하고(ADR-11), 판정 행이 초당 40행(규칙 40 × 1 Hz)뿐이라 A3 평가가 첫 칸(≤ 0.5 ms)에 머문다.
- **판정 구간의 가장 큰 몫은 A5 전수(4.19 ms)와 A4 확정(2.14 ms)이다.** 판정기는 ⑧ 삽입을 기다리지 않는데(06_pipeline/08 §⑧ 쓰기 분리) total이 A5를 품는 것은 판정 구간의 끝이 "A4 · A5 · A6 중 마지막 완료"이기 때문이다(04_architecture/05 판정 구간 행). 보류 중 A5가 0.25 ms(큐가 차 있으면 삽입 없이 즉시 무효 구간)로 떨어지자 total p50이 6.73 → 2.93 ms로 준 것이 같은 구조를 보여 준다 — 그래도 인계 대기는 첫 칸 그대로였다. A4가 확정이 드문 배치에서도 2 ms대인 것은 해소 첫 감지의 acked 확인 조회 등 PostgreSQL 왕복이 거의 모든 배치에 있다는 뜻으로 읽힌다(배치별 문장 수는 원시에 없다).
- **초당 판정 처리량 40행 · 1배치는 부하가 정한 값이지 판정기의 상한이 아니다.** 판정 행 = 규칙이 걸린 태그의 행 수이고 배치는 플러시 주기당 1개다. 06_experiment_catalog EXP-33 "확정되는 미확인" 중 초당 판정 처리량은 이 규칙 계획(규칙 40 · 1 Hz)의 값으로만 올릴 수 있다 — 상한은 규칙 수 · 태그 빈도를 올리는 별도 계단이 잰다.
- **부분 실패 격리 — 두 장애 모두 적재 · 인계를 멈추지 않았다.** PostgreSQL 정지 60초 동안 배치 단위 halt로 판정 구간이 8.6~8.9 ms(p50)에 머물고 확정 실패 계수는 open 2 · 9 · 2 · close 0 · 0 · 1만큼 올랐다. 발행은 0이었고 복구 직후 탐침이 확정됐다(pg_isready 뒤 확인 폴링 기준 약 1.17초 · 참고). alarm_eval 보류 60초 동안은 무효 구간 사유가 queue_full 60 · retry_exhausted 1이다 — 깊이 1 큐가 한 배치를 재시도로 잡은 동안 새 배치는 삽입 없이 즉시 무효 구간에 들어가(06_pipeline/08 §⑧ 채택안 ④) 판정 구간이 오히려 짧아졌다.
- **ACK 반영 지연은 재조회 타이머의 위상을 잰다.** 반영 시각은 "기준점 뒤 첫 프레임 + TTL 30초"에 모인다 — 아홉 시도 중 넷(반복마다 시도 1 · 반복 1 시도 3)은 30~34초에 섰고 반영이 상한 시각의 재조회 그 자체로 읽히며, 나머지 다섯은 이미 걸려 있던 재조회에 먼저 걸려 상한보다 9.9~35.9초 일찍(2.0~22.0초) 반영됐다. 그래서 반복 중앙값 31 · 17 · 22초의 편차 63.65%는 분포가 아니라 위상이다 — 카탈로그 불릿대로 참고로 내리고 상한 성립만 판정에 쓴다. 상한은 30초 겹침 TTL에 묶인다 — 여유 3,000 ms를 포함한 러너 규칙으로 9/9 성립(엄격 상한 초과 4건은 한계) · 02_instrumentation 상한 행과의 정렬은 §정본 반영 제안 ①.
- **세 저장소의 건수는 목적대로 다르다.** 판정 12,000 · 확정 13~18 · 상태 키 40(정상 창)이고 마감에서도 판정 57,657 · 확정 107~117 · 상태 키 41이다 — 셋을 한 수로 맞추려는 대조가 아니라 존재 이유의 대조다(AC-35 B형).
- 한계.
  - **ClickHouse 서버 로그 수준이 이미지 기본 trace다(모든 ClickHouse 측정의 공정성 한계 — 기록 046과 같은 조건).** alarm_eval 삽입(⑧ · A5)은 ClickHouse 쓰기 경로라 A5 · 판정 구간 total에 trace 로그 쓰기 부하가 들어 있다. PostgreSQL · Redis 쪽 하위 구간에는 같은 크기의 로그 부하가 없다 — A4 대 A5의 크기 비교에 이 몫을 가르지 않았다.
  - **판정 구간 total p50은 한 칸 안 보간값이다.** 세 반복 모두 p50이 (5, 8] ms 칸에 떨어진다(칸 폭 3 ms) — 편차 0.87%는 칸 안 보간의 흔들림이다(04_experiment_protocol §반복과 폐기 — 버킷 보간 분위수 조항). 인계 대기 · A1 · A3는 첫 칸(≤ 0.5 ms)에 몰려 값이 0.25 · 0.475로 고정된다.
  - **ACK 상한 성립 3/3은 여유 3,000 ms를 포함한 판정이다(승인된 러너 규칙).** 여유 없는 엄격 상한으로는 넷이 60~108 ms 넘고(B 탭 목록 응답 뒤 화면 반영과 같은 규모), 반영 시점을 B 목록 응답으로 잡아도 같은 넷이 7~17 ms 넘는다 — 엄격 상한 성립으로 인용하지 않는다.
  - 재생 완전성은 열림 ts 집합만 대조한다(닫힘 ts 대조 없음 · 확인 분기는 실측 닫힘으로 정함).
  - 탐침 확정 확인은 1초 폴링이라 confirmAfterReadyMs(1,168~1,178 ms)는 해상도 1초의 참고값이다.
  - 부하 실험 자원 · 모드 B · SPIKE · 규칙 41이 이 결론의 조건이다. 규칙 수 · 태그 빈도가 크면 A3 · A4가 커진다 — 이 기록에서 외삽하지 않는다.

## 폐기 · 예외

- **앞선 시도 1회 중단 — 원시 없음.** 반복 1의 첫 시도는 커밋 414fe03 · 4097b2d 러너로 돌았고 load 호출 중 bash 변수 바로 뒤에 한글이 붙은 전개가 set -u에서 미정의 변수로 읽혀 중단했다(핫픽스 (a)). 규칙 POST 뒤였으며 reset으로 상태 폴더를 버렸다(리드 확인). 이 시도에서 첫 판정 행이 POST보다 663 ms 앞선 관측이 판정 셈 하한 핫픽스 (b)의 근거다(러너 load 주석 "rep 1 실측 −663 ms"). 세 반복은 모두 핫픽스 뒤 커밋 05b237a로 처음부터(start) 돌았다.
- **러너 핫픽스 두 건(05b237a).** (a) 변수 뒤 한글 결합의 set -u 중단 (b) 판정 셈 하한 evalFloorMs = POST 시작 − 60초 — alarm_eval.ts가 배치의 데이터 시각이라 첫 판정 행이 POST보다 앞선다. 하한 없는 load 상태는 이어 쓰지 않는다(require_floor). 세 반복의 evalLeadMs −512 · −821 · −799 ms는 모두 60초 여유 안이고 하한 전 대상 규칙 행은 0이다.
- **폐기 없음.** 분포 판정 지표 셋(초당 판정 행 · 초당 판정 배치 · 판정 구간 total p50)(카탈로그 판정 지표는 구조 판정 — 편차 판정 지표는 측정 전 승인된 러너 DIST · 04 p50 조항)의 최대 편차 0.87%로 기준 20% 이내다. 생성기 포화 · 재기동 · 정상 창 무효 구간이 없어 창에서 뺀 구간이 없다.
- **편차 판정에서 뺀 값(러너 table discardEligible false).** ACK 반영 지연 중앙값(63.65% — 카탈로그 2026-09-27 불릿 · 재조회 타이머 위상) · 판정 구간 p95 · 인계 대기 p95(p95 참고 — 04 §반복과 폐기) · 인계 대기 p50(첫 칸 양자화 — 러너 사유 "리드 판정 2026-09-27" · 값 0% 편차라 판정 결과는 같다) · 무효 구간 계수(주입 창 · 백오프 위상 — 참고 · 0%) · 복구 뒤 확정(1초 폴링 · 참고) · 하위 구간 A1~A6(분해 · 참고 — A6 11.11% 최대) · le=1 비율(구조 관계의 판독값).
- **원시 안의 작은 차 두 가지.** ① 정상 창 alarm_eval 위반 행(ts 범위)과 판정기 위반 계수(캡처 창)가 반복 1 · 3에서 2 · 3 다르다(5,073 대 5,075 · 5,100 대 5,103) — 판정 전체 12,000은 같다 · 셈 경로 차(ts 범위 대 계수). ② alarm_eval 보류 창의 PostgreSQL 열림 · 닫힘과 worker 계수가 반복 2 · 3에서 1씩 다르다 — 셈 경로 차(PG 셈 대 계수 · §결과 alarm_eval 삽입 강제 실패). 둘 다 구조 판정과 무관하며 원인은 단정하지 않는다.
- **원시에 없는 값.** swap · 저장소 컨테이너 메모리(기준선 docker stats 한 줄뿐) · 판정 배치별 PostgreSQL 문장 수 · ClickHouse 서버 로그 설정(리드 확인 사실) · compose 파일 이름(리드 확인 사실).

## 정본 반영

- 이 기록이 올릴 자리(반영은 정본 문서의 개정일 줄이 갖는다).
  - 06_pipeline/08 §미확인 "판정 구간 ≤ 플러시 주기 관계의 실측" — 성립(le=1초 누적 비율 1.0 × 3 · 판정 구간 p50 6.73 ms · 전 배치 ≤ 15 ms · 인계 대기 첫 칸 — 기록 054 · 05b237a · 부하 실험 · M · 스위치 기본값 · 모드 B SPIKE 10,000 pps · 규칙 41).
  - 04_architecture/05 판정 구간 · A1~A6 미확인 행 — 판정 구간 p50 6.73 ms(판정 · 한 칸 보간) · A1~A6 p50 참고값(위 표) · ClickHouse trace 로그 한계 병기.
  - 06_experiment_catalog EXP-33 "확정되는 미확인" — 판정 구간 대 플러시 주기 관계(성립) · 초당 판정 처리량(이 규칙 계획의 값 40행 · 1배치 — 상한 아님) · ACK 전파 지연(참고 — 반복 중앙값 31 · 17 · 22초 · 상한 성립 3회).
  - 02_instrumentation §확인(ACK) 신호 부재의 계측 "실제 전파 지연 · 3계층 미확인" — 참고값만(위상 성분) · 상한 성립은 구조 사실로.
- 공용 파일 제안(리드 판정) — ① 02_instrumentation 상한 행 "TTL + 화면 폴링 주기"를 러너 식(기준점 뒤 첫 프레임 + TTL)으로 정렬(W6 정본 문장) ② ACK_SLACK_MS 3,000 ms의 근거 문장 ③ 인계 대기 p50 첫 칸 양자화를 카탈로그 2026-09-27 불릿에 명시.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "054",
  "exp": ["EXP-33"],
  "status": "valid",
  "supersedes": null,
  "window": {"start": "2026-09-27T09:42:50.859Z", "end": "2026-09-27T10:49:13.736Z"},
  "run": {"commitHash": "05b237a", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M"},
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": {"injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": 3.71, "compression": "zstd", "compressionSource": "no raw — code constant apps/api/src/common/clickhouse/clickhouse.module.ts:9 CLICKHOUSE_REQUEST_COMPRESSION (05b237a)", "swapUsed": null, "wslNetworking": null, "simFaultPlan": null, "stage": "S7", "signalProfile": "SPIKE", "pps": 10000, "generatorDurationS": 1500, "batchPlan": "A", "flushPeriodMs": 1000, "storeResources": "clickhouse=5-8/5368709120 postgres=9-10/2147483648", "storeProfile": "load (compose.load.yml — lead confirmed, not in raw)", "snapshot": "s7a-seed-m", "appRoles": ["api", "worker", "datagen", "web"], "lagSource": "worker", "webBuild": "J2NQidWhMo0dGSb7VDNnF", "ruleTiers": {"B": {"debounceMs": 2000, "n": 20, "offset": -1.0, "severity": 2}, "P": {"debounceMs": 30000, "n": 1, "offset": -10.0, "severity": 3}, "S": {"debounceMs": 5000, "n": 20, "offset": 25.0, "severity": 1}}, "rulesCreated": 41, "rulesCreatedVia": "POST /api/v1/alarms/rules", "faultPg": "docker stop 60 s after probe PENDING", "faultCh": "RENAME TABLE plc.alarm_eval <-> plc.alarm_eval_exp33_hold 60 s + recover 45 s", "ackListTtlMs": 30000, "ackSlackMs": 3000, "ackBound": "max(tR - TTL, last B list response <= tR) -> first B frame after it + TTL - tR (runner _alarm.ack_bound_ms · lead 2026-09-27)", "evalFloor": "rules POST start - 60 s", "evalLeadMs": [-512, -821, -799], "baselineS": [303, 302, 302], "windows": [{"rep": 1, "start": "2026-09-27T09:42:50.859Z", "end": "2026-09-27T09:47:50.578Z"}, {"rep": 2, "start": "2026-09-27T10:13:33.797Z", "end": "2026-09-27T10:18:33.384Z"}, {"rep": 3, "start": "2026-09-27T10:44:13.779Z", "end": "2026-09-27T10:49:13.736Z"}], "priorAttempt": "rep 1 first attempt (414fe03 · 4097b2d) aborted during load — bash variable followed by Hangul under set -u; reset after rules POST, no raw", "fairnessLimit": "ClickHouse server log level = image default trace (alarm_eval insert is on the CH write path)", "structureAllRuns": true, "structure": [{"check": "AC-35 evalGeConfirmed", "values": [true, true, true], "allRuns": true}, {"check": "AC-35 keysEqJudgedRules(window)", "values": [true, true, true], "allRuns": true}, {"check": "AC-35 keysEqJudgedRules(final)", "values": [true, true, true], "allRuns": true}, {"check": "AC-09 below(final)", "values": [true, true, true], "allRuns": true}, {"check": "AC-09 above(final)", "values": [true, true, true], "allRuns": true}, {"check": "AC-09 completeness(final)", "values": [true, true, true], "allRuns": true}, {"check": "AC-36 postgres-stop", "values": [true, true, true], "allRuns": true}, {"check": "AC-36 alarm_eval-fail", "values": [true, true, true], "allRuns": true}, {"check": "relation evalP95<=flush", "values": [true, true, true], "allRuns": true}, {"check": "ack withinBound", "values": [true, true, true], "allRuns": true}, {"check": "rules via surface", "values": [true, true, true], "allRuns": true}, {"check": "steady gap 0", "values": [true, true, true], "allRuns": true}, {"check": "no restart(window)", "values": [true, true, true], "allRuns": true}, {"check": "generator not saturated", "values": [true, true, true], "allRuns": true}], "runner": "scripts/lab/s5/alarm/exp33-alarm.sh · _alarm.py", "raw": "docs/measurements/raw/054-alarm-branch-partial-failure.jsonl"},
  "repeat": {"runs": 3, "deviation": 0.0086926936514731, "threshold": 0.2, "basis": "p50 · count throughput (evalRowsPerS · evalBatchesPerS · evalDurationTotalP50)"},
  "results": [
    {"metric": "evalRowsPerS", "arm": "alarm", "unit": "rows/s", "values": [40.037501793346436, 40.05514257961794, 40.005734155228915], "median": 40.037501793346436, "judged": true},
    {"metric": "evalBatchesPerS", "arm": "alarm", "unit": "batches/s", "values": [1.0009375448336608, 0.9980406359421471, 1.000143353880723], "median": 1.000143353880723, "judged": true},
    {"metric": "evalDurationTotalP50", "arm": "alarm", "unit": "s", "values": [0.006675675675675676, 0.006734146341463415, 0.006726415094339622], "median": 0.006726415094339622, "judged": true},
    {"metric": "handoffWaitP50", "arm": "alarm", "unit": "s", "values": [0.00025, 0.00025, 0.00025], "median": 0.00025, "judged": false},
    {"metric": "evalDurationTotalP95", "arm": "alarm", "unit": "s", "values": [0.009510204081632653, 0.009848076923076925, 0.009551724137931034], "median": 0.009551724137931034, "judged": false},
    {"metric": "handoffWaitP95", "arm": "alarm", "unit": "s", "values": [0.000475, 0.00047500000000000005, 0.000475], "median": 0.000475, "judged": false},
    {"metric": "evalWithinFlushFraction", "arm": "alarm", "unit": "ratio", "values": [1.0, 1.0, 1.0], "median": 1.0, "judged": false},
    {"metric": "ackPropagationMedianMs", "arm": "alarm", "unit": "ms", "values": [30965, 16955, 22010], "median": 22010, "judged": false},
    {"metric": "ackSelfMedianMs", "arm": "alarm", "unit": "ms", "values": [54, 55, 54], "median": 54, "judged": false},
    {"metric": "pgStopConfirmAfterReadyMs", "arm": "alarm", "unit": "ms", "values": [1178.0, 1168.0, 1171.0], "median": 1171.0, "judged": false},
    {"metric": "chFailGapBatches", "arm": "alarm", "unit": "batches", "values": [61.0, 61.0, 61.0], "median": 61.0, "judged": false},
    {"metric": "chFailGapRows", "arm": "alarm", "unit": "rows", "values": [2501.0, 2501.0, 2501.0], "median": 2501.0, "judged": false},
    {"metric": "evalDurationA1P50", "arm": "alarm", "unit": "s", "values": [0.0002516778523489933, 0.0002516835016835017, 0.0002516778523489933], "median": 0.0002516778523489933, "judged": false},
    {"metric": "evalDurationA2P50", "arm": "alarm", "unit": "s", "values": [0.000685897435897436, 0.0007285992217898832, 0.0007388059701492537], "median": 0.0007285992217898832, "judged": false},
    {"metric": "evalDurationA3P50", "arm": "alarm", "unit": "s", "values": [0.00025, 0.00025, 0.00025], "median": 0.00025, "judged": false},
    {"metric": "evalDurationA4P50", "arm": "alarm", "unit": "s", "values": [0.002116666666666667, 0.0021762114537444933, 0.002136929460580913], "median": 0.002136929460580913, "judged": false},
    {"metric": "evalDurationA5P50", "arm": "alarm", "unit": "s", "values": [0.004192307692307692, 0.004198581560283688, 0.004165562913907284], "median": 0.004192307692307692, "judged": false},
    {"metric": "evalDurationA6P50", "arm": "alarm", "unit": "s", "values": [0.00025, 0.0002777777777777778, 0.00025], "median": 0.00025, "judged": false}
  ]
}
```
