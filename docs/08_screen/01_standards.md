# 화면 명세 표준 (01_standards)

> **대상**: 08_screen 화면 명세 전부가 따르는 공통 규격 — 명세 템플릿 · 상태 4행 · 단계별 화면 가용성 · 요청 경로와 공통 셸 · 차트 표준(uPlot 주력 · ECharts 보조) · 시각 표시(Asia/Seoul) · 에러 코드별 사용자 표시 · TanStack Query staleTime과 Redis TTL 정렬 · 무효화 체인 ⑥단 신호 수신
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — staleTime · gcTime · 링 버퍼 창 현행값 확정(09_tech_stack/01 — 관계식 파생 staleTime · 시계열 gcTime 60초 · 링 버퍼 3,000슬롯) · 관계식 불변
> **원천**: 원본 tech_stack.md §4.1 · §4.2 · §4.3(커밋 ff66a37) · 원본 data_flow.md §5 · §6.2 · §6.3 · §7.2 · §9 · §9.2(커밋 ff66a37) · 원본 architecture.md §11 · §11.2(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · §7.4(커밋 ff66a37) · REQ-GLB · REQ-AUT-04 · 05 · REQ-RLT-03 · 06 · 13 · 15 · REQ-TSQ-05 · 10 · REQ-WRK-03 · AC-04 · AC-06 · [README.md](./README.md) 화면 인벤토리 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 무효화 체인 6단 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 표시 시간대

이 문서는 화면 문서 5본(03~07)이 인용하는 **공통 규격의 정본**이다. 화면 코드와 소속 파일의 정본은 [README.md](./README.md) 화면 인벤토리이고, 이 문서는 그 코드들이 지켜야 할 명세 모양 · 상태 표시 · 시각 · 에러 · 캐시 규칙을 고정한다. 개별 화면이 표준과 다르게 처리하면 그 화면 블록의 비고에 사유를 적는다.

**화면은 데이터를 소유하지 않는다.** 모든 수치는 07_api 표면을 거쳐 오고, 화면 명세는 어느 표면을 어떤 빈도로 부르는지와 그 응답을 어느 캐시 층이 얼마 동안 들고 있는지를 고정한다. 표면은 **메서드 + 경로**로 인용한다. 원본에 없는 표면은 07_api 해당 파일의 확정을 기다리며 "07_api/{파일} 확정 대기"로 적는다.

**이 문서가 닫는 인계 1건** — 무효화 체인 ⑥단의 신호 키 → 브라우저 쿼리 키 대응([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 미확인 등재)을 §무효화 신호 수신에서 고정한다. staleTime의 라이브러리 설정값은 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)가 갖고, 이 문서는 값이 따라야 할 관계식을 갖는다.

## 화면 명세 템플릿

화면 하나 = H2 하나다. H2 제목은 "{화면 코드} — {화면명}"이고 아래 필드를 이 순서로 둔다.

| 필드 | 내용 | 비워 두면 |
|------|------|------|
| 메타 표 | 화면 코드 · 웹 경로 · 페르소나 · 역할(S7 이후) · 도입 단계 · 요청 경로(BFF 경유 · 직결) | 화면이 어느 단계에 생기고 누가 쓰는지 몰라 S2~S6 무인증 구간의 화면이 권한 검사를 기대한다 |
| 목적 | 페르소나가 이 화면에서 답을 얻는 질문 한 문장 | 요소가 목적 없이 늘어난다 |
| 진입 | 진입 경로와 진입 파라미터(설비 · 태그 · 범위) | 딥링크가 어떤 상태로 열리는지 정해지지 않는다 |
| 레이아웃 | plain 펜스 와이어프레임 1개 | 요소 표의 위치 열이 가리킬 자리가 없다 |
| 요소 표 | 요소 · 위치 · 동작 · 기능 ID · 표면 | 기능 → 화면 추적([02_traceability.md](./02_traceability.md))의 근거가 끊긴다 |
| 상태 4행 | 로딩 · 빈 값 · 오류 · 정상 — §상태 4행 | 실패가 빈 화면으로 보여 결함과 설계 동작을 가를 수 없다 |
| 호출 표면 | 메서드 + 경로 · 호출 시점 · 경로 · 응답에서 쓰는 필드 | 화면이 표면에 없는 필드를 기대한다 |
| 갱신 주기 | 폴링 · WebSocket 프레임 · 수동 · 신호 무효화 중 무엇으로 새 값을 얻는가 | 화면이 스스로 낡는다 |
| 캐시 층 | 브라우저 쿼리 캐시 · BFF 서버 fetch 캐시 · Redis · Dictionary 중 응답이 지나는 층과 staleTime | 옛 값이 보일 때 어느 층의 창인지 가를 수 없다 |
| 스위치 영향 | 이 화면의 표시가 달라지는 SW-NN과 그때 보이는 것 | 실험 중 화면 변화가 버그로 신고된다 |
| 비고 | 표준과 다른 처리 · 확정 대기 자리 | 해당 없음 |

- 검산: 필드 = **11**
- **요소 표의 기능 ID 열이 추적성의 정본 자리다.** [02_traceability.md](./02_traceability.md)는 이 열을 모아 세며, 요소 표에 없는 기능을 화면에 매핑하지 않는다.
- 레이아웃 펜스는 plain 와이어프레임이다. 픽셀 · 색 · 간격은 화면 명세가 아니라 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)의 구성 선택을 따른다.

화면 블록의 골격이다.

```plain
## {화면 코드} — {화면명}
├── 메타 표          코드 · 경로 · 페르소나 · 역할 · 단계 · 요청 경로
├── 목적 · 진입      한 문장 · 진입 파라미터
├── 레이아웃         plain 와이어프레임
├── 요소 표          요소 · 위치 · 동작 · 기능 ID · 표면
├── 상태 4행         로딩 · 빈 값 · 오류 · 정상
├── 호출 표면        메서드 + 경로 · 시점 · 경로 · 쓰는 필드
├── 갱신 · 캐시      주기 · 층 · staleTime 관계
└── 스위치 영향      SW-NN별 표시 변화          ← 없으면 "해당 없음" 행 하나
```

- **요소 표와 호출 표면 표는 같은 표면을 두 방향에서 본다.** 요소 표는 사람이 누르는 것에서, 호출 표면 표는 네트워크에서 출발한다 — 한쪽에만 있는 표면은 화면이 부르지 않는 표면이거나 버튼 없는 호출이다.
- **화면 안의 하위 영역은 H3로 나누지 않고 요소 표의 위치 열로 가른다** — H3는 명세 필드 묶음(요소 · 상태 4행 · 호출 표면 등)에만 쓴다. 화면 코드로 시작하는 H2 하나에 화면 하나가 대응해야 [02_traceability.md](./02_traceability.md)의 화면 수 검산이 문서 구조로 확인된다.

## 상태 4행

모든 화면 블록은 아래 4행을 갖는다. 행을 빼거나 합치지 않는다 — 해당 없는 행은 "해당 없음"과 그 이유를 적는다.

| 상태 | 반드시 적을 것 | 금지 |
|------|------|------|
| 로딩 | 첫 페인트에 무엇이 먼저 보이는가 · 스켈레톤 영역 · 이전 값 유지 여부 | 표 전체를 스피너 하나로 가리기 — 부분 응답(최신값은 왔고 트렌드는 안 온 상태)을 볼 수 없게 된다 |
| 빈 값 | **빈 사실의 종류를 가른다** — 조건 결과 0 · 측정값 아직 없음(200 빈 목록) · 기능 미도입 단계 | "데이터 없음" 한 문구로 셋을 묶기 — 신규 설비의 빈 목록이 장애로 읽힌다 |
| 오류 | 받는 에러 코드 목록 · 코드별 표시는 §에러 코드별 사용자 표시를 인용 · 오류 중 기존 값의 처리 | 코드 없는 일반 오류 문구 · 오류 중 기존 값을 지워 빈 화면 만들기 |
| 정상 | 값이 무엇을 기준으로 신선한가(ts · 캐시 여부 · 해상도) · 사용자가 판단할 표지 | 신선도 표지 없이 값만 표시 — STALE · 다운샘플 · 캐시 히트가 정상 응답 안에 섞여 있다 |

- 검산: 상태 = **4**
- **200 응답 안의 경고를 오류 행이 아니라 정상 행에 적는다.** STALE 품질 · meta.downsampled · meta.cached · 비운 메타는 에러가 아니라 보정이다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §에러 코드가 아닌 것). 오류 행에 두면 화면이 보정을 실패로 그려 운영자가 정상 값을 의심한다.
- 권한 거부(403)는 오류 행 안에 적는다. 인증 부재(401)는 화면이 아니라 공통 셸이 처리한다 — §에러 코드별 사용자 표시.

## 단계별 화면 가용성

화면은 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))에 따라 열린다. **S7 이전에는 인증이 없어 역할 열이 적용되지 않는다**(REQ-AUT-16).

| 단계 | 열리는 화면 | 인증 · 역할 | 화면이 전제하는 것 |
|------|------|------|------|
| S2 | DSH-REALTIME(최소 1페이지 — uPlot 차트 1 · 최신값 표) · EXP-CONSOLE(스위치 상태 · health) | 없음 | 설비 1 · 태그 8 · raw 고정 조회 · SW-02 · SW-03만 노출 |
| S3 | 상동 | 없음 | 롤업 · 멱등 · 대조군 적재 스위치가 상태에 더해진다 |
| S4 | + ANL-TREND · ADM-MASTER · EXP-COMPARE | 없음 | 해상도 자동 선택 · 캐시 · 무효화 체인 ⑥ · 재연결 동기화 |
| S5 · S6 | 상동 | 없음 | 부하 · 장애 실험의 관찰 — 콘솔 메트릭 요약이 주 화면이 된다 |
| S7 | + AUTH-LOGIN · ALM-CONSOLE · ALM-RULES · ADM-WORKORDER · ADM-AUDIT | 있음 — 역할 판정 적용 | 알람 · 작업지시 · 감사 · 역할 기반 버튼 활성 |

- 검산: 화면 = S2 2 + S4 3 + S7 5 = **10** — 인벤토리 선점 수와 같다
- **S2~S6의 화면에 권한 거부 행이 없는 것은 결함이 아니다.** 인증을 늦게 넣은 것은 학습 순서의 결과이며(D-07) 그 구간의 표면은 127.0.0.1 바인드 안에 있다. S7에서 역할 판정이 붙으면 같은 화면의 오류 행에 403이 더해진다.
- **S7 전후의 화면 체감 지연은 같은 스위치 상태라도 다른 조건이다.** 인증 · 인가 비용이 요청 경로에 더해진다 — 화면 관찰로 얻은 인상을 S7 전 측정 기록과 비교하지 않는다.

## 요청 경로와 공통 셸

같은 웹 화면이라도 요청 성격에 따라 경로가 둘로 갈린다. 기준의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)이고 이 표는 화면별 적용이다.

| 요청 | 경로 | 이 문서군의 화면 | BFF 서버 fetch 캐시 |
|------|------|------|------|
| 로그인 · 토큰 갱신 · 로그아웃 | 브라우저 → BFF → api | AUTH-LOGIN · 공통 셸 | 없음 |
| 사이트 · 라인 · 설비 · 태그 목록과 마스터 쓰기 | 브라우저 → BFF → api | ADM-MASTER · 설비 선택기(DSH · ANL · ALM-RULES) | 있음 — 쓰기 성공 시 체인 ⑤ |
| 작업지시 · 실적 · 알람 규칙 · 알람 이벤트 · 감사 | 브라우저 → BFF → api | ADM-WORKORDER · ALM-RULES · ALM-CONSOLE · ADM-AUDIT | **no-store** |
| 최신값 | 브라우저 → api 직결 | DSH-REALTIME | 해당 없음 |
| 시계열 조회 · 내보내기 · 판정 이력 분석 | 브라우저 → api 직결 | ANL-TREND · DSH-REALTIME · ALM-RULES | 해당 없음 |
| WebSocket | 브라우저 → api 직결 | DSH-REALTIME · ALM-CONSOLE · 공통 셸(신호 수신) | 해당 없음 |
| health · metrics(화면) | 브라우저 → BFF → api · 메트릭 텍스트 해석은 BFF가 한다 | EXP-CONSOLE · EXP-COMPARE · 공통 셸(실험 조건 배지) | 없음 |

- 검산: 요청 유형 = **7** · BFF 경유 4 + 직결 3
- **알람 이벤트 · 확인 · 규칙은 BFF no-store다**(배정 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) §BFF 경유와 직결). 확인 직후 목록이 BFF 캐시의 옛 목록이면 확인한 알람이 미확인으로 남아 운영자가 두 번 누른다 — 작업지시 no-store와 같은 read-your-writes 요구다. 실시간 표시는 WebSocket 알람 푸시가 맡는다.
- **health · metrics는 기계 호출에는 공개 직결이지만 화면은 BFF로 읽는다.** 브라우저가 Prometheus 텍스트 전체를 받아 파싱하지 않게 BFF가 해석한 결과만 내린다 — 같은 표면을 두 경로로 부르는 것은 호출 주체가 다르기 때문이다.
- **키셋 커서 목록은 "더 보기"로 이어 읽고 전체 건수를 표시하지 않는다.** 대상 표면(알람 이벤트 · 작업지시 · 실적 · 감사)은 전체 건수를 내지 않는다 — count가 범위 안 월 파티션 전부를 훑기 때문이다(07_api/01 §페이지네이션). 화면이 건수를 보이려고 전부 이어 읽으면 같은 비용을 브라우저가 대신 일으킨다.
- 판정 이력 분석은 alarm_eval 대량 스캔이라 시계열 조회와 같은 직결 경로에 둔다 — 응답이 크고 사용자별이라 BFF 중계 · 캐시 이득이 없다(원본 data_flow.md §7.2의 시계열 조회 근거).

공통 셸은 화면 코드가 아니다 — 모든 화면을 감싸는 머리 영역이며 기능 매핑에서 "공통"으로 센다([02_traceability.md](./02_traceability.md)).

```plain
┌────────────────────────────────────────────────────────────────────────┐
│ db_study │ 실시간 · 트렌드 · 알람 · 관리 · 실험 │ [실험 조건 배지] [WS ●] [사용자 ▾ 로그아웃] │
└────────────────────────────────────────────────────────────────────────┘
  실험 조건 배지 — 기본값과 다른 스위치 수 · 클릭하면 EXP-CONSOLE
  WS ●           — 연결 · 재연결 중(다음 시도까지 초) · 끊김 3상태
  사용자 메뉴     — S7부터 · 역할 표시는 로그인 응답 user.roles · 로그아웃은 BFF 경유 POST /api/v1/auth/logout
```

- **실험 조건 배지는 health 한 번으로 그린다.** 셸이 진입 시 BFF 경유 GET /api/v1/health를 1회 부르고 기본값과 다른 스위치를 센다. 배지가 없으면 SW-02 off 구성에서 대시보드가 느린 것을 운영자 관점으로 보고 결함으로 신고한다 — 이 시스템에서 "느리다"의 대부분은 스위치 하나로 설명된다([../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md)).
- **WebSocket 연결은 셸이 하나만 연다.** 화면마다 연결을 열면 탭 하나가 연결 여럿을 가져 연결 수 메트릭이 사용자 수가 아니라 화면 전환 수를 센다. 구독 목록만 화면이 subscribe · unsubscribe 메시지로 바꾼다 — URL 쿼리 구독은 4400으로 닫힌다([../07_api/11_websocket.md](../07_api/11_websocket.md) §구독 방식 판정).

공통 셸의 요소 표다. 횡단 기능은 특정 화면이 아니라 셸이 받으므로 [02_traceability.md](./02_traceability.md)는 이 표를 "공통 셸" 행으로 센다.

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 인증 가드 | 전 화면 요청 | 401 unauthenticated · refresh_invalid면 AUTH-LOGIN으로 · token_expired는 BFF 갱신 1회 후 재전송 | AUT-04 | 인증이 필요한 전 표면 |
| 권한 표시 | 전 화면 버튼 · 제자리 안내 | 로그인 응답 user.roles로 버튼을 숨기거나 켜고 403은 제자리 안내 — 판정은 서버 Guard | AUT-05 | 인가 대상 전 표면 |
| 요청 한도 띠 | 화면 머리 | 429 Retry-After 카운트다운 · 자동 재조회 정지 | AUT-06 | 인증이 필요한 전 REST 표면 |
| 출처 방어 표시 | WS 표지 | Origin 거절로 연결이 닫히면 재연결하지 않고 끊김 표시 · CORS 거절은 서버 코드가 닿지 않아 표시 대상이 아니다 | AUT-07 | WS /ws/realtime · 직결 표면 |
| 무효화 신호 수신 | 보이지 않음 | ch:cacheinv 중계 신호로 §무효화 신호 수신의 쿼리 키를 무효화 | RLT-09 | WS /ws/realtime |
| 실험 조건 배지 · WS 표지 | 셸 머리 | 위 와이어프레임 설명 | OBS-06(표시) · RLT-07(표시) | GET /api/v1/health(BFF) · WS /ws/realtime |

- 검산: 요소 = **6** · 공통 셸을 주 자리로 세는 기능 = AUT-04 · 05 · 06 · 07 · RLT-09 = **5** — OBS-06 · RLT-07은 주 자리가 각각 EXP-CONSOLE · DSH-REALTIME이고 셸은 표시만 빌린다
- **공통 셸 요소는 화면 코드를 받지 않는다.** 셸에 코드를 주면 화면 수 10이 셸 하나 때문에 늘고, 셸이 없는 화면(없다)과 있는 화면을 가르는 뜻 없는 축이 생긴다 — 셸은 모든 화면의 머리이므로 화면이 아니라 레이아웃이다.

## 차트 표준

**서버 다운샘플이 1차 방어선이고 차트는 2차 방어선이다**(원본 tech_stack.md §4.2). 서버는 롤업 테이블로 1차 축소하고 여전히 많으면 LTTB로 2차 축소한다 — 브라우저는 받은 점을 그리기만 한다.

| 라이브러리 | 쓰는 화면 | 쓰는 이유 | 쓰지 않는 자리 |
|------|------|------|------|
| **uPlot**(주력) | DSH-REALTIME 실시간 트렌드 · ANL-TREND 시계열 | 초경량 Canvas · 시계열 특화 — 한 태그 수만 점을 즉시 그린다 | 범주 비교 · 막대 |
| ECharts(보조) | ALM-RULES 판정 분석(min · max 쌍 밴드 · 브러시) · EXP-COMPARE 비교 막대 · 역전 지점 선 | dataZoom · 브러시 · 풍부한 상호작용 — 점 수가 적은 분석 차트 | 실시간 스트림 — 갱신마다 옵션 병합 비용이 프레임을 먹는다 |

- 검산: 채택 라이브러리 = **2**
- **Recharts · Chart.js를 쓰지 않는다.** SVG 기반은 1만 점부터 DOM 노드가 폭증하고 Canvas 범용 차트는 10만 점에서 버벅인다(원본 tech_stack.md §4.2) — 두 번째 라이브러리 계열을 들이면 같은 화면에 렌더러가 둘이 된다.

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 클라이언트 재축소 금지 | 브라우저는 받은 점을 다시 줄이지 않는다 · 점 수가 차트 폭 대비 과하면 서버 계약 위반으로 표시한다 | meta.downsampled 거짓인 응답이 화면에서 줄어 "원시를 봤다"는 판단이 틀린다 |
| 요청 점 상한 | 조회 요청의 maxPoints는 플롯 영역 픽셀 폭 기준으로 정한다 · 값은 2계층(원본 참고 1,200픽셀 → 2,000점 · 소유 [../07_api/05_timeseries.md](../07_api/05_timeseries.md)) | 폭보다 많이 받으면 시각적으로 무의미한 점이 응답 크기와 캐시 메모리만 키운다 |
| 실시간 링 버퍼 | WebSocket 프레임은 태그별 고정 길이 링 버퍼(Zustand 스토어)에 쌓고 uPlot에는 버퍼 참조를 넘긴다 · 버퍼 창 길이는 2계층(계약 이 문서 · 현행값 3,000슬롯 — [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) W6 판정 · S2 고정) | 프레임마다 배열을 새로 만들면 초당 10프레임에서 GC가 트렌드를 끊는다 |
| 이어 그리기 기준 | 같은 태그의 점은 ts 오름차순으로만 붙인다 · 기존 마지막 ts 이하인 프레임 값은 버린다 | 재연결 동기화 값과 늦은 프레임이 섞여 선이 뒤로 꺾인다 |
| 극값 보존 | 알람 분석 차트는 버킷의 min · max 쌍을 밴드로 그린다 · 평균선만 그리지 않는다 | 임계값 근처 순간 초과가 사라져 오탐 분석 근거가 없어진다(REQ-ALM-17) |
| 품질 표현 | 품질 2 · 4 · 5 점은 선을 끊고 표지를 단다 · 9 SIMULATED는 선을 잇고 범례에 표기한다 | BAD 값을 이어 그리면 통신 불량이 급변처럼 보인다 |

- 검산: 규칙 = **6**
- **B형 — 차트가 점을 덜 그리는 것은 결함이 아니라 서버 보호의 결과다.** 결론 — 긴 범위는 서버가 해상도를 올리고 LTTB로 줄여 보낸다. 반대 시나리오 — 브라우저가 원시를 받아 스스로 줄이면 1년 범위 요청이 ClickHouse 원시 스캔을 일으켜 적재까지 멈춘다(원본 data_flow.md §6.1). 파생 지침 — 원시가 꼭 필요하면 차트가 아니라 내보내기로 간다(ANL-TREND).

## 시각 표시

정본은 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §표시 시간대다. 화면 쪽 적용만 적는다.

| 자리 | 규칙 | 금지 | 근거 |
|------|------|------|------|
| 표시 | 모든 시각을 **Asia/Seoul로 표시**한다 · 변환은 렌더 직전 한 번만 | 서버 KST 문자열에 브라우저 로컬 시간대를 다시 적용 — 9시간이 두 번 더해진다 | AC-04 |
| 표시 형식 | 날짜 · 시각 · 초까지 · 실험 화면(EXP)과 최신값 ts 툴팁은 밀리초까지 · 시간대 표기 KST를 붙인다 | 시간대 표기 없는 시각 — 수동 조회(clickhouse-client) 결과와 대조할 때 기준을 잃는다 | 원본 data_flow.md §17 "저장 시각과 UI 표시 시각 대조" |
| 입력 | 범위 입력은 KST로 받고 요청에는 **오프셋 포함 ISO 8601**(+09:00)로 보낸다 | 오프셋 없는 ISO 8601 — 서버가 400 common.validation_failed로 거절한다 | REQ-TSQ-02 |
| 응답 해석 | 측정 시각(ts · points 첫 열 · WS 값)은 **epoch ms 정수**, 업무 시각(At으로 끝나는 필드)은 **UTC ISO 8601(Z)**로 받는다 — 둘 다 Asia/Seoul로 한 번 변환해 그린다 | UTC 문자열을 KST로 착각해 변환 생략 · epoch를 초로 해석 | [../07_api/01_conventions.md](../07_api/01_conventions.md) §시각 직렬화 |
| 두 시각 | ts는 "측정 시각", ingested_at은 "적재 시각"으로 라벨을 가른다 · 최신값 화면의 신선도 기준은 ts다 | ingested_at을 "갱신 시각"으로 표시 — 백프레셔로 늦게 적재된 값이 방금 갱신된 것처럼 보인다 | REQ-RLT-03 |
| 달력 경계 | 1d 해상도 버킷의 하루는 KST 자정에 시작한다 · 축 눈금도 KST 자정 | UTC 자정 눈금 — 일별 막대가 오전 9시에 끊긴다 | [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) |

- 검산: 자리 = **6**
- **A형 — "화면 시각이 9시간 어긋났다"는 대개 저장 문제가 아니다.** 통념은 저장값이 틀렸다는 것이다. 부정 — 저장은 epoch이고 시간대 인자는 표시 · 파싱 · 달력 함수만 바꾼다. 진짜 축은 변환이 몇 번 일어났는가다. 대체 경로 — 같은 행을 epoch 밀리초로 보이는 툴팁과 수동 조회의 toUnixTimestamp64Milli 결과를 대조한다.

## 에러 코드별 사용자 표시

에러 코드 전수(정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)) 중 화면에 닿는 것의 표시 규칙이다. 화면 블록의 오류 행은 이 표의 코드를 인용하고 표시를 다시 정의하지 않는다.

| 코드 | 닿는 화면 | 표시 | 사용자 다음 행동 | 금지 표시 |
|------|------|------|------|------|
| common.validation_failed/400 | 입력이 있는 전 화면 | 필드 옆 문구 · 필드를 특정할 수 없으면 폼 머리 문구 | 입력을 고친다 · 재시도 버튼 없음 | 자동 재시도 |
| common.not_found/404 | 경로 식별자를 쓰는 전 화면 | "대상이 없다" + 목록으로 돌아가기 · 설비 선택기는 선택을 해제 | 식별자 확인 | 최신값의 빈 목록(200)을 이 문구로 표시 |
| common.duplicate_key/409 | ADM-MASTER(tag_code) · ADM-WORKORDER(order_no) | 해당 필드 옆 "이미 있는 값" | 다른 값으로 저장 | 폼 초기화 |
| common.rate_limited/429 | 전 인증 화면 | 화면 머리 띠 "요청 한도 초과" + Retry-After 초 카운트다운 | 기다린다 · 자동 재조회는 Retry-After까지 멈춘다 | 로그인 화면으로 이동 |
| common.postgres_unavailable/503 | 관리 화면 · AUTH-LOGIN · 알람 목록 · DSH 단일 태그 | 영역 띠 "업무 저장소 응답 불가" · 기존 값 유지 | 백오프 뒤 재시도 버튼 | DSH 설비 전체 값까지 숨기기 — 그 경로는 200으로 값을 낸다 |
| auth.invalid_credentials/401 | AUTH-LOGIN | "이메일 또는 비밀번호가 맞지 않다" | 다시 입력 | 계정 존재 · 비활성 여부를 가르는 문구 |
| auth.unauthenticated/401 | 전 인증 화면 | 표시 없이 AUTH-LOGIN으로 이동 · 복귀 경로 보존(내부 경로만) | 로그인 | 입력 중인 폼 버리기 — 복귀 뒤 복원한다 |
| auth.token_expired/401 | 전 인증 화면 | **표시 없음** — BFF 갱신 1회 후 원요청 재전송 | 없음 | 갱신 루프(2회 이상) |
| auth.refresh_invalid/401 | 전 인증 화면 | "세션이 끝났다" 후 AUTH-LOGIN | 로그인 | 축출 실험 중 이 표시를 결함으로 기록 — 정상 관측값이다 |
| auth.token_store_unavailable/503 | AUTH-LOGIN · 공통 셸 | "인증 저장소 응답 불가 — 잠시 뒤 다시" · **로그인 화면으로 보내지 않는다** | 백오프 뒤 재시도 | 재로그인 유도 — refresh_invalid와 대응이 반대다 |
| auth.forbidden/403 | 역할 판정 화면 | 제자리에서 "이 작업은 {역할}만 한다" | 요청 중단 | 로그인 화면으로 이동 |
| master.scale_change_forbidden/409 | ADM-MASTER | "스케일 변경은 새 태그 발급으로만 한다" + 새 태그 발급 동작으로 이동 | 새 태그 발급 | 일반 저장 재시도 |
| master.reissue_source_inactive/409 | ADM-MASTER | "이미 비활성인 태그에서는 새 태그를 발급할 수 없다" · 태그 재조회 | 활성 태그(계보의 최신 태그)에서 발급 | 같은 요청 재시도 |
| timeseries.clickhouse_unavailable/503 | ANL-TREND · DSH-REALTIME 트렌드 채움 | 차트 영역 띠 "시계열 저장소 응답 불가" · 이미 그린 점 유지 | 백오프 뒤 재조회 | 최신값 · 대조군으로 대체 조회 |
| timeseries.too_many_tags/400 | ANL-TREND | "태그를 상한 이하 묶음으로 나눈다" · 선택기가 상한을 먼저 막는다 | 묶음 분할 | 형식 오류 문구 — 대응이 "고친다"가 아니라 "나눈다"다 |
| realtime.latest_unavailable/503 | DSH-REALTIME | 최신값 표 머리 띠 "실시간 저장소 응답 불가" · 마지막 값을 흐리게 유지하고 그 값의 ts를 보인다 | 백오프 뒤 재조회 | **시계열 조회로 대체 호출**(REQ-RLT-06) |
| alarms.ack_not_allowed/409 | ALM-CONSOLE | "이미 확인됐거나 해제된 알람" · 목록 재조회 | 없음 | 같은 요청 재시도 |
| alarms.eval_store_unavailable/503 | ALM-RULES | 분석 차트 띠 "판정 기록 저장소 응답 불가" · 규칙 편집은 그대로 | 백오프 뒤 재조회 | timeseries.clickhouse_unavailable 문구로 표시 · 빈 차트를 "위반 0"으로 그리기 |
| work_orders.invalid_status_transition/409 | ADM-WORKORDER | "현재 상태에서 할 수 없는 전이" · 현재 상태 재조회 후 허용 전이만 버튼으로 | 허용 전이 선택 | 전이 버튼 상태 유지 |
| work_orders.production_log_not_allowed/409 | ADM-WORKORDER | "생산 중(IN_PROGRESS)인 작업지시에만 실적을 기록한다" · 단건 재조회 | 없음 — 완료 뒤에는 기록하지 않는다 | 폼 입력 버리기 |

- 검산: 화면에 닿는 코드 = common 5 + auth 6 + master 2 + timeseries 2 + realtime 1 + alarms 2 + work_orders 2 = **20** · 화면에 닿지 않는 코드 = datagen 2(stream_full · bulk_disabled — 부하 주입 표면은 k6가 부른다 · 화면 없음(API 전용)) · 20 + 2 = **22**
- **datagen.stream_full은 화면에 코드로 오지 않고 EXP-CONSOLE의 메트릭으로만 보인다.** 모드 C 거절 수는 측정값이지 사용자 오류가 아니다.
- **낙관적 갱신을 하지 않는다.** ACK · 상태 전이 · 마스터 저장은 응답을 받은 뒤에 화면을 바꾼다 — 409가 올 수 있는 쓰기를 먼저 반영하면 되돌릴 때 사용자가 두 상태를 본다.

에러 코드가 아닌 신호의 표시다. 코드가 없으므로 위 표에 두지 않는다.

| 신호 | 닿는 화면 | 표시 | 근거 |
|------|------|------|------|
| WebSocket 종료 코드 | 공통 셸 | ① 4401 — BFF 갱신 토큰으로 1회 재연결 · 실패면 AUTH-LOGIN ② 4403 · 4400 — 재연결하지 않고 끊김 표시 ③ 1001 · 4408 · 4413 — 백오프 재연결 뒤 REST 동기화 ④ 4503 — 백오프 재연결 · DSH 503 띠 ⑤ 1000 — 표시 없음 | [../07_api/11_websocket.md](../07_api/11_websocket.md) §종료 코드 |
| health 503 | EXP-CONSOLE · 공통 셸 | 에러 봉투가 아니라 **같은 본문의 저장소별 상태**로 그린다 | REQ-OBS-09 |
| 최신값 200 빈 목록(items []) | DSH-REALTIME | 빈 값 행 "측정값 아직 없음" | [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 최신값 메타 비움(tagName null · meta.metaMissing) | DSH-REALTIME | 값 · 품질은 그리고 태그명 자리에 tag_id와 "메타 없음" · STALE 대신 값의 나이 | [../07_api/06_realtime.md](../07_api/06_realtime.md) |
| 캐시 degrade · 락 대기 소진 | ANL-TREND | 표시 없음 — 지연만 늘어난다 | REQ-TSQ-11 |

- 검산: 신호 = **5**

## 갱신 주기와 캐시 층 정렬

브라우저 쿼리 캐시는 TanStack Query다(원본 tech_stack.md §4.3). **staleTime은 그 응답을 낸 가장 가까운 서버 층의 수명 하한과 같게 둔다** — 이 관계식이 이 절의 정본이고 라이브러리 설정값은 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)가 관계식에서 파생한다. 서버 층 TTL의 소유처는 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)다.

| 쿼리 | 쿼리 키 | 가장 가까운 서버 층 | 서버 층 수명(현행 참고) | staleTime 관계 | 새 값을 얻는 수단 |
|------|------|------|------|------|------|
| 설비 전체 최신값 | realtime · device · {device_id} | 없음 — rt:latest는 봉인 계열(TTL 금지) | 해당 없음 | **0** · 주기 재조회 없음 | 진입 · 재연결 1회 · WS 프레임 병합 · STALE은 staleAfterMs로 화면 판정 |
| 단일 태그 최신값 | realtime · tag · {tag_id} | 상동 | 해당 없음 | 0 | 상동 |
| 시계열 — 완전 과거 | timeseries · {정규화 요청} | Redis cache:q | 300초 ±20% | TTL × 0.8 이하 | 수동 재조회 |
| 시계열 — 현재 버킷 포함 | 상동 | Redis cache:q | 30초 ±20% | TTL × 0.8 이하 | 수동 · 진행 구간 분할 |
| 시계열 — 최근 구간 | 상동 | 없음 — 캐시하지 않는다 | 해당 없음 | 0 | 최신값 · WS로 유도 |
| 사이트 · 라인 · 설비 · 태그 목록 | master · {종류} · {상위 id} | BFF 서버 fetch 캐시 | revalidate 30초 | revalidate 창 이하 | 체인 ⑥ 신호 · 자기 쓰기 성공 |
| 알람 규칙 | alarm · rules | Redis cache:alarmrules(BFF no-store) | 300초 ±20% | TTL × 0.8 이하 | 체인 ⑥ 신호 · 자기 쓰기 성공 |
| 알람 이벤트 | alarm · events · {필터} | Redis cache:alarmevents(BFF no-store) | 30초 · 지터 없음 | TTL 이하 | ch:alarm 푸시 겹침 · 자기 ACK 성공 |
| 작업지시 · 실적 | wrk · {종류} · {필터} | Redis cache:workorders(BFF no-store) | 60초 · 지터 없음 | TTL 이하 | 자기 쓰기 성공 · 수동 |
| 감사 로그 | audit · {범위} | 없음 — 캐시 층 없음 | 해당 없음 | 0 | 수동 |
| health | obs · health | 없음 | 해당 없음 | 0 | 화면별 폴링 |
| metrics | obs · metrics | 없음 | 해당 없음 | 0 | 화면별 폴링 · 캡처 |

- 검산: 쿼리 = **12**
- **관계식의 근거는 2단 캐시 실험이다**(원본 tech_stack.md §4.3). staleTime이 서버 수명보다 길면 서버가 새 값을 가진 뒤에도 화면이 옛 값을 보이고, 0에 가깝게 짧으면 브라우저 재조회가 같은 서버 사본만 다시 받아 브라우저 층과 서버 층의 기여를 측정에서 가를 수 없다. 지터 계열은 하한(TTL × 0.8)에 맞춘다 — 평균에 맞추면 절반의 재조회가 만료 전 사본을 다시 받는다.
- **gcTime은 시계열 쿼리만 짧게 둔다.** 시계열 응답은 수백 KB이고 사용자별이라 화면을 떠난 뒤 오래 들고 있으면 탭 메모리가 범위 조회 횟수에 비례해 는다 — 현행값 60초 · 소유 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md).
- **작업지시 · 실적의 다른 사용자 화면은 cache:workorders TTL만큼 늦는 것을 허용한다.** 체인 ③ · ⑥을 걸지 않는 판정([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md))의 화면 쪽 결과이며, 쓴 사람의 화면은 자기 쓰기 성공으로 즉시 무효화한다.
- 쿼리 키 표기의 가운뎃점은 키 배열의 원소 구분이다 — 구현에서는 배열 원소가 된다.

## 무효화 신호 수신 — 체인 ⑥단

마스터 쓰기 뒤 ch:cacheinv로 발행된 **무효화된 키 이름**을 RLT-09가 WebSocket으로 중계하고, 공통 셸이 받아 아래 쿼리 키를 무효화한다. 단 번호의 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 무효화 체인 6단이다. 신호는 cacheinv 메시지(keys — 무효화된 키 이름 배열 · 접두 포함)로 오고 스로틀 병합 대상이 아니다([../07_api/11_websocket.md](../07_api/11_websocket.md)).

| 신호 키(ch:cacheinv) | 무효화할 쿼리 키 | 영향 화면 | 무효화하지 않는 것과 이유 |
|------|------|------|------|
| cache:tagmeta:{tag_id} | master · tags(목록 전부) · master · tag · {tag_id} · 그 태그를 가진 realtime · device · {device_id} · alarm · rules | ADM-MASTER · DSH-REALTIME · ALM-RULES | timeseries 쿼리 — cache:q 결과는 체인 대상이 아니라 재조회해도 서버가 옛 이름을 TTL만큼 낸다 · 재조회는 무거운 쿼리를 한꺼번에 다시 부를 뿐이다 |
| cache:devlist:{site_id} | master · devices · {site_id} · 같은 사이트 설비의 modbus 설정 조회 | ADM-MASTER · DSH · ANL · ALM-RULES 설비 선택기 | realtime 쿼리 — 설비 목록 변경은 최신값 Hash 내용을 바꾸지 않는다 |
| cache:alarmrules | alarm · rules | ALM-RULES | alarm · events — 규칙 변경은 과거 이벤트를 바꾸지 않는다 |
| cache:perm:{user_id} | 자기 user_id일 때 "역할이 바뀌었다 — 다시 로그인하면 반영" 안내만 띄운다 | 공통 셸 | 쿼리 무효화 없음 — 역할 원천은 로그인 응답 user.roles뿐이고 재조회 표면(me)이 없다(07_api/03_auth 판정) · 그동안 옛 역할로 켜진 버튼은 서버 Guard가 403으로 막는다 |

- 검산: 신호 키 = **4**
- **사이트 · 라인 쓰기는 신호가 없다.** 두 목록은 Redis 사본을 두지 않아 ③에 실을 키 이름이 없다([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) W5 판정) — 다른 사용자 화면은 staleTime(BFF revalidate 창 이하)만큼 옛 목록을 보이고, 쓴 탭은 자기 쓰기 성공으로 로컬 무효화한다.
- **ch:cacheinv에 오지 않는 키는 이 표에 없다** — cache:alarmevents · cache:workorders는 체인 ③을 걸지 않고(키 하나 DEL로 조합 전부가 지워진다), cache:q는 체인 대상이 아니다. 두 무효화 모두 쓴 사람 화면의 자기 쓰기 성공과 staleTime이 맡는다.
- **⑥은 쓴 사람의 탭을 위한 단이 아니다.** 쓴 탭은 쓰기 응답을 받는 순간 같은 쿼리 키를 로컬 무효화한다 — ⑥은 다른 사용자와 **같은 브라우저의 다른 탭**을 위한 단이다. 탭마다 WebSocket과 쿼리 캐시가 따로라 다른 탭은 신호로만 안다(AC-06 브라우저 층).
- **신호는 스로틀 대상이 아니고 병합하지 않는다.** 받은 키를 받은 대로 처리한다 — 병합하면 키가 빠질 수 있다([../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) F-07 사이클 ④).
- **신호를 놓치면 staleTime이 상한이다.** Pub/Sub은 전달을 보장하지 않는다 — 재연결 직후 공통 셸은 master 계열 쿼리를 한 번 무효화해 끊긴 동안 놓친 신호를 메운다. 최신값의 재연결 1회 동기화(REQ-RLT-13)와 같은 모양이다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| staleTime · gcTime · 링 버퍼 창 값 | **W6 판정** — 관계식은 이 문서 · 현행값은 09_tech_stack/01(staleTime 파생표 · 시계열 gcTime 60초 · 링 버퍼 3,000슬롯 — S2 고정) | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) |
| 신호 도달 지연 · 화면 반영 시간 | 3계층 미확인 — 확정 전 임의 값 고정 금지 | AC-06 기록 · EXP-29 |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [02_traceability.md](./02_traceability.md) — 기능 → 화면 매핑
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 6단 · BFF 경유 기준
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 에러 코드 정본
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 표시 시간대
- [../07_api/01_conventions.md](../07_api/01_conventions.md) — 경로 분리 · 응답 봉투
- [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) — 프런트엔드 구성 · 설정값
