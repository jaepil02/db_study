// EXP-FLOW 실행 패널 — 실제 api로 flow 실행(pps 1000 · 30초 · 업무 1/초) 시작 → 진행 막대 · 라이브 표지 · 업무 명령 → 중단
// 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 요소 실행 패널 행 · §실행 패널 — 두 화면 공통 규칙
import { expect, test } from '@playwright/test';
import { currentRun, kstClock, settleRuns, shot } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

test('pps 1000 · 30초 · 업무 1/초 시작 → 진행 증가 · 라이브 표지 · master.device.patch → 중단 → 중단됨 띠 · 경과 고정', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/experiments/flow');
  await expect(page.locator('[data-flow="header"]')).toContainText('흐름 구독 구독 중');
  const panel = page.getByTestId('run-panel-flow');
  const start = panel.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeEnabled();
  for (const v of ['1,000', '30초', '1/초']) {
    await panel.getByRole('button', { name: v, exact: true }).click();
    await expect(panel.getByRole('button', { name: v, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }

  const posted = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/bff/runs',
  );
  await start.click();
  const req = await posted;
  expect(req.postDataJSON()).toEqual({ type: 'flow', params: { pps: 1000, durationSec: 30, bizPerSec: 1 } });
  expect((await req.response())?.status()).toBe(202);

  const status = panel.getByTestId('run-status');
  await expect(status).toHaveText('실행 중');
  await expect(start).toBeDisabled();

  // 진행 막대 증가
  const bar = panel.getByTestId('run-progress').getByRole('progressbar');
  await expect(bar).toBeVisible();
  const pct = async () => Number(await bar.getAttribute('aria-valuenow'));
  const p0 = await pct();
  await expect.poll(pct, { timeout: 10_000, message: '진행 % 증가' }).toBeGreaterThan(p0);

  // 흐름도 머리 라이브 표지
  await expect(page.getByTestId('flow-live-run')).toHaveText('라이브 flow 실행 중 — pps 1,000 · 업무 1/초');

  // 업무 명령 목록 — 실행이 흘린 master.device.patch(biz-writer)
  const bizRow = page
    .getByRole('row')
    .filter({ hasText: 'master.device.patch' })
    .filter({ hasText: 'biz-writer' });
  await expect(bizRow.first()).toBeVisible({ timeout: 15_000 });
  await shot(page, info, 'flow-running');

  // 중단
  const stop = panel.getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(status).toHaveText('중단됨', { timeout: 30_000 });
  const run = await currentRun();
  expect(run?.status).toBe('stopped');
  const band = panel.getByTestId('run-band');
  await expect(band).toHaveText(/^중단됨 — 소요 (\d+분 )?\d+(\.\d)?초 · 종료 \d{2}:\d{2}:\d{2} KST/);
  await expect(band).toContainText(`종료 ${kstClock(run?.endedAt as string)}`);
  await expect(page.getByTestId('flow-live-run')).toHaveCount(0);

  // 종결 뒤 경과 고정 — 틱이 멈춘다
  const elapsed = panel.getByTestId('run-elapsed');
  const e1 = await elapsed.textContent();
  await page.waitForTimeout(2_500);
  await expect(elapsed).toHaveText(e1 ?? '');
  await expect(start).toBeEnabled();
  await expect(stop).toBeDisabled();
  // 단계 — publish 중단(■) · drain 건너뜀(–)
  const titles = await panel
    .getByTestId('run-steps')
    .locator('li span[title]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  expect(titles).toContain('stopped');
  await panel.scrollIntoViewIfNeeded();
  await shot(page, info, 'flow-stopped');
});
