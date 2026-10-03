import { describe, expect, it } from 'vitest';
import { NAV, resolveNav } from '../lib/nav';

describe('내비 — 화면 2 · 섹션 없는 평평한 목록(D-14)', () => {
  it('화면 2 · 경로와 이름 · 화면 코드는 싣지 않는다(1층 코드 금지)', () => {
    expect(NAV.map((i) => [i.href, i.label])).toEqual([
      ['/performance', '성능 비교'],
      ['/monitoring', '분산 처리 모니터링'],
    ]);
    expect(NAV.every((i) => !('code' in i))).toBe(true);
  });
});

describe('resolveNav — 가장 긴 접두', () => {
  it.each([
    ['/performance', '/performance'],
    ['/performance/x', '/performance'],
    ['/monitoring', '/monitoring'],
  ])('%s → %s', (path, href) => {
    expect(resolveNav(path)?.href).toBe(href);
  });
  it('접두만 같거나 옛 경로는 잡지 않는다', () => {
    expect(resolveNav('/monitoringx')).toBeNull();
    expect(resolveNav('/experiments/perf')).toBeNull();
    expect(resolveNav('/realtime')).toBeNull();
    expect(resolveNav('/')).toBeNull();
  });
});
