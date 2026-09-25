# TSQ — 시계열 표면 (05_timeseries)

> **대상**: TSQ 도메인 표면 — 시계열 조회(POST /api/v1/timeseries/query) 요청 스키마 · 해상도 규칙의 표면 모양 · meta · points 열 구성 · 다운샘플 모드 · 진행 구간 분할의 호출 모양 · 원시 내보내기 스트림 · **내보내기 스트림 중단 종료 표지 판정** · 태그 상한 · 최대 포인트 수(2계층 소유)
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S3 구현 반영 — §S2 단계 표면 tagName · unit 행 null → **S3에서 계약으로 복귀**(dictGet(plc.dict_tag) · 사전 조회 실패 시 null · 응답은 성공)
> **개정일**: 2026-09-24 — S2 구현 반영 — §S2 단계 표면(as-built) 신설 — raw 고정 · 예상 포인트 초과 400(S4에서 상향으로) · tagName · unit null(S3 dict_tag) · 현재 버킷 TTL 구간 미도달
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 내보내기 범위 상한 미정 → **현행 참고 1일**(2계층 · 초과 400 reason range) · 등급 class export — 표면 수 불변(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 반영(정본 10_observability/01 · 06)
> **원천**: 원본 architecture.md §11 · §11.1 · §18(커밋 ff66a37) · 원본 data_flow.md §6 · §6.1 · §6.2 · §6.3 · §14.1 5단계(커밋 ff66a37) · REQ-TSQ-01~17 · ADR-25 · [../02_features/07_timeseries.md](../02_features/07_timeseries.md) TSQ-01~09 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 5단계 · docs_plan.md 웨이브 인계 W5 07_api 행(내보내기 스트림 중단 종료 표지)

TSQ 표면은 **요청한 것이 아니라 서버가 고른 것을 돌려주는 표면**이다. 해상도는 범위 길이와 최대 포인트 수로 서버가 정하고(보호 장치 — 원본 data_flow.md §6.1), 결과가 여전히 크면 LTTB로 줄인다. 요청이 무엇이었든 실제로 무엇을 받았는지는 meta가 말한다 — 그래서 이 문서는 meta를 계약의 중심에 둔다.

조회 경로 판정 트리 · 캐시 키 정규화 · TTL 구간 · 스탬피드의 기전 정본은 [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)이고, 이 문서는 그 기전이 **바깥에 드러나는 모양**만 적는다. 이 문서가 소유하는 2계층 조정값은 둘이다 — 태그 배열 상한(현행 참고 50)과 최대 포인트 수 기본값(현행 참고 2000)이다(REQ-TSQ-01 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) §미확인 등재).

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 브라우저 → api 직결 — 응답이 크고 사용자별이다 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 인가 | 조회 전원 · 내보내기 ENGINEER만(대량 스캔 읽기 예외) | REQ-TSQ-17 · 권한 매트릭스 TSQ |
| 레이트 리밋 | 조회 = 대량 조회 등급 · 내보내기 = 내보내기 등급 — 일반 등급보다 엄격 | 원본 architecture.md §18 · [01_conventions.md](./01_conventions.md) §한도 등급이 갈리는 표면 묶음 |
| 시각 | 요청 from · to = 오프셋 포함 ISO 8601 · 응답 points 첫 열 = epoch ms | [01_conventions.md](./01_conventions.md) §시각 직렬화 |
| ClickHouse 불가 | 캐시 히트 200 · 캐시 미스 · 내보내기 시작 전 timeseries.clickhouse_unavailable/503 · 대조군 · 최신값으로 대신 답하지 않는다 | REQ-TSQ-16 |
| Redis 불가 | 에러가 아니다 — ClickHouse 직행 200 · meta.cached false | REQ-TSQ-11 |
| PostgreSQL 불가 | 영향 없음 — Dictionary가 마지막 적재 값으로 태그명 · 단위를 붙인다 | REQ-TSQ-08 |
| 단계 | 조회 S2(raw 고정) · 해상도 · 캐시 · 내보내기 S4 · 인가 S7 | [../02_features/07_timeseries.md](../02_features/07_timeseries.md) |

- 검산: 항목 = **8**

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | POST | /api/v1/timeseries/query | TSQ-01 · 02 · 06 · 07 · 08 | 전원 | cache:q:{sha1} · lock:rebuild:q:{sha1} | common.validation_failed/400 · timeseries.too_many_tags/400 · timeseries.clickhouse_unavailable/503 | ANL-TREND · DSH-REALTIME · ALM-RULES | 원본 |
| 2 | GET | /api/v1/timeseries/export | TSQ-09 | ENGINEER | 없음 — 캐시하지 않는다 | common.validation_failed/400 · timeseries.too_many_tags/400 · timeseries.clickhouse_unavailable/503 | ANL-TREND | 원본 |

- 검산: 표면 = **2** · REST JSON 1 + 다운로드 스트림 1 = **2** · 원본 2 + 신설 0
- 표면 있는 기능 6(TSQ-01 · 02 · 06 · 07 · 08 · 09)이 두 표면에 앉는다 — 02 · 06 · 07 · 08은 #1의 동작이다. TSQ-03 · 04 · 05는 표면 없는 내부 단계다.

## #1 POST /api/v1/timeseries/query

### 요청

| 필드 | 타입 | 필수 | 규칙 | 위반 |
|------|------|:--:|------|------|
| tagIds | 정수 배열 | 예 | 1개 이상 · **상한 현행 참고 50**(2계층 · 소유 이 문서) · 중복 제거 후 센다 · 앞쪽 N개만 잘라 처리하지 않는다 | 상한 초과 timeseries.too_many_tags/400 · 그 밖 400 |
| from · to | 문자열 | 예 | 오프셋 포함 ISO 8601 · from < to | common.validation_failed/400 |
| interval | 문자열 | 아니오 | raw · 1m · 1h · 1d — 없으면 서버가 범위 길이로 고른다 | 400 |
| aggregations | 문자열 배열 | 아니오 | avg · min · max · last · p95 중 복수 · 기본 avg · 순서가 points 열 순서다 | 400 |
| maxPoints | 정수 | 아니오 | 기본 **현행 참고 2000**(2계층 · 소유 이 문서) · 1 이상 · 태그당 상한이다 | 400 |
| downsample | 문자열 | 아니오 | lttb(기본) · minmax — minmax는 극값 보존 | 400 |

- 검산: 필드 = **6** · 원본 5(원본 architecture.md §11.1) + 신설 1(downsample)
- **downsample을 더한 이유** — 극값을 보존하는 min · max 쌍은 알람 분석 화면의 요구다(REQ-TSQ-06 · 원본 data_flow.md §6.3). 서버가 호출 화면을 알 수 없으므로 요청이 모드를 말해야 한다. 기본값 lttb는 원본 기본 조합과 같아 요청 선택 필드 추가 규칙(기본값 = 기존 동작)을 지킨다.
- **존재하지 않는 tag_id는 거절하지 않는다.** 그 태그의 series가 빈 points로 나온다 — ClickHouse에는 tag_id만 있고 존재 확인을 위해 PostgreSQL을 읽으면 "PostgreSQL 중단 중에도 조회는 계속"(REQ-TSQ-08)이 깨진다. 비활성 태그도 같다 — 과거 구간이 그대로 조회된다.

### 서버가 요청을 바꾸는 자리

| 자리 | 요청 | 서버가 바꾸는 것 | 드러나는 곳 | 근거 |
|------|------|------|------|------|
| 해상도 선택 | interval 없음 | 범위 길이로 raw · 1m · 1h · 1d | meta.interval | REQ-TSQ-03 |
| 해상도 상향 | 예상 포인트 > maxPoints | 한 단계 올린다 — raw 지정도 같다 · **거절하지 않는다** | meta.interval ≠ 요청 interval | REQ-TSQ-04 |
| 범위 스냅 | from · to | 선택된 해상도의 버킷 경계로 내린다 — 1d는 KST 자정 | meta.from · meta.to | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) §캐시 키 정규화 |
| 2차 축소 | 1차 축소 뒤에도 초과 | LTTB 또는 minmax | meta.downsampled · meta.pointCount | REQ-TSQ-06 |

- 검산: 자리 = **4**
- **A형 — "raw로 요청했는데 1m이 왔다"는 버그가 아니다.** 통념은 요청한 해상도가 그대로 온다는 것이다. 부정 — 서버는 범위와 maxPoints로 해상도를 강제한다. 진짜 축은 ClickHouse 보호다. 대체 경로 — 원시가 꼭 필요하면 #2 내보내기로 받는다.
- **스냅한 범위가 곧 조회 범위다.** 응답의 meta.from · meta.to가 요청과 다를 수 있다 — 캐시 히트와 미스가 다른 범위의 결과를 내면 같은 화면이 새로고침마다 달라진다(기전 정본 인용).

### S2 단계 표면(as-built)

롤업 · Dictionary · 다운샘플이 없는 S2의 표면은 위 계약의 부분 집합이다. 바뀌는 자리는 셋이고, 각각 도입 단계에서 위 계약으로 돌아간다.

| 자리 | S2 동작 | 위 계약으로 돌아가는 단계 | 이유 |
|------|------|------|------|
| interval | raw만 받는다 — 다른 값은 400 common.validation_failed(body.interval · enum) | S4(해상도 선택) | 롤업이 없어 1m · 1h · 1d를 낼 원천이 없다 |
| 예상 포인트 > maxPoints | **거절한다** — 400 common.validation_failed(body.to · range) · 예상 포인트 = 범위 ÷ scan_rate_ms(시드 1,000 ms) | S4(상향 · LTTB) | 상향할 해상도도 축소 수단도 없다 — 조용히 자르면 부분 결과가 전체로 읽힌다 |
| series[].tagName · unit | null | **S3에서 복귀(as-built)** — 한 번의 dictGet(plc.dict_tag) 조회로 요청 태그 전부의 이름 · 단위를 붙인다 · 사전 조회가 실패하면 그 요청만 null로 두고 points는 그대로 낸다 | 메타를 붙이는 Dictionary가 S3에 생긴다 · 메타 실패로 시계열 전체를 5xx로 만들면 사전 재적재 중에 트렌드가 끊긴다 |

- 검산: 자리 = **3**
- **S2의 거절은 상향 계약의 임시 대체다.** 대시보드 채움(5분 × 1 Hz = 태그당 300포인트)은 걸리지 않는다. S4에서 거절 분기를 지우고 상향으로 바꾼다 — 그때 이 절을 지운다.
- raw 버킷(1분)은 최근 창(5분) 안에 들어 TTL 구간 "현재 버킷 포함"이 S2에서 나오지 않는다([../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) §TTL 구간 분류와 지터) — 캐시는 완전 과거 TTL만 쓴다.

### 응답

| 필드 | 타입 | 뜻 |
|------|------|------|
| meta.interval | 문자열 | 실제로 쓴 해상도 |
| meta.from · meta.to | 문자열(UTC ISO) | 스냅 뒤 실제 범위 |
| meta.columns | 문자열 배열 | points 열 이름 — 첫 열은 언제나 ts |
| meta.pointCount | 정수 | 다운샘플 뒤 반환 포인트 수(태그 합) |
| meta.downsampled | 불리언 | 2차 축소 여부 |
| meta.cached | 불리언 | 캐시 히트 여부(성능 디버깅용) |
| series[].tagId · tagName · unit | 정수 · 문자열 · 문자열 | Dictionary 메타 — 조회 시점 값 · 캐시 히트는 캐시된 시점의 이름이다 |
| series[].points | 배열의 배열 | 열 위치 고정 — meta.columns 순서 |

- 검산: 필드 행 = 원본 6(원본 data_flow.md §14.1) + 신설 2(meta.from · meta.to 행 · meta.columns 행) = **8** · 신설 필드 = from · to · columns = **3**
- **points 열 구성 규칙** — interval이 raw면 열은 [ts, value, quality]이고 aggregations를 적용하지 않는다(원시에는 집계가 없다). 롤업이면 [ts, 요청 aggregations 순서]다. p95는 TDigest **근사값**이다(REQ-TSQ-07).
- **minmax 모드의 열** — 롤업 해상도에서 min · max를 요청 aggregations에 없더라도 싣는다. 인접 버킷을 묶어 묶음마다 min의 최솟값 · max의 최댓값을 내므로 단순 n번째 추출처럼 스파이크를 잃지 않는다.

응답 예시다(3일 범위 · interval 미지정 → 1m 선택 → LTTB).

```json
{
  "meta": {
    "interval": "1m",
    "from": "2026-09-21T00:00:00.000Z",
    "to": "2026-09-24T00:00:00.000Z",
    "columns": ["ts", "avg", "min", "max"],
    "pointCount": 4000,
    "downsampled": true,
    "cached": false
  },
  "series": [
    { "tagId": 3401, "tagName": "반응기 온도", "unit": "°C",
      "points": [[1758412800000, 72.41, 71.9, 73.02], [1758412860000, 72.44, 72.0, 72.97]] },
    { "tagId": 3402, "tagName": "반응기 압력", "unit": "kPa", "points": [] }
  ]
}
```

- **빈 points는 "그 구간에 행이 없다"다.** 존재하지 않는 tag_id · 수집 전 구간 · DROPOUT 결측이 모두 여기 든다 — 결측을 0이나 null 행으로 채우지 않는다([01_conventions.md](./01_conventions.md) §수치 직렬화).
- ts는 epoch ms다 — 1m 버킷 시작 시각(초 정밀도 DateTime)을 × 1000 해서 낸다.

### 진행 구간 분할의 호출 모양

"최근 N분 · N시간"처럼 끝이 현재인 조회는 서버가 합치지 않는다(REQ-TSQ-13 · 기전 정본 §진행 구간 분할). 표면을 따로 두지 않고 **호출 두 번으로** 표현한다.

| 조각 | 호출 | 캐시 | 실패가 번지는 범위 |
|------|------|------|------|
| 확정 과거 | #1 — to = 현재 버킷 시작 | 완전 과거 TTL(현행 참고 300초 + 지터) | 이 조각만 |
| 진행 버킷 | [06_realtime.md](./06_realtime.md) #1 최신값 또는 #1 — from = 현재 버킷 시작 | 최근 구간이면 캐시하지 않는다 | 이 조각만 — 최신값 503이 과거 추이를 지우지 않는다 |

- 검산: 조각 = **2**
- **진행 구간 분할 표면을 신설하지 않는다(판정).** 서버가 두 조각을 한 응답으로 합치면 한쪽 원천의 실패가 전체 실패가 되고, 합친 응답은 캐시 수명이 가장 짧은 조각을 따라가야 해 과거 구간 캐시 이득이 사라진다.

### 실패와 계약 요약

| 사건 | 응답 | 관련 REQ | 흐름 |
|------|------|------|------|
| 태그 배열 상한 초과 | 400 timeseries.too_many_tags · details(limit · received) | REQ-TSQ-01 | F-04 |
| 허용값 밖 · 오프셋 없는 시각 · from ≥ to | 400 common.validation_failed | REQ-TSQ-02 | F-04 |
| 캐시 미스 · ClickHouse 불가 | 503 timeseries.clickhouse_unavailable | REQ-TSQ-16 | F-04 · F-10 |
| 캐시 계열 실패 · 락 실패 · 대기 소진 | 200 — 느려질 뿐 | REQ-TSQ-11 · 12 | F-04 |
| 대량 조회 등급 한도 초과(S7) | 429 common.rate_limited | REQ-TSQ-17 | F-04 |

- 검산: 사건 = **5**

## #2 GET /api/v1/timeseries/export

| 항목 | 계약 |
|------|------|
| 요청 | tagIds(쉼표 구분 정수 · 상한 #1과 같다) · from · to(오프셋 포함 ISO 8601) · format(csv · parquet · 기본 csv) |
| 범위 상한 | to − from(스냅 전 요청값) ≤ 현행 참고 **1일** — 2계층 · 소유 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) · 초과는 common.validation_failed/400 reason range · 잘라서 내보내지 않는다 |
| 응답 200 | 청크 스트림 · Content-Type text/csv 또는 application/vnd.apache.parquet · Content-Disposition attachment |
| 열 | ts(epoch ms) · device_id · tag_id · value · quality — tag_raw 원시 열 그대로 · ingested_at · scan_seq는 싣지 않는다 |
| 원천 | tag_raw — 해상도를 줄이지 않고 캐시하지 않는다 · ClickHouse FORMAT 응답을 그대로 중계 |
| 시작 전 실패 | 400 · 403(ENGINEER 밖) · 429(내보내기 등급) · 503 clickhouse_unavailable — 에러 봉투 |
| 도중 실패 | §내보내기 스트림 중단 종료 표지 판정 |
| 관련 REQ | REQ-TSQ-15 · 16 · 17 |
| 흐름 | F-04 |

- **GET인 이유** — 부수효과가 없고 브라우저가 링크로 파일을 받는다. 그러나 토큰을 쿼리에 싣지 않는다 — 화면은 Authorization 헤더를 실은 fetch로 받아 파일로 저장한다([01_conventions.md](./01_conventions.md) §인증 헤더).
- **태그명 · 단위를 싣지 않는다.** FORMAT 중계라 dictGet 열을 붙이면 원시 행마다 문자열이 반복돼 파일이 커진다. 메타는 [04_master.md](./04_master.md) #8로 따로 읽는다.
- ingested_at을 빼는 이유 — 내보내기의 목적은 측정값의 원시 분석이다. E2E 지연 분석은 ClickHouse 직접 SQL(OBS-04)의 몫이다.

### 내보내기 스트림 중단 종료 표지 판정

인계 "내보내기 스트림 중단 종료 표지"를 닫는다. **판정 — 본문에 표지를 넣지 않는다. 중단은 전송 계층의 비정상 종료(종결 청크 없음)로만 표현하고, 완결은 종결 청크로 표현한다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 끝에 표지 행 | 정상 끝이면 "#END rows=N" 같은 마지막 행 | CSV를 그대로 읽는 도구가 표지 행을 데이터로 적재한다 · Parquet은 파일 형식상 행을 끼울 자리가 없다 | 버림 |
| ② HTTP 트레일러 | 끝에 트레일러 헤더로 행 수 · 상태 | 브라우저 fetch가 트레일러를 노출하지 않아 화면이 읽지 못한다 | 버림 |
| ③ 중단 시 에러 행 | 도중 실패면 에러 봉투를 본문에 이어 붙인다 | CSV 파일 중간에 JSON이 섞인 채 "성공"으로 저장된다 | 버림 |
| ④ **전송 계층 종료** | 도중 실패면 종결 청크를 보내지 않고 연결을 끊는다 | 표지로 원인을 알 수 없다 — 원인은 api 로그 · 계수가 갖는다 | **채택** |

- 검산: 안 = **4**
- **B형 — 끊긴 다운로드가 "오류 코드 없음"으로 끝나는 것은 누락이 아니다.** 결론 — 상태 줄 200이 이미 나간 뒤라 어떤 코드도 보낼 수 없다(REQ-TSQ-15 계열 판정). 반대 시나리오 — 표지를 본문에 넣으면 정상 파일의 형식이 깨지고, 표지를 못 본 도구는 잘린 파일을 완전한 것으로 적재한다. 파생 지침 — 클라이언트는 **종결 청크 수신 여부**로 완결을 판정한다. fetch 스트림 읽기가 오류로 끝나면 불완전 파일이다. Parquet은 꼬리(footer)가 없으면 파일 자체가 열리지 않아 이중으로 드러난다.
- 도중 중단은 계수한다(tsq_export_aborted_total — [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)). 잘린 CSV의 행 수 대조는 사람이 ClickHouse 직접 count로 한다([../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) 판정).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 태그 배열 상한 · 최대 포인트 수 | 2계층 · 현행 참고 50 · 2000 — 소유 이 문서 · 실측 조정은 S4 | 이 문서 |
| 내보내기 범위 상한 · 등급별 한도 | **W7 닫힘** — 범위 상한 현행 참고 1일 · class export(≤ bulk_read 한도) · 한도 값 2계층 미정 | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| 조회 p95 · 히트율 | 3계층 미확인 — 원본 목표 히트 20 ms · 미스 300 ms · 80% | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-08 · 10 |
| COUNTER 랩어라운드 구간 증가량 | 조회 시점 몫 — 이 표면은 max − min을 계산하지 않는다 · 증가량 집계 요청 필드 없음 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §생산 카운터 기전 판정 |
| 내보내기 중단 계수 이름 | **W6 판정** — tsq_export_aborted_total | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 시각 직렬화 · 한도 등급 · 봉투
- [06_realtime.md](./06_realtime.md) — 진행 버킷 조각의 최신값
- [../02_features/07_timeseries.md](../02_features/07_timeseries.md) — TSQ-01~09 기능 정본
- [../03_requirements/08_timeseries.md](../03_requirements/08_timeseries.md) — REQ-TSQ 계약
- [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) — 판정 트리 · 캐시 · 스탬피드 기전
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — 5단계 API 응답
- [../08_screen/04_trend_analysis.md](../08_screen/04_trend_analysis.md) — ANL-TREND 화면
