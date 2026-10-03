# 050 — 대조군 역전 지점 격자 2차 3단계(10^7행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10 · 미래 방향 적재)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(기록 037 폐기 뒤 재측정 — supersedes 아님) · 판정 창: 2026-09-27T03:51:54.733Z ~ 2026-09-27T03:56:32.042Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 12:24:05 ~ 12:57:17 KST(단계 예산 확인 ~ 채움 스냅샷)

격자 2차 3단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 10,000,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 1,000초 · 2단계 049에 누적)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

**이 기록은 격자 1차 3단계(037 · 폐기)의 재측정이다.** 1차 폐기의 원인은 역방향 적재(데이터 끝을 고정하고 과거로 채움)였다 — 파티션 물리 순서가 시간과 어긋나 5단계에서 ts 상관이 0.027로 떨어졌고 PostgreSQL 플래너가 BRIN을 버리고 Seq Scan을 골랐다(기록 039). 2차는 시작 시각 S를 고정하고 미래 방향(시간 순)으로 누적해 이 원인을 없앴다(ts 상관 0.99999 — 리드 실측 · 원시 없음). 재측정 관계는 기계 판독 블록 conditions.remeasureOf에 적는다(030 선례 — supersedes는 잘못 적은 기록의 정정 칸이다).

이 기록은 단계 하나의 상태를 적는다. **역전 구간은 단계 사이의 비교라 이 기록 단독으로 판정하지 않는다** — 정밀화 · 역전 구간 판정 기록(053)이 판정한다. 해석에는 이 단계에서 어느 쪽이 빠른지 · 앞 단계(049) 대비 변화 · 읽은 양으로 본 원리를 수치 크기 차로 적는다(049도 폐기 기록이라 단계 사이 비는 참고다). **이 기록은 폐기 기록이다 — 정본 인용 불가**(편차 기준 초과 · §폐기 · 예외).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(원시 run.commitHash — 모든 query · axis · i2-build 줄) · init git.dirty true — 1~5단계는 5492c73에 **미커밋 PGSS 키 수정**(scripts/lab/s5/grid/grid.py 한 곳 — 러너 쿼리 경로의 pg_stat_statements 스냅샷 키 · 이미지 밖)을 얹어 돌았고, 이 수정은 뒤에 커밋 c89b982로 들어갔다(리드 판정 5). 이 단계는 수정이 들어간 러너로 처음부터 돌았다(리드 판정 5 근거 · 원시 서버 null 0건 정황). 모드 D 채우기는 require_clean(apps/api · packages · infra) 통과 |
| 저장소 자원 | 대조 자원 조건(infra/compose/compose.control.yml) — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음" — 04 §조건 칸(2026-09-27 개정)의 도구 컨테이너 경로 조항에 따라 상한이 없다는 사실값이며 추정값으로 채우지 않는다. 대조 저장소 메모리는 조건 칸 controlMemoryMb(3,584 · 3,584)에 따로 적는다 |
| 용량 티어 | **해당 없음** — 근거: 06_experiment_catalog §대조군 실험 — EXP-01~05 공통 조건 "티어 해당 없음(행 수 격자 6단계가 축)"(원시 run.capacityTier 문자열 그대로). 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz)이고 행 수는 기간으로 키운다 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D + GEN-10은 ING를 거치지 않아 SW-09 동시 적재 경로가 아니다(대조군은 GEN-10 COPY가 같은 행을 채운다) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · ClickHouse) + GEN-10(대조군 COPY · 세션 synchronous_commit off — 서버 기본은 on) · 42 · 혼합(mixed) |
| 적재 방향 · 데이터 구간 | **미래 방향 누적** — 시작 S = 2026-09-25T01:06:20.000Z(KST 10:06:20) 고정 · 이 단계 [S, S + 1,000초) = 2026-09-25T01:06:20.000Z ~ 01:23:00.000Z · {end} = 01:23:00.000Z · 채우기 조각 1(01:08:00Z ~ 01:23:00Z · 9,000,000행 — 2단계 끝에서 이어 채움) · 전부 KST 일 파티션 p20260925 하나 · 단계 사이 복원 없음 |
| 쿼리 매개변수 | device 1 · tag 1 · Q5 문턱 v = 58(1단계 params 줄에서 고정 · 이 단계 선택도 0.4960 = 4,959,583 ÷ 10,000,000) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · **서버 로그 수준 — 이미지 기본 trace**(config.d에 logger 설정 없음 · text_log가 10분 약 470만 줄 규모로 쌓인다 · 측정 중 바꾸지 않았다 — W6 판정) · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(동기 · 파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2 인덱스 크기는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다 · 재기동 대기 1.2~1.3초) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | 대표값 = 클라이언트 — ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE · µs 해상도) · 호스트 CLI 직접(api를 거치지 않는다). 서버 시간을 함께 기록 — ClickHouse query_log µs · PostgreSQL pg_stat_statements total_exec_time 증가분 µs |
| 서버 시간 비대칭 | 두 엔진의 서버 시간은 같은 구간이 아니다(원시 conditions.serverTimeAsymmetry) — PostgreSQL은 실행만(track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse는 파싱 · 분석 · 계획 · 결과 전송 포함 |
| 편차 판정 기준 | 점(점 · 쿼리 · 캐시)마다 첫 ClickHouse 줄(반복 1)이 정한다 — CH client 중앙값 < 10 ms면 두 저장소 모두 서버 µs로 판정(06 §EXP-29~39 끝 2026-09-27 격자 불릿 · 양자화 값 제외). 이 단계는 **Q4 · Q5(CH 반복 1 클라이언트 185 · 199 · 65 · 67 ms)가 클라이언트 기준**(12개)이고 나머지 18개는 서버 기준이다 — Q3 웜은 반복 1 CH 9 ms로 서버 기준이 됐다(경계 가까이) |
| 동률 규칙 | CH client 중앙값 < 10 ms이고 \|CH − PG\| client 중앙값 차 < 1 ms면 서버 µs 중앙값(반복 3개 서버 중앙값의 중앙값)으로 우열을 정한다(리드 판정 2 · 러너 pair 줄 tieWithinResolution) — 해당 점은 §결과 동률 표 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 호스트 교란 | 원시 없음(이 단계 창에 기록된 다른 측정 없음) |
| 안정화 | settle 4회 — 마지막 2026-09-27T03:51:46.334Z settled true(CH 활성 파트 5 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 3 → 4) · 앞선 false 3회(03:32:23Z · 03:41:08Z · 03:49:53Z)는 체크포인트 미경과 |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회 · 순서는 CH 반복 1~3 → PG I1 반복 1~3 → I2 반복 1~3) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **29.5%** · 기준 20% 초과 1개 |
| 중복 줄 | 같은 (점 · 저장소 · 인덱스 · 반복 · 쿼리 · 단계) 줄의 중복 없음(settle 4줄은 반복 호출이지 같은 측정의 중복이 아니다) |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · settle · axes · query · i2-build · i2-drop · snapshot) · 원시 docs/measurements/raw/050-control-stage-3.jsonl(232행 = 공통 init 1 + 점 "3" 줄 231 — 원래 순서 · 가공 없음 · 정밀화 점의 base 복원 줄은 넣지 않는다 — 리드 판정 11) · 보조 snapshots/lab-s5-grid-f/explain/s3 · match/s3-*.json · results/s3 · 대조 스크립트 .omc/lab/grid2-w-grid-a/grid2.py |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥). 시각은 KST다.

```plain
① 예산      12:24:05  디스크 식 · 적재 시간 예산 성립(머리 만료까지 423,735초)
② 채우기    12:24:13  모드 D 9,000,000행 1.817초 · GEN-10 9,000,000행 2.967초
③ 정합      12:24:14  tag_raw 10,000,000 = 대조군 10,000,000 = countMerge(tag_1m) 10,000,000 · 구간 세 개 일치 · 구간 밖 0
④ 안정화    12:51:46  settle 4회째 true
⑤ 비 쿼리 축 12:51:54  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   12:51:54 ~ 12:56:32  CH → I1 → I2 빌드 2.787초 → I2 → I2 삭제 12:56:32
   스냅샷    12:57:17  lab-s5-grid-f-s3(볼륨 2,167,762,944 B · 43.3초) — 정밀화 r7.5 · r7.25의 복원점
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count(1단계 100,000 · 2단계 증가분 900,000 · 이 단계 증가분 9,000,000)가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms. 서버 열은 반복 서버 중앙값 3개의 중앙값이다. 비교 열은 이긴 쪽과 비(PG ÷ CH)이며, 동률 점은 서버 중앙값으로 판정하고 비도 서버 값의 비다.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 3 · 4) | **144.855**(144.230 · 144.855 · 145.784) | **0.557**(0.556 · 0.568 · 0.557) | 3.419 · 144.235 · 0.246 | CH · 48.28 | PG I2 · 0.19 | PG I2 |
| Q2 단일 태그 7일 | **4**(4 · 3 · 4) | **146.990**(146.990 · 150.711 · 146.112) | **0.535**(0.539 · 0.535 · 0.460) | 3.709 · 146.231 · 0.318 | CH · 36.75 | PG I2 · 0.13 | PG I2 |
| Q3 설비 전체 1일 | **9**(9 · 9 · 7) | **157.844**(157.844 · 159.811 · 155.520) | **25.074**(25.368 · 24.897 · 25.074) | 8.573 · 157.090 · 24.293 | CH · 17.54 | CH · 2.79 | CH |
| Q4 분 단위 롤업 재계산 | **199**(199 · 192 · 203) | **1013.723**(1013.723 · 1014.564 · 1013.076) | **1021.242**(1018.262 · 1023.959 · 1021.242) | 199.038 · 963.679 · 971.603 | CH · 5.09 | CH · 5.13 | CH |
| Q5 비정렬 열 조건 count | **62**(67 · 56 · 62) | **164.913**(164.913 · 162.779 · 169.854) | **166.851**(166.851 · 164.354 · 168.345) | 62.163 · 164.187 · 166.004 | CH · 2.66 | CH · 2.69 | CH |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **125.303**(122.212 · 132.468 · 125.303) | **178.127**(178.127 · 170.369 · 182.799) | 0.602 · 124.913 · 177.754 | CH · 125.30 | CH · 178.13 | CH |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **4**(4 · 4 · 4) | **152.437**(154.763 · 152.437 · 150.338) | **4.613**(4.833 · 4.613 · 4.506) | 4.155 · 142.661 · 3.479 | CH · 38.11 | PG I2 · 0.84 · 동률 → 서버 | PG I2 (서버) |
| Q2 단일 태그 7일 | **4**(4 · 4 · 5) | **159.838**(155.789 · 168.189 · 159.838) | **4.706**(4.855 · 4.706 · 4.224) | 4.499 · 149.415 · 3.453 | CH · 39.96 | PG I2 · 0.77 · 동률 → 서버 | PG I2 (서버) |
| Q3 설비 전체 1일 | **8**(7 · 8 · 8) | **164.428**(170.024 · 163.457 · 164.428) | **43.560**(43.560 · 45.057 · 42.240) | 8.104 · 154.159 · 33.540 | CH · 20.55 | CH · 5.45 | CH |
| Q4 분 단위 롤업 재계산 | **199**(185 · 199 · 214) | **1029.380**(1021.460 · 1032.683 · 1029.380) | **1039.772**(1034.471 · 1040.385 · 1039.772) | 198.881 · 969.353 · 980.156 | CH · 5.17 | CH · 5.22 | CH |
| Q5 비정렬 열 조건 count | **62**(65 · 57 · 62) | **179.578**(179.578 · 199.392 · 172.708) | **173.505**(175.571 · 173.505 · 172.590) | 61.631 · 168.657 · 163.289 | CH · 2.90 | CH · 2.80 | CH |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **139.835**(139.835 · 143.776 · 137.096) | **534.959**(542.423 · 456.494 · 534.959) | 0.758 · 129.728 · 524.536 | CH · 139.84 | CH · 534.96 | CH |

### 동률 점 — 서버 µs로 판정

CH client 중앙값 < 10 ms이고 CH와 그 PG 변형의 client 중앙값 차가 1 ms 미만인 점이다(리드 판정 2). 원시 pair 줄의 반복별 tieWithinResolution과 같다(Q1 · Q2 콜드 CH 대 I2 반복 1~3).

| 점 | client 중앙값 CH · PG(ms) | 서버 중앙값 CH · PG(ms) | 판정 |
|------|------|------|------|
| Q1 콜드 · CH 대 I2 | 4 · 4.613 | 4.155 · 3.479 | PG I2 — **클라이언트 순서와 반대** |
| Q2 콜드 · CH 대 I2 | 4 · 4.706 | 4.499 · 3.453 | PG I2 — **클라이언트 순서와 반대** |

- **이 단계의 동률 두 점은 서버 판정이 클라이언트 순서를 뒤집는다.** 클라이언트 중앙값으로는 CH가 0.613 · 0.706 ms 빠르고(4 대 4.613 · 4.706 ms), 서버 중앙값으로는 PG I2가 0.676 · 1.046 ms 빠르다(3.479 · 3.453 대 4.155 · 4.499 ms). 리드 판정 2에 따라 두 점의 앞선 쪽은 **PG I2**다. 이 차는 서버 시간 비대칭의 크기와 같은 규모다 — PG의 클라이언트 − 서버 차가 1.134 · 1.253 ms(계획 · 결과 전송 · psql 왕복)이고 같은 쿼리의 EXPLAIN planning이 0.953 · 1.010 ms다. §해석 한계 불릿이 이 민감도를 적는다.

### 우열 3/3 — 구조 판정

우열(어느 쪽이 빠른가)은 반복마다의 부호다 — 반복 3회 모두 같은 쪽이 앞서면 그 칸의 우열은 구조 사실로 인용하고(04 §구조 판정과 분포 판정 — 3회 전부 성립 · 리드 판정 12 · 정본 조항 명시는 W6 리드), 반복 사이에 갈리면 우열 미정으로 두며 역전 구간의 끝점이 될 수 없다. 반복 값은 반복 줄의 median이고, 반복마다 CH client < 10 ms이고 차 < 1 ms면 서버 중앙값으로 정한다(ˢ 표시 — 원시 pair 줄 tieWithinResolution과 같다). 편차 폐기와 무관하게 인용할 수 있는 것은 이 표의 우열뿐이다 — 크기 수치(ms · 배수)는 폐기 기록이라 인용하지 않는다(리드 판정 13).

| 쿼리 | 캐시 | CH 대 I1(반복 1 · 2 · 3) | CH 대 I2(반복 1 · 2 · 3) |
|------|------|------|------|
| Q1 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PGˢ · PGˢ · PGˢ) |
| Q1 | 웜 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q2 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PGˢ · PGˢ · PGˢ) |
| Q2 | 웜 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q3 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q3 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q4 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q4 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |

- 검산: 칸 = 쿼리 5 × 캐시 2 × 변형 2 = **20** · 3/3 **20** · 갈림 **0** — Q1 · Q2 콜드 CH 대 I2의 PG 3/3은 세 반복 모두 서버 판정(ˢ)이다. client만 쓰면 세 반복 모두 CH가 앞서 우열이 반대가 된다(§동률 점 · 한계).

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid-f/results/s3)을 대조한 값이다(원시 match 6줄).

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 1,000 · 1,000 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0010 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0107 |
| Q4 | 170,000 · 170,000 | 일치 | 그룹 170,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.1000 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 4,959,583 = 4,959,583 |
| Q5x | 1 · 1 | 일치 | count 10,000,000 = 10,000,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 1~3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 410,000,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read(+ temp는 따로)이며 한 블록 8,192 B · 힙 블록 93,488(heapMainBytes 765,853,696 B)이다. 노드는 계획 트리의 노드 종류를 처음 나온 순서로 적었다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 40,960(0.41%) | 610,886(0.15% · 14.9 B) | 93,491(hit 4,326 · read 89,165 · 100.0%) · Sort · Gather · Append · Seq Scan · 작업자 2 | 1,006(hit 1,006 · read 0 · 1.1%) · Merge Append · Index Scan · 작업자 0 | 1,000 |
| Q2 | 40,960(0.41%) | 601,704(0.15% · 14.7 B) | 93,491(hit 4,326 · read 89,165 · 100.0%) · Aggregate · Sort · Gather · Append · Seq Scan · 작업자 2 | 1,015(hit 1,015 · read 0 · 1.1%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 221,184(2.21%) | 5,308,416(1.29% · 24.0 B) | 93,502(hit 4,337 · read 89,165 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 3,686(hit 3,686 · read 0 · 3.9%) · Aggregate · Gather Merge · Sort · Append · Bitmap Heap Scan · Bitmap Index Scan · Index Scan · 작업자 2 | 200 |
| Q4 | 10,000,000(100.00%) | 250,000,000(60.98% · 25.0 B) | 93,518(hit 4,353 · read 89,165 · temp 13,461 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 93,518(hit 4,353 · read 89,165 · temp 13,457 · 100.0%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 170,000 |
| Q5 | 10,000,000(100.00%) | 80,000,000(19.51% · 8.0 B) | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 93,488(hit 4,323 · read 89,165 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 104,965(hit 104,965 · read 0 · 112.3%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다. 삽입 처리량은 이 단계 증가분(9,000,000행)의 값이다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 44,687,468 B(활성 파트 5 · Wide · Compact · 행당 4.47 B) | 766,590,976 B(테이블 766,083,072 · 인덱스 507,904 · 힙 행당 76.6 B) | PG ÷ CH 17.2배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 410,000,000 B ÷ 분모) | 9.17 | 0.535 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM · TOAST) |
| 3 | 삽입 처리량 | 4,953,220 rows/s(9,000,000행 · 1.817 초) | 3,033,367 rows/s(9,000,000행 · 2.967 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 3개 39,757,048 B) | 1.248(WAL 460,682,100 B · FPI 35 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 843) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 27,502 B(기본 키 9,756 + 마크 17,746) | I1 BRIN 262,144 B · I2 btree 315,514,880 B(빌드 2.787 초 · WAL 101,658,301 B) | I2 ÷ 힙 41.2% · I2 행당 31.6 B |

## 해석

- **이 단계의 앞선 쪽 — 단일 태그 조회(Q1 · Q2)는 PostgreSQL I2, 설비 조회(Q3) · 전 행 집계(Q4) · 비정렬 열 count(Q5)는 ClickHouse다.** 웜 중앙값으로 Q1 I2 0.557 ms · CH 3 ms · I1 144.855 ms, Q2 I2 0.535 ms · CH 4 ms, Q3 CH 9 ms · I2 25.074 ms(2.79배), Q4 CH 199 ms · I1 1,013.723 ms, Q5 CH 62 ms · I1 164.913 ms다. 콜드는 Q1 · Q2가 동률 점이라 서버 판정으로 PG I2(§동률 점), Q3 · Q4 · Q5가 CH다.
- **ClickHouse는 다섯 쿼리 모두에서 I1(BRIN만)보다 빠르다 — 웜 2.66~48.28배 · 콜드 2.90~39.96배.** 단일 태그 조회에서 I1과의 차가 가장 크다(Q1 웜 3 대 144.855 ms).
- **2단계(049) 대비 — 행 10배에 I1은 약 11배, I2 단일 태그는 2.6배, ClickHouse 단일 태그는 1.5배 이하로 늘었다.** 웜 중앙값으로 I1 Q1 13.105 → 144.855 ms · I2 Q1 0.217 → 0.557 ms · CH Q1 2 → 3 ms, CH Q4 27 → 199 ms(7.4배) · I1 Q4 168.561 → 1,013.723 ms(6.0배), CH Q5 7 → 62 ms(8.9배) · I1 Q5 15.089 → 164.913 ms(10.9배). Q3는 I2 3.687 → 25.074 ms(6.8배) · CH 3 → 9 ms(3배)로 CH 우위가 벌어졌다 — 두 기록 모두 폐기라 이 비는 참고다.
- **단일 태그 조회에서 I2가 여전히 이기는 이유 — 결과 1,000행을 찾는 데 버퍼 1,006개(힙의 1.1%)다.** ClickHouse는 같은 쿼리에 40,960행(0.41%)을 읽는다 — 파트 5개에서 그래뉼 하나씩으로 보이고(원시는 파트 수와 read_rows만 준다), 행 수가 늘어도 읽는 양이 파트 수만큼만 늘어 시간이 3~4 ms에 머무는 것으로 보인다. I2는 결과 행 수에 비례하는 것으로 보인다. 두 쪽 다 작아 콜드에서는 1 ms 안쪽의 차가 되고(§동률 점) 판정이 서버 시간 정의에 좌우된다.
- **Q3는 설비 조건에서 정렬 키 접두의 가지치기가 앞선다.** I2 계획은 Bitmap Heap Scan(작업자 2 · 버퍼 3,686)으로 바뀌었고 25.074 ms다. ClickHouse는 device_id 접두로 221,184행(2.21%)만 읽어 9 ms다.
- **I1 Seq Scan은 웜에서도 공유 버퍼 밖에서 읽는다.** 웜 반복 1 직후의 EXPLAIN에서 I1 계획은 힙 약 93,500블록 전부를 읽는데 그중 89,165블록이 read(공유 버퍼 적중 아님)다 — 힙 766 MB가 shared_buffers 896 MB의 1/4을 넘어 PostgreSQL 대량 순차 읽기가 링 버퍼를 쓰는 동작으로 보인다(원시는 hit · read 수만 준다 · OS 페이지 캐시 적중 여부는 재지 않았다). Q4는 정렬이 work_mem 16MB를 넘어 temp 13,461블록을 쓴다.
- **열 단위 읽기 — Q5에서 읽은 바이트 차는 9.6배다.** ClickHouse는 10,000,000행의 value 한 열 80,000,000 B(행당 8.0 B)를 읽고, PostgreSQL은 I1 · I2 모두 힙 93,488블록(765,853,696 B)을 읽는다. Q4는 ClickHouse가 행당 25.0 B(250,000,000 B · 논리 크기의 61.0%)를 읽어 199 ms, PostgreSQL은 힙 전부 + 정렬 임시 파일로 1,013.723 ms(I1)다.
- **비 쿼리 축 — 저장 용량 17.2배 · 삽입 처리량 1.6배 ClickHouse 우위.** ClickHouse 44,687,468 B(활성 파트 5 · 행당 4.47 B · 압축률 9.17) · PostgreSQL 766,590,976 B(힙 행당 76.6 B · 압축률 0.535). 삽입은 9,000,000행에 CH 1.817초(4,953,220 rows/s) · PG COPY 2.967초(3,033,367 rows/s)다. WAL 증폭 1.248 · ClickHouse 머지 0(이 단계 새 파트 3). I2 btree 315,514,880 B(힙의 41.2% · 빌드 2.787초 · 빌드 WAL 101,658,301 B).
- **한계 — 서버 시간 비대칭이 이 단계에서는 판정을 가른다.** 동률 판정 값인 서버 시간은 PostgreSQL이 계획 시간을 빼고(track_planning off · 준비된 문장의 custom plan 계획도 total_exec_time 밖 · 이 단계 EXPLAIN planning 0.76~1.52 ms) ClickHouse가 파싱 · 분석 · 계획 · 결과 전송을 포함한다. Q1 · Q2 콜드 CH 대 I2의 서버 차(0.676 · 1.046 ms)는 이 비대칭 크기(PG 계획 약 1 ms)와 같은 규모라, 서버 판정의 PG I2 우위는 두 엔진이 같은 구간을 쟀을 때의 우위로 읽을 수 없다. 클라이언트 값으로 판정하면 두 점은 세 반복 모두 CH 우위다 — 동률 점의 서버 µs 규칙은 유지하고(리드 판정 12), client만 쓰면 콜드 구간이 달라진다는 사실(콜드 Q1 · Q2 (10^6, 10^7] — PG 계획 시간 제외가 PG 쪽으로 기운다)을 한계로 적는다. 구간 판정은 053이 한다.
- **한계 — ClickHouse 시간은 1 ms 해상도다.** 10 ms 미만인 CH 점(Q1 · Q2 · Q3 · Q5x)은 편차를 서버 µs로 판정했고, Q4 · Q5(56~214 ms)는 클라이언트로 판정했다(06 2026-09-27 격자 불릿). Q3 웜은 반복 1 CH 9 ms로 서버 기준이 됐다 — 경계(10 ms) 바로 아래다. 대표값(values · median)은 클라이언트 ms 그대로다.
- **한계 — ClickHouse 서버 로그 trace(리드 판정 8).** 이미지 기본 로그 수준이 trace라 조회마다 서버 로그 줄이 쓰이고 이 부하는 모든 ClickHouse 측정에 들어 있다 — PostgreSQL 쪽에는 같은 크기의 로그 부하가 없다. 측정 중 설정은 바꾸지 않았다(W6 판정) · 그 몫을 가르지 않았다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 1개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** CH Q3 웜 29.5%(서버 8.573 · 9.377 · 6.844 ms). 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이며, 판정 기준(s = 서버 · c = 클라이언트)은 아래 표와 같다.

| 쿼리 | CH 콜드 | CH 웜 | PG I1 콜드 | PG I1 웜 | PG I2 콜드 | PG I2 웜 |
|------|------|------|------|------|------|------|
| Q1 | 6.0% s | 12.3% s | 2.5% s | 1.1% s | 8.2% s | 9.3% s |
| Q2 | 8.7% s | 19.5% s | 8.3% s | 3.2% s | 13.5% s | 5.5% s |
| Q3 | 13.4% s | **29.5%** s | 3.4% s | 2.8% s | 5.6% s | 1.5% s |
| Q4 | 14.6% c | 5.5% c | 1.1% c | 0.1% c | 0.6% c | 0.6% c |
| Q5 | 12.9% c | 17.7% c | 14.9% c | 4.3% c | 1.7% c | 2.4% c |

- **초과의 성격.** CH Q3 웜은 서버 기준(반복 1 CH 클라이언트 9 ms < 10 ms)으로 판정했고 서버 값 8.573 · 9.377 · 6.844 ms에서 반복 3이 낮다 — 클라이언트 값(9 · 9 · 7 ms · 22.2%)도 같은 쪽으로 움직여 해상도가 아니라 실제 흔들림이다. 나머지 29개는 20% 이내다(다음으로 큰 값 CH Q2 웜 19.5%).
- **1 ms 해상도 양자화는 판정에서 뺐다(리드 판정 3).** 예: CH Q1 웜 클라이언트 3 · 3 · 4 ms(33.3%)는 서버 3.419 · 3.142 · 3.563 ms(12.3%)로 판정했다. 순간값(settle 표본 · 활성 파트 수)은 판정 지표가 아니다.
- **4요소 중 메모리 상한 null은 누락이 아니다.** run.memoryLimitSource가 있는 도구 컨테이너 경로의 null이다(04 §조건 칸 2026-09-27 개정) — 이 기록의 폐기 사유는 편차뿐이다.
- 안정화 false 3회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
- 불성립 구조 판정 없음(결과 동일성 6/6 · 구간 count 정합 성립) · 창에서 뺀 구간 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **이 기록의 수치를 정본에 올리지 않는다.** status discarded(편차 기준 초과)다. 구조 사실(§우열 3/3 표의 우열 — 20칸 모두 3/3 · 결과 집합 일치 6/6 · I1 병렬 Seq Scan의 공유 버퍼 밖 읽기 · I2 Q3 Bitmap Heap Scan 전환 · 읽은 행 수 · Q5x의 CH 메타데이터 읽기)만 인용할 수 있다(리드 판정 12 · 13). 역전 구간은 053이 판정한다.
- 제안(리드 판정) — ① 동률 판정의 서버 시간 비대칭: 이 단계 Q1 · Q2 콜드는 서버 판정이 클라이언트 순서를 뒤집고, 그 차가 PG 계획 시간 규모다. PG 쪽 서버 값에 계획 시간을 더하는 방법(track_planning on · 또는 EXPLAIN planning 병기) 여부
- 미확인으로 남기는 것 — I1 Seq Scan read 블록의 OS 페이지 캐시 적중 여부 · 콜드 근사의 오차 · trace 로그 부하의 크기.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이다. 점마다 server(반복 서버 중앙값 · 중앙값)와 judgment(편차 판정 기준 · 편차)를 더했고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 · 동률 점 판정은 conditions.ties에 · 반복별 우열(구조 판정)은 dominance에 둔다(판독 규칙 7 — 모르는 필드는 무시). 값은 대조 스크립트(.omc/lab/grid2-w-grid-a/grid2.py block 3)가 원시에서 다시 계산한 것과 같다.

```json
{
  "schema": "measurement/v1",
  "record": "050",
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
    "start": "2026-09-27T03:51:54.733Z",
    "end": "2026-09-27T03:56:32.042Z"
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
    "gridGeneration": 2,
    "direction": "forward",
    "tierConfig": "device50-tag200-1hz",
    "apiStopped": true,
    "dataStart": "2026-09-25T01:06:20.000Z",
    "dataEnd": "2026-09-25T01:23:00.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:06:20.000Z",
      "end": "2026-09-25T01:23:00.000Z"
    },
    "q5Threshold": 58,
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
    "i2Lifecycle": "I1 queries -> i2-build (sync) -> I2 queries -> i2-drop",
    "cacheDefinition": "cold = first run right after restarting both store containers (approx, OS page cache not dropped) · warm = 1 warm-up then 3 runs, rep value = median of 3",
    "timing": "clickhouse-client --time (1 ms resolution) · psql \\timing on PREPARE/EXECUTE · server: CH query_log µs · PG pg_stat_statements total_exec_time delta µs",
    "serverTimeAsymmetry": "서버 시간은 두 엔진이 같은 구간을 재지 않는다 — PostgreSQL: pg_stat_statements total_exec_time(실행만 · track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse: query_log query_start_time_microseconds ~ event_time_microseconds(파싱 · 분석 · 계획 포함 · 결과 전송 포함)",
    "repeatAxis": "query (3 reps) · fill once per stage (04 grid exception)",
    "judgedMetrics": "Q1..Q5 x {CH, PG I1, PG I2} x {cold, warm} = 30 · Q5x auxiliary excluded",
    "judgmentRule": "deviation basis per (point, query, cache) fixed by first CH line (decidedAtRep): CH client median < 10 ms -> server µs for both stores (06 2026-09-27 grid bullet) · else client",
    "tieRule": "CH client median < 10 ms and |CH - PG| client median diff < 1 ms -> order by server µs median (lead ruling 2)",
    "ties": [
      {
        "query": "Q1",
        "cache": "cold",
        "index": "I2",
        "winner": "PG",
        "by": "server"
      },
      {
        "query": "Q2",
        "cache": "cold",
        "index": "I2",
        "winner": "PG",
        "by": "server"
      }
    ],
    "duplicateLinesRule": "last line per (point, store, index, rep, query, cache) is valid",
    "duplicateLines": {
      "supersededQueryLines": 0,
      "note": "none"
    },
    "remeasureOf": "037",
    "remeasureNote": "037 discarded (grid 1st: reverse-direction fill -> BRIN correlation 0.027 -> PG Seq Scan at 10^9, record 039) — grid 2nd forward fill; supersedes not used for discarded records",
    "runnerDirty": true,
    "runnerNote": "stages 1-5 ran on 5492c73 + uncommitted PGSS snapshot key fix (grid.py, runner query path, outside image) — committed later as c89b982",
    "clickhouseServerLogLevel": "trace (image default · no logger in config.d · unchanged during measurement)",
    "settledAt": "2026-09-27T03:51:46.334Z"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.2955,
    "threshold": 0.2
  },
  "results": [],
  "dominance": [
    {
      "query": "Q1",
      "cache": "cold",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q1",
      "cache": "cold",
      "index": "I2",
      "reps": [
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
    },
    {
      "query": "Q1",
      "cache": "warm",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q1",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
    },
    {
      "query": "Q2",
      "cache": "cold",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q2",
      "cache": "cold",
      "index": "I2",
      "reps": [
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
    },
    {
      "query": "Q2",
      "cache": "warm",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q2",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
    },
    {
      "query": "Q3",
      "cache": "cold",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q3",
      "cache": "cold",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q3",
      "cache": "warm",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q3",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q4",
      "cache": "cold",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q4",
      "cache": "cold",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q4",
      "cache": "warm",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q4",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q5",
      "cache": "cold",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q5",
      "cache": "cold",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q5",
      "cache": "warm",
      "index": "I1",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    },
    {
      "query": "Q5",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "CH"
      ],
      "unanimous": true,
      "winner": "CH"
    }
  ],
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          4.164,
          3.915,
          4.155
        ],
        "median": 4.155
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.059928
      }
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
        3.0,
        3.0,
        4.0
      ],
      "median": 3.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          3.419,
          3.142,
          3.563
        ],
        "median": 3.419
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.123135
      }
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
        154.763,
        152.437,
        150.338
      ],
      "median": 152.437,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          144.311,
          142.6615,
          140.788792
        ],
        "median": 142.6615
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.024689
      }
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
        144.23,
        144.855,
        145.784
      ],
      "median": 144.855,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          143.718791,
          144.235209,
          145.28875
        ],
        "median": 144.235209
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.010885
      }
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
        4.833,
        4.613,
        4.506
      ],
      "median": 4.613,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.621375,
          3.478583,
          3.335333
        ],
        "median": 3.478583
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.082229
      }
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
        0.556,
        0.568,
        0.557
      ],
      "median": 0.557,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.252958,
          0.245791,
          0.230208
        ],
        "median": 0.245791
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.092558
      }
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
        4.0,
        4.0,
        5.0
      ],
      "median": 4.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          4.172,
          4.564,
          4.499
        ],
        "median": 4.499
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.08713
      }
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
        4.0
      ],
      "median": 4.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          3.709,
          3.266,
          3.991
        ],
        "median": 3.709
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.19547
      }
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
        155.789,
        168.189,
        159.838
      ],
      "median": 159.838,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          145.000709,
          157.368417,
          149.414791
        ],
        "median": 149.414791
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.082774
      }
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
        146.99,
        150.711,
        146.112
      ],
      "median": 146.99,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          146.230751,
          149.918459,
          145.16825
        ],
        "median": 146.230751
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.032484
      }
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
        4.855,
        4.706,
        4.224
      ],
      "median": 4.706,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.452792,
          3.668751,
          3.203125
        ],
        "median": 3.452792
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.134855
      }
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
        0.539,
        0.535,
        0.46
      ],
      "median": 0.535,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.317833,
          0.322209,
          0.304667
        ],
        "median": 0.317833
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.055193
      }
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
        7.0,
        8.0,
        8.0
      ],
      "median": 8.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          7.17,
          8.252,
          8.104
        ],
        "median": 8.104
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.133514
      }
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
        9.0,
        9.0,
        7.0
      ],
      "median": 9.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          8.573,
          9.377,
          6.844
        ],
        "median": 8.573
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.295462
      }
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
        170.024,
        163.457,
        164.428
      ],
      "median": 164.428,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          158.716542,
          153.469833,
          154.158917
        ],
        "median": 154.158917
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.034034
      }
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
        157.844,
        159.811,
        155.52
      ],
      "median": 157.844,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          157.08975,
          159.047667,
          154.641792
        ],
        "median": 157.08975
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.028047
      }
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
        43.56,
        45.057,
        42.24
      ],
      "median": 43.56,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          33.540292,
          34.685792,
          32.795625
        ],
        "median": 33.540292
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.056355
      }
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
        25.368,
        24.897,
        25.074
      ],
      "median": 25.074,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          24.458041,
          24.102834,
          24.292833
        ],
        "median": 24.292833
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.014622
      }
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
        185.0,
        199.0,
        214.0
      ],
      "median": 199.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          184.657,
          198.881,
          213.783
        ],
        "median": 198.881
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.145729
      }
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
        199.0,
        192.0,
        203.0
      ],
      "median": 199.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          199.038,
          191.609,
          202.666
        ],
        "median": 199.038
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.055276
      }
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
        1021.46,
        1032.683,
        1029.38
      ],
      "median": 1029.38,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          962.504,
          973.388168,
          969.352667
        ],
        "median": 969.352667
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.010903
      }
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
        1013.723,
        1014.564,
        1013.076
      ],
      "median": 1013.723,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          964.568042,
          963.678626,
          962.334042
        ],
        "median": 963.678626
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.001468
      }
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
        1034.471,
        1040.385,
        1039.772
      ],
      "median": 1039.772,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          974.532668,
          980.155583,
          980.841418
        ],
        "median": 980.155583
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.005688
      }
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
        1018.262,
        1023.959,
        1021.242
      ],
      "median": 1021.242,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          968.029958,
          973.925084,
          971.603335
        ],
        "median": 971.603335
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.005579
      }
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
        65.0,
        57.0,
        62.0
      ],
      "median": 62.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          64.662,
          57.242,
          61.631
        ],
        "median": 61.631
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.129032
      }
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
        67.0,
        56.0,
        62.0
      ],
      "median": 62.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          66.932,
          56.298,
          62.163
        ],
        "median": 62.163
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.177419
      }
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
        179.578,
        199.392,
        172.708
      ],
      "median": 179.578,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          168.656958,
          188.604458,
          162.649834
        ],
        "median": 168.656958
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.148593
      }
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
        164.913,
        162.779,
        169.854
      ],
      "median": 164.913,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          164.186792,
          162.023917,
          169.028667
        ],
        "median": 164.186792
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.042901
      }
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
        175.571,
        173.505,
        172.59
      ],
      "median": 173.505,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          164.905708,
          163.289,
          161.785625
        ],
        "median": 163.289
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.017181
      }
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
        166.851,
        164.354,
        168.345
      ],
      "median": 166.851,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          166.004125,
          163.534458,
          167.557584
        ],
        "median": 166.004125
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.02392
      }
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 44687468,
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
      "value": 9.17483174477462,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 0.5351900009089353,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 4953219.592735278,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 10000000,
      "value": 3033367.037411527,
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
      "value": 1.248460975609756,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 10000000,
      "value": 27502,
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.758,
          0.748,
          0.77
        ],
        "median": 0.758
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.029024
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.602,
          0.625,
          0.568
        ],
        "median": 0.602
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.094684
      }
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
        139.835,
        143.776,
        137.096
      ],
      "median": 139.835,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          129.728458,
          133.675375,
          127.426041
        ],
        "median": 129.728458
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.048172
      }
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
        122.212,
        132.468,
        125.303
      ],
      "median": 125.303,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          121.859,
          132.085,
          124.912625
        ],
        "median": 124.912625
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.081865
      }
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
        542.423,
        456.494,
        534.959
      ],
      "median": 534.959,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          532.344292,
          446.255124,
          524.535751
        ],
        "median": 524.535751
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.164125
      }
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
        178.127,
        170.369,
        182.799
      ],
      "median": 178.127,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          177.753751,
          169.997625,
          182.410167
        ],
        "median": 177.753751
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.06983
      }
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
      "sharedHitBlocks": 1015,
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
      "tempReadBlocks": 13461,
      "workersLaunched": 2,
      "actualRows": 170000.0
    },
    {
      "query": "Q4",
      "store": "postgresql",
      "index": "I2",
      "sharedHitBlocks": 4353,
      "sharedReadBlocks": 89165,
      "tempReadBlocks": 13457,
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
      "sharedHitBlocks": 104965,
      "sharedReadBlocks": 0,
      "tempReadBlocks": 0,
      "workersLaunched": 2,
      "actualRows": 1.0
    }
  ]
}
```
