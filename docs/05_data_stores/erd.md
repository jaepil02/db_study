# 전역 ERD (erd)

> **대상**: db_study 저장소 전역의 관계도 — PostgreSQL 업무 14 + 대조군 1의 erDiagram · ClickHouse 객체 9의 관계 · 저장소를 넘는 논리 참조
> **작성일**: 2026-09-24
> **원천**: 원본 architecture.md §6 · §7.1 · §7.2 · §7.3 · §7.4 · §8.1 · §12(커밋 ff66a37) · docs_plan.md 보정 #15(tag_master_history) · [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) · [03_clickhouse_schema.md](./03_clickhouse_schema.md) · [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) · [07_cross_store_consistency.md](./07_cross_store_consistency.md) · [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)

이 문서는 **그림의 자리**다. 컬럼 · 타입 · 제약의 정본은 [01_postgresql_schema.md](./01_postgresql_schema.md) · [02_postgresql_constraints.md](./02_postgresql_constraints.md) · [03_clickhouse_schema.md](./03_clickhouse_schema.md) · [04_clickhouse_rollup.md](./04_clickhouse_rollup.md)가 갖고, 이 문서는 관계만 그린다. 그림과 정본이 어긋나면 정본이 이긴다.

다이어그램 예산의 예외 문서다([../CLAUDE.md](../CLAUDE.md)) — mermaid를 셋 둔다. PostgreSQL은 FK가 있는 관계형이라 erDiagram으로, ClickHouse는 FK가 없고 삽입 연쇄 · 사전 적재가 관계라 flowchart로, 저장소를 넘는 참조는 FK로 표현할 수 없어 flowchart로 그린다.

## 표기 규약

| 표기 | 뜻 |
|------|------|
| 엔터티 이름 대문자 | PostgreSQL 테이블 — 실제 이름은 소문자 snake_case |
| PK · FK · UK | 기본 키 · 외래 키 · 유일 제약 |
| 속성 옆 따옴표 | 컬럼 제약 · 뜻의 요약 |
| \|\|--o{ | 하나 대 여럿(필수 → 선택) |
| \|o--o{ | 선택적 하나 대 여럿 — 참조 컬럼이 NULL 허용 |
| \|\|--\|\| | 하나 대 하나 |
| \|\|--o\| | 하나 대 선택적 하나 |
| 실선 화살표(flowchart) | 삽입이 발동하는 연쇄 · 적재 |
| 점선 화살표(flowchart) | 조회 시점 참조 · FK 없는 논리 참조 |

- 검산: 표기 = **9**

## PostgreSQL ERD

업무 14 테이블과 대조군 1이다. 대조군은 관계가 없다 — FK를 두지 않는 것이 설계다([10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)).

```mermaid
erDiagram
    SITE ||--o{ PRODUCTION_LINE : "보유"
    PRODUCTION_LINE ||--o{ DEVICE : "포함"
    DEVICE ||--|| MODBUS_CONFIG : "접속 설정"
    DEVICE ||--o{ TAG_MASTER : "정의"
    TAG_MASTER ||--o{ TAG_MASTER_HISTORY : "이전 태그"
    TAG_MASTER ||--o| TAG_MASTER_HISTORY : "새 태그"
    USER_ACCOUNT |o--o{ TAG_MASTER_HISTORY : "변경"
    TAG_MASTER ||--o{ ALARM_RULE : "감시 대상"
    ALARM_RULE ||--o{ ALARM_EVENT : "발생"
    USER_ACCOUNT |o--o{ ALARM_EVENT : "확인"
    USER_ACCOUNT ||--o{ USER_ROLE : "부여"
    ROLE ||--o{ USER_ROLE : "매핑"
    PRODUCTION_LINE ||--o{ WORK_ORDER : "배정"
    WORK_ORDER ||--o{ PRODUCTION_LOG : "실적"
    USER_ACCOUNT |o--o{ AUDIT_LOG : "행위"

    SITE {
        integer site_id PK
        text site_code UK
        text site_name
        text timezone "CHECK Asia/Seoul"
    }
    PRODUCTION_LINE {
        integer line_id PK
        integer site_id FK
        text line_code "UK with site_id"
        text line_name
    }
    DEVICE {
        integer device_id PK
        integer line_id FK
        text device_code UK
        text device_name
        text vendor
        text model
        boolean is_active
    }
    MODBUS_CONFIG {
        integer device_id PK, FK
        inet host "loopback = simulated"
        integer port
        smallint unit_id
        integer timeout_ms
        smallint retry_count
        smallint max_regs_per_request
    }
    TAG_MASTER {
        integer tag_id PK "identity · never reused"
        integer device_id FK "immutable"
        text tag_code UK
        text tag_name
        smallint function_code
        integer address
        text data_type
        text word_order "null for 16bit"
        numeric scale "immutable"
        numeric offset_value "immutable"
        text unit
        numeric deadband
        integer scan_rate_ms
        numeric range_min
        numeric range_max
        boolean is_active
    }
    TAG_MASTER_HISTORY {
        bigint history_id PK
        integer old_tag_id FK
        integer new_tag_id FK, UK
        numeric old_scale
        numeric old_offset_value
        numeric new_scale
        numeric new_offset_value
        timestamptz changed_at
        integer changed_by FK "nullable"
        text reason
    }
    ALARM_RULE {
        integer rule_id PK
        integer tag_id FK
        text condition_type "GT LT OUT_OF_RANGE RATE_OF_CHANGE"
        numeric threshold
        numeric threshold_low "OUT_OF_RANGE only"
        integer debounce_ms
        smallint severity "1 to 3"
        boolean enabled
    }
    ALARM_EVENT {
        bigint event_id PK
        timestamptz occurred_at PK "monthly partition key"
        integer rule_id FK
        timestamptz cleared_at
        float8 trigger_value
        text state "ACTIVE CLEARED"
        integer acked_by FK "nullable"
        timestamptz acked_at
    }
    USER_ACCOUNT {
        integer user_id PK
        text email UK
        text password_hash
        boolean is_active
    }
    ROLE {
        smallint role_id PK
        text role_code UK "OPERATOR ENGINEER ADMIN"
    }
    USER_ROLE {
        integer user_id PK, FK
        smallint role_id PK, FK
    }
    WORK_ORDER {
        bigint order_id PK
        integer line_id FK
        text order_no UK
        text product_code
        integer target_qty
        timestamptz planned_start
        timestamptz planned_end
        text status "PLANNED IN_PROGRESS COMPLETED CANCELLED"
    }
    PRODUCTION_LOG {
        bigint log_id PK
        bigint order_id FK
        timestamptz recorded_at
        integer good_qty
        integer defect_qty
    }
    AUDIT_LOG {
        bigint audit_id PK
        integer user_id FK "null = unauthenticated stage"
        timestamptz acted_at
        text action "INSERT UPDATE"
        text target_table
        text target_key
        jsonb before_value
        jsonb after_value
    }
    PLC_TAG_RAW_CONTROL {
        timestamptz ts "daily partition key"
        float8 value
        bigint scan_seq
        timestamptz ingested_at
        integer device_id "no FK"
        integer tag_id "no FK"
        smallint quality
    }
```

- **tag_master_history는 tag_master를 두 번 가리킨다.** 이전 태그(여럿이 될 수 있다 — 한 태그의 스케일을 여러 번 바꾸면 매번 새 태그가 이전 태그가 된다)와 새 태그(UNIQUE — 한 새 태그의 계보는 한 행)다.
- **alarm_event의 PK에 occurred_at이 들어간다.** 파티션 테이블의 PK는 파티션 키를 포함해야 한다 — 규칙당 열린 이벤트 하나를 DB가 강제할 수 없는 이유다(한계 등재 [02_postgresql_constraints.md](./02_postgresql_constraints.md) #9).
- **USER_ACCOUNT에서 나가는 선택적 관계 셋(|o--o{)은 NULL의 뜻이 다르다.** 확인(acked_by NULL = 미확인) · 감사(user_id NULL = 무인증 기간) · 계보(changed_by NULL = 무인증 기간)다.
- **PLC_TAG_RAW_CONTROL에 선이 없는 것은 누락이 아니다.** 대조군은 tag_raw와 동형인 실험 계측물이라 ClickHouse처럼 참조 검사를 하지 않는다.

### 관계 검산

| 관계 | FK 컬럼 | 카디널리티 | 소유 도메인 |
|------|------|------|------|
| 보유 · 포함 · 접속 설정 · 정의 | production_line.site_id · device.line_id · modbus_config.device_id · tag_master.device_id | 1:N · 1:N · 1:1 · 1:N | MST |
| 이전 태그 · 새 태그 · 변경 | tag_master_history.old_tag_id · new_tag_id · changed_by | 1:N · 1:0..1 · 0..1:N | MST |
| 감시 대상 · 발생 · 확인 | alarm_rule.tag_id · alarm_event.rule_id · alarm_event.acked_by | 1:N · 1:N · 0..1:N | ALM |
| 부여 · 매핑 | user_role.user_id · role_id | 1:N · 1:N | AUT |
| 배정 · 실적 · 행위 | work_order.line_id · production_log.order_id · audit_log.user_id | 1:N · 1:N · 0..1:N | WRK |

- 검산: 관계 = 4 + 3 + 3 + 2 + 3 = **15** = FK 전수([02_postgresql_constraints.md](./02_postgresql_constraints.md))
- 엔터티 = 업무 14 + 대조군 1 = **15** — 루트 고정 기준과 같다

## ClickHouse 객체 관계

ClickHouse에는 FK가 없다. 객체 사이의 관계는 **삽입이 발동하는 MV 연쇄**와 **Dictionary의 원천 적재**뿐이다.

```mermaid
flowchart LR
    PGTM["PostgreSQL tag_master<br/>전 행 · is_active 포함"]
    DICT["plc.dict_tag<br/>Dictionary · HASHED"]
    RAW["plc.tag_raw<br/>MergeTree · 일 파티션"]
    MV1["plc.mv_tag_1m"]
    T1["plc.tag_1m<br/>월 파티션 · 90일"]
    MV2["plc.mv_tag_1h"]
    T2["plc.tag_1h<br/>월 파티션 · 730일"]
    MV3["plc.mv_tag_1d<br/>KST 자정"]
    T3["plc.tag_1d<br/>년 파티션 · 무기한"]
    AE["plc.alarm_eval<br/>MergeTree · 일 파티션"]
    Q["조회 · dictGet"]

    PGTM -->|"SOURCE · LIFETIME · SYSTEM RELOAD"| DICT
    RAW -->|"삽입 블록"| MV1 --> T1
    T1 -->|"삽입 블록"| MV2 --> T2
    T2 -->|"삽입 블록"| MV3 --> T3
    DICT -.->|"tag_id → 이름 · 단위"| Q
    RAW -.-> Q
    T1 -.-> Q
    T2 -.-> Q
    T3 -.-> Q
    AE -.-> Q
```

- 검산: 객체 = 테이블 5(tag_raw · tag_1m · tag_1h · tag_1d · alarm_eval) + MV 3 + Dictionary 1 = **9** — 루트 고정 기준과 같다
- **alarm_eval은 연쇄에 없다.** 판정 경로(ALM)가 따로 쓰고 롤업이 붙지 않는다 — 판정 전수는 분석 로그라 집계 계층을 두지 않는다.
- **Dictionary는 행을 잇지 않는다.** dictGet은 조회 시점에 tag_id를 해석으로 바꿀 뿐이며, 시계열 행은 이름을 갖지 않는다(ADR-16).

## 저장소를 넘는 논리 참조

세 저장소의 키가 서로를 가리키는 자리다. 어느 선도 FK가 아니며, 끊어지는 조건과 드러나는 자리는 [07_cross_store_consistency.md](./07_cross_store_consistency.md) §교차 저장소 참조 전수가 정본이다.

```mermaid
flowchart LR
    subgraph PG["PostgreSQL"]
        TM["tag_master.tag_id · device_id"]
        AR["alarm_rule.rule_id"]
        AEV["alarm_event"]
        CTL["plc_tag_raw_control"]
    end
    subgraph CH["ClickHouse"]
        RAW["tag_raw · 롤업 3"]
        AE["alarm_eval"]
        DICT["dict_tag"]
    end
    subgraph RD["Redis"]
        RTL["rt:latest:{device_id}<br/>필드 tag_id"]
        AST["alarm:state:{rule_id}<br/>event_id"]
        TMC["cache:tagmeta:{tag_id}"]
    end

    RAW -.->|"tag_id · device_id"| TM
    AE -.->|"rule_id · tag_id"| AR
    CTL -.->|"tag_id · device_id · FK 없음"| TM
    AEV -.->|"trigger_value = 판정 행 value"| RAW
    RTL -.->|"휘발 사본 · 진실은 argMax"| RAW
    AST -.->|"event_id"| AEV
    TMC -.->|"사본"| TM
    TM -->|"적재"| DICT
```

- **점선은 전부 FK 없는 참조다.** 시계열 · 대조군 → PostgreSQL 마스터 3(RAW · AE · CTL) + 확정 이벤트 → 원시 1(AEV) + Redis → 원천 3(RTL · AST · TMC). 실선 하나(tag_master → dict_tag)는 주기 적재다.
- 검산: 논리 참조 = 점선 3 + 1 + 3 = 7 + 적재 실선 1 = **8**
- **AST → AEV는 사본 관계가 아니다.** 핫 상태가 확정 이벤트의 번호를 들고 있을 뿐이며, 알람 세 쓰기가 같은 사실의 사본이 아니라는 판정은 [07_cross_store_consistency.md](./07_cross_store_consistency.md) §불일치 시 진실이 정한다.
- **Redis 키 전수는 이 그림에 없다.** 저장소를 넘는 참조를 가진 키만 그렸다 — 키 패턴 전수와 봉인 표의 정본은 [05_redis_keyspace.md](./05_redis_keyspace.md)다.

## 관련 문서

- [01_postgresql_schema.md](./01_postgresql_schema.md) — PostgreSQL 컬럼 정본
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — FK · 제약 · 한계 등재
- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — ClickHouse 객체 목록 · DDL
- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — MV 연쇄
- [05_redis_keyspace.md](./05_redis_keyspace.md) — Redis 키 패턴 정본
- [07_cross_store_consistency.md](./07_cross_store_consistency.md) — 교차 저장소 참조 · 진실의 자리
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 명세
