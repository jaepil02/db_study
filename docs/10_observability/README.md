# 10_observability — 관측과 실험

> **대상**: db_study의 측정 체계 — 메트릭 전수 · 계측 지점 · 대시보드와 알림 · 실험 프로토콜 · 부하 시나리오 · 실험 전수 · 로컬 측정 한계
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(측정 기록 불변식 · 스위치 10) · 원본 architecture.md §14 · §16 · 원본 tech_stack.md §8 · §9 · §10.6 · 원본 data_flow.md §11.3 · §15 · §16 · 원본 implementation_plan.md §2.4 · §4 · §5 · §8(커밋 ff66a37) · docs_plan 학습 목표 1(대조군 실험)

"무엇을 어떻게 재는가"에 답하는 폴더다. **실험 ID EXP-NN을 채번**하며 채번 자리는 [06_experiment_catalog.md](./06_experiment_catalog.md)다. 이 시스템의 최우선 목표가 측정 가능성이므로, 이 폴더는 부록이 아니라 설계의 도착점이다 — 다른 폴더의 "미확인" 수치가 전부 여기의 실험으로 확정된다.

**설계와 실행을 가른다.** 대조군이 왜 · 무엇을 비교하는지는 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)가, 어떻게 돌리고 무엇이 나왔는지는 이 폴더가 갖는다. 실행 결과 기록은 docs/measurements/에 쌓이고 확정된 값만 정본 문서가 인용해 올린다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_metrics_catalog.md](./01_metrics_catalog.md) | 메트릭 전수 · 이름 규약 · 계열(앱 · HTTP·WS · 파이프라인 · Redis · PostgreSQL · ClickHouse) · 스위치 상태 레이블 · 가장 중요한 단일 지표(컨슈머 랙) | architecture §14 · tech_stack §9 | W6 |
| [02_instrumentation.md](./02_instrumentation.md) | 계측 지점 · 수집 방식(prom-client · INFO · pg_stat_* · system.*) · E2E 지연을 SQL로 재는 방법 · 키 계열별 메모리 샘플링 | data_flow §15 측정 방법 · architecture §14 | W6 |
| [03_dashboards_alerts.md](./03_dashboards_alerts.md) | 대시보드 6종 · 알림 규칙 · 히트율과 스트림 길이의 역상관 패널 | architecture §14 | W6 |
| [04_experiment_protocol.md](./04_experiment_protocol.md) | ★ **실험 규칙 정본** — 3회 중앙값 · 편차 폐기 기준 · 스냅샷과 복원 · 캐시 키 초기화 · 기준선 관측 · 기록 템플릿(docs/measurements 형식) · 4요소 병기 | implementation_plan §2.4 · §8 · data_flow §11.3 | W6 |
| [05_load_scenarios.md](./05_load_scenarios.md) | k6 부하 시나리오 5 + 장애 주입 1 · 도구별 실행 계층 · 생성기 포화 판정 | tech_stack §8 | W6 |
| [06_experiment_catalog.md](./06_experiment_catalog.md) | ★★ **EXP-NN 채번 정본** — 대조군 실험(EXP-01~05 예약) · 스위치별 실험 · 장애 재현 실험 · 각 실험의 가설 · 조건 · 판정 지표 · 결과 자리 | implementation_plan §4.2 · §5 · docs_plan 학습 목표 1 | W6 |
| [07_measurement_limits.md](./07_measurement_limits.md) | 로컬 측정 한계 · 흐름별 병목 예상 지점 · 완화책 · cpuset으로 되살린 원칙과 남은 한계 | tech_stack §10.6 · data_flow §16 · implementation_plan §2.4 · §2.5 | W6 |

검산: 본문 7 + README 1 = **8**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 실험 ID | EXP-NN — **EXP-01~EXP-05는 대조군 쿼리 5종**(단일 태그 1시간 · 단일 태그 7일 · 설비 전체 1일 · 분 단위 롤업 재계산 · 전체 스캔 count)에 예약한다. 나머지는 W6 채번 |
| 측정 기록 | 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태 4요소 병기 · 3회 중앙값 |
| 부하 시나리오 | **5**(Baseline · Ramp-up · Spike · Soak · Breakpoint) + 장애 주입 **1** |
| 스크레이프 창구 | api의 /metrics **하나** — exporter 컨테이너를 두지 않는다 |
| 기록 위치 | docs/measurements/ — 설계 정본이 아닌 예외 폴더 |

## 관련 문서

- [../README.md](../README.md) — 측정 기록 불변식
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 설계
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — 스위치 정본
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — 실험으로 확정할 목표치
