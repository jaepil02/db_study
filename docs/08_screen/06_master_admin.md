# 관리 화면군 (06_master_admin)

> **대상**: AUTH-LOGIN(로그인) · ADM-MASTER(사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 — 스케일 변경 = 새 태그 발급 · master.scale_change_forbidden/409) · ADM-WORKORDER(작업지시 status 4 · 허용 전이 4쌍 · work_orders.invalid_status_transition/409 · 생산 실적) · ADM-AUDIT(감사 로그 · 태그 변경 이력 조회)
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — 최종 정밀 검수 — Modbus 매핑 변경 행 닫힘(07_api/04 W5 판정) · 새 태그 발급 다이얼로그 펜스 앞 도입문 추가
> **원천**: 원본 architecture.md §6 · §11 · §11.2 · §12(커밋 ff66a37) · 원본 data_flow.md §7 · §7.1 · §7.2(커밋 ff66a37) · 원본 implementation_plan.md §5 S4 · S7 · §7.4(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #13 · REQ-AUT-01~06 · 14 · 15 · 17 · REQ-MST-01~15 · REQ-WRK-01~12 · AC-06 · AC-37 · AC-38 · 기능 AUT-01 · 03 · MST-01~06 · WRK-01 · 02 · 03 · 05 · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · [../07_api/03_auth.md](../07_api/03_auth.md) · [../07_api/04_master.md](../07_api/04_master.md) · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 4 · [01_standards.md](./01_standards.md)

이 문서는 로그인과 업무 데이터 관리 화면 넷을 담는다(보정 #13 — 08_screen에 로그인 · 작업지시 자리가 따로 없어 이 파일이 함께 소유한다). 네 화면의 공통점은 **분기 ③계층의 화면**이라는 것이다 — 쓰기는 Redis Stream을 타지 않고 PostgreSQL 트랜잭션으로 동기 커밋된 뒤 응답하며(REQ-WRK-01), 캐시 사본은 커밋 뒤에만 지워진다. 그래서 이 화면들의 계약은 속도가 아니라 **쓴 사람이 저장 직후 새 값을 보는가**(read-your-writes)다.

**관리자 한 번의 저장이 다른 화면의 태그명까지 바꾼다.** 태그 쓰기는 무효화 체인 6단(커밋 → Redis 삭제 → ch:cacheinv → Dictionary 재적재 → BFF 무효화 → 브라우저 무효화)을 건다([../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)). 이 문서의 화면은 체인의 출발점이고, 체인의 끝(⑥)은 [01_standards.md](./01_standards.md) §무효화 신호 수신이 받는다.

## AUTH-LOGIN — 로그인

| 항목 | 내용 |
|------|------|
| 화면 코드 | AUTH-LOGIN |
| 웹 경로 | /login?next={내부 경로} |
| 페르소나 | 전원 |
| 역할 | 공개 — 인증 없이 연다 |
| 도입 단계 | S7 — S2~S6에는 이 화면이 없고 /login은 /realtime으로 보낸다 |
| 요청 경로 | BFF 경유만 — 브라우저가 로그인 표면을 직결로 부르지 않는다 |

**목적**: 역할이 붙은 신원을 얻는다 — 리프레시 토큰은 httpOnly 쿠키로 BFF만 쥐고, 브라우저는 액세스 토큰과 user.roles만 받는다.

**진입**: 공통 셸이 auth.unauthenticated/401 · auth.refresh_invalid/401을 받으면 원래 경로를 next에 담아 보낸다. next는 **내부 경로만** 받는다 — 외부 주소를 받으면 로그인 뒤 임의 사이트로 보내는 열린 리다이렉트가 된다.

```plain
┌──────────── db_study ────────────┐
│ 이메일    [                    ] │
│ 비밀번호  [                    ] │
│           [ 로그인 ]             │
│ (오류 문구 자리)                  │
└──────────────────────────────────┘
```

- **회원가입 · 비밀번호 찾기 링크가 없다.** 계정과 역할은 시드로만 만들고 계정 생성 표면을 두지 않는다(REQ-AUT-17) — 링크를 두면 존재하지 않는 표면을 가리킨다.
- **로그인 화면은 역할을 고르지 않는다.** 학습자 계정 하나에 세 역할을 모두 부여하는 시드라 합집합으로 판정된다([../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) §역할 정의).

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 이메일 · 비밀번호 입력 · 로그인 | 폼 | 제출 중 버튼 비활성 · 성공하면 next로 이동 | AUT-01 | POST /api/v1/auth/login(BFF 경유 — BFF가 refreshToken을 쿠키로 심고 본문에서 뺀다) |
| 앱 기동 시 조용한 갱신 | 보이지 않음 | 새로고침으로 메모리의 액세스 토큰이 사라지면 BFF가 쿠키로 새 토큰을 받는다 · 실패하면 이 화면 | AUT-02 | POST /api/v1/auth/refresh(BFF) |
| 로그아웃 | 공통 셸 사용자 메뉴 | 누르면 BFF가 쿠키를 지우고 이 화면으로 | AUT-03 | POST /api/v1/auth/logout(BFF) |

- 검산: 요소 = **3** · 표면 = **3**
- **액세스 토큰은 브라우저 메모리에만 둔다**([../07_api/01_conventions.md](../07_api/01_conventions.md) §인증 헤더와 출처 방어). localStorage에 두면 XSS 한 번에 토큰이 새고, 메모리에만 두면 새로고침마다 사라지므로 기동 시 조용한 갱신이 그 공백을 메운다.
- **로그아웃 뒤에도 액세스 토큰은 수명 만료까지 유효하다** — 폐기는 리프레시 쪽만 한다(REQ-AUT-06). 화면은 로그아웃과 함께 메모리의 토큰을 버린다.

| 상태 | 처리 |
|------|------|
| 로딩 | 폼을 즉시 그린다 · 제출 중 버튼만 진행 표시 |
| 빈 값 | 해당 없음 — 조회가 없는 화면이다 |
| 오류 | auth.invalid_credentials/401(비활성 · 없는 계정도 같은 문구) · auth.token_store_unavailable/503 · common.postgres_unavailable/503 · common.validation_failed/400 — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시. **503에서 비밀번호 칸을 비우지 않는다** — 원인이 비밀번호가 아니다 |
| 정상 | 성공 즉시 next로 이동 · 공통 셸 사용자 메뉴에 이메일과 역할(user.roles) |

- **B형 — 비활성 계정에도 "이메일 또는 비밀번호가 맞지 않다"만 보이는 것은 의도다.** 결론 — 서버가 같은 코드 · 같은 본문을 낸다. 반대 시나리오 — 화면이 "비활성 계정"을 따로 말하면 이메일을 바꿔 가며 어떤 계정이 있는지 셀 수 있다(REQ-AUT-02). 파생 지침 — 화면은 응답에 없는 구분을 만들지 않는다.
- 로그인 표면은 사용자 기준 레이트 리밋 밖이라(user_id가 없다) 이 화면에는 429가 오지 않는다([../07_api/01_conventions.md](../07_api/01_conventions.md) §레이트 리밋 헤더).

## ADM-MASTER — 마스터 관리

| 항목 | 내용 |
|------|------|
| 화면 코드 | ADM-MASTER |
| 웹 경로 | /admin/master · /admin/master/devices/{device_id} · /admin/master/tags/{tag_id} |
| 페르소나 | 관리자(주) · 엔지니어 · 운영자(열람) |
| 역할 | 조회는 인증 사용자 전원 · **쓰기는 ADMIN만**(REQ-MST-15) |
| 도입 단계 | S2 시드 조회 · **S4 쓰기와 무효화 체인** · S7 인가 |
| 요청 경로 | 전 표면 BFF 경유 — 조회는 BFF 서버 fetch 캐시 · 쓰기 성공 시 BFF 무효화(⑤) · 접속 설정 조회는 no-store |

**목적**: 새 설비와 태그를 등록했는가 — 수집 대상(설비 · 접속 설정 · 태그 매핑)과 해석 메타(태그명 · 단위 · 변환식)를 정확히 유지한다.

**진입**: 공통 셸 메뉴 · DSH-REALTIME 빈 설비 안내 · 태그 딥링크.

```plain
┌─ 트리 ─────────────────┬─ 상세 [설비 정보] [접속 설정] [태그] ─────────────────────┐
│ ▾ 사이트 A              │ 태그 목록  [비활성 포함 □]                     [+ 태그]   │
│   ▾ 라인 1              │ 코드        이름    단위  변환식(scale · offset) 상태      │
│     ● 설비12 SIMULATED  │ D12-TEMP-01 온도-1  ℃    1 · 0                활성  [편집] │
│     ○ 설비13(비활성)     │ D12-PRS-02  압력-2  MPa   0.01 · 0            활성  [편집] │
│   ▸ 라인 2              │ D12-OLD-03  유량-3  L/min 0.1 · 0             비활성      │
│ [+ 사이트][+ 라인][+ 설비]│ 편집 폼 — 변환식은 읽기 전용 · [새 태그 발급] [비활성화]     │
└─────────────────────────┴─────────────────────────────────────────────────────────┘
```

- **변환식(scale · offset)은 편집 폼에서 읽기 전용이다.** 바꾸는 길은 "새 태그 발급" 하나다 — 기존 행의 scale을 고치면 과거 값의 공학 단위 의미가 조용히 바뀐다(REQ-MST-07).
- **SIMULATED 표지는 접속 설정의 host가 컨테이너 루프백인 설비다**(REQ-MST-03). 그 설비의 정상 값은 품질 9로 적재된다 — 표지 없이 host를 바꾸면 실데이터와 생성 데이터가 섞여도 화면이 말하지 않는다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 사이트 · 라인 · 설비 트리 | 좌측 | 계층 목록 · 비활성 설비는 흐리게 · 선택하면 상세 | MST-01 · MST-02(조회) | GET /api/v1/sites · GET /api/v1/lines · GET /api/v1/devices(siteId 필수 · includeInactive) |
| 사이트 등록 · 수정 | 트리 머리 · 상세 | 코드 · 이름 · 시간대 입력칸 없음(Asia/Seoul 고정) | MST-01(쓰기) | POST /api/v1/sites · PATCH /api/v1/sites/{id} |
| 라인 등록 · 수정 | 트리 머리 · 상세 | 사이트 안 코드 · 이름 | MST-01(쓰기) | POST /api/v1/lines · PATCH /api/v1/lines/{id} |
| 설비 등록 | 트리 머리 | 설비 필드 + **접속 설정 6필드를 같은 폼에서** 받는다 | MST-02 · MST-03(쓰기) | POST /api/v1/devices |
| 설비 수정 · 비활성화 · 재활성화 | 설비 정보 탭 | 이름 · 제조사 · 모델 · 사용 여부 | MST-02(쓰기) | PATCH /api/v1/devices/{id} |
| 접속 설정 조회 · 교체 | 접속 설정 탭 | host · port · unitId · timeoutMs · retryCount · maxRegsPerRequest 전부 필수 · 교체 저장 | MST-03 | GET · PUT /api/v1/devices/{id}/modbus-config |
| 태그 목록 | 태그 탭 | 설비 하나의 태그 · 비활성 포함 토글 | MST-04 · MST-05(조회) | GET /api/v1/tags(deviceId 필수 · includeInactive) |
| 태그 등록 · 편집 | 태그 탭 편집 폼 | §태그 편집 필드의 수정 가능 필드만 편집 | MST-04(쓰기) | POST /api/v1/tags · PATCH /api/v1/tags/{id} |
| 태그 비활성화 | 편집 폼 | 확인 다이얼로그 — 되돌리는 버튼이 없음을 알린다 | MST-05 | POST /api/v1/tags/{id}/deactivate |
| 새 태그 발급 | 편집 폼 | §새 태그 발급 다이얼로그 · **활성 태그에만 보인다** | MST-06 | POST /api/v1/tags/{id}/reissue |
| 태그 단건 | 태그 딥링크 | 비활성이어도 200 · 과거 해석용 메타 | MST-04(조회) | GET /api/v1/tags/{id} |

- 검산: 요소 = **11** · 이 화면이 호출하는 기능 = MST 6(01~06)
- **태그 재활성화 버튼이 없다.** 스케일로 대체된 태그가 되살아나면 같은 레지스터를 두 변환식으로 폴링한다 — 되살릴 태그는 새 코드로 등록한다([../07_api/04_master.md](../07_api/04_master.md) §원본에 없는 표면 판정). 설비는 사용 여부만 바꾸므로 재활성화를 허용한다.
- **삭제 버튼이 어디에도 없다.** 설비 · 태그를 물리 삭제하면 ClickHouse 과거 행이 고아 식별자를 갖는다(REQ-MST-02 · 06).

### 태그 편집 필드

PATCH /api/v1/tags/{id}가 받는 필드의 세 갈래(정본 [../07_api/04_master.md](../07_api/04_master.md))를 폼 동작으로 옮긴다.

| 갈래 | 필드 | 폼 동작 | 서버에 보내면 |
|------|------|------|------|
| 수정 가능 | tagCode · tagName · unit · deadband · scanRateMs · rangeMin · rangeMax · functionCode · address · dataType · wordOrder | 편집 가능 · unit만 바꾸는 표기 정정도 허용 | 200 · 감사 before · after |
| 스케일 | scale · offsetValue | **읽기 전용** · 옆에 "새 태그 발급" 링크 | 현재와 다르면 409 master.scale_change_forbidden |
| 불변 | tagId · deviceId · isActive | 표시만 · 사용 여부는 비활성화 버튼으로만 | 400 common.validation_failed |

- 검산: 필드 = 수정 가능 11 + 스케일 2 + 불변 3 = **16**
- **A형 — "스케일만 고치려는데 저장이 409"는 결함이 아니다.** 통념은 편집 폼이 모든 필드를 고친다는 것이다. 부정 — 변환식이 바뀌면 다른 태그다. 진짜 축은 과거 행의 공학 단위 의미다. 대체 경로 — 409를 받으면 화면은 편집 내용을 버리지 않고 새 태그 발급 다이얼로그를 같은 값으로 연다. 폼이 변환식을 읽기 전용으로 두므로 이 409는 딥링크 · 수동 호출에서만 온다.
- **Modbus 매핑 4필드(functionCode · address · dataType · wordOrder) 변경은 현재 허용된다** — 다른 레지스터를 읽게 되면 같은 tag_id의 값 원천이 바뀌는데 새 태그 발급 대상인지 판정이 없다(07_api/04_master 신규 미확인). 판정 전까지 화면은 저장 전 "이 변경은 같은 tag_id의 값 원천을 바꾼다" 경고를 띄운다.

### 새 태그 발급 다이얼로그

변환식 변경을 새 tag_id 발급으로 받는 다이얼로그의 입력과 검증 자리다.

```plain
새 태그 발급 — D12-TEMP-01(온도-1 · ℃ · scale 1 · offset 0)
├─ 새 태그 코드 [D12-TEMP-01-F]        ← 필수 · 이전 코드는 비활성 뒤에도 점유된다
├─ scale [1.8]  offset [32]            ← 적어도 하나가 현재와 달라야 한다
├─ 단위 [°F]  사유 [표시 단위를 화씨로 전환]
├─ 안내  이전 태그는 비활성화된다 · 과거 행은 이전 tag_id로 남는다
├─ 안내  알람 규칙은 옮겨지지 않는다 — 새 태그에 규칙을 새로 만든다 [ALM-RULES]
└─ [발급]  →  201 newTag · oldTagId · historyId  →  새 태그 편집 화면으로 이동
```

- **규칙 이관 안내가 다이얼로그 안에 있는 이유** — 임계값은 공학 단위 값이라 옮겨 붙이면 섭씨 80이 화씨 80으로 조용히 바뀐다. 안내가 없으면 관리자는 알람이 계속 판정된다고 믿는다 — 실제로는 이전 태그의 규칙이 판정에서 빠진다.
- **트렌드는 두 tag_id로 갈라진다.** 발급 시각 이전은 이전 tag_id, 이후는 새 tag_id다 — 화면은 발급 성공 뒤 "이전 태그의 과거 추이 보기(ANL-TREND)" 링크를 준다. 이어 붙인 선이 필요하면 태그 변경 이력(ADM-AUDIT)이 두 식별자를 잇는다.
- **비활성 태그에는 발급 버튼을 숨긴다.** 이미 대체된 태그에서 한 번 더 발급하면 한 이전 태그에서 활성 태그가 둘 생긴다 — 서버도 master.reissue_source_inactive/409로 거절한다(경합으로 방금 비활성이 된 경우). 화면은 태그를 다시 읽어 계보의 최신 태그로 안내한다.

### 상태 4행

| 상태 | 처리 |
|------|------|
| 로딩 | 트리 골격과 상세 탭 머리를 먼저 그린다 · 탭 전환은 그 탭만 스켈레톤 |
| 빈 값 | ① 사이트 0 — "등록된 사이트가 없다"와 사이트 등록(ADMIN) ② 설비의 태그 0 — "태그가 없다 · 수집 대상이 없다" ③ 비활성 포함을 꺼서 0 — "비활성 태그만 있다"와 토글 안내 |
| 오류 | common.validation_failed/400 · common.duplicate_key/409(코드 필드 옆) · master.scale_change_forbidden/409 · master.reissue_source_inactive/409 · common.not_found/404 · common.postgres_unavailable/503 · auth.forbidden/403 — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시. **503 중에는 폼 입력을 유지한다** — 커밋되지 않았으므로 재시도해도 이중 쓰기가 아니다 |
| 정상 | 저장 성공 즉시 쓴 탭의 해당 쿼리를 로컬 무효화하고 재조회한다 · 태그 쓰기 성공 뒤 "다른 화면 반영 — 트렌드 태그명은 Dictionary 재적재 뒤 · 캐시된 조회 결과는 TTL까지 옛 이름" 한 줄 안내 |

### 쓰기 뒤 체인과 화면

| 쓰기 | 쓴 탭 | 다른 탭 · 다른 사용자(⑥) | 체인이 닿지 않는 층 |
|------|------|------|------|
| 태그 등록 · 수정 · 비활성화 · 발급 | 응답 즉시 master · tags · master · tag 로컬 무효화 | cache:tagmeta:{tag_id} 신호 → 태그 목록 · 최신값 메타 · 알람 규칙 목록 | 시계열 조회 결과(cache:q) — TTL까지 옛 이름 |
| 설비 등록 · 수정 · 사용 여부 | master · devices · {site_id} 로컬 무효화 | cache:devlist:{site_id} 신호 → 설비 선택기 | 해당 없음 |
| 접속 설정 교체 | 접속 설정 조회는 no-store라 재조회만 | ③만 나가고 ⑥ 대상 쿼리가 없다 — Collector가 신호로 다음 사이클에 다시 읽는다 | 해당 없음 |
| 사이트 · 라인 | master · sites · master · lines 로컬 무효화 | 신호 없음 — Redis 사본이 없어 ③에 실을 키가 없다 · staleTime만큼 옛 목록 | 해당 없음 |

- 검산: 쓰기 = **4**
- **④ Dictionary 재적재는 응답 뒤에 돈다**(07_business_crud 판정). 저장 응답을 받은 직후 트렌드 화면을 열면 수백 ms 동안 옛 이름이 보일 수 있다 — 화면은 이를 오류로 표시하지 않는다.
- **B형 — 캐시 삭제가 실패해도 저장은 성공으로 끝난다.** 결론 — 커밋은 이미 끝났고 진실은 PostgreSQL이다(REQ-MST-10). 반대 시나리오 — 실패로 표시하면 관리자가 재시도해 tag_code 중복 409를 맞는다. 파생 지침 — 화면은 성공만 보이고 옛 사본은 TTL이 끊는다.

## ADM-WORKORDER — 작업지시 · 생산 실적

| 항목 | 내용 |
|------|------|
| 화면 코드 | ADM-WORKORDER |
| 웹 경로 | /admin/work-orders · /admin/work-orders/{id} |
| 페르소나 | 관리자(주) · 운영자 · 엔지니어(열람) |
| 역할 | 조회는 역할 1개 이상인 인증 사용자 전원 · **등록 · 수정 · 상태 전이 · 실적 기록은 ADMIN만**(REQ-WRK-11) |
| 도입 단계 | S7 — 시연 최소분(등록 · 상태 변경 · 실적 기록 · 감사 기록 · 감사 조회)이 끝까지 동작해야 한다(REQ-WRK-12) |
| 요청 경로 | 전 표면 BFF 경유 **no-store** |

**목적**: 작업지시 상태가 맞는가 — 허용된 전이만 누르게 하고, 실적을 사람이 입력한다.

**진입**: 공통 셸 메뉴 · 목록 필터(라인 · 상태 · 기간)의 쿼리 문자열.

```plain
┌─ 필터 [라인 ▾] [상태 ▾] [계획 기간 ▾]                               [+ 작업지시] ┐
├─ 목록 ─────────────────────────────────────────────────────────────────────┤
│ 지시번호     라인   품목    계획 수량  상태          다음 전이                │
│ WO-0924-01  라인1  부품A   500       PLANNED       [착수] [취소]            │
│ WO-0923-07  라인1  부품B   300       IN_PROGRESS   [완료] [중단]            │
│ WO-0920-02  라인2  부품A   200       COMPLETED     —                        │
│                                                     [더 보기]               │
├─ 상세 · 실적 ──────────────────────────────────────────────────────────────┤
│ 실적 기록 [기록 시각] [양품 수] [불량 수] [기록]   실적 목록(시각 · 양품 · 불량)   │
└────────────────────────────────────────────────────────────────────────────┘
```

- **다음 전이 열은 현재 상태에서 나갈 수 있는 전이만 버튼으로 둔다.** 표 밖 전이 버튼은 비활성으로도 두지 않는다 — 누를 수 없는 버튼이 "권한이 없어 못 누른다"로 읽힌다.
- **실적은 사람이 입력하는 업무 데이터다**(REQ-WRK-05). 설비 카운터(스트림 유래)와 값이 달라도 결함이 아니며 화면은 두 값을 한 표로 합치지 않는다 — 합치면 ③ "Stream을 타지 않는다"가 화면에서 거짓이 된다.

### 상태 전이

전이 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 상태 머신 4다. status는 편집 폼으로 바꾸지 않는다(REQ-WRK-04).

| 현재 상태 | 버튼 | 목표 상태 | 확인 다이얼로그 |
|------|------|------|------|
| PLANNED | 착수 | IN_PROGRESS | 없음 |
| PLANNED | 취소 | CANCELLED | 있음 — "종결 상태는 되돌릴 수 없다 · 다시 하려면 새 작업지시" |
| IN_PROGRESS | 완료 | COMPLETED | 있음 — 상동 + "완료 뒤 실적 기록 불가" |
| IN_PROGRESS | 중단 | CANCELLED | 있음 — 상동 |
| COMPLETED · CANCELLED | 없음 | 해당 없음 — 종결 | 해당 없음 |

- 검산: 허용 전이 = 2 + 2 = **4** · 상태 = **4**
- **종결 상태에서 나가는 버튼이 없는 이유** — 되돌리면 production_log의 실적이 재개분인지 추가분인지 가를 수 없다. 잘못 종결한 지시는 새 작업지시로 등록한다.
- **409 invalid_status_transition은 경합의 결과다.** 목록을 읽은 뒤 다른 관리자가 먼저 전이하면 같은 이전 상태를 본 두 요청 중 하나만 성공한다(조건부 갱신 — REQ-WRK-04). 화면은 재시도하지 않고 현재 상태를 다시 읽어 그 상태의 버튼으로 바꾼다.
- **전이 요청은 화면이 본 상태를 싣는다** — POST /api/v1/work-orders/{id}/status 본문의 fromStatus는 목록 · 상세에서 본 상태, toStatus는 누른 버튼의 목표다. 같은 PLANNED를 본 착수 요청과 취소 요청이 둘 다 성공하는 경합을 fromStatus 조건이 막는다([../07_api/08_work_orders.md](../07_api/08_work_orders.md)). 409의 details.currentStatus로 버튼을 곧바로 바꾸고, 상세는 단건 조회로 다시 읽는다 — 목록 재조회는 캐시가 옛 상태를 줄 수 있다.

### 요소

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 필터 · 목록 · 더 보기 | 본문 | 라인 · 상태 · 기간 · 키셋 커서 · 전체 건수 표시 없음 | WRK-01(조회) | GET /api/v1/work-orders(BFF) |
| 상세 | 목록 행 선택 · 409 뒤 | 단건을 다시 읽는다 — 목록 캐시를 거치지 않는 새 상태 | WRK-01(조회) | GET /api/v1/work-orders/{id}(BFF) |
| 라인 선택 | 필터 · 등록 폼 | 라인 목록 | MST-01(조회) | GET /api/v1/lines |
| 작업지시 등록 · 수정 | 등록 폼 · 상세 | 지시번호(유일) · 라인 · 품목 · 계획 수량 · 계획 시작 · 종료 — status 입력칸 없음 | WRK-01(쓰기) | POST /api/v1/work-orders · PATCH /api/v1/work-orders/{id} |
| 상태 전이 버튼 | 목록 행 · 상세 | §상태 전이 표의 버튼만 · 본문 fromStatus · toStatus | WRK-02 | POST /api/v1/work-orders/{id}/status(BFF) |
| 실적 목록 | 상세 아래 | 기록 시각 · 양품 · 불량 · 키셋 커서 | WRK-03(조회) | GET /api/v1/work-orders/{id}/production-logs(BFF) |
| 실적 기록 | 상세 아래 | **IN_PROGRESS인 지시에만 폼이 보인다** · 기록 시각(KST 입력 → 오프셋 포함) · 양품 수 · 불량 수 · 제출 중 버튼 비활성 | WRK-03(쓰기) | POST /api/v1/work-orders/{id}/production-logs(BFF) |

- 검산: 요소 = **7** · 이 화면이 호출하는 기능 = WRK 3(01 · 02 · 03) + MST 1(01) = **4**
- **실적 이중 제출은 서버가 막지 못한다**([../07_api/01_conventions.md](../07_api/01_conventions.md) §멱등 — 수단 없음). 화면은 제출 중 버튼을 막고 성공하면 폼을 비워 같은 값 재제출을 줄인다 — 줄일 뿐 막지 못하는 잔여다.
- **실적은 IN_PROGRESS인 지시에만 기록한다**(07_api/08_work_orders 판정). 완료 전이가 실적 마감을 겸하므로 화면은 완료 다이얼로그에 "완료 뒤에는 실적을 기록할 수 없다"를 함께 적는다. 거절 코드는 work_orders.production_log_not_allowed/409다 — 폼을 IN_PROGRESS에만 보이므로 이 거절은 경합(다른 관리자가 먼저 완료 · 취소)에서만 오고, 화면은 단건을 다시 읽어 폼을 닫는다.

| 상태 | 처리 |
|------|------|
| 로딩 | 필터와 목록 머리를 먼저 그린다 · 전이 요청 중에는 그 행의 버튼만 진행 표시 |
| 빈 값 | ① 조건 결과 0 — "조건에 맞는 작업지시가 없다" ② 작업지시 0 — "등록된 작업지시가 없다"와 등록(ADMIN) ③ 실적 0 — "기록된 실적이 없다" |
| 오류 | common.validation_failed/400 · common.duplicate_key/409(지시번호) · work_orders.invalid_status_transition/409 · work_orders.production_log_not_allowed/409 · common.not_found/404 · common.postgres_unavailable/503 · auth.forbidden/403 — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시. PostgreSQL 불가 동안 **쓰기를 브라우저에 보관했다가 나중에 보내지 않는다**(REQ-WRK-06) — 폼 입력은 유지하되 자동 재전송은 없다 |
| 정상 | 쓴 탭은 응답 즉시 목록 · 상세를 다시 읽어 새 상태를 본다(no-store) · 다른 사용자 화면은 cache:workorders TTL(현행 참고 60초)만큼 늦을 수 있다 — 체인 ③ · ⑥을 걸지 않는 판정의 결과 |

- **A형 — "다른 관리자가 바꾼 상태가 내 목록에 1분 가까이 옛 상태로 보인다"는 결함이 아니다.** 통념은 무효화 체인이 모든 화면을 즉시 갱신한다는 것이다. 부정 — 작업지시는 ③ · ⑥을 걸지 않는다. 진짜 축은 read-your-writes가 **쓴 사람**의 보장이라는 것이다. 대체 경로 — 전이 전에 화면이 최신 상태를 모르면 서버 조건부 갱신이 409로 막고 화면이 다시 읽는다 — 잘못된 전이는 생기지 않는다.

## ADM-AUDIT — 감사 로그 조회

| 항목 | 내용 |
|------|------|
| 화면 코드 | ADM-AUDIT |
| 웹 경로 | /admin/audit(탭 — 감사 로그 · 태그 변경 이력) |
| 페르소나 | 관리자 |
| 역할 | **ADMIN만**(REQ-WRK-10) — before · after 원문에 다른 역할이 볼 이유가 없는 업무 값이 담긴다 |
| 도입 단계 | S7 — 마스터 쓰기의 감사 행은 S4부터 쌓인다 |
| 요청 경로 | BFF 경유 no-store |

**목적**: 누가 언제 무엇을 바꿨는가 — 변경 전후 원문과 태그 계보(이전 tag_id → 새 tag_id)를 본다.

```plain
┌─ [감사 로그] [태그 변경 이력]   기간 [2026-09-17 ~ 09-24 KST] (필수)  대상 [전체 ▾] ┐
│ 시각 KST            행위자                 동작    대상 테이블   대상 id  [비교] │
│ 2026-09-24 10:01    learner@localhost      UPDATE  tag_master    3401     ▸      │
│ 2026-09-20 14:22    무인증 기간(S4~S6)       INSERT  device        12       ▸      │
│   before { "tag_name": "온도1" }  →  after { "tag_name": "온도-1" }                │
│                                                           [더 보기]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **행위자가 비어 있는 행은 "알 수 없음"이 아니라 "무인증 기간(S4~S6)"이다.** audit_log.user_id NULL은 인증 도입 전 행위로 정의됐다([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §인계 판정) — 시드 계정으로 채우면 S7 이후의 같은 계정 행위와 구분할 수 없다.
- **기간은 늘 쿼리에 실린다.** 범위 없는 조회는 무기한 · 비분할 감사 테이블 전부를 훑는다(REQ-WRK-10) — from을 생략하면 서버가 7일을 채운다([../07_api/08_work_orders.md](../07_api/08_work_orders.md)). 한 태그의 계보를 7일 밖까지 보려면 화면이 from을 명시한다.

| 요소 | 위치 | 동작 | 기능 ID | 표면 |
|------|------|------|------|------|
| 기간 · 대상 필터 · 목록 · 더 보기 | 본문 | 시각 · 행위자 · 동작 · 대상 테이블 · 대상 키 · 키셋 커서 · 대상 필터는 테이블과 키를 함께 | WRK-05 | GET /api/v1/audit-logs(BFF · from · to · targetTable · targetKey · userId · action) |
| 전후 비교 | 목록 행 펼침 | before · after JSON의 바뀐 키만 강조 · 전체 원문 보기 | WRK-05 | 상동 |
| 태그 변경 이력 탭 | 탭 | 이전 tag_id · 새 tag_id · 전후 scale · offset · 사유 · 변경자 · 태그 하나를 주면 앞뒤 계보 전체 · 두 태그의 트렌드 링크 | WRK-05 | GET /api/v1/audit-logs/tag-reissues(BFF) |

- 검산: 요소 = **3** · 이 화면이 호출하는 기능 = WRK-05 = **1**
- **수정 · 삭제 버튼이 없다.** audit_log에는 수정 · 삭제 표면이 없고 보존은 파티션 정책으로만 줄인다(REQ-WRK-09).

| 상태 | 처리 |
|------|------|
| 로딩 | 필터 · 목록 머리 먼저 · 행 펼침은 이미 받은 원문을 그리므로 추가 조회 없음 |
| 빈 값 | ① 기간에 행 0 — "이 기간에 기록된 변경이 없다" ② 태그 변경 이력 0 — "새 태그 발급 이력이 없다" |
| 오류 | auth.forbidden/403(ADMIN 아님 — 메뉴에서도 숨긴다) · common.validation_failed/400(기간) · common.postgres_unavailable/503 · common.rate_limited/429 — 표시는 [01_standards.md](./01_standards.md) §에러 코드별 사용자 표시 |
| 정상 | 시각은 KST 표시 · 원문 JSON은 저장 모양 그대로(키 이름 snake_case) · 시스템 쓰기(판정 · 적재 · 대조군)는 감사 대상이 아니라 목록에 없다(REQ-WRK-07) |

## 호출 표면 모음

네 화면이 부르는 표면 전수다. 원본에 없는 표면은 07_api 해당 파일이 경로를 확정한다.

| 화면 | 원본 표면(메서드 + 경로) | 07_api 신설 확정(메서드 + 경로) | 확정 대기 |
|------|------|------|------|
| AUTH-LOGIN | POST /api/v1/auth/login · POST /api/v1/auth/refresh · POST /api/v1/auth/logout | 없음 | 없음 |
| ADM-MASTER | GET /api/v1/sites · GET /api/v1/devices · GET · POST · PATCH /api/v1/tags | POST · PATCH /api/v1/sites · GET · POST · PATCH /api/v1/lines · POST · PATCH /api/v1/devices · GET · PUT /api/v1/devices/{id}/modbus-config · GET /api/v1/tags/{id} · POST /api/v1/tags/{id}/deactivate · POST /api/v1/tags/{id}/reissue | 없음 |
| ADM-WORKORDER | GET · POST · PATCH /api/v1/work-orders | GET /api/v1/lines · GET /api/v1/work-orders/{id} · POST /api/v1/work-orders/{id}/status · GET · POST /api/v1/work-orders/{id}/production-logs | 없음 |
| ADM-AUDIT | 없음 | GET /api/v1/audit-logs · GET /api/v1/audit-logs/tag-reissues | 없음 |

- 검산: 확정 대기 표면 = **0** — 네 화면의 표면은 07_api 03 · 04 · 08이 전부 확정했다
- 스위치는 네 화면의 표시를 바꾸지 않는다 — 업무 CRUD의 무효화 체인은 정합성 계약이라 스위치를 두지 않는다([../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) §검산 — 스위치가 걸리지 않는 흐름 F-05). 스위치 영향은 네 화면 모두 "해당 없음"이다.

## 미확인 · 확정 대기 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| Modbus 매핑 변경이 새 태그 발급 대상인가 | 닫힘 — 발급 대상이 아니다 · PATCH로 받고 감사에 남긴다(W5 판정 — 변환식 scale · offset_value만 발급 대상) · 화면은 교정 경고를 띄운다 | [../07_api/04_master.md](../07_api/04_master.md) |
| CRUD p95 · 층별 반영 시간 | 3계층 미확인 — 원본 목표 CRUD 100 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-09 |

## 관련 문서

- [01_standards.md](./01_standards.md) — 에러 표시 · 무효화 신호 수신 · 캐시 정렬
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 6단 · BFF 경유 기준
- [../07_api/03_auth.md](../07_api/03_auth.md) — 로그인 · 갱신 · 로그아웃 표면
- [../07_api/04_master.md](../07_api/04_master.md) — 마스터 표면 · 새 태그 발급
- [../07_api/08_work_orders.md](../07_api/08_work_orders.md) — 작업지시 · 실적 · 감사 표면
- [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) — 작업지시 상태 머신
- [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) — 역할 × 기능
