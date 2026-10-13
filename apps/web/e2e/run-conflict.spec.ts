// 실행 동시 1 — 실행은 종류를 합쳐 하나(flow · compare). 정본 docs/07_api/09_datagen.md(#2 409 datagen.run_in_progress)
// ① 같은 종류 — flow가 진행 중이면 같은 화면의 시작은 비활성 · api로 다시 시작하면 409 · 중단으로 정리하면 다시 켜진다
// ② 다른 종류 — flow가 진행 중이면 ⑤ 직접 비교 실험(compare)의 ▶ 셋이 비활성(이유 툴팁) · 진행 띠에 "분산 처리 모니터링 화면에서 보기" 링크 · api compare 시작 409
// ③ 409 — 화면이 진행 중 실행을 아직 모를 때(현재 실행 읽기를 가려 재현) ▶를 누르면 서버 409 → 진행 중 실행을 단건 조회로 맞춰 링크 한 줄로 알린다(같은 말 두 줄 없음)
//    가림은 409 응답 직후 걷는다 — 계속 가리면 다음 1초 폴링이 "실행 없음"을 돌려 화면이 "서버가 다시 켜졌다"로 읽는다(시험이 만든 상황 · r5 I2)
import { expect, type Page, test } from '@playwright/test';
import { API, currentRun, settleRuns, shot, startFlowRun } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

/** lib/runs.ts otherRunText('flow') — 다른 종류 실행이 진행 중일 때의 한 줄 */
const OTHER_FLOW = '다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기';
const COMPARE_PARTS = ['ingest', 'query', 'consistency'] as const;
const SHORT_FLOW = { pps: 1000, durationSec: 60, bizPerSec: 0, readsPerSec: 0 };

async function openPopover(page: Page, type: 'flow') {
  const control = page.getByTestId(`run-control-${type}`);
  const popover = control.getByRole('dialog', { name: '측정 매개변수' });
  if (!(await popover.isVisible())) await control.getByRole('button').first().click();
  await expect(popover).toBeVisible();
  return { control, popover };
}

test('같은 종류 — flow 진행 중 → 시작 비활성 · api 시작 409(진행 중 실행 그대로) → 중단으로 정리 → 시작이 다시 켜진다', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/monitoring');
  const flow = await openPopover(page, 'flow');
  await flow.popover.getByRole('button', { name: '1,000', exact: true }).click();
  await flow.popover.getByRole('button', { name: '30s', exact: true }).click();
  await flow.popover.getByRole('button', { name: '시작', exact: true }).click();
  await expect(flow.control.getByTestId('run-status')).toHaveText('실행 중');
  const flowRun = await currentRun();
  expect(flowRun?.type).toBe('flow');
  // 조회 요청(초당)은 고르지 않으면 기본 20(설계 §9.1) — 조회 섞기도 같은 실행 하나다(동시 1 규칙은 그대로)
  expect(flowRun?.params).toMatchObject({ pps: 1000, durationSec: 30, readsPerSec: 20 });

  // 진행 중 — 팝오버의 시작은 비활성 · 다른 실행 링크 없음(같은 종류)
  const again = await openPopover(page, 'flow');
  await expect(again.popover.getByRole('button', { name: '시작', exact: true })).toBeDisabled();
  await expect(again.popover.getByRole('link')).toHaveCount(0);
  await shot(page, info, 'flow-blocked');

  // api로 다시 시작 → 409 datagen.run_in_progress(details에 진행 중 실행)
  const res = await fetch(`${API}/api/v1/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'flow',
      params: { pps: 1000, durationSec: 30, bizPerSec: 0, readsPerSec: 0 },
    }),
  });
  expect(res.status).toBe(409);
  const body = (await res.json()) as { error: { code: string; details?: { runId?: string; type?: string } } };
  expect(body.error.code).toBe('datagen.run_in_progress');
  expect(body.error.details?.runId).toBe(flowRun?.runId);
  expect((await currentRun())?.runId).toBe(flowRun?.runId); // 진행 중 실행은 그대로

  // 진행 띠 오른쪽 중단 → 정리
  const stop = page.getByTestId('run-progress-strip').getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(page.getByTestId('run-band')).toHaveText(/^중단됨 — /, { timeout: 30_000 });
  await expect(page.getByTestId('run-control-flow').getByTestId('run-status')).toHaveCount(0);

  // 정리 뒤 시작이 다시 켜진다
  const after = await openPopover(page, 'flow');
  await expect(after.popover.getByRole('button', { name: '시작', exact: true })).toBeEnabled();
  await shot(page, info, 'flow-unblocked');
});

test('다른 종류 — flow 진행 중 → ⑤ ▶ 셋 비활성(이유 툴팁) · 진행 띠 링크 → api compare 시작 409 → 링크로 ⑥에 가서 중단 → ▶가 다시 켜진다', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const flowRun = await startFlowRun(SHORT_FLOW);
  await page.goto('/lab');
  await expect(page.locator('[data-screen="lab"]')).toBeVisible();

  // ▶ 셋 — 비활성 · 툴팁이 이유(다른 측정이 이미 돌고 있어요)를 말한다
  for (const part of COMPARE_PARTS) {
    const play = page.getByTestId(`lab-run-${part}`);
    await expect(play).toBeDisabled();
    await expect(play).toHaveAttribute('title', OTHER_FLOW);
  }
  // 진행 띠 — 다른 실행 한 줄(그 화면 링크)만 · 이 화면 종류의 중단 버튼은 없다
  const strip = page.getByTestId('run-progress-strip');
  const link = strip.getByTestId('run-other').getByRole('link', { name: OTHER_FLOW });
  await expect(link).toHaveAttribute('href', '/monitoring');
  await expect(strip.getByRole('button', { name: '중단', exact: true })).toHaveCount(0);
  await shot(page, info, 'compare-blocked');

  // api로 compare 시작 → 409 datagen.run_in_progress(details에 진행 중 flow 실행)
  const res = await fetch(`${API}/api/v1/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'compare', params: { part: 'query' } }),
  });
  expect(res.status).toBe(409);
  const body = (await res.json()) as { error: { code: string; details?: { runId?: string; type?: string } } };
  expect(body.error.code).toBe('datagen.run_in_progress');
  expect(body.error.details).toMatchObject({ runId: flowRun.runId, type: 'flow' });
  expect((await currentRun())?.runId).toBe(flowRun.runId);

  // 링크로 분산 처리 모니터링에 가서 중단 → 정리
  await link.click();
  await expect(page).toHaveURL(/\/monitoring$/);
  const stop = page.getByTestId('run-progress-strip').getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(page.getByTestId('run-band')).toHaveText(/^중단됨 — /, { timeout: 30_000 });

  // 정리 뒤 ⑤ ▶가 다시 켜진다
  await page.goto('/lab');
  for (const part of COMPARE_PARTS) await expect(page.getByTestId(`lab-run-${part}`)).toBeEnabled();
  await shot(page, info, 'compare-unblocked');
});

test('409 — 화면이 진행 중 실행을 모를 때 ▶ 조회 → 서버 409 → 진행 중 실행을 맞춰 링크 한 줄(같은 말 두 줄 없음)', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const flowRun = await startFlowRun(SHORT_FLOW);
  // 현재 실행 읽기를 "없음"으로 가린다 — 1초 폴링 사이에 다른 화면 · 다른 창에서 실행이 시작된 상황과 같다
  await page.route('**/bff/runs/current', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ run: null }) }),
  );
  await page.goto('/lab');
  const play = page.getByTestId('lab-run-query');
  await expect(play).toBeEnabled();

  const posted = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/bff/runs',
  );
  await play.click();
  const resp = await posted;
  // 가림은 409 응답 직후 걷는다 — 그 뒤 폴링은 실제 진행 중 실행을 읽는다
  await page.unroute('**/bff/runs/current');
  expect(resp.status()).toBe(409);
  expect(resp.request().postDataJSON()).toEqual({ type: 'compare', params: { part: 'query' } });

  // 409 details.runId 단건 조회로 진행 중 flow를 맞춘다 → 다른 종류 링크 한 줄 · 409 띠는 같은 말이라 생략 · ▶ 비활성
  const strip = page.getByTestId('run-progress-strip');
  await expect(strip.getByTestId('run-other').getByRole('link', { name: OTHER_FLOW })).toBeVisible({
    timeout: 10_000,
  });
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await expect(play).toBeDisabled();
  expect((await currentRun())?.runId).toBe(flowRun.runId);
  // 다음 폴링 뒤에도 그대로("서버가 다시 켜졌다"로 덮이지 않는다)
  await page.waitForTimeout(2_500);
  await expect(strip).not.toContainText('서버가 다시 켜져서');
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await shot(page, info, 'compare-409-band');

  // 새로 읽어도 같다 — 링크 한 줄만
  await page.reload();
  await expect(strip.getByTestId('run-other').getByRole('link', { name: OTHER_FLOW })).toBeVisible();
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await expect(play).toBeDisabled();
});
