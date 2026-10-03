# 052 — 대조군 역전 지점 격자 5단계(격자 2차 · 미래 방향 적재): 10^9행 · Q1~Q5 × ClickHouse · PostgreSQL I1 · I2 × 콜드 · 웜 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(재측정 대상 기록 039 — 기계 판독 블록 conditions.remeasureOf) · 판정 창: 2026-09-27T05:03:24.184Z ~ 2026-09-27T06:37:26.289Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 데이터 구간 ts 2026-09-25T01:06:20Z ~ 2026-09-26T04:53:00Z(4단계 10^8행 뒤에 5단계 900,000,000행) · 실행 2026-09-27 13:20~15:37 KST(원시 첫 행 budget 04:20:11Z ~ I2 DROP 06:37:38Z)

격자 2차의 마지막 단계다. 격자 2차는 1차(기록 035~039 · 전부 폐기)의 재측정이고, 러너는 적재를 **미래 방향(시간 순) 누적**으로 바꿨다(ts 상관 0.99999 — 리드 실측 · 원시 없음) — 시작 시각 S = 2026-09-25T01:06:20Z를 고정하고 점 p의 데이터를 [S, S + D_p)로 둔다(grid.py 머리 주석 · 05/10 §역전 지점 탐색 설계 "시스템이 실제로 쌓이는 순서 그대로"). 4단계까지 쌓인 10^8행 뒤에 90,000초(25조각 × 3,600초)를 모드 D(ClickHouse)와 GEN-10(PostgreSQL 대조군)으로 같은 행 벡터로 채워 두 저장소를 각각 **1,000,000,000행**(데이터 100,000초 ≈ 27.8시간 · KST 일 파티션 2개)으로 맞추고, 4단계(기록 051)와 같은 절차로 비 쿼리 축 5와 쿼리 축을 쟀다. I2 btree는 10^8행을 넘어 파티션별 **비동기**로 빌드했다(리드 판정 7). 6단계는 하지 않는다 — 원시 보존 7일에서 적재 시간 예산이 0에 수렴한다(05/10 §역전 지점 탐색 설계 W6 판정). 격자의 관측 범위는 **10^5 ~ 10^9행**이다.

이 기록의 중심 대조는 1차 폐기 원인의 해소다 — 1차 5단계 PostgreSQL I1 Q1은 적재 순서 부산물로 Seq Scan(Parallel Aware · EXPLAIN 17,642.8 ms)이었고, 2차에서는 **BRIN 비트맵(EXPLAIN 980.6 ms)**이다(§해석 첫 불릿 · explain 원시 대조). **역전 구간은 이 기록 단독으로 판정하지 않는다** — 단계 기록 048~052와 정밀화 점 6개를 묶어 기록 053이 판정한다(리드 판정 9).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | **5492c73**(원시 run.commitHash · 격자 init git dirty true) — 1~5단계는 5492c73 + 미커밋 PGSS 스냅샷 키 수정(scripts/lab/s5/grid/grid.py 한 곳 · 러너 쿼리 경로 · 이미지 밖)으로 돌았고 그 수정은 뒤에 커밋 c89b982로 들어갔다(리드 판정 5) — 저장소 이미지 · DDL · 모드 D 경로는 5492c73 그대로다 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)"(04 §조건 칸 2026-09-27 개정 · 추정값 금지) |
| 용량 티어 | **해당 없음**(원시 run.capacityTier — EXP-01~05 공통 조건 · 행 수 격자가 축) · 모드 D 보고 null · 데이터 구성 M(설비 50 × 태그 200 · 1 Hz · --tier M) |
| 저장소 자원(대조 자원 조건) | 대조 오버레이 infra/compose/compose.control.yml · ClickHouse cpuset 5-7 · 3,584 MiB · max_threads 3 · 26.8.10.6 / PostgreSQL cpuset 8-10 · 3,584 MiB · shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · effective_cache_size 2688MB — 두 컨테이너 3 vCPU · 3.5 GiB 동일(격자 init env) · api 정지 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 신호 | D(--control on · --rollup on · --mix mixed) + GEN-10 · 42 · 혼합 |
| 내구성 | GEN-10 COPY 세션 synchronous_commit off(서버 기본 on) |
| 적재 방향 | **미래 방향 누적(init direction forward)** · S = 2026-09-25T01:06:20Z · 머리 만료 2026-10-02T01:06:20Z · KST 일 파티션 p20260925 500,200,000행(1~4단계 100,000,000 + 5단계 400,200,000) · p20260926 499,800,000행(원시 fill days 합) — 두 파티션 모두 ts 순서대로 채워졌다 |
| 채우기 | 25조각 × 3,600초(chunkSec 3600 · 조각당 36,000,000행 · 구간 2026-09-25T03:53:00Z ~ 2026-09-26T04:53:00Z) · 조각 25개 전부 러너 계측 완료(행 수 · 일별 3자 대조 일치 · 종료 코드 0 · 미계측 조각 없음) · 조각 호출 04:20:52Z ~ 04:41:16Z |
| 정합(단계 ②) | 1~5단계 구간 전부 CH = PG · 합 1,000,000,000 = 공칭 · [S, end) 밖 0 · 0 · tag_1m countMerge 1,000,000,000 · 조각 사슬 5 → 4 → 3 → 2 → 1이 창을 덮음 · 검사 225.4초 |
| 안정화(단계 ③) | 3회 호출 합 1,069.8초 — 1 · 2회(519.4 · 519.6초)는 PostgreSQL autovacuum 진행 1 · 삽입 기준 vacuum 대기 파티션 1로 미충족, 3회(30.8초) 충족 · ClickHouse 활성 파트 18 · 머지 0 · 체크포인트 127 → 135 |
| 쿼리 매개 | device 1 · tag 1 · end 2026-09-26T04:53:00Z · Q5 문턱 v = 58(1단계 직후 · 선택도 0.49599) — 5단계 Q5 결과 481,744,056행 = 48.17% |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사) · 웜 = 예열 1회 뒤 3회의 중앙값 |
| 쿼리 순서 | ClickHouse → PostgreSQL I1 → I2 빌드(**비동기** — i2-build가 postgres 컨테이너 안 psql로 파티션별 CREATE INDEX를 띄우고 i2-build-poll이 ATTACH · 416.8초) → PostgreSQL I2 → I2 DROP |
| 시간 원천 | 대표값 = 클라이언트 경과 — ClickHouse clickhouse-client --time(**1 ms 해상도**) · PostgreSQL psql \timing(µs) / 서버 시간 — ClickHouse query_log µs · PostgreSQL pg_stat_statements total_exec_time 증가분 / EXPLAIN(ANALYZE, BUFFERS)는 반복 1(시간 판정에 쓰지 않는다) |
| 편차 판정 기준 | 반복 3값의 (최대 − 최소) ÷ 중앙값 · 점(쿼리 · 캐시)의 첫 ClickHouse 줄(반복 1) CH client < 10 ms면 두 저장소 모두 서버 µs(06 §EXP-29~39 끝 불릿 2026-09-27 · 출처 state.json judgmentBasis(decidedAtRep 1) · query 줄 judgmentSpread.basis) — 이 단계 server 기준 점: Q1 콜드 · 웜 · Q2 웜(Q5x 보조 포함) · Q2 콜드는 반복 1 CH 32 ms라 client |
| 동률 판정 | CH client 중앙값 < 10 ms이고 두 client 중앙값 차 < 1 ms인 점은 pair 서버 µs 중앙값으로(리드 판정 2) — 이 단계 해당 점 **없음** |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| ClickHouse 서버 로그 수준(공정성 한계) | 이미지 기본 trace(config.d에 logger 없음) — text_log 10분 약 470만 줄 규모 · 측정 중 바꾸지 않았다(리드 W6 판정 · 원시 줄 밖 사실) |
| 초기 상태 · 스냅샷 | 격자 시작 전 복원 s7a-seed-m · 단계 사이 복원 없음(누적 격자) · 5단계 끝 채움 스냅샷 없음(5단계 위 정밀화 구간 없음 — 러너 SNAPSHOT_STAGES 1~4) |
| 예산(단계 진입 전) | 디스크 — 좌변 111,796,427,162 B ≥ 도출 103,434,846,888 B(힙 68.4 GB + btree 30 GB + CH 3.96 GB + WAL 여유 1.07 GB) · 시간 — 머리 만료까지 420,368초 대 추정 단계 경과 11,957초(실제 budget ~ 마지막 쿼리 끝 8,234.8초) |
| 반복 · 편차 | 쿼리 축 3회(반복마다 콜드 1 + 웜 3) · 적재 1회 · 판정 지표 30(Q5x 보조 제외) 최대 편차 **51.29%**(PG I2 Q1 콜드 · 서버 µs) · 기준 20% 초과 **8개** |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.py · 원시 docs/measurements/raw/052-control-stage-5.jsonl(255행 — 첫 줄 격자 공통 init + point "5" 줄 254) · EXPLAIN 원문 snapshots/lab-s5-grid-f/explain/s5 · 결과 집합 snapshots/lab-s5-grid-f/results/s5 · 1차 대조 원문 snapshots/lab-s5-grid/explain/s5/Q1.I1.json · docs/measurements/raw/039-control-stage-5.jsonl · 재계산 스크립트 .omc/lab/grid2-w-grid-b/ |

- 검산: 조건 항목 = **24**
- 점 값의 규칙은 기록 051과 같다 — 반복 번호 순 3값(콜드 = 그 반복 1회 · 웜 = 그 반복 안 3회 중앙값) · 대표값은 중앙값.

## 결과

### 쿼리 시간 — 웜

반복 3의 값과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리. ClickHouse 값은 1 ms 해상도라 정수다.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 3 · 3) | **969.788**(941.349 · 975.266 · 969.788) | **1.726**(1.653 · 1.726 · 1.758) | PG I2 | 323.3 | 0.58 |
| Q2 단일 태그 7일 | **7**(7 · 7 · 7) | **40,758.573**(40,317.537 · 40,758.573 · 40,903.776) | **54.719**(54.719 · 52.465 · 56.204) | CH | 5,822.7 | 7.82 |
| Q3 설비 전체 1일 | **217**(218 · 209 · 217) | **35,916.751**(35,916.751 · 35,968.786 · 35,903.419) | **21,827.079**(21,691.147 · 21,827.079 · 22,153.500) | CH | 165.5 | 100.6 |
| Q4 분 단위 롤업 재계산 | **793**(793 · 775 · 803) | **7,563.079**(7,038.448 · 7,563.079 · 8,676.232) | **8,038.277**(7,743.749 · 8,038.277 · 9,049.515) | CH | 9.54 | 10.14 |
| Q5 비정렬 열 조건 count | **4,608**(4,669 · 4,608 · 4,448) | **41,452.111**(41,093.844 · 41,452.111 · 41,456.431) | **40,769.747**(40,769.747 · 40,628.983 · 41,237.405) | CH | 9.00 | 8.85 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **41,183.810**(41,038.857 · 41,854.449 · 41,183.810) | **41,194.200**(41,251.144 · 41,002.245 · 41,194.200) | CH(비교 대상 아님) | 41,183.8 | 41,194.2 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **4**(5 · 4 · 4) | **1,690.662**(1,338.514 · 1,690.662 · 1,712.701) | **495.289**(604.433 · 495.289 · 353.249) | CH | 422.7 | 123.8 |
| Q2 단일 태그 7일 | **28**(32 · 28 · 18) | **40,574.464**(40,660.287 · 40,574.464 · 40,520.513) | **11,472.653**(15,064.943 · 11,448.469 · 11,472.653) | CH | 1,449.1 | 409.7 |
| Q3 설비 전체 1일 | **241**(262 · 241 · 238) | **37,035.873**(37,444.466 · 37,035.873 · 36,535.584) | **26,505.514**(25,614.186 · 26,505.514 · 26,854.261) | CH | 153.7 | 110.0 |
| Q4 분 단위 롤업 재계산 | **883**(967 · 790 · 883) | **8,900.183**(10,225.214 · 8,835.858 · 8,900.183) | **8,003.555**(8,003.555 · 9,036.092 · 5,060.538) | CH | 10.08 | 9.06 |
| Q5 비정렬 열 조건 count | **4,730**(5,318 · 4,730 · 4,302) | **42,109.553**(40,492.247 · 42,109.553 · 42,837.346) | **40,513.920**(40,416.301 · 40,513.920 · 40,947.739) | CH | 8.90 | 8.57 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **41,363.371**(41,094.469 · 42,057.399 · 41,363.371) | **41,796.552**(41,162.471 · 41,998.086 · 41,796.552) | CH(비교 대상 아님) | 41,363.4 | 41,796.6 |

### 변형별 앞선 쪽(이 단계 한 점)

중앙값 판정의 원천은 점 대표값(client 중앙값)이다. 반복별 부호는 pair 줄마다의 우열이고(그 반복의 tieWithinResolution이 true면 서버 µs · 이 단계는 60줄 전부 false라 전부 client) 세 반복이 같으면 구조 우열(3/3 · 리드 판정 12)이다.

| 쿼리 | PG 변형 | 웜 — 중앙값 판정(원천) | 웜 — 반복별 부호 · 구조 우열 | 콜드 — 중앙값 판정(원천) | 콜드 — 반복별 부호 · 구조 우열 |
|------|------|------|------|------|------|
| Q1 | I1 | CH(client 3 대 969.788) | CH CH CH → **CH 3/3** | CH(client 4 대 1,690.662) | CH CH CH → **CH 3/3** |
| Q1 | I2 | PG I2(client 3 대 1.726) | PG I2 PG I2 PG I2 → **PG I2 3/3** | CH(client 4 대 495.289) | CH CH CH → **CH 3/3** |
| Q2 | I1 | CH(client 7 대 40,758.573) | CH CH CH → **CH 3/3** | CH(client 28 대 40,574.464) | CH CH CH → **CH 3/3** |
| Q2 | I2 | CH(client 7 대 54.719) | CH CH CH → **CH 3/3** | CH(client 28 대 11,472.653) | CH CH CH → **CH 3/3** |
| Q3 | I1 | CH(client 217 대 35,916.751) | CH CH CH → **CH 3/3** | CH(client 241 대 37,035.873) | CH CH CH → **CH 3/3** |
| Q3 | I2 | CH(client 217 대 21,827.079) | CH CH CH → **CH 3/3** | CH(client 241 대 26,505.514) | CH CH CH → **CH 3/3** |
| Q4 | I1 | CH(client 793 대 7,563.079) | CH CH CH → **CH 3/3** | CH(client 883 대 8,900.183) | CH CH CH → **CH 3/3** |
| Q4 | I2 | CH(client 793 대 8,038.277) | CH CH CH → **CH 3/3** | CH(client 883 대 8,003.555) | CH CH CH → **CH 3/3** |
| Q5 | I1 | CH(client 4,608 대 41,452.111) | CH CH CH → **CH 3/3** | CH(client 4,730 대 42,109.553) | CH CH CH → **CH 3/3** |
| Q5 | I2 | CH(client 4,608 대 40,769.747) | CH CH CH → **CH 3/3** | CH(client 4,730 대 40,513.920) | CH CH CH → **CH 3/3** |

- 검산: 판정 칸 = 쿼리 5 × 변형 2 × 캐시 2 = **20** — 중앙값 판정 ClickHouse 앞 19 + PostgreSQL I2 앞 1(Q1 웜) / 구조 우열 3/3 **20** · 미정 0

### 동률 판정

동률 점 없음 — 판정 칸 20개 전부에서 CH client 중앙값 ≥ 10 ms이거나 두 client 중앙값 차 ≥ 1 ms이고, 반복별 pair 줄의 tieWithinResolution도 60줄 전부 false다.

- **Q1 I2 웜(PostgreSQL I2 앞)은 동률 점이 아니다** — client 1.726 대 3 ms로 차 1.274 ms가 해상도(1 ms)를 넘고, 서버 µs도 0.971 대 2.847 ms다. 서버 시간 비대칭(PostgreSQL 계획 시간 제외 · ClickHouse 파싱 포함 — conditions.serverTimeAsymmetry)을 반복 1 EXPLAIN planningMs 1.163 ms로 메워도 2.134 ms로 I2가 앞선다.

### 결과 동일성

- 결과 대조(match) 6/6 true — Q1 3,600행 · Q2 28버킷(avg 차 ÷ 상계 최대 0.0047) · Q3 200태그(0.00061) · Q4 600,000그룹(0.1027 · bad_cnt 정확 · 롤업 대조 일치 · 불일치 그룹 0) · Q5 481,744,056 = 481,744,056 · Q5x 1,000,000,000 = 1,000,000,000.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_bytes는 비압축)다. 공통 논리 크기는 행 수 × 41 B = 41,000,000,000 B다. PostgreSQL은 반복 1의 EXPLAIN 최상위 노드 shared hit + read(블록 8,192 B)이고 힙 main은 9,345,856블록(76,561,252,352 B)이다. 버퍼 적중은 접근 횟수라 힙 블록 수를 넘을 수 있다(Q3 I2 128.2%).

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 32,768(0.00%) | 458,879(0.00% · 14.0 B) | 336,887(hit 114 · read 336,773 · 3.6%) · Gather Merge · Sort · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 2 | 3,618(hit 3,618 · read 0 · 0.0%) · Merge Append · Index Scan(p20260926) · 작업자 0 | 3,600 |
| Q2 | 188,416(0.02%) | 3,694,560(0.01% · 19.6 B) | 9,345,932(hit 7,279 · read 9,338,653 · 100.0%) · Aggregate · Gather Merge · Aggregate · Sort · Append · Seq Scan × 5 · 작업자 2 | 100,399(hit 100,399 · read 0 · 1.1%) · Sort · Aggregate · Append · Index Scan(p20260923) · Index Scan(p20260924) · Index Scan(p20260925) · Index Scan(p20260926) · Index Scan(default) · 작업자 0 | 28 |
| Q3 | 17,547,264(1.75%) | 421,134,336(1.03% · 24.0 B) | 8,075,165(hit 91 · read 8,075,074 · 86.4%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260925) · Seq Scan · 작업자 2 | 11,984,036(hit 7,279,983 · read 4,704,053 · 128.2%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Index Scan(p20260925) · Seq Scan · 작업자 2 | 200 |
| Q4 | 51,028,480(5.10%) | 1,275,712,000(3.11% · 25.0 B) | 336,901(hit 128 · read 336,773 · temp 175,788 · 3.6%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 2 | 336,901(hit 128 · read 336,773 · temp 175,923 · 3.6%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260926) · 작업자 2 | 600,000 |
| Q5 | 1,000,000,000(100.00%) | 8,000,000,000(19.51% · 8.0 B) | 9,345,856(hit 7,203 · read 9,338,653 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 9,345,856(hit 7,203 · read 9,338,653 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 9,345,856(hit 7,203 · read 9,338,653 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 9,345,856(hit 7,203 · read 9,338,653 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 1 |

- 검산: 쿼리 = **6**

### 비 쿼리 축

| 축 | ClickHouse | PostgreSQL I1 | PostgreSQL I2 | 비고 |
|------|------:|------:|------:|------|
| 저장 용량(bytes) | 4,528,577,595(활성 파트 18 · Wide · Compact) | 76,584,214,528(힙 76,581,437,440 · 인덱스 2,777,088) | — | 행당 4.53 B 대 76.58 B(PG ÷ CH **16.9배**) · 도출 약 76 GB와 일치 |
| 압축률 | 9.054 | 0.5354 | — | 공통 논리 41 B × 10^9 ÷ 분모 |
| 삽입 처리량(rows/s) | 5,473,221(900,000,000행 · 164.437초) | 2,581,941(900,000,000행 · COPY 348.575초) | — | 25조각 전부 계측 · 조각별 CH 5.13~5.74M · PG 2.05~3.24M · CH ÷ PG 2.12배 |
| 쓰기 증폭 | 1.828(머지 쓰기 7,227,151,670 ÷ 새 파트 3,954,159,355 · 새 파트 226 · 머지 41) | 1.857(WAL 68,525,395,670 ÷ 900,000,000 × 41 B · LSN 차 65,445,829,840 · FPI 15,225,768 · autovacuum 3 · autoanalyze 3) | — | 창 = 단계 채우기 시작 ~ 안정화 뒤 축 채취 |
| 인덱스 크기(bytes) | 3,271,454(기본 키 1,746,584 + 마크 1,524,870) | 2,531,328(BRIN(ts)) | 31,542,476,800(btree · 행당 31.5 B) | I2 빌드 416.833초(**비동기** · p20260925 210.609초 + p20260926 206.169초) · 빌드 WAL 10,211,835,636 B |

- 검산: 축 = **5** · axes 행 = 5 × 2 + I2 1 = **11**
- **WAL 두 원천의 차** — 쓰기 증폭 PostgreSQL 분자인 pg_stat_wal wal_bytes 증가분이 LSN 차보다 3,079,565,830 B 크다(4단계는 LSN 차가 24,944,588 B 컸다 · 기록 051). 원인은 원시로 가르지 않았다. LSN 차 기준이면 증폭 1.774다.

## 해석

- **1차 폐기 원인은 해소됐다 — PostgreSQL I1 Q1이 BRIN 비트맵으로 돌아왔다(explain 원시 대조).** 2차 5단계 I1 Q1 계획은 Gather Merge · Sort · Append · **Bitmap Heap Scan(p20260926) · Bitmap Index Scan(p20260926_ts_idx)** · 작업자 2이고 읽은 블록 336,773(힙의 3.6% — 1시간 창 ÷ 데이터 27.8시간 = 3.6%와 같다) · EXPLAIN 실행 980.615 ms다(snapshots/lab-s5-grid-f/explain/s5/Q1.I1.json). 대표값은 웜 **969.788 ms**(941.349 · 975.266 · 969.788) · 콜드 1,690.662 ms다. 1차 5단계의 같은 쿼리는 Gather Merge · Sort · Append · **Seq Scan(Parallel Aware · p20260926)**이었고 p20260926 파티션 전체 4,706,013블록을 읽어 EXPLAIN 17,642.788 ms · 웜 대표값 17,747.53 ms였다(snapshots/lab-s5-grid/explain/s5/Q1.I1.json · docs/measurements/raw/039-control-stage-5.jsonl — 폐기 기록의 원시라 대조로만 쓴다). 2차 4단계(기록 051)의 같은 계획이 337,132블록을 읽었으므로 **BRIN이 읽는 범위는 테이블이 10배 커져도 1시간 창만큼으로 같다** — 미래 방향 적재로 힙 물리 순서가 ts 순서가 된 결과다. 같은 블록 수인데 시간이 4단계 685.735 ms → 5단계 980.615 ms(EXPLAIN)로 는 원인은 원시로 가르지 않았다.
- **ts 상관계수 — 0.99999(리드 실측 · 원시 없음).** 리드가 격자 2차 뒤 pg_stats로 잰 값이고, 2차 러너 원시에는 상관 값이 없다(grid.jsonl 전 2,684행). 참고로 1차 원시(docs/measurements/raw/039-control-stage-5.jsonl kind observation)에는 p20260925 0.9999964 · p20260926 0.027179148이 있다. 이 기록이 원시로 대는 해소 근거는 위 계획(BRIN 비트맵 · 1시간 창만큼의 블록)이다.
- **Q4도 부산물이 사라졌다 — 두 변형 모두 BRIN 비트맵 · 병렬.** I1 · I2 Q4 계획은 Bitmap Heap Scan(p20260926) · 작업자 2 · 336,773블록 · temp 약 17.6만 블록이고 웜 7,563.079 · 8,038.277 ms다(1차 5단계는 Seq Scan(Parallel Aware) 4,706,013블록 · 21,862.249 · 22,157.276 ms · 원시 039). **2차 4단계 Q4(10,670.536 ms · 작업자 0)보다 5단계가 빠르다** — 같은 1시간 창 블록 수(337,132 대 336,773)에서 4단계(작업자 0)와 달리 5단계는 작업자 2 계획이다. 행 수 축 위에서 PostgreSQL 시간이 단조가 아닌 칸이므로 053의 구간 판정에서 이 계획 차를 함께 본다.
- **Q1 웜은 10^9까지 PostgreSQL I2가 앞선다 · Q2 웜은 5단계에서 ClickHouse가 앞선다 — 읽는 행 수의 차다.** Q1 I2는 btree + 힙 3,618블록(4단계와 같은 수)이라 1.726 ms로 고정이고 ClickHouse는 3 ms(그래뉼 4 · 32,768행)다. Q2는 창 7일이 데이터 전부라 태그 행이 테이블과 함께 늘어(4단계 10,000 → 5단계 100,000행) I2가 **100,399블록**(행당 1페이지)을 적중해 54.719 ms가 되고 ClickHouse는 188,416행 · 7 ms다 — 4 → 5단계에서 I2는 14.0배 · ClickHouse는 1.75배다. 콜드 Q2 I2는 11,472.653 ms다 — 재기동 뒤 흩어진 100,399페이지를 다시 읽은 것으로 읽힌다(콜드 버퍼 원시 없음).
- **Q3는 두 변형 모두 ClickHouse가 앞선다.** I2 계획은 p20260925 쪽(창 앞부분)을 Index Scan · p20260926 쪽(파티션 전부)을 Seq Scan해 hit 7,279,983 + read 4,704,053블록 · 21.8초이고 ClickHouse는 정렬 키 접두로 17,547,264행 · 217 ms다. I1은 p20260925 쪽을 BRIN 비트맵 · p20260926 쪽을 Seq Scan해 8,075,165블록 · 35.9초다.
- **Q5는 전 행 읽기의 차가 9배로 커진다.** ClickHouse는 value 열만 읽고(8,000,000,000 B 비압축 · 행당 8 B) PostgreSQL은 힙 전체(9,345,856블록 · 76.6 GB)를 읽는다. 4 → 5단계에서 ClickHouse는 행 10배에 시간 9.8배(472 → 4,608 ms) · PostgreSQL I1은 29.3배(1,414.243 → 41,452.111 ms)다 — 힙이 shared_buffers(896MB)와 VM 캐시를 넘어 디스크 읽기에 묶인 것으로 읽힌다(VM 메모리 크기는 원시에 없어 추정이다).
- **비 쿼리 축 — PostgreSQL이 이긴 칸(Q1 웜)의 대가는 행 수와 함께 선형으로 는다.** btree 31.5 GB(행당 31.5 B) · 빌드 416.8초 · WAL 10.2 GB를 더하면 PostgreSQL 108.1 GB 대 ClickHouse 4.53 GB(23.9배)다. 삽입은 ClickHouse 5.47M · PostgreSQL 2.58M rows/s(2.12배) · 쓰기 증폭은 1.828 대 1.857로 비슷하다.
- **한계** — ① 콜드는 근사다(07_measurement_limits) ② ClickHouse client 1 ms 해상도 · 서버 시간 비대칭(serverTimeAsymmetry) ③ 쿼리 매개 한 쌍(device 1 · tag 1) ④ 자원 3 vCPU · 3.5 GiB — 5단계 PostgreSQL 전체 스캔은 메모리를 넘는 읽기다 ⑤ ClickHouse 서버 로그 수준 trace(공정성 한계) ⑥ 2차 ts 상관은 리드 실측 · 원시 없음 ⑦ 역전 구간은 이 기록 단독으로 판정하지 않는다(053).

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 8개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded · 리드 판정 3).** 크기 수치(ms · 배수 · 바이트)는 정본에 인용하지 않고 구조 사실만 인용할 수 있다(리드 판정 13) — 우열 3/3(판정 칸 20개 전부) · 인덱스 선택과 계획 노드(1차 대비 Seq Scan → BRIN 비트맵 전환 포함) · 읽은 행 · 블록 수의 모양 · 결과 일치 · 정합.

| 판정 지표 | 편차 기준 | 반복 1 · 2 · 3 | 편차 | 최댓값 반복 |
|------|------|------|------|------|
| PG I2 Q1 콜드 | 서버 µs | 599.782 · 490.579 · 348.157 | 51.29% | 1 |
| CH Q2 콜드 | client | 32 · 28 · 18 | 50.00% | 1 |
| PG I2 Q4 콜드 | client | 8,003.555 · 9,036.092 · 5,060.538 | 49.67% | 2 |
| PG I2 Q2 콜드 | client | 15,064.943 · 11,448.469 · 11,472.653 | 31.52% | 1 |
| PG I1 Q1 콜드 | 서버 µs | 1,323.397 · 1,673.333 · 1,695.658 | 22.25% | 3 |
| PG I1 Q4 웜 | client | 7,038.448 · 7,563.079 · 8,676.232 | 21.65% | 3 |
| CH Q5 콜드 | client | 5,318 · 4,730 · 4,302 | 21.48% | 1 |
| CH Q4 콜드 | client | 967 · 790 · 883 | 20.05% | 1 |

- 검산: 초과 = **8** — 콜드 7 · 웜 1 / 서버 µs 기준 2 · client 기준 6 / 최댓값이 반복 1인 칸 5
- **초과의 성격 — 8개 중 7개가 콜드이고 5개는 반복 1이 가장 크다**(팔의 첫 재기동 직후). CH Q4 콜드는 20.05%로 기준을 겨우 넘었다. PG I1 Q1 콜드는 반복 1이 가장 작다(1,323.397 대 1,673.333 · 1,695.658 ms 서버). PG I2 Q4 콜드는 반복 3이 5,060.538 ms로 다른 두 반복(8,003.555 · 9,036.092)보다 작다. 원인은 원시로 가르지 않았다. 순간값 · 양자화 값은 판정 지표 30에 없다.
- **폐기가 이 단계의 우열을 흔들지는 않는다.** 판정 칸 20개 전부에서 세 반복의 앞선 쪽이 같아(§결과 변형별 앞선 쪽) 우열은 구조 사실로 인용된다(리드 판정 12 — 04 §구조 판정과 분포 판정의 편차 폐기 면제 적용 · 정본 조항 명시는 W6 리드).
- **I2 빌드 줄 2개는 중복이 아니다** — 비동기 빌드의 시작 줄(05:57:02Z · complete false · running default 파티션)과 완료 줄(06:04:13Z · complete true · 416.833초)이다. 축 값은 완료 줄이다. 파티션 줄의 tuples(460,002,432 · 499,805,984)는 reltuples 추정이라 행 수 대조에 쓰지 않는다(행 수는 단계 ② 정합이 갖는다).
- **중복 query 줄 없음** — 108줄 = 6 × 3 × 3 × 2 · pair 72줄. PostgreSQL query 줄 72개의 서버 값이 전부 있다(1단계 PGSS 키 결함 · 리드 판정 4는 이 단계에 없다).
- 불성립 구조 판정 없음 — 단계 ② 정합 · 결과 대조 6/6 · 롤업 대조 일치.
- **4요소 중 메모리 상한이 null이다** — run.memoryLimitSource를 함께 실었다(04 §조건 칸 2026-09-27 개정). 대조 메모리는 conditions.controlMemoryMb에 따로 적었다. 상태 discarded라 BFF 판독 규칙 3에서 먼저 빠진다.
- **정정 관계** — 기록 039(격자 1차 5단계 · 격자 요약 포함)는 discarded 그대로다. 이 기록은 폐기 뒤 러너를 고쳐 다시 잰 새 기록이고 supersedes는 null · 재측정 관계는 conditions.remeasureOf "039"에 적는다(기록 030 선례). 039가 실었던 격자 전체 요약 · 역전 구간은 2차에서는 053이 싣는다.

## 정본 반영

없음 — status discarded다. 역전 구간 판정과 정본 반영 계획은 기록 053이 갖는다. 제안(리드 판정 대상) — ① 05/10 §역전 지점 탐색 설계의 "시스템이 실제로 쌓이는 순서 그대로" 문장과 구현이 격자 2차에서 일치한다(기록 039 §정본 반영의 설계 · 구현 어긋남 항목 해소 — 구조 사실: I1 Q1 · Q4 BRIN 비트맵 · 1시간 창만큼의 블록) ② 러너 axes 단계에 pg_stats ts 상관 채취를 넣는다(2차 원시 없음) ③ 05/10 §대조군 용량 축 5단계 도출값의 실측 확인은 유효 기록의 일이다 — 이 기록은 그 근거가 아니다(리드 판정 13).

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이다. 점마다 serverValues · serverMedian · deviationBasis · deviation을 더했고, 보조 관찰 Q5x는 auxPoints에 · 변형별 우열은 pairVerdicts에 · 읽은 양은 scan에 · 초과 지표는 overThreshold에 둔다(판독 규칙 7). 1차 대조 값은 싣지 않는다(폐기 기록의 원시).

```json
{
  "schema": "measurement/v1",
  "record": "052",
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
    "start": "2026-09-27T05:03:24.184Z",
    "end": "2026-09-27T06:37:26.289Z"
  },
  "run": {
    "commitHash": "5492c73",
    "memoryProfile": "load",
    "memoryLimitMb": null,
    "capacityTier": "해당 없음",
    "memoryLimitSource": "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)"
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
    "composeOverlay": "infra/compose/compose.control.yml",
    "apiStopped": true,
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
    "direction": "forward",
    "gridStart": "2026-09-25T01:06:20.000Z",
    "dataEnd": "2026-09-26T04:53:00.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:06:20.000Z",
      "end": "2026-09-26T04:53:00.000Z"
    },
    "q5Threshold": 58.0,
    "q5SelectivityStage1": 0.49599,
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
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE (µs) · server: CH query_log µs · PG pg_stat_statements total_exec_time delta",
    "serverTimeAsymmetry": "서버 시간은 두 엔진이 같은 구간을 재지 않는다 — PostgreSQL: pg_stat_statements total_exec_time(실행만 · track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse: query_log query_start_time_microseconds ~ event_time_microseconds(파싱 · 분석 · 계획 포함 · 결과 전송 포함)",
    "deviationRule": "deviation across 3 reps = (max-min)/median · basis fixed per (query, cache) by the first CH line (source: state.json judgmentBasis decidedAtRep 1 · query line judgmentSpread.basis): CH client median < 10 ms -> server µs for both stores · else client",
    "tieRule": "tie point = CH client median < 10 ms and |CH - PG| client median diff < 1 ms (pair tieWithinResolution at point level) -> winner by median of per-rep pair server medians",
    "structuralRule": "per-rep sign from pair lines (server medians for reps with tieWithinResolution true, else client medians) · same winner in 3/3 reps = structural fact (lead decision 12) · split = undetermined, cannot be an interval endpoint",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "fillChunks": 25,
    "fillChunkSec": 3600,
    "settledAt": "2026-09-27T05:03:16.281Z",
    "runnerDirty": true,
    "runnerNote": "stages 1-5 ran on 5492c73 + uncommitted PGSS snapshot key fix in grid.py (runner query path, outside image) — committed later as c89b982",
    "clickhouseServerLogLevel": "image default trace (no logger in config.d) — text_log grows ~4.7M lines per 10 min; not changed during measurement (lead W6)",
    "untimedFillChunks": [],
    "remeasureOf": "039",
    "remeasureNote": "039 discarded (grid 1st pass: backward fill broke BRIN correlation, CH 1 ms resolution) — remeasured with forward fill, CH server µs, refine; supersedes not used for discarded records"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.5129,
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
        5.0,
        4.0,
        4.0
      ],
      "median": 4.0,
      "resultMatch": true,
      "serverValues": [
        4.563,
        4.428,
        4.362
      ],
      "serverMedian": 4.428,
      "deviationBasis": "server",
      "deviation": 0.0454
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
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true,
      "serverValues": [
        3.292,
        2.825,
        2.847
      ],
      "serverMedian": 2.847,
      "deviationBasis": "server",
      "deviation": 0.164
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
        1338.514,
        1690.662,
        1712.701
      ],
      "median": 1690.662,
      "resultMatch": true,
      "serverValues": [
        1323.396751,
        1673.332917,
        1695.658042
      ],
      "serverMedian": 1673.332917,
      "deviationBasis": "server",
      "deviation": 0.2225
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
        941.349,
        975.266,
        969.788
      ],
      "median": 969.788,
      "resultMatch": true,
      "serverValues": [
        940.073708,
        973.865709,
        968.566916
      ],
      "serverMedian": 968.566916,
      "deviationBasis": "server",
      "deviation": 0.0349
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
        604.433,
        495.289,
        353.249
      ],
      "median": 495.289,
      "resultMatch": true,
      "serverValues": [
        599.782167,
        490.579375,
        348.157416
      ],
      "serverMedian": 490.579375,
      "deviationBasis": "server",
      "deviation": 0.5129
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
        1.653,
        1.726,
        1.758
      ],
      "median": 1.726,
      "resultMatch": true,
      "serverValues": [
        0.902417,
        0.970625,
        0.973791
      ],
      "serverMedian": 0.970625,
      "deviationBasis": "server",
      "deviation": 0.0735
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
        32.0,
        28.0,
        18.0
      ],
      "median": 28.0,
      "resultMatch": true,
      "serverValues": [
        31.889,
        27.926,
        18.362
      ],
      "serverMedian": 27.926,
      "deviationBasis": "client",
      "deviation": 0.5
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
        7.0,
        7.0,
        7.0
      ],
      "median": 7.0,
      "resultMatch": true,
      "serverValues": [
        6.708,
        7.204,
        7.083
      ],
      "serverMedian": 7.083,
      "deviationBasis": "server",
      "deviation": 0.07
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
        40660.287,
        40574.464,
        40520.513
      ],
      "median": 40574.464,
      "resultMatch": true,
      "serverValues": [
        40646.841186,
        40559.535268,
        40506.586019
      ],
      "serverMedian": 40559.535268,
      "deviationBasis": "client",
      "deviation": 0.0034
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
        40317.537,
        40758.573,
        40903.776
      ],
      "median": 40758.573,
      "resultMatch": true,
      "serverValues": [
        40315.866977,
        40757.004894,
        40902.400851
      ],
      "serverMedian": 40757.004894,
      "deviationBasis": "server",
      "deviation": 0.0144
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
        15064.943,
        11448.469,
        11472.653
      ],
      "median": 11472.653,
      "resultMatch": true,
      "serverValues": [
        15063.265382,
        11446.778631,
        11470.903047
      ],
      "serverMedian": 11470.903047,
      "deviationBasis": "client",
      "deviation": 0.3152
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
        54.719,
        52.465,
        56.204
      ],
      "median": 54.719,
      "resultMatch": true,
      "serverValues": [
        54.341458,
        52.132542,
        55.860792
      ],
      "serverMedian": 54.341458,
      "deviationBasis": "server",
      "deviation": 0.0686
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
        262.0,
        241.0,
        238.0
      ],
      "median": 241.0,
      "resultMatch": true,
      "serverValues": [
        261.984,
        240.808,
        238.49
      ],
      "serverMedian": 240.808,
      "deviationBasis": "client",
      "deviation": 0.0996
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
        218.0,
        209.0,
        217.0
      ],
      "median": 217.0,
      "resultMatch": true,
      "serverValues": [
        217.741,
        209.154,
        216.802
      ],
      "serverMedian": 216.802,
      "deviationBasis": "client",
      "deviation": 0.0415
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
        37444.466,
        37035.873,
        36535.584
      ],
      "median": 37035.873,
      "resultMatch": true,
      "serverValues": [
        37429.4426,
        37022.669268,
        36522.892309
      ],
      "serverMedian": 37022.669268,
      "deviationBasis": "client",
      "deviation": 0.0245
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
        35916.751,
        35968.786,
        35903.419
      ],
      "median": 35916.751,
      "resultMatch": true,
      "serverValues": [
        35914.688184,
        35966.862225,
        35901.637808
      ],
      "serverMedian": 35914.688184,
      "deviationBasis": "client",
      "deviation": 0.0018
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
        25614.186,
        26505.514,
        26854.261
      ],
      "median": 26505.514,
      "resultMatch": true,
      "serverValues": [
        25596.253344,
        26490.382845,
        26839.360846
      ],
      "serverMedian": 26490.382845,
      "deviationBasis": "client",
      "deviation": 0.0468
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
        21691.147,
        21827.079,
        22153.5
      ],
      "median": 21827.079,
      "resultMatch": true,
      "serverValues": [
        21688.908676,
        21824.76876,
        22151.286676
      ],
      "serverMedian": 21824.76876,
      "deviationBasis": "client",
      "deviation": 0.0212
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
        967.0,
        790.0,
        883.0
      ],
      "median": 883.0,
      "resultMatch": true,
      "serverValues": [
        966.632,
        790.111,
        883.505
      ],
      "serverMedian": 883.505,
      "deviationBasis": "client",
      "deviation": 0.2005
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
        793.0,
        775.0,
        803.0
      ],
      "median": 793.0,
      "resultMatch": true,
      "serverValues": [
        792.713,
        775.164,
        802.789
      ],
      "serverMedian": 792.713,
      "deviationBasis": "client",
      "deviation": 0.0353
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
        10225.214,
        8835.858,
        8900.183
      ],
      "median": 8900.183,
      "resultMatch": true,
      "serverValues": [
        10002.552963,
        8612.878796,
        8675.630503
      ],
      "serverMedian": 8675.630503,
      "deviationBasis": "client",
      "deviation": 0.1561
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
        7038.448,
        7563.079,
        8676.232
      ],
      "median": 7563.079,
      "resultMatch": true,
      "serverValues": [
        6807.185712,
        7354.965545,
        8475.38192
      ],
      "serverMedian": 7354.965545,
      "deviationBasis": "client",
      "deviation": 0.2165
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
        8003.555,
        9036.092,
        5060.538
      ],
      "median": 8003.555,
      "resultMatch": true,
      "serverValues": [
        7785.210962,
        8808.324254,
        4833.490711
      ],
      "serverMedian": 7785.210962,
      "deviationBasis": "client",
      "deviation": 0.4967
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
        7743.749,
        8038.277,
        9049.515
      ],
      "median": 8038.277,
      "resultMatch": true,
      "serverValues": [
        7533.492212,
        7837.091755,
        8832.391211
      ],
      "serverMedian": 7837.091755,
      "deviationBasis": "client",
      "deviation": 0.1624
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
        5318.0,
        4730.0,
        4302.0
      ],
      "median": 4730.0,
      "resultMatch": true,
      "serverValues": [
        5318.196,
        4731.656,
        4301.678
      ],
      "serverMedian": 4731.656,
      "deviationBasis": "client",
      "deviation": 0.2148
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
        4669.0,
        4608.0,
        4448.0
      ],
      "median": 4608.0,
      "resultMatch": true,
      "serverValues": [
        4669.076,
        4608.473,
        4448.261
      ],
      "serverMedian": 4608.473,
      "deviationBasis": "client",
      "deviation": 0.048
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
        40492.247,
        42109.553,
        42837.346
      ],
      "median": 42109.553,
      "resultMatch": true,
      "serverValues": [
        40479.977186,
        42095.642311,
        42823.818144
      ],
      "serverMedian": 42095.642311,
      "deviationBasis": "client",
      "deviation": 0.0557
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
        41093.844,
        41452.111,
        41456.431
      ],
      "median": 41452.111,
      "resultMatch": true,
      "serverValues": [
        41092.824018,
        41451.266894,
        41455.564728
      ],
      "serverMedian": 41451.266894,
      "deviationBasis": "client",
      "deviation": 0.0087
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
        40416.301,
        40513.92,
        40947.739
      ],
      "median": 40513.92,
      "resultMatch": true,
      "serverValues": [
        40403.802935,
        40501.374477,
        40935.083726
      ],
      "serverMedian": 40501.374477,
      "deviationBasis": "client",
      "deviation": 0.0131
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
        40769.747,
        40628.983,
        41237.405
      ],
      "median": 40769.747,
      "resultMatch": true,
      "serverValues": [
        40768.920226,
        40627.962311,
        41236.464809
      ],
      "serverMedian": 40768.920226,
      "deviationBasis": "client",
      "deviation": 0.0149
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 4528577595,
      "unit": "bytes"
    },
    {
      "axis": "storage_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 76584214528,
      "unit": "bytes"
    },
    {
      "axis": "compression_ratio",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 9.0536,
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
      "value": 5473220.747,
      "unit": "rows/s",
      "timedRows": 900000000,
      "insertSec": 164.437,
      "untimedChunks": []
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 2581940.759,
      "unit": "rows/s",
      "timedRows": 900000000,
      "insertSec": 348.575,
      "untimedChunks": []
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 1.8277,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 1.8571,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000000,
      "value": 3271454,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000000,
      "value": 2531328,
      "unit": "bytes"
    },
    {
      "axis": "index_bytes",
      "store": "postgresql",
      "index": "I2",
      "rows": 1000000000,
      "value": 31542476800,
      "unit": "bytes",
      "buildSec": 416.833,
      "buildWalBytes": 10211835636,
      "buildMode": "async"
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
      "resultMatch": true,
      "serverValues": [
        0.884,
        0.877,
        0.797
      ],
      "serverMedian": 0.877,
      "deviationBasis": "server",
      "deviation": 0.0992
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
      "resultMatch": true,
      "serverValues": [
        0.596,
        0.633,
        0.657
      ],
      "serverMedian": 0.633,
      "deviationBasis": "server",
      "deviation": 0.0964
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
        41094.469,
        42057.399,
        41363.371
      ],
      "median": 41363.371,
      "resultMatch": true,
      "serverValues": [
        41079.065685,
        42042.178687,
        41346.496937
      ],
      "serverMedian": 41346.496937,
      "deviationBasis": "server",
      "deviation": 0.0233
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
        41038.857,
        41854.449,
        41183.81
      ],
      "median": 41183.81,
      "resultMatch": true,
      "serverValues": [
        41038.428601,
        41853.947977,
        41183.334102
      ],
      "serverMedian": 41183.334102,
      "deviationBasis": "server",
      "deviation": 0.0198
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
        41162.471,
        41998.086,
        41796.552
      ],
      "median": 41796.552,
      "resultMatch": true,
      "serverValues": [
        41143.864644,
        41982.338561,
        41779.750644
      ],
      "serverMedian": 41779.750644,
      "deviationBasis": "server",
      "deviation": 0.0201
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
        41251.144,
        41002.245,
        41194.2
      ],
      "median": 41194.2,
      "resultMatch": true,
      "serverValues": [
        41250.560894,
        41001.677685,
        41193.77927
      ],
      "serverMedian": 41193.77927,
      "deviationBasis": "server",
      "deviation": 0.006
    }
  ],
  "pairVerdicts": [
    {
      "query": "Q1",
      "index": "I1",
      "cache": "cold",
      "chMedian": 4.0,
      "pgMedian": 1690.662,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4.428,
      "pgServerPairMedian": 1673.332917,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q1",
      "index": "I1",
      "cache": "warm",
      "chMedian": 3.0,
      "pgMedian": 969.788,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 2.847,
      "pgServerPairMedian": 968.566916,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q1",
      "index": "I2",
      "cache": "cold",
      "chMedian": 4.0,
      "pgMedian": 495.289,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4.428,
      "pgServerPairMedian": 490.579375,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q1",
      "index": "I2",
      "cache": "warm",
      "chMedian": 3.0,
      "pgMedian": 1.726,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 2.847,
      "pgServerPairMedian": 0.970625,
      "winner": "postgresql",
      "decidedBy": "client",
      "repWinners": [
        "postgresql",
        "postgresql",
        "postgresql"
      ],
      "structuralWinner": "postgresql"
    },
    {
      "query": "Q2",
      "index": "I1",
      "cache": "cold",
      "chMedian": 28.0,
      "pgMedian": 40574.464,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 27.926,
      "pgServerPairMedian": 40559.535268,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q2",
      "index": "I1",
      "cache": "warm",
      "chMedian": 7.0,
      "pgMedian": 40758.573,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 7.083,
      "pgServerPairMedian": 40757.004894,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q2",
      "index": "I2",
      "cache": "cold",
      "chMedian": 28.0,
      "pgMedian": 11472.653,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 27.926,
      "pgServerPairMedian": 11470.903047,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q2",
      "index": "I2",
      "cache": "warm",
      "chMedian": 7.0,
      "pgMedian": 54.719,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 7.083,
      "pgServerPairMedian": 54.341458,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q3",
      "index": "I1",
      "cache": "cold",
      "chMedian": 241.0,
      "pgMedian": 37035.873,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 240.808,
      "pgServerPairMedian": 37022.669268,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q3",
      "index": "I1",
      "cache": "warm",
      "chMedian": 217.0,
      "pgMedian": 35916.751,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 216.802,
      "pgServerPairMedian": 35914.688184,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q3",
      "index": "I2",
      "cache": "cold",
      "chMedian": 241.0,
      "pgMedian": 26505.514,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 240.808,
      "pgServerPairMedian": 26490.382845,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q3",
      "index": "I2",
      "cache": "warm",
      "chMedian": 217.0,
      "pgMedian": 21827.079,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 216.802,
      "pgServerPairMedian": 21824.76876,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q4",
      "index": "I1",
      "cache": "cold",
      "chMedian": 883.0,
      "pgMedian": 8900.183,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 883.505,
      "pgServerPairMedian": 8675.630503,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q4",
      "index": "I1",
      "cache": "warm",
      "chMedian": 793.0,
      "pgMedian": 7563.079,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 792.713,
      "pgServerPairMedian": 7354.965545,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q4",
      "index": "I2",
      "cache": "cold",
      "chMedian": 883.0,
      "pgMedian": 8003.555,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 883.505,
      "pgServerPairMedian": 7785.210962,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q4",
      "index": "I2",
      "cache": "warm",
      "chMedian": 793.0,
      "pgMedian": 8038.277,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 792.713,
      "pgServerPairMedian": 7837.091755,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q5",
      "index": "I1",
      "cache": "cold",
      "chMedian": 4730.0,
      "pgMedian": 42109.553,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4731.656,
      "pgServerPairMedian": 42095.642311,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q5",
      "index": "I1",
      "cache": "warm",
      "chMedian": 4608.0,
      "pgMedian": 41452.111,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4608.473,
      "pgServerPairMedian": 41451.266894,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q5",
      "index": "I2",
      "cache": "cold",
      "chMedian": 4730.0,
      "pgMedian": 40513.92,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4731.656,
      "pgServerPairMedian": 40501.374477,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    },
    {
      "query": "Q5",
      "index": "I2",
      "cache": "warm",
      "chMedian": 4608.0,
      "pgMedian": 40769.747,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4608.473,
      "pgServerPairMedian": 40768.920226,
      "winner": "clickhouse",
      "decidedBy": "client",
      "repWinners": [
        "clickhouse",
        "clickhouse",
        "clickhouse"
      ],
      "structuralWinner": "clickhouse"
    }
  ],
  "scan": [
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "readRows": 32768,
      "readBytes": 458879,
      "resultRows": 3600
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 114,
      "sharedReadBlocks": 336773,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 3600.0,
      "executionMs": 980.615,
      "nodes": [
        "Gather Merge",
        "Sort",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260926_ts_idx)"
      ]
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 3618,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 3600.0,
      "executionMs": 3.103,
      "nodes": [
        "Merge Append",
        "Index Scan(plc_tag_raw_control_p20260926_key_btree)"
      ]
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "readRows": 188416,
      "readBytes": 3694560,
      "resultRows": 28
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 7279,
      "sharedReadBlocks": 9338653,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 28.0,
      "executionMs": 39957.212,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Aggregate",
        "Sort",
        "Append",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan"
      ]
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 100399,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 28.0,
      "executionMs": 88.77,
      "nodes": [
        "Sort",
        "Aggregate",
        "Append",
        "Index Scan(plc_tag_raw_control_p20260923_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260924_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260925_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260926_key_btree)",
        "Index Scan(plc_tag_raw_control_default_key_btree)"
      ]
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "readRows": 17547264,
      "readBytes": 421134336,
      "resultRows": 200
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 91,
      "sharedReadBlocks": 8075074,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0,
      "executionMs": 35506.801,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260925_ts_idx)",
        "Seq Scan"
      ]
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7279983,
      "sharedReadBlocks": 4704053,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0,
      "executionMs": 22121.501,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Index Scan(plc_tag_raw_control_p20260925_key_btree)",
        "Seq Scan"
      ]
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 51028480,
      "readBytes": 1275712000,
      "resultRows": 600000
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 128,
      "sharedReadBlocks": 336773,
      "tempReadBlocks": 175788,
      "workersLaunched": 2,
      "actualRows": 600000.0,
      "executionMs": 8239.534,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260926_ts_idx)"
      ]
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 128,
      "sharedReadBlocks": 336773,
      "tempReadBlocks": 175923,
      "workersLaunched": 2,
      "actualRows": 600000.0,
      "executionMs": 9089.779,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260926_ts_idx)"
      ]
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "readRows": 1000000000,
      "readBytes": 8000000000,
      "resultRows": 1
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I1",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338653,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 46126.753,
      "nodes": [
        "Aggregate",
        "Gather",
        "Aggregate",
        "Append",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan"
      ]
    },
    {
      "query": "Q5",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338653,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 46304.063,
      "nodes": [
        "Aggregate",
        "Gather",
        "Aggregate",
        "Append",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan"
      ]
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
      "sharedReadBlocks": 9338653,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 47005.059,
      "nodes": [
        "Aggregate",
        "Gather",
        "Aggregate",
        "Append",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan"
      ]
    },
    {
      "query": "Q5x",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 7203,
      "sharedReadBlocks": 9338653,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 47462.229,
      "nodes": [
        "Aggregate",
        "Gather",
        "Aggregate",
        "Append",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan",
        "Seq Scan"
      ]
    }
  ],
  "overThreshold": [
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "server",
      "deviation": 0.5129
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "client",
      "deviation": 0.5
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "client",
      "deviation": 0.4967
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "client",
      "deviation": 0.3152
    },
    {
      "query": "Q1",
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "basis": "server",
      "deviation": 0.2225
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "basis": "client",
      "deviation": 0.2165
    },
    {
      "query": "Q5",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "client",
      "deviation": 0.2148
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "client",
      "deviation": 0.2005
    }
  ]
}
```
