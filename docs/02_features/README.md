# 02_features — 기능 명세

> **대상**: db_study 11도메인의 기능 목록 · 권한 매트릭스 · Redis 역할 스위치 매트릭스
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(도메인 11 · 스위치 10) · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) · 원본 architecture.md §4 · §6 · §11 · 원본 data_flow.md §3~§12 · 원본 tech_stack.md §6 · §7 · 원본 implementation_plan.md §4(커밋 ff66a37)

"무슨 기능이 있는가"에 답하는 폴더다. 도메인 파일 11본이 NestJS 모듈과 1:1로 대응하며, 각 파일이 그 도메인의 **기능 ID {도메인}-NN을 채번**한다. 동작의 계약(입력 · 규칙 · 실패)은 이 폴더가 아니라 [../03_requirements](../03_requirements/README.md)가 갖는다 — 여기는 기능의 존재와 경계만 고정한다.

이 폴더는 이 프로젝트 고유 축인 **역할 스위치 SW-NN도 채번**한다. 스위치는 기능이 아니라 기능을 켜고 끄는 실험 손잡이지만, 어느 기능의 어느 구현이 교체되는지가 기능 목록과 한 자리에 있어야 해서 여기에 둔다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_auth.md](./01_auth.md) | AUT — 로그인 · 토큰 갱신 · 로그아웃 · 역할 기반 인가 · 레이트 리밋 | architecture §11 · §11.2 · §18 | W2 |
| [02_master.md](./02_master.md) | MST — 사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 마스터 CRUD · 태그 변경 이력 · 캐시 무효화 체인 | architecture §5 · §6 · §12 · data_flow §7 | W2 |
| [03_collector.md](./03_collector.md) | COL — Modbus 폴링 · 레지스터 블록 병합 · 디코딩 · 품질 판정 · 데드밴드 · Stream 발행 · 스풀 전환 | tech_stack §6 · data_flow §3 · architecture §9 | W2 |
| [04_plc_sim.md](./04_plc_sim.md) | SIM — Modbus TCP 서버 시뮬레이터 · 설비당 포트 · 지연·오류 주입 | tech_stack §6 · §7 · architecture §4 | W2 |
| [05_datagen.md](./05_datagen.md) | GEN — 신호 프로파일 8종 · 주입 모드 A~D · 시드 고정 · 백필 · 부하 주입 표면 | tech_stack §7 · data_flow §11 | W2 |
| [06_ingest.md](./06_ingest.md) | ING — Stream 소비 · 배치 적재 · 멱등 · 재시도 · DLQ · XAUTOCLAIM 회수 · 최신값 갱신 · **3계층 분기 실행** · 대조군 동시 적재 | architecture §9 · data_flow §4 · docs_plan 목표 1 | W2 |
| [07_timeseries.md](./07_timeseries.md) | TSQ — 시계열 조회 · 해상도 자동 선택 · 캐시 키 정규화 · 스탬피드 방지 · 다운샘플 · 내보내기 | architecture §10 · §11.1 · data_flow §6 | W2 |
| [08_realtime.md](./08_realtime.md) | RLT — 최신값 조회 · WebSocket 구독 · 스로틀 병합 · 재연결 동기화 | data_flow §5 · §9 | W2 |
| [09_alarms.md](./09_alarms.md) | ALM — 알람 규칙 · 디바운스 판정 · 이벤트 확정 · 확인 · 판정 전수 기록 | data_flow §8 · architecture §7.3 | W2 |
| [10_work_orders.md](./10_work_orders.md) | WRK — 작업지시 · 생산 실적 · 감사 로그 | architecture §5 · §6 | W2 |
| [11_metrics.md](./11_metrics.md) | OBS — /metrics 통합 노출 · 저장소 메트릭 수집 · 헬스체크 | architecture §14 · tech_stack §9 | W2 |
| [12_permission_matrix.md](./12_permission_matrix.md) | 횡단 — 역할 × 기능 권한 매트릭스 | architecture §6(role · user_role) · §18 | W2 |
| [13_switch_matrix.md](./13_switch_matrix.md) | ★ **SW-NN 채번 정본** — 스위치 10종 · 기본값 · off 동작 · 측정 대상 · 교체되는 포트 · 관련 기능 ID | implementation_plan §4 · docs_plan 스위치 표 | W2 |

검산: 도메인 11 + 횡단 2 + README 1 = **14**. 파일 번호 14 이상은 쓰지 않는다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 도메인 | **11개** — 파일 번호 01~11이 AUT · MST · COL · SIM · GEN · ING · TSQ · RLT · ALM · WRK · OBS 순서와 같다 |
| 기능 ID | **91** — AUT 7 · MST 9 · COL 9 · SIM 5 · GEN 10 · ING 13 · TSQ 9 · RLT 9 · ALM 9 · WRK 5 · OBS 6. 채번 자리는 각 도메인 파일의 기능 목록 표 · 세는 자리는 [12_permission_matrix.md](./12_permission_matrix.md) §검산 |
| 역할 | **3** — OPERATOR · ENGINEER · ADMIN(누적 아님 · 합집합 판정) |
| 역할 스위치 | **10종** — SW-01 REDIS_STREAM_BUFFER · SW-02 REDIS_LATEST_CACHE · SW-03 REDIS_QUERY_CACHE · SW-04 CACHE_KEY_TIME_SNAP · SW-05 CACHE_STAMPEDE_LOCK · SW-06 REDIS_PUBSUB_FANOUT · SW-07 WS_THROTTLE_MS · SW-08 INGEST_IDEMPOTENCY · SW-09 CONTROL_TABLE_ENABLED · SW-10 COLLECTOR_DEADBAND. 검산: 백프레셔 1 + 캐시 4 + 팬아웃 2 + 멱등 1 + 대조군 1 + 수집 1 = **10**. 기본값 on 8 · off 2(SW-09 · SW-10) |
| 스위치 구현 제약 | 스위치는 런타임 분기가 아니라 **DI로 주입되는 구현체**다(포트 하나에 구현 둘). 모듈 초기화 시 선택하므로 **전환은 재기동이 필요하다.** 제약의 정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 표면 없는 도메인 | COL · SIM · ING은 외부 API 표면이 없다. 기능은 있으나 호출 주체가 내부 모듈이다 |

## 관련 문서

- [../README.md](../README.md) — 고정 기준 · ID 규약
- [../03_requirements/README.md](../03_requirements/README.md) — 기능별 동작 계약
- [../06_pipeline/README.md](../06_pipeline/README.md) — 기능이 참여하는 데이터 흐름
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 스위치별 실험
