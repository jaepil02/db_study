// 그림 2 — "데이터가 많아질수록 걸리는 시간"(선택 질문) 차트 옵션. 순수 함수 — 판독은 lib/perf.ts가 하고 여기는 모양만 정한다.
// 선 2개(PostgreSQL 파랑 · ClickHouse 주황) · 가로 행 수 로그(10만~10억 행) · 세로 걸린 시간(밀리초) 로그 · 역전 구간 음영 "여기서 역전!"(방향은 툴팁) ·
// 우열 미정 점에 ? · 직접 재 본 결과는 "내 측정(참고용)" 마름모(CH ◇ · PG ◆ — 범례 툴팁에 라이브 표지). 정본 08_screen/08 §EXP-PERF 그림 2 · §표시 계약.
import { MarkAreaComponent } from 'echarts/components';
import { use } from 'echarts/core';
import type { Store } from '../../../lib/measurements';
import {
  type CurveLine,
  msText,
  type PerfPoint,
  type PerfRange,
  parseExp,
  rowsWords,
} from '../../../lib/perf';
import { LIVE_LABEL, LIVE_MARK, type LivePoint } from '../../../lib/runs';
import { STORE } from '../../ui/store';
import type { ChartOption } from '../echart';

use([MarkAreaComponent]);

export const STORE_COLOR: Record<Store, string> = { postgresql: STORE.pg.color, clickhouse: STORE.ch.color };
const STORE_NAME: Record<Store, string> = { postgresql: 'PostgreSQL', clickhouse: 'ClickHouse' };
export const LIVE_NAME = LIVE_LABEL;
/** 범례 "내 측정(참고용)" 툴팁 — 무엇인지 + 라이브 표지 고정 문구 */
export const LIVE_TIP = `내 컴퓨터에서 직접 재 본 결과 · ${LIVE_MARK}`;
export const UNDETERMINED_TIP = '3번 결과가 엇갈림';
export const CROSS_LABEL = '여기서 역전!';

/** 가로축 눈금 — 정수 지수만 "10만" · "1억"(그 사이 점은 눈금 없이 점만) */
export function rowsTick(v: number): string {
  const e = Math.round(Math.log10(v) * 1e6) / 1e6;
  return Number.isInteger(e) ? rowsWords(e).replace(' 행', '') : '';
}

/** 기록 점 툴팁 — 행 수(정확 · 지수) · 중간값 · 결과 일치 · 기록 번호 · 3번 차이가 큰 점 · 참고값(08_screen/08 §표시 계약 가로축 · 시간 참고값) */
export function pointTip(store: Store, p: PerfPoint): string {
  const over = p.deviation !== null && p.deviation > p.threshold;
  return [
    `<b>${STORE_NAME[store]}</b> · ${p.rows.toLocaleString('ko-KR')}행(10^${p.exponent})`,
    `중간값 ${msText(p.median)}밀리초`,
    p.resultMatch === null
      ? '결과 대조 기록 없음'
      : p.resultMatch
        ? '두 DB 결과 일치'
        : '두 DB 결과 불일치(속 빈 점)',
    over ? '3번 값의 차이가 기준보다 큼' : '',
    `기록 ${p.record}${p.status === 'valid' ? '' : ' · 참고값 — 편차 기준 초과(구조 판정만 정본)'}`,
  ]
    .filter(Boolean)
    .join('<br/>');
}

/** 내 측정 점 툴팁 — 3회 값 · 결과 행 수 일치 · 라이브 표지 */
export function liveTip(store: Store, p: LivePoint): string {
  return [
    `<b>${LIVE_NAME} ${STORE_NAME[store]}</b> · ${rowsWords(p.exponent)}`,
    `중간값 ${msText(p.median)}밀리초 · 3번 ${p.values.map(msText).join(' · ')}`,
    p.resultMatch === null
      ? '결과 대조 없음'
      : p.resultMatch
        ? '두 DB 결과 행 수 일치'
        : '두 DB 결과 행 수 불일치',
    LIVE_MARK,
  ].join('<br/>');
}

export interface CurveInput {
  /** 선택 질문 · 웜의 ClickHouse · PG(B-tree) 선(curveLines에서 I1을 뺀 것) */
  lines: CurveLine[];
  /** 선택 질문 · 웜 · I2 판정 행 — 역전 음영 원천 */
  range: PerfRange | undefined;
  /** 직접 재 본 값(라이브 실행) — 없으면 빈 배열 */
  live: { ch: LivePoint[]; pg: LivePoint[] };
  /** 우열 미정 지수(undeterminedExps) — ? 표지 */
  undetermined?: number[];
}

export function curveOption({ lines, range, live, undetermined = [] }: CurveInput): ChartOption {
  const pos = <T extends { median: number }>(xs: readonly T[]) => xs.filter((p) => p.median > 0);
  const series: Record<string, unknown>[] = lines.map((l) => {
    const pts = pos(l.points);
    const shade =
      l.store === 'postgresql' && range && range.crossover !== null
        ? {
            markArea: {
              tooltip: {
                formatter: () =>
                  range.direction
                    ? `${range.direction.from === 'clickhouse' ? 'CH' : 'PG'} → ${range.direction.to === 'clickhouse' ? 'CH' : 'PG'} · 3번 모두 같은 판정`
                    : '방향 미상',
              },
              itemStyle: { color: 'rgba(100, 116, 139, 0.14)' },
              label: {
                color: '#0f172a',
                position: 'insideTop' as const,
                fontWeight: 'bold' as const,
                fontSize: 13,
              },
              data: [
                [
                  { name: CROSS_LABEL, xAxis: 10 ** parseExp(range.crossover[0]) },
                  { xAxis: 10 ** parseExp(range.crossover[1]) },
                ],
              ],
            },
          }
        : {};
    return {
      id: `line-${l.store}`,
      name: STORE_NAME[l.store],
      type: 'line' as const,
      color: STORE_COLOR[l.store],
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      data: pts.map((p) => ({
        value: [p.rows, p.median],
        // 결과 불일치 점은 속 빈 점(P6)
        symbol: p.resultMatch === false ? 'emptyCircle' : 'circle',
      })),
      tooltip: {
        formatter: (x: { dataIndex?: number }) => {
          const p = x.dataIndex === undefined ? undefined : pts[x.dataIndex];
          return p ? pointTip(l.store, p) : '';
        },
      },
      ...shade,
      ...(l.store === 'postgresql' && undetermined.length > 0
        ? {
            markLine: {
              symbol: 'none',
              lineStyle: { type: 'dotted' as const, color: '#94a3b8' },
              label: { formatter: '?', color: '#334155', fontWeight: 'bold' as const },
              tooltip: { formatter: UNDETERMINED_TIP },
              data: undetermined.map((e) => ({ xAxis: 10 ** e, name: UNDETERMINED_TIP })),
            },
          }
        : {}),
    };
  });
  for (const side of ['pg', 'ch'] as const) {
    const pts = pos(live[side]);
    if (pts.length === 0) continue;
    const store: Store = side === 'ch' ? 'clickhouse' : 'postgresql';
    series.push({
      id: `live-${side}`,
      name: LIVE_NAME,
      type: 'line' as const,
      color: STORE_COLOR[store],
      // CH 속 빈 마름모 ◇ · PG 속 찬 마름모 ◆(§표시 계약 라이브 계열)
      symbol: side === 'ch' ? 'emptyDiamond' : 'diamond',
      symbolSize: 12,
      lineStyle: { width: 0 },
      z: 5,
      data: pts.map((p) => [p.rows, p.median]),
      tooltip: {
        formatter: (x: { dataIndex?: number }) => {
          const p = x.dataIndex === undefined ? undefined : pts[x.dataIndex];
          return p ? liveTip(store, p) : '';
        },
      },
    });
  }
  const hasLive = live.ch.length + live.pg.length > 0;
  const option = {
    animation: false,
    grid: { left: 48, right: 12, top: 28, bottom: 24 },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      textStyle: { fontSize: 12 },
      data: ['PostgreSQL', 'ClickHouse', ...(hasLive ? [LIVE_NAME] : [])],
      // 범례 "내 측정(참고용)"에 마우스를 올리면 무엇인지(직접 재 본 결과)와 라이브 표지
      tooltip: {
        show: true,
        formatter: (x: { name?: string }) => (x.name === LIVE_NAME ? LIVE_TIP : (x.name ?? '')),
      },
    },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'log',
      logBase: 10,
      min: 1e5,
      max: 1e9,
      axisLabel: { formatter: rowsTick, fontSize: 11 },
    },
    yAxis: {
      type: 'log',
      name: '걸린 시간(밀리초)',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: { align: 'left', fontSize: 11 },
      axisLabel: { fontSize: 11 },
    },
    series,
  };
  return option as unknown as ChartOption;
}
