# 027 — S5 구조 판정 회귀: AC-01 · 02 · 04 · 05 · 07 · 19 회귀 + AC-06 캐시 정합성 세 층 (S5 · 티어 S · 모드 A)

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T18:04:56Z ~ 18:22:04Z(본 호출 3회 — 첫 창 시작 ~ 마지막 창 끝)

S5 커밋(5fa09fd — 저장소 메트릭 · 관측 프로파일 · 모드 C · 모드 D · 대조 격자 · 실험 러너)의 정식 빌드 이미지로 S4 회귀 러너(scripts/lab/s4/exp29-rep.sh)를 그대로 다시 돌린다. S4 기록 021의 본 호출과 같은 표준 구성(티어 S · 모드 A · 스위치 기본값)이고, AC-01 · 02 · 04 · 05 · 07 · 19와 AC-06(캐시 정합성 세 층 · 헤드리스)을 한 호출에서 판정한다. 구조 판정이라 3회 모두 성립해야 합격이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5fa09fd(api 이미지 db_study-api:5fa09fd 정식 빌드 · health run.commitHash 5fa09fd — 세 반복 모두) |
| 프로파일 · 상한 | 부하 실험(health run.memoryProfile load) · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(설비 5 × 태그 50 · 250 pps — health run.capacityTier S) |
| 스위치 | 전부 기본값 — 세 반복의 health switches 11개가 같다(SW-07 100 WindowMergeThrottle · SW-09 off NoopControlSink · SW-10 off PassthroughFilter · SW-11 ingest) · 전수는 기계 판독 블록 |
| 주입 모드 · 시드 · 신호 | A(SIM + Collector · APP_ROLE all) · 42 · SINE(러너 · 기록 021과 같다) |
| 관측 스택 · CPU 배치 | off · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10) · 웹과 헤드리스 Chromium은 호스트 프로세스 |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 반복마다 스냅샷 s3-empty-s 복원 · 기준선은 api 없이 저장소 유휴 docker stats 1회(길이는 원시 없음 — §폐기 · 예외) |
| 창 | 워밍업 20초(health checkedAt → 창 시작 20초 · 세 반복 같다) · 판정 창 150초(1초 lag 표본 150) · AC-06은 창 30초 지점 1회 |
| 회귀 범위 | AC-01 · 02 · 04 · 05 · 06 · 07 · 19 — AC-08 · 10 · 13은 돌리지 않았다(§폐기 · 예외) |
| 스크립트 | scripts/lab/s4/exp29-rep.sh(S4 러너 재사용) · ac06-capture.cjs · apps/api/src/lab/s2-verify.ts(running) · s3-verify.ts(stopped) · 원시 docs/measurements/raw/027-regression-stage-s5.jsonl(3줄) |

반복 한 번의 절차는 기록 021 본 호출과 같다.

```plain
① 복원          api 제거 → task restore NAME=s3-empty-s
③ 기준선        api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE all · CAPACITY_TIER S → 웹 → health 보관
④ 워밍업        20초
⑤ 판정 창       150초 — 1초 lag 표본(AC-19) · 30초 지점에 AC-06 한 번
⑥ 정지          s2-verify running(AC-04) → api 정상 종료(드레인 · XACK · points_emitted 누계 로그)
⑦ 정합          s3-verify stopped(AC-01 · 02 · 05 · 07 · lag 0 · 창 E2E)
```

- **AC-06 사건 · 성립 조건은 기록 021과 같다.** API 단건 · 목록 → Dictionary 재적재 뒤 첫 조회 → BFF 첫 목록 → 쓴 탭(응답 뒤) · 다른 탭(cacheinv 수신 뒤) 첫 읽기와 렌더가 모두 새 이름이어야 성립이다.
- **AC-01은 정지 로그의 points_emitted 누계와 tag_raw 행 수의 차다.** 원시 pointsEmittedAtStop · verify.ac01.streamPoints · tagRawRows 셋이 반복마다 같은 값이다.

## 결과

값의 순서는 반복 1 · 2 · 3이다.

| 반복 | 판정 창(UTC) | points_emitted | tag_raw | AC-01 차 | AC-02 중복 | AC-04 차(시계열 · 최신값 ms) | AC-05 불일치 합(1m · 1h · 1d) | AC-07 불일치 | AC-19 lag 최대 · 0 아님 · pending 최대 | 판정 |
|------|------|------|------|------|------|------|------|------|------|------|
| 1 | 18:04:56 ~ 18:07:32 | 44,550 | 44,550 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 8 | 성립 |
| 2 | 18:12:12 ~ 18:14:48 | 44,450 | 44,450 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 6 | 성립 |
| 3 | 18:19:28 ~ 18:22:04 | 44,600 | 44,600 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 8 | 성립 |

- **회귀 AC-01 · 02 · 04 · 05 · 07 · 19 성립 3/3.** DLQ 엔트리 0 · 해독 불가 0 · 정지 뒤 그룹 lag 0 · pending 0(소비자 3)이다. AC-05는 1m 버킷 1,000 · 1h 250 · 1d 250 전부가 롤업과 맞는다(누락 · 초과 · count · select 불일치 · avg 상계 초과 0).
- pending 최대 6~8은 창 2개 × 초당 엔트리 5 = 10 이하다(기록 015 · 021 해석과 같은 상계).

| 반복 | 태그 | 쓰기 | API 단건 · 목록 | Dictionary 재적재 관측(쓰기 뒤 ms) · 첫 조회 이름 | BFF 첫 목록 | 쓴 탭 첫 읽기(응답 뒤 ms) · 렌더 | 다른 탭 신호(쓰기 뒤 ms) · 첫 읽기 · 렌더 | AC-06 |
|------|------|------|------|------|------|------|------|------|
| 1 | 3 | 200 | 새 · 새 | 27 · 새 | 새 | 새(0) · 새 | 0 · 새 · 새 | 성립 |
| 2 | 4 | 200 | 새 · 새 | 29 · 새 | 새 | 새(12) · 새 | 1 · 새 · 새 | 성립 |
| 3 | 5 | 200 | 새 · 새 | 31 · 새 | 새 | 새(0) · 새 | 1 · 새 · 새 | 성립 |

- **AC-06 성립 3/3 — 네 층(API · Dictionary · BFF · 브라우저 두 탭) 모두 사건 뒤 첫 읽기가 새 값이다.** 다른 탭 신호는 cache:tagmeta:{태그} 한 건씩이다.
- Dictionary 재적재 관측 27~31 ms는 기록 021의 30~34 ms와 같은 대역이다 — ④는 응답 뒤에 돈다.

| 반복 | 창 E2E 행 | E2E p50(ms) | p95(ms) | p99(ms) |
|------|------|------|------|------|
| 1 | 39,000 | 918 | 1,362 | 1,405 |
| 2 | 39,000 | 932 | 1,370 | 1,406 |
| 3 | 39,000 | 934 | 1,373 | 1,408 |

- E2E는 s3-verify가 판정 창 안 행으로 다시 낸 정확 분위수다(quantilesExact). 회귀 판정 지표가 아니라 참고로 적는다 — EXP-30(지연 예산) 조건이 아니다.

## 해석

- **S5 변경은 수집 · 적재 · 조회 · 무효화 체인의 구조 판정을 깨지 않았다.** 5fa09fd가 더한 것은 저장소 메트릭 · 관측 수집 · 모드 C 표면 · 모드 D 경로 · 러너이고, 모드 A 적재 경로와 캐시 무효화 체인 ②~⑥은 S4 그대로다. 같은 러너 · 같은 스냅샷에서 AC 일곱이 3/3 성립한다.
- **저장소 메트릭 수집이 회귀 창 안에 돌아도 AC-04 차가 0이다.** 관측 수집(OBS)은 api 프로세스 안에서 system 표를 읽는다 — 창 안 적재 · 조회와 이벤트 루프를 나누지만 순서 · 존재 조건을 바꾸지 않는다. 수집 부하의 크기는 EXP-38(관측 간섭)이 잰다.
- 한계 — 티어 S · 모드 A만 본다. M 티어 모드 B의 무손실은 기록 028이 따로 판정한다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음. 구조 판정은 편차 폐기를 적용하지 않는다 — 분포 값은 참고 E2E뿐이며 편차 최대 1.7%(p50 (934 − 918) ÷ 932)다. pending 최대 8 · 6 · 8은 작은 정수 순간값이라 편차 판정에서 뺀다(06_experiment_catalog 순간값 불릿).
- **AC-10(WebSocket 재연결)은 이번 S5 회귀에서 돌리지 않았다.** S5 변경이 WebSocket 재연결 경로(게이트웨이 · 클라이언트 백오프 · 재연결 뒤 REST 동기화)를 건드리지 않았다(리드 판정). S4 성립 근거는 기록 021이다.
- **S5 계획이 적은 AC-08 · 13도 돌리지 않았다.** 두 AC의 러너가 S3 전용이고, S5 변경이 품질 판정 · TTL 경로를 건드리지 않았다(리드 판정). 성립 근거는 기록 015다.
- **기준선 길이가 원시에 없다.** 원시 줄은 baseline에 docker stats 한 점(postgres · clickhouse · redis)만 싣고 길이 인자를 적지 않는다. 러너 기본값은 240초다 — 호출 인자는 원시 없음. 유휴 한 점은 postgres 0.00 · 1.17 · 0.00% · clickhouse 3.68 · 4.11 · 4.05% · redis 1.13 · 1.27 · 1.03%다.
- **판정 창 머리는 첫 창 시작 ~ 마지막 창 끝이다.** 반복별 창(156초 — 150초 표본 + 표본 간격 누적)은 결과 표에 있다.

## 정본 반영

- 01_overview/05 S5 합격 판정 — S5 커밋의 회귀 AC(01 · 02 · 04 · 05 · 06 · 07 · 19) 성립 근거로 인용한다.
- 03_requirements/14 회귀 AC의 S5 성립 근거로 인용하고, AC-08 · 10 · 13을 S5에서 돌리지 않은 판정(변경 경로 밖)을 함께 적는다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "027",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T18:04:56.000Z", "end": "2026-09-25T18:22:04.000Z" },
  "run": { "commitHash": "5fa09fd", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S5", "tierConfig": "device5-tag50-250pps", "signalProfile": "SINE", "appRole": "all", "snapshot": "s3-empty-s", "baselineS": null, "warmupS": 20, "windowS": 150, "acScope": ["AC-01", "AC-02", "AC-04", "AC-05", "AC-06", "AC-07", "AC-19"], "acNotRun": { "AC-10": "ws reconnect path untouched by S5", "AC-08": "S3-only runner · quality path untouched", "AC-13": "S3-only runner · TTL path untouched" }, "runner": "scripts/lab/s4/exp29-rep.sh", "image": "db_study-api:5fa09fd" },
  "repeat": { "runs": 3, "deviation": 0.017, "threshold": 0.2 },
  "results": [
    { "metric": "ac01_diff", "arm": "default", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_tag_raw_rows", "arm": "default", "unit": "rows", "values": [44550, 44450, 44600], "median": 44550 },
    { "metric": "ac02_duplicate_combos", "arm": "default", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-timeseries", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-latest", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_mismatch_total", "arm": "default", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac07_mismatched", "arm": "default", "unit": "tags", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_lag_max", "arm": "default", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_pending_max", "arm": "default", "unit": "entries", "values": [8, 6, 8], "median": 8 },
    { "metric": "ac06_pass", "arm": "default", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac06_dict_reload_after_write_ms", "arm": "default", "unit": "ms", "values": [27, 29, 31], "median": 29 },
    { "metric": "ac06_other_tab_signal_after_write_ms", "arm": "default", "unit": "ms", "values": [0, 1, 1], "median": 1 },
    { "metric": "e2e_p50_ms", "arm": "default", "unit": "ms", "values": [918, 932, 934], "median": 932 },
    { "metric": "e2e_p95_ms", "arm": "default", "unit": "ms", "values": [1362, 1370, 1373], "median": 1370 }
  ]
}
```
