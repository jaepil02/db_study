import { describe, expect, it } from 'vitest';
import { entryTimestamps, StreamEntryV1 } from '../src/stream-entry';

const ok = {
  v: 1,
  d: 7,
  s: 42,
  t0: 1_790_246_876_123,
  tg: [1, 2, 3],
  dt: [0, 5, 10],
  va: [1.5, 2, -3],
  q: [9, 9, 9],
};

describe('Stream 엔트리 계약 v1', () => {
  it('정상 엔트리를 받는다', () => {
    expect(StreamEntryV1.safeParse(ok).success).toBe(true);
    expect(entryTimestamps(ok)).toEqual([1_790_246_876_123, 1_790_246_876_128, 1_790_246_876_133]);
  });

  it('빈 배열 엔트리(DROPOUT으로 전부 생략)는 받는다', () => {
    expect(StreamEntryV1.safeParse({ ...ok, tg: [], dt: [], va: [], q: [] }).success).toBe(true);
  });

  it.each([
    ['v 없음', { ...ok, v: undefined }],
    ['v=2', { ...ok, v: 2 }],
    ['배열 길이 불일치', { ...ok, va: [1, 2] }],
    ['음수 dt', { ...ok, dt: [0, -1, 3] }],
    ['t0가 최솟값이 아님', { ...ok, dt: [1, 5, 10] }],
    ['NaN 값', { ...ok, va: [1, Number.NaN, 2] }],
    ['품질 3(BAD_TIMEOUT)은 행이 없다', { ...ok, q: [9, 3, 9] }],
    ['품질 5(STALE)는 조회 시점 판정', { ...ok, q: [9, 5, 9] }],
    ['모르는 필드', { ...ok, x: 1 }],
    ['음수 설비', { ...ok, d: -1 }],
  ])('%s → 거절', (_name, entry) => {
    expect(StreamEntryV1.safeParse(entry).success).toBe(false);
  });
});
