# 실험 프로토콜

> **대상**: ★ 실험 규칙 정본 — 실험 한 번의 절차 · 3회 중앙값과 편차 폐기 기준 · 구조 판정과 분포 판정 · 스냅샷과 복원 · 캐시 키 초기화 · 기준선 · 회복 관측 · 조건 칸(4요소 + 부가 조건) · 조건 분리 강제 · **측정 기록 템플릿(docs/measurements/NNN-{slug}.md)** · **기계 판독 블록 형식(EXP-COMPARE BFF가 읽는다)** · 기록 상태와 정정 · 결과를 정본 문서에 올리는 절차
> **작성일**: 2026-09-24
> **개정일**: 2026-09-25 — S2 판정 반영(기록 011 · 012 관측 뒤 정한 규칙(S2)) — §반복과 폐기에 버킷 보간 분위수 조항 신설 — 히스토그램 계열은 p50으로 판정 · p95 이상은 참고 · 정확 분위수가 있으면 그것이 절대값
> **개정일**: 2026-09-25 — S2 판정 반영(기록 013) — 기계 판독 블록 switches: 스위치 비교 기록은 대상 스위치만 arm 순서 값 배열
> **개정일**: 2026-09-24 — S0 반영 — 기록 상태에 구조 사실 판별 기록(api 부재 단계) 조항 신설 — run · switches null 허용 · 수치 인용 불가 · 정본에는 구조 사실만
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 조건 분리 규칙 7 → **8**(실시간 · STALE · E2E 실험은 현재 시각 생성만 — 03_requirements/06 · 02_features/05가 넘긴 판정 수용)
> **원천**: 원본 implementation_plan.md §2.4 · §5 S5 · §8(커밋 ff66a37) · 원본 data_flow.md §11.3(커밋 ff66a37) · 원본 tech_stack.md §10.6 · §14(커밋 ff66a37) · 원본 architecture.md §14(커밋 ff66a37) · docs_plan.md 보정 #3 · 웨이브 인계 W6 10/04 행(기계 판독 블록) · D-10 · REQ-GLB-17 · 23 · REQ-TEC-08~13 · [../07_api/10_metrics.md](../07_api/10_metrics.md) health run · switches · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §대조군 역전 지점 · [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) §측정 기록 파일명

이 문서는 **실험을 어떻게 돌리고 어떻게 적는가의 정본**이다. 무엇을 재는지는 [06_experiment_catalog.md](./06_experiment_catalog.md)가, 부하 모양은 [05_load_scenarios.md](./05_load_scenarios.md)가 갖는다. 전역 불변식 "측정 기록"(4요소 병기 · 3회 중앙값 · 편차 초과 폐기)의 기준 값이 여기 있다.

**규칙의 목적은 하나다 — 3주 뒤의 자기 수치를 믿을 수 있게 한다.** 이 머신은 P · E 코어 혼합과 WSL2 vCPU 매핑 불확실성 때문에 같은 실험도 실행마다 흔들리고(원본 implementation_plan.md §2.4), 한 번의 수치는 재현되지 않는다. 조건을 잃은 수치는 사후에 복원할 수 없다 — 그래서 기록은 실행 시점에 조건과 함께 고정되고 사후에 고치지 않는다.

**docs/measurements는 린트 대상 밖이지만 형식은 이 문서가 고정한다.** 기록 파일은 설계 정본이 아니라 실측 파일이다(docs_plan 보정 #3). 그러나 EXP-COMPARE의 대조군 역전 지점 패널을 Next.js BFF가 이 파일에서 읽으므로 기계 판독 블록의 모양은 계약이다 — 형식을 어긴 기록은 화면에서 빠지고 "판독 불가 기록"으로 세어진다.

## 실험 한 번의 절차

실험 하나는 아래를 3회 반복한 것이다. 흐름 쪽 대응(8단계 · 계약 번호)의 정본은 [../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §부하 실행 절차이고, 이 문서는 각 단계가 지킬 규칙을 고정한다.

```plain
① 스냅샷          task snapshot — 실험 전 볼륨 4개를 묶는다 (첫 반복 전 1회)
② 기동 · 초기화   컨테이너 재기동 → 주입 구현 확인(health switches) → 캐시 계열 키 삭제
③ 기준선          유휴 관측 — 부하 없이 자원 · 지표의 바닥값
④ 주입            주입 모드 하나 · 생성기 CPU 기록 · 판정 창 시작 시각 기록
⑤ 유지 · 판정 창   정상 상태 구간만 판정 창으로 쓴다 — 워밍업 · 종료 전이 제외
⑥ 회복            주입 정지 → 랙 0 · 파트 병합 수렴까지 관측
⑦ 정합            구조 판정(무손실 · 무중복 · 결과 동일성)
⑧ 복원            task restore → 다음 반복은 ②부터
```

- **③과 ⑥을 건너뛰지 않는다.** 기준선이 없으면 부하가 만든 차이와 원래 바닥을 가를 수 없고, 회복을 보지 않고 끝내면 소진되지 않은 적체를 무손실로 오판한다(REQ-TEC-09).
- **⑤ 판정 창은 기록 칸이다.** 창 시작 · 끝 시각(UTC ISO)을 기록에 적는다 — 창 밖의 워밍업 구간을 섞으면 p95가 기동 직후 JIT · 캐시 비움 비용을 잰다.
- **⑧은 반복마다 한다.** 반복 사이에 복원하지 않으면 두 번째 반복이 첫 반복의 파트 · TTL 진행 위에서 돌아 세 값이 같은 조건이 아니다.
- 대조군 격자(EXP-01~05)는 예외다 — 단계가 앞 단계에 누적되므로 반복은 **쿼리 축에서** 하고(쿼리 3회 · 콜드 반복 사이 컨테이너 재기동) 적재는 단계당 1회다.

## 반복과 폐기

| 항목 | 규칙 | 어기면 |
|------|------|------|
| 반복 수 | 같은 실험 **3회** — 구조값 | 한 번의 수치는 코어 배치에 따라 재현되지 않는다 |
| 대표값 | 판정 지표마다 3회의 **중앙값** | 평균은 한 번의 이상치에 끌려 편차 판정과 대표값이 어긋난다 |
| 편차 | 판정 지표마다 (최대 − 최소) ÷ 중앙값 | 최대 ÷ 최소로 재면 중앙값이 작은 지표에서 기준이 과민해진다 |
| 폐기 기준 | 편차가 기준을 넘는 판정 지표가 하나라도 있으면 **세 반복 전부 폐기** — 기준 2계층 · 현행 참고 20%(원본 implementation_plan.md §8) · 소유 이 문서 | 넘은 지표만 버리면 같은 실행의 다른 지표가 흔들린 조건 위에서 살아남는다 |
| 폐기 후 | 폐기 기록을 status discarded로 남기고 조건(cpuset · 관측 스택 · 백그라운드 프로세스)을 다시 잡아 새 기록으로 반복 | 폐기를 지우면 "잘 나올 때까지 돌렸다"와 구분되지 않는다 |
| 판정 지표 | 실험마다 [06_experiment_catalog.md](./06_experiment_catalog.md) 판정 지표 열의 수치 전부 | 편차를 보고 싶은 지표만 골라 판정한다 |

- 검산: 항목 = **6**
- **히스토그램 계열의 판정 분위수는 p50이다 — p95 이상은 참고로 내린다. 정확 분위수(quantilesExact · k6)가 있으면 그것이 절대값이다(S2 판정 · 기록 011 · 012 관측 뒤).** 꼬리 분위수는 표본이 적은 넓은 칸(서브 ms 구간의 1~3 ms 칸은 폭이 값의 2배)에 떨어져 보간이 값을 만든다. 한 칸 안의 선형 보간은 칸 안 표본이 고르게 퍼졌다고 가정해 값을 만든다 — 그 값의 흔들림은 분포가 아니라 보간의 흔들림이라 편차 폐기를 거짓으로 걸거나(서브 ms 구간 p95가 1~3 ms 한 칸 안에서 기준을 넘음 · 기록 012) 반대로 세 값이 거의 같아 안정으로 오독된다(한 칸 안 보간이 같은 값을 냄 · 기록 013 on 팔 서버 p95). 참고로 내린 분위수는 기록에 남기되 편차 폐기와 정본 인용에 쓰지 않고, 어느 분위수를 판정에 쓰는지는 [06_experiment_catalog.md](./06_experiment_catalog.md) 판정 지표 열이 실험마다 적는다.
- **B형 — 폐기 기록을 남기는 것은 실패의 전시가 아니다.** 결론 — 폐기 횟수 자체가 이 머신의 분산 크기를 알려 주는 자료다. 반대 시나리오 — 폐기를 버리면 기준 20%가 실제로는 몇 번 만에 통과되는지 모르므로 기준이 너무 느슨한지 판단할 근거가 없다. 파생 지침 — 폐기 기록도 기계 판독 블록을 갖고 status로 걸러진다.

## 구조 판정과 분포 판정

AC의 합격선은 두 종류다([../03_requirements/14_acceptance_criteria.md](../03_requirements/14_acceptance_criteria.md) 판정 공통 규칙). 반복 규칙이 둘에 다르게 걸린다.

| 판정 | 예 | 3회의 쓰임 | 합격 | 편차 폐기 |
|------|------|------|------|------|
| 구조 판정 | 무손실 차 0 · 중복 0건 · 결과 집합 일치 · 봉인 계열 축출 0 · 트리밍 결함 0 | **3회 전부 성립** | 한 번이라도 어기면 불합격 | 적용하지 않는다 — 분포가 없다 |
| 분포 판정 | 지연 p95 · 처리량 · 히트율 · 소진 시간 · 역전 지점의 쿼리 시간 | **중앙값**이 대표값 | "기록"이 합격선 — 목표 대비 판정은 목표 확정 뒤 | 적용한다 |
| 혼합 | 변곡점(분포 판정 곡선 위의 구조적 점) | 반복마다 변곡점을 판독해 중앙값 | 상동 | 변곡점 pps에 적용 |

- 검산: 판정 = **3**
- **A형 — "3회 중앙값"이 무손실에도 걸린다고 읽으면 결함이 숨는다.** 통념은 모든 수치에 3회 중앙값을 쓴다는 것이다. 부정 — 무손실 차가 0 · 0 · 3이면 중앙값은 0이지만 3건 유실이 실재한다. 진짜 축은 구조 판정에 분포가 없다는 것이다. 대체 경로 — 구조 판정은 반복 전부의 성립을 요구하고 불성립 반복을 기록에 남긴다.

## 초기 상태 — 스냅샷 · 복원 · 캐시 초기화 · 기준선

스냅샷 · 복원 작업의 실행 구성 정본은 [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) §스냅샷과 복원이다. 이 표는 실험 쪽 규칙이다.

| 대상 | 실험 전 처리 | 이유 | 어기면 |
|------|------|------|------|
| 볼륨 4개 | 첫 반복 전 스냅샷 · 반복마다 복원 | TTL · 머지가 진행된 데이터 위에 부하를 걸지 않는다(REQ-TEC-08) | 직전 실험의 파트 · 캐시 상태가 결과에 섞인다 |
| cache · lock 접두 | **삭제** | 이전 실험의 캐시가 첫 요청부터 히트한다(REQ-TEC-09) | 캐시 미스 p95가 비어 있는 기록이 된다 |
| stream · rt · alarm 접두 | **유지** — 봉인 계열 | 미소비 엔트리 · 최신값을 지우면 유실 · 복원 경로가 조건에 섞인다 | 복원 창 쿼리가 실험 부하에 더해진다 |
| rl · auth 접두 | 유지 | rl은 분 창이라 스스로 비고 auth를 지우면 로그인 상태가 실험마다 달라진다 | S7 조회 실험이 재로그인 부하를 잰다 |
| 메트릭 누적값 | 기동으로 0 — 판정 창은 캡처 두 점의 차 | 누적 카운터는 기동 이후 합이다 | 재기동을 끼운 창의 차가 음수가 되어 분위수가 뒤집힌다 |
| 기준선 | 부하 없이 관측 — 현행 참고 5분(원본 data_flow.md §11.3) · 소유 이 문서 | 부하가 만든 차이와 유휴 바닥을 가른다 | 유휴 자원 사용이 부하 효과로 기록된다 |

- 검산: 대상 = **6**
- 삭제는 접두 단위 명령으로만 한다 — 전체 삭제(키 공간 비우기)는 봉인 계열을 함께 지운다. 삭제 수단 · 금지 명령의 정본은 [../05_data_stores/05_redis_keyspace.md](../05_data_stores/05_redis_keyspace.md)다.
- **대조 실험의 콜드는 근사다.** OS 페이지 캐시는 Docker VM 안이라 비울 수 없어 콜드 = 컨테이너 재기동 직후 첫 실행이다 — 기록의 캐시 상태 칸에 그 정의를 적는다([07_measurement_limits.md](./07_measurement_limits.md)).

## 조건 칸 — 4요소와 부가 조건

**4요소는 health 응답에서 복사한다 — 손으로 옮겨 적지 않는다.** 필드 정본은 [../07_api/10_metrics.md](../07_api/10_metrics.md) #1(run · switches)이며 EXP-CONSOLE 기록 조건 블록이 같은 모양을 만든다.

| 칸 | 원천 | 값 형식 | 없으면 |
|------|------|------|------|
| 커밋 해시 | health run.commitHash | 문자열 | **인용 불가** — 4요소 누락 |
| 메모리 프로파일 | health run.memoryProfile · memoryLimitMb | 문자열 · 정수 | 상동 |
| 용량 티어 | health run.capacityTier | S · M · M+ · L | 상동 |
| 스위치 상태 | health switches 11종 전부의 value · impl | on · off · 정수(SW-07) · ingest · collector | 상동 |
| 주입 모드 | 실행 명령 | A · B · C · D · 없음 | 모드를 섞었는지 판정할 수 없다 |
| 관측 스택 | 기동 명령 | off(정밀 세션) · on(탐색 — 상대 비교용) | 절대값 인용 여부를 가를 수 없다 |
| 생성기 CPU | 호스트 도구 · 생성기 지표 | 실행 중 최대 사용률 | 포화 구간을 폐기할 수 없다(REQ-GEN-13) |
| CPU 배치 · 대조 메모리 | cpuset 표준 · 대조 동일화 · 대조 표준 메모리(ClickHouse 3.5 GB · PostgreSQL 3.5 GB — 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)) | 이름 · 값 | 자원 배분 차이가 결과에 섞인다 |
| 시드 · 신호 프로파일 | 생성기 설정 | 정수 · 프로파일 이름 | 재현할 데이터가 없다 |
| 게이트 · SIM 주입 계획 | 기동 환경변수 · SIM_FAULT_PLAN | 켜짐 여부 · 계획 파일 경로 · 파일 해시 | 모드 C · 결측 원인을 가를 수 없다 · 같은 이름의 다른 계획을 가를 수 없다 |
| 압축 방식 | 기동 설정 | zstd · gzip | 캐시 · 전송 크기와 CPU 비용이 다른 두 조건이 한 기록으로 묶인다 |
| swap 사용 | 호스트 도구(WSL2) | 사용 여부 · 실험 중 최대 사용량 | 메모리 상한 초과가 지연 꼬리로 숨는다 |
| WSL 네트워킹 모드 | .wslconfig | mirrored · NAT | 루프백 경로 길이가 다른 지연이 비교된다([07_measurement_limits.md](./07_measurement_limits.md)) |

- 검산: 칸 = 4요소 4 + 부가 9 = **13**
- 환경변수 이름(MEMORY_PROFILE — load · dev · mid · CAPACITY_TIER · 빌드 인자 COMMIT_HASH · WORKER_POOL_SIZE · SIM_FAULT_PLAN)의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)다. health run의 memoryProfile 값은 MEMORY_PROFILE 값 그대로다.
- **스위치는 기계 판독 블록에서 11종 전부를 적는다.** 사람이 읽는 조건 표는 "바꾼 것만 명시 · 나머지 기본값"을 허용하지만(REQ-TEC-10), 기본값 자체가 바뀌면(스위치 기본값 변경 절차) 옛 기록의 "기본값"이 다른 조건을 가리킨다 — 블록은 값 전부를 싣는다.
- **health 값이 null이면 그 기록은 4요소가 빠진 기록이다.** 추정값으로 채우지 않는다 — null은 인용 불가 표지이고 BFF가 그 점을 그리지 않는다.

## 조건 분리 강제

[../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약을 실행 규칙으로 강제하는 자리다. 콘솔은 경고만 하고(EXP-CONSOLE), 강제는 기록 판정이 한다.

| 규칙 | 판정 시점 | 위반 기록의 처리 |
|------|------|------|
| 주입 모드 하나 | 조건 칸 | 무효 — 병목 계층을 가를 수 없다 |
| 조합 제약 9건(#8 · #9 — SW-10 on · SW-11 collector는 모드 A 전용 포함) | 조건 칸의 스위치 · 모드 대조 | 무효 — 차이가 0으로 나와 "효과 없음"이 거짓으로 기록된다 |
| 비교는 대상 스위치 하나만 다르게 | 두 기록의 스위치 11종 대조 | 비교 불성립 — 두 기록은 각각 유효하다 |
| 나머지 3요소 같음 | 두 기록의 커밋 · 프로파일 · 티어 대조 | 비교 불성립 |
| 개발 · 중간 프로파일 수치를 목표와 비교하지 않음 | 프로파일 칸 | 기록은 유효 · 정본 인용 불가(REQ-TEC-07) |
| 관측 스택 on 수치는 상대 비교용 | 관측 스택 칸 | 절대값 인용 불가 |
| 생성기 포화 구간 제외 | 생성기 CPU · 달성률 | 포화 구간 폐기([05_load_scenarios.md](./05_load_scenarios.md) §생성기 포화 판정) |
| 실시간 화면 · STALE · E2E를 읽는 실험은 현재 시각 생성만 | 주입 모드 칸 — 모드 D(과거 ts 백필)가 아님 | 무효 — 과거 ts는 최신값을 전부 STALE로 만들고 E2E(ingested_at − ts)를 백필 기간만큼 부풀린다(11_glossary/05 · REQ-GEN 등재) |

- 검산: 규칙 = **8**
- 모드 C 인증 비용은 S7 커밋의 기록에서만 잰다 — S5 모드 C 기록과 한 비교로 묶지 않는다(REQ-GEN-15). 두 기록은 커밋 해시가 달라 비교 불성립으로 자동 판정된다.

## 측정 기록 템플릿

파일은 docs/measurements/NNN-{slug}.md다(NNN 3자리 일련번호 · slug 소문자 영문 · 숫자 · 하이픈 — [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md)). 실험 카탈로그의 기록 slug 열이 slug를 준다. 아래가 본문 골격이다.

```plain
# 014 — SW-02 최신값 조회 on/off (S2 수직 슬라이스)

> 실험: EXP-07 · 상태: 유효 · 정정 대상: 없음 · 판정 창: 2026-10-02T01:00:00Z ~ 01:10:00Z

## 조건
| 항목 | 값 |
| 커밋 | a1b2c3d |
| 프로파일 · 상한 | 부하 실험 · 4096 MB |
| 용량 티어 | S(수직 슬라이스 설비 1 · 태그 8) |
| 스위치 | SW-02=off/on · 그 외 기본값 (전수는 기계 판독 블록) |
| 주입 모드 · 시드 | A · 42 |
| 관측 스택 · 생성기 CPU · CPU 배치 | off · 최대 18% · 표준 |
| 압축 · swap · WSL 네트워킹 · SIM 계획 | zstd · 사용 없음 · mirrored · 없음 |
| 반복 · 편차 | 3회 · 판정 지표 최대 편차 6% |

## 결과
| 지표 | off | on | 비 |

## 해석
왜 이 차이가 났는가 · 예상과 다른 점 · 한계(07_measurement_limits 행 인용)

## 폐기 · 예외
폐기한 반복 · 불성립 구조 판정 · 창에서 뺀 구간

## 정본 반영
어느 정본 문서의 어느 미확인 행을 이 기록으로 올렸는가 (없으면 "없음")

## 기계 판독 블록
(json 펜스 1개 — 아래 형식)
```

- **머리 둘째 줄이 EXP-NN 인용이다.** 파일명에 EXP 번호를 넣지 않는다 — 대조 격자 단계 기록은 EXP-01~05를 함께 인용한다.
- 원본 템플릿(원본 implementation_plan.md §8)의 네 절에 **폐기 · 예외**와 **기계 판독 블록**을 더했다. "설계서 반영"은 원본 4본이 W7에 사라지므로 **정본 반영**으로 이름을 바꾼다.

## 기계 판독 블록

인계 "docs/measurements 기록의 기계 판독 블록 형식"을 닫는다. **판정 — 기록마다 json 언어 표기의 펜스 하나를 두고, 최상위 schema 값이 measurement/v1인 블록만 기계 판독 블록으로 본다.** plain 펜스 안 key=value 형식은 쓰지 않는다 — 대조 격자의 점은 쿼리 × 저장소 × 인덱스 변형 × 캐시 상태의 중첩이라 평면 key=value로 적으려면 경로 문법을 새로 만들어야 하고, 형식이 둘이면 BFF 판독기도 둘이 된다.

```json
{
  "schema": "measurement/v1",
  "record": "031",
  "exp": ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05"],
  "status": "valid",
  "supersedes": null,
  "window": { "start": "2026-10-20T01:00:00.000Z", "end": "2026-10-20T03:00:00.000Z" },
  "run": { "commitHash": "a1b2c3d", "memoryProfile": "load", "memoryLimitMb": 4096, "capacityTier": "M" },
  "switches": {
    "SW-01": "on", "SW-02": "on", "SW-03": "on", "SW-04": "on", "SW-05": "on", "SW-06": "on",
    "SW-07": 100, "SW-08": "on", "SW-09": "on", "SW-10": "off", "SW-11": "ingest"
  },
  "conditions": { "injectionMode": "D", "observability": "off", "cpuset": "control-equalized", "controlMemoryMb": { "clickhouse": 3584, "postgres": 3584 }, "seed": 42, "generatorCpuMax": null, "compression": "zstd", "swapUsed": false, "wslNetworking": "mirrored", "simFaultPlan": null, "q5Threshold": 12.5 },
  "repeat": { "runs": 3, "deviation": 0.08, "threshold": 0.2 },
  "results": [],
  "points": [
    { "query": "Q1", "rows": 1000000, "stage": 2, "store": "postgresql", "index": "I1", "cache": "warm", "unit": "ms", "values": [41.2, 39.8, 40.5], "median": 40.5, "resultMatch": true },
    { "query": "Q1", "rows": 1000000, "stage": 2, "store": "clickhouse", "index": null, "cache": "warm", "unit": "ms", "values": [9.1, 9.4, 8.8], "median": 9.1, "resultMatch": true }
  ],
  "axes": [
    { "axis": "storage_bytes", "store": "postgresql", "index": "I1", "rows": 1000000, "value": 76000000, "unit": "bytes" }
  ]
}
```

위 수치는 형식 예시이며 측정값이 아니다(3계층 미확인).

| 필드 | 필수 | 형식 | 쓰는 쪽 |
|------|:--:|------|------|
| schema · record · exp · status · supersedes | 예 | measurement/v1 · 3자리 · EXP-NN 배열 · valid · discarded · superseded · 기록 번호 또는 null | BFF 필터 |
| window | 예 | UTC ISO 시작 · 끝 | 사람 · 재현 |
| run | 예 | health run 네 필드 그대로 | 4요소 툴팁 · 비교 성립 판정 |
| switches | 예 | 스위치 11종 전부 · health switches.*.value 그대로 — **스위치 비교 기록(on/off 두 팔)은 대상 스위치만 results의 arm 순서대로 값 배열**(예: ["on", "off"]) · 나머지는 스칼라 | 상동 |
| conditions | 예 | injectionMode · observability · cpuset · seed · generatorCpuMax · compression · swapUsed · wslNetworking · simFaultPlan(경로 · 해시 또는 null) 필수 · controlMemoryMb(대조 기록) · 나머지 실험별 | 조건 분리 판정 |
| repeat | 예 | runs · deviation · threshold | 폐기 판정 |
| results | 예(빈 배열 허용) | metric · arm · unit · values · median | 스위치 비교 기록 |
| points | 대조 기록만 | query · rows · stage · store · index · cache · unit · values · median · resultMatch | 역전 지점 선 차트 |
| axes | 대조 기록만 | axis(storage_bytes · compression_ratio · insert_rows_per_sec · write_amplification · index_bytes) · store · index · rows · value · unit | 비교 축 막대 |

- 검산: 필드 행 = **9**
- **비교 기록의 대상 스위치만 배열이다(S2 판정 · 기록 013).** 한 기록이 두 팔을 담으므로 대상 스위치의 값은 하나가 아니다 — 스칼라 하나를 적으면 다른 팔의 조건이 블록에서 사라지고, 두 기록으로 쪼개면 같은 복원 · 같은 반복 순서로 교대한 팔이 다른 기록이 되어 비교 성립 판정(나머지 10종 동일)을 블록 둘에 걸쳐 해야 한다. 판독기는 배열 값을 "이 스위치가 비교 대상"으로 읽고 BFF 규칙 4의 null 검사는 원소마다 한다. · axes의 axis 값 **5** + 쿼리 시간(points) 1 = 비교 축 **6**([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6)

### BFF 판독 규칙

| # | 규칙 | 걸리면 |
|:--:|------|------|
| 1 | 파일명이 NNN-{slug}.md 모양이다 | 무시 — 기록 파일이 아니다 |
| 2 | schema가 measurement/v1인 json 블록이 정확히 1개다 | "판독 불가 기록"으로 센다 |
| 3 | status가 valid이고, 다른 valid 기록의 supersedes가 이 기록을 가리키지 않는다 | 제외 — 폐기 · 정정된 기록 |
| 4 | run 네 필드와 switches 11키가 전부 null이 아니다 | 점을 그리지 않고 "4요소 누락"으로 센다 |
| 5 | repeat.runs ≥ 3이고 deviation ≤ threshold다 | 제외 — 폐기 기준 초과 |
| 6 | 역전 지점 패널은 exp에 EXP-01~05 중 하나가 있는 기록의 points만 쓴다 | 다른 실험의 점이 대조 선에 섞이지 않는다 |
| 7 | 모르는 필드는 무시한다 · 필드를 없애거나 뜻을 바꾸면 schema를 measurement/v2로 올린다 | v1 판독기가 새 기록을 조용히 잘못 읽는다 |

- 검산: 규칙 = **7**
- **판독 불가 · 4요소 누락은 세어 보인다.** 조용히 빼면 역전 지점이 측정 누락 위에 그려진다([../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §대조군 역전 지점).
- BFF는 읽기만 한다 — 기록을 만들거나 고치는 경로는 화면에 없다. 기록의 정본성은 파일이 커밋 해시와 함께 git에 남는 데서 온다.

## 기록 상태와 정정

| 상태 | 뜻 | 파일 | 정본 인용 |
|------|------|------|------|
| valid | 3회 · 편차 이내 · 4요소 완비 · 조건 분리 준수 | 그대로 | 가능 |
| discarded | 편차 초과 · 조건 위반 · 생성기 포화 | 그대로 남긴다 | 불가 |
| superseded | 뒤 기록이 supersedes로 가리킨 기록 | **고치지 않는다** — 뒤 기록이 정정한다 | 불가 · 뒤 기록을 인용 |

- 검산: 상태 = **3**
- **구조 사실 판별 기록(api 부재 단계)** — health가 없는 단계(S0)의 판별 · 회귀 기록은 run의 티어 · switches를 null로 두고 status valid로 쓴다. 4요소가 비었으므로 수치는 인용하지 않고, 정본에는 구조 사실(동작 여부 · 1계층 개수 · 설정 채택 근거)만 올린다. BFF 규칙 4는 그대로 적용해 "4요소 누락"으로 센다. 기계 판독 블록 conditions에 recordKind structural-discrimination을 적는다.
- **기록은 사후에 고치지 않는다**(REQ-TEC-11). 잘못 적은 기록은 새 번호의 정정 기록을 쓰고 supersedes로 옛 번호를 가리킨다 — 옛 파일의 status를 바꾸지 않아도 BFF 규칙 3이 옛 기록을 뺀다.

## 결과를 정본 문서에 올리는 절차

기록은 설계 수치의 정본이 되지 않는다([../CLAUDE.md](../CLAUDE.md) §구조). 확정 값은 정본 문서가 기록을 인용해 올린다.

```plain
① 기록 선택      status valid · 3회 중앙값 · 4요소 완비 · 부하 실험 프로파일 · 관측 스택 off
② 대상 행 찾기   실험 카탈로그의 "확정되는 미확인" 열이 가리키는 정본 문서의 미확인 행
③ 값 올리기      "값(기록 NNN · 커밋 · 프로파일 · 티어 · 스위치 변경분)"으로 적는다 — 원본 목표 칸은 지우지 않는다
④ 개정일 줄      정본 문서 메타에 "EXP-NN 실측 반영 — 미확인 → 값" 한 줄
⑤ 파생 갱신      같은 값을 인용하는 문서 · 루트 README 고정 기준(리드)을 같은 변경 단위에서
⑥ 기록 쪽 표시    기록의 "정본 반영" 절에는 반영 시점에 적어 둔 계획만 있다 — 반영 사실은 정본 문서의 개정일 줄이 갖는다
```

- **③에서 4요소 중 스위치는 변경분만 적는다.** 전수는 기록 번호가 가리키는 블록에 있다 — 정본 문서 본문이 11종을 반복하지 않는다.
- **목표 대비 판정은 ③ 뒤에 한다.** 원본 목표를 합격선으로 쓰지 않고 첫 실측을 기준선으로 삼는다([../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md)) — 기준선 확정과 목표 확정은 다른 변경 단위다.
- **as-built 승격은 이 절차의 끝이다.** 한 문서의 미확인 행이 전부 기록 인용으로 바뀌면 그 문서의 성격을 as-built로 올린다(루트 README 성격 줄).

## 조정값 — 조회 계약

| 조정값 | 계층 | 기준 시점 | 금지된 대체 | 현행 참고 |
|------|------|------|------|------|
| 편차 폐기 기준 | 2계층 | 기록 작성 시 | 지표마다 다른 기준 · 사후 완화 | 20%(원본) · 기록 repeat.threshold에 박는다 |
| 기준선 관측 길이 | 2계층 | 실험 시작 | 생략 | 5분(원본) |
| 반복 수 | 1계층 | 해당 없음 | 2회 · 1회 | 3 |
| 판정 창 | 실험별 | 실행 시 | 워밍업 포함 | 시나리오 정본 [05_load_scenarios.md](./05_load_scenarios.md) |

- 검산: 조정값 = **4**
- **기준 값은 기록마다 박는다.** 기준을 나중에 바꿔도 옛 기록의 판정은 그 기록의 threshold로 한다 — 기준 변경이 옛 기록을 소급해 폐기하지 않는다.

## 미확인 · 미설계 등재

| 항목 | 상태 | 확정 자리 |
|------|------|------|
| 편차 20%가 이 머신에 맞는가 | 미확인 — 폐기 기록 비율로 판단 | 첫 10기록 뒤 이 문서 |
| 콜드 상태 근사의 오차 | 3계층 미확인 — 페이지 캐시를 비울 수 없다 | [07_measurement_limits.md](./07_measurement_limits.md) |
| 기록 작성 도구(블록 생성 스크립트) | 미설계 — 코드 착수 항목 | [../09_tech_stack/05_tooling_devops.md](../09_tech_stack/05_tooling_devops.md) |

## 관련 문서

- [06_experiment_catalog.md](./06_experiment_catalog.md) — 실험 전수 · 기록 slug
- [05_load_scenarios.md](./05_load_scenarios.md) — 부하 모양 · 생성기 포화 판정
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health run · switches 필드
- [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) — 기록 조건 블록 · 역전 지점 표시 계약
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 스냅샷 · 복원 · cpuset
- [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) — 측정 기록 파일명
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — REQ-TEC-08~13
