# 구현 실행 계획서

> 프로젝트: PLC 대용량 시계열 + 업무 데이터 분리 처리 웹 시스템
> 학습 목표: **Redis를 통한 실시간 대용량 시계열 데이터 처리 및 연계 이해**
> 관련 문서: tech_stack.md (기술 선정), architecture.md (시스템 구조), data_flow.md (데이터 흐름)
> 작성일: 2026-09-20

---

## 1. 이 문서의 역할

설계서 3종은 **무엇을 만들 것인가**를 완결했다. 이 문서는 **어떤 순서로 만들어야 Redis를 이해하게 되는가**를 다룬다. 둘은 같지 않다.

| 기존 문서가 답한 것 | 이 문서가 답하는 것 |
|---|---|
| 어떤 기술을, 왜 | 어떤 순서로, 무엇을 먼저 |
| 컴포넌트 책임과 경계 | 각 단계의 합격 판정 숫자 |
| 지연 예산과 성능 목표 | 그 숫자를 **무엇과 비교할 것인가** |
| Redis의 3중 역할 정의 | Redis를 **꺼서 차이를 측정하는 방법** |
| 이상적 머신 가정(32 GB, 4 vCPU) | 이 머신의 실측값과 프로파일 재산정 |

추가되는 핵심 개념은 하나다. **Redis 역할 스위치**(4절). 설계서에 없는 1급 요구사항이며, 학습 목표가 "구현"이 아니라 "이해"이기 때문에 필요하다.

---

## 2. 실행 환경 실측과 프로파일 재산정

### 2.1 문서 가정과 실측값의 차이

| 항목 | 설계서 가정 | 이 머신 실측 | 영향 |
|---|---|---|---|
| CPU | 4 vCPU급 | **20 스레드** (i5-13600KF, P 6코어 + E 8코어) | CPU는 과잉. 병목이 CPU가 아니게 됨 |
| 머신 RAM | 32 GB 권장 | 31 GB (Windows 호스트) | 충분 |
| **실제 가용 RAM** | 32 GB 전제 | **15 GB** (WSL2 기본 할당 = 호스트의 50%) | **부하 실험 프로파일(12 GB) 사용 불가** |
| 디스크 | 200 GB 권장(M 티어) | 936 GB 여유 | 충분. M+ 티어(500 GB)도 가능 |
| 실행 플랫폼 | macOS / Linux | WSL2 (networkingMode=mirrored) | 아래 2.3 참조 |
| Node | 22 LTS 고정 | 호스트 v24.20.0 | 호스트도 22로 고정 필요 |
| pnpm | 필수 | **미설치** | 착수 전 설치 |

**가장 중요한 발견: 병목의 위치가 문서의 가정과 반대다.** 문서는 CPU 부족(4 vCPU)과 메모리 여유(32 GB)를 전제로 썼는데, 이 머신은 CPU 과잉(20 스레드)과 메모리 부족(15 GB)이다. 그래서 문서가 걱정한 것들(생성기가 CPU를 뺏는다, 관측 스택이 CPU를 먹는다, 이벤트 루프가 CPU 경합으로 막힌다) 중 상당수는 덜 일어나고, 대신 **Redis maxmemory와 ClickHouse 메모리 상한이 먼저 걸린다.**

이것은 학습 목표에 오히려 유리하다. 병목이 Redis 메모리 쪽으로 쏠리기 때문이다.

### 2.2 WSL2 메모리 할당 조정 (착수 전 1순위)

`/mnt/c/Users/user/.wslconfig` 현재 내용:

```ini
[wsl2]
networkingMode=mirrored
```

`memory` 지시자가 없어 기본값(호스트 RAM의 50% = 15 GB)이 적용되고 있다. 다음으로 바꾼다.

```ini
[wsl2]
networkingMode=mirrored
memory=20GB
processors=20
swap=8GB
```

적용은 PowerShell에서 `wsl --shutdown` 후 재진입. 배분 근거:

| 대상 | 할당 | 근거 |
|---|---|---|
| Windows 호스트 | 11 GB | OS 4 GB + 브라우저 3~4 GB + IDE 1~2 GB. 브라우저는 Windows에서 띄운다 |
| WSL2 VM | 20 GB | Docker 12 GB + Next.js dev 1.5 GB + k6 0.5 GB + Linux OS 1 GB = 15 GB, 여유 5 GB |

이 조정으로 **설계서의 부하 실험 프로파일(Docker 12 GB)을 그대로 쓸 수 있다.** 문서의 모든 목표 수치(용량 티어, Redis maxmemory 2.0 GB, MAXLEN 200000, 백프레셔 임계 4구간)가 재산정 없이 유효해진다.

### 2.3 조정하지 않을 경우의 대체 프로파일

`.wslconfig`를 건드리고 싶지 않다면 Docker 예산이 10 GB로 줄어든다. 문서의 두 프로파일 사이에 **중간 프로파일**을 새로 둔다.

| 컨테이너 | 중간 프로파일 | 문서 부하 실험 프로파일 | 문서 개발 프로파일 |
|---|---|---|---|
| clickhouse | 4.0 GB | 5.0 GB | 3.0 GB |
| postgres | 1.5 GB | 2.0 GB | 1.5 GB |
| redis | 2.0 GB (maxmemory **1.5 GB**) | 2.5 GB (maxmemory 2.0 GB) | 1.5 GB (maxmemory 1.0 GB) |
| api | 2.0 GB | 2.0 GB | 1.5 GB |
| **합계** | **9.5 GB** | 11.5 GB | 7.5 GB |

중간 프로파일에서 Redis 파생 설정(문서 8.4절 산정식을 1.5 GB에 맞춰 재계산):

| 항목 | 값 | 산정 |
|---|---|---|
| Stream MAXLEN | 150,000 | 150,000 × 7 KB ≈ 1.05 GB |
| 캐시·세션·최신값 예산 | 0.35 GB | |
| 여유(단편화) | 0.1 GB | |
| 백프레셔 임계 (정상/주의/경고/위험) | 15,000 / 75,000 / 135,000 | MAXLEN 대비 10% / 50% / 90%, 문서와 동일 비율 |

**중간 프로파일의 부수 효과 하나는 기록해 둘 가치가 있다.** maxmemory 1.5 GB에서 Stream 1.05 GB + 캐시 0.35 GB = 1.4 GB로 여유가 0.1 GB밖에 없다. 문서가 "maxmemory를 1.6 GB로 낮춰 강제 유발하는 실험 전용 시나리오"(architecture.md 17절)라고 한 **volatile-lru 축출 연쇄가 이 프로파일에서는 기본 구성에서 자연 발생한다.** 학습 관점에서는 인위적 조작 없이 관찰할 수 있다는 뜻이라 오히려 이득이지만, 성능 수치를 문서의 목표치와 비교하면 안 된다.

**판단: `.wslconfig`를 20 GB로 올리고 문서의 부하 실험 프로파일을 쓴다.** 중간 프로파일은 그 조정이 불가능할 때의 대안이며, 채택 시 이 절의 값을 architecture.md 13절에 정식 프로파일로 추가한다.

### 2.4 CPU 20스레드가 바꾸는 것

문서 tech_stack.md 10.6절은 **"부하 생성기는 대상 호스트에서 실행하지 않는다 — 이 원칙은 로컬에서 지킬 수 없다"** 고 적고 완화책만 제시했다. 20스레드 머신에서는 이 원칙을 **부분적으로 되살릴 수 있다.**

| 대상 | cpuset | 근거 |
|---|---|---|
| api, redis | `0-7` | 지연 민감. 단일 스레드 성능이 중요 |
| clickhouse | `8-13` | 병렬 스캔·머지 |
| postgres | `14-15` | 부하가 낮음 |
| k6 (호스트 프로세스) | `taskset -c 16-17` | **측정 대상과 vCPU 집합이 겹치지 않음** |
| Next.js dev, 관측 스택 | `18-19` | |

Compose에 `cpuset: "0-7"` 형태로 지정한다. 이렇게 하면 "생성기가 대상의 CPU를 뺏는다"는 오염원이 제거되고, 문서 10.6절의 첫 번째 행(부하 생성기 격리)을 "완화"가 아니라 "해결"로 승격할 수 있다.

**단, 완전한 격리는 아니다.** 두 가지 한계가 남는다.

1. **WSL2는 P코어/E코어 구분을 노출하지 않는다.** `lscpu -e`가 10코어 × 2스레드의 균일한 토폴로지로 보고하므로, vCPU 16번이 물리 P코어인지 E코어인지 보장되지 않는다. Windows 스케줄러가 매 실행마다 다르게 배치할 수 있다.
2. 메모리 대역폭과 L3 캐시는 여전히 공유한다.

따라서 **이 머신에서는 "같은 실험 3회 실행 후 중앙값"이 선택이 아니라 필수 규칙이다.** P/E 혼합 스케줄링으로 실행 간 분산이 생기며, 단일 실행 수치는 신뢰할 수 없다. 3회 실행의 최대·최소 편차가 20%를 넘으면 그 측정은 폐기하고 조건을 다시 잡는다.

### 2.5 networkingMode=mirrored의 영향

| 항목 | 영향 |
|---|---|
| Windows 브라우저 → WSL2 서비스 | `localhost:3001`, `localhost:3000`으로 **포트 포워딩 없이 직결**. NAT 모드였다면 필요했을 설정이 불필요하다 |
| `127.0.0.1` 바인드의 안전성 | 유지된다. mirrored는 루프백을 호스트와 공유할 뿐 LAN에 노출하지 않는다. 설계서 10.4절의 전제는 그대로 유효 |
| CORS 오리진 | 변화 없음. `http://localhost:3001` 하나 |
| 측정에 미치는 영향 | 루프백 경로가 한 단계 짧아져 E2E 지연이 NAT 모드보다 낙관적으로 나온다. 문서 10.6절 "네트워크 지연" 행에 이 사실을 덧붙인다 |

---

## 3. 핵심 판단: 완성 순서와 학습 순서는 다르다

### 3.1 문제

tech_stack.md 14절의 Phase 로드맵은 **시스템 완성 순서**다.

```
Phase 0 골격 → 1 수집 파이프라인 → 2 API+프론트 → 3 Redis 최적화 → 4 부하 측정 → 5 장애·확장
```

학습 목표가 Redis인데 **Redis의 흥미로운 성질 대부분이 Phase 3 이후에 등장한다.** 이 순서는 두 가지 문제를 만든다.

| 문제 | 구체적으로 |
|---|---|
| **비교 기준선이 사라진다** | Phase 3에서 캐시를 "나중에 끼워 넣으면" 그건 리팩터링이다. 리팩터링 전후 성능 비교에는 "코드가 달라져서"라는 변명이 붙어 Redis의 기여분을 분리할 수 없다 |
| **고통을 겪지 못한다** | 반대로 처음부터 캐시를 켜고 시작하면 캐시가 없을 때의 문제를 영영 보지 못한다. "Redis 덕분에 빠르다"가 아니라 "원래 빠르다"로 지나간다 |

### 3.2 해법

**같은 코드에서 Redis의 각 역할을 켜고 끌 수 있게 만든다.**

이것이 이 프로젝트의 1급 요구사항이 되어야 한다. 그러면 순서 문제가 사라진다. 기능을 먼저 만들든 나중에 만들든, 스위치가 있으면 언제든 양쪽을 측정할 수 있기 때문이다.

이 결정이 구현 순서를 자동으로 정해 준다.

1. **스위치가 붙을 자리(= Redis 3중 역할의 경계)를 먼저 코드로 만든다.** 경계가 없으면 스위치를 달 곳이 없다.
2. **각 스위치의 on/off 차이를 측정할 계측을 같은 커밋에서 만든다.** 계측 없는 스위치는 장식이다.
3. **그 다음 기능을 두껍게 한다.**

### 3.3 재배열 결과

| 문서 Phase | 이 계획의 단계 | 이동 |
|---|---|---|
| 0. 로컬 골격 | S0(저장소 수동 실습) + S1(생성기 실측) | **쪼갬.** 코드 전에 redis-cli로 Stream을 손으로 돌리는 단계를 신설 |
| 1. 수집 파이프라인 | S2(수직 슬라이스) + S3(파이프라인 심화) | **쪼갬.** 얇게 끝까지 먼저 |
| 2. API + 프론트 | S2에 최소분 포함 + S4 | **앞당김** |
| 3. Redis 최적화 | **S2부터 상시** | **해체.** 별도 Phase가 아니라 스위치로 전 구간에 분산 |
| 4. 부하·성능 측정 | S5 | 유지 |
| 5. 장애·확장 | S6 | 유지 |
| (없음) | S7(업무 데이터 축) | **신설·후순위** |

---

## 4. Redis 역할 스위치

### 4.1 스위치 목록

전부 환경변수로 제어하고 `/api/v1/health`와 `/metrics` 레이블에 현재 상태를 노출한다. 측정 기록에는 반드시 스위치 상태를 함께 적는다.

| 스위치 | 기본값 | off 동작 | on 동작 | 측정 대상 | 예상 차이 |
|---|---|---|---|---|---|
| `REDIS_STREAM_BUFFER` | on | Collector가 Ingest를 직접 호출 (in-process 큐) | XADD → XREADGROUP | **백프레셔 흡수력** | off: ClickHouse 중단 시 폴링 주기 붕괴 + 유실. on: 무손실 |
| `REDIS_LATEST_CACHE` | on | 최신값 API가 ClickHouse `argMax` 점조회 | `HGETALL rt:latest:{id}` | **점조회 비용** | 30~150 ms → 0.3~1 ms |
| `REDIS_QUERY_CACHE` | on | 매 요청 ClickHouse 집계 | cache-aside | **반복 조회 흡수** | 히트 시 250 ms → 15 ms |
| `CACHE_KEY_TIME_SNAP` | on | `now()`를 그대로 키에 포함 | 버킷 경계로 내림 | **키 파편화** | 히트율 ≈ 0% → 80%+ |
| `CACHE_STAMPEDE_LOCK` | on | 미스 시 전원이 쿼리 | `SET NX` + 대기·재조회 | **스탬피드** | 동시 100요청 시 CH 쿼리 100회 → 1회 |
| `REDIS_PUBSUB_FANOUT` | on | WS 게이트웨이를 직접 호출 | PUBLISH / SUBSCRIBE | **팬아웃 경계 비용** | 루프백 1홉(<1 ms) vs 확장 가능성 |
| `WS_THROTTLE_MS` | 100 | 0 (무제한 전송) | 100 ms 병합 | **프레임 폭증** | 초당 5,000 → 10 프레임 |
| `INGEST_IDEMPOTENCY` | on | dedup 토큰 미전달 | `insert_deduplication_token` | **재시도 중복** | off: 재시도 시 중복 행 발생 |
| `COLLECTOR_DEADBAND` | 0 | 데드밴드 비활성 | 태그별 설정값 적용 | **전송량 감축** | 프로파일별 전송률 3~100% |

`REDIS_STREAM_BUFFER=off`는 설계서의 제1원칙("같은 프로세스 안이어도 예외가 아니다")을 정면으로 어긴다. 그래서 **실험 전용, 기본 on, 정상 경로 아님**으로 못박고, 부팅 시 경고 로그를 띄운다. 이 스위치의 목적은 원칙을 우회하는 것이 아니라 **원칙이 왜 원칙인지 수치로 증명하는 것**이다.

### 4.2 이 표가 곧 실습 목록이다

각 행이 하나의 실험이고, 하나의 기록 문서가 된다. "Redis를 이해한다"는 모호한 목표가 9개의 측정 가능한 질문으로 바뀐다.

### 4.3 구현 제약

스위치는 **런타임 분기가 아니라 주입되는 구현체**여야 한다. NestJS DI로 인터페이스 하나에 두 구현을 두고 모듈 초기화 시 선택한다.

```
TimeseriesCachePort
 ├─ RedisTimeseriesCache   (REDIS_QUERY_CACHE=on)
 └─ NoopTimeseriesCache    (off — 항상 미스 반환)
```

`if (config.redisQueryCache)` 를 조회 경로 안에 흩뿌리면 분기 자체가 측정 대상 코드에 섞여 비교가 오염되고, 스위치가 늘수록 경로가 조합 폭발한다. 포트 하나에 구현 둘이 원칙이다.

---

## 5. 구현 단계

소요는 순수 작업 시간 기준이며 학습·문서화 시간은 별도다.

### S0 — 저장소 수동 실습 (0.5~1일)

**코드를 한 줄도 쓰지 않는다.** 저장소 컨테이너 3개만 띄우고 CLI로 직접 만진다.

| 항목 | 내용 |
|---|---|
| 산출물 | `infra/compose/docker-compose.yml` (저장소 3개 + healthcheck + cpuset + 메모리 상한), `infra/redis/redis.conf`, `infra/postgres/postgresql.conf`, `infra/clickhouse/config.d/` |
| 실습 1 | Redis Stream을 손으로 돌린다 (아래) |
| 실습 2 | ClickHouse에 `tag_raw` DDL 적용 후 수동 INSERT/SELECT, `system.parts`로 파트·압축률 확인 |
| 실습 3 | PostgreSQL 스키마 생성, `pg_stat_statements` 활성화 확인 |
| 합격 판정 | 컨테이너 3개 healthy. `docker stats`로 메모리 상한이 실제로 적용됨을 확인 |

Redis Stream 실습은 다음 7개 명령이 전부다. **이것이 Ingest 모듈 전체의 골격**이므로, 코드로 옮기기 전에 손으로 한 번 돌려 본다.

```redis
XADD stream:plc:raw '*' v 1 d 1 payload "test"
XGROUP CREATE stream:plc:raw grp:ingest 0
XREADGROUP GROUP grp:ingest c1 COUNT 10 STREAMS stream:plc:raw '>'
XPENDING stream:plc:raw grp:ingest          # ACK 안 했으니 PEL에 남아 있다
XACK stream:plc:raw grp:ingest <entry-id>
XAUTOCLAIM stream:plc:raw grp:ingest c2 60000 0   # c1이 죽었다고 보고 c2가 인수
XINFO GROUPS stream:plc:raw                 # lag 확인
```

`XPENDING`에 엔트리가 남는 것을 눈으로 본 사람과 안 본 사람은 이후 Ingest 디버깅 속도가 다르다. **at-least-once의 실체가 PEL이라는 것을 여기서 체득한다.**

### S1 — 생성기 처리량 실측 (0.5~1일)

설계서 Phase 0의 선행 검증 항목을 그대로 수행한다.

| 항목 | 내용 |
|---|---|
| 산출물 | `packages/shared` (zod 스키마 + Stream 페이로드 계약), `apps/api`의 `DataGenModule` 단독 실행 경로 |
| 측정 | TypedArray 벡터 생성 + msgpackr 인코딩 처리량 (pps), piscina 워커 1·2·4개 비교 |
| 합격 판정 | **목표 부하(M 티어 10,000 pps)의 3배 = 30,000 pps 이상** |
| 미달 시 | tech_stack.md 3.4절 전환 조건 발동 → `APP_ROLE=datagen` 별도 컨테이너 또는 Python 생성기 검토 |

**20스레드 머신에서는 미달 가능성이 낮다.** 그래도 측정하는 이유는 판정이 아니라 **기준선 확보**다. 이후 "수집 파이프라인을 붙였더니 생성기가 몇 % 느려졌는가"를 말하려면 단독 수치가 있어야 한다.

### S2 — 수직 슬라이스 (3~5일) ★ 가장 중요한 단계

**태그 1개가 끝까지 흐르는 가장 얇은 경로**를 만든다. 계층별로 완성하지 않는다.

| 범위 | 최소 구성 |
|---|---|
| 설비·태그 | 설비 1대, 태그 8개, 1 Hz, SINE 프로파일 1종 |
| DataGen | 레지스터 Buffer 갱신만 (모드 A) |
| PlcSim | 포트 1개 (127.0.0.1:5020), FC03만 |
| Collector | 폴링 1루프, FC03 1요청, 디코딩(FLOAT32 ABCD만), 품질 GOOD/SIMULATED만, 데드밴드 없음, msgpackr 인코딩, XADD |
| Ingest | 컨슈머 1개, XREADGROUP, 배치(시간 트리거만), ClickHouse INSERT, XACK, HSET `rt:latest`, PUBLISH |
| ClickHouse | `tag_raw`만. **롤업 MV는 아직 만들지 않는다** |
| API | `/health`, `/realtime/devices/1/tags`, `/timeseries/query`(raw 고정), `/ws/realtime` |
| Web | 1페이지. uPlot 차트 1개 + 최신값 테이블. 인증 없음 |
| 계측 | `points_emitted`, `consumer_lag`, `e2e_latency`(= `ingested_at - ts`) 3개만 |
| 스위치 | `REDIS_LATEST_CACHE`, `REDIS_QUERY_CACHE` 2개만 먼저 |

**합격 판정 (전부 숫자로 기록):**

| 항목 | 기준 |
|---|---|
| 육안 확인 | 브라우저에서 sin 파형이 실시간으로 흐른다 |
| 무손실 | DataGen 생성 카운트 = `SELECT count() FROM plc.tag_raw` |
| E2E 지연 | `ingested_at - ts`의 p50/p95/p99를 **기록** (목표 판정 아님, 기준선 확보) |
| 스위치 A/B | `REDIS_LATEST_CACHE` on/off 각각의 최신값 API p95를 측정해 **첫 비교 수치 확보** |

**이 단계가 끝나면 이후 모든 작업이 "이 슬라이스를 두껍게"가 된다.** 그리고 모든 변경에 대해 "바꾸기 전 수치 / 바꾼 후 수치"를 말할 수 있는 기준선이 생긴다. 계층별로 쌓아 올렸다면 Phase 2 끝까지 아무것도 측정할 수 없다.

의도적으로 미루는 것: 인증, 알람, 롤업 MV, DLQ, 스풀, 멱등 토큰, 다중 컨슈머, 데드밴드, 캐시 스탬피드 락. 전부 S3 이후다.

### S3 — 수집 파이프라인 심화 (4~6일)

S2의 Ingest·Collector를 설계서 수준으로 채운다.

| 추가 | 근거 문서 |
|---|---|
| 멱등 토큰 (`insert_deduplication_token`) | architecture.md 7.1, data_flow.md 4.3 |
| 재시도 백오프 + DLQ + XACK 규칙 | architecture.md 9.2 |
| XAUTOCLAIM 회수 (idle 60s) | data_flow.md 4.2 |
| 배치 3중 트리거 (행수 / 시간 / 바이트) | architecture.md 9.1 — **단, 7.1절 보정 필요** |
| 다중 컨슈머 | data_flow.md 4.2 — **단, 7.1절 보정 필요** |
| 레지스터 블록 병합 (갭 허용) | data_flow.md 3.1 |
| 품질 코드 전체 + 데드밴드 | data_flow.md 3.2, 3.3 |
| 롤업 MV 캐스케이드 (1m → 1h → 1d) | architecture.md 7.2 |
| `dict_tag` Dictionary | architecture.md 7.4 |

**합격 판정:** 250 pps 무손실 적재, 컨슈머 랙 0 유지, `INGEST_IDEMPOTENCY` off/on 비교로 재시도 시 중복 행 발생/미발생 확인, 원시 `avg` 대 `tag_1m`의 `avgMerge` 정합성 확인.

### S4 — 조회 경로와 Redis 3중 역할 완성 (4~6일)

| 추가 | 스위치 |
|---|---|
| 캐시 키 정규화 (시간 스냅 + 태그 정렬 + 해싱) | `CACHE_KEY_TIME_SNAP` |
| 스탬피드 방지 (SET NX + 소유자 검증 Lua 해제) | `CACHE_STAMPEDE_LOCK` |
| 해상도 자동 선택 (raw/1m/1h/1d) | — (보호 장치, 스위치 없음) |
| LTTB 다운샘플 (piscina 워커) | — |
| WebSocket 스로틀 병합 | `WS_THROTTLE_MS` |
| Pub/Sub 팬아웃 경계 | `REDIS_PUBSUB_FANOUT` |
| 마스터 데이터 CRUD (site/line/device/tag) + 캐시 무효화 체인 | — |
| 캐시 히트율 계측 (`keyspace_hits/misses`) | — |

**합격 판정:** 반복 조회 히트율 80% 이상. `CACHE_KEY_TIME_SNAP` off 시 히트율이 0%에 수렴하는 것을 실측해 기록. 스탬피드 락 off/on에서 동시 100요청 시 ClickHouse 쿼리 실행 횟수 비교.

### S5 — 부하 측정 (3~5일)

| 항목 | 내용 |
|---|---|
| 산출물 | `loadtest/` k6 시나리오 5종 (Baseline / Ramp / Spike / Soak / Breakpoint), `MetricsModule` 완성, observability 프로파일 |
| 주입 모드 | A(Modbus 경유) / B(Stream 직결) / C(HTTP) / D(백필) — **한 번에 하나만** |
| 규칙 | 각 실험 3회 실행 중앙값 (2.4절 근거). 편차 20% 초과 시 폐기 |
| 기록 | 커밋 해시 + 프로파일 + 용량 티어 + 스위치 상태를 모든 수치에 병기 |

**합격 판정:** 시나리오 5종 전부 실행, 성능이 꺾이는 변곡점 수치화, 설계서 16절 성능 목표표의 각 행에 실측값 기입.

### S6 — 백프레셔와 장애 재현 (3~5일) ★ 학습 정점

| 실험 | 재현 방법 | 확인 |
|---|---|---|
| 백프레셔 4단계 | ClickHouse에 부하를 걸어 삽입 지연 유발 | 정상 → 주의 → 경고 → 위험 전이, 스풀 전환 |
| ClickHouse 5분 중단 | `docker stop clickhouse` | 무손실·무중복 복구, 소진 시간 ≤ 중단 시간의 30% |
| Redis 3분 중단 | `docker stop redis` | Collector 스풀 전환, 조회 API degrade, 최신값 503 |
| **volatile-lru 축출 연쇄** | maxmemory를 1.6 GB로 하향 | **스트림 적체 → 캐시 히트율 하락 → 조회 지연 상승**의 연쇄 관찰 |
| `REDIS_STREAM_BUFFER` off | 스위치 + ClickHouse 중단 | 폴링 주기 붕괴와 유실 발생 — 제1원칙의 증명 |
| DLQ | 잘못된 페이로드 주입 | DLQ 이동 + 알림 |

**volatile-lru 축출 연쇄가 이 프로젝트의 학습 정점이다.** "수집 폭주가 조회 성능 저하로 번진다"는 명제를 한 인스턴스 안에서 눈으로 확인하는 실험이며, 설계서가 Redis 인스턴스 분리(확장 로드맵 3단계)의 진입 근거로 지목한 바로 그 현상이다. 캐시 히트율과 스트림 길이의 역상관 그래프를 한 화면에 그려 기록으로 남긴다.

### S7 — 업무 데이터 축 (3~5일, 후순위)

| 항목 | Redis 학습 가치 | 순서 |
|---|---|---|
| 알람 판정 (Redis Hash 상태 머신 + Pub/Sub) | 중 | 1 |
| 인증 (JWT + 리프레시 토큰 TTL 키 + 레이트 리밋 INCR) | 중하 | 2 |
| 작업지시 / 생산실적 / 감사로그 CRUD | **없음** | 3 (또는 생략) |

**이 축을 뒤로 미루는 근거:** 학습 목표가 Redis 시계열 처리이므로, 순수 CRUD는 구조 완성도에 기여할 뿐 학습에 기여하지 않는다. 다만 **마스터 데이터(site/line/device/tag_master/modbus_config)는 예외로 S2에서 최소 형태로, S4에서 완성한다.** Collector가 태그 정의 없이는 동작할 수 없고, 태그 마스터 변경 → Redis DEL → `SYSTEM RELOAD DICTIONARY` 무효화 체인이 폴리글랏 연계의 핵심 학습 지점이기 때문이다.

### 5.1 전체 일정 요약

| 단계 | 소요 | 누적 | 이 단계가 끝나면 말할 수 있는 것 |
|---|---|---|---|
| S0 | 0.5~1일 | 1일 | PEL이 무엇인지 손으로 안다 |
| S1 | 0.5~1일 | 2일 | 생성기가 병목이 아님을 수치로 안다 |
| S2 | 3~5일 | 7일 | 데이터가 끝까지 흐른다. **비교 기준선이 있다** |
| S3 | 4~6일 | 13일 | at-least-once와 멱등성이 실제로 동작한다 |
| S4 | 4~6일 | 19일 | 캐시 히트율을 80%로 만드는 조건을 안다 |
| S5 | 3~5일 | 24일 | 이 시스템이 몇 pps에서 꺾이는지 안다 |
| S6 | 3~5일 | 29일 | **Redis가 왜 이 자리에 있는지 수치로 증명할 수 있다** |
| S7 | 3~5일 | 34일 | 시스템으로서 완결된다 |

---

## 6. 리포지터리 초기 구조

tech_stack.md 11절의 제안 구조를 따르되, 계획 문서와 측정 기록 디렉터리를 추가한다.

```text
db_study/
├─ apps/
│  ├─ web/                   Next.js (호스트 pnpm dev, 3001)
│  └─ api/
│     └─ src/
│        ├─ modules/
│        │  ├─ auth, master, work-orders, alarms, timeseries, realtime   제어 평면
│        │  ├─ collector, plc-sim, ingest, datagen                       데이터 평면
│        │  └─ metrics                                                   관측
│        └─ common/
│           ├─ redis/         키 계열별 래퍼 (7.5절 — TTL 강제)
│           └─ ports/         스위치가 주입되는 포트 인터페이스 (4.3절)
├─ packages/shared/           zod 스키마, API 타입, Stream 페이로드 계약(msgpackr)
├─ infra/
│  ├─ compose/                docker-compose.yml (+ observability 프로파일)
│  ├─ clickhouse/             DDL 순번 파일, config.d, Dictionary 정의
│  ├─ postgres/               초기화 SQL, postgresql.conf
│  ├─ redis/                  redis.conf (volatile-lru)
│  └─ observability/          prometheus.yml, Grafana 대시보드 JSON
├─ loadtest/                  k6 시나리오
├─ snapshots/                 볼륨 tar, pg_dump (Git 제외)
├─ docs/measurements/         측정 기록 (8절)
├─ architecture.md  data_flow.md  tech_stack.md  implementation_plan.md
└─ Taskfile.yml               migrate / seed / snapshot / restore / bench
```

---

## 7. 설계서 보정 항목

구현 전에 정리해야 할 문서 내부의 모순·누락 5건이다. 전부 실제 코드 작성 시점에 결정을 강요하는 지점이다.

### 7.1 배치 트리거 산술이 자기 표와 모순된다 (우선순위: 높음)

data_flow.md 4.1의 배치 크기 표는 **50,000행 → 초당 0.2회 삽입 → 권장**이라고 적었지만, 같은 행의 비고에 "최대 5초 (시간 트리거로 1초 제한)"이라고 적혀 있다. 두 값은 양립하지 않는다.

M 티어(10,000 pps)에서 실제로 일어나는 일:

| 조건 | 계산 | 결과 |
|---|---|---|
| 50,000행을 채우는 데 걸리는 시간 | 50,000 ÷ 10,000 pps | **5초** |
| 시간 트리거 | 1,000 ms | **1초에 먼저 발동** |
| 실제 배치 크기 (컨슈머 1개) | 10,000 pps × 1s | **10,000행, 초당 1회** |
| 실제 배치 크기 (컨슈머 3개) | 각 3,333 pps × 1s | **3,333행, 초당 3회** |

즉 **행수 트리거 50,000은 M 티어에서 도달 불가능한 값이고, 지배하는 것은 시간 트리거다.** 그리고 컨슈머를 3개로 늘리면 각자 독립적으로 플러시하므로 **파트 생성률이 3배**가 된다. 초당 3회는 같은 문서가 "파트 폭증 위험"으로 분류한 1,000행/10회 구간에 근접하며, ClickHouse 권장 상한(테이블당 초당 1회)의 3배다.

**컨슈머 다중화와 배치 크기 정책이 서로를 무효화하고 있다.**

선택지:

| 안 | 내용 | 장단 |
|---|---|---|
| A. 읽기·삽입 분리 (권장) | 컨슈머 N개는 XREADGROUP과 디코딩만 담당하고, 디코딩된 행을 **단일 flusher**로 fan-in해 삽입은 1곳에서 | 파트 생성률이 컨슈머 수와 무관해진다. XACK은 flusher가 삽입 성공 후 엔트리 ID를 되돌려 수행 |
| B. 컨슈머 1개 + 배치 확대 | 다중화를 포기하고 배치 시간 트리거를 2~3초로 | 가장 단순. 지연 예산이 늘어남 |
| C. `async_insert` 활성화 | 서버 측에서 블록을 합치게 함 | 설계서 7.5절은 "IngestModule이 이미 대량 배치를 만드므로 불필요"라며 껐다. 전제가 틀렸으므로 재검토 대상 |

**A를 채택하되, S3에서 B·C와 비교 측정한다.** 이 세 안의 파트 생성률·E2E 지연 비교는 그 자체로 좋은 실험이다. 결론을 architecture.md 9.1절과 data_flow.md 4.1~4.2절에 반영한다.

### 7.2 ClickHouse 중단 시 최신값이 함께 정지한다 (우선순위: 높음)

설계서의 최신값 갱신 주체는 IngestModule이고, 갱신 시점은 **ClickHouse 삽입 성공 + XACK 이후**다(architecture.md 9절, data_flow.md 4절).

따라서 ClickHouse가 5분간 멈추면 `rt:latest:*`도 5분간 갱신되지 않는다. **실시간 모니터링 대시보드가 5분간 멈춘다.** 그런데 architecture.md 17절 장애 시나리오표의 "ClickHouse 중단" 행에는 "무손실 소진"만 적혀 있고 최신값 정지에 대한 언급이 없다. data_flow.md 12.3절의 복구 시퀀스에도 없다.

실시간 모니터링이 OLAP 삽입 지연에 묶이는 것은 아키텍처적으로 아쉬운 결합이다. 대안:

| 안 | 내용 | 대가 |
|---|---|---|
| A. 현행 유지 | Ingest가 소유 | ClickHouse 장애가 대시보드 정지로 번진다. 최소한 **문서에 명시**하고 UI에 STALE 표시를 띄워야 한다 |
| B. Collector가 갱신 | XADD와 같은 파이프라인에 HSET을 함께 보냄 | 최신값이 삽입 경로에서 완전히 분리된다. Redis 왕복 추가 비용 없음(같은 파이프라인). 단 "Ingest가 최신값을 소유한다"는 책임 분할이 깨지고, 부팅 시 ClickHouse `argMax` 복원 로직의 소유자가 모호해진다 |

**B를 유력하게 보되 S6에서 실측으로 결정한다.** "최신값 갱신 주체를 옮기면 ClickHouse 중단 중에도 대시보드가 살아 있는가"는 그 자체로 훌륭한 실험이고, 두 저장소의 결합도를 체감하는 최적의 사례다. 어느 쪽을 택하든 결과를 architecture.md 17절에 반영한다.

### 7.3 알람 상태 조회가 수집 경로의 상한을 만든다 (우선순위: 중)

data_flow.md 8절의 알람 판정 시퀀스는 **각 행마다** `HGETALL alarm:state:{rule_id}`를 수행한다. 배치당 수만 행이 들어오는 경로에서 행당 Redis 왕복 1회는 즉시 처리량 상한이 된다. 게다가 설계서의 지연 예산표(data_flow.md 15절)에는 **알람 판정 구간이 아예 없다.**

추가로, 알람 판정은 Ingest가 AlarmModule을 **동일 프로세스 내 직접 호출**로 넘긴다고 되어 있는데, 이는 설계서 제1원칙("모듈 경계는 Redis Stream. 같은 프로세스 안이어도 예외가 아니다")의 유일한 예외다. 의도된 예외라면 근거를 적어야 하고, 아니라면 경계를 맞춰야 한다.

권장 처리:

| 항목 | 권장 |
|---|---|
| 상태 조회 | 배치 단위로 **관련 rule_id만 파이프라인 HGETALL 1회**. 또는 판정 전체를 Lua 스크립트 1회로 |
| 상태 보관 | 프로세스 내 메모리 캐시 + 비동기 write-back도 가능하지만, 역할 분리(APP_ROLE) 시 두 워커가 같은 규칙을 평가하는 경합이 생긴다. **Redis Hash 유지가 맞고, 왕복 횟수만 줄인다** |
| 지연 예산 | data_flow.md 15절에 알람 판정 구간(목표 p95)을 신설 |
| 모듈 경계 | 직접 호출을 유지하려면 "알람은 Ingest 배치의 후처리이며 재처리 단위가 배치와 동일하므로 별도 큐가 불필요하다"는 근거를 architecture.md 1절 예외로 명시 |

### 7.4 캐시 무효화 체인에서 BFF와 브라우저가 빠져 있다 (우선순위: 중)

data_flow.md 7.1의 무효화 순서는 4단계다: 커밋 → Redis DEL → Pub/Sub → `SYSTEM RELOAD DICTIONARY`. 그런데 이 시스템의 캐시는 **4단**이다.

| 단 | 캐시 | TTL | 무효화 체인 포함 여부 |
|---|---|---|---|
| 1 | Redis | 600s | 포함 |
| 2 | ClickHouse Dictionary | 300~600s | 포함 |
| 3 | **Next.js 서버 fetch (`revalidate 30`)** | 30s | **빠짐** |
| 4 | **TanStack Query (`staleTime`)** | 설정값 | **빠짐** |

data_flow.md 17절 검증 체크리스트에는 "캐시 정합성 | 마스터 수정 후 API 응답 | **무효화 후 즉시 반영**"이 합격 기준으로 적혀 있지만, 실제로는 BFF 캐시 때문에 최대 30초, 브라우저 `staleTime`만큼 더 늦는다. **현재 설계대로 만들면 이 체크리스트 항목은 반드시 실패한다.**

보정: 무효화 체인에 5·6단계를 추가한다. Next.js는 `revalidateTag`로 태그 기반 무효화를 걸고(API 응답에 태그를 실어 보내거나 BFF에서 태그를 부여), 브라우저는 Pub/Sub → WebSocket으로 받은 무효화 신호에 TanStack Query의 `queryClient.invalidateQueries`를 건다. `ch:cacheinv` 채널이 이미 있으므로 구독자만 늘리면 된다.

### 7.5 "TTL 린트 강제"의 실행 수단이 없다 (우선순위: 중)

architecture.md 8.3절은 키 계열별 TTL 규칙을 **"린트 규칙으로 강제한다"** 고 두 번 적었다. 그런데 Biome로는 "`cache:`로 시작하는 키에 `SET`을 호출할 때 TTL 인자가 있는가"를 검사할 수 없다. 이건 린터가 아니라 **타입 시스템과 래퍼의 일이다.**

이 규칙은 장식이 아니다. 설계서 자신이 "Stream 계열에 실수로 TTL을 부여하면 메모리 압박 시 스트림 엔트리나 알람 상태가 조용히 사라진다"고 경고했고, 단일 Redis 인스턴스 구성에서는 **키 접두사 하나가 곧 데이터 생존 정책의 경계선**이다. 강제 수단 없이 규칙만 적어 두면 반드시 새어 나간다.

권장 구현 (`apps/api/src/common/redis/`):

| 래퍼 | 강제 사항 |
|---|---|
| `CacheKeyClient` (`cache:`, `sess:`, `lock:`, `rl:`, `auth:`) | 모든 쓰기 메서드가 **TTL 인자를 필수 파라미터로** 받는다. TTL 없는 호출은 컴파일되지 않는다. 지터(±20%)를 래퍼가 자동 적용 |
| `DurableKeyClient` (`stream:`, `rt:`, `alarm:`) | TTL 계열 명령(`EXPIRE`, `SETEX`, `SET ... EX`)을 **아예 노출하지 않는다** |
| 공통 | 50 ms 타임아웃 + 예외 무시 래퍼는 `CacheKeyClient`에만. `DurableKeyClient`는 실패를 그대로 던져 백프레셔를 발동시킨다 (architecture.md 17절 degrade 원칙) |

이렇게 하면 "같은 Redis 안에서 키 계열에 따라 실패 전략이 정반대"라는 설계서의 핵심 명제가 **코드 구조로 표현되어** 검토 없이도 지켜진다. architecture.md 8.3절의 "린트 규칙"을 이 방식으로 교체한다.

---

## 8. 측정 기록 체계

설계서는 "숫자 없는 Phase 완료는 인정하지 않는다"고 규칙을 세웠지만, 그 숫자를 **어디에 어떤 형식으로** 쌓을지는 정하지 않았다. 형식이 없으면 3주 뒤에 자기 수치를 믿을 수 없게 된다.

`docs/measurements/NNN-<실험명>.md` 에 다음 템플릿으로 기록한다.

```markdown
# 003 — 최신값 조회: Redis 경유 대 ClickHouse 직접

## 조건
| 항목 | 값 |
|---|---|
| 커밋 | a1b2c3d |
| 프로파일 | 부하 실험 (Docker 12 GB) |
| 용량 티어 | M (10,000 pps) |
| 스위치 | REDIS_LATEST_CACHE=off/on, 그 외 기본값 |
| 관측 스택 | 끔 (/metrics 직접 덤프) |
| 반복 | 3회, 중앙값 채택. 편차 6% |

## 결과
| 지표 | off | on | 비율 |
|---|---|---|---|
| p50 | ... | ... | ... |
| p95 | ... | ... | ... |
| 최대 처리량(RPS) | ... | ... | ... |
| ClickHouse CPU | ... | ... | ... |

## 해석
(왜 이 차이가 났는가. 예상과 다른 점.)

## 설계서 반영
(architecture.md N절의 어느 수치를 갱신했는가.)
```

절대 규칙 세 가지:

| 규칙 | 근거 |
|---|---|
| 모든 수치에 **커밋 해시 + 프로파일 + 티어 + 스위치 상태**를 병기 | 넷 중 하나만 달라도 비교가 무의미해진다 |
| 3회 실행 중앙값, 편차 20% 초과 시 폐기 | 2.4절. P/E 코어 혼합 + WSL2 vCPU 매핑 불확실성 |
| 실험 전 `task snapshot`, 실험 후 `task restore` | data_flow.md 11.3절. TTL과 머지가 진행된 데이터 위에 다시 부하를 걸면 직전 실험의 잔재가 섞인다 |

---

## 9. 착수 체크리스트

S0 시작 전에 끝내야 할 것들이다.

| 순서 | 항목 | 명령·확인 |
|---|---|---|
| 1 | **WSL2 메모리 상향** | `.wslconfig`에 `memory=20GB` 추가 → PowerShell에서 `wsl --shutdown` → 재진입 후 `free -g`로 확인 |
| 2 | Docker 데몬 기동 확인 | `docker info` (현재 미기동) |
| 3 | pnpm 설치 | `corepack enable && corepack prepare pnpm@latest --activate` |
| 4 | Node 22 LTS 고정 | 호스트가 v24.20.0. `fnm` 또는 `corepack`으로 22.15+ 고정 (설계서 12절 버전 고정 원칙) |
| 5 | 디스크 여유 확인 | 936 GB 여유. M+ 티어(500 GB)까지 가능 |
| 6 | 버전 재확인 | 설계서 12절 지시대로 PostgreSQL 18 / ClickHouse 25.8 LTS / Redis 8의 현 시점 최신 안정 태그를 공식 릴리스 노트로 확인하고 고정표 갱신 |
| 7 | 보정 항목 결정 | 7.1(배치 트리거)과 7.2(최신값 소유자)는 S3 이전에 결정해야 코드를 두 번 쓰지 않는다 |

---

## 10. 요약: 이 계획이 기존 설계서에 더하는 것

| 추가 | 절 | 이유 |
|---|---|---|
| **Redis 역할 스위치 9종** | 4 | "이해"는 비교에서 온다. 스위치 없이는 Redis의 기여분을 분리할 수 없다 |
| **수직 슬라이스 우선 재배열** | 3, 5 | 계층별로 쌓으면 Phase 2 끝까지 아무것도 측정할 수 없다 |
| **실측 기반 프로파일 재산정** | 2 | 문서는 32 GB·4 vCPU를 가정했고, 실제는 15 GB·20스레드다 |
| **cpuset 기반 부하 생성기 격리** | 2.4 | 20스레드 머신에서는 문서가 포기한 측정 원칙을 부분적으로 되살릴 수 있다 |
| **3회 중앙값 규칙** | 2.4, 8 | P/E 코어 혼합 환경에서 단일 실행 수치는 신뢰할 수 없다 |
| **설계서 보정 5건** | 7 | 구현 시점에 결정을 강요하는 모순·누락 |
| **측정 기록 템플릿** | 8 | "숫자 없는 완료는 불인정" 규칙에 실행 형식을 부여 |

---

## 관련 문서

- tech_stack.md — 기술 선정 근거, 버전 고정, 로컬 실행 환경, 학습 로드맵
- architecture.md — 시스템 구조, 스키마, Redis 키 설계, 수집 파이프라인, 장애 시나리오
- data_flow.md — 데이터 흐름 10종, 지연 예산, 데이터 계약, 수명 주기
