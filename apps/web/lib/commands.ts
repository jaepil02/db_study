// 업무 쓰기 — 명령 경로 응답 처리. 정본 docs/08_screen/01_standards.md §업무 쓰기 응답 — 명령 경로
// 표면 의미(202 · Idempotency-Key · 명령 조회) 정본 docs/07_api/01_conventions.md §업무 쓰기 경로 · §명령 조회 표면
// 폼 제출 단위로 UUID 키를 만들어 결말(applied · rejected · expired)까지 같은 키를 쓴다 · 202 pending이면 명령 조회를 백오프로 부른다.
// SW-12 direct에서는 202가 오지 않을 뿐 같은 코드로 받는다(키는 형식 검사만 되고 되싣지 않는다).
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { ApiError } from './api';
import { errorText, writeErrorText } from './error-display';
import {
  BIZ_RESULT_TTL_S,
  CommandAccepted,
  CommandStatusBody,
  type CommandStatusBodyT,
  ErrorEnvelope,
  IDEMPOTENCY_HEADER,
} from './shared';

/** 쓰기 요청 한 건 — url은 BFF 경로(/bff/master/… · /bff/alarms/…) */
export interface WriteRequest {
  method: 'POST' | 'PATCH' | 'PUT';
  url: string;
  /** 없으면 본문 없이 보낸다(알람 확인) */
  body?: unknown;
}

/** 쓰기 한 건의 결말 */
export type WriteOutcome =
  /** 적용됐다 — viaCommand면 202 뒤 명령 조회로 확인했다(BFF ⑤가 걸리지 않았다 → 신선 창 재조회) */
  | { kind: 'applied'; status: number; body: unknown; viaCommand: boolean }
  /** 도메인 거절 · 형식 오류 등 — 기존 오류 표시(§에러 코드별 사용자 표시) */
  | { kind: 'rejected'; error: ApiError }
  /** 적용되지 않았거나 확정 못 함(503 · failed · 네트워크 · 429) — 같은 키로 다시 보낸다 */
  | { kind: 'retryable'; error: ApiError }
  /** 명령 유효 창 초과로 적용하지 않았다 — 다시 보낼지는 사용자가 정하고 보내면 새 키 */
  | { kind: 'expired'; cmdId: string }
  /** 유효 창을 넘도록 pending — 같은 키로 원 요청을 다시 보낸다 */
  | { kind: 'stale'; cmdId: string }
  /** 명령 조회 404 — 행위자가 다른 명령 */
  | { kind: 'unseen'; cmdId: string }
  /** 화면을 떠나 폴링을 멈췄다 */
  | { kind: 'aborted' };

/** 명령 유효 창(현행 참고 300초 · 소유 06_pipeline/07) — 이만큼 pending이면 "오래 대기" */
export const COMMAND_VALID_MS = BIZ_RESULT_TTL_S * 1000;
/** 명령 조회 백오프 — 1 · 2 · 4초 … 최대 30초(08_screen/01) */
export const POLL_MAX_DELAY_MS = 30_000;
export const pollDelayMs = (attempt: number): number => Math.min(1000 * 2 ** attempt, POLL_MAX_DELAY_MS);

export const commandKeys = { one: (cmdId: string) => ['command', cmdId] as const };

// ── 키 ──

/** 폼 제출 단위 명령 ID(UUID v4) */
export function newCommandKey(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface HeldKey {
  key: string;
  /** 요청 지문 — 입력을 고쳐 다시 저장하면 지문이 바뀌어 새 키 */
  fingerprint: string;
}

export const fingerprintOf = (r: WriteRequest): string =>
  `${r.method} ${r.url} ${r.body === undefined ? '' : JSON.stringify(r.body)}`;

/** 보낼 키 — 결말 전(재시도 · 오래 대기 재전송)의 같은 요청은 같은 키 · 다른 요청은 새 키 */
export function keyFor(held: HeldKey | null, req: WriteRequest, mint: () => string = newCommandKey): HeldKey {
  const fingerprint = fingerprintOf(req);
  return held && held.fingerprint === fingerprint ? held : { key: mint(), fingerprint };
}

/** 결말 뒤 키 — applied · rejected · expired · unseen이면 버린다(다음 제출은 새 키) · 재시도 대상이면 쥔다 */
export function keyAfter(held: HeldKey | null, o: WriteOutcome): HeldKey | null {
  return o.kind === 'retryable' || o.kind === 'stale' || o.kind === 'aborted' ? held : null;
}

// ── 전송 · 조회 ──

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

async function apiErrorOf(res: Response): Promise<ApiError> {
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

export type SendResult =
  | { kind: 'done'; status: number; body: unknown }
  | { kind: 'accepted'; cmdId: string; status: 'pending' | 'expired' };

/** 쓰기 한 번 — 요청 헤더에 Idempotency-Key를 싣는다. 202는 성공이 아니라 accepted로 돌려준다 · 그 밖 비 2xx는 ApiError로 던진다 */
export async function sendBizWrite(
  req: WriteRequest,
  key: string,
  f: Fetch = fetch,
  signal?: AbortSignal,
): Promise<SendResult> {
  const headers: Record<string, string> = { [IDEMPOTENCY_HEADER]: key };
  if (req.body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await f(req.url, {
      method: req.method,
      cache: 'no-store',
      headers,
      ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError(0, null, 'api에 닿지 못했다');
  }
  if (!res.ok) throw await apiErrorOf(res);
  // 본문 해석 실패(JSON · 모양)는 응답을 못 받은 것과 같다 — 같은 키로 다시 보내면 첫 판정을 받는다
  try {
    if (res.status === 202) {
      const a = CommandAccepted.parse(await res.json());
      return { kind: 'accepted', cmdId: a.cmdId, status: a.status };
    }
    const text = await res.text();
    return { kind: 'done', status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    throw new ApiError(0, null, '쓰기 응답을 해석하지 못했다');
  }
}

/** 명령 조회 — BFF 경유 no-store(07_api/01 명령 조회 표면 #1) */
export async function fetchCommandStatus(
  cmdId: string,
  f: Fetch = fetch,
  signal?: AbortSignal,
): Promise<CommandStatusBodyT> {
  let res: Response;
  try {
    res = await f(`/bff/commands/${encodeURIComponent(cmdId)}`, {
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError(0, null, 'api에 닿지 못했다');
  }
  if (!res.ok) throw await apiErrorOf(res);
  // 해석 실패(JSON · Zod)는 결말이 아니다 — 닿지 못한 조회와 같이 다음 주기에 다시 묻는다
  try {
    return CommandStatusBody.parse(await res.json());
  } catch {
    throw new ApiError(0, null, '명령 조회 응답을 해석하지 못했다');
  }
}

/** 명령 조회 결과 → 결말(pending이면 null) */
export function outcomeOfStatus(s: CommandStatusBodyT): WriteOutcome | null {
  switch (s.status) {
    case 'pending':
      return null;
    case 'applied':
      return { kind: 'applied', status: s.httpStatus ?? 200, body: s.result ?? null, viaCommand: true };
    case 'rejected':
      return {
        kind: 'rejected',
        error: new ApiError(
          s.httpStatus ?? 409,
          s.error?.code ?? null,
          s.error?.message ?? '거절됐다',
          s.error?.details ?? null,
        ),
      };
    // 적용 여부를 확정하지 못했다 — 업무 쓰기 503과 같은 처리(같은 키로 다시 보내 확정)
    case 'failed':
      return {
        kind: 'retryable',
        error: new ApiError(
          s.httpStatus ?? 503,
          s.error?.code ?? 'common.postgres_unavailable',
          s.error?.message ?? '업무 저장소 응답 불가',
          s.error?.details ?? null,
        ),
      };
    case 'expired':
      return { kind: 'expired', cmdId: s.cmdId };
  }
}

/** 적용되지 않았으므로 같은 키로 다시 보내도 이중 쓰기가 아닌 실패 — 네트워크 · BFF 닿지 못함 · 한도 · 503 */
export const isRetryableStatus = (status: number): boolean =>
  status === 0 || status === 429 || status === 502 || status === 503;

export interface WriteDeps {
  fetch?: Fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  signal?: AbortSignal;
  /** 202 pending을 받은 순간 — 화면이 폼을 "적용 대기"로 바꾼다 */
  onAccepted?: (cmdId: string) => void;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

/** 202 pending 뒤 — 명령 조회를 백오프로 부르고 결말을 돌려준다. 유효 창을 넘도록 pending이면 stale */
export async function waitForCommand(
  cmdId: string,
  acceptedAt: number,
  deps: WriteDeps = {},
): Promise<WriteOutcome> {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  for (let attempt = 0; ; attempt++) {
    if (now() - acceptedAt >= COMMAND_VALID_MS) return { kind: 'stale', cmdId };
    await sleep(pollDelayMs(attempt), deps.signal);
    if (deps.signal?.aborted) return { kind: 'aborted' };
    try {
      const o = outcomeOfStatus(await fetchCommandStatus(cmdId, deps.fetch, deps.signal));
      if (deps.signal?.aborted) return { kind: 'aborted' };
      if (o) return o;
    } catch (e) {
      if (deps.signal?.aborted) return { kind: 'aborted' };
      const error = e instanceof ApiError ? e : new ApiError(0, null, String(e));
      if (error.status === 404) return { kind: 'unseen', cmdId };
      // 404 밖 4xx(400 — cmdId 형식 등)는 다시 물어도 같다 — 결말(오류 표시 · 키 버림)
      if (error.status >= 400 && error.status < 500 && !isRetryableStatus(error.status))
        return { kind: 'rejected', error };
      // 조회 503 · 네트워크 · 해석 실패는 결말이 아니다 — 다음 주기에 다시 묻는다(유효 창을 넘으면 stale)
    }
  }
}

/** 쓰기 한 건을 결말까지 — 202가 없으면(대기 상한 안 결과 · SW-12 direct) 옛 경로와 같다 */
export async function runBizWrite(
  req: WriteRequest,
  key: string,
  deps: WriteDeps = {},
): Promise<WriteOutcome> {
  const now = deps.now ?? Date.now;
  const first = await sendStep(req, key, deps);
  if (first.kind !== 'accepted') return first;
  deps.onAccepted?.(first.cmdId);
  return waitForCommand(first.cmdId, now(), deps);
}

/** 보내기 한 번 → 결말 또는 202 pending(accepted). 던지지 않는다 */
async function sendStep(
  req: WriteRequest,
  key: string,
  deps: WriteDeps,
): Promise<WriteOutcome | { kind: 'accepted'; cmdId: string }> {
  let sent: SendResult;
  try {
    sent = await sendBizWrite(req, key, deps.fetch, deps.signal);
  } catch (e) {
    if (deps.signal?.aborted) return { kind: 'aborted' };
    const error = e instanceof ApiError ? e : new ApiError(0, null, String(e));
    return isRetryableStatus(error.status) ? { kind: 'retryable', error } : { kind: 'rejected', error };
  }
  if (deps.signal?.aborted) return { kind: 'aborted' };
  if (sent.kind === 'done')
    return { kind: 'applied', status: sent.status, body: sent.body, viaCommand: false };
  if (sent.status === 'expired') return { kind: 'expired', cmdId: sent.cmdId };
  return { kind: 'accepted', cmdId: sent.cmdId };
}

// ── 화면 상태 ──

export type BizWriteState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'pending'; cmdId: string }
  /** retryAt — 재시도 버튼이 켜지는 시각(epoch ms · 연속 실패마다 1 · 2 · 4초 … 백오프) · 없으면 곧바로 */
  | { phase: 'retryable'; error: ApiError; retryAt?: number }
  | { phase: 'stale'; cmdId: string }
  | { phase: 'expired'; cmdId: string }
  | { phase: 'unseen'; cmdId: string }
  /** 대기 중 폼이 다시 마운트된 뒤 온 거절 — 보낸 폼의 오류 칸이 사라져 띠로 보인다 */
  | { phase: 'rejected'; error: ApiError };

export function stateAfter(o: WriteOutcome): BizWriteState {
  switch (o.kind) {
    case 'applied':
    case 'rejected':
    case 'aborted':
      return { phase: 'idle' };
    case 'retryable':
      return { phase: 'retryable', error: o.error };
    case 'stale':
    case 'expired':
    case 'unseen':
      return { phase: o.kind, cmdId: o.cmdId };
  }
}

/** 폼 잠금 — 보내는 중 · 적용 대기(같은 폼 재제출을 막는다) */
export const isLocked = (s: BizWriteState): boolean => s.phase === 'sending' || s.phase === 'pending';

/** 저장 버튼 자리 문구 */
export function submitLabel(s: BizWriteState, idle: string): string {
  if (s.phase === 'pending') return '적용 대기 — 명령 접수됨';
  if (s.phase === 'sending') return `${idle} 중…`;
  return idle;
}

export interface CommandNoticeText {
  tone: 'danger' | 'warning' | 'info';
  text: string;
  /** 같은 키로 다시 보내는 버튼 문구 — 없으면 버튼 없음 */
  retry: string | null;
}

/** 명령 경로 상태 → 폼 영역 띠(idle · sending은 없음) */
export function commandNotice(s: BizWriteState): CommandNoticeText | null {
  const short = (id: string) => id.slice(0, 8);
  switch (s.phase) {
    case 'idle':
    case 'sending':
      return null;
    case 'pending':
      return {
        tone: 'info',
        text: `적용 대기 — 명령 접수됨 (${short(s.cmdId)}) · 결과를 확인하는 중 · 다시 저장하지 않는다`,
        retry: null,
      };
    case 'retryable':
      return { tone: 'danger', text: writeErrorText(s.error), retry: '같은 키로 다시 보내기' };
    case 'stale':
      return {
        tone: 'warning',
        text: `오래 대기 — 명령 유효 창(${BIZ_RESULT_TTL_S}초)을 넘도록 결과가 없다 (${short(s.cmdId)})`,
        retry: '같은 명령으로 다시 보내기',
      };
    case 'expired':
      return {
        tone: 'warning',
        text: `적용되지 않았다 — 유효 창 초과 (${short(s.cmdId)}) · 다시 저장하면 새 명령이다`,
        retry: null,
      };
    case 'rejected':
      return { tone: 'warning', text: errorText(s.error), retry: null };
    case 'unseen':
      return {
        tone: 'warning',
        text: `이 명령을 볼 수 없다 — 행위자가 다름 (${short(s.cmdId)})`,
        retry: null,
      };
  }
}

// ── 폼 쓰기 상태 저장소 · 훅 ──
// 대기 상태는 폼 컴포넌트 밖(모듈 저장소 · 폼 식별 scope 기준)에 둔다. 대기 중에 ⑥ 신호로 목록이 바뀌어 폼이 다시 마운트돼도
// (폼 key가 행 내용이다) 폴링과 결말 처리(부모의 "저장 완료" 안내 · 무효화)가 끊기지 않고, 새 인스턴스가 같은 잠금 · 띠를 본다.
// 구독자가 모두 떠나면(화면 이탈 · 폼 닫기) 명령 조회만 멈추고 키 · 마지막 요청 · 상태(pending · stale · 재시도)는 남긴다 —
// 다시 붙으면 pending의 조회를 이어 걸어(유효 창을 넘었으면 stale) 같은 키 · 잠금으로 결말을 본다. 항목은 결말 뒤에만 버린다.

type OnDone = (o: WriteOutcome) => void | Promise<void>;

interface WriterEntry {
  scope: string;
  state: BizWriteState;
  held: HeldKey | null;
  last: { req: WriteRequest; onDone: OnDone; opts: StartOptions } | null;
  /** 쓰기 한 건 — 새 쓰기 · 재시도가 앞 것을 끊는다(앞 쓰기의 늦은 응답이 새 상태를 덮지 않게) */
  gen: AbortController | null;
  /** 명령 조회 루프 — 구독자가 모두 떠나면 끊고 다시 붙으면 새로 건다 */
  poll: AbortController | null;
  /** 202 pending을 받은 명령 — 조회 재개의 기준(유효 창은 받은 시각부터) */
  accepted: { cmdId: string; at: number } | null;
  /** 연속 retryable 결말 수 — 재시도 버튼 백오프(08_screen/01 "백오프 뒤 재시도 버튼") */
  failures: number;
  listeners: Set<() => void>;
  release: ReturnType<typeof setTimeout> | null;
}

/** 재시도 버튼 백오프 — n번째 연속 실패 뒤 1 · 2 · 4초 … 최대 30초(명령 조회 백오프와 같은 주기) */
export const retryBackoffMs = (failures: number): number => pollDelayMs(Math.max(0, failures - 1));

const IDLE: BizWriteState = { phase: 'idle' };
const writers = new Map<string, WriterEntry>();

function entryOf(scope: string): WriterEntry {
  let e = writers.get(scope);
  if (!e) {
    e = {
      scope,
      state: IDLE,
      held: null,
      last: null,
      gen: null,
      poll: null,
      accepted: null,
      failures: 0,
      listeners: new Set(),
      release: null,
    };
    writers.set(scope, e);
  }
  return e;
}

function setWriterState(e: WriterEntry, s: BizWriteState): void {
  e.state = s;
  for (const l of e.listeners) l();
}

/** 버려도 되는 항목 — 결말이 났고(잠금 · 재시도 · 오래 대기가 아니다) 아무도 보지 않는다 */
function dropIfSettled(e: WriterEntry): void {
  const p = e.state.phase;
  if (e.listeners.size > 0 || e.release || isLocked(e.state) || p === 'retryable' || p === 'stale') return;
  if (writers.get(e.scope) === e) writers.delete(e.scope);
}

/** 구독자가 모두 떠난 뒤 이만큼 아무도 다시 붙지 않으면(화면을 떠났다) 명령 조회를 멈춘다 — 재마운트는 이 안에 다시 붙는다 */
export const WRITER_RELEASE_MS = 1_000;

export const writerState = (scope: string): BizWriteState => writers.get(scope)?.state ?? IDLE;

export function subscribeWriter(
  scope: string,
  listener: () => void,
  releaseMs = WRITER_RELEASE_MS,
): () => void {
  const e = entryOf(scope);
  if (e.release) clearTimeout(e.release);
  e.release = null;
  e.listeners.add(listener);
  // 떠났다 돌아왔다 — pending이면 조회를 다시 건다
  if (e.state.phase === 'pending' && !e.poll && e.gen && !e.gen.signal.aborted) void pollEntry(e, e.gen);
  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size > 0) return;
    e.release = setTimeout(() => {
      e.release = null;
      if (e.listeners.size > 0) return;
      e.poll?.abort();
      e.poll = null;
      dropIfSettled(e);
    }, releaseMs);
  };
}

export interface StartOptions {
  onViaCommand?: () => void;
  /** 보낸 폼 인스턴스가 아직 붙어 있는가 — 떨어진 뒤의 거절은 그 폼의 오류 칸이 사라졌으므로 띠(phase rejected)로 넘긴다 */
  ownerAlive?: () => boolean;
  deps?: Omit<WriteDeps, 'signal' | 'onAccepted'>;
}

/** 결말 반영 — 이 쓰기가 아직 주인일 때만 */
async function conclude(e: WriterEntry, c: AbortController, o: WriteOutcome): Promise<void> {
  if (o.kind === 'aborted' || c.signal.aborted || e.gen !== c || !e.last) return;
  const { onDone, opts } = e.last;
  e.held = keyAfter(e.held, o);
  e.accepted = null;
  if (o.kind === 'applied' && o.viaCommand) opts.onViaCommand?.();
  const orphan = o.kind === 'rejected' && opts.ownerAlive && !opts.ownerAlive();
  e.failures = o.kind === 'retryable' ? e.failures + 1 : 0;
  const next = orphan ? { phase: 'rejected' as const, error: o.error } : stateAfter(o);
  const now = opts.deps?.now ?? Date.now;
  setWriterState(
    e,
    next.phase === 'retryable' ? { ...next, retryAt: now() + retryBackoffMs(e.failures) } : next,
  );
  try {
    await onDone(o);
  } catch (err) {
    // 결말은 이미 반영했다 — 화면 콜백의 실패가 처리되지 않은 rejection으로 새지 않게 여기서 닫는다
    console.error('업무 쓰기 결말 처리 실패', err);
  } finally {
    dropIfSettled(e);
  }
}

/** pending 명령을 결말까지 조회한다 — 구독자가 없으면 걸지 않는다(다시 붙을 때 subscribeWriter가 건다) */
async function pollEntry(e: WriterEntry, c: AbortController): Promise<void> {
  const acc = e.accepted;
  if (!acc || e.listeners.size === 0 || e.poll) return;
  const p = new AbortController();
  e.poll = p;
  try {
    let o: WriteOutcome;
    try {
      o = await waitForCommand(acc.cmdId, acc.at, { ...e.last?.opts.deps, signal: p.signal });
    } catch {
      // 예상 밖 실패 — 대기 잠금을 풀고 같은 키 재전송(오래 대기와 같은 대응 · 이중 쓰기가 아니다)으로 넘긴다
      o = { kind: 'stale', cmdId: acc.cmdId };
    }
    if (p.signal.aborted) return; // 떠났다 — 다시 붙으면 이어 건다 · 새 쓰기면 c도 끊겼다
    e.poll = null;
    await conclude(e, c, o);
  } finally {
    if (e.poll === p) e.poll = null;
  }
}

/**
 * scope 하나의 쓰기 — 키 · 잠금 · 202 폴링 · 결말. 폼 인스턴스와 무관하게 끝까지 간다.
 * 던지지 않는다 — 예상 밖 실패로 결말 없이 끝나면 잠금을 풀고 같은 키 재시도 띠로 넘긴다.
 */
export async function startWrite(scope: string, req: WriteRequest, onDone: OnDone, opts: StartOptions = {}) {
  const e = entryOf(scope);
  e.held = keyFor(e.held, req);
  e.last = { req, onDone, opts };
  e.gen?.abort();
  e.poll?.abort();
  e.poll = null;
  e.accepted = null;
  const c = new AbortController();
  e.gen = c;
  const now = opts.deps?.now ?? Date.now;
  setWriterState(e, { phase: 'sending' });
  try {
    const first = await sendStep(req, e.held.key, { ...opts.deps, signal: c.signal });
    if (c.signal.aborted || e.gen !== c) return;
    if (first.kind !== 'accepted') return await conclude(e, c, first);
    e.accepted = { cmdId: first.cmdId, at: now() };
    setWriterState(e, { phase: 'pending', cmdId: first.cmdId });
    await pollEntry(e, c);
  } catch (err) {
    if (e.gen === c && !c.signal.aborted && isLocked(e.state) && !e.accepted)
      setWriterState(e, {
        phase: 'retryable',
        error: err instanceof ApiError ? err : new ApiError(0, null, String(err)),
      });
  } finally {
    // 잠금이 반드시 풀린다 — sending에 남은 채 끝났으면(예상 밖 경로) 같은 키 재시도로
    if (e.gen === c && !c.signal.aborted && e.state.phase === 'sending')
      setWriterState(e, { phase: 'retryable', error: new ApiError(0, null, '쓰기 결과를 받지 못했다') });
  }
}

export interface BizWriter {
  state: BizWriteState;
  locked: boolean;
  /** 보낸다 — 결말은 onDone으로(재시도도 같은 onDone) */
  run: (req: WriteRequest, onDone: OnDone) => Promise<void>;
  /** 마지막 요청을 같은 키로 다시 보낸다(503 · failed · 네트워크 · 오래 대기) */
  retry: () => void;
  /** 띠를 닫는다(결말 표시 지우기) */
  reset: () => void;
}

/**
 * 폼 하나의 업무 쓰기 — 폼 제출 단위 키 · 폼 잠금 · 202 폴링 · 재시도.
 * scope: 폼 식별(예 tag:{tagId}) — 같은 scope의 새 인스턴스가 대기 중인 명령을 이어받는다. 없으면 인스턴스 전용.
 * onViaCommand: 202 뒤 명령 조회로 applied를 확인한 직후(onDone 전) — 마스터는 신선 창 표지를 연다(BFF ⑤가 걸리지 않았다).
 */
export function useBizWrite(opts: { scope?: string; onViaCommand?: () => void } = {}): BizWriter {
  const local = useRef<string | null>(null);
  if (local.current === null) local.current = `local:${newCommandKey()}`;
  const scope = opts.scope ?? local.current;
  const subscribe = useCallback((l: () => void) => subscribeWriter(scope, l), [scope]);
  const state = useSyncExternalStore(
    subscribe,
    () => writerState(scope),
    () => IDLE,
  );
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const onVia = useRef(opts.onViaCommand);
  onVia.current = opts.onViaCommand;
  const start = useCallback(
    (req: WriteRequest, onDone: OnDone) =>
      startWrite(scope, req, onDone, {
        onViaCommand: () => onVia.current?.(),
        ownerAlive: () => alive.current,
      }),
    [scope],
  );
  const retry = useCallback(() => {
    const l = writers.get(scope)?.last;
    if (l) void start(l.req, l.onDone);
  }, [scope, start]);
  const reset = useCallback(() => {
    const e = writers.get(scope);
    if (e) setWriterState(e, IDLE);
  }, [scope]);
  return { state, locked: isLocked(state), run: start, retry, reset };
}

/**
 * 결말 처리 — applied면 onApplied(원 응답 본문 · 명령 조회면 result) · rejected면 onError(기존 오류 표시).
 * 대기 · 503 · 오래 대기 · 만료 · 볼 수 없음은 폼 영역 띠(CommandNotice)가 보인다. 본문 해석 실패도 onError로 보낸다.
 */
export function settle(
  o: WriteOutcome,
  onApplied: (body: unknown, o: Extract<WriteOutcome, { kind: 'applied' }>) => void | Promise<void>,
  onError: (e: ApiError) => void,
): void | Promise<void> {
  if (o.kind === 'rejected') return onError(o.error);
  if (o.kind !== 'applied') return;
  const fail = (e: unknown) => onError(e instanceof ApiError ? e : new ApiError(o.status, null, String(e)));
  try {
    const r = onApplied(o.body, o);
    if (r instanceof Promise) return r.catch(fail);
  } catch (e) {
    fail(e);
  }
}
