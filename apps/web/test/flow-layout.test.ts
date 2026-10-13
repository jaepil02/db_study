// /monitoring 흐름도 배치 — 브라우저 없이 겹침 0을 계산으로 본다(글자 폭은 보수적 어림 — diagram-layout.ts textWidth)
// 최악의 문구: 6자리 초당 값(999,999) · 10억 행 누적 · 999GB 크기 · 꺼진 노드 문구 · 수집기 모드 · 업무 결과 표지.
// 배치는 설계 §8 · §9 — 노드 12(출처 3 · Redis 기둥 칸 5 · 처리 2 · DB 2) · 기둥 머리 · 바닥 · 업무 줄 옆 한 줄도 겹침 검사에 든다.
// 조회 줄(§9.2)은 점이 없다 — 대신 조회 선이 처리기 노드를 지나지 않는지(api가 직접 Redis를 먼저 본다) · 라벨이 겹치지 않는지 본다.
// 글자 바닥(docs/08_screen/01_standards.md §글자와 화면 표면): 화면 안 글자 최소 12(1440 × 900 배율 × viewBox 글자) · ⑤ → DB 두 번 이하 꺾기 · ClickHouse 오른쪽 끝 우회 없음 ·
//   선끼리 교차 수 기록(옛 배치 1 · 3 · 3 → 0) · 선이 라벨 · 글자를 지나지 않는다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BATCH_AT,
  BATCH_BENDS,
  BIZ_AT,
  BIZ_BENDS,
  BIZ_DOT_R,
  BIZ_NOTE,
  BOX,
  type Box,
  type BoxId,
  COLUMN_Y,
  COLUMNS,
  DIVIDER_YS,
  DIVIDERS,
  DOT_R_MAX,
  EDGE,
  EDGE_W_MAX,
  type EdgeId,
  FONT,
  HAS_LANE,
  inside,
  LANE_A,
  LANE_B,
  labelBox,
  lineSize,
  MARK_AT,
  MARK_ICON,
  MARK_ICON_GAP,
  markBox,
  type NodeLine,
  nodeTextBoxes,
  overlaps,
  PILLAR,
  PILLAR_FOOT_Y,
  PILLAR_HEAD_Y,
  type Pt,
  pointAlong,
  READ_DOT_R,
  READ_MS,
  READ_REST,
  READ_ROUTES,
  readPos,
  routeMs,
  textWidth,
  VIEW_H,
  VIEW_W,
} from '../components/experiments/flow/diagram-layout';
import { DotEngine, FlowDiagram, MARK_ICONS } from '../components/experiments/flow/flow-diagram';
import {
  BIZ_WORKER_LINES,
  bizSrcLines,
  bizStreamLines,
  COMPARE_NOTE,
  edgeRate,
  headlines,
  latestLines,
  markText,
  NO_BIZ_TEXT,
  NO_READ_TEXT,
  PILLAR_HEAD,
  pillarFootText,
  readCacheLines,
  readMissLabel,
  readSrcLines,
  replyLines,
  sourceLines,
  storeLines,
  streamLines,
  waitLine,
  whyCards,
  workerLines,
} from '../components/experiments/flow/node-lines';
import type { FlowMetrics, FlowRates, FlowSwitchFlags, ReadRates } from '../lib/flow';
import { batchDotRadius, DUPLICATE_MARK, edgeWidth, OUTCOME_MARK, READ_KINDS } from '../lib/flow';

const BIG = 999_999;
const rates: FlowRates = {
  batches: BIG,
  rows: BIG,
  chRows: BIG,
  controlCopyRows: BIG,
  latestWrites: BIG,
  commands: BIG,
  commandsWriter: BIG,
  commandsDirect: BIG,
  applied: BIG,
  rejected: BIG,
  failed: BIG,
  expired: BIG,
};
/** 조회 최악 — 6자리 건/초 · 6자리 지금 값 · 1% 미만 · 100% */
const READS: ReadRates = {
  requests: BIG,
  hit: BIG * 0.999,
  chMiss: BIG * 0.001,
  bypass: 0,
  pgMiss: 1,
  error: 0,
  latestPoints: BIG,
};
const READS_ALL_MISS: ReadRates = { ...READS, hit: 0, chMiss: BIG / 2, pgMiss: BIG / 2 };
const READS_NONE: ReadRates = {
  requests: 0,
  hit: 0,
  chMiss: 0,
  bypass: 0,
  pgMiss: 0,
  error: 0,
  latestPoints: 0,
};
const flags = (over: Partial<FlowSwitchFlags> = {}): FlowSwitchFlags => ({
  controlCopyOff: false,
  controlCopyGated: false,
  collectorLatest: false,
  streamOff: false,
  directGateway: false,
  deadband: false,
  bizDirect: false,
  ...over,
});
const metrics = {
  clickhouse: { tables: { tag_raw: { rows: 1e9, bytesOnDisk: 999.99 * 1024 ** 3 } } },
  postgres: { tables: { x: { liveTuples: 1e9, heapBytes: 999 * 1024 ** 3, indexBytes: 0 } } },
  redis: { usedMemoryBytes: 999 * 1024 ** 3 },
} as unknown as FlowMetrics;
/** 노드마다 가장 긴 줄 모음(스위치 조합 전부) */
function worstNodeLines(): Record<BoxId, NodeLine[][]> {
  const stores = storeLines(rates, metrics);
  return {
    src: [sourceLines(BIG), sourceLines(null)],
    bizSrc: [bizSrcLines(rates), bizSrcLines(null)],
    readSrc: [readSrcLines(READS), readSrcLines(null)],
    readCache: [readCacheLines(READS), readCacheLines(READS_ALL_MISS), readCacheLines(null)],
    stream: [streamLines(1e9, false), streamLines(null, true)],
    latest: [latestLines(rates, flags()), latestLines(rates, flags({ collectorLatest: true }))],
    bizStream: [bizStreamLines(1e9, false), bizStreamLines(null, true)],
    reply: [replyLines(rates, false), replyLines(rates, true), replyLines(null, false)],
    worker: [workerLines(rates), workerLines({ ...rates, batches: 0.02 }), workerLines(null)],
    bizWorker: [[...BIZ_WORKER_LINES]],
    ch: [stores.ch],
    pg: [stores.pg],
  };
}

/** 간선 라벨 최악 문구 — flow-diagram.tsx가 넘기는 모양 그대로(꺼진 길은 그리지 않는다) */
const WORST_LABELS: Partial<Record<EdgeId, string[][]>> = {
  'src-stream': [[edgeRate(BIG, '개') as string]],
  'stream-worker': [[edgeRate(BIG, '개') as string]],
  'worker-latest': [['지금 값 씀']],
  'worker-pg-copy': [['비교용 사본', edgeRate(BIG, '개') as string], ['비교용 사본']],
  'biz-stream': [[edgeRate(BIG, '건') as string]],
  'biz-pg': [['업무 기록']],
  'biz-commit': [['COMMIT 응답']],
  'biz-notice': [['저장한 뒤']],
  'biz-reply': [['결과 받음']],
  'biz-direct': [['대기줄 없이 바로 저장', '(비교 실험)']],
  'read-ask': [[edgeRate(BIG, '건') as string]],
  'read-answer': [['응답']],
  'read-miss': [
    readMissLabel(READS),
    readMissLabel(READS_ALL_MISS),
    readMissLabel(null),
    readMissLabel(READS_NONE),
  ],
};

const NODE_IDS = Object.keys(BOX) as BoxId[];
const joined = (lines: readonly NodeLine[]) => lines.map((l) => l.text).join(' / ');
const CELLS = ['stream', 'latest', 'bizStream', 'reply', 'readCache'] as const satisfies readonly BoxId[];
const shrink = (b: Box, d: number): Box => ({ x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d });
const VIEW: Box = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
/** 점 자리 전부(배치 · 업무) — 이름 붙여 */
const DOT_SPOTS: [string, Pt][] = [
  ...Object.entries(BATCH_AT).map(([k, p]) => [`batch.${k}`, p] as [string, Pt]),
  ...Object.entries(BIZ_AT).map(([k, p]) => [`biz.${k}`, p] as [string, Pt]),
];
const dotBox = (p: Pt): Box => ({
  x: p.x - DOT_R_MAX,
  y: p.y - DOT_R_MAX,
  w: 2 * DOT_R_MAX,
  h: 2 * DOT_R_MAX,
});
/** 기둥 머리 · 바닥 글자 상자 · 업무 줄 옆 한 줄 상자 — 그림 안 고정 글자 */
const pillarHead = labelBox({ x: PILLAR.x + PILLAR.w / 2, y: PILLAR_HEAD_Y, align: 'middle' }, [PILLAR_HEAD]);
const pillarFoot = labelBox({ x: PILLAR.x + PILLAR.w / 2, y: PILLAR_FOOT_Y, align: 'middle' }, [
  pillarFootText(metrics),
]);
const bizNote = labelBox(BIZ_NOTE.spot, BIZ_NOTE.lines);
const FIXED_TEXT: [string, Box][] = [
  ['기둥 머리', pillarHead],
  ['기둥 바닥', pillarFoot],
  ['업무 줄 옆 한 줄', bizNote],
];

describe('흐름도 배치 — 구성(설계 §8 · §9)', () => {
  it('노드 12 = 출처 3 · Redis 기둥 칸 5 · 처리 2 · DB 2 — 오른쪽 저장 열에 Redis 노드가 없다', () => {
    expect(NODE_IDS).toHaveLength(12);
    expect(NODE_IDS).not.toContain('redis');
    for (const id of CELLS) expect(inside(BOX[id], PILLAR), `${id} 칸은 기둥 안`).toBe(true);
    for (const id of ['src', 'bizSrc', 'readSrc'] as const)
      expect(BOX[id].x + BOX[id].w).toBeLessThan(PILLAR.x);
    for (const id of ['worker', 'bizWorker'] as const) expect(BOX[id].x).toBeGreaterThan(PILLAR.x + PILLAR.w);
    for (const id of ['ch', 'pg'] as const) expect(BOX[id].x).toBeGreaterThan(BOX.worker.x + BOX.worker.w);
  });
  it('기둥 칸 다섯은 위에서 ① ② ③ ④ ⑤ 순서로 서로 겹치지 않는다 · 줄 가름은 칸 사이', () => {
    // 가름은 기둥 밖 두 토막(어디서 오나 · 누가 처리하나)에만 그린다 — 그 토막과 가로로 겹치는 노드만 본다(DB 열에는 가름이 없다)
    for (const y of DIVIDER_YS)
      for (const [x1, x2] of DIVIDERS)
        for (const id of NODE_IDS) {
          const b = BOX[id];
          if (b.x + b.w <= x1 || b.x >= x2) continue;
          expect(y > b.y && y < b.y + b.h, `가름 ${y} ↔ ${id}`).toBe(false);
        }
    for (let i = 1; i < CELLS.length; i++) {
      const a = BOX[CELLS[i - 1] as BoxId];
      const b = BOX[CELLS[i] as BoxId];
      expect(a.y + a.h).toBeLessThan(b.y);
    }
  });
  it('업무 점 경로 — 하나씩 처리 → PostgreSQL → ④(옛 사본 지움 → 결과 알림) → 업무 요청', () => {
    expect(inside(dotBox(BIZ_AT.bizWorker), BOX.bizWorker)).toBe(true);
    expect(inside(dotBox(BIZ_AT.pgTx), BOX.pg)).toBe(true);
    expect(inside(dotBox(BIZ_AT.cache), BOX.reply)).toBe(true);
    expect(inside(dotBox(BIZ_AT.result), BOX.reply)).toBe(true);
    expect(BIZ_AT.cache.x).toBeGreaterThan(BIZ_AT.result.x);
    expect(inside(dotBox(BIZ_AT.api), BOX.bizSrc)).toBe(true);
    expect(inside(dotBox(BATCH_AT.latest), BOX.latest)).toBe(true);
    expect(inside(dotBox(BATCH_AT.stream), BOX.stream)).toBe(true);
    expect(inside(dotBox(BIZ_AT.bizStream), BOX.bizStream)).toBe(true);
  });
  it('되돌아가는 간선 — 처리기 → ②(지금 값) · 처리기 → ④ 끝이 기둥 칸 오른쪽 가장자리 · ④ → 업무 요청', () => {
    const end = (id: EdgeId) => EDGE[id].path[EDGE[id].path.length - 1] as Pt;
    const start = (id: EdgeId) => EDGE[id].path[0] as Pt;
    const right = BOX.latest.x + BOX.latest.w;
    expect(end('worker-latest').x).toBe(right);
    expect(end('worker-latest').y).toBeGreaterThan(BOX.latest.y);
    expect(end('worker-latest').y).toBeLessThan(BOX.latest.y + BOX.latest.h);
    expect(end('biz-notice').x).toBe(right);
    expect(end('biz-notice').y).toBeGreaterThan(BOX.reply.y);
    expect(end('biz-notice').y).toBeLessThan(BOX.reply.y + BOX.reply.h);
    expect(start('biz-reply').x).toBe(BOX.reply.x);
    expect(end('biz-reply').y).toBe(BOX.bizSrc.y + BOX.bizSrc.h);
  });
});

describe('흐름도 배치 — 조회 줄(§9.2)', () => {
  const end = (id: EdgeId) => EDGE[id].path[EDGE[id].path.length - 1] as Pt;
  const start = (id: EdgeId) => EDGE[id].path[0] as Pt;
  const onEdge = (p: Pt, b: Box) =>
    (p.x === b.x || p.x === b.x + b.w) && p.y > b.y && p.y < b.y + b.h
      ? true
      : (p.y === b.y || p.y === b.y + b.h) && p.x > b.x && p.x < b.x + b.w;
  it('조회 요청 → ⑤ · ⑤ → 조회 요청 · ⑤ → PostgreSQL 바닥 · ⑤ → ClickHouse 가장자리', () => {
    expect(onEdge(start('read-ask'), BOX.readSrc)).toBe(true);
    expect(onEdge(end('read-ask'), BOX.readCache)).toBe(true);
    expect(onEdge(start('read-answer'), BOX.readCache)).toBe(true);
    expect(onEdge(end('read-answer'), BOX.readSrc)).toBe(true);
    expect(start('read-miss').x).toBe(BOX.readCache.x + BOX.readCache.w);
    expect(start('read-pg')).toEqual(end('read-miss'));
    expect(start('read-ch')).toEqual(end('read-miss'));
    expect(onEdge(end('read-pg'), BOX.pg)).toBe(true);
    expect(onEdge(end('read-ch'), BOX.ch)).toBe(true);
  });
  it('조회 선은 처리기 노드(누가 처리하나)를 지나지 않는다 — 어떤 노드 안도 지나지 않는다', () => {
    for (const id of ['read-ask', 'read-answer', 'read-miss', 'read-pg', 'read-ch'] as const) {
      const pts = EDGE[id].path;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1] as Pt;
        const b = pts[i] as Pt;
        for (let k = 1; k < 50; k++) {
          const p = { x: a.x + ((b.x - a.x) * k) / 50, y: a.y + ((b.y - a.y) * k) / 50 };
          for (const n of NODE_IDS)
            expect(inside({ ...p, w: 0, h: 0 }, shrink(BOX[n], 1)), `${id} ↔ ${n}`).toBe(false);
        }
      }
    }
  });
  it('배치 · 업무 점 자리는 조회 줄 노드 안에 없다(조회 점은 선만 탄다)', () => {
    for (const [name, p] of DOT_SPOTS)
      for (const id of ['readSrc', 'readCache'] as const)
        expect(inside({ ...p, w: 0, h: 0 }, BOX[id]), `${name} ↔ ${id}`).toBe(false);
  });
  it('조회가 없으면 줄기 라벨이 보내 보라는 한 줄이다', () => {
    expect(readMissLabel(READS_NONE)).toEqual([NO_READ_TEXT]);
  });
  it('⑤ → PostgreSQL · ⑤ → ClickHouse는 두 번 이하로 꺾인다 · ClickHouse 오른쪽 끝을 돌지 않는다(바닥 가장자리로 든다)', () => {
    const toPg = [...EDGE['read-miss'].path, ...EDGE['read-pg'].path.slice(1)];
    const toCh = [...EDGE['read-miss'].path, ...EDGE['read-ch'].path.slice(1)];
    expect(bends(toPg), '⑤ → PostgreSQL').toBeLessThanOrEqual(2);
    expect(bends(toCh), '⑤ → ClickHouse').toBeLessThanOrEqual(2);
    const chRight = BOX.ch.x + BOX.ch.w;
    for (const id of ['read-ask', 'read-answer', 'read-miss', 'read-pg', 'read-ch'] as const)
      for (const p of EDGE[id].path) expect(p.x, `${id} 오른쪽 끝 우회`).toBeLessThan(chRight);
    expect(end('read-ch').y).toBe(BOX.ch.y + BOX.ch.h);
    // ClickHouse로 오르는 통로는 PostgreSQL 오른쪽 · ClickHouse 안쪽
    expect(end('read-ch').x).toBeGreaterThan(BOX.pg.x + BOX.pg.w);
  });
});

/** 꺾인 수 — 연속한 두 토막의 방향이 바뀐 횟수(같은 방향으로 이어진 점은 세지 않는다) */
function bends(pts: readonly Pt[]): number {
  let n = 0;
  for (let i = 2; i < pts.length; i++) {
    const a = pts[i - 2] as Pt;
    const b = pts[i - 1] as Pt;
    const c = pts[i] as Pt;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross !== 0) n++;
  }
  return n;
}

/** 선 토막 둘이 서로 가로지르는가(끝점 맞닿음 · 같은 선 위 이어짐은 교차가 아니다) */
function segmentsCross(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
const segments = (id: EdgeId): [Pt, Pt][] =>
  EDGE[id].path.slice(1).map((p, i) => [EDGE[id].path[i] as Pt, p] as [Pt, Pt]);
function crossings(ids: readonly EdgeId[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (const [a1, a2] of segments(ids[i] as EdgeId))
        for (const [b1, b2] of segments(ids[j] as EdgeId))
          if (segmentsCross(a1, a2, b1, b2)) out.push(`${ids[i]} × ${ids[j]}`);
  return out;
}
/** 화면에 함께 그려지는 간선 묶음 — flow-diagram.tsx의 스위치 조건 그대로(기본 · 비교용 사본 켬 · 대기줄 없이 바로 저장 + 사본) */
const DRAWN_BASE: EdgeId[] = [
  'src-stream',
  'stream-worker',
  'worker-ch',
  'worker-latest',
  'biz-stream',
  'biz-worker',
  'biz-pg',
  'biz-commit',
  'biz-notice',
  'biz-reply',
  'read-ask',
  'read-answer',
  'read-miss',
  'read-pg',
  'read-ch',
];
const BIZ_QUEUE_EDGES: EdgeId[] = [
  'biz-stream',
  'biz-worker',
  'biz-pg',
  'biz-commit',
  'biz-notice',
  'biz-reply',
];
const DRAWN_SETS: [string, EdgeId[]][] = [
  ['기본(비교용 사본 꺼짐)', DRAWN_BASE],
  ['비교용 사본 켬', [...DRAWN_BASE, 'worker-pg-copy']],
  [
    '대기줄 없이 바로 저장 + 사본',
    [...DRAWN_BASE.filter((id) => !BIZ_QUEUE_EDGES.includes(id)), 'biz-direct', 'worker-pg-copy'],
  ],
];

describe('흐름도 배치 — 선 교차(다듬기 §2.3)', () => {
  // 옛 배치(viewBox 1132 × 474): 기본 1 · 사본 켬 3(+ ClickHouse 선 × 사본 버스 · 업무 기록 × 사본 버스) · 바로 저장 + 사본 3 —
  //   PostgreSQL로 드는 선이 처리기 오른쪽에서 나와 세로 버스를 탔다. 지금은 처리기 바닥에서 내려와 한 번 꺾여 든다.
  const BEFORE: Record<string, number> = {
    '기본(비교용 사본 꺼짐)': 1,
    '비교용 사본 켬': 3,
    '대기줄 없이 바로 저장 + 사본': 3,
  };
  it.each(DRAWN_SETS)('%s — 선끼리 교차 0(옛 배치보다 적다)', (name, ids) => {
    const c = crossings(ids);
    expect(c, c.join(' · ')).toHaveLength(0);
    expect(c.length).toBeLessThan(BEFORE[name] ?? 0);
  });
});

/** 배치 점 길 — 다리 사이에 꺾는 자리(BATCH_BENDS)를 끼운 자리 목록 */
function batchRoute(nodes: readonly (keyof typeof BATCH_AT)[]): Pt[] {
  const out: Pt[] = [BATCH_AT[nodes[0] as keyof typeof BATCH_AT]];
  for (let i = 1; i < nodes.length; i++)
    out.push(
      ...(BATCH_BENDS[`${nodes[i - 1]}>${nodes[i]}`] ?? []),
      BATCH_AT[nodes[i] as keyof typeof BATCH_AT],
    );
  return out;
}
/** 업무 점 길 — 다리 사이에 꺾는 자리(BIZ_BENDS)를 끼운 자리 목록 */
function bizRoute(nodes: readonly (keyof typeof BIZ_AT)[]): Pt[] {
  const out: Pt[] = [BIZ_AT[nodes[0] as keyof typeof BIZ_AT]];
  for (let i = 1; i < nodes.length; i++)
    out.push(...(BIZ_BENDS[`${nodes[i - 1]}>${nodes[i]}`] ?? []), BIZ_AT[nodes[i] as keyof typeof BIZ_AT]);
  return out;
}
/** 대기줄을 거치는 업무 점 길 셋 — lib/flow bizPlan 다리 순서(ok · 거절 · 저장 없이 이미 처리됨 · 시간 초과) */
const BIZ_ROUTES: [string, Pt[]][] = [
  ['업무', bizRoute(['api', 'bizStream', 'bizWorker', 'pgTx', 'bizWorker', 'cache', 'result', 'api'])],
  ['업무 거절', bizRoute(['api', 'bizStream', 'bizWorker', 'pgTx', 'bizWorker', 'result', 'api'])],
  ['업무 저장 없이', bizRoute(['api', 'bizStream', 'bizWorker', 'result', 'api'])],
];
/** 조회 점이 보이는 다리마다의 꺾은 길(⑤ 안을 가로지르는 숨은 다리는 뺀다 — 다리끼리 이어 붙이지 않는다) */
function readLegs(kind: (typeof READ_KINDS)[number]): Pt[][] {
  return READ_ROUTES[kind].filter((l) => !l.hidden).map((l) => [...l.pts]);
}
/** 꺾은 길의 토막마다 고르게 51점 — 점 상자 겹침 검사용 */
function samples(pts: readonly Pt[], gap?: (i: number) => boolean): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length; i++) {
    if (gap?.(i)) continue;
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    for (let k = 0; k <= 50; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / 50, y: a.y + ((b.y - a.y) * k) / 50 });
  }
  return out;
}
const boxAt = (p: Pt, r: number): Box => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r });

describe('흐름도 배치 — 노드 글자', () => {
  const worst = worstNodeLines();
  it.each(NODE_IDS)('%s — 가장 긴 줄도 상자 안(여백 4)', (id) => {
    for (const lines of worst[id])
      for (const t of nodeTextBoxes(id, lines))
        expect(inside(t, shrink(BOX[id], 4)), `${id} "${joined(lines)}"`).toBe(true);
  });
  it.each(NODE_IDS.filter((id) => HAS_LANE[id]))('%s — 글자가 점 길(반지름 상한 포함) 위에 있다', (id) => {
    const lane = BOX[id].y + BOX[id].h - 13; // 노드마다 자기 점 길(센서 줄 = LANE_A · 업무 줄 = LANE_B)
    if (BOX[id].y === BOX.src.y) expect(lane).toBe(LANE_A);
    if (BOX[id].y === BOX.bizSrc.y) expect(lane).toBe(LANE_B);
    for (const lines of worst[id])
      for (const t of nodeTextBoxes(id, lines)) expect(t.y + t.h).toBeLessThanOrEqual(lane - DOT_R_MAX);
  });
  it.each(['ch', 'pg'] as const)('%s — 점 자리(왼쪽 가장자리)가 글자와 만나지 않는다', (id) => {
    const xs = [...Object.values(BATCH_AT), ...Object.values(BIZ_AT)]
      .filter((p) => p.x > BOX.ch.x && p.y >= BOX[id].y && p.y <= BOX[id].y + BOX[id].h)
      .map((p) => p.x + DOT_R_MAX);
    for (const lines of worst[id])
      for (const t of nodeTextBoxes(id, lines)) for (const x of xs) expect(t.x).toBeGreaterThan(x);
  });
  it.each(NODE_IDS)('%s — 안에 머무는 점(반지름 상한)이 그 노드 글자와 겹치지 않는다', (id) => {
    const spots = DOT_SPOTS.filter(([, p]) => inside({ x: p.x, y: p.y, w: 0, h: 0 }, BOX[id]));
    for (const lines of worstNodeLines()[id])
      for (const t of nodeTextBoxes(id, lines))
        for (const [name, p] of spots) expect(overlaps(dotBox(p), t), `${name} ↔ ${id} "${t.w}"`).toBe(false);
  });
  it('점 자리는 어느 고정 글자(기둥 머리 · 바닥 · 업무 줄 옆 한 줄)와도 겹치지 않는다', () => {
    for (const [name, p] of DOT_SPOTS)
      for (const [fid, b] of FIXED_TEXT) expect(overlaps(dotBox(p), b), `${name} ↔ ${fid}`).toBe(false);
  });
  it('점이 지나가는 길(멈춤 자리 사이 · 꺾는 자리 포함)도 노드 글자 · 고정 글자를 가로지르지 않는다', () => {
    // 배치 ⑧ 순서(본 점 · 처리기에서 갈라지는 사본 점) · 업무 명령 경로(COMMIT 응답 · 저장한 뒤 · 결과 받음 선) · 대기줄 없이 바로 저장 ·
    // 조회 갈래마다 보이는 다리 — lib/flow batchPlan · bizPlan의 다리 순서 · diagram-layout READ_ROUTES. 배치 · 업무는 반지름 상한, 조회는 조회 점 반지름
    const routes: [string, Pt[]][] = [
      ['배치', batchRoute(['src', 'stream', 'worker', 'ch', 'xack', 'latest'])],
      ['배치 사본', [BATCH_AT.worker, ...(BATCH_BENDS['worker>pgCopy'] ?? []), BATCH_AT.pgCopy]],
      ...BIZ_ROUTES,
      ['업무 바로 저장', bizRoute(['api', 'pgTx', 'cache', 'result', 'api'])],
      ...READ_KINDS.flatMap((k) =>
        readLegs(k).map((pts, i) => [`조회 ${k} 다리 ${i}`, pts] as [string, Pt[]]),
      ),
    ];
    const texts: [string, Box][] = [
      ...FIXED_TEXT,
      ...NODE_IDS.flatMap((id) =>
        worstNodeLines()[id].flatMap((lines) =>
          nodeTextBoxes(id, lines).map((b) => [id, b] as [string, Box]),
        ),
      ),
    ];
    for (const [name, pts] of routes)
      for (const p of samples(pts))
        for (const [tid, t] of texts)
          expect(
            overlaps(name.startsWith('조회') ? boxAt(p, READ_DOT_R) : dotBox(p), t),
            `${name} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) ↔ ${tid}`,
          ).toBe(false);
  });
  it('사본 점은 처리기 점 길에서 사본 선으로 내려와 그 선 위를 타고 PostgreSQL로 든다', () => {
    const copy = EDGE['worker-pg-copy'].path;
    const [turn, down] = BATCH_BENDS['worker>pgCopy'] ?? [];
    // 처리기 점 길(본 점과 같은 높이)에서 사본 선이 내려오는 x로
    expect(turn).toEqual({ x: copy[0]?.x, y: BATCH_AT.worker.y });
    // 사본 선이 꺾이는 자리 · PostgreSQL에 드는 높이 그대로
    expect(down).toEqual(copy[1]);
    expect(BATCH_AT.pgCopy.y).toBe(copy[2]?.y);
  });
  it('꺾은 길 위 자리 — 길이 비율대로(꺾는 자리를 지난다)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(pointAlong(pts, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(pts, 0.25)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(pts, 0.5)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(pts, 1)).toEqual({ x: 10, y: 30 });
    expect(
      pointAlong(
        [
          { x: 3, y: 4 },
          { x: 3, y: 4 },
        ],
        0.7,
      ),
    ).toEqual({ x: 3, y: 4 });
  });
  it('점 반지름 · 간선 굵기 상한', () => {
    expect(batchDotRadius(1e12)).toBeLessThanOrEqual(DOT_R_MAX);
    expect(batchDotRadius(10_000)).toBe(6);
    expect(edgeWidth(1e12)).toBe(EDGE_W_MAX);
    expect(edgeWidth(0)).toBe(1);
  });
});

describe('흐름도 배치 — 간선 라벨', () => {
  const boxes: { id: string; box: Box }[] = [];
  for (const [id, variants] of Object.entries(WORST_LABELS) as [EdgeId, string[][]][]) {
    const spot = EDGE[id].label;
    for (const lines of variants)
      if (spot) boxes.push({ id: `${id} "${lines.join(' / ')}"`, box: labelBox(spot, lines) });
  }

  it('라벨은 어느 노드 · 고정 글자와도 겹치지 않고 그림 안에 있다', () => {
    for (const { id, box } of boxes) {
      for (const n of NODE_IDS) expect(overlaps(box, BOX[n]), `${id} ↔ 노드 ${n}`).toBe(false);
      for (const [fid, b] of FIXED_TEXT) expect(overlaps(box, b), `${id} ↔ ${fid}`).toBe(false);
      expect(inside(box, VIEW), id).toBe(true);
    }
  });

  it('라벨은 점 자리(반지름 상한)와 겹치지 않는다 — 점이 머무는 동안 글자를 가리지 않는다', () => {
    for (const { id, box } of boxes)
      for (const [name, p] of DOT_SPOTS) expect(overlaps(box, dotBox(p)), `${id} ↔ ${name}`).toBe(false);
  });

  it('기둥 머리 · 바닥은 기둥 틀 안 · 칸과 겹치지 않는다 · 업무 줄 옆 한 줄은 어느 노드와도 겹치지 않고 그림 안', () => {
    for (const b of [pillarHead, pillarFoot]) {
      expect(inside(b, shrink(PILLAR, 2))).toBe(true);
      for (const n of NODE_IDS) expect(overlaps(b, BOX[n]), `기둥 글자 ↔ ${n}`).toBe(false);
    }
    for (const n of NODE_IDS) expect(overlaps(bizNote, BOX[n]), `업무 줄 옆 ↔ ${n}`).toBe(false);
    expect(overlaps(bizNote, PILLAR)).toBe(false);
    expect(inside(bizNote, VIEW)).toBe(true);
  });

  it('라벨끼리 겹치지 않는다(같은 간선의 켜짐 · 꺼짐 변형은 동시에 그려지지 않는다)', () => {
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i] as (typeof boxes)[number];
        const b = boxes[j] as (typeof boxes)[number];
        if (a.id.split(' ')[0] === b.id.split(' ')[0]) continue;
        expect(overlaps(a.box, b.box), `${a.id} ↔ ${b.id}`).toBe(false);
      }
  });

  it('노드 사이 짧은 간선의 라벨은 그 틈 안에 들어간다(옛 배치 "9,905 점/" 잘림)', () => {
    // 기둥 칸으로 들고 나는 라벨은 기둥 틀 선도 넘지 않는다(틀 바깥 틈 안)
    const pillarL = { x: PILLAR.x, w: 0 };
    const pillarR = { x: PILLAR.x + PILLAR.w, w: 0 };
    const gaps: [EdgeId, { x: number; w: number }, { x: number; w: number }][] = [
      ['src-stream', BOX.src, pillarL],
      ['stream-worker', pillarR, BOX.worker],
      ['biz-stream', BOX.bizSrc, pillarL],
      ['worker-latest', pillarR, BOX.worker],
      ['biz-notice', pillarR, BOX.worker],
      ['biz-reply', BOX.bizSrc, pillarL],
      ['worker-pg-copy', BOX.worker, BOX.ch],
      ['biz-pg', BOX.worker, BOX.ch],
      ['biz-commit', BOX.bizWorker, BOX.pg],
      // 대기줄 없이 바로 저장 라벨은 꺼진 업무 처리 노드 바로 아래 — 처리 열 왼쪽 가장자리 ~ PostgreSQL 사이
      ['biz-direct', { x: BOX.bizWorker.x, w: 0 }, BOX.pg],
      ['read-ask', BOX.readSrc, pillarL],
      ['read-answer', BOX.readSrc, pillarL],
      ['read-miss', pillarR, { x: EDGE['read-pg'].path[0]?.x ?? 0, w: 0 }],
    ];
    for (const [e, l, r] of gaps) {
      const spot = EDGE[e].label;
      if (!spot) continue;
      for (const lines of WORST_LABELS[e] ?? []) {
        const b = labelBox(spot, lines);
        expect(b.x, e).toBeGreaterThanOrEqual(l.x + l.w);
        expect(b.x + b.w, e).toBeLessThanOrEqual(r.x);
      }
    }
  });

  it('업무 표지 자리 — 표지(그린 기호 12 + 틈 3 + 쉬운 말)마다 노드 글자와 겹치지 않고 노드 안에 있다', () => {
    const labels = [...Object.values(OUTCOME_MARK), DUPLICATE_MARK].map((s) => markText({ symbol: s }));
    expect(labels).toHaveLength(4);
    for (const label of labels) {
      const pgMark = markBox(MARK_AT.pgTx, label);
      expect(pgMark.w).toBe(MARK_ICON + MARK_ICON_GAP + textWidth(label, FONT.mark));
      for (const lines of worstNodeLines().pg)
        for (const t of nodeTextBoxes('pg', lines)) expect(overlaps(pgMark, t), label).toBe(false);
      expect(inside(pgMark, BOX.pg), label).toBe(true);
      // 처리 노드 안 표지 — 점 길 오른쪽 · 노드 오른쪽 가장자리 안
      expect(inside(markBox(MARK_AT.bizWorker, label), BOX.bizWorker), label).toBe(true);
      // 요청 노드 표지 — 노드 바로 아래 · 어느 노드 · 간선 라벨과도 겹치지 않는다
      const api = markBox(MARK_AT.api, label);
      for (const n of NODE_IDS) expect(overlaps(api, BOX[n]), `api 표지 ↔ ${n}`).toBe(false);
      expect(overlaps(api, PILLAR), 'api 표지 ↔ 기둥').toBe(false);
      for (const [id, variants] of Object.entries(WORST_LABELS) as [EdgeId, string[][]][]) {
        const spot = EDGE[id].label;
        if (spot)
          for (const l of variants) expect(overlaps(api, labelBox(spot, l)), `api 표지 ↔ ${id}`).toBe(false);
      }
    }
  });

  it('업무 표지는 유니코드 기호를 글자로 그리지 않는다 — 표지 종류마다 그린 기호(path) + 쉬운 말(R8 = L5)', () => {
    const GLYPH = /[↺✕⚠⌛]/;
    for (const s of [...Object.values(OUTCOME_MARK), DUPLICATE_MARK]) {
      expect(MARK_ICONS[s]?.paths.length, s).toBeGreaterThan(0);
      expect(markText({ symbol: s })).not.toMatch(GLYPH);
    }
    // 거절된 업무 요청 하나를 표지가 보이는 때까지 흘려 그린다
    const engine = new DotEngine();
    engine.addBiz([
      {
        event: 'biz',
        source: 'worker-1',
        role: 'biz-writer',
        seq: 1,
        at: 1,
        cmdId: '3f1c9a2e-8b7d-4c1e-9f0a-2d6b5e4c3a10',
        kind: 'master.tag.patch',
        result: 'master.scale_change_forbidden',
        duplicate: false,
        stages: { queueWaitMs: 2, txMs: 4.2, invalidateMs: 1.1, replyMs: 0.6 },
        invalidatedKeys: 0,
        cacheinv: false,
      },
    ]);
    engine.tick(0);
    engine.tick(1_300); // 트랜잭션 노드 도착(약 1,177) 뒤 · 점이 끝나기 전
    const html = renderToStaticMarkup(createElement(FlowDiagram, { ...diagramProps(), engine }));
    expect(html).toContain('data-mark="거절됨"');
    expect(html).toContain('<title>거절됨 · master.scale_change_forbidden</title>');
    expect(html).toMatch(/<g data-mark="거절됨">.*<path d="M18 6 6 18"/);
    expect(html).not.toMatch(GLYPH);
  });

  it('단 머리 넷 — 그림 안 · 노드보다 위 · 서로 겹치지 않는다', () => {
    const boxes = COLUMNS.map((c) =>
      labelBox({ x: c.x, y: COLUMN_Y, align: 'middle' }, [c.text], FONT.column),
    );
    for (const b of boxes) {
      expect(inside(b, VIEW)).toBe(true);
      for (const n of NODE_IDS) expect(overlaps(b, BOX[n])).toBe(false);
      expect(overlaps(b, PILLAR)).toBe(false);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(overlaps(boxes[i] as Box, boxes[j] as Box)).toBe(false);
  });
});

describe('흐름도 배치 — 선이 글자를 지나지 않는다', () => {
  /** 간선 토막의 굵기 띠(굵기 상한 6의 절반씩) */
  const band = (a: Pt, b: Pt): Box => {
    const h = EDGE_W_MAX / 2;
    return {
      x: Math.min(a.x, b.x) - h,
      y: Math.min(a.y, b.y) - h,
      w: Math.abs(b.x - a.x) + 2 * h,
      h: Math.abs(b.y - a.y) + 2 * h,
    };
  };
  const texts: [string, Box][] = [
    ...FIXED_TEXT,
    ...COLUMNS.map(
      (c) =>
        [`단 머리 ${c.text}`, labelBox({ x: c.x, y: COLUMN_Y, align: 'middle' }, [c.text], FONT.column)] as [
          string,
          Box,
        ],
    ),
    ...NODE_IDS.flatMap((id) =>
      worstNodeLines()[id].flatMap((lines) =>
        nodeTextBoxes(id, lines).map((b) => [`노드 ${id}`, b] as [string, Box]),
      ),
    ),
    ...(Object.entries(WORST_LABELS) as [EdgeId, string[][]][]).flatMap(([id, variants]) => {
      const spot = EDGE[id].label;
      return spot ? variants.map((l) => [`라벨 ${id}`, labelBox(spot, l)] as [string, Box]) : [];
    }),
  ];
  it.each(Object.keys(EDGE) as EdgeId[])(
    '%s — 어느 라벨(자기 라벨 포함) · 노드 글자 · 고정 글자와도 겹치지 않는다',
    (id) => {
      for (const [a, b] of segments(id))
        for (const [tid, t] of texts) expect(overlaps(band(a, b), t), `${id} ↔ ${tid}`).toBe(false);
    },
  );
});

describe('흐름도 글자 크기 — 화면 안 최소 12px(다듬기 §2.1 · §2.3)', () => {
  // 1440 × 900에서 흐름도 SVG 상자 — 가로: 1440 − 내비 248 − 본문 여백 40 − 구역 테두리 2 − 구역 가로 여백 24 = 1126
  //   세로(작은 쪽 · 진행 띠 있음): 본문 804 − 제목 52 − 띠 34 − 숫자 4 64 − 아래 줄 124 − 각주 24 − 칸 사이 8 × 5 = 466 − 테두리 2 − 세로 여백 12 = 452
  //   (flow-screen.tsx 높이 셈 · 띠 없으면 494) — preserveAspectRatio meet이라 배율 = min(가로 비, 세로 비)
  const SVG_1440 = { w: 1440 - 248 - 40 - 2 - 24, h: 804 - 52 - 34 - 64 - 124 - 24 - 8 * 5 - 2 - 12 };
  const scale = Math.min(SVG_1440.w / VIEW_W, SVG_1440.h / VIEW_H);

  it('1440 × 900 배율은 1.0 이상 — 진행 띠가 있어도 가로가 먼저 찬다(viewBox 단위 = CSS px)', () => {
    expect(SVG_1440).toEqual({ w: 1126, h: 452 });
    expect(scale).toBe(1);
  });

  it('맞춤 보기(1280×720 ~ 2560×1440)는 화면 틀이 본문 높이에 맞고 · 세로 820px 미만이면 아래 줄(124)을 빼 흐름도 배율 1을 지킨다', () => {
    // flow-screen.tsx의 클래스에서 읽는다 — 옛 고정 최소 높이(750 · 흐름도 454)는 페이지 스크롤을 만들어 지웠다(지침 §반응형 규칙)
    const src = readFileSync(
      path.resolve(__dirname, '../components/experiments/flow/flow-screen.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/min-h-\[750px\]/);
    expect(src).toContain('fit:min-h-0 fit:flex-1');
    expect(src).toContain('[@media(min-width:80rem)_and_(min-height:45rem)_and_(max-height:51.2rem)]:hidden');
    // 1280 × 720(레일 56 · 셸 머리 44 · 본문 여백 12): 흐름도 가로 1280 − 56 − 24 − 2 − 24 = 1174 → 가로 배율 1.04 —
    //   세로는 아래 줄을 뺐을 때 흐름도 칸이 viewBox 440보다 높다(ego-browser 실측 배율 1.043 · 2026-10-11)
    const w = 1280 - 56 - 24 - 2 - 24;
    expect(w / VIEW_W).toBeGreaterThanOrEqual(1);
    // 아래 줄을 그대로 두면(옛 배치) 1280 × 720 흐름도 칸 ≈ 652 − 제목 50 − 숫자 4 64 − 아래 줄 124 − 각주 17 − 칸 사이 8 × 4 = 365 → 0.80배(글자 12가 9.6px)
    expect((652 - 50 - 64 - 124 - 17 - 8 * 4 - 14) / VIEW_H).toBeLessThan(0.81);
  });

  it('글자 크기 표 — 노드 제목 14 · 숫자 줄 13 · 역할 줄 12 · 간선 라벨 · 표지 12 · 단 머리 13 · 모두 배율을 곱해 12 이상', () => {
    expect(FONT).toEqual({ title: 14, role: 12, num: 13, label: 12, column: 13, mark: 12 });
    for (const [k, v] of Object.entries(FONT)) expect(v * scale, k).toBeGreaterThanOrEqual(12);
  });

  it('노드는 최대 3줄(제목 · 역할 · 숫자) — DB 노드만 4줄(무엇을 · 초당 · 지금까지 · 크기 — 명세 08 §EXP-FLOW)', () => {
    const worst = worstNodeLines();
    for (const id of NODE_IDS)
      for (const lines of worst[id]) {
        expect(lines.length, `${id} "${joined(lines)}"`).toBeLessThanOrEqual(
          id === 'ch' || id === 'pg' ? 4 : 3,
        );
        expect(lines[0]?.kind).toBe('title');
        expect(lines.slice(1).every((l) => l.kind !== 'title')).toBe(true);
      }
    expect(lineSize('title')).toBe(14);
    expect(lineSize('num')).toBe(13);
    expect(lineSize('role')).toBe(12);
  });

  it('그려진 SVG의 글자 크기는 모두 12 이상(하드코딩된 작은 글자 없음)', () => {
    const html = renderToStaticMarkup(createElement(FlowDiagram, diagramProps()));
    const sizes = [...html.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(40);
    expect(Math.min(...sizes) * scale).toBeGreaterThanOrEqual(12);
    // 줄기 라벨 두 줄 — 무엇을 하나 · 어느 DB로 몇 %
    expect(html).toContain('없으면 읽어 와 사본 담기');
    expect(html).toContain('ClickHouse(센서)');
  });
});

describe('흐름도 줄 모양 — 줄 종류가 정한다(R16) · 숫자 자리만 고정 폭 숫자(R9)', () => {
  it('스위치로 숫자 줄이 문장으로 바뀌면 문장 모양(역할 12)이다 — 노드 자리로 고정하지 않는다', () => {
    expect(latestLines(rates, flags())[2]?.kind).toBe('num');
    expect(latestLines(rates, flags({ collectorLatest: true }))[2]).toEqual({
      text: '센서 수집기가 직접 고쳐요',
      kind: 'role',
    });
    expect(replyLines(rates, false).map((l) => l.kind)).toEqual(['title', 'role', 'num']);
    expect(replyLines(rates, true).map((l) => l.kind)).toEqual(['title', 'role', 'role']);
    expect(streamLines(null, true).map((l) => l.kind)).toEqual(['title', 'role']);
    expect(bizStreamLines(null, true).map((l) => l.kind)).toEqual(['title', 'role']);
    expect(BIZ_WORKER_LINES.map((l) => l.kind)).toEqual(['title', 'role', 'role']);
  });

  it('숫자 줄은 지금 값을 담는다(숫자 또는 모름 "—") · 그 밖 줄 종류는 숫자 줄 모양을 쓰지 않는다', () => {
    const all = Object.values(worstNodeLines()).flat(2);
    for (const l of all.filter((x) => x.kind === 'num')) expect(l.text, l.text).toMatch(/[\d—]/);
    const none = [
      sourceLines(null),
      bizSrcLines(null),
      readSrcLines(null),
      readCacheLines(null),
      workerLines(null),
      replyLines(null, false),
      streamLines(null, false),
      bizStreamLines(null, false),
      ...Object.values(storeLines(null, null)),
    ].flat();
    for (const l of none.filter((x) => x.kind === 'num')) expect(l.text, l.text).toContain('—');
  });

  it('그린 SVG — 숫자 줄 · 숫자가 든 라벨 · 기둥 바닥에만 tabular-nums · 제목 · 역할 줄에는 없다', () => {
    const html = renderToStaticMarkup(createElement(FlowDiagram, diagramProps()));
    const texts = [...html.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
      attrs: m[1] ?? '',
      text: m[2] ?? '',
    }));
    const tnum = (t: { attrs: string }) => t.attrs.includes('font-variant-numeric:tabular-nums');
    expect(texts.find((t) => t.text === '초당 9,681개 보냄' && tnum(t))).toBeDefined();
    expect(texts.find((t) => t.text.startsWith('Redis 메모리') && tnum(t))).toBeDefined();
    expect(texts.find((t) => t.text === '9,681개/s' && tnum(t))).toBeDefined();
    for (const t of texts.filter((x) =>
      ['공장 센서', '태그마다 가장 최신 값 1개만', '응답'].includes(x.text),
    ))
      expect(tnum(t), t.text).toBe(false);
  });
});

/** 흐름도를 그릴 보통 값 — 초당 9,681행 · 업무 1건/초 · 조회 최악 값 */
function diagramProps(): Parameters<typeof FlowDiagram>[0] {
  const r: FlowRates = {
    batches: 1,
    rows: 9_681,
    chRows: 9_681,
    controlCopyRows: null,
    latestWrites: 4_800,
    commands: 1,
    commandsWriter: 1,
    commandsDirect: null,
    applied: 1,
    rejected: 0,
    failed: 0,
    expired: 0,
  };
  const stores = storeLines(r, metrics);
  return {
    engine: new DotEngine(),
    rates: r,
    flags: flags(),
    lines: {
      src: sourceLines(9_681),
      stream: streamLines(0, false),
      latest: latestLines(r, flags()),
      bizStream: bizStreamLines(0, false),
      reply: replyLines(r, false),
      worker: workerLines(r),
      bizSrc: bizSrcLines(r),
      ch: stores.ch,
      pg: stores.pg,
      readSrc: readSrcLines(READS),
      readCache: readCacheLines(READS),
    },
    reads: READS,
    readMissLabel: readMissLabel(READS),
    readSrcTip: '',
    readCacheTip: '',
    pillarFoot: pillarFootText(metrics),
    sourceTip: null,
    invalidation: 1,
    skeleton: false,
  };
}

// ── Pretendard 실측 — 글자 폭 어림이 실제 글꼴보다 보수적인가 · 두 줄 칸이 두 줄 안에 드는가(R3 · R9) ──
// 화면 글꼴은 Pretendard Variable(app/layout.tsx) — 같은 패키지의 고정 굵기 OTF(400 · 500 · 600 · 700 인스턴스)에서
// 글자마다 전진 폭(hmtx)을 읽고, 숫자 자리는 tnum 대체 글리프(GSUB tnum)의 폭을 쓴다. 커닝은 빼고 잰다(라틴 커닝은 대개 좁히는 쪽).

type Weight = 400 | 500 | 600 | 700;
const OTF_DIR = path.resolve(__dirname, '../node_modules/pretendard/dist/public/static');
const OTF: Record<Weight, string> = {
  400: 'Pretendard-Regular.otf',
  500: 'Pretendard-Medium.otf',
  600: 'Pretendard-SemiBold.otf',
  700: 'Pretendard-Bold.otf',
};

interface Metrics {
  /** 글자 폭(px) — tnum이면 고정 폭 숫자 */
  width(text: string, size: number, tnum?: boolean): number;
}

function loadMetrics(file: string): Metrics {
  const buf = readFileSync(file);
  const u16 = (o: number) => buf.readUInt16BE(o);
  const i16 = (o: number) => buf.readInt16BE(o);
  const u32 = (o: number) => buf.readUInt32BE(o);
  const T: Record<string, number> = {};
  for (let i = 0; i < u16(4); i++) T[buf.toString('latin1', 12 + i * 16, 16 + i * 16)] = u32(20 + i * 16);
  const tbl = (tag: string) => {
    const o = T[tag];
    if (o === undefined) throw new Error(`${file}: ${tag} 표 없음`);
    return o;
  };
  const upm = u16(tbl('head') + 18);
  const numH = u16(tbl('hhea') + 34);
  const adv = (g: number) => u16(tbl('hmtx') + 4 * Math.min(g, numH - 1)) / upm;
  // cmap — 플랫폼 3 · 인코딩 1 · 형식 4(BMP)
  const cm = tbl('cmap');
  let sub = -1;
  for (let i = 0; i < u16(cm + 2); i++)
    if (u16(cm + 4 + i * 8) === 3 && u16(cm + 6 + i * 8) === 1) sub = cm + u32(cm + 8 + i * 8);
  const seg = u16(sub + 6) / 2;
  const ends = sub + 14;
  const starts = ends + seg * 2 + 2;
  const deltas = starts + seg * 2;
  const ranges = deltas + seg * 2;
  const gid = (c: number): number => {
    for (let i = 0; i < seg; i++) {
      if (c > u16(ends + 2 * i)) continue;
      const s0 = u16(starts + 2 * i);
      if (c < s0) return 0;
      const ro = u16(ranges + 2 * i);
      if (ro === 0) return (c + i16(deltas + 2 * i)) & 0xffff;
      const g = u16(ranges + 2 * i + ro + 2 * (c - s0));
      return g === 0 ? 0 : (g + i16(deltas + 2 * i)) & 0xffff;
    }
    return 0;
  };
  // GSUB tnum — 단일 대체(형식 1 · 2 · 확장 7)
  const coverage = (o: number): number[] => {
    const out: number[] = [];
    if (u16(o) === 1) for (let i = 0; i < u16(o + 2); i++) out.push(u16(o + 4 + 2 * i));
    else
      for (let i = 0; i < u16(o + 2); i++)
        for (let g = u16(o + 4 + 6 * i); g <= u16(o + 6 + 6 * i); g++) out.push(g);
    return out;
  };
  const tnum = new Map<number, number>();
  const gs = tbl('GSUB');
  const feats = gs + u16(gs + 6);
  const looks = gs + u16(gs + 8);
  for (let i = 0; i < u16(feats); i++) {
    if (buf.toString('latin1', feats + 2 + 6 * i, feats + 6 + 6 * i) !== 'tnum') continue;
    const fo = feats + u16(feats + 6 + 6 * i);
    for (let k = 0; k < u16(fo + 2); k++) {
      const lo = looks + u16(looks + 2 + 2 * u16(fo + 4 + 2 * k));
      for (let s = 0; s < u16(lo + 4); s++) {
        let type = u16(lo);
        let so = lo + u16(lo + 6 + 2 * s);
        if (type === 7) {
          type = u16(so + 2);
          so += u32(so + 4);
        }
        if (type !== 1) continue;
        const cov = coverage(so + u16(so + 2));
        if (u16(so) === 1) for (const g of cov) tnum.set(g, (g + i16(so + 4)) & 0xffff);
        else for (const [idx, g] of cov.entries()) tnum.set(g, u16(so + 6 + 2 * idx));
      }
    }
  }
  return {
    width(text, size, tn = false) {
      let w = 0;
      for (const ch of text) {
        const g = gid(ch.codePointAt(0) ?? 0);
        w += adv(tn ? (tnum.get(g) ?? g) : g);
      }
      return w * size;
    },
  };
}

const PRETENDARD = Object.fromEntries(
  (Object.keys(OTF) as unknown as Weight[]).map((w) => [w, loadMetrics(path.join(OTF_DIR, OTF[w]))]),
) as Record<Weight, Metrics>;
const LINE_WEIGHT: Record<NodeLine['kind'], Weight> = { title: 700, role: 400, num: 500 };

describe('흐름도 글자 폭 어림 — Pretendard 실측(굵기 · 고정 폭 숫자)보다 넓게 잡는다', () => {
  it('글꼴 표를 읽었다 — 한글 0.864em · 고정 폭 숫자는 굵기마다 한 폭(400 0.614 · 700 0.654em)', () => {
    expect(PRETENDARD[400].width('가', 100)).toBeCloseTo(86.4, 1);
    expect(PRETENDARD[400].width('1', 100, true)).toBeCloseTo(PRETENDARD[400].width('8', 100, true), 5);
    expect(PRETENDARD[400].width('1', 100, true)).toBeCloseTo(61.4, 1);
    expect(PRETENDARD[700].width('0', 100, true)).toBeCloseTo(65.4, 1);
    // 고정 폭이 아니면 '1'이 좁다(본문 숫자) — 그래서 숫자 자리에만 고정 폭을 단다
    expect(PRETENDARD[400].width('1', 100)).toBeLessThan(PRETENDARD[400].width('1', 100, true));
  });

  it('노드 줄 — 가장 긴 줄도 어림 ≥ 실측(줄 종류의 굵기 · 숫자 줄은 고정 폭)', () => {
    for (const [id, variants] of Object.entries(worstNodeLines()))
      for (const lines of variants)
        for (const l of lines) {
          const size = lineSize(l.kind);
          const real = PRETENDARD[LINE_WEIGHT[l.kind]].width(l.text, size, l.kind === 'num');
          expect(textWidth(l.text, size), `${id} "${l.text}" 실측 ${real.toFixed(1)}`).toBeGreaterThanOrEqual(
            real,
          );
        }
  });

  it('간선 라벨 · 단 머리 · 기둥 머리 · 바닥 · 업무 줄 옆 한 줄 · 표지 — 어림 ≥ 실측', () => {
    const cases: [string, number, Weight, boolean][] = [
      ...Object.values(WORST_LABELS)
        .flat(2)
        .map((t) => [t, FONT.label, 400 as Weight, /\d/.test(t)] as [string, number, Weight, boolean]),
      ...COLUMNS.map((c) => [c.text, FONT.column, 600 as Weight, false] as [string, number, Weight, boolean]),
      [PILLAR_HEAD, FONT.label, 600, false],
      [pillarFootText(metrics), FONT.label, 400, true],
      ...BIZ_NOTE.lines.map(
        (t) => [t, FONT.label, 400 as Weight, false] as [string, number, Weight, boolean],
      ),
      ...[...Object.values(OUTCOME_MARK), DUPLICATE_MARK].map(
        (s) =>
          [markText({ symbol: s }), FONT.mark, 600 as Weight, false] as [string, number, Weight, boolean],
      ),
    ];
    for (const [t, size, w, tn] of cases) {
      const real = PRETENDARD[w].width(t, size, tn);
      expect(textWidth(t, size), `"${t}" 실측 ${real.toFixed(1)}`).toBeGreaterThanOrEqual(real);
    }
  });
});

// ── R3 — 두 줄 칸(line-clamp-2)이 1440 · 1280에서 두 줄 안에 드는가(한국어 어절 줄바꿈 keep-all · 실측 폭) ──
// 본문 폭 = 창 − 내비(1440 펼침 248 · 1440 미만은 저장값이 없으면 레일 56) − 본문 여백 40 · 최대 1408(셸 max-w-[90.5rem]).

/** keep-all 줄 수 — 띄어쓰기에서만 줄을 바꾼다(어절이 칸보다 길 때만 어절 안에서 — overflow-wrap anywhere) */
function keepAllLines(text: string, width: number, m: Metrics, size: number, tnum = false): number {
  const space = m.width(' ', size);
  let lines = 1;
  let cur = 0;
  for (const word of text.split(' ')) {
    const w = m.width(word, size, tnum);
    if (cur === 0) cur = w;
    else if (cur + space + w <= width) cur += space + w;
    else {
      lines++;
      cur = w;
    }
    while (cur > width) {
      lines++;
      cur -= width;
    }
  }
  return lines;
}

const VIEWPORTS = [
  { name: '1440 × 900(내비 펼침)', w: 1440, nav: 248 },
  { name: '1280 × 800(레일)', w: 1280, nav: 56 },
] as const;
const contentW = (v: (typeof VIEWPORTS)[number]) => Math.min(v.w - v.nav - 40, 1408);

describe('두 줄 칸 — 1440 · 1280에서 두 줄 안(R3 · Pretendard 실측 · keep-all)', () => {
  it.each(VIEWPORTS)('$name — 숫자 4 문장은 큰 숫자 · 단위 옆 두 줄 안', (v) => {
    // 칸 = (본문 − 칸 사이 12 × 3) ÷ 4 − 테두리 2 − 좌우 여백 32 · 문장 폭 = 칸 − 큰 숫자(28 · 600 · 고정 폭 · 자간 −0.025em) − 4 − 단위(14) − 10
    const inner = (contentW(v) - 36) / 4 - 34;
    const value = (t: string) => PRETENDARD[600].width(t, 28, true) - 0.7 * [...t].length;
    const r = { ...rates, rows: 99_999, commands: 99.9, rejected: 0, failed: 0, expired: 0 };
    const sets = [
      headlines({ rates: r, lag: 999_999_999, bizLag: 999, slowing: false, e2eP50: 9_999, e2eRows: 1 }),
      headlines({ rates: r, lag: 999_999_999, bizLag: 999, slowing: true, e2eP50: null, e2eRows: 0 }),
      headlines({ rates: { ...r, commands: 0 }, lag: 0, bizLag: 0, slowing: false, e2eP50: 0.8, e2eRows: 1 }),
    ];
    for (const h of sets.flat()) {
      const room = inner - value(h.value) - 4 - PRETENDARD[400].width(h.unit, 14) - 10;
      const lines = keepAllLines(h.text, room, PRETENDARD[h.warn ? 500 : 400], 13);
      expect(
        lines,
        `${h.label} "${h.value}${h.unit}" "${h.text}" 문장 폭 ${room.toFixed(0)}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it.each(VIEWPORTS)('$name — 왜 나눌까 세 칸의 이유 문장은 두 줄 안', (v) => {
    // 구역 = (본문 − 12) × 2/3 − 테두리 2 − 좌우 여백 32 · 세 칸 = ÷ 3 · 첫 칸 오른쪽 여백 16 · 가운데 좌우 32 + 가름 1 · 끝 칸 왼쪽 16 + 가름 1
    const col = (((contentW(v) - 12) * 2) / 3 - 34) / 3;
    const widths = [col - 16, col - 33, col - 17];
    whyCards(rates, flags()).forEach((c, i) => {
      const w = widths[i] ?? 0;
      expect(
        keepAllLines(c.why, w, PRETENDARD[400], 13),
        `${c.name} "${c.why}" 칸 ${w.toFixed(0)}`,
      ).toBeLessThanOrEqual(2);
      expect(PRETENDARD[400].width(c.now, 12, true), `${c.name} "${c.now}"`).toBeLessThanOrEqual(w);
    });
  });

  it.each(VIEWPORTS)(
    '$name — 모아서 vs 하나씩: 막대 칸이 남고 · 대기 한 줄 · 결론 한 줄 · 업무 없음 안내는 두 줄 안',
    (v) => {
      const inner = (contentW(v) - 12) / 3 - 34;
      const labelCol = Math.max(
        ...['센서 1묶음(약 9,999개)', '센서 1묶음(약 1만개)', '업무 1건'].map((t) =>
          PRETENDARD[400].width(t, 13),
        ),
      );
      const numCol = Math.max(
        ...['9,999ms', '59.9s', '59m 59s', '23h 59m'].map((t) => PRETENDARD[700].width(t, 16, true)),
      );
      expect(inner - labelCol - numCol - 16, '막대 칸 80 이상').toBeGreaterThanOrEqual(80);
      const wait = waitLine([
        { key: 'batch', label: '', ms: 1, wait: 86_340_000, samples: 1, frac: 1 },
        { key: 'biz', label: '', ms: 1, wait: 3_599_400, samples: 1, frac: 1 },
      ]);
      expect(wait).toBe('대기줄에서 기다린 시간 — 센서 23h 59m · 업무 59m 59s');
      expect(PRETENDARD[400].width(wait ?? '', 12, true), wait ?? '').toBeLessThanOrEqual(inner);
      expect(PRETENDARD[400].width(COMPARE_NOTE, 12)).toBeLessThanOrEqual(inner);
      expect(PRETENDARD[600].width('모아서 vs 하나씩 — 한 번 처리에 걸린 시간', 14)).toBeLessThanOrEqual(
        inner,
      );
      expect(keepAllLines(NO_BIZ_TEXT, inner - labelCol - 8, PRETENDARD[400], 12)).toBeLessThanOrEqual(2);
    },
  );
});

describe('흐름도 점 길 — 업무 점은 COMMIT 응답 · 저장한 뒤 · 결과 받음 선을, 조회 점은 조회 선을 탄다', () => {
  const pathOf = (id: EdgeId) => EDGE[id].path;
  const bottom = (b: Box) => b.y + b.h;
  const labelBoxes: [string, Box][] = (Object.entries(WORST_LABELS) as [EdgeId, string[][]][]).flatMap(
    ([id, variants]) => {
      const spot = EDGE[id].label;
      return spot ? variants.map((l) => [id, labelBox(spot, l)] as [string, Box]) : [];
    },
  );

  it('PostgreSQL → 하나씩 처리는 COMMIT 응답 선 위 — PostgreSQL 왼쪽 가장자리에서 나와 처리기 바닥으로 든다', () => {
    const line = pathOf('biz-commit');
    const [down, across, up] = BIZ_BENDS['pgTx>bizWorker'] ?? [];
    expect(line[0]?.x).toBe(BOX.pg.x);
    expect(line[2]?.y).toBe(bottom(BOX.bizWorker));
    // 점은 PostgreSQL 안 점 자리에서 선 높이로 내려와 선을 그대로 타고(꺾는 자리 같음) 처리기 점 길로 오른다
    expect(down).toEqual({ x: BIZ_AT.pgTx.x, y: line[0]?.y });
    expect(across).toEqual(line[1]);
    expect(up).toEqual({ x: line[2]?.x, y: LANE_B });
    expect(BIZ_AT.pgTx.x).toBeGreaterThan(BOX.pg.x);
  });

  it('모아서 저장 → ② 지금 값은 "지금 값 씀" 선 그대로 — 처리기 점 길에서 선이 내려오는 x로 가 선을 타고 ② 오른쪽 가장자리로', () => {
    const line = pathOf('worker-latest');
    const bends = BATCH_BENDS['xack>latest'] ?? [];
    expect(bends[0]).toEqual({ x: line[0]?.x, y: BATCH_AT.xack.y });
    expect(bends.slice(1)).toEqual(line.slice(1));
    expect(line[line.length - 1]?.x).toBe(BOX.latest.x + BOX.latest.w);
    // 선을 타는 배치 점(반지름 상한)이 어느 간선 라벨도 가리지 않는다
    for (const p of samples([BATCH_AT.xack, ...bends, BATCH_AT.latest]))
      for (const [lid, b] of labelBoxes)
        expect(overlaps(dotBox(p), b), `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}) ↔ 라벨 ${lid}`).toBe(false);
  });

  it('하나씩 처리 → ④는 "저장한 뒤" 선 · ④ → 업무 요청은 "결과 받음" 선 그대로', () => {
    const notice = pathOf('biz-notice');
    const bends = BIZ_BENDS['bizWorker>cache'] ?? [];
    expect(bends[0]).toEqual({ x: notice[0]?.x, y: LANE_B });
    expect(bends.slice(1)).toEqual(notice.slice(1));
    // 옛 사본 지움이 없으면(거절 · 이미 처리됨 · 시간 초과) 같은 선으로 ④에 들어 점 길을 지나 결과 알림까지
    expect(BIZ_BENDS['bizWorker>result']).toEqual([...bends, BIZ_AT.cache]);
    const reply = pathOf('biz-reply');
    expect(BIZ_BENDS['result>api']).toEqual(reply.slice(0, 2));
    expect(reply[2]?.x).toBe(BIZ_AT.api.x);
  });

  it('업무 · 조회 점(실제 반지름)은 지나가며 어느 간선 라벨도 가리지 않는다', () => {
    const runs: [string, Pt[], number][] = [
      ...BIZ_ROUTES.map(([n, pts]) => [n, pts, BIZ_DOT_R] as [string, Pt[], number]),
      ...READ_KINDS.flatMap((k) =>
        readLegs(k).map((pts, i) => [`조회 ${k} 다리 ${i}`, pts, READ_DOT_R] as [string, Pt[], number]),
      ),
    ];
    for (const [name, pts, r] of runs)
      for (const p of samples(pts))
        for (const [lid, b] of labelBoxes)
          expect(
            overlaps(boxAt(p, r), b),
            `${name} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) ↔ 라벨 ${lid}`,
          ).toBe(false);
  });

  it('조회 점 — 묻기 선으로 ⑤에 들고 응답 선으로 나온다 · ⑤ 안을 가로지르는 다리만 숨는다', () => {
    const cache = BOX.readCache;
    for (const k of READ_KINDS) {
      const route = READ_ROUTES[k];
      const first = route[0]?.pts ?? [];
      const last = route[route.length - 1]?.pts ?? [];
      expect(first[0]).toEqual(pathOf('read-ask')[0]);
      expect(first.every((p) => p.y === pathOf('read-ask')[0]?.y)).toBe(true);
      expect(last.at(-1)).toEqual(pathOf('read-answer').at(-1));
      expect(last.every((p) => p.y === pathOf('read-answer')[0]?.y)).toBe(true);
      for (const leg of route.filter((l) => l.hidden))
        for (const p of leg.pts) expect(inside({ ...p, w: 0, h: 0 }, cache), `${k} 숨은 다리`).toBe(true);
    }
    // 있으면 바로 응답 — ⑤ 오른쪽으로 나가지 않는다
    for (const leg of READ_ROUTES.hit) for (const p of leg.pts) expect(p.x).toBeLessThan(cache.x + cache.w);
    expect(READ_ROUTES.hit.some((l) => l.hidden)).toBe(false);
  });

  it.each([
    ['pg', 'read-pg', BOX.pg],
    ['ch', 'read-ch', BOX.ch],
  ] as const)(
    '조회 점 %s — 줄기 · 갈래 선을 그대로 타고 DB 가장자리에 닿았다 같은 길로 돌아온다',
    (k, branch, db) => {
      const legs = READ_ROUTES[k].filter((l) => !l.hidden && l.pts.length > 2);
      const [out, back] = legs;
      const line = [...pathOf('read-miss'), ...pathOf(branch).slice(1)];
      expect(out?.pts.slice(1)).toEqual(line);
      expect(back?.pts).toEqual([...(out?.pts ?? [])].reverse());
      const end = line[line.length - 1] as Pt;
      expect(end.y).toBe(bottom(db));
      expect(READ_REST[k]).toEqual(end);
      // ⑤ 오른쪽 가장자리 안쪽에서 줄기로 나간다(줄기 시작 = ⑤ 오른쪽 가장자리)
      expect(out?.pts[0]?.y).toBe(line[0]?.y);
      expect(out?.pts[0]?.x).toBeLessThan(line[0]?.x ?? 0);
    },
  );

  it('조회 점 다리 시간 — DB까지는 PostgreSQL · ClickHouse가 같다(선 길이로 빠르기를 말하지 않는다) · DB까지가 바로 응답보다 길다', () => {
    expect(routeMs(READ_ROUTES.pg)).toBe(routeMs(READ_ROUTES.ch));
    expect(routeMs(READ_ROUTES.pg)).toBeGreaterThan(routeMs(READ_ROUTES.hit));
    const db = (k: 'pg' | 'ch') => READ_ROUTES[k].filter((l) => l.ms === READ_MS.db);
    expect(db('pg')).toHaveLength(2);
    expect(db('ch')).toHaveLength(2);
  });

  it('조회 점 자리 — 처음은 묻기 선 시작 · ⑤를 가로지르는 동안 숨음 · 끝나면 done', () => {
    const route = READ_ROUTES.pg;
    expect(readPos(route, 0)).toEqual({ at: pathOf('read-ask')[0], hidden: false, done: false });
    const crossAt = READ_MS.hop + READ_MS.look + READ_MS.cross / 2;
    expect(readPos(route, crossAt).hidden).toBe(true);
    expect(readPos(route, routeMs(route)).done).toBe(true);
    // 줄기를 타는 동안 자리 — 줄기 높이 그대로
    expect(readPos(route, READ_MS.hop + READ_MS.look + READ_MS.cross + 1).at.y).toBe(
      pathOf('read-miss')[0]?.y,
    );
  });

  it('점 엔진 — 조회 점을 초당 상한까지 갈래 몫 그대로 낸다 · 끊김(멈춤) · 조회 없음이면 내지 않는다', () => {
    const engine = new DotEngine();
    engine.setReads({ requests: 10, hit: 6, chMiss: 2, pgMiss: 2, bypass: 0, error: 0, latestPoints: null });
    const seen = new Map<number, string>();
    const collect = () => {
      for (const d of engine.dots) if (d.kind === 'read' && !seen.has(d.id)) seen.set(d.id, d.read);
    };
    for (let t = 0; t <= 10_000; t += 125) {
      engine.tick(t);
      collect();
    }
    // 실제 10건/초 → 상한 2개/초 · 10초 = 20개 · 몫 0.6 · 0.2 · 0.2
    const kinds = [...seen.values()];
    expect(kinds).toHaveLength(20);
    expect(kinds.filter((k) => k === 'hit')).toHaveLength(12);
    expect(kinds.filter((k) => k === 'ch')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'pg')).toHaveLength(4);
    engine.paused = true;
    for (let t = 10_125; t <= 15_000; t += 125) engine.tick(t);
    collect();
    expect(seen.size).toBe(20);
    engine.paused = false;
    engine.setReads(null);
    for (let t = 15_125; t <= 20_000; t += 125) engine.tick(t);
    collect();
    expect(seen.size).toBe(20);
  });
});
