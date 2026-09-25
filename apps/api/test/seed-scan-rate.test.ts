// 시드 --scan-rate(S5 판정 6 · 모드 A 계단) — 티어 시드의 모든 태그 scan_rate_ms · 제약은 tag_master CHECK(> 0)와 같다
import { describe, expect, it } from 'vitest';
import { effectiveScanRateMs, parseScanRate, parseSeedOptions, seedPlan } from '../src/db/seed-plan';

describe('seed --scan-rate', () => {
  it('없으면 티어 기본(M 1,000 · M+ 100) · 있으면 그 값', () => {
    const m = seedPlan({ kind: 'tier', tier: 'M' });
    expect(effectiveScanRateMs(m, parseScanRate(['--tier', 'M']))).toBe(1000);
    expect(effectiveScanRateMs(seedPlan({ kind: 'tier', tier: 'M+' }), parseScanRate([]))).toBe(100);
    expect(effectiveScanRateMs(m, parseScanRate(['--tier', 'M', '--scan-rate', '200']))).toBe(200);
    expect(parseSeedOptions(['--tier', 'M', '--scan-rate', '200'])).toEqual({ deadband: 0, range: null }); // 기존 옵션 모양 불변
  });

  it('정수 ms > 0만 받는다', () => {
    for (const bad of ['0', '-5', '1.5', 'abc'])
      expect(() => parseScanRate(['--scan-rate', bad])).toThrow(/--scan-rate/);
    expect(() => parseScanRate(['--scan-rate'])).toThrow(/값이 없다/);
  });
});
