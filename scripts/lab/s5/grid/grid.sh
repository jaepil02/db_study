#!/usr/bin/env bash
# EXP-01~05 대조군 역전 지점 격자 러너(control-stage-{k}) — 하위 명령 하나 = 호출 하나(10분 미만 · 도구 상한 600초)
# 기록 번호: 쓰는 시점의 다음 번호(docs/measurements 최대 + 1)를 단계 순서대로 — 1차(035~039)는 폐기 · 러너에 번호를 박지 않는다
# 전제: 폐기 뒤 재측정은 새 GRID_DIR(새 기록)로 한다 — Q5 문턱 · device/tag · 편차 판정 기준(judgmentBasis) · 채움 스냅샷 이름이
#       GRID_DIR 상태에 묶여 있어 같은 GRID_DIR를 다시 쓰면 앞 격자의 값이 새 기록에 섞인다
# 정본: docs/05_data_stores/10_olap_vs_rdb_control.md §역전 지점 탐색 설계 단계 절차 ①~⑥ · 정밀화(L316) · docs/10_observability/06_experiment_catalog.md EXP-01~05
# 전제: 대조 자원 조건(task up CONTROL=1 — clickhouse 5-7 · 3.5 GB · postgres 8-10 · 3.5 GB) · api 정지 · 빈 tag_raw · 빈 대조군
# 상태 · 원시 출력: GRID_DIR(기본 snapshots/lab-s5-grid-f — 격자 2차)/state.json · grid.jsonl(OUT로 바꾼다) · 1차 snapshots/lab-s5-grid는 읽지 않는다
#
# 격자 2차 = 미래 방향(시간 순) 누적: 시작 S 고정 · 점 p의 데이터 [S, S + D_p) · 쿼리 {end} = S + D_p
#   S 규칙(init 기본) = UTC 자정(일 파티션 경계 · ADR-27) − 50020초 — S ≡ 20초(mod 60)라 4 · 5단계 end가 분 경계 · 5단계가 자정 앞뒤로 반씩 · S + 10^5 ≤ 지금
#   머리 만료 = S + 7일 — 격자 · 스냅샷 · 정밀화 전부가 이 안에 끝나야 한다(budget의 remainingSec)
# 정밀화 = 적응형 로그 이분 2회 — 교차 구간 (10^(j+4), 10^(j+5)]에서 m1 = 10^(j+4.5)행(rj+4.5 · stage j.5)을 재고,
#   역전이 든 반쪽의 로그 중점 m2 = lower 10^(j+4.25) · upper 10^(j+4.75)를 잰다. 반쪽 판정은 리드(쿼리 · 변형 · 캐시마다 다를 수 있다 — 둘 다면 upper 먼저).
#   D 반올림: D* = 10^(e−4)초 ≤ 1시간이면 가장 가까운 정수 초 · 넘으면 end가 분 경계인 가장 가까운 초(오차 ≤ 30초)
#
# 사용: scripts/lab/s5/grid/grid.sh <하위 명령> [인자]   (<점> = 단계 1~5 또는 정밀화 점 r5.5 · r8.25 …)
#   plan [START_ISO]                       점 구간 · 조각 · UTC 일별 행(저장소 접속 없음 · 상태가 있으면 그 S)
#   plan-refine <j> [lower|upper] [START_ISO]   정밀화 점 하나의 D · 행 · end · 채우기 구간 · 절차(저장소 접속 없음)
#   init [--start ISO] [--seed 42] [--mix mixed]   S 고정 · 자원 조건 · 빈 테이블 확인(1차 상태 파일은 읽지 않는다)
#   budget <점>                            점 진입 전 디스크 예산 식 · 적재 시간 예산(머리 S 기준 남은 시간)
#   fill <점> [next|조각번호]              모드 D + GEN-10 한 조각 — 조각 하나 = 호출 하나(여러 조각을 한 셸 호출에 묶지 않는다)
#                                          4단계 3조각 · 5단계 25조각 · 정밀화 ≤ 3600초 조각 — 추정 > 540초면 거부(FILL_CHUNK_SEC)
#   check <점>                             구간 count 정합(tag_raw = 대조군 = countMerge(tag_1m)) · [S, end) 밖 0 · 조각 사슬이 창을 덮음
#   params                                 1단계 check 직후 1회 — Q5 문턱 quantileExact(0.5) · Q1~Q3 device · tag 고정
#   settle <점> [최대 초] [간격 초]        안정화(CH 활성 파트 3표본 불변 · 머지 0 / PG autovacuum 유휴 · 삽입 기준 대기 0 / 체크포인트 경과)
#   axes <점>                              비 쿼리 축 1 · 2 · 3 · 5 · 6(axis 줄)
#   query <점> <clickhouse|postgresql> <-|I1|I2> <반복> <Q1..Q5|Q5x> [cold,warm,explain,capture]
#                                          대표값 values · median = 클라이언트 ms · server = CH query_log µs · PG pg_stat_statements 증가분 µs(함께 기록)
#                                          judgmentSpread{basis, value} — 점(점 · 쿼리 · 캐시)의 CH client 중앙값 < 10 ms(양자화)면 두 저장소 모두 server로 편차 판정
#                                          basis는 그 점의 첫 CH 줄에서 정한다 → 같은 점은 clickhouse를 postgresql보다 먼저 잰다(아니면 거부)
#                                          같은 점 · 반복의 두 저장소 줄이 모이면 kind pair — tieWithinResolution(CH client < 10 ms · 차 < 1 ms) · 두 server 중앙값
#                                          conditions.serverTimeAsymmetry(PG 계획 제외 · CH 파싱 포함) · 정밀화 점은 fillChain · chunkBounds · restoredFrom
#   match <점> <Q>                         두 저장소 결과 집합 대조(count 정확 · avg 상계식 · Q4 tag_1m 대조)
#   i2-build <점> [예산 초=480]            btree(device_id, tag_id, ts) 파티션별 빌드 — 10^8행 이하 동기(끝날 때까지 다시 부른다)
#                                          10^8행 초과(5단계 · 10^8~10^9 정밀화 점)는 비동기 — 첫 파티션을 postgres 컨테이너 안 psql(docker exec -d)로 띄우고 돌아온다
#   i2-build-poll <점> [최대 대기 초=480] [간격=15]   비동기 — 상태 파일(/tmp/i2build/<파티션>.start·end·rc)을 읽어 ATTACH · 다음 파티션 시작
#   i2-drop <점>
#   snapshot <k> [--volume v | --finish | --abort]   단계 k(1~4) 끝의 채움 스냅샷(i2-drop 뒤 · 다음 fill 전) — 이름 {GRID_DIR 이름}-s{k}
#                                          단계 k+1 fill은 이 스냅샷이 없으면 거부(FORCE=1 우회)
#                                          추정 ≤ 540초면 task snapshot 한 호출 · 넘으면 첫 호출이 정지 · manifest → 볼륨마다 --volume v 한 호출(마지막이 재기동)
#   restore <k> [--volume v | --finish | --abort]    단계 k 스냅샷 복원 → 행 수 · 구간 밖 0 확인 → 테이블 상태 = k(정밀화 m1 · m2 lower 앞) — 볼륨별 경로 같음
#                                          snapshot · restore가 진행 중이거나 도중에 멈추면(volumeOp) snapshot · restore · status · plan 외 하위 명령을 거부한다
#                                          --finish = 볼륨은 다 끝났고 재기동 · 기록 · 확인만 다시 · --abort = 스냅샷은 부분 디렉터리 삭제 · 복원은 tableAt 비움 → 재기동 · 해제
#   refill <점>                            복원 뒤(테이블 = base) 그 점을 다시 채우기 전 — 앞 채움(조각 · 계수기 · firstAt · 편차 기준 · 결과 파일)을 보관 · 초기화(kind refill-reset)
#                                          단계 점도 — base k−1 스냅샷 필요(옛 snapshots[k]는 NAME.refill-n으로) · 1단계는 두 저장소 0행 확인(빈 스냅샷 task restore 뒤)
#                                          점 무효(조각 실패 · 불일치) 뒤 길: restore k−1 → refill k → fill k next
#   refine <j> [lower|upper]               정밀화 점 등록(m1은 인자 없이 · m2는 m1 측정 뒤) — 다음 명령을 안내한다
#   status
#
# 재측정 절차(격자 2차): init → [단계 k = 1..5: budget k → fill k next(조각마다 한 번) → check k → (k=1: params) → settle k → axes k
#   → query … × (Q1~Q5 · Q5x) × (CH - · PG I1) × 반복 1~3 → i2-build/-poll k → query … PG I2 → i2-drop k → (k ≤ 4: snapshot k)]
#   → 교차 구간 j마다: restore j → refine j → [m1 점 절차] → 리드 반쪽 판정 → refine j upper → [절차] → (lower도 필요하면) restore j → refine j lower → [절차]
# shellcheck source=../../s3/_lib.sh
source "$(dirname "$0")/../../s3/_lib.sh"
GCOMPOSE="$COMPOSE -f infra/compose/compose.control.yml"
export GCOMPOSE
case "${1:-}" in
  # 모드 D는 커밋과 같은 이미지(db_study-api:HASH)의 datagen-d 컨테이너(app_owner 비밀이 실리는 모드 D 전용 서비스)에서 돈다 — 다른 하위 명령은 저장소 CLI만 쓴다
  fill) require_clean ;;
  *) : ;;
esac
exec python3 scripts/lab/s5/grid/grid.py "$@"
