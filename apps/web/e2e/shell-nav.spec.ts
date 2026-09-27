// 공통 셸 — 좌측 내비 트리 9화면 이동 · 콘텐츠 머리 h1 = 화면 이름 · 본문만 스크롤
// 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
import { expect, test } from '@playwright/test';
import { NAV } from '../lib/nav';
import { shot } from './support';

const SCREENS = NAV.flatMap((s) => s.items);

test('좌측 트리로 9화면을 차례로 연다 — h1이 화면 이름 · 코드 표지', async ({ page }, info) => {
  expect(SCREENS).toHaveLength(9);
  await page.goto('/realtime');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  for (const item of SCREENS) {
    await nav.getByRole('link', { name: item.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${item.href.replace(/\//g, '\\/')}(\\?.*)?$`));
    const header = page.locator('[data-shell="content-header"]');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(item.label);
    await expect(header).toContainText(item.code);
    // 화면 제목은 콘텐츠 머리의 h1 하나다
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // 현재 화면 표시
    await expect(nav.getByRole('link', { name: item.label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
  await shot(page, info, 'last-screen');
});

test('본문만 스크롤한다 — 문서는 화면 높이에 고정 · 머리와 내비는 제자리', async ({ page }, info) => {
  // 긴 화면(EXP-PERF — 곡선 · 히트맵 · 표 · 조건 표지)
  await page.goto('/experiments/perf');
  await expect(page.getByText('배수 히트맵', { exact: false }).first()).toBeVisible();
  const body = page.locator('[data-shell="content-body"]');
  const header = page.locator('[data-shell="content-header"]');
  const navPane = page.locator('[data-shell="nav"]');

  const m = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(m.sh, '본문이 화면보다 길어야 스크롤 판정이 된다').toBeGreaterThan(m.ch);

  await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  const doc = await page.evaluate(() => ({
    scrollY: window.scrollY,
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
  }));
  expect(doc.scrollY).toBe(0);
  expect(doc.sh).toBeLessThanOrEqual(doc.ih);
  expect((await header.boundingBox())?.y).toBe(0);
  expect((await navPane.boundingBox())?.y).toBe(0);
  await expect(header.getByRole('heading', { level: 1 })).toBeInViewport();
  await shot(page, info, 'scrolled-body');
});
