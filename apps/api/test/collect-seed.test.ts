// seed 옵션(S3) — --deadband · --range(모든 태그 · tag_master CHECK와 같은 제약) · 완료 줄 문장
import { describe, expect, it } from 'vitest';
import { describeSeedOptions, parseSeedOptions } from '../src/db/seed-plan';

describe('seed 옵션', () => {
  it('없으면 deadband 0 · range NULL', () => {
    const o = parseSeedOptions(['--tier', 'S']);
    expect(o).toEqual({ deadband: 0, range: null });
    expect(describeSeedOptions(o)).toBe('deadband 0 · range NULL');
  });

  it('--deadband <값> · --range <min>,<max>', () => {
    const o = parseSeedOptions(['--tier', 'S', '--deadband', '0.5', '--range', '-10,120.5']);
    expect(o).toEqual({ deadband: 0.5, range: { min: -10, max: 120.5 } });
    expect(describeSeedOptions(o)).toBe('deadband 0.5 · range -10,120.5');
  });

  it('CHECK와 같은 제약 — deadband ≥ 0 · min < max · 값 누락은 트랜잭션 전에 거부', () => {
    expect(() => parseSeedOptions(['--deadband', '-1'])).toThrow(/--deadband/);
    expect(() => parseSeedOptions(['--deadband', 'abc'])).toThrow(/--deadband/);
    expect(() => parseSeedOptions(['--deadband'])).toThrow(/값이 없다/);
    expect(() => parseSeedOptions(['--range', '5,5'])).toThrow(/--range/);
    expect(() => parseSeedOptions(['--range', '10,0'])).toThrow(/--range/);
    expect(() => parseSeedOptions(['--range', '0'])).toThrow(/--range/);
    expect(() => parseSeedOptions(['--range', ',5'])).toThrow(/--range/);
    expect(() => parseSeedOptions(['--range', '0,1,2'])).toThrow(/--range/);
    expect(() => parseSeedOptions(['--range', '--tier'])).toThrow(/값이 없다/);
  });
});
