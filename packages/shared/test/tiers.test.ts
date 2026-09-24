import { describe, expect, it } from 'vitest';
import { CAPACITY_TIER_NAMES, CAPACITY_TIERS } from '../src/tiers';
import { docTable } from './doc-table';

describe('용량 티어 — 정본 04_architecture/07 §용량 티어와 같다', () => {
  const rows = docTable('04_architecture/07_capacity_planning.md', '용량 티어');
  const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));

  it('티어 이름 · 순서가 같다', () => {
    expect(rows.map((r) => r[0])).toEqual(CAPACITY_TIER_NAMES);
  });

  it.each(CAPACITY_TIER_NAMES)('%s — 설비 · 태그/설비 · 주기 · 초당 포인트', (name) => {
    const row = rows.find((r) => r[0] === name);
    const t = CAPACITY_TIERS[name];
    expect(row).toBeDefined();
    expect(num(row?.[1] ?? '')).toBe(t.devices);
    expect(num(row?.[2] ?? '')).toBe(t.tagsPerDevice);
    expect(num(row?.[3] ?? '')).toBe(t.hz);
    expect(num(row?.[4] ?? '')).toBe(t.pointsPerSecond);
    expect(t.devices * t.tagsPerDevice * t.hz).toBe(t.pointsPerSecond);
  });
});
