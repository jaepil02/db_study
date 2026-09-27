// 실행 동시 1 — flow가 진행 중이면 EXP-PERF의 시작은 비활성이고 "다른 실행 진행 중(EXP-FLOW)" 링크 · api는 perf 시작을 409로 막는다
// 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙(버튼 상태 · 갱신과 응답 처리) · 07_api/09_datagen
import { expect, test } from '@playwright/test';
import { API, currentRun, settleRuns, shot } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

test('flow 진행 중 → EXP-PERF 시작 비활성 · 다른 실행 안내 · api perf 시작 409 → flow 중단으로 정리', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  // flow 시작(화면에서)
  await page.goto('/experiments/flow');
  const flow = page.getByTestId('run-panel-flow');
  await flow.getByRole('button', { name: '1,000', exact: true }).click();
  await flow.getByRole('button', { name: '30초', exact: true }).click();
  await flow.getByRole('button', { name: '시작', exact: true }).click();
  await expect(flow.getByTestId('run-status')).toHaveText('실행 중');
  const flowRun = await currentRun();
  expect(flowRun?.type).toBe('flow');

  // EXP-PERF — current를 받고 다른 종류 진행 중을 안다
  await page.goto('/experiments/perf');
  const perf = page.getByTestId('run-panel-perf');
  await expect(perf.getByTestId('run-status')).not.toHaveText('');
  const start = perf.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeDisabled();
  const link = perf.getByRole('link', { name: '다른 실행 진행 중(EXP-FLOW) — 그 화면으로' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/experiments/flow');
  await expect(perf.getByRole('button', { name: '중단', exact: true })).toBeDisabled();
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

  // 링크로 EXP-FLOW에 가서 중단 → 정리
  await link.click();
  await expect(page).toHaveURL(/\/experiments\/flow$/);
  const stop = page.getByTestId('run-panel-flow').getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(page.getByTestId('run-panel-flow').getByTestId('run-status')).toHaveText('중단됨', {
    timeout: 30_000,
  });

  // 정리 뒤 EXP-PERF 시작이 다시 켜진다
  await page.goto('/experiments/perf');
  await expect(
    page.getByTestId('run-panel-perf').getByRole('button', { name: '시작', exact: true }),
  ).toBeEnabled();
  await shot(page, info, 'perf-unblocked');
});
