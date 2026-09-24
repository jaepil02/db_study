# MST — 마스터 표면 (04_master)

> **대상**: MST 도메인 REST 표면 — 사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 마스터의 조회와 쓰기 · 태그 논리 삭제 · 스케일 변경 새 태그 발급 · 무효화 체인 대상 키 · 원본에 없는 표면 판정(라인 · 사이트 · modbus_config 쓰기) · unit만 바꾸는 태그 수정 판정 · 재활성화 판정
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W5 판정 반영 — #7 비활성 원천 거절 → **master.reissue_source_inactive/409** · 사이트 · 라인 · 태그 목록 Redis 사본 없음(리드 판정) · Modbus 매핑 변경 PATCH 허용 + 감사(리드 판정) — 표면 수 불변
> **원천**: 원본 architecture.md §6 · §11 · §12 · §18(커밋 ff66a37) · 원본 data_flow.md §7 · §7.1 · §7.2(커밋 ff66a37) · REQ-MST-01~15 · REQ-GLB-14 · ADR-12 · ADR-16 · [../02_features/02_master.md](../02_features/02_master.md) MST-01~06 · [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) · [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) 무효화 체인 · docs_plan.md 웨이브 인계 W5 07_api 행(unit만 바꾸는 태그 수정 · 원본에 없는 표면)

MST 표면은 **한 번의 저장이 네 사본 층을 건드리는 표면**이다. 쓰기는 PostgreSQL 트랜잭션(변경 + audit_log)으로 커밋되고, 커밋 뒤에만 Redis 사본 삭제 · ch:cacheinv 발행 · Dictionary 재적재(태그만) · BFF 무효화 · 브라우저 무효화 신호가 걸린다(ADR-12 · 체인 6단 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)). 그래서 이 문서의 쓰기 계약은 요청 · 응답과 함께 **체인이 지우는 키**를 적는다.

원본 API 표는 sites(GET) · devices(GET) · tags(GET · POST · PATCH) 다섯 줄뿐이다(원본 architecture.md §11). 그런데 기능 MST-01~06은 사이트 · 라인 · 설비 · 접속 설정의 등록 · 수정과 태그 논리 삭제 · 새 태그 발급을 요구한다(S4 마스터 CRUD 범위). 이 문서는 그 차이를 **기능 근거로 신설**해 닫는다 — 신설 표면마다 기능 ID를 단다.

**태그는 불변 사실 기록의 해석 원천이다.** tag_id는 영구 보존 · 재사용 금지이고 스케일이 바뀌면 새 tag_id를 발급한다(REQ-GLB-14). 그래서 태그 표면에는 물리 삭제가 없고, 스케일 PATCH는 거절되며, 비활성 태그는 조회에서 사라지지 않는다.

## 공통 규약

| 항목 | 규칙 | 근거 |
|------|------|------|
| 경로 | 전 표면 BFF 경유 — 조회는 BFF 서버 fetch 캐시(revalidate · 현행 참고 30초) · 쓰기 성공 시 BFF가 해당 태그를 무효화(⑤) | [01_conventions.md](./01_conventions.md) §BFF 경유와 직결 |
| 인가 | 조회 전원 · 쓰기 ADMIN만 | REQ-MST-15 · 권한 매트릭스 MST |
| 트랜잭션 | 쓰기 하나 = 트랜잭션 하나(변경 + audit_log) · 감사 실패는 변경 전체 롤백 | REQ-MST-05 · REQ-WRK-08 |
| 체인 실패 | ② 삭제 · ③ 발행 · ④ 재적재 실패는 **요청을 실패시키지 않는다** — 계수만 한다 | REQ-MST-10 |
| 물리 삭제 | DELETE 메서드 표면이 없다 — 설비 · 태그는 is_active false로 끈다 | REQ-MST-02 · 06 |
| 비활성 대상 | 식별자 조회 200 + isActive false · 404는 마스터에 없는 식별자만 | REQ-MST-08 |
| PostgreSQL 불가 | 읽기 · 쓰기 common.postgres_unavailable/503 · Redis 사본이 있는 조회(#2 설비 목록 · #8 태그 단건)는 사본으로 200 | REQ-MST-14 |
| 단계 | 조회 S2(시드 최소분) · 쓰기 S4 · 인가 S7 | REQ-MST-01 · D-07 |

- 검산: 항목 = **8**
- **체인 실패로 요청을 실패시키지 않는 이유(B형)** — 이미 커밋된 쓰기가 실패 응답을 받으면 클라이언트가 같은 쓰기를 재시도해 tag_code 중복 409를 맞는다. 옛 사본은 TTL까지 남고 그 상한은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) §층별 반영 시점이 말한다.

## 표면 요약

| # | 메서드 | 경로 | 기능 ID | 역할 | 캐시 | 에러 코드 | 호출 화면 | 원본 여부 |
|:-:|------|------|------|------|------|------|------|------|
| 1 | GET | /api/v1/sites | MST-01 | 전원 | Redis 사본 없음(판정) · BFF revalidate | common.postgres_unavailable/503 | ADM-MASTER · DSH-REALTIME · ANL-TREND | 원본 |
| 2 | GET | /api/v1/devices | MST-02 | 전원 | cache:devlist:{site_id} · BFF revalidate | common.validation_failed/400 · common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER · DSH-REALTIME · ANL-TREND | 원본 |
| 3 | GET | /api/v1/tags | MST-04 · 05 | 전원 | Redis 사본 없음(판정) · BFF revalidate | common.validation_failed/400 · common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER · ANL-TREND · ALM-RULES | 원본 |
| 4 | POST | /api/v1/tags | MST-04 | ADMIN | 없음 | common.validation_failed/400 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 원본 |
| 5 | PATCH | /api/v1/tags/{id} | MST-04 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · master.scale_change_forbidden/409 · common.postgres_unavailable/503 | ADM-MASTER | 원본 |
| 6 | POST | /api/v1/tags/{id}/deactivate | MST-05 | ADMIN | 없음 | common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 7 | POST | /api/v1/tags/{id}/reissue | MST-06 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · master.reissue_source_inactive/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 8 | GET | /api/v1/tags/{id} | MST-04 · 05 | 전원 | cache:tagmeta:{tag_id} · BFF revalidate | common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER · ANL-TREND | 신설 |
| 9 | POST | /api/v1/sites | MST-01 | ADMIN | 없음 | common.validation_failed/400 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 10 | PATCH | /api/v1/sites/{id} | MST-01 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 11 | GET | /api/v1/lines | MST-01 | 전원 | Redis 사본 없음(판정) · BFF revalidate | common.validation_failed/400 · common.postgres_unavailable/503 | ADM-MASTER · ADM-WORKORDER | 신설 |
| 12 | POST | /api/v1/lines | MST-01 | ADMIN | 없음 | common.validation_failed/400 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 13 | PATCH | /api/v1/lines/{id} | MST-01 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 14 | POST | /api/v1/devices | MST-02 · 03 | ADMIN | 없음 | common.validation_failed/400 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 15 | PATCH | /api/v1/devices/{id} | MST-02 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.duplicate_key/409 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 16 | GET | /api/v1/devices/{id}/modbus-config | MST-03 | 전원 | 없음 · BFF no-store | common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |
| 17 | PUT | /api/v1/devices/{id}/modbus-config | MST-03 | ADMIN | 없음 | common.validation_failed/400 · common.not_found/404 · common.postgres_unavailable/503 | ADM-MASTER | 신설 |

- 검산: 표면 = REST **17** · 원본 5(#1~#5) + 신설 12(#6~#17) = **17** · 조회 6(#1 · 2 · 3 · 8 · 11 · 16) + 쓰기 11 = **17**
- 신설 12의 기능 근거: MST-01 5(#9~#13) · MST-02 2(#14 · 15) · MST-03 2(#16 · 17) · MST-04 · 05 1(#8) · MST-05 1(#6) · MST-06 1(#7) = **12**
- **#1 · #3 · #11은 Redis 사본을 두지 않는다(리드 판정 · 키 패턴 수 불변).** 원본은 sites · tags에 600초 캐시를 적었지만(원본 architecture.md §11) 목록은 저빈도 · 사용자 공통이라 BFF 서버 fetch 캐시(revalidate)가 한 번 흡수하면 충분하다. Redis 사본을 더 두면 무효화 체인 ②단의 삭제 대상 키가 늘 뿐 흡수할 요청이 남지 않는다. 설비 목록(cache:devlist:{site_id})은 Collector 재로드 신호의 키 이름으로도 쓰여 유지한다.

## 표면 계약 — 태그

### #3 · #8 태그 조회

| 항목 | #3 GET /api/v1/tags | #8 GET /api/v1/tags/{id} |
|------|------|------|
| 요청 | deviceId(**필수**) · includeInactive(선택 · 기본 false) | 경로 id |
| 응답 200 | items — 태그 객체 배열 · 페이지 없음(설비 하나의 태그 수로 묶인다) | 태그 객체 하나 — **비활성이어도 200** |
| 원천 | PostgreSQL tag_master | cache:tagmeta:{tag_id} → 미스 · 실패면 PostgreSQL(degrade) |
| 실패 | deviceId 누락 → 400 · 없는 설비 → 404 | 없는 tag_id → 404 |
| 관련 REQ | REQ-MST-04 · 08 · 14 | REQ-MST-08 · 13 · 14 |

- 태그 객체 필드: tagId · deviceId · tagCode · tagName · functionCode · address · dataType · wordOrder · scale · offsetValue · unit · deadband · scanRateMs · rangeMin · rangeMax · isActive = **16**
- **deviceId를 필수로 둔 이유** — 용량 티어 L에서 태그 전수를 한 응답에 싣으면 BFF 캐시 한 항목이 수만 행이 되고, 화면은 어차피 설비 단위로 고른다. 설비 필터 없는 목록이 필요한 화면은 없다(선점 화면 인벤토리).
- **#8이 존재하는 이유** — 트렌드 화면이 과거 구간의 태그 메타를 얻으려면 비활성 태그도 식별자로 읽혀야 한다. 404로 내면 논리 삭제가 물리 삭제와 같은 결과가 된다(REQ-MST-08).

### #4 POST /api/v1/tags · #5 PATCH /api/v1/tags/{id}

| 항목 | #4 등록 | #5 수정 |
|------|------|------|
| 요청 | deviceId · tagCode · tagName · functionCode · address · dataType · wordOrder · scale · offsetValue · unit · deadband · scanRateMs · rangeMin · rangeMax | 수정 가능 필드의 부분 집합(아래 표) |
| 응답 | 201 태그 객체 | 200 태그 객체 |
| 검증 | enum(function_code 4 · data_type 7 · word_order 4) · 결합 규칙(16비트 · BOOL은 wordOrder null · 범위는 min < max) · deviceId 존재 | 상동 + 불변 필드 거절 · 스케일 판정 |
| 실패 | tag_code 중복 409 · 본문의 deviceId가 없는 설비 → 400(reference) | 스케일 변경 master.scale_change_forbidden/409 · 불변 필드 400(immutable) · tag_code 중복 409 · 없는 id 404 |
| 체인 | ② DEL cache:tagmeta:{tag_id} · ③ ch:cacheinv(같은 키) · ④ RELOAD DICTIONARY(응답 뒤) · ⑤ · ⑥ | 상동 |
| 감사 | audit_log INSERT(before null) | audit_log UPDATE(before · after) — 실제로 바뀐 필드가 없으면 감사 행도 없다 |
| 관련 REQ | REQ-MST-04 · 05 · 09 · 12 · 15 | REQ-MST-04 · 05 · 07 · 09 · 15 |

#5가 받는 필드는 셋으로 갈린다.

| 구분 | 필드 | 규칙 | 근거 |
|------|------|------|------|
| 수정 가능 | tagCode · tagName · unit · deadband · scanRateMs · rangeMin · rangeMax · functionCode · address · dataType · wordOrder | 일반 쓰기 규칙 — 비활성 태그도 같다 | REQ-MST-04 · REQ-MST-08 판정 경계 |
| 스케일 | scale · offsetValue | **현재 값과 다르면 409 master.scale_change_forbidden** · 같으면 변경 없음 | REQ-MST-07 · 활성 여부 무관 |
| 불변 | tagId · deviceId · isActive | 400 common.validation_failed(immutable) — 비활성화는 #6 | 태그를 다른 설비로 옮기면 rt:latest:{device_id} Hash의 필드가 두 설비에 걸린다 |

- 검산: 수정 가능 11 + 스케일 2 + 불변 3 = **16** = 태그 객체 필드 수
- **Modbus 매핑(functionCode · address · dataType · wordOrder) 변경은 PATCH로 받고 감사에 남긴다(리드 판정).** 매핑은 같은 물리량을 어느 레지스터 · 어떤 형식으로 읽는가의 해석 교정이라 값의 공학 단위 뜻을 바꾸지 않는다 — 변환식(scale · offset_value)만 새 태그 발급 대상이다. 교정 전후 경계는 audit_log의 before · after와 acted_at이 가른다. 판정 정본 [../03_requirements/03_master.md](../03_requirements/03_master.md).
- **A형 — "스케일만 고치려는데 409"는 버그가 아니다.** 통념은 PATCH가 필드를 고친다는 것이다. 부정 — 기존 행의 scale을 고치면 과거 값의 공학 단위 의미가 조용히 바뀐다. 진짜 축은 **변환식이 바뀌면 다른 태그**라는 것이다. 대체 경로 — #7 새 태그 발급.
- **서버가 PATCH 안에서 새 태그를 만들어 주지 않는다.** 응답 식별자가 요청 경로의 식별자와 달라져, 옛 tag_id를 쥔 클라이언트 · 알람 규칙이 비활성 태그를 계속 가리킨다(REQ-MST-07 판정).

### #6 POST /api/v1/tags/{id}/deactivate

| 항목 | 계약 |
|------|------|
| 요청 | 본문 없음 |
| 응답 200 | 태그 객체(isActive false) — 이미 비활성이면 변경 없이 200 · 감사 행 없음 |
| 처리 | UPDATE is_active = false + audit_log(UPDATE) — DELETE 문을 실행하는 경로가 없다 |
| 체인 | ② DEL cache:tagmeta:{tag_id} · ③ 발행 · ④ 재적재 · ⑤ · ⑥ — Collector는 ③으로 다음 사이클부터 폴링에서 뺀다 |
| 남는 것 | ClickHouse 과거 행 · 이 태그를 가리키는 알람 규칙(판정 제외) · 열린 알람 이벤트(사람의 확인만 가능) |
| 관련 REQ | REQ-MST-05 · 06 · 08 |

- **DELETE 메서드를 쓰지 않은 이유(A형)** — DELETE 뒤의 GET이 200을 돌려주면 HTTP 의미와 반대라 클라이언트 캐시 계층이 자원을 지운 것으로 처리한다. 논리 삭제는 자원 상태의 전이이므로 동사 하위 경로로 표현한다.
- 비활성 태그의 열린 알람은 시스템이 닫지 않는다 — 판정이 멈춰 해소를 관측하지 못한다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) §비활성 태그 규칙). 목록 표시는 [07_alarms.md](./07_alarms.md) #1의 tagIsActive다.

### #7 POST /api/v1/tags/{id}/reissue

| 항목 | 계약 |
|------|------|
| 요청 | newTagCode(필수) · scale · offsetValue(적어도 하나가 현재와 달라야 한다) · reason(선택) · 그 밖의 태그 필드(선택 — 없으면 이전 태그에서 복사 · unit은 함께 바꿀 수 있다) |
| 응답 201 | newTag(태그 객체) · oldTagId · historyId |
| 처리 | 한 트랜잭션 — ① 새 tag_id 발급(시퀀스) ② 이전 태그 is_active false ③ tag_master_history(old · new tag_id · 전후 scale · offset_value · reason · changed_by) ④ audit_log 2행(새 태그 INSERT · 이전 태그 UPDATE) |
| 원천 조건 | **이전 태그가 활성일 때만** — §원본에 없는 표면 판정 |
| 실패 | newTagCode 중복 409 · 스케일이 현재와 같음 400(range) · 없는 id 404 · 비활성 원천 → 409 master.reissue_source_inactive |
| 체인 | 두 tag_id 모두 ② DEL cache:tagmeta · ③ · ④ · ⑤ · ⑥ |
| 규칙 이관 | **하지 않는다** — 이전 태그의 알람 규칙은 비활성 태그를 가리킨 채 판정에서 빠진다 · 엔지니어가 새 태그에 규칙을 등록한다(ALM-01) |
| 관련 REQ | REQ-MST-05 · 07 · REQ-GLB-14 |

새 태그 발급 요청 예시다.

```json
{
  "newTagCode": "D12-TEMP-01-F",
  "scale": 1.8,
  "offsetValue": 32,
  "unit": "°F",
  "reason": "표시 단위를 화씨로 전환"
}
```

- **newTagCode를 필수로 둔 이유** — 이전 태그는 비활성이어도 tag_code UNIQUE를 점유한다(비활성 태그도 코드를 점유 — 스키마 정본). 서버가 코드를 지어 주면 사람이 읽는 코드의 규칙이 서버 안으로 숨는다.
- **규칙을 자동 이관하지 않는 이유** — 임계값은 공학 단위 값이라 스케일이 바뀌면 같은 숫자가 다른 뜻이다. 옮겨 붙이면 섭씨 80 임계가 화씨 80으로 조용히 바뀐다.

## 표면 계약 — 사이트 · 라인 · 설비 · 접속 설정

### #1 · #9 · #10 · #11 · #12 · #13 사이트 · 라인

| # | 요청 | 응답 | 불변 필드 | 체인 |
|:-:|------|------|------|------|
| 1 | 없음 | items — siteId · siteCode · siteName · timezone | 해당 없음 | 해당 없음 |
| 9 | siteCode · siteName | 201 사이트 객체 · timezone은 요청에서 받지 않고 'Asia/Seoul' 고정 | 해당 없음 | ② ③ 없음(사본 · 키 이름 없음) · ⑤ · ⑥ 없음 |
| 10 | siteCode · siteName 중 일부 | 200 사이트 객체 | siteId · timezone | 상동 |
| 11 | siteId(선택) | items — lineId · siteId · lineCode · lineName | 해당 없음 | 해당 없음 |
| 12 | siteId · lineCode · lineName | 201 라인 객체 | 해당 없음 | 상동 |
| 13 | lineCode · lineName 중 일부 | 200 라인 객체 | lineId · siteId | 상동 |

- 검산: 표면 = **6**
- **timezone을 요청으로 받지 않는다.** 컬럼은 CHECK = 'Asia/Seoul'로 고정이고(스키마 정본 §인계 판정), 받으면 허용값이 하나뿐인 필드를 클라이언트가 채워야 한다 — 다른 값이면 사이트의 하루와 tag_1d의 하루가 어긋나는 것을 막으려는 고정이다.
- 사이트 코드 · 라인 코드(사이트 안 유일)의 중복은 common.duplicate_key/409다. 삭제 표면은 두지 않는다 — 기능 MST-01은 등록 · 수정이다.

### #2 · #14 · #15 설비

| 항목 | #2 GET /api/v1/devices | #14 POST /api/v1/devices | #15 PATCH /api/v1/devices/{id} |
|------|------|------|------|
| 요청 | siteId(**필수**) · includeInactive(선택) | lineId · deviceCode · deviceName · vendor · model · **modbusConfig(필수)** | deviceCode · deviceName · vendor · model · isActive 중 일부 |
| 응답 | items — deviceId · lineId · deviceCode · deviceName · vendor · model · isActive | 201 설비 객체 + modbusConfig | 200 설비 객체 |
| 불변 | 해당 없음 | 해당 없음 | deviceId · lineId |
| 체인 | 해당 없음 | ② DEL cache:devlist:{site_id} · ③ · ⑤ · ⑥ | 상동 — isActive 변경은 ③으로 Collector가 폴링 대상을 다시 읽는다 |
| 관련 REQ | REQ-MST-01 · 02 · 14 | REQ-MST-02 · 03 · 15 | REQ-MST-02 · 15 |

- **설비는 재활성화를 허용하고 태그는 허용하지 않는다(판정).** 설비 is_active는 폴링 여부일 뿐 값의 뜻을 바꾸지 않는다. 태그는 스케일 변경으로 대체된 이전 태그가 되살아나면 같은 레지스터를 다른 변환식으로 두 번 폴링한다 — §원본에 없는 표면 판정.
- **siteId를 필수로 둔 이유** — Redis 사본이 사이트 단위 키(cache:devlist:{site_id})라 필터 없는 목록은 사본을 쓸 수 없다.
- **등록에 modbusConfig를 함께 받는 이유** — 설비와 접속 설정은 1:1이고 Collector는 설정 없는 설비를 폴링할 수 없다. 두 표면으로 가르면 그 사이에 설정 없는 설비가 커밋된다.

### #16 · #17 Modbus 접속 설정

| 항목 | #16 GET | #17 PUT |
|------|------|------|
| 요청 | 경로 id(device_id) | host · port · unitId · timeoutMs · retryCount · maxRegsPerRequest — **전부 필수**(교체) |
| 응답 200 | 접속 설정 객체 | 접속 설정 객체 |
| 검증 | 해당 없음 | port 1~65535 · unitId 0~247 · maxRegsPerRequest 1~125 · timeoutMs 양수 · retryCount 0 이상 |
| 체인 | 해당 없음 | ② 없음(사본 키가 없다) · **③ ch:cacheinv에 cache:devlist:{site_id} 키 이름** · ④ ⑤ ⑥ 없음 |
| BFF | **no-store** — ⑤가 없으므로 캐시하면 저장 직후 옛 설정이 revalidate 창만큼 보인다 | 해당 없음 |
| 관련 REQ | REQ-MST-03 · 14 | REQ-MST-03 · 15 |

- **B형 — host를 루프백으로 바꾸면 그 설비의 값이 SIMULATED(9)가 된다.** 접속 설정 쓰기가 ADMIN 단일 주체인 이유다 — SIMULATED 판정의 원천이 흔들리면 실데이터와 생성 데이터를 가를 방법이 없다(REQ-MST-03 · REQ-GLB-18).
- PUT인 이유 — 설비 1:1 자원이고 여섯 필드가 모두 NOT NULL이라 부분 수정이 없는 교체가 저장 모양과 같다.

## 원본에 없는 표면 판정

| 후보 | 판정 | 기능 근거 | 버린 대안의 실패 |
|------|------|------|------|
| 사이트 · 라인 쓰기 · 라인 조회 | **신설** #9~#13 | MST-01 "사이트 · 라인을 등록 · 수정" | 시드로만 두면 S4 마스터 CRUD 범위(site · line · device · tag)가 비어 작업지시의 라인 선택이 시드에 묶인다 |
| 설비 쓰기 | **신설** #14 · #15 | MST-02 "등록 · 수정 · 비활성화" | 원본 표대로면 신규 설비를 들일 수 없어 빈 키 복원 · 신규 설비 판정(RLT)을 재현할 수 없다 |
| modbus_config 조회 · 쓰기 | **신설** #16 · #17 | MST-03 | 접속 설정이 시드에만 있으면 모드 A 설비 추가가 마이그레이션 작업이 된다 |
| 태그 단건 조회 | **신설** #8 | MST-04 · REQ-MST-08 | 목록에서 찾으려면 설비를 알아야 해 트렌드 화면의 비활성 태그 메타 조회가 설비 역추적을 요구한다 |
| 태그 논리 삭제 | **신설** #6 | MST-05 | PATCH isActive로 두면 true 되돌리기를 같은 필드에서 따로 막아야 한다 |
| 새 태그 발급 | **신설** #7 | MST-06 · REQ-MST-07 "별도 동작" | PATCH 안의 자동 발급 — REQ-MST-07이 버린 안 |
| 태그 재활성화 | **두지 않는다** | 기능 없음 — MST-05는 한 방향이다 | 스케일로 대체된 태그가 되살아나 같은 주소를 두 변환식으로 폴링한다 · 되살릴 태그는 새 코드로 등록한다 |
| 설비 · 태그 물리 삭제 | **두지 않는다** | REQ-MST-02 · 06 | ClickHouse 과거 행이 고아 tag_id · device_id를 갖는다 |
| 사이트 · 라인 삭제 | **두지 않는다** | 기능 없음 | 라인을 지우면 작업지시 · 설비의 FK가 막거나(RESTRICT) 이력이 끊긴다 |
| 태그 변경 이력 조회 | **이 문서에 두지 않는다** | WRK-05가 tag_master_history를 감사 조회로 소유 | [08_work_orders.md](./08_work_orders.md) #9 |

- 검산: 후보 = **10** · 신설 6행(표면 12) + 두지 않음 4행 = **10**
- **새 태그 발급의 원천이 비활성이면 거절한다(판정).** 이미 대체된 태그에서 한 번 더 발급하면 한 이전 태그에서 활성 태그가 둘 생겨 같은 레지스터를 두 번 폴링한다 — new_tag_id UNIQUE는 이 분기를 막지 못한다(old_tag_id는 유일 제약이 없다). 거절 코드는 master.reissue_source_inactive/409다(W5 채번).

## unit만 바꾸는 태그 수정 판정

인계 "unit만 바꾸는 태그 수정 허용 여부"를 닫는다. **판정 — 허용한다. scale · offset_value가 그대로인 unit 변경은 표기 정정이다.**

| 안 | 동작 | 실패 시나리오 | 판정 |
|------|------|------|------|
| ① 거절(스케일 변경처럼 새 태그) | unit이 바뀌면 새 tag_id | "degC"를 "°C"로 고치는 표기 정정마다 태그 계보가 갈라져 트렌드가 끊긴다 | 버림 |
| ② **허용** | 일반 PATCH · 감사 before · after | 물리 단위를 바꾸면서 변환식을 그대로 두는 잘못된 요청은 막지 못한다 — 잔여 | **채택** |

- 검산: 안 = **2**
- **물리 단위가 바뀌면 변환식이 반드시 바뀐다.** 섭씨 → 화씨는 scale 1.8 · offset 32이고, 이 변경은 스케일 판정(#5 409)에 먼저 걸려 #7로 간다. 변환식이 그대로인데 unit만 바뀐다면 같은 숫자에 붙은 이름을 고치는 것이다 — 과거 행의 뜻이 바뀌지 않는다.
- **잔여 — unit은 가드 트리거 밖이다.** 변환식 없이 물리 단위만 바꾸는 잘못된 요청을 DB가 막지 못한다([../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 미확인 표의 W5 판정 행). audit_log의 before · after가 그 흔적을 남긴다. Dictionary가 조회 시점에 unit을 붙이므로 저장 직후 과거 구간 조회에도 새 표기가 붙는다(REQ-MST-12).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 태그 · 설비 쓰기 p95 · 층별 반영 시간 | 3계층 미확인 — 원본 목표 CRUD 100 ms | [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) REQ-NFR-09 |

## 관련 문서

- [01_conventions.md](./01_conventions.md) — BFF 배정 · 봉투 · 필드 변경 규칙
- [02_errors.md](./02_errors.md) — master · common 미러
- [../02_features/02_master.md](../02_features/02_master.md) — MST-01~09 기능 정본
- [../03_requirements/03_master.md](../03_requirements/03_master.md) — REQ-MST 계약
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 6단 · 쓰기별 대상 키
- [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) — 마스터 테이블 컬럼
- [../08_screen/06_master_admin.md](../08_screen/06_master_admin.md) — ADM-MASTER 화면
