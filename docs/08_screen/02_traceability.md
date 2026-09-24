# 기능 → 화면 추적성 (02_traceability)

> **대상**: 기능 91 → 화면 매핑 전수 · 화면 없는 기능의 닫힌 어휘(내부 모듈 · 표면 없음 · 화면 없음(API 전용)) · 주 화면별 파생 집계 · 권한 매트릭스와의 교차 검산 · 화면 → 표면 인용 목록 · 누락 0 · 유령 0 검산
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(전 축 정합 — 15_traceability 완성) — 매핑 수 불변
> **원천**: [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) 역할 × 기능 매트릭스 · §검산 · 도메인 파일 11본 [../02_features/01_auth.md](../02_features/01_auth.md) ~ [../02_features/11_metrics.md](../02_features/11_metrics.md) 기능 목록 · [README.md](./README.md) 화면 인벤토리 · 화면 문서 5본의 요소 표 · [01_standards.md](./01_standards.md) 공통 셸 요소 표 · 07_api 도메인 문서의 표면 요약 · 원본 architecture.md §11(커밋 ff66a37)

이 문서는 **기능 → 화면 매핑과 파생 집계의 정본**이다. 기능 ID와 기능명의 정본은 02_features 도메인 파일 11본이고, 화면 코드의 정본은 [README.md](./README.md) 화면 인벤토리다. 이 문서는 둘을 잇기만 하며 기능도 화면도 새로 만들지 않는다.

**매핑의 근거는 화면 문서의 요소 표다.** 요소 표의 기능 ID 열에 적힌 기능만 그 화면에 매핑하고, 요소 표에 없는 기능을 화면에 붙이지 않는다([01_standards.md](./01_standards.md) §화면 명세 템플릿). 그래서 요소 표를 고치면 이 문서를 같은 변경 단위에서 다시 센다 — 문서 간 정합은 [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md)(W7)가 전 축으로 맞춘다.

## 매핑 어휘

셀은 아래 닫힌 어휘로만 채운다. 빈 칸을 두지 않는다.

| 분류 | 뜻 | 주 화면 열 | 권한 매트릭스 어휘와의 대응 |
|------|------|------|------|
| 화면 | 화면 요소가 그 기능의 표면을 호출하거나, 횡단 기능이면 공통 셸이 그 동작을 받는다 | 화면 코드 또는 "공통 셸" | 허용 · 거부(역할 판정) · 공개 · 횡단 |
| 내부 모듈 | 도메인 자체에 외부 표면이 없다 — COL · SIM · ING | 해당 없음 | 내부(내부 모듈) |
| 표면 없음 | 표면이 있는 도메인의 기능이지만 그 기능은 내부 단계 · 실행 인자라 표면이 없다 | 해당 없음 | 내부(내부 단계 · 실행 인자) |
| 화면 없음(API 전용) | 표면은 있으나 어느 화면도 부르지 않는다 — 호출 주체가 기계다 | 해당 없음 | 게이트 |

- 검산: 분류 = **4** · 화면 없는 분류 = 내부 모듈 · 표면 없음 · 화면 없음(API 전용) = **3**
- **간접 표시는 매핑이 아니다.** 내부 기능의 산출이 화면에 보이는 자리(예: ING의 컨슈머 랙이 EXP-CONSOLE 카드에 보인다)는 아래 표의 "산출이 보이는 자리" 열에 적되 분류를 바꾸지 않는다 — 화면이 부르는 것은 OBS 표면이지 ING가 아니다.
- **주 화면은 기능 하나에 하나다.** 여러 화면이 같은 표면을 부르면 기능의 목적과 페르소나가 같은 화면을 주 화면으로, 나머지를 보조로 적는다. 집계는 주 화면으로만 센다 — 보조까지 세면 기능 수가 화면 수만큼 부풀어 91과 맞지 않는다.

## 기능 → 화면 매핑

도메인 순서는 [../README.md](../README.md) 고정 기준의 도메인 목록 순서다. 표면 없는 도메인(COL · SIM · ING)과 실행 인자 기능 묶음은 범위 한 행으로 묶고 행마다 기능 수를 적는다.

| 기능 ID | 기능명 | 분류 | 주 화면 | 보조 화면 | 호출 표면(메서드 + 경로) | 산출이 보이는 자리 |
|------|------|------|------|------|------|------|
| AUT-01 | 로그인 | 화면 | AUTH-LOGIN | 해당 없음 | POST /api/v1/auth/login | 공통 셸 사용자 메뉴(roles) |
| AUT-02 | 토큰 갱신 | 화면 | AUTH-LOGIN | 공통 셸(인증 가드) | POST /api/v1/auth/refresh | 표시 없음 — 조용한 갱신 |
| AUT-03 | 로그아웃 | 화면 | AUTH-LOGIN | 공통 셸(사용자 메뉴) | POST /api/v1/auth/logout | 해당 없음 |
| AUT-04 | 신원 확인 | 화면 | 공통 셸 | 전 인증 화면 | 인증이 필요한 전 표면 · WS /ws/realtime | 로그인 유도 |
| AUT-05 | 역할 기반 인가 | 화면 | 공통 셸 | 역할 판정 화면(ALM-CONSOLE · ALM-RULES · ANL-TREND 내보내기 · ADM 3) | 인가 대상 전 표면 | 버튼 활성 · 403 제자리 안내 |
| AUT-06 | 레이트 리밋 | 화면 | 공통 셸 | 전 인증 화면 | 인증이 필요한 전 REST 표면 | 429 띠 |
| AUT-07 | 요청 출처 방어 | 화면 | 공통 셸 | DSH-REALTIME · ALM-CONSOLE(WS) | 직결 표면 · WS /ws/realtime | WS 끊김 표지 |
| MST-01 | 사이트 · 라인 관리 | 화면 | ADM-MASTER | DSH-REALTIME · ANL-TREND · ALM-RULES · ADM-WORKORDER(선택 목록) | GET · POST /api/v1/sites · PATCH /api/v1/sites/{id} · GET · POST /api/v1/lines · PATCH /api/v1/lines/{id} | 해당 없음 |
| MST-02 | 설비 관리 | 화면 | ADM-MASTER | DSH-REALTIME · ANL-TREND · ALM-RULES(선택 목록) | GET · POST /api/v1/devices · PATCH /api/v1/devices/{id} | 해당 없음 |
| MST-03 | Modbus 접속 설정 관리 | 화면 | ADM-MASTER | 해당 없음 | GET · PUT /api/v1/devices/{id}/modbus-config · POST /api/v1/devices(함께 등록) | ADM-MASTER SIMULATED 표지 |
| MST-04 | 태그 마스터 관리 | 화면 | ADM-MASTER | ANL-TREND · ALM-RULES(선택 목록) | GET · POST /api/v1/tags · PATCH /api/v1/tags/{id} · GET /api/v1/tags/{id} | 해당 없음 |
| MST-05 | 태그 논리 삭제 | 화면 | ADM-MASTER | 해당 없음 | POST /api/v1/tags/{id}/deactivate | ALM-CONSOLE · ALM-RULES "태그 비활성" 표지 |
| MST-06 | 스케일 변경 시 새 태그 발급 | 화면 | ADM-MASTER | 해당 없음 | POST /api/v1/tags/{id}/reissue | ADM-AUDIT 태그 변경 이력 · ANL-TREND 이어 보기 |
| MST-07 | 태그 메타 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 내부 조회 | DSH-REALTIME 태그명 · "메타 없음" 표지 |
| MST-08 | 캐시 무효화 체인 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 쓰기 표면의 후처리 | 공통 셸 신호 수신(⑥) · ADM-MASTER 쓰기 뒤 안내 |
| MST-09 | Dictionary 원천 제공 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-07이 소비 | ANL-TREND 범례 태그명 · 단위 |
| COL-01~09 | 수집(9) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | DSH-REALTIME 품질 열(COL-05) · EXP-CONSOLE 스풀 · 발행량 카드(COL-07~09) |
| SIM-01~05 | 시뮬레이션(5) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | DSH-REALTIME 품질 9 · 2 표기 |
| GEN-01~06 | 생성 · 모드 A · B(6) | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 실행 인자 | EXP-CONSOLE 생성기 pps 카드 · DSH-REALTIME 품질 9 |
| GEN-07 | 모드 C 부하 주입 표면 | 화면 없음(API 전용) | 해당 없음 | 해당 없음 | POST /api/v1/ingest/bulk — k6 · datagen 컨테이너가 부른다 | EXP-CONSOLE 모드 C 거절 수 카드 |
| GEN-08~10 | 모드 D · 단독 실측 · 대조군 백필(3) | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 실행 인자 | EXP-COMPARE 역전 지점 패널(BFF가 docs/measurements 기록을 읽는다) |
| ING-01~13 | 적재 · 분기(13) | 내부 모듈 | 해당 없음 | 해당 없음 | 해당 없음 | EXP-CONSOLE 랙 · 백프레셔 · DLQ 카드 · DSH-REALTIME 최신값(ING-08) · ALM 화면(ING-09 · 10) |
| TSQ-01 | 시계열 조회 | 화면 | ANL-TREND | DSH-REALTIME(트렌드 채움) | POST /api/v1/timeseries/query | 해당 없음 |
| TSQ-02 | 해상도 자동 선택 | 화면 | ANL-TREND | 해당 없음 | POST /api/v1/timeseries/query(meta.interval) | 해당 없음 |
| TSQ-03 | 캐시 키 정규화 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-04의 내부 단계 | ANL-TREND "캐시" 표지 켜짐 비율(SW-04 실험) |
| TSQ-04 | 조회 결과 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | ANL-TREND meta.cached 표지 |
| TSQ-05 | 스탬피드 방지 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — TSQ-01의 내부 단계 | EXP-COMPARE 대기 소진 계수(SW-05) |
| TSQ-06 | 다운샘플 | 화면 | ANL-TREND | 해당 없음 | POST /api/v1/timeseries/query(meta.downsampled) | 해당 없음 |
| TSQ-07 | 태그 메타 부착 | 화면 | ANL-TREND | 해당 없음 | POST /api/v1/timeseries/query(태그 메타) | 해당 없음 |
| TSQ-08 | 진행 구간 분할 | 화면 | DSH-REALTIME | ANL-TREND(진행 버킷 · 따라가기) | POST /api/v1/timeseries/query · GET /api/v1/realtime/devices/{id}/tags | 해당 없음 |
| TSQ-09 | 원시 내보내기 | 화면 | ANL-TREND | 해당 없음 | GET /api/v1/timeseries/export | 해당 없음 |
| RLT-01 | 설비 전체 최신값 | 화면 | DSH-REALTIME | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags | 해당 없음 |
| RLT-02 | 단일 태그 최신값 | 화면 | DSH-REALTIME | 해당 없음 | GET /api/v1/realtime/tags/{id} | 해당 없음 |
| RLT-03 | STALE 판정 · 메타 부착 | 화면 | DSH-REALTIME | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags(quality · staleAfterMs · servedAt) | 해당 없음 |
| RLT-04 | 빈 키 복원과 503 | 화면 | DSH-REALTIME | 해당 없음 | GET /api/v1/realtime/devices/{id}/tags(meta.source · restored) | 해당 없음 |
| RLT-05 | WebSocket 구독 | 화면 | DSH-REALTIME | 공통 셸(연결) | WS /ws/realtime | 해당 없음 |
| RLT-06 | 스로틀 병합 | 화면 | DSH-REALTIME | 해당 없음 | WS /ws/realtime | 해당 없음 |
| RLT-07 | 연결 관리 · 재연결 동기화 | 화면 | DSH-REALTIME | 공통 셸(WS 표지) · ALM-CONSOLE(재연결 재조회) | WS /ws/realtime · GET /api/v1/realtime/devices/{id}/tags | 해당 없음 |
| RLT-08 | 알람 푸시 | 화면 | ALM-CONSOLE | DSH-REALTIME(알람 띠) | WS /ws/realtime | 해당 없음 |
| RLT-09 | 무효화 신호 중계 | 화면 | 공통 셸 | DSH-REALTIME · ANL-TREND · ALM-RULES · ADM-MASTER(영향 화면) | WS /ws/realtime | 해당 없음 |
| ALM-01 | 알람 규칙 관리 | 화면 | ALM-RULES | 해당 없음 | GET · POST /api/v1/alarms/rules · PATCH /api/v1/alarms/rules/{id} | 해당 없음 |
| ALM-02 | 규칙 캐시 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 내부 단계 | 해당 없음 — 저장 뒤 판정 반영 시점 안내만 |
| ALM-03 | 디바운스 판정 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ING-09가 호출 | ALM-RULES 분석 위반 수 |
| ALM-04 | 이벤트 확정 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 후속 | ALM-CONSOLE 목록 행 |
| ALM-05 | 판정 전수 기록 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — ALM-03의 후속 | ALM-RULES 분석 차트 |
| ALM-06 | 발생 · 해제 발행 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — RLT-08이 전달 | ALM-CONSOLE 실시간 겹침 · DSH-REALTIME 알람 띠 |
| ALM-07 | 알람 이벤트 조회 | 화면 | ALM-CONSOLE | 해당 없음 | GET /api/v1/alarms/events | 해당 없음 |
| ALM-08 | 알람 확인 | 화면 | ALM-CONSOLE | 해당 없음 | POST /api/v1/alarms/events/{id}/ack | 해당 없음 |
| ALM-09 | 판정 이력 분석 | 화면 | ALM-RULES | 해당 없음 | GET /api/v1/alarms/evaluations | 해당 없음 |
| WRK-01 | 작업지시 관리 | 화면 | ADM-WORKORDER | 해당 없음 | GET · POST /api/v1/work-orders · GET · PATCH /api/v1/work-orders/{id} | 해당 없음 |
| WRK-02 | 작업지시 상태 관리 | 화면 | ADM-WORKORDER | 해당 없음 | POST /api/v1/work-orders/{id}/status | 해당 없음 |
| WRK-03 | 생산 실적 기록 | 화면 | ADM-WORKORDER | 해당 없음 | GET · POST /api/v1/work-orders/{id}/production-logs | 해당 없음 |
| WRK-04 | 감사 로그 기록 | 표면 없음 | 해당 없음 | 해당 없음 | 해당 없음 — 쓰기 트랜잭션 안 단계 | ADM-AUDIT 목록 행 |
| WRK-05 | 감사 로그 조회 | 화면 | ADM-AUDIT | ANL-TREND(이전 태그 이어 보기 — 계보 표면만 · 인증 사용자 전원) | GET /api/v1/audit-logs · GET /api/v1/audit-logs/tag-reissues | 해당 없음 |
| OBS-01 | 앱 메트릭 통합 노출 | 화면 | EXP-COMPARE | EXP-CONSOLE(요약 카드) | GET /metrics(화면은 BFF 경유) | 해당 없음 |
| OBS-02 | 저장소 메트릭 수집 | 화면 | EXP-CONSOLE | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-03 | 키 계열별 메모리 샘플링 | 화면 | EXP-CONSOLE | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-04 | E2E 지연 게이지 | 화면 | EXP-CONSOLE | 해당 없음 | GET /metrics | 해당 없음 |
| OBS-05 | 헬스체크 | 화면 | EXP-CONSOLE | 해당 없음 | GET /api/v1/health | 해당 없음 |
| OBS-06 | 스위치 상태 노출 | 화면 | EXP-CONSOLE | EXP-COMPARE · 공통 셸(실험 조건 배지) · DSH-REALTIME(구성 배지) | GET /api/v1/health · GET /metrics | 해당 없음 |

- 검산: 표 행 = AUT 7 + MST 9 + COL 1 + SIM 1 + GEN 3 + ING 1 + TSQ 9 + RLT 9 + ALM 9 + WRK 5 + OBS 6 = **60** · 범위 행이 담는 기능 = COL 9 + SIM 5 + GEN 6 + GEN 3 + ING 13 = **36** · 기능 = 60 − 범위 행 5 + 36 = **91**
- **GEN-07이 화면 없음인 것은 누락이 아니다.** 부하 주입 표면의 호출 주체는 k6 · datagen 컨테이너이고, 켜는 권한은 머신 접근이다(권한 매트릭스 §GEN · OBS 표면 인가). 콘솔에서 부르게 하면 부하 도구가 아닌 브라우저가 측정 부하에 섞인다 — 화면은 거절 수를 메트릭으로만 본다.
- **TSQ-08의 주 화면이 DSH-REALTIME인 이유** — 진행 구간 분할은 "끝이 현재인 조회"의 기전이고, 그 조회를 상시 하는 화면은 대시보드 트렌드다. ANL-TREND는 끝이 현재일 때만 같은 기전을 쓴다.

## 파생 집계

### 분류별

| 분류 | 기능 수 | 내역 |
|------|------|------|
| 화면 | **42** | AUT 7 · MST 6(01~06) · TSQ 6(01 · 02 · 06 · 07 · 08 · 09) · RLT 9 · ALM 4(01 · 07 · 08 · 09) · WRK 4(01 · 02 · 03 · 05) · OBS 6 |
| 내부 모듈 | **27** | COL 9 · SIM 5 · ING 13 |
| 표면 없음 | **21** | MST 3(07 · 08 · 09) · GEN 9(07 제외) · TSQ 3(03 · 04 · 05) · ALM 5(02~06) · WRK 1(04) |
| 화면 없음(API 전용) | **1** | GEN-07 |

- 검산: 화면 7 + 6 + 6 + 9 + 4 + 4 + 6 = **42** · 내부 모듈 9 + 5 + 13 = **27** · 표면 없음 3 + 9 + 3 + 5 + 1 = **21** · 42 + 27 + 21 + 1 = **91** — 누락 0
- **권한 매트릭스와의 교차 검산**([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §검산) — 화면 42 = 역할 판정 31 + 공개 7 + 횡단 4 · 내부 모듈 27 + 표면 없음 21 = 내부 48 · 화면 없음(API 전용) 1 = 게이트 1. **세 등식이 모두 성립한다** — 인가 대상 기능은 전부 화면이 있고, 인가 밖 기능은 하나도 화면이 없다. 이 등식이 깨지면 화면이 인가 판정 없는 기능을 부르거나, 인가된 기능이 화면 없이 남은 것이다.

### 주 화면별

| 주 화면 | 기능 수 | 기능 |
|------|------|------|
| AUTH-LOGIN | 3 | AUT-01 · 02 · 03 |
| DSH-REALTIME | 8 | RLT-01~07 · TSQ-08 |
| ANL-TREND | 5 | TSQ-01 · 02 · 06 · 07 · 09 |
| ALM-CONSOLE | 3 | ALM-07 · 08 · RLT-08 |
| ALM-RULES | 2 | ALM-01 · 09 |
| ADM-MASTER | 6 | MST-01~06 |
| ADM-WORKORDER | 3 | WRK-01 · 02 · 03 |
| ADM-AUDIT | 1 | WRK-05 |
| EXP-CONSOLE | 5 | OBS-02 · 03 · 04 · 05 · 06 |
| EXP-COMPARE | 1 | OBS-01 |
| 공통 셸 | 5 | AUT-04 · 05 · 06 · 07 · RLT-09 |

- 검산: 3 + 8 + 5 + 3 + 2 + 6 + 3 + 1 + 5 + 1 + 5 = **42** = 분류 "화면" · 화면 코드 행 = **10** — 인벤토리 선점 10과 같다
- **유령 0 · 고아 0** — 주 화면 열의 화면 코드는 전부 인벤토리에 있고(유령 0), 인벤토리의 화면 10은 전부 주 기능을 1개 이상 갖는다(고아 0). ADM-AUDIT · EXP-COMPARE가 1개뿐인 것은 한 기능을 깊게 보는 화면이라서다 — 쪼갠 화면이 아니다.
- **추가 화면 제안 0** — 선점 10으로 화면 있는 기능 42를 전부 담았다. 새 화면이 필요하면 [README.md](./README.md) 인벤토리 말미에 추가하고 이 표를 다시 센다.

### 도메인별

| 도메인 | 기능 | 화면 | 내부 모듈 | 표면 없음 | API 전용 | 주 화면 |
|------|------|------|------|------|------|------|
| AUT | 7 | 7 | 0 | 0 | 0 | AUTH-LOGIN 3 · 공통 셸 4 |
| MST | 9 | 6 | 0 | 3 | 0 | ADM-MASTER 6 |
| COL | 9 | 0 | 9 | 0 | 0 | 해당 없음 |
| SIM | 5 | 0 | 5 | 0 | 0 | 해당 없음 |
| GEN | 10 | 0 | 0 | 9 | 1 | 해당 없음 |
| ING | 13 | 0 | 13 | 0 | 0 | 해당 없음 |
| TSQ | 9 | 6 | 0 | 3 | 0 | ANL-TREND 5 · DSH-REALTIME 1 |
| RLT | 9 | 9 | 0 | 0 | 0 | DSH-REALTIME 7 · ALM-CONSOLE 1 · 공통 셸 1 |
| ALM | 9 | 4 | 0 | 5 | 0 | ALM-CONSOLE 2 · ALM-RULES 2 |
| WRK | 5 | 4 | 0 | 1 | 0 | ADM-WORKORDER 3 · ADM-AUDIT 1 |
| OBS | 6 | 6 | 0 | 0 | 0 | EXP-CONSOLE 5 · EXP-COMPARE 1 |

- 검산: 기능 7 + 9 + 9 + 5 + 10 + 13 + 9 + 9 + 9 + 5 + 6 = **91** · 화면 열 합 7 + 6 + 6 + 9 + 4 + 4 + 6 = **42** · 행마다 화면 + 내부 모듈 + 표면 없음 + API 전용 = 기능
- **화면 공백 도메인은 넷이다 — COL · SIM · ING(내부 모듈) · GEN(표면 없음 + API 전용).** 앞 셋은 07_api 표면 없음 3과 같은 도메인이고, GEN은 표면(부하 주입) 하나를 갖지만 호출 주체가 기계라 화면이 없다. README 도메인 공백 행의 "GEN(생성기 실행)은 잠정 07_experiment_console 귀속"은 **화면 없음 · 산출은 EXP-CONSOLE 메트릭으로만 보인다**로 확정할 것을 제안한다(생성기 실행 · 상태 표면을 두지 않는 판정 — [../07_api/09_datagen.md](../07_api/09_datagen.md)). OBS는 EXP-CONSOLE · EXP-COMPARE 귀속으로 확정된다.

## 화면 → 표면 인용

화면 문서가 인용한 표면을 07_api 문서별로 모은다. 표면 번호({문서} #N)는 쓰지 않고 메서드 + 경로로 적는다 — 번호 대응은 W7 추적성이 맞춘다.

| 07_api 문서 | 화면이 인용한 표면 | 수 | 호출 화면 |
|------|------|------|------|
| [../07_api/03_auth.md](../07_api/03_auth.md) | POST /api/v1/auth/login · POST /api/v1/auth/refresh · POST /api/v1/auth/logout | 3 | AUTH-LOGIN · 공통 셸 |
| [../07_api/04_master.md](../07_api/04_master.md) | GET · POST /api/v1/sites · PATCH /api/v1/sites/{id} · GET · POST /api/v1/lines · PATCH /api/v1/lines/{id} · GET · POST /api/v1/devices · PATCH /api/v1/devices/{id} · GET · PUT /api/v1/devices/{id}/modbus-config · GET · POST /api/v1/tags · GET · PATCH /api/v1/tags/{id} · POST /api/v1/tags/{id}/deactivate · POST /api/v1/tags/{id}/reissue | 17 | ADM-MASTER · DSH-REALTIME · ANL-TREND · ALM-RULES · ADM-WORKORDER |
| [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | POST /api/v1/timeseries/query · GET /api/v1/timeseries/export | 2 | ANL-TREND · DSH-REALTIME |
| [../07_api/06_realtime.md](../07_api/06_realtime.md) | GET /api/v1/realtime/devices/{id}/tags · GET /api/v1/realtime/tags/{id} | 2 | DSH-REALTIME |
| [../07_api/07_alarms.md](../07_api/07_alarms.md) | GET /api/v1/alarms/events · POST /api/v1/alarms/events/{id}/ack · GET · POST /api/v1/alarms/rules · PATCH /api/v1/alarms/rules/{id} · GET /api/v1/alarms/evaluations | 6 | ALM-CONSOLE · ALM-RULES |
| [../07_api/08_work_orders.md](../07_api/08_work_orders.md) | GET · POST /api/v1/work-orders · GET · PATCH /api/v1/work-orders/{id} · POST /api/v1/work-orders/{id}/status · GET · POST /api/v1/work-orders/{id}/production-logs · GET /api/v1/audit-logs · GET /api/v1/audit-logs/tag-reissues | 9 | ADM-WORKORDER · ADM-AUDIT · ANL-TREND |
| [../07_api/09_datagen.md](../07_api/09_datagen.md) | 없음 — POST /api/v1/ingest/bulk는 화면 없음(API 전용) | 0 | 해당 없음 |
| [../07_api/10_metrics.md](../07_api/10_metrics.md) | GET /api/v1/health · GET /metrics(화면은 BFF 경유) | 2 | EXP-CONSOLE · EXP-COMPARE · 공통 셸 |
| [../07_api/11_websocket.md](../07_api/11_websocket.md) | WS /ws/realtime | 1 | DSH-REALTIME · ALM-CONSOLE · 공통 셸 |

- 검산: 인용 표면 = 3 + 17 + 2 + 2 + 6 + 9 + 0 + 2 + 1 = **42** · 화면이 인용하지 않은 표면 = POST /api/v1/ingest/bulk **1**
- **EXP-COMPARE 역전 지점 패널의 원천은 이 표에 없다** — api 표면이 아니라 BFF가 docs/measurements를 읽기 전용으로 읽는다(W5 리드 판정 · [07_experiment_console.md](./07_experiment_console.md)).
- **원본 표면 중 화면이 부르지 않는 것은 부하 주입 하나뿐이다.** 원본 API 표(원본 architecture.md §11)의 나머지는 전부 화면 요소에 걸려 있다 — 화면 없는 표면이 늘면 그 표면의 호출 주체를 이 표에 적는다.
- 07_api README의 표면 총수와 이 표의 합이 다르면 차이는 화면 없는 표면이다 — 표면 총수의 정본은 [../07_api/README.md](../07_api/README.md)이고 이 표는 그것을 세지 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| README 도메인 공백 행의 GEN · OBS 잠정 귀속 | **제안** — GEN 화면 없음(산출은 EXP-CONSOLE 메트릭) · OBS는 EXP-CONSOLE · EXP-COMPARE로 확정 | [README.md](./README.md)(리드) |
| 기능 ↔ REQ ↔ 흐름 ↔ 화면 ↔ API ↔ 테이블 전 축 정합 | 닫힘 — 전 축 매핑 완성(미매핑 0 · 유령 0) — [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) | [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [01_standards.md](./01_standards.md) — 명세 템플릿 · 공통 셸 요소 표
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 기능 · 교차 검산 상대
- [../03_requirements/15_traceability.md](../03_requirements/15_traceability.md) — 전 축 추적성
- [../07_api/README.md](../07_api/README.md) — 표면 목차 · 표면 총수
