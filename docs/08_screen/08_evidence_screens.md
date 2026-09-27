# 실증 화면 (08_evidence_screens)

> **대상**: EXP-PERF(규모별 성능 비교 — PostgreSQL 대 ClickHouse · 10^5~10^9행 · 격자 기록의 참고값 곡선 · 구조 판정 역전 구간 · 원리 증거 · 저장 비용) · EXP-FLOW(분산 처리 모니터링 — Redis Stream을 거치는 두 길 — 대용량 배치 경로와 업무 명령 경로(stream:biz:cmd)의 갈림과 처리를 flow 프레임으로 실시간 표시) · 두 화면의 **실행 패널**(라이브 실행 시작 · 중단 · 완료 · 소요 시간 — GEN-11 · GEN-12) — 인증 사용자 전원이 보고 시작 · 중단은 S7 뒤 ENGINEER · ADMIN
> **작성일**: 2026-09-27
> **개정일**: 2026-09-28 — 최종 검증 반영(v-wave2 M) — prepare 명령 "생성 3" → **생성 3 + 비활성 수정 1**(06_pipeline/10 · 07_api/04 생성 표면에 isActive 없음) · prepare 명령은 commandsSent 제외
> **개정일**: 2026-09-28 — r-run 검수 리드 판정 반영(.omc/run-fix-rulings.md) — 흐름 시연 업무 명령 "이름 토글 짝" 폐기 → **시연 전용 설비 DEMO-FLOW-DEV(비활성)에만 새 이름 명령 · 되돌림 없음**(prepare가 시연 전용 행 없으면 생성 명령 3) — 실행 발행 원천 계약 행 · EXP-FLOW 단계 목록 행 · M5 시작 · 중단 요청 실패 사건 행 신설(사건 8 → **9**) · L4 예상 디스크 = 행당 바이트 **상한값**(ClickHouse 5.4 B · 추정 상한 표기) · L5 진행 중 1시간 이상 "1시간 3분 12초" · L6 중단 버튼 활성 조건에 S7 뒤 ENGINEER · ADMIN — 요소 · 원천 · 계약 수 불변
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 "데이터 처리를 시작하는 버튼 · 중단 버튼 · 완료 표시 · 걸린 시간" · 리드 지침 .omc/run-control-brief.md) — 옛 판정 3(웹에 부하 · 장애 제어 버튼 없음) · 4(쿼리 레이스 범위 밖)를 뒤집는다 · 두 화면에 **실행 패널**(매개변수 선택 · 시작 · 중단 · 상태 칩 · 시작 시각 · 경과 시간 · 단계 목록 · 완료 띠 · 결과 표 · 라이브 곡선 계열(EXP-PERF) · 진행 막대(EXP-FLOW)) · **§실행 패널 — 두 화면 공통 규칙 신설**(버튼 상태 · 종결 표시 문구 · 경과 시간 계산 · 1초 폴링 · 409 · 404 처리) · 역할 · 요청 경로 메타 행(표시 전용 · api 표면 없음 → 실행 패널은 07_api/09_datagen #2~#5 BFF 경유 no-store) · 주 기능 GEN-11(EXP-PERF) · GEN-12(EXP-FLOW) · EXP-PERF 요소 9 → **19** · 원천 9 → **11** · 계약 8 → **11**(라이브 표지 · 라이브 계열 · 대용량 경고) · 부르는 자리 1 → **5** · 기능 0 → **1** · EXP-FLOW 요소 9 → **19** · 원천 8 → **10** · 계약 8 → **10**(라이브 표지 · 실행 발행 원천) · 부르는 자리 2 → **6** · 기능 4 → **5** · 미확인 등재 "시연 시나리오" · "쿼리 레이스" 행 닫힘 · 라이브 실행 시연값 크기 1행 신설
> **개정일**: 2026-09-28 — 웨이브 1 검수 판정 반영(f-screens · r-screens H1 · M1 · M2 · M4 · L1~L7) — 저장 비용 WAL 바이트 산식 삭제 → **WAL 증폭 비율만**(바이트는 기록 값이 있을 때만 — 051 · 052 index_bytes I2 buildWalBytes) · biz 요약 **role**(biz-writer · api-direct)로 direct 판별 · **failed**(PostgreSQL 불가 — ⚠ + 코드 · 도메인 거절 ✕와 구분) · Redis 카드에 biz_stream_lag · biz_commands_total(result) · 행당 바이트 **닫힘**(pg_table_live_tuples · ch_parts_rows) · structuralRanges 필드 정리 · P4 저장소 값 정규화 · 원리 증거 Q5x 제외 · 캐시 선택 미적용 · 참고값 배지 한 자리 · 053 axes 미사용 · gcTime 정본 링크 · H2 미확인 · 미설계 → **미확인 · 확정 대기 등재** — 요소 · 원천 · 계약 · 판독 수 불변
> **개정일**: 2026-09-28 — 표지 키 리드 재판정 — 구독 중 표지 **cache:flow:subscribed**(rt 봉인 계열은 TTL 금지) · 표지 읽기 실패 시 발행 안 함을 표시 계약 요약 없음 행 · B형 불릿에 — 계약 수 불변
> **개정일**: 2026-09-28 — 리드 판정 1~3 · 업무 쓰기 Redis 경유 개정 반영 — EXP-FLOW 업무 길을 명령 경로(api → stream:biz:cmd → 워커 grp:biz-writer → PostgreSQL 트랜잭션 → 무효화 → 결과 → api 응답)로 · 업무 점 · 목록 · 원천 · 표시 계약(업무 단계 순서 · SW-12 direct) · 스위치 영향 SW-12 행 · 두 화면 주 기능 없음 = **OBS 보조 실증 화면**(새 기능 ID 없음) · 미확인 1행 닫힘
> **원천**: 리드 지침 .omc/screens-perf-flow-brief.md(2026-09-27 · 화면 코드 채번 · 판정 1~4 — 판정 3 · 4는 2026-09-28 대체) · 리드 지침 .omc/run-control-brief.md(2026-09-28 · 라이브 실행 제어) · 사용자 요구 2026-09-28 "데이터 처리를 시작하는 버튼을 각 화면에 · 중단 버튼 · 완료 표시 · 시간 얼마나 걸렸는지" · [../07_api/09_datagen.md](../07_api/09_datagen.md) 실행 표면 #2~#5 · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) 라이브 실행 · 사용자 요구 "데이터 규모별 성능 비교 화면" · "업무 데이터와 대용량 데이터를 Redis로 분산시켜 처리하는 것을 모니터링할 화면" · "실시간으로 한 눈에 이동하고 처리되는 게 보이도록" · 사용자 결정 2026-09-27(모든 데이터가 Redis를 거쳐 분산 처리 — 업무 쓰기 명령 스트림) · 리드 지침 .omc/biz-via-redis-brief.md · [README.md](./README.md) 화면 인벤토리 · [01_standards.md](./01_standards.md) 명세 템플릿 · [07_experiment_console.md](./07_experiment_console.md) §대조군 역전 지점 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과 · §원리 대응 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기계 판독 블록 · §기록 상태와 정정 · [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 · [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) · [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로 · [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) · 측정 기록 048~053 기계 판독 블록

이 문서는 학습 목표 ①(저장소 선택의 근거)과 저장소 분리 설계(3계층 분기)를 **사람이 한 화면에서 보는 자리 두 곳**을 명세한다. 두 화면은 기록 · 관찰 표시에 더해 **실행 패널** 하나씩을 갖는다 — EXP-PERF는 두 저장소에 같은 규모 · 같은 쿼리를 라이브로 돌리는 perf 실행(GEN-11), EXP-FLOW는 대용량 발행과 업무 명령을 함께 흘리는 flow 실행(GEN-12)을 시작 · 중단하고 완료와 소요 시간을 보인다(사용자 요구 2026-09-28 — 옛 판정 "웹에 부하 · 장애 제어 버튼을 두지 않는다"를 대체). 패널이 시작하는 것은 이 두 실행 종류뿐이고 저장소 정지 같은 장애 주입 버튼은 없다 — 장애는 여전히 호스트 셸의 스크립트가 일으킨다.

**두 화면의 수치는 측정 기록이 아니다.** EXP-PERF는 기록을 읽어 그리지만 격자 기록 048~053이 전부 discarded라 ms 곡선은 **참고값**이고(리드 판정 1 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정의 화면 참고값 예외), EXP-FLOW는 지금 돌고 있는 시스템의 순간 관찰이다. 정본 문장이 인용하는 것은 기록의 구조 사실 · 결정적 값뿐이고 화면 수치를 인용하지 않는다. **라이브 실행 결과도 기록이 아니다** — 앱(api)을 거쳐 재므로 결과에 항상 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지를 달고, 측정 기록(docs/measurements)을 만들지 않으며, 곡선에서 기록 계열과 다른 계열 · 다른 마커로 그린다(리드 판정 공통 1 — 대조 쿼리는 앱을 거치지 않는다는 [07_experiment_console.md](./07_experiment_console.md) §스위치별 비교 대상 A형과 충돌하지 않는 이유).

## EXP-PERF — 규모별 성능 비교

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-PERF |
| 웹 경로 | /experiments/perf |
| 페르소나 | 실험 수행자(주) · 시연 청중 |
| 역할 | 보기 — S7 이후 인증 사용자 전원 · 원천이 git에 있는 기록 파일이라 역할로 막을 것이 없다(EXP-COMPARE와 같은 판정) · **실행 패널의 시작 · 중단 — S7 이후 ENGINEER · ADMIN**(실험 수행 · 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가) · S2~S6 무인증 |
| 도입 단계 | S5 — 격자 2차 기록 048~053 이후 |
| 요청 경로 | 곡선 · 표 — **BFF 기록 읽기**(api 표면 아님) — Next.js BFF가 docs/measurements를 읽기 전용으로 읽고 판독 결과만 내린다(EXP-COMPARE 역전 지점 패널과 같은 경로 · 다른 판독 보기) · 실행 패널 — **브라우저 → BFF → api 표면 4**([../07_api/09_datagen.md](../07_api/09_datagen.md) #2~#5 · no-store) |

**목적**: 행 수가 10^5에서 10^9로 늘 때 쿼리마다 어느 저장소가 앞서고, 역전은 어느 구간에서 일어나며, 그 까닭이 읽은 양과 저장 구조의 어디에 있는가 — 그리고 같은 쿼리를 지금 이 머신에서 규모를 올려 가며 돌리면 어떻게 보이는가(라이브 실행 · 시연값).

**진입**: 좌측 내비 실험 섹션 · EXP-COMPARE 대조군 역전 지점 패널의 "규모별 자세히" 링크. 진입 파라미터 q(Q1~Q5 · 기본 Q2) · cache(warm · cold · 기본 warm) — 딥링크는 이 두 값으로 곡선 · 결론 카드가 열린다.

```plain
┌─ 툴바 ─ 쿼리 [Q1 Q2* Q3 Q4 Q5] · 캐시 [웜* 콜드] · 세로 [로그* 선형] · 원천 기록 053(+048~052) · 판독 10:15:03 KST ─┐
├─ 실행 패널 ─ 최대 규모 [10^5 10^6 10^7* 10^8] [▶ 시작] [■ 중단] · ● 실행 중 · 시작 10:20:05 KST · 경과 1분 42초 · 단계 ▾ ─┤
│   ✓ prepare 0.3초 · ✓ fill-ch@5 · ✓ fill-pg@5 · ✓ query@5 · ◐ fill-ch@6 4.1초 · ○ … · ○ cleanup                          │
│   (종결 뒤) 완료 — 총 소요 3분 12.4초 · 종료 10:23:17 KST   · 라이브 결과 표 ▾ 규모 × Q1~Q5                           │
├─ 참고값 배지 ─ ⚠ 참고값 — 편차 기준 초과(구조 판정만 정본) · 기록 048~053 discarded · 막대 = 반복 3회 최소~최대 ─────┤
├─ 규모 곡선 ───────────────────────────────────────────────────┬─ 결론 카드 ──────────────────────┤
│  ms(로그)                                                      │ Q2 단일 태그 7일 · 웜             │
│   │            ░░░░ 역전 구간 (10^7.5, 10^8.25] I2 → CH         │ I2 대비 (10^7.5, 10^8.25]         │
│   │  PG I1 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄             │   PostgreSQL I2 → ClickHouse      │
│   │  PG I2 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╳┄┄┄┄┄┄┄┄┄┄┄┄┄             │ I1 대비 10^5~10^9 ClickHouse 우세  │
│   │  CH    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄             │ 우열 미정 10^8 웜                 │
│   │  라이브 CH ◇──◇──◇  라이브 PG I2 ◆──◆──◆ (시연값)            │                                  │
│   └──10^5──10^6──10^7──10^8──10^9── 행(로그 · 점 11)             │ PostgreSQL이 앞서는 경우 — 목록   │
├─ 배수 히트맵 ─ 행 11 × Q1~Q5 · 칸 = PG ÷ CH(참고값) · 색 = 3/3 우열(정본) · ? = 우열 미정 · 변형 [I2* I1] ──────┤
├─ 원리 증거 ─ 규모 [10^9*] · 쿼리별 CH 읽은 바이트 ÷ 논리 · PG 버퍼 블록 ÷ 힙 · 계획 노드 · 병렬 작업자 ─────────┤
├─ 저장 비용 ─ 행당 저장 B · 압축률 · 인덱스 B(CH · BRIN · btree) · PG WAL 증폭 — 결정적 값 · 단계 5 ────────────────┤
├─ 조건 표지 ─ 자원(cpuset · 메모리) · 4요소 · CH trace 로그 한계 · 동률 규칙 · 서버 µs 비대칭 · 콜드 근사 ───────────┤
└─ 판독 계수 줄 ─ 원천 기록 · 단계 기록 · 판독 불가 · 4요소 누락 · 형식이 어긋난 행 · 그리지 않은 점 · "관찰 보조 — 기록 정본 아님" ┘
```

- **곡선은 참고값이고 음영은 정본이다.** 선 위의 ms는 discarded 기록의 중앙값이라 크기를 인용하지 않는다. 역전 구간 음영과 결론 카드는 기록 053 structuralRanges(반복 3회 우열 일치 — 구조 판정)만 쓴다 — 곡선의 교차점과 음영이 어긋나면 음영이 맞다(중앙값 교차는 한 반복의 흔들림으로도 움직인다).
- **흔들림을 숨기지 않는다.** 점마다 반복 3회의 최소~최대 막대를 함께 그린다 — 막대가 겹치는 구간은 우열 미정 점과 대개 같은 자리이고, 겹침을 보여야 참고값 배지의 뜻이 눈에 보인다.
- **라이브 계열은 곡선 위에 겹치되 음영 · 결론 카드 · 히트맵에 들어가지 않는다.** 라이브 실행은 반복 3회 웜 · 앱 경유 · 단계 5 격자의 앞부분(정밀화 점 없음)이라 구조 판정의 조건을 갖추지 못한다 — 역전 음영은 여전히 기록 053 structuralRanges만 쓴다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 툴바 | 머리 | 쿼리 Q1~Q5 · 캐시 웜/콜드 · 세로 로그/선형 선택 · 원천 기록 번호 · 판독 시각(KST · 밀리초) · 새로고침 | 해당 없음 — 화면 동작 | BFF 기록 읽기(새로고침) |
| 참고값 배지 | 툴바 아래 | 원천 기록 가운데 discarded가 하나라도 있으면 상시 표시 · 문구 "참고값 — 편차 기준 초과(구조 판정만 정본)" · 해당 기록 번호 · 전부 valid면 배지 없음 | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 규모 곡선 | 본문 왼쪽 | ECharts 선 · 가로 행 수(로그 · 점 11 = 단계 5 + 정밀화 6) · 세로 ms · 선 3(ClickHouse · PostgreSQL I1 · I2) · 점 = client 중앙값 · 반복 최소~최대 막대 · discarded 점선 · 회색 · 역전 구간 음영 · 우열 미정 점 표지 · 툴팁(3회 값 · 서버 µs 중앙값 · 판정 기준 · 결과 일치 · 4요소) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 결론 카드 | 본문 오른쪽 | 선택 쿼리 · 캐시의 structuralRanges 행을 문장으로 — I2 대비 · I1 대비 구간 또는 "역전 없음 — 앞선 쪽 · 범위" · 우열 미정 점 · 전 쿼리의 "PostgreSQL이 앞서는 경우" 목록(winner postgresql 행과 역전 전 구간) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 배수 히트맵 | 곡선 아래 | 행 11 × 쿼리 5 · 칸 숫자 PG ÷ CH 중앙값 배수(참고값 · 소수 1자리) · 칸 색 = 그 점의 3/3 우열(정본 — 빠른 쪽 저장소 색 · 미정은 무채색 ?) · PG 변형 I2/I1 전환 · 캐시는 툴바를 따른다 | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 원리 증거 | 히트맵 아래 | 규모 선택(단계 5점 — scan 필드가 있는 기록만) · 쿼리 5행(Q1~Q5 — scan의 Q5x 행은 곡선과 같은 이유로 뺀다 · §판독 규칙 아래 auxPoints 불릿) · 툴바 캐시 선택은 적용하지 않는다(scan에 cache 필드가 없다 — 칸 머리에 "캐시 구분 없음") × (CH read_rows · read_bytes ÷ 공통 논리 크기 · PG I1 · I2 버퍼 블록 ÷ 힙 블록 · 계획 노드 · 병렬 작업자 · 결과 행) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 저장 비용 | 원리 증거 아래 | 단계 5행 × (행당 저장 바이트 CH · PG · 압축률 CH · PG · 인덱스 바이트 CH · BRIN · btree · PG WAL 증폭 비율) · "결정적 값 · 기록 NNN · discarded" 표지 · 053 정밀화 6점의 axes는 싣지 않는다(원리 증거 scan이 단계 5점에만 있어 두 표의 규모 행을 맞춘다) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 조건 표지 | 바닥 위 | 원천 기록의 run · conditions에서 자원(cpuset · storeResources · controlMemoryMb · clickhouseMaxThreads · pgMaxParallelWorkersPerGather) · 4요소 · clickhouseServerLogLevel(trace 한계) · tieRule · serverTimeAsymmetry · cacheDefinition(콜드 근사) | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 판독 계수 줄 | 바닥 | 원천 기록 번호 · 단계 기록 번호 · 판독 불가(파일명) · 4요소 누락 · 형식이 어긋난 행 · 그리지 않은 점 · "관찰 보조 — 기록 정본 아님" | 해당 없음 — 측정 기록 읽기 | BFF 기록 읽기 |
| 매개변수 선택 | 실행 패널 | 최대 규모 maxExponent 10^5 · 10^6 · 10^7(기본) · 10^8 — 실행 규모는 10^5부터 10^max까지 단계 5 격자의 앞부분(정밀화 점 없음) · 10^8을 고르면 시작 버튼 옆에 예상 디스크(PostgreSQL 힙 + btree · ClickHouse)와 "수 분 이상 걸린다" 경고(§표시 계약 대용량 경고 행) · 실행이 진행 중이면 잠기고 그 실행의 params를 보인다 | GEN-11 | POST /api/v1/runs(본문 params) |
| 시작 | 실행 패널 | POST /api/v1/runs {type: 'perf', params} · 활성 조건 · 409 처리는 §실행 패널 — 두 화면 공통 규칙 | GEN-11 | POST /api/v1/runs |
| 중단 | 실행 패널 | POST /api/v1/runs/{runId}/stop · perf 실행이 running일 때만 활성 · 누르면 "중단 중…"으로 바뀌고 종결까지 비활성 | GEN-11 | POST /api/v1/runs/{runId}/stop |
| 상태 칩 | 실행 패널 | status 5값 → 실행 중 · 중단 중 · 완료(초록) · 중단됨(회색) · 실패(빨강) · 실행 기록이 없으면 "실행 없음" | GEN-11 | GET /api/v1/runs/current · GET /api/v1/runs/{runId} |
| 시작 시각 | 실행 패널 | startedAt(UTC ISO 8601 Z) → KST 초까지 "HH:MM:SS KST" | GEN-11 | 상동 |
| 경과 시간 | 실행 패널 | 진행 중 — 서버 elapsedMs에서 1초 틱으로 이어 센다 · 종결 — endedAt − startedAt · 형식 "3분 12.4초"(§실행 패널 — 두 화면 공통 규칙 경과 시간) | GEN-11 | 상동 |
| 단계 목록 | 실행 패널 아래(접기 가능 · 기본 펼침) | steps[] 순서 그대로 — key prepare → 규모마다 fill-ch@{지수} · fill-pg@{지수}(ANALYZE 포함) · query@{지수}(Q1~Q5 × 두 저장소) → cleanup(key 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md)) · 단계마다 상태 아이콘 · label · 소요 · detail 한 줄 요약 | GEN-11 | 상동 |
| 완료 띠 | 실행 패널 오른쪽 | 종결 3상태 문구(완료 · 중단됨 · 실패 — §실행 패널 — 두 화면 공통 규칙) · 다음 시작 전까지 유지 | GEN-11 | 상동 |
| 라이브 결과 표 | 단계 목록 아래(접기 가능) | result.scales[] 행(규모 10^N · 행 수) × Q1~Q5 칸 — CH · PG I2 중앙값 · 빠른 쪽 · 배수 PG ÷ CH(소수 1자리) · 결과 행 수가 다르면 "결과 불일치" · 규모 행 끝에 적재 시간(fillMs CH · PG) · 저장 바이트(storageBytes CH · PG) · 표 머리에 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" | GEN-11 | 상동 |
| 라이브 곡선 계열 | 규모 곡선 | 계열 2(라이브 CH · 라이브 PG I2) — 툴바 쿼리의 result 중앙값 · 기록 계열과 다른 마커(속 빈 마름모 ◇ · 속 찬 마름모 ◆) · 범례 "라이브 실행(시연값)" · 툴팁 3회 값 · 결과 행 수 일치 · 툴바 캐시가 콜드면 숨기고 곡선 머리에 "라이브 실행은 웜만" | GEN-11 | 상동 |

- 검산: 요소 = 기록 판독 9 + 실행 패널 10 = **19** · 이 화면이 호출하는 기능 = GEN-11 = **1**(주 화면 — 실행 패널 요소 10) · 기록 판독 요소 9는 원천이 api 표면이 아니라 BFF 기록 읽기라 기능 ID가 붙지 않는다(EXP-COMPARE 역전 지점 · 실증 요약 패널과 같은 사정) · 분류 정본 [02_traceability.md](./02_traceability.md)
- **요소 표에 삽입 처리량이 없다.** insert_rows_per_sec는 비 쿼리 축이지만 시간을 재는 크기 수치라 결정적 값이 아니다([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §기록 상태와 정정) — 같은 배치를 받는 두 싱크의 시간은 valid 기록 045가 재고 EXP-COMPARE 실증 요약 패널이 그린다.
- **ClickHouse write_amplification도 그리지 않는다.** 머지 증폭은 머지 시점에 좌우되어 결정적 값이 아니다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6) — PostgreSQL 쪽 WAL 증폭만 저장 비용에 싣는다.

### 데이터 원천

실행 패널 2행을 뺀 나머지는 모두 기계 판독 블록(schema measurement/v1)의 필드다. 실행 패널 2행은 기록이 아니라 api 메모리의 실행 객체이고(필드 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md)) 판독 규칙 P1~P6을 적용하지 않는다. 기록마다 이름이 다른 필드는 판독기가 둘 다 읽어 한 모양으로 맞춘다 — 아래 "기록별 이름" 열이 그 대응이다.

| 화면 값 | 기록 필드 | 기록별 이름 | 인용 성격 |
|------|------|------|------|
| 곡선 점 · 막대 | points[] — query · rows · store · index · cache · values · median · resultMatch | 048~053 같다 · 053은 point(정밀화 점 이름 r5.5 등)를 더 싣는다 | 참고값(크기) |
| 서버 µs 툴팁 | 서버 3회 값 · 중앙값 | 048~050 server.values · server.median / 051~053 serverValues · serverMedian | 참고값(크기) |
| 판정 기준 툴팁 | 편차 판정 기준(client · server) · 편차 | 048~050 judgment.basis · judgment.deviation / 051 · 052 deviationBasis · deviation / 053 judgmentBasis · deviation | 참고값 |
| 점 단위 3/3 우열(히트맵 색) | 반복별 우열과 합의 | 048~050 dominance[](reps "CH" · "PG" · unanimous · winner) / 051 · 052 pairVerdicts[](repWinners · structuralWinner · tieWithinResolution · decidedBy) / 053 점 단위 판정 없음 — structuralRanges에서 계산(아래 판독 규칙 P4) | 구조 사실 |
| 역전 구간 음영 · 결론 카드 | structuralRanges[] — query · cache · pgVariant · crossover · winner · range · undetermined | 053만 · 방향(from · to)은 structuralRanges 행에 없다 — crossovers[](query · cache · pgVariant · from · to)에서 같은 키로 찾는다 | 구조 사실(정본) |
| 원리 증거 | scan[] — ClickHouse readRows · readBytes · resultRows / PostgreSQL sharedHitBlocks · sharedReadBlocks · tempReadBlocks · workersLaunched · actualRows · nodes | 048~052(053 없음) · nodes · executionMs는 051 · 052만 — 없으면 "계획 노드 기록 없음" | 구조 사실 · 결정적 값 |
| 저장 비용 | axes[] — storage_bytes · compression_ratio · index_bytes · write_amplification(PostgreSQL만 · 비율 그대로) | 048~052 단계 1점씩(053 정밀화 6점 axes는 읽지 않는다) · 051 · 052 index_bytes I2에 buildWalBytes · buildSec — **WAL 바이트는 이 값이 있을 때만 싣는다**(I2 인덱스 생성 WAL · 적재 WAL 아님) | 결정적 값 |
| 조건 표지 | run(commitHash · memoryProfile · memoryLimitMb · capacityTier · memoryLimitSource) · switches · conditions(storeResources · cpuset · controlMemoryMb · clickhouseMaxThreads · pgMaxParallelWorkersPerGather · clickhouseServerLogLevel · tieRule · serverTimeAsymmetry · cacheDefinition) · repeat | 048~053 같다 | 조건 |
| 단계 기록 목록 | conditions.stageRecords(단계 번호 → 기록 번호) | 053만 | 원천 선택 |
| 실행 패널(상태 칩 · 시각 · 경과 · 단계 · 완료 띠) | 실행 객체 — runId · type · status · params(maxExponent) · startedAt · endedAt · elapsedMs · steps[](key · label · status · startedAt · endedAt · elapsedMs · detail) · error(code · message) | 기록 아님 — GET /api/v1/runs/current · GET /api/v1/runs/{runId} · 시작 · 중단 응답 | 시연 상태(라이브) |
| 라이브 결과 표 · 라이브 곡선 계열 | 실행 객체 result.scales[] — exponent · rows · fillMs(ch · pg) · storageBytes(ch · pg) · queries[](q · ch(values · median · rows) · pg(values · median · rows) · winner · ratio · resultMatch) | 상동 | 시연값(라이브 · 기록 정본 아님) |

- 검산: 원천 행 = 기록 9 + 실행 객체 2 = **11**
- **분모는 기록 안에서 만든다 — 화면 상수를 두지 않는다.** 공통 논리 크기 = rows × 41 B([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6의 공통 논리 41 B) · 힙 블록 = 같은 기록 Q5 I1의 sharedHitBlocks + sharedReadBlocks(Seq Scan이 힙 전부를 읽는다 — §원리 대응의 분모 9,345,856블록과 같은 값) · 행당 저장 바이트 = storage_bytes ÷ rows. 41 B 하나만 설계 상수이고 판독기 상수로 두며 05_data_stores/10과 같은 변경 단위에서 따라간다.
- **버퍼 블록은 hit + read다**(05_data_stores/10 §원리 대응의 통일). read만 쓰면 웜에서 0에 가까워져 BRIN 붕괴 · btree 페이지 방문 같은 구조가 사라진다. 100%를 넘는 칸(Q3 I2 128.2%)은 방문 횟수라서다 — 툴팁에 그 문장을 싣는다.

### 판독 규칙

EXP-COMPARE와 같은 BFF 판독 규칙([../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §BFF 판독 규칙) 1 · 2 · 4 · 6 · 7을 따르고, 규칙 3(status valid)과 규칙 5(편차)를 **참고값 표시로 바꾼다**(리드 판정 1).

| # | 규칙 | 어기면 |
|:--:|------|------|
| P1 | **원천 기록** — EXP-COMPARE §대조군 역전 지점의 구조 판정 원천 선택과 같은 하나(exp에 EXP-01~05 · structuralRanges 배열 · 4요소 완비 · superseded 제외 · 번호가 가장 큰 것) | 두 화면이 다른 기록의 구간을 정본으로 보인다 |
| P2 | **단계 기록** — 원천 기록 conditions.stageRecords가 가리키는 기록만 곡선 · 원리 증거 · 저장 비용에 더한다 · 목록이 없으면 원천 기록의 점만 그리고 계수 줄에 "단계 기록 목록 없음" · 목록의 기록이 superseded · 판독 불가 · 4요소 누락이면 빼고 센다 | 1차 격자(035~039 — 역방향 적재로 BRIN이 무너진 조건)의 점이 같은 선에 섞여 가짜 꺾임이 생긴다 |
| P3 | **참고값 표지** — status discarded 점은 그리되 점선 · 회색 · 참고값 배지 · 편차 초과 칸(repeat.threshold를 넘는 점 편차)은 툴팁에 "편차 N% > 기준" · status valid 점은 실선 | 폐기 기록의 크기가 정본 곡선으로 읽히거나, 반대로 격자 실측 전체가 화면에서 사라진다 |
| P4 | **점 단위 우열** — dominance winner(unanimous true) 또는 pairVerdicts structuralWinner가 있으면 그 쪽 · null이면 미정 · 저장소 값은 한 모양으로 정규화한다(dominance의 reps · winner "CH" → clickhouse · "PG" → postgresql — pairVerdicts · structuralRanges · crossovers의 값) · 053 정밀화 점은 structuralRanges 행에서 계산(undetermined에 그 점 지수가 있으면 미정 · crossover가 있으면 a 이하는 from · b 이상은 to · null이면 winner · 방향을 찾지 못하면 "방향 미상" 빗금) · 행 수 → 지수는 log10을 0.25 단위로 반올림 | 중앙값 비로 색을 칠하면 반복 사이에 뒤집힌 점이 한쪽 우세로 보인다 |
| P5 | **같은 점 중복** — 같은 (query · rows · store · index · cache)가 두 기록에 있으면 번호가 큰 기록 | 재측정과 옛 측정이 한 점에 겹친다 |
| P6 | **그리지 않은 점** — median null · 로그 축의 0 이하 · unit이 ms가 아닌 점은 그리지 않고 "그리지 않은 점 N"으로 센다(0이어도 보인다) · resultMatch false 점은 속 빈 점 · Q5x 등 auxPoints는 곡선에 싣지 않는다 | 0 ms가 "비용 없음"으로 읽히거나 결과가 다른 두 쿼리의 속도가 비교된다 |

- 검산: 판독 = **6** — 공통 규칙 5개(1 · 2 · 4 · 6 · 7) 적용 + 3 · 5 대체
- **auxPoints(Q5x — 조건 없는 count)를 곡선에서 빼는 이유** — ClickHouse는 파트 메타데이터로 답해 데이터를 읽지 않는다(05_data_stores/10 §동일 쿼리 5종 A형). 한 축에 두면 "ClickHouse 전체 스캔 1 ms"로 읽힌다.

### 표시 계약

| 계약 | 내용 | 어기면 |
|------|------|------|
| 가로축 | 행 수 로그 · 눈금 10^5 · 10^6 · 10^7 · 10^8 · 10^9 · 정밀화 점은 눈금 없이 점만 · 툴팁에 "10^7.25 = 17,780,000행" | 선형 축이면 10^5~10^8이 한 픽셀에 눌려 역전 구간이 안 보인다 |
| 세로축 | ms 로그 기본 · 선형 전환 · 단위 표기 "ms · client 중앙값(참고값)" | 선형 기본이면 PostgreSQL I1 10^9(수십 초)가 ClickHouse 전 구간을 바닥선으로 만든다 |
| 역전 음영 | structuralRanges의 선택 쿼리 · 캐시 · pgVariant I2 행의 (10^a, 10^b] 반개구간 · 음영 안에 "I2 → ClickHouse"(방향) · I1 행은 결론 카드에만 · 역전 없음이면 음영 없이 곡선 머리에 "관측 범위 10^a~10^b 역전 없음 — 앞선 쪽" | 교차점 하나를 찍으면 구간 폭(10^0.25 · 10^0.5 · 10^0.75) 안의 교차 위치가 정해진 것처럼 읽힌다 |
| 우열 미정 | undetermined 점과 P4 미정 점에 ? 표지 · 결론 카드에 "우열 미정 10^8 웜" | 미정 점이 앞 · 뒤 어느 쪽에 붙어 구간이 실제보다 좁게 보인다 |
| 참고값 배지 | discarded 점이 하나라도 그려지면 툴바 아래 배지 하나(곡선 · 히트맵 · 결론 카드 전체에 걸린다 — 요소 표 · 와이어프레임과 같은 자리) · 문구 고정 "참고값 — 편차 기준 초과(구조 판정만 정본)" | 캡처한 화면 한 장이 정본 수치처럼 돈다 |
| 결정적 값 표지 | 원리 증거 · 저장 비용 칸은 "결정적 값 · 기록 NNN · discarded" 또는 "구조 사실 · 기록 NNN · discarded" · 참고값 배지를 달지 않는다 | 인용 가능한 값까지 참고값으로 묶여 원리 설명의 근거가 약해 보인다 |
| 한계 표지 | 조건 표지에 셋을 상시 — ① ClickHouse 측정에 trace 로그 쓰기 부하 포함(clickhouseServerLogLevel) ② 동률 점은 서버 µs로 판정했고 PostgreSQL 서버 값은 계획 시간을 뺀다(serverTimeAsymmetry — client만이면 콜드 Q1 · Q2 · Q3 구간이 다르다) ③ 콜드는 컨테이너 재기동 직후 1회 근사(OS 페이지 캐시 미비움) | 콜드 구간이 확정값으로 읽힌다([07_experiment_console.md](./07_experiment_console.md) §대조군 역전 지점 구조 판정 한계와 같은 문장) |
| 색 | 저장소 색 2(ClickHouse · PostgreSQL) · I1 · I2는 같은 색의 선 모양으로 가른다 · 히트맵은 두 저장소 색의 발산 · 미정 무채색 | 변형마다 색을 주면 "저장소 셋"으로 읽힌다 |
| 라이브 표지 | 라이브 결과 표 머리 · 곡선 범례 · 완료 띠 옆에 고정 문구 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" · 참고값 배지와 따로 둔다(원천이 다르다) · 라이브 값은 결론 카드 · 역전 음영 · 배수 히트맵에 넣지 않는다 | 앱 경유 시연값이 앱을 거치지 않는 대조 쿼리 기록과 같은 급으로 읽히고, 캡처 한 장이 측정 기록처럼 돈다 |
| 라이브 계열 | 저장소 색은 기록과 같게 두고(색 계약) 모양으로 가른다 — 기록 계열은 원 마커 · discarded 점선 · 라이브 계열은 마름모 마커(CH ◇ · PG I2 ◆) · 실선 · 반복 막대 없음(3회 값은 툴팁) · 라이브 점은 실행이 채운 규모만 · PostgreSQL은 I2만 | 라이브 점이 기록 선에 이어져 한 선처럼 읽히거나 계열이 "저장소 넷"으로 읽힌다 |
| 대용량 경고 | maxExponent 8을 고르면 시작 전에 예상 디스크와 "수 분 이상 걸린다"를 보인다 · 예상 디스크 = 10^8 × 행당 바이트(규모를 올릴 때 앞 규모에 이어 채우므로 마지막 행 수가 곧 테이블 행 수) · 행당 바이트는 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과의 비교 축 6 결정적 값의 **상한값**(현행 참고 — PostgreSQL 힙 76.6 B + btree I2 31.6 B · ClickHouse 5.4 B — 관측 범위 4.40~5.37 B의 위쪽)을 판독기 상수로 두고 화면에 "예상 디스크(추정 상한)"로 표기하며 41 B와 같이 05_data_stores/10과 같은 변경 단위에서 따라간다 · 10^7 이하는 경고 없음 | 10^8 실행이 디스크를 채우거나 몇 분 동안 멈춘 화면으로 읽혀 중단 · 재시작이 반복된다 |

- 검산: 계약 = 기록 판독 8 + 실행 패널 3 = **11**
- **"PostgreSQL이 앞서는 경우"를 결론 카드에 반드시 둔다.** 이 화면의 목적은 "ClickHouse가 빠르다"가 아니라 쿼리마다 역전 지점이 다르다는 것이다 — 단일 태그 1시간(Q1) 웜 I2는 10^9까지 PostgreSQL이 앞서고, 이 사실이 빠지면 화면이 한 숫자 요약이 된다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §예상 결과).

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 툴바 · 배지 자리 · 곡선 축 틀 · 히트맵 격자 · 표 머리를 먼저 그리고 응답이 오면 채운다 — 이전 판독 결과가 있으면 흐리게 유지 · 실행 패널은 GET /api/v1/runs/current 응답 전까지 시작 · 중단 비활성과 상태 칩 자리만(진행 중 실행을 모른 채 시작을 켜지 않는다) |
| 빈 값 | ① 원천 기록 없음(structuralRanges 기록 0) — "EXP-01~05 구조 판정 기록이 아직 없다" · 곡선 · 히트맵 자리에 같은 문구 · 판독 계수 줄은 보인다 ② 원천은 있고 단계 기록 없음 — 원천 기록의 정밀화 점만 곡선에 · 원리 증거 · 저장 비용은 "단계 기록 없음(scan · 단계 axes)" ③ 선택 쿼리 · 캐시의 structuralRanges 행 없음 — 결론 카드 "이 쿼리 · 캐시의 구조 판정 행이 없다" ④ 실행 기록 없음(current의 run null · 또는 마지막 실행이 flow) — 상태 칩 "실행 없음" · 결과 표 · 라이브 계열 없음 · "아직 실행하지 않았다(api를 재기동하면 지난 실행은 남지 않는다)" |
| 오류 | 기록 읽기 실패(BFF 500 · 네트워크) → 본문 머리 띠 "기록을 읽지 못했다" · 앞서 판독한 결과 유지 · 판독 불가 · 4요소 누락 · 형식 위반은 오류가 아니라 계수 줄의 수 · 실행 표면 — datagen.run_in_progress/409 · common.not_found/404 · common.validation_failed/400 · 폴링 실패는 §실행 패널 — 두 화면 공통 규칙(실행 패널 안에서만 표시 · 곡선 · 표는 그대로) · 인증 계열(S7 — 시작 · 중단의 auth.forbidden/403 포함)은 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 곡선(참고값 배지) · 음영(정본) · 결론 카드 · 히트맵 · 원리 증거 · 저장 비용 · 조건 표지 · 계수 줄 · 판독 시각(KST · 밀리초) · 바닥 "관찰 보조 — 기록 정본 아님" · 실행 패널 — 진행 중(칩 · 경과 틱 · 단계 목록) 또는 종결 띠 · **status failed는 오류 행이 아니라 정상 행의 실패 띠다**(200 응답 안의 실행 결과 — [01_standards.md](./01_standards.md) §상태 4행) · 라이브 결과 표 · 라이브 계열(라이브 표지) |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| BFF 기록 읽기 — 성능 보기(api 표면 아님) | 진입 · 새로고침 | BFF가 docs/measurements를 읽기 전용으로 — EXP-COMPARE와 같은 라우트의 성능 보기(웹 내부 계약 · 응답 모양은 [07_experiment_console.md](./07_experiment_console.md) §미확인 · 확정 대기 등재의 BFF 해석 결과 모양 행과 같은 성격) | perf — 원천 기록 번호 · status · 4요소 · 조건 표지 필드 · 단계 기록 번호 목록 · 정규화한 점(query · rows · exponent · store · index · cache · values · median · serverMedian · resultMatch · 기록 번호 · status) · 점 단위 우열 · structuralRanges 행(방향 보강) · scan · axes · 판독 계수 |
| POST /api/v1/runs([../07_api/09_datagen.md](../07_api/09_datagen.md) #2) | 시작 클릭 | 브라우저 → BFF → api · no-store | 202 실행 객체(runId · status running · startedAt · elapsedMs · steps) · 409 datagen.run_in_progress의 details(runId · type) · 400 |
| GET /api/v1/runs/current(#3) | 진입 1회 · 어떤 실행이든 running · stopping인 동안 1초 폴링 · 종결되면 멈춘다 · 시작 202 · 409 · 중단 응답 뒤 폴링 재개 | 상동 | run — 진행 중 실행 또는 마지막으로 끝난 실행 · 없으면 null |
| GET /api/v1/runs/{runId}(#4) | 시작 409 뒤 details.runId로 1회(다음 current 폴링을 기다리지 않고 패널을 맞춘다) | 상동 | 실행 객체 전 필드 · 404면 current 재조회 |
| POST /api/v1/runs/{runId}/stop(#5) | 중단 클릭 | 상동 | 202 실행 객체(status stopping) · 200 이미 종결된 실행 그대로 · 404 |

- 검산: 부르는 자리 = BFF 기록 읽기 1 + api 표면 4(09_datagen #2~#5) = **5**
- **기록 읽기는 폴링하지 않는다.** 기록은 커밋으로만 바뀐다 — 진입과 새로고침 두 번이면 충분하고, 폴링은 파일 읽기를 반복할 뿐이다. 1초 폴링은 실행 패널의 #3(current) 하나이고 running · stopping 동안뿐이다.
- **캐시 층** — 브라우저 쿼리 키 measurements · perf · staleTime 0(서버 층 없음 · BFF no-store) · gcTime은 시계열 행과 같은 짧은 값(현행값 정본 [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) §gcTime) — 응답이 수백 KB라서다(정밀화 180점 + 단계 30점 × 5). 실행 쿼리 키 runs · current · runs · {runId} · staleTime 0 · 서버 층 없음(실행 상태는 api 인스턴스 메모리 · BFF no-store) — [01_standards.md](./01_standards.md) §갱신 주기와 캐시 층 정렬의 라이브 실행 행.

### 스위치 영향

- 해당 없음 — 이 화면은 현재 기동의 스위치가 아니라 기록에 박힌 switches를 툴팁 · 조건 표지로 보인다. 격자 기록은 SW-09 off · api 정지 조건(도구 컨테이너 경로)이다.
- 라이브 실행도 스위치와 무관하다 — 실행 수명 객체(plc.run_perf_raw · run_perf_raw)를 저장소 안 서버 측 생성으로 채우고 적재 경로(ING) · 조회 캐시(cache:q)를 지나지 않는다(기전 정본 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)). 격자 기록과 달리 api가 돌고 있는 조건이라 결과가 기록과 다른 것은 결함이 아니다 — 라이브 표지가 그 차이를 알린다.

### 비고

- 곡선 차트는 ECharts(보조)다 — 점 수가 적은 분석 차트이고 로그 축 · 오차 막대 · 영역 음영이 필요하다([01_standards.md](./01_standards.md) §차트 표준).
- EXP-COMPARE 역전 지점 패널은 그대로 둔다 — 그 패널은 valid 기록의 시간 점만 그리는 계약이라 폐기 기록 곡선을 그리지 않는다. 두 화면이 같은 원천 기록을 쓰므로 구조 판정 표는 같은 값을 보인다. 라이브 실행 결과는 EXP-COMPARE에 보이지 않는다.
- 실행 패널의 시작 · 종료 시각은 초까지다 — [01_standards.md](./01_standards.md) §시각 표시의 실험 화면 밀리초 규칙과 다른 처리이고 사유는 실행 단위가 초 이상이라 밀리초가 소음이라는 것이다(같은 절 표시 형식 행에 예외로 적었다).

## EXP-FLOW — 분산 처리 모니터링

| 항목 | 내용 |
|------|------|
| 화면 코드 | EXP-FLOW |
| 웹 경로 | /experiments/flow |
| 페르소나 | 실험 수행자(주) · 시연 청중 |
| 역할 | 보기 — S7 이후 인증 사용자 전원 · flow 프레임은 값이 아니라 개수 · 시간 · 명령 종류 · 결과 코드만 싣는다 · **실행 패널의 시작 · 중단 — S7 이후 ENGINEER · ADMIN**(실험 수행 · 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가) · S2~S6 무인증 |
| 도입 단계 | S5 — 적재 · 알람 분기 · WebSocket 게이트웨이가 선 뒤 |
| 요청 경로 | WebSocket은 셸의 연결 하나를 그대로 쓴다(api 직결 · subscribe_flow) · 저장소 누적은 BFF 경유 메트릭 해석 · health는 셸 배지의 것을 쓴다 · 실행 패널 — **브라우저 → BFF → api 표면 4**([../07_api/09_datagen.md](../07_api/09_datagen.md) #2~#5 · no-store) |

**목적**: 대용량 측정 데이터와 업무 데이터가 지금 어느 길로 갈라져 어디에 얼마만큼 쓰이고, 각 단계가 얼마나 걸리는가 — 두 데이터가 모두 Redis Stream을 지나되 **묶음(배치)으로 가는 길과 명령 하나씩 직렬로 가는 길**의 차이를 움직임으로 본다. 그 흐름을 이 화면에서 정한 초당 포인트 · 시간 · 업무 명령 빈도로 직접 일으켜 볼 수도 있다(라이브 flow 실행).

**진입**: 좌측 내비 실험 섹션. 진입 파라미터 없음 — 진입이 곧 subscribe_flow이고 이탈이 unsubscribe_flow다.

```plain
┌─ 머리 ─ 흐름 구독 ● 구독 중 · 마지막 배치 0.4초 전 · 배치 1.0/초 · 업무 명령 0.2/초 · "관찰 보조 — 기록 정본 아님" ─────────────┐
├─ 실행 패널 ─ pps [1000 5000 10000* 20000 50000] · 시간 [30 60* 120 300]초 · 업무 [0 0.5 1* 2]/초 [▶ 시작] [■ 중단] · ● 실행 중 ┤
│   시작 10:30:00 KST · 경과 42초 · 진행 ▓▓▓▓▓▓▓░░░ 70% (42초 / 60초) · 보낸 포인트 420,000 · 명령 42 · 백프레셔 정지 0 · 단계 ▾ │
│   (종결 뒤) 완료 — 총 소요 1분 4.8초 · 종료 10:31:04 KST   · 결과 표 ▾                                                     │
├─ 흐름도 ────────────────────────────────────────────────────────────────────────────────────────────┤
│ 대용량(측정 사실)                                                                                   │
│  [SIM · Collector] ═╗                            ┌─▶ CH tag_raw ──▶ MV tag_1m                         │
│  [생성기 B · C]   ══╬══▶ (Redis Stream) ══▶ [Ingest 워커] ─┼─▶ PG 대조군 COPY (SW-09 off — 회색)          │
│                    ║   stream:plc:raw  ● ●  flusher 1     ├─▶ Redis rt:latest + ch:rt ──▶ WS ──▶ 브라우저  │
│                    ║   길이 · 랙           XACK ▮          └─▶ 알람 판정 ─▶ CH alarm_eval(전수)            │
│                    ║                                                  ├▶ PG alarm_event ◆(전이만)        │
│                    ║                                                  └▶ Redis alarm:state · ch:alarm    │
│ ─────────────── 업무 명령 — 하나씩 직렬 · 커밋 결과를 기다려 응답 ──────────────────────────────── │
│ 업무(사람의 쓰기)                                                                                   │
│  [브라우저] ─▶ [BFF] ─▶ [api 검증 · XADD] ═▶ (stream:biz:cmd) ═▶ [워커 biz-writer 1]                   │
│       ▲                    ⏳ 대기(상한 5초)     길이 · 랙           │                                  │
│       │                         ▲                               ├─▶ PG 트랜잭션(변경 · 감사 · 원장)    │
│       │                         │                               ├─▶ Redis cache DEL · ch:cacheinv    │
│       └──── 응답 ◀──────────────┴──── ch:bizreply ◀── biz:result ◀┘ ↺ 재적용 · ✕ 거절 · ⚠ 불가 · ⌛ 만료 │
├─ 배치 타임라인 ─ 최근 20배치 · 단계 막대(스트림 대기 · 디코드 · CH 삽입 · PG COPY · 최신값 · 알람) · 병합 생략 표지 ─────┤
├─ 저장소 누적 ─ CH 바이트 · 압축률 · 행당 B · 파트 │ PG 크기 · 행당 B · WAL │ Redis 메모리 · 접두별 · 스트림 길이 · 랙 · 명령 랙 (5초) ┤
└─ 업무 명령 ─ 최근 20건 · 시각 · kind · 결과 · 재적용 · 대기 · 트랜잭션 · 무효화 · 결과 ms · 무효화 키 수 · 발행 주체 ───────┘
```

- **두 길을 한 그림에 위아래로 둔다(A형).** 통념은 "Redis를 거치면 비동기라 쓴 직후 조회가 옛 값을 본다"는 것이다. 부정 — 업무 명령은 api가 워커의 커밋 결과(biz:result · ch:bizreply)를 받은 뒤에만 기존 상태 코드로 응답하고, 워커는 무효화를 결과보다 먼저 한다([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §업무 명령 경로). 진짜 축은 **같은 Redis Stream이라도 단위와 순서 보장이 다르다**는 것이다 — 대용량 길은 창마다 묶은 배치를 flusher 하나가 처리량 위주로 넣고, 업무 길은 명령 하나를 소비자 하나가 직렬로 트랜잭션에 넣는다. 대체 경로 — 대용량 점은 행 수만큼 크게, 업무 점은 명령 하나로 작게 그리고, 업무 줄에는 api 대기(⏳)를 응답 화살표로 되돌려 동기 응답이 눈에 보이게 한다.
- **점은 실제 배치 하나다 — 연출이 아니다.** 점 하나가 flow 프레임의 배치 요약 하나이고, 단계마다 머무는 시간의 비율이 그 배치의 실제 단계 ms 비율이다. 요약이 오지 않으면 점도 없다 — 멈춘 그림이 곧 멈춘 적재다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 흐름 구독 표지 | 머리 | 구독 중 · 구독 요청 중 · 끊김(셸 WS 3상태를 따른다) · 마지막 배치 요약의 나이 · 초당 배치 · 초당 업무 명령(최근 10초 totals 차) | RLT-05(보조 — 구독 수단) | WS /ws/realtime(subscribe_flow · flow) |
| 흐름도 | 본문 위 | 노드 · 간선 SVG · 대용량 길과 업무 길 · 비활성 간선(SW-09 off · SW-11 collector · SW-01 대안)은 회색과 스위치 이름 · 발생원 간선에 초당 포인트(메트릭) | 해당 없음 — 흐름 이벤트(기능 ID 없음 · 리드 판정 1) | WS /ws/realtime(flow) · GET /metrics(BFF) |
| 배치 점 | 흐름도 위 | 배치 요약마다 점 하나 — 순서 스트림 대기 → 디코드 → CH 삽입 → PG COPY → XACK → 최신값 → 알람 판정 · 단계별 머묾 = 단계 ms × 배율(배치 전체가 1.5초 이상 보이게 늘리고 비율은 유지) · 점 크기 ∝ log10(행 수) · CH 삽입 뒤 네 갈래로 나뉜다 · 알람 전이가 있으면 PG alarm_event에 ◆(열림 · 닫힘 수) | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 간선 굵기 | 흐름도 | 대용량 간선 = 최근 10초 초당 행(totals.rows 차 ÷ 초) · 갈래별(chRows · controlCopyRows · latestWrites · judgedRows) · 업무 간선 = 초당 업무 명령 · 굵기는 로그 · 숫자 라벨 병기 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 업무 점 | 흐름도 아래 줄 | 업무 요약마다 점 하나 — api → stream:biz:cmd(queueWaitMs) → 워커 → PG 트랜잭션(txMs) → cache DEL · ch:cacheinv(invalidateMs · 키 수 · 발행 시만) → biz:result · ch:bizreply(replyMs) → api 응답 · duplicate면 트랜잭션을 건너뛰고 ↺ · result가 도메인 오류 코드(REJECTED)면 트랜잭션 노드에서 ✕와 코드 · result가 common.postgres_unavailable(failed — PostgreSQL 불가 · 원장 행 없음)면 트랜잭션 노드에서 **⚠와 코드**(✕와 가른다 — 적용 여부를 확정하지 못한 결과다) · expired면 ⌛ · ACK는 ch:cacheinv로 가지 않는다 · SW-12 direct 요약(role api-direct)은 스트림 · 결과 노드를 건너뛴다 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 배치 타임라인 | 흐름도 아래 | 최근 20배치 가로 누적 막대(단계 6 · null 단계는 자리 없음) · 막대 끝 행 수 · 배치 번호 순 · 번호가 건너뛰면 "N배치 병합으로 생략" 틈 표지 · 툴팁 전 필드 | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 저장소 누적 | 타임라인 아래 | 카드 3(ClickHouse · PostgreSQL · Redis) — §데이터 원천의 메트릭 · 5초 폴링 · 값마다 수집 나이(obs_collect_last_success_timestamp_seconds) | OBS-01(보조) · OBS-02(보조) · OBS-03(보조) | GET /metrics(BFF 해석) |
| 업무 명령 목록 | 바닥 위 | 최근 20건 · 시각(KST · 밀리초) · kind · 결과(ok · ✕ 도메인 오류 코드 · ⚠ common.postgres_unavailable · expired) · 멱등 재적용 · 단계 ms 넷 · 무효화 키 수 · ch:cacheinv 발행 여부 · 발행 주체(role — biz-writer · api-direct) | 해당 없음 — 흐름 이벤트 | WS /ws/realtime(flow) |
| 관찰 보조 표기 | 바닥 | "관찰 보조 — 기록 정본 아님 · 구독 중에는 워커(SW-12 direct면 api)가 요약을 발행한다(측정 중 닫는다)" | 해당 없음 — 정적 | 해당 없음 |
| 매개변수 선택 | 실행 패널 | 초당 포인트 pps 1000 · 5000 · 10000(기본) · 20000 · 50000 · 발행 시간 durationSec 30 · 60(기본) · 120 · 300초 · 업무 명령 bizPerSec 0 · 0.5 · 1(기본) · 2/초 · 실행이 진행 중이면 잠기고 그 실행의 params를 보인다 | GEN-12 | POST /api/v1/runs(본문 params) |
| 시작 | 실행 패널 | POST /api/v1/runs {type: 'flow', params} · 활성 조건 · 409 처리는 §실행 패널 — 두 화면 공통 규칙 | GEN-12 | POST /api/v1/runs |
| 중단 | 실행 패널 | POST /api/v1/runs/{runId}/stop · flow 실행이 running일 때만 활성 · 누르면 "중단 중…"으로 바뀌고 종결까지 비활성 · 중단이면 발행을 멈추고 드레인 단계는 skipped | GEN-12 | POST /api/v1/runs/{runId}/stop |
| 상태 칩 | 실행 패널 | status 5값 → 실행 중 · 중단 중 · 완료(초록) · 중단됨(회색) · 실패(빨강) · 실행 기록이 없으면 "실행 없음" | GEN-12 | GET /api/v1/runs/current · GET /api/v1/runs/{runId} |
| 시작 시각 | 실행 패널 | startedAt(UTC ISO 8601 Z) → KST 초까지 "HH:MM:SS KST" | GEN-12 | 상동 |
| 경과 시간 | 실행 패널 | 진행 중 — 서버 elapsedMs에서 1초 틱으로 이어 센다 · 종결 — endedAt − startedAt · 형식 "1분 4.8초"(§실행 패널 — 두 화면 공통 규칙 경과 시간) | GEN-12 | 상동 |
| 진행 막대 | 실행 패널 | publish 단계의 경과 ÷ durationSec(0~100% · 넘으면 100%) · 옆에 "42초 / 60초" · 보낸 포인트 · 엔트리 · 명령 · 백프레셔 정지 횟수(publish 단계 detail) · 드레인 중이면 막대를 채운 채 "드레인 — 적체 복귀 대기(상한 30초)" | GEN-12 | 상동 |
| 단계 목록 | 실행 패널 아래(접기 가능 · 기본 펼침) | steps[] 순서 그대로 — key prepare(시드 설비 · 태그 로드 · 시연 전용 행 확인 — 없으면 명령 4: 생성 3 + 비활성 수정 1) → publish → drain · 단계마다 상태 아이콘 · label · 소요 · detail 한 줄 요약 · drain detail.timedOut true면 "상한 30초 도달 — 적체가 남았다" | GEN-12 | 상동 |
| 완료 띠 | 실행 패널 오른쪽 | 종결 3상태 문구(완료 · 중단됨 · 실패 — §실행 패널 — 두 화면 공통 규칙) · 다음 시작 전까지 유지 | GEN-12 | 상동 |
| 결과 표 | 단계 목록 아래(접기 가능) | result 한 행 — pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs · 표 머리에 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" | GEN-12 | 상동 |

- 검산: 요소 = 관찰 9 + 실행 패널 10 = **19** · 이 화면이 호출하는 기능 = GEN-12(주 화면 — 실행 패널 요소 10) + RLT-05 · OBS-01 · 02 · 03(보조 — 주 화면은 각각 DSH-REALTIME · EXP-COMPARE · EXP-CONSOLE) = **5** · 흐름 이벤트 요소 6은 여전히 기능 ID가 없다 — 흐름 이벤트에 새 기능 ID를 만들지 않는다(리드 판정 1 · 분류 정본 [02_traceability.md](./02_traceability.md))
- **알람을 대용량 길에 그리는 이유** — 알람 이벤트는 측정 사실에서 파생된 업무 데이터다. 판정 전수는 ClickHouse alarm_eval, 상태 전이만 PostgreSQL alarm_event로 간다([../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) §분기 판정 트리) — ◆가 드문 것이 설계의 결과다(판정 행 수천 대 전이 몇 건).
- **알람 확인(ACK)은 업무 길에 그린다.** ②계층 행을 사람이 ③의 방식으로 쓰는 유일한 자리라서다(04_routing) — 명령 kind alarm.event.ack로 같은 명령 스트림을 탄다.

### 데이터 원천

| 화면 값 | 원천 | 이름 · 필드 | 주기 |
|------|------|------|------|
| 배치 점 · 타임라인 | flow 프레임 batches[] | seq · at · rows · stages(streamWaitMs · decodeMs · chInsertMs · controlCopyMs · latestWriteMs · alarmMs) · chRows · retries · dlqEntries · controlCopy · latestWrites · alarm(judgedRows · opened · closed) · stream(length · lag) — 필드 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 | 배치마다 · 병합 창 250 ms |
| 간선 굵기 · 초당 값 | flow 프레임 totals[] | source · role · startedAt · batches · rows · chRows · dlqEntries · controlCopyRows · judgedRows · opened · closed · latestWrites(ingest) · commands · applied · rejected · expired · failed · duplicates(biz-writer · api-direct — commands = applied + rejected + expired + failed · duplicates는 그 부분집합) | 상동 |
| 업무 점 · 목록 | flow 프레임 biz[] | source · role(biz-writer · api-direct — direct 판별은 이 필드 · source는 인스턴스 식별만) · seq · at · cmdId · kind · result · duplicate · stages(queueWaitMs · txMs · invalidateMs · replyMs) · invalidatedKeys · cacheinv | 명령마다 |
| 발생원 초당 포인트 | GET /metrics | points_emitted · gen_points_generated_total(mode) · redis_stream_entries_added_total(stream) | 5초 |
| ClickHouse 카드 | 상동 | ch_parts_bytes_on_disk · ch_parts_uncompressed_bytes(table — tag_raw · tag_1m · alarm_eval) → 압축률 · ch_parts_rows(table) → 행당 바이트 = ch_parts_bytes_on_disk ÷ ch_parts_rows · ch_active_parts(table) · ch_new_parts_total(table) · ch_inserted_rows_total · rows_inserted · alm_eval_rows_inserted_total | 상동 |
| PostgreSQL 카드 | 상동 | pg_relation_size_bytes(table · kind — plc_tag_raw_control · alarm_event · 마스터) · pg_table_live_tuples(table) → 행당 바이트 = pg_relation_size_bytes ÷ pg_table_live_tuples(통계 추정치 — 툴팁에 "ANALYZE 시점에 따라 늦다") · pg_wal_bytes_total · pg_xact_commit_total · pg_table_dead_tuples(table) · alm_active_alarms(severity) | 상동 |
| Redis 카드 | 상동 | redis_used_memory_bytes · redis_maxmemory_bytes · redis_prefix_memory_bytes(prefix) · redis_stream_length(stream — stream:plc:raw · stream:biz:cmd) · consumer_lag · backpressure_stage(publisher) · rlt_latest_updates_total(writer) · biz_stream_lag(grp:biz-writer 미확인 적체 — 그룹 lag + pending) · biz_commands_total(result — 초당 명령과 결과 구성) | 상동 |
| 수집 나이 | 상동 | obs_collect_last_success_timestamp_seconds(store) | 상동 |
| 실행 패널(상태 칩 · 시각 · 경과 · 진행 막대 · 단계 · 완료 띠) | 실행 객체(GET /api/v1/runs/current · GET /api/v1/runs/{runId} · 시작 · 중단 응답) | runId · type · status · params(pps · durationSec · bizPerSec) · startedAt · endedAt · elapsedMs · steps[](key · label · status · startedAt · endedAt · elapsedMs · detail — publish는 보낸 포인트 · 엔트리 · 명령 · 백프레셔 정지 횟수 · 진행률 · drain은 timedOut) · error(code · message) — 필드 정본 [../07_api/09_datagen.md](../07_api/09_datagen.md) | 진입 1회 · running · stopping 동안 1초 |
| 결과 표 | 상동 | result — pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs | 종결 뒤 |

- 검산: 원천 행 = **10** — flow 프레임 3 + 메트릭 5 + 실행 객체 2 · 메트릭 이름은 전부 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)에 있는 것만 쓴다 — 업무 명령 계열은 등재된 biz_stream_lag · biz_commands_total(result)을 Redis 카드에 싣는다 · **명령 적체 판정은 biz_stream_lag다**(stream:biz:cmd 길이는 MAXLEN까지 남은 확인된 엔트리를 포함한다) · biz_commands_total은 api 쪽과 워커 쪽이 한 명령을 두 번 셀 수 있어(카탈로그 정본) 화면의 명령 수는 flow 프레임 totals.commands다
- **행당 바이트의 분모는 테이블 전체 행 수 계열이다 — 누적 삽입 수가 아니다.** rows_inserted · ch_inserted_rows_total은 프로세스 기동 이후 누적이라 테이블 바이트(테이블 전체)와 분모가 맞지 않는다 — 카탈로그에 등재된 ch_parts_rows(활성 파트 행 합 — 머지 전 중복 포함) · pg_table_live_tuples(n_live_tup 추정치)를 분모로 쓴다. 분모가 0 · 수집 없음이면 칸은 "행 수 계측 없음".
- **redis_stream_length는 길이로만 보인다 — 적체 판정은 consumer_lag다**(카탈로그 ADR-21 조항). 흐름도 Stream 노드의 "랙" 숫자는 flow 프레임 stream.lag 또는 메트릭 consumer_lag이고 길이가 아니다.

### 표시 계약

| 계약 | 내용 | 어기면 |
|------|------|------|
| 단계 순서 | 배치 점은 ⑧ 순서 그대로 — CH 삽입 → PG COPY → XACK → 최신값 → 알람([../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) §적재 한 배치) · 업무 점은 적용 단계 순서 그대로 — 대기 → 트랜잭션 → 무효화 → 결과 → 응답([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §적용 단계) · null 단계는 건너뛴다 | 순서를 보기 좋게 바꾸면 "최신값은 확정된 값만" · "대조군은 XACK 앞" · "무효화가 결과보다 먼저"(read-your-writes)라는 계약이 그림에서 사라진다 |
| 배율 | 단계 ms에 한 배율을 곱한다 · 배치 전체가 1.5초보다 짧으면 늘리고 비율은 유지 · 배율 값을 머리에 "×N 느리게" | 단계마다 다른 배율이면 비율이 거짓이 되고, 배율 표기가 없으면 실제 지연이 초 단위로 읽힌다 |
| 병합 생략 | 배치 번호(seq)가 건너뛰면 점을 만들지 않고 타임라인에 틈 표지 · 간선 굵기와 합계는 totals에서 계산 | 병합으로 빠진 배치 때문에 합계가 실제보다 작게 보인다 |
| 재기동 | totals의 startedAt이 바뀌면 그 source의 초당 값 계산을 한 창 건너뛴다 | 누적값 감소가 음의 처리량으로 그려진다 |
| 비활성 간선 | SW-09 off · controlCopy null → PG 대조군 간선 회색 "SW-09 off" · latestWrites null → 최신값 간선 발원을 Collector로 옮기고 "SW-11 collector" · 인계 없는 배치(alarm null)는 알람 갈래를 지나지 않는다 | 꺼진 경로가 비어 있는 채 그려져 적재 실패로 읽힌다 |
| 구독 없음 · 끊김 | 셸 WS가 끊기면 점 애니메이션을 멈추고 흐름도 머리에 "끊김 — 마지막 배치 N초 전" · 재연결 뒤 subscribe_flow 재전송 · 그 사이 배치는 오지 않는다(Pub/Sub — 재전송 없음) | 끊긴 동안 멈춘 그림이 적재 정지로 읽힌다 |
| SW-12 direct | biz 요약의 role이 api-direct면(source는 인스턴스 식별만 — APP_ROLE all이면 api와 워커의 source가 같을 수 있다) 업무 점이 stream:biz:cmd · 워커 · 결과 노드를 건너뛰고 api에서 곧바로 트랜잭션으로 간다 · 업무 줄 머리에 "SW-12 direct — 옛 경로(비교 실험용)" | 옛 경로 요약이 명령 스트림 위에 그려져 Redis를 거친 것처럼 읽힌다 |
| 요약 없음 | 구독 중인데 10초 동안 flow 프레임이 없으면 "배치 요약 없음 — 적재가 멈췄거나 발행이 꺼져 있다(표지 cache:flow:subscribed를 읽지 못한 발행자는 발행하지 않는다)"와 메트릭 카드의 consumer_lag · 초당 포인트를 나란히 | 표지 키(cache:flow:subscribed) 갱신 지연(최대 표지 TTL) · 표지 읽기 실패와 적재 정지가 구분되지 않는다 |
| 라이브 표지 | 결과 표 머리 · 완료 띠 옆에 고정 문구 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" · flow 실행 결과로 측정 기록을 만들지 않는다 | 시연 한 번의 보낸 수 · 드레인 시간이 EXP-45 같은 측정 기록의 값처럼 인용된다 |
| 실행 발행 원천 | flow 실행 중에는 흐름도 머리에 "라이브 flow 실행 중 — pps N · 업무 N/초"를 보이고, 발생원 초당 포인트는 gen_points_generated_total의 mode 레이블 값 run을 모드 B와 따로 적는다 · 실행의 업무 명령은 **시연 전용 설비 DEMO-FLOW-DEV(비활성 · 사이트 DEMO-FLOW · 라인 DEMO-FLOW-L)에만** 싣는 master.device.patch다(매번 새 이름 "시연 설비 {runId 앞 8자}-{명령 번호}" — 항상 실제 변경이라 트랜잭션 · 감사 · 무효화가 돈다 · **되돌림 없음** · actor null · 시연 전용 행이 없으면 prepare가 master.site.create → master.line.create → master.device.create → master.device.patch {isActive: false}(생성 표면이 isActive를 받지 않는다 — 07_api/04)를 같은 경로로 싣는다 · prepare 명령은 commandsSent에 세지 않는다) · 이 명령은 api 안에서 BizWritePort로 들어가므로 업무 줄의 [브라우저] · [BFF] 노드를 지나지 않고 api에서 시작한다 · 흐름 계약(flow 프레임 필드 · 단계 순서)은 바뀌지 않는다 — 실행은 발행 원천을 늘릴 뿐이다 | 실행이 늘린 발행이 모드 B 생성기 · 사람의 쓰기로 읽히고, 업무 명령 목록의 이름 변경이 운영 설비를 바꾼 것으로 읽히며, 실행을 끝낸 뒤 줄어든 처리량이 적재 저하로 신고된다 |

- 검산: 계약 = 관찰 8 + 실행 패널 2 = **10**
- **정밀 측정 중에는 이 화면을 닫는다(B형).** 결론 — 구독자가 있으면 워커가 배치 · 명령마다 요약을 만들고 Pub/Sub에 한 번 더 발행한다. 반대 시나리오 — 화면을 띄운 채 EXP-45 계단을 재면 PUBLISH 비용이 flusher 후속 구간에 섞인다. 파생 지침 — 구독자가 없으면(구독 중 표지 cache:flow:subscribed가 없거나 읽지 못하면) 발행 자체를 하지 않고([../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 발행 조건), 실험 러너는 구독 표지가 없는 상태에서 측정 창을 연다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 흐름도 노드 · 간선 골격(굵기 기본 · 숫자 없음)과 타임라인 · 카드 · 목록 틀을 먼저 그린다 · subscribe_flow 직후의 빈 flow 프레임이 오면 "구독 중"으로 바꾼다 · 메트릭 카드는 첫 응답 전까지 자리만 · 실행 패널은 GET /api/v1/runs/current 응답 전까지 시작 · 중단 비활성과 상태 칩 자리만 |
| 빈 값 | ① 구독 중 · 배치 0 — "배치 요약이 아직 없다 — 발생원이 발행 중인지 메트릭 초당 포인트로 확인" ② 업무 명령 0 — 목록에 "이 구독 뒤 업무 명령 없음"(적재와 무관한 정상) ③ 기능 미도입 단계(S5 전) — "이 단계에서 아직 흐름 이벤트를 발행하지 않는다" ④ 실행 기록 없음(current의 run null · 또는 마지막 실행이 perf) — 상태 칩 "실행 없음" · 진행 막대 · 결과 표 없음 · "아직 실행하지 않았다(api를 재기동하면 지난 실행은 남지 않는다)" |
| 오류 | WS 종료 코드는 셸이 처리하고 이 화면은 끊김 표시만([01_standards.md](./01_standards.md) §에러 코드별 사용자 표시의 WebSocket 종료 코드 행) · 4400(subscribe_flow 형식 위반)은 재구독하지 않고 끊김 · 메트릭 해석 실패는 카드 머리 "메트릭을 읽지 못했다"와 마지막 성공 시각 · 기존 점 · 타임라인은 지우지 않는다 · 실행 표면 — datagen.run_in_progress/409 · common.not_found/404 · common.validation_failed/400 · 폴링 실패는 §실행 패널 — 두 화면 공통 규칙(실행 패널 안에서만 표시) · S7 뒤 시작 · 중단의 auth.forbidden/403은 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 흐름도 점 · 굵기 · ◆ · 타임라인 20배치 · 카드 · 목록 · 모든 시각 KST 밀리초(실행 패널 시각만 초 — 비고) · 배율 표기 · 병합 생략 수 · 저장소 값의 수집 나이 · 바닥 "관찰 보조 — 기록 정본 아님" · 실행 패널 — 진행 중(칩 · 경과 틱 · 진행 막대 · 단계 목록) 또는 종결 띠 · status failed는 정상 행의 실패 띠(200 응답 안의 실행 결과) · 결과 표(라이브 표지) |

### 호출 표면 · 갱신

| 표면 | 호출 시점 | 경로 | 쓰는 응답 |
|------|------|------|------|
| WS /ws/realtime — subscribe_flow · unsubscribe_flow · flow | 진입 subscribe_flow · 이탈 unsubscribe_flow · 재연결 뒤 subscribe_flow 재전송 · flow는 서버가 병합 창마다 | api 직결 — 셸의 연결 하나 | flow(windowEnd · batches · biz · dropped · totals) |
| GET /metrics | 진입 · 5초 폴링 | BFF 해석 — 흐름 보기(웹 내부 계약 · §데이터 원천의 이름만 요약해 내린다) | 계열별 순간값 · 누적 카운터(초당 값은 화면이 두 응답의 차로) |
| POST /api/v1/runs([../07_api/09_datagen.md](../07_api/09_datagen.md) #2) | 시작 클릭 | 브라우저 → BFF → api · no-store | 202 실행 객체 · 409 datagen.run_in_progress의 details(runId · type) · 400 |
| GET /api/v1/runs/current(#3) | 진입 1회 · 어떤 실행이든 running · stopping인 동안 1초 폴링 · 종결되면 멈춘다 · 시작 202 · 409 · 중단 응답 뒤 폴링 재개 | 상동 | run — 진행 중 실행 또는 마지막으로 끝난 실행 · 없으면 null |
| GET /api/v1/runs/{runId}(#4) | 시작 409 뒤 details.runId로 1회(다음 current 폴링을 기다리지 않고 패널을 맞춘다) | 상동 | 실행 객체 전 필드 · 404면 current 재조회 |
| POST /api/v1/runs/{runId}/stop(#5) | 중단 클릭 | 상동 | 202 실행 객체(status stopping) · 200 이미 종결된 실행 그대로 · 404 |

- 검산: 부르는 자리 = WS 1 + 메트릭 1 + 실행 표면 4(09_datagen #2~#5) = **6** · health는 부르지 않는다(셸 배지 응답을 스위치 표시에 쓴다)
- **메트릭 5초 폴링은 EXP-CONSOLE 15초 계약과 다르다(리드 판정 2).** 흐름도 옆의 누적이 15초마다 한 번 움직이면 점의 움직임과 어긋나 보인다. 대가는 BFF 해석 비용과 api 텍스트 생성이며, 저장소 계열은 OBS 수집 주기보다 빨리 바뀌지 않는다 — 같은 값이 반복되는 것을 수집 나이로 보인다. 이 화면도 정밀 측정 중 닫는 화면이라 관측 부하 판정은 EXP-CONSOLE과 같다.
- **캐시 층** — flow 프레임은 캐시 층이 없다(Pub/Sub · 링 버퍼 20). 메트릭 쿼리 키 obs · metrics · flow · staleTime 0(서버 층 없음). 실행 쿼리 키는 EXP-PERF와 같은 runs · current · runs · {runId}다 — 두 화면이 같은 키를 써서 한 화면에서 시작한 실행이 다른 화면으로 옮겨도 캐시가 이어진다.

### 스위치 영향

| 스위치 | 이 화면에서 보이는 것 |
|------|------|
| SW-01 대안(InProcessQueueBuffer) | Stream 노드 회색 "Stream 경계 없음 — 실험 전용" · stream.length · lag null · streamWaitMs는 큐 대기 |
| SW-06 대안(DirectGatewayFanout) | 최신값 · 알람 간선의 Pub/Sub 표기를 "직접 호출"로 · flow 프레임 자신은 SW-06과 무관하다(ch:flow는 대상 아님) |
| SW-09 on | PG 대조군 간선이 살아나고 controlCopyMs 막대가 타임라인에 선다 — "대조군 적재가 켜졌다" 경고는 셸 배지 · EXP-CONSOLE이 맡는다 |
| SW-10 on | 발생원 초당 포인트가 줄고 배치 행 수가 준다 — 흐름도에 "데드밴드 on" 표지 |
| SW-11 collector | 최신값 간선이 Collector에서 나간다 · 배치 요약 latestWrites · latestWriteMs null |
| SW-12 direct | 업무 줄이 옛 경로(api가 트랜잭션을 직접 커밋)로 바뀐다 — stream:biz:cmd · 워커 · 결과 노드 회색 · 표시 계약 SW-12 direct 행 · flow 실행의 업무 명령도 BizWritePort를 거치므로 같은 옛 경로로 가고 결과 표 commandsPending은 202가 없어 0이다 |

- 검산: 행 = **6** · 나머지 스위치(SW-02~05 · 07 · 08)는 조회 경로 · 병합 · 멱등이라 이 화면의 그림을 바꾸지 않는다(SW-08 대안이면 재시도 배치의 중복은 retries로만 보인다)

### 비고

- 흐름도는 SVG 직접 그리기다 — 시계열 차트가 아니라 uPlot · ECharts 대상이 아니다. 배치 타임라인만 ECharts 가로 누적 막대다.
- 링 버퍼 20은 화면 상수다 — 시연 중 한 화면에 보이는 양이고 메모리는 배치 요약 20건이다.
- 실행 패널의 시작 · 종료 시각은 초까지다 — EXP-PERF 비고와 같은 예외([01_standards.md](./01_standards.md) §시각 표시 표시 형식 행).
- **flow 실행을 띄운 채 정밀 측정을 하지 않는다.** 실행은 적재 경로에 실제 부하를 싣는다 — 동시 실행 1 제한이 perf 실행과의 겹침만 막고, 호스트 스크립트 · k6 부하와의 겹침은 막지 않는다 — 측정 창을 열기 전에 실행 패널이 진행 중이 아닌지 확인한다.

## 실행 패널 — 두 화면 공통 규칙

EXP-PERF(type perf · GEN-11)와 EXP-FLOW(type flow · GEN-12)의 실행 패널은 매개변수 · 단계 · 결과만 다르고 아래 규칙을 함께 따른다. **실행은 두 종류를 합쳐 한 번에 하나다** — 두 실행이 서로의 측정을 오염시키므로 api가 동시 실행을 409로 막는다([../07_api/09_datagen.md](../07_api/09_datagen.md) · 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)). 실행 상태는 api 인스턴스 메모리에만 있어 api를 재기동하면 사라진다 — 화면은 이것을 실패가 아니라 "기록 없음"으로 보인다.

### 버튼 상태

| 요소 | 활성 조건 | 비활성일 때 표시 |
|------|------|------|
| 매개변수 선택 | current를 받았고 어떤 실행도 running · stopping이 아니다 | 진행 중이면 잠금 · 그 실행이 이 화면 종류면 그 params를 보인다 |
| 시작 | current를 받았고 · 어떤 실행도 running · stopping이 아니고 · 시작 요청이 응답을 기다리는 중이 아니고 · S7 뒤 역할이 ENGINEER · ADMIN | 다른 종류가 진행 중 — "다른 실행 진행 중(EXP-FLOW) — 그 화면으로" 링크(EXP-PERF에서는 /experiments/flow · EXP-FLOW에서는 "다른 실행 진행 중(EXP-PERF)" · /experiments/perf) · 같은 종류가 진행 중 — 비활성(중단만 켜진다) · 요청 중 — "시작 요청 중…"(두 번 눌러 409를 스스로 부르지 않게) · 역할 없음 — "실행은 ENGINEER · ADMIN만" |
| 중단 | 이 화면 종류의 실행이 running · S7 뒤 역할이 ENGINEER · ADMIN | 누른 직후 응답 전부터 "중단 중…" · status stopping이면 "중단 중…" 비활성 · 종결 · 다른 종류 · 실행 없음이면 비활성 · 역할 없음 — "실행은 ENGINEER · ADMIN만"(패널 상태는 보인다) |

- 검산: 버튼 · 선택 요소 = **3**
- **시작은 current를 받기 전에 켜지지 않는다.** 진입 직후 켜 두면 다른 탭 · 다른 화면이 시작한 실행을 모르는 채 눌려 409가 사용자 조작의 첫 응답이 된다.

### 상태 칩과 종결 표시

| status | 상태 칩 | 띠 문구 | 단계 목록 |
|------|------|------|------|
| running | "실행 중"(진행 표지) | 없음 — 경과 시간이 1초마다 움직인다 | 진행 중 단계 ◐ · 그 단계 소요도 1초 틱 |
| stopping | "중단 중" | "중단 중… — 진행 중 단계를 취소하고 정리 단계를 돈다" | 취소가 걸린 단계 ◐ 유지 |
| completed | **초록 "완료"** | **"완료 — 총 소요 3분 12.4초 · 종료 10:23:17 KST"** | done ✓ · skipped – |
| stopped | 회색 "중단됨" | "중단됨 — 소요 1분 5.0초 · 종료 10:21:10 KST" · error가 있으면(정리 실패) 뒤에 "정리 실패 — {error.message}" | 중단된 단계 ■ · 실행하지 않은 단계 – · 정리 단계는 중단이어도 돈다 |
| failed | 빨강 "실패" | "실패 — {error.message} · 소요 N분 N.N초 · 종료 HH:MM:SS KST" · error.code가 있으면 코드 병기(null 허용 — 실패 원인은 실행 객체 안의 관찰값이다) | 실패 단계 ✕ · 뒤 단계 – |

- 검산: status = **5**(전송 enum — 정본 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md)) · 종결 = completed · stopped · failed = **3** · 단계 아이콘 = pending ○ · running ◐ · done ✓ · skipped – · stopped ■ · failed ✕ = **6**
- **종결 띠는 다음 시작 전까지 남는다(B형).** 결론 — 완료 · 중단됨 · 실패 띠는 자동으로 사라지지 않는다. 반대 시나리오 — 몇 초 뒤 띠를 지우면 몇 분짜리 10^8 실행이 자리를 비운 사이 끝났을 때 결과 표만 남아 끝났는지 멈췄는지 가를 수 없다. 파생 지침 — api도 마지막으로 끝난 실행을 다음 시작 전까지 current로 내므로 다시 들어와도 같은 띠가 보인다.
- 실패 띠는 오류 행이 아니다 — 실행 표면은 200으로 실행 객체를 냈고 failed는 그 안의 결과다. 표면 자체의 오류(409 · 404 · 400 · 5xx)만 §갱신과 응답 처리가 다룬다.

### 경과 시간

| 자리 | 값 | 갱신 | 형식 |
|------|------|------|------|
| 진행 중(running · stopping) | 마지막 응답의 elapsedMs + 그 응답을 받은 뒤 흐른 브라우저 단조 시계 | 1초 틱 · 응답이 올 때마다 기준을 서버 값으로 다시 맞춘다 | "1분 42초"(1초 단위) · 1분 미만 "42초" · 1시간 이상 "1시간 3분 12초" |
| 종결 | endedAt − startedAt(서버 elapsedMs와 같다) | 고정 | "3분 12.4초"(0.1초 단위 · 버림) · 1분 미만 "12.4초" · 1시간 이상 "1시간 3분 12.4초" |
| 단계 소요 | 단계 elapsedMs · 진행 중 단계만 위와 같은 방식으로 틱 | 상동 | 상동 |

- 검산: 자리 = **3**
- **경과 시간은 브라우저가 startedAt을 빼서 만들지 않는다(A형).** 통념은 "시작 시각을 알면 지금 시각에서 빼면 된다"는 것이다. 부정 — 브라우저 시계와 서버 시계의 차이(수 초일 수 있다)가 그대로 경과에 섞이고, 종결 뒤 총 소요와 진행 중 경과가 서로 다른 시계로 계산돼 완료 순간 숫자가 뒤로 튄다. 진짜 축은 **서버가 계산한 elapsedMs 하나를 기준으로 두고 브라우저는 그 뒤에 흐른 길이만 더한다**는 것이다. 대체 경로 — 종결 뒤에는 endedAt − startedAt 하나만 보인다.
- 시작 · 종료 시각은 UTC ISO 8601 Z로 와서 KST로 한 번 변환한다([01_standards.md](./01_standards.md) §시각 표시). 경과 시간은 시각이 아니라 길이라 시간대 변환이 없다.

### 갱신과 응답 처리

| 사건 | 처리 |
|------|------|
| 진입 | GET /api/v1/runs/current 1회 → run이 있으면 그 실행으로 패널을 맞춘다(이 화면 종류가 아니면 시작 비활성과 "다른 실행" 링크만) · running · stopping이면 폴링 시작 · S7 뒤 OPERATOR도 current · 단건 조회로 패널 상태를 본다(시작 · 중단만 비활성) |
| 폴링 | GET /api/v1/runs/current를 1초 간격(BFF no-store) — 동시 실행이 하나라 current가 곧 보고 있는 실행이다 · 앞 요청의 응답이 오기 전에 다음 요청을 보내지 않는다 · 종결 status를 받으면 멈춘다 · 화면을 떠나면 멈춘다(실행은 계속된다) · 폴링 중 current가 null을 내면(api 재기동으로 실행이 사라짐) 아래 404 행과 같이 "기록 없음" |
| 시작 202 | 응답의 실행 객체로 패널을 바꾸고 폴링 시작 · 앞 실행의 종결 띠 · 결과 표 · 라이브 계열을 지운다 |
| 시작 409 datagen.run_in_progress | details의 runId · type으로 패널을 맞춘다(#4 단건 조회 1회 뒤 current 폴링) · 띠 "다른 실행이 먼저 시작됐다 — {type}" · 자동 재시도 없음 |
| 시작 400 common.validation_failed | 매개변수 옆 문구 — 선택기가 화이트리스트 값만 내므로 여기 오면 화면과 서버의 목록이 어긋난 것이다 |
| 중단 202 · 200 | 응답 객체로 패널 갱신 · 202는 stopping으로 폴링 계속 · 200(이미 종결 — 멱등)은 곧바로 종결 표시 |
| 404 common.not_found(#4 · #5) | 실행이 api 메모리에서 사라졌다(api 재기동) — current 재조회 · 띠 "실행 기록이 사라졌다 — api가 재기동됐다(실패로 기록하지 않는다)" |
| 시작 · 중단 요청 실패(네트워크 · BFF 5xx · auth.forbidden/403) | 버튼을 요청 전 상태로 되돌린다("시작 요청 중…" · "중단 중…" 해제) · 패널 띠 "요청 실패 — 다시 누른다"(403이면 "실행은 ENGINEER · ADMIN만") · current 1회 재조회(요청이 실제로는 닿았을 수 있다) · 자동 재시도 없음 |
| 폴링 실패(네트워크 · BFF 5xx) | 마지막 실행 객체를 흐리게 유지 · 경과 틱을 멈춘다(끝났을지 모르는 실행을 계속 세지 않는다) · "상태를 읽지 못했다 — 다시 읽는 중" · 1초 간격 재시도 계속 |

- 검산: 사건 = **9**
- **화면을 떠나도 실행은 멈추지 않는다(B형).** 결론 — 실행 주체는 api 프로세스이고 이탈 · 새로고침 · 탭 닫기는 중단 요청을 보내지 않는다. 반대 시나리오 — 이탈을 중단으로 삼으면 새로고침 한 번에 몇 분짜리 실행이 정리 단계로 끝나 시연이 날아가고, 다른 화면으로 옮겨 흐름을 보려던 조작이 실행을 죽인다. 파생 지침 — 멈추려면 중단 버튼을 누르고, 다시 들어오면 current가 진행 중 실행을 되찾는다. 다른 탭 · 다른 사용자가 시작한 실행도 current가 하나라 같은 패널에 보인다.
- 호출 표면 4(POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop)는 각 화면의 §호출 표면 · 갱신 표가 센다 — 이 절은 세지 않는다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 두 화면의 주 기능 · 흐름 이벤트 기능 ID | **닫힘(리드 판정 1)** — 흐름 이벤트에 새 기능 ID 없음 · 두 화면의 "주 기능 없는 실증 화면(OBS 보조)" 분류는 **2026-09-28 재판정으로 대체** — 실행 패널의 주 기능 GEN-11(EXP-PERF) · GEN-12(EXP-FLOW) | [02_traceability.md](./02_traceability.md) |
| 행당 바이트의 분모(테이블 전체 행 수 메트릭) | **닫힘** — 카탈로그 등재 pg_table_live_tuples{table} · ch_parts_rows{table} · 저장소 카드 행당 바이트 칸(바이트 ÷ 행 수) | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| BFF 성능 보기 · 흐름 보기 응답 모양 | 웹 내부 계약 — 이 문서의 호출 표면 표가 쓰는 필드를 고정하고 모양은 구현이 정한다(EXP-COMPARE와 같은 판정) | 이 문서 |
| 시연 시나리오 | **닫힘(사용자 요구 2026-09-28 — 라이브 실행)** — 데이터 처리 시연은 두 화면의 실행 패널(GEN-11 · GEN-12)이 시작 · 중단 · 완료 · 소요 시간을 맡는다(옛 판정 3 대체) · 저장소 정지 같은 장애 주입은 화면에 두지 않고 호스트 스크립트가 맡는다 | 이 문서 §실행 패널 — 두 화면 공통 규칙 · [../07_api/09_datagen.md](../07_api/09_datagen.md) |
| 쿼리 레이스(두 저장소에 같은 쿼리를 실시간 실행하는 화면 · API) | **닫힘(사용자 요구 2026-09-28 — 라이브 실행)** — EXP-PERF perf 실행이 두 저장소에 같은 규모 · 같은 쿼리(Q1~Q5)를 돌린다(옛 판정 4 대체) · 대조 쿼리는 앱을 거치지 않는다는 판정([07_experiment_console.md](./07_experiment_console.md) §스위치별 비교 대상 A형)과는 결과에 "라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님" 표지를 달고 측정 기록을 만들지 않는 것으로 충돌하지 않는다 | 이 문서 EXP-PERF §표시 계약 |
| 라이브 실행 소요 시간 · 시연값 크기(규모별 적재 · 쿼리 시간 · flow 드레인 시간) | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 화면은 관찰값만 보이고 예상 소요를 표시하지 않는다(10^8 경고의 "수 분 이상"은 예상치가 아니라 규모 경고) | AC-46 기록 |

## 관련 문서

- [README.md](./README.md) — 화면 인벤토리 · 화면 코드 채번
- [01_standards.md](./01_standards.md) — 명세 템플릿 · 상태 4행 · 차트 표준 · 공통 셸
- [02_traceability.md](./02_traceability.md) — 기능 → 화면 매핑
- [07_experiment_console.md](./07_experiment_console.md) — EXP-COMPARE 역전 지점 · 실증 요약 패널 · BFF 기록 읽기 선례
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 역전 구간 정본 · 비교 축 · 원리 대응
- [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) — 기계 판독 블록 · 기록 상태와 참고값 예외
- [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) — 메트릭 이름
- [../07_api/11_websocket.md](../07_api/11_websocket.md) — flow · subscribe_flow · unsubscribe_flow 계약
- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 3계층 분기 · 업무 쓰기 경로 판정
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 업무 명령 경로 · 적용 단계 · 무효화 체인
- [../06_pipeline/04_routing.md](../06_pipeline/04_routing.md) — 분기 판정 트리 · 모듈 × 저장소 쓰기 행렬
- [../07_api/09_datagen.md](../07_api/09_datagen.md) — 실행 표면 #2~#5 · 실행 객체 · datagen.run_in_progress
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — 라이브 실행 두 종류의 단계 · 취소 · 정리 기전
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 실행 status · 단계 status enum
