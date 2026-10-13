// BFF — HMI 개요 중계(GET /api/v1/plant/overview · 계약 packages/shared/src/api/plant.ts PlantOverview · ⑦ 화면이 1초마다 부른다)
// api 쪽이 BFF 경유 표면(CORS 없음 — apps/api/src/modules/plant/plant.controller.ts)이라 브라우저가 직접 부르지 않는다. 정본 docs/08_screen/11_hmi_screen.md §호출 표면 · 갱신.
// no-store — 지금 값(Redis rt:latest)과 설비 가동 상태의 순간값이라 사본을 두면 꺼진 설비가 가동으로 남는다. 받은 상태 · 본문을 그대로 넘긴다.
import { NO_STORE, serverApiBase, unreachable } from '../../../../lib/bff';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/plant/overview`, { cache: 'no-store' });
  } catch {
    return unreachable();
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
