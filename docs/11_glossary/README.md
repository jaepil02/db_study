# 11_glossary — 용어

> **대상**: db_study의 어휘 — 도메인 용어 · 에러 코드 · enum과 상태 머신 · ID 규약 · 단위와 시각
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(열거 집합 · ID 규약 · 단위와 시각) · 원본 tech_stack.md §6 · §7 · 원본 data_flow.md §3.2 · §8.1 · §14 · 원본 architecture.md §6 · §9.2 · §9.3 · §12(커밋 ff66a37)

"이 낱말이 무슨 뜻인가"에 답하는 폴더다. **에러 코드 · enum 값 · ID 규약을 채번**한다. 막히면 가장 먼저 오는 폴더이므로 다른 폴더보다 먼저(W1) 쓴다 — 뒤 웨이브의 문서가 여기 어휘를 인용한다.

**시각 의미론은 이 폴더가 정본이다.** 시계열 시스템의 가장 흔한 버그가 시간대 혼동이고, 원본에도 "모든 시각 UTC 저장"과 "tag_raw.ts DateTime64(3, 'Asia/Seoul')"이 나란히 적혀 있다. 둘은 모순이 아니라(ClickHouse 컬럼 시간대는 표시·파싱 속성이다) 설명이 빠진 것이며, [05_units_and_time.md](./05_units_and_time.md)가 그 설명을 고정한다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_domain_terms.md](./01_domain_terms.md) | PLC · Modbus(FC · 레지스터 · 워드 순서 · 유닛 ID) · 스캔 그룹 · 데드밴드 · 공학 단위 변환 · 시계열 · 롤업 · PEL · 컨슈머 랙 · 백프레셔 용어 | tech_stack §6 · data_flow §3 · §4 | W1 |
| [02_error_codes.md](./02_error_codes.md) | **에러 코드 채번 정본** — {domain}.{snake_case} + HTTP 상태 · 네임스페이스 · 발생 조건 · 종수 산정 기준 | architecture §11 · §17 · data_flow §5 · §12 | W1 |
| [03_enums_state_machines.md](./03_enums_state_machines.md) | 품질 코드 7 · 신호 프로파일 8 · 데이터 타입 · 워드 순서 · 알람 상태 머신과 alarm_event.state 대응 · 배치 재시도 상태 전이 · 백프레셔 5단계 · 작업지시 상태 | data_flow §3.2 · §8.1 · architecture §6 · §9.2 · §9.3 · tech_stack §6 · §7 | W1 |
| [04_id_conventions.md](./04_id_conventions.md) | **ID 규약 정본** — 채번 규칙 · 말미 채번 · 결번 보존 · 예약 대역 · 원본 흐름 표기 F1 → F-01 대응 · Redis 키 · 메트릭 이름 규약 위임(10_observability/01) · 측정 기록 파일명 | 루트 README ID 규약 · data_flow §1 | W1 |
| [05_units_and_time.md](./05_units_and_time.md) | ★ **ts vs ingested_at** · epoch ms · 기준값 + 오프셋 인코딩 · 저장 시간대와 표시 시간대 · 버킷 경계 · 공학 단위 · Float64와 오차 허용 비교 | architecture §6 · §7.1 · §12 · data_flow §14 · §15 | W1 |

검산: 본문 5 + README 1 = **6**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 품질 코드 | **7** — 0 GOOD · 1 UNCERTAIN · 2 BAD_COMM · 3 BAD_TIMEOUT · 4 BAD_RANGE · 5 STALE · 9 SIMULATED(6~8은 결번) |
| 신호 프로파일 | **8** — SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT |
| 알람 상태 | **5** — NORMAL · PENDING · ACTIVE · CLEARING · ACKED |
| 백프레셔 단계 | **5** — 정상 · 주의 · 경고 · 위험 · 복구 |
| 에러 코드 | **19종** · 네임스페이스 정의 9 · 코드 보유 8 — 정본 [02_error_codes.md](./02_error_codes.md) |
| 시각 | ts = 측정 시각 · ingested_at = 적재 시각 · 저장 epoch · 표시 Asia/Seoul |

## 관련 문서

- [../README.md](../README.md) — ID 규약 요약 · 고정 기준
- [../07_api/02_errors.md](../07_api/02_errors.md) — 에러 코드 미러
- [../05_data_stores/README.md](../05_data_stores/README.md) — enum이 앉는 컬럼
