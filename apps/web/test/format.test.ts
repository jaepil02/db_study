// 숫자 쉬운 표기(lib/format.ts) — 지수 표기를 쓰지 않는다 · 반올림한 값으로 자릿수를 고른다.
import { describe, expect, it } from 'vitest';
import { bytesText, durText, msText, roughText, timesText } from '../lib/format';

describe('형식', () => {
  it('msText — 100 이상 정수(천 단위 구분) · 1 이상 소수 1자리 · 1 미만 유효 숫자 2자리', () => {
    expect(msText(21827.079)).toBe('21,827');
    expect(msText(3.687)).toBe('3.7');
    expect(msText(0.177)).toBe('0.18');
  });
  it('timesText · roughText — 반올림한 값으로 자릿수를 고른다', () => {
    expect(timesText(9.96)).toBe('10');
    expect(timesText(9.94)).toBe('9.9');
    expect(timesText(1234.4)).toBe('1,234');
    expect(roughText(4.53)).toBe('4.5');
  });
  it('durText — 1초 미만 밀리초 · 이상 초(10초 이상 정수)', () => {
    expect(durText(0.102)).toBe('0.1ms');
    expect(durText(793)).toBe('793ms');
    expect(durText(4608)).toBe('4.6s');
    expect(durText(40769.747)).toBe('41s');
  });
  it('bytesText — 10^3 단위', () => {
    expect(bytesText(108_126_691_328)).toBe('108GB');
    expect(bytesText(4_528_577_595)).toBe('4.5GB');
    expect(bytesText(3_271_454)).toBe('3.3MB');
    expect(bytesText(900)).toBe('900바이트');
  });
});
