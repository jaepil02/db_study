# REQ-MST — 마스터 데이터 요구사항

> **대상**: 마스터 데이터(MST · NestJS master 모듈)의 동작 계약 — 사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 마스터 쓰기 · 논리 삭제 · 스케일 변경 · 캐시 무효화 체인 · Dictionary 원천 — REQ-MST-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W4 판정 반영 — REQ-MST-03 · 08 실행 중 마스터 변경 재기동 전 미반영 → **ch:cacheinv로 Collector 반영**(modbus_config도 신호) · REQ-MST-09 체인 5단 표기 → **6단 번호**(① 커밋) — REQ 수 불변
> **원천**: 원본 architecture.md §5 · §6 · §7.4 · §8.2 · §10.1 · §11 · §12 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §3 · §5 · §7 · §7.1 · §17(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · S4 · §7.4 · §7.5(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #15 · D-04 · D-11 · [../02_features/02_master.md](../02_features/02_master.md) MST-01~09 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) 채번 보류 · [01_global_rules.md](./01_global_rules.md) REQ-GLB-12 · 14

이 문서는 MST 기능 9개의 동작 계약을 고정한다. MST는 분기 ③계층(PostgreSQL 전용 · Stream을 타지 않음 — REQ-GLB-12)이면서 **한 번의 저장이 네 저장소 층(PostgreSQL · Redis · ClickHouse Dictionary · 웹 캐시)을 건드리는 유일한 도메인**이다. 그래서 요구의 절반이 쓰기 자체가 아니라 **쓰기 뒤의 순서**에 걸려 있다.

**태그는 불변 사실 기록의 열쇠다**(REQ-GLB-14). tag_id가 ClickHouse의 모든 행에 박혀 있으므로 태그 쓰기의 계약은 "마스터를 어떻게 고치는가"가 아니라 **"과거 시계열의 해석을 어떻게 보존하는가"**로 읽는다. 웨이브 인계 두 건(스케일 변경 PATCH · 비활성 태그 요청)이 이 축에서 판정된다 — §인계 판정.

## 요구사항 — 사이트 · 라인 · 설비 · 접속 설정

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-MST-01** | 사이트 · 라인 목록 조회는 cache-aside로 캐시 계열 키를 거친다. TTL은 2계층 조정값(현행 참고 600초 · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). S2는 시드 최소분(설비 1대가 속할 사이트 · 라인 1개)만 두고 쓰기 표면은 S4에 연다 | 원본 architecture.md §10.1 · §11 · 원본 implementation_plan.md §5 S2 · S4 | 캐시 없이 매 화면 로드가 PostgreSQL을 치면 업무 CRUD 부하 측정(S7)에 목록 조회가 섞인다. S2에 쓰기 표면을 열면 수직 슬라이스가 두꺼워져 첫 기준선이 늦어진다(D-07) | 반복 목록 조회 시 PostgreSQL 쿼리 수(pg_stat_statements) 증가 0 · S2 커밋에서 쓰기 경로 부재 확인 | MST-01 | F-05 | common.postgres_unavailable/503 |
| **REQ-MST-02** | 설비 목록은 cache:devlist:{site_id}에 캐시하고 설비 쓰기 커밋 뒤 삭제한다. 설비는 물리 삭제하지 않고 is_active로 비활성화한다. 설비 목록 조회는 BFF 경유이며 BFF 서버 fetch 캐시가 한 번 더 흡수한다 | 원본 architecture.md §6 device.is_active · §8.2 · §2 BFF 경로 | 설비를 물리 삭제하면 그 설비의 tag_raw 행 device_id가 가리킬 마스터가 사라진다 | 설비 비활성화 후 tag_master · tag_raw 참조 행 보존 확인 · 쓰기 후 EXISTS cache:devlist:{site_id} 0 | MST-02 | F-05 | common.not_found/404 · common.postgres_unavailable/503 |
| **REQ-MST-03** | modbus_config는 설비와 1:1이며 host · port · unit_id · timeout_ms · retry_count · max_regs_per_request를 갖는다. **host가 컨테이너 루프백이면 그 설비는 시뮬레이션 설비**이고 Collector는 그 설비의 정상 값에 SIMULATED(9)를 단다. 접속 설정 변경은 커밋 뒤 ch:cacheinv에 cache:devlist:{site_id} 무효화 신호를 내고, Collector가 그 신호로 해당 설비를 다음 사이클 경계에 다시 읽어 반영한다 — 지울 사본이 없어도 신호는 낸다(W4 판정 · [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)) | 원본 architecture.md §6 · 원본 data_flow.md §3 · REQ-GLB-18 · [../02_features/03_collector.md](../02_features/03_collector.md) §모드 A의 SIMULATED 표지 판정 | host를 루프백에서 실장비 주소로 바꾸고 이력을 남기지 않으면 과거 행의 출처 복원(device_id → host)이 틀린다. 재기동 없이 반영된다고 믿으면 변경 직후 측정이 옛 설정으로 돈다 | host 루프백 설비의 적재 quality 분포 조회(정상 값 9) · 설정 변경 후 재기동 전후 폴링 대상 비교 | MST-03 | F-01 · F-05 | common.validation_failed/400 |

## 요구사항 — 태그 쓰기 · 논리 삭제 · 스케일 변경

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-MST-04** | 태그 쓰기는 Modbus 매핑(function_code · address · data_type · word_order) · 공학 단위(scale · offset_value · unit) · deadband · scan_rate_ms · range_min · range_max를 받는다. tag_code는 유일하며 중복은 common.duplicate_key/409, enum 허용값 밖 · 타입 불일치는 common.validation_failed/400이다. enum 값 집합의 정본은 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) | 원본 architecture.md §6 tag_master · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) common | word_order를 검증하지 않으면 잘못된 값이 예외 없이 엉뚱한 유한값으로 풀려 **범위 판정(BAD_RANGE)에서만** 드러난다 — 원인이 마스터라는 사실이 수집 쪽 품질 분포로 흩어진다 | 중복 tag_code · 허용값 밖 word_order 쓰기 주입 → 409 · 400 | MST-04 | F-05 | common.duplicate_key/409 · common.validation_failed/400 |
| **REQ-MST-05** | 태그 쓰기는 한 트랜잭션에서 tag_master 변경과 audit_log(before · after)를 함께 쓰고 함께 롤백한다. audit_log 테이블의 소유는 WRK이며 MST는 같은 트랜잭션에서 쓰기만 한다. 감사 대상 판정 기준의 정본은 [11_work_orders.md](./11_work_orders.md) REQ-WRK-07 | 원본 architecture.md §18 감사 · [../02_features/10_work_orders.md](../02_features/10_work_orders.md) WRK-04 | 감사를 트랜잭션 밖에서 쓰면 변경은 커밋되고 감사는 실패하는 창이 생겨 **감사 없는 마스터 변경**이 남는다 | 감사 INSERT 실패를 주입해 tag_master 변경도 롤백되는지 확인 · 변경 1건당 audit_log 1행 대조 | MST-04 · MST-05 · MST-06 | F-05 | common.postgres_unavailable/503 |
| **REQ-MST-06** | 태그는 물리 삭제하지 않고 is_active를 false로 바꾼다. tag_id는 시퀀스로만 발급하고 **영구 보존 · 재사용 금지**다. 태그 삭제 표면은 논리 삭제만 수행하며 DELETE 문을 실행하는 경로를 두지 않는다 | 원본 architecture.md §12 · REQ-GLB-14 | 물리 삭제하면 ClickHouse 과거 행이 고아 tag_id를 갖고, 시퀀스 대신 수동 번호를 쓰면 재사용된 번호가 과거 행에 다른 태그 이름을 붙인다 | 논리 삭제 후 tag_master 행 존재 · is_active false 조회 · api 계정의 tag_master DELETE 실행 이력 0 | MST-05 | F-05 | common.not_found/404 |
| **REQ-MST-07** | **기존 태그의 scale · offset_value를 바꾸는 PATCH는 거절한다** — 코드는 master.scale_change_forbidden/409다. 스케일 변경은 별도의 새 태그 발급 동작으로만 한다 — 한 트랜잭션에서 ① 새 tag_id 발급 ② 이전 태그 비활성화 ③ tag_master_history에 이전 · 새 tag_id와 변경 전후 값 기록 ④ audit_log 기록. 표면 모양은 [../07_api/04_master.md](../07_api/04_master.md)(W5) | 원본 architecture.md §12 · docs_plan 보정 #15 · 웨이브 인계(태그 스케일 변경 PATCH) · REQ-GLB-14 | PATCH가 조용히 기존 행을 고치면 **과거 값의 공학 단위 의미가 바뀐다.** PATCH가 서버에서 새 태그를 만들어 주면 응답의 식별자가 요청 경로의 식별자와 달라져, 옛 tag_id를 쥔 클라이언트 · 알람 규칙이 비활성 태그를 계속 가리킨다 | 스케일 PATCH 주입 → 거절 · tag_master 불변 · 새 태그 발급 후 tag_master_history 1행 · 이전 tag_id의 tag_raw 값 불변 대조 | MST-06 | F-05 | master.scale_change_forbidden/409 |
| **REQ-MST-08** | **비활성 태그는 조회에서 사라지지 않는다** — 식별자 조회는 200과 is_active false를 돌려주고 common.not_found/404는 마스터에 없는 식별자에만 쓴다. 비활성 태그는 Collector 폴링 대상에서 빠진다 — 실행 중 비활성화는 ch:cacheinv 신호로 다음 사이클부터 반영된다(W4). Dictionary는 is_active를 속성으로 싣고 비활성 태그도 적재한다(W3 판정) | 원본 architecture.md §7.4 · §12 · 웨이브 인계(비활성 태그 요청) · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) common.not_found | 비활성 태그를 404로 내면 트렌드 화면이 과거 구간의 태그 메타를 얻을 길이 없어, 논리 삭제가 지키려던 **과거 데이터의 해석**이 조회에서 끊긴다 | 비활성 태그 식별자 조회 → 200 · is_active false · 없는 식별자 → 404 | MST-05 · MST-09 | F-04 · F-05 | common.not_found/404 |

- **REQ-MST-08은 에러 코드를 새로 만들지 않는다.** 채번 보류 "비활성 태그 조회 · 수정 — 404인지 정상 응답인지"를 "존재하는 대상이므로 정상 응답"으로 닫는다. 비활성 태그의 **이름이 dictGet에서 사라지는 불일치**(dict_tag WHERE is_active)는 이 판정과 별개로 남는다 — §미확인 · 미설계 등재.

## 요구사항 — 캐시 무효화 체인 · Dictionary

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-MST-09** | 마스터 쓰기는 무효화 체인 6단을 건다 — ① 트랜잭션 커밋 ② Redis 캐시 삭제 ③ ch:cacheinv 발행 ④ SYSTEM RELOAD DICTIONARY plc.dict_tag(tag_master 쓰기만 · 응답 뒤) ⑤ BFF 서버 fetch 캐시 태그 무효화 ⑥ WebSocket 무효화 신호(RLT-09 중계). ②~⑥은 **커밋된 뒤에만** 건다. 단 번호의 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다(ADR-12). 캐시는 갱신하지 않고 **삭제**한다 | 원본 data_flow.md §7.1 · 원본 implementation_plan.md §7.4 · 기전 정본 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) | 커밋 전에 지우면 그 사이 다른 요청이 옛 값을 다시 채워 **TTL이 끝날 때까지 영구 오염**이다. 갱신하면 동시 쓰기의 순서 역전으로 낡은 값이 최종값으로 남는다. ④ · ⑤가 없으면 "무효화 후 즉시 반영" 검증(원본 data_flow.md §17)이 반드시 실패한다 | 태그명 수정 직후 API · BFF · 브라우저 세 층에서 새 이름이 보이기까지의 시간을 층별로 측정 · 무효화 호출이 커밋 로그 뒤에 찍히는지 대조 | MST-08 | F-05 · F-07 | 해당 없음 |
| **REQ-MST-10** | 무효화 체인의 Redis 삭제 실패는 요청을 실패시키지 않는다(캐시 계열 degrade — REQ-GLB-09). 실패는 캐시 삭제 실패 계수로 계측하고, 옛 사본은 TTL 만료까지 남는다. Dictionary 재적재 실패도 요청을 실패시키지 않으며 LIFETIME 자동 재적재로 수렴한다 | 원본 architecture.md §7.4 · §17 degrade 원칙 | 삭제 실패로 요청을 실패시키면 이미 커밋된 쓰기가 실패 응답을 받아 클라이언트가 **같은 쓰기를 재시도**하고 tag_code 중복 409를 맞는다 | Redis 중단 중 태그 쓰기 → 성공 응답 · 삭제 실패 계수 증가 · 복구 후 TTL 경과 시 새 값 확인 | MST-08 · MST-09 | F-05 · F-10 | 해당 없음 |
| **REQ-MST-11** | ClickHouse dict_tag는 PostgreSQL tag_master의 활성 행을 전용 읽기 계정으로 주기 적재한다. 적재 주기는 2계층 조정값(현행 참고 LIFETIME MIN 300 MAX 600 · 소유 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md)). **PostgreSQL이 멈춰도 Dictionary는 마지막 적재 값을 유지**해 시계열 조회가 계속된다 | 원본 architecture.md §7.4 · §17 PostgreSQL 중단 | 앱 계정으로 적재하면 Dictionary 소스가 쓰기 권한을 가진다. Dictionary가 PostgreSQL 장애에 함께 비면 업무 DB 하나의 장애가 시계열 조회 전체를 멈춘다 | docker stop postgres 중 dictGet 태그명 부착 조회 성공 · Dictionary 소스 계정의 권한 조회(SELECT만) | MST-09 | F-04 · F-08 | 해당 없음 |
| **REQ-MST-12** | ClickHouse 시계열 행에는 tag_id(4바이트)만 저장하고 태그명 · 단위 문자열을 싣지 않는다. 메타는 조회 시점에 dictGet으로 붙인다 — 두 DB를 트랜잭션으로 묶지 않는 원칙의 실행 자리다 | 원본 architecture.md §7.4 · §12 · REQ-GLB-14 | 태그명을 행에 복사하면 이름 변경이 **과거 행 수정**(ClickHouse mutation)이 되고, 두 DB 쓰기를 묶을 방법이 없어 한쪽만 바뀐 창이 생긴다 | tag_raw 컬럼 목록에 문자열 메타 컬럼 부재 조회 · 태그명 변경 후 과거 구간 조회 결과에 새 이름이 붙는지 확인 | MST-09 | F-04 | 해당 없음 |
| **REQ-MST-13** | 태그 메타 사본은 cache:tagmeta에 두고 TTL을 단다(현행 참고 600초 · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 단일 Hash인지 태그별 키인지 W3). 미스 · 축출 · Redis 불가면 PostgreSQL에서 읽어 채운다. 최신값은 담지 않는다 | 원본 architecture.md §5 · §8.2 · 원본 data_flow.md §3 · §5 | 축출을 오류로 다루면 maxmemory 하향 실험에서 Collector 기동과 최신값 메타 부착이 실패한다. 최신값을 담으면 봉인 계열 rt:latest와 캐시 계열이 같은 사실을 갖는다 | cache:tagmeta 삭제 후 Collector 기동 · 최신값 조회가 PostgreSQL 경유로 성립하는지 확인 | MST-07 | F-01 · F-03 | 해당 없음 |

## 요구사항 — 저장소 장애 · 권한

| ID | 요구 | 근거 | 위반 시 구체적 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-MST-14** | PostgreSQL에 접속할 수 없으면 마스터 읽기 · 쓰기는 common.postgres_unavailable/503으로 실패하고 **시계열 조회는 계속**된다(REQ-MST-11). 캐시에 사본이 있는 목록 조회는 사본으로 응답한다 | 원본 architecture.md §17 PostgreSQL 중단 | 시계열 조회까지 503을 내면 업무 DB 장애가 대시보드 장애로 번져 저장소 분리의 이점이 사라진다 | docker stop postgres — 태그 쓰기 503 · 시계열 조회 200 동시 확인 | MST-01 · MST-02 · MST-03 · MST-04 | F-04 · F-05 · F-10 | common.postgres_unavailable/503 |
| **REQ-MST-15** | 마스터 쓰기(MST-01~06)는 ADMIN만 한다. 조회는 인증 사용자 전원이다. 권한 밖 쓰기는 auth.forbidden/403이다. 판정 정본은 [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) | 권한 매트릭스 MST 행 · 원본 architecture.md §18 | 쓰기 주체가 둘이면 감사 로그의 행위자로 변경 책임을 읽을 수 없다. Modbus 접속 설정을 운영자가 바꾸면 SIMULATED 판정의 원천이 흔들린다 | OPERATOR · ENGINEER 계정의 쓰기 호출 → 403 · ADMIN → 성공 | MST-01 · MST-02 · MST-03 · MST-04 · MST-05 · MST-06 | F-05 | auth.forbidden/403 |

## 인계 판정

웨이브 인계 표 W2 · W2b 행에서 이 문서로 온 두 항목의 판정이다.

| 인계 항목 | 판정 | 근거 | 버린 대안의 실패 | 자리 |
|------|------|------|------|------|
| 태그 스케일 변경 PATCH — 거절인지 서버가 새 태그를 만드는지 | **거절한다.** 새 태그 발급은 별도 동작이다. 코드는 master.scale_change_forbidden/409(리드 채번 완료) | PATCH는 요청 경로의 자원을 고치는 동작이다. 스케일 변경의 결과는 다른 자원(새 tag_id)이므로 같은 동작으로 표현할 수 없다 | 서버 자동 발급 — 클라이언트 · 알람 규칙이 옛 tag_id를 쥔 채 남고, 응답 식별자 변화를 모르는 클라이언트가 비활성 태그에 계속 쓴다. 조용한 수정 — 과거 값의 의미가 바뀐다 | REQ-MST-07 |
| 비활성 태그 조회 · 수정 — 404인지 정상 응답인지 | **정상 응답(200 · is_active false).** 새 코드 없음 | 논리 삭제의 목적이 과거 데이터 해석 보존이다. 404는 "대상 없음"이며 비활성 태그는 존재한다 | 404 — 과거 구간 화면이 태그 메타를 얻지 못해 논리 삭제가 물리 삭제와 같은 결과가 된다 | REQ-MST-08 |

- 검산: 인계 항목 = **2** · 새 코드로 닫힘 **1**(스케일 변경 — master.scale_change_forbidden/409) · 새 코드 없음 **1**(비활성 태그)
- **판정 경계 — 비활성 태그의 "수정"은 일반 쓰기 규칙을 그대로 따른다.** 스케일 외 메타 수정은 REQ-MST-04 · 05가 적용되고, 스케일 변경은 활성 여부와 무관하게 REQ-MST-07로 거절된다. 비활성 태그를 다시 활성화하는 동작의 허용 여부는 표면 문제라 [../07_api/04_master.md](../07_api/04_master.md)(W5)가 정한다.

## 기능 → REQ 대응

[../02_features/02_master.md](../02_features/02_master.md) 기능 목록의 MST 기능 전부가 하나 이상의 REQ-MST에 대응하는지 검산한다.

| 기능 ID | 기능명 | 대응 REQ | 수 |
|------|------|------|------|
| MST-01 | 사이트 · 라인 관리 | REQ-MST-01 · 14 · 15 | 3 |
| MST-02 | 설비 관리 | REQ-MST-02 · 14 · 15 | 3 |
| MST-03 | Modbus 접속 설정 관리 | REQ-MST-03 · 14 · 15 | 3 |
| MST-04 | 태그 마스터 관리 | REQ-MST-04 · 05 · 14 · 15 | 4 |
| MST-05 | 태그 논리 삭제 | REQ-MST-05 · 06 · 08 · 15 | 4 |
| MST-06 | 스케일 변경 시 새 태그 발급 | REQ-MST-05 · 07 · 15 | 3 |
| MST-07 | 태그 메타 캐시 | REQ-MST-13 | 1 |
| MST-08 | 캐시 무효화 체인 | REQ-MST-09 · 10 | 2 |
| MST-09 | Dictionary 원천 제공 | REQ-MST-08 · 10 · 11 · 12 | 4 |

### 검산

- 기능 = MST-01~09 = **9** · 대응 없는 기능 **0**
- 대응 수 합(중복 허용) = 3 + 3 + 3 + 4 + 4 + 3 + 1 + 2 + 4 = **27**
- REQ-MST 채번 = 01~15 = **15** · 기능에 대응하지 않는 REQ **0**

## 에러 코드

| 코드 | 발생 REQ | 비고 |
|------|------|------|
| common.validation_failed/400 | REQ-MST-03 · 04 | enum 허용값 밖 · 타입 불일치 |
| common.not_found/404 | REQ-MST-02 · 06 · 08 | 마스터에 없는 식별자에만 — 비활성은 여기가 아니다 |
| common.duplicate_key/409 | REQ-MST-04 | tag_code 유일 제약 |
| common.postgres_unavailable/503 | REQ-MST-01 · 02 · 05 · 14 | 업무 CRUD만 실패 |
| auth.forbidden/403 | REQ-MST-15 | ADMIN 외 쓰기 |
| master.scale_change_forbidden/409 | REQ-MST-07 | 새 태그 발급 동작으로 다시 요청 — master 네임스페이스의 첫 코드 |

- 검산: 유효 코드 인용 = common 4 + auth 1 + master 1 = **6**행 · 채번 대기 **0**
- **무효화 체인 실패(REQ-MST-10)에는 코드가 없다.** 캐시 계열 degrade라 응답은 성공이며 드러나는 자리는 캐시 삭제 실패 계수 · ClickHouse 오류 메트릭이다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 비활성 태그 과거 행의 태그명 | **불일치** — dict_tag가 WHERE is_active로 적재해 비활성화 순간 과거 행에 dictGet이 이름을 붙이지 못한다. REQ-MST-08 · 12가 함께 요구하는 "과거 해석 보존"과 충돌한다 | [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md)(W3) |
| 새 태그 발급 표면 · 라인 · 사이트 · 접속 설정 쓰기 표면 | 원본 API 표에 tags(GET · POST · PATCH) · sites · devices(GET)만 있다 | [../07_api/04_master.md](../07_api/04_master.md)(W5) |
| 실행 중 마스터 변경의 Collector 반영 | **W4 판정** — ch:cacheinv 구독 · REQ-MST-03 · 08 반영 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md) |
| 비활성 태그를 가리키는 알람 규칙 | 판정을 멈추는지 규칙을 남기는지 없다 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| tag_master_history 컬럼 | REQ-MST-07이 기록 내용(이전 · 새 tag_id · 변경 전후 값)만 요구한다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |
| 캐시 삭제 실패 계수의 메트릭 이름 | **신규 미확인** — REQ-MST-10이 요구한다 | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)(W6) |
| 무효화 층별 반영 시간 | 3계층 미확인 — 미확인 · 확정 전 임의 값 고정 금지. 원본 예상치: Dictionary 최대 10분(③ 생략 시) · BFF 최대 30초 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)(W4) · EXP(W6 채번) |

## 관련 문서

- [../02_features/02_master.md](../02_features/02_master.md) — MST 기능 목록 · 무효화 체인
- [01_global_rules.md](./01_global_rules.md) — REQ-GLB-12 분기 ③계층 · REQ-GLB-14 불변 사실 기록
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — F-05 · 무효화 체인 기전
- [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) — Dictionary · tag_id 불변 · 스케일 변경
- [../07_api/04_master.md](../07_api/04_master.md) — sites · devices · tags 표면
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 에러 코드 채번 정본
