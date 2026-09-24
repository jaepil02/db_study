# 07_api — API 명세

> **대상**: db_study api 컨테이너가 바깥에 여는 표면 — REST 규약 · 에러(미러) · 도메인별 엔드포인트 · WebSocket 프로토콜
> **작성일**: 2026-09-23
> **개정일**: 2026-09-24 — W5 완성판 — API 표면 **43**(원본 21 + 신설 22) · 에러 코드 22종 · 도메인별 표면 수 표 신설
> **원천**: [../README.md](../README.md)(도메인 공백 · 에러 코드 규약) · 원본 architecture.md §11 · §11.1 · §11.2 · 원본 data_flow.md §5 · §6 · §7.2 · §9 · §14.1 · §14.2(커밋 ff66a37)

"바깥에서 어떻게 부르는가"에 답하는 폴더다. 각 도메인 파일이 **문서 지역 표면 번호({문서} #N)를 채번**한다 — 예를 들어 05_timeseries #3이다. 표면 총수의 정본은 W5 이후 이 README의 도메인별 표면 수 표이며, 세는 기준은 도메인 문서의 표면 요약 표 행 수다(최대 번호가 아니다 — 폐지 번호는 결번으로 남는다).

에러 코드는 여기서 채번하지 않는다. [02_errors.md](./02_errors.md)는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 **미러**이며, 미러에서 코드를 신설·개명·폐기하지 않는다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_conventions.md](./01_conventions.md) | 경로 버전(/api/v1) · 페이지네이션 · 멱등 · 시각·수치 직렬화 · 응답 메타 · 에러 봉투 · 응답 필드 변경 규칙 · BFF 경유 기준 | architecture §11 · data_flow §7.2 · §14.1 5단계 · §14.2 | W5 |
| [02_errors.md](./02_errors.md) | **미러(채번 금지)** — 에러 코드 정본의 표면별 발생 위치 | 11_glossary/02 미러 | W5 |
| [03_auth.md](./03_auth.md) | AUT — login · refresh · logout | architecture §11 · §11.2 | W5 |
| [04_master.md](./04_master.md) | MST — sites · devices · tags 조회와 쓰기 · 캐시 계약 | architecture §11 · data_flow §7 | W5 |
| [05_timeseries.md](./05_timeseries.md) | TSQ — timeseries/query 요청 스키마 · 해상도 규칙 · export 스트리밍 | architecture §11 · §11.1 · data_flow §6 | W5 |
| [06_realtime.md](./06_realtime.md) | RLT — 설비 전체 최신값 · 단일 태그 최신값 · STALE 판정 · Redis 불가 시 503 | architecture §11 · data_flow §5 | W5 |
| [07_alarms.md](./07_alarms.md) | ALM — 알람 이벤트 목록 · 확인(ack) · 규칙 관리 | architecture §11 · data_flow §8 | W5 |
| [08_work_orders.md](./08_work_orders.md) | WRK — 작업지시 · 생산 실적 | architecture §11 | W5 |
| [09_datagen.md](./09_datagen.md) | GEN — **부하 주입 표면 /api/v1/ingest/bulk**(기본 비활성 · 환경변수 게이트 + 인증 · 백프레셔 위험 단계에서 503) · 생성기 실행 제어 표면은 원본 근거가 없어 W5가 판정한다 | architecture §11 · §18 · data_flow §11 | W5 |
| [10_metrics.md](./10_metrics.md) | OBS — /api/v1/health · /metrics(스위치 상태 레이블 포함) | architecture §11 · §14 · implementation_plan §4.1 | W5 |
| [11_websocket.md](./11_websocket.md) | 횡단 — /ws/realtime · 첫 메시지 인증 · 구독 · 스로틀 병합 · ping · 재연결 · Origin 검증 | data_flow §9 · architecture §11.2 | W5 |

검산: 규약 2 + 도메인 8 + 횡단 1 + README 1 = **12**. 도메인 8 = 11 − 표면 없음 3(COL · SIM · ING)

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 표면 도메인 | **8** — AUT · MST · TSQ · RLT · ALM · WRK · GEN · OBS |
| 표면 없는 도메인 | **COL · SIM · ING** — 내부 모듈이다. **/api/v1/ingest/bulk는 경로 이름과 달리 ING 표면이 아니다** — 호출 주체가 부하 주입(GEN 모드 C)이고 ING은 Stream 뒤에서만 데이터를 받는다. 그래서 GEN 문서가 소유한다 |
| 에러 코드 | **22종** · {domain}.{snake_case} + HTTP 상태 — 채번 정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |
| 경로 분리 | 저빈도 업무 조회 · 로그인은 BFF(Next.js Route Handler) 경유, 최신값 · 시계열 · WebSocket은 브라우저 직결 — 기준 정본 [01_conventions.md](./01_conventions.md) |
| 원본에 없는 표면 | **신설 22**(W5 판정) — MST 12 · ALM 4 · WRK 6. 두지 않기로 판정한 표면: 생성기 실행 제어 · 실행 중 주입 제어 · 태그 재활성화 · 알람 강제 해제 · 계정 · 역할 관리 |
| API 표면 수 | **43** — 정본은 아래 §도메인별 표면 수 |

## 도메인별 표면 수

세는 기준은 각 도메인 문서의 **표면 요약 표 행 수**다. 폐지 번호는 결번으로 남고 세지 않는다.

| 문서 | REST JSON | 다운로드 스트림 | 메트릭 텍스트 | WebSocket | 계 | 원본 | 신설 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| [03_auth.md](./03_auth.md) | 3 | 0 | 0 | 0 | 3 | 3 | 0 |
| [04_master.md](./04_master.md) | 17 | 0 | 0 | 0 | 17 | 5 | 12 |
| [05_timeseries.md](./05_timeseries.md) | 1 | 1 | 0 | 0 | 2 | 2 | 0 |
| [06_realtime.md](./06_realtime.md) | 2 | 0 | 0 | 0 | 2 | 2 | 0 |
| [07_alarms.md](./07_alarms.md) | 6 | 0 | 0 | 0 | 6 | 2 | 4 |
| [08_work_orders.md](./08_work_orders.md) | 9 | 0 | 0 | 0 | 9 | 3 | 6 |
| [09_datagen.md](./09_datagen.md) | 1 | 0 | 0 | 0 | 1 | 1 | 0 |
| [10_metrics.md](./10_metrics.md) | 1 | 0 | 1 | 0 | 2 | 2 | 0 |
| [11_websocket.md](./11_websocket.md) | 0 | 0 | 0 | 1 | 1 | 1 | 0 |
| **계** | **40** | **1** | **1** | **1** | **43** | **21** | **22** |

검산: 형식별 40 + 1 + 1 + 1 = **43** · 출처별 원본 21 + 신설 22 = **43**. 원본 21은 원본 architecture.md §11 API 표 17행 중 여러 메서드를 묶은 행을 메서드별로 푼 수다.

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 에러 코드 채번 정본
- [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) — 표면 방어
- [../08_screen/README.md](../08_screen/README.md) — 표면을 호출하는 화면
