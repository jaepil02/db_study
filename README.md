# db_study

Redis, PostgreSQL, ClickHouse를 활용하여 대용량 PLC 데이터와 업무 데이터를 분리 처리하는 웹 구현.
배포하지 않고 로컬 머신에서만 실행한다. 목적은 서비스 운영이 아니라 폴리글랏 퍼시스턴스 구조의 부하·성능 특성을 측정하는 것이다.

## 기술 스택

| 계층 | 선택 | 실행 |
|---|---|---|
| 프론트엔드 | Next.js (App Router) + TypeScript | 호스트에서 `pnpm dev` → http://localhost:3001 |
| 백엔드 | NestJS 단일 애플리케이션 (API + Collector·PlcSim·Ingest·Alarm·DataGen·Metrics 모듈) | Docker 컨테이너 `api` → 127.0.0.1:3000 |
| OLTP | PostgreSQL 18 | Docker 컨테이너 `postgres` → 127.0.0.1:5432 |
| OLAP | ClickHouse 25.8 | Docker 컨테이너 `clickhouse` → 127.0.0.1:8123 |
| 버퍼·캐시 | Redis 8 (Stream + 캐시 + Pub/Sub, 단일 인스턴스) | Docker 컨테이너 `redis` → 127.0.0.1:6379 |
| 관측 (선택) | Prometheus + Grafana | `docker compose --profile observability up -d` |

Docker Compose로 컨테이너 4개(`api`, `postgres`, `clickhouse`, `redis`)를 올리고, Next.js 개발 서버는 호스트에서 따로 띄운다. 호스트 포트는 전부 `127.0.0.1`에만 바인드한다. 브라우저는 저빈도 요청을 Next.js Route Handler(BFF)를 거쳐 보내고, 고빈도 실시간 요청과 WebSocket은 api에 직접 접속한다.

## 문서

설계 문서는 [docs/README.md](docs/README.md)에서 시작한다. 12개 폴더(개요 · 기능 · 요구사항 · 아키텍처 · 저장소 · 데이터 흐름 · API · 화면 · 기술 스택 · 관측과 실험 · 용어 · 보안) 122개 문서로 구성되며, 문서 지도 · 고정 기준 · 읽는 순서는 docs/README.md가, 작성 규약은 [docs/CLAUDE.md](docs/CLAUDE.md)가 갖는다.

기존 설계서 4본(architecture.md · data_flow.md · tech_stack.md · implementation_plan.md)은 docs/로 흡수하고 삭제했다. 원문은 커밋 ff66a37에서 볼 수 있다.
