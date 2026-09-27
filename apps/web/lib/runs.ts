// 라이브 실행 패널(EXP-PERF · EXP-FLOW) — 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙
// 표면 정본 docs/07_api/09_datagen.md §라이브 실행 제어 #2~#5 · §실행 객체 — 브라우저 → BFF(/bff/runs) → api · no-store.
// 경과 시간은 서버 elapsedMs 하나를 기준으로 두고 브라우저는 그 응답을 받은 뒤 흐른 단조 시계 길이만 더한다(startedAt을 빼지 않는다).
// 화면 조각은 components/runs/**가 그리고, 여기는 판정 · 문구 · 요청만 둔다(순수 함수 — 단위 테스트 대상).
import type { Query } from '@tanstack/react-query';
import { ApiError } from './api';
import {
  ErrorEnvelope,
  RUN_TERMINAL,
  RunCurrentBody,
  RunObject,
  type RunObjectBody,
  type RunStatus,
  type RunStepBody,
  type RunStepStatus,
  type RunType,
} from './shared';
import { formatKstIso } from './time';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** 폴링 주기 1초 — running · stopping 동안만(§갱신과 응답 처리 폴링 행) */
export const RUN_POLL_MS = 1_000;

/** 실행 쿼리 키 — 두 화면이 같은 키를 써서 한 화면에서 시작한 실행이 다른 화면으로 이어진다(08_screen/08 §EXP-FLOW 캐시 층) */
export const runKeys = {
  current: ['runs', 'current'] as const,
  one: (runId: string) => ['runs', runId] as const,
};

/** 화면 종류 → 화면 코드 · 경로(다른 실행 링크) */
export const RUN_SCREEN: Record<RunType, { code: string; href: string }> = {
  perf: { code: 'EXP-PERF', href: '/experiments/perf' },
  flow: { code: 'EXP-FLOW', href: '/experiments/flow' },
};

/** 라이브 표지 — 결과 표 머리 · 곡선 범례 · 완료 띠 옆(고정 문구) */
export const LIVE_MARK = '라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님';
export const NO_RUN_TEXT = '아직 실행하지 않았다(api를 재기동하면 지난 실행은 남지 않는다)';
export const VANISHED_TEXT = '실행 기록이 사라졌다 — api가 재기동됐다(실패로 기록하지 않는다)';
export const POLL_FAILED_TEXT = '상태를 읽지 못했다 — 다시 읽는 중';
export const ROLE_TEXT = '실행은 ENGINEER · ADMIN만';

/** 받은 응답 한 장 — 경과 틱의 기준(receivedAt은 브라우저 단조 시계 performance.now) */
export interface RunSnapshot {
  run: RunObjectBody | null;
  receivedAt: number;
}

export const monoNow = (): number => globalThis.performance?.now() ?? Date.now();

export const isActive = (s: RunStatus): boolean => s === 'running' || s === 'stopping';
export const isTerminal = (s: RunStatus): boolean => RUN_TERMINAL.has(s);

// ── 형식 ──

/**
 * 경과 시간 — 진행 중 1초 단위("42초" · "1분 42초" · "1시간 3분 12초") · 종결 0.1초 단위 버림("12.4초" · "3분 12.4초" · "1시간 3분 12.4초").
 * 길이라 시간대 변환이 없다(08_screen/01 §시각 표시 경과 시간 행).
 */
export function formatElapsed(ms: number, precise: boolean): string {
  const v = Math.max(0, ms);
  let h: number;
  let m: number;
  let sec: string;
  if (precise) {
    const tenths = Math.floor(v / 100);
    h = Math.floor(tenths / 36_000);
    m = Math.floor((tenths % 36_000) / 600);
    const t = tenths % 600;
    sec = `${Math.floor(t / 10)}.${t % 10}초`;
  } else {
    const s = Math.floor(v / 1000);
    h = Math.floor(s / 3600);
    m = Math.floor((s % 3600) / 60);
    sec = `${s % 60}초`;
  }
  if (h > 0) return `${h}시간 ${m}분 ${sec}`;
  if (m > 0) return `${m}분 ${sec}`;
  return sec;
}

/** 실행 패널 시각 — KST 초까지 "HH:MM:SS KST"(실험 화면 밀리초 규칙의 예외 — 08_screen/01 §시각 표시) */
export const formatRunClock = (iso: string): string => formatKstIso(iso).slice(11);

/** 종결 총 소요 = endedAt − startedAt(서버 elapsedMs와 같다) · endedAt이 없으면 서버 elapsedMs */
export function terminalElapsedMs(run: Pick<RunObjectBody, 'startedAt' | 'endedAt' | 'elapsedMs'>): number {
  if (!run.endedAt) return run.elapsedMs;
  const d = Date.parse(run.endedAt) - Date.parse(run.startedAt);
  return Number.isFinite(d) ? d : run.elapsedMs;
}

/** 진행 중 경과 = 마지막 응답의 elapsedMs + 그 응답 뒤 흐른 단조 시계 */
export const liveElapsedMs = (serverMs: number, receivedAt: number, now: number): number =>
  serverMs + Math.max(0, now - receivedAt);

/** 실행 경과 표시 — 진행 중이면 틱 · 종결이면 고정 */
export function runElapsedText(run: RunObjectBody, receivedAt: number, now: number): string {
  return isTerminal(run.status)
    ? formatElapsed(terminalElapsedMs(run), true)
    : formatElapsed(liveElapsedMs(run.elapsedMs, receivedAt, now), false);
}

/** 단계 소요 — 진행 중 단계만 틱 · 시작 전이면 null */
export function stepElapsedText(step: RunStepBody, receivedAt: number, now: number): string | null {
  if (step.elapsedMs === null) return null;
  if (step.status === 'running') return formatElapsed(liveElapsedMs(step.elapsedMs, receivedAt, now), false);
  return formatElapsed(step.elapsedMs, true);
}

// ── 상태 칩 · 종결 띠 ──

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: '실행 중',
  stopping: '중단 중',
  completed: '완료',
  stopped: '중단됨',
  failed: '실패',
};

export const STEP_ICON: Record<RunStepStatus, string> = {
  pending: '○',
  running: '◐',
  done: '✓',
  skipped: '–',
  stopped: '■',
  failed: '✕',
};

export type BandTone = 'success' | 'neutral' | 'danger' | 'info';

/** 종결 · 중단 중 띠(§상태 칩과 종결 표시) — running이면 없음 */
export function runBand(run: RunObjectBody): { tone: BandTone; text: string } | null {
  const took = formatElapsed(terminalElapsedMs(run), true);
  const end = run.endedAt ? ` · 종료 ${formatRunClock(run.endedAt)}` : '';
  switch (run.status) {
    case 'running':
      return null;
    case 'stopping':
      return { tone: 'info', text: '중단 중… — 진행 중 단계를 취소하고 정리 단계를 돈다' };
    case 'completed':
      return { tone: 'success', text: `완료 — 총 소요 ${took}${end}` };
    case 'stopped':
      return {
        tone: 'neutral',
        text: `중단됨 — 소요 ${took}${end}${run.error ? ` · 정리 실패 — ${run.error.message}` : ''}`,
      };
    case 'failed': {
      const msg = run.error?.message ?? '원인 기록 없음';
      const code = run.error?.code ? ` (${run.error.code})` : '';
      return { tone: 'danger', text: `실패 — ${msg}${code} · 소요 ${took}${end}` };
    }
  }
}

// ── 버튼 상태 ──

export interface ControlInput {
  /** 이 화면 종류 */
  type: RunType;
  /** current 응답 — 받기 전이면 undefined(시작을 켜지 않는다) */
  snapshot: RunSnapshot | undefined;
  /** 시작 요청이 응답을 기다리는 중 */
  starting: boolean;
  /** 중단을 눌렀고 응답 전 */
  stopRequested: boolean;
  /** S7 ② 뒤 ENGINEER · ADMIN — 인증 도입 전에는 true(무인증) */
  canControl: boolean;
}

export interface Controls {
  /** 매개변수 잠금 — current 전이거나 어떤 실행이든 진행 중 */
  paramsLocked: boolean;
  /** 잠금이 이 화면 종류의 진행 중 실행 때문이면 그 params */
  lockedParams: Record<string, number> | null;
  start: {
    enabled: boolean;
    label: string;
    note: string | null;
    other: { code: string; href: string } | null;
  };
  stop: { enabled: boolean; label: string };
}

/** 버튼 3 활성 조건(§버튼 상태) */
export function runControls(i: ControlInput): Controls {
  const ready = i.snapshot !== undefined;
  const run = i.snapshot?.run ?? null;
  const active = run !== null && isActive(run.status);
  const mine = run !== null && run.type === i.type;
  const otherActive = active && !mine && run !== null;
  let note: string | null = null;
  if (!i.canControl) note = ROLE_TEXT;
  else if (otherActive && run) note = `다른 실행 진행 중(${RUN_SCREEN[run.type].code}) — 그 화면으로`;
  const stopping = i.stopRequested || (mine && run?.status === 'stopping');
  return {
    paramsLocked: !ready || active || i.starting,
    lockedParams: active && mine && run ? run.params : null,
    start: {
      enabled: ready && !active && !i.starting && i.canControl,
      label: i.starting ? '시작 요청 중…' : '시작',
      note,
      other: otherActive && run ? RUN_SCREEN[run.type] : null,
    },
    stop: {
      enabled: mine && run?.status === 'running' && !i.stopRequested && i.canControl,
      label: stopping ? '중단 중…' : '중단',
    },
  };
}

/** 이 화면 패널이 보일 실행 — 다른 종류의 실행이면 "실행 없음"(빈 값 ④) */
export const panelRun = (snap: RunSnapshot | undefined, type: RunType): RunObjectBody | null =>
  snap?.run && snap.run.type === type ? snap.run : null;

// ── 폴링 ──

/**
 * refetchInterval — 진행 중이면 1초 · 종결 · 실행 없음이면 멈춘다 · 조회 실패면 1초 재시도(마지막 객체가 진행 중이거나 없을 때).
 * TanStack Query는 앞 요청이 진행 중이면 새 요청을 보내지 않는다(같은 쿼리 fetch 중복 제거) — 응답 전 다음 요청 없음.
 */
export function runPollInterval(data: RunSnapshot | undefined, errored: boolean): number | false {
  const run = data?.run ?? null;
  if (errored) return run === null || isActive(run.status) ? RUN_POLL_MS : false;
  return run !== null && isActive(run.status) ? RUN_POLL_MS : false;
}

// ── 요청 ──

async function errorOf(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // 봉투가 아닌 본문 — 상태만 남긴다
  }
  const env = ErrorEnvelope.safeParse(body);
  if (env.success)
    return new ApiError(
      res.status,
      env.data.error.code ?? null,
      env.data.error.message,
      env.data.error.details ?? null,
    );
  return new ApiError(res.status, null, `HTTP ${res.status}`);
}

async function call(f: Fetch, url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await f(url, { cache: 'no-store', ...init });
  } catch {
    throw new ApiError(0, null, 'api에 닿지 못했다');
  }
  if (!res.ok) throw await errorOf(res);
  return { status: res.status, body: await res.json() };
}

function parseRun(body: unknown): RunObjectBody {
  const r = RunObject.safeParse(body);
  if (!r.success) throw new ApiError(200, null, '실행 객체 형식이 계약과 다르다');
  return r.data;
}

/** #3 current — 받은 순간의 단조 시계를 함께 남긴다 */
export async function fetchCurrentRun(f: Fetch = fetch): Promise<RunSnapshot> {
  const { body } = await call(f, '/bff/runs/current');
  const r = RunCurrentBody.safeParse(body);
  if (!r.success) throw new ApiError(200, null, '실행 객체 형식이 계약과 다르다');
  return { run: r.data.run, receivedAt: monoNow() };
}

/** #4 단건 */
export async function fetchRun(runId: string, f: Fetch = fetch): Promise<RunObjectBody> {
  return parseRun((await call(f, `/bff/runs/${encodeURIComponent(runId)}`)).body);
}

export function currentRunQueryOptions(f: Fetch = fetch) {
  return {
    queryKey: runKeys.current,
    queryFn: () => fetchCurrentRun(f),
    staleTime: 0,
    retry: false,
    refetchInterval: (q: Query<RunSnapshot, ApiError, RunSnapshot, typeof runKeys.current>) =>
      runPollInterval(q.state.data, q.state.status === 'error'),
  };
}

/**
 * 읽기 전용 구독 — 같은 키의 캐시만 읽고 폴링 · 재조회를 걸지 않는다(라이브 계열 · 흐름도 머리).
 * 관찰자마다 간격 타이머가 따로 돌아 탭 하나의 요청이 초당 둘이 되지 않게 1초 폴링은 실행 패널 하나만 건다.
 */
export function currentRunReadOptions(f: Fetch = fetch) {
  return {
    ...currentRunQueryOptions(f),
    refetchInterval: false as const,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}

export type StartOutcome =
  | { kind: 'started'; run: RunObjectBody }
  /** 409 — 단건 조회 1회로 맞춘 실행(404면 null → current 재조회) */
  | { kind: 'conflict'; type: RunType | null; run: RunObjectBody | null }
  /** 400 — 화면과 서버의 화이트리스트가 어긋났다 */
  | { kind: 'invalid'; error: ApiError }
  /** 네트워크 · 5xx · 403 · 429 — 버튼을 되돌리고 current 1회 재조회 */
  | { kind: 'failed'; error: ApiError };

/** #2 시작 — 409면 details.runId로 #4 한 번(다음 폴링을 기다리지 않고 패널을 맞춘다) */
export async function requestStart(
  type: RunType,
  params: Record<string, number>,
  f: Fetch = fetch,
): Promise<StartOutcome> {
  try {
    const { body } = await call(f, '/bff/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, params }),
    });
    return { kind: 'started', run: parseRun(body) };
  } catch (e) {
    const error = e instanceof ApiError ? e : new ApiError(0, null, String(e));
    if (error.status === 409 && error.code === 'datagen.run_in_progress') {
      const runId = typeof error.details?.runId === 'string' ? error.details.runId : null;
      const t = error.details?.type;
      const otherType = t === 'perf' || t === 'flow' ? t : null;
      let run: RunObjectBody | null = null;
      if (runId) {
        try {
          run = await fetchRun(runId, f);
        } catch {
          // 404(사라짐) · 조회 실패 — current 재조회가 맞춘다
        }
      }
      return { kind: 'conflict', type: run?.type ?? otherType, run };
    }
    if (error.status === 400) return { kind: 'invalid', error };
    return { kind: 'failed', error };
  }
}

export type StopOutcome =
  /** 202(stopping · cleanup 중이면 그대로) · 200(이미 종결 — 멱등) */
  | { kind: 'stopped'; run: RunObjectBody }
  /** 404 — api 재기동으로 사라졌다 */
  | { kind: 'gone' }
  | { kind: 'failed'; error: ApiError };

/** #5 중단 */
export async function requestStop(runId: string, f: Fetch = fetch): Promise<StopOutcome> {
  try {
    const { body } = await call(f, `/bff/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST' });
    return { kind: 'stopped', run: parseRun(body) };
  } catch (e) {
    const error = e instanceof ApiError ? e : new ApiError(0, null, String(e));
    if (error.status === 404) return { kind: 'gone' };
    return { kind: 'failed', error };
  }
}

// ── 패널 지역 상태(요청 중 표지 · 띠) ──

export interface PanelNotice {
  tone: BandTone;
  text: string;
}

export interface PanelLocal {
  starting: boolean;
  stopRequested: boolean;
  /** 패널 띠 — 409 · 404 · 요청 실패 */
  notice: PanelNotice | null;
  /** 매개변수 옆 문구 — 400 */
  paramError: string | null;
}

export const PANEL_IDLE: PanelLocal = {
  starting: false,
  stopRequested: false,
  notice: null,
  paramError: null,
};

export type PanelAction =
  | { kind: 'start-request' }
  | { kind: 'start-done'; outcome: StartOutcome }
  | { kind: 'stop-request' }
  | { kind: 'stop-done'; outcome: StopOutcome }
  | { kind: 'vanished' };

const failText = (e: ApiError): string =>
  e.status === 403 || e.code === 'auth.forbidden' ? ROLE_TEXT : '요청 실패 — 다시 누른다';

/** 사건 → 지역 상태(§갱신과 응답 처리 사건 9 가운데 요청 쪽) — 캐시 반영은 훅이 한다 */
export function panelReducer(s: PanelLocal, a: PanelAction): PanelLocal {
  switch (a.kind) {
    case 'start-request':
      // 시작하면 앞 실행의 띠를 지운다
      return { ...s, starting: true, notice: null, paramError: null };
    case 'start-done': {
      const o = a.outcome;
      const base = { ...s, starting: false };
      if (o.kind === 'started') return { ...base, notice: null };
      if (o.kind === 'conflict')
        return {
          ...base,
          notice: {
            tone: 'info',
            text: `다른 실행이 먼저 시작됐다 — ${o.type ?? '종류 미상'}`,
          },
        };
      if (o.kind === 'invalid')
        return {
          ...base,
          paramError: `매개변수가 서버 허용값과 다르다 — 화면과 서버의 목록이 어긋났다 (${o.error.code ?? o.error.status})`,
        };
      return { ...base, notice: { tone: 'danger', text: failText(o.error) } };
    }
    case 'stop-request':
      return { ...s, stopRequested: true, notice: null };
    case 'stop-done': {
      const o = a.outcome;
      const base = { ...s, stopRequested: false };
      if (o.kind === 'stopped') return base;
      if (o.kind === 'gone') return { ...base, notice: { tone: 'neutral', text: VANISHED_TEXT } };
      return { ...base, notice: { tone: 'danger', text: failText(o.error) } };
    }
    case 'vanished':
      return { ...s, notice: { tone: 'neutral', text: VANISHED_TEXT } };
  }
}

/** 진행 중이던 실행이 current null로 바뀌었다 — api 재기동(404 행과 같은 "기록 없음") */
export const vanished = (prev: RunSnapshot | undefined, next: RunSnapshot | undefined): boolean =>
  !!prev?.run && isActive(prev.run.status) && next !== undefined && next.run === null;

// ── 단계 detail 한 줄 ──

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: number) => v.toLocaleString('ko-KR');

/** 바이트 — 1000 단위(B · KB · MB · GB) */
export function formatBytes(b: number): string {
  if (b < 1000) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = b;
  let u = -1;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`;
}

/** 단계 detail 요약 — key로 분기(label은 표시만 · 07_api/09 §steps[] 항목) */
export function stepDetailText(step: RunStepBody): string {
  const d = step.detail;
  const k = step.key;
  if (Object.keys(d).length === 0) return '';
  if (k.startsWith('fill-')) {
    const parts: string[] = [];
    if (n(d.rows) !== null) parts.push(`행 +${int(n(d.rows) as number)}`);
    if (n(d.ms) !== null) parts.push(`${int(n(d.ms) as number)} ms`);
    if (n(d.storageBytes) !== null) parts.push(`누적 ${formatBytes(n(d.storageBytes) as number)}`);
    return parts.join(' · ');
  }
  if (k.startsWith('query@')) return `쿼리 ${n(d.done) ?? '—'}/${n(d.total) ?? '—'}`;
  if (k === 'publish') {
    const parts = [
      `포인트 ${int(n(d.pointsSent) ?? 0)}`,
      `엔트리 ${int(n(d.entriesSent) ?? 0)}`,
      `명령 ${int(n(d.commandsSent) ?? 0)}`,
      `백프레셔 정지 ${int(n(d.backpressurePauses) ?? 0)}`,
    ];
    return parts.join(' · ');
  }
  if (k === 'drain') {
    const ms = n(d.drainMs);
    const head = ms === null ? '' : `드레인 ${int(ms)} ms`;
    return d.timedOut === true ? `${head}${head ? ' · ' : ''}상한 30초 도달 — 적체가 남았다` : head;
  }
  if (k === 'prepare' && n(d.devices) !== null)
    return `설비 ${int(n(d.devices) as number)} · 태그 ${int(n(d.tags) ?? 0)}`;
  if (n(d.objects) !== null) return `객체 ${n(d.objects)}`;
  return Object.entries(d)
    .map(([key, v]) => `${key} ${typeof v === 'number' ? int(v) : String(v)}`)
    .join(' · ');
}

// ── flow 진행 막대 ──

export interface FlowProgress {
  /** 0~1 — publish 경과 ÷ durationSec(넘으면 1) */
  ratio: number;
  elapsedSec: number;
  durationSec: number;
  draining: boolean;
  pointsSent: number;
  entriesSent: number;
  commandsSent: number;
  backpressurePauses: number;
}

/** publish 단계의 경과(진행 중이면 틱) ÷ durationSec · 드레인 중이면 막대를 채운다 */
export function flowProgress(run: RunObjectBody, receivedAt: number, now: number): FlowProgress | null {
  const publish = run.steps.find((s) => s.key === 'publish');
  const drain = run.steps.find((s) => s.key === 'drain');
  const durationSec = run.params.durationSec ?? 0;
  if (!publish || durationSec <= 0) return null;
  const ms =
    publish.elapsedMs === null
      ? 0
      : publish.status === 'running' && !isTerminal(run.status)
        ? liveElapsedMs(publish.elapsedMs, receivedAt, now)
        : publish.elapsedMs;
  const draining = drain?.status === 'running';
  const d = publish.detail;
  return {
    ratio: draining ? 1 : Math.min(1, Math.max(0, ms / (durationSec * 1000))),
    elapsedSec: Math.min(Math.floor(ms / 1000), durationSec),
    durationSec,
    draining,
    pointsSent: n(d.pointsSent) ?? 0,
    entriesSent: n(d.entriesSent) ?? 0,
    commandsSent: n(d.commandsSent) ?? 0,
    backpressurePauses: n(d.backpressurePauses) ?? 0,
  };
}

// ── perf 라이브 계열 · 대용량 경고 ──

export interface LivePoint {
  rows: number;
  exponent: number;
  median: number;
  values: number[];
  /** 결과 행 수 — 두 저장소 비교 */
  resultRows: number | null;
  resultMatch: boolean | null;
}

type PerfScales = { scales: { exponent: number; rows: number; queries: PerfQueryCell[] }[] };
type PerfQueryCell = {
  q: string;
  ch: { values: number[]; median: number | null; rows: number | null };
  pg: { values: number[]; median: number | null; rows: number | null };
  resultMatch: boolean | null;
};

/** perf result인가 — flow 결과와 모양으로 가른다 */
export const isPerfResult = (r: RunObjectBody['result']): r is RunObjectBody['result'] & PerfScales =>
  !!r && 'scales' in r;

/** 라이브 계열 2(CH · PG I2) — 툴바 쿼리의 규모별 중앙값 · 실행이 채운 규모만 */
export function liveSeries(run: RunObjectBody | null, query: string): { ch: LivePoint[]; pg: LivePoint[] } {
  const out = { ch: [] as LivePoint[], pg: [] as LivePoint[] };
  if (run?.type !== 'perf' || !isPerfResult(run.result)) return out;
  for (const s of [...run.result.scales].sort((a, b) => a.exponent - b.exponent)) {
    const c = s.queries.find((x) => x.q === query);
    if (!c) continue;
    const rows = s.rows > 0 ? s.rows : 10 ** s.exponent;
    for (const side of ['ch', 'pg'] as const) {
      const m = c[side].median;
      if (m === null) continue;
      out[side].push({
        rows,
        exponent: s.exponent,
        median: m,
        values: c[side].values,
        resultRows: c[side].rows,
        resultMatch: c.resultMatch,
      });
    }
  }
  return out;
}

/**
 * 예상 디스크 행당 바이트(추정 상한) — 05_data_stores/10 §결과 비교 축 6 결정적 값의 상한값(현행 참고)
 * PostgreSQL 힙 76.6 B + btree I2 31.6 B · ClickHouse 5.4 B(관측 4.40~5.37 B의 위쪽). 41 B와 같은 변경 단위에서 따라간다.
 */
export const LIVE_ROW_BYTES_UPPER = { pgHeap: 76.6, pgBtree: 31.6, ch: 5.4 } as const;
/** 경고를 보이는 최대 규모 지수 — 10^7 이하는 경고 없음 */
export const LARGE_EXPONENT = 8;

export function expectedDisk(maxExponent: number): { pg: number; ch: number } | null {
  if (maxExponent < LARGE_EXPONENT) return null;
  const rows = 10 ** maxExponent;
  return {
    pg: rows * (LIVE_ROW_BYTES_UPPER.pgHeap + LIVE_ROW_BYTES_UPPER.pgBtree),
    ch: rows * LIVE_ROW_BYTES_UPPER.ch,
  };
}

export function largeRunWarning(maxExponent: number): string | null {
  const d = expectedDisk(maxExponent);
  if (!d) return null;
  return `예상 디스크(추정 상한) PostgreSQL ${formatBytes(d.pg)}(힙 + btree) · ClickHouse ${formatBytes(d.ch)} — 수 분 이상 걸린다`;
}
