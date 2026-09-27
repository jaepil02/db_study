// perf 라이브 실행(GEN-11) — 기전 정본 docs/06_pipeline/10_datagen_inject.md §성능 비교 실행 — perf · §취소 · 정리
// 단계: prepare → 규모마다 fill-ch@k · fill-pg@k · query@k → cleanup(완료 · 중단 · 실패 모두 돈다 · cleanup 중 중단은 무시).
// 값은 앱 경유 시연값이다 — 측정 기록을 만들지 않는다(결과 표지는 화면이 단다).
import type { PerfScaleResultBody } from '@db-study/shared';
import {
  PERF_FIRST_EXPONENT,
  PERF_QUERIES,
  type PerfQuery,
  type PerfQueryParams,
  perfExponents,
  perfStartSec,
  scaleEndMs,
  scaleRows,
} from './perf-sql';
import {
  type RunEnding,
  type RunError,
  type RunExecutor,
  type RunState,
  type RunStepDef,
  RunStopped,
  runErrorOf,
} from './run-registry';

/** 저장소 쪽 동작 — 실제 구현은 perf-stores.ts(전용 PG 연결 · query_id 접두 runId) · 시험은 가짜 */
export interface PerfStores {
  /** 객체 생성(ClickHouse · PostgreSQL + 일 파티션 + I2) · 전용 연결 pid 기록 — 객체 수를 돌려준다 */
  prepare(runId: string, startSec: number, maxExponent: number): Promise<number>;
  fillCh(k: number, startSec: number): Promise<void>;
  /** 증가분 INSERT … SELECT + ANALYZE */
  fillPg(k: number, startSec: number): Promise<void>;
  storageBytesCh(): Promise<number>;
  storageBytesPg(): Promise<number>;
  /** (device_id, tag_id) 사전순 첫 쌍 · v = quantileExact(0.5)(value) */
  queryParams(): Promise<{ device: number; tag: number; v: number }>;
  /** 결과 행 수 */
  queryCh(q: PerfQuery, p: PerfQueryParams): Promise<number>;
  queryPg(q: PerfQuery, p: PerfQueryParams): Promise<number>;
  /** 진행 중 문장 취소 — ClickHouse KILL QUERY(query_id 접두 runId) · PostgreSQL 다른 연결에서 pg_cancel_backend(pid) */
  cancel(): Promise<void>;
  /** 전용 연결 닫기 + DROP IF EXISTS 둘 — 지운 객체 수 */
  cleanup(): Promise<number>;
}

export interface PerfClock {
  nowMs(): number;
  monoMs(): number;
}
export const systemPerfClock: PerfClock = { nowMs: () => Date.now(), monoMs: () => performance.now() };

/** 웜만 — 워밍업 1회 버림 + 3회 */
export const PERF_WARMUP = 1;
export const PERF_REPS = 3;

const round2 = (x: number) => Math.round(x * 100) / 100;

export function perfSteps(maxExponent: number): RunStepDef[] {
  const out: RunStepDef[] = [{ key: 'prepare', label: '실행 객체 생성' }];
  for (const k of perfExponents(maxExponent)) {
    out.push(
      { key: `fill-ch@${k}`, label: `ClickHouse 10^${k} 적재` },
      { key: `fill-pg@${k}`, label: `PostgreSQL 10^${k} 적재 · ANALYZE` },
      { key: `query@${k}`, label: `10^${k} 쿼리 5종 × 두 저장소` },
    );
  }
  out.push({ key: 'cleanup', label: '실행 객체 DROP' });
  return out;
}

function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export class PerfRunExecutor implements RunExecutor {
  readonly type = 'perf' as const;

  constructor(
    private readonly stores: PerfStores,
    private readonly clock: PerfClock = systemPerfClock,
  ) {}

  steps(params: Record<string, number>): RunStepDef[] {
    return perfSteps(params.maxExponent as number);
  }

  async execute(state: RunState): Promise<RunEnding> {
    const maxExponent = state.params.maxExponent as number;
    const startSec = perfStartSec(state.startedAt, maxExponent);
    const scales: PerfScaleResultBody[] = [];
    state.result = { scales };
    let failure: RunError | null = null;
    let stopped = false;
    try {
      await state.runStep('prepare', async () => ({
        objects: await this.stores.prepare(state.runId, startSec, maxExponent),
      }));
      let qp: { device: number; tag: number; v: number } | null = null;
      for (const k of perfExponents(maxExponent)) {
        const r = scaleRows(k);
        const scale: PerfScaleResultBody = {
          exponent: k,
          rows: 10 ** k,
          fillMs: { ch: null, pg: null },
          storageBytes: { ch: null, pg: null },
          queries: [],
        };
        await state.runStep(`fill-ch@${k}`, async () => {
          state.setCanceller(() => this.stores.cancel());
          const t0 = this.clock.monoMs();
          await this.stores.fillCh(k, startSec);
          const ms = round2(this.clock.monoMs() - t0);
          const storageBytes = await this.stores.storageBytesCh();
          scale.fillMs.ch = ms;
          scale.storageBytes.ch = storageBytes;
          return { rows: r.hi - r.lo, ms, storageBytes };
        });
        await state.runStep(`fill-pg@${k}`, async () => {
          state.setCanceller(() => this.stores.cancel());
          const t0 = this.clock.monoMs();
          await this.stores.fillPg(k, startSec);
          const ms = round2(this.clock.monoMs() - t0);
          const storageBytes = await this.stores.storageBytesPg();
          scale.fillMs.pg = ms;
          scale.storageBytes.pg = storageBytes;
          return { rows: r.hi - r.lo, ms, storageBytes };
        });
        await state.runStep(`query@${k}`, async () => {
          state.setCanceller(() => this.stores.cancel());
          state.patchDetail(`query@${k}`, { done: 0, total: PERF_QUERIES.length * 2 });
          // Q5 문턱 · 쿼리 쌍은 첫 규모 채우기 직후 한 번 정해 실행 끝까지 고정한다
          if (k === PERF_FIRST_EXPONENT || !qp) qp = await this.stores.queryParams();
          const params: PerfQueryParams = { ...qp, endMs: scaleEndMs(startSec, k) };
          let done = 0;
          for (const q of PERF_QUERIES) {
            const ch = await this.measure(state, () => this.stores.queryCh(q, params));
            state.patchDetail(`query@${k}`, { done: ++done });
            const pg = await this.measure(state, () => this.stores.queryPg(q, params));
            state.patchDetail(`query@${k}`, { done: ++done });
            const cm = median(ch.values);
            const pm = median(pg.values);
            scale.queries.push({
              q,
              ch: { values: ch.values, median: cm, rows: ch.rows },
              pg: { values: pg.values, median: pm, rows: pg.rows },
              winner: cm === null || pm === null ? null : pm < cm ? 'pg' : 'ch',
              ratio: cm && pm !== null ? round2(pm / cm) : null,
              resultMatch: ch.rows === null || pg.rows === null ? null : ch.rows === pg.rows,
            });
          }
          return { done, total: PERF_QUERIES.length * 2 };
        });
        // 끝난 규모만 싣는다 — 반쪽 규모의 쿼리 시간은 채우기 중인 테이블의 값이다
        scales.push(scale);
      }
    } catch (e) {
      if (e instanceof RunStopped) stopped = true;
      else failure = runErrorOf(e);
    }
    state.skipPending(['cleanup']);
    // 정리 — 세 갈래 모두 · 중단을 무시한다
    state.inCleanup = true;
    let cleanupError: RunError | null = null;
    try {
      await state.runStep('cleanup', async () => ({ objects: await this.stores.cleanup() }), {
        ignoreStop: true,
      });
    } catch (e) {
      cleanupError = runErrorOf(e);
    }
    if (stopped)
      return {
        status: 'stopped',
        error: cleanupError ? { code: null, message: cleanupError.message } : null,
      };
    if (failure) return { status: 'failed', error: failure };
    // 정상 경로 정리 실패 → failed — 객체가 남은 실행을 완료로 보이지 않는다
    if (cleanupError) return { status: 'failed', error: cleanupError };
    return { status: 'completed', error: null };
  }

  /** 워밍업 1회 버림 + 3회 — 값은 ms(0.01 반올림) · 행 수는 마지막 회 */
  private async measure(
    state: RunState,
    fn: () => Promise<number>,
  ): Promise<{ values: number[]; rows: number | null }> {
    let rows: number | null = null;
    const values: number[] = [];
    for (let i = 0; i < PERF_WARMUP + PERF_REPS; i++) {
      if (state.stopRequested) throw new RunStopped();
      const t0 = this.clock.monoMs();
      rows = await fn();
      const ms = this.clock.monoMs() - t0;
      if (i >= PERF_WARMUP) values.push(round2(ms));
    }
    return { values, rows };
  }
}
