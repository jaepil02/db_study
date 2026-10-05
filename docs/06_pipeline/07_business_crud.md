# F-05 업무 데이터 CRUD (07_business_crud)

> **대상**: F-05 흐름의 기전 정본 — 읽기 · 쓰기 경로 · **업무 명령 경로(stream:biz:cmd → 워커 → PostgreSQL 트랜잭션 · 동기 응답 · 멱등 원장 biz_command_log · 202 pending · 명령 조회 · SW-12 direct)** · BFF 경유 기준 · **캐시 무효화 체인 6단(ADR-12)의 단계 번호 정본** · 도메인별 체인 적용 · 작업지시 no-store · 층별 옛 값의 창 · 체인 실패와 degrade · 인증 흐름의 BFF 경유 · 감사 트랜잭션
> **작성일**: 2026-09-24
> **개정일**: 2026-10-05 — 웹 · api 호스트 포트 이동(같은 머신의 다른 프로젝트가 호스트 3000 · 3001을 점유 · 사용자 결정 2026-10-05) — 웹 3001 → **13001** · api 호스트 3000 → **13000**(컨테이너 3000 · 서비스명 그대로) · CORS 허용 오리진 http://localhost:3001 → **http://localhost:13001** — 오리진 수 · 바인드 규칙 불변
> **개정일**: 2026-09-28 — 코드 검수 반영(r-code-api H1 · M2) — 재전달 표현 XAUTOCLAIM → **PEL 재읽기(ID 0)** · 바퀴 예외 뒤에도 PEL부터 · 커밋 뒤 결과 SET · XACK 예외는 결과 키를 FAILED로 덮지 않는다 · 락 연산 호출 상한 500 ms · 갱신 결과 소유자 아님 · 불확실 구분 · 획득 이어 쓰기 — 단계 · 멱등 표 행 수 불변
> **개정일**: 2026-09-28 — 리드 정정(구현 i-biz-core 판정 채택) — EXPIRED 원장 result {"status":"expired"} → **결과 키와 같은 모양 {status: EXPIRED, actor}**(원장 result = 결과 키 JSON — 재전달이 원장 값을 그대로 다시 SET · 05_data_stores/01 §biz_command_log 설계와 일치)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영(f-biz — B-H4 · B-M4~M9 · B-L1 · 흐름 요약 필드) — 봉투 actor → **원장 · 결과 키에 싣는다** · 봉투 → 원장 대응 불릿 · 명령 조회 404 = actor 불일치(둘 다 NULL이면 같다) · 적용 단계 ① **대기 맵 등록 → XADD**(등록이 먼저) · ② **lock:biz:writer를 쥔 워커의 biz-writer-1 · 기동 시 자기 PEL(ID 0) 소진 뒤 >** · 그룹 생성 **XGROUP CREATE … 0 MKSTREAM** · 멱등 표 경우 5 → **6**(만료 뒤 같은 키 재요청 → 202 + expired) · PostgreSQL 불가 행 재요청 = ③부터 다시 · **failed = 적용 여부 미확정**(한계 등재 #26) · EXPIRED 원장 result = {"status":"expired"} · 원인 구분 "result=unavailable이 가른다" → **Redis 불가 = unavailable · PostgreSQL 불가 = failed** · 흐름 요약 필드에 **role**(biz-writer · api-direct) · 발행 대상에 **failed** · queueWaitMs "③ 대기" → **② XREADGROUP 수신까지** — 단계 · 시간 초과 · 실패 · 체인 실패 행 수 불변
> **개정일**: 2026-09-28 — 503 코드 판정 정정(리드 · d-biz-b — HTTP 규약 "대응이 같으면 한 코드") — Redis 불가 업무 쓰기 코드 common.command_bus_unavailable → **common.postgres_unavailable/503 재사용**(PostgreSQL 불가와 한 코드 · 원인은 biz_commands_total{result=unavailable} · 표면 정본 07_api/01)
> **개정일**: 2026-09-28 — 표면 확정 정렬 · 화면 무효화 닫힘 — Redis 불가 코드 common.postgres_unavailable 재사용 → **common.command_bus_unavailable/503 신설**(07_api/02 판정 · PostgreSQL 불가는 common.postgres_unavailable 그대로) · 명령 조회 **failed = 결과 키 쪽 값**(원장 status 3값 불변 · 원장 행 없음) 관계 명시 · 미설계 "202 뒤 화면 무효화" **닫힘**(08_screen/01 — 적용 확인 뒤 재조회에 신선 창 표지 x-bff-fresh) — 행 수 불변
> **개정일**: 2026-09-28 — 흐름 이벤트 · 표면 이름 정렬 — 적용 단계 ⑦에 **흐름 요약 발행(ch:flow · event biz · 구독 중 표지가 있을 때만 · 워커 · direct면 api)** · 요약 필드 불릿 · cmdId 싣는 법 = **Idempotency-Key 헤더**(07_api/01) · 명령 조회 상태 pending · applied · rejected · expired · failed(07_api/01) · Redis 불가 코드 = **common.postgres_unavailable/503 재사용**(07_api/02 판정) — 단계 · 행 수 불변
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27 · D-04 · REQ-GLB-12 개정) — 업무 쓰기 "Stream을 한 번도 지나지 않는다" → **api가 stream:biz:cmd에 명령을 XADD하고 워커 grp:biz-writer(소비자 1 · 직렬)가 PostgreSQL 트랜잭션으로 적용 · 커밋 뒤 결과를 biz:result:{cmdId}에 SET · ch:bizreply로 알림 · api는 커밋 뒤에만 기존 상태 코드로 응답(대기 상한 5초 → 202 pending)** · §업무 명령 경로 신설(봉투 · 적용 단계 · 멱등 · 시간 초과 · 실패 의미 · SW-12) · 체인 ②③④ 주체 api → **워커** · 체인 실패 표 7 → **10**행(Redis 불가 중 업무 쓰기 503 · 명령 유효 창 초과 · 워커 정지) · 읽기 경로 불변
> **개정일**: 2026-09-26 — W3 재검수 반영 — cache-aside 잔여 행 링크 칸 한계 등재 #22 · 알람 캐시 잔여 폭은 #22를 가리킴
> **개정일**: 2026-09-26 — W3 반영 — cache-aside 잔여 경합 한계 등재 완료(02 #22 · cache:alarmrules · cache:alarmevents 포함)
> **개정일**: 2026-09-25 — S4 as-built(3e8a46d · 기록 021) — ③ 페이로드 = 무효화된 키 이름의 JSON 배열(한 쓰기의 키는 한 메시지) · **⑥이 ⑤를 앞지르는 경합**과 신호 뒤 신선 창 판정(S4 검수 M5) · cache-aside 잔여 경합 한계 등재(검수 L7) · 층별 반영 사건 순서 실측(AC-06 3/3)
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 체인 번호 통일 행 닫힘(문서군 전체 6단)
> **개정일**: 2026-09-24 — W7 검수 반영 — 대응표 머리 5단 표기(REQ-MST-09 · MST-08) → **옛 5단 표기(원본 · 선행 초안)** — 두 ID는 이미 6단 번호를 쓴다 · 체인 단 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — staleTime 설정값 미정을 닫는다(09_tech_stack/01 파생표) · BFF revalidate 현행 30초 소유 09_tech_stack/01 — 체인 단 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 미확인 "⑥ 신호 키 → 브라우저 쿼리 키 대응"을 닫는다(08_screen/01 §무효화 신호 수신 — 신호 키 4 · staleTime 관계식) · staleTime 값만 09_tech_stack/01(W6)에 남는다 — 체인 단 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 사이트 · 라인 체인 행의 "사이트 목록 사본" → **Redis 사본 없음**(② · ③ · ⑥ 없음 · ⑤만) · 목록 BFF 경유 행에 사이트 · 라인 · 태그 목록 Redis 사본 부재 명시 — 쓰기 유형 수 불변
> **원천**: 원본 data_flow.md §7 · §7.1 · §7.2 · §17(커밋 ff66a37) · 원본 architecture.md §10.1 · §11.2 · §12(커밋 ff66a37) · 원본 implementation_plan.md §7.4(커밋 ff66a37) · docs_plan.md 보정 #5 · 웨이브 인계(작업지시 BFF 캐시 키 · 무효화 층별 반영 시간) · ADR-02 · ADR-12 · ADR-16 · ADR-19 · D-04 · REQ-GLB-12 · REQ-MST-01~14 · REQ-WRK-01~09 · REQ-AUT-14 · REQ-ALM-02 · 13 · 14 · REQ-RLT-15 · 사용자 결정 2026-09-27(업무 쓰기 Redis 경유 · 동기 응답) · ADR-26 · SW-12 · EXP-46 · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) §업무 쓰기가 명령 스트림을 타는 방식 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) §즉시 반영

F-05는 **사람이 쓰는 업무 데이터가 Redis 명령 스트림을 거쳐 PostgreSQL 트랜잭션으로 확정되고 사본들이 지워지기까지**다. 분기 ③계층의 흐름이다. 업무 쓰기는 api가 검증한 뒤 stream:biz:cmd에 명령으로 싣고, 워커의 소비자 그룹 grp:biz-writer가 기존 쓰기 서비스로 PostgreSQL 트랜잭션 하나에 반영한다(사용자 결정 2026-09-27 · D-04 · REQ-GLB-12 개정). **응답은 여전히 동기다** — api는 워커의 커밋 결과를 받은 뒤에만 기존과 같은 상태 코드 · 본문으로 응답하므로 커밋 응답 직후의 재조회가 새 값을 보고(read-your-writes), 변경 · 감사 · 멱등 원장이 한 트랜잭션이다. 옛 판정(Stream 비경유)의 두 근거를 새 기전이 어떻게 지키는지는 §업무 명령 경로와 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) §업무 쓰기가 명령 스트림을 타는 방식이 갖는다.

**Redis에 오는 것은 명령이지 진실이 아니다.** 진실은 PostgreSQL 업무 행 하나이고, stream:biz:cmd는 명령 버퍼 · biz:result는 결과 우편함 · cache 계열은 사본이다. 업무 명령은 수집 스트림(stream:plc:raw)과 다른 키 · 다른 그룹이라 ING는 여전히 ③을 받지 않는다([04_routing.md](./04_routing.md) §③ 업무 쓰기).

**이 문서가 무효화 체인 단계 번호의 정본이다.** 원본 체인은 4단(커밋 → Redis 삭제 → Pub/Sub → Dictionary 재적재)이었지만 이 시스템의 사본은 Redis · Dictionary · BFF 서버 fetch 캐시 · 브라우저 쿼리 캐시 넷이라, 원본 설계대로면 "마스터 수정 후 즉시 반영" 검증이 반드시 실패한다(원본 implementation_plan.md §7.4). ADR-12가 체인을 6단으로 늘렸고 이 문서가 그 기전을 고정한다.

## 읽기 · 쓰기 경로

원본 CRUD 시퀀스(원본 data_flow.md §7)를 두 경로의 단계 체인으로 옮긴다.

```plain
읽기  브라우저 → BFF(httpOnly 쿠키 → 액세스 토큰) → api(Bearer)
         → CacheKeyClient GET 목록 사본 ── 히트 → 응답
                                        └─ 미스 · 실패 → PostgreSQL(in-process 풀) → TTL 쓰기 → 응답
         → BFF 서버 fetch 캐시(목록 · 마스터만 · 작업지시는 no-store) → 브라우저

쓰기  브라우저 → BFF → api → 요청 검증(공유 스키마) · 역할 검사 → 대기 맵 등록 → XADD stream:biz:cmd → 대기(상한 5초)
         → 워커 grp:biz-writer → BEGIN → 업무 행 변경 → audit_log(before · after) → biz_command_log → COMMIT
         → 워커 체인 ②③ → SET biz:result:{cmdId} → PUBLISH ch:bizreply → api 응답 → BFF 체인 ⑤ → 브라우저
         · 체인 ④ ⑥은 응답과 독립으로 진행 · 5초 안에 결과가 없으면 202 pending
```

- **캐시는 커밋 뒤에만 지우고, 새 값으로 덮지 않고 지운다**(ADR-12). 커밋 전에 지우면 그 사이 조회가 옛 값으로 캐시를 다시 채워 커밋 뒤에도 영구히 낡은 값이 남고, 덮어쓰면 동시 갱신에서 쓰기 순서가 뒤집혀 낡은 값이 최종으로 남는다(원본 data_flow.md §7.1).
- **체인 ②③이 결과 SET 앞에 있는 것이 read-your-writes의 기전이다.** api는 결과를 받아야 응답하고 워커는 ②③을 마쳐야 결과를 낸다 — 쓴 사람의 다음 조회는 BFF(⑤로 비워짐) → api → Redis(②로 비워짐) → PostgreSQL로 가서 새 값을 본다.
- **읽기 경로는 바뀌지 않는다.** 명령 스트림은 쓰기만 탄다 — 읽기는 기존대로 PostgreSQL 직접(+ cache 계열)이다.
- PostgreSQL 커넥션은 in-process 풀이다(ADR-19 · 원본 현행 참고 max 20) — 읽기는 api 풀, 명령 적용은 워커의 같은 풀에서 한 번에 커넥션 하나만 쓴다(직렬). 커넥션 고갈은 읽기 쪽 1차 병목 후보로 남고([01_flow_inventory.md](./01_flow_inventory.md) 병목 #8), 쓰기 쪽 1차 병목 후보는 직렬 적용의 처리량이다(병목 #15).

## 업무 명령 경로

사용자 결정(2026-09-27 — 모든 데이터가 Redis를 거쳐 분산 처리된다)의 기전이다. **표면 계약(상태 코드 · 본문 · 오류 카탈로그)은 바꾸지 않고 적용 주체와 경로만 바꾼다** — 요청 모양 · 202 본문 · 명령 조회 표면 · 명령 식별자를 싣는 방법의 정본은 [../07_api/01_conventions.md](../07_api/01_conventions.md)다.

### 명령 봉투

| 필드 | 뜻 | 누가 정하는가 | 없거나 어기면 |
|------|------|------|------|
| cmdId | UUID — **멱등 키** · biz_command_log.cmd_id · biz:result 키의 식별자 | 요청 헤더 Idempotency-Key가 있으면 그 값 · 없으면 api가 발급 · 응답은 같은 헤더로 되싣는다([../07_api/01_conventions.md](../07_api/01_conventions.md)) | 재시도마다 새 cmdId면 같은 쓰기가 두 번 적용된다 — 클라이언트 재시도는 같은 cmdId를 다시 보낸다 |
| kind | 쓰기 종류 — 도메인.대상.동작(예 master.site.create · alarm.rule.patch · alarm.event.ack) | api — 표면 하나가 kind 하나 | 워커가 모르는 kind는 REJECTED(validation) — 적용 서비스를 고를 수 없다 |
| payload | 스키마 검증을 통과한 요청 본문 · 경로 식별자 | api — 기존 공유 스키마 검증 그대로 | 검증은 api에서 끝난다 — 워커는 형식 오류를 다시 거르지 않고 도메인 규칙(UNIQUE · FK · CHECK · 조건부 갱신)만 본다 |
| actor | 행위자 user_id · 인증 전(S7 ② 전)은 NULL — 원장 biz_command_log.actor · 결과 키 actor에 그대로 싣는다 | api — 인증 주체에서 | 워커가 행위자를 스스로 고르면 감사 행위자가 요청과 어긋난다([../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §인계 판정) · 원장 · 결과 키에 없으면 명령 조회가 요청자를 대조할 수 없어 남의 명령 결과를 돌려준다 |
| requestedAt | api 수신 시각 epoch ms | api | 명령 유효 창(아래)을 잴 기준이 없다 |

- 검산: 봉투 필드 = **5**
- **봉투 → 원장 대응** — cmdId → cmd_id · kind → kind · actor → actor · requestedAt → requested_at · payload는 원장에 싣지 않는다(적용 결과만 result에 · 원장 컬럼 정본 [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) §biz_command_log 설계). 결과 키 biz:result도 actor를 싣는다 — 명령 조회는 결과 키 또는 원장의 actor가 요청자와 다르면 404다(둘 다 NULL이면 같다고 본다 · 표면 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) §명령 조회 표면).
- **엔트리 하나 = 명령 하나다.** 배치로 묶지 않는다 — 묶으면 한 명령의 도메인 오류가 같은 엔트리의 다른 명령 결과까지 붙잡는다.

### 적용 단계

명령 하나가 요청에서 응답까지 지나는 단계다.

```plain
① api 검증 · 등록 · XADD  스키마 검증 · 역할 검사 뒤 대기 맵 등록 → XADD stream:biz:cmd 봉투 1 · MAXLEN ~(등록이 먼저)
② 워커 소비             lock:biz:writer를 쥔 워커의 소비자 biz-writer-1 — 기동 시 자기 PEL(ID 0) 소진 뒤 > · 직렬
③ 멱등 확인             biz_command_log에 cmd_id가 있으면 그 결과를 다시 SET · 알림 · XACK(적용 없음)
④ 유효 창 확인           requestedAt + 명령 유효 창을 넘었으면 EXPIRED 행 · 결과 SET · XACK(적용 없음)
⑤ 트랜잭션              BEGIN → 기존 쓰기 서비스(업무 행 · audit_log) → biz_command_log INSERT(APPLIED) → COMMIT
⑥ 무효화 체인 ②③        커밋 뒤 cache 계열 DEL · ch:cacheinv 발행(기존 invalidation-chain 그대로)
⑦ 결과 · 알림            SET biz:result:{cmdId}(TTL) → PUBLISH ch:bizreply(cmdId) → XACK → 흐름 요약 PUBLISH ch:flow(표지 있을 때만)
⑧ api 응답              구독자 1이 cmdId를 대기 맵에서 찾아 결과 키를 읽고 기존 상태 코드 · 본문으로 응답
⑨ 응답 뒤               체인 ④(tag_master 변경만 · 워커) · ⑤(BFF) · ⑥(RLT 중계)
```

- **⑥이 ⑦보다 앞이다(리드 판정).** 결과가 먼저 나가면 응답을 받은 화면의 재조회가 ② 삭제 전 옛 사본을 읽는다 — read-your-writes가 캐시 층에서 깨진다.
- **②가 소비자 1인 이유** — 업무 쓰기의 순서를 스트림 순서 그대로 보존한다(같은 행의 두 PATCH가 뒤집히지 않는다). 처리량은 사람이 일으키는 업무 쓰기 규모라 충분하며, 직렬 처리량이 실제 상한인지는 EXP-46이 잰다(3계층 미확인). **소비자 1은 락이 강제한다(리드 판정)** — 워커는 lock:biz:writer(획득 스크립트 — 비었으면 SET PX · 값이 내 토큰이면 PEXPIRE · 현행 참고 TTL 15초 · 5초마다 토큰 확인 갱신 · 종료 시 토큰 확인 해제)를 쥔 동안만 grp:biz-writer를 소비하고, 못 쥔 워커는 5초마다 다시 쥐려 하며 대기한다. **락 연산(획득 · 갱신 · 해제)의 Redis 호출 상한은 500 ms**다(캐시 읽기의 50 ms가 아니다). 갱신 결과가 **소유자 아님**이면 즉시 소비를 멈추고, **불확실**(시간 초과 · 오류)이면 락을 유지한 채 소비를 잇고 다음 주기에 다시 갱신한다 — 단 다음 갱신 주기 전에 마지막 확인(획득 · 이어 쓰기 · 갱신 성공 — 시각은 호출을 **보낸** 시각) 뒤 TTL이 지날 수 있으면 그 주기에서 멈추고, 명령 처리 루프도 확인 뒤 TTL이 지나면 멈춘다(남은 명령은 PEL에 남아 재획득 뒤 PEL부터). 루프 판정은 **명령 시작 기준**이다 — 만료 뒤 새 명령을 시작하지 않을 뿐 이미 시작한 1건은 끝까지 가므로, 그 1건과 이어받은 워커의 PEL 재읽기가 겹칠 수 있고 이중 적용은 원장 UNIQUE(③)가 막는다(잔여). 획득은 값이 내 토큰(워커 인스턴스 UUID)이면 PEXPIRE로 이어 쓴다(한 스크립트 — 원자). 소비자 이름 고정(biz-writer-1)만으로는 두 워커가 같은 이름으로 동시에 읽는 것을 막지 못한다. 쥔 워커가 죽으면 TTL 뒤 다른 워커가 이어받아 **PEL(XREADGROUP ID 0)을 먼저 소진한 뒤 > 로 읽는다** — 새 명령이 죽은 워커의 미확인 명령을 앞지르지 않는다(키 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)). ①에서 대기 맵 등록이 XADD보다 먼저인 것은 워커가 빨리 끝내 알림이 등록 전에 오면 api가 그 알림을 버리고 대기 상한까지 기다리기 때문이다.
- **흐름 요약(event biz)은 명령 1건당 1건을 결과 알림 뒤에 낸다(EXP-FLOW · 정본 [../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 — flow).** 발행 주체는 워커(SW-12 direct면 api가 커밋과 체인 ②③ 뒤)이고 필드는 cmdId · kind · **role(biz-writer = 명령 워커 · api-direct = SW-12 direct)** · stages(queueWaitMs ② XREADGROUP 수신까지 · txMs ⑤ · invalidateMs ⑥ · replyMs ⑦) · result · duplicate다 — APPLIED · REJECTED · EXPIRED · **failed(PostgreSQL 불가 결과 — 결과 키만)** · 멱등 재적용 모두 낸다. 구독 중 표지(cache:flow:subscribed)가 없으면 요약을 만들지도 내지도 않고(표지 키 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)), 발행 실패는 계수하고 삼킨다 — 관찰 채널이 적용 · 응답을 막지 않는다. 결과 알림보다 먼저 내면 응답을 받기 전 화면이 적용을 먼저 보인다.
- **XACK는 결과 SET 뒤다.** 결과를 내기 전에 워커가 죽으면 명령은 PEL에 남고, 락을 다시 쥔 워커(또는 이어받은 워커)가 **자기 PEL(XREADGROUP ID 0)을 먼저 소진**하며 다시 읽는다 — 바퀴 중 예외(결과 SET · XACK · 읽기 실패) 뒤에도 다음 바퀴는 PEL부터 읽는다(> 로 받고 XACK하지 못한 명령은 > 로 다시 오지 않는다) · ③이 이중 적용을 막는다. 소비자가 하나로 고정이라 XAUTOCLAIM은 쓰지 않는다. ⑤ 적용이 커밋된 뒤 ⑦ 결과 SET · XACK에서 난 예외는 적용 실패가 아니다 — 결과 키를 FAILED로 덮지 않고 바퀴로 올려 PEL 재읽기에 맡긴다(③이 원장 APPLIED로 같은 결과를 다시 SET).
- 적용 주체는 워커 역할(APP_ROLE worker)이며 APP_ROLE all이면 같은 프로세스 안에서 돈다 — 같은 프로세스여도 스트림을 거친다(비동기 경계를 역할 배치와 무관하게 둔다). 그룹은 기동 시 **XGROUP CREATE stream:biz:cmd grp:biz-writer 0 MKSTREAM**으로 만든다(이미 있으면 그대로) — 시작 ID를 $로 두면 그룹 생성 전에 api가 실은 명령을 영영 읽지 않는다.

### 멱등 · 재전달

| 경우 | 워커가 보는 것 | 동작 | 결과 |
|------|------|------|------|
| 첫 전달 | biz_command_log에 행 없음 | ⑤ 트랜잭션 | APPLIED 행 · 결과 SET |
| 도메인 오류(UNIQUE · FK · CHECK · 조건부 갱신 0행) | ⑤ 롤백 | 롤백 뒤 **별도 트랜잭션**으로 REJECTED 행(오류 코드 · 세부) | 결과에 오류 코드 — api가 기존 HTTP 오류로 옮긴다 |
| 재전달(PEL 재읽기 ID 0 · 워커 재기동 · 바퀴 예외) · 같은 cmdId 재요청 | 행 있음 — 재기동 · 이어받기는 자기 PEL(ID 0)을 먼저 소진하므로 재전달이 새 명령보다 먼저 온다 | 적용 없이 저장된 결과를 다시 SET · 알림 | 첫 응답과 같은 상태 코드 · 본문 |
| 커밋 뒤 결과 SET 전 크래시 | 행 있음(커밋됨) | 재전달이 ③에서 저장된 결과를 낸다 | 이중 적용 없음 |
| PostgreSQL 불가 | 트랜잭션도 원장 행도 쓸 수 없다 — ③ 원장 확인도 못 한다 | **재시도하지 않고** 결과 = common.postgres_unavailable SET(명령 조회 failed) · XACK | 503 — 보관 · 재생 없음(REQ-WRK-06) · 같은 cmdId 재요청은 ③부터 다시 — 원장 행이 있으면 저장된 판정, 없으면 적용을 시도한다 |
| 만료 뒤 같은 cmdId 재요청 | EXPIRED 행 있음(result = 결과 키와 같은 모양 {"status":"EXPIRED","actor":…} — httpStatus 없음) | 적용 없이 저장된 결과를 다시 SET · 알림 | **202 + {cmdId, status: 'expired'}** — 새 코드 없음 · 적용 없음 · 새 키로 보내라는 뜻 |

- 검산: 경우 = **6**
- **B형 — 도메인 오류도 원장에 남긴다.** 결론 — 같은 cmdId는 첫 판정(APPLIED 또는 REJECTED)에 고정된다. 반대 시나리오 — 오류를 남기지 않으면 409를 받은 요청을 재시도할 때 그 사이 경합 상대가 사라져 성공해, 같은 cmdId가 한 번은 409 · 한 번은 201이 된다. 파생 지침 — 새 시도는 새 cmdId다.
- **원장 행이 멱등의 유일한 근거다.** biz:result는 TTL이 있는 캐시 계열이라 축출 · 만료될 수 있다 — 결과 키가 없으면 워커 · 명령 조회가 원장 행을 읽는다([../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)).
- **같은 cmdId · 다른 본문은 첫 결과를 받는다** — 원장은 본문을 대조하지 않는다(한계 등재 #24).
- **failed는 '적용되지 않았다'가 아니라 '적용 여부를 확정하지 못했다'다.** 재전달된 명령이 이미 커밋된 뒤 PostgreSQL이 불가하면 원장 확인도 못 해 failed가 된다 — 같은 키 재요청으로 확정한다(원장이 돌아오면 applied · 한계 등재 #26 [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md)).

### 시간 초과 · 명령 조회

| 상황 | api 응답 | 이후 |
|------|------|------|
| 대기 상한(5초) 안에 결과 도착 | 기존 상태 코드 · 본문(201 · 200 · 409 · 400 등) | 해당 없음 |
| 대기 상한 초과 | **202 + {cmdId, status: 'pending'}** | 명령은 버리지 않는다 — 워커가 적용하면 결과가 결과 키 · 원장에 남는다 |
| 명령 조회 GET /api/v1/commands/{cmdId} | 결과 키 → 없으면 biz_command_log → 둘 다 없으면 pending · 상태 pending · applied · rejected · expired · failed · 결과 키 또는 원장의 actor가 요청자와 다르면 404(둘 다 NULL이면 같다) — 표면 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md) | 결과 키는 TTL(현행 참고 300초) 뒤 사라지고 원장이 남는다 |
| 명령 유효 창 초과(워커 장기 정지 뒤) | 조회 시 expired(원장 EXPIRED · result = 결과 키와 같은 모양 {"status":"EXPIRED","actor":…} — httpStatus 없음) · 같은 키 재요청은 **202 + {cmdId, status: 'expired'}** | **적용하지 않는다** — 사용자가 포기한 쓰기가 한참 뒤 반영되지 않게 한다. 창 = 결과 키 TTL과 같은 값(현행 참고 300초) · 다시 쓰려면 새 키로 보낸다 |

- 검산: 상황 = **4**
- **조회 상태와 원장 status는 같은 집합이 아니다.** applied · rejected · expired는 원장 status(APPLIED · REJECTED · EXPIRED — 3값 그대로)를 읽은 값이고, **failed는 결과 키에만 있는 값**이다 — PostgreSQL 불가면 워커가 원장 행 없이 결과 키에 common.postgres_unavailable 503만 남기므로(§멱등 · 재전달) 결과 키가 만료되면 같은 명령은 pending으로 보인다. pending은 결과 키도 원장도 없는 상태다. 값 사전 [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md).
- **대기 상한 5초는 2계층 조정값이다(현행 참고 · 리드 판정).** 원본 CRUD 목표 100 ms의 50배 — 정상 경로에서는 닿지 않고 워커 정지 · 적체에서만 닿는다. 상한 초과 비율은 biz_command_seconds로 드러난다([../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md)).
- **202를 받은 쓰기에는 BFF ⑤가 걸리지 않는다** — 성공 응답이 아니다. 대신 화면이 명령 조회로 applied를 확인하면 로컬 무효화에 더해 **신선 창 표지(x-bff-fresh)를 단 재조회**로 BFF 서버 사본을 건너뛰고 비운다(판정 [../08_screen/01_standards.md](../08_screen/01_standards.md) §업무 쓰기 응답 — 명령 경로). 적용 확인 시점에는 워커가 ②③을 이미 마쳤으므로(⑥이 ⑦보다 앞) 그 재조회는 api → PostgreSQL로 새 값을 본다 — §무효화 체인 6단의 신선 창과 같은 기전이다.
- **api 대기 맵은 인스턴스 로컬이다.** 알림은 모든 api 인스턴스에 가고 cmdId를 가진 인스턴스만 응답한다 — 확장 2단계에서도 구독 재작성이 없다(ADR-07과 같은 이유).

### 실패 의미 · 스위치

| 실패 | 요청 결과 | 근거 |
|------|------|------|
| 도메인 오류 | 워커가 결과에 코드로 담고 api가 **기존 HTTP 오류**로 옮긴다 — 오류 카탈로그 불변 | 리드 판정 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) |
| Redis 불가(XADD 실패) | **503 common.postgres_unavailable — 업무 쓰기도 멈춘다.** 새 코드 없이 PostgreSQL 불가와 한 코드다 — 클라이언트 대응이 같다 · 원인은 biz_commands_total result 레이블이 가른다 — Redis 불가 = unavailable · PostgreSQL 불가 = failed(표면 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md)) | **새 대가** — 옛 경로는 Redis 불가 중에도 업무 쓰기가 됐다 · 읽기는 기존대로 PostgreSQL 직행(REQ-GLB-09) |
| 발행 · 구독 끊김 | 알림을 못 받은 api는 대기 상한에서 202 | 명령은 적용됐고 조회가 결과를 낸다 |
| 워커 정지 | 대기 상한에서 202 · 유효 창 안에 재기동하거나 다른 워커가 lock:biz:writer TTL(현행 참고 15초) 뒤 이어받으면 PEL부터 적용 · 넘으면 EXPIRED | biz_stream_lag로 드러난다 |

- 검산: 실패 = **4**
- **SW-12 BIZ_WRITE_PATH = stream(기본) · direct.** direct는 옛 경로(api가 트랜잭션을 직접 커밋 · 명령 스트림 · 원장 · 결과 키 없음)이며 비교 실험 EXP-46(업무 쓰기 지연 · 처리량 · Redis 장애 시 가용성 — direct 대 stream)용이다. 두 구현은 같은 쓰기 서비스 · 같은 무효화 체인을 부르므로 표면 응답이 같다 — 스위치 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md).
- **direct에서는 원장이 없어 같은 cmdId 재요청이 막히지 않는다** — 멱등은 stream 경로의 성질이다. EXP-46은 이 차이를 가용성 · 지연과 함께 적는다.
- 대상 범위 — 구현된 업무 쓰기(마스터 5종 · 알람 규칙 POST · PATCH · 알람 ACK)가 이 경로를 탄다. 작업지시 · 실적 · 감사 쓰기(S7 ②)도 같은 기전을 따른다. **로그인 · 토큰 갱신 · 로그아웃은 대상이 아니다** — 업무 데이터가 아니라 인증 경로다(§인증 흐름).

## BFF 경유 기준

| 요청 | 경로 | BFF 서버 fetch 캐시 | 이유 | 반대로 두면 |
|------|------|------|------|------|
| 로그인 · 토큰 갱신 · 로그아웃 | 브라우저 → BFF → api | 없음 | httpOnly 리프레시 쿠키를 서버에서만 다룬다 — **BFF가 남는 가장 중요한 이유** | 직결이면 브라우저 JS가 리프레시 토큰을 다뤄 XSS 한 번에 장기 토큰이 샌다 |
| 설비 · 태그 · 사이트 목록 | 브라우저 → BFF → api | 있음(현행 참고 revalidate 30초) | 저빈도 · 사용자 공통 — BFF가 흡수한다 · **사이트 · 라인 · 태그 목록은 Redis 사본을 두지 않는다**(W5 판정 — BFF가 유일한 목록 사본) | 직결이면 목록 요청이 전부 api에 닿고 사이트 · 라인 · 태그 목록은 PostgreSQL까지 간다 |
| 마스터 쓰기 | 브라우저 → BFF → api | 쓰기 성공 시 해당 태그 무효화(⑤) | 웹 오리진 하나로 쿠키 · CORS가 단순하다 | 직결이면 BFF 캐시가 쓰기를 모르고 옛 목록을 30초 낸다 |
| 작업지시 · 실적 · 알람 규칙 | 브라우저 → BFF → api | **no-store** | ③계층 read-your-writes — 상태 전이 직후 목록이 옛 상태면 전이 요청이 두 번 온다 | 캐시하면 체인 ⑤를 작업지시에도 걸어야 해 체인이 넓어진다 |
| 최신값 조회 | 브라우저 → api 직결 | 해당 없음 | 초당 수 회 — 고빈도에 1홉을 더할 이유가 없다 | [05_realtime_read.md](./05_realtime_read.md) |
| 시계열 조회 | 브라우저 → api 직결 | 해당 없음 | 응답이 크고 사용자별이라 중계 · 캐시 이득이 없다 | [06_timeseries_read.md](./06_timeseries_read.md) |
| WebSocket | 브라우저 → api 직결 | 해당 없음 | 장기 연결을 BFF가 중계할 이유가 없다 | [05_realtime_read.md](./05_realtime_read.md) |

- 검산: 요청 유형 = **7** · BFF 경유 4 + 직결 3
- **직결 경로의 보호 장치는 CORS 허용 오리진 하나(http://localhost:13001) · Bearer 액세스 토큰 · WebSocket Origin 검증이다.** 포트가 다르면 오리진도 달라 로컬에서도 CORS가 필요하다(AUT-07). localhost:13001과 localhost:13000은 same-site라 SameSite=Lax 쿠키가 그대로 동작하고, 로컬 http에서는 Secure만 끄고 httpOnly는 유지한다.
- **알람 규칙을 no-store에 넣은 것은 이 문서의 판정이다.** 규칙 변경은 판정 결과를 바꾸는 쓰기라(REQ-ALM-02) 엔지니어가 저장 직후 옛 임계값을 보면 규칙을 다시 고친다 — 작업지시와 같은 read-your-writes 요구다.

## 무효화 체인 6단

**단계 번호의 정본이다.** ①이 트랜잭션 커밋이고 ②~⑥은 커밋 뒤에만 건다. 업무 명령 경로(SW-12 stream)에서 ①~④의 주체는 워커이고 "응답 전"은 **결과 SET 전**을 뜻한다 — api는 결과를 받아야 응답하므로 순서 계약이 그대로 옮겨 간다. SW-12 direct에서는 옛 주체(api)가 같은 순서로 건다.

| 단 | 동작 | 주체 | 응답 전 · 후 | 대상 층 | 이 단이 없으면 |
|:-:|------|------|------|------|------|
| ① | 트랜잭션 커밋(변경 + 감사 + biz_command_log) | 워커 — 기존 변경 도메인 서비스 | 전 | PostgreSQL | 해당 없음 — 체인의 전제 |
| ② | Redis 캐시 삭제(DEL · 목록 Hash는 키 하나 DEL) | 워커 · CacheKeyClient | **전** | Redis cache 계열 | TTL(현행 참고 600초)만큼 옛 사본 |
| ③ | ch:cacheinv 발행 — 무효화된 키 이름 | 워커 · FanoutPublisher | 전 | 다른 api 인스턴스 · Collector · 브라우저 중계 | 확장 2단계에서 다른 인스턴스의 로컬 캐시가 옛 값 · Collector가 마스터 변경을 모른다 |
| ④ | SYSTEM RELOAD DICTIONARY plc.dict_tag — **tag_master 변경일 때만** | 워커 | **후 — 응답을 기다리게 하지 않는다** | ClickHouse Dictionary | LIFETIME(현행 참고 최대 600초)만큼 트렌드 화면에 옛 이름 |
| ⑤ | BFF 서버 fetch 캐시 태그 무효화 | BFF — 쓰기 성공 응답을 받은 직후 | BFF 응답 전 | Next.js 서버 캐시 | revalidate 창(현행 참고 30초)만큼 옛 목록 |
| ⑥ | WebSocket 무효화 신호 → 브라우저 쿼리 캐시 무효화 | RLT 중계(RLT-09 · ch:cacheinv 구독) | 후 | 브라우저 쿼리 캐시 | staleTime만큼 다른 사용자 화면에 옛 값 |

- 검산: 단 = 커밋 1 + 커밋 뒤 5 = **6** — ADR-12와 같다 · 응답 전 3(①②③) · BFF 응답 전 1(⑤) · 응답 후 2(④⑥)
- **④를 응답 뒤로 둔 것은 이 문서의 판정이다.** 재적재는 tag_master 전체를 다시 읽는 동기 명령이라 태그 수에 비례해 느려진다 — 응답 앞에 두면 CRUD 지연 예산(원본 목표 80 ms)에 재적재 시간이 더해진다. 대가는 커밋 직후 수백 ms 동안의 옛 이름이며, 설비 · 사이트 쓰기는 dict_tag 내용(태그 필드 · device_id)을 바꾸지 않으므로 ④를 걸지 않는다.
- **⑤의 주체가 BFF인 이유** — Next.js 서버는 호스트 프로세스 하나이고 마스터 쓰기가 전부 BFF를 지나므로, 쓰기 성공을 본 BFF가 스스로 무효화하면 된다. **잔여 — BFF를 거치지 않은 쓰기**(k6 · 수동 호출이 api에 직결)는 ⑤가 걸리지 않아 revalidate 창만큼 옛 목록이 남는다.
- **⑥은 쓴 사람의 브라우저에도 필요 없다 — 자기 쓰기 성공에서 로컬 무효화한다.** ⑥은 다른 사용자 화면을 위한 단이다. 신호의 키 이름 → 쿼리 키 대응은 [../08_screen/01_standards.md](../08_screen/01_standards.md) §무효화 신호 수신이 정한다(W5 닫힘).
- **③의 페이로드는 무효화된 키 이름(접두 포함)의 JSON 배열이다(S4 as-built).** 한 쓰기의 키는 한 메시지로 낸다 — 새 태그 발급은 이전 · 새 tag_id 두 키가 한 메시지에 실린다. 게이트웨이는 이 배열을 cacheinv 메시지의 keys로 그대로 옮기고 병합하지 않는다.
- **A형 — "⑥이 ⑤보다 먼저 온다"는 체인 순서의 결함이 아니라 구조다(S4 검수 M5).** 통념은 번호 순서대로 층이 비워진다는 것이다. 부정 — ③은 api 응답 전에 발행되고 ⑤는 BFF가 api 응답을 받은 뒤에 걸리므로, 다른 탭의 신호 → 재조회가 BFF에 먼저 닿으면 서버 사본의 옛 목록을 받는다(기록 021 — 신호 도착이 쓰기 응답과 같은 시각). 진짜 축은 **신호 뒤 첫 읽기가 어느 층을 거치는가**다. 대체 경로 — 셸이 master 계열 신호를 받으면 2초 신선 창을 열고, 창 안의 목록 조회는 표지(x-bff-fresh)를 달아 BFF가 서버 사본 없이 api를 읽고 사본도 비운다. 재연결 무효화에는 신선 창을 열지 않는다 — 쓰기는 이미 ⑤로 비웠고 전 탭 재연결이 api로 몰리지 않게 한다.
- ch:cacheinv는 SW-06의 대상이 아니다 — 끄면 정합성 계약이 스위치 상태에 따라 달라진다(ADR-12 파급).

### 체인 번호 대응

원본 · 선행 문서가 커밋을 번호에 넣지 않은 5단 표기로 적은 자리가 있다. 이 문서의 번호가 정본이며 대응은 **5단 표기 번호 + 1 = 6단 번호**다.

| 6단(정본) | 옛 5단 표기(원본 · 선행 초안) | 원본 4단 |
|:-:|:-:|:-:|
| ① 커밋 | 번호 없음 | 1 |
| ② Redis 삭제 | ① | 2 |
| ③ ch:cacheinv | ② | 3 |
| ④ Dictionary 재적재 | ③ | 4 |
| ⑤ BFF 무효화 | ④ | 없음 — 보정 7.4 |
| ⑥ 브라우저 무효화 | ⑤ | 없음 — 보정 7.4 |

- 검산: 대응 행 = **6**
- 5단 표기를 쓰는 선행 문서의 단 번호 인용(RLT-09 "⑤단" · REQ-WRK-03 "④ · ⑤단" 등)은 이 표로 읽는다. 표기 통일은 W4에서 선행 문서에 반영했다.

## 도메인별 체인 적용

모든 업무 쓰기가 6단 전부를 걸지 않는다. 사본이 있는 층만 건다.

| 쓰기 | ② Redis 삭제 | ③ ch:cacheinv 키 | ④ Dictionary | ⑤ BFF | ⑥ 브라우저 |
|------|------|------|:------:|:------:|:------:|
| 태그 등록 · 수정 · 비활성화 · 스케일 변경 | cache:tagmeta:{tag_id}(발급 · 비활성화 둘 다) | cache:tagmeta:{tag_id} | 건다 | 건다 | 건다 |
| 설비 등록 · 수정 · 비활성화 | cache:devlist:{site_id} | cache:devlist:{site_id} | 없음 | 건다 | 건다 |
| **modbus_config 수정** | 없음 — 사본 키가 없다 | **cache:devlist:{site_id}** | 없음 | 없음 | 없음 |
| 사이트 · 라인 | 없음 — **Redis 사본을 두지 않는다**(W5) | 없음 — 실을 키 이름이 없다 | 없음 | 건다 | 없음 — 다른 사용자 화면은 staleTime만큼 옛 목록 |
| 알람 규칙 | cache:alarmrules | cache:alarmrules | 없음 | no-store | 건다 |
| 알람 확인(ACK) | cache:alarmevents(키 하나) | 없음 | 없음 | no-store | 없음 — ch:alarm 목록 재조회가 맡는다 |
| 작업지시 · 실적 | cache:workorders(키 하나) | 없음 | 없음 | **no-store** | 없음 |
| 역할 변경 | cache:perm:{user_id} | cache:perm:{user_id} | 없음 | 없음 | 없음 |

- 검산: 쓰기 유형 = **8**
- **modbus_config만 바꾸는 쓰기도 ③을 낸다(이 문서 판정).** 지울 사본은 없지만 Collector가 ch:cacheinv로 접속 설정 변경을 알고 그 설비를 다시 읽는다([02_collect.md](./02_collect.md) §실행 중 마스터 변경 반영). 신호가 없으면 접속 설정 변경이 api 재기동 전까지 폴링에 반영되지 않는다.
- **작업지시에 ③ · ⑥을 걸지 않는 이유** — Redis 목록은 Hash 키 하나라 ②로 조합 전부가 지워지고, BFF는 no-store이며, 다른 사용자 화면은 cache:workorders TTL(현행 참고 60초)만큼 늦는 것을 허용한다. ③계층의 read-your-writes는 **쓴 사람**의 보장이다.
- **사이트 · 라인 · 태그 목록에 Redis 사본을 두지 않는다(W5 리드 판정 · 키 패턴 수 불변).** 목록은 저빈도 · 사용자 공통이라 BFF 서버 fetch 캐시가 흡수하고, Redis 사본을 더 두면 ②단의 삭제 대상만 늘고 흡수할 요청이 남지 않는다. 태그 목록 표면은 PostgreSQL을 읽고 태그 단건 · 메타 부착만 cache:tagmeta:{tag_id}를 쓴다([../07_api/04_master.md](../07_api/04_master.md)).
- 태그 스케일 변경은 새 tag_id 발급 · 이전 태그 비활성화 · tag_master_history · audit_log가 한 트랜잭션이고(REQ-MST-07) 두 tag_id 모두 ②③을 건다.

## 작업지시 no-store와 목록 Hash

W3 판정(cache:workorders Hash · BFF no-store)의 기전이다.

| 항목 | 규칙 | 근거 | 어기면 |
|------|------|------|------|
| Redis 사본 | cache:workorders Hash — 필드 = 정규화 목록 쿼리 SHA-1 · 값 = gzip JSON | 필터 · 범위 조합마다 결과가 달라 키가 여럿 생긴다 | 조합별 흩은 키면 쓰기 한 건의 무효화에 KEYS가 필요하다 — KEYS는 금지다 |
| 만료 | 첫 필드 채움 시 1회(EXPIRE NX) · 현행 참고 60초 | 어떤 조합도 TTL보다 오래 낡지 않는다 | 필드마다 만료를 갱신하면 인기 조합이 영원히 안 낡는다 |
| 무효화 | 작업지시 · 실적 쓰기 커밋 뒤 키 하나 DEL | 조합 전부가 한 번에 지워진다 | 해당 없음 |
| BFF | no-store | ③계층 read-your-writes | 전이 직후 목록이 revalidate 창만큼 옛 상태 |
| 상태 전이 | 현재 상태 확인과 쓰기를 조건부 갱신 하나로 | REQ-WRK-04 | 동시 전이 두 건이 둘 다 성공한다 |

- 검산: 항목 = **5**
- 같은 모양을 cache:alarmevents(ACK 뒤 키 하나 DEL · 현행 참고 30초)가 쓴다.

## 층별 옛 값의 창

마스터 쓰기 하나 뒤 각 층이 옛 값을 보일 수 있는 최대 창이다. 반영 시간은 **3계층 미확인**이며 원본 값은 원본 예상치다([../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) §즉시 반영).

| 층 | 체인이 성공하면 | 체인 단이 실패하면 | 상한을 정하는 값 |
|------|------|------|------|
| Redis cache 계열 | 커밋 직후 0 — 응답 전에 지운다 | TTL까지(현행 참고 600초) | TTL · 소유 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| ClickHouse Dictionary | 응답 뒤 재적재 시간 | LIFETIME 최대(현행 참고 600초 · 원본 예상치 최대 10분) | LIFETIME · 소유 [../05_data_stores/03_clickhouse_schema.md](../05_data_stores/03_clickhouse_schema.md) |
| BFF 서버 fetch 캐시 | BFF 경유 쓰기면 0 | revalidate 창(현행 참고 30초) | [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md) |
| 브라우저 쿼리 캐시 | 신호 도달 시간 | staleTime | 상동 |
| 시계열 조회 캐시(cache:q) | **체인 대상 아님** — 결과에 붙은 이름이 TTL만큼 옛 이름 | 상동 | 완전 과거 TTL · [06_timeseries_read.md](./06_timeseries_read.md) |

- 검산: 층 = **5**
- **A형 — "마스터를 고쳤는데 트렌드 화면에 옛 태그명이 보인다"는 결함이 아닐 수 있다.** 통념은 체인이 전 층을 즉시 지운다는 것이다. 부정 — cache:q의 결과는 dictGet이 조회 시점에 붙인 이름을 그대로 담고 있어 체인이 건드리지 않는다. 진짜 축은 **이름이 결과에 굳었는가**다. 대체 경로 — 인수 기준 AC-06은 API 직결 · BFF · 브라우저 세 층의 첫 읽기를 대조하며 cache:q 히트를 제외한 조회로 판정한다.

## 체인 실패와 degrade

| 실패 | 요청 결과 | 남는 것 | 계측 | 근거 |
|------|------|------|------|------|
| PostgreSQL 불가 | 503 common.postgres_unavailable · 쓰기 보관 · 재생 없음 — 워커는 재시도하지 않고 이 결과를 SET · XACK | 없음 | 503 수 · biz_commands_total{result=failed} | REQ-WRK-06 · REQ-MST-14 |
| 감사 쓰기 실패 | 변경 전체 롤백 | 없음 | 롤백 수 | REQ-WRK-08 |
| Redis 불가 중 업무 쓰기(SW-12 stream) | **503 common.postgres_unavailable — 쓰기 멈춤**(재사용 · 표면 정본 [../07_api/01_conventions.md](../07_api/01_conventions.md)) · 명령을 싣지 못했으므로 적용 없음 | 없음 | biz_commands_total{result=unavailable} | 사용자 결정 2026-09-27 — 새 대가 |
| 워커 정지 · 적체 | 대기 상한 뒤 202 pending · 유효 창 안 재기동이면 적용 | 명령이 stream:biz:cmd에 남는다 | biz_stream_lag · 대기 시간 | §업무 명령 경로 |
| 명령 유효 창 초과 | 적용 없음 · 명령 조회 EXPIRED | biz_command_log EXPIRED 행 | 업무 명령 결과 계수 | REQ-WRK-06 재생 없음 |
| ② Redis 삭제 실패 | **요청 성공** — 캐시 계열 degrade | 옛 사본이 TTL까지 | 캐시 삭제 실패 계수 | REQ-MST-10 · 한계 등재 #14 |
| ③ 발행 실패 | 요청 성공 | 다른 인스턴스 · Collector가 변경을 모른다 | 발행 실패 계수 | FanoutPublisher 계수 · 삼킴 |
| ④ 재적재 실패 | 요청 성공(응답 뒤) | LIFETIME 자동 재적재로 수렴 | 재적재 실패 계수 | REQ-MST-10 |
| Redis 불가 중 목록 조회 | PostgreSQL 직행 · 200 | 지연 상승 | 캐시 실패 계수 | REQ-GLB-09 |
| Redis 불가 중 로그인 · 갱신 · 로그아웃 | 503 auth.token_store_unavailable | 없음 | 503 수 | REQ-AUT-14 |

- 검산: 실패 = **10**
- **B형 — Redis 삭제가 실패해도 쓰기를 실패시키지 않는다.** 결론 — 커밋은 이미 끝났고 진실은 PostgreSQL이다. 반대 시나리오 — 삭제 실패로 요청을 실패시키면 사용자는 새 요청으로 재시도하고(새 cmdId라 원장이 막지 못한다), 재시도는 이미 커밋된 변경을 한 번 더 요청한다(유일 제약 409 또는 중복 작업지시). 파생 지침 — 옛 사본은 TTL이 끊고 삭제 실패는 계수로 드러낸다.
- **A형 — "Redis가 멈췄는데 업무 저장까지 안 된다"는 결함이 아니다.** 통념은 Redis가 캐시라 멈춰도 업무 데이터는 PostgreSQL로 저장된다는 것이다. 부정 — 업무 쓰기의 경로가 명령 스트림이라 XADD가 실패하면 적용 주체에 명령이 닿지 않는다. 진짜 축은 **Redis가 쓰기 경로인가 사본인가**다 — 이제 쓰기 경로다. 대체 경로 — 읽기는 PostgreSQL 직행으로 계속되고, 가용성을 옛 경로와 비교하려면 SW-12 direct로 EXP-46을 돈다.
- **로그인은 degrade하지 않는다.** auth:refresh는 TTL을 가진 캐시 계열이지만 원천 DB가 없다 — 우회하면 폐기한 토큰이 유효해진다([../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) §실패 전략).

## 인증 흐름 — BFF 경유

| 흐름 | 단계 | Redis | PostgreSQL | 실패 |
|------|------|------|------|------|
| 로그인 | BFF → api 자격 증명 검증 → 액세스 JWT + 리프레시 발급 → auth:refresh 저장 → BFF가 httpOnly 쿠키 | auth:refresh 쓰기 | user_account 읽기 | 401 auth.invalid_credentials · 503 auth.token_store_unavailable |
| 토큰 갱신 | BFF가 쿠키의 리프레시로 새 액세스 토큰 → 원요청 1회 재전송 | auth:refresh 읽기 | 없음 | 401 auth.refresh_invalid(폐기 · 만료 · **메모리 압박 축출**) |
| 로그아웃 | auth:refresh DEL — 액세스 JWT는 만료까지 유효 | auth:refresh 삭제 | 없음 | 503 auth.token_store_unavailable |
| 역할 변경 | 트랜잭션 → cache:perm:{user_id} DEL | cache:perm 삭제 | user_role · audit_log | 체인 실패 표 |

- 검산: 흐름 = **4**
- **리프레시 토큰의 축출이 Stream 적체와 이어진다.** auth 계열은 volatile-lru 후보라 Stream이 메모리를 채우면 사용자가 로그아웃된다 — MAXLEN을 maxmemory보다 먼저 거는 이유다(ADR-21). 축출 연쇄 실험 중의 refresh_invalid는 정상 관측값이다.
- 토큰 수명(현행 참고 액세스 15분 · 리프레시 14일)의 정본은 [../12_security/01_authn_authz.md](../12_security/01_authn_authz.md)(W7)다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 층별 반영 시간 · CRUD p95 | 3계층 미확인 — 원본 예상치 Dictionary 최대 10분(④ 생략 시) · BFF 최대 30초 · CRUD 원본 목표 100 ms · **S4 기록**: 사건 순서 판정 AC-06 3/3 성립 · Dictionary 재적재 완료가 쓰기 응답 뒤 30~34 ms(기록 021 · 3e8a46d · 부하 실험 · S · 스위치 기본값) · CRUD p95는 EXP-36 | EXP-29(AC-06) · EXP-36 · REQ-NFR-09 |
| ⑥ 신호 키 → 브라우저 쿼리 키 대응 · staleTime 값 | **대응은 닫힘**(W5 — 신호 키 4 · staleTime은 가장 가까운 서버 층 수명 하한과 같다는 관계식) · staleTime 설정값 **W6 판정**(관계식 파생표 — 240 · 24 · 30 · 60 · 0초) | [../08_screen/01_standards.md](../08_screen/01_standards.md) §무효화 신호 수신 · [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)(W6) |
| BFF를 거치지 않은 쓰기의 ⑤ 누락 | 잔여 — revalidate 창만큼 | 한계 등재(W4 반영) |
| cache-aside 잔여 경합 | **한계 등재 완료(#22 · S4 검수 L7 · W3 알람 캐시 포함)** — 커밋 전에 PostgreSQL을 읽은 조회가 ② 삭제 뒤에 사본을 채우면 옛 태그 메타 · 설비 목록이 TTL(현행 참고 600초)만큼 남는다(알람 캐시 계열의 잔여 폭은 #22) · ②의 "지우기"는 이 순서를 막지 못한다(ADR-12는 덮어쓰기 경합만 막는다) · 잔여는 TTL과 다음 쓰기 신호가 끊는다 | [../05_data_stores/02_postgresql_constraints.md](../05_data_stores/02_postgresql_constraints.md) 한계 등재 #22 |
| 체인 번호 표기 통일(5단 → 6단) | 닫힘 — 문서군 전체가 6단 번호를 쓴다(W7 검수 반영) · 대응표는 원본 5단 표기를 읽을 때만 쓴다 | §체인 번호 대응 |
| 업무 명령 처리량 · 대기 시간 · direct 대 stream 지연 · Redis 장애 시 가용성 | 3계층 미확인 — 확정 전 임의 값 고정 금지 · 대기 상한 5초 · 결과 TTL · 유효 창 300초는 2계층 현행 참고(리드 판정) | EXP-46 · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 202 pending 뒤 화면의 적용 확인 · 무효화 | **닫힘** — 명령 조회로 applied 확인 → 로컬 무효화 + 신선 창 표지(x-bff-fresh) 재조회(08_screen/01 판정 · 기전 정합 확인 — §시간 초과 · 명령 조회) | [../08_screen/01_standards.md](../08_screen/01_standards.md) |
| 캐시 삭제 · 재적재 · 발행 실패 계수 이름 | **W6 판정** — mst_cache_delete_failures_total · mst_dict_reloads_total{result} · rlt_publish_failures_total{channel} | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |

## 관련 문서

- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-12 무효화 체인 6단
- [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) — 층별 옛 값 · 불일치 시 진실
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 캐시 키 · 실패 전략
- [../03_requirements/03_master.md](../03_requirements/03_master.md) — REQ-MST 계약
- [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) — REQ-WRK 계약
- [04_routing.md](./04_routing.md) — ③ 업무 쓰기의 명령 스트림 경로
- [../05_data_stores/01_postgresql_schema.md](../05_data_stores/01_postgresql_schema.md) — biz_command_log
- [02_collect.md](./02_collect.md) — Collector의 ch:cacheinv 구독
