// 라이브 실행 계측 — 정본 docs/10_observability/01_metrics_catalog.md gen_runs_total · gen_run_active · gen_points_generated_total{mode="run"}
// gen_runs_total은 종결 때 한 번만 센다(재기동이 끊은 실행은 어느 쪽에도 남지 않는다) · gen_run_active 두 type 합 ≤ 1(동시 1).
import type { RunStatus, RunType } from '@db-study/shared';
import { Counter, Gauge } from 'prom-client';
import { appRegistry } from '../../common/metrics/registry';

function counter<L extends string>(name: string, help: string, labelNames: L[]): Counter<L> {
  return (
    (appRegistry.getSingleMetric(name) as Counter<L> | undefined) ??
    new Counter({ name, help, labelNames, registers: [appRegistry] })
  );
}

export const genRunsTotal = counter('gen_runs_total', '라이브 실행 종결 수', ['type', 'status']);

export const genRunActive =
  (appRegistry.getSingleMetric('gen_run_active') as Gauge<'type'> | undefined) ??
  new Gauge({
    name: 'gen_run_active',
    help: '진행 중(running · stopping) 라이브 실행',
    labelNames: ['type'],
    registers: [appRegistry],
  });

export const runMetrics = {
  started(type: RunType): void {
    genRunActive.set({ type }, 1);
  },
  ended(type: RunType, status: RunStatus): void {
    genRunActive.set({ type }, 0);
    genRunsTotal.inc({ type, status });
  },
};
