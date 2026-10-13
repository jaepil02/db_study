# db_study 설계 문서군 (docs)

> **대상**: db_study 설계 정본 — PLC 대용량 시계열과 업무 데이터를 Redis 중간 계층에서 갈라 ClickHouse와 PostgreSQL에 나눠 싣는 로컬 학습 시스템의 개요 · 기능 · 요구사항 · 아키텍처 · 저장소 · 파이프라인 · API · 화면 · 기술스택 · 관측 · 용어 · 보안
> **작성일**: 2026-09-23
> **개정일**: 2026-10-12 — **D-16 부분 개정 · ADR-33**(사용자 결정 2026-10-12 — 직접 비교 ③ 데이터 정합성 · 같은 CPU · 메모리 · UMASH · WAL) — 현재 상태 불릿 신설 · 고정 기준 기술 결정 32 → **33**(현행 30 → **31**) — 테이블 수 · 제품·학습 결정 수 불변
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(사용자 결정 2026-10-12 — 직접 비교의 PostgreSQL 쪽 비교 사본을 TimescaleDB hypertable · 열 압축으로 · 마이그레이션 009) — 스택 줄 · 현재 상태 불릿 신설 · 고정 기준 기술 결정 31 → **32**(현행 29 → **30**) · PostgreSQL 테이블 행(비교 사본 모양 · 순번 001~009 · 다음 010) · 파생 수치 버전 고정표 37 → **38**행(TimescaleDB) · 공식 참조 74 → **88**(TimescaleDB 14) — 테이블 수 · 제품·학습 결정 수 불변
> **개정일**: 2026-10-11 — **D-16 웹 7화면 재구성 · HMI 편입 · 불필요 기능 삭제 · 새 백엔드**(사용자 결정 2026-10-11 · 같은 날 업무 방해 삭제 · 웨이브 6 코드 as-built · d4 제안 표 병합) — 성격 · 원천 줄(docs_plan · docs_ref 삭제 — 원문 커밋 28c0cc9) · 도입 두 갈래 · D-16 문단 · 현재 상태 **D-16 불릿 신설** · 고정 기준 문서 파일 123 → **109**(폴더 121 → **107**) · 도메인 11 → **8** · 도메인 공백(소유 테이블 없음 6 → **5** · 주 화면 없음 7 → **4**) · 분기 3계층 → **두 갈래** · 흐름 10 → 현행 **9**(F-06 결번) · 스위치 기본값 off 2 → **off 1 · gated 1** · 조합 제약 10 → **11** · APP_ROLE 5 → **4** · PostgreSQL 16 → **9**(업무 7 · 비교 사본 1 · 실행 보관 1 · FK 7 · UNIQUE 6 · 다중 PK 1 · 결합 CHECK 5 · 인덱스 3 · 함수 4) · ClickHouse 객체 12 → **8** · Redis 접두 10 → **7**(ctl 신설) · 활성 키 24 → **18** · 통제 칸 32 → **27** · 열거 집합 알람 상태 삭제 · 태그 종류 8 · HMI 설비 상태 4 신설 · 실험 축 주입 모드 4 → **2** · 부하 시나리오 삭제 · 에러 코드 23 → **12**(네임스페이스 9 → **7** · 보유 8 → **6**) · D 15 → **16** · 기능 ID 93 → 현행 **67** · 채번 **97** · **역할 행 → 인증 · 권한 없음 행**(깨진 링크 2 정리) · REQ 233 → 현행 **163** · 채번 244 · AC 46 → 현행 **29** · 채번 49 · ADR 27 → **31** · API 표면 48 → **35** · 화면 채번 12 → **18** · 현행 2 → **7** · 실험 46 → 현행 **11** · 폐지 35 · 메트릭 147 → **130** · 알림 14 → **13** · 환경변수 40 → **36** · 버전 39 → **37** · 공식 참조 80 → **74** · 위협 29 → **21** · 잔여 21 → **16** · 달력 의미 경계 3 → **5** · ID 예시 · 전역 불변식(REQ-GLB-01~27 · TTL 접두 · 비교 사본 · **목적이 다른 세 쓰기 행 삭제** · 로컬 전용 문구) · 문서 지도 08_screen 핵심 · 읽는 순서 ① 경로
> **개정일**: 2026-10-05 — 웹 · api 호스트 포트 이동(같은 머신의 다른 프로젝트가 호스트 3000 · 3001을 점유 · 사용자 결정 2026-10-05) — 웹 3001 → **13001** · api 호스트 3000 → **13000**(컨테이너 3000 · 서비스명 그대로) · CORS 허용 오리진 http://localhost:3001 → **http://localhost:13001** — 오리진 수 · 바인드 규칙 불변
> **개정일**: 2026-10-03 — 센서 자동 생성 게이트 SENSOR_AUTOGEN(사용자 결정 2026-10-03 · 스위치 밖 운영 게이트) — 파생 수치 행 환경변수 39 → **40**(스위치 밖 27 → **28**) · 스위치 수 불변(스위치 목록에 넣지 않는다)
> **개정일**: 2026-10-03 — UI/UX 다듬기 · 포트 이동(사용자 지시 · 결정 2026-10-03) — 파생 수치 행 버전 고정표 38 → **39**행(Pretendard) · 공식 참조 79 → **80** · 호스트 포트 행 ClickHouse 네이티브 9000 → **19000**(컨테이너 9000 · 다른 프로젝트가 호스트 9000 점유 — 정본 12_security/05_local_exposure)
> **개정일**: 2026-10-03 — 조회 경로 보이기(사용자 선택 · D-15) — 고정 기준 메트릭 이름 145 → **147**(mst_cache_requests_total · rlt_latest_requests_total)
> **개정일**: 2026-10-03 — **D-15 학습자 눈높이 · 한 화면 원칙**(사용자 지시) — 고정 기준 제품·학습 결정 14 → **15**(사용자 6 → **7**) · 현재 상태에 재구성 줄
> **개정일**: 2026-10-03 — **D-14 웹 2화면 전환**(사용자 결정 2026-10-03) — 고정 기준 제품·학습 결정 13 → **14**(사용자 5 → **6**) · 화면 12 → 채번 12 = 현행 **2** + 폐지 10 · 기능 → 화면 · 도메인 공백(08_screen 주 화면 없음) 재집계 · 문서 지도 08_screen 핵심 문서 07_experiment_console → **08_evidence_screens** · 현재 상태에 웹 2화면 줄 · 도메인 공백 08_screen 주 화면 없음 4 → **7**(COL · SIM · ING · MST · TSQ · ALM · WRK — GEN 공백 서술 정정) · 화면 코드 예시 DSH-REALTIME → EXP-PERF
> **개정일**: 2026-09-28 — 라이브 실행 제어(사용자 요구 — EXP-PERF · EXP-FLOW 시작 · 중단 · 완료 · 소요 시간) · DB 시각 UTC · 화면 KST(ADR-27) — 고정 기준 API 표면 44 → **48**(09_datagen 1 → 5) · 에러 코드 22 → **23**(datagen.run_in_progress) · 기능 91 → **93**(GEN-11 · 12) · REQ 229 → **233** · AC 45 → **46** · ADR 26 → **27** · 메트릭 143 → **145** · 공식 참조 70 → **79** · 위협 26 → **29** · 잔여 17 → **21** · 단위와 시각 행에 DB 처리 UTC
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유(사용자 결정 2026-09-27 · D-04 부분 개정 · ADR-26) · 증거 화면 2(EXP-PERF · EXP-FLOW) — 고정 기준 스위치 11 → **12**(SW-12 BIZ_WRITE_PATH) · 조합 제약 9 → **10** · PG 테이블 15 → **16**(biz_command_log) · UNIQUE 8 → **9** · Redis 영역 접두 9 → **10**(biz) · 활성 키 패턴 18 → **24**(lock:biz:writer 단일 소비자 선점 포함) · 통제 칸 26 → **32** · API 표면 43 → **44**(명령 조회) · 화면 10 → **12** · 실험 45 → **46**(다음 EXP-47) · 메트릭 136 → **143** · 환경변수 38 → **39** · 문서 122 → **123**(08_screen/08) · ADR 25 → **26** · 분기 계층 ③행과 전역 불변식 "분기는 성격 판정"의 "업무 쓰기는 Stream을 타지 않는다" → 명령 스트림 경유
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1(역방향 대조 · 스트리밍 동시 적재) — 고정 기준 ClickHouse 테이블 5 → **8**(업무 대조 테이블 3 — 계측물) · 객체 9 → **12** · 실험 39 → **45**(⑧ 역방향 대조 EXP-40~44 · ⑨ 스트리밍 동시 적재 EXP-45) · 다음 채번 EXP-40 → **EXP-46** · 전역 불변식 저장소 책임 단일화에 업무 대조 테이블 계측물 문장
> **개정일**: 2026-09-25 — S4 완료 반영(3e8a46d · 35e8b8d · 기록 021~026) — 성격 줄 S3까지 → **S4까지** · 현재 상태에 S4 불릿 신설
> **개정일**: 2026-09-25 — S3 완료 반영(fdc7849 · 기록 015~020) — 성격 줄 S2까지 → **S3까지** · 현재 상태에 S3 불릿 신설
> **개정일**: 2026-09-25 — S3 구현 반영 — 고정 기준 환경변수 34 → **37**(INGEST_BATCH_PLAN · INGEST_LAB_FAULT · GEN_PROFILE)
> **개정일**: 2026-09-25 — S2 완료 반영(fe64472 · d32b09a · 기록 010~014) — 성격 줄 S1까지 → **S2까지(슬라이스 · 티어 S 전 구성 측정)** · 현재 상태에 S2 불릿 신설
> **개정일**: 2026-09-24 — S1 실측 반영(EXP-21 기록 006 · 410a146 · EXP-39 기록 007~009 · 019e54d) — 성격 줄 S1까지 · 현재 상태에 S1 불릿 신설 · 파생 수치 버전 고정표 37 → **38**행
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — 스택 표기 · 고정 기준 스택 표기 ClickHouse 25.8 → **26.8** · 현재 상태 S0 불릿에 전환 반영
> **개정일**: 2026-09-24 — Docker 메모리 상향 · 체크리스트 7 · Python 반영 — 파생 수치 행 버전 고정표 36 → **37**행 · 공식 참조 68 → **70**
> **개정일**: 2026-09-24 — S0 완료 반영 — 성격 줄 · 현재 상태에 S0 불릿 신설(저장소 3 · Taskfile · 게이트 · 기록 001 · 002 · ADR-14 보강) · 기계 검사 경로 .omc/docs_lint.py → **scripts/docs_lint.py**
> **개정일**: 2026-09-24 — 측정 머신 전환 · S0 구현 반영 — 호스트 포트 행에 현행 측정 머신의 redis 호스트 포트 6380 등재(충돌 시 호스트 쪽만 변경 규칙)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 도메인 공백 행에 08_screen 주 화면 없음 4(COL · SIM · ING · GEN) 추가 · 현재 상태에 남은 미결의 세 부류 명시(문서 판정 대기 0)
> **개정일**: 2026-09-24 — W7 검수 반영 — 현재 상태 절을 완성 상태로 재작성(122본 · 원본 4본 삭제 · 추적은 커밋 ff66a37) · 기술 · 관측 · 보안 파생 수치 행 신설(정본 링크) · REQ 228 → **229**(GLB 24) · 웹 3001 바인드 강제 수단
> **성격**: to-be 설계 정본이다. 학습 단계 S4(조회 경로 · 캐시 · 팬아웃)까지 구현됐고(티어 S · M을 측정) **D-16(2026-10-11)이 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 · 스냅샷을 지우고 웹 7화면 · HMI 최소 화면 · 직접 비교 · 설비 가동 · 센서 데이터 지우기를 as-built로 더했다.** 그 너머(장애 실험 · 스풀 · 백프레셔 전이)는 구현 전이며, 구현과 측정이 진행되면 각 문서를 as-built로 승격하고 미확인 수치를 실측 결과로 갱신한다
> **원천**: 원본 tech_stack.md · architecture.md · data_flow.md · implementation_plan.md(커밋 ff66a37 — W7에서 삭제) · 옛 구축 계획 docs_plan.md · 형식 규율 docs_ref(조직 원리만 이식 · 둘 다 D-16 정리로 삭제 — 원문 커밋 28c0cc9) · D-16(사용자 결정 2026-10-11)

db_study는 배포하지 않는 **로컬 전용 학습 시스템**이다. 목적은 서비스 운영이 아니라 폴리글랏 퍼시스턴스 구조의 부하·성능 특성을 **측정해서** 아는 것이다. 본 문서군은 그 설계를 목적별 12폴더로 나눠 담는 단일 정본이며, 폴더 하나가 질문 하나와 채번 정본 하나를 소유한다.

학습 목표는 두 축으로 확정됐다. **① 시계열을 RDB가 아니라 컬럼형으로 다루는 이유를 측정으로 안다**(PostgreSQL 대조군과 ClickHouse의 동일 쿼리 비교). **② Redis 중간 계층에서 데이터 성격에 따라 목적지가 갈리는 것을 경험한다**(두 갈래 분기 — D-16). 두 축의 정본은 [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md)이고, 두 축을 관통하는 실험 손잡이가 역할 스위치 SW-NN이다.

D-16(사용자 결정 2026-10-11)으로 목표에 **사내 발표(청중 10년차 이상 개발자)와 회사 도입(카드 생산 라인 HMI)**이 더해졌다 — 웹은 발표 순서대로 7화면이고, 같은 센서 데이터를 Redis Stream으로 두 저장소에 똑같이 싣는 **직접 비교 실험**과 카드 라인 30대의 **HMI 최소 화면**을 갖는다. 전제는 **모든 데이터가 Redis를 거친다**는 것이다.

스택은 Next.js 웹(호스트 프로세스) · NestJS 단일 애플리케이션(api 컨테이너 — 제어 평면 + 데이터 평면 모듈) · PostgreSQL 18(직접 비교의 비교 사본만 TimescaleDB 확장 — ADR-32) · ClickHouse 26.8 · Redis 8(단일 인스턴스)이며 Docker Compose 컨테이너 4개로 기동한다. 정확한 버전의 정본은 [09_tech_stack](./09_tech_stack/README.md)이다.

## 현재 상태

- **직접 비교 ③ 데이터 정합성 · 같은 자원(2026-10-12 · D-16 부분 개정 · ADR-33)** — ③ 무결성(규칙 어긴 데이터 3종)을 두 저장소 대조로 바꿨다 — 넣은 구간을 1분 칸마다 행 수 · 값 체크섬으로 맞춰 날짜별 행 수 · 빠진 구간 · 값이 다른 칸을 보인다(마이그레이션 010). 두 DB에 같은 CPU(4코어) · 같은 메모리(부하 실험 프로파일 4.5 GB씩)를 주고, TimescaleDB를 여러 열 벡터 집계(UMASH)가 켜지게 다시 빌드했으며, PostgreSQL WAL 상한을 올려 넣기 중 묶음이 빠지지 않게 했다. 정본 [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) ADR-32 · ADR-33
- **직접 비교의 PostgreSQL 쪽을 TimescaleDB로(2026-10-12 · D-05 부분 개정 · ADR-32)** — 비교 사본 plc_tag_raw_control을 hypertable(칸 1일 · 경계 UTC 자정) · 열 압축으로 다시 만들었다(마이그레이션 009 · 키 · 참조 · 값 규칙은 그대로). 넣기 검증 단계가 ClickHouse 병합과 같은 자리에서 그 구간 칸을 압축한 뒤 크기를 재고, 조회 대결은 압축된 칸을 읽는다. 학습 화면의 근거인 옛 대조 기록(035~053)은 일반 PostgreSQL 조건이라 그대로다 — 두 화면이 서로 다른 PostgreSQL을 보인다. 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) D-05 · [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) ADR-32
- **D-16 웹 7화면 재구성 · HMI 편입 · 불필요 기능 삭제(2026-10-11)** — 웹을 7화면(개념 2 · 비교 2 · 직접 해 보기 2 · 현장 적용 1)으로 다시 짓고 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 · 스냅샷을 코드 · 저장소 · 문서에서 지웠다(측정 기록 docs/measurements는 화면의 근거라 남는다). 새 백엔드는 카드 라인 30대 시드 · 설비 가동 스위치(Redis ctl:plant:power — ADR-29) · HMI 개요 · SW-09 gated(직접 비교 실행 동안만 PostgreSQL에도 — ADR-28) · 직접 비교 3부분(넣기 · 조회 대결 · 무결성 — 업무 방해는 같은 날 삭제 · ADR-31) · 센서 데이터 현황 · 지우기 · 상태를 바꾸는 POST의 JSON 본문과 BFF Origin 확인(REQ-GLB-27)이다. 마이그레이션은 새 기준선(PostgreSQL 001~008 · ClickHouse 001~007 — ADR-30)이라 옛 볼륨은 비우고 다시 만든다. 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) D-16 · [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) ADR-28~31.
- **문서군 122본 완성(2026-09-24)** — 웨이브 W0~W7로 구축했다. W0 골격 · W1 용어 · 개요 · W2 기능 · 요구사항 · W3 아키텍처 · 저장소 · W4 흐름 · W5 API · 화면 · W6 기술 스택 · 관측 · W7 보안 · 추적성 · 공식 참조 · 전수 검수. 웨이브 분담 · 착수 전 보정 결정 · 인계 이력은 옛 docs_plan.md가 가졌다(D-16 정리로 삭제 — 원문 커밋 28c0cc9).
- **원본 설계서 4본(architecture.md · data_flow.md · tech_stack.md · implementation_plan.md)은 W7 마감 커밋에서 삭제했다.** 전 문서의 원천 줄은 원본 절을 커밋 ff66a37 기준으로 적으므로 삭제 뒤에도 git으로 추적된다.
- **S0 저장소 수동 실습 완료(2026-09-24)** — 저장소 컨테이너 3개(개발 프로파일) · Taskfile(snapshot · restore · docs:lint) · pre-commit 게이트 ④ · 실습 스크립트(scripts/lab/s0). 합격 판정 AC-14 · AC-15가 3회 성립했고(docs/measurements 기록 002), 저장소 판별 EXP-32(기록 001)가 롤업 이중 계수를 드러내 ADR-14를 보강했다([04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md)). 착수 체크리스트 1 · 7을 이행해 부하 실험 프로파일로 전환하고, ClickHouse를 26.8 LTS로 옮겨 판별 · 회귀를 다시 돌렸다(기록 003~005).
- **S2 수직 슬라이스 완료(2026-09-25)** — 모드 A → PlcSim → Collector → Stream → Ingest → tag_raw · rt:latest → 최신값 · 시계열 raw · WebSocket → 웹(DSH-REALTIME · EXP-CONSOLE). 합격 넷 성립 — 육안 AC-17 3회 성립(기록 014 · d32b09a · 부하 실험 · S 부분 구성 · 스위치 기본값), 무손실 차 0 · AC-04 · 07 성립(기록 010 · 012), E2E p50 608 · p95 1,011 · p99 1,013 ms(기록 012 · d32b09a · 부하 실험 · S · 스위치 기본값), 최신값 p95 SW-02 on 2.30 · off 6.50 ms(k6 · 기록 013 · d32b09a · 부하 실험 · S 부분 구성 · SW-02 on/off). 첫 E2E 측정은 기록 011 폐기(E2E 편차 기준 초과 — 기동마다 폴링 위상이 달라짐)다.
- **S3 파이프라인 심화 완료(2026-09-25)** — 창 정렬 3중 트리거 · 결정적 토큰(SW-08) · 재시도 → DLQ · XAUTOCLAIM 회수 · 컨슈머 3 · 롤업 MV 3단 · dict_tag · 대조군 동시 적재(SW-09) · 품질 코드 전체 · 데드밴드(SW-10) · 모드 B. 합격 여섯 성립 — 무손실 · 중복 0 · 롤업 정합 · 품질 전파 · TTL 삭제(기록 015 · fdc7849 · 부하 실험 · S · 스위치 기본값) · SW-08 off 중복 250 · on 0(기록 016) · 롤업 avg 상계 안(기록 019) · SW-09 두 저장소 행 수 차 0(기록 015) · 배치 세 안 파트 생성률 A · C 60/분 · B 12~12.5/분 · E2E p50 A 약 1,026 · B 약 3,051 ms(기록 020 · 부하 실험 · M). 곁 기록 SW-10 프로파일 8종(기록 017) · DLQ(기록 018).
- **S4 조회 경로 · 캐시 · 팬아웃 완료(2026-09-25)** — 마스터 REST 17 · 무효화 체인 6단(② ③ 응답 전 · ④ 응답 뒤 · ⑤ BFF · ⑥ WS 중계 + 신호 뒤 신선 창) · Collector 설비 단위 재로드 · 해상도 자동 선택 · 상향 · 키 시간 스냅(SW-04) · 스탬피드 락(SW-05) · LTTB · minmax 워커 · 원시 내보내기 스트림 · 팬아웃 포트(SW-06) · 스로틀 포트(SW-07) · 화면 ANL-TREND · ADM-MASTER · EXP-COMPARE. 합격 셋 성립 — 히트율 on 0.999 · off 0(기록 023 · 3e8a46d · 부하 실험 · M) · 동시 50건 원천 on 1 · off 50(기록 024 · 35e8b8d). 같은 단계 AC-06 · 10 · 39 · 40 · 41 기록 021 · 022 · 025 · 026.
- **S1 생성기 처리량 실측 완료(2026-09-24)** — pnpm 워크스페이스(apps/api · packages/shared) · 품질 게이트 ①~④ · Stream 페이로드 계약 v1 · 신호 프로파일 8종 · piscina 워커 생성기. 단독 처리량은 워커 1에서도 M 티어 3배의 약 197배로 S1 합격(docs/measurements 기록 006 · 410a146 · 부하 실험 · M · 스위치 기본값), 엔트리 인코딩 크기는 기록 007~009(티어별)다.
- **학습자 눈높이 재구성(2026-10-03 · D-15)** — 두 화면을 1년차 학습자가 스크롤 · 접기 없이 한 눈에 읽는 한 장 화면으로 다시 지었다(쉬운 말 · 결론 먼저 · 정확성 계약은 각주로).
- **웹 2화면 전환(2026-10-03 · D-14)** — 사용자 판정(정보 과다)에 따라 웹을 성능 비교(/performance)와 분산 처리 모니터링(/monitoring) 두 화면으로 줄였다. 폐지 화면 10의 명세는 원문을 보존하고 화면 코드는 결번이다. api 표면과 백엔드 파이프라인은 그대로다 — 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) D-14 · [08_screen/08_evidence_screens.md](./08_screen/08_evidence_screens.md). D-16이 이 2화면을 7화면으로 대체했다.
- **문서 판정으로 닫을 미결은 0이다(최종 정밀 검수).** 각 문서의 미확인 · 미설계 등재에 남은 행은 세 부류뿐이다 — ① 실측으로만 닫히는 3계층 미확인(EXP-NN 연결) ② 코드 착수 때 정하는 구현 세부 ③ 확장 로드맵 단계 진입 때 정하는 배분. 행선지가 문서 웨이브이거나 리드 판정 대기인 행은 없다.
- 성능 수치는 docs/measurements의 실측 기록(4요소 병기)만 인용한다 — 나머지는 3계층 미확인이고 [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md)의 현행 실험으로만 확정한다(D-16으로 측정 도구가 지워져 폐지 실험의 수치는 다시 잴 수 없다). 직접 비교 화면의 값은 시연값이라 기록이 아니다. 공식 참조 URL은 등재만 됐고 대조는 착수 체크리스트 7번이 한다.

## 문서 지도

★는 학습 목표 직결 문서다. 채번 열은 그 폴더가 소유하는 ID 한 종류이며, 12_security는 리뷰 폴더라 아무것도 채번하지 않는다.

| 폴더 | 질문 | 채번 | 핵심 문서 |
|------|------|------|----------|
| [01_overview](./01_overview/README.md) | 왜 만드는가 · 무엇을 배우려는가 | D-NN | ★ [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) |
| [02_features](./02_features/README.md) | 무슨 기능이 있는가 | 기능 ID · SW-NN | ★ [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| [03_requirements](./03_requirements/README.md) | 어떤 계약으로 동작하는가 | REQ · AC | ★ [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md) |
| [04_architecture](./04_architecture/README.md) | 어떤 구조로 계약을 강제하는가 | ADR-NN | ★★ [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) |
| [05_data_stores](./05_data_stores/README.md) | 데이터가 어디에 어떤 모양으로 앉는가 | 테이블 · Redis 키 | ★★ [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) |
| [06_pipeline](./06_pipeline/README.md) | 데이터가 어떻게 흐르고 갈라지는가 | F-NN | ★★ [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) |
| [07_api](./07_api/README.md) | 바깥에서 어떻게 부르는가 | API 표면 번호 | [07_api/01_conventions.md](./07_api/01_conventions.md) |
| [08_screen](./08_screen/README.md) | 사람이 무엇을 보는가 | 화면 코드 | ★ [08_screen/10_lab_screen.md](./08_screen/10_lab_screen.md) |
| [09_tech_stack](./09_tech_stack/README.md) | 무엇을 어느 버전으로 쓰는가 | 버전 문자열 | [09_tech_stack/06_decisions_rationale.md](./09_tech_stack/06_decisions_rationale.md) |
| [10_observability](./10_observability/README.md) | 무엇을 어떻게 재는가 | EXP-NN | ★★ [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| [11_glossary](./11_glossary/README.md) | 이 낱말이 무슨 뜻인가 | 에러 코드 · enum · ID 규약 | ★ [11_glossary/05_units_and_time.md](./11_glossary/05_units_and_time.md) |
| [12_security](./12_security/README.md) | 위협 관점에서 다시 읽으면 | 없음 | [12_security/05_local_exposure.md](./12_security/05_local_exposure.md) |

**docs/measurements/는 문서 지도 밖의 예외 폴더다.** 설계 정본이 아니라 실측 기록(EXP-NN 실행 결과)을 쌓는 자리이며, 번호가 없고 공통 골격 검사와 파일 수 집계에서 제외한다. 기록 형식의 정본은 [10_observability/04_experiment_protocol.md](./10_observability/04_experiment_protocol.md)다.

## 읽는 순서

목적에 따라 세 경로 중 하나를 탄다.

| 경로 | 순서 | 이 경로로 답하는 질문 |
|------|------|----------------------|
| 학습 목표 ① — 왜 ClickHouse인가 | [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) → [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) → [05_data_stores/03_clickhouse_schema.md](./05_data_stores/03_clickhouse_schema.md) → [07_api/09_datagen.md](./07_api/09_datagen.md) §직접 비교 → [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) | 같은 센서 데이터를 두 저장소에 실으면 넣기 · 조회 · 무결성이 어떻게 다른가 · 옛 기록에서 몇 행에서 역전됐는가 |
| 학습 목표 ② — Redis에서 무엇이 어디로 갈리는가 | [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) → [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) → [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) → [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) → [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) | 같은 스트림의 데이터가 왜 세 저장소로 갈리는가 |
| 전체 설계 | 01_overview → 02_features → 03_requirements(전역 규칙 먼저) → 04_architecture → 05_data_stores → 06_pipeline → 07_api → 08_screen → 10_observability → 09_tech_stack · 11_glossary · 12_security | 무엇을 · 어떤 계약으로 · 어떤 구조로 만드는가 |

막히면 [11_glossary](./11_glossary/README.md)(용어 · 에러 · enum · ID · 단위와 시각)를 먼저 본다.

## 고정 기준 (전 문서 공통 — 수치의 단일 정본)

모든 문서는 아래 수치를 동일하게 인용한다. 수치가 바뀌면 정본을 고친 같은 변경 단위에서 본 표와 파생 집계를 함께 갱신한다.

| 항목 | 기준 |
|------|------|
| 문서 폴더 | **12개** + 예외 폴더 docs/measurements 1(번호 없음 · 설계 정본 아님) |
| 문서 파일 | **109** — 루트 2(README · CLAUDE) + 폴더 107. 폴더별(README 포함) 01 **7** · 02 **10** · 03 **14** · 04 **11** · 05 **12** · 06 **12** · 07 **9** · 08 **7** · 09 **7** · 10 **7** · 11 **6** · 12 **5**. 검산: 7 + 10 + 14 + 11 + 12 + 12 + 9 + 7 + 7 + 7 + 6 + 5 = **107** · 107 + 2 = **109**. 파일명 정본은 각 폴더 README의 파일 목차다 · D-16으로 지운 파일의 번호는 결번이다(재사용 금지) |
| 도메인 | **8개** — MST · COL · SIM · GEN · ING · TSQ · RLT · OBS. NestJS 모듈과 1:1이 원칙이다(기록된 예외는 정본 §8도메인 검산). 평면별 제어 3(MST · TSQ · RLT) · 데이터 4(COL · SIM · GEN · ING) · 관측 1(OBS). 검산: 3 + 4 + 1 = **8** · 옛 AUT · ALM · WRK는 D-16 폐지(접두 결번). 정본 [01_overview/04_domain_map.md](./01_overview/04_domain_map.md) |
| 도메인 공백 | **도메인이 특정 폴더에서 비는 것은 설계 진술이다.** 세는 기준은 **소유**다(읽기·쓰기 참여가 아니다). 07_api 표면 없음 **3** — COL · SIM · ING(내부 모듈). 05_data_stores 소유 테이블 없음 **5** — COL · SIM · TSQ · RLT · OBS(GEN은 D-16으로 run_result를 소유 · 롤업 객체는 ING 귀속 · Redis 키만 소유한 도메인은 세지 않는다). 06_pipeline 흐름 불참 **1** — OBS. 08_screen 주 화면 없음 **4** — COL · SIM · ING(내부 모듈 — 산출은 EXP-FLOW 흐름도에 보인다) · MST(주 화면이 폐지 화면이었다 — 표면은 화면 없음(API 전용) · D-14). GEN은 EXP-FLOW · EXP-LAB, TSQ는 HMI-PLANT(최근 10분), RLT는 EXP-FLOW · HMI-PLANT, OBS는 EXP-FLOW로 주 화면을 갖는다. 매트릭스 정본 [01_overview/04_domain_map.md](./01_overview/04_domain_map.md) · 각 폴더 README가 공백을 명시한다 |
| 학습 목표 | **2축** — ① 컬럼형 vs RDB(측정) ② Redis 중간 계층의 성격별 분기. 정본 [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md) |
| 분기 | **두 갈래**(D-16 — 옛 ②계층 알람은 삭제 · 번호는 재배치하지 않는다) — ① 센서(태그 원시값) → ClickHouse 전용(직접 비교 실행 동안만 같은 배치를 PostgreSQL 비교 사본에도 — SW-09 gated · ADR-28) ③ 업무(마스터 · 명령 원장) → PostgreSQL 전용(쓰기는 Redis 명령 스트림 stream:biz:cmd를 거쳐 워커가 트랜잭션으로 커밋 · 응답은 커밋 뒤 · Redis는 캐시와 명령 경로 — ADR-26). **모든 데이터가 Redis를 거친다.** 정책 정본 [04_architecture/04_storage_split.md](./04_architecture/04_storage_split.md) · 기전 정본 [06_pipeline/04_routing.md](./06_pipeline/04_routing.md) |
| 데이터 흐름 | 현행 **9종** — F-01~F-10 중 F-06(알람 판정)은 D-16 결번 · 수집 · 배치 적재 · 최신값 조회 · 시계열 조회 · 업무 CRUD · 실시간 푸시 · 롤업 · 테스트 데이터 주입 · 백프레셔와 장애. 검산: 현행 9 + 결번 1 = 채번 **10**. 정본 [06_pipeline/01_flow_inventory.md](./06_pipeline/01_flow_inventory.md) |
| 역할 스위치 | **12종** — SW-01~SW-12. Redis 역할 11(백프레셔 1 · 캐시 4 · 팬아웃 2 · 멱등 1 · 비교 사본 동시 적재 1 · 최신값 결합 1 · 업무 쓰기 경유 1) + 수집 1(데드밴드). 검산: 1 + 4 + 2 + 1 + 1 + 1 + 1 + 1 = **12**. 기본값 on 8 · off 1(SW-10) · gated 1(SW-09 — 직접 비교 실행 동안만 · D-16) · 구현 선택 2(SW-11 = ingest · SW-12 = stream). 조합 제약 **11**. 측정 도구 삭제로 실험을 잃은 스위치 7은 실험 자리를 "없음(D-16)"으로 둔 기록된 예외다. 정본 [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| 실행 구성 | Docker Compose 컨테이너 **4개** — 애플리케이션 1(api) + 저장소 3(postgres · clickhouse · redis). 웹은 **컨테이너가 아니라** 호스트 프로세스다. 관측 스택은 선택 기동 observability 프로파일이며 구성원 **2**(prometheus · grafana — 정본 [09_tech_stack/03_data_infra.md](./09_tech_stack/03_data_infra.md)) |
| 기동 역할 | APP_ROLE — all(기본) · api · worker · collector(옛 datagen은 D-16 삭제). 역할 분리는 확장 로드맵 1단계이며 코드 변경이 없다 · 설비 가동 적용은 collector 역할(ADR-29) |
| 호스트 포트 | 전부 **127.0.0.1 바인드** — 웹 13001 · api 13000(컨테이너 3000) · postgres 5432 · clickhouse 8123 · 19000(컨테이너 네이티브 9000) · 9363 · redis 6379(현행 측정 머신은 호스트 redis-server와 충돌해 **호스트 쪽만 6380** — 컨테이너 내부 6379 · 서비스명 유지) · (프로파일) prometheus 9090 · grafana 3002. PlcSim 5020~5119는 컨테이너 내부 루프백 전용이라 publish하지 않는다(카드 라인은 5020~5049). **웹 13001은 Compose 밖이다** — 바인드는 개발 서버 기동 인자로 강제한다(정본 [12_security/05_local_exposure.md](./12_security/05_local_exposure.md)) |
| PostgreSQL 테이블 | 업무 **7** + 비교 사본 **1** + 실행 보관 **1** = **9**. 업무 7 = site · production_line · device · modbus_config · tag_master · tag_master_history · biz_command_log(업무 명령 멱등 원장). 비교 사본 = plc_tag_raw_control(SW-09 — 기본 키 · 외래 키 · 검사 제약 정상형 · ADR-28 · TimescaleDB hypertable · 열 압축 — ADR-32). 실행 보관 = run_result(직접 비교 결과 · 추가 전용). **세는 기준은 부모 테이블**이다 — 도구 관리 테이블(마이그레이션 이력 · pg_partman 설정 · TimescaleDB 카탈로그)과 자식 파티션 · hypertable 칸 · 압축 표는 세지 않는다. FK 7 · UNIQUE 6 · 다중 컬럼 PK 1 · 결합 CHECK 5 · 인덱스 3 · 비교 사본 함수 4(SECURITY DEFINER 3) · 순번 새 기준선 001~008(ADR-30) + 말미 009(TimescaleDB — ADR-32) · 다음 010(정본 [05_data_stores/02_postgresql_constraints.md](./05_data_stores/02_postgresql_constraints.md)). 정본 [05_data_stores/01_postgresql_schema.md](./05_data_stores/01_postgresql_schema.md) · [05_data_stores/10_olap_vs_rdb_control.md](./05_data_stores/10_olap_vs_rdb_control.md) |
| ClickHouse 객체 | **8** — 테이블 **4**(tag_raw · tag_1m · tag_1h · tag_1d) · MV **3**(mv_tag_1m · mv_tag_1h · mv_tag_1d) · Dictionary **1**(dict_tag). 검산: 4 + 3 + 1 = **8** · 옛 alarm_eval · 업무 대조 계측물 3은 D-16 삭제 · DDL 순번 001~007(다음 008). 정본 [05_data_stores/03_clickhouse_schema.md](./05_data_stores/03_clickhouse_schema.md) · [05_data_stores/04_clickhouse_rollup.md](./05_data_stores/04_clickhouse_rollup.md) |
| Redis 영역 접두 | **7** — 봉인 계열(TTL 금지) 3 stream · rt · ctl(실행 중 제어 상태 — D-16) + 캐시 계열(TTL 필수) 3 cache · lock · biz + Pub/Sub 채널 1 ch. 검산: 3 + 3 + 1 = **7** · 옛 alarm · rl · sess · auth는 D-16 폐지. 활성 키 패턴 **18**(봉인 5 + 캐시 9 + 채널 4 — ctl:plant:power · cache:dual:active 포함) · 봉인 표 통제 칸 **27**. 단일 인스턴스 · volatile-lru. 키 패턴 전수와 봉인 표의 정본은 [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) |
| 열거 집합 | 품질 코드 **7**(0 GOOD · 1 UNCERTAIN · 2 BAD_COMM · 3 BAD_TIMEOUT · 4 BAD_RANGE · 5 STALE · 9 SIMULATED) · 신호 프로파일 **8**(SINE · RANDOM_WALK · RAMP · STEP · BINARY · COUNTER · SPIKE · DROPOUT) · 백프레셔 단계 **5**(정상 · 주의 · 경고 · 위험 · 복구) · 태그 종류 **8**(TEMP · PRESSURE · SPEED · CURRENT · VIBRATION · COUNT · STATE · OTHER — D-16) · HMI 설비 상태 **4**(running · idle · stopped · offline — D-16) · enum 채번 33(현행 26 — 옛 알람 상태는 D-16 결번). 정본 [11_glossary/03_enums_state_machines.md](./11_glossary/03_enums_state_machines.md) |
| 실험 축 | 주입 모드 **2**(A Modbus 경유 · B Stream 직결 — 옛 C · D는 D-16 폐지) · 조회 해상도 **4**(raw · 1m · 1h · 1d) · 메모리 프로파일 **2**(부하 실험 · 개발 — 중간 프로파일은 조건부 대안) · 용량 티어 이름(S · M · M+ · L)은 옛 기록 판독 · 구조 계산용으로만 남는다 · 부하 시나리오는 k6 · 티어 시드와 함께 D-16 삭제(SIM 장애 주입 계획은 남는다) |
| 조정값 | TTL · 배치 크기 · 플러시 주기 · 보존일 · MAXLEN · 백프레셔 임계는 **2계층 조정값**이다 — 본문에 값을 박지 않고 조회 계약(키 모양 · 기준 시점 · 금지된 대체 동작)으로 서술하며 현행 값은 소유처를 밝혀 참고로 적는다. 보존의 정본 [05_data_stores/08_retention_lifecycle.md](./05_data_stores/08_retention_lifecycle.md) · 백프레셔 임계의 정본 [04_architecture/06_backpressure_failure.md](./04_architecture/06_backpressure_failure.md) |
| 성능 수치 | 실측 전 성능 수치는 **3계층 미확인**이다 — "미확인 — 확정 전 임의 값 고정 금지"로 등재하고 생략하지 않는다. 확정은 EXP-NN 실측 결과로만 한다. 목표치의 정본 [03_requirements/13_nonfunctional.md](./03_requirements/13_nonfunctional.md) |
| 에러 코드 | **12종** — 네임스페이스 정의 **7**(표면 도메인 5 + common 1 + data 1 — 기록된 예외) · 코드 보유 **6**(common 4 · master 2 · timeseries 2 · realtime 1 · datagen 2 · data 1 — metrics만 0). 검산: 4 + 2 + 2 + 1 + 2 + 1 = **12**. 네임스페이스는 URL 경로가 아니라 **표면을 소유한 도메인**을 따른다(예외 data — 센서 데이터 지우기). 채번 정본 [11_glossary/02_error_codes.md](./11_glossary/02_error_codes.md) · 미러 [07_api/02_errors.md](./07_api/02_errors.md) |
| 제품·학습 결정 | **16** — D-01~D-16(결번 없음). 확정 주체: 사용자 8 + 원본 4 + 리드 판정 1 + W1 판정 후 사용자 확정 2 + W3 요청 사용자 확정 1 = **16**. 정본 [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) |
| 기능 ID | 현행 **67** — MST 9 · COL 9 · SIM 5 · GEN 7 · ING 12 · TSQ 9 · RLT 10 · OBS 6. 검산: 9 + 9 + 5 + 7 + 12 + 9 + 10 + 6 = **67** · 채번 **97** = 현행 67 + 결번 30(D-16 — AUT · ALM · WRK 도메인과 폐지 기능). 정본 [02_features](./02_features/README.md) 도메인 파일 8본 · 세는 자리는 [02_features/README.md](./02_features/README.md) §기능 집계 |
| 인증 · 권한 | **없음(D-16)** — 로그인 · 역할 · 감사 기록을 지웠다 · 전 표면 무인증 · 표면 앞 검사는 출처 방어(CORS · Host · WebSocket Origin)와 상태를 바꾸는 POST 검사(JSON 본문 · BFF Origin — REQ-GLB-27)뿐이다. 잔여 정본 [12_security/04_threat_model.md](./12_security/04_threat_model.md) |
| 요구사항 · 인수 기준 | REQ 현행 **163** — GLB 25 · MST 13 · COL 16 · SIM 12 · GEN 14 · ING 18 · TSQ 16 · RLT 18 · OBS 12 · NFR 5 · TEC 14. 검산: 25 + 13 + 16 + 12 + 14 + 18 + 16 + 18 + 12 + 5 + 14 = **163** · 채번 244 · 결번 81(D-16 폐지 포함). AC 현행 **29**(흐름 검증 11 + 단계 판정 11 + 학습 목표 산출 3 + 시연 기능 판정 4 — AC-46~49) · 채번 49 · 결번 20. 정본 [03_requirements](./03_requirements/README.md) 각 파일 · [03_requirements/14_acceptance_criteria.md](./03_requirements/14_acceptance_criteria.md) |
| 기술 결정 | **33** — ADR-01~ADR-33(선점 21 + W3 신설 4 + 개정 신설 2(ADR-26 업무 쓰기 명령 스트림 · ADR-27 DB 시간대 UTC · 화면 KST) + D-16 신설 4(ADR-28 SW-09 gated · 29 설비 가동 키 · 30 마이그레이션 새 기준선 · 31 업무 방해 삭제) + D-05 개정 신설 1(ADR-32 비교 사본 TimescaleDB) + D-16 개정 신설 1(ADR-33 직접 비교 데이터 정합성) · 결번 없음) · 상태 현행 31 · 잠정 1(ADR-10) · 폐지 1(ADR-11). 정본 [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) |
| API 표면 | **35** — REST JSON 32 + 다운로드 스트림 1 + 메트릭 텍스트 1 + WebSocket 1. 문서별 01_conventions 1(명령 조회 GET /api/v1/commands/{cmdId}) · 04_master 17 · 05_timeseries 2 · 06_realtime 5(최신값 2 + 설비 가동 2 + HMI 개요 1) · 09_datagen 7(라이브 실행 제어 4 + 직접 비교 최근 결과 1 + 센서 데이터 현황 · 지우기 2) · 10_metrics 2 · 11_websocket 1. 검산: 1 + 17 + 2 + 5 + 7 + 2 + 1 = **35** · 원본 12 + 신설 23. 세는 기준은 도메인 문서의 표면 요약 표 행 수다(최대 번호가 아니다). 정본 [07_api/README.md](./07_api/README.md) |
| 화면 | 채번 **18** — 현행 **7**(LRN-CONCEPTS · LRN-STRENGTHS · LRN-TIMESERIES · LRN-ARCHITECTURE · EXP-LAB · EXP-FLOW · HMI-PLANT — 메뉴 순서가 발표 순서 · D-16) + 폐지 11(D-14 10 · D-16 EXP-PERF 1 · 결번 보존). 검산: AUTH 1 + DSH 1 + ANL 1 + ALM 2 + ADM 3 + EXP 5 + LRN 4 + HMI 1 = **18** · 현행 7 + 폐지 11 = **18** · 반응형 1280×720~2560×1440에서 페이지 스크롤 0(D-16 결정 6). 정본 [08_screen/README.md](./08_screen/README.md) |
| 실험 | 채번 **46**(EXP-01~46 · 결번 없음) = 현행 **11** + 폐지 **35**(D-16 — 실행 도구 삭제 · 번호 재사용 금지 · 기록은 남는다). 신설은 EXP-47부터 말미 채번. 직접 비교(GEN-13)는 실험이 아니라 시연이다(결과는 run_result · 측정 기록 아님). 정본 [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| 기술 · 관측 · 보안 파생 수치 | 메트릭 이름 **130**(정본 [10_observability/01_metrics_catalog.md](./10_observability/01_metrics_catalog.md)) · 알림 규칙 13 · 대시보드 6(정본 [10_observability/03_dashboards_alerts.md](./10_observability/03_dashboards_alerts.md)) · 환경변수 **36**(스위치 12 + 스위치 밖 24 · 정본 [09_tech_stack/04_local_environment.md](./09_tech_stack/04_local_environment.md)) · 버전 고정표 **38**행(정본 [09_tech_stack/03_data_infra.md](./09_tech_stack/03_data_infra.md)) · 공식 참조 **88**(정본 [03_requirements/16_official_references.md](./03_requirements/16_official_references.md)) · 위협 × 통제 **21** · 잔여 16(정본 [12_security/04_threat_model.md](./12_security/04_threat_model.md)) |
| 스택 표기 | **Next.js · NestJS · PostgreSQL 18 · ClickHouse 26.8 · Redis 8 · Docker Compose**로 통일한다. 정확 버전은 09_tech_stack에만 적는다 |
| 단위와 시각 | ts = 측정 시각(모드 A는 Collector 폴링 시점 · 생성 모드는 생성기 시점) · ingested_at = 적재 시각 · 저장은 epoch 기준 · **DB 처리 시간대 UTC**(PostgreSQL DB 기본 · ClickHouse 서버 · 컬럼 · 파티션 · 보존 경계 — ADR-27 · 달력 의미 경계 5만 KST 명시) · 표시 시점에만 Asia/Seoul로 한 번 변환 · 측정값 Float64. 정본 [11_glossary/05_units_and_time.md](./11_glossary/05_units_and_time.md) |

## ID·표기 규약

| 종류 | 형식 | 예 | 채번 정본 |
|------|------|-----|----------|
| 기능 ID | {도메인}-NN | ING-03 | [02_features](./02_features/README.md) 각 도메인 파일 |
| 요구사항 | REQ-{도메인}-NN (전역 REQ-GLB · 비기능 REQ-NFR · 기술운영 REQ-TEC) | REQ-GLB-01 | [03_requirements](./03_requirements/README.md) 각 파일 |
| 인수 기준 | AC-NN | AC-01 | [03_requirements/14_acceptance_criteria.md](./03_requirements/14_acceptance_criteria.md) |
| 기술 결정 | ADR-NN | ADR-01 | [04_architecture/09_decision_records.md](./04_architecture/09_decision_records.md) |
| 제품·학습 결정 | D-NN | D-01 | [01_overview/06_design_decisions.md](./01_overview/06_design_decisions.md) |
| **데이터 흐름** | **F-NN** | F-01 | [06_pipeline/01_flow_inventory.md](./06_pipeline/01_flow_inventory.md) |
| **역할 스위치** | **SW-NN** | SW-01 | [02_features/13_switch_matrix.md](./02_features/13_switch_matrix.md) |
| **실험** | **EXP-NN** | EXP-01 | [10_observability/06_experiment_catalog.md](./10_observability/06_experiment_catalog.md) |
| 화면 코드 | {표면}-{의미} | EXP-LAB | [08_screen/README.md](./08_screen/README.md) |
| 에러 코드 | {domain}.{snake_case} + HTTP 상태 | datagen.run_in_progress/409 | [11_glossary/02_error_codes.md](./11_glossary/02_error_codes.md) — [07_api/02_errors.md](./07_api/02_errors.md)는 미러 |
| API 표면 | {문서} #N (문서 지역 번호) | 05_timeseries #3 | 각 [07_api](./07_api/README.md) 도메인 파일 |
| 테이블 · 컬럼 | snake_case | tag_raw · tag_master.tag_id | [05_data_stores](./05_data_stores/README.md) |
| Redis 키 | 영역:용도:식별자 | rt:latest:{device_id} | [05_data_stores/05_redis_keyspace.md](./05_data_stores/05_redis_keyspace.md) |
| 메트릭 | 정본 문서가 정한 이름 규약 | consumer_lag | [10_observability/01_metrics_catalog.md](./10_observability/01_metrics_catalog.md) |

F-NN · SW-NN · EXP-NN 셋이 이 프로젝트 고유 축이다. 원본의 흐름 표기 F1~F10은 F-01~F-10으로 통일하며 대응은 [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)가 적는다. **번호는 식별자이지 순서가 아니다** — 새 ID는 말미에 채번하고, 재배치하지 않으며, 폐지 번호는 결번으로 영구 보존한다. 상세 규약의 정본은 [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)다.

## 전역 불변식

전 도메인이 전제하는 규칙이다. 상세 계약의 정본은 [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md)(REQ-GLB-01~27)다.

| 항목 | 규칙 |
|------|------|
| 시각 의미론 | ts는 측정 시각이고 ingested_at은 적재 시각이다. **둘을 서로 대체하지 않는다** — E2E 지연(ingested_at − ts)은 두 컬럼의 차로만 계산된다. 저장은 epoch 기준이며 ClickHouse 컬럼의 시간대 속성은 표시·파싱 규칙일 뿐 저장값을 바꾸지 않는다 |
| 비동기 경계 | 수집과 적재 사이에는 반드시 Redis Stream을 둔다. **같은 프로세스 안이어도 예외가 아니다.** 경계를 우회하는 경로는 실험 전용 SW-01 off뿐이며 기본 on · 부팅 경고를 동반한다 |
| at-least-once | XACK은 ClickHouse 삽입이 성공한 뒤에만 한다. 재시도를 소진한 배치는 DLQ로 옮기고 **반드시 XACK한다** — 하지 않으면 PEL에 영구 잔류해 컨슈머 랙 지표가 오염된다 |
| 멱등 | 배치 토큰은 배치 내용에 대해 **결정적**이어야 한다(엔트리 ID 범위 + 행 수의 해시). 무작위 UUID를 쓰면 재시작 후 같은 배치가 다른 토큰을 받아 중복이 생긴다. 재시도 간격은 ClickHouse 중복 제거 윈도우 안에 머문다 |
| 순서 무관성 | 컨슈머 간 순서는 보장하지 않는다. 시계열이 ts를 자체 보유하므로 무해하다 — **순서 의존 집계를 도입하는 순간 이 전제가 깨진다.** 잔여의 기록 자리는 [05_data_stores/02_postgresql_constraints.md](./05_data_stores/02_postgresql_constraints.md)의 한계 등재다 |
| TTL 우선순위 | 단일 Redis 인스턴스에서 **키 접두 하나가 곧 데이터 생존 정책의 경계**다. 봉인 계열(stream · rt · ctl)은 TTL을 붙이지 않고, 캐시 계열(cache · lock · biz)은 TTL 없이 만들지 않는다. 강제 수단은 린트가 아니라 키 계열별 래퍼다 |
| 실패 전략 이원화 | 같은 인스턴스 안에서도 키 계열에 따라 실패 전략이 **정반대**다 — 캐시 계열은 짧은 타임아웃 후 조용히 degrade해 DB로 우회하고, 봉인 계열은 명시적으로 실패시켜 백프레셔를 발동한다 |
| 백프레셔 명시화 | 버퍼가 차면 조용히 버리지 않고 실패시키고 계측한다. MAXLEN 트리밍은 검사를 우회한 발행자를 막는 최후 안전장치이며, 미소비 엔트리가 잘리면 결함으로 계측한다 |
| 저장소 책임 단일화 | 업무 데이터는 PostgreSQL, 시계열은 ClickHouse다. 중복 저장의 유일한 예외는 태그 최신값(Redis 휘발 사본 · ClickHouse가 진실)이다. **비교 사본 plc_tag_raw_control은 중복 저장이 아니라 비교 계측물**이며 직접 비교 실행 동안만 실린다(SW-09 gated 기본 · ADR-28). 옛 ClickHouse 업무 대조 테이블은 D-16 삭제 |
| 분기는 성격 판정 | 분기는 "전부 큐를 태운다"가 아니라 "성격을 보고 경로를 고른다"이다. **모든 쓰기가 Redis를 거치되 경로는 성격이 고른다** — 태그 원시값은 배치 적재 Stream(비동기 · 처리량), 업무 쓰기는 명령 스트림(직렬 워커 · 트랜잭션 · 멱등 원장 · 커밋 뒤 동기 응답으로 read-your-writes 보장 — ADR-26 · 사용자 결정 2026-09-27) |
| 불변 사실 기록 | 두 DB를 트랜잭션으로 묶지 않는다. 시계열은 불변 사실로 두고 해석 메타는 조회 시점에 붙인다. tag_id는 영구 보존 · 재사용 금지이고, 스케일 변경은 새 tag_id 발급이다 |
| 부동소수점 | 측정값은 Float64다. 원시 집계와 롤업 집계의 대조는 **오차 허용 비교**로만 한다 — 동등 비교는 병합 순서에 따라 거짓 불일치를 낸다 |
| 계측 우선 | 새 컴포넌트는 메트릭 노출과 함께 추가한다. 계측 없는 스위치는 장식이다 |
| 측정 기록 | 모든 수치에 **커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태**를 병기한다. 같은 실험 3회 실행의 중앙값을 쓰고 편차가 기준을 넘으면 폐기한다(기준 정본 [10_observability/04_experiment_protocol.md](./10_observability/04_experiment_protocol.md)) |
| 생성 데이터 구분 | 생성기가 만든 값은 품질 코드 SIMULATED(9)를 단다. 실데이터와 섞인 뒤에는 구분할 방법이 없다 |
| 로컬 전용 | 호스트 포트는 127.0.0.1에만 바인드한다. **외부에서 도달할 수 없다는 사실이 입력 검증이나 출처 방어를 생략할 이유는 되지 않는다** — 전 표면 무인증(D-16)이라 그 둘이 표면 앞의 전부다 |

## 문서 작성 규약

- 폴더 인덱스는 README.md, 세부 파일은 NN_snake_case.md 번호 접두다(05_data_stores/erd.md만 번호 없음).
- 전 문서 공통 골격 — H1 → blockquote 메타(대상 · 작성일 · 개정일 누적 · 원천) → 도입 단락 → H2 섹션 → 마지막 H2는 관련 문서.
- **인라인 백틱을 쓰지 않는다.** 펜스는 plain · json · mermaid · sql 4종만 쓴다.
- 문체는 한국어 "~한다" 평서체 현재형이다. 열거 구분자는 가운뎃점( · )이다. 절 참조는 §1.1 형식이다.
- 개수를 쓰면 그 자리에서 항목을 세어 검산식을 남긴다.
- 링크는 상대경로·실존 파일만 쓰고 라벨은 대상 경로 그대로다. 코드 경로는 평문이다. 외부 URL은 [03_requirements/16_official_references.md](./03_requirements/16_official_references.md)에만 둔다.
- 작성·수정·검수 절차의 정본은 [CLAUDE.md](./CLAUDE.md)다. 기계 검사는 scripts/docs_lint.py가 수행한다 — task docs:lint와 pre-commit 게이트(.githooks)가 부른다.

## 관련 문서

- 작성·검수 지침 → [CLAUDE.md](./CLAUDE.md)
- 학습 목표 정본 → [01_overview/01_purpose_learning_goals.md](./01_overview/01_purpose_learning_goals.md)
- 전역 규칙 정본 → [03_requirements/01_global_rules.md](./03_requirements/01_global_rules.md)
- ID 채번 상세 정본 → [11_glossary/04_id_conventions.md](./11_glossary/04_id_conventions.md)
