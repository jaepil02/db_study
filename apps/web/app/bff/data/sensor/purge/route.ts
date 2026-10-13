// BFF — 센서 데이터 지우기 중계(POST /api/v1/data/sensor/purge · 계약 packages/shared/src/api/data.ts SensorPurgeResult)
// 실행 중 · 설비 가동 중 · 대기줄 적체가 남으면 api가 409 data.purge_blocked(details.reason)를 준다 — 상태 · 본문을 그대로 넘기고 문구는 화면(PurgeButton)이 고른다.
// 다른 출처의 요청은 403(lib/bff.ts rejectCrossOrigin) · 본문(JSON {})과 Content-Type은 바꾸지 않고 넘긴다(api가 JSON 본문을 요구한다).
import { NO_STORE, rejectCrossOrigin, relayBody, serverApiBase, unreachable } from '../../../../../lib/bff';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  const denied = rejectCrossOrigin(req);
  if (denied) return denied;
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/data/sensor/purge`, {
      method: 'POST',
      cache: 'no-store',
      ...(await relayBody(req)),
    });
  } catch {
    return unreachable();
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
