# 020 — 적재 배치 세 안(A · B · C) 파트 생성률 · E2E와 티어 S 정상 상태 랙 (S3 · 모드 B)

> 실험: EXP-34 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T05:36:39Z ~ 06:50:05Z(팔 4 × 반복 3 = 12회 · 팔마다 발행 120초 + 랙 0 대기)

배치 트리거 세 안(ADR-09)을 같은 부하로 비교하고, 티어 S에서 컨슈머 그룹 랙이 정상 상태로 유지되는지를 본다. 팔은 넷이다 — lag-S(티어 S · 안 A · AC-19)와 A · B · C(티어 M 설비 50 × 태그 200 · 10,000 pps · AC-22). 안은 스위치가 아니라 조건 칸의 조정값(INGEST_BATCH_PLAN)이다. AC-22의 합격선은 세 안의 파트 생성률 · E2E를 4요소와 함께 **기록**하는 것이고, AC-19는 그룹 lag 0 유지 · pending 유계 · 정지 뒤 0 복귀의 구조 판정이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | lag-S 팔 S(설비 5 × 태그 50 · 250 pps) · A · B · C 팔 M(설비 50 × 태그 200 · 10,000 pps) — health run.capacityTier가 팔마다 S · M이다 |
| 스위치 | 전부 기본값 · SW-09 off 고정(조합 제약 #4) — 12회 전부 health switches가 같다(전수는 기계 판독 블록) |
| 배치 안(조건 칸 · 스위치 아님) | A — 컨슈머 3 · 창 1초 · 동기 삽입 · B — 컨슈머 1 · 창 5초 · 동기 삽입 · C — 컨슈머 3 · 창 1초 · async_insert 1 · wait_for_async_insert 1. 세 안 모두 행 트리거 R 50,000 · 크기 트리거 P 32 MB |
| 주입 모드 · 시드 · 혼합 | B(datagen 컨테이너가 Stream에 직접 XADD · --mix mixed --seed 42 --duration 120) · 42 · mixed |
| api 역할 | APP_ROLE=worker(적재만 — Collector 없음) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 모드 B 워커 사용률 S 0.04% · M 0.47~0.53%(발행 결과 workerUtilization) · 늦은 틱 12회 전부 0 · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 반복마다 스냅샷 복원 — lag-S s3-empty-s · A · B · C s3-empty-m(fdc7849 이미지로 빈 볼륨에서 migrate + seed) · 기준선 240초(api 없이 저장소 유휴 · docker stats) — 현행 참고 5분보다 짧다(§폐기 · 예외) |
| 팔 순서 | 반복마다 lag-S → A → B → C |
| 반복 · 편차 | 3회 · AC-22 판정 지표(파트 생성률 · E2E p50 · p95 · p99 · 삽입 소요 p50) 최대 편차 4.0%(B 파트 생성률 · 기준 20%) · AC-19는 구조 판정 · 활성 파트 · pending 최대는 §폐기 · 예외 |
| 스크립트 | scripts/lab/s3/exp34-rep.sh <출력> <lag-S · A · B · C> <반복> [발행 초=120] [기준선 초] · apps/api/src/lab/s3-verify.ts(--phase stopped) · 원시 docs/measurements/raw/020-ingest-batch-strategies.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s3-empty-s 또는 s3-empty-m
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=worker · INGEST_BATCH_PLAN=A · B · C · CAPACITY_TIER=S · M → health 보관
④ 발행          모드 B 120초 — 발행과 같은 시간 동안 1초마다 ing_group_lag · ing_group_pending 표본(120개)
⑥ 회복          consumer_lag 0까지 대기(드레인 초 기록) → docker stats 1회 → api 정상 종료
⑦ 정합          part_log NewPart(삽입발 파트 수 · 행) · 활성 파트 · query_log 삽입(수 · 소요 p50 · p95) · s3-verify(AC-01 · 02 · E2E)
```

- **파트 생성률 = 삽입발 NewPart 수 × 60 ÷ 발행 초다.** 병합이 만든 파트(MergeParts)는 세지 않는다.
- **E2E는 기록 SQL의 정확 분위수다**(quantilesExact(ingested_at − ts) · 발행 창 고정).
- **query_log written_rows는 행 수 비교에 쓰지 않는다.** 동기 삽입은 MV 3개가 롤업에 쓴 행을 포함하고, 안 C(async)의 삽입 쿼리는 원시 행만 잡힌다.

## 결과

### 배치 세 안 — 티어 M · AC-22

값의 순서는 반복 1 · 2 · 3이다.

| 안 | 삽입발 파트(120초) | 파트 생성률(분당) | 삽입 쿼리 · 소요 p50 · p95(ms) | E2E p50(ms) | E2E p95(ms) | E2E p99(ms) | 활성 파트(드레인 뒤) | lag 최대 · pending 최대 |
|------|------|------|------|------|------|------|------|------|
| A | 120 · 120 · 120 | **60** · 60 · 60 | 120 · 43 · 45 / 120 · 42 · 45 / 120 · 43 · 45 | 1,026 · 1,027 · 1,025 | 1,033 · 1,034 · 1,034 | 1,039 · 1,038 · 1,042 | 3 · 3 · 3 | 0 · 100 / 0 · 50 / 0 · 50 |
| B | 25 · 24 · 25 | **12.5** · 12.0 · 12.5 | 25 · 60 · 71 / 24 · 59 · 67 / 25 · 59 · 66 | 3,051 · 3,051 · 3,053 | 5,053 · 5,057 · 5,055 | 5,061 · 5,064 · 5,065 | 4 · 3 · 4 | 49 · 300 / 49 · 300 / 49 · 300 |
| C | 120 · 120 · 120 | **60** · 60 · 60 | 120 · 42 · 46 / 120 · 43 · 47 / 120 · 43 · 46 | 1,026 · 1,027 · 1,027 | 1,036 · 1,036 · 1,038 | 1,079 · 1,087 · 1,087 | 3 · 3 · 3 | 0 · 50 / 0 · 50 / 0 · 50 |

| 안 | 파트 생성률 중앙값 | E2E p50 · p95 · p99 중앙값(ms) | 삽입 소요 p50 중앙값(ms) | 편차 최대(판정 지표) |
|------|------|------|------|------|
| A | **60/분** | **1,026** · 1,034 · 1,039 | 43 | 2.3%(삽입 소요 p50) |
| B | **12.5/분** | **3,051** · 5,055 · 5,064 | 59 | 4.0%(파트 생성률) |
| C | **60/분** | **1,027** · 1,036 · 1,087 | 43 | 2.3%(삽입 소요 p50) |

- **AC-22 성립(기록) — 세 안의 파트 생성률 · E2E가 3회씩 4요소와 함께 기록됐다.**
- 12회 전부 AC-01 차 0(티어 M 1,200,000 = 10,000 pps × 120초 · 티어 S 30,000) · AC-02 중복 조합 0 · 정지 뒤 lag · pending 0 · 드레인 10~11초다.
- 삽입발 파트 수 = 삽입 쿼리 수(A · C 120 · B 24~25) — 삽입 한 번이 파트 하나를 만든다. B의 25 = 120초 ÷ 창 5초 = 24 + 경계 1이다.
- query_log written_rows(참고) — A 4,800,000 = 1,200,000 × 4 · B 1,950,000 · 1,920,000 · 1,950,000 · C 1,200,000. B가 4배가 아닌 것은 MV가 삽입 블록 안에서 먼저 집계해 쓰기 때문이다 — 창 5초 블록(원시 50,000행)은 1분 버킷에서 태그 10,000개 × 롤업 3 = 30,000행만 더한다(24 × (50,000 + 30,000) = **1,920,000**). A는 창 1초 블록(10,000행)마다 태그 10,000개 × 3 = 30,000행이 더해져 4배가 된다.

### 티어 S 정상 상태 랙 — lag-S 팔 · AC-19

| 반복 | 판정 창(UTC) | 1초 표본 | 그룹 lag 최대 · 0 아닌 표본 | pending 최대 · 분포 | 정지 뒤 lag · pending | 판정 |
|------|------|------|------|------|------|------|
| 1 | 05:36:39 ~ 05:38:50 | 120 | **0** · 0 | 5 · 5가 114표본 · 0이 6표본 | **0** · **0** | 성립 |
| 2 | 06:02:39 ~ 06:04:51 | 120 | **0** · 0 | 10 · 5가 113 · 10이 1 · 0이 6 | **0** · **0** | 성립 |
| 3 | 06:28:32 ~ 06:30:44 | 120 | **2** · 3 | 10 · 5가 94 · 10이 17 · 8이 3 · 0이 6 | **0** · **0** | 성립(리드 판정 — 누적 없음) |

- **반복 3의 lag 0 아닌 표본 3개는 lag 2 · pending 8이고, 합 consumer_lag가 앞뒤 표본(lag 0 · pending 10)과 같은 10이다.** 표본 epoch 1790317761 · 1790317762 · 1790317764(발행 시작 약 46~49초)이며 그 사이 표본(1790317763)은 lag 0으로 돌아왔다. 미확인 적체가 늘지 않은 채 엔트리 2개가 "배달 전"에 있다가 곧 배달된 모양이다.
- **반복 3은 문자 그대로의 "lag 0 유지"와 다르다 — lag 2가 연속 2표본(epoch 1790317761 · 1790317762)과 1표본(1790317764)에 잡혔다.** 리드 판정으로 AC-19 성립으로 읽는다 — lag가 한 발행 묶음(엔트리 5) 이하의 순간값이고 lag + pending이 10으로 늘지 않았으며 다음 표본에 0으로 돌아와 누적이 없다. 순간값과 누적을 가르는 문턱(몇 표본 · 몇 엔트리)은 3계층 미확인이고 이 기록이 정하지 않는다(10_observability/01 §컨슈머 랙 판정). pending 최대 10은 in-flight 2배치 분량(창 2개 × 초당 엔트리 5 = 10 · 리드 판정) 안이고, 정지 뒤 복귀는 3회 모두 성립했다.
- lag-S 팔의 파트 생성률 60/분 · 삽입 소요 p50 12 ms · E2E p50 1,016 · 1,016 · 1,015 ms(참고 — 이 팔의 판정은 AC-19다).
- 참고 — lag-S E2E p99 1,025 · 1,316 · 1,022 ms(편차 28.7%). 반복 2의 1,316 ms 한 값이 튀었다 — 이 팔의 판정 지표가 아니라 편차 폐기에 넣지 않았다(§폐기 · 예외).

## 해석

- **파트 생성률이 컨슈머 수와 무관하다 — ADR-09 A안의 예상과 일치한다.** 컨슈머 3의 A · C도, 컨슈머 1의 B도 창 하나에 파트 하나다(A · C 60/분 = 창 1초 · B 12.5/분 ≈ 창 5초). 원본 산술의 "독립 플러시 시 파트 생성률 3배"(A에서 180/분)가 나오지 않았다. 단일 flusher가 창마다 한 번 삽입하는 fan-in 구조(06_pipeline/03)가 그대로 드러난다.
- **B는 파트 생성률을 창 길이에 비례해 줄이고 E2E를 그만큼 늘린다.** 창 5초는 파트를 1/5(12.5/분)로 줄이지만 E2E p50이 3,051 ms · p95가 5,055 ms로 창 1초 안(약 1,026 · 1,034 ms)의 약 3배 · 5배다 — 엔트리가 창 5초 안에 고르게 들어오면 평균 대기가 창 절반(2.5초) + 유예가 되고 꼬리가 창 길이가 된다. B의 pending이 50씩 올라 300까지 가는 톱니(창 5초 × 초당 엔트리 50 + in-flight 1창)와 lag 49(한 초 분량 엔트리가 배달 전)가 같은 구조다. 삽입 소요는 행 5배에 43 → 59 ms로 1.4배다.
- **C는 A와 파트 생성률 · E2E가 같다 — 비동기 삽입이 삽입을 묶지 않았다.** flusher가 창마다 삽입을 한 번만 보내고 wait_for_async_insert 1로 플러시를 기다리므로 비동기 버퍼에 두 삽입이 함께 머무는 순간이 없다. 결과가 삽입 1회 = 파트 1개로 A와 같다. C는 삽입 설정만 바꿔 적재 코드 경로가 같다 — 카탈로그의 "C가 적재 코드 경로를 바꾸면 스위치 신설 대상" 조건에 걸리지 않는다는 근거다. E2E p99만 C가 약 45 ms 크다(1,079~1,087 · A 1,038~1,042 ms).
- **AC-19의 반복 3은 "배달 전 엔트리"가 표본 순간에 잡힌 것으로 보인다.** 모드 B는 1초마다 설비 5개의 엔트리를 파이프라인 한 번으로 XADD한다. 표본이 그 묶음 도착과 컨슈머의 XREADGROUP 사이에 떨어지면 lag가 묶음 크기(≤ 설비 수 5) 안에서 0이 아니게 잡힐 수 있다. lag + pending 합이 10으로 변하지 않은 것이 누적 적체가 아니라는 근거다. 다만 원시로 XADD · XREADGROUP 시각을 대조하지 않았으므로 원인을 단정하지 않는다. 기록 015의 모드 A 9회(1초 표본 180 × 6 + 215 × 3 = **1,725**개)에서는 lag가 0이 아닌 표본이 하나도 없었다 — Collector는 설비별로 위상을 흩어 발행해 한 순간에 도착하는 엔트리가 1개다.
- **E2E가 기록 015(모드 A 약 930 ms)와 이 기록(모드 B 약 1,016~1,027 ms)에서 다른 것은 ts가 정해지는 시점의 구조 차이로 설명된다.** 모드 B의 ts는 그 초 격자의 틱 시각이고 모든 설비의 엔트리가 같은 순간에 도착해 창 1초 닫힘(유예 100 ms)까지 거의 한 창을 기다린다 — 안 A의 p50 · p95 · p99가 1,025~1,042 ms 폭에 몰린다. 모드 A는 설비별 폴링 위상이 창 안에 퍼져 있어 대기가 설비마다 다르다(기록 012의 오프셋 해석과 같은 구조). 기록 015가 넘긴 질문(S2 608 ms → S3 약 930 ms)은 이 기록으로 닫히지 않는다 — 이 기록에는 모드 A 팔도, 컨슈머 1 · 창 1초 팔도 없어 컨슈머 수의 효과를 가를 수 없다.
- 한계 — 티어 M의 세 안은 lag 표본이 1초 간격이라 B의 톱니 모양만 보인다. 창 닫힘 유예 경로 비율(카탈로그 판정 지표)은 원시에 없다(§폐기 · 예외).

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음(리드 판정). **lag-S 반복 3의 그룹 lag 2(표본 3개)는 문자 그대로의 "0 유지"와 다르다** — 누적 없음으로 성립시켰고, 판정 문턱을 이 사례에 맞춰 사후에 만들지 않았다(문턱은 3계층 미확인).
- **활성 파트 수와 pending 최대는 편차 폐기에 넣지 않았다.** 둘 다 카탈로그 EXP-34 판정 지표 열에 있으나 작은 정수의 순간값이다 — 활성 파트는 드레인 뒤 병합 진행 시점을 재고(B 4 · 3 · 4 = 편차 25%), pending 최대는 표본이 창 경계에 걸렸는지를 잰다(A 100 · 50 · 50 · lag-S 5 · 10 · 10). pending은 AC-19의 "유계" 구조 판정으로만 쓰고 활성 파트는 참고로 적는다.
- **lag-S 팔의 E2E는 편차 폐기에 넣지 않았다.** 이 팔의 판정은 AC-19이고 E2E 판정 지표(AC-22)는 티어 M의 세 안이 갖는다 — lag-S p99 편차 28.7%는 반복 2의 한 값(1,316 ms)이다.
- **창 닫힘 유예 경로 비율을 수집하지 않았다.** 카탈로그 EXP-34 판정 지표 열에 있으나 러너가 이 계수를 남기지 않았다 — 카탈로그의 "확정되는 미확인" 중 창 닫힘 유예는 이 기록으로 정하지 않는다.
- **기준선이 현행 참고 5분보다 짧다.** 도구 호출 한 번이 10분을 넘지 않게 240초로 줄였다. 기준선은 유휴 바닥을 보는 칸이고 판정 값에 닿지 않는다.
- **모드 B 발행 결과의 run.memoryLimitMb가 null이다.** datagen 컨테이너의 health 복사값이며 기계 판독 블록 run은 api health에서 옮겼다. SW-10 impl이 null인 것은 APP_ROLE=worker라 Collector 모듈이 없기 때문이다(value는 off).
- **기계 판독 블록 run.capacityTier는 M이다.** AC-22 판정 팔(A · B · C)의 티어이며, lag-S 팔의 티어 S는 conditions.armTier에 적는다.
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. exp34-rep.sh의 fdc7849 대비 차이는 파일 모드 100644 → 100755뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 04_architecture/09 ADR-09 · 06_pipeline/03 — 파트 생성률이 컨슈머 수와 무관(A 60/분 = 창당 1 · 기록 020 · fdc7849 · 부하 실험 · M · 스위치 기본값 · 모드 B)을 실측 확인으로 올리고, B · C 비교(B 12.5/분 · E2E p50 3,051 ms · C = A)를 버린 대안의 실측으로 적는다.
- 03_requirements/14 AC-22 — 기록 020 인용. 01_overview/05 S3 합격 판정 ⑥.
- 10_observability/06 EXP-34 — "C가 코드 경로를 바꾸면 스위치 신설 대상" 조건에 대해 C는 삽입 설정만 바꾼다는 확인(기록 020)을 적는다.
- 01_overview/05 S3 합격 판정 ② AC-19 — 기록 015(모드 A 9회)와 이 기록의 lag-S 3회를 인용한다. 10_observability/01 §컨슈머 랙 판정의 "0 유지는 누적이 없다는 뜻" 불릿이 이 기록을 이미 인용한다 — 03_requirements/14 AC-19 문구도 같은 해석(순간값 허용 · 누적 없음 · 문턱은 3계층 미확인)을 가리키도록 맞춘다.
- 10_observability/06 EXP-34 판정 지표 열 — 활성 파트 · pending 상한을 판정 지표에서 참고 · 구조 판정으로 옮기는 문구 보정을 제안한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "020",
  "exp": ["EXP-34"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T05:36:39.000Z", "end": "2026-09-25T06:50:05.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "B", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S3", "modeBMix": "mixed", "publishS": 120, "appRole": "worker", "arms": ["lag-S", "A", "B", "C"], "armTier": { "lag-S": "S", "A": "M", "B": "M", "C": "M" }, "tierConfig": { "S": "device5-tag50-250pps", "M": "device50-tag200-10000pps" }, "batchPlan": { "lag-S": "A", "A": "consumers3-window1s-sync", "B": "consumers1-window5s-sync", "C": "consumers3-window1s-async_insert1-wait1" }, "snapshot": { "lag-S": "s3-empty-s", "A": "s3-empty-m", "B": "s3-empty-m", "C": "s3-empty-m" }, "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "baselineS": 240, "lagSampleS": 1 },
  "repeat": { "runs": 3, "deviation": 0.04, "threshold": 0.2 },
  "results": [
    { "metric": "parts_per_minute", "arm": "A", "unit": "parts/min", "values": [60, 60, 60], "median": 60 },
    { "metric": "parts_per_minute", "arm": "B", "unit": "parts/min", "values": [12.5, 12.0, 12.5], "median": 12.5 },
    { "metric": "parts_per_minute", "arm": "C", "unit": "parts/min", "values": [60, 60, 60], "median": 60 },
    { "metric": "e2e_p50_ms", "arm": "A", "unit": "ms", "values": [1026, 1027, 1025], "median": 1026 },
    { "metric": "e2e_p50_ms", "arm": "B", "unit": "ms", "values": [3051, 3051, 3053], "median": 3051 },
    { "metric": "e2e_p50_ms", "arm": "C", "unit": "ms", "values": [1026, 1027, 1027], "median": 1027 },
    { "metric": "e2e_p95_ms", "arm": "A", "unit": "ms", "values": [1033, 1034, 1034], "median": 1034 },
    { "metric": "e2e_p95_ms", "arm": "B", "unit": "ms", "values": [5053, 5057, 5055], "median": 5055 },
    { "metric": "e2e_p95_ms", "arm": "C", "unit": "ms", "values": [1036, 1036, 1038], "median": 1036 },
    { "metric": "e2e_p99_ms", "arm": "A", "unit": "ms", "values": [1039, 1038, 1042], "median": 1039 },
    { "metric": "e2e_p99_ms", "arm": "B", "unit": "ms", "values": [5061, 5064, 5065], "median": 5064 },
    { "metric": "e2e_p99_ms", "arm": "C", "unit": "ms", "values": [1079, 1087, 1087], "median": 1087 },
    { "metric": "insert_p50_ms", "arm": "A", "unit": "ms", "values": [43, 42, 43], "median": 43 },
    { "metric": "insert_p50_ms", "arm": "B", "unit": "ms", "values": [60, 59, 59], "median": 59 },
    { "metric": "insert_p50_ms", "arm": "C", "unit": "ms", "values": [42, 43, 43], "median": 43 },
    { "metric": "active_parts_reference", "arm": "A", "unit": "parts", "values": [3, 3, 3], "median": 3 },
    { "metric": "active_parts_reference", "arm": "B", "unit": "parts", "values": [4, 3, 4], "median": 4 },
    { "metric": "active_parts_reference", "arm": "C", "unit": "parts", "values": [3, 3, 3], "median": 3 },
    { "metric": "group_lag_max", "arm": "B", "unit": "entries", "values": [49, 49, 49], "median": 49 },
    { "metric": "pending_max", "arm": "B", "unit": "entries", "values": [300, 300, 300], "median": 300 },
    { "metric": "ac01_diff", "arm": "A", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_diff", "arm": "B", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_diff", "arm": "C", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_group_lag_max", "arm": "lag-S", "unit": "entries", "values": [0, 0, 2], "median": 0 },
    { "metric": "ac19_group_lag_nonzero_samples", "arm": "lag-S", "unit": "samples", "values": [0, 0, 3], "median": 0 },
    { "metric": "ac19_pending_max", "arm": "lag-S", "unit": "entries", "values": [5, 10, 10], "median": 10 },
    { "metric": "ac19_consumer_lag_after_stop", "arm": "lag-S", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_lag_zero_literal", "arm": "lag-S", "unit": "bool", "values": [1, 1, 0], "median": 1 },
    { "metric": "ac19_pass", "arm": "lag-S", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "e2e_p50_ms_reference", "arm": "lag-S", "unit": "ms", "values": [1016, 1016, 1015], "median": 1016 }
  ]
}
```
