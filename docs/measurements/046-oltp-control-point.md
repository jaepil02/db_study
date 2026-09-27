# 046 — 역방향 대조 PK 점조회: PostgreSQL B-tree 대 ClickHouse 희소 인덱스(그래뉼 8192 · 256) · 동시성 1 · 8 · 32 · 업무 규모 10^4 · 10^5 · 10^6 — 기록 041 폐기 뒤 재측정 (S5)

> 실험: EXP-41 · 상태: 유효 · 정정 대상: 없음(기록 041 폐기 뒤 재측정 — supersedes 아님) · 판정 창: 2026-09-27T01:22:37.909Z ~ 2026-09-27T02:20:04.407Z(첫 측정 줄 ~ 마지막 측정 줄 · 조건 확정 전 실행 줄 포함 — §조건 반복 · 교체 행) · 실행 2026-09-27 10:22:16 ~ 11:20:04 KST(init ~ 마지막 측정 · EXP-40 재측정과 같은 러너 실행 안에서 교대)

기록 041(discarded — PostgreSQL 동시성 8 · 32 클라이언트 꼬리 편차 초과)과 같은 질문을 조건을 다시 잡아 쟀다. work_order를 order_id 하나로 읽는 점조회를 PostgreSQL PK btree 인덱스 스캔과 ClickHouse 기본 키 희소 인덱스로 같은 대상 분포에 걸고, 조회 지연 · 조회당 읽은 양 · 처리량을 동시성 1 · 8 · 32 × 업무 규모 3단계에서 잰다. ClickHouse는 index_granularity 8192(plc.work_order_control)와 256(실행 범위 변형 테이블 lab_oltp_g256.work_order_control — 05_data_stores/10 §그래뉼 변형 판정 ②) 두 변형이다.

질문은 05_data_stores/10 §원리 대응 점조회 행 — "조회당 읽는 행 수가 그래뉼 크기에 묶이는가"다. 수치는 전부 원시(docs/measurements/raw/046-oltp-control-point.jsonl)에 있는 값만 쓴다.

**조건은 측정 도중 한 번 바뀌었다(§조건 실행기 인자 행 · §폐기 · 예외).** 계획은 동시성 8 · 32 조회 2만 · 예열 2만이었으나 ClickHouse가 동시성 32에서 서버 메모리 한도 초과로 세 번 실패해, 동시성 8 · 32를 조회 1만 · 예열 2,000으로 줄이고 ClickHouse 호출마다 로그 버퍼를 비우는 절차를 더했다. 조건이 확정되기 전에 잰 실행은 새 조건으로 다시 쟀고, 요약(collect)은 반복마다 마지막 실행만 쓴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 5492c73(러너 state · init git.commitHash · 실행기 run.commitHash — 5c01375의 러너 · 실행기 개정 포함) · init · detail git.dirty true — git.dirty 범위(scripts/lab/s5/oltp/oltp.py:175 — apps/api · packages · infra · scripts/lab/s5) 안의 미커밋 변경은 scripts/lab/s5/load/modeb-steps.sh(실행 전 수정 · 다른 세션)다 · 이미지에 들어가는 경로는 oltp.sh의 require_clean이 init · adopt · reset · run마다 통과시켰다(실패하면 중단) |
| 저장소 자원 | 대조 자원 조건 — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인(resourcesBad 없음 · task up CONTROL=1) |
| 측정 경로 | oltp-lab 도구 컨테이너(CPU 집합 11-12 · CPU 2)의 Node 실행기 → pg · @clickhouse/client 직접 · api 비경유 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · run.memoryLimitMb null + **run.memoryLimitSource "cgroup max — oltp-lab 서비스에 compose 상한 없음"** — 도구 컨테이너 경로의 null은 상한이 없다는 사실값이라 4요소 충족이다(04 §조건 칸 도구 컨테이너 경로 불릿 · 2026-09-27) · 대조 메모리 3,584 MB는 저장소 컨테이너 상한이라 조건 칸 controlMemoryMb(3,584 · 3,584)에 적는다 |
| 용량 티어 | **해당 없음** — 업무 규모 단계가 축이다(05_data_stores/10 §역방향 측정 조건) |
| 스위치 | 전부 기본값 · SW-09=off(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 상태 분포 | 없음(배경 부하 없음) · 42 · IN_PROGRESS 비율 0.5 |
| 시작 상태 · 초기화 | 새 OLTP_DIR snapshots/lab-s5-oltp-r2 · 규모마다 adopt — 1차 채움 스냅샷 oltp-s{규모}-19f8861 재사용(경로 가드 + 실행기 verify — 세 저장소 (order_id · order_no) 집합 md5 · 상태 분포 · 표본 200행 불일치 0 · match true · 원시 adopt 3행) · 변형 사이 reset(PostgreSQL 실행 뒤 reset all · ClickHouse 대조 테이블 상태를 바꾼 실행 뒤 reset clickhouse) · 점조회는 상태를 바꾸지 않는다 |
| 그래뉼 변형 | 256 변형은 실행 안에서 lab_oltp_g256에 같은 DDL(granularity만 256 · DDL sha256 6f147dcc…)을 만들고 INSERT SELECT로 같은 행을 채운 뒤 수렴 · 실행 끝에 삭제 · **MODIFY SETTING index_granularity는 거부된다(code 472 "Setting 'index_granularity' is readonly for storage 'MergeTree'" — 규모 3단계 전부 detail.g256.modifyGranularity)** |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads auto(3) · max_concurrent_queries 32 · use_query_condition_cache 1 · use_uncompressed_cache 0(서버 기본) · **서버 로그 수준 — 이미지 기본 trace(infra/clickhouse/config.d에 logger 설정 없음 · text_log Debug — 리드 확인)** · PostgreSQL 18.6 · shared_buffers 896MB · 실험 세션 synchronous_commit off(서버 기본 on · 공정성 규칙 5) |
| 실행기 인자(2계층) | 동시성 1 — 측정 조회 2,000 · 예열 2,000 / **동시성 8 · 32 — 측정 조회 10,000 · 예열 2,000**(두 저장소 동일) · 동시 요청 상한 동시성 × 4(inflight 4 · 32 · 128) · 커넥션 상한 = 동시성(detail.connections pgMax · chMax 1 · 8 · 32) · EXPLAIN 표본 20건(측정 창 밖) |
| ClickHouse 호출 앞 절차 | **EXP-41 ClickHouse 호출 직전마다 SYSTEM FLUSH LOGS + SYSTEM JEMALLOC PURGE** — 로그 버퍼 비움 · 할당자 반환이며 마크 · 조건 캐시는 건드리지 않는다(웜 조건 유지). 리드 대기열 스크립트가 러너 호출 앞에 실행했고 러너 원시에는 남지 않는다(리드 확인) |
| 계기 | 클라이언트 지연 p50 · p95(측정 조회 전수의 정확 분위수 · 선형 보간) · 서버 시간 — ClickHouse query_log(log_comment) · PostgreSQL pg_stat_statements 평균(**소수 6자리 · 1 ns 해상도 — 1차 3자리에서 개정**) · 조회당 읽은 양 — ClickHouse query_log read_rows · read_bytes 평균 · PostgreSQL EXPLAIN 표본의 shared hit + read 블록 · 도구 CPU = 실행기 프로세스 CPU ÷ 벽시계 ÷ CPU 2 · **이벤트 루프 사용률(detail.eventLoop — 측정 창 · 기록만)** |
| 도구 CPU 포화 | 문턱 0.9(공정성 규칙 10 · 러너 TOOL_CPU_SATURATED) — 포화 반복 **0** · 최대 0.647(PostgreSQL 10^5 동시성 32) |
| 이벤트 루프 사용률 | 후보 문턱 0.9 이상 **18/81 창**(PostgreSQL 동시성 8 · 32 × 3규모 × 3회 전부) — **판정 미적용(appliedToJudgement false · 공정성 규칙 10 개정 전)** · §해석 한계 불릿 |
| 관측 스택 · CPU 배치 | off · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts · 1차와 같은 설정) · 테이블 코덱은 DDL 기본 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회(반복 0 · 1 · 2) · 판정 지표 최대 편차 **14.7%**(PostgreSQL 10^6 동시성 1 latency_p95) · 기준 20% 초과 판정 지표 **0행** |
| 반복 · 교체 | 조건 확정 전 실행 23회(17키 — 2회 11 · 3회 6)를 새 조건으로 다시 쟀다(FORCE) · 요약은 반복마다 마지막 실행 — 측정 줄 797 중 621이 요약에 들어가고 176이 교체된 실행이다 · ClickHouse 동시성 1 10^4 반복 0(두 변형)은 인자가 같지만 로그 비움 절차 전 값이라 다시 쟀다 |
| 스크립트 · 원시 | scripts/lab/s5/oltp/oltp.sh(init · adopt · reset · run · collect) · 원시 docs/measurements/raw/046-oltp-control-point.jsonl(963행 · 앞 62행은 EXP-40 재측정 원시 047과 같은 공통 행 — init 1 · probe 1 · adopt 3 · executor_failed 3 · reset 54 · 측정 797 · detail 104) · 최종 EXP-41 81회 호출 전부 종료 코드 0 · 실패 3회는 조건 확정 전(§폐기 · 예외) |

## 결과

값은 **중앙값**(반복 0 · 1 · 2)이다. 단위 ms.

### 클라이언트 지연 p50

| 변형 | 동시성 | 10^4 | 10^5 | 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.101**(0.101 · 0.104 · 0.1) | **0.103**(0.103 · 0.104 · 0.101) | **0.102**(0.104 · 0.101 · 0.102) |
| ClickHouse 그래뉼 8192 | 1 | **4.176**(4.176 · 4.117 · 4.211) | **4.167**(4.134 · 4.167 · 4.223) | **4.268**(4.294 · 4.268 · 4.185) |
| ClickHouse 그래뉼 256 | 1 | **3.981**(3.981 · 3.961 · 3.998) | **3.973**(3.993 · 3.956 · 3.973) | **4.16**(4.171 · 4.16 · 4.083) |
| PostgreSQL PK btree | 8 | **0.179**(0.162 · 0.182 · 0.179) | **0.167**(0.167 · 0.159 · 0.174) | **0.161**(0.161 · 0.161 · 0.16) |
| ClickHouse 그래뉼 8192 | 8 | **4.098**(4.098 · 4.09 · 4.11) | **3.917**(3.853 · 3.935 · 3.917) | **4.166**(4.197 · 4.072 · 4.166) |
| ClickHouse 그래뉼 256 | 8 | **2.571**(2.579 · 2.566 · 2.571) | **2.623**(2.623 · 2.624 · 2.54) | **4.042**(4.042 · 3.838 · 4.052) |
| PostgreSQL PK btree | 32 | **0.616**(0.634 · 0.616 · 0.612) | **0.575**(0.564 · 0.583 · 0.575) | **0.57**(0.57 · 0.558 · 0.597) |
| ClickHouse 그래뉼 8192 | 32 | **15.301**(14.997 · 15.904 · 15.301) | **14.73**(14.599 · 15.116 · 14.73) | **16.287**(16.47 · 16.287 · 16.176) |
| ClickHouse 그래뉼 256 | 32 | **8.611**(8.314 · 8.676 · 8.611) | **8.38**(8.38 · 8.63 · 8.133) | **15.56**(15.728 · 15.56 · 15.324) |

### 클라이언트 지연 p95

| 변형 | 동시성 | 10^4 | 10^5 | 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.134**(0.134 · 0.138 · 0.13) | **0.135**(0.136 · 0.135 · 0.133) | **0.143**(0.143 · 0.13 · 0.151) |
| ClickHouse 그래뉼 8192 | 1 | **5.33**(5.372 · 5.26 · 5.33) | **5.288**(5.277 · 5.288 · 5.303) | **5.345**(5.407 · 5.345 · 5.287) |
| ClickHouse 그래뉼 256 | 1 | **5.028**(5.028 · 4.996 · 5.077) | **5.072**(5.078 · 5.032 · 5.072) | **5.281**(5.281 · 5.32 · 5.237) |
| PostgreSQL PK btree | 8 | **0.421**(0.379 · 0.421 · 0.423) | **0.392**(0.381 · 0.392 · 0.428) | **0.408**(0.43 · 0.408 · 0.396) |
| ClickHouse 그래뉼 8192 | 8 | **6.908**(6.908 · 6.741 · 6.953) | **6.598**(6.539 · 6.598 · 6.669) | **7.054**(7.138 · 6.903 · 7.054) |
| ClickHouse 그래뉼 256 | 8 | **5.272**(5.348 · 5.272 · 5.218) | **5.547**(5.547 · 5.561 · 5.342) | **7.173**(7.352 · 6.96 · 7.173) |
| PostgreSQL PK btree | 32 | **1.662**(1.66 · 1.812 · 1.662) | **1.849**(1.682 · 1.862 · 1.849) | **1.854**(1.906 · 1.753 · 1.854) |
| ClickHouse 그래뉼 8192 | 32 | **31.07**(30.456 · 32.301 · 31.07) | **29.642**(29.642 · 30.626 · 29.253) | **32.236**(32.236 · 32.394 · 31.713) |
| ClickHouse 그래뉼 256 | 32 | **23.328**(23.328 · 23.036 · 23.753) | **23.537**(22.889 · 23.537 · 23.701) | **31.76**(32.056 · 31.76 · 31.107) |

- 검산: 칸 = 변형 3 × 동시성 3 × 규모 3 = **27**(표마다)

### 서버 시간 · 처리량 · 도구 CPU(참고)

중앙값만 적는다(반복별 값은 기계 판독 블록). 서버 시간은 ClickHouse query_log 평균 · PostgreSQL pg_stat_statements 평균이다 — PostgreSQL은 6자리 값을 그대로 적는다.

| 변형 | 동시성 | 서버 평균 10^4 · 10^5 · 10^6 | 처리량 req/s 10^4 · 10^5 · 10^6 | 도구 CPU 10^4 · 10^5 · 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.004126** · **0.005191** · **0.006128** | **9,275** · **9,028** · **8,961** | **0.348** · **0.345** · **0.341** |
| ClickHouse 그래뉼 8192 | 1 | **1.721** · **1.69** · **1.735** | **228** · **232** · **228** | **0.07** · **0.073** · **0.069** |
| ClickHouse 그래뉼 256 | 1 | **1.25** · **1.237** · **1.663** | **250** · **250** · **231** | **0.09** · **0.093** · **0.068** |
| PostgreSQL PK btree | 8 | **0.004841** · **0.005518** · **0.008664** | **38,944** · **39,925** · **40,539** | **0.631** · **0.642** · **0.635** |
| ClickHouse 그래뉼 8192 | 8 | **2.591** · **2.45** · **2.683** | **1,859** · **1,950** · **1,829** | **0.192** · **0.2** · **0.193** |
| ClickHouse 그래뉼 256 | 8 | **1.357** · **1.386** · **2.597** | **2,798** · **2,710** · **1,852** | **0.272** · **0.27** · **0.202** |
| PostgreSQL PK btree | 32 | **0.004774** · **0.006235** · **0.009094** | **38,276** · **39,587** · **39,124** | **0.631** · **0.641** · **0.641** |
| ClickHouse 그래뉼 8192 | 32 | **12.4** · **11.751** · **13.355** | **1,940** · **2,027** · **1,844** | **0.205** · **0.212** · **0.197** |
| ClickHouse 그래뉼 256 | 32 | **5.791** · **5.849** · **12.6** | **3,126** · **3,209** · **1,913** | **0.311** · **0.321** · **0.21** |

### 조회당 읽은 양

동시성 1 행을 적는다. EXPLAIN은 반복 0 표본의 계획이고 세 반복의 계획이 같다. 동시성 8 · 32는 측정 조회가 10,000건이라 대상 분포 표본이 동시성 1(2,000건)과 달라 read_rows 평균이 소수점 아래에서 다르다(예: 8192 변형 10^5 8,357.44 · 256 변형 10^6 256.85 — 기계 판독 블록).

| 변형 | 계기 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL PK btree | 조회당 행 | **1**(1 · 1 · 1) | **1**(1 · 1 · 1) | **1**(1 · 1 · 1) |
| PostgreSQL PK btree | 읽은 블록(shared hit + read) | **3**(3 · 3 · 3) | **3**(3 · 3 · 3) | **4**(4 · 4 · 4) |
| ClickHouse 그래뉼 8192 | read_rows | **10,000**(10,000 · 10,000 · 10,000) | **8,359.06**(8,361.6 · 8,353.12 · 8,359.06) | **8,188.19**(8,188.19 · 8,188.19 · 8,184.38) |
| ClickHouse 그래뉼 8192 | read_bytes(B) | **570,076**(570,076 · 570,076 · 570,076) | **476,542**(476,687 · 476,204 · 476,542) | **315,026**(315,031 · 312,160 · 315,026) |
| ClickHouse 그래뉼 256 | read_rows | **257.6**(258.02 · 257.6 · 257.29) | **256.64**(257.25 · 256.64 · 256.34) | **256**(256 · 256 · 255.9) |
| ClickHouse 그래뉼 256 | read_bytes(B) | **14,244**(14,267 · 14,244 · 14,227) | **14,191**(14,225 · 14,191 · 14,174) | **9,616**(9,457 · 9,698 · 9,616) |

- **ClickHouse read_rows는 그래뉼 하나다.** EXPLAIN의 Granules가 모든 규모 · 반복에서 1/N이다 — 8192 변형 1/1 · 1/12 · 1/123 · 256 변형 1/39 · 1/391 · 1/3907. 10^4 8192 변형은 테이블 전체(10,000행)가 그래뉼 1개라 한 번의 점조회가 테이블 전체를 읽는다. 10^5 평균 8,359행이 8,192보다 큰 것은 끝 그래뉼이 나머지 행을 담아 크기 때문이다(12 × 8,192 < 100,000).
- **PostgreSQL은 행 1개 · 블록 3 → 4다.** 계획 노드는 세 규모 · 전 반복 Index Scan이다. 10^6에서 블록이 하나 늘어난 것은 btree 높이가 한 단 늘어난 것과 맞는 방향이다(높이는 재지 않았다).

## 해석

- **판정 — 조회당 읽는 행 수는 그래뉼 크기에 묶인다.** ClickHouse는 행 하나를 찾으려고 그래뉼 하나를 통째로 읽는다 — 8192 변형 8,188~10,000행(315,026~570,076 B) · 256 변형 256~257.6행(9,616~14,244 B)이고, 두 변형의 행 비는 10^6에서 8,188.19 ÷ 256 = 32.0으로 그래뉼 비(8192 ÷ 256)와 같다. PostgreSQL btree는 행 1개를 블록 3~4개로 찾는다. 05_data_stores/10 §원리 대응의 구조 사실(B-tree는 루트에서 리프까지 몇 페이지로 행 하나를 가리키고, 희소 기본 인덱스는 그래뉼 하나를 가리키고 그 그래뉼 전체를 읽는다)이 수치로 관측됐다. 이 판정은 기록 041의 구조 사실과 같은 값이다(조회당 행 · 블록 · Granules 1/N 전부 일치).
- **그러나 지연은 읽은 행 수가 아니라 조회 한 건의 고정 비용이 정한다.** 동시성 1에서 ClickHouse 8192 변형 p50 4.167~4.268 ms · 256 변형 3.973~4.16 ms로 읽은 행이 32배 적어도 지연 차는 0.1~0.2 ms다. 서버 시간 차(10^4 · 10^5 server_mean 0.471 · 0.453 ms · server_p50 0.452 · 0.454 ms — 약 0.45~0.47 ms)가 클라이언트 p50 차(0.195 · 0.194 ms — 약 0.19 ms)보다 크다. 서버 밖 몫(클라이언트 p50 − 서버 평균 — HTTP 왕복 · 쿼리 해석 · 결과 직렬화)은 256 변형이 약 0.26 ms 더 길고(8192 약 2.455 · 2.477 ms 대 256 약 2.731 · 2.736 ms), 원인은 재지 않았다. PostgreSQL은 p50 0.101~0.103 ms · 서버 0.004126~0.006128 ms로 ClickHouse의 약 40분의 1이다(동시성 1).
- **10^6에서는 256 변형의 서버 이점이 사라진다.** 256 변형의 동시성 1 서버 평균이 1.25(10^4) → 1.237(10^5) → 1.663 ms(10^6)로 8192 변형(1.735 ms)에 붙는다. 동시성 8 · 32 처리량도 10^4 · 10^5에서는 256 변형이 1.4~1.6배(2,798 대 1,859 · 3,126 대 1,940 req/s 등)였다가 10^6에서 1,852 · 1,913 대 1,829 · 1,844로 좁혀진다. 기본 키 인덱스의 마크 수가 3,907개로 늘어난 것과 같은 방향이지만 서버 쪽 내역(인덱스 탐색 · 마크 캐시)은 재지 않았다 — 원인은 미분리다. 1차 기록 041과 같은 모양이 다시 나왔다.
- **동시성 — ClickHouse는 동시성 8에서 처리량이 멈춘다.** 8192 변형 처리량은 동시성 1 228~232 req/s → 8 1,829~1,950 → 32 1,844~2,027 req/s이고, 동시성 32의 서버 평균이 11.751~13.355 ms로 동시성 1의 7~8배다 — 요청이 서버(CPU 집합 5-7 · 3개 · max_concurrent_queries 32)에서 줄을 선다. 도구 CPU는 0.19~0.32 · 이벤트 루프 0.30~0.52로 도구 쪽 포화가 아니다.
- **PostgreSQL 동시성 8 · 32의 처리량 · 클라이언트 지연은 실행기 메인 스레드 상한에 붙어 있을 수 있다(해석 한계).** 두 동시성에서 처리량이 38,276~40,539 req/s로 같고 서버 평균은 0.004774~0.009094 ms 그대로인데, 이 18창 전부의 이벤트 루프 사용률이 0.992~1이다 — Node 실행기의 메인 스레드가 측정 창 내내 쉬지 않았다. 도구 CPU(프로세스 전 스레드 ÷ CPU 2)는 0.631~0.642로 포화 문턱 0.9 아래라 공정성 규칙 10의 현행 판정으로는 버리지 않지만, 단일 스레드 이벤트 루프의 포화는 이 계기가 가린다(실행기 eventLoopOf 주석과 같은 판단). 그래서 **PostgreSQL 동시성 8 · 32의 처리량은 도구 상한에 가까운 값으로 읽고 저장소 쪽 상한의 하한으로만 쓴다**. 이 계기로는 포화 여부를 확정하지 않으며(판정 미적용), 클라이언트 p50 0.161~0.179(동시성 8) · 0.57~0.616 ms(동시성 32)에는 이벤트 루프 대기가 들어 있을 수 있다. 이벤트 루프 사용률은 기록만 하고 판정에 쓰지 않는다 — 문턱을 판정에 넣는 것은 공정성 규칙 10 개정 사항이라 리드 판정 전이다(요약 toolEventLoop appliedToJudgement false).

| 변형 | 동시성 | 이벤트 루프 사용률(9창 최소 ~ 최대) | 0.9 이상 창 |
|------|:--:|------|:--:|
| PostgreSQL PK btree | 1 | 0.414 ~ 0.435 | 0 |
| PostgreSQL PK btree | 8 | **0.992 ~ 1** | **9** |
| PostgreSQL PK btree | 32 | **1 ~ 1** | **9** |
| ClickHouse 그래뉼 8192 | 1 | 0.095 ~ 0.102 | 0 |
| ClickHouse 그래뉼 8192 | 8 | 0.303 ~ 0.326 | 0 |
| ClickHouse 그래뉼 8192 | 32 | 0.308 ~ 0.345 | 0 |
| ClickHouse 그래뉼 256 | 1 | 0.095 ~ 0.135 | 0 |
| ClickHouse 그래뉼 256 | 8 | 0.311 ~ 0.439 | 0 |
| ClickHouse 그래뉼 256 | 32 | 0.328 ~ 0.515 | 0 |

- 검산: 창 = 변형 3 × 동시성 3 × 규모 3 × 반복 3 = **81** · 0.9 이상 = 9 + 9 = **18**
- **ClickHouse 수치는 trace 로그 부하를 포함한다(해석 한계 · 리드가 W6에서 공정성 판정).** ClickHouse 서버 로그가 이미지 기본 trace 수준이라 조회마다 서버 로그 줄이 쓰이고, 이 부하는 이 기록의 모든 ClickHouse 측정(클라이언트 지연 · 서버 시간 · 처리량)에 들어 있다. PostgreSQL 쪽에는 같은 크기의 로그 부하가 없다 — 두 저장소의 절대값 차에서 이 몫을 가르지 않았다. 호출마다 SYSTEM FLUSH LOGS · JEMALLOC PURGE를 한 것은 메모리 한도 실패를 막으려는 것이고 로그 쓰기 자체를 없애지 않는다.
- **업무 데이터에 PostgreSQL이 맞는 이유의 한 축이 여기서 나온다.** 업무 화면의 읽기는 주문 한 건 · 설비 한 대처럼 키 하나로 행 몇 개를 읽는 모양이다. PostgreSQL은 그 모양에서 읽는 양이 행 · 페이지 단위라 규모가 100배 커져도 블록이 3 → 4로만 늘고 지연 p50이 0.1 ms에 머문다. ClickHouse는 같은 조회에 그래뉼 하나(기본 8,192행)를 읽고 조회당 고정 비용이 약 4 ms라, 그래뉼을 256으로 줄여도 읽는 양만 줄 뿐 지연은 거의 그대로다 — 희소 인덱스는 범위 · 집계 조회의 읽기 단위를 줄이는 구조이지 점조회의 단위를 행으로 만드는 구조가 아니다.
- **한계 — 클라이언트 지연은 HTTP(8123)와 와이어 프로토콜의 왕복 차를 포함한다.** 서버 시간을 함께 적는 이유다(공정성 규칙 4). PostgreSQL 서버 평균은 이번 실행부터 6자리라 1차의 1 µs 칸 차(0.004 · 0.005)가 편차로 부풀지 않는다 — 참고 지표 server_mean의 최대 편차는 11.65%(10^4 동시성 8)다.
- **한계 — 측정 조회 전수의 정확 분위수다(버킷 보간이 아니다).** 04 §반복과 폐기의 "p95 이상은 참고" 조항은 히스토그램 계열에 걸리는 조항이라 여기서는 p95도 판정 지표다(06_experiment_catalog EXP-41 판정 지표 열 p50 · p95). 동시성 1과 8 · 32는 측정 조회 건수가 달라(2,000 대 10,000) 같은 표 안에서도 분위수의 표본 크기가 다르다.

### 기록 041 대비 — 방향 관찰

두 기록은 커밋이 달라(19f8861 → 5492c73) 비교 불성립이다(04 §조건 분리 강제). 아래는 폐기 사유가 된 PostgreSQL 동시성 8 · 32 칸의 방향 관찰이다. 값은 중앙값(편차)이다.

| 규모 · 동시성 | p50 041 → 046 | p95 041 → 046 | 처리량 req/s 041 → 046 | 도구 CPU 041 → 046 |
|------|------|------|------|------|
| 10^4 · 8 | 0.254(16.1%) → **0.179**(11.2%) | 1.082(51.0%) → **0.421**(10.5%) | 20,481 → **38,944** | 0.761 → **0.631** |
| 10^5 · 8 | 0.263(11.8%) → **0.167**(9.0%) | 0.81(17.0%) → **0.392**(12.0%) | 23,328 → **39,925** | 0.767 → **0.642** |
| 10^6 · 8 | 0.262(7.3%) → **0.161**(0.6%) | 0.977(11.4%) → **0.408**(8.3%) | 22,530 → **40,539** | 0.78 → **0.635** |
| 10^4 · 32 | 1.132(10.1%) → **0.616**(3.6%) | 3.342(22.7%) → **1.662**(9.1%) | 21,398 → **38,276** | 0.815 → **0.631** |
| 10^5 · 32 | 1.04(21.9%) → **0.575**(3.3%) | 3.102(33.4%) → **1.849**(9.7%) | 21,030 → **39,587** | 0.791 → **0.641** |
| 10^6 · 32 | 1.092(10.4%) → **0.57**(6.8%) | 3.693(42.6%) → **1.854**(8.3%) | 22,500 → **39,124** | 0.81 → **0.641** |

- 검산: 행 = 규모 3 × 동시성 2 = **6** · 1차 초과 5행(§폐기 · 예외 기록 041)이 전부 이 표 안에 있다
- **흔들림이 줄었고 처리량은 약 1.7~1.9배로 올랐다 — 원인은 미분리다.** 측정 조회가 2,000 → 10,000건이라 측정 창이 약 0.1초 → 약 0.25초로 길어졌고(조회 수 ÷ 처리량), 실행기의 exp41 조회 경로는 두 커밋 사이에 계기(이벤트 루프 · pg_stat_statements 자릿수) 외에 바뀌지 않았다(git diff 19f8861 5492c73 — oltp-point.ts). 창 길이가 원인이라는 것은 재지 않았다. ClickHouse 칸은 두 기록 모두 편차 기준 안이고 지연 대역이 같다(예: 8192 변형 동시성 1 p50 4.078~4.223 → 4.167~4.268 ms).

## 폐기 · 예외

- **편차 기준 이내 — 판정 지표 전부가 20% 이하라 status valid다.** 판정 지표는 06_experiment_catalog EXP-41 판정 지표 열 — p50 · p95 · 조회당 read_rows 대 읽은 블록 · 도구 CPU다(latency_p50 · latency_p95 · read_rows_per_query · blocks_per_query · tool_cpu). 참고 지표(server_mean · server_p50 · qps · read_bytes_per_query · rows_per_query)는 편차 판정에 쓰지 않는다. 편차는 (최대 − 최소) ÷ 중앙값이다.

| 지표 | 행 | 최대 편차 | 그 행 | 20% 초과 |
|------|:--:|------|------|:--:|
| latency_p50 | 27 | 11.2% | PostgreSQL 10^4 동시성 8(0.162 · 0.182 · 0.179) | 0 |
| latency_p95 | 27 | **14.7%** | PostgreSQL 10^6 동시성 1(0.143 · 0.13 · 0.151) | 0 |
| read_rows_per_query | 18 | 0.4% | ClickHouse 256 변형 10^5 동시성 1(257.248 · 256.64 · 256.336) | 0 |
| blocks_per_query | 9 | 0% | PostgreSQL 전 칸(3 · 3 · 4 규모별 동일) | 0 |
| tool_cpu | 27 | 7.4% | ClickHouse 256 변형 10^6 동시성 8(0.202 · 0.213 · 0.198) | 0 |

- 검산: 판정 지표 행 = 27 + 27 + 18 + 9 + 27 = **108** · 초과 **0** · 요약 spreadExceeded(EXP-40 · 41 합산 32)는 전부 EXP-40 행이다
- ClickHouse 지연 54칸(2 변형 × 3 동시성 × 3 규모 × p50 · p95)의 최대 편차는 5.9%다. 참고 지표 중 10%를 넘는 것은 PostgreSQL server_mean 10^4 동시성 8 11.65% 하나다.
- **조건 변경 — 계획한 조건에서 ClickHouse가 서버 메모리 한도 초과로 실패했다(executor_failed 3행 · 원시 공통 행).** ① ch_g256 10^4 동시성 32 반복 0(조회 2만 · 예열 2만) 01:24:40Z ② 같은 인자 재시도 01:25:18Z ③ ch_g8192 10^4 동시성 32 반복 2(조회 2만 · 예열 2,000) 01:40:01Z — 셋 다 종료 코드 1 · stderr "(total) memory limit exceeded"(에러 이름 MEMORY_LIMIT_EXCEEDED 기준 · stderr에 코드 번호 없음 — JS 클라이언트 메시지)이고 한도 값(maximum)이 2.59 → 2.28 → 1.98 GiB로 실패마다 낮았다(stderr 그대로 — 서버 max_server_memory_usage가 RSS에 따라 동적으로 바뀐다). 원인(리드 분석) — ClickHouse 서버 로그가 이미지 기본 trace라(logger 설정 없음 · text_log Debug · Trace 10분 약 470만 줄) 4만 조회(측정 2만 + 예열 2만)를 동시성 32로 보내면 로그 버퍼가 서버 메모리 한도를 넘는다. 조치 — 동시성 8 · 32 측정 조회 10,000 · 예열 2,000(두 저장소 동일 · 동시성 1은 2,000 · 2,000 그대로) · ClickHouse 호출 직전마다 SYSTEM FLUSH LOGS + SYSTEM JEMALLOC PURGE. 조치 뒤 실패는 0이다.
- **조건 확정 전 실행은 새 조건으로 다시 쟀다 — 버리지 않고 교체다.** 10^4의 동시성 8 · 32(세 변형)와 ClickHouse 동시성 1 반복 0(두 변형 — 인자는 같고 로그 비움 절차 전)을 FORCE로 다시 실행했고, 옛 실행 23회의 측정 줄 176은 원시에 남는다. collect는 반복마다 마지막 실행만 쓰므로(scripts/lab/s5/oltp/oltp.py summarize) 요약 · 블록의 값은 전부 확정 조건의 실행이다. 교체 전 값을 편차 판정에 섞지 않았다 — 판정 지표를 고른 것이 아니라 조건이 바뀐 실행을 뺀 것이다(10^5 · 10^6은 처음부터 확정 조건).
- **1차 폐기 사유와의 관계.** 기록 041의 폐기 뒤 절차는 "PostgreSQL 동시성 8 · 32 칸의 도구 쪽 여유"를 재측정 조건으로 정했다. 이번 실행은 도구 쪽 계기(이벤트 루프 사용률)를 더했고 그 계기가 PostgreSQL 동시성 8 · 32 전 창에서 0.992~1을 보였다(메인 스레드가 쉬지 않았다) — 편차는 기준 안에 들어왔지만 도구 여유는 확보되지 않았다. 그래서 이 칸의 처리량 · 클라이언트 지연은 §해석 한계 불릿대로 도구 상한에 가까운 값으로 읽는다.
- **4요소는 충족이다.** run.memoryLimitMb null에 memoryLimitSource를 함께 실었다(04 §조건 칸 도구 컨테이너 경로 불릿) — 대조 저장소 상한으로 채우지 않는다. 용량 티어는 "해당 없음" 문자열이다.
- 도구 CPU 포화 반복 없음(최대 0.647 < 0.9) · 최종 호출 실패 없음 · 불성립 구조 판정 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **W6에서 리드가 반영한다** — 05_data_stores/10 §원리 대응 점조회 행 · §미확인 · 미설계 등재에 이 기록을 인용하는 안: 조회당 읽는 행 = 그래뉼 하나(8192 변형 8,188~10,000행 · 256 변형 256~257.6행 · 행 비 32.0 = 그래뉼 비) · PostgreSQL 행 1 · 블록 3 → 4 · 동시성 1 지연 p50 PostgreSQL 0.101~0.103 ms 대 ClickHouse 3.973~4.268 ms(기록 046 · 5492c73 · 부하 실험 · 티어 해당 없음 · 스위치 기본값). 06_experiment_catalog EXP-41 "그래뉼 크기별 점조회 비용"의 확정 자리다.
- **인용 한정 두 가지.** ① PostgreSQL 동시성 8 · 32의 처리량 · 클라이언트 지연은 도구 상한에 가까울 수 있다(§해석 — 이벤트 루프 0.992~1) — 저장소 쪽 상한으로 인용하지 않는다. ② ClickHouse 수치는 trace 로그 부하를 포함한다 — 공정성 판정(리드 W6) 뒤 인용 문안을 정한다.
- 기록 041과 같이 index_granularity MODIFY 거부(code 472)는 05_data_stores/10 §미확인 · 미설계 등재 행을 닫는 근거로 쓸 수 있다(03_clickhouse_schema §업무 대조 테이블 동반).
- 미확인으로 남기는 것 — 10^6에서 256 변형의 서버 이점이 사라지는 원인(마크 수 · 인덱스 탐색 비용) · PostgreSQL 동시성 8 · 32 처리량의 저장소 쪽 상한(도구 메인 스레드에 가려졌다) · 1차 대비 PostgreSQL 처리량이 오른 원인 · trace 로그 부하의 크기.

## 기계 판독 블록

reverse 행은 collect 요약(OLTP_DIR snapshots/lab-s5-oltp-r2의 oltp-summary.json)의 EXP-41 207행 전부다 — 판정 지표 · 참고 지표를 함께 싣고 행의 spread 칸은 싣지 않는다(편차 표시는 §폐기 · 예외 표가 갖는다 · 판독 규칙 7). 재측정 관계는 conditions.remeasureOf에 적는다.

```json
{
  "schema": "measurement/v1",
  "record": "046",
  "exp": [
    "EXP-41"
  ],
  "status": "valid",
  "supersedes": null,
  "window": {
    "start": "2026-09-27T01:22:37.909Z",
    "end": "2026-09-27T02:20:04.407Z"
  },
  "run": {
    "commitHash": "5492c73",
    "memoryProfile": "load",
    "memoryLimitMb": null,
    "capacityTier": "해당 없음",
    "memoryLimitSource": "cgroup max — oltp-lab 서비스에 compose 상한 없음"
  },
  "switches": {
    "SW-01": "on",
    "SW-02": "on",
    "SW-03": "on",
    "SW-04": "on",
    "SW-05": "on",
    "SW-06": "on",
    "SW-07": 100,
    "SW-08": "on",
    "SW-09": "off",
    "SW-10": "off",
    "SW-11": "ingest"
  },
  "conditions": {
    "injectionMode": null,
    "observability": "off",
    "cpuset": "control-equalized",
    "controlMemoryMb": {
      "clickhouse": 3584,
      "postgres": 3584
    },
    "storeResources": "clickhouse=5-7/3758096384 postgres=8-10/3758096384",
    "toolContainer": "oltp-lab cpuset 11-12 · api-bypassed · api stopped",
    "seed": 42,
    "inProgress": 0.5,
    "generatorCpuMax": null,
    "compression": "off",
    "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts · same setting as record 041)",
    "swapUsed": null,
    "wslNetworking": null,
    "simFaultPlan": null,
    "stage": "S5",
    "scales": [
      10000,
      100000,
      1000000
    ],
    "snapshot": "s7a-seed-m",
    "oltpDir": "snapshots/lab-s5-oltp-r2",
    "fillSnapshots": "oltp-s{scale}-19f8861 adopted (path guard + executor verify match true · raw adopt 3 rows)",
    "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle)",
    "clickhouseVersion": "26.8.10.6",
    "clickhouseMaxThreads": 3,
    "clickhouseMaxConcurrentQueries": 32,
    "clickhouseServerLog": "image default trace (infra/clickhouse/config.d has no logger · text_log Debug) — trace log load included in every ClickHouse value",
    "chPreCall": "SYSTEM FLUSH LOGS + SYSTEM JEMALLOC PURGE before every ClickHouse exp41 call (lead queue script · not in runner raw) — caches untouched",
    "pgVersion": "18.6",
    "pgSessionSynchronousCommit": "off",
    "pgServerSynchronousCommit": "on",
    "pgSharedBuffers": "896MB",
    "pgServerMeanDecimals": 6,
    "runnerDirty": true,
    "raw": "docs/measurements/raw/046-oltp-control-point.jsonl",
    "runner": "scripts/lab/s5/oltp/oltp.sh",
    "judgedMetrics": [
      "blocks_per_query",
      "latency_p50",
      "latency_p95",
      "read_rows_per_query",
      "tool_cpu"
    ],
    "spreadExceededJudgedRows": 0,
    "excludedFromDeviation": "server_mean · server_p50 · qps · read_bytes_per_query · rows_per_query (reference)",
    "executorArgs": {
      "queries": {
        "c1": 2000,
        "c8": 10000,
        "c32": 10000
      },
      "warmup": 2000,
      "explainSample": 20,
      "concurrency": [
        1,
        8,
        32
      ],
      "inflight": "concurrency x 4",
      "connections": "pgMax = chMax = concurrency"
    },
    "conditionChange": "planned c8 · c32 queries 20000 · warmup 20000 -> ClickHouse c32 memory limit exceeded (MEMORY_LIMIT_EXCEEDED 기준 · stderr에 코드 번호 없음 · executor_failed 3) -> c8 · c32 queries 10000 · warmup 2000 (both stores) + pre-call flush · purge",
    "replacedRuns": {
      "keys": 17,
      "runs": 23,
      "measureLines": 176,
      "rule": "collect uses the last run per rep (FORCE rerun under final conditions)"
    },
    "executorFailedBeforeFix": 3,
    "granularityVariant": "lab_oltp_g256 run-scoped table (same DDL · index_granularity 256 · INSERT SELECT · dropped at end)",
    "modifyGranularityRefused": {
      "code": 472,
      "message": "Setting 'index_granularity' is readonly for storage 'MergeTree'."
    },
    "toolCpuSaturatedThreshold": 0.9,
    "toolCpuSaturatedReps": 0,
    "toolCpuMax": 0.647,
    "toolEventLoop": {
      "candidate": 0.9,
      "windows": 81,
      "aboveCandidate": 18,
      "aboveCandidateCells": "pg concurrency 8 · 32 (all scales · all reps)",
      "appliedToJudgement": false
    },
    "cache": "warm (warmup 2000 queries)",
    "remeasureOf": "041",
    "remeasureNote": "041 discarded (pg c8 · c32 latency spread) — remeasured on 5492c73 with c8 · c32 queries 10000 · event-loop utilization recorded; supersedes not used for discarded records"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.1469,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.981, 3.961, 3.998], "median": 3.981},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.028, 4.996, 5.077], "median": 5.028},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [249.8, 252.2, 248.6], "median": 249.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14267.32, 14244, 14226.84], "median": 14244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [258.024, 257.6, 257.288], "median": 257.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.251, 1.222, 1.25], "median": 1.25},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.244, 1.225, 1.251], "median": 1.244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.091, 0.09, 0.09], "median": 0.09},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [8.314, 8.676, 8.611], "median": 8.611},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [23.328, 23.036, 23.753], "median": 23.328},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [3193, 3126.2, 3084.9], "median": 3126.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14247.344, 14215.4, 14236.256], "median": 14236.256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.6608, 257.08, 257.4592], "median": 257.4592},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [5.515, 5.791, 5.878], "median": 5.791},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [4.803, 5.051, 5.033], "median": 5.033},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.311, 0.311, 0.306], "median": 0.311},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [2.579, 2.566, 2.571], "median": 2.571},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.348, 5.272, 5.218], "median": 5.272},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2784.5, 2804.6, 2798], "median": 2798},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14247.344, 14215.4, 14236.256], "median": 14236.256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.6608, 257.08, 257.4592], "median": 257.4592},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.357, 1.353, 1.37], "median": 1.357},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.15, 1.155, 1.178], "median": 1.155},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.271, 0.277, 0.272], "median": 0.272},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.993, 3.956, 3.973], "median": 3.973},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.078, 5.032, 5.072], "median": 5.072},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [246.3, 250.9, 250.1], "median": 250.1},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14224.64, 14191.2, 14174.48], "median": 14191.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.248, 256.64, 256.336], "median": 256.64},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.256, 1.237, 1.22], "median": 1.237},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.229, 1.238, 1.227], "median": 1.229},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.093, 0.09, 0.093], "median": 0.093},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [8.38, 8.63, 8.133], "median": 8.38},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [22.889, 23.537, 23.701], "median": 23.537},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [3208.8, 3116.9, 3225.1], "median": 3208.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14214.784, 14209.856, 14205.456], "median": 14209.856},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.0688, 256.9792, 256.8992], "median": 256.9792},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [5.849, 5.855, 5.643], "median": 5.849},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [5.077, 5.027, 4.946], "median": 5.027},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.321, 0.307, 0.327], "median": 0.321},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [2.623, 2.624, 2.54], "median": 2.623},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.547, 5.561, 5.342], "median": 5.547},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2701.4, 2709.5, 2791.3], "median": 2709.5},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14214.784, 14209.856, 14205.456], "median": 14209.856},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.0688, 256.9792, 256.8992], "median": 256.9792},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.414, 1.386, 1.372], "median": 1.386},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.18, 1.176, 1.163], "median": 1.176},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.268, 0.27, 0.279], "median": 0.27},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.171, 4.16, 4.083], "median": 4.16},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.281, 5.32, 5.237], "median": 5.281},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [230.8, 231, 237.6], "median": 231},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9457.344, 9697.681, 9615.813], "median": 9615.813},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256, 256, 255.904], "median": 256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.689, 1.663, 1.592], "median": 1.663},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.698, 1.673, 1.61], "median": 1.673},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.068, 0.067, 0.068], "median": 0.068},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [15.728, 15.56, 15.324], "median": 15.56},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [32.056, 31.76, 31.107], "median": 31.76},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1881.2, 1913.3, 1939.1], "median": 1913.3},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9577.4486, 9614.1787, 9568.1216], "median": 9577.4486},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256.8512, 256.9024, 256.5952], "median": 256.8512},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [12.6, 12.647, 12.352], "median": 12.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [11.673, 11.729, 11.625], "median": 11.673},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.208, 0.21, 0.213], "median": 0.21},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.042, 3.838, 4.052], "median": 4.042},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [7.352, 6.96, 7.173], "median": 7.173},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1845.1, 1930, 1851.8], "median": 1851.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9577.4486, 9614.1787, 9568.1216], "median": 9577.4486},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256.8512, 256.9024, 256.5952], "median": 256.8512},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.619, 2.518, 2.597], "median": 2.597},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.362, 2.281, 2.364], "median": 2.362},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.202, 0.213, 0.198], "median": 0.202},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.176, 4.117, 4.211], "median": 4.176},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.372, 5.26, 5.33], "median": 5.33},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [228.4, 232.9, 228.2], "median": 228.4},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.721, 1.685, 1.722], "median": 1.721},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.696, 1.672, 1.716], "median": 1.696},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.072, 0.07, 0.07], "median": 0.07},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [14.997, 15.904, 15.301], "median": 15.301},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [30.456, 32.301, 31.07], "median": 31.07},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1971.3, 1868.4, 1940], "median": 1940},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [12.109, 12.81, 12.4], "median": 12.4},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [11.35, 11.936, 11.56], "median": 11.56},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.21, 0.196, 0.205], "median": 0.205},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.098, 4.09, 4.11], "median": 4.098},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [6.908, 6.741, 6.953], "median": 6.908},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1858.5, 1875.3, 1859.3], "median": 1859.3},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.611, 2.564, 2.591], "median": 2.591},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.453, 2.401, 2.429], "median": 2.429},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.192, 0.194, 0.192], "median": 0.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.134, 4.167, 4.223], "median": 4.167},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.277, 5.288, 5.303], "median": 5.288},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [233.2, 231.8, 227.8], "median": 231.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476687.2, 476203.84, 476542.192], "median": 476542.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8361.6, 8353.12, 8359.056], "median": 8359.056},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.669, 1.69, 1.7], "median": 1.69},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.667, 1.683, 1.7], "median": 1.683},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.074, 0.073, 0.069], "median": 0.073},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [14.599, 15.116, 14.73], "median": 14.73},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [29.642, 30.626, 29.253], "median": 29.642},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2038, 1954.4, 2027.1], "median": 2027.1},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476450.2624, 476509.9072, 476377.8496], "median": 476450.2624},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8357.4432, 8358.4896, 8356.1728], "median": 8357.4432},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [11.667, 12.069, 11.751], "median": 11.751},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [10.936, 11.272, 10.902], "median": 10.936},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.218, 0.204, 0.212], "median": 0.212},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.853, 3.935, 3.917], "median": 3.917},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [6.539, 6.598, 6.669], "median": 6.598},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1976, 1942.6, 1950.2], "median": 1950.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476450.2624, 476509.9072, 476377.8496], "median": 476450.2624},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8357.4432, 8358.4896, 8356.1728], "median": 8357.4432},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.421, 2.466, 2.45], "median": 2.45},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.256, 2.31, 2.291], "median": 2.291},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.207, 0.199, 0.2], "median": 0.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.294, 4.268, 4.185], "median": 4.268},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.407, 5.345, 5.287], "median": 5.345},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [226.3, 227.6, 231.4], "median": 227.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [315031.303, 312160.1845, 315026.2965], "median": 315026.2965},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8188.192, 8188.192, 8184.384], "median": 8188.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.779, 1.735, 1.698], "median": 1.735},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.763, 1.734, 1.69], "median": 1.734},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.068, 0.069, 0.07], "median": 0.069},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [16.47, 16.287, 16.176], "median": 16.287},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [32.236, 32.394, 31.713], "median": 32.236},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1833.4, 1844.3, 1858.9], "median": 1844.3},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [314303.4543, 312658.7192, 312537.9781], "median": 312658.7192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8185.9072, 8186.6688, 8189.7152], "median": 8186.6688},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [13.517, 13.355, 13.322], "median": 13.355},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [12.764, 12.497, 12.54], "median": 12.54},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.197, 0.197, 0.2], "median": 0.197},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.197, 4.072, 4.166], "median": 4.166},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [7.138, 6.903, 7.054], "median": 7.054},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1811.5, 1872, 1828.9], "median": 1828.9},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [314310.0079, 312671.8264, 312551.0853], "median": 312671.8264},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8186.7264, 8188.3072, 8191.3536], "median": 8188.3072},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.698, 2.642, 2.683], "median": 2.683},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.51, 2.457, 2.498], "median": 2.498},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.193, 0.193, 0.192], "median": 0.193},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.101, 0.104, 0.1], "median": 0.101},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.134, 0.138, 0.13], "median": 0.134},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [9275.1, 9017.4, 9381.5], "median": 9275.1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.004087, 0.004336, 0.004126], "median": 0.004126},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.352, 0.345, 0.348], "median": 0.348},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.634, 0.616, 0.612], "median": 0.616},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [1.66, 1.812, 1.662], "median": 1.662},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [37911.9, 38275.9, 39164.5], "median": 38275.9},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.004777, 0.004774, 0.004724], "median": 0.004774},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.631, 0.633, 0.626], "median": 0.631},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.162, 0.182, 0.179], "median": 0.179},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.379, 0.421, 0.423], "median": 0.421},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [41211.4, 38944.2, 38194.4], "median": 38944.2},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.004841, 0.004556, 0.00512], "median": 0.004841},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.631, 0.636, 0.623], "median": 0.631},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.103, 0.104, 0.101], "median": 0.103},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.136, 0.135, 0.133], "median": 0.135},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [9028.3, 9011.3, 9253.5], "median": 9028.3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.005191, 0.005403, 0.004895], "median": 0.005191},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.358, 0.345, 0.339], "median": 0.345},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.564, 0.583, 0.575], "median": 0.575},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [1.682, 1.862, 1.849], "median": 1.849},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [40115.1, 39587.3, 39233.2], "median": 39587.3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.005999, 0.006271, 0.006235], "median": 0.006235},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.641, 0.628, 0.647], "median": 0.641},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.167, 0.159, 0.174], "median": 0.167},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.381, 0.392, 0.428], "median": 0.392},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [41127.3, 39925.1, 38664], "median": 39925.1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.005442, 0.00591, 0.005518], "median": 0.005518},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.643, 0.626, 0.642], "median": 0.642},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.104, 0.101, 0.102], "median": 0.102},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.143, 0.13, 0.151], "median": 0.143},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [8960.9, 9226.9, 8801.7], "median": 8960.9},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.006128, 0.006026, 0.006381], "median": 0.006128},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.346, 0.341, 0.33], "median": 0.341},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.57, 0.558, 0.597], "median": 0.57},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [1.906, 1.753, 1.854], "median": 1.854},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [39124.2, 39965.2, 38513.7], "median": 39124.2},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.009094, 0.009061, 0.009466], "median": 0.009094},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.63, 0.641, 0.642], "median": 0.641},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.161, 0.161, 0.16], "median": 0.161},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.43, 0.408, 0.396], "median": 0.408},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [38658.9, 40539.4, 41170.6], "median": 40539.4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.008664, 0.008291, 0.008935], "median": 0.008664},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.64, 0.635, 0.63], "median": 0.635}
  ]
}
```
