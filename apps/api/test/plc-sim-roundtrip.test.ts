// 실제 루프백 소켓 왕복 — PlcSim(jsmodbus) ← 모드 A 쓰기 · modbus-serial FC03 읽기 → Collector 사이클(REQ-SIM-07)
import { QUALITY } from '@db-study/shared';
import ModbusRTU from 'modbus-serial';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDeviceDefs } from '../src/modules/collector/collect-definition';
import { decodeFloat32Abcd, toEng } from '../src/modules/collector/decode';
import { runCycle } from '../src/modules/collector/poll-cycle';
import { makeTarget, writeTick } from '../src/modules/datagen/mode-a/register-writer';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { DeviceSimServer } from '../src/modules/plc-sim/device-sim-server';

const tags: TagMeta[] = Array.from({ length: 8 }, (_, i) => ({
  tagId: 101 + i,
  deviceId: 1,
  tagCode: `T${101 + i}`,
  tagName: `태그 ${101 + i}`,
  functionCode: 3,
  address: i * 2,
  dataType: 'FLOAT32',
  wordOrder: 'ABCD',
  scale: i === 7 ? 0.5 : 1,
  offsetValue: i === 7 ? 10 : 0,
  unit: '',
  deadband: 0,
  scanRateMs: 1000,
  rangeMin: null,
  rangeMax: null,
  isActive: true,
}));

describe('PlcSim ↔ Collector 루프백 왕복(FC03)', () => {
  const sim = new DeviceSimServer(16);
  const client = new ModbusRTU();
  let port = 0;

  beforeAll(async () => {
    port = await sim.listen(0);
    await client.connectTCP('127.0.0.1', { port });
    client.setID(1);
    client.setTimeout(1000);
  });

  afterAll(async () => {
    await new Promise<void>((r) => client.close(() => r()));
    await sim.close();
  });

  it('모드 A가 쓴 값 = FC03으로 읽어 디코딩한 값', async () => {
    const targets = tags.map((t) => makeTarget(sim.holding, t, 'SINE'));
    const now = 1_757_400_000_000;
    expect(writeTick(targets, now).written[0]).toBe(8);
    expect(writeTick(targets, now + 10).written[0]).toBe(0); // 같은 k면 다시 쓰지 않는다

    const { data } = await client.readHoldingRegisters(0, 16);
    for (const [i, t] of tags.entries()) {
      const expected = sim.holding.readFloatBE(t.address * 2);
      expect(decodeFloat32Abcd(data[i * 2] ?? 0, data[i * 2 + 1] ?? 0)).toBe(expected);
    }
  });

  it('Collector 사이클 — 엔지니어링 값이 모드 A 신호(float32 정밀도)와 같고 품질 9', async () => {
    const [def] = buildDeviceDefs(
      [
        {
          deviceId: 1,
          deviceCode: 'DEV-001',
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
    const targets = tags.map((t) => makeTarget(sim.holding, t, 'SINE'));
    writeTick(targets, Date.now());
    const g = def.groups[0];
    if (!g) throw new Error('그룹 없음');
    const r = await runCycle(client, def, g);
    expect(r.kind).toBe('entry');
    if (r.kind !== 'entry') return;
    expect(r.entry.tg).toEqual(tags.map((t) => t.tagId));
    for (const [i, t] of tags.entries()) {
      const raw = sim.holding.readFloatBE(t.address * 2);
      expect(r.entry.va[i]).toBe(toEng(raw, t.scale, t.offsetValue));
    }
    expect(r.entry.q.every((q) => q === QUALITY.SIMULATED)).toBe(true);
    expect(r.rtts).toHaveLength(1);
    expect(r.rtts[0]).toBeGreaterThanOrEqual(0);
  });

  it('이미 쓰는 포트에 바인드하면 거절(sim_listen_failed_ports의 원천)', async () => {
    const other = new DeviceSimServer(2);
    await expect(other.listen(port)).rejects.toThrow();
    await other.close();
  });
});
