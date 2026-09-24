// 프로세스 하나의 메트릭 창구 — 이름 정본 docs/10_observability/01_metrics_catalog.md
// 각 도메인 모듈이 자기 카운터 · 히스토그램을 여기에 등록하고 OBS는 모으기만 한다(REQ-OBS-02).
// 창구는 프로세스당 /metrics 하나다(ADR-20) — 모듈마다 레지스트리를 두면 노출에서 빠지는 계열이 생긴다.
import { Registry } from 'prom-client';

export const appRegistry = new Registry();

/** 히스토그램 버킷(초) — 원본 목표 · 예상치 값을 경계로 포함한다(01_metrics §이름 규약 분위수 행) */
export const LATENCY_BUCKETS_SECONDS = [
  0.0005, 0.001, 0.003, 0.005, 0.008, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.25, 0.3, 0.4, 0.5,
  0.65, 1, 1.5, 2, 3, 5, 10,
];
