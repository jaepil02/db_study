// BFF — GET /metrics 텍스트를 서버에서 해석해 내린다(08_screen/01 — 브라우저가 텍스트 전체를 받아 파싱하지 않는다).
// 응답 모양은 웹 내부 계약(08_screen/08_evidence_screens.md) — ?view=flow 하나뿐이다: fetchedAt(epoch ms) + flow(EXP-FLOW 흐름 보기 —
// 08_screen/08 §데이터 원천의 이름만 요약 · 초당 값은 화면이 두 응답의 차로). 다른 보기(옛 콘솔 요약 · 스위치 비교 창)는 화면 폐지 D-14로 걷었다 — 400.
import { NO_STORE, serverApiBase, unreachable } from '../../../lib/bff';
import { summarizeFlow } from '../../../lib/flow';
import { parsePrometheusText } from '../../../lib/metrics-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  if (new URL(req.url).searchParams.get('view') !== 'flow') {
    return Response.json(
      { error: { message: '지원하는 보기는 view=flow 하나다' } },
      { status: 400, headers: NO_STORE },
    );
  }
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
  const samples = parsePrometheusText(await res.text());
  return Response.json({ fetchedAt, flow: summarizeFlow(samples) }, { headers: NO_STORE });
}
