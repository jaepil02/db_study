# 실험 프로토콜

> **대상**: ★ 실험 규칙 정본 — 실험 한 번의 절차 · 3회 중앙값과 편차 폐기 기준 · 구조 판정과 분포 판정 · 역전 구간 우열 3/3 구조 판정 · 스냅샷과 복원 · 캐시 키 초기화 · 기준선 · 회복 관측 · 조건 칸(4요소 + 부가 조건) · 조건 분리 강제 · **측정 기록 템플릿(docs/measurements/NNN-{slug}.md)** · **기계 판독 블록 형식(EXP-PERF BFF가 읽는다)** · 기록 상태와 정정 · 결과를 정본 문서에 올리는 절차
> **작성일**: 2026-09-24
> **개정일**: 2026-10-05 — 센서 자동 생성 게이트 반영(SENSOR_AUTOGEN · 사용자 결정 2026-10-03 · health run.sensorAutogen — 07_api/10 · 검수 반영 리드 판정 M2) — §조건 칸에 **센서 자동 생성 행 신설** — 부가 10 → **11** · 칸 14 → **15** · 기계 판독 블록 run 행 health run 네 필드 그대로 → **health run 그대로 — 4요소 넷 + sensorAutogen(2026-10-03 전 기록은 넷)** — 판독 규칙 4의 run 네 필드 필수 불변 · 필드 행 · 규칙 수 · schema measurement/v1 불변(판독 규칙 7)
> **개정일**: 2026-10-03 — D-15 학습자 눈높이 한 화면(사용자 지시 2026-10-03 — 08_screen/08_evidence_screens · 01_standards §한 화면 원칙) — 4요소 표시 자리 측정 조건 서랍 → **각주 툴팁** · 화면 참고값 예외의 표시 방식 점선 · 회색 · 배지 · 최소~최대 막대 → **각주 고정 문구(시간은 참고용 · 승패는 3번 모두 같을 때만) + 툴팁 배지 문구** — 예외의 범위(표시만 · 정본 문장 인용 금지 · 역전 구간은 structuralRanges만) 불변
> **개정일**: 2026-10-03 — D-14 2화면 전환(사용자 결정 2026-10-03) — 기계 판독 블록을 읽는 화면 EXP-COMPARE(폐지) → **EXP-PERF**(대상 줄 · 도입 · structuralRanges 소비 자리) · 4요소 표시 자리 EXP-CONSOLE 기록 조건 블록 → **두 실증 화면 측정 조건 서랍** · 조합 제약 경고 문장 — 기록 형식 · 필드 수 불변
> **개정일**: 2026-09-28 — DB 시각 UTC(ADR-27) — 격자 2차 절차 사실의 S = KST 자정 − 50,020초에 ADR-27 전 기록 사실임과 러너의 UTC 자정 전환(구현 목록 #21) 병기 — 기록 사실 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — §조건 칸에 **라이브 실행 없음** 행(gen_run_active 전부 0 · GET /api/v1/runs/current가 running · stopping 아님 — 착수 전 확인) — 부가 9 → **10** · 칸 13 → **14**
> **개정일**: 2026-09-28 — 웨이브 1 검수 판정 반영(f-screens · r-screens M3 · r-biz M3) — BFF 판독 규칙 4 "switches 11키" → **기록 시점 스위치 정본의 키 전부**(SW-12 도입 2026-09-27 전 기록은 SW-01~11 11키 · SW-12 부재는 기본값 stream으로 읽는다) · 현재 수 자리 스위치 11종 → **12종**(조건 칸 · 스위치 기록 불릿 · 조건 분리 비교 · 블록 switches · 정본 반영 불릿) · 조합 제약 9건 → **10건**(#10 SW-12 stream) · 스위치 값에 stream · direct — 규칙 · 칸 수 불변
> **개정일**: 2026-09-28 — 표지 키 리드 재판정 — §조건 칸 러너 불릿의 키 rt:flow:subscribed → **cache:flow:subscribed** — 칸 수 불변
> **개정일**: 2026-09-28 — 흐름 이벤트 측정 오염 방지(리드 판정) — §조건 칸에 러너의 흐름 구독 표지 부재 확인 한 줄 — 칸 수 불변
> **개정일**: 2026-09-27 — 새 화면 EXP-PERF(리드 판정 1) — §기록 상태와 정정에 화면의 참고값 표시 예외 한 줄(표시만 · 정본 인용 불가 · 배지 필수) — 상태 · 판독 규칙 수 불변
> **개정일**: 2026-09-27 — W6 리드 요청(x-web4 제안 · 기록 053) — 기계 판독 블록 선택 필드 structuralRanges 신설(대조 기록 선택 · 지수 표기 10^k · 역전 구간 (a, b] · 역전 없음은 winner · range · 우열 미정 점 undetermined · from · to 선택) · BFF 판독 보조 문장(규칙 3 · 5 미적용 · 규칙 4 적용 · 번호가 가장 큰 기록 하나) — 필드 행 11 → **12** · 판독 규칙 7로 measurement/v1 유지
> **개정일**: 2026-09-27 — W6 종합(규약 · 한계 · 계측 · 기록 048~054) — §구조 판정과 분포 판정에 §역전 구간 — 우열 3/3 구조 판정 신설(반복별 부호 규칙 · 동률 점 서버 µs 규칙 · 편차 폐기 면제의 적용 · serverTimeAsymmetry 한계 — 리드 판정 1 · 2) · §실험 한 번의 절차에 격자 2차 적재 · 정밀화 절차 사실 불릿(리드 판정 5) · §기록 상태와 정정의 discarded 정본 인용 칸을 구조 사실 · 결정적 값 인용으로 명확화(비 쿼리 축 바이트 포함 · 삽입 처리량 제외) · §미확인 등재에 검토 과제 2(콜드 반복 방식 · 서버 µs 값의 절대 차 하한) · 격자 러너 보강 1행 — 판정 · 상태 · 필드 행 수와 schema measurement/v1 불변
> **개정일**: 2026-09-27 — 목적 적합성 W5 리드 판정 — §조건 칸에 도구 컨테이너 경로의 memoryLimitMb null 조항(선택 키 run.memoryLimitSource가 있으면 4요소 충족 · 추정 채움 금지 유지) — 칸 수 · schema measurement/v1 불변(판독 규칙 7)
> **개정일**: 2026-09-26 — 마지막 검수 반영 — streamSteps values null 자리(계단 없음 · 무효 반복) · median 조건을 값이 있는 반복 3 미만으로(러너 as-built)
> **개정일**: 2026-09-26 — W3 재검수 반영(EXP-45 null 규칙 N1) — 기계 판독 블록 streamSteps 행의 failures · valid 규칙을 러너(scripts/lab/s5/load/_rec.py exp45-stream-steps) · 판독기(apps/web/lib/evidence.ts) · 08_screen/07 §실증 요약 패널 판독 행과 같은 문장으로 — failures 무효 계단 null → **반복 자리 단위 null** · **행 valid:false = 그 저장소 유효 반복 0** — 필드 행 수 · schema measurement/v1 불변
> **개정일**: 2026-09-26 — W3 코드 검수 반영(r-web-lab M2 · M4 · L1 · L2) — 기계 판독 블록 conditions 행에 EXP-45 키 4(flushWindowSeconds · copyTimeoutSeconds · batchPlan · controlCopySyncCommit) · streamSteps 행에 지표 이름 규약 · values · median · failures의 빈 값 규칙 · 선택 키 valid — 필드 행 수 · schema measurement/v1 불변(판독 규칙 7)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 기계 판독 블록 선택 필드 2행 신설(reverse — 역방향 대조 기록 EXP-40~44 · streamSteps — EXP-45) — 필드 행 9 → **11** · 판독 규칙 7로 measurement/v1 유지
> **개정일**: 2026-09-25 — S2 판정 반영(기록 011 · 012 관측 뒤 정한 규칙(S2)) — §반복과 폐기에 버킷 보간 분위수 조항 신설 — 히스토그램 계열은 p50으로 판정 · p95 이상은 참고 · 정확 분위수가 있으면 그것이 절대값
> **개정일**: 2026-09-25 — S2 판정 반영(기록 013) — 기계 판독 블록 switches: 스위치 비교 기록은 대상 스위치만 arm 순서 값 배열
> **개정일**: 2026-09-24 — S0 반영 — 기록 상태에 구조 사실 판별 기록(api 부재 단계) 조항 신설 — run · switches null 허용 · 수치 인용 불가 · 정본에는 구조 사실만
> **개정일**: 2026-09-24 — 최종 정밀 검수 — 조건 분리 규칙 7 → **8**(실시간 · STALE · E2E 실험은 현재 시각 생성만 — 03_requirements/06 · 02_features/05가 넘긴 판정 수용)
> **원천**: 원본 implementation_plan.md §2.4 · §5 S5 · §8(커밋 ff66a37) · 원본 data_flow.md §11.3(커밋 ff66a37) · 원본 tech_stack.md §10.6 · §14(커밋 ff66a37) · 원본 architecture.md §14(커밋 ff66a37) · docs_plan.md 보정 #3 · 웨이브 인계 W6 10/04 행(기계 판독 블록) · D-10 · REQ-GLB-17 · 23 · REQ-TEC-08~13 · [../07_api/10_metrics.md](../07_api/10_metrics.md) health run · switches · [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §대조군 역전 지점 · [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) §측정 기록 파일명

이 문서는 **실험을 어떻게 돌리고 어떻게 적는가의 정본**이다. 무엇을 재는지는 [06_experiment_catalog.md](./06_experiment_catalog.md)가, 부하 모양은 [05_load_scenarios.md](./05_load_scenarios.md)가 갖는다. 전역 불변식 "측정 기록"(4요소 병기 · 3회 중앙값 · 편차 초과 폐기)의 기준 값이 여기 있다.

**규칙의 목적은 하나다 — 3주 뒤의 자기 수치를 믿을 수 있게 한다.** 이 머신은 P · E 코어 혼합과 WSL2 vCPU 매핑 불확실성 때문에 같은 실험도 실행마다 흔들리고(원본 implementation_plan.md §2.4), 한 번의 수치는 재현되지 않는다. 조건을 잃은 수치는 사후에 복원할 수 없다 — 그래서 기록은 실행 시점에 조건과 함께 고정되고 사후에 고치지 않는다.

**docs/measurements는 린트 대상 밖이지만 형식은 이 문서가 고정한다.** 기록 파일은 설계 정본이 아니라 실측 파일이다(docs_plan 보정 #3). 그러나 EXP-PERF의 규모 곡선 · 역전 구간을 Next.js BFF가 이 파일에서 읽으므로 기계 판독 블록의 모양은 계약이다 — 형식을 어긴 기록은 화면에서 빠지고 "판독 불가 기록"으로 세어진다.

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
- **격자 2차의 적재 · 정밀화 절차 사실(W6 리드 판정 5 · 기록 048~053).** 적재는 미래 방향 누적이다 — 시작 S = KST 자정 − 50,020초로 고정하고(ADR-27 전 파티션 경계 기준의 기록 048~053 사실 — 이후 러너는 파티션 경계 UTC 자정 − 50,020초로 바꾼다 · 구현 목록 [../11_glossary/05_units_and_time.md](../11_glossary/05_units_and_time.md) §DB 시간대 전환 구현 목록 #21) 점 p의 데이터를 [S, S + D_p)로 채우며 쿼리 {end} = S + D_p다. 교차 구간 (10^a, 10^(a+1)]은 적응형 로그 이분 2회로 좁힌다(m1 = 10^(a+1/2) · m2 = 역전이 든 반쪽의 로그 중점 10^(a+1/4) 또는 10^(a+3/4)). 가장 오래된 일 파티션의 머리 만료는 S + 7일이고 적재 시간 예산의 끝이다([06_experiment_catalog.md](./06_experiment_catalog.md) §대조 실험 조정값). 데이터 끝을 고정하고 과거로 채운 1차(기록 035~039 · discarded)는 파티션 물리 순서가 시간과 어긋나 PostgreSQL이 BRIN 대신 Seq Scan을 골랐다(기록 039 · 구조 사실) — 방향은 설계 정본 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §역전 지점 탐색 설계가 갖는다.

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

### 역전 구간 — 우열 3/3 구조 판정

대조 격자(EXP-01~05)의 역전 구간은 쿼리 시간의 크기가 아니라 **반복마다의 우열 부호**로 정한다(W6 리드 판정 1 · 2 · 기록 053). 부호는 반복마다 하나씩 나오는 구조값이라 위 표의 구조 판정 규칙(3회 전부 성립 · 편차 폐기 적용 안 함)이 그대로 걸린다.

| 규칙 | 내용 | 어기면 |
|------|------|------|
| 반복별 부호 | 반복 하나의 우열은 그 반복의 pair(같은 점 · 쿼리 · 캐시에서 ClickHouse 대 PostgreSQL 변형)로 정한다 — pair가 동률(tieWithinResolution — ClickHouse client 중앙값 < 10 ms이고 두 저장소 client 중앙값 차 < 1 ms)이면 **서버 µs 중앙값**, 아니면 **client 중앙값**의 부호 | 점 단위 동률로 정하면 한 반복의 동률이 세 반복 전부의 부호 원천을 바꾼다 · 동률 pair를 client로 가르면 ClickHouse client 1 ms 해상도 안의 차를 부호로 읽는다 |
| 우열 성립 | 반복 3회의 부호가 모두 같은 점만 우열을 갖는다 · 갈린 점은 **우열 미정** | 점 중앙값 하나로 정하면 반복 사이에 뒤집힌 점이 끝점이 되어 구간이 실제보다 좁게 적힌다 |
| 구간 끝점 | 우열이 정해진 점만 행 수 순서로 이어 앞선 쪽이 바뀐 이웃 두 점 사이를 (아래 점, 위 점]으로 적는다 · 바뀌지 않으면 "관측 범위 안 역전 없음"과 범위 · 우세 쪽을 적는다 | 우열 미정 점이 끝점이 된다 |
| PostgreSQL 쪽 | 더 빠른 변형으로 판정하고(기록 053에서는 Q1~Q3이 I2 · Q4 · Q5는 I1 · I2 모두 ClickHouse에 뒤진다) 변형별 판정을 함께 싣는다 | I1 대비 구간과 I2 대비 구간이 한 구간으로 섞인다 |
| 편차 폐기와의 관계 | 부호 판정에는 편차 폐기를 적용하지 않는다(§구조 판정과 분포 판정 표의 면제) — 기록이 편차 초과로 discarded여도 우열 3/3 구간은 구조 사실로 인용하고, 크기 수치(ms · 배수)는 인용하지 않는다(§기록 상태와 정정) | 서브 ms 값의 흔들림(아래 한계)이 역전 방향이 서 있는 구간까지 지운다 |

- 검산: 규칙 = **5**
- **동률 점의 서버 µs 판정은 PostgreSQL 쪽으로 기운다(serverTimeAsymmetry · 기록 053).** PostgreSQL 서버 값(pg_stat_statements total_exec_time)은 실행만 재고 계획 시간을 뺀다(track_planning off · 준비된 문장의 custom plan 계획도 빠진다). ClickHouse 서버 값(query_log 시작 ~ 끝 µs)은 파싱 · 분석 · 계획 · 결과 전송을 넣는다. 두 서버 값은 같은 구간이 아니므로 동률 점 판정을 인용할 때는 **client만으로 판정한 구간을 병기한다** — 기록 053에서 client 부호만 쓰면 콜드 Q1 · Q2 · Q3의 구간이 달라지고(재기동 직후 첫 실행의 계획 비용이 PostgreSQL client에만 잡힌다) 웜 구간은 같다. 구간 값은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §결과(쿼리별 역전 구간 — 구조 판정)가 인용한다. 같은 구간을 재는 계획 시간 병기는 §미확인 · 미설계 등재의 러너 보강이다.
- **B형 — 폐기 기록에서 구간이 서는 것은 폐기 규칙의 우회가 아니다.** 결론 — 편차 폐기는 크기의 대표값을 지키는 규칙이고 부호는 크기가 아니다. 반대 시나리오 — 부호에도 편차 폐기를 걸면 격자 2차 기록(048~053)은 점마다 서브 ms · 콜드 칸 몇 개가 기준을 넘어 전부 discarded이므로, 3회 모두 같은 방향으로 선 역전 구간을 영영 적을 수 없다. 파생 지침 — 구간을 올리는 문장은 "우열 3/3 구조 판정 · 기록 NNN · discarded"를 밝히고, 중앙값 기준 구간은 그 기록의 참고로만 둔다.

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

**4요소는 health 응답에서 복사한다 — 손으로 옮겨 적지 않는다.** 필드 정본은 [../07_api/10_metrics.md](../07_api/10_metrics.md) #1(run · switches)이며 두 실증 화면(EXP-PERF · EXP-FLOW)의 각주 툴팁이 같은 필드를 보인다.

| 칸 | 원천 | 값 형식 | 없으면 |
|------|------|------|------|
| 커밋 해시 | health run.commitHash | 문자열 | **인용 불가** — 4요소 누락 |
| 메모리 프로파일 | health run.memoryProfile · memoryLimitMb | 문자열 · 정수 | 상동 |
| 용량 티어 | health run.capacityTier | S · M · M+ · L | 상동 |
| 스위치 상태 | health switches 12종 전부의 value · impl | on · off · 정수(SW-07) · ingest · collector · stream · direct(SW-12) | 상동 |
| 주입 모드 | 실행 명령 | A · B · C · D · 없음 | 모드를 섞었는지 판정할 수 없다 |
| 센서 자동 생성 | health run.sensorAutogen — 실효값(게이트 × 역할 · [../07_api/10_metrics.md](../07_api/10_metrics.md)) | on · off | 수집기가 늘 싣는 배경 적재 위에서 잰 측정과 주입한 양만 흐른 측정이 한 조건으로 묶인다 — 2026-10-03 전 기록은 칸이 없다 |
| 관측 스택 | 기동 명령 | off(정밀 세션) · on(탐색 — 상대 비교용) | 절대값 인용 여부를 가를 수 없다 |
| 생성기 CPU | 호스트 도구 · 생성기 지표 | 실행 중 최대 사용률 | 포화 구간을 폐기할 수 없다(REQ-GEN-13) |
| CPU 배치 · 대조 메모리 | cpuset 표준 · 대조 동일화 · 대조 표준 메모리(ClickHouse 3.5 GB · PostgreSQL 3.5 GB — 정본 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)) | 이름 · 값 | 자원 배분 차이가 결과에 섞인다 |
| 시드 · 신호 프로파일 | 생성기 설정 | 정수 · 프로파일 이름 | 재현할 데이터가 없다 |
| 게이트 · SIM 주입 계획 | 기동 환경변수 · SIM_FAULT_PLAN | 켜짐 여부 · 계획 파일 경로 · 파일 해시 | 모드 C · 결측 원인을 가를 수 없다 · 같은 이름의 다른 계획을 가를 수 없다 |
| 압축 방식 | 기동 설정 | zstd · gzip | 캐시 · 전송 크기와 CPU 비용이 다른 두 조건이 한 기록으로 묶인다 |
| swap 사용 | 호스트 도구(WSL2) | 사용 여부 · 실험 중 최대 사용량 | 메모리 상한 초과가 지연 꼬리로 숨는다 |
| WSL 네트워킹 모드 | .wslconfig | mirrored · NAT | 루프백 경로 길이가 다른 지연이 비교된다([07_measurement_limits.md](./07_measurement_limits.md)) |
| 라이브 실행 없음 | 착수 전 확인 — gen_run_active{type} 전부 0 · GET /api/v1/runs/current의 run이 null이거나 status가 running · stopping이 아님 | 확인 여부 · 확인 시각 | 증거 화면의 라이브 실행(perf 쿼리 · flow 발행)이 저장소 · Stream에 부하를 더해 지연 · 처리량에 섞인다 — 동시 1은 실행끼리만 막고 실험은 모른다([../06_pipeline/10_datagen_inject.md](../06_pipeline/10_datagen_inject.md) §한 번에 한 계층) |

- 검산: 칸 = 4요소 4 + 부가 11 = **15**
- 환경변수 이름(MEMORY_PROFILE — load · dev · mid · CAPACITY_TIER · 빌드 인자 COMMIT_HASH · WORKER_POOL_SIZE · SIM_FAULT_PLAN)의 정본은 [../09_tech_stack/04_local_environment.md](../09_tech_stack/04_local_environment.md)다. health run의 memoryProfile 값은 MEMORY_PROFILE 값 그대로다.
- **스위치는 기계 판독 블록에서 12종 전부를 적는다**(기록 시점 스위치 정본의 전부 — SW-12 도입 전 기록은 11종이고 판독은 규칙 4가 맞춘다). 사람이 읽는 조건 표는 "바꾼 것만 명시 · 나머지 기본값"을 허용하지만(REQ-TEC-10), 기본값 자체가 바뀌면(스위치 기본값 변경 절차) 옛 기록의 "기본값"이 다른 조건을 가리킨다 — 블록은 값 전부를 싣는다.
- **health 값이 null이면 그 기록은 4요소가 빠진 기록이다.** 추정값으로 채우지 않는다 — null은 인용 불가 표지이고 BFF가 그 점을 그리지 않는다.
- **도구 컨테이너 경로의 memoryLimitMb null은 누락이 아니다(목적 적합성 W5 리드 판정 · 2026-09-27).** 측정 경로에 앱이 끼지 않는 실험(모드 D 격자 EXP-01~05 · EXP-35 · 역방향 EXP-40~44)은 api health가 없고 도구 컨테이너(datagen-d · oltp-lab)가 health와 같은 모양의 run을 낸다. 이 컨테이너에는 compose 메모리 상한이 없어 cgroup memory.max가 max이고 run의 memoryLimitMb가 null이다 — 이 null은 재지 못한 값이 아니라 상한이 없다는 사실값이다. 이 경우 블록 run에 선택 키 memoryLimitSource(문자열 — 예: cgroup max — datagen-d 서비스에 compose 상한 없음)를 함께 싣고, BFF는 memoryLimitSource가 공백이 아닌 문자열인 null을 4요소 충족으로 본다(빈 문자열 · 공백만이면 누락). 대조 저장소 상한(3,584 MB) 같은 다른 값으로 채우지 않는다 — 그 값은 저장소 컨테이너의 상한이지 측정 프로세스의 상한이 아니며, 저장소 자원은 conditions가 싣는다. api health 경로의 null은 위 불릿대로 누락이다.
- **러너는 흐름 구독 표지(cache:flow:subscribed) 부재를 확인한 뒤 측정 창을 연다(리드 판정 · 2026-09-28).** 표지가 있으면 워커가 배치 · 업무 명령마다 흐름 요약을 만들어 ch:flow로 발행해 flusher 후속 구간과 명령 적용 구간에 PUBLISH 비용이 섞인다 — EXP-FLOW를 닫고 표지 TTL이 지나 키가 사라진 것을 본 뒤 창을 연다([../07_api/11_websocket.md](../07_api/11_websocket.md) §흐름 이벤트 — flow).

## 조건 분리 강제

[../02_features/13_switch_matrix.md](../02_features/13_switch_matrix.md) 조합 제약을 실행 규칙으로 강제하는 자리다. 화면은 강제하지 않고(경고를 보이던 EXP-CONSOLE은 폐지 — D-14), 강제는 기록 판정이 한다.

| 규칙 | 판정 시점 | 위반 기록의 처리 |
|------|------|------|
| 주입 모드 하나 | 조건 칸 | 무효 — 병목 계층을 가를 수 없다 |
| 조합 제약 10건(#8 · #9 — SW-10 on · SW-11 collector는 모드 A 전용 · #10 — SW-12 stream은 worker 역할이 도는 구성 전용 포함) | 조건 칸의 스위치 · 모드 대조 | 무효 — 차이가 0으로 나와 "효과 없음"이 거짓으로 기록된다 |
| 비교는 대상 스위치 하나만 다르게 | 두 기록의 스위치 12종 대조(한쪽 기록에 없는 스위치는 도입 전 기본값으로 읽는다 — BFF 판독 규칙 4) | 비교 불성립 — 두 기록은 각각 유효하다 |
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
| run | 예 | health run 그대로 — 4요소 넷 + sensorAutogen(2026-10-03 전 기록은 넷 · 도구 컨테이너 경로의 run도 넷 — sensorAutogen은 api health에만 있다) | 4요소 툴팁 · 비교 성립 판정 |
| switches | 예 | 스위치 12종 전부(기록 시점 스위치 정본의 전부 — SW-12 도입 2026-09-27 전 기록은 11종) · health switches.*.value 그대로 — **스위치 비교 기록(on/off 두 팔)은 대상 스위치만 results의 arm 순서대로 값 배열**(예: ["on", "off"]) · 나머지는 스칼라 | 상동 |
| conditions | 예 | injectionMode · observability · cpuset · seed · generatorCpuMax · compression · swapUsed · wslNetworking · simFaultPlan(경로 · 해시 또는 null) 필수 · controlMemoryMb(대조 기록) · **EXP-45 기록은 flushWindowSeconds · copyTimeoutSeconds(초 · 판정 점 기준) · batchPlan · controlCopySyncCommit — 반복끼리 다르면 기록을 만들지 않는다** · 나머지 실험별 | 조건 분리 판정 · EXP-45 판정 점 기준 |
| repeat | 예 | runs · deviation · threshold | 폐기 판정 |
| results | 예(빈 배열 허용) | metric · arm · unit · values · median | 스위치 비교 기록 |
| points | 대조 기록만 | query · rows · stage · store · index · cache · unit · values · median · resultMatch | 역전 지점 선 차트 |
| axes | 대조 기록만 | axis(storage_bytes · compression_ratio · insert_rows_per_sec · write_amplification · index_bytes) · store · index · rows · value · unit | 비교 축 막대 |
| structuralRanges | 대조 기록 선택(EXP-01~05) | 행마다 query · cache · pgVariant · crossover · undetermined 필수 — crossover는 역전 구간 ["10^a", "10^b"] 또는 null · **crossover가 null일 때만** winner(postgresql · clickhouse)와 range(["10^a", "10^b"]) · undetermined는 우열 미정 점의 지수 표기 문자열 배열(빈 배열 허용) · from · to(역전 방향 — 역전 전 앞선 저장소 → 역전 뒤 앞선 저장소)는 선택 | EXP-PERF 쿼리 카드 · 규모 곡선 역전 구간 |
| reverse | 역방향 기록만(EXP-40~44) | exp · op · store · variant · scale · concurrency · rate · read · metric · unit · values · median · structural(구조 지표만 true) | 역방향 대조 해석 · 판독기는 structural true면 중앙값이 아니라 3회 전부를 본다 |
| streamSteps | EXP-45만 | pps · store · metric(insert_duration_seconds_p50 · _p95 · control_copy_seconds_p50 · _p95) · unit · values(반복 번호 순 · 계단 없음 · 그 저장소 무효 반복 자리 null) · median(값이 있는 반복 3 미만이면 null) · failures · valid(선택 — false면 판정 제외 계단) — failures는 반복 자리 단위(재기동 · 포화 반복 자리는 null) · 행 valid:false = 그 저장소 유효 반복 0(PostgreSQL은 실패 ≥ 1 반복도 유효 반복으로 센다 — 행 수가 어긋나도 실패는 사실이다) | 계단별 두 싱크 시간 · 판정 점 |

- 검산: 필드 행 = **12** — 필수 7 + 대조 기록 선택 3 + 역방향 · 스트리밍 선택 2
- **structuralRanges의 행 수 표기는 지수 문자열 "10^k"로 고정한다(k는 소수 허용 — 예: "10^7.25").** crossover는 반개구간 (a, b]이다 — a는 앞선 쪽이 바뀌기 전의 마지막 점, b는 바뀐 뒤의 첫 점이며 둘 다 우열이 정해진 점이다 — 사이의 우열 미정 점은 undetermined에 든다(§역전 구간 규칙). 역전이 없으면 crossover null에 winner와 range를 싣고, range는 우열이 정해진 점들의 관측 범위라 양 끝이 그 판정에 든다. 값은 반복별 부호의 우열 3/3 구조 판정(§역전 구간)이고 크기 수치를 싣지 않는다. 방향은 선택 필드 from · to가 갖는다 — 기록 053은 structuralRanges 행에 방향이 없고 crossovers 필드에만 있으므로, 판독기는 방향이 없어도 행을 받는다.
- **reverse · streamSteps를 더해도 schema는 measurement/v1이다(판정).** 판독 규칙 7이 모르는 필드를 무시하므로 필드 추가는 v1 판독기를 깨지 않는다 — 뜻을 바꾸거나 없앨 때만 v2로 올린다. points · axes · structuralRanges는 판독 규칙 6에 따라 EXP-01~05 전용이라 역방향 · 스트리밍 값을 싣지 않는다. 키의 뜻과 형식 예시의 정본은 [../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §EXP 연결 · 기계 판독 블록 제안이다(structuralRanges는 이 절이 정본).
- **비교 기록의 대상 스위치만 배열이다(S2 판정 · 기록 013).** 한 기록이 두 팔을 담으므로 대상 스위치의 값은 하나가 아니다 — 스칼라 하나를 적으면 다른 팔의 조건이 블록에서 사라지고, 두 기록으로 쪼개면 같은 복원 · 같은 반복 순서로 교대한 팔이 다른 기록이 되어 비교 성립 판정(나머지 10종 동일)을 블록 둘에 걸쳐 해야 한다. 판독기는 배열 값을 "이 스위치가 비교 대상"으로 읽고 BFF 규칙 4의 null 검사는 원소마다 한다. · axes의 axis 값 **5** + 쿼리 시간(points) 1 = 비교 축 **6**([../05_data_stores/10_olap_vs_rdb_control.md](../05_data_stores/10_olap_vs_rdb_control.md) §비교 축 6)

### BFF 판독 규칙

| # | 규칙 | 걸리면 |
|:--:|------|------|
| 1 | 파일명이 NNN-{slug}.md 모양이다 | 무시 — 기록 파일이 아니다 |
| 2 | schema가 measurement/v1인 json 블록이 정확히 1개다 | "판독 불가 기록"으로 센다 |
| 3 | status가 valid이고, 다른 valid 기록의 supersedes가 이 기록을 가리키지 않는다 | 제외 — 폐기 · 정정된 기록 |
| 4 | run 네 필드와 switches의 키 — **기록 시점 스위치 정본의 키 전부** — 가 null이 아니다 · SW-12 도입(2026-09-27) 전 기록은 SW-01~11 11키이며 SW-12 부재는 기본값 stream으로 읽는다 | 점을 그리지 않고 "4요소 누락"으로 센다 |
| 5 | repeat.runs ≥ 3이고 deviation ≤ threshold다 | 제외 — 폐기 기준 초과 |
| 6 | 역전 지점 패널은 exp에 EXP-01~05 중 하나가 있는 기록의 points만 쓴다 | 다른 실험의 점이 대조 선에 섞이지 않는다 |
| 7 | 모르는 필드는 무시한다 · 필드를 없애거나 뜻을 바꾸면 schema를 measurement/v2로 올린다 | v1 판독기가 새 기록을 조용히 잘못 읽는다 |

- 검산: 규칙 = **7**
- **structuralRanges는 구조 판정이라 규칙 3의 valid 조건 · 규칙 5(편차)를 적용하지 않는다.** 규칙 3은 status 조건(valid)만 적용하지 않는다 — superseded(status superseded 또는 다른 valid 기록의 supersedes 대상)는 원천에서 뺀다. 규칙 4(4요소 — memoryLimitMb null은 memoryLimitSource로 충족)는 적용하고, exp에 EXP-01~05가 있고 structuralRanges 배열을 가진 판독 가능 기록 가운데 **기록 번호가 가장 큰 하나만** 쓴다(여러 기록의 구간을 섞지 않는다). 형식이 어긋난 행은 빼고 센다 — 표시 계약은 [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §대조군 역전 지점이다.
- **판독 불가 · 4요소 누락은 세어 보인다.** 조용히 빼면 역전 지점이 측정 누락 위에 그려진다([../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) §대조군 역전 지점).
- BFF는 읽기만 한다 — 기록을 만들거나 고치는 경로는 화면에 없다. 기록의 정본성은 파일이 커밋 해시와 함께 git에 남는 데서 온다.

## 기록 상태와 정정

| 상태 | 뜻 | 파일 | 정본 인용 |
|------|------|------|------|
| valid | 3회 · 편차 이내 · 4요소 완비 · 조건 분리 준수 | 그대로 | 가능 |
| discarded | 편차 초과 · 조건 위반 · 생성기 포화 | 그대로 남긴다 | **크기 수치 불가** · 구조 사실과 결정적 값만 가능(아래 불릿) |
| superseded | 뒤 기록이 supersedes로 가리킨 기록 | **고치지 않는다** — 뒤 기록이 정정한다 | 불가 · 뒤 기록을 인용 |

- 검산: 상태 = **3**
- **구조 사실 판별 기록(api 부재 단계)** — health가 없는 단계(S0)의 판별 · 회귀 기록은 run의 티어 · switches를 null로 두고 status valid로 쓴다. 4요소가 비었으므로 수치는 인용하지 않고, 정본에는 구조 사실(동작 여부 · 1계층 개수 · 설정 채택 근거)만 올린다. BFF 규칙 4는 그대로 적용해 "4요소 누락"으로 센다. 기계 판독 블록 conditions에 recordKind structural-discrimination을 적는다.
- **폐기 기록의 인용 규칙(W6 리드 판정 · 기록 047 · 048~053).** discarded 기록에서 정본 문장에 올릴 수 있는 것은 두 종류다. ① **구조 사실** — 우열 3/3(§역전 구간) · 인덱스 선택 · 계획 노드 · 읽은 행 · 블록 수 · 결과 일치 · 원자성 · 제약 판정처럼 3회 전부 같은 값으로 성립한 판정. ② **결정적 값** — 반복 대상이 아닌 단계당 1회 측정 · 채움 1회의 산출이다 — 비 쿼리 축의 저장 바이트 · 압축률 · 인덱스 바이트 · WAL 바이트와 행 · 파트 수. 결정적 값을 올릴 때는 "결정적 값 · 기록 NNN · discarded"를 밝힌다. **ms · 배수 · 처리량 같은 크기 수치는 참고로도 정본 문장에 넣지 않고 기록 번호만 가리킨다** — 삽입 처리량(행/s)은 비 쿼리 축이지만 시간을 재는 값이라 이 금지에 든다(쿼리 시간과 같은 실행 분산을 탄다). 이 규칙은 정본 문장의 인용 범위이고 BFF 판독 규칙 3은 바뀌지 않는다 — 화면은 discarded 기록을 그대로 뺀다.
- **예외 — 화면의 참고값 표시(리드 판정 1 · 2026-09-27).** EXP-PERF는 discarded 격자 기록의 크기 수치(ms · 배수)를 **표시만** 한다 — 각주 고정 문구("걸린 시간은 참고용 · 누가 이기는지는 3번 모두 같을 때만")와 툴팁 문구 "참고값 — 편차 기준 초과(구조 판정만 정본)"가 필수이고(D-15 — 점선 · 회색 · 최소~최대 막대 대체), 화면 값은 정본 문장에 인용하지 않으며, 역전 구간은 structuralRanges(구조 판정)만 쓴다(판독 규칙 3 · 5의 대체는 [../08_screen/08_evidence_screens.md](../08_screen/08_evidence_screens.md) §판독 규칙).
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

- **①의 예외는 discarded 기록의 구조 사실 · 결정적 값이다(§기록 상태와 정정).** ③의 형식은 "구조 사실(기록 NNN · discarded · 우열 3/3)" 또는 "값(결정적 값 · 기록 NNN · discarded · 4요소)"이다.
- **③에서 4요소 중 스위치는 변경분만 적는다.** 전수는 기록 번호가 가리키는 블록에 있다 — 정본 문서 본문이 12종을 반복하지 않는다.
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
| 콜드 반복 방식 | **검토 과제(W6)** — 격자 콜드는 반복마다 컨테이너 재기동 직후 1회 실행이라 편차 초과의 다수가 콜드 칸이고 그중 다수가 첫 반복이다(기록 053 — 초과 39 중 콜드 21 · 그중 반복 1이 가장 큰 칸 16) · 콜드 표본 수 · 재기동 단위 · 첫 반복 처리를 측정 전에 정한다 | 이 문서 §반복과 폐기 · [07_measurement_limits.md](./07_measurement_limits.md) §공정성 · 측정 한계 |
| 서버 µs 값의 절대 차 하한 | **검토 과제(W6)** — 편차 기준은 상대값(20%)이라 수십 µs 서버 값은 µs 단위 흔들림으로 기준을 넘는다(기록 048 · 053의 수십 µs 서버 기준 초과 칸) · 상대 기준에 절대 차 하한을 둘지와 그 값은 측정 전에 정한다(측정을 본 뒤 기준을 바꾸지 않는다) | 이 문서 §조정값 — 조회 계약 |
| 격자 러너 보강 | 미설계(W6 등재 · 기록 053 정본 반영) — ⓪ pg_stats ts 상관 채취 ① PostgreSQL 계획 시간 병기(track_planning 또는 계획 계측 — 동률 점 서버 비교를 같은 구간으로) ② match가 점당 두 번 도는 경로 확인 ③ restore 줄에 대상 정밀화 점 필드 | 러너 scripts/lab/s5/grid — 코드 착수 항목 |

## 관련 문서

- [06_experiment_catalog.md](./06_experiment_catalog.md) — 실험 전수 · 기록 slug
- [05_load_scenarios.md](./05_load_scenarios.md) — 부하 모양 · 생성기 포화 판정
- [../07_api/10_metrics.md](../07_api/10_metrics.md) — health run · switches 필드
- [../08_screen/07_experiment_console.md](../08_screen/07_experiment_console.md) — 기록 조건 블록 · 역전 지점 표시 계약
- [../04_architecture/03_execution_topology.md](../04_architecture/03_execution_topology.md) — 스냅샷 · 복원 · cpuset
- [../11_glossary/04_id_conventions.md](../11_glossary/04_id_conventions.md) — 측정 기록 파일명
- [../03_requirements/13_nonfunctional.md](../03_requirements/13_nonfunctional.md) — REQ-TEC-08~13
