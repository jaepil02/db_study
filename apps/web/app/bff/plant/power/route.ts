// BFF — 설비 가동 스위치 중계(GET · POST /api/v1/plant/power · 계약 packages/shared/src/api/plant.ts PlantPower)
// 정본 docs/07_api/06_realtime.md #3 · #4 · docs/08_screen/10_lab_screen.md §공용 컨트롤(공용 컨트롤 PlantPowerSwitch가 부른다).
// 전부 no-store — 실행 중 상태(Redis ctl:plant:power)라 사본을 두면 다른 화면에서 바꾼 값이 늦게 보인다. 받은 상태 · 본문을 그대로 넘긴다.
// POST는 다른 출처면 403(lib/bff.ts rejectCrossOrigin) · Content-Type은 바꾸지 않는다(text/plain을 JSON으로 고쳐 넘기지 않는다 — 판정은 api).
import { NO_STORE, rejectCrossOrigin, relayBody, serverApiBase, unreachable } from '../../../../lib/bff';

export const dynamic = 'force-dynamic';

async function relay(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    const denied = rejectCrossOrigin(req);
    if (denied) return denied;
  }
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/plant/power`, {
      method: req.method,
      cache: 'no-store',
      ...(req.method === 'POST' ? await relayBody(req) : {}),
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
