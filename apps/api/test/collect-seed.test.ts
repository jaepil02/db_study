// seed 옵션(S3) — --deadband · --range(모든 태그 · tag_master CHECK와 같은 제약) · 완료 줄 문장
import { CARD_LINES, CARD_PROCESSES } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { describeSeedOptions, parseSeedOptions, seedLayout } from '../src/db/seed-plan';

describe('seed 옵션', () => {
  it('없으면 deadband 0 · 슬라이스는 range NULL · 카드 라인은 템플릿 범위(태그별)', () => {
    const o = parseSeedOptions(['--slice', 's2']);
    expect(o).toEqual({ deadband: 0, range: null });
    expect(describeSeedOptions(o, seedLayout({ kind: 'slice' }))).toBe('deadband 0 · range NULL');
    // 카드 라인 — 템플릿 범위 그대로(수량 태그는 하한 0만 · 상한 NULL — 누계라 끝이 없다) · 라인 3개분
    const tpl = CARD_PROCESSES.flatMap((p) => p.tags);
    const both = tpl.filter((t) => t.rangeMin !== null && t.rangeMax !== null).length * CARD_LINES.length;
    const minOnly = tpl.filter((t) => t.rangeMin !== null && t.rangeMax === null).length * CARD_LINES.length;
    expect(both + minOnly).toBe(tpl.length * CARD_LINES.length);
    expect(describeSeedOptions(parseSeedOptions([]), seedLayout({ kind: 'card-line' }))).toBe(
      `deadband 0 · range 태그별(템플릿 — 양끝 ${both} · 하한만 ${minOnly})`,
    );
  });

  it('--deadband <값> · --range <min>,<max>', () => {
    const o = parseSeedOptions(['--slice', 's2', '--deadband', '0.5', '--range', '-10,120.5']);
    expect(o).toEqual({ deadband: 0.5, range: { min: -10, max: 120.5 } });
    expect(describeSeedOptions(o, seedLayout({ kind: 'slice' }))).toBe('deadband 0.5 · range -10,120.5');
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
    expect(() => parseSeedOptions(['--range', '--slice'])).toThrow(/값이 없다/);
  });
});
