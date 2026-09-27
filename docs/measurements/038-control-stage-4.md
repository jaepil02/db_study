# 038 — 대조군 역전 지점 격자 4단계: 10^8행 · Q1~Q5 × ClickHouse · PostgreSQL I1 · I2 × 콜드 · 웜 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T17:30:17.975Z ~ 2026-09-26T17:43:40.422Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 데이터 구간 ts 2026-09-26T02:13:20Z ~ 05:00:00Z(1~3단계 10^7행 위에 4단계 90,000,000행) · 실행 2026-09-27 02:24~02:43 KST(원시 첫 행 2026-09-26T17:24:24Z ~ I2 DROP 17:43:40Z)

격자 4단계다. 3단계까지 쌓인 10^7행(데이터 끝 2026-09-26T05:00:00Z에서 1,000초) 앞에 9,000초(3조각 × 3,000초 · 설비 50 × 태그 200 · 1 Hz)를 모드 D(ClickHouse tag_raw)와 GEN-10(PostgreSQL plc_tag_raw_control)으로 같은 행 벡터로 채워 두 저장소를 각각 **100,000,000행**으로 맞춘 뒤, 비 쿼리 축 5를 재고 동일 쿼리 5종(+ 조건 없는 count Q5x 보조 관찰)을 ClickHouse · PostgreSQL I1(BRIN(ts)) · I2(I1 + btree(device_id, tag_id, ts))의 세 팔로 콜드 · 웜 각각 반복 3회 돌렸다. 설계 정본은 05_data_stores/10_olap_vs_rdb_control.md §동일 쿼리 5종 · §비교 축 6 · §역전 지점 탐색 설계다.

이 기록은 한 단계의 점과 축만 싣는다. 역전 구간(두 단계 사이 어디서 앞선 쪽이 바뀌는가)은 격자 전체를 봐야 판정되므로 5단계 기록 039가 1~5단계 요약표로 싣는다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(모드 D 실행기 보고 run.commitHash · 격자 init git dirty true — 작업 트리에 apps/web · scripts/lab 미커밋 변경이 있었다 · 저장소 이미지 · DDL 경로 변경 여부는 원시에 없다) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** — api를 내리고 datagen-d 컨테이너에서 모드 D가 돈다(기록 034와 같은 사유) — datagen-d 컨테이너에 compose 메모리 상한이 없어(cgroup max) health 상한 칸이 비는 것이다 |
| 용량 티어 | **해당 없음** — EXP-01~05 공통 조건(06_experiment_catalog §대조군 실험 — 행 수 격자가 축). 러너 run.capacityTier는 null이다. 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz · 실행 인자 --tier M)이고 행 수는 기간으로 키운다 |
| 저장소 자원(대조 자원 조건) | ClickHouse cpuset 5-7 · 3,584 MiB(3,758,096,384 B) · max_threads 3 · 26.8.10.6 / PostgreSQL cpuset 8-10 · 3,584 MiB · shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · effective_cache_size 2688MB — 두 컨테이너 3 vCPU · 3.5 GiB 동일(05/10 §측정 조건 자원 행) |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D 구간은 ING를 거치지 않으므로 SW-09가 적용되지 않는다(05/10 §SW-09 동시 적재) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · --control on · --rollup on · --mix mixed) + GEN-10(같은 행 벡터를 대조군에 COPY) · 42 · 혼합 |
| 내구성 | GEN-10 COPY 세션 synchronous_commit off(서버 기본 on — init env) |
| 채우기 | 3조각 × 3,000초(chunkSec 3000) · 조각마다 두 저장소 행 수 · 일별 3자 대조(CH · 대조군 · 롤업) 일치 · 종료 코드 0 |
| 정합(단계 ②) | 구간 6개(1~3단계 3 + 4단계 3) 전부 CH = PG · 합 100,000,000 = 공칭 · 구간 밖 0 · 0 · tag_1m countMerge 100,000,000 |
| 안정화(단계 ③) | 213.9초 · ClickHouse 활성 파트 8 · 머지 0(3표본 연속) · PostgreSQL vacuum 진행 0 · 삽입 기준 vacuum 대기 파티션 0 · 체크포인트 13 → 15(채우기 뒤 경과) |
| 쿼리 매개 | device 1 · tag 1(사전순 첫 쌍) · end 2026-09-26T05:00:00Z · Q5 문턱 v = 58(1단계 직후 quantileExact(0.5) · 1단계 선택도 0.49992 — 4단계 Q5 결과 48,469,167행 = 48.47%) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 Docker VM 안이라 비우지 않는다) · 웜 = 예열 1회 뒤 3회의 중앙값 |
| 쿼리 순서 | ClickHouse → PostgreSQL I1 → I2 빌드(동기 · 35.8초) → PostgreSQL I2 → I2 DROP · 팔마다 반복 1~3 × Q1~Q5x |
| 시간 원천 | ClickHouse clickhouse-client --time(클라이언트 경과 · **1 ms 해상도**) · PostgreSQL psql \timing(클라이언트 경과 · µs) · 참고로 ClickHouse query_log 서버 µs · PostgreSQL EXPLAIN(ANALYZE, BUFFERS)(반복 1 · 시간 판정에 쓰지 않는다) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(부하 실험 프로파일 기동 — 리드 실행 조건) · 재지 않음(모드 D는 생성 · 적재가 한 호출) · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱(tag_raw DDL) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 스냅샷 | 격자 시작 전 복원 s7a-seed-m(티어 M 시드 · tag_raw 0행) · 단계 사이 복원 없음(누적 격자 — 04 §실험 한 번의 절차 예외) |
| 반복 · 편차 | 쿼리 축 3회(반복마다 콜드 1 + 웜 3) · 적재 1회 · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **62.7%** · 기준 20% 초과 9개 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.py(fill · check · settle · axes · query · match · i2-build · i2-drop) · 원시 docs/measurements/raw/038-control-stage-4.jsonl(158행 — 첫 줄 격자 공통 init) · EXPLAIN 원문 snapshots/lab-s5-grid/explain/s4 |

- 검산: 조건 항목 = **19**
- **점 하나의 값은 반복 번호 순 3개다.** 콜드는 그 반복의 1회 값이고 웜은 그 반복 안 3회의 중앙값이다. 대표값은 세 값의 중앙값 · 편차는 (최대 − 최소) ÷ 중앙값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리. ClickHouse 값은 1 ms 해상도라 정수다.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 3 · 3) | **637.078**(631.296 · 637.078 · 638.084) | **1.696**(1.696 · 1.555 · 1.960) | PG I2 | 212.4 | 0.57 |
| Q2 단일 태그 7일 | **4**(4 · 5 · 4) | **1,103.615**(1,086.456 · 1,103.615 · 1,117.326) | **3.106**(3.105 · 3.433 · 3.106) | PG I2 | 275.9 | 0.78 |
| Q3 설비 전체 1일 | **35**(39 · 35 · 27) | **1,183.486**(1,191.888 · 1,161.879 · 1,183.486) | **195.079**(195.079 · 195.553 · 194.403) | CH | 33.8 | 5.57 |
| Q4 분 단위 롤업 재계산 | **828**(779 · 828 · 845) | **10,897.709**(10,897.709 · 10,829.769 · 11,725.812) | **10,550.613**(10,233.510 · 11,389.832 · 10,550.613) | CH | 13.2 | 12.74 |
| Q5 비정렬 열 조건 count | **463**(385 · 463 · 467) | **1,387.680**(1,343.670 · 1,393.550 · 1,387.680) | **1,356.370**(1,379.879 · 1,356.370 · 1,353.309) | CH | 3.0 | 2.93 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **1,158.844**(1,128.215 · 1,174.312 · 1,158.844) | **1,182.289**(1,191.653 · 1,182.289 · 1,139.917) | CH | 1,158.8 | 1,182.29 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **6**(6 · 6 · 6) | **745.929**(942.488 · 745.929 · 716.598) | **16.969**(26.564 · 15.933 · 16.969) | CH | 124.3 | 2.83 |
| Q2 단일 태그 7일 | **6**(6 · 6 · 5) | **1,154.373**(1,485.190 · 1,154.373 · 1,142.414) | **39.176**(44.462 · 38.533 · 39.176) | CH | 192.4 | 6.53 |
| Q3 설비 전체 1일 | **34**(40 · 33 · 34) | **1,180.871**(1,180.871 · 1,164.717 · 1,211.649) | **301.336**(301.336 · 305.730 · 297.357) | CH | 34.7 | 8.86 |
| Q4 분 단위 롤업 재계산 | **871**(871 · 843 · 950) | **11,254.192**(9,588.487 · 11,254.192 · 12,371.979) | **8,776.742**(8,776.742 · 10,439.837 · 8,518.786) | CH | 12.9 | 10.08 |
| Q5 비정렬 열 조건 count | **433**(415 · 490 · 433) | **1,393.249**(1,539.883 · 1,387.457 · 1,393.249) | **1,364.137**(1,436.028 · 1,364.137 · 1,346.059) | CH | 3.2 | 3.15 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **1,197.888**(1,173.046 · 1,238.180 · 1,197.888) | **1,190.340**(1,190.340 · 1,149.454 · 1,192.433) | CH | 1,197.9 | 1,190.34 |

### 결과 동일성

- 결과 대조(match) 6/6 true — Q1 3,600행 값 정확 · Q2 3버킷 · Q3 200태그 · Q4 600,000그룹(avg 차 ÷ 상계 최대 0.109 · bad_cnt 정확 · tag_1m 롤업 대조 일치) · Q5 48,469,167 = 48,469,167 · Q5x 100,000,000 = 100,000,000.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 공통 논리 크기는 행 수 × 41 B = 4,100,000,000 B다. PostgreSQL은 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B · 힙 main 934,604블록(7,656,275,968 B)이다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 40,960(0.04%) | 560,173(0.01% · 13.7 B) | 337,204(hit 72 · read 337,132 · 36.1%) · Gather Merge · Sort · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 2 | 3,618(hit 3,618 · read 0 · 0.4%) · Merge Append · Index Scan(p20260926) · 작업자 0 | 3,600 |
| Q2 | 57,344(0.06%) | 808,128(0.02% · 14.1 B) | 934,680(hit 4,399 · read 930,281 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 10,053(hit 10,053 · read 0 · 1.1%) · Sort · Aggregate · Append · Index Scan(p20260923) · Index Scan(p20260924) · Index Scan(p20260925) · Index Scan(p20260926) · Index Scan(default) · 작업자 0 | 3 |
| Q3 | 2,031,616(2.03%) | 48,700,800(1.19% · 24.0 B) | 934,618(hit 4,337 · read 930,281 · 100.0%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Seq Scan · 작업자 2 | 36,378(hit 36,378 · read 0 · 3.9%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · Index Scan(p20260925) · 작업자 2 | 200 |
| Q4 | 53,222,784(53.22%) | 1,330,569,600(32.45% · 25.0 B) | 337,148(hit 16 · read 337,132 · temp 153,451 · 36.1%) · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 0 | 337,148(hit 16 · read 337,132 · temp 153,451 · 36.1%) · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 0 | 600,000 |
| Q5 | 100,000,000(100.00%) | 800,000,000(19.51% · 8.0 B) | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 1 |

- 검산: 쿼리 = **6**

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(I2 줄은 i2-build 계측). 비교 축 6의 쿼리 시간은 위 표다.

| 축 | ClickHouse | PostgreSQL I1 | PostgreSQL I2 | 비고 |
|------|------:|------:|------:|------|
| 저장 용량(bytes) | 439,903,045(활성 파트 8 · Wide) | 7,659,085,824(힙 7,658,348,544 · 인덱스 737,280) | — | 행당 4.40 B 대 76.59 B(PG ÷ CH **17.4배**) · 도출 76 B와 일치 |
| 압축률(공통 논리 41 B × 행 ÷ 분모) | 9.320 | 0.5354 | — | PostgreSQL 분모 pg_table_size(인덱스 제외) — 튜플 헤더 · 줄 포인터로 논리 크기보다 크다 |
| 삽입 처리량(rows/s · 4단계 증가 90,000,000행) | 5,773,302(15.589초) | 2,911,208(COPY 30.915초) | — | 단독 적재(모드 D · GEN-10) · CH ÷ PG 1.98배 |
| 쓰기 증폭 | 0.964(머지 쓰기 381,503,898 ÷ 새 파트 395,597,037 · 새 파트 24 · 머지 4) | 1.797(WAL 6,630,336,758 ÷ 90,000,000 × 41 B · LSN 차 6,655,286,936 · FPI 1,375,447 · autovacuum 1 · autoanalyze 1) | — | 창 = 채우기 시작 ~ 안정화 뒤 축 채취 |
| 인덱스 크기(bytes) | 253,771(기본 키 97,744 + 마크 156,027) | 491,520(BRIN(ts)) | 3,154,337,792(btree · 행당 31.5 B) | I2 빌드 35.8초 · 빌드 WAL 1,022,199,439 B · 동기 · maintenance_work_mem 256MB · 병렬 유지 작업자 2 |

- 검산: 축 = **5** + 쿼리 시간 1 = 비교 축 **6** · axes 행 = 5축 × 2저장소 + I2 인덱스 1 = **11**

## 해석

- **이 단계에서 앞선 쪽 — 웜은 Q1 · Q2만 PostgreSQL I2, 콜드는 전 쿼리 ClickHouse다.** I1(BRIN)은 모든 쿼리 · 두 캐시에서 ClickHouse보다 3.0~276배 느리다. I2(btree)는 웜 Q1 1.696 ms 대 3 ms · Q2 3.106 ms 대 4 ms로 앞서지만 차는 1 ms 안팎이고, 콜드에서는 16.969 ms 대 6 ms · 39.176 ms 대 6 ms로 뒤진다. ClickHouse 쪽 시간은 1 ms 해상도라 웜 Q1 · Q2 판정은 해상도 가까이에서 내려진 것이다 — 서버 µs(query_log)로 봐도 Q1 3,526 µs · Q2 4,092 µs라 PostgreSQL I2가 앞선다는 판정은 바뀌지 않는다.
- **Q1 · Q2에서 두 엔진은 같은 일을 다른 물리로 한다 — 정렬 키 대 힙 + B-tree.** ClickHouse는 ORDER BY (device_id, tag_id, ts)로 정렬 저장해 한 태그의 행이 파트 안에 연속으로 놓이고, 희소 기본 인덱스가 그 태그 · 시간 범위의 그래뉼 5~7개(8,192행 단위)만 가리킨다 — 결과 3,600행을 위해 40,960행을 읽는다. PostgreSQL I2는 btree로 태그 행의 위치를 정확히 찾지만 힙은 삽입 순서라 한 태그의 행이 페이지마다 흩어져 있다 — **Q1 3,600행에 힙 3,618블록 · Q2 10,000행에 10,053블록, 행 하나당 페이지 하나를 방문한다**(plain Index Scan은 연속한 TID가 같은 페이지면 버퍼를 다시 세지 않으므로, 블록 수 ≈ 행 수는 이웃 행이 서로 다른 페이지에 있다는 뜻이다). 이 크기에서는 그 페이지가 전부 shared_buffers 적중(읽기 0)이라 행당 방문이 싸서 PostgreSQL이 이긴다. 행당 방문 비용은 태그 행 수에 비례해 늘고 ClickHouse의 그래뉼 읽기는 거의 늘지 않는다 — 5단계에서 Q2가 뒤집히는 이유다(기록 039).
- **콜드에서 I2가 지는 것은 재기동이 shared_buffers를 비우기 때문이다.** 같은 3,618 · 10,053블록을 버퍼 밖에서 다시 가져오므로 Q1 17 ms · Q2 39 ms가 된다. 힙 7.66 GB가 VM 페이지 캐시에 남아 있었을 수 있어(콜드 근사 · 07_measurement_limits 콜드 행) 디스크 랜덤 읽기의 실제 비용은 이보다 클 수 있다 — 5단계(힙 76.6 GB) 콜드 Q2 I2 10.8초가 그 방향을 보인다.
- **BRIN은 ts만 가지치기한다(A형의 실측).** I1 Q1은 BRIN이 1시간 범위를 골라 힙의 36.1%(337,204블록 · 모든 태그의 1시간 36,000,000행)를 읽고 행마다 device_id · tag_id를 걸러 3,600행을 남긴다 — 1만 대 1의 필터다. 같은 조건에서 ClickHouse는 정렬 키 접두로 40,960행만 읽는다. Q2(7일 창이 데이터 전부)는 Seq Scan으로 힙 전체를 읽는다. I1이 지는 이유는 엔진이 아니라 인덱스 선택이라는 05/10 §인덱스 변형의 주장이 여기서 수치로 선다(I1 ÷ CH 212 · 276배 대 I2 0.6 · 0.8배).
- **Q3(설비 1 · 1일)은 정렬 키 접두 device_id 가지치기가 가른다 — EXP-03 가설 성립.** ClickHouse는 설비 1의 행 2,031,616행(설비 1 전체 2,000,000행 + 그래뉼 경계)만 48.7 MB 읽어 35 ms다. PostgreSQL I1은 힙 전체를 행 필터로 읽어 1,183 ms · I2는 btree 접두(device_id)로 2,000,000행을 36,378블록에서 찾아 195 ms다 — 설비 한 대의 행이 한 초 안에서는 몇 페이지에 모여 있어(블록당 약 55행) 태그 하나(블록당 1행)보다 힙 지역성이 좋지만, 그래도 행 수에 비례한 튜플 처리가 남아 5.6배 뒤진다.
- **Q4 · Q5는 열 단위 읽기가 가른다 — EXP-04 · 05 가설 성립.** Q5는 value 한 열을 끝까지 읽는다 — ClickHouse는 value 열 800 MB(8 B × 10^8 · 비압축 기준)만 읽고 PostgreSQL은 힙 7.66 GB(행당 76 B 전부)를 읽는다. 읽는 바이트가 9.6배인데 시간 차는 3.0배다 — ClickHouse max_threads 3 대 PostgreSQL 작업자 2 + 리더의 CPU 경합과 압축 해제 비용이 차를 줄인다. Q4는 ClickHouse가 필요한 5열(ts · device_id · tag_id · value · quality)만 53.2M행 1.33 GB 읽어 828 ms이고, PostgreSQL은 BRIN 비트맵으로 1시간 337,148블록을 읽은 뒤 600,000그룹 정렬이 work_mem 16MB를 넘어 임시 153,451블록(1.26 GB)을 쓰고 계획이 **병렬 0**이라 10.9초다. device · tag 조건이 없는 Q4 · Q5에서 btree는 쓰이지 않아 I2 계획이 I1과 같고 값 차는 반복 흔들림이다.
- **Q5x는 저장소 비교가 아니다.** ClickHouse는 조건 없는 count()를 파트 메타데이터에서 답해 1행 16 B를 읽는다(1 ms) — 05/10 §동일 쿼리 5종 A형이 Q5를 비정렬 열 조건으로 둔 이유가 실측으로 확인된다. PostgreSQL은 힙 전체를 읽는다(Q5와 같은 934,604블록).
- **비 쿼리 축 — 쿼리에서 PostgreSQL I2가 이긴 칸의 대가.** 저장 용량은 76.59 B 대 4.40 B로 17.4배이며 PostgreSQL 행당 값이 대조군 용량 축의 구조 계산(약 76 B)과 맞는다. I2를 얹으면 btree 3.15 GB(행당 31.5 B · 도출 약 30 B)가 더해져 PostgreSQL이 ClickHouse의 24.6배(10.81 GB)가 되고, 빌드에 WAL 1.02 GB가 따른다. 삽입은 ClickHouse 5.77M rows/s · PostgreSQL 2.91M rows/s(1.98배)로, 원본 예상치(PostgreSQL 단독 1만~5만 rows/s)는 COPY · synchronous_commit off · BRIN만인 조건에서 맞지 않는다 — 이 값은 I1(BRIN만)의 적재이며 btree를 단 채 적재한 값이 아니다. 쓰기 증폭은 ClickHouse 머지 0.96 · PostgreSQL WAL 1.80이다(FPI 1,375,447 — 체크포인트 뒤 첫 수정 페이지의 전 페이지 기록).
- **한계** — ① 콜드는 근사다(07_measurement_limits) ② ClickHouse 시간은 1 ms 해상도라 10 ms 미만 칸의 편차 · 비는 양자화를 포함한다 ③ 반복은 쿼리 축만이고 적재는 1회라 삽입 처리량 · 쓰기 증폭에는 분포가 없다 ④ 단계 누적 격자라 4단계 테이블은 1~3단계 행 위에 있다(이 단계에서는 4단계 조각이 모두 더 이른 ts로 붙었지만 p20260926 한 파티션 안이고, BRIN 계획은 Q1 · Q4에서 여전히 비트맵이었다 — 5단계의 계획 전환은 기록 039).

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 9개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** PG I2 Q1 콜드 26.564 · 15.933 · 16.969 ms = 62.7% · CH Q3 웜 39 · 35 · 27 ms = 34.3% · PG I1 Q1 콜드 942.488 · 745.929 · 716.598 = 30.3% · PG I1 Q2 콜드 1,485.190 · 1,154.373 · 1,142.414 = 29.7% · CH Q2 웜 4 · 5 · 4 = 25.0% · PG I1 Q4 콜드 9,588.487 · 11,254.192 · 12,371.979 = 24.7% · PG I2 Q1 웜 1.696 · 1.555 · 1.960 = 23.9% · PG I2 Q4 콜드 8,776.742 · 10,439.837 · 8,518.786 = 21.9% · CH Q3 콜드 40 · 33 · 34 = 20.6%. 편차는 (최대 − 최소) ÷ 중앙값이다.
- **초과의 성격 — 대부분 콜드이고, 해상도만으로 설명되지 않는다.** 9개 중 7개가 콜드이며 그중 4개는 반복 1이 가장 크다(PG I1 Q1 · Q2 · PG I2 Q1 · CH Q3 — 팔의 첫 재기동 직후). ClickHouse 1 ms 해상도가 만드는 초과는 CH Q2 웜(4 ↔ 5 ms) 하나이고, CH Q3 웜(27~39 ms)은 해상도보다 큰 실제 흔들림이다. 04에는 해상도 양자화 · 콜드 첫 반복의 예외 조항이 없어(버킷 보간 조항은 히스토그램 분위수 한정) 규칙대로 폐기한다.
- **폐기가 이 단계의 앞선 쪽 판정을 흔들지는 않는다(참고).** 판정 지표 20쌍(Q1~Q5 × I1 · I2 × 콜드 · 웜 — ClickHouse 대 PostgreSQL)의 앞선 쪽이 세 반복 모두에서 같다. 폐기 기록의 수치는 정본에 인용하지 않으며, 해석은 원리 서술의 근거로만 쓴다.
- **웹 팀원의 호스트 빌드 · 테스트(2026-09-27 01:45~02:25 KST)는 쿼리 축과 무관하다.** 이 단계의 쿼리 창은 02:30:17 KST(원시 첫 쿼리 17:30:17Z) 이후다. 다만 **채우기 조각 0(02:24:24~02:24:54 KST)은 그 창의 끝과 겹친다** — 조각 0의 적재 시간(CH 4.965초 · COPY 9.625초)은 겹치지 않은 조각 1 · 2(5.215 · 5.409초 · 11.966 · 9.324초)와 같은 폭이라 영향이 드러나지 않지만, 삽입 처리량 축은 호스트 부하가 섞였을 수 있는 조각을 포함한 값이다.
- **폐기 후 절차 — 러너를 고쳐 격자 전체(1~5단계)를 새 기록으로 재측정한다(예정).** 고칠 것은 ① 미래 방향 적재(05/10 §역전 지점 탐색 설계 "실제로 쌓이는 순서 그대로" 문장대로 — 적재 순서 부산물 제거) ② ClickHouse 서버 µs 계측(1 ms 해상도 해소) ③ 로그 중점 정밀화 단계다. 폐기 기록은 지우지 않고 남긴다(04 §반복과 폐기 · 폐기 후).
- 불성립 구조 판정 없음 — 단계 ② 구간 count 정합 · 결과 대조 6/6 · 롤업 대조 전부 일치.
- **4요소 중 둘이 health null이다.** 모드 D 실행기 보고 run.memoryLimitMb · run.capacityTier가 null이다(datagen-d 컨테이너에 상한 칸 · CAPACITY_TIER가 없다 — 기록 034와 같은 사유). run.memoryLimitMb null을 추정값으로 채우지 않는다(04 §조건 칸) — BFF 판독 규칙 4가 "4요소 누락"으로 센다(상태 discarded라 규칙 3에서 먼저 빠진다). 대조 메모리는 conditions.controlMemoryMb(3,584 · 3,584)에 따로 적었다. 용량 티어는 카탈로그 공통 조건의 "해당 없음"을 문자열로 싣는다(기록 035~037과 같은 처리).
- **러너 원시의 kind 칸 덮어쓰기.** PostgreSQL I1 인덱스 크기 축 행이 kind axis가 아니라 kind BRIN(ts)으로 남았다 — scripts/lab/s5/grid/grid.py cmd_axes가 축 사전의 kind 키(BRIN(ts))를 emit의 kind axis 뒤에 펼쳐 덮어쓴다. 값 · axis · store · index 칸은 온전하므로 axes에 그대로 옮겼다. 러너 수정(키 이름 indexKind) 제안 대상이다.
- 창에서 뺀 구간 없음 · 조각 3개 모두 러너 계측 완료(적재 시간 미계측 조각 없음).

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다. 역전 구간 판정은 격자 전체가 필요하므로 기록 039 §정본 반영이 갖고, 이 기록은 4단계 값만 제공한다.

- 05_data_stores/10_olap_vs_rdb_control.md §대조군 용량 축 — 4단계 도출(I1 힙 약 7.6 GB · I2 추가 약 3 GB) 옆에 실측(힙 7,658,348,544 B · 행당 76.59 B · btree 3,154,337,792 B · 행당 31.5 B)을 올린다. 도출 칸은 지우지 않는다.
- 05_data_stores/10_olap_vs_rdb_control.md §예상 결과 — 삽입 처리량 원본 예상치(PostgreSQL 1만~5만 rows/s) 옆에 조건(COPY · synchronous_commit off · BRIN만)과 함께 2.91M rows/s를 둔다 · 압축률 원본 예상치(PostgreSQL 1~3배)는 공통 분모 기준 0.535로 1보다 작다.
- **이 기록 단독으로 정본 수치를 올리지 않는다.** status discarded이고 4요소 중 메모리 상한이 null이다 — 편차 처리 판정(리드) 뒤에 인용 여부를 정한다. 제안(리드 판정) — ① 04 §반복과 폐기에 계측 해상도 조항(ClickHouse 1 ms 한 칸 차의 처리 · 또는 ClickHouse 판정 값을 query_log 서버 µs로) ② 콜드 반복 1의 첫 실행 효과를 판정 지표에서 어떻게 다룰지 ③ 러너 cmd_axes kind 덮어쓰기 수정 ④ 격자 러너가 run 상한 · 티어 칸을 채우는 방법.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 둔다(판독 규칙 7 — 모르는 필드는 무시). 기록 035~037과 같은 모양이다.

```json
{
  "schema": "measurement/v1",
  "record": "038",
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
    "start": "2026-09-26T17:30:17.975Z",
    "end": "2026-09-26T17:43:40.422Z"
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
    "gridStage": 4,
    "gridRows": 100000000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "dataEnd": "2026-09-26T05:00:00.000Z",
    "dataWindow": {
      "start": "2026-09-26T02:13:20.000Z",
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
    "i2BuildMode": "sync",
    "cacheDefinition": "cold = first run right after restarting both store containers (approx, OS page cache not dropped) · warm = 1 warm-up then 3 runs, rep value = median of 3",
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "fillChunks": 3,
    "fillChunkSec": 3000,
    "settledAt": "2026-09-26T17:30:11.163Z",
    "runnerDirty": true
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.6265,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        6.0,
        6.0,
        6.0
      ],
      "median": 6.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
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
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        942.488,
        745.929,
        716.598
      ],
      "median": 745.929,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        631.296,
        637.078,
        638.084
      ],
      "median": 637.078,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        26.564,
        15.933,
        16.969
      ],
      "median": 16.969,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1.696,
        1.555,
        1.96
      ],
      "median": 1.696,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        6.0,
        6.0,
        5.0
      ],
      "median": 6.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        4.0,
        5.0,
        4.0
      ],
      "median": 4.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1485.19,
        1154.373,
        1142.414
      ],
      "median": 1154.373,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1086.456,
        1103.615,
        1117.326
      ],
      "median": 1103.615,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        44.462,
        38.533,
        39.176
      ],
      "median": 39.176,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        3.105,
        3.433,
        3.106
      ],
      "median": 3.106,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        40.0,
        33.0,
        34.0
      ],
      "median": 34.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        39.0,
        35.0,
        27.0
      ],
      "median": 35.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1180.871,
        1164.717,
        1211.649
      ],
      "median": 1180.871,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1191.888,
        1161.879,
        1183.486
      ],
      "median": 1183.486,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        301.336,
        305.73,
        297.357
      ],
      "median": 301.336,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        195.079,
        195.553,
        194.403
      ],
      "median": 195.079,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        871.0,
        843.0,
        950.0
      ],
      "median": 871.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        779.0,
        828.0,
        845.0
      ],
      "median": 828.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        9588.487,
        11254.192,
        12371.979
      ],
      "median": 11254.192,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        10897.709,
        10829.769,
        11725.812
      ],
      "median": 10897.709,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        8776.742,
        10439.837,
        8518.786
      ],
      "median": 8776.742,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        10233.51,
        11389.832,
        10550.613
      ],
      "median": 10550.613,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        415.0,
        490.0,
        433.0
      ],
      "median": 433.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        385.0,
        463.0,
        467.0
      ],
      "median": 463.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1539.883,
        1387.457,
        1393.249
      ],
      "median": 1393.249,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1343.67,
        1393.55,
        1387.68
      ],
      "median": 1387.68,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1436.028,
        1364.137,
        1346.059
      ],
      "median": 1364.137,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1379.879,
        1356.37,
        1353.309
      ],
      "median": 1356.37,
      "resultMatch": true
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 439903045,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 7659085824,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 9.3202,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 0.5354,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 5773301.687,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 2911208.151,
      "unit": "rows/s"
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 0.9644,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 1.7968,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 253771,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 491520,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 100000000,
      "value": 3154337792,
      "unit": "bytes"
    }
  ],
  "auxPoints": [
    {
      "query": "Q5x",
      "rows": 100000000,
      "stage": 4,
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
      "rows": 100000000,
      "stage": 4,
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
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1173.046,
        1238.18,
        1197.888
      ],
      "median": 1197.888,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1128.215,
        1174.312,
        1158.844
      ],
      "median": 1158.844,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        1190.34,
        1149.454,
        1192.433
      ],
      "median": 1190.34,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 100000000,
      "stage": 4,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1191.653,
        1182.289,
        1139.917
      ],
      "median": 1182.289,
      "resultMatch": true
    }
  ],
  "scan": [
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "readRows": 40960,
      "readBytes": 560173,
      "resultRows": 3600
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 72,
      "sharedReadBlocks": 337132,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 3600.0
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 3618,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 3600.0
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "readRows": 57344,
      "readBytes": 808128,
      "resultRows": 3
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4399,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 3.0
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 10053,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 3.0
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 2031616,
      "readBytes": 48700800,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4337,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 36378,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 53222784,
      "readBytes": 1330569600,
      "resultRows": 600000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 16,
      "sharedReadBlocks": 337132,
      "tempReadBlocks": 153451,
      "workersLaunched": 0,
      "actualRows": 600000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 16,
      "sharedReadBlocks": 337132,
      "tempReadBlocks": 153451,
      "workersLaunched": 0,
      "actualRows": 600000.0
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 100000000,
      "readBytes": 800000000,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
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
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
