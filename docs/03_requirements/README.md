# 03_requirements — 요구사항

> **대상**: db_study의 동작 계약 — 전역 규칙 · 도메인별 요구사항 · 비기능 · 인수 기준 · 추적성 · 공식 참조
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(전역 불변식) · [../02_features](../02_features/README.md)(기능 ID) · 원본 architecture.md §1 · §15 · §16 · 원본 data_flow.md §15 · §17 · 원본 implementation_plan.md §5 합격 판정(커밋 ff66a37)

"어떤 계약으로 동작하는가"에 답하는 폴더다. **REQ-{도메인}-NN과 AC-NN을 채번**한다. 기능 ID가 무엇이 있는지를 고정한다면 REQ는 그것이 어떻게 동작해야 하고 어떻게 실패해야 하는지를 고정한다.

**전역 규칙을 개별 도메인보다 먼저 읽는다.** [01_global_rules.md](./01_global_rules.md)가 전역 규칙이라 도메인 파일 번호는 02_features보다 1씩 밀린다(02 AUT ~ 12 OBS). 외부 URL은 이 폴더의 [16_official_references.md](./16_official_references.md)에만 둔다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_global_rules.md](./01_global_rules.md) | ★ **REQ-GLB — 전역 불변식의 상세 계약** · 위반 시 구체적 실패 | architecture §1 · tech_stack §1 설계 원칙 4 · data_flow §2 | W2 |
| [02_auth.md](./02_auth.md) | REQ-AUT | architecture §11.2 · §18 | W2 |
| [03_master.md](./03_master.md) | REQ-MST | architecture §6 · §12 · data_flow §7 | W2 |
| [04_collector.md](./04_collector.md) | REQ-COL | data_flow §3 · architecture §9 | W2 |
| [05_plc_sim.md](./05_plc_sim.md) | REQ-SIM | tech_stack §6 | W2 |
| [06_datagen.md](./06_datagen.md) | REQ-GEN | tech_stack §7 · data_flow §11 | W2 |
| [07_ingest.md](./07_ingest.md) | REQ-ING | architecture §9 · data_flow §4 | W2 |
| [08_timeseries.md](./08_timeseries.md) | REQ-TSQ | architecture §10 · §11.1 · data_flow §6 | W2 |
| [09_realtime.md](./09_realtime.md) | REQ-RLT | data_flow §5 · §9 | W2 |
| [10_alarms.md](./10_alarms.md) | REQ-ALM | data_flow §8 | W2 |
| [11_work_orders.md](./11_work_orders.md) | REQ-WRK | architecture §6 | W2 |
| [12_metrics.md](./12_metrics.md) | REQ-OBS | architecture §14 · tech_stack §9 | W2 |
| [13_nonfunctional.md](./13_nonfunctional.md) | REQ-NFR(지연 예산 · 처리량 · 무손실) + REQ-TEC(로컬 실행 · 마이그레이션 · 버전 고정). 성능 목표치는 3계층 미확인으로 등재 | architecture §15 · §16 · data_flow §15 | W2 |
| [14_acceptance_criteria.md](./14_acceptance_criteria.md) | **AC-NN 채번 정본** — 흐름 검증 체크리스트 · 단계별 합격 판정 | data_flow §17 · implementation_plan §5 | W2 |
| [15_traceability.md](./15_traceability.md) | 기능 ↔ REQ ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전수 매핑 · 미매핑 0 · 유령 0 | 신설 | W7(리드) |
| [16_official_references.md](./16_official_references.md) | 외부 URL 유일 등재처 — 공식 문서 · 릴리스 노트 | 신설 | W7(리드) |

검산: 전역 1 + 도메인 11 + 횡단 4 + README 1 = **17**. 파일 번호 17 이상은 쓰지 않는다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 요구사항 ID | REQ-{도메인}-NN · 횡단 접두 GLB(전역) · NFR(비기능) · TEC(기술운영). 총수는 W2 채번 후 이 표에 올린다 |
| 인수 기준 | AC-NN — 채번 정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md) |
| 성능 목표 | 실측 전 수치는 **미확인 — 확정 전 임의 값 고정 금지.** 원본의 목표치는 "원본 목표(4 vCPU 가정)"로 표기하고 로컬 첫 실측을 기준선으로 다시 잡는다 |
| 추적성 | 대응이 없는 칸은 비우지 않고 닫힌 어휘(해당 없음 · 내부 모듈 · 표면 없음)로 적는다 |

## 관련 문서

- [../README.md](../README.md) — 전역 불변식 요약
- [../02_features/README.md](../02_features/README.md) — 기능 ID 채번 정본
- [../06_pipeline/README.md](../06_pipeline/README.md) — 흐름 F-NN
- [../10_observability/README.md](../10_observability/README.md) — 측정으로 요구사항을 검증하는 실험
