// flow 라이브 실행 — 발행 식(M3) · 시연 전용 행 prepare · 업무 명령 계수 · 백프레셔 · 중단 · drain(정본 06_pipeline/10 §흐름 시연 실행 · §시연 전용 행)
// 저장소 없이 가짜 포트 · 가짜 Stream · 가상 시계로 본다.
import { DEMO_FLOW, decodeEntry, QUALITY, RunObject, StreamEntryV1 } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/common/http/api-error';
import type { GroupBacklog } from '../src/common/redis/durable-key-client';
import { flowSecond } from '../src/common/workers/tasks';
import type { WorkerPool } from '../src/common/workers/worker-pool';
import type { BizWriteOutcome, BizWritePort, BizWriteRequest } from '../src/modules/biz/biz-contracts';
import { thresholdsFor } from '../src/modules/datagen/mode-b/backpressure-gate';
import { buildFlowSecond, type FlowTag, flowPoint } from '../src/modules/runs/flow-gen';
import {
  commandPlan,
  type DemoRows,
  demoDeviceName,
  type FlowClock,
  type FlowDeps,
  FlowRunExecutor,
} from '../src/modules/runs/flow-runner';
import { RunRegistry } from '../src/modules/runs/run-registry';
import { workerFlowEncoder } from '../src/modules/runs/runs.module';

const tagsOf = (devices: number, perDevice: number): FlowTag[] =>
  Array.from({ length: devices * perDevice }, (_, i) => ({
    deviceId: Math.floor(i / perDevice) + 1,
    tagId: i + 1,
  }));

describe('발행 식(M3) — (태그 · ts) 중복 없음 · 같은 설비 · 같은 ts 한 엔트리', () => {
  const T = tagsOf(50, 200); // 시드 형태 L = 10000
  const start = 1_790_000_000_000;

  const decoded = (pps: number, second: number, tags = T) =>
    buildFlowSecond({ tags, pps, second, secondStartMs: start + second * 1000 }).payloads.map((p) =>
      StreamEntryV1.parse(decodeEntry(p)),
    );

  it('pps = L — 초마다 태그 전부 한 번 · ts = 초 시작 · 엔트리 = 설비 수(09 예시 entriesSent 3000 = 60 × 50)', () => {
    const es = decoded(10000, 0);
    expect(es).toHaveLength(50);
    expect(es.every((e) => e.t0 === start && e.tg.length === 200)).toBe(true);
    expect(es.flatMap((e) => e.q).every((q) => q === QUALITY.SIMULATED)).toBe(true);
  });

  it('pps = 5L — 태그마다 ts 5개(200 ms 간격) · 중복 없음 · 엔트리 250', () => {
    const es = decoded(50000, 3);
    expect(es).toHaveLength(250);
    const seen = new Set<string>();
    for (const e of es) for (const t of e.tg) seen.add(`${t}:${e.t0}`);
    expect(seen.size).toBe(50000);
    expect(new Set(es.map((e) => e.t0 - (start + 3000)))).toEqual(new Set([0, 200, 400, 600, 800]));
  });

  it('pps < L — 초마다 T를 이어 돈다(s × pps 오프셋) · 엔트리 = 닿은 설비', () => {
    const e0 = decoded(1000, 0);
    const e1 = decoded(1000, 1);
    expect(e0).toHaveLength(5);
    expect(e0[0]?.tg[0]).toBe(1);
    expect(e1[0]?.tg[0]).toBe(1001);
    expect(flowPoint(0, 10, 1000, 10000).idx).toBe(0); // 10초 뒤 한 바퀴
  });

  it('pps가 L의 배수가 아니어도 (태그 · ts) 중복 없음', () => {
    const tags = tagsOf(3, 7); // L = 21
    for (const pps of [5, 21, 50, 1000]) {
      const es = decoded(pps, 2, tags);
      const keys = es.flatMap((e) => e.tg.map((t) => `${t}:${e.t0}`));
      expect(new Set(keys).size).toBe(pps);
      const byDevTs = es.map((e) => `${e.d}:${e.t0}`);
      expect(new Set(byDevTs).size).toBe(byDevTs.length);
      expect(es.every((e) => e.t0 >= start + 2000 && e.t0 < start + 3000)).toBe(true);
    }
  });
});

describe('명령 계획 — 명령 1건 = 1 · commandsSent = durationSec × bizPerSec의 정수 부분', () => {
  it('간격 1 ÷ bizPerSec초', () => {
    expect(commandPlan(60, 1)).toHaveLength(60);
    expect(commandPlan(30, 0.5)).toEqual(Array.from({ length: 15 }, (_, j) => j * 2000));
    expect(commandPlan(30, 2)).toHaveLength(60);
    expect(commandPlan(60, 0)).toEqual([]);
  });
  it('deviceName = "시연 설비 {runId 앞 8자}-{명령 번호}"', () => {
    expect(demoDeviceName('b0c9e4d1-58a2-4f37-8e0b-6a1d2c3e4f50', 3)).toBe('시연 설비 b0c9e4d1-3');
  });
});

// ── 실행기

class FakePort implements BizWritePort {
  readonly implName = 'StreamBizWriter' as const;
  reqs: BizWriteRequest[] = [];
  /** 시연 전용 행 상태(가짜 마스터) */
  demo: DemoRows = { siteId: null, lineId: null, deviceId: null, deviceActive: null };
  patchOutcome: (n: number) => BizWriteOutcome | Error = () => ({
    type: 'result',
    cmdId: null,
    httpStatus: 200,
    body: {},
  });
  createOutcome: BizWriteOutcome | null = null;
  private patches = 0;
  async submit(req: BizWriteRequest): Promise<BizWriteOutcome> {
    this.reqs.push(req);
    if (this.createOutcome && req.kind.endsWith('.create')) return this.createOutcome;
    const ok = (body: unknown, httpStatus = 201): BizWriteOutcome => ({
      type: 'result',
      cmdId: null,
      httpStatus,
      body,
    });
    switch (req.kind) {
      case 'master.site.create':
        this.demo.siteId = 7;
        return ok({ siteId: 7 });
      case 'master.line.create':
        this.demo.lineId = 8;
        return ok({ lineId: 8 });
      case 'master.device.create':
        this.demo.deviceId = 9;
        this.demo.deviceActive = true;
        return ok({ deviceId: 9 });
      case 'master.device.patch': {
        if ((req.body as { isActive?: boolean }).isActive === false) {
          this.demo.deviceActive = false;
          return ok({}, 200);
        }
        this.patches += 1;
        const o = this.patchOutcome(this.patches);
        if (o instanceof Error) throw o;
        return o;
      }
      default:
        throw new Error(`예상 밖 명령 ${req.kind}`);
    }
  }
}

/** 가상 시계 — 잠은 즉시 시각을 옮긴다 */
class VirtualClock implements FlowClock {
  now = 1_790_000_000_300;
  nowMs() {
    return this.now;
  }
  async sleepUntil(t: number, abort: Promise<void>) {
    let aborted = false;
    void abort.then(() => {
      aborted = true;
    });
    await new Promise((r) => setImmediate(r));
    if (!aborted) this.now = Math.max(this.now, t);
  }
}

interface Rig {
  port: FakePort;
  xadds: Buffer[][];
  backlogs: (GroupBacklog | null)[];
  deps: FlowDeps;
  clock: VirtualClock;
  onSecond?: (s: number) => void;
}

function rig(tags: FlowTag[] = tagsOf(2, 5)): Rig {
  const port = new FakePort();
  const r: Rig = {
    port,
    xadds: [],
    backlogs: [],
    clock: new VirtualClock(),
    deps: null as unknown as FlowDeps,
  };
  let seconds = 0;
  r.deps = {
    loadTags: async () => tags,
    findDemo: async () => ({ ...port.demo }),
    port,
    backlog: async () => r.backlogs.shift() ?? { lag: 0, pending: 0 },
    xaddBatch: async (payloads) => {
      r.onSecond?.(seconds++);
      r.xadds.push([...payloads]);
      return {
        results: payloads.map((_, i) => `1-${i}`),
        backlog: r.backlogs.shift() ?? { lag: 0, pending: 0 },
      };
    },
    thresholds: () => thresholdsFor(50_000),
    encode: async (t) => buildFlowSecond(t),
  };
  return r;
}

async function runFlow(
  r: Rig,
  params: { pps: number; durationSec: number; bizPerSec: number },
  drainLimitMs = 30_000,
) {
  const reg = new RunRegistry([new FlowRunExecutor(r.deps, r.clock, drainLimitMs)]);
  const s = reg.start('flow', params);
  return { reg, s, done: reg.settled().then(() => RunObject.parse(s.toObject())) };
}

describe('flow 실행기 — prepare(시연 전용 행) · publish · drain', () => {
  it('완료 — 시연 전용 행 없으면 명령 4로 생성(계수 제외) · 명령 전부 DEMO-FLOW-DEV · actor null · 결과 8', async () => {
    const r = rig();
    const { done } = await runFlow(r, { pps: 10, durationSec: 5, bizPerSec: 1 });
    const o = await done;
    expect(o.status).toBe('completed');
    expect(o.steps.map((x) => x.status)).toEqual(['done', 'done', 'done']);
    expect(o.steps[0]?.detail).toEqual({ devices: 2, tags: 10 });
    const kinds = r.port.reqs.map((q) => q.kind);
    expect(kinds.slice(0, 4)).toEqual([
      'master.site.create',
      'master.line.create',
      'master.device.create',
      'master.device.patch',
    ]);
    expect(r.port.reqs[0]?.body).toEqual({ siteCode: DEMO_FLOW.siteCode, siteName: '시연 사이트' });
    expect(r.port.reqs[1]?.body).toMatchObject({ siteId: 7, lineCode: DEMO_FLOW.lineCode });
    expect(r.port.reqs[2]?.body).toMatchObject({
      lineId: 8,
      deviceCode: DEMO_FLOW.deviceCode,
      modbusConfig: { host: '127.0.0.1' },
    });
    expect(r.port.reqs[3]).toMatchObject({ params: { id: 9 }, body: { isActive: false } });
    const pub = r.port.reqs.slice(4);
    expect(pub).toHaveLength(5);
    expect(pub.every((q) => q.kind === 'master.device.patch' && q.params.id === 9 && q.actor === null)).toBe(
      true,
    );
    expect(pub.map((q) => (q.body as { deviceName: string }).deviceName)).toEqual(
      [1, 2, 3, 4, 5].map((n) => demoDeviceName(o.runId, n)),
    );
    expect(o.result).toEqual({
      pointsSent: 50,
      entriesSent: r.xadds.flat().length,
      commandsSent: 5,
      commandsOk: 5,
      commandsPending: 0,
      commandsFailed: 0,
      backpressurePauses: 0,
      drainMs: 0,
    });
    expect(o.steps[1]?.detail).toMatchObject({ commandsSent: 5, progress: 1 });
    expect(o.steps[2]?.detail).toEqual({ drainMs: 0, timedOut: false });
  });

  it('시연 전용 행이 있으면 재사용 — 생성 명령 없음 · 명령 결과 ok · pending · failed 계수', async () => {
    const r = rig();
    r.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    r.port.patchOutcome = (n) =>
      n === 2
        ? { type: 'accepted', cmdId: 'c', status: 'pending' }
        : n === 3
          ? new ApiError('common.postgres_unavailable', 'x')
          : { type: 'result', cmdId: null, httpStatus: 200, body: {} };
    const o = await (await runFlow(r, { pps: 10, durationSec: 4, bizPerSec: 1 })).done;
    expect(r.port.reqs.every((q) => q.kind === 'master.device.patch' && q.params.id === 9)).toBe(true);
    expect(o.result).toMatchObject({ commandsSent: 4, commandsOk: 2, commandsPending: 1, commandsFailed: 1 });
  });

  it('bizPerSec 0 → 명령 없음 · 0.5 → durationSec × 0.5', async () => {
    const r0 = rig();
    r0.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    expect((await (await runFlow(r0, { pps: 10, durationSec: 3, bizPerSec: 0 })).done).result).toMatchObject({
      commandsSent: 0,
    });
    expect(r0.port.reqs).toHaveLength(0);
    const r1 = rig();
    r1.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    expect(
      (await (await runFlow(r1, { pps: 10, durationSec: 4, bizPerSec: 0.5 })).done).result,
    ).toMatchObject({
      commandsSent: 2,
    });
  });

  it('prepare 생성 명령이 대기 상한 초과(202) → failed · 뒤 단계 skipped', async () => {
    const r = rig();
    r.port.createOutcome = { type: 'accepted', cmdId: 'c', status: 'pending' };
    const o = await (await runFlow(r, { pps: 10, durationSec: 3, bizPerSec: 1 })).done;
    expect(o.status).toBe('failed');
    expect(o.error?.code).toBeNull();
    expect(o.steps.map((x) => x.status)).toEqual(['failed', 'skipped', 'skipped']);
  });

  it('prepare 중 중단 → 보낸 명령 결과까지 기다린 뒤 prepare stopped · publish · drain skipped', async () => {
    const r = rig();
    let reg: RunRegistry | null = null;
    let id = '';
    const origin = r.port.submit.bind(r.port);
    r.port.submit = async (req) => {
      const out = await origin(req);
      if (req.kind === 'master.site.create') reg?.stop(id);
      return out;
    };
    const run = await runFlow(r, { pps: 10, durationSec: 3, bizPerSec: 1 });
    reg = run.reg;
    id = run.s.runId;
    const o = await run.done;
    expect(o.status).toBe('stopped');
    expect(o.steps.map((x) => x.status)).toEqual(['stopped', 'skipped', 'skipped']);
    expect(r.port.reqs.map((q) => q.kind)).toEqual(['master.site.create']);
  });

  it('publish 중 중단 → 발행 · 명령 정지 · publish stopped · drain skipped · 그때까지 계수', async () => {
    const r = rig();
    r.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    const run = await runFlow(r, { pps: 10, durationSec: 30, bizPerSec: 1 });
    r.onSecond = (s) => {
      if (s === 2) run.reg.stop(run.s.runId);
    };
    const o = await run.done;
    expect(o.status).toBe('stopped');
    expect(o.steps.map((x) => x.status)).toEqual(['done', 'stopped', 'skipped']);
    expect(r.xadds).toHaveLength(3);
    const res = o.result as { commandsSent: number; commandsOk: number; pointsSent: number };
    expect(res.commandsSent).toBeLessThan(30);
    expect(res.commandsOk).toBe(res.commandsSent);
    expect(res.pointsSent).toBe(30);
  });

  it('백프레셔 — 위험이면 발행을 멈추고 주의 임계 아래에서 잇는다 · 정지 수 = 정지 구간 수', async () => {
    const r = rig();
    r.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    const t = thresholdsFor(50_000);
    // prepare 시작 적체 · 1초 발행 뒤 위험 · 정지 중 확인 1회 위험 유지 · 다음 확인 주의 아래 → 재개
    r.backlogs = [
      { lag: 0, pending: 0 },
      { lag: t.danger + 1, pending: 0 },
      { lag: t.danger, pending: 0 },
      { lag: 0, pending: 0 },
    ];
    const o = await (await runFlow(r, { pps: 10, durationSec: 5, bizPerSec: 0 })).done;
    expect(o.result).toMatchObject({ backpressurePauses: 1, pointsSent: 30 });
    expect(r.xadds).toHaveLength(3);
  });

  it('drain — 적체가 시작 수준으로 돌아오지 않으면 상한에서 done + timedOut true(실패 아님)', async () => {
    const r = rig();
    r.port.demo = { siteId: 7, lineId: 8, deviceId: 9, deviceActive: false };
    r.deps.xaddBatch = async (p) => ({ results: p.map(() => '1-0'), backlog: { lag: 5, pending: 0 } });
    // 시작 적체 0 · 발행 뒤 5에 머문다 — 시작 수준 이하로 돌아오지 않는다
    let first = true;
    r.deps.backlog = async () => {
      if (first) {
        first = false;
        return { lag: 0, pending: 0 };
      }
      return { lag: 5, pending: 0 };
    };
    const o = await (await runFlow(r, { pps: 10, durationSec: 2, bizPerSec: 0 }, 1000)).done;
    expect(o.status).toBe('completed');
    expect(o.steps[2]).toMatchObject({ status: 'done', detail: { timedOut: true } });
    expect((o.result as { drainMs: number }).drainMs).toBeGreaterThanOrEqual(1000);
  });

  it('시드 활성 태그가 없으면 prepare failed', async () => {
    const r = rig([]);
    const o = await (await runFlow(r, { pps: 10, durationSec: 2, bizPerSec: 0 })).done;
    expect(o.status).toBe('failed');
    expect(o.error?.message).toContain('시드 활성 태그');
  });
});

describe('worker_threads 경로 — piscina 작업 flowSecond', () => {
  it('tasks.ts가 flowSecond를 내보낸다 · 인코더가 구조적 복제된 Uint8Array를 Buffer로 되돌린다', async () => {
    expect(flowSecond).toBe(buildFlowSecond);
    let called: string | undefined;
    const fakePool = {
      run: async (task: Parameters<typeof buildFlowSecond>[0], name?: string) => {
        called = name;
        const r = buildFlowSecond(task);
        // 워커 경계를 넘으면 Buffer가 Uint8Array로 온다
        return { ...r, payloads: r.payloads.map((b) => new Uint8Array(b)) };
      },
    } as unknown as WorkerPool;
    const out = await workerFlowEncoder(fakePool)({
      tags: tagsOf(2, 5),
      pps: 10,
      second: 0,
      secondStartMs: 1_790_000_000_000,
    });
    expect(called).toBe('flowSecond');
    expect(out.payloads.every((p) => Buffer.isBuffer(p))).toBe(true);
    expect(StreamEntryV1.parse(decodeEntry(out.payloads[0] as Buffer)).tg).toHaveLength(5);
  });
});
