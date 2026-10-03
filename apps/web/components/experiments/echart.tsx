'use client';
// ECharts 얇은 래퍼 — 트리 셰이킹 import(echarts/core + 쓰는 차트 · 컴포넌트 · 렌더러만). 버전 정본 09_tech_stack/03 고정표.
// ECharts는 보조 차트다(08_screen/01 §차트 표준) — 역전 지점 선 · 비교 막대처럼 점 수가 적은 분석 차트에만 쓴다.
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

export function EChart({
  option,
  className,
  onClick,
}: {
  option: ChartOption;
  className?: string;
  /** 데이터 항목을 누르면 그 항목의 계열 · 데이터 순번(배수 지도 칸 → 선택 쿼리 · 규모) — 없으면 클릭을 듣지 않는다 */
  onClick?: (hit: { seriesIndex: number; dataIndex: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  // 최신 콜백을 ref로 든다 — 차트는 한 번만 만들고 콜백이 바뀌어도 다시 묶지 않는다
  const click = useRef(onClick);
  click.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = init(el.current, undefined, { renderer: 'canvas' });
    chart.current = c;
    c.on('click', (p) => {
      if (typeof p.dataIndex === 'number')
        click.current?.({ seriesIndex: p.seriesIndex ?? 0, dataIndex: p.dataIndex });
    });
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
