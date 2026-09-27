# 035 — 대조군 역전 지점 격자 1단계(10^5행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T16:14:51.258Z ~ 2026-09-26T16:18:36.693Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 00:57:36 ~ 01:18:36 KST(단계 예산 확인 ~ I2 삭제)

격자 1단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 100,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 10초)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

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
| 데이터 구간 | 끝 2026-09-26T05:00:00.000Z(KST 2026-09-26 14:00:00) 고정 · 이 단계 구간 2026-09-26T04:59:50.000Z ~ 2026-09-26T05:00:00.000Z · 채우기 조각 1(2026-09-26T04:59:50.000Z ~ 2026-09-26T05:00:00.000Z · 100,000행) · 복원 기준 s7a-seed-m(격자 시작 전 1회 · 단계 사이 복원 없음) |
| 쿼리 매개변수 | device 1 · tag 1((device_id, tag_id) 사전순 첫 쌍) · Q5 문턱 v = 58(1단계 적재 직후 quantileExact(0.5)(value) · 1단계 선택도 0.49992 · 이후 단계 고정) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE) · 호스트 CLI 직접(api를 거치지 않는다) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 안정화 | settle 2회 — 마지막 2026-09-26T16:14:47.033Z settled true(CH 활성 파트 1 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 1 → 2) · 앞선 false는 체크포인트 미경과(checkpoint_timeout 15분 · 분산) |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **50.0%** · 기준 20% 초과 2개 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · settle · axes · query · i2-build · i2-drop) · 원시 docs/measurements/raw/035-control-stage-1.jsonl(165행 · 첫 줄 공통 init) · 보조 snapshots/lab-s5-grid/explain/s1 · match/s1-*.json · results/s1 |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥).

```plain
① 예산      00:57:36  디스크 식 · 적재 시간 예산 성립
② 채우기    00:58:01  모드 D 100,000행 0.121초 · GEN-10 100,000행 0.076초
③ 정합      00:58:02  tag_raw 100,000 = 대조군 100,000 = countMerge(tag_1m) 100,000 · 구간 밖 0
④ 안정화    01:14:47  settle 2회째 true
⑤ 비 쿼리 축 01:14:51  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   01:14:51 ~ 01:18:36  CH · I1 → I2 빌드 0.057초 → I2 → I2 삭제 01:18:36
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **2.905**(3.130 · 2.905 · 2.748) | **0.184**(0.184 · 0.190 · 0.179) | PG I2 | 1.5 | 0.09 |
| Q2 단일 태그 7일 | **2**(2 · 2 · 2) | **2.653**(2.653 · 2.553 · 2.750) | **0.287**(0.297 · 0.252 · 0.287) | PG I2 | 1.3 | 0.14 |
| Q3 설비 전체 1일 | **2**(2 · 2 · 2) | **2.975**(2.971 · 2.975 · 3.146) | **0.668**(0.668 · 0.663 · 0.688) | PG I2 | 1.5 | 0.33 |
| Q4 분 단위 롤업 재계산 | **7**(8 · 7 · 7) | **21.283**(21.103 · 21.554 · 21.283) | **20.892**(20.892 · 21.002 · 20.548) | CH | 3.0 | 2.98 |
| Q5 비정렬 열 조건 count | **3**(3 · 3 · 3) | **3.288**(3.288 · 3.246 · 3.295) | **3.146**(3.146 · 2.962 · 3.243) | CH | 1.1 | 1.05 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **2.251**(2.041 · 2.251 · 2.469) | **3.815**(3.696 · 3.815 · 3.946) | CH | 2.3 | 3.81 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **5.080**(5.080 · 5.389 · 4.866) | **1.485**(1.607 · 1.443 · 1.485) | PG I2 | 2.5 | 0.74 |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **4.710**(4.582 · 4.710 · 5.471) | **1.541**(1.541 · 1.515 · 1.752) | PG I2 | 1.6 | 0.51 |
| Q3 설비 전체 1일 | **2**(2 · 2 · 3) | **5.070**(5.070 · 6.495 · 4.989) | **2.163**(2.094 · 2.163 · 2.244) | CH | 2.5 | 1.08 |
| Q4 분 단위 롤업 재계산 | **8**(9 · 8 · 8) | **26.290**(26.382 · 26.290 · 26.101) | **26.427**(26.427 · 27.302 · 25.259) | CH | 3.3 | 3.30 |
| Q5 비정렬 열 조건 count | **3**(3 · 3 · 3) | **5.728**(5.661 · 5.936 · 5.728) | **6.021**(6.021 · 5.499 · 6.516) | CH | 1.9 | 2.01 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **4.718**(4.347 · 4.718 · 4.962) | **9.444**(9.113 · 10.884 · 9.444) | CH | 4.7 | 9.44 |

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid/results/s1)을 대조한 값이다. match 행은 원시에 12개이며 같은 쿼리가 두 번 기록된 곳(쿼리 capture 때 자동 · 리드 수동)은 값이 같고 마지막 것을 인용한다.

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 10 · 10 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q4 | 10,000 · 10,000 | 일치 | 그룹 10,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 49,992 = 49,992 |
| Q5x | 1 · 1 | 일치 | count 100,000 = 100,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 4,100,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(콜드 · 웜 측정 뒤 · 시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 8,192(8.19%) | 204,800(5.00% · 25.0 B) | 979(hit 979 · read 0 · 100.3%) · Sort · Append · Seq Scan · 작업자 0 | 13(hit 13 · read 0 · 1.3%) · Merge Append · Index Scan · 작업자 0 | 10 |
| Q2 | 8,192(8.19%) | 196,608(4.80% · 24.0 B) | 979(hit 979 · read 0 · 100.3%) · Aggregate · Sort · Append · Seq Scan · 작업자 0 | 24(hit 24 · read 0 · 2.5%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 8,192(8.19%) | 196,608(4.80% · 24.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 2,015(hit 2,015 · read 0 · 206.5%) · Aggregate · Append · Index Scan · 작업자 0 | 200 |
| Q4 | 100,000(100.00%) | 2,500,000(60.98% · 25.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 10,000 |
| Q5 | 100,000(100.00%) | 800,000(19.51% · 8.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 389(hit 389 · read 0 · 39.9%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 538,394 B(활성 파트 1 · Compact · 행당 5.38 B) | 8,519,680 B(테이블 8,028,160 · 인덱스 491,520 · 힙 행당 80.0 B) | PG ÷ CH 15.8배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 4,100,000 B ÷ 분모) | 7.62 | 0.511 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM) |
| 3 | 삽입 처리량 | 826,446 rows/s(100,000행 · 0.121 초) | 1,315,789 rows/s(100,000행 · 0.076 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 1개 538,394 B) | 1.251(WAL 5,130,335 B · FPI 9 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 30) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 345 B(기본 키 52 + 마크 293) | I1 BRIN 245,760 B · I2 btree 3,252,224 B(빌드 0.057 초 · WAL 645,336 B) | I2 ÷ 힙 40.7% · I2 행당 32.5 B |

## 해석

- **이 단계의 앞선 쪽 — 단일 태그 조회(Q1 · Q2)와 설비 조회(Q3 웜)는 PostgreSQL I2, 전 행 집계(Q4 · Q5)는 ClickHouse다.** 웜 중앙값으로 Q1 I2 0.184 ms · CH 2 ms · I1 2.905 ms, Q3 I2 0.668 ms · CH 2 ms · I1 2.975 ms, Q4 CH 7 ms · I2 20.892 ms · I1 21.283 ms, Q5 CH 3 ms · I2 3.146 ms · I1 3.288 ms다. **ClickHouse는 다섯 쿼리 모두에서 I1(BRIN만)보다 빠르다** — 가장 가까운 Q5가 1.1배(3 대 3.288 ms)다. 콜드에서는 Q3의 앞선 쪽이 CH(2 ms · I2 2.163 ms)로 바뀐다.
- **10만 행에서 I2가 이기는 이유는 읽는 양의 해상도다.** I2의 Q1은 버퍼 블록 13개(힙 976블록의 1.3%)로 결과 10행을 찾는다. ClickHouse는 같은 쿼리에 그래뉼 하나(8,192행 = 테이블의 8.2%)를 읽는다 — 희소 인덱스의 최소 단위가 테이블에 비해 굵고, 조건 없는 count(Q5x — 파트 메타데이터만 읽는다 · read_rows 1)조차 1 ms가 걸리는 쿼리 고정 비용이 바닥을 정한다. 이 크기에서는 btree 점조회의 정밀함이 열 단위 저장의 이득보다 크다.
- **열 단위 읽기는 이 단계에서도 수치로 보인다 — 시간 차가 작을 뿐이다.** Q5(value > 58)에서 ClickHouse는 100,000행 전부를 읽지만 read_bytes는 800,000 B, 행당 8.0 B로 value 한 열(Float64)만 읽었다 — 공통 논리 크기 41 B의 19.5%다. PostgreSQL은 I1 · I2 모두 Seq Scan으로 힙 976블록 전부(7,995,392 B)를 읽는다 — ClickHouse가 읽은 바이트의 10.0배다. Q4는 ClickHouse가 행당 25.0 B(ts 8 · device_id 4 · tag_id 4 · value 8 · quality 1 — 쿼리에 나오는 다섯 열)를 읽어 논리 크기의 61.0%다.
- **BRIN(I1)은 이 단계에서 가지치기를 하지 않는다.** 데이터가 10초 · 한 KST 일 파티션 하나라 Q1~Q3의 I1 계획이 모두 Seq Scan(블록 979 · 976 — 힙 전부)이다. 설계 문서의 A형(§인덱스 변형 — 1만 태그가 섞이는 행 순서에서 BRIN(ts)은 단일 태그 조회를 ts 범위 전체 스캔으로 만든다)이 첫 단계부터 계획 노드로 확인된다.
- **비 쿼리 축 — 저장 용량은 이미 15.8배 차이다.** ClickHouse 538,394 B(행당 5.38 B · 압축률 7.62) · PostgreSQL 8,519,680 B(힙 행당 80.0 B · 압축률 0.511 — 튜플 헤더로 논리 크기보다 크다). 삽입 처리량은 이 단계만 PostgreSQL이 높다(1,315,789 대 826,446 rows/s) — 10만 행 0.076 · 0.121초의 짧은 적재라 고정 비용의 비교이고, 뒤 단계에서 뒤집힌다(036 · 037).
- **한계 — ClickHouse 시간은 1 ms 해상도다.** clickhouse-client --time이 초를 소수 셋째 자리까지 내므로 CH 값은 정수 ms로만 나온다. 같은 쿼리의 query_log 서버 시간(μs)과 비교하면 한 칸 안의 차이이며, 2 ↔ 3 ms 한 칸이 편차 33~50%가 된다(§폐기 · 예외). 서버 시간은 기계 판독 블록에 싣지 않았고 원시 queryLog에 있다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.
- **관측 — ClickHouse 웜 측정의 두 번째 실행이 반복마다 10 ms 남짓 느리다.** 원시의 반복별 웜 3값 중 가운데 값이 Q2 · Q3 · Q4에서 반복마다 크다(예: 1단계 Q2 2 · 12 · 2 ms) — query_log 서버 시간에도 같은 차가 있어 클라이언트가 아니라 서버 쪽이다. 원인은 이 기록이 가르지 않았다. 반복 값이 웜 3회의 중앙값이라 대표값에는 들어가지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 2개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** CH Q3 콜드 2 · 2 · 3 ms = 50.0% · PG I1 Q3 콜드 5.070 · 6.495 · 4.989 ms = 29.7%. 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이다.
- **초과의 성격이 둘이다.** ClickHouse 1개는 1 ms 해상도의 한 칸 차(예: 2 ↔ 3 ms)가 대부분이다 — 서버 시간(μs)으로는 같은 지점의 흔들림이 훨씬 작다. PostgreSQL 1개는 해상도가 충분한 값의 실제 흔들림이다. 04에는 해상도 양자화의 예외 조항이 없어(버킷 보간 조항은 히스토그램 분위수 한정) 이 기록은 규칙대로 폐기하고, 조항 신설 여부는 정본 반영 절에 올린다.
- **조건 교란 — 이 단계는 창 밖이다.** 웹 팀원이 2026-09-27 01:45~02:25 KST(2026-09-26T16:45Z~17:25Z)에 호스트에서 next build 3회 · next start + 헤드리스 브라우저 3회 · vitest(02:07:59 KST 시작) · typecheck · biome를 돌렸다(리드 확인). 1단계 쿼리 축(16:14:51Z~16:18:36Z · 01:14:51~01:18:36 KST)과 채우기(15:58Z)는 이 창보다 앞선다 — 1단계의 편차 초과(PG I1 Q3 콜드 29.7% · CH Q3 콜드 50.0%)는 이 교란으로 설명되지 않는다.
- **폐기 후 절차 — 격자 전체를 새 기록으로 다시 잰다.** 러너를 고친 뒤(미래 방향 적재 · ClickHouse μs 계측 등) 1단계부터 새 번호의 기록으로 재측정할 예정이다. 이 기록은 고치지 않고 status discarded로 남긴다(04 §기록 상태와 정정).
- **4요소 중 메모리 상한이 health null이다.** run.memoryLimitMb null을 추정값으로 채우지 않는다(04 §조건 칸) — BFF 판독 규칙 4가 이 기록을 "4요소 누락"으로 센다. 용량 티어는 카탈로그 공통 조건의 "해당 없음"을 문자열로 싣는다.
- **원시의 러너 결함 — PostgreSQL I1 인덱스 크기 행의 kind가 axis가 아니라 BRIN(ts)다.** scripts/lab/s5/grid/grid.py cmd_axes의 축 항목에 kind 키가 있어 emit의 kind axis를 덮어썼다. 값 · axis · store · index는 정상이라 axis 행으로 읽었다.
- 안정화 false 1회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
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
  "record": "035",
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
    "start": "2026-09-26T16:14:51.258Z",
    "end": "2026-09-26T16:18:36.693Z"
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
    "gridStage": 1,
    "gridRows": 100000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "dataEnd": "2026-09-26T05:00:00.000Z",
    "dataWindow": {
      "start": "2026-09-26T04:59:50.000Z",
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
    "settledAt": "2026-09-26T16:14:47.033Z",
    "runnerDirty": true,
    "hostInterference": {
      "window": {
        "start": "2026-09-26T16:45:00Z",
        "end": "2026-09-26T17:25:00Z"
      },
      "what": "web teammate on host: next build x3 · next start + headless x3 · vitest · typecheck · biome",
      "overlapsQueryAxis": false,
      "overlapsFill": false
    }
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.5,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 100000,
      "stage": 1,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
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
      "rows": 100000,
      "stage": 1,
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
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        5.08,
        5.389,
        4.866
      ],
      "median": 5.08,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.13,
        2.905,
        2.748
      ],
      "median": 2.905,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1.607,
        1.443,
        1.485
      ],
      "median": 1.485,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.184,
        0.19,
        0.179
      ],
      "median": 0.184,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000,
      "stage": 1,
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
      "rows": 100000,
      "stage": 1,
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
      "query": "Q2",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.582,
        4.71,
        5.471
      ],
      "median": 4.71,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        2.653,
        2.553,
        2.75
      ],
      "median": 2.653,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1.541,
        1.515,
        1.752
      ],
      "median": 1.541,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.297,
        0.252,
        0.287
      ],
      "median": 0.287,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        2.0,
        2.0,
        3.0
      ],
      "median": 2.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
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
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        5.07,
        6.495,
        4.989
      ],
      "median": 5.07,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        2.971,
        2.975,
        3.146
      ],
      "median": 2.975,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        2.094,
        2.163,
        2.244
      ],
      "median": 2.163,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        0.668,
        0.663,
        0.688
      ],
      "median": 0.668,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
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
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
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
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        26.382,
        26.29,
        26.101
      ],
      "median": 26.29,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        21.103,
        21.554,
        21.283
      ],
      "median": 21.283,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        26.427,
        27.302,
        25.259
      ],
      "median": 26.427,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        20.892,
        21.002,
        20.548
      ],
      "median": 20.892,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
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
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
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
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        5.661,
        5.936,
        5.728
      ],
      "median": 5.728,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.288,
        3.246,
        3.295
      ],
      "median": 3.288,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        6.021,
        5.499,
        6.516
      ],
      "median": 6.021,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.146,
        2.962,
        3.243
      ],
      "median": 3.146,
      "resultMatch": true
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 538394,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 8519680,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 7.6152,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 0.5107,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 826446.281,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 1315789.4737,
      "unit": "rows/s"
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 0.0,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 1.2513,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 345,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 245760,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 100000,
      "value": 3252224,
      "unit": "bytes"
    }
  ],
  "auxPoints": [
    {
      "query": "Q5x",
      "rows": 100000,
      "stage": 1,
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
      "rows": 100000,
      "stage": 1,
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
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        4.347,
        4.718,
        4.962
      ],
      "median": 4.718,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        2.041,
        2.251,
        2.469
      ],
      "median": 2.251,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        9.113,
        10.884,
        9.444
      ],
      "median": 9.444,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000,
      "stage": 1,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.696,
        3.815,
        3.946
      ],
      "median": 3.815,
      "resultMatch": true
    }
  ],
  "scan": [
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "readRows": 8192,
      "readBytes": 204800,
      "resultRows": 10
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 979,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 10.0
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 13,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 10.0
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "readRows": 8192,
      "readBytes": 196608,
      "resultRows": 1
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 979,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 24,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 8192,
      "readBytes": 196608,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 200.0
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 2015,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 200.0
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 100000,
      "readBytes": 2500000,
      "resultRows": 10000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 10000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 10000.0
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 100000,
      "readBytes": 800000,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
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
      "sharedHitBlocks": 976,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 389,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
