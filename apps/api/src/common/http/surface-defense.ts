// 출처 방어 — CORS 단일 오리진 · Host 헤더 대조(정본 docs/12_security/03_api_surface_defense.md §CORS · 07_api/01 §출처 방어)
// WebSocket Origin 검증은 게이트웨이 핸드셰이크 뒤 4403으로 낸다(07_api/11) — 이 파일은 HTTP 쪽만.
import type { FastifyCorsOptions, FastifyCorsOptionsDelegate } from '@fastify/cors';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { validationFailed } from './api-error';

/** 허용 오리진 — http://localhost:13001 하나 · 와일드카드 금지(REQ-GLB-25 · 웹 포트 3001 → 13001 사용자 결정 2026-10-05) */
export const ALLOWED_ORIGINS = ['http://localhost:13001'] as const;

/** 허용 Host — localhost · 127.0.0.1(포트 포함) · 컨테이너 사이 호출의 서비스명 api(REQ-GLB-26 ③) */
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

/**
 * 상태를 바꾸는 POST의 본문 — Content-Type application/json + JSON 객체만 받는다(지침서 §5-4 보안 판정).
 * 무인증 표면(D-16)이라 다른 출처의 폼 POST · 본문 없는 단순 요청(사전 요청 없음)으로 지우기 · 설비 가동 · 실행이 돌 수 있었다 —
 * 브라우저는 다른 출처에 application/json을 사전 요청 없이 보내지 못하므로 이 검사가 그 길을 닫는다.
 * 대상: POST /api/v1/data/sensor/purge({}) · /api/v1/plant/power · /api/v1/runs · /api/v1/runs/{runId}/stop({}).
 * 어기면 400 common.validation_failed(header.content-type enum · body type).
 */
export function requireJsonBody(contentType: string | undefined, body: unknown): Record<string, unknown> {
  const mime = (contentType ?? '').split(';')[0]?.trim().toLowerCase();
  if (mime !== 'application/json') throw validationFailed([{ path: 'header.content-type', reason: 'enum' }]);
  if (body === null || typeof body !== 'object' || Array.isArray(body))
    throw validationFailed([{ path: 'body', reason: 'type' }]);
  return body as Record<string, unknown>;
}

/** 브라우저 직결 표면 — CORS 허용 헤더는 여기에만 붙는다(BFF 경유 표면에는 붙이지 않는다) */
const DIRECT_PREFIXES = ['/api/v1/realtime/', '/api/v1/timeseries/'];

export const corsDelegator: FastifyCorsOptionsDelegate = (req, cb) => {
  const url = req.url ?? '';
  const direct = DIRECT_PREFIXES.some((p) => url.startsWith(p));
  const opts: FastifyCorsOptions = direct
    ? {
        origin: [...ALLOWED_ORIGINS],
        methods: ['GET', 'POST'],
        // 무인증(D-16) — 요청 헤더는 Content-Type만 · 노출은 내보내기 파일 이름(Content-Disposition)만
        allowedHeaders: ['Content-Type'],
        exposedHeaders: ['Content-Disposition'],
        credentials: false,
      }
    : { origin: false };
  cb(null, opts);
};
