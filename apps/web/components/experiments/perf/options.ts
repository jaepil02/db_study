// 그림 2 — "데이터가 많아질수록 걸리는 시간"(선택 질문) 차트 옵션. 순수 함수 — 판독은 lib/perf.ts가 하고 여기는 모양만 정한다.
// 선 2개(PostgreSQL 파랑 · ClickHouse 주황) · 가로 행 수 로그(10만~10억 행) · 세로 걸린 시간(밀리초) 로그 — 축 이름에 "눈금마다 10배" · 역전 구간 음영 "여기서 역전!"(방향은 툴팁) ·
// 범례는 둘 — 색 범례(PostgreSQL · ClickHouse · 내 측정)는 그림 위 왼쪽 첫 줄 · 모양 범례(속 빈 점 · 삼각형)는 둘째 줄 오른쪽(왼쪽은 세로 축 이름) —
// 기준선 · 눈금과 겹치지 않게(web-ux-polish §2.2) · 캔버스 글자 최소 12px.
// 점 모양은 뜻 하나씩(§9 P2): 속 빈 원 = 우열 미정(3번 결과가 엇갈린 규모 · §7.1 R5) · 삼각형 = 두 DB 결과가 다름(resultMatch false) · 둘 다면 속 빈 삼각형.
// 모양 범례 항목은 그 점이 실제로 그려질 때만(데이터 없는 범례 계열 · 누를 수 없음).
// 직접 재 본 결과는 "내 측정(참고용)" 속 찬 마름모(CH · PG 모두 — 색이 저장소를 가른다 · 범례 마름모는 중립 slate · 범례 툴팁에 라이브 표지). 정본 08_screen/08 §EXP-PERF 그림 2 · §표시 계약.
// 범례 폭(Pretendard 12px 실측 · 그림 아이콘 16 + 틈 5 + 글자 · 항목 사이 16 · 안쪽 여백 5 — test/perf "범례 폭"): 한 범례에 다섯을 다 두면 약 625px라
// 그림 폭(1440 534 · 1280 레일 550)을 넘어 두 줄로 접힌다 — 그래서 줄을 나눈다. 첫 줄 색 범례 셋 약 303px · 둘째 줄은 세로 축 이름 끝 약 164px(왼쪽 4부터)와
// 모양 범례 둘 약 311px(오른쪽 끝부터) 사이가 1440에서 약 59px · 1280 레일에서 약 75px 빈다.
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
/** 우열 미정 점 툴팁 · 범례 이름 — 같은 일을 3번 시켜 누가 빠른지가 엇갈린 규모(undeterminedExps) */
export const UNDETERMINED_TIP = '3번 결과가 엇갈린 점';
export const HOLLOW_NAME = '속 빈 점 = 3번 결과가 엇갈림';
/** 결과 불일치 점 툴팁 · 범례 이름 — 같은 질문에 두 DB가 낸 결과가 다른 규모(기록 점 resultMatch false) */
export const MISMATCH_TIP = '두 DB 결과가 달라요';
export const TRIANGLE_NAME = '삼각형 = 두 DB 결과가 다름';
/** 모양 범례 · 내 측정 범례 그림 색 — 저장소가 아니라 뜻을 말하는 표지라 중립 slate */
export const LEGEND_INK = '#475569';
export const CROSS_LABEL = '여기서 역전!';
/** 세로 축 이름 — 로그 눈금이라 칸마다 10배씩 커진다는 것을 이름에서 말한다(0.01 · 0.1 · 1 · 10 · 100) */
export const Y_AXIS_NAME = '걸린 시간(밀리초) · 눈금마다 10배';

/** 가로축 눈금 — 정수 지수만 "10만" · "1억"(그 사이 점은 눈금 없이 점만) */
export function rowsTick(v: number): string {
  const e = Math.round(Math.log10(v) * 1e6) / 1e6;
  return Number.isInteger(e) ? rowsWords(e).replace(' 행', '') : '';
}

/** 기록 점 툴팁 — 행 수(정확 · 지수) · 중간값 · 우열 미정 · 결과 일치 · 기록 번호 · 3번 차이가 큰 점 · 참고값(08_screen/08 §표시 계약 가로축 · 시간 참고값) */
export function pointTip(store: Store, p: PerfPoint, undetermined = false): string {
  const over = p.deviation !== null && p.deviation > p.threshold;
  return [
    `<b>${STORE_NAME[store]}</b> · ${p.rows.toLocaleString('ko-KR')}행(10^${p.exponent})`,
    undetermined ? `${UNDETERMINED_TIP}(속 빈 점)` : '',
    `중간값 ${msText(p.median)}밀리초`,
    p.resultMatch === null
      ? '결과 대조 기록 없음'
      : p.resultMatch
        ? '두 DB 결과 일치'
        : `${MISMATCH_TIP}(삼각형)`,
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
  /** 우열 미정 지수(undeterminedExps) — 그 규모의 점을 속 빈 점으로 */
  undetermined?: number[];
}

/**
 * 모양 범례 위치 — 세로 축 이름과 같은 둘째 줄. 축 이름은 가운데가 y 28(그림 위 44 − 축 이름 틈 10 − 글자 높이 반 6)이고
 * 범례는 안쪽 여백 5 + 그림 높이 반 4 + top이 글자 가운데라 top 17이면 가운데 28(첫 줄 색 범례 7~19 · 둘째 줄 22~34 · 그림 44부터).
 */
const SHAPE_LEGEND_TOP = 17;

/** 데이터 없는 범례 계열 — 범례 그림만 그린다(선 굵기 0 · 점 없음) */
const legendOnly = (id: string, name: string, symbol: string) => ({
  id,
  name,
  type: 'line' as const,
  color: LEGEND_INK,
  symbol,
  symbolSize: 10,
  lineStyle: { width: 0 },
  data: [],
});

export function curveOption({ lines, range, live, undetermined = [] }: CurveInput): ChartOption {
  const pos = <T extends { median: number }>(xs: readonly T[]) => xs.filter((p) => p.median > 0);
  const isUndetermined = (e: number) => undetermined.some((u) => Math.abs(u - e) < 1e-6);
  let hasHollow = false;
  let hasTriangle = false;
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
              // 흰 바탕 + 여백 — 음영 · 선이 글자를 지나가도 글자가 읽힌다(web-ux-polish §7.1 R5)
              label: {
                color: '#0f172a',
                position: 'insideTop' as const,
                fontWeight: 'bold' as const,
                fontSize: 13,
                backgroundColor: '#ffffff',
                padding: [2, 6],
                borderRadius: 3,
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
      data: pts.map((p) => {
        // 우열 미정 규모의 점은 조금 크게 속 빈 원(R5) · 결과 불일치 점은 삼각형(§9 P2) · 둘 다면 속 빈 삼각형
        const open = isUndetermined(p.exponent);
        const wrong = p.resultMatch === false;
        if (open) hasHollow = true;
        if (wrong) hasTriangle = true;
        return {
          value: [p.rows, p.median],
          symbol: wrong ? (open ? 'emptyTriangle' : 'triangle') : open ? 'emptyCircle' : 'circle',
          ...(open ? { symbolSize: 10, itemStyle: { borderWidth: 2 } } : wrong ? { symbolSize: 9 } : {}),
        };
      }),
      tooltip: {
        formatter: (x: { dataIndex?: number }) => {
          const p = x.dataIndex === undefined ? undefined : pts[x.dataIndex];
          return p ? pointTip(l.store, p, isUndetermined(p.exponent)) : '';
        },
      },
      ...shade,
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
      // CH · PG 모두 속 찬 마름모 — 색이 저장소를 가른다(속 빈 모양은 우열 미정만 뜻한다 · §9 P2)
      symbol: 'diamond',
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
  // 모양 범례 "속 빈 점 = 3번 결과가 엇갈림" · "삼각형 = 두 DB 결과가 다름" — 데이터 없는 계열(범례 그림만 · 선 굵기 0) · 그 점이 그려질 때만
  if (hasHollow) series.push(legendOnly('hollow-legend', HOLLOW_NAME, 'emptyCircle'));
  if (hasTriangle) series.push(legendOnly('triangle-legend', TRIANGLE_NAME, 'triangle'));
  const shapes = [...(hasHollow ? [HOLLOW_NAME] : []), ...(hasTriangle ? [TRIANGLE_NAME] : [])];
  const hasLive = live.ch.length + live.pg.length > 0;
  const legendBase = {
    itemWidth: 16,
    itemHeight: 8,
    itemGap: 16,
    textStyle: { fontSize: 12, color: '#334155' },
  };
  const option = {
    animation: false,
    // 첫 줄(0~16) 색 범례 · 둘째 줄(약 22~36) 왼쪽 세로 축 이름 · 오른쪽 모양 범례 · 그 아래부터 그림
    grid: { left: 48, right: 16, top: 44, bottom: 26 },
    legend: [
      {
        ...legendBase,
        top: 0,
        left: 0,
        // 내 측정 범례 마름모는 중립 slate(점은 저장소 색 둘이라 범례 하나가 어느 한 색을 빌리지 않게)
        data: [
          'PostgreSQL',
          'ClickHouse',
          ...(hasLive ? [{ name: LIVE_NAME, itemStyle: { color: LEGEND_INK } }] : []),
        ],
        // 범례 "내 측정(참고용)"에 마우스를 올리면 무엇인지(직접 재 본 결과)와 라이브 표지
        tooltip: {
          show: true,
          formatter: (x: { name?: string }) => (x.name === LIVE_NAME ? LIVE_TIP : (x.name ?? '')),
        },
      },
      ...(shapes.length > 0
        ? [
            {
              ...legendBase,
              top: SHAPE_LEGEND_TOP,
              right: 0,
              // 뜻 풀이라 눌러서 숨길 것이 없다
              selectedMode: false,
              data: shapes,
              tooltip: {
                show: true,
                formatter: (x: { name?: string }) =>
                  x.name === HOLLOW_NAME
                    ? UNDETERMINED_TIP
                    : x.name === TRIANGLE_NAME
                      ? MISMATCH_TIP
                      : (x.name ?? ''),
              },
            },
          ]
        : []),
    ],
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'log',
      logBase: 10,
      min: 1e5,
      max: 1e9,
      axisLabel: { formatter: rowsTick, fontSize: 12, color: '#475569' },
    },
    yAxis: {
      type: 'log',
      name: Y_AXIS_NAME,
      nameLocation: 'end',
      nameGap: 10,
      // 축 이름은 축 선 위에서 왼쪽 끝(눈금 숫자 열)부터 — 범례 줄 아래
      nameTextStyle: { align: 'left', fontSize: 12, color: '#475569', padding: [0, 0, 0, -44] },
      axisLabel: { formatter: (v: number) => msText(v), fontSize: 12, color: '#475569' },
    },
    series,
  };
  return option as unknown as ChartOption;
}
