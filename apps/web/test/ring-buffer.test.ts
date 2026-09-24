import { describe, expect, it } from 'vitest';
import { TagRingBuffer } from '../lib/ring-buffer';

describe('TagRingBuffer', () => {
  it('ts 오름차순만 붙이고 마지막 ts 이하는 버린다', () => {
    const b = new TagRingBuffer(4);
    expect(b.push(10, 1)).toBe(true);
    expect(b.push(10, 2)).toBe(false);
    expect(b.push(5, 3)).toBe(false);
    expect(b.push(11, 4)).toBe(true);
    const [ts, v] = b.views();
    expect([...ts]).toEqual([10, 11]);
    expect([...v]).toEqual([1, 4]);
  });

  it('용량을 넘으면 가장 오래된 점부터 밀어내고 순서를 유지한다(당기기 포함)', () => {
    const b = new TagRingBuffer(3);
    for (let i = 1; i <= 10; i++) b.push(i, i * 10);
    const [ts, v] = b.views();
    expect([...ts]).toEqual([8, 9, 10]);
    expect([...v]).toEqual([80, 90, 100]);
    expect(b.length).toBe(3);
  });

  it('뷰는 저장소를 복사하지 않는다(같은 버퍼 공유)', () => {
    const b = new TagRingBuffer(3);
    b.push(1, 1);
    const [a] = b.views();
    const [c] = b.views();
    expect(a.buffer).toBe(c.buffer);
  });

  it('과거 채움은 첫 ts보다 앞선 점만 앞에 붙인다', () => {
    const b = new TagRingBuffer(5);
    b.push(100, 1);
    b.push(101, 2);
    const added = b.prepend([98, 99, 100, 101, 102], [8, 9, 0, 0, 0]);
    expect(added).toBe(2);
    expect([...b.views()[0]]).toEqual([98, 99, 100, 101]);
    expect([...b.views()[1]]).toEqual([8, 9, 1, 2]);
  });

  it('과거 채움이 용량을 넘으면 가장 오래된 과거부터 버린다', () => {
    const b = new TagRingBuffer(3);
    b.push(100, 1);
    b.prepend([1, 2, 3, 4], [1, 2, 3, 4]);
    expect([...b.views()[0]]).toEqual([3, 4, 100]);
    b.push(101, 5);
    expect([...b.views()[0]]).toEqual([4, 100, 101]);
  });

  it('빈 버퍼에 과거 채움', () => {
    const b = new TagRingBuffer(3);
    expect(b.prepend([1, 2], [5, 6])).toBe(2);
    expect(b.push(2, 0)).toBe(false);
    expect(b.push(3, 7)).toBe(true);
    expect([...b.views()[1]]).toEqual([5, 6, 7]);
  });
});
