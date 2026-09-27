'use client';
// EXP-PERF — 규모별 성능 비교. 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF(기록 판독 요소 9 · 표시 계약 8 · 상태 4행 · 판독 P1~P6).
// 원천은 BFF 기록 읽기(/bff/measurements?view=perf — docs/measurements 읽기 전용)다. api 표면이 아니고 폴링하지 않는다(진입 · 새로고침 때만).
// 곡선 · 히트맵의 ms · 배수는 discarded 기록의 참고값이고, 역전 음영 · 결론 카드 · 히트맵 색은 structuralRanges · 점 단위 3/3 우열(정본)만 쓴다.
// 실행 패널(GEN-11)은 툴바 아래 — 라이브 실행(앱 경유 · 시연값)은 곡선에 라이브 계열 2로만 겹치고 음영 · 결론 카드 · 히트맵에 들어가지 않는다.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { TIMESERIES_GC_MS } from '../../../lib/config';
import { QUERY_LABELS } from '../../../lib/measurements';
import {
  curveLines,
  findRange,
  heatCells,
  PERF_CACHES,
  PERF_QUERIES,
  type PerfView,
  type PgVariant,
  undeterminedMarks,
} from '../../../lib/perf';
import { liveSeries, panelRun } from '../../../lib/runs';
import { formatKst } from '../../../lib/time';
import { cn } from '../../../lib/utils';
import { Button, Select } from '../../master/field';
import { RunPanel } from '../../runs/run-panel';
import { useCurrentRun } from '../../runs/use-run';
import { Band } from '../../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { EChart } from '../echart';
import { curveOption, heatmapOption } from './options';
import {
  CACHE_LABEL,
  ConclusionCard,
  ConditionPanel,
  CountsLine,
  curveHeadline,
  EMPTY_SOURCE,
  LiveResultTable,
  NO_STAGE,
  OBSERVATION_NOTE,
  PrincipleTable,
  REFERENCE_BADGE,
  StorageTable,
} from './panels';

export type PerfResponse = PerfView & { readAt: number };

async function fetchPerf(): Promise<PerfResponse> {
  const res = await fetch('/bff/measurements?view=perf', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PerfResponse;
}

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
  text,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  text?: (v: T) => string;
}) {
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">{label}</legend>
      <span className="text-slate-500">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn(
            'rounded border px-2 py-0.5',
            o === value
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
          )}
        >
          {text ? text(o) : o}
        </button>
      ))}
    </fieldset>
  );
}

const Skeleton = ({ className }: { className: string }) => (
  <div className={cn('animate-pulse rounded bg-slate-100', className)} />
);

export function PerfScreen({ initialQuery, initialCache }: { initialQuery: string; initialCache: string }) {
  const q = useQuery({
    queryKey: ['measurements', 'perf'],
    queryFn: fetchPerf,
    staleTime: 0,
    // 응답이 수백 KB(정밀화 180점 + 단계 30점 × 5)라 시계열과 같은 짧은 gcTime(09_tech_stack/01 §gcTime)
    gcTime: TIMESERIES_GC_MS,
    retry: false,
  });
  const d = q.data;
  const [query, setQuery] = useState(initialQuery);
  const [cache, setCache] = useState(initialCache);
  const [yLog, setYLog] = useState(true);
  const [variant, setVariant] = useState<PgVariant>('I2');
  const [scanExp, setScanExp] = useState<number | null>(null);

  // 딥링크 되쓰기 — 선택을 주소에 남겨 공유 · 새로고침이 같은 곡선 · 결론 카드로 열린다(렌더를 다시 일으키지 않게 replaceState)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    url.searchParams.set('cache', cache);
    window.history.replaceState(window.history.state, '', url);
  }, [query, cache]);

  const lines = useMemo(() => curveLines(d?.points ?? [], query, cache), [d, query, cache]);
  // 라이브 계열 — 이 화면 종류의 실행 결과만 · 툴바 캐시가 콜드면 숨긴다(라이브 실행은 웜만)
  const liveRun = panelRun(useCurrentRun().data, 'perf');
  const liveAll = useMemo(() => liveSeries(liveRun, query), [liveRun, query]);
  const hasLive = liveAll.ch.length + liveAll.pg.length > 0;
  const live = cache === 'warm' ? liveAll : undefined;
  const i2Range = useMemo(() => (d ? findRange(d.ranges, query, cache, 'I2') : undefined), [d, query, cache]);
  const undetermined = useMemo(() => (d ? undeterminedMarks(d, query, cache) : []), [d, query, cache]);
  const curveOpt = useMemo(
    () => curveOption({ lines, i2Range, undetermined, records: d?.records ?? [], yLog, live }),
    [lines, i2Range, undetermined, d, yLog, live],
  );
  const heat = useMemo(
    () => heatCells(d ?? { points: [], verdicts: [] }, cache, variant),
    [d, cache, variant],
  );
  const heatOpt = useMemo(
    () => heatmapOption(heat.exponents, heat.cells, PERF_QUERIES, variant),
    [heat, variant],
  );
  const scanExps = useMemo(() => (d?.scan ?? []).map((s) => s.exponent), [d]);
  const scanSel = scanExp !== null && scanExps.includes(scanExp) ? scanExp : (scanExps.at(-1) ?? null);

  const sourceLabel = d?.source
    ? `${d.source.record}${
        d.records.length > 1
          ? `(+${d.records
              .map((r) => r.record)
              .filter((r) => r !== d.source?.record)
              .join(' · ')})`
          : ''
      }`
    : '없음';
  const hasSource = !!d?.source;
  const hasPoints = lines.some((l) => l.points.length > 0) || (live !== undefined && hasLive);
  const dim = q.isFetching && d ? 'opacity-60 transition-opacity' : '';

  return (
    <div className="flex flex-col gap-3">
      {/* 툴바 — 쿼리 · 캐시 · 세로 축 · 원천 기록 · 판독 시각 · 새로고침 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
        <Toggle label="쿼리" value={query} options={PERF_QUERIES} onChange={setQuery} />
        <Toggle
          label="캐시"
          value={cache}
          options={PERF_CACHES}
          onChange={setCache}
          text={(c) => CACHE_LABEL[c] ?? c}
        />
        <Toggle
          label="세로"
          value={yLog ? 'log' : 'linear'}
          options={['log', 'linear'] as const}
          onChange={(v) => setYLog(v === 'log')}
          text={(v) => (v === 'log' ? '로그' : '선형')}
        />
        <span className="text-slate-500">
          원천 기록 <span className="text-slate-800">{sourceLabel}</span>
        </span>
        <span className="text-slate-500">
          판독 <span className="text-slate-800">{d ? formatKst(d.readAt, true) : '—'}</span>
        </span>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          새로고침
        </Button>
      </div>
      <RunPanel
        type="perf"
        result={(run) =>
          run.result && 'scales' in run.result ? <LiveResultTable result={run.result.scales} /> : null
        }
      />

      {/* 참고값 배지 — discarded 점이 하나라도 그려지면 한 자리(곡선 · 히트맵 · 결론 카드 전체에 걸린다) */}
      {d && d.discardedRecords.length > 0 ? (
        <Band tone="warning">
          ⚠ {REFERENCE_BADGE} · 기록 {d.discardedRecords.join(' · ')} discarded · 막대 = 반복 3회 최소~최대
        </Band>
      ) : !d && q.isPending ? (
        <Skeleton className="h-9 w-full" />
      ) : null}

      {q.isError ? (
        <Band>
          기록을 읽지 못했다 ({String(q.error)}){d ? ' — 앞서 판독한 결과를 그대로 보인다' : ''}
        </Band>
      ) : null}

      <div className={cn('grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]', dim)}>
        <Card>
          <CardHeader>
            <CardTitle>
              규모 곡선 — {QUERY_LABELS[query] ?? query} · {CACHE_LABEL[cache] ?? cache}
            </CardTitle>
            {d && hasSource ? (
              <p
                className={cn('text-xs', i2Range?.crossover ? 'font-medium text-red-700' : 'text-slate-600')}
              >
                {curveHeadline(i2Range)}
              </p>
            ) : null}
            {hasLive && cache !== 'warm' ? (
              <p className="text-xs text-slate-500">라이브 실행은 웜만 — 라이브 계열을 숨겼다</p>
            ) : null}
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-96 w-full" />
            ) : !hasSource ? (
              <p className="flex h-96 items-center justify-center text-sm text-slate-500">{EMPTY_SOURCE}</p>
            ) : hasPoints ? (
              <EChart option={curveOpt} className="h-96 w-full" />
            ) : (
              <p className="flex h-96 items-center justify-center text-sm text-slate-500">
                이 쿼리 · 캐시의 점이 없다
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              점 = client 중앙값(참고값) · 회색 점선 = discarded 기록 · 속이 빈 점 = 결과 불일치 · 음영 = 역전
              구간(I2 · 구조 판정 · 정본) · ? = 우열 미정 · Q5x(조건 없는 count)는 싣지 않는다
              {live && hasLive
                ? ' · 마름모(◇ CH · ◆ PG I2) = 라이브 실행(시연값 · 앱 경유 · 기록 정본 아님)'
                : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>결론 카드</CardTitle>
          </CardHeader>
          <CardContent>
            {!d ? (
              <Skeleton className="h-64 w-full" />
            ) : !hasSource ? (
              <p className="text-sm text-slate-500">{EMPTY_SOURCE}</p>
            ) : (
              <ConclusionCard view={d} query={query} cache={cache} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={dim}>
        <CardHeader>
          <CardTitle>배수 히트맵 — PG ÷ CH · {CACHE_LABEL[cache] ?? cache}</CardTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Toggle label="PG 변형" value={variant} options={['I2', 'I1'] as const} onChange={setVariant} />
            <span className="text-slate-500">
              칸 숫자 = 중앙값 배수(참고값 · 소수 1자리) · 칸 색 = 그 점의 3/3 우열(정본 — 빠른 쪽 저장소 색 ·
              짙을수록 배수가 크다) · ? = 우열 미정 · 캐시는 툴바를 따른다
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!d ? (
            <Skeleton className="h-80 w-full" />
          ) : !hasSource ? (
            <p className="flex h-40 items-center justify-center text-sm text-slate-500">{EMPTY_SOURCE}</p>
          ) : (
            <div style={{ height: `${Math.max(160, heat.exponents.length * 30 + 48)}px` }}>
              <EChart option={heatOpt} className="h-full w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={dim}>
        <CardHeader>
          <CardTitle>원리 증거 — 읽은 양 · 계획</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">규모</span>
            <Select
              value={scanSel === null ? '' : String(scanSel)}
              onChange={(e) => setScanExp(Number(e.target.value))}
              aria-label="원리 증거 규모"
              disabled={scanExps.length === 0}
              className="w-auto"
            >
              {scanExps.map((e) => (
                <option key={e} value={e}>
                  10^{e}
                </option>
              ))}
            </Select>
            <span className="text-slate-500">캐시 구분 없음 — 툴바 캐시를 적용하지 않는다</span>
          </div>
        </CardHeader>
        <CardContent>
          {!d ? (
            <TableSkeleton />
          ) : !hasSource || d.scan.length === 0 ? (
            <p className="text-xs text-slate-500">{hasSource ? NO_STAGE : EMPTY_SOURCE}</p>
          ) : (
            <PrincipleTable view={d} exponent={scanSel} />
          )}
        </CardContent>
      </Card>

      <Card className={dim}>
        <CardHeader>
          <CardTitle>저장 비용 — 결정적 값 · 단계 5</CardTitle>
        </CardHeader>
        <CardContent>
          {!d ? (
            <TableSkeleton />
          ) : !hasSource ? (
            <p className="text-xs text-slate-500">{EMPTY_SOURCE}</p>
          ) : (
            <StorageTable view={d} />
          )}
        </CardContent>
      </Card>

      {d?.source ? (
        <Card className={dim}>
          <CardHeader>
            <CardTitle>조건 표지</CardTitle>
          </CardHeader>
          <CardContent>
            <ConditionPanel view={d} />
          </CardContent>
        </Card>
      ) : null}

      {/* 판독 계수 줄 — 빈 값 ①에서도 보인다 */}
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        {d ? (
          <CountsLine view={d} yLog={yLog} />
        ) : (
          <p className="text-xs text-slate-500">판독 전 · {OBSERVATION_NOTE}</p>
        )}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-6 w-full rounded bg-slate-50" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
