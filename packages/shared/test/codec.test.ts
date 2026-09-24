import { Packr } from 'msgpackr';
import { describe, expect, it } from 'vitest';
import { decodeEntry, encodeEntry, UnknownSchemaVersionError } from '../src/codec';
import { StreamEntryV1 } from '../src/stream-entry';

const input = {
  d: 7,
  s: 42,
  t0: 1_790_246_876_123,
  tg: new Uint32Array([1, 2, 3]),
  dt: new Int32Array([0, 5, 10]),
  va: new Float64Array([1.5, 2, -3.25]),
  q: new Uint8Array([9, 9, 9]),
};

describe('MessagePack 코덱 — 언어 중립 · 계약 왕복', () => {
  it('왕복 결과가 계약을 통과하고 값이 같다', () => {
    const e = decodeEntry(encodeEntry(input));
    expect(StreamEntryV1.parse(e)).toEqual({
      v: 1,
      d: 7,
      s: 42,
      t0: 1_790_246_876_123,
      tg: [1, 2, 3],
      dt: [0, 5, 10],
      va: [1.5, 2, -3.25],
      q: [9, 9, 9],
    });
  });

  it('와이어 — map(레코드 확장 없음) · 표준 배열(bin 아님) · t0는 정수 타입(float64 아님)', () => {
    const buf = encodeEntry(input);
    // 표준 map — msgpackr은 객체를 map16(0xde · 길이 2바이트)으로 쓴다. 레코드 확장(ext)이면 첫 바이트가 다르다
    expect(buf[0]).toBe(0xde);
    expect(buf.readUInt16BE(1)).toBe(8);
    const plain = new Packr({ useRecords: false, int64AsType: 'bigint', mapsAsObjects: true }).unpack(buf);
    expect(typeof plain.t0).toBe('bigint');
    expect(typeof plain.s).toBe('bigint');
    expect(Array.isArray(plain.va)).toBe(true);
    expect(Array.isArray(plain.tg)).toBe(true);
  });

  it('모르는 v는 추정하지 않고 오류다', () => {
    const buf = new Packr({ useRecords: false }).pack({ v: 2, d: 1 });
    expect(() => decodeEntry(buf)).toThrow(UnknownSchemaVersionError);
  });
});
