// 라이브 실행 패널(직접 비교 실험) — 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙
// 표면 정본 docs/07_api/09_datagen.md §라이브 실행 제어 #2~#5 · §실행 객체 — 브라우저 → BFF(/bff/runs) → api · no-store.
// 경과 시간은 서버 elapsedMs 하나를 기준으로 두고 브라우저는 그 응답을 받은 뒤 흐른 단조 시계 길이만 더한다(startedAt을 빼지 않는다).
// 화면 조각은 components/runs/**가 그리고, 여기는 판정 · 문구 · 요청만 둔다(순수 함수 — 단위 테스트 대상).
import type { Query } from '@tanstack/react-query';
import { ApiError } from './api';
import {
  COMPARE_PARTS,
  COMPARE_QUERY_SIZES,
  type ComparePart,
  compareQueryStepKey,
  compareSizeName,
  ErrorEnvelope,
  RUN_TERMINAL,
  RUN_TYPES,
  RunCurrentBody,
  RunObject,
  type RunObjectBody,
  type RunStatus,
  type RunType,
} from './shared';
import { formatKstIso } from './time';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** 폴링 주기 1초 — running · stopping 동안만(§갱신과 응답 처리 폴링 행) */
export const RUN_POLL_MS = 1_000;

/** 실행 쿼리 키 — 화면들이 같은 키를 써서 한 화면에서 시작한 실행이 다른 화면으로 이어진다(08_screen/08 §EXP-FLOW 캐시 층) */
export const runKeys = {
  current: ['runs', 'current'] as const,
  one: (runId: string) => ['runs', runId] as const,
};

/**
 * 화면 종류 → 화면 이름 · 경로(다른 실행 링크) — 1층 문구라 화면 코드가 아니라 이름을 쓴다(08_screen/08 §실행 패널 버튼 상태).
 * flow는 보는 화면이 없다(분산 처리 모니터링 삭제) — api로 시작한 flow 실행은 링크 없이 한 줄로만 알린다.
 */
export const RUN_SCREEN: Record<RunType, { name: string; href: string } | null> = {
  flow: null,
  compare: { name: '직접 비교 실험', href: '/lab' },
};

/** 다른 종류의 실행이 진행 중일 때의 한 줄 — 보는 화면이 있으면 "… — 직접 비교 실험 화면에서 보기" */
export const otherRunText = (other: RunType): string => {
  const screen = RUN_SCREEN[other];
  return screen
    ? `다른 측정이 이미 돌고 있어요 — ${screen.name} 화면에서 보기`
    : '다른 측정이 이미 돌고 있어요';
};

export const VANISHED_TEXT = '서버가 다시 켜져서 지난 실행 기록이 없어요';
export const POLL_FAILED_TEXT = '상태를 못 읽었어요 — 다시 읽는 중이에요';
/** 라이브 표지 — 완료 띠 옆 글자와 툴팁 고정 문구(08_screen/08 §표시 계약 라이브 표지) */
export const LIVE_LABEL = '내 측정(참고용)';
export const LIVE_MARK = '라이브 실행 — 앱 경유 · 시연값 · 기록 정본 아님';
/** 지난 실행 띠 머리 — 무엇을 잰 결과인지(리드 확인 2026-10-03) */
export const LAST_RUN_LABEL: Record<RunType, string> = {
  flow: '지난번 보내 보기',
  compare: '지난번 직접 비교',
};
/** 같은 종류 409 — 이 화면에서 이미 돌고 있다(진행 띠가 그 실행을 보인다 · 자기 화면 링크를 걸지 않는다) */
export const SAME_RUN_TEXT = '같은 측정이 이미 돌고 있어요 — 끝나면 다시 눌러 주세요';

/** 받은 응답 한 장 — 경과 틱의 기준(receivedAt은 브라우저 단조 시계 performance.now) */
export interface RunSnapshot {
  run: RunObjectBody | null;
  receivedAt: number;
}

export const monoNow = (): number => globalThis.performance?.now() ?? Date.now();

export const isActive = (s: RunStatus): boolean => s === 'running' || s === 'stopping';
export const isTerminal = (s: RunStatus): boolean => RUN_TERMINAL.has(s);

// ── 형식 ──

/** 실행 시각 — KST 초까지 "HH:MM:SS KST"(띠 툴팁 · 08_screen/01 §시각 표시) */
export const formatRunClock = (iso: string): string => formatKstIso(iso).slice(11);

/**
 * 경과 시간 — 진행 중 1s 단위("42s" · "1m 42s" · "1h 3m 12s") · 종결 0.1s 단위 버림("12.4s" · "3m 12.4s" · "1h 3m 12.4s").
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
    sec = `${Math.floor(t / 10)}.${t % 10}s`;
  } else {
    const s = Math.floor(v / 1000);
    h = Math.floor(s / 3600);
    m = Math.floor((s % 3600) / 60);
    sec = `${s % 60}s`;
  }
  if (h > 0) return `${h}h ${m}m ${sec}`;
  if (m > 0) return `${m}m ${sec}`;
  return sec;
}

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

// ── 상태 칩 · 종결 띠 ──

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: '실행 중',
  stopping: '멈추는 중',
  completed: '완료',
  stopped: '중단됨',
  failed: '실패',
};

export type BandTone = 'success' | 'neutral' | 'danger' | 'info';

/**
 * 종결 · 중단 중 띠(08_screen/08 §상태 칩과 종결 표시) — running이면 없음 · tip = 띠 툴팁(종료 시각 · 오류 코드).
 * flow 드레인이 상한 30초에 닿았으면 완료 띠에 "30초 안에 다 처리되지 않았어요"를 붙인다(EXP-FLOW 진행 띠 행).
 */
export function runBand(run: RunObjectBody): { tone: BandTone; text: string; tip: string | null } | null {
  const took = formatElapsed(terminalElapsedMs(run), true);
  const end = run.endedAt ? `종료 ${formatRunClock(run.endedAt)}` : null;
  switch (run.status) {
    case 'running':
      return null;
    case 'stopping':
      return { tone: 'info', text: '멈추는 중이에요… — 하던 단계를 멈추고 정리하고 있어요', tip: null };
    case 'completed': {
      const drain = run.steps.find((s) => s.key === 'drain');
      const late = drain?.detail.timedOut === true ? ' · 30s 안에 다 처리되지 않았어요' : '';
      return { tone: 'success', text: `완료 — 걸린 시간 ${took}${late}`, tip: end };
    }
    // 오류 문장은 길 수 있다 — 띠 안은 한 줄로 자르고(truncate) 전문은 툴팁 첫 줄에 둔다
    case 'stopped':
      return {
        tone: 'neutral',
        text: `중단됨 — 걸린 시간 ${took}${run.error ? ` · 정리하다 실패했어요(${run.error.message})` : ''}`,
        tip:
          [run.error ? `정리하다 실패했어요 — ${run.error.message}` : null, end].filter(Boolean).join('\n') ||
          null,
      };
    case 'failed':
      return {
        tone: 'danger',
        text: `실패했어요 — ${run.error?.message ?? '원인을 알 수 없어요'} · 걸린 시간 ${took}`,
        tip:
          [
            run.error ? `실패 원인 — ${run.error.message}` : null,
            end,
            run.error?.code ? `오류 코드 ${run.error.code}` : null,
          ]
            .filter(Boolean)
            .join('\n') || null,
      };
  }
}

/** 직접 비교 부분 이름 — ⑤ 패널 제목과 같은 말 */
export const COMPARE_PART_NAME: Record<ComparePart, string> = {
  ingest: '넣기',
  query: '조회 대결',
  consistency: '데이터 정합성',
};

const isComparePart = (v: unknown): v is ComparePart =>
  typeof v === 'string' && (COMPARE_PARTS as readonly string[]).includes(v);

/** 지난 실행이 무엇을 보낸 것인지 — flow "초당 10,000개 · 60초" · compare "넣기 1억 행" · "조회 대결" */
export function runScopeText(run: Pick<RunObjectBody, 'type' | 'params'>): string | null {
  if (run.type === 'compare') {
    const { part, rows } = run.params;
    if (!isComparePart(part)) return null;
    const name = `직접 비교 ${COMPARE_PART_NAME[part]}`;
    if (part === 'ingest' && typeof rows === 'number') return `${name} ${compareSizeName(rows)} 행`;
    return name;
  }
  const { pps, durationSec } = run.params;
  if (typeof pps !== 'number' || durationSec === undefined) return null;
  return `초당 ${pps.toLocaleString('ko-KR')}개 · ${durationSec}s`;
}

// ── 지난 실행 자리(docs/08_screen/08_evidence_screens.md §실행 패널 §상태 칩과 종결 표시) ──
// 진행 띠는 실행 중과 "이 화면에서 방금 끝난" 실행(종결 뒤 30초)에만 본문 위에 선다 — 그 뒤에는 애니메이션 없이 사라진다(서랍이 아니다).

/** 종결 뒤 띠를 남기는 시간 */
export const RECENT_END_MS = 30_000;

/** 이 화면에서 지켜보던 실행이 방금 끝났다 — 앞 응답이 같은 실행의 running · stopping이고 이번 응답이 종결이면 그 runId */
export function justEndedRunId(
  prev: RunSnapshot | undefined,
  next: RunSnapshot | undefined,
  type: RunType,
): string | null {
  const a = prev?.run;
  const b = next?.run;
  if (!a || !b || a.runId !== b.runId || b.type !== type) return null;
  return isActive(a.status) && isTerminal(b.status) ? b.runId : null;
}

/** 진행 띠가 이 실행 줄을 그리는가 — 진행 중이거나 방금 끝난 실행(recentEndId)일 때만 */
export const stripShowsRun = (run: RunObjectBody | null, recentEndId: string | null): boolean =>
  run !== null && (isActive(run.status) || run.runId === recentEndId);

/** 진행 띠 툴팁 — 시작 · 종료 시각(KST 초) · 단계 key와 상태 · 소요 · flow publish 계수(08_screen/08 진행 띠 행) */
export function runTip(run: RunObjectBody): string {
  const lines = [`시작 ${formatRunClock(run.startedAt)}`];
  if (run.endedAt) lines.push(`종료 ${formatRunClock(run.endedAt)}`);
  for (const st of run.steps)
    lines.push(
      `${st.key} ${st.status}${st.elapsedMs === null ? '' : ` ${formatElapsed(st.elapsedMs, true)}`}`,
    );
  const pub = run.steps.find((x) => x.key === 'publish')?.detail;
  if (pub) {
    const n = (k: string) => (typeof pub[k] === 'number' ? (pub[k] as number).toLocaleString('ko-KR') : '—');
    lines.push(
      `보낸 포인트 ${n('pointsSent')} · 엔트리 ${n('entriesSent')} · 명령 ${n('commandsSent')} · 조회 ${n('readsSent')} · 백프레셔 정지 ${n('backpressurePauses')}`,
    );
  }
  return lines.join('\n');
}

/**
 * 지금 단계 쉬운 문장 — 진행 띠 한 줄(단계 key로 분기 · label은 서버 문구라 쓰지 않는다 · 07_api/09 §steps[]).
 * 진행 중이면 running 단계(없으면 첫 대기 단계) · 종결이면 null(띠가 완료 · 중단 · 실패 문구를 낸다).
 */
export function stepPlainText(
  run: Pick<RunObjectBody, 'steps' | 'status'> & { type?: RunType },
): string | null {
  if (!isActive(run.status)) return null;
  const step = run.steps.find((s) => s.status === 'running') ?? run.steps.find((s) => s.status === 'pending');
  if (!step) return '정리 중';
  const compare = COMPARE_STEP_TEXT[step.key];
  if (run.type === 'compare' && compare) return compare;
  if (step.key === 'prepare') return '준비 중';
  if (step.key === 'cleanup') return '정리 중';
  if (step.key === 'publish') return '보내는 중';
  if (step.key === 'drain') return '남은 데이터 처리 기다리는 중(최대 30s)';
  return '진행 중';
}

/** 직접 비교 단계 쉬운 문장(api compare-runner 단계 key) — 넣기 · 조회 대결(원천 행 수 단계 rows-N) · 데이터 정합성 */
const COMPARE_STEP_TEXT: Record<string, string> = {
  prepare: '준비 중',
  clear: '지난 구간 비우는 중',
  publish: 'Redis로 보내는 중',
  drain: '두 DB에 다 들어가길 기다리는 중',
  verify: '행 수 · 크기 맞춰 보는 중',
  ...Object.fromEntries(
    COMPARE_QUERY_SIZES.map((n) => [compareQueryStepKey(n), `원천 ${compareSizeName(n)} 행 집계하는 중`]),
  ),
  clickhouse: 'ClickHouse에서 재는 중',
  postgres: 'PostgreSQL에서 재는 중',
  compare: '두 DB 맞춰 보는 중',
};

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
}

/** 실행 매개변수 중 숫자 칸만(선택 칸 잠금 표시용 — compare의 part 같은 글자 칸은 화면이 따로 보인다) */
export function numericParams(params: Record<string, number | string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) if (typeof v === 'number') out[k] = v;
  return out;
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
    other: { name: string; href: string } | null;
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
  const note = otherActive && run ? otherRunText(run.type) : null;
  const stopping = i.stopRequested || (mine && run?.status === 'stopping');
  return {
    paramsLocked: !ready || active || i.starting,
    lockedParams: active && mine && run ? numericParams(run.params) : null,
    start: {
      enabled: ready && !active && !i.starting,
      label: i.starting ? '시작하는 중이에요…' : '시작',
      note,
      other: otherActive && run ? RUN_SCREEN[run.type] : null,
    },
    stop: {
      enabled: mine && run?.status === 'running' && !i.stopRequested,
      label: stopping ? '멈추는 중이에요…' : '중단',
    },
  };
}

/** 이 화면 패널이 보일 실행 — 다른 종류의 실행이면 "실행 없음"(빈 값 ④) */
export const panelRun = (snap: RunSnapshot | undefined, type: RunType): RunObjectBody | null =>
  snap?.run && snap.run.type === type ? snap.run : null;

// ── 폴링 ──

/**
 * refetchInterval — 진행 중이면 1초 · 종결 · 실행 없음이면 멈춘다 · 조회 실패면 마지막 객체와 무관하게 1초 재시도(§갱신과 응답 처리 폴링 실패 행).
 * 종결 객체를 받은 뒤라도 그 뒤 조회가 실패하면 지금 상태를 모르므로 다시 읽어야 띠의 "다시 읽는 중"이 거짓말이 되지 않는다.
 * TanStack Query는 앞 요청이 진행 중이면 새 요청을 보내지 않는다(같은 쿼리 fetch 중복 제거) — 응답 전 다음 요청 없음.
 */
export function runPollInterval(data: RunSnapshot | undefined, errored: boolean): number | false {
  if (errored) return RUN_POLL_MS;
  const run = data?.run ?? null;
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

/** 시작 매개변수 — flow는 숫자만 · compare는 part(글자)가 섞인다 */
export type RunParamsInput = Record<string, number | string>;

/**
 * 화면이 바꿀 수 없는 이유로 서버가 시작을 거절 — no_data · ingest_incomplete(409 compare_no_data · details.reason) ·
 * sink_off · plant_on · purging(400 validation_failed · details.fields path 'SW-09' · 'plant' · 'purge')
 */
export type RefuseReason = 'no_data' | 'ingest_incomplete' | 'sink_off' | 'plant_on' | 'purging';
export const REFUSE_TEXT: Record<RefuseReason, string> = {
  no_data: '비교할 데이터가 없어요 — 먼저 ① 넣기를 해 주세요',
  ingest_incomplete: '넣기가 끝까지 되지 않아 비교 데이터가 온전하지 않아요 — 다시 넣어 주세요',
  plant_on: '설비 가동을 끈 뒤 비교해 주세요 — 가동 데이터가 섞이면 비교가 흐려져요',
  purging: '센서 데이터를 지우는 중이에요 — 끝난 뒤 다시 해 주세요',
  sink_off:
    '동시 적재 스위치(SW-09)가 꺼져 있어요 — CONTROL_TABLE_ENABLED를 gated로 두고 api를 다시 켜야 해요',
};

export type StartOutcome =
  | { kind: 'started'; run: RunObjectBody }
  /** 409 compare_no_data · 400 SW-09 — 고른 값 문제가 아니라 순서 · 설정 문제(띠 문구) */
  | { kind: 'refused'; reason: RefuseReason; error: ApiError }
  /** 409 — 단건 조회 1회로 맞춘 실행(404면 null → current 재조회) */
  | { kind: 'conflict'; type: RunType | null; run: RunObjectBody | null }
  /** 400 — 화면과 서버의 화이트리스트가 어긋났다 */
  | { kind: 'invalid'; error: ApiError }
  /** 네트워크 · 5xx · 429 — 버튼을 되돌리고 current 1회 재조회 */
  | { kind: 'failed'; error: ApiError };

/** #2 시작 — 409면 details.runId로 #4 한 번(다음 폴링을 기다리지 않고 패널을 맞춘다) */
export async function requestStart(
  type: RunType,
  params: RunParamsInput,
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
      const otherType = RUN_TYPES.find((x) => x === t) ?? null;
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
    if (error.status === 409 && error.code === 'datagen.compare_no_data')
      return {
        kind: 'refused',
        reason: error.details?.reason === 'ingest_incomplete' ? 'ingest_incomplete' : 'no_data',
        error,
      };
    const path = error.status === 400 ? refusedPath(error) : null;
    if (path === 'SW-09') return { kind: 'refused', reason: 'sink_off', error };
    if (path === 'plant') return { kind: 'refused', reason: 'plant_on', error };
    if (path === 'purge') return { kind: 'refused', reason: 'purging', error };
    if (error.status === 400) return { kind: 'invalid', error };
    return { kind: 'failed', error };
  }
}

/** 400 중 순서 · 설정 거절 — details.fields의 path가 'SW-09'(동시 적재 꺼짐) · 'plant'(설비 가동 중) · 'purge'(지우는 중)면 그 path */
export function refusedPath(e: Pick<ApiError, 'details'>): 'SW-09' | 'plant' | 'purge' | null {
  const fields = e.details?.fields;
  if (!Array.isArray(fields)) return null;
  for (const x of fields) {
    const p = (x as { path?: unknown })?.path;
    if (p === 'SW-09' || p === 'plant' || p === 'purge') return p;
  }
  return null;
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
    // 상태를 바꾸는 POST는 JSON 본문 필수(api 규칙 · 중단은 빈 객체)
    const { body } = await call(f, `/bff/runs/${encodeURIComponent(runId)}/stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
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
  /** 409 사건의 띠 — 다른 종류 실행 링크 줄이 이미 같은 말을 하면 진행 띠가 이 줄을 생략한다 */
  conflict?: boolean;
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
  /** self — 이 패널의 화면 종류(같은 종류 409 문구가 자기 화면을 가리키지 않게) */
  | { kind: 'start-done'; outcome: StartOutcome; self: RunType }
  | { kind: 'stop-request' }
  | { kind: 'stop-done'; outcome: StopOutcome }
  | { kind: 'vanished' };

const FAIL_TEXT = '요청이 실패했어요 — 다시 눌러 주세요';

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
            conflict: true,
            text:
              o.type === null
                ? '다른 측정이 이미 돌고 있어요'
                : o.type === a.self
                  ? SAME_RUN_TEXT
                  : otherRunText(o.type),
          },
        };
      if (o.kind === 'refused')
        return {
          ...base,
          notice: { tone: o.reason === 'sink_off' ? 'danger' : 'info', text: REFUSE_TEXT[o.reason] },
        };
      if (o.kind === 'invalid')
        return {
          ...base,
          paramError: '고른 값을 서버가 받지 않았어요 — 화면을 새로고침해 주세요',
        };
      return { ...base, notice: { tone: 'danger', text: FAIL_TEXT } };
    }
    case 'stop-request':
      return { ...s, stopRequested: true, notice: null };
    case 'stop-done': {
      const o = a.outcome;
      const base = { ...s, stopRequested: false };
      if (o.kind === 'stopped') return base;
      if (o.kind === 'gone') return { ...base, notice: { tone: 'neutral', text: VANISHED_TEXT } };
      return { ...base, notice: { tone: 'danger', text: FAIL_TEXT } };
    }
    case 'vanished':
      return { ...s, notice: { tone: 'neutral', text: VANISHED_TEXT } };
  }
}

/** 진행 중이던 실행이 current null로 바뀌었다 — api 재기동(404 행과 같은 "기록 없음") */
export const vanished = (prev: RunSnapshot | undefined, next: RunSnapshot | undefined): boolean =>
  !!prev?.run && isActive(prev.run.status) && next !== undefined && next.run === null;

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ── compare 넣기 진행 ──

export interface CompareLive {
  part: ComparePart;
  /** 넣기 발행 진행 0~1 — 넣기가 아니거나 아직 없으면 null */
  ratio: number | null;
  published: number | null;
  rowsCh: number | null;
  rowsPg: number | null;
}

/** 진행 중 직접 비교의 지금 값 — publish 단계 detail(published · rowsCh · rowsPg · progress) */
export function compareLive(run: Pick<RunObjectBody, 'type' | 'params' | 'steps'>): CompareLive | null {
  if (run.type !== 'compare' || !isComparePart(run.params.part)) return null;
  const d = run.steps.find((s) => s.key === 'publish')?.detail ?? {};
  return {
    part: run.params.part,
    ratio: n(d.progress),
    published: n(d.published),
    rowsCh: n(d.rowsCh),
    rowsPg: n(d.rowsPg),
  };
}
