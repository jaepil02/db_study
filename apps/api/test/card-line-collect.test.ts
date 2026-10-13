// 카드 라인 수집(D-16 결정 3) — 주기 100 · 200 · 1000 ms가 실제로 그 주기로 발행되는가 · 형식(UINT16 · UINT32 · FLOAT32) 왕복 · 통신 끊김 시연 계획
// 실제 루프백 소켓 위에서 설비 하나(칩 홈 가공 — 세 주기를 다 가진 공정)를 돌린다. 계획 파일 infra/sim-plans/card-line.json.
import { resolve } from 'node:path';
import { DEVICE_STATE_CODE, decodeEntry, QUALITY } from '@db-study/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { seedLayout } from '../src/db/seed-plan';
import {
  buildDeviceDefs,
  type CollectTag,
  type DeviceDef,
} from '../src/modules/collector/collect-definition';
import { DevicePoller } from '../src/modules/collector/device-poller';
import type { PointBufferPort } from '../src/modules/collector/point-buffer.port';
import { makeTarget, writeTick } from '../src/modules/datagen/mode-a/register-writer';
import { DeviceSimServer } from '../src/modules/plc-sim/device-sim-server';
import { assertPlanPorts, FaultSchedule, loadFaultPlan } from '../src/modules/plc-sim/fault-plan';
import { areaWords } from '../src/modules/plc-sim/plc-sim.service';

const layout = seedLayout({ kind: 'card-line' });
const seeded = layout.lines.flatMap((l) => l.devices);

/** 시드 설비 하나 → 수집 정의(device_id = 순번 + 1 · tag_id = 설비 × 100 + 순번) */
function cardDef(code: string, port: number): DeviceDef {
  const i = seeded.findIndex((d) => d.deviceCode === code);
  const d = seeded[i];
  if (!d) throw new Error(`설비 없음 ${code}`);
  const deviceId = i + 1;
  const tags: CollectTag[] = d.tags.map((t, j) => ({
    tagId: deviceId * 100 + j,
    deviceId,
    tagCode: t.tagCode,
    tagName: t.tagName,
    functionCode: 3,
    address: t.address,
    dataType: t.dataType,
    wordOrder: t.wordOrder,
    scale: 1,
    offsetValue: 0,
    unit: t.unit,
    deadband: 0,
    scanRateMs: t.scanRateMs,
    rangeMin: t.rangeMin,
    rangeMax: t.rangeMax,
    isActive: true,
    tagKind: t.tagKind,
  }));
  const [def] = buildDeviceDefs(
    [
      {
        deviceId,
        deviceCode: code,
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

describe('카드 라인 수집 — 주기 그대로 발행', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  it('칩 홈 가공(100 · 200 · 1000 ms 그룹) — 2초 동안 그룹별 엔트리 수가 주기대로 · 값은 형식 · 범위 안', async () => {
    const def0 = cardDef('L1-MIL', 0);
    const sim = new DeviceSimServer({ holdingWords: areaWords(def0, 3) });
    const port = await sim.listen(0);
    const def = { ...def0, port };
    expect(def.groups.map((g) => g.scanRateMs)).toEqual([100, 200, 1000]);
    const targets = def.tags.map((t) => makeTarget(sim.holding, t, 'SINE'));
    writeTick(targets, Date.now());
    const tick = setInterval(() => writeTick(targets, Date.now()), 50);
    const entries: ReturnType<typeof decodeEntry>[] = [];
    const buffer: PointBufferPort = {
      async publish(p) {
        entries.push(decodeEntry(p));
        return { backlog: null };
      },
    };
    const poller = new DevicePoller(def, buffer, undefined, 0.5);
    cleanups.push(async () => {
      clearInterval(tick);
      await poller.stop();
      await sim.close();
    });
    poller.start();
    await new Promise((r) => setTimeout(r, 400)); // 연결 · 첫 위상 맞춤
    const from = entries.length;
    await new Promise((r) => setTimeout(r, 2000));
    const window = entries.slice(from);
    const groupOf = (tg: readonly number[]) =>
      def.groups.find((g) => g.tags.some((t) => t.tagId === tg[0]))?.scanRateMs;
    const count = (ms: number) => window.filter((e) => groupOf(e.tg) === ms).length;
    // 2초 = 100 ms 20번 · 200 ms 10번 · 1000 ms 2번 — 타이머 지터 · 창 경계로 ±1~2
    expect(count(100)).toBeGreaterThanOrEqual(18);
    expect(count(100)).toBeLessThanOrEqual(21);
    expect(count(200)).toBeGreaterThanOrEqual(9);
    expect(count(200)).toBeLessThanOrEqual(11);
    expect(count(1000)).toBeGreaterThanOrEqual(1);
    expect(count(1000)).toBeLessThanOrEqual(3);
    // 1000 ms 그룹 = 가공 수(UINT32) · 운전 상태(UINT16) — 정수 · 상태 코드 0~2 · 품질 SIMULATED
    const slow = window.find((e) => groupOf(e.tg) === 1000);
    expect(slow).toBeDefined();
    const stateTag = def.tags.find((t) => t.tagKind === 'STATE');
    const countTag = def.tags.find((t) => t.tagKind === 'COUNT');
    const at = (id: number | undefined) => slow?.va[slow.tg.indexOf(id ?? -1)];
    expect(Object.values(DEVICE_STATE_CODE)).toContain(at(stateTag?.tagId));
    expect(Number.isInteger(at(countTag?.tagId))).toBe(true);
    expect(slow?.q.every((q) => q === QUALITY.SIMULATED)).toBe(true);
    // 진동(100 ms) — 범위 0~8 안이라 BAD_RANGE 없음
    expect(
      window.filter((e) => groupOf(e.tg) === 100).every((e) => e.q.every((q) => q === QUALITY.SIMULATED)),
    ).toBe(true);
  });
});

describe('통신 끊김 시연 계획(infra/sim-plans/card-line.json)', () => {
  const plan = loadFaultPlan(resolve(__dirname, '../../../infra/sim-plans/card-line.json'));

  it('스키마 통과 · 카드 라인 포트(5020~5049) 안 · 슬라이스 시드에서는 기동 거부', () => {
    expect(() => assertPlanPorts(plan, new Set(seeded.map((d) => d.port)))).not.toThrow();
    const slice = seedLayout({ kind: 'slice' }).lines.flatMap((l) => l.devices);
    expect(() => assertPlanPorts(plan, new Set(slice.map((d) => d.port)))).toThrow(/시드된 설비 포트 밖/);
  });

  it('지연 > 타임아웃(3000 ms) · 설비 레지스터 전부를 덮는다 · 한 번에 1대 · 30대를 다 돈다', () => {
    for (const f of plan.faults) {
      expect(f.kind).toBe('delay');
      if (f.kind === 'delay') expect(f.delayMs).toBeGreaterThan(3000);
      expect(f.ports.from).toBe(f.ports.to);
    }
    const maxWords = Math.max(
      ...seeded.map((d) =>
        d.tags.reduce((n, t) => Math.max(n, t.address + (t.dataType === 'UINT16' ? 1 : 2)), 0),
      ),
    );
    expect(plan.faults.every((f) => f.registers.start === 0 && f.registers.count >= maxWords)).toBe(true);
    const sorted = [...plan.faults].sort((a, b) => a.startOffsetMs - b.startOffsetMs);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (a && b) expect(b.startOffsetMs).toBeGreaterThanOrEqual(a.startOffsetMs + a.durationMs);
    }
    expect(new Set(plan.faults.map((f) => f.ports.from)).size).toBe(30);
  });

  it('시간표 — 켠 뒤 1분부터 20초 동안 첫 설비(5020)만 지연 · 그 뒤 풀린다', () => {
    let now = 0;
    const s = new FaultSchedule(plan.faults, 0, () => now);
    now = 59_999;
    expect(s.match(5020, 0, 9)).toBeNull();
    now = 60_000;
    expect(s.match(5020, 0, 9)).toEqual({ kind: 'delay', delayMs: 4000 });
    expect(s.match(5021, 0, 9)).toBeNull();
    now = 80_000;
    expect(s.match(5020, 0, 9)).toBeNull();
  });
});
