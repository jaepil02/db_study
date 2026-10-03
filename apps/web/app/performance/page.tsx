import { PerfScreen } from '../../components/experiments/perf/perf-screen';
import { parsePerfParams } from '../../lib/perf';

// EXP-PERF — 성능 비교 한 장 화면(설계 .omc/plans/web-junior-redesign.md §2 · 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF)
// 진입 파라미터는 q(Q1~Q5 · 기본 Q2) 하나 — 그림 1 · 2의 선택 질문
export default async function PerfPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { query } = parsePerfParams(await searchParams);
  return <PerfScreen initialQuery={query} />;
}
