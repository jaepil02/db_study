# 037 — 대조군 역전 지점 격자 3단계(10^7행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T17:19:37.346Z ~ 2026-09-26T17:24:13.852Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 01:51:00 ~ 02:24:14 KST(단계 예산 확인 ~ I2 삭제)

격자 3단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 10,000,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 1,000초(약 17분) · 앞 단계 036에 누적)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

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
| 데이터 구간 | 끝 2026-09-26T05:00:00.000Z(KST 2026-09-26 14:00:00) 고정 · 이 단계 구간 2026-09-26T04:43:20.000Z ~ 2026-09-26T05:00:00.000Z · 채우기 조각 1(2026-09-26T04:43:20.000Z ~ 2026-09-26T04:58:20.000Z · 9,000,000행) · 복원 기준 s7a-seed-m(격자 시작 전 1회 · 단계 사이 복원 없음) |
| 쿼리 매개변수 | device 1 · tag 1((device_id, tag_id) 사전순 첫 쌍) · Q5 문턱 v = 58(1단계 적재 직후 quantileExact(0.5)(value) · 1단계 선택도 0.49992 · 이후 단계 고정) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE) · 호스트 CLI 직접(api를 거치지 않는다) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 안정화 | settle 3회 — 마지막 2026-09-26T17:19:31.784Z settled true(CH 활성 파트 5 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 3 → 4) · 앞선 false는 체크포인트 미경과(checkpoint_timeout 15분 · 분산) |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **33.3%** · 기준 20% 초과 2개 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · settle · axes · query · i2-build · i2-drop) · 원시 docs/measurements/raw/037-control-stage-3.jsonl(158행 · 첫 줄 공통 init) · 보조 snapshots/lab-s5-grid/explain/s3 · match/s3-*.json · results/s3 |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥).

```plain
① 예산      01:51:00  디스크 식 · 적재 시간 예산 성립
② 채우기    01:51:07  모드 D 9,000,000행 1.64초 · GEN-10 9,000,000행 2.812초
③ 정합      01:51:13  tag_raw 10,000,000 = 대조군 10,000,000 = countMerge(tag_1m) 10,000,000 · 구간 밖 0
④ 안정화    02:19:31  settle 3회째 true
⑤ 비 쿼리 축 02:19:37  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   02:19:37 ~ 02:24:13  CH · I1 → I2 빌드 2.772초 → I2 → I2 삭제 02:24:14
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(4 · 3 · 3) | **136.088**(136.088 · 136.291 · 133.666) | **0.522**(0.513 · 0.522 · 0.527) | PG I2 | 45.4 | 0.17 |
| Q2 단일 태그 7일 | **3**(4 · 3 · 3) | **138.443**(142.010 · 138.443 · 137.997) | **0.480**(0.480 · 0.508 · 0.464) | PG I2 | 46.1 | 0.16 |
| Q3 설비 전체 1일 | **6**(6 · 6 · 7) | **146.145**(146.145 · 151.905 · 145.274) | **24.895**(25.390 · 24.895 · 24.838) | CH | 24.4 | 4.15 |
| Q4 분 단위 롤업 재계산 | **194**(187 · 202 · 194) | **1004.523**(1004.523 · 1006.606 · 995.843) | **1000.355**(1000.172 · 1004.394 · 1000.355) | CH | 5.2 | 5.16 |
| Q5 비정렬 열 조건 count | **64**(66 · 64 · 55) | **159.066**(159.066 · 155.034 · 161.325) | **157.457**(155.958 · 161.787 · 157.457) | CH | 2.5 | 2.46 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **119.571**(119.602 · 114.948 · 119.571) | **178.384**(168.292 · 186.741 · 178.384) | CH | 119.6 | 178.38 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **4**(4 · 4 · 4) | **146.320**(166.689 · 145.851 · 146.320) | **4.579**(4.937 · 4.579 · 4.459) | CH | 36.6 | 1.14 |
| Q2 단일 태그 7일 | **5**(5 · 5 · 4) | **156.761**(159.029 · 156.761 · 156.385) | **4.505**(4.473 · 4.675 · 4.505) | PG I2 | 31.4 | 0.90 |
| Q3 설비 전체 1일 | **7**(8 · 7 · 7) | **158.200**(158.200 · 163.979 · 156.068) | **42.368**(43.954 · 42.368 · 41.765) | CH | 22.6 | 6.05 |
| Q4 분 단위 롤업 재계산 | **200**(220 · 192 · 200) | **1029.716**(1046.739 · 1029.716 · 1017.786) | **1014.128**(1014.128 · 1021.794 · 1011.967) | CH | 5.1 | 5.07 |
| Q5 비정렬 열 조건 count | **59**(59 · 55 · 62) | **169.273**(174.469 · 169.273 · 168.551) | **166.183**(165.397 · 178.728 · 166.183) | CH | 2.9 | 2.82 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **133.248**(137.210 · 133.248 · 131.262) | **451.522**(442.008 · 524.077 · 451.522) | CH | 133.2 | 451.52 |

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid/results/s3)을 대조한 값이다. match 행은 원시에 6개이며 같은 쿼리가 두 번 기록된 곳(쿼리 capture 때 자동 · 리드 수동)은 값이 같고 마지막 것을 인용한다.

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 1,000 · 1,000 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0093 |
| Q4 | 170,000 · 170,000 | 일치 | 그룹 170,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.0961 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 4,945,673 = 4,945,673 |
| Q5x | 1 · 1 | 일치 | count 10,000,000 = 10,000,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 410,000,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(콜드 · 웜 측정 뒤 · 시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 40,960(0.41%) | 610,886(0.15% · 14.9 B) | 93,491(hit 4,326 · read 89,165 · 100.0%) · Sort · Gather · Append · Seq Scan · 작업자 2 | 1,006(hit 1,006 · read 0 · 1.1%) · Merge Append · Index Scan · 작업자 0 | 1,000 |
| Q2 | 40,960(0.41%) | 601,704(0.15% · 14.7 B) | 93,491(hit 4,326 · read 89,165 · 100.0%) · Aggregate · Sort · Gather · Append · Seq Scan · 작업자 2 | 1,017(hit 1,017 · read 0 · 1.1%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 221,184(2.21%) | 5,308,416(1.29% · 24.0 B) | 93,502(hit 4,337 · read 89,165 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 3,686(hit 3,686 · read 0 · 3.9%) · Aggregate · Gather Merge · Sort · Append · Bitmap Heap Scan · Bitmap Index Scan · Index Scan · 작업자 2 | 200 |
| Q4 | 10,000,000(100.00%) | 250,000,000(60.98% · 25.0 B) | 93,518(hit 4,353 · read 89,165 · temp 13,459 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 93,518(hit 4,353 · read 89,165 · temp 13,466 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 170,000 |
| Q5 | 10,000,000(100.00%) | 80,000,000(19.51% · 8.0 B) | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 104,909(hit 104,909 · read 0 · 112.2%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 44,701,068 B(활성 파트 5 · Wide · Compact · 행당 4.47 B) | 766,590,976 B(테이블 766,083,072 · 인덱스 507,904 · 힙 행당 76.6 B) | PG ÷ CH 17.1배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 410,000,000 B ÷ 분모) | 9.17 | 0.535 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM) |
| 3 | 삽입 처리량 | 5,487,805 rows/s(9,000,000행 · 1.64 초) | 3,200,569 rows/s(9,000,000행 · 2.812 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 3개 39,765,067 B) | 1.249(WAL 460,748,528 B · FPI 65 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 728) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 27,489 B(기본 키 9,756 + 마크 17,733) | I1 BRIN 262,144 B · I2 btree 315,514,880 B(빌드 2.772 초 · WAL 101,772,363 B) | I2 ÷ 힙 41.2% · I2 행당 31.6 B |

## 해석

- **이 단계의 앞선 쪽 — Q1 · Q2(웜)는 PostgreSQL I2, Q3 · Q4 · Q5는 ClickHouse다.** 웜 중앙값으로 Q1 I2 0.522 ms · CH 3 ms · I1 136.088 ms, Q3 CH 6 ms · I2 24.895 ms · I1 146.145 ms, Q4 CH 194 ms · I2 1,000.355 ms · I1 1,004.523 ms, Q5 CH 64 ms · I2 157.457 ms · I1 159.066 ms다. **콜드에서는 Q1도 ClickHouse가 앞선다(4 대 I2 4.579 ms)** — I2의 Q1은 웜 0.522 → 콜드 4.579 ms로 8.8배 느려지고 ClickHouse는 3 → 4 ms다. Q2 콜드는 I2 4.505 · CH 5 ms로 I2가 앞선다.
- **036 대비 변화 — I1과 ClickHouse의 격차가 행 수와 함께 벌어진다.** I1 ÷ CH(웜)가 Q1 6.3 → 45.4배 · Q2 4.4 → 46.1배 · Q3 4.4 → 24.4배 · Q4 6.4 → 5.2배 · Q5 1.8 → 2.5배다. I1은 행이 10배가 되자 Q1이 12.53 → 136.088 ms(10.9배)로 행 수에 비례했고, ClickHouse Q1은 2 → 3 ms다. I2의 Q3 격차도 벌어졌다(CH 대비 1.27 → 4.15배). 앞선 쪽이 바뀐 쿼리는 웜 기준으로 없다. **콜드 Q1은 앞선 쪽이 I2(036 콜드 1.816 · CH 3 ms)에서 ClickHouse(4 · I2 4.579 ms)로 바뀌었다** — 1 ms 해상도 한 칸 안의 차이라 정밀화 대상 여부는 리드 판정으로 둔다. 역전 구간 판정은 5단계 기록(039)과 종합(05_data_stores/10 결과 절)에서 한다.
- **PLC 대량 데이터에서 ClickHouse가 덜 읽는 세 기전이 이 단계에서 분명하다.** ① 정렬 키 — 테이블이 (device_id, tag_id, ts) 순서로 저장돼 한 태그의 1,000행이 붙어 있다. Q1은 40,960행(그래뉼 5 · 테이블의 0.41%) · 610,886 B(논리 크기의 0.15%)만 읽는다. ② 희소 인덱스 — 기본 키 9,756 B + 마크 17,733 B = 27,489 B의 인덱스로 1,000만 행 중 읽을 그래뉼을 고른다 — I2 btree 315,514,880 B의 약 1/11,500이다. ③ 열 단위 읽기 — Q5는 1,000만 행 전부를 읽어도 value 열 80,000,000 B(행당 8.0 B · 논리 크기의 19.5%)이고 Q4는 쿼리에 나오는 다섯 열만 250,000,000 B(행당 25.0 B · 61.0%)다. read_bytes는 비압축 크기이며, 디스크의 테이블 전체는 44,701,068 B(행당 4.47 B)다.
- **PostgreSQL I1은 무엇을 묻든 힙 전부를 읽는다.** Q1~Q5의 I1 계획은 모두 Seq Scan이고 버퍼 블록 93,488~93,518개 = 힙 93,488블록(765,853,696 B)의 100%다 — 결과가 1,000행(Q1)이든 1행(Q5)이든 같다. 그래서 I1의 Q1 · Q2 · Q3 · Q5 시간이 136~159 ms로 한데 모인다. Q4는 여기에 정렬 흘림(temp 블록 13,459 · work_mem 16MB)이 더해져 1초를 넘는다.
- **I2가 Q1에서 이기는 대가 — 결과 한 행에 힙 한 페이지다.** I2의 Q1은 1,000행을 버퍼 블록 1,006개로 찾는다. 행이 매초 1만 태그씩 섞여 적재되고 힙 페이지당 약 107행이 담기므로, 한 태그의 연속 표본은 서로 다른 페이지에 떨어진다 — 결과 행 수만큼 페이지를 읽는다. ClickHouse는 같은 1,000행을 정렬 키 덕에 한데 모아 그래뉼 5개로 읽는다. 웜에서 I2가 앞서는 것은 1,006블록이 공유 버퍼에 있을 때이고, 콜드에서 뒤집힌 것(4.579 대 4 ms)이 이 비용이다. I2의 크기(힙의 41.2% · 빌드 2.772초 · WAL 101,772,363 B)도 같은 대가다.
- **비 쿼리 축 — 저장 용량 17.1배 · 삽입 처리량 1.7배.** ClickHouse 44,701,068 B(행당 4.47 B · 압축률 9.17) · PostgreSQL 766,590,976 B(힙 행당 76.6 B — 설계 문서 도출 약 76 B와 같다 · 0.535). 삽입은 ClickHouse 5,487,805 · PostgreSQL 3,200,569 rows/s(900만 행 · COPY synchronous_commit off · btree 없이)다. WAL 증폭은 세 단계 모두 1.25(삽입 논리 바이트의 1.25배)이고 ClickHouse는 안정화까지 머지 0이다(활성 파트 5 · 삽입 파트 3).
- **한계 — ClickHouse 시간은 1 ms 해상도다.** clickhouse-client --time이 초를 소수 셋째 자리까지 내므로 CH 값은 정수 ms로만 나온다. 같은 쿼리의 query_log 서버 시간(μs)과 비교하면 한 칸 안의 차이이며, 2 ↔ 3 ms 한 칸이 편차 33~50%가 된다(§폐기 · 예외). 서버 시간은 기계 판독 블록에 싣지 않았고 원시 queryLog에 있다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.
- **관측 — ClickHouse 웜 측정의 두 번째 실행이 반복마다 10 ms 남짓 느리다.** 원시의 반복별 웜 3값 중 가운데 값이 Q2 · Q3 · Q4에서 반복마다 크다(예: 1단계 Q2 2 · 12 · 2 ms) — query_log 서버 시간에도 같은 차가 있어 클라이언트가 아니라 서버 쪽이다. 원인은 이 기록이 가르지 않았다. 반복 값이 웜 3회의 중앙값이라 대표값에는 들어가지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 2개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** CH Q2 웜 4 · 3 · 3 ms = 33.3% · CH Q1 웜 4 · 3 · 3 ms = 33.3%. 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이다.
- **초과의 성격이 둘이다.** ClickHouse 2개는 1 ms 해상도의 한 칸 차(예: 2 ↔ 3 ms)가 대부분이다 — 서버 시간(μs)으로는 같은 지점의 흔들림이 훨씬 작다. PostgreSQL 0개는 해상도가 충분한 값의 실제 흔들림이다. 04에는 해상도 양자화의 예외 조항이 없어(버킷 보간 조항은 히스토그램 분위수 한정) 이 기록은 규칙대로 폐기하고, 조항 신설 여부는 정본 반영 절에 올린다.
- **조건 교란 — 채우기 · 안정화 · 쿼리 축 전부가 겹친다.** 웹 팀원이 2026-09-27 01:45~02:25 KST(2026-09-26T16:45Z~17:25Z)에 호스트에서 next build 3회 · next start + 헤드리스 브라우저 3회 · vitest(02:07:59 KST 시작) · typecheck · biome를 돌렸다(리드 확인). 3단계 채우기(16:51:00Z~16:51:07Z)와 쿼리 축(원시 at 17:19:37Z~17:24:13Z · 02:19:37~02:24:13 KST)이 창 안이다 — 삽입 처리량 축과 쿼리 시간 전부가 교란 조건의 값이다. 이 단계 편차 초과 2개는 ClickHouse 1 ms 한 칸 차이고 PostgreSQL 편차는 기준 안이지만, 교란 아래의 값이라 인용하지 않는다.
- **폐기 후 절차 — 격자 전체를 새 기록으로 다시 잰다.** 러너를 고친 뒤(미래 방향 적재 · ClickHouse μs 계측 등) 1단계부터 새 번호의 기록으로 재측정할 예정이다. 이 기록은 고치지 않고 status discarded로 남긴다(04 §기록 상태와 정정).
- **4요소 중 메모리 상한이 health null이다.** run.memoryLimitMb null을 추정값으로 채우지 않는다(04 §조건 칸) — BFF 판독 규칙 4가 이 기록을 "4요소 누락"으로 센다. 용량 티어는 카탈로그 공통 조건의 "해당 없음"을 문자열로 싣는다.
- **원시의 러너 결함 — PostgreSQL I1 인덱스 크기 행의 kind가 axis가 아니라 BRIN(ts)다.** scripts/lab/s5/grid/grid.py cmd_axes의 축 항목에 kind 키가 있어 emit의 kind axis를 덮어썼다. 값 · axis · store · index는 정상이라 axis 행으로 읽었다.
- 안정화 false 2회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
- 불성립 구조 판정 없음(결과 동일성 6/6 · 구간 count 정합 성립) · 창에서 뺀 구간 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **이 기록의 수치를 정본에 올리지 않는다.** status discarded(편차 기준 초과 · 조건 교란)이고 4요소 중 메모리 상한이 null이다. 쿼리별 역전 지점은 러너 수정 뒤 격자 재측정 기록으로 판정한다 — 이 기록은 재측정의 비교 참고로만 남는다.
- 제안(리드 판정 · 러너 결함은 러너 담당에 전달됨) — ① 04 §반복과 폐기에 계측 해상도 조항(해상도 한 칸 차의 편차 처리 · 또는 ClickHouse 판정 값을 query_log 서버 시간으로) ② 러너 cmd_axes의 kind 덮어쓰기 수정 ③ 격자 러너가 health 상한 · 티어 칸을 채우는 방법(대조 메모리 3,584 MB를 run에 싣는지).
- 미확인으로 남기는 것 — ClickHouse 웜 두 번째 실행의 10 ms 지연 원인 · 콜드 근사의 오차.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 둔다(판독 규칙 7 — 모르는 필드는 무시).

```json
{
  "schema": "measurement/v1",
  "record": "037",
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
    "start": "2026-09-26T17:19:37.346Z",
    "end": "2026-09-26T17:24:13.852Z"
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
    "gridStage": 3,
    "gridRows": 10000000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "dataEnd": "2026-09-26T05:00:00.000Z",
    "dataWindow": {
      "start": "2026-09-26T04:43:20.000Z",
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
    "settledAt": "2026-09-26T17:19:31.784Z",
    "runnerDirty": true,
    "hostInterference": {
      "window": {
        "start": "2026-09-26T16:45:00Z",
        "end": "2026-09-26T17:25:00Z"
      },
      "what": "web teammate on host: next build x3 · next start + headless x3 · vitest · typecheck · biome",
      "overlapsQueryAxis": true,
      "overlapsFill": true
    }
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.3333,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.0,
        4.0,
        4.0
      ],
      "median": 4.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        4.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        166.689,
        145.851,
        146.32
      ],
      "median": 146.32,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        136.088,
        136.291,
        133.666
      ],
      "median": 136.088,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.937,
        4.579,
        4.459
      ],
      "median": 4.579,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.513,
        0.522,
        0.527
      ],
      "median": 0.522,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        5.0,
        5.0,
        4.0
      ],
      "median": 5.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        4.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        159.029,
        156.761,
        156.385
      ],
      "median": 156.761,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        142.01,
        138.443,
        137.997
      ],
      "median": 138.443,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.473,
        4.675,
        4.505
      ],
      "median": 4.505,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.48,
        0.508,
        0.464
      ],
      "median": 0.48,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        8.0,
        7.0,
        7.0
      ],
      "median": 7.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        6.0,
        6.0,
        7.0
      ],
      "median": 6.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        158.2,
        163.979,
        156.068
      ],
      "median": 158.2,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        146.145,
        151.905,
        145.274
      ],
      "median": 146.145,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        43.954,
        42.368,
        41.765
      ],
      "median": 42.368,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        25.39,
        24.895,
        24.838
      ],
      "median": 24.895,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        220.0,
        192.0,
        200.0
      ],
      "median": 200.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        187.0,
        202.0,
        194.0
      ],
      "median": 194.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1046.739,
        1029.716,
        1017.786
      ],
      "median": 1029.716,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1004.523,
        1006.606,
        995.843
      ],
      "median": 1004.523,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1014.128,
        1021.794,
        1011.967
      ],
      "median": 1014.128,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1000.172,
        1004.394,
        1000.355
      ],
      "median": 1000.355,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        59.0,
        55.0,
        62.0
      ],
      "median": 59.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        66.0,
        64.0,
        55.0
      ],
      "median": 64.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        174.469,
        169.273,
        168.551
      ],
      "median": 169.273,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        159.066,
        155.034,
        161.325
      ],
      "median": 159.066,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        165.397,
        178.728,
        166.183
      ],
      "median": 166.183,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        155.958,
        161.787,
        157.457
      ],
      "median": 157.457,
      "resultMatch": true
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 44701068,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 766590976,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 9.172,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 0.5352,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 5487804.878,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 3200568.99,
      "unit": "rows/s"
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 0.0,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 1.2486,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 27489,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 262144,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 10000000,
      "value": 315514880,
      "unit": "bytes"
    }
  ],
  "auxPoints": [
    {
      "query": "Q5x",
      "rows": 10000000,
      "stage": 3,
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
      "rows": 10000000,
      "stage": 3,
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
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        137.21,
        133.248,
        131.262
      ],
      "median": 133.248,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        119.602,
        114.948,
        119.571
      ],
      "median": 119.571,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        442.008,
        524.077,
        451.522
      ],
      "median": 451.522,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 10000000,
      "stage": 3,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        168.292,
        186.741,
        178.384
      ],
      "median": 178.384,
      "resultMatch": true
    }
  ],
  "scan": [
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "readRows": 40960,
      "readBytes": 610886,
      "resultRows": 1000
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4326,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1000.0
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 1006,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1000.0
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "readRows": 40960,
      "readBytes": 601704,
      "resultRows": 1
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4326,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 1017,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 221184,
      "readBytes": 5308416,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4337,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 3686,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 10000000,
      "readBytes": 250000000,
      "resultRows": 170000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4353,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 13459,
      "workersLaunched": 2,
      "actualRows": 170000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4353,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 13466,
      "workersLaunched": 2,
      "actualRows": 170000.0
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 10000000,
      "readBytes": 80000000,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 89165,
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
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 104909,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
