# 045 — 스트리밍 동시 적재: Redis 경유 모드 B 계단 10,000 → 100,000 pps에서 같은 배치를 받는 두 싱크(ClickHouse 삽입 · PostgreSQL COPY) (S5 · 대조 자원 조건 · 티어 M)

> 실험: EXP-45 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-26T23:40:25Z ~ 2026-09-27T00:41:42Z(반복 3 × 계단 4 × 180초 — 첫 계단 창 시작 ~ 마지막 계단 창 끝) · 실행 2026-09-27 08:34 ~ 09:42 KST(반복 1 기준선 시작 ~ 반복 3 collect)

모드 B 생성기가 stream:plc:raw에 발행한 행을 Ingest flusher가 배치로 묶어 ② ClickHouse tag_raw에 삽입하고, 같은 행 배열을 ③ PostgreSQL 대조군 plc_tag_raw_control에 COPY한다(SW-09 on · 06_pipeline/04 §대조군 동시 적재 기전). 이 기록은 계단 pps마다 **같은 배치를 받는 두 싱크의 시간**(insert_duration 대 ing_control_copy_seconds)과 쓰기 비용 · 랙 · 실패 · 사후 구간 count를 나란히 잰다. EXP-45의 판정은 두 가지다 — ① 계단별 두 싱크 시간(p50 판정 · p95 참고)과 ② 판정 점 "PostgreSQL COPY가 플러시 주기를 넘는 pps"(COPY p95 > COPY 타임아웃 또는 첫 실패 계단 · ClickHouse는 삽입 p95 > 창 폭 W).

**이 기록은 목표 ②의 수집 처리량을 재지 않는다(05_data_stores/10 §스트리밍 동시 적재 — EXP-45 B형).** 랙 · 달성률은 두 싱크 합의 결과이고 대조 자원 조건 위의 값이다 — 모드 B 계단 기록(029 · EXP-23 · 부하 실험 자원)과 한 선에 겹쳐 그리지 않는다. 수치는 전부 원시(docs/measurements/raw/045-control-stream-ingest.jsonl)와 계단 캡처 원본(.omc/lab/s5/exp45-r{1,2,3}-stream/steps)에 있는 값만 쓴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(health run.commitHash — 세 반복 모두 · 대조군 COPY 기동 인자는 이미지 커밋 19f8861의 control-table-sink.port.ts에서 러너가 읽었다) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · api 컨테이너 상한 2048 MB(run.memoryLimitMb — api health 원시 그대로) · 저장소 상한은 대조 메모리 칸(아래 자원 행) |
| 용량 티어 | M(run.capacityTier M · 복원 스냅샷 s7a-seed-m — 티어 M 시드 · 계단 전부 M 시드 위 · 100,000 pps는 M 시드 10 Hz) |
| 스위치 | **SW-09 on** · SW-10 off · 나머지 기본값 — 세 반복의 api health switches 11개와 계단마다 생성기 보고 switches가 같다(러너 start가 api · worker health 둘 다 SW-09 on · SW-10 off를 대조) · 전수는 기계 판독 블록 |
| 배치 안 · 판정 기준 | **배치 안 A만**(INGEST_BATCH_PLAN A · 컨슈머 3 · 창 폭 W 1초 · 행 상한 50,000 — app-config INGEST_BATCH_PLANS) · COPY 타임아웃 500 ms(W ÷ 2) · 블록 conditions flushWindowSeconds 1 · copyTimeoutSeconds 0.5 |
| 대조군 내구성 · 인덱스 | **대조군 COPY 세션 synchronous_commit off**(연결 기동 인자 -c synchronous_commit=off · 서버 기본 on · 역할 · DB 설정 없음 — 원시 controlCopySyncCommit.reference) · 인덱스 변형 I1(BRIN · btree 없음을 start가 확인) |
| 저장소 자원 | 대조 자원 조건 — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B(원시 storeResources · 러너가 어긋나면 멈춘다) |
| 프로세스 구성 | api(APP_ROLE api — OBS 저장소 수집) + worker(적재 · 대조군 COPY · lag 표본 원천) + datagen 컨테이너(모드 B · cpuset 11-12 · 계단마다 245초 고정 지속) · 조회 부하 없음 |
| 주입 모드 · 부하 | B · 계단 10,000(1 Hz) · 20,000(2 Hz) · 50,000(5 Hz) · 100,000(10 Hz) pps · 계단마다 전환 60초 + 창 180초 · MAXLEN 200,000 · 생성기 달성률 1.0 · lateTicks 0(12개 계단 창 전부) · 생성기 workerUtilization 최대 0.0299 · 시드 정수는 원시에 없음 |
| 초기 상태 · 기준선 | 반복마다 복원 **s7a-seed-m**(티어 M 시드 · 시작 행 수 tag_raw 0 · 대조군 0) — 기존 S5 부하 기록(028 · 029 등)의 복원 s3-empty-m과 **다른 스냅샷**이다 · 기준선은 반복마다 부하 없이 302 · 303 · 302초(현행 참고 5분 충족) |
| 관측 스택 · CPU 배치 | off · 대조 동일화(control-equalized) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd — **원시 없음** · 코드 상수 apps/api/src/common/clickhouse/clickhouse.module.ts:9 CLICKHOUSE_REQUEST_COMPRESSION(19f8861 · api · worker ClickHouse 클라이언트 요청 압축) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회 · 판정 지표(p50) 최대 편차 **2.41%**(ClickHouse 50,000 계단) — 기준 20% 이내 · p95 최대 편차 12.67%(ClickHouse 100,000 계단 · 참고) · 구조 판정(COPY 실패 0 · 구간 count 일치)은 3회 전부 성립 |
| 스크립트 · 원시 | scripts/lab/s5/load/exp45-control-stream.sh start · step × 4 · stop · collect · table · _rec.py(exp45_step_view · rec_exp45 · exp45-stream-steps) · 원시 4줄(반복 3줄 + table 1줄) |

반복 한 번의 절차는 아래 순서다.

```plain
start      복원 s7a-seed-m → 기준선 약 302초 → api · worker 기동 → health 대조(SW-09 on · SW-10 off · I1 · 자원 · 기동 인자)
step × 4   2초 대기 → datagen 245초 기동 → 전환 60초 표본 → 캡처 m0 → 창 180초 표본 → 캡처 m1 → part_log 판독
stop       적체 소진(0 · 1초) → 계단별 ts 범위 count · KST 일 count 대조 → COPY 실패 로그 수집 → 정지
collect    반복 하나 = 원시 한 줄(steps 4)
table      반복 3줄 → conditions · repeat · streamSteps 한 줄(저장소 접속 없음)
```

- **싱크 시간은 계단 창 앞뒤 두 캡처(m0 · m1)의 버킷 차 분위수다.** 누적 히스토그램을 그대로 읽으면 앞 계단의 표본이 섞인다. 식은 apps/web/lib/compare.ts histQuantile과 같다(칸 안 선형 보간).
- **캡처는 창 경계 순간의 /metrics 원문이다.** 쓰기 비용은 PostgreSQL pg_stat_wal · pg_stat_all_tables(대조군 잎 파티션)와 ClickHouse system.parts · system.part_log(tag_raw · 창 [시작, 끝))를 경계에서 직접 조회한다. OBS 거울(pg_wal_bytes_total)은 수집 주기 15초만큼 어긋나 참고로만 둔다.
- **구간 count는 적체 소진 뒤 stop이 읽는다.** 계단 발행 ts 범위(기동 − 1초 ~ 종료)의 tag_raw 대 대조군 행 수와 KST 일 파티션 단위 count다(06_pipeline/04 구간 count 대조 절차 ①②).

## 결과

값의 순서는 반복 1 · 2 · 3이다. 시간은 ms로 옮겨 적는다(블록은 초).

| 계단(pps) | 배치 행 수 · 초당 배치 | ClickHouse 삽입 p50(판정) | 중앙값 | 편차 | PostgreSQL COPY p50(판정) | 중앙값 | 편차 |
|------|------|------|------|------|------|------|------|
| 10,000 | 10,000 · 1 | 64.21 · 64.39 · 64.22 | 64.22 | 0.28% | 12.51 · 12.50 · 12.57 | 12.51 | 0.57% |
| 20,000 | 20,000 · 1 | 65.17 · 65.08 · 64.92 | 65.08 | 0.39% | 25.0 · 25.0 · 25.0 | 25.0 | 0%(한 칸 보간) |
| 50,000 | 50,000 · 1 | 93.53 · 91.32 · 91.81 | 91.81 | **2.41%** | 65.0 · 65.0 · 65.0 | 65.0 | 0%(한 칸 보간) |
| 100,000 | **50,000 · 2** | 83.95 · 84.92 · 83.22 | 83.95 | 2.02% | 65.0 · 65.0 · 65.0 | 65.0 | 0%(한 칸 보간) |

| 계단(pps) | ClickHouse 삽입 p95(참고) | 중앙값 | 편차 | PostgreSQL COPY p95(참고) | 중앙값 | 편차 | 표본이 든 칸(ClickHouse · PostgreSQL · 세 반복 합집합) |
|------|------|------|------|------|------|------|------|
| 10,000 | 78.42 · 78.44 · 78.42 | 78.42 | 0.02% | 14.78 · 14.75 · 14.89 | 14.78 | 0.92% | 30~80 ms · 10~20 ms |
| 20,000 | 78.82 · 78.66 · 78.49 | 78.66 | 0.42% | 29.5 · 29.5 · 29.5 | 29.5 | 0% | 30~100 ms · **20~30 ms 한 칸** |
| 50,000 | 140.43 · 131.90 · 134.48 | 134.48 | 6.34% | 78.5 · 78.5 · 78.5 | 78.5 | 0% | 50~150 ms · **50~80 ms 한 칸** |
| 100,000 | 135.48 · 142.17 · 125.00 | 135.48 | 12.67% | 78.5 · 78.5 · 78.5 | 78.5 | 0% | 50~250 ms · **50~80 ms 한 칸** |

- **계단마다 PostgreSQL COPY p50이 ClickHouse 삽입 p50보다 작다 — 비는 5.1 · 2.6 · 1.4 · 1.3배다.** ClickHouse는 10,000 → 20,000행 배치에서 거의 그대로(64 → 65 ms)이고 50,000행에서 약 92 ms다. PostgreSQL은 표본이 든 칸이 배치 행 수를 따라 10~15 · 20~30 · 50~80 ms로 옮겨 간다.
- **50,000 · 100,000 계단은 배치가 같다.** 행 상한 50,000에 걸려 100,000 pps는 1초분을 두 배치로 나눈다(창 배치 수 360 = 180초 × 2 · 창 행 수 18,000,000 ÷ 360 = 50,000). 두 계단의 싱크 시간은 같은 크기 배치의 시간이다.
- 창 배치 수(ClickHouse · PostgreSQL)는 반복 1 180 · 180 · 180 · 179 · 180 · 180 · 360 · 360 · 반복 2 180 · 180 · 180 · 180 · 181 · 181 · 360 · 360 · 반복 3 181 · 180 · 180 · 180 · 180 · 180 · 360 · 360이다(계단 순서 · 두 싱크 쌍).

| 계단(pps) | 창 행 수 ClickHouse · PostgreSQL(rowsDiff) | 계단 구간 count tag_raw = 대조군 | COPY 실패 · DLQ · 삽입 재시도 | consumer_lag 중앙값(엔트리) | 미배달 ing_group_lag 중앙값 | 랙 기울기(/s) |
|------|------|------|------|------|------|------|
| 10,000 | 1,800,000 · 1,800,000(0) · 1,800,000 · 1,800,000(0) · **1,810,000 · 1,800,000(10,000)** | 2,450,000 × 3 일치 | 0 · 0 · 0 × 3 | 50 · 50 · 50 | 0 · 0 · 0 | 0.013 · 0.012 · −0.048 |
| 20,000 | **3,600,000 · 3,580,000(20,000)** · 3,600,000 · 3,600,000(0) · 3,600,000 · 3,600,000(0) | 4,900,000 × 3 일치 | 0 · 0 · 0 × 3 | 100 · 100 · 100 | 0 · 0 · 0 | 0 · 0.005 · −0.010 |
| 50,000 | 9,000,000 · 9,050,000 · 9,000,000(두 싱크 같음 · 0) | 12,250,000 × 3 일치 | 0 · 0 · 0 × 3 | 250 · 250 · 250 | 0 · 0 · 0 | −0.054 · −0.027 · −0.019 |
| 100,000 | 18,000,000 × 3(두 싱크 같음 · 0) | 24,500,000 × 3 일치 | 0 · 0 · 0 × 3 | 250 · 250 · 250 | 0 · 0 · 0 | −0.80 · −1.46 · −1.58 |

- **구조 판정은 12개 계단 창 전부에서 성립한다.** COPY 실패 0(원시 copyFailureEvents 빈 배열 × 3) · DLQ 0 · 삽입 재시도 0 · 계단 구간 count 일치 · KST 일 대조 2026-09-27 tag_raw 44,100,000 = 대조군 44,100,000(반복 3회 · 네 계단 발행 합 2,450,000 + 4,900,000 + 12,250,000 + 24,500,000 = **44,100,000**).
- 랙은 발행 1초분(초당 엔트리 = pps ÷ 설비당 태그 200)에 머물고 미배달이 0이다 — 100,000 계단의 중앙값 250은 두 배치로 나뉜 반 초분이다. 적체 소진은 반복마다 1 · 0 · 0초다.

| 계단(pps) | PostgreSQL WAL 바이트(MB) | WAL 바이트 ÷ 행(B) | WAL FPI | autovacuum 실행 | 죽은 튜플(끝 · 증분) | ClickHouse 새 파트 바이트(MB) | 새 파트 ÷ 행(B) | 머지 수 | 머지 쓰기 바이트(MB) | 활성 파트 시작 → 끝 |
|------|------|------|------|------|------|------|------|------|------|------|
| 10,000 | 92.18 · 92.69 · 92.68 | 51.5 | 7 · 7 · 7 | 3 · 3 · 3 | 0 · 0 × 3 | 14.71 · 14.71 · 14.70 | 8.2 | 34 · 35 · 35 | 54.50 · 55.88 · 55.31 | 5→3 · 5→3 · 4→6 |
| 20,000 | 184.31 · 183.22 · 183.17 | 50.9 | 10 · 9 · 9 | 3 · 3 · 3 | 0 · 0 × 3 | 25.95 · 25.95 · 25.94 | 7.2 | 33 · 34 · 33 | 77.70 · 81.68 · 92.04 | 3→9 · 8→8 · 4→6 |
| 50,000 | 474.96 · 481.76 · 482.17 | 53.5 | 11,252 · 13,772 · 15,862 | 2 · 2 · 2 | 0 · 0 × 3 | 52.60 · 52.89 · 52.60 | 5.8 | 35 · 34 · 34 | 167.04 · 146.14 · 151.66 | 8→9 · 4→7 · 9→6 |
| 100,000 | 944.30 · 912.10 · **1,102.27** | 52.5 | 20,164 · 60 · **114,075** | 2 · 1 · 2 | 0 · 0 × 3 | 105.23 · 105.23 · 105.26 | 5.8 | 70 · 69 · 70 | 412.74 · 403.00 · 417.99 | 10→8 · 8→9 · 7→7 |

- 행당 값은 세 반복 중앙값 ÷ 계단 창 행 수(1,800,000 · 3,600,000 · 9,000,000 · 18,000,000)다. 1 MB = 10^6 B.
- **PostgreSQL WAL은 행당 약 51~54 B로 배치 크기와 무관하게 일정하다.** ClickHouse 새 파트는 행당 8.2 → 5.8 B로 배치가 클수록 작다. 활성 파트는 창 경계에서 3~10개이고 머지가 약 5개 새 파트마다 1회 따라온다(180초 새 파트 180 · 머지 33~35 · 100,000 계단 360 · 69~70).
- 죽은 튜플 0은 롤백된 COPY가 없다는 뜻이다(추가 전용 · 05_data_stores/10 지표 표 쓰기 비용 행). autovacuum 실행은 죽은 튜플이 아니라 삽입 수 문턱이 걸었다.

## 해석

- **판정 점 — 관측 범위 10,000~100,000 pps 안에서 두 싱크 모두 기준을 넘지 않는다("관측 범위 안 없음").** PostgreSQL COPY p95 중앙값 최대 78.5 ms 대 COPY 타임아웃 500 ms · ClickHouse 삽입 p95 중앙값 최대 135.48 ms 대 창 폭 W 1,000 ms다. 분위수 보간을 떠나 표본이 든 칸의 윗경계로도 PostgreSQL 전 표본 ≤ 80 ms · ClickHouse 전 표본 ≤ 250 ms다. 러너 judgement도 세 반복 모두 firstPps null · notExceededInRange true(범위 10,000 ~ 100,000)다. 따라서 EXP-45의 확정 대상 "PostgreSQL COPY가 플러시 주기를 넘는 pps"는 **이 조건에서 100,000 pps 초과(관측 범위 안 없음)**로 기록한다.
- **PostgreSQL 판정 점은 실질적으로 첫 실패 계단이다(A형).** 통념은 "COPY p95가 타임아웃을 넘는 계단"을 히스토그램에서 읽는 것이다. 부정 — ing_control_copy_seconds는 성공한 COPY만 관측하고(control-table-sink.port.ts — 타임아웃으로 끊긴 COPY는 실패 계수만 올린다) 타임아웃 500 ms가 칸 경계(0.5)라, 히스토그램 p95가 0.5초를 넘으려면 타임아웃 없이 0.5초를 넘긴 성공 COPY가 있어야 하는데 그런 COPY는 타임아웃이 먼저 끊는다. 진짜 축은 ing_control_copy_failures_total이다. 대체 경로 — 판정 점은 실패 ≥ 1 계단으로 읽고, 이 기록은 12개 창 전부 실패 0이라 그 계단도 관측 범위 안에 없다.
- **원리 — 배치 하나의 두 쓰기는 비용 구조가 다르다.** 같은 행 배열을 받아도 ClickHouse는 배치마다 고정비가 크고 PostgreSQL은 행 수에 비례한다.
  - ClickHouse 삽입은 배치 하나가 tag_raw에 파트 하나를 만든다(창 새 파트 수 = 창 배치 수 · 180 · 360). 파트마다 열 파일 · 마크 · 압축 블록을 쓰고, 같은 삽입이 MV 연쇄(mv_tag_1m → tag_1m · 이어서 tag_1h · tag_1d — infra/clickhouse/ddl 006 · 007)의 대상 테이블 파트도 만든다. 그래서 10,000행과 20,000행 배치가 64 · 65 ms로 거의 같고, 행이 2.5배인 50,000행 배치도 약 1.4배(92 ms)다. 행당 새 파트 바이트가 8.2 → 5.8 B로 주는 것은 배치가 클수록 한 파트의 열 압축 블록이 커져 압축이 잘 되는 결과로 읽힌다(파트 안 블록 구성은 원시에 없다). 대신 파트는 뒤에서 머지된다 — 창마다 머지 쓰기 바이트가 새 파트 바이트의 약 2.9~3.9배(중앙값 기준)이고, 이 비용은 삽입 응답 밖(백그라운드)에서 치른다.
  - PostgreSQL COPY는 힙 페이지 추가 + WAL이다. WAL이 행당 약 51~54 B로 일정하고 COPY 시간 칸이 배치 행 수를 따라 10~15 → 20~30 → 50~80 ms로 옮겨 간다 — 행당 약 1.0~1.6 µs(칸 경계 ÷ 행 수)의 선형 비용이다. 추가 전용이라 죽은 튜플이 0이고 머지 같은 뒤처리가 없으며, autovacuum은 삽입 문턱으로 창마다 1~3회 돈다. synchronous_commit off라 커밋이 WAL flush를 기다리지 않는다 — COPY 시간에 fsync 대기가 들지 않는다.
  - 결과 — 이 배치 크기 범위(10,000~50,000행)에서는 PostgreSQL이 배치당 더 빠르고 차는 배치가 클수록 준다(5.1 → 1.3배). ClickHouse의 고정비가 행 수로 분할되고 PostgreSQL의 비례비가 쌓이기 때문이다. 두 선이 만나는 배치 크기는 행 상한 50,000 안에 없다 — 배치 안 A에서는 계단이 올라도 배치가 50,000행을 넘지 않으므로, 이 수집 경로에서 교차는 관측될 수 없다.
- **100,000 pps에서 싱크 시간이 오르지 않는 이유는 배치 상한이다.** 50,000 계단과 100,000 계단은 같은 50,000행 배치이고 100,000 계단은 초당 배치 수만 두 배다(ClickHouse p50 91.81 → 83.95 ms · PostgreSQL 같은 칸). 그래서 배치 안 A에서 pps를 더 올려도 COPY 한 번의 시간은 50,000행 배치 시간(50~80 ms 칸)에 머물고, 플러시 주기를 넘는 쪽은 배치당 시간이 아니라 컨슈머 점유(초당 배치 수 × (②+③))로 나타날 것이다 — 이 문장은 가설이며 100,000 pps 너머는 이 기록에서 외삽하지 않는다.
- **쓰기 비용 원시 수치는 두 저장소의 쓰기 증폭 모양을 보여 준다.** PostgreSQL은 배치 크기와 무관하게 행당 WAL이 일정하고 뒤처리 쓰기가 없다(죽은 튜플 0). ClickHouse는 삽입 시점 쓰기(행당 5.8~8.2 B)가 작고 머지가 뒤에서 몇 배를 다시 쓴다(머지 읽기 바이트 10,000 계단 약 445~456 MB → 100,000 계단 약 3.49~3.62 GB). 50,000 · 100,000 계단의 WAL FPI 급증(수만 건)은 창 안에 체크포인트가 지나 그 뒤 첫 수정 페이지마다 전체 이미지가 실린 것으로 읽힌다(체크포인트 시각은 원시에 없다) — 반복 3 100,000 계단의 WAL 1,102 MB(다른 두 반복 912 · 944 MB)는 FPI 114,075건이 더한 몫이다.
- **SW-09 기록의 synchronous_commit 조건이 이 기록부터 다르다.** 이 기록의 대조군 COPY 세션은 synchronous_commit off(연결 기동 인자)다. 이전 S3~S5에서 SW-09 on으로 돈 기록(예: 015 S3 회귀)은 이 기동 인자가 없어 **서버 기본 on 조건**이었다 — COPY마다 커밋이 WAL flush를 기다렸다. 두 조건의 COPY 시간을 한 비교로 묶지 않는다.
- 한계.
  - **PostgreSQL COPY 분위수는 계단마다 한 칸 안 보간값이다.** 20,000 계단은 표본 전부가 (0.02, 0.03] 칸, 50,000 · 100,000 계단은 전부 (0.05, 0.08] 칸에 들어(버킷 정의 apps/api/src/common/metrics/registry.ts LATENCY_BUCKETS_SECONDS … 0.01 · 0.015 · 0.02 · 0.03 · 0.05 · 0.08 · 0.1 …) 선형 보간이 칸의 50% · 95% 지점(0.025 · 0.0295 · 0.065 · 0.0785)을 낸다. 10,000 계단도 180표본 중 179 · 180 · 179개가 (0.01, 0.015] 칸이다. 그래서 편차 0%는 분포가 안정적이라는 뜻이 아니라 보간이 같은 값을 낸 것이다(04_experiment_protocol §반복과 폐기 — 기록 013 on 팔과 같은 성격). 판정 점(기준 0.5 · 1초) 판독에는 충분하지만 **50,000 대 100,000 계단의 COPY 시간 차 · 배치당 행 비례 계수는 이 계측으로 가를 수 없다** — 칸 폭 30 ms가 해상도다.
  - ClickHouse 삽입 시간은 MV 연쇄 대상 테이블 쓰기를 포함하고 part_log · 활성 파트는 tag_raw만 센다. PostgreSQL 쪽은 대조군 한 테이블(BRIN 인덱스 I1)이다 — "같은 배치"는 같은 행 배열이라는 뜻이지 같은 양의 쓰기라는 뜻이 아니다.
  - pg_stat_wal은 클러스터 전체 값이다 — 창 안의 api 쓰기 · OBS 수집 · autovacuum WAL이 섞인다(부하 없는 조회 경로라 작지만 0은 아니다). 힙 · 인덱스 파일 쓰기 바이트(체크포인트 · 백그라운드 쓰기)는 원시에 없다.
  - 대조 자원 조건(ClickHouse 3 vCPU · PostgreSQL 3 vCPU · 각 3.5 GiB) · synchronous_commit off · 배치 안 A가 이 결론의 조건이다. 안 B(창 5초 · COPY 타임아웃 2.5초가 한 칸 안)와 안 C의 판정 점은 이 기록에서 외삽하지 않는다(05_data_stores/10 §스트리밍 동시 적재 한계).
  - 관측 범위가 100,000 pps에서 끝난다. 부하 실험 자원의 모드 B 기록(029)과 싱크 시간을 겹쳐 비교하지 않는다(자원 배분이 다르다).

## 폐기 · 예외

- **러너 결함 1건 — 반복 1 100,000 계단의 재기동 오판(수정 후 재계산).** 계단 직후 step 출력이 restart true였다. 원인 — _rec.py restart_detected가 이름이 _total로 끝나는 계열을 누적 계열로 보는데, worker의 prom-client 기본 게이지 nodejs_active_resources_total(활성 자원 수 · TYPE gauge)이 창 앞뒤 19 → 16으로 줄어 누적 계열 감소로 잡혔다. 컨테이너 가동은 연속이다 — 두 캡처의 process_start_time_seconds가 같고(1790465957) 누적 계수(rows_inserted · insert_duration_count 854 → 1,214)가 이어진다. 리드가 restart_detected에서 이름이 _total로 끝나는 게이지 3종(nodejs_active_resources_total · nodejs_active_handles_total · nodejs_active_requests_total — GAUGES_NAMED_TOTAL)을 빼도록 고친 뒤 저장된 캡처로 collect를 다시 돌려(저장소 재측정 없음) 원시에는 restartDetected false로 들어갔다. 이 계단을 창에서 빼지 않았다.
- **rowsDiff가 0이 아닌 계단 2곳 — 창 끝 경계에 걸친 배치 하나이며 유실이 아니다.** 반복 1 20,000 계단 20,000행 · 반복 3 10,000 계단 10,000행으로 각각 그 계단의 배치 1개 크기다. 캡처로 확인한 모양 — 창 끝 캡처 m1에서 ClickHouse 삽입 수가 COPY 수보다 1 많고(반복 1 20,000 계단 insert_duration_count 484 · ing_control_copy_seconds_count 483 · 반복 3 10,000 계단 239 · 238), 다음 계단의 창 앞 캡처 m0에서는 같다(549 · 549 · 302 · 302). 배치가 ② 삽입을 마치고 ③ COPY 중일 때 m1이 찍힌 것이다(②가 ③보다 앞서는 기전 순서). 두 계단의 구간 count와 KST 일 count는 일치한다. 같은 이유로 두 창의 PostgreSQL 표본 수가 ClickHouse보다 1 적다(179 대 180 · 180 대 181).
- **폐기 없음.** p50 판정 지표 최대 편차 2.41%로 기준 20% 이내다. 재기동(수정 뒤) · 생성기 포화 · COPY 실패 창이 없어 창에서 뺀 구간이 없다(전환 60초는 설계상 창 밖).
- **편차 판정에서 뺀 값.** p95는 참고(히스토그램 계열 — 04_experiment_protocol §반복과 폐기)라 ClickHouse 100,000 계단 12.67%를 폐기 판정에 쓰지 않는다. 랙 · 쓰기 비용 · autovacuum은 두 싱크 합의 관측값 또는 순간값이라 판정 지표가 아니다.
- **원시에 없는 값.** 시드 정수 · 생성기 컨테이너 CPU(workerUtilization만 있다) · 저장소 CPU · 부하 중 컨테이너 메모리 · swap · PostgreSQL 힙 파일 쓰기 바이트 · ClickHouse MV 대상 테이블의 파트 · 머지 · 행 단위 COPY 시간(히스토그램 칸보다 가는 해상도).

## 정본 반영

- 이 기록이 올릴 자리(반영은 정본 문서의 개정일 줄이 갖는다).
  - 05_data_stores/10 §미확인 등재 "PostgreSQL COPY가 플러시 주기를 넘는 pps" — 관측 범위 10,000~100,000 pps 안 없음 · COPY p95 중앙값 최대 78.5 ms(한 칸 보간 · 칸 50~80 ms) 대 타임아웃 500 ms · COPY 실패 0(기록 045 · 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 대조 자원 · synchronous_commit off · 배치 안 A). 100,000 pps 너머와 안 B · C는 미확인 유지.
  - 06_pipeline/04 §대조군 동시 적재 기전 — 배치 안 A에서 ③ COPY가 XACK를 늦추는 폭(배치당 p50 12.5~65 ms)과 창 끝 캡처 순간 ②와 ③ 사이에 배치 하나가 걸리는 관측(구간 count로는 드러나지 않는 창 경계 현상).
- 해석 한계의 제안 — PostgreSQL COPY 시간의 배치 크기 비례를 재려면 ing_control_copy_seconds에 0.03~0.08 사이 칸을 더하거나 정확 분위수 수단이 필요하다(계측 변경은 별건).

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "045",
  "exp": ["EXP-45"],
  "status": "valid",
  "supersedes": null,
  "window": {"start": "2026-09-26T23:40:25.627Z", "end": "2026-09-27T00:41:42.650Z"},
  "run": {"commitHash": "19f8861", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M"},
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "on", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": {"injectionMode": "B", "observability": "off", "cpuset": "control-equalized", "controlMemoryMb": {"clickhouse": 3584, "postgres": 3584}, "seed": null, "generatorCpuMax": null, "generatorWorkerUtilizationMax": 0.0299, "compression": "zstd", "compressionSource": "no raw — code constant apps/api/src/common/clickhouse/clickhouse.module.ts:9 CLICKHOUSE_REQUEST_COMPRESSION (19f8861)", "swapUsed": null, "wslNetworking": null, "simFaultPlan": null, "flushWindowSeconds": 1.0, "copyTimeoutSeconds": 0.5, "batchPlan": "A", "controlCopySyncCommit": "off", "stage": "S5", "appRoles": ["api", "worker", "datagen"], "lagSource": "worker", "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384", "snapshot": "s7a-seed-m", "indexVariant": "I1", "batchMaxRows": 50000, "steps": [10000, 20000, 50000, 100000], "transitionS": 60, "windowS": 180, "baselineS": 302, "controlCopyOptions": "-c synchronous_commit=off", "serverSynchronousCommit": "on", "dailyCount": {"day": "2026-09-27", "tagRaw": 44100000, "control": 44100000, "matchAllRuns": true}, "copyFailures": 0, "runnerFix": "_rec.py restart_detected excludes prom-client gauges named *_total (nodejs_active_resources_total · nodejs_active_handles_total · nodejs_active_requests_total) — rep 1 100000 step re-collected from saved captures"},
  "repeat": {"runs": 3, "deviation": 0.0241, "threshold": 0.2, "deviationP95": 0.1267, "basis": "p50"},
  "results": [],
  "streamSteps": [
    {"pps": 10000, "store": "clickhouse", "metric": "insert_duration_seconds_p50", "unit": "s", "values": [0.06421052631578947, 0.06439306358381502, 0.06421511627906977], "median": 0.06421511627906977, "failures": [0, 0, 0], "valid": true},
    {"pps": 10000, "store": "clickhouse", "metric": "insert_duration_seconds_p95", "unit": "s", "values": [0.07842105263157895, 0.0784393063583815, 0.07842151162790698], "median": 0.07842151162790698, "failures": [0, 0, 0], "valid": true},
    {"pps": 10000, "store": "postgresql", "metric": "control_copy_seconds_p50", "unit": "s", "values": [0.012513966480446927, 0.0125, 0.01257142857142857], "median": 0.012513966480446927, "failures": [0, 0, 0], "valid": true},
    {"pps": 10000, "store": "postgresql", "metric": "control_copy_seconds_p95", "unit": "s", "values": [0.014776536312849161, 0.01475, 0.014885714285714285], "median": 0.014776536312849161, "failures": [0, 0, 0], "valid": true},
    {"pps": 20000, "store": "clickhouse", "metric": "insert_duration_seconds_p50", "unit": "s", "values": [0.0651685393258427, 0.06508379888268156, 0.06491620111731844], "median": 0.06508379888268156, "failures": [0, 0, 0], "valid": true},
    {"pps": 20000, "store": "clickhouse", "metric": "insert_duration_seconds_p95", "unit": "s", "values": [0.07882022471910113, 0.07865921787709498, 0.07849162011173184], "median": 0.07865921787709498, "failures": [0, 0, 0], "valid": true},
    {"pps": 20000, "store": "postgresql", "metric": "control_copy_seconds_p50", "unit": "s", "values": [0.025, 0.025, 0.025], "median": 0.025, "failures": [0, 0, 0], "valid": true},
    {"pps": 20000, "store": "postgresql", "metric": "control_copy_seconds_p95", "unit": "s", "values": [0.0295, 0.0295, 0.0295], "median": 0.0295, "failures": [0, 0, 0], "valid": true},
    {"pps": 50000, "store": "clickhouse", "metric": "insert_duration_seconds_p50", "unit": "s", "values": [0.09353383458646616, 0.09132450331125828, 0.09181208053691275], "median": 0.09181208053691275, "failures": [0, 0, 0], "valid": true},
    {"pps": 50000, "store": "clickhouse", "metric": "insert_duration_seconds_p95", "unit": "s", "values": [0.1404255319148936, 0.13189999999999996, 0.13448275862068965], "median": 0.13448275862068965, "failures": [0, 0, 0], "valid": true},
    {"pps": 50000, "store": "postgresql", "metric": "control_copy_seconds_p50", "unit": "s", "values": [0.065, 0.065, 0.065], "median": 0.065, "failures": [0, 0, 0], "valid": true},
    {"pps": 50000, "store": "postgresql", "metric": "control_copy_seconds_p95", "unit": "s", "values": [0.0785, 0.0785, 0.0785], "median": 0.0785, "failures": [0, 0, 0], "valid": true},
    {"pps": 100000, "store": "clickhouse", "metric": "insert_duration_seconds_p50", "unit": "s", "values": [0.08394557823129252, 0.08491803278688526, 0.08322222222222223], "median": 0.08394557823129252, "failures": [0, 0, 0], "valid": true},
    {"pps": 100000, "store": "clickhouse", "metric": "insert_duration_seconds_p95", "unit": "s", "values": [0.13548387096774195, 0.14216867469879518, 0.125], "median": 0.13548387096774195, "failures": [0, 0, 0], "valid": true},
    {"pps": 100000, "store": "postgresql", "metric": "control_copy_seconds_p50", "unit": "s", "values": [0.065, 0.065, 0.065], "median": 0.065, "failures": [0, 0, 0], "valid": true},
    {"pps": 100000, "store": "postgresql", "metric": "control_copy_seconds_p95", "unit": "s", "values": [0.0785, 0.0785, 0.0785], "median": 0.0785, "failures": [0, 0, 0], "valid": true}
  ]
}
```
