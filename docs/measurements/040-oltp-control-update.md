# 040 — 역방향 대조 상태 전이 갱신: PostgreSQL 조건부 UPDATE 대 ClickHouse 갱신 수단 4 · 업무 규모 10^4 · 10^5 · 10^6 (S5)

> 실험: EXP-40 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T20:17:01.788Z ~ 2026-09-26T23:10:45.879Z(첫 측정 줄 ~ 마지막 측정 줄) · 실행 2026-09-27 05:14:59 ~ 08:10:45 KST(init ~ 마지막 측정 · EXP-41 · 42~44와 같은 러너 실행 안에서 교대)

업무 데이터를 고정하고 저장소를 바꾸는 역방향 대조(05_data_stores/10 §역방향 대조 — 업무 워크로드)의 첫 실험이다. work_order 행 하나의 상태를 IN_PROGRESS → COMPLETED로 바꾸는 연산을 PostgreSQL 조건부 UPDATE 1문장(자동 커밋)과 ClickHouse 갱신 수단 4(① ALTER UPDATE 비동기 · ② ALTER UPDATE 동기 · ③ 경량 UPDATE · ④ ReplacingMergeTree 새 버전 삽입)로 같은 대상 주문 집합에 차례로 걸고, 갱신 지연 · 응답 뒤 보이기까지 걸린 시간 · 물리 비용 · 갱신 뒤 조회 비용 R1 · R2를 잰 기록이다.

이 기록이 판정하는 주장은 하나다 — 04_architecture/04_storage_split #9 "ClickHouse UPDATE는 비동기 mutation이라 확인 직후 재조회가 옛 상태를 본다"와 그 검증 대상 "26.8 경량 UPDATE는 즉시 보인다"(§해석 첫 불릿). 수치는 전부 원시(docs/measurements/raw/040-oltp-control-update.jsonl)에 있는 값만 쓴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(러너 state git.commitHash · init git.dirty true — 작업 트리에 미커밋 변경이 있다 · 실행기 이미지는 같은 커밋) |
| 저장소 자원 | 대조 자원 조건 — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인(resourcesBad 없음) |
| 측정 경로 | oltp-lab 도구 컨테이너(CPU 집합 11-12 · CPU 2)의 Node 실행기 dist/oltp-lab.js → pg · @clickhouse/client로 두 저장소에 직접 · api 비경유 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · run.memoryLimitMb null + **run.memoryLimitSource "cgroup max — oltp-lab 서비스에 compose 상한 없음"** — 도구 컨테이너 경로의 null은 상한이 없다는 사실값이라 4요소 충족이다(04 §조건 칸 도구 컨테이너 경로 불릿 · 2026-09-27). 대조 메모리 3,584 MB는 저장소 컨테이너 상한이라 run에 채우지 않고 조건 칸 controlMemoryMb(3,584 · 3,584)에 적는다 |
| 용량 티어 | **해당 없음** — 업무 규모 단계(work_order 10^4 · 10^5 · 10^6행)가 축이다(05_data_stores/10 §역방향 측정 조건 4요소 행) |
| 스위치 | 전부 기본값 · SW-09=off(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 상태 분포 | 없음(배경 부하 없음) · 42 · IN_PROGRESS 비율 0.5 |
| 시작 상태 | 규모마다 빈 기준(s7a-seed-m) 복원 → fill(두 저장소 (order_id · order_no) 집합 md5 일치 · match true) → settle(PostgreSQL VACUUM ANALYZE · ClickHouse 활성 파트 수렴) → 채움 스냅샷 oltp-s{규모}-19f8861 · pg_stat_statements_reset은 규모마다 fill 전 |
| 변형 사이 초기화 | PostgreSQL 실행 뒤 reset all(채움 스냅샷 복원 + VACUUM ANALYZE · 다음 PostgreSQL 실행의 detail.pgDirty false 9/9) · ClickHouse 상태 변경 실행 뒤 reset clickhouse(대조 테이블 비움 · 같은 행 벡터로 다시 채움 · 수렴) |
| 엔진 · 세션 설정 | ClickHouse 26.8.10.6 · max_threads 3 · 서버 기본 apply_mutations_on_fly 0 · mutations_sync 0 · enable_lightweight_update 1 · apply_patch_parts 1 · update_parallel_mode auto(system.settings) · PostgreSQL 18.6 · shared_buffers 896MB · 실험 세션 synchronous_commit off(서버 기본 on · 공정성 규칙 5) · autovacuum on |
| 쓴 설정(detail.settingsWritten) | ① 쓰기 mutations_sync 0 · 판독 apply_mutations_on_fly 0 · 1(두 판독기) ② 쓰기 mutations_sync 1 · 판독 기본 ③ 쓰기 enable_lightweight_update 1 · 판독 apply_patch_parts 1 ④ 쓰기 없음 · 판독 FINAL · plain(두 판독기) — 서버 기본과 같은 값은 query_log settingsUsed에 나오지 않는다(26.8 관측) |
| 실행기 인자(2계층) | 갱신 건수 N 100(④ 50) · 폴링 간격 5 ms · 폴링 상한 2,000회(④ 200회) · R2 반복 5 · 수렴 both(한 호출 안에서 after_wait · after_force) · 자연 대기 상한 120초 · 호출 예산 510초(호출 한도 570 − 기동 여유 60 · budgetCheck ok 45/45) |
| 가시성 정의 | 쓰기 응답 시각부터 별도 판독 커넥션이 새 값(행 전부 COMPLETED)을 처음 본 판독이 끝난 시각까지 · 판독기마다 독립 폴링 · 상한 안에 못 보면 null + visible_unobserved · 예산으로 끊으면 null + budget_exhausted |
| 머지 뒤 판독 | after_wait = 자연 대기(settle 수렴 또는 상한) 뒤 · after_force = 강제 뒤(③ ALTER TABLE … APPLY PATCHES · ④ OPTIMIZE TABLE … FINAL · ①② 강제 문장 없음 — mutation 완료 대기) · 수렴 = 강제 문장 성공 + 미완 mutation 0(detail.converge) |
| 관측 스택 · 도구 CPU · CPU 배치 | off · 이 실험은 동시성 1이라 도구 CPU를 재지 않는다 · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861) · 테이블 코덱은 DDL 기본(009 DDL에 CODEC 지정 없음) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회(반복 0 · 1 · 2 — 반복마다 겹치지 않는 대상 주문 집합) · 판정 지표 최대 편차 **37.8%**(④ 10^6 after_wait:final R2 p95) · 기준 20% 초과 판정 지표 35행 · 머지 시점 순간값(patch_parts · merge_bytes · active_parts)은 편차 판정 제외(§폐기 · 예외) |
| 스크립트 · 원시 | scripts/lab/s5/oltp/oltp.sh(init · fill · settle · snapshot · reset · run · collect) · 원시 docs/measurements/raw/040-oltp-control-update.jsonl(2,255행 · 앞 230행은 EXP-40~44 공통 init · probe · fill · settle · snapshot · reset 행 · 측정 1,980 · detail 45) · EXP-40 45회 호출 전부 종료 코드 0(역방향 격자 전체 297회) |

실행 한 번(변형 × 규모 × 반복)은 아래 순서다.

```plain
① 채움 상태     reset all(PostgreSQL) 또는 reset clickhouse 뒤 · 활성 파트 수렴
② 쓰기 · 폴링   대상 N건을 한 건씩 — 응답 시각 기록 → 판독기마다 독립 폴링(간격 5 ms · 상한)
③ 물리 비용     after_writes — part_log · patch 파트 · 활성 파트 · pg_stat_wal · pg_stat_user_tables 증분
④ 머지 전 판독  before_merge — R1(대상 order_id 점조회 N건) · R2(상태별 건수 5회)
⑤ 자연 대기     after_wait — settle 수렴 뒤 물리 비용 · R1 · R2
⑥ 강제          after_force — APPLY PATCHES · OPTIMIZE FINAL · mutation 완료 대기 뒤 물리 비용 · R1 · R2
```

- **②의 가시성에는 판독 왕복 하나가 들어 있다.** 새 값을 본 판독이 끝난 시각을 적으므로 바닥은 0이 아니라 그 저장소의 판독 왕복이다 — PostgreSQL 약 0.13 ms · ClickHouse HTTP 약 3.4~4.4 ms(§결과 가시성 표). 첫 판독에서 보이면 값이 이 바닥에 붙고, 옛 상태를 한 번 이상 보면 간격 5 ms와 왕복이 더해진다.
- **⑤ ⑥은 ClickHouse만이다.** PostgreSQL은 머지가 없어 ④ 한 번만 잰다(실행기 as-built).
- **④ RMT는 N 50 · 폴링 상한 200이다.** plain 판독이 옛 버전이 사라질 때까지 폴링하므로 호출 한도 안에 끝나도록 러너가 줄였다(RUN_DEFAULTS) — 쓰기 단계가 반복마다 129~132초 걸렸다(detail.budget.phases.writesEnd).

## 결과

값은 **중앙값**(반복 0 · 1 · 2)이다. 단위 ms · 바이트는 갱신 1건당(part_log · pg_stat_wal 증분 ÷ 쓴 건수).

### 갱신 지연 — 쓰기 응답까지

| 변형 | 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL 조건부 UPDATE | 클라이언트 p50 | **0.167**(0.175 · 0.167 · 0.166) | **0.236**(0.236 · 0.235 · 0.258) | **0.241**(0.241 · 0.241 · 0.241) |
| PostgreSQL 조건부 UPDATE | 클라이언트 p95 | **0.314**(0.37 · 0.314 · 0.276) | **0.339**(0.309 · 0.339 · 0.4) | **0.316**(0.302 · 0.327 · 0.316) |
| PostgreSQL 조건부 UPDATE | 서버 평균(참고) | **0.071**(0.072 · 0.071 · 0.071) | **0.134**(0.134 · 0.134 · 0.148) | **0.14**(0.14 · 0.141 · 0.14) |
| ① ALTER UPDATE 비동기 | 클라이언트 p50 | **3.909**(4.226 · 3.79 · 3.909) | **3.676**(3.588 · 3.676 · 3.717) | **3.688**(3.715 · 3.688 · 3.66) |
| ① ALTER UPDATE 비동기 | 클라이언트 p95 | **4.976**(5.095 · 4.758 · 4.976) | **4.566**(4.566 · 4.536 · 4.633) | **4.692**(4.808 · 4.643 · 4.692) |
| ① ALTER UPDATE 비동기 | 서버 평균(참고) | **1.307**(1.418 · 1.225 · 1.307) | **1.141**(1.169 · 1.141 · 1.136) | **1.187**(1.187 · 1.178 · 1.195) |
| ② ALTER UPDATE 동기 | 클라이언트 p50 | **8.336**(8.568 · 8.336 · 8.029) | **24.697**(24.697 · 24.323 · 24.937) | **40.983**(40.983 · 40.869 · 41.326) |
| ② ALTER UPDATE 동기 | 클라이언트 p95 | **9.889**(9.917 · 9.889 · 9.272) | **27.779**(27.779 · 27.567 · 28.545) | **46.084**(46.084 · 45.479 · 47.492) |
| ② ALTER UPDATE 동기 | 서버 평균(참고) | **5.665**(5.765 · 5.665 · 5.492) | **21.907**(21.907 · 21.746 · 22.199) | **38.171**(38.171 · 37.888 · 38.924) |
| ③ 경량 UPDATE | 클라이언트 p50 | **5.001**(5.001 · 4.828 · 5.012) | **4.882**(4.863 · 4.882 · 5.117) | **4.805**(4.857 · 4.805 · 4.795) |
| ③ 경량 UPDATE | 클라이언트 p95 | **5.718**(5.843 · 5.66 · 5.718) | **5.684**(5.468 · 5.684 · 5.764) | **5.534**(5.534 · 5.653 · 5.48) |
| ③ 경량 UPDATE | 서버 평균(참고) | **2.091**(2.155 · 2.091 · 2.091) | **2.047**(1.978 · 2.07 · 2.047) | **2.009**(2.01 · 2.009 · 1.961) |
| ④ RMT 새 버전 삽입 | 클라이언트 p50 | **6.892**(6.677 · 7.034 · 6.892) | **6.25**(6.167 · 6.25 · 6.501) | **6.692**(6.692 · 7.067 · 6.519) |
| ④ RMT 새 버전 삽입 | 클라이언트 p95 | **9.581**(9.581 · 10.166 · 8.991) | **8.874**(8.874 · 8.62 · 9.635) | **9.056**(9.109 · 8.852 · 9.056) |
| ④ RMT 새 버전 삽입 | 서버 평균(참고) | **3.112**(3.112 · 3.107 · 3.162) | **2.987**(2.952 · 3.228 · 2.987) | **3.221**(3.102 · 3.254 · 3.221) |

- 검산: 변형 = PostgreSQL 1 + ClickHouse 4 = **5** · 지표 = 클라이언트 p50 · p95 + 서버 평균 = **3**
- 서버 평균은 PostgreSQL pg_stat_statements 평균 실행 시간 · ClickHouse query_log query_duration_ms 평균이다(공정성 규칙 4 · 참고 지표).

### 응답 뒤 보이기까지

| 변형 · 판독기 | 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL · default | p50 | **0.125**(0.127 · 0.125 · 0.122) | **0.126**(0.126 · 0.124 · 0.133) | **0.127**(0.127 · 0.127 · 0.129) |
| PostgreSQL · default | p95 | **0.168**(0.168 · 0.197 · 0.163) | **0.186**(0.169 · 0.186 · 0.197) | **0.164**(0.164 · 0.164 · 0.165) |
| PostgreSQL · default | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| PostgreSQL · default | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_0(서버 기본) | p50 | **14.244**(14.255 · 14.151 · 14.244) | **26.006**(26.321 · 25.812 · 26.006) | **46.338**(46.199 · 46.338 · 46.432) |
| ① · on_fly_0(서버 기본) | p95 | **16.219**(16.219 · 16.402 · 16.209) | **32.025**(32.025 · 33.04 · 30.407) | **50.578**(49.413 · 50.578 · 51.147) |
| ① · on_fly_0(서버 기본) | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_0(서버 기본) | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_1 | p50 | **4.337**(4.242 · 4.398 · 4.337) | **4.365**(4.313 · 4.387 · 4.365) | **4.351**(4.337 · 4.351 · 4.374) |
| ① · on_fly_1 | p95 | **5.265**(5.47 · 5.19 · 5.265) | **5.411**(5.053 · 5.865 · 5.411) | **5.066**(5.066 · 5.279 · 4.909) |
| ① · on_fly_1 | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ① · on_fly_1 | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ② · default | p50 | **3.434**(3.434 · 3.428 · 3.452) | **3.597**(3.597 · 3.598 · 3.531) | **3.6**(3.571 · 3.6 · 3.69) |
| ② · default | p95 | **4.394**(4.394 · 4.45 · 4.332) | **4.684**(4.527 · 4.771 · 4.684) | **4.582**(4.508 · 4.728 · 4.582) |
| ② · default | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ② · default | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ③ · default(apply_patch_parts 1) | p50 | **3.724**(3.724 · 3.612 · 3.734) | **3.709**(3.709 · 3.896 · 3.55) | **3.651**(3.745 · 3.601 · 3.651) |
| ③ · default(apply_patch_parts 1) | p95 | **4.522**(4.611 · 4.522 · 4.416) | **4.459**(4.448 · 4.594 · 4.459) | **4.511**(4.591 · 4.511 · 4.466) |
| ③ · default(apply_patch_parts 1) | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ③ · default(apply_patch_parts 1) | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · final | p50 | **5.383**(5.593 · 5.211 · 5.383) | **5.286**(5.277 · 5.607 · 5.286) | **5.418**(5.197 · 5.418 · 5.823) |
| ④ · final | p95 | **7.357**(7.705 · 6.981 · 7.357) | **6.671**(6.524 · 6.671 · 7.164) | **7.151**(7.151 · 7.096 · 7.283) |
| ④ · final | 상한 안 미관측(건 · 반복당 N) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · final | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| ④ · plain | p50 | null(3회 전부) | null(3회 전부) | null(3회 전부) |
| ④ · plain | p95 | null(3회 전부) | null(3회 전부) | null(3회 전부) |
| ④ · plain | 상한 안 미관측(건 · 반복당 N) | **50**(50 · 50 · 50) | **50**(50 · 50 · 50) | **50**(50 · 50 · 50) |
| ④ · plain | 예산 소진(건) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |

- 검산: 판독기 = PostgreSQL 1 + ① 2(on_fly_0 · on_fly_1) + ② 1 + ③ 1 + ④ 2(final · plain) = **7**
- **④ plain의 p50 · p95 null은 누락이 아니라 결과다.** 50건 × 3회 전부가 폴링 상한 200회 안에 "새 값만 보이는 상태"에 이르지 못했다(visible_unobserved 50 · 50 · 50 · budget_exhausted 0 — 예산에 끊긴 것이 아니다).
- 원시의 반복별 최댓값 — PostgreSQL 0.524~2.25 ms · ① on_fly_0 17.3~63.2 ms · on_fly_1 5.7~8.9 ms · ② 4.7~5.4 ms · ③ 4.7~7.2 ms · ④ final 7.8~11.2 ms(detail max).

### 물리 비용 — PostgreSQL

| 지표 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|
| WAL 바이트 · 갱신 1건당(B) | **3,097**(3,075 · 3,097 · 3,117) | **6,605**(6,588 · 6,605 · 6,606) | **6,618**(6,616 · 6,618 · 6,620) |
| WAL 전체 페이지 이미지 · 갱신 1건당(참고) | **1.34**(1.33 · 1.34 · 1.35) | **3.04**(3.04 · 3.04 · 3.04) | **3.04**(3.04 · 3.04 · 3.04) |
| 갱신 튜플 수(참고) | **100**(100 · 100 · 100) | **100**(100 · 100 · 100) | **100**(100 · 100 · 100) |
| HOT 갱신 수 | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) | **0**(0 · 0 · 0) |
| 죽은 튜플 증분 | **100**(100 · 100 · 100) | **100**(100 · 100 · 100) | **100**(100 · 100 · 100) |

- 반복마다 갱신 100건 전부가 1행을 바꿨다(detail.rowCounts one 100 · other 0 — 9/9 실행). autovacuum 실행 증분은 전 실행 0이다.
- WAL 레코드 증분은 갱신 1건당 6.67~7.07개(10^4 668~670 · 10^5 707 · 10^6 704 ÷ 100)다.

### 물리 비용 — ClickHouse

part_log는 실행 시작 시각 이후 누적이라 after_wait · after_force 값은 after_writes를 포함한다. 값은 중앙값 · 반복별 값은 기계 판독 블록.

| 변형 | 지표 · 판독 시점 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| ① ALTER UPDATE 비동기 | 재작성 바이트(MutatePart) · after_writes | **271,890** | **2,562,662** | **25,347,582** |
| ① ALTER UPDATE 비동기 | 재작성 바이트(MutatePart) · after_force | **271,890** | **2,562,662** | **25,347,582** |
| ① ALTER UPDATE 비동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 새 파트 수(참고) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 새 파트 바이트(참고) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | patch 파트 수(참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **0** |
| ① ALTER UPDATE 비동기 | 활성 파트 수(참고) · after_writes | **1** | **1** | **1** |
| ① ALTER UPDATE 비동기 | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ① ALTER UPDATE 비동기 | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |
| ② ALTER UPDATE 동기 | 재작성 바이트(MutatePart) · after_writes | **271,890** | **2,562,662** | **25,347,582** |
| ② ALTER UPDATE 동기 | 재작성 바이트(MutatePart) · after_force | **271,890** | **2,562,662** | **25,347,582** |
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
| ③ 경량 UPDATE | 재작성 바이트(MutatePart) · after_force | **2,719** | **25,627** | **253,475** |
| ③ 경량 UPDATE | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **338** | **344** | **352** |
| ③ 경량 UPDATE | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **338** | **344** | **352** |
| ③ 경량 UPDATE | 새 파트 수(참고) · after_writes | **100** | **100** | **100** |
| ③ 경량 UPDATE | 새 파트 바이트(참고) · after_writes | **1,087** | **1,086** | **1,084** |
| ③ 경량 UPDATE | patch 파트 수(참고 · 순간값) · after_writes | **5** | **5** | **3** |
| ③ 경량 UPDATE | patch 파트 수(참고 · 순간값) · after_force | **5** | **5** | **3** |
| ③ 경량 UPDATE | 활성 파트 수(참고) · after_writes | **1** | **1** | **1** |
| ③ 경량 UPDATE | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ③ 경량 UPDATE | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 재작성 바이트(MutatePart) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 재작성 바이트(MutatePart) · after_force | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 머지 바이트(MergeParts · 참고 · 순간값) · after_writes | **163,579** | **816** | **829** |
| ④ RMT 새 버전 삽입 | 머지 바이트(MergeParts · 참고 · 순간값) · after_force | **169,028** | **52,010** | **506,934** |
| ④ RMT 새 버전 삽입 | 새 파트 수(참고) · after_writes | **50** | **50** | **50** |
| ④ RMT 새 버전 삽입 | 새 파트 바이트(참고) · after_writes | **2,546** | **2,546** | **2,547** |
| ④ RMT 새 버전 삽입 | patch 파트 수(참고 · 순간값) · after_writes | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | patch 파트 수(참고 · 순간값) · after_force | **0** | **0** | **0** |
| ④ RMT 새 버전 삽입 | 활성 파트 수(참고) · after_writes | **5** | **6** | **6** |
| ④ RMT 새 버전 삽입 | 활성 파트 수(참고) · after_force | **1** | **1** | **1** |
| ④ RMT 새 버전 삽입 | 미완 mutation(참고) · after_writes | **0** | **0** | **0** |

- **mutate_bytes_per_update는 part_log MutatePart의 size_in_bytes 합 ÷ 갱신 건수다.** ①② 한 반복의 MutatePart는 100개이고 rows 합이 1,000,000 · 10,000,000 · 100,000,000 — mutation 하나가 대상 1행을 위해 파트 전 행(10^4 · 10^5 · 10^6)을 담은 새 파트를 만들었다. 갱신 1건당 값이 채움 파트 크기(10^6 before.bytesOnDisk 25,267,981 B)와 같은 자리에 있다.
- **③의 after_force 값은 APPLY PATCHES 한 번의 MutatePart(n 1 · rows = 전 행)를 100건에 나눈 것이다** — 10^6에서 25,347,459 B ÷ 100. after_wait의 0은 자연 대기가 patch를 파트에 반영하지 않았다는 뜻이다.
- **③의 patch_parts는 APPLY PATCHES 뒤에도 그대로다**(detail.converge.after_force.activePatchParts 10^4 5 · 1 · 5 · 10^5 4 · 5 · 5 · 10^6 3 · 1 · 5) — 수렴 정의는 강제 문장 성공 + 미완 mutation 0이고 active patch 파트 수는 관측값이다(.omc 기록 규약 · 05_data_stores/10 §변형과 판정 지표).
- **④의 같은 키 중복(count − uniqExact(order_id))** — after_wait 4 · 4 · 8(10^4) · 50 · 50 · 50(10^5) · 50 · 50 · 50(10^6) → after_force 전부 0. OPTIMIZE FINAL은 10^6에서 207~212 ms(forceMs) 걸리고 MergeParts가 1,000,275행을 다시 썼다.

### 갱신 뒤 조회 — R1 점조회 · R2 상태별 건수

R1은 대상 order_id 점조회 N건의 p50 · R2는 전 행 status 집계 5회의 p50이다(ms). read_rows는 ClickHouse query_log 조회당 평균이다.

| 변형 | 판독 | R1 p50 10^4 · 10^5 · 10^6 | R2 p50 10^4 · 10^5 · 10^6 | R1 read_rows 10^6 | R2 read_rows 10^6 |
|------|------|------|------|------|------|
| PostgreSQL 조건부 UPDATE | before_merge:default | **0.257** · **0.241** · **0.248** | **1.201** · **7.219** · **24.496** | — | — |
| ① ALTER UPDATE 비동기 | before_merge:on_fly_0 | **3.954** · **3.989** · **4.018** | **3.976** · **4.027** · **6.484** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | before_merge:on_fly_1 | **4.022** · **3.986** · **4.044** | **3.942** · **4.975** · **6.845** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_wait:on_fly_0 | **3.97** · **3.985** · **4.069** | **4.311** · **4.983** · **7.012** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_wait:on_fly_1 | **4.039** · **4.05** · **4.057** | **3.135** · **4.114** · **6.791** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_force:on_fly_0 | **3.991** · **3.968** · **4.167** | **3.836** · **4.746** · **6.91** | **8,192** | **1,000,000** |
| ① ALTER UPDATE 비동기 | after_force:on_fly_1 | **4.026** · **3.996** · **4.002** | **3.879** · **4.045** · **6.34** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | before_merge:default | **4.008** · **3.974** · **4.042** | **3.56** · **4.702** · **6.14** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | after_wait:default | **4.05** · **4** · **4.031** | **3.638** · **4.232** · **6.943** | **8,192** | **1,000,000** |
| ② ALTER UPDATE 동기 | after_force:default | **4.02** · **3.978** · **4.008** | **3.188** · **4.76** · **6.131** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | before_merge:default | **3.989** · **4.016** · **4.011** | **3.997** · **6.965** · **15.217** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | after_wait:default | **4.071** · **4.025** · **4.038** | **3.758** · **6.827** · **14.781** | **8,192** | **1,000,000** |
| ③ 경량 UPDATE | after_force:default | **4.029** · **3.991** · **4.033** | **3.408** · **3.96** · **6.352** | **8,192** | **1,000,000** |
| ④ RMT 새 버전 삽입 | before_merge:final | **3.882** · **4.038** · **4.13** | **3.738** · **7.918** · **29.399** | **8,238.08** | **1,000,050** |
| ④ RMT 새 버전 삽입 | before_merge:plain | **3.746** · **3.956** · **3.99** | **3.931** · **4.028** · **8.832** | **8,234.4** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_wait:final | **3.908** · **4.336** · **4.281** | **3.811** · **8.25** · **29.178** | **8,238.08** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_wait:plain | **3.637** · **3.94** · **4.034** | **3.951** · **4.172** · **7.965** | **8,234.4** | **1,000,050** |
| ④ RMT 새 버전 삽입 | after_force:final | **3.951** · **4.013** · **3.981** | **3.119** · **4.088** · **7.026** | **8,192** | **1,000,000** |
| ④ RMT 새 버전 삽입 | after_force:plain | **3.664** · **3.942** · **3.998** | **3.408** · **3.981** · **8.185** | **8,192** | **1,000,000** |

- 검산: 판독 행 = PostgreSQL 1 + ① 6 + ② 3 + ③ 3 + ④ 6 = **19**
- **R2 10^6에서 ③ 머지 전 15.217 ms는 강제 뒤 6.352 ms의 2.4배다.** 경량 UPDATE의 대가가 쓰기가 아니라 patch가 남은 동안의 판독에 붙는다 — 자연 대기 뒤에도 14.781 ms로 그대로다. ④ FINAL은 머지 전 29.399 ms · 강제 뒤 7.026 ms다.

## 해석

- **#9 가시성 판정 — 폐기 기록 · 인용 불가 · 재측정 뒤 판정.** 아래는 이 폐기 기록 안의 관측 방향이고 판정이 아니다 — 가시성 시간은 분포 수치라 status discarded 기록에서 인용하지 않는다(04 §기록 상태와 정정). 관측 방향 — 서버 기본(ALTER UPDATE mutations_sync 0 · apply_mutations_on_fly 0)과 FINAL 없는 RMT 판독에서만 옛 상태가 보였다. ① on_fly_0의 보이기까지 p50은 14.244 · 26.006 · 46.338 ms로 같은 쓰기의 on_fly_1(4.337 · 4.365 · 4.351 ms — 판독 왕복 하나)의 3.3 · 6.0 · 10.6배다. 첫 판독에서 보였다면 값이 왕복 하나(약 4 ms)에 붙으므로, 중앙값이 그 3배 이상이라는 것은 **적어도 절반의 갱신에서 응답 직후 판독이 옛 상태를 봤다**는 뜻이다 — 주장의 문장 그대로다. 그러나 옛 상태의 창은 수십 ms이고 규모에 비례해 늘며(10^6 p95 50.578 ms), 300건 × 3규모 전부가 상한 안에 보였다(visible_unobserved 0). 같은 쓰기라도 판독 세션에 apply_mutations_on_fly 1을 주면 창이 사라진다 — 그래서 #9의 옛 상태는 "UPDATE가 비동기라서"가 아니라 **서버 기본 판독 설정 하나의 선택**이다.
- **26.8 경량 UPDATE 즉시 보임 — 폐기 기록 · 인용 불가 · 재측정 뒤 판정.** 아래는 관측 방향이고 확인이 아니다 — 가시성 시간 분포(보이기까지 p50 · p95)가 근거라 이 폐기 기록으로 판정하지 않는다. ③의 보이기까지 p50 3.651~3.724 ms · p95 4.459~4.522 ms는 ② mutations_sync 1(응답이 mutation 완료를 기다린다 · p50 3.434~3.6 ms)과 같은 판독 왕복 바닥이다. 95% 이상의 갱신이 응답 직후 첫 판독에서 새 값을 보였다. 단 경량 UPDATE는 공식 문서상 Beta다(정본 05_data_stores/10 §역방향 대조 첫 단락) — 운영 경로의 가시성 근거로 쓸 수 있는지는 이 기록의 판정 밖이다.
- **④ RMT는 판독 방식이 가시성을 정한다.** FINAL 판독은 첫 판독에서 새 값을 본 방향이다(p50 5.286~5.418 ms — 가시성 시간이라 폐기 기록 · 인용 불가 · 재측정 뒤 판정). plain 판독은(구조 사실) 50건 × 3회 × 3규모 전부 상한 안 미관측이다 — 새 버전 행이 들어간 뒤에도 옛 버전 행이 머지 전까지 함께 조회되고, 자연 대기 뒤에도 같은 키 중복이 10^5 · 10^6에서 50건 그대로 남았다(settle 4초 수렴 · 머지 0). RMT의 "갱신"은 쓰기 쪽이 아니라 **판독 쪽이 합쳐야 보이는 갱신**이다.
- **그래서 판정의 근거는 가시성에서 갱신 비용으로 옮겨진다(05_data_stores/10 첫 단락의 예고).** 즉시 보이게 하는 수단(① on_fly_1 · ② · ③ · ④ FINAL)이 모두 있는 방향이고(가시성은 위 불릿들과 같이 폐기 기록 · 인용 불가 · 재측정 뒤 판정), 대가가 다른 자리에 붙는다 — ② 쓰기 지연 · ①② 파트 재작성 · ③ 머지 전 판독 · ④ FINAL 판독.
- **원리 — 행 하나를 바꾸는 비용의 단위가 PostgreSQL은 행 · ClickHouse는 파트다.** PostgreSQL은 갱신 1건당 WAL 6,605~6,618 B(10^5 · 10^6 · FPI 3.04개) · 죽은 튜플 1개(100건에 dead_tup 100)를 남기고 규모가 100배 커져도 WAL이 그대로다. ClickHouse ALTER UPDATE는 갱신 1건당 파트 하나를 통째로 새로 만들어 271,890 → 2,562,662 → 25,347,582 B로 **행 수에 비례한다**(10^4 → 10^6 93배) — 10^6에서 100건 갱신이 part_log에 2.53 GB의 결과 파트를 남긴다. ② mutations_sync 1의 갱신 지연(8.336 → 24.697 → 40.983 ms)이 이 재작성 시간을 응답에 올린 값이다. ③ 경량 UPDATE는 갱신 1건당 patch 파트 1개(new_parts 100 · 1,084~1,087 B — patch 파트가 바뀐 컬럼과 위치 시스템 컬럼만 담는다는 구조는 05_data_stores/10 §원리 대응)라 쓰기 비용이 규모와 무관하고, 파트 재작성은 APPLY PATCHES 한 번으로 미뤄진다. ④는 새 행 1개(2,546 B)를 쓰고 옛 버전 제거를 머지로 넘긴다.
- **원리 — MVCC와 HOT.** hot_upd 0(9/9 실행 · 900건 전부)은 설계 문서의 구조 사실(status가 인덱스 (line_id, status)의 키라 HOT 조건을 만족하지 않는다 — 05_data_stores/10 §원리 대응)이 그대로 관측된 것이다. 갱신마다 새 튜플 버전 + 인덱스 항목을 쓰고 옛 버전은 죽은 튜플로 VACUUM을 기다린다. 10^4의 WAL 3,097 B · FPI 1.34는 10^5 이상(6,605 B · 3.04)의 절반이고 FPI 수가 같은 방향으로 움직인다 — 페이지 분포는 재지 않아 원인은 미확인이다(§정본 반영).
- **갱신 지연 자체는 PostgreSQL이 한 자릿수 이상 작다.** p50 0.167~0.241 ms 대 ClickHouse 가장 빠른 ① 3.676~3.909 ms. 서버 시간도 0.071~0.14 ms 대 1.141~1.307 ms다 — ① 비동기 ALTER의 서버 시간은 mutation 등록뿐이다. 단 클라이언트 지연에는 ClickHouse HTTP 왕복이 들어 있다(한계 불릿).
- **갱신 뒤 조회 — 점조회 R1은 변형 무관, 전 행 집계 R2는 PostgreSQL이 느리다.** ClickHouse R1은 모든 변형 · 판독 시점에서 p50 3.6~4.3 ms · read_rows 8,192(10^6 — 그래뉼 하나)이고, PostgreSQL R1은 0.241~0.257 ms다(EXP-41과 같은 구조). R2 10^6은 PostgreSQL 24.496 ms · ClickHouse ①② 6.131~7.012 ms다 — 이 크기의 전 행 집계는 열 저장 쪽이 이긴다. 업무 워크로드의 모양(행 단위 갱신 · 점조회)에서는 PostgreSQL이, 집계에서는 ClickHouse가 앞서는 구조가 한 실험 안에서 함께 보인다.
- **한계 — 클라이언트 지연은 HTTP(8123)와 와이어 프로토콜의 왕복 차를 포함한다.** 서버 시간(참고 지표)을 함께 싣는 이유다(공정성 규칙 4). 가시성 바닥도 왕복 하나다 — 두 저장소의 가시성 절대값을 직접 비교하지 않고, 같은 저장소 안에서 판독 왕복 대비 배수로 읽는다.
- **한계 — 동시성 1 · 파트 1개 · 배경 부하 없음 조건이다.** ① on_fly_0의 옛 상태 창(수십 ms)은 mutation이 대기 없이 곧바로 도는 조건의 값이다 — 백그라운드 풀이 바쁘면 창이 길어질 수 있으나 이 기록은 재지 않았다. P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행을 인용하지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 35행이 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** 판정 지표는 06_experiment_catalog EXP-40 판정 지표 열 — 갱신 지연 p50 · p95 · 보이기까지 p50 · p95 · 재작성 바이트(MutatePart) · WAL 바이트 · 죽은 튜플 · HOT 갱신 수 · R1 · R2 p50 · p95다. 편차는 (최대 − 최소) ÷ 중앙값이다.
- **머지 시점 순간값은 편차 판정에서 뺀다 — 06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿(목적 적합성 W5 리드 판정 · 2026-09-27).** 이 불릿이 EXP-40 patch 파트 수(판독 시점 활성 patch_parts) · 머지 재작성 바이트(merge_bytes_per_update) · 활성 파트를 EXP-14 · 34와 같은 성격으로 보고 편차 폐기에 넣지 않는다고 정한다. patch_parts(③ 5 · 1 · 5 · 4 · 5 · 5 · 3 · 1 · 5) · merge_bytes_per_update(④ 10^4 190,789 · 169,028 · 147,305 B) · active_parts(④ 10^6 2 · 6 · 6)는 백그라운드 머지가 측정 시점에 patch · 새 파트를 합쳤는가에 좌우되고 part_log 누적이라 같은 값이 after_writes · after_wait · after_force에 반복해 세어진다 — EXP-14 압축률 · EXP-34 활성 파트와 같은 성격이라 참고로 적는다. 이 중 편차 초과 행은 patch_parts 6 · merge_bytes 3 · active_parts 2 = 11이다.
- 참고 지표(server_update_mean · new_parts(판정 지표 열에 없는 참고 지표 — 같은 카탈로그 불릿) · new_part_bytes · mutations_pending · read_rows · wal_fpi · tup_upd · visible_unobserved · budget_exhausted)도 편차 판정에 쓰지 않는다.

| 변형 | 규모 | 지표 · 판독 | 3회 | 편차 |
|------|------|------|------|------|
| ch_alter_async | 10,000 | r2_latency_p50 · after_force:on_fly_0 | 3.071 · 3.836 · 3.84 | 20.1% |
| ch_alter_async | 10,000 | r2_latency_p95 · after_force:on_fly_0 | 3.15 · 4.123 · 4.064 | 23.9% |
| ch_alter_async | 10,000 | r2_latency_p50 · after_force:on_fly_1 | 3.879 · 3.076 · 4.115 | 26.8% |
| ch_alter_async | 10,000 | r2_latency_p95 · after_wait:on_fly_0 | 5.293 · 4.893 · 6.248 | 25.6% |
| ch_alter_async | 10,000 | r2_latency_p50 · after_wait:on_fly_1 | 2.99 · 4 · 3.135 | 32.2% |
| ch_alter_async | 10,000 | r2_latency_p95 · after_wait:on_fly_1 | 3.159 · 4.258 · 3.244 | 33.9% |
| ch_alter_async | 10,000 | r2_latency_p50 · before_merge:on_fly_1 | 3.021 · 4.002 · 3.942 | 24.9% |
| ch_alter_async | 10,000 | r2_latency_p95 · before_merge:on_fly_1 | 3.305 · 4.152 · 4.346 | 25.1% |
| ch_alter_async | 100,000 | r2_latency_p50 · after_wait:on_fly_0 | 4.044 · 4.983 · 5.211 | 23.4% |
| ch_alter_async | 100,000 | r2_latency_p95 · after_wait:on_fly_0 | 4.242 · 5.058 · 5.468 | 24.2% |
| ch_alter_async | 100,000 | r2_latency_p95 · after_wait:on_fly_1 | 4.173 · 5.129 · 4.069 | 25.4% |
| ch_alter_async | 100,000 | r2_latency_p50 · before_merge:on_fly_0 | 4.027 · 3.976 · 5.054 | 26.8% |
| ch_alter_async | 1,000,000 | r2_latency_p95 · after_wait:on_fly_1 | 7.988 · 7.444 · 6.28 | 22.9% |
| ch_alter_sync | 10,000 | r2_latency_p50 · after_force:default | 4.089 · 3.107 · 3.188 | 30.8% |
| ch_alter_sync | 100,000 | r2_latency_p50 · after_force:default | 3.93 · 4.76 · 5.068 | 23.9% |
| ch_alter_sync | 100,000 | r2_latency_p50 · before_merge:default | 3.955 · 4.702 · 4.947 | 21.1% |
| ch_alter_sync | 100,000 | r2_latency_p95 · before_merge:default | 4.156 · 5.246 · 5.216 | 20.9% |
| ch_lwu | 10,000 | r2_latency_p50 · after_force:default | 4.146 · 3.408 · 3.166 | 28.8% |
| ch_rmt | 10,000 | r2_latency_p95 · after_force:final | 3.185 · 3.237 · 4.242 | 32.6% |
| ch_rmt | 10,000 | r2_latency_p50 · after_force:plain | 2.783 · 3.987 · 3.408 | 35.3% |
| ch_rmt | 10,000 | r1_latency_p50 · after_wait:plain | 4.131 · 3.385 · 3.637 | 20.5% |
| ch_rmt | 10,000 | r1_latency_p95 · after_wait:plain | 5.282 · 4.283 · 4.368 | 22.9% |
| ch_rmt | 100,000 | r2_latency_p50 · after_force:final | 3.921 · 4.088 · 5.013 | 26.7% |
| ch_rmt | 100,000 | r2_latency_p95 · after_force:final | 4.064 · 4.374 · 5.141 | 24.6% |
| ch_rmt | 100,000 | r1_latency_p95 · after_wait:plain | 4.595 · 4.47 · 5.739 | 27.6% |
| ch_rmt | 100,000 | r2_latency_p95 · after_wait:plain | 6.231 · 4.344 · 5.921 | 31.9% |
| ch_rmt | 1,000,000 | r2_latency_p50 · after_force:final | 8.403 · 7.026 · 6.805 | 22.7% |
| ch_rmt | 1,000,000 | r2_latency_p95 · after_force:final | 9.233 · 7.428 · 7.415 | 24.5% |
| ch_rmt | 1,000,000 | r1_latency_p50 · after_wait:final | 4.918 · 4.281 · 4.042 | 20.5% |
| ch_rmt | 1,000,000 | r2_latency_p95 · after_wait:final | 42.955 · 30.965 · 31.738 | 37.8% |
| ch_rmt | 1,000,000 | r2_latency_p95 · before_merge:final | 36.26 · 29.587 · 31.786 | 21.0% |
| pg | 10,000 | update_latency_p95 · — | 0.37 · 0.314 · 0.276 | 29.9% |
| pg | 10,000 | visible_after_ack_p95 · default | 0.168 · 0.197 · 0.163 | 20.2% |
| pg | 100,000 | update_latency_p95 · — | 0.309 · 0.339 · 0.4 | 26.8% |
| pg | 1,000,000 | r2_latency_p50 · before_merge:default | 30.187 · 24.496 · 23.391 | 27.7% |

- 검산: 판정 지표 초과 = R1 · R2 지연 32(R2 p50 14 · R2 p95 14 · R1 p50 2 · R1 p95 2) + update_latency_p95 2 + visible_after_ack_p95 1 = **35** · 편차 판정 제외 순간값 초과 11(위 불릿)은 표에 넣지 않는다
- **초과의 성격이 둘이다.** ① R1 · R2 지연(32행)은 3~43 ms 값의 흔들림(대부분 1 ms 안팎) — R2는 반복당 5회 표본의 p50 · p95라 표본이 적다. ② PostgreSQL p95 3행(갱신 p95 2 · 가시성 p95 1)은 서브 ms 값(0.163~0.4 ms)의 흔들림이다.
- **폐기 뒤 절차 — 원인을 잡아 재측정한다(리드 판정).** 재측정 조건은 R2 반복당 표본 수(현재 5회)를 늘리는 것이다. 새 기록 번호로 쓰고 이 기록은 discarded로 남긴다(04 §반복과 폐기 폐기 후 행).
- **구조 사실 — 인용 가능 · 분포 수치 — 폐기.** 04 §구조 판정과 분포 판정 표가 구조 판정에는 편차 폐기를 적용하지 않으므로, 이 기록 안의 3회 전부 같은 구조 결과는 구조 사실로 인용할 수 있다 — hot_upd 0(900건) · dead_tup 100 · tup_upd 100 · rowCounts one 100(PostgreSQL) · ①② mutation 1건 = 파트 전 행 재작성(MutatePart n 100 · rows 합 = 규모 × 100) · ③ 갱신 1건 = patch 파트 1개(new_parts 100) · 자연 대기 뒤 patch 미반영(mutate after_wait 0) · ④ plain 상한 안 미관측 50 × 3회 × 3규모 · 10^5 · 10^6 after_wait 같은 키 중복 50 → after_force 0 · 전 변형 budget_exhausted 0. 지연 · 가시성 시간 · 바이트 크기 같은 분포 수치는 폐기이며 인용하지 않는다.
- **4요소는 충족이다.** run.memoryLimitMb null에 memoryLimitSource를 함께 실었다(04 §조건 칸 도구 컨테이너 경로 불릿) — 대조 저장소 상한 3,584 MB로 채우지 않는다. 용량 티어는 "해당 없음"을 문자열로 싣는다(.omc 기록 규약).
- 불성립 구조 판정 없음 · 호출 실패 없음(EXP-40 45회 전부 종료 코드 0 · 역방향 격자 전체 297회) · 예산 소진 없음(budget_exhausted 전부 0 · skippedPhases 없음) · 도구 CPU 포화 반복 없음(동시성 1 · 재지 않음).

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **분포 수치는 정본에 올리지 않는다(status discarded).** 재측정 기록이 대신한다.
- **W6에서 리드가 반영한다** — 04_architecture/04_storage_split #9 개정 문안은 이 기록의 구조 사실로만 한정한다 — ④ RMT plain 판독 상한 안 미관측 50 × 3회 × 3규모 · 같은 키 중복 50 → 강제 뒤 0(10^5 · 10^6) · ③ 경량 UPDATE 1건 = patch 파트 1개(new_parts 100) · ①② ALTER UPDATE 1건 = 파트 전 행 재작성(MutatePart rows 합 = 규모 × 100). **① apply_mutations_on_fly 0 판독의 옛 상태 · ③ 경량 UPDATE 즉시 보임 · on-the-fly 판독 · FINAL의 즉시 가시성은 가시성 분포 주장이라 폐기 기록 — 인용 불가 · 재측정 뒤 판정**이다 — #9 문안에 넣지 않는다. 가시성 시간 · 재작성 바이트 값도 재측정 뒤 인용한다.
- 미확인으로 남기는 것 — 백그라운드 풀이 바쁠 때 ① on_fly_0 옛 상태 창의 길이 · 10^4 WAL · FPI가 10^5 이상의 절반인 원인 · ④ 10^4 merge_bytes가 반복마다 줄어드는 원인.

## 기계 판독 블록

reverse 행은 collect 요약(oltp-summary.json)의 EXP-40 660행 전부다 — 판정 지표 · 참고 지표를 함께 싣고, 편차 초과 표시는 §폐기 · 예외 표가 갖는다(판독 규칙 7). budget_exhausted 행은 실증 패널의 원리 칸이 뺀다(측정 장부 지표).

```json
{
  "schema": "measurement/v1",
  "record": "040",
  "exp": [
    "EXP-40"
  ],
  "status": "discarded",
  "supersedes": null,
  "window": {
    "start": "2026-09-26T20:17:01.788Z",
    "end": "2026-09-26T23:10:45.879Z"
  },
  "run": {
    "commitHash": "19f8861",
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
    "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861)",
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
    "fillSnapshots": "oltp-s{scale}-19f8861",
    "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle)",
    "clickhouseVersion": "26.8.10.6",
    "clickhouseMaxThreads": 3,
    "pgVersion": "18.6",
    "pgSessionSynchronousCommit": "off",
    "pgServerSynchronousCommit": "on",
    "pgSharedBuffers": "896MB",
    "runnerDirty": true,
    "raw": "docs/measurements/raw/040-oltp-control-update.jsonl",
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
    "spreadExceededJudgedRows": 35,
    "excludedFromDeviation": "patch_parts · merge_bytes_per_update · active_parts (merge-timing instantaneous values — 06_experiment_catalog EXP-29~39 bullet \"same bullet applied to reverse · grid\" 2026-09-27) · server_update_mean · new_parts (reference metric — not in catalog judged column) · new_part_bytes_per_update · mutations_pending · r1_read_rows · r2_read_rows · wal_fpi_per_update · tup_upd · visible_unobserved · budget_exhausted (reference)",
    "executorArgs": {
      "n": 100,
      "nRmt": 50,
      "pollIntervalMs": 5,
      "pollMax": 2000,
      "pollMaxRmt": 200,
      "r2Repeat": 5,
      "converge": "both",
      "settleMaxSec": 120,
      "budgetSec": 510
    },
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
    "convergeDefinition": "force statement ok + mutations pending 0 · activePatchParts observed (detail.converge)"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.3778,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.418, 1.225, 1.307], "median": 1.307},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [4.226, 3.79, 3.909], "median": 3.909},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.095, 4.758, 4.976], "median": 4.976},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.071, 3.961, 3.991], "median": 3.991},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.154, 4.754, 4.744], "median": 4.754},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [3.071, 3.836, 3.84], "median": 3.836},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [3.15, 4.123, 4.064], "median": 4.064},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.029, 4.026, 4.015], "median": 4.026},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.612, 5.028, 5.066], "median": 5.028},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.879, 3.076, 4.115], "median": 3.879},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.148, 3.933, 4.235], "median": 4.148},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.248, 3.97, 3.965], "median": 3.97},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [5.313, 4.619, 4.438], "median": 4.619},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.311, 4.18, 4.317], "median": 4.311},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [5.293, 4.893, 6.248], "median": 5.293},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [3.951, 4.141, 4.039], "median": 4.039},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.698, 5.223, 5.119], "median": 5.119},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [2.99, 4, 3.135], "median": 3.135},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [3.159, 4.258, 3.244], "median": 3.244},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.878, 3.971, 3.954], "median": 3.954},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.697, 4.805, 4.373], "median": 4.697},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.071, 3.873, 3.976], "median": 3.976},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [8.028, 8.291, 8.423], "median": 8.291},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.011, 4.022, 4.07], "median": 4.022},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.997, 4.961, 5.07], "median": 4.997},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.021, 4.002, 3.942], "median": 3.942},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [3.305, 4.152, 4.346], "median": 4.152},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [14.255, 14.151, 14.244], "median": 14.244},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [16.219, 16.402, 16.209], "median": 16.219},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.242, 4.398, 4.337], "median": 4.337},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.47, 5.19, 5.265], "median": 5.265},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 10000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.169, 1.141, 1.136], "median": 1.141},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [3.588, 3.676, 3.717], "median": 3.676},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [4.566, 4.536, 4.633], "median": 4.566},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.968, 3.945, 4], "median": 3.968},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.478, 4.538, 4.699], "median": 4.538},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.746, 4.283, 4.805], "median": 4.746},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [5.268, 4.828, 5.142], "median": 5.142},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.001, 3.996, 3.98], "median": 3.996},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.498, 5.045, 4.465], "median": 4.498},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [3.823, 4.209, 4.045], "median": 4.045},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.231, 4.59, 4.182], "median": 4.231},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.985, 3.884, 3.986], "median": 3.985},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.411, 4.472, 4.737], "median": 4.472},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.044, 4.983, 5.211], "median": 4.983},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [4.242, 5.058, 5.468], "median": 5.058},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.068, 4.05, 3.941], "median": 4.05},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.967, 5.084, 4.367], "median": 4.967},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [4.153, 4.114, 3.945], "median": 4.114},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [4.173, 5.129, 4.069], "median": 4.173},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.604, 3.989, 4.109], "median": 3.989},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.571, 4.907, 5.419], "median": 4.907},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [4.027, 3.976, 5.054], "median": 4.027},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [8.642, 8.334, 9.905], "median": 8.642},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.084, 3.986, 3.985], "median": 3.986},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.055, 4.633, 4.449], "median": 4.633},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [5.019, 4.975, 4.909], "median": 4.975},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [5.29, 5.939, 5.027], "median": 5.29},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [26.321, 25.812, 26.006], "median": 26.006},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [32.025, 33.04, 30.407], "median": 32.025},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.313, 4.387, 4.365], "median": 4.365},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.053, 5.865, 5.411], "median": 5.411},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 100000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.187, 1.178, 1.195], "median": 1.187},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [3.715, 3.688, 3.66], "median": 3.688},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [4.808, 4.643, 4.692], "median": 4.692},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [4.04, 4.25, 4.167], "median": 4.167},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.89, 5.229, 5.206], "median": 5.206},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [7.059, 6.91, 6.886], "median": 6.91},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [7.398, 7.395, 7.574], "median": 7.398},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [3.98, 4.002, 4.034], "median": 4.002},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.804, 4.701, 5.169], "median": 4.804},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [5.963, 6.34, 6.864], "median": 6.34},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [6.271, 6.834, 7.236], "median": 6.834},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.957, 4.069, 4.388], "median": 4.069},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.48, 5.242, 5.374], "median": 5.242},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [6.92, 7.012, 7.146], "median": 7.012},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [7.188, 8.62, 8.068], "median": 8.068},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.057, 4.15, 4.049], "median": 4.057},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [5.139, 5.287, 5.097], "median": 5.139},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [7.428, 6.791, 6.227], "median": 6.791},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [7.988, 7.444, 6.28], "median": 7.444},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p50", "unit": "ms", "values": [3.929, 4.018, 4.059], "median": 4.018},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_latency_p95", "unit": "ms", "values": [4.659, 5.007, 4.777], "median": 4.777},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p50", "unit": "ms", "values": [5.989, 6.867, 6.484], "median": 6.484},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_latency_p95", "unit": "ms", "values": [10.019, 11.561, 10.538], "median": 10.538},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_0", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p50", "unit": "ms", "values": [4.044, 4.062, 3.964], "median": 4.044},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_latency_p95", "unit": "ms", "values": [4.811, 5.149, 4.727], "median": 4.811},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p50", "unit": "ms", "values": [6.845, 6.876, 5.875], "median": 6.845},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_latency_p95", "unit": "ms", "values": [7.208, 7.179, 6.487], "median": 7.179},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:on_fly_1", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p50", "unit": "ms", "values": [46.199, 46.338, 46.432], "median": 46.338},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_after_ack_p95", "unit": "ms", "values": [49.413, 50.578, 51.147], "median": 50.578},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_0", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p50", "unit": "ms", "values": [4.337, 4.351, 4.374], "median": 4.351},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_after_ack_p95", "unit": "ms", "values": [5.066, 5.279, 4.909], "median": 5.066},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_async", "scale": 1000000, "concurrency": 1, "rate": null, "read": "on_fly_1", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [5.765, 5.665, 5.492], "median": 5.665},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [8.568, 8.336, 8.029], "median": 8.336},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [9.917, 9.889, 9.272], "median": 9.889},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.042, 4.019, 4.02], "median": 4.02},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.968, 4.92, 5.099], "median": 4.968},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.089, 3.107, 3.188], "median": 3.188},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.857, 4.213, 4.18], "median": 4.213},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.05, 3.921, 4.067], "median": 4.05},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.927, 4.369, 5.049], "median": 4.927},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.304, 3.638, 3.918], "median": 3.638},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.722, 3.975, 4.072], "median": 4.072},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [271905.45, 271890.01, 271870.91], "median": 271890.01},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.02, 4.008, 3.974], "median": 4.008},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.024, 4.856, 4.396], "median": 4.856},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.56, 3.825, 3.463], "median": 3.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.233, 4.183, 4.093], "median": 4.183},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.434, 3.428, 3.452], "median": 3.434},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.394, 4.45, 4.332], "median": 4.394},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [21.907, 21.746, 22.199], "median": 21.907},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [24.697, 24.323, 24.937], "median": 24.697},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [27.779, 27.567, 28.545], "median": 27.779},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.978, 4.062, 3.973], "median": 3.978},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.873, 5.107, 4.921], "median": 4.921},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.93, 4.76, 5.068], "median": 4.76},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.293, 5.327, 5.346], "median": 5.327},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.033, 4, 3.986], "median": 4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.001, 4.865, 4.476], "median": 4.865},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.203, 4.324, 4.232], "median": 4.232},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [5.176, 4.696, 5.022], "median": 5.022},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2562661.56, 2562649.81, 2562736.98], "median": 2562661.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.974, 3.955, 3.997], "median": 3.974},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.951, 4.407, 4.56], "median": 4.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.955, 4.702, 4.947], "median": 4.702},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.156, 5.246, 5.216], "median": 5.216},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.597, 3.598, 3.531], "median": 3.597},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.527, 4.771, 4.684], "median": 4.684},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [38.171, 37.888, 38.924], "median": 38.171},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [40.983, 40.869, 41.326], "median": 40.983},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [46.084, 45.479, 47.492], "median": 46.084},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.058, 3.992, 4.008], "median": 4.008},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.167, 4.564, 4.719], "median": 4.719},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [5.886, 7.002, 6.131], "median": 6.131},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.418, 7.091, 6.879], "median": 6.879},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.031, 3.973, 4.083], "median": 4.031},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.991, 4.889, 5.119], "median": 4.991},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.943, 5.94, 7.035], "median": 6.943},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.99, 6.437, 7.095], "median": 6.99},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25347437.86, 25347643.72, 25347582.1], "median": 25347582.1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.245, 4.042, 4.04], "median": 4.042},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.276, 5.034, 4.928], "median": 5.034},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [5.915, 6.969, 6.14], "median": 6.14},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.096, 7.344, 6.511], "median": 6.511},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.571, 3.6, 3.69], "median": 3.6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.508, 4.728, 4.582], "median": 4.582},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_alter_sync", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.155, 2.091, 2.091], "median": 2.091},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [5.001, 4.828, 5.012], "median": 5.001},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.843, 5.66, 5.718], "median": 5.718},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [329.24, 359.55, 338.23], "median": 338.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [2718.88, 2718.92, 2719.42], "median": 2718.92},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [5, 1, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.029, 3.943, 4.089], "median": 4.029},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.102, 4.595, 5.163], "median": 5.102},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.146, 3.408, 3.166], "median": 3.408},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.406, 3.815, 4.059], "median": 4.059},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [329.24, 359.55, 338.23], "median": 338.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [5, 1, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.205, 4.036, 4.071], "median": 4.071},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.099, 4.843, 5.05], "median": 5.05},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.758, 3.32, 4.003], "median": 3.758},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.657, 4.592, 4.294], "median": 4.592},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [329.24, 359.55, 338.23], "median": 338.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1086.94, 1087.11, 1087.13], "median": 1087.11},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [5, 1, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.989, 3.992, 3.985], "median": 3.989},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.705, 4.523, 4.377], "median": 4.523},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [4.067, 3.499, 3.997], "median": 3.997},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.095, 4.496, 4.202], "median": 4.202},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.724, 3.612, 3.734], "median": 3.724},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.611, 4.522, 4.416], "median": 4.522},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [1.978, 2.07, 2.047], "median": 2.047},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [4.863, 4.882, 5.117], "median": 4.882},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.468, 5.684, 5.764], "median": 5.684},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [344.21, 344.5, 345.71], "median": 344.5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [25626.86, 25626.54, 25627.82], "median": 25626.86},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [4, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.991, 4.03, 3.944], "median": 3.991},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.905, 4.977, 4.655], "median": 4.905},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [3.96, 3.764, 4.178], "median": 3.96},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [4.285, 4.21, 4.375], "median": 4.285},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [344.21, 344.5, 345.71], "median": 344.5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [4, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.126, 4.025, 4.024], "median": 4.025},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.127, 4.695, 4.915], "median": 4.915},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.827, 6.906, 6.159], "median": 6.827},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.131, 8.126, 7.219], "median": 7.219},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [344.21, 344.5, 345.71], "median": 344.5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1086.04, 1086.02, 1086.15], "median": 1086.04},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [4, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.96, 4.016, 4.017], "median": 4.016},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.601, 4.894, 4.89], "median": 4.89},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8395.52, 8344.64, 8344.64], "median": 8344.64},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.182, 6.965, 6.972], "median": 6.965},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [6.415, 7.705, 7.327], "median": 7.327},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.709, 3.896, 3.55], "median": 3.709},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.448, 4.594, 4.459], "median": 4.459},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.01, 2.009, 1.961], "median": 2.009},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [4.857, 4.805, 4.795], "median": 4.805},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [5.534, 5.653, 5.48], "median": 5.534},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [352.23, 364.32, 342.75], "median": 352.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [253474.59, 253475.38, 253476.89], "median": 253475.38},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [3, 1, 5], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.033, 4.26, 3.982], "median": 4.033},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.998, 5.131, 4.837], "median": 4.998},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.905, 6.305, 6.352], "median": 6.352},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_latency_p95", "unit": "ms", "values": [7.359, 7.016, 6.975], "median": 7.016},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [352.23, 364.32, 342.75], "median": 352.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [3, 1, 5], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p50", "unit": "ms", "values": [4.195, 4.038, 4.038], "median": 4.038},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_latency_p95", "unit": "ms", "values": [5.246, 4.906, 4.861], "median": 4.906},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p50", "unit": "ms", "values": [15.33, 14.523, 14.781], "median": 14.781},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_latency_p95", "unit": "ms", "values": [17.349, 17.528, 16.805], "median": 17.349},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [352.23, 364.32, 342.75], "median": 352.23},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [1084.27, 1084.19, 1084.34], "median": 1084.27},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [3, 1, 5], "median": 3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [3.991, 4.051, 4.011], "median": 4.011},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [4.81, 4.715, 5.017], "median": 4.81},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [15.217, 13.971, 15.524], "median": 15.217},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [16.322, 16.697, 17.254], "median": 16.697},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [3.745, 3.601, 3.651], "median": 3.651},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [4.591, 4.511, 4.466], "median": 4.511},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_lwu", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [3.112, 3.107, 3.162], "median": 3.112},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [6.677, 7.034, 6.892], "median": 6.892},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [9.581, 10.166, 8.991], "median": 9.581},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [190789.38, 169027.86, 147305.32], "median": 169027.86},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.876, 3.98, 3.951], "median": 3.951},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.857, 4.58, 4.83], "median": 4.83},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.88, 6787.52, 6915.2], "median": 6915.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [3.119, 3.116, 3.646], "median": 3.119},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [3.185, 3.237, 4.242], "median": 3.237},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.386, 3.805, 3.664], "median": 3.664},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.481, 4.402, 4.41], "median": 4.41},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.88, 6787.52, 6915.2], "median": 6915.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [2.783, 3.987, 3.408], "median": 3.408},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [3.39, 4.07, 4.074], "median": 4.07},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [5, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [185339.68, 163579.4, 141856.44], "median": 163579.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.841, 3.908, 4.142], "median": 3.908},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.231, 4.763, 5.159], "median": 5.159},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6787.6, 6917.66], "median": 6917.66},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [3.811, 4.533, 3.79], "median": 3.811},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.628, 4.901, 4.824], "median": 4.824},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [4.131, 3.385, 3.637], "median": 3.637},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [5.282, 4.283, 4.368], "median": 4.368},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6787.6, 6915.76], "median": 6915.76},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [3.6, 3.951, 3.974], "median": 3.951},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.582, 4.132, 4.106], "median": 4.132},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [5, 5, 5], "median": 5},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [185339.68, 163579.4, 141856.44], "median": 163579.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2545.64, 2545.74, 2545.76], "median": 2545.74},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [3.893, 3.882, 3.854], "median": 3.882},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.623, 4.378, 4.471], "median": 4.471},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6787.6, 6917.66], "median": 6917.66},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [3.828, 3.649, 3.738], "median": 3.738},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.225, 4.496, 4.387], "median": 4.387},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.736, 3.877, 3.746], "median": 3.746},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.417, 4.458, 4.505], "median": 4.458},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [7042.96, 6787.6, 6917.66], "median": 6917.66},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [3.931, 3.506, 3.996], "median": 3.931},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.262, 3.877, 4.053], "median": 4.053},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [10004, 10004, 10008], "median": 10004},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.593, 5.211, 5.383], "median": 5.383},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [7.705, 6.981, 7.357], "median": 7.357},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [2.952, 3.228, 2.987], "median": 2.987},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [6.167, 6.25, 6.501], "median": 6.25},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [8.874, 8.62, 9.635], "median": 8.874},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [52006.2, 52010.2, 52012.02], "median": 52010.2},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.013, 3.972, 4.1], "median": 4.013},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [4.728, 4.647, 5.147], "median": 4.728},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [8062.08, 8062.08, 8062.08], "median": 8062.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [3.921, 4.088, 5.013], "median": 4.088},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [4.064, 4.374, 5.141], "median": 4.374},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.872, 3.99, 3.942], "median": 3.942},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.37, 4.316, 4.309], "median": 4.316},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8062.08, 8062.08, 8062.08], "median": 8062.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [3.981, 4.024, 3.889], "median": 3.981},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.562, 4.368, 4.255], "median": 4.368},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100000, 100000, 100000], "median": 100000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [6, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [815.02, 816.3, 818.6], "median": 816.3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.336, 4.065, 4.438], "median": 4.336},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.206, 5.186, 5.29], "median": 5.206},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [8441.6, 8441.6, 8338.92], "median": 8441.6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [8.25, 7.983, 8.517], "median": 8.25},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [9.35, 8.189, 9.305], "median": 9.305},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.85, 3.94, 3.997], "median": 3.94},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.595, 4.47, 5.739], "median": 4.595},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8437.92, 8437.92, 8336.16], "median": 8437.92},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [4.172, 4.111, 4.202], "median": 4.172},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [6.231, 4.344, 5.921], "median": 5.921},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [6, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [815.02, 816.3, 818.6], "median": 816.3},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2546.52, 2546.34, 2546.44], "median": 2546.44},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.087, 4.006, 4.038], "median": 4.038},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.086, 4.425, 4.97], "median": 4.97},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [8441.6, 8441.6, 8338.92], "median": 8441.6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [8.019, 7.89, 7.918], "median": 7.918},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [8.907, 8.097, 8.82], "median": 8.82},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.956, 3.956, 3.816], "median": 3.956},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.44, 4.415, 4.249], "median": 4.415},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8437.92, 8437.92, 8336.16], "median": 8437.92},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [4.048, 4.028, 3.946], "median": 4.028},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [4.595, 4.854, 4.497], "median": 4.595},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [100050, 100050, 100050], "median": 100050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.277, 5.607, 5.286], "median": 5.286},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [6.524, 6.671, 7.164], "median": 6.671},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [3.102, 3.254, 3.221], "median": 3.221},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [6.692, 7.067, 6.519], "median": 6.692},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [9.109, 8.852, 9.056], "median": 9.056},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "active_parts", "unit": "count", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "merge_bytes_per_update", "unit": "B", "values": [507045.1, 506929.46, 506934.06], "median": 506934.06},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.068, 3.981, 3.965], "median": 3.981},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.219, 4.587, 4.907], "median": 4.907},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p50", "unit": "ms", "values": [8.403, 7.026, 6.805], "median": 7.026},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_latency_p95", "unit": "ms", "values": [9.233, 7.428, 7.415], "median": 7.428},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.986, 4.025, 3.998], "median": 3.998},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.404, 4.313, 4.445], "median": 4.404},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8192, 8192, 8192], "median": 8192},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [7.712, 8.185, 8.628], "median": 8.185},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [8.337, 9.101, 9.127], "median": 9.101},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000000, 1000000, 1000000], "median": 1000000},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "active_parts", "unit": "count", "values": [2, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "merge_bytes_per_update", "unit": "B", "values": [945.6, 828.56, 826.66], "median": 828.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.918, 4.281, 4.042], "median": 4.281},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.354, 5.541, 4.646], "median": 5.354},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8237.16, 8238.08], "median": 8238.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p50", "unit": "ms", "values": [28.092, 29.178, 29.907], "median": 29.178},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_latency_p95", "unit": "ms", "values": [42.955, 30.965, 31.738], "median": 31.738},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [3.966, 4.034, 4.059], "median": 4.034},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.568, 5.007, 4.704], "median": 4.704},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8234.4, 8234.4], "median": 8234.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [7.827, 8.673, 7.965], "median": 7.965},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [8.4, 9.994, 8.941], "median": 8.941},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "active_parts", "unit": "count", "values": [2, 6, 6], "median": 6},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "merge_bytes_per_update", "unit": "B", "values": [945.6, 828.56, 826.66], "median": 828.56},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutate_bytes_per_update", "unit": "B", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "mutations_pending", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_part_bytes_per_update", "unit": "B", "values": [2546.66, 2546.64, 2546.72], "median": 2546.66},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "new_parts", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_writes", "metric": "patch_parts", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p50", "unit": "ms", "values": [4.589, 4.13, 3.983], "median": 4.13},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_latency_p95", "unit": "ms", "values": [5.216, 5.202, 4.645], "median": 5.202},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8237.16, 8238.08], "median": 8238.08},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p50", "unit": "ms", "values": [28.689, 29.399, 29.423], "median": 29.399},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_latency_p95", "unit": "ms", "values": [36.26, 29.587, 31.786], "median": 31.786},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:final", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p50", "unit": "ms", "values": [4.003, 3.972, 3.99], "median": 3.99},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_latency_p95", "unit": "ms", "values": [4.823, 4.859, 4.565], "median": 4.823},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r1_read_rows", "unit": "rows", "values": [8242, 8234.4, 8234.4], "median": 8234.4},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p50", "unit": "ms", "values": [8.058, 8.832, 8.849], "median": 8.832},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_latency_p95", "unit": "ms", "values": [8.229, 9.493, 9.201], "median": 9.201},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:plain", "metric": "r2_read_rows", "unit": "rows", "values": [1000050, 1000050, 1000050], "median": 1000050},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p50", "unit": "ms", "values": [5.197, 5.418, 5.823], "median": 5.418},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_after_ack_p95", "unit": "ms", "values": [7.151, 7.096, 7.283], "median": 7.151},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p50", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_after_ack_p95", "unit": "ms", "values": [null, null, null], "median": null},
    {"exp": "EXP-40", "op": "update", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "plain", "metric": "visible_unobserved", "unit": "count", "values": [50, 50, 50], "median": 50},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.072, 0.071, 0.071], "median": 0.071},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.175, 0.167, 0.166], "median": 0.167},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.37, 0.314, 0.276], "median": 0.314},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [3074.59, 3097.16, 3116.87], "median": 3097.16},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [1.33, 1.34, 1.35], "median": 1.34},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.258, 0.247, 0.257], "median": 0.257},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.471, 0.519, 0.453], "median": 0.471},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [1.189, 1.201, 1.202], "median": 1.201},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [1.729, 1.749, 1.767], "median": 1.749},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.127, 0.125, 0.122], "median": 0.125},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.168, 0.197, 0.163], "median": 0.168},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.134, 0.134, 0.148], "median": 0.134},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.236, 0.235, 0.258], "median": 0.236},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.309, 0.339, 0.4], "median": 0.339},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [6588.04, 6605.05, 6606.06], "median": 6605.05},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [3.04, 3.04, 3.04], "median": 3.04},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.241, 0.254, 0.241], "median": 0.241},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.503, 0.463, 0.454], "median": 0.463},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [6.993, 7.291, 7.219], "median": 7.219},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [9.183, 8.927, 9.029], "median": 9.029},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.126, 0.124, 0.133], "median": 0.126},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.169, 0.186, 0.197], "median": 0.186},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "dead_tup", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "hot_upd", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_update_mean", "unit": "ms", "values": [0.14, 0.141, 0.14], "median": 0.14},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tup_upd", "unit": "count", "values": [100, 100, 100], "median": 100},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p50", "unit": "ms", "values": [0.241, 0.241, 0.241], "median": 0.241},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "update_latency_p95", "unit": "ms", "values": [0.302, 0.327, 0.316], "median": 0.316},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_bytes_per_update", "unit": "B", "values": [6616.29, 6617.52, 6619.88], "median": 6617.52},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "wal_fpi_per_update", "unit": "count", "values": [3.04, 3.04, 3.04], "median": 3.04},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p50", "unit": "ms", "values": [0.248, 0.253, 0.245], "median": 0.248},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r1_latency_p95", "unit": "ms", "values": [0.443, 0.494, 0.406], "median": 0.443},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p50", "unit": "ms", "values": [30.187, 24.496, 23.391], "median": 24.496},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge:default", "metric": "r2_latency_p95", "unit": "ms", "values": [32.978, 32.879, 30.234], "median": 32.879},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "budget_exhausted", "unit": "count", "values": [0, 0, 0], "median": 0},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p50", "unit": "ms", "values": [0.127, 0.127, 0.129], "median": 0.127},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_after_ack_p95", "unit": "ms", "values": [0.164, 0.164, 0.165], "median": 0.164},
    {"exp": "EXP-40", "op": "update", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "default", "metric": "visible_unobserved", "unit": "count", "values": [0, 0, 0], "median": 0}
  ]
}
```

