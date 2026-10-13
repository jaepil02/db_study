# 02_features — 기능 명세

> **대상**: db_study 8도메인의 기능 목록 · 기능 집계 · Redis 역할 스위치 매트릭스
> **작성일**: 2026-09-23
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 지우기 · 설비 가동 · HMI 개요 신설 · SW-09 gated**(사용자 결정 2026-10-11) — 기능 ID 현행 63 → **67**(GEN-13 · 14 · RLT-10 · 11) · 채번 93 → **97** · GEN 5 → **7** · RLT 8 → **10** · 05 · 08 행 내용 · 스위치 기본값 on 8 · off 2 → **on 8 · off 1(SW-10) · gated 1(SW-09)**
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지 · 도메인 11 → 8 · 대상 문서 파일 삭제) — 파일 01_auth · 09_alarms · 10_work_orders · 12_permission_matrix **삭제**(파일 번호 01 · 09 · 10 · 12 결번) · 도메인 11 → **8** · 기능 ID 현행 93 → **63**(채번 93 불변 · 결번 30) · 역할 3 → **0** · 기능 세는 자리 12_permission_matrix §검산 → **§기능 집계** · 05 행 주입 모드 A~D · 백필 · 부하 주입 표면 → A · B · 흐름 시연 실행 · 06 행 3계층 분기 → 두 갈래 분기 · 요청 출처 방어(옛 AUT-07)는 기능 ID 없는 횡단 방어선(정본 12_security/03 · 요구 REQ-GLB-25 · 26)
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28) — **GEN-11 성능 비교 라이브 실행 · GEN-12 흐름 시연 실행** — 기능 ID 91 → **93**(GEN 10 → **12**) · 05 행에 라이브 실행 제어
> **개정일**: 2026-09-27 — SW-12 BIZ_WRITE_PATH 신설 반영(D-04 부분 개정 · 사용자 결정 2026-09-27) — 역할 스위치 11 → **12종** · 구현 선택 1 → **2**
> **원천**: D-16(사용자 결정 2026-10-11) · [../README.md](../README.md)(스위치 12) · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md) · 원본 architecture.md §4 · §6 · §11 · 원본 data_flow.md §3~§12 · 원본 tech_stack.md §6 · §7 · 원본 implementation_plan.md §4(커밋 ff66a37)

"무슨 기능이 있는가"에 답하는 폴더다. 도메인 파일 8본이 NestJS 모듈과 1:1로 대응하며, 각 파일이 그 도메인의 **기능 ID {도메인}-NN을 채번**한다. 동작의 계약(입력 · 규칙 · 실패)은 이 폴더가 아니라 [../03_requirements](../03_requirements/README.md)가 갖는다 — 여기는 기능의 존재와 경계만 고정한다.

이 폴더는 이 프로젝트 고유 축인 **역할 스위치 SW-NN도 채번**한다. 스위치는 기능이 아니라 기능을 켜고 끄는 실험 손잡이지만, 어느 기능의 어느 구현이 교체되는지가 기능 목록과 한 자리에 있어야 해서 여기에 둔다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [02_master.md](./02_master.md) | MST — 사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 마스터 CRUD · 태그 변경 이력 · 캐시 무효화 체인 | architecture §5 · §6 · §12 · data_flow §7 | W2 |
| [03_collector.md](./03_collector.md) | COL — Modbus 폴링 · 레지스터 블록 병합 · 디코딩 · 품질 판정 · 데드밴드 · Stream 발행 · 스풀 전환 | tech_stack §6 · data_flow §3 · architecture §9 | W2 |
| [04_plc_sim.md](./04_plc_sim.md) | SIM — Modbus TCP 서버 시뮬레이터 · 설비당 포트 · 지연·오류 주입 | tech_stack §6 · §7 · architecture §4 | W2 |
| [05_datagen.md](./05_datagen.md) | GEN — 신호 프로파일 8종 · 주입 모드 A · B · 시드 고정 · 시드 데이터 생성 · **흐름 시연 실행 · 직접 비교 실행 · 센서 데이터 현황 · 지우기** | tech_stack §7 · data_flow §11 | W2 |
| [06_ingest.md](./06_ingest.md) | ING — Stream 소비 · 배치 적재 · 멱등 · 재시도 · DLQ · XAUTOCLAIM 회수 · 최신값 갱신 · **두 갈래 분기 실행** · 대조군 동시 적재 | architecture §9 · data_flow §4 · docs_plan 목표 1 | W2 |
| [07_timeseries.md](./07_timeseries.md) | TSQ — 시계열 조회 · 해상도 자동 선택 · 캐시 키 정규화 · 스탬피드 방지 · 다운샘플 · 내보내기 | architecture §10 · §11.1 · data_flow §6 | W2 |
| [08_realtime.md](./08_realtime.md) | RLT — 최신값 조회 · WebSocket 구독 · 스로틀 병합 · 재연결 동기화 · **설비 가동 스위치 · HMI 설비 개요** | data_flow §5 · §9 | W2 |
| [11_metrics.md](./11_metrics.md) | OBS — /metrics 통합 노출 · 저장소 메트릭 수집 · 헬스체크 | architecture §14 · tech_stack §9 | W2 |
| [13_switch_matrix.md](./13_switch_matrix.md) | ★ **SW-NN 채번 정본** — 스위치 12종 · 기본값 · off 동작 · 측정 대상 · 교체되는 포트 · 관련 기능 ID | implementation_plan §4 · docs_plan 스위치 표 | W2 |

검산: 도메인 8 + 횡단 1 + README 1 = **10**. 파일 번호 01 · 09 · 10 · 12는 D-16으로 삭제한 결번이다 — 다시 쓰지 않는다. 파일 번호 14 이상은 쓰지 않는다.

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 도메인 | **8개** — 파일 번호 02~08 · 11이 MST · COL · SIM · GEN · ING · TSQ · RLT · OBS 순서와 같다. 옛 AUT(01) · ALM(09) · WRK(10)는 D-16 폐지 |
| 기능 ID | **현행 67** · 채번 97 — 채번 자리는 각 도메인 파일의 기능 목록 표 · 세는 자리는 §기능 집계 |
| 역할 | **0** — 로그인 · 권한이 없다(D-16). 모든 표면은 무인증이고, 요청 출처 방어는 기능 ID 없는 횡단 방어선이다(정본 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) |
| 역할 스위치 | **12종** — SW-01 REDIS_STREAM_BUFFER · SW-02 REDIS_LATEST_CACHE · SW-03 REDIS_QUERY_CACHE · SW-04 CACHE_KEY_TIME_SNAP · SW-05 CACHE_STAMPEDE_LOCK · SW-06 REDIS_PUBSUB_FANOUT · SW-07 WS_THROTTLE_MS · SW-08 INGEST_IDEMPOTENCY · SW-09 CONTROL_TABLE_ENABLED · SW-10 COLLECTOR_DEADBAND · SW-11 LATEST_VALUE_WRITER · SW-12 BIZ_WRITE_PATH. 검산: 백프레셔 1 + 캐시 4 + 팬아웃 2 + 멱등 1 + 대조군 1 + 수집 1 + 최신값 결합 1 + 업무 쓰기 경유 1 = **12**. 기본값 on 8 · off 1(SW-10) · gated 1(SW-09 — 직접 비교 실행 중에만 PostgreSQL에도 · D-16) · 구현 선택 2(SW-11 = ingest · SW-12 = stream) |
| 스위치 구현 제약 | 스위치는 런타임 분기가 아니라 **DI로 주입되는 구현체**다(포트 하나에 구현 둘). 모듈 초기화 시 선택하므로 **전환은 재기동이 필요하다.** 제약의 정본 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 표면 없는 도메인 | COL · SIM · ING은 외부 API 표면이 없다. 기능은 있으나 호출 주체가 내부 모듈이다 |

## 기능 집계

기능 ID를 세는 유일한 자리다. 채번은 각 도메인 파일의 기능 목록 표가 하고, 여기서는 현행과 결번을 함께 센다.

| 도메인 | 파일 | 현행 | 결번 | 채번 |
|------|------|:--:|:--:|:--:|
| MST | [02_master.md](./02_master.md) | 9 | 0 | 9 |
| COL | [03_collector.md](./03_collector.md) | 9 | 0 | 9 |
| SIM | [04_plc_sim.md](./04_plc_sim.md) | 5 | 0 | 5 |
| GEN | [05_datagen.md](./05_datagen.md) | 7 | 7(GEN-04 · 06~11) | 14 |
| ING | [06_ingest.md](./06_ingest.md) | 12 | 1(ING-09) | 13 |
| TSQ | [07_timeseries.md](./07_timeseries.md) | 9 | 0 | 9 |
| RLT | [08_realtime.md](./08_realtime.md) | 10 | 1(RLT-08) | 11 |
| OBS | [11_metrics.md](./11_metrics.md) | 6 | 0 | 6 |
| AUT(폐지 도메인) | 삭제 | 0 | 7(AUT-01~07) | 7 |
| ALM(폐지 도메인) | 삭제 | 0 | 9(ALM-01~09) | 9 |
| WRK(폐지 도메인) | 삭제 | 0 | 5(WRK-01~05) | 5 |
| **계** | 해당 없음 | **67** | **30** | **97** |

- 검산: 현행 9 + 9 + 5 + 7 + 12 + 9 + 10 + 6 = **67** · 결번 7 + 1 + 1 + 7 + 9 + 5 = **30** · 채번 67 + 30 = **97**
- **폐지 도메인의 결번 행(기능명 · 폐지 사유)은 [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) §폐지 도메인 결번이 갖는다.** 파일을 지워 채번 정본 표가 사라졌으므로 결번 영구 보존 규칙의 자리를 ID 규약 정본으로 옮겼다. 폐지 전 원문은 커밋 28c0cc9에 있다.
- **옛 AUT-07(요청 출처 방어)은 다른 기능 ID로 옮기지 않았다.** CORS 단일 오리진 · Host 대조 · WebSocket Origin 검증은 전 표면에 끼어드는 방어선이라 도메인 기능이 아니다 — 요구는 [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) REQ-GLB-25 · 26, 방어 지점 정본은 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)다.

## 관련 문서

- [../README.md](../README.md) — 고정 기준 · ID 규약
- [../03_requirements/README.md](../03_requirements/README.md) — 기능별 동작 계약
- [../06_pipeline/README.md](../06_pipeline/README.md) — 기능이 참여하는 데이터 흐름
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — 스위치별 실험
