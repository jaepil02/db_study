// 관측 자체 계열 — 이름 정본 docs/10_observability/01_metrics_catalog.md(e2e_latency · obs_run_info · nodejs_eventloop_lag_p95_seconds)
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Gauge } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';
import type { AppConfig } from '../../config/app-config';

const reg = [appRegistry];

export const e2eLatency = new Gauge({
  name: 'e2e_latency',
  help: '최근 창 ingested_at − ts 분위수(초)',
  labelNames: ['quantile'],
  registers: reg,
});
export const e2eLatencyRows = new Gauge({
  name: 'e2e_latency_rows',
  help: '그 창의 행 수 — 0이면 게이지가 비었다',
  registers: reg,
});

/** prom-client 기본 메트릭에 p95가 없다 — 같은 계측기의 p95(REQ-NFR-15 · 확장 1단계 진입 조건) */
export function installEventLoopP95(): void {
  const h = monitorEventLoopDelay({ resolution: 10 });
  h.enable();
  new Gauge({
    name: 'nodejs_eventloop_lag_p95_seconds',
    help: '이벤트 루프 지연 p95 — 직전 스크레이프 이후',
    registers: reg,
    collect() {
      this.set(h.percentile(95) / 1e9);
      h.reset();
    },
  });
}

/** 측정 조건 3요소 — 기동 1값씩(프로세스 수명 동안 불변) */
export function installRunInfo(cfg: AppConfig): void {
  const g = new Gauge({
    name: 'obs_run_info',
    help: '측정 기록 4요소 중 스위치 밖 3요소',
    labelNames: ['commit_hash', 'memory_profile', 'capacity_tier'],
    registers: reg,
  });
  g.set(
    {
      commit_hash: cfg.commitHash ?? 'null',
      memory_profile: cfg.memoryProfile ?? 'null',
      capacity_tier: cfg.capacityTier ?? 'null',
    },
    1,
  );
}
