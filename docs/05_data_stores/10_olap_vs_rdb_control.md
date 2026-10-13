# PostgreSQL 대조군 · 비교 사본 (10_olap_vs_rdb_control)

> **대상**: 학습 목표 ① 설계 정본 — **지금 모양 — 직접 비교의 비교 사본(D-16 · 기본 키 · 설비 참조 · 값 규칙 · SW-09 gated · D-05 부분 개정 · ADR-32 — TimescaleDB hypertable 칸 1일 · 열 압축 · 보존 정책 7일)** · 옛 PostgreSQL 대조군 plc_tag_raw_control의 tag_raw 동형 설계(BRIN · 일자 파티션 — 기록 035~053을 낸 모양) · SW-09 동시 적재 · 삽입 실패 의미론과 멱등 수단 판정 · 동일 쿼리 5종(양쪽 SQL) · 비교 축 6 · 대조군 용량 축 · EXP-01~05 예약 대역 연결 · **폐지된 실험 설계(D-16 — 격자 · 측정 조건 · 스트리밍 동시 적재 · 역방향 대조 · 실행 수명 객체)** · **결과(쿼리별 역전 구간 · 비교 축 6 · 역방향 대조표) · 원리 대응표 — 측정 기록 034 · 042~054 인용**
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — §지금 모양에 엔진 전환 문단 · 옛 대조군 대 지금 비교 사본 대조표 8 → **13**행(엔진 · 나누기 · 보존 · 압축 · 함수 신설 · 인덱스 · 비우는 길 · 잴 것 갱신 · 지금 열 007 → **007 · 009**) · **009 계약 sql 펜스 신설** · "파티션 · 보존 · 경계는 004 그대로" 불릿 → **칸 · 보존 · 경계는 009가 정한다** · 압축 시점 · 압축 칸에 놓이는 무결성 창 · 압축 뒤 크기 읽기 불릿 신설 · 동형 설계 절 안내문의 지금 테이블 차이에 나누기 · 압축 · 대조군 용량 축에 압축 전 구조 계산 표지 · 미확인 등재 9 → **10**행(압축 수치) · 관련 문서 D-05 · ADR-32 · 09_tech_stack/03 — 테이블 수 불변(비교 사본 1 그대로)
> **개정일**: 2026-10-11 — 웨이브 6 코드 수정 반영(r5-code 검수 H1) — 파티션 · 보존 불릿의 직접 비교 창 표기 KST D−5 · D−4~D−1 → **UTC D−6 13~14시 · D−4~D−1**(넣기 사흘 창은 UTC 일 파티션 통째) — 대조표 행 수 불변
> **개정일**: 2026-10-11 — **D-16 직접 비교 — 비교 사본을 RDB 정상형으로**(사용자 결정 2026-10-11 결정 2 · 마이그레이션 007 · ADR-28) — **§지금 모양 — 직접 비교(D-16) 신설**(옛 대조군 대 지금 비교 사본 대조표 8행 · 007 DDL 계약 · SW-09 gated · 과거 시각 창 · 직접 비교 3부분) · 실험의 모양 손잡이 기본 off → **gated** · 동형 설계 절 · 인덱스 변형 절 · 삽입 실패 의미론 절은 **기록 035~053을 낸 옛 모양**으로 표기(원문 보존 — 기록 판독 근거) · 크래시 재전달 중복 판정과 버린 대안 ①(유일 키)은 D-16이 뒤집었다(ADR-28) · 관련 문서 순번 004 → 004 · 007
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — EXP 번호 · 질문 · 기록 slug · 결과 요약 보존 · 실행 도구가 지워진 실험은 폐지(D-16)) — §역전 지점 탐색 설계 · §측정 조건 · §스트리밍 동시 적재 — EXP-45 · §실행 수명 객체(라이브 실행의 쿼리 재사용 포함) · §역방향 대조 — 업무 워크로드(하위 절 8) **삭제** · **§폐지된 실험 설계(D-16) 신설**(옛 절 4 · 폐지 실험 11) · EXP-01~05 상태 폐지(D-16) · 대조군 순번 007 → **004**(새 기준선) · SW-09 순서 ⑤ 알람 전달 삭제 · 모드 D 구간 불릿 삭제 · 대조군 용량 축 격자 단계 표 · 디스크 · 스냅샷 불릿 삭제 · 미확인 13 → **9**행(모드 D 채우기 · 대조 자원 · 적재 시간 예산 · 실행기 조정값 삭제) · 관련 문서 05_load_scenarios · 라이브 실행 perf 링크 삭제 — §결과 · §원리 대응 · §예상 결과의 측정 사실은 그대로
> **개정일**: 2026-09-28 — 리드 판정(구현 i-run 문의) — 실행 수명 객체 PostgreSQL 생성 · 삭제 주체 → **마이그레이션 010의 SECURITY DEFINER 함수 run_perf_create · run_perf_drop**(런타임 app_rw DDL 권한 없음 유지 · 소유자 비밀번호를 api에 주지 않는다) — 객체 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — 실행 수명 객체의 생성 식 고정(행 번호 n · **ts 오름차순 삽입(ORDER BY n)** · device_id · tag_id · value 식 · 두 저장소 같은 식) · 규모 증가분 구간(k = 5는 [S, S + 10초) · k > 5는 [S + 10^(k−1) ÷ 10^4초, S + 10^k ÷ 10^4초)) · perf 전용 PostgreSQL 연결 1 — 객체 · 규칙 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27) — 동형 표 ts · ingested_at DateTime64(3, 'Asia/Seoul') → **'UTC'** · 대조군 DDL 주석 경계 Asia/Seoul 자정 → **UTC 자정** · 사후 대조 단위 KST 일 → **UTC 일(파티션 경계)** · 파티션 경계 불릿 KST 자정 → **UTC 자정** — 컬럼 · 폭 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — §실행 수명 객체 신설(ClickHouse plc.run_perf_raw · PostgreSQL run_perf_raw — tag_raw · 대조군 동형 · I2 변형만 · 실행마다 생성 · 종결 시 DROP · 부팅 시 정리 · **고정 기준 테이블 수에 세지 않는다**) · 라이브 실행의 쿼리 재사용 규칙(동일 쿼리 5종 그대로 · 웜만 · 워밍업 1 + 3회 · Q5x 제외) · 라이브 값이 측정 기록이 아니라는 A형 — 테이블 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — 버린 대안 ② 칸의 고정 기준 인용 "업무 14 + 대조군 1" → **업무 · 대조군 부모 테이블 수**(수치는 정본이 갖는다) — 판정 불변
> **개정일**: 2026-09-27 — W6 검수 반영 — Q5 웜 10^5 미정 · 10^5.5부터 ClickHouse를 판정 문장 전부에 · 열 단위 읽기 원리를 Q5로 한정(Q4는 읽는 비율 3.11% 대 3.6%라 설명되지 않음) · BRIN 블록을 hit + read로 통일(10^8 36.1% · 10^9 3.6%) · ClickHouse 머지 증폭 수치 삭제(머지 시점 의존 — 인용 안 함 · WAL 바이트 유지) · 1차 폐기 사유(편차 초과)와 적재 순서의 BRIN 붕괴(039)를 가름 · synchronous_commit off 병기(044 on 보조 팔로 결론 유지) · 버퍼 블록 ≈ 읽은 태그 행 수 · btree 31.6 · 31.5 B · WAL 분모 표현 · 결정적 값 태그 3곳 · 비교 축 6 헤더에 PG 저장 열 구성과 압축률 분모 차 · §예상 결과 역전 행은 역전 표 검산 줄을 가리킴
> **개정일**: 2026-09-27 — W6 결과 반영 — §결과 신설(쿼리별 역전 구간 — 구조 판정 정본 · 중앙값 구간 참고 · 비교 축 6 · 역방향 대조표 EXP-40~45 — 기록 034 · 042~054) · §원리 대응 — 관측에서 원인 구조로 신설(읽은 양 ÷ 테이블 양) · §예상 결과 실측 대조 열 · §미확인 · 미설계 등재 닫힘 7행 · §역전 지점 탐색 설계 "쌓이는 순서" 불릿에 1차 어긋남(역방향 적재)과 2차 해소 한 줄 — 인용 규칙은 04 §기록 상태와 정정(discarded는 구조 사실 · 결정적 값만)
> **개정일**: 2026-09-26 — 마지막 확인 반영 — reverse read 키를 EXP별 실제 라벨로(정본은 실행기)
> **개정일**: 2026-09-26 — 러너 재검수 반영 — EXP-43 ⓓ 입력 as-built(CH 같은 order_id · PG 같은 order_no) · reverse read 키 라벨 · EXP-43 MergeTree OPTIMIZE 명시 · after_wait 수렴 정의(미완 mutation 0만) · 수렴은 detail
> **개정일**: 2026-09-26 — 역방향 러너 보완 반영(as-built) — 머지 뒤 두 판독 라벨(after_wait · after_force) · 수렴 판정 = 강제 문장 성공 + mutation 완료(active patch 파트 수는 관측값) · EXP-40 호출 예산과 budget_exhausted
> **개정일**: 2026-09-26 — W3 코드 검수 반영(r-web-lab L3 · L4) — §스트리밍 동시 적재 — EXP-45 스위치 행 배치 안 현행 기본 → **배치 안 A만**(기록 조건) · 해설 불릿 2(편차 폐기 p50 · 판정 점 p95 · 안 B 보간 한계) — 항목 · 지표 수 불변
> **개정일**: 2026-09-26 — W1 재검수 반영 — 변형 설정 표에 async_insert 플러시 설정 행 신설(async_insert_busy_timeout_max_ms · async_insert_busy_timeout_min_ms · async_insert_use_adaptive_busy_timeout · async_insert_max_data_size — 서버 기본값과 쓴 값 원시) — 설정 행 9 → **10** · EXP-44 ⓑ wait 0 팔을 두지 않는 이유 불릿 · EXP-43 UPDATE 경로 = **work_order_control**(경량 UPDATE · ALTER UPDATE · RMT는 INSERT 경로만) · 원천 줄에 공식 문서 삽입 재시도 중복 제거 · 비동기 삽입 세션 설정 · 실행기 조정값 행에 플러시 설정 값
> **개정일**: 2026-09-26 — W1 검수 반영 — 경량 UPDATE는 공식 문서상 **Beta**(세션 설정 enable_lightweight_update · 판독 apply_patch_parts — Beta 상태의 정본 자리를 이 문서 §역방향 대조 도입으로 둔다) · EXP-42 동시 완료를 update_parallel_mode auto(기본) · sync 두 팔로 · EXP-43 ⓓ에 중복 제거 윈도우 N + 토큰 변형 — ClickHouse 변형 11 → **12** · ⓐ 입력 동형(실행기가 서로 다른 order_id 발급)과 RMT가 order_no 중복을 합치지 않는 구조 사실 · 변형 설정 표 5 → **9**행 · 원리 대응 다문장 트랜잭션을 뺀 이유와 실패 시나리오 · 2계층 실행기 조정값에 EXP-44 커넥션 수 · 동시성
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — §스트리밍 동시 적재 — EXP-45 · §역방향 대조 — 업무 워크로드(EXP-40~44 · 업무 대조 테이블 3 · 업무 규모 격자 3 · 그래뉼 변형 판정 · 원리 대응 · 공정성 규칙 · 기계 판독 필드 제안) 신설 — 결과 절 없음(실측 뒤)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 동시 적재 기전 행 닫힘(06_pipeline/04 W4 판정)
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 1행 닫힘(모드 D 대조군 동일 행 절차) — 테이블 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 격자 6단계 보존 판정 · 조정값 · EXP 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — 대조 실험 자원 조건의 메모리 동일화 값 → ClickHouse 3.5 GB · PostgreSQL 3.5 GB(정본 09_tech_stack/04 · 합계 불변)
> **원천**: docs_plan.md 학습 목표 1(대조군 설계) · 웨이브 인계 W3 05/10 · W4 06/04 행(SW-09 삽입 실패 의미론 · PostgreSQL 멱등 수단) · 원본 tech_stack.md §5.1 "왜 여기에 시계열을 넣지 않나" · §5.2(커밋 ff66a37) · 원본 architecture.md §7.1 · §13 · §15(커밋 ff66a37) · 원본 data_flow.md §10.1 · §11.1 · §11.2(커밋 ff66a37) · 원본 implementation_plan.md §2.4 · §5 S5(커밋 ff66a37) · D-05 · D-05 부분 개정(사용자 결정 2026-10-12) · D-10 · D-12 · ADR-17 · ADR-28 · ADR-32 · 마이그레이션 009 as-built(infra/postgres/migrations/009_control_timescale.sql · 2026-10-12) · [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) 목표 ① · [../03_requirements/07_ingest.md](../03_requirements/07_ingest.md) REQ-ING-15 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 · 목적 적합성 실증 계획 W1(2026-09-26 · 역방향 대조 · EXP-40~45) · ClickHouse 공식 문서 UPDATE 문 · 업데이트 개요 · ReplacingMergeTree · 테이블 제약 · 삽입 재시도 중복 제거 · 비동기 삽입 세션 설정(26.8 · 2026-09-26 context7 대조 — ClickHouse 문서 행 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md) · 대조 항목 추가는 그 문서 소유) · 라이브 실행 제어 리드 판정(2026-09-28 — 실행 수명 객체 · 쿼리 재사용)

**학습 목표 ①은 "시계열을 왜 RDB가 아니라 컬럼형으로 다루는가"를 측정으로 아는 것이다**([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)). 원본에는 RDB 대조 실험이 아예 없었고, PostgreSQL에 시계열을 넣지 않는 이유는 타인의 벤치마크 범위로만 적혀 있었다(원본 tech_stack.md §5.1 · §5.2). 이 문서는 그 이유를 이 머신 · 이 스키마 · 이 쿼리에서 재는 **실험의 설계**다(D-05 · ADR-17).

**산출물은 승패가 아니라 쿼리별 역전 지점이다.** 100만 행에서는 PostgreSQL이 이길 수도 있다 — 인덱스 점조회와 짧은 범위 조회에서 행 기반 저장은 충분히 빠르고 ClickHouse는 파트 스캔의 고정 비용을 낸다. 몇 행부터 역전되는지(또는 관측 범위 안에서 역전이 없는지)가 결과이며, 설계는 값을 예측하지 않는다. 격자 2차가 낸 **구조 판정 역전 구간**(반복 3회 우열이 같은 점만 끝점)이 §결과에 있고, 구간 안의 정밀 행 수와 쿼리 시간의 크기는 **3계층 미확인**으로 남는다(격자 기록이 전부 편차 폐기다).

**설계와 실행을 가른다.** 이 문서가 왜 · 무엇을(테이블 · 적재 · 쿼리 · 축 · 격자)을 갖고, 어떻게(절차 · 판정 지표)는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)의 EXP-01~05 예약 대역이 갖는다. 측정 기록의 값을 이 설계의 칸(쿼리 · 축 · 원리)에 올린 자리는 §결과 · §원리 대응 — 관측에서 원인 구조로다. 동시 적재의 기전은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)가 갖는다. **EXP-01~05와 격자 · 측정 조건 설계는 실행 도구 삭제로 폐지(D-16)됐다** — §폐지된 실험 설계(D-16).

## 지금 모양 — 직접 비교(D-16)

**D-16(사용자 결정 2026-10-11 결정 2)이 대조군을 "RDB를 제대로 쓰면"의 모양으로 고쳤다**(마이그레이션 007 · 결정 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-28). 옛 대조군은 측정 도구(격자 · 대조 자원)와 짝을 이뤄 "두 엔진의 차만 재도록" 키 · 참조 · 값 규칙을 일부러 뺐다. 측정 도구를 지우면서 그 조건을 지킬 이유가 없어졌고, 지금 질문은 "같은 센서 데이터를 Redis로 두 DB에 넣어 보면?"이다 — PostgreSQL이 규칙을 지키는 대가(넣기 시간 · 크기)와 이득(무결성)이 둘 다 비교 대상이다. 아래 절 중 §plc_tag_raw_control — 동형 설계 · §인덱스 변형 · §삽입 실패 의미론은 **기록 035~053을 낸 옛 모양**이며 원문을 남긴다 — 그 기록을 읽는 근거이기 때문이다.

**D-05 부분 개정(사용자 결정 2026-10-12)이 비교 사본의 엔진 모양을 TimescaleDB hypertable · 열 압축으로 바꿨다**(마이그레이션 009 · 결정 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-32). 직접 비교의 PostgreSQL 쪽은 일반 PostgreSQL이 아니라 **PostgreSQL + TimescaleDB 확장**이다 — 무엇과 비교하는가는 [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) D-05 상태 줄이 갖고, 이 절은 그 저장소 모양을 갖는다. 컬럼 7 · 순서 · 키 · 참조 · 값 규칙은 007 그대로이고, SW-09 gated · 같은 배치 보장 · 조회 대결 질의도 바뀌지 않는다. 일반 행 기반 PostgreSQL의 답은 §결과(옛 동형 대조군의 기록)가 갖는다 — 학습 화면의 근거라 고치지 않는다.

| 항목 | 옛 대조군(004 · 기록 035~053) | 지금 비교 사본(007 · 009 · 직접 비교) |
|------|------|------|
| 엔진 | 일반 PostgreSQL — 행 저장 힙 | **PostgreSQL + TimescaleDB**(009 · ADR-32) — 같은 서버 · 같은 SQL 위에 칸 나누기와 열 압축을 더한다 |
| 키 | 없음 — 유일 검사 비용을 빼려고 | **PRIMARY KEY (device_id, tag_id, ts)** — 같은 설비 · 태그 · 시각은 한 번만 |
| 참조 | 없음 | **FK device_id → device**(RESTRICT) — 등록된 설비만 |
| 값 규칙 | 없음 | **CHECK** value가 NaN 아님 · ±1조 안 · quality 7값 |
| 인덱스 | BRIN(ts) · 변형 I2 btree | 기본 키 하나(BRIN 삭제 · 009도 hypertable 기본 시각 인덱스를 만들지 않는다) — 압축 전 칸은 이 키를 타고 압축된 칸은 묶음(device_id · tag_id) 단위로 건너뛴다 |
| 나누기 | pg_partman 일 파티션 — 선언 분할 · 자식 표 · 경계 UTC 자정 | **hypertable 칸(chunk) 1일** — 경계 UTC 자정(epoch 기준 하루 배수 = ClickHouse toYYYYMMDD(ts)와 같은 날) · 넣을 때 스스로 생긴다 |
| 보존 | pg_partman retention 7일 — 일 파티션 DROP | **TimescaleDB 보존 정책 7일** — 칸 통째 삭제 · 작업 주체 app_owner |
| 압축 | 없음 — 행마다 튜플 헤더를 단 힙 | **열 압축(columnstore)** — 묶음 device_id · tag_id · 묶음 안 ts 순 · 넣기 검증 단계가 그 구간 칸만 압축 · **자동 압축 정책 없음** |
| 손잡이 | SW-09 on · off(기본 off) | **SW-09 gated(기본)** — 직접 비교 실행이 게이트 cache:dual:active를 켠 배치만 |
| 채우는 길 | 모드 D 백필 · 모드 B 계단(측정 도구 — D-16 삭제) | 직접 비교 넣기 — 과거 구간을 Redis Stream으로 발행 → Ingest가 같은 배치를 두 저장소에 |
| 비우는 길 | 일 파티션 DROP(보존) | 보존 정책의 칸 삭제 + 구간 비우기(통째로 덮은 칸 drop_chunks · 걸친 칸은 그 구간만 DELETE) · 전부 비우기(TRUNCATE) — app_owner SECURITY DEFINER 함수(app_rw는 DDL · DELETE · TRUNCATE가 없다) |
| 함수 | 없음 — 파티션 관리는 pg_partman 백그라운드 워커 | 검사 1 + SECURITY DEFINER 3 — 구간 압축 control_compress_range(**009 신설**) · 구간 비우기 control_clear_range(009 재정의) · 전부 비우기 control_purge · 007의 파티션 준비 control_prepare_range는 009가 지웠다 — 정본 [02_postgresql_constraints.md](./02_postgresql_constraints.md) §비교 사본 함수 |
| 잴 것 | 역전 지점(행 수 격자) · 비교 축 6 | 넣기(행 수 · 묶음 시간 · 압축 뒤 크기) · 조회 대결(소량 2 · 대량 2 — 압축된 칸을 읽는다) · 무결성(시험 3) |

- 검산: 항목 = 엔진 · 키 · 참조 · 값 규칙 · 인덱스 · 나누기 · 보존 · 압축 · 손잡이 · 채우는 길 · 비우는 길 · 함수 · 잴 것 = **13**
- **같은 배치 보장은 그대로다** — 넣기의 행은 Stream을 한 번 지나 같은 flusher 배치로 ClickHouse 삽입 성공 뒤 COPY된다(§SW-09 동시 적재 순서 ①~⑤ 불변). 달라진 것은 COPY가 실패할 이유가 늘었다는 것뿐이다 — 규칙을 어긴 행 하나가 그 배치를 통째로 롤백한다. 넣기 실행이 만드는 행은 규칙을 어기지 않으므로 넣기에서 실패가 나면 결과의 postgresFailures로 그대로 보인다.

아래는 007이 004 위에 더한 계약이다(설계 계약 · 구현 코드 아님 · 적용 순번 [09_migrations_seed.md](./09_migrations_seed.md) 007 — 키 · 참조 · 값 규칙은 009가 표를 다시 만들 때 그대로 옮긴다).

```sql
TRUNCATE plc_tag_raw_control;                     -- 옛 대조군 행은 키 규칙을 모른 채 쌓였다 — 실행이 다시 채운다
DROP INDEX IF EXISTS plc_tag_raw_control_ts_brin;
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_pkey PRIMARY KEY (device_id, tag_id, ts);   -- 파티션 키 ts 포함
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_device_fk FOREIGN KEY (device_id) REFERENCES device ON DELETE RESTRICT;
ALTER TABLE plc_tag_raw_control
  ADD CONSTRAINT plc_tag_raw_control_value_number CHECK (value <> 'NaN'::double precision),
  ADD CONSTRAINT plc_tag_raw_control_value_range  CHECK (value BETWEEN -1e12 AND 1e12),
  ADD CONSTRAINT plc_tag_raw_control_quality      CHECK (quality IN (0, 1, 2, 3, 4, 5, 9));
-- 함수 넷(검사 1 + SECURITY DEFINER 3)과 app_rw EXECUTE — 02_postgresql_constraints §비교 사본 함수
```

- **tag_id에는 FK를 걸지 않는다.** 무결성 시험의 시험 태그는 시드와 겹치지 않는 높은 대역이라 tag_master에 없고, 새 태그 발급(계보)이 과거 행을 고아로 만들지 않는다 — 참조 규칙 시험은 설비 하나(unknown-device)로 충분하다.
- **값 범위 ±1조는 고장 값을 막는 규칙이다.** FLOAT32 최댓값(약 3.4 × 10^38 — PLC가 센서 단선 · 범위 초과 때 흔히 싣는 표지)과 무한대를 막고, 누적 UINT32 최댓값(약 43억)은 안에 든다. NaN은 Stream 계약이 먼저 막아 DB까지 오지 않는다(시험 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) §무결성 시험).

아래는 009가 007 위에 바꾼 계약이다(설계 계약 · 구현 코드 아님 · 적용 순번 [09_migrations_seed.md](./09_migrations_seed.md) 009).

```sql
-- 앞선 migrate 관리자 단계: CREATE EXTENSION IF NOT EXISTS timescaledb(shared_preload_libraries에 timescaledb)
DELETE FROM partman.part_config WHERE parent_table = 'public.plc_tag_raw_control';
DROP TABLE IF EXISTS partman.template_public_plc_tag_raw_control;   -- pg_partman 관리에서 뺀다
DROP FUNCTION control_prepare_range(timestamptz, timestamptz);      -- 칸은 넣을 때 스스로 생긴다
DROP TABLE plc_tag_raw_control;      -- 선언 분할 표는 hypertable로 바꿀 수 없다 — 비교 사본 행은 지워진다(넣기가 다시 채운다)
CREATE TABLE plc_tag_raw_control (…);   -- 컬럼 7 · 순서 · PRIMARY KEY (device_id, tag_id, ts) · FK device · CHECK 3 — 007 그대로
SELECT create_hypertable('plc_tag_raw_control', by_range('ts', interval '1 day'),
                         create_default_indexes => false);           -- 칸 1일 · 경계 UTC 자정 · 시각 인덱스 없음(키 하나)
ALTER TABLE plc_tag_raw_control SET (timescaledb.enable_columnstore,
  timescaledb.segmentby = 'device_id, tag_id', timescaledb.orderby = 'ts');   -- 자동 압축 정책은 두지 않는다
SELECT add_retention_policy('plc_tag_raw_control', drop_after => interval '7 days');   -- 칸 통째 삭제 · 작업 주체 app_owner
REVOKE UPDATE ON plc_tag_raw_control FROM app_rw;                    -- INSERT · SELECT만(004와 같다)
-- control_clear_range 재정의 · control_compress_range 신설(app_rw EXECUTE) — 02_postgresql_constraints §비교 사본 함수
```

- **칸 · 보존 · 경계는 009가 정한다** — hypertable 칸 1일 · 경계 UTC 자정 · TimescaleDB 보존 정책 7일이 옛 004의 pg_partman 일 파티션 · retention을 대체했다(004는 빈 볼륨 재생에 그대로 돌고, 009 뒤 pg_partman의 관리 대상은 없다). 직접 비교의 과거 창(UTC D−6 13~14시 · D−4~D−1 — 넣기 사흘 창은 UTC 날을 통째로 덮어 ClickHouse는 DROP PARTITION · PostgreSQL은 drop_chunks로만 비운다)이 보존 안에 든다. 비교 결과 · 창 · 문항 · 시험의 계약은 [../07_api/09_datagen.md](../07_api/09_datagen.md) §직접 비교 · 기전은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §직접 비교 실행이 갖는다.
- **압축 시점은 넣기 검증 단계 하나다(ADR-32 ③).** ClickHouse 병합(OPTIMIZE FINAL)과 같은 자리에서 넣은 구간의 칸을 control_compress_range로 압축한 뒤 행 수 · 크기를 재고, 조회 대결은 압축된 칸을 읽는다. 자동 압축 정책을 두면 넣는 도중 백그라운드 작업이 칸을 압축해 넣기 · 묶음 시간이 실행마다 흔들린다. 압축이 실패해도 넣기는 완료로 끝나고 크기는 압축 전 값이다 — verify 단계 detail compressed false · 경고 "TimescaleDB 압축이 실패했어요 — 크기는 압축 전 값이에요"(결과 계약 불변).
- **무결성 창이 압축된 칸에 놓일 수 있다(B형).** 결론 — 같은 날의 넣기 사흘 칸(D−4 · D−3 · D−2)과 무결성 창(D−6)은 다른 칸이라 대개 압축되지 않은 칸에서 시험하지만, 이틀 전 넣기가 압축한 칸(그날의 D−4)이 오늘의 D−6이다. 반대 시나리오 — 압축된 칸의 구간 DELETE가 한 번에 푸는 행 상한(TimescaleDB 설정)에 걸리면 무결성 창 비우기가 오류로 끝나 실행이 준비 단계에서 실패한다. 파생 지침 — control_clear_range만 그 상한을 함수 안에서 0(무제한)으로 푼다(설정 이름 · 기본값은 [02_postgresql_constraints.md](./02_postgresql_constraints.md) §비교 사본 함수) · 규칙 3(중복 · 없는 설비 · 고장 값)은 압축된 칸에서도 막힌다(리드 실측 2026-10-12 — 구조 사실).
- **압축 뒤 크기는 칸 표의 합이 아니다(A형).** 통념은 "hypertable 크기 = 자식 칸 표의 합(pg_inherits)"이다. 그러나 압축 데이터는 칸 표가 아니라 따로 둔 압축 표에 있어 칸 표 합은 압축 뒤 거의 0이 된다. 진짜 축은 칸과 압축 표를 함께 센 크기다. 대체 경로 — 구간 크기는 UTC 날별 칸 크기 chunks_detailed_size(압축 포함) × 구간 몫 · 전체 크기 hypertable_size · 현황 행 수 추정 approximate_row_count(압축한 함수가 ANALYZE로 통계를 다시 모아 추정이 0으로 보이지 않는다)로 읽고, 옛 pg_inherits 합 · reltuples를 쓰지 않는다(ADR-32 ⑤ · 지표 수집의 hypertable 행은 hypertable_detailed_size · approximate_row_count로 읽는다).
- **직접 비교의 값은 측정 기록이 아니다.** 앱 경유 시연값이라 §결과(기록 034 · 042~054)에 오르지 않고 run_result에 화면용으로만 남는다 — 이 문서의 결과 표와 섞지 않는다. 압축 시간 · 압축 뒤 크기도 같다 — 수치는 §미확인 · 미설계 등재에 둔다.

## 실험의 모양

| 항목 | 결정 | 이유 |
|------|------|------|
| 고정하는 것 | **데이터** — 같은 행 집합 | 행 집합이 다르면 두 저장소의 쿼리 결과 자체를 대조할 수 없다(D-05) |
| 바꾸는 것 | **저장소** — ClickHouse tag_raw 대 PostgreSQL plc_tag_raw_control | 목표 ②와 비교 방향이 반대다 — ②는 저장소를 고정하고 역할을 바꾼다 |
| 손잡이 | SW-09 CONTROL_TABLE_ENABLED · 옛 기본 off → **지금 기본 gated(D-16)** | on이 기본이면 모든 삽입 처리량 측정에 대조군 비용이 섞인다(조합 제약 #4) — gated는 직접 비교 실행 중에만 싣는다 |
| 보조 손잡이 | SW-10 off 고정 | 데드밴드는 행 수 · 압축률을 바꾼다 — 대조 실험은 데드밴드 0으로만 |
| 쿼리 | 동일 쿼리 5종 | 쿼리 모양마다 역전 지점이 다르다 |
| 축 | 비교 축 6 | 쿼리 시간만 재면 PostgreSQL이 이기는 구간의 대가(디스크 · WAL)가 보이지 않는다 |
| 독립 변수 | 테이블 총 행 수(격자) | 역전은 행 수 축 위의 한 점이다 |
| 학습 단계 | S3 적재 구현 · S5 측정(D-12) | S5의 용량 단계 데이터를 부하 측정과 공유한다 |

- 검산: 항목 = **8** · 동일 쿼리 **5** · 비교 축 **6**
- **대조군은 중복 저장이 아니라 실험 계측물이다**(전역 불변식 저장소 책임 단일화). 분기 ①계층의 목적지는 ClickHouse뿐이며, 대조군은 분기 표에 행이 없다.

## plc_tag_raw_control — 동형 설계

**기록 035~053을 낸 옛 모양이다** — 지금 테이블은 §지금 모양 — 직접 비교(D-16)다(컬럼 7 · 순서 · 날 경계는 같고 키 · 참조 · 값 규칙 · 인덱스와 나누기(일 파티션 → hypertable 칸 — 009) · 압축이 다르다). tag_raw와 **같은 컬럼 · 같은 의미 · 같은 파티션 경계**를 갖되, 각 엔진이 자기 방식으로 가장 합당하게 저장하게 둔다. 동형은 "같은 논리 스키마"이지 "같은 물리 배치"가 아니다.

| 컬럼 | ClickHouse tag_raw | PostgreSQL 대조군 | 폭(바이트) CH · PG | 동형 판정 |
|------|------|------|------|------|
| ts | DateTime64(3, 'UTC') | timestamptz NOT NULL | 8 · 8 | 같다 — 값은 epoch ms · PG 정밀도 μs가 ms 값을 정확히 담는다 |
| device_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 — 값 범위가 2^31 미만 |
| tag_id | UInt32 | integer NOT NULL | 4 · 4 | 같다 |
| value | Float64 | double precision NOT NULL | 8 · 8 | 같다 — 비트 단위 동일 |
| quality | UInt8 | **smallint** NOT NULL | 1 · **2** | 다르다 — PostgreSQL에 1바이트 정수가 없다. 폭 차 1바이트를 기록한다 |
| scan_seq | UInt64 | bigint NOT NULL | 8 · 8 | 같다 — 값 범위가 2^63 미만 |
| ingested_at | DateTime64(3, 'UTC') DEFAULT now64(3) | timestamptz NOT NULL DEFAULT now() | 8 · 8 | 같다 — 한 적재 단위의 행이 같은 값을 받는다(질의 · 트랜잭션 단위 1회 평가) |

- 검산: 컬럼 = **7** · 폭 합 CH 41 · PG 42 바이트 · 같은 폭 6 + 다른 폭 1
- **PostgreSQL 쪽 컬럼 순서는 정렬 여백이 없게 둔다.** 8바이트 4개(ts · value · scan_seq · ingested_at) → 4바이트 2개 → 2바이트 1개 순이면 행 안 여백이 0이다. 선언 순서대로(ts · device_id · tag_id · value …) 두면 quality 뒤에 6바이트 여백이 생겨 저장 용량 축이 PostgreSQL에 불리하게 부풀린다 — 동형은 논리 스키마의 동일이지 선언 순서의 동일이 아니다.
- **ingested_at은 대조군 쪽에서 삽입 트랜잭션 시각이다.** 두 저장소의 ingested_at은 서로 다른 시계 시점을 가리키므로 E2E 지연 비교에 쓰지 않는다 — 삽입 처리량 축은 적재 계측(§비교 축 6)으로 잰다.

아래는 대조군 DDL 계약이다(설계 계약 · 구현 코드 아님). 적용 순번은 [09_migrations_seed.md](./09_migrations_seed.md) 004다(D-16 새 기준선).

```sql
CREATE TABLE plc_tag_raw_control
(
    ts          timestamptz      NOT NULL,
    value       double precision NOT NULL,
    scan_seq    bigint           NOT NULL,
    ingested_at timestamptz      NOT NULL DEFAULT now(),
    device_id   integer          NOT NULL,
    tag_id      integer          NOT NULL,
    quality     smallint         NOT NULL
) PARTITION BY RANGE (ts);                       -- 일자 파티션 · 경계 UTC 자정(ADR-27) · pg_partman 관리

CREATE INDEX plc_tag_raw_control_ts_brin
    ON plc_tag_raw_control USING brin (ts);       -- 인덱스 변형 I1(기본)

-- 인덱스 변형 I2에서만 추가:
-- CREATE INDEX plc_tag_raw_control_key_btree ON plc_tag_raw_control (device_id, tag_id, ts);
```

- **(옛 판정 — D-16이 뒤집었다)** **PK · UNIQUE · FK를 두지 않는다.** tag_raw는 기본 키 유일성 · 참조 검사를 하지 않는다. 대조군에만 두면 삽입 처리량 · 인덱스 크기 축이 두 엔진의 차가 아니라 제약 비용의 차를 잰다 — 멱등을 유일 제약으로 풀지 않는 이유와 같다(§삽입 실패 의미론).
- **파티션 경계는 tag_raw의 toYYYYMMDD(ts)와 같은 UTC 자정이다(ADR-27).** DB 기본 timezone이 UTC라 pg_partman이 같은 경계로 만든다(D-16 새 기준선 004가 처음부터 UTC 세션에서 만든다 · [09_migrations_seed.md](./09_migrations_seed.md) §DB 시간대 전환 · [02_postgresql_constraints.md](./02_postgresql_constraints.md)). 경계가 다르면 보존 · 쿼리 창의 경계 행이 한쪽에만 있다.
- 보존은 tag_raw와 같은 기간이다 — 정본 [08_retention_lifecycle.md](./08_retention_lifecycle.md) §대조군 보존 정합.

## 인덱스 변형

**옛 모양의 실험 변수다** — 007이 BRIN을 지웠고 지금은 기본 키 인덱스 하나다(§지금 모양). docs_plan의 설계 정본은 **BRIN · 일자 파티션**이었다. BRIN은 블록 범위별 최소 · 최대만 기록해 추가 전용 시계열에서 크기가 작지만, ts 외 조건(device_id · tag_id)으로는 가지치기를 못 한다. 그래서 인덱스를 실험 변수로 둔다.

| 변형 | 인덱스 | 단일 태그 조회의 경로 | 쓰는 축 | 지위 |
|------|------|------|------|------|
| I1 | BRIN(ts) | ts 범위 블록을 읽고 device_id · tag_id를 행마다 거른다 | 전 축 | **기본 — docs_plan 설계** |
| I2 | I1 + btree(device_id, tag_id, ts) | 인덱스로 태그 행만 찾는다 | 쿼리 시간 · 인덱스 크기 · 삽입 처리량 · WAL | 변형 — 행 기반 RDB가 시계열에 거는 표준 인덱스 |

- 검산: 변형 = **2**
- **I1만 재면 PostgreSQL을 허수아비로 만든다(A형).** 통념은 "BRIN이 시계열 인덱스의 정답"이다. 그러나 1만 태그가 섞여 들어오는 행 순서에서 BRIN(ts)은 단일 태그 조회를 ts 범위 전체 스캔으로 만든다 — 단일 태그 1시간(Q1)에서 PostgreSQL이 지는 이유가 엔진이 아니라 인덱스 선택이 된다. 진짜 축은 "인덱스 비용을 내고 조회를 사는가"다. 대체 경로 — I2를 함께 재어 btree가 산 조회 시간과 그 대가(인덱스 크기 · 삽입 · WAL)를 한 표에 둔다.
- 변형은 측정 조건이다 — 모든 기록에 I1 · I2를 적는다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)).

## SW-09 동시 적재

같은 배치를 두 저장소에 싣는 순서다. 기전의 정본은 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md)(W4)이며, 이 문서는 저장소 쪽 계약을 고정한다.

```plain
① 배치 확정              단일 flusher가 결정적 토큰으로 묶는다              ADR-09 · REQ-ING-06
② ClickHouse 삽입        재시도 · 같은 토큰 · 소진 시 DLQ                    REQ-ING-08
③ 대조군 삽입            ②가 성공한 배치만 · 1회 시도 · 트랜잭션 1개(COPY)  이 문서 판정
④ XACK                   ③의 성패와 무관                                   REQ-ING-15
⑤ 최신값 갱신           ④ 뒤                                              REQ-ING-07
```

- **③은 ②의 재시도 루프 밖에 있다.** ClickHouse 재시도가 몇 번 돌든 대조군 삽입은 확정된 배치당 한 번이다 — 재시도 루프 안에 두면 ClickHouse 쪽 재시도마다 대조군에 같은 행이 쌓인다.
- **③은 COPY 한 번 · 트랜잭션 하나다.** 트랜잭션이면 실패한 배치가 대조군에 부분만 남지 않는다. COPY는 PostgreSQL이 낼 수 있는 가장 빠른 표준 적재 경로다 — 행 단위 INSERT로 재면 PostgreSQL의 한계가 아니라 클라이언트 왕복을 잰다.
- **대조군 삽입은 업무 풀이 아니라 전용 커넥션을 쓴다**([02_postgresql_constraints.md](./02_postgresql_constraints.md) §커넥션) — COPY가 업무 CRUD 풀을 점유하지 않는다.

## 삽입 실패 의미론 · 멱등 수단 판정

**옛 모양의 판정이다 — 크래시 재전달 중복 행과 버린 대안 ①은 D-16이 뒤집었다**(ADR-28): 지금은 기본 키가 재전달 중복을 그 배치의 COPY 실패로 막는다(누락이 아니라 이미 들어간 행이 남는다 — 실패 계수에는 센다). 재시도 없음 · 확정 뒤 1회 · XACK 비차단은 그대로다. 웨이브 인계 "SW-09 대조군 삽입 실패 의미론과 PostgreSQL 쪽 멱등 수단"을 닫는다. 요구 수준은 REQ-ING-15가 이미 판정했다 — **XACK를 막지 않는다 · 실패 계수 · 구간 무효 · 대조군 재시도가 중복을 만들지 않는다.** 이 절은 그 요구를 만족하는 저장소 쪽 수단을 고른다.

| 사건 | 대조군 상태 | 수단 | REQ-ING-15 대조 |
|------|------|------|------|
| 대조군 COPY 실패(PostgreSQL 불가 · 제약 오류) | 그 배치 행 0 — 트랜잭션 롤백 | **재시도하지 않는다** · 대조군 실패 계수 + 실패 배치의 ts 범위 기록 | XACK 계속 · 실패 계수 · 구간 무효 ✔ |
| ClickHouse 재시도 | 대조군은 아직 쓰이지 않았다 | ③이 ② 성공 뒤에만 돈다 | 재시도가 대조군에 중복을 만들지 않는다 ✔ |
| ② 성공 · ③ 성공 뒤 XACK 전 크래시 | 배치가 대조군에 있다 | 재전달 시 ClickHouse는 토큰으로 무시 · 대조군은 **한 번 더 들어간다** | 재전달 중복 — DB 제약으로 막지 않는다 · 구간 count 대조로 **검출** · 구간 무효 |
| ② 성공 · ③ 전 크래시 | 배치가 대조군에 없다 | 재전달 시 ②는 무시 · ③이 이번에 쓴다 | 결과적으로 정합 |

- 검산: 사건 = **4** · 대조군이 어긋날 수 있는 사건 2(COPY 실패 · XACK 전 크래시) — 둘 다 구간 count 대조가 드러낸다
- **판정: 대조군의 멱등 수단은 "재시도 없음 + 확정 뒤 1회 + 구간 count 검출"이다.** 재전달 창(③과 ④ 사이의 크래시)의 중복은 막지 않고 드러낸다. 드러난 구간은 대조 실험에서 빼거나 일 파티션 단위로 다시 채운다.

버린 대안은 전부 **비교 축 하나를 오염시킨다.**

| 버린 대안 | 막는 것 | 오염되는 비교 축 | 실패의 구체적 모양 |
|------|------|------|------|
| ① UNIQUE(device_id, tag_id, ts) + ON CONFLICT DO NOTHING | 재전달 중복까지 | 삽입 처리량 · 인덱스 크기 · WAL | 모든 행이 유일 btree 검사를 지나 I1(BRIN만)의 삽입 수치가 사라진다 — ClickHouse에 없는 비용이 PostgreSQL 쪽에만 붙는다 |
| ② 배치 토큰 원장 테이블 | 재전달 중복 | 테이블 수 · 삽입 경로 | PostgreSQL 테이블 수 고정 기준(업무 · 대조군 부모 테이블 수)이 바뀌고 배치마다 원장 쓰기 · 조회가 더해진다 |
| ③ 대조군 재시도 + 사후 중복 제거(DELETE) | 일시 실패의 누락 | VACUUM/WAL 증폭 | 사후 DELETE가 죽은 튜플과 WAL을 만들어 증폭 축이 적재 비용이 아니라 정리 비용을 잰다 |
| ④ 대조군 실패 시 XACK 보류 | 누락 | 목표 ② 전체 | PostgreSQL 지연이 수집 경로의 백프레셔가 된다 — REQ-ING-15가 이미 기각 |

- 검산: 버린 대안 = **4**
- **재전달 창은 좁고 드러난다(B형).** 결론 — 크래시가 ③과 ④ 사이에 떨어진 배치만 중복된다. 반대 시나리오 — 이를 막으려 유일 제약을 걸면 대조 실험의 핵심 축 셋이 오염되어 실험 전체가 무의미해진다. 파생 지침 — 대조 실험 직전에 구간 count 정확 일치를 확인하고(REQ-NFR-18), 어긋난 구간은 무효로 표시한다. 이 잔여는 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) #5다.
- 무효 구간은 저장소에 표로 두지 않는다(테이블 수 고정). 실패 계수 · 실패 배치의 ts 범위는 계측으로, 무효 판정은 측정 기록으로 남는다 — 기록 형식 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) · 메트릭 이름 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md).

## 동일 쿼리 5종

쿼리 모양마다 역전 지점이 다르다. 창(1시간 · 7일 · 1일)은 **데이터 끝 시각 기준**이며, 테이블이 창보다 짧으면 쿼리가 테이블 전부를 읽는다 — 행 수 격자의 작은 단계에서 의도된 동작이다.

| 쿼리 | 모양 | 읽는 행 | 결과 대조 | 원천 |
|------|------|------|------|------|
| Q1 단일 태그 1시간 | 한 태그의 원시 점 · ts 정렬 | 태그 1 × 1시간 | 행 수 · 값 정확 일치 | 조회 해상도 raw의 실제 경로 |
| Q2 단일 태그 7일 | 한 태그의 시간 버킷 avg · min · max · count(원시에서) | 태그 1 × 7일 | count · min · max 정확 · avg 오차 허용 | 롤업 없이 원시로 긴 범위 |
| Q3 설비 전체 1일 | 한 설비 모든 태그의 태그별 avg · min · max · count | 설비 1 × 1일 | 상동 | 설비 대시보드 |
| Q4 분 단위 롤업 재계산 | 전 설비 1시간의 분 × 태그 count · avg · min · max · bad_cnt | 전체 × 1시간 | 상동 · bad_cnt 정확 | mv_tag_1m의 일을 조회로 |
| Q5 전체 스캔 count | 비정렬 컬럼 조건의 전 행 count | 전체 | count 정확 | 컬럼형의 열 단위 읽기 |

- 검산: 쿼리 = Q1 · Q2 · Q3 · Q4 · Q5 = **5**
- **Q4는 last · p95를 뺀다.** PostgreSQL에는 argMax가 없고 분위수 근사가 다르다 — 흉내 쿼리를 넣으면 엔진이 아니라 흉내의 비용을 잰다. 두 저장소가 같은 뜻으로 계산하는 집계만 쓴다.
- **Q5는 조건 없는 count를 쓰지 않는다(A형).** 통념은 "count(*)가 전체 스캔의 대표"다. 그러나 ClickHouse는 조건 없는 count()를 파트 메타데이터에서 답해 데이터를 읽지 않는다. 진짜 축은 "열 하나를 끝까지 읽는 비용"이다. 대체 경로 — 정렬 키 밖 컬럼(value) 조건으로 모든 행을 읽게 하고, 조건 없는 count는 보조 관찰로만 기록한다.

아래는 양쪽 SQL이다. 매개변수는 {device} · {tag} · {end}(데이터 끝 시각) · {v}(Q5 문턱)이며 두 쪽이 같은 값을 받는다 — PostgreSQL 쪽 $이름은 바인딩 자리표시다.

```sql
-- Q1 단일 태그 1시간
-- ClickHouse
SELECT ts, value, quality FROM plc.tag_raw
WHERE device_id = {device} AND tag_id = {tag} AND ts >= {end} - INTERVAL 1 HOUR AND ts < {end}
ORDER BY ts;
-- PostgreSQL
SELECT ts, value, quality FROM plc_tag_raw_control
WHERE device_id = $device AND tag_id = $tag AND ts >= $end - interval '1 hour' AND ts < $end
ORDER BY ts;

-- Q2 단일 태그 7일 · 시간 버킷
-- ClickHouse
SELECT toStartOfHour(ts) AS b, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {device} AND tag_id = {tag} AND ts >= {end} - INTERVAL 7 DAY AND ts < {end}
GROUP BY b ORDER BY b;
-- PostgreSQL
SELECT date_trunc('hour', ts) AS b, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $device AND tag_id = $tag AND ts >= $end - interval '7 days' AND ts < $end
GROUP BY b ORDER BY b;

-- Q3 설비 전체 1일 · 태그별
-- ClickHouse
SELECT tag_id, avg(value), min(value), max(value), count() FROM plc.tag_raw
WHERE device_id = {device} AND ts >= {end} - INTERVAL 1 DAY AND ts < {end}
GROUP BY tag_id;
-- PostgreSQL
SELECT tag_id, avg(value), min(value), max(value), count(*) FROM plc_tag_raw_control
WHERE device_id = $device AND ts >= $end - interval '1 day' AND ts < $end
GROUP BY tag_id;
```

- **시간 버킷 함수는 두 엔진에서 같은 경계를 낸다.** 시 · 분 버킷은 +09:00 정수 오프셋에서 시간대와 무관하다. 일 버킷을 쓰는 쿼리는 두지 않았다 — date_trunc('day')는 세션 시간대, toStartOfDay는 컬럼 시간대를 따라 설정 하나로 경계가 갈린다.
- **창 끝 {end}는 두 저장소 모두에 온전히 남은 구간 안이어야 한다.** 보존 경계의 파티션은 한쪽에만 행이 있을 수 있다([08_retention_lifecycle.md](./08_retention_lifecycle.md) §대조군 보존 정합).

나머지 두 쿼리 Q4 · Q5의 양쪽 SQL이다.

```sql
-- Q4 분 단위 롤업 재계산 · 전 설비 1시간
-- ClickHouse
SELECT toStartOfMinute(ts) AS b, device_id, tag_id,
       count(), avg(value), min(value), max(value), countIf(quality IN (2, 4))
FROM plc.tag_raw
WHERE ts >= {end} - INTERVAL 1 HOUR AND ts < {end}
GROUP BY b, device_id, tag_id;
-- PostgreSQL
SELECT date_trunc('minute', ts) AS b, device_id, tag_id,
       count(*), avg(value), min(value), max(value), count(*) FILTER (WHERE quality IN (2, 4))
FROM plc_tag_raw_control
WHERE ts >= $end - interval '1 hour' AND ts < $end
GROUP BY b, device_id, tag_id;

-- Q5 전체 스캔 count · 비정렬 컬럼 조건
-- ClickHouse
SELECT count() FROM plc.tag_raw WHERE value > {v};
-- PostgreSQL
SELECT count(*) FROM plc_tag_raw_control WHERE value > $v;
```

- **Q4의 bad_cnt 조건은 롤업과 같다(quality IN (2, 4)).** 조건식 판정의 정본은 [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §bad_cnt 조건식 판정이다. 이 쿼리의 결과가 tag_1m의 같은 구간 -Merge 결과와 같아야 한다는 것이 롤업 정합의 대조로도 쓰인다.
- **Q5의 문턱 {v}는 선택도를 고정하는 값이다.** 결과 count가 전체의 일정 비율이 되도록 신호 프로파일에서 정하고 모든 단계에서 같은 값을 쓴다 — 선택도가 바뀌면 PostgreSQL 병렬 스캔 계획이 단계마다 달라진다.

## 비교 축 6

| # | 축 | ClickHouse 측정 | PostgreSQL 측정 | 공통 분모 · 함정 |
|:-:|------|------|------|------|
| 1 | 저장 용량 | system.parts 활성 파트 bytes_on_disk 합(tag_raw) | pg_total_relation_size 파티션 합 · 힙과 인덱스를 나눠 적는다 | 단계의 행 수가 같아야 한다 · PostgreSQL은 VACUUM 전후로 다르다 |
| 2 | 압축률 | 공통 논리 크기 ÷ bytes_on_disk | 공통 논리 크기 ÷ 힙 크기 | **공통 논리 크기 = 행 수 × 41 B**(ClickHouse 컬럼 폭 합) — 양쪽에 같은 분자를 쓴다. PostgreSQL은 튜플 헤더 때문에 1보다 작을 수 있다 |
| 3 | 삽입 처리량 | 배치 행 수 ÷ 삽입 시간 | 배치 행 수 ÷ COPY 트랜잭션 시간 | 동시 적재(SW-09)는 두 싱크가 디스크 · CPU를 나눠 쓴다 — 옛 격자는 단독 적재(모드 D · GEN-10 — D-16 삭제)로도 쟀다 |
| 4 | 쿼리 시간(행 수별) | Q1~Q5 지연 · 읽은 행 · 바이트(query_log) | Q1~Q5 지연 · 버퍼 적중 · 읽은 블록(EXPLAIN ANALYZE BUFFERS) | 콜드 · 웜 상태를 가른다(옛 측정 조건 — 콜드 = 컨테이너 재기동 직후 첫 실행 · 웜 = 1회 예열 뒤 반복) |
| 5 | VACUUM/WAL 증폭 | 머지 쓰기 바이트 ÷ 삽입 바이트(part_log) | WAL 바이트 증가분 ÷ 공통 논리 크기(pg_stat_wal) · autovacuum 실행 수 · 동결 VACUUM | 추가 전용 테이블도 삽입 기준 autovacuum과 동결 VACUUM이 돈다 — 적재 끝이 아니라 안정화 뒤까지 잰다 |
| 6 | 인덱스 크기 | 희소 기본 인덱스 + 마크(primary_key_bytes_in_memory · marks_bytes) | pg_indexes_size — I1(BRIN) · I2(btree) 따로 | 변형을 섞어 적지 않는다 |

- 검산: 축 = **6** — 저장 용량 · 압축률 · 삽입 처리량 · 쿼리 시간 · VACUUM/WAL 증폭 · 인덱스 크기
- **축 5는 ClickHouse 쪽에도 짝이 있다.** ClickHouse는 WAL이 없지만 파트 머지가 같은 데이터를 여러 번 다시 쓴다 — "RDB만 쓰기 증폭이 있다"로 읽히지 않게 머지 증폭을 같은 칸에 둔다.
- **축 2의 분모가 다르면 비교가 성립하지 않는다.** ClickHouse의 data_uncompressed_bytes와 PostgreSQL의 행 크기는 서로 다른 "비압축"을 가리킨다 — 공통 논리 크기로 양쪽을 나눈다.

## 대조군 용량 축

대조군의 디스크는 용량 티어(설비 × 태그 × 주기 · [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md))와 **다른 축**이다 — 티어는 운영 부하의 크기이고, 대조군은 SW-09 on 운전에서 tag_raw와 같은 행 수 · 같은 보존 기간이 크기를 정한다. 티어 산정에는 대조군 항이 없으므로 이 절이 대조군 용량의 정본이다. 아래 값은 **구조 계산 도출**이며 실측이 아니다(3계층 미확인).

| 구성 요소 | 행당 크기(구조 계산) | 계산 | 비고 |
|------|------|------|------|
| 힙 행 | 약 76 B | 튜플 헤더 24 + 데이터 42 → 정렬 72 + 줄 포인터 4 | 여백 없는 컬럼 순서 전제 · 페이지 헤더 · fillfactor 제외 |
| BRIN(I1) | 무시 가능 | 블록 범위당 요약 1 | 인덱스 크기 축에서 실측 |
| btree(I2) | 약 30 B 안팎 | 키 16 + 인덱스 튜플 헤더 · 줄 포인터 | 페이지 분할 여백 제외 · 실측 교체 대상 |
| WAL | 삽입 바이트 이상 | 전 페이지 쓰기 · COPY 기록 | 축 5 — 체크포인트 뒤 재사용 |

- 검산: 구성 요소 = **4** · I1 힙 = 행 수 × 76 B — 10^8행 ≈ 7.6 GB(구조 계산 도출) · 옛 격자 단계별 용량 표는 격자와 함께 D-16 삭제
- **이 표는 압축 전 행 저장의 구조 계산이다(009).** 지금 비교 사본은 넣기 검증 단계가 칸을 열 압축하므로 압축된 칸의 행당 크기는 이 표를 따르지 않는다 — 넣는 중 칸과 압축 전 칸만 힙 + 기본 키 btree(I2와 같은 키 모양)다 · 압축 뒤 크기는 미확인(§미확인 · 미설계 등재).

## EXP 예약 대역 연결

EXP-01~05는 대조군 동일 쿼리 5종의 예약 대역이다([../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)). 채번과 실행 절차는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 확정했다(W6 — 다섯 실험이 조건 · 절차를 공유하고 쿼리만 다르다). **D-16으로 실행 도구가 지워져 다섯 실험 모두 상태 폐지(D-16)다** — 번호는 기록 머리가 인용하므로 결번이 아니라 폐지로 보존한다(§폐지된 실험 설계(D-16)).

| EXP | 쿼리 | 주 축 | 함께 싣는 비 쿼리 축(제안) |
|------|------|------|------|
| EXP-01 | Q1 단일 태그 1시간 | 쿼리 시간 · I1 대 I2 | 인덱스 크기 |
| EXP-02 | Q2 단일 태그 7일 | 쿼리 시간 | 저장 용량 · 압축률 |
| EXP-03 | Q3 설비 전체 1일 | 쿼리 시간 | 상동 |
| EXP-04 | Q4 분 단위 롤업 재계산 | 쿼리 시간 · 결과의 롤업 대조 | 삽입 처리량 |
| EXP-05 | Q5 전체 스캔 count | 쿼리 시간 · 읽은 바이트 | VACUUM/WAL 증폭 |

- 검산: EXP = **5** · 쿼리와 1:1
- **비 쿼리 축은 단계마다 한 번 잰다.** 쿼리와 무관하게 테이블 상태의 값이라 다섯 EXP가 같은 단계의 같은 값을 공유한다 — **W6 판정 — 비 쿼리 축은 격자 단계 기록 하나에 싣고 EXP-01~05가 그 기록을 공유한다**(기계 판독 블록의 axes · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)). 오른쪽 열은 해석에서 주로 짝짓는 축이다.

## 폐지된 실험 설계(D-16)

D-16(사용자 결정 2026-10-11)은 측정 도구를 지웠다 — 격자를 채우던 모드 D · GEN-10, 대조 자원 오버레이(compose.control.yml), 모드 B 계단 러너, 역방향 실행기, 옛 perf 직접 재 보기가 사라져 아래 설계는 다시 실행할 수 없다. **설계 원문은 커밋 28c0cc9에 두고 이 문서에서 지웠다.** 실험 번호 · 질문 · 기록 slug는 [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md)가 상태 "폐지(D-16)"로 보존하고, 측정 결과는 §결과가 그대로 갖는다.

| 옛 절 | 실험 | 지운 실행 도구 | 남는 자리 |
|------|------|------|------|
| 역전 지점 탐색 설계(행 수 격자 6단계 · 정밀화 · 단계 절차) · 측정 조건(자원 동일화 · 내구성 · 캐시 상태 · 반복) | EXP-01~05 | 모드 D 백필 + GEN-10 격자 채우기 · 대조 자원 오버레이 | §결과 쿼리별 역전 구간 · 비교 축 6 |
| 스트리밍 동시 적재(모드 B 계단 · 두 싱크 시간) | EXP-45 | 모드 B 계단 러너 · 대조 자원 오버레이 | §결과 역방향 대조표의 EXP-45 행 |
| 역방향 대조 — 업무 워크로드(업무 대조 테이블 3 · 업무 규모 격자 · 그래뉼 변형 · 변형 설정 · 공정성 규칙 · 기계 판독 필드) | EXP-40~44 | 역방향 실행기 · 도구 컨테이너 · ClickHouse 업무 대조 테이블 3 · PostgreSQL 작업지시 · 실적 테이블 | §결과 역방향 대조표 · §원리 대응 — 관측에서 원인 구조로 |
| 실행 수명 객체(plc.run_perf_raw · run_perf_raw) · 라이브 실행의 쿼리 재사용 | 옛 GEN-11 성능 비교 라이브 실행(EXP 없음) | perf 실행 · run_perf_create · run_perf_drop 함수 | 없음 — EXP-PERF 화면과 함께 폐지 |

- 검산: 옛 절 = **4** · 폐지 실험 = EXP-01~05 5 + EXP-45 1 + EXP-40~44 5 = **11** · 실행 수명 객체는 실험이 아니라 화면 기능이라 EXP에 세지 않는다
- **B형 — 기록은 남고 다시 잴 길이 없다.** 결론 — 역전 구간 · 역방향 대조표는 기록 034 · 042~054의 사실로 이 문서에 남는다. 반대 시나리오 — 도구가 없다는 이유로 결과까지 지우면 학습 목표 ①의 유일한 실측 근거가 사라진다. 파생 지침 — 이 결과를 다시 재야 하는 날은 지금 시스템의 비교 경로로 새 실험을 채번하고, 옛 EXP 번호를 다시 쓰지 않는다(결번 영구 보존 — [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)).

## 결과

측정 기록 034 · 042~054를 이 설계의 칸에 올린다. **인용은 기록 상태를 따른다**([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정) — valid 기록은 3회 중앙값을 4요소(커밋 · 메모리 프로파일 · 용량 티어 · 스위치 상태)와 함께 싣고, discarded 기록은 구조 사실(우열 3/3 · 계획 노드 · 읽은 행 · 블록 수 · 결과 일치 · 원자성 · 제약 판정)과 단계당 1회 결정적 값(저장 · 인덱스 · WAL 바이트 · 압축률 · 파트 수)만 싣는다. discarded 기록의 ms · 배수 · 처리량은 기록 번호로만 가리킨다.

- **격자 기록 048~053은 전부 discarded다** — 콜드 1회 실행 분산과 서브 ms 서버 값이 편차 20%를 넘었다(한계 등재 [../10_observability/07_measurement_limits.md](../10_observability/07_measurement_limits.md)). 그래서 쿼리 축은 우열 방향만, 비 쿼리 축은 결정적 값만 이 절에 오른다.
- **모든 ClickHouse 측정에는 서버 로그 trace 수준의 쓰기 부하가 들어 있다**(이미지 기본값 · 측정 중 바꾸지 않음 · 07_measurement_limits) — ClickHouse 쪽 절대값은 이 몫을 가르지 않은 값이다.

### 쿼리별 역전 구간 — 구조 판정(정본)

기록 053(discarded · 구조 판정 · 격자 2차 11점 = 단계 5 + 정밀화 6)의 최종 판정이다. **반복마다의 우열 부호가 3회 모두 같은 점만 끝점이 된다** — 부호는 그 반복의 pair가 동률(ClickHouse client 1 ms 해상도 안)이면 서버 µs, 아니면 client 중앙값으로 정한다. 구간은 (아래 점, 위 점]이고 PostgreSQL 쪽은 I2(btree)다.

| 쿼리 | 웜 — I2 대비 | 콜드 — I2 대비 | I1(BRIN만) 대비 | 우열 미정 점(끝점 제외) |
|------|------|------|------|------|
| Q1 단일 태그 1시간 | 역전 없음 — 10^5~10^9 PostgreSQL I2 우세 | **(10^7, 10^7.25]** I2 → ClickHouse | 웜 · 콜드 10^5~10^9 ClickHouse 우세 | 없음 |
| Q2 단일 태그 7일 | **(10^7.5, 10^8.25]** I2 → ClickHouse | **(10^7, 10^7.25]** I2 → ClickHouse | 상동 | 10^8 웜 |
| Q3 설비 전체 1일 | **(10^5.75, 10^6]** I2 → ClickHouse | **(10^5.5, 10^6]** I2 → ClickHouse | 상동 | 10^5.75 콜드 |
| Q4 분 단위 롤업 재계산 | 역전 없음 — 10^5~10^9 ClickHouse 우세 | 상동 | 상동 | 없음 |
| Q5 비정렬 열 조건 count | 10^5 우열 미정 · 10^5.5~10^9 ClickHouse 우세 | 역전 없음 — 10^5~10^9 ClickHouse 우세 | 웜 10^5 우열 미정 · 그 위와 콜드 ClickHouse 우세 | 10^5 웜(I1 · I2) |

- 검산: 판정 칸 = 쿼리 5 × 캐시 2 × 변형 2 = **20** — 역전 있음 5(전부 I2 대비 · 웜 Q2 · Q3 · 콜드 Q1 · Q2 · Q3) + 역전 없음 · 미정 15 = **20**
- **"ClickHouse 우세 — 10^5부터"는 역전이 관측 범위 아래(10^5행 이하)에 있다는 뜻이다.** Q4 · Q5 콜드와 I1 대비(Q5 웜 제외)가 그렇다 — 첫 점부터 ClickHouse가 앞서므로 이 격자는 그 아래를 재지 않았다. Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse다.
- **Q5 웜 10^5는 반복 우열이 갈렸다**(I1 PG · CH · CH · I2 CH · CH · PG — 기록 048) — 끝점이 될 수 없어 구간 대신 "미정 · 그 위 ClickHouse"로 적는다.
- 결과 대조 — 정밀화 6점 36/36 · 롤업 대조 6/6(기록 053) · 단계 5점 각 기록의 match 전부 true(기록 048~052) — 두 저장소가 같은 답을 냈다.
- **한계 — 동률 점의 서버 µs 판정은 PostgreSQL 쪽으로 기운다**(PostgreSQL 서버 시간은 계획 시간을 빼고 ClickHouse는 파싱 · 계획을 넣는다 — serverTimeAsymmetry). client 부호만으로 구조 판정하면 콜드 Q1 (10^6, 10^7] · Q2 (10^6, 10^7.25] · Q3 (10^5, 10^5.5]가 된다 — 웜 구간은 client만으로도 같다(기록 053).

중앙값 기준 구간은 **참고**다 — 점 중앙값의 앞선 쪽으로 같은 규칙을 적용한 값이며 정본이 아니다(기록 053).

| 쿼리 | 웜(참고) | 콜드(참고) | 구조 구간과 다른 칸 |
|------|------|------|------|
| Q1 | 역전 없음(10^5~10^9 I2 우세) | (10^7, 10^7.25] | 없음 |
| Q2 | (10^8, 10^8.25] | (10^7, 10^7.25] | 웜 — 10^8의 반복 우열이 PG · PG · CH로 갈려 구조 구간의 아래 끝이 10^7.5 |
| Q3 | (10^5.75, 10^6] | (10^5.75, 10^6] | 콜드 — 10^5.75의 반복 우열이 CH · PG · PG로 갈려 구조 구간의 아래 끝이 10^5.5 |
| Q4 · Q5 | 역전 없음(ClickHouse 우세) | 역전 없음(ClickHouse 우세) | 없음 |

- 검산: 행 = **4**(Q4 · Q5 한 행) · 다른 칸 = **2**

### 비교 축 6

격자 2차 단계 기록의 비 쿼리 축이다. 전부 **discarded 기록의 결정적 값**(단계당 1회 · I1 상태 · 안정화 뒤)이다. 행당 값은 이 표의 바이트 ÷ 행 수다. **PostgreSQL 저장 열은 힙과 인덱스(I1 BRIN · 파티션 전부)를 더한 값이고, 압축률 분모는 ClickHouse bytes_on_disk 대 PostgreSQL pg_table_size(힙 · FSM · VM · TOAST — 인덱스 제외)라 두 열의 PostgreSQL 분모가 다르다.** ClickHouse 머지 증폭은 머지 시점에 좌우되는 값이라 결정적 값이 아니다 — 기록 048~052를 참고로 가리키고 인용하지 않는다.

| 단계 · 기록 | 저장 bytes CH · PG(I1 · 힙 + 인덱스) — 행당 B | 압축률 CH · PG(공통 논리 41 B × 행 ÷ 분모) | PG WAL 증폭(WAL bytes ÷ 증가 행 × 41 B) — WAL bytes | 인덱스 bytes CH · BRIN · btree(I2) |
|------|------|------|------|------|
| 10^5 · 048 | 537,029 · 8,519,680 — 5.37 · 85.20 | 7.63 · 0.511 | 1.385 — 5,679,986 | 360 · 245,760 · 3,252,224 |
| 10^6 · 049 | 4,930,420 · 77,152,256 — 4.93 · 77.15 | 8.32 · 0.535 | 1.251 — 46,144,728 | 3,221 · 245,760 · 31,637,504 |
| 10^7 · 050 | 44,687,468 · 766,590,976 — 4.47 · 76.66 | 9.17 · 0.535 | 1.248 — 460,682,100 | 27,502 · 262,144 · 315,514,880 |
| 10^8 · 051 | 440,122,785 · 7,659,085,824 — 4.40 · 76.59 | 9.316 · 0.5354 | 1.797 — 6,629,623,964 | 253,611 · 491,520 · 3,154,337,792 |
| 10^9 · 052 | 4,528,577,595 · 76,584,214,528 — 4.53 · 76.58 | 9.054 · 0.5354 | 1.857 — 68,525,395,670 | 3,271,454 · 2,531,328 · 31,542,476,800 |

- 검산: 단계 = **5** · 축 = 저장 용량 · 압축률 · VACUUM/WAL 증폭(PostgreSQL WAL 쪽) · 인덱스 크기 **4**(이 표) + 삽입 처리량 · 쿼리 시간 **2**(아래 불릿) = **6**
- **축 4 쿼리 시간은 우열 방향만 오른다** — §쿼리별 역전 구간이 그 값이다. 단계 · 정밀화 점의 ms는 기록 048~053이 갖고 정본에 오르지 않는다.
- **축 3 삽입 처리량(단독 적재 rows/s)은 인용하지 않는다** — 기록 048~053의 값이며 처리량은 결정적 값이 아니다. 같은 배치를 받는 두 싱크의 시간은 valid 기록 045가 잰다(§역방향 대조표 EXP-45 행).
- **PostgreSQL 압축률이 1보다 작은 것은 구조다** — 힙 행당 약 76.6 B는 튜플 헤더 24 + 데이터 42 → 정렬 72 + 줄 포인터 4 = 76 B 구조 계산(§대조군 용량 축)과 같다. 10^5의 85.20 B는 파티션별 인덱스 491,520 B가 작은 표에 나뉜 몫이다 — 힙만은 행당 80.0 B(기록 048).
- **btree(I2) 행당은 10^6부터 거의 고정이다** — 31.6 B(10^6 · 31,637,504 ÷ 10^6) · 31.6 B(10^7) · 31.5 B(10^8 · 10^9 · 31,542,476,800 ÷ 10^9) — I2가 산 조회(Q1 웜 역전 없음)의 대가가 행 수에 선형이다.
- **ClickHouse 머지 증폭은 이 표에 없다** — 창 안 머지 실행 시점에 좌우되는 값이라(10^5~10^7은 창 안 머지 0 · 파트 1~5) 결정적 값이 아니다. 머지 시점 의존 — 기록 048~052 참고 · 인용 안 함.
- 신호 프로파일별 압축(EXP-35) — 혼합 **9.16** · RANDOM_WALK **5.70**(보수적인 쪽) · 범위 STEP 124.44 ~ DROPOUT 5.41(기록 034 · valid · 5492c73 · 부하 실험 · M · SW-09 off · SW-10 off · 1시간 36,000,000행 · 파트 1 수렴). 격자의 혼합 압축률(7.63~9.316 · 10^5~10^9 · 048~052 결정적 값)은 같은 방향이지만 파트 · 행 수 조건이 달라 한 표에 겹치지 않는다.

### 역방향 대조표 — EXP-40~45

업무 워크로드를 ClickHouse에 넣었을 때와 스트리밍 적재의 두 싱크다. valid 기록의 4요소 — 042 · 043 · 044 = 19f8861 · 부하 실험 · 티어 해당 없음 · 스위치 기본값 / 046 = 5492c73 · 부하 실험 · 티어 해당 없음 · 스위치 기본값 / 045 = 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 배치 안 A. 규모 10^4 · 10^5 · 10^6 전부 같은 결과인 칸은 한 값으로 적는다.

| EXP · 기록 · 상태 | 질문 | PostgreSQL | ClickHouse | 판정 |
|------|------|------|------|------|
| EXP-40 · 047 · discarded(구조 사실만) | 행 하나의 상태 전이 갱신 | 갱신 300건 = tup_upd 300 · dead_tup 300 · hot_upd 0(9/9 호출) — 새 튜플 버전 · 죽은 튜플 · 인덱스 키 컬럼이라 HOT 불가 | ①② ALTER UPDATE 1건 = 파트 전 행 재작성(MutatePart 300 · 행 합 = 규모 × 300) · ③ 경량 UPDATE 1건 = patch 파트 1개(new_parts 300) · 자연 대기 뒤 patch 미반영 · ④ RMT plain 판독은 50건 × 3회 × 3규모 전부 상한 안에 새 값만 보이는 상태 미관측 · 같은 키 중복 50 → 강제 머지 뒤 0(10^5 · 10^6) | 갱신 단위가 PostgreSQL은 행 · ClickHouse는 파트 · patch · 새 버전 행이다. 가시성 · 갱신 지연 크기는 인용 불가(편차 초과 두 번 — 040 · 047) |
| EXP-41 · 046 · valid | PK 점조회 | p50 0.101 · 0.103 · 0.102 ms(동시성 1) · 조회당 행 1 · 블록 3 · 3 · 4 · Index Scan | 그래뉼 8192 p50 4.176 · 4.167 · 4.268 ms · read_rows 10,000 · 8,359.06 · 8,188.19 / 그래뉼 256 p50 3.981 · 3.973 · 4.16 ms · read_rows 257.6 · 256.64 · 256 · index_granularity MODIFY 거부(code 472) | 읽는 행은 그래뉼 크기에 묶이지만(10^6 행 비 32.0 = 그래뉼 비) 지연은 조회 한 건의 고정 비용이 정한다. PostgreSQL 동시성 8 · 32 처리량은 도구 이벤트 루프 상한에 가려 저장소 상한으로 인용하지 않는다 |
| EXP-42 · 042 · valid(구조 3회 전부) | 완료 단위 원자성 · 같은 주문 동시 완료 | 부분 반영 **0/20** · 경합 위반 **0/20**(3규모 × 3회) — 끊긴 트랜잭션은 버려지고 두 번째 조건부 UPDATE는 행 잠금 뒤 0행 → ROLLBACK | 경량 UPDATE auto · sync 두 팔 모두 부분 반영 **20/20** · 경합 위반 **20/20** · 갱신 행 수 응답 없음(written_rows 0 — 맞힌 문장 · 빗나간 문장 같다) | 불변식(완료 주문 = 실적 1행)을 PostgreSQL은 저장소가 지키고 ClickHouse는 앱이 져야 한다 |
| EXP-43 · 043 · valid(구조 3회 전부) | 무결성 제약 | 수용 2/17 — ⓐ 같은 order_no 동시 8 중 1 · ⓓ 재삽입 2 중 1 · 없는 line_id · CHECK 3종(INSERT · UPDATE) 전부 거절 | MergeTree 수용 17/20 · RMT 11/14 — 거절은 INSERT 경로 CHECK 3종뿐 · **UPDATE 경로(경량 · ALTER) CHECK 미검사** · RMT는 ⓐ 8행이 강제 머지 뒤에도 8 · ⓓ만 1 · 중복 제거 윈도우 100은 재삽입을 1행으로(응답은 오류 없음) · FINAL ÷ 비 FINAL p50 0.95~0.97(수렴 테이블 + 새 행 11개 조건) | 무결성이 PostgreSQL은 쓰기 시점 보장 · ClickHouse는 정렬 키 · 블록 내용 단위의 최종적 수렴이다 |
| EXP-44 · 044 · valid | 단건 고빈도 삽입 50 · 200 · 500 req/s | synchronous_commit off p50 0.967 · 0.572 · 0.550 ms · WAL 343.7 · 341.3 · 338.5 B/삽입(레코드 약 5) · 죽은 튜플 0 | 동기 p50 5.834 · 3.399 · 2.777 ms · 새 파트 = 삽입 수(3,000 · 12,000 · 30,000) · Delayed · Rejected 0 / async_insert(wait 1) p50 114.031 · 691.552 · 708.868 ms · 달성 49.9 · 86 · 86.7 req/s | PostgreSQL은 쓰기 단위가 행이라 비용이 요청률에 무관하고, ClickHouse는 요청 하나가 파트 하나거나(동기) 응답이 플러시 주기에 묶인다(async) — 파트 한도는 500 req/s × 60초 안에서 오지 않았다 |
| EXP-45 · 045 · valid | 스트리밍 동시 적재 — 같은 배치를 받는 두 싱크 | COPY p50 12.51 · 25.0 · 65.0 · 65.0 ms(10,000 · 20,000 · 50,000 · 100,000 pps — 20,000부터 한 칸 보간) · COPY 실패 0 · WAL 51.5 · 50.9 · 53.5 · 52.5 B/행 · 죽은 튜플 0 | 삽입 p50 64.22 · 65.08 · 91.81 · 83.95 ms · 배치 하나 = tag_raw 파트 하나 · 새 파트 8.2 · 7.2 · 5.8 · 5.8 B/행 + 뒤에서 머지 | **PostgreSQL COPY가 플러시 주기를 넘는 pps — 관측 범위 10,000~100,000 pps 안 없음**(COPY p95 중앙값 최대 78.5 ms 대 타임아웃 500 ms). 배치 행 상한 50,000이라 50,000 · 100,000 계단은 같은 크기 배치다 |

- 검산: EXP = **6** — valid 5(042 · 043 · 044 · 045 · 046) + discarded 1(047)
- **EXP-45의 배치당 시간은 PostgreSQL이 더 짧다 — 스트리밍 경로에서 PostgreSQL이 시계열을 못 받는다는 뜻이 아니다(A형).** 통념은 "PostgreSQL은 시계열 적재를 못 따라간다"다. 부정 — 배치 안 A(행 상한 50,000)에서 COPY는 모든 계단에서 ClickHouse 삽입보다 짧고 실패 0이다(COPY 세션 synchronous_commit off — ClickHouse 기본 삽입도 fsync를 기다리지 않는 조건 · 옛 공정성 규칙 5). 진짜 축은 **적재가 아니라 적재한 뒤의 읽기 · 저장 비용**이다 — 같은 행을 PostgreSQL은 행당 약 76.6 B 힙 + 단일 태그 조회용 btree 행당 약 31.5 B로 들고(§비교 축 6), 전 설비 집계(Q4)와 콜드 전 행 스캔(Q5)은 관측 범위 아래에서 이미 역전된다 — Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse(§쿼리별 역전 구간). 대체 경로 — 적재 단가가 아니라 §원리 대응의 읽은 양 비로 목적지를 정한다. ClickHouse 삽입 시간에는 MV 연쇄(tag_1m · 1h · 1d) 쓰기가 들어 있다(기록 045 한계).
- **EXP-41 · 44 · 45의 ClickHouse 값은 trace 로그 부하를 포함하고, 046의 PostgreSQL 동시성 8 · 32 칸은 도구 상한에 가깝다** — 인용 한정은 각 기록의 해석 한계 불릿이 갖는다.

## 원리 대응 — 관측에서 원인 구조로

학습 목표 ①의 해석 문단이 쓰는 표다. 관측 하나마다 그것을 만든 저장 구조를 잇는다. 관측 열의 출처가 discarded 기록이면 구조 사실 · 결정적 값만 쓴다.

| 원리 | 관측(기록 · 상태) | 원인 구조 | 가리키는 것 |
|------|------|------|------|
| 열 단위 읽기 | Q5 10^9 — ClickHouse read_bytes 8,000,000,000 = 공통 논리 크기의 19.51%(= 8 B ÷ 41 B · value 열 하나) 대 PostgreSQL 힙 9,345,856블록 전부(100.0%)(052 · discarded 결정적 값) | 열마다 파일이 따로라 조건 열만 읽는다 · 힙은 행 전체가 한 페이지에 있어 한 열을 읽으려 해도 모든 페이지를 읽는다 | 전 행 한 열 조건(Q5)은 읽는 바이트의 비로 설명된다 — 콜드는 10^5부터 · 웜은 10^5 미정 · 10^5.5부터 ClickHouse. Q4(1시간 창 전 설비)는 읽는 비율이 거의 같아(ClickHouse 3.11% 대 PostgreSQL 힙 3.6%) 열 단위 읽기로 설명되지 않는다 |
| 희소 인덱스(그래뉼) | PK 점조회 read_rows 8,188.19 · 256(10^6 · 그래뉼 8192 · 256)(046 · valid) · 격자 Q1 10^9 read_rows 32,768 = 그래뉼 4개로 결과 3,600행(052) | 기본 인덱스는 그래뉼(기본 8,192행)마다 한 항목 — 행이 아니라 그래뉼을 가리킨다 | 범위 · 집계의 읽기 단위를 줄이지만 점조회를 행 단위로 만들지 않는다 — 업무 키 조회는 PostgreSQL |
| 코덱 · 정렬 | 정렬 키 · 품질 네 열 원시 행당 0.0226 B · 압축 바이트의 93.4%가 value 한 열 · 열 압축 배수 device_id 961.9 · ts 650.1 · value 1.9(혼합)(034 · valid · 5492c73 · 부하 실험 · M · SW-09 off · SW-10 off) | ORDER BY (device_id, tag_id, ts)로 정렬된 열에 Delta가 반복을 만들고 ZSTD가 접는다 · value는 Gorilla가 이웃 값 XOR로 줄인다 | PLC 행이 불어나는 몫(식별 · 시각 열)은 거의 공짜다 — 행당 저장 4.40~5.37 B 대 76.58~85.20 B(048~052 · discarded 결정적 값) |
| 파트 머지 | 동기 INSERT 새 파트 = 삽입 수 · 머지가 뒤따름(044 · valid) · 스트리밍 창 새 파트 180 · 360(= 배치 수) · 머지 약 5 새 파트마다 1회(045 · valid · 참고 관측) · 단계 창의 머지 증폭은 머지 시점 의존이라 인용 안 함(048~052 참고) | 파트는 불변이고 삽입 단위마다 새로 생긴다 · 합치는 비용은 백그라운드 머지가 뒤에서 낸다 | 쓰기 단위가 작을수록 머지가 커진다 — 단건 업무 쓰기에 맞지 않고 큰 배치 적재에 맞는다 |
| 불변 파트 대 힙 | 스트리밍 적재 PostgreSQL 죽은 튜플 0 · autovacuum은 삽입 문턱(045 · valid) · 갱신은 PostgreSQL 죽은 튜플 300 대 ClickHouse 파트 재작성 · patch 파트(047 · discarded 구조 사실) | 추가 전용 힙은 뒤처리가 없고, 갱신은 새 튜플 버전(MVCC)이다 · ClickHouse 갱신은 불변 파트를 다시 쓰거나 patch를 덧댄다 | 추가 전용 시계열은 두 엔진 모두 뒤처리가 작고, 갱신이 섞이는 순간 ClickHouse의 단위가 파트로 커진다 |
| B-tree | 점조회 블록 3 · 3 · 4(10^4 · 10^5 · 10^6)(046 · valid) · 격자 I2 역전 칸 버퍼 블록 ≈ 읽은 태그 행 수(r7.25 Q1 1,778행 · 1,788블록 · r8.25 Q2 태그 행 17,800 · 17,881블록)(053 · discarded 구조 사실) · btree 행당 31.5~31.6 B(049~052 · discarded 결정적 값) | 루트 → 리프 몇 페이지로 행을 가리킨다 · 힙이 삽입 순서(1초에 1만 태그)라 같은 태그의 이웃 행은 서로 다른 페이지 — 행 하나에 페이지 하나 | 읽는 행이 적으면(Q1 1시간 · 점조회) btree가 이기고, 읽는 행이 늘면 페이지 수만큼 비용이 는다 — Q2 · Q3 역전의 원인 |
| BRIN | Q1 I1 버퍼 블록(hit + read) 10^8 337,204(힙의 36.1%) · 10^9 336,887(= 10^9 힙의 3.6% · 1시간 창 ÷ 데이터 27.8시간)(051 · 052 · discarded 구조 사실) · BRIN 10^9 2,531,328 B(052 · discarded 결정적 값) · Q2 I1 10^9 Seq Scan 힙 100.0% | 블록 범위의 ts 최소 · 최대만 적는다 — ts 순서로 쌓인 힙에서 창 밖 범위를 건너뛰지만 device · tag 조건은 거르지 못한다 · 1차 역방향 적재에서는 ts 상관 0.027로 쓸모를 잃었다(039) | 작고 쌓는 순서에 기대는 인덱스 — 단일 태그 조회에서는 I1 대비 전 범위 ClickHouse 우세 |
| MVCC | 갱신 300건 = 죽은 튜플 300 · HOT 0(047 · discarded 구조 사실) | UPDATE는 새 튜플 버전을 쓰고 옛 버전은 VACUUM을 기다린다 · 인덱스 키 컬럼 갱신은 HOT 불가 | 상태 갱신 비용은 행 단위로 유한하다 — 업무의 상태 전이에 맞는 단위 |
| WAL | 단건 삽입 WAL 약 340 B · 레코드 약 5(044 · valid) · 배치 COPY WAL 51~54 B/행 일정(045 · valid) · 격자 WAL bytes ÷ (증가 행 × 41 B) 1.248~1.857(048~052 · discarded 결정적 값) | 모든 변경을 먼저 로그에 쓴다 — 행 수에 비례 · 체크포인트 뒤 첫 수정 페이지는 전체 이미지(FPI) | 내구성의 대가가 행 수에 선형이다 — 시계열 행 수에서는 저장 바이트만큼 쌓이는 비용 |
| 행 잠금 · 트랜잭션 | 부분 반영 0 · 경합 위반 0 대 ClickHouse 20 · 20(042 · valid) | 문장 여럿이 한 커밋 · 조건부 UPDATE가 행을 잠가 두 번째 완료가 0행을 본다 · ClickHouse는 문장 단위 원자성 · 갱신 행 수 응답 없음 | 여러 행을 한 단위로 바꾸는 업무 쓰기는 PostgreSQL |
| 제약 | 수용 PostgreSQL 2/17 대 MergeTree 17/20 · RMT 11/14 · ClickHouse CHECK는 INSERT 경로만(043 · valid) | UNIQUE는 btree 검사 · FK는 참조 행 검사 · CHECK는 모든 쓰기 경로 커밋 전 · ClickHouse는 UNIQUE · FK가 없고 RMT는 정렬 키 단위로 머지 뒤에만 합친다 | 업무 무결성은 쓰기 시점 보장이 필요하다 — PostgreSQL |

- 검산: 원리 = 열 단위 읽기 · 희소 인덱스 · 코덱 · 파트 머지 · 불변 파트 대 힙 · B-tree · BRIN · MVCC · WAL · 행 잠금 · 트랜잭션 · 제약 = **11**행(행 잠금 · 트랜잭션은 한 행)

**읽은 양 ÷ 테이블 양 — 10^9행(기록 052 · discarded · 구조 사실 · 결정적 값).** 원리가 수치로 드러나는 자리다. ClickHouse는 반복 1 웜 첫 측정의 query_log(read_bytes는 비압축) ÷ 공통 논리 크기 41,000,000,000 B, PostgreSQL은 반복 1 EXPLAIN 최상위 노드 shared hit + read(이 절의 블록 수는 전부 hit + read) ÷ 힙 9,345,856블록이다.

| 쿼리 | CH read_rows · read_bytes(÷ 공통 논리) | PG I1 버퍼 블록(÷ 힙) · 계획 | PG I2 버퍼 블록(÷ 힙) · 계획 | 결과 행 |
|------|------|------|------|------:|
| Q1 | 32,768 · 458,879(0.00%) | 336,887(3.6%) · Bitmap Heap Scan(BRIN) | 3,618(0.0%) · Index Scan | 3,600 |
| Q2 | 188,416 · 3,694,560(0.01%) | 9,345,932(100.0%) · Seq Scan × 5 | 100,399(1.1%) · Index Scan × 5 | 28 |
| Q3 | 17,547,264 · 421,134,336(1.03%) | 8,075,165(86.4%) · Bitmap Heap Scan + Seq Scan | 11,984,036(128.2%) · Index Scan + Seq Scan | 200 |
| Q4 | 51,028,480 · 1,275,712,000(3.11%) | 336,901(3.6%) · Bitmap Heap Scan | 336,901(3.6%) · Bitmap Heap Scan | 600,000 |
| Q5 | 1,000,000,000 · 8,000,000,000(19.51%) | 9,345,856(100.0%) · Seq Scan × 10 | 9,345,856(100.0%) · Seq Scan × 10 | 1 |

- 검산: 쿼리 = **5**
- **ClickHouse는 모든 쿼리에서 테이블의 1/5 이하를 읽는다 — Q5도 value 열 하나(8 B ÷ 41 B = 19.51%)다.** PostgreSQL은 인덱스가 조건과 맞지 않는 칸(Q2 · Q5 I1 · Q5 I2)에서 힙 전부를 읽고, I2가 맞는 Q1 · Q2에서도 결과 행 하나에 페이지 하나를 읽는다(Q1 3,600행 · 3,618블록 · Q2 태그 행 100,000 · 100,399블록).
- **Q3 I2의 128.2%는 버퍼 적중이 접근 횟수라서다** — 같은 페이지를 여러 태그가 다시 방문한다(설비 1 = 태그 200이 한 페이지를 나눠 쓴다). 행 기반 힙에서 인덱스가 늘리는 것은 읽는 페이지의 선택이지 페이지 안의 불필요한 열이 아니다.
- **BRIN이 읽는 블록 수는 쌓는 순서에서 나온다** — hit + read 10^8 337,204블록(힙의 36.1%)과 10^9 336,887블록(힙의 3.6%)이 같은 규모다(기록 051 · 052) · 테이블이 10배여도 1시간 창만큼만 읽는다. 1차(역방향 적재)의 같은 쿼리는 p20260926 파티션 전체 4,706,013블록을 Seq Scan했다(기록 039 · discarded · 대조로만).

## 예상 결과

원본이 남긴 일반론 · 예상치와 실측의 대조다. 원본 값은 4요소가 없어 "원본 예상치"로만 인용하고 목표로 읽지 않는다. 실측 칸은 기록 상태의 인용 규칙(§결과 첫 단락)을 따른다.

| 항목 | 원본 예상치 | 이 실험이 대신 내놓는 것 | 실측 대조(기록 · 상태) |
|------|------|------|------|
| 범위 집계 비용 | PostgreSQL은 1억 행 이상에서 급격히 증가(원본 tech_stack.md §5.1) | 쿼리별 역전 행 수 — "1억"이 이 머신에서 어디인가 | **"1억"은 쿼리 하나(Q2 웜 · I2)의 자리다** — 구조 구간 (10^7.5, 10^8.25]. Q3 I2는 10^6 이하 · 콜드 Q1 · Q2는 (10^7, 10^7.25] · Q4 · Q5 콜드와 I1 대비는 10^5 아래 · Q5 웜은 10^5 미정 · 10^5.5부터 ClickHouse · Q1 웜 I2는 10^9까지 역전 없음(053 · discarded 구조 판정) |
| 삽입 처리량 | PostgreSQL 단독 1만~5만 rows/s · ClickHouse 100만+ rows/s(원본 tech_stack.md §5.2) | 같은 배치 · 같은 자원에서의 두 값 | 단독 적재 rows/s는 격자 기록(048~053 · discarded)이라 인용 불가 · **같은 배치의 싱크 시간은 모든 계단에서 PostgreSQL COPY가 짧다**(COPY p50 12.51~65.0 ms 대 삽입 64.22~91.81 ms · 10,000~100,000 pps · 045 · valid · COPY 세션 synchronous_commit off) · 단건은 PostgreSQL p50 0.550~0.967 ms(synchronous_commit off) 대 ClickHouse 동기 2.777~5.834 ms(044 · valid) — on 보조 팔도 1.011~1.897 ms라 결론이 유지된다(044) |
| 압축률 | PostgreSQL 1~3배 · ClickHouse 10~30배 | 공통 분모 기준 · 신호 프로파일별 | PostgreSQL **0.511~0.5354**(1 미만 — 튜플 헤더) · ClickHouse 격자 7.63~9.316(048~052 · discarded 결정적 값) · 프로파일별 혼합 9.16 · RANDOM_WALK 5.70 · STEP 124.44(034 · valid) — 두 원본 범위 모두 이 분모에서는 맞지 않는다 |
| autovacuum · WAL | "부담이 크다"(원본 tech_stack.md §5.1) — 수치 없음 | 삽입 바이트당 WAL · 머지 증폭 | WAL bytes ÷ (증가 행 × 41 B) 1.248~1.857(048~052 · discarded 결정적 값) · ClickHouse 머지 증폭은 머지 시점 의존 — 기록 048~052 참고 · 인용 안 함 · 스트리밍 WAL 51~54 B/행 · 죽은 튜플 0 · autovacuum 창마다 1~3회(045 · valid) — 추가 전용에서 부담은 WAL 바이트이지 VACUUM이 아니다 |
| 역전 지점 | 없음 | 쿼리 5종 각각의 행 수 또는 "관측 범위 안에서 역전 없음" | §결과 쿼리별 역전 구간 — 칸 수는 그 표의 검산 줄이 센다(053 · discarded 구조 판정) |

- 검산: 항목 = **5**
- **설계의 가정 — 쿼리마다 역전 지점이 다르다 — 은 성립한다.** 전체 스캔(Q5)은 콜드에서 관측 범위 아래에서 이미 역전했고 웜은 10^5 미정 · 10^5.5부터 ClickHouse이며 단일 태그 1시간(Q1 · I2)은 웜에서 끝내 역전하지 않았다(10^9까지) — 원래 문장("Q5는 이른 단계 · Q1 · I2는 늦은 단계에서 또는 끝내 역전하지 않을 수 있다")의 두 끝이 다 관측됐다. 하나의 숫자로 요약하지 않는다([../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md)).
- **정밀 행 수는 여전히 미확인이다** — 구간 폭 10^0.25 · 10^0.5 · 10^0.75 안의 교차점, 쿼리 시간의 크기, 다른 태그 · 설비 매개와 다른 자원 조건(3 vCPU · 3.5 GiB)의 구간은 재지 않았다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 쿼리별 역전 지점 · 비교 축 6의 값 | **부분 닫힘(W6)** — 역전은 구조 구간으로 확정(웜 Q1 역전 없음 · Q2 (10^7.5, 10^8.25] · Q3 (10^5.75, 10^6] · 콜드 Q1 · Q2 (10^7, 10^7.25] · Q3 (10^5.5, 10^6] · Q4 · Q5 콜드 · I1 대비 ClickHouse 전 범위 · Q5 웜 10^5 미정 · 10^5.5부터 ClickHouse — 기록 053 · discarded 구조 판정) · 비 쿼리 축은 결정적 값(기록 048~052) — **구간 안 정밀 행 수 · 쿼리 시간 크기 · 삽입 처리량은 3계층 미확인 유지** | §결과 · EXP-01~05 · [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-18 |
| 동시 적재 기전(flusher 안의 위치 · 전용 커넥션 관리) | 닫힘(W4) — ClickHouse 삽입 성공 뒤 COPY 1회 · 전용 커넥션 1 · 트랜잭션 1 · XACK는 대조군 성패와 무관 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전 |
| 대조군 실패 계수 · 무효 구간 기록의 메트릭 이름 | **W6 판정** — ing_control_copy_failures_total + 구조화 로그 이벤트 control_copy_failed | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| Q5 문턱 {v}의 선택도 | **W6 판정** — 격자 1단계 적재 직후 quantileExact(0.5)(value)로 한 번 정해 고정 · 선택도 50% | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 역방향 대조 EXP-40~44의 값 전부(갱신 · 가시성 · 물리 비용 · 점조회 · 부분 반영 · 경합 위반 · 수용 건수 · FINAL 비용 · 단건 삽입) | **닫힘(W6) — 가시성 · 갱신 지연 크기만 미확인 유지** — 점조회 046 · 부분 반영 · 경합 위반 042 · 수용 건수 · RMT 중복 · FINAL 비용 043 · 단건 삽입 044(전부 valid) · 갱신 단위 · RMT plain 미관측은 047 구조 사실(discarded) — 가시성 · 갱신 지연 · 재작성 바이트는 040 · 047 두 번 편차 초과로 인용 불가 · 04_storage_split #9는 원자성 · 제약 · 갱신 단위로 확정 | §결과 역방향 대조표 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) |
| PostgreSQL COPY가 플러시 주기를 넘는 pps | **닫힘(W6)** — 관측 범위 10,000~100,000 pps 안 없음 · COPY 실패 0(기록 045 · valid · 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 배치 안 A) — 100,000 pps 너머 · 배치 안 B · C는 미확인 유지 | EXP-45 · §결과 |
| ClickHouse UPDATE(경량 · ALTER)가 갱신 행 수를 응답으로 돌려주는가 | **닫힘(W6) — 돌려주지 않는다** — 경량 UPDATE · ALTER UPDATE(mutations_sync 1) 모두 응답 요약 written_rows 0 · 맞힌 문장과 빗나간 문장이 같다(기록 042 · 26.8.10.6) | EXP-42 |
| CHECK CONSTRAINT가 UPDATE 경로(경량 · ALTER)에도 검사되는가 | **닫힘(W6) — 검사하지 않는다** — 경량 UPDATE · ALTER UPDATE(mutations_sync 1)의 CHECK 3종 위반이 3규모 × 3회 전부 수용되고 되읽힌다 · 같은 값의 INSERT는 거절(기록 043 · 26.8.10.6) | EXP-43 |
| index_granularity 생성 뒤 변경 불가 · 그래뉼 변형의 자리 | **이 문서 판정** — 실행 범위 변형 테이블(옛 §그래뉼 변형 판정 ② — D-16 삭제) · **변경 불가 닫힘(W6)** — MODIFY SETTING 거부 code 472(3규모 전부 · 기록 046) | EXP-41 · [03_clickhouse_schema.md](./03_clickhouse_schema.md) |
| 직접 비교 TimescaleDB 압축의 수치 — 압축 시간 · 압축 뒤 넣기 · 조회 · 크기 · 압축 설정(묶음 · 정렬 열) 대안 비교 · 압축된 칸에 무결성 시험을 넣는 비용 | **미확인 — 확정 전 임의 값 고정 금지**(직접 비교 값은 앱 경유 시연값이라 4요소 기록이 없다 · D-05 부분 개정 2026-10-12) | §지금 모양 — 직접 비교(D-16) · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) §후속 판정 등재 ADR-32 |

## 관련 문서

- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 ① · 역전 지점 판정의 모양
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — 동형의 기준 tag_raw
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-05 상태 줄(직접 비교가 무엇과 비교하는가 — PostgreSQL + TimescaleDB)
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 대조군 전용 커넥션 · 한계 등재 #5 · 비교 사본 함수(구간 압축 · 구간 비우기)
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 대조군 보존 정합
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 동시 적재 기전
- [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) — EXP-01~05 실행
- [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) — SW-09 · 조합 제약 #4
- [01_postgresql_schema.md](./01_postgresql_schema.md) — 대조군 테이블 · PostgreSQL 테이블 수
- [09_migrations_seed.md](./09_migrations_seed.md) — 대조군 순번 004 · 비교 사본 고침 007 · TimescaleDB 전환 009 · 시드의 결정성
- [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) — 파생 이미지 · PostgreSQL 확장 · 버전 고정표(TimescaleDB · pg_partman)
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 옛 #9 주장(역방향 검증 대상 · D-16 결번)
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 구조 판정 · 기계 판독 블록
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-17 · ADR-28(gated 동시 적재 · 비교 사본 정상형) · ADR-32(TimescaleDB hypertable · 열 압축 · 압축 시점)
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 직접 비교 계약(창 · 문항 · 시험 · 결과)
