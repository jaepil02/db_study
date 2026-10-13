import { describe, expect, it } from 'vitest';
import { HOME_HREF, NAV, NAV_SECTIONS, resolveNav } from '../lib/nav';

describe('내비 — 섹션 2 · 화면 3(메뉴 순서 = 발표 순서 · docs/08_screen/01_standards.md §요청 경로와 공통 셸)', () => {
  it('섹션 2 · 순서 고정', () => {
    expect(NAV_SECTIONS.map((s) => [s.title, s.items.length])).toEqual([
      ['직접 해 보기', 2],
      ['현장 적용', 1],
    ]);
  });

  it('화면 3 · 경로와 이름 · 화면 코드는 싣지 않는다(1층 코드 금지)', () => {
    expect(NAV.map((i) => [i.href, i.label])).toEqual([
      ['/lab', '직접 비교 실험'],
      ['/monitoring', '분산 처리 모니터링'],
      ['/hmi', 'HMI 설비 현황판'],
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
    ['/monitoring', '/monitoring'],
    ['/monitoring/x', '/monitoring'],
    ['/hmi', '/hmi'],
  ])('%s → %s', (path, href) => {
    expect(resolveNav(path)?.href).toBe(href);
  });
  it('접두만 같거나 옛 경로는 잡지 않는다', () => {
    expect(resolveNav('/monitoringx')).toBeNull();
    expect(resolveNav('/labs')).toBeNull();
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
