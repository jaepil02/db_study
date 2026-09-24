// BFF — GET /api/v1/health 중계(EXP-CONSOLE). 200 · 503 모두 같은 본문을 그대로 넘긴다(REQ-OBS-09 — 503은 에러 봉투가 아니다).
import { NO_STORE, serverApiBase, unreachable } from '../../../lib/bff';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/health`, { cache: 'no-store' });
  } catch {
    return unreachable();
  }
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
