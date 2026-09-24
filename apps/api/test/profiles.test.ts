import { describe, expect, it } from 'vitest';
import { initialState, PROFILE_CODE, valueAt } from '../src/modules/datagen/signal/profiles';

const SEED = 42;
function series(code: number, tagId: number, n: number): number[] {
  const st = new Float64Array([initialState(code, SEED, tagId)]);
  return Array.from({ length: n }, (_, k) => valueAt(code, SEED, tagId, k, st, 0));
}

describe('신호 프로파일 8종 — 생성 규칙(11_glossary/03)', () => {
  it('SINE — 유한 · 주기적(진폭 안에서 오르내린다)', () => {
    const s = series(PROFILE_CODE.SINE, 7, 1000);
    expect(s.every(Number.isFinite)).toBe(true);
    const span = Math.max(...s) - Math.min(...s);
    expect(span).toBeGreaterThan(1);
    expect(span).toBeLessThan(45);
  });

  it('RANDOM_WALK — 이웃 차이가 작고 누적된다', () => {
    const s = series(PROFILE_CODE.RANDOM_WALK, 7, 1000);
    const steps = s.slice(1).map((v, i) => Math.abs(v - (s[i] ?? 0)));
    expect(Math.max(...steps)).toBeLessThan(6);
  });

  it('RAMP — 선형 증가 후 리셋', () => {
    const s = series(PROFILE_CODE.RAMP, 7, 1000);
    expect(s[0]).toBe(0);
    expect(s.slice(1).filter((v, i) => v < (s[i] ?? 0)).length).toBeGreaterThan(0); // 리셋 발생
    expect(s.every((v) => v >= 0)).toBe(true);
  });

  it('STEP — 구간별 상수', () => {
    const s = series(PROFILE_CODE.STEP, 7, 2000);
    const changes = s.slice(1).filter((v, i) => v !== s[i]).length;
    expect(changes).toBeGreaterThan(0);
    expect(changes).toBeLessThan(2000 / 30);
  });

  it('BINARY — 0 · 1만', () => {
    expect(new Set(series(PROFILE_CODE.BINARY, 7, 5000))).toEqual(new Set([0, 1]));
  });

  it('COUNTER — 단조 증가 · UInt32 랩어라운드', () => {
    const tag = 7;
    const st = new Float64Array([4_294_967_290]);
    const s = Array.from({ length: 10 }, (_, k) => valueAt(PROFILE_CODE.COUNTER, SEED, tag, k, st, 0));
    expect(s.every((v) => Number.isInteger(v) && v >= 0 && v < 4_294_967_296)).toBe(true);
    expect(s.some((v, i) => i > 0 && v < (s[i - 1] ?? 0))).toBe(true); // 랩어라운드
    const plain = series(PROFILE_CODE.COUNTER, tag, 100);
    expect(plain.every((v, i) => i === 0 || v > (plain[i - 1] ?? 0))).toBe(true);
  });

  it('SPIKE — 기저값 위 드문 이상치', () => {
    const s = series(PROFILE_CODE.SPIKE, 7, 20000);
    const med = [...s].sort((a, b) => a - b)[10000] ?? 0;
    const spikes = s.filter((v) => v > med + 30).length;
    expect(spikes).toBeGreaterThan(20);
    expect(spikes).toBeLessThan(400);
  });

  it('DROPOUT — 확률적 결측(NaN = 행 생략) · 결측률 1~10%', () => {
    const s = series(PROFILE_CODE.DROPOUT, 7, 20000);
    const rate = s.filter(Number.isNaN).length / s.length;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.12);
  });

  it('같은 (시드 · 태그 · 시점)은 같은 값 — 다른 시드는 다른 값', () => {
    expect(series(PROFILE_CODE.SINE, 3, 50)).toEqual(series(PROFILE_CODE.SINE, 3, 50));
    const st = new Float64Array(1);
    expect(valueAt(PROFILE_CODE.SPIKE, 43, 3, 5, st, 0)).not.toBe(
      valueAt(PROFILE_CODE.SPIKE, 42, 3, 5, st, 0),
    );
  });
});
