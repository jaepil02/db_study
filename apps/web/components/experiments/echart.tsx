'use client';
// ECharts 얇은 래퍼 — 트리 셰이킹 import(echarts/core + 쓰는 차트 · 컴포넌트 · 렌더러만). 버전 정본 09_tech_stack/03 고정표.
// ECharts는 보조 차트다(08_screen/01 §차트 표준) — 역전 지점 선 · 비교 막대처럼 점 수가 적은 분석 차트에만 쓴다.
// 반응형(정본 docs/08_screen/01_standards.md §반응형 규칙): 옵션을 함수로 주면 감싼 요소의 글자 크기(글자 토큰 — 바닥 12px) · 폭 · 높이를 받아
// 크기가 바뀔 때마다 다시 짓는다 — 캔버스 글자가 화면 글자 토큰과 같이 늘고 준다.
import { BarChart, type BarSeriesOption, LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  type GridComponentOption,
  LegendComponent,
  type LegendComponentOption,
  MarkAreaComponent,
  type MarkAreaComponentOption,
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
  MarkAreaComponent,
  CanvasRenderer,
]);

export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | MarkAreaComponentOption
>;

/** 옵션을 지을 때 받는 환경 — font는 감싼 요소의 계산된 글자 크기(px · 12 미만이면 12) */
export interface ChartEnv {
  font: number;
  width: number;
  height: number;
}

export type ChartOptionInput = ChartOption | ((env: ChartEnv) => ChartOption);

/**
 * 옵션 전체를 갈아 끼우며 글꼴을 싣는다 — 옵션이 textStyle을 따로 주면 그쪽이 이긴다.
 * 갈아 끼우면(notMerge) 떠 있던 툴팁이 닫힌다 — 마우스가 그림 위에 있으면 그 자리에 다시 띄운다
 * (1초마다 옵션이 바뀌는 그림 — ⑤ 넣는 중 선 그림 · 사용자 결정 2026-10-11 세 패널 실시간).
 */
function drawWithFont(
  c: EChartsType,
  o: ChartOption,
  fontFamily: string | undefined,
  pointer: { x: number; y: number } | null,
) {
  c.setOption({ ...o, textStyle: { fontFamily, ...(o.textStyle as object) } }, { notMerge: true });
  if (pointer) c.dispatchAction({ type: 'showTip', x: pointer.x, y: pointer.y });
}

function envOf(el: HTMLElement): ChartEnv {
  const px = Number.parseFloat(getComputedStyle(el).fontSize);
  return {
    font: Math.max(12, Number.isFinite(px) ? px : 12),
    width: el.clientWidth,
    height: el.clientHeight,
  };
}

export function EChart({
  option,
  className,
  onClick,
  label,
}: {
  option: ChartOptionInput;
  className?: string;
  /** 데이터 항목을 누르면 그 항목의 계열 · 데이터 순번(배수 지도 칸 → 선택 쿼리 · 규모) — 없으면 클릭을 듣지 않는다 */
  onClick?: (hit: { seriesIndex: number; dataIndex: number }) => void;
  /** 그림 전체의 접근성 이름 — 무엇을 그린 그림인지 한 문장 */
  label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  // 최신 콜백 · 옵션을 ref로 든다 — 차트는 한 번만 만들고 콜백이 바뀌어도 다시 묶지 않는다
  const click = useRef(onClick);
  click.current = onClick;
  const input = useRef(option);
  input.current = option;

  // 캔버스는 CSS 글꼴을 물려받지 않는다 — 감싼 요소의 계산된 글꼴(Pretendard · 대체 글꼴 순서)을 옵션 textStyle로 넘긴다
  const font = useRef<string | undefined>(undefined);
  // 그림 위 마우스 자리(캔버스 좌표) — 그림 밖이면 null
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    font.current = getComputedStyle(host).fontFamily || undefined;
    const c = init(host, undefined, { renderer: 'canvas' });
    chart.current = c;
    const redraw = () => {
      const o = input.current;
      drawWithFont(c, typeof o === 'function' ? o(envOf(host)) : o, font.current, pointer.current);
    };
    redraw();
    // 글꼴 파일이 그림보다 늦게 오면 한 번 다시 그린다(display swap — 처음 그림은 대체 글꼴)
    void document.fonts?.ready.then(() => {
      if (chart.current === c) redraw();
    });
    const zr = c.getZr();
    zr.on('mousemove', (e) => {
      pointer.current = { x: e.offsetX, y: e.offsetY };
    });
    zr.on('globalout', () => {
      pointer.current = null;
    });
    c.on('click', (p) => {
      if (typeof p.dataIndex === 'number')
        click.current?.({ seriesIndex: p.seriesIndex ?? 0, dataIndex: p.dataIndex });
    });
    const ro = new ResizeObserver(() => {
      c.resize();
      // 함수 옵션은 크기 · 글자에 따라 다시 짓는다(여백 · 글자 크기가 그 값을 쓴다)
      if (typeof input.current === 'function') redraw();
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    // 선택이 바뀌면 옵션 전체를 갈아 끼운다(notMerge) — 이전 선택의 계열 · 표지가 남지 않게
    const host = el.current;
    if (!chart.current || !host) return;
    drawWithFont(
      chart.current,
      typeof option === 'function' ? option(envOf(host)) : option,
      font.current,
      pointer.current,
    );
  }, [option]);

  return (
    <div
      ref={el}
      {...(label ? { role: 'img', 'aria-label': label } : {})}
      className={className ?? 'h-80 w-full'}
    />
  );
}
