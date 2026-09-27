// 라이브 실행 레지스트리 · 표면 #2~#5 — 정본 docs/07_api/09_datagen.md §라이브 실행 제어 · §실행 객체 · §중단과 실패
// 저장소 없이 가짜 실행기로 본다 — 동시 1 → 409 details · 404 · 중단 멱등 200 · cleanup 중 중단 무시 · 보관(진행 1 + 마지막 종결 1) · 계측.
import 'reflect-metadata';
import { ErrorEnvelope, RunCurrentBody, RunObject } from '@db-study/shared';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/common/http/api-error';
import { ApiExceptionFilter } from '../src/common/http/exception-filter';
import { appRegistry } from '../src/common/metrics/registry';
import {
  type RunEnding,
  type RunExecutor,
  RunRegistry,
  type RunState,
  RunStopped,
} from '../src/modules/runs/run-registry';
import { RUN_REGISTRY, RunsController } from '../src/modules/runs/runs.controller';

/** 단계 a → b → cleanup · 각 단계는 시험이 풀어 줄 때까지 기다린다 */
class GateExecutor implements RunExecutor {
  gates: Record<string, () => void> = {};
  entered: string[] = [];
  constructor(readonly type: 'perf' | 'flow') {}
  steps() {
    return [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'cleanup', label: '정리' },
    ];
  }
  private wait(state: RunState, key: string, cancellable: boolean) {
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.entered.push(key);
      this.gates[key] = () => resolve({ key });
      if (cancellable) state.setCanceller(async () => reject(new Error('취소됨')));
    });
  }
  async execute(state: RunState): Promise<RunEnding> {
    let stopped = false;
    try {
      await state.runStep('a', () => this.wait(state, 'a', true));
      await state.runStep('b', () => this.wait(state, 'b', true));
    } catch (e) {
      if (!(e instanceof RunStopped)) throw e;
      stopped = true;
    }
    state.skipPending(['cleanup']);
    state.inCleanup = true;
    await state.runStep('cleanup', () => this.wait(state, 'cleanup', false), { ignoreStop: true });
    return { status: stopped ? 'stopped' : 'completed', error: null };
  }
}

const tick = () => new Promise((r) => setTimeout(r, 2));
async function until(cond: () => boolean) {
  for (let i = 0; i < 500 && !cond(); i++) await tick();
  if (!cond()) throw new Error('조건 미충족');
}

async function metric(name: string, labels: Record<string, string>): Promise<number> {
  const m = await appRegistry.getSingleMetric(name)?.get();
  const v = m?.values.find((x) => Object.entries(labels).every(([k, l]) => x.labels[k] === l));
  return v?.value ?? 0;
}

describe('레지스트리 — 동시 1 · 보관 · 중단 표 5행', () => {
  let perf: GateExecutor;
  let flow: GateExecutor;
  let reg: RunRegistry;
  beforeEach(() => {
    perf = new GateExecutor('perf');
    flow = new GateExecutor('flow');
    reg = new RunRegistry([perf, flow]);
  });

  it('시작 직후 running · 전 단계 pending → 첫 단계 running · elapsedMs 서버 계산', async () => {
    const s = reg.start('perf', { maxExponent: 7 });
    const o = RunObject.parse(s.toObject());
    expect(o.status).toBe('running');
    expect(o.endedAt).toBeNull();
    expect(o.params).toEqual({ maxExponent: 7 });
    await until(() => perf.entered.includes('a'));
    expect(s.toObject().steps.map((x) => x.status)).toEqual(['running', 'pending', 'pending']);
    expect(s.toObject(s.startedAt + 1234).elapsedMs).toBe(1234);
    perf.gates.a?.();
    await until(() => perf.entered.includes('b'));
    perf.gates.b?.();
    await until(() => perf.entered.includes('cleanup'));
    perf.gates.cleanup?.();
    await reg.settled();
    const done = s.toObject();
    expect(done.status).toBe('completed');
    expect(done.steps.map((x) => x.status)).toEqual(['done', 'done', 'done']);
    expect(done.elapsedMs).toBe(new Date(done.endedAt as string).getTime() - s.startedAt);
  });

  it('진행 중 시작 → datagen.run_in_progress/409 details {runId, type} · 두 종류 합쳐 하나', async () => {
    const s = reg.start('perf', { maxExponent: 5 });
    let err: unknown;
    try {
      reg.start('flow', { pps: 1000, durationSec: 30, bizPerSec: 0 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('datagen.run_in_progress');
    expect((err as ApiError).details).toEqual({ runId: s.runId, type: 'perf' });
    expect(flow.entered).toEqual([]);
    s.requestStop();
    await until(() => perf.entered.includes('cleanup'));
    // stopping도 진행 중이다
    expect(() => reg.start('flow', { pps: 1000, durationSec: 30, bizPerSec: 0 })).toThrow(ApiError);
    perf.gates.cleanup?.();
    await reg.settled();
  });

  it('중단: running → 202 stopping · stopping → 202 그대로 · 종결 → 200 그대로(멱등) · 모르는 runId → null(404)', async () => {
    const s = reg.start('perf', { maxExponent: 5 });
    await until(() => perf.entered.includes('a'));
    const r1 = reg.stop(s.runId);
    expect(r1?.httpStatus).toBe(202);
    expect(r1?.run.status).toBe('stopping');
    const r2 = reg.stop(s.runId);
    expect(r2?.httpStatus).toBe(202);
    expect(r2?.run.status).toBe('stopping');
    await until(() => perf.entered.includes('cleanup'));
    perf.gates.cleanup?.();
    await reg.settled();
    const r3 = reg.stop(s.runId);
    expect(r3?.httpStatus).toBe(200);
    expect(r3?.run.status).toBe('stopped');
    // 진행 중 단계 stopped · 미시작 skipped · cleanup done
    expect(r3?.run.steps.map((x) => x.status)).toEqual(['stopped', 'skipped', 'done']);
    expect(reg.stop('00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('단계 경계에서 받은 중단 — 진행 중 0개(끝난 단계 done 유지)', async () => {
    const s = reg.start('perf', { maxExponent: 5 });
    await until(() => perf.entered.includes('a'));
    // 취소 수단을 떼고(단계 끝 직전) 완료시킨 뒤 중단 — a는 done
    s.setCanceller(null);
    s.requestStop();
    perf.gates.a?.();
    await until(() => perf.entered.includes('cleanup'));
    perf.gates.cleanup?.();
    await reg.settled();
    expect(s.toObject().steps.map((x) => x.status)).toEqual(['done', 'skipped', 'done']);
    expect(s.status).toBe('stopped');
  });

  it('cleanup 진행 중 중단 → 202 running 그대로(무시) · 끝나면 completed', async () => {
    const s = reg.start('perf', { maxExponent: 5 });
    await until(() => perf.entered.includes('a'));
    perf.gates.a?.();
    await until(() => perf.entered.includes('b'));
    perf.gates.b?.();
    await until(() => perf.entered.includes('cleanup'));
    const r = reg.stop(s.runId);
    expect(r?.httpStatus).toBe(202);
    expect(r?.run.status).toBe('running');
    perf.gates.cleanup?.();
    await reg.settled();
    expect(s.status).toBe('completed');
  });

  it('보관 — 끝난 실행은 다음 시작 전까지 current · find · 새 시작이 버린다(옛 runId → null)', async () => {
    expect(reg.currentRun()).toBeNull();
    const s = reg.start('flow', { pps: 1000, durationSec: 30, bizPerSec: 0 });
    s.requestStop();
    await until(() => flow.entered.includes('cleanup'));
    flow.gates.cleanup?.();
    await reg.settled();
    expect(reg.currentRun()?.runId).toBe(s.runId);
    expect(reg.find(s.runId)?.status).toBe('stopped');
    const s2 = reg.start('perf', { maxExponent: 5 });
    expect(reg.currentRun()?.runId).toBe(s2.runId);
    expect(reg.find(s.runId)).toBeNull();
    s2.requestStop();
    await until(() => perf.entered.includes('cleanup'));
    perf.gates.cleanup?.();
    await reg.settled();
  });

  it('실행기 예외 → failed · error {code: 기존 코드 또는 null, message}', async () => {
    const boom: RunExecutor = {
      type: 'perf',
      steps: () => [{ key: 'a', label: 'A' }],
      execute: async (st) => {
        await st.runStep('a', async () => {
          throw new ApiError('common.postgres_unavailable', 'pg 불가');
        });
        return { status: 'completed', error: null };
      },
    };
    const r = new RunRegistry([boom]);
    const s = r.start('perf', { maxExponent: 5 });
    await r.settled();
    expect(s.status).toBe('failed');
    expect(s.error).toEqual({ code: 'common.postgres_unavailable', message: 'pg 불가' });
    expect(s.toObject().steps[0]?.status).toBe('failed');
  });

  it('계측 — gen_run_active 시작 1 · 종결 0 · gen_runs_total{type, status} 종결 때 1', async () => {
    const before = await metric('gen_runs_total', { type: 'flow', status: 'stopped' });
    const s = reg.start('flow', { pps: 1000, durationSec: 30, bizPerSec: 0 });
    expect(await metric('gen_run_active', { type: 'flow' })).toBe(1);
    s.requestStop();
    await until(() => flow.entered.includes('cleanup'));
    flow.gates.cleanup?.();
    await reg.settled();
    expect(await metric('gen_run_active', { type: 'flow' })).toBe(0);
    expect(await metric('gen_runs_total', { type: 'flow', status: 'stopped' })).toBe(before + 1);
  });
});

describe('표면 #2~#5 — 상태 코드 · 에러 봉투 · no-store', () => {
  const exec = new GateExecutor('perf');
  const flowExec = new GateExecutor('flow');
  const reg = new RunRegistry([exec, flowExec]);
  let app: NestFastifyApplication;
  const call = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({ method, url, ...(payload === undefined ? {} : { payload: payload as object }) });

  beforeAll(async () => {
    @Module({ controllers: [RunsController], providers: [{ provide: RUN_REGISTRY, useValue: reg }] })
    class ProbeModule {}
    app = await NestFactory.create<NestFastifyApplication>(ProbeModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('#3 기동 뒤 첫 시작 전 — 200 {run: null}', async () => {
    const r = await call('GET', '/api/v1/runs/current');
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.json()).toEqual({ run: null });
  });

  it('#2 검증 — 모르는 type · 값 집합 밖 · 모르는 키 → 400 common.validation_failed', async () => {
    for (const body of [
      { type: 'grid' },
      { type: 'perf', params: { maxExponent: 9 } },
      { type: 'flow', params: { pps: 1234 } },
      { type: 'flow', params: { rate: 1 } },
      {},
    ]) {
      const r = await call('POST', '/api/v1/runs', body);
      expect(r.statusCode).toBe(400);
      expect(ErrorEnvelope.parse(r.json()).error.code).toBe('common.validation_failed');
    }
  });

  let runId = '';
  it('#2 202 + 실행 객체 — 생략한 키는 기본값으로 채운다', async () => {
    const r = await call('POST', '/api/v1/runs', { type: 'flow' });
    expect(r.statusCode).toBe(202);
    expect(r.headers['cache-control']).toBe('no-store');
    const o = RunObject.parse(r.json());
    expect(o.status).toBe('running');
    expect(o.params).toEqual({ pps: 10000, durationSec: 60, bizPerSec: 1 });
    runId = o.runId;
  });

  it('#2 진행 중 → 409 에러 봉투 details {runId, type}', async () => {
    const r = await call('POST', '/api/v1/runs', { type: 'perf', params: { maxExponent: 5 } });
    expect(r.statusCode).toBe(409);
    const e = ErrorEnvelope.parse(r.json()).error;
    expect(e.code).toBe('datagen.run_in_progress');
    expect(e.details).toEqual({ runId, type: 'flow' });
  });

  it('#3 · #4 — 진행 중 실행', async () => {
    const c = RunCurrentBody.parse((await call('GET', '/api/v1/runs/current')).json());
    expect(c.run?.runId).toBe(runId);
    const one = await call('GET', `/api/v1/runs/${runId}`);
    expect(one.statusCode).toBe(200);
    expect(RunObject.parse(one.json()).runId).toBe(runId);
  });

  it('#4 · #5 — UUID 아님 400 · 메모리에 없음 404 common.not_found', async () => {
    expect((await call('GET', '/api/v1/runs/nope')).statusCode).toBe(400);
    expect((await call('POST', '/api/v1/runs/nope/stop')).statusCode).toBe(400);
    const miss = '00000000-0000-4000-8000-000000000000';
    const g = await call('GET', `/api/v1/runs/${miss}`);
    expect(g.statusCode).toBe(404);
    expect(ErrorEnvelope.parse(g.json()).error.code).toBe('common.not_found');
    expect((await call('POST', `/api/v1/runs/${miss}/stop`)).statusCode).toBe(404);
  });

  it('#5 202 stopping → 종결 뒤 200 그대로', async () => {
    await until(() => flowExec.entered.includes('a'));
    const r = await call('POST', `/api/v1/runs/${runId}/stop`);
    expect(r.statusCode).toBe(202);
    expect(RunObject.parse(r.json()).status).toBe('stopping');
    await until(() => flowExec.entered.includes('cleanup'));
    flowExec.gates.cleanup?.();
    await reg.settled();
    const again = await call('POST', `/api/v1/runs/${runId}/stop`);
    expect(again.statusCode).toBe(200);
    expect(RunObject.parse(again.json()).status).toBe('stopped');
    const c = RunCurrentBody.parse((await call('GET', '/api/v1/runs/current')).json());
    expect(c.run?.status).toBe('stopped');
  });
});
