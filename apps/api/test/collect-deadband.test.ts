// SW-10 데드밴드 7항목(06_pipeline/02 §데드밴드) · 스캔 그룹 루프 — 실제 루프백 소켓 위 DevicePoller
import { decodeEntry, QUALITY } from '@db-study/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { appRegistry } from '../src/common/metrics/registry';
import { SwitchRegistry } from '../src/common/ports/switch-registry';
import { loadConfig } from '../src/config/app-config';
import { buildDeviceDefs } from '../src/modules/collector/collect-definition';
import { deadbandFilterFactory } from '../src/modules/collector/collector.module';
import { PassthroughFilter, TagDeadbandFilter } from '../src/modules/collector/deadband-filter';
import { applyDeadband, DevicePoller } from '../src/modules/collector/device-poller';
import type { PointBufferPort } from '../src/modules/collector/point-buffer.port';
import type { CycleEntry } from '../src/modules/collector/poll-cycle';
import { writeRegisters } from '../src/modules/datagen/mode-a/register-writer';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { DeviceSimServer } from '../src/modules/plc-sim/device-sim-server';

const S = QUALITY.SIMULATED;

describe('데드밴드 7항목', () => {
  it('① 판정식 abs(eng − 직전 전송값) < deadband면 생략 · 같으면(=) 전송', () => {
    const f = new TagDeadbandFilter();
    expect(f.admit(1, 10, S, 1)).toBe(true);
    expect(f.admit(1, 10.9, S, 1)).toBe(false);
    expect(f.admit(1, 9.1, S, 1)).toBe(false);
    expect(f.admit(1, 11, S, 1)).toBe(true); // |11 − 10| = 1 — 미만이 아니다
  });

  it('② 직전 전송값은 전송한 값만 — 느린 드리프트가 누적되면 결국 전송된다', () => {
    const f = new TagDeadbandFilter();
    const sent: number[] = [];
    for (let i = 0; i <= 10; i++) if (f.admit(1, i * 0.3, S, 1)) sent.push(i);
    // 생략 값으로 갱신했다면 0만 전송되고 끝났다
    expect(sent).toEqual([0, 4, 8]);
  });

  it('③ 품질이 직전과 다르면 변화량과 무관하게 전송 — 정상 → BAD · BAD → 정상', () => {
    const f = new TagDeadbandFilter();
    expect(f.admit(1, 50, S, 100)).toBe(true);
    expect(f.admit(1, 50, QUALITY.BAD_RANGE, 100)).toBe(true);
    expect(f.admit(1, 50, QUALITY.BAD_RANGE, 100)).toBe(false);
    expect(f.admit(1, 50, S, 100)).toBe(true);
  });

  it('④ 첫 값(직전 전송값 없음)은 전송 · 태그마다 따로', () => {
    const f = new TagDeadbandFilter();
    expect(f.admit(1, 0, S, 1e9)).toBe(true);
    expect(f.admit(2, 0, S, 1e9)).toBe(true);
    expect(f.admit(1, 0, S, 1e9)).toBe(false);
  });

  it('⑤ 기본 off = PassthroughFilter — 전부 전송 · SW-10 등록은 실제 주입 구현', () => {
    const p = new PassthroughFilter();
    for (let i = 0; i < 5; i++) expect(p.admit()).toBe(true);
    const off = loadConfig({ WORKER_POOL_SIZE: '1' });
    const reg = new SwitchRegistry(off);
    expect(deadbandFilterFactory(off, reg)).toBeInstanceOf(PassthroughFilter);
    expect(reg.snapshot()['SW-10']).toMatchObject({ value: 'off', impl: 'PassthroughFilter' });
  });

  it('⑤ SW-10 on이면 TagDeadbandFilter · deadband 0은 아무것도 생략하지 않는다', () => {
    const on = loadConfig({ WORKER_POOL_SIZE: '1', COLLECTOR_DEADBAND: 'on' });
    const f = deadbandFilterFactory(on, new SwitchRegistryStub() as unknown as SwitchRegistry);
    expect(f).toBeInstanceOf(TagDeadbandFilter);
    for (let i = 0; i < 5; i++) expect(f.admit(9, 1, S, 0)).toBe(true);
  });

  it('⑦ 엔트리 적용 — 생략 수를 돌려주고 t0 계약(min dt = 0)을 지킨다', () => {
    const f = new TagDeadbandFilter();
    const e: CycleEntry = { d: 1, t0: 1000, tg: [1, 2], dt: [0, 5], va: [1, 1], q: [S, S] };
    applyDeadband(e, () => 10, f);
    const r = applyDeadband({ ...e, va: [1, 50] }, () => 10, f);
    expect(r.skipped).toBe(1);
    expect(r.entry).toEqual({ d: 1, t0: 1005, tg: [2], dt: [0], va: [50], q: [S] });
  });
});

/** 레지스트리 등록만 흉내 — SwitchRegistry는 파일당 한 번만 만든다(게이지 이름 중복 등록 방지) */
class SwitchRegistryStub {
  register() {}
}

const waitFor = async (cond: () => boolean | Promise<boolean>, ms = 3000) => {
  const until = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > until) throw new Error('시간 초과');
    await new Promise((r) => setTimeout(r, 10));
  }
};

async function metric(name: string, labels: Record<string, string>): Promise<number> {
  const m = await appRegistry.getSingleMetric(name)?.get();
  return (m?.values ?? [])
    .filter((v) => Object.entries(labels).every(([k, x]) => (v.labels as Record<string, unknown>)[k] === x))
    .reduce((n, v) => n + v.value, 0);
}

function tagAt(tagId: number, address: number, scanRateMs: number, deadband = 0): TagMeta {
  return {
    tagId,
    deviceId: 21,
    tagCode: `D${tagId}`,
    tagName: `D${tagId}`,
    functionCode: 3,
    address,
    dataType: 'FLOAT32',
    wordOrder: 'ABCD',
    scale: 1,
    offsetValue: 0,
    unit: '',
    deadband,
    scanRateMs,
    rangeMin: null,
    rangeMax: null,
    isActive: true,
  };
}

function deviceDef(port: number, tags: TagMeta[], deviceId: number) {
  const [def] = buildDeviceDefs(
    [
      {
        deviceId,
        deviceCode: `DEV-${deviceId}`,
        host: '127.0.0.1',
        port,
        unitId: 1,
        timeoutMs: 500,
        retryCount: 0,
        maxRegsPerRequest: 125,
      },
    ],
    tags.map((t) => ({ ...t, deviceId })),
    () => {},
  );
  if (!def) throw new Error('정의 없음');
  return def;
}

describe('DevicePoller — 데드밴드 계수 · 스캔 그룹 루프', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  it('⑦ 변하지 않는 값 — 첫 사이클만 발행 · 생략분은 col_deadband_skipped_total{device} · points_emitted에 넣지 않는다', async () => {
    const sim = new DeviceSimServer(4);
    const port = await sim.listen(0);
    const tags = [tagAt(1, 0, 30, 0.5), tagAt(2, 2, 30, 0.5)];
    for (const t of tags) writeRegisters(sim.holding, t, 7);
    const published: Buffer[] = [];
    const buffer: PointBufferPort = {
      async publish(p) {
        published.push(p);
        return { backlog: null };
      },
    };
    const poller = new DevicePoller(
      deviceDef(port, tags, 21),
      buffer,
      undefined,
      null,
      new TagDeadbandFilter(),
    );
    poller.start();
    cleanups.push(async () => {
      await poller.stop();
      await sim.close();
    });
    await waitFor(async () => (await metric('col_deadband_skipped_total', { device: '21' })) >= 4);
    expect(published).toHaveLength(1);
    expect(await metric('points_emitted', { device: '21' })).toBe(2);
    // 값이 deadband 이상 바뀌면 그 태그만 다시 발행한다
    writeRegisters(sim.holding, tags[0] as TagMeta, 8);
    await waitFor(() => published.length >= 2);
    expect(decodeEntry(published[1] as Buffer).tg).toEqual([1]);
    expect(decodeEntry(published[1] as Buffer).s).toBe(2);
  });

  it('스캔 그룹 둘 — 연결 1 위에서 그룹마다 루프 · s는 설비 하나로 이어진다 · 짧은 주기가 더 자주', async () => {
    const sim = new DeviceSimServer(8);
    const port = await sim.listen(0);
    const tags = [tagAt(11, 0, 40), tagAt(12, 2, 40), tagAt(13, 4, 200)];
    const entries: { tg: number[]; s: number }[] = [];
    const poller = new DevicePoller(
      deviceDef(port, tags, 22),
      {
        async publish(p) {
          const e = decodeEntry(p);
          entries.push({ tg: e.tg, s: e.s });
          return { backlog: null };
        },
      },
      undefined,
      0.5,
    );
    poller.start();
    cleanups.push(async () => {
      await poller.stop();
      await sim.close();
    });
    await waitFor(() => entries.filter((e) => e.tg[0] === 13).length >= 2);
    const fast = entries.filter((e) => e.tg[0] === 11);
    const slow = entries.filter((e) => e.tg[0] === 13);
    expect(fast.length).toBeGreaterThan(slow.length);
    for (const e of fast) expect(e.tg).toEqual([11, 12]);
    for (const e of slow) expect(e.tg).toEqual([13]);
    expect(entries.map((e) => e.s)).toEqual(entries.map((_, i) => i + 1));
    expect(sim.accepted).toBe(1);
  });
});
