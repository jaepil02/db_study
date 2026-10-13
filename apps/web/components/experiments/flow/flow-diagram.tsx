'use client';
// /monitoring 흐름도(화면의 주인공 · Redis 기둥 · 조회 줄) — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW
// 노드 12 = 어디서 오나 3(공장 센서 · 사람의 업무 요청 · 사람의 조회 요청) + Redis 기둥 칸 5(① 센서 대기줄 · ② 지금 값 · ③ 업무 대기줄 · ④ 옛 사본 지움 · 결과 알림 · ⑤ 조회 사본)
//   + 누가 처리하나 2(모아서 저장 · 하나씩 처리) + 진짜 DB 2(ClickHouse · PostgreSQL). Redis는 서버와 DB 사이 한 기둥이다(목적지처럼 오른쪽에 두지 않는다).
// 조회 줄은 처리기를 거치지 않는다(api가 직접 Redis를 먼저 본다). 조회는 요청마다 flow 프레임 요약이 없어 메트릭 5초 차분의 갈래 비율
// (바로 응답 · ClickHouse까지 · PostgreSQL까지)대로 점을 뽑아 선만 태운다(초당 상한 lib/flow READ_DOTS_MAX_PER_SEC · 다리 시간은 고정).
// 그 밖의 점 하나는 flow 프레임의 요약 하나(실제 묶음 · 실제 요청)이고, 단계마다 머무는 시간의 비율이 그 요약의 실제 단계 ms 비율이다(보기 좋게 느리게).
// 업무 점은 PostgreSQL에서 COMMIT 응답 선을 타고 하나씩 처리로 돌아온 뒤 "저장한 뒤" → ④ → "결과 받음" 선으로 간다(diagram-layout BIZ_BENDS).
// 비교 실험 중인 묶음은 처리기에서 점 둘로 갈라진다 — ClickHouse로 가는 본 점 · 같은 순간 사본 선을 타고 PostgreSQL로 가는 사본 점(lib/flow batchPlan).
// 선 굵기 = 초당 양 · 꺼진 길(스위치로 끈 길)은 그리지 않는다 — 각주가 이름을 댄다. 셸 WS가 끊기면 점 애니메이션을 멈춘다.
// 요약이 오지 않으면 점도 없다 — 멈춘 그림이 곧 멈춘 적재다. 좌표 · 라벨 자리와 그 겹침 근거는 diagram-layout.ts(검사 test/flow-layout.test.ts).
// 움직임 줄이기(prefers-reduced-motion: reduce)면 점이 움직이지 않는다 — 가장 오래 머무는 자리(lib/flow restNode)에 나타났다 사라진다.
// 숫자 자리(숫자 줄 · 숫자가 든 라벨 · 기둥 바닥)만 고정 폭 숫자(font-variant-numeric) — 문장 줄의 숫자는 본문 숫자 그대로.
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  arriveAt,
  type BatchNode,
  type BizMark,
  type BizNode,
  batchDotRadius,
  batchPlan,
  bizPlan,
  type DotPlan,
  DUPLICATE_MARK,
  edgeWidth,
  type FlowRates,
  type FlowSwitchFlags,
  newReadPicker,
  OUTCOME_MARK,
  pickReadKind,
  planProgress,
  type ReadDotPlan,
  type ReadKind,
  type ReadRates,
  readDotPlan,
  restNode,
} from '../../../lib/flow';
import type { FlowBatchSummaryBody, FlowBizSummaryBody } from '../../../lib/shared';
import { STORE, type StoreKey } from '../../ui/store';
import {
  BATCH_AT,
  BATCH_BENDS,
  BIZ_AT,
  BIZ_BENDS,
  BIZ_DOT_R,
  BIZ_NOTE,
  BOX,
  type BoxId,
  COLUMN_Y,
  COLUMNS,
  DIVIDER_YS,
  DIVIDERS,
  EDGE,
  type EdgeId,
  FONT,
  LABEL_LINE_H,
  type LabelSpot,
  LINE_H,
  type LineKind,
  labelBox,
  lineSize,
  MARK_AT,
  MARK_ICON,
  MARK_ICON_GAP,
  type NodeLine,
  nodeTextTop,
  PILLAR,
  PILLAR_FOOT_Y,
  PILLAR_HEAD_Y,
  type Pt,
  pointAlong,
  READ_DOT_R,
  READ_REST,
  READ_ROUTES,
  type ReadLeg,
  readPos,
  routeMs,
  VIEW_H,
  VIEW_W,
} from './diagram-layout';
import { BIZ_WORKER_LINES, edgeRate, markText, PILLAR_HEAD, PILLAR_TIP } from './node-lines';

/** 동시에 그리는 점 상한 — 넘으면 오래된 점부터 뺀다 */
const MAX_DOTS = 60;
/** 업무 결과 표지가 점이 끝난 뒤 남는 시간 */
const LINGER_MS = 2_000;
/** 움직임 줄이기 — 매 화면 갱신(rAF) 대신 이 간격으로 시계만 넘긴다(점은 제자리에 나타났다 사라질 뿐 움직이지 않는다) */
const REDUCED_TICK_MS = 500;
/** 고정 폭 숫자 — SVG 글자는 클래스 대신 스타일로(숫자 자리에만) */
const TNUM: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const hasDigit = (t: string) => /\d/.test(t);

// ── 점 엔진 — 애니메이션 시계는 끊긴 동안 멈춘다 ──

type Dot =
  | {
      id: number;
      kind: 'batch';
      born: number;
      plan: DotPlan<BatchNode>;
      r: number;
    }
  | {
      id: number;
      kind: 'biz';
      born: number;
      plan: DotPlan<BizNode>;
      mark: BizMark | null;
      biz: FlowBizSummaryBody;
    }
  | {
      id: number;
      kind: 'read';
      born: number;
      read: ReadKind;
      route: readonly ReadLeg[];
      totalMs: number;
    };

const dotTotalMs = (d: Dot): number => (d.kind === 'read' ? d.totalMs : d.plan.totalMs);

export class DotEngine {
  clock = 0;
  private lastReal: number | null = null;
  paused = false;
  dots: Dot[] = [];
  private seq = 0;

  /** 조회 점 계획(메트릭이 바뀔 때마다 setReads) · 다음 점까지 쌓인 몫 · 갈래 고르기 상태 */
  private read: ReadDotPlan | null = null;
  private readCarry = 0;
  private readPick = newReadPicker();

  tick(real: number): void {
    const dt = !this.paused && this.lastReal !== null ? real - this.lastReal : 0;
    this.clock += dt;
    this.lastReal = real;
    // 조회 점 — 초당 perSec개(한 번에 하나까지 · 탭이 숨었다 돌아와도 몰아 내지 않는다)
    if (this.read && dt > 0) {
      this.readCarry = Math.min(this.readCarry + (dt / 1000) * this.read.perSec, 1);
      if (this.readCarry >= 1) {
        this.readCarry -= 1;
        this.addRead(pickReadKind(this.readPick, this.read.shares));
      }
    }
    this.dots = this.dots.filter((d) => this.clock - d.born <= dotTotalMs(d) + LINGER_MS);
  }

  /** 조회 줄 숫자(메트릭 5초 차분) — 조회가 없거나 모르면 점을 멈추고 갈래 고르기를 처음부터 */
  setReads(rr: ReadRates | null): void {
    this.read = readDotPlan(rr);
    if (!this.read) {
      this.readCarry = 0;
      this.readPick = newReadPicker();
    }
  }

  private addRead(read: ReadKind): void {
    const route = READ_ROUTES[read];
    this.seq += 1;
    this.push({ id: this.seq, kind: 'read', born: this.clock, read, route, totalMs: routeMs(route) });
  }

  private push(d: Dot): void {
    this.dots.push(d);
    if (this.dots.length > MAX_DOTS) this.dots.splice(0, this.dots.length - MAX_DOTS);
  }

  /**
   * 한 프레임의 배치들 — 요약 시각(at) 차만큼 출발을 벌린다(최대 250 ms · 병합 창 하나).
   * 비교 실험 중인 배치는 사본 점을 하나 더 — 본 점이 처리기를 떠나는 순간 처리기에서 PostgreSQL로 출발한다(lib/flow batchPlan).
   */
  addBatches(batches: readonly FlowBatchSummaryBody[]): void {
    const t0 = Math.min(...batches.map((b) => b.at));
    for (const b of batches) {
      const { copy, ...plan } = batchPlan(b);
      const born = this.clock + Math.min(b.at - t0, 250);
      const r = batchDotRadius(b.rows);
      this.seq += 1;
      this.push({ id: this.seq, kind: 'batch', born, plan, r });
      if (copy) {
        this.seq += 1;
        this.push({ id: this.seq, kind: 'batch', born: born + copy.delayMs, plan: copy.plan, r });
      }
    }
  }

  addBiz(items: readonly FlowBizSummaryBody[]): void {
    const t0 = Math.min(...items.map((b) => b.at));
    for (const b of items) {
      const { mark, ...plan } = bizPlan(b);
      this.seq += 1;
      this.push({
        id: this.seq,
        kind: 'biz',
        born: this.clock + Math.min(b.at - t0, 250),
        plan,
        mark,
        biz: b,
      });
    }
  }
}

/** 점의 지금 자리 — 다리 사이는 곧게 · bends에 그 다리(`${출발}>${도착}`)가 있으면 꺾는 자리를 지나 길이 비율대로 */
function dotPos<Nd extends string>(
  plan: DotPlan<Nd>,
  elapsed: number,
  at: Record<Nd, Pt>,
  still: boolean,
  bends: Readonly<Record<string, readonly Pt[]>> = {},
) {
  if (still) return { ...at[restNode(plan)], done: elapsed >= plan.totalMs };
  const p = planProgress(plan, elapsed);
  const pos = pointAlong([at[p.from], ...(bends[`${p.from}>${p.to}`] ?? []), at[p.to]], p.frac);
  return { ...pos, done: p.done };
}

/** 움직임 줄이기 설정 — 바뀌면 바로 따른다 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

// ── 그리기 조각 ──

const GRAY = '#cbd5e1';
/** 노드 줄 종류마다 굵기 · 색 — 제목 14 굵게 · 역할 12 · 숫자 13 500(종류는 node-lines가 줄마다 정한다 · 크기는 diagram-layout lineSize) · 꺼진 노드도 읽히는 대비(#64748b · 4.6:1) */
const LINE_LOOK: Record<LineKind, { weight: number; fill: string }> = {
  title: { weight: 700, fill: '#0f172a' },
  role: { weight: 400, fill: '#475569' },
  num: { weight: 500, fill: '#1e293b' },
};
const OFF_TEXT = '#64748b';

function NodeBox({
  id,
  lines,
  off,
  store,
  tip,
}: {
  id: BoxId;
  lines: readonly NodeLine[];
  off?: boolean;
  store?: StoreKey;
  /** 마우스 올림 설명(SVG title) */
  tip?: string;
}) {
  const b = BOX[id];
  const fill = off ? '#f8fafc' : store ? STORE[store].soft : '#f8fafc';
  const stroke = off ? GRAY : store ? STORE[store].color : '#94a3b8';
  const top = nodeTextTop(id, lines);
  return (
    <g data-node={id} data-off={off ? 'yes' : undefined}>
      {tip ? <title>{tip}</title> : null}
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={store && !off ? 1.5 : 1}
        strokeDasharray={off ? '4 3' : undefined}
      />
      {lines.map((l, i) => (
        <text
          key={`${l.kind}-${l.text}`}
          x={b.x + b.w / 2}
          y={top + i * LINE_H}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={lineSize(l.kind)}
          fontWeight={LINE_LOOK[l.kind].weight}
          fill={off ? OFF_TEXT : LINE_LOOK[l.kind].fill}
          style={l.kind === 'num' ? TNUM : undefined}
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

/** 간선 라벨 — 흰 배경을 깔고(선 위에 올라도 글자가 읽힌다) diagram-layout의 자리에 */
function EdgeLabel({ id, lines }: { id: EdgeId; lines: string[] }) {
  const spot = EDGE[id].label;
  if (!spot || lines.length === 0) return null;
  return <SpotText spot={spot} lines={lines} />;
}

function SpotText({ spot, lines, fill = '#334155' }: { spot: LabelSpot; lines: string[]; fill?: string }) {
  const box = labelBox(spot, lines);
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={2} fill="#ffffff" fillOpacity={0.92} />
      {lines.map((t, i) => (
        <text
          key={t}
          x={spot.x}
          y={spot.y + i * LABEL_LINE_H}
          textAnchor={spot.align}
          fontSize={FONT.label}
          fill={fill}
          style={hasDigit(t) ? TNUM : undefined}
        >
          {t}
        </text>
      ))}
    </g>
  );
}

/** 간선 — 꺼진 길은 부르지 않는다(그리지 않음) · 라벨은 한 줄 또는 여러 줄(좁은 통로) · both면 시작 쪽에도 화살촉(가고 오는 길) */
function Edge({
  id,
  width = 1,
  label,
  end = true,
  both = false,
}: {
  id: EdgeId;
  width?: number;
  label?: string | readonly string[] | null;
  end?: boolean;
  both?: boolean;
}) {
  const d = EDGE[id].path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <g data-edge={id}>
      <path
        d={d}
        fill="none"
        stroke="#64748b"
        strokeWidth={width}
        markerEnd={end ? 'url(#flow-arrow)' : undefined}
        markerStart={both ? 'url(#flow-arrow-back)' : undefined}
        strokeLinejoin="round"
      />
      <EdgeLabel id={id} lines={label ? (typeof label === 'string' ? [label] : [...label]) : []} />
    </g>
  );
}

export interface DiagramProps {
  engine: DotEngine;
  rates: FlowRates;
  flags: FlowSwitchFlags;
  /** 노드 줄 — node-lines.ts가 만든다(줄마다 종류 · 그리기 모양은 종류가 정한다) */
  lines: Record<Exclude<BoxId, 'bizWorker'>, readonly NodeLine[]>;
  /** 조회 줄 숫자(메트릭 5초 차분) — 선 굵기 · null이면 굵기 1 */
  reads: ReadRates | null;
  /** ⑤ ↔ DB 줄기 라벨(줄기 아래 두 줄 — 무엇을 하나 · 어느 DB로 몇 % · 조회가 없으면 보내 보라는 한 줄) */
  readMissLabel: readonly string[];
  /** 조회 요청 · ⑤ 툴팁 */
  readSrcTip: string;
  readCacheTip: string;
  /** Redis 기둥 바닥 — 메모리 크기 */
  pillarFoot: string;
  /** 공장 센서 노드 툴팁 — 보낸 쪽 계수(메트릭) · 직접 보내 보기 몫(sourceTip) */
  sourceTip: string | null;
  /** 캐시 지우기 키/초 — 하나씩 처리 → ④ 간선 굵기 */
  invalidation: number | null;
  /** 골격만 — 숫자 없음(로딩) */
  skeleton: boolean;
}

export function FlowDiagram(p: DiagramProps) {
  const { engine, flags: f, skeleton } = p;
  const [, setFrame] = useState(0);
  const raf = useRef<number | null>(null);
  const still = useReducedMotion();

  // 조회 점은 메트릭 조회 비율로 뽑는다 — 골격(숫자 없음)이면 내지 않는다
  useEffect(() => {
    engine.setReads(skeleton ? null : p.reads);
  }, [engine, skeleton, p.reads]);

  useEffect(() => {
    const step = (t: number) => {
      const before = engine.dots.length;
      engine.tick(t);
      // 점이 있을 때만 다시 그린다 — 멈춘 동안(끊김)에도 제자리 표시는 유지된다
      if (before > 0 || engine.dots.length > 0) setFrame((n) => (n + 1) % 1_000_000);
    };
    if (still) {
      const id = window.setInterval(() => step(performance.now()), REDUCED_TICK_MS);
      return () => window.clearInterval(id);
    }
    const loop = (t: number) => {
      step(t);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [engine, still]);

  const r = skeleton ? null : p.rates;
  const w = (v: number | null | undefined) => (r ? edgeWidth(v ?? null) : 1);
  const lbl = (v: number | null | undefined, unit: string) => (r ? edgeRate(v, unit) : null);
  const rd = p.reads;
  const rw = (v: number | null | undefined) => (rd ? edgeWidth(v ?? null) : 1);
  const missSum =
    rd && (rd.chMiss !== null || rd.pgMiss !== null) ? (rd.chMiss ?? 0) + (rd.pgMiss ?? 0) : null;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="흐름도 — 센서 데이터와 업무 요청이 서버와 DB 사이의 Redis를 거쳐 ClickHouse · PostgreSQL로 나뉘어 저장되고, 조회는 Redis 사본을 먼저 본다"
      data-testid="flow-diagram"
    >
      <defs>
        {/* 화살촉은 선 굵기와 무관한 고정 크기 — 굵은 선에서 촉이 커져 화살이 무거워지지 않게 */}
        <marker
          id="flow-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
        </marker>
        {/* 시작 쪽 화살촉 — 선 방향 반대로(⑤ ↔ DB: 읽어 와 사본 담기) */}
        <marker
          id="flow-arrow-back"
          viewBox="0 0 8 8"
          refX="1"
          refY="4"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M8,0 L0,4 L8,8 z" fill="#64748b" />
        </marker>
      </defs>

      {COLUMNS.map((c) => (
        <text
          key={c.text}
          x={c.x}
          y={COLUMN_Y}
          textAnchor="middle"
          fontSize={FONT.column}
          fontWeight={600}
          fill="#64748b"
        >
          {c.text}
        </text>
      ))}
      {DIVIDER_YS.flatMap((y) =>
        DIVIDERS.map(([x1, x2]) => (
          <line key={`${y}-${x1}`} x1={x1} x2={x2} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="6 4" />
        )),
      )}

      {/* Redis 기둥 — 서버와 DB 사이 한 기둥(칸 4를 감싼다 · 머리 한 줄 · 바닥에 메모리 크기) */}
      <g data-testid="redis-pillar">
        <title>{PILLAR_TIP}</title>
        <rect
          x={PILLAR.x}
          y={PILLAR.y}
          width={PILLAR.w}
          height={PILLAR.h}
          rx={10}
          fill={STORE.redis.soft}
          fillOpacity={0.45}
          stroke={STORE.redis.color}
          strokeOpacity={0.5}
        />
        <text
          x={PILLAR.x + PILLAR.w / 2}
          y={PILLAR_HEAD_Y}
          textAnchor="middle"
          fontSize={FONT.label}
          fontWeight={600}
          fill={STORE.redis.color}
        >
          {PILLAR_HEAD}
        </text>
        <text
          x={PILLAR.x + PILLAR.w / 2}
          y={PILLAR_FOOT_Y}
          textAnchor="middle"
          fontSize={FONT.label}
          fill="#475569"
          style={TNUM}
        >
          {p.pillarFoot}
        </text>
      </g>

      {/* 센서 길 — 굵기 = 최근 10초 초당 행(로그) · 꺼진 길은 그리지 않는다 */}
      {f.streamOff ? null : (
        <>
          <Edge id="src-stream" width={w(r?.rows)} label={lbl(r?.rows, '개')} />
          <Edge id="stream-worker" width={w(r?.rows)} label={lbl(r?.rows, '개')} />
        </>
      )}
      <Edge id="worker-ch" width={w(r?.chRows)} />
      {f.collectorLatest ? null : <Edge id="worker-latest" width={w(r?.latestWrites)} label="지금 값 씀" />}
      {f.controlCopyOff ? null : (
        <Edge
          id="worker-pg-copy"
          width={w(r?.controlCopyRows)}
          label={[f.controlCopyGated ? '비교 실험 중' : '비교용 사본', lbl(r?.controlCopyRows, '개')].filter(
            (x): x is string => x !== null,
          )}
        />
      )}

      {/* 업무 길 — 굵기 = 초당 업무 요청 · 대기줄 없이 바로 저장(비교 실험)은 꺼진 칸 위로(노드 뒤에 그린다) */}
      {f.bizDirect ? null : (
        <>
          <Edge id="biz-stream" width={w(r?.commandsWriter)} label={lbl(r?.commandsWriter, '건')} />
          <Edge id="biz-worker" width={w(r?.commandsWriter)} />
          <Edge id="biz-pg" width={w(r?.applied)} label="업무 기록" />
          <Edge id="biz-commit" width={w(r?.applied)} label="COMMIT 응답" />
          <Edge id="biz-notice" width={w(p.invalidation)} label="저장한 뒤" />
          <Edge id="biz-reply" label="결과 받음" />
        </>
      )}

      {/* 조회 길(§9) — 굵기 = 조회 건/초(메트릭 5초 차분) · 점은 갈래 비율대로 뽑는다 · 처리기를 거치지 않는다 */}
      <Edge id="read-ask" width={rw(rd?.requests)} label={rd ? edgeRate(rd.requests, '건') : null} />
      <Edge id="read-answer" width={rw(rd?.requests)} label="응답" />
      <Edge id="read-miss" width={rw(missSum)} label={p.readMissLabel} end={false} both />
      <Edge id="read-pg" width={rw(rd?.pgMiss)} />
      <Edge id="read-ch" width={rw(rd?.chMiss)} />

      <NodeBox id="src" lines={p.lines.src} tip={p.sourceTip ?? undefined} />
      <NodeBox id="bizSrc" lines={p.lines.bizSrc} />
      <NodeBox id="readSrc" lines={p.lines.readSrc} tip={p.readSrcTip} />
      <NodeBox id="stream" store="redis" lines={p.lines.stream} off={f.streamOff} />
      <NodeBox id="latest" store="redis" lines={p.lines.latest} />
      <NodeBox id="bizStream" store="redis" lines={p.lines.bizStream} off={f.bizDirect} />
      <NodeBox id="reply" store="redis" lines={p.lines.reply} />
      <NodeBox id="readCache" store="redis" lines={p.lines.readCache} tip={p.readCacheTip} />
      <NodeBox id="worker" lines={p.lines.worker} />
      <NodeBox id="bizWorker" lines={BIZ_WORKER_LINES} off={f.bizDirect} />
      <NodeBox id="ch" store="ch" lines={p.lines.ch} />
      <NodeBox id="pg" store="pg" lines={p.lines.pg} />
      {f.bizDirect ? (
        <Edge id="biz-direct" width={w(r?.commandsDirect)} label={['대기줄 없이 바로 저장', '(비교 실험)']} />
      ) : null}
      {/* 업무 줄 옆 한 줄 — 업무 데이터는 ClickHouse로 가지 않는다 */}
      <g data-testid="flow-biz-note">
        <SpotText spot={BIZ_NOTE.spot} lines={[...BIZ_NOTE.lines]} fill="#64748b" />
      </g>

      {/* 점 */}
      {engine.dots.map((d) => {
        const elapsed = engine.clock - d.born;
        if (elapsed < 0) return null;
        if (d.kind === 'read') {
          const pos = still
            ? { at: READ_REST[d.read], hidden: false, done: elapsed >= d.totalMs }
            : readPos(d.route, elapsed);
          return pos.done || pos.hidden ? null : (
            <circle
              key={d.id}
              data-read={d.read}
              cx={pos.at.x}
              cy={pos.at.y}
              r={READ_DOT_R}
              fill="#0e7490"
              fillOpacity={0.85}
            />
          );
        }
        if (d.kind === 'batch') {
          const pos = dotPos(d.plan, elapsed, BATCH_AT, still, BATCH_BENDS);
          return pos.done ? null : (
            <circle key={d.id} cx={pos.x} cy={pos.y} r={d.r} fill="#334155" fillOpacity={0.7} />
          );
        }
        const pos = dotPos(d.plan, elapsed, BIZ_AT, still, BIZ_BENDS);
        const markAt = d.mark ? arriveAt(d.plan, d.mark.at) : null;
        const showMark = d.mark && markAt !== null && elapsed >= markAt;
        const mc: Pt | null = d.mark ? markSpot(d.mark.at) : null;
        return (
          <g key={d.id}>
            {!pos.done && <circle cx={pos.x} cy={pos.y} r={BIZ_DOT_R} fill="#7c3aed" fillOpacity={0.85} />}
            {showMark && d.mark && mc && <BizMarkView mark={d.mark} at={mc} />}
          </g>
        );
      })}
    </svg>
  );
}

// ── 업무 결과 표지 — 그린 기호(24 격자 · components/ui/icon.tsx와 같은 모양 · 선 끝 둥글게) + 쉬운 말 ──

/** 표지 종류(lib/flow 표지 문자열이 키) → 기호 path · 의미 색(이미 처리됨 청록 · 시간 초과 회색 · 거절 · 저장 못 함 빨강) */
export const MARK_ICONS: Record<string, { paths: readonly string[]; color: string }> = {
  // 되돌아 도는 화살 — 같은 요청이 이미 처리됨
  [DUPLICATE_MARK]: {
    paths: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
    color: '#0f766e',
  },
  [OUTCOME_MARK.rejected]: { paths: ['M18 6 6 18', 'm6 6 12 12'], color: '#b91c1c' },
  [OUTCOME_MARK.failed]: {
    paths: [
      'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
      'M12 9v4',
      'M12 17h.01',
    ],
    color: '#b91c1c',
  },
  // 시계 — 유효 시간을 넘김
  [OUTCOME_MARK.expired]: {
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
    color: '#64748b',
  },
};
/** 기호 선 굵기(24 격자) — 화면 공통 아이콘(14px · 선 2.2)과 같은 그려진 굵기를 12px에서 */
const MARK_STROKE = 2.2 * (14 / MARK_ICON);

/** 표지 하나 — 이름(SVG title = 접근성 이름 · 마우스 올림)은 쉬운 말 + 오류 코드(있을 때만) · 기호는 장식 */
function BizMarkView({ mark, at }: { mark: BizMark; at: Pt }) {
  const label = markText(mark);
  const look = MARK_ICONS[mark.symbol] ?? { paths: [], color: '#b91c1c' };
  const color = look.color;
  return (
    <g data-mark={label}>
      <title>{mark.code ? `${label} · ${mark.code}` : label}</title>
      <g
        transform={`translate(${at.x} ${at.y - MARK_ICON / 2}) scale(${MARK_ICON / 24})`}
        fill="none"
        stroke={color}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {look.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <text
        x={at.x + MARK_ICON + MARK_ICON_GAP}
        y={at.y}
        dominantBaseline="middle"
        fontSize={FONT.mark}
        fontWeight={600}
        fill={color}
      >
        {label}
      </text>
    </g>
  );
}

/** 업무 표지 자리 — 표지가 붙는 노드(요청 · 처리 · 저장) 귀퉁이 · 그 밖 노드는 점 자리 오른쪽 */
function markSpot(at: BizNode): Pt {
  if (at === 'api' || at === 'bizWorker' || at === 'pgTx') return MARK_AT[at];
  const p = BIZ_AT[at];
  return { x: p.x + 10, y: p.y + 4 };
}
