'use client';
// 최근 10분 작은 선 — 인라인 SVG(태그 수만큼 ECharts 인스턴스를 만들지 않는다) · 선 2px · 끝 점 8px(바탕색 고리 2px) · 가로는 창 10분 고정.
// 색은 중립 잉크 — 출처(ClickHouse)는 열 머리의 주황 점이 말한다. 저장소 색으로 선을 칠하면 "다른 뜻을 같은 색으로" 그리게 된다.
// 가리키면 세로 실선이 가장 가까운 점에 붙고 값 · 시각을 선 위에 띄운다(dataviz interaction — 가리킴 층 · 목록 상자 밖으로 나가 잘리지 않게 상자 안에). 값은 옆 "지금 값" 칸에도 있어 가리킴이 유일한 길이 아니다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nearestPoint, numText, sparkGeom, stateCodeText, type TrendPoint } from '../../lib/hmi';
import { formatKst } from '../../lib/time';

const INK = '#334155';
const SURFACE = '#ffffff';

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Sparkline({
  points,
  fromMs,
  toMs,
  step,
  gapMs,
  unit,
  label,
}: {
  points: readonly TrendPoint[];
  fromMs: number;
  toMs: number;
  /** 상태 태그 — 계단 선 · 값은 쉬운 말 */
  step: boolean;
  gapMs: number;
  unit: string;
  /** 접근성 이름 — 무엇의 최근 10분인지 */
  label: string;
}) {
  const [ref, { width, height }] = useBoxSize<HTMLDivElement>();
  const geom = useMemo(
    () => sparkGeom(points, { width, height, fromMs, toMs, step, gapMs, pad: 5 }),
    [points, width, height, fromMs, toMs, step, gapMs],
  );
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hit = hoverX === null ? null : nearestPoint(points, hoverX, { width, fromMs, toMs });
  const fmt = (v: number) => (step ? stateCodeText(v) : `${numText(v)}${unit ? ` ${unit}` : ''}`);
  const range =
    points.length > 0
      ? `최근 10분 ${step ? '' : `최소 ${fmt(geom.min)} · 최대 ${fmt(geom.max)}`}`.trim()
      : '최근 10분 데이터 없음';

  if (points.length === 0)
    return (
      <div ref={ref} className="flex h-full min-w-0 items-center text-foot text-slate-500">
        최근 10분 데이터 없음
      </div>
    );

  const hx = hit ? ((Math.min(Math.max(hit[0], fromMs), toMs) - fromMs) / (toMs - fromMs || 1)) * width : 0;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${label} — ${range}`}
      className="relative h-full min-w-0"
      onPointerMove={(e) => setHoverX(e.clientX - e.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => setHoverX(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="#e2e8f0" strokeWidth={1} />
          <path
            d={geom.d}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {hit ? <line x1={hx} x2={hx} y1={0} y2={height} stroke="#94a3b8" strokeWidth={1} /> : null}
          {geom.end && !hit ? (
            <circle cx={geom.end.x} cy={geom.end.y} r={4} fill={INK} stroke={SURFACE} strokeWidth={2} />
          ) : null}
        </svg>
      ) : null}
      {hit ? (
        <div
          className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-foot whitespace-nowrap text-slate-600 shadow-sm"
          style={hx > width / 2 ? { right: width - hx + 6 } : { left: hx + 6 }}
        >
          <b className="font-semibold text-slate-900 tabular-nums">{fmt(hit[1])}</b>{' '}
          <span className="tabular-nums">{formatKst(hit[0]).slice(11, 19)}</span>
        </div>
      ) : null}
    </div>
  );
}
