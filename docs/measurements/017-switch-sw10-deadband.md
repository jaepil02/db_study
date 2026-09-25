# 017 — SW-10 데드밴드 on/off: 신호 프로파일 8종의 전송률 · 행 수 · 압축률 (S3 · 티어 S · 모드 A)

> 실험: EXP-14 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T03:33:20Z ~ 04:49:23Z(반복 3 × 프로파일 8 × 팔 2 = 48팔 · 팔마다 워밍업 10초 뒤 60초 창)

티어 S 전 구성(설비 5 × 태그 50)을 모드 A로 띄우고, 모든 태그에 같은 신호 프로파일 하나를 건 채 SW-10만 off(PassthroughFilter) · on(TagDeadbandFilter)으로 바꿔 Collector가 내보낸 포인트 · 생략한 포인트 · tag_raw 행 수 · 파트 압축 크기를 잰다. 데드밴드는 Collector 발행 파이프라인 안에서만 돌기 때문에 모드 A 전용이다(조합 제약 #8). AC-42의 합격선은 프로파일별 off · on 쌍을 4요소와 함께 **기록**하는 것이며 목표 대비 판정이 아니다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 1 Hz · 250 pps) |
| 스위치 | SW-10=off/on · 그 외 기본값(전수는 기계 판독 블록) — 48팔 전부의 health SW-10 impl이 off PassthroughFilter · on TagDeadbandFilter다 |
| 배치 안 | A(컨슈머 3 · 창 1초 · 행 트리거 R 50,000 · 크기 트리거 P 32 MB) — 스위치 아님 |
| 주입 모드 · 시드 · 신호 프로파일 | A(api 안 레지스터 갱신 → Collector 폴링 · 제약 #8) · 42 · GEN_PROFILE 단독 8종(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT = **8**) — 팔 하나에 전 태그가 같은 프로파일 |
| 데드밴드 | 스냅샷 s3-deadband-s(s3-empty-s + seed --deadband 0.1) — 모든 태그 tag_master.deadband 0.1 공학 단위. 원본의 "0.1%"를 기저 0~100 신호 척도의 절대값으로 옮긴 값이다(deadband는 공학 단위 절대값 — 06_pipeline/02 §데드밴드) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음(모드 A 생성기는 api 프로세스 안) · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 팔마다 스냅샷 s3-deadband-s 복원 · 기준선 240초는 반복마다 첫 프로파일(SINE) 앞에서 한 번(api 없이 저장소 유휴 · docker stats) |
| 팔 순서 | 반복마다 프로파일 SINE → RANDOM_WALK → RAMP → STEP → BINARY → COUNTER → SPIKE → DROPOUT · 프로파일 안에서 off → on |
| 반복 · 편차 | 3회 · 판정 지표 최대 편차 12.8%(SPIKE on 생략분 · 기준 20%) — 압축률은 참고로 내렸다(§폐기 · 예외) |
| 스크립트 | scripts/lab/s3/exp14-rep.sh <출력> <프로파일> <반복> [창 초=60] [워밍업 초=10] [기준선 초] · apps/api/src/lab/s3-verify.ts(--phase stopped) · 원시 docs/measurements/raw/017-switch-sw10-deadband.jsonl |

팔 한 번의 절차는 아래 순서다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=s3-deadband-s
② 기동          APP_ROLE=all · GEN_PROFILE=<프로파일> · COLLECTOR_DEADBAND=off 또는 on → health 보관(SW-10 impl)
④ 워밍업        10초
⑤ 판정 창       60초 → /metrics의 points_emitted · col_deadband_skipped_total 합(창 끝)
⑥ 수집 정지     api 정상 종료 → 정지 로그의 points_emitted 누계
⑦ 정합          s3-verify(AC-01 · 02 · 05 · 07) → system.parts 활성 파트의 행 · 압축 · 비압축 바이트 · 파트 수
```

- **전송률 = 창 끝 방출 ÷ (창 끝 방출 + 창 끝 생략)이다.** 두 카운터는 기동부터 창 끝까지(워밍업 10초 + 창 60초)의 누적이다. 팔마다 기동에서 정지까지 길이가 조금 달라 행 수의 off ÷ on 비로 전송률을 대신하지 않는다.
- **압축률은 테이블 전체 활성 파트의 비압축 ÷ 압축 바이트다.** 열별(value) 크기는 수집했으나 48팔 전부 0으로 나와 쓰지 않는다(§폐기 · 예외).
- 생략분은 발행 전에 빠지므로 on 팔에서도 AC-01(Stream 포인트 = tag_raw)이 성립해야 한다 — 48팔 전부 차 0이다.

## 결과

값의 순서는 반복 1 · 2 · 3이다. 행 비 = on 행 중앙값 ÷ off 행 중앙값(참고).

| 프로파일 | off tag_raw 행 | on tag_raw 행 | on 생략분 | on 전송률 | 전송률 중앙값 | 행 비 |
|------|------|------|------|------|------|------|
| SINE | 17,600 · 17,300 · 17,600 | 13,632 · 13,718 · 13,563 | 3,968 · 3,882 · 3,987 | 77.5% · 77.9% · 77.3% | **77.5%** | 77.5% |
| RANDOM_WALK | 17,600 · 17,350 · 17,600 | 14,052 · 14,141 · 13,866 | 3,541 · 3,448 · 3,484 | 79.8% · 80.4% · 79.9% | **79.9%** | 79.8% |
| RAMP | 17,550 · 17,350 · 17,600 | 17,550 · 17,600 · 17,600 | 50 · 0 · 0 | 99.7% · 100.0% · 100.0% | **100.0%** | 100.3% |
| STEP | 17,350 · 17,550 · 17,550 | 345 · 346 · 341 | 17,255 · 16,954 · 17,209 | 2.0% · 2.0% · 1.9% | **2.0%** | 2.0% |
| BINARY | 17,300 · 17,600 · 17,500 | 663 · 692 · 697 | 16,887 · 16,608 · 16,853 | 3.8% · 4.0% · 4.0% | **4.0%** | 4.0% |
| COUNTER | 17,350 · 17,600 · 17,600 | 17,550 · 17,300 · 17,300 | 50 · 50 · 50 | 99.7% · 99.7% · 99.7% | **99.7%** | 98.3% |
| SPIKE | 17,600 · 17,600 · 17,600 | 16,605 · 16,428 · 16,350 | 994 · 1,122 · 1,000 | 94.3% · 93.6% · 94.2% | **94.2%** | 93.3% |
| DROPOUT | 17,350 · 17,300 · 17,600 | 13,119 · 13,049 · 12,827 | 4,481 · 4,543 · 4,473 | 74.5% · 74.1% · 74.1% | **74.1%** | 75.2% |

- **AC-42 성립(기록) — 8종 전부 off · on 쌍이 3회씩 기록됐다.** 전송률은 STEP 2.0% · BINARY 4.0%에서 RAMP 100.0% · COUNTER 99.7%까지 퍼진다 — 원본 예상치 폭 3~100%와 같은 폭이다.
- 원본 예상치와의 대조(판정이 아니다) — RANDOM_WALK 원본 약 85% → 실측 **79.9%** · STEP 원본 약 3% → 실측 **2.0%**(06_pipeline/02 §데드밴드).
- off 24팔의 생략분은 전부 0이다 — PassthroughFilter가 아무것도 거르지 않는다.
- COUNTER on은 3회 모두 생략분이 정확히 50 · RAMP on 반복 1도 50이다 — 태그 50 = 설비 하나의 한 사이클 분량이며, 원인은 원시로 가르지 않았다(§해석).

| 프로파일 | off 압축률(편차) | on 압축률(편차) | 압축 바이트 중앙값 off · on | 행당 압축 바이트 off · on | 활성 파트 off — on |
|------|------|------|------|------|------|
| SINE | 9.92 · 9.44 · 9.75 (4.9%) | 6.25 · 6.26 · 6.25 (0.1%) | 73,978 · 89,417 | 4.20 · 6.56 | 1 · 5 · 1 — 1 · 1 · 1 |
| RANDOM_WALK | 11.40 · 11.06 · 11.40 (3.0%) | 7.03 · 6.93 · 7.09 (2.3%) | 63,280 · 81,905 | 3.60 · 5.83 | 1 · 5 · 1 — 2 · 1 · 1 |
| RAMP | 9.85 · 9.75 · 9.98 (2.3%) | 10.02 · 9.98 · 10.07 (1.0%) | 72,941 · 71,788 | 4.16 · 4.09 | 1 · 5 · 1 — 1 · 1 · 1 |
| STEP | 64.32 · 54.78 · 64.98 (15.9%) | 3.08 · 3.79 · 3.16 (22.7%) | 11,073 · 4,431 | 0.64 · 12.99 | 1 · 1 · 1 — 5 · 3 · 5 |
| BINARY | 50.39 · 65.08 · 61.58 (23.9%) | 5.19 · 3.94 · 5.24 (25.2%) | 11,651 · 5,451 | 0.67 · 7.90 | 5 · 1 · 1 — 1 · 5 · 1 |
| COUNTER | 19.36 · 18.86 · 19.14 (2.6%) | 19.53 · 18.12 · 18.76 (7.5%) | 37,698 · 37,812 | 2.14 · 2.19 | 1 · 1 · 1 — 1 · 5 · 1 |
| SPIKE | 10.67 · 10.64 · 10.64 (0.2%) | 7.76 · 7.57 · 7.79 (2.9%) | 67,803 · 87,691 | 3.85 · 5.28 | 1 · 1 · 1 — 1 · 1 · 1 |
| DROPOUT | 9.98 · 9.89 · 10.27 (3.8%) | 6.13 · 6.12 · 6.06 (1.2%) | 71,258 · 87,372 | 4.11 · 6.70 | 5 · 5 · 1 — 1 · 1 · 5 |

- **압축률은 참고다 — 판정 지표에서 내렸다(§폐기 · 예외).** BINARY off · on · STEP on의 편차가 20%를 넘고, 그 반복들은 측정 시점의 활성 파트 수(1 · 3 · 5)가 다르다.
- 48팔 전부 AC-01 차 0 · AC-02 중복 조합 0 · AC-07 불일치 0 · AC-05 불일치 합 0 · 정지 뒤 lag · pending 0이다.
- 기준선(반복마다 1회) — clickhouse CPU 3.97 · 4.46 · 3.97% · 메모리 648.8~674.3 MiB · postgres 약 52.6 MiB · redis 약 11.5 MiB.

## 해석

- **데드밴드가 줄이는 것은 행 수이고, 줄어드는 몫은 신호 모양이 정한다.** 주기마다 0.1 이상 변하는 RAMP · COUNTER는 거의 전부 보내고(99.7~100%), 값이 대부분의 주기에 그대로인 STEP · BINARY는 전이 순간만 보낸다(2.0 · 4.0%). SINE(77.5%) · RANDOM_WALK(79.9%) · DROPOUT(74.1%)은 주기당 변화가 0.1보다 작은 주기가 생략된 몫이다 — 06_pipeline/02의 "데드밴드는 코덱이 아니라 행 수를 바꾼다"가 실측으로 확인된다.
- **DROPOUT의 on 전송률은 결측이 아니라 멈춘 값을 거른 몫이다.** 모드 A에서 DROPOUT은 레지스터에 직전 값을 남기므로 off 팔 행 수(17,350 · 17,300 · 17,600)가 다른 프로파일과 같다 — 결측이 행 생략으로 드러나지 않는다(GEN-02의 행 생략은 모드 B · C · D의 표현). on에서는 멈춘 값이 변화량 0이라 데드밴드가 생략하고, 그 결과 모드 A DROPOUT의 결측이 데드밴드 생략과 구별되지 않는다. 이 기록의 DROPOUT 수치는 결측 표현의 실측이 아니다.
- **압축률은 on에서 오히려 낮아지지만 원인은 이 기록에서 확인되지 않았다.** 행당 압축 바이트가 SINE 4.20 → 6.56 · STEP 0.64 → 12.99로 커진다. 가능한 기전은 두 가지다 — ① 행이 빠지면 ts 간격이 불규칙해져 Delta 계열 코덱의 이득이 준다 ② 행 수가 작을수록 파트 고정 비용(마크 · 인덱스 · 열 헤더)의 비중이 커진다. STEP · BINARY on은 파트 하나가 수 KB라 ②가 지배할 수 있다. 열별 크기가 0으로 수집돼(§폐기 · 예외) 둘을 가를 수 없고, 재측정 때 가른다.
- **COUNTER · RAMP on의 생략분 50은 설비 한 대의 한 사이클이다.** 매 주기 0.1 이상 변하는 신호에서 태그 50이 한꺼번에 생략되려면 한 사이클 동안 설비 하나의 값이 모두 멈춰야 한다. 후보는 셋이다 — ① 기동 직후 첫 비교 ② 레지스터 갱신과 폴링의 위상 겹침 ③ 모드 A 격자 갱신 전에 폴링이 같은 k의 레지스터를 두 번 읽은 사이클(설비 하나 50태그가 전부 무변화). 원시에 사이클별 기록이 없어 가르지 않고 미확인으로 둔다.
- 한계 — 한 팔에 전 태그가 같은 프로파일이다. 실제 설비의 프로파일 혼합에서 전송률은 이 표의 가중 평균이 되며, 그 가중치는 이 기록에 없다. 데드밴드 0.1은 이 실험의 조건 값이고 태그별 조정값(2계층)이 아니다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음 · 창에서 뺀 구간은 워밍업 10초다(전송률 카운터는 기동부터 누적이라 워밍업을 포함한다 — 방출 · 생략이 같은 구간을 세므로 비는 성립한다).
- **압축률을 판정 지표에서 참고로 내렸다(리드 판정).** 카탈로그 EXP-14 판정 지표에 압축률이 있지만, BINARY off 23.9% · BINARY on 25.2% · STEP on 22.7%로 편차 기준 20%를 넘는다. 이 셋은 압축 바이트가 4~14 KB이고 측정 시점의 활성 파트가 반복마다 1 · 3 · 5로 달라, 파트 병합 진행이 값을 흔든다 — 신호의 효과가 아니라 병합 시점을 잰다. 다만 파트 수가 1 · 1 · 1로 같은 STEP off도 15.9%로 흔들려 파트 수만이 원인이라고 단정하지 않는다(압축 바이트 11,059 · 13,135 · 11,073 — 수 KB대의 작은 파트 자체가 흔들린다). 압축률을 판정 지표로 두면 세 반복 전부 폐기여야 하고, 그 폐기는 이 실험이 재려는 전송률 · 행 수의 안정(최대 5.6%)과 무관한 이유가 된다. 재측정 조건은 둘이다 — ① 파트 1개 수렴 또는 OPTIMIZE FINAL 뒤에 잰다 ② min_bytes_for_wide_part 0으로 Wide 파트를 강제해 열별 크기를 얻는다(아래 불릿). 기록 012가 p95를 참고로 내린 선례와 같은 판정이다.
- **value 열 압축 크기가 48팔 전부 0이다.** system.parts_columns의 열별 바이트는 Compact 파트에서 0으로 나온다 — 이 실험의 파트는 전부 min_bytes_for_wide_part 아래라 Compact다. 러너가 수집은 했으나 값이 없어 해석에 쓰지 않았다.
- **RAMP on 생략분은 편차를 정의할 수 없다.** 값이 50 · 0 · 0이라 중앙값 0이다 — 전송률(99.7 · 100.0 · 100.0% · 편차 0.3%)로 판정한다. COUNTER on 생략분 50 · 50 · 50은 편차 0이다.
- **팔 순서를 교대하지 않았다.** 프로파일 안에서 늘 off → on이다. 팔마다 스냅샷을 복원하므로 순서 효과가 누적되지 않는다.
- **기준선이 현행 참고 5분보다 짧고 반복마다 한 번이다.** 도구 호출 한 번이 10분을 넘지 않게 240초로 줄였고, 프로파일 단위로 호출을 나눠 첫 프로파일 앞에서만 쟀다.
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. exp14-rep.sh의 fdc7849 대비 차이는 파일 모드 100644 → 100755뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 06_pipeline/02 §데드밴드 — 원본 전송률 표(RANDOM_WALK 약 85% · STEP 약 3%) 옆에 실측 8종 전송률(기록 017 · fdc7849 · 부하 실험 · S · SW-10 off/on · 모드 A · deadband 0.1)을 올린다. 원본 예상치 칸은 지우지 않는다.
- 02_features/13 SW-10 예상 행 · 03_requirements/14 AC-42 — 기록 017 인용.
- 미확인으로 남기는 것 — 데드밴드 on의 압축률 변화 원인(열별 크기 재측정) · 모드 A DROPOUT의 결측 표현(데드밴드 생략과 구별 불가).

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "017",
  "exp": ["EXP-14"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T03:33:20.000Z", "end": "2026-09-25T04:49:23.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": ["off", "on"], "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S3", "tierConfig": "device5-tag50-250pps", "signalProfiles": ["SINE", "RANDOM_WALK", "RAMP", "STEP", "BINARY", "COUNTER", "SPIKE", "DROPOUT"], "signalProfilePerArm": "single-profile-all-tags", "deadband": 0.1, "deadbandUnit": "engineering-absolute", "snapshot": "s3-deadband-s", "batchPlan": "A", "consumers": 3, "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "baselineS": 240, "baselinePerRep": 1, "warmupS": 10, "windowS": 60, "transferRate": "emitted/(emitted+skipped) at window end", "compressionRatio": "reference-only (part merge state)" },
  "repeat": { "runs": 3, "deviation": 0.128, "threshold": 0.2 },
  "results": [
    {"metric": "transfer_rate_SINE", "arm": "on", "unit": "ratio", "values": [0.7745, 0.7794, 0.7728], "median": 0.7745},
    {"metric": "tag_raw_rows_SINE", "arm": "off", "unit": "rows", "values": [17600, 17300, 17600], "median": 17600},
    {"metric": "tag_raw_rows_SINE", "arm": "on", "unit": "rows", "values": [13632, 13718, 13563], "median": 13632},
    {"metric": "deadband_skipped_SINE", "arm": "on", "unit": "points", "values": [3968, 3882, 3987], "median": 3968},
    {"metric": "transfer_rate_RANDOM_WALK", "arm": "on", "unit": "ratio", "values": [0.7982, 0.8035, 0.7992], "median": 0.7992},
    {"metric": "tag_raw_rows_RANDOM_WALK", "arm": "off", "unit": "rows", "values": [17600, 17350, 17600], "median": 17600},
    {"metric": "tag_raw_rows_RANDOM_WALK", "arm": "on", "unit": "rows", "values": [14052, 14141, 13866], "median": 14052},
    {"metric": "deadband_skipped_RANDOM_WALK", "arm": "on", "unit": "points", "values": [3541, 3448, 3484], "median": 3484},
    {"metric": "transfer_rate_RAMP", "arm": "on", "unit": "ratio", "values": [0.9972, 1.0, 1.0], "median": 1.0},
    {"metric": "tag_raw_rows_RAMP", "arm": "off", "unit": "rows", "values": [17550, 17350, 17600], "median": 17550},
    {"metric": "tag_raw_rows_RAMP", "arm": "on", "unit": "rows", "values": [17550, 17600, 17600], "median": 17600},
    {"metric": "deadband_skipped_RAMP", "arm": "on", "unit": "points", "values": [50, 0, 0], "median": 0},
    {"metric": "transfer_rate_STEP", "arm": "on", "unit": "ratio", "values": [0.0196, 0.02, 0.0194], "median": 0.0196},
    {"metric": "tag_raw_rows_STEP", "arm": "off", "unit": "rows", "values": [17350, 17550, 17550], "median": 17550},
    {"metric": "tag_raw_rows_STEP", "arm": "on", "unit": "rows", "values": [345, 346, 341], "median": 345},
    {"metric": "deadband_skipped_STEP", "arm": "on", "unit": "points", "values": [17255, 16954, 17209], "median": 17209},
    {"metric": "transfer_rate_BINARY", "arm": "on", "unit": "ratio", "values": [0.0378, 0.04, 0.0397], "median": 0.0397},
    {"metric": "tag_raw_rows_BINARY", "arm": "off", "unit": "rows", "values": [17300, 17600, 17500], "median": 17500},
    {"metric": "tag_raw_rows_BINARY", "arm": "on", "unit": "rows", "values": [663, 692, 697], "median": 692},
    {"metric": "deadband_skipped_BINARY", "arm": "on", "unit": "points", "values": [16887, 16608, 16853], "median": 16853},
    {"metric": "transfer_rate_COUNTER", "arm": "on", "unit": "ratio", "values": [0.9972, 0.9971, 0.9971], "median": 0.9971},
    {"metric": "tag_raw_rows_COUNTER", "arm": "off", "unit": "rows", "values": [17350, 17600, 17600], "median": 17600},
    {"metric": "tag_raw_rows_COUNTER", "arm": "on", "unit": "rows", "values": [17550, 17300, 17300], "median": 17300},
    {"metric": "deadband_skipped_COUNTER", "arm": "on", "unit": "points", "values": [50, 50, 50], "median": 50},
    {"metric": "transfer_rate_SPIKE", "arm": "on", "unit": "ratio", "values": [0.9434, 0.9361, 0.9424], "median": 0.9424},
    {"metric": "tag_raw_rows_SPIKE", "arm": "off", "unit": "rows", "values": [17600, 17600, 17600], "median": 17600},
    {"metric": "tag_raw_rows_SPIKE", "arm": "on", "unit": "rows", "values": [16605, 16428, 16350], "median": 16428},
    {"metric": "deadband_skipped_SPIKE", "arm": "on", "unit": "points", "values": [994, 1122, 1000], "median": 1000},
    {"metric": "transfer_rate_DROPOUT", "arm": "on", "unit": "ratio", "values": [0.7454, 0.7411, 0.7414], "median": 0.7414},
    {"metric": "tag_raw_rows_DROPOUT", "arm": "off", "unit": "rows", "values": [17350, 17300, 17600], "median": 17350},
    {"metric": "tag_raw_rows_DROPOUT", "arm": "on", "unit": "rows", "values": [13119, 13049, 12827], "median": 13049},
    {"metric": "deadband_skipped_DROPOUT", "arm": "on", "unit": "points", "values": [4481, 4543, 4473], "median": 4481},
    {"metric": "compression_ratio_SINE", "arm": "off-reference", "unit": "ratio", "values": [9.918, 9.439, 9.754], "median": 9.754},
    {"metric": "compression_ratio_SINE", "arm": "on-reference", "unit": "ratio", "values": [6.251, 6.256, 6.248], "median": 6.251},
    {"metric": "compression_ratio_RANDOM_WALK", "arm": "off-reference", "unit": "ratio", "values": [11.403, 11.064, 11.404], "median": 11.403},
    {"metric": "compression_ratio_RANDOM_WALK", "arm": "on-reference", "unit": "ratio", "values": [7.034, 6.926, 7.09], "median": 7.034},
    {"metric": "compression_ratio_RAMP", "arm": "off-reference", "unit": "ratio", "values": [9.848, 9.752, 9.976], "median": 9.848},
    {"metric": "compression_ratio_RAMP", "arm": "on-reference", "unit": "ratio", "values": [10.023, 9.975, 10.074], "median": 10.023},
    {"metric": "compression_ratio_STEP", "arm": "off-reference", "unit": "ratio", "values": [64.323, 54.781, 64.982], "median": 64.323},
    {"metric": "compression_ratio_STEP", "arm": "on-reference", "unit": "ratio", "values": [3.076, 3.793, 3.155], "median": 3.155},
    {"metric": "compression_ratio_BINARY", "arm": "off-reference", "unit": "ratio", "values": [50.391, 65.079, 61.583], "median": 61.583},
    {"metric": "compression_ratio_BINARY", "arm": "on-reference", "unit": "ratio", "values": [5.193, 3.935, 5.243], "median": 5.193},
    {"metric": "compression_ratio_COUNTER", "arm": "off-reference", "unit": "ratio", "values": [19.357, 18.862, 19.142], "median": 19.142},
    {"metric": "compression_ratio_COUNTER", "arm": "on-reference", "unit": "ratio", "values": [19.529, 18.12, 18.759], "median": 18.759},
    {"metric": "compression_ratio_SPIKE", "arm": "off-reference", "unit": "ratio", "values": [10.668, 10.643, 10.642], "median": 10.643},
    {"metric": "compression_ratio_SPIKE", "arm": "on-reference", "unit": "ratio", "values": [7.764, 7.566, 7.792], "median": 7.764},
    {"metric": "compression_ratio_DROPOUT", "arm": "off-reference", "unit": "ratio", "values": [9.983, 9.891, 10.27], "median": 9.983},
    {"metric": "compression_ratio_DROPOUT", "arm": "on-reference", "unit": "ratio", "values": [6.131, 6.123, 6.057], "median": 6.123}
  ]
}
```
