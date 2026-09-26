'use client';
// DSH-REALTIME 태그 딥링크 — 정본 docs/08_screen/03_realtime_dashboard.md §진입("단일 태그 최신값으로 먼저 그리고 응답의 설비로 설비 전체 조회")
// 순서: GET /api/v1/realtime/tags/{id}(RLT-02) 1회 → 응답 meta.deviceId로 설비 전체 화면(RealtimeDashboard)을 붙인다.
// 단일 태그는 빈 키를 복원하지 않는다(07_api/06 §#2) — item null이면 "값 없음"으로 두고 설비 전체 조회(#1)가 복원한다.
// 503 common.postgres_unavailable은 태그 → 설비 해석 실패라 설비 화면으로 넘어갈 수 없다 — 백오프 재시도만 한다(시계열 조회로 대체하지 않는다).
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { directUrl, requestJson, retryOn503 } from '../../lib/api';
import { errorCode, errorText } from '../../lib/error-display';
import { clockOffsetMs, judgeFreshness, QUALITY_STALE } from '../../lib/latest';
import { LatestTagResponse, QUALITY } from '../../lib/shared';
import { formatKst } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { Button } from '../master/field';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RealtimeDashboard } from './dashboard';
import { isBadQuality, QualityCell } from './quality';

export function TagDeepLink({ tagId }: { tagId: number }) {
  const q = useQuery({
    queryKey: ['realtime', 'tag', tagId],
    queryFn: async () => {
      const r = await requestJson(directUrl(`/api/v1/realtime/tags/${tagId}`));
      const body = LatestTagResponse.parse(r.body);
      return { ...body, offsetMs: clockOffsetMs(body.meta.servedAt, r.receivedAt) };
    },
    // 진입 1회 — 이후 값은 설비 전체 화면의 WS 프레임이 갱신한다
    staleTime: Number.POSITIVE_INFINITY,
    retry: retryOn503,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const now = useNow(1000);
  const d = q.data;
  const item = d?.item ?? null;
  const code = errorCode(q.error);

  return (
    <div className="flex flex-col gap-4">
      <Card data-panel="tag-deep-link">
        <CardHeader>
          <CardTitle>
            태그 {tagId} 최신값{d ? ` — 설비 ${d.meta.deviceId}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {q.isError ? (
            <Band>
              {errorText(q.error)}
              {code === 'common.not_found' ? (
                <>
                  {' '}
                  —{' '}
                  <Link className="underline" href="/realtime">
                    실시간 화면으로 돌아가기
                  </Link>
                </>
              ) : null}
              {q.error && !q.isFetching && code !== 'common.not_found' ? (
                <span className="ml-2">
                  <Button variant="outline" onClick={() => q.refetch()}>
                    다시 시도
                  </Button>
                </span>
              ) : null}
            </Band>
          ) : null}
          {q.isPending ? <div className="h-10 animate-pulse rounded bg-slate-100" /> : null}
          {d && item === null ? (
            <p className="text-slate-500">
              이 태그의 최신값이 아직 없다 — 아래 설비 전체 조회가 빈 키를 복원하면 표에 나타난다
            </p>
          ) : null}
          {d && item ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium" title={item.tagCode ?? undefined}>
                {item.tagName ?? `tag ${item.tagId}`}
              </span>
              <span className="tabular-nums text-lg">
                {isBadQuality(item.quality)
                  ? '—'
                  : item.value.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}
                <span className="ml-1 text-sm text-slate-500">{item.unit ?? ''}</span>
                {item.quality === QUALITY.SIMULATED && (
                  <span className="ml-1 text-[10px] text-slate-400">SIM</span>
                )}
              </span>
              <QualityCell
                quality={item.quality}
                freshness={judgeFreshness(
                  { ts: item.ts, serverStale: item.quality === QUALITY_STALE },
                  item.staleAfterMs,
                  now,
                  d.offsetMs,
                )}
              />
              <span
                className="tabular-nums text-slate-600"
                title={`${formatKst(item.ts, true)} · epoch ${item.ts}`}
              >
                {formatKst(item.ts)}
              </span>
            </div>
          ) : null}
          {d ? (
            <p className="text-xs text-slate-500">
              진입 시점 단일 태그 값(원천 {d.meta.source}) · 이후 갱신은 아래 설비 전체 표 ·{' '}
              <Link className="text-blue-700 hover:underline" href={`/realtime/${d.meta.deviceId}`}>
                설비 {d.meta.deviceId} 화면으로
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
      {d ? <RealtimeDashboard key={d.meta.deviceId} deviceId={d.meta.deviceId} focusTagId={tagId} /> : null}
    </div>
  );
}
