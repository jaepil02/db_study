// COL-03 블록 병합 — 허용 갭 20 · 125 상한 · function_code 분리 · 스캔 그룹(06_pipeline/02 §폴링과 레지스터 블록 병합)
import { describe, expect, it } from 'vitest';
import { buildDeviceDefs, type DeviceRow, wordsOf } from '../src/modules/collector/collect-definition';
import { MAX_GAP_REGS, planBlocks } from '../src/modules/collector/request-blocks';
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

const spans = (b: { start: number; count: number }[]) => b.map((x) => [x.start, x.count]);

describe('허용 갭 병합', () => {
  it('허용 갭은 20 레지스터(현행 참고)', () => {
    expect(MAX_GAP_REGS).toBe(20);
  });

  it('갭 20 이하는 병합 — 안 쓰는 레지스터를 함께 읽는다', () => {
    // 0~1 · 갭 20(2~21) · 22~23
    const b = planBlocks([tag(1, 0), tag(2, 22)], wordsOf, 125);
    expect(spans(b)).toEqual([[0, 24]]);
    expect(b[0]?.tags.map((t) => t.offset)).toEqual([0, 22]);
  });

  it('갭 21이면 가른다', () => {
    expect(spans(planBlocks([tag(1, 0), tag(2, 23)], wordsOf, 125))).toEqual([
      [0, 2],
      [23, 2],
    ]);
  });

  it('갭을 넣으면 125를 넘는 경우 가른다 — 상한이 갭보다 앞선다', () => {
    // 0~119(60태그) 뒤 갭 5 → 125~126은 합치면 127 > 125
    const tags = [...Array.from({ length: 60 }, (_, i) => tag(i + 1, i * 2)), tag(99, 125)];
    const b = planBlocks(tags, wordsOf, 125);
    expect(spans(b)).toEqual([
      [0, 120],
      [125, 2],
    ]);
    expect(Math.max(...b.map((x) => x.count))).toBeLessThanOrEqual(125);
  });

  it('티어 M 모양(FLOAT32 200 · 갭 0) = 4요청(400워드 ÷ 125 올림)', () => {
    const tags = Array.from({ length: 200 }, (_, i) => tag(i + 1, i * 2));
    const b = planBlocks(tags, wordsOf, 125);
    expect(b).toHaveLength(4);
    expect(b.reduce((n, x) => n + x.count, 0)).toBe(400);
  });

  it('function_code가 다르면 주소가 붙어 있어도 다른 블록 — FC03 먼저 · 주소 오름차순', () => {
    const b = planBlocks(
      [tag(1, 4, { functionCode: 4 }), tag(2, 0), tag(3, 0, { functionCode: 4 }), tag(4, 2)],
      wordsOf,
      125,
    );
    expect(b.map((x) => [x.fc, x.start, x.count])).toEqual([
      [3, 0, 4],
      [4, 0, 6],
    ]);
  });

  it('FLOAT64는 4워드 · 16비트는 1워드 폭으로 병합한다', () => {
    const b = planBlocks(
      [
        tag(1, 0, { dataType: 'FLOAT64' }),
        tag(2, 4, { dataType: 'UINT16', wordOrder: null }),
        tag(3, 5, { dataType: 'INT32' }),
      ],
      wordsOf,
      125,
    );
    expect(spans(b)).toEqual([[0, 7]]);
    expect(b[0]?.tags.map((t) => t.offset)).toEqual([0, 4, 5]);
  });
});

describe('스캔 그룹 = 설비 × scan_rate_ms', () => {
  it('주기가 둘이면 그룹 둘 · 그룹마다 따로 병합 · 주기 오름차순', () => {
    const [d] = buildDeviceDefs(
      [DEVICE],
      [tag(1, 0), tag(2, 2, { scanRateMs: 100 }), tag(3, 4), tag(4, 6, { scanRateMs: 100, functionCode: 4 })],
      () => {},
    );
    expect(d?.groups.map((g) => g.scanRateMs)).toEqual([100, 1000]);
    expect(d?.groups[0]?.blocks.map((b) => [b.fc, b.start, b.count])).toEqual([
      [3, 2, 2],
      [4, 6, 2],
    ]);
    expect(d?.groups[1]?.blocks.map((b) => [b.fc, b.start, b.count])).toEqual([[3, 0, 6]]);
    expect(d?.tags).toHaveLength(4);
  });

  it('요청 상한보다 넓은 태그는 경고 후 제외(max_regs_per_request 3 < FLOAT64 4)', () => {
    const warns: string[] = [];
    const [d] = buildDeviceDefs(
      [{ ...DEVICE, maxRegsPerRequest: 3 }],
      [tag(1, 0, { dataType: 'FLOAT64' }), tag(2, 4)],
      (m) => warns.push(m),
    );
    expect(d?.tags.map((t) => t.tagId)).toEqual([2]);
    expect(warns).toHaveLength(1);
  });
});
