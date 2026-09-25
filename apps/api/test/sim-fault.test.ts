// SIM 주입 계획(SIM-04 · 05) — 검증 규칙 4 · 시간 창 · 실제 루프백 소켓에서 delay · exception · FC04 응답
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CAPACITY_TIERS, QUALITY, SimFaultPlan } from '@db-study/shared';
import ModbusRTU from 'modbus-serial';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDeviceDefs } from '../src/modules/collector/collect-definition';
import { decodeRaw } from '../src/modules/collector/decode';
import { runCycle } from '../src/modules/collector/poll-cycle';
import { writeRegisters } from '../src/modules/datagen/mode-a/register-writer';
import type { TagMeta } from '../src/modules/master/tag-meta';
import { DeviceSimServer, MODBUS_EXCEPTION } from '../src/modules/plc-sim/device-sim-server';
import {
  assertPlanPorts,
  FaultSchedule,
  loadFaultPlan,
  type SimFault,
  SimFaultPlanRejectedError,
} from '../src/modules/plc-sim/fault-plan';
import { areaWords } from '../src/modules/plc-sim/plc-sim.service';

const delay = (over: Partial<SimFault> = {}): SimFault =>
  ({
    ports: { from: 5020, to: 5020 },
    registers: { start: 0, count: 10 },
    kind: 'delay',
    delayMs: 200,
    startOffsetMs: 0,
    durationMs: 1000,
    ...over,
  }) as SimFault;

const planText = (faults: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, note: '테스트', faults, ...extra });

describe('계획 검증 — 실패하면 기동 거부', () => {
  const load = (text: string) => loadFaultPlan('/x.json', () => text);

  it('정상 계획은 통과', () => {
    expect(load(planText([delay()])).faults).toHaveLength(1);
  });

  it('JSON이 아니면 거부', () => {
    expect(() => load('{')).toThrow(SimFaultPlanRejectedError);
  });

  it('스키마 — 모르는 필드 · 종류별 필수 값 없음 · 대역 밖 포트 · 겹침은 거부', () => {
    expect(() => load(planText([delay()], { extra: 1 }))).toThrow(SimFaultPlanRejectedError);
    expect(() => load(planText([{ ...delay(), delayMs: undefined }]))).toThrow(/delayMs/);
    expect(() => load(planText([{ ...delay(), kind: 'exception', delayMs: undefined }]))).toThrow(
      SimFaultPlanRejectedError,
    );
    expect(() => load(planText([delay({ ports: { from: 5019, to: 5020 } })]))).toThrow(/포트 범위/);
    expect(() =>
      load(planText([delay(), delay({ registers: { start: 5, count: 10 }, startOffsetMs: 500 })])),
    ).toThrow(/겹친다/);
  });

  it('시드된 설비 포트 밖이면 거부 — 범위 안 포트가 전부 SIM 포트여야 한다', () => {
    const plan = load(planText([delay({ ports: { from: 5020, to: 5022 } })]));
    expect(() => assertPlanPorts(plan, new Set([5020, 5021, 5022]))).not.toThrow();
    expect(() => assertPlanPorts(plan, new Set([5020, 5021]))).toThrow(/5022/);
  });

  it('예시 계획 infra/sim-plans/ac08-quality.json — 스키마 통과 · 티어 S 포트 안 · 예외 1 · 지연 1', () => {
    const path = resolve(__dirname, '../../../infra/sim-plans/ac08-quality.json');
    const plan = SimFaultPlan.parse(JSON.parse(readFileSync(path, 'utf8')));
    const tierS = new Set(Array.from({ length: CAPACITY_TIERS.S.devices }, (_, i) => 5020 + i));
    expect(() => assertPlanPorts(plan, tierS)).not.toThrow();
    expect(plan.faults.map((f) => f.kind).sort()).toEqual(['delay', 'exception']);
    const d = plan.faults.find((f) => f.kind === 'delay');
    expect(d?.kind === 'delay' && d.delayMs).toBeGreaterThan(3000); // 시드 timeout_ms 3000 초과
  });
});

describe('시간표 — 시작 오프셋 · 지속 시간 · 레지스터 범위(블록 단위)', () => {
  it('창 안에서만 · 포트 · 레지스터 범위가 겹칠 때만 걸린다', () => {
    const t = { now: 0 };
    const s = new FaultSchedule(
      [
        delay({ startOffsetMs: 100, durationMs: 50, registers: { start: 10, count: 5 } }),
        { ...delay({ ports: { from: 5021, to: 5021 } }), kind: 'exception', exceptionCode: 4 } as SimFault,
      ],
      1000,
      () => t.now,
    );
    t.now = 1099;
    expect(s.match(5020, 0, 20)).toBeNull();
    expect(s.activeKinds()).toEqual(new Set(['exception']));
    t.now = 1100;
    expect(s.match(5020, 0, 20)).toEqual({ kind: 'delay', delayMs: 200 });
    expect(s.match(5020, 14, 2)).toEqual({ kind: 'delay', delayMs: 200 }); // 요청 범위와 겹치면 요청 전체
    expect(s.match(5020, 15, 2)).toBeNull();
    expect(s.match(5020, 0, 10)).toBeNull();
    expect(s.match(5021, 0, 1)).toEqual({ kind: 'exception', exceptionCode: 4 });
    expect(s.activeKinds()).toEqual(new Set(['delay', 'exception']));
    t.now = 1150;
    expect(s.match(5020, 0, 20)).toBeNull();
  });
});

const TAGS: TagMeta[] = [0, 2].map((address, i) => ({
  tagId: 301 + i,
  deviceId: 31,
  tagCode: `F${i}`,
  tagName: `F${i}`,
  functionCode: 3,
  address,
  dataType: 'FLOAT32',
  wordOrder: 'ABCD',
  scale: 1,
  offsetValue: 0,
  unit: '',
  deadband: 0,
  scanRateMs: 1000,
  rangeMin: null,
  rangeMax: null,
  isActive: true,
}));

function def(port: number, timeoutMs: number, tags = TAGS) {
  const [d] = buildDeviceDefs(
    [
      {
        deviceId: 31,
        deviceCode: 'DEV-031',
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
  const g = d?.groups[0];
  if (!d || !g) throw new Error('정의 없음');
  return { d, g };
}

describe('주입 동작 — 실제 루프백 소켓(REQ-SIM-07)', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cleanups.splice(0)) await c();
  });

  async function start(active: { fault: ReturnType<FaultSchedule['match']> }, inputWords = 0) {
    const sim = new DeviceSimServer({ holdingWords: 4, inputWords, faultFor: () => active.fault });
    const port = await sim.listen(0);
    const client = new ModbusRTU();
    await client.connectTCP('127.0.0.1', { port });
    client.setID(1);
    cleanups.push(async () => {
      await new Promise<void>((r) => client.close(() => r()));
      await sim.close();
    });
    return { sim, port, client };
  }

  it('exception — 예외 코드 응답 → 블록 태그 전부 BAD_COMM(2) · 주입이 풀리면 다음 주기 정상', async () => {
    const active = { fault: { kind: 'exception', exceptionCode: 2 } as ReturnType<FaultSchedule['match']> };
    const { sim, port, client } = await start(active);
    for (const t of TAGS) writeRegisters(sim.holding, t, 12.5);
    client.setTimeout(500);
    await expect(client.readHoldingRegisters(0, 4)).rejects.toMatchObject({ modbusCode: 2 });
    const { d, g } = def(port, 500);
    const r = await runCycle(client, d, g);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(r.entry.q).toEqual([QUALITY.BAD_COMM, QUALITY.BAD_COMM]);
    active.fault = null;
    const ok = await runCycle(client, d, g);
    if (ok.kind !== 'entry') throw new Error(ok.kind);
    expect(ok.entry.q).toEqual([QUALITY.SIMULATED, QUALITY.SIMULATED]);
    expect(ok.entry.va).toEqual([12.5, 12.5]);
  });

  it('delay — 응답이 timeout_ms보다 늦으면 행 없음 · 늦은 응답은 다음 요청을 오염시키지 않는다', async () => {
    const active = { fault: { kind: 'delay', delayMs: 150 } as ReturnType<FaultSchedule['match']> };
    const { sim, port, client } = await start(active);
    for (const t of TAGS) writeRegisters(sim.holding, t, 3);
    client.setTimeout(50);
    const { d, g } = def(port, 50);
    const t0 = performance.now();
    const r = await runCycle(client, d, g);
    expect(r.kind).toBe('timeout');
    expect(performance.now() - t0).toBeLessThan(140); // SIM을 기다리지 않고 timeout_ms에서 끊는다
    active.fault = null;
    await new Promise((res) => setTimeout(res, 200)); // 늦은 응답이 도착한 뒤
    const ok = await runCycle(client, d, g);
    if (ok.kind !== 'entry') throw new Error(ok.kind);
    expect(ok.entry.va).toEqual([3, 3]);
  });

  it('delay가 timeout_ms 안이면 늦게라도 정상 행', async () => {
    const active = { fault: { kind: 'delay', delayMs: 30 } as ReturnType<FaultSchedule['match']> };
    const { port, client } = await start(active);
    client.setTimeout(500);
    const { d, g } = def(port, 500);
    const r = await runCycle(client, d, g);
    expect(r.kind).toBe('entry');
    expect(r.rtts[0]).toBeGreaterThanOrEqual(0.025);
  });

  it('FC04 — input 영역 응답 · 영역 밖 주소는 예외 2 · 125 초과 요청은 예외 3', async () => {
    const { sim, client } = await start({ fault: null }, 6);
    const t = { ...(TAGS[0] as TagMeta), functionCode: 4, dataType: 'FLOAT64', address: 2 };
    writeRegisters(sim.input, t, Math.PI);
    client.setTimeout(500);
    const { data } = await client.readInputRegisters(2, 4);
    expect(decodeRaw(data, 0, 'FLOAT64', 'ABCD')).toBe(Math.PI);
    await expect(client.readInputRegisters(4, 4)).rejects.toMatchObject({
      modbusCode: MODBUS_EXCEPTION.ILLEGAL_DATA_ADDRESS,
    });
    await expect(client.readHoldingRegisters(0, 126)).rejects.toMatchObject({
      modbusCode: MODBUS_EXCEPTION.ILLEGAL_DATA_VALUE,
    });
  });

  it('영역 크기 = function_code별 (address + 폭) 최댓값', () => {
    const [d] = buildDeviceDefs(
      [
        {
          deviceId: 1,
          deviceCode: 'D',
          host: '127.0.0.1',
          port: 5020,
          unitId: 1,
          timeoutMs: 1,
          retryCount: 0,
          maxRegsPerRequest: 125,
        },
      ],
      [
        { ...(TAGS[0] as TagMeta), deviceId: 1, address: 10 },
        { ...(TAGS[1] as TagMeta), deviceId: 1, address: 3, functionCode: 4, dataType: 'FLOAT64' },
      ],
      () => {},
    );
    if (!d) throw new Error('정의 없음');
    expect([areaWords(d, 3), areaWords(d, 4)]).toEqual([12, 7]);
  });
});
