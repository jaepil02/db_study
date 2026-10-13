# GEN — 라이브 실행 제어 · 직접 비교 · 센서 데이터 표면 (09_datagen)

> **대상**: GEN 도메인 표면 — **라이브 실행 제어 #2~#5**(EXP-FLOW 흐름 시연 · EXP-LAB 직접 비교의 시작 · 현재 · 단건 · 중단 — 실행 객체 스키마 · status · step status · 매개변수 · 동시 실행 하나 datagen.run_in_progress/409 · 중단 · 실패 의미 · compare 진행 중 결과) · **직접 비교 최근 결과 #6 · 센서 데이터 현황 · 지우기 #7 · #8(D-16)** · 생성기 실행 제어 표면 판정 · 실행 중 주입 제어 표면 판정 · 옛 #1 부하 주입 표면 결번
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — compare ingest 단계 detail prepare의 **partitionsCreated 삭제**(칸은 넣을 때 생긴다) · verify에 **compressed** · 경고에 **TimescaleDB 압축 실패**(크기가 압축 전 값) · 넣기 최종 크기 병합 뒤 → **ClickHouse 병합 · PostgreSQL 압축 뒤** · 넣는 중 bytes PostgreSQL pg_total_relation_size 합 → **칸 크기 chunks_detailed_size 합**(병합 · 압축 전) · §직접 비교 도입에 비교 사본 모양 한 문장 · §과거 시각 창 PostgreSQL 일 파티션 plc_tag_raw_control_pYYYYMMDD · TRUNCATE · 보존 partman → **hypertable 일 칸 · drop_chunks · TimescaleDB 보존 정책** · #7 postgres 자식 파티션 크기 합 → **hypertable_size**(압축 포함) · 행 추정 approximate_row_count — 단계 수 · 결과 필드 · 표면 · 에러 코드 불변(결과 계약 불변)
> **개정일**: 2026-10-11 — **⑤ 실시간 그래프**(사용자 결정 2026-10-11 — 세 패널 모두 실시간 · 공용 계약 runs.ts 불변) — 실행 객체 result "단계가 끝날 때마다" → **compare는 진행 중에도 바뀐다** · **§진행 중 결과(compare) 신설**(부분 3의 바뀌는 때 · 넣기 중간값 필드 6의 넣는 중 · 끝난 뒤 뜻 — 각 DB에 들어간 행은 Ingest 계측 차분 · 초당 행은 적은 쪽 · bytes는 2초마다 · 첫 값 전 null · 병합 전 · 마지막 읽기 뒤 조각이 빠진 순간값 · A형 둘) · 공통 규약 실행 상태 자리 · #3 · #4 · #6에 진행 중 result와 **보관은 완료만** — 표면 · 필드 · 에러 코드 수 불변
> **개정일**: 2026-10-11 — 웹 코드 대조(d5-screen 정정) — #6 호출 화면 EXP-LAB · LRN-ARCHITECTURE → **EXP-LAB**(LRN-ARCHITECTURE는 기록 판독만) · #2 에러 칸에 realtime.latest_unavailable/503 · #2 · #5 캐시 칸에 Origin 확인 — 표면 수 불변
> **개정일**: 2026-10-11 — **웨이브 6 코드 수정 반영**(r5-code 검수 H1 · H2 · M1~M4 · 리드 보안 판정 §5-4 · 공용 계약 runs.ts · data.ts 확장) — #2 단계 6 → **7**(③′ 지우기 중 확인 신설 · ③″ compare 사전 확인에 **설비 가동 켜짐 400 path plant** · 409 details에 **reason 3값**) · ② 본문 검증에 Content-Type application/json · 공통 규약 게이트 · 인증 행 갱신(**JSON 본문 검사 as-built** — 코드 반영 대기 문구 삭제) · #5 본문 {} 불릿 · compare 단계 detail에 backlogWaitMs · warning · flow prepare {devices, tags, tagsCreated}(flow 전용 태그 50) · §직접 비교 시작 전 거절 갱신 · B형 셋(가동 중 거절 · 적체 0 대기 · 마지막 넣기 미완료) · **§과거 시각 창 경계 KST 자정 → UTC 자정**(넣기 UTC D−4 00:00 · 무결성 UTC D−6 13:00 — 넣기 사흘 창은 일 파티션 통째 비우기) · **#6 부분별 최근 완료 1 + attempts**(최상위 필드 3 → **4**) · **#7 compareRows 신설**(필드 5 → **6**) · **#8 단계 7 → 8**(지우기 잠금 · 이유 2 → **3** stream_backlog) · 미설계 행 JSON 본문 삭제(3 → **2**행)
> **개정일**: 2026-10-11 — **D-16 직접 비교 · 센서 데이터 표면 신설**(사용자 결정 2026-10-11 결정 2 · 5 · 공용 계약 packages/shared runs.ts · data.ts · 업무 방해는 사용자 결정으로 삭제) — 실행 종류 flow → **flow · compare**(#2~#5 공용 · GEN-13) · **#6 GET /api/v1/runs/latest?type=compare**(부분별 최근 종결 · run_result) · **#7 GET /api/v1/data/sensor/stats · #8 POST /api/v1/data/sensor/purge**(GEN-14 · data.purge_blocked/409) 신설 — 표면 4 → **7** · §직접 비교 · §센서 데이터 신설 · 단계 종류 1 → **4**(flow · compare ingest · query · integrity) · 매개변수 키 4 → **6** · 결과 행 1 → **4** · 중단과 실패 사건 3 → **4** · #2 에러에 datagen.compare_no_data/409 · A형(재기동 기록 없음)에 compare 결과 보관 예외 · 상태를 바꾸는 POST JSON 본문(REQ-GLB-27 — #5 · #8 코드 반영 대기) · 미설계 등재 저장소 불가 500
> **개정일**: 2026-10-11 — **D-16 옛 perf 직접 재 보기 · 측정 도구 · 로그인 · 권한 삭제**(사용자 결정 2026-10-11) — **#1 POST /api/v1/ingest/bulk(모드 C 부하 주입) 결번** · §부하 주입 공통 규약 · §#1 삭제 · 라이브 실행 종류 perf(GEN-11) 삭제 → **flow 하나** · 공통 규약 인증 · 인가 · 레이트 리밋 행 정리(10 → **9**) · #5 행 5 → **4** · 단계 종류 2 → **1** · 매개변수 키 5 → **4**(값 21 → **17**) · 결과 행 3 → **1** · 중단과 실패 사건 5 → **3**(cleanup 열 삭제) · perf 응답 예시 · 미확인 모드 C · 게이트 · 한도 4행 삭제 · 표면 요약 역할 열 → 인증 열 — 표면 5 → **4** · (리드 판정 — 도메인 11 → 8 · 대상 문서 파일 삭제) 원천의 권한 매트릭스(삭제) 인용 삭제 · Host 대조 AUT-07 → **REQ-GLB-26** · D-16 정리(d4) — 지운 절을 가리키던 § 참조 교정(원천 §모드 C 표면 삭제 · GEN-07 · 11 결번 표기) · D-16 정리(d4 전역 sweep) — 원본에 없는 표면 판정 실험 콘솔 → 화면
> **개정일**: 2026-10-03 — 센서 자동 생성 게이트(사용자 결정 2026-10-03 · SENSOR_AUTOGEN — 이름 정본 09_tech_stack/04) — 공통 규약(라이브 실행) 게이트 행에 **SENSOR_AUTOGEN과 무관**(off여도 flow 실행은 돈다) — 표면 · 항목 수 불변
> **개정일**: 2026-10-03 — 사용자 선택 2026-10-03 — 조회 경로 보이기 · D-15(설계 정본 .omc/plans/web-junior-redesign.md §9) — flow 매개변수 **readsPerSec 신설**(0 · 5 · 20 · 50 · 기본 20 — 조회 3종을 publish 동안 섞는다 · 기전 06_pipeline/10) · 매개변수 키 4 → **5** · 값 수 17 → **21** · flow 결과 수치 8 → **9**(**readsSent**) · publish detail에 readsSent · readsFailed · readsSkipped · 응답 예시 params · result에 반영 · 라이브 실행 판정 행의 "닫힌 매개변수 4키" → 개수 없이 §매개변수 인용 — 표면 · 기능 · 에러 코드 수 불변
> **개정일**: 2026-10-03 — D-15 학습자 눈높이 한 화면(사용자 지시 2026-10-03 — 08_screen/08_evidence_screens) — 생성기 원격 손잡이 반론 불릿 측정 조건 서랍 → **각주 툴팁** — 표면 · 기능 · 에러 코드 수 불변
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03) — 생성기 원격 손잡이 반론 불릿의 실험 콘솔(EXP-CONSOLE) → **두 실증 화면 · 측정 조건 서랍** — 표면 · 기능 · 에러 코드 수 불변(api 표면은 지우지 않는다 — D-14 결정 1)
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — flow bizPerSec 뜻 이름 토글 짝 → **시연 전용 설비 DEMO-FLOW-DEV에만 새 이름 명령**(되돌림 없음 · 운영 행 불변 · 명령 1건 = 1 · prepare 생성 명령은 commandsSent에 세지 않는다) · #5 표 행 4 → **5**(cleanup 진행 중 running — 중단 무시) · §중단과 실패 사건 3 → **5**(정상 경로 정리 실패 → failed · cleanup 중 중단 요청 → completed) · 중단 단계 표지(끝난 단계 done 유지 · 미시작 skipped · 진행 중 0~1개 stopped) · PostgreSQL 취소 = 전용 연결 pid · 레이트 리밋 폴링 항 = 실행 패널 탭 수(현행 참고 2) × 60 · 10^8 예상 디스크는 상한값 · flow 예시 검산 불릿
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 "시작 · 중단 · 완료 표시 · 소요 시간" · 리드 판정) — **표면 #2~#5 신설**(POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop · GEN-11 · 12 · 인증 전 무인증 · 뒤 시작 · 중단 ENGINEER · ADMIN · 조회 전원 · BFF no-store · 호출 화면 EXP-PERF · EXP-FLOW) · **§실행 객체**(필드 10 · status 5 · step status 6 · elapsedMs 서버 계산) · **§매개변수**(perf maxExponent · flow pps · durationSec · bizPerSec) · 에러 코드 **datagen.run_in_progress/409** 인용(정본 11_glossary/02) · 옛 서술 "GEN이 가진 표면은 하나뿐이다" → **표면 5(부하 주입 1 + 라이브 실행 4)** · 표면 요약 검산 1 → **5**(원본 1 + 신설 4) · 원본에 없는 표면 판정에 라이브 실행 행(두지 않는 생성기 실행 제어와 가르는 축) — 옛 판정(생성기 실행 · 상태 조회 표면 두지 않음)은 모드 A~D에 대해 유지
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 게이트 true 기동 시 **경고 로그 1줄** · 레이트 리밋 class **bulk_ingest** · 한도 관계 R2 — 표면 수 불변(정본 12_security/02 · 03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 기록 칸 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — DATAGEN_BULK_ENABLED를 환경변수 정본(09_tech_stack/04)에 등재했다
> **원천**: 원본 architecture.md §9.3 · §11 · §18(커밋 ff66a37) · 원본 data_flow.md §11 · §11.1 · §12.1 · §14.1(커밋 ff66a37) · REQ-GEN-02 · 05 · 16 · 18 · 19 · REQ-GLB-10 · 21 · D-16(사용자 결정 2026-10-11) · ADR-21 · ADR-23 · D-06 · D-07 · 사용자 요구 2026-09-28(라이브 실행 제어) · [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-12(옛 GEN-07 · GEN-11 — D-16 결번) · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어 · 라이브 실행 기전 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) 실행 수명 객체 · 동일 쿼리 5종 · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 3단계 · docs_plan.md 실행 계획 보정 #11 · 웨이브 인계 W5 07_api 행(생성기 실행 제어 · 실행 중 주입 제어) · 사용자 결정 2026-10-11(⑤ 실시간 그래프) · as-built 코드 apps/api/src/modules/runs/compare-runner.ts(liveIngestResult · TimelineSampler onSample · LIVE_BYTES_EVERY_MS) · compare-stores.ts(CompareStores.liveBytes) · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32 · as-built 코드 compare-runner.ts(COMPARE_STEPS · COMPRESS_WARNING) · compare-sql.ts(PG_CHUNK_BYTES · PG_TOTAL_BYTES · PG_ESTIMATE_ROWS)

GEN이 가진 표면은 **일곱이다** — 라이브 실행 제어 넷(#2~#5 · GEN-12 · 13) · 직접 비교 최근 결과(#6 · GEN-13) · 센서 데이터 현황 · 지우기(#7 · #8 · GEN-14). 분산 처리 모니터링 화면(EXP-FLOW)이 흐름 시연 실행을, 직접 비교 실험 화면(EXP-LAB)이 직접 비교 실행을 시작 · 관찰 · 중단한다(사용자 요구 2026-09-28 · D-16). 에러 네임스페이스는 datagen이고 지우기의 막힘만 data다(정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §네임스페이스 배정 규칙 — 기록된 예외). 생성 · 모드 A · B(GEN-01~03 · 05)는 실행 인자와 환경변수로 도는 내부 동작이며 표면이 없다(§원본에 없는 표면 판정). **옛 #1 POST /api/v1/ingest/bulk(모드 C 부하 주입 · GEN-07)와 성능 비교 라이브 실행 perf(GEN-11)는 측정 도구 · 옛 perf 직접 재 보기와 함께 지웠다**(D-16 · [../01_overview/06_design_decisions.md](../01_overview/06_design_decisions.md)) — 표면 번호 #1은 결번이다.

**라이브 실행 표면은 측정 도구가 아니라 시연 도구다.** 앱(api)을 거쳐 흐르므로 결과에는 항상 **"라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"** 표지가 붙고, 측정 기록(docs/measurements)을 만들지 않는다. 게이트 환경변수가 없고 기본 존재한다 — 방어는 127.0.0.1 바인드 · **동시 실행 하나** · 매개변수 화이트리스트가 맡는다(§라이브 실행 제어).

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 인증 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| **2** | POST | /api/v1/runs | GEN-12 · 13 | 무인증 | BFF no-store · Origin 확인 | common.validation_failed/400 · **datagen.run_in_progress/409** · **datagen.compare_no_data/409** · realtime.latest_unavailable/503 | EXP-FLOW · EXP-LAB | 신설 |
| **3** | GET | /api/v1/runs/current | GEN-12 · 13 | 무인증 | BFF no-store | 없음 | EXP-FLOW · EXP-LAB | 신설 |
| **4** | GET | /api/v1/runs/{runId} | GEN-12 · 13 | 무인증 | BFF no-store | common.validation_failed/400 · common.not_found/404 | EXP-FLOW · EXP-LAB | 신설 |
| **5** | POST | /api/v1/runs/{runId}/stop | GEN-12 · 13 | 무인증 | BFF no-store · Origin 확인 | common.validation_failed/400 · common.not_found/404 | EXP-FLOW · EXP-LAB | 신설 |
| **6** | GET | /api/v1/runs/latest?type=compare | GEN-13 | 무인증 | BFF no-store | common.validation_failed/400 | EXP-LAB | 신설(D-16) |
| **7** | GET | /api/v1/data/sensor/stats | GEN-14 | 무인증 | BFF no-store | 없음 | EXP-LAB · EXP-FLOW · HMI-PLANT | 신설(D-16) |
| **8** | POST | /api/v1/data/sensor/purge | GEN-14 | 무인증 | BFF no-store · Origin 확인 | common.validation_failed/400 · **data.purge_blocked/409** | EXP-LAB · EXP-FLOW · HMI-PLANT | 신설(D-16) |

- 검산: 표면 = REST **7** · 신설 7(라이브 실행 4 + D-16 3) · 결번 #1(D-16)
- 화면 코드의 정본은 [../08_screen/README.md](../08_screen/README.md) 화면 인벤토리다 — #7 · #8은 세 화면의 머리에 놓인 지우기 버튼(공용 컨트롤)이 부른다.
- **라이브 실행 · 직접 비교 · 센서 데이터 표면은 실행 역할 api · all에서만 존재한다**(실행 주체 RunControlModule — [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)). APP_ROLE이 worker · collector인 프로세스에는 라우트가 없다(404 — 코드 없음 · 존재하지 않는 경로와 같다). **직접 비교의 배치 시간 계측은 적재(Ingest)와 같은 프로세스일 때만 움직인다** — 로컬 기본 all이 그 구성이다(api · worker로 나누면 결과의 batches 표본이 0이다).

## 라이브 실행 제어

사용자 요구(2026-09-28 — "데이터 처리를 시작하는 버튼 · 중단 버튼 · 완료 표시 · 걸린 시간")로 분산 처리 모니터링 화면(EXP-FLOW)에 실행 패널이 생겼고, 이 절이 그 패널이 부르는 표면 #2~#5의 계약이다. 실행 종류는 **flow**(흐름 시연 실행 · GEN-12)와 **compare**(직접 비교 실행 · GEN-13 — D-16 · 계약은 §직접 비교) 둘이다 — 옛 **perf**(규모별 성능 비교 · GEN-11)는 D-16으로 지웠다. 단계 · 취소 · 발행 규칙의 기전 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §라이브 실행 — flow다.

### 공통 규약(라이브 실행)

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 브라우저 → BFF → api · **BFF no-store** — 실행 객체는 순간값이라 캐시할 것이 없다 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 · 캐시하면 running이 revalidate 창만큼 남아 끝난 실행을 진행 중으로 보인다 |
| 게이트 | **없다** — 기본 존재한다 · 방어는 127.0.0.1 바인드 · 동시 실행 하나 · 매개변수 화이트리스트(§매개변수) · 설비 가동(06_realtime #3 · #4 — 기동 기본값 SENSOR_AUTOGEN · 이름 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md))은 flow를 막지 않는다 — 설비 가동은 SIM · 모드 A · Collector만 켜고 끄고, flow · compare 실행은 stream에 직접 발행하므로 가동이 꺼진 스택에서도 센서 원천이 된다 · **compare 넣기 · 무결성만 가동이 꺼져 있어야 시작한다**(§직접 비교) · 센서 데이터를 지우는 동안은 어떤 실행도 시작하지 않는다(#8) · compare는 가동 여부를 결과(plantOn)에 남긴다 | 리드 판정 2026-09-28 · 잔여(로컬 사용자의 대량 적재 · 디스크 소모)는 [../12_security/04_threat_model.md](../12_security/04_threat_model.md) |
| 동시 실행 | **한 번에 하나** — 종류(flow · compare)와 무관하게 진행 중(running · stopping)이 있으면 시작 요청은 datagen.run_in_progress/409 · details {runId, type} | REQ-GEN-16 |
| 실행 상태 자리 | **api 인스턴스 메모리** — 진행 중 실행 1 + 마지막으로 끝난 실행 1을 다음 시작 전까지 보관한다 · 재기동이면 둘 다 사라진다(실패가 아니라 기록 없음) · **compare만 종결 직전 PostgreSQL run_result에 1행을 더 남긴다**(#6이 읽는다 — 화면용 보관 · 측정 기록 아님 · 결과는 completed만 — 진행 중 값과 중단 · 실패의 결과는 남지 않는다) | 리드 판정 3 · 로컬 단일 api · D-16 |
| 시각 · 경과 | startedAt · endedAt은 UTC ISO 8601 Z(이름이 At으로 끝남 — [01_conventions.md](./01_conventions.md) §시각 직렬화) · elapsedMs는 **서버가 계산한 정수 ms** | REQ-GEN-19 |
| 결과 표지 | 결과는 **"라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"** — 측정 기록을 만들지 않는다 · 화면은 기록 계열과 다른 계열 · 다른 모양으로 그린다 | 리드 판정 1 · [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) |
| 멱등 | #2 멱등 키 없음 — 진행 중 중복 시작은 409가 막고, 끝난 뒤의 시작은 새 실행이다 · #5는 자연 멱등(끝난 실행에 200 + 그대로) | [01_conventions.md](./01_conventions.md) §멱등 |
| 인증 · 인가 | 없음 — 전 표면 무인증(D-16) · 상태를 바꾸는 POST(#2 · #5 · #8)는 **Content-Type application/json의 JSON 객체 본문 필수**(#5 · #8은 빈 객체 {}) — 아니면 400 common.validation_failed(fields path header.content-type · body) · BFF는 Origin이 허용 출처일 때만 중계(밖이면 403 본문 없음 · REQ-GLB-27) | [01_conventions.md](./01_conventions.md) §출처 방어 |
| 단계 | S5 표면(화면과 같은 단계) | [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-12 |

- 검산: 항목 = **9**
- **B형 — 409는 결함이 아니라 시연 보호다.** 결론 — 다른 실행이 돌고 있으면 시작하지 않는다. 반대 시나리오 — 실행 둘이 함께 돌면 두 실행의 발행 · 명령 · 조회가 한 흐름도에 섞여 화면이 서로의 부하를 보인다. 파생 지침 — 화면은 409의 details.runId로 #4를 불러 패널을 그 실행에 맞춘다.
- **A형 — "api를 재기동했더니 실행 기록이 사라졌다"는 버그가 아니다.** 통념은 실행 이력이 저장돼야 한다는 것이다. 부정 — 라이브 실행은 시연이고 측정 기록이 아니라서 저장할 정본이 없다 · 이력을 측정 기록 자리에 쓰면 시연값이 기록처럼 쌓여 곡선에 섞일 자리가 생긴다. 진짜 축은 **정본 여부**다. 대체 경로 — 남길 수치는 측정 절차(EXP-NN · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md))로 다시 잰다. 재기동 뒤 #3은 run null · 옛 runId는 404다. **예외 하나 — compare의 종결 결과는 run_result에 남는다**(D-16 — ⑤ 패널이 마지막 결과를 계속 보여야 한다). run_result는 측정 기록이 아니라 화면 보관이다 — docs/measurements 판독기가 읽지 않고, 결과에는 같은 시연 표지가 붙는다.

### #2 POST /api/v1/runs

| 필드 | 타입 | 규칙 |
|------|------|------|
| type | 문자열 | 필수 · flow · compare — 옛 perf는 D-16 폐지라 400 |
| params | 객체 | flow는 선택 · compare는 **필수**(part가 있어야 한다) · type별 키만(§매개변수) · 생략한 키는 기본값 · 모르는 키 · 값 집합 밖 값은 400 |

- 검산: 필드 = **2**

| 단계 | 동작 | 실패 응답 |
|:-:|------|------|
| ① | Host 대조(REQ-GLB-26) | 400 common.validation_failed |
| ② | 본문 검증 — Content-Type application/json · JSON 객체 · type · params 화이트리스트 | 400 common.validation_failed(fields path header.content-type · body · params 키) |
| ③ | 동시 실행 확인 — 진행 중(running · stopping) 실행이 있는가 | 409 datagen.run_in_progress · details {runId, type} |
| ③′ | 지우기 중 확인 — 센서 데이터 지우기(#8)가 진행 중인가(프로세스 안 잠금) | 400 common.validation_failed(fields path purge · reason enum) |
| ③″ | compare 시작 전 확인(실행 객체를 만들지 않는다) — 넣기 · 무결성은 SW-09 off가 아닌가 · **설비 가동이 꺼져 있는가**(읽지 못하면 503) · 조회 대결은 마지막 넣기(상태 무관)가 완료이고 그 구간에 두 저장소 행이 있는가 | 400 common.validation_failed(fields path SW-09 · plant · reason enum) · 503 realtime.latest_unavailable · 409 datagen.compare_no_data · details {part, reason, range} |
| ④ | 실행 객체 생성 — ③ · ③′를 같은 동기 구간에서 다시 본다 · runId(UUID) 발급 · 마지막으로 끝난 실행을 버린다 · steps 전부 pending으로 만든다 | 409 · 400(③ · ③′와 같다) |
| ⑤ | 202 + 실행 객체(status running) — 실행은 응답 뒤 계속된다 | 해당 없음 |

- 검산: 단계 = **7**(③″는 compare에만 돈다)
- **202인 이유** — flow는 durationSec(최대 300초) 동안 돈다. 끝날 때까지 응답을 잡으면 BFF · 브라우저 요청 시간 상한에 먼저 걸려 실행은 도는데 화면은 실패를 본다. 진행과 진행 중 결과(§진행 중 결과(compare))는 #3 폴링이 읽는다.
- ③과 ④는 한 임계 구역이다 — 두 시작 요청이 동시에 와도 하나만 running이 되고 나머지는 409다(REQ-GEN-16). ③″가 저장소를 읽는 동안(await) 다른 시작이 끼어들어도 ④가 다시 막는다.

### #3 GET /api/v1/runs/current

응답은 200 하나다 — 본문 {run: 실행 객체 | null}.

| 서버 상태 | run |
|------|------|
| 진행 중 실행 있음(running · stopping) | 그 실행 |
| 진행 중 없음 · 마지막으로 끝난 실행 있음 | 그 실행(completed · stopped · failed) — 다음 시작 전까지 |
| 둘 다 없음(api 기동 뒤 첫 시작 전) | null |

- 검산: 상태 = **3**
- 화면은 진입 때 1회 부르고, run.status가 running · stopping이면 **1초마다** 다시 부르며, 종결 3값이면 폴링을 멈춘다.
- **진행 중 실행의 result는 그때까지의 값이다** — compare는 끝나기 전에도 result가 바뀐다(§진행 중 결과(compare)). ⑤ 화면은 이 1초 폴링 하나로 진행 띠와 실행 중인 패널을 함께 그린다([../08_screen/10_lab_screen.md](../08_screen/10_lab_screen.md)) — 패널을 그리려고 부르는 표면은 따로 없다.

### #4 GET /api/v1/runs/{runId}

200 + 실행 객체다. runId가 UUID가 아니면 400 common.validation_failed, 메모리에 없으면(진행 중도 마지막 종결도 아닌 옛 실행 · 재기동 전 실행) 404 common.not_found다. **없는 runId를 pending으로 두지 않는다** — 명령 조회(01_conventions #1)와 달리 runId는 이 인스턴스가 발급했으므로 모르는 값은 곧 사라진 값이다. 진행 중 실행이면 result는 #3과 같은 진행 중 값이다(§진행 중 결과(compare)).

### #5 POST /api/v1/runs/{runId}/stop

| 대상 실행의 status | 응답 | 동작 |
|------|------|------|
| running | **202** + 실행 객체(status stopping) | 진행 중 단계에 취소를 건다 — §중단과 실패 |
| stopping | **202** + 실행 객체 그대로 | 없음 — 이미 중단 중이다 |
| completed · stopped · failed | **200** + 실행 객체 그대로 | 없음 — 새 코드를 만들지 않는다(자연 멱등) |
| 메모리에 없음 | 404 common.not_found | 해당 없음 |

- 검산: 행 = **4** · 대상 status 5값 전부 든다(종결 3값은 한 행)
- **끝난 실행의 중단을 409로 내지 않는 이유** — 사용자가 중단을 누른 순간 실행이 완료되는 경합은 흔하다. 409면 화면이 오류를 띄우는데 사용자가 원한 상태(더 돌지 않음)는 이미 참이다. 200 + 그대로면 화면은 받은 status(completed)로 완료 표시를 그린다.
- **본문은 Content-Type application/json의 빈 객체 {}다**(모르는 키 400) — 아니면 400 common.validation_failed(fields path header.content-type · body). 본문 없는 단순 요청을 받으면 다른 출처의 폼 POST가 진행 중 실행을 멈출 수 있다(REQ-GLB-27).
- 중단은 비동기다 — 202 뒤 종결(stopped)까지는 취소가 저장소에서 돌아오는 시간이 걸린다. 화면은 그 사이 버튼을 "중단 중…"으로 비활성한다.

## 실행 객체

실행 객체의 모양이다. params · steps의 key · detail · result의 안쪽은 실행 종류가 정한다.

| 필드 | 타입 | 규칙 |
|------|------|------|
| runId | 문자열(UUID) | 시작 때 발급 · 이 인스턴스 안에서 유일 |
| type | 문자열 | flow · compare |
| status | 문자열 | 실행 status 5값(아래) |
| params | 객체 | **적용된 값 전부** — 생략한 키도 기본값으로 채워 싣는다 |
| startedAt | 문자열(UTC ISO 8601 Z) | 시작 요청을 받은 시각 |
| endedAt | 문자열 · null | 종결 시각 · 진행 중이면 null |
| elapsedMs | 정수 | 종결이면 endedAt − startedAt · 진행 중이면 **응답 시각** − startedAt — 서버가 계산한다 |
| steps | 배열 | 단계 목록 — 시작 때 전 단계가 pending으로 들어 있다(아래) |
| result | 객체 · null | 종류별 결과(§결과) — 단계가 끝날 때마다 채워지고 **compare는 단계 안에서도 바뀐다**(넣기는 1초마다 · 조회 대결 · 무결성은 질문 · 시험마다 — §진행 중 결과(compare)) · 시작 직후 null |
| error | 객체 · null | {code, message} — code는 원인의 기존 에러 코드 또는 **null**(메시지 전용) · 실패 때만 |

- 검산: 필드 = **10**
- **elapsedMs를 화면이 startedAt에서 다시 계산하지 않는 이유(B형)** — 결론: 경과의 기준은 서버 시계 하나다. 반대 시나리오 — 브라우저가 지금 − startedAt을 계산하면 브라우저 시계가 서버보다 앞선 만큼 경과가 늘어나고, 종결 뒤 총 소요(서버 값)와 진행 중 마지막 표시가 어긋나 완료 순간 시간이 뒤로 뛴다. 파생 지침 — 화면은 진행 중일 때만 받은 elapsedMs에서 1초 틱으로 이어 세고, 폴링 응답마다 서버 값으로 다시 맞춘다.

### 실행 status

전송 enum 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) #21 · 상태 머신 5다.

| status | 뜻 | 종결 | 화면 표시 |
|------|------|:--:|------|
| running | 단계가 도는 중 | 아니오 | 진행 칩 · 경과 1초 틱 |
| stopping | 중단 요청을 받아 취소 중 | 아니오 | "중단 중…" · 경과 1초 틱 |
| completed | 전 단계가 끝났다 | 예 | 초록 "완료 — 총 소요 N분 N.N초 · 종료 HH:MM:SS KST" |
| stopped | 중단 요청으로 끝났다 | 예 | 회색 "중단됨 — 소요 …" |
| failed | 단계 예외로 끝났다 | 예 | 빨강 "실패 — 메시지 · 소요 …" |

- 검산: status = **5** · 종결 3(completed · stopped · failed) + 진행 2(running · stopping)

### steps[] 항목

| 필드 | 타입 | 규칙 |
|------|------|------|
| key | 문자열 | 종류별 단계 키(아래) · 실행 안에서 유일 |
| label | 문자열 | 사람용 이름 — 화면은 key로 분기하고 label은 표시만 한다 |
| status | 문자열 | step status 6값(아래) |
| startedAt | 문자열 · null | 시작 전이면 null |
| endedAt | 문자열 · null | 끝나기 전이면 null |
| elapsedMs | 정수 · null | 시작 전이면 null · 진행 중이면 응답 시각 기준 |
| detail | 객체 | 종류 · 단계별 수치(아래) · 시작 전이면 빈 객체 |

- 검산: 필드 = **7**

| step status | 뜻 |
|------|------|
| pending | 아직 시작하지 않았다 |
| running | 도는 중 |
| done | 끝났다(flow drain의 상한 초과도 done + detail.timedOut true) |
| skipped | 중단 · 실패로 시작하지 않고 건너뛰었다 |
| stopped | 도는 중 중단으로 취소됐다 |
| failed | 도는 중 예외로 끝났다 |

- 검산: step status = **6** — 전송 enum 정본 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) #22

| 종류 | 단계 key(순서) | 단계 수 | detail |
|------|------|------|------|
| flow | prepare → publish → drain | **3** | publish {pointsSent, entriesSent, commandsSent, backpressurePauses, progress 0~1, readsSent, readsFailed, readsSkipped} · drain {drainMs, timedOut} · prepare {devices 1, tags, tagsCreated}(시연 설비 DEMO-FLOW-DEV의 flow 전용 태그 50 — 처음 실행만 만든다 · 카드 라인 태그는 쓰지 않는다) |
| compare ingest | prepare → clear → publish → drain → verify | **5** | prepare {backlogWaitMs, rangeStart, rangeEnd, devices, tags, pointsPerSimSecond, expectedRows} · clear {gate} · publish {published, rowsCh, rowsPg, backpressurePauses, progress} · drain {drainMs, timedOut, warning(상한 초과 때만)} · verify {rowsMatch, clickhouse, postgres, published, copyBatches, optimized, compressed, warning(병합 · 압축 실패 때만)} |
| compare query | prepare → sensor-1m → device-latest → hourly-avg → daily-output | **5** | prepare {rangeStart, rangeEnd, clickhouse, postgres, rowsMatch} · 문항마다 {winner, ratio, rowsMatch} |
| compare integrity | prepare → duplicate → unknown-device → fault-value → cleanup | **5** | prepare {demoDevice, demoDeviceId, windowStart} · 시험마다 {device, sent, clickhouse, postgres, copyFailures}(fault-value는 value · streamContractBlocksNaN 더함 · 소진 상한 초과면 drainTimedOut · warning 더함) · cleanup {windows, latestKeysDeleted} |

- 검산: 종류 = **4**(flow 1 + compare 부분 3) · 단계 = 3 + 5 + 5 + 5 = **18** · 옛 perf 단계는 D-16 폐지
- **경고는 결과가 아니라 단계 detail에만 둔다** — 소진 상한 초과(행 수 · 초당 행을 끝까지 못 쟀을 수 있다) · ClickHouse 병합 실패(크기가 병합 전 값) · TimescaleDB 압축 실패(크기가 압축 전 값 — compressed false)는 warning 문자열로 그 단계에 남고 result 계약은 바뀌지 않는다. 화면은 단계 표지에서 경고를 읽는다.
- **compare integrity의 cleanup은 중단 · 실패에도 돈다** — 중단 요청을 무시하고 끝까지 간다(게이트 끄기 → 시험 창 비우기 → 시험 rt:latest 키 지우기). 그래서 중단된 무결성 실행도 cleanup은 done이다.

## 매개변수

params는 **닫힌 값 집합(화이트리스트)**이다 — 자유 수치를 받지 않는다. 게이트 환경변수 없이 표면을 기본 존재로 두는 방어의 한 축이다(§공통 규약(라이브 실행)).

| type | 키 | 값 집합 | 기본값 | 뜻 |
|------|------|------|------|------|
| flow | pps | 1000 · 5000 · 10000 · 20000 · 50000 | 10000 | 생성기가 stream:plc:raw에 보내는 초당 포인트 |
| flow | durationSec | 30 · 60 · 120 · 300 | 60 | publish 단계 길이 |
| flow | bizPerSec | 0 · 0.5 · 1 · 2 | 1 | 초당 업무 명령 수(BizWritePort — master.device.patch · **시연 전용 설비 DEMO-FLOW-DEV에만** 새 이름 · 되돌림 없음) · 0이면 명령 없음 |
| flow | **readsPerSec** | 0 · 5 · 20 · 50 | 20 | 초당 조회 수 — 센서 시계열 · 센서 지금 값 · 업무 설비 목록 3종을 돌아가며 프로세스 안 호출로 보낸다(표면을 거치지 않고 같은 서비스 계층 · 같은 캐시 경로 — 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §흐름 시연 실행) · 0이면 조회 없음 |
| compare | **part** | ingest · query · integrity | 없음 — 필수 | 실행 하나가 하는 부분(패널 ▶ 하나) |
| compare | **spanHours** | 1 · 24 · 72 | 1 | 넣기 구간 길이(시간) — ingest만 쓴다 · 다른 부분에서는 무시 |

- 검산: 키 = flow 4 + compare 2 = **6** · 값 수 = 5 + 4 + 4 + 4 + 3 + 3 = **23**
- 값 집합 확장은 이 표 · [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) REQ-GEN-18 · 화면 선택지를 같은 변경 단위에서 고친다.

## 결과

result는 단계가 끝날 때마다 채워진다 — compare는 진행 중에도 바뀌고(§진행 중 결과(compare)) · 중단 · 실패한 실행도 멈춘 때까지의 결과를 싣는다(#3 · #4 — 보관 #6에는 completed의 결과만).

| type | 필드 | 모양 |
|------|------|------|
| flow | 수치 9 | pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs · **readsSent** |
| compare ingest | 필드 10 | part · spanHours · rangeStart · rangeEnd · rows {published, clickhouse, postgres} · elapsedMs · rowsPerSec · batches {count, clickhouseMs {p50, p95}, postgresMs {p50, p95}, postgresFailures} · bytes {clickhouse, postgres} · timeline[{tSec, clickhouseMs, postgresMs, rows}] |
| compare query | 필드 5 | part · rows · rangeStart · rangeEnd · questions[{q, size small · large, clickhouse {values, median, resultRows}, postgres {상동}, winner clickhouse · postgres · null, ratio}] |
| compare integrity | 필드 2 | part · tests[{test, sent, clickhouse {stored}, postgres {stored, rejected, rule}}] |

- 검산: 행 = **4** · flow 수치 = **9** · compare 결과 모양의 정본은 공용 계약(packages/shared runs.ts CompareRunResult — part로 가른다)이고 뜻은 §직접 비교
- **readsSent는 보낸 조회 수다(3종 합 · 실패 포함 · 동시 상한으로 건너뛴 조회는 빼고 publish detail.readsSkipped가 센다).** readsFailed · readsSkipped는 publish detail에만 있고 result에는 없다. 조회는 결과를 실행 객체에 싣지 않고 버린다 — 히트 · 미스 · 실패는 실행이 아니라 /metrics의 조회 계열(tsq_cache_requests_total · rlt_latest_requests_total · mst_cache_requests_total — 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md))이 센다. 조회가 실패해도 실행은 failed가 되지 않는다 — 조회 실패를 실행 실패로 올리면 ClickHouse가 잠깐 503인 동안 흐름 시연 전체가 멈춘다.
- commandsPending은 명령 응답이 202(대기 상한 초과)였던 수다 — 실패가 아니다([01_conventions.md](./01_conventions.md) §업무 쓰기 경로).
- **명령 1건 = 1이다(짝 없음).** commandsSent는 publish가 시연 전용 설비에 보낸 master.device.patch 수이고 commandsOk + commandsPending + commandsFailed와 같다 · prepare가 시연 전용 행(사이트 · 라인 · 설비)을 만드는 명령은 세지 않는다(기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §시연 전용 행).

### 진행 중 결과(compare)

compare 실행 객체의 result는 **끝나기 전에도 채워진다**(사용자 결정 2026-10-11 — ⑤ 실시간 그래프). #3 · #4가 진행 중 실행을 낼 때 result는 그때까지의 값이고 모양은 완료 결과와 같은 CompareRunResult다 — 공용 계약(packages/shared runs.ts)은 바뀌지 않는다. 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §직접 비교 실행.

| 부분 | result null인 단계 | 바뀌는 때 | 최종값 |
|------|------|------|------|
| ingest | prepare · clear | 발행이 시작되면 1초마다(bytes는 2초마다) — publish · drain 내내 | verify가 결과 전체를 바꾼다 — 행 수는 저장소에서 세고 크기는 ClickHouse 병합 · PostgreSQL 압축 뒤에 잰다 |
| query | prepare | 질문 하나가 끝날 때마다 questions[]에 그 줄이 붙는다(최대 4) | 마지막 질문이 끝날 때 |
| integrity | prepare | 시험 하나가 끝날 때마다 tests[]에 그 줄이 붙는다(최대 3) | 마지막 시험이 끝날 때 — cleanup은 result를 바꾸지 않는다 |

- 검산: 부분 = **3**

넣기 결과에서 진행 중에 바뀌는 필드의 뜻이다 — part · spanHours · rangeStart · rangeEnd는 시작 값 그대로다.

| 필드 | 넣는 중(publish · drain) | 끝난 뒤(verify) |
|------|------|------|
| rows | published = 지금까지 보낸 행 · clickhouse · postgres = 지금까지 각 DB에 들어간 행(Ingest 계측의 삽입 · COPY 행 — 실행 앞 값과의 차분) | published = 보낸 행 전부 · clickhouse · postgres = 구간 안 행 수(저장소에서 센다) |
| elapsedMs | 발행 시작부터 지금까지 | 발행 시작부터 소진 확인까지(마지막 COPY 기다림은 뺀다) |
| rowsPerSec | 두 DB 중 적은 쪽 행 ÷ 발행 시작부터 경과 — 다 들어간 순간에는 끝난 뒤 정의와 같아진다 | 보낸 행 ÷ 걸린 시간 |
| batches | 지금까지의 배치 수 · CH · PG p50 · p95 · postgresFailures — 히스토그램 차분 | 실행 앞뒤 히스토그램 차분 |
| bytes | 2초마다 — 구간이 걸친 UTC 일 파티션 · 칸의 디스크 크기(ClickHouse system.parts 활성 조각 bytes_on_disk 합 · PostgreSQL 칸 크기 chunks_detailed_size 합 · 행은 세지 않는다) · 첫 값 전 null · 한 저장소 읽기가 실패하면 그 저장소만 null · 병합(OPTIMIZE) · 압축 전 · 마지막 읽기 뒤에 들어온 조각이 빠진 순간값 | ClickHouse 병합 뒤 파티션 크기 · PostgreSQL 압축 뒤 칸 크기(압축 데이터 포함) × 구간 몫(§과거 시각 창) |
| timeline | 지금까지의 초별 점 전부 — 1초마다 하나 는다 | 발행 · 소진 동안의 초별 점 전부 |

- 검산: 바뀌는 필드 = rows · elapsedMs · rowsPerSec · batches · bytes · timeline = **6**
- **넣는 중 크기에는 이번 넣기 행만 든다.** 넣기는 시작 때 사흘 창(UTC D−4 · D−3 · D−2)을 일 파티션 · 칸째 비우므로 구간 파티션 · 칸에는 이번 넣기 행만 있다 — 구간 몫으로 나누지 않아도 다른 넣기의 몫이 섞이지 않는다.
- **보관은 completed만이다.** run_result는 완료한 실행의 최종 result만 남기고 stopped · failed는 result null로 남긴다 — 진행 중 값은 #6에 나오지 않는다. 중단된 넣기의 그때까지 값은 고른 구간의 답이 아니다(사흘 창을 비우고 앞부분만 채웠다).
- **A형 — "넣는 중에 clickhouse와 postgres 행 수가 다르다"는 버그가 아니다.** 통념은 같은 배치를 두 DB에 실으니 넣는 중에도 두 값이 같다는 것이다. 부정 — Ingest가 ClickHouse 삽입과 PostgreSQL COPY를 따로 끝내고 계측은 1초마다 읽으므로 그 순간 두 값은 다르고, 마지막 COPY 전까지 PostgreSQL이 작게 보인다. 진짜 축은 **verify가 끝났는가**다. 대체 경로 — 같음 판정은 끝난 결과의 rows로만 한다(verify detail rowsMatch) · 화면은 끝나기 전에 ✓ · ✕를 내지 않는다([../08_screen/10_lab_screen.md](../08_screen/10_lab_screen.md)).
- **A형 — "넣는 중 마지막 크기와 끝난 뒤 크기가 다르다"는 버그가 아니다.** 통념은 마지막으로 본 넣는 중 크기가 곧 최종 크기라는 것이다. 부정 — 넣는 중 크기는 2초마다 읽은 순간값이다 — 병합(OPTIMIZE) 전 조각 · 압축 전 칸의 합이고 마지막 읽기 뒤에 들어온 조각은 빠져 있어, 최종값과 어느 쪽으로든 다를 수 있다(줄어든다 · 는다를 단정하지 않는다). 진짜 축은 **verify가 병합 · 압축 뒤 다시 쟀는가**다. 대체 경로 — 디스크 배수는 끝난 결과로만 읽는다 · 병합 · 압축이 실패하면 verify detail warning이 그 사실을 남긴다.

## 중단과 실패

| 사건 | 진행 중 단계 | 미실행 단계 | 최종 status | error |
|------|------|------|------|------|
| #5 중단 요청 | 취소 — 발행 루프 · 명령 · 조회 정지 → **stopped**(진행 중 0~1개 — 단계 경계면 0개 · prepare 중이어도 같다) · 끝난 단계는 done 유지 | skipped(drain 포함) | stopped | null |
| 단계 예외(저장소 불가 등) | **failed** | skipped | failed | {code: 원인의 기존 에러 코드 또는 null, message} |
| api 재기동 · 종료 | 프로세스와 함께 사라진다 | 사라진다 | 없음 — 기록 없음(#3 null · runId 404) | 해당 없음 |

- 검산: 사건 = **3** · 옛 perf 정리 단계의 두 사건은 D-16 폐지 · compare의 정리(게이트 끄기 · 무결성 시험 창 정리)는 세 사건 모두에서 돈다 — 재기동이면 게이트는 TTL 10초로 저절로 사라진다(§직접 비교)
- **B형 — failed는 에러 응답이 아니다.** 결론 — 실행 실패는 200 응답 안의 status failed와 error 필드다. 반대 시나리오 — 실패를 #3 · #4의 5xx로 내면 폴링이 실패 응답을 받아 패널이 "조회 실패"를 띄우고, 실행이 실패한 것인지 조회가 실패한 것인지 가를 수 없다. 파생 지침 — 에러 카탈로그에 run_failed 같은 코드를 만들지 않는다(실패 원인은 실행 객체 안의 관찰값 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §에러 코드가 아닌 것).

## 직접 비교

실행 종류 **compare**(GEN-13 · D-16 결정 2)의 계약이다. 같은 센서 데이터를 Redis Stream으로 ClickHouse · PostgreSQL에 **똑같이** 싣고(SW-09 gated의 게이트가 열린 동안) 넣기 · 조회 대결 · 무결성을 잰다. 실행 하나가 부분 하나이고 #2~#5를 flow와 함께 쓴다. 기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §직접 비교 실행 · 동시 적재 기전 정본 [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §대조군 동시 적재 기전. **업무 방해(센서를 쏟으며 업무 1건 처리 시간)는 넣었다가 뺐다** — 같은 강도에서도 느린 쪽(p95)이 실행마다 크게 달라 판정할 수 없었다(사용자 결정 2026-10-11 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-31). **PostgreSQL 쪽 비교 사본은 TimescaleDB hypertable이다** — 칸(chunk) 1일 · 넣기 검증 단계에서 그 구간 칸을 열 압축하고 조회 대결은 압축된 칸을 읽는다(D-05 부분 개정 · [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-32).

| 부분 | 하는 일 | 시작 전 거절 | 결과가 답하는 것 |
|------|------|------|------|
| ingest 넣기 | 대기줄 적체가 0이 될 때까지 기다린 뒤(상한 30초 — 넘으면 failed) 과거 구간(§과거 시각 창)을 비우고 게이트를 켠 뒤 카드 라인 30대 태그를 주기대로 다시 만들어 stream:plc:raw에 최대 속도로 발행 → 적체 소진 → 게이트 끔 → 행 수 · 크기 · 배치 시간 대조 | SW-09 off · 설비 가동 켜짐 → 400 | 같은 행이 두 저장소에 다 들어갔는가 · 묶음 하나 넣는 시간 · 디스크에 얼마나 차지하는가 |
| query 조회 대결 | 마지막 넣기 구간에 4문항(§조회 대결 문항)을 두 저장소에 같은 뜻으로 묻는다 — 워밍업 1 + 3회 | 넣기 없음 · 마지막 넣기 미완료 · 구간 행 없음 → 409 datagen.compare_no_data(details.reason no_ingest · ingest_incomplete · no_rows) | 소량은 누가 · 대량은 누가 빠른가 — 3회 모두 같을 때만 승자 |
| integrity 무결성 | 시험 창에 시험 셋(§무결성 시험)을 따로 발행 → 저장 건수 · 막음 판정 → 정리 | SW-09 off · 설비 가동 켜짐 → 400 | 규칙을 어긴 데이터를 누가 막는가 |

- 검산: 부분 = **3** · 시작 전 거절 자리 3(넣기 400 · 조회 409 · 무결성 400) — 400의 fields path는 SW-09 · plant 둘, 409의 reason은 3값 · 실행 객체를 만들기 전이라 #3 현재 실행은 바뀌지 않는다
- **B형 — 설비 가동 중 넣기 · 무결성 거절은 비교를 지키는 장치다.** 결론 — 가동이 켜져 있으면 400(fields path plant)이고 조회 대결은 막지 않는다. 반대 시나리오 — 가동 엔트리가 비교 행과 같은 대기줄 · 같은 배치를 타 배치 시간 · 타임라인에 가동 행이 섞이고, 게이트가 열린 동안 가동 행이 PostgreSQL 오늘 칸에도 실린다 — 최대 속도 발행의 적체 뒤에서 가동 엔트리가 수 초 밀려 HMI 개요가 설비를 통신 끊김으로 보이기도 한다. 파생 지침 — 화면은 "설비 가동을 끈 뒤 비교해 주세요"를 말한다 · 가동을 대신 끄지 않는다 · 조회 대결은 이미 실린 구간을 읽어 가동과 무관하다(plantOn은 그대로 남는다).
- **B형 — 넣기가 시작 전에 적체 0을 기다리는 것은 지연이 아니라 행 수의 참을 지키는 장치다.** 결론 — 대기줄(lag + pending)이 0이 된 뒤에만 구간을 비운다. 반대 시나리오 — 중단한 넣기 · flow가 남긴 엔트리가 비운 구간에 같은 (설비 · 태그 · 시각)으로 들어와 ClickHouse는 두 번 저장하고 PostgreSQL은 기본 키 충돌로 그 배치 COPY를 통째로 롤백해 두 저장소 행 수가 어긋난다. 파생 지침 — 30초 넘게 남으면 prepare가 failed로 끝나고 화면은 "잠시 뒤 다시"를 말한다 · 기다린 시간은 prepare detail backlogWaitMs다.
- **A형 — 앞서 끝까지 간 넣기가 있는데 조회 대결이 409인 것은 버그가 아니다.** 통념은 앞의 완료 구간으로 재면 된다는 것이다. 부정 — 마지막 넣기가 중단 · 실패면 그 실행은 시작하자마자 사흘 창을 비웠고 앞부분만 다시 채웠다 — 앞 구간 데이터가 이미 없거나 반쯤이라 두 저장소가 다른 행 집합으로 승패를 낸다. 진짜 축은 **마지막 넣기(상태 무관)의 상태**다. 대체 경로 — 다시 넣는다(reason ingest_incomplete).
- **결과는 실측 그대로다.** 넣기는 PostgreSQL이 묶음 하나를 더 빨리 넣을 수도 있다(기록 045 — 5만 행 이하 묶음에서 COPY가 삽입보다 빨랐다) · 조회 대결의 승자는 3회가 엇갈리면 null이다. 예상과 달라도 결과를 고치지 않는다(REQ-GEN-20).

### 과거 시각 창

비교 행은 실행이 정한 **과거 구간**에만 싣는다 — 지금 흐르는 설비 가동 데이터와 섞이지 않고 보존 7일(tag_raw TTL · TimescaleDB 보존 정책) 안에 든다. **경계는 UTC 자정이다** — ClickHouse 일 파티션(toYYYYMMDD(ts))과 PostgreSQL hypertable 일 칸(경계 UTC 자정 — ADR-32)이 같은 UTC 날이라(ADR-27) 넣기 사흘 창이 일 파티션 · 칸을 통째로 덮어 ClickHouse DROP PARTITION · PostgreSQL drop_chunks로만 비운다. 조회 대결의 일별 수량만 KST 하루를 센다(mv_tag_1d와 같은 달력 · 정본 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)) — 24시간 구간은 KST 이틀에 걸친다.

| 창 | 시작 · 끝(UTC · D = 오늘 UTC 날짜) | 비우는 폭 | 쓰는 부분 |
|------|------|------|------|
| 넣기 구간 | D−4 00:00(KST 09:00)부터 spanHours(1 · 24 · 72 — 72시간이면 D−1 00:00에서 끝난다) | **72시간 창 = UTC 날 3(D−4 · D−3 · D−2) 통째** — 앞서 넣은 더 긴 구간이 남아 "쌓인 비교 데이터"가 이번 넣기보다 크게 보이지 않게 · 파티션 · 칸째 비워 죽은 행 자리가 남지 않는다 | ingest(채움) · query(읽음) |
| 무결성 창 | D−6 13:00 ~ 14:00(KST 22~23시) · 시험마다 10분(duplicate · unknown-device · fault-value 순) | 그 1시간 — 시작 때 비우고 끝날 때 다시 비운다(일 파티션 · 칸 일부라 행 단위 삭제 · 같은 날 넣기 칸과는 다른 날 — 이틀 이상 전 넣기가 압축한 칸일 수 있다) | integrity |

- 검산: 창 = **2** · 두 창은 다른 UTC 날이다 — 무결성 창은 넣기 사흘 창 앞에 하루(D−5)를 비운 날이라 UTC 날이 한 번 바뀌어도 다음 날의 무결성 창(그날 기준 D−6 = 오늘 기준 D−5)이 오늘 넣은 사흘에 닿지 않는다
- **B형 — 넣기 구간이 KST 아침 9시에 시작하는 것은 어긋남이 아니라 디스크 크기의 참을 지키는 장치다.** 결론 — 구간 시작을 UTC 자정에 맞춘다. 반대 시나리오 — KST 자정(= UTC 15:00)에 맞추면 첫 UTC 날 파티션 · 칸이 늘 걸친 날이라 행 단위 DELETE로 비우고, autovacuum 전에 같은 자리로 COPY가 들어와 죽은 행 자리만큼 파일이 늘어난다 — 넣기를 반복할수록 PostgreSQL 크기가 부풀어 "디스크 N배"가 과장된다(r5 검수 H1). 파생 지침 — 크기는 구간이 걸친 일 파티션 · 칸만 재고 구간 몫으로 나눈다 · 화면은 구간을 KST로 바꿔 보인다.
- 비우기 순서 — 두 저장소의 구간을 비운 **뒤에** 게이트를 켠다. 비우는 동안 가동 데이터 배치가 PostgreSQL에 실려도 구간 밖이라 섞이지 않는다. ClickHouse 일 롤업(tag_1d)은 날 단위 합이라 구간만 덜어 낼 수 없어 그 KST 날 버킷을 통째로 지운다 — 같은 날의 다른 데이터의 일 롤업도 함께 사라지고 원본은 남는다.

### 조회 대결 문항

| q | 크기 | 묻는 것(쉬운 말) | 대상 · 질의 모양 |
|------|------|------|------|
| sensor-1m | 소량 | 센서 1개 최근 1분 | 진동 태그 L1-MIL-VIB · 구간 마지막 1분 원본(0.1초 주기 → 600행) · PostgreSQL은 기본 키 범위 조회 |
| device-latest | 소량 | 설비 1대 지금 값 | 설비 L1-LAM · 태그별 구간 끝 기준 마지막 값 · ClickHouse argMax · PostgreSQL은 태그마다 LATERAL + LIMIT 1(기본 키 역순) |
| hourly-avg | 대량 | 전체 1시간 평균 | 전체 설비 · 태그 · 시간별 평균 — 원본 전부를 훑는다(롤업을 쓰지 않는다) |
| daily-output | 대량 | 라인별 하루 생산량 | 수량(COUNT) 태그마다 KST 날별 (최대 − 최소)를 라인별로 더한다 |

- 검산: 문항 = 소량 2 + 대량 2 = **4**
- 측정 규칙은 문항 × 저장소마다 워밍업 1회(버림) + 3회 · 중간값 · 결과 행 수다. 승자는 3회의 값이 모두 같은 쪽을 가리킬 때만이고 ratio는 느린 쪽 중간값 ÷ 빠른 쪽 중간값이다 — 결과 행 수가 다르면 다른 답을 낸 두 질의라 화면이 그대로 드러낸다.

### 무결성 시험

| test | 보내는 행 | ClickHouse | PostgreSQL이 막는 규칙 | 결과 rule |
|------|------|------|------|------|
| duplicate | 시연 설비 · 시험 태그 10 × 10시각 = 100행을 **두 번** | 200행 저장(중복 그대로) | 기본 키 (device_id, tag_id, ts) — 두 번째 COPY 실패 | 같은 설비 · 태그 · 시각은 한 번만 |
| unknown-device | device에 없는 설비 ID로 100행 | 100행 저장 | 설비 참조(FK device) | 등록된 설비만 |
| fault-value | 100행 전부 FLOAT32 최댓값(센서 고장 표지) | 100행 저장 | 값 범위 CHECK(±1조) | 정상 범위의 숫자만 |

- 검산: 시험 = **3** · 보낸 행 = 200 + 100 + 100 = **400**
- **막음 = 그 보냄에서 PostgreSQL 행이 늘지 않았고 COPY 실패 차분이 0보다 크다.** COPY 한 문장이 트랜잭션 하나라 위반 행 하나가 배치 통째를 롤백한다 — 그래서 시험은 서로 다른 배치로 따로 보낸다.
- **A형 — "숫자가 아닌 값(NaN)을 시험하지 않는다"는 누락이 아니다.** 통념은 NaN이 가장 흔한 고장 값이니 그것으로 재야 한다는 것이다. 부정 — Stream 엔트리 계약(va 유한 값)이 소비자 디코더에서 NaN · Infinity를 먼저 DLQ로 막아 두 DB 어디에도 닿지 않는다 — 보내면 "ClickHouse도 막았다"가 거짓으로 기록된다. 진짜 축은 **어느 계층이 막는가**다. 대체 경로 — 같은 성격(값 규칙)의 고장 값(FLOAT32 최댓값)으로 재고 화면 각주가 "숫자가 아닌 값은 Redis 대기줄 계약이 먼저 막아요"를 말한다(계약 정본 [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md)).

### #6 GET /api/v1/runs/latest?type=compare

부분별 **최근 완료 compare 실행 1건**과 **부분별 마지막 시도**를 PostgreSQL run_result에서 읽는다 — api 메모리(#3)가 아니라서 재기동 뒤에도 남는다. 쿼리 type은 필수이고 compare만 받는다(밖이면 400 common.validation_failed). 경로는 #4보다 먼저 등록한다 — 늦으면 latest가 runId로 읽혀 400이 된다.

| 필드 | 타입 | 규칙 |
|------|------|------|
| ingest · query · integrity | 객체 · null | 부분마다 **최근 완료(completed) 1건**(ended_at 내림차순) · 없으면 null · 지금 부분 집합 밖의 옛 part 행(삭제된 업무 방해)은 읽지 않는다 |
| └ runId | 문자열(UUID) | 그 실행 |
| └ status | 문자열 | 계약은 종결 3값(completed · stopped · failed) · 이 자리는 completed만 온다 |
| └ params | 객체 | {part, spanHours} — 계약 키만 · 어긋나면 기본값 |
| └ result | 객체 · null | completed만 결과 · 저장된 json이 지금 계약과 어긋나면(옛 판) result만 null(행은 버리지 않는다) |
| └ startedAt · endedAt | 문자열(UTC ISO 8601 Z) | 시작 · 종결 |
| └ commitHash | 문자열 · null | 실행 때 api 커밋 |
| └ switches | 객체 | 실행 때 스위치 값(health switches의 value와 같은 모양) |
| └ plantOn | 불리언 | 실행 시작 또는 끝에 설비 가동이 켜져 있었는가 — 켜져 있었으면 그 부하가 섞인 값이다 |
| attempts | 객체 | {ingest, query, integrity} — 부분마다 **마지막 시도**(완료 · 중단 · 실패 무엇이든) {runId, status, endedAt} · 없으면 null |

- 검산: 최상위 필드 = **4**(부분 3 + attempts) · 항목 필드 = runId · status · params · result · startedAt · endedAt · commitHash · switches · plantOn = **9**(startedAt · endedAt를 한 행에 적었다)
- **완료 결과와 마지막 시도를 따로 내는 이유** — 조회 대결을 마친 뒤 다음 조회 대결을 바로 중단하면, 최근 종결 1건만 내는 모양은 데이터가 그대로인데도 앞 결과를 숨기고 "멈췄어요"만 보인다. 두 자리로 내면 화면이 마지막 시도가 완료보다 뒤일 때 "마지막 시도는 중단됐어요(실패했어요)" 한 줄을 그 전 완료 결과 위에 보인다(r5 검수 L3).
- 캐시 — BFF no-store · api no-store. 화면은 실행이 종결될 때와 진입 때 다시 읽는다 — 실행 중인 패널은 #6이 아니라 #3의 진행 중 result로 그린다(진행 중 값은 run_result에 남지 않는다 · 사용자 결정 2026-10-11).

## 센서 데이터

쌓인 센서 데이터의 현황과 지우기다(GEN-14 · D-16 결정 5). **지우는 것은 센서 데이터뿐이다** — 설비 · 태그 · 업무 기록 · 실행 결과(run_result)는 남긴다. 저장소 쪽 계약은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) §비교 사본 함수 · 보존 단계는 [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md).

### #7 GET /api/v1/data/sensor/stats

| 필드 | 모양 | 원천 |
|------|------|------|
| at | 문자열(UTC ISO 8601 Z) | 응답을 만든 시각 |
| clickhouse | {rows, bytes} | tag_raw 행 수 · 활성 파트 디스크 크기(system.parts bytes_on_disk) |
| postgres | {rows, bytes} | plc_tag_raw_control 행 수(3초를 넘으면 통계 추정치 approximate_row_count — 압축 칸 포함) · hypertable 전체 크기(hypertable_size — 칸 · 압축 데이터 · 목차) |
| redis | {streamLength, latestKeys} | stream:plc:raw 길이 · rt:latest:* 키 수(SCAN — KEYS 금지) |
| compareRange | {start, end} · null | 마지막 넣기(상태 무관)가 완료일 때 그 구간 — 지금 ClickHouse에 그 구간 행이 있을 때만(마지막 넣기가 중단 · 실패 · 지우기 뒤 · 보존 경과면 null) |
| compareRows | {clickhouse, postgres} · null | 그 구간 안 두 저장소 행 수 — 넣기 verify가 센 값을 다시 쓴다(옛 결과에 없을 때만 센다) · PostgreSQL에 구간 행이 없으면 0 · 구간이 null이면 null |

- 검산: 필드 = **6**
- **5초 사본이다** — 화면 머리가 주기적으로 부르는데 PostgreSQL 전체 행 세기가 비싸다. 지우기 뒤에는 사본을 비운다 — 실행 종결 뒤에는 비우지 않아 최대 5초 옛 값이 보인다.
- **compareRows를 다시 세지 않는 이유** — 넣기 직후 수천만 행 count가 바로 이어 누른 조회 대결의 PostgreSQL 측정과 겹친다(r5 검수 L4). 구간 행을 바꾸는 길은 지우기(→ null) · 보존 만료 · 무결성 창이 옛 넣기 파티션 · 칸에 겹치는 경우(두 저장소 같이)뿐이다.
- **B형 — ClickHouse 행 수가 PostgreSQL보다 크게 나오는 것은 어긋남이 아니다.** 결론 — clickhouse · postgres의 행 수는 저장소 **전체**이고 비교 양은 compareRows다. 반대 시나리오 — 설비 가동 데이터는 ClickHouse에만 쌓이고(게이트가 닫혀 있다) 비교 구간 행은 둘 다에 있으니 ClickHouse가 늘 크다 — 이것을 "PostgreSQL이 덜 받았다"로 읽으면 넣기 결과(rows — 구간만)와 반대 결론이 된다. 파생 지침 — 두 저장소 대조는 구간 행 수(compareRows · 넣기 결과)로만 하고, 전체 행 수는 "지금 쌓인 양"으로만 보인다.

### #8 POST /api/v1/data/sensor/purge

| 단계 | 동작 | 실패 응답 |
|:-:|------|------|
| ① | Host 대조 · 본문 — Content-Type application/json의 빈 객체 {}(모르는 키 400 · REQ-GLB-27) | 400 common.validation_failed(fields path header.content-type · body) |
| ② | 지우기 잠금(프로세스 안)을 먼저 세운다 — 이 뒤로 실행 시작 · 설비 켜기가 끼어들지 못한다 | 해당 없음(겹친 요청은 진행 중 지우기를 나눠 받는다) |
| ③ | 막는 이유 하나 — ① 실행 진행 중(running · stopping) ② 설비 가동 — 원하는 상태 켜짐 · 켜는 중 · 이 프로세스의 수집기가 아직 도는 중(끈 직후 1초 안) · 읽지 못하면 켜진 것으로 본다 ③ 대기줄 stream:plc:raw 적체(lag + pending) > 0 — 읽지 못하면 막지 않는다 | 409 data.purge_blocked · details.reason run_in_progress · plant_running · stream_backlog |
| ④ | 지우기 직전 저장소별 행을 정확히 센다 | 해당 없음 |
| ⑤ | ClickHouse tag_raw · tag_1m · tag_1h · tag_1d TRUNCATE(MV · Dictionary는 그대로) | 코드 없는 500(§미확인 · 미설계 등재) |
| ⑥ | PostgreSQL 비교 사본 전부 — 함수 control_purge()(app_owner SECURITY DEFINER · app_rw는 TRUNCATE 권한이 없다) | 상동 |
| ⑦ | Redis — stream:plc:raw · stream:plc:dlq 엔트리 XTRIM MAXLEN 0(**소비 그룹 · 키는 남긴다**) · rt:latest:* SCAN → UNLINK · 조회 사본 cache:q:* SCAN → DEL(마스터 사본 cache:tagmeta · cache:devlist는 남긴다 · Redis degrade면 조회 사본은 TTL에 맡긴다) | 상동 |
| ⑧ | 200 + {at, clickhouse {rows, elapsedMs}, postgres {rows, elapsedMs}, redis {streamEntries, keys, elapsedMs}} | 해당 없음 |

- 검산: 단계 = **8** · 막는 이유 = **3** · 지우는 자리 = ClickHouse 4 + PostgreSQL 1 + Redis 4(대기줄 2 · 지금 값 · 조회 사본) = **9**
- **겹친 요청은 지우기 하나를 나눠 받는다** — 두 번째 요청은 진행 중인 지우기의 응답을 그대로 받는다(두 번 지우지 않는다).
- **지우는 동안 새 센서 데이터를 만드는 시작을 거절한다** — 실행 시작(#2 — flow · compare)과 설비 켜기(06_realtime #4 on)는 400 common.validation_failed(fields path purge · reason enum)이고 끄기는 언제나 받는다. 반대 방향도 막는다 — 설비 켜기가 진행 중이면 지우기가 plant_running이다. **잠금은 프로세스 안이다** — APP_ROLE all(로컬 기본) · api 하나에서 맞고, api를 여럿 띄우면 서로 모른다(한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) #30).
- **200인 이유** — 지우기는 수 초 안에 끝나 응답에 지운 양을 싣는다. 202로 비동기를 만들면 화면이 지운 양을 보이려고 다시 묻는 표면이 하나 더 생긴다.
- **B형 — 설비 가동 중 · 적체가 남은 동안 지우기를 막는 것은 불편이 아니라 결과의 참을 지키는 장치다.** 결론 — 가동이 켜져 있거나 끈 직후 수집기가 아직 돌면 plant_running, 대기줄에 적재 안 된 엔트리가 남으면 stream_backlog로 409다. 반대 시나리오 — 키만 보고 통과시키면 끈 직후의 마지막 폴링 · 창 버퍼 · 적체의 마지막 배치가 TRUNCATE 뒤에 들어와 "지웠는데 행 · 지금 값이 남았다"가 결함처럼 보이고, 응답의 지운 행 수와 지운 뒤 현황이 맞지 않는다(r5 검수 M4). 파생 지침 — 화면은 reason별로 "설비 가동을 끈 뒤 다시" · "잠시 뒤 다시"를 말한다 · 지우기가 가동을 대신 끄지 않는다.

## 응답 예시

flow 실행이 끝난 뒤의 #4 응답이다(예시 수치는 모양 설명용).

```json
{
  "runId": "b0c9e4d1-58a2-4f37-8e0b-6a1d2c3e4f50",
  "type": "flow",
  "status": "completed",
  "params": { "pps": 10000, "durationSec": 60, "bizPerSec": 1, "readsPerSec": 20 },
  "startedAt": "2026-09-28T06:00:00.000Z",
  "endedAt": "2026-09-28T06:01:02.410Z",
  "elapsedMs": 62410,
  "steps": [
    { "key": "prepare", "label": "시연 전용 설비 · flow 태그 확인", "status": "done", "startedAt": "2026-09-28T06:00:00.002Z", "endedAt": "2026-09-28T06:00:00.570Z", "elapsedMs": 568, "detail": { "devices": 1, "tags": 50, "tagsCreated": 0 } },
    { "key": "publish", "label": "발행", "status": "done", "startedAt": "2026-09-28T06:00:00.570Z", "endedAt": "2026-09-28T06:01:00.570Z", "elapsedMs": 60000, "detail": { "pointsSent": 600000, "entriesSent": 12000, "commandsSent": 60, "backpressurePauses": 0, "progress": 1, "readsSent": 1200, "readsFailed": 0, "readsSkipped": 0 } },
    { "key": "drain", "label": "적체 소진", "status": "done", "startedAt": "2026-09-28T06:01:00.570Z", "endedAt": "2026-09-28T06:01:02.410Z", "elapsedMs": 1840, "detail": { "drainMs": 1840, "timedOut": false } }
  ],
  "result": { "pointsSent": 600000, "entriesSent": 12000, "commandsSent": 60, "commandsOk": 59, "commandsPending": 1, "commandsFailed": 0, "backpressurePauses": 0, "drainMs": 1840, "readsSent": 1200 },
  "error": null
}
```

- commandsSent 60 = durationSec 60 × bizPerSec 1(명령 1건 = 1 · 전부 DEMO-FLOW-DEV) = commandsOk 59 + commandsPending 1 + commandsFailed 0 · entriesSent 12000 = 60초 × 200(pps 10000 ÷ flow 전용 태그 50 = 한 태그가 초마다 200점 → 5 ms 간격 200시각 · 같은 설비 · 같은 ts 한 엔트리) · readsSent 1200 = durationSec 60 × readsPerSec 20(건너뛴 조회 0 · 순환 2 : 2 : 1이라 시계열 480 · 지금 값 480 · 설비 목록 240).
- elapsedMs 62410 = endedAt − startedAt이다 — 화면의 "완료 — 총 소요 1분 2.4초"가 이 값 하나에서 나온다(REQ-GEN-19 · AC-46).
- 409 응답은 에러 봉투다 — {"error": {"code": "datagen.run_in_progress", "message": "…", "details": {"runId": "…", "type": "flow"}}}([01_conventions.md](./01_conventions.md) §에러 봉투).

## 원본에 없는 표면 판정

인계 두 건 — 생성기 실행 제어 표면 · 실행 중 주입 제어 표면의 필요 여부 — 를 닫는다. **판정 — 둘 다 두지 않는다.** 2026-09-28 사용자 요구로 **라이브 실행 제어(#2~#5)는 둔다** — 아래 표의 마지막 행이 그것을 두지 않는 후보들과 가르는 축이다.

| 후보 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 생성기 실행 · 정지(모드 A · B) | **두지 않는다** | 원본 API 표에 없다 · 기능 GEN-01~03 · 05의 표면 열이 "실행 인자" | 실행 표면을 열면 실행 조건(시드 · 모드)이 요청 본문으로 흩어져 기록 조건과 따로 논다 |
| 실행 중 주입 제어(SIM 지연 · 오류 주입 시작 · 해제) | **두지 않는다** | W4 판정 — 제어 수단은 기동 시 읽는 주입 계획 · 전환 = 재기동 원칙([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어) | 요청 시각이 실험 기록과 따로 놀아 "언제 장애를 넣었는가"가 기록에 없다 · 새 표면 · 방어 지점이 생긴다 |
| 생성기 상태 조회(진행률 · pps) | **두지 않는다** | 생성기 계측은 /metrics가 노출한다 · 기능 근거 없음 | 같은 수치가 두 표면에 있으면 화면이 어느 쪽을 읽는지에 따라 값이 다르다 |
| 모드 B 표면(Stream 직결 HTTP 대행) | **두지 않는다** | 모드 B의 정의가 HTTP를 거치지 않는 것이다 | HTTP를 거치면 옛 모드 C(D-16 폐지)와 같은 경로가 된다 |
| **라이브 실행 제어(EXP-FLOW 시연 실행)** | **둔다 — #2~#5**(2026-09-28) | 사용자 요구 2026-09-28 · GEN-12 · **측정 기록을 만들지 않는 시연**이라 위 첫 행의 실패(실험 조건이 요청 본문으로 흩어져 기록과 따로 논다)가 성립하지 않는다 — 기록이 없으니 어긋날 기록 조건도 없다 · 시드 · 모드를 요청으로 받지 않고 닫힌 매개변수(§매개변수)만 받는다 | 두지 않으면(옛 판정) 두 실증 화면이 "기록을 읽기만 하는 화면"에 머물러 시연 청중 앞에서 시작 · 중단 · 소요 시간을 보일 수 없다 — 사용자 요구 불충족 |

- 검산: 후보 = **5** · 둔다 1(라이브 실행 — 표면 4) · 두지 않는다 4
- **라이브 실행의 진행 수치와 /metrics는 같은 수치가 아니다** — 셋째 행(생성기 상태 조회)의 실패가 재발하지 않는 이유다. 실행 객체의 pointsSent는 그 실행 하나의 누계이고, /metrics의 gen_points_generated_total{mode="run"}은 프로세스 기동 이후 누계다(메트릭 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)). 화면은 실행 패널에 앞의 것을, 흐름도 카드에 뒤의 것을 쓴다.
- **"화면에서 생성기(모드 A)를 켜고 싶다"는 요구가 오면 이 표가 반론이다.** 라이브 실행은 모드 A의 원격 손잡이가 아니다 — 화면은 실행 패널 밖에 생성기 손잡이를 두지 않고 스위치는 각주 툴팁에 표시만 한다(docs_plan 보정 #14). 센서 자동 생성의 켜고 끄기는 설비 가동 스위치(RLT-10 · [06_realtime.md](./06_realtime.md) #3 · #4 — D-16)가 맡는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 라이브 실행 소요 시간(flow drain) | 3계층 미확인 — 확정 전 임의 값 고정 금지 · **시연값이라 확정 대상도 아니다**(기록 정본 아님) | [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) |
| #6 · #7 · #8의 저장소 불가 응답 | **미설계** — 지금은 run_result · ClickHouse · PostgreSQL 오류가 예외 필터를 지나 코드 없는 500이다(설계된 실패가 아니라 매핑이 없다) · common.postgres_unavailable · timeseries.clickhouse_unavailable 재사용 여부와 지우기 도중 실패의 부분 상태 표기는 다음 코드 수정 웨이브 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 출처 방어 · 멱등 · 봉투 · 시각 직렬화 · BFF 경유
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 실행 status #21 · step status #22 · 상태 머신 5
- [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) — 실행 패널(EXP-FLOW)
- [02_errors.md](./02_errors.md) — datagen 네임스페이스 미러
- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN 기능 목록
- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 계약
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — SIM 주입 제어 판정 · 라이브 실행 기전
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — Stream 엔트리 계약
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계
