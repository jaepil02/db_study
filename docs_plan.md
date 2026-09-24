# docs/ 설계 문서군 구축 계획

> **상태**: W5 완료(2026-09-24) · W6 착수
> **완료된 것**: 실행 계획 확정(아래 "실행 계획 보정" 절) · docs/ 12폴더 재생성 · W0 14본(docs/README.md · docs/CLAUDE.md · 폴더 README 12본 골격판) · 린트 .omc/docs_lint.py 오류 0건 · W1 11본(11_glossary 5 · 01_overview 6) — 에러 코드 14 · D-01~D-12 · W2a 13본(02_features) — 기능 91 · SW 10 · 역할 3 · W2b 14본(03_requirements 01~14) — REQ 228 · AC 45 · 에러 코드 19 · W3 20본(04_architecture 9 · 05_data_stores 11) — ADR 25 · SW 11(D-13) · 키 패턴 18 · 봉인 26 · W4 12본(06_pipeline) — F-01~F-10 · 분기 기전 19행 · 한계 등재 17 · W5 18본(07_api 11 · 08_screen 7) — API 표면 43 · 화면 10 · 에러 22 · 린트 표 열 수 검사 추가
> **다음 작업**: W6 — 팀원 2명(w6-stack: 09_tech_stack 01~06 / w6-obs: 10_observability 01~07 · EXP-NN 채번). 웨이브 인계 표의 W6 행 전부 포함
> **팀원 누적**: 10 / 15 — w1-glossary · w1-overview · w2-features · w2-req-a · w2-req-b · w3-arch · w3-stores · w4-pipeline · w5-api · w5-screen(전원 종료)
> **참고**: 기존 루트 4본(architecture.md · data_flow.md · tech_stack.md · implementation_plan.md)은 **W7까지 삭제하지 않는다** — 이관 누락을 검증할 원본이 필요하다

## 실행 계획 보정 (2026-09-23 확정)

본문 계획을 집행하기 전에 닫은 불일치·누락이다. 본문과 어긋나면 이 절이 우선한다.

| # | 결함 | 처리 |
|---|---|---|
| 1 | docs/ 폴더 소실 — 빈 폴더는 git이 추적하지 않는다 | W0 첫 단계에서 재생성 |
| 2 | SW 목록 불일치 — implementation_plan §4.1의 COLLECTOR_DEADBAND 누락 | **SW-10 COLLECTOR_DEADBAND 유지 → 스위치 10종**(Redis 역할 9 + 수집 1). 검산: 백프레셔 1 + 캐시 4 + 팬아웃 2 + 멱등 1 + 대조군 1 + 수집 1 = **10**. 근거 — 데드밴드가 ClickHouse 행 수·압축률(신호 프로파일 × 코덱)과 Stream 유입량을 바꾸므로, 스위치에서 빼면 스위치 상태가 기록되지 않는 측정이 된다 |
| 3 | 측정 기록 경로 충돌 | **사용자 결정: docs/measurements/ 유지.** 번호 없는 예외 폴더 · 설계 정본 아님 · 골격 검사와 파일 수 122 집계에서 제외. 기록 템플릿 정본은 10_observability/04 |
| 4 | 흡수 매핑 누락 | implementation_plan §3 · §9 → 01_overview/05 · §6 → 04_architecture/02 + 09_tech_stack/05 · §1 · §10 → 메타 서술이라 흡수 불요 · data_flow §8.2 → 04_architecture/04 · 06_pipeline/04 |
| 5 | 보정 5건 행선지 | 7.1 → ADR + 06_pipeline/03 · 7.2 → 04_architecture/06 + 06_pipeline/11 · 7.3 → 06_pipeline/08 · 7.4 → 06_pipeline/07 · 7.5 → 05_data_stores/05 봉인 표 |
| 6 | 흐름 ID 표기 혼재 | **F-01~F-10으로 통일.** 구 표기 F1 = F-01 대응은 11_glossary/04에 둔다 |
| 7 | 웨이브 파일 합 134 ≠ 122 | 폴더 README 12본은 W0이 골격판, 소속 웨이브가 완성판. 신규 파일 기준 합 122 |
| 8 | docs_ref 파일 수 표기 | 실측 **123** |
| 9 | task docs:lint와 코드 금지 충돌 | 린트는 리드가 셸 스크립트로 돌리고, Taskfile 편입은 코드 착수 항목으로 01_overview/05에 등재 |
| 10 | 루트 README.md가 루트 4본을 링크 | W7 삭제 커밋에서 docs/README.md 링크로 교체 |
| 11 | /api/v1/ingest/bulk가 있는데 "ING은 표면 없음" | 부하 주입 표면이라 **GEN이 소유**(07_api/09_datagen). ING 표면 없음 유지 |
| 12 | /api/v1/health · /metrics의 소속 | **OBS 소유**(07_api/10_metrics) |
| 13 | 로그인 · 작업지시 화면 자리가 08_screen에 없다 | 08_screen/06_master_admin이 로그인 · 마스터 · 작업지시 관리 화면을 함께 소유 |
| 14 | 스위치는 환경변수 + DI 초기화 선택이라 런타임 토글이 안 되는데 08_screen/07은 "스위치 제어" | 07_experiment_console은 **스위치 상태 표시 · 실험 실행 기록 · 비교** 화면이다. 전환은 재기동 절차로 안내한다(W5) |
| 15 | 태그 변경 이력 테이블 — architecture §12가 요구하고 §6 ERD에 없다 | **tag_master_history 신설** → PostgreSQL 업무 테이블 13 + 1 = **14** · 대조군 1 별도 |
| 16 | tag_raw.ts가 DateTime64(3, 'Asia/Seoul')인데 "모든 시각 UTC 저장" | ClickHouse 컬럼 시간대는 표시·파싱 속성이고 저장값은 epoch다. 정본 11_glossary/05(W1). ingested_at · alarm_eval.ts 시간대 표기 통일은 W3 |
| 17 | observability 프로파일 구성원 불일치 — prometheus · grafana(tech §10) · alertmanager(arch §14) · tempo(tech §2) | W6(09_tech_stack/03 · 10_observability/03)이 판정 |
| 18 | k6 시나리오 "5종"과 tech_stack §8 표 6행 | 부하 시나리오 5 + 장애 주입 1(k6 아님)로 가른다(W6) |
| 19 | 원본의 sequenceDiagram 다수 | mermaid 3종 한정 규약에 따라 plain 펜스로 변환 |
| 20 | 알람 상태 머신 5상태(NORMAL · PENDING · ACTIVE · CLEARING · ACKED)와 alarm_event.state 값(ACTIVE · CLEARED) 대응 미정 | 11_glossary/03(W1)이 대응표를 소유 |
| 21 | 루트 4본 삭제 후 원천 인용이 끊긴다 | 원천 표기를 "원본 architecture.md §N(커밋 ff66a37)"으로 고정 — 삭제 후에도 git으로 추적된다 |
| 22 | 도메인 파일명 미정 | W0이 폴더 README 파일 목차로 확정. 린트 스크립트(.omc/docs_lint.py)의 예정 파일 목록이 같은 목록이다 |

## 웨이브 인계 (다음 웨이브 팀원 지시문에 반드시 포함)

W1 w1-glossary 판정 · 미확인 — 행선지 웨이브가 확정한다.

| 행선지 | 항목 |
|---|---|
| W2 02_features/03 · 05 | 모드 A에서 SIMULATED(9)를 붙이는 방법(레지스터에 품질 필드 없음) |
| W2 03_requirements/10 | CLEARING · CLEARED 이벤트의 ACK 허용 여부 |
| W2 03_requirements/14 | 롤업 대 원시 부동소수 비교 허용 오차 값 |
| W2 · W5 11_glossary/02 | 에러 코드 채번 보류 8건(CH 중단 시 시계열 응답 · Redis 중단 시 로그인·갱신·레이트 리밋 · 부적합 상태 ACK · 태그 스케일 변경 PATCH · 비활성 계정 로그인 · 비활성 태그 요청 · 헬스체크 실패 · 작업지시 상태 전이 위반). 채번은 11_glossary/02에서만 |
| W2 · W3 | condition_type · severity · work_order.status · role_code 값 미설계 |
| W3 05_data_stores/01 | site.timezone 용도 vs 표시 Asia/Seoul 고정 |
| W3 05_data_stores/04 | bad_cnt 조건식(판정: 2 · 4만 센다) · mv_tag_1d 정의 부재 · 일 경계 시간대 · tag_1m · alarm_eval 파티션 시간대 |
| W3 05_data_stores/05 | cache:tagmeta 단일 Hash(F1 · F3) vs 태그별 키(arch §8.2) |
| W3 04_architecture/06 | 백프레셔 하강 히스테리시스 |
| W4 06_pipeline/02 | FLOAT64 4워드 순서 표기 · 레지스터 비트 BOOL · 모드 A ts 채취 시점(요청 직전/응답 직후) · BAD_TIMEOUT "기록"의 자리(판정: 저장하지 않음) |
| W4 06_pipeline/08 | ACK 시 Redis alarm:state 갱신 주체 |
| W5 07_api/01 | API 응답 points의 시각 형식 |
| W6 09_tech_stack/03 | ClickHouse 서버 시간대 설정 |
| W2b 03_requirements | 에러 코드 후보(채택 시 11_glossary/02에 채번): alarms.ack_not_allowed/409 · master.scale_change_forbidden/409 · work_orders.invalid_status_transition/409 · timeseries.clickhouse_unavailable/503 · 비활성 계정은 auth.invalid_credentials 재사용 · health 부분 실패 표현(03/12) · 알람 규칙 변경의 감사 대상 여부(03/10) |
| W3 05_data_stores/05 | sess:{session_id} 소비 기능 없음 · lock:job:rollup 소비자 없음(롤업은 MV) · rl 키에 엔드포인트 자리 없음(arch §18 엔드포인트별 제한과 충돌 — 12_security/03 연계) |
| W3 05_data_stores/07 · 01 | dict_tag WHERE is_active로 비활성 태그 과거 행의 태그명 소실 · 알람 담당자 배정 컬럼 부재 |
| W3 04_architecture/02 · 06 | 포트 · 구현 이름 9개(SW-03 외 잠정) · SIM은 COL · GEN 모드 A와 동거 필수 · OBS APP_ROLE · SW-10 off일 때 경고 단계 데드밴드 강화의 의미 |
| W3 05/10 · W4 06/04 | SW-09 대조군 삽입 실패 의미론과 PostgreSQL 쪽 멱등 수단 |
| W4 06_pipeline | SW-01 off의 토큰 재료(06/03) · 모드 B 길이 검사와 모드 D 대조군 동일 행 절차(06/10) · Collector 실행 중 마스터 변경 반영(06/02) · FC01 · FC02 BOOL 응답 영역(SIM) · 비활성 태그 알람 규칙(06/08) · SIM 지연·오류 주입 제어 수단(W4 · W5) |
| W5 07_api | WebSocket 구독 방식(쿼리 파라미터 vs subscribe 메시지, 07_api/11) · 원본에 없는 표면 판정 |
| W3 04_architecture/05 | 알람 판정 구간 지연 예산 신설(미확인) |
| W3 05_data_stores/01 · 09 | S4~S6 무인증 기간 audit_log 행위자(user_id NULL vs 시드 계정) |
| W3 05_data_stores/05 | lock:rebuild 식별자 공간 충돌(쿼리 해시 vs 설비) · 작업지시 BFF 캐시 키 |
| W4 06_pipeline | rt:latest 덮어쓰기 순서 역전(06/05) · fan-in 배치 토큰 재료(06/03) · 스탬피드 대기 소진 후 원천 직접 조회(06/06) · 복원 창에 행 없는 신규 설비 응답 · tagmeta 미스 + PG 불가 시 최신값 응답(06/05) · CLEARING 중 ACK의 alarm:state 전이(06/08) · FC01 · FC02 시드 금지 해제 조건 |
| W5 07_api | 내보내기 스트림 중단 종료 표지(05) · 알람 목록 범위 기본값(07) · health 본문 필드 이름 · 저장소별 타임아웃(10) |
| W6 10_observability/01 | 컨슈머 랙 산출식 불일치(tech §9 vs arch §16) · 신규 메트릭 이름(레이트 리밋 통과 · 캐시 삭제 실패 · 품질 코드별 · Modbus 왕복 · SIM 기동 실패 포트 · 모드 B 중단 · ING 계층별 쓰기 · 대조군 실패 · 설계 거절 제외 오류율) · 메모리 샘플 수 · Pub/Sub 출력 버퍼 한도 |
| W4 06_pipeline | 판정을 flusher 흐름에서 기다리는가(06/08) · 복구 중 rt:latest 순서 역전(06/05) · fan-in 배치 행 수 상한 · flusher 메모리(06/03) · RATE_OF_CHANGE 경계 · 비활성 태그 규칙(06/08) · Collector 기동 시 PG 태그 목록 선조회(06/02) · 생산 카운터 기전(06/04 — 정책: 원시 표본은 ①, 파생만 ②, production_log 대체 금지) · 원시 삽입 성공 · MV 실패 뒤 같은 토큰 재시도 시 MV 재실행 여부(S0 실측) |
| W5 07_api | 실적 기록 시점의 작업지시 상태 조건(08) · unit만 바꾸는 태그 수정 허용 여부(04) |
| W6 10_observability · 09_tech_stack | 알림 "스트림 길이 MAXLEN 80%" → 적체 기준으로(10/03) · Stream 대기 측정 시작점 = 엔트리 ID 시각(10/02) · 판정 구간 · 6a~6c 예산 · 단계 게이지 · 데드밴드 생략분 메트릭 · 대조 실험 적재 시간 · 디스크 예산 · Q5 문턱 · pg_partman 미리 만들기 개수 · TTL 머지 주기 · ClickHouse 서버 timezone(09/03) · rl class 값 집합(12_security/03) |
| W5 07_api | 실행 중 주입 제어 표면 필요 여부(09) · 최신값 설비 전체 200(메타 비움) · 단일 태그 common.postgres_unavailable/503(06) |
| S5 실측 · 04_architecture/07 | 배치 행 트리거 R 선택(현행 50,000 — M+ 초당 2회 · L 초당 10회 · 초당 1회를 원하면 R 상향) — 2계층 조정값 |
| W6 | 주입 계획 파일 형식(09_tech_stack/05) · 창 닫힘 유예 · 대조군 COPY 타임아웃 · 최신값 락 실패 대기 · 스탬피드 대기 총량 < 재구성 p95 위반 가능(AC-25) · 스풀 재발행 속도 상한 · 분할 INSERT의 ingested_at 동일성 · W4 신설 메트릭 이름(10_observability/01) |
| W7 · 확장 | worker 다중화 시 알람 판정 분할(04_architecture/08) |
| W6 09_tech_stack | Compose healthcheck timeout > health 저장소 타임아웃(현행 1,000 ms)(09/03) · 환경변수 DATAGEN_BULK_ENABLED 등재(09/04) · alarm_eval 무효 구간 기록의 자리 · 확인(ACK) 신호 부재의 계측(10/01) |
| W6 10_observability/04 | docs/measurements 기록의 **기계 판독 블록 형식**(EXP-COMPARE 대조군 역전 지점 패널을 BFF가 읽는다) · staleTime · gcTime · 링 버퍼 창 · 트렌드 창 · 콘솔 폴링 주기 현행값(09_tech_stack/01) |
| W7 12_security | 레이트 리밋 등급 4(일반 · 대량 조회 · 내보내기 · 부하 주입) 이름 · 한도 — **부하 주입 등급 한도는 실험 부하 이상**(429가 stream_full보다 먼저 오면 측정 무효) · 로그인 시도 제한 · auth 표면 CORS 제외 판정 리뷰 · 내보내기 범위 상한 · DATAGEN_BULK_ENABLED(12/02) · WS 종료 코드 8종 리뷰(12/03) |
| W6 | 스위치 상태 레이블 이름 · 스위치별 EXP 번호 · 모드 C 인증 비용은 S7 이후만 측정 가능 |
| W2 02_features/12 | role_code 값 · 역할 수 · 알람 규칙 변경 권한 주체 · 실험 콘솔 접근 권한 · GEN · OBS 표면 인가 |
| W3 04_architecture/02 · 09 | SIM · OBS의 APP_ROLE 배정 · 보정 7.2 결정 시점(S3 전 잠정안 + 교체 가능한 포트 · S6 실측으로 최종) |
| W3 05_data_stores | 롤업 테이블 · MV 도메인 귀속(잠정 ING) · audit_log 소유(WRK) vs MST 트랜잭션 쓰기 — 한계 등재(05/02) |
| W4 06_pipeline/04 | ②계층 "생산 카운터"(스트림 유래)와 production_log(WRK CRUD)의 구분과 분기 기전 |

W5 처리(08_screen): 화면 10 확정 · 기능 → 화면 91 누락 0 · 인용 표면 42(bulk만 미인용) · GEN 화면 없음 · EXP-COMPARE 대조군 데이터는 BFF가 docs/measurements 읽기 · health에 커밋 · 프로파일 · 티어 노출.

W5 처리(07_api): API 표면 43(원본 21 + 신설 22) · 에러 22종(신설 3) · points 측정 시각 epoch ms · 업무 시각 UTC ISO · WS subscribe 메시지 구독 · 종료 코드 8종 · 생성기 · 주입 제어 표면 없음 · 사이트 · 라인 · 태그 목록 Redis 사본 없음 · 느린 구독자는 소켓 단위 4413 · 매핑 변경 PATCH 허용 · tag-reissues 전원 읽기 · 실적 정정 범위 밖(한계 등재).

W4 처리: F-01~F-10 채번(원본 §3~§12 대응 10/10) · 분기 기전 19행 = 정책 19행 · rt:latest 조건부 쓰기(ts 비교 스크립트) · fan-in 토큰 = 엔트리 ID 시각 창 정렬 배치 · flusher 최대 4배치 · 모드 A ts = 요청 블록 송신 직전 · BAD_TIMEOUT 메트릭만 · BOOL 레지스터 비트 미지원 · FC01 · FC02 시드 금지 유지 · 마스터 변경은 ch:cacheinv 구독으로 설비 단위 재로드 · ACK의 alarm:state 주체 = 판정기 · CLEARING 중 ACK Redis 전이 없음 · 비활성 태그 규칙 판정 제외 · 생산 카운터 파생 판정기 현 범위 밖 · SW-09 COPY는 flusher 안 CH 성공 뒤 · XACK 전 · DLQ 재처리 수동 · 원 토큰 직접 삽입 — W4 행은 닫혔다(MV 재실행 여부만 S0 실측 미확인).

W3 처리: ADR 25(선점 21 + 신설 22~25) · SW-11 신설(D-13) · 백프레셔 판정량 XLEN → 그룹 적체(ADR-21 — 원본 결함) · 히스테리시스(ADR-23) · SW-10 off 강화 무동작(ADR-24) · APP_ROLE 배정(ADR-22) · 포트 이름 확정(04/02 · SW-02 LatestValueReadPort) · enum 확정(condition_type 4 · severity 3 · work_order.status 4 · 전이 4쌍) · 롤업 귀속 ING · 키 패턴 18 · 봉인 26 · sess 예약 · rt:seq · lock:job:rollup 폐지 · dict_tag is_active 속성화 · 대조군 COPY 1회 · 재시도 없음 · 달력 경계 KST · ttl_only_drop_parts — W3 행은 닫혔다.

W2b 처리: 에러 코드 19종(신설 5) · 채번 보류 8건 전부 닫음 · ACK 허용 조건(ACTIVE · acked_at NULL) · 규칙 변경과 확인은 감사 대상 · health 부분 실패 503 + 본문 · 롤업 avg 허용 오차 상계식(p95만 미확인) · Redis 불가 시 로그인 거절 · 레이트 리밋 통과 · 스케일 PATCH 거절 · 비활성 태그 200 — W2 · W2b 행의 03_requirements 항목은 닫혔다.

W2 처리: 모드 A SIMULATED 판정(02_features/03 — 루프백 host 규칙) · 역할 3(OPERATOR · ENGINEER · ADMIN) · 알람 규칙 변경 ENGINEER · ACK OPERATOR · 실험 콘솔 인증 사용자 전원 표시 전용 · health · metrics 공개 · bulk 게이트 + 인증 — W2 행의 02_features 항목은 닫혔다.

W1 판정(정본 11_glossary): 알람 state 값은 ACTIVE · CLEARED 둘, ACK는 acked_by · acked_at · 해제는 §8.1의 CLEARING 디바운스를 따른다 · DROPOUT은 생성 모드에서 행 누락 · 데드밴드 컬럼은 공학 단위 절대값 · XAUTOCLAIM 회수는 30초 주기 타이머 · 에러 네임스페이스는 표면 소유 도메인을 따른다(datagen.stream_full/503) · API 표면 표기 "{문서} #N".

**병렬 분담**(tmux 네이티브 팀메이트 · 포그라운드 · 누적 14명): W0 리드 단독 · W1 2(glossary · overview) · W2a 1(features) · W2b 2(requirements 분할) · W3 2(architecture · data_stores) · W4 1(pipeline) · W5 2(api · screen) · W6 2(tech_stack · observability) · W7 2(security · 전수 검수). 공용 파일(루트 README · CLAUDE.md · 폴더 README · 03_requirements/15 · 16)은 리드 소유. 웨이브마다 린트 통과 후 커밋.

## Context

이 프로젝트의 학습 목표는 두 가지로 확정됐다.

1. **시계열을 RDB가 아니라 컬럼형으로 다루는 이유를 경험한다** — PostgreSQL 대신 ClickHouse를 쓰는 근거를 읽어서가 아니라 측정해서 안다.
2. **Redis 중간 계층에서 데이터 성격에 따라 목적지가 갈리는 것을 경험한다** — PLC 시계열은 ClickHouse로, 회원정보 등 업무 데이터는 PostgreSQL로.

현재 루트에는 설계 문서 4본(architecture.md · data_flow.md · tech_stack.md · implementation_plan.md, 3,500여 줄)이 있다. 내용 품질은 높지만 **평면 파일 4개**라 위 두 학습 목표가 문서 구조에 드러나지 않는다. 분기(routing)는 알람 흐름 한 절에 묻혀 있고, RDB 대조 실험은 아예 없다.

docs_ref(123파일 · 32,131줄의 HR SaaS 설계 문서군)를 분석해 그 **파일 구조 · 형식 · 품질 규율**을 이식한다. 주제는 완전히 다르므로 내용은 전부 새로 쓰고, 가져오는 것은 조직 원리와 서술 규율이다.

**사용자 확정 사항 3건**
- 기존 루트 4본은 docs/에 흡수하고 삭제한다.
- 분기는 **3계층 구조**로 설계한다(원시값 · 알람/실적 · 업무 CRUD).
- **PostgreSQL 대조군**을 도입한다(동형 시계열 테이블 + 동일 쿼리 비교).

---

## docs_ref에서 이식하는 것

내용이 아니라 규율이다. 분석으로 확인한 핵심 8가지.

| # | 원리 | 이 프로젝트 적용 |
|---|---|---|
| 1 | **폴더 = 하나의 질문 + 하나의 채번 정본** | 12폴더 각각이 ID 한 종류만 채번한다. 12_security는 리뷰 폴더라 아무것도 채번하지 않는다 |
| 2 | **고정 기준 표** — 모든 수치의 단일 정본을 루트 README에 모은다 | 도메인 11 · 기능 · REQ · 흐름 F 10 · 테이블 · Redis 키 계열 · 스위치 9 · 실험 EXP · 에러 코드 등 |
| 3 | **전역 불변식 표** — 전 도메인이 전제하는 규칙 | 시각 의미론 · at-least-once · 멱등 · 순서 무관성 · TTL 우선순위 · 백프레셔 명시화 · 부동소수점 |
| 4 | **정본 / 미러 / 파생 3값 상태** — 모든 폴더 README가 행마다 소유·인용을 선언 | 07_api/02_errors.md는 미러로 선언하고 채번 금지 |
| 5 | **추적성 3중** — 전역 매트릭스 + 고빈도 축 전용 매트릭스 + 문서별 지역 절 | 기능↔REQ↔흐름↔화면↔API↔테이블. 대응 없음을 뜻하는 **닫힌 어휘**를 둔다 |
| 6 | **번호는 식별자이지 순서가 아니다** — 말미 채번 · 재배치 금지 · 결번 영구 보존 | 횡단 문서용 번호 대역을 미리 예약한다 |
| 7 | **CLAUDE.md는 상태가 아니라 변경 규칙** — 각 규칙이 실제 드리프트 사고의 사후분석 | 열거의 정합 규칙을 그대로 승계하고 이 프로젝트 고유 항목을 더한다 |
| 8 | **근거는 반드시 구체적 실패로 끝난다** | "성능 때문에"가 아니라 "이 컬럼이 없으면 재현이 불가능하다" |

### 형식 사양 (123/123 파일에서 기계 검증된 것)

**공통 골격 — 예외 0건.** YAML frontmatter는 없다. H1 다음 빈 줄, 그다음 blockquote 메타 블록(내부에 빈 줄 없음), 빈 줄, 도입 단락 1~4개, H2들, 마지막 H2는 반드시 `## 관련 문서`.

```
# <H1 제목>

> **대상**: …
> **작성일**: YYYY-MM-DD
> **개정일**: YYYY-MM-DD — 사유          (0..N줄 · 최신이 위 · 누적 · 삭제하지 않는다)
> **원천**: 원천 경로 · 결정 ID · 정본 링크   (항상 블록의 마지막 줄)

도입 단락

## …
## 관련 문서
```

개정일 줄 내부 문법: `YYYY-MM-DD — {요약} — {상세}`. 수치 변화는 `A → **B**`(옛값 평문 · 새값 굵게). 개정일 줄은 이력이므로 사후에 고치지 않는다.

**표기**

| 항목 | 규칙 |
|---|---|
| 인라인 백틱 | **금지.** 식별자·경로·테이블명은 평문 또는 굵게 |
| 펜스 언어 | **plain · json · mermaid · sql 4종만.** ts · bash · yaml · text를 쓰지 않는다 |
| 열거 구분자 | 가운뎃점 `·` (U+00B7, 앞뒤 공백). 슬래시는 고유명 안의 이항 쌍에만 |
| 라벨 구분 | em dash `—` (U+2014) |
| 전이·변화 | `→` (U+2192) |
| 문장 안 대안 열거 | `①②③④` |
| 절 참조 | **`§1.1` 형식.** "3절"이라고 쓰지 않는다 |
| 링크 라벨 | **파일명 그대로.** 같은 폴더는 `./`, 다른 폴더는 `../` 접두 |
| 코드 경로 | 평문. 링크로 만들지 않는다 |
| 굵게 | ID · 수치 변화의 새 값 · **반직관적 사실** · 금지·경계 · 신설 항목에만 |
| 빈 줄 | 헤딩·표·펜스·목록 앞뒤 각 1줄. 메타 블록 내부는 0. 이중 빈 줄 금지 |
| 문체 | "~한다" 평서체 현재형. 금지어 — 권장한다 · 고려한다 · 하는 것이 좋다 · TBD |

**다이어그램 예산.** mermaid는 문서당 0~1개가 기본이고(erd.md와 상태 머신 사전만 예외), **스타일 지시자를 쓰지 않는다**(docs_ref 전 123파일에서 `style`·`fill:#` 0건). flowchart · erDiagram · stateDiagram-v2 3종 한정. 나머지 흐름·판정·파이프라인은 **plain 펜스 4형태**로 그린다 — ① `→` 체인 세로 정렬 ② `├── └──` 트리 + 후행 `←` 주석 ③ `①②③` 단계 + 공백 정렬 설명열 ④ `├─ │ └─` 판정 트리 + 우측 정렬 코드. 펜스 앞에 도입문 1줄, 뒤에 `- **…**` 해설 불릿 2~5개가 반드시 따른다.

**검산식.** 개수를 쓰면 그 자리에서 세고 `= **N**`으로 굵게 닫는다. 표기 위치는 세 가지 — 문단 끝 불릿 · 표 셀 안 · 독립 `### 검산` 절. 뺄셈은 유니코드 `−`를 쓴다.

**서술 밀도.** 밀도의 단위는 절이 아니라 **표 한 행 또는 불릿 하나**다. 한 행이 결정 · 근거 · 인접 반례 · 경계 · 잔여를 동시에 담는다. 반직관적 사실은 두 틀 중 하나로 쓴다 — **A형** 통념 명명 → 부정 → 진짜 축 → 대체 경로(독자가 버그로 신고할 동작에 쓴다), **B형** 결론 선언 → 반대 시나리오의 구체적 결과 → 파생 지침(독자가 실패로 오해할 안전장치에 쓴다).

**수치 3계층.** 근거 없는 구체 수치를 본문에 박지 않되 구체성은 잃지 않는다.
- **1계층 구조값**(버킷 수 · 축 개수 · 순서 · 스키마를 정의하는 임계) — 평문에 그대로 쓴다.
- **2계층 조정값**(TTL · 배치 크기 · 플러시 주기 · 보존일 · MAXLEN) — **조회 계약으로 쓴다**: 키 모양 · 기준 시점 · 금지된 대체 동작 · 부재 시 차단 코드. 현행 값을 참고로 적되 소유처를 명시한다.
- **3계층 미확인**(실측 전 성능 수치) — `미확인 — 확정 전 임의 값 고정 금지`로 등재한다. 생략하지 않는다.

**외부 URL**은 03_requirements/16_official_references.md에만 둔다.

### 이식하는 문서 패턴 3종

docs_ref에서 가장 값이 큰 발명이고, 이 프로젝트에 그대로 옮겨진다.

**① 한계 등재** — 05_data_stores/02가 소유한다. **어느 계층도 강제하지 않는 것**을 명시적으로 등재하는 표다. "아무도 책임지지 않는다"가 누락이 아니라 **기록된 상태**가 된다. 열은 `항목 · 강제 주체 · 막는 것과 못 막는 것 · 잔여가 어디에 담기는가`.

이 프로젝트의 행 예시 — Redis Stream의 엔트리 ID 순서와 ClickHouse 적재 순서의 일치는 **적재 워커 단독이고 DB 백스톱이 없다**. 컨슈머가 여럿이면 배분이 라운드로빈이라 배치 간 역전이 생기고, ClickHouse는 삽입 순서를 보존하지 않는다. **막는 것은 배치 안의 순서까지이고 배치 간 역전은 막지 못한다.** 시계열이 ts를 자체 보유하므로 무해하다는 것이 잔여를 받는 근거이며, 그 근거가 깨지는 순간(순서 의존 집계 도입) 이 행이 경보가 된다.

**② 봉인 표** — 05_data_stores/05가 Redis 키 계열에 적용한다. **정책의 부재 자체를 통제로 세는** 표다. TTL이 없는 것 · evict되지 않는 것 · 특정 명령을 노출하지 않는 것을 칸으로 세고 검산한다. "stream 계열에 TTL을 붙이지 않는다"가 규약 문장 하나로 떠 있는 것과, 봉인 칸으로 세어져 검산에 걸리는 것은 다르다.

**③ 버린 대안의 실패 시나리오** — 04_architecture/09(ADR)와 09_tech_stack/06이 소유한다. ADR은 **맥락 · 결정 · 버린 대안 · 파급** 4항목 고정이고, 대체된 결정은 원문을 보존한 채 **상태** 항목을 하나 더 갖는다. 상태 항목은 **대체된 결정에서 무엇이 살아남고 무엇이 죽었는지를 가른다** — 이것이 없으면 ADR 누적이 고고학이 된다.

근거 서술의 종결 규칙 하나를 함께 가져온다. **모든 근거는 구체적 실패로 끝난다.** "성능 때문에"가 아니라 "이 컬럼이 없으면 재현이 불가능하다"까지 쓴다.

---

## 도메인 벡터

NestJS 모듈과 1:1인 **11도메인**을 고정하고 모든 폴더가 이 벡터를 미러링한다.

| 접두 | 도메인 | 모듈 | 평면 |
|---|---|---|---|
| AUT | 인증·인가 | auth | 제어 |
| MST | 마스터 데이터 | master | 제어 |
| COL | 수집 | collector | 데이터 |
| SIM | 시뮬레이션 | plc-sim | 데이터 |
| GEN | 데이터 생성 | datagen | 데이터 |
| ING | 적재·분기 | ingest | 데이터 |
| TSQ | 시계열 조회 | timeseries | 제어 |
| RLT | 실시간 | realtime | 제어 |
| ALM | 알람 | alarms | 제어 |
| WRK | 업무 데이터 | work-orders | 제어 |
| OBS | 관측 | metrics | 관측 |

검산: 제어 6 + 데이터 4 + 관측 1 = **11**

**도메인이 특정 폴더에서 비는 것은 설계 진술이다.** COL · SIM · ING은 07_api에 표면이 없다(내부 모듈). SIM · GEN은 05_data_stores에 테이블이 없다. 비어 있음을 폴더 README가 명시한다.

## 채번 체계

| 종류 | 형식 | 예 | 채번 정본 |
|---|---|---|---|
| 기능 ID | {도메인}-NN | ING-03 | 02_features 도메인 파일 |
| 요구사항 | REQ-{접두}-NN (횡단 GLB · NFR · TEC) | REQ-GLB-01 | 03_requirements |
| 기술 결정 | ADR-NN | ADR-01 | 04_architecture/09 |
| 제품·학습 결정 | D-NN | D-01 | 01_overview/06 |
| 인수 기준 | AC-NN | AC-01 | 03_requirements/14 |
| **데이터 흐름** | **F-NN** | F1~F10 | **06_pipeline/01** |
| **실험** | **EXP-NN** | EXP-01 | **10_observability/06** |
| **역할 스위치** | **SW-NN** | SW-01 | **02_features/13** |
| 화면 코드 | {표면}-{의미} | DSH-REALTIME | 08_screen/README |
| 에러 코드 | {domain}.{snake_case} + HTTP | ingest.stream_full/503 | 11_glossary/02 |
| API 표면 | {문서}-#N (문서 지역) | 05_timeseries #3 | 각 07_api 도메인 파일 |

F-NN · EXP-NN · SW-NN 셋이 이 프로젝트 고유 축이다. docs_ref에 대응이 없고, 학습 목표가 이 셋을 1급 시민으로 요구한다.

---

## 폴더 구조 (12폴더 · 122파일)

각 폴더는 질문 하나와 채번 정본 하나를 소유한다. ★는 학습 목표 직결 문서다.

```
docs/
├─ README.md                    문서 지도 · 고정 기준 · 전역 불변식 · ID 규약 · 읽는 순서
├─ CLAUDE.md                    작성·검수 규약 · 열거의 정합 · 하지 말 것
│
├─ 01_overview/          [D-NN]         왜 만드는가 · 무엇을 배우려는가
│    01_purpose_learning_goals.md ★     학습 목표 2축의 정본
│    02_goals_scope.md                  In/Out 범위 · 비목표
│    03_personas_roles.md                운영자 · 관리자 · 엔지니어
│    04_domain_map.md                   11도메인 ↔ 모듈 ↔ 의존 그래프
│    05_priorities_roadmap.md            Phase 0~5 · 진입 조건 · 미확인 등재
│    06_design_decisions.md              D-NN 채번 정본
│
├─ 02_features/          [기능ID]       무슨 기능이 있는가
│    01~11 도메인 11본                   AUT · MST · COL · SIM · GEN · ING · TSQ · RLT · ALM · WRK · OBS
│    12_permission_matrix.md             횡단
│    13_switch_matrix.md ★               SW-NN 채번 정본 — 역할 스위치 10종(보정 #2)
│                                        (파일 번호 14 이상 쓰지 않는다)
│
├─ 03_requirements/      [REQ · AC]     어떤 계약으로 동작하는가
│    01_global_rules.md ★                REQ-GLB — 전역 불변식 상세
│    02~12 도메인 11본                    (01이 전역 규칙이라 +1 오프셋)
│    13_nonfunctional.md                 REQ-NFR(지연 예산·처리량) + REQ-TEC(로컬 실행·마이그레이션)
│    14_acceptance_criteria.md           AC-NN
│    15_traceability.md                  전수 매핑 · 미매핑 0 보장
│    16_official_references.md           외부 URL 유일 등재처
│                                        (파일 번호 17 이상 쓰지 않는다)
│
├─ 04_architecture/      [ADR-NN]       어떤 구조로 계약을 강제하는가
│    01_system_architecture.md           조감도 · 컨테이너 4 · 아키텍처 불변식 표
│    02_module_boundaries.md             Stream 경계 원칙 · APP_ROLE · worker_threads
│    03_execution_topology.md            Compose · healthcheck · 볼륨 · 메모리 프로파일 · cpuset
│    04_storage_split.md ★★              저장소 분리·분기 전략 정본 (학습 목표 2)
│    05_latency_budget.md                구간별 p95 · 측정 지점
│    06_backpressure_failure.md          백프레셔 5단계 · 장애 시나리오
│    07_capacity_planning.md             용량 티어 S/M/M+/L
│    08_scaling_roadmap.md               확장 4단계 · 실측 진입 조건
│    09_decision_records.md              ADR-NN 채번 정본
│
├─ 05_data_stores/       [테이블·키]     데이터가 어디에 어떤 모양으로 앉는가
│    01_postgresql_schema.md             업무 테이블 명세
│    02_postgresql_constraints.md        제약 · 인덱스 · 파티션 · 한계 등재
│    03_clickhouse_schema.md             tag_raw · alarm_eval · 코덱
│    04_clickhouse_rollup.md             MV 캐스케이드 · 백필 절차
│    05_redis_keyspace.md ★              키 계열 · TTL 정책 · 네이밍 · 실패 전략
│    06_redis_memory.md ★                메모리 산정 · volatile-lru · 축출 연쇄
│         (07~10은 횡단 예약 대역 — 타 폴더 인바운드 링크를 안정 번호에 고정)
│    07_cross_store_consistency.md       Dictionary · tag_id 불변 · 정합성
│    08_retention_lifecycle.md           TTL · 수명주기 · 파티션 DROP
│    09_migrations_seed.md               Prisma · CH DDL 순번 · 시드
│    10_olap_vs_rdb_control.md ★★        PostgreSQL 대조군 설계 정본 (학습 목표 1)
│    erd.md                              번호 없음 · 전역 ERD
│
├─ 06_pipeline/          [F-NN]         데이터가 어떻게 흐르고 갈라지는가
│    01_flow_inventory.md                F-NN 채번 정본 · F1~F10
│    02_collect.md                       F1
│    03_ingest_batch.md                  F2
│    04_routing.md ★★                    3계층 분기 정본 (학습 목표 2의 실행 자리)
│    05_realtime_read.md                 F3 · F7
│    06_timeseries_read.md               F4 · 캐시
│    07_business_crud.md                 F5
│    08_alarm.md                         F6
│    09_rollup.md                        F8
│    10_datagen_inject.md                F9
│    11_backpressure_failure.md          F10
│    12_data_contract.md                 단계별 스키마 · 계약 변경 규칙
│
├─ 07_api/               [표면 번호]     바깥에서 어떻게 부르는가
│    01_conventions.md                   버전 · 페이지네이션 · 멱등 · 시간/수치 직렬화 · 에러 봉투
│    02_errors.md                        미러 (채번 금지)
│    03~10 도메인 8본                     AUT · MST · TSQ · RLT · ALM · WRK · GEN · OBS
│    11_websocket.md                     횡단 — WS 프로토콜 · 구독 · 스로틀
│                                        (COL · SIM · ING은 표면 없음)
│
├─ 08_screen/            [화면 코드]     사람이 무엇을 보는가
│    01_standards.md                     명세 템플릿 · 상태 4행 · 차트 표준
│    02_traceability.md                  기능 → 화면
│    03_realtime_dashboard.md
│    04_trend_analysis.md
│    05_alarm_console.md
│    06_master_admin.md
│    07_experiment_console.md ★          스위치 제어 · 실험 실행 · 비교 대시보드
│
├─ 09_tech_stack/        [버전 문자열]   무엇을 어느 버전으로 쓰는가
│    01_frontend.md · 02_backend.md · 03_data_infra.md
│    04_local_environment.md             WSL2 · Docker · 프로파일 · cpuset
│    05_tooling_devops.md                pnpm · Biome · Taskfile · 스냅샷
│    06_decisions_rationale.md           선정 근거 · 버린 대안의 실패 시나리오
│
├─ 10_observability/     [EXP-NN]       무엇을 어떻게 재는가
│    01_metrics_catalog.md               메트릭 전수 · 이름 규약
│    02_instrumentation.md               계측 지점 · 수집 방식
│    03_dashboards_alerts.md             대시보드 · 알림 규칙
│    04_experiment_protocol.md ★         3회 중앙값 · 스냅샷/복원 · 기록 템플릿
│    05_load_scenarios.md                k6 5종
│    06_experiment_catalog.md ★★         EXP-NN 채번 정본 · 실험 전수
│    07_measurement_limits.md            로컬 측정 한계
│
├─ 11_glossary/          [에러·enum·ID] 이 낱말이 무슨 뜻인가
│    01_domain_terms.md                  PLC · Modbus · 시계열 용어
│    02_error_codes.md                   채번 정본
│    03_enums_state_machines.md          품질코드 7 · 신호 프로파일 8 · 알람 상태머신 · 백프레셔 5단계
│    04_id_conventions.md                ID 규약 정본
│    05_units_and_time.md ★              ts vs ingested_at · 단위 · 타임존
│
└─ 12_security/          [채번 없음]    위협 관점에서 다시 읽으면
     01_authn_authz.md · 02_secrets_config.md
     03_api_surface_defense.md           CORS · 레이트리밋 · WS Origin
     04_threat_model.md                  잔여 위험 등재
     05_local_exposure.md                127.0.0.1 바인드 · WSL2 mirrored의 함의
```

파일 수 검산: 7 + 14 + 17 + 10 + 12 + 13 + 12 + 8 + 7 + 8 + 6 + 6 = 120 · 루트 2 = **122**

---

## 학습 목표를 문서 구조로 구현하는 방법

### 목표 1 — 왜 RDB가 아니라 ClickHouse인가

정본은 **05_data_stores/10_olap_vs_rdb_control.md**다. 설계 내용:

- PostgreSQL에 tag_raw와 **동형 테이블** plc_tag_raw_control을 둔다(BRIN 인덱스 · 일자 파티션).
- 적재 분기 스위치 **SW-09 CONTROL_TABLE_ENABLED**로 같은 배치를 양쪽에 동시 삽입한다.
- 동일 집계 쿼리 5종을 양쪽에 돌린다 — 단일 태그 1시간 · 단일 태그 7일 · 설비 전체 1일 · 분 단위 롤업 재계산 · 전체 스캔 count.
- 비교 축 6가지: 저장 용량 · 압축률 · 삽입 처리량 · 쿼리 시간(행 수별) · VACUUM/WAL 증폭 · 인덱스 크기.
- **꺾이는 지점을 찾는 것이 목표다.** 100만 행에서는 PostgreSQL이 이길 수도 있다. 몇 행부터 역전되는지가 이 실험의 산출물이다.

측정 실행은 **10_observability/06_experiment_catalog.md**의 EXP-01~EXP-05 대역에 예약한다(채번은 W6). 설계(왜·무엇을)와 실행(어떻게·결과)을 갈라 두는 것은 docs_ref의 04_architecture ↔ 08_tech_stack 분업 원리와 같다.

### 목표 2 — Redis에서의 3계층 분기

정본 둘로 나눈다. **04_architecture/04_storage_split.md**가 정책(무엇이 어디로 왜), **06_pipeline/04_routing.md**가 기전(어느 모듈이 어떻게 가른다).

| 계층 | 원천 | 목적지 | 근거 |
|---|---|---|---|
| ① 태그 원시값 | stream:plc:raw | **ClickHouse 전용** | 추가 전용 · 갱신 없음 · 범위 집계 · 초당 수만 행 |
| ② 알람 판정 · 생산 카운터 | 같은 stream | **갈라진다** — 확정 이벤트는 PostgreSQL · 판정 전수는 ClickHouse · 핫 상태는 Redis Hash | 같은 원천인데 **상태 갱신이 필요한 것과 불변 기록이 서로 다른 저장소를 요구**한다 |
| ③ 회원 · 작업지시 · 감사 | API 직접 | **PostgreSQL 전용** (Redis는 캐시) | 트랜잭션 · 강한 정합성 · read-your-writes |

**②가 학습의 핵심이다.** 한 스트림에서 나온 같은 데이터가 성격에 따라 두 저장소로 갈리는 것을 한 자리에서 본다. 이것은 동기화나 dual-write가 아니라 **목적이 다른 세 개의 쓰기**이며, 그 구분을 문서가 명시적으로 방어한다(나중에 "CDC로 맞추자"는 제안이 나올 때의 근거가 된다).

③이 Redis Stream을 타지 않는 이유도 같은 문서가 적는다 — 비동기 at-least-once 경로에 업무 쓰기를 올리면 read-your-writes와 트랜잭션 보장이 깨진다. **분기는 "전부 큐를 태운다"가 아니라 "성격을 보고 경로를 고른다"이며, 경로를 고르지 않는 것도 분기의 결과다.**

### 두 목표를 관통하는 축 — 역할 스위치 SW-NN

**02_features/13_switch_matrix.md**가 채번 정본이다. Redis의 각 역할을 끄고 켜서 차이를 측정할 수 있게 하는 것이 "이해"의 전제다.

| ID | 스위치 | off 동작 | 측정 대상 |
|---|---|---|---|
| SW-01 | REDIS_STREAM_BUFFER | Collector가 Ingest 직접 호출 | 백프레셔 흡수력 |
| SW-02 | REDIS_LATEST_CACHE | ClickHouse argMax 점조회 | 점조회 비용 |
| SW-03 | REDIS_QUERY_CACHE | 매번 ClickHouse 집계 | 반복 조회 흡수 |
| SW-04 | CACHE_KEY_TIME_SNAP | now()를 그대로 키에 | 키 파편화 |
| SW-05 | CACHE_STAMPEDE_LOCK | 미스 시 전원 쿼리 | 스탬피드 |
| SW-06 | REDIS_PUBSUB_FANOUT | WS 게이트웨이 직접 호출 | 팬아웃 경계 비용 |
| SW-07 | WS_THROTTLE_MS | 0 (무제한) | 프레임 폭증 |
| SW-08 | INGEST_IDEMPOTENCY | dedup 토큰 미전달 | 재시도 중복 |
| SW-09 | CONTROL_TABLE_ENABLED | PostgreSQL 대조군 미적재 | 목표 1의 실행 스위치 |

검산: 백프레셔 1 + 캐시 4 + 팬아웃 2 + 멱등 1 + 대조군 1 = **9** → 보정 #2로 SW-10 COLLECTOR_DEADBAND 추가 = **10**

구현 제약은 04_architecture/02가 소유한다 — 스위치는 런타임 분기가 아니라 **DI로 주입되는 구현체**다. 조회 경로에 if를 흩뿌리면 분기 자체가 측정 대상 코드에 섞이고 스위치가 늘수록 경로가 조합 폭발한다.

---

## 기존 문서 흡수 매핑

루트 4본은 docs/로 재배치한 뒤 삭제한다. 흡수 누락을 막기 위해 절 단위로 대응을 잡는다.

| 원본 | 절 | 이관처 |
|---|---|---|
| tech_stack.md | 1 전제·목표 | 01_overview/01 · 02 |
| | 2 스택 요약 · 12 버전 고정 | 09_tech_stack/README · 01~03 |
| | 3 백엔드 결정 · 13 미채택 기술 | 09_tech_stack/06 · 04_architecture/09(ADR) |
| | 4 프론트엔드 | 09_tech_stack/01 |
| | 5.1 PostgreSQL · 5.2 ClickHouse | 09_tech_stack/03 · 05_data_stores/01 · 03 |
| | 5.3 Redis 3중 역할 | **05_data_stores/05 · 06** · 04_architecture/04 |
| | 6 산업 프로토콜 | 02_features/03(COL) · 11_glossary/01 |
| | 7 생성기 · 8 부하 도구 | 02_features/05(GEN) · 10_observability/05 |
| | 9 관측성 | 10_observability/01~03 |
| | 10 로컬 실행 환경 | 09_tech_stack/04 · 04_architecture/03 |
| | 10.6 측정 한계 | 10_observability/07 |
| | 11 개발 도구 | 09_tech_stack/05 |
| | 14 로드맵 | 01_overview/05 |
| architecture.md | 1 설계 원칙 | 03_requirements/01(REQ-GLB) |
| | 2·3 컨텍스트·실행 구성 | 04_architecture/01 · 03 |
| | 4 컴포넌트 책임 | 04_architecture/02 · 01_overview/04 |
| | 5 저장소 분리 전략 | **04_architecture/04** |
| | 6 PostgreSQL 스키마 | 05_data_stores/01 · 02 · erd |
| | 7 ClickHouse 스키마 | 05_data_stores/03 · 04 · 07 |
| | 8 Redis 키 설계 | **05_data_stores/05 · 06** |
| | 9 수집 파이프라인 | 06_pipeline/02 · 03 · 11 |
| | 10 캐시 전략 | 06_pipeline/06 · 05_data_stores/05 |
| | 11 API 설계 | 07_api/01 · 03~11 |
| | 12 정합성 | 05_data_stores/07 |
| | 13 리소스 배분 | 04_architecture/03 · 09_tech_stack/04 |
| | 14 관측성 | 10_observability/01~03 |
| | 15 용량 · 16 성능 목표 | 04_architecture/07 · 03_requirements/13 |
| | 17 장애 시나리오 | 04_architecture/06 · 06_pipeline/11 |
| | 18 보안 | 12_security 전체 |
| | 19 확장 로드맵 | 04_architecture/08 |
| data_flow.md | 1·2 흐름 목록·전체도 | **06_pipeline/01** |
| | 3~12 F1~F10 | **06_pipeline/02~11** |
| | 13 수명 주기 | 05_data_stores/08 |
| | 14 데이터 계약 | 06_pipeline/12 |
| | 15 지연 예산 | 04_architecture/05 |
| | 16 병목 예상 | 10_observability/07 |
| | 17 검증 체크리스트 | 03_requirements/14(AC) |
| implementation_plan.md | 2 환경 실측 | 09_tech_stack/04 |
| | 4 스위치 | **02_features/13** |
| | 5 단계 | 01_overview/05 |
| | 7 보정 5건 | 04_architecture/09(ADR) · 각 정본 |
| | 8 측정 기록 | 10_observability/04 |

**흡수는 복사가 아니다.** 기존 서술은 평면 문서용이라 docs_ref 골격(메타 블록 · H2 순서 · 표 컬럼 고정 · 검산식 · 인라인 백틱 금지)에 맞춰 다시 쓴다. 내용의 사실은 보존하고 형식과 밀도를 올린다.

삭제는 **전 파일 이관이 끝난 뒤 마지막 웨이브에서 한 번에** 한다. 중간에 지우면 이관 누락을 검증할 원본이 없어진다.

---

## 작성 순서 (웨이브)

어휘와 골격을 먼저 고정한다. 뒤집히면 전 문서를 고쳐야 하는 것부터 쓴다.

| 웨이브 | 산출 | 파일 | 이 웨이브가 고정하는 것 |
|---|---|---|---|
| **W0** | 골격 | README.md · CLAUDE.md · 폴더 README 12본 | **고정 기준 표 · 전역 불변식 · ID 규약 · 문서 지도 · 읽는 순서.** 이후 전 문서가 여기를 인용한다 |
| **W1** | 어휘·결정 | 11_glossary 6본 · 01_overview 7본 | 용어 · 에러 코드 · enum · 단위·시각 의미론 · D-NN · 도메인 지도 |
| **W2** | 계약 | 02_features 14본 · 03_requirements 17본 | 기능ID · REQ · AC · SW-NN 스위치 |
| **W3** | 구조·저장소 ★ | 04_architecture 10본 · 05_data_stores 12본 | ADR · 테이블 · Redis 키 · **분기 정책** · **대조군 설계** |
| **W4** | 흐름 ★ | 06_pipeline 13본 | F-NN · **분기 기전** · 백프레셔 |
| **W5** | 표면 | 07_api 12본 · 08_screen 8본 | API 표면 · 화면 코드 |
| **W6** | 측정 ★ | 09_tech_stack 7본 · 10_observability 8본 | 버전 고정 · 메트릭 · **EXP-NN 실험** |
| **W7** | 마감 | 12_security 6본 · 추적성 · 검산 · 루트 4본 삭제 | 미매핑 0 · 전 수치 검산 · 원본 제거 |

**W0이 승인 게이트다.** 고정 기준과 ID 규약이 확정되지 않은 채 본문을 쓰면 전 문서를 다시 고치게 된다. W0 완료 후 내용을 확인하고 나머지를 진행한다.

분량은 docs_ref 기준(본문 문서당 8,000~16,000 단어 · 표 20~30개 · 표 행 200~420)을 그대로 적용하면 과하다. 이 프로젝트는 기능·테이블·표면 수가 docs_ref의 1/4 수준이므로 **본문 문서당 표 8~15개 · 200~400줄**을 목표로 하고, 밀도(문단이 결정·근거·반례·경계를 동시에 담는 정도)는 docs_ref와 같게 유지한다.

---

## 검증

문서군이므로 테스트가 아니라 **정합성 검사**로 검증한다. W7에서 전수 수행하고, 각 웨이브 종료 시에도 해당 범위만 돌린다.

| 항목 | 방법 | 합격 |
|---|---|---|
| 링크 무결성 | 상대경로 링크를 전수 추출해 파일 존재 확인 | 깨진 링크 0 |
| 인라인 백틱 | 펜스 블록 밖의 백틱 검출 | 0건 |
| 골격 준수 | 줄1이 `^# ` · 줄2가 빈 줄 · 줄3이 `^> \*\*대상\*\*: ` · 줄4가 `^> \*\*작성일\*\*: ` · `> **원천**: ` 존재 · **마지막 `## ` 헤딩이 정확히 `## 관련 문서`** · H1 1개 | **전 파일 100%** (docs_ref가 123/123으로 달성한 기준) |
| 폴더 README 필수 절 | `## 파일 목차`(또는 폴더 목차) · `## 고정 기준` · `## 관련 문서` | 12폴더 전건 |
| 펜스 언어 | plain · json · mermaid · sql 외 검출 | 0건 |
| mermaid 스타일 | `style ` · `classDef` · `fill:#` · `stroke:#` 검출 | 0건 |
| 절 참조 표기 | `N절` 형태 검출 (`§N`을 써야 한다) | 0건 |
| 금지어 | 권장한다 · 고려한다 · 하는 것이 좋다 · TBD · FIXME 검출 | 0건 |
| 검산식 | 개수를 쓴 자리마다 검산식이 있는지 | 누락 0 |
| 고정 기준 정합 | README 고정 기준 표의 각 수치를 정본에서 다시 세어 대조 | 전건 일치 |
| 추적성 | 기능ID ↔ REQ ↔ F ↔ 화면 ↔ API ↔ 테이블 전수 매핑 | **미매핑 0 · 유령 0** |
| 채번 유일성 | ID별로 채번 정본 밖에서 신설된 것이 없는지 | 위반 0 |
| 이관 누락 | 흡수 매핑표의 전 절이 이관처에 실제로 존재하는지 | 누락 0 |
| 외부 URL | 16_official_references.md 밖의 맨 URL 검출 | 0건 |

링크·백틱·금지어·URL 검사는 grep 한 줄로 가능하므로 Taskfile에 `task docs:lint`로 넣는다. 추적성과 고정 기준은 사람이 읽어 대조한다.

---

## 하지 않는 것

- docs_ref의 **내용**을 가져오지 않는다. 급여·근태·세무 도메인은 이 프로젝트와 무관하다. 가져오는 것은 조직 원리와 서술 규율뿐이다.
- 폴더를 10개로 억지로 맞추지 않는다. 06_pipeline과 10_observability는 이 프로젝트 고유 축이고, 이 둘이 학습 목표를 담는다.
- 구현 코드를 쓰지 않는다. 이 계획의 산출물은 문서군이며, 코드 착수는 별건이다.
- 미확정 수치를 확정처럼 적지 않는다. 실측 전 성능 수치는 **미확인**으로 등재하고, 측정 후 EXP-NN 결과로 갱신한다.
