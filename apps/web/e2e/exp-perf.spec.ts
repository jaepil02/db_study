// EXP-PERF — 규모별 성능 비교(기록 판독). 실행 패널은 이번 범위가 아니다.
// 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF(요소 · 표시 계약 · 판독 규칙)
import { expect, type Page, test } from '@playwright/test';
import { shot } from './support';

const card = (page: Page, title: string | RegExp) =>
  page
    .locator('div')
    .filter({ has: page.getByText(title) })
    .filter({ has: page.locator('canvas, dl, p') })
    .last();

/** ECharts 캔버스가 실제로 그려졌는가(크기 > 0) */
async function expectCanvasDrawn(page: Page, title: string | RegExp) {
  const canvas = page
    .locator('div')
    .filter({ has: page.getByText(title) })
    .filter({ has: page.locator('canvas') })
    .last()
    .locator('canvas')
    .first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);
}

test('진입 — 참고값 배지 · Q2 웜 곡선 · 결론 카드(I2 구간) · 히트맵', async ({ page }, info) => {
  await page.goto('/experiments/perf');
  await expect(page).toHaveURL(/\/experiments\/perf\?q=Q2&cache=warm$/);
  await expect(page.getByRole('button', { name: 'Q2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '웜', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 참고값 배지 — 고정 문구
  await expect(page.getByText('참고값 — 편차 기준 초과(구조 판정만 정본)', { exact: false })).toBeVisible();

  // 곡선
  const curveTitle = '규모 곡선 — Q2 단일 태그 7일 (EXP-02) · 웜';
  await expect(page.getByText(curveTitle)).toBeVisible();
  await expectCanvasDrawn(page, curveTitle);

  // 결론 카드 — Q2 웜 · I2 대비 행이 구조 판정 문장(역전 구간 또는 역전 없음)
  const conclusion = card(page, '결론 카드');
  await expect(conclusion).toContainText('Q2 단일 태그 7일 (EXP-02) · 웜');
  const i2 = conclusion.locator('dt', { hasText: 'I2 대비' }).locator('xpath=following-sibling::dd[1]');
  await expect(i2).toHaveText(/(→|역전 없음 — )/);
  await expect(i2).not.toHaveText('이 쿼리 · 캐시의 구조 판정 행이 없다');
  info.annotations.push({ type: 'Q2 웜 I2', description: (await i2.textContent()) ?? '' });

  // 히트맵
  await expectCanvasDrawn(page, '배수 히트맵 — PG ÷ CH · 웜');
  await shot(page, info, 'perf-q2-warm');
});

test('딥링크 ?q=Q3&cache=cold — 토글 · 곡선 제목 · 결론 카드 · 히트맵이 그 조건으로 열린다', async ({
  page,
}, info) => {
  await page.goto('/experiments/perf?q=Q3&cache=cold');
  await expect(page.getByRole('button', { name: 'Q3', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '콜드', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const curveTitle = '규모 곡선 — Q3 설비 전체 1일 (EXP-03) · 콜드';
  await expect(page.getByText(curveTitle)).toBeVisible();
  await expectCanvasDrawn(page, curveTitle);
  await expect(card(page, '결론 카드')).toContainText('Q3 설비 전체 1일 (EXP-03) · 콜드');
  await expectCanvasDrawn(page, '배수 히트맵 — PG ÷ CH · 콜드');
  await expect(page).toHaveURL(/\?q=Q3&cache=cold$/);

  // 토글을 바꾸면 주소가 따라간다(공유 · 새로고침이 같은 조건)
  await page.getByRole('button', { name: '웜', exact: true }).click();
  await expect(page).toHaveURL(/\?q=Q3&cache=warm$/);
  await expect(page.getByText('규모 곡선 — Q3 설비 전체 1일 (EXP-03) · 웜')).toBeVisible();
  await shot(page, info, 'perf-q3');
});
