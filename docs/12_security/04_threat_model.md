# 위협 모델 (04_threat_model)

> **대상**: db_study 전체를 위협 관점에서 다시 읽은 결과 — 범위와 전제 · 행위자 · 자산 · 신뢰 경계 · **위협 × 통제 추적(기존 REQ · 에러 코드 · 설정으로만)** · 무인증 기간 · 공개 표면 · **잔여 위험 등재** · 통제가 생긴 위협의 반영 이력
> **작성일**: 2026-09-24
> **원천**: 신설 — 원본 architecture.md §2 · §3 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.4(커밋 ff66a37) · 원본 implementation_plan.md §2.5(커밋 ff66a37) · D-02 · D-07 · ADR-18 · REQ-GLB-10 · 18 · 19 · REQ-AUT-01~17 · REQ-OBS-10 · REQ-TEC-02 · 14 · REQ-WRK-07 · 09 · REQ-GEN-02 · 08 · [01_authn_authz.md](./01_authn_authz.md) · [02_secrets_config.md](./02_secrets_config.md) · [03_api_surface_defense.md](./03_api_surface_defense.md) · [05_local_exposure.md](./05_local_exposure.md) · [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §GEN · OBS 표면 인가 · [../07_api/10_metrics.md](../07_api/10_metrics.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 형식

이 문서는 **통제를 새로 만들지 않는다.** 모든 통제는 이미 채번된 REQ · 에러 코드 · 설정 · 이 폴더의 판정으로 추적한다 — 이 폴더는 아무것도 채번하지 않는다([README.md](./README.md)). 기존 통제로 닫히지 않는 위협은 잔여로 등재하고, 통제가 필요하면 반영 자리를 제안으로 적어 정본에 반영한 뒤 이력으로 남긴다. **"아무도 막지 않는다"를 누락이 아니라 기록된 상태로 만드는 것**이 이 문서의 목적이다.

**가장 지켜야 할 자산은 측정의 무결성이다.** db_study는 서비스가 아니라 측정으로 배우는 시스템이다(D-02 · 학습 목표 2축). 업무 데이터가 새는 것보다 **측정 기록이 조용히 오염되는 것**이 목적을 더 직접 무너뜨린다 — 레이트 리밋 거절이 섞인 지연 분포, 방치된 부하 주입 표면이 넣은 행, 수동 조작이 남긴 캐시가 그 예다. 그래서 이 모델은 기밀성 · 무결성 · 가용성에 **측정 무결성**을 한 축으로 더한다.

## 범위와 전제

| 전제 | 내용 | 근거 | 이 전제가 깨지면 |
|------|------|------|------|
| 실행 위치 | 로컬 머신 1대 · 호스트 포트 전부 127.0.0.1 | D-02 · REQ-TEC-02 · ADR-18 | 원격 접속이 생기는 순간 §로그인 시도 제한 · 회전 없음 판정이 무효다([03_api_surface_defense.md](./03_api_surface_defense.md) · [01_authn_authz.md](./01_authn_authz.md)) |
| 프로토콜 | http · ws — TLS 없음 | D-02 | 해당 없음 — TLS를 현행 범위로 두지 않는다 |
| 사용자 | 학습자 1인 · 계정 1 · 역할 3 | REQ-AUT-17 | 다중 사용자면 계정 공유 잔여(k6와 브라우저의 한 계수)가 사용자 간 간섭이 된다 |
| 범위 밖 | 호스트 OS 관리자 권한 탈취 · 물리 접근 · 공급망(이미지 · 패키지) 변조 | 이 문서 판정 | 호스트가 넘어가면 .env · 볼륨 · 메모리가 전부 넘어간다 — 애플리케이션 계층이 막을 수 있는 것이 없다 |

- 검산: 전제 = **4**
- 공급망은 범위 밖이지만 **버전 고정(REQ-TEC-04 · latest 금지)**이 부분 통제다 — 같은 태그가 다른 이미지를 가리키는 변화를 기록 단위로 드러낸다.

## 행위자

| 행위자 | 도달 가능한 것 | 가진 것 | 대표 동기 · 사고 |
|------|------|------|------|
| 다른 사이트 페이지(학습자 브라우저 안) | localhost 표면에 대한 브라우저 요청 — 응답은 CORS가 막는다 | 학습자의 브라우저 · 쿠키(cross-site라 Lax가 막음) | 악성 광고 · 스크립트의 localhost 탐색 |
| 다른 로컬 웹 앱(localhost의 다른 포트) | 위와 같음 + **same-site라 리프레시 쿠키가 실린다** | 상동 | 학습자가 띄운 다른 개발 서버 · 문서 뷰어의 결함 |
| 같은 머신의 프로세스 · 스크립트 | 127.0.0.1의 모든 포트 · 브라우저 밖이라 Origin을 위조한다 | 학습자와 같은 OS 사용자면 .env · 볼륨 파일까지 | 오작동한 부하 스크립트 · 잘못된 대량 호출 · 악성 패키지 |
| LAN의 다른 기기 | **없다** — 127.0.0.1 바인드(웹 개발 서버는 기동 인자 — §위협 × 통제) | 없음 | 해당 없음 |
| 사본 수령자 | 공유된 Git 저장소 · 스냅샷 tgz · 측정 기록 · 로그 | 사본의 내용 전부 | 학습 자료 공유 · 질문 게시 |
| 학습자 자신의 실수 | 전부 | 전부 | 게이트 방치 · 수동 SQL · 자리표시 비밀 · 볼륨 삭제 |

- 검산: 행위자 = **6** · 도달 없음 1(LAN)
- **가장 흔한 행위자는 학습자 자신의 실수다.** 이 시스템의 방어 상당수(게이트 기본 false · 기동 거부 · 추가 전용 권한 · 스냅샷 선행)는 공격이 아니라 실수를 향한다.

## 자산

| 자산 | 자리 | 손상 축 | 손상되면 |
|------|------|------|------|
| 액세스 토큰 서명 키 | .env · api 메모리 | 기밀 | 임의 사용자 토큰 위조 — 인가 전체 붕괴 |
| 리프레시 토큰 | 쿠키 · Redis(요약값 키) | 기밀 | 리프레시 수명 동안 로그인 권한 |
| 저장소 자격 증명 | .env · 접속 문자열 | 기밀 | 저장소 전권 — 앱 인가 우회 |
| 비밀번호 해시 | user_account · 덤프 | 기밀 | 대입 비용만큼 버티는 학습자 비밀번호 |
| 업무 데이터 · 감사 행 | PostgreSQL | 무결 | 감사가 거짓 귀속을 담는다 · 마스터 변환식 의미 변경 |
| 시계열 · 판정 전수 | ClickHouse | 무결 · 가용 | 생성 데이터와 실데이터의 혼동 · 조회 불가 |
| 수집 버퍼 · 최신값 | Redis 봉인 계열 | 가용 · 무결 | 적재 유실 · 대시보드 정지 |
| **측정 무결성** | 측정 기록 · health run · /metrics | 무결 | **틀린 수치가 4요소를 갖춘 채 정본에 인용된다** |
| 가용성(적재 경로) | api 이벤트 루프 · ClickHouse 메모리 | 가용 | 조회 한 건이 적재를 멈춘다 |

- 검산: 자산 = 기밀 4 + 무결 3(업무 데이터 · 시계열 · 측정 무결성) + 가용 2(수집 버퍼 · 적재 경로) = **9** — 세는 기준은 손상 축 열의 **첫 축**이다

## 신뢰 경계

경계를 바깥에서 안으로 적는다. 우측은 그 경계를 지키는 장치다.

```plain
LAN · 인터넷
└── 127.0.0.1 바인드 ─────────────────────────── ADR-18 · REQ-TEC-02 · REQ-GLB-19
    같은 머신(Windows 호스트 + WSL2 VM — mirrored면 루프백 공유)
    ├── 브라우저 ─────────────────────────────── CORS · SameSite · Origin 검증
    │   ├── 다른 사이트 페이지                     cross-site — Lax · CORS가 막는다
    │   ├── 다른 로컬 웹 앱                        same-site — BFF Origin 대조(REQ-AUT-13)
    │   └── 웹 3001 · BFF                         리프레시 쿠키의 유일한 자리
    ├── 프로세스 · 스크립트 ────────────────────── 인증(S7) · 레이트 리밋 · 저장소 비밀번호
    │   ├── api 3000                              Guard · 스키마 검증 · 범위 강제
    │   └── 저장소 5432 · 8123 · 9000 · 6379       비밀번호 · DB 역할 권한
    └── 파일 ─────────────────────────────────── .gitignore · 자리표시 · 스냅샷 비공유
        └── .env · 볼륨 · snapshots/ · 로그
```

- **127.0.0.1 바인드는 가장 바깥 경계 하나만 긋는다.** 그 안쪽의 세 갈래(브라우저 · 프로세스 · 파일)는 각자 다른 장치가 지킨다 — 바인드를 근거로 안쪽 방어를 생략하지 않는다(전역 불변식 로컬 전용).
- **브라우저 갈래는 출처(Origin)로, 프로세스 갈래는 신원(토큰 · 비밀번호)으로 가른다.** 프로세스는 Origin을 위조하므로 Origin 검사는 프로세스를 막지 못한다.
- mirrored 네트워킹의 함의는 [05_local_exposure.md](./05_local_exposure.md) §WSL2 mirrored의 함의가 갖는다.

## 위협 × 통제

통제 열은 기존 REQ · 에러 코드 · 설정 · 이 폴더 판정만 적는다. 판정 열 — **닫힘**(기존 통제로 충분) · **부분**(통제가 있으나 잔여가 남음) · **열림**(통제 없음 — §통제가 생긴 위협에 반영 대기로 먼저 등재).

| 위협 | 행위자 | 자산 | 통제 | 판정 |
|------|------|------|------|------|
| 리프레시 토큰을 페이지 스크립트가 읽는다 | 다른 사이트 · XSS | 리프레시 토큰 | httpOnly 쿠키(REQ-AUT-04) · auth 표면 CORS 제외 · BFF 경유 | 닫힘 |
| 액세스 토큰 위조 · 알고리즘 혼동 | 프로세스 | 서명 키 | 서명 검증 auth.unauthenticated/401(REQ-AUT-07) · 알고리즘 검증 쪽 고정([01_authn_authz.md](./01_authn_authz.md)) | 닫힘 |
| 서명 키 · 자격 증명 커밋 | 학습자 실수 · 사본 수령자 | 서명 키 · 자격 증명 | REQ-TEC-14 · .gitignore · 자리표시 기동 거부([02_secrets_config.md](./02_secrets_config.md)) | 닫힘 |
| 계정 존재 탐색 | 프로세스 | 비밀번호 해시 · 계정 | 비활성 · 없는 계정도 auth.invalid_credentials/401 · 대조 시간 동일(REQ-AUT-02) | 닫힘 |
| 비밀번호 대입 | 프로세스 | 학습자 계정 | Argon2id 비용(REQ-AUT-01 · [01_authn_authz.md](./01_authn_authz.md)) · 시도 제한 없음 판정 | 부분 |
| 스냅샷 · 덤프 공유로 해시 · 토큰 유출 | 사본 수령자 | 해시 · 리프레시 토큰 | Argon2id · 리프레시 요약값 키 · snapshots/ Git 제외 | 부분 |
| 로그아웃한 토큰 재사용 | 쿠키 사본 보유자 | 리프레시 토큰 | 로그아웃 DEL(REQ-AUT-06) · Redis 불가 시 거절 auth.token_store_unavailable/503(REQ-AUT-14) | 부분 |
| 권한 밖 표면 호출 | 인증 사용자 · 프로세스 | 업무 데이터 | Guard auth.forbidden/403(REQ-AUT-09) · 권한 사본 즉시 삭제(REQ-AUT-10) | 닫힘 |
| 저장소 장애를 틈탄 인가 우회 | 해당 없음 — 장애 | 업무 데이터 | 권한 판정 불가 시 common.postgres_unavailable/503(REQ-AUT-15) | 닫힘 |
| SQL 조립 주입 | 프로세스 · 무인증 기간 브라우저 | 시계열 · 업무 데이터 | 스키마 검증 common.validation_failed/400(REQ-GLB-19) · 파라미터 바인딩 · 대응표(REQ-GLB-24 · [03_api_surface_defense.md](./03_api_surface_defense.md)) | 닫힘 |
| 대량 스캔으로 ClickHouse 마비 | 프로세스 · 스크립트 오작동 | 가용성 | 태그 상한 timeseries.too_many_tags/400 · 자동 해상도(REQ-TSQ-03 · 04) · 내보내기 범위 상한 · bulk_read · export 등급 common.rate_limited/429 | 부분 — 무인증 기간에는 등급 계수 없음 |
| 수집 버퍼 범람 | 부하 스크립트 · 게이트 방치 | 수집 버퍼 · 가용성 | 적체 검사 datagen.stream_full/503(REQ-GLB-10) · MAXLEN 최후 안전장치 · 게이트 기본 false datagen.bulk_disabled/404(REQ-GEN-08) | 닫힘 |
| 생성 데이터를 실데이터로 위장 | 프로세스 | 시계열 | quality 9 외 거절(REQ-GEN-02 · REQ-GLB-18) | 닫힘 |
| 마스터에 없는 설비 ID 주입 | 게이트가 열린 동안의 프로세스 | 시계열 | 없음 — 마스터 존재를 검사하지 않는다([../07_api/09_datagen.md](../07_api/09_datagen.md) 판정) · 원시 보존이 지운다 | 부분 |
| 감사 행 변조 · 삭제 | 앱 코드 결함 · 수동 SQL | 감사 행 | app_rw에 UPDATE · DELETE 없음(REQ-WRK-09) · 감사 대상 기준(REQ-WRK-07) | 부분 — 관리자 계정 수동 SQL은 막지 못한다 |
| 변환식 덮어쓰기 | 수동 SQL | 업무 데이터 · 시계열 의미 | master.scale_change_forbidden/409 · 가드 트리거([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)) | 닫힘 |
| 레이트 리밋 거절이 측정에 섞임 | 학습자 실수 | 측정 무결성 | 관계식 R2 · R4 · aut_ratelimit_rejected_total 증가 0 유효 조건([03_api_surface_defense.md](./03_api_surface_defense.md)) | 부분 — 계정 공유 |
| 게이트 방치로 측정 외 행 적재 | 학습자 실수 | 측정 무결성 | 게이트 기본 false · 기동 경고 로그([../07_api/09_datagen.md](../07_api/09_datagen.md)) | 부분 |
| 비밀 · 스택이 응답에 실림 | 누구든 | 자격 증명 | 에러 봉투 규약 · REQ-OBS-10 | 닫힘 |
| 무인증 WebSocket 소켓 누적 | 프로세스 | 가용성 | 인증 대기 시간 4401 · 느린 소비자 4413 | 부분 — 연결 수 상한 없음 |
| LAN에서 저장소 접속 | LAN 기기 | 자격 증명 · 전부 | 127.0.0.1 바인드(ADR-18 · REQ-TEC-02) | 닫힘 |
| 같은 머신 프로세스의 저장소 접속 | 프로세스 | 전부 | 저장소 비밀번호([02_secrets_config.md](./02_secrets_config.md) · Redis requirepass) · DB 역할 권한 | 부분 — .env를 읽을 수 있는 같은 OS 사용자는 막지 못한다 |
| 다른 로컬 웹 앱의 BFF 인증 경로 호출 | 다른 로컬 웹 앱 | 리프레시 토큰 | BFF 인증 Route Handler Origin 대조(REQ-AUT-13 ②) | 닫힘 |
| 무인증 기간 WebSocket 수신 | 다른 사이트 페이지 | 시계열(실시간) | Origin 검증 S2부터 · 종료 코드 4403(REQ-AUT-13 ① · REQ-RLT-09) | 닫힘 |
| DNS 재바인딩 | 다른 사이트 페이지 | api 응답 · 측정 무결성 | Host 헤더 허용 목록 · S2부터(REQ-AUT-13 ③) | 부분 — api 밖 HTTP 포트(9090 · 9363)는 Host를 보지 않는다 |
| 웹 개발 서버의 LAN 노출 | LAN 기기 | BFF 경유 api | 기동 명령의 호스트 이름 127.0.0.1([../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)) | 부분 — 인자를 빼고 띄우면 막지 못한다 |

- 검산: 위협 = **26** · 닫힘 14 · 부분 12 · 열림 0 — W7에 통제가 생긴 5건 중 넷은 행으로 옮기고 하나(SQL 조립 주입)는 기존 행의 판정을 부분 → 닫힘으로 바꿨다(§통제가 생긴 위협)
- **닫힘 14 중 6행이 에러 코드의 발생 조건을 통제로 인용한다**(unauthenticated · invalid_credentials · forbidden · postgres_unavailable · stream_full · bulk_disabled · scale_change_forbidden). 코드의 조건 문장이 바뀌면 이 표의 판정이 함께 흔들린다 — 코드 정본은 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)다.

## 무인증 기간

S2~S6은 인증이 없다(D-07 · REQ-AUT-16). 이것은 결함이 아니라 학습 순서의 결과이며, 이 기간의 노출을 기록해 두는 것이 이 절의 목적이다.

| 표면 | S2~S6에 막는 것 | S2~S6에 못 막는 것 | S7에서 닫히는가 |
|------|------|------|------|
| 직결 REST(조회 · 최신값) | CORS — 다른 오리진 페이지가 응답을 읽지 못한다 · Host 대조 — 재바인딩 페이지도 읽지 못한다 · 스키마 검증 · 범위 강제 | 같은 머신 프로세스의 전량 조회 · 다른 오리진 페이지의 단순 GET 부수효과(캐시 채움 · 스캔 비용) | 닫힌다 — Bearer 없는 요청은 401 |
| BFF 경유 쓰기(마스터 · 작업지시) | 스키마 검증 · 감사 행(user_id NULL = 무인증 기간) | 같은 머신 프로세스의 쓰기 | 닫힌다 |
| /ws/realtime | Origin 검증(S2부터 · 4403) · Host 대조 | 같은 머신 프로세스의 수신 — Origin을 위조한다 | 닫힌다 — 첫 메시지 인증 |
| 09_datagen #1(게이트 on) | 본문 검증 · 적체 검사 | 같은 머신 프로세스의 SIMULATED 행 적재 | 닫힌다 — 인증 + bulk_ingest 등급 |

- 검산: 표면 묶음 = **4**
- **무인증 기간의 감사 행은 user_id NULL이다**([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) 판정). 이 기간의 변경은 행위자를 모른다는 사실이 그대로 기록된다 — 시드 계정으로 채우면 거짓 귀속이 된다.
- S7 전후 수치는 같은 조건이 아니다(REQ-AUT-16) — 이 절의 노출 차이가 측정 조건 차이이기도 하다.

## 공개 표면

인계 "공개 표면의 잔여"([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) · [../07_api/10_metrics.md](../07_api/10_metrics.md))를 등재한다. 공개 판정의 근거는 도달 가능성이 아니라 **호출 주체가 기계이고 응답에 업무 데이터가 없다**는 것이다(REQ-OBS-10).

| 표면 | 누가 읽는가 | 읽히는 것 | 읽히지 않는 것 | 잔여 판정 |
|------|------|------|------|------|
| /api/v1/health | 같은 머신 프로세스 · 브라우저(CORS 밖이면 응답 불가) | 저장소별 상태 · 스위치 상태 · 커밋 해시 · 메모리 프로파일 · 용량 티어 | 업무 데이터 · 비밀 | 받아들인다 — 실험 조건은 공유 대상이다 |
| /metrics | 상동 · Prometheus | 스위치 상태 · 스트림 길이 · 느린 쿼리 **문형** · 거절 계수 · 지연 분포 | 쿼리 값(파라미터 바인딩) · 업무 데이터 · 비밀 | 받아들인다 — 단 **파라미터 바인딩 위반 코드 하나가 공개 표면에 요청 값을 싣는다** |

- 검산: 공개 표면 = **2**
- **공개 판정은 조건부다(B형).** 결론 — 두 표면은 무인증으로 둔다. 반대 시나리오 — 응답에 업무 값(작업지시 번호 · 태그 값)이 하나라도 실리면 공개 근거가 사라지는데, 그 순간을 알려 주는 장치가 없다. 파생 지침 — health · metrics 응답 필드를 추가하는 변경은 REQ-OBS-10 검증(비밀 · 업무 값 문자열 검출 0)을 같은 변경 단위에서 다시 돈다.
- 스크레이프 전용 정적 토큰을 두지 않은 판정은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md)가 갖는다 — 막는 대상이 같은 머신 프로세스뿐이라 비밀 하나를 늘릴 가치가 없다.

## 잔여 위험 등재

**어느 계층도 강제하지 않는 것**이다. 형식은 한계 등재([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md))를 따른다. 각 행의 근거는 구체적 실패로 끝난다.

| 항목 | 강제 주체 | 막는 것과 못 막는 것 | 잔여가 어디에 담기는가 |
|------|------|------|------|
| 같은 OS 사용자 프로세스의 .env 읽기 | 없음 — 파일 권한은 OS 몫 | 다른 OS 사용자는 파일 권한이 막는다 · 같은 사용자의 악성 패키지는 .env를 읽는 순간 저장소 전권 · 서명 키를 갖는다 | 이 표 · [02_secrets_config.md](./02_secrets_config.md) |
| 로그인 대입 | Argon2id 비용 | 대입 속도를 시도당 해시 시간으로 묶는다 · 대입 자체는 막지 않는다 — 약한 학습자 비밀번호는 시간 문제다 · 흔적은 http_requests_total 로그인 401 계수로만 보인다 | [03_api_surface_defense.md](./03_api_surface_defense.md) §로그인 시도 제한 판정 |
| 리프레시 쿠키 사본 | 로그아웃 DEL · 수명 | 로그아웃한 사본은 막는다 · 로그아웃하지 않은 사본은 수명 동안 유효하다 | [01_authn_authz.md](./01_authn_authz.md) §회전 판정 |
| Redis 불가 중 로그아웃 | BFF 쿠키 삭제 | 브라우저 경로는 막는다 · 사본은 Redis 복구 뒤 다시 갱신한다 | [01_authn_authz.md](./01_authn_authz.md) §인증 · 인가 잔여 |
| 로그아웃 뒤 액세스 토큰 | 없음 — 무상태 | 수명 동안 유효하다 · 상한은 액세스 수명 | 상동 |
| 레이트 리밋 통과 · 느슨해짐 | 계수만(aut_ratelimit_bypassed_total) | Redis 불가 중에는 한도가 없다 · 메모리 압박 중에는 rl 키 축출로 0부터 다시 센다 — 부하 실험의 "레이트 리밋이 동작했다"가 메모리 상태에 따라 달라진다 | [03_api_surface_defense.md](./03_api_surface_defense.md) §계수 기전 리뷰 · [../05_data_stores/06_redis_memory.md](../05_data_stores/06_redis_memory.md) |
| 고정 창 2배 통과 | 없음 — 창 성질 | 분 평균은 묶는다 · 창 경계 양쪽 60초 안의 2배는 통과한다 | [03_api_surface_defense.md](./03_api_surface_defense.md) |
| 계정 공유로 인한 측정 간섭 | 유효 조건 계수 | 거절 증가를 기록 무효로 판정한다 · 거절이 생기는 것 자체는 막지 않는다 — 측정 중 대시보드를 열면 k6의 한도를 나눠 쓴다 | 상동 · [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 관리자 계정의 수동 SQL | 없음 | 앱 경로는 권한 · 트리거가 막는다 · 관리자 계정은 감사 행 · 트리거를 끈다 — 감사가 기록하지 않은 변경이 생긴다 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 |
| 수동 역할 변경 | 권한 사본 TTL | TTL 뒤 반영된다 · 그 전에는 옛 권한이 산다 | [01_authn_authz.md](./01_authn_authz.md) §인증 · 인가 잔여 |
| 래퍼 우회 Redis 조작 | 없음 — 래퍼는 앱 안의 강제 | 앱 코드의 TTL 위반은 막는다 · redis-cli의 FLUSH · PERSIST는 막지 않는다 — 봉인 계열이 사라지면 적재 버퍼가 사라진다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) 봉인 표 · REQ-GLB-08 |
| 게이트 방치 | 기본 false · 기동 경고 로그 | 새 기동의 기본값은 막는다 · 켜 둔 채 계속 도는 api는 health에서 보이지 않는다 | [02_secrets_config.md](./02_secrets_config.md) §부하 주입 표면 게이트 |
| 무인증 설비 ID 주입 | 원시 보존 | 보존이 지나면 사라진다 · 그 전에는 조회에서 메타 없는 설비로 나온다 | 상동 |
| 무인증 WebSocket 소켓 수 | 인증 대기 시간 | 대기 시간 뒤 닫는다 · 대기 시간 안의 소켓 수는 세지 않는다 | [03_api_surface_defense.md](./03_api_surface_defense.md) §종료 코드 8종 리뷰 |
| api 밖 HTTP 포트의 재바인딩 | 없음 — Host를 보는 것은 api뿐 | api는 Host 대조가 막는다 · Prometheus 9090 · ClickHouse 메트릭 9363은 재바인딩 페이지가 읽는다 — 집계 수치뿐이다 | §통제가 생긴 위협 |
| 웹 개발 서버 기동 인자 누락 | 기동 명령 규약 | 규약대로 띄우면 막는다 · 인자를 빼고 띄우면 3001이 LAN에 열려 BFF가 api 중계가 된다 — Compose처럼 파일이 강제하지 않는다 | [05_local_exposure.md](./05_local_exposure.md) §노출 검증 절차 ② |
| 공개 표면의 조건부 판정 | REQ-OBS-10 검증 | 검증을 돌리면 드러난다 · 필드 추가가 검증 없이 들어오면 업무 값이 공개된다 | §공개 표면 |

- 검산: 잔여 = **17**
- 이 표의 행을 지우는 변경은 강제 주체 열에 기존 REQ · 코드 · 설정을 적을 수 있을 때만 한다 — 문장이 좋아졌다는 이유로 지우지 않는다.

## 통제가 생긴 위협 — W7 반영 이력

W7 리뷰 당시 기존 REQ · 코드 · 설정 어디에도 통제가 없던 위협이다. 리드 배정으로 같은 웨이브에서 정본 문서에 반영했고, 각 행은 §위협 × 통제로 옮겼다. **현행 통제 없는 위협은 0건이다.** 새로 발견되는 위협은 이 표에 "반영 대기"로 먼저 등재한다.

| 위협 | 구체적 실패 | 반영된 통제 | 반영 자리 |
|------|------|------|------|
| 다른 로컬 웹 앱의 BFF 인증 경로 호출 | same-site라 리프레시 쿠키가 실려 학습자가 임의로 로그아웃된다 | BFF 인증 Route Handler의 Origin 대조 | REQ-AUT-13 ② · [../07_api/03_auth.md](../07_api/03_auth.md) |
| 무인증 기간 WebSocket 수신 | 다른 오리진 페이지가 S2~S6 실시간 프레임을 받는다 | Origin 검증 S2부터 · 4403 | REQ-AUT-13 ① · [../07_api/11_websocket.md](../07_api/11_websocket.md) |
| DNS 재바인딩 | 외부 도메인을 127.0.0.1로 다시 풀게 한 페이지는 브라우저가 같은 오리진으로 본다 — 무인증 기간 api 응답을 **읽는다** | api Host 헤더 허용 목록(localhost · 127.0.0.1 · 서비스명 api) · S2부터 | REQ-AUT-13 ③ · [../07_api/01_conventions.md](../07_api/01_conventions.md) |
| 웹 개발 서버의 LAN 노출 | 웹은 호스트 프로세스라 Compose 바인드 규칙 밖이다 — 개발 서버가 모든 인터페이스에 뜨면 LAN 기기가 BFF를 거쳐 api에 닿는다 | 개발 서버 기동 명령에 호스트 이름 127.0.0.1 명시 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §기동 · 정지 명령 · [05_local_exposure.md](./05_local_exposure.md) |
| 파라미터 바인딩의 요구사항 부재 | 계약이 원본 한 줄과 이 폴더뿐이라 검증 방법이 없었다 — 위반이 공개 표면(/metrics 문형)으로 나가도 잡을 자리가 없다 | REQ 신설 — 바인딩 · 대응표 · 검증 방법 | **REQ-GLB-24** · [../03_requirements/01_global_rules.md](../03_requirements/01_global_rules.md) |

- 검산: 반영된 위협 = **5** · 현행 통제 없는 위협 = **0**
- **DNS 재바인딩은 Host 대조 뒤에도 api 밖에서 일부 남는다.** Host를 보는 것은 api뿐이다 — Prometheus 9090 · ClickHouse 메트릭 9363은 인증도 Host 대조도 없어 재바인딩 페이지가 읽는다. 읽히는 것은 §공개 표면과 같은 집계 수치라 피해는 작다 — §잔여 위험 등재에 둔다.

## 원본 대조

| 원본 자리 | 사실 | 이 문서의 자리 |
|------|------|------|
| architecture §2 사용자 문단 | 사용자 셋은 모두 브라우저로 localhost:3001에 접속 · 원격 접속자 · 외부 망 없음 | §범위와 전제 실행 위치 · §행위자 |
| architecture §18 도입 문단 | 네트워크 경계 방어는 범위 밖 · 외부 도달 불가가 인가 · 입력 검증 생략의 이유가 되지 않는다 | 도입 단락 · §신뢰 경계 |
| architecture §18 감사 행 | 업무 데이터 변경은 감사 로그에 before · after | §위협 × 통제 감사 행 · §잔여 위험 등재 관리자 수동 SQL 행 |

- 검산: 원본 행 = **3** · 누락 0 — 나머지 §18 행은 [01_authn_authz.md](./01_authn_authz.md) · [02_secrets_config.md](./02_secrets_config.md) · [03_api_surface_defense.md](./03_api_surface_defense.md)의 원본 대조가 받는다

## 관련 문서

- [README.md](./README.md) — 폴더 고정 기준 · 채번 없음
- [01_authn_authz.md](./01_authn_authz.md) — 인증 · 인가 잔여의 원자리
- [02_secrets_config.md](./02_secrets_config.md) — 비밀 목록 · 새는 자리
- [03_api_surface_defense.md](./03_api_surface_defense.md) — 표면 방어 · 레이트 리밋 등급
- [05_local_exposure.md](./05_local_exposure.md) — 바깥 경계
- [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) — 한계 등재 형식 · DB 쪽 한계
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 공개 표면 판정
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 통제로 쓰인 에러 코드 정본
