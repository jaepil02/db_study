# 014 — S2 구조 판정 회귀(AC-17 육안 판정 · 커밋 트리 3회): 수직 슬라이스 실시간 화면 성립

> 실험: EXP-29 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-09-24T17:49:18Z ~ 18:01:18Z(반복 3회)

기록 010은 AC-17을 커밋 전 작업 트리의 육안 관찰 1회로만 가졌다(010 §폐기 · 예외). 이 기록은 같은 판정을 커밋 d32b09a의 이미지와 같은 커밋의 웹으로 3회 다시 잰다. 사람의 눈 대신 헤드리스 Chromium이 여섯 조건을 기계로 대조하고, 반복마다 두 장의 스크린샷을 남긴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | d32b09a(api 이미지 db_study-api:d32b09a · health run.commitHash) · 웹은 같은 커밋의 apps/web을 호스트에서 빌드 · next start(127.0.0.1:3001) |
| 이미지 구성 | db_study-api:fe64472 이미지 위에 d32b09a의 깨끗한 트리에서 호스트(Node 22.23.3)가 컴파일한 dist를 덮고 ENV COMMIT_HASH=d32b09a를 준 이미지(ID sha256:d61fe9c2afef38348435a017b379b4097bec93d6edbed1686e89f847f6ce4c40) — 기록 012 · 013과 같은 이미지다(§폐기 · 예외) |
| 프로파일 · 상한 | 부하 실험 · api 컨테이너 상한 2048 MB |
| 용량 티어 | S(수직 슬라이스 — 설비 1 · 태그 8 부분 구성 · 04_architecture/07) |
| 스위치 | 전부 기본값(전수는 기계 판독 블록) — 3회 모두 health switches가 같다 |
| 주입 모드 · 시드 · 신호 프로파일 | A · 42 · SINE |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 따로 재지 않음(기록 010과 같은 사유 — 모드 A 생성기는 api 안 레지스터 갱신) · 표준(api 0-4 · 웹 · 브라우저는 호스트 프로세스) |
| 압축 · swap · 네트워킹 · SIM 계획 | zstd · 사용 없음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 초기 상태 · 기준선 · 워밍업 | 반복마다 스냅샷 s2-empty-slice 복원 · 300초(api 없이 저장소 유휴) · 20초 |
| 대조 | 페이지 로드 8초 뒤 촬영 t0 → 10초 뒤 촬영 t10 |
| 반복 · 편차 | 3회 · 구조 판정이라 편차 폐기를 적용하지 않는다 |
| 스크립트 | scripts/lab/s2/ac17-rep.sh · scripts/lab/s2/ac17-capture.cjs(playwright-core · 헤드리스 Chromium) · 원시 docs/measurements/raw/014-regression-stage-s2.jsonl · 스크린샷 docs/measurements/raw/014-shots/ |

AC-17 합격 기준("차트에 새 점이 연속으로 그려지고 최신값 표가 갱신된다")을 기계가 볼 수 있는 여섯 조건으로 옮긴다.

| # | 조건 | 무엇으로 보나 | AC-17 문구 대응 |
|:--:|------|------|------|
| ① | 최신값 표 8행 | 첫 표 tbody 행 수 t0 · t10 | 태그 8 |
| ② | 8행 모두 10초 사이 측정 시각 갱신 | 행별 KST 시각 t10 > t0 | 최신값 표가 갱신된다 |
| ③ | 트렌드 캔버스에 그림이 있다 | 불투명 픽셀 수 > 0(t0 · t10) | 차트가 그려진다 |
| ④ | 두 촬영 사이 캔버스가 바뀐다 | 픽셀 해시 t0 ≠ t10 | 새 점이 연속으로 그려진다 |
| ⑤ | WebSocket 연결 | 셸 표시 "WS 연결" | 실시간(REST 폴링이 아니다) |
| ⑥ | 페이지 오류 0 | pageerror 이벤트 수 | 화면이 정상 동작 |

- 검산: 조건 = **6**
- **④는 "새 점"을 픽셀 변화로 본다.** x축이 서버 현재 기준으로 5분 창을 밀기 때문에 새 점이 없어도 축은 움직인다 — 그래서 ④만으로 새 점을 단정하지 않고 ②(값 갱신)와 ⑤(WS 수신)를 함께 성립 조건에 둔다. 스크린샷 두 장이 사람의 확인 자리다.

## 결과

| 반복 | ① 행 | ② 갱신 행 | ③ 불투명 픽셀 t0 · t10 | ④ 해시 변화 | ⑤ WS | ⑥ 오류 | 판정 |
|:--:|:--:|:--:|------|:--:|:--:|:--:|:--:|
| 1 | 8 · 8 | 8 | 28,835 · 29,351 | 예 | 연결 | 0 | 성립 |
| 2 | 8 · 8 | 8 | 28,807 · 29,375 | 예 | 연결 | 0 | 성립 |
| 3 | 8 · 8 | 8 | 26,816 · 27,315 | 예 | 연결 | 0 | 성립 |

- AC-17 성립 3/3.
- 태그 1 행의 예 — 반복 1 44.775(02:49:18 KST) → 42.863(02:49:28 KST) · 반복 2 40.469(02:55:13) → 43.003(02:55:23) · 반복 3 25.645(03:01:08) → 28.393(03:01:18). 품질은 전부 SIMULATED(9)다.
- 불투명 픽셀이 t0 → t10에 반복마다 약 500 늘었다 — 10초 동안 8태그 × 10점이 창 오른쪽에 더해진 폭이다.

## 해석

- **AC-17이 커밋 트리에서 3회 성립했다.** 기록 010의 AC-01 · 04 · 07(fe64472)과 이 기록의 AC-17(d32b09a)이 S2 합격 판정 ①의 근거가 된다. 두 커밋의 차이는 Collector 시작 위상뿐이라(06_pipeline/02) 화면 경로(최신값 REST · WS · 시계열 채움)는 같은 코드다.
- **표 갱신 10초 사이 값이 1 Hz로 바뀐다.** 측정 시각이 정확히 10초 앞서는 것은 폴링 주기 1,000 ms와 WS 1 프레임/초(스로틀 100 ms 창 안 병합)가 화면까지 이어졌다는 뜻이다.

## 폐기 · 예외

- 폐기한 반복 없음 · 불성립 없음.
- **이미지 예외** — Docker Desktop의 레지스트리 프록시가 기반 이미지 메타데이터를 받지 못해(pull 무한 대기 · Docker Desktop 재시작 뒤에도 같음) 정식 빌드가 불가했다. 이 기록의 api 이미지는 기록 012 · 013과 같은 덮어쓰기 이미지다(조건 표). fe64472 → d32b09a 변경은 apps/api/src/modules/collector 두 파일과 테스트뿐이고 잠금 파일이 같아 실행 코드는 d32b09a의 것이다. commitHash는 빌드 인자가 아니라 ENV로 준 값이다 — 레지스트리가 복구되면 정식 빌드 이미지로 한 번 더 재서 이 예외를 닫는다.
- **러너는 미커밋 판이다** — ac17-rep.sh · ac17-capture.cjs는 이 기록과 같은 커밋에 들어간다. 러너의 미커밋 검사는 이미지 · 웹 빌드에 들어가는 경로만 보며, 그 경로는 d32b09a와 같았다(웹 테스트 파일 apps/web/test · package.json의 test 스크립트는 빌드 산출물에 들어가지 않아 검사에서 뺐다).
- 기록 010 §폐기 · 예외의 커밋 전 트리 관찰 1회는 이 기록으로 대체된다 — 010을 고치지 않는다(REQ-TEC-11).

## 정본 반영

- 01_overview/05 S2 합격 불릿 ①이 이 기록을 인용한다(반영은 이 기록과 같은 문서 커밋).

## 기계 판독 블록

```json
{
  "schema": "measurement/v1",
  "record": "014",
  "exp": ["EXP-29"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-09-24T17:49:18.000Z", "end": "2026-09-24T18:01:18.000Z" },
  "run": { "commitHash": "d32b09a", "memoryProfile": "load", "memoryLimitMb": 2048, "capacityTier": "S" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "off", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "A", "observability": "off", "cpuset": "standard", "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": null, "simFaultPlan": null, "stage": "S2", "slice": "device1-tag8", "signalProfile": "SINE", "snapshot": "s2-empty-slice", "baselineS": 300, "warmupS": 20, "observeS": 10, "image": "fe64472+d32b09a-dist", "imageId": "sha256:d61fe9c2afef38348435a017b379b4097bec93d6edbed1686e89f847f6ce4c40", "distCompiledWith": "node 22.23.3", "browser": "headless chromium (playwright-core)" },
  "repeat": { "runs": 3, "deviation": 0, "threshold": 0.2 },
  "results": [
    { "metric": "ac17_rows", "arm": "AC-17", "unit": "rows", "values": [8, 8, 8], "median": 8 },
    { "metric": "ac17_rows_updated", "arm": "AC-17", "unit": "rows", "values": [8, 8, 8], "median": 8 },
    { "metric": "ac17_canvas_ink_t10", "arm": "AC-17", "unit": "pixels", "values": [29351, 29375, 27315], "median": 29351 },
    { "metric": "ac17_canvas_changed", "arm": "AC-17", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac17_ws_connected", "arm": "AC-17", "unit": "bool", "values": [1, 1, 1], "median": 1 },
    { "metric": "ac17_page_errors", "arm": "AC-17", "unit": "count", "values": [0, 0, 0], "median": 0 },
    { "metric": "ac17_pass", "arm": "AC-17", "unit": "bool", "values": [1, 1, 1], "median": 1 }
  ]
}
```
