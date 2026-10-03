# 051 — 대조군 역전 지점 격자 4단계(격자 2차 · 미래 방향 적재): 10^8행 · Q1~Q5 × ClickHouse · PostgreSQL I1 · I2 × 콜드 · 웜 (S5 · 모드 D + GEN-10)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(재측정 대상 기록 038 — 기계 판독 블록 conditions.remeasureOf) · 판정 창: 2026-09-27T04:03:31.929Z ~ 2026-09-27T04:17:20.811Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 데이터 구간 ts 2026-09-25T01:06:20Z ~ 03:53:00Z(1~3단계 10^7행 뒤에 4단계 90,000,000행) · 실행 2026-09-27 12:57~13:20 KST(원시 첫 행 budget 03:57:25Z ~ 채움 스냅샷 04:20:01Z)

격자 2차 4단계다. 격자 2차는 1차(기록 035~039 · 전부 폐기)의 재측정이다 — 1차 폐기의 한 원인(과거 방향 적재가 힙 물리 순서를 ts와 어긋나게 해 10^9에서 PostgreSQL 플래너가 BRIN을 포기한 것 · 1차 원시 상관 0.027 — 기록 039)을 러너가 **미래 방향(시간 순) 누적**으로 고쳐 없앴다(ts 상관 0.99999 — 리드 실측 · 원시 없음). 시작 시각 S = 2026-09-25T01:06:20Z(KST 10:06:20)를 고정하고 점 p의 데이터를 [S, S + D_p)로, 쿼리 기준 시각 {end}를 S + D_p로 둔다(05/10 §역전 지점 탐색 설계 "구성을 고정하고 기간으로 키운다. 시스템이 실제로 쌓이는 순서 그대로" · grid.py 머리 주석).

3단계까지 쌓인 10^7행(S ~ S + 1,000초) 뒤에 9,000초(3조각 × 3,000초 · 설비 50 × 태그 200 · 1 Hz)를 모드 D(ClickHouse tag_raw)와 GEN-10(PostgreSQL plc_tag_raw_control)으로 같은 행 벡터로 채워 두 저장소를 각각 **100,000,000행**으로 맞추고, 비 쿼리 축 5와 쿼리 축(Q1~Q5 · Q5x 보조 × 세 팔 × 콜드 · 웜 × 반복 3)을 쟀다. 설계 정본은 05_data_stores/10_olap_vs_rdb_control.md §동일 쿼리 5종 · §비교 축 6 · §역전 지점 탐색 설계다.

이 기록은 한 단계의 점과 축만 싣는다. **역전 구간은 이 기록 단독으로 판정하지 않는다** — 격자 2차 전체(단계 기록 048~052)와 로그 중점 정밀화 점 6개를 묶어 기록 053(control-refine)이 판정한다(리드 판정 9). 아래 §결과의 "앞선 쪽"은 이 단계 한 점의 우열이다 — 반복 3회 모두 같은 쪽이 앞선 점의 우열은 구조 사실로 인용할 수 있고, 반복 사이에 갈린 점은 우열 미정이라 구간의 끝점이 될 수 없다(리드 판정 12).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | **5492c73**(원시 run.commitHash — 모드 D 실행기 보고 · 격자 init git dirty true) — 1~5단계는 5492c73 + 미커밋 PGSS 스냅샷 키 수정(scripts/lab/s5/grid/grid.py 한 곳 · 러너 쿼리 경로 · 이미지 밖)으로 돌았고, 그 수정은 뒤에 커밋 c89b982로 들어갔다(리드 판정 5). dirty true는 이 수정 때문이다 — 저장소 이미지 · DDL · 모드 D 경로는 5492c73 그대로다 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)" — 도구 컨테이너 경로의 null은 상한이 없다는 사실값이다(04 §조건 칸 2026-09-27 개정 · 추정값으로 채우지 않는다) |
| 용량 티어 | **해당 없음**(원시 run.capacityTier — EXP-01~05 공통 조건 · 행 수 격자가 축) · 모드 D 보고 capacityTier는 null(datagen-d에 CAPACITY_TIER를 주지 않는다 · 원시 runNotes) · 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz · --tier M) |
| 저장소 자원(대조 자원 조건) | 대조 오버레이 infra/compose/compose.control.yml · ClickHouse cpuset 5-7 · 3,584 MiB(3,758,096,384 B) · max_threads 3 · 26.8.10.6 / PostgreSQL cpuset 8-10 · 3,584 MiB · shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · effective_cache_size 2688MB — 두 컨테이너 3 vCPU · 3.5 GiB 동일(격자 init env) · api 정지 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D 구간은 ING를 거치지 않으므로 SW-09가 적용되지 않는다(05/10 §SW-09 동시 적재) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · --control on · --rollup on · --mix mixed) + GEN-10(같은 행 벡터를 대조군에 COPY) · 42 · 혼합 |
| 내구성 | GEN-10 COPY 세션 synchronous_commit off(서버 기본 on — init env) |
| 적재 방향 | **미래 방향 누적(init direction forward)** · S = 2026-09-25T01:06:20Z · 머리 만료 2026-10-02T01:06:20Z · 4단계 데이터 전부가 KST 일 파티션 p20260925 안(KST 10:06:20 ~ 12:53:00) |
| 채우기 | 3조각 × 3,000초(chunkSec 3000 · 조각당 30,000,000행 · 구간 01:23:00Z ~ 03:53:00Z) · 조각마다 두 저장소 행 수 · 일별 3자 대조(CH · 대조군 · 롤업) 일치 · 종료 코드 0 · 미계측 조각 없음 |
| 정합(단계 ②) | 구간 6개(1~3단계 3 + 4단계 3) 전부 CH = PG · 합 100,000,000 = 공칭 · [S, end) 밖 0 · 0 · tag_1m countMerge 100,000,000 · 조각 사슬 4 → 3 → 2 → 1이 창을 덮음 · 검사 22.9초 |
| 안정화(단계 ③) | 229.2초(1회 호출) · ClickHouse 활성 파트 8 · 머지 0(3표본 연속) · PostgreSQL vacuum 진행 0 · 삽입 기준 vacuum 대기 0 · 체크포인트 13 → 16(채우기 뒤 경과) |
| 쿼리 매개 | device 1 · tag 1(사전순 첫 쌍) · end 2026-09-25T03:53:00Z · Q5 문턱 v = 58(1단계 직후 quantileExact(0.5) · 1단계 선택도 0.49599 · 원시 params) — 4단계 Q5 결과 48,495,770행 = 48.50% |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 Docker VM 안이라 비우지 않는다) · 웜 = 예열 1회 뒤 3회의 중앙값 |
| 쿼리 순서 | ClickHouse → PostgreSQL I1 → I2 빌드(**동기** · 39.9초) → PostgreSQL I2 → I2 DROP → 채움 스냅샷 · 팔마다 반복 1~3 × Q1~Q5x · 같은 점은 ClickHouse를 먼저 잰다(러너 강제) |
| 시간 원천 | 대표값 = 클라이언트 경과 — ClickHouse clickhouse-client --time(**1 ms 해상도**) · PostgreSQL psql \timing(µs · PREPARE/EXECUTE) / 서버 시간(함께 기록) — ClickHouse query_log event_time_microseconds − query_start_time_microseconds · PostgreSQL pg_stat_statements total_exec_time 증가분 / EXPLAIN(ANALYZE, BUFFERS)는 반복 1에서 따로(시간 판정에 쓰지 않는다) |
| 편차 판정 기준 | 판정 지표마다 반복 3값의 (최대 − 최소) ÷ 중앙값 · **점(쿼리 · 캐시)의 첫 ClickHouse 줄(반복 1)의 CH client 값이 10 ms 미만이면 두 저장소 모두 반복별 서버 µs 중앙값으로 판정**(06 §EXP-29~39 끝 불릿 2026-09-27 · 출처 state.json judgmentBasis(decidedAtRep 1) · query 줄 judgmentSpread.basis) — 이 단계 server 기준 점: Q1 · Q2 콜드 · 웜(Q5x 보조 포함) · 나머지 client |
| 동률 판정 | CH client 중앙값 < 10 ms이고 두 client 중앙값 차 < 1 ms(CH 해상도)인 점은 **pair 줄 서버 µs 중앙값(반복별 pair chServerMedianMs · pgServerMedianMs의 중앙값)**으로 우열을 정한다(리드 판정 2) — 이 단계 해당 점 2개(§결과 동률 판정) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(부하 실험 프로파일 기동 — 리드 실행 조건) · 재지 않음(모드 D는 생성 · 적재가 한 호출) · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱(tag_raw DDL) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| ClickHouse 서버 로그 수준(공정성 한계) | 이미지 기본 trace(config.d에 logger 없음) — text_log가 10분에 약 470만 줄 규모로 쌓인다 · 측정 중 설정을 바꾸지 않았다(리드 W6 판정 · 원시 줄 밖 사실) — 모든 ClickHouse 측정이 이 조건 위에 있다 |
| 초기 상태 · 스냅샷 | 격자 시작 전 복원 s7a-seed-m(티어 M 시드 · tag_raw 0행) · 단계 사이 복원 없음(누적 격자 — 04 §실험 한 번의 절차 예외) · 단계 끝 채움 스냅샷 lab-s5-grid-f-s4(i2-drop 뒤 · 볼륨 10,038,521,856 B · 압축 3,180,642,552 B · 158.4초 — 정밀화 r8.5 · r8.25의 복원점) |
| 예산(단계 진입 전) | 디스크 — 좌변 130,887,592,346 B ≥ 도출 11,315,929,036 B(힙 6.84 GB + btree 3.0 GB + CH 0.40 GB + WAL 여유 1.07 GB) · 시간 — 머리 만료까지 421,735초 대 추정 단계 경과 19,468초 |
| 반복 · 편차 | 쿼리 축 3회(반복마다 콜드 1 + 웜 3) · 적재 1회 · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **45.01%**(PG I2 Q1 콜드 · 서버 µs) · 기준 20% 초과 **13개** |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.py(budget · fill · check · settle · axes · query · match · i2-build · i2-drop · snapshot) · 원시 docs/measurements/raw/051-control-stage-4.jsonl(231행 — 첫 줄 격자 공통 init + point "4" 줄 230) · EXPLAIN 원문 snapshots/lab-s5-grid-f/explain/s4 · 결과 집합 snapshots/lab-s5-grid-f/results/s4 · 재계산 스크립트 .omc/lab/grid2-w-grid-b/(analyze.py · render.py · verify.py) |

- 검산: 조건 항목 = **24**
- **점 하나의 값은 반복 번호 순 3개다.** 콜드는 그 반복의 1회 값이고 웜은 그 반복 안 3회의 중앙값이다. 대표값은 세 값의 중앙값이다.
- **원시 · 본문에서 뺀 줄** — grid.jsonl 줄 2205 · 2446(0부터 센 번호 · kind restore · point "4" · 08:22:52Z · 08:57:03Z)은 정밀화 r8.5 · r8.25가 lab-s5-grid-f-s4를 복원한 base 복원 줄이라 053에만 넣는다(리드 판정 11 — 단계 기록은 자기 단계 채움 · 측정 줄만).

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms · 비는 중앙값끼리. ClickHouse 값은 1 ms 해상도라 정수다. ‡는 동률 점을 서버 µs로 판정한 칸이다(§동률 판정).

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 4 · 3) | **635.935**(627.614 · 635.935 · 642.520) | **2.067**(2.126 · 2.050 · 2.067) | PG I2‡ | 212.0 | 0.69 |
| Q2 단일 태그 7일 | **4**(5 · 4 · 4) | **1,129.899**(1,456.737 · 1,129.899 · 1,125.477) | **3.913**(3.749 · 3.913 · 5.031) | PG I2‡ | 282.5 | 0.98 |
| Q3 설비 전체 1일 | **34**(34 · 41 · 32) | **1,198.678**(1,198.678 · 1,196.685 · 1,199.224) | **302.158**(301.240 · 302.158 · 302.296) | CH | 35.26 | 8.89 |
| Q4 분 단위 롤업 재계산 | **830**(809 · 830 · 866) | **10,670.536**(11,210.601 · 10,670.536 · 9,465.040) | **10,995.269**(11,003.153 · 10,705.707 · 10,995.269) | CH | 12.86 | 13.25 |
| Q5 비정렬 열 조건 count | **472**(490 · 464 · 472) | **1,414.243**(1,414.243 · 1,391.561 · 1,434.263) | **1,381.121**(1,381.121 · 1,363.071 · 1,392.577) | CH | 3.00 | 2.93 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **1,173.955**(1,191.800 · 1,142.935 · 1,173.955) | **1,159.263**(1,198.555 · 1,159.263 · 1,141.931) | CH(비교 대상 아님) | 1,174.0 | 1,159.3 |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다(재기동 뒤 대기 1.2~1.3초). 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 가장 빠른 쪽 | I1 ÷ CH | I2 ÷ CH |
|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **5**(5 · 5 · 6) | **739.886**(769.623 · 730.188 · 739.886) | **16.441**(23.115 · 15.703 · 16.441) | CH | 148.0 | 3.29 |
| Q2 단일 태그 7일 | **7**(7 · 5 · 7) | **1,138.655**(1,567.660 · 1,131.837 · 1,138.655) | **39.787**(54.916 · 38.602 · 39.787) | CH | 162.7 | 5.68 |
| Q3 설비 전체 1일 | **32**(32 · 29 · 39) | **1,219.245**(1,219.521 · 1,216.318 · 1,219.245) | **401.743**(493.210 · 400.023 · 401.743) | CH | 38.10 | 12.55 |
| Q4 분 단위 롤업 재계산 | **909**(870 · 909 · 935) | **10,869.381**(10,869.381 · 9,204.116 · 13,218.696) | **9,504.295**(9,504.295 · 9,093.619 · 11,248.158) | CH | 11.96 | 10.46 |
| Q5 비정렬 열 조건 count | **478**(428 · 488 · 478) | **1,410.034**(1,513.285 · 1,410.034 · 1,377.360) | **1,420.776**(1,555.934 · 1,420.776 · 1,383.043) | CH | 2.95 | 2.97 |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **1,154.528**(1,131.519 · 1,154.528 · 1,188.369) | **1,209.324**(1,199.682 · 1,214.911 · 1,209.324) | CH(비교 대상 아님) | 1,154.5 | 1,209.3 |

### 변형별 앞선 쪽(이 단계 한 점)

ClickHouse는 변형이 없어 두 PostgreSQL 변형과 각각 짝짓는다. 중앙값 판정의 원천은 점 대표값(client 중앙값)이고 동률 점만 pair 서버 µs 중앙값이다(리드 판정 2). 반복별 부호는 pair 줄마다의 우열이다 — 그 반복의 tieWithinResolution이 true면 서버 µs(ˢ 표시) · 아니면 client로 가른다. 세 반복이 같으면 구조 우열(3/3 · 리드 판정 12)이다.

| 쿼리 | PG 변형 | 웜 — 중앙값 판정(원천) | 웜 — 반복별 부호 · 구조 우열 | 콜드 — 중앙값 판정(원천) | 콜드 — 반복별 부호 · 구조 우열 |
|------|------|------|------|------|------|
| Q1 | I1 | CH(client 3 대 635.935) | CH CH CH → **CH 3/3** | CH(client 5 대 739.886) | CH CH CH → **CH 3/3** |
| Q1 | I2 | **PG I2**(동률 → 서버 µs 3.378 대 1.221) | PG I2ˢ PG I2 PG I2ˢ → **PG I2 3/3** | CH(client 5 대 16.441) | CH CH CH → **CH 3/3** |
| Q2 | I1 | CH(client 4 대 1,129.899) | CH CH CH → **CH 3/3** | CH(client 7 대 1,138.655) | CH CH CH → **CH 3/3** |
| Q2 | I2 | **PG I2**(동률 → 서버 µs 4.277 대 3.660) | PG I2 PG I2ˢ CH → **미정**(반복 사이 갈림) | CH(client 7 대 39.787) | CH CH CH → **CH 3/3** |
| Q3 | I1 | CH(client 34 대 1,198.678) | CH CH CH → **CH 3/3** | CH(client 32 대 1,219.245) | CH CH CH → **CH 3/3** |
| Q3 | I2 | CH(client 34 대 302.158) | CH CH CH → **CH 3/3** | CH(client 32 대 401.743) | CH CH CH → **CH 3/3** |
| Q4 | I1 | CH(client 830 대 10,670.536) | CH CH CH → **CH 3/3** | CH(client 909 대 10,869.381) | CH CH CH → **CH 3/3** |
| Q4 | I2 | CH(client 830 대 10,995.269) | CH CH CH → **CH 3/3** | CH(client 909 대 9,504.295) | CH CH CH → **CH 3/3** |
| Q5 | I1 | CH(client 472 대 1,414.243) | CH CH CH → **CH 3/3** | CH(client 478 대 1,410.034) | CH CH CH → **CH 3/3** |
| Q5 | I2 | CH(client 472 대 1,381.121) | CH CH CH → **CH 3/3** | CH(client 478 대 1,420.776) | CH CH CH → **CH 3/3** |

- 검산: 판정 칸 = 쿼리 5 × 변형 2 × 캐시 2 = **20** — 중앙값 판정 ClickHouse 앞 18 + PostgreSQL I2 앞 2(Q1 · Q2 웜 — 둘 다 동률 점) / 구조 우열 3/3 **19**(ClickHouse 18 + PostgreSQL I2 1 — Q1 웜) + 미정 **1**(Q2 I2 웜 — 반복별 PG · PG · CH)

### 동률 판정

| 점 | CH client 중앙값 | PG client 중앙값 | 차 | 반복별 pair tieWithinResolution | pair 서버 µs 중앙값(CH 대 PG) | 판정 |
|------|------|------|------|------|------|------|
| Q1 I2 웜 | 3 | 2.067 | 0.933 | T · F · T | 3.378 대 1.221 | **동률 점 → PG I2** |
| Q2 I2 웜 | 4 | 3.913 | 0.087 | F · T · F | 4.277 대 3.660 | **동률 점 → PG I2** |

- 검산: 동률 점 = **2** · 반복별 pair 줄 tieWithinResolution true = 3줄(Q1 I2 웜 반복 1 · 3 · Q2 I2 웜 반복 2) / 60줄
- **서버 시간 비대칭(한계 · 원시 conditions.serverTimeAsymmetry)** — PostgreSQL 서버 값은 pg_stat_statements total_exec_time이라 계획 시간이 빠지고(track_planning off · 준비된 문장의 custom plan 계획 포함), ClickHouse 서버 값은 query_log 시작 ~ 끝이라 파싱 · 분석 · 계획 · 결과 전송이 들어간다. 서버 µs 비교는 PostgreSQL 쪽으로 기운다. 두 동률 점에서 그 크기는 반복 1 EXPLAIN의 planningMs(Q1 I2 0.967 ms · Q2 I2 1.013 ms)로 가늠된다 — Q1 I2 웜은 계획 시간을 더해도(1.221 + 0.967 = 2.188 ms) CH 3.378 ms보다 작고 client 우열도 세 반복 모두 PG다. **Q2 I2 웜은 계획 시간을 더하면(3.660 + 1.013 = 4.673 ms) CH 4.277 ms를 넘어 우열이 뒤집힐 수 있다** — client 차 0.087 ms와 함께, 이 점의 PG I2 우세는 해상도 안의 중앙값 판정이다. **반복별 부호는 PG(client 3.749 대 5) · PG(서버 µs 3.660 대 3.990) · CH(client 5.031 대 4)로 갈려 구조 우열은 미정이다**(리드 판정 12) — 이 점은 Q2 웜 구조 구간의 끝점이 될 수 없고, 053은 중앙값 구간 (10^8, 10^8.25]을 참고로 · 구조 구간 (10^7.5, 10^8.25]를 인용 구간으로 싣는다.
- 이 단계 콜드에는 동률 점이 없다 — client만으로 판정해도 콜드 우열이 같다(리드 판정 12의 client 전용 판정 차는 1~3단계 · 정밀화 점의 일이다).

### 결과 동일성

- 결과 대조(match) 6/6 true — Q1 3,600행 · Q2 3버킷(avg 차 ÷ 상계 최대 0.0044) · Q3 200태그(0.0026) · Q4 600,000그룹(0.0667 · bad_cnt 정확 · 롤업 대조 일치 · 불일치 그룹 0) · Q5 48,495,770 = 48,495,770 · Q5x 100,000,000 = 100,000,000.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_bytes는 비압축)다. 공통 논리 크기는 행 수 × 41 B = 4,100,000,000 B다. PostgreSQL은 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 최상위 노드 shared hit + read(블록 8,192 B)이고 힙 main은 934,604블록(7,656,275,968 B)이다. 버퍼 적중은 접근 횟수라 같은 페이지를 여러 번 방문하면 힙 블록 수를 넘는다(Q3 I2 214.8%). 인덱스 이름은 plc_tag_raw_control_ 접두 · 접미를 줄였다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 40,960(0.04%) | 569,520(0.01% · 13.9 B) | 337,204(hit 72 · read 337,132 · 36.1%) · Gather Merge · Sort · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260925) · 작업자 2 | 3,618(hit 3,618 · read 0 · 0.4%) · Merge Append · Index Scan(p20260925) · 작업자 0 | 3,600 |
| Q2 | 57,344(0.06%) | 808,128(0.02% · 14.1 B) | 934,680(hit 4,399 · read 930,281 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan × 4 · 작업자 2 | 10,051(hit 10,051 · read 0 · 1.1%) · Sort · Aggregate · Append · Index Scan(p20260923) · Index Scan(p20260924) · Index Scan(p20260925) · Index Scan(default) · 작업자 0 | 3 |
| Q3 | 2,031,616(2.03%) | 48,700,800(1.19% · 24.0 B) | 934,618(hit 4,337 · read 930,281 · 100.0%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Seq Scan × 2 · 작업자 2 | 2,007,740(hit 2,007,740 · read 0 · 214.8%) · Aggregate · Gather Merge · Sort · Aggregate · Append · Index Scan(p20260925) · Index Scan(p20260924) · 작업자 2 | 200 |
| Q4 | 60,000,000(60.00%) | 1,500,000,000(36.59% · 25.0 B) | 337,148(hit 16 · read 337,132 · temp 153,451 · 36.1%) · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260925) · 작업자 0 | 337,148(hit 16 · read 337,132 · temp 153,451 · 36.1%) · Aggregate · Append · Bitmap Heap Scan · Bitmap Index Scan(p20260925) · 작업자 0 | 600,000 |
| Q5 | 100,000,000(100.00%) | 800,000,000(19.51% · 8.0 B) | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 934,604(hit 4,323 · read 930,281 · 100.0%) · Aggregate · Gather · Aggregate · Append · Seq Scan × 10 · 작업자 2 | 1 |

- 검산: 쿼리 = **6**

### 비 쿼리 축

| 축 | ClickHouse | PostgreSQL I1 | PostgreSQL I2 | 비고 |
|------|------:|------:|------:|------|
| 저장 용량(bytes) | 440,122,785(활성 파트 8 · Wide) | 7,659,085,824(힙 7,658,348,544 · 인덱스 737,280) | — | 행당 4.40 B 대 76.59 B(PG ÷ CH **17.4배**) · 도출 약 7.6 GB와 일치 |
| 압축률 | 9.316 | 0.5354 | — | 공통 논리 41 B × 10^8 ÷ 분모(CH bytes_on_disk · PG pg_table_size) |
| 삽입 처리량(rows/s) | 5,948,840(90,000,000행 · 15.129초) | 3,337,908(90,000,000행 · COPY 26.963초) | — | 단계 증가분 단독 적재 · 조각별 CH 5.85~6.04M · PG 3.32~3.36M · CH ÷ PG 1.78배 |
| 쓰기 증폭 | 0.965(머지 쓰기 381,724,195 ÷ 새 파트 395,570,580 · 새 파트 24 · 머지 4) | 1.797(WAL 6,629,623,964 ÷ 90,000,000 × 41 B · LSN 차 6,654,568,552 · FPI 1,374,754 · autovacuum 1 · autoanalyze 1) | — | 창 = 단계 채우기 시작 ~ 안정화 뒤 축 채취 |
| 인덱스 크기(bytes) | 253,611(기본 키 97,744 + 마크 155,867) | 491,520(BRIN(ts)) | 3,154,337,792(btree · 행당 31.5 B) | I2 빌드 39.912초(동기 · p20260925 한 파티션 39.9초) · 빌드 WAL 1,020,762,514 B |

- 검산: 축 = **5** · axes 행 = 5 × 2 + I2 1 = **11**
- 저장 용량 PostgreSQL의 인덱스 737,280 B는 빈 파티션까지 포함한 전 파티션 인덱스 합이고, 인덱스 크기 축 BRIN 491,520 B는 러너가 BRIN만 센 값이다(원시 두 줄의 원천 차 · 값 칸은 원시 그대로).

## 해석

- **Q1 · Q2 웜은 10^8에서 중앙값으로 PostgreSQL I2가 해상도 안에서 앞선다 — 판정은 서버 µs가 한다(구조 우열은 Q1 I2 3/3 · Q2 미정).** Q1 I2 웜은 client 2.067 ms 대 CH 3 ms(차 0.933 ms)라 해상도 안이고 서버 µs 1.221 대 3.378 ms로 I2 앞이다. btree 탐색 + 힙 3,618블록(행 3,600 · 전부 적중)이 테이블 크기와 무관한 고정 비용이라서다 — Q1은 창이 1시간이라 4단계부터 태그 행이 3,600으로 고정된다. Q2 I2 웜은 client 3.913 대 4 ms(차 0.087 ms) · 서버 µs 중앙값 3.660 대 4.277 ms로 중앙값 판정은 I2 앞이지만 반복 사이 우열이 갈려 구조 우열은 미정이고, §동률 판정의 비대칭 불릿대로 계획 시간을 넣으면 뒤집힐 수 있는 크기다. Q1 I2 웜은 세 반복 모두 I2 앞(구조 3/3)이다. Q2 I2는 10,000행에 10,051블록(행당 1페이지 — 같은 태그의 다음 초가 다른 페이지에 있다)이라 행이 늘면 비용이 행 수에 비례해 는다 — 5단계(기록 052)에서 이 차가 벌어진다.
- **콜드에서는 Q1 · Q2 모두 ClickHouse가 앞선다.** Q1 I2 콜드 16.441 ms · Q2 I2 콜드 39.787 ms 대 CH 5 · 7 ms다. 콜드는 shared_buffers가 빈 상태라 I2의 행당 페이지가 전부 버퍼 밖 읽기가 된 것으로 읽힌다(콜드 버퍼 원시 없음 · 콜드 근사 — 07_measurement_limits).
- **Q3 설비 전체는 ClickHouse가 두 변형 모두에 앞선다.** 정렬 키 접두(device_id)로 설비 1 구간만 읽고(2,031,616행 · 48.7 MB) I2는 btree 접두로 찾되 plain Index Scan이 2,000,000행에 2,007,740블록 적중(행당 1페이지)이라 302 ms 대 34 ms다. I1은 BRIN이 설비 조건을 거르지 못해 힙 전체를 Seq Scan한다(930,281블록 읽기).
- **Q4 · Q5는 ClickHouse가 10배 · 3배 앞선다.** Q4는 두 변형 계획이 같다(BRIN 비트맵 · 337,132블록 · 작업자 0 · temp 153,451블록) — device · tag 조건이 없어 btree가 쓰이지 않는다. 이 단계 Q4 계획은 병렬 작업자 0이다(5단계는 2 — 기록 052 §해석). ClickHouse Q4는 1시간 창(36,000,000행 · 36%)에 60,000,000행을 읽었다 — ts가 정렬 키 셋째 열이라 그래뉼 가지치기가 창 경계에서 느슨하다. Q5에서 ClickHouse는 value 열만 읽고(800 MB 비압축 · 행당 8 B) PostgreSQL은 힙 전체(930,281블록)를 읽는다.
- **비 쿼리 축 — PostgreSQL이 앞선 칸의 대가.** Q1 · Q2 웜의 수 ms를 사는 btree가 3.15 GB(행당 31.5 B)이고 빌드 39.9초 · WAL 1.02 GB다. 저장 용량 17.4배 · 삽입 1.78배로 ClickHouse가 앞선다. 쓰기 증폭은 ClickHouse 머지 0.965 · PostgreSQL WAL 1.797이다.
- **한계** — ① 콜드는 근사다(07_measurement_limits) ② ClickHouse client 시간은 1 ms 해상도 — 10 ms 미만 점은 서버 µs로 편차와 동률을 판정했고, 서버 시간은 두 엔진이 같은 구간을 재지 않는다(serverTimeAsymmetry) ③ 쿼리 매개가 한 쌍(device 1 · tag 1)이다 ④ 자원이 3 vCPU · 3.5 GiB다 — 우열은 이 자원 조건의 값이다 ⑤ ClickHouse 서버 로그 수준 trace(공정성 한계 — 조건 칸) ⑥ 역전 구간은 이 기록 단독으로 판정하지 않는다(053).

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 13개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded · 리드 판정 3).** 크기 수치(ms · 배수 · 바이트)는 정본에 인용하지 않고 구조 사실만 인용할 수 있다(리드 판정 13) — 우열 3/3(판정 칸 19개 · §결과 변형별 앞선 쪽) · 인덱스 선택과 계획 노드 · 읽은 행 수 · 결과 일치 · 정합. 편차 기준 열이 서버 µs인 칸은 06 확장 불릿(CH < 10 ms 점)에 따른 것이다.

| 판정 지표 | 편차 기준 | 반복 1 · 2 · 3 | 편차 | 최댓값 반복 |
|------|------|------|------|------|
| PG I2 Q1 콜드 | 서버 µs | 20.321 · 13.770 · 14.554 | 45.01% | 1 |
| PG I2 Q2 콜드 | 서버 µs | 53.719 · 37.083 · 38.153 | 43.60% | 1 |
| PG I1 Q2 콜드 | 서버 µs | 1,557.982 · 1,121.202 · 1,127.914 | 38.72% | 1 |
| PG I1 Q4 콜드 | client | 10,869.381 · 9,204.116 · 13,218.696 | 36.93% | 3 |
| CH Q3 콜드 | client | 32 · 29 · 39 | 31.25% | 3 |
| PG I2 Q2 웜 | 서버 µs | 3.508 · 3.660 · 4.595 | 29.70% | 3 |
| PG I1 Q2 웜 | 서버 µs | 1,455.939 · 1,129.083 · 1,124.627 | 29.34% | 1 |
| CH Q2 콜드 | 서버 µs | 6.679 · 5.160 · 7.099 | 29.03% | 3 |
| CH Q3 웜 | client | 34 · 41 · 32 | 26.47% | 2 |
| CH Q2 웜 | 서버 µs | 5.102 · 3.990 · 4.277 | 26.00% | 1 |
| CH Q1 콜드 | 서버 µs | 4.881 · 4.780 · 5.947 | 23.91% | 3 |
| PG I2 Q3 콜드 | client | 493.210 · 400.023 · 401.743 | 23.20% | 1 |
| PG I2 Q4 콜드 | client | 9,504.295 · 9,093.619 · 11,248.158 | 22.67% | 3 |

- 검산: 초과 = **13** — 콜드 9 · 웜 4 / 서버 µs 기준 8 · client 기준 5 / 최댓값이 반복 1인 칸 6
- **초과의 성격 — 콜드가 13개 중 9개다.** PG I1 Q2는 반복 1이 콜드 · 웜 모두 나머지 두 반복의 약 1.3배(웜 1,456.737 대 1,129.899 · 1,125.477 ms)다 — 반복 1 PG I1 줄들은 04:05:24Z 무렵 ClickHouse 팔 직후에 돌았고, 원인은 원시로 가르지 않았다. 서버 µs 기준 칸 중 CH Q1 콜드 · CH Q2 콜드 · 웜 · PG I2 Q2 웜은 값이 3~7 ms라 1 ms 안팎의 흔들림이 20%를 넘는다. 순간값 · 양자화 값은 판정 지표 30에 없다 — 격자 판정 지표는 쿼리 시간뿐이고 CH 1 ms 양자화는 서버 µs 기준으로 이미 뺐다.
- **반복 안 편차(참고)** — 러너 query 줄의 judgmentSpread.value는 한 반복 안 웜 3회의 편차다. 04의 편차는 반복 사이의 값이므로 폐기 판정은 위 표(반복 3값)로 했고 줄 값은 참고로만 원시에 둔다.
- **중복 줄 없음** — 같은 (점 · 저장소 · 인덱스 · 반복 · 쿼리 · 캐시) query 줄은 각 1줄(108줄 = 6 × 3 × 3 × 2)이고 pair 줄도 (쿼리 · 변형 · 캐시 · 반복)마다 1줄(72줄)이다. 1단계의 PGSS 키 결함(PG 서버 시간 null · 리드 판정 4)은 이 단계에 없다 — PostgreSQL query 줄 72개의 서버 값이 전부 있다.
- 불성립 구조 판정 없음 — 단계 ② 정합 · 결과 대조 6/6 · 롤업 대조 일치.
- **4요소 중 메모리 상한이 null이다.** 도구 컨테이너 경로라 run.memoryLimitSource를 함께 실었다(04 §조건 칸 2026-09-27 개정 — 공백이 아닌 memoryLimitSource가 있으면 4요소 충족). 대조 메모리는 conditions.controlMemoryMb(3,584 · 3,584)에 따로 적었다. 상태가 discarded라 BFF 판독 규칙 3에서 먼저 빠진다.
- **정정 관계** — 기록 038(격자 1차 4단계)은 discarded 그대로다. 이 기록은 폐기 뒤 러너를 고쳐(미래 방향 적재 · ClickHouse 서버 µs 병기 · 정밀화) 다시 잰 새 기록이다(04 §반복과 폐기 폐기 후 행). supersedes는 잘못 적은 기록을 정정할 때의 칸이라 null로 두고 재측정 관계는 conditions.remeasureOf "038"에 적는다(기록 030 선례).

## 정본 반영

없음 — status discarded다. 역전 구간 판정과 정본 반영 계획은 기록 053이 갖는다. 제안(리드 판정 대상) — ① 격자 2차 단계 기록이 다시 편차로 폐기됐고 초과의 다수가 콜드다 — 04 §반복과 폐기에 콜드 반복(재기동 직후 1회)의 편차 처리 조항 검토 ② 러너가 2차에서 pg_stats ts 상관을 채취하지 않는다(1차는 kind observation) — 미래 방향 적재의 효과를 계획 외 원시로 확인할 수 있게 axes 단계에 채취를 넣는다.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이다. 점마다 serverValues · serverMedian(서버 시간) · deviationBasis · deviation(반복 사이 편차)을 더했고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 변형별 우열은 pairVerdicts에 · 읽은 양은 scan에 · 초과 지표는 overThreshold에 둔다(판독 규칙 7 — 모르는 필드는 무시).

```json
{
  "schema": "measurement/v1",
  "record": "051",
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
    "start": "2026-09-27T04:03:31.929Z",
    "end": "2026-09-27T04:17:20.811Z"
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
    "gridStage": 4,
    "gridRows": 100000000,
    "tierConfig": "device50-tag200-1hz",
    "snapshot": "s7a-seed-m",
    "direction": "forward",
    "gridStart": "2026-09-25T01:06:20.000Z",
    "dataEnd": "2026-09-25T03:53:00.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:06:20.000Z",
      "end": "2026-09-25T03:53:00.000Z"
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
    "i2BuildMode": "sync",
    "cacheDefinition": "cold = first run right after restarting both store containers (approx, OS page cache not dropped) · warm = 1 warm-up then 3 runs, rep value = median of 3",
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE (µs) · server: CH query_log µs · PG pg_stat_statements total_exec_time delta",
    "serverTimeAsymmetry": "서버 시간은 두 엔진이 같은 구간을 재지 않는다 — PostgreSQL: pg_stat_statements total_exec_time(실행만 · track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse: query_log query_start_time_microseconds ~ event_time_microseconds(파싱 · 분석 · 계획 포함 · 결과 전송 포함)",
    "deviationRule": "deviation across 3 reps = (max-min)/median · basis fixed per (query, cache) by the first CH line (source: state.json judgmentBasis decidedAtRep 1 · query line judgmentSpread.basis): CH client median < 10 ms -> server µs for both stores · else client",
    "tieRule": "tie point = CH client median < 10 ms and |CH - PG| client median diff < 1 ms (pair tieWithinResolution at point level) -> winner by median of per-rep pair server medians",
    "structuralRule": "per-rep sign from pair lines (server medians for reps with tieWithinResolution true, else client medians) · same winner in 3/3 reps = structural fact (lead decision 12) · split = undetermined, cannot be an interval endpoint",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "fillChunks": 3,
    "fillChunkSec": 3000,
    "settledAt": "2026-09-27T04:03:24.907Z",
    "runnerDirty": true,
    "runnerNote": "stages 1-5 ran on 5492c73 + uncommitted PGSS snapshot key fix in grid.py (runner query path, outside image) — committed later as c89b982",
    "clickhouseServerLogLevel": "image default trace (no logger in config.d) — text_log grows ~4.7M lines per 10 min; not changed during measurement (lead W6)",
    "untimedFillChunks": [],
    "remeasureOf": "038",
    "remeasureNote": "038 discarded (grid 1st pass: backward fill broke BRIN correlation, CH 1 ms resolution) — remeasured with forward fill, CH server µs, refine; supersedes not used for discarded records"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.4501,
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
        5.0,
        5.0,
        6.0
      ],
      "median": 5.0,
      "resultMatch": true,
      "serverValues": [
        4.881,
        4.78,
        5.947
      ],
      "serverMedian": 4.881,
      "deviationBasis": "server",
      "deviation": 0.2391
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
        4.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": true,
      "serverValues": [
        3.378,
        3.76,
        3.15
      ],
      "serverMedian": 3.378,
      "deviationBasis": "server",
      "deviation": 0.1806
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
        769.623,
        730.188,
        739.886
      ],
      "median": 739.886,
      "resultMatch": true,
      "serverValues": [
        759.540583,
        718.96875,
        728.454751
      ],
      "serverMedian": 728.454751,
      "deviationBasis": "server",
      "deviation": 0.0557
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
        627.614,
        635.935,
        642.52
      ],
      "median": 635.935,
      "resultMatch": true,
      "serverValues": [
        626.617999,
        634.970834,
        641.414291
      ],
      "serverMedian": 634.970834,
      "deviationBasis": "server",
      "deviation": 0.0233
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
        23.115,
        15.703,
        16.441
      ],
      "median": 16.441,
      "resultMatch": true,
      "serverValues": [
        20.320832,
        13.769542,
        14.554084
      ],
      "serverMedian": 14.554084,
      "deviationBasis": "server",
      "deviation": 0.4501
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
        2.126,
        2.05,
        2.067
      ],
      "median": 2.067,
      "resultMatch": true,
      "serverValues": [
        1.317792,
        1.202459,
        1.221
      ],
      "serverMedian": 1.221,
      "deviationBasis": "server",
      "deviation": 0.0945
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
        7.0,
        5.0,
        7.0
      ],
      "median": 7.0,
      "resultMatch": true,
      "serverValues": [
        6.679,
        5.16,
        7.099
      ],
      "serverMedian": 6.679,
      "deviationBasis": "server",
      "deviation": 0.2903
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
        5.0,
        4.0,
        4.0
      ],
      "median": 4.0,
      "resultMatch": true,
      "serverValues": [
        5.102,
        3.99,
        4.277
      ],
      "serverMedian": 4.277,
      "deviationBasis": "server",
      "deviation": 0.26
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
        1567.66,
        1131.837,
        1138.655
      ],
      "median": 1138.655,
      "resultMatch": true,
      "serverValues": [
        1557.98225,
        1121.202,
        1127.914458
      ],
      "serverMedian": 1127.914458,
      "deviationBasis": "server",
      "deviation": 0.3872
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
        1456.737,
        1129.899,
        1125.477
      ],
      "median": 1129.899,
      "resultMatch": true,
      "serverValues": [
        1455.939167,
        1129.083418,
        1124.626917
      ],
      "serverMedian": 1129.083418,
      "deviationBasis": "server",
      "deviation": 0.2934
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
        54.916,
        38.602,
        39.787
      ],
      "median": 39.787,
      "resultMatch": true,
      "serverValues": [
        53.719208,
        37.083417,
        38.15275
      ],
      "serverMedian": 38.15275,
      "deviationBasis": "server",
      "deviation": 0.436
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
        3.749,
        3.913,
        5.031
      ],
      "median": 3.913,
      "resultMatch": true,
      "serverValues": [
        3.507916,
        3.660249,
        4.594917
      ],
      "serverMedian": 3.660249,
      "deviationBasis": "server",
      "deviation": 0.297
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
        32.0,
        29.0,
        39.0
      ],
      "median": 32.0,
      "resultMatch": true,
      "serverValues": [
        32.334,
        29.381,
        39.27
      ],
      "serverMedian": 32.334,
      "deviationBasis": "client",
      "deviation": 0.3125
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
        34.0,
        41.0,
        32.0
      ],
      "median": 34.0,
      "resultMatch": true,
      "serverValues": [
        34.173,
        41.544,
        32.266
      ],
      "serverMedian": 34.173,
      "deviationBasis": "client",
      "deviation": 0.2647
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
        1219.521,
        1216.318,
        1219.245
      ],
      "median": 1219.245,
      "resultMatch": true,
      "serverValues": [
        1210.155917,
        1205.875292,
        1208.91275
      ],
      "serverMedian": 1208.91275,
      "deviationBasis": "client",
      "deviation": 0.0026
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
        1198.678,
        1196.685,
        1199.224
      ],
      "median": 1198.678,
      "resultMatch": true,
      "serverValues": [
        1197.730626,
        1195.915417,
        1198.386792
      ],
      "serverMedian": 1197.730626,
      "deviationBasis": "client",
      "deviation": 0.0021
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
        493.21,
        400.023,
        401.743
      ],
      "median": 401.743,
      "resultMatch": true,
      "serverValues": [
        479.473417,
        388.626999,
        390.724293
      ],
      "serverMedian": 390.724293,
      "deviationBasis": "client",
      "deviation": 0.232
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
        301.24,
        302.158,
        302.296
      ],
      "median": 302.158,
      "resultMatch": true,
      "serverValues": [
        300.340417,
        301.322626,
        301.474
      ],
      "serverMedian": 301.322626,
      "deviationBasis": "client",
      "deviation": 0.0035
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
        870.0,
        909.0,
        935.0
      ],
      "median": 909.0,
      "resultMatch": true,
      "serverValues": [
        870.011,
        908.618,
        935.227
      ],
      "serverMedian": 908.618,
      "deviationBasis": "client",
      "deviation": 0.0715
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
        809.0,
        830.0,
        866.0
      ],
      "median": 830.0,
      "resultMatch": true,
      "serverValues": [
        809.417,
        830.108,
        866.41
      ],
      "serverMedian": 830.108,
      "deviationBasis": "client",
      "deviation": 0.0687
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
        10869.381,
        9204.116,
        13218.696
      ],
      "median": 10869.381,
      "resultMatch": true,
      "serverValues": [
        10636.387754,
        8969.016338,
        12960.853506
      ],
      "serverMedian": 10636.387754,
      "deviationBasis": "client",
      "deviation": 0.3693
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
        11210.601,
        10670.536,
        9465.04
      ],
      "median": 10670.536,
      "resultMatch": true,
      "serverValues": [
        10981.097089,
        10444.027088,
        9242.129379
      ],
      "serverMedian": 10444.027088,
      "deviationBasis": "client",
      "deviation": 0.1636
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
        9504.295,
        9093.619,
        11248.158
      ],
      "median": 9504.295,
      "resultMatch": true,
      "serverValues": [
        9270.669421,
        8858.989878,
        11013.435254
      ],
      "serverMedian": 9270.669421,
      "deviationBasis": "client",
      "deviation": 0.2267
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
        11003.153,
        10705.707,
        10995.269
      ],
      "median": 10995.269,
      "resultMatch": true,
      "serverValues": [
        10773.781588,
        10486.64867,
        10773.068586
      ],
      "serverMedian": 10773.068586,
      "deviationBasis": "client",
      "deviation": 0.0271
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
        428.0,
        488.0,
        478.0
      ],
      "median": 478.0,
      "resultMatch": true,
      "serverValues": [
        428.024,
        487.97,
        477.777
      ],
      "serverMedian": 477.777,
      "deviationBasis": "client",
      "deviation": 0.1255
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
        490.0,
        464.0,
        472.0
      ],
      "median": 472.0,
      "resultMatch": true,
      "serverValues": [
        490.404,
        464.169,
        471.902
      ],
      "serverMedian": 471.902,
      "deviationBasis": "client",
      "deviation": 0.0551
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
        1513.285,
        1410.034,
        1377.36
      ],
      "median": 1410.034,
      "resultMatch": true,
      "serverValues": [
        1502.330876,
        1399.328042,
        1365.913959
      ],
      "serverMedian": 1399.328042,
      "deviationBasis": "client",
      "deviation": 0.0964
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
        1414.243,
        1391.561,
        1434.263
      ],
      "median": 1414.243,
      "resultMatch": true,
      "serverValues": [
        1413.511043,
        1390.855709,
        1433.498126
      ],
      "serverMedian": 1413.511043,
      "deviationBasis": "client",
      "deviation": 0.0302
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
        1555.934,
        1420.776,
        1383.043
      ],
      "median": 1420.776,
      "resultMatch": true,
      "serverValues": [
        1544.541001,
        1409.342376,
        1371.621001
      ],
      "serverMedian": 1409.342376,
      "deviationBasis": "client",
      "deviation": 0.1217
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
        1381.121,
        1363.071,
        1392.577
      ],
      "median": 1381.121,
      "resultMatch": true,
      "serverValues": [
        1380.360793,
        1362.262918,
        1391.758126
      ],
      "serverMedian": 1380.360793,
      "deviationBasis": "client",
      "deviation": 0.0214
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 440122785,
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
      "value": 9.3156,
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
      "value": 5948839.976,
      "unit": "rows/s",
      "timedRows": 90000000,
      "insertSec": 15.129,
      "untimedChunks": []
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 3337907.503,
      "unit": "rows/s",
      "timedRows": 90000000,
      "insertSec": 26.963,
      "untimedChunks": []
    },
    {
      "axis": "write_amplification",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 0.965,
      "unit": "ratio"
    },
    {
      "axis": "write_amplification",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000000,
      "value": 1.7966,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000000,
      "value": 253611,
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
      "unit": "bytes",
      "buildSec": 39.912,
      "buildWalBytes": 1020762514,
      "buildMode": "sync"
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
      "resultMatch": true,
      "serverValues": [
        0.698,
        0.791,
        0.714
      ],
      "serverMedian": 0.714,
      "deviationBasis": "server",
      "deviation": 0.1303
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
      "resultMatch": true,
      "serverValues": [
        0.613,
        0.638,
        0.589
      ],
      "serverMedian": 0.613,
      "deviationBasis": "server",
      "deviation": 0.0799
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
        1131.519,
        1154.528,
        1188.369
      ],
      "median": 1154.528,
      "resultMatch": true,
      "serverValues": [
        1121.611293,
        1143.747168,
        1178.017418
      ],
      "serverMedian": 1143.747168,
      "deviationBasis": "server",
      "deviation": 0.0493
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
        1191.8,
        1142.935,
        1173.955
      ],
      "median": 1173.955,
      "resultMatch": true,
      "serverValues": [
        1191.408625,
        1142.547834,
        1173.581208
      ],
      "serverMedian": 1173.581208,
      "deviationBasis": "server",
      "deviation": 0.0416
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
        1199.682,
        1214.911,
        1209.324
      ],
      "median": 1209.324,
      "resultMatch": true,
      "serverValues": [
        1186.461833,
        1203.623126,
        1197.491792
      ],
      "serverMedian": 1197.491792,
      "deviationBasis": "server",
      "deviation": 0.0143
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
        1198.555,
        1159.263,
        1141.931
      ],
      "median": 1159.263,
      "resultMatch": true,
      "serverValues": [
        1198.166542,
        1158.882709,
        1141.538458
      ],
      "serverMedian": 1158.882709,
      "deviationBasis": "server",
      "deviation": 0.0489
    }
  ],
  "pairVerdicts": [
    {
      "query": "Q1",
      "index": "I1",
      "cache": "cold",
      "chMedian": 5.0,
      "pgMedian": 739.886,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4.881,
      "pgServerPairMedian": 728.454751,
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
      "pgMedian": 635.935,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 3.378,
      "pgServerPairMedian": 634.970834,
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
      "chMedian": 5.0,
      "pgMedian": 16.441,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4.881,
      "pgServerPairMedian": 14.554084,
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
      "pgMedian": 2.067,
      "tieWithinResolution": true,
      "repTies": [
        true,
        false,
        true
      ],
      "chServerPairMedian": 3.378,
      "pgServerPairMedian": 1.221,
      "winner": "postgresql",
      "decidedBy": "server",
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
      "chMedian": 7.0,
      "pgMedian": 1138.655,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 6.679,
      "pgServerPairMedian": 1127.914458,
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
      "chMedian": 4.0,
      "pgMedian": 1129.899,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 4.277,
      "pgServerPairMedian": 1129.083418,
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
      "chMedian": 7.0,
      "pgMedian": 39.787,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 6.679,
      "pgServerPairMedian": 38.15275,
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
      "chMedian": 4.0,
      "pgMedian": 3.913,
      "tieWithinResolution": true,
      "repTies": [
        false,
        true,
        false
      ],
      "chServerPairMedian": 4.277,
      "pgServerPairMedian": 3.660249,
      "winner": "postgresql",
      "decidedBy": "server",
      "repWinners": [
        "postgresql",
        "postgresql",
        "clickhouse"
      ],
      "structuralWinner": null
    },
    {
      "query": "Q3",
      "index": "I1",
      "cache": "cold",
      "chMedian": 32.0,
      "pgMedian": 1219.245,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 32.334,
      "pgServerPairMedian": 1208.91275,
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
      "chMedian": 34.0,
      "pgMedian": 1198.678,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 34.173,
      "pgServerPairMedian": 1197.730626,
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
      "chMedian": 32.0,
      "pgMedian": 401.743,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 32.334,
      "pgServerPairMedian": 390.724293,
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
      "chMedian": 34.0,
      "pgMedian": 302.158,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 34.173,
      "pgServerPairMedian": 301.322626,
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
      "chMedian": 909.0,
      "pgMedian": 10869.381,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 908.618,
      "pgServerPairMedian": 10636.387754,
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
      "chMedian": 830.0,
      "pgMedian": 10670.536,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 830.108,
      "pgServerPairMedian": 10444.027088,
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
      "chMedian": 909.0,
      "pgMedian": 9504.295,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 908.618,
      "pgServerPairMedian": 9270.669421,
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
      "chMedian": 830.0,
      "pgMedian": 10995.269,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 830.108,
      "pgServerPairMedian": 10773.068586,
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
      "chMedian": 478.0,
      "pgMedian": 1410.034,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 477.777,
      "pgServerPairMedian": 1399.328042,
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
      "chMedian": 472.0,
      "pgMedian": 1414.243,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 471.902,
      "pgServerPairMedian": 1413.511043,
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
      "chMedian": 478.0,
      "pgMedian": 1420.776,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 477.777,
      "pgServerPairMedian": 1409.342376,
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
      "chMedian": 472.0,
      "pgMedian": 1381.121,
      "tieWithinResolution": false,
      "repTies": [
        false,
        false,
        false
      ],
      "chServerPairMedian": 471.902,
      "pgServerPairMedian": 1380.360793,
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
      "readRows": 40960,
      "readBytes": 569520,
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
      "actualRows": 3600.0,
      "executionMs": 685.735,
      "nodes": [
        "Gather Merge",
        "Sort",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260925_ts_idx)"
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
      "executionMs": 3.493,
      "nodes": [
        "Merge Append",
        "Index Scan(plc_tag_raw_control_p20260925_key_btree)"
      ]
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
      "actualRows": 3.0,
      "executionMs": 1488.546,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Append",
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
      "sharedHitBlocks": 10051,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 0,
      "actualRows": 3.0,
      "executionMs": 9.773,
      "nodes": [
        "Sort",
        "Aggregate",
        "Append",
        "Index Scan(plc_tag_raw_control_p20260923_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260924_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260925_key_btree)",
        "Index Scan(plc_tag_raw_control_default_key_btree)"
      ]
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
      "actualRows": 200.0,
      "executionMs": 1283.387,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Seq Scan",
        "Seq Scan"
      ]
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 2007740,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 200.0,
      "executionMs": 438.452,
      "nodes": [
        "Aggregate",
        "Gather Merge",
        "Sort",
        "Aggregate",
        "Append",
        "Index Scan(plc_tag_raw_control_p20260925_key_btree)",
        "Index Scan(plc_tag_raw_control_p20260924_key_btree)"
      ]
    },
    {
      "query": "Q4",
      "store": "clickhouse",
      "index": null,
      "readRows": 60000000,
      "readBytes": 1500000000,
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
      "actualRows": 600000.0,
      "executionMs": 11908.706,
      "nodes": [
        "Aggregate",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260925_ts_idx)"
      ]
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 16,
      "sharedReadBlocks": 337132,
      "tempReadBlocks": 153451,
      "workersLaunched": 0,
      "actualRows": 600000.0,
      "executionMs": 11304.05,
      "nodes": [
        "Aggregate",
        "Append",
        "Bitmap Heap Scan",
        "Bitmap Index Scan(plc_tag_raw_control_p20260925_ts_idx)"
      ]
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
      "actualRows": 1.0,
      "executionMs": 2654.191,
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
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 2628.888,
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
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 3792.326,
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
      "sharedHitBlocks": 4323,
      "sharedReadBlocks": 930281,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0,
      "executionMs": 3846.525,
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
      "deviation": 0.4501
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "server",
      "deviation": 0.436
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "basis": "server",
      "deviation": 0.3872
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I1",
      "cache": "cold",
      "basis": "client",
      "deviation": 0.3693
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "client",
      "deviation": 0.3125
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I2",
      "cache": "warm",
      "basis": "server",
      "deviation": 0.297
    },
    {
      "query": "Q2",
      "store": "postgresql",
      "index": "I1",
      "cache": "warm",
      "basis": "server",
      "deviation": 0.2934
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "server",
      "deviation": 0.2903
    },
    {
      "query": "Q3",
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "basis": "client",
      "deviation": 0.2647
    },
    {
      "query": "Q2",
      "store": "clickhouse",
      "index": null,
      "cache": "warm",
      "basis": "server",
      "deviation": 0.26
    },
    {
      "query": "Q1",
      "store": "clickhouse",
      "index": null,
      "cache": "cold",
      "basis": "server",
      "deviation": 0.2391
    },
    {
      "query": "Q3",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "client",
      "deviation": 0.232
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "cache": "cold",
      "basis": "client",
      "deviation": 0.2267
    }
  ]
}
```
