// HTTP 계측(OBS-01) — 이름 정본 docs/10_observability/01_metrics_catalog.md §HTTP·WS
// route 레이블은 경로 틀(API 표면)이다 — 식별자가 든 실제 URL을 레이블로 두면 시계열이 요청 수만큼 는다(REQ-OBS-06).
import type { ErrorCode } from '@db-study/shared';
import type { FastifyInstance } from 'fastify';
import { Counter, Histogram } from 'prom-client';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../metrics/registry';

const duration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'API 지연',
  labelNames: ['route', 'method', 'code'],
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: [appRegistry],
});
const requests = new Counter({
  name: 'http_requests_total',
  help: '요청 수 · 상태 코드 분포',
  labelNames: ['route', 'method', 'code'],
  registers: [appRegistry],
});

const designedRejections = new Counter({
  name: 'http_designed_rejections_total',
  help: '설계된 거절(datagen.stream_full · common.rate_limited) — API 오류율의 차감항(REQ-NFR-11)',
  labelNames: ['route', 'error_code'],
  registers: [appRegistry],
});

/** 설계된 거절 코드 — 백프레셔 · 레이트 리밋이 의도대로 동작한 결과라 오류율에서 뺀다(01_metrics §파생 지표 API 오류율) */
export const DESIGNED_REJECTION_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'datagen.stream_full',
  'common.rate_limited',
]);

/** 설계 거절이면 센다 — route는 경로 틀(API 표면)이다 · 세었으면 true */
export function countDesignedRejection(route: string | undefined, code: ErrorCode): boolean {
  if (!DESIGNED_REJECTION_CODES.has(code)) return false;
  designedRejections.inc({ route: route ?? 'unmatched', error_code: code });
  return true;
}

export function installHttpMetrics(fastify: FastifyInstance): void {
  fastify.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? 'unmatched';
    const labels = { route, method: req.method, code: String(reply.statusCode) };
    duration.observe(labels, reply.elapsedTime / 1000);
    requests.inc(labels);
  });
}
