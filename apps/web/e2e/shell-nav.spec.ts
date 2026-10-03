// 공통 셸 — 좌측 내비(평평한 목록) 2화면 이동 · 콘텐츠 머리 h1 = 화면 이름(화면 코드 없음) · 두 화면 모두 한 장(1440 × 900 본문 스크롤 0)
// 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸 · 설계 .omc/plans/web-junior-redesign.md §1 원칙 1 · §5 픽셀 예산
import { expect, test } from '@playwright/test';
import { NAV } from '../lib/nav';
import { shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

const SCREENS = NAV;

test('좌측 내비로 2화면을 차례로 연다 — h1이 화면 이름 · 머리에 화면 코드가 없다', async ({ page }, info) => {
  expect(SCREENS).toHaveLength(2);
  await page.goto('/performance');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  for (const item of SCREENS) {
    await nav.getByRole('link', { name: item.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${item.href.replace(/\//g, '\\/')}(\\?.*)?$`));
    const header = page.locator('[data-shell="content-header"]');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(item.label);
    await expect(header).not.toContainText(/EXP-(PERF|FLOW)/);
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

test('두 화면 모두 한 장 — 문서 · 본문 스크롤 없음 · 머리와 내비는 제자리 · 서랍 · 아코디언 없음', async ({
  page,
}, info) => {
  for (const item of SCREENS) {
    await page.goto(item.href);
    const body = page.locator('[data-shell="content-body"]');
    const header = page.locator('[data-shell="content-header"]');
    const navPane = page.locator('[data-shell="nav"]');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(item.label);
    // 데이터가 그려질 시간을 둔다 — 늦게 그려지는 구역이 높이를 키우는지까지 본다
    await page.waitForTimeout(3_000);

    const m = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    expect(m.sh, `${item.label} 본문 스크롤 없음`).toBeLessThanOrEqual(m.ch + 1);
    const doc = await page.evaluate(() => ({
      scrollY: window.scrollY,
      sh: document.documentElement.scrollHeight,
      ih: window.innerHeight,
    }));
    expect(doc.scrollY).toBe(0);
    expect(doc.sh).toBeLessThanOrEqual(doc.ih);
    expect((await header.boundingBox())?.y).toBe(0);
    expect((await navPane.boundingBox())?.y).toBe(0);
    const expanders = await page.evaluate(
      () =>
        [...document.querySelectorAll('[aria-expanded]')].filter((el) => !el.closest('[data-shell="nav"]'))
          .length + document.querySelectorAll('details').length,
    );
    expect(expanders, `${item.label} 서랍 · 아코디언 없음`).toBe(0);
    // 공통 글꼴 — 두 화면 모두 Pretendard(셸 · 본문이 같은 글꼴)
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/pretendard/i);
    await shot(page, info, `one-screen-${item.href.slice(1)}`);
  }
});
