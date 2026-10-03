// EXP-PERF — 성능 비교 한 장 화면(1440 × 900 · 스크롤 · 서랍 · 탭 없음) · 두 열(① 센서 데이터 · ② 업무 데이터) · 그림 1 → 그림 2 · 한 줄 정리
// 설계 .omc/plans/web-junior-redesign.md §1 원칙 · §2 화면 A · §4 용어표 · §5 픽셀 예산 · 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF
import { expect, type Page, test } from '@playwright/test';
import { shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

/** 본문 스크롤 요소 — 셸 main(data-shell="content-body") */
const body = (page: Page) => page.locator('[data-shell="content-body"]');

/** 본문에 세로 · 가로 스크롤이 없다(scrollHeight ≤ clientHeight + 1) */
async function expectNoScroll(page: Page) {
  const m = await body(page).evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }));
  expect(m.sh, `본문 세로 스크롤 ${m.sh} > ${m.ch}`).toBeLessThanOrEqual(m.ch + 1);
  expect(m.sw, `본문 가로 스크롤 ${m.sw} > ${m.cw}`).toBeLessThanOrEqual(m.cw + 1);
}

/** 서랍 · 아코디언 없음 — aria-expanded 요소 0(사이드바 접기 · 펼치기 버튼 제외) */
async function expectNoDrawer(page: Page) {
  await expect(page.locator('[aria-expanded]:not([aria-controls="shell-nav"])')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
}

/** 화면 1층에 내부 코드 · 지수 표기 없음 — 보이는 글자(innerText)만 본다(툴팁 title은 제외) */
async function expectNoCodes(page: Page) {
  const text = await body(page).innerText();
  expect(text).not.toMatch(/\b(Q[1-5]|I[12])\b/);
  expect(text).not.toContain('EXP-');
  expect(text).not.toContain('SW-');
  expect(text).not.toContain('10^');
}

test('진입 — 제목 · 두 열 · 그림 1(5행 · 선택 Q2) · 그림 2(캔버스 · 역전 문장) · 왜? 카드 2 · 상황 카드 4 · 한 줄 정리 · 스크롤 · 서랍 · 코드 없음', async ({
  page,
}, info) => {
  await page.goto('/performance');
  await expect(page).toHaveURL(/\/performance\?q=Q2$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'PostgreSQL과 ClickHouse, 어떤 데이터에 무엇이 맞을까?' }),
  ).toBeVisible();

  const sensor = page.getByRole('region', { name: '센서 데이터' });
  const biz = page.getByRole('region', { name: '업무 데이터' });
  await expect(sensor).toContainText('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
  await expect(biz).toContainText('정확해야 하는 업무 데이터는 PostgreSQL이 맞아요');

  // 그림 1 — 질문 5행 · 막대 끝 배수 · 기본 선택 "센서 1개 · 7일"
  const fig1 = page.getByRole('region', { name: '그림 1' });
  await expect(fig1.getByTestId('speed-row')).toHaveCount(5);
  await expect(fig1.getByTestId('speed-row').filter({ hasText: '센서 1개 · 7일' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fig1).toContainText(/CH \d+(\.\d)?배/);
  await expect(fig1).toContainText(/PG \d+(\.\d)?배/);

  // 그림 2 — 캔버스가 실제로 그려진다 · 역전 문장
  const fig2 = page.getByRole('region', { name: '그림 2' });
  await expect(fig2).toContainText('센서 1개 · 7일 — 데이터가 많아질수록 걸리는 시간');
  await expect(fig2.getByTestId('cross-sentence')).toContainText('역전');
  const canvas = fig2.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect(box?.height ?? 0).toBeGreaterThan(120);

  // 왜? 카드 2 · 상황 카드 4(✓ · ✕)
  const why = page.getByRole('region', { name: '왜 그런가' });
  await expect(why).toContainText('필요한 칸만 읽어요');
  await expect(why).toContainText('같은 값끼리 모아 줄여요');
  await expect(biz.getByTestId('situation-card')).toHaveCount(4);
  await expect(biz).toContainText('✓');
  await expect(biz).toContainText('✕');

  // 한 줄 정리 · 각주(툴팁에 기록 번호)
  await expect(page.getByTestId('perf-summary')).toContainText('한 줄 정리:');
  await expect(page.getByTestId('perf-footnote')).toContainText(
    '같은 일을 3번씩 시킨 중간값 · 걸린 시간은 참고용 · 누가 이기는지는 3번 모두 같을 때만',
  );
  await expect(page.getByTestId('perf-footnote-tip')).toHaveAttribute('title', /원천 기록 \d{3}/);

  // 한 장 — 1440 × 900에서 본문 스크롤 없음 · 모든 구역이 화면 안 · 서랍 · 탭 없음 · 코드 문자열 없음
  await expectNoScroll(page);
  for (const r of [sensor, biz, page.getByTestId('perf-footnote')]) {
    const b = await r.boundingBox();
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(900);
  }
  await expectNoDrawer(page);
  await expectNoCodes(page);
  await shot(page, info, 'perf-one-glance');
});

test('그림 1 행을 누르면 그림 2 · 왜? ①이 그 질문으로 · 주소 q가 따라간다 · 딥링크로 열린다', async ({
  page,
}, info) => {
  await page.goto('/performance');
  const fig2 = page.getByRole('region', { name: '그림 2' });
  const row = page.getByTestId('speed-row').filter({ hasText: '설비 1대 · 하루' });
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?q=Q3$/);
  await expect(fig2).toContainText('설비 1대 · 하루 — 데이터가 많아질수록 걸리는 시간');
  await expectNoScroll(page);
  await shot(page, info, 'perf-q3');

  // 딥링크 — 벗어난 값은 Q2
  await page.goto('/performance?q=Q5');
  await expect(page.getByTestId('speed-row').filter({ hasText: '전체 데이터 훑기' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fig2).toContainText('전체 데이터 훑기');
  await page.goto('/performance?q=Q9');
  await expect(page).toHaveURL(/\?q=Q2$/);
});

test('/ 는 /performance로 보낸다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/performance/);
});
