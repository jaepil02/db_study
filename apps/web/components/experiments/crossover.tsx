'use client';
// EXP-COMPARE 요소 5 — 대조군 역전 지점(EXP-01~05). 정본 08_screen/07 §대조군 역전 지점(계약 6: 대상 · 축 · 역전 표지 · 4요소 · 결과 동일성 · 비교 축).
// 원천은 BFF 기록 읽기(/bff/measurements — docs/measurements 읽기 전용)다. api 표면이 아니고, 이 화면은 폴링하지 않는다(진입 · 새로고침 때만).
// 화면 수치는 기록의 3회 중앙값을 그릴 뿐이다 — 역전 지점의 정본은 기록 파일이다.
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  AXIS_LABELS,
  type AxisEntry,
  type ControlPoint,
  type Crossover,
  findCrossover,
  formatRows,
  QUERY_LABELS,
  type ReadResult,
  type SeriesPoint,
  type Store,
  selectSeries,
} from '../../lib/measurements';
import { formatKst } from '../../lib/time';
import { Button, Select } from '../master/field';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { type ChartOption, EChart } from './echart';

const STORE_LABEL: Record<Store, string> = { postgresql: 'PostgreSQL 대조군', clickhouse: 'ClickHouse' };
const STORE_COLOR: Record<Store, string> = { postgresql: '#2563eb', clickhouse: '#d97706' };
const QUERIES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
const EMPTY = 'EXP-01~05 기록이 아직 없다';

async function fetchRecords(): Promise<ReadResult & { readAt: number }> {
  const res = await fetch('/bff/measurements', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ReadResult & { readAt: number };
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** 4요소 툴팁 줄 — 커밋 해시 · 메모리 프로파일 · 용량 티어 · 스위치 상태(11종 전부) */
function conditionLines(p: {
  record: string;
  run: ControlPoint['run'];
  switches: Record<string, unknown>;
}): string {
  const sw = Object.entries(p.switches)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`);
  return [
    `기록 ${esc(p.record)} · 커밋 ${esc(p.run.commitHash)}`,
    `프로파일 ${esc(p.run.memoryProfile)} · ${p.run.memoryLimitMb} MB · 티어 ${esc(p.run.capacityTier)}`,
    esc(sw.slice(0, 6).join(' · ')),
    esc(sw.slice(6).join(' · ')),
  ].join('<br/>');
}

function fmtMs(v: number): string {
  return v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
}

function crossoverText(c: Crossover): string {
  switch (c.kind) {
    case 'crossed':
      return `역전 — ${c.prevRows === null ? '' : `${formatRows(c.prevRows)}행까지 `}${
        c.before === 'tie' ? '같음' : `${STORE_LABEL[c.before]} 앞섬`
      } → ${formatRows(c.rows)}행에서 ${c.after === 'tie' ? '같아짐' : `${STORE_LABEL[c.after]} 앞섬`}`;
    case 'none':
      return `관측 범위 안에서 역전 없음 — 관측 최대 ${formatRows(c.maxRows)}행${
        c.leader === 'tie' ? '' : ` · 전 단계 ${STORE_LABEL[c.leader]} 앞섬`
      }`;
    default:
      return '두 저장소의 점이 함께 있는 용량 단계가 없다 — 역전을 판정할 수 없다';
  }
}

function lineOption(
  series: { postgresql: SeriesPoint[]; clickhouse: SeriesPoint[] },
  cross: Crossover,
  yLog: boolean,
): ChartOption {
  const stores: Store[] = ['postgresql', 'clickhouse'];
  return {
    animation: false,
    grid: { left: 64, right: 24, top: 40, bottom: 48 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || p.seriesIndex === undefined || p.dataIndex === undefined) return '';
        const store = stores[p.seriesIndex];
        const sp = store ? series[store][p.dataIndex] : undefined;
        if (!sp) return '';
        const pt = sp.point;
        const match =
          pt.resultMatch === null
            ? '결과 대조 기재 없음'
            : pt.resultMatch
              ? '결과 일치'
              : '결과 불일치(속이 빈 점)';
        return [
          `<b>${esc(STORE_LABEL[pt.store])}</b> · ${formatRows(pt.rows)}행${pt.stage === null ? '' : ` (단계 ${pt.stage})`}`,
          `${esc(pt.query)} · 변형 ${esc(pt.index ?? '없음')} · ${esc(pt.cache ?? '캐시 상태 없음')}`,
          `중앙값 ${fmtMs(pt.medianMs)} ms · 3회 ${pt.valuesMs.map(fmtMs).join(' · ')}`,
          match,
          conditionLines(pt),
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'log',
      logBase: 10,
      name: '적재 행 수',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: { formatter: (v: number) => formatRows(v) },
    },
    yAxis: {
      type: yLog ? 'log' : 'value',
      name: '쿼리 시간 중앙값(ms)',
      scale: !yLog,
    },
    series: stores.map((s) => ({
      name: STORE_LABEL[s],
      type: 'line' as const,
      color: STORE_COLOR[s],
      symbolSize: 9,
      data: series[s].map((sp) => ({
        value: [sp.rows, sp.medianMs],
        // 결과 불일치 점은 속이 빈 점(계약 "결과 동일성")
        symbol: sp.point.resultMatch === false ? 'emptyCircle' : 'circle',
      })),
      ...(s === 'postgresql' && cross.kind === 'crossed'
        ? {
            markLine: {
              symbol: 'none',
              silent: true,
              lineStyle: { type: 'dashed' as const, color: '#dc2626' },
              label: { formatter: `역전 ${formatRows(cross.rows)}행`, color: '#dc2626' },
              data: [{ xAxis: cross.rows }],
            },
          }
        : {}),
    })),
  };
}

function axisOption(entries: AxisEntry[]): ChartOption {
  const rows = [...new Set(entries.map((e) => e.rows))].sort((a, b) => a - b);
  const label = (e: AxisEntry) => `${STORE_LABEL[e.store]}${e.index ? ` ${e.index}` : ''}`;
  const groups = new Map<string, AxisEntry[]>();
  for (const e of entries) groups.set(label(e), [...(groups.get(label(e)) ?? []), e]);
  const keys = [...groups.keys()].sort();
  const unit = entries[0]?.unit ?? '';
  return {
    animation: false,
    grid: { left: 80, right: 24, top: 40, bottom: 40 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        if (!p || p.seriesIndex === undefined || p.dataIndex === undefined) return '';
        const key = keys[p.seriesIndex];
        const r = rows[p.dataIndex];
        const e = key ? groups.get(key)?.find((x) => x.rows === r) : undefined;
        if (!e) return '';
        return [
          `<b>${esc(label(e))}</b> · ${formatRows(e.rows)}행`,
          `${esc(AXIS_LABELS[e.axis] ?? e.axis)} ${e.value.toLocaleString('ko-KR')} ${esc(e.unit)}`,
          conditionLines(e),
        ].join('<br/>');
      },
    },
    xAxis: { type: 'category', data: rows.map((r) => `${formatRows(r)}행`) },
    yAxis: { type: 'value', name: unit },
    series: keys.map((k) => ({
      name: k,
      type: 'bar' as const,
      color: k.startsWith(STORE_LABEL.clickhouse)
        ? STORE_COLOR.clickhouse
        : k.endsWith('I2')
          ? '#93c5fd'
          : STORE_COLOR.postgresql,
      data: rows.map((r) => groups.get(k)?.find((x) => x.rows === r)?.value ?? null),
    })),
  };
}

function Counts({ d }: { d: ReadResult }) {
  const c = d.counts;
  return (
    <p className="text-xs text-slate-500">
      기록 파일 {c.files} · 대조 기록 {c.control} · 판독 불가 기록 {c.unreadable}
      {d.unreadableFiles.length > 0 ? ` (${d.unreadableFiles.join(' · ')})` : ''} · 4요소 누락{' '}
      {c.missingConditions} · 폐기 · 정정 제외 {c.excludedStatus} · 편차 기준 초과 제외 {c.excludedDeviation}{' '}
      · 형식이 어긋난 점 {c.invalidPoints}
      {c.duplicatePoints > 0 ? ` · 뒤 기록이 덮은 중복 점 ${c.duplicatePoints}` : ''}
    </p>
  );
}

export function CrossoverPanel() {
  const q = useQuery({
    queryKey: ['bff', 'measurements'],
    queryFn: fetchRecords,
    staleTime: 0,
    retry: false,
  });
  const d = q.data;
  const points = d?.points ?? [];
  const axes = d?.axes ?? [];

  const indexOptions = useMemo(
    () =>
      [
        ...new Set([
          'I1',
          'I2',
          ...points.filter((p) => p.store === 'postgresql' && p.index).map((p) => p.index as string),
        ]),
      ].sort(),
    [points],
  );
  const cacheOptions = useMemo(
    () =>
      [
        ...new Set(['cold', 'warm', ...points.map((p) => p.cache).filter((c): c is string => c !== null)]),
      ].sort(),
    [points],
  );
  const axisOptions = useMemo(() => [...new Set(axes.map((a) => a.axis))].sort(), [axes]);

  const [query, setQuery] = useState('Q1');
  const [index, setIndex] = useState('I1');
  const [cache, setCache] = useState('warm');
  const [yLog, setYLog] = useState(false);
  const [axisSel, setAxisSel] = useState<string | null>(null);
  const axis = axisSel && axisOptions.includes(axisSel) ? axisSel : (axisOptions[0] ?? null);

  const series = useMemo(() => selectSeries(points, { query, index, cache }), [points, query, index, cache]);
  const cross = useMemo(() => findCrossover(series.postgresql, series.clickhouse), [series]);
  const lineOpt = useMemo(() => lineOption(series, cross, yLog), [series, cross, yLog]);
  const axisEntries = useMemo(() => axes.filter((a) => a.axis === axis), [axes, axis]);
  const barOpt = useMemo(() => axisOption(axisEntries), [axisEntries]);

  const hasSelection = series.postgresql.length + series.clickhouse.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>대조군 역전 지점(EXP-01~05)</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select value={query} onChange={(e) => setQuery(e.target.value)} aria-label="쿼리">
            {QUERIES.map((k) => (
              <option key={k} value={k}>
                {QUERY_LABELS[k]} — 점 {points.filter((p) => p.query === k).length}
              </option>
            ))}
          </Select>
          <Select value={index} onChange={(e) => setIndex(e.target.value)} aria-label="인덱스 변형">
            {indexOptions.map((k) => (
              <option key={k} value={k}>
                PostgreSQL 변형 {k}
                {k === 'I1' ? ' (BRIN)' : k === 'I2' ? ' (BRIN + btree)' : ''}
              </option>
            ))}
          </Select>
          <Select value={cache} onChange={(e) => setCache(e.target.value)} aria-label="캐시 상태">
            {cacheOptions.map((k) => (
              <option key={k} value={k}>
                {k === 'cold' ? '콜드' : k === 'warm' ? '웜' : k}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={yLog} onChange={(e) => setYLog(e.target.checked)} />
            세로 로그 축
          </label>
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            새로고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {q.isError ? (
          <Band>
            기록을 읽지 못했다 ({String(q.error)})
            {q.dataUpdatedAt > 0 ? ' — 이전 판독 결과를 그대로 보인다' : ''}
          </Band>
        ) : null}
        {q.isPending ? (
          <div className="h-80 animate-pulse rounded bg-slate-100" />
        ) : !d ? null : points.length === 0 && axes.length === 0 ? (
          <>
            <p className="text-slate-500">{EMPTY}</p>
            <Counts d={d} />
          </>
        ) : (
          <>
            {hasSelection ? (
              <>
                <p
                  className={
                    cross.kind === 'crossed' ? 'font-medium text-red-700' : 'font-medium text-slate-700'
                  }
                >
                  {crossoverText(cross)}
                </p>
                <EChart option={lineOpt} />
              </>
            ) : (
              <p className="text-slate-500">
                이 선택(쿼리 {query} · 변형 {index} · {cache})에 해당하는 점이 없다 — 다른 쿼리 · 변형 · 캐시
                상태를 고른다
              </p>
            )}
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">비교 축(쿼리 시간 외)</span>
                {axisOptions.length > 0 ? (
                  <Select
                    value={axis ?? ''}
                    onChange={(e) => setAxisSel(e.target.value)}
                    aria-label="비교 축"
                  >
                    {axisOptions.map((k) => (
                      <option key={k} value={k}>
                        {AXIS_LABELS[k] ?? k}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
              {axisEntries.length > 0 ? (
                <EChart option={barOpt} className="h-64 w-full" />
              ) : (
                <p className="text-xs text-slate-500">대조 기록에 비 쿼리 축(axes)이 아직 없다</p>
              )}
            </div>
            <Counts d={d} />
          </>
        )}
      </CardContent>
      <CardFooter>
        원천 docs/measurements(BFF 읽기 전용){d ? ` · 판독 ${formatKst(d.readAt, true)}` : ''} · 4요소 없는 점
        · 폐기 기록은 그리지 않는다 · 속이 빈 점 = 두 저장소 결과 불일치 · 관찰 보조 — 기록 정본 아님
      </CardFooter>
    </Card>
  );
}
