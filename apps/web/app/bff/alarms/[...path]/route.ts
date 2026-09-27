// BFF — 알람 표면 중계(07_api/07 #1~#5 · 07_api/01 §BFF 경유와 직결). 브라우저 /bff/alarms/{path} → api /api/v1/alarms/{path}
// 전부 no-store — 서버 층은 Redis 하나여야 staleTime 관계식이 성립하고, 확인 직후 목록이 BFF 사본이면 확인한 알람이 미확인으로 남는다(08_screen/01).
// 판정 이력 분석(#6 evaluations)은 직결이라 여기서 중계하지 않는다. 받은 상태 · 본문을 그대로 넘긴다(에러 봉투 포함).
// 쓰기(확인 · 규칙 등록 · 수정)는 Idempotency-Key를 양방향으로 싣는다(07_api/01 §업무 쓰기 경로) — no-store라 ⑤ 자리가 없다.
import { NO_STORE, serverApiBase, unreachable } from '../../../../lib/bff';
import { IDEMPOTENCY_HEADER } from '../../../../lib/shared';

/** 중계를 허용하는 경로 — 이벤트 목록 · 확인 · 규칙 목록 · 등록 · 수정 */
const ALLOWED: readonly { method: string; re: RegExp }[] = [
  { method: 'GET', re: /^events$/ },
  { method: 'POST', re: /^events\/\d+\/ack$/ },
  { method: 'GET', re: /^rules$/ },
  { method: 'POST', re: /^rules$/ },
  { method: 'PATCH', re: /^rules\/\d+$/ },
];

type Ctx = { params: Promise<{ path: string[] }> };

async function target(ctx: Ctx, req: Request): Promise<string | null> {
  const { path } = await ctx.params;
  const joined = path.join('/');
  if (!ALLOWED.some((a) => a.method === req.method && a.re.test(joined))) return null;
  return `${serverApiBase()}/api/v1/alarms/${joined}${new URL(req.url).search}`;
}

const notFound = () =>
  Response.json(
    { error: { code: 'common.not_found', message: 'BFF 중계 대상이 아니다' } },
    { status: 404, headers: NO_STORE },
  );

async function relay(req: Request, ctx: Ctx): Promise<Response> {
  const url = await target(ctx, req);
  if (!url) return notFound();
  // 확인(#2)은 본문 없음 — 빈 본문에는 content-type을 달지 않는다(빈 JSON 해석 400을 피한다)
  const body = req.method === 'GET' ? '' : await req.text();
  const key = req.method === 'GET' ? null : req.headers.get(IDEMPOTENCY_HEADER);
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  if (key) headers[IDEMPOTENCY_HEADER] = key;
  let res: Response;
  try {
    res = await fetch(url, { method: req.method, cache: 'no-store', headers, ...(body ? { body } : {}) });
  } catch {
    return unreachable();
  }
  const echoed = res.headers.get(IDEMPOTENCY_HEADER);
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      ...NO_STORE,
      'content-type': res.headers.get('content-type') ?? 'application/json',
      ...(echoed ? { [IDEMPOTENCY_HEADER]: echoed } : {}),
    },
  });
}

export const GET = relay;
export const POST = relay;
export const PATCH = relay;
