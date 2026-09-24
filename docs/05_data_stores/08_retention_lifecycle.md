# 보존과 수명 주기 (08_retention_lifecycle)

> **대상**: 데이터 단계별 보존 기간 · 기준 시점 · 삭제 방식 · 삭제 단위 · 실제 삭제 시점 · 복구 가능성 · 파티션 단위 변경 원칙 · 보존 변경 절차 · 대조군 보존 정합 — **보존 조정값의 정본**
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 미확인 2행 닫힘(대조군 파티션 정리 · DLQ 재처리 전 보존)
> **개정일**: 2026-09-24 — W6 판정 반영 — TTL 머지 주기(서버 기본값 유지 · 줄이지 않음) · alarm_event 아카이브 위치(snapshots/archive/alarm_event · 파티션당 덤프 1)를 닫는다 · 파티션 삭제 지연은 미확인 유지
> **원천**: 원본 data_flow.md §10.1 · §13 · §17(커밋 ff66a37) · 원본 architecture.md §5 · §6 · §7.1 · §7.2 · §7.3 · §15 · §17 · §18(커밋 ff66a37) · 원본 tech_stack.md §10.3(커밋 ff66a37) · [../README.md](../README.md) 고정 기준 조정값(보존의 정본 지정) · ADR-15 · D-05 · D-10

이 문서는 **보존 기간 값의 정본**이다. 보존은 2계층 조정값이라 다른 문서는 값을 박지 않고 이 문서를 인용한다. Redis 키 TTL의 정본은 [05_redis_keyspace.md](./05_redis_keyspace.md), Stream · DLQ MAXLEN의 정본은 [06_redis_memory.md](./06_redis_memory.md)이며, 이 문서는 그 둘을 단계 목록에 인용만 한다.

**보존 변경은 파티션 단위로만 한다.** ClickHouse의 행 단위 DELETE는 비동기 mutation이라 파트 전체를 다시 쓰고, PostgreSQL의 행 단위 DELETE는 VACUUM과 WAL을 부풀린다(원본 data_flow.md §13). 파티션 키를 날짜 · 월로 잡은 이유가 이 원칙이다. 그 대가로 **보존 기간은 하한**이다 — 파티션 전체가 만료돼야 지우므로 실제 삭제는 파티션 폭만큼 늦다(§실제 삭제 시점).

**원시를 7일만 두고도 장기 분석이 되는 이유가 롤업 계층이다.** 원본 예상치로 M 티어 원시 약 25 GB를 버려도 롤업 약 14 GB가 2년치 분석을 지원한다(원본 data_flow.md §10.1 — 3계층 미확인).

## 단계별 보존

아래 흐름은 한 측정값이 거치는 저장 단계와 각 단계를 떠나는 방식이다.

```plain
생성(DataGen · PLC) → 정규화(Collector) → Stream 버퍼 ─┬→ 원시 tag_raw ─→ 분 롤업 tag_1m ─→ 시간 롤업 tag_1h ─→ 일 롤업 tag_1d
                                          │           │ 7일 파티션 DROP   │ 90일            │ 730일             │ 무기한 · 수동
                                          │           └→ 대조군(SW-09 on · 실험 단위)
                                          ├→ DLQ(재시도 소진 · MAXLEN)
                                          ├→ 최신값 rt:latest(덮어쓰기)
                                          └→ 스풀 파일(XADD 실패 시 · 재발행 뒤 삭제)
```

- **분기 ②의 알람 쓰기는 별도 수명을 가진다.** alarm_eval은 30일, alarm_event는 월 파티션 2년 뒤 분리다 — 원시보다 오래 남는 판정 기록이 있다는 뜻이다.
- **Stream은 보존 단계가 아니라 통과 단계다.** 소비된 엔트리는 MAXLEN 범위에서 잘리고, 그 내용은 ClickHouse에 있다. Stream을 재처리 저장소로 쓰려면 Kafka 전환(확장 로드맵 4단계)이 필요하다.

| # | 단계 | 저장 위치 | 보존(현행 참고) | 기준 시점 | 삭제 방식 · 단위 | 복구 가능성 |
|:-:|------|------|------|------|------|------|
| 1 | 버퍼 | Redis stream:plc:raw | 소비 후 MAXLEN 범위 | 엔트리 순서 | 근사 트리밍 · 노드 | 불가 — 소비 완료분은 ClickHouse에 있다 |
| 2 | 실패 격리 | Redis stream:plc:dlq | MAXLEN 범위 | 엔트리 순서 | 근사 트리밍 | 불가 — 재처리 전 트리밍은 유실(한계 등재 #12) |
| 3 | 스풀 | spooldata 볼륨 .msgpack.spool | 재발행 완료까지 | 재발행 완료 | 파일 삭제 | 불가 — 재발행 전 삭제는 유실 |
| 4 | 원시 | ClickHouse tag_raw | **7일** | ts(측정 시각) | TTL · 일 파티션 통째 | 불가 — 필요하면 보존 연장 · 생성기로 재생성 |
| 5 | 분 롤업 | tag_1m | **90일** | bucket | TTL · 월 파티션 통째 | 원시가 남은 구간만 재계산 |
| 6 | 시간 롤업 | tag_1h | **730일** | bucket | TTL · 월 파티션 통째 | 분 롤업이 남은 구간만 재계산 |
| 7 | 일 롤업 | tag_1d | **무기한** | bucket | 수동 · 년 파티션 | 시간 롤업이 남은 구간만 재계산 |
| 8 | 판정 전수 | ClickHouse alarm_eval | **30일** | ts | TTL · 일 파티션 통째 | 불가 |
| 9 | 확정 알람 | PostgreSQL alarm_event | **2년 뒤 분리** | occurred_at | 파티션 DETACH → 덤프 아카이브 | 덤프 파일에서 |
| 10 | 감사 | PostgreSQL audit_log | **무기한** | acted_at | 없음 — 추가 전용 | 해당 없음 |
| 11 | 업무 · 마스터 · 계보 | PostgreSQL 업무 12 테이블 | 무기한 | 해당 없음 | 논리 삭제만 | 스냅샷(pg_dump)에서 |
| 12 | 대조군 | PostgreSQL plc_tag_raw_control | **tag_raw와 같은 기간** | ts | 일 파티션 DROP | 불가 — 실험 단위 재적재 |
| 13 | 최신값 | Redis rt:latest | 덮어쓰기 | 해당 없음 | 없음 | ClickHouse argMax로 재구성 |
| 14 | 캐시 · 세션 · 락 · 계수 | Redis cache · lock · rl · auth | 키별 TTL | 쓰기 시 | 만료 · volatile-lru 축출 | 재조회로 복원(auth는 재로그인) |

- 검산: 단계 = Redis 4(#1 · #2 · #13 · #14) + 볼륨 파일 1(#3) + ClickHouse 5(#4~#8) + PostgreSQL 4(#9~#12) = **14**
- **#11의 12 테이블** = 업무 14 − alarm_event(#9) − audit_log(#10) = 12(site · production_line · device · modbus_config · tag_master · tag_master_history · alarm_rule · user_account · role · user_role · work_order · production_log)
- **#10 audit_log를 무기한 · 비분할로 판정한다.** 행 증가가 사람의 쓰기 표면 호출 수에 묶여 작고(REQ-WRK-07 — 시스템 쓰기는 감사하지 않는다), 수정 · 삭제 표면이 없다(REQ-WRK-09). 분할이 필요해지는 증가율은 이 시스템에서 나오지 않는다 — 보존을 줄여야 하는 날이 오면 월 파티션 도입이 먼저다.

## 보존 조회 계약

보존은 2계층 조정값이다 — 값을 본문에 박지 않고 **어디서 읽는가 · 기준 시점 · 금지된 대체 동작 · 부재 시**로 쓴다. 이 표의 "현행 참고"가 값의 정본이다.

| 조정값 | 읽는 자리 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 |
|------|------|------|------|------|------|
| 원시 보존 | tag_raw TTL 절 | ts | ingested_at 기준 TTL · 행 단위 DELETE | 무기한 — 디스크 포화 | 7일 |
| 분 롤업 보존 | tag_1m TTL 절 | bucket | 행 단위 DELETE | 무기한 | 90일 |
| 시간 롤업 보존 | tag_1h TTL 절 | bucket | 상동 | 무기한 | 730일 |
| 일 롤업 보존 | 없음 — 수동 | 해당 없음 | TTL 추가 | 무기한(현행) | 무기한 |
| 판정 전수 보존 | alarm_eval TTL 절 | ts | 행 단위 DELETE | 무기한 | 30일 |
| 확정 알람 분리 | pg_partman 보존 설정 | occurred_at 월 | 행 단위 DELETE | 분리하지 않음 | 2년 |
| 대조군 보존 | 파티션 정리 작업 | ts 일 | tag_raw와 다른 기간 · 행 단위 DELETE | tag_raw와 행 집합이 어긋난다 | tag_raw와 같다 |

- 검산: 조정값 = **7**
- **ingested_at으로 보존을 자르지 않는다.** 백프레셔 소진이나 백필로 늦게 들어온 과거 ts 행이 "방금 들어온 행"으로 오래 남아 파티션(ts 기준)과 보존 경계가 어긋난다 — 전역 불변식 "ts와 ingested_at을 서로 대체하지 않는다".
- **부재 시 무기한이 기본값인 것이 위험이다.** TTL 절이 빠진 채 테이블이 만들어지면 오류 없이 디스크가 찬다 — 디스크 포화 시나리오의 대응은 TTL 축소 또는 파티션 수동 DROP이다(원본 architecture.md §17).

## 실제 삭제 시점

보존 기간은 하한이다. 파티션 단위 삭제(ClickHouse ttl_only_drop_parts · PostgreSQL 파티션 DROP)는 파티션의 **마지막 행**이 만료돼야 파티션을 지운다.

| 대상 | 파티션 폭 | 보존 | 실제로 지워지는 때 | 최대 초과 보존 |
|------|------|------|------|------|
| tag_raw | 일(KST) | 7일 | 파티션 날짜 D의 마지막 행이 7일을 지난 뒤 = D + 8일 00:00 KST 이후 TTL 머지 | 약 1일 + TTL 머지 주기 |
| alarm_eval | 일(KST) | 30일 | D + 31일 00:00 KST 이후 | 상동 |
| tag_1m | 월(KST) | 90일 | 그 달 마지막 버킷 + 90일 이후 | 약 1개월 |
| tag_1h | 월(KST) | 730일 | 그 달 마지막 버킷 + 730일 이후 | 약 1개월 |
| alarm_event | 월(KST) | 2년 | 분리 작업 주기에 맞춰 | 약 1개월 + 작업 주기 |
| 대조군 | 일(KST) | tag_raw와 같다 | 정리 작업 주기에 맞춰 | 작업 주기 |

- 검산: 대상 = **6**
- **"자정에 지워진다"를 말할 때 어느 자정인지 밝힌다.** 모든 파티션 경계가 KST라 원시와 롤업 · 판정 전수가 같은 달력으로 잘린다([04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §일 경계 시간대 판정). 서버 시간대에 의존하던 원본 구성에서는 tag_raw는 KST 날짜, tag_1m은 서버 시간대 월로 잘렸다([../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)).
- **TTL 삭제 검증은 "파티션 자동 DROP 확인"이다**(원본 data_flow.md §17 TTL 삭제). 검증 시점은 보존 + 파티션 폭 + 머지 주기 뒤여야 한다 — 보존 기간 직후에 확인하면 거짓 실패다.

## 파티션 단위 원칙

| 저장소 | 허용 | 금지 | 금지의 이유 |
|------|------|------|------|
| ClickHouse | TTL(ttl_only_drop_parts = 1) · ALTER TABLE … DROP PARTITION | ALTER TABLE … DELETE · 경량 DELETE | 비동기 mutation이 파트 전체를 다시 쓴다 — 삽입 부하와 머지 풀을 두고 경합한다 |
| ClickHouse | TTL 변경은 기존 파트 재구체화 없이(materialize_ttl_after_modify 끔) | 기본 설정으로 MODIFY TTL | 기본은 모든 기존 파트에 TTL을 다시 적용하는 mutation을 건다 — 보존 하나 바꾸는 데 테이블 전체를 다시 쓴다 |
| PostgreSQL | 파티션 DETACH · DROP(app_owner) | 행 단위 DELETE(app_rw에 권한 없음) | 대량 DELETE는 죽은 튜플 · WAL을 만들어 VACUUM이 따라온다 — 대조군이면 비교 축 VACUUM/WAL 증폭을 오염시킨다 |
| Redis | MAXLEN · TTL · 축출 | 수동 DEL로 Stream 비우기 | 미소비 엔트리가 조용히 사라진다 |

- 검산: 행 = **4** · 저장소 3(ClickHouse 2행)
- **MODIFY TTL의 기본 동작은 A형 함정이다.** 통념은 "TTL을 줄이면 오래된 파티션만 떨어진다"이다. 그러나 기본 설정의 MODIFY TTL은 모든 파트에 새 TTL을 구체화하는 mutation을 돌려 7일치 원시 전부를 다시 쓴다. 진짜 축은 "TTL 정의 변경"과 "기존 파트 재평가"가 별개라는 것이다. 대체 경로 — 재구체화를 끄고 바꾼 뒤, 새 경계 밖 파티션은 DROP PARTITION으로 직접 지운다.

## 보존 변경 절차

보존 값을 바꿀 때의 순서다. 한 단계라도 빠지면 대조군과 원시의 행 집합이 경계에서 어긋난다.

```plain
① 변경 사유 기록          디스크 · 실험 요구 · 용량 티어              측정 기록 조건 칸
② 스냅샷                  task snapshot — 되돌릴 자리                REQ-TEC-08
③ 정의 변경               TTL 절 · pg_partman 보존 · 정리 작업       재구체화 끔(ClickHouse)
④ 경계 밖 파티션 정리     DROP PARTITION · 파티션 DROP               원시 · 대조군은 같은 경계로
⑤ 검증                    남은 최소 파티션 = 새 경계 · count 대조      롤업은 원시가 지워진 구간의 유일 기록
```

- **원시와 대조군은 같은 변경 단위에서 바꾼다.** 한쪽만 바꾸면 두 저장소의 행 집합이 경계 구간에서 어긋나 대조 실험이 그 구간에서 무효가 된다(§대조군 보존 정합).
- **롤업 보존을 줄이기 전에 상위 롤업이 그 구간을 이미 가졌는지 본다.** tag_1m을 줄여도 tag_1h · tag_1d가 남으면 장기 추이는 유지된다 — 연쇄는 삽입 시점에 이미 상위를 채웠다.
- 보존 변경은 스키마 변경이 아니라 조정값 변경이다. 순번 마이그레이션으로 기록하되([09_migrations_seed.md](./09_migrations_seed.md)) 측정 기록의 조건 칸에 변경 사실을 적는다(D-10).

## 대조군 보존 정합

대조군의 목적은 **같은 행 집합**에 같은 쿼리를 돌리는 것이다(D-05). 보존은 그 전제를 깨는 가장 흔한 경로다.

| 어긋남 | 원인 | 결과 | 대응 |
|------|------|------|------|
| 삭제 시점 차 | tag_raw는 TTL 머지 시점 · 대조군은 정리 작업 주기 | 경계 파티션에서 한쪽만 행이 있다 | 대조 쿼리는 두 저장소 모두에 온전히 남은 구간만 쓴다 |
| 보존 기간 차 | 한쪽만 변경 | 경계 밖 구간 불일치 | §보존 변경 절차 ④ — 같은 경계로 |
| 백필 창 밖 ts | 모드 D가 원시 보존 창 밖을 채움 | tag_raw는 TTL 머지에서 곧 사라지고 대조군만 남는다 | 백필은 원시 보존 창 안으로([04_clickhouse_rollup.md](./04_clickhouse_rollup.md) §백필 절차) |
| 스냅샷 복원 뒤 | 두 저장소를 다른 시점으로 복원 | 행 집합이 다른 두 스냅샷 | 볼륨 스냅샷은 한 번에 함께 뜨고 함께 복원한다 |

- 검산: 어긋남 = **4**
- 대조 실험의 전제 확인 — 구간별 두 저장소 count 정확 일치(REQ-ING-15 · REQ-NFR-18)는 보존 경계에서 가장 자주 깨진다. 확인 절차의 정본은 [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md)다.

## 백업과 보존의 관계

**백업은 보존이 아니다.** 보존은 운영 중 데이터가 사는 기간이고, 백업은 실험 반복을 위한 되돌림 지점이다(원본 architecture.md §18 · 원본 tech_stack.md §10.3).

| 대상 | 백업 | 이유 |
|------|------|------|
| PostgreSQL | pg_dump를 로컬 snapshots/에 | 스키마 · 시드 보존이 목적 |
| ClickHouse 원시 | 하지 않는다 | 생성기로 재생성한다(시드 고정 · GEN-03) |
| Redis | 하지 않는다 | Stream은 재생 가능한 버퍼 · 캐시는 휘발 · 최신값은 ClickHouse에서 재구성 |
| 전체 볼륨 | 실험 전 task snapshot · 실험 후 task restore | 같은 조건의 재측정(D-10) |

- 검산: 대상 = **4**
- snapshots/는 git 추적 밖이다. 스냅샷과 마이그레이션 이력의 관계는 [09_migrations_seed.md](./09_migrations_seed.md)가 정한다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| TTL 머지 주기 · 파티션 삭제 지연 | **W6 판정** — 머지 주기는 서버 기본값 유지 · 줄이지 않는다 · 파티션 삭제 지연은 3계층 미확인 — 확정 전 임의 값 고정 금지 | [../09_tech_stack/03_data_infra.md](../09_tech_stack/03_data_infra.md) §TTL 머지 주기 |
| 대조군 파티션 정리 작업의 주기 · 실행 주체 | 닫힘 — GEN 실험 도구가 tag_raw에 실제로 남은 KST 일 파티션 목록 기준으로 DETACH · DROP · 대조 실험 착수 전과 SW-09 on 운전 중 매일 — [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) | [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) · [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md)(W4) |
| 분리된 alarm_event 파티션의 아카이브 위치 · 형식 | **W6 판정** — snapshots/archive/alarm_event/ · 파티션 하나당 덤프 파일 하나 · 파일 이름 = 파티션 이름(월) · Git 제외 | [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md) §스냅샷 · 아카이브 위치 |
| 티어별 정상 상태 디스크 | 원본 예상치(S 약 1 GB · M 약 39 GB · M+ 약 259 GB) — 3계층 미확인 | [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) |
| DLQ 재처리 전 보존 보장 | 닫힘 — 보장하지 않는다(한계 등재 #12 유지) · dlq_count와 DLQ 길이를 대조해 트리밍 전에 재처리하는 운영 절차 — [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md) | [../06_pipeline/11_backpressure_failure.md](../06_pipeline/11_backpressure_failure.md)(W4) |

## 관련 문서

- [03_clickhouse_schema.md](./03_clickhouse_schema.md) — tag_raw · alarm_eval TTL 절
- [04_clickhouse_rollup.md](./04_clickhouse_rollup.md) — 롤업 TTL · 백필 창
- [02_postgresql_constraints.md](./02_postgresql_constraints.md) — alarm_event 월 파티션 · 한계 등재
- [05_redis_keyspace.md](./05_redis_keyspace.md) — Redis 키 TTL 정본
- [06_redis_memory.md](./06_redis_memory.md) — MAXLEN 정본
- [10_olap_vs_rdb_control.md](./10_olap_vs_rdb_control.md) — 대조군 행 집합 정합
- [../04_architecture/07_capacity_planning.md](../04_architecture/07_capacity_planning.md) — 티어별 디스크
