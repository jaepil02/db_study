# 041 — 역방향 대조 PK 점조회: PostgreSQL B-tree 대 ClickHouse 희소 인덱스(그래뉼 8192 · 256) · 동시성 1 · 8 · 32 · 업무 규모 10^4 · 10^5 · 10^6 (S5)

> 실험: EXP-41 · 상태: 폐기(편차 기준 초과 — §폐기 · 예외) · 정정 대상: 없음 · 판정 창: 2026-09-26T20:15:56.162Z ~ 2026-09-26T23:06:36.357Z(첫 측정 줄 ~ 마지막 측정 줄) · 실행 2026-09-27 05:14:59 ~ 08:06:36 KST(init ~ 마지막 측정 · EXP-40 · 42~44와 같은 러너 실행 안에서 교대)

work_order를 order_id 하나로 읽는 점조회(업무 워크로드의 가장 흔한 읽기)를 PostgreSQL PK btree 인덱스 스캔과 ClickHouse 기본 키 희소 인덱스로 같은 대상 분포에 걸고, 조회 지연 · 조회당 읽은 양 · 처리량을 동시성 1 · 8 · 32 × 업무 규모 3단계에서 잰 기록이다. ClickHouse는 index_granularity 8192(plc.work_order_control)와 256(실행 범위 변형 테이블 lab_oltp_g256.work_order_control — 05_data_stores/10 §그래뉼 변형 판정 ②) 두 변형이다.

질문은 05_data_stores/10 §원리 대응 점조회 행 — "조회당 읽는 행 수가 그래뉼 크기에 묶이는가"다. 수치는 전부 원시(docs/measurements/raw/041-oltp-control-point.jsonl)에 있는 값만 쓴다.

## 조건

| 항목 | 값 |
|------|------|
| 커밋 | 19f8861(러너 state git.commitHash · init git.dirty true — 작업 트리에 미커밋 변경이 있다 · 실행기 이미지는 같은 커밋) |
| 저장소 자원 | 대조 자원 조건 — ClickHouse cpuset 5-7 · 3,758,096,384 B(3.5 GiB) · PostgreSQL cpuset 8-10 · 3,758,096,384 B — 러너 init이 확인(resourcesBad 없음) |
| 측정 경로 | oltp-lab 도구 컨테이너(CPU 집합 11-12 · CPU 2)의 Node 실행기 → pg · @clickhouse/client 직접 · api 비경유 · api 정지 |
| 프로파일 · 상한 | 부하 실험(run.memoryProfile load) · run.memoryLimitMb null + **run.memoryLimitSource "cgroup max — oltp-lab 서비스에 compose 상한 없음"** — 도구 컨테이너 경로의 null은 상한이 없다는 사실값이라 4요소 충족이다(04 §조건 칸 도구 컨테이너 경로 불릿 · 2026-09-27) · 대조 메모리 3,584 MB는 저장소 컨테이너 상한이라 조건 칸 controlMemoryMb(3,584 · 3,584)에 적는다 |
| 용량 티어 | **해당 없음** — 업무 규모 단계가 축이다(05_data_stores/10 §역방향 측정 조건) |
| 스위치 | 전부 기본값 · SW-09=off(전수는 기계 판독 블록) |
| 주입 모드 · 시드 · 상태 분포 | 없음(배경 부하 없음) · 42 · IN_PROGRESS 비율 0.5 |
| 시작 상태 · 초기화 | 규모마다 빈 기준(s7a-seed-m) 복원 → fill(두 저장소 집합 md5 일치) → settle → 채움 스냅샷 oltp-s{규모}-19f8861 · 앞 실행이 ClickHouse 대조 테이블 상태를 바꿨으면 reset clickhouse 뒤에만 부른다(러너 CH_NEEDS_CLEAN) · 점조회는 상태를 바꾸지 않는다 |
| 그래뉼 변형 | 256 변형은 실행 안에서 lab_oltp_g256에 같은 DDL(granularity만 256 · DDL sha256 6f147dcc…)을 만들고 INSERT SELECT로 같은 행을 채운 뒤 수렴 · 실행 끝에 삭제 · 스냅샷 전 부재 확인(guard_clean_schema) · **MODIFY SETTING index_granularity는 거부된다(code 472 "Setting 'index_granularity' is readonly for storage 'MergeTree'" — 26.8 판별)** |
| 엔진 설정 | ClickHouse 26.8.10.6 · max_threads 3 · use_query_condition_cache 1 · use_uncompressed_cache 0(서버 기본) · PostgreSQL 18.6 · shared_buffers 896MB · 실험 세션 synchronous_commit off |
| 실행기 인자(2계층) | 측정 조회 2,000건 · 예열 2,000건(웜 — 역방향 측정 조건 캐시 행) · 동시 요청 상한 동시성 × 4(inflight 4 · 32 · 128) · EXPLAIN (ANALYZE, BUFFERS) 표본 20건(측정 창 밖) |
| 계기 | 클라이언트 지연 p50 · p95(조회 2,000건의 정확 분위수 · 선형 보간) · 서버 시간 — ClickHouse query_log(log_comment) · PostgreSQL pg_stat_statements 평균(1 µs 해상도) · 조회당 읽은 양 — ClickHouse query_log read_rows · read_bytes 평균 · PostgreSQL EXPLAIN 표본의 shared hit + read 블록 · 도구 CPU = 실행기 프로세스 CPU ÷ 벽시계 ÷ CPU 2 |
| 도구 CPU 포화 | 문턱 0.9(공정성 규칙 10 · 러너 TOOL_CPU_SATURATED) — 포화 반복 **0** · 최대 0.839(PostgreSQL 동시성 32) |
| 관측 스택 · CPU 배치 | off · 대조 동일화 |
| 압축 · swap · 네트워킹 · SIM 계획 | **off** — oltp-lab ClickHouse 클라이언트 요청 · 응답 압축 false(apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861) · 테이블 코덱은 DDL 기본 · 재지 않음 · 해당 없음(macOS Docker Desktop) · 없음 |
| 반복 · 편차 | 3회(반복 0 · 1 · 2) · 판정 지표 최대 편차 **51.0%**(PostgreSQL 10^4 동시성 8 latency_p95) · 기준 20% 초과 판정 지표 5행 |
| 스크립트 · 원시 | scripts/lab/s5/oltp/oltp.sh · 원시 docs/measurements/raw/041-oltp-control-point.jsonl(932행 · 앞 230행은 EXP-40~44 공통 행 · 측정 621 · detail 81) · EXP-41 81회 호출 전부 종료 코드 0(역방향 격자 전체 297회) |

## 결과

값은 **중앙값**(반복 0 · 1 · 2)이다. 단위 ms.

### 클라이언트 지연 p50

| 변형 | 동시성 | 10^4 | 10^5 | 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.1**(0.104 · 0.099 · 0.1) | **0.103**(0.104 · 0.1 · 0.103) | **0.103**(0.104 · 0.103 · 0.101) |
| ClickHouse 그래뉼 8192 | 1 | **4.178**(4.215 · 4.178 · 4.161) | **4.078**(4.204 · 4.076 · 4.078) | **4.223**(4.223 · 4.187 · 4.225) |
| ClickHouse 그래뉼 256 | 1 | **3.983**(3.992 · 3.945 · 3.983) | **3.985**(3.985 · 3.995 · 3.985) | **4.115**(4.184 · 4.096 · 4.115) |
| PostgreSQL PK btree | 8 | **0.254**(0.254 · 0.246 · 0.287) | **0.263**(0.245 · 0.263 · 0.276) | **0.262**(0.262 · 0.247 · 0.266) |
| ClickHouse 그래뉼 8192 | 8 | **4.176**(4.176 · 4.192 · 4.153) | **3.936**(3.936 · 4.039 · 3.897) | **4.427**(4.097 · 4.427 · 4.559) |
| ClickHouse 그래뉼 256 | 8 | **2.563**(2.525 · 2.666 · 2.563) | **2.561**(2.536 · 2.586 · 2.561) | **4.026**(3.873 · 4.026 · 4.079) |
| PostgreSQL PK btree | 32 | **1.132**(1.132 · 1.026 · 1.14) | **1.04**(1.036 · 1.04 · 1.264) | **1.092**(1.092 · 0.996 · 1.11) |
| ClickHouse 그래뉼 8192 | 32 | **15.289**(15.238 · 15.666 · 15.289) | **15.044**(14.598 · 15.044 · 15.242) | **16.848**(15.866 · 16.848 · 17.4) |
| ClickHouse 그래뉼 256 | 32 | **8.625**(8.828 · 8.625 · 8.479) | **8.701**(8.285 · 8.786 · 8.701) | **15.926**(15.219 · 16.064 · 15.926) |

### 클라이언트 지연 p95

| 변형 | 동시성 | 10^4 | 10^5 | 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.132**(0.154 · 0.129 · 0.132) | **0.138**(0.138 · 0.132 · 0.14) | **0.132**(0.139 · 0.132 · 0.132) |
| ClickHouse 그래뉼 8192 | 1 | **5.324**(5.398 · 5.324 · 5.299) | **5.198**(5.358 · 5.198 · 5.191) | **5.373**(5.379 · 5.287 · 5.373) |
| ClickHouse 그래뉼 256 | 1 | **5.09**(5.216 · 5.029 · 5.09) | **5.084**(5.084 · 5.101 · 5.05) | **5.277**(5.309 · 5.277 · 5.274) |
| PostgreSQL PK btree | 8 | **1.082**(1.33 · 0.778 · 1.082) | **0.81**(0.81 · 0.93 · 0.792) | **0.977**(0.977 · 1.013 · 0.902) |
| ClickHouse 그래뉼 8192 | 8 | **6.993**(7.007 · 6.993 · 6.744) | **6.798**(6.697 · 6.838 · 6.798) | **7.514**(7.115 · 7.514 · 7.733) |
| ClickHouse 그래뉼 256 | 8 | **5.016**(5.016 · 4.981 · 5.08) | **5.016**(5.197 · 5.016 · 4.99) | **6.767**(6.604 · 7.132 · 6.767) |
| PostgreSQL PK btree | 32 | **3.342**(3.342 · 3.131 · 3.888) | **3.102**(2.934 · 3.97 · 3.102) | **3.693**(4.453 · 3.693 · 2.879) |
| ClickHouse 그래뉼 8192 | 32 | **31.096**(31.096 · 31.477 · 29.488) | **28.966**(28.966 · 28.549 · 29.111) | **32.049**(32.049 · 31.004 · 33.944) |
| ClickHouse 그래뉼 256 | 32 | **21.443**(20.567 · 21.443 · 22.416) | **21.007**(21.007 · 20.636 · 21.549) | **30.856**(28.781 · 31.02 · 30.856) |

- 검산: 칸 = 변형 3 × 동시성 3 × 규모 3 = **27**(표마다)

### 서버 시간 · 처리량 · 도구 CPU(참고)

중앙값만 적는다(반복별 값은 기계 판독 블록). 서버 시간은 ClickHouse query_log 평균 · PostgreSQL pg_stat_statements 평균이다.

| 변형 | 동시성 | 서버 평균 10^4 · 10^5 · 10^6 | 처리량 req/s 10^4 · 10^5 · 10^6 | 도구 CPU 10^4 · 10^5 · 10^6 |
|------|:--:|------|------|------|
| PostgreSQL PK btree | 1 | **0.004** · **0.005** · **0.006** | **9,244** · **9,052** · **9,126** | **0.341** · **0.343** · **0.337** |
| ClickHouse 그래뉼 8192 | 1 | **1.708** · **1.644** · **1.721** | **230** · **238** · **230** | **0.07** · **0.071** · **0.068** |
| ClickHouse 그래뉼 256 | 1 | **1.234** · **1.254** · **1.664** | **250** · **248** · **234** | **0.092** · **0.092** · **0.068** |
| PostgreSQL PK btree | 8 | **0.007** · **0.007** · **0.01** | **20,481** · **23,328** · **22,530** | **0.761** · **0.767** · **0.78** |
| ClickHouse 그래뉼 8192 | 8 | **2.602** · **2.484** · **2.785** | **1,839** · **1,935** · **1,736** | **0.253** · **0.264** · **0.242** |
| ClickHouse 그래뉼 256 | 8 | **1.31** · **1.298** · **2.519** | **2,803** · **2,854** · **1,886** | **0.375** · **0.372** · **0.262** |
| PostgreSQL PK btree | 32 | **0.006** · **0.008** · **0.01** | **21,398** · **21,030** · **22,500** | **0.815** · **0.791** · **0.81** |
| ClickHouse 그래뉼 8192 | 32 | **12.449** · **11.903** · **13.743** | **1,929** · **1,991** · **1,805** | **0.285** · **0.284** · **0.261** |
| ClickHouse 그래뉼 256 | 32 | **5.919** · **5.735** · **13.112** | **3,224** · **3,206** · **1,887** | **0.446** · **0.44** · **0.292** |

### 조회당 읽은 양

동시성 1 · 8 · 32에서 같은 값이라(같은 대상 분포) 동시성 1 행만 적는다. EXPLAIN은 반복 0 표본의 계획이다.

| 변형 | 계기 | 10^4 | 10^5 | 10^6 |
|------|------|------|------|------|
| PostgreSQL PK btree | 조회당 행 | **1**(1 · 1 · 1) | **1**(1 · 1 · 1) | **1**(1 · 1 · 1) |
| PostgreSQL PK btree | 읽은 블록(shared hit + read) | **3**(3 · 3 · 3) | **3**(3 · 3 · 3) | **4**(4 · 4 · 4) |
| ClickHouse 그래뉼 8192 | read_rows | **10,000**(10,000 · 10,000 · 10,000) | **8,359.06**(8,361.6 · 8,353.12 · 8,359.06) | **8,188.19**(8,188.19 · 8,188.19 · 8,184.38) |
| ClickHouse 그래뉼 8192 | read_bytes(B) | **570,076**(570,076 · 570,076 · 570,076) | **476,542**(476,687 · 476,204 · 476,542) | **315,026**(315,031 · 312,160 · 315,026) |
| ClickHouse 그래뉼 256 | read_rows | **257.6**(258.02 · 257.6 · 257.29) | **256.64**(257.25 · 256.64 · 256.34) | **256**(256 · 256 · 255.9) |
| ClickHouse 그래뉼 256 | read_bytes(B) | **14,244**(14,267 · 14,244 · 14,227) | **14,191**(14,225 · 14,191 · 14,174) | **9,616**(9,457 · 9,698 · 9,616) |

- **ClickHouse read_rows는 그래뉼 하나다.** EXPLAIN의 Granules가 모든 규모에서 1/N이다 — 8192 변형 1/1 · 1/12 · 1/123 · 256 변형 1/39 · 1/391 · 1/3907. 10^4 8192 변형은 테이블 전체(10,000행)가 그래뉼 1개라 한 번의 점조회가 테이블 전체를 읽는다. 10^5 평균 8,359행이 8,192보다 큰 것은 끝 그래뉼이 나머지 행을 담아 크기 때문이다(12 × 8,192 < 100,000).
- **PostgreSQL은 행 1개 · 블록 3 → 4다.** 10^6에서 블록이 하나 늘어난 것은 btree 높이가 한 단 늘어난 것과 맞는 방향이다(계획 노드 Index Scan · 블록 = 인덱스 페이지 + 힙 페이지 · 높이는 재지 않았다).

## 해석

- **판정 — 조회당 읽는 행 수는 그래뉼 크기에 묶인다.** ClickHouse는 행 하나를 찾으려고 그래뉼 하나를 통째로 읽는다 — 8192 변형 8,188~10,000행(315,026~570,076 B) · 256 변형 256~257.6행(9,616~14,244 B)이고, 두 변형의 행 비는 10^6에서 8,188.19 ÷ 256 = 32.0으로 그래뉼 비(8192 ÷ 256)와 같다. PostgreSQL btree는 행 1개를 블록 3~4개로 찾는다. 이것은 05_data_stores/10 §원리 대응의 구조 사실(B-tree는 루트에서 리프까지 몇 페이지로 행 하나를 가리키고, 희소 기본 인덱스는 그래뉼 하나를 가리키고 그 그래뉼 전체를 읽는다)이 수치로 관측된 것이다.
- **그러나 지연은 읽은 행 수가 아니라 조회 한 건의 고정 비용이 정한다.** 동시성 1에서 ClickHouse 8192 변형 p50 4.078~4.223 ms · 256 변형 3.983~4.115 ms로 읽은 행이 32배 적어도 지연 차는 0.1~0.2 ms다. 서버 시간 차(10^4 · 10^5 8192 1.644~1.708 ms 대 256 1.234~1.254 ms)가 그 전부이고, 클라이언트 지연의 나머지 약 2.5~2.8 ms는 HTTP 왕복 · 쿼리 해석 · 결과 직렬화다. PostgreSQL은 p50 0.100~0.103 ms · 서버 0.004~0.006 ms로 ClickHouse의 약 40분의 1이다(동시성 1 · 참고 수치 — 리드 확인과 같다).
- **10^6에서는 256 변형의 서버 이점이 사라진다.** 256 변형의 동시성 1 서버 평균이 1.234(10^4) → 1.254(10^5) → 1.664 ms(10^6)로 8192 변형(1.721 ms)에 붙는다. 동시성 8 · 32 처리량도 10^4 · 10^5에서는 256 변형이 1.5~1.7배(2,803 대 1,839 · 3,224 대 1,929 req/s 등)였다가 10^6에서 1,886 · 1,887 대 1,736 · 1,805로 좁혀진다. 기본 키 인덱스의 마크 수가 3,907개로 늘어난 것과 같은 방향이지만 서버 쪽 내역(인덱스 탐색 · 마크 캐시)은 재지 않았다 — 원인은 미분리다.
- **동시성 — ClickHouse는 동시성 8에서 처리량이 멈춘다.** 8192 변형 처리량은 동시성 1 230~238 req/s → 8 1,736~1,935 → 32 1,805~1,991 req/s이고, 동시성 32의 서버 평균이 11.903~13.743 ms로 동시성 1의 7~8배다 — 요청이 서버(CPU 집합 5-7 · 3개)에서 줄을 선다. 도구 CPU는 0.24~0.45로 포화가 아니다. PostgreSQL은 동시성 8 · 32에서 20,481~23,328 req/s · 서버 평균 0.006~0.010 ms 그대로이고 클라이언트 p50만 0.254~0.263 → 1.04~1.132 ms로 는다 — 도구 CPU가 0.76~0.84라 이 처리량은 **도구 쪽 상한에 가까운 하한값**이다(포화 문턱 0.9 미만이라 버리지 않는다).
- **업무 데이터에 PostgreSQL이 맞는 이유의 한 축이 여기서 나온다.** 업무 화면의 읽기는 주문 한 건 · 설비 한 대처럼 키 하나로 행 몇 개를 읽는 모양이다. PostgreSQL은 그 모양에서 읽는 양이 행 · 페이지 단위라 규모가 100배 커져도 블록이 3 → 4로만 늘고 지연 p50이 0.1 ms에 머문다. ClickHouse는 같은 조회에 그래뉼 하나(기본 8,192행)를 읽고 조회당 고정 비용이 약 4 ms라, 그래뉼을 256으로 줄여도 읽는 양만 줄 뿐 지연은 거의 그대로다 — 희소 인덱스는 범위 · 집계 조회의 읽기 단위를 줄이는 구조이지 점조회의 단위를 행으로 만드는 구조가 아니다.
- **한계 — 클라이언트 지연은 HTTP(8123)와 와이어 프로토콜의 왕복 차를 포함한다.** 서버 시간을 함께 적는 이유다(공정성 규칙 4). PostgreSQL 서버 평균은 pg_stat_statements 평균을 ms 소수 셋째 자리로 반올림한 값이라 1 µs 해상도다 — 0.004 · 0.005 한 칸 차가 편차 25%가 된다(§폐기 · 예외 참고 행).
- **한계 — 조회 2,000건의 정확 분위수다(버킷 보간이 아니다).** 04 §반복과 폐기의 "p95 이상은 참고" 조항은 히스토그램 계열에 걸리는 조항이라 여기서는 p95도 판정 지표다(06_experiment_catalog EXP-41 판정 지표 열 p50 · p95). P · E 코어 배치 행(07_measurement_limits)에 따라 단일 실행을 인용하지 않는다.

## 폐기 · 예외

- **편차 기준 초과 — 판정 지표 5행이 20%를 넘어 04 §반복과 폐기에 따라 세 반복 전부를 폐기한다(status discarded).** 판정 지표는 06_experiment_catalog EXP-41 판정 지표 열 — p50 · p95 · 조회당 read_rows 대 읽은 블록 · 도구 CPU다. 참고 지표(server_mean · server_p50 · qps · read_bytes · rows_per_query)는 편차 판정에 쓰지 않는다. 편차는 (최대 − 최소) ÷ 중앙값이다.

| 변형 | 규모 · 동시성 | 지표 · 판독 | 3회 | 편차 |
|------|------|------|------|------|
| pg | 10,000 · 동시성 32 | latency_p95 · — | 3.342 · 3.131 · 3.888 | 22.7% |
| pg | 10,000 · 동시성 8 | latency_p95 · — | 1.33 · 0.778 · 1.082 | 51.0% |
| pg | 100,000 · 동시성 32 | latency_p50 · — | 1.036 · 1.04 · 1.264 | 21.9% |
| pg | 100,000 · 동시성 32 | latency_p95 · — | 2.934 · 3.97 · 3.102 | 33.4% |
| pg | 1,000,000 · 동시성 32 | latency_p95 · — | 4.453 · 3.693 · 2.879 | 42.6% |

- 검산: 판정 지표 초과 = latency_p95 4 + latency_p50 1 = **5** · 참고 지표 초과 2(PostgreSQL server_mean 10^4 동시성 1 0.005 · 0.004 · 0.004 = 25.0% · 10^5 동시성 8 0.006 · 0.007 · 0.009 = 42.9%)는 1 µs 해상도의 칸 차이며 판정에 쓰지 않는다
- **초과는 전부 PostgreSQL 동시성 8 · 32다.** 서브 ms~4 ms 값의 흔들림이며 이 칸의 도구 CPU가 0.76~0.84다 — 실행기(Node 이벤트 루프)가 요청을 내는 속도가 반복마다 달라 클라이언트 꼬리가 흔들린 것으로 읽힌다. 서버 평균(0.006~0.010 ms)은 같은 칸에서 흔들리지 않았다. ClickHouse 54칸(2 변형 × 3 동시성 × 3 규모 × p50 · p95)은 전부 기준 안이다(최대 10.4%).
- 이 실험의 판정 지표에는 머지 시점 순간값이 없다 — 06_experiment_catalog §EXP-29~39 끝 "같은 불릿의 역방향 · 격자 적용" 불릿(목적 적합성 W5 리드 판정 · 2026-09-27)는 역방향 적용 대상을 EXP-40 · 43 · 44로 정하고 EXP-41 지표를 들지 않으므로 뺄 행이 없어 초과 5행이 그대로 남는다.
- **폐기 뒤 절차 — 원인을 잡아 재측정한다(리드 판정).** 재측정 조건은 PostgreSQL 동시성 8 · 32 칸의 도구 쪽 여유(도구 CPU 0.76~0.84 — 실행기 CPU 또는 커넥션 수)다. 새 기록 번호로 쓰고 이 기록은 discarded로 남긴다.
- **구조 사실 — 인용 가능 · 분포 수치 — 폐기.** 04 §구조 판정과 분포 판정 표가 구조 판정에는 편차 폐기를 적용하지 않으므로 3회 전부 같은 구조 결과는 인용할 수 있다 — PostgreSQL 조회당 행 1 · 블록 3 · 3 · 4 · 계획 Index Scan · ClickHouse 조회당 그래뉼 1개(EXPLAIN Granules 1/1 · 1/12 · 1/123 · 1/39 · 1/391 · 1/3907) · index_granularity MODIFY SETTING 거부(code 472). 지연 · 처리량 · 서버 시간 같은 분포 수치는 폐기이며 인용하지 않는다.
- **4요소는 충족이다.** run.memoryLimitMb null에 memoryLimitSource를 함께 실었다(04 §조건 칸 도구 컨테이너 경로 불릿) — 대조 저장소 상한으로 채우지 않는다. 용량 티어는 "해당 없음" 문자열이다.
- 도구 CPU 포화 반복 없음(최대 0.839 < 0.9) · 호출 실패 없음 · 불성립 구조 판정 없음.

## 정본 반영

반영 시점에 적어 둔 계획이다 — 반영은 리드가 문서 커밋에서 한다.

- **분포 수치는 정본에 올리지 않는다(status discarded).** 재측정 기록이 대신한다.
- **W6에서 리드가 반영한다** — 05_data_stores/10 §미확인 · 미설계 등재의 "index_granularity 생성 뒤 변경 불가 — 실행기 첫 실행이 판별" 행을 code 472로 닫는 안(03_clickhouse_schema §업무 대조 테이블 동반). 조회당 읽는 행 = 그래뉼 하나는 위 구조 사실로 인용할 수 있다.
- 미확인으로 남기는 것 — 10^6에서 256 변형의 서버 이점이 사라지는 원인(마크 수 · 인덱스 탐색 비용) · PostgreSQL 동시성 32 처리량의 저장소 쪽 상한(도구 상한에 가려졌다).

## 기계 판독 블록

reverse 행은 collect 요약(oltp-summary.json)의 EXP-41 207행 전부다 — 판정 지표 · 참고 지표를 함께 싣고 편차 초과 표시는 §폐기 · 예외 표가 갖는다(판독 규칙 7).

```json
{
  "schema": "measurement/v1",
  "record": "041",
  "exp": [
    "EXP-41"
  ],
  "status": "discarded",
  "supersedes": null,
  "window": {
    "start": "2026-09-26T20:15:56.162Z",
    "end": "2026-09-26T23:06:36.357Z"
  },
  "run": {
    "commitHash": "19f8861",
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
    "compressionSource": "oltp-lab ClickHouse client request · response compression false (apps/api/src/modules/datagen/oltp-lab/oltp-stores.ts:38 · 19f8861)",
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
    "fillSnapshots": "oltp-s{scale}-19f8861",
    "resetBetweenVariants": "pg run -> reset all (fill snapshot restore + VACUUM ANALYZE) · ch state-changing run -> reset clickhouse (refill + settle)",
    "clickhouseVersion": "26.8.10.6",
    "clickhouseMaxThreads": 3,
    "pgVersion": "18.6",
    "pgSessionSynchronousCommit": "off",
    "pgServerSynchronousCommit": "on",
    "pgSharedBuffers": "896MB",
    "runnerDirty": true,
    "raw": "docs/measurements/raw/041-oltp-control-point.jsonl",
    "runner": "scripts/lab/s5/oltp/oltp.sh",
    "judgedMetrics": [
      "blocks_per_query",
      "latency_p50",
      "latency_p95",
      "read_rows_per_query",
      "tool_cpu"
    ],
    "spreadExceededJudgedRows": 5,
    "excludedFromDeviation": "server_mean · server_p50 · qps · read_bytes_per_query · rows_per_query (reference)",
    "executorArgs": {
      "queries": 2000,
      "warmup": 2000,
      "explainSample": 20,
      "concurrency": [
        1,
        8,
        32
      ]
    },
    "granularityVariant": "lab_oltp_g256 run-scoped table (same DDL · index_granularity 256 · INSERT SELECT · dropped at end)",
    "modifyGranularityRefused": {
      "code": 472,
      "message": "Setting 'index_granularity' is readonly for storage 'MergeTree'."
    },
    "toolCpuSaturatedThreshold": 0.9,
    "toolCpuSaturatedReps": 0,
    "cache": "warm (warmup 2000 queries)"
  },
  "repeat": {
    "runs": 3,
    "deviation": 0.5102,
    "threshold": 0.2
  },
  "results": [],
  "reverse": [
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.992, 3.945, 3.983], "median": 3.983},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.216, 5.029, 5.09], "median": 5.09},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [247.1, 254.7, 250.4], "median": 250.4},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14267.32, 14244, 14226.84], "median": 14244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [258.024, 257.6, 257.288], "median": 257.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.257, 1.208, 1.234], "median": 1.234},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.234, 1.228, 1.24], "median": 1.234},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.096, 0.092, 0.089], "median": 0.092},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [8.828, 8.625, 8.479], "median": 8.625},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [20.567, 21.443, 22.416], "median": 21.443},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [3165, 3223.5, 3226.1], "median": 3223.5},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14267.32, 14244, 14226.84], "median": 14244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [258.024, 257.6, 257.288], "median": 257.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [6.086, 5.919, 5.529], "median": 5.919},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [5.269, 5.228, 4.819], "median": 5.228},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.451, 0.428, 0.446], "median": 0.446},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [2.525, 2.666, 2.563], "median": 2.563},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.016, 4.981, 5.08], "median": 5.016},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2868.2, 2758.5, 2803], "median": 2803},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14267.32, 14244, 14226.84], "median": 14244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [258.024, 257.6, 257.288], "median": 257.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.297, 1.354, 1.31], "median": 1.31},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.107, 1.191, 1.148], "median": 1.148},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.388, 0.375, 0.354], "median": 0.375},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.985, 3.995, 3.985], "median": 3.985},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.084, 5.101, 5.05], "median": 5.084},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [247.7, 247, 250], "median": 247.7},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14224.64, 14191.2, 14174.48], "median": 14191.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.248, 256.64, 256.336], "median": 256.64},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.251, 1.275, 1.254], "median": 1.254},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.243, 1.257, 1.251], "median": 1.251},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.092, 0.094, 0.092], "median": 0.092},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [8.285, 8.786, 8.701], "median": 8.701},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [21.007, 20.636, 21.549], "median": 21.007},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [3271.5, 3206.1, 3191.7], "median": 3206.1},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14224.64, 14191.2, 14174.48], "median": 14191.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.248, 256.64, 256.336], "median": 256.64},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [5.735, 5.814, 5.534], "median": 5.735},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [4.79, 5.281, 4.817], "median": 4.817},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.438, 0.444, 0.44], "median": 0.44},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [2.536, 2.586, 2.561], "median": 2.561},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.197, 5.016, 4.99], "median": 5.016},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2854, 2830.7, 2855.5], "median": 2854},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [14224.64, 14191.2, 14174.48], "median": 14191.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [257.248, 256.64, 256.336], "median": 256.64},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.297, 1.338, 1.298], "median": 1.298},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.141, 1.191, 1.153], "median": 1.153},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.372, 0.372, 0.363], "median": 0.372},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.184, 4.096, 4.115], "median": 4.115},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.309, 5.277, 5.274], "median": 5.277},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [229.8, 235.4, 233.8], "median": 233.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9457.344, 9697.681, 9615.813], "median": 9615.813},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256, 256, 255.904], "median": 256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.704, 1.663, 1.664], "median": 1.664},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.716, 1.661, 1.676], "median": 1.676},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.068, 0.07, 0.066], "median": 0.068},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [15.219, 16.064, 15.926], "median": 15.926},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [28.781, 31.02, 30.856], "median": 30.856},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1979.6, 1886.5, 1886.7], "median": 1886.7},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9457.344, 9697.681, 9615.813], "median": 9615.813},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256, 256, 255.904], "median": 256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [12.43, 13.153, 13.112], "median": 13.112},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [11.676, 12.458, 12.317], "median": 12.317},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.292, 0.295, 0.284], "median": 0.292},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.873, 4.026, 4.079], "median": 4.026},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [6.604, 7.132, 6.767], "median": 6.767},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1959.9, 1873.7, 1886.1], "median": 1886.1},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [9457.344, 9697.681, 9615.813], "median": 9615.813},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [256, 256, 255.904], "median": 256},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.442, 2.525, 2.519], "median": 2.519},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.26, 2.331, 2.38], "median": 2.331},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g256", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.27, 0.258, 0.262], "median": 0.262},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.215, 4.178, 4.161], "median": 4.178},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.398, 5.324, 5.299], "median": 5.324},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [229.7, 230.4, 230.8], "median": 230.4},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.701, 1.712, 1.708], "median": 1.708},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.694, 1.714, 1.727], "median": 1.714},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.072, 0.07, 0.069], "median": 0.07},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [15.238, 15.666, 15.289], "median": 15.289},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [31.096, 31.477, 29.488], "median": 31.096},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1929.4, 1882.4, 1966.1], "median": 1929.4},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [12.449, 12.636, 12.125], "median": 12.449},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [11.524, 11.775, 11.526], "median": 11.526},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.288, 0.285, 0.277], "median": 0.285},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.176, 4.192, 4.153], "median": 4.176},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [7.007, 6.993, 6.744], "median": 6.993},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1838.6, 1834.5, 1844.8], "median": 1838.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [570076, 570076, 570076], "median": 570076},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [10000, 10000, 10000], "median": 10000},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.616, 2.602, 2.568], "median": 2.602},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.473, 2.423, 2.43], "median": 2.43},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.26, 0.253, 0.251], "median": 0.253},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.204, 4.076, 4.078], "median": 4.078},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.358, 5.198, 5.191], "median": 5.198},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [228.9, 238, 237.6], "median": 237.6},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476687.2, 476203.84, 476542.192], "median": 476542.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8361.6, 8353.12, 8359.056], "median": 8359.056},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.682, 1.627, 1.644], "median": 1.644},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.686, 1.635, 1.648], "median": 1.648},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.073, 0.071, 0.071], "median": 0.071},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [14.598, 15.044, 15.242], "median": 15.044},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [28.966, 28.549, 29.111], "median": 28.966},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [2025.4, 1990.9, 1957.6], "median": 1990.9},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476687.2, 476203.84, 476542.192], "median": 476542.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8361.6, 8353.12, 8359.056], "median": 8359.056},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [11.36, 11.903, 12.257], "median": 11.903},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [10.774, 11.298, 11.408], "median": 11.298},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.294, 0.272, 0.284], "median": 0.284},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [3.936, 4.039, 3.897], "median": 3.936},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [6.697, 6.838, 6.798], "median": 6.798},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1935.3, 1883.1, 1936.5], "median": 1935.3},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [476687.2, 476203.84, 476542.192], "median": 476542.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8361.6, 8353.12, 8359.056], "median": 8359.056},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.411, 2.497, 2.484], "median": 2.484},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.258, 2.328, 2.319], "median": 2.319},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.264, 0.259, 0.266], "median": 0.264},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.223, 4.187, 4.225], "median": 4.223},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [5.379, 5.287, 5.373], "median": 5.373},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [230.2, 231.2, 228.5], "median": 230.2},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [315031.303, 312160.1845, 315026.2965], "median": 315026.2965},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8188.192, 8188.192, 8184.384], "median": 8188.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [1.721, 1.721, 1.753], "median": 1.721},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [1.705, 1.714, 1.741], "median": 1.714},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.069, 0.067, 0.068], "median": 0.068},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [15.866, 16.848, 17.4], "median": 16.848},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [32.049, 31.004, 33.944], "median": 32.049},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1870.2, 1804.8, 1740], "median": 1804.8},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [315031.303, 312160.1845, 315026.2965], "median": 315026.2965},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8188.192, 8188.192, 8184.384], "median": 8188.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [13.321, 13.743, 14.538], "median": 13.743},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [12.384, 13.244, 13.888], "median": 13.244},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.266, 0.254, 0.261], "median": 0.261},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [4.097, 4.427, 4.559], "median": 4.427},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [7.115, 7.514, 7.733], "median": 7.514},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [1848, 1735.5, 1676.5], "median": 1735.5},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_bytes_per_query", "unit": "B", "values": [315031.303, 312160.1845, 315026.2965], "median": 315026.2965},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "read_rows_per_query", "unit": "rows", "values": [8188.192, 8188.192, 8184.384], "median": 8188.192},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [2.587, 2.785, 2.863], "median": 2.785},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_p50", "unit": "ms", "values": [2.428, 2.611, 2.693], "median": 2.611},
    {"exp": "EXP-41", "op": "point", "store": "clickhouse", "variant": "ch_g8192", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.242, 0.248, 0.239], "median": 0.242},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.104, 0.099, 0.1], "median": 0.1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.154, 0.129, 0.132], "median": 0.132},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [8650, 9456, 9244.2], "median": 9244.2},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.005, 0.004, 0.004], "median": 0.004},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.335, 0.347, 0.341], "median": 0.341},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [1.132, 1.026, 1.14], "median": 1.132},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [3.342, 3.131, 3.888], "median": 3.342},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [20959.7, 23305.1, 21398.2], "median": 21398.2},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.006, 0.006, 0.006], "median": 0.006},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.825, 0.815, 0.806], "median": 0.815},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.254, 0.246, 0.287], "median": 0.254},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [1.33, 0.778, 1.082], "median": 1.082},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [19828.5, 23399.1, 20480.7], "median": 20480.7},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.007, 0.006, 0.007], "median": 0.007},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 10000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.778, 0.75, 0.761], "median": 0.761},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.104, 0.1, 0.103], "median": 0.103},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.138, 0.132, 0.14], "median": 0.138},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [9051.7, 9360.7, 9052.4], "median": 9052.4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.005, 0.005, 0.005], "median": 0.005},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.351, 0.343, 0.341], "median": 0.343},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [1.036, 1.04, 1.264], "median": 1.04},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [2.934, 3.97, 3.102], "median": 3.102},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [23523.9, 21030.3, 20453.6], "median": 21030.3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.008, 0.008, 0.009], "median": 0.008},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.812, 0.788, 0.791], "median": 0.791},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [3, 3, 3], "median": 3},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.245, 0.263, 0.276], "median": 0.263},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.81, 0.93, 0.792], "median": 0.81},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [23373.8, 22756.2, 23327.8], "median": 23327.8},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.006, 0.007, 0.009], "median": 0.007},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 100000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.767, 0.76, 0.782], "median": 0.767},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.104, 0.103, 0.101], "median": 0.103},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.139, 0.132, 0.132], "median": 0.132},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [9005.1, 9273, 9125.7], "median": 9125.7},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.006, 0.006, 0.006], "median": 0.006},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 1, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.347, 0.337, 0.334], "median": 0.337},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [1.092, 0.996, 1.11], "median": 1.092},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [4.453, 3.693, 2.879], "median": 3.693},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [19597.7, 22819.5, 22499.8], "median": 22499.8},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.01, 0.01, 0.011], "median": 0.01},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 32, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.805, 0.839, 0.81], "median": 0.81},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "blocks_per_query", "unit": "blocks", "values": [4, 4, 4], "median": 4},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p50", "unit": "ms", "values": [0.262, 0.247, 0.266], "median": 0.262},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "latency_p95", "unit": "ms", "values": [0.977, 1.013, 0.902], "median": 0.977},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "qps", "unit": "req/s", "values": [22529.7, 22031.8, 23405.3], "median": 22529.7},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "rows_per_query", "unit": "rows", "values": [1, 1, 1], "median": 1},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "server_mean", "unit": "ms", "values": [0.008, 0.01, 0.01], "median": 0.01},
    {"exp": "EXP-41", "op": "point", "store": "postgresql", "variant": "pg", "scale": 1000000, "concurrency": 8, "rate": null, "read": null, "metric": "tool_cpu", "unit": "ratio", "values": [0.78, 0.762, 0.819], "median": 0.78}
  ]
}
```
