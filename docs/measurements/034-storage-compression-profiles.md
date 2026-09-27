# 034 — 신호 프로파일별 압축 · 행당 크기: 혼합 · 8 프로파일 개별의 tag_raw · tag_1m 디스크 크기 (S5 · 티어 M 1시간 · 모드 D)

> 실험: EXP-35 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-27T00:00:00Z ~ 01:00:00Z(모드 D 데이터 구간 ts · KST 09:00~10:00 · 한 KST 일 안) · 실행 2026-09-27 10:09~10:21 KST(호출 끝 기록 시각 2026-09-27T01:10:12Z ~ 01:21:20Z · 9팔 × 3반복 = 27호출)

M 티어 시드(설비 50 × 태그 200 = 태그 10,000)에 모드 D로 1시간 구간(1 Hz · 36,000,000행)을 과거 ts로 적재하고, 파트를 하나로 합친 뒤 tag_raw · tag_1m의 디스크 크기를 잰다. 팔은 혼합(mixed) 1 + 신호 프로파일 개별 8(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) = **9**이며, 개별 팔은 전 태그가 같은 프로파일이다. SW-10은 off다 — 데드밴드가 켜지면 압축이 아니라 행 감축이 섞인다(조합 제약 #5 · REQ-NFR-14). AC-45의 합격선은 RANDOM_WALK와 혼합의 압축률이 **기록**되고 용량 판단에 보수적인 쪽을 쓰는 것이며 목표 대비 판정이 아니다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(모드 D 실행기 보고 run.commitHash · require_clean 통과 — apps/api · packages · infra/clickhouse · infra/postgres 미커밋 변경 없음) |
| 카탈로그 조건 대조 | 10_observability/06 EXP-35 행 조건 칸 "부하 · M 행 수 · SW-10 off · 모드 D · RANDOM_WALK · 혼합 · 8 프로파일 개별" — 전부 이 실행의 조건과 같다 |
| 저장소 자원 | ClickHouse cpuset 5-8 · 5 GiB(5,368,709,120 B) · PostgreSQL cpuset 9-10 · 2 GiB — 러너가 호출마다 확인(부하 실험 프로파일 · 대조 자원 조건 아님) |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · run.memoryLimitMb null · run.memoryLimitSource "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)". 모드 D는 api 컨테이너를 내리고 도구 컨테이너 datagen-d에서 돈다 — 04 §조건 칸(2026-09-27 조항)에 따라 이 null은 상한이 없다는 사실값이고 memoryLimitSource와 함께 4요소 충족이다 |
| 용량 티어 | M(run.capacityTier M — datagen-d CAPACITY_TIER=M · 실행 인자 --tier M · 스냅샷 s7a-seed-m 설비 50 × 태그 200) · 1시간 = 태그 10,000 × 3,600초 = 36,000,000행 |
| 스위치 | SW-09=off · SW-10=off · 그 외 기본값(전수는 기계 판독 블록) — 27호출 전부 모드 D 보고 run · switches가 같다 |
| 주입 모드 · 시드 · 신호 프로파일 | D(과거 ts 백필 · ClickHouse만 --control off · 롤업 --rollup on) · 42 · 혼합 = 태그별 배정 STEP 40% · SINE 40% · RANDOM_WALK 20%(apps/api/src/modules/datagen/signal/assignment.ts 배정 비율 — 실제 태그 수는 해시가 정하고 원시에 없다) · 개별 8 = 전 태그 단독 |
| 초기 상태 | 호출마다 스냅샷 s7a-seed-m 복원(티어 M 시드 · tag_raw 0행 — 러너가 복원 뒤 0행 확인) |
| 수렴 | OPTIMIZE TABLE plc.tag_raw FINAL · plc.tag_1m FINAL → 파티션당 활성 파트 1 · 머지 0 확인 뒤 측정(수렴 3.6~4.9초 · 27호출 전부 파트 1 · 파티션 1 · Wide) |
| 관측 스택 · 생성기 CPU · CPU 배치 | off(compose.yml + compose.load.yml) · 재지 않음(모드 D는 생성 · 적재가 한 호출) · 표준 |
| 압축 · swap · 네트워킹 · SIM 계획 | 열 코덱(아래 DDL) · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 기준선 | 없음 — 부하가 아니라 적재 뒤 정지 상태의 디스크 크기를 재는 실험이다 |
| 팔 순서 | 반복마다 mixed → SINE → RANDOM_WALK → RAMP → STEP → BINARY → COUNTER → SPIKE → DROPOUT |
| 반복 · 편차 | 3회 · 판정 지표(압축률 · 원시 행당 · 롤업 행당 바이트) 최대 편차 **0%** — 9팔 전부 세 반복의 행 · 바이트 · 열별 크기가 바이트 단위까지 같다 |
| 스크립트 | scripts/lab/s5/grid/exp35.sh <팔> <반복> 3600 s7a-seed-m · scripts/lab/s5/grid/grid.py exp35 · 원시 docs/measurements/raw/034-storage-compression-profiles.jsonl(27행) |

적재 대상 DDL의 열 · 코덱이다(infra/clickhouse/ddl/002_tag_raw.sql · 004_tag_1m.sql).

| 테이블 | 정렬 키 · 파티션 | 열 · 코덱 |
|------|------|------|
| tag_raw | ORDER BY (device_id, tag_id, ts) · toYYYYMMDD(ts) | ts DateTime64(3) Delta(8) + ZSTD(1) · device_id UInt32 Delta(4) + ZSTD(1) · tag_id UInt32 Delta(4) + ZSTD(1) · value Float64 Gorilla + ZSTD(1) · quality UInt8 ZSTD(1) · scan_seq UInt64 Delta(8) + ZSTD(1) · ingested_at DateTime64(3) Delta(8) + ZSTD(1) — 폭 합 8 + 4 + 4 + 8 + 1 + 8 + 8 = **41 B** |
| tag_1m | ORDER BY (device_id, tag_id, bucket) · toYYYYMM(bucket) · AggregatingMergeTree | bucket Delta(4) + ZSTD(1) · device_id · tag_id · 집계 상태 7(cnt · avg_v · min_v · max_v · last_v argMax · p95_v quantilesTDigest(0.95) · bad_cnt) — 코덱 지정 없음(서버 기본) |

호출 한 번의 절차는 아래 순서다.

```plain
① 복원      api 컨테이너 제거 → task restore NAME=s7a-seed-m → tag_raw 0행 확인
② 모드 D    datagen-d(CAPACITY_TIER=M) mode-d.js --tier M --seed 42 --from 00:00Z --to 01:00Z --control off --rollup on [--mix mixed | --profile <이름>]
③ 정합      일별 count 대조(tag_raw 행 = 생성 행 − 결측 · 롤업 원천 행 = tag_raw 행) → 불일치면 중단
④ 수렴      OPTIMIZE FINAL(tag_raw · tag_1m) → 파티션당 활성 파트 1 · 머지 0까지 5초 간격 확인(240초 상한)
⑤ 측정      system.parts 활성 파트(행 · bytes_on_disk · 압축 · 비압축) · system.parts_columns 열별 크기 · tag_1m 행 · bytes_on_disk
```

- **압축률 = 행 × 41 B ÷ bytes_on_disk다(공통 논리 크기 기준 — 05_data_stores/10 비교 축 2).** 이 기록에서는 data_uncompressed_bytes가 9팔 전부 정확히 행 × 41 B라 REQ-NFR-14의 분모(data_uncompressed_bytes)와 공통 논리 크기가 같은 값이다. 분모를 data_compressed_bytes로 바꾸면 값이 0.03~0.62% 커진다(mixed 9.16 그대로 · STEP 124.44 → 125.22 · BINARY 114.95 → 115.60) — 둘의 차는 마크 · 기본 인덱스 등 파트 부속 72,425~95,661 B이고, 전체가 작은 STEP · BINARY에서만 몫이 0.5%를 넘는다.
- **롤업 행당 바이트는 두 뜻을 다 싣는다.** bytesPerRollupRow = tag_1m bytes_on_disk ÷ tag_1m 행 · bytesPerRawRow = tag_1m bytes_on_disk ÷ tag_raw 행(원시 행당 환산). 원본 산정 "롤업 약 9 B"는 07_capacity_planning §정상 상태 디스크에서 **M 1분 롤업 12.96억 행이 12 GB이므로 행당 약 9바이트**로 도출한 값이라 롤업 행당(bytesPerRollupRow) 뜻이다 — 그 뜻으로 대조한다.
- **파트 1개 수렴 뒤에만 잰다.** 기록 017(EXP-14)이 압축률을 참고로 내린 원인(측정 시점 활성 파트 1~5 · Compact 파트라 열별 크기 0 — 06 카탈로그 순간값 · 양자화 불릿)을 이 러너는 ④로 막았다 — 27호출 전부 활성 파트 1 · Wide라 열별 크기가 채워졌다.

## 결과

9팔 전부 세 반복 값이 같아 반복 1 · 2 · 3을 한 값으로 적는다(원시 27행 전부 대조 — 행 · bytes_on_disk · 열별 압축 · 비압축 · tag_1m 행 · 바이트가 반복끼리 같다). 굵은 값이 판정 지표다.

| 팔 | tag_raw 행 | tag_raw bytes_on_disk | 압축률 | 원시 행당 B | tag_1m bytes_on_disk | 롤업 행당 B | 롤업 원시 행당 환산 B |
|------|------|------|------|------|------|------|------|
| mixed | 36,000,000 | 161,144,967 | **9.16** | **4.476** | 125,537,237 | **209.2** | 3.487 |
| SINE | 36,000,000 | 264,350,985 | **5.58** | **7.343** | 203,437,344 | **339.1** | 5.651 |
| RANDOM_WALK | 36,000,000 | 258,971,686 | **5.70** | **7.194** | 202,161,358 | **336.9** | 5.616 |
| RAMP | 36,000,000 | 147,381,667 | **10.01** | **4.094** | 40,649,500 | **67.7** | 1.129 |
| STEP | 36,000,000 | 11,860,905 | **124.44** | **0.329** | 10,210,626 | **17.0** | 0.284 |
| BINARY | 36,000,000 | 12,840,918 | **114.95** | **0.357** | 10,044,206 | **16.7** | 0.279 |
| COUNTER | 36,000,000 | 61,888,100 | **23.85** | **1.719** | 172,793,977 | **288.0** | 4.800 |
| SPIKE | 36,000,000 | 261,377,223 | **5.65** | **7.260** | 195,172,433 | **325.3** | 5.421 |
| DROPOUT | 34,020,073 | 257,772,619 | **5.41** | **7.577** | 194,196,076 | **323.7** | 5.708 |

- 검산: 팔 = 혼합 1 + 개별 8 = **9** · 호출 = 9 × 3 = **27**
- **AC-45 성립(기록) — RANDOM_WALK 5.70 · 혼합 9.16이 3회씩 기록됐다.** 둘 중 보수적인 쪽은 RANDOM_WALK다(원시 행당 7.194 B · 혼합 4.476 B의 1.61배).
- DROPOUT 행 34,020,073 = 생성 36,000,000 − 결측 1,979,927(5.50%)이며 3회 모두 같다. 압축률 분자도 이 행 수 × 41 B다. 생성 슬롯(36,000,000) 기준 행당 바이트는 7.160 B다(참고).
- tag_1m 행은 9팔 전부 600,000 = 태그 10,000 × 60분이다 — DROPOUT도 모든 태그 · 분에 행이 하나 이상 남았다.
- 27호출 전부 모드 D 일별 대조 일치(match true) · 롤업 원천 행 = tag_raw 행 · 파트 1 · 파티션 1 · 머지 0이다.

tag_raw 열별 압축 바이트다. 괄호는 원시 행당 바이트(열 압축 ÷ tag_raw 행)이고, 마지막 열은 value가 열 압축 합에서 차지하는 몫이다.

| 팔 | device_id | tag_id | ts | quality | ingested_at | scan_seq | value | value 몫 |
|------|------|------|------|------|------|------|------|------|
| mixed | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 150,445,013 (4.1790) | 93.4% |
| SINE | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 253,649,972 (7.0458) | 96.0% |
| RANDOM_WALK | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 248,270,709 (6.8964) | 95.9% |
| RAMP | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 136,681,942 (3.7967) | 92.8% |
| STEP | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 1,166,596 (0.0324) | 9.9% |
| BINARY | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 2,147,410 (0.0597) | 16.8% |
| COUNTER | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 51,190,061 (1.4219) | 82.8% |
| SPIKE | 149,708 (0.0042) | 197,638 (0.0055) | 442,990 (0.0123) | 24,749 (0.0007) | 320,835 (0.0089) | 9,485,163 (0.2635) | 250,676,208 (6.9632) | 95.9% |
| DROPOUT | 141,480 (0.0042) | 191,115 (0.0056) | 4,979,340 (0.1464) | 23,399 (0.0007) | 303,169 (0.0089) | 11,955,272 (0.3514) | 240,083,183 (7.0571) | 93.2% |

- 검산(mixed): 열 합 149,708 + 197,638 + 442,990 + 24,749 + 320,835 + 9,485,163 + 150,445,013 = **161,066,096** = data_compressed_bytes 일치
- **value를 뺀 여섯 열은 DROPOUT을 뺀 8팔에서 바이트 단위까지 같다** — 합 10,621,083 B(원시 행당 0.2950 B). 열 크기가 신호와 무관하게 행 수 · 정렬 · 코덱으로만 정해진다.
- 정렬 키 · 품질 네 열(device_id · tag_id · ts · quality)의 합은 815,085 B = 원시 행당 **0.0226 B**다(mixed 열 압축 합의 0.51%).

mixed 팔의 열별 비압축 폭 대비 압축 배수다(열 비압축 ÷ 열 압축).

| 열 | 비압축 폭 | 압축 배수 | 열 압축 합 대비 |
|------|------|------|------|
| device_id | 4 B | 961.9 | 0.09% |
| tag_id | 4 B | 728.6 | 0.12% |
| ts | 8 B | 650.1 | 0.28% |
| quality | 1 B | 1,454.6 | 0.02% |
| ingested_at | 8 B | 897.7 | 0.20% |
| scan_seq | 8 B | 30.4 | 5.89% |
| value | 8 B | 1.9 | 93.41% |

- 검산: 폭 4 + 4 + 8 + 1 + 8 + 8 + 8 = **41 B** · 몫 합 0.09 + 0.12 + 0.28 + 0.02 + 0.20 + 5.89 + 93.41 = **100.01%**(반올림)
- value 열 압축 배수는 프로파일마다 크게 갈린다 — STEP 246.9 · BINARY 134.1 · COUNTER 5.6 · RAMP 2.1 · mixed 1.9 · RANDOM_WALK 1.16 · SPIKE 1.15 · SINE 1.14 · DROPOUT 1.13.

원본 산정 · 원본 예상치와의 대조다(판정이 아니다 — 원본 예상치는 목표가 아니고 목표 대비 판정은 정본 반영 뒤다).

| 대상 | 원본 | 실측(이 기록) | 비 |
|------|------|------|------|
| 원시 행당(07_capacity_planning) | 4 B · 프로파일에 따라 2~8 B | mixed 4.476 · RANDOM_WALK 7.194 · 범위 0.329(STEP) ~ 7.577(DROPOUT) | mixed 1.12배 · RANDOM_WALK 1.80배 |
| 롤업 행당(07_capacity_planning) | 약 9 B | mixed 209.2 · RANDOM_WALK 336.9 · 범위 16.7(BINARY) ~ 339.1(SINE) | mixed 23.2배 · RANDOM_WALK 37.4배 · 최소 BINARY 1.9배 |
| 압축률 STEP · BINARY · COUNTER(REQ-NFR-14) | 20~50배 | 124.44 · 114.95 · 23.85 | STEP · BINARY는 범위 위 · COUNTER는 범위 안 |
| 압축률 SINE(REQ-NFR-14) | 5~12배 | 5.58 | 범위 안(하단) |
| 압축률 RANDOM_WALK(REQ-NFR-14) | 2~4배 | 5.70 | 범위 위 |
| 압축률 혼합(REQ-NFR-14) | 8~15배 | 9.16 | 범위 안 |

- 검산: 대조 = **6**

## 해석

- **가설 판정 — "RANDOM_WALK의 압축률이 혼합보다 낮다"는 성립한다(5.70 < 9.16 · 3회 전부).** 다만 REQ-NFR-14가 RANDOM_WALK를 "최악의 경우"로 둔 전제는 이 기록에서 성립하지 않는다 — SINE 5.58 · SPIKE 5.65 · DROPOUT 5.41이 더 낮고, 원시 행당으로 SINE은 RANDOM_WALK보다 2.1% · SPIKE 0.9% · DROPOUT 5.3% 크다. 네 프로파일은 원시 행당 7.19~7.58 B의 5% 폭 안에 모여 있어, 보수적인 쪽을 쓰는 규칙은 두 조건(혼합 · RANDOM_WALK) 중에서는 RANDOM_WALK를 고르지만 8종 전체의 최대는 아니다.
- **디스크를 정하는 것은 value 한 열이다 — 열 단위 저장 + 정렬 + 코덱의 결과다.** 한 행의 공통 논리 크기 41 B 중 value를 뺀 33 B가 0.2950 B로(112배) 줄고, value 8 B는 mixed에서 4.179 B로(1.9배) 준다. 그래서 mixed 압축 바이트의 93.4%가 value다. ClickHouse는 열마다 따로 파일을 두고 ORDER BY (device_id, tag_id, ts)로 정렬해 저장하므로, 한 파트 안에서 device_id는 같은 값이 설비당 720,000행(태그 200 × 3,600초) · tag_id는 태그당 3,600행씩 이어지고 ts는 태그 안에서 1초 간격으로 오른다. Delta(4) · Delta(8)이 이 열들을 0 또는 같은 차분의 반복으로 바꾸고 ZSTD(1)가 그 반복을 접어 device_id 961.9배 · tag_id 728.6배 · ts 650.1배 · quality 1,454.6배가 된다(quality 값 분포는 원시로 확인하지 않았다) — 정렬 키 · 품질 네 열이 원시 행당 0.0226 B다. 이 네 열의 바이트가 value가 다른 8팔에서 바이트 단위까지 같다는 것이 크기가 신호가 아니라 정렬 · 코덱에서 나온다는 증거다. PLC 데이터는 행 수가 태그 수 × 주기로 불어나지만 불어나는 몫의 대부분이 이 식별 · 시각 열이라, 열 단위 정렬 저장에서는 mixed · 고엔트로피 프로파일에서 행 수 증가가 거의 value 열 증가로만 남는다(STEP · BINARY는 scan_seq가 value보다 크다 — 아래 "평탄한 신호" 불릿).
- **value 열의 압축은 연속 값의 변화가 정한다.** Gorilla는 같은 태그의 이웃 값을 XOR해 바뀐 비트만 남긴다 — STEP(대부분 주기에 같은 값)은 XOR가 0이라 246.9배 · BINARY 134.1배이고, 매 주기 가수 비트가 바뀌는 SINE · RANDOM_WALK · SPIKE · DROPOUT은 1.13~1.16배로 Float64 8 B가 거의 그대로 남는다. RAMP(2.1배) · COUNTER(5.6배)는 그 사이다. 압축률 표의 124.44배 ~ 5.41배 폭은 이 value 한 열의 폭이다.
- **평탄한 신호에서는 value가 아니라 보조 열이 바닥을 정한다.** STEP · BINARY는 value가 원시 행당 0.032 · 0.060 B까지 줄어, scan_seq(0.2635 B)가 열 압축 합의 80.5% · 74.3%를 차지한다. scan_seq는 Delta(8) + ZSTD(1)인데도 30.4배로 다른 비값 열(650~1,455배)보다 훨씬 덜 줄며, 모드 D가 scan_seq를 어떤 모양으로 만드는지는 이 기록이 확인하지 않았다 — STEP · BINARY 압축률의 상한이 scan_seq 모양에 묶인다는 것까지만 원시로 말할 수 있다.
- **결측은 ts를 깨뜨린다.** DROPOUT은 행이 5.50% 빠지자 ts 열이 원시 행당 0.0123 → 0.1464 B(11.9배) · scan_seq 0.2635 → 0.3514 B로 커졌다 — 일정하던 1초 차분에 틈이 끼어 Delta 뒤 반복이 끊긴다. 그래서 행이 줄었는데도 생존 행당 바이트(7.577 B)는 네 고엔트로피 프로파일 중 가장 크다.
- **롤업은 원본 산정 9 B의 23~37배다(mixed · RANDOM_WALK 기준 · 9팔 전체는 1.9~37.7배).** tag_1m 행당 mixed 209.2 B · RANDOM_WALK 336.9 B이고, 원시 행당으로 환산하면 mixed 3.487 B로 원시 tag_raw(4.476 B)의 77.9%다 — 1 Hz 원시 60행을 1행으로 줄여도 디스크는 원시의 4분의 3이 남는다. COUNTER는 롤업(4.800 B)이 원시(1.719 B)의 279.2%로 원시보다 크고, RAMP는 27.6%다. 집계 상태 7열 중 어느 열이 이 크기를 만드는지는 tag_1m 열별 크기를 수집하지 않아 가르지 않는다(§정본 반영 — 러너 보강) — 후보는 분위수 요약 상태(p95_v quantilesTDigest)로, 07_capacity_planning이 "롤업 칸이 가장 크게 어긋날 수 있다"고 적은 그 자리다.
- **혼합은 구성 프로파일의 가중 합에 가깝다.** 배정 비율(STEP 40 · SINE 40 · RANDOM_WALK 20 — 코드 값)로 개별 팔 원시 행당을 가중하면 0.4 × 0.329 + 0.4 × 7.343 + 0.2 × 7.194 = 4.508 B로 실측 4.476 B와 0.7% 차이다. 열 단위 저장에서 태그끼리 코덱 이득을 나누지 않기 때문으로 읽히지만, 실제 태그별 배정 수는 원시에 없어 근사다.
- **용량 산정에 옮기면(단순 곱 — 판정이 아니다).** 보수적인 쪽 RANDOM_WALK 7.194 B로 M 일 원시 8.64억 행 ≈ 6.2 GB(원본 산정 약 3.5 GB) · 원시 7일 ≈ 43.5 GB(원본 25 GB)다. 1분 롤업 90일 12.96억 행은 mixed 209.2 B로 ≈ 271 GB · RANDOM_WALK 336.9 B로 ≈ 437 GB(원본 12 GB)라 M 여유 디스크 200 GB를 넘는다. 일 · 7일 · 90일 값 모두 1시간 한 파트의 행당 값을 그대로 곱한 값이며, 하루 · 90일 규모 파트의 압축은 재지 않았다.
- **한계 — 세 반복이 같은 것은 재현성 확인이지 분포가 아니다.** seed 42와 구간(00:00Z~01:00Z)이 같아 세 반복의 입력이 결정적으로 같고, 그래서 편차가 0이다. 다른 seed · 다른 구간에 대한 분포는 이 기록에 없다. 그 밖의 한계 — ① M의 1시간(태그당 3,600행 · 파티션 하나에 36,000,000행)이며 하루 파티션(24배 행)의 압축은 재지 않았다 ② 모드 D의 ingested_at은 적재 시각(DEFAULT now64 · 적재 4.1~6.1초)이라 실시간 적재의 ingested_at 모양과 다르다 — ingested_at 0.0089 B는 모드 D 값이다 ③ Wide 파트는 크기로 자연히 됐고 강제하지 않았다 ④ 기록 017(EXP-14 · 티어 S · 모드 A · 60초 · Compact · 비압축 ÷ 압축 기준)의 압축률 참고값과는 규모 · 파트 형식 · 분모가 달라 비교하지 않는다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음(27호출 전부 일별 대조 일치 · 파트 1 수렴) · 창에서 뺀 구간 없음.
- **1차 실행(같은 절차 · 다른 구간 · 4요소 미충족)은 커밋 전이라 정정 기록 없이 이 원시로 대체했다.**
- **B형 — memoryLimitMb null은 4요소 누락이 아니다.** 결론 — 04 §조건 칸(2026-09-27 조항)에 따라 도구 컨테이너 경로의 null은 상한이 없다는 사실값이고, 블록 run이 memoryLimitSource를 함께 싣기 때문에 판독기는 4요소 충족으로 본다. 반대 시나리오 — ClickHouse 상한(5,120 MB) 같은 다른 값으로 채우면 저장소 컨테이너의 상한이 측정 프로세스의 상한으로 잘못 기록된다. 파생 지침 — 저장소 자원은 조건 칸과 conditions.storeResources가 싣고 run에는 원시 값을 그대로 둔다.
- **편차 0은 폐기 판정을 비워 두는 값이 아니다.** 판정 지표 세 값이 전부 같아 편차가 0이고 기준 20% 안이다. 참고 지표(모드 D 적재 4.14~6.12초 · 롤업 4.86~6.10초 · 수렴 3.6~4.9초)는 반복마다 흔들리지만(최대 편차 적재 SPIKE 18.9% · 롤업 mixed 13.7%) 이 실험의 판정 지표가 아니다.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 04_architecture/07_capacity_planning.md §미확인 · 미설계 등재 "압축 후 행당 크기 · 롤업 행 크기" — 원본 산정 4 B · 약 9 B 옆에 실측(원시 mixed 4.476 · RANDOM_WALK 7.194 B · 롤업 행당 mixed 209.2 · RANDOM_WALK 336.9 B)을 올린다. 원본 산정 칸은 지우지 않는다. §정상 상태 디스크의 "롤업 칸은 가장 크게 어긋날 수 있다" 불릿에 어긋난 크기(mixed · RANDOM_WALK 기준 23~37배 · 9팔 전체 1.9~37.7배)를 인용한다.
- 03_requirements/13_nonfunctional.md REQ-NFR-14 — 원본 예상치 옆에 9팔 압축률을 올린다. "최악의 경우(RANDOM_WALK)" 문구는 이 기록과 어긋난다(SINE · SPIKE · DROPOUT이 더 낮다) — 두 조건 규칙을 유지할지 최대 프로파일로 바꿀지는 리드 판정이다.
- 03_requirements/14_acceptance_criteria.md AC-45 — 기록 인용.
- 러너 보강(정본 문서가 아니라 scripts) — tag_1m 열별 크기(system.parts_columns) 수집.
- 미확인으로 남기는 것 — 롤업 크기의 열별 원인 · 90일 파트 규모의 롤업 행당 크기 · 하루 파티션 규모의 원시 행당 크기 · 모드 D scan_seq 모양이 STEP · BINARY 바닥에 주는 영향.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "034",
  "exp": ["EXP-35"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-27T00:00:00.000Z", "end": "2026-09-27T01:00:00.000Z" },
  "run": {"commitHash": "5492c73", "memoryProfile": "load", "memoryLimitMb": null, "capacityTier": "M", "memoryLimitSource": "cgroup max — datagen-d 서비스에 compose 메모리 상한 없음(readMemoryLimitMb: memory.max = max → null)"},
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "D", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "column-codecs", "swapUsed": null, "wslNetworking": null, "simFaultPlan": null, "stage": "S5", "generatorTierArg": "M", "tierConfig": "device50-tag200-1hz-3600s", "snapshot": "s7a-seed-m", "control": "off", "rollup": "on", "storeResources": "clickhouse=5-8/5368709120 postgres=9-10/2147483648", "signalProfiles": ["mixed", "SINE", "RANDOM_WALK", "RAMP", "STEP", "BINARY", "COUNTER", "SPIKE", "DROPOUT"], "signalProfilePerArm": "mixed = STEP 0.4 · SINE 0.4 · RANDOM_WALK 0.2 by tag hash; others single-profile-all-tags", "converge": "OPTIMIZE TABLE tag_raw · tag_1m FINAL → active parts per partition 1 · merges 0", "compressionRatioBasis": "rows × 41 B ÷ bytes_on_disk", "rollupBytesBasis": "bytesPerRollupRow = tag_1m bytes_on_disk ÷ tag_1m rows · bytesPerRawRow = tag_1m bytes_on_disk ÷ tag_raw rows", "executedAt": { "firstCallEnd": "2026-09-27T01:10:12.358Z", "lastCallEnd": "2026-09-27T01:21:20.249Z" }, "armOrder": "per rep mixed → SINE → RANDOM_WALK → RAMP → STEP → BINARY → COUNTER → SPIKE → DROPOUT", "raw": "docs/measurements/raw/034-storage-compression-profiles.jsonl", "repeatIdentityNote": "same seed · same window → deterministic identical input; deviation 0 is reproducibility, not distribution", "firstRun": "19f8861 run (4-element incomplete) replaced before commit — no correction record" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    {"metric": "tag_raw_rows", "arm": "mixed", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "mixed", "unit": "bytes", "values": [161144967, 161144967, 161144967], "median": 161144967},
    {"metric": "compression_ratio", "arm": "mixed", "unit": "ratio", "values": [9.1595, 9.1595, 9.1595], "median": 9.1595},
    {"metric": "bytes_per_raw_row", "arm": "mixed", "unit": "bytes", "values": [4.4762, 4.4762, 4.4762], "median": 4.4762},
    {"metric": "value_column_bytes_per_raw_row", "arm": "mixed", "unit": "bytes", "values": [4.179, 4.179, 4.179], "median": 4.179},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "mixed", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "mixed", "unit": "bytes", "values": [209.23, 209.23, 209.23], "median": 209.23},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "mixed", "unit": "bytes", "values": [3.4871, 3.4871, 3.4871], "median": 3.4871},
    {"metric": "tag_raw_rows", "arm": "SINE", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "SINE", "unit": "bytes", "values": [264350985, 264350985, 264350985], "median": 264350985},
    {"metric": "compression_ratio", "arm": "SINE", "unit": "ratio", "values": [5.5835, 5.5835, 5.5835], "median": 5.5835},
    {"metric": "bytes_per_raw_row", "arm": "SINE", "unit": "bytes", "values": [7.3431, 7.3431, 7.3431], "median": 7.3431},
    {"metric": "value_column_bytes_per_raw_row", "arm": "SINE", "unit": "bytes", "values": [7.0458, 7.0458, 7.0458], "median": 7.0458},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "SINE", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "SINE", "unit": "bytes", "values": [339.06, 339.06, 339.06], "median": 339.06},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "SINE", "unit": "bytes", "values": [5.651, 5.651, 5.651], "median": 5.651},
    {"metric": "tag_raw_rows", "arm": "RANDOM_WALK", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "RANDOM_WALK", "unit": "bytes", "values": [258971686, 258971686, 258971686], "median": 258971686},
    {"metric": "compression_ratio", "arm": "RANDOM_WALK", "unit": "ratio", "values": [5.6995, 5.6995, 5.6995], "median": 5.6995},
    {"metric": "bytes_per_raw_row", "arm": "RANDOM_WALK", "unit": "bytes", "values": [7.1937, 7.1937, 7.1937], "median": 7.1937},
    {"metric": "value_column_bytes_per_raw_row", "arm": "RANDOM_WALK", "unit": "bytes", "values": [6.8964, 6.8964, 6.8964], "median": 6.8964},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "RANDOM_WALK", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "RANDOM_WALK", "unit": "bytes", "values": [336.94, 336.94, 336.94], "median": 336.94},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "RANDOM_WALK", "unit": "bytes", "values": [5.6156, 5.6156, 5.6156], "median": 5.6156},
    {"metric": "tag_raw_rows", "arm": "RAMP", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "RAMP", "unit": "bytes", "values": [147381667, 147381667, 147381667], "median": 147381667},
    {"metric": "compression_ratio", "arm": "RAMP", "unit": "ratio", "values": [10.0148, 10.0148, 10.0148], "median": 10.0148},
    {"metric": "bytes_per_raw_row", "arm": "RAMP", "unit": "bytes", "values": [4.0939, 4.0939, 4.0939], "median": 4.0939},
    {"metric": "value_column_bytes_per_raw_row", "arm": "RAMP", "unit": "bytes", "values": [3.7967, 3.7967, 3.7967], "median": 3.7967},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "RAMP", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "RAMP", "unit": "bytes", "values": [67.75, 67.75, 67.75], "median": 67.75},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "RAMP", "unit": "bytes", "values": [1.1292, 1.1292, 1.1292], "median": 1.1292},
    {"metric": "tag_raw_rows", "arm": "STEP", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "STEP", "unit": "bytes", "values": [11860905, 11860905, 11860905], "median": 11860905},
    {"metric": "compression_ratio", "arm": "STEP", "unit": "ratio", "values": [124.4424, 124.4424, 124.4424], "median": 124.4424},
    {"metric": "bytes_per_raw_row", "arm": "STEP", "unit": "bytes", "values": [0.3295, 0.3295, 0.3295], "median": 0.3295},
    {"metric": "value_column_bytes_per_raw_row", "arm": "STEP", "unit": "bytes", "values": [0.0324, 0.0324, 0.0324], "median": 0.0324},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "STEP", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "STEP", "unit": "bytes", "values": [17.02, 17.02, 17.02], "median": 17.02},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "STEP", "unit": "bytes", "values": [0.2836, 0.2836, 0.2836], "median": 0.2836},
    {"metric": "tag_raw_rows", "arm": "BINARY", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "BINARY", "unit": "bytes", "values": [12840918, 12840918, 12840918], "median": 12840918},
    {"metric": "compression_ratio", "arm": "BINARY", "unit": "ratio", "values": [114.9451, 114.9451, 114.9451], "median": 114.9451},
    {"metric": "bytes_per_raw_row", "arm": "BINARY", "unit": "bytes", "values": [0.3567, 0.3567, 0.3567], "median": 0.3567},
    {"metric": "value_column_bytes_per_raw_row", "arm": "BINARY", "unit": "bytes", "values": [0.0597, 0.0597, 0.0597], "median": 0.0597},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "BINARY", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "BINARY", "unit": "bytes", "values": [16.74, 16.74, 16.74], "median": 16.74},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "BINARY", "unit": "bytes", "values": [0.279, 0.279, 0.279], "median": 0.279},
    {"metric": "tag_raw_rows", "arm": "COUNTER", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "COUNTER", "unit": "bytes", "values": [61888100, 61888100, 61888100], "median": 61888100},
    {"metric": "compression_ratio", "arm": "COUNTER", "unit": "ratio", "values": [23.8495, 23.8495, 23.8495], "median": 23.8495},
    {"metric": "bytes_per_raw_row", "arm": "COUNTER", "unit": "bytes", "values": [1.7191, 1.7191, 1.7191], "median": 1.7191},
    {"metric": "value_column_bytes_per_raw_row", "arm": "COUNTER", "unit": "bytes", "values": [1.4219, 1.4219, 1.4219], "median": 1.4219},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "COUNTER", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "COUNTER", "unit": "bytes", "values": [287.99, 287.99, 287.99], "median": 287.99},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "COUNTER", "unit": "bytes", "values": [4.7998, 4.7998, 4.7998], "median": 4.7998},
    {"metric": "tag_raw_rows", "arm": "SPIKE", "unit": "rows", "values": [36000000, 36000000, 36000000], "median": 36000000},
    {"metric": "bytes_on_disk", "arm": "SPIKE", "unit": "bytes", "values": [261377223, 261377223, 261377223], "median": 261377223},
    {"metric": "compression_ratio", "arm": "SPIKE", "unit": "ratio", "values": [5.647, 5.647, 5.647], "median": 5.647},
    {"metric": "bytes_per_raw_row", "arm": "SPIKE", "unit": "bytes", "values": [7.2605, 7.2605, 7.2605], "median": 7.2605},
    {"metric": "value_column_bytes_per_raw_row", "arm": "SPIKE", "unit": "bytes", "values": [6.9632, 6.9632, 6.9632], "median": 6.9632},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "SPIKE", "unit": "bytes", "values": [0.0226, 0.0226, 0.0226], "median": 0.0226},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "SPIKE", "unit": "bytes", "values": [325.29, 325.29, 325.29], "median": 325.29},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "SPIKE", "unit": "bytes", "values": [5.4215, 5.4215, 5.4215], "median": 5.4215},
    {"metric": "tag_raw_rows", "arm": "DROPOUT", "unit": "rows", "values": [34020073, 34020073, 34020073], "median": 34020073},
    {"metric": "bytes_on_disk", "arm": "DROPOUT", "unit": "bytes", "values": [257772619, 257772619, 257772619], "median": 257772619},
    {"metric": "compression_ratio", "arm": "DROPOUT", "unit": "ratio", "values": [5.4111, 5.4111, 5.4111], "median": 5.4111},
    {"metric": "bytes_per_raw_row", "arm": "DROPOUT", "unit": "bytes", "values": [7.5771, 7.5771, 7.5771], "median": 7.5771},
    {"metric": "value_column_bytes_per_raw_row", "arm": "DROPOUT", "unit": "bytes", "values": [7.0571, 7.0571, 7.0571], "median": 7.0571},
    {"metric": "key_columns_bytes_per_raw_row", "arm": "DROPOUT", "unit": "bytes", "values": [0.1568, 0.1568, 0.1568], "median": 0.1568},
    {"metric": "rollup_1m_bytes_per_rollup_row", "arm": "DROPOUT", "unit": "bytes", "values": [323.66, 323.66, 323.66], "median": 323.66},
    {"metric": "rollup_1m_bytes_per_raw_row", "arm": "DROPOUT", "unit": "bytes", "values": [5.7083, 5.7083, 5.7083], "median": 5.7083}
  ]
}
```
