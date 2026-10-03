# 049 — 대조군 역전 지점 격자 2차 2단계(10^6행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10 · 미래 방향 적재)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(기록 036 폐기 뒤 재측정 — supersedes 아님) · 판정 창: 2026-09-27T03:19:23.786Z ~ 2026-09-27T03:22:55.536Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 11:50:54 ~ 12:23:15 KST(단계 예산 확인 ~ 채움 스냅샷)

격자 2차 2단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 1,000,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 100초 · 1단계 048에 누적)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

**이 기록은 격자 1차 2단계(036 · 폐기)의 재측정이다.** 1차 폐기의 원인은 역방향 적재(데이터 끝을 고정하고 과거로 채움)였다 — 파티션 물리 순서가 시간과 어긋나 5단계에서 ts 상관이 0.027로 떨어졌고 PostgreSQL 플래너가 BRIN을 버리고 Seq Scan을 골랐다(기록 039). 2차는 시작 시각 S를 고정하고 미래 방향(시간 순)으로 누적해 이 원인을 없앴다(ts 상관 0.99999 — 리드 실측 · 원시 없음). 재측정 관계는 기계 판독 블록 conditions.remeasureOf에 적는다(030 선례 — supersedes는 잘못 적은 기록의 정정 칸이다).

이 기록은 단계 하나의 상태를 적는다. **역전 구간은 단계 사이의 비교라 이 기록 단독으로 판정하지 않는다** — 정밀화 · 역전 구간 판정 기록(053)이 판정한다. 해석에는 이 단계에서 어느 쪽이 빠른지 · 앞 단계(048) 대비 변화 · 읽은 양으로 본 원리를 수치 크기 차로 적는다(048도 폐기 기록이라 단계 사이 비는 참고다). **이 기록은 폐기 기록이다 — 정본 인용 불가**(편차 기준 초과 · §폐기 · 예외).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(원시 run.commitHash — 모든 query · axis · i2-build 줄) · init git.dirty true — 1~5단계는 5492c73에 **미커밋 PGSS 키 수정**(scripts/lab/s5/grid/grid.py 한 곳 — 러너 쿼리 경로의 pg_stat_statements 스냅샷 키 · 이미지 밖)을 얹어 돌았고, 이 수정은 뒤에 커밋 c89b982로 들어갔다(리드 판정 5). 이 단계는 수정이 들어간 러너로 처음부터 돌았다(리드 판정 5 근거 · 원시 서버 null 0건 정황). 모드 D 채우기는 require_clean(apps/api · packages · infra) 통과 |
| 저장소 자원 | 대조 자원 조건(infra/compose/compose.control.yml) — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음" — 04 §조건 칸(2026-09-27 개정)의 도구 컨테이너 경로 조항에 따라 상한이 없다는 사실값이며 추정값으로 채우지 않는다. 대조 저장소 메모리는 조건 칸 controlMemoryMb(3,584 · 3,584)에 따로 적는다 |
| 용량 티어 | **해당 없음** — 근거: 06_experiment_catalog §대조군 실험 — EXP-01~05 공통 조건 "티어 해당 없음(행 수 격자 6단계가 축)"(원시 run.capacityTier 문자열 그대로). 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz)이고 행 수는 기간으로 키운다 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D + GEN-10은 ING를 거치지 않아 SW-09 동시 적재 경로가 아니다(대조군은 GEN-10 COPY가 같은 행을 채운다) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · ClickHouse) + GEN-10(대조군 COPY · 세션 synchronous_commit off — 서버 기본은 on) · 42 · 혼합(mixed) |
| 적재 방향 · 데이터 구간 | **미래 방향 누적** — 시작 S = 2026-09-25T01:06:20.000Z(KST 10:06:20) 고정 · 이 단계 [S, S + 100초) = 2026-09-25T01:06:20.000Z ~ 01:08:00.000Z · {end} = 01:08:00.000Z · 채우기 조각 1(01:06:30Z ~ 01:08:00Z · 900,000행 — 1단계 끝에서 이어 채움) · 전부 KST 일 파티션 p20260925 하나 · 단계 사이 복원 없음 |
| 쿼리 매개변수 | device 1 · tag 1 · Q5 문턱 v = 58(1단계 params 줄에서 고정 · 이 단계 선택도 0.4967 = 496,699 ÷ 1,000,000) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · **서버 로그 수준 — 이미지 기본 trace**(config.d에 logger 설정 없음 · text_log가 10분 약 470만 줄 규모로 쌓인다 · 측정 중 바꾸지 않았다 — W6 판정) · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(동기 · 파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2 인덱스 크기는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다 · 재기동 대기 1.2~1.3초) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | 대표값 = 클라이언트 — ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE · µs 해상도) · 호스트 CLI 직접(api를 거치지 않는다). 서버 시간을 함께 기록 — ClickHouse query_log µs · PostgreSQL pg_stat_statements total_exec_time 증가분 µs |
| 서버 시간 비대칭 | 두 엔진의 서버 시간은 같은 구간이 아니다(원시 conditions.serverTimeAsymmetry) — PostgreSQL은 실행만(track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse는 파싱 · 분석 · 계획 · 결과 전송 포함 |
| 편차 판정 기준 | 점(점 · 쿼리 · 캐시)마다 첫 ClickHouse 줄(반복 1)이 정한다 — CH client 중앙값 < 10 ms면 두 저장소 모두 서버 µs로 판정(06 §EXP-29~39 끝 2026-09-27 격자 불릿 · 양자화 값 제외). 이 단계는 **Q4(CH 반복 1 클라이언트 콜드 25 · 웜 27 ms)만 클라이언트 기준**이고 나머지 24개는 서버 기준이다 |
| 동률 규칙 | CH client 중앙값 < 10 ms이고 \|CH − PG\| client 중앙값 차 < 1 ms면 서버 µs 중앙값(반복 3개 서버 중앙값의 중앙값)으로 우열을 정한다(리드 판정 2 · 러너 pair 줄 tieWithinResolution) — 해당 점은 §결과 동률 표 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 호스트 교란 | 원시 없음(이 단계 창에 기록된 다른 측정 없음) |
| 안정화 | settle 4회 — 마지막 2026-09-27T03:19:16.044Z settled true(CH 활성 파트 2 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 2 → 3) · 앞선 false 3회(02:59:06Z · 03:07:51Z · 03:16:37Z)는 체크포인트 미경과 |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회 · 순서는 CH 반복 1~3 → PG I1 반복 1~3 → I2 반복 1~3) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **38.8%** · 기준 20% 초과 4개 |
| 중복 줄 | 같은 (점 · 저장소 · 인덱스 · 반복 · 쿼리 · 단계) 줄의 중복 없음(settle 4줄은 반복 호출이지 같은 측정의 중복이 아니다) |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · settle · axes · query · i2-build · i2-drop · snapshot) · 원시 docs/measurements/raw/049-control-stage-2.jsonl(232행 = 공통 init 1 + 점 "2" 줄 231 — 원래 순서 · 가공 없음) · 보조 snapshots/lab-s5-grid-f/explain/s2 · match/s2-*.json · results/s2 · 대조 스크립트 .omc/lab/grid2-w-grid-a/grid2.py |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥). 시각은 KST다.

```plain
① 예산      11:50:54  디스크 식 · 적재 시간 예산 성립(머리 만료까지 425,725초)
② 채우기    11:50:56  모드 D 900,000행 0.337초 · GEN-10 900,000행 0.369초
③ 정합      11:50:57  tag_raw 1,000,000 = 대조군 1,000,000 = countMerge(tag_1m) 1,000,000 · 구간 두 개 일치 · 구간 밖 0
④ 안정화    12:19:16  settle 4회째 true
⑤ 비 쿼리 축 12:19:23  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   12:19:23 ~ 12:22:55  CH → I1 → I2 빌드 0.276초 → I2 → I2 삭제 12:22:55
   스냅샷    12:23:15  lab-s5-grid-f-s2(볼륨 816,930,816 B · 17.4초)
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count(1단계 구간 100,000 · 이 단계 증가분 900,000)가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms. 서버 열은 반복 서버 중앙값 3개의 중앙값이다. 비교 열은 이긴 쪽과 비(PG ÷ CH)이며, 동률 점은 서버 중앙값으로 판정하고 비도 서버 값의 비다.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **13.105**(12.668 · 13.259 · 13.105) | **0.217**(0.239 · 0.217 · 0.194) | 2.376 · 12.895 · 0.034 | CH · 6.55 | PG I2 · 0.11 | PG I2 |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **13.131**(13.131 · 12.942 · 13.328) | **0.262**(0.262 · 0.257 · 0.267) | 2.646 · 12.865 · 0.053 | CH · 4.38 | PG I2 · 0.09 | PG I2 |
| Q3 설비 전체 1일 | **3**(3 · 3 · 3) | **13.762**(13.762 · 13.533 · 16.043) | **3.687**(3.695 · 3.687 · 3.628) | 3.042 · 13.508 · 3.449 | CH · 4.59 | CH · 1.13 · 동률 → 서버 | CH (서버) |
| Q4 분 단위 롤업 재계산 | **27**(27 · 23 · 29) | **168.561**(167.780 · 170.147 · 168.561) | **169.974**(169.974 · 167.937 · 172.387) | 26.634 · 162.566 · 163.766 | CH · 6.24 | CH · 6.30 | CH |
| Q5 비정렬 열 조건 count | **7**(7 · 8 · 7) | **15.089**(14.947 · 15.089 · 15.148) | **14.819**(14.819 · 14.723 · 14.861) | 7.308 · 14.847 · 14.575 | CH · 2.16 | CH · 2.12 | CH |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **11.350**(11.350 · 11.189 · 12.084) | **20.357**(20.357 · 22.501 · 18.674) | 0.619 · 11.247 · 20.244 | CH · 11.35 | CH · 20.36 | CH |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **3**(3 · 3 · 3) | **28.518**(38.261 · 27.418 · 28.518) | **1.777**(1.490 · 1.777 · 1.825) | 3.118 · 27.639 · 0.448 | CH · 9.51 | PG I2 · 0.59 | PG I2 |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **26.785**(26.673 · 32.798 · 26.785) | **1.832**(1.832 · 1.866 · 1.759) | 3.128 · 25.836 · 0.470 | CH · 8.93 | PG I2 · 0.61 | PG I2 |
| Q3 설비 전체 1일 | **4**(3 · 4 · 4) | **26.641**(28.113 · 26.641 · 26.250) | **6.611**(6.876 · 6.611 · 6.190) | 3.630 · 25.654 · 5.485 | CH · 6.66 | CH · 1.65 | CH |
| Q4 분 단위 롤업 재계산 | **27**(25 · 28 · 27) | **179.653**(182.795 · 179.653 · 178.786) | **178.113**(178.113 · 179.757 · 177.151) | 27.475 · 172.532 · 170.883 | CH · 6.65 | CH · 6.60 | CH |
| Q5 비정렬 열 조건 count | **9**(9 · 9 · 9) | **30.982**(29.766 · 30.982 · 36.118) | **32.599**(32.877 · 31.764 · 32.599) | 8.690 · 29.513 · 31.104 | CH · 3.44 | CH · 3.62 | CH |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **27.187**(25.258 · 27.364 · 27.187) | **72.743**(72.743 · 75.384 · 64.089) | 0.728 · 25.796 · 71.282 | CH · 27.19 | CH · 72.74 | CH |

### 동률 점 — 서버 µs로 판정

CH client 중앙값 < 10 ms이고 CH와 그 PG 변형의 client 중앙값 차가 1 ms 미만인 점이다(리드 판정 2). 원시 pair 줄의 반복별 tieWithinResolution과 같다(Q3 웜 CH 대 I2 반복 1~3).

| 점 | client 중앙값 CH · PG(ms) | 서버 중앙값 CH · PG(ms) | 판정 |
|------|------|------|------|
| Q3 웜 · CH 대 I2 | 3 · 3.687 | 3.042 · 3.449 | CH |

- 이 단계의 동률 판정은 클라이언트 중앙값의 순서와 같다 — 서버 판정이 우열을 바꾸지 않았다.

### 우열 3/3 — 구조 판정

우열(어느 쪽이 빠른가)은 반복마다의 부호다 — 반복 3회 모두 같은 쪽이 앞서면 그 칸의 우열은 구조 사실로 인용하고(04 §구조 판정과 분포 판정 — 3회 전부 성립 · 리드 판정 12 · 정본 조항 명시는 W6 리드), 반복 사이에 갈리면 우열 미정으로 두며 역전 구간의 끝점이 될 수 없다. 반복 값은 반복 줄의 median이고, 반복마다 CH client < 10 ms이고 차 < 1 ms면 서버 중앙값으로 정한다(ˢ 표시 — 원시 pair 줄 tieWithinResolution과 같다). 편차 폐기와 무관하게 인용할 수 있는 것은 이 표의 우열뿐이다 — 크기 수치(ms · 배수)는 폐기 기록이라 인용하지 않는다(리드 판정 13).

| 쿼리 | 캐시 | CH 대 I1(반복 1 · 2 · 3) | CH 대 I2(반복 1 · 2 · 3) |
|------|------|------|------|
| Q1 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q1 | 웜 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q2 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q2 | 웜 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q3 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q3 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CHˢ · CHˢ · CHˢ) |
| Q4 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q4 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |

- 검산: 칸 = 쿼리 5 × 캐시 2 × 변형 2 = **20** · 3/3 **20** · 갈림 **0**.

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid-f/results/s2)을 대조한 값이다(원시 match 6줄).

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 100 · 100 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0298 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0387 |
| Q4 | 20,000 · 20,000 | 일치 | 그룹 20,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.0876 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 496,699 = 496,699 |
| Q5x | 1 · 1 | 일치 | count 1,000,000 = 1,000,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 1~3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 41,000,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B · 힙 블록 9,352(heapMainBytes 76,611,584 B)이다. 노드는 계획 트리의 노드 종류를 처음 나온 순서로 적었다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 16,384(1.64%) | 304,274(0.74% · 18.6 B) | 9,355(hit 9,355 · read 0 · 100.0%) · Sort · Gather · Append · Seq Scan · 작업자 2 | 103(hit 103 · read 0 · 1.1%) · Merge Append · Index Scan · 작업자 0 | 100 |
| Q2 | 16,384(1.64%) | 295,992(0.72% · 18.1 B) | 9,355(hit 9,355 · read 0 · 100.0%) · Aggregate · Sort · Gather · Append · Seq Scan · 작업자 2 | 112(hit 112 · read 0 · 1.2%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 32,768(3.28%) | 786,432(1.92% · 24.0 B) | 9,366(hit 9,366 · read 0 · 100.1%) · Aggregate · Gather Merge · Sort · Append · Seq Scan · 작업자 2 | 20,084(hit 20,084 · read 0 · 214.8%) · Aggregate · Append · Index Scan · 작업자 0 | 200 |
| Q4 | 1,000,000(100.00%) | 25,000,000(60.98% · 25.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 20,000 |
| Q5 | 1,000,000(100.00%) | 8,000,000(19.51% · 8.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 9,352(hit 9,352 · read 0 · 100.0%) · Aggregate · Gather · Append · Seq Scan · 작업자 2 | 3,837(hit 3,837 · read 0 · 41.0%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다. 삽입 처리량은 이 단계 증가분(900,000행)의 값이다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 4,930,420 B(활성 파트 2 · Wide · Compact · 행당 4.93 B) | 77,152,256 B(테이블 76,660,736 · 인덱스 491,520 · 힙 행당 76.6 B) | PG ÷ CH 15.6배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 41,000,000 B ÷ 분모) | 8.32 | 0.535 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM · TOAST) |
| 3 | 삽입 처리량 | 2,670,623 rows/s(900,000행 · 0.337 초) | 2,439,024 rows/s(900,000행 · 0.369 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 1개 4,393,391 B) | 1.251(WAL 46,144,728 B · FPI 43 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 488) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 3,221 B(기본 키 940 + 마크 2,281) | I1 BRIN 245,760 B · I2 btree 31,637,504 B(빌드 0.276 초 · WAL 7,787,220 B) | I2 ÷ 힙 41.3% · I2 행당 31.6 B |

## 해석

- **이 단계의 앞선 쪽 — 단일 태그 조회(Q1 · Q2)는 PostgreSQL I2, 설비 조회(Q3) · 전 행 집계(Q4) · 비정렬 열 count(Q5)는 ClickHouse다.** 웜 중앙값으로 Q1 I2 0.217 ms · CH 2 ms · I1 13.105 ms, Q2 I2 0.262 ms · CH 3 ms, Q4 CH 27 ms · I1 168.561 ms · I2 169.974 ms, Q5 CH 7 ms · I2 14.819 ms · I1 15.089 ms다. Q3 웜은 CH 3 ms · I2 3.687 ms로 동률 점이라 서버 중앙값(CH 3.042 · I2 3.449 ms)으로 CH가 앞선다. 콜드도 같은 구도다 — Q1 · Q2 PG I2(1.777 · 1.832 ms 대 CH 3 ms) · Q3 CH(4 대 I2 6.611 ms) · Q4 · Q5 CH.
- **ClickHouse는 다섯 쿼리 모두에서 I1(BRIN만)보다 빠르다 — 웜 2.16~6.55배 · 콜드 3.44~9.51배.** 동률 점이 없어 전부 클라이언트 값의 비다.
- **1단계(048) 대비 — 행 10배에 PostgreSQL I1은 4.9~8.1배, ClickHouse는 1~3.4배 늘었다.** 웜 중앙값으로 I1 Q1 2.640 → 13.105 ms(5.0배) · Q4 20.755 → 168.561 ms(8.1배) · Q5 3.026 → 15.089 ms(5.0배), CH Q1 2 → 2 ms · Q4 8 → 27 ms(3.4배) · Q5 3 → 7 ms. I2의 단일 태그 조회는 거의 그대로다(Q1 0.177 → 0.217 ms). **Q3의 I2는 0.660 → 3.687 ms(5.6배)로 CH(2 → 3 ms)에 따라잡혔다** — 두 기록 모두 폐기라 이 비는 참고다.
- **Q3에서 I2가 밀리는 것은 인덱스로 따라간 행마다 버퍼를 하나씩 건드리는 비용으로 보인다(원시는 버퍼 수만 준다).** I2의 Q3는 결과 200행이지만 인덱스로 따라간 행(설비 1 · 태그 200 × 100초 = 20,000행) 하나에 버퍼 하나 꼴로 버퍼 20,084개(힙의 214.8%)를 건드린다 — 읽는 버퍼가 따라간 행 수와 함께 는다. ClickHouse는 같은 쿼리에 정렬 키 접두(device_id)로 그래뉼 4개(32,768행 · 테이블의 3.28%)만 읽는다. 단일 태그 Q1은 결과 100행이라 I2가 버퍼 103개로 끝낸다(힙의 1.1%).
- **I1은 이 단계부터 병렬 Seq Scan이다.** Q1 · Q2 · Q3 · Q5의 I1 계획에 Gather(작업자 2)가 붙었고 힙 9,352~9,366블록 전부를 읽는다 — 데이터 기간 100초가 여전히 모든 창(1시간 이상)보다 짧아 BRIN이 거를 블록이 없다. Q4는 작업자 0의 단일 Seq Scan이다.
- **열 단위 읽기 — Q5에서 읽은 바이트 차는 9.6배다.** ClickHouse는 1,000,000행의 value 한 열 8,000,000 B(행당 8.0 B · 공통 논리 크기의 19.5%)를 읽고, PostgreSQL은 I1 · I2 모두 힙 9,352블록(76,611,584 B)을 읽는다. Q5x(조건 없는 count)는 ClickHouse가 파트 메타데이터로 답해(read_rows 1) 1 ms, PostgreSQL I1 11.350 ms · I2 20.357 ms(Index Only Scan · 3,837블록)다.
- **비 쿼리 축 — 저장 용량 15.6배 · 삽입 처리량은 이 단계부터 ClickHouse가 높다.** ClickHouse 4,930,420 B(활성 파트 2 · 행당 4.93 B · 압축률 8.32) · PostgreSQL 77,152,256 B(힙 행당 76.6 B · 압축률 0.535). 삽입은 900,000행에 CH 0.337초(2,670,623 rows/s) · PG COPY 0.369초(2,439,024 rows/s)다. WAL 증폭 1.251 · ClickHouse 머지 0. I2 btree 31,637,504 B(힙의 41.3% · 빌드 0.276초 · 빌드 WAL 7,787,220 B).
- **한계 — 서버 시간 비대칭.** 동률 판정 값인 서버 시간은 PostgreSQL이 계획 시간을 빼고(이 단계 EXPLAIN planning 0.77~1.48 ms) ClickHouse가 파싱 · 분석 · 계획을 포함한다. 이 단계 동률 점 하나(Q3 웜 CH 대 I2)는 서버 판정과 클라이언트 순서가 같다.
- **한계 — ClickHouse 시간은 1 ms 해상도다.** 10 ms 미만인 CH 점(Q1 · Q2 · Q3 · Q5 · Q5x)은 편차를 서버 µs로 판정했고, Q4(25~29 ms)는 해상도가 값의 4% 이하라 클라이언트로 판정했다(06 2026-09-27 격자 불릿). 대표값(values · median)은 클라이언트 ms 그대로다.
- **한계 — ClickHouse 서버 로그 trace(리드 판정 8).** 이미지 기본 로그 수준이 trace라 조회마다 서버 로그 줄이 쓰이고 이 부하는 모든 ClickHouse 측정에 들어 있다 — PostgreSQL 쪽에는 같은 크기의 로그 부하가 없다. 측정 중 설정은 바꾸지 않았다(W6 판정) · 그 몫을 가르지 않았다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 4개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** PG I1 Q1 콜드 38.8%(서버 37.045 · 26.326 · 27.639 ms) · PG I1 Q2 콜드 23.4%(서버 25.710 · 31.757 · 25.836 ms) · PG I1 Q5 콜드 22.8%(서버 28.184 · 29.513 · 34.914 ms) · CH Q4 웜 22.2%(클라이언트 27.000 · 23.000 · 29.000 ms). 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이며, 판정 기준(s = 서버 · c = 클라이언트)은 아래 표와 같다.

| 쿼리 | CH 콜드 | CH 웜 | PG I1 콜드 | PG I1 웜 | PG I2 콜드 | PG I2 웜 |
|------|------|------|------|------|------|------|
| Q1 | 11.9% s | 5.5% s | **38.8%** s | 4.9% s | 8.7% s | 10.3% s |
| Q2 | 5.5% s | 2.7% s | **23.4%** s | 2.9% s | 18.1% s | 7.1% s |
| Q3 | 8.2% s | 12.2% s | 7.4% s | 18.2% s | 10.4% s | 3.1% s |
| Q4 | 11.1% c | **22.2%** c | 2.2% c | 1.4% c | 1.5% c | 2.6% c |
| Q5 | 9.1% s | 5.1% s | **22.8%** s | 1.5% s | 3.8% s | 1.1% s |

- **초과 넷의 성격.** PG I1 콜드 셋은 해상도가 충분한 값에서 반복 하나가 튄 것이다 — Q1은 반복 1(37.045 ms · 나머지 26.326 · 27.639), Q2는 반복 2(31.757), Q5는 반복 3(34.914)이다. 콜드는 재기동 직후 한 번의 실행이라 튄 값을 반복 안에서 거를 수 없다. CH Q4 웜은 클라이언트 기준(27 · 23 · 29 ms) 판정이며 서버 값(26.634 · 22.703 · 29.123 ms)도 같은 폭으로 흔들려 해상도 문제가 아니다.
- **1 ms 해상도 양자화는 판정에서 뺐다(리드 판정 3).** CH 클라이언트 값이 10 ms 미만인 점은 서버 기준으로 판정했다 — 예: CH Q3 콜드 클라이언트 3 · 4 · 4 ms(25.0%)는 서버 3.398 · 3.630 · 3.696 ms(8.2%)로 판정했다. 순간값(settle 표본 · 활성 파트 수)은 판정 지표가 아니다.
- **4요소 중 메모리 상한 null은 누락이 아니다.** run.memoryLimitSource가 있는 도구 컨테이너 경로의 null이다(04 §조건 칸 2026-09-27 개정) — 이 기록의 폐기 사유는 편차뿐이다.
- 안정화 false 3회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
- 불성립 구조 판정 없음(결과 동일성 6/6 · 구간 count 정합 성립) · 창에서 뺀 구간 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **이 기록의 수치를 정본에 올리지 않는다.** status discarded(편차 기준 초과)다. 구조 사실(§우열 3/3 표의 우열 — 20칸 모두 3/3 · 결과 집합 일치 6/6 · I1 병렬 Seq Scan · I2 Q3 Index Scan 버퍼 20,084(힙 블록 9,352 초과) · 읽은 행 수 · Q5x의 CH 메타데이터 읽기)만 인용할 수 있다(리드 판정 12 · 13). 역전 구간은 053이 판정한다.
- 제안(리드 판정) — 콜드 점은 반복당 한 번의 실행이라 튄 값 하나가 편차를 넘긴다(이 단계 초과 4개 중 3개가 PG I1 콜드). 콜드 반복 수 · 판정 방식을 04에서 다룰지.
- 미확인으로 남기는 것 — PG I1 콜드 튄 값의 원인(원시는 재기동 대기 1.2~1.3초만 준다) · 콜드 근사의 오차 · trace 로그 부하의 크기.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이다. 점마다 server(반복 서버 중앙값 · 중앙값)와 judgment(편차 판정 기준 · 편차)를 더했고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 · 동률 점 판정은 conditions.ties에 · 반복별 우열(구조 판정)은 dominance에 둔다(판독 규칙 7 — 모르는 필드는 무시). 값은 대조 스크립트(.omc/lab/grid2-w-grid-a/grid2.py block 2)가 원시에서 다시 계산한 것과 같다.

```json
{
  "schema": "measurement/v1",
  "record": "049",
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
    "start": "2026-09-27T03:19:23.786Z",
    "end": "2026-09-27T03:22:55.536Z"
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
    "gridStage": 2,
    "gridRows": 1000000,
    "gridGeneration": 2,
    "direction": "forward",
    "tierConfig": "device50-tag200-1hz",
    "apiStopped": true,
    "dataStart": "2026-09-25T01:06:20.000Z",
    "dataEnd": "2026-09-25T01:08:00.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:06:20.000Z",
      "end": "2026-09-25T01:08:00.000Z"
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
        "query": "Q3",
        "cache": "warm",
        "index": "I2",
        "winner": "CH",
        "by": "server"
      }
    ],
    "duplicateLinesRule": "last line per (point, store, index, rep, query, cache) is valid",
    "duplicateLines": {
      "supersededQueryLines": 0,
      "note": "none"
    },
    "remeasureOf": "036",
    "remeasureNote": "036 discarded (grid 1st: reverse-direction fill -> BRIN correlation 0.027 -> PG Seq Scan at 10^9, record 039) — grid 2nd forward fill; supersedes not used for discarded records",
    "runnerDirty": true,
    "runnerNote": "stages 1-5 ran on 5492c73 + uncommitted PGSS snapshot key fix (grid.py, runner query path, outside image) — committed later as c89b982",
    "clickhouseServerLogLevel": "trace (image default · no logger in config.d · unchanged during measurement)",
    "settledAt": "2026-09-27T03:19:16.044Z"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.3878,
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          3.123,
          2.753,
          3.118
        ],
        "median": 3.118
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.118666
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.249,
          2.376,
          2.38
        ],
        "median": 2.376
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.055135
      }
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
        38.261,
        27.418,
        28.518
      ],
      "median": 28.518,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          37.045291,
          26.326375,
          27.638708
        ],
        "median": 27.638708
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.387823
      }
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
        12.668,
        13.259,
        13.105
      ],
      "median": 13.105,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          12.418207,
          13.045083,
          12.894583
        ],
        "median": 12.894583
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.048615
      }
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
        1.49,
        1.777,
        1.825
      ],
      "median": 1.777,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.414541,
          0.4475,
          0.453667
        ],
        "median": 0.4475
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.087432
      }
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
        0.239,
        0.217,
        0.194
      ],
      "median": 0.217,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.036083,
          0.033916,
          0.032583
        ],
        "median": 0.033916
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.103196
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.971,
          3.144,
          3.128
        ],
        "median": 3.128
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.055307
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.682,
          2.61,
          2.646
        ],
        "median": 2.646
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.027211
      }
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
        26.673,
        32.798,
        26.785
      ],
      "median": 26.785,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          25.709708,
          31.757292,
          25.835542
        ],
        "median": 25.835542
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.23408
      }
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
        13.131,
        12.942,
        13.328
      ],
      "median": 13.131,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          12.864751,
          12.704208,
          13.0735
        ],
        "median": 12.864751
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.028706
      }
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
        1.832,
        1.866,
        1.759
      ],
      "median": 1.832,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.516749,
          0.470167,
          0.431708
        ],
        "median": 0.470167
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.180874
      }
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
        0.262,
        0.257,
        0.267
      ],
      "median": 0.262,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.054541,
          0.053042,
          0.050791
        ],
        "median": 0.053042
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.070699
      }
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
        3.0,
        4.0,
        4.0
      ],
      "median": 4.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          3.398,
          3.63,
          3.696
        ],
        "median": 3.63
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.082094
      }
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
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.842,
          3.213,
          3.042
        ],
        "median": 3.042
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.121959
      }
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
        28.113,
        26.641,
        26.25
      ],
      "median": 26.641,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          27.178,
          25.653625,
          25.277625
        ],
        "median": 25.653625
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.074078
      }
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
        13.762,
        13.533,
        16.043
      ],
      "median": 13.762,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          13.507541,
          13.290541,
          15.751208
        ],
        "median": 13.507541
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.18217
      }
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
        6.876,
        6.611,
        6.19
      ],
      "median": 6.611,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          5.63325,
          5.484666,
          5.060667
        ],
        "median": 5.484666
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.104397
      }
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
        3.695,
        3.687,
        3.628
      ],
      "median": 3.687,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.511292,
          3.449334,
          3.404791
        ],
        "median": 3.449334
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.030876
      }
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
        25.0,
        28.0,
        27.0
      ],
      "median": 27.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          24.916,
          27.718,
          27.475
        ],
        "median": 27.475
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.111111
      }
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
        27.0,
        23.0,
        29.0
      ],
      "median": 27.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          26.634,
          22.703,
          29.123
        ],
        "median": 26.634
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.222222
      }
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
        182.795,
        179.653,
        178.786
      ],
      "median": 179.653,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          175.107,
          172.532459,
          171.628542
        ],
        "median": 172.532459
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.022315
      }
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
        167.78,
        170.147,
        168.561
      ],
      "median": 168.561,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          161.648,
          164.196459,
          162.565834
        ],
        "median": 162.565834
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.014042
      }
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
        178.113,
        179.757,
        177.151
      ],
      "median": 178.113,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          170.882958,
          171.617208,
          169.996876
        ],
        "median": 170.882958
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.014631
      }
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
        169.974,
        167.937,
        172.387
      ],
      "median": 169.974,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          163.765917,
          161.676417,
          166.207292
        ],
        "median": 163.765917
      },
      "judgment": {
        "basis": "client",
        "deviation": 0.02618
      }
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
        9.0,
        9.0,
        9.0
      ],
      "median": 9.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          8.69,
          8.671,
          9.465
        ],
        "median": 8.69
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.091369
      }
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
        7.0,
        8.0,
        7.0
      ],
      "median": 7.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          7.289,
          7.665,
          7.308
        ],
        "median": 7.308
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.05145
      }
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
        29.766,
        30.982,
        36.118
      ],
      "median": 30.982,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          28.184167,
          29.513083,
          34.913584
        ],
        "median": 29.513083
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.228015
      }
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
        14.947,
        15.089,
        15.148
      ],
      "median": 15.089,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          14.702708,
          14.846958,
          14.924708
        ],
        "median": 14.846958
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.014953
      }
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
        32.877,
        31.764,
        32.599
      ],
      "median": 32.599,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          31.248042,
          30.076542,
          31.103542
        ],
        "median": 31.103542
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.037665
      }
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
        14.819,
        14.723,
        14.861
      ],
      "median": 14.819,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          14.574791,
          14.472958,
          14.634749
        ],
        "median": 14.574791
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.011101
      }
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 4930420,
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
      "value": 8.315721581528551,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 0.534823980818551,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 2670623.1454005935,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 1000000,
      "value": 2439024.3902439023,
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
      "value": 1.2505346341463415,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 1000000,
      "value": 3221,
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.779,
          0.71,
          0.728
        ],
        "median": 0.728
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.09478
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.605,
          0.667,
          0.619
        ],
        "median": 0.619
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.100162
      }
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
        25.258,
        27.364,
        27.187
      ],
      "median": 27.187,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          23.664667,
          25.796458,
          25.937375
        ],
        "median": 25.796458
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.088102
      }
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
        11.35,
        11.189,
        12.084
      ],
      "median": 11.35,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          11.247042,
          11.096,
          11.989334
        ],
        "median": 11.247042
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.079428
      }
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
        72.743,
        75.384,
        64.089
      ],
      "median": 72.743,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          71.281875,
          73.828,
          62.196
        ],
        "median": 71.281875
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.163183
      }
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
        20.357,
        22.501,
        18.674
      ],
      "median": 20.357,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          20.244084,
          22.334833,
          18.562874
        ],
        "median": 20.244084
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.186324
      }
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
      "sharedHitBlocks": 112,
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
