# 047 — 역방향 대조 상태 전이 갱신: PostgreSQL 조건부 UPDATE 대 ClickHouse 갱신 수단 4 · 업무 규모 10^4 · 10^5 · 10^6 — 기록 040 폐기 뒤 재측정 (S5)

> 실험: EXP-40 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음(기록 040 폐기 뒤 재측정 — supersedes 아님) · 판정 창: 2026-09-27T01:28:04.514Z ~ 2026-09-27T02:24:57.718Z(첫 측정 줄 ~ 마지막 측정 줄) · 실행 2026-09-27 10:22:16 ~ 11:24:57 KST(init ~ 마지막 측정 · EXP-41 재측정과 같은 러너 실행 안에서 교대)

기록 040(discarded — R1 · R2 조회 지연과 PostgreSQL 서브 ms 꼬리의 편차 초과)의 조건을 다시 잡아 같은 실험을 쟀다. work_order 행 하나의 상태를 IN_PROGRESS → COMPLETED로 바꾸는 연산을 PostgreSQL 조건부 UPDATE 1문장(자동 커밋)과 ClickHouse 갱신 수단 4(① ALTER UPDATE 비동기 · ② ALTER UPDATE 동기 · ③ 경량 UPDATE · ④ ReplacingMergeTree 새 버전 삽입)로 같은 대상 주문 집합에 차례로 걸고, 갱신 지연 · 응답 뒤 보이기까지 걸린 시간 · 물리 비용 · 갱신 뒤 조회 비용 R1 · R2를 잰다.

이 기록이 판정하려던 주장은 040과 같다 — 04_architecture/04_storage_split #9 "ClickHouse UPDATE는 비동기 mutation이라 확인 직후 재조회가 옛 상태를 본다"와 그 검증 대상 "26.8 경량 UPDATE는 즉시 보인다". **재측정도 편차 기준을 넘어 폐기다** — 판정은 다시 미뤄지고, 이 기록은 1차 대비 반복 간 분산이 어디에 남는가의 자료다(§폐기 · 예외). 수치는 전부 원시(docs/measurements/raw/047-oltp-control-update.jsonl)에 있는 값만 쓴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(러너 state · init git.commitHash · 실행기 run.commitHash — 5c01375의 러너 · 실행기 개정 포함) · init · detail git.dirty true — git.dirty 범위(scripts/lab/s5/oltp/oltp.py:175 — apps/api · packages · infra · scripts/lab/s5) 안의 미커밋 변경은 scripts/lab/s5/load/modeb-steps.sh(실행 전 수정 · 다른 세션)다 · 이미지에 들어가는 경로는 oltp.sh의 require_clean이 init · adopt · reset · run마다 통과시켰다(실패하면 중단) |
| 저장소 자원 | 대조 자원 조건 — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인(resourcesBad 없음 · task up CONTROL=1) |
| 측정 경로 | oltp-lab 도구 컨테이너(CPU 집합 11-12 · CPU 2)의 Node 실행기 → pg · @clickhouse/client로 두 저장소에 직접 · api 비경유 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · run.memoryLimitMb null + **run.memoryLimitSource "cgroup max — oltp-lab 서비스에 compose 상한 없음"** — 도구 컨테이너 경로의 null은 상한이 없다는 사실값이라 4요소 충족이다(04 §조건 칸 도구 컨테이너 경로 불릿 · 2026-09-27). 대조 메모리 3,584 MB는 저장소 컨테이너 상한이라 run에 채우지 않고 조건 칸 controlMemoryMb(3,584 · 3,584)에 적는다 |
| 용량 티어 | **해당 없음** — 업무 규모 단계(work_order 10^4 · 10^5 · 10^6행)가 축이다(05_data_stores/10 §역방향 측정 조건 4요소 행) |
| 스위치 | 전부 기본값 · SW-09=off(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 상태 분포 | 없음(배경 부하 없음) · 42 · IN_PROGRESS 비율 0.5 |
| 시작 상태 | 새 OLTP_DIR snapshots/lab-s5-oltp-r2 · 규모마다 adopt — 1차 채움 스냅샷 oltp-s{규모}-19f8861 재사용(경로 가드 + 실행기 verify — 세 저장소 (order_id · order_no) 집합 md5 · 상태 분포 · 표본 200행 불일치 0 · match true · 원시 adopt 3행) |
| 변형 사이 초기화 | PostgreSQL 실행 뒤 reset all(채움 스냅샷 복원 + VACUUM ANALYZE · 다음 PostgreSQL 실행의 detail.pgDirty false 9/9) · ClickHouse 상태 변경 실행 뒤 reset clickhouse · **① ALTER UPDATE 비동기 실행 앞에도 reset clickhouse(시작 상태 대칭 — 1차에서 개정)** |
| 엔진 · 세션 설정 | ClickHouse 26.8.10.6 · max_threads auto(3) · 서버 기본 apply_mutations_on_fly 0 · mutations_sync 0 · enable_lightweight_update 1 · apply_patch_parts 1 · update_parallel_mode auto(system.settings) · 서버 로그 이미지 기본 trace(infra/clickhouse/config.d에 logger 설정 없음 — 리드 확인) · PostgreSQL 18.6 · shared_buffers 896MB · 실험 세션 synchronous_commit off(서버 기본 on · 공정성 규칙 5) · autovacuum on |
| 쓴 설정(detail.settingsWritten) | ① 쓰기 mutations_sync 0 · 판독 apply_mutations_on_fly 0 · 1(두 판독기) ② 쓰기 mutations_sync 1 · 판독 기본 ③ 쓰기 enable_lightweight_update 1 · 판독 apply_patch_parts 1 ④ 쓰기 없음 · 판독 FINAL · plain(두 판독기) — 서버 기본과 같은 값은 query_log settingsUsed에 나오지 않는다(26.8 관측) |
| 실행기 인자(2계층) | **갱신 건수 N 300(④ 50) · R1 표본 = N · R2 반복 50 · R2 예열 1(1차 N 100 · R2 반복 5 · 예열 없음)** · 폴링 간격 5 ms · 폴링 상한 2,000회(④ 200회) · 수렴 both(한 호출 안에서 after_wait · after_force) · 자연 대기 상한 120초 · 호출 예산 510초(호출 한도 570 − 기동 여유 60 · budgetCheck ok 45/45) |
| 대상 집합 | **고정 폭 창(targetIds — 1차에서 개정)** — 반복마다 겹치지 않는 창 repSpan = floor(span ÷ 3) 안에서 N건(span = floor(IN_PROGRESS ÷ 슬롯 4)) · 10^4 실측 IN_PROGRESS 4,915 → span 1,228 → repSpan 409 ≥ 300(공정성 규칙 1 · scripts/lab/s5/oltp/oltp.py 주석 · oltp-rows.ts) · 다섯 변형이 같은 대상 순서(detail.targets.first 동일) |
| 가시성 정의 | 쓰기 응답 시각부터 별도 판독 커넥션이 새 값(행 전부 COMPLETED)을 처음 본 판독이 끝난 시각까지 · 판독기마다 독립 폴링 · 상한 안에 못 보면 null + visible_unobserved · 예산으로 끊으면 null + budget_exhausted |
| 머지 뒤 판독 | after_wait = 자연 대기(settle 수렴 또는 상한) 뒤 · after_force = 강제 뒤(③ ALTER TABLE … APPLY PATCHES · ④ OPTIMIZE TABLE … FINAL · ①② 강제 문장 없음 — mutation 완료 대기) · 수렴 = 강제 문장 성공 + 미완 mutation 0(detail.converge — 36/36 ClickHouse 실행 after_wait · after_force 모두 converged true) |
| 계기 | PostgreSQL 서버 평균(pg_stat_statements) **소수 6자리 · 1 ns 해상도(1차 3자리에서 개정)** · ClickHouse query_log query_duration_ms 평균 |
| 관측 스택 · 도구 CPU · CPU 배치 | off · 이 실험은 동시성 1이라 도구 CPU를 재지 않는다 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts · 1차와 같은 설정) · 테이블 코덱은 DDL 기본(009 DDL에 CODEC 지정 없음) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회(반복 0 · 1 · 2 — 반복마다 겹치지 않는 대상 창) · 판정 지표 최대 편차 **54.8%**(PostgreSQL 10^6 before_merge R1 p95) · 기준 20% 초과 판정 지표 **20행** · 머지 시점 순간값(patch_parts · merge_bytes_per_update · active_parts)은 편차 판정 제외(§폐기 · 예외) |
| 스크립트 · 원시 | scripts/lab/s5/oltp/oltp.sh(init · adopt · reset · run · collect) · 원시 docs/measurements/raw/047-oltp-control-update.jsonl(2,087행 · 앞 62행은 EXP-41 재측정 원시 046과 같은 공통 행 — init 1 · probe 1 · adopt 3 · executor_failed 3(EXP-41 조건 확정 전 — 기록 046 §폐기 · 예외) · reset 54 · 측정 1,980 · detail 45) · EXP-40 45회 호출 전부 종료 코드 0 · 재실행 없음(키마다 실행 1회) |

실행 한 번(변형 × 규모 × 반복)은 아래 순서다.

```plain
① 채움 상태     reset all(PostgreSQL) 또는 reset clickhouse 뒤 · 활성 파트 수렴
② 쓰기 · 폴링   대상 N건을 한 건씩 — 응답 시각 기록 → 판독기마다 독립 폴링(간격 5 ms · 상한)
③ 물리 비용     after_writes — part_log · patch 파트 · 활성 파트 · pg_stat_wal · pg_stat_user_tables 증분
④ 머지 전 판독  before_merge — R1(대상 order_id 점조회 N건) · R2(상태별 건수 — 예열 1 + 50회)
⑤ 자연 대기     after_wait — settle 수렴 뒤 물리 비용 · R1 · R2
⑥ 강제          after_force — APPLY PATCHES · OPTIMIZE FINAL · mutation 완료 대기 뒤 물리 비용 · R1 · R2
```

- **②의 가시성에는 판독 왕복 하나가 들어 있다.** 새 값을 본 판독이 끝난 시각을 적으므로 바닥은 0이 아니라 그 저장소의 판독 왕복이다 — PostgreSQL 약 0.13 ms · ClickHouse HTTP 약 3.3~4.3 ms(§결과 가시성 표). 첫 판독에서 보이면 값이 이 바닥에 붙고, 옛 상태를 한 번 이상 보면 간격 5 ms와 왕복이 더해진다.
- **⑤ ⑥은 ClickHouse만이다.** PostgreSQL은 머지가 없어 ④ 한 번만 잰다(실행기 as-built).
- **④ RMT는 N 50 · 폴링 상한 200이다.** plain 판독이 옛 버전이 사라질 때까지 폴링하므로 호출 한도 안에 끝나도록 러너가 줄였다 — 쓰기 단계가 반복마다 128.9~130.2초 걸렸다(detail.budget.phases.writesEnd).

## 결과

값은 **중앙값**(반복 0 · 1 · 2)이다. 단위 ms · 바이트는 갱신 1건당(part_log · pg_stat_wal 증분 ÷ 쓴 건수).

### 갱신 지연 — 쓰기 응답까지

| 변형 | 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL 조건부 UPDATE | 클라이언트 p50 | **0.14**(0.152 · 0.14 · 0.137) | **0.233**(0.233 · 0.237 · 0.23) | **0.25**(0.25 · 0.245 · 0.267) |
| PostgreSQL 조건부 UPDATE | 클라이언트 p95 | **0.335**(0.299 · 0.335 · 0.348) | **0.34**(0.373 · 0.338 · 0.34) | **0.5**(0.555 · 0.341 · 0.5) |
| PostgreSQL 조건부 UPDATE | 서버 평균(참고) | **0.04382**(0.042688 · 0.04382 · 0.049921) | **0.116185**(0.11765 · 0.116185 · 0.114387) | **0.15083**(0.15083 · 0.149767 · 0.16406) |
| ① ALTER UPDATE 비동기 | 클라이언트 p50 | **3.907**(4.072 · 3.82 · 3.907) | **3.617**(3.639 · 3.585 · 3.617) | **3.647**(3.652 · 3.647 · 3.607) |
| ① ALTER UPDATE 비동기 | 클라이언트 p95 | **4.815**(5.066 · 4.815 · 4.804) | **4.624**(4.542 · 4.681 · 4.624) | **4.58**(4.547 · 4.645 · 4.58) |
| ① ALTER UPDATE 비동기 | 서버 평균(참고) | **1.251**(1.412 · 1.251 · 1.246) | **1.458**(1.443 · 1.458 · 1.462) | **1.179**(1.179 · 1.197 · 1.151) |
| ② ALTER UPDATE 동기 | 클라이언트 p50 | **8.075**(8.075 · 7.968 · 8.132) | **24.266**(24.042 · 24.266 · 24.285) | **41.08**(41.117 · 40.91 · 41.08) |
| ② ALTER UPDATE 동기 | 클라이언트 p95 | **9.587**(9.587 · 9.392 · 9.611) | **26.991**(26.45 · 26.991 · 27.019) | **45.247**(44.779 · 45.381 · 45.247) |
| ② ALTER UPDATE 동기 | 서버 평균(참고) | **5.568**(5.681 · 5.506 · 5.568) | **21.925**(21.723 · 21.925 · 21.974) | **38.113**(38.444 · 38.113 · 37.975) |
| ③ 경량 UPDATE | 클라이언트 p50 | **5.169**(5.169 · 5.1 · 5.171) | **5.027**(5.089 · 4.833 · 5.027) | **5.016**(4.955 · 5.016 · 5.041) |
| ③ 경량 UPDATE | 클라이언트 p95 | **5.937**(5.968 · 5.842 · 5.937) | **5.783**(5.808 · 5.635 · 5.783) | **5.746**(5.683 · 5.746 · 5.788) |
| ③ 경량 UPDATE | 서버 평균(참고) | **2.229**(2.244 · 2.221 · 2.229) | **2.133**(2.133 · 2.066 · 2.15) | **2.116**(2.081 · 2.158 · 2.116) |
| ④ RMT 새 버전 삽입 | 클라이언트 p50 | **6.388**(6.388 · 6.571 · 6.182) | **6.903**(7.043 · 6.903 · 6.524) | **6.843**(6.843 · 6.217 · 7.197) |
| ④ RMT 새 버전 삽입 | 클라이언트 p95 | **9.007**(8.889 · 9.193 · 9.007) | **9.29**(9.29 · 9.418 · 8.789) | **9.53**(10.417 · 9.074 · 9.53) |
| ④ RMT 새 버전 삽입 | 서버 평균(참고) | **2.979**(2.979 · 3.112 · 2.905) | **3.121**(3.147 · 3.121 · 3.027) | **3.24**(3.24 · 3.051 · 3.414) |

- 검산: 변형 = PostgreSQL 1 + ClickHouse 4 = **5** · 지표 = 클라이언트 p50 · p95 + 서버 평균 = **3**
- 서버 평균은 PostgreSQL pg_stat_statements 평균 실행 시간(6자리) · ClickHouse query_log query_duration_ms 평균이다(공정성 규칙 4 · 참고 지표).

### 응답 뒤 보이기까지

| 변형 · 판독기 | 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL · default | p50 | **0.127**(0.127 · 0.129 · 0.124) | **0.127**(0.127 · 0.132 · 0.123) | **0.125**(0.125 · 0.122 · 0.136) |
| PostgreSQL · default | p95 | **0.216**(0.235 · 0.216 · 0.188) | **0.184**(0.181 · 0.197 · 0.184) | **0.277**(0.282 · 0.171 · 0.277) |
| PostgreSQL · default | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| PostgreSQL · default | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_0(서버 기본) | p50 | **14.325**(14.313 · 14.325 · 14.426) | **25.421**(25.421 · 25.523 · 25.382) | **45.382**(45.627 · 45.382 · 45.102) |
| ① · on_fly_0(서버 기본) | p95 | **16.721**(16.721 · 16.525 · 16.807) | **31.464**(31.464 · 31.486 · 30.506) | **49.094**(49.575 · 49.094 · 48.919) |
| ① · on_fly_0(서버 기본) | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_0(서버 기본) | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_1 | p50 | **4.312**(4.167 · 4.312 · 4.337) | **4.255**(4.254 · 4.329 · 4.255) | **4.293**(4.278 · 4.293 · 4.333) |
| ① · on_fly_1 | p95 | **5.249**(5.249 · 5.173 · 5.465) | **5.32**(5.036 · 6.072 · 5.32) | **5.165**(4.924 · 5.165 · 5.852) |
| ① · on_fly_1 | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_1 | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ② · default | p50 | **3.276**(3.262 · 3.276 · 3.433) | **3.39**(3.375 · 3.498 · 3.39) | **3.638**(3.638 · 3.656 · 3.557) |
| ② · default | p95 | **4.287**(4.287 · 4.287 · 4.263) | **4.504**(4.497 · 4.536 · 4.504) | **4.494**(4.485 · 4.688 · 4.494) |
| ② · default | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ② · default | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ③ · default(apply_patch_parts 1) | p50 | **3.611**(3.627 · 3.604 · 3.611) | **3.633**(3.633 · 3.632 · 3.685) | **3.748**(3.673 · 3.754 · 3.748) |
| ③ · default(apply_patch_parts 1) | p95 | **4.506**(4.527 · 4.503 · 4.506) | **4.404**(4.396 · 4.404 · 4.635) | **4.498**(4.437 · 4.528 · 4.498) |
| ③ · default(apply_patch_parts 1) | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ③ · default(apply_patch_parts 1) | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · final | p50 | **5.04**(5.023 · 5.343 · 5.04) | **5.198**(5.441 · 5.131 · 5.198) | **5.415**(5.406 · 5.523 · 5.415) |
| ④ · final | p95 | **6.628**(5.904 · 6.628 · 7.051) | **6.429**(7.248 · 6.382 · 6.429) | **6.546**(6.915 · 6.546 · 6.454) |
| ④ · final | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · final | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · plain | p50 | null(3회 전부) | null(3회 전부) | null(3회 전부) |
| ④ · plain | p95 | null(3회 전부) | null(3회 전부) | null(3회 전부) |
| ④ · plain | 상한 안 미관측(건 · 반복당 N) | **50**(50 · 50 · 50) | **50**(50 · 50 · 50) | **50**(50 · 50 · 50) |
| ④ · plain | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |

- 검산: 판독기 = PostgreSQL 1 + ① 2(on_fly_0 · on_fly_1) + ② 1 + ③ 1 + ④ 2(final · plain) = **7**
- **④ plain의 p50 · p95 null은 누락이 아니라 결과다.** 50건 × 3회 × 3규모 전부가 폴링 상한 200회 안에 "새 값만 보이는 상태"에 이르지 못했다(visible_unobserved 50 · 50 · 50 · budget_exhausted 0 — 예산에 끊긴 것이 아니다). 요약의 반복 미완 6행(incomplete)이 이 p50 · p95 6행이다.
- 원시의 반복별 최댓값(detail max · 규모 · 반복 9개의 범위) — PostgreSQL 0.685~6.066 ms · ① on_fly_0 18.11~69.938 ms · on_fly_1 6.582~12.234 ms · ② 4.888~6.364 ms · ③ 5.109~8.728 ms · ④ final 6.492~11.212 ms.

### 물리 비용 — PostgreSQL

| 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|
| WAL 바이트 · 갱신 1건당(B) | **1,323**(1,330 · 1,323 · 1,316) | **5,302**(5,344 · 5,302 · 5,300) | **6,557**(6,557 · 6,555 · 6,563) |
| WAL 전체 페이지 이미지 · 갱신 1건당(참고) | **0.47**(0.48 · 0.47 · 0.47) | **2.4**(2.42 · 2.39 · 2.4) | **3.01**(3.01 · 3.01 · 3.01) |
| 갱신 튜플 수(참고) | **300**(300 · 300 · 300) | **300**(300 · 300 · 300) | **300**(300 · 300 · 300) |
| HOT 갱신 수 | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| 죽은 튜플 증분 | **300**(300 · 300 · 300) | **300**(300 · 300 · 300) | **300**(300 · 300 · 300) |

- 반복마다 갱신 300건 전부가 1행을 바꿨다(detail.rowCounts one 300 · other 0 — 9/9 실행). autovacuum 실행 증분은 전 실행 0이다.
- WAL 레코드 증분은 갱신 1건당 6.27~7.02개(10^4 1,880~1,883 · 10^5 2,106~2,107 · 10^6 2,105 ÷ 300)다.
- **WAL 바이트 · 전체 페이지 이미지가 1차(기록 040)보다 작다 — 10^4 3,097 → 1,323 B · FPI 1.34 → 0.47 · 10^5 6,605 → 5,302 B · FPI 3.04 → 2.4.** 원시가 보이는 사실 — 반복당 FPI 총수는 10^4 1차 약 134(1.34 × 100) → 재측정 141~143으로 거의 같아, N 100 → 300(1건당 값의 분모)이 1건당 감소를 거의 다 설명한다. 10^5 약 304 → 717~725 · 10^6 약 304 → 904는 N에 비례해 늘었다. 대상 창은 흩은 순서(permute — oltp-rows.ts) 위에 있어 대상이 한 페이지에 모이도록 고른 것이 아니다. N 변경과 작은 테이블(10^4)의 페이지 포화가 같은 방향이며 원인은 미분리이고, 두 기록은 커밋이 달라 비교 불성립이다(방향 관찰).

### 물리 비용 — ClickHouse

part_log는 실행 시작 시각 이후 누적이라 after_wait · after_force 값은 after_writes를 포함한다. 값은 중앙값 · 반복별 값은 기계 판독 블록.

| 변형 | 지표 · 판독 시점 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| ① ALTER UPDATE 비동기 | 재작성 바이트(MutatePart) · after_writes | **271,905** | **2,562,692** | **25,347,517** |
| ① ALTER UPDATE 비동기 | 재작성 바이트(MutatePart) · after_force | **271,905** | **2,562,692** | **25,347,517** |
| ① ALTER UPDATE 비동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 새 파트 수(참고) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 새 파트 바이트(참고) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | patch 파트 수(참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 활성 파트 수(참고) · after_writes | **1** | **1** | **1** |
| ① ALTER UPDATE 비동기 | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ① ALTER UPDATE 비동기 | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 재작성 바이트(MutatePart) · after_writes | **271,906** | **2,562,704** | **25,347,640** |
| ② ALTER UPDATE 동기 | 재작성 바이트(MutatePart) · after_force | **271,906** | **2,562,704** | **25,347,640** |
| ② ALTER UPDATE 동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 새 파트 수(참고) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 새 파트 바이트(참고) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | patch 파트 수(참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 활성 파트 수(참고) · after_writes | **1** | **1** | **1** |
| ② ALTER UPDATE 동기 | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ② ALTER UPDATE 동기 | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |
| ③ 경량 UPDATE | 재작성 바이트(MutatePart) · after_writes | **0** | **0** | **0** |
| ③ 경량 UPDATE | 재작성 바이트(MutatePart) · after_force | **906** | **8,543** | **84,492** |
| ③ 경량 UPDATE | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **553** | **588** | **593** |
| ③ 경량 UPDATE | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **553** | **595** | **609** |
| ③ 경량 UPDATE | 새 파트 수(참고) · after_writes | **300** | **300** | **300** |
| ③ 경량 UPDATE | 새 파트 바이트(참고) · after_writes | **1,088** | **1,087** | **1,085** |
| ③ 경량 UPDATE | patch 파트 수(참고 · 순간값) · after_writes | **3** | **4** | **6** |
| ③ 경량 UPDATE | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **1** |
| ③ 경량 UPDATE | 활성 파트 수(참고) · after_writes | **1** | **1** | **1** |
| ③ 경량 UPDATE | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ③ 경량 UPDATE | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 재작성 바이트(MutatePart) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 재작성 바이트(MutatePart) · after_force | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **163,620** | **820** | **828** |
| ④ RMT 새 버전 삽입 | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **169,069** | **52,011** | **506,929** |
| ④ RMT 새 버전 삽입 | 새 파트 수(참고) · after_writes | **50** | **50** | **50** |
| ④ RMT 새 버전 삽입 | 새 파트 바이트(참고) · after_writes | **2,546** | **2,546** | **2,547** |
| ④ RMT 새 버전 삽입 | patch 파트 수(참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 활성 파트 수(참고) · after_writes | **5** | **6** | **6** |
| ④ RMT 새 버전 삽입 | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ④ RMT 새 버전 삽입 | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |

- **mutate_bytes_per_update는 part_log MutatePart의 size_in_bytes 합 ÷ 갱신 건수다.** ①② 한 반복의 MutatePart는 300개이고 rows 합이 3,000,000 · 30,000,000 · 300,000,000 — mutation 하나가 대상 1행을 위해 파트 전 행(10^4 · 10^5 · 10^6)을 담은 새 파트를 만들었다. 갱신 1건당 값이 채움 파트 크기(10^6 before.bytesOnDisk 25,267,981 B)와 같은 자리에 있다.
- **③의 after_force 값은 APPLY PATCHES 한 번의 MutatePart(n 1 · rows = 전 행)를 300건에 나눈 것이다** — 10^6에서 25,347,146~25,347,674 B ÷ 300. after_wait의 0은 자연 대기가 patch를 파트에 반영하지 않았다는 뜻이다. APPLY PATCHES는 10^4 7~9 ms · 10^5 23~24 ms · 10^6 36~38 ms 걸렸다(forceMs).
- **③의 patch_parts는 APPLY PATCHES 뒤에도 0이 아닐 수 있다**(detail.converge.after_force.activePatchParts 10^4 5 · 0 · 0 · 10^5 0 · 3 · 0 · 10^6 0 · 1 · 3) — 수렴 정의는 강제 문장 성공 + 미완 mutation 0이고 active patch 파트 수는 관측값이다(.omc 기록 규약 · 05_data_stores/10 §변형과 판정 지표).
- **④의 같은 키 중복(count − uniqExact(order_id))** — after_wait 4 · 4 · 8(10^4) · 50 · 50 · 50(10^5) · 50 · 50 · 50(10^6) → after_force 전부 0. OPTIMIZE FINAL은 10^6에서 207~213 ms(forceMs) 걸리고 MergeParts가 1,000,234~1,000,275행을 다시 썼다.

### 갱신 뒤 조회 — R1 점조회 · R2 상태별 건수

R1은 대상 order_id 점조회 N건의 p50 · R2는 전 행 status 집계 50회(예열 1회 뒤)의 p50이다(ms). read_rows는 ClickHouse query_log 조회당 평균이다.

| 변형 | 판독 | R1 p50 10^4 · 10^5 · 10^6 | R2 p50 10^4 · 10^5 · 10^6 | R1 read_rows 10^6 | R2 read_rows 10^6 |
|------|------|------|------|------|------|
| PostgreSQL 조건부 UPDATE | before_merge:default | **0.164** · **0.162** · **0.167** | **0.87** · **6.189** · **23.405** | — | — |
| ① ALTER UPDATE 비동기 | before_merge:on_fly_0 | **4.079** · **4.046** · **4.194** | **3.982** · **4.036** · **5.947** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | before_merge:on_fly_1 | **4.039** · **4.119** · **4.076** | **3.905** · **4.39** · **5.96** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_wait:on_fly_0 | **4.141** · **4.317** · **4.244** | **3.954** · **4.787** · **5.965** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_wait:on_fly_1 | **4.057** · **4.066** · **4.087** | **3.107** · **4.46** · **6.003** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_force:on_fly_0 | **4.138** · **4.106** · **4.214** | **3.964** · **4.749** · **5.886** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_force:on_fly_1 | **4.093** · **4.03** · **4.092** | **3.404** · **4.089** · **6.002** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | before_merge:default | **4.138** · **4.004** · **4.141** | **3.943** · **4.3** · **5.945** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | after_wait:default | **4.246** · **4.176** · **4.222** | **4.02** · **4.044** · **6.005** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | after_force:default | **4.036** · **4.048** · **4.355** | **3.28** · **4.09** · **7.09** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | before_merge:default | **4.118** · **4.174** · **4.277** | **3.985** · **6.044** · **20.323** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | after_wait:default | **4.2** · **4.039** · **4.267** | **4.004** · **6.001** · **20.508** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | after_force:default | **4.072** · **4.05** · **4.102** | **3.227** · **4.164** · **6.984** | **8,192** | **1,000,000** |
| ④ RMT 새 버전 삽입 | before_merge:final | **3.88** · **3.976** · **4.635** | **4.014** · **7.036** · **28.031** | **8,238.08** | **1,000,050** |
| ④ RMT 새 버전 삽입 | before_merge:plain | **3.949** · **4.001** · **3.987** | **3.973** · **4.804** · **6.993** | **8,234.4** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_wait:final | **3.975** · **3.976** · **4.45** | **3.991** · **6.939** · **28.237** | **8,238.08** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_wait:plain | **3.763** · **3.972** · **3.967** | **4.01** · **4.167** · **6.961** | **8,234.4** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_force:final | **3.989** · **3.995** · **4.02** | **3.924** · **4.039** · **7.098** | **8,192** | **1,000,000** |
| ④ RMT 새 버전 삽입 | after_force:plain | **3.871** · **3.972** · **3.935** | **3.634** · **4.093** · **6.975** | **8,192** | **1,000,000** |

- 검산: 판독 행 = PostgreSQL 1 + ① 6 + ② 3 + ③ 3 + ④ 6 = **19**
- **R2 10^6에서 ③ 머지 전 20.323 ms는 강제 뒤 6.984 ms의 2.9배다.** 경량 UPDATE의 대가가 쓰기가 아니라 patch가 남은 동안의 판독에 붙는다 — 자연 대기 뒤에도 20.508 ms로 그대로다. ④ FINAL은 머지 전 28.031 ms · 강제 뒤 7.098 ms다(중앙값 — 반복 2가 18 ms대로 갈린다 · §폐기 · 예외).

## 해석

- **#9 가시성 판정 — 폐기 기록 · 인용 불가 · 판정은 다시 미뤄진다.** 아래는 이 폐기 기록 안의 관측 방향이고 판정이 아니다(04 §기록 상태와 정정). 관측 방향은 1차와 같다 — ① on_fly_0의 보이기까지 p50은 14.325 · 25.421 · 45.382 ms로 같은 쓰기의 on_fly_1(4.312 · 4.255 · 4.293 ms — 판독 왕복 하나)의 3.3 · 6.0 · 10.6배이고, 900건 × 3규모 전부가 상한 안에 보였다(visible_unobserved 0). 같은 쓰기라도 판독 세션에 apply_mutations_on_fly 1을 주면 옛 상태 창이 사라지는 방향이다. **가시성 p50은 두 실행 모두 편차 기준 안이다** — 1차 최대 11.55% · 재측정 최대 11.2%(visible_after_ack_p50 18행) — 폐기 사유는 가시성 중앙값이 아니라 R1 · R2 조회와 PostgreSQL 서브 ms 꼬리다. 그래도 04 §반복과 폐기는 넘은 지표만 버리지 않고 세 반복 전부를 폐기하므로 이 값도 인용하지 않는다.
- **26.8 경량 UPDATE 즉시 보임 — 폐기 기록 · 인용 불가.** 관측 방향 — ③의 보이기까지 p50 3.611~3.748 ms · p95 4.404~4.506 ms는 ② mutations_sync 1(p50 3.276~3.638 ms)과 같은 판독 왕복 바닥이다. 경량 UPDATE는 공식 문서상 Beta다(정본 05_data_stores/10 §역방향 대조 첫 단락).
- **④ RMT는 판독 방식이 가시성을 정한다.** FINAL 판독은 첫 판독에서 새 값을 본 방향이다(p50 5.04~5.415 ms — 가시성 시간이라 인용 불가). plain 판독은(구조 사실) 50건 × 3회 × 3규모 전부 상한 안 미관측이다 — 자연 대기 뒤에도 같은 키 중복이 10^5 · 10^6에서 50건 그대로 남았다. 1차와 같은 구조가 다시 나왔다.
- **원리 — 행 하나를 바꾸는 비용의 단위가 PostgreSQL은 행 · ClickHouse는 파트다(구조 사실은 인용 가능 · 바이트 크기는 분포 수치라 인용 불가).** ClickHouse ALTER UPDATE는 갱신 1건마다 파트 하나를 통째로 새로 만든다(MutatePart 300개 · rows 합 = 규모 × 300) — 갱신 1건당 재작성 바이트가 271,905 → 2,562,692 → 25,347,517 B로 행 수에 비례하는 방향이고 ② 갱신 지연(8.075 → 24.266 → 41.08 ms)이 이 재작성 시간을 응답에 올린 값이다. ③은 갱신 1건당 patch 파트 1개(new_parts 300)라 쓰기 비용이 규모와 무관하고 재작성은 APPLY PATCHES 한 번으로 미뤄진다. PostgreSQL은 갱신 1건마다 새 튜플 버전 1개 · 죽은 튜플 1개(dead_tup 300 · hot_upd 0)다.
- **R2 반복 5 → 50회로 표본 잡음은 줄었다 — 남은 편차는 반복 간 분산이다.** ClickHouse R2 행(54행 × p50 · p95)의 편차 중앙값이 p50 11.3% → 3.4% · p95 14.0% → 7.6%로 내려갔고, ClickHouse R2 초과 행이 27 → 14로 줄었다(PostgreSQL 포함 전체 R2 기준 28 → 14)(§폐기 · 예외 비교표). 그런데도 남은 초과는 반복 하나가 다른 둘과 갈리는 모양이다 — ④ 10^6 FINAL R2가 반복 0 · 1 28 ms대 · 반복 2 18 ms대이고, 같은 반복의 p50 · p95가 18.381 · 19.242 ms(after_wait) · 18.729 · 20.464 ms(before_merge)로 1~2 ms 안에 붙어 한 반복 안의 표본이 그 수준에 모여 있다. 반복 안의 표본을 늘려도 줄지 않는 몫이라 **이 머신의 반복 간 분산**이다(04 §반복과 폐기 B형 — 폐기 기록은 분산 크기 자료).
- **④ 10^6 FINAL 반복 2의 18 ms는 원시로 원인을 가를 수 없다.** 원시로 확인되는 것 — 자연 대기 뒤 활성 파트 수는 반복 0 · 1 · 2가 2 · 6 · 6이라 반복 2가 반복 1과 같고, R2 read_rows는 반복 2가 1,008,288행으로 오히려 반복 0 · 1(1,000,050)보다 많다. 파트 수와 읽은 행은 이 차를 설명하지 않는다 — 머지 상태(파트 크기 분포)나 서버 쪽 캐시 차일 수 있으나 재지 않았다(원인 미분리).
- **PostgreSQL 서브 ms 꼬리는 여전히 흔들린다.** 초과 PostgreSQL 5행(갱신 p95 · 가시성 p95 2 · R1 p50 · p95)은 0.13~0.56 ms 값의 흔들림이다 — 10^6 R1 p95 0.178 · 0.348 · 0.31 · 갱신 p95 0.555 · 0.341 · 0.5. 1차의 PostgreSQL 초과 4행과 겹치는 행은 10^4 가시성 p95 하나다 — 같은 칸이 반복해서 넘는 것이 아니라 서브 ms p95가 실행마다 다른 칸에서 넘는다.
- **갱신 뒤 조회 — 점조회 R1은 변형 무관, 전 행 집계 R2는 PostgreSQL이 느린 방향(1차와 같음).** ClickHouse R1은 모든 변형 · 판독 시점에서 p50 3.8~4.6 ms · read_rows 8,192(10^6 — 그래뉼 하나 · 기록 046과 같은 구조)이고, PostgreSQL R1은 0.162~0.167 ms다. R2 10^6은 PostgreSQL 23.405 ms · ClickHouse ①② 5.886~7.09 ms다.
- **한계 — 클라이언트 지연은 HTTP(8123)와 와이어 프로토콜의 왕복 차를 포함하고, ClickHouse 수치는 trace 로그 부하를 포함한다.** 서버 로그가 이미지 기본 trace라 조회마다 로그 줄이 쓰이며 이 부하는 이 기록의 모든 ClickHouse 측정에 들어 있다(기록 046 §해석 · 공정성은 리드가 W6에서 판정). 가시성은 같은 저장소 안에서 판독 왕복 대비 배수로 읽는다. 동시성 1 · 파트 1개 · 배경 부하 없음 조건이며 P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행을 인용하지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 20행이 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** 판정 지표는 06_experiment_catalog EXP-40 판정 지표 열 — 갱신 지연 p50 · p95 · 보이기까지 p50 · p95 · 재작성 바이트(MutatePart) · WAL 바이트 · 죽은 튜플 · HOT 갱신 수 · R1 · R2 p50 · p95다. 편차는 (최대 − 최소) ÷ 중앙값이다.
- **머지 시점 순간값은 편차 판정에서 뺀다 — 06_experiment_catalog §EXP-29~39 끝 순간값 불릿과 그 아래 "같은 불릿의 역방향 · 격자 적용" 불릿(목적 적합성 W5 리드 판정 · 2026-09-27).** 이 불릿이 EXP-40 patch 파트 수(판독 시점 활성 patch_parts) · 머지 재작성 바이트(merge_bytes_per_update) · 활성 파트를 EXP-14 · 34와 같은 성격으로 보고 편차 폐기에 넣지 않는다. 이 실행에서 편차 초과인 순간값 행은 patch_parts 7(③ 10^4 after_writes · after_wait 5 · 3 · 2 · 10^5 after_writes 4 · 3 · 6 · after_wait 4 · 3 · 1 · 10^6 after_writes 6 · 6 · 3 · after_wait 1 · 1 · 3 · after_force 0 · 1 · 3 — 중앙값이 0이라 편차가 정의되지 않는 2행(③ 10^4 after_force 5 · 0 · 0 · 10^5 after_force 0 · 3 · 0)은 이 셈에서 빠진다) · merge_bytes_per_update 3(④ 10^4 after_writes · after_wait 185,340 · 163,620 · 120,130 B · after_force 190,789 · 169,069 · 125,579 B) · active_parts 2(④ 10^6 after_writes · after_wait 2 · 6 · 6)이다 — 요약 spreadExceeded 32 − 12 = 판정 지표 20.
- 참고 지표(server_update_mean · new_parts(판정 지표 열에 없는 참고 지표 — 같은 카탈로그 불릿) · new_part_bytes · mutations_pending · read_rows · wal_fpi · tup_upd · visible_unobserved · budget_exhausted)도 편차 판정에 쓰지 않는다.

| 변형 | 규모 | 지표 · 판독 | 3회 | 편차 | 1차(040) 같은 행 편차 |
|------|------|------|------|------|------|
| ch_alter_async | 10,000 | r2_latency_p50 · after_force:on_fly_1 | 3.404 · 3.141 · 3.886 | 21.9% | **26.8%** |
| ch_alter_async | 100,000 | r2_latency_p50 · after_wait:on_fly_1 | 4.46 · 4.892 · 3.965 | 20.8% | 5.1% |
| ch_alter_sync | 100,000 | r2_latency_p50 · after_wait:default | 4.044 · 4.016 · 4.869 | 21.1% | 2.9% |
| ch_alter_sync | 100,000 | r2_latency_p95 · after_force:default | 6.157 · 4.697 · 4.908 | 29.7% | 19.8% |
| ch_alter_sync | 100,000 | r2_latency_p95 · after_wait:default | 4.95 · 4.622 · 5.795 | 23.7% | 9.6% |
| ch_lwu | 10,000 | r2_latency_p50 · after_force:default | 3.071 · 3.227 · 3.967 | 27.8% | **28.8%** |
| ch_rmt | 10,000 | r2_latency_p50 · after_force:plain | 3.085 · 3.83 · 3.634 | 20.5% | **35.3%** |
| ch_rmt | 10,000 | r2_latency_p50 · after_wait:plain | 2.981 · 4.01 · 4.01 | 25.7% | 9.5% |
| ch_rmt | 10,000 | r2_latency_p95 · after_wait:plain | 3.191 · 4.747 · 4.919 | 36.4% | 11.5% |
| ch_rmt | 100,000 | r2_latency_p50 · after_wait:plain | 4.167 · 4.046 · 4.925 | 21.1% | 2.2% |
| ch_rmt | 1,000,000 | r1_latency_p50 · after_wait:final | 4.064 · 4.45 · 4.964 | 20.2% | **20.5%** |
| ch_rmt | 1,000,000 | r2_latency_p50 · after_wait:final | 28.237 · 28.686 · 18.381 | 36.5% | 6.2% |
| ch_rmt | 1,000,000 | r2_latency_p50 · before_merge:final | 28.317 · 28.031 · 18.729 | 34.2% | 2.5% |
| ch_rmt | 1,000,000 | r2_latency_p95 · after_wait:final | 29.88 · 30.112 · 19.242 | 36.4% | **37.8%** |
| ch_rmt | 1,000,000 | r2_latency_p95 · before_merge:final | 30.374 · 29.099 · 20.464 | 34.1% | **21.0%** |
| pg | 10,000 | visible_after_ack_p95 · default | 0.235 · 0.216 · 0.188 | 21.8% | **20.2%** |
| pg | 1,000,000 | r1_latency_p50 · before_merge:default | 0.134 · 0.168 · 0.167 | 20.4% | 3.2% |
| pg | 1,000,000 | r1_latency_p95 · before_merge:default | 0.178 · 0.348 · 0.31 | 54.8% | 19.9% |
| pg | 1,000,000 | update_latency_p95 · — | 0.555 · 0.341 · 0.5 | 42.8% | 7.9% |
| pg | 1,000,000 | visible_after_ack_p95 · default | 0.282 · 0.171 · 0.277 | 40.1% | 0.6% |

- 검산: 판정 지표 초과 = R2 p50 9 + R2 p95 5 + R1 p50 2 + R1 p95 1 + visible_after_ack_p95 2 + update_latency_p95 1 = **20** · 편차 판정 제외 순간값 초과 12(위 불릿)는 표에 넣지 않는다 · 1차에도 초과였던 행 **7**(1차 편차 칸이 20%를 넘는 행)
- **초과의 성격이 둘이다.** ① ClickHouse R1 · R2 지연 15행(R2 p50 9 · R2 p95 5 · R1 p50 1)은 3~30 ms 값에서 반복 하나가 갈리는 모양 — 그중 4행이 ④ 10^6 FINAL R2(before_merge · after_wait × p50 · p95)의 반복 2(18 ms대 대 28 ms대)다(§해석). ② PostgreSQL 5행(갱신 p95 1 · 가시성 p95 2 · R1 p50 1 · R1 p95 1)은 0.13~0.56 ms 서브 ms 값의 흔들림이다.
- 검산: 성격별 = ClickHouse 15 + PostgreSQL 5 = **20**

### 1차 대비 — 반복 간 분산의 크기

같은 판정 지표 행(339행 — 두 요약의 행 키가 전부 같다)의 편차를 1차 · 재측정으로 나란히 둔다. 두 기록은 커밋이 달라 비교 불성립이며(04 §조건 분리 강제) 이 표는 폐기 판단의 근거 자료다.

| 지표 | 행 | 20% 초과 1차 → 재측정 | 편차 중앙값 1차 → 재측정 | 최대 편차 1차 → 재측정 |
|------|:--:|------|------|------|
| r2_latency_p50 | 57 | 14 → **9** | 11.2% → **3.2%** | 35.3% → **36.5%** |
| r2_latency_p95 | 57 | 14 → **5** | 13.7% → **7.0%** | 37.8% → **36.4%** |
| r1_latency_p50 | 57 | 2 → **2** | 2.7% → **2.6%** | 20.5% → **20.4%** |
| r1_latency_p95 | 57 | 2 → **1** | 8.8% → **3.8%** | 27.6% → **54.8%** |
| update_latency_p50 | 15 | 0 → **0** | 5.2% → **3.0%** | 11.2% → **14.3%** |
| update_latency_p95 | 15 | 2 → **1** | 5.2% → **3.0%** | 29.9% → **42.8%** |
| visible_after_ack_p50 | 18 | 0 → **0** | 3.3% → **2.4%** | 11.6% → **11.2%** |
| visible_after_ack_p95 | 18 | 1 → **2** | 5.0% → **5.5%** | 20.2% → **40.1%** |
| mutate_bytes_per_update | 36 | 0 → **0** | 0.0% → **0.0%** | 0.02% → **0.02%** |
| wal_bytes_per_update | 3 | 0 → **0** | 0.3% → **0.8%** | 1.4% → **1.1%** |
| dead_tup · hot_upd | 6 | 0 → **0** | 0% → **0%** | 0% → **0%** |

- 검산: 행 = 57 × 4 + 15 × 2 + 18 × 2 + 36 + 3 + 6 = **339** · 초과 합 1차 14 + 14 + 2 + 2 + 0 + 2 + 0 + 1 = 35 → 재측정 9 + 5 + 2 + 1 + 0 + 1 + 0 + 2 = **20**
- **표본을 늘린 R2는 흔들림의 대역 전체가 내려갔지만 꼬리는 그대로다.** R2 편차 중앙값이 3분의 1 · 2분의 1로 줄었는데 최대 편차는 35~38%로 같다 — 가운데는 표본 잡음이었고 끝은 반복 간 분산이다. 1차 초과 35행 중 28행은 재측정에서 기준 안에 들어왔고 7행은 다시 넘었으며, 새로 넘은 13행이 생겼다 — 넘는 칸이 실행마다 바뀐다.
- **서브 ms PostgreSQL p95는 반대로 최대 편차가 커졌다(29.9 → 42.8% · 20.2 → 40.1% · 27.6 → 54.8%).** 갱신 · 가시성 · R1 표본이 N 100 → 300으로 늘었어도 0.2~0.6 ms 대의 p95가 반복마다 0.1~0.2 ms씩 움직인다 — 이 크기는 표본 수가 아니라 반복 사이의 머신 상태가 정한다.
- **폐기 기록이 알려 주는 것(04 §반복과 폐기 B형).** 같은 실험이 조건을 바꿔 두 번 폐기됐다 — 지표 339행에 기준 20%를 걸면 반복 간 분산만으로 20행 안팎이 넘는다. 이 크기가 기준 20%의 적합성 판단(04 §미확인 · 미설계 등재 "편차 20%가 이 머신에 맞는가") 자료다.
- **구조 사실 — 인용 가능 · 분포 수치 — 폐기.** 04 §구조 판정과 분포 판정 표가 구조 판정에는 편차 폐기를 적용하지 않으므로, 이 기록 안의 3회 전부 같은 구조 결과는 구조 사실로 인용할 수 있다 — hot_upd 0(2,700건) · dead_tup 300 · tup_upd 300 · rowCounts one 300(PostgreSQL · 9/9) · ①② mutation 1건 = 파트 전 행 재작성(MutatePart n 300 · rows 합 = 규모 × 300) · ③ 갱신 1건 = patch 파트 1개(new_parts 300) · 자연 대기 뒤 patch 미반영(mutate after_wait 0) · ④ plain 상한 안 미관측 50 × 3회 × 3규모 · 10^5 · 10^6 after_wait 같은 키 중복 50 → after_force 0 · 전 변형 budget_exhausted 0 · ClickHouse 전 실행 converged true. 이 목록은 기록 040의 구조 사실과 같은 결과다(건수만 N에 따라 100 → 300). 지연 · 가시성 시간 · 바이트 크기 같은 분포 수치는 폐기이며 인용하지 않는다.
- **4요소는 충족이다.** run.memoryLimitMb null에 memoryLimitSource를 함께 실었다(04 §조건 칸 도구 컨테이너 경로 불릿) — 대조 저장소 상한 3,584 MB로 채우지 않는다. 용량 티어는 "해당 없음"을 문자열로 싣는다(.omc 기록 규약).
- 불성립 구조 판정 없음 · 호출 실패 없음(EXP-40 45회 전부 종료 코드 0) · 예산 소진 없음(budget_exhausted 전부 0 · skippedPhases 없음 · skippedWrites 0) · 도구 CPU 포화 반복 없음(동시성 1 · 재지 않음).

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **분포 수치는 정본에 올리지 않는다(status discarded).** 가시성 · 갱신 지연 · 재작성 바이트는 이 기록으로도 인용 불가다.
- **W6에서 리드가 반영한다** — 04_architecture/04_storage_split #9 개정 문안은 기록 040 · 047에서 3회 전부 같은 구조 사실로만 한정한다 — ④ RMT plain 판독 상한 안 미관측 50 × 3회 × 3규모(두 기록) · 같은 키 중복 50 → 강제 뒤 0(10^5 · 10^6) · ③ 경량 UPDATE 1건 = patch 파트 1개 · ①② ALTER UPDATE 1건 = 파트 전 행 재작성. ① apply_mutations_on_fly 0 판독의 옛 상태 · ③ 즉시 보임은 가시성 분포 주장이라 두 기록 모두 인용 불가다.
- **판정을 어떻게 닫을지는 리드 판단 사항이다(제안).** 가시성 p50은 두 실행 모두 편차 기준 안이고 폐기 사유는 R1 · R2 · 서브 ms p95다. 선택지 — ① 04 §반복과 폐기의 적용 단위를 바꾸지 않고 세 번째 조건(R1 · R2 판독을 별도 실험으로 떼기 · PostgreSQL p95를 판정 지표에서 참고로 내리는 카탈로그 개정)을 정한 뒤 재측정 ② 06_experiment_catalog EXP-40 판정 지표 열을 개정(히스토그램 조항처럼 서브 ms p95를 참고로)하고 재측정 — 두 경우 모두 판정 지표는 측정 전에 고정한다(기록 030 선례).
- 미확인으로 남기는 것 — ④ 10^6 FINAL R2의 반복 간 18 · 28 ms 두 수준의 원인 · 백그라운드 풀이 바쁠 때 ① on_fly_0 옛 상태 창의 길이 · WAL · FPI 1건당 값이 줄어든 원인(N 변경과 작은 테이블 페이지 포화의 몫) · ④ 10^4 merge_bytes가 반복마다 줄어드는 원인(1차와 같은 모양 · 190,789 → 169,069 → 125,579 B).

## 기계 판독 블록

reverse 행은 collect 요약(OLTP_DIR snapshots/lab-s5-oltp-r2의 oltp-summary.json)의 EXP-40 660행 전부다 — 판정 지표 · 참고 지표를 함께 싣고 행의 spread 칸은 싣지 않는다(편차 초과 표시는 §폐기 · 예외 표가 갖는다 · 판독 규칙 7). budget_exhausted 행은 실증 패널의 원리 칸이 뺀다(측정 장부 지표). 재측정 관계는 conditions.remeasureOf에 적는다.

```json
{
  "schema": "measurement/v1",
  "record": "047",
  "exp": [
    "EXP-40"
  ],
  "status": "discarded",
  "supersedes": null,
  "window": {
    "start": "2026-09-27T01:28:04.514Z",
    "end": "2026-09-27T02:24:57.718Z"
  },
  "run": {
    "commitHash": "5492c73",
    "memoryProfile": "load",
    "memoryLimitMb": null,
    "capacityTier": "해당 없음",
    "memoryLimitSource": "cgroup max — oltp-lab 서비스에 compose 상한 없음"
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
    "injectionMode": null,
    "observability": "off",
    "cpuset": "control-equalized",
    "controlMemoryMb": {
      "clickhouse": 3584,
      "postgres": 3584
    },
    "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384",
    "toolContainer": "oltp-lab cpuset 11-12 · api-bypassed · api stopped",
    "seed": 42,
    "inProgress": 0.5,
    "generatorCpuMax": null,
    "compression": "off",
    "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts · same setting as record 040)",
    "swapUsed": null,
    "wslNetworking": null,
    "simFaultPlan": null,
    "stage": "S5",
    "scales": [
      10000,
      100000,
      1000000
    ],
    "snapshot": "s7a-seed-m",
    "oltpDir": "snapshots/lab-s5-oltp-r2",
    "fillSnapshots": "oltp-s{scale}-19f8861 adopted (path guard + executor verify match true · raw adopt 3 rows)",
    "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle) · reset clickhouse also before ch_alter_async (start-state symmetry)",
    "clickhouseVersion": "26.8.10.6",
    "clickhouseMaxThreads": 3,
    "clickhouseServerLog": "image default trace (infra/clickhouse/config.d has no logger · text_log Debug) — trace log load included in every ClickHouse value",
    "pgVersion": "18.6",
    "pgSessionSynchronousCommit": "off",
    "pgServerSynchronousCommit": "on",
    "pgSharedBuffers": "896MB",
    "pgServerMeanDecimals": 6,
    "runnerDirty": true,
    "raw": "docs/measurements/raw/047-oltp-control-update.jsonl",
    "runner": "scripts/lab/s5/oltp/oltp.sh",
    "judgedMetrics": [
      "dead_tup",
      "hot_upd",
      "mutate_bytes_per_update",
      "r1_latency_p50",
      "r1_latency_p95",
      "r2_latency_p50",
      "r2_latency_p95",
      "update_latency_p50",
      "update_latency_p95",
      "visible_after_ack_p50",
      "visible_after_ack_p95",
      "wal_bytes_per_update"
    ],
    "spreadExceededJudgedRows": 20,
    "spreadExceededInstantaneousRows": {
      "patch_parts": 7,
      "merge_bytes_per_update": 3,
      "active_parts": 2
    },
    "excludedFromDeviation": "patch_parts · merge_bytes_per_update · active_parts (merge-timing instantaneous values — 06_experiment_catalog EXP-29~39 bullet \"same bullet applied to reverse · grid\" 2026-09-27) · server_update_mean · new_parts (reference metric — not in catalog judged column) · new_part_bytes_per_update · mutations_pending · r1_read_rows · r2_read_rows · wal_fpi_per_update · tup_upd · visible_unobserved · budget_exhausted (reference)",
    "executorArgs": {
      "n": 300,
      "nRmt": 50,
      "r1Samples": "n",
      "pollIntervalMs": 5,
      "pollMax": 2000,
      "pollMaxRmt": 200,
      "r2Repeat": 50,
      "r2Warmup": 1,
      "converge": "both",
      "settleMaxSec": 120,
      "budgetSec": 510
    },
    "targetSelection": "fixed-width window per rep — repSpan = floor(span / 3) · span = floor(IN_PROGRESS / 4 slots) · scale 10^4: IN_PROGRESS 4915 -> span 1228 -> repSpan 409 >= 300 (fairness rule 1)",
    "settingsWritten": {
      "ch_alter_async": {
        "write": {
          "mutations_sync": 0
        },
        "read": {
          "apply_mutations_on_fly": [
            0,
            1
          ]
        }
      },
      "ch_alter_sync": {
        "write": {
          "mutations_sync": 1
        },
        "read": {}
      },
      "ch_lwu": {
        "write": {
          "enable_lightweight_update": 1
        },
        "read": {
          "apply_patch_parts": 1
        }
      },
      "ch_rmt": {
        "write": {},
        "read": {
          "final": [
            "FINAL",
            "plain"
          ]
        }
      }
    },
    "chServerDefaults": {
      "apply_mutations_on_fly": "0",
      "mutations_sync": "0",
      "enable_lightweight_update": "1",
      "apply_patch_parts": "1",
      "update_parallel_mode": "auto"
    },
    "visibilityDefinition": "ack -> end of first read seeing all rows COMPLETED (independent pollers) · unobserved within pollMax = null + visible_unobserved",
    "forceStatements": {
      "ch_lwu": "ALTER TABLE ... APPLY PATCHES",
      "ch_rmt": "OPTIMIZE TABLE ... FINAL",
      "ch_alter_async": null,
      "ch_alter_sync": null
    },
    "convergeDefinition": "force statement ok + mutations pending 0 · activePatchParts observed (detail.converge)",
    "remeasureOf": "040",
    "remeasureNote": "040 discarded (R1 · R2 · pg sub-ms p95 spread) — remeasured on 5492c73 with r2Repeat 50 · n 300 · fixed-width targets; discarded again; supersedes not used for discarded records",
    "firstRunComparison": {
      "judgedRows": 339,
      "spreadExceeded": {
        "040": 35,
        "047": 20
      },
      "exceededInBoth": 7
    }
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.5484,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.412, 1.251, 1.246], "median": 1.251},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [4.072, 3.82, 3.907], "median": 3.907},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.066, 4.815, 4.804], "median": 4.815},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271904.25666666665, 271914.82666666666, 271905.1533333333], "median": 271905.1533333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.042, 4.139, 4.138], "median": 4.138},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.255, 5.233, 5.229], "median": 5.233},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [3.964, 4.039, 3.699], "median": 3.964},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [5.087, 4.782, 5.376], "median": 5.087},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.093, 4.182, 4.092], "median": 4.093},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.234, 5.392, 5.261], "median": 5.261},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.404, 3.141, 3.886], "median": 3.404},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.27, 4.201, 4.399], "median": 4.27},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271904.25666666665, 271914.82666666666, 271905.1533333333], "median": 271905.1533333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.141, 4.142, 4.067], "median": 4.141},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.255, 5.302, 5.175], "median": 5.255},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [3.954, 3.944, 3.997], "median": 3.954},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [4.698, 4.563, 4.995], "median": 4.698},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.071, 4.057, 4.012], "median": 4.057},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.175, 5.156, 5.07], "median": 5.156},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.224, 3.005, 3.107], "median": 3.107},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.256, 3.741, 3.943], "median": 3.943},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271904.25666666665, 271914.82666666666, 271905.1533333333], "median": 271905.1533333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.1, 4.045, 4.079], "median": 4.079},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.219, 5.13, 5.155], "median": 5.155},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [3.982, 3.998, 3.905], "median": 3.982},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [4.351, 4.388, 4.452], "median": 4.388},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.034, 4.061, 4.039], "median": 4.039},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.157, 5.113, 5.084], "median": 5.113},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.974, 3.857, 3.905], "median": 3.905},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.384, 4.556, 4.729], "median": 4.556},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [14.313, 14.325, 14.426], "median": 14.325},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [16.721, 16.525, 16.807], "median": 16.721},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.167, 4.312, 4.337], "median": 4.312},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.249, 5.173, 5.465], "median": 5.249},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.443, 1.458, 1.462], "median": 1.458},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [3.639, 3.585, 3.617], "median": 3.617},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [4.542, 4.681, 4.624], "median": 4.624},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562690.03, 2562692.2, 2562693.0733333332], "median": 2562692.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.173, 4.088, 4.106], "median": 4.106},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.262, 5.235, 5.35], "median": 5.262},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.749, 4.835, 4.66], "median": 4.749},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [5.567, 5.329, 5.696], "median": 5.567},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.03, 4.02, 4.091], "median": 4.03},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.038, 4.979, 5.229], "median": 5.038},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [4.108, 4.089, 3.998], "median": 4.089},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [5.144, 5.2, 4.448], "median": 5.144},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562690.03, 2562692.2, 2562693.0733333332], "median": 2562692.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.317, 4.29, 4.414], "median": 4.317},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.368, 5.348, 5.426], "median": 5.368},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.787, 4.848, 4.468], "median": 4.787},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [5.415, 5.426, 5.334], "median": 5.415},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.053, 4.066, 4.145], "median": 4.066},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.093, 5.213, 5.287], "median": 5.213},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [4.46, 4.892, 3.965], "median": 4.46},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [5.309, 5.417, 4.596], "median": 5.309},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562690.03, 2562692.2, 2562693.0733333332], "median": 2562692.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.059, 4.046, 4.024], "median": 4.046},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.286, 5.163, 5.099], "median": 5.163},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.017, 4.036, 4.059], "median": 4.036},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [4.87, 5.138, 5.21], "median": 5.138},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.416, 4.119, 4.103], "median": 4.119},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.331, 5.338, 5.209], "median": 5.331},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [4.39, 4.401, 4.371], "median": 4.39},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [5.29, 5.322, 5.207], "median": 5.29},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [25.421, 25.523, 25.382], "median": 25.421},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [31.464, 31.486, 30.506], "median": 31.464},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.254, 4.329, 4.255], "median": 4.255},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.036, 6.072, 5.32], "median": 5.32},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.179, 1.197, 1.151], "median": 1.179},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [3.652, 3.647, 3.607], "median": 3.647},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [4.547, 4.645, 4.58], "median": 4.58},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347338.723333333, 25347633.68, 25347517.17], "median": 25347517.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.214, 4.34, 4.157], "median": 4.214},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.198, 5.398, 5.321], "median": 5.321},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [5.886, 6.002, 5.797], "median": 5.886},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [6.819, 6.991, 6.904], "median": 6.904},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.092, 4.079, 4.312], "median": 4.092},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.269, 5.052, 5.291], "median": 5.269},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [5.966, 6.002, 6.01], "median": 6.002},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [6.911, 7.041, 7.037], "median": 7.037},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347338.723333333, 25347633.68, 25347517.17], "median": 25347517.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.355, 4.244, 4.221], "median": 4.244},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.443, 5.345, 5.281], "median": 5.345},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [5.965, 5.987, 5.955], "median": 5.965},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [6.48, 6.603, 7.176], "median": 6.603},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.048, 4.201, 4.087], "median": 4.087},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.183, 5.343, 5.201], "median": 5.201},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [6.009, 6.003, 5.915], "median": 6.003},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [6.469, 7.408, 6.981], "median": 6.981},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347338.723333333, 25347633.68, 25347517.17], "median": 25347517.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.166, 4.287, 4.194], "median": 4.194},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.245, 5.382, 5.352], "median": 5.352},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [6.08, 5.947, 5.893], "median": 5.947},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [7.13, 7.739, 7.299], "median": 7.299},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.076, 3.996, 4.3], "median": 4.076},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.178, 4.863, 5.366], "median": 5.178},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [6.014, 5.96, 5.854], "median": 5.96},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [6.949, 7.125, 6.913], "median": 6.949},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [45.627, 45.382, 45.102], "median": 45.382},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [49.575, 49.094, 48.919], "median": 49.094},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.278, 4.293, 4.333], "median": 4.293},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.924, 5.165, 5.852], "median": 5.165},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [5.681, 5.506, 5.568], "median": 5.568},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [8.075, 7.968, 8.132], "median": 8.075},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [9.587, 9.392, 9.611], "median": 9.587},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.2366666667, 271915.81333333335, 271906.16], "median": 271906.16},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.036, 4.055, 4.029], "median": 4.036},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.015, 5.118, 5.078], "median": 5.078},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.815, 3.28, 3.273], "median": 3.28},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.577, 4.367, 4.327], "median": 4.367},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.2366666667, 271915.81333333335, 271906.16], "median": 271906.16},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.246, 4.18, 4.262], "median": 4.246},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.293, 5.384, 5.347], "median": 5.347},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.02, 4.074, 3.887], "median": 4.02},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.468, 4.905, 4.738], "median": 4.738},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.2366666667, 271915.81333333335, 271906.16], "median": 271906.16},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.236, 4.093, 4.138], "median": 4.138},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.36, 5.16, 5.189], "median": 5.189},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.614, 3.943, 3.944], "median": 3.943},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.504, 4.771, 4.297], "median": 4.504},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.262, 3.276, 3.433], "median": 3.276},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.287, 4.287, 4.263], "median": 4.287},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [21.723, 21.925, 21.974], "median": 21.925},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [24.042, 24.266, 24.285], "median": 24.266},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [26.45, 26.991, 27.019], "median": 26.991},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562702.28, 2562704.0566666666, 2562705.1666666665], "median": 2562704.0566666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.048, 4.074, 4.011], "median": 4.048},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.075, 5.213, 5.035], "median": 5.075},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.09, 3.972, 4.098], "median": 4.09},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.157, 4.697, 4.908], "median": 4.908},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562702.28, 2562704.0566666666, 2562705.1666666665], "median": 2562704.0566666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.127, 4.176, 4.177], "median": 4.176},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.268, 5.281, 5.308], "median": 5.281},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.044, 4.016, 4.869], "median": 4.044},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.95, 4.622, 5.795], "median": 4.95},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562702.28, 2562704.0566666666, 2562705.1666666665], "median": 2562704.0566666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.004, 4.042, 3.994], "median": 4.004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.989, 5.148, 4.943], "median": 4.989},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.3, 4.648, 3.989], "median": 4.3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [5.313, 5.574, 4.56], "median": 5.313},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.375, 3.498, 3.39], "median": 3.39},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.497, 4.536, 4.504], "median": 4.504},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [38.444, 38.113, 37.975], "median": 38.113},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [41.117, 40.91, 41.08], "median": 41.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [44.779, 45.381, 45.247], "median": 45.247},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347461.723333333, 25347756.68, 25347640.17], "median": 25347640.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.209, 4.355, 4.492], "median": 4.355},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.268, 5.484, 5.332], "median": 5.332},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [7.114, 7.078, 7.09], "median": 7.09},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [8.161, 8.214, 8.842], "median": 8.214},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347461.723333333, 25347756.68, 25347640.17], "median": 25347640.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.316, 4.083, 4.222], "median": 4.222},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.748, 5.276, 5.397], "median": 5.397},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [5.847, 6.005, 6.033], "median": 6.005},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.104, 6.907, 6.97], "median": 6.97},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347461.723333333, 25347756.68, 25347640.17], "median": 25347640.17},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.141, 4.22, 4.02], "median": 4.141},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.156, 5.319, 5.123], "median": 5.156},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [5.945, 5.905, 5.986], "median": 5.945},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.075, 6.437, 7.399], "median": 7.075},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.638, 3.656, 3.557], "median": 3.638},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.485, 4.688, 4.494], "median": 4.494},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.244, 2.221, 2.229], "median": 2.229},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [5.169, 5.1, 5.171], "median": 5.169},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.968, 5.842, 5.937], "median": 5.937},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [548.3633333333333, 553.3533333333334, 552.98], "median": 552.98},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [906.3266666666667, 906.46, 906.4733333333334], "median": 906.46},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [5, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.072, 4.022, 4.126], "median": 4.072},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.179, 4.966, 5.152], "median": 5.152},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.071, 3.227, 3.967], "median": 3.227},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.052, 4.372, 4.441], "median": 4.372},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [548.3633333333333, 553.3533333333334, 552.98], "median": 552.98},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [5, 3, 2], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.45, 4.121, 4.2], "median": 4.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.413, 5.156, 5.291], "median": 5.291},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.027, 3.977, 4.004], "median": 4.004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [5.097, 5.077, 4.784], "median": 5.077},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [548.3633333333333, 553.3533333333334, 552.98], "median": 552.98},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1088.1166666666666, 1087.9933333333333, 1087.99], "median": 1087.9933333333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [5, 3, 2], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.251, 4.118, 4.07], "median": 4.118},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.363, 5.232, 5.178], "median": 5.232},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.976, 3.992, 3.985], "median": 3.985},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.643, 4.715, 4.603], "median": 4.643},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.627, 3.604, 3.611], "median": 3.611},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.527, 4.503, 4.506], "median": 4.506},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.133, 2.066, 2.15], "median": 2.133},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [5.089, 4.833, 5.027], "median": 5.027},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.808, 5.635, 5.783], "median": 5.783},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [584.78, 595.1666666666666, 604.07], "median": 595.1666666666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [8542.513333333334, 8542.293333333333, 8542.896666666667], "median": 8542.513333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 3, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.024, 4.058, 4.05], "median": 4.05},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.113, 5.149, 5.113], "median": 5.113},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.176, 4.044, 4.164], "median": 4.164},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [5.558, 4.93, 5.304], "median": 5.304},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [584.78, 595.1666666666666, 604.07], "median": 595.1666666666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [4, 3, 1], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.039, 4.043, 4.001], "median": 4.039},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.011, 5.027, 5.036], "median": 5.027},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.162, 6.001, 5.861], "median": 6.001},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.392, 7.004, 7.101], "median": 7.101},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [584.78, 595.1666666666666, 587.8066666666666], "median": 587.8066666666666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1086.9566666666667, 1087.1133333333332, 1087.0333333333333], "median": 1087.0333333333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [4, 3, 6], "median": 4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.174, 4.292, 4.114], "median": 4.174},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.288, 5.438, 5.236], "median": 5.288},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8361.6, 8367.253333333334, 8372.906666666666], "median": 8367.253333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.067, 6.044, 6.035], "median": 6.044},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.024, 6.948, 6.854], "median": 6.948},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.633, 3.632, 3.685], "median": 3.633},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.396, 4.404, 4.635], "median": 4.404},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.081, 2.158, 2.116], "median": 2.116},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [4.955, 5.016, 5.041], "median": 5.016},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.683, 5.746, 5.788], "median": 5.746},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [609.8533333333334, 608.98, 608.5266666666666], "median": 608.98},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [84490.48666666666, 84492.24666666667, 84492.10666666667], "median": 84492.10666666667},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 1, 3], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.102, 4.112, 4.055], "median": 4.102},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.191, 5.177, 5.222], "median": 5.191},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [7.085, 6.912, 6.984], "median": 6.984},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [8.936, 8.84, 8.811], "median": 8.84},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [609.8533333333334, 608.98, 608.5266666666666], "median": 608.98},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [1, 1, 3], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.189, 4.28, 4.267], "median": 4.267},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.348, 5.46, 5.373], "median": 5.373},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [20.31, 20.819, 20.508], "median": 20.508},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [21.876, 22.405, 22.003], "median": 22.003},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [593.3533333333334, 592.4966666666667, 608.5266666666666], "median": 593.3533333333334},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1085.3133333333333, 1085.2233333333334, 1085.32], "median": 1085.3133333333333},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [6, 6, 3], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.277, 4.308, 4.193], "median": 4.277},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.321, 5.364, 5.303], "median": 5.321},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [20.323, 20.115, 20.906], "median": 20.323},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [22.43, 22.42, 22.205], "median": 22.42},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.673, 3.754, 3.748], "median": 3.748},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.437, 4.528, 4.498], "median": 4.498},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.979, 3.112, 2.905], "median": 2.979},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [6.388, 6.571, 6.182], "median": 6.388},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [8.889, 9.193, 9.007], "median": 9.007},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [190789.38, 169069.16, 125578.8], "median": 169069.16},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.036, 3.873, 3.989], "median": 3.989},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.046, 4.519, 4.666], "median": 4.666},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.88, 6915.2, 6787.52], "median": 6915.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [4.029, 3.924, 3.765], "median": 3.924},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.563, 4.457, 4.645], "median": 4.563},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.182, 3.871, 3.904], "median": 3.871},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.259, 4.558, 4.458], "median": 4.458},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.88, 6915.2, 6787.52], "median": 6915.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [3.085, 3.83, 3.634], "median": 3.634},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.326, 4.459, 4.337], "median": 4.337},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [5, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [185339.68, 163619.54, 120130.16], "median": 163619.54},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.975, 3.922, 4.193], "median": 3.975},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.359, 4.585, 5.193], "median": 4.585},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6915.28, 6792.08], "median": 6915.28},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [3.963, 3.991, 4.01], "median": 3.991},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.537, 4.602, 5.036], "median": 4.602},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.21, 3.912, 3.763], "median": 3.763},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.364, 4.447, 4.584], "median": 4.447},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6915.28, 6788.08], "median": 6915.28},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [2.981, 4.01, 4.01], "median": 4.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [3.191, 4.747, 4.919], "median": 4.747},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [5, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [185339.68, 163619.54, 120130.16], "median": 163619.54},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2545.64, 2545.76, 2545.82], "median": 2545.76},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.88, 3.477, 3.929], "median": 3.88},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.758, 4.347, 4.593], "median": 4.593},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6915.28, 6792.08], "median": 6915.28},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [4.146, 3.982, 4.014], "median": 4.014},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.99, 4.39, 4.532], "median": 4.532},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.789, 3.98, 3.949], "median": 3.949},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.293, 4.551, 4.599], "median": 4.551},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6915.28, 6791.78], "median": 6915.28},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [3.948, 3.973, 4.006], "median": 3.973},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.333, 4.527, 4.374], "median": 4.374},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.023, 5.343, 5.04], "median": 5.04},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.904, 6.628, 7.051], "median": 6.628},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [3.147, 3.121, 3.027], "median": 3.121},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [7.043, 6.903, 6.524], "median": 6.903},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [9.29, 9.418, 8.789], "median": 9.29},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [52006.2, 52010.76, 52012.4], "median": 52010.76},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.982, 3.995, 4.051], "median": 3.995},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.686, 4.259, 5.028], "median": 4.686},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [8062.08, 8062.08, 8062.08], "median": 8062.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [4.039, 4.286, 4.035], "median": 4.039},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.506, 5.439, 5.231], "median": 5.231},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.996, 3.972, 3.921], "median": 3.972},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.581, 4.271, 4.497], "median": 4.497},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8062.08, 8062.08, 8062.08], "median": 8062.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [4.027, 4.198, 4.093], "median": 4.093},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.464, 5.283, 5.227], "median": 5.227},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [6, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [815.02, 820.22, 820.3], "median": 820.22},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.017, 3.976, 3.968], "median": 3.976},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.52, 5.076, 4.668], "median": 4.668},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [8441.6, 8441.6, 8441.6], "median": 8441.6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [6.911, 7.057, 6.939], "median": 6.939},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [7.869, 7.948, 7.725], "median": 7.869},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.972, 4.031, 3.917], "median": 3.972},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.427, 4.559, 4.335], "median": 4.427},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8437.92, 8437.92, 8437.92], "median": 8437.92},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [4.167, 4.046, 4.925], "median": 4.167},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [5.301, 4.934, 5.337], "median": 5.301},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [6, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [815.02, 820.22, 820.3], "median": 820.22},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2546.52, 2546.44, 2546.4], "median": 2546.44},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.94, 4.003, 3.976], "median": 3.976},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.344, 4.637, 4.365], "median": 4.365},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [8441.6, 8441.6, 8441.6], "median": 8441.6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [7.036, 7.206, 6.97], "median": 7.036},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [7.502, 8.132, 7.901], "median": 7.901},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.965, 4.001, 4.007], "median": 4.001},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.503, 4.217, 4.455], "median": 4.455},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8437.92, 8437.92, 8437.92], "median": 8437.92},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [4.297, 4.804, 4.98], "median": 4.804},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [5.24, 5.398, 5.618], "median": 5.398},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.441, 5.131, 5.198], "median": 5.198},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [7.248, 6.382, 6.429], "median": 6.429},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [3.24, 3.051, 3.414], "median": 3.24},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [6.843, 6.217, 7.197], "median": 6.843},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [10.417, 9.074, 9.53], "median": 9.53},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [507045.1, 506928.24, 506928.78], "median": 506928.78},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.144, 4.02, 3.989], "median": 4.02},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.034, 4.772, 4.666], "median": 4.772},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [7.098, 7.116, 6.818], "median": 7.098},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [7.94, 8.135, 8.016], "median": 8.016},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.931, 3.937, 3.935], "median": 3.935},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.402, 4.589, 4.491], "median": 4.491},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [6.975, 7.009, 6.963], "median": 6.975},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [7.641, 7.9, 7.787], "median": 7.787},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [2, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [945.6, 827.5, 827.82], "median": 827.82},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.064, 4.45, 4.964], "median": 4.45},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.151, 5.268, 5.34], "median": 5.268},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8238.08, 8238.08], "median": 8238.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [28.237, 28.686, 18.381], "median": 28.237},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [29.88, 30.112, 19.242], "median": 29.88},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1008288], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.993, 3.957, 3.967], "median": 3.967},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.528, 4.612, 4.858], "median": 4.612},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8234.4, 8234.4], "median": 8234.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [6.917, 6.961, 6.982], "median": 6.961},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [7.879, 7.875, 7.808], "median": 7.875},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [2, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [945.6, 827.5, 827.82], "median": 827.82},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2546.66, 2546.64, 2546.62], "median": 2546.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.25, 4.635, 4.943], "median": 4.635},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.171, 5.208, 5.368], "median": 5.208},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8238.08, 8238.08], "median": 8238.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [28.317, 28.031, 18.729], "median": 28.031},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [30.374, 29.099, 20.464], "median": 29.099},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1008288], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.947, 3.996, 3.987], "median": 3.987},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.356, 4.376, 4.642], "median": 4.376},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8234.4, 8234.4], "median": 8234.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [6.993, 7.181, 5.942], "median": 6.993},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [7.287, 8.154, 6.736], "median": 7.287},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.406, 5.523, 5.415], "median": 5.415},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [6.915, 6.546, 6.454], "median": 6.546},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.042688, 0.04382, 0.049921], "median": 0.04382},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.152, 0.14, 0.137], "median": 0.14},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.299, 0.335, 0.348], "median": 0.335},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [1330.0266666666666, 1323.2633333333333, 1315.8433333333332], "median": 1323.2633333333333},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [0.4766666666666667, 0.47333333333333333, 0.47], "median": 0.47333333333333333},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.177, 0.157, 0.164], "median": 0.164},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.305, 0.287, 0.299], "median": 0.299},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [0.879, 0.87, 0.863], "median": 0.87},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [0.972, 0.961, 0.957], "median": 0.961},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.127, 0.129, 0.124], "median": 0.127},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.235, 0.216, 0.188], "median": 0.216},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.11765, 0.116185, 0.114387], "median": 0.116185},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.233, 0.237, 0.23], "median": 0.233},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.373, 0.338, 0.34], "median": 0.34},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [5344.166666666667, 5302.46, 5300.296666666667], "median": 5302.46},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [2.4166666666666665, 2.39, 2.3966666666666665], "median": 2.3966666666666665},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.164, 0.16, 0.162], "median": 0.162},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.346, 0.31, 0.331], "median": 0.331},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.189, 6.119, 6.227], "median": 6.189},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.601, 6.519, 6.52], "median": 6.52},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.127, 0.132, 0.123], "median": 0.127},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.181, 0.197, 0.184], "median": 0.184},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.15083, 0.149767, 0.16406], "median": 0.15083},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [300, 300, 300], "median": 300},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.25, 0.245, 0.267], "median": 0.25},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.555, 0.341, 0.5], "median": 0.5},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [6557.453333333333, 6555.24, 6563.333333333333], "median": 6557.453333333333},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [3.013333333333333, 3.013333333333333, 3.013333333333333], "median": 3.013333333333333},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.134, 0.168, 0.167], "median": 0.167},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.178, 0.348, 0.31], "median": 0.31},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [23.669, 23.405, 23.169], "median": 23.405},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [24.991, 24.988, 24.909], "median": 24.988},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.125, 0.122, 0.136], "median": 0.125},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.282, 0.171, 0.277], "median": 0.277},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0}
  ]
}
```
