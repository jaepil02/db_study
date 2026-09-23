# 12_security — 보안

> **대상**: db_study를 위협 관점에서 다시 읽는 리뷰 — 인증·인가 · 시크릿과 설정 · API 표면 방어 · 위협 모델 · 로컬 노출
> **작성일**: 2026-09-23
> **원천**: [../README.md](../README.md)(전역 불변식 — 로컬 전용) · 원본 architecture.md §2 · §11.2 · §18 · 원본 tech_stack.md §10.4 · 원본 implementation_plan.md §2.5(커밋 ff66a37)

"위협 관점에서 다시 읽으면"에 답하는 **리뷰 폴더**다. **아무것도 채번하지 않는다** — 인증 기능은 02_features가, 인증 계약은 03_requirements가, 에러 코드는 11_glossary가 채번하고, 이 폴더는 그것들을 위협 모델로 다시 읽어 잔여 위험을 등재한다.

**로컬 전용이라는 사실이 방어를 생략할 이유가 되지 않는다.** 네트워크 경계 방어는 범위 밖이지만 애플리케이션 계층 방어(인가 · 입력 검증 · CORS · 레이트 리밋 · Origin 검증)는 어디에 올리든 그대로 필요하며, 앞단 프록시가 없으므로 방어 지점은 NestJS 한 곳에 모인다.

## 파일 목차

| 파일 | 내용 | 이관 원본 | 웨이브 |
|------|------|----------|--------|
| [01_authn_authz.md](./01_authn_authz.md) | 액세스 JWT · 리프레시 불투명 토큰(Redis 저장 · 즉시 폐기) · 쿠키 속성 · 역할 기반 인가 · WebSocket 첫 메시지 인증 | architecture §11.2 · §18 | W7 |
| [02_secrets_config.md](./02_secrets_config.md) | .env 비커밋 · .env.example · Dictionary 전용 읽기 계정 · 부하 주입 표면 기본 비활성 · 백업 정책 | architecture §7.4 · §18 · tech_stack §10.3 | W7 |
| [03_api_surface_defense.md](./03_api_surface_defense.md) | CORS 단일 오리진 · 레이트 리밋(사용자·토큰 기준) · WebSocket Origin 검증 · 보안 헤더 · ClickHouse 파라미터 바인딩 · 조회 범위 강제 | architecture §11.2 · §18 · tech_stack §10.4 | W7 |
| [04_threat_model.md](./04_threat_model.md) | 자산 · 위협 · 통제 · **잔여 위험 등재** | 신설 | W7 |
| [05_local_exposure.md](./05_local_exposure.md) | 127.0.0.1 바인드 · 저장소 포트를 여는 이유와 안전장치 · PlcSim 루프백 · WSL2 mirrored의 함의 | tech_stack §10.4 · implementation_plan §2.5 · architecture §3 | W7 |

검산: 본문 5 + README 1 = **6**

## 고정 기준 (축약)

**전 문서 공통 고정 기준의 정본은 [../README.md](../README.md)다.**

| 항목 | 기준 |
|------|------|
| 채번 | **없음** — 리뷰 폴더 |
| 노출 | 호스트 포트 전부 127.0.0.1 바인드 · TLS 없음(http · ws) |
| 오리진 | CORS 허용 오리진 **1개**(웹 3001) · 와일드카드 금지 |
| 토큰 | 수명은 2계층 조정값 — 정본 [01_authn_authz.md](./01_authn_authz.md) |

## 관련 문서

- [../README.md](../README.md) — 전역 불변식
- [../07_api/README.md](../07_api/README.md) — 방어 대상 표면
- [../03_requirements/02_auth.md](../03_requirements/02_auth.md) — 인증 계약
