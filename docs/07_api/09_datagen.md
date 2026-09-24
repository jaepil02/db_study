# GEN — 부하 주입 표면 (09_datagen)

> **대상**: GEN 도메인 표면 — 모드 C 부하 주입 POST /api/v1/ingest/bulk의 게이트(환경변수 이름) · 인증 · 요청 본문(엔트리 계약 변환) · 백프레셔 거절 datagen.stream_full/503 · 부분 수용 · 레이트 리밋 등급 · **생성기 실행 제어 표면 판정** · **실행 중 주입 제어 표면 필요 여부 판정**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 게이트 true 기동 시 **경고 로그 1줄** · 레이트 리밋 class **bulk_ingest** · 한도 관계 R2 — 표면 수 불변(정본 12_security/02 · 03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 · 기록 칸 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — DATAGEN_BULK_ENABLED를 환경변수 정본(09_tech_stack/04)에 등재했다
> **원천**: 원본 architecture.md §9.3 · §11 · §18(커밋 ff66a37) · 원본 data_flow.md §11 · §11.1 · §12.1 · §14.1(커밋 ff66a37) · REQ-GEN-02 · 05 · 08 · 09 · 15 · REQ-GLB-10 · 21 · REQ-AUT-16 · ADR-21 · ADR-23 · D-06 · D-07 · [../02_features/05_datagen.md](../02_features/05_datagen.md) GEN-07 · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §모드 C 표면 · §SIM 주입 제어 · [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) 3단계 · docs_plan.md 실행 계획 보정 #11 · 웨이브 인계 W5 07_api 행(생성기 실행 제어 · 실행 중 주입 제어)

GEN이 가진 표면은 **하나뿐이다.** 모드 C 부하 주입 표면(GEN-07)이며, 경로에 ingest가 들어 있지만 ING 표면이 아니다 — 호출 주체가 부하 주입이고 거절을 판정하는 것도 ING 소비 루프가 아니라 표면이 XADD 전에 하는 적체 검사다(docs_plan 보정 #11). 그래서 에러 네임스페이스도 datagen이다. 생성 · 모드 A · B · D · 대조군 백필(GEN-01~06 · 08~10)은 실행 인자와 환경변수로 도는 내부 동작이며 표면이 없다.

**이 표면은 측정 도구다.** 모드 C가 재는 것은 HTTP 계층 · 인증 · 직렬화 비용을 포함한 수집 상한이다(원본 data_flow.md §11.1). 그래서 거절(503)은 실패가 아니라 관측값이고, 표면은 받은 순간 Stream에 넣고 끝나며 **적재 결과를 기다리지 않는다** — 기다리면 API 처리량이 아니라 Ingest 플러시 주기를 재게 된다(REQ-GEN-09).

**기본값은 비활성이다.** 환경변수로 켜고 재기동해야 표면이 존재한다(원본 architecture.md §11 · §18). 꺼진 표면은 404다 — 403은 역할을 바꾸면 풀린다는 오해를, 503은 재시도 폭주를 부른다([../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) datagen).

## 공통 규약

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

- 검산: 표면 = REST **1** · 원본 1 + 신설 0 = **1**
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

## 원본에 없는 표면 판정

인계 두 건 — 생성기 실행 제어 표면 · 실행 중 주입 제어 표면의 필요 여부 — 를 닫는다. **판정 — 둘 다 두지 않는다.**

| 후보 | 판정 | 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 생성기 실행 · 정지(모드 A · B · D · 대조군 백필) | **두지 않는다** | 원본 API 표에 없다 · 기능 GEN-01~06 · 08~10의 표면 열이 "실행 인자" · 권한 매트릭스 판정 "내부 — 머신 접근" | 실행 표면을 열면 실행 조건(시드 · 티어 · 모드)이 요청 본문으로 흩어져 측정 기록의 실험 조건과 따로 논다 · 앱 인가 밖이던 실험 손잡이에 인가 판정 한 자리가 생긴다 |
| 실행 중 주입 제어(SIM 지연 · 오류 주입 시작 · 해제) | **두지 않는다** | W4 판정 — 제어 수단은 기동 시 읽는 주입 계획 · 전환 = 재기동 원칙([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §SIM 주입 제어) | 요청 시각이 실험 기록과 따로 놀아 "언제 장애를 넣었는가"가 기록에 없다 · 새 표면 · 인가 · 레이트 리밋 방어 지점이 생긴다 |
| 생성기 상태 조회(진행률 · pps) | **두지 않는다** | 생성기 계측은 /metrics가 노출한다 · 기능 근거 없음 | 같은 수치가 두 표면에 있으면 실험 콘솔이 어느 쪽을 읽는지에 따라 값이 다르다 |
| 모드 B 표면(Stream 직결 HTTP 대행) | **두지 않는다** | 모드 B의 정의가 HTTP를 거치지 않는 것이다 | HTTP를 거치면 모드 C다 — 모드 둘이 같은 경로를 재게 된다 |

- 검산: 후보 = **4** · 신설 0
- **"실험 콘솔에서 생성기를 켜고 싶다"는 요구가 오면 이 표가 반론이다.** 실험 콘솔은 표시 전용이다(docs_plan 보정 #14 · 권한 매트릭스 §실험 수행자와 실험 콘솔). 스위치 · 게이트 · 생성기의 전환은 모두 호스트 셸의 환경변수와 재기동이다(D-06).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 요청당 엔트리 상한 · 본문 크기 상한 | 2계층 미정 — 소유 이 문서 · S5 실측으로 정한다 | 이 문서 · [../10_observability/05_load_scenarios.md](../10_observability/05_load_scenarios.md) · EXP-37 |
| 부하 주입 등급 한도 값 · class 이름 | **W7 닫힘** — class bulk_ingest · 한도 관계 R2(≥ 모드 C 실험 부하의 분당 요청 수) · 값 2계층 미정(요청당 엔트리 상한 확정 뒤) | [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |
| 게이트 상태의 기록 자리 | health 본문에 싣지 않는다(스위치가 아니다) · 모드 C 측정 기록의 실험 조건 칸에 사람이 적는다 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) §조건 칸(게이트 · SIM 주입 계획) |
| 모드 C 처리량 · 인증 비용 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 인증 비용은 S7 기록의 aut_token_verify_seconds | EXP-37 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 게이트 환경변수 이름 등재 | 이 문서 판정 DATAGEN_BULK_ENABLED — **W6 등재 완료**(환경변수 정본 · 스위치 목록 밖) · **W7 보안 리뷰 닫힘** — 게이트 유지 · 기동 경고 추가 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) · [../12_security/02_secrets_config.md](../12_security/02_secrets_config.md)(W6 · W7) |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — 한도 등급 · 멱등 · 봉투
- [02_errors.md](./02_errors.md) — datagen 네임스페이스 미러
- [../02_features/05_datagen.md](../02_features/05_datagen.md) — GEN-01~10 · 부하 주입 표면이 GEN 소유인 이유
- [../03_requirements/06_datagen.md](../03_requirements/06_datagen.md) — REQ-GEN 계약
- [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) — 모드 C 표면 기전 · SIM 주입 제어 판정
- [../06_pipeline/12_data_contract.md](../06_pipeline/12_data_contract.md) — Stream 엔트리 계약
- [../04_architecture/06_backpressure_failure.md](../04_architecture/06_backpressure_failure.md) — 백프레셔 임계
