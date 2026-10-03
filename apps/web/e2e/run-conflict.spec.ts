// 실행 동시 1 — flow가 진행 중이면 성능 비교의 시작은 비활성이고 팝오버 · 진행 띠에 "다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기" 링크 · api는 perf 시작을 409로 막는다
// 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙(배치 · 버튼 상태 · 갱신과 응답 처리) · 07_api/09_datagen
// 두 화면 모두 셸 머리의 실행 조작부(RunControl — data-testid run-control-{type})를 쓴다 · 버튼 글자는 화면마다 다르다(첫 버튼)
import { expect, type Page, test } from '@playwright/test';
import { API, currentRun, settleRuns, shot } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

async function openPopover(page: Page, type: 'perf' | 'flow') {
  const control = page.getByTestId(`run-control-${type}`);
  const popover = control.getByRole('dialog', { name: '측정 매개변수' });
  if (!(await popover.isVisible())) await control.getByRole('button').first().click();
  await expect(popover).toBeVisible();
  return { control, popover };
}

test('flow 진행 중 → 성능 비교 시작 비활성 · 다른 실행 안내 링크 · api perf 시작 409 → flow 중단으로 정리', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  // flow 시작(분산 처리 모니터링 화면에서)
  await page.goto('/monitoring');
  const flow = await openPopover(page, 'flow');
  await flow.popover.getByRole('button', { name: '1,000', exact: true }).click();
  await flow.popover.getByRole('button', { name: '30초', exact: true }).click();
  await flow.popover.getByRole('button', { name: '시작', exact: true }).click();
  await expect(flow.control.getByTestId('run-status')).toHaveText('실행 중');
  const flowRun = await currentRun();
  expect(flowRun?.type).toBe('flow');
  // 조회 요청(초당)은 고르지 않으면 기본 20(설계 §9.1) — 조회 섞기도 같은 실행 하나다(동시 1 규칙은 그대로)
  expect(flowRun?.params).toMatchObject({ pps: 1000, durationSec: 30, readsPerSec: 20 });

  // 성능 비교 — 다른 종류 진행 중을 안다 · 이 화면 종류의 실행이 없으니 상태 칩 없음(팝오버 안 "아직 재 보지 않았어요")
  await page.goto('/performance');
  const perf = await openPopover(page, 'perf');
  await expect(perf.control.getByTestId('run-status')).toHaveCount(0);
  await expect(perf.popover.getByTestId('run-none')).toContainText('아직 재 보지 않았어요');
  const start = perf.popover.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeDisabled();
  const link = perf.popover.getByRole('link', {
    name: '다른 측정이 이미 돌고 있어요 — 분산 처리 모니터링 화면에서 보기',
  });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/monitoring');
  // 진행 띠 — 다른 실행 한 줄과 그 화면 링크만(이 화면 종류의 중단 버튼은 없다)
  const strip = page.getByTestId('run-progress-strip');
  await expect(strip.getByTestId('run-other').getByRole('link')).toHaveAttribute('href', '/monitoring');
  await expect(strip.getByRole('button', { name: '중단', exact: true })).toHaveCount(0);
  await shot(page, info, 'perf-blocked');

  // api로 perf 시작 → 409 datagen.run_in_progress(details에 진행 중 실행)
  const res = await fetch(`${API}/api/v1/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'perf', params: { maxExponent: 5 } }),
  });
  expect(res.status).toBe(409);
  const body = (await res.json()) as { error: { code: string; details?: { runId?: string; type?: string } } };
  expect(body.error.code).toBe('datagen.run_in_progress');
  expect(body.error.details?.runId).toBe(flowRun?.runId);
  expect((await currentRun())?.runId).toBe(flowRun?.runId); // 진행 중 실행은 그대로

  // 링크로 분산 처리 모니터링에 가서 중단 → 정리
  await link.click();
  await expect(page).toHaveURL(/\/monitoring$/);
  const stop = page.getByTestId('run-progress-strip').getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(page.getByTestId('run-band')).toHaveText(/^중단됨 — /, { timeout: 30_000 });
  await expect(page.getByTestId('run-control-flow').getByTestId('run-status')).toHaveCount(0);

  // 정리 뒤 성능 비교 시작이 다시 켜진다
  await page.goto('/performance');
  const again = await openPopover(page, 'perf');
  await expect(again.popover.getByRole('button', { name: '시작', exact: true })).toBeEnabled();
  await shot(page, info, 'perf-unblocked');
});
