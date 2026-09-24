# 저장소 간 정합성 (07_cross_store_consistency)

> **대상**: PostgreSQL · ClickHouse · Redis 사이의 정합 원칙 — 두 DB를 트랜잭션으로 묶지 않는 원칙(ADR-16) · 교차 저장소 참조 전수 · Dictionary · tag_id 불변과 태그 생애 · 논리 삭제 · 스케일 변경 · 즉시 반영 · 비활성 태그 이름 판정 · 불일치 시 진실
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(비활성 태그 규칙 · 적재 행 조합 검증)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — EXP 번호 반영(정본 10_observability/01 · 06)
> **원천**: 원본 architecture.md §5 · §7.4 · §12 · §17(커밋 ff66a37) · 원본 data_flow.md §5 · §7 · §7.1 · §8.2 · §12.2(커밋 ff66a37) · 원본 implementation_plan.md §7.2 · §7.4(커밋 ff66a37) · 웨이브 인계 W3 05_data_stores/07 · 01 행(dict_tag WHERE is_active) · ADR-10 · ADR-12 · ADR-16 · [../README.md](../README.md) 전역 불변식 불변 사실 기록 · 저장소 책임 단일화

**두 DB를 트랜잭션으로 묶지 않는다.** 대신 시계열을 **불변 사실 기록**으로 두고, 해석에 필요한 메타는 마스터에서 조회 시점에 붙인다(원본 architecture.md §12 · ADR-16). 이 원칙이 성립하려면 시계열 행이 가리키는 키(tag_id · device_id · rule_id)가 영원히 같은 것을 가리켜야 한다 — 이 문서는 그 키의 생애와, 키를 해석으로 바꾸는 Dictionary의 계약을 고정한다.

**정합성은 "같게 맞춘다"가 아니라 "어느 쪽이 진실인지 정해 둔다"로 선다.** 같은 사실이 두 저장소에 있는 경우는 태그 최신값 하나뿐이고(Redis 휘발 사본 · ClickHouse가 진실), 알람의 세 쓰기는 같은 사실이 아니다(전역 불변식 목적이 다른 세 쓰기). §불일치 시 진실이 사실별 정본 저장소를 적는다.

어느 계층도 강제하지 않는 교차 저장소 참조의 잔여는 [02_postgresql_constraints.md](./02_postgresql_constraints.md) 한계 등재 #6 · #10이 받는다. 캐시 무효화 체인의 기전 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다.

## 묶지 않는 원칙의 적용

원본 architecture.md §12의 문제 · 해결 표를 이 설계의 결정으로 다시 쓴다.

| 문제 | 해결 | 강제 수단 | 버린 대안의 실패 |
|------|------|------|------|
| 시계열 결과에 태그명을 붙여야 한다 | Dictionary(PostgreSQL 소스)로 dictGet | ClickHouse 행에 문자열 메타 컬럼이 없다(REQ-MST-12) | 태그명을 행에 복사 — 이름 변경이 과거 행 mutation이 되고 두 DB 쓰기를 묶을 방법이 없어 한쪽만 바뀐 창이 생긴다 |
| 태그를 지우면 과거 행의 tag_id가 고아 | **물리 삭제하지 않는다** — is_active 논리 삭제 | app_rw에 DELETE 권한 없음([02_postgresql_constraints.md](./02_postgresql_constraints.md)) | 물리 삭제 — dictGet이 빈 문자열을 붙여 과거 구간이 "이름 없는 태그"가 된다 |
| tag_id 재사용 | 시퀀스로만 발급 · 재사용 금지 | IDENTITY ALWAYS — 애플리케이션이 번호를 지정할 수 없다 | 수동 번호 — 재사용된 번호가 과거 행에 다른 태그 이름을 붙인다 |
| 스케일 계수가 바뀌면 과거 값의 뜻이 바뀐다 | **새 tag_id 발급** · 이전 태그 비활성 · tag_master_history 기록 | 가드 트리거(scale · offset_value 갱신 거부) | 같은 tag_id의 scale 수정 — 저장된 공학 단위 값이 새 식과 섞여 추이가 조용히 꺾인다 |
| 마스터와 시계열의 시간 정렬 | 저장은 epoch · 달력 경계는 Asia/Seoul 단일 | timestamptz · 시간대 명시 컬럼 | 컬럼마다 다른 시간대 — 같은 순간이 저장소마다 다른 날짜로 잘린다 |
| 마스터를 고쳐도 조회에 최대 10분 옛 이름 | 커밋 직후 SYSTEM RELOAD DICTIONARY | 무효화 체인(ADR-12) | LIFETIME 대기 — 관리자가 저장 직후 트렌드 화면에서 옛 이름을 본다 |

- 검산: 문제 = **6**(원본 §12 표 행과 같다)
- **이것이 이벤트 소싱의 기본 사고방식이다.** 사실(측정값)은 한 번 쓰고 고치지 않으며, 해석(이름 · 단위)은 조회 시점의 마스터가 준다. 해석이 바뀌어도 사실을 다시 쓰지 않는다.

## 교차 저장소 참조 전수

저장소 경계를 넘어 다른 저장소의 키를 가리키는 자리다. 경계를 넘는 참조에는 FK가 없다 — 끊어지는 조건과 드러나는 자리를 함께 적는다.

| # | 참조하는 자리 | 가리키는 키 | 끊어지는 조건 | 막는 것 | 드러나는 자리 |
|:-:|------|------|------|------|------|
| 1 | ClickHouse tag_raw.tag_id | PostgreSQL tag_master.tag_id | 마스터에 없는 tag_id 적재 · 물리 삭제 | 발행자가 마스터에서 온 태그만 싣는다 · 물리 삭제 권한 없음 | dictGet 결과 빈 문자열 |
| 2 | tag_raw.device_id | tag_master.device_id(그 태그의 설비) | 태그의 device_id와 다른 값 적재 · 태그 설비 이동 | 가드 트리거가 설비 이동을 막는다 · 적재 쪽은 강제 없음 | dictGet(device_id) 대 행 device_id 불일치 조회 |
| 3 | tag_1m · tag_1h · tag_1d의 tag_id · device_id | 상동 | #1 · #2와 같다 — 롤업은 원시를 물려받는다 | 상동 | 상동 |
| 4 | alarm_eval.rule_id · tag_id | alarm_rule.rule_id · tag_id | 규칙 물리 삭제 | 규칙 물리 삭제 표면 없음(REQ-ALM-01) | 규칙 조인 실패 |
| 5 | alarm_event.trigger_value | 판정 행의 tag_raw.value | 판정이 tag_raw에 없는 값으로 이벤트를 연다 | 판정은 삽입이 확정된 배치에만 돈다(REQ-ALM-06) | 발생 시각 ts의 tag_raw 행 대조 |
| 6 | rt:latest:{device_id} 필드 tag_id | tag_master · tag_raw의 최신 행 | 덮어쓰기 순서 역전 | 없음 — 한계 등재 #2 | rt:latest 대 argMax 대조 |
| 7 | cache:tagmeta:{tag_id} | tag_master 행 | 쓰기 뒤 DEL 실패 | TTL | 캐시 삭제 실패 계수 |
| 8 | dict_tag | tag_master 전체 | 재적재 실패 | LIFETIME 자동 재적재 | ClickHouse 오류 메트릭 |
| 9 | plc_tag_raw_control의 tag_id · device_id | tag_master | 대조군은 FK를 갖지 않는다 | 같은 배치를 싣는다(ING-11) | 대조군 · tag_raw 행 집합 대조 |

- 검산: 교차 참조 = **9** · 방향별 ClickHouse → PostgreSQL 4(#1~#4) + PostgreSQL → ClickHouse 1(#5) + Redis → 원천 3(#6~#8 · dict_tag는 ClickHouse 객체이나 사본 성격으로 셈) + 대조군 1(#9)
- **#2가 가장 조용히 끊어진다.** 적재 경로는 Stream 엔트리의 d(device_id)를 그대로 싣고 태그의 설비를 다시 확인하지 않는다. 생성기가 태그 구성을 잘못 쥐면 (device_id, tag_id) 조합이 마스터와 어긋난 행이 오류 없이 쌓인다 — 정렬 키 접두 조회가 그 행을 놓친다.

## Dictionary 계약

ADR-16의 실행 자리다. DDL의 정본은 [03_clickhouse_schema.md](./03_clickhouse_schema.md) §dict_tag다.

| 항목 | 계약 | 근거 · 어기면 |
|------|------|------|
| 소스 | PostgreSQL tag_master · 전용 계정 ch_reader(SELECT만) | 앱 계정이면 Dictionary 소스가 쓰기 권한을 가진다(REQ-MST-11) |
| 적재 대상 | **tag_master 전 행(비활성 포함)** · is_active 속성 | §비활성 태그 이름 판정 |
| 레이아웃 | HASHED — 메모리 상주 · dictGet은 해시 조회 비용 | 태그가 수만을 넘으면 LIFETIME 확대 또는 CACHE 레이아웃 전환(원본 architecture.md §7.4) |
| 주기 반영 | LIFETIME(MIN 300 MAX 600) — 2계층 조정값 · 소유 [03_clickhouse_schema.md](./03_clickhouse_schema.md) | 주기만 믿으면 관리자 저장 뒤 최대 10분 옛 이름 |
| 즉시 반영 | 마스터 커밋 뒤 SYSTEM RELOAD DICTIONARY plc.dict_tag | 커밋 전에 부르면 옛 값을 다시 적재한다 |
| PostgreSQL 중단 | **마지막 적재 값을 유지**한다 — 시계열 조회 계속 | Dictionary가 함께 비면 업무 DB 하나의 장애가 시계열 조회 전체를 멈춘다(REQ-MST-14) |
| 재적재 실패 | 요청을 실패시키지 않는다 · LIFETIME으로 수렴 | REQ-MST-10 |
| 키 타입 | UInt64 · 조회는 dictGet('plc.dict_tag', …, toUInt64(tag_id)) | 단순 키 Dictionary의 키 타입 |

- 검산: 계약 항목 = **8**
- **Dictionary는 한 개다(루트 고정 기준).** 설비명 · 규칙 메타가 필요해지면 dict_tag에 속성을 더하는 것이 먼저다 — Dictionary를 늘리면 ClickHouse 객체 수 고정 기준이 바뀌고 소스 조회 부하가 PostgreSQL 커넥션 상한(ADR-19)에 더해진다.

## 비활성 태그 이름 판정

웨이브 인계 "dict_tag WHERE is_active로 비활성 태그 과거 행의 태그명 소실"을 닫는다. 원본 적재 쿼리는 활성 태그만 읽었고(원본 architecture.md §7.4), 원본은 동시에 태그를 논리 삭제해 과거 해석을 보존하라고 했다(원본 architecture.md §12) — 둘은 충돌한다.

| 안 | 내용 | 결과 |
|------|------|------|
| ① 원본 유지(WHERE is_active) | 활성 태그만 적재 | 비활성화 순간 그 태그의 **과거 행 전부가 이름을 잃는다** — 논리 삭제가 물리 삭제와 같은 조회 결과가 된다. 스케일 변경은 이전 태그를 비활성화하므로 스케일을 한 번 바꾼 태그는 변경 전 구간이 전부 이름 없는 구간이 된다 |
| ② **전 행 적재 + is_active 속성(채택)** | WHERE 제거 · 활성 여부를 속성으로 | 과거 행이 이름을 유지한다. 활성만 필요한 조회는 dictGet(…, 'is_active')로 거른다 |
| ③ 비활성 전용 Dictionary 추가 | 활성 · 비활성 둘 | Dictionary 수 고정 기준(1)이 바뀌고 조회가 두 사전을 합쳐야 한다 |
| ④ 이름을 시계열 행에 저장 | 원시 행에 태그명 | ADR-16 위반 — 이름 변경이 과거 행 mutation |

- 검산: 안 = **4** · 채택 1(②)
- **판정의 대가 — Dictionary 행 수가 단조 증가한다.** 비활성 태그도 남고 스케일 변경은 태그를 새로 만든다. M 티어 태그 1만 개 수준에서는 HASHED 메모리가 문제되지 않지만, 레이아웃 전환 기준(수만 행)의 판단에 비활성 태그가 들어간다는 사실을 [03_clickhouse_schema.md](./03_clickhouse_schema.md) 미확인에 남긴다.
- **잔여 — 과거 행에는 현재 이름이 붙는다.** 태그명을 바꾸면 변경 전 구간에도 새 이름이 보인다. 이것은 결함이 아니라 원칙("해석은 조회 시점")의 결과이며, 옛 이름이 필요하면 audit_log before를 읽는다 — 한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) #6.
- REQ-MST-08(비활성 태그 식별자 조회는 200 · is_active false)과 같은 방향이다 — "비활성 태그는 존재한다"를 API와 Dictionary가 함께 지킨다.

## 태그의 생애

tag_id 하나가 겪는 사건과 각 저장소에서 일어나는 일이다. tag_id는 발급된 뒤 **갱신 · 재사용 · 삭제가 없다.**

| 사건 | PostgreSQL | ClickHouse 행 | dict_tag | Redis | 감사 |
|------|------|------|------|------|------|
| 발급 | tag_master INSERT(IDENTITY) | 이후 적재부터 이 tag_id | 다음 RELOAD부터 | 첫 조회에 cache:tagmeta 채움 | audit_log INSERT |
| 일반 메타 변경(이름 · 단위 · 범위 · 주기) | tag_master UPDATE | 변화 없음 — 과거 행 불변 | RELOAD로 새 해석 | cache:tagmeta DEL | audit_log UPDATE(before · after) |
| 논리 삭제 | is_active false | 변화 없음 · 새 행이 오지 않는다(Collector 폴링 대상에서 빠진다) | 남는다 · is_active 0 | DEL | audit_log UPDATE |
| 스케일 변경 | 새 tag_id 발급 · 이전 비활성 · tag_master_history 1행 | 이전 tag_id 행은 이전 식의 값으로 남는다 | 두 태그 모두 남는다 | 두 키 DEL | audit_log 행(두 태그) |
| 설비 이동 | **없는 동작** — 새 태그 발급으로 한다 | 해당 없음 | 해당 없음 | 해당 없음 | 해당 없음 |
| 보존 경과 | 변화 없음 — 마스터는 무기한 | TTL이 파티션을 지운다 | 남는다 | 해당 없음 | 해당 없음 |

- 검산: 사건 = **6**
- **스케일 변경 뒤 추이 화면은 두 tag_id를 잇는다.** 한 태그의 긴 추이는 tag_master_history의 old_tag_id 경로를 따라 여러 tag_id 구간을 이어 그린다 — 이어 그릴지, 변환식이 다른 구간을 구분 표시할지는 화면 판단이다([../08_screen/04_trend_analysis.md](../08_screen/04_trend_analysis.md)).
- 비활성 태그를 가리키는 알람 규칙의 처리는 판정 경로의 몫이다([../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) W4). 저장소는 FK를 유지할 뿐이다.

## 즉시 반영 — 층별 옛 값의 창

마스터 쓰기 하나가 네 저장소 층의 사본을 건드린다. 체인은 **커밋 뒤에만 · 갱신이 아니라 삭제**다(ADR-12 · REQ-MST-09). 체인 단계의 번호 · 기전은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)가 정본이다.

| 층 | 사본 | 반영 수단 | 수단이 실패하면 남는 옛 값의 창(현행 참고) | 창의 소유처 |
|------|------|------|------|------|
| Redis | cache:tagmeta · devlist · alarmrules | 커밋 뒤 DEL | TTL(600초 · 300초) | [05_redis_keyspace.md](./05_redis_keyspace.md) |
| 다른 api 인스턴스 | 프로세스 메모리 캐시 | ch:cacheinv 발행 | 현재 인스턴스 1개라 창 없음 | 확장 로드맵 2단계 |
| ClickHouse | dict_tag | SYSTEM RELOAD | LIFETIME 최대 600초 | [03_clickhouse_schema.md](./03_clickhouse_schema.md) |
| BFF | Next.js 서버 fetch 캐시 | 태그 무효화 | revalidate 창(30초) | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) |
| 브라우저 | 쿼리 캐시 | WebSocket 무효화 신호(RLT-09) | staleTime | 상동 |

- 검산: 층 = **5**(Redis · 다른 인스턴스 · ClickHouse · BFF · 브라우저)
- **커밋 전에 지우면 창이 "TTL까지"에서 "영구"로 바뀐다(B형).** 결론 — 삭제는 반드시 커밋 뒤다. 반대 시나리오 — 삭제와 커밋 사이에 다른 요청이 옛 값을 읽어 사본을 다시 채우면, 커밋 뒤에도 그 사본이 TTL이 끝날 때까지 낡은 값이다. 파생 지침 — 삭제 실패는 요청을 실패시키지 않고 계측한다(REQ-MST-10).
- 무효화 체인에는 스위치가 없다 — 정합성 계약이라 끈 상태를 측정 조건으로 둘 이유가 없다([../02_features/02_master.md](../02_features/02_master.md)).

## 불일치 시 진실

같은 사실(또는 같아 보이는 사실)이 여러 저장소에 있을 때 어느 쪽이 정본인가.

| 사실 | 정본 저장소 | 다른 자리 | 다른 자리의 성격 | 어긋나면 |
|------|------|------|------|------|
| 태그 메타 | PostgreSQL tag_master | cache:tagmeta · dict_tag | 사본 — 삭제 · 재적재로 수렴 | 사본을 버리고 원천에서 다시 읽는다 |
| 태그 원시값 | ClickHouse tag_raw | 대조군 plc_tag_raw_control | **실험 계측물** — 중복 저장이 아니다(D-05) | 대조군 구간을 무효로 표시한다(REQ-ING-15) |
| 태그 최신값 | **ClickHouse**(argMax) | Redis rt:latest | 휘발 사본 — **유일한 중복 저장 예외** | 기동 시 argMax 1회로 재구성 · 불일치면 ClickHouse가 진실 |
| 확정 알람 이벤트 | PostgreSQL alarm_event | ch:alarm 발행 · 화면 | 통지 | alarm:state를 되돌려 다음 주기 재시도(REQ-ALM-10) |
| 알람 판정 진행 | Redis alarm:state | 없음 | 핫 상태 — 다른 사실 | 해당 없음 — 세 쓰기는 같은 사실이 아니다 |
| 판정 전수 | ClickHouse alarm_eval | 없음 | 분석 로그 — 다른 사실 | 결손은 dlq_count로 계측 · 알람 기능과 무관 |
| 롤업 | 원시 tag_raw(보존 기간 안) | tag_1m · tag_1h · tag_1d | 파생 — 원시에서 재계산 가능 | 원시 기준으로 재계산 · 원시가 지워진 구간은 롤업이 유일 |

- 검산: 사실 = **7**
- **최신값의 진실이 Redis가 아닌 이유(A형).** 통념은 "최신값은 Redis에 있으니 Redis가 정본"이다. 그러나 Redis 사본은 ClickHouse 삽입 성공 뒤에 갱신되고(현행 · ADR-10), 역순 확인으로 옛 값이 남을 수 있으며, Redis를 초기화하면 사라진다. 진짜 축은 "어디서 재구성할 수 있는가"다 — 대체 경로는 argMax(value, ts) 대조다. ADR-10의 S6 실측으로 갱신 주체가 Collector로 옮겨 가도 진실은 ClickHouse 그대로다.
- **롤업 행은 원시 보존이 끝나면 정본이 된다.** 원시가 7일 뒤 지워지면 그 구간의 롤업은 재계산할 원천이 없는 유일한 기록이다 — 롤업 테이블의 삭제 · 재생성은 원시 보존 창 안에서만 안전하다([08_retention_lifecycle.md](./08_retention_lifecycle.md)).

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| dict_tag 레이아웃 전환 기준 | 비활성 포함 적재로 행 수 단조 증가 — 전환 시점 미확인 | [03_clickhouse_schema.md](./03_clickhouse_schema.md) · 태그 규모 실측 |
| 스케일 변경 전후 구간의 추이 표시 | 저장은 계보 행으로 닫힘 · 표시는 미설계 | [../08_screen/04_trend_analysis.md](../08_screen/04_trend_analysis.md)(W5) |
| 비활성 태그를 가리키는 알람 규칙 | 닫힘 — 활성 규칙 = enabled ∧ 태그 is_active · 규칙 행 · 열린 이벤트 · alarm:state는 남긴다 — [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md) | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| 적재 행의 (device_id, tag_id) 조합 검증 | 닫힘 — 발행자 책임 + 사후 대조 쿼리 · 적재 경로는 행마다 검증하지 않는다 — [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md) | [../06_pipeline/03_ingest_batch.md](../06_pipeline/03_ingest_batch.md)(W4) |
| 층별 반영 시간 | 3계층 미확인 — 원본 예상치 Dictionary 최대 10분(RELOAD 생략 시) · BFF 최대 30초 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · EXP-29(AC-06 기록) |

## 관련 문서

- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — dict_tag DDL · 시각 컬럼 시간대
- [01_postgresql_schema.md](./01_postgresql_schema.md) — tag_master · tag_master_history
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — 가드 트리거 · 한계 등재
- [08_retention_lifecycle.md](./08_retention_lifecycle.md) — 저장소별 보존
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — 무효화 체인 기전
- [../03_requirements/03_master.md](../03_requirements/03_master.md) — REQ-MST 태그 쓰기 · Dictionary 계약
- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-10 · ADR-12 · ADR-16
