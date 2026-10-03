// /monitoring 흐름도 배치 — 브라우저 없이 겹침 0을 계산으로 본다(글자 폭은 보수적 어림 — diagram-layout.ts textWidth)
// 최악의 문구: 6자리 초당 값(999,999) · 10억 행 누적 · 999GB 크기 · 꺼진 노드 문구 · 수집기 모드 · 업무 결과 표지.
// 배치는 설계 §8 · §9 — 노드 12(출처 3 · Redis 기둥 칸 5 · 처리 2 · DB 2) · 기둥 머리 · 바닥 · 업무 줄 옆 한 줄도 겹침 검사에 든다.
// 조회 줄(§9.2)은 점이 없다 — 대신 조회 선이 처리기 노드를 지나지 않는지(api가 직접 Redis를 먼저 본다) · 라벨이 겹치지 않는지 본다.
import { describe, expect, it } from 'vitest';
import {
  ALARM_AT,
  BATCH_AT,
  BIZ_AT,
  BIZ_NOTE,
  BOX,
  type Box,
  type BoxId,
  COLUMN_Y,
  COLUMNS,
  DIVIDER_YS,
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
  MARK_AT,
  nodeTextBoxes,
  overlaps,
  PILLAR,
  PILLAR_FOOT_Y,
  PILLAR_HEAD_Y,
  type Pt,
  textWidth,
  VIEW_H,
  VIEW_W,
} from '../components/experiments/flow/diagram-layout';
import {
  BIZ_WORKER_LINES,
  bizSrcLines,
  bizStreamLines,
  edgeRate,
  latestLines,
  markText,
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
  workerLines,
} from '../components/experiments/flow/node-lines';
import type { FlowMetrics, FlowRates, FlowSwitchFlags, ReadRates } from '../lib/flow';
import { batchDotRadius, edgeWidth } from '../lib/flow';

const BIG = 999_999;
const rates: FlowRates = {
  batches: BIG,
  rows: BIG,
  chRows: BIG,
  controlCopyRows: BIG,
  latestWrites: BIG,
  transitions: BIG,
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
function worstNodeLines(): Record<BoxId, string[][]> {
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
  'worker-pg-alarm': [['알람이 켜지고', '꺼질 때만']],
  'worker-pg-copy': [['비교용 사본', edgeRate(BIG, '개') as string], ['비교용 사본']],
  'biz-stream': [[edgeRate(BIG, '건') as string]],
  'biz-pg': [['업무 기록']],
  'biz-notice': [['저장한 뒤']],
  'biz-reply': [['결과 받음']],
  'biz-direct': [['대기줄 없이 바로 저장', '(비교 실험)']],
  'read-ask': [[edgeRate(BIG, '건') as string]],
  'read-answer': [['응답']],
  'read-miss': [
    [readMissLabel(READS)],
    [readMissLabel(READS_ALL_MISS)],
    [readMissLabel(null)],
    [readMissLabel(READS_NONE)],
  ],
};

const NODE_IDS = Object.keys(BOX) as BoxId[];
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
    for (const y of DIVIDER_YS)
      for (const id of NODE_IDS) {
        const b = BOX[id];
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
  it('조회 줄 노드에는 점 자리가 없다(조회는 점 없이 숫자로만)', () => {
    for (const [name, p] of DOT_SPOTS)
      for (const id of ['readSrc', 'readCache'] as const)
        expect(inside({ ...p, w: 0, h: 0 }, BOX[id]), `${name} ↔ ${id}`).toBe(false);
  });
  it('조회가 없으면 줄기 라벨이 보내 보라는 한 줄이다', () => {
    expect(readMissLabel(READS_NONE)).toBe(NO_READ_TEXT);
  });
});

describe('흐름도 배치 — 노드 글자', () => {
  const worst = worstNodeLines();
  it.each(NODE_IDS)('%s — 가장 긴 줄도 상자 안(여백 4)', (id) => {
    for (const lines of worst[id])
      for (const t of nodeTextBoxes(id, lines))
        expect(inside(t, shrink(BOX[id], 4)), `${id} "${lines.join(' / ')}"`).toBe(true);
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
  it('점이 지나가는 길(멈춤 자리 사이 직선)도 노드 글자 · 고정 글자를 가로지르지 않는다', () => {
    // 배치 ⑧ 순서 전부(대조군 사본 포함) · 업무 명령 경로 · 대기줄 없이 바로 저장 — lib/flow batchPlan · bizPlan의 다리 순서
    const routes: [string, Pt[]][] = [
      [
        '배치',
        (['src', 'stream', 'worker', 'ch', 'pgCopy', 'xack', 'latest', 'alarm'] as const).map(
          (k) => BATCH_AT[k],
        ),
      ],
      [
        '업무',
        (['api', 'bizStream', 'bizWorker', 'pgTx', 'cache', 'result', 'api'] as const).map((k) => BIZ_AT[k]),
      ],
      ['업무 바로 저장', (['api', 'pgTx', 'cache', 'result', 'api'] as const).map((k) => BIZ_AT[k])],
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
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1] as Pt;
        const b = pts[i] as Pt;
        for (let k = 0; k <= 50; k++) {
          const p = { x: a.x + ((b.x - a.x) * k) / 50, y: a.y + ((b.y - a.y) * k) / 50 };
          for (const [tid, t] of texts)
            expect(
              overlaps(dotBox(p), t),
              `${name} 다리 ${i} (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) ↔ ${tid}`,
            ).toBe(false);
        }
      }
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
      ['worker-pg-alarm', BOX.worker, BOX.ch],
      ['worker-pg-copy', BOX.worker, BOX.ch],
      ['biz-pg', BOX.worker, BOX.ch],
      ['biz-direct', BOX.bizWorker, BOX.pg],
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

  it('업무 표지 · 알람 표지 자리 — 가장 긴 표지도 노드 제목 · 서로와 겹치지 않고 노드 안에 있다', () => {
    const longest = ['↺', '✕', '⚠', '⌛']
      .map((s) => markText({ symbol: s }))
      .sort((a, b) => b.length - a.length)[0] as string;
    const w = textWidth(longest, 11);
    const alarm = '알람 켜짐 999 · 꺼짐 999';
    const aw = textWidth(alarm, 11);
    const pgMark = { x: MARK_AT.pgTx.x, y: MARK_AT.pgTx.y - 7, w, h: 14 };
    const alarmBox = { x: ALARM_AT.x - aw, y: ALARM_AT.y - 7, w: aw, h: 14 };
    for (const lines of worstNodeLines().pg) {
      const title = nodeTextBoxes('pg', lines)[0] as Box;
      expect(overlaps(pgMark, title)).toBe(false);
      expect(overlaps(alarmBox, title)).toBe(false);
    }
    expect(overlaps(pgMark, alarmBox)).toBe(false);
    expect(inside(pgMark, BOX.pg)).toBe(true);
    expect(inside(alarmBox, BOX.pg)).toBe(true);
    // 처리 노드 안 표지 — 점 길 오른쪽 · 노드 오른쪽 가장자리 안
    const wk = { x: MARK_AT.bizWorker.x, y: MARK_AT.bizWorker.y - 7, w, h: 14 };
    expect(inside(wk, BOX.bizWorker)).toBe(true);
    // 요청 노드 표지 — 노드 바로 아래 · 어느 노드 · 간선 라벨과도 겹치지 않는다
    const api = { x: MARK_AT.api.x, y: MARK_AT.api.y - 7, w, h: 14 };
    for (const n of NODE_IDS) expect(overlaps(api, BOX[n]), `api 표지 ↔ ${n}`).toBe(false);
    expect(overlaps(api, PILLAR), 'api 표지 ↔ 기둥').toBe(false);
    for (const [id, variants] of Object.entries(WORST_LABELS) as [EdgeId, string[][]][]) {
      const spot = EDGE[id].label;
      if (spot)
        for (const l of variants) expect(overlaps(api, labelBox(spot, l)), `api 표지 ↔ ${id}`).toBe(false);
    }
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
