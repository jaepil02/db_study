# F-05 업무 데이터 CRUD (07_business_crud)

> **대상**: F-05 흐름의 기전 정본 — 읽기 · 쓰기 경로 · BFF 경유 기준 · **캐시 무효화 체인 6단(ADR-12)의 단계 번호 정본** · 도메인별 체인 적용 · 작업지시 no-store · 층별 옛 값의 창 · 체인 실패와 degrade · 인증 흐름의 BFF 경유 · 감사 트랜잭션
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 대응표 머리 5단 표기(REQ-MST-09 · MST-08) → **옛 5단 표기(원본 · 선행 초안)** — 두 ID는 이미 6단 번호를 쓴다 · 체인 단 수 불변
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 메트릭 이름 · EXP 번호 반영(정본 10_observability/01 · 06)
> **개정일**: 2026-09-24 — W6 판정 반영 — staleTime 설정값 미정을 닫는다(09_tech_stack/01 파생표) · BFF revalidate 현행 30초 소유 09_tech_stack/01 — 체인 단 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 미확인 "⑥ 신호 키 → 브라우저 쿼리 키 대응"을 닫는다(08_screen/01 §무효화 신호 수신 — 신호 키 4 · staleTime 관계식) · staleTime 값만 09_tech_stack/01(W6)에 남는다 — 체인 단 수 불변
> **개정일**: 2026-09-24 — W5 판정 반영 — 사이트 · 라인 체인 행의 "사이트 목록 사본" → **Redis 사본 없음**(② · ③ · ⑥ 없음 · ⑤만) · 목록 BFF 경유 행에 사이트 · 라인 · 태그 목록 Redis 사본 부재 명시 — 쓰기 유형 수 불변
> **원천**: 원본 data_flow.md §7 · §7.1 · §7.2 · §17(커밋 ff66a37) · 원본 architecture.md §10.1 · §11.2 · §12(커밋 ff66a37) · 원본 implementation_plan.md §7.4(커밋 ff66a37) · docs_plan.md 보정 #5 · 웨이브 인계(작업지시 BFF 캐시 키 · 무효화 층별 반영 시간) · ADR-02 · ADR-12 · ADR-16 · ADR-19 · D-04 · REQ-GLB-12 · REQ-MST-01~14 · REQ-WRK-01~09 · REQ-AUT-14 · REQ-ALM-02 · 13 · 14 · REQ-RLT-15 · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) · [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) §즉시 반영

F-05는 **사람이 쓰는 업무 데이터가 PostgreSQL 트랜잭션으로 확정되고 사본들이 지워지기까지**다. 분기 ③계층의 흐름이며 **Stream을 한 번도 지나지 않는다** — 커밋 응답 직후의 재조회가 새 값을 봐야 하고(read-your-writes), 변경과 감사가 한 트랜잭션이어야 하기 때문이다(REQ-GLB-12 · [04_routing.md](./04_routing.md) §③ 업무 쓰기).

**이 문서가 무효화 체인 단계 번호의 정본이다.** 원본 체인은 4단(커밋 → Redis 삭제 → Pub/Sub → Dictionary 재적재)이었지만 이 시스템의 사본은 Redis · Dictionary · BFF 서버 fetch 캐시 · 브라우저 쿼리 캐시 넷이라, 원본 설계대로면 "마스터 수정 후 즉시 반영" 검증이 반드시 실패한다(원본 implementation_plan.md §7.4). ADR-12가 체인을 6단으로 늘렸고 이 문서가 그 기전을 고정한다.

## 읽기 · 쓰기 경로

원본 CRUD 시퀀스(원본 data_flow.md §7)를 두 경로의 단계 체인으로 옮긴다.

```plain
읽기  브라우저 → BFF(httpOnly 쿠키 → 액세스 토큰) → api(Bearer)
         → CacheKeyClient GET 목록 사본 ── 히트 → 응답
                                        └─ 미스 · 실패 → PostgreSQL(in-process 풀) → TTL 쓰기 → 응답
         → BFF 서버 fetch 캐시(목록 · 마스터만 · 작업지시는 no-store) → 브라우저

쓰기  브라우저 → BFF → api → 요청 검증(공유 스키마) · 역할 검사
         → BEGIN → 업무 행 변경 → audit_log(before · after) → COMMIT
         → 체인 ②③ → 응답 → BFF 체인 ⑤ → 브라우저 · 체인 ④ ⑥은 응답과 독립으로 진행
```

- **캐시는 커밋 뒤에만 지우고, 새 값으로 덮지 않고 지운다**(ADR-12). 커밋 전에 지우면 그 사이 조회가 옛 값으로 캐시를 다시 채워 커밋 뒤에도 영구히 낡은 값이 남고, 덮어쓰면 동시 갱신에서 쓰기 순서가 뒤집혀 낡은 값이 최종으로 남는다(원본 data_flow.md §7.1).
- **체인 ②③이 응답 앞에 있는 것이 read-your-writes의 기전이다.** 쓴 사람의 다음 조회는 BFF(⑤로 비워짐) → api → Redis(②로 비워짐) → PostgreSQL로 가서 새 값을 본다.
- PostgreSQL 커넥션은 api in-process 풀이다(ADR-19 · 원본 현행 참고 max 20) — 풀러 없이 커넥션 고갈이 F-05의 1차 병목 후보다([01_flow_inventory.md](./01_flow_inventory.md) 병목 #8).

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
- **직결 경로의 보호 장치는 CORS 허용 오리진 하나(http://localhost:3001) · Bearer 액세스 토큰 · WebSocket Origin 검증이다.** 포트가 다르면 오리진도 달라 로컬에서도 CORS가 필요하다(AUT-07). localhost:3001과 localhost:3000은 same-site라 SameSite=Lax 쿠키가 그대로 동작하고, 로컬 http에서는 Secure만 끄고 httpOnly는 유지한다.
- **알람 규칙을 no-store에 넣은 것은 이 문서의 판정이다.** 규칙 변경은 판정 결과를 바꾸는 쓰기라(REQ-ALM-02) 엔지니어가 저장 직후 옛 임계값을 보면 규칙을 다시 고친다 — 작업지시와 같은 read-your-writes 요구다.

## 무효화 체인 6단

**단계 번호의 정본이다.** ①이 트랜잭션 커밋이고 ②~⑥은 커밋 뒤에만 건다.

| 단 | 동작 | 주체 | 응답 전 · 후 | 대상 층 | 이 단이 없으면 |
|:-:|------|------|------|------|------|
| ① | 트랜잭션 커밋(변경 + 감사) | api 변경 도메인 | 전 | PostgreSQL | 해당 없음 — 체인의 전제 |
| ② | Redis 캐시 삭제(DEL · 목록 Hash는 키 하나 DEL) | api · CacheKeyClient | **전** | Redis cache 계열 | TTL(현행 참고 600초)만큼 옛 사본 |
| ③ | ch:cacheinv 발행 — 무효화된 키 이름 | api · FanoutPublisher | 전 | 다른 api 인스턴스 · Collector · 브라우저 중계 | 확장 2단계에서 다른 인스턴스의 로컬 캐시가 옛 값 · Collector가 마스터 변경을 모른다 |
| ④ | SYSTEM RELOAD DICTIONARY plc.dict_tag — **tag_master 변경일 때만** | api | **후 — 응답을 기다리게 하지 않는다** | ClickHouse Dictionary | LIFETIME(현행 참고 최대 600초)만큼 트렌드 화면에 옛 이름 |
| ⑤ | BFF 서버 fetch 캐시 태그 무효화 | BFF — 쓰기 성공 응답을 받은 직후 | BFF 응답 전 | Next.js 서버 캐시 | revalidate 창(현행 참고 30초)만큼 옛 목록 |
| ⑥ | WebSocket 무효화 신호 → 브라우저 쿼리 캐시 무효화 | RLT 중계(RLT-09 · ch:cacheinv 구독) | 후 | 브라우저 쿼리 캐시 | staleTime만큼 다른 사용자 화면에 옛 값 |

- 검산: 단 = 커밋 1 + 커밋 뒤 5 = **6** — ADR-12와 같다 · 응답 전 3(①②③) · BFF 응답 전 1(⑤) · 응답 후 2(④⑥)
- **④를 응답 뒤로 둔 것은 이 문서의 판정이다.** 재적재는 tag_master 전체를 다시 읽는 동기 명령이라 태그 수에 비례해 느려진다 — 응답 앞에 두면 CRUD 지연 예산(원본 목표 80 ms)에 재적재 시간이 더해진다. 대가는 커밋 직후 수백 ms 동안의 옛 이름이며, 설비 · 사이트 쓰기는 dict_tag 내용(태그 필드 · device_id)을 바꾸지 않으므로 ④를 걸지 않는다.
- **⑤의 주체가 BFF인 이유** — Next.js 서버는 호스트 프로세스 하나이고 마스터 쓰기가 전부 BFF를 지나므로, 쓰기 성공을 본 BFF가 스스로 무효화하면 된다. **잔여 — BFF를 거치지 않은 쓰기**(k6 · 수동 호출이 api에 직결)는 ⑤가 걸리지 않아 revalidate 창만큼 옛 목록이 남는다.
- **⑥은 쓴 사람의 브라우저에도 필요 없다 — 자기 쓰기 성공에서 로컬 무효화한다.** ⑥은 다른 사용자 화면을 위한 단이다. 신호의 키 이름 → 쿼리 키 대응은 [../08_screen/01_standards.md](../08_screen/01_standards.md) §무효화 신호 수신이 정한다(W5 닫힘).
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
| PostgreSQL 불가 | 503 common.postgres_unavailable · 쓰기 보관 · 재생 없음 | 없음 | 503 수 | REQ-WRK-06 · REQ-MST-14 |
| 감사 쓰기 실패 | 변경 전체 롤백 | 없음 | 롤백 수 | REQ-WRK-08 |
| ② Redis 삭제 실패 | **요청 성공** — 캐시 계열 degrade | 옛 사본이 TTL까지 | 캐시 삭제 실패 계수 | REQ-MST-10 · 한계 등재 #14 |
| ③ 발행 실패 | 요청 성공 | 다른 인스턴스 · Collector가 변경을 모른다 | 발행 실패 계수 | FanoutPublisher 계수 · 삼킴 |
| ④ 재적재 실패 | 요청 성공(응답 뒤) | LIFETIME 자동 재적재로 수렴 | 재적재 실패 계수 | REQ-MST-10 |
| Redis 불가 중 목록 조회 | PostgreSQL 직행 · 200 | 지연 상승 | 캐시 실패 계수 | REQ-GLB-09 |
| Redis 불가 중 로그인 · 갱신 · 로그아웃 | 503 auth.token_store_unavailable | 없음 | 503 수 | REQ-AUT-14 |

- 검산: 실패 = **7**
- **B형 — Redis 삭제가 실패해도 쓰기를 실패시키지 않는다.** 결론 — 커밋은 이미 끝났고 진실은 PostgreSQL이다. 반대 시나리오 — 삭제 실패로 요청을 실패시키면 사용자는 재시도하고, 재시도는 이미 커밋된 변경을 한 번 더 요청한다(유일 제약 409 또는 중복 작업지시). 파생 지침 — 옛 사본은 TTL이 끊고 삭제 실패는 계수로 드러낸다.
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
| 층별 반영 시간 · CRUD p95 | 3계층 미확인 — 원본 예상치 Dictionary 최대 10분(④ 생략 시) · BFF 최대 30초 · CRUD 원본 목표 100 ms | EXP-29(AC-06) · EXP-36 · REQ-NFR-09 |
| ⑥ 신호 키 → 브라우저 쿼리 키 대응 · staleTime 값 | **대응은 닫힘**(W5 — 신호 키 4 · staleTime은 가장 가까운 서버 층 수명 하한과 같다는 관계식) · staleTime 설정값 **W6 판정**(관계식 파생표 — 240 · 24 · 30 · 60 · 0초) | [../08_screen/01_standards.md](../08_screen/01_standards.md) §무효화 신호 수신 · [../09_tech_stack/01_frontend.md](../09_tech_stack/01_frontend.md)(W6) |
| BFF를 거치지 않은 쓰기의 ⑤ 누락 | 잔여 — revalidate 창만큼 | 한계 등재(W4 반영) |
| 체인 번호 표기 통일(5단 → 6단) | 대응표로 읽는다 | W4 반영 |
| 캐시 삭제 · 재적재 · 발행 실패 계수 이름 | **W6 판정** — mst_cache_delete_failures_total · mst_dict_reloads_total{result} · rlt_publish_failures_total{channel} | [../10_observability/01_metrics_catalog.md](../10_observability/01_metrics_catalog.md) |

## 관련 문서

- [../04_architecture/09_decision_records.md](../04_architecture/09_decision_records.md) — ADR-12 무효화 체인 6단
- [../05_data_stores/07_cross_store_consistency.md](../05_data_stores/07_cross_store_consistency.md) — 층별 옛 값 · 불일치 시 진실
- [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) — 캐시 키 · 실패 전략
- [../03_requirements/03_master.md](../03_requirements/03_master.md) — REQ-MST 계약
- [../03_requirements/11_work_orders.md](../03_requirements/11_work_orders.md) — REQ-WRK 계약
- [04_routing.md](./04_routing.md) — ③ 업무 쓰기가 갈라지지 않는 경로
- [02_collect.md](./02_collect.md) — Collector의 ch:cacheinv 구독
