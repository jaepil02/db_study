# 08_screen — 화면 명세

> **대상**: db_study 웹(Next.js)의 화면 — 명세 표준 · 기능 추적성 · 실시간 대시보드 · 트렌드 분석 · 알람 콘솔 · 관리 화면 · 실험 콘솔
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md) · [../01_overview/03_personas_roles.md](../01_overview/03_personas_roles.md) · 원본 tech_stack.md §4 · 원본 data_flow.md §6.3 · §7.2 · §9.1 · 원본 implementation_plan.md §4 · §5 S2(커밋 ff66a37)

"사람이 무엇을 보는가"에 답하는 폴더다. **화면 코드 {표면}-{의미}를 채번**하며 채번 자리는 이 README의 화면 인벤토리다(W5에서 신설). 화면은 데이터를 소유하지 않는다 — 모든 수치는 07_api 표면을 거쳐 오고, 화면 명세는 어느 표면을 어떤 빈도로 부르는지와 상태 4행(로딩 · 빈 값 · 오류 · 정상)을 고정한다.

**실험 콘솔은 스위치를 켜고 끄는 화면이 아니다.** 스위치는 환경변수 + DI 초기화 선택이라 전환에 재기동이 필요하다. [07_experiment_console.md](./07_experiment_console.md)는 현재 스위치 상태 표시 · 실험 실행 기록 · on/off 비교 대시보드를 담고, 전환은 재기동 절차로 안내한다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_standards.md](./01_standards.md) | 명세 템플릿 · 상태 4행 · 차트 표준(uPlot 주력 · ECharts 보조) · 갱신 주기와 캐시 정렬(TanStack Query ↔ Redis TTL) | tech_stack §4.2 · §4.3 · data_flow §6.3 | W5 |
| [02_traceability.md](./02_traceability.md) | 기능 → 화면 매핑 · 파생 집계 | 신설 | W5 |
| [03_realtime_dashboard.md](./03_realtime_dashboard.md) | 설비별 최신값 · 실시간 트렌드 · STALE 표시 · WebSocket 재연결 표시 | data_flow §5 · §9 · implementation_plan §5 S2 | W5 |
| [04_trend_analysis.md](./04_trend_analysis.md) | 시간 범위 조회 · 해상도 표시(meta.interval) · 다운샘플 표시 · 내보내기 | data_flow §6 · §14.1 | W5 |
| [05_alarm_console.md](./05_alarm_console.md) | 활성 알람 · 확인 · 이력 · 규칙 관리 · min/max 쌍 분석 차트 | data_flow §8 · §6.3 | W5 |
| [06_master_admin.md](./06_master_admin.md) | **관리 화면군** — 로그인 · 사이트 · 라인 · 설비 · 태그 마스터 · 작업지시 · 생산 실적 | architecture §11 · data_flow §7 | W5 |
| [07_experiment_console.md](./07_experiment_console.md) | ★ 스위치 상태 표시 · 실험 실행 기록 · on/off 비교 대시보드 · 전환 절차 안내 | implementation_plan §4 · §8 | W5 |

검산: 표준 · 추적성 2 + 화면 문서 5 + README 1 = **8**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 화면 코드 | {표면}-{의미}(예: DSH-REALTIME). 표면 접두 목록과 화면 수는 W5 인벤토리 채번 후 이 표와 루트 README에 올린다 |
| 도메인 공백 | COL · SIM · ING은 전용 화면이 없다 — 산출물은 대시보드 · 실험 콘솔의 메트릭으로만 보인다. AUT의 로그인과 WRK의 작업지시는 06_master_admin이 담는다. GEN(생성기 실행)과 OBS(메트릭)는 잠정 07_experiment_console 귀속이며 W5가 명시한다 |
| 경로 분리 | 저빈도 조회는 BFF 경유, 최신값 · 시계열 · WebSocket은 api 직결 — 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) |
| 실험 콘솔 접근 | 인증 사용자 전원 · **표시 전용** — 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) |
| 차트 | uPlot 주력 · ECharts 보조. 서버 다운샘플이 1차 방어선이고 차트는 2차 방어선이다 |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../07_api/README.md](../07_api/README.md) — 화면이 부르는 표면
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 실험 콘솔이 표시하는 스위치
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 실험 콘솔이 기록하는 실험
