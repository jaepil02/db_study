# GEN — 부하 주입 · 라이브 실행 제어 표면 (09_datagen)

> **대상**: GEN 도메인 표면 둘 묶음 — ① 모드 C 부하 주입 POST /api/v1/ingest/bulk의 게이트(환경변수 이름) · 인증 · 요청 본문(엔트리 계약 변환) · 백프레셔 거절 datagen.stream_full/503 · 부분 수용 · 레이트 리밋 등급 ② **라이브 실행 제어 #2~#5**(EXP-PERF 성능 비교 · EXP-FLOW 흐름 시연의 시작 · 현재 · 단건 · 중단 — 실행 객체 스키마 · status · step status · 매개변수 두 종류 · 동시 실행 하나 datagen.run_in_progress/409 · 중단 · 실패 의미) · 생성기 실행 제어 표면 판정 · 실행 중 주입 제어 표면 판정
> **작성일**: 2026-09-24
> **개정일**: 2026-09-28 — 라이브 실행 검수 반영(리드 재판정 2026-09-28) — flow bizPerSec 뜻 이름 토글 짝 → **시연 전용 설비 DEMO-FLOW-DEV에만 새 이름 명령**(되돌림 없음 · 운영 행 불변 · 명령 1건 = 1 · prepare 생성 명령은 commandsSent에 세지 않는다) · #5 표 행 4 → **5**(cleanup 진행 중 running — 중단 무시) · §중단과 실패 사건 3 → **5**(정상 경로 정리 실패 → failed · cleanup 중 중단 요청 → completed) · 중단 단계 표지(끝난 단계 done 유지 · 미시작 skipped · 진행 중 0~1개 stopped) · PostgreSQL 취소 = 전용 연결 pid · 레이트 리밋 폴링 항 = 실행 패널 탭 수(현행 참고 2) × 60 · 10^8 예상 디스크는 상한값 · flow 예시 검산 불릿
> **개정일**: 2026-09-28 — 리드 정정(통합 확인) — 흐름 시연 업무 명령 "deviceName 현재 이름 그대로(순 변경 없음)" → **이름 토글 짝**(같은 설비에 "원래 이름 (시연)" → 원래 이름 · 중단이면 되돌림 1건 뒤 종결) — 기존 쓰기 서비스는 변경이 없으면 감사 · 체인을 건너뛰어(통합 확인 2026-09-28) 시연에서 무효화가 보이지 않았다
> **개정일**: 2026-09-28 — 라이브 실행 제어 신설(사용자 요구 2026-09-28 "시작 · 중단 · 완료 표시 · 소요 시간" · 리드 판정) — **표면 #2~#5 신설**(POST /api/v1/runs · GET /api/v1/runs/current · GET /api/v1/runs/{runId} · POST /api/v1/runs/{runId}/stop · GEN-11 · 12 · 인증 전 무인증 · 뒤 시작 · 중단 ENGINEER · ADMIN · 조회 전원 · BFF no-store · 호출 화면 EXP-PERF · EXP-FLOW) · **§실행 객체**(필드 10 · status 5 · step status 6 · elapsedMs 서버 계산) · **§매개변수**(perf maxExponent · flow pps · durationSec · bizPerSec) · 에러 코드 **datagen.run_in_progress/409** 인용(정본 11_glossary/02) · 옛 서술 "GEN이 가진 표면은 하나뿐이다" → **표면 5(부하 주입 1 + 라이브 실행 4)** · 표면 요약 검산 1 → **5**(원본 1 + 신설 4) · 원본에 없는 표면 판정에 라이브 실행 행(두지 않는 생성기 실행 제어와 가르는 축) — 옛 판정(생성기 실행 · 상태 조회 표면 두지 않음)은 모드 A~D에 대해 유지
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 게이트 true 기동 시 **경고 로그 1줄** · 레이트 리밋 class **bulk_ingest** · 한도 관계 R2 — 표면 수 불변(정본 12_security/02 · 03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 기록 칸 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — DATAGEN_BULK_ENABLED를 환경변수 정본(09_tech_stack/04)에 등재했다
> **원천**: 원본 architecture.md §9.3 · §11 · §18(커밋 ff66a37) · 원본 data_flow.md §11 · §11.1 · §12.1 · §14.1(커밋 ff66a37) · REQ-GEN-02 · 05 · 08 · 09 · 15 · 16~19 · REQ-GLB-10 · 21 · REQ-AUT-16 · ADR-21 · ADR-23 · D-06 · D-07 · 사용자 요구 2026-09-28(라이브 실행 제어) · [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-07 · GEN-11 · GEN-12 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §모드 C 표면 · §SIM 주입 제어 · 라이브 실행 기전 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) 실행 수명 객체 · 동일 쿼리 5종 · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 3단계 · docs_plan.md 실행 계획 보정 #11 · 웨이브 인계 W5 07_api 행(생성기 실행 제어 · 실행 중 주입 제어)

GEN이 가진 표면은 **두 묶음 다섯이다.** ① 모드 C 부하 주입 표면 #1(GEN-07) — 경로에 ingest가 들어 있지만 ING 표면이 아니다. 호출 주체가 부하 주입이고 거절을 판정하는 것도 ING 소비 루프가 아니라 표면이 XADD 전에 하는 적체 검사다(docs_plan 보정 #11). ② **라이브 실행 제어 표면 #2~#5(GEN-11 · 12)** — 실증 화면 EXP-PERF · EXP-FLOW가 시연 실행을 시작 · 관찰 · 중단한다(사용자 요구 2026-09-28). 그래서 에러 네임스페이스는 둘 다 datagen이다. 생성 · 모드 A · B · D · 대조군 백필(GEN-01~06 · 08~10)은 여전히 실행 인자와 환경변수로 도는 내부 동작이며 표면이 없다(§원본에 없는 표면 판정).

**부하 주입 표면은 측정 도구다.** 모드 C가 재는 것은 HTTP 계층 · 인증 · 직렬화 비용을 포함한 수집 상한이다(원본 data_flow.md §11.1). 그래서 거절(503)은 실패가 아니라 관측값이고, 표면은 받은 순간 Stream에 넣고 끝나며 **적재 결과를 기다리지 않는다** — 기다리면 API 처리량이 아니라 Ingest 플러시 주기를 재게 된다(REQ-GEN-09). 기본값은 비활성이다 — 환경변수로 켜고 재기동해야 표면이 존재하고, 꺼진 표면은 404다(403은 역할을 바꾸면 풀린다는 오해를, 503은 재시도 폭주를 부른다 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen).

**라이브 실행 표면은 측정 도구가 아니라 시연 도구다.** 앱(api)을 거쳐 재므로 결과에는 항상 **"라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"** 표지가 붙고, 측정 기록(docs/measurements)을 만들지 않는다 — 대조 쿼리가 앱을 거치지 않는다는 판정([../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §스위치별 비교 대상)과 충돌하지 않는 이유다. 게이트 환경변수가 없고 기본 존재한다 — 방어는 127.0.0.1 바인드 · **동시 실행 하나** · 매개변수 화이트리스트가 맡는다(§라이브 실행 제어).
## 부하 주입 공통 규약

#1 표면 하나에 걸리는 규약이다. 라이브 실행 표면 #2~#5의 규약은 §라이브 실행 제어 §공통 규약(라이브 실행)이 따로 갖는다 — 게이트 · 레이트 리밋 등급 · 인가가 전부 다르다.

| 항목 | 규칙 | 근거 |
|------|------|------|
| 게이트 | 환경변수 **DATAGEN_BULK_ENABLED** — 기본 false · true일 때만 라우트가 존재 · 전환은 재기동 · **true로 기동하면 SW-01 off와 같은 방식으로 기동 경고 로그 1줄을 남긴다**(health 본문은 바꾸지 않는다) | REQ-GEN-08 · 이 문서 판정(이름) · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md) §부하 주입 표면 게이트 |
| 인증 | S7부터 인증 필수 · **역할 무관**(역할 1개 이상) · S5 모드 C 측정은 무인증 | 권한 매트릭스 §GEN · OBS 표면 인가 · REQ-AUT-16 |
| 경로 | 기계 호출(k6 · datagen 컨테이너) → api — 브라우저 · BFF가 부르지 않는다 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 레이트 리밋 | 부하 주입 등급 class **bulk_ingest** — **한도를 실험 부하 위에 둔다**(관계 R2 · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) | [01_conventions.md](./01_conventions.md) §한도 등급이 갈리는 표면 묶음 |
| 적체 검사 | XADD 전 stream:plc:raw 미확인 적체(그룹 lag + pending — XLEN이 아니다) · 백프레셔 **위험** 단계면 거절 · Collector 스풀 전환 · 모드 B 발행 중단과 같은 판정량 · 같은 임계 | ADR-21 · REQ-GEN-09 · [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) |
| 품질 | 모든 행 quality 9(SIMULATED) — 다른 값은 400 | REQ-GEN-02 · REQ-GLB-18 |
| 주입 모드 | 한 번에 한 모드 — 모드 C 실행 중 다른 모드를 돌리지 않는다(표면이 막지는 않는다) | REQ-GEN-05 |
| 단계 | S5 표면 · S7 인증 | [../02_features/05_datagen.md](../02_features/05_datagen.md) |

- 검산: 항목 = **8**
- **게이트 환경변수는 스위치(SW-NN)가 아니다.** 스위치는 같은 측정 대상의 구현을 바꾸고 on/off 비교를 만든다. 게이트는 측정 경로 하나의 존재를 가를 뿐이라 비교 대상이 없다 — 스위치 정본([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md))에 올리지 않고 health 스위치 목록에도 싣지 않는다(§미확인 · 미설계 등재).

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | POST | /api/v1/ingest/bulk | GEN-07 | 게이트 | 없음 | datagen.bulk_disabled/404 · common.validation_failed/400 · datagen.stream_full/503 | 없음 — k6 · datagen 컨테이너 | 원본 |
| **2** | POST | /api/v1/runs | GEN-11 · GEN-12 | ENGINEER · ADMIN | BFF no-store | common.validation_failed/400 · **datagen.run_in_progress/409** | EXP-PERF · EXP-FLOW | 신설 |
| **3** | GET | /api/v1/runs/current | GEN-11 · GEN-12 | 전원 | BFF no-store | 없음 | EXP-PERF · EXP-FLOW | 신설 |
| **4** | GET | /api/v1/runs/{runId} | GEN-11 · GEN-12 | 전원 | BFF no-store | common.validation_failed/400 · common.not_found/404 | EXP-PERF · EXP-FLOW | 신설 |
| **5** | POST | /api/v1/runs/{runId}/stop | GEN-11 · GEN-12 | ENGINEER · ADMIN | BFF no-store | common.validation_failed/400 · common.not_found/404 | EXP-PERF · EXP-FLOW | 신설 |

- 검산: 표면 = REST **5** · 원본 1 + 신설 4 = **5** · 부하 주입 1 + 라이브 실행 4 = **5**
- 역할 열의 시작 · 중단(#2 · #5) "ENGINEER · ADMIN"과 조회(#3 · #4) "전원"은 인증 도입(S7 ②) 뒤의 판정이다 — 그 전에는 무인증이다(판정 정본 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가). 조회를 전원에 여는 것은 읽기 원칙이다 — OPERATOR도 패널의 진행 · 완료 표시를 보고, 시작 · 중단 버튼만 비활성이다.
- **라이브 실행 표면은 실행 역할 api · all에서만 존재한다**(실행 주체 RunControlModule — [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md)). APP_ROLE이 worker · collector · datagen인 프로세스에는 라우트가 없다(404 — 코드 없음 · 존재하지 않는 경로와 같다).
- 역할 열 "게이트"는 권한 매트릭스의 판정 어휘다 — 꺼져 있으면 존재하지 않고, 켜지면 인증 사용자 전원이 부른다. 공통 4종 중 auth.forbidden은 역할 0 사용자에게만 난다.

## #1 POST /api/v1/ingest/bulk

### 요청 본문

본문은 Stream 엔트리 계약(3단계)의 JSON 표현이다. 표면은 엔트리 하나를 XADD 하나로 옮기며 **변환은 필드 이름과 인코딩(JSON → MessagePack)뿐이다** — 발행자 셋(Collector · 모드 B · 모드 C)이 같은 계약을 따른다(REQ-GLB-21).

| 필드 | 타입 | 엔트리 필드 | 규칙 |
|------|------|------|------|
| v | 정수 | v | 필수 · 현행 1 · 소비자가 읽는 버전만 받는다 |
| entries | 배열 | — | 1개 이상 · 요청당 엔트리 상한(2계층 · 소유 이 문서 · 현행 미정 — S5 실측) |
| entries[].deviceId | 정수 | d | 필수 · 마스터 존재는 검사하지 않는다 |
| entries[].scanSeq | 정수 | s | 필수 · 설비 안에서 단조 증가 |
| entries[].t0 | 정수(epoch ms) | t0 | 필수 · 엔트리 안 ts의 최솟값 |
| entries[].tagIds | 정수 배열 | tg | 필수 · 길이 = dt = values = quality |
| entries[].dt | 정수 배열 | dt | 필수 · **0 이상** · int32 범위 |
| entries[].values | 수 배열 | va | 필수 · 유한 값 |
| entries[].quality | 정수 배열 | q | 필수 · **전부 9** |

- 검산: 필드 = **9** · 엔트리 필드 대응 8(v · d · s · t0 · tg · dt · va · q) + 묶음 필드 1(entries)
- **deviceId의 마스터 존재를 검사하지 않는 이유** — 검사하면 요청마다 cache:devlist 또는 PostgreSQL을 읽어 HTTP 경유 수집 상한에 마스터 조회 비용이 섞인다. 마스터에 없는 설비의 행은 적재는 되고 조회에서 메타 없이 나온다 — 부하 도구가 시드의 설비 ID를 쓰는 것이 실험 절차다([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) 티어 시드 구성).
- **quality를 9 외에 받지 않는 이유(B형)** — 결론: HTTP로 들어온 값은 전부 생성 데이터다. 반대 시나리오 — 0(GOOD)을 받으면 같은 머신의 스크립트가 실데이터처럼 보이는 값을 싣고, 섞인 뒤에는 구분할 방법이 없다(전역 불변식 생성 데이터 구분). 파생 지침 — 생성기가 q에 9를 싣고 표면은 검증만 한다.
- **dt 음수를 400으로 거절한다.** 소비자(Ingest)는 음수 dt를 계수만 하고 적재하지만([../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 3단계), 표면은 발행자 결함을 입구에서 막을 수 있는 유일한 발행자다 — Collector · 모드 B는 코드 안에서 막는다.

요청 예시다(설비 12 · 스캔 사이클 하나 · 태그 3).

```json
{
  "v": 1,
  "entries": [
    { "deviceId": 12, "scanSeq": 884201, "t0": 1758675600000,
      "tagIds": [3401, 3402, 3403], "dt": [0, 0, 1],
      "values": [72.4, 101.3, 1], "quality": [9, 9, 9] }
  ]
}
```

- 시각은 측정 시각이라 epoch ms 정수다([01_conventions.md](./01_conventions.md) §시각 직렬화). **실시간 화면을 보는 실험은 현재 시각으로 생성한다** — 과거 t0를 찍으면 적재는 정상인데 최신값이 전부 STALE이다.
- 엔트리 하나 = 설비 하나의 시점 하나다(생성 모드). 한 요청에 여러 설비 · 시점을 묶는 것은 HTTP 왕복을 줄이는 수단일 뿐 엔트리를 합치지 않는다.

### 처리 단계와 응답

| 단계 | 동작 | 실패 응답 |
|:-:|------|------|
| ① | 게이트 확인 — DATAGEN_BULK_ENABLED false면 라우트가 없다 | 404 datagen.bulk_disabled |
| ② | 인증 · 레이트 리밋(S7부터) | 401 · 403 · 429(공통 4종) |
| ③ | 본문 검증 — 필드 · 길이 일치 · dt 0 이상 · quality 9 · 상한 | 400 common.validation_failed |
| ④ | 적체 검사 1회 — 요청 단위 | 503 datagen.stream_full · details.acceptedEntries 0 |
| ⑤ | 엔트리마다 XADD MAXLEN ~ — 파이프라인 1회 | 도중 Redis 실패 → 503 datagen.stream_full · details.acceptedEntries = 성공 수 |
| ⑥ | 응답 202 — acceptedEntries · acceptedRows | 해당 없음 |

- 검산: 단계 = **6**
- **202인 이유** — 표면은 버퍼에 넣었을 뿐 저장하지 않았다. XADD 뒤의 적재 실패(ClickHouse 불가 · DLQ 격리)는 응답에 싣지 않는다(REQ-GEN-09). 저장 확인은 E2E 게이지 · 무손실 대조의 몫이다.
- **적체 검사를 요청마다 한 번만 한다.** 엔트리마다 검사하면 검사 명령이 XADD 수만큼 늘어 Redis 왕복이 두 배가 된다. 요청 안의 엔트리가 임계를 조금 넘길 수 있는 폭은 요청당 엔트리 상한이 묶고, 그 너머는 MAXLEN이 최후 안전장치다(REQ-GLB-10).
- **부분 수용은 details.acceptedEntries로만 드러난다.** ⑤ 도중 실패면 앞 엔트리는 이미 Stream에 있다 — 부하 도구는 이 요청을 재전송하지 않는다. 재전송하면 앞 엔트리가 다른 엔트리 ID로 한 번 더 들어가 배치 토큰이 달라지고 중복 행이 된다([01_conventions.md](./01_conventions.md) §멱등).

응답 예시다.

```json
{ "acceptedEntries": 1, "acceptedRows": 3 }
```

- 거절 응답은 에러 봉투다 — datagen.stream_full의 details는 acceptedEntries 하나다([01_conventions.md](./01_conventions.md) §에러 봉투).
- **B형 — stream_full은 부하 도구에게 실패가 아니라 관측 대상이다.** 결론 — 발생률이 곧 HTTP 경유 수집 상한의 신호다. 반대 시나리오 — k6가 503을 재시도로 덮으면 백프레셔가 흡수한 양과 거절한 양을 가를 수 없다. 파생 지침 — k6 스크립트는 503을 별도 계수로 세고 재시도하지 않으며, 설계된 거절은 오류율에서 뺀다(REQ-NFR-11).

### 레이트 리밋과 측정 오염

| 한도 관계 | 먼저 오는 거절 | 측정되는 것 | 판정 |
|------|------|------|------|
| 부하 주입 등급 한도 < 실험 부하(요청/분) | 429 common.rate_limited | 레이트 리밋 한도 | **측정 무효** |
| 부하 주입 등급 한도 ≥ 실험 부하 | 503 datagen.stream_full | HTTP 경유 수집 상한 | 유효 |
| S5(무인증 · 계수 없음) | 503 | 인증 비용 없는 상한 | 유효 — S7 수치와 비교하지 않는다 |

- 검산: 관계 = **3**
- **한도 값의 소유는 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)다.** 이 문서는 조건만 건다 — 부하 주입 등급 한도는 티어별 실험 부하의 분당 요청 수 이상이어야 한다. 계수는 사용자 · 토큰 기준이라 부하 도구가 계정 하나를 쓰면 한 계수에 몰린다.
- S7 전후 수치는 커밋 해시로 가르고 같은 조건으로 비교하지 않는다(REQ-GEN-15).

## 라이브 실행 제어

사용자 요구(2026-09-28 — "데이터 처리를 시작하는 버튼 · 중단 버튼 · 완료 표시 · 걸린 시간")로 실증 화면 둘에 실행 패널이 생겼고, 이 절이 그 패널이 부르는 표면 #2~#5의 계약이다. 실행 종류는 둘이다 — **perf**(EXP-PERF 규모별 성능 비교 라이브 실행 · GEN-11)와 **flow**(EXP-FLOW 흐름 시연 실행 · GEN-12). 단계 · 취소 · 정리 · 생성 규칙의 기전 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §라이브 실행이고, 실행 수명 객체(run_perf_raw 둘)의 정본은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §실행 수명 객체다. 이 절은 표면에 드러나는 모양 — 요청 · 응답 · 상태 값 · 매개변수 · 중단과 실패의 의미 — 만 고정한다.

### 공통 규약(라이브 실행)

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 브라우저 → BFF → api · **BFF no-store** — 실행 객체는 순간값이라 캐시할 것이 없다 | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 · 캐시하면 running이 revalidate 창만큼 남아 끝난 실행을 진행 중으로 보인다 |
| 게이트 | **없다** — 기본 존재한다 · 방어는 127.0.0.1 바인드 · 동시 실행 하나 · 매개변수 화이트리스트(§매개변수) | 리드 판정 2026-09-28 · 잔여(로컬 사용자의 대량 적재 · 디스크 소모)는 [../12_security/04_threat_model.md](../12_security/04_threat_model.md) |
| 인증 · 인가 | 인증 도입(S7 ②) 전 무인증 · 뒤에는 시작 · 중단 **ENGINEER · ADMIN** · 조회 전원 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 |
| 레이트 리밋 | S7 ②부터 class **general** 계수(한도 정본 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) · **실행 패널 탭 하나의 1초 폴링은 분당 60 요청이다** — 폴링 항은 실행 패널 탭 수(현행 참고 2 — EXP-PERF · EXP-FLOW) × 60이고, 한도가 이보다 낮으면 폴링이 429로 끊겨 진행 표시가 멈춘다 · 관계식 R5가 막는다 | [01_conventions.md](./01_conventions.md) §한도 등급이 갈리는 표면 묶음 |
| 동시 실행 | **두 종류를 합쳐 한 번에 하나** — 진행 중(running · stopping)이 있으면 시작 요청은 datagen.run_in_progress/409 · details {runId, type} | REQ-GEN-16 |
| 실행 상태 자리 | **api 인스턴스 메모리** — 진행 중 실행 1 + 마지막으로 끝난 실행 1을 다음 시작 전까지 보관한다 · 재기동이면 둘 다 사라진다(실패가 아니라 기록 없음) | 리드 판정 3 · 로컬 단일 api |
| 시각 · 경과 | startedAt · endedAt은 UTC ISO 8601 Z(이름이 At으로 끝남 — [01_conventions.md](./01_conventions.md) §시각 직렬화) · elapsedMs는 **서버가 계산한 정수 ms** | REQ-GEN-19 |
| 결과 표지 | 결과는 **"라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님"** — 측정 기록을 만들지 않는다 · 화면은 기록 계열과 다른 계열 · 다른 모양으로 그린다 | 리드 판정 1 · [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) |
| 멱등 | #2 멱등 키 없음 — 진행 중 중복 시작은 409가 막고, 끝난 뒤의 시작은 새 실행이다 · #5는 자연 멱등(끝난 실행에 200 + 그대로) | [01_conventions.md](./01_conventions.md) §멱등 |
| 단계 | S5 표면(두 화면과 같은 단계) · S7 ② 인가 | [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-11 · 12 |

- 검산: 항목 = **10**
- **B형 — 409는 결함이 아니라 측정 보호다.** 결론 — 다른 실행이 돌고 있으면 시작하지 않는다. 반대 시나리오 — perf와 flow를 함께 돌리면 flow의 XADD · 배치 적재가 perf 쿼리 지연에 섞이고, perf의 INSERT … SELECT가 ClickHouse 머지를 올려 flow 배치 단계 막대가 늘어난다 — 두 화면이 서로의 부하를 잰다. 파생 지침 — 화면은 409의 details.runId로 #4를 불러 패널을 그 실행에 맞추고, 시작 버튼에 "다른 실행 진행 중" 링크를 단다.
- **A형 — "api를 재기동했더니 실행 기록이 사라졌다"는 버그가 아니다.** 통념은 실행 이력이 저장돼야 한다는 것이다. 부정 — 라이브 실행은 시연이고 측정 기록이 아니라서 저장할 정본이 없다 · 이력을 PostgreSQL에 쓰면 시연값이 기록처럼 쌓여 곡선에 섞일 자리가 생긴다. 진짜 축은 **정본 여부**다. 대체 경로 — 남길 수치는 측정 절차(EXP-NN · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md))로 다시 잰다. 재기동 뒤 #3은 run null · 옛 runId는 404이며, 부팅 때 남은 실행 수명 객체를 DROP한다.

### #2 POST /api/v1/runs

| 필드 | 타입 | 규칙 |
|------|------|------|
| type | 문자열 | 필수 · perf · flow 둘 중 하나 |
| params | 객체 | 선택 · type별 키만(§매개변수) · 생략한 키는 기본값 · 모르는 키 · 값 집합 밖 값은 400 |

- 검산: 필드 = **2**

| 단계 | 동작 | 실패 응답 |
|:-:|------|------|
| ① | 인증 · 인가 · 레이트 리밋(S7 ②부터) | 401 · 403 · 429(공통 4종) |
| ② | 본문 검증 — type · params 화이트리스트 | 400 common.validation_failed |
| ③ | 동시 실행 확인 — 진행 중(running · stopping) 실행이 있는가 | 409 datagen.run_in_progress · details {runId, type} |
| ④ | 실행 객체 생성 — runId(UUID) 발급 · 마지막으로 끝난 실행을 버린다 · steps 전부 pending으로 만든다 | 해당 없음 |
| ⑤ | 202 + 실행 객체(status running) — 실행은 응답 뒤 계속된다 | 해당 없음 |

- 검산: 단계 = **5**
- **202인 이유** — perf 10^8은 수 분 이상 걸린다. 끝날 때까지 응답을 잡으면 BFF · 브라우저 요청 시간 상한에 먼저 걸려 실행은 도는데 화면은 실패를 본다. 진행은 #3 폴링이 읽는다.
- ③과 ④는 한 임계 구역이다 — 두 시작 요청이 동시에 와도 하나만 running이 되고 나머지는 409다(REQ-GEN-16).

### #3 GET /api/v1/runs/current

응답은 200 하나다 — 본문 {run: 실행 객체 | null}.

| 서버 상태 | run |
|------|------|
| 진행 중 실행 있음(running · stopping) | 그 실행 |
| 진행 중 없음 · 마지막으로 끝난 실행 있음 | 그 실행(completed · stopped · failed) — 다음 시작 전까지 |
| 둘 다 없음(api 기동 뒤 첫 시작 전) | null |

- 검산: 상태 = **3**
- 화면은 진입 때 1회 부르고, run.status가 running · stopping이면 **1초마다** 다시 부르며, 종결 3값이면 폴링을 멈춘다. 받은 run.type이 자기 화면 종류가 아니면 시작 버튼을 비활성하고 그 화면으로 가는 링크만 단다(표시 계약 정본 [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md)).

### #4 GET /api/v1/runs/{runId}

200 + 실행 객체다. runId가 UUID가 아니면 400 common.validation_failed, 메모리에 없으면(진행 중도 마지막 종결도 아닌 옛 실행 · 재기동 전 실행) 404 common.not_found다. **없는 runId를 pending으로 두지 않는다** — 명령 조회(01_conventions #1)와 달리 runId는 이 인스턴스가 발급했으므로 모르는 값은 곧 사라진 값이다.

### #5 POST /api/v1/runs/{runId}/stop

| 대상 실행의 status | 응답 | 동작 |
|------|------|------|
| running(cleanup 전) | **202** + 실행 객체(status stopping) | 진행 중 단계에 취소를 건다 — §중단과 실패 |
| running(cleanup 진행 중 · perf) | **202** + 실행 객체 그대로(running) | 없음 — **중단을 무시한다** · 정리가 끝나면 completed(정리 실패면 failed) |
| stopping | **202** + 실행 객체 그대로 | 없음 — 이미 중단 중이다 |
| completed · stopped · failed | **200** + 실행 객체 그대로 | 없음 — 새 코드를 만들지 않는다(자연 멱등) |
| 메모리에 없음 | 404 common.not_found | 해당 없음 |

- 검산: 행 = **5** · 대상 status 5값 전부 든다(running은 cleanup 진행 여부로 두 행)
- **끝난 실행의 중단을 409로 내지 않는 이유** — 사용자가 중단을 누른 순간 실행이 완료되는 경합은 흔하다. 409면 화면이 오류를 띄우는데 사용자가 원한 상태(더 돌지 않음)는 이미 참이다. 200 + 그대로면 화면은 받은 status(completed)로 완료 표시를 그린다.
- 중단은 비동기다 — 202 뒤 종결(stopped)까지는 취소가 저장소에서 돌아오는 시간이 걸린다. 화면은 그 사이 버튼을 "중단 중…"으로 비활성한다.

## 실행 객체

두 종류가 같은 모양을 쓴다. 종류별로 다른 것은 params · steps의 key · detail · result의 안쪽뿐이다.

| 필드 | 타입 | 규칙 |
|------|------|------|
| runId | 문자열(UUID) | 시작 때 발급 · 이 인스턴스 안에서 유일 |
| type | 문자열 | perf · flow |
| status | 문자열 | 실행 status 5값(아래) |
| params | 객체 | **적용된 값 전부** — 생략한 키도 기본값으로 채워 싣는다 |
| startedAt | 문자열(UTC ISO 8601 Z) | 시작 요청을 받은 시각 |
| endedAt | 문자열 · null | 종결 시각 · 진행 중이면 null |
| elapsedMs | 정수 | 종결이면 endedAt − startedAt · 진행 중이면 **응답 시각** − startedAt — 서버가 계산한다 |
| steps | 배열 | 단계 목록 — 시작 때 전 단계가 pending으로 들어 있다(아래) |
| result | 객체 · null | 종류별 결과(§결과) — 단계가 끝날 때마다 채워진다 · 시작 직후 null |
| error | 객체 · null | {code, message} — code는 원인의 기존 에러 코드 또는 **null**(메시지 전용) · 실패 · 정리 실패 때만 |

- 검산: 필드 = **10**
- **elapsedMs를 화면이 startedAt에서 다시 계산하지 않는 이유(B형)** — 결론: 경과의 기준은 서버 시계 하나다. 반대 시나리오 — 브라우저가 지금 − startedAt을 계산하면 브라우저 시계가 서버보다 앞선 만큼 경과가 늘어나고, 종결 뒤 총 소요(서버 값)와 진행 중 마지막 표시가 어긋나 완료 순간 시간이 뒤로 뛴다. 파생 지침 — 화면은 진행 중일 때만 받은 elapsedMs에서 1초 틱으로 이어 세고, 폴링 응답마다 서버 값으로 다시 맞춘다.

### 실행 status

전송 enum 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) #21 · 상태 머신 5다.

| status | 뜻 | 종결 | 화면 표시 |
|------|------|:--:|------|
| running | 단계가 도는 중 | 아니오 | 진행 칩 · 경과 1초 틱 |
| stopping | 중단 요청을 받아 취소 · 정리 중 | 아니오 | "중단 중…" · 경과 1초 틱 |
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
| perf | prepare → 규모마다 fill-ch@{지수} · fill-pg@{지수} · query@{지수} → cleanup | 2 + 3 × (maxExponent − 4) — 기본 7이면 **11** | fill-* {rows(이 단계에 더한 행), ms, storageBytes(적재 뒤 누적)} · query {done, total 10} · prepare · cleanup {objects} |
| flow | prepare → publish → drain | **3** | publish {pointsSent, entriesSent, commandsSent, backpressurePauses, progress 0~1} · drain {drainMs, timedOut} · prepare {devices, tags}(시드 활성 설비 · 태그 수 — 시연 전용 행은 세지 않는다) |

- 검산: 종류 = **2**
- {지수}는 5 ~ maxExponent의 정수다(규모 10^지수 행). fill-pg는 ANALYZE를 포함한다. query는 동일 쿼리 5종 Q1~Q5 × 두 저장소 = 10(웜 · 워밍업 1회 버림 + 3회 — 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §동일 쿼리 5종).
- **cleanup은 중단 · 실패여도 돈다** — perf만 가진다. flow는 실행 수명 객체가 없어 정리 단계가 없다.

## 매개변수

params는 **닫힌 값 집합(화이트리스트)**이다 — 자유 수치를 받지 않는다. 게이트 환경변수 없이 표면을 기본 존재로 두는 방어의 한 축이다(§공통 규약(라이브 실행)).

| type | 키 | 값 집합 | 기본값 | 뜻 |
|------|------|------|------|------|
| perf | maxExponent | 5 · 6 · 7 · 8 | 7 | 규모 10^5부터 10^max까지 한 자릿수씩(격자 단계 5의 앞부분 · 정밀화 점 없음) |
| flow | pps | 1000 · 5000 · 10000 · 20000 · 50000 | 10000 | 생성기가 stream:plc:raw에 보내는 초당 포인트 |
| flow | durationSec | 30 · 60 · 120 · 300 | 60 | publish 단계 길이 |
| flow | bizPerSec | 0 · 0.5 · 1 · 2 | 1 | 초당 업무 명령 수(BizWritePort — master.device.patch · **시연 전용 설비 DEMO-FLOW-DEV에만** 새 이름 · 되돌림 없음) · 0이면 명령 없음 |

- 검산: 키 = perf 1 + flow 3 = **4** · 값 수 = 4 + 5 + 4 + 4 = **17**
- **10^8은 표면이 막지 않는다.** 화이트리스트 안이다 — 시작 전 예상 디스크(**상한값** · 추정 표기)와 "수 분 이상" 경고는 화면이 보인다(예상식 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6의 행당 저장 바이트 · 현행 참고). 디스크 부족은 단계 예외 → failed로 드러난다.
- 값 집합 확장은 이 표 · [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) REQ-GEN-17 · 18 · 화면 선택지를 같은 변경 단위에서 고친다.

## 결과

result는 단계가 끝날 때마다 채워진다 — 중단 · 실패한 실행도 끝난 단계까지의 결과를 싣는다.

| type | 필드 | 모양 |
|------|------|------|
| perf | scales[] | exponent · rows · fillMs {ch, pg} · storageBytes {ch, pg} · queries[] |
| perf | scales[].queries[] | q(Q1~Q5) · ch {values[3], median, rows} · pg {values[3], median, rows} · winner(ch · pg) · ratio(pg.median ÷ ch.median) · resultMatch(결과 행 수 일치) |
| flow | 수치 8 | pointsSent · entriesSent · commandsSent · commandsOk · commandsPending · commandsFailed · backpressurePauses · drainMs |

- 검산: 행 = **3** · flow 수치 = **8**
- **perf의 PostgreSQL 쪽은 I2 인덱스 변형 하나다**(격자 053 구조 판정의 기준 변형) — 화면 곡선의 라이브 계열이 "라이브 CH · 라이브 PG I2" 둘인 이유다. 역전 음영은 라이브 결과로 그리지 않는다(053 구조 판정만).
- commandsPending은 명령 응답이 202(대기 상한 초과)였던 수다 — 실패가 아니다([01_conventions.md](./01_conventions.md) §업무 쓰기 경로).
- **명령 1건 = 1이다(짝 없음).** commandsSent는 publish가 시연 전용 설비에 보낸 master.device.patch 수이고 commandsOk + commandsPending + commandsFailed와 같다 · prepare가 시연 전용 행(사이트 · 라인 · 설비)을 만드는 명령은 세지 않는다(기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §시연 전용 행).

## 중단과 실패

| 사건 | 진행 중 단계 | 미실행 단계 | cleanup(perf) | 최종 status | error |
|------|------|------|------|------|------|
| #5 중단 요청 | 취소 — ClickHouse는 실행에 붙인 query_id로 KILL QUERY · PostgreSQL은 다른 연결에서 실행 전용 연결 pid에 pg_cancel_backend · 생성기는 발행 루프 정지 → **stopped**(진행 중 0~1개 — 단계 경계면 0개 · flow prepare 중이어도 같다) · 끝난 단계는 done 유지 | skipped(flow drain 포함) | **돈다** | stopped | null · 정리 실패면 {code null, message} — status는 stopped 유지 |
| 단계 예외(저장소 불가 · 디스크 부족 등) | **failed** | skipped | **돈다** | failed | {code: 원인의 기존 에러 코드 또는 null, message} |
| 정상 경로 정리 실패(perf — 전 단계 done 뒤 DROP 실패) | 해당 없음 | 해당 없음 | cleanup **failed** | **failed** — 객체가 남은 실행을 완료로 보이지 않는다 | {code: 원인의 기존 에러 코드 또는 null, message} |
| cleanup 진행 중 #5 중단 요청 | cleanup 그대로 — **중단을 무시한다** | 해당 없음 | 돈다 | completed(정리 실패면 failed) | 정리 실패 때만 |
| api 재기동 · 종료 | 프로세스와 함께 사라진다 | 사라진다 | 부팅 때 남은 실행 수명 객체 DROP | 없음 — 기록 없음(#3 null · runId 404) | 해당 없음 |

- 검산: 사건 = **5**
- **B형 — failed는 에러 응답이 아니다.** 결론 — 실행 실패는 200 응답 안의 status failed와 error 필드다. 반대 시나리오 — 실패를 #3 · #4의 5xx로 내면 폴링이 실패 응답을 받아 패널이 "조회 실패"를 띄우고, 실행이 실패한 것인지 조회가 실패한 것인지 가를 수 없다. 파생 지침 — 에러 카탈로그에 run_failed 같은 코드를 만들지 않는다(실패 원인은 실행 객체 안의 관찰값 — [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) §에러 코드가 아닌 것).
- **정리 단계가 중단 · 실패여도 도는 이유** — 실행 수명 객체(run_perf_raw 둘 · 10^8이면 수십 GB 규모)가 남으면 다음 perf 실행의 prepare가 이미 있는 객체와 부딪히고, 디스크가 남은 채 다음 실험의 저장 비용 측정을 오염시킨다. 부팅 DROP은 프로세스가 죽어 정리를 못 한 경우의 마지막 안전장치다.

## 응답 예시

perf 실행 중(maxExponent 6 · 10^6 적재 중)의 #3 응답이다. 예시 수치는 모양 설명용이며 측정값이 아니다.

```json
{
  "run": {
    "runId": "7d3f0a52-1c2e-4b8e-9a61-3f5e2b9c4d10",
    "type": "perf",
    "status": "running",
    "params": { "maxExponent": 6 },
    "startedAt": "2026-09-28T05:12:03.000Z",
    "endedAt": null,
    "elapsedMs": 41250,
    "steps": [
      { "key": "prepare", "label": "실행 객체 생성", "status": "done", "startedAt": "2026-09-28T05:12:03.004Z", "endedAt": "2026-09-28T05:12:03.412Z", "elapsedMs": 408, "detail": { "objects": 2 } },
      { "key": "fill-ch@5", "label": "ClickHouse 10^5 적재", "status": "done", "startedAt": "2026-09-28T05:12:03.412Z", "endedAt": "2026-09-28T05:12:03.990Z", "elapsedMs": 578, "detail": { "rows": 100000, "ms": 578, "storageBytes": 1210000 } },
      { "key": "fill-pg@5", "label": "PostgreSQL 10^5 적재 · ANALYZE", "status": "done", "startedAt": "2026-09-28T05:12:03.990Z", "endedAt": "2026-09-28T05:12:05.310Z", "elapsedMs": 1320, "detail": { "rows": 100000, "ms": 1320, "storageBytes": 9830000 } },
      { "key": "query@5", "label": "10^5 쿼리 5종 × 두 저장소", "status": "done", "startedAt": "2026-09-28T05:12:05.310Z", "endedAt": "2026-09-28T05:12:12.100Z", "elapsedMs": 6790, "detail": { "done": 10, "total": 10 } },
      { "key": "fill-ch@6", "label": "ClickHouse 10^6 적재", "status": "done", "startedAt": "2026-09-28T05:12:12.100Z", "endedAt": "2026-09-28T05:12:14.020Z", "elapsedMs": 1920, "detail": { "rows": 900000, "ms": 1920, "storageBytes": 11400000 } },
      { "key": "fill-pg@6", "label": "PostgreSQL 10^6 적재 · ANALYZE", "status": "running", "startedAt": "2026-09-28T05:12:14.020Z", "endedAt": null, "elapsedMs": 30230, "detail": {} },
      { "key": "query@6", "label": "10^6 쿼리 5종 × 두 저장소", "status": "pending", "startedAt": null, "endedAt": null, "elapsedMs": null, "detail": {} },
      { "key": "cleanup", "label": "실행 객체 DROP", "status": "pending", "startedAt": null, "endedAt": null, "elapsedMs": null, "detail": {} }
    ],
    "result": { "scales": [ { "exponent": 5, "rows": 100000, "fillMs": { "ch": 578, "pg": 1320 }, "storageBytes": { "ch": 1210000, "pg": 9830000 }, "queries": [ { "q": "Q1", "ch": { "values": [4.1, 3.9, 4.0], "median": 4.0, "rows": 1 }, "pg": { "values": [2.2, 2.1, 2.3], "median": 2.2, "rows": 1 }, "winner": "pg", "ratio": 0.55, "resultMatch": true } ] } ] },
    "error": null
  }
}
```

- 단계 8 = 2 + 3 × (6 − 4). fill-ch@6의 rows 900000은 앞 규모에 **미래 방향으로 이어 채운** 행 수다(시작 S 고정 · 잘라 다시 만들지 않는다 · 마지막 규모의 끝 = 실행 시작 — 기전 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)). queries[]는 Q1 한 행만 보였다.

flow 실행이 끝난 뒤의 #4 응답이다(예시 수치는 모양 설명용).

```json
{
  "runId": "b0c9e4d1-58a2-4f37-8e0b-6a1d2c3e4f50",
  "type": "flow",
  "status": "completed",
  "params": { "pps": 10000, "durationSec": 60, "bizPerSec": 1 },
  "startedAt": "2026-09-28T06:00:00.000Z",
  "endedAt": "2026-09-28T06:01:02.410Z",
  "elapsedMs": 62410,
  "steps": [
    { "key": "prepare", "label": "시드 설비 · 태그 로드 · 시연 전용 행 확인", "status": "done", "startedAt": "2026-09-28T06:00:00.002Z", "endedAt": "2026-09-28T06:00:00.570Z", "elapsedMs": 568, "detail": { "devices": 50, "tags": 10000 } },
    { "key": "publish", "label": "발행", "status": "done", "startedAt": "2026-09-28T06:00:00.570Z", "endedAt": "2026-09-28T06:01:00.570Z", "elapsedMs": 60000, "detail": { "pointsSent": 600000, "entriesSent": 3000, "commandsSent": 60, "backpressurePauses": 0, "progress": 1 } },
    { "key": "drain", "label": "적체 소진", "status": "done", "startedAt": "2026-09-28T06:01:00.570Z", "endedAt": "2026-09-28T06:01:02.410Z", "elapsedMs": 1840, "detail": { "drainMs": 1840, "timedOut": false } }
  ],
  "result": { "pointsSent": 600000, "entriesSent": 3000, "commandsSent": 60, "commandsOk": 59, "commandsPending": 1, "commandsFailed": 0, "backpressurePauses": 0, "drainMs": 1840 },
  "error": null
}
```

- commandsSent 60 = durationSec 60 × bizPerSec 1(명령 1건 = 1 · 전부 DEMO-FLOW-DEV) = commandsOk 59 + commandsPending 1 + commandsFailed 0 · entriesSent 3000 = 60초 × 설비 50(pps 10000 = 태그 10000이라 초마다 태그 전부 한 번 · 같은 설비 · 같은 ts 한 엔트리).
- elapsedMs 62410 = endedAt − startedAt이다 — 화면의 "완료 — 총 소요 1분 2.4초"가 이 값 하나에서 나온다(REQ-GEN-19 · AC-46).
- 409 응답은 에러 봉투다 — {"error": {"code": "datagen.run_in_progress", "message": "…", "details": {"runId": "…", "type": "perf"}}}([01_conventions.md](./01_conventions.md) §에러 봉투).

## 원본에 없는 표면 판정

인계 두 건 — 생성기 실행 제어 표면 · 실행 중 주입 제어 표면의 필요 여부 — 를 닫는다. **판정 — 둘 다 두지 않는다.** 2026-09-28 사용자 요구로 **라이브 실행 제어(#2~#5)는 둔다** — 아래 표의 마지막 행이 그것을 두지 않는 후보들과 가르는 축이다.

| 후보 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 생성기 실행 · 정지(모드 A · B · D · 대조군 백필) | **두지 않는다** | 원본 API 표에 없다 · 기능 GEN-01~06 · 08~10의 표면 열이 "실행 인자" · 권한 매트릭스 판정 "내부 — 머신 접근" | 실행 표면을 열면 실행 조건(시드 · 티어 · 모드)이 요청 본문으로 흩어져 측정 기록의 실험 조건과 따로 논다 · 앱 인가 밖이던 실험 손잡이에 인가 판정 한 자리가 생긴다 |
| 실행 중 주입 제어(SIM 지연 · 오류 주입 시작 · 해제) | **두지 않는다** | W4 판정 — 제어 수단은 기동 시 읽는 주입 계획 · 전환 = 재기동 원칙([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어) | 요청 시각이 실험 기록과 따로 놀아 "언제 장애를 넣었는가"가 기록에 없다 · 새 표면 · 인가 · 레이트 리밋 방어 지점이 생긴다 |
| 생성기 상태 조회(진행률 · pps) | **두지 않는다** | 생성기 계측은 /metrics가 노출한다 · 기능 근거 없음 | 같은 수치가 두 표면에 있으면 실험 콘솔이 어느 쪽을 읽는지에 따라 값이 다르다 |
| 모드 B 표면(Stream 직결 HTTP 대행) | **두지 않는다** | 모드 B의 정의가 HTTP를 거치지 않는 것이다 | HTTP를 거치면 모드 C다 — 모드 둘이 같은 경로를 재게 된다 |
| **라이브 실행 제어(EXP-PERF · EXP-FLOW 시연 실행)** | **둔다 — #2~#5**(2026-09-28) | 사용자 요구 2026-09-28 · GEN-11 · 12 · **측정 기록을 만들지 않는 시연**이라 위 첫 행의 실패(실험 조건이 요청 본문으로 흩어져 기록과 따로 논다)가 성립하지 않는다 — 기록이 없으니 어긋날 기록 조건도 없다 · 시드 · 티어 · 모드를 요청으로 받지 않고 닫힌 매개변수 4키만 받는다 | 두지 않으면(옛 판정) 두 실증 화면이 "기록을 읽기만 하는 화면"에 머물러 시연 청중 앞에서 시작 · 중단 · 소요 시간을 보일 수 없다 — 사용자 요구 불충족 |

- 검산: 후보 = **5** · 둔다 1(라이브 실행 — 표면 4) · 두지 않는다 4
- **라이브 실행의 진행 수치와 /metrics는 같은 수치가 아니다** — 셋째 행(생성기 상태 조회)의 실패가 재발하지 않는 이유다. 실행 객체의 pointsSent는 그 실행 하나의 누계이고, /metrics의 gen_points_generated_total{mode="run"}은 프로세스 기동 이후 누계다(메트릭 정본 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)). 화면은 실행 패널에 앞의 것을, 흐름도 카드에 뒤의 것을 쓴다.
- **"실험 콘솔에서 생성기(모드 A~D)를 켜고 싶다"는 요구가 오면 이 표가 반론이다.** 라이브 실행은 모드 A~D의 원격 손잡이가 아니다 — 측정 기록을 만드는 실험은 여전히 호스트 셸의 실행 인자 · 환경변수 · 재기동으로만 돈다. 실험 콘솔(EXP-CONSOLE)은 표시 전용이다(docs_plan 보정 #14 · 권한 매트릭스 §실험 수행자와 실험 콘솔). 스위치 · 게이트 · 생성기의 전환은 모두 호스트 셸의 환경변수와 재기동이다(D-06).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 요청당 엔트리 상한 · 본문 크기 상한 | 2계층 미정 — 소유 이 문서 · S5 실측으로 정한다 | 이 문서 · [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) · EXP-37 |
| 부하 주입 등급 한도 값 · class 이름 | **W7 닫힘** — class bulk_ingest · 한도 관계 R2(≥ 모드 C 실험 부하의 분당 요청 수) · 값 2계층 미정(요청당 엔트리 상한 확정 뒤) | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| 게이트 상태의 기록 자리 | health 본문에 싣지 않는다(스위치가 아니다) · 모드 C 측정 기록의 실험 조건 칸에 사람이 적는다 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §조건 칸(게이트 · SIM 주입 계획) |
| 모드 C 처리량 · 인증 비용 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 인증 비용은 S7 기록의 aut_token_verify_seconds | EXP-37 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 게이트 환경변수 이름 등재 | 이 문서 판정 DATAGEN_BULK_ENABLED — **W6 등재 완료**(환경변수 정본 · 스위치 목록 밖) · **W7 보안 리뷰 닫힘** — 게이트 유지 · 기동 경고 추가 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)(W6 · W7) |
| 라이브 실행 소요 시간(perf 규모별 · flow drain) | 3계층 미확인 — 확정 전 임의 값 고정 금지 · **시연값이라 확정 대상도 아니다**(기록 정본 아님) — 10^8 경고 문구의 "수 분 이상"은 판정이 아니라 안내다 | [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) |
| 1초 폴링과 일반 등급 한도의 관계 | **닫힘 — 관계식 R5**(general ≥ R3의 오른쪽 항 + 실행 패널 탭 수(현행 참고 2) × 폴링 분당 60) · 한도 값은 2계층 미정(S7 ②) | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 한도 등급 · 멱등 · 봉투 · 시각 직렬화 · BFF 경유
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 실행 status #21 · step status #22 · 상태 머신 5
- [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) — 실행 패널(EXP-PERF · EXP-FLOW)
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 실행 수명 객체 · 동일 쿼리 5종
- [02_errors.md](./02_errors.md) — datagen 네임스페이스 미러
- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN-01~12 · 부하 주입 표면이 GEN 소유인 이유
- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 계약
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — 모드 C 표면 기전 · SIM 주입 제어 판정 · 라이브 실행 기전
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — Stream 엔트리 계약
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계
