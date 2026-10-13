# 10_observability — 관측과 실험

> **대상**: db_study의 측정 체계 — 메트릭 전수 · 계측 지점 · 대시보드와 알림 · 실험 프로토콜 · 실험 전수(현행 · 폐지) · 로컬 측정 한계
> **작성일**: 2026-09-23
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — 대상 문서 파일 삭제) — 파일 05_load_scenarios **삭제**(파일 번호 05 결번) · 목차 본문 7 → **6** · 실험 46 → **현행 11 + 폐지 35**(채번 46 · 신설 시작 EXP-47 불변) · 부하 시나리오 5 + 장애 주입 1 → **0**(장애 주입은 호스트 셸로 남는다) · 메트릭 이름 147 → **131** · 알림 규칙 14 → **13** · 04 행 스냅샷과 복원 → 볼륨 초기화 · 06 행 내용을 현행 · 폐지 구분으로 · D-16 정리(d4 전역 sweep) — 고정 기준 축약 메트릭 이름 131 → **130**(http_designed_rejections_total 삭제)
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9 · 리드 판정 2026-10-03) — 메트릭 이름 145 → **147**(mst_cache_requests_total · rlt_latest_requests_total — 정본 01_metrics_catalog) — 실험 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — 메트릭 이름 143 → **145**(gen_runs_total · gen_run_active) — 실험 수 불변(라이브 실행은 측정 기록이 아니다)
> **개정일**: 2026-09-27 — D-04 부분 개정 반영(사용자 결정 — 업무 쓰기도 Redis를 거친다) — 고정 기준 축약 실험 45 → **46**(EXP-46 SW-12 업무 쓰기 경로) · 신설 시작 EXP-47 · 메트릭 이름 136 → **143**(biz_* 5 · 행 수 계열 2 — pg_table_live_tuples · ch_parts_rows)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 고정 기준 축약 실험 39 → **45**(역방향 대조 EXP-40~44 · 스트리밍 동시 적재 EXP-45) · 신설 시작 EXP-40 → **EXP-46** · 파일 목차 06 행은 수를 세지 않고 고정 기준 행을 가리킨다
> **개정일**: 2026-09-24 — W6 완성판 — 실험 **39**(EXP-01~39) · 메트릭 이름 136 · 알림 규칙 14 · 대시보드 6
> **원천**: D-16(사용자 결정 2026-10-11) · [../README.md](../README.md)(측정 기록 불변식 · 스위치 12) · 원본 architecture.md §14 · §16 · 원본 tech_stack.md §8 · §9 · §10.6 · 원본 data_flow.md §11.3 · §15 · §16 · 원본 implementation_plan.md §2.4 · §4 · §5 · §8(커밋 ff66a37) · docs_plan 학습 목표 1(대조군 실험)

"무엇을 어떻게 재는가"에 답하는 폴더다. **실험 ID EXP-NN을 채번**하며 채번 자리는 [06_experiment_catalog.md](./06_experiment_catalog.md)다. 이 시스템의 최우선 목표가 측정 가능성이므로, 이 폴더는 부록이 아니라 설계의 도착점이다 — 다른 폴더의 "미확인" 수치가 여기의 실험으로 확정된다 — D-16으로 실행 도구가 지워진 실험은 폐지 상태로 번호만 남고, 그 실험에 걸린 미확인은 확정 수단이 없는 미확인으로 남는다.

**설계와 실행을 가른다.** 대조군이 왜 · 무엇을 비교하는지는 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)가, 어떻게 돌리고 무엇이 나왔는지는 이 폴더가 갖는다. 실행 결과 기록은 docs/measurements/에 쌓이고 확정된 값만 정본 문서가 인용해 올린다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_metrics_catalog.md](./01_metrics_catalog.md) | 메트릭 전수 · 이름 규약 · 계열(앱 · HTTP·WS · 파이프라인 · Redis · PostgreSQL · ClickHouse) · 스위치 상태 레이블 · 가장 중요한 단일 지표(컨슈머 랙) | architecture §14 · tech_stack §9 | W6 |
| [02_instrumentation.md](./02_instrumentation.md) | 계측 지점 · 수집 방식(prom-client · INFO · pg_stat_* · system.*) · E2E 지연을 SQL로 재는 방법 · 키 계열별 메모리 샘플링 | data_flow §15 측정 방법 · architecture §14 | W6 |
| [03_dashboards_alerts.md](./03_dashboards_alerts.md) | 대시보드 6종 · 알림 규칙 13 · 적체 기준 알림(backpressure_stage) · 히트율과 Stream 점유 메모리 패널 | architecture §14 | W6 |
| [04_experiment_protocol.md](./04_experiment_protocol.md) | ★ **실험 규칙 정본** — 3회 중앙값 · 편차 폐기 기준 · 반복 사이 볼륨 초기화 · 캐시 키 초기화 · 기준선 관측 · 기록 템플릿(docs/measurements 형식) · 4요소 병기 | implementation_plan §2.4 · §8 · data_flow §11.3 | W6 |
| [06_experiment_catalog.md](./06_experiment_catalog.md) | ★★ **EXP-NN 채번 정본** — 실험 전수(수는 §고정 기준 (축약)) · 현행 실험(스위치 · 장애 재현 · 확장 진입 · 흐름 · 구조 · 기반)의 가설 · 조건 · 판정 지표 · 결과 자리 · 폐지 실험(D-16 — 번호 · 질문 · 기록 slug · 결과 요약) | implementation_plan §4.2 · §5 · docs_plan 학습 목표 1 | W6 |
| [07_measurement_limits.md](./07_measurement_limits.md) | 로컬 측정 한계 · 흐름별 병목 예상 지점 · 완화책 · cpuset으로 되살린 원칙과 남은 한계 | tech_stack §10.6 · data_flow §16 · implementation_plan §2.4 · §2.5 | W6 |

검산: 본문 6 + README 1 = **7** · 파일 번호 05(부하 시나리오)는 D-16으로 삭제한 결번이다 — 다시 쓰지 않는다

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 실험 ID | EXP-NN — **EXP-01~EXP-05는 대조군 쿼리 5종**(단일 태그 1시간 · 단일 태그 7일 · 설비 전체 1일 · 분 단위 롤업 재계산 · 비정렬 컬럼 조건 전 행 count)이다. 채번 **46**(EXP-01~46) = 현행 **11** + 폐지 **35**(D-16 — 실행 도구 삭제 · 번호 재사용 금지) — 분류 검산의 정본은 [06_experiment_catalog.md](./06_experiment_catalog.md) §분류와 검산. EXP-01~05도 폐지다. 신설은 EXP-47부터 |
| 측정 기록 | 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 4요소 병기 · 3회 중앙값 |
| 부하 시나리오 | **0** — 5종(Baseline · Ramp-up · Spike · Soak · Breakpoint)과 부하 도구를 D-16으로 지웠다 · 장애 주입은 호스트 셸의 컨테이너 정지 · 삽입 지연 유발로 남는다 |
| 메트릭 | 이름 **130** · 알림 규칙 **13** · 대시보드 **6** — 정본 [01_metrics_catalog.md](./01_metrics_catalog.md) · [03_dashboards_alerts.md](./03_dashboards_alerts.md). 가장 중요한 단일 지표는 컨슈머 랙(그룹 lag + pending — XLEN 아님) |
| 스크레이프 창구 | api의 /metrics **하나** — exporter 컨테이너를 두지 않는다 |
| 기록 위치 | docs/measurements/ — 설계 정본이 아닌 예외 폴더 |

## 관련 문서

- [../README.md](../README.md) — 측정 기록 불변식
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 정본
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — 실험으로 확정할 목표치
