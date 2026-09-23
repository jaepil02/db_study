# REQ-ALM — 알람 요구사항

> **대상**: 알람(ALM)의 동작 계약 — 규칙 관리와 캐시 무효화 · 규칙 변경 감사 · 판정 대상 품질 · 배치 단위 상태 조회 · 디바운스 상태 머신 · 목적이 다른 세 쓰기와 부분 실패 · 발행 · 이벤트 조회 · 확인(ACK) 허용 조건 · 판정 이력 분석 · S7 생략 불가 — REQ-ALM-NN 채번 정본
> **작성일**: 2026-09-24
> **원천**: 원본 data_flow.md §8 · §8.1 · §8.2 · §6.3 · §9.2 · §13 · §17(커밋 ff66a37) · 원본 architecture.md §6 · §7.3 · §10.1 · §11 · §18(커밋 ff66a37) · 원본 implementation_plan.md §5 S7 · §7.3 · §7.5(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #20 · 웨이브 인계 W2 · W2b 행 · D-04 · D-11 · [../02_features/09_alarms.md](../02_features/09_alarms.md) ALM-01~09 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) ALM · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2 · alarm_event.state 대응

이 문서는 **알람 판정 한 건이 세 저장소로 갈라질 때 각 쓰기가 지킬 계약**을 고정한다. 기능의 존재와 경계는 [../02_features/09_alarms.md](../02_features/09_alarms.md)가, 판정 기전은 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)가, 상태 값과 alarm_event.state 대응은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)가 갖는다. 이 문서는 그 대응을 다시 정의하지 않고 **준수 여부를 검증 가능한 요구로 옮긴다** — alarm_event.state는 ACTIVE · CLEARED 둘이고 확인은 acked_by · acked_at이 기록한다.

**세 쓰기는 dual-write가 아니다.** Redis alarm:state · ClickHouse alarm_eval · PostgreSQL alarm_event는 서로 다른 질문에 답하므로 건수가 같기를 요구하지 않고, 부분 실패의 진실은 언제나 **PostgreSQL alarm_event**다(원본 data_flow.md §8.2 · D-04). 그래서 이 문서의 실패 계약은 "셋을 맞춘다"가 아니라 "PostgreSQL이 확정하기 전에는 아무것도 확정된 것으로 내보내지 않는다"로 선다.

**이 문서가 닫는 인계 2건** — ① CLEARING · CLEARED 이벤트의 ACK 허용 여부(docs_plan 웨이브 인계 W2 행 · 11_glossary/02 채번 보류) ② 알람 규칙 변경의 감사 대상 여부(W2b 행 · 02_features/09 · 10 미확인)를 §ACK 허용 판정 · §감사 대상 판정에서 판정한다. **알람은 S7이지만 생략하지 않는다**(D-11) — ②계층이 실행되는 유일한 자리이기 때문이다.

## 요구사항 — 규칙 관리

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ALM-01** | 규칙은 조회 · 등록 · 수정 · 비활성화만 한다. **물리 삭제 표면을 두지 않는다** — 규칙을 끄는 수단은 enabled 거짓이다 | 원본 architecture.md §6(alarm_event.rule_id 참조) · ALM-01 | 규칙을 지우면 그 규칙이 연 과거 alarm_event 행이 참조를 잃어 오탐 분석에서 어느 임계값이 이벤트를 만들었는지 복원할 수 없다 | 규칙 삭제 요청 경로 부재 확인 · 비활성화 후 과거 이벤트 조회 → 규칙 조인 성공 | ALM-01 | F-05 | 해당 없음 |
| **REQ-ALM-02** | 규칙 쓰기가 **커밋된 뒤에만** cache:alarmrules를 삭제한다. 새 값으로 덮어쓰지 않고 지운다 | 원본 architecture.md §10.1 · 원본 data_flow.md §7.1 · ALM-01 · ALM-02 | 삭제하지 않으면 바뀐 임계값이 캐시 TTL만큼 판정에 반영되지 않는다 · 커밋 전에 지우면 그 사이 판정이 옛 규칙으로 캐시를 다시 채워 영구히 낡은 값이 남는다 | 임계값 수정 직후 배치 → 새 임계값으로 판정(alarm_eval 대조) · 롤백된 수정 → 캐시 불변 | ALM-01 · ALM-02 | F-05 · F-06 | 해당 없음 |
| **REQ-ALM-03** | 규칙의 등록 · 수정 · 비활성화는 **같은 트랜잭션에서** audit_log에 행위자 · 동작 · before · after를 쓴다 — 판정 §감사 대상 판정 | 원본 architecture.md §18 · 이 문서 판정 · [11_work_orders.md](./11_work_orders.md) 감사 계약 | 감사가 없으면 오탐 분석에서 alarm_eval의 판정 변화가 임계값 변경 때문인지 데이터 때문인지 가를 수 없다 · 트랜잭션을 가르면 규칙은 바뀌었는데 감사가 빠지는 창이 생긴다 | 규칙 수정 1건 → audit_log 1행(before · after 대조) · audit_log 쓰기 강제 실패 → 규칙 변경도 롤백 | ALM-01 | F-05 | common.postgres_unavailable/503 |
| **REQ-ALM-04** | 규칙 본문이 형식을 어기거나 참조 태그가 마스터에 없으면 거절한다. condition_type · severity의 허용 값 집합은 미설계이며 값이 확정되기 전에 구현이 임의 값을 허용 목록으로 굳히지 않는다 | 원본 architecture.md §6 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 미설계 enum · ALM-01 | 임의 값을 먼저 굳히면 스키마 확정 전에 그 값으로 규칙 행이 쌓여 확정 값과 어긋난 행을 이관해야 한다 | 필수 누락 · 없는 태그 참조 → 400 | ALM-01 | F-05 | common.validation_failed/400 |
| **REQ-ALM-05** | 판정은 cache:alarmrules의 활성 규칙 목록을 쓰고 미스일 때만 PostgreSQL에서 읽어 채운다. 캐시 쓰기에는 TTL이 붙는다 | 원본 data_flow.md §8 · 원본 architecture.md §10.1 · 원본 implementation_plan.md §7.5 · ALM-02 | 판정마다 PostgreSQL을 읽으면 초당 판정 수만큼 업무 DB 조회가 생겨 수집 처리량이 PostgreSQL 커넥션 풀에 묶인다 | 판정 부하 중 pg_stat_statements의 규칙 조회 횟수가 캐시 미스 횟수와 같음 | ALM-02 | F-06 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-ALM-01~05 = **5**

## 요구사항 — 판정 · 세 쓰기

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ALM-06** | 판정은 ClickHouse 삽입이 확정된 배치에 대해서만 Ingest의 직접 호출로 시작한다. 품질 BAD 계열 중 저장되는 2 · 4는 판정에서 빼고 **SIMULATED(9)는 판정한다** | 원본 data_flow.md §8 · 원본 implementation_plan.md §7.3 · ALM-03 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 품질 코드 | 9를 빼면 전부 생성 데이터인 이 시스템에서 알람이 한 건도 나지 않아 ②계층이 실행되지 않는다 · 삽입 전 판정은 재시도로 같은 배치가 두 번 판정되어 디바운스 카운트가 부풀려진다 | SIMULATED 데이터로 임계 초과 → 이벤트 생성 · BAD_RANGE 행 → alarm_eval에 판정 행 없음 | ALM-03 | F-06 · F-02 | 해당 없음 |
| **REQ-ALM-07** | 상태 조회는 배치 단위로 **관련 rule_id만 한 번에** 한다(파이프라인 1회 또는 스크립트 1회). 행마다 Redis 왕복을 하지 않는다. 상태는 프로세스 메모리가 아니라 Redis Hash에 둔다 | 원본 implementation_plan.md §7.3 · ALM-03 | 행당 왕복은 배치당 수만 번 왕복이 되어 수집 처리량의 상한이 알람 판정이 된다 · 프로세스 메모리에 두면 역할 분리 때 두 워커가 같은 규칙을 평가하며 경합한다 | 배치 1개 판정 중 Redis 명령 통계 → 왕복 횟수가 배치 행 수가 아니라 1에 비례 | ALM-03 | F-06 | 해당 없음 |
| **REQ-ALM-08** | 상태 전이는 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 2의 전이만 허용하며 해제는 CLEARING 디바운스를 거친다. **디바운스 경과는 측정 시각 ts로 잰다** — 최초 위반 시각도 ts로 기록한다 | 원본 data_flow.md §8 · §8.1 · docs_plan 보정 #20 · W1 판정(해제 경로 §8.1 채택) | CLEARING을 건너뛰면 경계값 근처 노이즈마다 이벤트가 닫히고 다시 열려 alarm_event 행이 폭증한다 · 벽시계로 재면 백프레셔로 늦게 온 배치가 디바운스 창을 한꺼번에 통과해 순간 스파이크가 알람이 된다 | 디바운스 미만 스파이크 → PENDING → NORMAL · 이벤트 0 · 적체 후 소진 중 같은 스파이크 → 이벤트 0 | ALM-03 | F-06 | 해당 없음 |
| **REQ-ALM-09** | PENDING → ACTIVE에서 alarm_event에 행을 열고(state ACTIVE · cleared_at NULL) event_id를 alarm:state에 둔다. 해제가 확정되면 그 행을 닫는다(state CLEARED · cleared_at 채움 · acked_by · acked_at 유지). **state에 ACTIVE · CLEARED 외의 값을 쓰지 않고 PENDING은 행을 남기지 않는다** | 원본 data_flow.md §8 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) alarm_event.state 대응 · ALM-04 | state에 ACKED를 쓰면 확인 여부가 해제 순간 state에서 사라지고, 열린 알람 조회가 state와 acked_at을 함께 읽어야 한다 · PENDING 행을 남기면 오탐 억제 구간이 확정 이벤트로 집계된다 | 알람 1건의 생애 동안 alarm_event.state 값 집합 = ACTIVE · CLEARED · PENDING 구간 행 수 0 | ALM-04 | F-06 | 해당 없음 |
| **REQ-ALM-10** | PostgreSQL 쓰기(열기 · 닫기)가 실패하면 그 전이는 확정되지 않은 것으로 보고 alarm:state를 직전 상태로 되돌려 다음 판정 주기에 다시 시도한다. **ch:alarm 발행과 alarm:state의 확정 상태 기록은 PostgreSQL 커밋 뒤에만 한다** | 원본 data_flow.md §8 · §8.2 부분 실패 규칙 · ALM-04 · ALM-06 | 발행을 먼저 하면 PostgreSQL에 없는 알람이 화면에 떠 운영자가 확인하려는 순간 404를 받는다 · 상태를 되돌리지 않으면 Redis만 ACTIVE인 알람이 영영 PostgreSQL에 기록되지 않는다 | postgres 정지 중 위반 지속 → alarm:state가 PENDING 유지 · 발행 0 · 재기동 후 첫 주기에 행 1개 생성 · 발행 1 | ALM-04 · ALM-06 | F-06 · F-10 | 해당 없음 |
| **REQ-ALM-11** | 매 판정 결과(시각 · 규칙 · 태그 · 값 · 위반 여부 · 심각도)를 alarm_eval에 쌓는다. 재시도 · DLQ는 Ingest 배치와 같은 정책이고, **끝내 실패해도 알람 발생 · 해제 · 통지는 정상 동작한다** | 원본 data_flow.md §8 · §8.2 · 원본 architecture.md §7.3 · ALM-05 | alarm_eval 실패를 알람 확정 조건에 묶으면 분석용 로그의 장애가 운영 알람을 멈춘다 · 전수가 아니라 상태 변화만 쓰면 임계값 튜닝에 필요한 "위반했지만 확정되지 않은" 구간이 사라진다 | alarm_eval 삽입 강제 실패 → 이벤트 정상 생성 · DLQ 이동 · 판정 전수 행 수 = 판정한 행 수 | ALM-05 | F-06 | 해당 없음 |
| **REQ-ALM-12** | 이벤트가 열리거나 닫히면 ch:alarm에 발행한다. SW-06 off면 게이트웨이를 직접 부르며 발행 내용은 같다 | 원본 data_flow.md §8 · ALM-06 · [09_realtime.md](./09_realtime.md) 알람 푸시 | 닫힘을 발행하지 않으면 화면의 열린 알람이 해제 뒤에도 남아 운영자가 이미 끝난 알람을 확인하려 한다 | 알람 1건 생애 → 발행 2건(열림 · 닫힘) · SW-06 off에서 같은 프레임 수신 | ALM-06 | F-06 · F-07 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-ALM-06~12 = **7**
- **REQ-ALM-11은 B형이다.** 결론 — alarm_eval 삽입이 끝내 실패해도 알람은 정상이다. 반대 시나리오 — 확정 조건에 묶으면 ClickHouse 장애 한 번이 운영 알람을 멈춰 "진실은 PostgreSQL"이 거짓이 된다. 파생 지침 — 판정 전수의 결손은 dlq_count로 계측하고 알람 기능 판정에 넣지 않는다.

## 요구사항 — 조회 · 확인 · 분석

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-ALM-13** | 이벤트 목록은 "열린 알람"을 state = ACTIVE 하나로, "미확인 알람"을 acked_at IS NULL 하나로 조회하게 하며 쿼리는 발생 시각 범위를 조건으로 실행한다(요청이 범위를 생략할 때의 기본 범위는 [../07_api/07_alarms.md](../07_api/07_alarms.md)가 정한다). 목록 캐시는 확인 커밋 뒤에 무효화된다 — 발생 · 해제는 캐시 TTL만큼 늦게 목록에 반영되고 실시간 표시는 ch:alarm 푸시가 맡는다 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) · 원본 architecture.md §6(월 파티션) · §11 · ALM-07 | 범위 조건이 없으면 월 파티션 전부를 훑어 파티션 분리의 이득이 사라진다 · 확인 뒤 무효화하지 않으면 확인한 알람이 캐시 TTL 동안 미확인으로 남는다 | 조회 실행 계획의 파티션 가지치기 확인 · 확인 직후 목록 → acked_at 반영 | ALM-07 | F-06 | 해당 없음 |
| **REQ-ALM-14** | 확인은 **행이 state = ACTIVE이고 acked_at이 NULL일 때만** 허용하며 acked_by에 요청자 · acked_at에 시각을 한 번 채운다. 판정과 쓰기를 하나의 조건부 갱신으로 묶어 해제 확정과 경합해도 CLEARED 행에 확인이 기록되지 않게 한다 — 판정 §ACK 허용 판정 | 원본 data_flow.md §8.1 · 11_glossary/02 채번 보류 · 이 문서 판정 · ALM-08 | 조건 없이 갱신하면 확인 없이 해제된 알람에 사후 확인이 붙어 "해제 시점까지 아무도 보지 않았다"는 사실이 사라진다 · 재확인을 허용하면 먼저 확인한 사람이 덮어써진다 | CLEARING 중(행 ACTIVE) 확인 → 200 · CLEARED 행 확인 → 거절 · 확인된 행 재확인 → 거절 · 없는 id → 404 · 확인과 해제 동시 실행 100회 → CLEARED이면서 확인 시각이 해제 뒤인 행 0 | ALM-08 | F-06 | common.not_found/404 · alarms.ack_not_allowed/409 |
| **REQ-ALM-15** | 확인도 같은 트랜잭션에서 audit_log를 쓴다. 판정 · 확정 · 해제의 시스템 쓰기는 감사하지 않는다 — 판정 §감사 대상 판정 | 원본 architecture.md §18 · 이 문서 판정 | 시스템 쓰기까지 감사하면 판정 경로(데이터 평면)에 감사 쓰기가 끼어 알람 발생 빈도만큼 audit_log가 커지고 행위자 칸이 비어 감사의 뜻이 없어진다 | 확인 1건 → audit_log 1행 · 알람 발생 · 해제 → audit_log 행 증가 0 | ALM-08 | F-05 · F-06 | 해당 없음 |
| **REQ-ALM-16** | 확인된 알람의 조건이 해소되면 행을 CLEARED로 닫고 acked_by · acked_at을 유지한다. ACKED → NORMAL은 해제 디바운스 없이 첫 해소에서 전이한다(원본 사실). 확인이 alarm:state를 ACKED로 바꾸는 주체는 미확인이며 어느 주체든 이 결과를 지킨다 | 원본 data_flow.md §8.1 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) · ALM-04 · ALM-08 | Redis 상태가 ACTIVE로 남으면 확인된 알람도 CLEARING 디바운스를 타 상태도의 ACKED → NORMAL이 실행되지 않고 해제 시각이 디바운스만큼 늦게 기록된다 | 확인 후 해소 1회 → 행 CLEARED · acked 값 유지 · cleared_at − 해소 ts 대조 | ALM-04 · ALM-08 | F-06 | 해당 없음 |
| **REQ-ALM-17** | 판정 이력 분석은 alarm_eval을 범위로 읽고 극값을 보존하는 min · max 쌍을 돌려준다. S7 이후 ENGINEER에게만 열고 대량 스캔 읽기 한도를 적용한다 | 원본 architecture.md §7.3 · 원본 data_flow.md §6.3 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · ALM-09 | 평균만 돌려주면 임계값 근처 순간 초과가 사라져 오탐 분석의 근거가 없어진다 | 스파이크 구간 분석 → 원시 최대값 포함 · OPERATOR 요청 → 403 | ALM-09 | F-06 · F-04 | auth.forbidden/403 · common.rate_limited/429 |
| **REQ-ALM-18** | S7 이후 규칙 쓰기는 ENGINEER만, 확인은 OPERATOR만, 이벤트 · 규칙 조회는 인증 사용자 전원에게 연다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) ALM · D-07 | 쓰기 주체가 둘이면 감사 로그의 행위자로 변경 책임 축을 읽을 수 없다 · acked_by가 "현장에서 본 사람"이라는 뜻을 잃는다 | 역할별 토큰으로 규칙 수정 · 확인 → 허용 1 · 거부 2씩 | ALM-01 · ALM-07 · ALM-08 | F-05 · F-06 | auth.forbidden/403 |
| **REQ-ALM-19** | PostgreSQL 접속 불가 시 규칙 쓰기 · 이벤트 조회 · 확인은 503으로 실패하고, 판정은 REQ-ALM-10에 따라 PENDING에 머물며 재시도한다 | 원본 architecture.md §17 · ALM-01 · ALM-04 · ALM-07 · ALM-08 | 판정이 PostgreSQL 없이 확정 상태로 넘어가면 복구 뒤 Redis와 PostgreSQL의 열린 알람이 어긋나 진실이 둘이 된다 | postgres 정지 → 규칙 · 이벤트 · 확인 표면 503 · 판정 상태 PENDING 유지 | ALM-01 · ALM-04 · ALM-07 · ALM-08 | F-05 · F-06 · F-10 | common.postgres_unavailable/503 |
| **REQ-ALM-20** | 알람 판정 · 세 쓰기 · 확인은 S7에서 반드시 구현하며 **생략 선택지를 두지 않는다.** 학습 목표 ② 합격 판정(분기 대조표)은 이 도메인의 산출 없이 통과하지 않는다 | D-11 · 원본 implementation_plan.md §5 S7 · [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) S7 합격 판정 | 알람이 빠지면 ②계층이 한 번도 실행되지 않아 "같은 스트림의 데이터가 세 저장소로 갈린다"를 대조할 자리가 사라진다 | S7 인수 기준의 알람 ②계층 대조 · 부분 실패 항목 통과([14_acceptance_criteria.md](./14_acceptance_criteria.md)) | ALM-01~09 | F-06 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-ALM-13~20 = **8** · 문서 전체 REQ = 5 + 7 + 8 = **20**(REQ-ALM-01~20 · 결번 없음)

## 판정 한 건의 순서

REQ-ALM-06~12가 걸리는 순서다. 기전 정본은 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)다.

```plain
① 삽입 확정 배치 수신          Ingest 직접 호출         REQ-ALM-06
② 규칙 · 상태 일괄 조회        캐시 1회 · Hash 1회      REQ-ALM-05 · 07
③ 행별 품질 · 조건 · 전이      ts 기준 디바운스         REQ-ALM-06 · 08
④ PostgreSQL 열기 · 닫기       실패 시 상태 되돌림       REQ-ALM-09 · 10
⑤ alarm:state 확정 기록        ④ 커밋 뒤에만             REQ-ALM-10
⑥ ch:alarm 발행               ④ 커밋 뒤에만             REQ-ALM-10 · 12
⑦ alarm_eval 전수 삽입         실패해도 ④~⑥ 무관        REQ-ALM-11
```

- **④가 ⑤ · ⑥의 문이다.** PostgreSQL이 확정하지 않은 전이는 Redis에도 화면에도 확정으로 나가지 않는다 — 이것이 "진실은 alarm_event"의 실행 형태다.
- **⑦은 ④와 독립이다.** 판정 전수는 확정 여부와 무관하게 판정한 모든 행을 담고, 실패는 Ingest와 같은 재시도 · DLQ로만 처리한다.
- **②의 1회는 배치당이다.** 행당 조회로 되돌리는 순간 판정이 수집 경로의 상한이 된다(보정 7.3).

## ACK 허용 판정

W1이 넘긴 인계다. 확인 표면은 PostgreSQL 행만 보고 판정하며 Redis 상태를 읽지 않는다.

| 상태 머신 | alarm_event 행 | 확인 결과 | 근거 |
|------|------|------|------|
| NORMAL · PENDING | 열린 행 없음 | 404 — 대상 이벤트가 없다 | common.not_found/404 |
| ACTIVE | state ACTIVE · acked_at NULL | **허용** — acked_by · acked_at 채움 | 원본 data_flow.md §8.1 ACTIVE → ACKED |
| **CLEARING** | state ACTIVE · acked_at NULL | **허용** | 행이 아직 열려 있고 재위반으로 ACTIVE로 돌아갈 수 있다 |
| ACKED 또는 확인된 CLEARING | state ACTIVE · acked_at 채움 | **거절** — 먼저 확인한 기록을 덮어쓰지 않는다 | alarms.ack_not_allowed/409 |
| **CLEARED** | state CLEARED | **거절** — 닫힌 이벤트에 사후 확인을 붙이지 않는다 | alarms.ack_not_allowed/409 |

- 검산: 판정한 행 = **5** · 허용 2(ACTIVE · CLEARING) + 거절 3(행 없음 · 이미 확인 · CLEARED) = **5**
- **판정: CLEARING은 허용한다.** 확인 표면은 PostgreSQL 행만 읽고 CLEARING은 Redis에만 있는 상태다 — 거절하려면 확인 표면이 봉인 계열을 읽어야 해 확인 가능 여부가 Redis 가용성에 묶이고, "진실은 PostgreSQL"과 어긋난다. CLEARING은 재위반으로 ACTIVE로 돌아갈 수 있어 운영자에게는 아직 열린 알람이다.
- **판정: CLEARED는 거절한다.** 사후 확인을 허용하면 "확인 없이 해제된 알람"이 조회 시점에 따라 사라져 알람 피로 분석(아무도 보지 않고 끝난 알람의 비율)이 불가능해진다.
- **거절 두 행은 409 한 코드로 묶는다.** 원인이 달라도 클라이언트 대응(목록을 다시 읽는다)이 같다 — 정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)에 alarms.ack_not_allowed/409로 채번됐다.
- CLEARING 중 확인이 alarm:state를 어떻게 바꾸는지(상태도에 CLEARING → ACKED 전이가 없다)는 [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4)가 정한다. 이 문서가 고정하는 것은 행의 결과(REQ-ALM-16)뿐이다.

## 감사 대상 판정

감사 대상의 기준은 [11_work_orders.md](./11_work_orders.md)가 소유한다 — **사람이 인증된 쓰기 표면으로 일으킨 PostgreSQL 업무 테이블 변경**이다. 알람 도메인의 쓰기를 그 기준에 대 본다.

| 쓰기 | 주체 | 테이블 | 감사 | 이유 |
|------|------|------|------|------|
| 규칙 등록 · 수정 · 비활성화 | ENGINEER(사람) | alarm_rule | **대상** | 판정 결과를 바꾸는 변경이다 — 임계값 변경 시각이 없으면 alarm_eval의 판정 변화를 설명할 수 없다 |
| 확인 | OPERATOR(사람) | alarm_event | **대상** | 사람의 쓰기 표면이다. acked_by · acked_at이 결과를, audit_log가 요청 사실을 남긴다 |
| 이벤트 열기 · 닫기 | 판정 경로(시스템) | alarm_event | 비대상 | 행위자가 사람이 아니고 발생 빈도가 데이터 평면에 묶인다. 행 자체가 기록이다 |
| 판정 전수 | 판정 경로(시스템) | ClickHouse alarm_eval | 비대상 | PostgreSQL 업무 테이블이 아니다 |
| 상태 · 규칙 캐시 | 판정 경로(시스템) | Redis | 비대상 | 사본 · 핫 상태다 |

- 검산: 판정한 쓰기 = **5** · 대상 2 + 비대상 3 = **5**
- **판정: 알람 규칙 변경은 감사 대상이다.** 원본의 "업무 데이터 변경은 AUDIT_LOG에 before/after 기록"(원본 architecture.md §18)에서 alarm_rule은 PostgreSQL 업무 테이블 14 중 하나이고, 쓰기 주체가 ENGINEER 단일 역할이라 행위자 칸이 곧 책임 축이 된다.
- 쓰는 주체는 변경을 일으킨 ALM이고 audit_log 소유는 WRK다 — 소유와 쓰기가 갈린 자리는 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)(W3)의 한계 등재가 받는다.

## 세 쓰기의 부분 실패

| 쓰기 | 실패 시 | 알람 기능 | 복구 | 요구 |
|------|------|------|------|------|
| PostgreSQL alarm_event | 전이 미확정 · alarm:state 되돌림 · 발행 없음 | 다음 판정 주기까지 확정 지연 | 다음 주기 재시도 | REQ-ALM-10 |
| ClickHouse alarm_eval | 재시도 후 DLQ | **정상** | DLQ 재처리 | REQ-ALM-11 |
| Redis alarm:state | 판정 중단 — 봉인 계열이라 명시적 실패 | 판정 멈춤 | Redis 복구 뒤 재개 | REQ-ALM-07 |

- 검산: 쓰기 = PostgreSQL 1 + ClickHouse 1 + Redis 1 = **3**
- **세 저장소의 건수 일치를 합격 조건으로 두지 않는다.** alarm_eval은 판정 전수 · alarm_event는 확정 이벤트 · alarm:state는 규칙당 하나다 — 같으면 오히려 설계가 틀린 것이다([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 분기 대조표).

## 조회 계약 — 2계층 조정값

| 조정값 | 읽는 자리 · 키 모양 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 · 소유처 |
|------|------|------|------|------|------|
| 규칙 캐시 TTL | cache:alarmrules | 캐시 쓰기 시 | TTL 없는 쓰기 · 변경 시 삭제 생략 | 기동 거부 | 300초 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 이벤트 목록 캐시 TTL | 이벤트 목록 캐시 키 | 목록 캐시 쓰기 시 | 확인 뒤 무효화 생략 | 기동 거부 | 30초 · 상동 |
| debounce_ms | alarm_rule 행 | 규칙마다 · ts 기준 | 전역 고정 디바운스 | 규칙 저장 거절 | 규칙 값 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| alarm_eval 재시도 · DLQ | Ingest 배치 정책 공유 | 삽입 실패 시 | 알람 전용 무한 재시도 | Ingest 정책 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| alarm_event 파티션 보존 | 월 파티션 | 파티션 생성 · 분리 시 | 행 단위 삭제 | 분리하지 않음 | 2년 후 DETACH · [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |

- 검산: 조정값 = 규칙 캐시 · 목록 캐시 · 디바운스 · 재시도 · 파티션 보존 = **5**

## 실패 시 응답 전수

| 상황 | 응답 | 코드 또는 지표 | 요구 |
|------|------|------|------|
| 없는 이벤트 확인 | 404 | common.not_found/404 | REQ-ALM-14 |
| CLEARED · 이미 확인된 이벤트 확인 | 409 | alarms.ack_not_allowed/409 | REQ-ALM-14 |
| 규칙 형식 위반 · 없는 태그 참조 | 400 | common.validation_failed/400 | REQ-ALM-04 |
| 역할 밖 쓰기 · 분석(S7 이후) | 403 | auth.forbidden/403 | REQ-ALM-17 · 18 |
| PostgreSQL 접속 불가 | 503 · 판정 PENDING 유지 | common.postgres_unavailable/503 | REQ-ALM-19 |
| alarm_eval 삽입 실패 | 코드 없음 · 알람 정상 | dlq_count | REQ-ALM-11 |
| 판정이 배치당 느림 | 수집 경로 상한 | 초당 판정 건수 · 판정 지연 | REQ-ALM-07 |

- 검산: 상황 = **7** · 코드를 내는 행 5 + 코드 없는 행 2 = **7**

## 기능 → REQ 대응 검산

[../02_features/09_alarms.md](../02_features/09_alarms.md)의 기능 9개 전부가 적어도 하나의 REQ에 대응한다.

| 기능 ID | 기능명 | 대응 REQ |
|------|------|------|
| ALM-01 | 알람 규칙 관리 | REQ-ALM-01 · 02 · 03 · 04 · 18 · 19 · 20 |
| ALM-02 | 규칙 캐시 | REQ-ALM-02 · 05 · 20 |
| ALM-03 | 디바운스 판정 | REQ-ALM-06 · 07 · 08 · 20 |
| ALM-04 | 이벤트 확정 | REQ-ALM-09 · 10 · 16 · 19 · 20 |
| ALM-05 | 판정 전수 기록 | REQ-ALM-11 · 20 |
| ALM-06 | 발생 · 해제 발행 | REQ-ALM-10 · 12 · 20 |
| ALM-07 | 알람 이벤트 조회 | REQ-ALM-13 · 18 · 19 · 20 |
| ALM-08 | 알람 확인 | REQ-ALM-14 · 15 · 16 · 18 · 19 · 20 |
| ALM-09 | 판정 이력 분석 | REQ-ALM-17 · 20 |

- 검산: 기능 9 중 대응 REQ 있음 9 · 누락 0 = **9** · 기능에 대응하지 않는 REQ 0(유령 0). REQ 총수를 세는 자리는 §요구사항 — 조회 · 확인 · 분석의 검산 하나다

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.3 알람 상태 조회가 수집 상한을 만든다 | REQ-ALM-07 — 배치 단위 일괄 조회 · Redis Hash 유지. 판정 구간 지연 예산은 미확인 등재 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) |
| 보정 7.5 TTL 강제 수단 | alarm:state는 봉인 계열(TTL 금지) · cache:alarmrules는 캐시 계열(TTL 필수) | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| docs_plan 보정 #20 상태 대응 | REQ-ALM-09 · 13 · 14 · 16이 W1 대응표를 검증 가능한 요구로 옮긴다 | [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) |
| 원본 시퀀스의 CLEARING 생략 | REQ-ALM-08 — §8.1 상태도를 따른다(W1 판정) | 상동 |
| 보정 7.1 · 7.2 · 7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 확인 거절 에러 코드 | 이 문서가 409 · alarms 네임스페이스 한 코드로 판정 | **채번 완료** — alarms.ack_not_allowed/409 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(리드) |
| 확인이 alarm:state를 바꾸는 주체 · CLEARING 중 확인의 Redis 전이 | 확인은 API가 PostgreSQL에 쓴다 | 미확인(W1 등재) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| condition_type · severity 값 | 조건 종류 넷 · smallint 심각도 | 미설계 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 판정 구간 지연 예산 · 초당 판정 처리량 | 원본 지연 예산표에 알람 구간이 없다 | 미확인 — 확정 전 임의 값 고정 금지 | [../04_architecture/05_latency_budget.md](../04_architecture/05_latency_budget.md) · [13_nonfunctional.md](./13_nonfunctional.md) |
| 비활성 태그의 알람 규칙 | 원본에 없다 | 미설계(W2a 등재) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 담당자 배정 | "담당자 배정 등 상태 갱신"(원본 data_flow.md §8.2) · 컬럼 없음 | 신규 불일치(W2a 등재) | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 규칙 관리 · 판정 이력 분석 표면 | API 표에 이벤트 목록 · 확인 둘뿐이다 | 표면 미설계 | [../07_api/07_alarms.md](../07_api/07_alarms.md)(W5) |

## 관련 문서

- [../02_features/09_alarms.md](../02_features/09_alarms.md) — ALM 기능 목록 · 세 쓰기
- [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) — F-06 판정 기전
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 상태 머신 2 · alarm_event.state 대응
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — ②계층 분기 정책
- [11_work_orders.md](./11_work_orders.md) — 감사 대상 기준 · audit_log 계약
- [09_realtime.md](./09_realtime.md) — 알람 푸시
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 알람 디바운스 · ②계층 대조 인수 기준
