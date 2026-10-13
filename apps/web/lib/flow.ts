// EXP-FLOW 화면 상태 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW · 프레임 계약 docs/07_api/11_websocket.md §흐름 이벤트 — flow
// flow 프레임 → 화면 상태(타임라인 링 · 업무 목록 링 · totals 이력) 변환, 점 애니메이션 계획(단계 순서 · 배율), 메트릭 흐름 보기 요약.
// React를 모른다 — BFF(서버)와 화면이 함께 import한다.
import type { MetricSample } from './metrics-parser';
import { ratePerSecond } from './metrics-parser';
import {
  type FlowBatchSummaryBody,
  type FlowBizSummaryBody,
  type FlowFrameBody,
  type FlowRole,
  type FlowTotalsEntryBody,
  SWITCHES,
  type SwitchStateBody,
} from './shared';

// ── 화면 상수(08_evidence_screens §비고 · §표시 계약) ──
/** 링 버퍼 20 — 타임라인 배치 · 업무 명령 목록(화면 상수) */
export const FLOW_RING = 20;
/** 배율 — 점 하나의 전체 이동이 이보다 짧으면 늘리고 비율은 유지한다 */
export const FLOW_MIN_ANIM_MS = 1_500;
/** 간선 굵기 · 초당 값 — 최근 10초 totals 차 */
export const FLOW_RATE_WINDOW_MS = 10_000;
/** 게이트웨이 병합 창 — 연결마다 250 ms 고정(07_api/11_websocket §flow 프레임 계약) · 업무 트랙 첫 샘플의 기준점 시각 */
export const FLOW_MERGE_WINDOW_MS = 250;
/** 요약 없음 — 구독 중인데 이 동안 flow 프레임이 없으면 띠 */
export const FLOW_NO_SUMMARY_MS = 10_000;
/** 저장소 누적 메트릭 폴링 5초(리드 판정 2) */
export const FLOW_METRICS_POLL_MS = 5_000;
/** 구독 확인 빈 프레임을 기다리는 시간 — 넘으면 빈 값 ③(기능 미도입 단계)로 본다 · 화면 판정값(문서에 수치 없음) */
export const FLOW_ACK_WAIT_MS = 5_000;
/** 메트릭 쿼리 키 — obs · metrics · flow · staleTime 0(서버 층 없음) */
export const FLOW_METRICS_KEY = ['obs', 'metrics', 'flow'] as const;

/** failed(PostgreSQL 불가) 결과 코드 — 도메인 거절 ✕와 가른다(07_api/11 §ch:flow 페이로드) */
export const PG_UNAVAILABLE_CODE = 'common.postgres_unavailable';

// ── 단계 정의 — 순서가 곧 계약(표시 계약 단계 순서) ──
export type BatchStageKey = keyof FlowBatchSummaryBody['stages'];
export type BizStageKey = keyof FlowBizSummaryBody['stages'];

/** 배치 단계 5 — ⑧ 순서 그대로(스트림 대기 → 디코드 → CH 삽입 → PG COPY → 최신값) · XACK는 ms가 없어 막대에 자리가 없다 */
export const BATCH_STAGES: readonly { key: BatchStageKey; label: string }[] = [
  { key: 'streamWaitMs', label: '스트림 대기' },
  { key: 'decodeMs', label: '디코드' },
  { key: 'chInsertMs', label: 'CH 삽입' },
  { key: 'controlCopyMs', label: 'PG COPY' },
  { key: 'latestWriteMs', label: '최신값' },
];

/** 업무 단계 4 — 적용 단계 순서 그대로(대기 → 트랜잭션 → 무효화 → 결과) · 무효화가 결과보다 먼저인 것이 read-your-writes의 기전 */
export const BIZ_STAGES: readonly { key: BizStageKey; label: string }[] = [
  { key: 'queueWaitMs', label: '대기' },
  { key: 'txMs', label: '트랜잭션' },
  { key: 'invalidateMs', label: '무효화' },
  { key: 'replyMs', label: '결과' },
];

// ── 업무 결과 분류 ──
export type BizOutcome = 'ok' | 'rejected' | 'failed' | 'expired';

/** result → 결과 종류 — ok · expired 외의 문자열은 오류 코드이고, 그중 common.postgres_unavailable만 failed다 */
export function bizOutcome(result: string): BizOutcome {
  if (result === 'ok') return 'ok';
  if (result === 'expired') return 'expired';
  if (result === PG_UNAVAILABLE_CODE) return 'failed';
  return 'rejected';
}

/** 결과 표지 — ✕ 도메인 거절 · ⚠ PostgreSQL 불가(적용 여부 미확정) · ⌛ 유효 창 초과 */
export const OUTCOME_MARK: Record<Exclude<BizOutcome, 'ok'>, string> = {
  rejected: '✕',
  failed: '⚠',
  expired: '⌛',
};
export const DUPLICATE_MARK = '↺';

/** SW-12 direct 판별은 role 하나로 한다 — source는 인스턴스 식별만(APP_ROLE all이면 api와 워커의 source가 같다) */
export function isDirect(b: Pick<FlowBizSummaryBody, 'role'>): boolean {
  return b.role === 'api-direct';
}

// ── 배율(표시 계약 배율) ──

/** 한 점의 배율 — 단계 ms 합이 1.5초보다 짧으면 늘린다 · 모든 단계에 같은 배율(비율 유지) */
export function animScale(totalMs: number): number {
  if (totalMs >= FLOW_MIN_ANIM_MS) return 1;
  return FLOW_MIN_ANIM_MS / Math.max(totalMs, 1);
}

function sumStages(stages: Record<string, number | null>): number {
  let t = 0;
  for (const v of Object.values(stages)) if (v !== null) t += v;
  return t;
}

// ── 점 계획 — 노드 사이 다리(leg)마다 배율을 곱한 ms ──

export type BatchNode = 'src' | 'stream' | 'worker' | 'ch' | 'pgCopy' | 'xack' | 'latest';
export type BizNode = 'api' | 'bizStream' | 'bizWorker' | 'pgTx' | 'cache' | 'result';

export interface Leg<N extends string> {
  to: N;
  /** 배율을 곱한 이동 시간(화면 ms) — 0이면 그 노드로 곧바로 넘어간다 */
  ms: number;
  /** 이 다리가 표현하는 단계 — XACK · 응답 복귀처럼 ms가 없는 이동은 null */
  stage: string | null;
}

export interface DotPlan<N extends string> {
  start: N;
  legs: Leg<N>[];
  scale: number;
  /** 배율 적용 뒤 전체 시간 */
  totalMs: number;
}

function finish<N extends string>(start: N, raw: Leg<N>[], realTotal: number): DotPlan<N> {
  const scale = animScale(realTotal);
  const legs = raw.map((l) => ({ ...l, ms: l.ms * scale }));
  return { start, legs, scale, totalMs: legs.reduce((a, l) => a + l.ms, 0) };
}

/** 배치 점 계획 — 본 점(ClickHouse 갈래) + 비교 실험 중이면 사본 점(PostgreSQL 갈래) */
export interface BatchPlan extends DotPlan<BatchNode> {
  /** 사본 점 — 본 점이 처리기를 떠나는 순간(본 점 출발 뒤 delayMs) 처리기에서 함께 출발해 PostgreSQL로 · 사본이 없으면 null */
  copy: { delayMs: number; plan: DotPlan<BatchNode> } | null;
}

/**
 * 배치 점 — 스트림 대기 → 디코드 → 처리기에서 두 갈래(CH 삽입 · 비교 실험 중이면 PG COPY) → XACK → 최신값 · null 단계는 건너뛴다.
 * 두 갈래는 같은 순간 출발한다(사용자 결정 2026-10-13 — 같은 묶음이 두 DB로 갈라져 들어감을 보인다). 실제 처리기는 CH 삽입이
 * 성공한 뒤 COPY를 시작하지만(apps/api ingest/flusher.ts) 그림은 순서 대신 갈래를 보인다. XACK는 COPY 뒤라 COPY가 더 길면
 * 본 점이 ClickHouse에서 기다렸다 XACK로 간다. 배율은 두 갈래가 겹친 시간(긴 갈래만)으로 정한다.
 * 스트림 대기는 발생원 → Stream → 워커 두 다리에 반씩 나눈다(단계 합은 그대로).
 */
export function batchPlan(b: FlowBatchSummaryBody): BatchPlan {
  const s = b.stages;
  const legs: Leg<BatchNode>[] = [];
  if (s.streamWaitMs !== null) {
    legs.push({ to: 'stream', ms: s.streamWaitMs / 2, stage: 'streamWaitMs' });
    legs.push({ to: 'worker', ms: s.streamWaitMs / 2, stage: 'streamWaitMs' });
  } else {
    legs.push({ to: 'worker', ms: 0, stage: null });
  }
  if (s.decodeMs !== null) legs.push({ to: 'worker', ms: s.decodeMs, stage: 'decodeMs' });
  const departRaw = legs.reduce((a, l) => a + l.ms, 0);
  if (s.chInsertMs !== null) legs.push({ to: 'ch', ms: s.chInsertMs, stage: 'chInsertMs' });
  const wait = (s.controlCopyMs ?? 0) - (s.chInsertMs ?? 0);
  if (wait > 0) legs.push({ to: s.chInsertMs !== null ? 'ch' : 'worker', ms: wait, stage: null });
  legs.push({ to: 'xack', ms: 0, stage: null });
  if (s.latestWriteMs !== null) legs.push({ to: 'latest', ms: s.latestWriteMs, stage: 'latestWriteMs' });
  const main = finish<BatchNode>(
    'src',
    legs,
    legs.reduce((a, l) => a + l.ms, 0),
  );
  if (s.controlCopyMs === null) return { ...main, copy: null };
  const copyMs = s.controlCopyMs * main.scale;
  return {
    ...main,
    copy: {
      delayMs: departRaw * main.scale,
      plan: {
        start: 'worker',
        legs: [{ to: 'pgCopy', ms: copyMs, stage: 'controlCopyMs' }],
        scale: main.scale,
        totalMs: copyMs,
      },
    },
  };
}

export interface BizMark {
  symbol: string;
  /** 표지가 붙는 노드 — 점이 여기에 닿은 뒤부터 보인다 */
  at: BizNode;
  /** 오류 코드(✕ · ⚠) — 그 밖은 null */
  code: string | null;
}

/**
 * 잰 적 없는 다리의 화면 시간 — 결과 알림(ch:bizreply)을 받은 api가 결과 키를 읽어 사람에게 응답하는 길.
 * 흐름 요약에 이 단계 ms가 없어(replyMs는 워커의 결과 SET + 알림까지) 배율 밖 고정값으로 "결과 받음" 선을 타는 모습만 보인다.
 */
export const BIZ_REPLY_HOP_MS = 400;

/**
 * 업무 점 — api → stream:biz:cmd → 워커 → PG 트랜잭션 → COMMIT 응답으로 워커 → cache DEL · ch:cacheinv → biz:result · ch:bizreply → api 응답
 * (apps/api biz-worker.ts ③~⑦ · stream-biz-writer.ts ⑧). 저장 뒤 일은 워커가 하므로 점은 PostgreSQL에서 워커로 돌아온 뒤 ④로 간다.
 * txMs는 워커가 잰 BEGIN → COMMIT 응답이라 가는 다리 · 돌아오는 다리에 반씩 · replyMs(결과 SET + 알림)는 ④ 안 결과 알림 다리에 전부 ·
 * 알림을 받은 api가 응답하는 다리는 잰 값이 없어 BIZ_REPLY_HOP_MS(배율 밖).
 * 흐름도(diagram-layout BIZ_AT)에서 cache · result는 둘 다 Redis 기둥 ④ 칸(옛 사본 지움 → 결과 알림)의 점 길 위다(오른쪽 → 왼쪽).
 * duplicate · expired는 트랜잭션을 건너뛰고(↺ · ⌛), rejected는 트랜잭션 노드에서 ✕, failed는 같은 노드에서 ⚠(txMs null이어도 들른다).
 * role api-direct(SW-12 direct)는 스트림 · 워커 · 결과 알림을 건너뛰고 api에서 곧바로 트랜잭션으로 간다 — 무효화는 ④ 칸 점 길을
 * 오른쪽 → 왼쪽으로 지나며 그린다(invalidateMs를 두 다리에 반씩 · 결과 알림 단계는 없다 · 점이 ④ 글자를 가로지르지 않게).
 */
export function bizPlan(b: FlowBizSummaryBody): DotPlan<BizNode> & { mark: BizMark | null } {
  const s = b.stages;
  const outcome = bizOutcome(b.result);
  const direct = isDirect(b);
  const legs: Leg<BizNode>[] = [];
  let mark: BizMark | null = null;

  if (!direct) {
    if (s.queueWaitMs !== null) {
      legs.push({ to: 'bizStream', ms: s.queueWaitMs / 2, stage: 'queueWaitMs' });
      legs.push({ to: 'bizWorker', ms: s.queueWaitMs / 2, stage: 'queueWaitMs' });
    } else {
      legs.push({ to: 'bizStream', ms: 0, stage: null });
      legs.push({ to: 'bizWorker', ms: 0, stage: null });
    }
  }
  if (b.duplicate) {
    mark = { symbol: DUPLICATE_MARK, at: direct ? 'api' : 'bizWorker', code: null };
  } else if (outcome === 'expired') {
    mark = { symbol: OUTCOME_MARK.expired, at: direct ? 'api' : 'bizWorker', code: null };
  } else if (s.txMs !== null || outcome === 'failed') {
    const stage = s.txMs === null ? null : 'txMs';
    if (direct) legs.push({ to: 'pgTx', ms: s.txMs ?? 0, stage });
    else {
      legs.push({ to: 'pgTx', ms: (s.txMs ?? 0) / 2, stage });
      legs.push({ to: 'bizWorker', ms: (s.txMs ?? 0) / 2, stage });
    }
    if (outcome === 'rejected' || outcome === 'failed') {
      mark = { symbol: OUTCOME_MARK[outcome], at: 'pgTx', code: b.result };
    }
  }
  if (s.invalidateMs !== null) {
    if (direct) {
      legs.push({ to: 'cache', ms: s.invalidateMs / 2, stage: 'invalidateMs' });
      legs.push({ to: 'result', ms: s.invalidateMs / 2, stage: 'invalidateMs' });
    } else legs.push({ to: 'cache', ms: s.invalidateMs, stage: 'invalidateMs' });
  }
  if (direct) {
    legs.push({ to: 'api', ms: 0, stage: null });
    return { ...finish<BizNode>('api', legs, sumStages(s)), mark };
  }
  legs.push({ to: 'result', ms: s.replyMs ?? 0, stage: s.replyMs === null ? null : 'replyMs' });
  const plan = finish<BizNode>('api', legs, sumStages(s));
  return {
    ...plan,
    legs: [...plan.legs, { to: 'api', ms: BIZ_REPLY_HOP_MS, stage: null }],
    totalMs: plan.totalMs + BIZ_REPLY_HOP_MS,
    mark,
  };
}

/** 점의 현재 자리 — 경과(화면 ms)에서 몇 번째 다리의 어디쯤인가 · 끝났으면 done */
export interface PlanProgress<N extends string> {
  from: N;
  to: N;
  /** 0~1 — 다리 안 진행 비율 */
  frac: number;
  done: boolean;
}

export function planProgress<N extends string>(plan: DotPlan<N>, elapsed: number): PlanProgress<N> {
  let from = plan.start;
  let t = Math.max(elapsed, 0);
  for (const leg of plan.legs) {
    if (t < leg.ms) return { from, to: leg.to, frac: leg.ms === 0 ? 1 : t / leg.ms, done: false };
    t -= leg.ms;
    from = leg.to;
  }
  return { from, to: from, frac: 1, done: true };
}

/** 점이 노드에 처음 닿는 시각(화면 ms) — 닿지 않으면 null */
export function arriveAt<N extends string>(plan: DotPlan<N>, node: N): number | null {
  if (plan.start === node) return 0;
  let t = 0;
  for (const leg of plan.legs) {
    t += leg.ms;
    if (leg.to === node) return t;
  }
  return null;
}

/** 점 크기 ∝ log10(행 수) */
export function batchDotRadius(rows: number): number {
  // 상한 7 — 흐름도 점 길(노드 아래 13px)과 저장소 노드 글자 사이 여백 안에 든다(components/experiments/flow/diagram-layout.ts DOT_R_MAX)
  return Math.min(2 + Math.log10(Math.max(rows, 1)), 7);
}

/** 간선 굵기 — 로그 · 0이면 기본 1 · 상한 6(통로 안 나란한 선 간격 16 · 무거운 화살 방지 — diagram-layout.ts EDGE_W_MAX) */
export function edgeWidth(perSec: number | null): number {
  if (perSec === null || perSec <= 0) return 1;
  return Math.min(1 + Math.log10(1 + perSec), 6);
}

// ── 화면 상태(프레임 → 상태) ──

export type TimelineEntry =
  | { kind: 'batch'; batch: FlowBatchSummaryBody }
  /** 배치 번호가 건너뜀 — 병합으로 빠진 배치 수(점을 만들지 않는다) */
  | { kind: 'gap'; source: string; skipped: number; afterSeq: number; beforeSeq: number };

export interface TotalsSample {
  /** 프레임 windowEnd(게이트웨이 시계) */
  at: number;
  values: Record<string, number>;
}

export interface TotalsTrack {
  source: string;
  role: FlowRole;
  startedAt: number;
  samples: TotalsSample[];
  /** 이 구독 뒤 본 재기동 수(startedAt 변화 · 누적 감소) */
  restarts: number;
}

export interface FlowViewState {
  /** 최근 20배치 + 병합 생략 틈 — seq 오름차순(도착 순) */
  timeline: TimelineEntry[];
  /** 최근 20건 — 새것이 앞 */
  biz: FlowBizSummaryBody[];
  /** ingest source별 마지막 seq — 건너뜀 판정 */
  lastSeq: Record<string, number>;
  /** (source · role)별 누적 이력 */
  totals: Record<string, TotalsTrack>;
  /** 마지막 flow 프레임(빈 확인 프레임 포함)을 받은 브라우저 시각 */
  lastFrameAt: number | null;
  /** 마지막 배치 요약의 at(발행자 시계) */
  lastBatchAt: number | null;
  /** 브라우저 시계 − 게이트웨이 시계(마지막 프레임 receivedAt − windowEnd) — 서버 시각 추정 */
  clockOffset: number;
  /** 이 구독 뒤 병합 창 상한으로 버려진 요약 수(dropped 누적) */
  dropped: { batches: number; biz: number };
  /** 이 구독 뒤 seq 건너뜀으로 생략된 배치 수 */
  skipped: number;
  /** 가장 최근 배치(비활성 간선 판정) */
  latestBatch: FlowBatchSummaryBody | null;
}

export function emptyFlowState(): FlowViewState {
  return {
    timeline: [],
    biz: [],
    lastSeq: {},
    totals: {},
    lastFrameAt: null,
    lastBatchAt: null,
    clockOffset: 0,
    dropped: { batches: 0, biz: 0 },
    skipped: 0,
    latestBatch: null,
  };
}

/** 구독 확인 프레임 — 서버는 요약 없는 창에 프레임을 보내지 않으므로 빈 프레임은 subscribe_flow 확인뿐이다 */
export function isAckFrame(f: FlowFrameBody): boolean {
  return (
    f.batches.length === 0 &&
    f.biz.length === 0 &&
    f.totals.length === 0 &&
    f.dropped.batches === 0 &&
    f.dropped.biz === 0
  );
}

function trimTimeline(entries: TimelineEntry[]): TimelineEntry[] {
  let batches = 0;
  let i = entries.length;
  while (i > 0) {
    const e = entries[i - 1];
    if (e?.kind === 'batch') {
      if (batches === FLOW_RING) break;
      batches += 1;
    }
    i -= 1;
  }
  const out = entries.slice(i);
  while (out[0]?.kind === 'gap') out.shift(); // 앞 배치가 밀려난 틈은 뜻이 없다
  return out;
}

function totalsKey(e: Pick<FlowTotalsEntryBody, 'source' | 'role'>): string {
  return `${e.source}|${e.role}`;
}

function counters(e: FlowTotalsEntryBody): Record<string, number> {
  const { source: _s, role: _r, startedAt: _t, ...rest } = e;
  return rest as Record<string, number>;
}

/** totals 이력 보존 — 창 10초 밖 샘플은 창 시작 직전 하나만 남긴다 */
const TOTALS_KEEP_MS = FLOW_RATE_WINDOW_MS * 3;

/** 드문 트랙 — 업무 명령은 요청이 있을 때만 요약 · totals가 온다(창에 요약이 없으면 그 (source · role)는 프레임에 없다) */
function isSparseRole(role: FlowRole): boolean {
  return role === 'biz-writer' || role === 'api-direct';
}

/**
 * 업무 트랙을 처음 본 프레임의 기준점 — 누적(이 창 마지막 값) − 이 창의 같은 (source · role) 요약 수.
 * 구독 뒤 요약만 프레임에 오므로 그 직전 누적이 이 값이다 — 첫 명령 1건만 와도 초당 값이 생긴다.
 * 계수 갈래는 계약(commands = applied + rejected + expired + failed · duplicates는 부분집합)을 따른다.
 * 창에서 버린 업무 요약이 있으면(dropped.biz > 0) 몇 건이 이 트랙 몫인지 모르므로 만들지 않는다(옛 규칙 — 다음 샘플부터).
 */
function sparseBaseline(
  e: FlowTotalsEntryBody,
  values: Record<string, number>,
  biz: readonly FlowBizSummaryBody[],
  droppedBiz: number,
): Record<string, number> | null {
  if (droppedBiz > 0) return null;
  const mine = biz.filter((b) => b.source === e.source && b.role === e.role);
  if (mine.length === 0) return null;
  const base = { ...values };
  const dec = (k: string) => {
    if (base[k] !== undefined) base[k] -= 1;
  };
  for (const b of mine) {
    dec('commands');
    if (b.result === 'ok') dec('applied');
    else if (b.result === 'expired') dec('expired');
    else if (b.result === 'common.postgres_unavailable') dec('failed');
    else dec('rejected');
    if (b.duplicate) dec('duplicates');
  }
  return Object.values(base).some((v) => v < 0) ? null : base;
}

function applyTotals(
  tracks: Record<string, TotalsTrack>,
  entries: readonly FlowTotalsEntryBody[],
  at: number,
  biz: readonly FlowBizSummaryBody[] = [],
  droppedBiz = 0,
): Record<string, TotalsTrack> {
  if (entries.length === 0) return tracks;
  const next = { ...tracks };
  for (const e of entries) {
    const key = totalsKey(e);
    const values = counters(e);
    const prev = next[key];
    const sample = { at, values };
    if (!prev) {
      const base = isSparseRole(e.role) ? sparseBaseline(e, values, biz, droppedBiz) : null;
      const samples = base ? [{ at: at - FLOW_MERGE_WINDOW_MS, values: base }, sample] : [sample];
      next[key] = { source: e.source, role: e.role, startedAt: e.startedAt, samples, restarts: 0 };
      continue;
    }
    const last = prev.samples[prev.samples.length - 1];
    const decreased =
      last !== undefined && Object.entries(values).some(([k, v]) => v < (last.values[k] ?? 0));
    if (prev.startedAt !== e.startedAt || decreased) {
      // 재기동 — 누적이 0으로 돌아갔다. 이력을 버려 이 source의 초당 값 계산을 한 창 건너뛴다(표시 계약 재기동)
      next[key] = { ...prev, startedAt: e.startedAt, samples: [sample], restarts: prev.restarts + 1 };
      continue;
    }
    const samples = [...prev.samples, sample];
    while (samples.length > 2 && (samples[1]?.at ?? at) < at - TOTALS_KEEP_MS) samples.shift();
    next[key] = { ...prev, samples };
  }
  return next;
}

export interface FlowApplyResult {
  state: FlowViewState;
  /** 이 프레임에서 새로 점을 만들 요약 */
  added: { batches: FlowBatchSummaryBody[]; biz: FlowBizSummaryBody[] };
}

/**
 * 프레임 하나를 상태에 반영한다.
 * - 확인 프레임이면 seq 추적을 비운다 — 새 구독(재연결 포함)이라 끊긴 동안 오지 않은 배치를 병합 생략으로 적지 않는다.
 * - 배치 seq가 건너뛰면 틈 표지(병합 생략) — 점은 받은 배치만 만든다. seq가 줄면 재기동으로 보고 틈을 두지 않는다.
 * - 간선 굵기 · 합계는 totals에서 — 요약이 빠져도 합계가 맞는다.
 */
export function applyFlowFrame(state: FlowViewState, f: FlowFrameBody, receivedAt: number): FlowApplyResult {
  const clockOffset = receivedAt - f.windowEnd;
  if (isAckFrame(f)) {
    return {
      state: { ...state, lastSeq: {}, lastFrameAt: receivedAt, clockOffset },
      added: { batches: [], biz: [] },
    };
  }
  const lastSeq = { ...state.lastSeq };
  let skipped = state.skipped;
  const timeline = [...state.timeline];
  const added: FlowApplyResult['added'] = { batches: [], biz: [] };
  const batches = [...f.batches].sort((a, b) => a.seq - b.seq);
  for (const b of batches) {
    const prev = lastSeq[b.source];
    if (prev === b.seq) continue; // 같은 배치 중복 수신
    if (prev !== undefined && b.seq > prev + 1) {
      const n = b.seq - prev - 1;
      skipped += n;
      timeline.push({ kind: 'gap', source: b.source, skipped: n, afterSeq: prev, beforeSeq: b.seq });
    }
    lastSeq[b.source] = b.seq;
    timeline.push({ kind: 'batch', batch: b });
    added.batches.push(b);
  }
  const biz = [...f.biz].sort((a, b) => b.at - a.at || b.seq - a.seq);
  added.biz = [...biz].reverse();
  const latest = batches[batches.length - 1] ?? null;
  return {
    state: {
      timeline: trimTimeline(timeline),
      biz: [...biz, ...state.biz].slice(0, FLOW_RING),
      lastSeq,
      totals: applyTotals(state.totals, f.totals, f.windowEnd, f.biz, f.dropped.biz),
      lastFrameAt: receivedAt,
      lastBatchAt: latest ? Math.max(latest.at, state.lastBatchAt ?? 0) : state.lastBatchAt,
      clockOffset,
      dropped: {
        batches: state.dropped.batches + f.dropped.batches,
        biz: state.dropped.biz + f.dropped.biz,
      },
      skipped,
      latestBatch: latest ?? state.latestBatch,
    },
    added,
  };
}

/** 게이트웨이 시계로 본 지금 — 발행자 · 게이트웨이 시각(at · windowEnd)과 비교할 때 쓴다 */
export function serverNow(state: Pick<FlowViewState, 'clockOffset'>, browserNow: number): number {
  return browserNow - state.clockOffset;
}

/** 마지막 요약이 이보다 오래되면 "멈춤"으로 보고 지금 시각까지 창을 민다 — 묶음은 약 1초마다 오므로 3초면 멈춘 것이다 */
export const FLOW_RATE_STALE_MS = 3_000;

/**
 * 한 (source · role) 누적의 최근 10초 초당 값.
 * 요약이 계속 오는 동안은 **창 끝을 마지막 샘플 시각에 둔다** — 값(마지막) − 값(마지막 − 10초 이전 마지막 샘플)을 두 샘플 시각 차로 나눈다.
 * 창 끝을 브라우저가 추정한 지금(serverNow)에 두면 요약 간격 · 시계 차이만큼 분모가 늘어 모든 초당 값이 작게 나온다
 * (리드 확인 2026-10-03 — 메트릭 5초 차분 10,004개/초 대 흐름 요약 8,412개/초, 밀린 데이터 0인데 16% 차).
 * 마지막 샘플이 FLOW_RATE_STALE_MS보다 오래되면(요약이 끊김 — 적재 멈춤) 창 끝을 지금으로 밀어 값이 줄어들게 한다 — 멈춘 그림이 곧 멈춘 적재다.
 * 샘플이 둘 미만(구독 직후 · 재기동 직후)이면 null — 재기동 한 창 건너뛰기.
 * 업무 명령 트랙(biz-writer · api-direct)은 드물게 오므로 sparseRate(분모 10초 고정)로 잰다.
 */
export function trackRate(track: TotalsTrack, field: string, now: number): number | null {
  const s = track.samples;
  const last = s[s.length - 1];
  if (s.length < 2 || last === undefined) return null;
  if (isSparseRole(track.role)) return sparseRate(s, last, field, now);
  const stale = now - last.at > FLOW_RATE_STALE_MS;
  const end = stale ? now : last.at;
  const from = end - FLOW_RATE_WINDOW_MS;
  let base = s[0] as TotalsSample;
  for (const x of s) if (x.at <= from) base = x;
  // 요약이 오는 동안은 두 샘플 사이 실제 시간 · 멈췄으면 창 [from, 지금]
  const start = stale ? Math.max(base.at, from) : base.at;
  const sec = (end - start) / 1000;
  const lv = last.values[field];
  const bv = base.values[field];
  if (sec <= 0 || lv === undefined || bv === undefined || lv < bv) return null;
  return (lv - bv) / sec;
}

/**
 * 드문 트랙(업무 명령)의 초당 값 — 최근 10초 창 [지금 − 10초, 지금] 안 증가분 ÷ 10초.
 * 기준은 창 시작 이전 마지막 샘플(없으면 첫 샘플 — 첫 명령의 기준점) · 분모는 늘 10초다.
 * 촘촘한 트랙처럼 두 샘플 사이 시간으로 나누면 명령 간격(수십 초)이 분모가 되어 1건이 "0.1 미만"으로 묻히고,
 * 샘플이 창 밖으로 나가면 다음 명령까지 값이 남지 않는다 — 10초 동안 1건이면 0.1, 그 뒤 10초가 지나면 0.
 */
function sparseRate(
  s: readonly TotalsSample[],
  last: TotalsSample,
  field: string,
  now: number,
): number | null {
  const end = Math.max(now, last.at);
  const from = end - FLOW_RATE_WINDOW_MS;
  let base = s[0] as TotalsSample;
  for (const x of s) if (x.at <= from) base = x;
  const lv = last.values[field];
  const bv = base.values[field];
  if (lv === undefined || bv === undefined || lv < bv) return null;
  return (lv - bv) / (FLOW_RATE_WINDOW_MS / 1000);
}

/** 역할(들)의 초당 값 합 — source 여럿(워커 여럿)을 더한다 · 계산 가능한 track이 없으면 null */
export function roleRate(
  tracks: Record<string, TotalsTrack>,
  roles: readonly FlowRole[],
  field: string,
  now: number,
): number | null {
  let sum: number | null = null;
  for (const t of Object.values(tracks)) {
    if (!roles.includes(t.role)) continue;
    const r = trackRate(t, field, now);
    if (r !== null) sum = (sum ?? 0) + r;
  }
  return sum;
}

/** 간선 굵기 · 머리 초당 값 한 벌 */
export interface FlowRates {
  batches: number | null;
  rows: number | null;
  chRows: number | null;
  controlCopyRows: number | null;
  latestWrites: number | null;
  commands: number | null;
  commandsWriter: number | null;
  commandsDirect: number | null;
  /** 업무 커밋(biz-writer · api-direct applied) — PostgreSQL 노드 · 카드의 업무 건수 */
  applied: number | null;
  rejected: number | null;
  failed: number | null;
  expired: number | null;
}

/**
 * subscribed — 흐름 구독이 확인된 동안(flowSubStatus 'subscribed')이면 업무 트랙이 하나도 없는 것은 "구독 뒤 명령 0건"이다
 * (totals는 요약이 있는 (source · role)만 오므로 없음 = 요약 없음) — 업무 요청 · 업무 커밋(commands · applied)을 null 대신 0으로 둔다
 * (리드 판정 2026-10-03 — 주니어에게 "—"는 고장으로 읽힌다). 트랙이 있는데 값을 모르면(샘플 하나 · 버린 요약 · 재기동) null 그대로다.
 */
export function flowRates(
  tracks: Record<string, TotalsTrack>,
  now: number,
  opts: { subscribed?: boolean } = {},
): FlowRates {
  const ing = (f: string) => roleRate(tracks, ['ingest'], f, now);
  const biz = (f: string) => roleRate(tracks, ['biz-writer', 'api-direct'], f, now);
  const noBiz = opts.subscribed === true && !Object.values(tracks).some((t) => isSparseRole(t.role));
  const bizOrZero = (v: number | null) => (v === null && noBiz ? 0 : v);
  return {
    batches: ing('batches'),
    rows: ing('rows'),
    chRows: ing('chRows'),
    controlCopyRows: ing('controlCopyRows'),
    latestWrites: ing('latestWrites'),
    commands: bizOrZero(biz('commands')),
    commandsWriter: roleRate(tracks, ['biz-writer'], 'commands', now),
    commandsDirect: roleRate(tracks, ['api-direct'], 'commands', now),
    applied: bizOrZero(biz('applied')),
    rejected: biz('rejected'),
    failed: biz('failed'),
    expired: biz('expired'),
  };
}

/**
 * 구독 표지 상태 — 셸 WS 3상태를 따른다 · 첫 연결 전(idle · connecting)은 끊김이 아니라 연결 중이다
 * (끊김 띠 · 흐림 없음 — 진입 직후 한 순간 "끊김"이 깜박이면 고장으로 읽힌다).
 */
export type FlowSubStatus = 'subscribed' | 'requesting' | 'connecting' | 'disconnected';

export function flowSubStatus(
  conn: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed',
  flow: 'off' | 'requesting' | 'subscribed',
): FlowSubStatus {
  if (conn === 'idle' || conn === 'connecting') return 'connecting';
  if (conn !== 'open') return 'disconnected';
  return flow === 'subscribed' ? 'subscribed' : 'requesting';
}

/** 요약 없음 — 구독 중인데 10초 동안 프레임(확인 프레임 포함)이 없다 */
export function noSummary(
  state: Pick<FlowViewState, 'lastFrameAt'>,
  sub: FlowSubStatus,
  now: number,
): boolean {
  return sub === 'subscribed' && state.lastFrameAt !== null && now - state.lastFrameAt >= FLOW_NO_SUMMARY_MS;
}

/**
 * 센서 배치가 안 온다 — 구독 중인데 배치 요약을 한 번도 받지 못했거나 마지막 배치가 10초 넘게 지났다.
 * 업무 요약만 오는 동안(직접 보낸 업무 요청)도 센서는 안 오는 것이다 — 그래서 프레임이 아니라 배치 시각(발행자 시계 · serverNow와 비교)으로 본다.
 */
export function sensorQuiet(
  state: Pick<FlowViewState, 'lastBatchAt'>,
  sub: FlowSubStatus,
  serverNowMs: number,
): boolean {
  return (
    sub === 'subscribed' &&
    (state.lastBatchAt === null || serverNowMs - state.lastBatchAt >= FLOW_NO_SUMMARY_MS)
  );
}

// ── 흐름도 위 알림 한 줄(08_evidence_screens §EXP-FLOW 빈 값 · 알림) ──
export const FLOW_DISCONNECTED_NOTICE = '연결이 끊겨 점을 멈췄어요 — 다시 연결되면 이어서 보여 줘요';
export const FLOW_NO_DATA_WARNING = '10s째 새 데이터가 오지 않아요 — 센서 데이터 적재가 멈췄을 수 있어요';
export const FLOW_ACK_LATE_NOTICE = '연결 확인이 늦어지고 있어요';
/**
 * 설비 가동 꺼짐(health run.sensorAutogen off — 실행 중 실효 상태 · 설비 가동 스위치가 정한다) — 고장이 아니라 꺼 둔 상태라 경고가 아니라 길 안내다.
 * 켜는 길 둘: 화면 머리 설비 가동 스위치 · 셸 머리 '직접 보내 보기'.
 */
export const FLOW_AUTOGEN_OFF_NOTICE =
  "설비 가동이 꺼져 있어요 — 위 스위치로 켜거나 '직접 보내 보기'로 보내 보세요";

/** warn = 경고 색(앰버) · info = 차분한 안내(회색) */
export interface FlowNotice {
  text: string;
  tone: 'warn' | 'info';
}

export interface FlowNoticeInput {
  sub: FlowSubStatus;
  silent: boolean;
  ackOverdue: boolean;
  sensorQuiet: boolean;
  sensorAutogen: 'on' | 'off' | null;
  /** 이 화면의 flow 실행이 running · stopping인가(실행 패널 current 폴링 · lib/runs isActive) */
  flowRunActive: boolean;
}

/**
 * 알림 한 줄 고르기 — 끊김 > 자동 생성 꺼짐 안내 > 10초 무데이터 경고 > 확인 지연.
 * 꺼짐 안내는 health가 off라고 말할 때만 — health를 아직 못 읽었거나(null) on이면 지금 경고 그대로다.
 * off인데 센서가 안 오는 것은 고장이 아니다: 경고로 띄우면 학습자가 멈춘 적재를 고치려 든다.
 * 직접 보내 보기(flow 실행)가 running · stopping이면 꺼짐 안내를 띄우지 않는다 — 보내는 중에 "보내 보세요"는 모순이다.
 * 그동안의 침묵은 아래 규칙(10초 무데이터 경고 · 확인 지연)이 그대로 본다.
 */
export function flowNotice(o: FlowNoticeInput): FlowNotice | null {
  if (o.sub === 'disconnected') return { text: FLOW_DISCONNECTED_NOTICE, tone: 'warn' };
  if (o.sensorAutogen === 'off' && o.sensorQuiet && !o.flowRunActive)
    return { text: FLOW_AUTOGEN_OFF_NOTICE, tone: 'info' };
  if (o.silent) return { text: FLOW_NO_DATA_WARNING, tone: 'warn' };
  if (o.ackOverdue) return { text: FLOW_ACK_LATE_NOTICE, tone: 'warn' };
  return null;
}

// ── 메트릭 흐름 보기(BFF ?view=flow — 웹 내부 계약 · §데이터 원천의 이름만 요약) ──

export interface FlowChTable {
  bytesOnDisk: number | null;
  uncompressedBytes: number | null;
  rows: number | null;
  activeParts: number | null;
  newPartsTotal: number | null;
}

export interface FlowPgTable {
  heapBytes: number | null;
  indexBytes: number | null;
  liveTuples: number | null;
  deadTuples: number | null;
}

export type FlowStore = 'clickhouse' | 'postgres' | 'redis';

export interface FlowMetrics {
  source: {
    /** points_emitted 합(device 전부 · 누적) — Collector */
    pointsEmitted: number | null;
    /** gen_points_generated_total{mode}(누적) — run(라이브 flow 실행)을 모드 A(가상 PLC 레지스터 갱신)와 따로 */
    genByMode: Record<string, number> | null;
    /** redis_stream_entries_added_total{stream}(누적) */
    streamAdded: Record<string, number> | null;
  };
  clickhouse: {
    tables: Record<string, FlowChTable>;
    insertedRowsTotal: number | null;
    rowsInserted: number | null;
  };
  postgres: {
    tables: Record<string, FlowPgTable>;
    walBytesTotal: number | null;
    xactCommitTotal: number | null;
  };
  redis: {
    usedMemoryBytes: number | null;
    maxMemoryBytes: number | null;
    prefixMemory: Record<string, number> | null;
    streamLength: Record<string, number> | null;
    /** consumer_lag — 적체 판정(길이 아님) */
    consumerLag: number | null;
    backpressure: Record<string, number> | null;
    latestUpdates: Record<string, number> | null;
    /** biz_stream_lag — 명령 적체 판정 */
    bizStreamLag: number | null;
    /** biz_commands_total{result} 합(kind 전부 · 누적) — api · 워커 두 주체가 한 명령을 두 번 셀 수 있다 */
    bizCommands: Record<string, number> | null;
  };
  /**
   * 조회(설계 §9 조회 줄 · 10_observability/01 §RLT · TSQ · MST) — 모두 누적 · 레이블별.
   * tsq · rlt_latest_requests · mst는 요청 건수(요청 1건 = 1)고, latestPoints는 **응답한 점 수**(설비당 약 200)라 요청 수로 쓰지 않는다(툴팁에만).
   */
  reads: {
    /** tsq_cache_requests_total{result} — 센서 시계열 조회 사본(cache:q) · miss면 ClickHouse */
    series: Record<string, number> | null;
    /** rlt_latest_requests_total{result hit · restored · bypass · error} — 센서 지금 값(rt:latest) · restored = 없어서 ClickHouse에서 복원 · bypass = 스위치로 Redis를 건너뛰고 ClickHouse */
    latest: Record<string, number> | null;
    /** mst_cache_requests_total{result} — 업무 목록 사본(cache:devlist) · miss면 PostgreSQL */
    master: Record<string, number> | null;
    /** rlt_latest_points_served_total{freshness} — 지금 값 조회가 응답한 태그 값 수(Redis rt:latest) */
    latestPoints: Record<string, number> | null;
  };
  /** e2e_latency{quantile}(초 · 최근 창 ingested_at − ts) · e2e_latency_rows(0이면 게이지가 비었다) — 숫자 4 "측정 → 저장까지"(OBS-04 · p50) */
  e2e: { p50: number | null; p95: number | null; p99: number | null; rows: number | null };
  /** obs_collect_last_success_timestamp_seconds{store} — epoch 초 */
  collectedAt: Record<FlowStore, number | null>;
}

function add(rec: Record<string, number>, key: string | undefined, v: number) {
  const k = key ?? '(레이블 없음)';
  rec[k] = (rec[k] ?? 0) + v;
}

const orNull = (rec: Record<string, number>) => (Object.keys(rec).length > 0 ? rec : null);

export function summarizeFlow(samples: readonly MetricSample[]): FlowMetrics {
  let pointsEmitted: number | null = null;
  const genByMode: Record<string, number> = {};
  const streamAdded: Record<string, number> = {};
  const chTables: Record<string, FlowChTable> = {};
  const pgTables: Record<string, FlowPgTable> = {};
  const prefixMemory: Record<string, number> = {};
  const streamLength: Record<string, number> = {};
  const backpressure: Record<string, number> = {};
  const latestUpdates: Record<string, number> = {};
  const bizCommands: Record<string, number> = {};
  const readSeries: Record<string, number> = {};
  const readMaster: Record<string, number> = {};
  const readLatest: Record<string, number> = {};
  const latestPoints: Record<string, number> = {};
  const m: FlowMetrics = {
    source: { pointsEmitted: null, genByMode: null, streamAdded: null },
    clickhouse: { tables: chTables, insertedRowsTotal: null, rowsInserted: null },
    postgres: { tables: pgTables, walBytesTotal: null, xactCommitTotal: null },
    redis: {
      usedMemoryBytes: null,
      maxMemoryBytes: null,
      prefixMemory: null,
      streamLength: null,
      consumerLag: null,
      backpressure: null,
      latestUpdates: null,
      bizStreamLag: null,
      bizCommands: null,
    },
    reads: { series: null, latest: null, master: null, latestPoints: null },
    e2e: { p50: null, p95: null, p99: null, rows: null },
    collectedAt: { clickhouse: null, postgres: null, redis: null },
  };
  const ch = (t: string | undefined): FlowChTable => {
    const k = t ?? '(레이블 없음)';
    chTables[k] ??= {
      bytesOnDisk: null,
      uncompressedBytes: null,
      rows: null,
      activeParts: null,
      newPartsTotal: null,
    };
    return chTables[k];
  };
  const pg = (t: string | undefined): FlowPgTable => {
    const k = t ?? '(레이블 없음)';
    pgTables[k] ??= { heapBytes: null, indexBytes: null, liveTuples: null, deadTuples: null };
    return pgTables[k];
  };
  const plus = (a: number | null, v: number) => (a ?? 0) + v;

  for (const s of samples) {
    const v = s.value;
    const l = s.labels;
    switch (s.name) {
      case 'points_emitted':
        pointsEmitted = plus(pointsEmitted, v);
        break;
      case 'gen_points_generated_total':
        add(genByMode, l.mode, v);
        break;
      case 'redis_stream_entries_added_total':
        add(streamAdded, l.stream, v);
        break;
      case 'ch_parts_bytes_on_disk':
        ch(l.table).bytesOnDisk = plus(ch(l.table).bytesOnDisk, v);
        break;
      case 'ch_parts_uncompressed_bytes':
        ch(l.table).uncompressedBytes = plus(ch(l.table).uncompressedBytes, v);
        break;
      case 'ch_parts_rows':
        ch(l.table).rows = plus(ch(l.table).rows, v);
        break;
      case 'ch_active_parts':
        ch(l.table).activeParts = plus(ch(l.table).activeParts, v);
        break;
      case 'ch_new_parts_total':
        ch(l.table).newPartsTotal = plus(ch(l.table).newPartsTotal, v);
        break;
      case 'ch_inserted_rows_total':
        m.clickhouse.insertedRowsTotal = plus(m.clickhouse.insertedRowsTotal, v);
        break;
      case 'rows_inserted':
        m.clickhouse.rowsInserted = plus(m.clickhouse.rowsInserted, v);
        break;
      case 'pg_relation_size_bytes':
        if (l.kind === 'index') pg(l.table).indexBytes = plus(pg(l.table).indexBytes, v);
        else pg(l.table).heapBytes = plus(pg(l.table).heapBytes, v);
        break;
      case 'pg_table_live_tuples':
        pg(l.table).liveTuples = plus(pg(l.table).liveTuples, v);
        break;
      case 'pg_table_dead_tuples':
        pg(l.table).deadTuples = plus(pg(l.table).deadTuples, v);
        break;
      case 'pg_wal_bytes_total':
        m.postgres.walBytesTotal = v;
        break;
      case 'pg_xact_commit_total':
        m.postgres.xactCommitTotal = v;
        break;
      case 'redis_used_memory_bytes':
        m.redis.usedMemoryBytes = v;
        break;
      case 'redis_maxmemory_bytes':
        m.redis.maxMemoryBytes = v;
        break;
      case 'redis_prefix_memory_bytes':
        add(prefixMemory, l.prefix, v);
        break;
      case 'redis_stream_length':
        add(streamLength, l.stream, v);
        break;
      case 'consumer_lag':
        m.redis.consumerLag = v;
        break;
      case 'backpressure_stage':
        add(backpressure, l.publisher, v);
        break;
      case 'rlt_latest_updates_total':
        add(latestUpdates, l.writer, v);
        break;
      case 'biz_stream_lag':
        m.redis.bizStreamLag = v;
        break;
      case 'biz_commands_total':
        add(bizCommands, l.result, v);
        break;
      case 'tsq_cache_requests_total':
        add(readSeries, l.result, v);
        break;
      case 'rlt_latest_requests_total':
        add(readLatest, l.result, v);
        break;
      case 'mst_cache_requests_total':
        add(readMaster, l.result, v);
        break;
      case 'rlt_latest_points_served_total':
        add(latestPoints, l.freshness, v);
        break;
      case 'e2e_latency':
        if (l.quantile === '0.5') m.e2e.p50 = v;
        else if (l.quantile === '0.95') m.e2e.p95 = v;
        else if (l.quantile === '0.99') m.e2e.p99 = v;
        break;
      case 'e2e_latency_rows':
        m.e2e.rows = v;
        break;
      case 'obs_collect_last_success_timestamp_seconds':
        if (l.store === 'clickhouse' || l.store === 'postgres' || l.store === 'redis')
          m.collectedAt[l.store] = v;
        break;
    }
  }
  m.source = {
    pointsEmitted,
    genByMode: orNull(genByMode),
    streamAdded: orNull(streamAdded),
  };
  m.redis.prefixMemory = orNull(prefixMemory);
  m.redis.streamLength = orNull(streamLength);
  m.redis.backpressure = orNull(backpressure);
  m.redis.latestUpdates = orNull(latestUpdates);
  m.redis.bizCommands = orNull(bizCommands);
  m.reads = {
    series: orNull(readSeries),
    latest: orNull(readLatest),
    master: orNull(readMaster),
    latestPoints: orNull(latestPoints),
  };
  return m;
}

export interface FlowMetricsPoll {
  fetchedAt: number;
  flow: FlowMetrics;
}

/** 두 폴링 사이 초당 값 — 누적이 줄면(재기동) 그 값만 null(ratePerSecond 규칙) */
export interface FlowMetricRates {
  collectorPps: number | null;
  /** 모드별 — run(라이브 flow 실행)은 B와 따로 적는다(표시 계약 실행 발행 원천) */
  genPpsByMode: Record<string, number | null>;
  chNewPartsPerSec: Record<string, number | null>;
  walBytesPerSec: number | null;
  commitsPerSec: number | null;
  bizCommandsPerSec: Record<string, number | null>;
  latestUpdatesPerSec: Record<string, number | null>;
  /** 조회 — tsq_cache_requests_total · rlt_latest_requests_total · mst_cache_requests_total(건/초 · result별) · rlt_latest_points_served_total(점/초 · freshness별) */
  readSeriesPerSec: Record<string, number | null>;
  readLatestPerSec: Record<string, number | null>;
  readMasterPerSec: Record<string, number | null>;
  latestPointsPerSec: Record<string, number | null>;
}

function rateMap(
  prev: Record<string, number> | null | undefined,
  cur: Record<string, number> | null,
  pAt: number,
  cAt: number,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(cur ?? {})) {
    out[k] = ratePerSecond(prev ? { value: prev[k] ?? null, atMs: pAt } : null, { value: v, atMs: cAt });
  }
  return out;
}

export function flowMetricRates(prev: FlowMetricsPoll | null, cur: FlowMetricsPoll): FlowMetricRates {
  const p = prev?.flow;
  const c = cur.flow;
  const pAt = prev?.fetchedAt ?? 0;
  const one = (a: number | null | undefined, b: number | null) =>
    ratePerSecond(prev ? { value: a ?? null, atMs: pAt } : null, { value: b, atMs: cur.fetchedAt });
  const newParts: Record<string, number> = {};
  const prevParts: Record<string, number> = {};
  for (const [t, v] of Object.entries(c.clickhouse.tables))
    if (v.newPartsTotal !== null) newParts[t] = v.newPartsTotal;
  for (const [t, v] of Object.entries(p?.clickhouse.tables ?? {}))
    if (v.newPartsTotal !== null) prevParts[t] = v.newPartsTotal;
  return {
    collectorPps: one(p?.source.pointsEmitted, c.source.pointsEmitted),
    genPpsByMode: rateMap(p?.source.genByMode, c.source.genByMode, pAt, cur.fetchedAt),
    chNewPartsPerSec: rateMap(prev ? prevParts : null, newParts, pAt, cur.fetchedAt),
    walBytesPerSec: one(p?.postgres.walBytesTotal, c.postgres.walBytesTotal),
    commitsPerSec: one(p?.postgres.xactCommitTotal, c.postgres.xactCommitTotal),
    bizCommandsPerSec: rateMap(p?.redis.bizCommands, c.redis.bizCommands, pAt, cur.fetchedAt),
    latestUpdatesPerSec: rateMap(p?.redis.latestUpdates, c.redis.latestUpdates, pAt, cur.fetchedAt),
    // 옛 BFF 응답(reads 없음)도 받는다 — 배포가 엇갈린 동안 화면이 깨지지 않게
    readSeriesPerSec: rateMap(p?.reads?.series, c.reads?.series ?? null, pAt, cur.fetchedAt),
    readLatestPerSec: rateMap(p?.reads?.latest, c.reads?.latest ?? null, pAt, cur.fetchedAt),
    readMasterPerSec: rateMap(p?.reads?.master, c.reads?.master ?? null, pAt, cur.fetchedAt),
    latestPointsPerSec: rateMap(p?.reads?.latestPoints, c.reads?.latestPoints ?? null, pAt, cur.fetchedAt),
  };
}

/** 조회 줄 숫자(설계 §9.2 · 명세 08 §EXP-FLOW 조회 줄) — 모두 메트릭 5초 차분 · 단위는 요청 건/초(latestPoints만 점/초) */
export interface ReadRates {
  /** 조회 건/초 — 센서 시계열 + 센서 지금 값 + 업무 목록(전 결과 합) */
  requests: number | null;
  /** Redis에 있어 바로 답한 건/초(세 계열 hit 합) */
  hit: number | null;
  /** ClickHouse까지 간 건/초 — 시계열 miss + 지금 값 restored + 지금 값 bypass */
  chMiss: number | null;
  /** 그중 스위치로 Redis를 건너뛴 건/초(지금 값 bypass) — 툴팁 */
  bypass: number | null;
  /** PostgreSQL까지 간 건/초(업무 목록 miss) */
  pgMiss: number | null;
  /** Redis 읽기 실패 건/초(세 계열 error 합) — 0이 아닐 때만 툴팁 */
  error: number | null;
  /** 지금 값 조회가 응답한 점/초(설비당 약 200 — 요청 수가 아니다 · 툴팁) */
  latestPoints: number | null;
}

const sumKnown = (vals: readonly (number | null | undefined)[]): number | null => {
  const v = vals.filter((x): x is number => typeof x === 'number');
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0);
};

/** 조회 줄 숫자 — 원천 계열이 하나도 없으면 null(만들지 않는다) */
export function readRates(r: FlowMetricRates | null): ReadRates {
  const s = r?.readSeriesPerSec ?? {};
  const l = r?.readLatestPerSec ?? {};
  const m = r?.readMasterPerSec ?? {};
  return {
    requests: sumKnown([...Object.values(s), ...Object.values(l), ...Object.values(m)]),
    hit: sumKnown([s.hit, l.hit, m.hit]),
    chMiss: sumKnown([s.miss, l.restored, l.bypass]),
    bypass: sumKnown([l.bypass]),
    pgMiss: sumKnown([m.miss]),
    error: sumKnown([s.error, l.error, m.error]),
    latestPoints: sumKnown(Object.values(r?.latestPointsPerSec ?? {})),
  };
}

/** 비율(%) — 조회가 없거나(0) 모르면 null */
export function readShare(part: number | null, rr: Pick<ReadRates, 'requests'>): number | null {
  if (part === null || rr.requests === null || rr.requests <= 0) return null;
  return (part / rr.requests) * 100;
}

// ── 조회 점 — 조회는 요청마다 요약이 없어(메트릭 5초 차분뿐) 점을 실제 비율대로 뽑는다 ──

/** 조회 점의 갈래 — Redis 사본으로 바로 응답 · 없어서 ClickHouse까지 · 없어서 PostgreSQL까지 */
export type ReadKind = 'hit' | 'ch' | 'pg';
export const READ_KINDS: readonly ReadKind[] = ['hit', 'ch', 'pg'];
/** 조회 점 상한(초당) — 실제 조회가 이보다 많으면 점 하나가 여러 건을 대신한다(갈래 비율만 맞춘다) */
export const READ_DOTS_MAX_PER_SEC = 2;

export interface ReadDotPlan {
  /** 초당 점 수 — 실제 조회 건/초(Redis 읽기 실패 제외) · 상한 READ_DOTS_MAX_PER_SEC */
  perSec: number;
  /** 갈래 몫(합 1) — hit · chMiss · pgMiss 건/초의 비 */
  shares: Record<ReadKind, number>;
}

/** 조회 점 계획 — 조회가 없거나(0) 모르면 null(점을 만들지 않는다) */
export function readDotPlan(rr: ReadRates | null): ReadDotPlan | null {
  if (!rr) return null;
  const n = { hit: rr.hit ?? 0, ch: rr.chMiss ?? 0, pg: rr.pgMiss ?? 0 };
  const total = n.hit + n.ch + n.pg;
  if (!(total > 0)) return null;
  return {
    perSec: Math.min(total, READ_DOTS_MAX_PER_SEC),
    shares: { hit: n.hit / total, ch: n.ch / total, pg: n.pg / total },
  };
}

/** 갈래 고르기 상태 — 지금까지 받아야 할 몫(want)과 실제로 낸 수(got) */
export interface ReadPicker {
  want: Record<ReadKind, number>;
  got: Record<ReadKind, number>;
}
export const newReadPicker = (): ReadPicker => ({
  want: { hit: 0, ch: 0, pg: 0 },
  got: { hit: 0, ch: 0, pg: 0 },
});

/**
 * 다음 조회 점의 갈래 — 몫을 쌓고(want += shares) 가장 모자란 갈래를 낸다(동률은 hit · ClickHouse · PostgreSQL 순).
 * 무작위가 아니라서 몫이 그대로면 점 N개 안에서 갈래마다 N × 몫과 1개 넘게 벌어지지 않는다 — 화면의 % 와 점의 비율이 맞는다.
 */
export function pickReadKind(p: ReadPicker, shares: Record<ReadKind, number>): ReadKind {
  let best: ReadKind = 'hit';
  let gap = Number.NEGATIVE_INFINITY;
  for (const k of READ_KINDS) {
    p.want[k] += shares[k];
    const g = p.want[k] - p.got[k];
    if (g > gap) {
      gap = g;
      best = k;
    }
  }
  p.got[best] += 1;
  return best;
}

/**
 * 센서 대기줄(Stream)로 들어가는 생성 모드 — run(라이브 flow 실행)뿐이다.
 * A는 레지스터만 갱신하고 행은 Collector가 폴링해 만든다(points_emitted가 그 수 — 10_observability/01 §무손실 차 S2 판정) — 더하면 두 번 센다.
 */
export const STREAM_GEN_MODES: readonly string[] = ['run'];

/** 발생원 초당 포인트 — Collector 발행 + 대기줄로 가는 생성 모드만(공장 센서 노드 · 대기줄 간선 라벨) */
export function sourcePps(r: FlowMetricRates | null): number | null {
  if (!r) return null;
  const gen = Object.entries(r.genPpsByMode)
    .filter(([mode]) => STREAM_GEN_MODES.includes(mode))
    .map(([, v]) => v);
  const vals = [r.collectorPps, ...gen].filter((v): v is number => v !== null);
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

// ── 비활성 간선 · 스위치 표지(표시 계약 비활성 간선 · SW-12 direct · §스위치 영향) ──

export interface FlowSwitchFlags {
  controlCopyOff: boolean;
  /** SW-09 gated — 비교 사본은 직접 비교 실험(게이트 켬) 중에만 실린다(꺼진 길이 아니라 기다리는 길) */
  controlCopyGated: boolean;
  collectorLatest: boolean;
  streamOff: boolean;
  directGateway: boolean;
  deadband: boolean;
  bizDirect: boolean;
}

/** health 스위치가 기본값 밖 구현인가 — 도입 전(impl null) · 없음은 기본으로 본다 */
function isAlt(switches: Record<string, SwitchStateBody> | null, id: string): boolean {
  const s = switches?.[id];
  const spec = SWITCHES.find((x) => x.id === id);
  if (!s || s.impl === null || !spec) return false;
  return String(s.value) !== String(spec.defaultValue);
}

/**
 * 요약이 있으면 요약의 필드가 이긴다(지금 실제로 지난 길) — controlCopy null → SW-09 off · latestWrites null → SW-11 collector ·
 * stream null → SW-01 대안 · 업무는 마지막 요약의 role. 요약이 없을 때만 health 스위치로 그린다.
 */
export function flowSwitchFlags(
  latestBatch: FlowBatchSummaryBody | null,
  lastBiz: FlowBizSummaryBody | null,
  switches: Record<string, SwitchStateBody> | null,
): FlowSwitchFlags {
  // SW-09는 값이 셋(off · on · gated — 기본 gated) — 요약이 없으면 on일 때만 길을 그린다(gated는 실험 중에만 실린다)
  const sw09 = switches?.['SW-09'];
  const sw09Value = sw09 && sw09.impl !== null ? String(sw09.value) : null;
  return {
    controlCopyOff: latestBatch ? latestBatch.controlCopy === null : sw09Value !== 'on',
    controlCopyGated: sw09Value === null || sw09Value === 'gated',
    collectorLatest: latestBatch ? latestBatch.latestWrites === null : isAlt(switches, 'SW-11'),
    streamOff: latestBatch ? latestBatch.stream === null : isAlt(switches, 'SW-01'),
    directGateway: isAlt(switches, 'SW-06'),
    deadband: isAlt(switches, 'SW-10'),
    bizDirect: lastBiz ? isDirect(lastBiz) : isAlt(switches, 'SW-12'),
  };
}

// ── 숫자 4 · 모아서 vs 하나씩(docs/08_screen/08_evidence_screens.md §EXP-FLOW §요소) ──

export interface StageAvg<K extends string> {
  key: K;
  label: string;
  /** 그 단계가 null이 아닌 요약만으로 낸 평균 · 표본이 없으면 null */
  avg: number | null;
  n: number;
}

function stageAvgs<K extends string>(
  stages: readonly { key: K; label: string }[],
  items: readonly { stages: Record<K, number | null> }[],
): StageAvg<K>[] {
  return stages.map(({ key, label }) => {
    const vals = items.map((i) => i.stages[key]).filter((v): v is number => v !== null);
    return {
      key,
      label,
      avg: vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length,
      n: vals.length,
    };
  });
}

/** 처리 방식 비교 — 대용량 1배치(최근 20배치 단계 6 평균 · null 단계는 그 배치에서 뺀다) */
export function batchStageAverages(timeline: readonly TimelineEntry[]): {
  stages: StageAvg<BatchStageKey>[];
  total: number | null;
  n: number;
} {
  const batches = timeline.flatMap((e) => (e.kind === 'batch' ? [e.batch] : [])).slice(-FLOW_RING);
  const stages = stageAvgs(BATCH_STAGES, batches);
  return { stages, total: sumAvgs(stages), n: batches.length };
}

/** 처리 방식 비교 — 업무 1명령(최근 20명령 단계 4 평균 · 같은 규칙) */
export function bizStageAverages(biz: readonly FlowBizSummaryBody[]): {
  stages: StageAvg<BizStageKey>[];
  total: number | null;
  n: number;
} {
  const ring = biz.slice(0, FLOW_RING);
  const stages = stageAvgs(BIZ_STAGES, ring);
  return { stages, total: sumAvgs(stages), n: ring.length };
}

function sumAvgs(stages: readonly { avg: number | null }[]): number | null {
  const v = stages.map((s) => s.avg).filter((x): x is number => x !== null);
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0);
}

/** 대기줄에서 기다리는 단계 — 센서는 스트림 대기 · 업무는 대기(BATCH_STAGES · BIZ_STAGES의 첫 단계) */
export const BATCH_WAIT_STAGE: BatchStageKey = 'streamWaitMs';
export const BIZ_WAIT_STAGE: BizStageKey = 'queueWaitMs';

/**
 * 처리 시간 · 대기 시간 — 단계 평균을 대기 단계와 나머지(처리)로 가른다(docs/08_screen/08_evidence_screens.md §EXP-FLOW §요소).
 * 대기줄이 밀리면(예: ClickHouse가 멈춘 사이 쌓인 줄을 따라잡는 중) 대기만 수천 초로 커져 처리 방식 비교가 묻힌다 — 막대는 처리만,
 * 대기는 따로 한 줄. 둘 다 원천 단계 평균 그대로다(지어내지 않는다) · 그 단계 표본이 없으면 null.
 */
export function workAndWait<K extends string>(
  stages: readonly StageAvg<K>[],
  waitKey: K,
): { work: number | null; wait: number | null } {
  return {
    work: sumAvgs(stages.filter((s) => s.key !== waitKey)),
    wait: stages.find((s) => s.key === waitKey)?.avg ?? null,
  };
}

/**
 * 사람이 읽는 시간 — 1초 미만 "120ms"(10ms 미만은 소수 1자리 "7.9ms") · 1분 미만 "1.2s" · 1시간 미만 "46m 28s" · 그 위 "3h 2m".
 * 반올림한 뒤의 값으로 단위를 다시 고른다 — 999.6ms는 "1,000ms"가 아니라 "1.0s" · 59.96s는 "60.0s"가 아니라 "1m 0s".
 */
export function durationText(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 9.95) return `${ms.toFixed(1)}ms`;
  if (Math.round(ms) < 1_000) return `${Math.round(ms)}ms`;
  if (Math.round(ms / 100) < 600) return `${(ms / 1000).toFixed(1)}s`;
  const s = Math.round(ms / 1000);
  if (s < 3_600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const m = Math.round(s / 60);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * 움직임 줄이기(prefers-reduced-motion) — 점을 움직이지 않고 한 자리에 멈춰 보인다: 그 점이 가장 오래 머무는 다리의 도착 노드.
 * 대기줄이 밀리면 ① 대기줄 · 평소엔 ClickHouse 저장 · 업무는 트랜잭션처럼 "시간이 어디서 갔나"가 그 자리다(단계 ms 원천 그대로).
 * 잰 단계가 없는 다리(본 점의 COPY 기다림 · api 응답 고정 다리)는 고르지 않는다 · 모든 다리가 0이면 출발 노드.
 */
export function restNode<N extends string>(plan: DotPlan<N>): N {
  let best: Leg<N> | null = null;
  for (const leg of plan.legs)
    if (leg.stage !== null && leg.ms > 0 && (best === null || leg.ms > best.ms)) best = leg;
  return best ? best.to : plan.start;
}

/**
 * 캐시 무효화 키/초 — 링 버퍼 biz[] 중 최근 10초(게이트웨이 시계) invalidatedKeys 합 ÷ 10초.
 * totals에 없는 값이라 병합 창 상한으로 버려진 업무 요약(dropped.biz)이 있으면 실제보다 작다 — lowerBound 표지.
 */
export function invalidationRate(
  biz: readonly FlowBizSummaryBody[],
  droppedBiz: number,
  now: number,
): { value: number; lowerBound: boolean } {
  const from = now - FLOW_RATE_WINDOW_MS;
  const keys = biz.filter((b) => b.at > from && b.at <= now).reduce((a, b) => a + b.invalidatedKeys, 0);
  return { value: keys / (FLOW_RATE_WINDOW_MS / 1000), lowerBound: droppedBiz > 0 };
}

/** 센서 대기줄에 밀린 데이터(plc:raw 랙) — 마지막 배치 stream.lag(null이면 메트릭 consumer_lag) · SW-01 대안(stream null)이면 없음 */
export function plcRawLag(
  latestBatch: FlowBatchSummaryBody | null,
  consumerLag: number | null,
): number | null {
  if (latestBatch && latestBatch.stream === null) return null;
  return latestBatch?.stream?.lag ?? consumerLag;
}

/** 백프레셔 단계 — publisher별 중 가장 높은 단계(0이면 null) · null이 아니면 숫자 4가 "처리가 밀리는 중"(주황) */
export function maxBackpressure(bp: Record<string, number> | null): number | null {
  if (!bp) return null;
  const m = Math.max(0, ...Object.values(bp));
  return m > 0 ? m : null;
}
