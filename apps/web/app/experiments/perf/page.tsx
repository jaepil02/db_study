import { PerfScreen } from '../../../components/experiments/perf/perf-screen';
import { parsePerfParams } from '../../../lib/perf';

// EXP-PERF — 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF
// 진입 파라미터 q(Q1~Q5 · 기본 Q2) · cache(warm · cold · 기본 warm) — 딥링크는 이 두 값으로 곡선 · 결론 카드가 열린다
export default async function PerfPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; cache?: string | string[] }>;
}) {
  const { query, cache } = parsePerfParams(await searchParams);
  return <PerfScreen initialQuery={query} initialCache={cache} />;
}
