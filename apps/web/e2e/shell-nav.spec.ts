// 공통 셸 — 좌측 내비(화면 3 · 그룹 머리 없음 · 메뉴 순서 = 발표 순서) 화면 이동 · 콘텐츠 머리 h1 = 화면 이름(화면 코드 없음) · 화면 모두 한 장
// 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸 · §반응형 규칙
import { expect, test } from '@playwright/test';
import { NAV } from '../lib/nav';
import { shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

test('루트는 첫 화면(직접 비교 실험)으로 넘어간다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/lab$/);
});

test('내비는 화면 3 — 그룹 머리 없이 화면 순서가 발표 순서 그대로', async ({ page }) => {
  await page.goto('/lab');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  await expect(nav.getByText('직접 해 보기', { exact: true })).toHaveCount(0);
  await expect(nav.getByText('현장 적용', { exact: true })).toHaveCount(0);
  await expect(nav.getByRole('link')).toHaveText(NAV.map((i) => i.label));
});

test('좌측 내비로 화면을 차례로 연다 — h1이 화면 이름 · 머리에 화면 코드가 없다', async ({ page }, info) => {
  expect(NAV).toHaveLength(3);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  for (const item of NAV) {
    await nav.getByRole('link', { name: item.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${item.href.replace(/\//g, '\\/')}(\\?.*)?$`));
    const header = page.locator('[data-shell="content-header"]');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(item.label);
    await expect(header).not.toContainText(/EXP-[A-Z]+/);
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

test('접힌 내비(레일)도 화면 3 아이콘 · 이름은 title', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: '사이드바 접기' }).click();
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  await expect(nav.getByRole('link')).toHaveCount(NAV.length);
  for (const item of NAV)
    await expect(nav.getByRole('link', { name: item.label })).toHaveAttribute('title', item.label);
  await page.getByRole('button', { name: '사이드바 펼치기' }).click();
});

test('화면 모두 한 장 — 문서 · 본문 스크롤 없음 · 머리와 내비는 제자리 · 서랍 · 아코디언 없음', async ({
  page,
}, info) => {
  for (const item of NAV) {
    await page.goto(item.href);
    const header = page.locator('[data-shell="content-header"]');
    const navPane = page.locator('[data-shell="nav"]');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(item.label);
    // 데이터가 그려질 시간을 둔다 — 늦게 그려지는 구역이 높이를 키우는지까지 본다
    await page.waitForTimeout(3_000);
    const r = await page.evaluate(() => {
      const main = document.querySelector('[data-shell="content-body"]') as HTMLElement;
      return {
        sh: main.scrollHeight,
        ch: main.clientHeight,
        scrollY: window.scrollY,
        docH: document.documentElement.scrollHeight,
        ih: window.innerHeight,
      };
    });
    expect(r.sh, `${item.label} 본문 스크롤 없음`).toBeLessThanOrEqual(r.ch + 1);
    expect(r.scrollY).toBe(0);
    expect(r.docH).toBeLessThanOrEqual(r.ih);
    expect((await header.boundingBox())?.y).toBe(0);
    expect((await navPane.boundingBox())?.y).toBe(0);
    const expanders = await page.evaluate(
      () =>
        // 지우기 확인 창(PurgeButton)은 접는 서랍이 아니라 한 번 묻는 확인 창이라 뺀다
        [...document.querySelectorAll('[aria-expanded]')].filter(
          (el) => !el.closest('[data-shell="nav"]') && !el.closest('[data-testid="purge"]'),
        ).length + document.querySelectorAll('details').length,
    );
    expect(expanders, `${item.label} 서랍 · 아코디언 없음`).toBe(0);
    // 공통 글꼴 — 화면 모두 Pretendard(셸 · 본문이 같은 글꼴)
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/pretendard/i);
    await shot(page, info, `one-screen-${item.href.slice(1)}`);
  }
});
