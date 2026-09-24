// BFF — GET /metrics 텍스트를 서버에서 해석해 S2 3계열 요약만 내린다(08_screen/01 — 브라우저가 텍스트 전체를 받아 파싱하지 않는다).
// 응답 모양은 웹 내부 계약(08_screen/07 §미확인 등재) — fetchedAt(epoch ms) + summary.
import { NO_STORE, serverApiBase, unreachable } from '../../../lib/bff';
import { parsePrometheusText, summarizeS2 } from '../../../lib/metrics-parser';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${serverApiBase()}/metrics`, { cache: 'no-store' });
  } catch {
    return unreachable();
  }
  if (!res.ok) {
    return Response.json(
      { error: { message: `api /metrics HTTP ${res.status}` } },
      { status: 502, headers: NO_STORE },
    );
  }
  const fetchedAt = Date.now();
  const summary = summarizeS2(parsePrometheusText(await res.text()));
  return Response.json({ fetchedAt, summary }, { headers: NO_STORE });
}
