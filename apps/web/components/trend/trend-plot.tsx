'use client';
// ANL-TREND 차트(uPlot) — 08_screen/01 §차트 표준 · 08_screen/04 §요소
// 태그별 선 · min~max 음영(집계에 둘 다 있을 때만) · BAD 품질 끊김(null) · 진행 버킷 점선.
// 태그마다 x가 다를 수 있어 uPlot.join으로 맞춘다 — 원래 null(품질 끊김 · 빈 버킷)은 유지(끊김) · 맞춤으로 생긴 빈칸은 잇는다.
// 받은 점을 다시 줄이지 않는다(클라이언트 재축소 금지).
import { useEffect, useRef } from 'react';
import type uPlot from 'uplot';
import { kstTimeAxis } from '../../lib/uplot-kst';

export const COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4b5563',
];
const HEIGHT = 320;

export interface PlotSeries {
  label: string;
  x: number[];
  y: (number | null)[];
  lo: (number | null)[] | null;
  hi: (number | null)[] | null;
  /** 진행 버킷 조각 — 점선 */
  progress?: { x: number[]; y: (number | null)[] } | null;
}

export function TrendPlot({ series, dim }: { series: PlotSeries[]; dim: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el || series.length === 0) return;
    let disposed = false;
    let plot: uPlot | null = null;
    let ro: ResizeObserver | null = null;
    void import('uplot').then(({ default: UPlot }) => {
      if (disposed) return;
      const tables: uPlot.AlignedData[] = [];
      const nullModes: number[][] = [];
      const opts: uPlot.Series[] = [{}];
      const bands: uPlot.Band[] = [];
      series.forEach((s, i) => {
        const color = COLORS[i % COLORS.length] as string;
        const t: (number | null)[][] = [s.x, s.y];
        opts.push({ label: s.label, stroke: color, width: 1.5, spanGaps: false, points: { show: false } });
        if (s.lo && s.hi) {
          t.push(s.hi, s.lo);
          const base = opts.length; // hi 열 번호
          opts.push({ label: `${s.label} max`, stroke: 'transparent', points: { show: false } });
          opts.push({ label: `${s.label} min`, stroke: 'transparent', points: { show: false } });
          bands.push({ series: [base, base + 1], fill: `${color}22` });
        }
        tables.push(t as unknown as uPlot.AlignedData);
        nullModes.push(t.map(() => 1));
        if (s.progress && s.progress.x.length > 0) {
          tables.push([s.progress.x, s.progress.y] as unknown as uPlot.AlignedData);
          nullModes.push([1, 1]);
          opts.push({
            label: `${s.label} 진행`,
            stroke: color,
            dash: [4, 4],
            width: 1.5,
            points: { show: true },
          });
        }
      });
      const data = UPlot.join(tables, nullModes);
      plot = new UPlot(
        {
          width: el.clientWidth,
          height: HEIGHT,
          ms: 1,
          tzDate: (ts) => UPlot.tzDate(new Date(ts), 'Asia/Seoul'),
          scales: { x: { time: true } },
          axes: [kstTimeAxis(), {}],
          series: opts,
          bands,
          legend: { show: true, live: true },
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
  }, [series]);
  return <div ref={host} className={dim ? 'w-full opacity-50' : 'w-full'} style={{ minHeight: HEIGHT }} />;
}
