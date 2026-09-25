'use client';
// ECharts 얇은 래퍼 — 트리 셰이킹 import(echarts/core + 쓰는 차트 · 컴포넌트 · 렌더러만). 버전 정본 09_tech_stack/03 고정표.
// ECharts는 보조 차트다(08_screen/01 §차트 표준) — EXP-COMPARE 역전 지점 선 · 비교 축 막대처럼 점 수가 적은 분석 차트에만 쓴다.
import { BarChart, type BarSeriesOption, LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  MarkLineComponent,
  type MarkLineComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
} from 'echarts/components';
import { type ComposeOption, type EChartsType, init, use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
>;

export function EChart({ option, className }: { option: ChartOption; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = init(el.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // 선택이 바뀌면 옵션 전체를 갈아 끼운다(notMerge) — 이전 선택의 계열 · 표지가 남지 않게
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={el} className={className ?? 'h-80 w-full'} />;
}
