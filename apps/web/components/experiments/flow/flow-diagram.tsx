'use client';
// EXP-FLOW 흐름도 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW(흐름도 · 배치 점 · 간선 굵기 · 업무 점 · 표시 계약)
// SVG 직접 그리기다(시계열 차트가 아니다 — §비고). 점 하나가 flow 프레임의 요약 하나이고, 단계마다 머무는 시간의 비율이 그 요약의 실제 단계 ms 비율이다.
// 요약이 오지 않으면 점도 없다 — 멈춘 그림이 곧 멈춘 적재다. 셸 WS가 끊기면 점 애니메이션을 멈춘다(표시 계약 구독 없음 · 끊김).
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
} from '../../../lib/flow';
import type { FlowBatchSummaryBody, FlowBizSummaryBody } from '../../../lib/shared';

type NodeId = BatchNode | BizNode | 'ws' | 'alarmEval' | 'alarmEvent' | 'alarmState' | 'browser' | 'bff';

interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const N: Record<NodeId, NodeBox> = {
  src: { x: 16, y: 92, w: 160, h: 56 },
  stream: { x: 222, y: 92, w: 160, h: 56 },
  worker: { x: 428, y: 92, w: 140, h: 56 },
  ch: { x: 640, y: 30, w: 190, h: 40 },
  pgCopy: { x: 640, y: 80, w: 190, h: 40 },
  xack: { x: 640, y: 130, w: 190, h: 40 },
  latest: { x: 640, y: 180, w: 190, h: 40 },
  alarm: { x: 640, y: 230, w: 190, h: 40 },
  ws: { x: 890, y: 180, w: 214, h: 40 },
  alarmEval: { x: 890, y: 230, w: 214, h: 40 },
  alarmEvent: { x: 890, y: 280, w: 214, h: 40 },
  alarmState: { x: 890, y: 330, w: 214, h: 40 },
  browser: { x: 16, y: 452, w: 90, h: 44 },
  bff: { x: 124, y: 452, w: 70, h: 44 },
  api: { x: 214, y: 446, w: 170, h: 56 },
  bizStream: { x: 422, y: 446, w: 170, h: 56 },
  bizWorker: { x: 630, y: 446, w: 170, h: 56 },
  pgTx: { x: 872, y: 410, w: 232, h: 38 },
  cache: { x: 872, y: 458, w: 232, h: 38 },
  result: { x: 872, y: 506, w: 232, h: 38 },
};

const center = (id: NodeId) => {
  const b = N[id];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};
const right = (id: NodeId) => ({ x: N[id].x + N[id].w, y: N[id].y + N[id].h / 2 });
const left = (id: NodeId) => ({ x: N[id].x, y: N[id].y + N[id].h / 2 });

const VIEW_W = 1120;
const VIEW_H = 560;
/** 동시에 그리는 점 상한 — 넘으면 오래된 점부터 뺀다(요약 자체는 타임라인 · 목록에 남는다) */
const MAX_DOTS = 60;
/** ◆ · 결과 표지가 점이 끝난 뒤 남는 시간 */
const LINGER_MS = 2_000;

function fmtRate(v: number | null, unit: string): string | null {
  if (v === null) return null;
  const n = v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1);
  return `${n} ${unit}/초`;
}

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
  /** 가장 최근 점의 배율 — 머리 "×N 느리게" */
  lastBatchScale: number | null = null;
  lastBizScale: number | null = null;

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
      this.lastBatchScale = plan.scale;
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
      this.lastBizScale = plan.scale;
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

function dotPos<Nd extends NodeId>(plan: DotPlan<Nd>, elapsed: number) {
  const p = planProgress(plan, elapsed);
  const a = center(p.from);
  const b = center(p.to);
  return { x: a.x + (b.x - a.x) * p.frac, y: a.y + (b.y - a.y) * p.frac, done: p.done };
}

// ── 그리기 조각 ──

function Node({
  id,
  lines,
  off,
  tone,
}: {
  id: NodeId;
  lines: (string | null)[];
  off?: string | null;
  tone?: 'batch' | 'biz';
}) {
  const b = N[id];
  const shown = lines.filter((l): l is string => l !== null);
  const fill = off ? '#f1f5f9' : tone === 'biz' ? '#eef2ff' : '#f0f9ff';
  const stroke = off ? '#cbd5e1' : tone === 'biz' ? '#a5b4fc' : '#7dd3fc';
  const rows = off ? [...shown, off] : shown;
  const lh = 13;
  const top = b.y + b.h / 2 - ((rows.length - 1) * lh) / 2;
  return (
    <g data-node={id}>
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeDasharray={off ? '4 3' : undefined}
      />
      {rows.map((t, i) => (
        <text
          key={t}
          x={b.x + b.w / 2}
          y={top + i * lh}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={i === 0 ? 11.5 : 10}
          fontWeight={i === 0 ? 600 : 400}
          fill={off ? '#94a3b8' : i === 0 ? '#0f172a' : '#475569'}
        >
          {t}
        </text>
      ))}
    </g>
  );
}

function Edge({
  from,
  to,
  width = 1,
  off,
  label,
  dashed,
  points,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  width?: number;
  off?: string | null;
  label?: string | null;
  dashed?: boolean;
  /** 꺾인 경로 — 중간점 */
  points?: { x: number; y: number }[];
}) {
  const all = [from, ...(points ?? []), to];
  const d = all.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const mid = all[Math.floor((all.length - 1) / 2)] as { x: number; y: number };
  const next = all[Math.floor((all.length - 1) / 2) + 1] as { x: number; y: number };
  const mx = (mid.x + next.x) / 2;
  const my = (mid.y + next.y) / 2;
  const text = off ?? label;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={off ? '#cbd5e1' : '#64748b'}
        strokeWidth={off ? 1 : width}
        strokeDasharray={off || dashed ? '5 4' : undefined}
        markerEnd={off ? undefined : 'url(#flow-arrow)'}
        strokeLinecap="round"
      />
      {text ? (
        <text
          x={mx}
          y={my - 5}
          textAnchor="middle"
          fontSize={9.5}
          fill={off ? '#94a3b8' : '#334155'}
          className="tabular-nums"
        >
          {text}
        </text>
      ) : null}
    </g>
  );
}

/** 비활성 간선 · 스위치 표지 — 판정은 lib/flow.ts flowSwitchFlags(요약 필드 우선 · 없으면 health) */
export type DiagramFlags = FlowSwitchFlags;

export interface DiagramProps {
  engine: DotEngine;
  rates: FlowRates;
  flags: DiagramFlags;
  /** 발생원 초당 포인트(메트릭 두 폴링 차) */
  sourcePps: number | null;
  /** 마지막 배치 요약의 stream(length · lag) */
  stream: { length: number; lag: number | null } | null;
  /** biz_stream_lag(메트릭) */
  bizLag: number | null;
  /** 골격만 — 숫자 없음(로딩) */
  skeleton: boolean;
}

export function FlowDiagram({ engine, rates, flags, sourcePps, stream, bizLag, skeleton }: DiagramProps) {
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

  const r = skeleton ? null : rates;
  const w = (v: number | null | undefined) => (r ? edgeWidth(v ?? null) : 1);
  const lbl = (v: number | null | undefined, unit: string) => (r ? fmtRate(v ?? null, unit) : null);
  const f = flags;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label="분산 처리 흐름도 — 대용량 배치 길과 업무 명령 길"
    >
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
        </marker>
      </defs>

      <text x={16} y={18} fontSize={12} fontWeight={600} fill="#0369a1">
        대용량(측정 사실) — 창마다 묶은 배치 · flusher 하나가 처리량 위주로
      </text>

      {/* 대용량 간선 — 굵기 = 최근 10초 초당 행(totals 차) · 로그 */}
      <Edge
        from={right('src')}
        to={left('stream')}
        width={w(r?.rows)}
        label={sourcePps !== null && r ? fmtRate(sourcePps, '점') : lbl(r?.rows, '행')}
      />
      <Edge from={right('stream')} to={left('worker')} width={w(r?.rows)} label={lbl(r?.rows, '행')} />
      <Edge from={right('worker')} to={left('ch')} width={w(r?.chRows)} label={lbl(r?.chRows, '행')} />
      <Edge
        from={right('worker')}
        to={left('pgCopy')}
        width={w(r?.controlCopyRows)}
        off={f.controlCopyOff ? 'SW-09 off' : null}
        label={lbl(r?.controlCopyRows, '행')}
      />
      <Edge from={right('worker')} to={left('xack')} />
      <Edge
        from={right('worker')}
        to={left('latest')}
        width={w(r?.latestWrites)}
        off={f.collectorLatest ? 'SW-11 collector' : null}
        label={lbl(r?.latestWrites, '필드')}
      />
      {f.collectorLatest && (
        <Edge
          from={{ x: center('src').x, y: N.src.y + N.src.h }}
          to={{ x: N.latest.x, y: N.latest.y + N.latest.h - 8 }}
          points={[{ x: center('src').x, y: N.latest.y + N.latest.h - 8 }]}
          label="Collector가 최신값을 쓴다"
          dashed
        />
      )}
      <Edge
        from={right('worker')}
        to={left('alarm')}
        width={w(r?.judgedRows)}
        label={lbl(r?.judgedRows, '행')}
      />
      <Edge from={right('latest')} to={left('ws')} width={w(r?.latestWrites)} />
      <Edge from={right('alarm')} to={left('alarmEval')} width={w(r?.judgedRows)} />
      <Edge
        from={right('alarm')}
        to={left('alarmEvent')}
        width={w(r?.transitions)}
        label={lbl(r?.transitions, '전이')}
      />
      <Edge from={right('alarm')} to={left('alarmState')} width={w(r?.transitions)} />

      <Node id="src" lines={['SIM · Collector', '생성기 B · C · run', f.deadband ? '데드밴드 on' : null]} />
      <Node
        id="stream"
        lines={[
          'stream:plc:raw',
          stream && !skeleton
            ? `길이 ${stream.length.toLocaleString('ko-KR')} · 랙 ${stream.lag === null ? '—' : stream.lag.toLocaleString('ko-KR')}`
            : '길이 · 랙',
        ]}
        off={f.streamOff ? 'Stream 경계 없음 — 실험 전용' : null}
      />
      <Node id="worker" lines={['Ingest 워커', 'flusher 1']} />
      <Node id="ch" lines={['CH tag_raw', '→ MV tag_1m']} />
      <Node id="pgCopy" lines={['PG 대조군 COPY']} off={f.controlCopyOff ? '(SW-09 off)' : null} />
      <Node id="xack" lines={['XACK ▮', '대조군 뒤 · 최신값 앞']} />
      <Node
        id="latest"
        lines={['Redis rt:latest', f.directGateway ? '직접 호출' : 'ch:rt']}
        off={f.collectorLatest ? '(SW-11 collector)' : null}
      />
      <Node id="alarm" lines={['알람 판정', '인계 없는 배치는 지나지 않는다']} />
      <Node id="ws" lines={['WS → 브라우저']} />
      <Node id="alarmEval" lines={['CH alarm_eval', '판정 전수']} />
      <Node id="alarmEvent" lines={['PG alarm_event ◆', '전이만']} />
      <Node id="alarmState" lines={['Redis alarm:state', f.directGateway ? '직접 호출' : 'ch:alarm']} />

      {/* 두 길 가름 */}
      <line x1={16} x2={VIEW_W - 16} y1={392} y2={392} stroke="#e2e8f0" strokeDasharray="6 4" />
      <text x={16} y={414} fontSize={12} fontWeight={600} fill="#4338ca">
        업무 명령 — 하나씩 직렬 · 커밋 결과를 기다려 응답
        {f.bizDirect ? '   ·   SW-12 direct — 옛 경로(비교 실험용)' : ''}
      </text>

      {/* 업무 간선 — 굵기 = 초당 업무 명령 */}
      <Edge from={right('browser')} to={left('bff')} />
      <Edge from={right('bff')} to={left('api')} />
      <Edge
        from={right('api')}
        to={left('bizStream')}
        width={w(r?.commandsWriter)}
        off={f.bizDirect ? 'SW-12 direct' : null}
        label={lbl(r?.commandsWriter, '명령')}
      />
      <Edge
        from={right('bizStream')}
        to={left('bizWorker')}
        width={w(r?.commandsWriter)}
        off={f.bizDirect ? ' ' : null}
      />
      <Edge
        from={right('bizWorker')}
        to={left('pgTx')}
        width={w(r?.commandsWriter)}
        off={f.bizDirect ? ' ' : null}
      />
      <Edge from={right('bizWorker')} to={left('cache')} off={f.bizDirect ? ' ' : null} />
      <Edge from={right('bizWorker')} to={left('result')} off={f.bizDirect ? ' ' : null} />
      {/* 응답 — biz:result · ch:bizreply를 받은 api가 기존 상태 코드로 답한다(⏳ 대기 상한 5초) */}
      <Edge
        from={{ x: N.result.x + 40, y: N.result.y + N.result.h }}
        to={{ x: center('api').x, y: N.api.y + N.api.h }}
        points={[
          { x: N.result.x + 40, y: VIEW_H - 6 },
          { x: center('api').x, y: VIEW_H - 6 },
        ]}
        off={f.bizDirect ? ' ' : null}
        label="응답 ◀ ch:bizreply"
      />
      {f.bizDirect && (
        <Edge
          from={{ x: center('api').x, y: N.api.y }}
          to={left('pgTx')}
          points={[{ x: center('api').x, y: N.pgTx.y + N.pgTx.h / 2 }]}
          width={w(r?.commandsDirect)}
          label={lbl(r?.commandsDirect, '명령')}
        />
      )}

      <Node id="browser" lines={['브라우저']} tone="biz" />
      <Node id="bff" lines={['BFF']} tone="biz" />
      <Node id="api" lines={['api 검증 · XADD', '⏳ 대기(상한 5초)']} tone="biz" />
      <Node
        id="bizStream"
        lines={[
          'stream:biz:cmd',
          bizLag !== null && !skeleton ? `명령 랙 ${bizLag.toLocaleString('ko-KR')}` : '명령 랙',
        ]}
        tone="biz"
        off={f.bizDirect ? '(SW-12 direct)' : null}
      />
      <Node
        id="bizWorker"
        lines={['워커 biz-writer 1', '직렬 소비']}
        tone="biz"
        off={f.bizDirect ? '(SW-12 direct)' : null}
      />
      <Node id="pgTx" lines={['PG 트랜잭션', '변경 · 감사 · 원장']} tone="biz" />
      <Node id="cache" lines={['Redis cache DEL', 'ch:cacheinv(ACK는 안 감)']} tone="biz" />
      <Node
        id="result"
        lines={['biz:result', 'ch:bizreply']}
        tone="biz"
        off={f.bizDirect ? '(SW-12 direct)' : null}
      />

      {/* 점 */}
      {engine.dots.map((d) => {
        const elapsed = engine.clock - d.born;
        if (elapsed < 0) return null;
        if (d.kind === 'batch') {
          const p = dotPos(d.plan, elapsed);
          const tr = d.batch.alarm ? d.batch.alarm.opened + d.batch.alarm.closed : 0;
          return (
            <g key={d.id}>
              {!p.done && <circle cx={p.x} cy={p.y} r={d.r} fill="#0284c7" fillOpacity={0.75} />}
              {p.done && tr > 0 && d.batch.alarm && (
                <text
                  x={N.alarmEvent.x + N.alarmEvent.w - 8}
                  y={center('alarmEvent').y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#b45309"
                >
                  ◆ 열림 {d.batch.alarm.opened} · 닫힘 {d.batch.alarm.closed}
                </text>
              )}
            </g>
          );
        }
        const p = dotPos(d.plan, elapsed);
        const markAt = d.mark ? arriveAt(d.plan, d.mark.at) : null;
        const showMark = d.mark && markAt !== null && elapsed >= markAt;
        const mc = d.mark ? center(d.mark.at) : null;
        return (
          <g key={d.id}>
            {!p.done && <circle cx={p.x} cy={p.y} r={4} fill="#4f46e5" fillOpacity={0.85} />}
            {showMark && d.mark && mc && (
              <text
                x={mc.x}
                y={mc.y - 24}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={d.mark.symbol === '↺' ? '#0f766e' : d.mark.symbol === '⌛' ? '#64748b' : '#b91c1c'}
              >
                {d.mark.symbol}
                {d.mark.code ? ` ${d.mark.code}` : ''}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
