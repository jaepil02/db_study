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
/** 요약 없음 — 구독 중인데 이 동안 flow 프레임이 없으면 띠 */
export const FLOW_NO_SUMMARY_MS = 10_000;
/** 저장소 누적 메트릭 폴링 5초(리드 판정 2 — EXP-CONSOLE 15초와 다르다) */
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

/** 배치 단계 6 — ⑧ 순서 그대로(스트림 대기 → 디코드 → CH 삽입 → PG COPY → 최신값 → 알람) · XACK는 ms가 없어 막대에 자리가 없다 */
export const BATCH_STAGES: readonly { key: BatchStageKey; label: string }[] = [
  { key: 'streamWaitMs', label: '스트림 대기' },
  { key: 'decodeMs', label: '디코드' },
  { key: 'chInsertMs', label: 'CH 삽입' },
  { key: 'controlCopyMs', label: 'PG COPY' },
  { key: 'latestWriteMs', label: '최신값' },
  { key: 'alarmMs', label: '알람' },
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

/** 머리 표기 — "×N 느리게"(배율 1이면 "실시간 속도") */
export function formatScale(scale: number): string {
  if (scale <= 1) return '실시간 속도';
  return `×${scale >= 10 ? Math.round(scale).toLocaleString('ko-KR') : scale.toFixed(1)} 느리게`;
}

function sumStages(stages: Record<string, number | null>): number {
  let t = 0;
  for (const v of Object.values(stages)) if (v !== null) t += v;
  return t;
}

// ── 점 계획 — 노드 사이 다리(leg)마다 배율을 곱한 ms ──

export type BatchNode = 'src' | 'stream' | 'worker' | 'ch' | 'pgCopy' | 'xack' | 'latest' | 'alarm';
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

/**
 * 배치 점 — 스트림 대기 → 디코드 → CH 삽입 → PG COPY → XACK → 최신값 → 알람 판정(⑧ 순서) · null 단계는 건너뛴다.
 * 스트림 대기는 발생원 → Stream → 워커 두 다리에 반씩 나눈다(단계 합은 그대로).
 */
export function batchPlan(b: FlowBatchSummaryBody): DotPlan<BatchNode> {
  const s = b.stages;
  const legs: Leg<BatchNode>[] = [];
  if (s.streamWaitMs !== null) {
    legs.push({ to: 'stream', ms: s.streamWaitMs / 2, stage: 'streamWaitMs' });
    legs.push({ to: 'worker', ms: s.streamWaitMs / 2, stage: 'streamWaitMs' });
  } else {
    legs.push({ to: 'worker', ms: 0, stage: null });
  }
  if (s.decodeMs !== null) legs.push({ to: 'worker', ms: s.decodeMs, stage: 'decodeMs' });
  if (s.chInsertMs !== null) legs.push({ to: 'ch', ms: s.chInsertMs, stage: 'chInsertMs' });
  if (s.controlCopyMs !== null) legs.push({ to: 'pgCopy', ms: s.controlCopyMs, stage: 'controlCopyMs' });
  legs.push({ to: 'xack', ms: 0, stage: null });
  if (s.latestWriteMs !== null) legs.push({ to: 'latest', ms: s.latestWriteMs, stage: 'latestWriteMs' });
  if (s.alarmMs !== null) legs.push({ to: 'alarm', ms: s.alarmMs, stage: 'alarmMs' });
  return finish('src', legs, sumStages(s));
}

export interface BizMark {
  symbol: string;
  /** 표지가 붙는 노드 — 점이 여기에 닿은 뒤부터 보인다 */
  at: BizNode;
  /** 오류 코드(✕ · ⚠) — 그 밖은 null */
  code: string | null;
}

/**
 * 업무 점 — api → stream:biz:cmd → 워커 → PG 트랜잭션 → cache DEL · ch:cacheinv → biz:result · ch:bizreply → api 응답.
 * duplicate · expired는 트랜잭션을 건너뛰고(↺ · ⌛), rejected는 트랜잭션 노드에서 ✕, failed는 같은 노드에서 ⚠(txMs null이어도 들른다).
 * role api-direct(SW-12 direct)는 스트림 · 워커 · 결과 노드를 건너뛰고 api에서 곧바로 트랜잭션으로 간다.
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
    legs.push({ to: 'pgTx', ms: s.txMs ?? 0, stage: s.txMs === null ? null : 'txMs' });
    if (outcome === 'rejected' || outcome === 'failed') {
      mark = { symbol: OUTCOME_MARK[outcome], at: 'pgTx', code: b.result };
    }
  }
  if (s.invalidateMs !== null) legs.push({ to: 'cache', ms: s.invalidateMs, stage: 'invalidateMs' });
  if (!direct && s.replyMs !== null) {
    legs.push({ to: 'result', ms: s.replyMs / 2, stage: 'replyMs' });
    legs.push({ to: 'api', ms: s.replyMs / 2, stage: 'replyMs' });
  } else {
    if (!direct) legs.push({ to: 'result', ms: 0, stage: null });
    legs.push({ to: 'api', ms: 0, stage: null });
  }
  return { ...finish<BizNode>('api', legs, sumStages(s)), mark };
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
  return 3 + 1.5 * Math.log10(Math.max(rows, 1));
}

/** 간선 굵기 — 로그 · 0이면 기본 1 */
export function edgeWidth(perSec: number | null): number {
  if (perSec === null || perSec <= 0) return 1;
  return Math.min(1 + 1.6 * Math.log10(1 + perSec), 12);
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

function applyTotals(
  tracks: Record<string, TotalsTrack>,
  entries: readonly FlowTotalsEntryBody[],
  at: number,
): Record<string, TotalsTrack> {
  if (entries.length === 0) return tracks;
  const next = { ...tracks };
  for (const e of entries) {
    const key = totalsKey(e);
    const values = counters(e);
    const prev = next[key];
    const sample = { at, values };
    if (!prev) {
      next[key] = { source: e.source, role: e.role, startedAt: e.startedAt, samples: [sample], restarts: 0 };
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
      totals: applyTotals(state.totals, f.totals, f.windowEnd),
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

/**
 * 한 (source · role) 누적의 최근 10초 초당 값 — 값(지금) − 값(지금 − 10초)을 경과 초로 나눈다.
 * 값(t)는 t 이전 마지막 샘플이고, 창 시작보다 오래된 샘플이 없으면 첫 샘플부터 잰다.
 * 샘플이 둘 미만(구독 직후 · 재기동 직후)이면 null — 재기동 한 창 건너뛰기.
 */
export function trackRate(track: TotalsTrack, field: string, now: number): number | null {
  const s = track.samples;
  const last = s[s.length - 1];
  if (s.length < 2 || last === undefined) return null;
  const from = now - FLOW_RATE_WINDOW_MS;
  let base = s[0] as TotalsSample;
  for (const x of s) if (x.at <= from) base = x;
  const end = Math.max(now, last.at);
  const start = Math.max(base.at, from);
  const sec = (end - start) / 1000;
  const lv = last.values[field];
  const bv = base.values[field];
  if (sec <= 0 || lv === undefined || bv === undefined || lv < bv) return null;
  return (lv - bv) / sec;
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
  judgedRows: number | null;
  transitions: number | null;
  commands: number | null;
  commandsWriter: number | null;
  commandsDirect: number | null;
}

export function flowRates(tracks: Record<string, TotalsTrack>, now: number): FlowRates {
  const ing = (f: string) => roleRate(tracks, ['ingest'], f, now);
  const opened = ing('opened');
  const closed = ing('closed');
  return {
    batches: ing('batches'),
    rows: ing('rows'),
    chRows: ing('chRows'),
    controlCopyRows: ing('controlCopyRows'),
    latestWrites: ing('latestWrites'),
    judgedRows: ing('judgedRows'),
    transitions: opened === null && closed === null ? null : (opened ?? 0) + (closed ?? 0),
    commands: roleRate(tracks, ['biz-writer', 'api-direct'], 'commands', now),
    commandsWriter: roleRate(tracks, ['biz-writer'], 'commands', now),
    commandsDirect: roleRate(tracks, ['api-direct'], 'commands', now),
  };
}

/** 구독 표지 3상태 — 셸 WS 3상태를 따른다 */
export type FlowSubStatus = 'subscribed' | 'requesting' | 'disconnected';

export function flowSubStatus(
  conn: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed',
  flow: 'off' | 'requesting' | 'subscribed',
): FlowSubStatus {
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
    /** gen_points_generated_total{mode}(누적) — run(라이브 flow 실행)을 모드 B와 따로 */
    genByMode: Record<string, number> | null;
    /** redis_stream_entries_added_total{stream}(누적) */
    streamAdded: Record<string, number> | null;
  };
  clickhouse: {
    tables: Record<string, FlowChTable>;
    insertedRowsTotal: number | null;
    rowsInserted: number | null;
    alarmEvalRowsInserted: number | null;
  };
  postgres: {
    tables: Record<string, FlowPgTable>;
    walBytesTotal: number | null;
    xactCommitTotal: number | null;
    activeAlarms: Record<string, number> | null;
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
  const activeAlarms: Record<string, number> = {};
  const prefixMemory: Record<string, number> = {};
  const streamLength: Record<string, number> = {};
  const backpressure: Record<string, number> = {};
  const latestUpdates: Record<string, number> = {};
  const bizCommands: Record<string, number> = {};
  const m: FlowMetrics = {
    source: { pointsEmitted: null, genByMode: null, streamAdded: null },
    clickhouse: {
      tables: chTables,
      insertedRowsTotal: null,
      rowsInserted: null,
      alarmEvalRowsInserted: null,
    },
    postgres: { tables: pgTables, walBytesTotal: null, xactCommitTotal: null, activeAlarms: null },
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
      case 'alm_eval_rows_inserted_total':
        m.clickhouse.alarmEvalRowsInserted = plus(m.clickhouse.alarmEvalRowsInserted, v);
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
      case 'alm_active_alarms':
        add(activeAlarms, l.severity, v);
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
  m.postgres.activeAlarms = orNull(activeAlarms);
  m.redis.prefixMemory = orNull(prefixMemory);
  m.redis.streamLength = orNull(streamLength);
  m.redis.backpressure = orNull(backpressure);
  m.redis.latestUpdates = orNull(latestUpdates);
  m.redis.bizCommands = orNull(bizCommands);
  return m;
}

/** 행당 바이트 — 분모는 테이블 전체 행 수 계열(누적 삽입 수 아님) · 분모 0 · 수집 없음이면 null("행 수 계측 없음") */
export function perRowBytes(bytes: number | null, rows: number | null): number | null {
  if (bytes === null || rows === null || rows <= 0) return null;
  return bytes / rows;
}

/** 압축률 — 비압축 ÷ 디스크 */
export function compressionRatio(t: FlowChTable): number | null {
  if (t.bytesOnDisk === null || t.uncompressedBytes === null || t.bytesOnDisk <= 0) return null;
  return t.uncompressedBytes / t.bytesOnDisk;
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
  };
}

/** 발생원 초당 포인트 합(Collector + 생성기 전 모드) — 요약 없음 띠 · 발생원 간선 라벨 */
export function sourcePps(r: FlowMetricRates | null): number | null {
  if (!r) return null;
  const vals = [r.collectorPps, ...Object.values(r.genPpsByMode)].filter((v): v is number => v !== null);
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

// ── 비활성 간선 · 스위치 표지(표시 계약 비활성 간선 · SW-12 direct · §스위치 영향) ──

export interface FlowSwitchFlags {
  controlCopyOff: boolean;
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
 * stream null → SW-01 대안 · 업무는 마지막 요약의 role. 요약이 없을 때만 health 스위치(셸 배지의 것)로 그린다.
 */
export function flowSwitchFlags(
  latestBatch: FlowBatchSummaryBody | null,
  lastBiz: FlowBizSummaryBody | null,
  switches: Record<string, SwitchStateBody> | null,
): FlowSwitchFlags {
  return {
    controlCopyOff: latestBatch ? latestBatch.controlCopy === null : !isAlt(switches, 'SW-09'),
    collectorLatest: latestBatch ? latestBatch.latestWrites === null : isAlt(switches, 'SW-11'),
    streamOff: latestBatch ? latestBatch.stream === null : isAlt(switches, 'SW-01'),
    directGateway: isAlt(switches, 'SW-06'),
    deadband: isAlt(switches, 'SW-10'),
    bizDirect: lastBiz ? isDirect(lastBiz) : isAlt(switches, 'SW-12'),
  };
}
