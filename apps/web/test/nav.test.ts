import { describe, expect, it } from 'vitest';
import {
  EMPTY_EXPANSION,
  isExpanded,
  NAV,
  NAV_DEFAULT_EXPANDED,
  resolveNav,
  reviveExpansion,
  setExpanded,
} from '../lib/nav';

describe('내비 트리 — 섹션 4 · 화면 7', () => {
  it('섹션 4 · 화면 7 · flat은 항목 하나뿐인 섹션만', () => {
    expect(NAV).toHaveLength(4);
    expect(NAV.flatMap((s) => s.items)).toHaveLength(7);
    for (const s of NAV) if (s.flat) expect(s.items).toHaveLength(1);
    expect(new Set(NAV.flatMap((s) => s.items.map((i) => i.code))).size).toBe(7);
  });
});

describe('resolveNav — 가장 긴 접두', () => {
  it.each([
    ['/realtime', 'monitor', 'DSH-REALTIME'],
    ['/realtime/1', 'monitor', 'DSH-REALTIME'],
    ['/realtime/tag/5', 'monitor', 'DSH-REALTIME'],
    ['/trend', 'monitor', 'ANL-TREND'],
    ['/alarms', 'alarm', 'ALM-CONSOLE'],
    ['/alarms/rules', 'alarm', 'ALM-RULES'],
    ['/alarms/rules/3', 'alarm', 'ALM-RULES'],
    ['/admin/master/devices/2', 'admin', 'ADM-MASTER'],
    ['/experiments', 'experiment', 'EXP-CONSOLE'],
    ['/experiments/compare', 'experiment', 'EXP-COMPARE'],
  ])('%s → %s · %s', (path, section, code) => {
    const r = resolveNav(path);
    expect(r?.section.id).toBe(section);
    expect(r?.item.code).toBe(code);
  });
  it('접두만 같은 다른 경로는 잡지 않는다', () => {
    expect(resolveNav('/alarmsx')).toBeNull();
    expect(resolveNav('/')).toBeNull();
  });
});

describe('펼침 상태 — 기본값과 다른 선택만 저장', () => {
  it('처음은 기본 펼침', () => {
    for (const id of NAV_DEFAULT_EXPANDED) expect(isExpanded(EMPTY_EXPANSION, id)).toBe(true);
  });
  it('기본 펼침 섹션을 접으면 closed에만 · 다시 열면 빈 상태로 돌아간다', () => {
    const a = setExpanded(EMPTY_EXPANSION, ['alarm'], false);
    expect(a).toEqual({ opened: [], closed: ['alarm'] });
    expect(isExpanded(a, 'alarm')).toBe(false);
    expect(setExpanded(a, ['alarm'], true)).toEqual({ opened: [], closed: [] });
  });
  it('기본값이 아닌 섹션을 열면 opened에', () => {
    expect(setExpanded(EMPTY_EXPANSION, ['x'], true)).toEqual({ opened: ['x'], closed: [] });
  });
  it('저장값 모양이 어긋나면 빈 상태', () => {
    expect(reviveExpansion(null)).toEqual(EMPTY_EXPANSION);
    expect(reviveExpansion({ opened: ['a', 3], closed: 'x' })).toEqual({ opened: ['a'], closed: [] });
  });
});
