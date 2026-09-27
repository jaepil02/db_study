// BFF — 명령 조회 중계(07_api/01 §명령 조회 표면 #1). 브라우저 /bff/commands/{cmdId} → api /api/v1/commands/{cmdId}
// no-store — 결과가 pending에서 applied로 바뀌는 표면이라 사본을 두면 폴링이 옛 pending을 계속 받는다(08_screen/01 §요청 경로 · 명령 조회 행).
// cmdId 형식(UUID) 판정은 api가 한다(400) — BFF는 경로 조각만 거른다. 받은 상태 · 본문을 그대로 넘긴다.
import { NO_STORE, serverApiBase, unreachable } from '../../../../lib/bff';

type Ctx = { params: Promise<{ cmdId: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { cmdId } = await ctx.params;
  if (!/^[\w-]+$/.test(cmdId))
    return Response.json(
      { error: { code: 'common.not_found', message: 'BFF 중계 대상이 아니다' } },
      { status: 404, headers: NO_STORE },
    );
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/commands/${cmdId}`, { cache: 'no-store' });
  } catch {
    return unreachable();
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
