'use client';
// ALM-RULES 판정 분석 — 정본 docs/08_screen/05_alarm_console.md §ALM-RULES 요소(판정 분석 차트 · 빈 버킷 주의 표지 · 원 시계열 보기)
// 버킷별 min · max 밴드 · 현재 임계선 · 위반 비율(breachCount ÷ evalCount) · 빈 버킷(evalCount 0) 주의 표지를 uPlot으로 그린다.
// 평균선을 그리지 않는다 — 임계값 근처 순간 초과가 사라진다(REQ-ALM-17 · 08_screen/01 §차트 표준 극값 보존).
// 규칙을 고른 뒤에만 조회한다 — 그동안 축만 그린다.
import { useEffect, useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import {
  type AlarmRule,
  alarmErrorText,
  EVAL_BUCKET_MS,
  EVAL_RANGES,
  type EvalColumns,
  type EvalRangeId,
  evalColumns,
  thresholdLines,
  trendDeepLink,
} from '../../lib/alarms';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-display';
import { kstTimeAxis } from '../../lib/uplot-kst';
import { Button, Select } from '../master/field';
import { Band } from '../ui/band';
import { useEvaluations } from './queries';

const HEIGHT = 300;
const BAND_COLOR = '#2563eb';
const BREACH_COLOR = '#dc2626';
/** 빈 버킷 음영 — 위반 0(비율 선 0)과 다른 색으로 둔다 */
const EMPTY_FILL = 'rgba(245, 158, 11, 0.22)';

export function EvalPanel({
  rule,
  range,
  onRange,
}: {
  rule: AlarmRule | null;
  range: EvalRangeId;
  onRange: (r: EvalRangeId) => void;
}) {
  // 범위의 끝 = 규칙 · 범위를 고른 순간(분 단위) — 다시 조회는 버튼으로 끝을 현재로 옮긴다
  const [nowMs, setNowMs] = useState(() => Date.now());
  const q = useEvaluations(rule?.ruleId ?? null, range, nowMs);
  // 누락 버킷은 파싱이 evalCount 0 행으로 합성해 두었다 — 여기서는 버킷 폭만 넘긴다
  const cols = useMemo(
    () => (q.data ? evalColumns(q.data.points, EVAL_BUCKET_MS[q.data.interval]) : null),
    [q.data],
  );
  const current = q.data?.rule ?? rule;
  const lines = current ? thresholdLines(current) : [];
  const rangeMs = EVAL_RANGES.find((r) => r.id === range)?.ms ?? 0;
  const toMs = Math.floor(nowMs / 60_000) * 60_000;
  const fromMs = toMs - rangeMs;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          범위
          <Select
            aria-label="범위"
            className="w-32"
            value={range}
            onChange={(e) => {
              setNowMs(Date.now());
              onRange(e.target.value as EvalRangeId);
            }}
          >
            {EVAL_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </span>
        <Button variant="outline" disabled={!rule} onClick={() => setNowMs(Date.now())}>
          다시 조회
        </Button>
        {rule ? (
          <a className="text-blue-700 underline" href={trendDeepLink(rule.tagId, fromMs, toMs)}>
            원 시계열 보기
          </a>
        ) : null}
        {q.data ? <span>버킷 {q.data.interval || '—'}</span> : null}
      </div>
      {!rule ? <p className="text-xs text-slate-500">규칙을 고르면 판정 전수를 읽는다.</p> : null}
      {q.isError ? (
        <Band tone={q.error instanceof ApiError && q.error.status === 503 ? 'danger' : 'warning'}>
          {alarmErrorText(q.error, errorText)} — 규칙 편집은 그대로 쓸 수 있다
        </Band>
      ) : null}
      {q.isSuccess && cols && cols.totalEval === 0 ? (
        <Band tone="info">
          이 범위에 판정 기록이 없다 — 규칙 생성 이전 범위인지 확인한다(보존 30일 밖 구간도 비어 있다)
        </Band>
      ) : null}
      <EvalChart cols={cols} lines={lines} fromMs={fromMs} toMs={toMs} dim={q.isFetching || q.isError} />
      {cols ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>
            판정 {cols.totalEval.toLocaleString()} · 위반 {cols.totalBreach.toLocaleString()}
            {cols.totalEval > 0 ? ` (${((cols.totalBreach / cols.totalEval) * 100).toFixed(2)}%)` : ''}
          </span>
          <span>위반 버킷 {cols.breached.filter(Boolean).length}</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3" style={{ background: EMPTY_FILL }} />빈 버킷{' '}
            {cols.empty.filter(Boolean).length} — 판정 없음 또는 기록 실패(응답만으로 둘을 가르지 못한다)
          </span>
        </div>
      ) : null}
      <p className="text-xs text-slate-500">
        임계선은 현재 규칙 값이다 — 범위 안에 규칙 변경이 있었으면 과거 구간의 임계값은 감사 로그의 변경
        이력으로 본다
        {current?.conditionType === 'RATE_OF_CHANGE'
          ? ' · 변화율 규칙의 임계는 값 축 단위가 아니라 임계선을 긋지 않는다'
          : ''}
      </p>
    </div>
  );
}

function EvalChart({
  cols,
  lines,
  fromMs,
  toMs,
  dim,
}: {
  cols: EvalColumns | null;
  lines: number[];
  fromMs: number;
  toMs: number;
  dim: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const lineKey = lines.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: lineKey가 lines의 내용 비교 키다
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let plot: uPlot | null = null;
    let ro: ResizeObserver | null = null;
    void import('uplot').then(({ default: UPlot }) => {
      if (disposed) return;
      const x = cols?.x ?? [];
      // 임계선 열 — 버킷마다 같은 값(수평선)
      const data = [
        x,
        cols?.max ?? [],
        cols?.min ?? [],
        cols?.ratio ?? [],
        ...lines.map((v) => x.map(() => v)),
      ] as unknown as uPlot.AlignedData;
      const empty = cols?.empty ?? [];
      const step = cols?.stepMs ?? EVAL_BUCKET_MS['1m'];
      plot = new UPlot(
        {
          width: el.clientWidth,
          height: HEIGHT,
          ms: 1,
          tzDate: (ts) => UPlot.tzDate(new Date(ts), 'Asia/Seoul'),
          scales: {
            x: { time: true, range: (_u, lo, hi) => (x.length > 0 ? [lo, hi] : [fromMs, toMs]) },
            ratio: { range: [0, 1] },
          },
          axes: [
            kstTimeAxis(),
            { label: '값' },
            {
              scale: 'ratio',
              side: 1,
              label: '위반 비율',
              grid: { show: false },
              values: (_u, ticks) => ticks.map((t) => `${Math.round(t * 100)}%`),
            },
          ],
          series: [
            {},
            { label: 'max', stroke: BAND_COLOR, width: 1, spanGaps: false, points: { show: false } },
            { label: 'min', stroke: `${BAND_COLOR}99`, width: 1, spanGaps: false, points: { show: false } },
            {
              label: '위반 비율',
              scale: 'ratio',
              stroke: BREACH_COLOR,
              width: 1,
              spanGaps: false,
              points: { show: true, size: 4, fill: BREACH_COLOR },
            },
            ...lines.map((v) => ({
              label: `임계 ${v}`,
              stroke: '#111827',
              dash: [6, 4],
              width: 1,
              points: { show: false },
            })),
          ],
          bands: [{ series: [1, 2], fill: `${BAND_COLOR}22` }],
          legend: { show: true, live: true },
          hooks: {
            // 빈 버킷(evalCount 0) 음영 — 위반 0과 다른 표지("판정 없음 또는 기록 실패")
            drawClear: [
              (u) => {
                const ctx = u.ctx;
                ctx.save();
                ctx.fillStyle = EMPTY_FILL;
                for (let i = 0; i < x.length; i++) {
                  if (!empty[i]) continue;
                  const x0 = u.valToPos(x[i] as number, 'x', true);
                  const x1 = u.valToPos(
                    (x[i + 1] as number | undefined) ?? (x[i] as number) + step,
                    'x',
                    true,
                  );
                  ctx.fillRect(x0, u.bbox.top, Math.max(1, x1 - x0), u.bbox.height);
                }
                ctx.restore();
              },
            ],
          },
        },
        data,
        el,
      );
      ro = new ResizeObserver(() => plot?.setSize({ width: el.clientWidth, height: HEIGHT }));
      ro.observe(el);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      plot?.destroy();
    };
  }, [cols, lineKey, fromMs, toMs]);
  return <div ref={host} className={dim ? 'w-full opacity-50' : 'w-full'} style={{ minHeight: HEIGHT }} />;
}
