// 설비 가동 스위치(D-16) — 실행 중 켜고 끄기 · 기동 기본값 SENSOR_AUTOGEN · health run.sensorAutogen 실효값
// 이름 정본 docs/09_tech_stack/04_local_environment.md §환경변수 · 표면 정본 docs/07_api(설비 가동)
// SIM · 모드 A · 수집기를 실제 루프백 소켓 위에서 함께 세우고 PlantRuntime이 켜고 끈다 — 켜면 포트 → 레지스터 갱신 → 폴링 → 발행까지 한 프로세스 안에서 돈다.
// 설비 가동 상태(ctl:plant:power)는 가짜 — 읽기 결과를 시험이 정한다(PlantPowerService 자체는 plant-power.test).
import { EventEmitter } from 'node:events';
import { connect, createServer } from 'node:net';
import { decodeEntry, RunInfo } from '@db-study/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import type { SwitchRegistry } from '../src/common/ports/switch-registry';
import type { Postgres } from '../src/common/postgres/postgres.module';
import type { RedisConnections } from '../src/common/redis/connections';
import { type AppRole, loadConfig } from '../src/config/app-config';
import { buildDeviceDefs, type DeviceDef } from '../src/modules/collector/collect-definition';
import type { CollectDefinitionService } from '../src/modules/collector/collect-definition.service';
import { CollectorService } from '../src/modules/collector/collector.service';
import { PassthroughFilter } from '../src/modules/collector/deadband-filter';
import { DevicePoller } from '../src/modules/collector/device-poller';
import type { PointBufferPort } from '../src/modules/collector/point-buffer.port';
import { ModeAService } from '../src/modules/datagen/mode-a/mode-a.service';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { HealthService } from '../src/modules/metrics/health.service';
import type { PlantPowerService } from '../src/modules/plant/plant-power.service';
import { PlantRuntime } from '../src/modules/plant/plant-runtime.service';
import { PlcSimService } from '../src/modules/plc-sim/plc-sim.service';

const SCAN_MS = 50;

const tags: TagMeta[] = [0, 2, 10].map((address, i) => ({
  tagId: 201 + i,
  deviceId: 9,
  tagCode: `P${i}`,
  tagName: `P${i}`,
  functionCode: 3,
  address,
  dataType: 'FLOAT32',
  wordOrder: 'ABCD',
  scale: 1,
  offsetValue: 0,
  unit: '',
  deadband: 0,
  scanRateMs: SCAN_MS,
  rangeMin: null,
  rangeMax: null,
  isActive: true,
}));

function defFor(port: number): DeviceDef {
  const [def] = buildDeviceDefs(
    [
      {
        deviceId: 9,
        deviceCode: 'DEV-009',
        host: '127.0.0.1',
        port,
        unitId: 1,
        timeoutMs: 1000,
        retryCount: 0,
        maxRegsPerRequest: 125,
      },
    ],
    tags,
    () => {},
  );
  if (!def) throw new Error('정의 없음');
  return def;
}

/** 비어 있는 루프백 포트 — 잡았다 바로 놓는다 */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      const port = typeof a === 'object' && a ? a.port : 0;
      s.close(() => resolve(port));
    });
  });
}

/** 그 포트에 누가 듣고 있는가 */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const c = connect({ host: '127.0.0.1', port });
    c.once('connect', () => {
      c.destroy();
      resolve(true);
    });
    c.once('error', () => resolve(false));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const waitFor = async (cond: () => boolean, ms = 5000) => {
  const until = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > until) throw new Error('시간 초과');
    await sleep(10);
  }
};

/** SIM · 모드 A · 수집기 · 적용기를 한 수집 정의 위에 세운다 — 수집 정의 · 구독 연결 · 발행 · 설비 가동 상태는 가짜(호출 수를 센다) */
function rig(autogen: 'on' | 'off', defs: DeviceDef[]) {
  const cfg = loadConfig({ WORKER_POOL_SIZE: '1', SENSOR_AUTOGEN: autogen });
  const calls = {
    whenLoaded: 0,
    refresh: 0,
    devicesOfKeys: 0,
    loadDevices: 0,
    activeDeviceIds: 0,
    subscriber: 0,
    reset: 0,
  };
  const definitions = {
    whenLoaded: async () => {
      calls.whenLoaded += 1;
      return defs;
    },
    refresh: async () => {
      calls.refresh += 1;
      return defs;
    },
    devicesOfKeys: async () => {
      calls.devicesOfKeys += 1;
      return defs.map((d) => d.deviceId);
    },
    loadDevices: async (ids: number[]) => {
      calls.loadDevices += 1;
      return new Map(ids.map((id) => [id, defs.find((d) => d.deviceId === id) ?? null]));
    },
    activeDeviceIds: async () => {
      calls.activeDeviceIds += 1;
      return defs.map((d) => d.deviceId);
    },
  } as unknown as CollectDefinitionService;
  const sub = Object.assign(new EventEmitter(), {
    status: 'ready',
    subscribe: async () => 1,
    unsubscribe: async () => 1,
  });
  const redis = {
    ready: async () => undefined,
    subscriberConnection: () => {
      calls.subscriber += 1;
      return sub;
    },
  } as unknown as RedisConnections;
  const published: Buffer[] = [];
  const buffer: PointBufferPort = {
    async publish(p) {
      published.push(p);
      return { backlog: null };
    },
  };
  /** 키 상태 — null이면 키 없음(기동 기본값) · 'fail'이면 읽기 실패 */
  const key: { v: boolean | null | 'fail' } = { v: null };
  const power = {
    defaultOn: () => autogen === 'on',
    isOn: async () => {
      if (key.v === 'fail') throw new Error('Redis 접속 불가');
      return key.v ?? autogen === 'on';
    },
    resetToDefault: async () => {
      calls.reset += 1;
      key.v = null;
    },
  } as unknown as PlantPowerService;
  const sim = new PlcSimService(definitions, cfg);
  const modeA = new ModeAService(sim, cfg);
  const collector = new CollectorService(definitions, buffer, new PassthroughFilter(), redis);
  const runtime = new PlantRuntime(power, definitions, sim, modeA, collector, redis);
  sim.onModuleInit();
  sim.onApplicationBootstrap();
  return {
    calls,
    key,
    sub,
    sim,
    modeA,
    collector,
    runtime,
    published,
    async destroy() {
      await runtime.onModuleDestroy();
      await collector.onModuleDestroy();
      modeA.onModuleDestroy();
      await sim.onModuleDestroy();
    },
  };
}

describe('설비 가동 스위치 — 실행 중 켜고 끄기', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  it('기동 기본값 꺼짐(SENSOR_AUTOGEN=off · 키 없음) — SIM 포트 0 · 모드 A 틱 없음 · 폴러 0 · 수집 정의를 기다리지도 구독하지도 않는다', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    cleanups.push(r.destroy);
    await r.runtime.reconcile();
    await sleep(SCAN_MS * 4);
    expect(r.runtime.running()).toBe(false);
    expect(r.sim.serverCount()).toBe(0);
    expect(await listening(port)).toBe(false);
    expect(r.modeA.ticking()).toBe(false);
    expect(r.collector.pollerCount()).toBe(0);
    expect(r.calls.whenLoaded + r.calls.refresh).toBe(0);
    expect(r.calls.subscriber).toBe(0);
    expect(r.published).toHaveLength(0);
  });

  it('기동은 키를 지우고 기동 기본값부터 — 앞 기동이 남긴 켜짐을 따르지 않는다', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    cleanups.push(r.destroy);
    r.key.v = true; // 앞 기동에서 켜 두고 재기동한 상황
    r.runtime.onApplicationBootstrap();
    await waitFor(() => r.calls.reset === 1);
    await sleep(SCAN_MS * 4);
    expect(r.runtime.running()).toBe(false);
    expect(r.sim.serverCount()).toBe(0);
  });

  it('켜면 SIM 포트 → 모드 A 레지스터 갱신 → 폴러 발행(SIMULATED 9) · ch:cacheinv 구독 · 신호에 설비 재로드', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    cleanups.push(r.destroy);
    r.key.v = true;
    await r.runtime.reconcile();
    await waitFor(() => r.published.length >= 2);
    expect(r.runtime.running()).toBe(true);
    expect(r.sim.serverCount()).toBe(1);
    expect(await listening(port)).toBe(true);
    expect(r.modeA.ticking()).toBe(true);
    expect(r.collector.pollerCount()).toBe(1);
    expect(r.calls.whenLoaded).toBe(1); // 처음 켤 때는 기동 로드 사본
    expect(r.calls.subscriber).toBe(1);
    const e = decodeEntry(r.published[0] as Buffer);
    expect(e.tg).toEqual([201, 202, 203]);
    expect(e.q).toEqual([9, 9, 9]);
    r.sub.emit('message', 'ch:cacheinv', JSON.stringify(['cache:tagmeta:201']));
    await waitFor(() => r.calls.loadDevices >= 1);
    const n = r.published.length;
    await waitFor(() => r.published.length >= n + 2);
    expect(r.collector.pollerCount()).toBe(1);
  });

  it('끄면 폴링 → 틱 → 포트 순으로 멈추고 · 다시 켜면 수집 정의를 다시 읽고 scan_seq를 이어 센다', async () => {
    const port = await freePort();
    const r = rig('on', [defFor(port)]);
    cleanups.push(r.destroy);
    await r.runtime.reconcile();
    await waitFor(() => r.published.length >= 3);
    r.key.v = false;
    await r.runtime.reconcile();
    expect(r.runtime.running()).toBe(false);
    expect(r.collector.pollerCount()).toBe(0);
    expect(r.modeA.ticking()).toBe(false);
    expect(r.sim.serverCount()).toBe(0);
    expect(await listening(port)).toBe(false);
    const lastSeq = decodeEntry(r.published.at(-1) as Buffer).s;
    const n = r.published.length;
    await sleep(SCAN_MS * 4);
    expect(r.published).toHaveLength(n); // 꺼진 동안 발행 없음
    // 꺼진 동안 온 마스터 변경 신호는 빈손이다(폴러가 되살아나지 않는다)
    r.sub.emit('message', 'ch:cacheinv', JSON.stringify(['cache:tagmeta:201']));
    await sleep(SCAN_MS * 2);
    expect(r.collector.pollerCount()).toBe(0);
    r.key.v = true;
    await r.runtime.reconcile();
    await waitFor(() => r.published.length >= n + 2);
    expect(r.calls.refresh).toBe(1);
    expect(r.sim.serverCount()).toBe(1);
    expect(decodeEntry(r.published[n] as Buffer).s).toBeGreaterThan(lastSeq);
  });

  it('겹친 전환 — 동시에 두 번 맞춰도 한 번만 켠다 · 읽기 실패는 지금 상태를 유지한다', async () => {
    const port = await freePort();
    const r = rig('on', [defFor(port)]);
    cleanups.push(r.destroy);
    await Promise.all([r.runtime.reconcile(), r.runtime.reconcile(), r.runtime.reconcile()]);
    expect(r.calls.whenLoaded).toBe(1);
    expect(r.sim.serverCount()).toBe(1);
    expect(r.collector.pollerCount()).toBe(1);
    r.key.v = 'fail';
    await r.runtime.reconcile();
    expect(r.runtime.running()).toBe(true);
    expect(r.collector.pollerCount()).toBe(1);
  });

  it('세 서비스의 start · stop은 각자 멱등 — 두 번 켜고 두 번 꺼도 포트 · 폴러가 겹치지 않는다', async () => {
    const port = await freePort();
    const defs = [defFor(port)];
    const r = rig('off', defs);
    cleanups.push(r.destroy);
    await Promise.all([r.sim.start(defs), r.sim.start(defs)]);
    r.modeA.start(defs);
    r.modeA.start(defs);
    await Promise.all([r.collector.start(defs), r.collector.start(defs)]);
    expect(r.sim.serverCount()).toBe(1);
    expect(r.collector.pollerCount()).toBe(1);
    await Promise.all([r.collector.stop(), r.collector.stop()]);
    r.modeA.stop();
    r.modeA.stop();
    await Promise.all([r.sim.stop(), r.sim.stop()]);
    expect(r.sim.serverCount()).toBe(0);
    expect(r.collector.pollerCount()).toBe(0);
    expect(r.modeA.ticking()).toBe(false);
  });
});

describe('health run.sensorAutogen — 실행 중 실효값(이 프로세스가 지금 센서 데이터를 만드는가)', () => {
  /** 저장소 셋이 모두 up인 가짜 위의 health — 이 시험은 run 칸만 본다(스위치 레지스트리는 메트릭 등록을 피해 가짜) */
  function healthOf(role: AppRole, gate: 'on' | 'off', runtime?: { running(): boolean }) {
    const cfg = loadConfig({ WORKER_POOL_SIZE: '1', APP_ROLE: role, SENSOR_AUTOGEN: gate });
    const pg = { pool: { query: async () => ({ rows: [] }) } } as unknown as Postgres;
    const ch = { client: { query: async () => ({ json: async () => [] }) } } as unknown as ClickHouse;
    const redis = { command: { ping: async () => 'PONG' } } as unknown as RedisConnections;
    const switches = { snapshot: () => ({}) } as unknown as SwitchRegistry;
    return new HealthService(cfg, pg, ch, redis, switches, runtime as PlantRuntime | undefined);
  }

  // 적용기(PlantRuntime)는 수집기 역할(all · collector)에만 있다 — 없으면 기동 기본값이 on이어도 off
  it.each([
    ['all', 'on', true, 'on'],
    ['all', 'on', false, 'off'],
    ['all', 'off', true, 'on'], // 기본값 꺼짐이어도 스위치로 켰으면 on
    ['collector', 'off', false, 'off'],
    ['collector', 'on', true, 'on'],
    ['api', 'on', null, 'off'],
    ['worker', 'on', null, 'off'],
  ] as const)('APP_ROLE=%s · SENSOR_AUTOGEN=%s · 적용 %s → %s', async (role, gate, running, want) => {
    const runtime = running === null ? undefined : { running: () => running };
    const { httpStatus, body } = await healthOf(role, gate, runtime).check();
    expect(httpStatus).toBe(200);
    expect(body.run.sensorAutogen).toBe(want);
    expect(RunInfo.safeParse(body.run).success).toBe(true); // run 계약(4요소 넷 + sensorAutogen)
  });
});

describe('설비 가동 켜기가 중간에 실패하면 되돌린다(r5 L7)', () => {
  it('폴러 시작이 던지면 포트 · 틱 · 폴러가 남지 않고 · 다음 맞추기에서 다시 켠다', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    const spy = vi.spyOn(DevicePoller.prototype, 'start').mockImplementationOnce(() => {
      throw new Error('폴러 시작 실패');
    });
    try {
      r.key.v = true;
      await r.runtime.reconcile();
      expect(r.runtime.running()).toBe(false);
      expect(r.collector.pollerCount()).toBe(0);
      expect(r.modeA.ticking()).toBe(false);
      expect(r.sim.serverCount()).toBe(0);
      expect(await listening(port)).toBe(false);
      // 다음 읽기가 다시 맞춘다 — 이번에는 켜진다
      await r.runtime.reconcile();
      await waitFor(() => r.published.length >= 1);
      expect(r.runtime.running()).toBe(true);
      expect(r.collector.pollerCount()).toBe(1);
      r.key.v = false;
      await r.runtime.reconcile();
      expect(r.collector.pollerCount()).toBe(0);
    } finally {
      spy.mockRestore();
      await r.destroy();
    }
  });
});
