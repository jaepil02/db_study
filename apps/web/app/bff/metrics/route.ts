// BFF — GET /metrics 텍스트를 서버에서 해석해 내린다(08_screen/01 — 브라우저가 텍스트 전체를 받아 파싱하지 않는다).
// 응답 모양은 웹 내부 계약(08_screen/07 §미확인 등재) — 기본은 fetchedAt(epoch ms) + summary(EXP-CONSOLE 순간 요약 · S5 확장 — 앱 · 파이프라인 · 저장소)
// · ?view=window는 fetchedAt + samples(EXP-COMPARE 창 계산용 누적 계열 · 히스토그램 버킷까지 — 요약만으로는 창 분위수를 못 낸다).
import { NO_STORE, serverApiBase, unreachable } from '../../../lib/bff';
import { WINDOW_METRIC_NAMES } from '../../../lib/compare';
import { parsePrometheusText, summarizeConsole } from '../../../lib/metrics-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
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
  if (new URL(req.url).searchParams.get('view') === 'window') {
    return Response.json(
      { fetchedAt, samples: samples.filter((s) => WINDOW_METRIC_NAMES.has(s.name)) },
      { headers: NO_STORE },
    );
  }
  const summary = summarizeConsole(samples);
  return Response.json({ fetchedAt, summary }, { headers: NO_STORE });
}
