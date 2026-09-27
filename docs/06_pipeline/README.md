# 06_pipeline — 데이터 흐름

> **대상**: db_study의 데이터 흐름 10종 — 수집 · 적재 · 분기 · 조회 · 업무 CRUD · 알람 · 롤업 · 주입 · 백프레셔 · 데이터 계약
> **작성일**: 2026-09-23
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(사용자 요구 2026-09-28 · 리드 판정) — 파일 목차 10 행에 라이브 실행 두 종류(perf · flow) · 고정 기준 주입 모드 행에 라이브 실행이 주입 모드가 아님을 명시 — 흐름 · 주입 모드 수 불변
> **개정일**: 2026-09-28 — 라이브 실행 제어 반영(GEN-11 · 12) — 기능 참여 118 → **122**(F-02 · F-05 · F-09 — 정본 01_flow_inventory)
> **개정일**: 2026-09-28 — 웨이브 1 검수 반영 — 기능 참여 117 → **118**(F-05에 ALM-08 — 알람 확인의 적용은 명령 경로)
> **개정일**: 2026-09-28 — 업무 쓰기 Redis 경유 개정(사용자 결정 2026-09-27) — 고정 기준 축약 정책 ↔ 기전 대응 20 → **22**행(#21 업무 명령 원장 · #22 업무 명령 버퍼 · 결과) · 업무 쓰기 행 신설(명령 스트림 · 동기 응답) · 파일 목차 04 · 07 행 — 흐름 수 불변(명령 적용은 F-05)
> **개정일**: 2026-09-26 — 목적 적합성 실증 W1 — 고정 기준 축약 정책 ↔ 기전 대응 19 → **20**행(#20 업무 대조 테이블 — 계측물)
> **개정일**: 2026-09-24 — W4 완성판 — 12본 작성 완료 · 흐름 참여 · 정책 대응 · 최신값 조건부 쓰기를 고정 기준에 올린다
> **원천**: [../README.md](../README.md)(흐름 10 · 분기 3계층) · [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md)(분기 정책) · 원본 data_flow.md §1~§14 · §16 · 원본 architecture.md §9 · §10 · 원본 implementation_plan.md §7.1~§7.4(커밋 ff66a37)

"데이터가 어떻게 흐르고 갈라지는가"에 답하는 폴더다. **흐름 ID F-NN을 채번**하며 채번 자리는 [01_flow_inventory.md](./01_flow_inventory.md)다. 원본의 F1~F10은 F-01~F-10으로 옮긴다.

**학습 목표 ②의 실행 자리가 이 폴더에 있다.** [04_routing.md](./04_routing.md)는 흐름 번호를 갖지 않는 횡단 문서다 — 분기는 F-02(적재)와 F-05(업무 CRUD)와 F-06(알람)에 걸쳐 일어나므로 한 흐름에 속하지 않는다. 원본 시퀀스 다이어그램은 mermaid 3종 한정 규약에 따라 plain 펜스로 옮긴다.

## 파일 목차

| 파일 | 흐름 | 내용 | 이관 원본 | 웨이브 |
|------|------|------|----------|--------|
| [01_flow_inventory.md](./01_flow_inventory.md) | 전체 | **F-NN 채번 정본** — 흐름 10종 · 방향 · 주 경로 · 성격 · 목표 지연 · 전체 흐름도 · 흐름별 병목 후보 | data_flow §1 · §2 | W4 |
| [02_collect.md](./02_collect.md) | F-01 | PLC 수집 — 폴링 · 블록 병합 · 디코딩 · 품질 판정 · 데드밴드 · XADD · 스풀 | data_flow §3 | W4 |
| [03_ingest_batch.md](./03_ingest_batch.md) | F-02 | 배치 적재 — 소비 루프 · 배치 트리거 · 컨슈머 다중화 · 멱등 · 재시도 · DLQ · **배치 트리거 산술 보정** | data_flow §4 · architecture §9.1 · §9.2 · implementation_plan §7.1 | W4 |
| [04_routing.md](./04_routing.md) | 횡단 | ★★ **3계층 분기 기전 정본** — 어느 모듈이 어떤 판정으로 어느 저장소에 쓰는가 · 대조군 동시 적재(SW-09) · ③ 업무 쓰기의 명령 스트림 경로 | data_flow §2 · §8.2 · architecture §5 | W4 |
| [05_realtime_read.md](./05_realtime_read.md) | F-03 · F-07 | 최신값 조회 · 실시간 푸시 · 스로틀 · Pub/Sub 한계 · 재연결 | data_flow §5 · §9 | W4 |
| [06_timeseries_read.md](./06_timeseries_read.md) | F-04 | 시계열 이력 조회 · 해상도 자동 선택 · 캐시 TTL · 키 정규화 · 스탬피드 · 다운샘플 | data_flow §6 · architecture §10 | W4 |
| [07_business_crud.md](./07_business_crud.md) | F-05 | 업무 데이터 CRUD · **업무 명령 경로(stream:biz:cmd · 워커 직렬 적용 · 멱등 원장 · 동기 응답 · 202 pending · SW-12)** · BFF 경유 기준 · **캐시 무효화 체인 6단(BFF · 브라우저 포함)** | data_flow §7 · implementation_plan §7.4 | W4 |
| [08_alarm.md](./08_alarm.md) | F-06 | 알람 판정 · 디바운스 · 세 저장소 쓰기 · 부분 실패 규칙 · **배치 단위 상태 조회** | data_flow §8 · implementation_plan §7.3 | W4 |
| [09_rollup.md](./09_rollup.md) | F-08 | 롤업 집계 흐름 · 계층별 담당 조회 · 늦게 도착한 데이터 | data_flow §10 | W4 |
| [10_datagen_inject.md](./10_datagen_inject.md) | F-09 | 테스트 데이터 주입 · 모드 A~D · 한 번에 한 계층 원칙 · 부하 실행 절차 · **라이브 실행 perf · flow(증거 화면의 시작 · 중단 — 단계 · 취소 · 정리 · 생성 규칙)** | data_flow §11 | W4 |
| [11_backpressure_failure.md](./11_backpressure_failure.md) | F-10 | 백프레셔 전파 · 계층별 장애 대응 · ClickHouse 중단 복구 · 재빌드 영향 | data_flow §12 · architecture §17 | W4 |
| [12_data_contract.md](./12_data_contract.md) | 횡단 | 단계별 스키마(와이어 → 디코딩 → Stream → 행 → API) · 스키마 버전 필드 · 스풀 포맷 · 계약 변경 규칙 | data_flow §14 | W4 |

검산: 목록 1(01) + 흐름 문서 9(02 · 03 · 05~11) + 횡단 2(04 · 12) + README 1 = **13**. 흐름 수 검산 — 05가 둘을 담으므로 02 1 + 03 1 + 05 2 + 06 1 + 07 1 + 08 1 + 09 1 + 10 1 + 11 1 = **10**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 흐름 | **10종** F-01~F-10 — 01 수집 · 02 배치 적재 · 03 최신값 조회 · 04 시계열 조회 · 05 업무 CRUD · 06 알람 판정 · 07 실시간 푸시 · 08 롤업 · 09 테스트 데이터 주입 · 10 백프레셔와 장애 |
| 분기 계층 | **3계층** — 정책 [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) · 기전 [04_routing.md](./04_routing.md) |
| 주입 모드 | **4**(A Modbus 경유 · B Stream 직결 · C HTTP · D ClickHouse 직접) — 한 번에 하나의 계층만 부하를 준다 · 증거 화면의 라이브 실행(perf · flow)은 주입 모드가 아니라 시연이며 부하 · 대조 실험과 겹치지 않는다(정본 [10_datagen_inject.md](./10_datagen_inject.md)) |
| 흐름 참여 | 참여 도메인 10 + 불참 OBS 1 = **11** · 기능 참여 **122**(중복 허용 — 정본 [01_flow_inventory.md](./01_flow_inventory.md)) |
| 정책 ↔ 기전 대응 | [../04_architecture/04_storage_split.md](../04_architecture/04_storage_split.md) 목적지 22행 = [04_routing.md](./04_routing.md) 기전 자리 22 · 누락 0 |
| 업무 쓰기 | api가 stream:biz:cmd에 명령을 싣고 워커(grp:biz-writer · 소비자 1 · 직렬)가 PostgreSQL 트랜잭션으로 적용한다 — 응답은 커밋 결과를 받은 뒤(동기) · 멱등 원장 biz_command_log · 수집 스트림과 키 · 그룹을 공유하지 않는다. 정본 [07_business_crud.md](./07_business_crud.md) |
| 최신값 쓰기 | 모든 rt:latest 쓰기는 **필드 조건부 쓰기**(새 ts ≥ 저장 ts)다 — 컨슈머 간 순서 역전 · 복구 중 역전을 막는다. 쓰기 주체는 SW-11 |
| 도메인 공백 | **OBS는 어떤 흐름에도 참여하지 않는다** — 흐름을 계측할 뿐 데이터를 옮기지 않는다. AUT는 F-05의 BFF 경유(로그인 · 토큰 갱신)로 참여한다 |
| 조정값 | 배치 크기 · 플러시 주기 · 백오프 · 스로틀 창은 2계층 조정값이다. 흐름 문서는 값이 아니라 트리거 관계와 금지된 대체 동작을 쓴다 |

## 관련 문서

- [../README.md](../README.md) — 고정 기준
- [../04_architecture/README.md](../04_architecture/README.md) — 흐름을 강제하는 구조
- [../05_data_stores/README.md](../05_data_stores/README.md) — 흐름이 닿는 저장소
- [../10_observability/README.md](../10_observability/README.md) — 흐름 구간별 계측
