// 설비 폴링 루프 — 실제 루프백 소켓 위에서 발행 · 타임아웃 · XADD 실패 · 재기동 경로
import { createServer, type Server } from 'node:net';
import { decodeEntry, StreamEntryV1 } from '@db-study/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { appRegistry } from '../src/common/metrics/registry';
import { buildDeviceDefs } from '../src/modules/collector/collect-definition';
import { DevicePoller } from '../src/modules/collector/device-poller';
import type { PointBufferPort } from '../src/modules/collector/point-buffer.port';
import { type ModeATarget, writeTick } from '../src/modules/datagen/mode-a/register-writer';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { DeviceSimServer } from '../src/modules/plc-sim/device-sim-server';

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

function defFor(port: number, timeoutMs = 1000) {
  const [def] = buildDeviceDefs(
    [
      {
        deviceId: 9,
        deviceCode: 'DEV-009',
        host: '127.0.0.1',
        port,
        unitId: 1,
        timeoutMs,
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

/** 카운터 값 합 — 레이블 일치분 */
async function metric(name: string, labels: Record<string, string> = {}): Promise<number> {
  const m = await appRegistry.getSingleMetric(name)?.get();
  const want = Object.entries(labels);
  return (m?.values ?? [])
    .filter((v) => want.every(([k, x]) => (v.labels as Record<string, unknown>)[k] === x))
    .reduce((n, v) => n + v.value, 0);
}

const waitFor = async (cond: () => boolean | Promise<boolean>, ms = 3000) => {
  const until = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > until) throw new Error('시간 초과');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('DevicePoller', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  it('사이클마다 엔트리 1 — s는 1부터 · 블록 둘(갭) · 스키마 통과 · 적체 보관', async () => {
    const sim = new DeviceSimServer(12);
    const port = await sim.listen(0);
    const targets: ModeATarget[] = tags.map((t) => ({ holding: sim.holding, tag: t, lastK: -1 }));
    writeTick(targets, Date.now());
    const published: Buffer[] = [];
    const buffer: PointBufferPort = {
      async publish(p) {
        published.push(p);
        return { backlog: { lag: 0, pending: published.length } };
      },
    };
    const def = defFor(port);
    expect(def.blocks.map((b) => [b.start, b.count])).toEqual([
      [0, 4],
      [10, 2],
    ]);
    const poller = new DevicePoller(def, buffer);
    poller.start();
    cleanups.push(async () => {
      await poller.stop();
      await sim.close();
    });
    await waitFor(() => published.length >= 3);
    const entries = published.map((p) => decodeEntry(p));
    expect(entries.map((e) => e.s).slice(0, 3)).toEqual([1, 2, 3]);
    for (const e of entries) {
      expect(StreamEntryV1.safeParse(e).success).toBe(true);
      expect(e.tg).toEqual([201, 202, 203]);
      expect(e.q).toEqual([9, 9, 9]);
    }
    expect(poller.lastBacklog?.pending).toBeGreaterThanOrEqual(3);
    expect(await metric('points_emitted', { device: '9' })).toBeGreaterThanOrEqual(9);
  });

  it('응답이 없으면 타임아웃 — 발행 없음 · 계수 · 루프는 계속 돈다', async () => {
    // 접속은 받고 응답하지 않는 서버 — SIM 지연 주입(S3)과 같은 모양
    const silent: Server = createServer((s) => s.on('data', () => {}));
    await new Promise<void>((r) => silent.listen(0, '127.0.0.1', () => r()));
    const addr = silent.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    let publishes = 0;
    const poller = new DevicePoller(defFor(port, 30), {
      async publish() {
        publishes += 1;
        return { backlog: null };
      },
    });
    poller.start();
    cleanups.push(async () => {
      await poller.stop();
      await new Promise<void>((r) => silent.close(() => r()));
    });
    await waitFor(async () => (await metric('col_poll_timeouts_total', { device: '9' })) >= 2);
    expect(publishes).toBe(0);
    expect(await metric('col_polls_total', { device: '9' })).toBeGreaterThanOrEqual(2);
  });

  it('XADD 실패 — 던지지 않고 그 엔트리만 버리고 다음 사이클은 새 s로 발행', async () => {
    const sim = new DeviceSimServer(12);
    const port = await sim.listen(0);
    const seen: number[] = [];
    let calls = 0;
    const poller = new DevicePoller(defFor(port), {
      async publish(p) {
        calls += 1;
        if (calls === 1) throw new Error('OOM command not allowed');
        seen.push(decodeEntry(p).s);
        return { backlog: null };
      },
    });
    poller.start();
    cleanups.push(async () => {
      await poller.stop();
      await sim.close();
    });
    await waitFor(() => seen.length >= 2);
    expect(seen.slice(0, 2)).toEqual([2, 3]); // s=1은 버렸다 — 빈 번호로 드러난다
  });

  it('연결 실패(SIM 포트 없음)면 재기동을 반복하고 포트가 뜨면 붙는다', async () => {
    const probe = new DeviceSimServer(12);
    const port = await probe.listen(0);
    await probe.close(); // 비어 있는 포트 번호를 얻는다
    let publishes = 0;
    const poller = new DevicePoller(defFor(port), {
      async publish() {
        publishes += 1;
        return { backlog: null };
      },
    });
    poller.start();
    await new Promise((r) => setTimeout(r, 100));
    expect(publishes).toBe(0);
    const sim = new DeviceSimServer(12);
    await sim.listen(port);
    cleanups.push(async () => {
      await poller.stop();
      await sim.close();
    });
    await waitFor(() => publishes >= 1, 4000);
  });
});
