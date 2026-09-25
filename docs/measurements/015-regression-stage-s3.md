# 015 — S3 구조 판정 회귀(티어 S 전 구성 · 컨슈머 3 · 부하 실험 프로파일): 무손실 · 무중복 · 롤업 · 품질 · TTL · 랙 · 대조군 AC 성립

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T01:39:59Z ~ 02:56:00Z(팔 3 × 반복 3 = 9회 · AC-13 3회는 따로)

S3 파이프라인 심화(멱등 · 다중 컨슈머 · 롤업 · 대조군 · 품질 · 데드밴드)를 넣은 커밋 fdc7849의 정식 빌드 이미지로 티어 S 전 구성(설비 5 × 태그 50 · 250 pps)을 띄워 S3 구조 판정 AC를 반복마다 다시 판정한다. 팔은 셋이다 — default(기본 스위치 · AC-01 · 02 · 04 · 05 · 07 · 19), control(SW-09 on · AC-21), quality(SIM 주입 계획 + 범위 시드 · AC-08). AC-13(TTL 삭제)은 api 없이 따로 3회 돌렸다. 구조 판정이라 3회 전부 성립이 합격이다(10_observability/04 §구조 판정과 분포 판정).

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | fdc7849(api 이미지 db_study-api:fdc7849 정식 빌드 · health run.commitHash) — 러너가 이미지 · 설정 경로의 미커밋 변경을 거부한다 |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(전 구성 — 설비 5 × 태그 50 · 1 Hz · 250 pps · 04_architecture/07) |
| 스위치 | default · quality 팔 — 전부 기본값 · control 팔 — SW-09=on(PostgresControlSink) · 그 외 기본값(전수는 기계 판독 블록) — 9회 전부의 health switches를 대조해 control 팔만 SW-09 value · impl이 다름을 확인했다 |
| 배치 안 | A(컨슈머 3 · 창 1초 · 행 트리거 R 50,000 · 크기 트리거 P 32 MB) — INGEST_BATCH_PLAN 기본값 · 스위치 아님 |
| 주입 모드 · 시드 · 신호 프로파일 | A(api 안 레지스터 갱신 → Collector 폴링) · 42 · SINE |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음(모드 A 생성기는 api 프로세스 안 — 판정 창 끝 api 컨테이너 CPU 2.63~4.02%가 상한) · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10 · datagen 11-12) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · default · control 없음 · quality infra/sim-plans/ac08-quality.json(sha256 3cb13066b9efcffd1d31d943e90726dbac45b022d027c323351f26eaadf14b90) |
| 초기 상태 | 반복마다 스냅샷 복원 — default · control s3-empty-s · quality s3-range-s(s3-empty-s + seed --range 0,60) · AC-13 s3-empty-s. 스냅샷은 전부 fdc7849 이미지로 빈 볼륨에서 migrate + seed |
| 기준선 · 워밍업 | 기준선 default · control 240초 · quality 200초(api 없이 저장소 유휴 · docker stats) · 워밍업 20초 — 기준선은 현행 참고 5분보다 짧다(§폐기 · 예외) |
| 판정 창 | default · control 1초 lag 표본 180개(벽시계 190초) · quality 표본 215개(벽시계 226~227초) — 창 시각은 표본 루프의 앞뒤 시각이다 |
| 반복 · 편차 | 팔마다 3회 · 구조 판정이라 편차 폐기를 적용하지 않는다(repeat.deviation 0) |
| 스크립트 | scripts/lab/s3/exp29-rep.sh <출력> <팔> <스냅샷> <반복> [창 초] [워밍업 초] [기준선 초] · scripts/lab/s3/ac08-check.sh · scripts/lab/s3/ac13-ttl.sh · apps/api/src/lab/s3-verify.ts(--phase stopped · --control) · apps/api/src/lab/s2-verify.ts(--phase running · AC-04) · 원시 docs/measurements/raw/015-regression-stage-s3.jsonl · 015-ac13-ttl.jsonl |

반복 한 번의 절차는 아래 순서다. 흐름 쪽 8단계와 대응하며, ⑥ 뒤에 api를 다시 띄우지 않는다.

```plain
① 복원          api 컨테이너 제거 → task restore NAME=<스냅샷>
③ 기준선        api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE=all로 api 기동(팔별 환경변수) → health 200 → health 응답 보관(run · switches)
④ 워밍업        20초
⑤ 판정 창       /metrics m0 → 1초마다 ing_group_lag · ing_group_pending 표본(AC-19) → m1 · docker stats 1회
   AC-04        api 기동 중 — tag_raw 최신 행 하나의 epoch를 시계열 API · 최신값 API의 ts와 대조
⑥ 수집 정지     api 정상 종료(Collector 정지 → Ingest 드레인 · XACK) · 정지 로그의 points_emitted 누계
⑦ 정합          정지 상태 — 그룹 lag · pending 0 확인(아니면 반복 불성립) → AC-01 · 02 · 05 · 07 · 21 · E2E 기록 SQL
   AC-08        quality 팔만 — ac08-check.sh가 tag_raw 품질 분포 · 예외 창 · 지연 공백 · 범위 판정
```

- **AC-01 분모는 points_emitted다(모드 A).** Stream 전 엔트리를 디코딩한 포인트 합 · points_emitted 정지 누계 · tag_raw count() 세 수를 맞추고, DLQ 격리분을 뺀 차(diffAfterDlq)도 함께 본다.
- **AC-05는 세 해상도 전 버킷을 대조한다.** 적재 정지 뒤 tag_1m · tag_1h · tag_1d 버킷마다 원시 집계와 롤업 -Merge 집계를 맞추고, avg는 버킷마다 2 · γ(n) · S / n 상계로 판정한다(03_requirements/14 §롤업 정합성 허용 오차 판정).
- **AC-13은 api를 띄우지 않는다.** 복원 뒤 보존(7일) 밖인 10일 전 ts 행 10,000개를 tag_raw에 직접 넣고, 그 일자 파티션의 active 파트가 system.parts에서 사라질 때까지 5초 간격으로 본다(상한 600초) — 모드 D(GEN-08)는 S5라 스크립트가 행을 넣는다.

## 결과

### default 팔 — AC-01 · 02 · 04 · 05 · 07 · 19

| 반복 | 판정 창(UTC) | 정지 뒤 lag · pending | points_emitted | Stream 엔트리 · 포인트 | tag_raw | 차 | 해독 불가 · DLQ | AC-02 중복 조합 | AC-07 비교 · 불일치 · 누락 | AC-04 차 ms(시계열 · 최신값) |
|------|------|------|------|------|------|------|------|------|------|------|
| 1 | 01:39:59 ~ 01:43:09 | 0 · 0 | 53,150 | 1,063 · 53,150 | 53,150 | **0** | 0 · 0 | **0** | 250 · **0** · 0 | **0** · **0** |
| 2 | 01:47:52 ~ 01:51:02 | 0 · 0 | 53,150 | 1,063 · 53,150 | 53,150 | **0** | 0 · 0 | **0** | 250 · **0** · 0 | **0** · **0** |
| 3 | 01:55:42 ~ 01:58:52 | 0 · 0 | 53,150 | 1,063 · 53,150 | 53,150 | **0** | 0 · 0 | **0** | 250 · **0** · 0 | **0** · **0** |

- **AC-01 · AC-02 · AC-04(API 쪽) · AC-07 성립 3/3.** 엔트리 하나가 설비 한 번의 폴링(태그 50)이다 — 1,063 × 50 = 53,150. 정지 뒤 그룹의 컨슈머 수는 3이다.
- AC-04 대조 행 — 반복 1 epoch 1790300590900(2026-09-25 10:43:10.900 KST) · 반복 2 1790301063895(10:51:03.895) · 반복 3 1790301533895(10:58:53.895). 그 시점 그룹 상태는 lag 0 · pending 3 · 4 · 2다.

| 반복 | tag_1m 버킷(원시 · 롤업) | tag_1h | tag_1d | 누락 · 초과 | count 불일치 | min · max · last 불일치 | avg 상계 초과 |
|------|------|------|------|------|------|------|------|
| 1 | 1,250 · 1,250 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** |
| 2 | 1,250 · 1,250 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** |
| 3 | 1,000 · 1,000 | 250 · 250 | 250 · 250 | 0 · 0 | **0** | **0** | **0** |

- **AC-05 성립 3/3 — 세 해상도 전부 누락 · 초과 · count · 선택 연산 · avg 상계 초과가 0이다.** 불일치 · 초과 수는 세 해상도의 합이다(해상도마다 0).
- tag_1m 버킷 수는 태그 250 × 적재가 걸친 분의 수다 — 반복 1 · 2는 5분(1,250), 반복 3은 4분(1,000)에 걸쳤다. 적재 약 213초가 분 경계를 몇 번 넘는지는 기동 시각에 달렸다.

| 반복 | 1초 표본 수 | 그룹 lag 최대 · 0 아닌 표본 | pending 최대 | 결측 표본 | 정지 뒤 lag · pending |
|------|------|------|------|------|------|
| 1 | 180 | **0** · 0 | 8 | 0 | **0** · **0** |
| 2 | 180 | **0** · 0 | 6 | 0 | **0** · **0** |
| 3 | 180 | **0** · 0 | 8 | 0 | **0** · **0** |

- **AC-19 성립 3/3 — 그룹 lag가 판정 창 전 표본에서 0이고, pending이 유계이며, 정지 뒤 consumer_lag(= lag + pending)가 0으로 돌아왔다.** pending 최대 8은 in-flight 2배치 분량 안이다 — 2배치 분량을 창 2개 × 초당 엔트리 5 = 엔트리 10으로 센다(리드 판정 · 10_observability/01 §컨슈머 랙 판정).

### control 팔 — AC-21(SW-09 on)

| 반복 | 판정 창(UTC) | points_emitted · tag_raw | AC-01 차 | 일자 | count(tag_raw) | count(plc_tag_raw_control) | 차 | AC-19 lag 최대 · pending 최대 |
|------|------|------|------|------|------|------|------|------|
| 1 | 02:03:30 ~ 02:06:40 | 53,150 · 53,150 | **0** | 2026-09-25 | 53,150 | 53,150 | **0** | 0 · 6 |
| 2 | 02:13:45 ~ 02:16:55 | 53,100 · 53,100 | **0** | 2026-09-25 | 53,100 | 53,100 | **0** | 0 · 6 |
| 3 | 02:21:34 ~ 02:24:44 | 53,100 · 53,100 | **0** | 2026-09-25 | 53,100 | 53,100 | **0** | 0 · 5 |

- **AC-21 성립 3/3.** 같은 구간(일자 1개) 두 저장소 행 수가 같다. control 팔도 AC-01 · 02 · 04 · 05 · 07 · 19가 반복마다 default 팔과 같은 모양으로 성립했다(중복 조합 0 · AC-07 불일치 0 · AC-04 차 0 ms · AC-05 불일치 합 0 · 정지 뒤 lag · pending 0).
- 반복 2 · 3의 53,100은 반복 1보다 폴링 1사이클(엔트리 1 · 포인트 50) 적다 — 정지 시점이 폴링 순간과 겹친 차이이며 세 수는 반복 안에서 같다.

### quality 팔 — AC-08(SIM 예외 · 지연 + 범위 밖 값)

| 반복 | 판정 창(UTC) | 품질 분포 2 · 4 · 9 · 3 | 예외 행 · 폭 · 설비 수 · 값 최대 | 설비 3 최대 공백 · 다른 설비 최대 공백 | 품질 4인데 범위 안 · 품질 9인데 범위 밖 | 판정 |
|------|------|------|------|------|------|------|
| 1 | 02:36:40 ~ 02:40:26 | 3,000 · 24,001 · 32,199 · 없음 | 3,000 · 59.000초 · 1 · 0 | 61.067초 · 1.005초 | **0** · **0** | 성립 |
| 2 | 02:44:27 ~ 02:48:14 | 3,000 · 24,047 · 32,353 · 없음 | 3,000 · 59.000초 · 1 · 0 | 61.144초 · 1.059초 | **0** · **0** | 성립 |
| 3 | 02:52:13 ~ 02:56:00 | 3,000 · 23,896 · 32,504 · 없음 | 3,000 · 59.001초 · 1 · 0 | 61.081초 · 1.006초 | **0** · **0** | 성립 |

- **AC-08 성립 3/3.** ① 예외 — 설비 2(포트 5021)만 품질 2 행 3,000 = 태그 50 × 60초이고, 첫 행과 끝 행의 폭 59초가 계획의 예외 창 60초에 맞는다. ② 타임아웃 — 설비 3(포트 5022)의 ts 공백이 약 61초로 지연 창 60초를 덮고, **품질 3 행이 한 행도 없다**(BAD_TIMEOUT 비저장 판정). ③ 범위 — 범위 [0, 60] 밖 값은 전부 품질 4 · 범위 안 루프백 값은 전부 9다.
- 품질 분포 합 = tag_raw = points_emitted — 반복 1 3,000 + 24,001 + 32,199 = **59,200** · 반복 2 3,000 + 24,047 + 32,353 = **59,400** · 반복 3 3,000 + 23,896 + 32,504 = **59,400**.
- quality 팔도 AC-01(차 0 · 엔트리 1,184 · 1,188 · 1,188) · AC-02(중복 조합 0) · AC-04(차 0 ms) · AC-05(불일치 합 0 · tag_1m 버킷 1,250 · 1,250 · 1,500) · AC-07(불일치 0) · AC-19(lag 최대 0 · pending 최대 6 · 5 · 7 · 정지 뒤 0)가 성립했다. 예외 행은 해독 불가가 아니라 품질 2 행으로 저장되므로 DLQ는 0이다.

### AC-13 — TTL 삭제(api 없음)

| 반복 | 파티션 | 삽입 행(part_log NewPart) | 활성 행 0까지 | 파티션 소멸까지 | 병합 사유 | mutation 전 · 후 |
|------|------|------|------|------|------|------|
| 1 | 20260915 | 10,000 | 0초 | 26초 | TTLDropMerge | 0 · **0** |
| 2 | 20260915 | 10,000 | 0초 | 36초 | TTLDropMerge | 0 · **0** |
| 3 | 20260915 | 10,000 | 1초 | 31초 | TTLDropMerge | 0 · **0** |

- **AC-13 성립 3/3 — 보존 밖 일자 파티션이 system.parts에서 사라졌고 행 단위 DELETE mutation이 0건이다.** 병합 사유가 TTLDropMerge 하나뿐이라 삭제 경로가 파트 단위 TTL 병합임을 part_log가 보인다.
- 활성 행 0 → 파티션 소멸 사이 26~36초는 빈 파트가 정리되는 시간이다 — 적용 시점(머지 주기)은 2계층 조정값이라 기록만 한다(05_data_stores/08).

### 참고 — E2E · 구간 · 자원(판정에 쓰지 않는다)

E2E는 기록 SQL의 정확 분위수(quantilesExact(ingested_at − ts) · 판정 창 고정)이고, 구간은 판정 창 m1 − m0 히스토그램의 버킷 보간 분위수다. **AC-22 · 배치 안 비교의 기록은 EXP-34(기록 020)다.**

| 팔 | E2E p50 반복 1 · 2 · 3(ms) | 중앙값 | E2E p95 중앙값 | E2E p99 중앙값 | 창 안 행 |
|------|------|------|------|------|------|
| default | 935 · 938 · 934 | **935** | 1,377 | 1,409 | 47,500 × 3 |
| control | 934 · 935 · 928 | **934** | 1,373 | 1,407 | 47,500 × 3 |
| quality | 928 · 918 · 927 | **927** | 1,383 | 1,410 | 53,500 · 53,750 · 53,750 |

- 창 안 행 — default · control 190초 × 태그 250 = 47,500으로 판정 창에 폴링 누락이 없다. quality는 226초 × 250 − 설비 3 공백 60초 × 50 = 53,500 · 227초 × 250 − 3,000 = 53,750으로, 빠진 행이 정확히 타임아웃 창만큼이다.

| 구간 지표 | 구간 | default p50 반복 1 · 2 · 3(ms) | default 평균(ms) | 관측 수 | 기록 012(S2 · d32b09a) p50 |
|------|------|------|------|------|------|
| col_modbus_rtt_seconds | #2 | 0.77 · 0.79 · 0.76 | 0.80 · 0.83 · 0.80 | 950 · 949 · 950 | 1.49 |
| poll_duration | 폴링 사이클 | 2.10 · 2.27 · 2.14 | 2.36 · 2.48 · 2.36 | 950 · 949 · 950 | 2.49 |
| ing_stream_residence_seconds | 6a | 0.48 · 0.51 · 0.48 | 0.51 · 0.54 · 0.50 | 950 · 949 · 950 | 0.55 |
| ing_decode_seconds | 6b | 0.70 · 0.71 · 0.72 | 0.85 · 0.89 · 0.90 | 950 · 949 · 950 | 0.73 |
| ing_fanin_wait_seconds | 6c | 910.98 · 912.24 · 906.73 | 921.22 · 920.47 · 918.99 | 950 · 950 · 950 | 575.00 |
| insert_duration | #7 | 22.75 · 22.73 · 23.40 | 20.95 · 20.98 · 21.50 | 190 · 189 · 190 | 10.69 |

- insert_duration 관측 수 190 = 창 190개 — 컨슈머가 3이어도 플러시는 창마다 1회다.
- control · quality 팔의 구간 p50은 default와 같은 자리에 있다(6c 중앙값 910.42 · 924.15 ms · #7 22.52 · 22.12 ms). quality 팔의 col_modbus_rtt_seconds 평균 366~367 ms · p99 10초와 poll_duration 평균 57 ms는 설비 3 타임아웃 사이클이 섞인 값이다. 타임아웃 사이클 수는 폴링 관측 수 − 6a 관측 수 = 1,092 − 1,072 = **20**(반복 1)이고, device-poller.ts가 타임아웃 RTT를 마지막 버킷 10초의 2배인 20초로 관측해 20 × 20초 ≈ 1,092 × 0.367초 ≈ 401초가 평균을 끌어올린다. p99 10초는 hist-diff.py가 +Inf 칸을 마지막 유한 경계로 적은 값이다.
- 자원(docker stats 순간 표본 1회씩) — 기준선 clickhouse CPU 2.92~4.32% · 메모리 632.5~711.4 MiB · 판정 창 끝 api CPU 2.63~4.02% · 메모리 113.9~121.3 MiB · clickhouse CPU 5.01~8.89% · 메모리 759.2~838.1 MiB. control 팔의 판정 창 끝 postgres 메모리 60.23~60.38 MiB가 다른 팔(54.27~54.34 MiB)보다 약 6 MiB 크다 — 대조군 동시 적재 몫이다.

## 해석

- **S3 구조 판정 AC 9종이 티어 S 전 구성 · 컨슈머 3에서 3회 모두 성립한다** — AC-01 · 02 · 04 · 05 · 07 · 08 · 13 · 19 · 21 = **9**. AC-01 · 02 · 04 · 05 · 07 · 19는 세 팔 9회 전부, AC-21은 control 3회, AC-08은 quality 3회, AC-13은 3회다. 01_overview/05 S3 합격 판정 중 ① AC-01 · ② AC-19 · ④ AC-05 · ⑤ AC-21의 근거가 이 기록이다 — ③ AC-20은 EXP-13(기록 016), ⑥ AC-22는 EXP-34(기록 020)가 갖는다.
- **AC-02는 재시도 없는 경로의 무중복이다.** 이 기록의 반복에는 강제 종료 · 재전달이 없어 중복 0은 "정상 경로가 중복을 만들지 않는다"까지만 보인다. 재시도를 유발한 구간의 무중복(AC-02 방법 칸 후단 · AC-20)은 EXP-13이 판정한다. 통합 단계에서 ClickHouse 26.8은 deduplicate_insert(기본 enable)가 insert_deduplicate를 대체한다는 결함을 찾아 fdc7849에서 고쳤다 — 이 기록은 그 수정이 들어간 이미지로 돌았다.
- **AC-08의 세 품질 경로가 서로 섞이지 않는다.** 예외 설비 2는 품질 2로 저장되고 값 자리가 0이라 범위 판정에서 빠지며, 지연 설비 3은 행이 비고, 나머지 설비의 범위 밖 값만 4가 된다 — 다른 설비의 최대 공백이 약 1초라 지연이 이웃 설비의 폴링을 막지 않았다(설비별 폴러 독립).
- **AC-19의 lag 0은 컨슈머 3이 초당 엔트리 5를 여유 있게 소비한다는 뜻이다.** pending 최대 5~8은 fan-in 창에 묶인 엔트리이며, 수집 중 대조를 하지 않고 정지 뒤 pending 0에서 AC-01을 판정하는 이유가 그대로 나타난다(기록 010과 같은 구조).
- **E2E p50이 S2(기록 012 · 608 ms)보다 커져 약 930 ms다.** 구간 표에서 차이는 6c(fan-in 대기 · p50 575 → 약 911 ms · 평균 약 600 → 약 920 ms)와 #7(INSERT · 10.69 → 약 22.7 ms)에 몰리고, #2 · 6a · 6b는 S2와 같은 크기다. S3는 컨슈머 3이고 창 닫힘이 모든 컨슈머 하한(low watermark)의 최솟값에 묶인다 — 이 구조가 대기를 늘렸을 수 있으나 이 기록은 배치 안 · 컨슈머 수를 바꾸지 않아 원인을 가를 수 없다. 원인 판정은 EXP-34(기록 020)로 넘긴다. 두 기록은 커밋이 달라 비교 불성립이며(10_observability/04 §조건 분리 강제) 이 문단은 방향 관찰이다.
- 한계 — 구간 분위수는 히스토그램 보간값이다(07_measurement_limits 한계 #1). E2E는 기록 SQL의 정확 분위수이고(한계 #2) 같은 머신 시계 위에서만 성립한다(한계 #6).

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음 · 창에서 뺀 구간은 워밍업 20초와 정지 전이(판정 창 끝 → 정상 종료)다.
- **control 팔 반복 2는 한 번 중단 뒤 다시 돌렸다.** 첫 실행이 도구 호출 상한(10분)을 넘어 기준선 도중 끊겼다 — 기동 전이라 health · 판정 값이 없고 원시에 줄을 남기지 않았다. 같은 스냅샷 복원부터 다시 돈 실행이 원시의 반복 2다.
- **quality 팔 반복 1도 판정 전에 한 번 멈췄다.** 러너가 부르는 ac08-check.sh에 실행 권한이 없어(커밋 fdc7849의 파일 모드 100644) 정합 단계에서 끝났다 — 원시에 남은 줄이 없고, 권한을 준 뒤 복원부터 다시 돈 실행이 원시의 반복 1이다.
- **기준선이 현행 참고 5분보다 짧다.** 도구 호출 한 번이 10분을 넘지 않게 default · control 240초로 줄였고, quality는 SIM 계획(예외 60~120초 · 지연 150~210초 · 기동 기준)의 끝 210초와 워밍업 · 판정 창을 한 호출 안에 담으려고 200초로 더 줄였다. 기준선은 유휴 바닥을 보는 칸이고 이 기록의 판정은 구조 판정이라 판정 값에 닿지 않는다.
- **판정 창의 벽시계 길이가 표본 수보다 길다.** 1초 표본 루프가 표본마다 /metrics를 두 번 읽어 180표본이 190초 · 215표본이 226~227초가 됐다. 창 시각 · E2E 창 · 창 안 행 수는 벽시계 기준으로 서로 맞는다.
- **러너는 미커밋 수정 판이다.** scripts/lab/s3는 이미지에 들어가지 않는다. fdc7849 대비 차이는 파일 모드 100644 → 100755(위 quality 사유)와 ac13-ttl.sh의 삽입 행 수 측정 위치(system.parts → part_log NewPart — 보존 밖 행은 삽입 직후 TTL 병합으로 곧 0이 되어 parts로 셀 수 없다)뿐이다. 스냅샷 manifest의 git_dirty=yes는 문서 · .omc 미커밋 때문이며 이미지 경로는 깨끗했다.
- **AC-13 반복의 실행 시각은 원시에 없다.** 러너가 시작 시각을 적지 않아 기계 판독 블록 window는 EXP-29 9회만 덮는다.
- **AC-04의 웹 표시 쪽(Asia/Seoul 변환)은 이 기록이 판정하지 않았다** — 러너는 API 응답 ts만 저장 epoch와 대조한다(기록 010과 같다).

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- 01_overview/05 S3 합격 판정 ① AC-01 · ② AC-19 · ④ AC-05 · ⑤ AC-21이 이 기록을 인용한다.
- 03_requirements/14 AC-08 · AC-13 · AC-02(정상 경로)의 S3 성립 근거로 이 기록을 인용한다.
- 04_architecture/05 · 03_requirements/13 REQ-NFR-03의 E2E 값은 올리지 않는다 — 참고 값이며 S3 E2E 기록은 EXP-34(기록 020)의 판단 뒤에 정한다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "015",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T01:39:59.000Z", "end": "2026-09-25T02:56:00.000Z" },
  "run": { "commitHash": "fdc7849", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": ["off", "on", "off"], "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": { "arm": "quality", "path": "infra/sim-plans/ac08-quality.json", "sha256": "3cb13066b9efcffd1d31d943e90726dbac45b022d027c323351f26eaadf14b90" }, "stage": "S3", "tierConfig": "device5-tag50-250pps", "signalProfile": "SINE", "batchPlan": "A", "consumers": 3, "arms": ["default", "control", "quality"], "snapshot": { "default": "s3-empty-s", "control": "s3-empty-s", "quality": "s3-range-s", "ac13": "s3-empty-s" }, "rangeSeed": [0, 60], "image": "db_study-api:fdc7849", "postgresImage": "db_study-postgres:18.6-partman5.5.0", "clickhouseVersion": "26.8.10.6", "baselineS": { "default": 240, "control": 240, "quality": 200 }, "warmupS": 20, "lagSamples": { "default": 180, "control": 180, "quality": 215 }, "windowWallS": { "default": 190, "control": 190, "quality": [226, 227, 227] }, "ac13Rows": 10000 },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "ac01_diff", "arm": "default", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_tag_raw_rows", "arm": "default", "unit": "rows", "values": [53150, 53150, 53150], "median": 53150 },
    { "metric": "ac02_duplicate_combos", "arm": "default", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-timeseries", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-latest", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_mismatch_total", "arm": "default", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac07_mismatched", "arm": "default", "unit": "tags", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_lag_max", "arm": "default", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_pending_max", "arm": "default", "unit": "entries", "values": [8, 6, 8], "median": 8 },
    { "metric": "ac19_consumer_lag_after_stop", "arm": "default", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_diff", "arm": "control", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac21_diff", "arm": "control", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac21_control_rows", "arm": "control", "unit": "rows", "values": [53150, 53100, 53100], "median": 53100 },
    { "metric": "ac19_pending_max", "arm": "control", "unit": "entries", "values": [6, 6, 5], "median": 6 },
    { "metric": "ac01_diff", "arm": "quality", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac08_exception_rows", "arm": "quality", "unit": "rows", "values": [3000, 3000, 3000], "median": 3000 },
    { "metric": "ac08_exception_span_s", "arm": "quality", "unit": "s", "values": [59.0, 59.0, 59.001], "median": 59.0 },
    { "metric": "ac08_timeout_device_gap_s", "arm": "quality", "unit": "s", "values": [61.067, 61.144, 61.081], "median": 61.081 },
    { "metric": "ac08_quality3_rows", "arm": "quality", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac08_misclassified_4_9", "arm": "quality", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac08_pass", "arm": "quality", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac19_pending_max", "arm": "quality", "unit": "entries", "values": [6, 5, 7], "median": 6 },
    { "metric": "ac13_partition_gone_s", "arm": "AC-13", "unit": "s", "values": [26, 36, 31], "median": 31 },
    { "metric": "ac13_mutations", "arm": "AC-13", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "e2e_p50_ms", "arm": "default-reference", "unit": "ms", "values": [935, 938, 934], "median": 935 },
    { "metric": "e2e_p95_ms", "arm": "default-reference", "unit": "ms", "values": [1373, 1377, 1377], "median": 1377 },
    { "metric": "e2e_p99_ms", "arm": "default-reference", "unit": "ms", "values": [1409, 1409, 1405], "median": 1409 },
    { "metric": "ing_fanin_wait_p50_ms", "arm": "default-reference", "unit": "ms", "values": [910.98, 912.24, 906.73], "median": 910.98 },
    { "metric": "insert_duration_p50_ms", "arm": "default-reference", "unit": "ms", "values": [22.75, 22.73, 23.4], "median": 22.75 }
  ]
}
```
