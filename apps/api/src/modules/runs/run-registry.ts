// 라이브 실행 레지스트리 — 정본 docs/07_api/09_datagen.md §공통 규약(라이브 실행) · §실행 객체 · §중단과 실패 ·
// docs/06_pipeline/10_datagen_inject.md §라이브 실행(상태 전이 · 단계 표지)
// 상태 자리는 인스턴스 메모리 — 진행 중 1 + 마지막으로 끝난 1(다음 시작 전까지) · 재기동이면 둘 다 사라진다(기록 없음).
// 동시 실행 확인(③)과 실행 객체 생성(④)은 한 임계 구역이다 — 같은 동기 구간 안에서 끝내 두 시작 요청 중 하나만 running이 된다.
import { randomUUID } from 'node:crypto';
import {
  RUN_TERMINAL,
  type RunObjectBody,
  type RunStatus,
  type RunStepBody,
  type RunStepStatus,
  type RunType,
} from '@db-study/shared';
import { ApiError } from '../../common/http/api-error';
import { runMetrics } from './runs.metrics';

export interface RunClock {
  nowMs(): number;
}
export const systemRunClock: RunClock = { nowMs: () => Date.now() };

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** 단계가 중단으로 끝났음을 알리는 신호 — 단계 표지 stopped · 뒤 단계 skipped */
export class RunStopped extends Error {
  constructor() {
    super('중단 요청');
  }
}

export interface RunStepDef {
  key: string;
  label: string;
}

interface StepState extends RunStepDef {
  status: RunStepStatus;
  startedAt: number | null;
  endedAt: number | null;
  detail: Record<string, unknown>;
}

export type RunError = { code: string | null; message: string };

/** 원인의 기존 에러 코드(ApiError)만 싣고 아니면 null — run_failed 같은 코드를 만들지 않는다 */
export function runErrorOf(e: unknown): RunError {
  if (e instanceof ApiError) return { code: e.code, message: e.message };
  return { code: null, message: e instanceof Error ? e.message : String(e) };
}

export class RunState {
  readonly runId: string;
  status: RunStatus = 'running';
  endedAt: number | null = null;
  result: RunObjectBody['result'] = null;
  error: RunError | null = null;
  /** cleanup 진행 중 — 중단을 무시한다(표면 #5 두째 행) */
  inCleanup = false;
  private readonly steps: StepState[];
  private canceller: (() => Promise<void>) | null = null;
  private readonly stopWaiters: (() => void)[] = [];

  constructor(
    readonly type: RunType,
    readonly params: Record<string, number>,
    readonly startedAt: number,
    steps: readonly RunStepDef[],
    private readonly clock: RunClock,
    runId: string = randomUUID(),
  ) {
    this.runId = runId;
    this.steps = steps.map((s) => ({ ...s, status: 'pending', startedAt: null, endedAt: null, detail: {} }));
  }

  get stopRequested(): boolean {
    return this.status === 'stopping';
  }

  get terminal(): boolean {
    return RUN_TERMINAL.has(this.status);
  }

  /** 진행 중 단계의 취소 수단 — 단계가 끝나면 null로 되돌린다 */
  setCanceller(fn: (() => Promise<void>) | null): void {
    this.canceller = fn;
  }

  /** 중단 요청이 오면 풀리는 약속(발행 · drain 대기를 깨운다) */
  stopSignal(): Promise<void> {
    if (this.stopRequested) return Promise.resolve();
    return new Promise((r) => this.stopWaiters.push(r));
  }

  /** running → stopping · 진행 중 단계에 취소를 건다(취소 실패는 삼킨다 — 단계가 끝나면 경계에서 멈춘다) */
  requestStop(): void {
    this.status = 'stopping';
    for (const w of this.stopWaiters.splice(0)) w();
    const c = this.canceller;
    if (c) void c().catch(() => undefined);
  }

  private step(key: string): StepState {
    const s = this.steps.find((x) => x.key === key);
    if (!s) throw new Error(`단계 없음 — ${key}`);
    return s;
  }

  stepStatus(key: string): RunStepStatus {
    return this.step(key).status;
  }

  beginStep(key: string): void {
    const s = this.step(key);
    s.status = 'running';
    s.startedAt = this.clock.nowMs();
  }

  /** 진행 중 detail 갱신(publish progress · query done 등) */
  patchDetail(key: string, detail: Record<string, unknown>): void {
    const s = this.step(key);
    s.detail = { ...s.detail, ...detail };
  }

  endStep(key: string, status: 'done' | 'stopped' | 'failed', detail?: Record<string, unknown>): void {
    const s = this.step(key);
    s.status = status;
    s.endedAt = this.clock.nowMs();
    if (detail) s.detail = { ...s.detail, ...detail };
  }

  /** 미시작 단계 → skipped(except 제외 — perf cleanup은 중단 · 실패에도 돈다) */
  skipPending(except: readonly string[] = []): void {
    for (const s of this.steps) if (s.status === 'pending' && !except.includes(s.key)) s.status = 'skipped';
  }

  /**
   * 단계 하나 — 시작 전 중단이면 RunStopped · 예외는 중단 요청이 있었으면 stopped · 아니면 failed로 표지하고 다시 던진다.
   * fn이 끝났으면 중단 요청이 그 사이 왔어도 done이다(끝난 단계는 done 유지 · 단계 경계에서 받은 중단은 진행 중 0개).
   */
  async runStep(
    key: string,
    fn: () => Promise<Record<string, unknown> | undefined>,
    opts: { ignoreStop?: boolean } = {},
  ): Promise<void> {
    if (this.stopRequested && !opts.ignoreStop) throw new RunStopped();
    this.beginStep(key);
    try {
      const detail = await fn();
      this.endStep(key, 'done', detail);
    } catch (e) {
      const stopped = e instanceof RunStopped || (this.stopRequested && !opts.ignoreStop);
      this.endStep(key, stopped ? 'stopped' : 'failed');
      throw stopped ? new RunStopped() : e;
    } finally {
      this.canceller = null;
    }
  }

  finish(status: 'completed' | 'stopped' | 'failed', error: RunError | null): void {
    if (this.terminal) return;
    this.status = status;
    this.error = error;
    this.endedAt = this.clock.nowMs();
    for (const w of this.stopWaiters.splice(0)) w();
  }

  toObject(nowMs: number = this.clock.nowMs()): RunObjectBody {
    const end = this.endedAt ?? nowMs;
    return {
      runId: this.runId,
      type: this.type,
      status: this.status,
      params: { ...this.params },
      startedAt: iso(this.startedAt) as string,
      endedAt: iso(this.endedAt),
      elapsedMs: Math.max(0, Math.round(end - this.startedAt)),
      steps: this.steps.map(
        (s): RunStepBody => ({
          key: s.key,
          label: s.label,
          status: s.status,
          startedAt: iso(s.startedAt),
          endedAt: iso(s.endedAt),
          elapsedMs:
            s.startedAt === null ? null : Math.max(0, Math.round((s.endedAt ?? nowMs) - s.startedAt)),
          detail: { ...s.detail },
        }),
      ),
      result: this.result === null ? null : structuredClone(this.result),
      error: this.error ? { ...this.error } : null,
    };
  }
}

export interface RunEnding {
  status: 'completed' | 'stopped' | 'failed';
  error: RunError | null;
}

/** 실행 종류 하나의 실행기 — 단계 목록을 내고, 단계를 돌린 뒤 종결 status · error를 돌려준다(종결 표지는 레지스트리가 한 번에 한다) */
export interface RunExecutor {
  readonly type: RunType;
  steps(params: Record<string, number>): RunStepDef[];
  execute(state: RunState): Promise<RunEnding>;
}

export type StopOutcome = { httpStatus: 200 | 202; run: RunObjectBody };

export class RunRegistry {
  private current: RunState | null = null;
  private last: RunState | null = null;
  private readonly executors = new Map<RunType, RunExecutor>();

  constructor(
    executors: readonly RunExecutor[],
    private readonly clock: RunClock = systemRunClock,
  ) {
    for (const e of executors) this.executors.set(e.type, e);
  }

  /** 진행 중 실행(running · stopping) — 없으면 null */
  active(): RunState | null {
    return this.current && !this.current.terminal ? this.current : null;
  }

  /**
   * #2 ③ · ④ — 동기 구간 하나(await 없음). 진행 중이 있으면 409 details {runId, type}.
   * 마지막으로 끝난 실행을 버리고 새 실행을 만든 뒤 실행기를 응답 뒤로 돌린다.
   */
  start(type: RunType, params: Record<string, number>): RunState {
    const busy = this.active();
    if (busy)
      throw new ApiError('datagen.run_in_progress', '다른 라이브 실행이 진행 중이다', {
        runId: busy.runId,
        type: busy.type,
      });
    const exec = this.executors.get(type);
    if (!exec) throw new Error(`실행기 없음 — ${type}`);
    const state = new RunState(type, params, this.clock.nowMs(), exec.steps(params), this.clock);
    this.last = null;
    this.current = state;
    runMetrics.started(type);
    void this.drive(exec, state);
    return state;
  }

  /** 종결 표지 · 계측 · 보관 이동을 한 동기 구간에서 — 실행기가 던져도 종결을 보장한다 */
  private async drive(exec: RunExecutor, state: RunState): Promise<void> {
    let ending: RunEnding;
    try {
      ending = await exec.execute(state);
    } catch (e) {
      state.skipPending();
      ending = { status: 'failed', error: runErrorOf(e) };
    }
    state.finish(ending.status, ending.error);
    runMetrics.ended(state.type, state.status);
    this.last = state;
    this.current = null;
  }

  /** #3 — 진행 중 → 그 실행 · 없으면 마지막 종결 · 둘 다 없으면 null */
  currentRun(): RunState | null {
    return this.current ?? this.last;
  }

  /** #4 — 메모리에 없으면 null(404) */
  find(runId: string): RunState | null {
    for (const s of [this.current, this.last]) if (s && s.runId === runId) return s;
    return null;
  }

  /** #5 — 표 5행 */
  stop(runId: string): StopOutcome | null {
    const s = this.find(runId);
    if (!s) return null;
    const now = this.clock.nowMs();
    if (s.terminal) return { httpStatus: 200, run: s.toObject(now) };
    if (s.status === 'running' && !s.inCleanup) s.requestStop();
    return { httpStatus: 202, run: s.toObject(now) };
  }

  /** 시험 · 종료용 — 진행 중 실행이 끝날 때까지 */
  async settled(): Promise<void> {
    const s = this.current;
    if (!s) return;
    while (this.current === s) await new Promise((r) => setTimeout(r, 1));
  }
}
