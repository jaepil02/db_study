# 036 — 대조군 역전 지점 격자 2단계(10^6행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T16:47:20.671Z ~ 2026-09-26T16:50:59.321Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 01:18:44 ~ 01:50:59 KST(단계 예산 확인 ~ I2 삭제)

격자 2단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 1,000,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 100초 · 앞 단계 035에 누적)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

이 기록은 단계 하나의 상태를 적는다. **역전 구간은 단계 사이의 비교라 이 기록 단독으로 판정하지 않는다** — 5단계 기록(039)과 종합(05_data_stores/10 결과 절)이 판정한다. 해석에는 이 단계에서 어느 쪽이 빠른지 · 앞 단계 대비 변화 · 읽은 양으로 본 원리를 수치 크기 차로 적는다. **이 기록은 폐기 기록이다 — 정본 인용 불가**(편차 기준 초과 · 조건 교란 · §폐기 · 예외).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(격자 러너 state run.commitHash · init git.dirty true — 작업 트리에 scripts/lab/s5/grid/grid.py 등 미커밋 변경이 있다 · 모드 D fill은 require_clean(apps/api · packages · infra) 통과) |
| 저장소 자원 | 대조 자원 조건(infra/compose/compose.control.yml) — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인(CPU 집합 크기 3 · 3 · 메모리 동일) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** — 원천: api를 내린 채 격자 러너 · datagen-d로 돌았고 datagen-d에는 compose 메모리 상한이 없다(cgroup max) — 상한 값이 존재하지 않으므로 추정값으로 채우지 않는다(04 §조건 칸). 대조 메모리는 조건 칸 controlMemoryMb(3,584 · 3,584)에 따로 적는다 |
| 용량 티어 | **해당 없음** — 근거: 06_experiment_catalog §대조군 실험 — EXP-01~05 공통 조건 "티어 해당 없음(행 수 격자 6단계가 축)". 러너 run.capacityTier는 null이다. 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz)이고 행 수는 기간으로 키운다 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D + GEN-10은 ING를 거치지 않아 SW-09 동시 적재 경로가 아니다(대조군은 GEN-10 COPY가 같은 행을 채운다 · AC-21 동시 적재 확인은 별도 기록) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · ClickHouse) + GEN-10(대조군 COPY · 세션 synchronous_commit off — 서버 기본은 on) · 42 · 혼합(mixed) |
| 데이터 구간 | 끝 2026-09-26T05:00:00.000Z(KST 2026-09-26 14:00:00) 고정 · 이 단계 구간 2026-09-26T04:58:20.000Z ~ 2026-09-26T05:00:00.000Z · 채우기 조각 1(2026-09-26T04:58:20.000Z ~ 2026-09-26T04:59:50.000Z · 900,000행) · 복원 기준 s7a-seed-m(격자 시작 전 1회 · 단계 사이 복원 없음) |
| 쿼리 매개변수 | device 1 · tag 1((device_id, tag_id) 사전순 첫 쌍) · Q5 문턱 v = 58(1단계 적재 직후 quantileExact(0.5)(value) · 1단계 선택도 0.49992 · 이후 단계 고정) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE) · 호스트 CLI 직접(api를 거치지 않는다) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 안정화 | settle 4회 — 마지막 2026-09-26T16:47:15.229Z settled true(CH 활성 파트 2 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 2 → 3) · 앞선 false는 체크포인트 미경과(checkpoint_timeout 15분 · 분산) |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **66.7%** · 기준 20% 초과 6개 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · settle · axes · query · i2-build · i2-drop) · 원시 docs/measurements/raw/036-control-stage-2.jsonl(165행 · 첫 줄 공통 init) · 보조 snapshots/lab-s5-grid/explain/s2 · match/s2-*.json · results/s2 |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥).

```plain
① 예산      01:18:44  디스크 식 · 적재 시간 예산 성립
② 채우기    01:18:45  모드 D 900,000행 0.312초 · GEN-10 900,000행 0.363초
③ 정합      01:18:46  tag_raw 1,000,000 = 대조군 1,000,000 = countMerge(tag_1m) 1,000,000 · 구간 밖 0
④ 안정화    01:47:15  settle 4회째 true
⑤ 비 쿼리 축 01:47:20  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   01:47:20 ~ 01:50:59  CH · I1 → I2 빌드 0.273초 → I2 → I2 삭제 01:50:59
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **12.530**(12.530 · 12.991 · 12.275) | **0.225**(0.225 · 0.227 · 0.215) | PG I2 | 6.3 | 0.11 |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **13.117**(16.576 · 13.117 · 12.273) | **0.295**(0.295 · 0.274 · 0.298) | PG I2 | 4.4 | 0.10 |
| Q3 설비 전체 1일 | **3**(5 · 3 · 3) | **13.281**(13.281 · 13.771 · 13.153) | **3.806**(3.920 · 3.806 · 3.803) | CH | 4.4 | 1.27 |
| Q4 분 단위 롤업 재계산 | **26**(26 · 26 · 24) | **167.136**(167.136 · 165.798 · 168.736) | **166.895**(166.430 · 166.895 · 176.003) | CH | 6.4 | 6.42 |
| Q5 비정렬 열 조건 count | **8**(9 · 8 · 8) | **14.284**(14.051 · 14.284 · 19.327) | **14.319**(14.997 · 14.319 · 14.118) | CH | 1.8 | 1.79 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **10.541**(10.378 · 11.058 · 10.541) | **19.225**(19.596 · 19.126 · 19.225) | CH | 10.5 | 19.23 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 3 · 3) | **23.962**(23.786 · 24.469 · 23.962) | **1.816**(1.931 · 1.816 · 1.750) | PG I2 | 8.0 | 0.61 |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **25.000**(26.641 · 24.548 · 25.000) | **1.875**(1.875 · 1.916 · 1.830) | PG I2 | 8.3 | 0.62 |
| Q3 설비 전체 1일 | **4**(4 · 4 · 3) | **26.343**(26.343 · 26.200 · 26.546) | **6.725**(7.011 · 6.523 · 6.725) | CH | 6.6 | 1.68 |
| Q4 분 단위 롤업 재계산 | **26**(27 · 26 · 25) | **177.578**(177.578 · 178.399 · 176.923) | **178.139**(179.120 · 177.967 · 178.139) | CH | 6.8 | 6.85 |
| Q5 비정렬 열 조건 count | **8**(11 · 8 · 8) | **27.771**(27.771 · 26.583 · 28.440) | **25.936**(25.936 · 25.407 · 30.832) | CH | 3.5 | 3.24 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **23.823**(23.760 · 23.823 · 27.077) | **52.766**(52.766 · 47.162 · 60.342) | CH | 23.8 | 52.77 |

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid/results/s2)을 대조한 값이다. match 행은 원시에 12개이며 같은 쿼리가 두 번 기록된 곳(쿼리 capture 때 자동 · 리드 수동)은 값이 같고 마지막 것을 인용한다.

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 100 · 100 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0388 |
| Q4 | 20,000 · 20,000 | 일치 | 그룹 20,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.0680 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 501,210 = 501,210 |
| Q5x | 1 · 1 | 일치 | count 1,000,000 = 1,000,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 41,000,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(콜드 · 웜 측정 뒤 · 시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 16,384(1.64%) | 304,274(0.74% · 18.6 B) | 9,355(hit 9,355 · read 0 · 100.0%) · Sort · Gather · Append · Seq Scan · 작업자 2 | 103(hit 103 · read 0 · 1.1%) · Merge Append · Index Scan · 작업자 0 | 100 |
| Q2 | 16,384(1.64%) | 295,992(0.72% · 18.1 B) | 9,355(hit 9,355 · read 0 · 100.0%) · Aggregate · Sort · Gather · Append · Seq Scan · 작업자 2 | 114(hit 114 · read 0 · 1.2%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 32,768(3.28%) | 786,432(1.92% · 24.0 B) | 9,366(hit 9,366 · read 0 · 100.1%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 20,084(hit 20,084 · read 0 · 214.8%) · Aggregate · Append · Index Scan · 작업자 0 | 200 |
| Q4 | 1,000,000(100.00%) | 25,000,000(60.98% · 25.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 20,000 |
| Q5 | 1,000,000(100.00%) | 8,000,000(19.51% · 8.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 3,837(hit 3,837 · read 0 · 41.0%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 4,936,001 B(활성 파트 2 · Wide · Compact · 행당 4.94 B) | 77,152,256 B(테이블 76,660,736 · 인덱스 491,520 · 힙 행당 76.6 B) | PG ÷ CH 15.6배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 41,000,000 B ÷ 분모) | 8.31 | 0.535 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM) |
| 3 | 삽입 처리량 | 2,884,615 rows/s(900,000행 · 0.312 초) | 2,479,339 rows/s(900,000행 · 0.363 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 1개 4,397,607 B) | 1.249(WAL 46,085,654 B · FPI 19 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 379) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 3,206 B(기본 키 940 + 마크 2,266) | I1 BRIN 245,760 B · I2 btree 31,637,504 B(빌드 0.273 초 · WAL 7,798,111 B) | I2 ÷ 힙 41.3% · I2 행당 31.6 B |

## 해석

- **이 단계의 앞선 쪽 — Q1 · Q2는 PostgreSQL I2, Q3 · Q4 · Q5는 ClickHouse다.** 웜 중앙값으로 Q3 CH 3 ms · I2 3.806 ms · I1 13.281 ms, Q4 CH 26 ms · I2 166.895 ms · I1 167.136 ms, Q5 CH 8 ms · I1 14.284 ms · I2 14.319 ms, Q1 I2 0.225 ms · CH 2 ms · I1 12.53 ms다. 콜드도 앞선 쪽이 같다(Q3 CH 4 · I2 6.725 ms).
- **035 대비 변화 — Q3의 앞선 쪽이 I2(035 웜 0.668 ms)에서 ClickHouse(3 ms)로 바뀌었다.** 행이 10배가 되는 동안 ClickHouse의 Q3은 2 → 3 ms, I2는 0.668 → 3.806 ms(5.7배)다. I1은 다섯 쿼리 모두 행 수에 거의 비례해 늘었고(Q1 2.905 → 12.53 ms · 4.3배) ClickHouse의 Q1 · Q2는 2 → 2 · 3 ms로 거의 움직이지 않았다. Q4 · Q5의 ClickHouse 우위는 커졌다(Q4 I1 ÷ CH 3.0 → 6.4배).
- **역전 구간 판정은 이 기록이 하지 않는다.** 역전은 단계 사이의 비교라 5단계 기록(039)과 종합(05_data_stores/10 결과 절)에서 판정한다. Q3의 I2 → ClickHouse 전환이 035(10^5)와 이 기록(10^6) 사이에서 보이므로, 이 구간은 로그 중점 정밀화(05_data_stores/10 §역전 지점 탐색 설계)를 추가로 수행한다 — **정밀화 예정(별도 기록)**.
- **Q3에서 I2가 밀린 이유는 btree가 설비 1의 행을 힙 곳곳에서 주워 오기 때문이다.** I2의 Q3는 Index Scan으로 버퍼 블록 20,084개를 건드렸다 — 힙 9,352블록의 2.1배(같은 페이지를 여러 번 건드림)다. 행은 매초 1만 태그가 섞여 들어와 힙 페이지당 약 107행이 담기므로 한 설비의 행은 페이지마다 흩어져 있다. ClickHouse는 정렬 키(device_id, tag_id, ts)의 접두 device_id로 설비 1의 행(200태그 × 100초 = 20,000행)이 모인 그래뉼 4개(32,768행 = 3.3%)만 읽는다 — read_bytes 786,432 B로 논리 크기의 1.9%다.
- **열 단위 읽기와 희소 인덱스 — 읽은 비율이 행 수와 함께 줄어든다.** ClickHouse Q1이 읽은 행은 16,384(그래뉼 2 · 테이블의 1.6%)로 035의 8.2%에서 줄었고, Q5는 여전히 value 한 열만(행당 8.0 B · 논리 크기의 19.5%) 읽는다. PostgreSQL I1은 Q1~Q5가 모두 힙 전부(9,352~9,366블록)이며 Q1 · Q2 · Q3 · Q5에서 병렬 작업자 2를 띄웠다(Gather). I2도 Q4 · Q5는 Seq Scan이다 — btree는 전 행 집계를 돕지 않는다.
- **비 쿼리 축 — 저장 용량 15.6배 · 삽입 처리량 역전.** ClickHouse 4,936,001 B(행당 4.94 B · 압축률 8.31) · PostgreSQL 77,152,256 B(힙 행당 76.6 B · 0.535). 삽입 처리량은 ClickHouse 2,884,615 · PostgreSQL 2,479,339 rows/s로 035와 반대가 됐다. I2 btree는 31,637,504 B로 힙의 41.3%이고 빌드에 WAL 7,798,111 B를 썼다 — I2가 산 Q1 · Q2의 조회 시간은 이 인덱스 크기 · 쓰기 비용을 치른 값이다.
- **한계 — ClickHouse 시간은 1 ms 해상도다.** clickhouse-client --time이 초를 소수 셋째 자리까지 내므로 CH 값은 정수 ms로만 나온다. 같은 쿼리의 query_log 서버 시간(μs)과 비교하면 한 칸 안의 차이이며, 2 ↔ 3 ms 한 칸이 편차 33~50%가 된다(§폐기 · 예외). 서버 시간은 기계 판독 블록에 싣지 않았고 원시 queryLog에 있다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.
- **관측 — ClickHouse 웜 측정의 두 번째 실행이 반복마다 10 ms 남짓 느리다.** 원시의 반복별 웜 3값 중 가운데 값이 Q2 · Q3 · Q4에서 반복마다 크다(예: 1단계 Q2 2 · 12 · 2 ms) — query_log 서버 시간에도 같은 차가 있어 클라이언트가 아니라 서버 쪽이다. 원인은 이 기록이 가르지 않았다. 반복 값이 웜 3회의 중앙값이라 대표값에는 들어가지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 6개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** CH Q3 웜 5 · 3 · 3 ms = 66.7% · CH Q5 콜드 11 · 8 · 8 ms = 37.5% · PG I1 Q5 웜 14.051 · 14.284 · 19.327 ms = 36.9% · PG I1 Q2 웜 16.576 · 13.117 · 12.273 ms = 32.8% · CH Q3 콜드 4 · 4 · 3 ms = 25.0% · PG I2 Q5 콜드 25.936 · 25.407 · 30.832 ms = 20.9%. 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이다.
- **초과의 성격이 둘이다.** ClickHouse 3개는 1 ms 해상도의 한 칸 차(예: 2 ↔ 3 ms)가 대부분이다 — 서버 시간(μs)으로는 같은 지점의 흔들림이 훨씬 작다. PostgreSQL 3개는 해상도가 충분한 값의 실제 흔들림이다. 04에는 해상도 양자화의 예외 조항이 없어(버킷 보간 조항은 히스토그램 분위수 한정) 이 기록은 규칙대로 폐기하고, 조항 신설 여부는 정본 반영 절에 올린다.
- **조건 교란 — 쿼리 축 전부가 겹친다.** 웹 팀원이 2026-09-27 01:45~02:25 KST(2026-09-26T16:45Z~17:25Z)에 호스트에서 next build 3회 · next start + 헤드리스 브라우저 3회 · vitest(02:07:59 KST 시작) · typecheck · biome를 돌렸다(리드 확인). 2단계 쿼리 축(원시 at 16:47:20Z~16:50:59Z · 01:47:20~01:50:59 KST)이 창 안에 들어 있다 — 이 단계 PostgreSQL 편차 초과(I1 Q5 웜 36.9% · I1 Q2 웜 32.8% · I2 Q5 콜드 20.9%)의 후보 원인이다(원시로 인과를 가르지 않았다). 채우기(16:18:45Z)는 창 밖이라 삽입 처리량 축은 겹치지 않고, 안정화 settle 4회째(16:45Z~16:47Z)와 비 쿼리 축(16:47:20Z)은 창 안이다.
- **폐기 후 절차 — 격자 전체를 새 기록으로 다시 잰다.** 러너를 고친 뒤(미래 방향 적재 · ClickHouse μs 계측 등) 1단계부터 새 번호의 기록으로 재측정할 예정이다. 이 기록은 고치지 않고 status discarded로 남긴다(04 §기록 상태와 정정).
- **4요소 중 메모리 상한이 health null이다.** run.memoryLimitMb null을 추정값으로 채우지 않는다(04 §조건 칸) — BFF 판독 규칙 4가 이 기록을 "4요소 누락"으로 센다. 용량 티어는 카탈로그 공통 조건의 "해당 없음"을 문자열로 싣는다.
- **원시의 러너 결함 — PostgreSQL I1 인덱스 크기 행의 kind가 axis가 아니라 BRIN(ts)다.** scripts/lab/s5/grid/grid.py cmd_axes의 축 항목에 kind 키가 있어 emit의 kind axis를 덮어썼다. 값 · axis · store · index는 정상이라 axis 행으로 읽었다.
- 안정화 false 3회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
- 불성립 구조 판정 없음(결과 동일성 6/6 · 구간 count 정합 성립) · 창에서 뺀 구간 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **이 기록의 수치를 정본에 올리지 않는다.** status discarded(편차 기준 초과 · 조건 교란)이고 4요소 중 메모리 상한이 null이다. 쿼리별 역전 지점은 러너 수정 뒤 격자 재측정 기록으로 판정한다 — 이 기록은 재측정의 비교 참고로만 남는다.
- Q3 역전 정밀화 — 035(10^5)와 036(10^6) 사이 로그 중점 두 점(05_data_stores/10 §역전 지점 탐색 설계 정밀화) · **정밀화 예정(별도 기록)**.
- 제안(리드 판정 · 러너 결함은 러너 담당에 전달됨) — ① 04 §반복과 폐기에 계측 해상도 조항(해상도 한 칸 차의 편차 처리 · 또는 ClickHouse 판정 값을 query_log 서버 시간으로) ② 러너 cmd_axes의 kind 덮어쓰기 수정 ③ 격자 러너가 health 상한 · 티어 칸을 채우는 방법(대조 메모리 3,584 MB를 run에 싣는지).
- 미확인으로 남기는 것 — ClickHouse 웜 두 번째 실행의 10 ms 지연 원인 · 콜드 근사의 오차.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 둔다(판독 규칙 7 — 모르는 필드는 무시).

```json
{
  "schema": "measurement/v1",
  "record": "036",
  "exp": [
    "EXP-01",
    "EXP-02",
    "EXP-03",
    "EXP-04",
    "EXP-05"
  ],
  "status": "discarded",
  "supersedes": null,
  "window": {
    "start": "2026-09-26T16:47:20.671Z",
    "end": "2026-09-26T16:50:59.321Z"
  },
  "run": {
    "commitHash": "19f8861",
    "memoryProfile": "load",
    "memoryLimitMb": null,
    "capacityTier": "해당 없음",
    "memoryLimitSource": "cgroup max — datagen-d 서비스에 compose 상한 없음"
  },
  "switches": {
    "SW-01": "on",
    "SW-02": "on",
    "SW-03": "on",
    "SW-04": "on",
    "SW-05": "on",
    "SW-06": "on",
    "SW-07": 100,
    "SW-08": "on",
    "SW-09": "off",
    "SW-10": "off",
    "SW-11": "ingest"
  },
  "conditions": {
    "injectionMode": "D",
    "controlFill": "GEN-10",
    "observability": "off",
    "cpuset": "control-equalized",
    "controlMemoryMb": {
      "clickhouse": 3584,
      "postgres": 3584
    },
    "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384",
    "seed": 42,
    "mix": "mixed",
    "generatorCpuMax": null,
    "compression": "column-codecs",
    "swapUsed": null,
    "wslNetworking": null,
    "simFaultPlan": null,
    "stage": "S5",
    "gridStage": 2,
    "gridRows": 1000000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "dataEnd": "2026-09-26T05:00:00.000Z",
    "dataWindow": {
      "start": "2026-09-26T04:58:20.000Z",
      "end": "2026-09-26T05:00:00.000Z"
    },
    "q5Threshold": 58,
    "q5SelectivityStage1": 0.49992,
    "device": 1,
    "tag": 1,
    "controlCopySyncCommit": "off",
    "pgServerSynchronousCommit": "on",
    "clickhouseVersion": "26.8.10.6",
    "clickhouseMaxThreads": 3,
    "pgMaxParallelWorkersPerGather": 2,
    "pgSharedBuffers": "896MB",
    "pgWorkMem": "16MB",
    "pgJit": "on",
    "indexVariants": [
      "I1",
      "I2"
    ],
    "i2Lifecycle": "I1 queries -> i2-build -> I2 queries -> i2-drop",
    "cacheDefinition": "cold = first run right after restarting both store containers (approx, OS page cache not dropped) · warm = 1 warm-up then 3 runs, rep value = median of 3",
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "settledAt": "2026-09-26T16:47:15.229Z",
    "runnerDirty": true,
    "hostInterference": {
      "window": {
        "start": "2026-09-26T16:45:00Z",
        "end": "2026-09-26T17:25:00Z"
      },
      "what": "web teammate on host: next build x3 · next start + headless x3 · vitest · typecheck · biome",
      "overlapsQueryAxis": true,
      "overlapsFill": false
    }
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.6667,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        2.0,
        2.0,
        2.0
      ],
      "median": 2.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        23.786,
        24.469,
        23.962
      ],
      "median": 23.962,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        12.53,
        12.991,
        12.275
      ],
      "median": 12.53,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1.931,
        1.816,
        1.75
      ],
      "median": 1.816,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.225,
        0.227,
        0.215
      ],
      "median": 0.225,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        26.641,
        24.548,
        25.0
      ],
      "median": 25.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        16.576,
        13.117,
        12.273
      ],
      "median": 13.117,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1.875,
        1.916,
        1.83
      ],
      "median": 1.875,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.295,
        0.274,
        0.298
      ],
      "median": 0.295,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.0,
        4.0,
        3.0
      ],
      "median": 4.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        5.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        26.343,
        26.2,
        26.546
      ],
      "median": 26.343,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        13.281,
        13.771,
        13.153
      ],
      "median": 13.281,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        7.011,
        6.523,
        6.725
      ],
      "median": 6.725,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.92,
        3.806,
        3.803
      ],
      "median": 3.806,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        27.0,
        26.0,
        25.0
      ],
      "median": 26.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        26.0,
        26.0,
        24.0
      ],
      "median": 26.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        177.578,
        178.399,
        176.923
      ],
      "median": 177.578,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        167.136,
        165.798,
        168.736
      ],
      "median": 167.136,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        179.12,
        177.967,
        178.139
      ],
      "median": 178.139,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        166.43,
        166.895,
        176.003
      ],
      "median": 166.895,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        11.0,
        8.0,
        8.0
      ],
      "median": 8.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        9.0,
        8.0,
        8.0
      ],
      "median": 8.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        27.771,
        26.583,
        28.44
      ],
      "median": 27.771,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        14.051,
        14.284,
        19.327
      ],
      "median": 14.284,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        25.936,
        25.407,
        30.832
      ],
      "median": 25.936,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        14.997,
        14.319,
        14.118
      ],
      "median": 14.319,
      "resultMatch": true
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 4936001,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 77152256,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 8.3063,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 0.5348,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 2884615.3846,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 2479338.843,
      "unit": "rows/s"
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 0.0,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 1.2489,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 3206,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 245760,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 1000000,
      "value": 31637504,
      "unit": "bytes"
    }
  ],
  "auxPoints": [
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        1.0,
        1.0,
        1.0
      ],
      "median": 1.0,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        23.76,
        23.823,
        27.077
      ],
      "median": 23.823,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        10.378,
        11.058,
        10.541
      ],
      "median": 10.541,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        52.766,
        47.162,
        60.342
      ],
      "median": 52.766,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000,
      "stage": 2,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        19.596,
        19.126,
        19.225
      ],
      "median": 19.225,
      "resultMatch": true
    }
  ],
  "scan": [
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "readRows": 16384,
      "readBytes": 304274,
      "resultRows": 100
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9355,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 100.0
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 103,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 100.0
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "readRows": 16384,
      "readBytes": 295992,
      "resultRows": 1
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9355,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 114,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 32768,
      "readBytes": 786432,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9366,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 20084,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 200.0
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 1000000,
      "readBytes": 25000000,
      "resultRows": 20000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9352,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 20000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 9352,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 20000.0
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 1000000,
      "readBytes": 8000000,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9352,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 9352,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "clickhouse",
      "index": null,
      "readRows": 1,
      "readBytes": 16,
      "resultRows": 1
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 9352,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 3837,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
