# MST — 마스터 데이터 기능 명세

> **대상**: 마스터 데이터(MST · NestJS master 모듈) 기능 목록 · 기능별 경계 · 의존 도메인 · 실패 시 보이는 것 — 기능 ID MST-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W2 요구사항 판정 반영 — 스케일 변경 PATCH(scale_change_forbidden/409) · 비활성 태그(코드 없음)의 채번 보류를 닫는다
> **원천**: 원본 architecture.md §5 · §6 · §7.4 · §8.2 · §10.1 · §11 · §12(커밋 ff66a37) · 원본 data_flow.md §3 · §5 · §7 · §7.1 · §17(커밋 ff66a37) · 원본 implementation_plan.md §5 S2 · S4 · S7 · §7.4(커밋 ff66a37) · 저장소 루트 docs_plan.md 보정 #15 · D-04 · D-11 · [../01_overview/04_domain_map.md](../01_overview/04_domain_map.md)

MST는 **시스템 전체의 메타 원천**이다. 사이트 · 라인 · 설비 · Modbus 접속 설정 · 태그 마스터를 PostgreSQL에 두고, 그 사본이 Redis 캐시(cache:tagmeta · cache:devlist)와 ClickHouse Dictionary(dict_tag)로 흩어진다. 마스터 한 번의 저장이 네 저장소 층을 건드리므로 **무효화 체인이 이 도메인의 핵심 기능**이다(원본 data_flow.md §7.1).

**마스터는 업무 데이터 축의 예외다.** 원본은 업무 CRUD를 S7 후순위로 두면서 마스터만 S2 최소 · S4 완성으로 앞당겼다 — Collector가 태그 정의 없이 동작하지 않고, 태그 마스터 변경 → Redis 삭제 → Dictionary 재적재가 폴리글랏 연계의 핵심 학습 지점이기 때문이다(원본 implementation_plan.md §5 S7 · D-11). 분기 계층으로는 **③ PostgreSQL 전용**이며 Stream을 타지 않는다(D-04).

## 기능 목록

기능 ID는 이 표가 유일한 채번 자리다. 단계는 학습 단계(정본 [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md))이고, 표면은 [../07_api](../07_api/README.md)의 문서명이다(표면 번호는 W5 몫).

| 기능 ID | 기능명 | 설명 | 단계 | 흐름 | 스위치 | 표면 | 저장소 |
|------|------|------|------|------|------|------|------|
| **MST-01** | 사이트 · 라인 관리 | 사이트 목록을 조회하고(캐시 현행 600초) 사이트 · 라인을 등록 · 수정한다. S2는 시드 최소분(설비 1대가 속할 사이트 · 라인 1개)이다. **라인 쓰기 표면은 원본 API 표에 없다** — S4 마스터 CRUD 범위(site · line · device · tag)에서 파생했다 | S2(시드) · S4 | F-05 | 해당 없음 | 07_api/04_master | PostgreSQL site · production_line · Redis cache 계열 |
| **MST-02** | 설비 관리 | 설비 목록을 조회하고(cache:devlist:{site_id} · 현행 600초) 설비를 등록 · 수정 · 비활성화한다. BFF를 거친다 — 저빈도라 Next.js 서버 fetch 캐시가 한 번 더 흡수한다 | S2(시드) · S4 | F-05 | 해당 없음 | 07_api/04_master | PostgreSQL device · Redis cache:devlist |
| **MST-03** | Modbus 접속 설정 관리 | 설비 1:1의 modbus_config(host · port · unit_id · timeout_ms · retry_count · max_regs_per_request)를 관리한다. Collector가 기동 시 읽는다(COL-01). **host가 컨테이너 루프백이면 그 설비는 시뮬레이션 설비**이며 모드 A의 SIMULATED 표지가 이 값에서 나온다([03_collector.md](./03_collector.md) §모드 A의 SIMULATED 표지 판정) | S2(시드) · S4 | F-01 · F-05 | 해당 없음 | 07_api/04_master | PostgreSQL modbus_config |
| **MST-04** | 태그 마스터 관리 | 태그를 조회 · 등록 · 수정한다. Modbus 매핑(function_code · address · data_type · word_order) · 공학 단위(scale · offset_value · unit) · deadband · scan_rate_ms · 범위(range_min · range_max)를 갖는다. tag_code는 유일하다. 쓰기는 한 트랜잭션에서 태그 변경과 **감사 로그 before · after를 함께** 쓰고(WRK-04), 커밋 뒤에만 MST-08을 부른다 | S2(시드) · S4 | F-05 | 해당 없음 | 07_api/04_master | PostgreSQL tag_master · audit_log(WRK 소유) |
| **MST-05** | 태그 논리 삭제 | 태그를 물리 삭제하지 않고 is_active를 false로 바꾼다. tag_id는 시퀀스로만 발급하고 **영구 보존 · 재사용 금지**다 — 물리 삭제하면 ClickHouse의 과거 행이 고아 tag_id를 갖고, 재사용하면 과거 행이 다른 태그의 이름을 얻는다(원본 architecture.md §12) | S4 | F-05 | 해당 없음 | 07_api/04_master | PostgreSQL tag_master |
| **MST-06** | 스케일 변경 시 새 태그 발급 | scale · offset_value가 바뀌면 기존 태그를 고치지 않고 **새 tag_id를 발급**하고 이전 태그를 비활성화하며 tag_master_history에 이력을 남긴다. 기존 행을 고치면 과거 값의 공학 단위 의미가 조용히 바뀐다 — 시계열은 불변 사실 기록이다(전역 불변식). 기존 태그 PATCH가 스케일을 바꾸려 할 때의 응답은 채번 보류 | S4 | F-05 | 해당 없음 | 07_api/04_master | PostgreSQL tag_master · tag_master_history |
| **MST-07** | 태그 메타 캐시 | 태그 메타 사본을 cache:tagmeta에 둔다(현행 600초). Collector가 기동 시 한 번 읽고(COL-01), 최신값 응답이 태그명 · 단위를 붙일 때 읽는다(RLT-03). 미스면 PostgreSQL에서 읽어 채운다. **캐시 계열이라 축출될 수 있다** — 축출돼도 PostgreSQL 우회로 동작한다 | S2 | F-01 · F-03 | 해당 없음 | 표면 없음 — 다른 기능의 내부 조회 | Redis cache:tagmeta |
| **MST-08** | 캐시 무효화 체인 | 마스터 쓰기가 커밋된 **뒤에만** ① Redis 캐시 삭제 ② ch:cacheinv 발행 ③ SYSTEM RELOAD DICTIONARY plc.dict_tag ④ BFF 서버 fetch 캐시 태그 무효화 ⑤ 브라우저 쿼리 캐시 무효화 신호를 순서대로 건다. 갱신이 아니라 **삭제**다 — 동시 갱신에서 쓰기 순서가 뒤집히면 낡은 값이 최종값으로 남는다. ④ · ⑤는 원본 보정 7.4가 더한 단이다 | S4 | F-05 | 해당 없음 | 표면 없음 — 쓰기 표면의 후처리 | Redis cache 계열 · ch:cacheinv · ClickHouse dict_tag |
| **MST-09** | Dictionary 원천 제공 | ClickHouse dict_tag가 PostgreSQL tag_master의 활성 행을 주기 적재한다(LIFETIME 현행 300~600초 · 전용 읽기 계정). ClickHouse에는 tag_id(4바이트)만 저장하고 태그명 · 단위는 조회 시점에 dictGet으로 붙인다 — 두 DB를 트랜잭션으로 묶지 않는 원칙의 실행 자리다. **PostgreSQL이 멈춰도 Dictionary는 마지막 적재 값을 유지**해 시계열 조회가 계속된다 | S3 | F-04 · F-08 | 해당 없음 | 표면 없음 — TSQ-07이 소비 | PostgreSQL tag_master · ClickHouse dict_tag |

- 검산: MST-01 · 02 · 03 · 04 · 05 · 06 · 07 · 08 · 09 = **9**. 단계별(첫 도입 기준) S2 5(MST-01 · 02 · 03 · 04 · 07) + S3 1(MST-09) + S4 3(MST-05 · 06 · 08) = **9**
- **MST는 스위치가 없다.** 무효화 체인은 정합성 계약이라 끈 상태를 측정 조건으로 둘 이유가 없다. 체인의 비용은 스위치가 아니라 층별 반영 시점으로 잰다.
- **MST-07 · 08 · 09는 표면이 없는 기능이다.** 다른 기능이 부르거나 쓰기 표면의 후처리로 돈다 — 추적성 표에는 "내부 모듈"로 적는다.

## 무효화 체인

MST-08의 순서다. 체인 확장의 기전 정본은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)다.

```plain
BEGIN → UPDATE tag_master → INSERT audit_log(before · after) → COMMIT
  → ① DEL cache:tagmeta · cache:devlist              (Redis 사본)
    → ② PUBLISH ch:cacheinv                         (다른 api 인스턴스의 로컬 캐시)
      → ③ SYSTEM RELOAD DICTIONARY plc.dict_tag      (ClickHouse dictGet)
        → ④ BFF 서버 fetch 캐시 태그 무효화           (Next.js — 보정 7.4)
          → ⑤ WebSocket 무효화 신호 → 브라우저 쿼리 캐시 (RLT-09 중계 — 보정 7.4)
```

- **커밋 전에 지우면 영구 오염이다.** 삭제와 커밋 사이에 다른 요청이 옛 값을 읽어 캐시를 다시 채우고, 그 뒤 커밋이 되면 캐시에는 TTL이 끝날 때까지 낡은 값이 남는다.
- **③을 생략하면 LIFETIME만큼 옛 이름이 보인다.** 원본 기준 최대 10분이다(현행 LIFETIME 상한 참고).
- **④ · ⑤가 없으면 "무효화 후 즉시 반영" 검증은 반드시 실패한다.** 원본 검증 체크리스트(원본 data_flow.md §17)가 합격 기준으로 적었지만 BFF 캐시와 브라우저 staleTime만큼 늦는다(원본 implementation_plan.md §7.4).
- ②의 구독자는 현재 api 인스턴스 1개뿐이라 효과가 없다. 확장 로드맵 2단계에서 인스턴스가 늘 때 코드 변경 없이 동작하도록 경계를 미리 둔다.

## 기능별 경계

| 기능 ID | 하지 않는 일 | 그 일의 주인 |
|------|------|------|
| MST-01 · 02 | 설비의 수집 상태(연결 · 폴링 성공)를 저장하지 않는다 | 수집 메트릭 [11_metrics.md](./11_metrics.md) · STALE 판정 RLT-03 |
| MST-03 | Modbus 연결을 열지 않는다 · 시뮬레이터 포트를 띄우지 않는다 | COL-02 · SIM-01 |
| MST-04 | 레지스터 디코딩을 하지 않는다 — 규칙을 저장할 뿐이다 | COL-04 |
| MST-04 | **감사 로그 테이블을 소유하지 않는다** — 같은 트랜잭션에서 쓸 뿐이다 | WRK-04 · 한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) |
| MST-05 | ClickHouse의 과거 행을 지우거나 고치지 않는다 | 보존 TTL [../05_data_stores/08_retention_lifecycle.md](../05_data_stores/08_retention_lifecycle.md) |
| MST-06 | 과거 값을 새 스케일로 재계산하지 않는다 | 해당 없음 — 불변 사실 기록 |
| MST-07 | 최신값을 캐시하지 않는다 — 태그 **메타**만 담는다 | ING-08(rt:latest) |
| MST-08 | 시계열 조회 결과 캐시(cache:q)를 지우지 않는다 — 과거 구간은 불변이라 TTL 만료만 쓴다 | TSQ-04 |
| MST-09 | Dictionary 정의(DDL)를 소유하지 않는다 | [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) · [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) |

## 의존 도메인

| 도메인 | 방향 | 경계 유형 | 내용 |
|------|------|------|------|
| COL | MST → COL | 저장소 경유 | 태그 정의 · 접속 설정을 Collector가 기동 시 읽는다. 마스터를 바꿔도 **Collector 재기동 전까지 폴링 대상은 그대로다**(원본에 재적재 신호 없음 — §미확인 · 미설계 등재) |
| TSQ | MST → TSQ | 저장소 경유 | dict_tag로 태그명 · 단위를 붙인다 |
| RLT | MST → RLT | 저장소 경유 | cache:tagmeta로 최신값에 메타를 붙인다 |
| WRK | MST → WRK | 트랜잭션 공유 | 마스터 쓰기가 같은 트랜잭션에서 audit_log에 쓴다. 테이블 소유는 WRK다 |
| ALM | MST → ALM | 저장소 경유 | alarm_rule이 tag_id를 참조한다. 비활성 태그의 규칙 처리는 미정이다 |
| AUT | AUT → MST | 인가 | 쓰기는 관리자 역할만 한다([12_permission_matrix.md](./12_permission_matrix.md)) |

## 실패 시 보이는 것

에러 코드는 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)의 유효 코드만 인용한다.

| 상황 | 드러나는 형태 | 코드 또는 지표 | 기능 |
|------|------|------|------|
| tag_code 중복 등록 | 쓰기 거절 | common.duplicate_key/409 | MST-04 |
| 없는 설비 · 태그 식별자 | 조회 · 쓰기 거절 | common.not_found/404 | MST-02 · 04 |
| 형식 위반(data_type · word_order가 허용값 밖 등) | 쓰기 거절 | common.validation_failed/400 | MST-03 · 04 |
| PostgreSQL 접속 불가 | 업무 CRUD만 실패 · **시계열 조회는 계속**(Dictionary가 마지막 값 유지) | common.postgres_unavailable/503 | MST-01~06 |
| 기존 태그 PATCH로 스케일 변경 | **master.scale_change_forbidden/409** — 거절하고 새 태그 발급은 별도 동작 | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-07 | MST-06 |
| 비활성 태그 조회 · 수정 | 코드 없음 — 200 + is_active false · 404는 마스터에 없는 식별자만 | [../03_requirements/03_master.md](../03_requirements/03_master.md) REQ-MST-08 | MST-05 |
| 캐시 삭제 실패(Redis 일시 불가) | 코드 없음 — 캐시 계열은 조용히 degrade한다. **TTL이 끝날 때까지 옛 사본이 남는다** | 캐시 히트율 · Redis 오류 메트릭 | MST-08 |
| Dictionary 재적재 실패 | 코드 없음 — LIFETIME 자동 재적재까지 옛 이름 | ClickHouse 오류 메트릭 | MST-08 · 09 |

- **B형 — 관리자 저장 직후 트렌드 화면의 태그명이 잠시 옛값이다.** 결함이 아니라 체인 밖 캐시 층(BFF · 브라우저)의 흔적이거나 Dictionary 재적재가 아직 끝나지 않은 것이다. 체인을 커밋 전으로 당기면 이 지연은 사라지는 대신 옛 값이 **영구히** 남는다 — 층별 반영 시점은 [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md)에서 읽는다.

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.4 무효화 체인에서 BFF와 브라우저가 빠짐 — 원본 implementation_plan.md §7.4 | MST-08에 ④ BFF 태그 무효화 · ⑤ 브라우저 쿼리 캐시 무효화를 더했다. ⑤의 중계는 RLT-09 | [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) · ADR [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) |
| 태그 변경 이력 테이블 부재 — docs_plan 보정 #15 | MST-06이 tag_master_history에 이력을 쓴다 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) |
| 보정 7.5 TTL 강제 수단 | cache:tagmeta · cache:devlist 쓰기는 TTL 필수 래퍼로만 한다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 보정 7.1~7.3 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 비활성 태그의 과거 행 태그명 | dict_tag 적재 쿼리가 WHERE is_active다(원본 architecture.md §7.4) · 태그는 논리 삭제한다(원본 architecture.md §12) | **불일치** — 비활성화 순간 그 태그의 과거 행에 dictGet이 이름을 붙이지 못한다. 논리 삭제가 지키려던 "과거 데이터의 해석"이 조회에서 빠진다 | [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md)(W3) |
| 라인 · 사이트 쓰기 · 접속 설정 쓰기 표면 | API 표에 sites(GET) · devices(GET) · tags(GET · POST · PATCH)만 있다(원본 architecture.md §11) | **표면 미설계** — S4 CRUD 범위와 어긋난다 | [../07_api/04_master.md](../07_api/04_master.md)(W5) |
| 마스터 변경의 Collector 반영 | Collector는 기동 시 1회 로드한다(원본 data_flow.md §3) | **미확인** — 태그 추가 · 비활성화가 재기동 없이 폴링 대상에 반영되는 경로가 없다 | [../06_pipeline/02_collect.md](../06_pipeline/02_collect.md)(W4) |
| 비활성 태그를 가리키는 알람 규칙 | alarm_rule.tag_id FK(원본 architecture.md §6) | 미확인 — 판정을 멈추는지 규칙을 남기는지 없음 | [../06_pipeline/08_alarm.md](../06_pipeline/08_alarm.md)(W4) |
| cache:tagmeta 모양 | 단일 Hash(원본 data_flow.md §3 · §5) vs 태그별 키(원본 architecture.md §8.2) | W1 등재 불일치 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)(W3) |
| site.timezone 용도 | 컬럼만 있다 | W1 등재 — 표시 시간대는 Asia/Seoul 고정 | [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)(W3) |

## 관련 문서

- [../03_requirements/03_master.md](../03_requirements/03_master.md) — REQ-MST 동작 계약
- [../07_api/04_master.md](../07_api/04_master.md) — sites · devices · tags 표면
- [../06_pipeline/07_business_crud.md](../06_pipeline/07_business_crud.md) — F-05 · 무효화 체인 기전
- [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) — Dictionary · tag_id 불변 · 스케일 변경
- [10_work_orders.md](./10_work_orders.md) — audit_log 소유
- [03_collector.md](./03_collector.md) — 태그 정의의 소비자
- [12_permission_matrix.md](./12_permission_matrix.md) — 마스터 쓰기 권한
