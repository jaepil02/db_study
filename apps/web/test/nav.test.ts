import { describe, expect, it } from 'vitest';
import { HOME_HREF, NAV, resolveNav } from '../lib/nav';

describe('내비 — 화면 2 · 그룹 없음(메뉴 순서 = 발표 순서 · docs/08_screen/01_standards.md §요청 경로와 공통 셸)', () => {
  it('화면 2 · 경로와 이름 · 화면 코드는 싣지 않는다(1층 코드 금지)', () => {
    expect(NAV.map((i) => [i.href, i.label])).toEqual([
      ['/lab', '직접 비교 실험'],
      ['/hmi', '설비 현황판'],
    ]);
    expect(NAV.every((i) => !('code' in i))).toBe(true);
    expect(new Set(NAV.map((i) => i.icon)).size).toBe(NAV.length);
  });

  it('루트는 첫 화면(직접 비교 실험)으로', () => {
    expect(HOME_HREF).toBe(NAV[0]?.href);
  });
});

describe('resolveNav — 가장 긴 접두', () => {
  it.each([
    ['/lab', '/lab'],
    ['/lab/x', '/lab'],
    ['/hmi', '/hmi'],
  ])('%s → %s', (path, href) => {
    expect(resolveNav(path)?.href).toBe(href);
  });
  it('접두만 같거나 옛 경로는 잡지 않는다', () => {
    expect(resolveNav('/labs')).toBeNull();
    expect(resolveNav('/monitoring')).toBeNull();
    expect(resolveNav('/performance')).toBeNull();
    expect(resolveNav('/concepts')).toBeNull();
    expect(resolveNav('/strengths')).toBeNull();
    expect(resolveNav('/timeseries')).toBeNull();
    expect(resolveNav('/architecture')).toBeNull();
    expect(resolveNav('/experiments/perf')).toBeNull();
    expect(resolveNav('/realtime')).toBeNull();
    expect(resolveNav('/')).toBeNull();
  });
});
