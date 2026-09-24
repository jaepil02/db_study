# 추적성 — 기능 ↔ 요구사항 ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블

> **대상**: 기능 91 전수의 요구사항 · 흐름 · 화면 · API 문서 · 저장 객체 대응 · 요구사항 229의 역방향 검산 · 흐름 10 · 화면 10 · API 문서 9 · 저장 객체 24 · AC 45 축별 검산 · 미매핑 0 · 유령 0 · 재생성 규칙
> **작성일**: 2026-09-24
> **원천**: 기능 정본 [../02_features/README.md](../02_features/README.md) 도메인 파일 11본의 기능 표(흐름 · 표면 · 저장소 열) · 요구사항 정본 이 폴더 01~13의 요구사항 표(관련 기능 열) · 기능 → 화면 정본 [../08_screen/02_traceability.md](../08_screen/02_traceability.md) · AC 정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md) · 저장 객체 정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · 원본 없음(신설)

이 문서는 **추적성 3중 중 전역 매트릭스**다. 아무것도 채번하지 않고, 대응을 새로 정하지도 않는다 — 모든 칸은 정본 표의 열을 모아 뒤집은 것이다. 그래서 정본과 이 문서가 어긋나면 **정본이 맞고 이 문서가 낡은 것이다.** 정본의 대응 열을 고친 변경 단위에서 이 문서를 다시 만든다(§재생성 규칙).

**미매핑 0 · 유령 0이 이 문서의 합격선이다.** 미매핑은 어느 축에서도 짝이 없는 ID이고, 유령은 정본에 없는 ID를 가리키는 참조다. 둘 중 하나라도 있으면 설계가 구현보다 먼저 거짓말을 한다 — 요구사항 없는 기능은 검증되지 않은 채 구현되고, 없는 기능을 가리키는 요구사항은 아무도 만족시키지 않는 계약으로 남는다.

## 추적성 3중

| 층 | 자리 | 무엇을 잇는가 |
|------|------|------|
| 전역 매트릭스 | 이 문서 | 기능 ↔ 요구사항 ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전수 |
| 고빈도 축 전용 매트릭스 | [../08_screen/02_traceability.md](../08_screen/02_traceability.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대응 검산 | 기능 → 화면 · 역할 × 기능 · 스위치 → 기능 · 흐름 · 스위치 · AC · REQ-NFR → 실험 |
| 문서별 지역 절 | 각 문서의 관련 기능 · 관련 흐름 · 근거 요구 열 | 그 문서 안의 항목 하나가 어디서 왔고 어디로 가는가 |

- 검산: 층 = **3**
- 이 문서는 고빈도 축의 대응을 다시 적지 않는다. 화면 열은 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 분류와 주 화면만 옮기고, 실험 대응은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 닫는다.

## 닫힌 어휘

대응이 없는 칸은 비우지 않고 아래 어휘로 채운다([README.md](./README.md) 고정 기준 추적성).

| 어휘 | 뜻 | 쓰는 열 |
|------|------|------|
| 해당 없음 | 그 축에 대응할 대상이 원리상 없다 — 예: 관측 기능의 흐름 · 저장 객체가 없는 기능 | 흐름 · 저장 객체 · 요구사항 |
| 내부 모듈 | 도메인 자체에 외부 표면이 없다 — COL · SIM · ING | 화면 · API |
| 표면 없음 | 표면이 있는 도메인의 기능이지만 내부 단계 · 실행 인자라 표면이 없다 | 화면 · API |
| 화면 없음(API 전용) | 표면은 있으나 호출 주체가 기계다 | 화면 |

- 검산: 어휘 = **4**

## 전역 매트릭스

열의 출처 — 요구사항은 요구사항 표의 관련 기능 열을 뒤집은 것, 흐름 · API · 저장 객체는 기능 표의 흐름 · 표면 · 저장소 열, 화면은 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 분류 · 주 화면이다. 요구사항 ID는 접두 REQ-를 줄여 적는다(예: AUT-01은 REQ-AUT-01).

### AUT — 인증

정본 [../02_features/01_auth.md](../02_features/01_auth.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| AUT-01 | 로그인 | AUT-01 · AUT-02 · AUT-03 · AUT-04 · AUT-14 · AUT-15 · AUT-17 · GLB-08 · TEC-05 | F-05 | AUTH-LOGIN | 03_auth | PostgreSQL user_account · user_role · Redis auth:refresh |
| AUT-02 | 토큰 갱신 | AUT-04 · AUT-05 · AUT-14 | F-05 | AUTH-LOGIN | 03_auth | Redis auth:refresh |
| AUT-03 | 로그아웃 | AUT-06 · AUT-14 | F-05 | AUTH-LOGIN | 03_auth | Redis auth:refresh |
| AUT-04 | 신원 확인 | AUT-07 · AUT-08 · AUT-16 · GLB-19 | F-03 · F-04 · F-05 · F-07 | 공통 셸 | 11_websocket | 없음 — 무상태 검증 |
| AUT-05 | 역할 기반 인가 | AUT-09 · AUT-10 · AUT-15 · AUT-16 · AUT-17 · GLB-19 | F-03 · F-04 · F-05 · F-06 · F-07 · F-09 | 공통 셸 | 인가 대상 전 표면 | PostgreSQL role · user_role · Redis cache 계열(권한 사본) |
| AUT-06 | 레이트 리밋 | AUT-11 · AUT-14 · GLB-08 | F-03 · F-04 · F-05 | 공통 셸 | 인증 필요 전 REST 표면 | Redis rl |
| AUT-07 | 요청 출처 방어 | AUT-12 · AUT-13 · GLB-19 · TEC-02 | F-03 · F-04 · F-07 | 공통 셸 | 11_websocket | 해당 없음 |

- 검산: AUT 기능 = **7**

### MST — 마스터

정본 [../02_features/02_master.md](../02_features/02_master.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| MST-01 | 사이트 · 라인 관리 | GLB-24 · MST-01 · MST-14 · MST-15 · TEC-05 | F-05 | ADM-MASTER | 04_master | PostgreSQL site · production_line · Redis cache 계열 |
| MST-02 | 설비 관리 | GLB-24 · MST-02 · MST-14 · MST-15 | F-05 | ADM-MASTER | 04_master | PostgreSQL device · Redis cache:devlist |
| MST-03 | Modbus 접속 설정 관리 | GLB-24 · MST-03 · MST-14 · MST-15 | F-01 · F-05 | ADM-MASTER | 04_master | PostgreSQL modbus_config |
| MST-04 | 태그 마스터 관리 | GLB-12 · GLB-24 · MST-04 · MST-05 · MST-14 · MST-15 · NFR-09 | F-05 | ADM-MASTER | 04_master | PostgreSQL tag_master · audit_log(WRK 소유) |
| MST-05 | 태그 논리 삭제 | GLB-14 · GLB-24 · MST-05 · MST-06 · MST-08 · MST-15 | F-05 | ADM-MASTER | 04_master | PostgreSQL tag_master |
| MST-06 | 스케일 변경 시 새 태그 발급 | GLB-14 · GLB-24 · MST-05 · MST-07 · MST-15 | F-05 | ADM-MASTER | 04_master | PostgreSQL tag_master · tag_master_history |
| MST-07 | 태그 메타 캐시 | GLB-08 · MST-13 | F-01 · F-03 | 표면 없음 | 표면 없음 — 다른 기능의 내부 조회 | Redis cache:tagmeta |
| MST-08 | 캐시 무효화 체인 | GLB-09 · MST-09 · MST-10 | F-05 | 표면 없음 | 표면 없음 — 쓰기 표면의 후처리 | Redis cache 계열 · ch:cacheinv · ClickHouse dict_tag |
| MST-09 | Dictionary 원천 제공 | GLB-11 · GLB-14 · MST-08 · MST-10 · MST-11 · MST-12 · TEC-14 | F-04 · F-08 | 표면 없음 | 표면 없음 — TSQ-07이 소비 | PostgreSQL tag_master · ClickHouse dict_tag |

- 검산: MST 기능 = **9**

### COL — 수집

정본 [../02_features/03_collector.md](../02_features/03_collector.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| COL-01 | 수집 정의 로드 | COL-01 · COL-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis cache:tagmeta · PostgreSQL tag_master · modbus_config(읽기) |
| COL-02 | 스캔 그룹 폴링 | COL-02 · COL-03 · COL-14 · COL-15 · GLB-02 · NFR-04 · TEC-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음(PlcSim 소켓) |
| COL-03 | 레지스터 블록 병합 | COL-04 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-04 | 디코딩 · 공학 단위 변환 | COL-05 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-05 | 품질 판정 | COL-06 · COL-07 · COL-15 · GLB-18 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-06 | 데드밴드 필터 | COL-08 · COL-15 · COL-16 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-07 | 인코딩 · Stream 발행 | COL-09 · COL-10 · COL-15 · COL-16 · GLB-03 · GLB-04 · GLB-08 · GLB-10 · GLB-16 · GLB-21 · NFR-04 | F-01 · F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |
| COL-08 | 발행량 감축 | COL-11 · COL-15 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| COL-09 | 스풀 전환과 재발행 | COL-12 · COL-13 · COL-15 · GLB-09 · GLB-10 · TEC-03 · TEC-06 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | spooldata 볼륨(저장소 밖) · Redis stream:plc:raw |

- 검산: COL 기능 = **9**

### SIM — PLC 시뮬레이터

정본 [../02_features/04_plc_sim.md](../02_features/04_plc_sim.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| SIM-01 | 설비당 Modbus TCP 서버 | GLB-19 · SIM-01 · SIM-02 · SIM-03 · SIM-07 · SIM-11 · SIM-12 · TEC-02 · TEC-15 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 |
| SIM-02 | 레지스터 응답 | SIM-04 · SIM-05 · SIM-07 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| SIM-03 | 레지스터 런타임 갱신 | SIM-06 · SIM-11 | F-01 · F-09 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 Buffer |
| SIM-04 | 지연 주입 | SIM-08 · SIM-10 | F-01 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |
| SIM-05 | 오류 주입 | SIM-09 · SIM-10 | F-01 | 내부 모듈 | 표면 없음 — 내부 모듈 | 해당 없음 |

- 검산: SIM 기능 = **5**

### GEN — 데이터 생성기

정본 [../02_features/05_datagen.md](../02_features/05_datagen.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| GEN-01 | 신호 프로파일 생성 | GEN-01 · GEN-13 · GLB-20 · NFR-14 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 없음 — 메모리 |
| GEN-02 | 품질 표지와 결측 표현 | GEN-02 · GLB-18 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-03 | 시드 고정 | GEN-03 · GLB-23 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-04 | 부하 티어 설정 | GEN-04 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-05 | 모드 A 레지스터 갱신 | GEN-05 · GEN-06 | F-01 · F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 없음(SIM Buffer) |
| GEN-06 | 모드 B Stream 직결 | GEN-05 · GEN-07 · GLB-03 · GLB-10 · GLB-21 · NFR-06 | F-02 · F-09 | 표면 없음 | 표면 없음 — 실행 인자 | Redis stream:plc:raw |
| GEN-07 | 모드 C 부하 주입 표면 | GEN-05 · GEN-08 · GEN-09 · GEN-15 · GLB-03 · GLB-10 · GLB-21 · NFR-06 · NFR-11 | F-09 · F-10 | 화면 없음(API 전용) | 09_datagen | Redis stream:plc:raw |
| GEN-08 | 모드 D 백필 | GEN-05 · GEN-10 · GEN-11 · GLB-15 | F-08 · F-09 | 표면 없음 | 표면 없음 — 실행 인자 | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(쓰기 · 소유 아님) |
| GEN-09 | 생성기 단독 처리량 실측 | GEN-12 · GEN-13 · GLB-17 · NFR-01 · NFR-17 · TEC-12 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | 해당 없음 |
| GEN-10 | 대조군 동일 행 백필 | GEN-14 · NFR-18 | F-09 | 표면 없음 | 표면 없음 — 실행 인자 | PostgreSQL plc_tag_raw_control(쓰기 · 소유 아님) |

- 검산: GEN 기능 = **10**

### ING — 적재

정본 [../02_features/06_ingest.md](../02_features/06_ingest.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| ING-01 | Stream 소비 | GLB-03 · GLB-20 · GLB-21 · ING-01 · ING-02 · ING-18 · NFR-05 · NFR-06 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw · 컨슈머 그룹 |
| ING-02 | 배치 누적과 플러시 | ING-03 · ING-04 · ING-18 · NFR-04 · NFR-13 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 메모리 버퍼 |
| ING-03 | ClickHouse 배치 삽입 | GLB-01 · GLB-02 · ING-05 · ING-18 · NFR-01 · NFR-03 · NFR-04 · NFR-13 · NFR-14 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| ING-04 | 멱등 토큰 | GLB-06 · ING-06 · ING-18 · NFR-02 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw |
| ING-05 | 재시도 · 격리 · XACK | GLB-05 · GLB-06 · GLB-08 · GLB-16 · ING-07 · ING-08 · ING-18 · NFR-01 · NFR-02 | F-02 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:dlq |
| ING-06 | PEL 회수 | GLB-05 · ING-09 · ING-18 · TEC-06 | F-02 · F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 PEL |
| ING-07 | 다중 컨슈머 | GLB-07 · ING-04 · ING-10 · ING-18 · NFR-05 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis 컨슈머 그룹 |
| ING-08 | 최신값 갱신 · 복원 | GLB-07 · GLB-08 · GLB-11 · ING-11 · ING-12 · ING-18 | F-02 · F-03 · F-07 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis rt:latest · ch:rt |
| ING-09 | 알람 판정 전달 | GLB-04 · GLB-13 · ING-13 · ING-18 · NFR-04 | F-06 | 내부 모듈 | 표면 없음 — 내부 모듈 | 없음 — 호출 |
| ING-10 | 3계층 분기 실행 | GLB-12 · ING-14 · ING-18 | F-02 · F-06 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_raw · 호출(ALM) |
| ING-11 | 대조군 동시 적재 | GLB-11 · ING-15 · ING-18 · NFR-18 | F-02 | 내부 모듈 | 표면 없음 — 내부 모듈 | PostgreSQL plc_tag_raw_control |
| ING-12 | 롤업 캐스케이드 발동 | GLB-15 · ING-16 · ING-18 | F-08 | 내부 모듈 | 표면 없음 — 내부 모듈 | ClickHouse tag_1m · tag_1h · tag_1d · MV 3 |
| ING-13 | 백프레셔 대응 · 적체 소진 | GLB-05 · GLB-10 · ING-12 · ING-17 · ING-18 · NFR-16 | F-10 | 내부 모듈 | 표면 없음 — 내부 모듈 | Redis stream:plc:raw |

- 검산: ING 기능 = **13**

### TSQ — 시계열 조회

정본 [../02_features/07_timeseries.md](../02_features/07_timeseries.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| TSQ-01 | 시계열 조회 | GLB-02 · GLB-07 · GLB-15 · GLB-24 · NFR-08 · TSQ-01 · TSQ-02 · TSQ-05 · TSQ-07 · TSQ-16 · TSQ-17 | F-04 | ANL-TREND | 05_timeseries | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(읽기) |
| TSQ-02 | 해상도 자동 선택 | TSQ-03 · TSQ-04 | F-04 | ANL-TREND | 05_timeseries | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d(읽기) |
| TSQ-03 | 캐시 키 정규화 | NFR-10 · TSQ-09 · TSQ-14 | F-04 | 표면 없음 | 표면 없음 — TSQ-04의 내부 단계 | Redis cache:q |
| TSQ-04 | 조회 결과 캐시 | GLB-09 · GLB-23 · NFR-08 · NFR-10 · TSQ-10 · TSQ-11 · TSQ-14 · TSQ-16 | F-04 | 표면 없음 | 표면 없음 — TSQ-01의 내부 단계 | Redis cache:q |
| TSQ-05 | 스탬피드 방지 | TSQ-12 · TSQ-14 | F-04 | 표면 없음 | 표면 없음 — TSQ-01의 내부 단계 | Redis lock:rebuild |
| TSQ-06 | 다운샘플 | GLB-20 · TSQ-06 · TSQ-07 | F-04 | ANL-TREND | 05_timeseries | 없음 — 계산 |
| TSQ-07 | 태그 메타 부착 | GLB-14 · TSQ-08 | F-04 | ANL-TREND | 05_timeseries | ClickHouse dict_tag(읽기) |
| TSQ-08 | 진행 구간 분할 | TSQ-13 | F-04 · F-03 | DSH-REALTIME | 05_timeseries | Redis cache:q · rt:latest(읽기) |
| TSQ-09 | 원시 내보내기 | GLB-24 · TSQ-15 · TSQ-16 · TSQ-17 | F-04 | ANL-TREND | 05_timeseries | ClickHouse tag_raw(읽기) |

- 검산: TSQ 기능 = **9**

### RLT — 실시간

정본 [../02_features/08_realtime.md](../02_features/08_realtime.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| RLT-01 | 설비 전체 최신값 | GLB-24 · NFR-07 · RLT-01 · RLT-06 · RLT-07 · RLT-08 · RLT-18 | F-03 | DSH-REALTIME | 06_realtime | Redis rt:latest(읽기) |
| RLT-02 | 단일 태그 최신값 | GLB-24 · NFR-07 · RLT-02 · RLT-06 · RLT-07 · RLT-08 · RLT-18 | F-03 | DSH-REALTIME | 06_realtime | Redis rt:latest · cache:tagmeta(읽기) |
| RLT-03 | STALE 판정 · 메타 부착 | GLB-01 · GLB-02 · RLT-03 · RLT-04 · RLT-16 | F-03 | DSH-REALTIME | 06_realtime | Redis cache:tagmeta(읽기) |
| RLT-04 | 빈 키 복원과 503 | GLB-09 · RLT-05 · RLT-06 | F-03 · F-10 | DSH-REALTIME | 06_realtime | ClickHouse tag_raw(읽기) · Redis rt:latest · lock:rebuild |
| RLT-05 | WebSocket 구독 | NFR-12 · RLT-09 · RLT-10 · RLT-17 · RLT-18 | F-07 | DSH-REALTIME | 11_websocket | Redis ch:rt(구독) |
| RLT-06 | 스로틀 병합 | NFR-12 · RLT-11 | F-07 | DSH-REALTIME | 11_websocket | 없음 — 메모리 |
| RLT-07 | 연결 관리 · 재연결 동기화 | RLT-10 · RLT-12 · RLT-13 | F-07 · F-03 | DSH-REALTIME | 11_websocket | Redis ch:rt · rt:latest |
| RLT-08 | 알람 푸시 | RLT-14 · RLT-17 | F-06 · F-07 | ALM-CONSOLE | 11_websocket | Redis ch:alarm(구독) |
| RLT-09 | 무효화 신호 중계 | RLT-15 | F-05 | 공통 셸 | 11_websocket | Redis ch:cacheinv(구독) |

- 검산: RLT 기능 = **9**

### ALM — 알람

정본 [../02_features/09_alarms.md](../02_features/09_alarms.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| ALM-01 | 알람 규칙 관리 | ALM-01 · ALM-02 · ALM-03 · ALM-04 · ALM-18 · ALM-19 · ALM-20 · GLB-24 | F-05 | ALM-RULES | 07_alarms | PostgreSQL alarm_rule · Redis cache:alarmrules |
| ALM-02 | 규칙 캐시 | ALM-02 · ALM-05 · ALM-20 | F-06 | 표면 없음 | 표면 없음 — ALM-03의 내부 단계 | Redis cache:alarmrules |
| ALM-03 | 디바운스 판정 | ALM-06 · ALM-07 · ALM-08 · ALM-20 · GLB-01 · GLB-13 | F-06 | 표면 없음 | 표면 없음 — ING-09가 호출 | Redis alarm:state |
| ALM-04 | 이벤트 확정 | ALM-09 · ALM-10 · ALM-16 · ALM-19 · ALM-20 · GLB-13 | F-06 | 표면 없음 | 표면 없음 — ALM-03의 후속 | PostgreSQL alarm_event(월 파티션) |
| ALM-05 | 판정 전수 기록 | ALM-11 · ALM-20 · GLB-13 | F-06 | 표면 없음 | 표면 없음 — ALM-03의 후속 | ClickHouse alarm_eval |
| ALM-06 | 발생 · 해제 발행 | ALM-10 · ALM-12 · ALM-20 | F-06 · F-07 | 표면 없음 | 표면 없음 — RLT-08이 전달 | Redis ch:alarm |
| ALM-07 | 알람 이벤트 조회 | ALM-13 · ALM-18 · ALM-19 · ALM-20 · GLB-24 | F-06 | ALM-CONSOLE | 07_alarms | PostgreSQL alarm_event(읽기) |
| ALM-08 | 알람 확인 | ALM-14 · ALM-15 · ALM-16 · ALM-18 · ALM-19 · ALM-20 · GLB-24 | F-06 | ALM-CONSOLE | 07_alarms | PostgreSQL alarm_event |
| ALM-09 | 판정 이력 분석 | ALM-17 · ALM-20 · GLB-24 | F-06 | ALM-RULES | 07_alarms | ClickHouse alarm_eval(읽기) |

- 검산: ALM 기능 = **9**

### WRK — 작업지시 · 실적

정본 [../02_features/10_work_orders.md](../02_features/10_work_orders.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| WRK-01 | 작업지시 관리 | GLB-12 · GLB-24 · NFR-09 · WRK-01 · WRK-02 · WRK-03 · WRK-06 · WRK-11 · WRK-12 | F-05 | ADM-WORKORDER | 08_work_orders | PostgreSQL work_order · Redis cache 계열 |
| WRK-02 | 작업지시 상태 관리 | GLB-24 · WRK-01 · WRK-04 · WRK-06 · WRK-11 · WRK-12 | F-05 | ADM-WORKORDER | 08_work_orders | PostgreSQL work_order |
| WRK-03 | 생산 실적 기록 | GLB-24 · WRK-01 · WRK-05 · WRK-06 · WRK-11 · WRK-12 | F-05 | ADM-WORKORDER | 08_work_orders | PostgreSQL production_log |
| WRK-04 | 감사 로그 기록 | WRK-01 · WRK-07 · WRK-08 · WRK-09 · WRK-12 | F-05 | 표면 없음 | 표면 없음 — 쓰기 표면의 트랜잭션 안 단계 | PostgreSQL audit_log |
| WRK-05 | 감사 로그 조회 | GLB-24 · WRK-06 · WRK-09 · WRK-10 · WRK-12 | F-05 | ADM-AUDIT | 08_work_orders | PostgreSQL audit_log(읽기) |

- 검산: WRK 기능 = **5**

### OBS — 관측

정본 [../02_features/11_metrics.md](../02_features/11_metrics.md)

| 기능 ID | 기능명 | 요구사항 | 흐름 | 화면 | API | 저장 객체 |
|------|------|------|------|------|------|------|
| OBS-01 | 앱 메트릭 통합 노출 | GLB-16 · GLB-20 · GLB-22 · NFR-11 · NFR-15 · OBS-01 · OBS-02 · OBS-06 · OBS-07 · OBS-10 · TEC-01 · TEC-12 | 해당 없음 — 관측 | EXP-COMPARE | 10_metrics | 해당 없음 |
| OBS-02 | 저장소 메트릭 수집 | GLB-22 · OBS-01 · OBS-03 · OBS-06 · TEC-07 | 해당 없음 — 관측 | EXP-CONSOLE | 10_metrics | 세 저장소 카탈로그(읽기) |
| OBS-03 | 키 계열별 메모리 샘플링 | OBS-04 | 해당 없음 — 관측 | EXP-CONSOLE | 10_metrics | Redis(샘플 읽기) |
| OBS-04 | E2E 지연 게이지 | GLB-01 · NFR-03 · OBS-05 | 해당 없음 — 관측 | EXP-CONSOLE | 10_metrics | ClickHouse tag_raw(읽기) |
| OBS-05 | 헬스체크 | OBS-08 · OBS-09 · OBS-10 · TEC-03 | 해당 없음 — 관측 | EXP-CONSOLE | 10_metrics | 세 저장소(핑) |
| OBS-06 | 스위치 상태 노출 | GLB-04 · GLB-16 · GLB-17 · OBS-10 · OBS-11 · OBS-12 · TEC-10 | 해당 없음 — 관측 | EXP-CONSOLE | 10_metrics | 해당 없음 |

- 검산: OBS 기능 = **6**

## 기능 축 검산

| 도메인 | 기능 | 요구사항 있음 | 흐름 · 해당 없음 | 화면 분류 확정 |
|------|:--:|:--:|:--:|:--:|
| AUT | 7 | 7 | 7 | 7 |
| MST | 9 | 9 | 9 | 9 |
| COL | 9 | 9 | 9 | 9 |
| SIM | 5 | 5 | 5 | 5 |
| GEN | 10 | 10 | 10 | 10 |
| ING | 13 | 13 | 13 | 13 |
| TSQ | 9 | 9 | 9 | 9 |
| RLT | 9 | 9 | 9 | 9 |
| ALM | 9 | 9 | 9 | 9 |
| WRK | 5 | 5 | 5 | 5 |
| OBS | 6 | 6 | 6 | 6 |
| **계** | **91** | **91** | **91** | **91** |

- 검산: 기능 = 7 + 9 + 9 + 5 + 10 + 13 + 9 + 9 + 9 + 5 + 6 = **91** · 요구사항 없는 기능 **0** · 화면 분류 없는 기능 **0**

## 요구사항 역방향 검산

요구사항 229 각각이 기능을 하나 이상 가리키거나, 닫힌 어휘로 "해당 없음"을 밝힌다. 가리키는 기능 ID가 기능 정본에 모두 있다(유령 0).

| 접두 | 요구사항 | 기능을 가리킴 | 해당 없음 | 유령 |
|------|:--:|:--:|:--:|:--:|
| GLB | 24 | 24 | 0 | 0 |
| AUT | 17 | 17 | 0 | 0 |
| MST | 15 | 15 | 0 | 0 |
| COL | 16 | 16 | 0 | 0 |
| SIM | 12 | 12 | 0 | 0 |
| GEN | 15 | 15 | 0 | 0 |
| ING | 18 | 18 | 0 | 0 |
| TSQ | 17 | 17 | 0 | 0 |
| RLT | 18 | 18 | 0 | 0 |
| ALM | 20 | 20 | 0 | 0 |
| WRK | 12 | 12 | 0 | 0 |
| OBS | 12 | 12 | 0 | 0 |
| NFR | 18 | 18 | 0 | 0 |
| TEC | 15 | 10 | 5 | 0 |
| **계** | **229** | **224** | **5** | **0** |

- 검산: 24 + 17 + 15 + 16 + 12 + 15 + 18 + 17 + 18 + 20 + 12 + 12 + 18 + 15 = **229** · 기능을 가리킴 224 + 해당 없음 5 = **229**
- **기능을 가리키지 않는 요구사항 5** — REQ-TEC-04(전 모듈) · REQ-TEC-08(실험 절차) · REQ-TEC-09(실험 절차) · REQ-TEC-11(실험 절차) · REQ-TEC-13(구성). 전부 실험 절차 · 구성 · 전 모듈 횡단 계약이라 특정 기능에 속하지 않는다. 검증 자리는 각 요구사항 행의 검증 방법 열이다.

## 흐름 축

정본 [../06_pipeline/README.md](../06_pipeline/README.md). 흐름마다 그 흐름에 참여하는 기능을 센다(한 기능이 여러 흐름에 참여한다).

| 흐름 | 참여 기능 수 | 참여 기능 |
|------|:--:|------|
| F-01 | 15 | MST-03 · MST-07 · COL-01 · COL-02 · COL-03 · COL-04 · COL-05 · COL-06 · COL-07 · SIM-01 · SIM-02 · SIM-03 · SIM-04 · SIM-05 · GEN-05 |
| F-02 | 12 | COL-07 · GEN-06 · ING-01 · ING-02 · ING-03 · ING-04 · ING-05 · ING-06 · ING-07 · ING-08 · ING-10 · ING-11 |
| F-03 | 12 | AUT-04 · AUT-05 · AUT-06 · AUT-07 · MST-07 · ING-08 · TSQ-08 · RLT-01 · RLT-02 · RLT-03 · RLT-04 · RLT-07 |
| F-04 | 14 | AUT-04 · AUT-05 · AUT-06 · AUT-07 · MST-09 · TSQ-01 · TSQ-02 · TSQ-03 · TSQ-04 · TSQ-05 · TSQ-06 · TSQ-07 · TSQ-08 · TSQ-09 |
| F-05 | 20 | AUT-01 · AUT-02 · AUT-03 · AUT-04 · AUT-05 · AUT-06 · MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 · MST-08 · RLT-09 · ALM-01 · WRK-01 · WRK-02 · WRK-03 · WRK-04 · WRK-05 |
| F-06 | 12 | AUT-05 · ING-09 · ING-10 · RLT-08 · ALM-02 · ALM-03 · ALM-04 · ALM-05 · ALM-06 · ALM-07 · ALM-08 · ALM-09 |
| F-07 | 9 | AUT-04 · AUT-05 · AUT-07 · ING-08 · RLT-05 · RLT-06 · RLT-07 · RLT-08 · ALM-06 |
| F-08 | 3 | MST-09 · GEN-08 · ING-12 |
| F-09 | 12 | AUT-05 · SIM-03 · GEN-01 · GEN-02 · GEN-03 · GEN-04 · GEN-05 · GEN-06 · GEN-07 · GEN-08 · GEN-09 · GEN-10 |
| F-10 | 8 | COL-08 · COL-09 · SIM-04 · GEN-07 · ING-05 · ING-06 · ING-13 · RLT-04 |

- 검산: 흐름 = **10** · 참여 기능이 없는 흐름 **0** · 흐름 없는 기능 **6**(흐름 열이 해당 없음 — OBS-01 · OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06)

## 화면 축

정본 [../08_screen/02_traceability.md](../08_screen/02_traceability.md). 주 화면으로만 센다 — 보조 화면까지 세면 합이 91과 맞지 않는다.

| 화면 | 주 화면인 기능 수 | 기능 |
|------|:--:|------|
| AUTH-LOGIN | 3 | AUT-01 · AUT-02 · AUT-03 |
| DSH-REALTIME | 8 | TSQ-08 · RLT-01 · RLT-02 · RLT-03 · RLT-04 · RLT-05 · RLT-06 · RLT-07 |
| ANL-TREND | 5 | TSQ-01 · TSQ-02 · TSQ-06 · TSQ-07 · TSQ-09 |
| ALM-CONSOLE | 3 | RLT-08 · ALM-07 · ALM-08 |
| ALM-RULES | 2 | ALM-01 · ALM-09 |
| ADM-MASTER | 6 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 |
| ADM-WORKORDER | 3 | WRK-01 · WRK-02 · WRK-03 |
| ADM-AUDIT | 1 | WRK-05 |
| EXP-CONSOLE | 5 | OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06 |
| EXP-COMPARE | 1 | OBS-01 |
| 공통 셸 | 5 | AUT-04 · AUT-05 · AUT-06 · AUT-07 · RLT-09 |
| 표면 없음 | 21 | 전역 매트릭스의 화면 열 |
| 내부 모듈 | 27 | 전역 매트릭스의 화면 열 |
| 화면 없음(API 전용) | 1 | 전역 매트릭스의 화면 열 |

- 검산: 화면 있음 42 + 표면 없음 21 + 내부 모듈 27 + 화면 없음(API 전용) 1 = **91** · 주 기능이 없는 화면 **0**

## API 축

정본 [../07_api/README.md](../07_api/README.md) §도메인별 표면 수. 표면 번호 단위 대응은 각 API 문서의 표면 요약 표와 [../08_screen/02_traceability.md](../08_screen/02_traceability.md)의 호출 표면 열이 갖는다.

| API 문서 | 표면 수 | 기능 수 | 기능 |
|------|:--:|:--:|------|
| [../07_api/03_auth.md](../07_api/03_auth.md) | 3 | 3 | AUT-01 · AUT-02 · AUT-03 |
| [../07_api/04_master.md](../07_api/04_master.md) | 17 | 6 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 |
| [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | 2 | 6 | TSQ-01 · TSQ-02 · TSQ-06 · TSQ-07 · TSQ-08 · TSQ-09 |
| [../07_api/06_realtime.md](../07_api/06_realtime.md) | 2 | 5 | RLT-01 · RLT-02 · RLT-03 · RLT-04 · RLT-07 |
| [../07_api/07_alarms.md](../07_api/07_alarms.md) | 6 | 4 | ALM-01 · ALM-07 · ALM-08 · ALM-09 |
| [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | 9 | 4 | WRK-01 · WRK-02 · WRK-03 · WRK-05 |
| [../07_api/09_datagen.md](../07_api/09_datagen.md) | 1 | 1 | GEN-07 |
| [../07_api/10_metrics.md](../07_api/10_metrics.md) | 2 | 6 | OBS-01 · OBS-02 · OBS-03 · OBS-04 · OBS-05 · OBS-06 |
| [../07_api/11_websocket.md](../07_api/11_websocket.md) | 1 | 7 | AUT-04 · AUT-07 · RLT-05 · RLT-06 · RLT-07 · RLT-08 · RLT-09 |

- 검산: 표면 = 3 + 17 + 2 + 2 + 6 + 9 + 1 + 2 + 1 = **43** · 기능이 가리키지 않는 API 문서 **0** · 표면 열이 API 문서가 아닌 기능 횡단(전 표면에 걸림) 2 + 표면 없음 48 = **50**
- 01_conventions · 02_errors는 규약 · 미러라 기능이 가리키지 않는다 — 미매핑이 아니다.

## 저장 객체 축

정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §테이블 목록 · [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §객체 목록. Redis 키 계열의 기능 대응은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)의 키 표가 갖는다.

| 저장소 | 객체 | 기능 수 | 기능 |
|------|------|:--:|------|
| PostgreSQL | site | 1 | MST-01 |
| PostgreSQL | production_line | 1 | MST-01 |
| PostgreSQL | device | 1 | MST-02 |
| PostgreSQL | modbus_config | 2 | MST-03 · COL-01 |
| PostgreSQL | tag_master | 5 | MST-04 · MST-05 · MST-06 · MST-09 · COL-01 |
| PostgreSQL | tag_master_history | 1 | MST-06 |
| PostgreSQL | alarm_rule | 1 | ALM-01 |
| PostgreSQL | alarm_event | 3 | ALM-04 · ALM-07 · ALM-08 |
| PostgreSQL | user_account | 1 | AUT-01 |
| PostgreSQL | role | 1 | AUT-05 |
| PostgreSQL | user_role | 2 | AUT-01 · AUT-05 |
| PostgreSQL | work_order | 2 | WRK-01 · WRK-02 |
| PostgreSQL | production_log | 1 | WRK-03 |
| PostgreSQL | audit_log | 3 | MST-04 · WRK-04 · WRK-05 |
| PostgreSQL | plc_tag_raw_control | 2 | GEN-10 · ING-11 |
| ClickHouse | tag_raw | 9 | GEN-08 · ING-03 · ING-04 · ING-10 · TSQ-01 · TSQ-02 · TSQ-09 · RLT-04 · OBS-04 |
| ClickHouse | tag_1m | 4 | GEN-08 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | tag_1h | 4 | GEN-08 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | tag_1d | 4 | GEN-08 · ING-12 · TSQ-01 · TSQ-02 |
| ClickHouse | alarm_eval | 2 | ALM-05 · ALM-09 |
| ClickHouse | mv_tag_1m · mv_tag_1h · mv_tag_1d | 1 | ING-12 |
| ClickHouse | dict_tag | 3 | MST-08 · MST-09 · TSQ-07 |

- 검산: PostgreSQL 15 + ClickHouse 테이블 5 + MV 3(한 행) + Dictionary 1 = 객체 **24** · 기능이 가리키지 않는 객체 **0**

## AC 축

정본 [14_acceptance_criteria.md](./14_acceptance_criteria.md). AC 45 각각의 관련 기능 ID 열을 기능 정본과 대조한다. 실험 대응(AC → EXP 45/45)은 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대응 검산이 닫는다.

| 대조 | 수 |
|------|:--:|
| AC | 45 |
| 관련 기능 ID가 기능 정본에 있음 | 43 |
| 관련 기능 ID 해당 없음 | 2 |
| 유령 참조 | 0 |

- 검산: AC = **45** · 유령 **0** · 해당 없음 AC-14 · AC-15

## 검산 요약

| 축 | 전수 | 미매핑 | 유령 |
|------|:--:|:--:|:--:|
| 기능 → 요구사항 | 91 | 0 | 0 |
| 요구사항 → 기능 | 229 | 0(해당 없음 5 명시) | 0 |
| 흐름 | 10 | 0 | 0 |
| 화면 | 10 | 0 | 0 |
| API 문서 | 9 | 0 | 0 |
| 저장 객체 | 24 | 0 | 0 |
| AC | 45 | 0 | 0 |

- 검산: 축 = **7** · 미매핑 합 **0** · 유령 합 **0**

## 재생성 규칙

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 같은 변경 단위 | 기능 표의 흐름 · 표면 · 저장소 열, 요구사항 표의 관련 기능 열, 화면 매핑 표, AC 표를 고친 커밋에서 이 문서를 다시 만든다 | 이 문서가 정본과 다른 대응을 보여 주고, 읽는 사람은 어느 쪽이 맞는지 모른다 |
| 뒤집기만 한다 | 이 문서에서 대응을 추가 · 삭제하지 않는다 — 정본 열을 고친다 | 정본에 없는 대응이 여기에만 생겨 유령이 된다 |
| 닫힌 어휘 | 빈 칸 대신 §닫힌 어휘 4개 중 하나 | 빈 칸이 "아직 안 씀"인지 "대응 없음"인지 가를 수 없다 |
| 검산 동반 | 재생성 뒤 §검산 요약의 미매핑 · 유령을 다시 센다 | 미매핑이 생긴 채로 추적성이 "완료" 상태로 남는다 |

- 검산: 규칙 = **4**
- 재생성 수단은 정본 표를 읽어 뒤집는 스크립트다. 코드 착수 전에는 리드가 손으로 돌리고, 코드 착수 뒤에는 문서 린트 작업(docs:lint)에 편입한다 — 편입 항목은 [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md)가 갖는다.

## 관련 문서

- [README.md](./README.md) — 추적성 닫힌 어휘 규약
- [../02_features/README.md](../02_features/README.md) — 기능 ID 채번 정본
- [../08_screen/02_traceability.md](../08_screen/02_traceability.md) — 기능 → 화면 정본
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — AC 채번 정본
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — AC · REQ-NFR → 실험 대응
