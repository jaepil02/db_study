// COL-04 디코딩 — data_type 6 × word_order 4 왕복 · FLOAT64 두 축 · 틀린 순서는 유한값 → BAD_RANGE(06_pipeline/02 §디코딩)
import { QUALITY } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import {
  DATA_TYPE_WORDS,
  decodeRaw,
  encodeWords,
  finiteOrPlaceholder,
  type RegisterDataType,
  valueQuality,
  WORD_ORDERS,
} from '../src/modules/collector/decode';

const SAMPLES: Record<RegisterDataType, number[]> = {
  UINT16: [0, 1, 0x1234, 0xffff],
  INT16: [-32768, -1, 0, 12345, 32767],
  UINT32: [0, 1, 0x12345678, 0xffffffff],
  INT32: [-2147483648, -1, 0, 0x12345678, 2147483647],
  FLOAT32: [0, -1.5, 72.80000305175781, 3.4028234663852886e38, 1.401298464324817e-45],
  FLOAT64: [0, -1.5, Math.PI, 1e308, -123456.789, 5e-324],
};

describe('디코딩 ↔ 인코딩 왕복 — 6 타입 × 4 순서', () => {
  for (const type of Object.keys(SAMPLES) as RegisterDataType[]) {
    for (const order of WORD_ORDERS) {
      it(`${type} · ${order}`, () => {
        for (const v of SAMPLES[type]) {
          const words = encodeWords(v, type, order);
          expect(words).toHaveLength(DATA_TYPE_WORDS[type]);
          for (const w of words) expect(w).toBe(w & 0xffff);
          // 응답 배열 중간에 두어 offset도 함께 본다
          const response = [0xdead, ...words, 0xbeef];
          expect(decodeRaw(response, 1, type, order)).toBe(v);
        }
      });
    }
  }

  it('16비트는 워드 순서 적용 없음 — 네 순서의 워드가 같다', () => {
    for (const type of ['UINT16', 'INT16'] as const)
      for (const order of WORD_ORDERS) expect(encodeWords(0x1234, type, order)).toEqual([0x1234]);
  });

  it('정수 타입 인코딩은 반올림 · 표현 범위로 포화(모드 A)', () => {
    expect(encodeWords(12.6, 'UINT16', 'ABCD')).toEqual([13]);
    expect(encodeWords(-5, 'UINT16', 'ABCD')).toEqual([0]);
    expect(encodeWords(70000, 'INT16', 'ABCD')).toEqual([0x7fff]);
    expect(decodeRaw(encodeWords(1e12, 'UINT32', 'CDAB'), 0, 'UINT32', 'CDAB')).toBe(0xffffffff);
  });
});

describe('FLOAT64 4워드 — 두 축(워드 순서 · 바이트 순서) · 하위 워드 먼저는 완전 역순', () => {
  // 바이트 A..H = 01..08(A가 최상위)인 double
  const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const v = bytes.readDoubleBE(0);

  it('ABCD = W0 W1 W2 W3', () => {
    expect(encodeWords(v, 'FLOAT64', 'ABCD')).toEqual([0x0102, 0x0304, 0x0506, 0x0708]);
  });
  it('CDAB = W3 W2 W1 W0(반쪽 교환 W1 W0 W3 W2가 아니다)', () => {
    expect(encodeWords(v, 'FLOAT64', 'CDAB')).toEqual([0x0708, 0x0506, 0x0304, 0x0102]);
  });
  it("BADC = W0' W1' W2' W3'", () => {
    expect(encodeWords(v, 'FLOAT64', 'BADC')).toEqual([0x0201, 0x0403, 0x0605, 0x0807]);
  });
  it('DCBA = 8바이트 완전 리틀엔디안', () => {
    const words = encodeWords(v, 'FLOAT64', 'DCBA');
    expect(words).toEqual([0x0807, 0x0605, 0x0403, 0x0201]);
    const wire = Buffer.alloc(8);
    words.forEach((w, i) => {
      wire.writeUInt16BE(w, i * 2);
    });
    expect(wire.readDoubleLE(0)).toBe(v);
  });
  it('32비트도 같은 두 축 — CDAB = W1 W0 · DCBA = 리틀엔디안', () => {
    const f = Buffer.from([1, 2, 3, 4]).readFloatBE(0);
    expect(encodeWords(f, 'FLOAT32', 'CDAB')).toEqual([0x0304, 0x0102]);
    expect(encodeWords(f, 'FLOAT32', 'DCBA')).toEqual([0x0403, 0x0201]);
  });
});

describe('틀린 word_order — 예외가 아니라 엉뚱한 유한값 · 범위 판정에서만 드러난다(A형)', () => {
  it('FLOAT64 72.8을 ABCD로 쓰고 CDAB로 읽으면 유한값(약 4.7e-62) · 범위 1~100 밖이라 BAD_RANGE', () => {
    const words = encodeWords(72.8, 'FLOAT64', 'ABCD');
    const wrong = decodeRaw(words, 0, 'FLOAT64', 'CDAB');
    expect(Number.isFinite(wrong)).toBe(true);
    expect(wrong).not.toBe(72.8);
    expect(valueQuality(wrong, { rangeMin: 1, rangeMax: 100 }, QUALITY.SIMULATED)).toBe(QUALITY.BAD_RANGE);
    expect(valueQuality(72.8, { rangeMin: 1, rangeMax: 100 }, QUALITY.SIMULATED)).toBe(QUALITY.SIMULATED);
  });

  it('비유한 값의 싣는 값 — NaN 0 · ±무한대 ±MAX_VALUE', () => {
    expect(finiteOrPlaceholder(Number.NaN)).toBe(0);
    expect(finiteOrPlaceholder(Number.POSITIVE_INFINITY)).toBe(Number.MAX_VALUE);
    expect(finiteOrPlaceholder(Number.NEGATIVE_INFINITY)).toBe(-Number.MAX_VALUE);
    expect(finiteOrPlaceholder(1.5)).toBe(1.5);
  });
});
