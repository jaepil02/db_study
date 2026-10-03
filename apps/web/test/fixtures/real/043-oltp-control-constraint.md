# 043 — 역방향 대조 EXP-43 무결성 제약: 동시 중복 order_no · 없는 line_id · CHECK 위반(INSERT · UPDATE 경로) · 재삽입 × PostgreSQL 제약 · ClickHouse MergeTree · RMT · 중복 제거 윈도우 100 + 토큰 × 업무 규모 10^4 · 10^5 · 10^6 (S5)

> 실험: EXP-43 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-26T20:21:19.751Z ~ 2026-09-26T23:12:17.110Z(EXP-43 측정 행 at — 호출 끝 시각의 첫 값 ~ 마지막 값) · 실행 2026-09-27 05:14~08:27 KST(역방향 격자 전체 · 원시 첫 행 2026-09-26T20:14:58.921Z ~ 마지막 행 23:27:12.323Z)

역방향 대조의 무결성 축이다(05_data_stores/10 §역방향 대조 — 업무 워크로드 · EXP-43 행). 같은 잘못된 입력 네 가지를 두 저장소에 보내고, 저장소가 **쓰기 시점에 거절하는가(수용 건수)**와 ClickHouse가 **머지로 나중에 수렴하는가(머지 전 · 후 중복 수)**를 가른다. ⓐ 같은 order_no 동시 삽입 K = 8 ⓑ 없는 line_id ⓒ CHECK 위반 3종(target_qty 0 · planned_end = planned_start · status 값 밖) — INSERT 경로와 UPDATE 경로 ⓓ 같은 주문 재삽입(재시도 모양)이다.

**판정은 두 종류다.** 수용 건수 · 중복 수는 구조 지표(3회 전부)이고, RMT의 FINAL 대 비 FINAL 조회 시간 · read_rows만 분포 지표(3회 중앙값)다(06_experiment_catalog EXP-43 행).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(실행기 detail.run.commitHash · 러너 git dirty true) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · **run.memoryLimitMb null · memoryLimitSource cgroup max — oltp-lab 서비스에 compose 상한 없음** — 4요소 충족(04_experiment_protocol §조건 칸 도구 컨테이너 경로 조항 · 기록 042와 같다) |
| 용량 티어 | **해당 없음** — 업무 규모 단계가 축(05_data_stores/10 §역방향 측정 조건) |
| 저장소 자원 | ClickHouse cpuset 5-7 · 3,584 MiB · 26.8.10.6 / PostgreSQL cpuset 8-10 · 3,584 MiB · 18.6 — 기록 042와 같은 init |
| 스위치 · 주입 · 관측 · 압축 | 전부 기본값(SW-09=off · SW-10=off) · 주입 없음 · api 정지 · 관측 프로파일 off · 압축 **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861) · 테이블 코덱은 DDL 기본 |
| 규모 · 시작 상태 | 기록 042와 같다 — 규모마다 빈 기준 복원 → fill → settle → 채움 스냅샷 · PostgreSQL 실행 뒤 reset all · ClickHouse 실행 뒤 reset clickhouse |
| PostgreSQL | 업무 테이블 work_order 그대로(UNIQUE(order_no) · FK line_id → production_line · CHECK 3 — 제약 이름은 오류 문구 work_order_order_no_key · work_order_line_id_fkey · work_order_target_qty_check · work_order_check · work_order_status_check) · 세션 synchronous_commit off |
| ClickHouse 변형 | ch_mt = work_order_control(MergeTree · CHECK CONSTRAINT c_target_qty · c_planned · c_status) · ch_rmt = work_order_control_rmt(ReplacingMergeTree(version) · INSERT 경로만) · ch_mt_dedup = work_order_control에 ⓓ만 · non_replicated_deduplication_window 100을 실행 범위에서 켜고 되돌림 |
| ⓐ 입력 | K = 8 동시(두 저장소 커넥션 8 · 미리 연결) · 같은 order_no · 행마다 다른 order_id(PostgreSQL IDENTITY · ClickHouse 실행기 발급) · 윈도우 0 |
| ⓓ 입력 | **PostgreSQL = 같은 order_no 재전송**(order_id는 IDENTITY라 보내지 않는다 — 행마다 새 order_id) · **ClickHouse = 같은 order_id · 같은 order_no 재전송**(detail.reinsertShape) — 2회 |
| UPDATE 경로 | PostgreSQL UPDATE · ClickHouse work_order_control의 경량 UPDATE(enable_lightweight_update 1)와 ALTER UPDATE(mutations_sync 1) — 오류 없이 위반 값이 되읽히면(apply_patch_parts 1) 수용 · RMT는 INSERT 경로만 |
| 머지 뒤 판독 | before_merge(삽입 직후) · final(RMT FINAL) · after_wait(자연 settle — 활성 파트 3표본 불변 · 머지 0 · 미완 mutation 0) · after_force(OPTIMIZE TABLE … FINAL — MergeTree · RMT 같은 강제) — 한 호출 안에서 차례로 |
| FINAL 비용 | RMT 상태별 건수(SELECT status, count() … GROUP BY status) FINAL · 비 FINAL 각 10회 · 클라이언트 p50 · 서버 query_log read_rows 평균 |
| 반복 · 편차 | 3회 · 구조 지표는 편차 미적용 · 분포 지표 최대 편차 **13.3%**(status_count_latency_p50 ch_rmt no_final 10^5 — 4.603 · 4.021 · 4.381) ≤ 20% · 규모 3 × 변형 4 × 3회 = 36호출 전부 rc 0 |
| 원시 | docs/measurements/raw/043-oltp-control-constraint.jsonl(743행 — 앞 230행 공통 · 뒤 513행 = measure 477 + detail 36) · 요약 oltp-summary.json |

- 검산: 조건 항목 = **15**

## 결과

### 수용 건수 — 구조 판정 3회 전부

값은 반복 0 · 1 · 2다. 세 규모가 모두 같은 값이라 한 칸에 적는다(규모별 전수는 기계 판독 블록). 수용 = 오류 없이 들어간(UPDATE는 위반 값이 되읽힌) 건수다.

| 경우 | 시도 | PostgreSQL | ClickHouse MergeTree | ClickHouse RMT |
|------|:--:|------|------|------|
| ⓐ 같은 order_no 동시 dup_order_no | 8 | **1 · 1 · 1** | **8 · 8 · 8** | **8 · 8 · 8** |
| ⓑ 없는 line_id missing_line | 1 | **0 · 0 · 0** | **1 · 1 · 1** | **1 · 1 · 1** |
| ⓒ CHECK target_qty 0 — INSERT | 1 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| ⓒ CHECK planned_end = planned_start — INSERT | 1 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| ⓒ CHECK status 값 밖 — INSERT | 1 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| ⓒ CHECK target_qty 0 — UPDATE(PG UPDATE · CH 경량 UPDATE) | 1 | 0 · 0 · 0 | **1 · 1 · 1** | 해당 없음(INSERT 경로만) |
| ⓒ CHECK planned — UPDATE(상동) | 1 | 0 · 0 · 0 | **1 · 1 · 1** | 해당 없음 |
| ⓒ CHECK status — UPDATE(상동) | 1 | 0 · 0 · 0 | **1 · 1 · 1** | 해당 없음 |
| ⓒ CHECK 3종 — ALTER UPDATE(mutations_sync 1) | 1 × 3 | 해당 없음(PG는 UPDATE 한 경로) | **1 · 1 · 1**(3종 각각) | 해당 없음 |
| ⓓ 재삽입 reinsert | 2 | **1 · 1 · 1** | **2 · 2 · 2** | **2 · 2 · 2** |

- 검산: 수용 행 = PostgreSQL 9 + MergeTree 12 + RMT 6 = 경우 27 × 규모 3 = **81** — 81행 전부 3회 같은 값(성립)
- PostgreSQL 거절 사유(detail.errors · 호출마다 15건) — dup_order_no 7 · reinsert 1 = UNIQUE work_order_order_no_key · missing_line 1 = FK work_order_line_id_fkey · CHECK 6(INSERT 3 · UPDATE 3) = work_order_target_qty_check · work_order_check · work_order_status_check. ClickHouse 거절(호출마다 3건)은 INSERT 경로 CHECK 3종뿐이다 — Constraint c_target_qty · c_planned · c_status is violated.

### 같은 order_no의 행 수 — 머지 전 · 후

rows_same_order_no(판독 시점별 · 반복 0 · 1 · 2). ⓐ는 8행 시도 · ⓓ는 2행 시도다.

| 변형 | 경우 | before_merge | final(RMT FINAL) | after_wait | after_force |
|------|------|------|------|------|------|
| PostgreSQL | ⓐ · ⓓ | 1 · 1 · 1 | 해당 없음 | 해당 없음 | 해당 없음 |
| MergeTree(3규모) | ⓐ | 8 · 8 · 8 | 해당 없음 | 8 · 8 · 8 | 8 · 8 · 8 |
| MergeTree(3규모) | ⓓ | 2 · 2 · 2 | 해당 없음 | 2 · 2 · 2 | 2 · 2 · 2 |
| RMT(3규모) | ⓐ | 8 · 8 · 8 | 8 · 8 · 8 | 8 · 8 · 8 | 8 · 8 · 8 |
| RMT 10^4 | ⓓ | 2 · 2 · 2 | 1 · 1 · 1 | 2 · 2 · 2 | 1 · 1 · 1 |
| RMT 10^5 · 10^6 | ⓓ | **1** · 2 · 2 | 1 · 1 · 1 | **1** · 2 · 2 | 1 · 1 · 1 |

- 검산: 중복 수 행 = PostgreSQL 2 × 3 + MergeTree 6 × 3 + RMT 8 × 3 = 6 + 18 + 24 = **48** — 구조 판정 42행(전부 3회 같은 값) + 참고 6행(RMT ⓓ 3규모의 before_merge · after_wait — 06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿 · 2026-09-27) · 참고 6행 중 4행(10^5 · 10^6)은 반복 0만 1

### 중복 제거 윈도우 100 + 토큰(ch_mt_dedup · ⓓ만)

윈도우 0 → 100(windowDuring 100) → 복원 0(windowAfter 0)이 ch_mt_dedup 9호출 전부에서 확인됐다. 값은 3규모 × 3회 전부 같다.

| 경우 | 삽입 시도 | 수용(오류 없음) | 남은 행 | DuplicatedInsertedBlocks 증분 |
|------|:--:|------|------|------|
| reinsert_token(insert_deduplication_token = order_no) | 2 | 2 · 2 · 2 | **1 · 1 · 1** | 2 · 2 · 2 |
| reinsert_hash(토큰 없음 · 블록 내용 해시) | 2 | 2 · 2 · 2 | **1 · 1 · 1** | 2 · 2 · 2 |

- 검산: 윈도우 행 = 지표 3 × 경우 2 × 규모 3 = **18** — 전부 3회 같은 값
- 기본 팔(윈도우 0) ch_mt의 ⓓ에서는 duplicatedInsertedBlocksDelta 0 · 행 2다. init 탐침(probe.dedupWindow0)도 윈도우 0에서 같은 삽입 2회 → 2행 · 증분 0이다.

### FINAL 비용 — 분포(3회 중앙값)

RMT 상태별 건수 10회의 클라이언트 p50(ms) · 서버 read_rows 평균. 삽입 직후(머지 전) 상태에서 잰다.

| 규모 | 비 FINAL p50 | FINAL p50 | FINAL ÷ 비 FINAL | 비 FINAL read_rows | FINAL read_rows |
|------|------|------|------|------|------|
| 10^4 | **4.153**(4.153 · 4.575 · 4.117) | **3.932**(3.874 · 3.932 · 4.044) | 0.95 | 10,011 | 10,018 |
| 10^5 | **4.381**(4.603 · 4.021 · 4.381) | **4.249**(4.065 · 4.249 · 4.253) | 0.97 | 100,011 | 100,011 |
| 10^6 | **6.409**(6.409 · 6.078 · 6.861) | **6.196**(6.231 · 6.196 · 5.955) | 0.97 | 1,000,011 | 1,000,011 |

- 검산: 분포 행 = 지표 2 × 판독 2 × 규모 3 = **12** · 편차 최대 13.3%(비 FINAL p50 10^5)
- read_rows는 반복마다 10,010 ~ 1,000,018로 한두 행 차이다(반복별 값은 기계 판독 블록).

## 해석

- **PostgreSQL은 네 입력을 전부 쓰기 시점에 거절한다 — 3규모 × 3회 × 17시도(ⓐ 8 + ⓑ 1 + CHECK INSERT 3 + UPDATE 3 + ⓓ 2)에서 수용은 ⓐ 8 중 1 · ⓓ 2 중 1뿐이고 나머지는 0(detail.errors 호출마다 거절 15건 + 수용 2 = 17).** UNIQUE(order_no)는 btree 유일 인덱스 검사라 동시 8개 중 먼저 커밋한 하나만 남기고 7개를 duplicate key로 거절한다(동시성 아래에서도 1 · 1 · 1). FK는 참조 행 검사로 없는 line_id를, CHECK 3종은 INSERT와 UPDATE 두 경로 모두를 커밋 전에 막는다. ⓓ에서 IDENTITY가 두 번째 행에 새 order_id를 줘도 같은 order_no라 UNIQUE가 거절한다 — "같은 주문을 한 번 더"를 order_id가 아니라 업무 키로 막는다.
- **ClickHouse는 CHECK CONSTRAINT의 INSERT 경로만 막는다.** MergeTree · RMT 모두 ⓒ INSERT 3종을 거절했고(Constraint … is violated · init 탐침 code 469) 나머지는 전부 수용했다 — ⓐ 8/8(UNIQUE 없음) · ⓑ 1/1(FK 없음) · ⓓ 2/2(윈도우 0에서 유일 검사 없음).
- **UPDATE 경로에서 CHECK는 검사되지 않는다 — 원시로 확인된다.** work_order_control의 경량 UPDATE 3종과 ALTER UPDATE(mutations_sync 1) 3종이 3규모 × 3회 전부 오류 없이 끝났고, apply_patch_parts 1 되읽기에서 target_qty 0 · planned_end = planned_start · status 'BOGUS'가 그대로 보였다(수용 1 · 1 · 1). 같은 테이블이 같은 값을 INSERT로는 거절했다. init 탐침(probe.checkUpdatePath — lwu · alter × 3종 전부 accepted true · checkInsertPath code 469)도 같다. 그래서 ClickHouse의 CHECK는 "행이 들어올 때의 검사"이지 "테이블이 늘 만족하는 불변식"이 아니다 — 원리 대응 표의 "CHECK CONSTRAINT는 INSERT 때 행마다 검사"가 UPDATE 경로의 부재까지 포함해 관측된다.
- **RMT가 합치는 것은 정렬 키가 같은 행뿐이다 — ⓐ는 머지 뒤에도 8, ⓓ만 1로 수렴한다.** ⓐ의 8행은 order_id가 서로 달라 FINAL · after_force(OPTIMIZE FINAL) 뒤에도 8 · 8 · 8이다 — 05_data_stores/10의 구조 사실 불릿(RMT는 order_no 중복을 합치지 않는다)이 실측으로 확인된다. ⓓ는 같은 order_id라 FINAL 판독과 after_force에서 3규모 × 3회 전부 1이다. MergeTree는 강제 머지 뒤에도 ⓐ 8 · ⓓ 2다 — 머지는 중복 제거 수단이 아니다.
- **RMT ⓓ의 머지 전 행 수가 반복 0에서만 1인 것은 결함이 아니라 자연 머지 시점이다 — 이 판독은 구조 판정이 아니라 참고 값이다(06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿 · 목적 적합성 W5 리드 판정 · 2026-09-27).** 카탈로그 불릿은 EXP-43 RMT 재삽입 같은 order_no 행 수의 before_merge · after_wait 판독을 머지 실행 시점에 좌우되는 값(EXP-14 · 34와 같은 성격)으로 보고 편차 폐기와 구조 판정에서 빼며, 구조 판정은 수용 건수 · FINAL · after_force 값으로만 한다고 정한다. 관측은 10^5 · 10^6 반복 0에서 before_merge와 after_wait가 1이고 나머지 반복은 2다 — 두 번째 삽입 직후 백그라운드 머지가 이미 두 파트를 합쳤는가를 재는 순간값이다. 구조 판정 값은 3회 모두 같다 — 수용 건수 2 · 2 · 2(쓰기 시점 거절 없음) · final · after_force 1 · 1 · 1. 그래서 이 기록은 3규모의 before_merge · after_wait 6행을 블록에서 structural false · reference true · median null로 싣는다 — 판독기의 구조 그리드 · 구조 집계(structural true 행만)에 들어가지 않고, 중앙값이 없어 분포 막대 · 원리 대응 값에도 오르지 않는다. 값은 "최종적 수렴은 언제 올지 앱이 모른다"의 관측으로만 쓴다.
- **FINAL 비용은 이 격자에서 보이지 않는다 — FINAL ÷ 비 FINAL 0.95 ~ 0.97.** 삽입 직후 상태에서도 FINAL이 비 FINAL보다 느리지 않았고 read_rows는 같다(채움 뒤 settle로 수렴한 테이블에 이 호출의 새 행 11개만 더해진 상태다 — 10^4의 비 FINAL read_rows 10,011 = 10,000 + 11). 그래서 이 기록은 "FINAL은 공짜"가 아니라 **"채움 뒤 수렴한 테이블 + 새 행 11개 조건에서 FINAL의 추가 비용은 계측 해상도 안"**까지만 말한다 — 머지되지 않은 버전이 쌓인 상태의 FINAL 비용은 이 조건이 재지 않았다.
- **중복 제거 윈도우 100은 재시도 모양의 중복을 버린다 — 토큰 유무와 무관하게 남은 행 1.** 비복제 MergeTree는 윈도우 > 0이면 토큰 없이도 블록 내용 해시로 같은 블록을 버린다(실행기 주석 · 05_data_stores/10 EXP-43 불릿). 두 번째 삽입은 오류 없이 돌아오므로(수용 2) 클라이언트는 버려졌는지 응답으로 알 수 없다. 이 수단이 막는 것은 "같은 내용의 재전송"뿐이고 ⓐ처럼 order_id가 다른 업무 중복은 내용 해시가 달라 막지 못한다(ⓐ는 윈도우 0 유지 — 조건).
- **왜 PostgreSQL이 업무 데이터에 맞는가(목적 ①의 이 축).** 업무 무결성(주문 번호 유일 · 존재하는 라인 · 값 범위)을 PostgreSQL은 모든 쓰기 경로에서 커밋 전에 거절해 잘못된 행이 한 번도 보이지 않게 했고, ClickHouse 기본 동작은 INSERT 경로 CHECK 3건만 거절해 나머지 잘못된 쓰기가 곧바로 조회 가능한 상태로 들어갔다(MergeTree 20시도 중 17 · RMT 14시도 중 11 수용 — PostgreSQL은 17시도 중 2). RMT · 윈도우가 주는 것은 정렬 키 · 블록 내용 단위의 **최종적** 중복 제거이지 업무 키의 쓰기 시점 보장이 아니다.

## 폐기 · 예외

- 폐기한 반복 없음 · 36호출 전부 rc 0.
- 구조 판정 — 수용 건수 81행 · 윈도우 18행 · 중복 수 42행은 3회 같은 값으로 성립. RMT ⓓ 3규모의 before_merge · after_wait 6행은 구조 판정 행이 아니라 참고 행이다(06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿 · 2026-09-27) — 그중 10^5 · 10^6의 4행이 반복 0만 1이다. 값은 그대로 싣는다(블록 structural false · reference true).
- 분포 지표 편차 최대 13.3% ≤ 20% — repeat.deviation은 분포 지표 최대 편차 0.1328이다(구조 지표는 편차 없음).
- **DuplicatedInsertedBlocks 증분이 2다 — 남은 행 1과 1:1이 아니다.** system.events 누적 합의 차라 이 호출 밖의 삽입이 같은 창에서 셌을 가능성을 원시로 가를 수 없다. 버려진 삽입 수의 판정에는 쓰지 않고 남은 행 수(1)로 판정한다.
- settle 표본의 activePatchParts는 plc 데이터베이스 세 대조 테이블 합이다 — RMT 호출의 3은 같은 반복 앞 MergeTree 호출이 work_order_control에 남긴 경량 UPDATE patch 파트다(ch_rmt는 UPDATE 경로가 없다). 판정에 쓰지 않는다.

## 정본 반영

- 05_data_stores/10 EXP 연결 표 EXP-43 "확정되는 미확인"(제약별 수용 건수 · RMT 머지 전후 중복 · FINAL 비용) — 수용 건수 표 · 중복 수 표를 이 기록 043(19f8861 · 부하 실험 · 티어 해당 없음 · 스위치 기본값)으로 올린다.
- 06_experiment_catalog EXP-43 "CHECK의 UPDATE 경로 검사 판별" — **검사하지 않는다(경량 UPDATE · ALTER UPDATE mutations_sync 1 · 26.8.10.6)**로 닫는다. 05_data_stores/03 §업무 대조 테이블 · 02_postgresql_constraints 한계 등재 표에 "ClickHouse CHECK는 INSERT 경로만"을 올릴 후보다.
- FINAL 비용은 "수렴 테이블 + 새 행 11개 조건에서 계측 해상도 안"으로만 인용한다 — 머지 전 버전이 쌓인 조건은 미확인으로 남긴다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "043",
  "exp": ["EXP-43"],
  "status": "valid",
  "supersedes": null,
  "window": {"start": "2026-09-26T20:21:19.751Z", "end": "2026-09-26T23:12:17.110Z"},
  "run": {"commitHash": "19f8861", "memoryProfile": "load", "memoryLimitMb": null, "capacityTier": "해당 없음", "memoryLimitSource": "cgroup max — oltp-lab 서비스에 compose 상한 없음"},
  "switches": {"SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on", "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"},
  "conditions": {"injectionMode": null, "observability": "off", "cpuset": "control-equalized", "controlMemoryMb": {"clickhouse": 3584, "postgres": 3584}, "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384", "toolContainer": "oltp-lab cpuset 11-12 · api-bypassed · api stopped", "seed": 42, "inProgress": 0.5, "generatorCpuMax": null, "compression": "off", "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861)", "swapUsed": null, "wslNetworking": null, "simFaultPlan": null, "stage": "S5", "scales": [10000, 100000, 1000000], "fillSnapshots": "oltp-s{scale}-19f8861", "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle)", "clickhouseVersion": "26.8.10.6", "clickhouseMaxThreads": 3, "pgVersion": "18.6", "pgServerSynchronousCommit": "on", "pgSharedBuffers": "896MB", "runnerDirty": true, "runner": "scripts/lab/s5/oltp/oltp.sh", "raw": "docs/measurements/raw/043-oltp-control-constraint.jsonl", "pgSessionSynchronousCommit": "off", "concurrentK": 8, "reinsertShape": {"postgresql": "same order_no resent (order_id is IDENTITY, not sent)", "clickhouse": "same order_id + same order_no resent"}, "dedupWindow": {"default": 0, "variant_ch_mt_dedup": 100, "restoredTo": 0}, "finalRepeat": 10, "settleMaxSec": 120, "convergeLabels": {"after_wait": "natural settle", "after_force": "OPTIMIZE TABLE ... FINAL (MergeTree and RMT)"}, "chWriteSettings": {"lwu": {"enable_lightweight_update": 1}, "alter": {"mutations_sync": 1}}, "chReadSettings": {"apply_patch_parts": 1}, "judgedMetrics": ["accepted_count.* (structural · 3 runs all)", "rows_same_order_no.* (structural · 3 runs all · except reference rows below)", "status_count_latency_p50", "status_count_read_rows"], "referenceRows": "rows_same_order_no.reinsert ch_rmt before_merge · after_wait × 3 scales (6 rows · structural false · reference true · median null) — 06_experiment_catalog EXP-29~39 bullet \"same bullet applied to reverse · grid\" 2026-09-27 · structural judgment uses accepted_count · final · after_force only", "deviationBasis": "max spread over distribution metrics (status_count_latency_p50 ch_rmt no_final 10^5 = 0.1328) · structural rows have no deviation"},
  "repeat": {"runs": 3, "deviation": 0.1328, "threshold": 0.2},
  "results": [],
  "reverse": [
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_alter_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_planned", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_status", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_lwu_target_qty", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_hash", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 10000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_token", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_hash", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 100000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_token", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "accepted_count.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_hash", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "duplicated_inserted_blocks.reinsert_token", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_hash", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_mt_dedup", "scale": 1000000, "concurrency": 1, "rate": null, "read": "window_100", "metric": "rows_same_order_no.reinsert_token", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [2, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_latency_p50", "unit": "ms", "values": [3.874, 3.932, 4.044], "median": 3.932},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_read_rows", "unit": "rows", "values": [10018, 10018, 10018], "median": 10018},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_latency_p50", "unit": "ms", "values": [4.153, 4.575, 4.117], "median": 4.153},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 10000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_read_rows", "unit": "rows", "values": [10011, 10011, 10011], "median": 10011},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_latency_p50", "unit": "ms", "values": [4.065, 4.249, 4.253], "median": 4.249},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_read_rows", "unit": "rows", "values": [100010, 100011, 100011], "median": 100011},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_latency_p50", "unit": "ms", "values": [4.603, 4.021, 4.381], "median": 4.381},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 100000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_read_rows", "unit": "rows", "values": [100010, 100011, 100011], "median": 100011},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [2, 2, 2], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_force", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "after_wait", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 2, 2], "median": null, "structural": false, "reference": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [8, 8, 8], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_latency_p50", "unit": "ms", "values": [6.231, 6.196, 5.955], "median": 6.196},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "final", "metric": "status_count_read_rows", "unit": "rows", "values": [1000010, 1000011, 1000018], "median": 1000011},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_latency_p50", "unit": "ms", "values": [6.409, 6.078, 6.861], "median": 6.409},
    {"exp": "EXP-43", "op": "constraint", "store": "clickhouse", "variant": "ch_rmt", "scale": 1000000, "concurrency": 1, "rate": null, "read": "no_final", "metric": "status_count_read_rows", "unit": "rows", "values": [1000010, 1000011, 1000011], "median": 1000011},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.check_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.dup_order_no", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.missing_line", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.reinsert", "unit": "count", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_planned", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_status", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "accepted_count.update_target_qty", "unit": "count", "values": [0, 0, 0], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.dup_order_no", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true},
    {"exp": "EXP-43", "op": "constraint", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": "before_merge", "metric": "rows_same_order_no.reinsert", "unit": "rows", "values": [1, 1, 1], "median": null, "structural": true}
  ]
}
```
