// ⑤ ① 넣기 그림 옵션 — "묶음 하나 넣는 시간"(초마다 그 초에 끝난 묶음의 평균 · api 결과 timeline). 순수 함수.
// 선 2개(ClickHouse 주황 · PostgreSQL 파랑 — 2px · 점 없음(1초마다 점이 수백 개라 선만) · 툴팁 세로 십자선에서 두 값).
// 이름은 선 끝 글자(CH · PG) + 칸 안 범례(HTML) 둘 — 색만으로 가르지 않는다(dataviz 규칙). 축 하나(ms · 0부터) · 가로는 넣기 시작 뒤 s.
import { msText } from '../../lib/format';
import type { ChartEnv, ChartOption } from '../experiments/echart';
import { STORE } from '../ui/store';
import type { IngestView } from './lab-model';

const AXIS_TEXT = '#475569';
const GRID_LINE = '#e2e8f0';

interface AxisParam {
  seriesName?: string;
  value?: unknown;
  color?: string;
}

function tooltipHtml(params: AxisParam[]): string {
  const first = params[0];
  const t = Array.isArray(first?.value) ? Number(first.value[0]) : Number.NaN;
  const head = Number.isFinite(t) ? `시작 뒤 ${Math.round(t)}s` : '';
  const rows = params
    .filter((p) => Array.isArray(p.value) && (p.value as unknown[])[1] !== null)
    .map((p) => {
      const v = Number((p.value as unknown[])[1]);
      const mark = `<span style="display:inline-block;width:12px;height:2px;margin-right:6px;vertical-align:middle;background:${p.color}"></span>`;
      return `${mark}<b>${msText(v)}ms</b> ${p.seriesName ?? ''}`;
    });
  return [`<span style="color:${AXIS_TEXT}">${head}</span>`, ...rows].join('<br/>');
}

/**
 * 넣는 중에는 1초마다 timeline이 한 점씩 늘어 다시 짓는다 — 가로축 끝은 마지막 점(dataMax)이라 선이 오른쪽으로 이어지며 축이 0~지금으로 늘어난다.
 * 점이 없으면(준비 · 비우는 중) 빈 축만 그린다.
 */
export function ingestOption(v: Pick<IngestView, 'timeline'>, env: ChartEnv): ChartOption {
  const font = env.font;
  const line = (key: 'ch' | 'pg') => ({
    id: `ingest-${key}`,
    name: STORE[key].label,
    type: 'line' as const,
    color: STORE[key].color,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 8,
    connectNulls: false,
    lineStyle: { width: 2, cap: 'round' as const, join: 'round' as const },
    itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
    endLabel: {
      show: true,
      fontSize: font,
      fontWeight: 600,
      color: '#334155',
      distance: 6,
      formatter: () => STORE[key].short,
    },
    data: v.timeline.map((p) => [p.t, p[key]]),
  });
  // 빈 축 — 점이 없으면 눈금 글자 없이 틀만(0~10초 · 0~1 자리) — 지어낸 눈금 값을 보이지 않는다
  const empty = v.timeline.length === 0;
  const option = {
    animation: false,
    grid: {
      left: Math.round(font * 3.2),
      right: Math.round(font * 2.6),
      top: Math.round(font * 0.8),
      bottom: Math.round(font * 1.9),
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#94a3b8', width: 1 } },
      textStyle: { fontSize: font, color: '#0f172a' },
      formatter: (ps: unknown) => tooltipHtml(Array.isArray(ps) ? (ps as AxisParam[]) : [ps as AxisParam]),
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: empty ? 10 : 'dataMax',
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: !empty,
        formatter: (s: number) => `${s}s`,
        fontSize: font,
        color: AXIS_TEXT,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      ...(empty ? { max: 1 } : {}),
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: GRID_LINE, width: 1, type: 'solid' } },
      axisLabel: { show: !empty, formatter: (n: number) => msText(n), fontSize: font, color: AXIS_TEXT },
    },
    series: [line('ch'), line('pg')],
  };
  return option as unknown as ChartOption;
}
