// BFF — 쌓인 센서 데이터 현황 중계(GET /api/v1/data/sensor/stats · 계약 packages/shared/src/api/data.ts SensorDataStats)
// ⑤ 직접 비교 실험 머리 · 지우기 확인 창(PurgeButton)이 읽는다. no-store — 넣기 · 지우기 뒤 바로 달라진다.
import { NO_STORE, serverApiBase, unreachable } from '../../../../../lib/bff';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/api/v1/data/sensor/stats`, { cache: 'no-store' });
  } catch {
    return unreachable();
  }
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...NO_STORE, 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
