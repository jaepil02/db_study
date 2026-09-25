# 021 — S4 구조 판정 회귀: AC-01 · 02 · 04 · 05 · 07 · 19 회귀 + AC-06 캐시 정합성 세 층 + AC-10 WebSocket 재연결 (S4 · 티어 S · 모드 A)

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-25T08:39:09Z ~ 09:03:10Z(본 호출 3회 · AC-10 호출 3회 — 끝 시각은 §폐기 · 예외)

S4 커밋의 표준 구성(티어 S · 모드 A · 스위치 기본값)으로 S3 회귀 판정(AC-01 · 02 · 04 · 05 · 07 · 19)을 다시 세우고, S4에서 처음 판정하는 AC-06(캐시 정합성 세 층)과 AC-10(WebSocket 재연결)을 헤드리스 Chromium으로 기계 판정한다(S4 판정 10). 구조 판정이라 3회 모두 성립해야 합격이다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 3e8a46d(api 이미지 db_study-api:3e8a46d 정식 빌드 · health run.commitHash) · 웹 운영 빌드(next build · 같은 커밋) |
| 저장소 이미지 | postgres db_study-postgres:18.6-partman5.5.0 · ClickHouse 26.8.10.6 · Redis 8.10.2 |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB(health run.memoryLimitMb) |
| 용량 티어 | S(설비 5 × 태그 50 · 250 pps) |
| 스위치 | 전부 기본값 — health switches 11개(SW-04 TimeSnapKeyNormalizer · SW-05 RedisRebuildLock · SW-06 RedisPubSubFanout · SW-07 100 WindowMergeThrottle 포함) · 전수는 기계 판독 블록 |
| 주입 모드 · 시드 · 신호 | A(SIM + Collector · APP_ROLE all) · 42 · SINE |
| 관측 스택 · CPU 배치 | off · 표준(api · redis 0-4 · clickhouse 5-8 · postgres 9-10) · 웹과 헤드리스 Chromium은 호스트 프로세스 |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 | 호출마다 스냅샷 s3-empty-s 복원 · 본 호출 기준선 240초(api 없이 저장소 유휴) · AC-10 호출은 기준선 없음(§폐기 · 예외) |
| 창 | 본 호출 워밍업 20초 · 판정 창 150초(1초 lag 표본 150) · AC-06은 창 30초 지점 1회 · AC-10은 api 정지 75초 |
| 브라우저 | 헤드리스 Chromium(playwright-core 1.62.1 · 브라우저 리비전 1234) |
| 스크립트 | scripts/lab/s4/exp29-rep.sh · ac06-capture.cjs · ac10-rep.sh · ac10-capture.cjs · apps/api/src/lab/s2-verify.ts(running) · s3-verify.ts(stopped) · 원시 docs/measurements/raw/021-regression-stage-s4.jsonl · 021-regression-stage-s4-ac10.jsonl |

본 호출 한 번의 절차는 아래 순서다.

```plain
① 복원          api 제거 → task restore NAME=s3-empty-s
③ 기준선        240초 — api 없이 저장소 유휴 · docker stats 1회
② 기동          APP_ROLE all · CAPACITY_TIER S → 웹(next start · 127.0.0.1:3001) → health 보관
④ 워밍업        20초
⑤ 판정 창       150초 — 1초 lag 표본(AC-19) · 30초 지점에 AC-06 한 번
   AC-06        쓴 탭 A · 다른 탭 B가 같은 설비 태그 탭을 연다 → A의 편집 폼으로 태그명 저장(BFF 경유 PATCH)
                → API 단건 · 목록 첫 읽기 → BFF 목록 첫 읽기 → mst_dict_reloads_total 증가 뒤 첫 시계열 조회(최근 구간)
                → A는 응답 뒤 첫 BFF 목록 · B는 cacheinv 수신 뒤 첫 BFF 목록 · 두 탭 화면 렌더
⑥ 정지          s2-verify running(AC-04) → api 정상 종료(드레인 · XACK · points_emitted 누계 로그)
⑦ 정합          s3-verify stopped(AC-01 · 02 · 05 · 07 · lag 0)
```

AC-10 호출은 복원 → api(all) · 웹 기동 → /realtime/1을 연 헤드리스 탭 → api 컨테이너 정지 75초 → 기동 → 재연결 관측 순서다. WebSocket 생성자를 감싸 시도마다 생성 · 열림 · 닫힘 시각과 종료 코드를 적고, 재연결 뒤 REST 최신값 요청 수와 응답 본문을 모은다.

- **AC-06 사건은 03_requirements/14 §캐시 정합성 판정 그대로다.** Redis 층 — 쓰기 응답 수신 · Dictionary 층 — 재적재 완료(mst_dict_reloads_total 증가) · BFF — 쓰기 응답 · 쓴 탭 — 쓰기 응답 · 다른 탭 — cacheinv 수신. 각 사건 뒤 첫 읽기가 새 이름이어야 성립이다.
- **AC-10의 값 대조** — 재연결 REST 응답의 태그마다 ts가 직후 읽은 rt:latest Hash보다 새롭지 않고, 차이가 두 읽기 경과 + 한 주기 안이어야 한다. 응답 meta.source는 redis다.

## 결과

값의 순서는 반복 1 · 2 · 3이다.

| 반복 | 판정 창(UTC) | points_emitted | tag_raw | AC-01 차 | AC-02 중복 | AC-04 차(시계열 · 최신값 ms) | AC-05 불일치 합(1m · 1h · 1d) | AC-07 불일치 | AC-19 lag 최대 · 0 아님 · pending 최대 | 판정 |
|------|------|------|------|------|------|------|------|------|------|------|
| 1 | 08:39:09 ~ 08:41:48 | 45,100 | 45,100 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 5 | 성립 |
| 2 | 08:46:28 ~ 08:49:06 | 45,000 | 45,000 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 6 | 성립 |
| 3 | 08:53:45 ~ 08:56:24 | 45,050 | 45,050 | 0 | 0 | 0 · 0 | 0 · 0 · 0 | 0/250 | 0 · 0/150 · 7 | 성립 |

- **회귀 AC-01 · 02 · 04 · 05 · 07 · 19 성립 3/3.** AC-06의 태그 쓰기가 창 안에서 Collector 재로드(설비 1 · 사이클 경계 정지 · scan_seq 이어 세기)를 일으켰는데도 AC-01 차가 0이다 — 재로드가 사이클을 버리지 않는다는 구조 사실이 회귀 판정 위에서도 선다.
- pending 최대 5~7은 창 2개 × 초당 엔트리 5 = 10 이하다(기록 015 해석과 같은 상계).

| 반복 | 태그 | 쓰기 | API 단건 · 목록 | Dictionary 재적재 관측(쓰기 뒤 ms) · 첫 조회 이름 | BFF 첫 목록 | 쓴 탭 첫 읽기 · 렌더 | 다른 탭 신호(쓰기 뒤 ms) · 첫 읽기 · 렌더 | AC-06 |
|------|------|------|------|------|------|------|------|------|
| 1 | 3 | 200 | 새 · 새 | 32 · 새 | 새 | 새 · 새 | 0 · 새 · 새 | 성립 |
| 2 | 4 | 200 | 새 · 새 | 34 · 새 | 새 | 새 · 새 | 0 · 새 · 새 | 성립 |
| 3 | 5 | 200 | 새 · 새 | 30 · 새 | 새 | 새 · 새 | 0 · 새 · 새 | 성립 |

- **AC-06 성립 3/3 — 네 층(API · Dictionary · BFF · 브라우저 두 탭) 모두 사건 뒤 첫 읽기가 새 값이다.**
- **다른 탭의 신호가 쓰기 응답과 같은 시각(0 ms · 측정 해상도 안)에 온다.** ③ 발행이 응답 전에 끝나므로 ⑥ 신호는 BFF ⑤ revalidateTag보다 먼저 BFF에 닿을 수 있다 — 이 경합은 S4 검수(M5)가 찾았고, 신호 뒤 2초 신선 창(셸이 x-bff-fresh를 달고 BFF가 그 조회를 서버 사본 없이 api에서 읽는다)으로 닫았다. 신선 창 없이 재면 다른 탭 첫 읽기가 옛 값일 수 있다.
- Dictionary 층 사건(재적재 완료)은 쓰기 응답 뒤 30~34 ms에 관측됐다 — ④는 응답 뒤에 돈다(06_pipeline/07 판정).

| 반복 | 시도 시각(api 정지 뒤 ms) | 간격(ms) | 재연결(api 기동 뒤 ms) | 재연결 뒤 REST | 값 대조(태그 · 여유 ms) | AC-10 |
|------|------|------|------|------|------|------|
| 1 | 1,031 · 3,034 · 7,037 · 15,041 · 31,044 · 61,048 · 89,019(열림) | 2,001 · 4,002 · 8,003 · 16,002 · 30,003 · 27,969 | 13,207 | 1건 · 200 | 50/50 · 1,860 | 성립 |
| 2 | 1,041 · 3,047 · 7,049 · 15,053 · 31,057 · 61,064 · 91,069(열림) | 2,002 · 4,001 · 8,003 · 16,003 · 30,004 · 30,004 | 15,163 | 1건 · 200 | 50/50 · 1,916 | 성립 |
| 3 | 1,037 · 3,040 · 7,042 · 15,045 · 31,049 · 61,053 · 91,058(열림) | 2,001 · 4,001 · 8,001 · 16,003 · 30,003 · 30,003 | 15,239 | 1건 · 200 | 50/50 · 1,812 | 성립 |

- **AC-10 성립 3/3 — 간격이 1 · 2 · 4 · 8 · 16초로 두 배씩 늘고 30초 상한에서 멈춘다 · 재연결 직후 REST 최신값 요청 1건 · 값 = rt:latest(50/50).**
- 실패한 시도는 전부 종료 코드 1006(연결 거부)이다. 첫 시도의 1초는 api 정지로 기존 연결이 닫힌 시각부터의 백오프다.

## 해석

- **캐시 정합성은 시간이 아니라 사건 순서로 성립한다.** 세 층의 첫 읽기가 모두 새 값인 것은 체인 ②③이 응답 전에 끝나고, ⑤가 쓰기 중계 안에서 걸리고, ⑥의 경합을 신선 창이 막기 때문이다. 원본 설계(⑤ · ⑥ 없음)였다면 BFF 층과 다른 탭 층은 revalidate 30초 · staleTime 30초만큼 옛 값을 보였을 것이다(보정 7.4의 근거).
- **재연결은 동기화 한 번으로 끝난다.** 재연결 open → 구독 → syncEpoch 증가 → REST 1회 순서가 지켜져 REST가 두 번 이상 나가지 않았고, 응답 값은 rt:latest 그대로다.
- 한계 — AC-06은 태그명 변경 한 종류만 본다. 설비 목록(cache:devlist) 신호 · 접속 설정 교체(③만)는 통합 확인(S4 W5)에서 동작만 보았고 이 기록의 판정이 아니다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 구조 판정 없음.
- **AC-10 반복 1의 마지막 간격이 27,969 ms로 상한 30,000 ms보다 짧다.** 반복 2 · 3은 30,004 · 30,003 ms로 재현되지 않았다. 앞선 간격 다섯은 세 반복 모두 계약값(2 · 4 · 8 · 16 · 30초 ± 4 ms)과 같다. 원인은 미확인이다 — 상한을 넘은 간격은 없으므로 "상한에서 멈춘다"는 성립으로 둔다.
- **AC-10 호출에는 기준선이 없다.** api를 멈추는 호출이라 AC-01 계수(정지 로그 points_emitted)를 깨므로 본 호출과 나눴고, 구조 판정이라 유휴 바닥 칸을 두지 않았다.
- **판정 창 끝 시각은 원시 파일 수정 시각이다.** AC-10 원시 줄에 벽시계 시각 필드가 없어 마지막 줄을 쓴 시각(파일 mtime 09:03:10Z)을 창 끝으로 적는다. 러너에 시각 필드를 더하는 것은 다음 단계 러너 보정이다.
- **기준선이 현행 참고 5분보다 짧다(240초).** 도구 호출 한 번이 10분을 넘지 않게 줄였다 — 기록 016과 같은 사유다.

## 정본 반영

- 01_overview/05 S4 합격 판정 — AC-06 · AC-10의 S4 성립 근거로 인용한다.
- 03_requirements/14 AC-06 · AC-10 · 회귀 AC(01 · 02 · 04 · 05 · 07 · 19)의 S4 성립 근거로 인용한다.
- 06_pipeline/07 · 08_screen/01 §무효화 신호 수신 — ⑥이 ⑤를 앞지르는 경합과 신선 창 판정(S4 검수 M5)을 올린다.

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "021",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-25T08:39:09.000Z", "end": "2026-09-25T09:03:10.000Z" },
  "run": { "commitHash": "3e8a46d", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S4", "tierConfig": "device5-tag50-250pps", "signalProfile": "SINE", "snapshot": "s3-empty-s", "baselineS": { "main": 240, "ac10": 0 }, "warmupS": 20, "windowS": 150, "ac10DownS": 75, "browser": "headless chromium (playwright-core 1.62.1)", "web": "next build 3e8a46d", "image": "db_study-api:3e8a46d", "clickhouseVersion": "26.8.10.6" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "ac01_diff", "arm": "default", "unit": "rows", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac01_tag_raw_rows", "arm": "default", "unit": "rows", "values": [45100, 45000, 45050], "median": 45050 },
    { "metric": "ac02_duplicate_combos", "arm": "default", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-timeseries", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac04_diff_ms", "arm": "default-latest", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac05_mismatch_total", "arm": "default", "unit": "buckets", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac07_mismatched", "arm": "default", "unit": "tags", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_lag_max", "arm": "default", "unit": "entries", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac19_pending_max", "arm": "default", "unit": "entries", "values": [5, 6, 7], "median": 6 },
    { "metric": "ac06_pass", "arm": "default", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac06_dict_reload_after_write_ms", "arm": "default", "unit": "ms", "values": [32, 34, 30], "median": 32 },
    { "metric": "ac06_other_tab_signal_after_write_ms", "arm": "default", "unit": "ms", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac10_pass", "arm": "ac10", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac10_rest_after_reconnect", "arm": "ac10", "unit": "count", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac10_last_gap_ms", "arm": "ac10", "unit": "ms", "values": [27969, 30004, 30003], "median": 30003 },
    { "metric": "ac10_reconnect_after_start_ms", "arm": "ac10", "unit": "ms", "values": [13207, 15163, 15239], "median": 15163 },
    { "metric": "ac10_values_match", "arm": "ac10", "unit": "tags", "values": [50, 50, 50], "median": 50 }
  ]
}
```
