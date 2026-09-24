# REQ-TSQ — 시계열 조회 요구사항

> **대상**: 시계열 조회(TSQ)의 동작 계약 — 요청 검증 · 해상도 자동 선택과 보정 · 응답 형태 · 롤업 읽기 · 태그 메타 부착 · 캐시 키 정규화 · 캐시 적재와 degrade · 스탬피드 방지 · 진행 구간 분할 · 원시 내보내기 · ClickHouse 불가 시 응답 · 인가와 레이트 리밋 — REQ-TSQ-NN 채번 정본
> **작성일**: 2026-09-24
> **개정일**: 2026-09-24 — W7 검수 반영 — 키 표기 cache:q:{hash} · lock:rebuild:{hash} → **cache:q:{sha1} · lock:rebuild:q:{sha1}**(정본 05_data_stores/05) · 미확인 1행 닫힘(내보내기 끊김 표지) — REQ 수 불변
> **개정일**: 2026-09-24 — W7 보안 판정 반영 — 내보내기 범위 상한 현행 참고 **1일** · class export 반영 — REQ 수 불변(정본 12_security/03)
> **개정일**: 2026-09-24 — W6 실험 채번 반영 — 이벤트 루프 p95 메트릭 이름 통일(정본 10_observability/01 · 06)
> **원천**: 원본 architecture.md §10 · §10.1 · §10.2 · §10.3 · §11 · §11.1 · §12 · §17 · §18(커밋 ff66a37) · 원본 data_flow.md §6 · §6.1 · §6.2 · §6.3 · §12.2 · §16(커밋 ff66a37) · 원본 implementation_plan.md §4.3 · §5 S4 · §7.5(커밋 ff66a37) · D-06 · D-10 · [../02_features/07_timeseries.md](../02_features/07_timeseries.md) TSQ-01~09 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) SW-03 · SW-04 · SW-05 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md)

이 문서는 **TSQ가 어떻게 동작해야 하고 어떻게 실패해야 하는가**를 검증 가능한 계약으로 고정한다. 기능의 존재와 경계는 [../02_features/07_timeseries.md](../02_features/07_timeseries.md)가, 조회 한 건의 기전은 [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)가 갖는다. 전 도메인 공통 규칙(시각 의미론 · 실패 전략 이원화 · 부동소수 비교)은 [01_global_rules.md](./01_global_rules.md)가 먼저 적용되고 이 문서는 그 위에 TSQ 고유 계약만 더한다.

**TSQ의 계약은 두 방향의 보호다.** 하나는 ClickHouse를 사용자로부터 지키는 것(해상도 강제 · 포인트 상한 · 원시 조회의 내보내기 유도)이고, 다른 하나는 사용자를 Redis 장애로부터 지키는 것(캐시 계열 degrade)이다. 두 보호 모두 **에러 코드를 내지 않는 것이 정상 동작**이라 "코드가 없다"를 누락으로 읽지 않는다 — 코드 없는 동작의 정본은 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) "에러 코드가 아닌 것"이다.

**이 문서가 닫는 인계 1건** — ClickHouse 접속 불가 시 조회 표면의 응답(11_glossary/02 채번 보류 · 02_features/07 미확인 등재)을 §ClickHouse 불가 시 응답 판정에서 판정한다. 판정한 코드는 정본 [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)에 **timeseries.clickhouse_unavailable/503**로 채번됐다.

## 요구사항 — 요청 · 해상도 · 응답

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-TSQ-01** | 조회 요청의 태그 배열 길이가 상한을 넘으면 요청 전체를 거절한다. **앞쪽 N개만 잘라 처리하지 않는다** — 상한 값은 2계층 조정값이며 소유처는 [../07_api/05_timeseries.md](../07_api/05_timeseries.md)(현행 참고 50) | 원본 architecture.md §11.1 · TSQ-01 | 잘라서 처리하면 클라이언트는 200을 받고 뒤쪽 태그가 빈 차트를 "데이터 없음"으로 읽는다 — 결측과 절단을 구분할 수 없다 | 상한 + 1개 태그로 요청 → 400 · 응답 points가 비어 있음 · ClickHouse 쿼리 로그에 실행 0건 | TSQ-01 | F-04 | timeseries.too_many_tags/400 |
| **REQ-TSQ-02** | interval이 raw · 1m · 1h · 1d 밖이거나 aggregations가 avg · min · max · last · p95 밖이거나 from · to가 오프셋 포함 ISO 8601이 아니거나 from이 to보다 앞서지 않으면 거절한다 | 원본 architecture.md §11.1 · [../11_glossary/03_enums_state_machines.md](../11_glossary/03_enums_state_machines.md) 조회 해상도 · 집계 함수 | 오프셋 없는 시각을 서버 시간대로 해석하면 같은 요청이 서버 설정에 따라 9시간 다른 구간을 읽는다 | 허용값 밖 · 오프셋 없는 시각 · from ≥ to 각 1건 요청 → 400 | TSQ-01 | F-04 | common.validation_failed/400 |
| **REQ-TSQ-03** | interval 미지정이면 서버가 범위 길이(to − from)로 테이블을 고른다 — 1시간 이하 tag_raw · 1시간 초과 7일 이하 tag_1m · 7일 초과 90일 이하 tag_1h · 90일 초과 tag_1d. 경계는 1계층 구조값이다 | 원본 data_flow.md §6.1 · 원본 architecture.md §11.1 · TSQ-02 | 규칙이 없으면 1년 범위 원시 조회 한 건이 수천억 행 스캔으로 ClickHouse를 메모리 한계에 몰아 적재 삽입까지 멈춘다 | 경계 양쪽(1시간 · 1시간 + 1분 · 7일 · 7일 + 1분 · 90일 · 90일 + 1분) 요청 → meta.interval 대조 · ClickHouse 쿼리 로그의 대상 테이블 대조 | TSQ-02 | F-04 | 해당 없음 |
| **REQ-TSQ-04** | 선택되거나 지정된 해상도의 예상 포인트 수가 최대 포인트 수를 넘으면 한 단계 상향한다. **거절하지 않는다** — 사용자가 raw를 지정한 긴 범위도 같다. 실제 해상도는 meta.interval이 말한다 | 원본 architecture.md §11.1 · TSQ-02 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) "에러 코드가 아닌 것" | 거절하면 클라이언트가 범위를 잘게 나눠 같은 스캔을 여러 번 보내 보호가 무력해진다 · 조용히 상향하고 meta에 드러내지 않으면 "원시로 요청했는데 1m이 왔다"가 버그로 신고된다 | raw 지정 · 3일 범위 요청 → 200 · meta.interval ≠ raw · pointCount ≤ 최대 포인트 수 | TSQ-02 | F-04 | 해당 없음 |
| **REQ-TSQ-05** | 응답은 meta(interval · pointCount · downsampled · cached)와 태그별 points로 구성하고 points는 **배열의 배열**(시각 · 집계값 순의 열 위치 고정)이다 | 원본 architecture.md §11.1 · TSQ-01 | 객체 배열로 내면 응답 크기가 약 3배가 되어 긴 범위 조회의 직렬화 비용이 이벤트 루프를 점유한다 · cached가 없으면 캐시 히트율 측정을 응답 단위로 가를 수 없다 | 응답 스키마 대조 · 같은 요청 2회 연속 → 둘째 응답 meta.cached 참 | TSQ-01 | F-04 | 해당 없음 |
| **REQ-TSQ-06** | 롤업 1차 축소 뒤에도 포인트가 최대치를 넘으면 LTTB로 2차 축소하고 meta.downsampled를 참으로 둔다. LTTB 계산은 이벤트 루프 밖 워커에서 한다. **n번째 추출을 쓰지 않는다.** 알람 분석 화면 요청은 min · max 쌍을 보존한다 | 원본 data_flow.md §6.3 · TSQ-06 | n번째 추출은 스파이크를 잃어 알람 원인 구간이 차트에서 사라진다 · 이벤트 루프에서 계산하면 같은 프로세스의 수집 · 적재 지연이 조회 부하에 비례해 늘어난다 | SPIKE 프로파일 데이터로 최대치 초과 조회 → 원시 최대값이 응답에 남음 · 조회 중 nodejs_eventloop_lag_p95_seconds 대조 | TSQ-06 | F-04 | 해당 없음 |
| **REQ-TSQ-07** | 롤업 테이블은 -Merge 조합자로 읽는다 — 집계 상태 컬럼을 일반 집계로 읽지 않는다. 롤업 해상도의 p95는 TDigest **근사값**이며 원시 정확 분위수와 동등하다고 약속하지 않는다 | 원본 data_flow.md §6 · 원본 architecture.md §7.2 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 부동소수와 오차 허용 비교 | 상태 컬럼을 -Merge 없이 읽으면 머지 전 파트의 부분 상태가 그대로 합산되어 머지 시점마다 값이 달라진다 | 롤업 구간 조회 결과를 원시 집계와 오차 허용 비교 — 판정 기준은 [14_acceptance_criteria.md](./14_acceptance_criteria.md) 롤업 정합성 | TSQ-01 · TSQ-06 | F-04 · F-08 | 해당 없음 |
| **REQ-TSQ-08** | 태그명 · 단위는 조회 시점에 dict_tag에서 붙이고 ClickHouse 행을 고치지 않는다. 마스터 변경의 Dictionary 재적재가 끝난 뒤의 첫 조회는 새 값을 붙인다. PostgreSQL이 중단돼도 조회는 마지막 적재 값으로 성공한다 | 원본 architecture.md §12 · §17 · TSQ-07 · [../02_features/02_master.md](../02_features/02_master.md) MST-08 | 행에 이름을 저장하면 태그명 변경이 과거 파티션 전체의 mutation이 된다 · 재적재를 기다리면 LIFETIME만큼 옛 이름이 보인다 | 태그명 변경 후 첫 조회 → 새 이름 · postgres 컨테이너 정지 중 조회 → 200 | TSQ-07 | F-04 · F-05 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-TSQ-01~08 = **8**
- **REQ-TSQ-04는 A형이다.** 통념은 요청한 해상도가 그대로 온다는 것이지만 서버가 범위와 포인트 상한으로 해상도를 강제한다. 진짜 축은 ClickHouse 보호이고, 원시가 꼭 필요할 때의 대체 경로는 REQ-TSQ-15 내보내기다.

## 요구사항 — 캐시 경로

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-TSQ-09** | 캐시 키는 from · to를 선택된 해상도의 버킷 경계로 **epoch 연산으로** 내리고 태그 배열을 정렬하고 기본값 파라미터를 뺀 정규화 문자열의 SHA-1로 만들며 모양은 cache:q:{sha1}다. 같은 버킷 안에서 초만 다른 두 요청은 같은 키를 낸다 | 원본 architecture.md §10.2 · TSQ-03 · [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) 캐시 키 시간 스냅 | 스냅이 없으면 매 요청이 다른 키가 되어 히트율이 0에 수렴한다 · 1d 스냅을 문자열 날짜로 하면 서버 시간대에 따라 같은 조회가 두 키로 갈린다 | 초 단위만 다른 두 요청 · 태그 순서만 다른 두 요청 → Redis MONITOR에서 같은 키 확인 | TSQ-03 | F-04 | 해당 없음 |
| **REQ-TSQ-10** | 결과는 cache-aside로 gzip 압축해 두고 TTL은 구간 성격으로 가른다 — 완전 과거(to가 현재 버킷 시작보다 앞) 길게 · 현재 버킷 포함 짧게 · 최근 구간 캐시하지 않음. 모든 쓰기에 TTL과 지터가 붙고 **과거 구간을 명시적으로 무효화하지 않는다** | 원본 data_flow.md §6.2 · 원본 architecture.md §10.1 · 원본 implementation_plan.md §7.5 · TSQ-04 | TTL 없는 cache:q 키는 volatile-lru 축출 대상이 아니라 메모리 압박 때 봉인 계열(Stream)을 먼저 밀어내는 순서가 뒤집힌다 · 지터가 없으면 자동 새로고침 주기마다 동시 만료가 ClickHouse에 몰린다 | 세 구간 요청 각 1건 → TTL 명령으로 구간별 TTL 대조 · 최근 구간 요청 → 키 부재 · TTL 없는 cache:q 키 수 = 0 | TSQ-04 | F-04 | 해당 없음 |
| **REQ-TSQ-11** | 캐시 계열 Redis 호출이 실패하거나 타임아웃이면 예외를 삼키고 ClickHouse로 직행해 200을 낸다. **캐시 실패를 에러 응답으로 올리지 않는다** | 원본 architecture.md §17 degrade 원칙 · 원본 data_flow.md §12.2 · TSQ-04 · [01_global_rules.md](./01_global_rules.md) 실패 전략 이원화 | 캐시 실패를 전파하면 Redis 3분 중단 실험에서 조회 표면 전체가 503이 되어 "캐시 계층 장애는 서비스 실패로 이어지지 않는다"는 원칙이 깨진다 | redis 컨테이너 정지 중 조회 → 200 · meta.cached 거짓 · API 지연 상승 기록 | TSQ-04 | F-04 · F-10 | 해당 없음 |
| **REQ-TSQ-12** | 캐시 미스에서는 lock:rebuild:q:{sha1}를 NX · 만료 시간과 함께 잡은 한 요청만 ClickHouse를 부르고, 나머지는 짧게 대기한 뒤 캐시를 다시 읽는다. 해제는 소유자 토큰 검증으로만 한다. 대기를 소진해도 요청자에게 실패를 노출하지 않고 원천을 직접 읽는다 | 원본 architecture.md §10.3 · TSQ-05 · [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) "에러 코드가 아닌 것" | 소유자 검증 없는 DEL은 자기 락이 만료된 뒤 남의 락을 지워 스탬피드가 다시 열린다 · 락이 없으면 동시 요청 수만큼 같은 집계가 ClickHouse에서 반복된다 | 캐시 비운 뒤 같은 요청 동시 N건 → ClickHouse 쿼리 로그의 동일 쿼리 실행 횟수 대조(SW-05 on/off) | TSQ-05 | F-04 | 해당 없음 |
| **REQ-TSQ-13** | 끝이 현재인 조회는 확정된 과거 구간(버킷 경계까지 · 긴 TTL 캐시)과 진행 중 마지막 버킷(최신값 또는 짧은 TTL)으로 나눠 응답하고 합치는 것은 클라이언트다 | 원본 architecture.md §10.2 · TSQ-08 | 통째로 캐시하면 매번 미스이거나 오래된 값이 보인다 — 둘 중 어느 쪽이든 대시보드의 반복 조회가 캐시 이득을 잃는다 | "최근 N분" 요청 연속 2회 → 과거 구간 키 히트 · 마지막 버킷만 원천 조회 | TSQ-08 | F-04 · F-03 | 해당 없음 |
| **REQ-TSQ-14** | SW-03 · SW-04 · SW-05는 포트 하나에 구현 둘을 두고 기동 시 환경변수로 고른다 — SW-03 off는 항상 미스 구현 · SW-04 off는 시각을 그대로 넣는 정규화 · SW-05 off는 락 없는 구현이다. **조회 경로 안에 스위치 분기를 두지 않는다** | 원본 implementation_plan.md §4.3 · D-06 · [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) | 경로 안 분기는 측정 대상 코드에 분기 비용을 섞고 스위치 조합마다 경로가 늘어 on/off 차이를 역할 하나로 설명할 수 없게 된다 | 각 스위치 off로 기동 → /api/v1/health 스위치 상태 대조 · off 구현 동작(항상 미스 · 키 파편화 · 동시 원천 호출) 관찰 | TSQ-03 · TSQ-04 · TSQ-05 | F-04 | 해당 없음 |

- 검산: 이 표의 REQ = REQ-TSQ-09~14 = **6**
- **SW-03 off에서 SW-04 · SW-05를 비교하지 않는다.** 캐시가 없으면 키도 락도 쓰이지 않아 차이가 0이다 — 조합 제약 정본 [../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md).

## 요구사항 — 내보내기 · 실패 · 인가

| ID | 요구 | 근거 | 위반 시 실패 | 검증 방법 | 관련 기능 | 관련 흐름 | 관련 에러 코드 |
|------|------|------|------|------|------|------|------|
| **REQ-TSQ-15** | 원시 내보내기는 CSV · Parquet로 스트리밍하며 ClickHouse가 FORMAT으로 직렬화한 응답을 그대로 중계한다. 해상도를 줄이지 않고 캐시하지 않으며, 레이트 리밋은 조회 표면보다 엄격한 별도 한도를 쓴다(한도 소유 [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md)) | 원본 architecture.md §11 · §11.1 · §18 · TSQ-09 | 애플리케이션이 행을 모아 직렬화하면 긴 범위 내보내기 한 건이 api 힙을 채워 같은 프로세스의 적재가 GC 압박을 받는다 · 캐시하면 대용량 원시 사본이 캐시 예산을 밀어낸다 | 1일 원시 내보내기 → api 힙 증가폭이 행 수에 비례하지 않음 · cache:q 키 증가 0 | TSQ-09 | F-04 | common.rate_limited/429 |
| **REQ-TSQ-16** | ClickHouse에 접속할 수 없으면 캐시 히트는 200으로 응답하고 **캐시 미스는 거절한다.** 대조군 plc_tag_raw_control이나 Redis 최신값으로 대신 답하지 않는다. 내보내기도 거절한다 — 판정 §ClickHouse 불가 시 응답 판정 | 원본 architecture.md §17 · 원본 data_flow.md §12.2 · 11_glossary/02 채번 보류 · 이 문서 판정 | 대조군으로 우회하면 SW-09 off(기본)에서 빈 결과가 200으로 나가 "데이터 없음"과 "저장소 불가"가 같아진다 · 캐시 히트까지 막으면 캐시가 살아 있는데도 대시보드가 멈춘다 | clickhouse 컨테이너 정지 → 캐시된 요청 200 · 새 요청 거절 · 대조군 테이블 조회 0건 | TSQ-01 · TSQ-04 · TSQ-09 | F-04 · F-10 | timeseries.clickhouse_unavailable/503 |
| **REQ-TSQ-17** | S7 이후 조회 표면은 인증 사용자 전원에게, 원시 내보내기는 ENGINEER에게만 연다. 한도를 넘은 요청은 다음 창까지 거절한다. S2~S6은 무인증이며 이 요구가 적용되지 않는다 | [../02_features/12_permission_matrix.md](../02_features/12_permission_matrix.md) TSQ · 원본 architecture.md §18 · D-07 | 내보내기를 전원에게 열면 대량 스캔 읽기가 레이트 리밋 축과 어긋나 OPERATOR 화면 하나가 ClickHouse를 점유할 수 있다 | OPERATOR 토큰으로 내보내기 → 403 · 한도 + 1회 조회 → 429 | TSQ-01 · TSQ-09 | F-04 | auth.forbidden/403 · common.rate_limited/429 |

- 검산: 이 표의 REQ = REQ-TSQ-15~17 = **3** · 문서 전체 REQ = 8 + 6 + 3 = **17**(REQ-TSQ-01~17 · 결번 없음)
- 인증 기전(토큰 · Guard · 레이트 리밋 키)의 계약은 [02_auth.md](./02_auth.md)가 갖고, 이 문서는 TSQ 표면에 무엇이 적용되는지만 적는다.

## 조회 계약 — 2계층 조정값

아래 값은 본문에 박지 않는다. 구현은 소유처의 설정 키를 읽고, 없으면 기동을 멈춘다 — 코드 안 기본값으로 대체하지 않는다.

| 조정값 | 읽는 자리 · 키 모양 | 기준 시점 | 금지된 대체 동작 | 부재 시 | 현행 참고 · 소유처 |
|------|------|------|------|------|------|
| 태그 배열 상한 | 조회 요청 검증 단계 | 요청 수신 시 | 초과분 절단 | 기동 거부 | 50 · [../07_api/05_timeseries.md](../07_api/05_timeseries.md) |
| 최대 포인트 수 기본값 | 요청의 maxPoints 부재 시 | 해상도 선택 시 | 무제한 반환 | 기동 거부 | 2000 · 상동 |
| TTL 구간 경계와 TTL | cache:q:{sha1} 쓰기 | to와 **api 서버 시계의** 현재 버킷 시작 비교 | 구간 구분 없는 단일 TTL · TTL 없는 쓰기 | 기동 거부 | 과거 300초 · 현재 버킷 30초 · 최근 5분 미캐시 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| TTL 지터 | 캐시 계열 래퍼가 가산 | 쓰기 시 | 호출자별 지터 계산 | 래퍼 기본 동작 | ±20% · [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 캐시 호출 타임아웃 | 캐시 계열 래퍼 | 호출마다 | 무기한 대기 · 예외 전파 | 래퍼 기본 동작 | 50 ms · 상동 |
| 재구성 락 만료 · 대기 간격 · 재시도 횟수 | lock:rebuild:q:{sha1} | 미스 시 | 만료 없는 락 · 무한 대기 | 기동 거부 | 5000 ms · 50 ms × 3회 · [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) |
| 내보내기 한도 · 범위 상한 | 레이트 리밋 키 rl:export:{user_id}:{unix_minute} · 범위는 요청 to − from | 분 창 · 요청 수신 시 | 조회 표면 한도 공유 · 범위를 잘라 내보내기 | 기동 거부 | 범위 1일 · 한도 미정(관계식 R1) · [../12_security/03_api_surface_defense.md](../12_security/03_api_surface_defense.md) |

- 검산: 조정값 = 태그 상한 · 최대 포인트 · TTL 구간 · 지터 · 타임아웃 · 락 · 내보내기 = **7**
- **해상도 경계(1시간 · 7일 · 90일)는 이 표에 없다.** 1계층 구조값이라 REQ-TSQ-03이 평문으로 고정하고, 바뀌면 캐시 키 정규화와 롤업 보존 기간이 함께 움직인다.

## ClickHouse 불가 시 응답 판정

W1이 채번 보류로 넘긴 자리다(11_glossary/02 · 02_features/07). 캐시 미스 요청이 ClickHouse에 닿지 못할 때의 응답을 아래 트리로 판정한다.

```plain
시계열 조회 요청
├─ 검증 실패 ───────────────────────────────────────── 400 common.validation_failed
├─ 캐시 히트(Redis 정상) ──────────────────────────────── 200 meta.cached 참
└─ 캐시 미스 또는 Redis 불가(degrade)
   ├─ ClickHouse 응답 ─────────────────────────────── 200
   └─ ClickHouse 접속 불가 · 타임아웃 ───────────────── 503 timeseries.clickhouse_unavailable/503
원시 내보내기
├─ 응답 시작 전 ClickHouse 불가 ─────────────────────── 503 timeseries.clickhouse_unavailable/503
└─ 스트리밍 도중 끊김 ───────────────────────────────── 연결 중단(상태 줄은 이미 200)
```

- **판정: 503이고 코드는 timeseries 네임스페이스다.** 클라이언트 대응이 "백오프 후 재요청"이라 503 규약과 같고, 원인 저장소가 ClickHouse임을 코드로 가르면 PostgreSQL 불가(common.postgres_unavailable)와 섞이지 않는다. 채번은 정본 11_glossary/02가 했다.
- **common.postgres_unavailable을 재사용하지 않는다.** PostgreSQL 불가에서 시계열 조회는 정상이라는 것이 그 코드의 정의다 — 재사용하면 "업무 CRUD만 실패"라는 진술과 모순된다.
- **캐시 히트를 막지 않는 것은 B형 안전장치다.** ClickHouse 중단 중에도 이미 캐시된 과거 구간은 계속 보인다. 반대 설계(ClickHouse 상태를 먼저 확인)는 매 요청에 원천 핑을 더해 캐시가 흡수하려던 부하를 되살린다.
- **스트리밍 도중 끊김은 코드로 표현할 수 없다.** 상태 줄이 이미 나간 뒤라 클라이언트는 불완전 파일을 받는다 — 잔여는 행 수 대조로만 잡히며 [../07_api/05_timeseries.md](../07_api/05_timeseries.md)(W5)가 종료 표지 여부를 정한다.

## 실패 시 응답 전수

| 상황 | 응답 | 코드 또는 지표 | 요구 |
|------|------|------|------|
| 태그 배열 상한 초과 | 400 · 나눠 요청 | timeseries.too_many_tags/400 | REQ-TSQ-01 |
| 해상도 · 집계 함수 · 시각 형식 위반 | 400 | common.validation_failed/400 | REQ-TSQ-02 |
| 포인트 초과 · 긴 범위 원시 요청 | 200 · 상향 · LTTB | meta.interval · meta.downsampled | REQ-TSQ-04 · 06 |
| Redis 캐시 실패 | 200 · 느려짐 | 캐시 히트율 · API 지연 | REQ-TSQ-11 |
| 락 획득 실패 | 200 · 대기 후 재조회 | 락 대기 메트릭 | REQ-TSQ-12 |
| ClickHouse 불가(캐시 미스) | 503 | timeseries.clickhouse_unavailable/503 | REQ-TSQ-16 |
| PostgreSQL 불가 | 200 · 마지막 적재 메타 | 없음 | REQ-TSQ-08 |
| 역할 밖 내보내기(S7 이후) | 403 | auth.forbidden/403 | REQ-TSQ-17 |
| 분당 한도 초과(S7 이후) | 429 | common.rate_limited/429 | REQ-TSQ-15 · 17 |

- 검산: 상황 = **9** · 이 중 코드를 내는 행 5(too_many_tags · validation_failed · clickhouse_unavailable · forbidden · rate_limited) + 코드 없는 행 4 = **9**

## 기능 → REQ 대응 검산

[../02_features/07_timeseries.md](../02_features/07_timeseries.md)의 기능 9개 전부가 적어도 하나의 REQ에 대응한다.

| 기능 ID | 기능명 | 대응 REQ |
|------|------|------|
| TSQ-01 | 시계열 조회 | REQ-TSQ-01 · 02 · 05 · 07 · 16 · 17 |
| TSQ-02 | 해상도 자동 선택 | REQ-TSQ-03 · 04 |
| TSQ-03 | 캐시 키 정규화 | REQ-TSQ-09 · 14 |
| TSQ-04 | 조회 결과 캐시 | REQ-TSQ-10 · 11 · 14 · 16 |
| TSQ-05 | 스탬피드 방지 | REQ-TSQ-12 · 14 |
| TSQ-06 | 다운샘플 | REQ-TSQ-06 · 07 |
| TSQ-07 | 태그 메타 부착 | REQ-TSQ-08 |
| TSQ-08 | 진행 구간 분할 | REQ-TSQ-13 |
| TSQ-09 | 원시 내보내기 | REQ-TSQ-15 · 16 · 17 |

- 검산: 기능 9 중 대응 REQ 있음 9 · 누락 0 = **9** · 기능에 대응하지 않는 REQ 0(유령 0). REQ 총수를 세는 자리는 §요구사항 — 내보내기 · 실패 · 인가의 검산 하나다

## 원본 보정 반영

| 원본 항목 | 이 문서의 반영 | 정본 |
|------|------|------|
| 보정 7.5 TTL 강제 수단 | REQ-TSQ-10 · 11 · 12가 캐시 계열 래퍼(TTL 필수 · 짧은 타임아웃 · 예외 무시)를 전제로 한다 — 호출자가 TTL을 빠뜨릴 수 있는 쓰기 경로를 두지 않는다 | [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md) |
| 스위치 구현 제약 — 원본 implementation_plan.md §4.3 | REQ-TSQ-14 — 포트 교체 · 경로 안 분기 금지 | [../04_architecture/02_module_boundaries.md](../04_architecture/02_module_boundaries.md) |
| 원본 Phase 3 합격 판정 "p95 지연 절반 이하" | 이 문서에 옮기지 않는다 — SW-03 on/off 비교가 대신한다 | [../01_overview/05_priorities_roadmap.md](../01_overview/05_priorities_roadmap.md) · [14_acceptance_criteria.md](./14_acceptance_criteria.md) |
| 보정 7.1~7.4 | 해당 없음 | 해당 없음 |

## 미확인 · 미설계 등재

| 항목 | 원본에서 확인되는 것 | 상태 | 확정 자리 |
|------|------|------|------|
| 해상도별 응답 시간(캐시 히트 · 미스) | 원본 목표 히트 20 ms · 1일 미스 300 ms 이하(4 vCPU 가정) · 원본 예상치 해상도별 20~150 ms | 미확인 — 확정 전 임의 값 고정 금지 | [13_nonfunctional.md](./13_nonfunctional.md) · [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| 반복 조회 히트율 | 원본 목표 80% 이상 · SW-04 off 시 0% 수렴 | 미확인 — 확정 전 임의 값 고정 금지 | 상동 · [14_acceptance_criteria.md](./14_acceptance_criteria.md) |
| 스탬피드 on/off 쿼리 횟수 | 원본 예상치 동시 100요청 시 100회 → 1회 | 미확인 — 확정 전 임의 값 고정 금지 | [../10_observability/06_experiment_catalog.md](../10_observability/06_experiment_catalog.md) |
| ClickHouse 불가 에러 코드 | 이 문서가 503 · timeseries 네임스페이스로 판정 | **채번 완료** — timeseries.clickhouse_unavailable/503 | [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md)(리드) |
| 내보내기 스트리밍 도중 끊김의 표지 | 원본에 없다 | 닫힘 — 본문에 표지를 넣지 않는다 · 중단은 종결 청크 없는 비정상 종료 · 완결은 종결 청크 — [../07_api/05_timeseries.md](../07_api/05_timeseries.md) | [../07_api/05_timeseries.md](../07_api/05_timeseries.md)(W5) |
| 스탬피드 대기 소진 후 원천 직접 조회 | 원본은 "최대 3회"까지만 적었다 — 이 문서가 "요청자는 실패를 보지 않는다"(11_glossary/02)의 귀결로 판정 | 판정 — 기전 확정 대기 | [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md)(W4) |
| p95 롤업 대조의 근사 허용 범위 | TDigest 근사 · 부동소수 허용 오차로 비교하지 않는다(W1) | 미확인 — 확정 수단은 [14_acceptance_criteria.md](./14_acceptance_criteria.md) | [14_acceptance_criteria.md](./14_acceptance_criteria.md) |

## 관련 문서

- [../02_features/07_timeseries.md](../02_features/07_timeseries.md) — TSQ 기능 목록 · 경계
- [../06_pipeline/06_timeseries_read.md](../06_pipeline/06_timeseries_read.md) — F-04 조회 기전 · TTL 현행 값
- [../07_api/05_timeseries.md](../07_api/05_timeseries.md) — query · export 표면
- [../11_glossary/02_error_codes.md](../11_glossary/02_error_codes.md) — 에러 코드 정본
- [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) — 캐시 키 시간 스냅 · 부동소수 비교
- [01_global_rules.md](./01_global_rules.md) — 전역 규칙
- [14_acceptance_criteria.md](./14_acceptance_criteria.md) — 롤업 정합성 · 캐시 인수 기준
