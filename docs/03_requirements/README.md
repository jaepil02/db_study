# 03_requirements — 요구사항

> **대상**: db_study의 동작 계약 — 전역 규칙 · 도메인별 요구사항 · 비기능 · 인수 기준 · 추적성 · 공식 참조
> **작성일**: 2026-09-23
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB) — 공식 참조 등재 74 → **88** · 확인일 확인 16 → **30**(TimescaleDB 14행 · 정본 16_official_references)
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 지우기 · 설비 가동 · HMI 개요 · POST 출처 계약 신설**(사용자 결정 2026-10-11 · 리드 판정 §5-4) — REQ 현행 154 → **163**(GLB 24 → **25** · GEN 9 → **14** · ING 17 → **18** · RLT 16 → **18**) · 채번 235 → **244**(결번 81 불변 — REQ-RLT-18은 D-16 결번이라 건너뜀) · AC 현행 26 → **29**(AC-47 · 48 · 49) · 채번 46 → **49**
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지 · 도메인 11 → 8 · 대상 문서 파일 삭제) — 파일 02_auth · 10_alarms · 11_work_orders **삭제**(파일 번호 02 · 10 · 11 결번) · 도메인 파일 11 → **8** · REQ 채번 233 → **235**(REQ-GLB-25 · 26 신설 — 옛 REQ-AUT-12 · 13 이관) · 현행 **167**(결번 68) · AC 현행 46 → **40**(결번 6) · 추적성 7축 재동기(정본 15_traceability) · 공식 참조 79 → **74**(미확인 63 → **58**) · 리드 판정 적용(d4 · 2026-10-11 — 폐지 실험에만 걸린 판정 폐지 표기) — 요구사항 현행 167 → **154**(NFR 18 → **5** · 폐지 표기 13) · 결번 68 → **81** · 인수 기준 현행 40 → **26**(결번 6 → **20** — 폐지 표기 14)
> **개정일**: 2026-10-03 — D-14 검수 반영 — 추적성 고정 기준 화면 12 → **현행 2(폐지 10 — D-14)** — 정본 15_traceability와 같은 표현 · 다른 축 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27) 근거 등재 반영 — 공식 참조 등재 70 → **79** · 확인 7 → **16** · 미확인 63 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28) — REQ 229 → **233**(GEN 15 → **19** · REQ-GEN-16~19) · AC 45 → **46**(AC-46 · 원천 ④ 시연 기능) · 추적성 7축 수치 재동기(기능 93 · 요구사항 233 · 화면 12 · API 문서 10 · 저장 객체 28 · AC 46 — 정본 15_traceability)
> **개정일**: 2026-09-26 — W1 검수 반영 — 공식 참조 확인일 확인 8 → **7** · 미확인 62 → **63**(ClickHouse 문서 행은 부분 확인 — 미확인으로 센다 · 정본 16)
> **개정일**: 2026-09-26 — 공식 참조 확인일 확인 7 → **8** · 미확인 63 → **62**(ClickHouse 문서 행 · 정본 16)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 고정 기준 추적성 저장 객체 24 → **27**(ClickHouse 업무 대조 계측물 3 — 기능 해당 없음 명시 · 정본 15_traceability)
> **개정일**: 2026-09-24 — 착수 체크리스트 7 반영 — 공식 참조 등재 68 → **70** · 확인 7행
> **개정일**: 2026-09-24 — W7 검수 반영 — 14 설명에 학습 목표 산출물 추가 · REQ 228 → **229** · 공식 참조 57 → **68**
> **개정일**: 2026-09-24 — W7 완성판 — 15 추적성(7축 · 미매핑 0 · 유령 0) · 16 공식 참조(등재 68 · 전부 미확인)
> **원천**: D-16(사용자 결정 2026-10-11) · [../README.md](../README.md)(전역 불변식) · [../02_features](../02_features/README.md)(기능 ID) · 원본 architecture.md §1 · §15 · §16 · 원본 data_flow.md §15 · §17 · 원본 implementation_plan.md §5 합격 판정(커밋 ff66a37)

"어떤 계약으로 동작하는가"에 답하는 폴더다. **REQ-{도메인}-NN과 AC-NN을 채번**한다. 기능 ID가 무엇이 있는지를 고정한다면 REQ는 그것이 어떻게 동작해야 하고 어떻게 실패해야 하는지를 고정한다.

**전역 규칙을 개별 도메인보다 먼저 읽는다.** [01_global_rules.md](./01_global_rules.md)가 전역 규칙이라 도메인 파일 번호는 02_features보다 1씩 밀린다(03 MST ~ 12 OBS — 옛 02 AUT · 10 ALM · 11 WRK는 D-16 삭제 결번). 외부 URL은 이 폴더의 [16_official_references.md](./16_official_references.md)에만 둔다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_global_rules.md](./01_global_rules.md) | ★ **REQ-GLB — 전역 불변식의 상세 계약** · 위반 시 구체적 실패 | architecture §1 · tech_stack §1 설계 원칙 4 · data_flow §2 | W2 |
| [03_master.md](./03_master.md) | REQ-MST | architecture §6 · §12 · data_flow §7 | W2 |
| [04_collector.md](./04_collector.md) | REQ-COL | data_flow §3 · architecture §9 | W2 |
| [05_plc_sim.md](./05_plc_sim.md) | REQ-SIM | tech_stack §6 | W2 |
| [06_datagen.md](./06_datagen.md) | REQ-GEN | tech_stack §7 · data_flow §11 | W2 |
| [07_ingest.md](./07_ingest.md) | REQ-ING | architecture §9 · data_flow §4 | W2 |
| [08_timeseries.md](./08_timeseries.md) | REQ-TSQ | architecture §10 · §11.1 · data_flow §6 | W2 |
| [09_realtime.md](./09_realtime.md) | REQ-RLT | data_flow §5 · §9 | W2 |
| [12_metrics.md](./12_metrics.md) | REQ-OBS | architecture §14 · tech_stack §9 | W2 |
| [13_nonfunctional.md](./13_nonfunctional.md) | REQ-NFR(지연 예산 · 처리량 · 무손실) + REQ-TEC(로컬 실행 · 마이그레이션 · 버전 고정). 성능 목표치는 3계층 미확인으로 등재 | architecture §15 · §16 · data_flow §15 | W2 |
| [14_acceptance_criteria.md](./14_acceptance_criteria.md) | **AC-NN 채번 정본** — 흐름 검증 체크리스트 · 단계별 합격 판정 · 학습 목표 산출물 · 시연 기능 판정 | data_flow §17 · implementation_plan §5 | W2 |
| [15_traceability.md](./15_traceability.md) | 기능 ↔ REQ ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전수 매핑 · 미매핑 0 · 유령 0 | 신설 | W7(리드) |
| [16_official_references.md](./16_official_references.md) | 외부 URL 유일 등재처 — 공식 문서 · 릴리스 노트 | 신설 | W7(리드) |

검산: 전역 1 + 도메인 8 + 횡단 4 + README 1 = **14**. 파일 번호 02 · 10 · 11은 D-16 삭제 결번이라 다시 쓰지 않는다. 파일 번호 17 이상은 쓰지 않는다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 요구사항 ID | REQ-{도메인}-NN · 횡단 접두 GLB(전역) · NFR(비기능) · TEC(기술운영). 현행 **163** — GLB 25 · MST 13 · COL 16 · SIM 12 · GEN 14 · ING 18 · TSQ 16 · RLT 18 · OBS 12 · NFR 5 · TEC 14(검산 25 + 13 + 16 + 12 + 14 + 18 + 16 + 18 + 12 + 5 + 14 = **163**) · 채번 244 = 현행 163 + 결번 81(폐지 도메인 AUT 17 · ALM 20 · WRK 12 + 남은 접두 안 결번 19 + 폐지 표기 REQ-NFR 13 — D-16 측정 수단 삭제 · 행은 남긴다). 세는 자리는 각 파일의 요구사항 표 · 폐지 도메인 결번은 [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) §폐지 도메인 결번 |
| 인수 기준 | **현행 29** — AC-01~49 채번 · 결번 20(행 없음 6 — AC-09 · 26 · 27 · 35 · 36 · 38 + 폐지 표기 14 — 측정 수단 삭제 · D-16) · 구성은 정본 표가 센다 · 채번 정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md) |
| 성능 목표 | 실측 전 수치는 **미확인 — 확정 전 임의 값 고정 금지.** 원본의 목표치는 "원본 목표(4 vCPU 가정)"로 표기하고 로컬 첫 실측을 기준선으로 다시 잡는다 |
| 추적성 | 대응이 없는 칸은 비우지 않고 닫힌 어휘 **4**(해당 없음 · 내부 모듈 · 표면 없음 · 화면 없음(API 전용))로 적는다. 7축 현행 수와 미매핑 0 · 유령 0 — 정본 [15_traceability.md](./15_traceability.md) |
| 공식 참조 | 등재 **88** · 확인일 확인 30 · 미확인 58(부분 확인 1행 포함 · 착수 체크리스트 7번 · 단계 착수 때 대조) — 정본 [16_official_references.md](./16_official_references.md) |

## 관련 문서

- [../README.md](../README.md) — 전역 불변식 요약
- [../02_features/README.md](../02_features/README.md) — 기능 ID 채번 정본
- [../06_pipeline/README.md](../06_pipeline/README.md) — 흐름 F-NN
- [../10_observability/README.md](../10_observability/README.md) — 측정으로 요구사항을 검증하는 실험
