import { decodeEntry, encodeEntry, QUALITY, StreamEntryV1 } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { buildDeviceDefs, type DeviceRow } from '../src/modules/collector/collect-definition';
import { decodeFloat32Abcd, isLoopbackHost, normalQuality, toEng } from '../src/modules/collector/decode';
import { type Clock, type RegisterReader, runCycle } from '../src/modules/collector/poll-cycle';
import { planBlocks } from '../src/modules/collector/request-blocks';
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
  timeoutMs: 3000,
  retryCount: 0,
  maxRegsPerRequest: 125,
};

describe('COL-04 디코딩 — FLOAT32 ABCD', () => {
  it('기지값 0x4291 0x999A → 72.8(06_pipeline/12 §1 · 2단계 예)', () => {
    expect(decodeFloat32Abcd(0x4291, 0x999a)).toBeCloseTo(72.8, 5);
  });

  it('eng = raw × scale + offset_value', () => {
    expect(toEng(72.8, 2, -5)).toBeCloseTo(140.6, 10);
  });
});

describe('COL-05 품질 — S2는 GOOD · SIMULATED만', () => {
  it('루프백(127.0.0.0/8 · ::1)이면 SIMULATED(9)', () => {
    for (const h of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackHost(h)).toBe(true);
      expect(normalQuality(h)).toBe(QUALITY.SIMULATED);
    }
  });

  it('그 밖은 GOOD(0)', () => {
    for (const h of ['10.0.0.5', '192.168.1.10', '128.0.0.1', '::2', 'fe80::1']) {
      expect(isLoopbackHost(h)).toBe(false);
      expect(normalQuality(h)).toBe(QUALITY.GOOD);
    }
  });
});

describe('요청 블록 분할', () => {
  const two = () => 2;

  it('연속 주소는 한 블록', () => {
    const b = planBlocks([tag(1, 0), tag(2, 2), tag(3, 4)], two, 125);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ start: 0, count: 6 });
    expect(b[0]?.tags.map((t) => t.offset)).toEqual([0, 2, 4]);
  });

  it('주소 오름차순으로 정렬한다', () => {
    const b = planBlocks([tag(3, 4), tag(1, 0), tag(2, 2)], two, 125);
    expect(b[0]?.tags.map((t) => t.tag.tagId)).toEqual([1, 2, 3]);
  });

  it('갭이 있으면 가른다(허용 갭 병합은 S3)', () => {
    const b = planBlocks([tag(1, 0), tag(2, 2), tag(3, 10)], two, 125);
    expect(b.map((x) => [x.start, x.count])).toEqual([
      [0, 4],
      [10, 2],
    ]);
  });

  it('125 레지스터 상한에서 자른다', () => {
    const tags = Array.from({ length: 100 }, (_, i) => tag(i + 1, i * 2)); // 200 레지스터 연속
    const b = planBlocks(tags, two, 125);
    expect(b.map((x) => [x.start, x.count])).toEqual([
      [0, 124],
      [124, 76],
    ]);
    expect(Math.max(...b.map((x) => x.count))).toBeLessThanOrEqual(125);
  });

  it('max_regs_per_request가 더 작으면 그것이 상한', () => {
    const b = planBlocks([tag(1, 0), tag(2, 2), tag(3, 4)], two, 4);
    expect(b.map((x) => x.count)).toEqual([4, 2]);
  });
});

describe('COL-01 수집 정의 — S2 범위 밖 태그 제외', () => {
  it('FLOAT32 ABCD FC03이 아니면 경고 후 제외', () => {
    const warns: string[] = [];
    const [d] = buildDeviceDefs(
      [DEVICE],
      [
        tag(1, 0),
        tag(2, 2, { wordOrder: 'CDAB' }),
        tag(3, 4, { dataType: 'INT16', wordOrder: null }),
        tag(4, 6, { functionCode: 4 }),
      ],
      (m) => warns.push(m),
    );
    expect(d?.tags.map((t) => t.tagId)).toEqual([1]);
    expect(warns).toHaveLength(3);
    expect(d?.simulated).toBe(true);
  });
});

/** 요청마다 시계를 1 ms씩 전진시키는 가짜 리더 — 레지스터 값은 주소 기반 */
function fakeReader(words: number[], clock: { t: number }): RegisterReader {
  return {
    async readHoldingRegisters(address, length) {
      clock.t += 1;
      return { data: words.slice(address, address + length) };
    },
  };
}

describe('COL-07 엔트리 — StreamEntryV1 발행자 스키마', () => {
  const clockState = { t: 1_757_400_000_123 };
  const clock: Clock = { wallMs: () => clockState.t, monoMs: () => clockState.t };

  it('블록 둘 — t0 = 첫 요청 송신 직전 · dt ≥ 0 · 스키마 통과', async () => {
    const words = new Array(20).fill(0);
    words[0] = 0x4291;
    words[1] = 0x999a; // 72.8
    words[10] = 0x3f80;
    words[11] = 0x0000; // 1.0
    const [def] = buildDeviceDefs([DEVICE], [tag(1, 0), tag(2, 10, { scale: 2, offsetValue: 1 })], () => {});
    if (!def) throw new Error('정의 없음');
    const start = clockState.t;
    const r = await runCycle(fakeReader(words, clockState), def, clock);
    expect(r.kind).toBe('entry');
    if (r.kind !== 'entry') return;
    expect(r.entry.t0).toBe(start);
    expect(r.entry.dt).toEqual([0, 1]); // 두 번째 블록은 첫 응답 뒤 송신
    expect(r.entry.va[0]).toBeCloseTo(72.8, 5);
    expect(r.entry.va[1]).toBe(3); // 1.0 × 2 + 1
    expect(r.entry.q).toEqual([QUALITY.SIMULATED, QUALITY.SIMULATED]);
    const decoded = decodeEntry(encodeEntry({ ...r.entry, s: 1 }));
    expect(StreamEntryV1.safeParse(decoded).success).toBe(true);
    expect(decoded.t0).toBe(Math.min(...decoded.dt.map((x) => decoded.t0 + x)));
  });

  it('타임아웃이면 엔트리 없음 · 왕복은 +Inf', async () => {
    const [def] = buildDeviceDefs([DEVICE], [tag(1, 0)], () => {});
    if (!def) throw new Error('정의 없음');
    const reader: RegisterReader = {
      async readHoldingRegisters() {
        // modbus-serial의 타임아웃은 Error가 아닌 평범한 객체다
        throw { name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' };
      },
    };
    const r = await runCycle(reader, def, clock);
    expect(r.kind).toBe('timeout');
    expect(r.rtts).toEqual([Number.POSITIVE_INFINITY]);
  });

  it('비유한 값이면 사이클을 발행하지 않는다', async () => {
    const [def] = buildDeviceDefs([DEVICE], [tag(1, 0)], () => {});
    if (!def) throw new Error('정의 없음');
    const r = await runCycle(fakeReader([0x7fc0, 0x0000], clockState), def, clock); // NaN
    expect(r.kind).toBe('nonfinite');
  });

  it('타임아웃이 아닌 오류는 던진다(루프 재기동)', async () => {
    const [def] = buildDeviceDefs([DEVICE], [tag(1, 0)], () => {});
    if (!def) throw new Error('정의 없음');
    const reader: RegisterReader = {
      async readHoldingRegisters() {
        throw new Error('Port Not Open');
      },
    };
    await expect(runCycle(reader, def, clock)).rejects.toThrow('Port Not Open');
  });
});
