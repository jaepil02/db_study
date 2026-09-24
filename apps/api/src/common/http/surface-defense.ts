// 출처 방어 S2분 — CORS 단일 오리진 · Host 헤더 대조(정본 docs/12_security/03_api_surface_defense.md · 07_api/01 §인증 헤더와 출처 방어)
// WebSocket Origin 검증은 게이트웨이 핸드셰이크 뒤 4403으로 낸다(07_api/11) — 이 파일은 HTTP 쪽만.
import type { FastifyCorsOptions, FastifyCorsOptionsDelegate } from '@fastify/cors';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { validationFailed } from './api-error';

/** 허용 오리진 — http://localhost:3001 하나 · 와일드카드 금지(REQ-AUT-12) */
export const ALLOWED_ORIGINS = ['http://localhost:3001'] as const;

/** 허용 Host — localhost · 127.0.0.1(포트 포함) · 컨테이너 사이 호출의 서비스명 api(REQ-AUT-13 ③) */
const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', 'api']);

export function isAllowedHost(host: string | undefined): boolean {
  if (!host) return false;
  const m = /^([^:]+)(?::(\d{1,5}))?$/.exec(host.trim().toLowerCase());
  return !!m && ALLOWED_HOSTNAMES.has(m[1] ?? '');
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !!origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

/**
 * Host 대조 훅 — 밖이면 common.validation_failed/400(fields path header.host · reason enum).
 * Fastify 훅은 Nest 예외 필터 밖이라 봉투를 여기서 직접 낸다.
 */
export async function hostGuard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isAllowedHost(req.headers.host)) {
    const e = validationFailed([{ path: 'header.host', reason: 'enum' }]);
    await reply
      .code(e.status)
      .header('content-type', 'application/json; charset=utf-8')
      .send({ error: { code: e.code, message: e.message, details: e.details } });
  }
}

/** 브라우저 직결 표면 — CORS 허용 헤더는 여기에만 붙는다(BFF 경유 표면 · auth 표면에는 붙이지 않는다) */
const DIRECT_PREFIXES = ['/api/v1/realtime/', '/api/v1/timeseries/'];

export const corsDelegator: FastifyCorsOptionsDelegate = (req, cb) => {
  const url = req.url ?? '';
  const direct = DIRECT_PREFIXES.some((p) => url.startsWith(p));
  const opts: FastifyCorsOptions = direct
    ? {
        origin: [...ALLOWED_ORIGINS],
        methods: ['GET', 'POST'],
        allowedHeaders: ['Authorization', 'Content-Type'],
        exposedHeaders: [
          'RateLimit-Limit',
          'RateLimit-Remaining',
          'RateLimit-Reset',
          'Retry-After',
          'Content-Disposition',
        ],
        credentials: false,
      }
    : { origin: false };
  cb(null, opts);
};
