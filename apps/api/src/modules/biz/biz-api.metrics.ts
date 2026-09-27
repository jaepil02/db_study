// 업무 명령 — api 쪽 계측(정본 docs/10_observability/01_metrics_catalog.md biz 계열 · 02_instrumentation 업무 명령 대기 행)
// biz_command_seconds — XADD 직전부터 결과 수신 또는 대기 상한(5초)까지 · result 5값(unavailable은 대기가 없어 싣지 않는다)
// biz_commands_total — 계수 주체가 둘이다: api는 timeout(202를 낼 때) · unavailable(XADD 실패 — Redis 불가 503)만 센다(종결 4값은 워커).
import type { BizKind } from '@db-study/shared';
import { Histogram } from 'prom-client';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';
import { bizMetrics } from './biz.metrics';

export type BizWaitResult = 'applied' | 'rejected' | 'expired' | 'failed' | 'timeout';

export const bizCommandSeconds = new Histogram({
  name: 'biz_command_seconds',
  help: '업무 명령 api 대기 — XADD부터 결과 수신 또는 대기 상한까지(초)',
  labelNames: ['result'],
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: [appRegistry],
});

/** biz_commands_total은 워커 쪽(biz.metrics)이 한 번 등록한다 — 0 초기화(kind 14 × result 6)도 그쪽이 한다 */
const bizCommandsTotal = bizMetrics.commands;

export function observeBizWait(result: BizWaitResult, seconds: number): void {
  bizCommandSeconds.observe({ result }, seconds);
}

export function countBizApi(kind: BizKind, result: 'timeout' | 'unavailable'): void {
  bizCommandsTotal.inc({ kind, result });
}
