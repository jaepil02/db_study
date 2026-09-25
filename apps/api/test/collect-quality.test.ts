// COL-05 품질 판정 트리 · COL-02 retry_count — 06_pipeline/02 §품질 판정 · §폴링과 레지스터 블록 병합(재시도 행)
import { decodeEntry, encodeEntry, QUALITY, StreamEntryV1 } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { buildDeviceDefs, type DeviceRow } from '../src/modules/collector/collect-definition';
import { encodeWords } from '../src/modules/collector/decode';
import { type Clock, type RegisterReader, runCycle } from '../src/modules/collector/poll-cycle';
import type { TagMeta } from '../src/modules/master/tag-meta';

function tag(tagId: number, address: number, over: Partial<TagMeta> = {}): TagMeta {
  return {
    tagId,
    deviceId: 1,
    tagCode: `T${tagId}`,
    tagName: `태그 ${tagId}`,
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
    ...over,
  };
}

const DEVICE: DeviceRow = {
  deviceId: 1,
  deviceCode: 'DEV-001',
  host: '127.0.0.1',
  port: 5020,
  unitId: 1,
  timeoutMs: 300,
  retryCount: 0,
  maxRegsPerRequest: 125,
};

const TIMEOUT = { name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' };
const exception = (code: number) =>
  Object.assign(new Error(`Modbus exception ${code}`), { modbusCode: code });

/** 가짜 시계 — 요청마다 elapse ms 전진(타임아웃이면 timeout_ms만큼) */
function harness(
  words: number[],
  script: (fc: number, start: number, n: number) => 'ok' | unknown,
  timeoutMs = DEVICE.timeoutMs,
) {
  const t = { now: 1_757_400_000_000 };
  const clock: Clock = { wallMs: () => t.now, monoMs: () => t.now };
  const calls: [number, number][] = [];
  const read = (fc: number) => async (start: number, n: number) => {
    calls.push([fc, start]);
    const r = script(fc, start, n);
    if (r === 'ok') {
      t.now += 1;
      return { data: words.slice(start, start + n) };
    }
    t.now += r === TIMEOUT ? timeoutMs : 1;
    throw r;
  };
  const reader: RegisterReader = { readHoldingRegisters: read(3), readInputRegisters: read(4) };
  return { clock, reader, calls, t };
}

function wordsWith(entries: [number, number][]): number[] {
  const w = new Array<number>(80).fill(0);
  for (const [addr, v] of entries)
    encodeWords(v, 'FLOAT32', 'ABCD').forEach((x, i) => {
      w[addr + i] = x;
    });
  return w;
}

function def(tags: TagMeta[], over: Partial<DeviceRow> = {}) {
  const [d] = buildDeviceDefs([{ ...DEVICE, ...over }], tags, () => {});
  const g = d?.groups[0];
  if (!d || !g) throw new Error('정의 없음');
  return { d, g };
}

describe('품질 판정 트리', () => {
  it('예외 응답은 블록 단위 — 그 블록 태그 전부 2 · 다른 블록은 정상 판정(9)', async () => {
    const { d, g } = def([tag(1, 0), tag(2, 2), tag(3, 40)]); // 블록 [0,4] · [40,2]
    const h = harness(
      wordsWith([
        [0, 1],
        [2, 2],
        [40, 3],
      ]),
      (_fc, start) => (start === 0 ? exception(2) : 'ok'),
    );
    const r = await runCycle(h.reader, d, g, h.clock);
    expect(r.kind).toBe('entry');
    if (r.kind !== 'entry') return;
    expect(r.entry.tg).toEqual([1, 2, 3]);
    expect(r.entry.q).toEqual([QUALITY.BAD_COMM, QUALITY.BAD_COMM, QUALITY.SIMULATED]);
    expect(r.entry.va).toEqual([0, 0, 3]);
    expect(r.exceptionBlocks).toBe(1);
    expect(StreamEntryV1.safeParse(decodeEntry(encodeEntry({ ...r.entry, s: 1 }))).success).toBe(true);
  });

  it('범위 밖이면 4 — 건강 코드가 출처 코드(9)보다 앞선다 · 경계값은 범위 안', async () => {
    const { d, g } = def([
      tag(1, 0, { rangeMin: 0, rangeMax: 100 }),
      tag(2, 2, { rangeMin: 0, rangeMax: 100 }),
      tag(3, 4, { rangeMin: 0, rangeMax: 100 }),
      tag(4, 6, { rangeMin: 0, rangeMax: 100, scale: 10 }), // raw 11 × 10 = 110 — 공학 단위로 판정
    ]);
    const h = harness(
      wordsWith([
        [0, 100],
        [2, 150],
        [4, -0.5],
        [6, 11],
      ]),
      () => 'ok',
    );
    const r = await runCycle(h.reader, d, g, h.clock);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(r.entry.q).toEqual([QUALITY.SIMULATED, QUALITY.BAD_RANGE, QUALITY.BAD_RANGE, QUALITY.BAD_RANGE]);
    expect(r.entry.va).toEqual([100, 150, -0.5, 110]); // 범위 밖 값도 그대로 싣는다
  });

  it('실설비(루프백 아님)의 정상 값은 0 · 범위 밖은 4', async () => {
    const { d, g } = def([tag(1, 0, { rangeMax: 10 }), tag(2, 2, { rangeMax: 10 })], { host: '10.0.0.5' });
    const h = harness(
      wordsWith([
        [0, 5],
        [2, 50],
      ]),
      () => 'ok',
    );
    const r = await runCycle(h.reader, d, g, h.clock);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(r.entry.q).toEqual([QUALITY.GOOD, QUALITY.BAD_RANGE]);
  });

  it('타임아웃은 행 없음 — 앞 블록을 읽었어도 그 그룹 그 주기 전체를 건너뛴다', async () => {
    const { d, g } = def([tag(1, 0), tag(2, 40)]);
    const h = harness(wordsWith([]), (_fc, start) => (start === 40 ? TIMEOUT : 'ok'));
    const r = await runCycle(h.reader, d, g, h.clock);
    expect(r.kind).toBe('timeout');
    expect(r.rtts.at(-1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('FC04 블록은 input 영역을 읽는다', async () => {
    const { d, g } = def([tag(1, 0, { functionCode: 4 }), tag(2, 0)]);
    const h = harness(wordsWith([[0, 7]]), () => 'ok');
    const r = await runCycle(h.reader, d, g, h.clock);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(h.calls).toEqual([
      [3, 0],
      [4, 0],
    ]);
    expect(r.entry.tg).toEqual([2, 1]);
  });
});

describe('retry_count — 같은 주기 안 · 남은 시간이 있을 때만', () => {
  it('재시도로 성공하면 정상 품질 · ts는 성공한 시도의 송신 직전 · t0는 첫 시도', async () => {
    // 주기 1000 · timeout 300 → 첫 시도 실패 뒤 남은 700 ≥ 300이라 재시도
    const { d, g } = def([tag(1, 0)], { retryCount: 2 });
    let n = 0;
    const h = harness(wordsWith([[0, 42]]), () => (n++ === 0 ? TIMEOUT : 'ok'));
    const start = h.t.now;
    const r = await runCycle(h.reader, d, g, h.clock);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(r.retries).toBe(1);
    expect(r.entry.q).toEqual([QUALITY.SIMULATED]); // UNCERTAIN을 달지 않는다
    expect(r.entry.t0).toBe(start);
    expect(r.entry.dt).toEqual([DEVICE.timeoutMs]);
    expect(r.rtts[0]).toBe(Number.POSITIVE_INFINITY);
  });

  it('retry_count 0이면 재시도하지 않는다', async () => {
    const { d, g } = def([tag(1, 0)], { retryCount: 0 });
    let n = 0;
    const h = harness(wordsWith([]), () => (n++ === 0 ? TIMEOUT : 'ok'));
    const r = await runCycle(h.reader, d, g, h.clock);
    expect(r.kind).toBe('timeout');
    expect(h.calls).toHaveLength(1);
  });

  it('retry_count까지만 — 3회 실패(1 + 재시도 2)면 포기', async () => {
    const { d, g } = def([tag(1, 0)], { retryCount: 2, timeoutMs: 100 });
    const h = harness(wordsWith([]), () => TIMEOUT, 100);
    const r = await runCycle(h.reader, d, g, h.clock);
    expect(r.kind).toBe('timeout');
    expect(r.retries).toBe(2);
    expect(h.calls).toHaveLength(3);
  });

  it('남은 시간이 timeout_ms보다 짧으면 retry_count가 남아도 포기(주기를 넘기지 않는다)', async () => {
    // 주기 1000 · timeout 600 → 첫 실패 뒤 남은 400 < 600
    const { d, g } = def([tag(1, 0)], { retryCount: 3, timeoutMs: 600 });
    const h = harness(wordsWith([]), () => TIMEOUT, 600);
    const r = await runCycle(h.reader, d, g, h.clock);
    expect(r.kind).toBe('timeout');
    expect(r.retries).toBe(0);
    expect(h.calls).toHaveLength(1);
  });

  it('예외 응답은 재시도하지 않는다 — 장비의 확정 답', async () => {
    const { d, g } = def([tag(1, 0)], { retryCount: 3 });
    const h = harness(wordsWith([]), () => exception(4));
    const r = await runCycle(h.reader, d, g, h.clock);
    if (r.kind !== 'entry') throw new Error(r.kind);
    expect(h.calls).toHaveLength(1);
    expect(r.entry.q).toEqual([QUALITY.BAD_COMM]);
  });
});
