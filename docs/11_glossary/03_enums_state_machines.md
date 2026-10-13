# enum과 상태 머신 (03_enums_state_machines)

> **대상**: db_study가 저장 · 전송 · 설정에 쓰는 닫힌 값 집합(enum) 전수와 상태 머신 현행 3종(1 배치 재시도 · 3 백프레셔 · 5 라이브 실행 — 2 알람 · 4 작업지시는 D-16 폐지 · 번호 재배치 없음) — enum 값 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-11 — **D-16 카드 라인 · 설비 가동 · HMI 개요 · 직접 비교 · 센서 데이터 enum 신설**(사용자 결정 2026-10-11 · 마이그레이션 006 · 008 · 공용 계약 packages/shared card-line.ts · runs.ts · data.ts · plant.ts) — enum 전수 #23~#33 신설 11(tag_kind 8 · run_result.type 1 · part 3 · status 3 · 실행 종류 2 · 설비 가동 상태 2 · HMI 설비 상태 4 · 조회 대결 문항 4 · 무결성 시험 3 · 지우기 막는 이유 3 · 비교 데이터 없음 이유 3) — 현행 15 → **26** · 채번 22 → **33** · **APP_ROLE 5 → 4**(datagen D-16 삭제 누락분) · 저장 enum 3 → **18**값 · 저장 enum 절 제목 W3 확정 → W3 · D-16 확정
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — **상태 머신 2 알람 디바운스 · 4 작업지시 삭제**(현행 5 → **3** · 번호 재배치 없음) · enum 현행 22 → **15**(결번 #11 · 12 · 14~18) · 주입 모드 4 → **2**(C · D 폐지) · 품질 코드 표의 알람 판정 열 · SIMULATED 판정 불릿 삭제 · 기타 enum alarm_eval.breached 삭제 · 저장 enum 17 → **3**값(condition_type · severity · work_order.status · role_code 삭제) · 메트릭 mode 레이블 = A · run · 신호 프로파일 BINARY · SPIKE 용도의 알람 표현 · 부하 시나리오 링크 · perf cleanup 표현 삭제 · D-16 정리(d4 전역 sweep) — 실행 단계 status 짝에서 perf cleanup 서술 삭제
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 실행 단계 status 짝 서술 "stopped면 취소된 1이 stopped" → **끝난 단계 done 유지 · 미시작 skipped · 진행 중 0~1개 stopped**(flow prepare 중 중단도 같다) · failed 짝에 정상 경로 정리 실패(cleanup 1 failed · 나머지 done) · 상태 머신 5 running → failed 전이 뜻에 정상 경로 정리 실패 · 정리 중 중단 요청은 전이가 아니다(completed) · 주입 모드 표 뒤 **메트릭 mode 레이블 = 주입 모드 4 + standalone · run** 한 줄 — enum · 값 · 전이 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 · 리드 판정 5) — 전송 enum 신설 2 — **#21 실행 status 5값**(running · stopping · completed · stopped · failed) · **#22 실행 단계 status 6값**(pending · running · done · skipped · stopped · failed) · 표면 정본 07_api/09_datagen — 전수 20 → **22** · **상태 머신 5 — 라이브 실행** 신설(상태 머신 4 → **5**종 · 전이 4)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-M8 · B-M9) — #20 명령 조회 status 사용처에 **202 본문 expired(만료 키 재요청)** · failed 뜻에 **적용 여부 미확정** — enum 수 · 값 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — enum 신설 2 — **biz_command_log.status 3값**(APPLIED · REJECTED · EXPIRED · 저장 enum · 정본 컬럼 05_data_stores/01) · **명령 조회 status 5값**(pending · applied · rejected · expired · failed · 전송 enum · 표면 정본 07_api/01) — 전수 18 → **20** · 저장 enum 값 14 → **17**
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 복구 해설의 길이 대역 → 적체 대역(ADR-21 표기)
> **개정일**: 2026-09-24 — W7 검수 반영 — 백프레셔 주의 단계 계측 지표 stream_length → **consumer_lag**(판정량은 적체 · ADR-21)
> **개정일**: 2026-09-24 — W4 판정 반영 — ACKED는 alarm:state에 저장하지 않는 파생 상태 — 저장 state 값 **4** · ACK의 Redis 주체 미확인 → **판정기 단독** · CLEARING 중 ACK 전이 판정 · BAD_TIMEOUT 기록 자리 · FLOAT64 4워드 순서 · 레지스터 비트 BOOL W4 판정 — enum 수 · 값 수 불변
> **개정일**: 2026-09-24 — W3 판정 반영 — 미설계 3 → **확정**(condition_type 4 · severity 3 · work_order.status 4 · 정본 05_data_stores/01) · 전수 검산 15 + 3 → **18 + 0** · 상태 머신 3 → **4**(작업지시 · 허용 전이 4쌍) · alarm:state 필드 **7** · bad_cnt 조건식 **W3 확정 quality IN (2, 4)**
> **개정일**: 2026-09-24 — W3 판정 반영 — 백프레셔 판정량 XLEN → **미확인 적체(그룹 lag + pending)**(ADR-21) · 하강 전이 잠정 표기 → **히스테리시스 확정**(ADR-23)
> **개정일**: 2026-09-24 — W2 판정 반영 — CLEARING · CLEARED 이벤트 ACK 허용 조건 링크
> **개정일**: 2026-09-24 — W2 확정 반영 — role.role_code 미설계 → **확정 3값**(OPERATOR · ENGINEER · ADMIN) · 전수 검산 14 + 4 → **15 + 3** · 모드 A SIMULATED 표지 미확인 → 판정 완료(정본 02_features/03)
> **원천**: 원본 data_flow.md §3.2 · §4 · §8 · §8.1 · §8.2 · §11 · §11.1(커밋 ff66a37) · 원본 architecture.md §6 · §7.1 · §7.2 · §7.3 · §9.2 · §9.3 · §11.1(커밋 ff66a37) · 원본 tech_stack.md §6 · §7 · §10.1(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #20

이 문서는 **값의 목록과 그 값이 무엇을 일으키는가**를 고정한다. 컬럼의 타입 · 제약은 [../05_data_stores](../05_data_stores/README.md)가, 전이를 실행하는 기전은 [../06_pipeline](../06_pipeline/README.md)이 갖는다. 값을 더하거나 빼면 여기서 먼저 고치고, 값을 인용하는 컬럼 · 메트릭 · 화면이 뒤따른다.

**원본에 값이 없는 enum은 이 문서가 임의로 만들지 않는다.** 컬럼만 있고 값 집합이 없는 것은 "미설계 — {결정 문서}가 확정"으로 등재하고, 결정 문서가 확정한 뒤에 값을 올린다. 임의 값을 적으면 구현이 그 값을 정본으로 읽어 스키마 확정 전에 데이터가 쌓인다.

## enum 전수

| # | enum | 저장 · 사용 위치 | 값 수 | 상세 |
|:-:|------|---------------|:-----:|------|
| 1 | 품질 코드 | tag_raw.quality · Stream q · rt:latest 값의 셋째 필드 | 7 | 품질 코드 |
| 2 | 신호 프로파일 | 생성기 설정(GEN) — **저장 컬럼 없음** | 8 | 신호 프로파일 |
| 3 | data_type | tag_master.data_type | 7 | Modbus 매핑 enum |
| 4 | word_order | tag_master.word_order | 4 | Modbus 매핑 enum |
| 5 | function_code | tag_master.function_code | 4 | Modbus 매핑 enum |
| 6 | 주입 모드 | 실험 조건 — 측정 기록 머리 | 2 | 실험 · 조회 축 enum |
| 7 | 조회 해상도 | 조회 요청 interval · 응답 meta.interval | 4 | 실험 · 조회 축 enum |
| 8 | 집계 함수 | 조회 요청 aggregations | 5 | 실험 · 조회 축 enum |
| 9 | 백프레셔 단계 | 메트릭 — **저장 컬럼 없음** | 5 | 상태 머신 3 |
| 10 | 배치 재시도 상태 | Ingest 모듈 메모리 — **저장 컬럼 없음** | 7 | 상태 머신 1 |
| 13 | APP_ROLE | 환경변수 | 4 | 기타 enum |
| 19 | biz_command_log.status | biz_command_log.status · biz:result 결과 | 3 | 저장 enum(업무 쓰기 Redis 경유) |
| 20 | 명령 조회 status | GET /api/v1/commands/{cmdId} 응답 status · 202 본문 status(pending · 만료 키 재요청 expired) | 5 | 기타 enum |
| 21 | 실행 status | 라이브 실행 객체 status(07_api/09_datagen #2~#5) · 메트릭 gen_runs_total의 status 레이블(종결 3값) — **저장 컬럼 없음**(api 메모리) | 5 | 기타 enum · 상태 머신 5 |
| 22 | 실행 단계 status | 라이브 실행 객체 steps[].status — **저장 컬럼 없음** | 6 | 기타 enum |
| **23** | tag_kind | tag_master.tag_kind(NULL 허용 · CHECK) · 생성기 신호 선택 · HMI 개요의 핵심 값 선택 | 8 | 저장 enum |
| **24** | run_result.type | run_result.type | 1 | 저장 enum |
| **25** | run_result.part | run_result.part · 실행 params.part · 결과 part | 3 | 저장 enum |
| **26** | run_result.status | run_result.status · 09_datagen #6 attempts status | 3 | 저장 enum |
| **27** | 실행 종류 | 라이브 실행 type(09_datagen #2~#5) — **저장 컬럼 없음**(compare만 run_result.type으로 남는다) | 2 | 기타 enum |
| **28** | 설비 가동 상태 | Redis ctl:plant:power의 state 필드 · 06_realtime #3 · #4 on(불리언) | 2 | 기타 enum |
| **29** | HMI 설비 상태 | 06_realtime #5 devices[].state — **저장 컬럼 없음**(요청마다 판정) | 4 | 기타 enum |
| **30** | 조회 대결 문항 | 직접 비교 결과 questions[].q · 단계 key | 4 | 기타 enum |
| **31** | 무결성 시험 | 직접 비교 결과 tests[].test · 단계 key | 3 | 기타 enum |
| **32** | 지우기 막는 이유 | data.purge_blocked의 details.reason | 3 | 기타 enum |
| **33** | 비교 데이터 없음 이유 | datagen.compare_no_data의 details.reason | 3 | 기타 enum |

검산: 현행 26(#1~#10 · #13 · #19~#33) + 결번 7(#11 · 12 · 14~18 — 알람 상태 · alarm_event.state · alarm_eval.breached · condition_type · severity · work_order.status · role_code — D-16) = 채번 **33** · 미설계 0 · D-16 신설 11(#23~#33)

- **상태 머신 2(알람 디바운스) · 4(작업지시)는 D-16으로 지웠다** — 알람 · 작업지시가 없다. 번호는 다시 매기지 않는다(폐지 전 원문 커밋 28c0cc9).
- **실험 축 중 용량 티어 · 메모리 프로파일은 enum이 아니다.** 코드가 분기하는 값이 아니라 측정 조건이며, 정본은 [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) · [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md)다(옛 부하 시나리오는 D-16 폐지). 역할 스위치 SW-NN도 여기 두지 않는다 — 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md).

## 품질 코드

값은 UInt8로 저장한다. **BAD 계열은 이름이 BAD_로 시작하는 2 · 3 · 4다** — 롤업 bad_cnt가 이 계열 중 저장되는 2 · 4를 센다.

| 코드 | 이름 | 부여 조건 | tag_raw 행 | 후속 처리 |
|:----:|------|----------|:----------:|----------|
| 0 | GOOD | 정상 수신 · 범위 안 | 저장 | 정상 저장 |
| 1 | UNCERTAIN | 보간 · 추정값 | 저장 | 집계에서 가중치를 낮춘다 — **롤업 MV에 구현이 없다**(아래 불일치) |
| 2 | BAD_COMM | Modbus 예외 응답 | 저장 | 롤업 bad_cnt에 든다 |
| 3 | BAD_TIMEOUT | 응답 타임아웃 | **저장하지 않음** | 결측으로 처리한다. 해당 스캔 그룹은 그 주기를 건너뛴다 |
| 4 | BAD_RANGE | range_min · range_max 밖 | 저장 | 롤업 bad_cnt에 든다 |
| 5 | STALE | 지정 주기 안에 갱신 없음 | **조회 시점 판정** | 최신값 응답에 경고로 표시한다. 판정식은 [05_units_and_time.md](./05_units_and_time.md) |
| 9 | SIMULATED | 테스트 데이터 생성기 산출 | 저장 | 실데이터와 반드시 구분한다 |

검산: 0~5의 6 + 9의 1 = **7** · 결번 6 · 7 · 8

- **6~8은 결번이다.** 원본은 5 다음을 9로 건너뛰고 사유를 적지 않았다(사유 미확인). 이 문서는 [04_id_conventions.md](./04_id_conventions.md)의 말미 채번 규칙을 적용해 6~8을 영구 결번으로 고정한다 — 새 품질 코드는 10부터 채번한다. 빈 번호를 메우면 "quality가 9 미만이면 실데이터 품질"이라는 조건식이 새 코드의 뜻에 따라 조용히 달라진다.
- **STALE은 저장 경로가 쓰지 않는다(판정).** 원본의 조건이 "지정 주기 안에 갱신 없음"이라 새 행이 오지 않는 상황에서만 참이고, 행이 오지 않으면 쓸 행도 없다. Collector 예외 시 "해당 설비 태그가 STALE로 전환"(원본 architecture.md §17)도 조회 시점 판정의 결과로 읽는다.
- **W3 확정 — bad_cnt는 quality IN (2, 4)만 센다.** 원본 mv_tag_1m은 countIf(quality > 0)으로 bad_cnt를 만들므로(원본 architecture.md §7.2) UNCERTAIN · STALE · SIMULATED가 모두 불량으로 집계된다. 생성 데이터만 있는 이 시스템에서는 bad_cnt = cnt가 되어 지표가 무의미하다. 조건식은 [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) §bad_cnt 조건식 판정이 **BAD 계열 중 tag_raw에 저장되는 2 · 4**로 확정했다. UNCERTAIN 가중치는 구현하지 않는다(같은 문서).
- **불일치 등재 — UNCERTAIN의 가중치.** 원본은 "집계에서 가중치를 낮춘다"인데 mv_tag_1m은 avgState(value)로 품질과 무관하게 평균한다. 확정 전 롤업 avg는 UNCERTAIN을 GOOD과 같은 무게로 센다. 또한 Collector 디코딩 파이프라인(원본 data_flow.md §3)에 보간 · 추정 단계가 없어 1을 부여하는 주체가 미확인이다. 확정 자리는 [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) · [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)다.
- **W4 판정 — BAD_TIMEOUT의 기록 자리.** 원본 data_flow.md §3.2는 "저장하지 않고 결측 처리", 원본 architecture.md §17은 "품질 BAD_TIMEOUT 기록"이다. "기록"은 **메트릭**이다 — 타임아웃 계수와 Modbus 왕복 히스토그램의 타임아웃 칸. tag_raw 행 · rt:latest 갱신 · Stream 엔트리를 만들지 않는다. 정본 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md).

## 신호 프로파일

생성기(GEN)가 태그별로 고르는 값 생성 규칙이다. 압축 특성 열은 **원본 예상치**이며 실측은 EXP-NN이 한다(3계층 — 미확인 · 확정 전 임의 값 고정 금지).

| 프로파일 | 생성 규칙 | 모사 대상 | 압축 특성(원본 예상치) | 결측 표현 |
|---------|----------|----------|--------------------|----------|
| SINE | A·sin(2πt/T) + B + 노이즈 | 온도 · 압력의 주기 변동 | 중간 | 해당 없음 |
| RANDOM_WALK | v(t) = v(t−1) + N(0, σ) | 유량 · 탱크 레벨 | 낮음 — 용량 산정의 최악 기준 | 해당 없음 |
| RAMP | 선형 증가 후 리셋 | 누적 카운터 | 매우 높음(Delta 코덱) | 해당 없음 |
| STEP | 구간별 상수 | 설정값 · 운전 모드 | 매우 높음 | 해당 없음 |
| BINARY | 베르누이 토글 | 가동/정지 비트 | 매우 높음 | 해당 없음 |
| COUNTER | 단조 증가 · UInt32 랩어라운드 | 생산 수량 | 매우 높음 | 해당 없음 |
| SPIKE | 기저값 + 확률적 이상치 | 이상치 · 극값 보존 확인 | 중간 | 해당 없음 |
| DROPOUT | 확률적 결측 | 통신 장애 | 해당 없음 | **행 생략(판정)** |

검산: 아날로그 3(SINE · RANDOM_WALK · RAMP) + 이산 3(STEP · BINARY · COUNTER) + 이상 2(SPIKE · DROPOUT) = **8**

- **불일치 판정 — DROPOUT의 품질 코드.** 원본은 DROPOUT을 "확률적 결측 + 품질 코드 BAD"로, 생성 데이터 전체를 "항상 SIMULATED(9)"로 적었다. 품질 컬럼은 하나라 한 행이 둘을 동시에 가질 수 없다. 이 문서는 **모드 B · C · D에서 결측을 행 생략으로 표현하고 산출 행은 전부 9**로 판정한다 — BAD를 달면 생성 데이터 표지가 지워져 전역 불변식(생성 데이터 구분)이 깨진다. 모드 A에서 통신 장애를 재현하려면 PlcSim이 Modbus 예외 · 지연을 내고 Collector가 2 · 3을 판정한다.
- **판정 완료 — 모드 A의 SIMULATED 표지.** 레지스터에는 품질 필드가 없으므로 Collector가 **설비 단위 규칙**으로 9를 단다 — modbus_config.host가 컨테이너 루프백이면 시뮬레이션 설비다. 건강 코드 2 · 4가 출처 코드 9보다 우선하며, 출처는 설비 규칙으로 복원된다. 정본 [../02_features/03_collector.md](../02_features/03_collector.md). 잔여 — PlcSim을 별도 프로세스로 분리하면 루프백 규칙을 다시 판정한다.
- **품질 코드가 출처 축과 건강 축을 한 칸에 겹친다.** 9는 "누가 만들었나", 0~5는 "얼마나 믿을 수 있나"다. 두 축을 가를지(컬럼 신설)는 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md)(W3)의 결정이며, 이 문서는 고정 기준의 7값을 유지한다.

## Modbus 매핑 enum

태그 마스터에 저장되는 디코딩 규칙이다. 디코딩 순서는 워드 순서 적용 → 타입 변환 → 공학 단위 변환이다(원본 data_flow.md §3).

| data_type | 워드 수 | 워드 순서 적용 | 허용 function_code |
|-----------|:------:|:-------------:|-------------------|
| UINT16 | 1 | 없음 | 3 · 4 |
| INT16 | 1 | 없음 | 3 · 4 |
| UINT32 | 2 | 적용 | 3 · 4 |
| INT32 | 2 | 적용 | 3 · 4 |
| FLOAT32 | 2 | 적용 | 3 · 4 |
| FLOAT64 | 4 | 적용 — 두 축 조합 · 하위 워드 먼저는 4워드 완전 역순(W4) | 3 · 4 |
| BOOL | 비트 | 없음 | 1 · 2 — 레지스터 비트 BOOL은 지원하지 않는다(W4) · FC01 · FC02 시드 금지 유지 |

검산: 16비트 2 + 32비트 3 + 64비트 1 + 비트 1 = **7**

| word_order | 뜻(A가 최상위 바이트) | 흔한 출처 |
|-----------|--------------------|----------|
| ABCD | 상위 워드 먼저 · 워드 안 빅엔디안 | Modbus 표준 순서 |
| CDAB | 하위 워드 먼저 · 워드 안 빅엔디안(워드 스왑) | 32비트 값을 하위 워드부터 싣는 장비 |
| BADC | 상위 워드 먼저 · 워드 안 바이트 스왑 | 바이트 스왑 장비 |
| DCBA | 하위 워드 먼저 · 워드 안 바이트 스왑(완전 리틀엔디안) | 리틀엔디안 메모리를 그대로 싣는 장비 |

| function_code | 대상 | 단위 | 읽기/쓰기 | 요청당 상한 |
|:-------------:|------|------|:--------:|------------|
| 1 | Coil | 비트 | 읽기/쓰기 | 원본 미기재 |
| 2 | Discrete Input | 비트 | 읽기 전용 | 원본 미기재 |
| 3 | Holding Register | 16비트 워드 | 읽기/쓰기 | **125 레지스터** |
| 4 | Input Register | 16비트 워드 | 읽기 전용 | 원본 미기재 |

- **A형 — word_order가 틀려도 오류가 나지 않는다.** 통념은 "디코딩이 틀리면 예외가 난다"이지만, 워드 순서가 틀린 FLOAT32는 예외 없이 엉뚱한 유한값이나 비정상 부동소수로 풀린다. 진짜 축은 값의 범위이며, 범위 밖 값은 BAD_RANGE(4)로 드러난다. 대체 경로는 태그 등록 시 알려진 값으로 디코딩을 대조하는 것이다(원본 tech_stack.md §6이 "실무 최대 함정"으로 적었다).
- **W4 판정 — FLOAT64의 워드 순서 표기.** word_order 4값을 워드 순서 축(상위 먼저 · 하위 먼저)과 워드 안 바이트 순서 축의 조합으로 읽고 64비트에도 그대로 적용한다 — 하위 워드 먼저는 4워드 완전 역순이다. 32비트 반쪽 교환(W1 W0 W3 W2)은 현 값 집합으로 표현하지 않는 잔여이며 필요해지면 이 문서에서 값을 채번한다. 레지스터 비트 BOOL은 지원하지 않는다(비트 인덱스 컬럼 없음). 정본 [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md).
- Collector는 읽기만 한다. function_code의 쓰기 가능 여부는 대상 영역의 성질이며 이 시스템이 쓰기를 쓴다는 뜻이 아니다.

## 실험 · 조회 축 enum

| 주입 모드 | 경로 | 측정할 수 있는 것 | 측정할 수 없는 것 |
|:--------:|------|-----------------|-----------------|
| A | 생성기 → PlcSim 레지스터 → Collector 폴링 → Stream | 진짜 E2E 지연 · Modbus 병목 | DB 상한(Modbus가 먼저 막힌다) |
| B | 생성기 → Stream 직접 XADD | Redis · Ingest · ClickHouse 상한 | Modbus · Collector 성능 |

| interval | 대상 테이블 | 자동 선택 범위 | 원시 대비 스캔량 |
|:--------:|-----------|--------------|:--------------:|
| raw | tag_raw | 1시간 이하 | 1 |
| 1m | tag_1m | 1시간 초과 ~ 7일 | 1/60 |
| 1h | tag_1h | 7일 초과 ~ 90일 | 1/3600 |
| 1d | tag_1d | 90일 초과 | 1/86400 |

| 집계 함수 | 원시 계산 | 롤업 컬럼 · 병합 | 정확성 |
|----------|---------|----------------|--------|
| avg | avg(value) | avg_v · avgMerge | 부동소수 오차 범위 안에서 원시와 같다 |
| min | min(value) | min_v · minMerge | 정확 |
| max | max(value) | max_v · maxMerge | 정확 |
| last | argMax(value, ts) | last_v · argMaxMerge | 정확 — 같은 ts가 둘이면 어느 값인지 정하지 않는다 |
| p95 | quantile 계열 | p95_v · quantilesTDigestMerge(0.95) | **근사** — 원시 정확 분위수와 다르다 |

- **메트릭 mode 레이블 값은 A · run이다** — run은 라이브 흐름 실행(api 안 생성기 · GEN-12)이고 그 실행의 모드 B 발행도 run으로 센다. 옛 B 단독 실행기 · C · D · standalone(GEN-09)은 측정 도구와 함께 D-16으로 지웠다 · run은 주입 모드가 아니라서 위 표와 enum #6 값 수(2)에 들지 않는다(메트릭 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)).
- **주입 모드는 한 번에 하나만 쓴다.** A와 B를 동시에 돌리면 어느 계층이 병목인지 가를 수 없다(원본 data_flow.md §11.1). 주입 경로의 기전 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)다.
- **interval 경계값(1시간 · 7일 · 90일)은 1계층 구조값이다.** 경계가 바뀌면 캐시 키 정규화와 롤업 보존 기간이 함께 움직인다. 미지정 시 서버가 선택하고, maxPoints를 넘으면 서버가 한 단계 올린다 — 에러가 아니다([02_error_codes.md](./02_error_codes.md) "에러 코드가 아닌 것").
- **p95를 원시와 롤업에서 대조할 때 부동소수 허용 오차를 쓰지 않는다.** TDigest의 근사 오차는 부동소수 오차보다 크다 — 비교 규칙은 [05_units_and_time.md](./05_units_and_time.md).

## 상태 머신 1 — 배치 재시도 (Ingest)

한 배치가 Stream에서 읽혀 ClickHouse에 확정되거나 DLQ로 격리되기까지의 전이다(원본 architecture.md §9.2). **XACK는 확인 · 격리 두 상태에서만 일어난다.**

```mermaid
stateDiagram-v2
    [*] --> 수신: XREADGROUP
    수신 --> 누적: 배치에 추가
    누적 --> 누적: 플러시 임계 미달
    누적 --> 삽입시도: 플러시 임계 도달
    삽입시도 --> 확인: 삽입 성공
    확인 --> [*]: XACK 후 최신값 갱신
    삽입시도 --> 재시도대기: 삽입 실패
    재시도대기 --> 삽입시도: 백오프 경과 · 같은 토큰
    재시도대기 --> 격리: 재시도 소진
    격리 --> [*]: DLQ 이동 후 XACK
    [*] --> 회수: XAUTOCLAIM 주기 타이머
    회수 --> 누적: idle 초과 PEL 인수
```

| 상태 | 진입 | 엔트리 위치 | XACK | 나가는 조건 |
|------|------|-----------|:----:|-----------|
| 수신 | XREADGROUP이 엔트리를 돌려준다 | PEL(이 컨슈머) | 안 함 | 즉시 누적 |
| 누적 | 배치 버퍼에 행을 더한다 | PEL | 안 함 | 행 수 · 경과 시간 · 페이로드 크기 중 먼저 도달한 임계 |
| 삽입시도 | 결정적 토큰으로 INSERT | PEL | 안 함 | 성공 → 확인 · 실패 → 재시도대기 |
| 재시도대기 | 지수 백오프 대기 | PEL | 안 함 | 경과 → 삽입시도 · 소진 → 격리 |
| 확인 | 삽입 성공 | PEL → 제거 | **함** | 종료. 최신값 Hash 갱신 · Pub/Sub 발행이 뒤따른다 |
| 격리 | 재시도 소진 | DLQ Stream에 복사 → PEL 제거 | **함** | 종료. dlq_count 증가 |
| 회수 | 주기 타이머의 XAUTOCLAIM이 idle 초과 엔트리를 인수 | PEL(새 컨슈머로 이전) | 안 함 | 누적 |

검산: 정상 경로 4(수신 · 누적 · 삽입시도 · 확인) + 실패 경로 2(재시도대기 · 격리) + 회수 1 = **7**

- **B형 — 격리에서 XACK를 하는 것은 데이터를 버리는 것이 아니다.** XACK를 생략하면 배치가 PEL에 영구히 남아 컨슈머 랙이 영원히 0으로 돌아오지 않고, 이후 모든 랙 알림이 거짓이 된다. 배치는 DLQ에 사본으로 남아 있으므로 XACK는 "이 컨슈머의 책임이 끝났다"는 뜻일 뿐이다.
- **재시도 토큰은 첫 시도와 같아야 한다.** 재시도대기 → 삽입시도는 같은 insert_deduplication_token을 쓴다. 백오프 합계는 ClickHouse 중복 제거 윈도우 안에 머물러야 하며, 백오프 · 재시도 횟수 · 윈도우는 2계층 조정값으로 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)가 소유한다(현행 참고 — 백오프 1 · 2 · 4 · 8 · 16초 · 재시도 5회).
- **불일치 판정 — 회수의 진입.** 원본 상태도는 회수를 "프로세스 재시작 감지"로 적고, 원본 data_flow.md §4는 "30초 주기 XAUTOCLAIM"으로 적었다. 이 문서는 **주기 타이머**로 판정한다 — 재시작은 idle PEL이 생기는 흔한 원인일 뿐 감지 신호가 아니며, 같은 프로세스 안의 컨슈머 하나가 죽는 경우(원본 architecture.md §17 IngestModule 예외)는 재시작 없이도 회수가 필요하다.

## 상태 머신 3 — 백프레셔 5단계

**미확인 적체(컨슈머 그룹 lag + pending)**가 단계를 정한다 — **XLEN이 아니다.** XACK은 엔트리를 지우지 않아 확인된 엔트리가 MAXLEN 트리밍까지 남으므로, XLEN은 정상 운전에서도 MAXLEN까지 차오르는 충전량이다(ADR-21). 임계는 2계층 조정값이라 **정본은 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)**이며, 아래 현행 값은 원본 수치를 적체 기준으로 옮긴 참고다(원본 architecture.md §9.3).

```mermaid
stateDiagram-v2
    [*] --> 정상
    정상 --> 주의: 적체가 주의 임계 이상
    주의 --> 경고: 적체가 경고 임계 이상
    경고 --> 위험: 적체가 위험 임계 초과 또는 XADD 실패
    주의 --> 정상: 적체가 주의 임계 − 폭 미만이 유지 시간 지속
    경고 --> 주의: 적체가 경고 임계 − 폭 미만이 유지 시간 지속
    위험 --> 복구: 적체가 주의 임계 미만
    복구 --> 위험: 적체가 위험 임계 초과 또는 XADD 실패
    복구 --> 정상: 스풀 잔여 0
```

| 단계 | 진입 계약 | 시스템 반응 | 계측 지표 | 현행 임계(부하 · 개발 프로파일) |
|------|---------|-----------|---------|---------------------------|
| 정상 | 적체 < 주의 임계 | 그대로 진행 | consumer_lag | 20,000 미만 · 5,000 미만 |
| 주의 | 주의 임계 ≤ 적체 < 경고 임계 | 경고 알림 · Ingest 컨슈머 동시성 자동 증가 | consumer_lag | 20,000~100,000 · 5,000~25,000 |
| 경고 | 경고 임계 ≤ 적체 ≤ 위험 임계 | Collector가 데드밴드를 임시 강화해 발행량 감축 | deadband_boost_active | 100,000~180,000 · 25,000~45,000 |
| 위험 | 적체 > 위험 임계 또는 XADD 실패 | Collector 스풀 전환 · datagen.stream_full/503 | spool_active · spool_bytes · stream_trimmed_unacked | 180,000 초과 · 45,000 초과 |
| 복구 | 위험을 지난 뒤 적체 < 주의 임계 | 스풀 파일 순차 재발행 후 스풀 종료 · 적체가 주의 임계 이상이면 재발행만 일시 정지 | spool_drain_rate | 상동(정상 임계) |

검산: 적체 대역 4(정상 · 주의 · 경고 · 위험) + 이력 상태 1(복구) = **5**

- **복구는 적체 대역이 아니라 이력 상태다.** 진입 적체는 정상과 같지만 스풀에 재발행할 프레임이 남아 있다는 점이 다르다. 복구를 정상으로 합치면 재발행 중 늘어나는 적체가 "정상 중 급증"으로 계측되어 원인이 가려진다.
- **개발 프로파일 임계는 MAXLEN에 비례해 줄인다.** 부하 실험 임계를 그대로 쓰면 개발 프로파일(MAXLEN 50000)에서 경고 이상에 도달할 수 없다.
- **하강 전이는 히스테리시스를 따른다(ADR-23 — W3 판정).** 상승은 즉시, 주의 · 경고의 하강은 "진입 임계 − 폭" 미만이 유지 시간 동안 이어질 때만 한 단계씩 한다. 위험은 경고 · 주의 대역으로 내려와도 **주의 임계 미만까지 스풀을 유지**하고, 복구 중 적체가 다시 주의 임계를 넘으면 재발행만 멈춘다. 폭 · 유지 시간은 2계층 조정값이며 S6에서 정한다(정본 [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md)).

## 기타 enum

| enum | 값 | 뜻 | 후속 처리 |
|------|----|----|----------|
| APP_ROLE | all(기본) · api · worker · collector | 한 이미지에서 기동할 모듈 범위(옛 datagen은 D-16 삭제) | 역할 분리는 확장 로드맵 1단계이며 코드 변경이 없다. 역할별 모듈 배정의 정본은 [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 명령 조회 status | pending · applied · rejected · expired · failed | 결과 없음(적용 전 또는 트리밍) · 원장 APPLIED · 원장 REJECTED · 원장 EXPIRED · 결과 키에 PostgreSQL 불가 503(원장 행 없음 — **적용 여부 미확정**: 이미 커밋된 재전달도 failed일 수 있어 같은 키 재요청으로 확정) | 저장 enum #19의 세 값에 저장 없는 둘(pending · failed)을 더한 전송 값이다 — 표면 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) · 기전 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §시간 초과 · 명령 조회 |

| 실행 status | running · stopping · completed · stopped · failed | 단계가 도는 중 · 중단 요청을 받아 취소와 정리 중 · 전 단계 끝남 · 중단으로 끝남 · 단계 예외로 끝남 | 종결 3(completed · stopped · failed)이면 화면 폴링이 멈추고 완료 표시를 다음 시작 전까지 유지한다 — 전이는 상태 머신 5 · 표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) §실행 객체 |
| 실행 종류 | flow · compare | 흐름 시연 · 직접 비교(옛 perf는 D-16 폐지) | 종류가 달라도 한 번에 하나다(datagen.run_in_progress) · compare만 종결 결과를 run_result에 남긴다 — 표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) |
| 설비 가동 상태 | on · off | 센서 자동 생성(가상 PLC 포트 · 모드 A 틱 · 폴링) 켜짐 · 꺼짐 | 키가 없으면 기동 기본값 SENSOR_AUTOGEN을 따르고 수집기 역할이 1초 안에 따른다 · 재기동이면 기동 기본값부터(ADR-29 · [../07_api/06_realtime.md](../07_api/06_realtime.md) #3 · #4) |
| HMI 설비 상태 | running · idle · stopped · offline | 가동 · 대기 · 정지 · 통신 끊김 | 판정 순서 — 설비 가동 꺼짐이면 stopped · 지금 값이 5초 넘게 낡으면 offline(켠 지 5초 안이면 stopped — 깨어나는 중) · STATE 태그가 BAD_COMM이거나 값이 없으면 offline · STATE 값 2 running · 1 idle · 그 밖 stopped — 정본 [../07_api/06_realtime.md](../07_api/06_realtime.md) #5 |
| 조회 대결 문항 | sensor-1m · device-latest · hourly-avg · daily-output | 센서 1개 최근 1분 · 설비 1대 지금 값 · 전체 1시간 평균 · 라인별 하루 생산량 | 소량 2 · 대량 2 — 승자는 3회 모두 같을 때만([../07_api/09_datagen.md](../07_api/09_datagen.md) §조회 대결 문항) |
| 무결성 시험 | duplicate · unknown-device · fault-value | 같은 데이터 두 번 · 등록 안 된 설비 · 고장 값 | 시험마다 따로 보낸다 — 막음 = PostgreSQL 행 불변 + COPY 실패([../07_api/09_datagen.md](../07_api/09_datagen.md) §무결성 시험) |
| 지우기 막는 이유 | run_in_progress · plant_running · stream_backlog | 실행 진행 중 · 설비 가동 중(켜는 중 · 끈 직후 수집기가 아직 도는 동안 포함) · 대기줄에 적재 안 된 엔트리 | 이 순서로 하나만 낸다 — data.purge_blocked/409([../07_api/09_datagen.md](../07_api/09_datagen.md) #8) |
| 비교 데이터 없음 이유 | no_ingest · ingest_incomplete · no_rows | 넣기 없음 · 마지막 넣기가 중단 · 실패 · 구간에 행 없음(지우기 · 보존 경과) | datagen.compare_no_data/409 — 대응은 셋 다 "넣기를 끝까지 다시"다 |
| 실행 단계 status | pending · running · done · skipped · stopped · failed | 시작 전 · 도는 중 · 끝남(flow drain 상한 초과도 done + timedOut) · 중단 · 실패로 건너뜀 · 도는 중 중단으로 취소 · 도는 중 예외 | 실행 status와 짝이 정해져 있다 — completed면 전부 done · stopped면 끝난 단계 done 유지 · 미시작 skipped · 진행 중이던 단계 0~1개 stopped(단계 경계에서 받으면 0 · flow prepare 중이어도 같다) · failed면 예외 1이 failed · 끝난 단계 done · 나머지 skipped — 옛 perf cleanup 단계 서술은 D-16 삭제 |

검산: APP_ROLE 1 + 3 = **4** · 명령 조회 status = 원장 3 + 저장 없음 2 = **5** · 실행 종류 = **2** · 설비 가동 상태 = **2** · HMI 설비 상태 = 통신 중 3 + 끊김 1 = **4** · 조회 대결 문항 = 소량 2 + 대량 2 = **4** · 무결성 시험 = **3** · 지우기 막는 이유 = **3** · 비교 데이터 없음 이유 = **3** · 실행 status = 진행 2 + 종결 3 = **5** · 실행 단계 status = 시작 전 1 + 진행 1 + 끝 4(done · skipped · stopped · failed) = **6**

- **실행 status의 stopped와 단계 status의 stopped는 다른 층이다.** 실행 stopped는 실행 전체가 중단으로 끝났다는 뜻이고, 단계 stopped는 그 순간 돌던 단계 하나다 — 중단된 실행에서도 정리 단계는 done이다(중단이어도 정리는 돈다).

## 저장 enum(W3 · D-16 확정)

원본 ERD에 컬럼만 있던 값 집합을 W3이 확정했고, D-16이 카드 라인 · 직접 비교 결과 보관의 값 집합을 더했다. 저장 형식은 text + CHECK이며 컬럼 정본은 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)다. 이 표가 값의 정본이고 CHECK는 사본이다.

| enum | 값 | 뜻 | 확정 근거 |
|------|------|------|------|
| biz_command_log.status | APPLIED · REJECTED · EXPIRED | 업무 행에 반영 · 도메인 오류로 반영 안 함 · 명령 유효 창 초과로 적용 안 함 | 사용자 결정 2026-09-27 — [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §biz_command_log 설계 · 상태 머신이 아니다(한 번 쓰고 바뀌지 않는다) |
| tag_master.tag_kind | TEMP · PRESSURE · SPEED · CURRENT · VIBRATION · COUNT · STATE · OTHER | 온도 · 압력 · 속도 · 전류 · 진동 · 수량 · 상태 · 기타 — NULL이면 종류 없음(사람이 만든 태그 · flow 전용 태그) | D-16 결정 3 · 마이그레이션 006 · 공용 계약 card-line.ts — 생성기가 종류로 신호를 고르고([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §모드 A) HMI 개요가 STATE · COUNT · 핵심 값을 고른다 |
| run_result.type | compare | 직접 비교 — 보관하는 실행 종류는 하나다(flow는 보관하지 않는다) | D-16 · 마이그레이션 008 |
| run_result.part | ingest · query · integrity | 넣기 · 조회 대결 · 무결성 — 옛 업무 방해는 같은 날 삭제(ADR-31) | D-16 · 008 · 공용 계약 COMPARE_PARTS |
| run_result.status | completed · stopped · failed | 실행 status의 종결 3값 — 한 번 쓰고 바뀌지 않는다(추가 전용) | D-16 · 008 |

검산: biz_command_log.status 3 + tag_kind 8 + run_result.type 1 + part 3 + status 3 = **18**값 · 옛 condition_type · severity · work_order.status · role_code(14값)는 D-16 폐지

## 상태 머신 5 — 라이브 실행

라이브 실행 객체 status의 전이다(사용자 요구 2026-09-28 · 표면 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) · 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §라이브 실행). 상태는 api 인스턴스 메모리에만 있고 재기동이면 실행 자체가 사라진다 — 재기동은 전이가 아니다.

```mermaid
stateDiagram-v2
    [*] --> running: 시작(09_datagen #2)
    running --> completed: 전 단계 끝
    running --> stopping: 중단 요청(#5)
    running --> failed: 단계 예외 → 정리 · 정상 경로 정리 실패
    stopping --> stopped: 취소 · 정리 끝
    completed --> [*]
    stopped --> [*]
    failed --> [*]
```

| 상태 | 초기 · 종결 | 나가는 전이 |
|------|------|------|
| running | 초기 | completed · stopping · failed |
| stopping | 중간 | stopped |
| completed | 종결 | 없음 |
| stopped | 종결 | 없음 |
| failed | 종결 | 없음 |

검산: 전이 3 + 1 = **4** · 시작 1 포함 **5** · 초기 1 + 중간 1 + 종결 3 = **5**상태

- **stopping에서 failed로 가는 전이가 없다.** 중단 중 정리가 실패해도 status는 stopped를 유지하고 실패는 error에 담는다 — 사용자가 누른 것은 중단이고, failed로 바꾸면 "중단 버튼이 실패를 일으켰다"로 읽힌다.
- **정리 중 중단 요청은 전이가 아니다.** 정리 단계(cleanup)가 도는 동안 #5가 오면 무시하고 running 그대로 두며 정리가 끝나면 completed(정리 실패면 failed)다 — 정리는 마지막 단계라 취소할 것이 없고, stopping으로 바꾸면 전 단계를 마친 실행이 "중단됨"으로 보인다.
- **종결에서 나가는 전이가 없다.** 같은 매개변수로 다시 돌리면 새 runId의 새 실행이다 — 종결 실행을 되살리면 elapsedMs = endedAt − startedAt이 두 구간을 합쳐 완료 표시의 총 소요가 거짓이 된다.
- 동시에 running · stopping인 실행은 최대 하나다(REQ-GEN-16) — 두 번째 시작은 전이가 아니라 datagen.run_in_progress/409 거절이다([02_error_codes.md](./02_error_codes.md)).

## 관련 문서

- [../README.md](../README.md) — 열거 집합 고정 기준
- [02_error_codes.md](./02_error_codes.md) — 전이 위반 · 백프레셔 거절 코드
- [05_units_and_time.md](./05_units_and_time.md) — STALE 판정 · 부동소수 비교
- [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) — 품질 코드 컬럼
- [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) — 배치 재시도 기전
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계 정본
