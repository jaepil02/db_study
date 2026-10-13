// ⑤ ② 조회 대결 그림 옵션 — 원천 행 수 단계(넣기 건수와 같은 10만 ~ 10억 · 사용자 결정 2026-10-12 — 꺾은선). 순수 함수.
// 가로 = 단계(10만 ~ 10억 · 늘 9칸 — 못 잰 칸도 자리를 지킨다) · 세로 = 집계 걸린 시간 중간값(ms · 로그 — 10배마다 한 칸).
// 선 2개(ClickHouse 주황 · PostgreSQL 파랑 — 점이 9개뿐이라 점을 찍는다) · 이름은 선 끝 글자(CH · PG) + 칸 안 범례(HTML) 둘(색만으로 가르지 않는다).
// 축 아래 두째 줄 = 그 단계의 판정("CH 4.5배" — 빠른 쪽 색 · "비슷" · "재는 중…" · "못 잼") — 단계 칸과 글자가 늘 같은 자리에 선다.
// 점에 마우스를 올리면 그 단계의 ClickHouse 시간 · PostgreSQL 시간 · 몇 배 빠른지만(사용자 지시 2026-10-12 — 한 눈에).
import type { ChartEnv, ChartOption } from '../experiments/echart';
import { STORE } from '../ui/store';
import type { QueryPoint, QueryView } from './lab-model';

const AXIS_TEXT = '#475569';
const GRID_LINE = '#e2e8f0';

/** 축 아래 판정 글자 색 이름 — rich 스타일 키 */
function markStyle(p: QueryPoint): 'ch' | 'pg' | 'even' | 'run' | 'mute' {
  if (p.phase === 'running') return 'run';
  if (p.phase !== 'done') return 'mute';
  return p.faster ?? 'even';
}

/** 세로 눈금 — 1,000ms부터 s(1s · 10s) · 그 아래는 ms 숫자만(단위는 그림 머리 글자가 한 번 말한다) */
export function logTick(n: number): string {
  if (n >= 1000) return `${(n / 1000).toLocaleString('ko-KR')}s`;
  return String(Number(n.toPrecision(3)));
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 툴팁 — 끝난 단계는 단계 이름 · ClickHouse 시간 · PostgreSQL 시간(저장소 색 점) · 차이(빠른 쪽 색 굵게) 네 줄.
 * 끝나지 않은 단계는 단계 이름 · 사유 한 줄. 글은 lab-model tip과 같다(색만 더한다).
 */
export function queryTooltipHtml(p: QueryPoint | undefined): string {
  if (!p) return '';
  const [head = '', ...rest] = p.tip.split('\n');
  if (p.phase !== 'done' || p.chText === null || p.pgText === null)
    return [`<b>${esc(head)}</b>`, ...rest.map(esc)].join('<br/>');
  const dot = (k: 'ch' | 'pg') =>
    `<span style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;margin-right:0.4em;background:${STORE[k].color}"></span>`;
  const time = (k: 'ch' | 'pg', text: string) =>
    `${dot(k)}${STORE[k].label} <b style="font-variant-numeric:tabular-nums">${esc(text)}</b>`;
  const color = p.faster ? STORE[p.faster].ink : AXIS_TEXT;
  return [
    `<b>${esc(head)}</b>`,
    time('ch', p.chText),
    time('pg', p.pgText),
    `<b style="color:${color}">${esc(p.mark)}</b>`,
  ].join('<br/>');
}

interface AxisParam {
  dataIndex?: number;
}

/**
 * 단계 칸마다 점 — 끝난 단계만 값(나머지 null — 선이 끊긴다). 값이 하나도 없으면(첫 단계 전) 눈금 글자 없는 빈 축.
 * 재는 중에는 단계가 끝날 때마다 다시 짓는다(애니메이션 없음 — 같은 캔버스에 곧바로 그린다).
 */
export function queryOption(v: Pick<QueryView, 'points'>, env: ChartEnv): ChartOption {
  const font = env.font;
  const value = (p: QueryPoint, key: 'ch' | 'pg') => {
    const x = p[key];
    return p.phase === 'done' && x !== null && x > 0 ? x : null;
  };
  const empty = v.points.every((p) => value(p, 'ch') === null && value(p, 'pg') === null);
  const line = (key: 'ch' | 'pg') => ({
    id: `query-${key}`,
    name: STORE[key].label,
    type: 'line' as const,
    color: STORE[key].color,
    showSymbol: true,
    symbol: 'circle',
    symbolSize: Math.round(font * 0.6),
    connectNulls: false,
    lineStyle: { width: 2, cap: 'round' as const, join: 'round' as const },
    itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
    endLabel: {
      show: true,
      fontSize: font,
      fontWeight: 600,
      color: '#334155',
      distance: 6,
      formatter: () => STORE[key].short,
    },
    data: v.points.map((p) => value(p, key)),
  });
  const rich = {
    ch: { color: STORE.ch.ink, fontWeight: 700, fontSize: font },
    pg: { color: STORE.pg.ink, fontWeight: 700, fontSize: font },
    even: { color: AXIS_TEXT, fontSize: font },
    run: { color: '#0369a1', fontWeight: 600, fontSize: font },
    mute: { color: '#94a3b8', fontSize: font },
  };
  const option = {
    animation: false,
    grid: {
      left: Math.round(font * 2.8),
      right: Math.round(font * 2.6),
      top: Math.round(font * 0.8),
      bottom: Math.round(font * 3.1),
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#94a3b8', width: 1 } },
      textStyle: { fontSize: font, color: '#0f172a', lineHeight: Math.round(font * 1.5) },
      formatter: (ps: unknown) => {
        const first = (Array.isArray(ps) ? ps[0] : ps) as AxisParam | undefined;
        return queryTooltipHtml(v.points[first?.dataIndex ?? -1]);
      },
    },
    xAxis: {
      type: 'category',
      data: v.points.map((p) => p.name),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        interval: 0,
        fontSize: font,
        color: AXIS_TEXT,
        lineHeight: Math.round(font * 1.35),
        // 첫 줄 단계 이름 · 둘째 줄 판정 — 빈 판정도 줄을 지켜 칸 높이가 흔들리지 않게(공백 한 칸)
        formatter: (name: string, i: number) => {
          const p = v.points[i];
          return p ? `${name}\n{${markStyle(p)}|${p.axis || ' '}}` : name;
        },
        rich,
      },
    },
    yAxis: {
      type: 'log',
      logBase: 10,
      ...(empty ? { min: 1, max: 1000 } : {}),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: GRID_LINE, width: 1, type: 'solid' } },
      axisLabel: { show: !empty, formatter: (n: number) => logTick(n), fontSize: font, color: AXIS_TEXT },
    },
    series: [line('ch'), line('pg')],
  };
  return option as unknown as ChartOption;
}
