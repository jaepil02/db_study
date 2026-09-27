# 039 — 대조군 역전 지점 격자 5단계: 10^9행 · Q1~Q5 × ClickHouse · PostgreSQL I1 · I2 × 콜드 · 웜 · 격자 1~5단계 역전 구간 요약 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T18:27:33.560Z ~ 2026-09-26T20:11:39.936Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 데이터 구간 ts 2026-09-25T01:13:20Z ~ 2026-09-26T05:00:00Z(4단계 10^8행 위에 5단계 900,000,000행) · 실행 2026-09-27 02:43~05:11 KST(원시 첫 행 2026-09-26T17:43:49Z ~ I2 DROP 20:11:50Z)

격자 마지막 단계다. 4단계까지 쌓인 10^8행 앞에 90,000초(25조각 × 3,600초)를 모드 D(ClickHouse)와 GEN-10(PostgreSQL 대조군)으로 같은 행 벡터로 채워 두 저장소를 각각 **1,000,000,000행**(데이터 약 27.8시간 · KST 일 파티션 2개)으로 맞추고, 4단계(기록 038)와 같은 절차로 비 쿼리 축 5와 쿼리 축(Q1~Q5 · Q5x × 세 팔 × 콜드 · 웜 × 반복 3)을 쟀다. 6단계는 하지 않는다 — 원시 보존 7일에서 적재 시간 예산이 0에 수렴한다(05/10 §역전 지점 탐색 설계 W6 판정). 그래서 격자의 관측 범위는 **10^5 ~ 10^9행**이다.

이 기록은 두 가지를 싣는다. ① 5단계의 점과 축 ② 기록 035~039 원시(1~5단계)에서 다시 계산한 **격자 전체의 역전 구간 요약**이다. 역전 구간은 두 격자 단계 사이의 열린-닫힌 구간으로만 말할 수 있다 — 로그 중점 2점 정밀화(05/10 §역전 지점 탐색 설계 정밀화 불릿)는 러너 확장 뒤 별도 기록으로 하므로, **이 기록의 구간 판정은 잠정이다.**

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(모드 D 실행기 보고 run.commitHash · 격자 init git dirty true — 작업 트리에 apps/web · scripts/lab 미커밋 변경이 있었다 · 저장소 이미지 · DDL 경로 변경 여부는 원시에 없다) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** — api를 내리고 datagen-d 컨테이너에서 모드 D가 돈다(기록 034 · 038과 같은 사유) — datagen-d 컨테이너에 compose 메모리 상한이 없어(cgroup max) health 상한 칸이 비는 것이다 |
| 용량 티어 | **해당 없음** — EXP-01~05 공통 조건(06_experiment_catalog §대조군 실험 — 행 수 격자가 축). 러너 run.capacityTier는 null이다. 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz · 실행 인자 --tier M)이고 행 수는 기간으로 키운다 |
| 저장소 자원(대조 자원 조건) | ClickHouse cpuset 5-7 · 3,584 MiB · max_threads 3 · 26.8.10.6 / PostgreSQL cpuset 8-10 · 3,584 MiB · shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on — 두 컨테이너 3 vCPU · 3.5 GiB 동일(기록 038과 같다 · 격자 init) |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 신호 | D(--control on · --rollup on · --mix mixed) + GEN-10 · 42 · 혼합 |
| 내구성 | GEN-10 COPY 세션 synchronous_commit off(서버 기본 on) |
| 채우기 | 25조각 × 3,600초(chunkSec 3600 · 조각당 36,000,000행) · 조각 0~23은 러너 계측 완료(행 수 · 일별 3자 대조 일치 · 종료 코드 0) · **조각 24는 러너 중단 뒤 행 수 대조로 복구(kind fill-recovered — §폐기 · 예외)** |
| 정합(단계 ②) | 1~5단계 구간 전부 CH = PG · 합 1,000,000,000 = 공칭 · 구간 밖 0 · 0 · tag_1m countMerge 1,000,000,000 · 검사 372.0초 |
| 안정화(단계 ③) | 458.4초 · ClickHouse 활성 파트 20 · 머지 0(3표본 연속) · PostgreSQL vacuum 진행 0 · 삽입 기준 vacuum 대기 0 · 체크포인트 128 → 137 |
| 쿼리 매개 | device 1 · tag 1 · end 2026-09-26T05:00:00Z · Q5 문턱 v = 58(5단계 Q5 결과 481,576,872행 = 48.16%) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사) · 웜 = 예열 1회 뒤 3회의 중앙값 |
| 쿼리 순서 | ClickHouse → PostgreSQL I1 → I2 빌드(**비동기** — 컨테이너 안 psql로 파티션별 CREATE INDEX · poll이 ATTACH · 400.3초) → PostgreSQL I2 → I2 DROP |
| 시간 원천 | ClickHouse clickhouse-client --time(**1 ms 해상도**) · PostgreSQL psql \timing · 참고로 ClickHouse query_log 서버 µs · PostgreSQL EXPLAIN(ANALYZE, BUFFERS)(반복 1) · pg_stats 상관(kind observation) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(부하 실험 프로파일 기동 — 리드 실행 조건) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 스냅샷 | 격자 시작 전 복원 s7a-seed-m · 단계 사이 복원 없음(누적 격자) |
| 예산(단계 진입 전) | 디스크 — 좌변 119,609,223,578 B ≥ 도출 103,432,869,228 B(힙 68.4 GB + btree 30 GB + CH 3.96 GB + WAL 여유 1.07 GB) · 시간 — 머리 행 만료 2026-10-02T01:13:20Z까지 458,970초 대 추정 단계 경과 11,565초 |
| 반복 · 편차 | 쿼리 축 3회(반복마다 콜드 1 + 웜 3) · 적재 1회 · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **44.0%** · 기준 20% 초과 7개 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.py · 원시 docs/measurements/raw/039-control-stage-5.jsonl(182행 — 첫 줄 격자 공통 init) · 격자 요약은 035~039 원시 5개에서 재계산 · EXPLAIN 원문 snapshots/lab-s5-grid/explain/s5 |

- 검산: 조건 항목 = **20**
- 점 값의 규칙은 기록 038과 같다 — 반복 번호 순 3값(콜드 = 그 반복 1회 · 웜 = 그 반복 안 3회 중앙값) · 대표값은 중앙값.

## 결과

### 5단계 쿼리 축

#### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리. †는 적재 순서 부산물이 계획을 바꾼 값이다(§해석 · 기계 판독 블록 loadOrderArtifact). ClickHouse 값은 1 ms 해상도라 정수다.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **17,747.530**†(18,537.849 · 17,268.966 · 17,747.530) | **1.488**(1.488 · 1.511 · 1.487) | PG I2 | 8,873.8 | 0.74 |
| Q2 단일 태그 7일 | **8**(8 · 10 · 8) | **40,221.765**(40,307.761 · 40,221.765 · 40,026.543) | **51.173**(56.146 · 50.958 · 51.173) | CH | 5,027.7 | 6.40 |
| Q3 설비 전체 1일 | **217**(213 · 217 · 233) | **33,659.655**(33,659.655 · 33,824.761 · 33,324.636) | **19,070.012**(18,741.927 · 19,070.012 · 19,290.935) | CH | 155.1 | 87.88 |
| Q4 분 단위 롤업 재계산 | **1,397**(1,342 · 1,397 · 1,409) | **21,862.249**†(22,318.043 · 21,862.249 · 21,272.941) | **22,157.276**†(22,157.276 · 22,973.622 · 21,087.977) | CH | 15.6 | 15.86 |
| Q5 비정렬 열 조건 count | **4,457**(4,457 · 4,671 · 4,431) | **39,298.780**(39,403.494 · 39,298.780 · 39,156.133) | **40,858.542**(40,180.127 · 40,858.542 · 41,174.538) | CH | 8.8 | 9.17 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **39,832.506**(39,219.417 · 39,832.506 · 40,298.771) | **40,587.264**(40,566.113 · 40,587.264 · 40,668.948) | CH | 39,832.5 | 40,587.26 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

#### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **8**(8 · 8 · 6) | **18,825.453**†(19,564.232 · 18,761.036 · 18,825.453) | **182.559**(215.473 · 180.899 · 182.559) | CH | 2,353.2 | 22.82 |
| Q2 단일 태그 7일 | **25**(33 · 25 · 22) | **40,904.497**(40,333.425 · 40,904.497 · 41,500.685) | **10,817.731**(14,411.115 · 10,817.731 · 10,793.563) | CH | 1,636.2 | 432.71 |
| Q3 설비 전체 1일 | **236**(287 · 236 · 234) | **35,660.800**(34,948.801 · 35,660.800 · 35,740.919) | **23,082.300**(23,008.800 · 23,082.300 · 23,117.316) | CH | 151.1 | 97.81 |
| Q4 분 단위 롤업 재계산 | **1,388**(1,872 · 1,377 · 1,388) | **23,423.311**†(24,232.090 · 23,423.311 · 21,796.120) | **21,365.311**†(20,896.488 · 22,090.740 · 21,365.311) | CH | 16.9 | 15.39 |
| Q5 비정렬 열 조건 count | **4,722**(5,637 · 4,722 · 4,288) | **39,703.773**(40,206.347 · 39,703.773 · 39,362.778) | **40,762.397**(40,572.953 · 40,831.517 · 40,762.397) | CH | 8.4 | 8.63 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **40,187.553**(40,491.490 · 40,187.553 · 39,941.345) | **40,404.096**(39,692.060 · 40,404.096 · 40,575.918) | CH | 40,187.6 | 40,404.10 |

- 검산: † 점 = Q1 I1 × 2캐시 + Q4 I1 · I2 × 2캐시 = **6**

#### 결과 동일성

- 결과 대조(match) 6/6 true — Q1 3,600행 · Q2 28버킷(avg 차 ÷ 상계 최대 0.0047) · Q3 200태그 · Q4 600,000그룹(avg 차 ÷ 상계 최대 0.090 · bad_cnt 정확 · 롤업 대조 일치) · Q5 481,576,872 = 481,576,872 · Q5x 1,000,000,000 = 1,000,000,000.

#### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_bytes는 비압축)다. 공통 논리 크기는 행 수 × 41 B = 41,000,000,000 B다. PostgreSQL은 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 최상위 노드 shared hit + read(블록 8,192 B)이고 힙 main은 9,345,884블록(76,561,481,728 B) · 파티션 p20260925 496,003,648행 · p20260926 503,989,152행이다. 버퍼 적중은 접근 횟수라 같은 페이지를 여러 번 방문하면 힙 블록 수를 넘을 수 있다(Q3 I2 127.7%).

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 8,192(0.00%) | 204,800(0.00% · 25.0 B) | 4,710,412(hit 4,399 · read 4,706,013 · 50.4%)† · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 3,618(hit 3,618 · read 0 · 0.0%) · Merge Append · Index Scan(p20260926) · 작업자 0 | 3,600 |
| Q2 | 212,992(0.02%) | 3,987,084(0.01% · 18.7 B) | 9,345,960(hit 7,279 · read 9,338,681 · 100.0%) · Aggregate · Gather Merge · Aggregate · Sort · Append · Seq Scan · 작업자 2 | 100,400(hit 100,400 · read 0 · 1.1%) · Sort · Aggregate · Append · Index Scan(p20260923) · Index Scan(p20260924) · Index Scan(p20260925) · Index Scan(p20260926) · Index Scan(default) · 작업자 0 | 28 |
| Q3 | 18,989,056(1.90%) | 451,014,352(1.10% · 23.8 B) | 8,075,479(hit 99 · read 8,075,380 · 86.4%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260925) · Seq Scan · 작업자 2 | 11,938,967(hit 7,198,186 · read 4,740,781 · 127.7%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Index Scan(p20260925) · Seq Scan · 작업자 2 | 200 |
| Q4 | 117,854,976(11.79%) | 2,836,413,232(6.92% · 24.1 B) | 4,710,366(hit 4,353 · read 4,706,013 · temp 131,059 · 50.4%)† · Aggregate · Gather Merge · Sort · Aggregate · Append · Seq Scan · 작업자 2 | 4,710,366(hit 4,353 · read 4,706,013 · temp 131,401 · 50.4%)† · Aggregate · Gather Merge · Sort · Aggregate · Append · Seq Scan · 작업자 2 | 600,000 |
| Q5 | 999,934,464(99.99%) | 7,999,475,712(19.51% · 8.0 B) | 9,345,884(hit 7,203 · read 9,338,681 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 9,345,884(hit 7,203 · read 9,338,681 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 9,345,884(hit 7,203 · read 9,338,681 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 9,345,884(hit 7,203 · read 9,338,681 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan · 작업자 2 | 1 |

- 검산: 쿼리 = **6**

### 5단계 비 쿼리 축

| 축 | ClickHouse | PostgreSQL I1 | PostgreSQL I2 | 비고 |
|------|------:|------:|------:|------|
| 저장 용량(bytes) | 4,529,649,017(활성 파트 20 · Wide) | 76,584,853,504(힙 76,581,879,808 · 인덱스 2,973,696) | — | 행당 4.53 B 대 76.58 B(PG ÷ CH **16.9배**) · 도출 약 76 GB와 일치 |
| 압축률 | 9.051 | 0.5354 | — | 공통 논리 41 B × 10^9 ÷ 분모 |
| 삽입 처리량(rows/s) | 5,370,596(864,000,000행 · 160.876초) | 2,527,646(864,000,000행 · COPY 341.820초) | — | **조각 24(36,000,000행) 미계측 — 24조각으로 계산(untimedChunks [24])** · CH ÷ PG 2.12배 |
| 쓰기 증폭 | 1.810(머지 쓰기 7,158,148,261 ÷ 새 파트 3,953,686,717 · 새 파트 225 · 머지 40) | 1.891(WAL 69,763,834,564 ÷ 900,000,000 × 41 B · LSN 차 66,651,450,128 · FPI 16,052,659 · autovacuum 3 · autoanalyze 3) | — | 창 = 채우기 시작 ~ 안정화 뒤 축 채취 |
| 인덱스 크기(bytes) | 3,277,720(기본 키 1,747,904 + 마크 1,529,816) | 2,727,936(BRIN(ts)) | 31,542,476,800(btree · 행당 31.5 B) | I2 빌드 400.3초(비동기 · p20260925 195.7초 + p20260926 204.5초) · 빌드 WAL 10,212,843,539 B |

- 검산: 축 = **5** · axes 행 = 5 × 2 + I2 1 = **11**

### 격자 1~5단계 — 쿼리 시간 요약

기록 035~039 원시에서 같은 규칙(반복 3값의 중앙값)으로 다시 계산했다. 칸은 ClickHouse / PG I1 / PG I2(ms · 요약용 반올림 — 10 ms 이상 정수 · 미만 소수 1자리)다. 1~3단계 값은 기록 035~037의 원시이며 그 기록의 본문 표가 정본이다.

웜이다.

| 쿼리 | 1단계 10^5 | 2단계 10^6 | 3단계 10^7 | 4단계 10^8 | 5단계 10^9 |
|------|------|------|------|------|------|
| Q1 | 2.0 / 2.9 / 0.2 | 2.0 / 13 / 0.2 | 3.0 / 136 / 0.5 | 3.0 / 637 / 1.7 | 2.0 / 17,748† / 1.5 |
| Q2 | 2.0 / 2.7 / 0.3 | 3.0 / 13 / 0.3 | 3.0 / 138 / 0.5 | 4.0 / 1,104 / 3.1 | 8.0 / 40,222 / 51 |
| Q3 | 2.0 / 3.0 / 0.7 | 3.0 / 13 / 3.8 | 6.0 / 146 / 25 | 35 / 1,183 / 195 | 217 / 33,660 / 19,070 |
| Q4 | 7.0 / 21 / 21 | 26 / 167 / 167 | 194 / 1,005 / 1,000 | 828 / 10,898 / 10,551 | 1,397 / 21,862† / 22,157† |
| Q5 | 3.0 / 3.3 / 3.1 | 8.0 / 14 / 14 | 64 / 159 / 157 | 463 / 1,388 / 1,356 | 4,457 / 39,299 / 40,859 |
| Q5x | 1.0 / 2.3 / 3.8 | 1.0 / 11 / 19 | 1.0 / 120 / 178 | 1.0 / 1,159 / 1,182 | 1.0 / 39,833 / 40,587 |

콜드다.

| 쿼리 | 1단계 10^5 | 2단계 10^6 | 3단계 10^7 | 4단계 10^8 | 5단계 10^9 |
|------|------|------|------|------|------|
| Q1 | 2.0 / 5.1 / 1.5 | 3.0 / 24 / 1.8 | 4.0 / 146 / 4.6 | 6.0 / 746 / 17 | 8.0 / 18,825† / 183 |
| Q2 | 3.0 / 4.7 / 1.5 | 3.0 / 25 / 1.9 | 5.0 / 157 / 4.5 | 6.0 / 1,154 / 39 | 25 / 40,904 / 10,818 |
| Q3 | 2.0 / 5.1 / 2.2 | 4.0 / 26 / 6.7 | 7.0 / 158 / 42 | 34 / 1,181 / 301 | 236 / 35,661 / 23,082 |
| Q4 | 8.0 / 26 / 26 | 26 / 178 / 178 | 200 / 1,030 / 1,014 | 871 / 11,254 / 8,777 | 1,388 / 23,423† / 21,365† |
| Q5 | 3.0 / 5.7 / 6.0 | 8.0 / 28 / 26 | 59 / 169 / 166 | 433 / 1,393 / 1,364 | 4,722 / 39,704 / 40,762 |
| Q5x | 1.0 / 4.7 / 9.4 | 1.0 / 24 / 53 | 1.0 / 133 / 452 | 1.0 / 1,198 / 1,190 | 1.0 / 40,188 / 40,404 |

- 검산: 표당 행 = **6** · 칸 = 6 × 5 = **30** · 두 표 합 60칸 × 3값 = 180 = 기록 5개 × 측정 36(점 30 + 보조 Q5x 6)

### 격자 1~5단계 — 역전 구간(잠정)

판정은 웹 판독기(apps/web/lib/measurements.ts findCrossover)와 같은 규칙이다 — 첫 공통 단계에서 앞선 쪽을 기준으로 삼고, 앞선 쪽이 처음 바뀐 단계와 그 앞 단계 사이를 역전 구간으로 적는다. 바뀌지 않으면 "관측 범위 안 역전 없음"과 그 범위 · 우세 쪽을 적는다. ClickHouse는 변형이 없어 두 PostgreSQL 변형과 각각 짝짓는다.

| 쿼리 | PG 변형 | 웜 | 콜드 | 해상도 · 부산물 주의 |
|------|------|------|------|------|
| Q1 | I1 | 역전 없음(10^5~10^9 · ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 1단계 웜 차 0.9 ms · 5단계 I1은 † |
| Q1 | I2 | **역전 없음(10^5~10^9 · PostgreSQL I2 우세)** | **(10^6, 10^7] — I2 → ClickHouse** | 콜드 3단계 차 0.6 ms(서버 µs 4.27 ms도 CH 앞) |
| Q2 | I1 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 1단계 웜 차 0.7 ms |
| Q2 | I2 | **(10^8, 10^9] — I2 → ClickHouse** | **(10^7, 10^8] — I2 → ClickHouse** | 웜 4단계 차 0.9 ms(서버 µs 4.09 ms로도 I2 앞) · 콜드 3단계 차 0.5 ms(서버 µs 4.51 대 4.50 — 사실상 같다 · 반복별 앞선 쪽 I2 2 : CH 1 · 구간이 (10^6, 10^7]일 수 있다) |
| Q3 | I1 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 1단계 웜 차 1 ms |
| Q3 | I2 | **(10^5, 10^6] — I2 → ClickHouse** | 역전 없음(ClickHouse 우세) | 웜 2단계 반복별 앞선 쪽 CH 2 : I2 1 · 콜드 1단계 차 0.16 ms(반복별 CH 2 : I2 1 · 서버 µs 2.43 ms면 I2 앞 → 웜과 같은 (10^5, 10^6]) |
| Q4 | I1 · I2 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 5단계 PG는 † — 판정 방향은 4단계에서 이미 13배 |
| Q5 | I1 · I2 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 1단계 웜 차 0.1~0.3 ms(서버 µs 2.6 ms로도 CH 앞 · I2는 반복별 CH 2 : I2 1) |
| Q5x | I1 · I2 | 비교 대상 아님 — ClickHouse 파트 메타데이터 count(1 ms) | 상동 | EXP-05 보조 관찰 |

- 검산: 판정 칸 = 쿼리 5 × 변형 2 × 캐시 2 = **20** — 역전 있음 4(Q1 I2 콜드 · Q2 I2 웜 · Q2 I2 콜드 · Q3 I2 웜) + 역전 없음 16(ClickHouse 우세 15 + PostgreSQL I2 우세 1) = **20**
- **"역전 없음 · ClickHouse 우세"는 역전이 관측 범위 아래(10^5행 이하)에 있다는 뜻이지 역전이 없다는 뜻이 아니다.** 첫 단계부터 ClickHouse가 앞서므로 이 격자는 그 아래를 재지 않았다.
- **해상도 주의** — 차가 1 ms 미만인 칸은 ClickHouse 1 ms 해상도 안이다. 서버 µs(query_log)는 클라이언트 경과의 하한이라 PostgreSQL 클라이언트 값이 그보다 작으면 PostgreSQL 우세는 해상도와 무관하게 선다 — 표의 괄호가 그 대조다. 해상도 안에서 판정이 바뀔 수 있는 칸은 Q2 I2 콜드 3단계 · Q3 I2 콜드 1단계 둘이다.
- **반복별 앞선 쪽** — 판정 지표 쌍(쿼리 5 × 변형 2 × 캐시 2 = 20 · 단계 5)의 앞선 쪽이 세 반복에서 갈린 칸은 격자 전체에서 **4**개다(1단계 Q3 I2 콜드 · Q5 I2 웜 · 2단계 Q3 I2 웜 · 3단계 Q2 I2 콜드). 전부 두 값의 차가 1 ms 안팎인 칸이고, 4 · 5단계는 0개다.

### 격자 1~5단계 — 비 쿼리 축 요약

| 단계 | 행 | 행당 저장 B(CH / PG I1) | 압축률(CH / PG) | 삽입 rows/s(CH / PG) | 쓰기 증폭(CH / PG) | 인덱스 bytes(CH / BRIN / btree) |
|:-:|------|------|------|------|------|------|
| 1 | 10^5 | 5.38 / 85.20 | 7.62 / 0.511 | 0.83M / 1.32M | 0.00 / 1.25 | 345 / 245,760 / 3,252,224 |
| 2 | 10^6 | 4.94 / 77.15 | 8.31 / 0.535 | 2.88M / 2.48M | 0.00 / 1.25 | 3,206 / 245,760 / 31,637,504 |
| 3 | 10^7 | 4.47 / 76.66 | 9.17 / 0.535 | 5.49M / 3.20M | 0.00 / 1.25 | 27,489 / 262,144 / 315,514,880 |
| 4 | 10^8 | 4.40 / 76.59 | 9.32 / 0.535 | 5.77M / 2.91M | 0.96 / 1.80 | 253,771 / 491,520 / 3,154,337,792 |
| 5 | 10^9 | 4.53 / 76.58 | 9.05 / 0.535 | 5.37M / 2.53M | 1.81 / 1.89 | 3,277,720 / 2,727,936 / 31,542,476,800 |

- 검산: 단계 = **5** · 축 = **5**
- 삽입 처리량은 단계 증가분의 단독 적재 값이다(5단계는 24조각). 쓰기 증폭 ClickHouse 1~3단계 0은 채우기 시작 ~ 축 채취 창 안에 머지가 없었다는 관측이다(part_log MergeParts 0).

## 해석

- **역전은 테이블 행 수가 아니라 쿼리가 읽는 행 수의 함수다 — Q1과 Q2가 그 대비다.** Q1은 창이 1시간이라 4단계부터 태그 행이 3,600으로 고정되고(1~3단계는 데이터가 창보다 짧아 10 · 100 · 1,000행), PostgreSQL I2의 비용(btree 탐색 + 힙 3,618블록)도 고정이다 — 그래서 웜에서 10^9행까지 **1.488 ms 대 2 ms로 I2가 계속 앞선다**(서버 µs 1.9 ms로도 I2 앞). Q2는 창이 7일이라 데이터 전부를 읽고 태그 행이 테이블과 함께 늘어난다(4단계 10,000 → 5단계 100,000). 같은 btree 경로가 4단계 3.1 ms에서 5단계 51 ms가 되어 ClickHouse(4.0 → 8 ms)에 역전된다. 전역 요약 "PostgreSQL은 1억 행 이상에서 급격히 증가"(원본 예상치)는 인덱스가 맞는 쿼리에는 성립하지 않고, 인덱스가 읽는 행이 늘어나는 쿼리에서만 성립한다.
- **Q2 I2가 5단계에서 느려진 이유 — 한 태그의 행이 힙 페이지마다 흩어져 있다(explain 수치로 확인).** Q2 I2는 100,000행에 공유 버퍼 **100,400블록**을 적중했다(4단계 10,000행에 10,053블록). plain Index Scan은 연속한 TID가 같은 페이지면 버퍼를 다시 세지 않으므로 블록 수 ≈ 행 수는 btree 순서(device_id, tag_id, ts)로 이웃한 행 — 같은 태그의 다음 초 — 이 서로 다른 페이지에 있다는 뜻이다. 매 초 1만 태그의 행이 삽입 순서대로 힙에 쌓이므로 한 페이지(약 107행)에는 같은 초의 다른 태그들이 들어가고 같은 태그의 다음 행은 약 94페이지 뒤에 있다. ClickHouse는 ORDER BY (device_id, tag_id, ts) 정렬 저장이라 같은 태그 100,000행이 파트마다 연속이고, 희소 인덱스가 그래뉼 26개(212,992행 · 3.99 MB)만 읽는다. **행당 페이지 1회(PostgreSQL) 대 8,192행당 그래뉼 1회(ClickHouse)** — 행이 10배 늘면 앞은 10배, 뒤는 그래뉼 수만큼 는다(7 → 26). 콜드 5단계에서 이 차가 극단이 된다 — 재기동 뒤 100,400페이지를 흩어진 위치에서 다시 읽어 **10.8초**(페이지당 약 108 µs)가 되고 ClickHouse는 25 ms다.
- **콜드 역전이 웜보다 이른 것도 같은 원리다.** 콜드는 shared_buffers가 빈 상태라 I2의 행당 페이지가 전부 버퍼 밖 읽기가 된다. Q1 I2 콜드는 3단계(4.579 ms 대 4 ms)부터 ClickHouse에 뒤지고 5단계에서 182.559 ms 대 8 ms다 — 같은 3,618블록인데 4단계 17 ms보다 10배 큰 것은 힙이 7.66 GB → 76.6 GB로 커져 VM 페이지 캐시에 남을 수 없게 된 것으로 읽힌다(VM 메모리 크기는 원시에 없어 추정이다 · 콜드 근사 한계 07_measurement_limits).
- **Q3는 정렬 키 접두(device_id)가 가장 이르게 가른다 — 역전 (10^5, 10^6].** 설비 1의 행은 태그 200 × 초라 2단계부터 20만 행이다. ClickHouse는 정렬 키 접두로 설비 1 구간만 연속으로 읽고(5단계 18,989,056행 · 451 MB) PostgreSQL I2는 btree 접두로 찾되 힙 방문이 행 수에 비례한다. 5단계 I2는 p20260925 쪽을 plain Index Scan으로 읽어 **7,200,000행에 7,198,186블록 적중**(행당 1페이지 — 4단계의 Bitmap Heap Scan은 페이지를 정렬해 2,000,000행을 36,378블록으로 모았다)이고 p20260926 쪽은 Seq Scan(4,740,781블록)이라 19.1초 대 ClickHouse 217 ms다.
- **Q4 · Q5는 전 범위 ClickHouse 우세 — 열 단위 읽기의 이득은 행이 늘수록 커진다.** Q5에서 ClickHouse는 value 열만 읽고(5단계 7.999 GB 비압축 · 행당 8 B) PostgreSQL은 힙 전체를 읽는다(76.5 GB · 행당 76 B). 비는 1단계 1.1배 → 4단계 3.0배 → 5단계 8.8배로 커진다. 4 → 5단계에서 ClickHouse는 행 10배에 시간 9.6배로 거의 선형이고 PostgreSQL은 28.3배다 — 힙이 shared_buffers(896MB)와 VM 캐시를 넘어 읽기가 디스크 대역폭에 묶인 것으로 읽힌다(9,345,884블록 ÷ 39.3초 ≈ 1.9 GB/s · 추정). device · tag 조건이 없는 Q4 · Q5에서 btree는 쓰이지 않아 I2 계획이 I1과 같다.
- **5단계 PG I1 Q1 · Q4와 I2 Q4의 계획은 적재 순서 부산물이다 — 원리 차이와 섞지 않는다.** 4단계 I1 Q1은 BRIN 비트맵(337,132블록 · 686 ms)이었는데 5단계는 **Parallel Seq Scan(p20260926 전체 4,706,013블록 읽기 · 17.6초)**이 됐다(kind observation). pg_stats의 ts 상관이 p20260925 0.99999 · p20260926 **0.027**이다. 격자는 end를 고정하고 단계마다 더 이른 구간을 채운다(과거 방향 누적) — p20260926 파티션에 1~4단계(02:13Z~05:00Z)가 먼저 쌓이고 5단계의 뒤쪽 조각(15:00Z~02:13Z)이 그 뒤에 붙어, 힙의 물리 순서가 ts와 어긋났다. 플래너는 BRIN 비용을 상관으로 추정하므로 Seq Scan을 골랐다. 조각 안은 시간 연속이라 BRIN이 실제로 가리키는 블록 범위는 좁았을 것이지만(4단계와 같은 1시간 창) 이 계획을 재지 않았다. 운영 적재는 시간 순 추가라 이 모양이 생기지 않는다. 영향 범위는 **창이 파티션 일부인 쿼리**뿐이다 — Q1 · Q4(1시간 창)는 †, Q2(창이 데이터 전부)와 Q3(p20260926 부분이 파티션 전부 · p20260925 부분은 상관 0.99999로 BRIN 비트맵 유지)는 계획이 부산물과 무관하다. † 점이 역전 판정을 바꾸지 않는다 — Q1은 I2가, Q4는 4단계에서 이미 13배로 ClickHouse가 판정을 갖는다.
- **부산물 안에 원리가 하나 있다 — 힙은 삽입 순서이고 MergeTree는 정렬 파트다.** PostgreSQL 힙은 도착 순서대로 페이지를 채우므로 BRIN의 효용이 적재 순서(물리 상관)에 달린다 — 과거 구간을 뒤늦게 백필하는 운영(재적재 · 지연 도착 대량 보정)에서는 같은 일이 실제로 생긴다. ClickHouse는 파트마다 ORDER BY로 정렬해 쓰고 머지가 정렬을 유지하므로 삽입 순서와 무관하다 — 5단계 ClickHouse Q1이 2 ms(그래뉼 1)로 4단계와 같다. 이 원리 서술은 † 수치를 근거로 쓰지 않는다 — 부산물 수치의 크기(17.6초)는 격자 적재 방식이 정한 값이라 운영 백필의 크기가 아니다.
- **비 쿼리 축 — PostgreSQL이 이긴 칸의 대가는 행 수와 함께 선형으로 는다.** 저장 용량은 1단계 뒤 행당 76.6 B · 4.4~4.5 B로 수렴하고(16.9배) 5단계 I2 btree 31.5 GB(행당 31.5 B)를 더하면 PostgreSQL 108.1 GB 대 ClickHouse 4.53 GB(23.9배)다. I2 빌드는 400초 · WAL 10.2 GB였다 — Q1 · Q2의 수 ms를 사는 값이다. 삽입은 3단계 뒤 ClickHouse 5.4~5.8M rows/s · PostgreSQL 2.5~3.2M rows/s(I1 · BRIN만 · synchronous_commit off · COPY)로 약 2배이며, 1단계(10^5행)만 PostgreSQL이 빨랐다(0.83M 대 1.32M — 원인은 원시로 가르지 않았다). 쓰기 증폭은 5단계에서 ClickHouse 머지 1.81 · PostgreSQL WAL 1.89로 비슷해진다 — "RDB만 쓰기 증폭이 있다"는 통념은 이 격자에서 서지 않는다(05/10 §비교 축 6 축 5 불릿).
- **가설 판정(카탈로그 EXP-01~05 가설 열 · 잠정)** — EXP-01 성립(I1은 관측 범위 아래에서 이미 역전 · I2는 웜 역전 없음) · EXP-02 웜 성립(Q2 I2는 역전하고 Q1 I2는 역전하지 않는다) · 콜드 불성립(Q2 (10^7, 10^8]가 Q1 (10^6, 10^7]보다 늦다 — 다만 Q2 콜드 3단계는 해상도 안) · EXP-03 성립(설비 조건은 I2 대비 (10^5, 10^6]로 가장 이르다) · EXP-04 성립(관측 범위 아래 · 롤업 대조 5단계 전부 일치) · EXP-05 성립(관측 범위 아래 · 1단계는 차 0.1~0.3 ms로 해상도 가까이).
- **한계** — ① 구간 판정은 격자 단계 사이의 10배 폭이다 — 로그 중점 2점 정밀화 전까지 잠정 ② 콜드는 근사다(07_measurement_limits) ③ ClickHouse 시간은 1 ms 해상도다 — 해상도 안 칸 2개가 구간을 한 단계 옮길 수 있다 ④ 쿼리 매개가 한 쌍(device 1 · tag 1)이라 태그 · 설비 선택의 분포가 없다 ⑤ 자원이 3 vCPU · 3.5 GiB로 작아 5단계 PostgreSQL 전체 스캔은 메모리를 넘는 크기의 읽기다 — 역전 구간은 이 자원 조건의 값이다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 7개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** CH Q2 콜드 33 · 25 · 22 ms = 44.0% · CH Q4 콜드 1,872 · 1,377 · 1,388 = 35.7% · PG I2 Q2 콜드 14,411.115 · 10,817.731 · 10,793.563 = 33.4% · CH Q5 콜드 5,637 · 4,722 · 4,288 = 28.6% · CH Q2 웜 8 · 10 · 8 = 25.0% · CH Q1 콜드 8 · 8 · 6 = 25.0% · CH Q3 콜드 287 · 236 · 234 = 22.5%.
- **초과의 성격 — 7개 중 6개가 콜드이고 그중 5개는 반복 1이 가장 크다**(팔의 첫 재기동 직후 · CH Q2 · Q4 · Q5 · Q3 · PG I2 Q2). 해상도가 만드는 초과는 CH Q2 웜(8 ↔ 10 ms) · CH Q1 콜드(6 ↔ 8 ms)다. 04에는 해상도 양자화 · 콜드 첫 반복의 예외 조항이 없어 규칙대로 폐기한다.
- **폐기가 앞선 쪽 판정을 흔들지는 않는다(참고).** 판정 지표 20쌍의 앞선 쪽이 세 반복 모두에서 같다(4단계도 같다). 격자 전체에서 반복별 앞선 쪽이 갈린 칸은 4개뿐이며 §결과 역전 구간 표 주의 열에 적었다. 폐기 기록의 수치는 정본에 인용하지 않으며, 역전 구간은 판정이 아니라 잠정 관찰이다.
- **적재 사고 — 조각 24 적재 시간 미계측(예외 · 폐기 사유 아님).** 리드의 fill 묶음 호출이 도구 600초 상한으로 자동 백그라운드 전환되어 즉시 중단(TaskStop)됐다. scripts/lab/s5/grid/grid.py는 조각 24(2026-09-26T01:13:20Z ~ 02:13:20Z) 도중 끊겼으나 모드 D 컨테이너(datagen-d)는 끝까지 완료했다. 리드가 구간 행 수를 CH 36,000,000 = 대조군 36,000,000 = 공칭으로, 분 경계 롤업을 36,600,000 = 원시 36,600,000으로 대조한 뒤 수동으로 done 표시했다(원시 kind fill-recovered · state.json recovered). 단계 ②(check)가 이 구간을 포함한 1~5단계 전 구간 행 수 · 구간 밖 0 · tag_1m countMerge 1,000,000,000을 다시 확인했다 — 단 check의 일별 롤업 재확인(modeDRollupDays)은 조각 출력(days)을 읽으므로 조각 24를 포함하지 않으며, 그 몫은 리드의 수동 대조와 전체 countMerge 일치가 대신한다.
  - 영향 ① 삽입 처리량 축 — 조각 24의 chInsertSec · controlCopySec가 없어 24조각(864,000,000행)으로 계산했다(axes untimedChunks [24]). 조각 0~23의 조각별 처리량이 CH 5.0~5.8M · PG 2.1~3.2M rows/s 범위라 한 조각을 빼서 생기는 편향은 이 폭 안이다.
  - 영향 ② 채우기 끝 카운터(fillEnd) 채취 지연 — 조각 23 끝(18:05:08Z)과 fillEnd 채취(18:07:16Z) 사이 2분 8초 안에 조각 24 적재가 끝났다. **쓰기 증폭 축은 fillEnd가 아니라 채우기 시작 기준선 ~ 축 채취(18:27:14Z) 창의 차라 이 지연의 영향을 받지 않는다.** fillEnd가 쓰인 자리는 안정화 판정의 "채우기 뒤 체크포인트 경과"(기준 128)뿐이며, 늦은 채취는 기준을 올려 판정을 엄격하게 만들 뿐이다(137로 통과). 참고로 원시상 fillEnd ~ 축 채취 사이 WAL은 7,174,075,864 B(창 전체 69.76 GB의 10.3% — 안정화 중 autovacuum · 체크포인트 FPI)로, 이 몫은 설계대로 축 5에 들어간다(05/10 §역전 지점 탐색 설계 ③).
  - 영향 없음 — 쿼리 축 · 결과 대조 · 구간 정합 · 인덱스 · 저장 용량 · 압축률.
  - **상태 판단 근거** — 04 §기록 상태의 discarded 사유는 편차 초과 · 조건 위반 · 생성기 포화다. 이 사고는 계측 하나(한 조각 적재 시간)를 잃은 것이고 조건(자원 · 스위치 · 모드 · 시드)과 데이터(행 집합 정합)는 온전하므로 폐기 사유가 아니다. 잃은 계측은 axes에 명시하고 값을 추정으로 채우지 않았다.
- **WAL 두 원천의 차.** 쓰기 증폭 PostgreSQL 분자인 pg_stat_wal wal_bytes 증가분(69,763,834,564 B)이 LSN 차(66,651,450,128 B)보다 3.11 GB 크다 — 4단계는 반대로 LSN 차가 0.02 GB 컸다. 통계 누적 반영 시점(백엔드별 지연 반영) 차로 추정하지만 원시로 가를 수 없다. LSN 차 기준이면 증폭 1.806이다.
- **웹 팀원의 호스트 빌드 · 테스트(2026-09-27 01:45~02:25 KST)는 이 단계와 무관하다.** 5단계는 채우기 첫 행(02:43:49 KST)부터 그 창 밖이다(원시 at으로 확인).
- **폐기 후 절차 — 러너를 고쳐 격자 전체(1~5단계)를 새 기록으로 재측정한다(예정).** 고칠 것은 ① 미래 방향 적재(05/10 §역전 지점 탐색 설계 "실제로 쌓이는 순서 그대로" 문장대로 — 적재 순서 부산물 제거) ② ClickHouse 서버 µs 계측(1 ms 해상도 해소) ③ 로그 중점 정밀화 단계다. 폐기 기록은 지우지 않고 남긴다(04 §반복과 폐기 · 폐기 후).
- 불성립 구조 판정 없음 — 단계 ② 정합 · 결과 대조 6/6 · 롤업 대조 전부 일치.
- **4요소 중 둘이 health null이다**(기록 038과 같다). run.memoryLimitMb null을 추정값으로 채우지 않는다(04 §조건 칸) — BFF 판독 규칙 4가 "4요소 누락"으로 센다(상태 discarded라 규칙 3에서 먼저 빠진다). 대조 메모리는 conditions.controlMemoryMb(3,584 · 3,584)에 따로 적었다. 용량 티어는 카탈로그 공통 조건의 "해당 없음"을 문자열로 싣는다(기록 035~037과 같은 처리).
- **러너 원시의 kind 칸 덮어쓰기** — PostgreSQL I1 인덱스 크기 축 행이 kind BRIN(ts)으로 남았다(기록 038 같은 결함 · 값 칸은 온전).
- **실행 시각** — 리드 요약의 5단계 02:48~05:05 KST와 원시(첫 행 02:43:49 · I2 DROP 05:11:50 KST)가 다르다. 머리 줄은 원시를 따랐다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다. **이 기록 단독으로 정본 수치를 올리지 않는다.** status discarded이고 4요소 중 메모리 상한이 null이다 — 편차 처리 판정(리드) 뒤에 인용 여부를 정한다. 제안(리드 판정) — ① 04 §반복과 폐기에 계측 해상도 조항(ClickHouse 1 ms 한 칸 차의 처리 · 또는 ClickHouse 판정 값을 query_log 서버 µs로) ② 콜드 반복 1의 첫 실행 효과를 판정 지표에서 어떻게 다룰지 ③ 러너 cmd_axes kind 덮어쓰기 수정 ④ 격자 러너가 run 상한 · 티어 칸을 채우는 방법.

- 05_data_stores/10_olap_vs_rdb_control.md §예상 결과 역전 지점 행 · §미확인 · 미설계 등재 "쿼리별 역전 지점" — 미확인 옆에 잠정 구간(§결과 역전 구간 표 · 웜 · 콜드)과 "관측 범위 10^5~10^9행 · 정밀화 전"을 올린다. 3계층 미확인 표지는 정밀화 기록이 구간을 좁힐 때까지 유지한다.
- 10_observability/06_experiment_catalog.md EXP-01~05 — 가설 판정(§해석 · 잠정)을 결과 자리에 기록 인용으로 둔다.
- 05_data_stores/10_olap_vs_rdb_control.md §대조군 용량 축 — 5단계 도출(I1 힙 약 76 GB · I2 추가 약 30 GB) 옆에 실측(힙 76,581,879,808 B · btree 31,542,476,800 B)을 올린다.
- **05/10 §역전 지점 탐색 설계 "구성을 고정하고 기간으로 키운다. 시스템이 실제로 쌓이는 순서 그대로라" 문장과 구현이 어긋난다.** 러너는 end를 고정하고 단계마다 더 이른 구간을 앞에 채운다(과거 방향 누적 — 머리 행 만료를 늦추려는 선택) — 파티션 안 물리 순서가 시간 순이 아니다. 선택지 ① 문장을 as-built로 고치고 한계 등재(BRIN 계획이 적재 순서에 의존) ② 러너를 미래 방향 누적으로 바꿔 운영 순서와 맞춘다(적재 시간 예산 · 보존 창과의 관계를 다시 따져야 한다) — 리드 판정 대상이다.
- 05/10 §인덱스 변형 A형 불릿 — "1만 태그가 섞여 들어오는 행 순서"의 결과를 실측으로 보강한다(I2 Q2 행당 힙 1페이지 · 100,400블록 — 이 기록).
- 러너 보강(scripts) — ① ClickHouse 시간 해상도(1 ms)를 query_log 서버 µs 병기 또는 판정 원천으로 ② 로그 중점 정밀화 단계(교차 구간 (10^5, 10^6] · (10^6, 10^7] · (10^7, 10^8] · (10^8, 10^9]의 중점 2점씩) ③ 축 행 kind 덮어쓰기(indexKind) ④ datagen-d에 CAPACITY_TIER 전달 ⑤ 묶음 fill 호출이 600초를 넘지 않게 호출당 조각 수 상한.
- 미확인으로 남기는 것 — 역전 지점의 정밀 행 수 · 콜드 근사 오차 · 태그 · 설비 선택 분포 · 운영 순서(시간 순) 적재에서의 5단계 BRIN 계획 값.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 둔다(판독 규칙 7 — 모르는 필드는 무시). 기록 035~037과 같은 모양이다.

```json
{
  "schema": "measurement/v1",
  "record": "039",
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
    "start": "2026-09-26T18:27:33.560Z",
    "end": "2026-09-26T20:11:39.936Z"
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
    "gridStage": 5,
    "gridRows": 1000000000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "dataEnd": "2026-09-26T05:00:00.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:13:20.000Z",
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
    "i2BuildMode": "async",
    "cacheDefinition": "cold = first run right after restarting both store containers (approx, OS page cache not dropped) · warm = 1 warm-up then 3 runs, rep value = median of 3",
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "fillChunks": 25,
    "fillChunkSec": 3600,
    "settledAt": "2026-09-26T18:27:05.866Z",
    "runnerDirty": true,
    "untimedFillChunks": [
      24
    ],
    "fillRecovered": "chunk 24: runner interrupted (tool 600 s limit → auto background → stopped); mode D container completed; lead verified CH = control = 36000000 = nominal and minute-boundary rollup 36600000 = raw, marked done — insert timing not measured",
    "loadOrderArtifact": "points flagged loadOrderArtifact: PG planner switched BRIN bitmap -> Seq Scan on p20260926 (pg_stats ts correlation 0.027 vs p20260925 0.99999) because the grid fills earlier ranges later"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.44,
    "threshold": 0.2
  },
  "results": [],
  "points": [
    {
      "query": "Q1",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        8.0,
        8.0,
        6.0
      ],
      "median": 8.0,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000000,
      "stage": 5,
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
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        19564.232,
        18761.036,
        18825.453
      ],
      "median": 18825.453,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q1",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        18537.849,
        17268.966,
        17747.53
      ],
      "median": 17747.53,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q1",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        215.473,
        180.899,
        182.559
      ],
      "median": 182.559,
      "resultMatch": true
    },
    {
      "query": "Q1",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        1.488,
        1.511,
        1.487
      ],
      "median": 1.488,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        33.0,
        25.0,
        22.0
      ],
      "median": 25.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        8.0,
        10.0,
        8.0
      ],
      "median": 8.0,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        40333.425,
        40904.497,
        41500.685
      ],
      "median": 40904.497,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        40307.761,
        40221.765,
        40026.543
      ],
      "median": 40221.765,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        14411.115,
        10817.731,
        10793.563
      ],
      "median": 10817.731,
      "resultMatch": true
    },
    {
      "query": "Q2",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        56.146,
        50.958,
        51.173
      ],
      "median": 51.173,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        287.0,
        236.0,
        234.0
      ],
      "median": 236.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        213.0,
        217.0,
        233.0
      ],
      "median": 217.0,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        34948.801,
        35660.8,
        35740.919
      ],
      "median": 35660.8,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        33659.655,
        33824.761,
        33324.636
      ],
      "median": 33659.655,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        23008.8,
        23082.3,
        23117.316
      ],
      "median": 23082.3,
      "resultMatch": true
    },
    {
      "query": "Q3",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        18741.927,
        19070.012,
        19290.935
      ],
      "median": 19070.012,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        1872.0,
        1377.0,
        1388.0
      ],
      "median": 1388.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        1342.0,
        1397.0,
        1409.0
      ],
      "median": 1397.0,
      "resultMatch": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        24232.09,
        23423.311,
        21796.12
      ],
      "median": 23423.311,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        22318.043,
        21862.249,
        21272.941
      ],
      "median": 21862.249,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        20896.488,
        22090.74,
        21365.311
      ],
      "median": 21365.311,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q4",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        22157.276,
        22973.622,
        21087.977
      ],
      "median": 22157.276,
      "resultMatch": true,
      "loadOrderArtifact": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "unit": "ms",
      "values": [
        5637.0,
        4722.0,
        4288.0
      ],
      "median": 4722.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "unit": "ms",
      "values": [
        4457.0,
        4671.0,
        4431.0
      ],
      "median": 4457.0,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        40206.347,
        39703.773,
        39362.778
      ],
      "median": 39703.773,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        39403.494,
        39298.78,
        39156.133
      ],
      "median": 39298.78,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        40572.953,
        40831.517,
        40762.397
      ],
      "median": 40762.397,
      "resultMatch": true
    },
    {
      "query": "Q5",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        40180.127,
        40858.542,
        41174.538
      ],
      "median": 40858.542,
      "resultMatch": true
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 4529649017,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 76584853504,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 9.0515,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 0.5354,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 5370595.987,
      "unit": "rows/s",
      "untimedChunks": [
        24
      ],
      "timedRows": 864000000
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 2527646.13,
      "unit": "rows/s",
      "untimedChunks": [
        24
      ],
      "timedRows": 864000000
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 1.8105,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 1.8906,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 3277720,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 2727936,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 1000000000,
      "value": 31542476800,
      "unit": "bytes"
    }
  ],
  "auxPoints": [
    {
      "query": "Q5x",
      "rows": 1000000000,
      "stage": 5,
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
      "rows": 1000000000,
      "stage": 5,
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
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "unit": "ms",
      "values": [
        40491.49,
        40187.553,
        39941.345
      ],
      "median": 40187.553,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "unit": "ms",
      "values": [
        39219.417,
        39832.506,
        40298.771
      ],
      "median": 39832.506,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "unit": "ms",
      "values": [
        39692.06,
        40404.096,
        40575.918
      ],
      "median": 40404.096,
      "resultMatch": true
    },
    {
      "query": "Q5x",
      "rows": 1000000000,
      "stage": 5,
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "unit": "ms",
      "values": [
        40566.113,
        40587.264,
        40668.948
      ],
      "median": 40587.264,
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
      "resultRows": 3600
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4399,
      "sharedReadBlocks": 4706013,
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
      "readRows": 212992,
      "readBytes": 3987084,
      "resultRows": 28
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 7279,
      "sharedReadBlocks": 9338681,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 28.0
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 100400,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 28.0
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 18989056,
      "readBytes": 451014352,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 99,
      "sharedReadBlocks": 8075380,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7198186,
      "sharedReadBlocks": 4740781,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 117854976,
      "readBytes": 2836413232,
      "resultRows": 600000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 4353,
      "sharedReadBlocks": 4706013,
      "tempReadBlocks": 131059,
      "workersLaunched": 2,
      "actualRows": 600000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4353,
      "sharedReadBlocks": 4706013,
      "tempReadBlocks": 131401,
      "workersLaunched": 2,
      "actualRows": 600000.0
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 999934464,
      "readBytes": 7999475712,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338681,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338681,
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
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338681,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338681,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
