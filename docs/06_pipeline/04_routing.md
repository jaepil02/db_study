# 두 갈래 분기 기전 (04_routing)

> **대상**: ★★ 학습 목표 ②의 기전 정본 — 어느 모듈이 어떤 판정으로 어느 저장소에 쓰는가 · 분기 판정 트리 · ① 원시값 · **③ 업무 쓰기의 명령 스트림 경로(stream:biz:cmd → 워커 grp:biz-writer · 수집 스트림과 분리)** · 사본 쓰기(최신값 SW-11 · 캐시) · **대조군 동시 적재 기전(SW-09 · COPY 1회 · 재시도 없음)** · 모듈 × 저장소 쓰기 행렬 · 분기 계측 · 스위치별 경로 변화 · 정책 문서와의 1:1 대응 검산
> **작성일**: 2026-09-24
> **개정일**: 2026-10-12 — **D-05 부분 개정 · ADR-32**(직접 비교 비교 사본 TimescaleDB hypertable · 열 압축 · 마이그레이션 009) — 구간 count 대조 ① 두 저장소의 파티션 경계 → **일 경계(ClickHouse 일 파티션 · PostgreSQL hypertable 일 칸)** · ⑤ 수리 그 일 파티션 → **그날 칸** · 쓰기 행렬 GEN PostgreSQL 칸 비교 사본 함수 구간 준비 · 비우기 · 지우기 → **구간 비우기 · 구간 압축 · 지우기**(control_prepare_range 삭제 · control_compress_range 신설) · GEN 불릿에 구간 압축 — 계약 · 대조 · 모듈 · 정책 대응 수 불변
> **개정일**: 2026-10-11 — 정책 1:1 대응 검산에 **#23 · #24 · #25** 기전 자리(GEN 종결 INSERT · RLT 표면 · 수집기 역할 · GEN 실행 게이트 SET · ING flusher 읽기) — 현행 정책 행 12 → **15** · 대응 묶음 21 → **24**
> **개정일**: 2026-10-11 — **D-16 SW-09 gated · 비교 사본 키 규칙**(사용자 결정 2026-10-11 · ADR-28 · 마이그레이션 007) — §대조군 동시 적재 기전 ③ SW-09 on일 때만 → **on · gated의 게이트 열림(cache:dual:active)** · **§gated 게이트 판정 신설**(읽기 캐시 500 ms · 동시 판정 하나 · 실패 10초 · 닫힘이면 요약 없음) · 기본 off 불릿 → gated · 크래시 재전달 중복은 기본 키가 막는다 · 쓰기 행렬 GEN 칸에 직접 비교 발행 · cache:dual:active · run_result · RLT 칸에 ctl:plant:power · PostgreSQL에 쓰는 모듈 2 → **3**(GEN — run_result) · 스위치별 경로 SW-09 on → **on · gated** — 스위치 수 불변
> **개정일**: 2026-10-11 — **D-16 알람 · 로그인 · 권한 · 감사 · 작업지시 · 측정 도구 삭제**(사용자 결정 2026-10-11 · 리드 판정 — WRK 함께 폐지) — **②계층(알람 판정 · 생산 카운터) 폐지 — 분기 두 갈래(① · ③ · 번호 재배치 없음)** · H1 3계층 → 두 갈래 · 분기 판정 트리 재작성(회원 · 작업지시 · 실적 · 규칙 · 감사 행 · ACK 가지 · ② 판정 가지 삭제) · §② 알람 판정 — 세 쓰기 · §생산 카운터 기전 판정 삭제 · ③ 보장 표의 감사 쓰기 · work_orders 코드 · REQ-WRK 인용 삭제 · 사본 행의 alarmrules · perm · alarmevents · workorders 삭제 · 모듈 × 저장소 행렬 11 → **8**행(ALM · WRK · AUT 삭제 · GEN 모드 C · D 쓰기 삭제) · biz_command_log 소유 WRK → **명령 기전(도메인 밖 공통 경로)** · 분기 계측 대조 5 → **4** · 정책 대응 22 → **12**행(결번 10) · 대응 묶음 35 → **21**행 · 대조군 절차의 판정 인계 · 모드 D 불릿 삭제 · D-16 정리(d4) — 지운 절을 가리키던 § 참조 교정(§스트리밍 동시 적재 — EXP-45 한계 불릿 → §역방향 대조표 — EXP-40~45) · D-16 정리(d4 전역 sweep) — 폐지 실험을 확정 수단으로 가리키던 자리 교정(EXP-46)
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27 · r-utc 검수 M2) — 구간 count 대조 ① 분할 단위 KST 일 파티션 → **UTC 일 파티션**(두 저장소 파티션 경계 UTC) — 기록 045의 KST 일 count 사실은 불변
> **개정일**: 2026-09-28 — 웨이브 1 검증 반영(v-wave1 L2) — 분기 트리 업무 행 한정 "회원 · 권한은 표면 없음" · 쓰는 도메인에서 AUT 제외(명령 경로 대상 아님)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(B-L4 · B-M4) — 정책 대응 #1 사용자 · 권한에 **회원 · 권한 쓰기는 표면이 없다(시드 · 수동 변경뿐 · 표면이 생기면 같은 기전)** 한정 · 분기 계측 ③ 업무 명령 식 "명령 수 = 원장 행 수 + PostgreSQL 불가 결과 수" → **워커 종결 수(applied · rejected · expired · failed) = 원장 행 증가 + failed + 중복 · api 쪽 timeout · unavailable 제외** — 대조 · 대응 행 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27 · D-04 · REQ-GLB-12 개정) — 분기 판정 트리 윗가지 "Stream 경로 없음" → **명령 스트림(stream:biz:cmd → 워커 grp:biz-writer · SW-12 direct면 api 직접)** · §③ 업무 쓰기 — 갈라지지 않는 경로 → **§③ 업무 쓰기 — 명령 스트림 경로**(보장 4행 유지 · 기전 교체) · 사본 행 6 → **7**(biz:result) · 분기 계측 대조 4 → **5**(업무 명령) · 경로를 바꾸는 스위치 7 → **8**(SW-12) · 합 11 → **12** · 정책 대응 #21 · #22 — 20 → **22** · 대응 묶음 32 → **35**행
> **개정일**: 2026-09-27 — W6 결과 반영(기록 045) — §대조군 동시 적재 기전에 실측 불릿 2 — 배치 안 A에서 ③이 XACK를 늦추는 폭(배치당 COPY p50 12.51~65.0 ms · 타임아웃 넘은 계단 없음 · 관계 COPY 타임아웃 + 삽입 p95 < W 관측 범위 안 성립) · 창 경계의 ②와 ③ 사이 배치 하나 관측 — 계약 수 불변
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 정책 대응 표에 #20 업무 대조 테이블(계측물 · 기전 자리 05_data_stores/10 §역방향 대조) — 정책 행 = 기전 자리 19 → **20** · 계측물 1 → **2** · 대응 묶음 31 → **32**행
> **개정일**: 2026-09-25 — S3 구현 반영 — 대조군 COPY 타임아웃 현행 미정 → **창 폭 W ÷ 2**(배치 안 A 500 ms · 관계 COPY 타임아웃 + 삽입 p95 < W)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — COUNTER 랩어라운드 행에 W5 판정(표면이 증가량을 계산하지 않음) 반영
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · 기록 형식 · COPY 타임아웃 관계(정본 10_observability/01 · 06)
> **원천**: D-16(사용자 결정 2026-10-11) · 원본 data_flow.md §2 · §4 · §7 · §8 · §8.2 · §13(커밋 ff66a37) · 원본 architecture.md §5 · §9(커밋 ff66a37) · 원본 implementation_plan.md §7.2 · §7.3(커밋 ff66a37) · docs_plan.md 실행 계획 보정 #4 · 웨이브 인계 W4 06_pipeline/04 행 전부 · W3 05/10 · W4 06/04 행 · D-01 · D-04 · D-05 · ADR-03 · ADR-06 · ADR-10 · ADR-11 · ADR-17 · REQ-GLB-11 · 12 · REQ-ING-10 · 14 · 15 · 사용자 결정 2026-09-27(업무 쓰기 Redis 경유) · SW-12 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) 정책 정본 · [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) 대조군 저장소 계약 · D-05 부분 개정(사용자 결정 2026-10-12) · ADR-32

분기의 **정책**(무엇이 어디로 왜 가는가)은 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)가 갖고, 이 문서는 **기전**(어느 모듈이 어느 시점에 어떤 판정으로 어느 호출을 하는가)을 갖는다. 둘을 가르는 이유는 기전이 바뀌어도 정책이 흔들리지 않게 하기 위해서다 — SW-11이 최신값 쓰기 주체를 Ingest에서 Collector로 옮겨도 "최신값은 Redis 휘발 사본 · 진실은 ClickHouse"는 그대로다.

분기는 흐름이 아니라 **흐름 안에서 일어나는 판정**이라 F-NN을 받지 않는다([01_flow_inventory.md](./01_flow_inventory.md)). 분기는 두 흐름에 걸쳐 일어난다 — ①은 F-02 flusher에서, ③은 F-05의 명령 적용(워커 grp:biz-writer)에서다. **②계층(알람 판정 · 생산 카운터)은 D-16으로 폐지돼 갈래는 둘이다** — 번호를 다시 매기지 않고 ① · ③으로 부른다. 옛 판정 흐름 F-06은 결번이다. **③도 Redis를 지나지만 수집 스트림과 다른 스트림이다** — 업무 명령은 stream:biz:cmd로 가고 stream:plc:raw에는 오지 않으므로 ING는 여전히 ③을 받지 않는 것으로 분기에 참여한다(ING-10).

## 분기 판정 트리

쓰기 하나가 목적지를 얻기까지의 판정이다. 우측이 쓰는 모듈 · 목적지이며, 판정 순서는 정책 문서의 성격 판정 기준(쓰는 주체 → 갱신 여부 → 즉시 읽는 자 → 진실)과 같다.

```plain
쓰기 하나
├─ 사람이 API 표면으로 쓴다(F-05) ──────────────── api XADD stream:biz:cmd → 워커 grp:biz-writer(직렬)
│  └─ 업무 행(마스터) ──────────────────────────────────────── MST → PostgreSQL 트랜잭션
│     ├─ 같은 트랜잭션의 명령 원장 행 ──────────────── 명령 기전 → PostgreSQL biz_command_log
│     └─ 커밋 뒤 ──── cache 계열 DEL → ch:cacheinv → biz:result SET → ch:bizreply → api 응답 · Dictionary · BFF · 브라우저
└─ 설비 스트림에서 온다(stream:plc:raw)
   ├─ 해독할 수 없는 엔트리 ─────────────────────────────────────────── ING → stream:plc:dlq
   └─ 측정 사실(행 전부 — 생산 카운터 표본 포함) ──────────────── ① ING flusher → ClickHouse tag_raw
      ├─ SW-09 on ─────────────────────────────── ING flusher → PostgreSQL plc_tag_raw_control(COPY 1회)
      ├─ 삽입 블록 ────────────────────────────────── ClickHouse MV → tag_1m → tag_1h → tag_1d(F-08)
      └─ 최신값 사본 ────────── SW-11 ingest: ING(XACK 뒤) · collector: COL(XADD 파이프라인) → rt:latest
```

- **첫 분기가 적용 방식을 고른다.** 사람의 쓰기는 요청 하나가 트랜잭션 경계이고 응답이 커밋을 기다려야 해서 **명령 스트림**을 탄다 — 윗가지에는 stream:biz:cmd만, 아랫가지에는 stream:plc:raw만 나온다. 두 가지가 같은 스트림을 공유하지 않는 것이 분기의 구조다(REQ-GLB-12). SW-12 direct면 윗가지가 옛 경로(api 트랜잭션 직접)로 돌아간다.
- **생산 카운터는 ① 가지에서 끝난다.** 카운터 태그의 표본은 다른 태그와 같은 측정 사실이고, 구간 생산량은 조회 시점에 계산한다(F-04 — 롤업 max − min · 랩어라운드 보정은 조회의 몫). 옛 ② 가지(알람 판정 · 생산 카운터 파생 판정기)는 D-16으로 지웠다.
- 최신값 · 롤업은 목적지가 아니라 **①의 파생**이다 — 진실은 tag_raw 하나다.

## ① 태그 원시값

| 단계 | 모듈 | 판정 | 목적지 · 호출 | 실패하면 | 흐름 |
|------|------|------|------|------|------|
| 발행 | COL · GEN 모드 B | 판정 없음 — 모든 스캔 사이클이 엔트리 하나 | XADD stream:plc:raw | 스풀 · 거절(위험 단계) | F-01 · F-09 |
| 선별 | ING 컨슈머 | 스키마 버전 v로 해독 가능한가 | 해독 불가면 DLQ · XACK | 해당 없음 — 격리가 판정 결과다 | F-02 |
| 적재 | ING flusher | 판정 없음 — 해독된 행 전부 | INSERT plc.tag_raw(창 정렬 배치 · 결정적 토큰) | 재시도 → DLQ(원 엔트리 단위) | F-02 |
| 롤업 | ClickHouse MV | 삽입 블록만 본다 | tag_1m → tag_1h → tag_1d | 원시만 확정 · 롤업 공백 — 대조 · 재계산 | F-08 |
| 사본 | ING(SW-11 ingest) | 확정 배치의 설비별 태그 최종값 | rt:latest 조건부 쓰기 + ch:rt | 최신값만 멈춘다 · STALE | F-02 · F-07 |

- 검산: 단계 = **5**
- **①에는 품질 코드에 따른 분기가 없다.** 2 · 4 · 9 · 0 행이 전부 tag_raw로 간다 — 품질은 저장의 조건이 아니라 조회 · 판정의 조건이다. 행을 만들지 않는 것은 BAD_TIMEOUT(3) 하나이고 그것은 분기가 아니라 Collector의 결측이다([02_collect.md](./02_collect.md)).
- **①의 유일한 목적지는 ClickHouse다.** 대조군 COPY는 목적지가 아니라 계측이다 — 조회 표면은 대조군을 읽지 않는다(REQ-TSQ-16).

## ③ 업무 쓰기 — 명령 스트림 경로

③의 기전은 **수집 스트림과 분리된 명령 스트림 · 직렬 적용 · 커밋 뒤 동기 응답**이다. 정책 문서가 옛 판정의 근거로 적은 보장 넷을 기전이 어떻게 지키는지다. 단계 · 봉투 · 실패 의미의 정본은 [07_business_crud.md](./07_business_crud.md) §업무 명령 경로다.

| 보장 | 기전 | 막는 자리 | 검증 |
|------|------|------|------|
| read-your-writes | api가 XADD 뒤 결과를 기다리고, 워커가 커밋 → 체인 ②③ → biz:result SET → ch:bizreply 순으로 결과를 낸 뒤에만 응답한다 · 캐시는 커밋 뒤 삭제 | [07_business_crud.md](./07_business_crud.md) §업무 명령 경로 · 무효화 체인 | AC-37 쓰기 직후 재조회 |
| 트랜잭션 원자성 | 명령 하나 = 트랜잭션 하나 — 변경 · biz_command_log가 한 커밋 | 워커가 부르는 기존 변경 도메인 서비스 | 쓰기 1건 → 원장 1행 |
| 제약 위반 즉시 응답 | 유일 · 전이 제약 위반을 워커가 결과 코드로 담고 api가 기존 HTTP 오류로 옮긴다 | common.duplicate_key/409 · master.scale_change_forbidden/409 | 표면 테스트 |
| 재시도 멱등 | cmdId = 멱등 키 · 원장 cmd_id UNIQUE가 재전달 · 같은 cmdId 재요청의 이중 적용을 막는다 · PostgreSQL 불가면 워커는 재시도하지 않고 503 결과(보관 · 재생 없음 — [07_business_crud.md](./07_business_crud.md) §업무 명령 경로) | biz_command_log · [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) | 같은 cmdId 두 번 → 원장 1행 · biz_duplicates_total 1 |

- 검산: 보장 = **4** — 정책 문서 §업무 쓰기가 명령 스트림을 타는 방식의 4행과 같은 순서
- **ING에는 ③을 해독할 디코더가 없고, 명령 소비자는 수집 엔트리를 해독하지 않는다.** Stream 페이로드 계약(스키마 버전 v)은 측정 행 하나의 모양뿐이고 명령 봉투는 cmdId · kind · payload · actor · requestedAt이다 — 두 스트림 · 두 그룹이 서로의 엔트리를 받지 않는 것이 분리의 구조다.
- **명령 소비자는 소비자 1 · 직렬이다.** ING의 컨슈머 N · 단일 flusher와 달리 업무 쓰기는 배치로 묶지 않는다 — 한 명령의 도메인 오류가 다른 명령을 붙잡지 않고 같은 행의 쓰기 순서가 스트림 순서다.
- 검증 AC-37 — 마스터 업무 명령 부하 on/off에서 stream:plc:raw 유입량이 업무 명령과 무관하게 움직여야 한다(REQ-GLB-12). 명령 스트림은 그 대조에서 CRUD와 **같이** 움직이는 쪽이다(§분기 계측).

## 사본 쓰기 — 최신값 · 캐시

사본은 목적지가 아니다. 목적지가 둘로 보이게 만드는 사본 쓰기의 주체와 시점을 고정한다.

| 사본 | 원천 | 쓰는 모듈 · 시점 | 쓰기 방식 | 스위치 | 기전 정본 |
|------|------|------|------|------|------|
| rt:latest | tag_raw | ING flusher · XACK 뒤(SW-11 ingest) | 설비별 필드 조건부 쓰기(새 ts ≥ 저장 ts) | SW-11 | [05_realtime_read.md](./05_realtime_read.md) |
| 상동 | 상동 | COL · XADD 파이프라인(SW-11 collector) | 상동 | 상동 | 상동 |
| 상동 | 상동 | RLT · 빈 키 복원 · ING 기동 복원 | 상동 — argMax 결과 | 해당 없음 | 상동 |
| cache:q | ClickHouse 집계 | TSQ · 미스 뒤 | cache-aside · TTL + 지터 | SW-03 · 04 · 05 | [06_timeseries_read.md](./06_timeseries_read.md) |
| cache:tagmeta · devlist | PostgreSQL | 읽는 모듈 · 미스 뒤 | cache-aside · 쓰기 뒤 DEL | 없음 | [07_business_crud.md](./07_business_crud.md) |
| dict_tag | PostgreSQL tag_master | ClickHouse · LIFETIME · SYSTEM RELOAD | 전량 재적재 | 없음 | 상동 |
| biz:result:{cmdId} | PostgreSQL biz_command_log | 명령 기전 워커 · 커밋과 체인 ②③ 뒤 | TTL SET · 없으면 원장을 읽는다 | SW-12(direct면 없음) | 상동 |

- 검산: 사본 행 = **7** · rt:latest 쓰기 주체 3(ING · COL · RLT)
- **rt:latest는 쓰기 주체가 셋이라 조건부 쓰기가 필요하다.** 키 공간 네이밍 규칙 "키 패턴 하나에 쓰는 모듈 하나"의 예외(워밍)에 SW-11 collector가 더해진다 — 무조건 덮어쓰기면 스풀 재발행 · 회수 · 복원 경합이 옛 값으로 최신값을 덮는다(한계 등재 #2의 판정 — [05_realtime_read.md](./05_realtime_read.md) §덮어쓰기 순서 역전).

## 대조군 동시 적재 기전

저장소 쪽 계약(순서 · COPY 1회 · 재시도 없음 · 구간 count 검출)은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md)가 판정했다(ADR-17). 이 절은 **flusher 안의 위치 · 커넥션 · 실패 기록 · 구간 대조 절차**를 고정한다.

```plain
① 배치 확정        창 정렬 · 결정적 토큰(03_ingest_batch)
② ClickHouse 삽입   재시도 루프 — 성공할 때까지 대조군은 건드리지 않는다
③ 대조군 COPY       SW-09 on · gated의 게이트 열림일 때만 · 같은 행 배열 · 전용 커넥션 · 트랜잭션 1 · 타임아웃 · 시도 1회
④ XACK              ③의 성패와 무관
⑤ 후속              최신값 조건부 쓰기
```

- **③은 ②의 재시도 루프 밖이고 ② 성공 뒤 한 번이다.** 루프 안이면 ClickHouse 재시도마다 대조군에 같은 행이 쌓인다.
- **③이 느리면 XACK가 늦는다 — 이것이 SW-09 기본이 on이 아니라 gated인 이유다(옛 기본 off · D-16).** 대조군 비용이 수집 경로의 지연으로 섞이므로 SW-09 on과 목표 ② 처리량 측정을 섞지 않는다(조합 제약 #4). COPY 타임아웃은 이 섞임의 상한이며 넘으면 실패로 센다 — 값은 2계층 · 현행 참고 창 폭 W의 절반(S3 판정 · 배치 안 A 500 ms · 나머지 절반이 삽입 p95의 몫). COPY가 타임아웃 뒤 서버에서 커밋됐다면 대조군에 행이 남아도 실패로 세어진다 — 실패 로그의 ts 범위와 구간 count 대조가 이 경우를 드러낸다.
- **실측 — 배치 안 A에서 ③이 XACK를 늦추는 폭은 배치당 COPY p50 12.51 · 25.0 · 65.0 · 65.0 ms다**(10,000 · 20,000 · 50,000 · 100,000 pps · 배치 10,000 · 20,000 · 50,000 · 50,000행 × 초당 1 · 1 · 1 · 2 · 20,000 계단부터 히스토그램 한 칸 보간 · 기록 045 · valid · 19f8861 · 부하 실험 · M · SW-09 on · SW-10 off · 대조 자원 조건 · COPY 세션 synchronous_commit off). COPY p95 중앙값 최대 78.5 ms로 타임아웃 500 ms를 넘은 계단이 없고 COPY 실패 · DLQ · 삽입 재시도 0 · 계단 구간 count 일치다 — 같은 기록의 ClickHouse 삽입 p95 중앙값 최대 135.48 ms라 관계 COPY 타임아웃 + 삽입 p95 < W(1,000 ms)도 관측 범위 안에서 성립한다. 100,000 pps 너머 · 배치 안 B · C는 외삽하지 않는다([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §역방향 대조표 — EXP-40~45).
- **창 경계 순간에는 ②를 마치고 ③ 중인 배치 하나가 걸린다 — 유실이 아니다.** 계단 창 끝 캡처에서 ClickHouse 삽입 수가 COPY 수보다 1 많고(창 행 수 차 = 배치 1개 · 12개 창 중 2) 다음 캡처에서 같아졌으며 구간 count · KST 일 count는 일치했다(기록 045) — ②가 ③보다 앞서는 이 절 순서의 관측이다. 구간 count 대조는 적체 소진 뒤에 읽어야 이 순간 차를 결함으로 세지 않는다.
- **③과 ④ 사이의 크래시만 대조군 중복을 만들 수 있다 — D-16부터는 기본 키가 막는다.** 재전달된 배치는 ClickHouse에서 토큰으로 무시되고, 비교 사본의 COPY는 기본 키 (device_id, tag_id, ts) 위반으로 통째 실패한다 — 행은 첫 COPY의 것이 남고 실패 계수만 하나 는다(옛 판정 "막지 않고 구간 count로 검출"을 대체 · 한계 등재 #5).

| 계약 | 규칙 | 어기면 |
|------|------|------|
| 입력 | ②에 보낸 것과 **같은 행 배열** · ts는 같은 epoch ms · ingested_at은 각 저장소 DEFAULT | 따로 만든 행이면 두 저장소의 행 집합이 달라 대조가 성립하지 않는다(ADR-17 버린 대안 ①) |
| 커넥션 | 업무 풀 밖 전용 커넥션 1 · 끊기면 그 배치를 실패로 세고 다음 배치가 새로 연다 | 업무 풀을 쓰면 COPY가 CRUD 커넥션을 점유해 F-05 지연이 대조 실험에 오염된다(ADR-19) |
| 실패 기록 | 대조군 실패 계수 + 실패 배치의 ts 최솟값 · 최댓값 · 행 수 · 토큰 | 기록이 없으면 무효 구간을 사후에 찾을 방법이 count 전수 대조뿐이다 |
| 재시도 | 없다 — 실패 배치는 대조군에 0행(롤백) | 재시도하면 성공 뒤 재시도 · 부분 성공의 중복을 가를 수단이 필요해진다 |
| ingested_at | 대조에 쓰지 않는다 | 두 저장소의 적재 시각은 서로 다른 시계 · 시점이라 차이가 계측 오차가 된다 |

- 검산: 계약 = **5**

대조 실험 직전의 구간 count 대조 절차다. 판정 조건(정확 일치 구간에서만 대조)은 REQ-ING-15 · REQ-NFR-18이며 기록 형식은 [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md)가 갖는다(W6 — 격자 단계 기록의 기계 판독 블록).

```plain
① 대상 구간을 UTC 날 단위로 나눈다(ADR-27)      두 저장소의 일 경계가 같다(ClickHouse 일 파티션 · PostgreSQL hypertable 일 칸 — ADR-32 · 08_retention_lifecycle)
② 일마다 count(tag_raw) 대 count(plc_tag_raw_control)  정확 일치만 합격 — 오차 허용 없음
③ 불일치 일 표시                                 실패 기록(③ COPY 실패)의 ts 범위와 겹치는지 대조
④ 무효 일 처리                                   대조에서 빼거나 수리 — 측정 창 밖에서만
⑤ 수리                                           대조군 그날 칸을 비우고(control_clear_range) tag_raw의 같은 일 행을 COPY → ② 재대조
```

- **⑤의 수리는 ClickHouse → PostgreSQL 복제(ADR-17 버린 대안 ③)가 아니다.** 버린 대안은 상시 복제라 복제 지연이 행 수 일치를 깨고 복제 부하가 측정에 섞였다. 수리는 측정 창 밖의 일회성 채우기이고 끝나면 count가 정확히 맞는다.

### gated 게이트 판정

SW-09 gated(기본 · D-16)는 on과 **같은 COPY 구현**을 주입하고 배치마다 ③ 앞에서 게이트를 본다. 게이트를 켜고 끄는 주체는 직접 비교 실행(GEN-13) 하나다 — 표면 · 화면 · 사람은 게이트를 건드리지 않는다(결정 [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) ADR-28).

```plain
배치(② 성공)
├─ 마지막 판정이 500 ms 안 ─────────────────────── 그 판정을 쓴다(Redis를 읽지 않는다)
└─ 500 ms 지남 → cache:dual:active 읽기(동시 배치는 읽기 하나를 나눠 쓴다)
   ├─ 읽기 성공 · 키 있음 ─────────────────────── 열림 → ③ COPY · 흐름 요약에 controlCopy
   ├─ 읽기 성공 · 키 없음 ─────────────────────── 닫힘 → ③ 건너뜀 · 흐름 요약에 controlCopy 없음
   └─ 읽기 실패(캐시 래퍼 degrade)
      ├─ 마지막 확인이 10초(게이트 TTL) 안 ───────── 직전 판정 유지
      └─ 10초 넘음 ───────────────────────────── 닫힘
```

- **읽기 캐시 500 ms가 실행의 1초 기다림을 정한다.** 실행은 게이트를 켜거나 끈 뒤 1초를 기다리고 발행 · 결과 계산으로 넘어간다 — flusher가 새 판정을 본 뒤라야 첫 배치부터 두 저장소에 같이 실린다.
- **읽기 실패를 즉시 닫힘으로 읽지 않는다.** 최대 속도 넣기 중에는 Redis 응답이 캐시 래퍼 타임아웃(50 ms)을 넘을 수 있다 — 한 번의 실패를 닫힘으로 읽으면 그 배치들이 PostgreSQL에서 빠져 넣기 결과의 행 수 대조가 어긋난다. 상한을 TTL과 같게 두는 이유는 실행이 죽었으면 게이트도 TTL로 사라졌기 때문이다.
- **controlCopy는 실제로 COPY한 배치에만 싣는다**(REQ-ING-19) — 흐름도가 비교 실험이 없는데 PostgreSQL 사본 길을 그리지 않는다(정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트).
- **게이트는 배치 단위다 — 행의 시각을 보지 않는다.** 게이트가 열린 동안 설비 가동이 켜져 있으면 지금 시각의 가동 배치도 비교 사본에 실린다 — 비교 구간 밖이라 대조에는 들지 않는다(한계 등재 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) #28 · 결과의 plant_on 표지).

## 모듈 × 저장소 쓰기 행렬

"누가 어디에 쓰는가"의 전수다. 읽기는 세지 않는다. 칸의 뜻 — 쓰기가 있으면 대상 · 없으면 없음.

| 모듈 | ClickHouse | PostgreSQL | Redis 봉인 계열 | Redis 캐시 계열 | Pub/Sub |
|------|------|------|------|------|------|
| COL | 없음 | 없음 | stream XADD · rt(SW-11 collector) | cache:tagmeta 워밍 | ch:rt(SW-11 collector) |
| SIM | 없음 | 없음 | 없음 | 없음 | 없음 |
| GEN | 없음 — 직접 비교의 구간 비우기 · 지우기만(관리 문 — 측정값 쓰기 아님) | run_result · 비교 사본 함수 호출(구간 비우기 · 구간 압축 · 지우기 — ADR-32) | stream XADD(모드 B · 흐름 시연 · 직접 비교) · 지우기의 XTRIM · rt:latest UNLINK | cache:dual:active · 지우기의 cache:q DEL | 없음 |
| ING | tag_raw | 대조군(SW-09) | stream XACK · dlq · rt(SW-11 ingest · 기동 복원) | 없음 | ch:rt(SW-11 ingest) |
| MST | 없음 — Dictionary 재적재 명령만 | 마스터 6 | 없음 | cache:tagmeta · devlist DEL · 채움 | ch:cacheinv |
| TSQ | 없음 | 없음 | 없음 | cache:q · lock:rebuild:q | 없음 |
| RLT | 없음 | 없음 | rt(빈 키 복원 워밍) · ctl:plant:power(설비 가동) | lock:rebuild:rt | 없음 |
| OBS | 없음 | 없음 | 없음 | 없음 | 없음 |

- 검산: 모듈 = **8** = 도메인 8 · 어느 저장소에도 쓰지 않는 모듈 2(SIM · OBS) · ClickHouse에 데이터를 쓰는 모듈 1(ING) · PostgreSQL에 쓰는 모듈 3(ING · MST · GEN — run_result · D-16)
- **GEN의 ClickHouse · PostgreSQL 칸은 측정값 쓰기가 아니다.** 직접 비교는 센서 행을 Stream으로만 보내고(적재는 ING의 같은 배치) 저장소에는 구간 비우기 · 지우기 · 넣기 검증 단계의 PostgreSQL 구간 압축(관리 문 — ADR-32)과 결과 보관(run_result)만 한다 — "ClickHouse에 데이터를 쓰는 모듈은 ING 하나"는 그대로다.
- **ClickHouse에 데이터를 쓰는 모듈은 ING 하나다.** 옛 쓰기 주체였던 GEN 모드 D(실험 도구)와 ALM 판정 전수는 D-16으로 지웠다 — 소유 판정 [../05_data_stores/04_clickhouse_rollup.md](../05_data_stores/04_clickhouse_rollup.md) §도메인 귀속 판정.
- **COL의 PostgreSQL 칸이 "없음"인 것이 Stream 경계의 증거다.** Collector는 PostgreSQL을 읽기만 하고(기동 로드) ClickHouse · PostgreSQL 어디에도 측정값을 쓰지 않는다(REQ-COL-10).
- MST의 마스터 6은 site · production_line · device · modbus_config · tag_master · tag_master_history다.
- **업무 명령 기전(stream:biz:cmd XADD · grp:biz-writer 소비 · biz:result · ch:bizreply · biz_command_log 행)은 도메인 모듈의 쓰기로 세지 않는다.** 명령 기전은 도메인 서비스를 부르는 공통 경로이고, 업무 행을 쓰는 서비스의 소유(MST)는 그대로라 위 행렬의 칸이 바뀌지 않는다. biz_command_log의 소유는 명령 기전(도메인 밖 공통 경로)이다 — 옛 소유 WRK는 D-16 폐지([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md)).

## 분기 계측

분기가 실제로 일어났는지를 저장소별 쓰기 결과로 대조하는 자리다. ING가 계층별 쓰기 결과를 계측해 분기 대조표의 원천을 만든다(ING-10 · REQ-ING-14).

| 대조 | 같은 구간의 세 값 | 기대 관계 | 어긋나면 가리키는 것 | 인수 기준 |
|------|------|------|------|------|
| ① 적재 | 적재 행 수 · tag_raw count · DLQ 행 수 | 발행 행 = tag_raw + DLQ(생략 · 결측 제외) | 유실 · 중복 · 격리 누락 | AC-01 · AC-02 |
| ③ 수집 스트림 비경유 | 업무 명령 수 · 같은 구간 stream:plc:raw 유입 변화 | 무관 | 업무 쓰기가 수집 스트림을 탔다 | AC-37 |
| ③ 업무 명령 | 워커 쪽 명령 종결 수(biz_commands_total result applied · rejected · expired · failed) · biz_command_log 행 수 · 재전달 · 같은 cmdId 수(biz_duplicates_total) | 워커 종결 수 = 원장 행 증가 + failed(PostgreSQL 불가 결과 — 원장 행 없음) + 중복 · 중복은 원장 행을 늘리지 않는다 · api 쪽 timeout · unavailable은 식에 넣지 않는다(timeout 명령은 워커 쪽에서 다시 세고, unavailable은 워커에 닿지 않는다) | 이중 적용 · 원장 누락 | 없음(옛 EXP-46 D-16 폐지 — 멱등은 api 시험 biz-core · AC-37) |
| 대조군 | 구간별 두 저장소 count | 정확 일치 | COPY 실패 · 재전달 중복 | AC-21 |

- 검산: 대조 = **4** · 옛 ② 세 쓰기 대조(AC-35)는 D-16 폐지
- 계측 메트릭의 이름은 [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)가 정한다 — ing_routed_rows_total{layer} · redis_stream_entries_added_total(W6) · biz_commands_total{kind,result} · biz_duplicates_total(업무 명령).

## 스위치별 경로 변화

스위치는 경로를 바꾸지만 목적지 정책을 바꾸지 않는다(정책 문서 §스위치가 분기를 바꾸는가). 기전 쪽에서 어느 호출이 바뀌는지다.

| 스위치 | 바뀌는 호출 | 그대로인 호출 | 분기 트리에서의 자리 |
|------|------|------|------|
| SW-01 off | XADD → 프로세스 안 큐 · XACK · PEL · 스풀 없음 | tag_raw 삽입 | ① 발행 가지 — 실험 전용 · 모드 A만 |
| SW-02 off | 최신값 읽기가 ClickHouse argMax | rt:latest 쓰기 · ch:rt 발행 | 해당 없음 — 읽기 경로 |
| SW-03 off | cache:q 쓰기 · 읽기 없음 | ClickHouse 집계 | 해당 없음 — 사본 |
| SW-06 off | PUBLISH 대신 게이트웨이 직접 호출(ch:rt) | ch:cacheinv | ① 최신값 사본 가지 |
| SW-08 off | 토큰 없는 INSERT | 나머지 전부 | ① 적재 가지 |
| SW-09 on · gated | 대조군 COPY 추가(gated는 게이트 열린 배치만) | 나머지 전부 | ① SW-09 가지 |
| SW-11 collector | rt:latest 쓰기 · ch:rt 발행 주체가 COL로 | 조건부 쓰기 방식 · ClickHouse 진실 | ① 최신값 사본 가지 |
| SW-12 direct | 명령 XADD · 워커 적용 · 원장 · 결과 SET · ch:bizreply 없음 — api가 트랜잭션을 직접 커밋 | 쓰기 서비스 · 무효화 체인 · 표면 응답 | ③ 윗가지 — 비교 실험 없음(옛 EXP-46 D-16 폐지) |

- 검산: 경로를 바꾸는 스위치 = **8**(SW-01 · 02 · 03 · 06 · 08 · 09 · 11 · 12) · 분기 트리 밖 조회 · 병합 스위치 4(SW-04 · 05 · 07 · 10) · 8 + 4 = **12**
- **SW-10은 분기 트리 앞에서 행 수를 바꾼다.** 데드밴드가 생략한 값은 Stream에 오지 않으므로 분기의 대상이 아니다 — 목적지가 아니라 입력량이 바뀐다.

## 정책 문서와의 1:1 대응 검산

[../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) §데이터 종류별 목적지의 현행 행마다 이 문서의 기전 자리를 대응시킨다. **정책 행이 기전 자리를 갖지 않으면 목적지만 있고 쓰는 경로가 없는 데이터다.**

| 정책 # | 데이터 | 계층 | 쓰는 모듈 · 호출 | 흐름 | 기전 자리 |
|:-:|------|------|------|------|------|
| 2 | 사이트 · 라인 · 설비 | ③ | MST 트랜잭션 · 체인 6단 | F-05 | §③ 업무 쓰기 · [07_business_crud.md](./07_business_crud.md) |
| 3 | 태그 마스터 | ③ | MST 트랜잭션 · 체인 6단 | F-05 | 상동 |
| 4 | 태그 변경 이력 | ③ | MST 스케일 변경 트랜잭션 안 | F-05 | 상동 |
| 5 | Modbus 접속 설정 | ③ | MST 트랜잭션 → Collector 재로드 신호 | F-05 → F-01 | 상동 · [02_collect.md](./02_collect.md) |
| 13 | PLC 태그 원시값 | ① | ING flusher INSERT tag_raw | F-02 | §① 태그 원시값 · [03_ingest_batch.md](./03_ingest_batch.md) |
| 14 | 롤업 3 | ① | ClickHouse MV 연쇄 | F-08 | [09_rollup.md](./09_rollup.md) |
| 15 | 태그 최신값 | ① 사본 | ING · COL(SW-11) · RLT 조건부 쓰기 | F-02 · F-01 · F-03 | §사본 쓰기 · [05_realtime_read.md](./05_realtime_read.md) |
| 16 | 조회 결과 캐시 | 사본 | TSQ cache-aside | F-04 | §사본 쓰기 · [06_timeseries_read.md](./06_timeseries_read.md) |
| 17 | 수집 버퍼 · DLQ | 경로 | COL · GEN XADD · ING XACK · DLQ | F-01 · F-02 · F-10 | §① 태그 원시값 · [11_backpressure_failure.md](./11_backpressure_failure.md) |
| 19 | 대조군 원시값 | 계측물 | ING flusher COPY(SW-09) | F-02 | §대조군 동시 적재 기전 |
| 21 | 업무 명령 원장 | ③ | 명령 기전 워커 — 업무 행과 같은 트랜잭션 INSERT | F-05 | §③ 업무 쓰기 · [07_business_crud.md](./07_business_crud.md) §업무 명령 경로 |
| 22 | 업무 명령 버퍼 · 결과 | 경로 | api XADD · 워커 XACK · 결과 SET · ch:bizreply | F-05 | 상동 |
| 23 | 직접 비교 실행 결과 | 실행 보관 | GEN 직접 비교 실행이 종결 직전 INSERT run_result(업무 명령 경로를 타지 않는다) | F-09 | [10_datagen_inject.md](./10_datagen_inject.md) §직접 비교 실행 |
| 24 | 설비 가동 상태 | 실행 중 제어 | RLT 표면 원자 쓰기 · 수집기 역할 기동 때 DEL · 1초 읽기 | F-01 · F-09 | [05_realtime_read.md](./05_realtime_read.md) §설비 가동 · HMI 개요 |
| 25 | 동시 적재 게이트 | 실행 중 제어 | GEN 직접 비교 실행 SET(2초 갱신) · DEL · ING flusher 읽기(500 ms 캐시) | F-02 | §gated 게이트 판정 |

- 검산: 현행 정책 행 **15** = 기전 자리 **15** · 기전 자리 없는 정책 행 **0** · 정책 번호는 다시 매기지 않는다 — 결번 10(#1 사용자 · 권한 · #6 작업지시 · 생산 실적 · #7 감사 로그 · #8~#11 알람 넷 · #12 생산 카운터 ② · #18 세션 · 토큰 · #20 업무 대조 테이블 — D-16)
- 계층별: ③ 5(#2~#5 · #21) + ① 2(#13 · #14) + 사본 2(#15 · #16) + 경로 2(#17 · #22) + 계측물 1(#19) + 실행 보관 1(#23) + 실행 중 제어 2(#24 · #25) = **15** — 정책 문서의 계층별 검산과 같은 구성
- 정책 문서의 나머지 대응 — §업무 쓰기가 명령 스트림을 타는 방식 4행 ↔ §③ 업무 쓰기 표 4행 · §스위치가 분기를 바꾸는가 5행(SW-01 · 02 · 03 · 09 · 12) ↔ §스위치별 경로 변화의 같은 5행. 검산: 대응 묶음 = 15 + 4 + 5 = **24**행 · 기전 없는 정책 행 **0** · 옛 대응(§목적이 다른 세 쓰기 ↔ §② 알람 판정 · §②계층 생산 카운터 판정 ↔ §생산 카운터 기전 판정)은 D-16으로 양쪽 절이 함께 사라졌다

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 대조군 COPY 타임아웃 값 | **S3 판정** — W ÷ 2(배치 안 A · C 500 ms · B 2,500 ms) · 관계 COPY 타임아웃 + ClickHouse 삽입 p95 < 창 폭 W(W6 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) §대조 실험 조정값) — 관계 성립은 AC-21 기록의 삽입 p95로 확인한다 | S3 · 이 문서 · AC-21 동시 적재 기록 |
| 분기 대조 · 대조군 실패 계수 메트릭 이름 | **W6 판정** — ing_routed_rows_total{layer} · ing_control_copy_failures_total | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |
| 구간 count 대조의 기록 형식 | **W6 판정** — 격자 단계 기록(절차 ②) · 기계 판독 블록 | [../10_observability/04_experiment_protocol.md](../10_observability/04_experiment_protocol.md) |
| 업무 명령 직렬 적용의 처리량 상한 · direct 대 stream 지연 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 확정 수단 없음(EXP-46 D-16 폐지) | [07_business_crud.md](./07_business_crud.md) |
| COUNTER 랩어라운드 조회 보정 | 잔여 — W5 판정: 조회 표면은 구간 증가량(max − min)을 계산하지 않는다 · 증가량 집계 요청 필드 없음 · 랩어라운드 보정은 표면이 생길 때의 몫 | [06_timeseries_read.md](./06_timeseries_read.md) · [../07_api/05_timeseries.md](../07_api/05_timeseries.md) |

## 관련 문서

- [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) — 분기 정책 정본
- [../01_overview/01_purpose_learning_goals.md](../01_overview/01_purpose_learning_goals.md) — 학습 목표 ②
- [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) — 대조군 저장소 계약
- [03_ingest_batch.md](./03_ingest_batch.md) — ① 적재 기전
- [07_business_crud.md](./07_business_crud.md) — ③ 업무 명령 경로 · 무효화 체인
- [05_realtime_read.md](./05_realtime_read.md) — 최신값 사본 쓰기
