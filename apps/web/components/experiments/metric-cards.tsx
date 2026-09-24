// 메트릭 요약 카드 — S2 3계열(컨슈머 랙 · E2E · 생성기 pps). 가장 중요한 단일 지표(컨슈머 랙)를 첫 자리에 둔다.
// 화면 수치는 순간값이며 4요소가 없다 — 측정 기록이 아니다(08_screen/07).
import type { ReactNode } from 'react';
import type { MetricsSummary } from '../../lib/metrics-parser';
import { formatKst } from '../../lib/time';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';

const NOT_YET = '이 단계에서 아직 계측하지 않는다';

function ms(sec: number | null): string {
  return sec === null ? '—' : `${(sec * 1000).toFixed(1)} ms`;
}

function MetricCard({
  title,
  fetchedAt,
  children,
}: {
  title: string;
  fetchedAt: number | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl tabular-nums">{children}</CardContent>
      <CardFooter>
        {fetchedAt === null ? '—' : `조회 ${formatKst(fetchedAt, true)}`} · 순간값 · 4요소 없음 — 기록 정본
        아님
      </CardFooter>
    </Card>
  );
}

export function MetricCards({
  summary,
  fetchedAt,
  genPps,
  failed,
  lastSuccessAt,
}: {
  summary: MetricsSummary | null;
  fetchedAt: number | null;
  genPps: number | null;
  failed: boolean;
  lastSuccessAt: number;
}) {
  const pending = <div className="h-8 animate-pulse rounded bg-slate-100" />;
  const notYet = <span className="text-sm text-slate-500">{NOT_YET}</span>;
  return (
    <div className="flex flex-col gap-2">
      {failed && (
        <Band>
          메트릭을 읽지 못했다{lastSuccessAt > 0 && ` — 마지막 성공 ${formatKst(lastSuccessAt, true)}`}
        </Band>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="컨슈머 랙(consumer_lag)" fetchedAt={fetchedAt}>
          {summary === null
            ? pending
            : summary.consumerLag === null
              ? notYet
              : `${summary.consumerLag} 엔트리`}
        </MetricCard>
        <MetricCard title="E2E 지연(e2e_latency)" fetchedAt={fetchedAt}>
          {summary === null ? (
            pending
          ) : summary.e2e === null ? (
            notYet
          ) : (
            <div className="grid grid-cols-3 gap-2 text-base">
              <span>p50 {ms(summary.e2e.p50)}</span>
              <span>p95 {ms(summary.e2e.p95)}</span>
              <span>p99 {ms(summary.e2e.p99)}</span>
              {summary.e2e.rows !== null && (
                <span className="col-span-3 text-xs text-slate-500">창의 행 수 {summary.e2e.rows}</span>
              )}
            </div>
          )}
        </MetricCard>
        <MetricCard title="생성기 pps(모드 A)" fetchedAt={fetchedAt}>
          {summary === null ? (
            pending
          ) : summary.genPointsModeA === null ? (
            notYet
          ) : genPps === null ? (
            <span className="text-sm text-slate-500">다음 폴링에서 계산</span>
          ) : (
            `${Math.round(genPps).toLocaleString('ko-KR')} 점/초`
          )}
        </MetricCard>
      </div>
    </div>
  );
}
