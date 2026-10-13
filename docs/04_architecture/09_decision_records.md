# 기술 결정 기록 (ADR)

> **대상**: db_study의 기술 결정 — ADR-01~33 · 결정 색인 · 분류 검산 · 상태 · 원본 보정 5건 대응 · D-NN과의 경계 — ADR-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **ADR-33 신설**(사용자 결정 2026-10-12 · D-16 부분 개정 — 직접 비교 ③ 무결성 → 데이터 정합성(두 저장소 1분 칸 행 수 · 값 체크섬 대조) · 마이그레이션 010 — 실행 환경 · 관측) · **ADR-32 수단 개정**(UMASH 빌드 · 시간 묶음 time_bucket · 버린 대안 ⑦) · ADR-28 · ADR-31 상태 항목(무결성 → 정합성) — ADR 32 → **33** · 현행 30 → **31** · 출처 D-16 개정 신설(2026-10-12) **1** · 분류 실행 환경 · 관측 3 → **4** · 후속 판정 10 → **11**행(ADR-33 — COPY 타임아웃 과대 계상)
> **개정일**: 2026-10-12 — **ADR-32 신설**(사용자 결정 2026-10-12 · D-05 부분 개정 — 직접 비교의 비교 사본을 TimescaleDB hypertable · 열 압축으로 · 마이그레이션 009 — 저장소) — ADR 31 → **32** · 현행 29 → **30** · 출처 D-05 개정 신설 **1** · 분류 저장소 9 → **10** · ADR-03 색인 제목에 "주 엔진 미채택" · ADR-03 · ADR-28 상태 항목에 부분 변경(2026-10-12) · 후속 판정 등재 9 → **10**행(ADR-32) · ADR-30 파급의 다음 순번 009 사용 · 결정 ①의 정확 판 · 이미지 이름은 09_tech_stack/03 링크로(스택 표기 규약) · ⑤에 크기 함수 근거 · convert_to_columnstore
> **개정일**: 2026-10-11 — **D-16 신설 ADR 넷**(사용자 결정 2026-10-11 · 같은 날 업무 방해 삭제 부분 개정 · 웨이브 6 코드 as-built) — **ADR-28**(SW-09 gated — 직접 비교 실행 동안만 같은 배치를 PostgreSQL에 · 비교 사본 정상형 PK · FK · CHECK — 저장소) · **ADR-29**(설비 가동은 실행 중 Redis 봉인 키 · 수집기 역할이 따른다 · 기동 때 지운다 — 모듈 경계 · 구조) · **ADR-30**(마이그레이션 새 기준선 PG 001~008 · CH 001~007 · 옛 볼륨은 비운다 — 저장소) · **ADR-31**(직접 비교에서 업무 방해 실험을 뺀다 — 실행 환경 · 관측) — ADR 27 → **31** · 현행 25 → **29** · 출처 D-16 신설 **4** · 분류 저장소 7 → **9** · 모듈 경계 8 → **9** · 실행 환경 2 → **3** · 상태 항목 갱신 3(ADR-08 gated 예외 · ADR-17 부분 대체 → ADR-28 · ADR-22 설비 가동 적용) — D-16 부분 변경 상태 10 → **11** · 전역 계약 표 25 · 26 행에 27(걸린 REQ-GLB 18 → **19**) · 11 · 12 행에 ADR-28 · 후속 판정 7 → **9** · D와 ADR 표 D-16 행(대응 6 → **7**)
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11) — **ADR-11 폐지**(색인 상태 현행 → 폐지 · 상태별 현행 26 → **25** + 폐지 1) · 상태 항목 신설 11(ADR-11 폐지 · 부분 변경 10 — ADR-02 로그인 근거 · 03 알람 예시 · 05 · 13 접두 · 06 경계 횡단 하나 · 07 ch:alarm · 17 대조 실험 · 22 APP_ROLE 4값 · 26 audit_log · EXP-46 · 27 전환 절차) — 원문 보존(ADR-11 파급의 삭제된 기전 링크만 평문) · 보정 7.3 행 · ADR과 전역 계약 표 03 · 04 경계 횡단 하나 · 11 · 12 · 13 → **11 · 12** · 25 · 26 출처 방어 행 신설(ADR-02) — 걸린 REQ-GLB 17 → **18** · 표 행 12 → **13** · 후속 판정 8 → **7**행 · D와 ADR 표 분기 문구
> **개정일**: 2026-10-05 — 웹 · api 호스트 포트 이동(같은 머신의 다른 프로젝트가 호스트 3000 · 3001을 점유 · 사용자 결정 2026-10-05) — 웹 3001 → **13001** · api 호스트 3000 → **13000**(컨테이너 3000 · 서비스명 그대로) · CORS 허용 오리진 http://localhost:3001 → **http://localhost:13001** — 오리진 수 · 바인드 규칙 불변
> **개정일**: 2026-09-28 — 리드 판정 — ADR-27 후속 판정 행에서 컨테이너 TZ 닫힘(UTC) — 등재 행 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC · 화면 KST(사용자 요구 2026-09-28) — **ADR-27 신설**(DB 처리 시간대 UTC · 저장 운영 경계 UTC · 달력 의미 경계만 KST 명시 · 기존 볼륨은 재구성 전환 — 저장소) — ADR 26 → **27** · 현행 25 → **26** · 저장소 6 → **7** · 전역 계약 표 REQ-GLB-02 행 신설(걸린 REQ-GLB 16 → **17** · 행 11 → **12**) · D 없이 선 ADR 15 → **16** · 후속 판정 7 → **8** · W3 · W6 시간대 판정(ADR 아님)은 각 정본의 상태 항목으로 대체 표기
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-M7 · B-M4 · B-M9) — ADR-26 파급에 **단일 소비자 강제 락 lock:biz:writer** 한 줄 · 원인 구분 **Redis 불가 = unavailable · PostgreSQL 불가 = failed** · 잔여에 한계 등재 **#26**(failed 적용 여부 미확정) — ADR 수 · 상태 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — **ADR-26 신설**(업무 쓰기는 명령 스트림 · 직렬 워커 · 멱등 원장 · 동기 응답 — 모듈 경계 · 구조) — ADR 25 → **26** · 모듈 경계 · 구조 7 → **8** · 전역 계약 표 11 · 12 · 13 행에 ADR-26 · D 경계 D-01 · D-04 행에 ADR-26 · 후속 판정 6 → **7**
> **개정일**: 2026-09-26 — W1 검수 반영 — ADR-03 파급의 26.8 경량 UPDATE에 Beta 표기 — 정본 05_data_stores/10을 가리킨다 · 결정 본문 · ADR 수 · 상태 불변
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — ADR-03 파급 첫 문장 "UPDATE가 비동기 mutation이라 상태 갱신이 필요한 데이터를 싣지 않는다" → **상태 갱신이 필요한 데이터를 싣지 않는 근거는 검증 대상(EXP-40 · 42 · 43)** — 26.8 경량 UPDATE 반영 · 결정 본문 · ADR 수 · 상태 불변
> **개정일**: 2026-09-24 — ClickHouse 26.8 LTS 전환(사용자 결정 · 25.x 보안 지원 종료) — ADR-14 상태 항목의 근거에 26.8 판별(기록 004) 추가 · 잔여 1 닫힘(먼저 성공한 MV가 있는 부분 실패도 보강 아래 정확) · 백필 재실행 문장을 버전 종속으로 교정
> **개정일**: 2026-09-24 — S0 실측 반영(EXP-32 · 기록 001 · 사용자 결정) — ADR-14에 상태 항목 신설(보강 — 롤업 3테이블 윈도우 + 종속 MV 중복 제거 설정 한 쌍) — 결정 원문 보존 · ADR 수 · 상태 분류 불변
> **개정일**: 2026-09-24 — 최종 정밀 검수 — ADR 파급 줄의 후속 판정 대상 표기 3곳을 판정 결과로 갱신(ADR-16 · 20 · 23 — 결정 본문 불변)
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — ADR-18 버린 대안 ② 문구 정정 — "인증 없는 DB 포트" → **비밀번호 한 겹만 남은 DB 포트**(세 저장소 모두 비밀번호 필수) — ADR 수 · 상태 불변(정본 12_security/02 · 05)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 후속 판정 등재 W6 결과 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W4 판정 반영 — ADR-09 파급 산술 보정 — M · M+ 모두 초당 1회 → **M 초당 1회 · M+ 초당 2회 · L 초당 10회**(현행 R 50,000) · M+ 배치 100,000행 → **50,000행** — ADR 수 · 상태 불변
> **원천**: 사용자 결정 2026-10-12(ADR-32 · D-05 부분 개정) · TimescaleDB 공식 문서(hypertable · columnstore · 보존 정책 · 크기 함수 — 2026-10-12 context7 대조 · 등재 [../03_requirements/16_official_references.md](../03_requirements/16_official_references.md)) · D-16(사용자 결정 2026-10-11 — ADR-28~31) · 사용자 요구 2026-09-28(ADR-27) · 원본 tech_stack.md §1 · §2 · §3 · §4.1 · §5 · §10 · §13(커밋 ff66a37) · 원본 architecture.md §1 · §3 · §4 · §6 · §7.1 · §7.4 · §8 · §9 · §12 · §14 · §17 · §19(커밋 ff66a37) · 원본 data_flow.md §4 · §7 · §8 · §9 · §12.1(커밋 ff66a37) · 원본 implementation_plan.md §2.3 · §4.3 · §7(커밋 ff66a37) · D-01~D-12([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) · [README.md](./README.md) ADR 선점표 · docs_plan 학습 목표 1 · 웨이브 인계 W3 행

이 문서가 **ADR 채번의 유일 정본**이다. 다른 문서는 번호로 인용만 하고 여기서 내린 결정을 다시 논증하지 않는다. 각 ADR은 **맥락 · 결정 · 버린 대안 · 파급** 네 항목으로 고정하고, 결정이 잠정이거나 대체되면 그 앞에 **상태** 항목을 하나 더 둔다. **버린 대안은 각각 구체적 실패로 끝난다** — "성능이 나쁘다"가 아니라 "무엇이 어떤 순간에 깨지는가"까지 쓴다.

채번 규칙은 셋이다.

- **ADR-01~21은 W3 착수 전 리드가 선점한 번호와 주제 그대로다**([README.md](./README.md) ADR 선점표). 제목은 다듬을 수 있지만 번호와 주제는 바꾸지 않는다. **ADR-22~25는 W3가 말미에 채번한 신설 결정이다.** ADR-26은 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27)이, ADR-27은 DB 시각 UTC 개정(사용자 요구 2026-09-28)이, ADR-28~31은 D-16(사용자 결정 2026-10-11)이, ADR-32는 D-05 부분 개정(사용자 결정 2026-10-12)이, ADR-33은 D-16 부분 개정(사용자 결정 2026-10-12 · 같은 날)이 말미에 채번했다.
- **대체된 결정은 원문을 보존한다.** 새 결정을 말미 번호로 채번하고 원 번호에 상태(대체됨 → ADR-NN)를 단다 — 무엇이 살아남고 무엇이 죽었는지를 상태 항목이 가른다. 결번을 만들지 않고 폐지 번호를 재사용하지 않는다.
- **번호는 등재 순서이고 배치는 번호순이다.** 주제 분류는 §분류가 한다.

**ADR 총수 33건**(ADR-01~33 · 결번 없음)이며 세는 자리는 §결정 색인 하나다. **D와 ADR의 경계** — 무엇을 배우고 어디까지 만들고 어떤 순서로 재는가는 D-NN([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)), 그것을 어떤 구조 · 설정으로 강제하는가는 ADR이다.

## 결정 색인

| ADR | 결정 | 분류 | 상태 | 출처 | 주 인용처 |
|------|------|------|------|------|------|
| **ADR-01** | 백엔드 NestJS 단일 런타임 — Python 데이터 평면 미채택 | 런타임 · 표면 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 09_tech_stack/06 |
| **ADR-02** | 프론트엔드 Next.js + Route Handler BFF — 고빈도는 api 직결 | 런타임 · 표면 | 현행 | 선점 | [01_system_architecture.md](./01_system_architecture.md) · 07_api/01 |
| **ADR-03** | 시계열 엔진 ClickHouse — TimescaleDB · InfluxDB 주 엔진 미채택(비교 사본의 TimescaleDB는 ADR-32) | 저장소 | 현행 | 선점 | [04_storage_split.md](./04_storage_split.md) · 05_data_stores/03 |
| **ADR-04** | 수집 버퍼 Redis Streams — Kafka · RabbitMQ 보류 | 적재 · 백프레셔 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-05** | Redis 단일 인스턴스 · volatile-lru — TTL 유무로 축출 대상 구분 | 저장소 | 현행 | 선점 | 05_data_stores/05 · 06 |
| **ADR-06** | 모듈 경계는 Redis Stream — 같은 프로세스여도 예외 없음 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) |
| **ADR-07** | 실시간 팬아웃은 Redis Pub/Sub 경계 유지 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 06_pipeline/05 |
| **ADR-08** | 역할 스위치는 DI 포트 · 구현 둘 — 런타임 분기 금지 | 모듈 경계 · 구조 | 현행 | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 02_features/13 |
| **ADR-09** | 배치 적재 읽기 · 삽입 분리 — 단일 flusher fan-in(보정 7.1) | 적재 · 백프레셔 | 현행 | 선점 | 06_pipeline/03 · [05_latency_budget.md](./05_latency_budget.md) |
| **ADR-10** | 최신값 갱신 주체 — 잠정 Ingest + 교체 가능한 포트 · 최종은 S6 실측(보정 7.2) | 모듈 경계 · 구조 | **잠정** | 선점 | [06_backpressure_failure.md](./06_backpressure_failure.md) · 06_pipeline/05 |
| **ADR-11** | 알람 판정은 배치 단위 상태 조회 · Ingest 직접 호출은 유일한 경계 예외(보정 7.3) | 모듈 경계 · 구조 | **폐지(D-16)** | 선점 | [02_module_boundaries.md](./02_module_boundaries.md) · 06_pipeline/08 |
| **ADR-12** | 캐시 무효화 체인 6단 — BFF · 브라우저 포함(보정 7.4) | 정합성 강제 | 현행 | 선점 | 06_pipeline/07 |
| **ADR-13** | TTL 강제는 린트가 아니라 키 계열별 래퍼(보정 7.5) | 정합성 강제 | 현행 | 선점 | 05_data_stores/05 |
| **ADR-14** | 적재 멱등은 insert_deduplication_token — ReplacingMergeTree 미채택 | 적재 · 백프레셔 | 현행 | 선점 | 05_data_stores/03 · 05_data_stores/04 · 06_pipeline/03 |
| **ADR-15** | tag_raw 롱 포맷 · 일자 파티션 · 정렬 키(device_id · tag_id · ts) | 저장소 | 현행 | 선점 | 05_data_stores/03 |
| **ADR-16** | 마스터 연동은 ClickHouse Dictionary(PostgreSQL 소스) — 두 DB를 트랜잭션으로 묶지 않는다 | 저장소 | 현행 | 선점 | 05_data_stores/07 |
| **ADR-17** | PostgreSQL 대조군 동형 테이블 · SW-09 동시 적재 | 저장소 | 현행 | 선점 | 05_data_stores/10 · 06_pipeline/04 |
| **ADR-18** | named volume · 호스트 포트 127.0.0.1 바인드 | 실행 환경 · 관측 | 현행 | 선점 | [03_execution_topology.md](./03_execution_topology.md) · 12_security/05 |
| **ADR-19** | PostgreSQL 커넥션은 api in-process 풀 — PgBouncer 유예 | 저장소 | 현행 | 선점 | 05_data_stores/02 · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-20** | 관측 스택은 선택 프로파일 — 스크레이프 창구는 /metrics 하나 | 실행 환경 · 관측 | 현행 | 선점 | 10_observability/01 · 09_tech_stack/03 |
| **ADR-21** | 백프레셔 1차 신호는 애플리케이션의 적체 검사 — MAXLEN을 maxmemory보다 먼저 건다 | 적재 · 백프레셔 | 현행 | 선점 | [06_backpressure_failure.md](./06_backpressure_failure.md) · 05_data_stores/06 |
| **ADR-22** | APP_ROLE 역할 배정 — SIM · GEN 모드 A는 collector와 동거 · OBS는 전 역할 · 분리는 실측 뒤 | 모듈 경계 · 구조 | 현행 | **W3 신설** | [02_module_boundaries.md](./02_module_boundaries.md) · [08_scaling_roadmap.md](./08_scaling_roadmap.md) |
| **ADR-23** | 백프레셔 하강 히스테리시스 — 상승 즉시 · 하강 지연 · 위험은 주의 임계까지 스풀 유지 | 적재 · 백프레셔 | 현행 | **W3 신설** | [06_backpressure_failure.md](./06_backpressure_failure.md) · 11_glossary/03 |
| **ADR-24** | SW-10 off면 경고 단계 데드밴드 강화는 무동작 — 스위치가 백프레셔 반응보다 우선 | 적재 · 백프레셔 | 현행 | **W3 신설** | [06_backpressure_failure.md](./06_backpressure_failure.md) · 02_features/03 |
| **ADR-25** | CPU 바운드 작업은 piscina worker_threads로 격리 | 모듈 경계 · 구조 | 현행 | **W3 신설** | [02_module_boundaries.md](./02_module_boundaries.md) · [05_latency_budget.md](./05_latency_budget.md) |
| **ADR-26** | 업무 쓰기는 명령 스트림 · 직렬 워커 · 멱등 원장 · 동기 응답 — SW-12 direct로 옛 경로 비교 | 모듈 경계 · 구조 | 현행 | **개정 신설**(사용자 결정 2026-09-27) | 06_pipeline/07 · [04_storage_split.md](./04_storage_split.md) · [02_module_boundaries.md](./02_module_boundaries.md) |
| **ADR-27** | DB 처리 시간대 UTC · 저장 운영 경계 UTC · 달력 의미 경계만 KST 명시 · 화면은 KST 한 번 변환 | 저장소 | 현행 | **개정 신설**(사용자 요구 2026-09-28) | 11_glossary/05 · 05_data_stores/03 · 05_data_stores/09 |
| **ADR-28** | SW-09 gated — 직접 비교 실행 동안만 같은 배치를 PostgreSQL에 싣는다 · 비교 사본은 PK · FK · CHECK 정상형 | 저장소 | 현행 | **D-16 신설**(사용자 결정 2026-10-11) | 06_pipeline/04 · 05_data_stores/10 · 02_features/13 |
| **ADR-29** | 설비 가동은 실행 중 Redis 봉인 키 — 수집기 역할이 1초마다 따르고 기동 때 지운다 | 모듈 경계 · 구조 | 현행 | **D-16 신설**(사용자 결정 2026-10-11) | 05_data_stores/05 · 06_pipeline/05 · [02_module_boundaries.md](./02_module_boundaries.md) |
| **ADR-30** | 마이그레이션 새 기준선 — PostgreSQL 001~008 · ClickHouse 001~007 · 옛 볼륨은 비운다 | 저장소 | 현행 | **D-16 신설**(사용자 결정 2026-10-11) | 05_data_stores/09 |
| **ADR-31** | 직접 비교에서 업무 방해 실험을 뺀다 — 실측이 흔들려 판정할 수 없다 | 실행 환경 · 관측 | 현행 | **D-16 신설**(사용자 결정 2026-10-11 · 같은 날 부분 개정) | 07_api/09 · 06_pipeline/10 |
| **ADR-32** | 직접 비교의 비교 사본은 TimescaleDB hypertable · 열 압축 — 넣기 검증 단계에서 압축한 뒤 재고 묻는다 | 저장소 | 현행 | **D-05 개정 신설**(사용자 결정 2026-10-12) | 05_data_stores/10 · 05_data_stores/09 · 09_tech_stack/03 |
| **ADR-33** | 직접 비교 ③은 데이터 정합성 — 두 저장소를 1분 칸마다 행 수 · 값 체크섬으로 대조한다(규칙 시험을 뺀다) | 실행 환경 · 관측 | 현행 | **D-16 개정 신설**(사용자 결정 2026-10-12) | 07_api/09 · 06_pipeline/10 · 08_screen/10 |

### 검산

- 출처별: 선점 21(ADR-01~21) + W3 신설 4(ADR-22~25) + 개정 신설 2(ADR-26 · 27) + D-16 신설 4(ADR-28~31) + D-05 개정 신설 1(ADR-32) + D-16 개정 신설 1(ADR-33) = **33**
- 상태별: 현행 31 + 잠정 1(ADR-10) + 폐지 1(ADR-11 — D-16) + 대체됨 0 = **33** · 현행 중 2026-10-12 부분 변경 3(ADR-03 · 28 — ADR-32가 비교 사본의 엔진 모양을 바꿨다 · ADR-31 — ADR-33이 ③을 바꿨다 · 세 ADR의 결정은 그대로) · 현행 중 D-16 부분 변경 상태 11(ADR-02 · 03 · 05 · 06 · 07 · 08 · 13 · 17 · 22 · 26 · 27 — ADR-17은 ADR-28이 일부를 대체했다) · ADR-27이 대체한 W3 · W6 시간대 판정은 ADR이 아니라 문서 판정이라 이 셈에 들지 않는다(각 정본의 상태 항목)
- 선점표 대비 제목 조정 1건 — ADR-21의 "XLEN 검사"를 "적체 검사"로 다듬었다. 주제(1차 신호는 애플리케이션 검사 · MAXLEN을 maxmemory보다 먼저)는 그대로이며, 판정량이 원시 XLEN이 아니라는 결정이 제목에 실린다. 나머지 20건은 선점 주제 그대로다.

## 분류

| 분류 | ADR | 수 | 이 분류가 강제하는 것 |
|------|------|------|------|
| 런타임 · 표면 | 01 · 02 | 2 | 무엇으로 실행하고 사용자가 어디로 들어오는가 |
| 저장소 | 03 · 05 · 15 · 16 · 17 · 19 · 27 · 28 · 30 · 32 | 10 | 어느 엔진 · 어떤 모양 · 어떤 설정으로 담는가 |
| 적재 · 백프레셔 | 04 · 09 · 14 · 21 · 23 · 24 | 6 | 수집에서 저장까지 무엇이 넘치지 않고 겹치지 않게 하는가 |
| 모듈 경계 · 구조 | 06 · 07 · 08 · 10 · 11 · 22 · 25 · 26 · 29 | 9 | 한 프로세스 안 모듈이 무엇으로 이어지고 어떻게 떼어지는가 |
| 정합성 강제 | 12 · 13 | 2 | 규칙이 코드 구조로 지켜지게 하는 수단 |
| 실행 환경 · 관측 | 18 · 20 · 31 · 33 | 4 | 로컬 한 대에서의 배치와 계측 창구 |

- 검산: 2 + 10 + 6 + 9 + 2 + 4 = **33** — 분류가 둘인 ADR 0

## 원본 보정 5건 대응

원본 implementation_plan.md §7의 보정 5건은 전부 ADR로 결정을 고정하고 각 정본에 반영한다(docs_plan 실행 계획 보정 #5).

| 보정 | 원본 문제 | ADR | 결정 요지 | 반영 정본 |
|------|------|------|------|------|
| 7.1 | 컨슈머 다중화와 배치 크기가 서로를 무효화 | ADR-09 | 단일 flusher fan-in · B · C는 S3 비교 | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) |
| 7.2 | ClickHouse 중단 시 최신값 정지 | ADR-10 | 잠정 A + 교체 포트(SW-11) · S6 실측 | [06_backpressure_failure.md](./06_backpressure_failure.md) · [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) |
| 7.3 | 알람 행당 상태 조회 · 근거 없는 경계 예외 | ADR-11(폐지 — D-16) | 배치당 조회 · 예외 근거 명시 — 대상(알람)이 D-16으로 사라졌다 | [02_module_boundaries.md](./02_module_boundaries.md) §경계 예외 |
| 7.4 | 무효화 체인에서 BFF · 브라우저 누락 | ADR-12 | 6단 체인 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 7.5 | TTL 린트 강제의 실행 수단 부재 | ADR-13 | 키 계열별 래퍼 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |

- 검산: 보정 = **5** · 대응 ADR 5 · 대응 없는 보정 0

## ADR-01 — 백엔드 NestJS 단일 런타임

- **맥락**: 백엔드는 성격이 다른 두 덩어리다 — 제어 평면(REST · WebSocket · 인증 · CRUD)은 타입 공유와 IO 동시성을, 데이터 평면(Modbus 폴링 · 배치 적재 · 데이터 생성)은 Modbus 라이브러리 성숙도 · 수치 벡터화 · 배열 직렬화를 요구한다. 로컬 Docker 메모리 예산은 8~12 GB이고 그 안에서 ClickHouse에 최대한을 주는 것이 목적이다(원본 tech_stack.md §3).
- **결정**: 백엔드 전체를 **NestJS 단일 애플리케이션**으로 두고 데이터 평면을 모듈로 흡수한다. 2축 구분은 런타임이 아니라 **모듈 경계**(Redis Stream)로 남는다. 프론트엔드 · API DTO · Stream 페이로드 스키마를 공유 패키지의 스키마 하나로 정의한다. 감수 비용(단일 스레드 CPU 한계 · Modbus 서버 시뮬레이터 직접 구현 · numpy 부재 · Arrow 직삽입 부재)은 워커 격리(ADR-25) · TypedArray · 배치 크기로 완화한다.
- **버린 대안**: ① **Python 데이터 평면 분리**(pymodbus · numpy · clickhouse-connect) — 런타임 컨테이너가 하나 늘어 그 몫만큼 ClickHouse 메모리가 줄고, 페이로드 계약이 두 언어에 두 벌 정의되어 한쪽 필드가 바뀔 때 다른 쪽 디코더가 적체 엔트리를 DLQ로 쏟는다. ② **데이터 평면을 처음부터 별도 컨테이너로** — 이벤트 루프 지연이 실측되기 전에 나눠 역할 분리의 효과를 잴 기준선이 사라진다. ③ **모듈 간 gRPC** — 한 프로세스 안에 직렬화 계층이 생겨 측정 대상 아닌 비용이 E2E에 섞인다.
- **파급**: 되돌리는 조건은 셋으로 닫혀 있다(생성기 3배 미달 · 시뮬레이터 기능 부족 · Arrow 직삽입 필요) — [08_scaling_roadmap.md](./08_scaling_roadmap.md) §로드맵 밖 조건부 분리 · 근거 [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md). 모듈 결합은 데이터 계약으로만 한다(REQ-GLB-21). 어느 경우에도 제어 평면은 NestJS에 남는다.

## ADR-02 — 프론트엔드 Next.js + Route Handler BFF · 고빈도는 api 직결

- **상태**: 현행 — **D-16 부분 변경(사용자 결정 2026-10-11)**. 로그인이 지워져 맥락의 첫 근거(리프레시 토큰 httpOnly 쿠키)와 결정의 로그인 · 토큰 갱신 경로 · Bearer 액세스 토큰이 사라졌다. **살아남는 것** — Next.js 호스트 프로세스 · 저빈도 BFF 경유와 고빈도 직결의 배정 · CORS 허용 오리진 하나 · WebSocket Origin 검증(Host 대조와 함께 REQ-GLB-25 · 26). 버린 대안 ①의 실패(쿠키 교환 주체 부재)는 근거를 잃었고 ②~④는 그대로다. 원문은 보존한다.
- **맥락**: 리프레시 토큰을 httpOnly 쿠키로 브라우저 JS에서 숨겨야 하고, 동시에 최신값 폴링 · 시계열 조회 · WebSocket은 초당 수 회 이상 호출된다(원본 tech_stack.md §4.1 · 원본 data_flow.md §7.2).
- **결정**: Next.js를 **호스트 프로세스**로 띄우고 Route Handler를 BFF로 쓴다 — 로그인 · 토큰 갱신 · 저빈도 업무 조회는 BFF 경유, **고빈도 실시간 데이터는 브라우저가 api에 직결**한다. 직결 경로는 CORS 허용 오리진 하나 · Bearer 액세스 토큰 · WebSocket Origin 검증으로 보호한다.
- **버린 대안**: ① **React + Vite SPA** — 서버 측 코드가 없어 리프레시 토큰을 받을 자리가 브라우저뿐이고, httpOnly 쿠키를 액세스 토큰으로 교환할 주체가 사라진다. ② **전 요청 BFF 경유** — 고빈도 요청마다 1홉과 Next.js 서버 이벤트 루프 하나를 더 다퉈 최신값 p95가 api가 아니라 BFF에 묶인다. ③ **WebSocket BFF 중계** — 장기 연결 수만큼 BFF에 소켓이 쌓여 개발 서버 재시작이 모든 실시간 연결을 끊는다. ④ **웹 컨테이너화** — HMR이 느리고 불안정해 개발 루프가 멈춘다.
- **파급**: 요청 종류별 BFF · 직결 배정의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md). BFF 서버 fetch 캐시가 무효화 체인에 들어간다(ADR-12). localhost:13001과 13000은 포트가 달라 CORS가 필요하지만 same-site라 SameSite=Lax가 동작한다 — [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md).

## ADR-03 — 시계열 엔진 ClickHouse

- **상태**: 현행 — **부분 변경(ADR-32 · 2026-10-12)**. 결정(시계열 엔진 ClickHouse)은 그대로다. 버린 대안 ① TimescaleDB는 **주 시계열 엔진 자리에서는 그대로 버린다** — 센서는 ClickHouse에만 산다. 다만 직접 비교의 PostgreSQL 쪽 비교 사본에는 TimescaleDB를 쓴다(D-05 부분 개정 · ADR-32) — 대안 ①의 실패 진술(대조가 "PostgreSQL 대 PostgreSQL 확장"이 된다)이 그 비교의 정의가 된다. 원문은 보존한다.
- **상태**: 현행 — **D-16 부분 변경**. 결정(시계열 엔진 ClickHouse)은 그대로다. 파급이 예로 든 상태 갱신 데이터(알람 확정 이벤트)는 알람과 함께 사라졌고, 그 근거의 실측(원자성 · 제약 · 갱신 단위)은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과에 남는다. 원문은 보존한다.
- **맥락**: PLC 태그 데이터는 초당 수천~수십만 포인트 · 추가 전용 · 시간 범위 집계다. 학습 목표 ①은 "시계열을 RDB가 아니라 컬럼형으로 다루는 이유를 측정으로 안다"다(D-01).
- **결정**: 시계열을 **ClickHouse**에 싣는다 — MergeTree · 코덱 · AggregatingMergeTree + MV 롤업 캐스케이드 · Dictionary를 쓴다. 앱은 HTTP 8123만 쓴다. 비교 상대는 PostgreSQL 대조군이다(ADR-17).
- **버린 대안**: ① **TimescaleDB** — PostgreSQL 확장이라 대조가 "PostgreSQL 대 PostgreSQL 확장"이 되어 행 기반 RDB가 어디서 꺾이는지라는 질문(D-05)이 사라지고, 이종 DB 분리 운용을 배울 자리가 없다. ② **InfluxDB** — SQL 전이성이 낮아 대조군과 **같은 쿼리 5종**을 두 저장소에 돌릴 수 없고, 쿼리 언어 차이가 역전 지점에 섞인다. ③ **PostgreSQL 단독** — 그것이 대조군 자체다. 원본 예상치(삽입 · 압축)로 이미 역전이 예상되는 쪽을 주 저장소로 두면 목표 ②의 파이프라인이 목표 ①의 실험 대상에 묶인다.
- **파급**: 상태 갱신이 필요한 데이터를 싣지 않는다 — 알람 확정 이벤트가 PostgreSQL로 간다([04_storage_split.md](./04_storage_split.md)). 그 근거로 적었던 "UPDATE가 비동기 mutation"은 **검증 대상(EXP-40)**이다 — 26.8 경량 UPDATE는 SELECT에 즉시 보이므로(공식 문서상 **Beta** — 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §역방향 대조 — 업무 워크로드) 근거가 가시성이 아니라 갱신 비용 · 원자성 · 제약(EXP-40 · 42 · 43)으로 옮겨질 수 있고, 결과로 확정한다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §역방향 대조 — 업무 워크로드). 스키마 · 코덱 · 설정의 정본은 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md).

## ADR-04 — 수집 버퍼 Redis Streams

- **맥락**: 수집 속도와 적재 속도를 떼는 버퍼가 필요하고, 재시도 · 회수 · 컨슈머 다중화가 있어야 한다. Redis는 이미 캐시 · 팬아웃 역할로 들어와 있다(원본 tech_stack.md §5.3).
- **결정**: **Redis Streams + 컨슈머 그룹**을 수집 버퍼로 쓴다. 엔트리는 포인트가 아니라 **스캔 사이클 단위**(설비 × 사이클 1엔트리 · MessagePack 컬럼 배열)다. 적재 소스는 포트(PointSourcePort)로 추상화해 전환 경로를 열어 둔다.
- **버린 대안**: ① **Kafka** — 브로커 컨테이너(+ 메타데이터 관리)가 로컬 메모리 예산을 먹어 측정 대상인 ClickHouse 몫이 남지 않는다. ② **RabbitMQ** — 소비 후 삭제라 트림 범위 안의 재처리 창이 없고, 버퍼 · 캐시 · 팬아웃이 두 미들웨어로 갈라져 "Redis 중간 계층"이라는 학습 대상이 흐려진다. ③ **프로세스 안 큐** — 재시작 시 미처리분이 전부 사라진다 — 그것이 SW-01 off의 실험 경로이며 정상 경로가 아니다. ④ **포인트 단위 엔트리** — 엔트리마다 필드 이름을 반복 저장해 원본 산정 약 9배의 메모리를 먹고 10만 pps에서 수 분 만에 고갈된다.
- **파급**: 재처리는 트림 범위 안에서만 된다 — 확인된 엔트리가 MAXLEN까지 남는 이유이며, 그래서 백프레셔 판정량이 XLEN이 아니다(ADR-21). Kafka 전환은 확장 4단계다([08_scaling_roadmap.md](./08_scaling_roadmap.md)).

## ADR-05 — Redis 단일 인스턴스 · volatile-lru

- **상태**: 현행 — **D-16 부분 변경**. 봉인 계열 alarm과 캐시 계열 rl · sess · auth 접두가 지워져 봉인 계열은 stream · rt, 캐시 계열은 cache · lock · biz다(정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). 단일 인스턴스 · volatile-lru · "접두 하나가 생존 정책의 경계"는 그대로다. 원문은 보존한다.
- **맥락**: Redis가 성격이 반대인 두 데이터를 담는다 — 사라지면 복구가 불가능한 것(Stream · 최신값 · 알람 상태)과 사라져도 원천으로 우회되는 것(캐시 · 세션 · 락 · 레이트 리밋). 메모리 예산은 한정돼 있다(원본 architecture.md §8).
- **결정**: **단일 인스턴스 · maxmemory-policy volatile-lru · AOF on**. TTL이 없는 키는 축출 후보가 아니고 TTL이 있는 키만 LRU로 밀려난다 — **키 접두 하나가 생존 정책의 경계**다(봉인 계열 stream · rt · alarm은 TTL 금지 · 캐시 계열 cache · lock · rl · sess · auth는 TTL 필수). 캐시가 다 밀려나도 부족하면 쓰기가 OOM으로 실패하고 그것이 위험 단계로 간다.
- **버린 대안**: ① **두 인스턴스(stream noeviction · cache allkeys-lru)** — 컨테이너가 늘어 메모리 예산을 잠식하고, **스트림이 캐시를 밀어내는 축출 연쇄를 한 인스턴스 안에서 볼 기회가 사라진다** — 그것이 학습 정점이다. ② **allkeys-lru** — TTL 없는 Stream 엔트리 · 알람 상태가 조용히 축출된다. ③ **noeviction** — 캐시 키가 maxmemory를 채우면 XADD가 OOM으로 실패해 **캐시 팽창이 곧 수집 스풀로 번진다** — 캐시 때문에 수집이 멈춘다.
- **파급**: 인스턴스가 강제하던 구분을 코드가 지킨다 — 키 계열별 래퍼(ADR-13) · 실패 전략 이원화(REQ-GLB-09). 분리는 확장 3단계이며 진입 조건은 캐시 히트율과 Stream 점유 메모리의 역상관이다([08_scaling_roadmap.md](./08_scaling_roadmap.md)). 키 · 메모리의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md).

## ADR-06 — 모듈 경계는 Redis Stream

- **상태**: 현행 — **D-16 부분 변경**. 경계를 건너는 경로 둘 중 알람 판정 직접 호출(ADR-11)이 알람과 함께 사라져 **SW-01 off 하나**만 남는다(REQ-GLB-04). 원문은 보존한다.
- **맥락**: 런타임이 하나로 합쳐지면서 Collector가 Ingest를 직접 부르면 코드 한 줄로 끝나게 됐다. "언어 간 결합도 0"이라는 옛 명분은 사라졌다(원본 architecture.md §9).
- **결정**: **수집과 적재 사이에는 반드시 Stream을 둔다 — 같은 프로세스 안이어도 예외가 아니다.** 근거는 넷 — ① 백프레셔 흡수 ② at-least-once 재시도 · DLQ ③ 이벤트 루프 격리 ④ 재처리 · 역할 분리 대비. Stream 경계를 건너는 경로는 SW-01 off(실험 전용)와 알람 판정 직접 호출(ADR-11) 둘뿐이다.
- **버린 대안**: ① **직접 호출** — ClickHouse 삽입 지연이 Modbus 폴링 주기로 역류하고, 실패 배치를 다시 읽을 지점이 없어 프로세스가 죽으면 재시도 상태가 함께 사라진다. ② **프로세스 안 이벤트 버스** — 결합은 풀지만 재시작 내구성이 없어 ②가 그대로 깨진다. ③ **역할 분리 때 경계를 도입** — 분리 순간 호출부를 전부 다시 써야 해 "코드 변경 없는 1단계"가 거짓이 되고, 분리 전후 비교에 코드 변경이 섞인다.
- **파급**: loopback 1홉이 대가이며 지연 예산 구간으로 잰다([05_latency_budget.md](./05_latency_budget.md)). 원칙을 증명하는 경로가 SW-01 off 실험이다(모드 A 전용). 원칙의 정본 서술은 [02_module_boundaries.md](./02_module_boundaries.md) · 계약은 REQ-GLB-03 · 04.

## ADR-07 — 실시간 팬아웃은 Redis Pub/Sub 경계 유지

- **상태**: 현행 — **D-16 부분 변경**. 알람 이벤트 채널(ch:alarm)이 알람과 함께 지워져 Pub/Sub을 지나는 실시간 값은 ch:rt이고 같은 채널 계층에 ch:cacheinv · ch:bizreply · ch:flow가 있다(정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). 경계 유지의 결정은 그대로이며 원문은 보존한다.
- **맥락**: Ingest · Alarm의 발행자와 WebSocket 게이트웨이가 같은 프로세스에 있어 직접 호출이 더 빠르다(원본 architecture.md §8.2 · 원본 data_flow.md §9).
- **결정**: 실시간 값(ch:rt)과 알람 이벤트(ch:alarm)는 **Pub/Sub을 지난다.** 마스터 무효화 신호(ch:cacheinv)도 같은 채널 계층이다. Pub/Sub은 저장이 아니라 표시 전용이며 저장은 별도 경로(ClickHouse)가 맡는다.
- **버린 대안**: ① **게이트웨이 직접 호출** — api 다중 인스턴스(확장 2단계)에서 다른 인스턴스에 붙은 소켓이 값을 받지 못해 팬아웃 코드를 새로 써야 한다(SW-06 off의 측정 경로가 이것이다). ② **팬아웃도 Stream** — 전달 보장이 필요 없는 표시 데이터에 PEL · XACK · 인스턴스별 컨슈머 그룹을 얹어 메모리와 코드만 늘고, 재연결 공백은 REST 최신값 동기화로 이미 메워진다. ③ **Socket.IO 어댑터** — 고빈도 푸시에 프로토콜 오버헤드가 붙어 스로틀 효과 측정에 라이브러리 비용이 섞인다.
- **파급**: 대가는 loopback 1홉(원본 예상치 1 ms 미만)이다. 느린 구독자는 출력 버퍼 한도로 끊는다 — 한도 값의 소유는 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)(W6)다. SW-06의 대상 채널은 ch:rt · ch:alarm뿐이다([02_module_boundaries.md](./02_module_boundaries.md)).

## ADR-08 — 역할 스위치는 DI 포트 · 구현 둘

- **상태**: 현행 — **D-16 부분 변경**. SW-09 gated(ADR-28)가 "경로 안 분기를 두지 않는다"의 **기록된 예외**다 — 주입은 그대로 모듈 초기화 때 하고(gated도 on과 같은 COPY 구현) 배치마다 Redis 게이트를 보는 판정 하나가 sink 장식 한 자리에 생긴다. 측정 도구 삭제로 실험을 잃은 스위치는 실험 자리를 "없음"으로 둔다(D-06 상태 줄). 원문은 보존한다.
- **맥락**: 학습 목표를 "구현"이 아니라 "이해"로 삼아 같은 코드에서 Redis 각 역할을 켜고 꺼 기여분을 분리한다(D-06). 스위치가 여럿이라 조합이 생긴다.
- **결정**: 스위치는 **포트 인터페이스 하나에 구현 둘**을 두고 **모듈 초기화 때 환경변수로 고른다.** 경로 안 분기를 두지 않는다. 전환은 환경변수 변경과 재기동뿐이며 화면은 상태를 표시할 뿐이다. 포트 · 구현 이름의 정본은 [02_module_boundaries.md](./02_module_boundaries.md) §포트 · 구현 이름 확정 표(스위치마다 포트 하나 · 구현 둘 — 수는 그 표가 센다).
- **버린 대안**: ① **조회 경로 안 if** — 분기 자체가 측정 대상 코드에 섞여 on/off 비교가 분기 비용까지 재고, 스위치가 늘수록 경로가 조합 폭발한다. ② **런타임 토글(기능 플래그)** — 측정 도중 스위치가 바뀌어 한 실험이 두 조건을 섞고, 토글 가능하게 만들려면 결국 ①로 돌아간다. ③ **빌드 인자로 이미지를 갈라 만들기** — 같은 커밋에서 이미지가 둘이 되어 측정 기록의 커밋 해시가 조건을 식별하지 못한다.
- **파급**: 스위치 상태는 주입된 구현을 기준으로 노출한다(REQ-OBS-11). ADR-10의 갱신 주체 교체 포트도 같은 모양이라 SW-11로 채번했다. SW-02 포트를 LatestValueReadPort로 개명한 이유가 ADR-10의 쓰기 포트와의 충돌이다.

## ADR-09 — 배치 적재 읽기 · 삽입 분리(보정 7.1)

- **맥락**: 원본은 배치 50,000행 · 1초 · 32 MB 셋 중 먼저 도달한 조건에서 플러시하고 컨슈머 3개가 각자 플러시한다. M 티어(10,000 pps)에서 50,000행은 5초가 걸려 **시간 트리거가 항상 먼저** 걸리고, 컨슈머 3개가 각자 초당 1회 플러시해 파트 생성률이 3배가 된다 — 다중화와 배치 정책이 서로를 무효화한다(원본 implementation_plan.md §7.1).
- **결정**: **A안 — 컨슈머 N개는 XREADGROUP과 디코딩만, 디코딩된 행은 단일 flusher로 fan-in해 삽입은 한 곳에서 한다.** XACK은 flusher가 삽입 성공 후 엔트리 ID를 되돌려 수행한다. 배치 토큰도 flusher가 만든다. S3에서 B · C와 파트 생성률 · E2E를 비교하고, 결과가 뒤집으면 이 ADR에 상태 항목을 단다.
- **버린 대안**: ① **현행(컨슈머별 독립 플러시)** — 파트 생성률이 컨슈머 수에 비례해 ClickHouse 권장 상한(테이블당 초당 1회)의 3배가 되고, 백프레셔 주의 단계의 컨슈머 증설이 적체를 줄이는 대신 파트를 늘린다. ② **B안(컨슈머 1 + 시간 트리거 확대)** — 가장 단순하지만 디코딩이 한 루프에 묶이고 Stream 대기가 트리거 확대만큼 늘어 E2E 예산의 지배 구간이 커진다 — S3 비교 대상으로 남는다. ③ **C안(async_insert)** — 서버가 블록을 합치지만 삽입 응답과 디스크 기록 사이가 벌어진다. 대기 없이 쓰면 응답 뒤 XACK한 엔트리가 서버 버퍼 유실로 사라지고, 대기를 켜면 지연이 서버 합치기 주기에 묶인다 — S3 비교 대상으로 남는다.
- **파급**: 삽입 횟수가 컨슈머 수와 무관해진다 — 시간 트리거와 행 트리거 R 중 먼저 걸리는 쪽이 정한다. 현행 R 50,000 기준 M 초당 1회 · 배치 10,000행(시간 트리거) · M+ 초당 2회 · 배치 50,000행 · L 초당 10회(행 트리거) — W4 산술 보정([07_capacity_planning.md](./07_capacity_planning.md) · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) §배치 트리거 산술 보정). Stream 대기가 체류 · 디코딩 · fan-in 대기 셋으로 쪼개진다([05_latency_budget.md](./05_latency_budget.md)). 주의 단계 컨슈머 증설은 삽입 병목에 효과가 없다([06_backpressure_failure.md](./06_backpressure_failure.md)). 기전 정본 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md).

## ADR-10 — 최신값 갱신 주체(보정 7.2)

- **상태**: **잠정(2026-09-24)** — S3 전에 A를 잠정안으로 고정하고 S6 실측으로 최종 결정한다. 최종 결정이 B이면 새 ADR을 말미에 채번하고 이 번호에 "대체됨"을 단다. 대체되어도 **교체 가능한 포트 구조와 "진실은 ClickHouse" 정책은 살아남는다.**
- **맥락**: 최신값 갱신 주체가 Ingest이고 갱신 시점이 ClickHouse 삽입 성공 + XACK 뒤라, ClickHouse가 5분 멈추면 rt 계열 최신값도 5분 멈추고 실시간 대시보드가 멈춘다. 원본 장애 시나리오 표에 이 사실이 없었다(원본 implementation_plan.md §7.2).
- **결정**: **A(Ingest가 삽입 확정 뒤 갱신)를 잠정 채택**하고 쓰기 쪽에 **LatestValueWritePort**(IngestLatestValueWriter · CollectorLatestValueWriter)를 둔다. **구현 선택은 SW-11 LATEST_VALUE_WRITER(기본 ingest)로 노출해 S6 비교를 스위치 상태로 기록한다.** 잠정 기간에도 STALE 표시를 끄지 않고 장애 시나리오 표에 최신값 정지를 명시한다. S6에서 두 구현으로 ClickHouse 중단을 재현해 갱신 공백 · argMax 불일치 건수 · 복구 수렴 시간을 잰다.
- **버린 대안**: ① **B를 지금 확정(Collector가 XADD 파이프라인에 HSET 동봉)** — 기동 복원(argMax 재구성)의 소유자가 정해지지 않았고, 엔트리가 끝내 DLQ로 격리되면 **ClickHouse에 없는 값이 최신값으로 남는다** — "진실은 ClickHouse"와의 관계가 실측 전에 판정되지 않는다. ② **포트 없이 A 고정** — S6 비교를 위해 갱신 코드를 두 번 써야 하고, 비교 전후 코드가 달라 측정에 "코드가 달라져서"가 붙는다. ③ **결정 보류** — S3 진입 조건(보정 7.2 방침이 ADR로 정해짐)이 충족되지 않아 Ingest 심화가 두 방향으로 갈린다.
- **파급**: 구현 선택이 SW-11로 채번되어 S6 비교가 측정 기록 4요소의 스위치 상태로 남는다 — 채번 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · 포트 확정 표 [02_module_boundaries.md](./02_module_boundaries.md). 최종 결정이 나면 SW-11의 기본값 또는 존속을 같은 변경 단위에서 판정한다. 복구 중 옛 스풀 값이 최신값을 덮어쓰는 순서 역전은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)(W4)가 판정한다. 정책 서술 [06_backpressure_failure.md](./06_backpressure_failure.md) §ClickHouse 중단 시 최신값 정지.

## ADR-11 — 알람 판정 배치 단위 조회 · 직접 호출 예외(보정 7.3)

- **상태**: **폐지(D-16 — 사용자 결정 2026-10-11)**. 알람 기능(판정 · 세 쓰기 · 핫 상태)이 지워져 배치 단위 상태 조회와 직접 호출 예외가 함께 사라졌다. **살아남는 것** — "경계 예외는 근거를 먼저 적는다"는 규율이다(새 예외가 답할 질문 4 — [02_module_boundaries.md](./02_module_boundaries.md) §경계 예외). 번호는 재사용하지 않고 원문을 보존한다(기전 링크만 삭제된 파일 이름 평문으로 바꿨다).
- **맥락**: 원본 알람 시퀀스는 **행마다** alarm:state를 조회한다 — 배치당 수만 행에 행당 Redis 왕복 1회는 곧바로 수집 처리량 상한이다. 판정은 Ingest가 Alarm을 같은 프로세스 안에서 직접 부르는데, 이는 Stream 경계 원칙의 유일한 예외이면서 근거가 적혀 있지 않았다(원본 implementation_plan.md §7.3).
- **결정**: ① 판정은 **배치 단위**다 — 배치에 걸린 rule_id만 모아 상태를 **파이프라인 1회**로 읽는다(판정 전체를 스크립트 1회로 하는 것은 같은 결정의 구현 변형이며 기전 정본이 고른다). 핫 상태는 Redis Hash에 둔다. ② 직접 호출을 **의도된 유일한 예외**로 명시한다 — 판정은 삽입이 확정된 배치의 후처리이고 재처리 단위가 배치와 같아 별도 큐가 필요 없다. ③ 지연 예산에 알람 판정 구간을 신설한다(미확인).
- **버린 대안**: ① **행당 상태 조회(원본)** — 판정 처리량이 Redis 왕복 × 행 수에 묶여 M 티어 이상에서 판정이 수집을 따라가지 못한다. ② **프로세스 메모리 상태 + 비동기 write-back** — 왕복은 없지만 역할 분리 뒤 두 워커가 같은 규칙을 평가하면 서로의 상태를 모른 채 같은 알람을 두 번 확정한다. ③ **알람 전용 Stream** — 판정 재처리 단위가 배치와 어긋나 원시값은 적재됐는데 판정만 DLQ로 가는 창이 생기고, 컨슈머 그룹이 하나 더 늘어 메모리 예산을 먹는다. ④ **근거 없이 예외 유지** — "같은 프로세스 안이어도 예외가 아니다"가 사례별 판단으로 퇴화해 다음 예외를 막을 근거가 없다.
- **파급**: 판정은 ingest와 함께 worker 역할에 배정된다(ADR-22). 판정 구간이 플러시 주기를 넘으면 적체가 판정 쪽에 쌓인다는 구조 관계를 예산이 갖는다([05_latency_budget.md](./05_latency_budget.md)). 예외 근거 정본 [02_module_boundaries.md](./02_module_boundaries.md) · 기전 06_pipeline/08_alarm(D-16 삭제) · 계약 REQ-GLB-04.

## ADR-12 — 캐시 무효화 체인 6단(보정 7.4)

- **맥락**: 원본 무효화 순서는 커밋 → Redis 삭제 → Pub/Sub → Dictionary 재적재의 4단인데 캐시는 Redis · Dictionary · Next.js 서버 fetch · 브라우저 쿼리 캐시로 더 많다. 원본 검증 항목 "마스터 수정 후 즉시 반영"은 원본 설계대로면 반드시 실패한다(원본 implementation_plan.md §7.4).
- **결정**: 체인을 **6단**으로 둔다 — ① 트랜잭션 커밋 ② Redis 캐시 삭제 ③ ch:cacheinv 발행 ④ Dictionary 즉시 재적재 ⑤ BFF 서버 fetch 캐시 태그 무효화 ⑥ WebSocket 무효화 신호로 브라우저 쿼리 캐시 무효화. ②~⑥은 **커밋 뒤에만** 걸고, 캐시는 새 값으로 덮어쓰지 않고 **삭제**한다.
- **버린 대안**: ① **원본 4단** — BFF 캐시 수명(현행 참고 30초)과 브라우저 staleTime만큼 옛 값이 보여 인수 기준 AC-06이 실패한다. ② **TTL 만료에만 의존** — 태그명 변경이 최대 캐시 수명만큼 늦게 보이고, Dictionary는 재적재 주기(현행 참고 최대 10분)만큼 옛 이름을 붙인다. ③ **캐시 갱신(write-through)** — 동시 갱신 순서가 뒤집히면 낡은 값이 최종으로 남는다. ④ **커밋 전 삭제** — 사이에 끼어든 조회가 옛 값으로 캐시를 다시 채워 커밋 뒤에도 영구히 낡은 값이 남는다.
- **파급**: 기전 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · 계약 REQ-MST-09 · 판정 AC-06. ch:cacheinv는 SW-06의 대상이 아니다 — 스위치 상태에 따라 정합성 계약이 달라지지 않게 한다.

## ADR-13 — TTL 강제는 키 계열별 래퍼(보정 7.5)

- **상태**: 현행 — **D-16 부분 변경**. CacheKeyClient의 sess · rl · auth와 DurableKeyClient의 alarm이 지워져 CacheKeyClient(cache · lock · biz) · DurableKeyClient(stream · rt)다. 래퍼 3종과 지터 범위의 결정은 그대로이며 원문은 보존한다.
- **맥락**: 원본은 키 계열별 TTL 규칙을 "린트 규칙으로 강제한다"고 두 번 적었지만 린터로는 "cache 접두 키에 SET할 때 TTL 인자가 있는가"를 검사할 수 없다. 단일 인스턴스에서는 키 접두 하나가 생존 정책의 경계다(원본 implementation_plan.md §7.5).
- **결정**: 강제 수단은 **타입과 래퍼 3종**이다 — **CacheKeyClient**(cache · sess · lock · rl · auth)는 모든 쓰기가 TTL을 필수 인자로 받고 짧은 타임아웃 후 예외를 삼킨다. TTL 지터는 **cache 접두의 단건 키에만** 적용한다(동시 만료 스탬피드가 생기는 자리가 거기뿐이다). **DurableKeyClient**(stream · rt · alarm)는 TTL 계열 명령을 **노출하지 않고** 실패를 그대로 던진다. **FanoutPublisher**(ch 채널)는 발행만 노출한다. 래퍼 경계 · 지터 범위 판정의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다.
- **버린 대안**: ① **린트 규칙** — 키 문자열과 명령 인자의 관계를 정적 규칙으로 잡을 수 없어 규칙이 문장으로만 남고 반드시 새어 나간다. ② **코드 리뷰 관례** — 봉인 키에 TTL 하나가 붙는 순간 그 키가 축출 후보가 되는데, 메모리 압박이 오기 전까지 아무 증상이 없어 리뷰로 발견되지 않는다. ③ **사후 감시(키 이벤트 알림)** — 위반을 알아챌 때는 이미 Stream 엔트리나 알람 상태가 사라진 뒤다.
- **파급**: "같은 Redis 안에서 키 계열에 따라 실패 전략이 정반대"가 코드 구조로 표현된다(REQ-GLB-08 · 09). 래퍼를 우회한 원시 호출 · redis-cli 수동 조작은 막지 못한다 — 잔여는 봉인 표와 한계 등재가 받는다. 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md).

## ADR-14 — 적재 멱등은 insert_deduplication_token

- **상태**: 현행 — **S0 실측으로 보강(2026-09-24 · EXP-32 · 기록 001 · 004 · 사용자 결정).** 결정 원문(결정적 토큰 + tag_raw 윈도우)은 그대로 산다. ClickHouse 25.8 · 26.8 모두 원시가 토큰으로 중복 제거돼도 종속 MV를 다시 돌려, 원문만으로는 응답이 유실된 성공 배치의 재시도가 롤업 3테이블을 두 배로 센다(3회 모두). 그래서 **롤업 3테이블에도 같은 윈도우를 두고 삽입 설정 deduplicate_blocks_in_dependent_materialized_views를 켜는 한 쌍**을 결정에 더한다 — 둘 중 하나만 둔 두 조건(설정만 · 윈도우만)도 이중 계수가 3회 모두 남았다(실측). **잔여** — 재계산 · 백필처럼 비운 롤업에 같은 내용을 다시 넣는 삽입은 25.8에서 윈도우에 걸려 오류 없이 버려졌으므로 insert_deduplicate 0으로 한다(26.8은 버리지 않았다 — 절차가 버전에 기대지 않게 한다). 먼저 성공한 MV가 있는 부분 실패도 보강 아래에서 정확했다(26.8 · 기록 004). 정본 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) §서버 설정 계약 · [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md).
- **맥락**: at-least-once라 컨슈머가 삽입 직후 · XACK 직전에 죽으면 같은 배치를 다시 읽는다(원본 architecture.md §7.1 · 원본 data_flow.md §4.3).
- **결정**: 배치마다 **내용에 결정적인 토큰**(첫 엔트리 ID + 끝 엔트리 ID + 행 수의 해시)을 insert_deduplication_token으로 싣고, tag_raw에 비복제 중복 제거 윈도우를 둔다. 재시도는 첫 시도와 같은 토큰을 쓰고 백오프 합계는 윈도우 안에 머문다. SW-08 off가 토큰을 빼는 실험 경로다.
- **버린 대안**: ① **ReplacingMergeTree** — 중복이 머지 시점에야 사라져 머지 전 조회가 중복을 보고, 정확한 결과에 FINAL을 붙이면 조회마다 비용이 붙는다 — 롤업 MV는 삽입 블록을 보므로 중복이 롤업에 그대로 들어간다. ② **무작위 UUID 토큰** — 재시작 뒤 같은 배치가 다른 토큰을 받아 중복 행이 생긴다. ③ **토큰 없음** — 재시도 중복이 avg · count 롤업을 조용히 부풀려 역전 지점과 압축률 측정까지 오염된다.
- **파급**: 토큰 재료가 엔트리 ID 범위라 SW-01 off(엔트리 ID 없음)에서는 멱등을 재지 않는다. ADR-09로 토큰은 fan-in 배치에서 flusher가 만든다 — fan-in 배치의 토큰 재료는 [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4). 대조군 쪽 멱등 수단은 이 결정의 범위 밖이다(ADR-17).

## ADR-15 — tag_raw 롱 포맷 · 일자 파티션 · 정렬 키

- **맥락**: 설비마다 태그 구성이 다르고 태그 추가가 잦다. 실제 조회는 "특정 설비의 특정 태그를 시간 범위로"다. 보존은 파티션 단위로 끊는다(원본 architecture.md §7.1).
- **결정**: tag_raw는 **태그당 1행 롱 포맷**, **일자 파티션**(ts 기준), **정렬 키 (device_id · tag_id · ts)**, 시각은 Delta + ZSTD · 값은 Gorilla + ZSTD 코덱이다. 보존은 파티션 DROP으로 끊는다.
- **버린 대안**: ① **와이드 포맷(설비당 태그 컬럼)** — 태그 추가가 스키마 변경이 되고 설비마다 컬럼 집합이 달라 테이블이 설비 수만큼 갈라진다. ② **월 파티션** — 파티션이 커져 7일 보존을 파티션 DROP으로 끊을 수 없고 행 단위 DELETE(비동기 mutation)로 떨어진다. ③ **시간 파티션** — 파티션 수가 폭증해 파트 수 한도에 먼저 닿는다. ④ **ts 선두 정렬 키** — 한 태그의 시간 범위 조회가 전 태그를 스캔하고, 같은 태그 값이 인접하지 않아 Gorilla · Delta 압축이 무너진다.
- **파급**: 정렬 키 선두의 저카디널리티 컬럼이 압축률 · 스킵 효율의 전제다 — 대조군 plc_tag_raw_control이 같은 모양을 따라야 비교가 성립한다(ADR-17). 스키마 정본 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · 보존 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md).

## ADR-16 — 마스터 연동은 Dictionary · 두 DB를 묶지 않는다

- **맥락**: 시계열 조회 결과에 태그명 · 단위를 붙여야 하는데 태그 마스터는 PostgreSQL이 소유한다(원본 architecture.md §7.4 · §12).
- **결정**: ClickHouse **Dictionary(PostgreSQL 소스 · 전용 읽기 계정 · 메모리 상주 레이아웃)**로 조회 시점에 메타를 붙인다. 태그 마스터 커밋 뒤에 즉시 재적재를 호출한다(ADR-12 ④). **두 DB를 트랜잭션으로 묶지 않는다** — 시계열은 불변 사실로 두고 tag_id는 영구 보존 · 재사용 금지 · 스케일 변경은 새 tag_id 발급이다.
- **버린 대안**: ① **태그명을 tag_raw에 저장** — 행마다 문자열이 붙어 저장량이 늘고, 태그명 변경이 과거 행 수정(비동기 mutation)이 된다. ② **API가 조회 뒤 PostgreSQL과 조인** — 조회마다 PostgreSQL 왕복이 붙고, ClickHouse가 직접 직렬화해 흘려보내는 내보내기 스트림에는 끼어들 자리가 없다. ③ **두 DB 분산 트랜잭션** — PostgreSQL 장애가 시계열 적재를 막고, ClickHouse에 롤백 의미론이 없어 반쯤 반영된 상태가 남는다.
- **파급**: PostgreSQL이 멈춰도 시계열 조회는 Dictionary의 마지막 값으로 계속된다. 비활성 태그를 소스에서 거르면 과거 행의 태그명이 사라지는 문제는 [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md)가 판정했다 — dict_tag는 비활성 태그도 싣고 is_active를 속성으로 둔다(W3). 계약 REQ-GLB-14.

## ADR-17 — PostgreSQL 대조군 동형 테이블 · SW-09 동시 적재

- **상태**: 현행 — **D-16 부분 변경 · 일부 대체 → ADR-28**. 직접 비교(D-16 결정 2)가 동형(BRIN · 제약 없음)을 **정상형(기본 키 · 외래 키 · 검사 제약)**으로, 기본 off를 **gated(실행 중 게이트)**로, 대조 실험 계측물을 **직접 비교 사본**으로 바꿨다(ADR-28). 같은 배치를 양쪽에 · 배치당 COPY 1회 · 실패가 XACK를 막지 않음 · 재시도 없음 · 전용 커넥션은 그대로다. 파급의 대조 실험(EXP-01~05 · 격자 · 자원 동일화 조건)은 실행 도구 삭제로 폐지(D-16)됐고 03_execution_topology의 옛 §대조 실험 자원 조건은 지웠다 — 결과는 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과에 남는다. 원문은 보존한다.
- **맥락**: 학습 목표 ①을 측정으로 알려면 같은 데이터 · 같은 쿼리를 행 기반 RDB와 컬럼형에 동시에 돌려야 한다(D-05 · D-12).
- **결정**: PostgreSQL에 tag_raw와 **동형인 plc_tag_raw_control**(일자 파티션 · BRIN)을 두고, SW-09 on에서 Ingest가 **같은 배치를 양쪽에 삽입**한다. 기본 off다. 대조군 삽입 실패는 XACK를 막지 않고 실패 구간을 대조 실험에서 무효로 표시한다.
- **버린 대안**: ① **대조군 전용 생성기로 PostgreSQL에만 주입** — 두 저장소의 행 집합이 달라 같은 쿼리의 결과를 대조할 수 없다. ② **대조군 전용 컨슈머 그룹** — 두 그룹이 다른 속도로 소비해 측정 시점마다 두 저장소의 행 수가 어긋나고, 그룹 하나가 늘어 Stream 메모리 · 적체 판정이 흔들린다. ③ **ClickHouse → PostgreSQL 복제** — 복제 지연이 행 수 일치를 깨고, 복제 부하가 ClickHouse 쪽 측정에 섞인다. ④ **대조군 실패 시 XACK 보류** — 계측물의 실패가 분기 목적지(ClickHouse)의 경로를 멈춘다.
- **파급**: 대조군은 중복 저장이 아니라 계측물이다([04_storage_split.md](./04_storage_split.md)). 대조 실험은 두 저장소 행 수 정확 일치 구간에서만 한다. **삽입 의미론(05_data_stores/10 판정)** — ClickHouse 삽입 성공 뒤 배치당 COPY 1회(트랜잭션 1) · 실패해도 재시도하지 않는다 · XACK 전 크래시의 재전달 중복은 구간 count 대조로 검출한다 · 실패 · 중복 구간은 대조 무효로 표시한다(REQ-ING-15). 적재는 업무 풀과 분리된 전용 커넥션 1개로 한다(ADR-19). 대조 실험의 자원 동일화 조건은 [03_execution_topology.md](./03_execution_topology.md) §대조 실험 자원 조건. 설계 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md).

## ADR-18 — named volume · 127.0.0.1 바인드

- **맥락**: 로컬에서 psql · clickhouse-client · redis-cli로 저장소를 직접 만지는 것이 학습에 필요하고, Docker Desktop의 호스트 디렉터리 마운트는 파일 공유 계층을 거친다(원본 architecture.md §3 · 원본 tech_stack.md §10.3 · §10.4).
- **결정**: 볼륨은 **named volume 4개**(pgdata · chdata · redisdata · spooldata)이고 호스트 디렉터리를 마운트하지 않는다. 호스트 publish는 **전부 127.0.0.1에 바인드**하고 PlcSim 포트는 publish하지 않는다.
- **버린 대안**: ① **bind mount** — DB 랜덤 I/O가 파일 공유 계층을 지나 느려져 디스크 계층 수치가 측정 대상이 아닌 계층을 잰다. ② **0.0.0.0 바인드** — 같은 네트워크의 기기에 DB 포트가 그대로 열린다. 세 저장소 모두 비밀번호를 요구하지만([../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)) 방어가 비밀번호 한 겹만 남아 LAN의 어느 기기든 대입 · 인증 우회 결함의 표적이 된다. ③ **저장소 포트 비공개(컨테이너 안 CLI만)** — 학습 도구(DBeaver 등)를 붙일 수 없고, 매 확인이 컨테이너 진입이 되어 관찰 비용이 커진다.
- **파급**: 호스트에서 스풀 파일을 직접 볼 수 없어 컨테이너 안에서 확인한다. 127.0.0.1 바인드는 LAN 노출만 막고 같은 머신의 다른 프로세스는 막지 않는다 — 잔여 [../12_security/05_local_exposure.md](../12_security/05_local_exposure.md). 정본 [03_execution_topology.md](./03_execution_topology.md).

## ADR-19 — PostgreSQL 커넥션은 api in-process 풀

- **맥락**: PostgreSQL에 붙는 주체는 api 프로세스 하나 · Dictionary 소스 · 사람의 CLI뿐이다(원본 architecture.md §6 · 원본 tech_stack.md §5.1).
- **결정**: api 프로세스의 **in-process 풀**로 커넥션을 관리하고 별도 풀러를 두지 않는다. 풀 크기 · max_connections는 2계층 조정값이다(현행 참고 풀 20 · 100 · 소유 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)). **PgBouncer는 api 다중 인스턴스(확장 2단계)에서 도입한다.** 대조군 적재(SW-09)는 업무 풀과 분리된 **전용 커넥션 1개**를 쓴다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 판정) — 대량 COPY가 업무 풀 커넥션을 붙잡아 CRUD 지연에 섞이지 않게 한다.
- **버린 대안**: ① **지금 PgBouncer 도입** — 컨테이너 하나가 메모리를 먹고, 트랜잭션 풀링 모드에서는 세션 상태 · prepared statement 제약을 얻는데 막을 커넥션 폭발 조건이 없다. ② **모듈마다 풀** — 한 프로세스 안에 풀이 여럿 생겨 커넥션 상한을 모듈 수만큼 나눠 설정해야 하고, 한 모듈의 풀 고갈이 다른 모듈에 보이지 않는다.
- **파급**: 웹은 DB에 직접 붙지 않는다(경계 금지 — [01_system_architecture.md](./01_system_architecture.md)). 확장 2단계 진입 시 커넥션 주체가 여럿이 되는 순간 이 결정을 재판정한다([08_scaling_roadmap.md](./08_scaling_roadmap.md)).

## ADR-20 — 관측 스택은 선택 프로파일 · 창구는 /metrics 하나

- **맥락**: 측정 대상과 측정 도구가 같은 머신의 CPU를 나눠 쓴다. 저장소마다 exporter 컨테이너를 두면 메모리 예산을 먹는다(원본 architecture.md §14 · 원본 tech_stack.md §9).
- **결정**: 관측 스택은 **observability 프로파일**로만 띄운다. 앱 · 파이프라인 · 세 저장소 메트릭을 OBS 모듈이 모아 **/metrics 하나**로 노출한다(프로세스당 창구 하나 — 역할 분리 뒤에는 역할마다 하나, ADR-22). 정밀 측정 세션은 프로파일을 끄고 /metrics를 직접 덤프한다.
- **버린 대안**: ① **저장소별 exporter 컨테이너** — 컨테이너가 셋 늘어 ClickHouse 몫이 줄고, 창구가 넷이 되어 한 실험의 수치를 한 시점으로 모을 수 없다. ② **관측 스택 상시 기동** — 프로파일이 측정 대상과 CPU를 다퉈 정밀 측정 수치의 절대값이 흔들린다. ③ **ClickHouse 내장 메트릭 엔드포인트 직접 스크레이프** — 가능하지만 창구가 둘이 되어 대시보드가 두 출처를 합쳐야 한다.
- **파급**: 프로파일을 켠 탐색 수치는 상대 비교용이다. 프로파일 구성원(보정 #17)은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md)가 판정했다 — prometheus · grafana 2(W6) · 메트릭 전수 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md).

## ADR-21 — 백프레셔 1차 신호는 애플리케이션의 적체 검사

- **맥락**: 버퍼가 차면 조용히 버리지 말고 실패시켜야 한다. Redis에는 두 한계가 있다 — MAXLEN 트리밍(오류 없이 오래된 엔트리를 버린다)과 maxmemory(캐시를 축출하고 결국 OOM). 원본은 1차 신호를 "Collector의 XLEN 검사"로 적었다(원본 architecture.md §9.3 · 원본 data_flow.md §12.1).
- **결정**: ① **1차 신호는 발행자(Collector · 모드 B · 모드 C)가 발행 전에 하는 적체 검사**다. ② **판정량은 원시 XLEN이 아니라 컨슈머 그룹의 미확인 적체(그룹 lag + pending)**다 — 확인된 엔트리는 MAXLEN까지 남아 XLEN은 정상 운전에서도 상한으로 차오른다. ③ 걸리는 순서는 **위험 임계 < MAXLEN < maxmemory**다 — MAXLEN × 엔트리 크기 + 캐시 예산이 maxmemory 안에 들게 산정해 Stream이 세션 · 토큰을 밀어내지 않게 한다. ④ MAXLEN 트리밍은 검사를 우회한 발행자를 막는 최후 안전장치이며 미소비분이 잘리면 결함으로 계측한다.
- **버린 대안**: ① **XLEN으로 단계 판정(원본 문구)** — 정상 운전에서 발행 누적이 MAXLEN × 90%에 닿는 순간(M 티어 원본 산정 약 한 시간) 적체 없이 위험 단계에 들어가 스풀로 전환하고, 이후 모든 수집이 스풀을 거친다. ② **Redis OOM을 1차 신호로** — Stream이 캐시 · 세션 예산을 다 먹은 뒤에야 신호가 와서 그 전에 사용자가 로그아웃된다. ③ **MAXLEN 트리밍에 맡김** — 오류 없이 미소비 엔트리가 잘려 유실을 인지하지 못한 채 틀린 처리량 수치를 얻는다. ④ **발행자 일부만 검사** — 검사하지 않는 발행자가 곧 우회 발행자가 되어 트리밍이 그 몫을 조용히 자른다.
- **파급**: 임계는 MAXLEN 비율로 정의한다([06_backpressure_failure.md](./06_backpressure_failure.md) §프로파일별 임계). Stream 점유 메모리가 적체가 아니라 충전량을 따르므로 **축출 연쇄 실험과 확장 3단계 진입 조건의 해석이 바뀐다** — [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) 반영 대상. 컨슈머 랙 산출식의 정본 판정은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)이며 W6이 이 결정의 판정량과 같은 양(그룹 lag + pending)으로 닫았다. Kafka 전환(확장 4단계) 때 재판정한다.

## ADR-22 — APP_ROLE 역할 배정

- **상태**: 현행 — **D-16 부분 변경**. APP_ROLE datagen이 지워져 4값(all · api · worker · collector)이다 — 결정 ②의 GEN 모드 B · D · 실측(datagen) · 모드 C 수신 표면(api) · ALM(표면 api · 판정 worker) 배정이 대상과 함께 사라졌다. ① · ③ · ④는 그대로이며 원문은 보존한다. 설비 가동 적용(SIM 포트 · 모드 A 틱 · 폴링을 켜고 끄는 PlantRuntime)이 collector 역할에 더해졌다(ADR-29 — 공통 기능이라 도메인 배정 셈 밖).
- **맥락**: APP_ROLE 5값(all · api · worker · collector · datagen)으로 역할을 나누는 것이 확장 1단계인데, 원본은 SIM · OBS의 역할을 정하지 않았다. PlcSim은 컨테이너 루프백에만 바인드하고 모드 A의 레지스터 갱신은 프로세스 안 호출이다(원본 architecture.md §3 · §4 · 웨이브 인계 W3 행).
- **결정**: ① **SIM과 GEN 모드 A는 collector 역할**과 한 프로세스에 둔다. ② GEN 모드 B · D · 실측은 datagen, 모드 C 수신 표면은 api, ALM은 표면 api · 판정 worker로 **기능 단위 배정**한다. ③ **OBS는 전 역할에서 기동**해 역할마다 자기 /metrics · health를 내고, 저장소 통계 수집은 api 역할 한 곳에서만 한다. ④ **기동 기본은 all이며 분리는 실측 진입 조건으로만 한다.**
- **버린 대안**: ① **SIM을 datagen에** — collector 컨테이너 루프백에 PlcSim이 없어 모드 A 폴링이 전부 연결 거부된다. ② **SIM 전용 역할** — 루프백 제약을 풀려고 포트를 브리지에 열면 "publish하지 않는다"가 컨테이너 간 노출로 바뀐다. ③ **GEN 전체를 datagen에** — 모드 A만 끊기고 B · C · D는 동작해 결함이 늦게 드러난다. ④ **OBS를 api에만** — 분리 직후 worker · collector의 컨슈머 랙 · 폴링 지연 카운터가 창구를 잃어 파이프라인이 계측 공백이 된다. ⑤ **저장소 통계를 역할마다 수집** — 같은 통계를 세 번 조회해 저장소 쿼리 로그에 관측 쿼리가 세 배로 섞인다.
- **파급**: 역할 분리 커밋의 코드 diff가 0이어야 한다는 검증이 이 배정 위에 선다([08_scaling_roadmap.md](./08_scaling_roadmap.md)). PlcSim을 별도 프로세스로 떼는 조건부 분리 때 모드 A SIMULATED 판정을 재판정한다. 배정표 정본 [02_module_boundaries.md](./02_module_boundaries.md) · 도메인 지도 APP_ROLE 열이 이 결정을 인용한다.

## ADR-23 — 백프레셔 하강 히스테리시스

- **맥락**: 원본은 상승 조건과 위험 → 복구 조건만 적었다. 하강을 적체 대역 그대로 따르면 임계 근처에서 단계가 진동한다(웨이브 인계 W3 행 · 11_glossary/03 미확인).
- **결정**: ① **상승은 매 검사에서 즉시** — XADD 실패 · 위험 임계 초과는 어느 단계에서든 위험. ② **주의 · 경고의 하강은 "현재 단계 진입 임계 − 폭" 미만이 유지 시간 동안 연속될 때 한 단계씩.** ③ **위험은 적체가 주의 임계 밑으로 내려갈 때까지 스풀을 유지**하고 그때 복구로 간다. ④ **복구 중 적체가 주의 임계 이상이면 재발행만 멈추고 복구를 유지**하며, 새 수집분은 Stream에 직접 발행한다. 폭 · 유지 시간은 MAXLEN 비율의 2계층 조정값이며 원본 값이 없어 S6에서 정한다.
- **버린 대안**: ① **대칭 대역(히스테리시스 없음)** — 임계 근처에서 컨슈머 증설 · 데드밴드 강화가 켜졌다 꺼져 행 수가 요동하고, 위험 임계 근처에서 스풀과 Stream이 번갈아 엔트리를 받아 재발행 순서가 뒤섞인다. ② **시간 쿨다운만** — 적체가 0이 돼도 쿨다운 동안 위험 반응이 남아 스풀이 불필요하게 커지고, 쿨다운 직후 재진입하면 진동이 그대로다. ③ **복구 중 새 수집분도 스풀로** — 수집 속도 ≥ 재발행 속도인 동안 스풀이 영영 비지 않아 복구가 끝나지 않는다. ④ **복구 중 재진입을 주의 단계로** — 재발행이 만든 적체가 외부 적체로 계측되어 주의 단계 반응이 재발행과 겹친다.
- **파급**: 복구 중 새 값과 옛 스풀 값이 섞여 적재되는 것은 순서 무관성이 허용하지만 rt 계열 최신값 덮어쓰기 순서 역전은 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md)가 판정했다 — rt:latest 조건부 쓰기(새 ts ≥ 저장 ts · W4). 상태 머신 3의 하강 전이 잠정 표기를 이 결정으로 확정했다 — [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 반영 완료. 정본 [06_backpressure_failure.md](./06_backpressure_failure.md).

## ADR-24 — SW-10 off면 경고 단계 강화는 무동작

- **맥락**: 경고 단계의 반응은 "Collector가 데드밴드를 임시 강화해 발행량 감축"인데, 데드밴드 스위치 SW-10의 기본은 off(데드밴드 0)다. 데드밴드가 꺼진 상태에서 "강화"의 뜻이 원본에 없다(웨이브 인계 W3 행 · COL-08).
- **결정**: **데드밴드 강화는 SW-10 on에서만 동작한다.** SW-10 off면 경고 단계의 발행량 감축은 무동작이고 deadband_boost_active는 0에 머물며 단계 진입만 계측한다. 강화는 태그별 설정값에 **계수를 곱하는** 형태다(가산 아님 · 설정 0인 태그는 강화돼도 0).
- **버린 대안**: ① **경고 단계 동안 태그 설정값 적용(스위치 무시)** — 측정 기록의 스위치 상태는 off인데 행이 걸러져 **같은 조건이라 믿은 두 측정의 행 수가 다르다**(D-08의 실패가 백프레셔 도달 여부에 따라 조용히 생긴다). 무손실 판정도 거짓 유실을 낸다. ② **전역 기본 데드밴드** — 공학 단위가 다른 태그에 한 값을 적용해 어떤 태그는 무의미하고 어떤 태그는 전부 차단된다. ③ **가산 강화** — 같은 문제가 설정값이 있는 태그에서도 생긴다.
- **파급**: 개발 · 측정 기본 구성에서 경고 단계 반응이 비지만 위험 단계 스풀이 최종 방어라 유실이 없다. S6에서 경고 반응을 보려면 SW-10 on으로 따로 실행하고 무손실 판정에서 데드밴드 생략분을 뺀다 — 생략분 메트릭은 col_deadband_skipped_total([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)). COL-08 · 02_features/13 미확인 행을 닫는다 — 리드 반영.

## ADR-25 — CPU 바운드 작업은 piscina worker_threads로 격리

- **맥락**: 한 프로세스가 조회 API · 수집 · 적재 · 판정 · 생성을 떠안고, 디코딩 · MessagePack · LTTB · gzip이 API 요청과 같은 이벤트 루프를 다툰다(원본 tech_stack.md §3.3 · 원본 data_flow.md §15).
- **결정**: **입력 크기에 비례해 동기 CPU 시간이 느는 작업**(신호 벡터 생성 · 대량 인코딩 · 해제 · LTTB · gzip)을 piscina worker_threads 풀에서 실행한다. IO 바운드(Modbus · 저장소 왕복)는 격리하지 않는다. 이벤트 루프 지연을 1급 메트릭으로 계측하고 그 실측이 역할 분리 진입 조건이다. 워커 수는 2계층 조정값(소유 [03_execution_topology.md](./03_execution_topology.md)).
- **버린 대안**: ① **이벤트 루프 인라인** — 큰 조회 하나 · 생성 주기 하나가 루프를 막아 수집 pps에 비례해 조회 p95가 악화된다. ② **자식 프로세스** — 대량 배열이 프로세스 경계에서 직렬화 · 복제되어 복사 비용과 메모리 이중 점유가 이득을 넘는다. ③ **처음부터 별도 컨테이너** — 역할 분리를 실측 전에 앞당겨 기준선을 잃는다(ADR-22). ④ **네이티브 애드온** — 툴체인이 늘어 "이미지 1개 · 툴체인 1개"(ADR-01)가 깨진다.
- **파급**: 격리 대상 목록의 정본은 [02_module_boundaries.md](./02_module_boundaries.md) §worker_threads 격리 대상. 워커도 같은 컨테이너 CPU를 쓰므로 격리가 CPU 경합을 없애지는 않는다 — 경합이 조회 p95에 나타나는 시점이 역할 분리의 실측 근거다(REQ-GLB-20).

## ADR-26 — 업무 쓰기는 명령 스트림 · 직렬 워커 · 멱등 원장 · 동기 응답

- **상태**: 현행 — **D-16 부분 변경**. 명령 기전은 그대로다. 트랜잭션의 audit_log가 감사와 함께 지워져 쓰는 것은 업무 행 · biz_command_log 둘이고, actor는 계정이 없어 늘 NULL이다. 파급의 EXP-46(SW-12 비교)은 실행 도구 삭제로 폐지(D-16)됐다. 원문은 보존한다.
- **맥락**: 사용자 결정(2026-09-27)이 "모든 데이터가 Redis를 거쳐 분산 처리된다"를 요구해 D-04 · REQ-GLB-12의 업무 쓰기 Stream 비경유 판정이 뒤집혔다. 옛 판정의 근거 넷(read-your-writes · 트랜잭션 원자성 · 제약 위반 즉시 응답 · 재시도 멱등)은 비동기 at-least-once 적재에서 깨지는 성질이라, 업무 쓰기를 Redis에 올리되 그 넷을 지키는 기전이 필요하다([04_storage_split.md](./04_storage_split.md) §업무 쓰기가 명령 스트림을 타는 방식).
- **결정**: api는 스키마 검증 뒤 명령 봉투(cmdId · kind · payload · actor · requestedAt)를 **stream:biz:cmd**에 XADD하고 결과를 기다린다. 워커의 소비자 그룹 **grp:biz-writer가 소비자 1 · 직렬**로 기존 쓰기 서비스를 불러 **PostgreSQL 트랜잭션 하나**(업무 행 · audit_log · **biz_command_log** — cmd_id UNIQUE)로 반영하고, 커밋 → 무효화 체인 ②③ → biz:result SET → ch:bizreply 순으로만 결과를 낸다. api는 결과를 받은 뒤에만 기존 상태 코드로 응답하고 대기 상한(현행 참고 5초)을 넘으면 202 pending을 낸다. 옛 경로는 SW-12 direct로 남긴다(포트 BizWritePort — [02_module_boundaries.md](./02_module_boundaries.md)). 기전 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로.
- **버린 대안**: ① **수집 스트림과 같은 모양(다중 컨슈머 · 배치 · 결정적 토큰)** — 응답이 적재를 기다리지 않아 쓴 직후 재조회가 옛 값을 보고, 결정적 토큰은 PostgreSQL 삽입을 막지 못해 재전달이 중복 작업지시를 만든다. ② **원장을 Redis에(SET NX 멱등 키)** — 커밋과 원장 기록 사이에 원자성이 없어 커밋 뒤 · 원장 전 크래시에서 재전달이 이중 적용한다. ③ **fire-and-forget 202만** — 제약 위반이 소비 시점에야 드러나 요청자는 성공을 받았는데 행이 없고, 화면이 모든 쓰기를 폴링해야 한다. ④ **다중 소비자 병렬 적용** — 같은 행의 두 PATCH가 스트림 순서와 다르게 커밋되어 늦게 온 값이 먼저 이긴다 · 처리량은 사람 규모라 병렬의 이득이 없다. ⑤ **XADD 실패 시 api 직접 커밋으로 우회** — 적용 주체가 둘이 되어 앞선 명령과 쓰기 순서가 뒤집힌다.
- **파급**: Redis가 업무 쓰기의 가용성 경로에 들어온다 — Redis 불가면 업무 쓰기 503(common.postgres_unavailable 재사용 — 원인은 biz_commands_total result 레이블이 가른다 · Redis 불가 = unavailable · PostgreSQL 불가 = failed · 읽기는 PostgreSQL 직행 유지). 명령 원장 테이블 1 · Redis 키 3(stream:biz:cmd 봉인 · biz:result 캐시 · ch:bizreply) · 스위치 SW-12 · 실험 EXP-46이 는다. **소비자 1은 락 lock:biz:writer(캐시 계열 lock · SET NX PX)가 강제한다** — 쥔 워커만 grp:biz-writer를 소비하고 쥔 워커가 죽으면 TTL 뒤 다른 워커가 이어받아 PEL부터 소진한다(웨이브 1 검수 반영 · 스위치 조합 제약은 늘지 않는다). 워커는 in-process 풀(ADR-19)에서 한 번에 커넥션 하나를 쓴다. 잔여는 같은 cmdId · 다른 본문 · 미적용 명령의 트리밍 · failed 명령의 적용 여부 미확정이다(한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) #24 · #25 · #26).

## ADR-27 — DB 처리 시간대 UTC · 표시 KST · 달력 의미 경계 예외

- **상태**: 현행 — **D-16 부분 변경**. 결정 ①~④는 그대로다 — ③의 닫힌 목록은 D-16 직접 비교가 둘(일별 수량 문항 · 구간 비우기의 tag_1d 버킷)을 더해 5다(정본 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §달력 의미 경계). ⑤의 기존 볼륨 재구성 절차(순번 009 · ClickHouse 전환 단계)는 D-16 새 기준선(ADR-30)이 빈 볼륨에서 처음부터 UTC로 서므로 이행 코드와 함께 지웠다(사실 정본 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §DB 시간대 전환). 원문은 보존한다.
- **맥락**: 사용자 요구(2026-09-28) "시간 처리하는 건 db에는 utc로 처리했다가 화면에 띄울 때는 kst로 변환하여 출력". 저장 바이트는 이미 epoch였지만(timestamptz 내부 UTC · DateTime64 Unix 타임스탬프) DB 쪽 처리 시간대가 전부 Asia/Seoul이었다 — PostgreSQL DB 기본 timezone · ClickHouse 서버 timezone(W6 판정) · ClickHouse 시각 컬럼 인자(W3 판정) · 파티션 · TTL 달력. API는 이미 UTC(측정 epoch ms · 업무 ISO Z)로 내리고 웹이 KST로 한 번 바꾸고 있었다.
- **결정**: ① **DB 처리 시간대 = UTC** — PostgreSQL DB 기본 · 설정 파일 timezone · ClickHouse 서버 timezone · 모든 시각 컬럼 인자. ② **저장 운영 경계(파티션 · TTL · 보존) = UTC** — 사람이 보는 뜻이 없다. ③ **화면에 "하루"로 보이는 달력 의미 경계만 함수 인자 'Asia/Seoul'로 KST를 명시한다** — 닫힌 목록 3(tag_1d 버킷 · 조회 1d 스냅 · 웹 추이 1d 스냅 — 정본 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §달력 의미 경계) · site.timezone은 표시 · 달력 의미 시간대다. ④ API 직렬화 불변 · 화면은 KST 한 번 변환. ⑤ 기존 볼륨은 **재구성으로** 옮긴다 — 설정 · 인자만 바꾸지 않는다(절차 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §DB 시간대 전환).
- **버린 대안**: ① **Asia/Seoul 유지(W3 · W6)** — 요구와 어긋나고, DB가 내보내는 문자열(psql · clickhouse-client · TSV)이 KST 벽시계라 러너가 "시간대 없는 문자열 = KST"를 가정하게 된다(격자 러너 TSV 해석이 실제 사례) — DB를 UTC로 돌리라는 도구(pg_partman 공식 문서)와 어긋난 가정이 코드 곳곳에 쌓인다. ② **전부 UTC(tag_1d 버킷까지)** — 일별 막대가 KST 09:00에 시작해 화면의 "하루"가 사람의 하루와 9시간 어긋난다. ③ **처리 시간대는 UTC · 파티션만 KST** — pg_partman은 경계를 세션 시간대로 계산해 파티션만 KST로 둘 수단이 없고, 인자 없는 date_trunc 결과와 파티션 경계가 갈라져 보존 창 계산이 가장 오래된 파티션의 9시간을 잘라낸다. ④ **ClickHouse 인자만 ALTER MODIFY로 교체** — 26.8이 받지만 옛 파트의 KST 파티션 ID와 새 파트의 UTC 파티션 ID가 한 파티션에 섞여 파티션 식 조건 count가 틀린 값을 낸다(실측 44 대 40). ⑤ **PostgreSQL 설정만 UTC로** — pg_partman 유지 작업이 옛 KST 경계에 이어 일 세트에 하루 틈을, 월 세트에 30일로 밀린 경계를 만든다(실측).
- **파급**: PostgreSQL 순번 009 · 관리자 단계의 DB 기본 timezone · ClickHouse DDL 시각 컬럼 인자 교체와 전환 단계 · 설정 파일 3 · 코드 자리 — 전수는 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록이 갖는다. 테이블 · 객체 수 · API 계약 · 표시 규칙은 바뀌지 않는다. 옛 W3 판정(05_data_stores/03 §시각 컬럼 시간대 표기 · 05_data_stores/04 §일 경계 시간대 판정)과 W6 판정(09_tech_stack/03 §서버 timezone 판정)은 각 정본에 상태(대체됨 → ADR-27)를 달고 원문을 보존한다. 측정 기록은 당시 조건이라 고치지 않는다 — 파티션 단위 지표는 전환 전후를 직접 비교하지 않는다.

## ADR-28 — SW-09 gated · 비교 사본 정상형

- **상태**: 현행 — **부분 변경(ADR-32 · 2026-10-12)**. ① gated 게이트 · ② 정상형(기본 키 · 외래 키 · CHECK 3) · ④ run_result · ⑤ 가동 중 시작 거절은 그대로다. ⑤ 가동 중 시작 거절은 넣기만 남는다(③이 읽기 전용 데이터 정합성으로 바뀌었다 — ADR-33). 비교 사본의 일 파티션(pg_partman 선언 분할)이 **TimescaleDB hypertable 칸(1일)**으로 바뀌어 ③의 "파티션 준비" 함수(control_prepare_range)는 지워졌고(칸은 넣을 때 생긴다) **구간 압축 함수(control_compress_range)**가 더해졌다(마이그레이션 009). 원문은 보존한다.
- **맥락**: D-16 결정 2가 같은 센서 데이터를 Redis Stream으로 두 저장소에 똑같이 싣는 **직접 비교 실험**을 요구했다 — PostgreSQL에는 비교 실험 중에만 싣고, RDB를 제대로 쓰는 모양(기본 키 · 외래 키 · 검사 제약)으로 잰다. 옛 SW-09(ADR-17)는 on이면 상시 동시 적재 · 기본 off · 제약 없는 동형 테이블이었고, 그 실험 도구(대조 실험 러너)는 D-16 결정 4로 지워졌다.
- **결정**: ① SW-09 값을 **off · on · gated** 셋으로 두고 **기본을 gated**로 한다. gated는 on과 같은 COPY 구현(PostgresControlSink)을 주입하고, 그 앞에서 배치마다 Redis 게이트 cache:dual:active를 본다 — 열림이면 그 배치를 COPY하고 닫힘이면 건너뛴다. 게이트는 직접 비교 넣기 · 무결성 실행이 **구간을 비운 뒤** 켜고(값 runId · TTL 10초 · 2초마다 다시 쓴다) 종결 때 끈다 · flusher는 게이트를 500 ms 사본으로 읽고 읽기 실패면 직전 열림을 10초까지 믿는다. ② 비교 사본 plc_tag_raw_control을 **정상형**으로 고친다 — 기본 키 (device_id, tag_id, ts) · 외래 키 device · CHECK 3(NaN 아님 · ±1조 · 품질 7값) · BRIN 삭제(마이그레이션 007). ③ 비교 사본의 파티션 준비 · 구간 비우기 · 전체 지우기는 app_owner SECURITY DEFINER 함수로만 한다(app_rw에 TRUNCATE가 없다). ④ 직접 비교 결과는 run_result에 보관한다(008 · 추가 전용). ⑤ 넣기 · 무결성은 설비 가동이 꺼져 있어야 시작한다(웨이브 6). 기전 정본 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §gated 게이트 판정 · 스키마 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §지금 모양.
- **버린 대안**: ① **상시 on** — 평소 운영이 "나눠 관리" 모양이 아니게 되고 PostgreSQL 비교 사본이 설비 가동 데이터로 보존 7일 내내 자라 지우기 · 현황이 늘 PostgreSQL을 크게 보인다(D-16 버린 대안 ④). ② **실행이 SW-09를 on으로 바꾸고 api를 재기동** — 발표 중 비교 버튼마다 수십 초의 수집 결측이 생기고 진행 중 실행 · 화면 연결이 끊긴다. ③ **PostgreSQL 전용 소비자 그룹** — 두 그룹이 다른 속도로 소비해 측정 시점마다 행 수가 어긋난다(ADR-17 버린 대안 ② 그대로). ④ **동형(제약 없음) 유지** — "RDB를 제대로 쓰면"이 아니라 키 없는 RDB를 재고, 무결성 시험에서 PostgreSQL도 아무것도 막지 못해 비교가 성립하지 않으며, 조회 대결의 점조회가 BRIN 범위 스캔이 된다. ⑤ **게이트를 행의 시각으로 판정(구간 안 행만 COPY)** — 가동 행과 비교 행이 한 배치에 섞이면 배치를 행 단위로 쪼개야 해 "같은 배치 = 같은 행 집합" 원칙이 깨진다 — 대신 가동 중 넣기 · 무결성 시작을 거절한다.
- **파급**: SW-09 값 셋(정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) · 조합 제약 #11 — off에서 넣기 · 무결성 400) · ADR-08의 기록된 예외(판정은 sink 장식 한 자리 · health impl은 PostgresControlSink 그대로) · 키 cache:dual:active(캐시 계열 · TTL — [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)) · 마이그레이션 007 · 008 · 한계 등재 #28(실행 도중 설비 켜기) · #29(함수 허용 구간) · REQ-ING-15 · 19 · REQ-GEN-20~23 · ADR-17 일부 대체(상태 항목). 옛 대조 실험 결과(기록 035~053)는 동형 테이블 조건의 기록이라 고치지 않는다.

## ADR-29 — 설비 가동은 실행 중 Redis 봉인 키

- **맥락**: D-16 결정 3이 HMI 최소 화면에 **설비 가동 켜기 · 끄기**(기본 꺼짐 — 저절로 쌓이지 않게)를 넣었다. 그 전에는 센서 자동 생성을 환경변수 SENSOR_AUTOGEN과 재기동으로만 바꿨다(사용자 결정 2026-10-03). 켜고 끌 대상(가상 PLC 포트 · 모드 A 틱 · 수집기 폴링)은 collector 역할 프로세스 안에 있고, 버튼을 받는 표면은 api 역할에 있다(ADR-22).
- **결정**: ① 실행 중 상태는 Redis **봉인 계열** 키 ctl:plant:power(Hash state on · off · changed_at — TTL 없음)다 · 키가 없으면 기동 기본값 SENSOR_AUTOGEN을 따른다. ② 쓰는 쪽은 표면 하나(06_realtime #4)다 — 같은 상태면 쓰지 않고 다르면 원자 스크립트 하나로 상태 · 시각을 함께 쓰며 응답은 "적었다"다. ③ 따르는 쪽은 collector 역할(all 포함)의 적용기다 — 1초마다 키를 읽어 켜기(수집 정의 → 포트 → 틱 → 폴링) · 끄기(역순)를 하고, 켜기가 중간에 실패하면 앞서 켠 것을 되돌린다. ④ collector 역할은 **기동 때 키를 지운다** — 재기동은 늘 기동 기본값에서 시작한다. ⑤ 키를 읽지 못하면 지금 상태를 유지하고 표면은 503 realtime.latest_unavailable이다. ⑥ health run.sensorAutogen은 이 프로세스가 지금 실제로 만드는지(적용 상태)다. 키 정본 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · 기전 정본 [../06_pipeline/05_realtime_read.md](../06_pipeline/05_realtime_read.md) §설비 가동 · HMI 개요.
- **버린 대안**: ① **환경변수 + 재기동 유지** — 발표 중 켜기 · 끄기마다 api 재기동이라 수십 초 결측 · 진행 중 실행 소멸 · 화면 끊김이 생긴다. ② **표면이 SIM · Collector의 시작 · 정지를 직접 호출** — 역할을 나누면 api 프로세스에 SIM · Collector가 없어 키만 바뀌고 공장은 그대로이고, 프로세스 경계를 넘는 제어 채널이 따로 필요하다. ③ **캐시 계열 키(TTL · 축출 대상)** — 메모리 압박에서 키가 사라져 켜 둔 공장이 아무 신호 없이 기동 기본값(꺼짐)으로 돌아간다. ④ **기동 때 키를 남기기** — 켠 채 내린 스택이 재기동만으로 센서 데이터를 다시 쌓는다(사용자 결정 2026-10-03 "저절로 쌓이지 않게"). ⑤ **Pub/Sub 신호로 즉시 전환** — 재기동 · 연결 끊김 동안 놓친 신호는 영영 반영되지 않는다 · 1초 폴링이면 키 하나가 진실이다. ⑥ **PostgreSQL 설정 행** — 업무 DB가 실행 제어를 갖고, 1초 폴링이 PostgreSQL에 상시 쿼리를 더하며 PostgreSQL 불가가 공장 정지로 번진다.
- **파급**: 키 계열 ctl 신설(봉인 · 통제 칸 · DurableKeyClient 노출) · APP_ROLE collector에 설비 가동 적용(정본 [02_module_boundaries.md](./02_module_boundaries.md) 판정 표) · SENSOR_AUTOGEN의 뜻이 "기동 기본값"으로 바뀐다(스위치가 아니다 — 09_tech_stack/04) · 센서 데이터 지우기와 설비 켜기는 프로세스 안 잠금으로 서로를 막는다(한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) #30) · REQ-RLT-19 · RLT-10 · ADR-08의 "전환 = 환경변수 + 재기동"은 스위치에만 해당한다 — 설비 가동은 스위치가 아니라 실행 중 상태다.

## ADR-30 — 마이그레이션 새 기준선

- **맥락**: D-16 결정 4가 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구를 코드 · 저장소에서 지웠다. 옛 순번(PostgreSQL 001~011 · ClickHouse 001~009)에는 지운 테이블 · 함수와 옛 볼륨 이행 전용 코드(UTC 경계 재구성)가 들어 있었다. 규칙은 "적용된 순번을 고치지 않고 말미에 채번한다"이다.
- **결정**: **한 번뿐인 예외로 001부터 다시 쓴다** — PostgreSQL 새 기준선 001~005(bootstrap · master · guards · control · biz_command_log) 위에 같은 날 말미 006~008(tag_kind · 비교 사본 정상형 · run_result) · ClickHouse 001~007. 옛 볼륨은 이행하지 않고 **비운 뒤 처음부터 적용한다.** 이후 변경은 PostgreSQL 009 · ClickHouse 008부터 말미 채번이며 적용된 순번의 내용을 바꾸지 않는다. 정본 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md).
- **버린 대안**: ① **DROP 순번 덧붙이기(012~)** — 빈 볼륨이 지운 테이블 · 함수를 만들었다가 바로 지우고, 기준선을 읽는 사람이 삭제된 기능의 스키마를 계속 읽으며, 이행 전용 코드(옛 009)가 영영 남는다. ② **옛 볼륨 이행 경로 유지** — 이행을 검증하던 스냅샷 · 측정 도구가 지워져 검증 수단이 없다 · 잃을 것은 작다(센서 데이터는 보존 7일이고 마스터는 시드가 다시 만든다). ③ **번호는 두고 내용만 비우기** — 이력 이름은 맞지만 같은 순번이 볼륨마다 다른 스키마를 뜻하게 된다.
- **파급**: 옛 순번 이력이 남은 볼륨은 순서 검사가 거부한다 — 비우고 다시 적용한다 · ADR-27 ⑤의 재구성 절차 삭제(상태 항목) · 006~008도 같은 날 업무 방해 삭제(ADR-31)로 008의 part CHECK가 고쳐져 리드 마지막 검증에서 볼륨을 다시 적용했다 — 그 뒤로 내용 불변 · 측정 기록(docs/measurements)은 옛 스키마 조건의 기록이라 고치지 않는다.

## ADR-31 — 직접 비교에서 업무 방해 실험을 뺀다

- **상태**: 현행 — **부분 변경(ADR-33 · 2026-10-12)**. 업무 방해를 뺀 결정은 그대로다. 남은 3부분 중 ③ 무결성이 **데이터 정합성**(consistency)으로 바뀌어 지금 3부분은 넣기 · 조회 대결 · 데이터 정합성이다(run_result part CHECK — 마이그레이션 010). 원문은 보존한다.
- **맥락**: D-16 결정 2의 직접 비교는 처음에 넷이었다 — 넣기 · 조회 대결 · 무결성 · **업무 방해**(센서를 쏟는 동안 업무 명령 1건의 처리 시간을 게이트 켬 · 끔으로 대조 — "PostgreSQL 하나로 대 나눠서"의 업무 쪽 답). 센서 넣기 강도 셋(초당 2만 · 5만 · 최대)으로 실측했다(사용자 결정 2026-10-11 같은 날).
- **결정**: 업무 방해를 **지운다** — 직접 비교는 넣기 · 조회 대결 · 무결성 3부분이다(공용 계약 부분 3 · run_result part CHECK 3 · 표면 · 화면 · 문서에서 삭제). 옛 run_result의 업무 방해 행은 남지만 최근 결과(09_datagen #6)가 읽지 않는다.
- **버린 대안**: ① **한 강도로 그대로 보이기** — 같은 강도에서도 느린 쪽(95%) 값이 실행마다 크게 흔들려 화면의 "몇 배 느려요"가 다음 실행에서 뒤집힌다 · 가운데 값은 두 조건이 거의 같았다 — 가운데 값을 보이면 "차이 없음", 느린 쪽을 보이면 흔들림이라 어느 쪽도 결론이 아니다. ② **최대 강도로 비교** — 게이트를 켠 쪽은 COPY까지 하느라 센서 발행 자체가 느려져 두 조건의 센서 부하가 같지 않다 — "업무가 느려졌다"가 저장소 차이인지 부하 차이인지 가를 수 없다. ③ **업무 처리를 다른 프로세스로 떼어 재기** — 로컬 기본(APP_ROLE all) · 발표 노트북 구성과 달라 화면이 보일 상황이 아니고, 반복 · 판독 도구는 D-16 결정 4로 지웠다. 수치는 커밋 · 메모리 프로파일 · 용량 티어 · 스위치 상태 4요소를 갖춘 기록이 아니라 본문에 올리지 않는다.
- **파급**: 실행 부분 집합 3(07_api/09 · 06_pipeline/10) · 008 part CHECK 3(ADR-30) · D-16 상태 줄(부분 개정)이 방향을 적고 이 ADR이 구조 변경을 적는다 · 업무 방해가 답하려던 질문(나눠 관리할 때 업무가 덜 방해받는가)은 직접 비교의 결과로 답하지 않는다 — 화면이 그 질문을 어떻게 보이는지는 08_screen 정본이 갖는다 · 노트북 한 대 · api 한 프로세스가 센서 발행과 업무 처리를 함께 맡는 구성의 한계로 기록한다.

## ADR-32 — 직접 비교 비교 사본은 TimescaleDB hypertable · 열 압축

- **맥락**: 사용자가 직접 비교의 PostgreSQL 쪽을 TimescaleDB로 바꾸고 압축을 켜기로 결정했다(2026-10-12 · D-05 부분 개정). 비교 사본 plc_tag_raw_control은 pg_partman 일 파티션 위의 일반 행 저장(마이그레이션 004 · 007)이었다. TimescaleDB는 PostgreSQL 확장이라 같은 서버 · 같은 SQL · 같은 기본 키 · 외래 키 · CHECK를 그대로 쓰면서 시간 칸 나누기(hypertable)와 칸 단위 열 압축(columnstore)을 더한다. 공식 이미지(postgres 18.6-alpine)에는 TimescaleDB가 없다.
- **결정**: ① 파생 이미지에 **TimescaleDB를 소스 빌드**한다(판 · 이미지 이름은 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §버전 고정표 · TSL 기본 빌드 — 압축 포함 · 원격 보고 끔 · **UMASH 해시를 반드시 켠다** — 여러 열로 묶는 벡터 집계(VectorAgg)의 조건이고, arm64는 컴파일러 기본값에 crypto 명령이 없어 조용히 빠지므로 +crypto로 켜고 빠지면 빌드를 실패시킨다 · 수단 개정 2026-10-12) · shared_preload_libraries에 timescaledb · 확장 생성은 migrate 관리자 단계. ② 마이그레이션 **009**가 비교 사본을 다시 만든다 — 컬럼 7 · 순서 · 기본 키 · 외래 키 · CHECK 3은 007 그대로 · **hypertable 칸 1일**(경계 UTC 자정 — ClickHouse 일 파티션과 같은 날 · 기본 시각 인덱스는 만들지 않는다 — 키 하나) · **열 압축 설정**(묶음 device_id · tag_id · 묶음 안 ts 순) · **보존 정책 7일**(칸 통째 삭제 · 작업 주체 app_owner) · pg_partman 등록 해제. ③ **압축 시점은 넣기 검증 단계 하나**다 — ClickHouse 병합(FINAL)과 같은 자리에서 그 구간 칸을 압축한 뒤 행 수 · 크기를 재고, 조회 대결은 압축된 칸을 읽는다. **자동 압축 정책은 두지 않는다.** ④ 압축 · 구간 비우기는 app_owner SECURITY DEFINER 함수(control_compress_range · control_clear_range — 통째로 덮은 칸은 drop_chunks · 걸친 칸은 그 구간만 DELETE · 압축 칸 DELETE의 푸는 행 상한은 그 함수 안에서만 없앤다) · 파티션 준비 함수는 지운다(칸은 넣을 때 생긴다). ⑤ 크기 · 행 수는 TimescaleDB 함수로 읽는다 — 칸별 chunks_detailed_size · 전체 hypertable_size · 추정 approximate_row_count(압축 뒤 통계를 다시 모은다). ⑥ 조회 대결의 시간 묶음은 **time_bucket**으로 쓴다(수단 개정 2026-10-12) — 압축 칸을 행으로 풀지 않고 열 묶음째 집계하는 길(VectorAgg)을 탄다 · 같은 UTC 시간 칸이라 결과는 date_trunc와 같다 · 날짜 묶음(KST 하루)은 시간대를 쓰는 time_bucket이 벡터 집계를 타지 않아 기존 날짜 변환 그대로다. 공식 문서는 크기 함수가 압축 데이터를 세는지 적지 않는다 — 리드 시험 볼륨에서 압축 뒤 chunks_detailed_size의 칸 크기가 chunk_compression_stats의 압축 뒤 크기와 같은 크기대로 나오고 pg_inherits 합은 거의 0이었다(2026-10-12 — 구조 사실 · 수치는 인용하지 않는다). 압축은 convert_to_columnstore(2.18부터 compress_chunk 대체)를 부른다. 스키마 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §지금 모양 · 순번 [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) · 버전 [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md).
- **버린 대안**: ① **공식 timescale/timescaledb 이미지로 교체** — 그 이미지가 따르는 PostgreSQL 부 버전이 버전 고정표의 18.6과 따로 움직이고 pg_partman이 없어 빈 볼륨에서 004가 실패한다 — 업무 테이블까지 실린 서버의 기준이 확장 하나 때문에 바뀐다. ② **압축 끔(hypertable만)** — 칸 안 저장이 여전히 행 단위라 크기 · 대량 집계가 일반 PostgreSQL과 거의 같아 "확장을 붙이면?"의 답이 되지 않는다(사용자 결정 — 압축 켬). ③ **자동 압축 정책(compress_after)** — 넣는 도중 백그라운드 작업이 과거 구간 칸을 압축해 넣기 시간 · 묶음 시간이 실행마다 흔들리고, 압축 칸에 들어가는 COPY가 유일 검사를 풀어서 하게 된다. ④ **넣을 때 바로 열로 쓰기(direct compress)** — 넣기 비용이 압축 비용과 섞여 두 저장소의 넣기 축을 같은 조건으로 읽을 수 없고, 칸 하나의 마지막 정렬 상태가 실행마다 다르다. ⑤ **pg_inherits로 칸 크기 합산(옛 쿼리 유지)** — 압축 데이터는 칸 표가 아니라 따로 둔 압축 표에 있어 압축 뒤 크기가 거의 0으로 보인다. ⑥ **내부 카탈로그(_timescaledb_catalog)로 칸 ↔ 압축 표 매핑** — 판마다 구조가 바뀌어(확장 판이 오르며 압축 칸 명명 · 카탈로그 열이 달라졌다) 확장 업그레이드 때 지표 수집이 조용히 깨진다. ⑦ **UMASH 없이 빌드(첫 빌드 — 2026-10-12 오전)** — 설비 · 태그 · 시간처럼 여러 열로 묶는 대량 집계가 압축 칸을 행으로 풀어 한 줄씩 집계해 일반 PostgreSQL과 비슷한 시간이 나왔다("TimescaleDB로 바꿨는데 왜 비슷한가"의 원인 — 리드 실측 · 수치는 기록이 아니다).
- **파급**: D-05 상태 줄(무엇과 비교하는가) · ADR-03 · ADR-28 상태 항목(부분 변경) · 마이그레이션 009(ADR-30의 말미 채번 규칙대로) · 버전 고정표 · 공식 참조(TimescaleDB 문서) · 지표 수집의 hypertable 행(크기는 압축 포함 · 죽은 행 · 청소 횟수는 칸 표 합) · 직접 비교 화면 문구(PostgreSQL(TimescaleDB) · 넣는 중 디스크 툴팁) · 옛 대조 기록 035~053은 일반 PostgreSQL 동형 테이블 조건이라 고치지 않는다 — 학습 화면은 그 기록을 그대로 보인다 · pg_partman은 빈 볼륨 재생(004)에만 쓰이고 관리 대상이 없다.

## ADR-33 — 직접 비교 ③은 데이터 정합성(두 저장소 1분 칸 대조)

- **맥락**: 직접 비교 ③은 무결성 시험이었다 — 규칙 어긴 데이터 3종(같은 데이터 두 번 · 등록 안 된 설비 · 고장 값)을 보내 PostgreSQL이 막고 ClickHouse가 받는 것을 보였다. 사용자가 이를 **두 DB에 같은 데이터가 있는지 대조하는 데이터 정합성**으로 바꾸기로 결정했다(2026-10-12 · D-16 부분 개정). 같은 날 사흘치 넣기에서 PostgreSQL COPY가 시간 제한을 넘겨 묶음이 빠졌고, 넣기 결과(두 저장소 구간 행 수)는 합계만 보여 어디가 빠졌는지 알 수 없었다.
- **결정**: ① 대상은 마지막 **완료** 넣기 구간이다(조회 대결과 같은 사전 확인 — 409 datagen.compare_no_data · details.part consistency) · 읽기만 한다(SW-09 · 설비 가동 조건 없음 · 게이트를 켜지 않는다). ② 두 저장소에서 구간을 **1분 칸**(epoch 1분 배수 · UTC)마다 센다 — 행 수와 **값 체크섬 floor(value × 1000)의 정수 합**(부동소수 합은 더하는 순서에 따라 끝자리가 갈려 두 저장소를 맞출 수 없다). ③ 앱이 맞춘다 — 행 수가 다른 칸은 모자란 쪽의 **빠진 구간**(이어진 칸끼리 묶는다 · 앞 5개 + 전체 수) · 행 수가 같은데 체크섬이 다르면 **값이 다른 칸** · UTC 날(두 저장소의 하루 단위)마다 행 수 · 합계 · 보낸 행(넣기 결과) · 각 저장소가 구간을 다 세는 데 걸린 시간. ④ 단계 넷 — 넣은 구간 확인 · ClickHouse에서 세기 · PostgreSQL에서 세기 · 두 DB 맞춰 보기. ⑤ 결과 계약 part consistency(공용 계약 CompareConsistencyResult) · run_result part CHECK를 ingest · query · consistency로 바꾸고 옛 무결성 결과 행은 지운다(마이그레이션 010). ⑥ 무결성 시험 행 생성 · 시험 창(UTC D−6 13~14시) · 시험용 설비 대상은 지운다. 계약 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) · 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) · 화면 [../08_screen/10_lab_screen.md](../08_screen/10_lab_screen.md).
- **버린 대안**: ① **행 단위 키 대조(두 저장소 행을 키로 맞춤)** — 사흘치 6천만 행을 두 DB에서 꺼내 앱이 맞춰야 해 메모리 · 시간이 화면 한 번의 대조로 감당되지 않는다 — 1분 칸이면 사흘치 4,320칸이다. ② **값 합(sum(value))을 그대로 비교** — 같은 행이라도 두 엔진의 더하는 순서가 달라 끝자리가 갈리고 "값이 다르다"가 늘 뜬다. ③ **무결성 시험을 남기고 대조를 더하기** — 사용자가 고르지 않았다 · 패널 한 장에 두 가지를 담으면 한 눈 화면 원칙(D-15 · D-16 결정 6)이 깨진다. ④ **넣기 결과의 행 수만 보이기** — 합계가 같아도 서로 다른 행이 빠지고 늘어 상쇄될 수 있고, 다르면 어디가 빠졌는지 모른다.
- **파급**: 실행 부분 3의 이름(07_api/09 · 06_pipeline/10 · 공용 계약 COMPARE_PARTS) · 010 part CHECK · ADR-31 상태 항목 · ADR-28 ⑤(가동 중 거절은 넣기만) · D-16 상태 줄이 방향을 적고 이 ADR이 구조를 적는다 · PostgreSQL 규칙의 이득(무결성)은 직접 비교 화면에서 빠진다 — 비교 사본의 키 · 참조 · 값 규칙은 그대로 남아 넣기의 COPY 실패 이유가 된다 · **대조가 드러낸 기존 결함** — COPY 시간 제한(창 폭의 절반)을 넘긴 묶음은 실패로 세지만 서버가 이미 받은 COPY를 커밋하는 경우가 있다(같은 실행에서 실패 7 · 실제로 빠진 묶음 2 — 리드 실측 2026-10-12) — 넣기 결과의 PostgreSQL 실패 수는 빠진 행의 상한이지 같은 값이 아니다(후속 판정 등재).

## ADR과 전역 계약

전역 계약 REQ-GLB가 "무엇이 참이어야 하는가"라면 ADR은 "무엇으로 그것을 참으로 만드는가"다. 계약을 강제하는 ADR만 적는다.

| REQ-GLB | 계약 요지 | 강제하는 ADR |
|------|------|------|
| 02 | 시각 저장 epoch · 표시 변환 1회 | ADR-27 |
| 03 · 04 | Stream 경계 · 경계 횡단 경로 하나 | ADR-06 |
| 05 · 06 | XACK 규칙 · 결정적 토큰 | ADR-09 · ADR-14 |
| 08 · 09 | 키 접두 생존 정책 · 실패 전략 이원화 | ADR-05 · ADR-13 |
| 10 | 백프레셔 명시화 | ADR-21 · ADR-23 |
| 11 · 12 | 저장소 책임 · 분기 | ADR-03 · ADR-17 · ADR-26 · ADR-28 |
| 14 | 두 DB를 묶지 않는다 | ADR-16 |
| 16 | 계측 우선 | ADR-08 · ADR-20 |
| 19 | 127.0.0.1 바인드 | ADR-18 |
| 20 | CPU 바운드 격리 | ADR-25 |
| 21 | 데이터 계약 결합 | ADR-01 · ADR-04 |
| 22 | 실측 후 분리 | ADR-22 |
| 25 · 26 · 27 | 요청 출처 방어(CORS 단일 오리진 · Host 대조 · WebSocket Origin · 상태를 바꾸는 POST의 JSON 본문 · BFF Origin) | ADR-02 |

- 검산: 걸린 REQ-GLB = 02 · 03 · 04 · 05 · 06 · 08 · 09 · 10 · 11 · 12 · 14 · 16 · 19 · 20 · 21 · 22 · 25 · 26 · 27 = **19** · 표 행 **13** · 옛 13(세 쓰기)은 결번(D-16)
- 이 표에 없는 ADR(07 · 10 · 11 · 12 · 15 · 19 · 24 · 29 · 30 · 31)은 전역 계약이 아니라 도메인 계약(REQ-RLT · REQ-MST · REQ-ING · REQ-COL 등)이나 구조 전용 불변식을 강제한다(ADR-11은 폐지) — 검산 31 − 21(표에 나온 ADR: 01 · 02 · 03 · 04 · 05 · 06 · 08 · 09 · 13 · 14 · 16 · 17 · 18 · 20 · 21 · 22 · 23 · 25 · 26 · 27 · 28) = **10**

## 후속 판정 등재

ADR이 결정을 내렸지만 값이나 인접 판정이 남은 자리다.

| ADR | 남은 것 | 확정 자리 |
|------|------|------|
| ADR-09 | B · C안 비교 결과 · fan-in 배치 토큰 재료 | S3 실측 · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4) |
| ADR-10 | 최종안 · 확정 뒤 SW-11 기본값 · 존속 | S6 실측 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md)(리드) |
| ADR-17 | 구간 count 대조 절차(대조 실험 자원 동일화 값은 대조 실험과 함께 D-16 폐지) | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)(W3) · [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전 |
| ADR-21 | 컨슈머 랙 산출식 · Stream 점유 메모리 해석 | **W6 닫힘** — lag + pending · 점유 메모리 = redis_prefix_memory_bytes · [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md)(W3) |
| ADR-23 · ADR-24 | 히스테리시스 폭 · 유지 시간 · 강화 계수 | S6 실측 · [06_backpressure_failure.md](./06_backpressure_failure.md) |
| ADR-26 | 명령 경로의 지연 · 처리량 · Redis 장애 시 가용성(direct 대 stream) · 대기 상한 · 유효 창 · 업무 명령 MAXLEN 검산 | EXP-46(폐지(D-16) — 지금 확정 수단 없음) · [05_latency_budget.md](./05_latency_budget.md) §업무 쓰기 명령 경로 구간 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| ADR-27 | pg_partman 워커 세션 시간대(api · datagen 컨테이너 TZ는 리드 판정 UTC로 닫힘 · 옛 전환 소요 시간은 전환 절차와 함께 D-16 삭제) | [../05_data_stores/09_migrations_seed.md](../05_data_stores/09_migrations_seed.md) §미확인 · 미설계 등재 · 리드 판정 |
| ADR-28 | 넣기 발행 속도 상한(지금 없음)과 COPY 타임아웃의 관계 · 실행 도중 설비 켜기(한계 등재 #28) · 넣기 · 조회 대결의 성능 수치(4요소 기록 없음 — 미확인) | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §gated 게이트 판정 · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| ADR-29 | 역할을 나눴을 때 지우기 잠금(한계 등재 #30) · 수집기 적용을 api가 모르는 구성의 HMI 개요 실측 초당 개수 | [08_scaling_roadmap.md](./08_scaling_roadmap.md) 1단계 진입 때 · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| ADR-32 | 압축 설정(묶음 · 정렬 열) 대안 비교 · 압축 시간 · 압축 뒤 넣기 · 조회 · 크기 수치(4요소 기록 없음 — 미확인) · 압축 칸에 무결성 시험을 넣을 때의 비용 | [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §지금 모양 |
| ADR-33 | COPY 시간 제한을 넘긴 묶음이 실패로 세지는데 서버가 커밋하는 경우(실패 수 과대) — 시간 초과 때 서버 쪽 취소로 "실패 = 0행"을 맞출지 · 대조가 실제 빠진 행의 정본이다 | [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §gated 게이트 판정 · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 |

- 검산: 등재 행 = **11** · 옛 ADR-11 행은 폐지(D-16)로 삭제

## D와 ADR의 경계

D-NN이 방향을 정하고 ADR이 그 방향을 구조로 강제한다. 아래는 D에서 파생된 ADR의 대응이다 — 같은 결정을 양쪽에 채번하지 않는다.

| D | 방향(제품 · 학습) | 파생 ADR(구조 · 설정) |
|------|------|------|
| D-01 · D-04 | 학습 목표 2축 · 분기(업무 쓰기 Redis 경유 개정 · D-16 ②계층 폐지 포함) | ADR-03 · ADR-11(폐지) · ADR-16 · ADR-26 |
| D-02 | 로컬 전용 | ADR-18 · ADR-20 · ADR-22 |
| D-05 · D-12 | 대조군 도입 · S3 적재 · S5 측정 | ADR-17 |
| D-06 | 스위치 1급 요구사항 | ADR-08 · ADR-10(SW-11) |
| D-08 | SW-10 유지 | ADR-24 |
| D-10 | 4요소 · 3회 중앙값 | ADR-18(재현 가능한 볼륨) · ADR-20(정밀 세션) |
| D-16 | 웹 7화면 · HMI 최소 화면 · 불필요 기능 삭제 · 직접 비교(같은 날 업무 방해 삭제) | ADR-28 · ADR-29 · ADR-30 · ADR-31 |

- 검산: 대응 행 = **7** · D 없이 선 ADR(원본 기술 선정 · 보정 · 사용자 요구) = 01 · 02 · 04 · 05 · 06 · 07 · 09 · 12 · 13 · 14 · 15 · 19 · 21 · 23 · 25 · 27 = **16** — 표에 나온 ADR(중복 제거) 03 · 08 · 10 · 11 · 16 · 17 · 18 · 20 · 22 · 24 · 26 · 28 · 29 · 30 · 31 = **15** · 16 + 15 = **31**
- **판정 기준은 하나다** — 무엇을 배우고 어디까지 만들고 어떤 순서로 재는가를 바꾸면 D, 그것을 어떤 구조 · 설정으로 강제하는가를 바꾸면 ADR이다. 애매하면 ADR로 보내고 D는 방향만 링크한다([../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) §D와 ADR의 경계).

## 개정 규칙

| 상황 | 규칙 | 어기면 |
|------|------|------|
| 결정을 뒤집을 때 | 새 ADR을 말미에 채번하고 원 번호에 상태(대체됨 → ADR-NN)를 단다 · 원문 보존 | 왜 한 번 그렇게 갔다가 되돌렸는지가 사라진다 |
| 잠정 결정이 확정될 때(ADR-10) | 같은 결정이면 상태를 현행으로 바꾸고 날짜를 적는다 · 다른 결정이면 대체 | 잠정 표기가 남아 확정된 결정을 재론하게 된다 |
| S3 비교 결과가 ADR-09를 뒤집을 때 | 대체 절차 · 비교 기록을 근거로 인용 | 실측이 결정을 조용히 고쳐 as-built와 결정이 어긋난다 |
| 수단만 바뀔 때 | 원 번호 본문을 고치고 개정 사실을 적는다 · 결정과 버린 대안 유지 | 수단 변경이 결정 대체로 오독된다 |
| 다른 문서가 결정을 서술할 때 | 번호를 링크하고 결론만 적는다 · 버린 대안의 논쟁을 옮기지 않는다 | 같은 논쟁이 흩어져 한쪽만 개정된다 |

- 검산: 규칙 = **5**

## 관련 문서

- [README.md](./README.md) — ADR 선점표 · 폴더 목차
- [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md) — D-NN 채번 정본 · D와 ADR의 경계
- [../09_tech_stack/06_decisions_rationale.md](../09_tech_stack/06_decisions_rationale.md) — 기술 선정 근거 · 버전
- [02_module_boundaries.md](./02_module_boundaries.md) — 경계 · 배정 · 포트 확정 표
- [06_backpressure_failure.md](./06_backpressure_failure.md) — ADR-10 · ADR-21 · ADR-23 · ADR-24의 정책 서술
- [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) — 말미 채번 · 결번 보존 규약
