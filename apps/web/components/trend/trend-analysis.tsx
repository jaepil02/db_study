'use client';
// ANL-TREND — 정본 docs/08_screen/04_trend_analysis.md (요소 12 중 S4분 11 — 이전 태그 이어 보기는 S7 · WRK-05)
// 조건은 쿼리 문자열이 정본이다(딥링크 공유). 조회는 api 직결 · 태그 선택 목록은 BFF 경유.
// 끝이 현재면 확정 과거(1차)와 진행 버킷(2차)을 따로 받아 화면이 합친다 — 진행 버킷 실패는 점선 구간만 비운다.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { directUrl, requestJson, retryOn503 } from '../../lib/api';
import { TIMESERIES_GC_MS, TS_STALE_CURRENT_MS } from '../../lib/config';
import { errorText } from '../../lib/error-display';
import { exportStream } from '../../lib/export-stream';
import {
  AGGREGATIONS,
  INTERVALS,
  TIMESERIES_EXPORT_MAX_RANGE_MS,
  TIMESERIES_MAX_POINTS_LIMIT,
  TIMESERIES_TAG_LIMIT,
  type TimeseriesQueryBody,
  TimeseriesQueryResponse,
} from '../../lib/shared';
import { formatKst, toKstOffsetIso } from '../../lib/time';
import {
  type Aggregation,
  decodeParams,
  encodeParams,
  type Interval,
  PRESETS,
  type PresetId,
  progressRange,
  rangeOf,
  resultBadges,
  seriesColumns,
  staleTimeFor,
  type TrendParams,
} from '../../lib/trend';
import { Button, Field, Select, TextInput } from '../master/field';
import { useDevices, useSites, useTags } from '../master/queries';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { type PlotSeries, TrendPlot } from './trend-plot';

const HOUR = 3_600_000;

interface Run {
  tagIds: number[];
  fromMs: number;
  toMs: number;
  endsNow: boolean;
  interval: Interval | null;
  aggregations: Aggregation[];
  maxPoints: number;
  seq: number;
}

async function query(body: Record<string, unknown>): Promise<TimeseriesQueryBody> {
  const r = await requestJson(directUrl('/api/v1/timeseries/query'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return TimeseriesQueryResponse.parse(r.body);
}

export function TrendAnalysis() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => decodeParams(new URLSearchParams(sp.toString())), [sp]);
  const [draft, setDraft] = useState<TrendParams>(params);
  const [run, setRun] = useState<Run | null>(null);
  const [follow, setFollow] = useState(false);
  const plotBox = useRef<HTMLDivElement>(null);

  const execute = (p: TrendParams) => {
    router.replace(`${pathname}?${encodeParams(p)}`);
    if (p.tagIds.length === 0) return setRun(null);
    const now = Date.now();
    const r = rangeOf(p, now);
    // maxPoints = 플롯 영역 픽셀 폭(08_screen/01 §차트 표준 — 폭보다 많이 받지 않는다)
    const maxPoints = Math.min(
      TIMESERIES_MAX_POINTS_LIMIT,
      Math.max(100, Math.floor(plotBox.current?.clientWidth ?? 1200)),
    );
    setRun({
      ...r,
      tagIds: p.tagIds,
      interval: p.interval,
      aggregations: p.aggregations,
      maxPoints,
      seq: now,
    });
    if (!r.endsNow) setFollow(false);
  };

  // 딥링크 — 쿼리 문자열에 태그가 있으면 진입 즉시 조회
  // biome-ignore lint/correctness/useExhaustiveDependencies: 진입 1회
  useEffect(() => {
    if (params.tagIds.length > 0) execute(params);
  }, []);

  // 1차 — 확정 과거(끝이 현재면 서버 스냅이 진행 버킷 앞에서 끊는다)
  const mainQ = useQuery({
    // 끝이 현재인 조회는 누를 때마다 범위가 달라 새 키다(서버 스냅 · cache:q가 흡수한다) · 사용자 지정 범위는 같은 조건이면 같은 키
    queryKey: ['timeseries', run && { ...run, seq: run.endsNow ? run.seq : 0 }],
    enabled: run !== null,
    queryFn: () =>
      query({
        tagIds: run?.tagIds,
        from: toKstOffsetIso(run?.fromMs ?? 0),
        to: toKstOffsetIso(run?.toMs ?? 0),
        ...(run?.interval ? { interval: run.interval } : {}),
        aggregations: run?.aggregations,
        maxPoints: run?.maxPoints,
      }),
    staleTime: (q) => (q.state.data ? staleTimeFor(q.state.data.meta, Date.now()) : 0),
    gcTime: TIMESERIES_GC_MS,
    retry: retryOn503,
    placeholderData: keepPreviousData,
  });

  // 2차 — 진행 버킷(끝이 현재일 때만) · 따라가기면 현재 버킷 staleTime 주기로 이것만 다시 받는다
  const prog =
    run?.endsNow && mainQ.data && !mainQ.isPlaceholderData ? progressRange(mainQ.data.meta, run.seq) : null;
  const progQ = useQuery({
    queryKey: ['timeseries', 'progress', run?.seq, prog?.fromMs, prog?.interval],
    enabled: prog !== null,
    queryFn: () =>
      query({
        tagIds: run?.tagIds,
        from: toKstOffsetIso(prog?.fromMs ?? 0),
        to: toKstOffsetIso(Math.max(Date.now(), (prog?.fromMs ?? 0) + 1000)),
        interval: prog?.interval,
        aggregations: run?.aggregations,
        maxPoints: run?.maxPoints,
      }),
    staleTime: 0,
    gcTime: TIMESERIES_GC_MS,
    refetchInterval: follow ? TS_STALE_CURRENT_MS : false,
    retry: retryOn503,
  });

  const plotSeries = useMemo<PlotSeries[]>(() => {
    const d = mainQ.data;
    if (!d) return [];
    return d.series.map((s) => {
      const c = seriesColumns(d.meta.columns, s.points);
      const p = progQ.data?.series.find((x) => x.tagId === s.tagId);
      const pc = p && progQ.data ? seriesColumns(progQ.data.meta.columns, p.points) : null;
      return {
        label: `${s.tagName ?? `tag ${s.tagId}`}${s.unit ? `(${s.unit})` : ''}`,
        ...c,
        progress: pc ? { x: pc.x, y: pc.y } : null,
      };
    });
  }, [mainQ.data, progQ.data]);

  const rangeMs = run ? run.toMs - run.fromMs : 0;
  const [exporting, setExporting] = useState<{ bytes: number; done?: string; warn?: string } | null>(null);
  const doExport = async (format: 'csv' | 'parquet') => {
    if (!run) return;
    setExporting({ bytes: 0 });
    try {
      const r = await exportStream(
        { tagIds: run.tagIds, fromMs: run.fromMs, toMs: run.toMs, format },
        (bytes) => setExporting({ bytes }),
      );
      setExporting(
        r.complete
          ? { bytes: r.bytes, done: r.fileName }
          : {
              bytes: r.bytes,
              warn: `스트림이 도중에 끊겼다 — ${r.fileName}는 불완전하다(원시로 믿지 않는다)`,
            },
      );
    } catch (e) {
      setExporting({ bytes: 0, warn: errorText(e) });
    }
  };

  const err = mainQ.error;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>트렌드 분석</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <TagPicker value={draft.tagIds} onChange={(tagIds) => setDraft({ ...draft, tagIds })} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="범위">
              <Select
                value={draft.preset ?? 'custom'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'custom') {
                    const now = Date.now();
                    setDraft({ ...draft, preset: null, fromMs: now - 24 * HOUR, toMs: now });
                  } else setDraft({ ...draft, preset: v as PresetId });
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">사용자 지정</option>
              </Select>
            </Field>
            {draft.preset === null ? (
              <>
                <Field label="시작(KST)">
                  <TextInput
                    type="datetime-local"
                    value={toKstOffsetIso(draft.fromMs).slice(0, 16)}
                    onChange={(e) => setDraft({ ...draft, fromMs: Date.parse(`${e.target.value}:00+09:00`) })}
                  />
                </Field>
                <Field label="끝(KST)">
                  <TextInput
                    type="datetime-local"
                    value={toKstOffsetIso(draft.toMs).slice(0, 16)}
                    onChange={(e) => setDraft({ ...draft, toMs: Date.parse(`${e.target.value}:00+09:00`) })}
                  />
                </Field>
              </>
            ) : null}
            <Field label="해상도">
              <Select
                value={draft.interval ?? 'auto'}
                title="1시간 이하 raw · 7일까지 1m · 90일까지 1h · 초과 1d(KST 자정) — 점 상한을 넘으면 서버가 한 단계 올린다"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    interval: e.target.value === 'auto' ? null : (e.target.value as Interval),
                  })
                }
              >
                <option value="auto">자동</option>
                {INTERVALS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2 text-sm">
              {AGGREGATIONS.map((a) => (
                <label key={a} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={draft.aggregations.includes(a)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? AGGREGATIONS.filter((x) => x === a || draft.aggregations.includes(x))
                        : draft.aggregations.filter((x) => x !== a);
                      if (next.length > 0) setDraft({ ...draft, aggregations: next });
                    }}
                  />
                  {a}
                </label>
              ))}
            </div>
            <Button onClick={() => execute(draft)} disabled={draft.tagIds.length === 0}>
              조회
            </Button>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                disabled={!run?.endsNow}
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
              />
              따라가기
            </label>
            <Button
              variant="outline"
              disabled={!run || rangeMs > TIMESERIES_EXPORT_MAX_RANGE_MS}
              title={rangeMs > TIMESERIES_EXPORT_MAX_RANGE_MS ? '내보내기 범위 상한 1일' : undefined}
              onClick={() => doExport('csv')}
            >
              내보내기 CSV
            </Button>
            <Button
              variant="outline"
              disabled={!run || rangeMs > TIMESERIES_EXPORT_MAX_RANGE_MS}
              onClick={() => doExport('parquet')}
            >
              Parquet
            </Button>
          </div>
          {draft.interval === 'raw' &&
          (draft.preset ? (PRESETS.find((p) => p.id === draft.preset)?.ms ?? 0) : draft.toMs - draft.fromMs) >
            HOUR ? (
            <Band tone="info">
              긴 범위의 raw는 서버가 해상도를 올린다 — 원시가 필요하면 내보내기(범위 1일 이하)
            </Band>
          ) : null}
          {exporting ? (
            <Band tone={exporting.warn ? 'warning' : 'info'}>
              {exporting.warn ?? (exporting.done ? `내보내기 완료 — ${exporting.done}` : '내보내는 중')} ·
              받은 {exporting.bytes.toLocaleString('ko-KR')} 바이트
            </Band>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <ResultLine run={run} data={mainQ.data} fetching={mainQ.isFetching} />
        </CardHeader>
        <CardContent>
          <div ref={plotBox}>
            {err ? <Band>{errorText(err)}</Band> : null}
            {progQ.isError ? (
              <Band tone="warning">
                진행 버킷 조회 실패 — 확정 과거 선은 그대로 · {errorText(progQ.error)}
              </Band>
            ) : null}
            {!run ? (
              <p className="py-16 text-center text-sm text-slate-500">태그를 고른다</p>
            ) : mainQ.isPending ? (
              <div className="h-80 animate-pulse rounded bg-slate-100" />
            ) : mainQ.data && mainQ.data.meta.pointCount === 0 && !(progQ.data?.meta.pointCount ?? 0) ? (
              <p className="py-16 text-center text-sm text-slate-500">
                이 구간에 측정값이 없다 — 태그의 첫 측정 이후인지 확인한다
              </p>
            ) : (
              <TrendPlot series={plotSeries} dim={mainQ.isPlaceholderData || mainQ.isFetching} />
            )}
            {mainQ.data ? (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                {mainQ.data.series.map((s) => (
                  <span key={s.tagId}>
                    {s.tagName ?? `tag ${s.tagId}`}
                    {s.unit ? `(${s.unit})` : ''}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultLine({
  run,
  data,
  fetching,
}: {
  run: Run | null;
  data?: TimeseriesQueryBody;
  fetching: boolean;
}) {
  if (!run || !data)
    return <span className="text-xs text-slate-500">{fetching ? '조회 중' : '결과 없음'}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {resultBadges(data.meta, { interval: run.interval, fromMs: run.fromMs, toMs: run.toMs }).map((b) =>
        b === '캐시' ? (
          <Badge
            key={b}
            variant="success"
            title="캐시된 결과 — 완전 과거 TTL 300초 · 현재 버킷 포함 30초. 방금 고친 태그명은 TTL까지 옛 이름일 수 있다"
          >
            캐시
          </Badge>
        ) : (
          <span key={b} className="text-slate-700">
            {b}
          </span>
        ),
      )}
      {run.endsNow ? <span className="text-slate-400">· 기준 {formatKst(run.seq)}</span> : null}
      {fetching ? <Badge variant="outline">조회 중</Badge> : null}
    </div>
  );
}

/** 태그 선택기 — 사이트 → 설비 → 태그 · 비활성 태그도 고른다 · 상한에 닿으면 추가를 막는다 */
function TagPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const sites = useSites();
  const [siteId, setSiteId] = useState<number | null>(null);
  const sid = siteId ?? sites.data?.[0]?.siteId ?? null;
  const devices = useDevices(sid, true);
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const did = deviceId ?? devices.data?.[0]?.deviceId ?? null;
  const tags = useTags(did, true);
  const full = value.length >= TIMESERIES_TAG_LIMIT;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span className="text-xs text-slate-500">태그</span>
        {value.map((id) => (
          <Badge key={id} variant="outline">
            {tags.data?.find((t) => t.tagId === id)?.tagName ?? `tag ${id}`}
            <button type="button" className="ml-1" onClick={() => onChange(value.filter((x) => x !== id))}>
              ✕
            </button>
          </Badge>
        ))}
        <span className={full ? 'text-xs text-red-600' : 'text-xs text-slate-500'}>
          {value.length}/{TIMESERIES_TAG_LIMIT}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="사이트">
          <Select value={sid ?? ''} onChange={(e) => setSiteId(Number(e.target.value))}>
            {(sites.data ?? []).map((s) => (
              <option key={s.siteId} value={s.siteId}>
                {s.siteName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="설비">
          <Select value={did ?? ''} onChange={(e) => setDeviceId(Number(e.target.value))}>
            {(devices.data ?? []).map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceName}
                {d.isActive ? '' : '(비활성)'}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex max-h-24 flex-wrap gap-2 overflow-auto text-xs">
          {(tags.data ?? []).map((t) => (
            <label key={t.tagId} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={value.includes(t.tagId)}
                disabled={full && !value.includes(t.tagId)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, t.tagId] : value.filter((x) => x !== t.tagId))
                }
              />
              {t.tagName}
              {t.isActive ? '' : '(비활성 태그)'}
            </label>
          ))}
        </div>
        {sites.isError || devices.isError || tags.isError ? (
          <Band>{errorText(sites.error ?? devices.error ?? tags.error)}</Band>
        ) : null}
      </div>
    </div>
  );
}
