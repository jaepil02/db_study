// BFF — 라이브 실행 제어 중계(07_api/09 #2~#5 · 07_api/01 §BFF 경유와 직결 라이브 실행 제어 행). 브라우저 /bff/runs/{path} → api /api/v1/runs/{path}
// 전부 no-store — 실행 상태는 api 인스턴스 메모리의 순간값이라 사본을 두면 종결된 실행이 running으로 남아 시작 버튼이 잠긴다.
// 경로가 없는 시작(POST /bff/runs)까지 받으려고 선택적 catch-all이다. runId 형식(UUID) 판정은 api가 한다(400). 받은 상태 · 본문을 그대로 넘긴다.
import { NO_STORE, serverApiBase, unreachable } from '../../../../lib/bff';

/** 중계를 허용하는 경로 — 시작 · 현재 · 단건 · 중단 */
const ALLOWED: readonly { method: string; re: RegExp }[] = [
  { method: 'POST', re: /^$/ },
  { method: 'GET', re: /^current$/ },
  { method: 'GET', re: /^[\w-]+$/ },
  { method: 'POST', re: /^[\w-]+\/stop$/ },
];

type Ctx = { params: Promise<{ path?: string[] }> };

async function relay(req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const joined = (path ?? []).join('/');
  if (!ALLOWED.some((a) => a.method === req.method && a.re.test(joined)))
    return Response.json(
      { error: { code: 'common.not_found', message: 'BFF 중계 대상이 아니다' } },
      { status: 404, headers: NO_STORE },
    );
  const body = req.method === 'POST' ? await req.text() : '';
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/runs${joined ? `/${joined}` : ''}`, {
      method: req.method,
      cache: 'no-store',
      ...(body ? { headers: { 'content-type': 'application/json' }, body } : {}),
    });
  } catch {
    return unreachable();
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = relay;
export const POST = relay;
