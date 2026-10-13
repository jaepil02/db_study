// 실행 동시 1 — 실행은 종류를 합쳐 하나(flow · compare). 정본 docs/07_api/09_datagen.md(#2 409 datagen.run_in_progress)
// flow는 보는 화면이 없어(분산 처리 모니터링 삭제) api로만 시작한다 — 진행 띠는 링크 없이 한 줄로만 알린다.
// ① 다른 종류 — flow가 진행 중이면 ⑤ 직접 비교 실험(compare)의 ▶ 셋이 비활성(이유 툴팁) · 진행 띠에 "다른 측정이 이미 돌고 있어요" 한 줄 · api compare 시작 409
// ② 409 — 화면이 진행 중 실행을 아직 모를 때(현재 실행 읽기를 가려 재현) ▶를 누르면 서버 409 → 진행 중 실행을 단건 조회로 맞춰 한 줄로 알린다(같은 말 두 줄 없음)
//    가림은 409 응답 직후 걷는다 — 계속 가리면 다음 1초 폴링이 "실행 없음"을 돌려 화면이 "서버가 다시 켜졌다"로 읽는다(시험이 만든 상황 · r5 I2)
import { expect, test } from '@playwright/test';
import { API, currentRun, settleRuns, shot, startFlowRun } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

/** lib/runs.ts otherRunText('flow') — 다른 종류 실행이 진행 중일 때의 한 줄(보는 화면이 없어 링크 없음) */
const OTHER_FLOW = '다른 측정이 이미 돌고 있어요';
const COMPARE_PARTS = ['ingest', 'query', 'consistency'] as const;
const SHORT_FLOW = { pps: 1000, durationSec: 60, bizPerSec: 0, readsPerSec: 0 };

test('다른 종류 — flow 진행 중 → ⑤ ▶ 셋 비활성(이유 툴팁) · 진행 띠 한 줄(링크 없음) → api compare 시작 409 → api로 중단 → ▶가 다시 켜진다', async ({
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
  // 진행 띠 — 다른 실행 한 줄만(보는 화면이 없어 링크 없음) · 이 화면 종류의 중단 버튼은 없다
  const strip = page.getByTestId('run-progress-strip');
  await expect(strip.getByTestId('run-other')).toHaveText(OTHER_FLOW);
  await expect(strip.getByTestId('run-other').getByRole('link')).toHaveCount(0);
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

  // api로 중단 → 정리 뒤 ⑤ ▶가 다시 켜진다(1초 폴링이 종결을 읽는다)
  await settleRuns();
  for (const part of COMPARE_PARTS)
    await expect(page.getByTestId(`lab-run-${part}`)).toBeEnabled({ timeout: 10_000 });
  await expect(strip.getByTestId('run-other')).toHaveCount(0);
  await shot(page, info, 'compare-unblocked');
});

test('409 — 화면이 진행 중 실행을 모를 때 ▶ 조회 → 서버 409 → 진행 중 실행을 맞춰 한 줄(같은 말 두 줄 없음)', async ({
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

  // 409 details.runId 단건 조회로 진행 중 flow를 맞춘다 → 다른 종류 한 줄 · 409 띠는 같은 말이라 생략 · ▶ 비활성
  const strip = page.getByTestId('run-progress-strip');
  await expect(strip.getByTestId('run-other')).toHaveText(OTHER_FLOW, { timeout: 10_000 });
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await expect(play).toBeDisabled();
  expect((await currentRun())?.runId).toBe(flowRun.runId);
  // 다음 폴링 뒤에도 그대로("서버가 다시 켜졌다"로 덮이지 않는다)
  await page.waitForTimeout(2_500);
  await expect(strip).not.toContainText('서버가 다시 켜져서');
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await shot(page, info, 'compare-409-band');

  // 새로 읽어도 같다 — 한 줄만
  await page.reload();
  await expect(strip.getByTestId('run-other')).toHaveText(OTHER_FLOW);
  await expect(strip.getByText(OTHER_FLOW, { exact: true })).toHaveCount(1);
  await expect(play).toBeDisabled();
});
