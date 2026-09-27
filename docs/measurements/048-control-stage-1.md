# 048 — 대조군 역전 지점 격자 2차 1단계(10^5행): ClickHouse 대 PostgreSQL I1 · I2 쿼리 5종 · 비 쿼리 축 (S5 · 모드 D + GEN-10 · 미래 방향 적재)

> 실험: EXP-01 · EXP-02 · EXP-03 · EXP-04 · EXP-05 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(기록 035 폐기 뒤 재측정 — supersedes 아님) · 판정 창: 2026-09-27T02:44:46.869Z ~ 2026-09-27T02:50:30.706Z(쿼리 축 · 첫 쿼리 시작 ~ 마지막 쿼리 끝) · 실행 2026-09-27 11:27:35 ~ 11:50:44 KST(단계 예산 확인 ~ 채움 스냅샷)

격자 2차 1단계는 대조 테이블 두 개(ClickHouse plc.tag_raw · PostgreSQL plc_tag_raw_control)에 같은 행 100,000개(M 구성 설비 50 × 태그 200 = 태그 10,000 × 1 Hz × 10초)를 두고, 동일 쿼리 5종(05_data_stores/10 §동일 쿼리 5종)을 저장소 3팔(ClickHouse · PostgreSQL I1 BRIN(ts) · PostgreSQL I2 BRIN + btree(device_id, tag_id, ts)) × 콜드 · 웜 × 반복 3으로 잰 기록이다. 비 쿼리 축(저장 용량 · 압축률 · 삽입 처리량 · VACUUM/WAL 증폭 · 인덱스 크기)은 이 단계 기록 하나에 싣고 EXP-01~05가 공유한다(05_data_stores/10 §EXP 예약 대역 연결 · W6 판정).

**이 기록은 격자 1차 1단계(035 · 폐기)의 재측정이다.** 1차 폐기의 원인은 역방향 적재(데이터 끝을 고정하고 과거로 채움)였다 — 파티션 물리 순서가 시간과 어긋나 5단계에서 ts 상관이 0.027로 떨어졌고 PostgreSQL 플래너가 BRIN을 버리고 Seq Scan을 골랐다(기록 039). 2차는 시작 시각 S를 고정하고 미래 방향(시간 순)으로 누적해 이 원인을 없앴다(ts 상관 0.99999 — 리드 실측 · 원시 없음). 재측정 관계는 기계 판독 블록 conditions.remeasureOf에 적는다(030 선례 — supersedes는 잘못 적은 기록의 정정 칸이다).

이 기록은 단계 하나의 상태를 적는다. **역전 구간은 단계 사이의 비교라 이 기록 단독으로 판정하지 않는다** — 정밀화 · 역전 구간 판정 기록(053)이 판정한다. 해석에는 이 단계에서 어느 쪽이 빠른지와 읽은 양으로 본 원리를 수치 크기 차로 적는다. **이 기록은 폐기 기록이다 — 정본 인용 불가**(편차 기준 초과 · §폐기 · 예외).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(원시 run.commitHash — 모든 query · axis · i2-build 줄) · init git.dirty true — 1~5단계는 5492c73에 **미커밋 PGSS 키 수정**(scripts/lab/s5/grid/grid.py 한 곳 — 러너 쿼리 경로의 pg_stat_statements 스냅샷 키 · 이미지 밖)을 얹어 돌았고, 이 수정은 뒤에 커밋 c89b982로 들어갔다(리드 판정 5). 모드 D 채우기는 require_clean(apps/api · packages · infra) 통과 |
| 저장소 자원 | 대조 자원 조건(infra/compose/compose.control.yml) — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null** · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음" — 04 §조건 칸(2026-09-27 개정)의 도구 컨테이너 경로 조항에 따라 상한이 없다는 사실값이며 추정값으로 채우지 않는다. 대조 저장소 메모리는 조건 칸 controlMemoryMb(3,584 · 3,584)에 따로 적는다 |
| 용량 티어 | **해당 없음** — 근거: 06_experiment_catalog §대조군 실험 — EXP-01~05 공통 조건 "티어 해당 없음(행 수 격자 6단계가 축)"(원시 run.capacityTier 문자열 그대로). 데이터 구성은 M(설비 50 × 태그 200 · 1 Hz)이고 행 수는 기간으로 키운다 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 모드 D + GEN-10은 ING를 거치지 않아 SW-09 동시 적재 경로가 아니다(대조군은 GEN-10 COPY가 같은 행을 채운다) |
| 주입 모드 · 시드 · 신호 | D(과거 ts 백필 · ClickHouse) + GEN-10(대조군 COPY · 세션 synchronous_commit off — 서버 기본은 on) · 42 · 혼합(mixed) |
| 적재 방향 · 데이터 구간 | **미래 방향 누적** — 시작 S = 2026-09-25T01:06:20.000Z(KST 10:06:20 · 규칙 S = KST 자정 − 50,020초) 고정 · 이 단계 [S, S + 10초) = 2026-09-25T01:06:20.000Z ~ 01:06:30.000Z · {end} = 01:06:30.000Z · 채우기 조각 1(100,000행) · 전부 KST 일 파티션 p20260925 하나 · 머리 만료 2026-10-02T01:06:20Z |
| 쿼리 매개변수 | device 1 · tag 1((device_id, tag_id) 사전순 첫 쌍) · Q5 문턱 v = 58(1단계 적재 직후 quantileExact(0.5)(value) · 선택도 0.49599 · 이후 단계 고정 — params 줄) · {end} = 데이터 끝 |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · **서버 로그 수준 — 이미지 기본 trace**(config.d에 logger 설정 없음 · text_log가 10분 약 470만 줄 규모로 쌓인다 · 측정 중 바꾸지 않았다 — W6 판정) · PostgreSQL shared_buffers 896MB · work_mem 16MB · max_parallel_workers_per_gather 2 · jit on · checkpoint_timeout 15min |
| 인덱스 변형 | I1(BRIN(ts)) 상태에서 CH · I1 쿼리 → I2 빌드(동기 · 파티션별 CREATE INDEX + ATTACH) → I2 쿼리 → I2 삭제. 비 쿼리 축은 I1 상태에서 잰다(I2 인덱스 크기는 빌드 줄) |
| 캐시 상태 | 콜드 = 두 저장소 컨테이너 재기동 직후 첫 실행(근사 — OS 페이지 캐시는 비우지 않는다 · 재기동 대기 1.2~1.3초) · 웜 = 예열 1회 뒤 3회 실행, 반복 값은 그 3회의 중앙값 |
| 시간 계측 | 대표값 = 클라이언트 — ClickHouse clickhouse-client --time(1 ms 해상도) · PostgreSQL psql \timing(PREPARE된 문장 EXECUTE · µs 해상도) · 호스트 CLI 직접(api를 거치지 않는다). 서버 시간을 함께 기록 — ClickHouse query_log µs · PostgreSQL pg_stat_statements total_exec_time 증가분 µs |
| 서버 시간 비대칭 | 두 엔진의 서버 시간은 같은 구간이 아니다(원시 conditions.serverTimeAsymmetry) — PostgreSQL은 실행만(track_planning off라 계획 시간 제외 · 준비된 문장의 custom plan 계획도 빠진다) · ClickHouse는 파싱 · 분석 · 계획 · 결과 전송 포함 |
| 편차 판정 기준 | 점(점 · 쿼리 · 캐시)마다 첫 ClickHouse 줄(반복 1)이 정한다 — CH client 중앙값 < 10 ms면 두 저장소 모두 서버 µs로 판정(06 §EXP-29~39 끝 2026-09-27 격자 불릿 · 양자화 값 제외). 이 단계는 CH 값이 전부 10 ms 미만이라 **판정 지표 30개 전부 서버 기준**이다 |
| 동률 규칙 | CH client 중앙값 < 10 ms이고 \|CH − PG\| client 중앙값 차 < 1 ms면 서버 µs 중앙값(반복 3개 서버 중앙값의 중앙값)으로 우열을 정한다(리드 판정 2 · 러너 pair 줄 tieWithinResolution) — 해당 점은 §결과 동률 표 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml + compose.control.yml) · 재지 않음 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 호스트 교란 | 직전 역방향 측정(046 · 047 원시 마지막 줄 2026-09-27T02:25:00Z)이 격자 init(02:27:24Z)보다 앞서 끝났다 — 겹침 없음. 그 밖의 호스트 작업은 원시 없음 |
| 안정화 | settle 2회 — 마지막 2026-09-27T02:44:35.707Z settled true(CH 활성 파트 1 3표본 불변 · 머지 0 · PG autovacuum 유휴 · 삽입 기준 대기 0 · 채우기 뒤 체크포인트 경과 1 → 2) · 앞선 false(02:36:21Z)는 체크포인트 미경과 |
| 반복 · 편차 | 쿼리 축 3회(04 §실험 한 번의 절차 — 대조 격자는 쿼리 축에서 반복 · 적재는 단계당 1회 · 순서는 CH 반복 1~3 → PG I1 반복 1~3 → I2 반복 1~3) · 판정 지표 30(Q1~Q5 × 3팔 × 콜드 · 웜 · Q5x 보조 관찰 제외) 최대 편차 **36.9%** · 기준 20% 초과 3개 |
| 중복 줄 | 같은 (점 · 저장소 · 인덱스 · 반복 · 쿼리 · 단계) 줄이 여럿이면 **마지막 줄이 유효하다.** 이 단계는 PG I1 반복 1~3 전부가 두 번 있다 — 첫 측정(02:46:01Z~02:47:05Z · 첫 줄 window.start ~ 마지막 줄 window.end)에서 반복 2 · 3의 Q2 · Q4 · Q5 · Q5x 서버 시간이 null(16줄 · PGSS 스냅샷 키 결함 — 같은 queryid의 다른 toplevel 행이 증분을 덮었다)이라 러너 수정(키 userid:queryid:toplevel) 뒤 반복 1~3을 explain과 함께 다시 쟀다(02:48:22Z~02:49:24Z · 같은 기준). 앞 줄(query 36 · pair 36 · explain 6)은 판정에 쓰지 않는다. CH 줄은 수정 전에 쟀으나 이 결함은 PG 서버 시간 경로만 건드린다 |
| 스크립트 · 원시 | scripts/lab/s5/grid/grid.sh(budget · fill · check · params · settle · axes · query · i2-build · i2-drop · snapshot) · 원시 docs/measurements/raw/048-control-stage-1.jsonl(309행 = 공통 init 1 + params 1 + 점 "1" 줄 307 — 원래 순서 · 가공 없음 · 정밀화 점의 base 복원 줄은 넣지 않는다 — 리드 판정 11) · 보조 snapshots/lab-s5-grid-f/explain/s1 · match/s1-*.json · results/s1 · 대조 스크립트 .omc/lab/grid2-w-grid-a/grid2.py |

단계 하나를 아래 순서로 돌렸다(05_data_stores/10 §역전 지점 탐색 설계 단계 절차 ①~⑥). 시각은 KST다.

```plain
① 예산      11:27:35  디스크 식 · 적재 시간 예산 성립(머리 만료까지 427,125초)
② 채우기    11:27:36  모드 D 100,000행 0.117초 · GEN-10 100,000행 0.071초
③ 정합      11:27:36  tag_raw 100,000 = 대조군 100,000 = countMerge(tag_1m) 100,000 · 구간 밖 0
   params   11:27:37  Q5 문턱 58 · device 1 · tag 1
④ 안정화    11:44:35  settle 2회째 true
⑤ 비 쿼리 축 11:44:46  축 1 · 2 · 3 · 5 · 6(I1 상태)
⑥ 쿼리 축   11:44:46 ~ 11:50:30  CH → I1(첫 측정 11:46:01 ~ 11:47:05 · 재측정 11:48:22 ~ 11:49:24) → I2 빌드 0.059초 → I2 → I2 삭제 11:50:31
   스냅샷    11:50:44  lab-s5-grid-f-s1(볼륨 523,132,928 B · 11.5초) — 정밀화 r5.5의 복원점
```

- **③이 성립해야 이 단계 수치가 유효하다.** 구간별 count가 세 곳에서 같아 두 저장소가 같은 행 집합을 갖는다(REQ-NFR-18).
- **④는 체크포인트 경과를 기다린다.** 적재 직후 재면 VACUUM/WAL 증폭이 0에 가깝게 보인다 — settled true 뒤의 축 값만 싣는다.
- **⑥의 I2는 I1 쿼리가 끝난 뒤 짓는다.** I1 시간에 btree 유지 비용이 섞이지 않게 하고, 비 쿼리 축은 btree 없는 상태의 값이다.

## 결과

### 쿼리 시간 — 웜

반복 3의 값(각 반복은 예열 뒤 3회 실행의 중앙값)과 그 중앙값(굵게)이다. 단위 ms. 서버 열은 반복 서버 중앙값 3개의 중앙값이다. 비교 열은 이긴 쪽과 비(PG ÷ CH)이며, 동률 점은 서버 중앙값으로 판정하고 비도 서버 값의 비다.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **2.640**(2.640 · 2.693 · 2.616) | **0.177**(0.194 · 0.177 · 0.177) | 1.879 · 2.456 · 0.011 | CH · 1.31 · 동률 → 서버 | PG I2 · 0.09 | PG I2 |
| Q2 단일 태그 7일 | **2**(2 · 2 · 2) | **2.553**(2.444 · 2.644 · 2.553) | **0.251**(0.238 · 0.251 · 0.294) | 2.286 · 2.354 · 0.029 | CH · 1.03 · 동률 → 서버 | PG I2 · 0.13 | PG I2 |
| Q3 설비 전체 1일 | **2**(2 · 2 · 2) | **2.837**(2.930 · 2.804 · 2.837) | **0.660**(0.638 · 0.660 · 0.662) | 2.212 · 2.649 · 0.426 | CH · 1.20 · 동률 → 서버 | PG I2 · 0.33 | PG I2 |
| Q4 분 단위 롤업 재계산 | **8**(8 · 8 · 8) | **20.755**(21.336 · 20.737 · 20.755) | **20.698**(20.372 · 20.698 · 20.861) | 8.086 · 17.710 · 17.500 | CH · 2.59 | CH · 2.59 | CH |
| Q5 비정렬 열 조건 count | **3**(3 · 3 · 3) | **3.026**(3.035 · 2.948 · 3.026) | **3.111**(3.137 · 3.111 · 2.857) | 2.760 · 2.843 · 2.926 | CH · 1.03 · 동률 → 서버 | CH · 1.06 · 동률 → 서버 | CH (서버) |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **2.284**(2.256 · 2.284 · 2.333) | **3.794**(3.616 · 3.794 · 3.834) | 0.639 · 2.204 · 3.700 | CH · 2.28 | CH · 3.79 | CH |

- 검산: 쿼리 = 판정 5 + 보조 1(Q5x) = **6** · 팔 = **3**

### 쿼리 시간 — 콜드

반복마다 두 컨테이너를 재기동한 직후 첫 실행 1회다. 단위 ms.

| 쿼리 | CH | PG I1 | PG I2 | 서버 중앙값 CH · I1 · I2 | CH 대 I1(I1 ÷ CH) | CH 대 I2(I2 ÷ CH) | 가장 빠른 쪽 |
|------|------|------|------|------|------|------|------|
| Q1 단일 태그 1시간 | **2**(2 · 2 · 2) | **4.890**(4.890 · 5.071 · 4.727) | **1.292**(1.433 · 1.095 · 1.292) | 2.165 · 3.804 · 0.058 | CH · 2.44 | PG I2 · 0.03 · 동률 → 서버 | PG I2 (서버) |
| Q2 단일 태그 7일 | **3**(3 · 3 · 3) | **4.769**(4.467 · 5.763 · 4.769) | **1.227**(1.247 · 1.167 · 1.227) | 2.531 · 3.869 · 0.086 | CH · 1.59 | PG I2 · 0.41 | PG I2 |
| Q3 설비 전체 1일 | **3**(3 · 3 · 3) | **5.226**(5.226 · 5.270 · 4.993) | **1.728**(2.166 · 1.728 · 1.717) | 2.497 · 4.101 · 0.616 | CH · 1.74 | PG I2 · 0.58 | PG I2 |
| Q4 분 단위 롤업 재계산 | **8**(9 · 8 · 8) | **24.451**(23.383 · 24.507 · 24.451) | **25.296**(25.296 · 25.156 · 26.046) | 8.244 · 20.255 · 21.176 | CH · 3.06 | CH · 3.16 | CH |
| Q5 비정렬 열 조건 count | **3**(3 · 3 · 3) | **5.367**(5.367 · 5.339 · 6.041) | **6.120**(6.147 · 6.120 · 5.482) | 2.980 · 4.134 · 4.163 | CH · 1.79 | CH · 2.04 | CH |
| Q5x 조건 없는 count(보조) | **1**(1 · 1 · 1) | **4.905**(4.905 · 5.137 · 4.675) | **9.281**(9.281 · 9.002 · 9.899) | 0.721 · 3.625 · 7.525 | CH · 4.91 | CH · 9.28 | CH |

### 동률 점 — 서버 µs로 판정

CH client 중앙값 < 10 ms이고 CH와 그 PG 변형의 client 중앙값 차가 1 ms 미만인 점이다(리드 판정 2). 원시 pair 줄의 반복별 tieWithinResolution은 이 표에 더해 Q3 콜드 CH 대 I2 반복 1에도 true다(반복 1 CH 3 · I2 2.166 ms) — 반복 3개 중앙값(3 · 1.728 ms · 차 1.272 ms)은 동률이 아니라 클라이언트로 판정했다.

| 점 | client 중앙값 CH · PG(ms) | 서버 중앙값 CH · PG(ms) | 판정 |
|------|------|------|------|
| Q1 콜드 · CH 대 I2 | 2 · 1.292 | 2.165 · 0.058 | PG I2 |
| Q1 웜 · CH 대 I1 | 2 · 2.640 | 1.879 · 2.456 | CH |
| Q2 웜 · CH 대 I1 | 2 · 2.553 | 2.286 · 2.354 | CH |
| Q3 웜 · CH 대 I1 | 2 · 2.837 | 2.212 · 2.649 | CH |
| Q5 웜 · CH 대 I1 | 3 · 3.026 | 2.760 · 2.843 | CH |
| Q5 웜 · CH 대 I2 | 3 · 3.111 | 2.760 · 2.926 | CH |

- 이 단계의 동률 판정 6개는 모두 클라이언트 중앙값의 순서와 같다 — 서버 판정이 우열을 바꾼 점은 없다.

### 우열 3/3 — 구조 판정

우열(어느 쪽이 빠른가)은 반복마다의 부호다 — 반복 3회 모두 같은 쪽이 앞서면 그 칸의 우열은 구조 사실로 인용하고(04 §구조 판정과 분포 판정 — 3회 전부 성립 · 리드 판정 12 · 정본 조항 명시는 W6 리드), 반복 사이에 갈리면 우열 미정으로 두며 역전 구간의 끝점이 될 수 없다. 반복 값은 반복 줄의 median이고, 반복마다 CH client < 10 ms이고 차 < 1 ms면 서버 중앙값으로 정한다(ˢ 표시 — 원시 pair 줄 tieWithinResolution과 같다). 편차 폐기와 무관하게 인용할 수 있는 것은 이 표의 우열뿐이다 — 크기 수치(ms · 배수)는 폐기 기록이라 인용하지 않는다(리드 판정 13).

| 쿼리 | 캐시 | CH 대 I1(반복 1 · 2 · 3) | CH 대 I2(반복 1 · 2 · 3) |
|------|------|------|------|
| Q1 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PGˢ · PGˢ · PGˢ) |
| Q1 | 웜 | CH 3/3(CHˢ · CHˢ · CHˢ) | PG 3/3(PG · PG · PG) |
| Q2 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PG · PG · PG) |
| Q2 | 웜 | CH 3/3(CHˢ · CHˢ · CHˢ) | PG 3/3(PG · PG · PG) |
| Q3 | 콜드 | CH 3/3(CH · CH · CH) | PG 3/3(PGˢ · PG · PG) |
| Q3 | 웜 | CH 3/3(CHˢ · CHˢ · CHˢ) | PG 3/3(PG · PG · PG) |
| Q4 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q4 | 웜 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 콜드 | CH 3/3(CH · CH · CH) | CH 3/3(CH · CH · CH) |
| Q5 | 웜 | **갈림 — 우열 미정**(PGˢ · CHˢ · CHˢ) | **갈림 — 우열 미정**(CHˢ · CHˢ · PGˢ) |

- 검산: 칸 = 쿼리 5 × 캐시 2 × 변형 2 = **20** · 3/3 **18** · 갈림 **2**(Q5 웜 CH 대 I1 · CH 대 I2). 두 칸은 반복마다 서버 차가 11 µs~0.17 ms인 동률 점이다(반복 서버 중앙값 CH 2.889 · 2.760 · 2.716 · I1 2.878 · 2.784 · 2.843 · I2 2.970 · 2.926 · 2.685 ms) — 중앙값 판정은 CH이나 구조 사실로는 이 단계 Q5 웜의 우열이 정해지지 않는다.

### 결과 동일성

두 저장소 결과 파일(snapshots/lab-s5-grid-f/results/s1)을 대조한 값이다(원시 match 6줄 · 첫 측정 때 capture로 자동 대조 — PG I1 재측정은 결과 파일을 다시 뜨지 않았다).

| 쿼리 | 결과 행 CH · PG | 대조 | 세부 |
|------|------|------|------|
| Q1 | 10 · 10 | 일치 | ts · value · quality 행 단위 정확 일치 |
| Q2 | 1 · 1 | 일치 | 그룹 1 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q3 | 200 · 200 | 일치 | 그룹 200 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 |
| Q4 | 10,000 · 10,000 | 일치 | 그룹 10,000 · 불일치 0 · avg 차 ÷ 상계 최대 0.0000 · tag_1m -Merge 대조 일치(불일치 그룹 0) |
| Q5 | 1 · 1 | 일치 | count 49,599 = 49,599 |
| Q5x | 1 · 1 | 일치 | count 100,000 = 100,000 |

- 검산: 일치 = **6**/6 — 구조 판정(결과 집합 일치)은 성립한다. avg 허용식은 |Δavg| ≤ 2·γ(n)·S/n(러너 as-built)이고 count · min · max · bad_cnt는 정확 일치다.

### 읽은 양 — 원리 지표

ClickHouse는 반복 1 웜 첫 측정의 system.query_log(read_rows · read_bytes — read_bytes는 비압축 크기)다. 반복 1~3 · 콜드 · 웜 전부에서 같은 값이다. 공통 논리 크기는 행 수 × 41 B = 4,100,000 B다. PostgreSQL 쪽 수치는 반복 1의 EXPLAIN(ANALYZE · BUFFERS · FORMAT JSON) 별도 실행이다(I1은 재측정 때의 explain 줄 · 시간 판정에 쓰지 않는다). 버퍼 블록은 최상위 노드의 shared hit + read이며 한 블록 8,192 B · 힙 블록 976(heapMainBytes 7,995,392 B)이다. 노드는 계획 트리의 노드 종류를 처음 나온 순서로 적었다.

| 쿼리 | CH read_rows(÷ 전체 행) | CH read_bytes(÷ 공통 논리 크기 · 행당) | PG I1 버퍼 블록(÷ 힙 블록) · 노드 | PG I2 버퍼 블록(÷ 힙 블록) · 노드 | 결과 행 |
|------|------|------|------|------|------|
| Q1 | 8,192(8.19%) | 204,800(5.00% · 25.0 B) | 979(hit 979 · read 0 · 100.3%) · Sort · Append · Seq Scan · 작업자 0 | 13(hit 13 · read 0 · 1.3%) · Merge Append · Index Scan · 작업자 0 | 10 |
| Q2 | 8,192(8.19%) | 196,608(4.80% · 24.0 B) | 979(hit 979 · read 0 · 100.3%) · Aggregate · Sort · Append · Seq Scan · 작업자 0 | 22(hit 22 · read 0 · 2.3%) · Aggregate · Sort · Append · Index Scan · 작업자 0 | 1 |
| Q3 | 8,192(8.19%) | 196,608(4.80% · 24.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 2,015(hit 2,015 · read 0 · 206.5%) · Aggregate · Append · Index Scan · 작업자 0 | 200 |
| Q4 | 100,000(100.00%) | 2,500,000(60.98% · 25.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 10,000 |
| Q5 | 100,000(100.00%) | 800,000(19.51% · 8.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 1 |
| Q5x | 1(0.00%) | 16(0.00% · 16.0 B) | 976(hit 976 · read 0 · 100.0%) · Aggregate · Append · Seq Scan · 작업자 0 | 389(hit 389 · read 0 · 39.9%) · Aggregate · Gather · Append · Index Only Scan · Seq Scan · 작업자 2 | 1 |

### 비 쿼리 축

I1 상태 · 안정화 뒤 값이다(축 4 쿼리 시간은 위 표). 비교 축 6의 번호를 그대로 쓴다.

| # | 축 | ClickHouse | PostgreSQL | 비 · 비고 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | 537,029 B(활성 파트 1 · Compact · 행당 5.37 B) | 8,519,680 B(테이블 8,028,160 · 인덱스 491,520 · 힙 행당 80.0 B) | PG ÷ CH 15.9배 — I1 상태(btree 없음) |
| 2 | 압축률(공통 논리 크기 4,100,000 B ÷ 분모) | 7.63 | 0.511 | 분모 CH bytes_on_disk · PG pg_table_size(힙 · FSM · VM · TOAST) |
| 3 | 삽입 처리량 | 854,701 rows/s(100,000행 · 0.117 초) | 1,408,451 rows/s(100,000행 · 0.071 초) | 단계 증가분 단독 적재 · PG는 COPY synchronous_commit off · btree 없이 |
| 5 | VACUUM/WAL 증폭 | 0.00(머지 0 · 머지 쓰기 0 B · 삽입 파트 1개 537,029 B) | 1.385(WAL 5,679,986 B · FPI 270 · autovacuum 1 · autoanalyze 1 · 최대 relfrozenxid 나이 24) | 채우기 시작 ~ 안정화 뒤 · PG 분모 = 증가 행 × 41 B |
| 6 | 인덱스 크기 | 360 B(기본 키 52 + 마크 308) | I1 BRIN 245,760 B · I2 btree 3,252,224 B(빌드 0.059 초 · WAL 643,491 B) | I2 ÷ 힙 40.7% · I2 행당 32.5 B |

## 해석

- **이 단계의 앞선 쪽 — 단일 태그 조회(Q1 · Q2)와 설비 조회(Q3)는 PostgreSQL I2, 전 행 집계(Q4)와 비정렬 열 count(Q5)는 ClickHouse다.** 웜 중앙값으로 Q1 I2 0.177 ms · CH 2 ms · I1 2.640 ms, Q3 I2 0.660 ms · CH 2 ms, Q4 CH 8 ms · I2 20.698 ms · I1 20.755 ms다. Q5 웜은 CH 3 ms · I1 3.026 ms · I2 3.111 ms로 동률 점이라 서버 중앙값(CH 2.760 · I1 2.843 · I2 2.926 ms)으로 CH가 앞서지만, **반복별로는 우열이 갈려(I1 PG · CH · CH · I2 CH · CH · PG) 구조 사실로는 우열 미정이다**(§우열 3/3). 콜드도 같은 구도다 — Q1 · Q2 · Q3 PG I2 · Q4 · Q5 CH.
- **ClickHouse는 중앙값으로 다섯 쿼리 모두에서 I1(BRIN만)보다 빠르다 — 반복 3/3으로는 Q5 웜을 뺀 9칸이다.** 웜 Q1 · Q2 · Q3 · Q5는 동률 점이라 서버 값으로 판정했고(I1 ÷ CH 서버 비 1.03~1.31), 콜드는 클라이언트 값 그대로 1.59~3.06배다.
- **10만 행에서 I2가 이기는 이유는 읽는 양의 해상도다.** I2의 Q1은 버퍼 블록 13개(힙 976블록의 1.3%)로 결과 10행을 찾는다. ClickHouse는 같은 쿼리에 그래뉼 하나(8,192행 = 테이블의 8.19%)를 읽는다 — 희소 인덱스의 최소 단위가 테이블에 비해 굵고, 조건 없는 count(Q5x — 파트 메타데이터만 읽는다 · read_rows 1)조차 클라이언트 1 ms · 서버 0.639 ms가 걸리는 쿼리 고정 비용이 바닥을 정한다. 서버 시간으로 보면 I2 Q1 웜은 0.011 ms, CH는 1.879 ms다.
- **열 단위 읽기는 이 단계에서도 수치로 보인다 — 시간 차가 작을 뿐이다.** Q5(value > 58)에서 ClickHouse는 100,000행 전부를 읽지만 read_bytes는 800,000 B, 행당 8.0 B로 value 한 열(Float64)만 읽었다 — 공통 논리 크기의 19.5%다. PostgreSQL은 I1 · I2 모두 Seq Scan으로 힙 976블록 전부(7,995,392 B)를 읽는다 — ClickHouse가 읽은 바이트의 10.0배다. Q4는 ClickHouse가 행당 25.0 B(쿼리에 나오는 다섯 열)를 읽어 논리 크기의 61.0%다.
- **I1(BRIN)은 이 단계에서 가지치기할 것이 없다 — 창이 데이터보다 길다.** 데이터 기간이 10초라 Q1(1시간) · Q2(7일) · Q3(1일) · Q4(1시간) 창이 테이블 전부를 덮고, I1 계획은 전부 Seq Scan(힙 976~979블록)이다. 설계 문서의 "테이블이 창보다 짧으면 쿼리가 테이블 전부를 읽는다 — 작은 단계에서 의도된 동작"(§동일 쿼리 5종)이 계획 노드로 확인된다. I2의 Q3는 태그 200개를 인덱스로 따라가며 버퍼 2,015개(힙의 206.5% — 같은 페이지를 여러 번 센다)를 건드려도 0.660 ms다.
- **비 쿼리 축 — 저장 용량은 이미 15.9배 차이다.** ClickHouse 537,029 B(행당 5.37 B · 압축률 7.63) · PostgreSQL 8,519,680 B(힙 행당 80.0 B · 압축률 0.511 — 튜플 헤더로 논리 크기보다 크다). 삽입 처리량은 이 단계만 PostgreSQL이 높다(1,408,451 대 854,701 rows/s) — 10만 행 0.071 · 0.117초의 짧은 적재라 고정 비용의 비교다. WAL 증폭 1.385(WAL 5,679,986 B ÷ 4,100,000 B)이고 ClickHouse는 머지 0이다. I2 btree는 3,252,224 B로 힙의 40.7%다.
- **한계 — 서버 시간 비대칭.** 동률 점의 판정 값인 서버 시간은 두 엔진이 같은 구간을 재지 않는다 — PostgreSQL은 계획 시간이 빠지고(이 단계 EXPLAIN planning 0.67~1.51 ms — 준비된 문장의 custom plan 계획도 total_exec_time 밖) ClickHouse는 파싱 · 분석 · 계획을 포함한다. 이 단계 동률 점은 서버 판정과 클라이언트 순서가 모두 같아 결론이 비대칭에 좌우되지 않았다.
- **한계 — ClickHouse 시간은 1 ms 해상도다.** 이 단계 CH 값은 1 · 2 · 3 · 8 · 9 ms뿐이다 — 한 칸이 값의 11~100%라 편차 판정은 서버 µs로 했다(06 2026-09-27 격자 불릿). 대표값(values · median)은 클라이언트 ms 그대로다.
- **한계 — ClickHouse 서버 로그 trace(리드 판정 8).** 이미지 기본 로그 수준이 trace라 조회마다 서버 로그 줄이 쓰이고 이 부하는 모든 ClickHouse 측정에 들어 있다 — PostgreSQL 쪽에는 같은 크기의 로그 부하가 없다. 측정 중 설정은 바꾸지 않았다(W6 판정) · 그 몫을 가르지 않았다.
- **한계 — 콜드는 근사다(07_measurement_limits 페이지 캐시 행).** 두 컨테이너를 재기동해 공유 버퍼 · ClickHouse 캐시는 비지만 OS 페이지 캐시는 Docker VM 안이라 비우지 않는다. P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행 수치를 인용하지 않고 3회 중앙값만 쓴다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 30 중 3개가 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** PG I2 Q2 웜 36.9%(서버 0.0245 · 0.0293 · 0.0353 ms) · PG I2 Q1 콜드 27.7%(서버 0.0583 · 0.0565 · 0.0727 ms) · PG I1 Q2 콜드 25.0%(서버 3.583 · 4.551 · 3.869 ms). 편차는 (최대 − 최소) ÷ 중앙값이고 3회는 반복 1~3의 값이며, 판정 기준(s = 서버 · c = 클라이언트)은 아래 표와 같다.

| 쿼리 | CH 콜드 | CH 웜 | PG I1 콜드 | PG I1 웜 | PG I2 콜드 | PG I2 웜 |
|------|------|------|------|------|------|------|
| Q1 | 4.3% s | 10.9% s | 6.7% s | 5.8% s | **27.7%** s | 11.2% s |
| Q2 | 3.8% s | 7.5% s | **25.0%** s | 7.4% s | 3.6% s | **36.9%** s |
| Q3 | 4.3% s | 8.4% s | 4.2% s | 4.8% s | 9.0% s | 3.7% s |
| Q4 | 8.6% s | 7.4% s | 6.6% s | 0.8% s | 4.3% s | 3.3% s |
| Q5 | 10.6% s | 6.3% s | 14.6% s | 3.3% s | 4.8% s | 9.7% s |

- **초과 셋의 성격.** PG I2 둘은 서버 값이 수십 µs(Q2 웜 24.5~35.3 µs · Q1 콜드 56.5~72.7 µs)인 지점의 흔들림이다 — 절대 차는 10.8 µs · 16.2 µs이고 클라이언트 값(0.238~0.294 · 1.095~1.433 ms)에는 psql 왕복이 더해져 있다. PG I1 Q2 콜드는 해상도가 충분한 값(서버 3.583 · 4.551 · 3.869 ms)의 실제 흔들림이다. 04에는 절대 크기 하한 예외가 없어 이 기록은 규칙대로 폐기한다 — 조항 여부는 정본 반영 절 제안에 올린다.
- **1 ms 해상도 양자화는 판정에서 뺐다(리드 판정 3).** CH 클라이언트 값은 전부 10 ms 미만이라 판정 기준이 서버다 — 클라이언트 편차는 CH Q4 콜드 12.5%(9 · 8 · 8 ms)처럼 한 칸 차가 대부분이며 폐기 판정에 넣지 않았다. 순간값(settle 표본 · 활성 파트 수)은 판정 지표가 아니다.
- **중복 줄 — PG I1 반복 1~3 첫 측정은 판정에서 뺐다.** 사유는 §조건 중복 줄 행(PGSS 키 결함 · 반복 2 · 3 서버 null 16줄 · 러너 수정 뒤 반복 1~3 재측정 · 커밋 c89b982). 첫 측정 값도 원시에 남아 있다(순서가 앞선 줄). 서버 null이 아닌 첫 측정 줄(반복 1 전부 · 반복 2 · 3의 Q1 · Q3)도 같은 이유로 마지막 줄을 쓴다 — 한 점의 세 반복이 같은 러너 상태에서 나오게 한다.
- **4요소 중 메모리 상한 null은 누락이 아니다.** run.memoryLimitSource가 있는 도구 컨테이너 경로의 null이다(04 §조건 칸 2026-09-27 개정) — 이 기록의 폐기 사유는 편차뿐이다.
- 안정화 false 1회는 폐기가 아니다 — 체크포인트 미경과로 settle을 다시 부른 것이며 비 쿼리 축은 true 뒤에 쟀다.
- 불성립 구조 판정 없음(결과 동일성 6/6 · 구간 count 정합 성립) · 창에서 뺀 구간 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **이 기록의 수치를 정본에 올리지 않는다.** status discarded(편차 기준 초과)다. 구조 사실(§우열 3/3 표의 우열 — 18칸 3/3 · Q5 웜 2칸 미정 · 결과 집합 일치 6/6 · 창이 데이터보다 길어 I1이 Seq Scan · 읽은 행 수 · Q5x의 CH 메타데이터 읽기 read_rows 1)만 인용할 수 있다(리드 판정 12 · 13). 역전 구간은 053이 판정한다.
- 제안(리드 판정) — ① 서버 µs 판정 점 중 값이 0.1 ms 미만인 PG I2 점(수십 µs)의 편차를 04 §반복과 폐기에서 어떻게 다룰지(절대 차 하한 조항 여부) ② 원시 추출 경계 — params 줄(point 없음 · stage 1)을 이 기록 원시에 넣었다.
- 미확인으로 남기는 것 — 콜드 근사의 오차 · trace 로그 부하의 크기.

## 기계 판독 블록

points는 Q1~Q5 × 3팔 × 콜드 · 웜 = 30점(ClickHouse index null)이다. 점마다 server(반복 서버 중앙값 · 중앙값)와 judgment(편차 판정 기준 · 편차)를 더했고, 보조 관찰 Q5x는 역전 차트에 섞이지 않게 auxPoints에 · 읽은 양은 scan에 · 동률 점 판정은 conditions.ties에 · 반복별 우열(구조 판정)은 dominance에 둔다(판독 규칙 7 — 모르는 필드는 무시). 값은 대조 스크립트(.omc/lab/grid2-w-grid-a/grid2.py block 1)가 원시에서 다시 계산한 것과 같다.

```json
{
  "schema": "measurement/v1",
  "record": "048",
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
    "start": "2026-09-27T02:44:46.869Z",
    "end": "2026-09-27T02:50:30.706Z"
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
    "gridStage": 1,
    "gridRows": 100000,
    "gridGeneration": 2,
    "direction": "forward",
    "tierConfig": "device50-tag200-1hz",
    "apiStopped": true,
    "dataStart": "2026-09-25T01:06:20.000Z",
    "dataEnd": "2026-09-25T01:06:30.000Z",
    "dataWindow": {
      "start": "2026-09-25T01:06:20.000Z",
      "end": "2026-09-25T01:06:30.000Z"
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
        "query": "Q1",
        "cache": "warm",
        "index": "I1",
        "winner": "CH",
        "by": "server"
      },
      {
        "query": "Q2",
        "cache": "warm",
        "index": "I1",
        "winner": "CH",
        "by": "server"
      },
      {
        "query": "Q3",
        "cache": "warm",
        "index": "I1",
        "winner": "CH",
        "by": "server"
      },
      {
        "query": "Q5",
        "cache": "warm",
        "index": "I1",
        "winner": "CH",
        "by": "server"
      },
      {
        "query": "Q5",
        "cache": "warm",
        "index": "I2",
        "winner": "CH",
        "by": "server"
      }
    ],
    "duplicateLinesRule": "last line per (point, store, index, rep, query, cache) is valid",
    "duplicateLines": {
      "supersededQueryLines": 36,
      "note": "PG I1 reps 1-3 measured twice — first pass (02:46:01Z-02:47:05Z, window.start of first line - window.end of last line) had server null in reps 2-3 for Q2/Q4/Q5/Q5x (PGSS snapshot key defect) -> runner fixed (key userid:queryid:toplevel, later c89b982) -> reps 1-3 re-measured with explain (02:48:22Z-02:49:24Z, same basis); earlier query/pair/explain lines not used"
    },
    "remeasureOf": "035",
    "remeasureNote": "035 discarded (grid 1st: reverse-direction fill -> BRIN correlation 0.027 -> PG Seq Scan at 10^9, record 039) — grid 2nd forward fill; supersedes not used for discarded records",
    "runnerDirty": true,
    "runnerNote": "stages 1-5 ran on 5492c73 + uncommitted PGSS snapshot key fix (grid.py, runner query path, outside image) — committed later as c89b982",
    "clickhouseServerLogLevel": "trace (image default · no logger in config.d · unchanged during measurement)",
    "settledAt": "2026-09-27T02:44:35.707Z"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.369,
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
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
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
        "PG",
        "PG",
        "PG"
      ],
      "unanimous": true,
      "winner": "PG"
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
        "PG",
        "CH",
        "CH"
      ],
      "unanimous": false,
      "winner": null
    },
    {
      "query": "Q5",
      "cache": "warm",
      "index": "I2",
      "reps": [
        "CH",
        "CH",
        "PG"
      ],
      "unanimous": false,
      "winner": null
    }
  ],
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.209,
          2.115,
          2.165
        ],
        "median": 2.165
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.043418
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          1.879,
          1.962,
          1.757
        ],
        "median": 1.879
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.109101
      }
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
        4.89,
        5.071,
        4.727
      ],
      "median": 4.89,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.757208,
          4.011542,
          3.803542
        ],
        "median": 3.803542
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.066868
      }
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
        2.64,
        2.693,
        2.616
      ],
      "median": 2.64,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.417042,
          2.559667,
          2.456333
        ],
        "median": 2.456333
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.058064
      }
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
        1.433,
        1.095,
        1.292
      ],
      "median": 1.292,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.058292,
          0.056541,
          0.072709
        ],
        "median": 0.058292
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.277362
      }
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
        0.194,
        0.177,
        0.177
      ],
      "median": 0.177,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.010667,
          0.011876,
          0.010834
        ],
        "median": 0.010834
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.111593
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.491,
          2.531,
          2.587
        ],
        "median": 2.531
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.03793
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.137,
          2.286,
          2.309
        ],
        "median": 2.286
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.075241
      }
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
        4.467,
        5.763,
        4.769
      ],
      "median": 4.769,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.582916,
          4.550541,
          3.868541
        ],
        "median": 3.868541
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.250127
      }
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
        2.444,
        2.644,
        2.553
      ],
      "median": 2.553,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.297458,
          2.472667,
          2.354083
        ],
        "median": 2.354083
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.074428
      }
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
        1.247,
        1.167,
        1.227
      ],
      "median": 1.227,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.086792,
          0.083667,
          0.085834
        ],
        "median": 0.085834
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.036407
      }
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
        0.238,
        0.251,
        0.294
      ],
      "median": 0.251,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.0245,
          0.02925,
          0.035292
        ],
        "median": 0.02925
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.368957
      }
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
        3.0,
        3.0,
        3.0
      ],
      "median": 3.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.573,
          2.465,
          2.497
        ],
        "median": 2.497
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.043252
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.08,
          2.265,
          2.212
        ],
        "median": 2.212
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.083635
      }
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
        5.226,
        5.27,
        4.993
      ],
      "median": 5.226,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          4.210584,
          4.101041,
          4.036416
        ],
        "median": 4.101041
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.042469
      }
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
        2.93,
        2.804,
        2.837
      ],
      "median": 2.837,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.720501,
          2.594084,
          2.648709
        ],
        "median": 2.648709
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.047728
      }
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
        2.166,
        1.728,
        1.717
      ],
      "median": 1.728,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.640667,
          0.616166,
          0.585292
        ],
        "median": 0.616166
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.08987
      }
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
        0.638,
        0.66,
        0.662
      ],
      "median": 0.66,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          0.427166,
          0.411458,
          0.426
        ],
        "median": 0.426
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.036873
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          8.654,
          8.244,
          7.942
        ],
        "median": 8.244
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.086366
      }
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
        8.0,
        8.0
      ],
      "median": 8.0,
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          8.163,
          8.086,
          7.564
        ],
        "median": 8.086
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.074079
      }
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
        23.383,
        24.507,
        24.451
      ],
      "median": 24.451,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          19.142792,
          20.255459,
          20.479959
        ],
        "median": 20.255459
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.066015
      }
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
        21.336,
        20.737,
        20.755
      ],
      "median": 20.755,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          17.837875,
          17.688249,
          17.709792
        ],
        "median": 17.709792
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.008449
      }
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
        25.296,
        25.156,
        26.046
      ],
      "median": 25.296,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          21.176001,
          20.960709,
          21.870542
        ],
        "median": 21.176001
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.042965
      }
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
        20.372,
        20.698,
        20.861
      ],
      "median": 20.698,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          17.284875,
          17.499625,
          17.858875
        ],
        "median": 17.499625
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.032801
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.768,
          3.083,
          2.98
        ],
        "median": 2.98
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.105705
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          2.889,
          2.76,
          2.716
        ],
        "median": 2.76
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.062681
      }
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
        5.367,
        5.339,
        6.041
      ],
      "median": 5.367,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          4.133957,
          4.089501,
          4.694167
        ],
        "median": 4.133957
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.146268
      }
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
        3.035,
        2.948,
        3.026
      ],
      "median": 3.026,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.87775,
          2.784291,
          2.843292
        ],
        "median": 2.843292
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.03287
      }
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
        6.147,
        6.12,
        5.482
      ],
      "median": 6.12,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          4.217458,
          4.162958,
          4.018291
        ],
        "median": 4.162958
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.047843
      }
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
        3.137,
        3.111,
        2.857
      ],
      "median": 3.111,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.969584,
          2.926334,
          2.684917
        ],
        "median": 2.926334
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.097278
      }
    }
  ],
  "axes": [
    {
      "axis": "storage_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 537029,
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
      "value": 7.634597014313939,
      "unit": "ratio"
    },
    {
      "axis": "compression_ratio",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 0.5107023278061225,
      "unit": "ratio"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 854700.8547008546,
      "unit": "rows/s"
    },
    {
      "axis": "insert_rows_per_sec",
      "store": "postgresql",
      "index": "I1",
      "rows": 100000,
      "value": 1408450.7042253523,
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
      "value": 1.3853624390243902,
      "unit": "ratio"
    },
    {
      "axis": "index_bytes",
      "store": "clickhouse",
      "index": null,
      "rows": 100000,
      "value": 360,
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.721,
          0.723,
          0.687
        ],
        "median": 0.721
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.049931
      }
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
      "resultMatch": null,
      "server": {
        "unit": "ms",
        "values": [
          0.626,
          0.643,
          0.639
        ],
        "median": 0.639
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.026604
      }
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
        4.905,
        5.137,
        4.675
      ],
      "median": 4.905,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.706958,
          3.625083,
          3.490083
        ],
        "median": 3.625083
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.059826
      }
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
        2.256,
        2.284,
        2.333
      ],
      "median": 2.284,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          2.1645,
          2.203625,
          2.257375
        ],
        "median": 2.203625
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.042146
      }
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
        9.281,
        9.002,
        9.899
      ],
      "median": 9.281,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          7.524792,
          7.122833,
          8.276167
        ],
        "median": 7.524792
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.153271
      }
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
        3.616,
        3.794,
        3.834
      ],
      "median": 3.794,
      "resultMatch": true,
      "server": {
        "unit": "ms",
        "values": [
          3.515832,
          3.70025,
          3.732917
        ],
        "median": 3.70025
      },
      "judgment": {
        "basis": "server",
        "deviation": 0.058668
      }
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
      "sharedHitBlocks": 22,
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
