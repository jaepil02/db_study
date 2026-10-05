// SENSOR_AUTOGEN 게이트 — off면 SIM 포트 0 · 모드 A 틱 없음 · 수집기 폴러 0(마스터 변경 신호 · 재연결이 와도) · on이면 지금과 같다
// 판정 .omc/plans/sensor-autogen-switch.md §1 · 이름 정본 docs/09_tech_stack/04_local_environment.md §환경변수
// 세 서비스를 실제 루프백 소켓 위에서 함께 띄운다 — on이면 포트 → 레지스터 갱신 → 폴링 → 발행까지 한 프로세스 안에서 돈다.
// health run.sensorAutogen은 실효값(게이트 × 역할) — 수집기가 없는 역할(api · worker)은 게이트가 on이어도 off(07_api/10).
import { EventEmitter } from 'node:events';
import { connect, createServer } from 'node:net';
import { decodeEntry, RunInfo } from '@db-study/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import type { SwitchRegistry } from '../src/common/ports/switch-registry';
import type { Postgres } from '../src/common/postgres/postgres.module';
import type { RedisConnections } from '../src/common/redis/connections';
import { type AppRole, loadConfig } from '../src/config/app-config';
import { buildDeviceDefs, type DeviceDef } from '../src/modules/collector/collect-definition';
import type { CollectDefinitionService } from '../src/modules/collector/collect-definition.service';
import { CollectorService } from '../src/modules/collector/collector.service';
import { PassthroughFilter } from '../src/modules/collector/deadband-filter';
import type { PointBufferPort } from '../src/modules/collector/point-buffer.port';
import { ModeAService } from '../src/modules/datagen/mode-a/mode-a.service';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { HealthService } from '../src/modules/metrics/health.service';
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

/** SIM · 모드 A · 수집기를 한 수집 정의 위에 세운다 — 수집 정의 · 구독 연결 · 발행은 가짜(호출 수를 센다) */
function rig(autogen: 'on' | 'off', defs: DeviceDef[]) {
  const cfg = loadConfig({ WORKER_POOL_SIZE: '1', SENSOR_AUTOGEN: autogen });
  const calls = { whenLoaded: 0, devicesOfKeys: 0, loadDevices: 0, activeDeviceIds: 0, subscriber: 0 };
  const definitions = {
    whenLoaded: async () => {
      calls.whenLoaded += 1;
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
  const sim = new PlcSimService(definitions, cfg);
  const modeA = new ModeAService(definitions, sim, cfg);
  const collector = new CollectorService(definitions, buffer, new PassthroughFilter(), redis, cfg);
  return {
    calls,
    sub,
    sim,
    modeA,
    collector,
    published,
    /** Nest 기동 순서 그대로 — 모듈 초기화 → 기동 완료 훅(SIM → 모드 A → 수집기 · app.module 등록 순) */
    boot() {
      sim.onModuleInit();
      sim.onApplicationBootstrap();
      modeA.onApplicationBootstrap();
      collector.onApplicationBootstrap();
    },
    async destroy() {
      await collector.onModuleDestroy();
      modeA.onModuleDestroy();
      await sim.onModuleDestroy();
    },
  };
}

describe('SENSOR_AUTOGEN 게이트', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  it('off — SIM 포트를 열지 않고 · 모드 A 틱 없음 · 폴러 0 · 수집 정의를 읽지도 ch:cacheinv를 구독하지도 않는다', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    cleanups.push(r.destroy);
    r.boot();
    await sleep(SCAN_MS * 4);
    expect(r.sim.serverCount()).toBe(0);
    expect(await listening(port)).toBe(false);
    await expect(r.sim.whenStarted()).resolves.toBeUndefined(); // 기다리는 쪽이 매달리지 않는다
    expect(r.modeA.ticking()).toBe(false);
    expect(r.collector.pollerCount()).toBe(0);
    expect(r.calls.whenLoaded).toBe(0);
    expect(r.calls.subscriber).toBe(0);
    expect(r.published).toHaveLength(0);
  });

  it('off — 마스터 변경 신호 · 재연결이 와도 폴러가 생기지 않는다(재로드 · 전수 대조 경로가 없다)', async () => {
    const port = await freePort();
    const r = rig('off', [defFor(port)]);
    cleanups.push(r.destroy);
    r.boot();
    r.sub.emit('message', 'ch:cacheinv', JSON.stringify(['tagmeta:201', 'devlist:1']));
    r.sub.emit('ready');
    r.sub.emit('ready');
    await sleep(SCAN_MS * 4);
    expect(r.calls.devicesOfKeys + r.calls.loadDevices + r.calls.activeDeviceIds).toBe(0);
    expect(r.collector.pollerCount()).toBe(0);
    expect(r.published).toHaveLength(0);
  });

  it('on — 지금과 같다: SIM 포트 → 모드 A 레지스터 갱신 → 폴러 발행(SIMULATED 9) · ch:cacheinv 구독 · 신호에 설비 재로드', async () => {
    const port = await freePort();
    const r = rig('on', [defFor(port)]);
    cleanups.push(r.destroy);
    r.boot();
    await waitFor(() => r.published.length >= 2);
    expect(r.sim.serverCount()).toBe(1);
    expect(await listening(port)).toBe(true);
    expect(r.modeA.ticking()).toBe(true);
    expect(r.collector.pollerCount()).toBe(1);
    expect(r.calls.subscriber).toBe(1);
    const e = decodeEntry(r.published[0] as Buffer);
    expect(e.tg).toEqual([201, 202, 203]);
    expect(e.q).toEqual([9, 9, 9]);
    // 마스터 변경 신호 → 키의 설비만 다시 읽어 같은 자리에 폴러를 다시 띄운다
    r.sub.emit('message', 'ch:cacheinv', JSON.stringify(['tagmeta:201']));
    await waitFor(() => r.calls.loadDevices >= 1);
    const n = r.published.length;
    await waitFor(() => r.published.length >= n + 2);
    expect(r.collector.pollerCount()).toBe(1);
  });
});

describe('health run.sensorAutogen — 실효값(게이트 × 역할)', () => {
  /** 저장소 셋이 모두 up인 가짜 위의 health — 이 시험은 run 칸만 본다(스위치 레지스트리는 메트릭 등록을 피해 가짜) */
  function healthOf(role: AppRole, gate: 'on' | 'off') {
    const cfg = loadConfig({ WORKER_POOL_SIZE: '1', APP_ROLE: role, SENSOR_AUTOGEN: gate });
    const pg = { pool: { query: async () => ({ rows: [] }) } } as unknown as Postgres;
    const ch = { client: { query: async () => ({ json: async () => [] }) } } as unknown as ClickHouse;
    const redis = { command: { ping: async () => 'PONG' } } as unknown as RedisConnections;
    const switches = { snapshot: () => ({}) } as unknown as SwitchRegistry;
    return new HealthService(cfg, pg, ch, redis, switches);
  }

  // health를 내는 역할(MetricsModule이 있는 all · collector · api · worker) × 게이트 — datagen 역할은 표면이 없다
  it.each([
    ['all', 'on', 'on'],
    ['all', 'off', 'off'],
    ['collector', 'on', 'on'],
    ['collector', 'off', 'off'],
    ['api', 'on', 'off'],
    ['api', 'off', 'off'],
    ['worker', 'on', 'off'],
    ['worker', 'off', 'off'],
  ] as const)('APP_ROLE=%s · SENSOR_AUTOGEN=%s → run.sensorAutogen %s', async (role, gate, want) => {
    const { httpStatus, body } = await healthOf(role, gate).check();
    expect(httpStatus).toBe(200);
    expect(body.run.sensorAutogen).toBe(want);
    expect(RunInfo.safeParse(body.run).success).toBe(true); // run 계약(4요소 넷 + sensorAutogen)
  });
});
