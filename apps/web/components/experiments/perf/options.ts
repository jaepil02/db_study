// EXP-PERF 차트 옵션 — 규모 곡선 · 배수 히트맵(08_screen/08 §EXP-PERF §표시 계약 · 08_screen/01 §차트 표준 ECharts 보조).
// 래퍼(components/experiments/echart.tsx)는 그대로 쓰고, 이 화면에만 필요한 조각(구간 음영 · 오차 막대 · 히트맵)을 여기서 더 등록한다.
// 옵션 생성은 순수 함수다 — 판독은 lib/perf.ts가 하고 여기는 모양만 정한다.
import { CustomChart, type CustomSeriesOption, HeatmapChart, type HeatmapSeriesOption } from 'echarts/charts';
import {
  type GridComponentOption,
  MarkAreaComponent,
  type MarkAreaComponentOption,
  type TooltipComponentOption,
  type VisualMapComponentOption,
  VisualMapPiecewiseComponent,
} from 'echarts/components';
import { type ComposeOption, use } from 'echarts/core';
import { formatRows, memoryLimitText, type Store } from '../../../lib/measurements';
import {
  type CurveLine,
  expLabel,
  type HeatCell,
  type PerfPoint,
  type PerfRange,
  type PerfRecord,
  type PgVariant,
  rowsTooltip,
  type Verdict,
} from '../../../lib/perf';
import type { ChartOption } from '../echart';

use([CustomChart, HeatmapChart, MarkAreaComponent, VisualMapPiecewiseComponent]);

type PerfChartOption = ComposeOption<
  | CustomSeriesOption
  | HeatmapSeriesOption
  | MarkAreaComponentOption
  | GridComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
>;

/** 저장소 색 2 — 역전 지점 패널과 같은 값(색 계약: I1 · I2는 같은 색의 선 모양으로 가른다) */
export const STORE_COLOR: Record<Store, string> = { postgresql: '#2563eb', clickhouse: '#d97706' };
/** discarded 선 — 회색 점선(P3) · 마커는 저장소 색 */
const DISCARDED_LINE = '#9ca3af';
const UNDETERMINED_COLOR = '#e5e7eb';
export const LINE_LABEL: Record<CurveLine['key'], string> = {
  clickhouse: 'ClickHouse',
  I1: 'PostgreSQL I1 (BRIN)',
  I2: 'PostgreSQL I2 (BRIN + btree)',
};
/** 선 모양 — I1 긴 점선 · I2 짧은 점선(discarded) · 유효 기록이면 I1 실선 · I2 점-선 */
const DASH: Record<CurveLine['key'], { discarded: number[]; valid: number[] | 'solid' }> = {
  clickhouse: { discarded: [6, 4], valid: 'solid' },
  I1: { discarded: [10, 4], valid: 'solid' },
  I2: { discarded: [2, 3], valid: [8, 3, 2, 3] },
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

export function fmtMs(v: number): string {
  return v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** 점 툴팁 — 3회 값 · 서버 µs 중앙값 · 판정 기준 · 결과 일치 · 4요소(§요소 규모 곡선) */
export function pointTooltip(p: PerfPoint, rec: PerfRecord | undefined): string {
  const over = p.deviation !== null && p.deviation > p.threshold;
  const lines = [
    `<b>${esc(p.store === 'clickhouse' ? 'ClickHouse' : `PostgreSQL ${p.index ?? ''}`)}</b> · ${esc(rowsTooltip(p))}${p.point ? ` (${esc(p.point)})` : ''}`,
    `${esc(p.query)} · ${p.cache === 'cold' ? '콜드' : '웜'} · client 중앙값 ${fmtMs(p.median)} ms(참고값)`,
    `3회 ${p.values.map(fmtMs).join(' · ')} ms`,
    p.serverMedian === null
      ? '서버 값 기록 없음'
      : `서버 중앙값 ${Math.round(p.serverMedian * 1000).toLocaleString('ko-KR')} µs${
          p.serverValues ? ` · 3회 ${p.serverValues.map((v) => Math.round(v * 1000)).join(' · ')} µs` : ''
        }`,
    `판정 기준 ${esc(p.basis ?? '기록 없음')}${
      p.deviation === null
        ? ''
        : over
          ? ` · <span style="color:#b91c1c">편차 ${pct(p.deviation)} > 기준 ${pct(p.threshold)}</span>`
          : ` · 편차 ${pct(p.deviation)}`
    }`,
    p.resultMatch === null ? '결과 대조 기재 없음' : p.resultMatch ? '결과 일치' : '결과 불일치(속이 빈 점)',
    `기록 ${esc(p.record)} · ${esc(p.status)}`,
  ];
  if (rec) {
    const sw = Object.entries(rec.switches)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : String(v)}`);
    lines.push(
      `커밋 ${esc(rec.run.commitHash)} · 프로파일 ${esc(rec.run.memoryProfile)} · 티어 ${esc(rec.run.capacityTier)}`,
      esc(memoryLimitText(rec.run)),
      esc(sw.slice(0, 6).join(' · ')),
      esc(sw.slice(6).join(' · ')),
    );
  }
  return lines.join('<br/>');
}

export interface CurveInput {
  lines: CurveLine[];
  /** 선택 쿼리 · 캐시의 I2 행 — 역전 음영 원천(I1 행은 결론 카드에만) */
  i2Range: PerfRange | undefined;
  undetermined: { exponent: number; pgVariant: string }[];
  records: PerfRecord[];
  yLog: boolean;
}

/** 규모 곡선 — 가로 행 수 로그 · 세로 ms 로그(기본) · 선 3 · 반복 최소~최대 막대 · 역전 음영 · 미정 표지 */
export function curveOption(input: CurveInput): ChartOption {
  const { lines, i2Range, undetermined, records, yLog } = input;
  // 로그 축이면 0 이하 점은 그리지 않는다(P6 — 계수 줄이 센다)
  const drawable = (p: PerfPoint) => !yLog || p.median > 0;
  const allRows = lines.flatMap((l) => l.points.map((p) => p.rows));
  const minRows = allRows.length > 0 ? 10 ** Math.floor(Math.log10(Math.min(...allRows))) : 1e5;
  const maxRows = allRows.length > 0 ? 10 ** Math.ceil(Math.log10(Math.max(...allRows))) : 1e9;
  const recOf = (r: string) => records.find((x) => x.record === r);
  // 선(ChartOption) · 오차 막대(custom)가 섞이므로 계열 배열은 두 옵션 타입의 합으로 둔다
  const series: (NonNullable<ChartOption['series']> | CustomSeriesOption)[] = [];
  const lineSeries = lines.map((l) => {
    const pts = l.points.filter(drawable);
    const discarded = pts.some((p) => p.status !== 'valid');
    const dash = discarded ? DASH[l.key].discarded : DASH[l.key].valid;
    const color = STORE_COLOR[l.store];
    const marks: { xAxis: number; name: string }[] = undetermined
      .filter((u) => (l.key === 'clickhouse' ? false : u.pgVariant === l.key))
      .map((u) => ({ xAxis: 10 ** u.exponent, name: `? ${expLabel(u.exponent)} ${u.pgVariant}` }));
    return {
      id: `line-${l.key}`,
      name: LINE_LABEL[l.key],
      type: 'line' as const,
      color,
      symbolSize: 8,
      lineStyle: { color: discarded ? DISCARDED_LINE : color, type: dash, width: l.key === 'I2' ? 1.5 : 2 },
      data: pts.map((p) => ({
        value: [p.rows, p.median],
        // 결과 불일치 점은 속이 빈 점(P6)
        symbol: p.resultMatch === false ? 'emptyCircle' : 'circle',
      })),
      tooltip: {
        formatter: (params: { dataIndex?: number }) => {
          const p = params.dataIndex === undefined ? undefined : pts[params.dataIndex];
          return p ? pointTooltip(p, recOf(p.record)) : '';
        },
      },
      ...(marks.length > 0
        ? {
            markLine: {
              symbol: 'none',
              silent: true,
              lineStyle: { type: 'dotted' as const, color: '#6b7280' },
              label: { formatter: '{b}', color: '#374151' },
              data: marks,
            },
          }
        : {}),
      ...(l.key === 'I2' && i2Range && i2Range.crossover !== null
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: 'rgba(220, 38, 38, 0.08)' },
              label: { color: '#b91c1c', position: 'insideTop' as const },
              data: [
                [
                  {
                    name: i2Range.direction
                      ? `역전 구간 I2 → ${i2Range.direction.to === 'clickhouse' ? 'ClickHouse' : 'PostgreSQL'}`
                      : '역전 구간(방향 미상)',
                    xAxis: 10 ** Number(i2Range.crossover[0].slice(3)),
                  },
                  { xAxis: 10 ** Number(i2Range.crossover[1].slice(3)) },
                ],
              ],
            },
          }
        : {}),
    };
  });
  series.push(...(lineSeries as NonNullable<ChartOption['series']>[]));
  // 반복 최소~최대 막대 — 점마다 세로선과 머리(계열 색 · 툴팁 없음)
  for (const l of lines) {
    const pts = l.points.filter(drawable).filter((p) => p.values.length > 0);
    const bars: CustomSeriesOption = {
      id: `bar-${l.key}`,
      name: LINE_LABEL[l.key],
      type: 'custom',
      silent: true,
      tooltip: { show: false },
      data: pts.map((p) => [
        p.rows,
        Math.max(Math.min(...p.values), yLog ? Number.MIN_VALUE : Number.NEGATIVE_INFINITY),
        Math.max(...p.values),
      ]),
      renderItem: (_params, api) => {
        const lo = api.coord([api.value(0), api.value(1)]);
        const hi = api.coord([api.value(0), api.value(2)]);
        const x = lo[0] ?? 0;
        const y1 = lo[1] ?? 0;
        const y2 = hi[1] ?? 0;
        const style = { stroke: STORE_COLOR[l.store], lineWidth: 1 };
        return {
          type: 'group',
          children: [
            { type: 'line', shape: { x1: x, y1, x2: x, y2 }, style },
            { type: 'line', shape: { x1: x - 3, y1, x2: x + 3, y2: y1 }, style },
            { type: 'line', shape: { x1: x - 3, y1: y2, x2: x + 3, y2 }, style },
          ],
        };
      },
    };
    series.push(bars);
  }
  const option = {
    animation: false,
    grid: { left: 64, right: 24, top: 48, bottom: 52 },
    legend: { top: 0, data: lines.map((l) => LINE_LABEL[l.key]) },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'log',
      logBase: 10,
      min: minRows,
      max: maxRows,
      name: '행 수(로그)',
      nameLocation: 'middle',
      nameGap: 30,
      // 눈금은 10^k 정수 지수만 — 정밀화 점은 눈금 없이 점만(§표시 계약 가로축)
      axisLabel: {
        formatter: (v: number) =>
          Number.isInteger(Math.round(Math.log10(v) * 1e6) / 1e6) ? formatRows(v) : '',
      },
    },
    yAxis: {
      type: yLog ? 'log' : 'value',
      name: 'ms · client 중앙값(참고값)',
      scale: !yLog,
    },
    series,
  };
  return option as unknown as ChartOption;
}

/** 세기 단계 — 배수 크기(참고값)의 |log10| 을 4단계로(발산 · 0이 가장 옅다) */
const STRENGTH_ALPHA = ['4d', '80', 'b3', 'e6'] as const;
const strengthOf = (ratio: number | null): number =>
  ratio && ratio > 0 ? Math.min(3, Math.floor(Math.abs(Math.log10(ratio)) * 2)) : 1;

/**
 * 히트맵 칸 색 부호 — ECharts 히트맵은 visualMap이 색을 칠한다(칸별 itemStyle을 쓰지 못한다).
 * 저장소 우열(정본) × 세기 4 · 미정 · 방향 미상 · 판정 없음을 정수 부호로 두고 조각 visualMap이 색으로 바꾼다.
 */
export function cellCode(verdict: Verdict | null, ratio: number | null): number {
  if (verdict === null) return 0;
  if (verdict === 'undetermined') return 1;
  if (verdict === 'unknown-direction') return 2;
  return (verdict === 'clickhouse' ? 10 : 20) + strengthOf(ratio);
}

/** 부호 → 색 조각 — 우열 색은 저장소 색 · 세기는 불투명도 · 미정은 무채색 */
export const CELL_PIECES: { value: number; color: string }[] = [
  { value: 0, color: '#ffffff' },
  { value: 1, color: UNDETERMINED_COLOR },
  { value: 2, color: '#d1d5db' },
  ...STRENGTH_ALPHA.flatMap((a, i) => [
    { value: 10 + i, color: `${STORE_COLOR.clickhouse}${a}` },
    { value: 20 + i, color: `${STORE_COLOR.postgresql}${a}` },
  ]),
];

/** 칸 글자 — 배수 소수 1자리 · 미정은 ? · 방향 미상은 ↕? */
export function cellText(c: Pick<HeatCell, 'ratio' | 'verdict'>): string {
  const r = c.ratio === null ? '—' : `${c.ratio.toFixed(1)}×`;
  if (c.verdict === 'undetermined') return `${r} ?`;
  if (c.verdict === 'unknown-direction') return `${r} ↕?`;
  return r;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  clickhouse: 'ClickHouse 우세(3/3)',
  postgresql: 'PostgreSQL 우세(3/3)',
  undetermined: '우열 미정',
  'unknown-direction': '방향 미상(역전 구간은 있으나 방향 기록 없음)',
};

/** 배수 히트맵 — 행 지수 × 쿼리 5 · 칸 = PG ÷ CH(참고값) · 색 = 3/3 우열(정본) */
export function heatmapOption(
  exponents: number[],
  cells: HeatCell[],
  queries: readonly string[],
  variant: PgVariant,
): ChartOption {
  const option: PerfChartOption = {
    animation: false,
    grid: { left: 64, right: 16, top: 8, bottom: 32 },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const c = p?.dataIndex === undefined ? undefined : cells[p.dataIndex];
        if (!c) return '';
        return [
          `<b>${esc(c.query)}</b> · ${esc(expLabel(c.exponent))}행 · PG ${variant}`,
          c.ratio === null
            ? '두 저장소 점이 함께 있지 않다'
            : `PG ÷ CH 중앙값 ${c.ratio.toFixed(2)}×(참고값)`,
          c.verdict === null ? '점 단위 우열 기록 없음' : VERDICT_TEXT[c.verdict],
        ].join('<br/>');
      },
    },
    visualMap: { type: 'piecewise', show: false, dimension: 2, pieces: CELL_PIECES },
    xAxis: { type: 'category', data: [...queries], position: 'top', splitArea: { show: false } },
    yAxis: { type: 'category', data: exponents.map(expLabel), inverse: true },
    series: [
      {
        type: 'heatmap',
        label: {
          show: true,
          fontSize: 11,
          color: '#111827',
          formatter: (p) => cellText(cells[p.dataIndex] ?? { ratio: null, verdict: null }),
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 1 },
        // 셋째 값 = 색 부호(cellCode) — 배수는 칸 글자 · 툴팁이 cells에서 읽는다
        data: cells.map((c) => [
          queries.indexOf(c.query),
          exponents.indexOf(c.exponent),
          cellCode(c.verdict, c.ratio),
        ]),
      },
    ],
  };
  return option as unknown as ChartOption;
}
