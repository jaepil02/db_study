'use client';
// /monitoring 흐름도 — 설계 .omc/plans/web-junior-redesign.md §3 흐름도(화면의 주인공) · §8 Redis 기둥 · §9 조회 줄 · 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW
// 노드 12 = 어디서 오나 3(공장 센서 · 사람의 업무 요청 · 사람의 조회 요청) + Redis 기둥 칸 5(① 센서 대기줄 · ② 지금 값 · 알람 상태 · ③ 업무 대기줄 · ④ 옛 사본 지움 · 결과 알림 · ⑤ 조회 사본)
//   + 누가 처리하나 2(모아서 저장 · 하나씩 처리) + 진짜 DB 2(ClickHouse · PostgreSQL). Redis는 서버와 DB 사이 한 기둥이다(목적지처럼 오른쪽에 두지 않는다).
// 조회 줄은 처리기를 거치지 않고(api가 직접 Redis를 먼저 본다) flow 프레임 요약이 없어 점이 없다 — 선 굵기 · 숫자(메트릭 5초 차분)로만.
// 점 하나가 flow 프레임의 요약 하나(실제 묶음 · 실제 요청)이고, 단계마다 머무는 시간의 비율이 그 요약의 실제 단계 ms 비율이다(보기 좋게 느리게).
// 선 굵기 = 초당 양 · 꺼진 길(스위치로 끈 길)은 그리지 않는다 — 각주가 이름을 댄다. 셸 WS가 끊기면 점 애니메이션을 멈춘다.
// 요약이 오지 않으면 점도 없다 — 멈춘 그림이 곧 멈춘 적재다. 좌표 · 라벨 자리와 그 겹침 근거는 diagram-layout.ts(검사 test/flow-layout.test.ts).
import { useEffect, useRef, useState } from 'react';
import {
  arriveAt,
  type BatchNode,
  type BizMark,
  type BizNode,
  batchDotRadius,
  batchPlan,
  bizPlan,
  type DotPlan,
  edgeWidth,
  type FlowRates,
  type FlowSwitchFlags,
  planProgress,
  type ReadRates,
} from '../../../lib/flow';
import type { FlowBatchSummaryBody, FlowBizSummaryBody } from '../../../lib/shared';
import { STORE, type StoreKey } from '../../ui/store';
import {
  ALARM_AT,
  BATCH_AT,
  BIZ_AT,
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
  labelBox,
  MARK_AT,
  nodeTextTop,
  PILLAR,
  PILLAR_FOOT_Y,
  PILLAR_HEAD_Y,
  type Pt,
  VIEW_H,
  VIEW_W,
} from './diagram-layout';
import { BIZ_WORKER_LINES, edgeRate, markText, PILLAR_HEAD, PILLAR_TIP } from './node-lines';

/** 동시에 그리는 점 상한 — 넘으면 오래된 점부터 뺀다 */
const MAX_DOTS = 60;
/** 알람 켜짐 · 꺼짐 표지와 업무 결과 표지가 점이 끝난 뒤 남는 시간 */
const LINGER_MS = 2_000;

// ── 점 엔진 — 애니메이션 시계는 끊긴 동안 멈춘다 ──

type Dot =
  | {
      id: number;
      kind: 'batch';
      born: number;
      plan: DotPlan<BatchNode>;
      r: number;
      batch: FlowBatchSummaryBody;
    }
  | {
      id: number;
      kind: 'biz';
      born: number;
      plan: DotPlan<BizNode>;
      mark: BizMark | null;
      biz: FlowBizSummaryBody;
    };

export class DotEngine {
  clock = 0;
  private lastReal: number | null = null;
  paused = false;
  dots: Dot[] = [];
  private seq = 0;

  tick(real: number): void {
    if (!this.paused && this.lastReal !== null) this.clock += real - this.lastReal;
    this.lastReal = real;
    this.dots = this.dots.filter((d) => this.clock - d.born <= d.plan.totalMs + LINGER_MS);
  }

  private push(d: Dot): void {
    this.dots.push(d);
    if (this.dots.length > MAX_DOTS) this.dots.splice(0, this.dots.length - MAX_DOTS);
  }

  /** 한 프레임의 배치들 — 요약 시각(at) 차만큼 출발을 벌린다(최대 250 ms · 병합 창 하나) */
  addBatches(batches: readonly FlowBatchSummaryBody[]): void {
    const t0 = Math.min(...batches.map((b) => b.at));
    for (const b of batches) {
      const plan = batchPlan(b);
      this.seq += 1;
      this.push({
        id: this.seq,
        kind: 'batch',
        born: this.clock + Math.min(b.at - t0, 250),
        plan,
        r: batchDotRadius(b.rows),
        batch: b,
      });
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

function dotPos<Nd extends string>(plan: DotPlan<Nd>, elapsed: number, at: Record<Nd, Pt>) {
  const p = planProgress(plan, elapsed);
  const a = at[p.from];
  const b = at[p.to];
  return { x: a.x + (b.x - a.x) * p.frac, y: a.y + (b.y - a.y) * p.frac, done: p.done };
}

// ── 그리기 조각 ──

const GRAY = '#cbd5e1';

function NodeBox({
  id,
  lines,
  off,
  store,
  tip,
}: {
  id: BoxId;
  lines: string[];
  off?: boolean;
  store?: StoreKey;
  /** 마우스 올림 설명(SVG title) */
  tip?: string;
}) {
  const b = BOX[id];
  const fill = off ? '#f8fafc' : store ? STORE[store].soft : '#f8fafc';
  const stroke = off ? GRAY : store ? STORE[store].color : '#94a3b8';
  const top = nodeTextTop(id, lines.length);
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
      {lines.map((t, i) => (
        <text
          key={t}
          x={b.x + b.w / 2}
          y={top + i * LINE_H}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={i === 0 ? FONT.title : FONT.line}
          fontWeight={i === 0 ? 600 : 400}
          fill={off ? '#94a3b8' : i === 0 ? '#0f172a' : '#475569'}
          className="tabular-nums"
        >
          {t}
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
          className="tabular-nums"
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
  /** 노드 줄 — node-lines.ts가 만든다 */
  lines: Record<Exclude<BoxId, 'bizWorker'>, string[]>;
  /** 조회 줄 숫자(메트릭 5초 차분) — 선 굵기 · null이면 굵기 1 */
  reads: ReadRates | null;
  /** ⑤ ↔ DB 줄기 라벨(어느 DB로 몇 % · 조회가 없으면 보내 보라는 한 줄) */
  readMissLabel: string;
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

  useEffect(() => {
    const loop = (t: number) => {
      const before = engine.dots.length;
      engine.tick(t);
      // 점이 있을 때만 다시 그린다 — 멈춘 동안(끊김)에도 제자리 표시는 유지된다
      if (before > 0 || engine.dots.length > 0) setFrame((n) => (n + 1) % 1_000_000);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [engine]);

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
          className="tabular-nums"
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
      <Edge id="worker-pg-alarm" width={w(r?.transitions)} label={['알람이 켜지고', '꺼질 때만']} />
      {f.controlCopyOff ? null : (
        <Edge
          id="worker-pg-copy"
          width={w(r?.controlCopyRows)}
          label={['비교용 사본', lbl(r?.controlCopyRows, '개')].filter((x): x is string => x !== null)}
        />
      )}

      {/* 업무 길 — 굵기 = 초당 업무 요청 · 대기줄 없이 바로 저장(비교 실험)은 꺼진 칸 위로(노드 뒤에 그린다) */}
      {f.bizDirect ? null : (
        <>
          <Edge id="biz-stream" width={w(r?.commandsWriter)} label={lbl(r?.commandsWriter, '건')} />
          <Edge id="biz-worker" width={w(r?.commandsWriter)} />
          <Edge id="biz-pg" width={w(r?.applied)} label="업무 기록" />
          <Edge id="biz-notice" width={w(p.invalidation)} label="저장한 뒤" />
          <Edge id="biz-reply" label="결과 받음" />
        </>
      )}

      {/* 조회 길(§9) — 굵기 = 조회 건/초(메트릭 5초 차분) · 점 없음 · 처리기를 거치지 않는다 */}
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
      <NodeBox id="bizWorker" lines={[...BIZ_WORKER_LINES]} off={f.bizDirect} />
      <NodeBox id="ch" store="ch" lines={p.lines.ch} />
      <NodeBox id="pg" store="pg" lines={p.lines.pg} />
      {f.bizDirect ? (
        <Edge id="biz-direct" width={w(r?.commandsDirect)} label={['대기줄 없이 바로 저장', '(비교 실험)']} />
      ) : null}
      {/* 업무 줄 옆 한 줄 — 업무 데이터가 왜 ClickHouse로 가지 않는지(답은 성능 비교 화면 오른쪽) */}
      <g data-testid="flow-biz-note">
        <SpotText spot={BIZ_NOTE.spot} lines={[...BIZ_NOTE.lines]} fill="#64748b" />
      </g>

      {/* 점 */}
      {engine.dots.map((d) => {
        const elapsed = engine.clock - d.born;
        if (elapsed < 0) return null;
        if (d.kind === 'batch') {
          const pos = dotPos(d.plan, elapsed, BATCH_AT);
          const a = d.batch.alarm;
          return (
            <g key={d.id}>
              {!pos.done && <circle cx={pos.x} cy={pos.y} r={d.r} fill="#334155" fillOpacity={0.7} />}
              {pos.done && a && a.opened + a.closed > 0 && (
                <text
                  x={ALARM_AT.x}
                  y={ALARM_AT.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#b45309"
                >
                  알람 켜짐 {a.opened} · 꺼짐 {a.closed}
                </text>
              )}
            </g>
          );
        }
        const pos = dotPos(d.plan, elapsed, BIZ_AT);
        const markAt = d.mark ? arriveAt(d.plan, d.mark.at) : null;
        const showMark = d.mark && markAt !== null && elapsed >= markAt;
        const mc: Pt | null = d.mark ? markSpot(d.mark.at) : null;
        return (
          <g key={d.id}>
            {!pos.done && <circle cx={pos.x} cy={pos.y} r={4} fill="#7c3aed" fillOpacity={0.85} />}
            {showMark && d.mark && mc && (
              <text
                x={mc.x}
                y={mc.y}
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={600}
                fill={d.mark.symbol === '↺' ? '#0f766e' : d.mark.symbol === '⌛' ? '#64748b' : '#b91c1c'}
              >
                {d.mark.code ? <title>{d.mark.code}</title> : null}
                {markText(d.mark)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** 업무 표지 자리 — 표지가 붙는 노드(요청 · 처리 · 저장) 귀퉁이 · 그 밖 노드는 점 자리 오른쪽 */
function markSpot(at: BizNode): Pt {
  if (at === 'api' || at === 'bizWorker' || at === 'pgTx') return MARK_AT[at];
  const p = BIZ_AT[at];
  return { x: p.x + 10, y: p.y + 4 };
}
