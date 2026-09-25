import { Suspense } from 'react';
import { TrendAnalysis } from '../../components/trend/trend-analysis';

// ANL-TREND — 정본 docs/08_screen/04_trend_analysis.md (조건은 쿼리 문자열 — useSearchParams는 Suspense 경계 안)
export default function TrendPage() {
  return (
    <Suspense>
      <TrendAnalysis />
    </Suspense>
  );
}
